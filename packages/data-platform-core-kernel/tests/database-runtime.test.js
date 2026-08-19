const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDatabaseRuntime,
  getDatabaseRuntime,
  runWithDatabaseRuntime,
} = require("../src/runtime/database-runtime");

function fakeMysql(name) {
  const state = { releases: 0, ends: 0 };
  return {
    state,
    createPool(config) {
      return {
        name,
        config,
        async getConnection() { return { release() { state.releases += 1; } }; },
        async end() { state.ends += 1; },
      };
    },
  };
}

test("isolates concurrent database runtimes", async () => {
  const a = createDatabaseRuntime({ database: "a" }, fakeMysql("a"));
  const b = createDatabaseRuntime({ database: "b" }, fakeMysql("b"));
  const [left, right] = await Promise.all([
    runWithDatabaseRuntime(a, async () => {
      await new Promise((resolve) => setImmediate(resolve));
      return getDatabaseRuntime().pool.name;
    }),
    runWithDatabaseRuntime(b, async () => getDatabaseRuntime().pool.name),
  ]);
  assert.deepEqual([left, right], ["a", "b"]);
});

test("test connection releases and close is idempotent", async () => {
  const mysql = fakeMysql("test");
  const runtime = createDatabaseRuntime({ database: "test" }, mysql);
  await runtime.testConnection();
  await runtime.close();
  await runtime.close();
  assert.deepEqual(mysql.state, { releases: 1, ends: 1 });
});

test("missing runtime fails with a stable code", () => {
  assert.throws(() => getDatabaseRuntime(), (error) => error.code === "DATABASE_RUNTIME_MISSING");
});
