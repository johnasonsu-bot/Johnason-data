const { AsyncLocalStorage } = require("node:async_hooks");
const { PlatformError } = require("../contracts/errors");
const { getDatabaseRuntime } = require("./database-runtime");

const storage = new AsyncLocalStorage();

function runWithExecutionContext(context, callback) {
  if (!context || typeof callback !== "function") throw new TypeError("context and callback are required");
  return storage.run(Object.freeze({ ...context }), callback);
}

function getExecutionContext() {
  const context = storage.getStore();
  if (!context) throw new PlatformError("EXECUTION_CONTEXT_MISSING", "Execution context is not active");
  return context;
}

async function runInTransaction(handler) {
  if (typeof handler !== "function") throw new TypeError("transaction handler is required");
  const connection = await getDatabaseRuntime().pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { runWithExecutionContext, getExecutionContext, runInTransaction };
