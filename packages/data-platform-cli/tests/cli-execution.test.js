const test = require("node:test");
const assert = require("node:assert/strict");

const { createCliExecution } = require("../src/runtime/cli-execution");
const { loadActor } = require("../src/runtime/cli-execution");
const { assertCapabilityAccess, resolveProject } = require("../src/runtime/policies");

function fixture({ authRequired = false, command = "project list-projects", result = { data: { ok: true } } } = {}) {
  const capability = { capabilityId: "test.capability", command, authRequired, executionTargets: [{ kind: "database", engine: "mysql" }] };
  const calls = [];
  const runtime = {
    catalog: new Map([[capability.capabilityId, capability]]),
    async executeCapability(id, input, context) { calls.push({ id, input, context }); return result; },
  };
  const profile = { name: "dev", db: {}, currentProjectId: 42 };
  const keychain = {
    getDatabasePassword() { return "db-password"; },
    getRuntimeSigningSecret() { return "signing-secret"; },
    getSessionToken() { return null; },
    setSessionToken() {},
    deleteSessionToken() {},
  };
  let closeCount = 0;
  const databaseRuntime = { pool: {}, async close() { closeCount += 1; } };
  const execution = createCliExecution({
    runtime,
    profileStore: { current() { return profile; }, get() { return profile; } },
    keychain,
    databaseRuntimeFactory() { return databaseRuntime; },
  });
  return { execution, calls, keychain, databaseRuntime, closeCount: () => closeCount };
}

test("injects the selected profile runtime and closes it after success", async () => {
  const value = fixture();
  await value.execution.executeCapability("test.capability", { query: "x" }, {});
  assert.equal(value.calls[0].context.profile, "dev");
  assert.equal(value.calls[0].context.projectId, 42);
  assert.equal(value.calls[0].context.databaseRuntime, value.databaseRuntime);
  assert.equal(value.calls[0].context.runtimeDependencies.config.jwtSecret, "signing-secret");
  assert.equal(value.closeCount(), 1);
});

test("closes the database runtime exactly once after failure", async () => {
  const value = fixture();
  value.execution.catalog.get("test.capability").command = "failing";
  const original = value.execution.executeCapability;
  value.calls.length = 0;
  const failure = new Error("failure");
  const runtime = {
    catalog: value.execution.catalog,
    async executeCapability() { throw failure; },
  };
  const execution = createCliExecution({
    runtime,
    profileStore: { current() { return { name: "dev", db: {} }; } },
    keychain: value.keychain,
    databaseRuntimeFactory() { return value.databaseRuntime; },
  });
  await assert.rejects(() => execution.executeCapability("test.capability"), failure);
  assert.equal(value.closeCount(), 1);
  assert.equal(typeof original, "function");
});

test("stores login token in keychain but removes it from command output", async () => {
  const value = fixture({ command: "auth login", result: { data: { token: "signed-token", user: { id: 7 } } } });
  let stored;
  value.keychain.setSessionToken = (profile, token) => { stored = { profile, token }; };
  const result = await value.execution.executeCapability("test.capability", { username: "alice", password: "pw" });
  assert.deepEqual(stored, { profile: "dev", token: "signed-token" });
  assert.equal(Object.hasOwn(result.data, "token"), false);
  assert.deepEqual(result.data.user, { id: 7 });
});

test("local capabilities execute without loading profile, keychain, or database", async () => {
  const capability = { capabilityId: "health", command: "system doctor health", executionTargets: [{ kind: "local" }] };
  let invoked = 0;
  const runtime = {
    catalog: new Map([[capability.capabilityId, capability]]),
    async executeCapability() { invoked += 1; return { data: "ok" }; },
  };
  const execution = createCliExecution({
    runtime,
    profileStore: { current() { throw new Error("profile read"); } },
    keychain: {},
    databaseRuntimeFactory() { throw new Error("database opened"); },
  });
  assert.deepEqual(await execution.executeCapability("health"), { data: "ok" });
  assert.equal(invoked, 1);
});

test("loadActor verifies token, active session, current user, and touches the session", async () => {
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/FROM auth_sessions/.test(sql)) return [[{ id: "session-1", userId: 7 }]];
      if (/FROM users u/.test(sql)) return [[{
        id: 7,
        username: "alice",
        displayName: "Alice",
        roleCode: "developer",
        permissions: JSON.stringify({ modules: ["quality"] }),
        status: "active",
      }]];
      return [{ affectedRows: 1 }];
    },
  };
  const actor = await loadActor({ pool }, "signed", "secret", {
    verify(token, secret) {
      assert.equal(token, "signed");
      assert.equal(secret, "secret");
      return { sub: 7, sessionId: "session-1" };
    },
  });
  assert.equal(actor.username, "alice");
  assert.deepEqual(actor.permissions, { modules: ["quality"] });
  assert.ok(queries.some(({ sql }) => /last_seen_at = NOW/.test(sql)));
});

test("loadActor rejects revoked sessions before capability execution", async () => {
  const pool = {
    async query(sql) {
      if (/FROM auth_sessions/.test(sql)) return [[]];
      return [{ affectedRows: 1 }];
    },
  };
  await assert.rejects(
    () => loadActor({ pool }, "signed", "secret", { verify() { return { sub: 7, sessionId: "revoked" }; } }),
    (error) => error.code === "SESSION_REVOKED" && error.statusCode === 401,
  );
});

test("capability policy rejects missing module permission and viewer writes", () => {
  assert.throws(
    () => assertCapabilityAccess({ sourceApiKeys: ["GET /api/v1/quality-control/tasks"], action: "read", command: "quality list" }, { permissions: { modules: [] } }),
    (error) => error.code === "MODULE_PERMISSION_FORBIDDEN",
  );
  assert.throws(
    () => assertCapabilityAccess({ sourceApiKeys: ["POST /api/v1/quality-control/tasks"], action: "write", command: "quality create" }, { roleCode: "viewer", permissions: { modules: ["quality"] } }),
    (error) => error.code === "READ_ONLY_FORBIDDEN",
  );
});

test("project policy rejects a user without active membership", async () => {
  const pool = {
    async query(sql) {
      if (/FROM project_spaces WHERE id/.test(sql)) return [[{ id: 42, projectCode: "demo", status: "active" }]];
      if (/FROM project_members/.test(sql)) return [[]];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  await assert.rejects(
    () => resolveProject({ pool }, { sub: 7, roleCode: "developer" }, 42),
    (error) => error.code === "PROJECT_ACCESS_FORBIDDEN" && error.statusCode === 403,
  );
});
