const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createDatabaseRuntime,
  getDatabaseRuntime,
  runWithDatabaseRuntime,
  setDefaultDatabaseRuntime,
} = require("../src/runtime/database-runtime");
const { runWithExecutionContext } = require("../src/runtime/execution-context");

function mysqlWithPool(pool) {
  return {
    createPool(config) {
      pool.createdWith = config;
      return pool;
    },
  };
}

function pool(id) {
  return {
    id,
    endCount: 0,
    releaseCount: 0,
    queryCount: 0,
    async end() {
      this.endCount += 1;
    },
    async getConnection() {
      return { release: () => { this.releaseCount += 1; } };
    },
    async query() {
      if (this.endCount > 0) throw new Error("pool closed before query");
      this.queryCount += 1;
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

test.afterEach(() => setDefaultDatabaseRuntime(null));

test("database runtime scopes concurrent and nested callbacks to their own pools", async () => {
  const poolA = pool("a");
  const poolB = pool("b");
  const runtimeA = createDatabaseRuntime({ host: "a" }, mysqlWithPool(poolA));
  const runtimeB = createDatabaseRuntime({ host: "b" }, mysqlWithPool(poolB));

  const [fromA, fromB] = await Promise.all([
    runWithDatabaseRuntime(runtimeA, async () => {
      await Promise.resolve();
      const beforeNested = getDatabaseRuntime().pool.id;
      const nested = await runWithDatabaseRuntime(runtimeB, async () => {
        await Promise.resolve();
        return getDatabaseRuntime().pool.id;
      });
      return [beforeNested, nested, getDatabaseRuntime().pool.id];
    }),
    runWithDatabaseRuntime(runtimeB, async () => {
      await Promise.resolve();
      return getDatabaseRuntime().pool.id;
    }),
  ]);

  assert.deepEqual(fromA, ["a", "b", "a"]);
  assert.equal(fromB, "b");
  assert.equal(poolA.endCount, 1);
  assert.equal(poolB.endCount, 1);
});

test("database runtime closes exactly once when a scoped callback succeeds", async () => {
  const databasePool = pool("success");
  const runtime = createDatabaseRuntime({ host: "success" }, mysqlWithPool(databasePool));

  assert.equal(await runWithDatabaseRuntime(runtime, () => "done"), "done");
  await runtime.close();

  assert.equal(databasePool.endCount, 1);
});

test("database runtime closes exactly once when a scoped callback fails", async () => {
  const databasePool = pool("failure");
  const runtime = createDatabaseRuntime({ host: "failure" }, mysqlWithPool(databasePool));

  await assert.rejects(
    runWithDatabaseRuntime(runtime, async () => { throw new Error("callback failed"); }),
    /callback failed/,
  );
  await runtime.close();

  assert.equal(databasePool.endCount, 1);
});

test("a shared runtime stays open until concurrent scopes have both exited", async () => {
  const databasePool = pool("concurrent-lease");
  const runtime = createDatabaseRuntime({ host: "concurrent-lease" }, mysqlWithPool(databasePool));
  const secondScopeEntered = deferred();
  const allowSecondScopeToExit = deferred();

  const secondScope = runWithDatabaseRuntime(runtime, async () => {
    secondScopeEntered.resolve();
    await allowSecondScopeToExit.promise;
    await runtime.pool.query("SELECT 1");
  });
  await secondScopeEntered.promise;
  await runWithDatabaseRuntime(runtime, async () => {});

  assert.equal(databasePool.endCount, 0);
  allowSecondScopeToExit.resolve();
  await secondScope;
  assert.equal(databasePool.queryCount, 1);
  assert.equal(databasePool.endCount, 1);
});

test("an inner scope of the same runtime cannot close its outer scope pool", async () => {
  const databasePool = pool("nested-lease");
  const runtime = createDatabaseRuntime({ host: "nested-lease" }, mysqlWithPool(databasePool));

  await runWithDatabaseRuntime(runtime, async () => {
    await runWithDatabaseRuntime(runtime, async () => {});
    assert.equal(databasePool.endCount, 0);
    await runtime.pool.query("SELECT 1");
  });

  assert.equal(databasePool.queryCount, 1);
  assert.equal(databasePool.endCount, 1);
});

test("a failing shared scope waits for successful sibling scopes before closing", async () => {
  const databasePool = pool("mixed-lease");
  const runtime = createDatabaseRuntime({ host: "mixed-lease" }, mysqlWithPool(databasePool));
  const failingScopeEntered = deferred();
  const allowFailingScopeToExit = deferred();

  const failingScope = runWithDatabaseRuntime(runtime, async () => {
    failingScopeEntered.resolve();
    await allowFailingScopeToExit.promise;
    throw new Error("second scope failed");
  });
  await failingScopeEntered.promise;
  await runWithDatabaseRuntime(runtime, async () => {});

  assert.equal(databasePool.endCount, 0);
  allowFailingScopeToExit.resolve();
  await assert.rejects(failingScope, /second scope failed/);
  assert.equal(databasePool.endCount, 1);
});

test("execution context and a default runtime make the current database runtime available", async () => {
  const contextPool = pool("context");
  const defaultPool = pool("default");
  const contextRuntime = createDatabaseRuntime({ host: "context" }, mysqlWithPool(contextPool));
  const defaultRuntime = createDatabaseRuntime({ host: "default" }, mysqlWithPool(defaultPool));

  setDefaultDatabaseRuntime(defaultRuntime);
  assert.equal(getDatabaseRuntime(), defaultRuntime);
  await runWithExecutionContext({ databaseRuntime: contextRuntime, requestId: "request-1" }, async () => {
    assert.equal(getDatabaseRuntime(), contextRuntime);
  });
  assert.equal(getDatabaseRuntime(), defaultRuntime);
});

test("getDatabaseRuntime fails with a stable code when no runtime is active or default", () => {
  assert.throws(
    () => getDatabaseRuntime(),
    (error) => error.code === "DATABASE_RUNTIME_MISSING" && /database runtime/i.test(error.message),
  );
});

test("database runtime preserves pool behavior and releases connection checks", async () => {
  const databasePool = pool("web");
  const runtime = createDatabaseRuntime({ host: "web", timezone: "+08:00" }, mysqlWithPool(databasePool));

  await runtime.testConnection();

  assert.deepEqual(databasePool.createdWith, { host: "web", timezone: "+08:00" });
  assert.equal(runtime.pool, databasePool);
  assert.equal(databasePool.releaseCount, 1);
});

test("web compatibility factory delegates a complete runtime port while legacy exports remain usable", () => {
  const database = require("../../../backend/src/config/database");
  const captured = [];
  const runtime = { pool: { id: "web-runtime" }, testConnection: async () => {}, close: async () => {} };
  const result = database.createWebDatabaseRuntime({
    createDatabaseRuntime(config, mysqlImpl) {
      captured.push({ config, mysqlImpl });
      return runtime;
    },
  }, { mysql: true });

  assert.equal(result, runtime);
  assert.equal(database.pool && typeof database.pool.query, "function");
  assert.equal(typeof database.testConnection, "function");
  assert.deepEqual(captured, [{
    config: {
      ...require("../../../backend/src/config/env").db,
      timezone: require("../../../backend/src/config/env").db.timezone || "+08:00",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      namedPlaceholders: true,
    },
    mysqlImpl: { mysql: true },
  }]);
});
