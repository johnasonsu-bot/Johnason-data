const { getDatabaseCapability } = require("../../../common/utils/datasource-capabilities");
const { buildJdbcUrl } = require("../../../common/utils/datasource-dialect");
const { getManagedBinding, runJdbcAction } = require("../../../common/utils/managed-jdbc-runtime");
const {
  applyResultLimit,
  parseTableName,
  resolveRuntimeDatasourceConfig,
} = require("../data-development.utils");

function readValue(row, ...names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row || {}, name)) return row[name];
    const key = Object.keys(row || {}).find((candidate) => candidate.toLowerCase() === String(name).toLowerCase());
    if (key) return row[key];
  }
  return null;
}

function prepareSql(sql, binds) {
  let normalizedSql = String(sql || "").trim();
  if (!binds) return { sql: normalizedSql, params: [] };
  if (Array.isArray(binds)) {
    if (/\$\d+/.test(normalizedSql)) {
      const params = [];
      normalizedSql = normalizedSql.replace(/\$(\d+)/g, (token, index) => {
        params.push(binds[Number(index) - 1]);
        return "?";
      });
      return { sql: normalizedSql, params };
    }
    return { sql: normalizedSql, params: binds };
  }
  const params = [];
  normalizedSql = normalizedSql.replace(/:([a-zA-Z][a-zA-Z0-9_]*)/g, (token, name) => {
    if (!Object.prototype.hasOwnProperty.call(binds, name)) return token;
    params.push(binds[name]);
    return "?";
  });
  return { sql: normalizedSql, params };
}

function connectionPayload(databaseType, config, databaseName, extras = {}) {
  const resolved = resolveRuntimeDatasourceConfig({ ...config, ...(databaseName ? { databaseName } : {}) });
  const jdbcUrl = buildJdbcUrl(databaseType, {
    host: resolved.host,
    port: resolved.port,
    database: databaseName || resolved.databaseName,
    databaseName: databaseName || resolved.databaseName,
    jdbcUrl: databaseName ? "" : resolved.jdbcUrl,
    connectionMode: resolved.connectionMode,
  });
  const schema = extras.schema || resolved.schema || (["oracle", "dm"].includes(databaseType) ? resolved.username : databaseType === "postgresql" ? "public" : "");
  return {
    jdbcUrl,
    username: resolved.username,
    password: resolved.password,
    catalog: databaseType === "mysql" ? (databaseName || resolved.databaseName || "") : (databaseType === "postgresql" ? (databaseName || resolved.databaseName || "") : ""),
    ...extras,
    schema: databaseType === "mysql" ? "" : schema,
  };
}

function groupBy(rows, keyResolver, initializer, append) {
  const grouped = new Map();
  for (const row of rows || []) {
    const key = keyResolver(row);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, initializer(row, key));
    append(grouped.get(key), row);
  }
  return [...grouped.values()];
}

function createManagedJdbcAdapter(databaseType, nativeAdapter) {
  const withBinding = async (handler, fallback) => {
    const binding = getManagedBinding(databaseType);
    return binding ? handler(binding) : fallback();
  };

  return {
    ...nativeAdapter,
    async testConnection(config) {
      return withBinding(async (binding) => {
        const capability = getDatabaseCapability(databaseType);
        await runJdbcAction(binding, "test", { ...connectionPayload(databaseType, config), sql: capability.healthCheckSql });
        return { success: true, message: `${capability.label} JDBC 驱动连接成功` };
      }, () => nativeAdapter.testConnection(config));
    },

    async getDatabases(config) {
      return withBinding(async (binding) => {
        const action = ["oracle", "dm"].includes(databaseType) ? "schemas" : "catalogs";
        const rows = await runJdbcAction(binding, action, connectionPayload(databaseType, config));
        return rows.map((row) => ({ name: readValue(row, "TABLE_CAT", "TABLE_SCHEM", "name") })).filter((row) => row.name);
      }, () => nativeAdapter.getDatabases(config));
    },

    async getSchemas(config) {
      return withBinding(async (binding) => {
        const rows = await runJdbcAction(binding, "schemas", connectionPayload(databaseType, config));
        return rows.map((row) => ({ name: readValue(row, "TABLE_SCHEM", "name") })).filter((row) => row.name);
      }, () => nativeAdapter.getSchemas ? nativeAdapter.getSchemas(config) : nativeAdapter.getDatabases(config));
    },

    async getTables(config, databaseName) {
      return withBinding(async (binding) => {
        const payload = connectionPayload(databaseType, config, databaseType === "mysql" || databaseType === "postgresql" ? databaseName : undefined, {
          schema: ["oracle", "dm"].includes(databaseType) ? databaseName : undefined,
        });
        const rows = await runJdbcAction(binding, "tables", payload);
        return rows.map((row) => {
          const table = readValue(row, "TABLE_NAME");
          const schema = readValue(row, "TABLE_SCHEM");
          return {
            name: databaseType === "mysql" || !schema ? table : `${schema}.${table}`,
            type: readValue(row, "TABLE_TYPE") || "TABLE",
            comment: readValue(row, "REMARKS"),
          };
        });
      }, () => nativeAdapter.getTables(config, databaseName));
    },

    async getColumns(config, databaseName, tableName) {
      return withBinding(async (binding) => {
        const parsed = parseTableName(tableName, databaseType === "postgresql" ? "public" : databaseName);
        const payload = connectionPayload(databaseType, config, databaseType === "mysql" || databaseType === "postgresql" ? databaseName : undefined, {
          schema: databaseType === "mysql" ? "" : parsed.scope,
          table: parsed.table,
        });
        const rows = await runJdbcAction(binding, "columns", payload);
        return rows.map((row, index) => ({
          name: readValue(row, "COLUMN_NAME"),
          position: Number(readValue(row, "ORDINAL_POSITION") || index + 1),
          dataType: readValue(row, "TYPE_NAME") || String(readValue(row, "DATA_TYPE") || ""),
          columnType: readValue(row, "TYPE_NAME") || String(readValue(row, "DATA_TYPE") || ""),
          length: Number(readValue(row, "COLUMN_SIZE") || 0) || null,
          precision: Number(readValue(row, "COLUMN_SIZE") || 0) || null,
          scale: Number(readValue(row, "DECIMAL_DIGITS") || 0) || null,
          nullable: Number(readValue(row, "NULLABLE")) !== 0,
          primaryKey: Boolean(readValue(row, "PRIMARY_KEY")),
          defaultValue: readValue(row, "COLUMN_DEF"),
          comment: readValue(row, "REMARKS"),
        }));
      }, () => nativeAdapter.getColumns(config, databaseName, tableName));
    },

    async getFunctions(config, databaseName) {
      return withBinding(async (binding) => {
        const payload = connectionPayload(databaseType, config, databaseType === "mysql" || databaseType === "postgresql" ? databaseName : undefined, {
          schema: ["oracle", "dm"].includes(databaseType) ? databaseName : undefined,
        });
        const rows = await runJdbcAction(binding, "functions", payload);
        return rows.map((row) => ({
          name: readValue(row, "FUNCTION_NAME", "PROCEDURE_NAME"),
          type: readValue(row, "ROUTINE_KIND") || "FUNCTION",
          schema: readValue(row, "FUNCTION_SCHEM", "PROCEDURE_SCHEM"),
        })).filter((row) => row.name);
      }, () => nativeAdapter.getFunctions(config, databaseName));
    },

    async getIndexes(config, databaseName, tableName) {
      return withBinding(async (binding) => {
        const parsed = parseTableName(tableName, databaseName);
        const scopedDatabase = ["mysql", "postgresql"].includes(databaseType) ? databaseName : undefined;
        const rows = await runJdbcAction(binding, "indexes", connectionPayload(databaseType, config, scopedDatabase, { schema: parsed.scope, table: parsed.table }));
        return groupBy(rows, (row) => readValue(row, "INDEX_NAME"), (row, key) => ({
          indexName: key,
          unique: !Boolean(readValue(row, "NON_UNIQUE")),
          indexType: readValue(row, "TYPE"),
          cardinality: readValue(row, "CARDINALITY"),
          columns: [],
        }), (item, row) => {
          const column = readValue(row, "COLUMN_NAME");
          if (column) item.columns.push(column);
        });
      }, () => nativeAdapter.getIndexes ? nativeAdapter.getIndexes(config, databaseName, tableName) : []);
    },

    async getConstraints(config, databaseName, tableName) {
      return withBinding(async (binding) => {
        const parsed = parseTableName(tableName, databaseName);
        const scopedDatabase = ["mysql", "postgresql"].includes(databaseType) ? databaseName : undefined;
        const rows = await runJdbcAction(binding, "constraints", connectionPayload(databaseType, config, scopedDatabase, { schema: parsed.scope, table: parsed.table }));
        return groupBy(rows, (row) => readValue(row, "FK_NAME", "PK_NAME") || readValue(row, "CONSTRAINT_KIND"), (row, key) => ({
          constraintName: key,
          constraintType: readValue(row, "CONSTRAINT_KIND"),
          columns: [],
          references: [],
        }), (item, row) => {
          const column = readValue(row, "FKCOLUMN_NAME", "COLUMN_NAME");
          if (column) item.columns.push(column);
          const referenceTable = readValue(row, "PKTABLE_NAME");
          const referenceColumn = readValue(row, "PKCOLUMN_NAME");
          if (referenceTable && referenceColumn) item.references.push({ tableName: referenceTable, columnName: referenceColumn });
        });
      }, () => nativeAdapter.getConstraints ? nativeAdapter.getConstraints(config, databaseName, tableName) : []);
    },

    async executeQuery(config, sql, options = {}) {
      return withBinding(async (binding) => {
        const limitedSql = applyResultLimit(sql, options.resultLimit, databaseType);
        const prepared = prepareSql(limitedSql, options.binds);
        const result = await runJdbcAction(binding, "query", {
          ...connectionPayload(databaseType, config, options.databaseName),
          sql: prepared.sql,
          params: prepared.params,
          maxRows: options.resultLimit || 1000,
        });
        return { ...result, executedSql: prepared.sql };
      }, () => nativeAdapter.executeQuery(config, sql, options));
    },

    async executeStatement(config, sql, options = {}) {
      return withBinding(async (binding) => {
        const prepared = prepareSql(String(sql || "").trim().replace(/;+\s*$/, ""), options.binds);
        const result = await runJdbcAction(binding, "statement", {
          ...connectionPayload(databaseType, config, options.databaseName),
          sql: prepared.sql,
          params: prepared.params,
        });
        return { ...result, executedSql: prepared.sql };
      }, () => nativeAdapter.executeStatement(config, sql, options));
    },
  };
}

module.exports = { createManagedJdbcAdapter, prepareSql };
