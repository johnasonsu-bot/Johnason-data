const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createFakeRuntime } = require("./fixtures/fake-runtime");

const workspaceRoot = path.resolve(__dirname, "../../..");
const packageDirectories = [
  "packages/data-platform-core-kernel",
  "packages/data-platform-module-asset-search",
  "packages/data-platform-module-auth",
  "packages/data-platform-module-data-sources",
  "packages/data-platform-module-data-source-research",
  "packages/data-platform-module-data-lab-sources",
  "packages/data-platform-module-ingestion-ai-configs",
  "packages/data-platform-module-ingestion-tasks",
  "packages/data-platform-module-file-imports",
  "packages/data-platform-module-model-providers",
  "packages/data-platform-module-dev-ai-configs",
  "packages/data-platform-module-reporting-ai-configs",
  "packages/data-platform-module-platform",
  "packages/data-platform-module-project-spaces",
  "packages/data-platform-core",
  "packages/data-platform-cli",
].map((directory) => path.join(workspaceRoot, directory));

function run(command, args, options = {}) {
  return childProcess.spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });
}

function pack(directory, destination) {
  const result = run("npm", ["pack", "--pack-destination", destination], { cwd: directory });
  assert.equal(result.status, 0, result.stderr);
  return path.join(destination, result.stdout.trim().split(/\r?\n/).at(-1));
}

function writeInstalledAuditor(file, prefix) {
  fs.writeFileSync(file, [
    'const fs = require("node:fs");',
    'const Module = require("node:module");',
    'const net = require("node:net");',
    'const path = require("node:path");',
    `const prefix = fs.realpathSync(${JSON.stringify(prefix)});`,
    'const self = fs.realpathSync(__filename);',
    'const builtinModules = new Set(Module.builtinModules.map((name) => name.replace(/^node:/, "")));',
    'function audit(candidate) {',
    '  if (typeof candidate !== "string" && !Buffer.isBuffer(candidate) && !(candidate instanceof URL)) return;',
    '  const absolute = path.resolve(candidate instanceof URL ? require("node:url").fileURLToPath(candidate) : String(candidate));',
    '  let resolved = absolute;',
    '  try { resolved = fs.realpathSync.native(absolute); } catch (error) { if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error; }',
    '  if (resolved !== self && resolved !== prefix && !resolved.startsWith(prefix + path.sep)) throw new Error(`cli-e2e-audit: prefix escape: ${resolved}`);',
    '}',
    'function auditModule(candidate) {',
    '  if (typeof candidate !== "string" || candidate.startsWith("node:") || builtinModules.has(candidate)) return;',
    '  let resolved = path.resolve(candidate);',
    '  try { resolved = fs.realpathSync.native(resolved); } catch (error) { if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error; }',
    '  if (resolved !== self && resolved !== prefix && !resolved.startsWith(prefix + path.sep)) throw new Error("cli-e2e-audit: module escape");',
    '}',
    'function guard(container, method) { const original = container[method]; container[method] = function (...args) { audit(args[0]); return original.apply(this, args); }; }',
    'for (const method of ["openSync", "readFileSync", "open", "readFile"]) guard(fs, method);',
    'for (const method of ["open", "readFile"]) guard(fs.promises, method);',
    'const originalResolveFilename = Module._resolveFilename;',
    'const originalLoad = Module._load;',
    'Module._resolveFilename = function (request, parent, isMain, options) { const resolved = originalResolveFilename.call(this, request, parent, isMain, options); auditModule(resolved); return resolved; };',
    'Module._load = function (request, parent, isMain) { const resolved = originalResolveFilename.call(Module, request, parent, isMain); auditModule(resolved); return originalLoad.call(this, request, parent, isMain); };',
    'net.Server.prototype.listen = function () { throw new Error("cli-e2e-audit: listener started"); };',
  ].join("\n"));
}

test("fresh tarballs install into a temporary prefix and execute from an arbitrary cwd", { timeout: 120_000 }, (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-cli-e2e-"));
  const tarballs = path.join(temporaryRoot, "tarballs");
  const prefix = path.join(temporaryRoot, "prefix");
  const arbitraryCwd = path.join(temporaryRoot, "arbitrary-cwd");
  const auditor = path.join(temporaryRoot, "installed-auditor.cjs");
  fs.mkdirSync(tarballs);
  fs.mkdirSync(arbitraryCwd);
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  const packed = packageDirectories.map((directory) => pack(directory, tarballs));
  const install = run("npm", ["install", "--prefix", prefix, "--ignore-scripts", ...packed], { cwd: temporaryRoot });
  assert.equal(install.status, 0, install.stderr);
  writeInstalledAuditor(auditor, prefix);
  const auditEnvironment = { NODE_OPTIONS: `--require=${auditor}` };

  const binary = path.join(prefix, "node_modules", ".bin", "data-platform");
  t.diagnostic(`installed binary: ${binary}`);
  t.diagnostic(`tarballs: ${packed.map((file) => path.basename(file)).join(", ")}`);
  assert.equal(fs.existsSync(binary), true);
  const help = run(binary, ["--help"], { cwd: arbitraryCwd, env: auditEnvironment });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage: data-platform/);
  assert.match(help.stdout, /\bauth\b/);
  assert.match(help.stdout, /\bproject\b/);
  assert.match(help.stdout, /\bsystem\b/);

  const version = run(binary, ["--version"], { cwd: arbitraryCwd, env: auditEnvironment });
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), "0.1.0");

  const invalid = run(binary, ["not-a-command"], { cwd: arbitraryCwd, env: auditEnvironment });
  assert.equal(invalid.status, 2, invalid.stderr);

  const jsonInvalid = run(binary, ["--json", "not-a-command"], { cwd: arbitraryCwd, env: auditEnvironment });
  assert.equal(jsonInvalid.status, 2, jsonInvalid.stderr);
  assert.equal(jsonInvalid.stdout.trim().split("\n").length, 1);
  assert.equal(JSON.parse(jsonInvalid.stdout).success, false);
  assert.doesNotMatch(`${help.stderr}\n${version.stderr}\n${invalid.stderr}\n${jsonInvalid.stderr}`, /listener started|prefix escape/);

  const escapeProbe = run(process.execPath, ["-e", `require("node:fs").readFileSync(${JSON.stringify(path.join(workspaceRoot, "package.json"))})`], {
    cwd: arbitraryCwd,
    env: auditEnvironment,
  });
  assert.notEqual(escapeProbe.status, 0);
  assert.match(escapeProbe.stderr, /cli-e2e-audit: prefix escape/);

  const requireEscapeProbe = run(process.execPath, ["-e", `require(${JSON.stringify(path.join(workspaceRoot, "packages/data-platform-cli/src/output/envelope.js"))})`], {
    cwd: arbitraryCwd,
    env: auditEnvironment,
  });
  assert.notEqual(requireEscapeProbe.status, 0);
  assert.match(requireEscapeProbe.stderr, /cli-e2e-audit: module escape/);
});

test("direct main injection completes login and project selection without HTTP or listeners", async () => {
  const fake = createFakeRuntime();
  await fake.run(async () => {
    const { main } = require("../src/main");
    assert.equal(await main(["auth", "login", "--username", "alice"], fake.dependencies), 0);
    assert.equal(await main(["project", "resolve", "--code", "aviation", "--require-one"], fake.dependencies), 0);
    assert.equal(await main(["project", "use", "--code", "aviation"], fake.dependencies), 0);
    assert.equal(await main(["project", "access-check", "--project", "12", "--action", "write"], fake.dependencies), 0);
  });
  assert.equal(fake.keychain.getSessionToken("dev"), "signed-token");
  assert.deepEqual(fake.selectedProjects, [["dev", 12]]);
  assert.deepEqual(fake.audit, { httpModules: [], urls: [], listeners: 0 });
});
