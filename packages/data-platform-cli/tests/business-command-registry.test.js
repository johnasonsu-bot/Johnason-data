const assert = require("node:assert/strict");
const test = require("node:test");

const aggregate = require("@johnason/data-platform-core");
const baseline = require("../../../docs/superpowers/specs/data-platform-cli-coverage-baseline.json");
const { createFoundationCommands } = require("../src/registry/foundation-commands");
const { createBusinessCommands } = require("../src/registry/business-commands");
const { createCommandRegistry } = require("../src/registry/command-registry");
const { main } = require("../src/main");

function dependencies(core = { async execute(capabilityId) { return { capabilityId }; } }) {
  return {
    corePackage: aggregate,
    core,
    profile: { name: "dev" },
    profileStore: { current() { return { name: "dev" }; } },
    keychain: { getSessionToken() { return "signed-token"; } },
    databaseRuntime: { pool: { query() {} }, testConnection() {}, close() {} },
    sessionIdentity: { async verify() { return { sub: 7 }; } },
  };
}

test("business registry exposes every aggregate capability without duplicating foundation commands", () => {
  const deps = dependencies();
  const registry = createCommandRegistry();
  for (const definition of [...createFoundationCommands(deps), ...createBusinessCommands(deps)]) {
    registry.register(definition);
  }

  const allApiKeys = new Set();
  for (const definition of registry.values()) {
    for (const sourceApiKey of definition.sourceApiKeys) allApiKeys.add(sourceApiKey);
  }
  assert.equal(allApiKeys.size, baseline.apiCoverage.length);
  assert.deepEqual(
    [...new Set(baseline.apiCoverage.map((entry) => entry.apiKey))].filter((key) => !allApiKeys.has(key)),
    [],
  );
  assert.ok(registry.getByCommand("capability dataMap.getOverview"));
  assert.ok(registry.getByCommand("capability serviceRuntime.get"));
});

test("skill acceptance aliases expose project access-check and full doctor flags", () => {
  const definitions = createFoundationCommands(dependencies());
  assert.ok(definitions.find((definition) => definition.command === "project access check"));
  assert.ok(definitions.find((definition) => definition.capabilityId === "system.doctor"));
});

test("skill workflow aliases point at aggregate capabilities", () => {
  const deps = dependencies();
  const definitions = createBusinessCommands(deps);
  for (const command of [
    "datasource test-connection", "ingestion preview-source-data", "quality run-task-now",
    "development query execute", "data-map register-resources", "reporting create-report-dashboard",
    "asset-search business-data-search",
  ]) assert.ok(definitions.find((definition) => definition.command === command), `missing ${command}`);
});

test("business capability handler revalidates the session and executes through aggregate core", async () => {
  const calls = [];
  const deps = dependencies({
    async execute(capabilityId, input, context) {
      calls.push({ capabilityId, input, context });
      if (capabilityId === "auth.profile") {
        return { user: { id: 7, sub: 7, username: "alice", displayName: "Alice", roleId: 1, roleCode: "admin", roleType: null, roleName: "Admin", defaultProjectId: null, permissions: { modules: [] } } };
      }
      return { accepted: true };
    },
  });
  const definition = createBusinessCommands(deps).find((candidate) => candidate.capabilityId === "dataMap.getOverview");
  assert.ok(definition);
  const result = await definition.handler({ projectId: 12 });
  assert.deepEqual(result, { accepted: true });
  assert.deepEqual(calls.map((call) => call.capabilityId), ["auth.profile", "dataMap.getOverview"]);
  assert.equal(calls[1].context.actor.id, 7);
  assert.equal(calls[1].context.token, "signed-token");
});

test("anonymous platform aliases do not require an already authenticated session", async () => {
  const calls = [];
  const deps = dependencies({
    async execute(capabilityId, input, context) {
      calls.push({ capabilityId, input, context });
      return capabilityId === "platform.auth-login" ? { token: "new-token", user: { id: 7 } } : { accepted: true };
    },
  });
  const definition = createBusinessCommands(deps).find((candidate) => candidate.capabilityId === "platform.auth-login");
  assert.ok(definition);
  const result = await definition.handler({ username: "alice", password: "pw" });
  assert.deepEqual(result, { token: "new-token", user: { id: 7 } });
  assert.deepEqual(calls.map((call) => call.capabilityId), ["platform.auth-login"]);
});

test("main dispatches a business capability command with JSON input", async () => {
  const calls = [];
  const deps = dependencies({
    async execute(capabilityId, input) {
      calls.push({ capabilityId, input });
      if (capabilityId === "auth.profile") {
        return { user: { id: 7, sub: 7, username: "alice", displayName: "Alice", roleId: 1, roleCode: "admin", roleType: null, roleName: "Admin", defaultProjectId: null, permissions: { modules: [] } } };
      }
      return { accepted: true };
    },
  });
  const output = [];
  deps.stdin = { isTTY: false };
  deps.stdout = { isTTY: false, write(value) { output.push(String(value)); } };
  deps.stderr = { isTTY: false, write(value) { output.push(String(value)); } };
  deps.renderer = {
    success() { return 0; },
    error(error) { throw error; },
  };
  deps.createCommands = () => [...createFoundationCommands(deps), ...createBusinessCommands(deps)];
  const status = await main(["capability", "dataMap.getOverview", "--input", '{"projectId":12}'], deps);
  assert.equal(status, 0);
  assert.deepEqual(calls.map((call) => call.capabilityId), ["auth.profile", "dataMap.getOverview"]);
  assert.deepEqual(calls[1].input, { projectId: 12 });
  assert.deepEqual(output, []);
});
