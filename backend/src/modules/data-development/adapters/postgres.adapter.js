const { applyResultLimit, parseTableName, resolveRuntimeDatasourceConfig } = require("../data-development.utils");
const { createPostgresLikeClient } = require("../../../common/utils/db-client");

function escapeSqlString(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function resolveConnectionConfig(config, databaseName) {
  const resolved = resolveRuntimeDatasourceConfig(config);
  return {
    storageType: resolved.storageType,
    host: resolved.host,
    port: Number(resolved.port || 5432),
    user: resolved.username,
    username: resolved.username,
    password: resolved.password,
    database: databaseName || resolved.databaseName || undefined,
    schema: resolved.schema || "public",
    connectionTimeoutMillis: 10000,
  };
}

async function withClient(config, databaseName, handler) {
  const connectionConfig = resolveConnectionConfig(config, databaseName);
  const client = createPostgresLikeClient(connectionConfig, {
    sourceType: connectionConfig.storageType,
  });
  await client.connect();
  try {
    return await handler(client);
  } finally {
    await client.end();
  }
}

module.exports = {
  async testConnection(config) {
    return withClient(config, config.databaseName, async (client) => {
      await client.query("SELECT 1 AS ok");
      return { success: true, message: "PostgreSQL connection succeeded" };
    });
  },

  async getDatabases(config) {
    return withClient(config, config.databaseName || "postgres", async (client) => {
      const result = await client.query(`
        SELECT datname
        FROM pg_database
        WHERE datistemplate = false
        ORDER BY datname
      `);
      return result.rows.map((row) => ({ name: row.datname }));
    });
  },

  async getTables(config, databaseName) {
    return withClient(config, databaseName || config.databaseName, async (client) => {
      const connectionConfig = resolveConnectionConfig(config, databaseName || config.databaseName);
      const schemaName = connectionConfig.schema || "public";
      const result = await client.query(`
        SELECT t.table_schema,
               t.table_name,
               t.table_type,
               obj_description((quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass, 'pg_class') AS comment
        FROM information_schema.tables t
        WHERE t.table_schema = ${escapeSqlString(schemaName)}
        ORDER BY table_schema, table_name
      `);
      return result.rows.map((row) => ({
        name: `${row.table_schema}.${row.table_name}`,
        type: row.table_type,
        comment: row.comment || null,
      }));
    });
  },

  async getColumns(config, databaseName, tableName) {
    return withClient(config, databaseName || config.databaseName, async (client) => {
      const parsed = parseTableName(tableName, "public");
      const result = await client.query(`
        SELECT column_name, ordinal_position, data_type, udt_name, is_nullable, column_default,
               col_description((quote_ident(table_schema) || '.' || quote_ident(table_name))::regclass::oid, ordinal_position) AS comment
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, [parsed.scope || "public", parsed.table]);
      const pkResult = await client.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      `, [parsed.scope || "public", parsed.table]);
      const primaryKeys = new Set(pkResult.rows.map((row) => row.column_name));

      return result.rows.map((row) => ({
        name: row.column_name,
        position: Number(row.ordinal_position),
        dataType: row.data_type,
        columnType: row.udt_name || row.data_type,
        nullable: row.is_nullable === "YES",
        primaryKey: primaryKeys.has(row.column_name),
        defaultValue: row.column_default,
        comment: row.comment || null,
      }));
    });
  },

  async getFunctions(config, databaseName) {
    return withClient(config, databaseName || config.databaseName, async (client) => {
      const connectionConfig = resolveConnectionConfig(config, databaseName || config.databaseName);
      const schemaName = connectionConfig.schema || "public";
      const result = await client.query(`
        SELECT n.nspname AS schema_name,
               p.proname AS routine_name,
               CASE p.prokind
                 WHEN 'p' THEN 'PROCEDURE'
                 ELSE 'FUNCTION'
               END AS routine_type
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = ${escapeSqlString(schemaName)}
        ORDER BY n.nspname, p.proname
      `);

      return result.rows.map((row) => ({
        name: row.routine_name,
        type: row.routine_type,
        schema: row.schema_name,
      }));
    });
  },

  async executeQuery(config, sql, options = {}) {
    return withClient(config, options.databaseName || config.databaseName, async (client) => {
      const normalizedSql = applyResultLimit(sql, options.resultLimit, "postgresql");
      const result = await client.query(normalizedSql);
      return {
        fields: result.fields?.map((field) => field.name) || [],
        rows: result.rows || [],
        rowCount: Number(result.rowCount || 0),
        executedSql: normalizedSql,
      };
    });
  },

  async executeStatement(config, sql, options = {}) {
    return withClient(config, options.databaseName || config.databaseName, async (client) => {
      const normalizedSql = String(sql || "").trim().replace(/;+\s*$/, "");
      const result = await client.query(normalizedSql);
      return {
        affectedRows: Number(result.rowCount || 0),
        executedSql: normalizedSql,
      };
    });
  },
};
