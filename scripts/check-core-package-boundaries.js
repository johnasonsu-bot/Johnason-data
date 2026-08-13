const fs = require("node:fs");
const path = require("node:path");

const EXACT_SEMVER = /^\d+\.\d+\.\d+$/;
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
const TRANSPORT_PACKAGES = new Set(["express", "commander"]);
const REQUIRE_PATTERN = /\brequire\s*\(\s*(["'])([^"']+)\1\s*\)/g;
const EXCLUDED_PUBLISH_DIRECTORIES = new Set(["node_modules", "test", "tests", "generated"]);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toRepositoryPath(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function workspaceDirectories(root, workspaces) {
  const directories = new Set([root]);
  for (const workspace of workspaces) {
    if (workspace.endsWith("/*")) {
      const parent = path.join(root, workspace.slice(0, -2));
      if (!fs.existsSync(parent)) continue;
      for (const entry of fs.readdirSync(parent, { withFileTypes: true }).sort((left, right) => compareStrings(left.name, right.name))) {
        if (entry.isDirectory() && fs.existsSync(path.join(parent, entry.name, "package.json"))) {
          directories.add(path.join(parent, entry.name));
        }
      }
      continue;
    }
    const directory = path.join(root, workspace);
    if (fs.existsSync(path.join(directory, "package.json"))) directories.add(directory);
  }
  return [...directories].sort(compareStrings);
}

function packageKind(packageName) {
  if (packageName.endsWith("-core-kernel")) return "kernel";
  if (packageName.endsWith("-core")) return "aggregate";
  if (/(?:^|\/)data-platform-module-/.test(packageName)) return "module";
  return "consumer";
}

function directDependencies(pkg) {
  const entries = [];
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, version] of Object.entries(pkg[field] ?? {})) entries.push({ field, name, version });
  }
  return entries.sort((left, right) => compareStrings(left.name, right.name) || compareStrings(left.field, right.field));
}

function collectJavaScriptFiles(directory, packageDirectory) {
  if (!fs.existsSync(directory)) return [];
  const initialStat = fs.statSync(directory);
  if (initialStat.isFile()) {
    const relativeSegments = path.relative(packageDirectory, directory).split(path.sep);
    return /\.(?:cjs|js)$/.test(directory) && !relativeSegments.some((segment) => EXCLUDED_PUBLISH_DIRECTORIES.has(segment))
      ? [directory]
      : [];
  }
  const files = [];
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => compareStrings(left.name, right.name))) {
      const entryPath = path.join(current, entry.name);
      const relativeSegments = path.relative(packageDirectory, entryPath).split(path.sep);
      if (entry.isDirectory()) {
        if (!relativeSegments.some((segment) => EXCLUDED_PUBLISH_DIRECTORIES.has(segment))) pending.push(entryPath);
      } else if (entry.isFile() && /\.(?:cjs|js)$/.test(entry.name) && !relativeSegments.some((segment) => EXCLUDED_PUBLISH_DIRECTORIES.has(segment))) {
        files.push(entryPath);
      }
    }
  }
  return files.sort(compareStrings);
}

function publishedJavaScriptFiles(item) {
  const entries = new Set();
  const configuredFiles = Array.isArray(item.manifest.files) ? item.manifest.files : item.isRoot ? [] : ["."];
  for (const entry of configuredFiles) entries.add(entry);
  if (typeof item.manifest.main === "string") entries.add(item.manifest.main);
  if (typeof item.manifest.bin === "string") entries.add(item.manifest.bin);
  if (item.manifest.bin && typeof item.manifest.bin === "object" && !Array.isArray(item.manifest.bin)) {
    for (const entry of Object.values(item.manifest.bin)) entries.add(entry);
  }

  const files = new Set();
  for (const entry of entries) {
    const candidate = path.resolve(item.directory, entry);
    if (candidate !== item.directory && !candidate.startsWith(`${item.directory}${path.sep}`)) continue;
    for (const file of collectJavaScriptFiles(candidate, item.directory)) files.add(file);
  }
  return [...files].sort(compareStrings);
}

function packageTarget(target, packageByName) {
  if (packageByName.has(target)) return packageByName.get(target);
  const scopedMatch = target.match(/^(@[^/]+\/[^/]+)(?:\/|$)/);
  const unscopedMatch = target.match(/^([^/@][^/]*)(?:\/|$)/);
  return packageByName.get(scopedMatch?.[1] ?? unscopedMatch?.[1]);
}

function transportPackage(target) {
  return target.split("/", 1)[0];
}

function isSourcePathImport(sourcePackage, sourceFile, target, packages, packageByName) {
  if (!/(?:^|\/)src(?:\/|$)/.test(target)) return false;
  if (target.startsWith(".")) {
    const targetPath = path.resolve(path.dirname(sourceFile), target);
    return targetPath !== sourcePackage.directory && !targetPath.startsWith(`${sourcePackage.directory}${path.sep}`);
  }
  const targetPackage = packageTarget(target, packageByName);
  return Boolean(targetPackage && targetPackage !== sourcePackage);
}

function isInvalidDependencyDirection(sourceName, targetName) {
  const source = packageKind(sourceName);
  const target = packageKind(targetName);
  if (source === "kernel") return target !== "kernel";
  if (source === "module") return target !== "kernel";
  if (source === "aggregate") return target !== "module";
  return target !== "aggregate";
}

function scanPackageBoundaries(root) {
  const absoluteRoot = path.resolve(root);
  const rootPackage = readJson(path.join(absoluteRoot, "package.json"));
  const workspaceConfiguration = Array.isArray(rootPackage.workspaces)
    ? rootPackage.workspaces
    : rootPackage.workspaces?.packages ?? [];
  const packages = workspaceDirectories(absoluteRoot, workspaceConfiguration).map((directory) => ({
    directory,
    relativeDirectory: toRepositoryPath(absoluteRoot, directory) || ".",
    isRoot: directory === absoluteRoot,
    manifest: readJson(path.join(directory, "package.json")),
  }));
  const packageByName = new Map(packages.filter(({ manifest }) => manifest.name).map((item) => [item.manifest.name, item]));
  const violations = [];
  const violationKeys = new Set();
  const sourceImports = [];
  const internalDependencies = new Map();
  const declaredDependencies = new Map();

  function addViolation(violation, key) {
    if (!violationKeys.has(key)) {
      violationKeys.add(key);
      violations.push(violation);
    }
  }

  function checkInternalDirection(item, target) {
    if (isInvalidDependencyDirection(item.manifest.name, target.manifest.name)) {
      addViolation({
        code: "REVERSE_DEPENDENCY",
        package: item.relativeDirectory,
        dependency: target.manifest.name,
      }, `REVERSE_DEPENDENCY\u0000${item.relativeDirectory}\u0000${target.manifest.name}`);
    }
  }

  function checkTransport(item, target, source) {
    const transport = transportPackage(target);
    if (!TRANSPORT_PACKAGES.has(transport) || !["kernel", "module"].includes(packageKind(item.manifest.name))) return;
    addViolation({
      code: "TRANSPORT_IMPORT",
      package: item.relativeDirectory,
      ...(source ? { source } : {}),
      dependency: transport,
    }, `TRANSPORT_IMPORT\u0000${item.relativeDirectory}\u0000${transport}`);
  }

  for (const item of packages) {
    const internal = [];
    const declared = new Set();
    for (const dependency of directDependencies(item.manifest)) {
      declared.add(dependency.name);
      if (!EXACT_SEMVER.test(dependency.version)) {
        addViolation({
          code: "NON_EXACT_VERSION",
          package: item.relativeDirectory,
          dependency: dependency.name,
          version: dependency.version,
        }, `NON_EXACT_VERSION\u0000${item.relativeDirectory}\u0000${dependency.field}\u0000${dependency.name}`);
      }
      checkTransport(item, dependency.name);
      const target = packageByName.get(dependency.name);
      if (target) {
        internal.push(target.manifest.name);
        checkInternalDirection(item, target);
      }
    }
    internalDependencies.set(item.manifest.name, [...new Set(internal)].sort(compareStrings));
    declaredDependencies.set(item.manifest.name, declared);
  }

  for (const item of packages) {
    for (const file of publishedJavaScriptFiles(item)) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(REQUIRE_PATTERN)) {
        const target = match[2];
        const sourcePath = toRepositoryPath(absoluteRoot, file);
        checkTransport(item, target, sourcePath);
        const targetPackage = packageTarget(target, packageByName);
        if (targetPackage) {
          checkInternalDirection(item, targetPackage);
          if (!declaredDependencies.get(item.manifest.name).has(targetPackage.manifest.name)) {
            addViolation({
              code: "REVERSE_DEPENDENCY",
              package: item.relativeDirectory,
              dependency: targetPackage.manifest.name,
            }, `REVERSE_DEPENDENCY\u0000${item.relativeDirectory}\u0000${targetPackage.manifest.name}`);
          }
        }
        if (isSourcePathImport(item, file, target, packages, packageByName)) {
          const imported = { from: sourcePath, target };
          sourceImports.push(imported);
          addViolation({ code: "SOURCE_PATH_IMPORT", ...imported }, `SOURCE_PATH_IMPORT\u0000${sourcePath}\u0000${target}`);
        }
      }
    }
  }

  const cycles = [];
  const visited = new Set();
  const visiting = new Set();
  const stack = [];
  const cycleKeys = new Set();
  function visit(packageName) {
    if (visiting.has(packageName)) {
      const cycleNames = [...stack.slice(stack.indexOf(packageName)), packageName];
      const cycle = cycleNames.map((name) => packageByName.get(name).relativeDirectory);
      const key = [...cycle.slice(0, -1)].sort(compareStrings).join("\u0000");
      if (!cycleKeys.has(key)) {
        cycleKeys.add(key);
        cycles.push(cycle);
      }
      return;
    }
    if (visited.has(packageName)) return;
    visiting.add(packageName);
    stack.push(packageName);
    for (const dependency of internalDependencies.get(packageName) ?? []) visit(dependency);
    stack.pop();
    visiting.delete(packageName);
    visited.add(packageName);
  }
  for (const item of packages) visit(item.manifest.name);

  for (const cycle of cycles) addViolation({ code: "CYCLE", cycle }, `CYCLE\u0000${cycle.join("\u0000")}`);
  violations.sort((left, right) => compareStrings(JSON.stringify(left), JSON.stringify(right)));
  sourceImports.sort((left, right) => compareStrings(left.from, right.from) || compareStrings(left.target, right.target));
  cycles.sort((left, right) => compareStrings(left.join("\u0000"), right.join("\u0000")));
  return { violations, cycles, sourceImports };
}

if (require.main === module) {
  const result = scanPackageBoundaries(process.cwd());
  if (result.violations.length > 0) {
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { scanPackageBoundaries };
