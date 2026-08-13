#!/usr/bin/env node
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const EXACT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const REQUIRED_COMMANDS = Object.freeze([
  "createFacts",
  "enterMaintenance",
  "drain",
  "stopWorkers",
  "snapshot",
  "verifyRollback",
  "verifyReUpgrade",
  "exitMaintenance",
]);
const SECRET_ARGUMENT = /(?:^--?(?:password|pwd|secret|token|authorization|api[-_]?key|credential)(?:=|$)|\b(?:Bearer|Basic)\s+\S+|(?:^|[;?&\s])(?:password|pwd|token|access_token|api[-_]?key)\s*=\s*[^;?&\s]+|[a-z][a-z0-9+.-]*:\/\/[^\s/:]+:[^\s/@]+@|(?:^|[\s=:])[^\s;/]+\/[^\s@/]+@[^\s]+)/i;
const SHA256 = /^sha256:[0-9a-f]{64}$/;

class DrillError extends Error {
  constructor(code, message, infrastructure = false) {
    super(message);
    this.code = code;
    this.infrastructure = infrastructure;
  }
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function parseVersion(value, label) {
  if (!EXACT_VERSION.test(value || "")) throw new DrillError("NON_EXACT_VERSION", `${label} must be exact`);
  return value.split(".").map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function assertLoopbackRegistry(registryUrl) {
  let parsed;
  try {
    parsed = new URL(registryUrl);
  } catch {
    throw new DrillError("INVALID_REGISTRY", "registry URL is invalid");
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const ipv4 = net.isIP(hostname) === 4 && hostname.split(".")[0] === "127";
  if (parsed.protocol !== "http:" || (!ipv4 && hostname !== "::1")) {
    throw new DrillError("NON_LOOPBACK_REGISTRY", "registry must be an HTTP loopback endpoint");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new DrillError("REGISTRY_CREDENTIALS_FORBIDDEN", "registry URL must not contain credentials or query data");
  }
  return parsed.toString();
}

function readManifest(options, manifestFile) {
  if (manifestFile) return JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (options.manifest && typeof options.manifest === "object") return structuredClone(options.manifest);
  throw new DrillError("MANIFEST_REQUIRED", "a clean module manifest is required");
}

function digestManifest(options, manifestFile = options.manifestFile) {
  return manifestFile
    ? sha256(fs.readFileSync(manifestFile))
    : sha256(`${JSON.stringify(options.manifest)}\n`);
}

function assertApprovedDigest(actual, approved, label) {
  if (!SHA256.test(approved || "") || actual !== approved) {
    throw new DrillError("DIRTY_MANIFEST", `${label} does not match its approved digest`);
  }
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function nearestExistingRealpath(candidate) {
  let current = candidate;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) throw new DrillError("PATH_MISSING", "path has no existing parent");
    current = parent;
  }
  return fs.realpathSync(current);
}

function validatePath(root, candidate, label, mustExist = true) {
  if (typeof candidate !== "string" || !path.isAbsolute(candidate)) {
    throw new DrillError("UNTRUSTED_PATH", `${label} must be absolute`);
  }
  const lexicalRoot = path.resolve(root);
  const lexical = path.resolve(candidate);
  if (!isWithin(lexicalRoot, lexical)) throw new DrillError("PATH_ESCAPE", `${label} escapes workRoot`);
  const realRoot = fs.realpathSync(root);
  const realCandidate = mustExist ? fs.realpathSync(candidate) : nearestExistingRealpath(lexical);
  if (!isWithin(realRoot, realCandidate)) throw new DrillError("PATH_ESCAPE", `${label} escapes workRoot through a symlink`);
  return mustExist ? realCandidate : lexical;
}

function validateCommands(commands) {
  if (!commands || typeof commands !== "object" || Array.isArray(commands)) {
    throw new DrillError("COMMANDS_REQUIRED", "rollback commands are required");
  }
  for (const name of REQUIRED_COMMANDS) {
    const command = commands[name];
    if (!command || Object.keys(command).some((key) => key !== "argv") || !Array.isArray(command.argv) || command.argv.length === 0) {
      throw new DrillError("INVALID_COMMAND", `invalid ${name} command`);
    }
    for (const argument of command.argv) {
      if (typeof argument !== "string" || argument.length === 0) throw new DrillError("INVALID_COMMAND", `invalid ${name} argument`);
      if (SECRET_ARGUMENT.test(argument)) throw new DrillError("INLINE_SECRET", `inline secret in ${name}`);
    }
  }
}

function validateOptions(options) {
  if (!options || typeof options !== "object") throw new DrillError("INVALID_OPTIONS", "options are required");
  if (options.environment === "production" || process.env.NODE_ENV === "production") {
    throw new DrillError("PRODUCTION_FORBIDDEN", "rollback drills cannot run in production");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.moduleName || "")) {
    throw new DrillError("INVALID_MODULE", "module name is invalid");
  }
  const candidate = parseVersion(options.candidateVersion, "candidateVersion");
  const rollback = parseVersion(options.rollbackVersion, "rollbackVersion");
  if (compareVersions(candidate, rollback) <= 0) {
    throw new DrillError("INVALID_VERSION_ORDER", "candidateVersion must be newer than rollbackVersion");
  }
  const registryUrl = assertLoopbackRegistry(options.registryUrl);
  validateCommands(options.commands);
  if (!options.installPrefix || !options.evidenceDir) {
    throw new DrillError("PATHS_REQUIRED", "installPrefix and evidenceDir are required");
  }
  if (!options.workRoot) throw new DrillError("WORK_ROOT_REQUIRED", "an isolated workRoot is required");
  const workRoot = fs.realpathSync(options.workRoot);
  const installPrefix = validatePath(options.workRoot, options.installPrefix, "installPrefix");
  const evidenceDir = validatePath(options.workRoot, options.evidenceDir, "evidenceDir", false);
  const manifestFile = options.manifestFile ? validatePath(options.workRoot, options.manifestFile, "manifestFile") : null;
  if (!options.lockfile) throw new DrillError("LOCKFILE_REQUIRED", "an approved install lockfile is required");
  const lockfile = validatePath(options.workRoot, options.lockfile, "lockfile");
  const commandCwd = validatePath(options.workRoot, options.cwd || options.installPrefix, "cwd");
  const manifest = readManifest(options, manifestFile);
  assertApprovedDigest(digestManifest(options, manifestFile), options.approvedManifestSha256, "manifest");
  assertApprovedDigest(sha256(fs.readFileSync(lockfile)), options.approvedLockSha256, "lockfile");
  for (const migration of manifest.migrations || []) {
    if (!migration || ["down", "downgrade", "destructive"].includes(String(migration.direction).toLowerCase())) {
      throw new DrillError("DOWNGRADE_MIGRATION_FORBIDDEN", "rollback cannot run downgrade migrations");
    }
  }
  for (const [field, expected] of [
    ["moduleName", options.moduleName],
    ["candidateVersion", options.candidateVersion],
    ["rollbackVersion", options.rollbackVersion],
  ]) {
    if (manifest[field] !== undefined && manifest[field] !== expected) {
      throw new DrillError("MANIFEST_VERSION_MISMATCH", `manifest ${field} mismatch`);
    }
  }
  const packageName = manifest.packageName || `@johnason/data-platform-module-${options.moduleName}`;
  if (packageName !== `@johnason/data-platform-module-${options.moduleName}`) {
    throw new DrillError("MANIFEST_PACKAGE_MISMATCH", "manifest package mismatch");
  }
  return {
    registryUrl,
    manifest,
    packageName,
    manifestSha256: options.approvedManifestSha256,
    lockSha256: options.approvedLockSha256,
    workRoot,
    installPrefix,
    evidenceDir,
    manifestFile,
    lockfile,
    commandCwd,
  };
}

function redactArgument(argument) {
  if (path.isAbsolute(argument)) return `<path:${path.basename(argument)}>`;
  return argument;
}

function executeCommand(name, command, records, cwd) {
  const started = Date.now();
  const result = childProcess.spawnSync(command.argv[0], command.argv.slice(1), {
    encoding: "utf8",
    cwd,
    env: { ...process.env },
  });
  const record = {
    name,
    argv: command.argv.map(redactArgument),
    exitCode: result.status ?? 1,
    durationMs: Date.now() - started,
    stdoutSha256: sha256(result.stdout || ""),
    stderrSha256: sha256(result.stderr || ""),
  };
  records.push(record);
  if (result.error || result.status !== 0) {
    throw new DrillError("COMMAND_FAILED", `${name} command failed`);
  }
  return result.stdout;
}

function runCommand(name, command, records, cwd) {
  const stdout = executeCommand(name, command, records, cwd);
  try {
    return stdout.trim() ? JSON.parse(stdout) : {};
  } catch {
    throw new DrillError("INVALID_COMMAND_RESULT", `${name} returned invalid JSON`);
  }
}

function runInstall(version, context, records) {
  const command = {
    argv: [
      "npm", "install", `${context.packageName}@${version}`,
      "--registry", context.registryUrl,
      "--ignore-scripts", "--save-exact", "--workspaces=false", "--no-audit", "--no-fund",
    ],
  };
  const started = Date.now();
  const result = childProcess.spawnSync(command.argv[0], command.argv.slice(1), {
    cwd: context.installPrefix,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(context.npmUserConfig ? { NPM_CONFIG_USERCONFIG: context.npmUserConfig } : {}),
      ...(context.npmEnvironment || {}),
    },
  });
  records.push({
    name: `install-${version}`,
    argv: command.argv,
    exitCode: result.status ?? 1,
    durationMs: Date.now() - started,
    stdoutSha256: sha256(result.stdout || ""),
    stderrSha256: sha256(result.stderr || ""),
  });
  if (result.error || result.status !== 0) {
    throw new DrillError("PACKAGE_INSTALL_BLOCKED", `package install failed for ${version}`, true);
  }
  const packageJson = JSON.parse(fs.readFileSync(path.join(
    context.installPrefix,
    "node_modules",
    ...context.packageName.split("/"),
    "package.json",
  ), "utf8"));
  if (packageJson.name !== context.packageName || packageJson.version !== version) {
    throw new DrillError("INSTALLED_VERSION_MISMATCH", `installed version mismatch for ${version}`);
  }
  return packageJson.version;
}

function hashOtherPackages(installPrefix, excludedPackage) {
  const root = path.join(installPrefix, "node_modules");
  const excluded = path.join(root, ...excludedPackage.split("/"));
  const digest = crypto.createHash("sha256");
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const entryPath = path.join(directory, entry.name);
      if (entryPath === excluded || entry.name === ".package-lock.json") continue;
      const relative = path.relative(root, entryPath).split(path.sep).join("/");
      const stat = fs.lstatSync(entryPath);
      if (stat.isSymbolicLink()) {
        digest.update(`L\0${relative}\0${fs.readlinkSync(entryPath)}\0`);
      } else if (entry.isDirectory()) {
        digest.update(`D\0${relative}\0`);
        visit(entryPath);
      } else if (entry.isFile()) {
        digest.update(`F\0${relative}\0`).update(fs.readFileSync(entryPath)).update("\0");
      }
    }
  };
  visit(root);
  return `sha256:${digest.digest("hex")}`;
}

function normalizedNonTargetLock(lockfile, packageName) {
  const lock = JSON.parse(fs.readFileSync(lockfile, "utf8"));
  const targetEntry = `node_modules/${packageName}`;
  if (lock.packages?.[""]?.dependencies) delete lock.packages[""].dependencies[packageName];
  if (lock.packages) delete lock.packages[targetEntry];
  if (lock.dependencies) delete lock.dependencies[packageName];
  return sha256(`${JSON.stringify(lock)}\n`);
}

function assertCandidateLock(lockfile, packageName, candidateVersion, nonTargetDigest) {
  const lock = JSON.parse(fs.readFileSync(lockfile, "utf8"));
  const declared = lock.packages?.[""]?.dependencies?.[packageName];
  const installed = lock.packages?.[`node_modules/${packageName}`]?.version;
  if (declared !== candidateVersion || installed !== candidateVersion) {
    throw new DrillError("DIRTY_MANIFEST", "lockfile does not contain the exact candidate install graph");
  }
  if (normalizedNonTargetLock(lockfile, packageName) !== nonTargetDigest) {
    throw new DrillError("DIRTY_MANIFEST", "non-target lock graph changed during drill");
  }
}

function containedPath(root, ...segments) {
  const resolvedRoot = fs.realpathSync(root);
  const candidate = path.resolve(resolvedRoot, ...segments);
  const relative = path.relative(resolvedRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new DrillError("PATH_ESCAPE", "path escapes its approved root");
  return candidate;
}

function writeEvidence(evidenceDir, moduleName, version, evidence) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const safeModule = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(moduleName || "") ? moduleName : "rejected";
  const safeVersion = EXACT_VERSION.test(version || "") ? version : "invalid";
  const directory = containedPath(evidenceDir, safeModule, safeVersion);
  fs.mkdirSync(directory, { recursive: true });
  const identifier = crypto.randomUUID();
  const output = path.join(directory, `rollback-drill-${identifier}.json`);
  const temporary = `${output}.tmp-${process.pid}-${crypto.randomUUID()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  fs.renameSync(temporary, output);
  return output;
}

function validatedRejectedEvidenceDir(options) {
  if (!options?.workRoot || !options?.evidenceDir) return null;
  try {
    return validatePath(options.workRoot, options.evidenceDir, "evidenceDir", false);
  } catch {
    return null;
  }
}

function evidenceFingerprint() {
  return sha256(`${process.version}\0${process.platform}\0${process.arch}`);
}

async function runRollbackDrill(options) {
  const startedAt = new Date();
  const records = [];
  const versionSequence = [];
  let maintenance = false;
  let facts = { count: 0, duplicateCount: 0 };
  let otherPackagesByteIdentical = false;
  let failure = null;
  let context;

  try {
    const validated = validateOptions(options);
    context = {
      ...validated,
      npmUserConfig: options.npmUserConfig,
      npmEnvironment: options.npmEnvironment,
    };
    const manifestBefore = validated.manifestSha256;
    const nonTargetLockBefore = normalizedNonTargetLock(validated.lockfile, validated.packageName);

    versionSequence.push(runInstall(options.candidateVersion, context, records));
    runCommand("createFacts", options.commands.createFacts, records, context.commandCwd);
    const maintenanceOutput = executeCommand("enterMaintenance", options.commands.enterMaintenance, records, context.commandCwd);
    maintenance = true;
    try {
      if (maintenanceOutput.trim()) JSON.parse(maintenanceOutput);
    } catch {
      throw new DrillError("INVALID_COMMAND_RESULT", "enterMaintenance returned invalid JSON");
    }
    runCommand("drain", options.commands.drain, records, context.commandCwd);
    runCommand("stopWorkers", options.commands.stopWorkers, records, context.commandCwd);
    runCommand("snapshot", options.commands.snapshot, records, context.commandCwd);

    const otherPackagesBefore = hashOtherPackages(context.installPrefix, context.packageName);
    versionSequence.push(runInstall(options.rollbackVersion, context, records));
    if (hashOtherPackages(context.installPrefix, context.packageName) !== otherPackagesBefore) {
      throw new DrillError("OTHER_PACKAGE_CHANGED", "a non-target installed package changed during rollback");
    }
    const rollbackResult = runCommand("verifyRollback", options.commands.verifyRollback, records, context.commandCwd);
    if (
      rollbackResult.version !== options.rollbackVersion
      || rollbackResult.schemaVersion !== 2
      || rollbackResult.factCount !== 1
      || rollbackResult.factId !== "fact-command-1"
    ) {
      throw new DrillError("ROLLBACK_FACT_MISMATCH", "rollback version did not read the upgraded schema and exact candidate fact");
    }

    versionSequence.push(runInstall(options.candidateVersion, context, records));
    if (hashOtherPackages(context.installPrefix, context.packageName) !== otherPackagesBefore) {
      throw new DrillError("OTHER_PACKAGE_CHANGED", "a non-target installed package changed during re-upgrade");
    }
    const reUpgrade = runCommand("verifyReUpgrade", options.commands.verifyReUpgrade, records, context.commandCwd);
    facts = { count: reUpgrade.factCount, duplicateCount: reUpgrade.duplicateCount };
    if (facts.count !== 1 || facts.duplicateCount !== 0) {
      throw new DrillError("REUPGRADE_NOT_IDEMPOTENT", "re-upgrade produced duplicate facts");
    }
    if (digestManifest(options, context.manifestFile) !== manifestBefore) {
      throw new DrillError("DIRTY_MANIFEST", "module manifest changed during drill");
    }
    assertCandidateLock(context.lockfile, context.packageName, options.candidateVersion, nonTargetLockBefore);
    otherPackagesByteIdentical = true;
    runCommand("exitMaintenance", options.commands.exitMaintenance, records, context.commandCwd);
    maintenance = false;
  } catch (error) {
    failure = error instanceof DrillError
      ? error
      : new DrillError("UNEXPECTED_FAILURE", "rollback drill failed unexpectedly");
  }

  const finishedAt = new Date();
  let status = failure ? "failed" : "accepted";
  let exitCode = failure ? (failure.infrastructure ? 7 : 1) : 0;
  const evidence = {
    schemaVersion: "1.0.0",
    moduleName: options?.moduleName || "invalid",
    candidateVersion: options?.candidateVersion || "invalid",
    rollbackVersion: options?.rollbackVersion || "invalid",
    status,
    registry: context?.registryUrl || "rejected-before-registry",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.valueOf() - startedAt.valueOf(),
    environmentFingerprint: evidenceFingerprint(),
    maintenance,
    versionSequence,
    otherPackagesByteIdentical,
    facts,
    commands: records,
    counts: { passed: records.filter((entry) => entry.exitCode === 0).length, failed: failure ? 1 : 0, skipped: 0, secrets: 0 },
    artifactHashes: { commandTranscript: sha256(JSON.stringify(records)) },
    riskGates: {
      rollbackDrill: failure ? "failed" : "passed",
      reUpgradeIdempotency: failure ? "failed" : "passed",
    },
    secretFindings: 0,
    failures: failure ? [failure.code] : [],
    accepted: !failure,
  };
  let evidenceFile = null;
  const evidenceDir = context?.evidenceDir || validatedRejectedEvidenceDir(options);
  if (evidenceDir) {
    try {
      evidenceFile = writeEvidence(evidenceDir, options.moduleName, context ? options.candidateVersion : "invalid", evidence);
    } catch {
      status = "failed";
      exitCode = 1;
      if (!evidence.failures.includes("EVIDENCE_WRITE_FAILED")) evidence.failures.push("EVIDENCE_WRITE_FAILED");
      evidence.status = status;
      evidence.accepted = false;
      evidence.counts.failed = Math.max(1, evidence.counts.failed);
      evidence.riskGates.rollbackDrill = "failed";
      evidence.riskGates.reUpgradeIdempotency = "failed";
    }
  }
  return {
    exitCode,
    status,
    maintenance,
    versionSequence,
    otherPackagesByteIdentical,
    facts,
    evidenceFile,
    failures: evidence.failures,
  };
}

module.exports = { runRollbackDrill };
