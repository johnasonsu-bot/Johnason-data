#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const localRoot = path.join(repositoryRoot, ".local", "data-platform-cli");
const packsDir = path.join(localRoot, "packs");
const installDir = path.join(localRoot, "install");
const npmCacheDir = path.join(localRoot, "npm-cache");
const evidenceFile = path.join(localRoot, "install-evidence.json");

function assertLocalTarget(target) {
  const expectedParent = path.join(repositoryRoot, ".local", "data-platform-cli") + path.sep;
  if (!path.resolve(target).startsWith(expectedParent)) {
    throw new Error(`Refusing to modify a non-local install target: ${target}`);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", npm_config_cache: npmCacheDir, ...options.env },
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stdout || ""}${result.stderr || ""}` : "";
    throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}${detail}`);
  }
  return result;
}

function packageDirectories() {
  return fs.readdirSync(path.join(repositoryRoot, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(repositoryRoot, "packages", entry.name))
    .filter((directory) => fs.existsSync(path.join(directory, "package.json")))
    .sort();
}

function scanRepositoryPathLeaks(root) {
  const findings = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && fs.statSync(target).size <= 8 * 1024 * 1024) {
        const content = fs.readFileSync(target);
        if (content.includes(Buffer.from(repositoryRoot))) findings.push(path.relative(root, target));
      }
    }
  }
  return findings;
}

function main() {
  const verifyOnly = process.argv.includes("--verify-only");
  assertLocalTarget(packsDir);
  assertLocalTarget(installDir);
  assertLocalTarget(npmCacheDir);
  const directories = packageDirectories();
  if (directories.length !== 24) throw new Error(`Expected 24 workspace packages, found ${directories.length}`);
  if (!verifyOnly) {
    fs.rmSync(packsDir, { recursive: true, force: true });
    fs.rmSync(installDir, { recursive: true, force: true });
    fs.mkdirSync(packsDir, { recursive: true });
    fs.mkdirSync(installDir, { recursive: true });
    fs.mkdirSync(npmCacheDir, { recursive: true });
    for (const directory of directories) run("npm", ["pack", directory, "--pack-destination", packsDir, "--silent"]);
  }
  const tarballs = fs.readdirSync(packsDir).filter((name) => name.endsWith(".tgz")).sort().map((name) => path.join(packsDir, name));
  if (tarballs.length !== 24) throw new Error(`Expected 24 tarballs, found ${tarballs.length}`);

  if (!verifyOnly) run("npm", ["install", "--prefix", installDir, "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs]);
  const binary = path.join(installDir, "node_modules", ".bin", "data-platform");
  if (!fs.existsSync(binary)) throw new Error(`Installed binary is missing: ${binary}`);

  const arbitraryCwd = fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-installed-cwd-"));
  try {
    const health = run(binary, ["--json", "system", "doctor", "health"], { cwd: arbitraryCwd, capture: true });
    const payload = JSON.parse(health.stdout);
    if (!payload.success || payload.data?.status !== "ok") throw new Error("Installed CLI health command returned an invalid result");
  } finally {
    fs.rmSync(arbitraryCwd, { recursive: true, force: true });
  }

  const corePath = path.join(installDir, "node_modules", "@johnason", "data-platform-core");
  const catalog = run(process.execPath, ["-e", `const c=require(${JSON.stringify(corePath)});const r=c.createCoreRuntime();process.stdout.write(JSON.stringify({capabilities:r.catalog.size,modules:r.moduleManifests.length}))`], { cwd: os.tmpdir(), capture: true });
  const counts = JSON.parse(catalog.stdout);
  if (counts.capabilities !== 596 || counts.modules !== 21) throw new Error(`Installed catalog mismatch: ${catalog.stdout}`);

  const johnasonRoot = path.join(installDir, "node_modules", "@johnason");
  const pathLeaks = scanRepositoryPathLeaks(johnasonRoot);
  if (pathLeaks.length) throw new Error(`Repository path leaked into installed packages: ${pathLeaks.join(", ")}`);

  const evidence = {
    schemaVersion: "1.0.0",
    status: "passed",
    installedAt: new Date().toISOString(),
    nodeVersion: process.version,
    packageCount: directories.length,
    tarballCount: tarballs.length,
    capabilities: counts.capabilities,
    modules: counts.modules,
    repositoryPathLeaks: pathLeaks.length,
    binary: path.relative(repositoryRoot, binary),
  };
  fs.writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
