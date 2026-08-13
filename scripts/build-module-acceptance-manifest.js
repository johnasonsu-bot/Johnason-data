#!/usr/bin/env node
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const { evaluateModuleEvidence } = require("../packages/data-platform-core-kernel/src");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function listAcceptedEvidence(evidenceRoot) {
  if (!fs.existsSync(evidenceRoot)) return [];
  const found = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && entry.name === "accepted.json") found.push(entryPath);
    }
  };
  visit(evidenceRoot);
  return found.sort();
}

function readAndValidateEvidenceFiles(evidenceRoot) {
  const names = new Set();
  return listAcceptedEvidence(evidenceRoot).map((evidenceFile) => {
    const evidence = JSON.parse(fs.readFileSync(evidenceFile, "utf8"));
    const expected = path.join(evidenceRoot, evidence.moduleName || "", evidence.moduleVersion || "", "accepted.json");
    if (path.resolve(evidenceFile) !== path.resolve(expected)) {
      throw new Error(`evidence path mismatch for ${evidence.moduleName || "unknown module"}`);
    }
    if (names.has(evidence.moduleName)) throw new Error(`duplicate accepted module: ${evidence.moduleName}`);
    names.add(evidence.moduleName);
    return { evidenceFile, evidence };
  });
}

function validateExternalPrefix(installPrefix) {
  const resolved = fs.realpathSync(installPrefix);
  const repository = fs.realpathSync(REPOSITORY_ROOT);
  if (isWithin(repository, resolved) || isWithin(resolved, repository)) {
    throw new Error("installed evidence requires an external install prefix, not repository source");
  }
  return resolved;
}

function getLockEntry(lock, packageName) {
  const rootVersion = lock.packages?.[""]?.dependencies?.[packageName];
  const entry = lock.packages?.[`node_modules/${packageName}`];
  if (!entry || typeof entry !== "object") throw new Error(`lock entry missing for ${packageName}`);
  if (rootVersion !== entry.version) throw new Error(`lock version is not exact for ${packageName}`);
  if (typeof entry.resolved !== "string" || /^(?:file:|workspace:)/.test(entry.resolved)) {
    throw new Error(`lock resolved source is not a registry tarball for ${packageName}`);
  }
  if (typeof entry.integrity !== "string") throw new Error(`lock integrity missing for ${packageName}`);
  return entry;
}

function findVerifiedTarball(tarballDirectory, integrity) {
  const matches = fs.readdirSync(tarballDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tgz"))
    .map((entry) => path.join(tarballDirectory, entry.name))
    .filter((tarball) => `sha512-${crypto.createHash("sha512").update(fs.readFileSync(tarball)).digest("base64")}` === integrity);
  if (matches.length !== 1) throw new Error("exactly one tarball must match installed package integrity");
  return matches[0];
}

function listInstalledFiles(directory, current = directory, files = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);
    const relative = path.relative(directory, entryPath).split(path.sep).join("/");
    const stat = fs.lstatSync(entryPath);
    if (stat.isSymbolicLink()) throw new Error(`installed package content mismatch: symlink ${relative}`);
    if (stat.isDirectory()) listInstalledFiles(directory, entryPath, files);
    else if (stat.isFile()) files.push(relative);
    else throw new Error(`installed package content mismatch: unsupported entry ${relative}`);
  }
  return files.sort();
}

function nullTerminated(buffer) {
  const end = buffer.indexOf(0);
  return buffer.subarray(0, end === -1 ? buffer.length : end).toString("utf8");
}

function readPackageTarball(tarball) {
  const archive = zlib.gunzipSync(fs.readFileSync(tarball));
  const files = new Map();
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = nullTerminated(header.subarray(0, 100));
    const prefix = nullTerminated(header.subarray(345, 500));
    const fullName = prefix ? `${prefix}/${name}` : name;
    const sizeText = nullTerminated(header.subarray(124, 136)).trim();
    const size = Number.parseInt(sizeText || "0", 8);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("tarball has an invalid entry size");
    const type = String.fromCharCode(header[156] || 48);
    const dataOffset = offset + 512;
    const nextOffset = dataOffset + Math.ceil(size / 512) * 512;
    if (nextOffset > archive.length) throw new Error("tarball has a truncated entry");
    if (!["0", "5"].includes(type)) throw new Error(`tarball contains unsupported entry type: ${type}`);
    if (type === "0") {
      if (!fullName.startsWith("package/") || fullName.includes("../") || fullName.includes("\\")) {
        throw new Error("tarball contains an unsafe package path");
      }
      const relative = fullName.slice("package/".length);
      if (!relative || files.has(relative)) throw new Error("tarball contains duplicate package paths");
      files.set(relative, Buffer.from(archive.subarray(dataOffset, dataOffset + size)));
    }
    offset = nextOffset;
  }
  if (files.size === 0) throw new Error("tarball contains no package files");
  return files;
}

function verifyInstalledContent(packageDirectory, tarball) {
  const archive = readPackageTarball(tarball);
  const archiveFiles = [...archive.keys()].sort();
  const installedFiles = listInstalledFiles(packageDirectory);
  if (JSON.stringify(installedFiles) !== JSON.stringify(archiveFiles)) throw new Error("installed package content mismatch: file list");

  const digest = crypto.createHash("sha256");
  for (const relative of archiveFiles) {
    const archiveBytes = archive.get(relative);
    const installedBytes = fs.readFileSync(path.join(packageDirectory, ...relative.split("/")));
    if (!archiveBytes.equals(installedBytes)) throw new Error(`installed package content mismatch: ${relative}`);
    digest.update(relative).update("\0").update(crypto.createHash("sha256").update(installedBytes).digest()).update("\0");
  }
  return `sha256:${digest.digest("hex")}`;
}

const MODULE_AUDITOR = String.raw`
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const prefix = fs.realpathSync(process.env.ACCEPTANCE_PREFIX);
const entry = fs.realpathSync(process.argv[1]);
const builtins = new Set(Module.builtinModules.concat(Module.builtinModules.map((name) => "node:" + name)));
function within(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
function audit(resolved) {
  if (builtins.has(resolved) || !path.isAbsolute(resolved)) return;
  if (!within(prefix, fs.realpathSync(resolved))) throw new Error("OUTSIDE_PREFIX");
}
const resolve = Module._resolveFilename;
Module._resolveFilename = function (...args) {
  const resolved = resolve.apply(this, args);
  audit(resolved);
  return resolved;
};
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (!builtins.has(request)) audit(resolve.call(Module, request, parent, isMain));
  return load.call(this, request, parent, isMain);
};
const exported = require(entry);
process.stdout.write(JSON.stringify(Object.keys(exported).sort()));
`;

function loadInstalledExports(installPrefix, packageName, tarball) {
  const packageDirectory = fs.realpathSync(path.join(installPrefix, "node_modules", ...packageName.split("/")));
  if (!isWithin(installPrefix, packageDirectory) || isWithin(REPOSITORY_ROOT, packageDirectory)) {
    throw new Error(`installed package escapes external prefix: ${packageName}`);
  }
  const packageJsonPath = path.join(packageDirectory, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const entryPath = fs.realpathSync(require.resolve(packageDirectory));
  if (!isWithin(packageDirectory, entryPath) || isWithin(REPOSITORY_ROOT, entryPath)) {
    throw new Error(`installed package entry escapes external prefix: ${packageName}`);
  }
  const contentSha256 = verifyInstalledContent(packageDirectory, tarball);
  const audit = childProcess.spawnSync(process.execPath, ["-e", MODULE_AUDITOR, entryPath], {
    encoding: "utf8",
    env: { ...process.env, ACCEPTANCE_PREFIX: installPrefix },
  });
  if (audit.status !== 0) {
    throw new Error(`installed package loaded code outside external prefix or failed audit: ${packageName}`);
  }
  return { packageDirectory, packageJson, exports: JSON.parse(audit.stdout), contentSha256 };
}

function writeAtomic(outputFile, value) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  const temporary = `${outputFile}.tmp-${process.pid}-${crypto.randomUUID()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  fs.renameSync(temporary, outputFile);
}

function buildAcceptanceManifest(options = {}) {
  const evidenceRoot = path.resolve(options.evidenceRoot || path.join(REPOSITORY_ROOT, "evidence", "module-acceptance"));
  const evidenceEntries = readAndValidateEvidenceFiles(evidenceRoot);
  const installPrefix = options.installPrefix ? validateExternalPrefix(path.resolve(options.installPrefix)) : null;

  if (evidenceEntries.length > 0 && !installPrefix) throw new Error("accepted evidence requires an external install prefix");
  if (evidenceEntries.length > 0 && !options.lockfile) throw new Error("accepted evidence requires an exact install lockfile");
  if (evidenceEntries.length > 0 && !options.tarballDirectory) throw new Error("accepted evidence requires verified package tarballs");

  let lockBytes = null;
  let lock = null;
  let hiddenLock = null;
  if (evidenceEntries.length > 0) {
    const lockfile = fs.realpathSync(path.resolve(options.lockfile));
    if (lockfile !== path.join(installPrefix, "package-lock.json")) throw new Error("lockfile must belong to the external install prefix");
    lockBytes = fs.readFileSync(lockfile);
    lock = JSON.parse(lockBytes.toString("utf8"));
    hiddenLock = JSON.parse(fs.readFileSync(path.join(installPrefix, "node_modules", ".package-lock.json"), "utf8"));
  }

  const modules = evidenceEntries.map(({ evidenceFile, evidence }) => {
    const evaluation = evaluateModuleEvidence(evidence);
    if (!evaluation.accepted) throw new Error(`evidence rejected for ${evidence.moduleName || evidenceFile}: ${evaluation.failures.join(", ")}`);

    const lockEntry = getLockEntry(lock, evidence.package.name);
    if (lockEntry.version !== evidence.package.version || lockEntry.version !== evidence.moduleVersion) {
      throw new Error(`lock version mismatch for ${evidence.package.name}`);
    }
    if (lockEntry.integrity !== evidence.package.integrity) {
      throw new Error(`lock integrity mismatch for ${evidence.package.name}`);
    }
    const hiddenEntry = hiddenLock.packages?.[`node_modules/${evidence.package.name}`];
    if (!hiddenEntry || ["version", "resolved", "integrity"].some((field) => hiddenEntry[field] !== lockEntry[field])) {
      throw new Error(`main lock disagrees with hidden install lock for ${evidence.package.name}`);
    }

    const tarball = findVerifiedTarball(path.resolve(options.tarballDirectory), evidence.package.integrity);
    const installed = loadInstalledExports(installPrefix, evidence.package.name, tarball);
    if (installed.packageJson.name !== evidence.package.name || installed.packageJson.version !== evidence.package.version) {
      throw new Error(`installed package version mismatch for ${evidence.package.name}`);
    }
    const expectedExports = [...evidence.package.exports].sort();
    if (JSON.stringify(installed.exports) !== JSON.stringify(expectedExports)) {
      throw new Error(`installed package exports mismatch for ${evidence.package.name}`);
    }

    return {
      moduleName: evidence.moduleName,
      version: evidence.moduleVersion,
      integrity: evidence.package.integrity,
      evidenceSha256: sha256(fs.readFileSync(evidenceFile)),
      packageLocator: `node_modules/${evidence.package.name}`,
      contentSha256: installed.contentSha256,
      exports: installed.exports,
    };
  }).sort((left, right) => left.moduleName.localeCompare(right.moduleName));

  const manifest = {
    schemaVersion: "1.0.0",
    acceptedModuleCount: modules.length,
    acceptedModules: modules.map((entry) => entry.moduleName),
    lock: lockBytes ? { sha256: sha256(lockBytes) } : null,
    modules,
  };
  if (!options.verifyOnly && options.outputFile) writeAtomic(path.resolve(options.outputFile), manifest);
  return manifest;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--verify-only") options.verifyOnly = true;
    else if (["--evidence-root", "--install-prefix", "--lockfile", "--tarball-directory", "--output"].includes(argument)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === "--evidence-root") options.evidenceRoot = value;
      if (argument === "--install-prefix") options.installPrefix = value;
      if (argument === "--lockfile") options.lockfile = value;
      if (argument === "--tarball-directory") options.tarballDirectory = value;
      if (argument === "--output") options.outputFile = value;
    } else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

if (require.main === module) {
  try {
    const manifest = buildAcceptanceManifest(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(manifest)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { buildAcceptanceManifest };
