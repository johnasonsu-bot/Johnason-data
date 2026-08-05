const hiveService = require("../../../services/hiveService");
const { applyResultLimit, cleanHiveOutput, parseCsvLine, parseTableName, quoteIdentifier, resolveDatasourceHost, resolveRuntimeDatasourceConfig } = require("../data-development.utils");

function resolveConfig(config, databaseName) {
  const resolved = resolveRuntimeDatasourceConfig(config);
  return {
    host: resolveDatasourceHost(resolved.host),
    port: Number(resolved.port || 10000),
    database: databaseName || resolved.databaseName || "default",
    username: resolved.username || "hive",
    password: resolved.password || "hive",
  };
}

async function runHiveSql(config, sql, databaseName, showHeader = false) {
  const resolved = resolveConfig(config, databaseName);
  const payload = [
    "!set silent true",
    `!set showHeader ${showHeader ? "true" : "false"}`,
    "!set outputformat csv2",
    `USE ${quoteIdentifier(resolved.database, "hive")};`,
    String(sql || "").trim().replace(/;+\s*$/, "") + ";",
  ].join("\n");

  const result = await hiveService.runHiveSql(payload, resolved);
  return {
    lines: cleanHiveOutput(result.stdout),
    executedSql: payload,
  };
}

module.exports = {
  async testConnection(config) {
    await runHiveSql(config, "SHOW DATABASES", config.databaseName, false);
    return { success: true, message: "Hive connection succeeded" };
  },

  async getDatabases(config) {
    const result = await runHiveSql(config, "SHOW DATABASES", config.databaseName, false);
    return result.lines.map((name) => ({ name }));
  },

  async getTables(config, databaseName) {
    const result = await runHiveSql(config, "SHOW TABLES", databaseName, false);
    return result.lines.map((name) => ({ name, type: "BASE TABLE", comment: null }));
  },

  async getColumns(config, databaseName, tableName) {
    const parsed = parseTableName(tableName, databaseName || config.databaseName || "default");
    const result = await runHiveSql(config, `DESCRIBE ${quoteIdentifier(parsed.table, "hive")}`, parsed.scope, false);
    return result.lines
      .filter((line) => line.includes(","))
      .map((line, index) => {
        const [name, type] = line.split(",");
        return {
          name: String(name || "").trim(),
          position: index + 1,
          dataType: String(type || "").trim(),
          columnType: String(type || "").trim(),
          nullable: true,
          primaryKey: false,
          defaultValue: null,
        };
      })
      .filter((item) => item.name && !item.name.startsWith("#"));
  },

  async getFunctions() {
    return [];
  },

  async executeQuery(config, sql, options = {}) {
    const resolvedSql = applyResultLimit(sql, options.resultLimit, "hive");
    const result = await runHiveSql(config, resolvedSql, options.databaseName || config.databaseName, true);
    const [headerLine, ...dataLines] = result.lines.filter((line) => line.includes(","));
    const fields = headerLine ? parseCsvLine(headerLine) : [];
    const rows = dataLines.map((line) => {
      const values = parseCsvLine(line);
      return Object.fromEntries(fields.map((field, index) => [field, values[index] ?? null]));
    });

    return {
      fields,
      rows,
      rowCount: rows.length,
      executedSql: result.executedSql,
    };
  },

  async executeStatement(config, sql, options = {}) {
    const result = await runHiveSql(config, sql, options.databaseName || config.databaseName, false);
    return {
      affectedRows: 0,
      message: result.lines.join("\n") || "Statement executed",
      executedSql: result.executedSql,
    };
  },
};
