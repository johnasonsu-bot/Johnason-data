const { AsyncLocalStorage } = require("node:async_hooks");

const executionContextStorage = new AsyncLocalStorage();
const RETRYABLE_TRANSACTION_CODES = new Set(["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"]);
const DEFAULT_TRANSACTION_ATTEMPTS = 3;

function databasePool(context) {
  const pool = context?.databaseRuntime?.pool;
  if (!pool || typeof pool.getConnection !== "function") {
    throw new TypeError("Execution context transaction requires databaseRuntime.pool.getConnection");
  }
  return pool;
}

function attachRollbackError(primaryError, rollbackError) {
  if (primaryError && (typeof primaryError === "object" || typeof primaryError === "function")) {
    try {
      Object.defineProperty(primaryError, "rollbackError", {
        configurable: true,
        enumerable: false,
        value: rollbackError,
      });
      return primaryError;
    } catch {}
  }
  const wrapped = new Error(String(primaryError), { cause: primaryError });
  wrapped.rollbackError = rollbackError;
  return wrapped;
}

async function runTransaction(baseContext, handler, { maxAttempts = DEFAULT_TRANSACTION_ATTEMPTS } = {}) {
  if (typeof handler !== "function") throw new TypeError("Transaction handler must be a function");
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > DEFAULT_TRANSACTION_ATTEMPTS) {
    throw new TypeError(`Transaction maxAttempts must be between 1 and ${DEFAULT_TRANSACTION_ATTEMPTS}`);
  }
  const active = executionContextStorage.getStore();
  if (active?.connection) return handler(active.connection);
  const pool = databasePool(baseContext);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const connection = await pool.getConnection();
    let rollbackSucceeded = false;
    try {
      await connection.beginTransaction();
      const transactionContext = Object.freeze({ ...baseContext, connection });
      const result = await executionContextStorage.run(transactionContext, () => handler(connection));
      await connection.commit();
      return result;
    } catch (primaryError) {
      try {
        await connection.rollback();
        rollbackSucceeded = true;
      } catch (rollbackError) {
        throw attachRollbackError(primaryError, rollbackError);
      }
      if (!rollbackSucceeded || !RETRYABLE_TRANSACTION_CODES.has(primaryError?.code) || attempt === maxAttempts) {
        throw primaryError;
      }
    } finally {
      connection.release();
    }
  }
  throw new Error("Transaction retry invariant violated");
}

function runWithExecutionContext(context, callback) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new TypeError("Execution context must be an object");
  }
  if (typeof callback !== "function") throw new TypeError("Execution callback must be a function");
  const baseContext = { ...context };
  baseContext.transaction = (handler, options) => runTransaction(baseContext, handler, options);
  return executionContextStorage.run(Object.freeze(baseContext), callback);
}

function getExecutionContext() {
  return executionContextStorage.getStore() || null;
}

module.exports = { runWithExecutionContext, getExecutionContext };
