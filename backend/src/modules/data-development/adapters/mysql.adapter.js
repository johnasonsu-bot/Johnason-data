const mysql = require("mysql2/promise");
const { applyResultLimit, parseTableName, quoteIdentifier, resolveRuntimeDatasourceConfig } = require("../data-development.utils");

function resolveConnectionConfig(config, databaseName) {
  const resolved = resolveRuntimeDatasourceConfig(config);
  return {
    host: resolved.host,
    port: Number(resolved.port || 3306),
    user: resolved.username,
    password: resolved.password,
    database: databaseName || resolved.databaseName || undefined,
    multipleStatements: false,
    connectTimeout: 10000,
  };
}

async function withConnection(config, databaseName, handler) {
  const connection = await mysql.createConnection(resolveConnectionConfig(config, databaseName));
  try {
    return await handler(connection);
  } finally {
    await connection.end();
  }
}

module.exports = {
  async testConnection(config) {
    return withConnection(config, config.databaseName, async (connection) => {
      await connection.query("SELECT 1 AS ok");
      return { success: true, message: "MySQL connection succeeded" };
    });
  },

  async getDatabases(config) {
    return withConnection(config, undefined, async (connection) => {
      const [rows] = await connection.query("SHOW DATABASES");
      return rows.map((row) => ({ name: row.Database }));
    });
  },

  async getTables(config, databaseName) {
    return withConnection(config, databaseName, async (connection) => {
      const scope = databaseName || config.databaseName;
      const [rows] = await connection.query(`
        SELECT table_name AS name,
               table_type AS type,
               table_comment AS comment
        FROM information_schema.tables
        WHERE table_schema = ?
        ORDER BY table_name
      `, [scope]);
      return rows.map((row) => ({
        name: row.name,
        type: row.type || "BASE TABLE",
        comment: row.comment || null,
      }));
    });
  },

  async getColumns(config, databaseName, tableName) {
    return withConnection(config, databaseName, async (connection) => {
      const parsed = parseTableName(tableName, databaseName || config.databaseName);
      const [rows] = await connection.query(`SHOW FULL COLUMNS FROM ${quoteIdentifier(parsed.scope ? `${parsed.scope}.${parsed.table}` : parsed.table, "mysql")}`);
      return rows.map((row, index) => ({
        name: row.Field,
        position: index + 1,
        dataType: row.Type,
        columnType: row.Type,
        nullable: row.Null === "YES",
        primaryKey: row.Key === "PRI",
        defaultValue: row.Default,
        comment: row.Comment,
      }));
    });
  },

  async getFunctions(config, databaseName) {
    return withConnection(config, databaseName, async (connection) => {
      const scope = databaseName || config.databaseName;
      const [rows] = await connection.query(`
        SELECT routine_name AS name, routine_type AS type, routine_schema AS schemaName
        FROM information_schema.routines
        WHERE routine_schema = ?
        ORDER BY routine_type, routine_name
      `, [scope]);
      return rows.map((row) => ({
        name: row.name,
        type: row.type,
        schema: row.schemaName,
      }));
    });
  },

  async executeQuery(config, sql, options = {}) {
    return withConnection(config, options.databaseName || config.databaseName, async (connection) => {
      const normalizedSql = applyResultLimit(sql, options.resultLimit, "mysql");
      const [rows, fields] = await connection.query(normalizedSql);
      return {
        fields: Array.isArray(fields) ? fields.map((field) => field.name) : [],
        rows: Array.isArray(rows) ? rows : [],
        rowCount: Array.isArray(rows) ? rows.length : 0,
        executedSql: normalizedSql,
      };
    });
  },

  async executeStatement(config, sql, options = {}) {
    return withConnection(config, options.databaseName || config.databaseName, async (connection) => {
      const normalizedSql = String(sql || "").trim().replace(/;+\s*$/, "");
      const [result] = await connection.query(normalizedSql);
      return {
        affectedRows: Number(result?.affectedRows || 0),
        insertId: Number(result?.insertId || 0),
        warningStatus: Number(result?.warningStatus || 0),
        executedSql: normalizedSql,
      };
    });
  },
};
