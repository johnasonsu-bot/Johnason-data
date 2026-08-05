const { applyResultLimit, parseTableName, resolveDatasourceHost, resolveRuntimeDatasourceConfig } = require("../data-development.utils");

function buildBaseUrl(config) {
  const resolved = resolveRuntimeDatasourceConfig(config);
  const protocol = resolved.protocol || "http";
  return `${protocol}://${resolveDatasourceHost(resolved.host)}:${Number(resolved.port || 8123)}`;
}

async function request(config, sql, databaseName, format = "json") {
  const searchParams = new URLSearchParams();
  const resolved = resolveRuntimeDatasourceConfig(config);
  if (databaseName || resolved.databaseName) {
    searchParams.set("database", databaseName || resolved.databaseName);
  }
  if (resolved.username) {
    searchParams.set("user", resolved.username);
  }
  if (resolved.password) {
    searchParams.set("password", resolved.password);
  }

  let normalizedSql = String(sql || "").trim().replace(/;+\s*$/, "");
  if (format === "json" && !/\bformat\s+json\b/i.test(normalizedSql)) {
    normalizedSql = `${normalizedSql} FORMAT JSON`;
  }

  const response = await fetch(`${buildBaseUrl(config)}/?${searchParams.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: normalizedSql,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `ClickHouse request failed with status ${response.status}`);
  }

  if (format === "json") {
    return { text, json: JSON.parse(text), executedSql: normalizedSql };
  }

  return { text, executedSql: normalizedSql };
}

module.exports = {
  async testConnection(config) {
    await request(config, "SELECT 1 AS ok", config.databaseName, "json");
    return { success: true, message: "ClickHouse connection succeeded" };
  },

  async getDatabases(config) {
    const result = await request(config, "SHOW DATABASES", undefined, "json");
    return (result.json.data || []).map((row) => ({ name: row.name || Object.values(row)[0] }));
  },

  async getTables(config, databaseName) {
    const scope = databaseName || config.databaseName;
    const result = await request(
      config,
      `SELECT name, engine AS type, comment FROM system.tables WHERE database = ${JSON.stringify(scope)} ORDER BY name`,
      databaseName,
      "json"
    );
    return (result.json.data || []).map((row) => ({
      name: row.name || Object.values(row)[0],
      type: row.type || "BASE TABLE",
      comment: row.comment || null,
    }));
  },

  async getColumns(config, databaseName, tableName) {
    const parsed = parseTableName(tableName, databaseName || config.databaseName);
    const result = await request(config, `DESCRIBE TABLE ${parsed.scope}.${parsed.table}`, parsed.scope, "json");
      return (result.json.data || []).map((row, index) => ({
        name: row.name,
        position: index + 1,
        dataType: row.type,
        columnType: row.type,
        nullable: /nullable/i.test(String(row.type || "")),
        primaryKey: false,
        defaultValue: row.default_expression || null,
        comment: row.comment || null,
      }));
  },

  async getFunctions() {
    return [];
  },

  async executeQuery(config, sql, options = {}) {
    const normalizedSql = applyResultLimit(sql, options.resultLimit, "clickhouse");
    const result = await request(config, normalizedSql, options.databaseName || config.databaseName, "json");
    const rows = result.json.data || [];
    const fields = result.json.meta?.map((item) => item.name) || Object.keys(rows[0] || {});
    return {
      fields,
      rows,
      rowCount: rows.length,
      executedSql: result.executedSql,
    };
  },

  async executeStatement(config, sql, options = {}) {
    const result = await request(config, sql, options.databaseName || config.databaseName, "text");
    return {
      affectedRows: 0,
      message: result.text || "Statement executed",
      executedSql: result.executedSql,
    };
  },
};
