const dmdb = require("dmdb");
const {
  applyResultLimit,
  parseTableName,
  resolveRuntimeDatasourceConfig,
} = require("../data-development.utils");

function resolveConnectionConfig(config = {}) {
  const resolved = resolveRuntimeDatasourceConfig(config);
  return {
    connectString: `${resolved.host}:${resolved.port || 5236}`,
    user: resolved.username,
    password: resolved.password,
    schema: resolved.schema || undefined,
    connectTimeout: 10000,
    autoCommit: true,
  };
}

async function withConnection(config, handler) {
  const connection = await dmdb.getConnection(resolveConnectionConfig(config));
  try {
    return await handler(connection);
  } finally {
    await connection.close();
  }
}

function toObjectRows(result) {
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  if (!rows.length || !Array.isArray(rows[0])) return rows;
  const fields = (result.metaData || []).map((item) => item.name);
  return rows.map((row) => Object.fromEntries(fields.map((field, index) => [field, row[index]])));
}

function normalizeResult(result, executedSql) {
  const rows = toObjectRows(result);
  return {
    fields: Array.isArray(result?.metaData) ? result.metaData.map((item) => item.name) : Object.keys(rows[0] || {}),
    rows,
    rowCount: rows.length,
    affectedRows: Number(result?.rowsAffected || 0),
    executedSql,
  };
}

function normalizeDmSql(sql) {
  const normalized = String(sql || "").trim().replace(/;+\s*$/, "");
  const offsetMatch = normalized.match(/^(.*)\s+LIMIT\s+(\d+)\s+OFFSET\s+(\d+)\s*$/is);
  if (offsetMatch) return `${offsetMatch[1]} OFFSET ${offsetMatch[3]} ROWS FETCH NEXT ${offsetMatch[2]} ROWS ONLY`;
  const limitMatch = normalized.match(/^(.*)\s+LIMIT\s+(\d+)\s*$/is);
  if (limitMatch) return `${limitMatch[1]} FETCH FIRST ${limitMatch[2]} ROWS ONLY`;
  return normalized;
}

function schemaName(config) {
  const resolved = resolveRuntimeDatasourceConfig(config);
  return String(resolved.schema || resolved.username || "").toUpperCase();
}

function resolveSchemaName(config, candidate) {
  const resolved = resolveRuntimeDatasourceConfig(config);
  const normalizedCandidate = String(candidate || "").trim();
  if (!normalizedCandidate || normalizedCandidate.toUpperCase() === String(resolved.databaseName || "").toUpperCase()) {
    return schemaName(config);
  }
  return normalizedCandidate.toUpperCase();
}

module.exports = {
  async testConnection(config) {
    return withConnection(config, async (connection) => {
      await connection.execute("SELECT 1 AS ok FROM DUAL");
      return { success: true, message: "达梦数据库连接测试成功" };
    });
  },

  async getDatabases(config) {
    return module.exports.getSchemas(config);
  },

  async getSchemas(config) {
    return withConnection(config, async (connection) => {
      const result = await connection.execute("SELECT username AS name FROM all_users ORDER BY username");
      return toObjectRows(result).map((row) => ({ name: row.NAME || row.name }));
    });
  },

  async getTables(config, schema) {
    const owner = resolveSchemaName(config, schema);
    return withConnection(config, async (connection) => {
      const result = await connection.execute(
        `SELECT owner, object_name AS name, object_type AS type FROM all_objects WHERE owner = ? AND object_type IN ('TABLE', 'VIEW') ORDER BY object_name`,
        [owner],
      );
      return toObjectRows(result).map((row) => ({
        name: `${row.OWNER || owner}.${row.NAME || row.name}`,
        type: row.TYPE || row.type,
        comment: null,
      }));
    });
  },

  async getColumns(config, schema, tableName) {
    const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
    const owner = String(parsed.scope || schemaName(config)).toUpperCase();
    const table = String(parsed.table || "").toUpperCase();
    return withConnection(config, async (connection) => {
      const result = await connection.execute(
        `SELECT c.column_name, c.column_id, c.data_type, c.data_length, c.data_precision, c.data_scale, c.nullable, c.data_default,
                CASE WHEN EXISTS (SELECT 1 FROM all_constraints ac JOIN all_cons_columns acc ON acc.constraint_name = ac.constraint_name AND acc.owner = ac.owner WHERE ac.constraint_type = 'P' AND ac.owner = c.owner AND acc.table_name = c.table_name AND acc.column_name = c.column_name) THEN 'Y' ELSE 'N' END AS primary_key
           FROM all_tab_columns c WHERE c.owner = ? AND c.table_name = ? ORDER BY c.column_id`,
        [owner, table],
      );
      return toObjectRows(result).map((row) => ({
        name: row.COLUMN_NAME,
        position: Number(row.COLUMN_ID),
        dataType: row.DATA_TYPE,
        columnType: row.DATA_TYPE,
        length: row.DATA_LENGTH,
        precision: row.DATA_PRECISION,
        scale: row.DATA_SCALE,
        nullable: row.NULLABLE === "Y",
        primaryKey: row.PRIMARY_KEY === "Y",
        defaultValue: row.DATA_DEFAULT,
        comment: null,
      }));
    });
  },

  async getFunctions(config, schema) {
    const owner = resolveSchemaName(config, schema);
    return withConnection(config, async (connection) => {
      const result = await connection.execute(
        `SELECT owner, object_name AS name, object_type AS type FROM all_objects WHERE owner = ? AND object_type IN ('FUNCTION', 'PROCEDURE', 'PACKAGE') ORDER BY object_name`,
        [owner],
      );
      return toObjectRows(result).map((row) => ({ name: row.NAME, type: row.TYPE, schema: row.OWNER }));
    });
  },

  async getIndexes(config, schema, tableName) {
    const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
    const owner = String(parsed.scope || schemaName(config)).toUpperCase();
    const table = String(parsed.table || "").toUpperCase();
    return withConnection(config, async (connection) => {
      const result = await connection.execute(
        `SELECT i.index_name, i.uniqueness, i.index_type, c.column_name, c.column_position FROM all_indexes i JOIN all_ind_columns c ON c.index_owner = i.owner AND c.index_name = i.index_name WHERE i.table_owner = ? AND i.table_name = ? ORDER BY i.index_name, c.column_position`,
        [owner, table],
      );
      const grouped = new Map();
      for (const row of toObjectRows(result)) {
        if (!grouped.has(row.INDEX_NAME)) grouped.set(row.INDEX_NAME, { indexName: row.INDEX_NAME, unique: row.UNIQUENESS === "UNIQUE", indexType: row.INDEX_TYPE, cardinality: null, columns: [] });
        grouped.get(row.INDEX_NAME).columns.push(row.COLUMN_NAME);
      }
      return [...grouped.values()];
    });
  },

  async getConstraints(config, schema, tableName) {
    const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
    const owner = String(parsed.scope || schemaName(config)).toUpperCase();
    const table = String(parsed.table || "").toUpperCase();
    return withConnection(config, async (connection) => {
      const result = await connection.execute(
        `SELECT c.constraint_name, c.constraint_type, cc.column_name, rc.table_name AS referenced_table_name, rcc.column_name AS referenced_column_name
           FROM all_constraints c LEFT JOIN all_cons_columns cc ON cc.owner = c.owner AND cc.constraint_name = c.constraint_name
           LEFT JOIN all_constraints rc ON rc.owner = c.r_owner AND rc.constraint_name = c.r_constraint_name
           LEFT JOIN all_cons_columns rcc ON rcc.owner = rc.owner AND rcc.constraint_name = rc.constraint_name AND rcc.position = cc.position
          WHERE c.owner = ? AND c.table_name = ? ORDER BY c.constraint_name, cc.position`,
        [owner, table],
      );
      const typeMap = { P: "PRIMARY KEY", R: "FOREIGN KEY", U: "UNIQUE", C: "CHECK" };
      const grouped = new Map();
      for (const row of toObjectRows(result)) {
        if (!grouped.has(row.CONSTRAINT_NAME)) grouped.set(row.CONSTRAINT_NAME, { constraintName: row.CONSTRAINT_NAME, constraintType: typeMap[row.CONSTRAINT_TYPE] || row.CONSTRAINT_TYPE, columns: [], references: [] });
        const item = grouped.get(row.CONSTRAINT_NAME);
        if (row.COLUMN_NAME) item.columns.push(row.COLUMN_NAME);
        if (row.REFERENCED_TABLE_NAME && row.REFERENCED_COLUMN_NAME) item.references.push({ tableName: row.REFERENCED_TABLE_NAME, columnName: row.REFERENCED_COLUMN_NAME });
      }
      return [...grouped.values()];
    });
  },

  async executeQuery(config, sql, options = {}) {
    return withConnection(config, async (connection) => {
      const normalizedSql = applyResultLimit(normalizeDmSql(sql), options.resultLimit, "dm");
      const result = await connection.execute(normalizedSql, options.binds || []);
      return normalizeResult(result, normalizedSql);
    });
  },

  async executeStatement(config, sql) {
    return withConnection(config, async (connection) => {
      const normalizedSql = String(sql || "").trim().replace(/;+\s*$/, "");
      const result = await connection.execute(normalizedSql);
      return { affectedRows: Number(result?.rowsAffected || 0), executedSql: normalizedSql };
    });
  },
};
