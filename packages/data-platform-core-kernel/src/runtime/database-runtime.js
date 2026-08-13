const { DatabaseRuntimeMissingError } = require("../contracts/errors");
const { getExecutionContext, runWithExecutionContext } = require("./execution-context");

let defaultDatabaseRuntime = null;

function assertRuntime(runtime) {
  if (!runtime || typeof runtime !== "object" || !runtime.pool || typeof runtime.testConnection !== "function" || typeof runtime.close !== "function") {
    throw new TypeError("Database runtime must expose pool, testConnection, and close");
  }
  return runtime;
}

function createDatabaseRuntime(config, mysqlImpl) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new TypeError("Database config must be an object");
  if (!mysqlImpl || typeof mysqlImpl.createPool !== "function") throw new TypeError("mysql implementation must expose createPool");

  const pool = mysqlImpl.createPool(config);
  if (!pool || typeof pool.getConnection !== "function" || typeof pool.end !== "function") {
    throw new TypeError("Database pool must expose getConnection and end");
  }

  let closePromise = null;
  return Object.freeze({
    pool,
    async testConnection() {
      const connection = await pool.getConnection();
      connection.release();
    },
    close() {
      if (!closePromise) closePromise = Promise.resolve().then(() => pool.end());
      return closePromise;
    },
  });
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
  const context = getExecutionContext() || {};
  try {
    return await runWithExecutionContext({ ...context, databaseRuntime: runtime }, callback);
  } finally {
    await runtime.close();
  }
}

module.exports = {
  createDatabaseRuntime,
  getDatabaseRuntime,
  runWithDatabaseRuntime,
  setDefaultDatabaseRuntime,
};
