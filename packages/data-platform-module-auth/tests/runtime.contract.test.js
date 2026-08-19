const test = require("node:test");
const assert = require("node:assert/strict");

const { createCoreRuntime } = require("@johnason/data-platform-core");

function poolFor(rowsBySql) {
  const calls = [];
  const connection = {
    async query(sql, params) { calls.push({ sql, params }); return [rowsBySql(sql, params), []]; },
    async beginTransaction() { calls.push({ sql: "BEGIN" }); },
    async commit() { calls.push({ sql: "COMMIT" }); },
    async rollback() { calls.push({ sql: "ROLLBACK" }); },
    release() { calls.push({ sql: "RELEASE" }); },
  };
  return {
    calls,
    runtime: {
      pool: {
        query: connection.query.bind(connection),
        async getConnection() { return connection; },
      },
    },
  };
}

function capabilityId(apiKey) {
  const runtime = createCoreRuntime();
  return [...runtime.catalog.values()].find((entry) => entry.sourceApiKeys.includes(apiKey)).capabilityId;
}

test("bundled auth profile executes through injected database runtime", async () => {
  const db = poolFor(() => [{ id: 1, username: "alice", displayName: "Alice", roleCode: "admin", status: "active" }]);
  const core = createCoreRuntime();
  const result = await core.executeCapability(capabilityId("GET /api/v1/auth/profile"), {}, {
    actor: { sub: 1 },
    databaseRuntime: db.runtime,
    runtimeDependencies: { config: { jwtSecret: "test-only", jwtExpiresIn: "8h" } },
  });
  assert.equal(result.data.user.username, "alice");
  assert.match(db.calls[0].sql, /FROM users/);
});

test("bundled auth login compares password and commits session without returning it", async () => {
  const bcrypt = require("bcryptjs");
  const hash = await bcrypt.hash("pw", 4);
  const db = poolFor((sql) => {
    if (/FROM users/.test(sql)) return [{ id: 1, username: "alice", passwordHash: hash, displayName: "Alice", roleCode: "admin", status: "active" }];
    return [];
  });
  const core = createCoreRuntime();
  const result = await core.executeCapability(capabilityId("POST /api/v1/auth/login"), { username: "alice", password: "pw" }, {
    databaseRuntime: db.runtime,
    runtimeDependencies: { config: { jwtSecret: "test-only", jwtExpiresIn: "8h" } },
  });
  assert.equal(result.data.user.username, "alice");
  assert.equal(typeof result.data.token, "string");
  assert.doesNotMatch(JSON.stringify(result), /"password"/);
  assert.deepEqual(db.calls.filter((entry) => ["BEGIN", "COMMIT", "ROLLBACK", "RELEASE"].includes(entry.sql)).map((entry) => entry.sql), ["BEGIN", "COMMIT", "RELEASE"]);
});
