const fs = require("node:fs");
const path = require("node:path");

const EXACT_SEMVER = /^\d+\.\d+\.\d+$/;
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];
const TRANSPORT_PACKAGES = new Set(["express", "fastify", "hapi", "koa", "commander"]);
const REQUIRE_PATTERN = /\brequire\s*\(\s*(["'])([^"']+)\1\s*\)/g;

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
      for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
        if (entry.isDirectory() && fs.existsSync(path.join(parent, entry.name, "package.json"))) {
          directories.add(path.join(parent, entry.name));
        }
      }
      continue;
    }
    const directory = path.join(root, workspace);
    if (fs.existsSync(path.join(directory, "package.json"))) directories.add(directory);
  }
  return [...directories].sort((left, right) => left.localeCompare(right));
}

function packageKind(packageName) {
  if (packageName.endsWith("-core-kernel")) return "kernel";
  if (packageName.endsWith("-core")) return "aggregate";
  if (packageName.includes("-core-")) return "module";
  return "consumer";
}

function directDependencies(pkg) {
  const entries = [];
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, version] of Object.entries(pkg[field] ?? {})) {
      entries.push({ field, name, version });
    }
  }
  return entries.sort((left, right) => left.name.localeCompare(right.name) || left.field.localeCompare(right.field));
}

function collectJavaScriptFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(entryPath);
      else if (entry.isFile() && /\.(?:cjs|js)$/.test(entry.name)) files.push(entryPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function findPackageForPath(packages, absolutePath) {
  return packages
    .filter((candidate) => absolutePath === candidate.directory || absolutePath.startsWith(`${candidate.directory}${path.sep}`))
    .sort((left, right) => right.directory.length - left.directory.length)[0];
}

function packageTarget(target, packageByName) {
  if (packageByName.has(target)) return packageByName.get(target);
  const scopedMatch = target.match(/^(@[^/]+\/[^/]+)(?:\/|$)/);
  const unscopedMatch = target.match(/^([^/@][^/]*)(?:\/|$)/);
  const name = scopedMatch?.[1] ?? unscopedMatch?.[1];
  return packageByName.get(name);
}

function isSourcePathImport(sourcePackage, sourceFile, target, packages, packageByName) {
  if (!/(?:^|\/)src(?:\/|$)/.test(target)) return false;
  const targetPackage = target.startsWith(".")
    ? findPackageForPath(packages, path.resolve(path.dirname(sourceFile), target))
    : packageTarget(target, packageByName);
  return Boolean(targetPackage && targetPackage !== sourcePackage);
}

function isInvalidDependencyDirection(sourceName, targetName) {
  const source = packageKind(sourceName);
  const target = packageKind(targetName);
  if (source === "kernel") return target === "module" || target === "aggregate" || target === "consumer";
  if (source === "module") return target === "aggregate" || target === "consumer";
  if (source === "aggregate") return target === "consumer";
  return target === "kernel" || target === "module";
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
    manifest: readJson(path.join(directory, "package.json")),
  }));
  const packageByName = new Map(packages.filter(({ manifest }) => manifest.name).map((item) => [item.manifest.name, item]));
  const violations = [];
  const sourceImports = [];
  const internalDependencies = new Map();
  const kernelTransportDependencies = new Set();

  for (const item of packages) {
    const dependencies = directDependencies(item.manifest);
    const internal = [];
    for (const dependency of dependencies) {
      if (!EXACT_SEMVER.test(dependency.version)) {
        violations.push({
          code: "NON_EXACT_VERSION",
          package: item.relativeDirectory,
          dependency: dependency.name,
          version: dependency.version,
        });
      }
      if (packageByName.has(dependency.name)) {
        internal.push(dependency.name);
        if (isInvalidDependencyDirection(item.manifest.name, dependency.name)) {
          violations.push({
            code: "REVERSE_DEPENDENCY",
            package: item.relativeDirectory,
            dependency: dependency.name,
          });
        }
      }
      if (packageKind(item.manifest.name) === "kernel" && TRANSPORT_PACKAGES.has(dependency.name)) {
        const transportKey = `${item.manifest.name}\u0000${dependency.name}`;
        if (!kernelTransportDependencies.has(transportKey)) {
          kernelTransportDependencies.add(transportKey);
          violations.push({
            code: "TRANSPORT_IMPORT",
            package: item.relativeDirectory,
            dependency: dependency.name,
          });
        }
      }
    }
    internalDependencies.set(item.manifest.name, [...new Set(internal)].sort());

    if (packageKind(item.manifest.name) !== "kernel") continue;
    for (const file of collectJavaScriptFiles(path.join(item.directory, "src"))) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(REQUIRE_PATTERN)) {
        const target = match[2];
        if (TRANSPORT_PACKAGES.has(target) && !kernelTransportDependencies.has(`${item.manifest.name}\u0000${target}`)) {
          violations.push({
            code: "TRANSPORT_IMPORT",
            package: item.relativeDirectory,
            source: toRepositoryPath(absoluteRoot, file),
            dependency: target,
          });
        }
      }
    }
  }

  for (const item of packages) {
    for (const file of collectJavaScriptFiles(path.join(item.directory, "src"))) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(REQUIRE_PATTERN)) {
        const target = match[2];
        if (!isSourcePathImport(item, file, target, packages, packageByName)) continue;
        const imported = { from: toRepositoryPath(absoluteRoot, file), target };
        sourceImports.push(imported);
        violations.push({ code: "SOURCE_PATH_IMPORT", ...imported });
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
      const key = [...cycle.slice(0, -1)].sort().join("\u0000");
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

  for (const cycle of cycles) violations.push({ code: "CYCLE", cycle });
  violations.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  sourceImports.sort((left, right) => left.from.localeCompare(right.from) || left.target.localeCompare(right.target));
  cycles.sort((left, right) => left.join("\u0000").localeCompare(right.join("\u0000")));
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
