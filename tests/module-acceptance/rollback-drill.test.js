const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runRollbackDrill } = require("../../scripts/run-module-rollback-drill");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const FIXTURES = path.join(__dirname, "fixtures");
const PACKAGE_NAME = "@johnason/data-platform-module-rollback-fixture";

function run(command, args, options = {}) {
  return childProcess.spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function waitForRegistry(url, processHandle) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 20_000;
    const poll = () => {
      if (processHandle.exitCode !== null) return reject(new Error(`Verdaccio exited: ${processHandle.exitCode}`));
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode < 500) return resolve();
        retry();
      });
      request.once("error", retry);
    };
    const retry = () => Date.now() >= deadline
      ? reject(new Error("Verdaccio readiness timeout"))
      : setTimeout(poll, 100);
    poll();
  });
}

function createRegistryAccount(registryUrl, username, password) {
  const body = JSON.stringify({ name: username, password, email: `${username}@example.invalid` });
  return new Promise((resolve, reject) => {
    const request = http.request(new URL(`-/user/org.couchdb.user:${encodeURIComponent(username)}`, registryUrl), {
      method: "PUT",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) },
    }, (response) => {
      let output = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { output += chunk; });
      response.on("end", () => {
        let parsed = {};
        try { parsed = JSON.parse(output); } catch {}
        if (response.statusCode >= 200 && response.statusCode < 300 && typeof parsed.token === "string") {
          resolve(parsed.token);
        } else reject(new Error(`Verdaccio account creation failed: ${response.statusCode}`));
      });
    });
    request.once("error", reject);
    request.end(body);
  });
}

async function createRegistry(t) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rollback-registry-"));
  const storage = path.join(temporaryRoot, "storage");
  const config = path.join(temporaryRoot, "verdaccio.yaml");
  const npmrc = path.join(temporaryRoot, "npmrc");
  fs.mkdirSync(storage);
  const template = fs.readFileSync(path.join(FIXTURES, "verdaccio.yaml"), "utf8");
  fs.writeFileSync(config, template
    .replace("__STORAGE__", JSON.stringify(storage))
    .replace("__HTPASSWD__", JSON.stringify(path.join(temporaryRoot, "htpasswd"))));
  const port = await availablePort();
  const registryUrl = `http://127.0.0.1:${port}/`;
  fs.writeFileSync(npmrc, `registry=${registryUrl}\nalways-auth=false\n`);
  const registry = childProcess.spawn(
    path.join(REPOSITORY_ROOT, "node_modules", ".bin", "verdaccio"),
    ["--config", config, "--listen", `127.0.0.1:${port}`],
    { cwd: temporaryRoot, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  registry.stdout.on("data", (chunk) => { output += chunk; });
  registry.stderr.on("data", (chunk) => { output += chunk; });
  t.after(() => {
    if (registry.exitCode === null) registry.kill("SIGTERM");
  });
  await waitForRegistry(registryUrl, registry);
  const username = `rollback-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
  const password = crypto.randomBytes(24).toString("base64url");
  const token = await createRegistryAccount(registryUrl, username, password);
  fs.appendFileSync(npmrc, `//127.0.0.1:${port}/:_authToken=\${ROLLBACK_REGISTRY_TOKEN}\n`);
  assert.equal(fs.readFileSync(npmrc, "utf8").includes(token), false);
  return {
    temporaryRoot,
    registryUrl,
    npmrc,
    npmEnvironment: { ROLLBACK_REGISTRY_TOKEN: token },
    registryOutput: () => output,
  };
}

function publishPackage(sourceDirectory, registry) {
  const tarballDirectory = path.join(registry.temporaryRoot, "tarballs");
  fs.mkdirSync(tarballDirectory, { recursive: true });
  const environment = { NPM_CONFIG_USERCONFIG: registry.npmrc, ...registry.npmEnvironment };
  const packed = run("npm", ["pack", "--pack-destination", tarballDirectory], {
    cwd: sourceDirectory,
    env: environment,
  });
  assert.equal(packed.status, 0, packed.stderr);
  const tarball = path.join(tarballDirectory, packed.stdout.trim().split(/\r?\n/).at(-1));
  const published = run("npm", [
    "publish", tarball, "--registry", registry.registryUrl, "--access", "public", "--ignore-scripts",
  ], { cwd: registry.temporaryRoot, env: environment });
  assert.equal(published.status, 0, `${published.stderr}\n${registry.registryOutput()}`);
  return tarball;
}

function createPeerPackage(root) {
  const directory = path.join(root, "peer-package");
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, "package.json"), `${JSON.stringify({
    name: "@johnason/data-platform-rollback-peer",
    version: "1.0.0",
    main: "index.js",
  })}\n`);
  fs.writeFileSync(path.join(directory, "index.js"), "module.exports = Object.freeze({ peer: 'stable' });\n");
  return directory;
}

function commandSet(installPrefix, stateFile, idempotencyKey) {
  const entry = path.join(installPrefix, "node_modules", "@johnason", "data-platform-module-rollback-fixture", "index.js");
  return {
    createFacts: { argv: [process.execPath, entry, "upgrade-write", stateFile, idempotencyKey] },
    enterMaintenance: { argv: [process.execPath, entry, "maintenance-on", stateFile] },
    drain: { argv: [process.execPath, entry, "drain", stateFile] },
    stopWorkers: { argv: [process.execPath, entry, "stop-workers", stateFile] },
    snapshot: { argv: [process.execPath, entry, "snapshot", stateFile] },
    verifyRollback: { argv: [process.execPath, entry, "verify-rollback", stateFile] },
    verifyReUpgrade: { argv: [process.execPath, entry, "upgrade-write", stateFile, idempotencyKey] },
    exitMaintenance: { argv: [process.execPath, entry, "maintenance-off", stateFile] },
  };
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function digestManifest(manifest) {
  return `sha256:${crypto.createHash("sha256").update(`${JSON.stringify(manifest)}\n`).digest("hex")}`;
}

async function setupDrill(t) {
  const registry = await createRegistry(t);
  publishPackage(path.join(FIXTURES, "test-module-v1"), registry);
  publishPackage(path.join(FIXTURES, "test-module-v2"), registry);
  publishPackage(createPeerPackage(registry.temporaryRoot), registry);
  const installPrefix = path.join(registry.temporaryRoot, "install-prefix");
  fs.mkdirSync(installPrefix);
  fs.writeFileSync(path.join(installPrefix, "package.json"), `${JSON.stringify({
    name: "rollback-install",
    private: true,
    dependencies: { "@johnason/data-platform-rollback-peer": "1.0.0" },
  })}\n`);
  const peerInstall = run("npm", [
    "install", "--registry", registry.registryUrl, "--ignore-scripts", "--save-exact", "--workspaces=false",
  ], { cwd: installPrefix, env: { NPM_CONFIG_USERCONFIG: registry.npmrc, ...registry.npmEnvironment } });
  assert.equal(peerInstall.status, 0, peerInstall.stderr);
  const lockfile = path.join(installPrefix, "package-lock.json");
  const evidenceDir = path.join(registry.temporaryRoot, "evidence");
  const stateFile = path.join(registry.temporaryRoot, "state.json");
  const manifestFile = path.join(registry.temporaryRoot, "module-manifest.json");
  fs.writeFileSync(manifestFile, `${JSON.stringify({
    moduleName: "rollback-fixture",
    packageName: PACKAGE_NAME,
    candidateVersion: "0.2.0",
    rollbackVersion: "0.1.0",
    clean: true,
    migrations: [{ version: 2, direction: "expand" }],
  }, null, 2)}\n`);
  return {
    ...registry,
    installPrefix,
    evidenceDir,
    stateFile,
    manifestFile,
    lockfile,
    approvedManifestSha256: digestFile(manifestFile),
    approvedLockSha256: digestFile(lockfile),
    workRoot: registry.temporaryRoot,
    commands: commandSet(installPrefix, stateFile, "command-1"),
  };
}

test("real loopback packages roll 0.2.0 back to 0.1.0 and re-upgrade without duplicate facts", { timeout: 120_000 }, async (t) => {
  const fixture = await setupDrill(t);
  const result = await runRollbackDrill({
    moduleName: "rollback-fixture",
    candidateVersion: "0.2.0",
    rollbackVersion: "0.1.0",
    registryUrl: fixture.registryUrl,
    commands: fixture.commands,
    evidenceDir: fixture.evidenceDir,
    installPrefix: fixture.installPrefix,
    manifestFile: fixture.manifestFile,
    lockfile: fixture.lockfile,
    approvedManifestSha256: fixture.approvedManifestSha256,
    approvedLockSha256: fixture.approvedLockSha256,
    workRoot: fixture.workRoot,
    npmUserConfig: fixture.npmrc,
    npmEnvironment: fixture.npmEnvironment,
    environment: "test",
  });

  assert.equal(result.exitCode, 0, JSON.stringify(result));
  assert.equal(result.status, "accepted");
  assert.equal(result.maintenance, false);
  assert.equal(result.facts.count, 1);
  assert.equal(result.facts.duplicateCount, 0);
  assert.equal(result.otherPackagesByteIdentical, true);
  assert.deepEqual(result.versionSequence, ["0.2.0", "0.1.0", "0.2.0"]);
  const evidence = JSON.parse(fs.readFileSync(result.evidenceFile, "utf8"));
  assert.equal(evidence.status, "accepted");
  assert.equal(evidence.secretFindings, 0);
  assert.equal(evidence.registry, fixture.registryUrl);
  assert.match(evidence.environmentFingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(evidence).includes(fixture.temporaryRoot), false);
  const state = JSON.parse(fs.readFileSync(fixture.stateFile, "utf8"));
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.facts.length, 1);
  assert.equal(state.maintenance, false);

  const versions = run("npm", ["view", PACKAGE_NAME, "versions", "--json", "--registry", fixture.registryUrl], {
    cwd: fixture.temporaryRoot,
    env: { NPM_CONFIG_USERCONFIG: fixture.npmrc, ...fixture.npmEnvironment },
  });
  assert.equal(versions.status, 0, versions.stderr);
  assert.deepEqual(JSON.parse(versions.stdout), ["0.1.0", "0.2.0"]);
});

test("rollback failure preserves maintenance state and records redacted atomic evidence", { timeout: 120_000 }, async (t) => {
  const fixture = await setupDrill(t);
  fixture.commands.verifyRollback = {
    argv: [process.execPath, path.join(fixture.installPrefix, "missing-verifier.js")],
  };
  const result = await runRollbackDrill({
    moduleName: "rollback-fixture",
    candidateVersion: "0.2.0",
    rollbackVersion: "0.1.0",
    registryUrl: fixture.registryUrl,
    commands: fixture.commands,
    evidenceDir: fixture.evidenceDir,
    installPrefix: fixture.installPrefix,
    manifestFile: fixture.manifestFile,
    lockfile: fixture.lockfile,
    approvedManifestSha256: fixture.approvedManifestSha256,
    approvedLockSha256: fixture.approvedLockSha256,
    workRoot: fixture.workRoot,
    npmUserConfig: fixture.npmrc,
    npmEnvironment: fixture.npmEnvironment,
    environment: "test",
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.status, "failed");
  assert.equal(result.maintenance, true);
  assert.equal(JSON.parse(fs.readFileSync(fixture.stateFile, "utf8")).maintenance, true);
  const evidence = JSON.parse(fs.readFileSync(result.evidenceFile, "utf8"));
  assert.equal(evidence.status, "failed");
  assert.equal(evidence.maintenance, true);
  assert.equal(JSON.stringify(evidence).includes(fixture.temporaryRoot), false);
});

test("production, non-loopback, dirty, non-exact, downgrade, and inline-secret inputs fail closed", async () => {
  const validationRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rollback-validation-"));
  const validationLock = path.join(validationRoot, "package-lock.json");
  fs.writeFileSync(validationLock, "{}\n");
  const base = {
    moduleName: "rollback-fixture",
    candidateVersion: "0.2.0",
    rollbackVersion: "0.1.0",
    registryUrl: "http://127.0.0.1:4873/",
    commands: {
      createFacts: { argv: ["node", "fixture.js"] },
      enterMaintenance: { argv: ["node", "fixture.js"] },
      drain: { argv: ["node", "fixture.js"] },
      stopWorkers: { argv: ["node", "fixture.js"] },
      snapshot: { argv: ["node", "fixture.js"] },
      verifyRollback: { argv: ["node", "fixture.js"] },
      verifyReUpgrade: { argv: ["node", "fixture.js"] },
      exitMaintenance: { argv: ["node", "fixture.js"] },
    },
    evidenceDir: path.join(validationRoot, "evidence"),
    installPrefix: validationRoot,
    manifest: { migrations: [{ version: 2, direction: "expand" }] },
    lockfile: validationLock,
    approvedManifestSha256: digestManifest({ migrations: [{ version: 2, direction: "expand" }] }),
    approvedLockSha256: digestFile(validationLock),
    workRoot: validationRoot,
    environment: "test",
  };
  const invalid = [
    { environment: "production" },
    { registryUrl: "https://registry.npmjs.org/" },
    { approvedManifestSha256: `sha256:${"f".repeat(64)}` },
    { candidateVersion: "^0.2.0" },
    { manifest: { clean: true, migrations: [{ version: 2, direction: "down" }] } },
    { commands: { ...base.commands, drain: { argv: ["node", "fixture.js", "--token=plain-value"] } } },
  ];
  for (const override of invalid) {
    const result = await runRollbackDrill({ ...base, ...override });
    assert.equal(result.exitCode, 1, JSON.stringify(override));
    assert.equal(result.status, "failed");
  }
});

test("untrusted paths, production overrides, and complete inline secret forms are rejected", async () => {
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "rollback-path-guard-"));
  const invalidVersion = await runRollbackDrill({
    moduleName: "rollback-fixture",
    candidateVersion: "../../escaped",
    rollbackVersion: "0.1.0",
    registryUrl: "http://127.0.0.1:4873/",
    commands: {},
    evidenceDir,
    workRoot: evidenceDir,
    environment: "test",
  });
  assert.equal(invalidVersion.exitCode, 1);
  assert.equal(invalidVersion.evidenceFile.startsWith(fs.realpathSync(evidenceDir)), true);
  assert.equal(invalidVersion.evidenceFile.includes(".."), false);

  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "rollback-path-outside-"));
  const escapedLink = path.join(evidenceDir, "escaped-link");
  fs.symlinkSync(outside, escapedLink, "dir");
  const symlinkEscape = await runRollbackDrill({
    moduleName: "rollback-fixture",
    candidateVersion: "../../escaped",
    rollbackVersion: "0.1.0",
    registryUrl: "http://127.0.0.1:4873/",
    commands: {},
    evidenceDir: escapedLink,
    workRoot: evidenceDir,
    environment: "test",
  });
  assert.equal(symlinkEscape.evidenceFile, null);
  assert.deepEqual(fs.readdirSync(outside), []);

  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const result = await runRollbackDrill({
      moduleName: "rollback-fixture",
      candidateVersion: "0.2.0",
      rollbackVersion: "0.1.0",
      registryUrl: "http://127.0.0.1:4873/",
      commands: {},
      evidenceDir,
      environment: "test",
    });
    assert.deepEqual(result.failures, ["PRODUCTION_FORBIDDEN"]);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }

  for (const secret of [
    "jdbc:oracle:thin:user/password@db-host:1521/service",
    "Server=db;User=admin;Password=plain-value",
    "https://example.invalid/?token=plain-value",
    "Basic dXNlcjpwYXNzd29yZA==",
  ]) {
    const validationLock = path.join(evidenceDir, "package-lock.json");
    if (!fs.existsSync(validationLock)) fs.writeFileSync(validationLock, "{}\n");
    const result = await runRollbackDrill({
      moduleName: "rollback-fixture",
      candidateVersion: "0.2.0",
      rollbackVersion: "0.1.0",
      registryUrl: "http://127.0.0.1:4873/",
      commands: {
        createFacts: { argv: ["node", "fixture.js", secret] },
        enterMaintenance: { argv: ["node", "fixture.js"] },
        drain: { argv: ["node", "fixture.js"] },
        stopWorkers: { argv: ["node", "fixture.js"] },
        snapshot: { argv: ["node", "fixture.js"] },
        verifyRollback: { argv: ["node", "fixture.js"] },
        verifyReUpgrade: { argv: ["node", "fixture.js"] },
        exitMaintenance: { argv: ["node", "fixture.js"] },
      },
      evidenceDir,
      installPrefix: evidenceDir,
      manifest: { migrations: [] },
      lockfile: validationLock,
      approvedManifestSha256: digestManifest({ migrations: [] }),
      approvedLockSha256: digestFile(validationLock),
      workRoot: evidenceDir,
      environment: "test",
    });
    assert.deepEqual(result.failures, ["INLINE_SECRET"], secret);
  }
});

test("a successful maintenance side effect stays true when its output cannot be parsed", { timeout: 120_000 }, async (t) => {
  const fixture = await setupDrill(t);
  fixture.commands.enterMaintenance = {
    argv: [process.execPath, "-e", [
      "const fs=require('node:fs');",
      "const file=process.argv[1];",
      "const state=JSON.parse(fs.readFileSync(file,'utf8'));",
      "state.maintenance=true;",
      "fs.writeFileSync(file,JSON.stringify(state));",
      "process.stdout.write('not-json');",
    ].join(""), fixture.stateFile],
  };
  const result = await runRollbackDrill({
    moduleName: "rollback-fixture",
    candidateVersion: "0.2.0",
    rollbackVersion: "0.1.0",
    registryUrl: fixture.registryUrl,
    commands: fixture.commands,
    evidenceDir: fixture.evidenceDir,
    installPrefix: fixture.installPrefix,
    manifestFile: fixture.manifestFile,
    lockfile: fixture.lockfile,
    approvedManifestSha256: fixture.approvedManifestSha256,
    approvedLockSha256: fixture.approvedLockSha256,
    workRoot: fixture.workRoot,
    npmUserConfig: fixture.npmrc,
    npmEnvironment: fixture.npmEnvironment,
    environment: "test",
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.maintenance, true);
  assert.equal(JSON.parse(fs.readFileSync(fixture.stateFile, "utf8")).maintenance, true);
});

test("an evidence write failure preserves the real maintenance result", { timeout: 120_000 }, async (t) => {
  const fixture = await setupDrill(t);
  fixture.commands.verifyRollback = {
    argv: [process.execPath, path.join(fixture.installPrefix, "missing-verifier.js")],
  };
  const result = await runRollbackDrill({
    moduleName: "rollback-fixture",
    candidateVersion: "0.2.0",
    rollbackVersion: "0.1.0",
    registryUrl: fixture.registryUrl,
    commands: fixture.commands,
    evidenceDir: fixture.manifestFile,
    installPrefix: fixture.installPrefix,
    manifestFile: fixture.manifestFile,
    lockfile: fixture.lockfile,
    approvedManifestSha256: fixture.approvedManifestSha256,
    approvedLockSha256: fixture.approvedLockSha256,
    npmUserConfig: fixture.npmrc,
    npmEnvironment: fixture.npmEnvironment,
    environment: "test",
    workRoot: fixture.workRoot,
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.maintenance, true);
  assert.equal(result.evidenceFile, null);
  assert.ok(result.failures.includes("EVIDENCE_WRITE_FAILED"));
  assert.equal(JSON.parse(fs.readFileSync(fixture.stateFile, "utf8")).maintenance, true);
});
