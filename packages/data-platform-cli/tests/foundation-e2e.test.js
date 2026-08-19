const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PassThrough, Readable } = require("node:stream");

const { main } = require("../src/main");

function capture() {
  let value = "";
  return { stream: { write(chunk) { value += chunk; } }, value() { return value; } };
}

function fakeKeychain() {
  const values = new Map();
  return {
    setDatabasePassword(profile, value) { values.set(`${profile}:db`, value); },
    getDatabasePassword(profile) { return values.get(`${profile}:db`) || null; },
    deleteDatabasePassword(profile) { return values.delete(`${profile}:db`); },
    setSessionToken(profile, value) { values.set(`${profile}:token`, value); },
    getSessionToken(profile) { return values.get(`${profile}:token`) || null; },
    deleteSessionToken(profile) { return values.delete(`${profile}:token`); },
    setRuntimeSigningSecret(profile, value) { values.set(`${profile}:secret`, value); },
    getRuntimeSigningSecret(profile) { return values.get(`${profile}:secret`) || null; },
    deleteRuntimeSigningSecret(profile) { return values.delete(`${profile}:secret`); },
  };
}

test("config profile add reads secrets from stdin and persists only non-secret fields", async (t) => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-foundation-"));
  t.after(() => fs.rmSync(homeDir, { recursive: true, force: true }));
  const stdout = capture();
  const stderr = capture();
  const keychain = fakeKeychain();
  const stdin = Readable.from([JSON.stringify({ databasePassword: "db-pass", runtimeSigningSecret: "jwt-secret" })]);
  stdin.isTTY = false;
  const code = await main([
    "--json", "config", "profile", "add", "dev",
    "--host", "127.0.0.1", "--port", "3306", "--database", "platform", "--user", "cli", "--secrets-stdin",
  ], { homeDir, keychain, stdin, stdout: stdout.stream, stderr: stderr.stream });
  assert.equal(code, 0, stderr.value());
  assert.equal(stderr.value(), "");
  assert.equal(JSON.parse(stdout.value()).success, true);
  const configFile = path.join(homeDir, "Library", "Application Support", "data-platform-cli", "config.json");
  const persisted = fs.readFileSync(configFile, "utf8");
  assert.doesNotMatch(persisted, /db-pass|jwt-secret|password|secret/i);
  assert.equal(keychain.getDatabasePassword("dev"), "db-pass");
  assert.equal(keychain.getRuntimeSigningSecret("dev"), "jwt-secret");
});

test("JSON mode emits exactly one document and stable code for invalid commands", async () => {
  const stdout = capture();
  const stderr = capture();
  const code = await main(["--json", "not-a-command"], {
    runtime: { catalog: new Map(), executeCapability() {} },
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(code, 2);
  assert.equal(stderr.value(), "");
  assert.equal(stdout.value().trim().split("\n").length, 1);
  assert.equal(JSON.parse(stdout.value()).success, false);
});

test("generated command executes through Commander with positional IDs and one JSON document", async () => {
  const stdout = capture();
  const stderr = capture();
  const capability = {
    capabilityId: "project.show",
    command: "project show",
    sourceApiKeys: ["GET /api/v1/projects/:id"],
    sourceFrontendKeys: [],
    module: "projects",
    action: "read",
    interaction: "json-read",
    executionMode: "sync-command",
    executionTargets: [{ kind: "database", engine: "mysql", role: "platform-authority" }],
    authRequired: true,
    projectScoped: true,
    confirmationRequired: false,
  };
  let called;
  const code = await main(["--json", "--project", "7", "project", "show", "42"], {
    runtime: {
      catalog: new Map([[capability.capabilityId, capability]]),
      async executeCapability(id, input, context) {
        called = { id, input, context };
        return { data: { found: true }, meta: { executionTargets: capability.executionTargets } };
      },
    },
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(code, 0, stderr.value());
  assert.deepEqual(called, {
    id: "project.show",
    input: { id: "42" },
    context: { profile: null, projectId: "7", idempotencyKey: null, wait: false, timeout: null },
  });
  assert.deepEqual(JSON.parse(stdout.value()).data, { found: true });
  assert.equal(stdout.value().trim().split("\n").length, 1);
});

test("project facade resolves through the shared catalog and selects profile project", async (t) => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-project-facade-"));
  t.after(() => fs.rmSync(homeDir, { recursive: true, force: true }));
  const stdout = capture();
  const stderr = capture();
  const capability = {
    capabilityId: "project.list",
    command: "project list-my-projects",
    sourceApiKeys: ["GET /api/v1/projects/my-projects"],
    sourceFrontendKeys: [],
    module: "project-spaces",
    action: "read",
    interaction: "json-read",
    executionMode: "sync-command",
    executionTargets: [{ kind: "database", engine: "mysql", role: "platform-authority" }],
    authRequired: true,
    projectScoped: false,
    confirmationRequired: false,
  };
  const profile = { name: "dev", db: { host: "localhost", port: 3306, database: "platform", user: "cli", timezone: "+08:00" } };
  let selected;
  const profileStore = {
    current() { return profile; },
    get(name) { return name === profile.name ? profile : null; },
    setCurrentProject(name, projectId) { selected = { name, projectId }; },
  };
  const runtime = {
    catalog: new Map([[capability.capabilityId, capability]]),
    async executeCapability() { return { data: [{ id: 9, projectCode: "AV", projectName: "Aviation" }] }; },
  };
  const code = await main(["--json", "project", "use", "9"], {
    runtime,
    profileStore,
    keychain: fakeKeychain(),
    paths: { dataDir: homeDir, configFile: path.join(homeDir, "config.json") },
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(code, 0, stderr.value());
  assert.deepEqual(selected, { name: "dev", projectId: 9 });
  assert.equal(JSON.parse(stdout.value()).data.project.projectCode, "AV");
});
