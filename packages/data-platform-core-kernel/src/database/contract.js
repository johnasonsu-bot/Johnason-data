const { PlatformError } = require("../contracts/errors");
const { createDialect } = require("./dialect");

function sanitizeMessage(message) {
  return String(message || "Database operation failed")
    .replace(/((?:password|pwd|token|secret|api[-_]?key)\s*[=:]\s*)[^\s;,&]+/gi, "$1[REDACTED]")
    .replace(/:\/\/([^:@/]+):([^@/]+)@/g, "://$1:[REDACTED]@");
}

function normalizeDatabaseError(error, fallbackCode = "DATABASE_QUERY_FAILED") {
  if (error instanceof PlatformError && /^DATABASE_/.test(error.code)) return error;
  const connectionCodes = new Set(["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ER_ACCESS_DENIED_ERROR", "ORA-01017"]);
  const code = connectionCodes.has(error?.code) ? "DATABASE_CONNECTION_FAILED" : fallbackCode;
  return new PlatformError(code, sanitizeMessage(error?.message), undefined, { cause: error });
}

function normalizeResult(result) {
  if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0])) {
    return { rows: result[0], rowCount: result[0].length };
  }
  const rows = result?.rows || [];
  return { rows, rowCount: Number(result?.rowCount ?? result?.rowsAffected ?? rows.length) };
}

function createDatabaseAdapter(engine, driver) {
  const dialect = createDialect(engine);
  if (!driver || typeof driver.connect !== "function") throw new TypeError("driver.connect is required");

  async function withConnection(handler, fallbackCode) {
    let connection;
    try {
      connection = await driver.connect();
      return await handler(connection);
    } catch (error) {
      throw normalizeDatabaseError(error, fallbackCode);
    } finally {
      if (connection) {
        const close = connection.close || connection.release;
        if (typeof close === "function") await close.call(connection);
      }
    }
  }

  return Object.freeze({
    engine,
    dialect,
    async testConnection() {
      return withConnection(async () => true, "DATABASE_CONNECTION_FAILED");
    },
    async execute(sql, params = []) {
      return withConnection(async (connection) => normalizeResult(await connection.query(sql, params)), "DATABASE_QUERY_FAILED");
    },
    async transaction(handler) {
      return withConnection(async (connection) => {
        try {
          await connection.begin();
          const result = await handler(connection);
          await connection.commit();
          return result;
        } catch (error) {
          await connection.rollback();
          throw error;
        }
      }, "DATABASE_TRANSACTION_FAILED");
    },
    listSchemas: (...args) => driver.listSchemas?.(...args),
    listTables: (...args) => driver.listTables?.(...args),
    listColumns: (...args) => driver.listColumns?.(...args),
    sample: (...args) => driver.sample?.(...args),
  });
}

module.exports = { createDatabaseAdapter, normalizeDatabaseError, normalizeResult, sanitizeMessage };
