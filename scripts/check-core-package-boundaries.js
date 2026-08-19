#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const TRANSPORT_PACKAGES = new Set(["express", "commander"]);

function listFiles(root, predicate, result = []) {
  if (!fs.existsSync(root)) return result;
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) listFiles(target, predicate, result);
    else if (predicate(target)) result.push(target);
  }
  return result;
}

function packageKind(name) {
  if (name.endsWith("core-kernel") || name === "@x/kernel") return "kernel";
  if (name.includes("module-")) return "module";
  if (name.endsWith("data-platform-core") || name === "@x/core") return "core";
  if (name.endsWith("data-platform-cli") || name === "@x/cli") return "cli";
  return "consumer";
}

function allowedDependency(from, to) {
  const allowed = {
    kernel: new Set(),
    module: new Set(["kernel"]),
    core: new Set(["kernel", "module"]),
    cli: new Set(["core", "kernel"]),
    consumer: new Set(["core", "kernel"]),
  };
  return allowed[from].has(to);
}

function scanPackageBoundaries(root = path.resolve(__dirname, "..")) {
  const packageFiles = [
    ...listFiles(path.join(root, "packages"), (file) => path.basename(file) === "package.json"),
    ...(fs.existsSync(path.join(root, "backend/package.json")) ? [path.join(root, "backend/package.json")] : []),
  ];
  const packages = packageFiles.map((file) => {
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      name: manifest.name,
      kind: packageKind(manifest.name || ""),
      file,
      directory: path.dirname(file),
      dependencies: { ...(manifest.dependencies || {}), ...(manifest.optionalDependencies || {}) },
    };
  }).filter((entry) => entry.name);
  const byName = new Map(packages.map((entry) => [entry.name, entry]));
  const violations = [];

  function add(code, pkg, detail, file = pkg.file) {
    violations.push({ code, package: pkg.name, file: path.relative(root, file), detail });
  }

  for (const pkg of packages) {
    for (const [dependency, version] of Object.entries(pkg.dependencies)) {
      if ((pkg.kind === "kernel" || pkg.kind === "module" || pkg.kind === "core") && TRANSPORT_PACKAGES.has(dependency)) {
        add("TRANSPORT_IMPORT", pkg, dependency);
      }
      const target = byName.get(dependency);
      if (!target) continue;
      if (!EXACT_VERSION.test(version)) add("NON_EXACT_VERSION", pkg, `${dependency}@${version}`);
      if (!allowedDependency(pkg.kind, target.kind)) add("REVERSE_DEPENDENCY", pkg, `${pkg.kind} -> ${target.kind}: ${dependency}`);
    }

    for (const sourceFile of listFiles(path.join(pkg.directory, "src"), (file) => /\.(?:c?js|mjs)$/.test(file))) {
      const source = fs.readFileSync(sourceFile, "utf8");
      const imports = [...source.matchAll(/(?:require\s*\(\s*|from\s+)["']([^"']+)["']/g)].map((match) => match[1]);
      for (const target of imports) {
        const transportName = [...TRANSPORT_PACKAGES].find((name) => target === name || target.startsWith(`${name}/`));
        if (transportName && (pkg.kind === "kernel" || pkg.kind === "module" || pkg.kind === "core")) {
          add("TRANSPORT_IMPORT", pkg, target, sourceFile);
        }
        if (/^@[^/]+\/[^/]+\/src(?:\/|$)/.test(target) || /(?:^|\/)backend\/src(?:\/|$)/.test(target)) {
          add("SOURCE_PATH_IMPORT", pkg, target, sourceFile);
        }
      }
    }
  }

  const graph = new Map(packages.map((pkg) => [pkg.name, Object.keys(pkg.dependencies).filter((name) => byName.has(name))]));
  const visiting = new Set();
  const visited = new Set();
  const cycles = new Set();
  function visit(name, trail = []) {
    if (visiting.has(name)) {
      const start = trail.indexOf(name);
      const cycle = [...trail.slice(start), name];
      const rotations = cycle.slice(0, -1).map((_, index, nodes) => [...nodes.slice(index), ...nodes.slice(0, index), nodes[index]].join(" -> "));
      cycles.add(rotations.sort()[0]);
      return;
    }
    if (visited.has(name)) return;
    visiting.add(name);
    for (const target of graph.get(name) || []) visit(target, [...trail, name]);
    visiting.delete(name);
    visited.add(name);
  }
  for (const name of [...graph.keys()].sort()) visit(name);
  for (const cycle of [...cycles].sort()) {
    const pkg = byName.get(cycle.split(" -> ")[0]);
    add("CYCLE", pkg, cycle);
  }

  const unique = new Map();
  for (const violation of violations) unique.set(JSON.stringify(violation), violation);
  const sorted = [...unique.values()].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return {
    violations: sorted,
    cycles: sorted.filter((entry) => entry.code === "CYCLE"),
    sourceImports: sorted.filter((entry) => entry.code === "SOURCE_PATH_IMPORT"),
    packageCount: packages.length,
  };
}

if (require.main === module) {
  const result = scanPackageBoundaries(path.resolve(__dirname, ".."));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.violations.length) process.exitCode = 1;
}

module.exports = { scanPackageBoundaries };
