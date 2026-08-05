const mysql = require("mysql2/promise");
const AppError = require("../../common/errors/app-error");
const hiveService = require("../../services/hiveService");
const {
  inferDatasourceDialect,
  normalizeDatasourceType,
  resolveDatasourceConnection,
} = require("../../common/utils/datasource-dialect");
const { createPostgresLikeClient } = require("../../common/utils/db-client");
const { getAdapter } = require("../data-development/adapters");
const { getManagedBinding } = require("../../common/utils/managed-jdbc-runtime");

const POSTGRESQL = "postgresql";

function usesAdapterRuntime(sourceType) {
  return ["oracle", "dm"].includes(sourceType) || Boolean(getManagedBinding(sourceType));
}

function resolveAdapterScope(dataSource, sourceType) {
  const config = normalizeConnectionConfig(dataSource);
  return ["oracle", "dm"].includes(sourceType)
    ? (dataSource?.connectionConfig?.schema || config.user)
    : config.database;
}

function normalizeSourceType(sourceType, connectionConfig = {}) {
  const normalized = normalizeDatasourceType(sourceType || "mysql");
  if (normalized === "gaussdb") {
    return POSTGRESQL;
  }

  const dialect = inferDatasourceDialect(normalized, connectionConfig);
  return dialect === "unknown" ? normalized || "mysql" : dialect;
}

function isPostgreSqlSource(sourceType, connectionConfig = {}) {
  return normalizeSourceType(sourceType, connectionConfig) === POSTGRESQL;
}

function isHiveSource(sourceType, connectionConfig = {}) {
  return normalizeSourceType(sourceType, connectionConfig) === "hive";
}

function escapeIdentifier(identifier, sourceType = "mysql") {
  const normalized = normalizeSourceType(sourceType);
  const quote = [POSTGRESQL, "oracle", "dm"].includes(normalized) ? '"' : "`";
  return String(identifier || "")
    .split(".")
    .filter(Boolean)
    .map((part) => `${quote}${String(part).replace(new RegExp(quote, "g"), quote.repeat(2))}${quote}`)
    .join(".");
}

function escapeValue(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (value instanceof Date) {
    return `'${formatDateTimeForSql(value)}'`;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new AppError("不支持写入非有限数值", 400);
    }
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (Buffer.isBuffer(value)) {
    return `'\\x${value.toString("hex")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function formatDateTimeForSql(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  const millisecond = String(date.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}.${millisecond}`;
}

function normalizeConnectionConfig(dataSource) {
  const connectionConfig = dataSource?.connectionConfig || {};
  const resolved = resolveDatasourceConnection(dataSource?.sourceType, connectionConfig);
  return {
    sourceType: resolved.dialect,
    host: resolved.host,
    port: Number(resolved.port || 0),
    database: resolved.database,
    schema: resolved.schema || "public",
    user: resolved.username,
    password: resolved.password,
    jdbcUrl: resolved.jdbcUrl,
    driverClassName: resolved.driverClassName || null,
  };
}

function cleanHiveCliOutput(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== "No such file or directory")
    .filter((line) => !line.startsWith("SLF4J:"))
    .filter((line) => !line.startsWith("[WARN]"))
    .filter((line) => !line.startsWith("Connecting to "))
    .filter((line) => !line.startsWith("Connected to:"))
    .filter((line) => !line.startsWith("Driver:"))
    .filter((line) => !line.startsWith("Transaction isolation:"))
    .filter((line) => !line.startsWith("Closing:"))
    .filter((line) => !line.startsWith("Beeline version"))
    .filter((line) => !line.startsWith("0: jdbc:hive2://"));
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

async function listHiveTables(dataSource) {
  const config = normalizeConnectionConfig(dataSource);
  const sql = [
    "!set silent true",
    "!set showHeader false",
    "!set outputformat csv2",
    `USE ${escapeIdentifier(config.database || "default", "hive")};`,
    "SHOW TABLES;"
  ].join("\n");
  const result = await hiveService.runHiveSql(sql, {
    host: config.host,
    port: config.port,
    database: config.database || "default",
    username: config.user || "hive",
    password: config.password || "hive"
  });

  return cleanHiveCliOutput(result.stdout)
    .filter((tableName) => !tableName.startsWith("__medata_stage_"))
    .filter((tableName) => !tableName.startsWith("+"))
    .filter((tableName) => !tableName.startsWith("|"))
    .map((tableName) => ({
      tableName,
      tableType: "BASE TABLE",
      tableComment: ""
    }));
}

async function listHiveColumns(dataSource, tableName) {
  const config = normalizeConnectionConfig(dataSource);
  const sql = [
    "!set silent true",
    "!set showHeader false",
    "!set outputformat csv2",
    `USE ${escapeIdentifier(config.database || "default", "hive")};`,
    `DESCRIBE ${escapeIdentifier(tableName, "hive")};`
  ].join("\n");
  const result = await hiveService.runHiveSql(sql, {
    host: config.host,
    port: config.port,
    database: config.database || "default",
    username: config.user || "hive",
    password: config.password || "hive"
  });

  return cleanHiveCliOutput(result.stdout)
    .filter((line) => line.includes(","))
    .map((line, index) => {
      const [columnName, columnType] = line.split(",");
      return {
        columnName: String(columnName || "").trim(),
        ordinalPosition: index + 1,
        dataType: String(columnType || "").trim(),
        columnType: String(columnType || "").trim(),
        isNullable: true,
        isPrimaryKey: false,
        columnDefault: null,
        extra: "",
        columnComment: ""
      };
    })
    .filter((column) => column.columnName && !column.columnName.startsWith("#"));
}

async function sampleHiveRows(dataSource, tableName, limit = 100) {
  const config = normalizeConnectionConfig(dataSource);
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 100)));
  const sql = [
    "!set silent true",
    "!set showHeader false",
    "!set outputformat csv2",
    `USE ${escapeIdentifier(config.database || "default", "hive")};`,
    `SELECT * FROM ${escapeIdentifier(tableName, "hive")} LIMIT ${safeLimit};`
  ].join("\n");
  const columns = await listHiveColumns(dataSource, tableName);
  const result = await hiveService.runHiveSql(sql, {
    host: config.host,
    port: config.port,
    database: config.database || "default",
    username: config.user || "hive",
    password: config.password || "hive"
  });
  const lines = cleanHiveCliOutput(result.stdout).filter((line) => line.includes(","));

  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      columns.map((column, index) => [
        column.columnName,
        sanitizeSampleRow({ value: values[index] ?? null }).value
      ])
    );
  });
}

function parseQualifiedTableName(dataSource, tableName = "") {
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  const normalized = String(tableName || "").trim();
  const parts = normalized.split(".").filter(Boolean);

  if (isPostgreSqlSource(sourceType) || ["oracle", "dm"].includes(sourceType)) {
    if (parts.length >= 2) {
      return {
        schema: parts[parts.length - 2].replace(/"/g, ""),
        tableName: parts[parts.length - 1].replace(/"/g, "")
      };
    }
    return {
      schema: normalizeConnectionConfig(dataSource).schema,
      tableName: normalized.replace(/"/g, "")
    };
  }

  if (parts.length >= 2) {
    return {
      database: parts[parts.length - 2].replace(/`/g, ""),
      tableName: parts[parts.length - 1].replace(/`/g, "")
    };
  }

  return {
    database: normalizeConnectionConfig(dataSource).database,
    tableName: normalized.replace(/`/g, "")
  };
}

function buildQualifiedTableName(dataSource, tableName) {
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  const parsed = parseQualifiedTableName(dataSource, tableName);

  if (isPostgreSqlSource(sourceType) || ["oracle", "dm"].includes(sourceType)) {
    return `${parsed.schema}.${parsed.tableName}`;
  }

  return parsed.database ? `${parsed.database}.${parsed.tableName}` : parsed.tableName;
}

function formatDefaultValue(sourceType, columnDefault) {
  if (columnDefault === null || columnDefault === undefined) {
    return null;
  }

  const normalized = String(columnDefault).trim();
  if (!normalized) {
    return null;
  }
  if (/^current_timestamp(?:\(\))?$/i.test(normalized) || /^now\(\)$/i.test(normalized)) {
    return "CURRENT_TIMESTAMP";
  }
  if (/^null(?:::.*)?$/i.test(normalized) || (isPostgreSqlSource(sourceType) && /^nextval\(/i.test(normalized))) {
    return null;
  }
  return escapeValue(columnDefault);
}

function normalizeExtra(extra, sourceType = "mysql") {
  if (!extra) {
    return "";
  }
  const normalized = String(extra)
    .split(" ")
    .filter(Boolean)
    .filter((part) => part.toUpperCase() !== "DEFAULT_GENERATED")
    .join(" ");
  return isPostgreSqlSource(sourceType) ? normalized.toUpperCase() : normalized;
}

function normalizeDefaultValueForCompare(columnDefault) {
  if (columnDefault === null || columnDefault === undefined || columnDefault === "") {
    return null;
  }
  const normalized = String(columnDefault).trim();
  if (!normalized || /^null(?:::.*)?$/i.test(normalized) || /^nextval\(/i.test(normalized)) {
    return null;
  }
  if (/^current_timestamp(?:\(\))?$/i.test(normalized) || /^now\(\)$/i.test(normalized)) {
    return "CURRENT_TIMESTAMP";
  }
  return normalized;
}

function normalizePostgreSqlColumnDefault(columnDefault) {
  if (columnDefault === null || columnDefault === undefined) {
    return null;
  }
  const normalized = String(columnDefault).trim();
  if (!normalized || /^null(?:::.*)?$/i.test(normalized) || /^nextval\(/i.test(normalized)) {
    return null;
  }
  if (/^current_timestamp(?:\(\))?$/i.test(normalized) || /^now\(\)$/i.test(normalized)) {
    return "CURRENT_TIMESTAMP";
  }
  const typedStringMatch = normalized.match(/^'(.*)'::/s);
  if (typedStringMatch) {
    return typedStringMatch[1].replace(/''/g, "'");
  }
  const typedNumberMatch = normalized.match(/^(-?\d+(?:\.\d+)?)::/);
  if (typedNumberMatch) {
    return typedNumberMatch[1];
  }
  return normalized;
}

function parseColumnTypeDefinition(columnType) {
  const normalized = String(columnType || "").trim().toLowerCase();
  const match = normalized.match(/^([a-z ]+?)(?:\(([^)]+)\))?$/);
  if (!match) {
    return { baseType: normalized, args: [] };
  }
  return {
    baseType: match[1].trim(),
    args: match[2] ? match[2].split(",").map((item) => item.trim()) : []
  };
}

function buildColumnDefinitionSql(sourceType, column) {
  let definition = `${escapeIdentifier(column.columnName, sourceType)} ${column.columnType}`;
  if (!column.isNullable) {
    definition += " NOT NULL";
  }
  const formattedDefault = formatDefaultValue(sourceType, column.columnDefault);
  if (formattedDefault !== null) {
    definition += ` DEFAULT ${formattedDefault}`;
  }
  const extra = normalizeExtra(column.extra, sourceType);
  if (extra) {
    definition += ` ${extra}`;
  }
  if (sourceType === "mysql" && column.columnComment) {
    definition += ` COMMENT ${escapeValue(String(column.columnComment || ""))}`;
  }
  return definition;
}

function buildCreateTableSql(dataSource, tableName, columns, options = {}) {
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
  const columnSql = columns.map((column) => buildColumnDefinitionSql(sourceType, column));
  const primaryKeys = columns
    .filter((column) => column.isPrimaryKey)
    .map((column) => escapeIdentifier(column.columnName, sourceType));

  if (primaryKeys.length > 0) {
    columnSql.push(`PRIMARY KEY (${primaryKeys.join(", ")})`);
  }

  let sql = `CREATE TABLE ${qualifiedTable} (\n${columnSql.join(",\n")}\n)`;
  if (sourceType === "mysql" && options.tableComment) {
    sql += ` COMMENT=${escapeValue(String(options.tableComment || ""))}`;
  }
  return sql;
}

async function applyTableAndColumnComments(connection, dataSource, tableName, columns, options = {}) {
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
  const tableComment = String(options.tableComment || "").trim();

  if (sourceType === "mysql") {
    if (tableComment) {
      await executeQuery(connection, sourceType, `ALTER TABLE ${qualifiedTable} COMMENT = ${escapeValue(tableComment)}`);
    }
    return;
  }

  if (sourceType === POSTGRESQL) {
    if (tableComment) {
      await executeQuery(connection, sourceType, `COMMENT ON TABLE ${qualifiedTable} IS ${escapeValue(tableComment)}`);
    }
    for (const column of Array.isArray(columns) ? columns : []) {
      if (!column?.columnName) continue;
      const qualifiedColumn = escapeIdentifier(column.columnName, sourceType);
      const comment = String(column.columnComment || "").trim();
      await executeQuery(
        connection,
        sourceType,
        `COMMENT ON COLUMN ${qualifiedTable}.${qualifiedColumn} IS ${comment ? escapeValue(comment) : "NULL"}`
      );
    }
  }
}

function isColumnEquivalent(existingColumn, expectedColumn, sourceType = "mysql") {
  return (
    String(existingColumn.columnName) === String(expectedColumn.columnName) &&
    String(existingColumn.columnType || "").toLowerCase() === String(expectedColumn.columnType || "").toLowerCase() &&
    Boolean(existingColumn.isNullable) === Boolean(expectedColumn.isNullable) &&
    Boolean(existingColumn.isPrimaryKey) === Boolean(expectedColumn.isPrimaryKey) &&
    normalizeDefaultValueForCompare(existingColumn.columnDefault) ===
      normalizeDefaultValueForCompare(expectedColumn.columnDefault) &&
    normalizeExtra(existingColumn.extra, sourceType).toLowerCase() ===
      normalizeExtra(expectedColumn.extra, sourceType).toLowerCase()
  );
}

function getPrimaryKeyColumns(columns) {
  return columns.filter((column) => column.isPrimaryKey).map((column) => column.columnName);
}

function arePrimaryKeysEquivalent(existingColumns, expectedColumns) {
  const existingPrimaryKeys = getPrimaryKeyColumns(existingColumns);
  const expectedPrimaryKeys = getPrimaryKeyColumns(expectedColumns);
  return existingPrimaryKeys.length === expectedPrimaryKeys.length &&
    existingPrimaryKeys.every((columnName, index) => columnName === expectedPrimaryKeys[index]);
}

function getColumnSyncPlan(existingColumns, expectedColumns, sourceType = "mysql") {
  const existingColumnMap = new Map(existingColumns.map((column) => [column.columnName, column]));
  const additions = [];
  const modifications = [];

  for (const expectedColumn of expectedColumns) {
    const existingColumn = existingColumnMap.get(expectedColumn.columnName);
    if (!existingColumn) {
      additions.push(expectedColumn);
      continue;
    }
    if (!isColumnEquivalent(existingColumn, expectedColumn, sourceType)) {
      modifications.push(expectedColumn);
    }
  }

  return {
    additions,
    modifications,
    primaryKeyChanged: !arePrimaryKeysEquivalent(existingColumns, expectedColumns)
  };
}

function buildFriendlyAlterError(error, tableName) {
  if (error instanceof AppError) {
    return error;
  }
  if (error?.code === "ER_INVALID_USE_OF_NULL" || error?.code === "23502") {
    return new AppError(`目标表 ${tableName} 存在空值数据，无法收紧为 NOT NULL，请先清洗数据后再保存`, 400);
  }
  if (error?.code === "ER_DUP_ENTRY" || error?.code === "23505") {
    return new AppError(`目标表 ${tableName} 存在重复数据，无法调整为新的主键约束，请先清洗重复数据后再保存`, 400);
  }
  if (error?.code === "ER_DATA_TOO_LONG" || error?.code === "22001") {
    return new AppError(`目标表 ${tableName} 存在超长数据，无法收缩字段长度，请先处理历史数据后再保存`, 400);
  }
  if (error?.code === "WARN_DATA_TRUNCATED" || error?.code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD" || error?.code === "22P02") {
    return new AppError(`目标表 ${tableName} 中已有数据与新字段类型不兼容，请先清洗数据后再保存`, 400);
  }
  return new AppError(`目标表 ${tableName} 结构同步失败：${error.message || "未知错误"}`, 400);
}

function buildPostgreSqlUsingExpression(columnName, existingColumnType, expectedColumnType) {
  const qualifiedColumn = escapeIdentifier(columnName, POSTGRESQL);
  const existingType = parseColumnTypeDefinition(existingColumnType);
  const expectedType = parseColumnTypeDefinition(expectedColumnType);
  const targetBaseType = expectedType.baseType;
  const targetTypeSql = String(expectedColumnType || "").trim();
  const asTrimmedText = `NULLIF(BTRIM(${qualifiedColumn}::text), '')`;

  if (["timestamp", "timestamp without time zone", "timestamp with time zone"].includes(targetBaseType)) {
    return `${asTrimmedText}::${targetTypeSql}`;
  }

  if (targetBaseType === "date") {
    return `${asTrimmedText}::date`;
  }

  if (["time", "time without time zone", "time with time zone"].includes(targetBaseType)) {
    return `${asTrimmedText}::${targetTypeSql}`;
  }

  if (["integer", "bigint", "smallint", "numeric", "real", "double precision"].includes(targetBaseType)) {
    return `NULLIF(REPLACE(BTRIM(${qualifiedColumn}::text), ',', ''), '')::${targetTypeSql}`;
  }

  if (targetBaseType === "boolean") {
    return `CASE
      WHEN ${asTrimmedText} IS NULL THEN NULL
      WHEN LOWER(BTRIM(${qualifiedColumn}::text)) IN ('true', 't', '1', 'yes', 'y') THEN TRUE
      WHEN LOWER(BTRIM(${qualifiedColumn}::text)) IN ('false', 'f', '0', 'no', 'n') THEN FALSE
      ELSE NULL
    END`;
  }

  if (["json", "jsonb", "uuid"].includes(targetBaseType)) {
    return `${asTrimmedText}::${targetTypeSql}`;
  }

  if (["text", "character varying", "varchar"].includes(targetBaseType)) {
    return `${qualifiedColumn}::${targetTypeSql}`;
  }

  return null;
}

async function createPostgreSqlClient(dataSource) {
  const config = normalizeConnectionConfig(dataSource);
  const client = createPostgresLikeClient({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    username: config.user,
    password: config.password,
    connectionTimeoutMillis: 5000
  }, {
    sourceType: dataSource?.sourceType,
  });
  await client.connect();
  return client;
}

async function withConnection(dataSource, handler) {
  if (!dataSource) {
    throw new AppError("数据源不存在", 404);
  }

  const sourceType = normalizeSourceType(dataSource.sourceType, dataSource.connectionConfig);
  const config = normalizeConnectionConfig(dataSource);

  if (sourceType === "mysql") {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      connectTimeout: 5000
    });
    try {
      return await handler(connection, sourceType);
    } finally {
      await connection.end();
    }
  }

  if (sourceType === POSTGRESQL) {
    const client = await createPostgreSqlClient(dataSource);
    try {
      return await handler(client, sourceType);
    } finally {
      await client.end();
    }
  }

  throw new AppError("当前仅支持 MySQL / PostgreSQL 数据源的元数据探查", 400);
}

async function executeQuery(connection, sourceType, sql, params = []) {
  if (sourceType === "mysql") {
    const [rows] = await connection.query(sql, params);
    return rows;
  }
  const result = await connection.query(sql, params);
  return result.rows;
}

async function listTables(dataSource) {
  if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
    return listHiveTables(dataSource);
  }
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  if (usesAdapterRuntime(sourceType)) {
    const adapter = getAdapter(sourceType);
    const config = { ...(dataSource?.connectionConfig || {}), sourceType };
    const rows = await adapter.getTables(config, resolveAdapterScope(dataSource, sourceType));
    return rows.map((row) => ({ tableName: row.name, tableType: row.type, tableComment: row.comment || "" }));
  }

  return withConnection(dataSource, async (connection, sourceType) => {
    if (sourceType === "mysql") {
      const databaseName = normalizeConnectionConfig(dataSource).database;
      return executeQuery(
        connection,
        sourceType,
        `SELECT table_name AS tableName, table_type AS tableType, table_comment AS tableComment
         FROM information_schema.tables
         WHERE table_schema = ?
         ORDER BY table_name ASC`,
        [databaseName]
      );
    }

    const { database, schema } = normalizeConnectionConfig(dataSource);
    return executeQuery(
      connection,
      sourceType,
      `SELECT table_name AS "tableName",
              table_type AS "tableType",
              COALESCE(obj_description(format('%I.%I', table_schema, table_name)::regclass, 'pg_class'), '') AS "tableComment"
       FROM information_schema.tables
       WHERE table_catalog = $1
         AND table_schema = $2
         AND table_type IN ('BASE TABLE', 'VIEW')
       ORDER BY table_name ASC`,
      [database, schema]
    );
  });
}

async function listColumns(dataSource, tableName) {
  if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
    return listHiveColumns(dataSource, tableName);
  }
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  if (usesAdapterRuntime(sourceType)) {
    const adapter = getAdapter(sourceType);
    const config = { ...(dataSource?.connectionConfig || {}), sourceType };
    const rows = await adapter.getColumns(config, resolveAdapterScope(dataSource, sourceType), tableName);
    return rows.map((row) => ({
      columnName: row.name,
      ordinalPosition: row.position,
      dataType: row.dataType,
      columnType: row.columnType,
      isNullable: row.nullable,
      isPrimaryKey: row.primaryKey,
      columnDefault: row.defaultValue,
      columnComment: row.comment || "",
    }));
  }

  return withConnection(dataSource, async (connection, sourceType) => {
    const parsed = parseQualifiedTableName(dataSource, tableName);
    if (sourceType === "mysql") {
      const rows = await executeQuery(
        connection,
        sourceType,
        `SELECT column_name AS columnName,
                ordinal_position AS ordinalPosition,
                data_type AS dataType,
                column_type AS columnType,
                is_nullable AS isNullable,
                column_default AS columnDefault,
                column_key AS columnKey,
                extra AS extra,
                column_comment AS columnComment
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ordinal_position ASC`,
        [parsed.database, parsed.tableName]
      );

      return rows.map((row) => ({
        ...row,
        isNullable: row.isNullable === "YES",
        isPrimaryKey: row.columnKey === "PRI"
      }));
    }

    const { database } = normalizeConnectionConfig(dataSource);
    const rows = await executeQuery(
      connection,
      sourceType,
      `SELECT c.column_name AS "columnName",
              c.ordinal_position AS "ordinalPosition",
              c.data_type AS "dataType",
              pg_catalog.format_type(a.atttypid, a.atttypmod) AS "columnType",
              c.is_nullable AS "isNullable",
              c.column_default AS "columnDefault",
              CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS "isPrimaryKey",
              COALESCE(pg_catalog.col_description(cls.oid, a.attnum), '') AS "columnComment"
       FROM information_schema.columns c
       JOIN pg_catalog.pg_class cls ON cls.relname = c.table_name
       JOIN pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace AND ns.nspname = c.table_schema
       JOIN pg_catalog.pg_attribute a ON a.attrelid = cls.oid AND a.attname = c.column_name
       LEFT JOIN (
         SELECT kcu.table_schema, kcu.table_name, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
          AND tc.table_name = kcu.table_name
         WHERE tc.constraint_type = 'PRIMARY KEY'
       ) pk
         ON pk.table_schema = c.table_schema
        AND pk.table_name = c.table_name
        AND pk.column_name = c.column_name
       WHERE c.table_catalog = $1
         AND c.table_schema = $2
         AND c.table_name = $3
       ORDER BY c.ordinal_position ASC`,
      [database, parsed.schema, parsed.tableName]
    );

    return rows.map((row) => ({
      ...row,
      isNullable: row.isNullable === "YES",
      isPrimaryKey: Boolean(row.isPrimaryKey),
      columnDefault: normalizePostgreSqlColumnDefault(row.columnDefault),
      extra: ""
    }));
  });
}

function groupIndexes(rows) {
  const grouped = new Map();

  for (const row of rows) {
    if (!grouped.has(row.indexName)) {
      grouped.set(row.indexName, {
        indexName: row.indexName,
        unique: row.nonUnique === 0 || row.nonUnique === false,
        indexType: row.indexType,
        cardinality: row.cardinality,
        columns: []
      });
    }

    if (row.columnName) {
      grouped.get(row.indexName).columns.push(row.columnName);
    }
  }

  return Array.from(grouped.values());
}

async function listIndexes(dataSource, tableName) {
  if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
    return [];
  }
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  if (usesAdapterRuntime(sourceType)) {
    const config = { ...(dataSource?.connectionConfig || {}), sourceType };
    return getAdapter(sourceType).getIndexes(config, resolveAdapterScope(dataSource, sourceType), tableName);
  }

  return withConnection(dataSource, async (connection, sourceType) => {
    const parsed = parseQualifiedTableName(dataSource, tableName);

    if (sourceType === "mysql") {
      const rows = await executeQuery(
        connection,
        sourceType,
        `SELECT index_name AS indexName,
                non_unique AS nonUnique,
                seq_in_index AS seqInIndex,
                column_name AS columnName,
                index_type AS indexType,
                cardinality AS cardinality
         FROM information_schema.statistics
         WHERE table_schema = ? AND table_name = ?
         ORDER BY index_name ASC, seq_in_index ASC`,
        [parsed.database, parsed.tableName]
      );

      return groupIndexes(rows);
    }

    const rows = await executeQuery(
      connection,
      sourceType,
      `SELECT idx.relname AS "indexName",
              NOT ix.indisunique AS "nonUnique",
              ord."seqInIndex" AS "seqInIndex",
              pg_get_indexdef(idx.oid, ord."seqInIndex", TRUE) AS "columnName",
              am.amname AS "indexType"
       FROM pg_class tbl
       JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
       JOIN pg_index ix ON ix.indrelid = tbl.oid
       JOIN pg_class idx ON idx.oid = ix.indexrelid
       JOIN pg_am am ON am.oid = idx.relam
       LEFT JOIN (
         SELECT generate_series(1, 64) AS "seqInIndex"
       ) ord
         ON ord."seqInIndex" <= COALESCE(array_length(string_to_array(ix.indkey::text, ' '), 1), 0)
       WHERE ns.nspname = $1
         AND tbl.relname = $2
       ORDER BY idx.relname ASC, ord."seqInIndex" ASC`,
      [parsed.schema, parsed.tableName]
    );

    return groupIndexes(rows);
  });
}

function groupConstraints(rows) {
  const grouped = new Map();

  for (const row of rows) {
    if (!grouped.has(row.constraintName)) {
      grouped.set(row.constraintName, {
        constraintName: row.constraintName,
        constraintType: row.constraintType,
        columns: [],
        references: []
      });
    }

    const item = grouped.get(row.constraintName);
    if (row.columnName) {
      item.columns.push(row.columnName);
    }
    if (row.referencedTableName && row.referencedColumnName) {
      item.references.push({
        tableName: row.referencedTableName,
        columnName: row.referencedColumnName
      });
    }
  }

  return Array.from(grouped.values());
}

async function listConstraints(dataSource, tableName) {
  if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
    return [];
  }
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  if (usesAdapterRuntime(sourceType)) {
    const config = { ...(dataSource?.connectionConfig || {}), sourceType };
    return getAdapter(sourceType).getConstraints(config, resolveAdapterScope(dataSource, sourceType), tableName);
  }

  return withConnection(dataSource, async (connection, sourceType) => {
    const parsed = parseQualifiedTableName(dataSource, tableName);

    if (sourceType === "mysql") {
      const rows = await executeQuery(
        connection,
        sourceType,
        `SELECT tc.constraint_name AS constraintName,
                tc.constraint_type AS constraintType,
                kcu.column_name AS columnName,
                kcu.referenced_table_name AS referencedTableName,
                kcu.referenced_column_name AS referencedColumnName,
                kcu.ordinal_position AS ordinalPosition
         FROM information_schema.table_constraints tc
         LEFT JOIN information_schema.key_column_usage kcu
           ON tc.constraint_schema = kcu.constraint_schema
          AND tc.table_name = kcu.table_name
          AND tc.constraint_name = kcu.constraint_name
         WHERE tc.table_schema = ? AND tc.table_name = ?
         ORDER BY tc.constraint_name ASC, kcu.ordinal_position ASC`,
        [parsed.database, parsed.tableName]
      );

      return groupConstraints(rows);
    }

    const { database } = normalizeConnectionConfig(dataSource);
    const rows = await executeQuery(
      connection,
      sourceType,
      `SELECT tc.constraint_name AS "constraintName",
              tc.constraint_type AS "constraintType",
              kcu.column_name AS "columnName",
              ccu.table_name AS "referencedTableName",
              ccu.column_name AS "referencedColumnName",
              kcu.ordinal_position AS "ordinalPosition"
       FROM information_schema.table_constraints tc
       LEFT JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
       LEFT JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
       WHERE tc.table_catalog = $1
         AND tc.table_schema = $2
         AND tc.table_name = $3
       ORDER BY tc.constraint_name ASC, kcu.ordinal_position ASC`,
      [database, parsed.schema, parsed.tableName]
    );

    return groupConstraints(rows);
  });
}

function sanitizeSampleRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value instanceof Date) {
        return [key, value.toISOString()];
      }
      if (Buffer.isBuffer(value)) {
        return [key, `[binary:${value.length}]`];
      }
      if (typeof value === "string") {
        return [key, value.length > 200 ? `${value.slice(0, 200)}...` : value];
      }
      return [key, value];
    })
  );
}

async function sampleRows(dataSource, tableName, limit = 100) {
  if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
    return sampleHiveRows(dataSource, tableName, limit);
  }
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  if (usesAdapterRuntime(sourceType)) {
    const adapter = getAdapter(sourceType);
    const config = { ...(dataSource?.connectionConfig || {}), sourceType };
    const qualified = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
    const result = await adapter.executeQuery(config, `SELECT * FROM ${qualified}`, { resultLimit: limit });
    return (result.rows || []).map((row) => sanitizeSampleRow(row));
  }

  return withConnection(dataSource, async (connection, sourceType) => {
    const safeLimit = Math.max(1, Math.min(100, Number(limit || 100)));
    const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
    const rows = await executeQuery(connection, sourceType, `SELECT * FROM ${qualifiedTable} LIMIT ${safeLimit}`);
    return rows.map((row) => sanitizeSampleRow(row));
  });
}

function addQueryParam(params, value, sourceType) {
  params.push(value);
  if (isPostgreSqlSource(sourceType)) return `$${params.length}`;
  if (normalizeSourceType(sourceType) === "oracle") return `:${params.length}`;
  return "?";
}

function buildSearchWhere(conditionGroups = [], sourceType, params, matchMode = "all") {
  const clauses = [];
  for (const group of conditionGroups) {
    const columns = Array.isArray(group.columns)
      ? group.columns.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const values = Array.isArray(group.values)
      ? group.values.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];
    if (!columns.length || !values.length) continue;

    const placeholdersByColumn = columns.map((columnName) => {
      const columnSql = escapeIdentifier(columnName, sourceType);
      const placeholders = values.map((value) => addQueryParam(params, value, sourceType)).join(", ");
      return `${columnSql} IN (${placeholders})`;
    });
    clauses.push(`(${placeholdersByColumn.join(" OR ")})`);
  }
  return clauses.join(matchMode === "any" ? " OR " : " AND ");
}

async function searchRows(dataSource, tableName, conditionGroups = [], options = {}) {
  if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
    throw new AppError("当前业务数据检索暂不支持 Hive 数据源", 400);
  }
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  if (usesAdapterRuntime(sourceType)) {
    const config = { ...(dataSource?.connectionConfig || {}), sourceType };
    const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
    const countParams = [];
    const countWhere = buildSearchWhere(conditionGroups, sourceType, countParams, options.matchMode || "all");
    if (!countWhere) throw new AppError("业务数据检索缺少有效字段条件", 400);
    const adapter = getAdapter(sourceType);
    const countResult = await adapter.executeQuery(config, `SELECT COUNT(*) AS total FROM ${qualifiedTable} WHERE ${countWhere}`, { binds: countParams });
    const hitCount = Number(countResult.rows?.[0]?.total || countResult.rows?.[0]?.TOTAL || 0);
    if (!hitCount) return { hitCount: 0, rows: [] };
    const rowParams = [];
    const rowWhere = buildSearchWhere(conditionGroups, sourceType, rowParams, options.matchMode || "all");
    const rowResult = await adapter.executeQuery(config, `SELECT * FROM ${qualifiedTable} WHERE ${rowWhere}`, { binds: rowParams, resultLimit: options.limit || 20 });
    return { hitCount, rows: (rowResult.rows || []).map((row) => sanitizeSampleRow(row)) };
  }

  return withConnection(dataSource, async (connection, sourceType) => {
    const safeLimit = Math.max(1, Math.min(100, Number(options.limit || 20)));
    const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
    const countParams = [];
    const countWhere = buildSearchWhere(conditionGroups, sourceType, countParams, options.matchMode || "all");
    if (!countWhere) {
      throw new AppError("业务数据检索缺少有效字段条件", 400);
    }

    const countRows = await executeQuery(
      connection,
      sourceType,
      `SELECT COUNT(*) AS total FROM ${qualifiedTable} WHERE ${countWhere}`,
      countParams
    );
    const hitCount = Number(countRows[0]?.total || countRows[0]?.TOTAL || 0);
    if (hitCount === 0) {
      return { hitCount: 0, rows: [] };
    }

    const rowParams = [];
    const rowWhere = buildSearchWhere(conditionGroups, sourceType, rowParams, options.matchMode || "all");
    const rows = await executeQuery(
      connection,
      sourceType,
      `SELECT * FROM ${qualifiedTable} WHERE ${rowWhere} LIMIT ${safeLimit}`,
      rowParams
    );
    return {
      hitCount,
      rows: rows.map((row) => sanitizeSampleRow(row)),
    };
  });
}

function findTableInfo(tables = [], dataSource, tableName) {
  const parsed = parseQualifiedTableName(dataSource, tableName);
  return tables.find((item) => item.tableName === parsed.tableName) || null;
}

async function inspectTableProfile(dataSource, tableName, options = {}) {
  const [columns, indexes, constraints, samples] = await Promise.all([
    listColumns(dataSource, tableName),
    listIndexes(dataSource, tableName),
    listConstraints(dataSource, tableName),
    sampleRows(dataSource, tableName, options.sampleSize || 100)
  ]);
  const table = options.tableInfo || null;

  return {
    tableName,
    tableComment: table?.tableComment || "",
    columns,
    indexes,
    constraints,
    sampleRows: samples
  };
}

async function inspectTableForRecommendation(dataSource, tableName) {
  const tables = await listTables(dataSource);
  return inspectTableProfile(dataSource, tableName, {
    sampleSize: 100,
    tableInfo: findTableInfo(tables, dataSource, tableName)
  });
}

async function countTableRows(connection, dataSource, tableName) {
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
  const rows = await executeQuery(connection, sourceType, `SELECT COUNT(*) AS total FROM ${qualifiedTable}`);
  return Number(rows[0]?.total || rows[0]?.TOTAL || 0);
}

async function countRows(dataSource, tableName) {
  if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
    return null;
  }
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  if (usesAdapterRuntime(sourceType)) {
    const config = { ...(dataSource?.connectionConfig || {}), sourceType };
    const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
    const result = await getAdapter(sourceType).executeQuery(config, `SELECT COUNT(*) AS total FROM ${qualifiedTable}`);
    return Number(result.rows?.[0]?.total || result.rows?.[0]?.TOTAL || 0);
  }

  return withConnection(dataSource, async (connection) => countTableRows(connection, dataSource, tableName));
}

function buildAdapterEstimateQuery(sourceType, config, parsed) {
  if (sourceType === "mysql") {
    return {
      sql: "SELECT table_rows AS estimatedRows FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1",
      binds: [parsed.database, parsed.tableName],
    };
  }
  if (sourceType === "postgresql") {
    return {
      sql: `SELECT CASE WHEN cls.reltuples < 0 THEN NULL ELSE cls.reltuples END AS "estimatedRows"
               FROM pg_class cls
               JOIN pg_namespace ns ON ns.oid = cls.relnamespace
              WHERE ns.nspname = $1 AND cls.relname = $2
              LIMIT 1`,
      binds: [parsed.schema, parsed.tableName],
    };
  }
  const owner = String(parsed.schema || config.schema || config.username || "").toUpperCase();
  const table = String(parsed.tableName || "").toUpperCase();
  const placeholders = sourceType === "oracle" ? [":1", ":2"] : ["?", "?"];
  return {
    sql: `SELECT num_rows AS estimatedRows FROM all_tables WHERE owner = ${placeholders[0]} AND table_name = ${placeholders[1]}`,
    binds: [owner, table],
  };
}

async function estimateRows(dataSource, tableName) {
  if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
    return null;
  }
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  if (usesAdapterRuntime(sourceType)) {
    const config = { ...(dataSource?.connectionConfig || {}), sourceType };
    const parsed = parseQualifiedTableName(dataSource, tableName);
    const { sql, binds } = buildAdapterEstimateQuery(sourceType, config, parsed);
    const result = await getAdapter(sourceType).executeQuery(config, sql, { binds });
    const value = result.rows?.[0]?.estimatedRows ?? result.rows?.[0]?.ESTIMATEDROWS ?? result.rows?.[0]?.ESTIMATED_ROWS;
    return value === null || value === undefined ? null : Math.round(Number(value));
  }

  return withConnection(dataSource, async (connection, sourceType) => {
    const parsed = parseQualifiedTableName(dataSource, tableName);
    if (sourceType === "mysql") {
      const rows = await executeQuery(
        connection,
        sourceType,
        `SELECT table_rows AS estimatedRows
         FROM information_schema.tables
         WHERE table_schema = ? AND table_name = ?
         LIMIT 1`,
        [parsed.database, parsed.tableName]
      );
      return rows[0]?.estimatedRows === null || rows[0]?.estimatedRows === undefined
        ? null
        : Number(rows[0].estimatedRows);
    }

    const rows = await executeQuery(
      connection,
      sourceType,
      `SELECT CASE WHEN cls.reltuples < 0 THEN NULL ELSE cls.reltuples END AS "estimatedRows"
       FROM pg_class cls
       JOIN pg_namespace ns ON ns.oid = cls.relnamespace
       WHERE ns.nspname = $1 AND cls.relname = $2
       LIMIT 1`,
      [parsed.schema, parsed.tableName]
    );
    return rows[0]?.estimatedRows === null || rows[0]?.estimatedRows === undefined
      ? null
      : Math.round(Number(rows[0].estimatedRows));
  });
}

async function countNullRows(connection, dataSource, tableName, columnName) {
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
  const qualifiedColumn = escapeIdentifier(columnName, sourceType);
  const rows = await executeQuery(
    connection,
    sourceType,
    `SELECT COUNT(*) AS total
     FROM ${qualifiedTable}
     WHERE ${qualifiedColumn} IS NULL`
  );
  return Number(rows[0]?.total || rows[0]?.TOTAL || 0);
}

async function countLengthOverflowRows(connection, dataSource, tableName, columnName, maxLength) {
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
  const qualifiedColumn = escapeIdentifier(columnName, sourceType);
  const rows = await executeQuery(
    connection,
    sourceType,
    `SELECT COUNT(*) AS total
     FROM ${qualifiedTable}
     WHERE ${qualifiedColumn} IS NOT NULL
       AND CHAR_LENGTH(${qualifiedColumn}) > ${Number(maxLength)}`
  );
  return Number(rows[0]?.total || rows[0]?.TOTAL || 0);
}

async function findDuplicatePrimaryKeyGroups(connection, dataSource, tableName, primaryKeyColumns) {
  if (!primaryKeyColumns.length) {
    return 0;
  }

  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
  const keySql = primaryKeyColumns.map((columnName) => escapeIdentifier(columnName, sourceType)).join(", ");
  const whereSql = primaryKeyColumns
    .map((columnName) => `${escapeIdentifier(columnName, sourceType)} IS NOT NULL`)
    .join(" AND ");
  const rows = await executeQuery(
    connection,
    sourceType,
    `SELECT COUNT(*) AS total
     FROM (
       SELECT ${keySql}
       FROM ${qualifiedTable}
       WHERE ${whereSql}
       GROUP BY ${keySql}
       HAVING COUNT(*) > 1
     ) duplicates`
  );

  return Number(rows[0]?.total || rows[0]?.TOTAL || 0);
}

async function precheckSyncPlan(connection, dataSource, tableName, existingColumns, expectedColumns, plan) {
  const tableRowCount = await countTableRows(connection, dataSource, tableName);
  const existingColumnMap = new Map(existingColumns.map((column) => [column.columnName, column]));
  const lengthSensitiveTypes = ["varchar", "char", "character varying", "character"];

  for (const column of plan.additions) {
    const hasDefaultValue = normalizeDefaultValueForCompare(column.columnDefault) !== null;
    if (!column.isNullable && !hasDefaultValue && tableRowCount > 0) {
      throw new AppError(
        `目标表 ${tableName} 已有 ${tableRowCount} 条数据，新增必填字段 ${column.columnName} 时必须先提供默认值或允许为空`,
        400,
        { field: column.columnName, reason: "required_column_without_default" }
      );
    }
  }

  for (const column of plan.modifications) {
    const existingColumn = existingColumnMap.get(column.columnName);
    if (!existingColumn) {
      continue;
    }

    if (existingColumn.isNullable && !column.isNullable) {
      const nullCount = await countNullRows(connection, dataSource, tableName, column.columnName);
      if (nullCount > 0) {
        throw new AppError(
          `目标字段 ${column.columnName} 现有 ${nullCount} 条空值数据，无法改为 NOT NULL，请先清洗数据`,
          400,
          { field: column.columnName, reason: "null_values_exist", count: nullCount }
        );
      }
    }

    const existingType = parseColumnTypeDefinition(existingColumn.columnType);
    const expectedType = parseColumnTypeDefinition(column.columnType);
    if (lengthSensitiveTypes.includes(existingType.baseType) && lengthSensitiveTypes.includes(expectedType.baseType)) {
      const existingLength = Number(existingType.args[0] || 0);
      const expectedLength = Number(expectedType.args[0] || 0);
      if (existingLength > 0 && expectedLength > 0 && expectedLength < existingLength) {
        const overflowCount = await countLengthOverflowRows(connection, dataSource, tableName, column.columnName, expectedLength);
        if (overflowCount > 0) {
          throw new AppError(
            `目标字段 ${column.columnName} 有 ${overflowCount} 条数据长度超过 ${expectedLength}，无法收缩字段长度`,
            400,
            { field: column.columnName, reason: "value_too_long", count: overflowCount, maxLength: expectedLength }
          );
        }
      }
    }
  }

  if (plan.primaryKeyChanged) {
    const expectedPrimaryKeys = getPrimaryKeyColumns(expectedColumns);
    for (const columnName of expectedPrimaryKeys) {
      const nullCount = await countNullRows(connection, dataSource, tableName, columnName);
      if (nullCount > 0) {
        throw new AppError(
          `目标主键字段 ${columnName} 存在 ${nullCount} 条空值数据，无法设置主键`,
          400,
          { field: columnName, reason: "primary_key_null_values", count: nullCount }
        );
      }
    }

    const duplicateGroups = await findDuplicatePrimaryKeyGroups(connection, dataSource, tableName, expectedPrimaryKeys);
    if (duplicateGroups > 0) {
      throw new AppError(
        `目标表 ${tableName} 在新主键组合上存在 ${duplicateGroups} 组重复数据，无法设置主键`,
        400,
        { fields: expectedPrimaryKeys, reason: "primary_key_duplicates", count: duplicateGroups }
      );
    }
  }
}

async function createTableFromColumns(dataSource, tableName, columns, options = {}) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new AppError("无法创建目标表，来源表缺少字段定义", 400);
  }

  return withConnection(dataSource, async (connection, sourceType) => {
    await executeQuery(connection, sourceType, buildCreateTableSql(dataSource, tableName, columns, options));
    await applyTableAndColumnComments(connection, dataSource, tableName, columns, options);
    return { tableName, created: true };
  });
}

async function getExistingColumns(connection, dataSource, tableName) {
  const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
  if (sourceType === "mysql") {
    const parsed = parseQualifiedTableName(dataSource, tableName);
    const rows = await executeQuery(
      connection,
      sourceType,
      `SELECT column_name AS columnName,
              ordinal_position AS ordinalPosition,
              data_type AS dataType,
              column_type AS columnType,
              is_nullable AS isNullable,
              column_default AS columnDefault,
              column_key AS columnKey,
              extra AS extra,
              column_comment AS columnComment
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ?
       ORDER BY ordinal_position ASC`,
      [parsed.database, parsed.tableName]
    );

    return rows.map((row) => ({
      ...row,
      isNullable: row.isNullable === "YES",
      isPrimaryKey: row.columnKey === "PRI"
    }));
  }

  return listColumns(dataSource, tableName);
}

async function syncTableColumnsMySql(connection, dataSource, tableName, columns, options = {}) {
  const existingColumns = await getExistingColumns(connection, dataSource, tableName);
  const plan = getColumnSyncPlan(existingColumns, columns, "mysql");
  const changes = [];

  await precheckSyncPlan(connection, dataSource, tableName, existingColumns, columns, plan);

  try {
    const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), "mysql");

    for (const column of plan.additions) {
      await executeQuery(connection, "mysql", `ALTER TABLE ${qualifiedTable} ADD COLUMN ${buildColumnDefinitionSql("mysql", column)}`);
      changes.push(`add:${column.columnName}`);
    }

    for (const column of plan.modifications) {
      await executeQuery(connection, "mysql", `ALTER TABLE ${qualifiedTable} MODIFY COLUMN ${buildColumnDefinitionSql("mysql", column)}`);
      changes.push(`modify:${column.columnName}`);
    }

    if (plan.primaryKeyChanged) {
      const existingPrimaryKeys = getPrimaryKeyColumns(existingColumns);
      const expectedPrimaryKeys = getPrimaryKeyColumns(columns);

      if (existingPrimaryKeys.length > 0) {
        await executeQuery(connection, "mysql", `ALTER TABLE ${qualifiedTable} DROP PRIMARY KEY`);
        changes.push("drop_primary_key");
      }

      if (expectedPrimaryKeys.length > 0) {
        await executeQuery(
          connection,
          "mysql",
          `ALTER TABLE ${qualifiedTable} ADD PRIMARY KEY (${expectedPrimaryKeys
            .map((columnName) => escapeIdentifier(columnName, "mysql"))
            .join(", ")})`
        );
        changes.push(`add_primary_key:${expectedPrimaryKeys.join(",")}`);
      }
    }
  } catch (error) {
    throw buildFriendlyAlterError(error, tableName);
  }

  await applyTableAndColumnComments(connection, dataSource, tableName, columns, options);
  return { tableName, synced: changes.length > 0, changes };
}

async function getPostgreSqlPrimaryKeyConstraintName(connection, dataSource, tableName) {
  const parsed = parseQualifiedTableName(dataSource, tableName);
  const rows = await executeQuery(
    connection,
    POSTGRESQL,
    `SELECT tc.constraint_name AS "constraintName"
     FROM information_schema.table_constraints tc
     WHERE tc.table_schema = $1
       AND tc.table_name = $2
       AND tc.constraint_type = 'PRIMARY KEY'
     LIMIT 1`,
    [parsed.schema, parsed.tableName]
  );

  return rows[0]?.constraintName || null;
}

async function applyPostgreSqlColumnAlterations(connection, dataSource, tableName, column) {
  const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), POSTGRESQL);
  const qualifiedColumn = escapeIdentifier(column.columnName, POSTGRESQL);
  const existingColumns = await getExistingColumns(connection, dataSource, tableName);
  const existingColumn = existingColumns.find((item) => item.columnName === column.columnName);
  const usingExpression = existingColumn
    ? buildPostgreSqlUsingExpression(column.columnName, existingColumn.columnType, column.columnType)
    : null;
  const statements = [
    `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} TYPE ${column.columnType}${usingExpression ? ` USING ${usingExpression}` : ""}`,
    column.isNullable
      ? `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} DROP NOT NULL`
      : `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} SET NOT NULL`
  ];

  const formattedDefault = formatDefaultValue(POSTGRESQL, column.columnDefault);
  statements.push(
    formattedDefault === null
      ? `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} DROP DEFAULT`
      : `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} SET DEFAULT ${formattedDefault}`
  );

  for (const sql of statements) {
    await executeQuery(connection, POSTGRESQL, sql);
  }
}

async function syncTableColumnsPostgreSql(connection, dataSource, tableName, columns, options = {}) {
  const existingColumns = await getExistingColumns(connection, dataSource, tableName);
  const plan = getColumnSyncPlan(existingColumns, columns, POSTGRESQL);
  const changes = [];

  await precheckSyncPlan(connection, dataSource, tableName, existingColumns, columns, plan);

  try {
    const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), POSTGRESQL);

    for (const column of plan.additions) {
      await executeQuery(connection, POSTGRESQL, `ALTER TABLE ${qualifiedTable} ADD COLUMN ${buildColumnDefinitionSql(POSTGRESQL, column)}`);
      changes.push(`add:${column.columnName}`);
    }

    for (const column of plan.modifications) {
      await applyPostgreSqlColumnAlterations(connection, dataSource, tableName, column);
      changes.push(`modify:${column.columnName}`);
    }

    if (plan.primaryKeyChanged) {
      const existingConstraintName = await getPostgreSqlPrimaryKeyConstraintName(connection, dataSource, tableName);
      const expectedPrimaryKeys = getPrimaryKeyColumns(columns);

      if (existingConstraintName) {
        await executeQuery(
          connection,
          POSTGRESQL,
          `ALTER TABLE ${qualifiedTable} DROP CONSTRAINT ${escapeIdentifier(existingConstraintName, POSTGRESQL)}`
        );
        changes.push("drop_primary_key");
      }

      if (expectedPrimaryKeys.length > 0) {
        await executeQuery(
          connection,
          POSTGRESQL,
          `ALTER TABLE ${qualifiedTable} ADD PRIMARY KEY (${expectedPrimaryKeys
            .map((columnName) => escapeIdentifier(columnName, POSTGRESQL))
            .join(", ")})`
        );
        changes.push(`add_primary_key:${expectedPrimaryKeys.join(",")}`);
      }
    }
  } catch (error) {
    throw buildFriendlyAlterError(error, tableName);
  }

  await applyTableAndColumnComments(connection, dataSource, tableName, columns, options);
  return { tableName, synced: changes.length > 0, changes };
}

async function syncTableColumns(dataSource, tableName, columns, options = {}) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new AppError("无法同步目标表，字段定义不能为空", 400);
  }

  return withConnection(dataSource, async (connection, sourceType) => {
    if (sourceType === "mysql") {
      return syncTableColumnsMySql(connection, dataSource, tableName, columns, options);
    }
    return syncTableColumnsPostgreSql(connection, dataSource, tableName, columns, options);
  });
}

async function ensureTableMatchesColumns(dataSource, tableName, columns, options = {}) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new AppError("无法校验目标表，字段定义不能为空", 400);
  }

  const tables = await listTables(dataSource);
  const parsed = parseQualifiedTableName(dataSource, tableName);
  const tableExists = tables.some((table) => table.tableName === parsed.tableName);

  if (!tableExists) {
    await createTableFromColumns(dataSource, tableName, columns, options);
    return { tableName, action: "created", reason: "table_not_exists" };
  }

  const existingColumns = await listColumns(dataSource, tableName);
  const plan = getColumnSyncPlan(existingColumns, columns, normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig));
  if (plan.additions.length === 0 && plan.modifications.length === 0 && !plan.primaryKeyChanged) {
    // 注释属于物理元数据，不参与字段结构差异比较；即使结构未变也需要同步，
    // 以便旧表在后续部署时能补齐表、字段说明。
    await withConnection(dataSource, async (connection, sourceType) => {
      await applyTableAndColumnComments(connection, dataSource, tableName, columns, options);
    });
    return { tableName, action: "unchanged", reason: null };
  }

  const result = await syncTableColumns(dataSource, tableName, columns, options);
  return {
    tableName,
    action: "synced",
    reason: "schema_mismatch",
    changes: result.changes
  };
}

async function getColumnMaximum(dataSource, tableName, columnName) {
  return withConnection(dataSource, async (connection, sourceType) => {
    const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
    const qualifiedColumn = escapeIdentifier(columnName, sourceType);
    const rows = await executeQuery(
      connection,
      sourceType,
      `SELECT MAX(${qualifiedColumn}) AS max_value FROM ${qualifiedTable}`
    );
    return rows[0] ? rows[0].max_value : null;
  });
}

module.exports = {
  listTables,
  listColumns,
  listIndexes,
  listConstraints,
  sampleRows,
  searchRows,
  countRows,
  estimateRows,
  inspectTableProfile,
  inspectTableForRecommendation,
  createTableFromColumns,
  syncTableColumns,
  ensureTableMatchesColumns,
  getColumnMaximum,
  escapeValue,
  escapeIdentifier,
  __test: {
    buildAdapterEstimateQuery,
    buildColumnDefinitionSql,
    formatDefaultValue,
    normalizePostgreSqlColumnDefault,
    normalizeDefaultValueForCompare,
  }
};
