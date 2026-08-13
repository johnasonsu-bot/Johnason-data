const { DatabaseRuntimeMissingError } = require("../contracts/errors");
const { getExecutionContext, runWithExecutionContext } = require("./execution-context");

let defaultDatabaseRuntime = null;
const runtimeLifecycles = new WeakMap();

function assertRuntime(runtime) {
  if (!runtime || typeof runtime !== "object" || !runtime.pool || typeof runtime.testConnection !== "function" || typeof runtime.close !== "function") {
    throw new TypeError("Database runtime must expose pool, testConnection, and close");
  }
  return runtime;
}

function createLifecycle(closeOperation) {
  let resolveClose;
  let rejectClose;
  const lifecycle = {
    activeScopes: 0,
    closeStarted: false,
    closePromise: new Promise((resolve, reject) => {
      resolveClose = resolve;
      rejectClose = reject;
    }),
    closeOperation,
    resolveClose,
    rejectClose,
  };
  return lifecycle;
}

function beginClose(lifecycle) {
  if (!lifecycle.closeStarted) {
    lifecycle.closeStarted = true;
    Promise.resolve()
      .then(lifecycle.closeOperation)
      .then(lifecycle.resolveClose, lifecycle.rejectClose);
  }
  return lifecycle.closePromise;
}

function requestClose(lifecycle) {
  return lifecycle.activeScopes === 0 ? beginClose(lifecycle) : lifecycle.closePromise;
}

function lifecycleFor(runtime) {
  let lifecycle = runtimeLifecycles.get(runtime);
  if (!lifecycle) {
    lifecycle = createLifecycle(runtime.close.bind(runtime));
    runtimeLifecycles.set(runtime, lifecycle);
  }
  return lifecycle;
}

function createDatabaseRuntime(config, mysqlImpl) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new TypeError("Database config must be an object");
  if (!mysqlImpl || typeof mysqlImpl.createPool !== "function") throw new TypeError("mysql implementation must expose createPool");

  const pool = mysqlImpl.createPool(config);
  if (!pool || typeof pool.getConnection !== "function" || typeof pool.end !== "function") {
    throw new TypeError("Database pool must expose getConnection and end");
  }

  const lifecycle = createLifecycle(() => pool.end());
  const runtime = Object.freeze({
    pool,
    async testConnection() {
      const connection = await pool.getConnection();
      connection.release();
    },
    close() {
      return requestClose(lifecycle);
    },
  });
  runtimeLifecycles.set(runtime, lifecycle);
  return runtime;
}

function setDefaultDatabaseRuntime(runtime) {
  defaultDatabaseRuntime = runtime === null ? null : assertRuntime(runtime);
}

function getDatabaseRuntime() {
  const activeRuntime = getExecutionContext()?.databaseRuntime;
  if (activeRuntime) return activeRuntime;
  if (defaultDatabaseRuntime) return defaultDatabaseRuntime;
  throw new DatabaseRuntimeMissingError();
}

async function runWithDatabaseRuntime(runtime, callback) {
  assertRuntime(runtime);
  if (typeof callback !== "function") throw new TypeError("Database runtime callback must be a function");
  const lifecycle = lifecycleFor(runtime);
  lifecycle.activeScopes += 1;
  const context = getExecutionContext() || {};
  try {
    return await runWithExecutionContext({ ...context, databaseRuntime: runtime }, callback);
  } finally {
    lifecycle.activeScopes -= 1;
    if (lifecycle.activeScopes === 0) await beginClose(lifecycle);
  }
}

module.exports = {
  createDatabaseRuntime,
  getDatabaseRuntime,
  runWithDatabaseRuntime,
  setDefaultDatabaseRuntime,
};
