const { AsyncLocalStorage } = require("node:async_hooks");
const { PlatformError } = require("../contracts/errors");

const storage = new AsyncLocalStorage();
let defaultRuntime = null;

function createDatabaseRuntime(config, mysqlImpl) {
  if (!mysqlImpl || typeof mysqlImpl.createPool !== "function") {
    throw new TypeError("mysqlImpl.createPool is required");
  }
  const pool = mysqlImpl.createPool({ ...config });
  let closed = false;
  return {
    pool,
    async testConnection() {
      const connection = await pool.getConnection();
      try {
        return true;
      } finally {
        connection.release();
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      await pool.end();
    },
  };
}

function setDefaultDatabaseRuntime(runtime) {
  defaultRuntime = runtime;
  return runtime;
}

function getDatabaseRuntime() {
  const runtime = storage.getStore() || defaultRuntime;
  if (!runtime) throw new PlatformError("DATABASE_RUNTIME_MISSING", "Database runtime is not active");
  return runtime;
}

function runWithDatabaseRuntime(runtime, callback) {
  if (!runtime || typeof callback !== "function") throw new TypeError("runtime and callback are required");
  return storage.run(runtime, callback);
}

module.exports = {
  createDatabaseRuntime,
  setDefaultDatabaseRuntime,
  getDatabaseRuntime,
  runWithDatabaseRuntime,
};
