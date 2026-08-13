const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const workspaceRoot = path.resolve(__dirname, "../..");
const packageDirectories = [
  "packages/data-platform-core-kernel",
  "packages/data-platform-module-auth",
  "packages/data-platform-module-project-spaces",
  "packages/data-platform-core",
  "packages/data-platform-cli",
].map((directory) => path.join(workspaceRoot, directory));
const standaloneConsumerDirectories = ["backend", "packages/data-platform-cli"]
  .map((directory) => path.join(workspaceRoot, directory));

test("standalone consumers require an explicit internal package registry", () => {
  for (const directory of standaloneConsumerDirectories) {
    const npmConfig = fs.readFileSync(path.join(directory, ".npmrc"), "utf8");
    assert.match(npmConfig, /^@johnason:registry=\$\{JOHNASON_NPM_REGISTRY\}$/m);
    assert.match(npmConfig, /^replace-registry-host=always$/m);
    assert.doesNotMatch(npmConfig, /(?:token|password|auth)=/i);
  }
});

function run(command, args, options = {}) {
  return childProcess.spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    input: options.input,
    env: { ...process.env, ...options.env },
  });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function waitForRegistry(registryUrl, registryProcess) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 20_000;
    const poll = () => {
      if (registryProcess.exitCode !== null) {
        reject(new Error(`Verdaccio exited before readiness: ${registryProcess.exitCode}`));
        return;
      }
      const request = http.get(registryUrl, (response) => {
        response.resume();
        if (response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      request.once("error", retry);
    };
    const retry = () => {
      if (Date.now() >= deadline) {
        reject(new Error("Verdaccio did not become ready"));
        return;
      }
      setTimeout(poll, 100);
    };
    poll();
  });
}

function createRegistryAccount(registryUrl, username, password) {
  const body = JSON.stringify({ name: username, password, email: `${username}@example.invalid` });
  return new Promise((resolve, reject) => {
    const request = http.request(new URL(`-/user/org.couchdb.user:${encodeURIComponent(username)}`, registryUrl), {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      },
    }, (response) => {
      let output = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { output += chunk; });
      response.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(output); } catch { parsed = {}; }
        if (response.statusCode >= 200 && response.statusCode < 300 && typeof parsed.token === "string") {
          resolve(parsed.token);
          return;
        }
        reject(new Error(`Verdaccio account creation failed: ${response.statusCode}`));
      });
    });
    request.once("error", reject);
    request.end(body);
  });
}

function writeFileAuditor(auditorPath) {
  fs.writeFileSync(auditorPath, [
    'const fs = require("node:fs");',
    'const net = require("node:net");',
    'const path = require("node:path");',
    'const { fileURLToPath } = require("node:url");',
    'const prefix = fs.realpathSync(process.env.INSTALL_PREFIX);',
    'const auditor = fs.realpathSync(process.env.FILE_AUDITOR);',
    'function audit(filePath) {',
    '  if (typeof filePath !== "string" && !Buffer.isBuffer(filePath) && !(filePath instanceof URL)) return;',
    '  const candidate = filePath instanceof URL ? fileURLToPath(filePath) : String(filePath);',
    '  const absolute = path.resolve(candidate);',
    '  let resolved = absolute;',
    '  try { resolved = fs.realpathSync.native(absolute); } catch (error) {',
    '    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;',
    '  }',
    '  if (resolved !== auditor && resolved !== prefix && !resolved.startsWith(prefix + path.sep)) {',
    '    throw new Error(`aggregate-install-audit: prefix escape: ${resolved}`);',
    '  }',
    '}',
    'function guard(container, method) {',
    '  const original = container[method];',
    '  container[method] = function guardedFileAccess(...args) { audit(args[0]); return original.apply(this, args); };',
    '}',
    'for (const method of ["openSync", "readFileSync", "open", "readFile"]) guard(fs, method);',
    'for (const method of ["open", "readFile"]) guard(fs.promises, method);',
    'net.Server.prototype.listen = function forbiddenListener() {',
    '  throw new Error("aggregate-install-audit: listener started");',
    '};',
  ].join("\n"));
}

test("real registry packages install globally and execute aggregate capabilities from an arbitrary cwd", { timeout: 120_000 }, async (t) => {
  for (const directory of packageDirectories) {
    assert.equal(fs.existsSync(path.join(directory, "package.json")), true, `missing publishable package: ${directory}`);
  }

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aggregate-registry-install-"));
  const storage = path.join(temporaryRoot, "storage");
  const tarballs = path.join(temporaryRoot, "tarballs");
  const prefix = path.join(temporaryRoot, "prefix");
  const consumer = path.join(temporaryRoot, "arbitrary-cwd");
  const configFile = path.join(temporaryRoot, "verdaccio.yaml");
  const npmrc = path.join(temporaryRoot, "npmrc");
  const auditor = path.join(temporaryRoot, "audit-installed-files.cjs");
  fs.mkdirSync(storage);
  fs.mkdirSync(tarballs);
  fs.mkdirSync(consumer);
  writeFileAuditor(auditor);

  const port = await availablePort();
  const registryUrl = `http://127.0.0.1:${port}/`;
  fs.writeFileSync(configFile, [
    `storage: ${JSON.stringify(storage)}`,
    "auth:",
    "  htpasswd:",
    `    file: ${JSON.stringify(path.join(temporaryRoot, "htpasswd"))}`,
    "    max_users: 1000",
    "uplinks:",
    "  npmjs:",
    "    url: https://registry.npmjs.org/",
    "packages:",
    "  '@*/*':",
    "    access: $all",
    "    publish: $authenticated",
    "    unpublish: $all",
    "    proxy: npmjs",
    "  '**':",
    "    access: $all",
    "    publish: $authenticated",
    "    unpublish: $all",
    "    proxy: npmjs",
    "log: { type: stdout, format: pretty, level: warn }",
  ].join("\n"));
  fs.writeFileSync(npmrc, `registry=${registryUrl}\nalways-auth=false\n`);

  const registryProcess = childProcess.spawn(
    path.join(workspaceRoot, "node_modules/.bin/verdaccio"),
    ["--config", configFile, "--listen", `127.0.0.1:${port}`],
    { cwd: temporaryRoot, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env } },
  );
  let registryOutput = "";
  registryProcess.stdout.on("data", (chunk) => { registryOutput += chunk; });
  registryProcess.stderr.on("data", (chunk) => { registryOutput += chunk; });
  t.after(() => {
    if (registryProcess.exitCode === null) registryProcess.kill("SIGTERM");
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });
  await waitForRegistry(registryUrl, registryProcess);

  const publishEnvironment = { NPM_CONFIG_USERCONFIG: npmrc };
  const registryAccount = `aggregate-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
  const registryPassword = crypto.randomBytes(24).toString("base64url");
  const registryToken = await createRegistryAccount(registryUrl, registryAccount, registryPassword);
  const registryKey = `//127.0.0.1:${port}/:_authToken`;
  fs.appendFileSync(npmrc, `${registryKey}=${registryToken}\n`);
  for (const directory of packageDirectories) {
    const pack = run("npm", ["pack", "--pack-destination", tarballs], { cwd: directory, env: publishEnvironment });
    assert.equal(pack.status, 0, `${directory}\n${pack.stderr}`);
    const tarballName = pack.stdout.trim().split(/\r?\n/).at(-1);
    assert.match(tarballName, /\.tgz$/);
    const publish = run("npm", ["publish", path.join(tarballs, tarballName), "--registry", registryUrl, "--access", "public", "--ignore-scripts"], {
      cwd: temporaryRoot,
      env: publishEnvironment,
    });
    assert.equal(publish.status, 0, `${directory}\n${publish.stderr}\n${registryOutput}`);
  }

  const standaloneNpmrc = path.join(temporaryRoot, "standalone-user-npmrc");
  fs.writeFileSync(standaloneNpmrc, [
    "registry=https://registry.npmjs.org/",
    "always-auth=false",
    `${registryKey}=${registryToken}`,
  ].join("\n"));
  for (const sourceDirectory of standaloneConsumerDirectories) {
    const standaloneDirectory = path.join(temporaryRoot, `standalone-${path.basename(sourceDirectory)}`);
    fs.mkdirSync(standaloneDirectory);
    for (const fileName of ["package.json", "package-lock.json", ".npmrc"]) {
      fs.copyFileSync(path.join(sourceDirectory, fileName), path.join(standaloneDirectory, fileName));
    }
    const standaloneInstall = run("npm", ["ci", "--workspaces=false", "--ignore-scripts"], {
      cwd: standaloneDirectory,
      env: {
        NPM_CONFIG_USERCONFIG: standaloneNpmrc,
        JOHNASON_NPM_REGISTRY: registryUrl,
      },
    });
    assert.equal(standaloneInstall.status, 0, `${sourceDirectory}\n${standaloneInstall.stderr}\n${registryOutput}`);
  }

  const install = run("npm", [
    "install", "--global", "--prefix", prefix, "--registry", registryUrl, "--ignore-scripts",
    "@johnason/data-platform-cli@0.1.0",
  ], { cwd: temporaryRoot, env: publishEnvironment });
  assert.equal(install.status, 0, `${install.stderr}\n${registryOutput}`);

  const installedModules = path.join(prefix, "lib/node_modules");
  const installedCliEntry = path.join(installedModules, "@johnason/data-platform-cli/src/main.js");
  assert.equal(fs.existsSync(installedCliEntry), true, install.stdout);
  const auditEnvironment = {
    INSTALL_PREFIX: prefix,
    FILE_AUDITOR: auditor,
    NODE_PATH: installedModules,
    NODE_OPTIONS: `--require=${auditor}`,
    INSTALLED_CLI_ENTRY: installedCliEntry,
  };
  const execute = run(process.execPath, ["-e", [
    'const { createRequire } = require("node:module");',
    'const { createDataPlatformCore } = createRequire(process.env.INSTALLED_CLI_ENTRY)("@johnason/data-platform-core");',
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const prefix = fs.realpathSync(process.env.INSTALL_PREFIX);',
    'const auditor = fs.realpathSync(process.env.FILE_AUDITOR);',
    'for (const file of Object.keys(require.cache)) {',
    '  const resolved = fs.realpathSync(file);',
    '  if (resolved !== auditor && !resolved.startsWith(prefix + path.sep)) throw new Error(`loaded outside prefix: ${resolved}`);',
    '}',
    'const user = { id: 7, username: "operator", displayName: "Operator", roleId: 1, roleCode: "admin", roleType: "admin", roleName: "Administrator", defaultProjectId: null, permissions: { modules: ["system_projects"] }, status: "active" };',
    'const core = createDataPlatformCore({',
    '  databaseRuntime: { pool: { async getConnection() { return { async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} }; } }, async testConnection() {}, async close() {} },',
    '  auth: {',
    '    authRepository: { async findByUsername() { return user; }, async findProfileById() { return user; } },',
    '    sessionRepository: { async createSession() {}, async findActiveSession() { return null; }, async touchSession() {}, async revokeSession() {} },',
    '    jwtCodec: { sign() { return "signed"; }, decode() { return {}; }, verify() { return {}; } },',
    '    passwordHasher: { async compare() { return true; } }, clock: { now() { return new Date("2026-08-13T00:00:00.000Z"); } }, idGenerator() { return "session-1"; },',
    '  },',
    '  project: { projectRepository: { async ensureDefaultProject() { return null; }, async listProjects() { return []; } } },',
    '});',
    'Promise.all([',
    '  core.execute("auth.profile", { userId: 7 }, {}),',
    '  core.execute("project.list-my", {}, { actor: user }),',
    ']).then(([profile, projects]) => process.stdout.write(JSON.stringify({ profile, projects, versions: core.moduleVersions })));',
  ].join("\n")], { cwd: consumer, env: auditEnvironment });
  assert.equal(execute.status, 0, execute.stderr);
  assert.deepEqual(JSON.parse(execute.stdout), {
    profile: {
      user: {
        id: 7,
        sub: 7,
        username: "operator",
        displayName: "Operator",
        roleId: 1,
        roleCode: "admin",
        roleType: "admin",
        roleName: "Administrator",
        defaultProjectId: null,
        permissions: { modules: ["system_projects"] },
      },
    },
    projects: [],
    versions: { auth: "0.2.0", "project-spaces": "0.2.0" },
  });

  const cli = run(path.join(prefix, "bin/data-platform"), [], { cwd: consumer, env: auditEnvironment });
  assert.equal(cli.status, 0, cli.stderr);
  assert.doesNotMatch(`${execute.stderr}\n${cli.stderr}`, /listener started|prefix escape/);

  const repositoryEscape = run(process.execPath, ["-e", 'require("node:fs").readFileSync(process.env.REPOSITORY_PACKAGE);'], {
    cwd: consumer,
    env: { ...auditEnvironment, REPOSITORY_PACKAGE: path.join(workspaceRoot, "package.json") },
  });
  assert.notEqual(repositoryEscape.status, 0);
  assert.match(repositoryEscape.stderr, /aggregate-install-audit: prefix escape/);
});
