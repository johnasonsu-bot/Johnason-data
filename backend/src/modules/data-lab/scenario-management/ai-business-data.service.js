const AppError = require("../../../common/errors/app-error");
const cron = require("node-cron");
const { pool } = require("../../../config/database");
const dataLabSourceRepository = require("../../data-lab-sources/data-lab-source.repository");
const mysqlAdapter = require("../../data-development/adapters/mysql.adapter");
const postgresAdapter = require("../../data-development/adapters/postgres.adapter");
const modelProviderService = require("../../model-providers/model-provider.service");
const promptRuntime = require("../data-lab.prompt-runtime");
const promptDefaults = require("../data-lab.prompt-defaults");
const { safeJsonParse } = require("../data-lab.repository");
const {
  inferDatasourceDialect,
  normalizeDatasourceType,
  resolveDatasourceConnection,
} = require("../../../common/utils/datasource-dialect");
const { getCurrentProjectId } = require("../../../common/utils/project-context");

const PLAN_PROMPT_TYPE = "AI_BUSINESS_DATA_PLAN";
const BATCH_PROMPT_TYPE = "AI_BUSINESS_DATA_BATCH";
const DEFAULT_BATCH_ROW_LIMIT = 120;
const MAX_BATCH_ROW_LIMIT = 5000;
const STATE_SAMPLE_LIMIT = 60;
const STATE_RANDOM_SAMPLE_LIMIT = 30;
const STATE_DICTIONARY_ROW_LIMIT = 5000;
const MODEL_TABLE_ROW_CHUNK_SIZE = 20;

function getScopedWhere(alias = "") {
  const projectId = getCurrentProjectId();
  if (!projectId) return { sql: "", params: [], projectId: null };
  const prefix = alias ? `${alias}.` : "";
  return { sql: `${prefix}project_id = ?`, params: [projectId], projectId };
}

function text(value, maxLength = 255) {
  return String(value || "").trim().slice(0, maxLength);
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clampInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function normalizeDbType(value) {
  const normalized = String(value || "mysql").trim().toLowerCase();
  if (normalized === "postgres") return "postgresql";
  if (!["mysql", "postgresql"].includes(normalized)) {
    throw new AppError("当前仅支持 MySQL / PostgreSQL 物理模型", 400);
  }
  return normalized;
}

function normalizeGenerationMode(value) {
  const normalized = String(value || "initial").trim().toLowerCase();
  return normalized === "incremental" ? "incremental" : "initial";
}

function normalizeLoadMode(value) {
  const normalized = String(value || "append").trim().toLowerCase();
  return normalized === "replace" ? "replace" : "append";
}

function normalizeScheduleType(value) {
  const normalized = String(value || "manual").trim().toLowerCase();
  return ["manual", "hourly", "daily", "weekly", "cron"].includes(normalized) ? normalized : "manual";
}

function boolFlag(value) {
  return value === true || value === 1 || value === "1" || String(value || "").toLowerCase() === "true";
}

function buildTaskCronExpression(scheduleType, cronExpr) {
  const type = normalizeScheduleType(scheduleType);
  if (type === "hourly") return "0 * * * *";
  if (type === "daily") return "0 2 * * *";
  if (type === "weekly") return "0 2 * * 1";
  if (type === "cron") {
    const expr = text(cronExpr, 128);
    if (!expr || !cron.validate(expr)) {
      throw new AppError("Cron 表达式不合法", 400);
    }
    return expr;
  }
  return null;
}

function normalizePlatformSourceType(sourceType, connectionConfig = {}) {
  const normalized = normalizeDatasourceType(sourceType || "mysql");
  const dialect = inferDatasourceDialect(normalized, connectionConfig || {});
  return dialect === "unknown" ? normalized || "mysql" : dialect;
}

function toAdapterConnectionConfig(dataSource) {
  const connectionConfig = dataSource?.connectionConfig && typeof dataSource.connectionConfig === "object"
    ? dataSource.connectionConfig
    : {};
  const resolved = resolveDatasourceConnection(dataSource?.sourceType, connectionConfig);
  const storageType = normalizeDatasourceType(dataSource?.storageType || dataSource?.sourceType);
  const dialect = normalizePlatformSourceType(dataSource?.sourceType, connectionConfig);
  return {
    storageType,
    sourceType: storageType,
    dialect,
    type: storageType,
    host: resolved.host || connectionConfig.host,
    port: Number(resolved.port || connectionConfig.port || 0) || 0,
    username: resolved.username || connectionConfig.username,
    password: resolved.password || connectionConfig.password,
    databaseName: resolved.database || connectionConfig.database || connectionConfig.databaseName || undefined,
    schema: resolved.schema || connectionConfig.schema || "public",
    jdbcUrl: resolved.jdbcUrl || connectionConfig.jdbcUrl || connectionConfig.url || "",
    driverClassName: resolved.driverClassName || connectionConfig.driverClassName || null,
  };
}

function buildDeployTargetSnapshot(dataSource) {
  const storageType = normalizeDatasourceType(dataSource?.storageType || dataSource?.sourceType);
  const normalizedType = normalizePlatformSourceType(dataSource?.sourceType, dataSource?.connectionConfig || {});
  const adapterConfig = toAdapterConnectionConfig(dataSource);
  return {
    targetDataSourceId: Number(dataSource.id),
    targetDataSourceName: dataSource.sourceName,
    targetDataSourceCode: dataSource.sourceCode,
    targetDataSourceType: storageType,
    targetDialect: normalizedType,
    host: adapterConfig.host,
    port: adapterConfig.port,
    databaseName: adapterConfig.databaseName || null,
    schema: adapterConfig.schema || null,
  };
}

async function getTargetDataSourceForScenario(dataSourceId) {
  const dataSource = await dataLabSourceRepository.getDataSourceById(Number(dataSourceId));
  if (!dataSource) {
    throw new AppError("目标数据源不存在", 404);
  }
  if (String(dataSource.status || "").toLowerCase() !== "active") {
    throw new AppError("目标数据源未启用，无法用于 AI 业务数据落库", 400);
  }
  const normalizedType = normalizePlatformSourceType(dataSource.sourceType, dataSource.connectionConfig || {});
  if (!["mysql", "postgresql"].includes(normalizedType)) {
    throw new AppError("AI 业务数据当前仅支持 MySQL / PostgreSQL 数据源落库", 400);
  }
  const adapterConfig = toAdapterConnectionConfig(dataSource);
  if (!adapterConfig.host || !adapterConfig.port || !adapterConfig.username || !adapterConfig.databaseName) {
    throw new AppError("目标数据源连接信息不完整，请补充主机、端口、用户名和数据库名", 400);
  }
  return {
    ...dataSource,
    storageType: normalizeDatasourceType(dataSource.sourceType),
    sourceType: normalizedType,
    connectionConfig: adapterConfig,
  };
}

function getDatabaseAdapter(sourceType, connectionConfig = {}) {
  const normalizedType = normalizePlatformSourceType(sourceType, connectionConfig);
  if (normalizedType === "mysql") return mysqlAdapter;
  if (normalizedType === "postgresql") return postgresAdapter;
  throw new AppError(`不支持的数据源类型: ${sourceType}`, 400);
}

function quoteIdentifier(dbType, identifier) {
  return dbType === "postgresql"
    ? `"${String(identifier || "").replace(/"/g, "\"\"")}"`
    : `\`${String(identifier || "").replace(/`/g, "``")}\``;
}

function buildQualifiedTableReference(dbType, tableName, schema) {
  if (dbType === "postgresql" && schema) {
    return `${quoteIdentifier(dbType, schema)}.${quoteIdentifier(dbType, tableName)}`;
  }
  return quoteIdentifier(dbType, tableName);
}

function escapeSqlComment(value) {
  return String(value || "").replace(/'/g, "''");
}

function isNumericColumnType(columnType) {
  return /int|decimal|numeric|number|float|double/i.test(String(columnType || ""));
}

function isDateColumnType(columnType) {
  return String(columnType || "").trim().toLowerCase() === "date";
}

function isDateTimeColumnType(columnType) {
  return /datetime|timestamp/i.test(String(columnType || ""));
}

function isBooleanColumnType(columnType) {
  return /boolean|tinyint\(1\)/i.test(String(columnType || ""));
}

function isJsonColumnType(columnType) {
  return /json/i.test(String(columnType || ""));
}

function extractVarcharLength(columnType) {
  const matched = String(columnType || "").match(/(?:varchar|char)\((\d+)\)/i);
  return matched ? Number(matched[1]) : 0;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function formatSqlValue(dbType, columnType, value) {
  if (value === null || value === undefined || value === "") {
    return "NULL";
  }
  if (isJsonColumnType(columnType)) {
    if (typeof value === "string") {
      const normalizedValue = value.trim();
      try {
        JSON.parse(normalizedValue);
        return `'${escapeSqlComment(normalizedValue)}'`;
      } catch {
        return `'${escapeSqlComment(JSON.stringify(normalizedValue))}'`;
      }
    }
    return `'${escapeSqlComment(JSON.stringify(value))}'`;
  }
  if (typeof value === "boolean") {
    return dbType === "postgresql" ? (value ? "TRUE" : "FALSE") : (value ? "1" : "0");
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (value instanceof Date) {
    return `'${escapeSqlComment(formatDateTime(value))}'`;
  }
  if (typeof value === "object") {
    return `'${escapeSqlComment(JSON.stringify(value))}'`;
  }
  const normalizedValue = String(value);
  if (isNumericColumnType(columnType) && /^-?\d+(\.\d+)?$/.test(normalizedValue.trim())) {
    return normalizedValue.trim();
  }
  return `'${escapeSqlComment(normalizedValue)}'`;
}

async function executeSqlStatementsOnDataSource(dataSource, statements) {
  const adapter = getDatabaseAdapter(dataSource.sourceType, dataSource.connectionConfig || {});
  const executionLogs = [];
  for (const statement of statements || []) {
    const normalizedStatement = String(statement || "").trim();
    if (!normalizedStatement) continue;
    const result = await adapter.executeStatement(dataSource.connectionConfig, normalizedStatement, {
      databaseName: dataSource.connectionConfig.databaseName,
    });
    executionLogs.push({
      sql: normalizedStatement,
      affectedRows: Number(result?.affectedRows || 0),
    });
  }
  return executionLogs;
}

async function executeQueryOnDataSource(dataSource, sql, options = {}) {
  const adapter = getDatabaseAdapter(dataSource.sourceType, dataSource.connectionConfig || {});
  return adapter.executeQuery(dataSource.connectionConfig, sql, {
    databaseName: dataSource.connectionConfig.databaseName,
    resultLimit: options.resultLimit || 100,
  });
}

function inferPrimaryKeyColumn(table) {
  const columns = Array.isArray(table?.columns) ? table.columns : [];
  return columns.find((column) => column.isPrimaryKey) || columns[0] || null;
}

function resolveTableKey(table) {
  return String(table?.logicalTableName || table?.physicalTableName || "").trim();
}

function buildTableMaps(physicalModel) {
  const tables = Array.isArray(physicalModel?.tables) ? physicalModel.tables : [];
  const byLogical = new Map();
  const byPhysical = new Map();
  for (const table of tables) {
    if (table?.logicalTableName) byLogical.set(String(table.logicalTableName), table);
    if (table?.physicalTableName) byPhysical.set(String(table.physicalTableName), table);
  }
  return { tables, byLogical, byPhysical };
}

function normalizeRelations(physicalModel) {
  return Array.isArray(physicalModel?.relations) ? physicalModel.relations : [];
}

function sortTablesForGeneration(tables, relations) {
  const tableNames = (Array.isArray(tables) ? tables : []).map((table) => resolveTableKey(table)).filter(Boolean);
  const tableNameSet = new Set(tableNames);
  const dependencyMap = new Map(tableNames.map((tableName) => [tableName, new Set()]));
  const outgoingMap = new Map(tableNames.map((tableName) => [tableName, new Set()]));

  for (const relation of relations || []) {
    const fromTable = String(relation?.fromTable || "");
    const toTable = String(relation?.toTable || "");
    if (!tableNameSet.has(fromTable) || !tableNameSet.has(toTable) || fromTable === toTable) continue;
    dependencyMap.get(fromTable).add(toTable);
    outgoingMap.get(toTable).add(fromTable);
  }

  const inDegree = new Map(tableNames.map((tableName) => [tableName, dependencyMap.get(tableName).size]));
  const queue = tableNames.filter((tableName) => inDegree.get(tableName) === 0);
  const ordered = [];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    ordered.push(current);
    for (const next of outgoingMap.get(current) || []) {
      const nextDegree = Math.max(0, Number(inDegree.get(next) || 0) - 1);
      inDegree.set(next, nextDegree);
      if (nextDegree === 0 && !visited.has(next)) {
        queue.push(next);
      }
    }
  }

  for (const tableName of tableNames) {
    if (!ordered.includes(tableName)) {
      ordered.push(tableName);
    }
  }

  const tableMap = new Map((tables || []).map((table) => [resolveTableKey(table), table]));
  return ordered.map((tableName) => tableMap.get(tableName)).filter(Boolean);
}

function compactPhysicalModelForPrompt(physicalModel, logicalModel = null) {
  const logicalTableMap = new Map(
    (Array.isArray(logicalModel?.tables) ? logicalModel.tables : []).map((table) => [String(table?.tableName || ""), table])
  );
  const dictTables = Array.isArray(logicalModel?.dictTables) ? logicalModel.dictTables : [];
  const tables = (Array.isArray(physicalModel?.tables) ? physicalModel.tables : []).map((table) => {
    const logicalTable = logicalTableMap.get(String(table?.logicalTableName || "")) || {};
    return {
      logicalTableName: table?.logicalTableName,
      physicalTableName: table?.physicalTableName,
      logicalLabel: table?.logicalLabel || logicalTable?.tableLabel || table?.logicalTableName,
      tableComment: table?.tableComment || logicalTable?.tableComment || "",
      tableKind: table?.tableKind || "BUSINESS",
      businessRole: table?.businessRole || logicalTable?.businessRole || "",
      primaryKey: inferPrimaryKeyColumn(table)?.columnName || null,
      columns: (Array.isArray(table?.columns) ? table.columns : []).map((column) => ({
        columnName: column?.columnName,
        sourceFieldName: column?.sourceFieldName || column?.columnName,
        columnType: column?.columnType,
        isNullable: Boolean(column?.isNullable),
        isPrimaryKey: Boolean(column?.isPrimaryKey),
        defaultValue: column?.defaultValue ?? null,
        columnComment: column?.columnComment || "",
      })),
    };
  });
  return {
    summary: physicalModel?.summary || {},
    tables,
    relations: normalizeRelations(physicalModel).map((relation) => ({
      fromTable: relation?.fromTable,
      fromField: relation?.fromField,
      toTable: relation?.toTable,
      toField: relation?.toField,
      relationType: relation?.relationType,
    })),
    dictionaries: dictTables.map((dictTable) => ({
      dictType: dictTable?.dictType,
      dictName: dictTable?.dictName,
      items: (Array.isArray(dictTable?.items) ? dictTable.items : []).slice(0, 30).map((item) => ({
        itemCode: item?.itemCode,
        itemLabel: item?.itemLabel,
        valueRange: item?.valueRange ?? null,
      })),
    })),
  };
}

async function getBusinessSystemInstance(id) {
  const scoped = getScopedWhere("i");
  const [rows] = await pool.query(
    `SELECT i.id, i.instance_code AS instanceCode, i.instance_name AS instanceName,
            i.template_id AS templateId, t.template_name AS templateName, t.template_code AS templateCode,
            t.industry_code AS industryCode, t.template_desc AS templateDesc,
            i.db_type AS dbType, i.deploy_target_json AS deployTargetJson, i.instance_status AS instanceStatus,
            i.current_logical_version AS currentLogicalVersion,
            i.current_physical_version AS currentPhysicalVersion,
            i.current_generation_version AS currentGenerationVersion,
            i.current_dirty_version AS currentDirtyVersion,
            i.created_by AS createdBy, i.created_at AS createdAt, i.updated_at AS updatedAt
       FROM lab_business_system_instance i
       JOIN lab_business_system_template t ON t.id = i.template_id
      WHERE i.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      LIMIT 1`,
    [Number(id), ...scoped.params]
  );
  const row = rows[0];
  if (!row) {
    throw new AppError("物理模型实例不存在", 404);
  }
  return {
    ...row,
    id: Number(row.id),
    templateId: Number(row.templateId),
    deployTarget: safeJsonParse(row.deployTargetJson, null),
    currentLogicalVersion: row.currentLogicalVersion == null ? null : Number(row.currentLogicalVersion),
    currentPhysicalVersion: row.currentPhysicalVersion == null ? null : Number(row.currentPhysicalVersion),
    currentGenerationVersion: row.currentGenerationVersion == null ? null : Number(row.currentGenerationVersion),
    currentDirtyVersion: row.currentDirtyVersion == null ? null : Number(row.currentDirtyVersion),
  };
}

async function getPhysicalVersion(instanceId, versionNo) {
  const [rows] = await pool.query(
    `SELECT id, instance_id AS instanceId, version_no AS versionNo, logical_version_no AS logicalVersionNo,
            db_type AS dbType, deploy_target_json AS deployTargetJson, version_status AS versionStatus,
            physical_model_json AS physicalModelJson, ddl_bundle_json AS ddlBundleJson, model_summary AS modelSummary,
            created_at AS createdAt, updated_at AS updatedAt
       FROM lab_physical_model_version
      WHERE instance_id = ? AND version_no = ?
      LIMIT 1`,
    [Number(instanceId), Number(versionNo)]
  );
  const row = rows[0];
  if (!row) {
    throw new AppError("物理模型版本不存在", 404);
  }
  return {
    ...row,
    id: Number(row.id),
    instanceId: Number(row.instanceId),
    versionNo: Number(row.versionNo),
    logicalVersionNo: Number(row.logicalVersionNo),
    deployTarget: safeJsonParse(row.deployTargetJson, null),
    physicalModel: safeJsonParse(row.physicalModelJson, null),
    ddlBundle: safeJsonParse(row.ddlBundleJson, null),
  };
}

async function getLogicalVersion(templateId, versionNo) {
  if (!versionNo) return null;
  const [rows] = await pool.query(
    `SELECT id, template_id AS templateId, version_no AS versionNo, logical_model_json AS logicalModelJson
       FROM lab_logical_model_version
      WHERE template_id = ? AND version_no = ?
      LIMIT 1`,
    [Number(templateId), Number(versionNo)]
  );
  const row = rows[0];
  return row ? {
    id: Number(row.id),
    templateId: Number(row.templateId),
    versionNo: Number(row.versionNo),
    logicalModel: safeJsonParse(row.logicalModelJson, null),
  } : null;
}

async function resolveGenerationContext(instanceId, payload = {}, options = {}) {
  const instance = await getBusinessSystemInstance(instanceId);
  const physicalVersionNo = payload?.physicalVersionNo
    ? Number(payload.physicalVersionNo)
    : Number(instance.currentPhysicalVersion || 0);
  if (!physicalVersionNo) {
    throw new AppError("请先生成并部署可用的物理模型版本", 400);
  }
  const physicalVersion = await getPhysicalVersion(instance.id, physicalVersionNo);
  const physicalModel = safeObject(physicalVersion.physicalModel);
  if (!Array.isArray(physicalModel.tables) || physicalModel.tables.length === 0) {
    throw new AppError("物理模型版本没有可用表结构", 400);
  }
  const logicalVersion = await getLogicalVersion(instance.templateId, physicalVersion.logicalVersionNo);
  const targetDataSourceId = Number(
    payload?.targetDataSourceId
    || physicalVersion?.deployTarget?.targetDataSourceId
    || instance?.deployTarget?.targetDataSourceId
    || 0
  );
  let targetDataSource = null;
  if (targetDataSourceId) {
    targetDataSource = await getTargetDataSourceForScenario(targetDataSourceId);
  } else if (options.requireTargetDataSource) {
    throw new AppError("请先选择目标数据源并完成物理模型部署", 400);
  }
  return {
    instance,
    physicalVersion,
    physicalModel,
    logicalModel: logicalVersion?.logicalModel || null,
    targetDataSource,
    targetDataSourceId: targetDataSourceId || null,
  };
}

function pickDisplayColumns(table, relations = []) {
  const primaryKey = inferPrimaryKeyColumn(table);
  const relationFields = relations
    .filter((relation) => String(relation?.toTable || "") === String(table?.logicalTableName || ""))
    .map((relation) => String(relation?.toField || ""))
    .filter(Boolean);
  const columns = Array.isArray(table?.columns) ? table.columns : [];
  const preferred = columns
    .filter((column) => {
      const name = String(column?.columnName || "");
      const comment = String(column?.columnComment || "");
      return /(name|title|phone|mobile|email|id_card|address|code|no|status|姓名|名称|手机|电话|邮箱|证件|地址|状态)/i.test(`${name} ${comment}`);
    })
    .map((column) => String(column?.columnName || ""))
    .filter(Boolean);
  return Array.from(new Set([
    primaryKey?.columnName,
    ...relationFields,
    ...preferred,
  ].filter(Boolean))).slice(0, 8);
}

function getTableColumnNames(table) {
  return (Array.isArray(table?.columns) ? table.columns : [])
    .map((column) => String(column?.columnName || ""))
    .filter(Boolean);
}

function buildRandomSampleSql(dbType, qualifiedTableName, columnNames, limit) {
  const columnSql = columnNames.map((columnName) => quoteIdentifier(dbType, columnName)).join(", ");
  const randomSql = dbType === "postgresql" ? "RANDOM()" : "RAND()";
  return `SELECT ${columnSql} FROM ${qualifiedTableName} ORDER BY ${randomSql} LIMIT ${limit}`;
}

function buildDictionaryRowsSql(dbType, qualifiedTableName, table, limit) {
  const columnNames = getTableColumnNames(table);
  const columnSql = columnNames.map((columnName) => quoteIdentifier(dbType, columnName)).join(", ");
  const columns = new Set(columnNames);
  const orderColumns = ["sort_order", "item_code"].filter((columnName) => columns.has(columnName));
  const orderSql = orderColumns.length > 0
    ? ` ORDER BY ${orderColumns.map((columnName) => quoteIdentifier(dbType, columnName)).join(", ")}`
    : "";
  return `SELECT ${columnSql} FROM ${qualifiedTableName}${orderSql} LIMIT ${limit}`;
}

function normalizeProfileValue(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value).trim();
}

function parseProfileNumber(value) {
  const raw = normalizeProfileValue(value).replace(/,/g, "");
  if (!raw) return null;
  const unitMatch = raw.match(/^(-?\d+(?:\.\d+)?)\s*([\u4e00-\u9fa5A-Za-z%/]+)$/);
  if (unitMatch) {
    return {
      number: Number(unitMatch[1]),
      unit: unitMatch[2],
      kind: "number_with_unit",
      decimalPlaces: (unitMatch[1].split(".")[1] || "").length,
    };
  }
  if (/^-?\d+$/.test(raw)) {
    return { number: Number(raw), unit: "", kind: "plain_integer", decimalPlaces: 0 };
  }
  if (/^-?\d+\.\d+$/.test(raw)) {
    return { number: Number(raw), unit: "", kind: "plain_decimal", decimalPlaces: (raw.split(".")[1] || "").length };
  }
  return null;
}

function inferJsonLikeText(value) {
  const raw = normalizeProfileValue(value);
  if (!raw || !/^[\[{]/.test(raw)) return false;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object";
  } catch {
    return false;
  }
}

function summarizeColumnObservedFormat(values) {
  const nonEmptyValues = values.map(normalizeProfileValue).filter(Boolean);
  if (nonEmptyValues.length === 0) {
    return { dominantKind: "empty", sampleValues: [] };
  }
  const buckets = new Map();
  const decimalPlaces = [];
  const numericValues = [];
  let jsonTextCount = 0;
  for (const value of nonEmptyValues) {
    const parsedNumber = parseProfileNumber(value);
    if (parsedNumber) {
      const key = parsedNumber.unit ? `number_with_unit:${parsedNumber.unit}` : parsedNumber.kind;
      buckets.set(key, Number(buckets.get(key) || 0) + 1);
      decimalPlaces.push(parsedNumber.decimalPlaces);
      numericValues.push(parsedNumber.number);
      continue;
    }
    if (inferJsonLikeText(value)) {
      jsonTextCount += 1;
      buckets.set("json_text", Number(buckets.get("json_text") || 0) + 1);
      continue;
    }
    buckets.set("text", Number(buckets.get("text") || 0) + 1);
  }
  const dominant = Array.from(buckets.entries()).sort((left, right) => right[1] - left[1])[0] || ["text", 0];
  const [dominantKey, count] = dominant;
  const [dominantKind, unitSuffix = ""] = dominantKey.split(":");
  const numericStats = numericValues.length > 0
    ? {
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        decimalPlaces: decimalPlaces.length > 0 ? Math.max(...decimalPlaces.slice(0, 20)) : 0,
      }
    : null;
  return {
    dominantKind,
    unitSuffix,
    confidence: Number((count / nonEmptyValues.length).toFixed(2)),
    jsonTextRate: Number((jsonTextCount / nonEmptyValues.length).toFixed(2)),
    numericStats,
    sampleValues: Array.from(new Set(nonEmptyValues)).slice(0, 8),
  };
}

function buildTableDataProfile(table, rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const fields = (Array.isArray(table?.columns) ? table.columns : []).map((column) => {
    const columnName = String(column?.columnName || "");
    const values = sourceRows.map((row) => row?.[columnName]);
    const nonEmptyValues = values.map(normalizeProfileValue).filter(Boolean);
    const distinctValues = Array.from(new Set(nonEmptyValues));
    return {
      fieldName: columnName,
      columnType: column?.columnType || "",
      fieldComment: column?.columnComment || "",
      nonEmptySampleCount: nonEmptyValues.length,
      distinctSampleCount: distinctValues.length,
      observedFormat: summarizeColumnObservedFormat(nonEmptyValues),
    };
  });
  return {
    tableName: String(table?.logicalTableName || table?.physicalTableName || ""),
    physicalTableName: table?.physicalTableName || "",
    sampleMode: "random_existing_rows",
    sampleRowCount: sourceRows.length,
    fields,
  };
}

function getDictionaryTableMeta(table) {
  const columns = Array.isArray(table?.columns) ? table.columns : [];
  const columnNames = columns.map((column) => String(column?.columnName || "")).filter(Boolean);
  const findColumn = (patterns) => columnNames.find((columnName) => patterns.some((pattern) => pattern.test(columnName)));
  return {
    tableName: String(table?.logicalTableName || table?.physicalTableName || ""),
    physicalTableName: String(table?.physicalTableName || table?.logicalTableName || ""),
    codeField: findColumn([/^item_code$/i, /^dict_code$/i, /(^|_)code$/i]) || inferPrimaryKeyColumn(table)?.columnName || columnNames[0] || "item_code",
    labelField: findColumn([/^item_label$/i, /^dict_label$/i, /(^|_)label$/i, /(^|_)name$/i]) || columnNames[1] || "item_label",
    categoryField: findColumn([/^category_code$/i, /category/i]) || null,
    sortField: findColumn([/^sort_order$/i, /^sort$/i, /^order_no$/i]) || null,
  };
}

function splitSemanticTokens(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_\u4e00-\u9fa5]+/g, "_")
    .split(/_+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isDictionaryLikeColumn(column) {
  const nameTokens = splitSemanticTokens(column?.columnName || "");
  const comment = String(column?.columnComment || "");
  return nameTokens.some((token) => ["status", "state", "type", "category", "level", "method", "result", "mode"].includes(token))
    || /(状态|类型|类别|等级|方式|结果|模式)/.test(comment);
}

function scoreDictionaryBinding(table, column, dictionaryTable) {
  const columnName = String(column?.columnName || "").toLowerCase();
  const tableName = String(table?.logicalTableName || table?.physicalTableName || "").toLowerCase();
  const dictName = String(dictionaryTable?.logicalTableName || dictionaryTable?.physicalTableName || "").toLowerCase();
  if (!columnName || !dictName) return 0;
  if (columnName === dictName) return 1000;
  if (columnName.endsWith(`_${dictName}`) || dictName.endsWith(`_${columnName}`)) return 900;
  if (!isDictionaryLikeColumn(column)) return 0;
  const columnTokens = new Set(splitSemanticTokens(columnName));
  const tableTokens = new Set(splitSemanticTokens(tableName));
  const dictTokens = new Set(splitSemanticTokens(dictName));
  let score = 0;
  for (const token of dictTokens) {
    if (columnTokens.has(token)) score += 20;
    if (tableTokens.has(token)) score += 15;
  }
  const comment = String(column?.columnComment || "");
  if (/状态/.test(comment) && dictTokens.has("status")) score += 10;
  if (/方式/.test(comment) && dictTokens.has("method")) score += 10;
  if (/等级/.test(comment) && dictTokens.has("level")) score += 10;
  if (/结果/.test(comment) && dictTokens.has("result")) score += 10;
  return score;
}

function buildDictionaryBindings(physicalModel) {
  const tables = Array.isArray(physicalModel?.tables) ? physicalModel.tables : [];
  const dictionaryTables = tables.filter((table) => table?.tableKind === "DICTIONARY");
  const bindings = [];
  for (const table of tables) {
    if (table?.tableKind === "DICTIONARY") continue;
    const logicalTableName = String(table?.logicalTableName || table?.physicalTableName || "");
    for (const column of Array.isArray(table?.columns) ? table.columns : []) {
      const columnName = String(column?.columnName || "");
      if (!columnName) continue;
      let best = null;
      for (const dictionaryTable of dictionaryTables) {
        const score = scoreDictionaryBinding(table, column, dictionaryTable);
        if (score > 0 && (!best || score > best.score)) {
          best = { dictionaryTable, score };
        }
      }
      if (!best || best.score < 30) continue;
      const dictionaryMeta = getDictionaryTableMeta(best.dictionaryTable);
      bindings.push({
        tableName: logicalTableName,
        physicalTableName: table?.physicalTableName || logicalTableName,
        fieldName: columnName,
        fieldComment: column?.columnComment || "",
        dictionaryTableName: dictionaryMeta.tableName,
        dictionaryPhysicalTableName: dictionaryMeta.physicalTableName,
        codeField: dictionaryMeta.codeField,
        labelField: dictionaryMeta.labelField,
        matchScore: best.score,
        rule: "USE_DICTIONARY_CODE",
      });
    }
  }
  return bindings;
}

function compactDictionaryRows(table, rows) {
  const meta = getDictionaryTableMeta(table);
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    itemCode: row?.[meta.codeField],
    itemLabel: row?.[meta.labelField],
    categoryCode: meta.categoryField ? row?.[meta.categoryField] : undefined,
    valueRange: row?.value_range_json ?? row?.valueRangeJson ?? null,
    sortOrder: meta.sortField ? row?.[meta.sortField] : undefined,
  })).filter((row) => row.itemCode !== undefined && row.itemCode !== null && row.itemCode !== "");
}

async function buildCurrentDataState(context) {
  const { targetDataSource, physicalModel, physicalVersion } = context;
  if (!targetDataSource) {
    return {
      generatedAt: new Date().toISOString(),
      physicalVersionNo: Number(physicalVersion.versionNo),
      targetDataSourceId: null,
      tableStats: [],
      entityPools: {},
      dataProfiles: [],
      dictionaryTables: [],
      dictionaryBindings: buildDictionaryBindings(physicalModel),
      warnings: ["当前实例未解析到目标数据源，增量延展仅基于本次批次数据。"],
    };
  }

  const dbType = normalizePlatformSourceType(targetDataSource.sourceType, targetDataSource.connectionConfig || {});
  const schema = dbType === "postgresql" ? targetDataSource.connectionConfig.schema : null;
  const relations = normalizeRelations(physicalModel);
  const tableStats = [];
  const entityPools = {};
  const dataProfiles = [];
  const dictionaryTables = [];
  const dictionaryBindings = buildDictionaryBindings(physicalModel);
  const warnings = [];

  for (const table of Array.isArray(physicalModel.tables) ? physicalModel.tables : []) {
    const physicalTableName = String(table?.physicalTableName || "");
    const logicalTableName = String(table?.logicalTableName || physicalTableName);
    if (!physicalTableName) continue;
    const qualifiedTableName = buildQualifiedTableReference(dbType, physicalTableName, schema);
    const displayColumns = pickDisplayColumns(table, relations);
    const allColumnNames = getTableColumnNames(table);
    try {
      const countResult = await executeQueryOnDataSource(
        targetDataSource,
        `SELECT COUNT(*) AS total FROM ${qualifiedTableName}`,
        { resultLimit: 1 }
      );
      const rowCount = Number(countResult?.rows?.[0]?.total || countResult?.rows?.[0]?.count || 0);
      let sampleRows = [];
      let profileRows = [];
      if (allColumnNames.length > 0 && rowCount > 0) {
        const limit = table?.tableKind === "DICTIONARY" ? STATE_DICTIONARY_ROW_LIMIT : STATE_RANDOM_SAMPLE_LIMIT;
        const sql = table?.tableKind === "DICTIONARY"
          ? buildDictionaryRowsSql(dbType, qualifiedTableName, table, limit)
          : buildRandomSampleSql(dbType, qualifiedTableName, allColumnNames, limit);
        const sampleResult = await executeQueryOnDataSource(
          targetDataSource,
          sql,
          { resultLimit: limit }
        );
        profileRows = Array.isArray(sampleResult?.rows) ? sampleResult.rows : [];
      }
      if (displayColumns.length > 0 && profileRows.length > 0) {
        sampleRows = profileRows.map((row) => sliceRowForPrompt(row, displayColumns));
      }
      if (table?.tableKind === "DICTIONARY") {
        const rows = compactDictionaryRows(table, profileRows);
        dictionaryTables.push({
          ...getDictionaryTableMeta(table),
          rowCount,
          loadedRowCount: rows.length,
          rows,
        });
        sampleRows = rows;
      } else if (profileRows.length > 0) {
        dataProfiles.push(buildTableDataProfile(table, profileRows));
      }
      tableStats.push({
        logicalTableName,
        physicalTableName,
        rowCount,
        primaryKey: inferPrimaryKeyColumn(table)?.columnName || null,
      });
      entityPools[logicalTableName] = sampleRows;
    } catch (error) {
      warnings.push(`${logicalTableName} 状态读取失败：${error.message || "未知错误"}`);
      tableStats.push({
        logicalTableName,
        physicalTableName,
        rowCount: 0,
        primaryKey: inferPrimaryKeyColumn(table)?.columnName || null,
        readError: error.message || "unknown",
      });
      entityPools[logicalTableName] = [];
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    physicalVersionNo: Number(physicalVersion.versionNo),
    targetDataSourceId: Number(targetDataSource.id),
    targetDataSource: buildDeployTargetSnapshot(targetDataSource),
    tableStats,
    entityPools,
    dataProfiles,
    dictionaryTables,
    dictionaryBindings,
    warnings,
  };
}

function buildRequirement(payload = {}) {
  const generationMode = normalizeGenerationMode(payload.generationMode);
  const totalRows = clampInteger(payload.totalRows || payload.batchRows, generationMode === "initial" ? 300 : DEFAULT_BATCH_ROW_LIMIT, 1, MAX_BATCH_ROW_LIMIT);
  const batchRows = clampInteger(payload.batchRows || totalRows, Math.min(totalRows, DEFAULT_BATCH_ROW_LIMIT), 1, MAX_BATCH_ROW_LIMIT);
  return {
    generationMode,
    totalRows,
    batchRows,
    timelineStartAt: text(payload.timelineStartAt, 64) || null,
    timelineDays: clampInteger(payload.timelineDays, 90, 1, 3650),
    requirementText: text(payload.requirementText || payload.summary, 4000) || "",
  };
}

function extractJsonText(content) {
  const raw = String(content || "").trim();
  if (!raw) return "";
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }
  const firstBracket = raw.indexOf("[");
  const lastBracket = raw.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    return raw.slice(firstBracket, lastBracket + 1);
  }
  return raw;
}

function parseModelJson(content) {
  const jsonText = extractJsonText(content);
  if (!jsonText) {
    throw new AppError("模型未返回 JSON 内容", 400);
  }
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new AppError(`模型返回内容不是合法 JSON: ${error.message}`, 400);
  }
}

async function callModelJson(promptType, defaults, variables, options = {}) {
  const runtime = await promptRuntime.resolveRuntimePromptConfig(promptType, defaults, variables);
  if (!runtime.template) {
    throw new AppError(`${promptType} 提示词未同步，请先在数据建模 > 模型管理中同步默认提示词并配置默认模型`, 400);
  }
  const provider = runtime.provider;
  if (!provider) {
    throw new AppError(`${promptType} 未绑定或未启用默认对话模型，请在数据建模 > 模型管理中维护该场景的模型配置`, 400);
  }

  const baseMessages = [
    { role: "system", content: runtime.systemPrompt },
    { role: "user", content: runtime.userPrompt },
  ];
  const requestOptions = {
    temperature: options.temperature === undefined
      ? runtime.temperature
      : promptRuntime.normalizePromptParameterNumber(options.temperature, runtime.temperature, { min: 0, max: 2 }),
    maxTokens: options.maxTokens === undefined
      ? runtime.maxTokens
      : promptRuntime.normalizePromptParameterNumber(options.maxTokens, runtime.maxTokens, { min: 1, max: 8000, integer: true }),
    timeoutMs: clampInteger(options.timeoutMs, 45000, 5000, 120000),
    responseFormat: options.responseFormat === false ? undefined : { type: "json_object" },
  };
  const response = await modelProviderService.generateChatCompletion(
    provider,
    baseMessages,
    requestOptions
  );
  let content = response.content;
  let parsedJson;
  let retriedForJson = false;
  try {
    parsedJson = parseModelJson(content);
  } catch (error) {
    if (options.retryOnInvalidJson === false) {
      throw error;
    }
    retriedForJson = true;
    const retryResponse = await modelProviderService.generateChatCompletion(
      provider,
      [
        ...baseMessages,
        {
          role: "user",
          content: [
            `上次输出不是合法 JSON，解析错误：${error.message || "unknown"}`,
            "请基于原始输入重新生成完整结果，只返回单个合法 JSON object。",
            "不要输出 markdown，不要解释；数组元素之间必须使用英文逗号；字符串内部换行和引号必须转义。",
          ].join("\n"),
        },
      ],
      {
        ...requestOptions,
        temperature: Math.min(Number(runtime.temperature || 0.2), 0.1),
      }
    );
    content = retryResponse.content;
    parsedJson = parseModelJson(content);
  }
  return {
    provider: {
      providerId: response.providerId,
      providerType: response.providerType,
      modelName: response.modelName,
      retriedForJson,
    },
    content,
    json: parsedJson,
  };
}

function buildFallbackPlan(context, requirement, state, reason) {
  const compactModel = compactPhysicalModelForPrompt(context.physicalModel, context.logicalModel);
  const businessTables = compactModel.tables.filter((table) => table.tableKind !== "DICTIONARY");
  const totalWeight = businessTables.reduce((sum, table) => {
    const role = String(table.businessRole || "").toUpperCase();
    if (role === "TRANSACTION") return sum + 3;
    if (role === "DETAIL" || role === "LOG") return sum + 2;
    return sum + 1;
  }, 0) || 1;
  const rowAllocation = compactModel.tables.map((table) => {
    if (table.tableKind === "DICTIONARY") {
      return {
        tableName: table.logicalTableName,
        physicalTableName: table.physicalTableName,
        targetRows: Math.min(8, Math.max(3, table.columns.length)),
        reason: "字典表用于支撑业务字段值域。",
      };
    }
    const role = String(table.businessRole || "").toUpperCase();
    const weight = role === "TRANSACTION" ? 3 : (role === "DETAIL" || role === "LOG" ? 2 : 1);
    return {
      tableName: table.logicalTableName,
      physicalTableName: table.physicalTableName,
      targetRows: Math.max(1, Math.round((requirement.totalRows * weight) / totalWeight)),
      reason: "按表角色和当前物理模型依赖关系分配业务数据量。",
    };
  });

  return {
    summary: reason ? `模型调用不可用，平台已生成可审核的兜底计划：${reason}` : "平台根据物理模型结构生成业务数据计划。",
    industryUnderstanding: [
      `业务实例：${context.instance.instanceName}`,
      `模板：${context.instance.templateName}`,
      "业务语义以用户给定物理模型的表名、字段注释、字典和值域为准，不预置固定行业场景。",
    ],
    generationMode: requirement.generationMode,
    generationOrder: sortTablesForGeneration(context.physicalModel.tables || [], normalizeRelations(context.physicalModel)).map((table) => table.logicalTableName),
    tableRoles: compactModel.tables.map((table) => ({
      tableName: table.logicalTableName,
      physicalTableName: table.physicalTableName,
      businessRole: table.businessRole || table.tableKind,
      generationIntent: table.tableComment || table.logicalLabel || table.logicalTableName,
      dependencyNotes: compactModel.relations
        .filter((relation) => relation.fromTable === table.logicalTableName || relation.toTable === table.logicalTableName)
        .map((relation) => `${relation.fromTable}.${relation.fromField} -> ${relation.toTable}.${relation.toField}`),
    })),
    rowAllocation,
    fieldStrategies: compactModel.tables.flatMap((table) => table.columns.slice(0, 8).map((column) => ({
      tableName: table.logicalTableName,
      fieldName: column.columnName,
      strategy: `${column.columnComment || column.columnName} 结合字段类型、表角色和依赖上下文生成。`,
      complianceRule: inferComplianceRule(column),
    }))),
    continuityPlan: {
      mode: requirement.generationMode,
      tableStats: state?.tableStats || [],
      notes: requirement.generationMode === "incremental"
        ? "增量批次会优先复用已落库主数据主键，并为活动/交易/记录类表延展新的业务行为。"
        : "首批数据会生成完整主数据、字典和活动表依赖闭环。",
    },
    qualityChecks: [
      "主键非空且批次内不重复",
      "外键引用必须指向本批次或已落库实体池",
      "手机号、身份证号、邮箱等字段必须通过格式校验",
      "地址、描述、备注等文本不能使用测试占位内容",
    ],
  };
}

function inferComplianceRule(column) {
  const normalized = `${column?.columnName || ""} ${column?.columnComment || ""}`.toLowerCase();
  if (isJsonColumnType(column?.columnType) || isLikelyJsonField(column)) return "JSON";
  if (/(phone|mobile|tel|手机号|电话)/i.test(normalized)) return "PHONE_CN";
  if (/(id_card|identity|身份证|证件)/i.test(normalized)) return "ID_CARD_CN";
  if (/(email|邮箱)/i.test(normalized)) return "EMAIL";
  if (isLikelyVinField(column)) return "VIN";
  if (/(address|addr|地址)/i.test(normalized)) return "BUSINESS_ADDRESS";
  if (/(desc|description|remark|memo|note|描述|备注|说明)/i.test(normalized)) return "BUSINESS_TEXT";
  if (/(url|链接)/i.test(normalized)) return "URL";
  return "";
}

function buildComplianceProfilesForPrompt(physicalModel) {
  const tables = Array.isArray(physicalModel?.tables) ? physicalModel.tables : [];
  return tables.map((table) => {
    const fields = (Array.isArray(table?.columns) ? table.columns : [])
      .map((column) => {
        const rule = inferComplianceRule(column);
        if (!rule) return null;
        const base = {
          fieldName: column?.columnName,
          fieldComment: column?.columnComment || "",
          columnType: column?.columnType,
          rule,
        };
        if (rule === "PHONE_CN") {
          return { ...base, validation: "中国大陆手机号，必须匹配 ^1[3-9]\\d{9}$" };
        }
        if (rule === "ID_CARD_CN") {
          return { ...base, validation: "18 位中国居民身份证号，6 位地址码 + 8 位出生日期 + 3 位顺序码 + ISO 7064 MOD 11-2 校验位" };
        }
        if (rule === "EMAIL") {
          return { ...base, validation: "标准邮箱地址，local@domain.tld，domain 必须包含合法后缀" };
        }
        if (rule === "VIN") {
          return { ...base, validation: "17 位车辆识别代号，只能使用数字和大写字母，不能包含 I/O/Q" };
        }
        if (rule === "URL") {
          return { ...base, validation: "合法 http 或 https URL，必须包含协议和主机名" };
        }
        if (rule === "JSON") {
          return { ...base, validation: "必须输出 JSON 对象或数组，不能输出普通说明文字" };
        }
        if (rule === "BUSINESS_ADDRESS") {
          return { ...base, validation: "贴合当前业务地域和场景的中文地址，不使用占位词" };
        }
        if (rule === "BUSINESS_TEXT") {
          return { ...base, validation: "贴合当前表语义的自然业务文本，不使用字段名、标签或序号拼接" };
        }
        return base;
      })
      .filter(Boolean);
    return {
      tableName: table?.logicalTableName || table?.physicalTableName,
      physicalTableName: table?.physicalTableName,
      fields,
    };
  }).filter((item) => item.fields.length > 0);
}

function normalizePlanJson(plan, context, requirement, state) {
  const source = safeObject(plan);
  const compactModel = compactPhysicalModelForPrompt(context.physicalModel, context.logicalModel);
  const fallback = buildFallbackPlan(context, requirement, state);
  const rowAllocationSource = Array.isArray(source.rowAllocation) ? source.rowAllocation : fallback.rowAllocation;
  const tableNames = new Set(compactModel.tables.map((table) => String(table.logicalTableName || "")));
  const rowAllocation = rowAllocationSource
    .map((item) => ({
      tableName: text(item?.tableName || item?.logicalTableName, 128),
      physicalTableName: text(item?.physicalTableName, 128) || compactModel.tables.find((table) => table.logicalTableName === item?.tableName)?.physicalTableName || "",
      targetRows: clampInteger(item?.targetRows, 0, 0, MAX_BATCH_ROW_LIMIT),
      reason: text(item?.reason, 512),
    }))
    .filter((item) => item.tableName && tableNames.has(item.tableName));

  return {
    summary: text(source.summary || fallback.summary, 2000),
    industryUnderstanding: Array.isArray(source.industryUnderstanding) ? source.industryUnderstanding.slice(0, 12).map((item) => text(item, 512)) : fallback.industryUnderstanding,
    generationMode: normalizeGenerationMode(source.generationMode || requirement.generationMode),
    generationOrder: Array.isArray(source.generationOrder)
      ? source.generationOrder.map((item) => text(item, 128)).filter((item) => tableNames.has(item))
      : fallback.generationOrder,
    tableRoles: Array.isArray(source.tableRoles) ? source.tableRoles : fallback.tableRoles,
    rowAllocation: rowAllocation.length > 0 ? rowAllocation : fallback.rowAllocation,
    fieldStrategies: Array.isArray(source.fieldStrategies) ? source.fieldStrategies.slice(0, 240) : fallback.fieldStrategies,
    continuityPlan: safeObject(source.continuityPlan || fallback.continuityPlan),
    qualityChecks: Array.isArray(source.qualityChecks) ? source.qualityChecks.slice(0, 20).map((item) => text(item, 512)) : fallback.qualityChecks,
    generatedAt: new Date().toISOString(),
  };
}

function calculatePlanSummary(plan, physicalModel) {
  const tableCount = Array.isArray(physicalModel?.tables) ? physicalModel.tables.length : 0;
  const rowAllocation = Array.isArray(plan?.rowAllocation) ? plan.rowAllocation : [];
  return {
    tableCount,
    allocatedTableCount: rowAllocation.length,
    targetRows: rowAllocation.reduce((sum, item) => sum + Number(item.targetRows || 0), 0),
    businessTableCount: (physicalModel?.tables || []).filter((table) => table.tableKind !== "DICTIONARY").length,
    dictionaryTableCount: (physicalModel?.tables || []).filter((table) => table.tableKind === "DICTIONARY").length,
  };
}

async function insertPlanRecord(context, requirement, plan, validation, generatorMode, modelMeta, user) {
  const [result] = await pool.query(
    `INSERT INTO lab_ai_business_data_plan
      (instance_id, physical_version_no, plan_status, generator_mode, requirement_json, plan_json, validation_json, model_summary, created_by)
     VALUES (?, ?, 'generated', ?, ?, ?, ?, ?, ?)`,
    [
      Number(context.instance.id),
      Number(context.physicalVersion.versionNo),
      generatorMode,
      JSON.stringify(requirement),
      JSON.stringify(plan),
      JSON.stringify(validation || {}),
      text(modelMeta?.summary || plan.summary, 2000),
      user?.displayName || user?.username || "system",
    ]
  );
  return getAiBusinessDataPlanById(Number(result.insertId));
}

function mapPlanRecord(row) {
  const plan = safeJsonParse(row.planJson, null);
  const requirement = safeJsonParse(row.requirementJson, null);
  const validation = safeJsonParse(row.validationJson, null);
  return {
    id: Number(row.id),
    instanceId: Number(row.instanceId),
    instanceName: row.instanceName || null,
    physicalVersionNo: Number(row.physicalVersionNo),
    planStatus: row.planStatus,
    generatorMode: row.generatorMode,
    requirement,
    plan,
    validation,
    summary: calculatePlanSummary(plan, { tables: plan?.tableRoles || [] }),
    modelSummary: row.modelSummary || null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getAiBusinessDataPlanById(planId) {
  const scoped = getScopedWhere("i");
  const [rows] = await pool.query(
    `SELECT p.id, p.instance_id AS instanceId, i.instance_name AS instanceName,
            p.physical_version_no AS physicalVersionNo, p.plan_status AS planStatus,
            p.generator_mode AS generatorMode, p.requirement_json AS requirementJson,
            p.plan_json AS planJson, p.validation_json AS validationJson,
            p.model_summary AS modelSummary, p.created_by AS createdBy,
            p.created_at AS createdAt, p.updated_at AS updatedAt
       FROM lab_ai_business_data_plan p
       JOIN lab_business_system_instance i ON i.id = p.instance_id
      WHERE p.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      LIMIT 1`,
    [Number(planId), ...scoped.params]
  );
  if (!rows[0]) {
    throw new AppError("AI 业务数据方案不存在", 404);
  }
  return mapPlanRecord(rows[0]);
}

async function listAiBusinessDataPlans(instanceId) {
  await getBusinessSystemInstance(instanceId);
  const [rows] = await pool.query(
    `SELECT p.id, p.instance_id AS instanceId, i.instance_name AS instanceName,
            p.physical_version_no AS physicalVersionNo, p.plan_status AS planStatus,
            p.generator_mode AS generatorMode, p.requirement_json AS requirementJson,
            p.plan_json AS planJson, p.validation_json AS validationJson,
            p.model_summary AS modelSummary, p.created_by AS createdBy,
            p.created_at AS createdAt, p.updated_at AS updatedAt
       FROM lab_ai_business_data_plan p
       JOIN lab_business_system_instance i ON i.id = p.instance_id
      WHERE p.instance_id = ?
      ORDER BY p.id DESC
      LIMIT 20`,
    [Number(instanceId)]
  );
  return rows.map(mapPlanRecord);
}

async function generateAiBusinessDataPlan(instanceId, payload = {}, user) {
  const requirement = buildRequirement(payload);
  const context = await resolveGenerationContext(instanceId, payload, { requireTargetDataSource: requirement.generationMode === "incremental" });
  const state = await buildCurrentDataState(context);
  const compactModel = compactPhysicalModelForPrompt(context.physicalModel, context.logicalModel);
  let generatorMode = "ai";
  let modelMeta = null;
  let planJson;

  try {
    const modelResult = await callModelJson(
      PLAN_PROMPT_TYPE,
      {
        systemPrompt: promptDefaults.buildAiBusinessDataPlanDefaultPrompt(),
        userPrompt: promptDefaults.buildAiBusinessDataPlanDefaultUserPrompt(),
        temperature: 0.2,
        maxTokens: 5000,
      },
      {
        input: {
          instance: {
            id: context.instance.id,
            instanceName: context.instance.instanceName,
            templateName: context.instance.templateName,
            templateDesc: context.instance.templateDesc,
            dbType: context.instance.dbType,
          },
          requirement,
          physicalModel: compactModel,
          currentState: state,
          complianceProfiles: buildComplianceProfilesForPrompt(context.physicalModel),
          dictionaryBindings: buildDictionaryBindings(context.physicalModel),
        },
      },
      { timeoutMs: 45000 }
    );
    modelMeta = { ...modelResult.provider, summary: "AI 生成业务数据方案" };
    planJson = normalizePlanJson(modelResult.json, context, requirement, state);
  } catch (error) {
    generatorMode = "fallback";
    modelMeta = { summary: error.message || "模型调用失败" };
    planJson = normalizePlanJson(buildFallbackPlan(context, requirement, state, error.message), context, requirement, state);
  }

  const validation = {
    generatedAt: new Date().toISOString(),
    severity: generatorMode === "ai" ? "info" : "warning",
    warnings: generatorMode === "ai" ? [] : [`未能完成 AI 调用，已使用平台兜底计划：${modelMeta?.summary || ""}`],
    summary: calculatePlanSummary(planJson, context.physicalModel),
  };
  const record = await insertPlanRecord(context, requirement, planJson, validation, generatorMode, modelMeta, user);
  return {
    instance: context.instance,
    plan: record,
    state,
    operator: user?.displayName || user?.username || "system",
  };
}

function isLikelyPhoneField(column) {
  return /(phone|mobile|tel|手机号|联系电话|电话)/i.test(`${column?.columnName || ""} ${column?.columnComment || ""}`);
}

function isLikelyEmailField(column) {
  return /(email|邮箱|电子邮件)/i.test(`${column?.columnName || ""} ${column?.columnComment || ""}`);
}

function isLikelyIdCardField(column) {
  const value = `${column?.columnName || ""} ${column?.columnComment || ""}`;
  return /(id_card|identity|cert_no|身份证|证件号|证件号码)/i.test(value);
}

function isLikelyVinField(column) {
  const name = String(column?.columnName || "").toLowerCase();
  const comment = String(column?.columnComment || "");
  return /(^|[^a-z0-9])vin([^a-z0-9]|$)|vehicle[_-]?vin|车架号|车辆识别码|车辆识别代号|vehicle identification/i.test(`${name} ${comment}`);
}

function isLikelyJsonField(column) {
  return /(^|[_\s-])json($|[_\s-])|json字段|json配置|json对象|json数组|列表json/i.test(`${column?.columnName || ""} ${column?.columnComment || ""}`);
}

function isLikelyUrlField(column) {
  return /(url|uri|link|链接|网址)/i.test(`${column?.columnName || ""} ${column?.columnComment || ""}`);
}

function isLikelyAddressField(column) {
  return /(address|addr|地址|住址)/i.test(`${column?.columnName || ""} ${column?.columnComment || ""}`);
}

function isLikelyNarrativeField(column) {
  return /(desc|description|remark|memo|note|content|summary|描述|备注|说明|内容)/i.test(`${column?.columnName || ""} ${column?.columnComment || ""}`);
}

function isValidChinesePhone(value) {
  return /^1[3-9]\d{9}$/.test(String(value || ""));
}

function isValidEmail(value) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(String(value || ""));
}

function isValidChineseIdCard(value) {
  const code = String(value || "").toUpperCase();
  if (!/^\d{17}[\dX]$/.test(code)) return false;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checks = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
  const sum = weights.reduce((acc, weight, index) => acc + Number(code[index]) * weight, 0);
  return checks[sum % 11] === code[17];
}

function isValidVin(value) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(String(value || "").toUpperCase());
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function containsPlaceholderText(value) {
  return /(测试|示例|样例|占位|随便|未知|无意义|xxx|test|demo|sample|fake|placeholder|null|undefined)/i.test(String(value || ""));
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isBusinessTextColumn(column) {
  const value = `${column?.columnName || ""} ${column?.columnComment || ""}`;
  if (/(id|uuid|guid|pk|fk|no|code|vin|phone|mobile|tel|email|url|身份证|证件|编号|编码|单号|号码|电话|邮箱|链接)/i.test(value)) {
    return false;
  }
  return /(name|title|type|method|status|state|result|level|model|company|store|address|desc|remark|feedback|slot|approver|consultant|姓名|名称|类型|方式|状态|结果|等级|型号|公司|门店|地址|描述|备注|反馈|时间段|审批人|顾问)/i.test(value);
}

function containsSyntheticBusinessText(value, column) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const label = String(column?.columnComment || "").trim();
  if (label && new RegExp(`^${escapeRegExp(label)}\\d+$`).test(raw)) {
    return true;
  }
  return /^(型号|车型|还款方式|审批人|安装公司|试驾门店|试驾结果|试驾里程数|客户评价|预约时间段|充电桩型号|业务记录|记录|名称|类型|状态|结果|等级)\d+$/i.test(raw)
    || /^.+第\d+条业务记录/.test(raw);
}

function isLikelyDictionaryCodeValue(value) {
  const raw = String(value || "").trim();
  if (!raw || /[\u4e00-\u9fa5]/.test(raw)) return false;
  if (/^\d{1,8}$/.test(raw)) return true;
  if (/^[A-Z]{1,12}\d{1,8}$/i.test(raw)) return true;
  if (/^[A-Z0-9][A-Z0-9_-]{0,31}$/i.test(raw) && /\d/.test(raw)) return true;
  return false;
}

function addSyntheticSequenceIssues(table, columns, rows, issues, logicalTableName) {
  if (!Array.isArray(rows) || rows.length < 3) return;
  for (const column of columns || []) {
    const columnName = String(column?.columnName || "");
    if (!columnName || !isBusinessTextColumn(column)) continue;
    const values = rows
      .map((row) => row?.[columnName])
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => value.trim());
    if (values.length < 3) continue;
    if (isDictionaryLikeColumn(column) && values.every(isLikelyDictionaryCodeValue)) continue;
    const parts = values.map((value) => value.match(/^(.{1,16}?)(\d{1,4})$/));
    if (parts.some((match) => !match)) continue;
    const prefix = parts[0][1];
    if (!parts.every((match) => match[1] === prefix)) continue;
    const numbers = parts.map((match) => Number(match[2])).filter(Number.isFinite);
    const uniqueNumbers = new Set(numbers);
    const minNumber = Math.min(...numbers);
    const maxNumber = Math.max(...numbers);
    if (uniqueNumbers.size >= 3 && maxNumber - minNumber <= values.length + 2) {
      issues.push({
        level: "error",
        code: "SYNTHETIC_SEQUENCE_TEXT",
        path: `${logicalTableName}.${columnName}`,
        message: "业务文本疑似字段名/标签加序号的模式化假数据",
      });
    }
  }
}

function normalizeColumnValue(column, value, issues, rowPath) {
  const columnType = String(column?.columnType || "");
  if (value === undefined || value === "") {
    value = null;
  }
  if (value === null) {
    if (!column.isNullable && column.defaultValue == null) {
      issues.push({ level: "error", code: "REQUIRED_MISSING", path: rowPath, message: "必填字段为空" });
    }
    return null;
  }
  if (isNumericColumnType(columnType)) {
    const number = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
    if (!Number.isFinite(number)) {
      issues.push({ level: "error", code: "TYPE_NUMBER", path: rowPath, message: "数值字段不是合法数字" });
      return value;
    }
    return /decimal|numeric|float|double/i.test(columnType) ? Number(number.toFixed(2)) : Math.trunc(number);
  }
  if (isBooleanColumnType(columnType)) {
    if (typeof value === "boolean") return value;
    if (["true", "1", "yes", "y"].includes(String(value).toLowerCase())) return true;
    if (["false", "0", "no", "n"].includes(String(value).toLowerCase())) return false;
    issues.push({ level: "error", code: "TYPE_BOOLEAN", path: rowPath, message: "布尔字段不是合法布尔值" });
    return value;
  }
  if (isDateColumnType(columnType)) {
    const formatted = formatDate(value);
    if (!formatted) {
      issues.push({ level: "error", code: "TYPE_DATE", path: rowPath, message: "日期字段不是合法日期" });
      return value;
    }
    return formatted;
  }
  if (isDateTimeColumnType(columnType)) {
    const formatted = formatDateTime(value);
    if (!formatted) {
      issues.push({ level: "error", code: "TYPE_DATETIME", path: rowPath, message: "时间字段不是合法日期时间" });
      return value;
    }
    return formatted;
  }
  if (isJsonColumnType(columnType)) {
    if (typeof value === "object") return value;
    try {
      return JSON.parse(String(value));
    } catch {
      issues.push({ level: "error", code: "TYPE_JSON", path: rowPath, message: "JSON 字段不是合法 JSON" });
      return value;
    }
  }
  const maxLength = extractVarcharLength(columnType);
  let stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (maxLength > 0 && stringValue.length > maxLength) {
    issues.push({ level: "warning", code: "STRING_TRUNCATED", path: rowPath, message: `字符长度超过 ${maxLength}，已截断` });
    stringValue = stringValue.slice(0, maxLength);
  }
  if (!isJsonColumnType(columnType) && isLikelyJsonField(column)) {
    try {
      const parsed = JSON.parse(stringValue);
      if (!parsed || typeof parsed !== "object") {
        issues.push({ level: "error", code: "JSON_TEXT_INVALID", path: rowPath, message: "JSON 语义字段必须是对象或数组格式" });
      }
    } catch {
      issues.push({ level: "error", code: "JSON_TEXT_INVALID", path: rowPath, message: "JSON 语义字段不是合法 JSON 文本" });
    }
  }
  if (isLikelyPhoneField(column) && !isValidChinesePhone(stringValue)) {
    issues.push({ level: "error", code: "PHONE_INVALID", path: rowPath, message: "手机号未通过中国大陆号码格式校验" });
  }
  if (isLikelyEmailField(column) && !isValidEmail(stringValue)) {
    issues.push({ level: "error", code: "EMAIL_INVALID", path: rowPath, message: "邮箱未通过格式校验" });
  }
  if (isLikelyIdCardField(column) && !isValidChineseIdCard(stringValue)) {
    issues.push({ level: "error", code: "ID_CARD_INVALID", path: rowPath, message: "身份证号未通过校验位校验" });
  }
  if (isLikelyVinField(column) && !isValidVin(stringValue)) {
    issues.push({ level: "error", code: "VIN_INVALID", path: rowPath, message: "VIN 未通过 17 位车辆识别代号格式校验" });
  }
  if (isLikelyUrlField(column) && !isValidHttpUrl(stringValue)) {
    issues.push({ level: "error", code: "URL_INVALID", path: rowPath, message: "URL 未通过 http/https 格式校验" });
  }
  if ((isLikelyAddressField(column) || isLikelyNarrativeField(column)) && containsPlaceholderText(stringValue)) {
    issues.push({ level: "warning", code: "PLACEHOLDER_TEXT", path: rowPath, message: "文本疑似测试占位内容" });
  }
  if (isBusinessTextColumn(column) && containsSyntheticBusinessText(stringValue, column)) {
    issues.push({ level: "error", code: "SYNTHETIC_TEXT", path: rowPath, message: "业务文本疑似字段名/标签加序号的模式化假数据" });
  }
  return stringValue;
}

function normalizeRowsByTable(rawRowsByTable, physicalModel) {
  const { tables, byLogical, byPhysical } = buildTableMaps(physicalModel);
  const rowsByTable = {};
  const source = safeObject(rawRowsByTable?.rowsByTable || rawRowsByTable);
  if (Array.isArray(rawRowsByTable?.tables)) {
    for (const tablePayload of rawRowsByTable.tables) {
      const key = tablePayload?.tableName || tablePayload?.logicalTableName || tablePayload?.physicalTableName;
      if (key) source[key] = tablePayload?.rows || [];
    }
  }

  for (const [rawKey, rows] of Object.entries(source)) {
    const table = byLogical.get(String(rawKey)) || byPhysical.get(String(rawKey));
    if (!table || !Array.isArray(rows)) continue;
    const logicalTableName = String(table.logicalTableName || table.physicalTableName);
    rowsByTable[logicalTableName] = rows.map((row) => safeObject(row));
  }

  for (const table of tables) {
    const logicalTableName = String(table.logicalTableName || table.physicalTableName);
    if (!Array.isArray(rowsByTable[logicalTableName])) {
      rowsByTable[logicalTableName] = [];
    }
  }
  return rowsByTable;
}

function buildExistingValueSet(state, tableName, fieldName) {
  const rows = Array.isArray(state?.entityPools?.[tableName]) ? state.entityPools[tableName] : [];
  return new Set(rows.map((row) => row?.[fieldName]).filter((value) => value !== undefined && value !== null && value !== "").map(String));
}

function validateRowsByTable(physicalModel, rawRowsByTable, state = {}) {
  const rowsByTable = normalizeRowsByTable(rawRowsByTable, physicalModel);
  const { tables } = buildTableMaps(physicalModel);
  const relations = normalizeRelations(physicalModel);
  const issues = [];
  const normalizedRowsByTable = {};
  const primaryKeyValues = {};
  const fieldValues = {};
  const tableSummaries = [];

  for (const table of tables) {
    const logicalTableName = String(table.logicalTableName || table.physicalTableName);
    const rows = rowsByTable[logicalTableName] || [];
    const columns = Array.isArray(table.columns) ? table.columns : [];
    const primaryKey = inferPrimaryKeyColumn(table);
    const pkSet = new Set();
    const tableFieldValues = {};
    const normalizedRows = [];

    rows.forEach((row, rowIndex) => {
      const normalizedRow = {};
      for (const column of columns) {
        const columnName = String(column?.columnName || "");
        if (!columnName) continue;
        normalizedRow[columnName] = normalizeColumnValue(
          column,
          row?.[columnName],
          issues,
          `${logicalTableName}[${rowIndex}].${columnName}`
        );
        if (normalizedRow[columnName] !== null && normalizedRow[columnName] !== undefined && normalizedRow[columnName] !== "") {
          if (!tableFieldValues[columnName]) tableFieldValues[columnName] = new Set();
          tableFieldValues[columnName].add(String(normalizedRow[columnName]));
        }
      }
      if (primaryKey?.columnName) {
        const pkValue = normalizedRow[primaryKey.columnName];
        if (pkValue === null || pkValue === undefined || pkValue === "") {
          issues.push({ level: "error", code: "PRIMARY_KEY_EMPTY", path: `${logicalTableName}[${rowIndex}].${primaryKey.columnName}`, message: "主键不能为空" });
        } else if (pkSet.has(String(pkValue))) {
          issues.push({ level: "error", code: "PRIMARY_KEY_DUPLICATE", path: `${logicalTableName}[${rowIndex}].${primaryKey.columnName}`, message: "主键在当前批次内重复" });
        } else {
          pkSet.add(String(pkValue));
        }
      }
      normalizedRows.push(normalizedRow);
    });
    addSyntheticSequenceIssues(table, columns, normalizedRows, issues, logicalTableName);
    primaryKeyValues[logicalTableName] = pkSet;
    fieldValues[logicalTableName] = tableFieldValues;
    normalizedRowsByTable[logicalTableName] = normalizedRows;
    tableSummaries.push({
      logicalTableName,
      physicalTableName: table.physicalTableName,
      rowCount: normalizedRows.length,
      primaryKey: primaryKey?.columnName || null,
    });
  }

  for (const relation of relations) {
    const fromTable = String(relation?.fromTable || "");
    const toTable = String(relation?.toTable || "");
    const fromField = String(relation?.fromField || "");
    const toField = String(relation?.toField || "");
    if (!fromTable || !toTable || !fromField || !toField) continue;
    const parentValues = new Set([
      ...Array.from(fieldValues[toTable]?.[toField] || primaryKeyValues[toTable] || []),
      ...Array.from(buildExistingValueSet(state, toTable, toField)),
    ]);
    const childRows = normalizedRowsByTable[fromTable] || [];
    childRows.forEach((row, rowIndex) => {
      const value = row?.[fromField];
      if (value === null || value === undefined || value === "") return;
      if (parentValues.size > 0 && !parentValues.has(String(value))) {
        issues.push({
          level: "error",
          code: "FOREIGN_KEY_MISSING",
          path: `${fromTable}[${rowIndex}].${fromField}`,
          message: `外键值未匹配父表 ${toTable}.${toField}`,
        });
      }
    });
  }

  const dictionaryLookup = buildDictionaryLookup(physicalModel, normalizedRowsByTable, state);
  for (const binding of buildDictionaryBindings(physicalModel)) {
    const dictionary = dictionaryLookup.get(binding.dictionaryTableName);
    if (!dictionary || dictionary.codeToRow.size === 0) continue;
    const rows = normalizedRowsByTable[binding.tableName] || [];
    rows.forEach((row, rowIndex) => {
      const value = row?.[binding.fieldName];
      if (value === null || value === undefined || value === "") return;
      if (!dictionary.codeToRow.has(String(value))) {
        issues.push({
          level: "error",
          code: "DICTIONARY_CODE_INVALID",
          path: `${binding.tableName}[${rowIndex}].${binding.fieldName}`,
          message: `字典引用字段必须使用 ${binding.dictionaryTableName}.${binding.codeField} 的代码值`,
        });
      }
    });
  }

  const errorCount = issues.filter((issue) => issue.level === "error").length;
  const warningCount = issues.filter((issue) => issue.level === "warning").length;
  return {
    generatedAt: new Date().toISOString(),
    passed: errorCount === 0,
    errorCount,
    warningCount,
    rowCount: tableSummaries.reduce((sum, item) => sum + Number(item.rowCount || 0), 0),
    tableSummaries,
    issues,
    rowsByTable: normalizedRowsByTable,
  };
}

function buildBatchRowTargets(plan, physicalModel, requirement) {
  const totalRows = clampInteger(requirement.batchRows, DEFAULT_BATCH_ROW_LIMIT, 1, MAX_BATCH_ROW_LIMIT);
  const rowAllocation = Array.isArray(plan?.rowAllocation) ? plan.rowAllocation : [];
  const allocationByTable = new Map(rowAllocation.map((item) => [String(item?.tableName || ""), Number(item?.targetRows || 0)]));
  const businessTables = (physicalModel.tables || []).filter((table) => table.tableKind !== "DICTIONARY");
  const allocatedTotal = businessTables.reduce((sum, table) => sum + Math.max(0, Number(allocationByTable.get(String(table.logicalTableName || "")) || 0)), 0);
  const targets = {};

  for (const table of physicalModel.tables || []) {
    const logicalTableName = String(table.logicalTableName || table.physicalTableName);
    if (table.tableKind === "DICTIONARY") {
      targets[logicalTableName] = requirement.generationMode === "initial" ? Math.min(8, Math.max(0, table.columns?.length || 0)) : 0;
      continue;
    }
    const base = Math.max(0, Number(allocationByTable.get(logicalTableName) || 0));
    if (allocatedTotal > 0) {
      targets[logicalTableName] = Math.max(0, Math.round((totalRows * base) / allocatedTotal));
    } else {
      targets[logicalTableName] = Math.max(1, Math.round(totalRows / Math.max(1, businessTables.length)));
    }
  }

  const currentTotal = Object.entries(targets)
    .filter(([tableName]) => {
      const table = (physicalModel.tables || []).find((item) => String(item.logicalTableName || item.physicalTableName) === tableName);
      return table?.tableKind !== "DICTIONARY";
    })
    .reduce((sum, [, value]) => sum + Number(value || 0), 0);
  if (currentTotal !== totalRows && businessTables.length > 0) {
    const firstBusinessTable = String(businessTables[0].logicalTableName || businessTables[0].physicalTableName);
    targets[firstBusinessTable] = Math.max(1, Number(targets[firstBusinessTable] || 0) + (totalRows - currentTotal));
  }
  return targets;
}

function resolveModelTableRowChunkSize(table) {
  const columnCount = Array.isArray(table?.columns) ? table.columns.length : 0;
  if (columnCount >= 18) return 8;
  if (columnCount >= 12) return 12;
  return MODEL_TABLE_ROW_CHUNK_SIZE;
}

function sliceRowForPrompt(row, columnNames) {
  const result = {};
  for (const columnName of columnNames || []) {
    if (row?.[columnName] !== undefined && row?.[columnName] !== null && row?.[columnName] !== "") {
      result[columnName] = row[columnName];
    }
  }
  return result;
}

function compactRowsForPrompt(table, rows, relations, limit = 80) {
  const source = Array.isArray(rows) ? rows : [];
  const columnNames = pickDisplayColumns(table, relations);
  const selectedColumns = columnNames.length > 0
    ? columnNames
    : (Array.isArray(table?.columns) ? table.columns : []).slice(0, 8).map((column) => String(column?.columnName || "")).filter(Boolean);
  return source.slice(0, limit).map((row) => sliceRowForPrompt(row, selectedColumns));
}

function buildGeneratedRowsContextForPrompt(physicalModel, generatedRowsByTable, state, targetTableName) {
  const relations = normalizeRelations(physicalModel);
  const { byLogical, byPhysical } = buildTableMaps(physicalModel);
  const getTable = (tableName) => byLogical.get(String(tableName || "")) || byPhysical.get(String(tableName || "")) || null;
  const parents = Array.from(new Set(relations
    .filter((relation) => String(relation?.fromTable || "") === String(targetTableName || ""))
    .map((relation) => String(relation?.toTable || ""))
    .filter(Boolean)));
  const sameTable = getTable(targetTableName);
  const allGeneratedRows = {};
  for (const [tableName, rows] of Object.entries(generatedRowsByTable || {})) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const table = getTable(tableName);
    if (!table) continue;
    allGeneratedRows[tableName] = compactRowsForPrompt(table, rows, relations, 40);
  }
  const parentRows = {};
  const currentEntityPools = {};
  for (const parentName of parents) {
    const parentTable = getTable(parentName);
    if (!parentTable) continue;
    const generatedRows = Array.isArray(generatedRowsByTable?.[parentName]) ? generatedRowsByTable[parentName] : [];
    const existingRows = Array.isArray(state?.entityPools?.[parentName]) ? state.entityPools[parentName] : [];
    parentRows[parentName] = compactRowsForPrompt(parentTable, generatedRows.length > 0 ? generatedRows : existingRows, relations, 100);
    currentEntityPools[parentName] = compactRowsForPrompt(parentTable, existingRows, relations, 40);
  }
  if (sameTable) {
    currentEntityPools[targetTableName] = compactRowsForPrompt(
      sameTable,
      Array.isArray(state?.entityPools?.[targetTableName]) ? state.entityPools[targetTableName] : [],
      relations,
      40
    );
  }
  return {
    parentRows,
    sameTableRows: sameTable ? compactRowsForPrompt(sameTable, generatedRowsByTable?.[targetTableName] || [], relations, 40) : [],
    allGeneratedRows,
    currentEntityPools,
    targetDataProfile: (state?.dataProfiles || []).find((item) => String(item?.tableName || "") === String(targetTableName || "")) || null,
    targetDictionaryBindings: buildDictionaryBindings(physicalModel).filter((item) => String(item.tableName) === String(targetTableName || "")),
    dictionaryTables: Array.isArray(state?.dictionaryTables) ? state.dictionaryTables : [],
  };
}

async function generateAiBusinessDataTableChunkWithModel(context, requirement, plan, state, compactModel, table, chunkOptions = {}) {
  const logicalTableName = String(table?.logicalTableName || table?.physicalTableName || "");
  const rowCount = clampInteger(chunkOptions.rowCount, 0, 0, MAX_BATCH_ROW_LIMIT);
  if (!logicalTableName || rowCount <= 0) {
    return { rows: [], modelMeta: null };
  }
  const relations = normalizeRelations(context.physicalModel);
  const modelResult = await callModelJson(
    BATCH_PROMPT_TYPE,
    {
      systemPrompt: promptDefaults.buildAiBusinessDataBatchDefaultPrompt(),
      userPrompt: promptDefaults.buildAiBusinessDataBatchDefaultUserPrompt(),
      temperature: 0.35,
      maxTokens: 4500,
    },
    {
      input: {
        instance: {
          id: context.instance.id,
          instanceName: context.instance.instanceName,
          templateName: context.instance.templateName,
          templateDesc: context.instance.templateDesc,
          dbType: context.instance.dbType,
        },
        requirement: {
          ...requirement,
          batchRows: rowCount,
        },
        rowTargets: {
          [logicalTableName]: rowCount,
        },
        plan,
        physicalModel: compactModel,
        currentState: state,
        complianceProfiles: buildComplianceProfilesForPrompt(context.physicalModel),
        dictionaryBindings: buildDictionaryBindings(context.physicalModel),
        generatedRowsContext: buildGeneratedRowsContextForPrompt(
          context.physicalModel,
          chunkOptions.generatedRowsByTable || {},
          state,
          logicalTableName
        ),
        tableGenerationFocus: {
          tableName: logicalTableName,
          physicalTableName: table.physicalTableName || logicalTableName,
          rowOffset: clampInteger(chunkOptions.rowOffset, 0, 0, MAX_BATCH_ROW_LIMIT),
          rowCount,
          totalTargetRows: clampInteger(chunkOptions.totalTargetRows, rowCount, rowCount, MAX_BATCH_ROW_LIMIT),
          chunkIndex: clampInteger(chunkOptions.chunkIndex, 1, 1, MAX_BATCH_ROW_LIMIT),
          chunkCount: clampInteger(chunkOptions.chunkCount, 1, 1, MAX_BATCH_ROW_LIMIT),
          primaryKey: inferPrimaryKeyColumn(table)?.columnName || null,
          columns: (table.columns || []).map((column) => ({
            columnName: column.columnName,
            columnType: column.columnType,
            columnComment: column.columnComment || "",
            isPrimaryKey: Boolean(column.isPrimaryKey),
            isNullable: Boolean(column.isNullable),
          })),
          relations: relations.filter((relation) => String(relation?.fromTable || "") === logicalTableName || String(relation?.toTable || "") === logicalTableName),
        },
      },
    },
    { timeoutMs: 60000, maxTokens: 4500 }
  );
  const normalized = normalizeRowsByTable(modelResult.json, { tables: [table], relations: [] });
  const rows = normalized[logicalTableName] || [];
  if (rows.length !== rowCount) {
    throw new AppError(`${logicalTableName} 分片返回 ${rows.length} 行，期望 ${rowCount} 行`, 400);
  }
  return {
    rows,
    modelMeta: {
      ...modelResult.provider,
      summary: `AI 分片生成 ${logicalTableName} ${rowCount} 行`,
    },
  };
}

async function generateAiBusinessDataRowsByTableWithModel(context, requirement, plan, state, rowTargets, compactModel) {
  const relations = normalizeRelations(context.physicalModel);
  const sortedTables = sortTablesForGeneration(context.physicalModel.tables || [], relations);
  const rowsByTable = {};
  const modelCalls = [];
  for (const table of sortedTables) {
    const logicalTableName = String(table?.logicalTableName || table?.physicalTableName || "");
    if (!logicalTableName) continue;
    const totalTargetRows = Math.max(0, Number(rowTargets[logicalTableName] || 0));
    rowsByTable[logicalTableName] = [];
    if (totalTargetRows <= 0) continue;
    const chunkSize = resolveModelTableRowChunkSize(table);
    const chunkCount = Math.ceil(totalTargetRows / chunkSize);
    for (let rowOffset = 0, chunkIndex = 1; rowOffset < totalTargetRows; rowOffset += chunkSize, chunkIndex += 1) {
      const rowCount = Math.min(chunkSize, totalTargetRows - rowOffset);
      try {
        const chunkResult = await generateAiBusinessDataTableChunkWithModel(
          context,
          requirement,
          plan,
          state,
          compactModel,
          table,
          {
            generatedRowsByTable: rowsByTable,
            rowOffset,
            rowCount,
            totalTargetRows,
            chunkIndex,
            chunkCount,
          }
        );
        rowsByTable[logicalTableName].push(...chunkResult.rows);
        if (chunkResult.modelMeta) {
          modelCalls.push({ tableName: logicalTableName, rowOffset, rowCount, retriedForJson: Boolean(chunkResult.modelMeta.retriedForJson) });
        }
      } catch (error) {
        throw new AppError(`${logicalTableName} 第 ${chunkIndex}/${chunkCount} 个分片生成失败：${error.message || "模型调用失败"}`, 400);
      }
    }
  }
  return {
    rowsByTable,
    modelMeta: {
      summary: `AI 按表分片生成业务数据批次，共 ${modelCalls.length} 次模型调用`,
      chunkCount: modelCalls.length,
      retriedChunkCount: modelCalls.filter((item) => item.retriedForJson).length,
    },
  };
}

function seededInteger(seed, min, max) {
  let hash = 0;
  const input = String(seed || "");
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  const range = Math.max(1, max - min + 1);
  return min + (Math.abs(hash) % range);
}

function buildChineseIdCard(index) {
  const body = `110101${formatDate(new Date(1985 + (index % 20), index % 12, (index % 26) + 1)).replace(/-/g, "")}${String(index + 11).padStart(3, "0").slice(-3)}`;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checks = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
  const sum = weights.reduce((acc, weight, position) => acc + Number(body[position]) * weight, 0);
  return `${body}${checks[sum % 11]}`;
}

function buildChinesePhone(index) {
  const prefixes = ["130", "131", "135", "136", "137", "138", "139", "150", "151", "152", "157", "158", "159", "166", "172", "178", "180", "185", "186", "188", "189", "199"];
  const prefix = prefixes[Math.abs(index) % prefixes.length];
  return `${prefix}${String(10000000 + ((Math.abs(index) * 7919) % 90000000)).slice(0, 8)}`;
}

function buildEmailAddress(index, row = {}, maxLength = 0) {
  const domains = ["qq.com", "163.com", "126.com", "foxmail.com", "outlook.com"];
  const localSeeds = ["liwei", "wangxin", "zhangyu", "chenhao", "liujia", "sunlei", "zhaonan", "zhoulin"];
  const candidateKey = Object.entries(row)
    .find(([key, value]) => /(customer|user|client|person|员工|客户|用户|人员).*?(no|code|id|编号|编码)/i.test(key) && value)?.[1];
  const suffix = String(candidateKey || index).replace(/[^A-Za-z0-9]/g, "").slice(-6).toLowerCase() || String(index);
  const local = `${localSeeds[Math.abs(index) % localSeeds.length]}${suffix}`;
  const preferredDomains = [
    domains[Math.abs(index) % domains.length],
    ...domains,
  ];
  for (const domain of Array.from(new Set(preferredDomains))) {
    const maxLocalLength = Number(maxLength) > 0 ? Number(maxLength) - domain.length - 1 : local.length;
    if (maxLocalLength >= 1) {
      return `${local.slice(0, maxLocalLength)}@${domain}`;
    }
  }
  return `${local}@qq.com`;
}

function buildVin(index) {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  let value = "L";
  let seed = Math.abs(index) + 17;
  while (value.length < 17) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    value += chars[seed % chars.length];
  }
  return value;
}

function buildBusinessUrl(tableName, rowIndex, maxLength = 0) {
  const path = String(tableName || "business").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "business";
  const url = `https://data-service.cn/${path}/${String(rowIndex + 1).padStart(6, "0")}`;
  if (!maxLength || url.length <= Number(maxLength)) return url;
  const shortUrl = `https://d.cn/${String(rowIndex + 1)}`;
  if (shortUrl.length <= Number(maxLength)) return shortUrl;
  return "https://d.cn";
}

function buildJsonStringValue(value, maxLength = 0) {
  const normalized = value && typeof value === "object" ? value : { value };
  const limit = Number(maxLength || 0);
  const full = JSON.stringify(normalized);
  if (!limit || full.length <= limit) return full;
  if (Array.isArray(normalized)) return limit >= 2 ? "[]" : "";
  const rawValue = normalized.value === undefined ? full : String(normalized.value);
  const overhead = JSON.stringify({ value: "" }).length;
  const textLimit = Math.max(0, limit - overhead);
  const compact = JSON.stringify({ value: rawValue.slice(0, textLimit) });
  if (compact.length <= limit) return compact;
  return limit >= 2 ? "{}" : "";
}

function buildComplianceSeed(tableName, columnName, rowIndex, row) {
  const pkValue = Object.entries(row || {}).find(([key]) => /(id|no|code|编号|编码|单号)$/i.test(key))?.[1];
  return seededInteger(`${tableName}:${columnName}:${rowIndex}:${pkValue || ""}`, 1000, 999999);
}

function nextUniqueGeneratedValue(generator, usedValues) {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const value = generator(attempt);
    if (!usedValues.has(String(value))) {
      usedValues.add(String(value));
      return value;
    }
  }
  const fallback = generator(2001);
  usedValues.add(String(fallback));
  return fallback;
}

function addExistingComplianceValues(usedValues, state, tableName, columnName) {
  const rows = Array.isArray(state?.entityPools?.[tableName]) ? state.entityPools[tableName] : [];
  for (const row of rows) {
    const value = row?.[columnName];
    if (value !== undefined && value !== null && value !== "") {
      usedValues.add(String(value));
    }
  }
}

function buildDictionaryLookup(physicalModel, rowsByTable, state) {
  const { byLogical } = buildTableMaps(physicalModel);
  const lookup = new Map();
  for (const dictionaryTable of state?.dictionaryTables || []) {
    const tableName = String(dictionaryTable?.tableName || "");
    const codeField = dictionaryTable?.codeField || "item_code";
    const labelField = dictionaryTable?.labelField || "item_label";
    const rows = Array.isArray(dictionaryTable?.rows) ? dictionaryTable.rows : [];
    const codeToRow = new Map();
    const labelToCode = new Map();
    for (const row of rows) {
      const code = row?.itemCode ?? row?.[codeField];
      const label = row?.itemLabel ?? row?.[labelField];
      if (code !== undefined && code !== null && code !== "") {
        codeToRow.set(String(code), row);
      }
      if (label !== undefined && label !== null && label !== "" && code !== undefined && code !== null && code !== "") {
        labelToCode.set(String(label), String(code));
      }
    }
    lookup.set(tableName, { codeField, labelField, codeToRow, labelToCode });
  }
  for (const table of Array.isArray(physicalModel?.tables) ? physicalModel.tables : []) {
    if (table?.tableKind !== "DICTIONARY") continue;
    const tableName = String(table.logicalTableName || table.physicalTableName);
    const meta = getDictionaryTableMeta(table);
    const rows = Array.isArray(rowsByTable?.[tableName]) ? rowsByTable[tableName] : [];
    if (rows.length === 0 && lookup.has(tableName)) continue;
    const current = lookup.get(tableName) || {
      codeField: meta.codeField,
      labelField: meta.labelField,
      codeToRow: new Map(),
      labelToCode: new Map(),
    };
    for (const row of rows) {
      const code = row?.[meta.codeField];
      const label = row?.[meta.labelField];
      if (code !== undefined && code !== null && code !== "") {
        current.codeToRow.set(String(code), row);
      }
      if (label !== undefined && label !== null && label !== "" && code !== undefined && code !== null && code !== "") {
        current.labelToCode.set(String(label), String(code));
      }
    }
    lookup.set(tableName, current);
  }
  for (const tableName of Array.from(lookup.keys())) {
    if (!byLogical.has(tableName)) lookup.delete(tableName);
  }
  return lookup;
}

function findDataProfileField(state, tableName, columnName) {
  const profile = (Array.isArray(state?.dataProfiles) ? state.dataProfiles : [])
    .find((item) => String(item?.tableName || "") === String(tableName || ""));
  return (profile?.fields || []).find((field) => String(field?.fieldName || "") === String(columnName || "")) || null;
}

function formatNumberForObservedPattern(number, observedFormat) {
  if (!Number.isFinite(number)) return null;
  const decimalPlaces = clampInteger(observedFormat?.numericStats?.decimalPlaces, 0, 0, 4);
  if (decimalPlaces <= 0) return String(Math.round(number));
  return Number(number.toFixed(decimalPlaces)).toFixed(decimalPlaces).replace(/\.?0+$/, "");
}

function alignValueToObservedFormat(value, observedFormat) {
  if (!observedFormat || observedFormat.dominantKind === "empty") return value;
  const raw = normalizeProfileValue(value);
  if (!raw) return value;
  const parsedNumber = parseProfileNumber(raw);
  if (!parsedNumber) return value;
  if (observedFormat.dominantKind === "number_with_unit" && observedFormat.unitSuffix) {
    let nextNumber = parsedNumber.number;
    if (!parsedNumber.unit && observedFormat.unitSuffix === "万" && Math.abs(nextNumber) >= 10000) {
      nextNumber = nextNumber / 10000;
    }
    const formatted = formatNumberForObservedPattern(nextNumber, observedFormat);
    return formatted === null ? value : `${formatted}${observedFormat.unitSuffix}`;
  }
  if (observedFormat.dominantKind === "plain_integer" || observedFormat.dominantKind === "plain_decimal") {
    let nextNumber = parsedNumber.number;
    if (parsedNumber.unit === "万") {
      nextNumber = nextNumber * 10000;
    }
    if (observedFormat.dominantKind === "plain_integer") {
      return Math.round(nextNumber);
    }
    const formatted = formatNumberForObservedPattern(nextNumber, observedFormat);
    return formatted === null ? value : Number(formatted);
  }
  return value;
}

function canonicalizeRowsByComplianceProfile(physicalModel, rawRowsByTable, options = {}) {
  const rowsByTable = normalizeRowsByTable(rawRowsByTable, physicalModel);
  const { tables } = buildTableMaps(physicalModel);
  const state = options.state || {};
  const changes = [];
  const usedValuesByField = new Map();
  const dictionaryLookup = buildDictionaryLookup(physicalModel, rowsByTable, state);
  const dictionaryBindings = buildDictionaryBindings(physicalModel);
  const dictionaryBindingMap = new Map(dictionaryBindings.map((binding) => [`${binding.tableName}.${binding.fieldName}`, binding]));

  function usedSet(tableName, columnName) {
    const key = `${tableName}.${columnName}`;
    if (!usedValuesByField.has(key)) {
      const values = new Set();
      addExistingComplianceValues(values, state, tableName, columnName);
      usedValuesByField.set(key, values);
    }
    return usedValuesByField.get(key);
  }

  for (const table of tables) {
    const logicalTableName = String(table.logicalTableName || table.physicalTableName);
    const rows = Array.isArray(rowsByTable[logicalTableName]) ? rowsByTable[logicalTableName] : [];
    const columns = Array.isArray(table.columns) ? table.columns : [];
    rows.forEach((row, rowIndex) => {
      for (const column of columns) {
        const columnName = String(column?.columnName || "");
        if (!columnName) continue;
        const currentValue = row[columnName];
        const usedValues = usedSet(logicalTableName, columnName);
        const seed = buildComplianceSeed(logicalTableName, columnName, rowIndex, row);
        const maxLength = extractVarcharLength(column.columnType);
        let nextValue = currentValue;
        let rule = "";
        const dictionaryBinding = dictionaryBindingMap.get(`${logicalTableName}.${columnName}`);

        if (dictionaryBinding) {
          const dictionary = dictionaryLookup.get(dictionaryBinding.dictionaryTableName);
          const current = String(currentValue ?? "").trim();
          if (current && dictionary) {
            if (dictionary.codeToRow.has(current)) {
              nextValue = current;
            } else if (dictionary.labelToCode.has(current)) {
              nextValue = dictionary.labelToCode.get(current);
              rule = "DICTIONARY_CODE";
            } else if (dictionary.codeToRow.size > 0) {
              const codes = Array.from(dictionary.codeToRow.keys());
              nextValue = codes[Math.abs(seed) % codes.length];
              rule = "DICTIONARY_CODE";
            }
          }
        }

        const jsonComplianceField = !rule && (isJsonColumnType(column.columnType) || isLikelyJsonField(column));
        if (jsonComplianceField) {
          if (currentValue === undefined || currentValue === null || currentValue === "") {
            if (!column.isNullable && column.defaultValue == null) {
              nextValue = isJsonColumnType(column.columnType) ? {} : buildJsonStringValue({}, maxLength);
              rule = "JSON";
            }
          } else if (typeof currentValue !== "object") {
            let parsedValue;
            try {
              const parsed = JSON.parse(String(currentValue));
              parsedValue = parsed && typeof parsed === "object" ? parsed : { value: parsed };
            } catch {
              parsedValue = { value: text(currentValue, 500) };
            }
            nextValue = isJsonColumnType(column.columnType) ? parsedValue : buildJsonStringValue(parsedValue, maxLength);
            rule = "JSON";
          } else if (!isJsonColumnType(column.columnType)) {
            nextValue = buildJsonStringValue(currentValue, maxLength);
            rule = "JSON";
          }
        } else if (isLikelyIdCardField(column)) {
          const current = String(currentValue || "").toUpperCase();
          if (!isValidChineseIdCard(current) || usedValues.has(current)) {
            nextValue = nextUniqueGeneratedValue((attempt) => buildChineseIdCard(seed + attempt), usedValues);
            rule = "ID_CARD_CN";
          } else {
            usedValues.add(current);
            nextValue = current;
          }
        } else if (isLikelyPhoneField(column)) {
          const current = String(currentValue || "");
          if (!isValidChinesePhone(current) || usedValues.has(current)) {
            nextValue = nextUniqueGeneratedValue((attempt) => buildChinesePhone(seed + attempt), usedValues);
            rule = "PHONE_CN";
          } else {
            usedValues.add(current);
          }
        } else if (isLikelyEmailField(column)) {
          const current = String(currentValue || "").toLowerCase();
          if (!isValidEmail(current) || usedValues.has(current)) {
            nextValue = nextUniqueGeneratedValue((attempt) => buildEmailAddress(seed + attempt, row, maxLength), usedValues);
            rule = "EMAIL";
          } else {
            usedValues.add(current);
            nextValue = current;
          }
        } else if (isLikelyVinField(column)) {
          const current = String(currentValue || "").toUpperCase();
          if (!isValidVin(current) || usedValues.has(current)) {
            nextValue = nextUniqueGeneratedValue((attempt) => buildVin(seed + attempt), usedValues);
            rule = "VIN";
          } else {
            usedValues.add(current);
            nextValue = current;
          }
        } else if (isLikelyUrlField(column)) {
          const current = String(currentValue || "");
          if (!isValidHttpUrl(current)) {
            nextValue = buildBusinessUrl(logicalTableName, seed + rowIndex, maxLength);
            rule = "URL";
          } else {
            usedValues.add(current);
          }
        }

        if (!rule && !dictionaryBinding && !isJsonColumnType(column.columnType)) {
          const profileField = findDataProfileField(state, logicalTableName, columnName);
          const alignedValue = alignValueToObservedFormat(nextValue, profileField?.observedFormat);
          if (String(alignedValue ?? "") !== String(nextValue ?? "")) {
            nextValue = alignedValue;
            rule = "DATA_PROFILE_FORMAT";
          }
        }

        if (rule && String(nextValue) !== String(currentValue ?? "")) {
          row[columnName] = nextValue;
          changes.push({
            tableName: logicalTableName,
            columnName,
            rowIndex,
            rule,
          });
        }
      }
    });
    rowsByTable[logicalTableName] = rows;
  }

  return {
    rowsByTable,
    summary: {
      changedCount: changes.length,
      rules: Array.from(new Set(changes.map((item) => item.rule))),
      samples: changes.slice(0, 50),
    },
  };
}

function buildFallbackStringValue(column, table, rowIndex, context) {
  const name = String(column?.columnName || "").toLowerCase();
  const comment = String(column?.columnComment || "");
  const tableLabel = table?.logicalLabel || table?.tableComment || table?.logicalTableName || "业务";
  const seed = `${table?.logicalTableName || table?.physicalTableName}-${name}-${rowIndex}`;
  const cities = ["北京市朝阳区望京街道", "上海市浦东新区张江镇", "深圳市南山区科技园", "杭州市滨江区长河街道", "成都市高新区天府大道"];
  const surnames = ["王", "李", "张", "刘", "陈", "杨", "赵", "周"];
  const givenNames = ["一诺", "子涵", "思远", "雨桐", "明轩", "若曦", "嘉豪", "梓萱"];
  if (isLikelyPhoneField(column)) return `1${[3, 5, 6, 7, 8, 9][rowIndex % 6]}${String(100000000 + rowIndex * 7919).slice(0, 9)}`;
  if (isLikelyEmailField(column)) return `user${String(rowIndex + 1).padStart(4, "0")}@example.com`;
  if (isLikelyIdCardField(column)) return buildChineseIdCard(rowIndex);
  if (isLikelyAddressField(column)) return `${cities[rowIndex % cities.length]}${seededInteger(seed, 18, 268)}号`;
  if (/(name|姓名|联系人|客户名|用户名)/i.test(`${name} ${comment}`)) return `${surnames[rowIndex % surnames.length]}${givenNames[rowIndex % givenNames.length]}`;
  if (/(status|状态)/i.test(`${name} ${comment}`)) return ["active", "pending", "completed", "approved"][rowIndex % 4];
  if (/(type|category|类型|分类|类别)/i.test(`${name} ${comment}`)) return ["standard", "premium", "enterprise", "personal"][rowIndex % 4];
  if (/(url|链接)/i.test(`${name} ${comment}`)) return `https://assets.example.com/${table.logicalTableName || table.physicalTableName}/${rowIndex + 1}`;
  if (/(vin|车辆识别)/i.test(`${name} ${comment}`)) return `L${String(1000000000000000 + rowIndex * 37).slice(0, 16)}`;
  if (/(order|bill|invoice|serial|no|code|编号|单号|编码)/i.test(`${name} ${comment}`)) return `${String(table.logicalTableName || "biz").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}${String(rowIndex + 1).padStart(6, "0")}`;
  if (isLikelyNarrativeField(column)) return `${tableLabel}第${rowIndex + 1}条业务记录，来源于${context.instanceName}批次生成。`;
  return `${comment || tableLabel}${rowIndex + 1}`;
}

function buildFallbackValue(column, table, rowIndex, context) {
  const type = String(column?.columnType || "");
  if (isNumericColumnType(type)) {
    if (/(amount|price|fee|金额|价格|费用)/i.test(`${column?.columnName || ""} ${column?.columnComment || ""}`)) {
      return Number((seededInteger(`${table.logicalTableName}-${column.columnName}-${rowIndex}`, 5000, 900000) / 100).toFixed(2));
    }
    return seededInteger(`${table.logicalTableName}-${column.columnName}-${rowIndex}`, 1, 9999);
  }
  if (isBooleanColumnType(type)) return rowIndex % 2 === 0;
  if (isDateColumnType(type)) {
    const start = new Date(context.timelineStartAt || "2025-01-01");
    start.setDate(start.getDate() + (rowIndex % Math.max(1, context.timelineDays || 90)));
    return formatDate(start);
  }
  if (isDateTimeColumnType(type)) {
    const start = new Date(context.timelineStartAt || "2025-01-01T09:00:00");
    start.setHours(start.getHours() + rowIndex);
    return formatDateTime(start);
  }
  if (isJsonColumnType(type)) return {};
  return buildFallbackStringValue(column, table, rowIndex, context);
}

function buildFallbackRows(context, requirement, plan, state) {
  const physicalModel = context.physicalModel;
  const targets = buildBatchRowTargets(plan, physicalModel, requirement);
  const relations = normalizeRelations(physicalModel);
  const sortedTables = sortTablesForGeneration(physicalModel.tables || [], relations);
  const rowsByTable = {};

  for (const table of sortedTables) {
    const logicalTableName = String(table.logicalTableName || table.physicalTableName);
    const rowCount = Math.max(0, Number(targets[logicalTableName] || 0));
    const tableRelations = relations.filter((relation) => String(relation?.fromTable || "") === logicalTableName);
    const rows = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = {};
      for (const relation of tableRelations) {
        const parentTable = String(relation.toTable || "");
        const parentRows = rowsByTable[parentTable] || [];
        const existingRows = Array.isArray(state?.entityPools?.[parentTable]) ? state.entityPools[parentTable] : [];
        const selected = parentRows[rowIndex % Math.max(1, parentRows.length)] || existingRows[rowIndex % Math.max(1, existingRows.length)];
        if (selected && relation.fromField && relation.toField && selected[relation.toField] !== undefined) {
          row[relation.fromField] = selected[relation.toField];
        }
      }
      for (const column of table.columns || []) {
        const columnName = String(column?.columnName || "");
        if (!columnName || row[columnName] !== undefined) continue;
        row[columnName] = buildFallbackValue(column, table, rowIndex, {
          instanceName: context.instance.instanceName,
          timelineStartAt: requirement.timelineStartAt,
          timelineDays: requirement.timelineDays,
        });
      }
      rows.push(row);
    }
    rowsByTable[logicalTableName] = rows;
  }
  return rowsByTable;
}

function buildBatchPreview(rowsByTable, physicalModel, limit = 5) {
  const tableMap = new Map((physicalModel.tables || []).map((table) => [String(table.logicalTableName || table.physicalTableName), table]));
  return Object.entries(rowsByTable || {}).map(([tableName, rows]) => {
    const table = tableMap.get(tableName) || {};
    return {
      logicalTableName: tableName,
      physicalTableName: table.physicalTableName || tableName,
      tableComment: table.tableComment || table.logicalLabel || "",
      rowCount: Array.isArray(rows) ? rows.length : 0,
      columns: (table.columns || [])
        .map((column) => ({
          columnName: String(column.columnName || ""),
          columnComment: String(column.columnComment || ""),
        }))
        .filter((column) => column.columnName),
      rows: (Array.isArray(rows) ? rows : []).slice(0, limit),
    };
  });
}

async function insertBatchRecord(context, planRecord, requirement, rowsByTable, validation, generatorMode, modelMeta, user) {
  const [versionRows] = await pool.query(
    `SELECT batch_no AS batchNo
       FROM lab_ai_business_data_batch
      WHERE instance_id = ?
      ORDER BY batch_no DESC
      LIMIT 1`,
    [Number(context.instance.id)]
  );
  const batchNo = Number(versionRows?.[0]?.batchNo || 0) + 1;
  const [result] = await pool.query(
    `INSERT INTO lab_ai_business_data_batch
      (instance_id, plan_id, physical_version_no, batch_no, generation_mode, batch_status, generator_mode,
       requirement_json, rows_json, validation_json, load_summary_json, model_summary, created_by)
     VALUES (?, ?, ?, ?, ?, 'previewed', ?, ?, ?, ?, NULL, ?, ?)`,
    [
      Number(context.instance.id),
      planRecord ? Number(planRecord.id) : null,
      Number(context.physicalVersion.versionNo),
      batchNo,
      requirement.generationMode,
      generatorMode,
      JSON.stringify(requirement),
      JSON.stringify(rowsByTable),
      JSON.stringify(validation),
      text(modelMeta?.summary || "AI 生成业务数据批次", 2000),
      user?.displayName || user?.username || "system",
    ]
  );
  return getAiBusinessDataBatchById(Number(result.insertId), { includeRows: true });
}

function mapBatchRecord(row, options = {}) {
  const previewSourceRows = (options.includeRows || options.includePreviewRows) ? safeJsonParse(row.rowsJson, {}) : null;
  const rowsByTable = options.includeRows ? previewSourceRows : null;
  const validation = safeJsonParse(row.validationJson, null);
  const loadSummary = safeJsonParse(row.loadSummaryJson, null);
  const requirement = safeJsonParse(row.requirementJson, null);
  const previewModel = options.previewPhysicalModel || { tables: validation?.tableSummaries?.map((item) => ({ ...item, columns: [] })) || [] };
  return {
    id: Number(row.id),
    instanceId: Number(row.instanceId),
    instanceName: row.instanceName || null,
    planId: row.planId == null ? null : Number(row.planId),
    physicalVersionNo: Number(row.physicalVersionNo),
    batchNo: Number(row.batchNo),
    generationMode: row.generationMode,
    batchStatus: row.batchStatus,
    generatorMode: row.generatorMode,
    requirement,
    validation,
    loadSummary,
    rowsByTable,
    previewTables: previewSourceRows ? buildBatchPreview(previewSourceRows || {}, previewModel) : [],
    modelSummary: row.modelSummary || null,
    createdBy: row.createdBy,
    loadedAt: row.loadedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getAiBusinessDataBatchById(batchId, options = {}) {
  const scoped = getScopedWhere("i");
  const [rows] = await pool.query(
    `SELECT b.id, b.instance_id AS instanceId, i.instance_name AS instanceName,
            b.plan_id AS planId, b.physical_version_no AS physicalVersionNo, b.batch_no AS batchNo,
            b.generation_mode AS generationMode, b.batch_status AS batchStatus, b.generator_mode AS generatorMode,
            b.requirement_json AS requirementJson, b.rows_json AS rowsJson, b.validation_json AS validationJson,
            b.load_summary_json AS loadSummaryJson, b.model_summary AS modelSummary,
            b.created_by AS createdBy, b.loaded_at AS loadedAt, b.created_at AS createdAt, b.updated_at AS updatedAt
       FROM lab_ai_business_data_batch b
       JOIN lab_business_system_instance i ON i.id = b.instance_id
      WHERE b.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      LIMIT 1`,
    [Number(batchId), ...scoped.params]
  );
  if (!rows[0]) {
    throw new AppError("AI 业务数据批次不存在", 404);
  }
  let previewPhysicalModel = null;
  if (options.includeRows || options.includePreviewRows) {
    const [versionRows] = await pool.query(
      `SELECT physical_model_json AS physicalModelJson
         FROM lab_physical_model_version
        WHERE instance_id = ? AND version_no = ?
        LIMIT 1`,
      [Number(rows[0].instanceId), Number(rows[0].physicalVersionNo)]
    );
    previewPhysicalModel = safeJsonParse(versionRows?.[0]?.physicalModelJson, null);
  }
  return mapBatchRecord(rows[0], { ...options, previewPhysicalModel });
}

async function listAiBusinessDataBatches(instanceId) {
  await getBusinessSystemInstance(instanceId);
  const [rows] = await pool.query(
    `SELECT b.id, b.instance_id AS instanceId, i.instance_name AS instanceName,
            b.plan_id AS planId, b.physical_version_no AS physicalVersionNo, b.batch_no AS batchNo,
            b.generation_mode AS generationMode, b.batch_status AS batchStatus, b.generator_mode AS generatorMode,
            b.requirement_json AS requirementJson, b.rows_json AS rowsJson, b.validation_json AS validationJson,
            b.load_summary_json AS loadSummaryJson, b.model_summary AS modelSummary,
            b.created_by AS createdBy, b.loaded_at AS loadedAt, b.created_at AS createdAt, b.updated_at AS updatedAt
       FROM lab_ai_business_data_batch b
       JOIN lab_business_system_instance i ON i.id = b.instance_id
      WHERE b.instance_id = ?
      ORDER BY b.id DESC
      LIMIT 20`,
    [Number(instanceId)]
  );
  const versionNos = Array.from(new Set(rows.map((row) => Number(row.physicalVersionNo || 0)).filter(Boolean)));
  const modelByVersion = new Map();
  for (const versionNo of versionNos) {
    const [versionRows] = await pool.query(
      `SELECT version_no AS versionNo, physical_model_json AS physicalModelJson
         FROM lab_physical_model_version
        WHERE instance_id = ? AND version_no = ?
        LIMIT 1`,
      [Number(instanceId), versionNo]
    );
    if (versionRows[0]) {
      modelByVersion.set(versionNo, safeJsonParse(versionRows[0].physicalModelJson, null));
    }
  }
  return rows.map((row) => mapBatchRecord(row, {
    includePreviewRows: true,
    previewPhysicalModel: modelByVersion.get(Number(row.physicalVersionNo || 0)) || null,
  }));
}

async function getLatestAiBusinessDataPlan(instanceId, physicalVersionNo) {
  await getBusinessSystemInstance(instanceId);
  const [rows] = await pool.query(
    `SELECT p.id
       FROM lab_ai_business_data_plan p
      WHERE p.instance_id = ? AND p.physical_version_no = ?
      ORDER BY p.id DESC
      LIMIT 1`,
    [Number(instanceId), Number(physicalVersionNo)]
  );
  return rows[0] ? getAiBusinessDataPlanById(Number(rows[0].id)) : null;
}

function mapTaskRecord(row) {
  const planJson = safeJsonParse(row.planJson, null);
  return {
    id: Number(row.id),
    taskName: row.taskName,
    instanceId: Number(row.instanceId),
    instanceName: row.instanceName || null,
    templateName: row.templateName || null,
    physicalVersionNo: Number(row.physicalVersionNo),
    targetDataSourceId: row.targetDataSourceId == null ? null : Number(row.targetDataSourceId),
    targetDataSourceName: row.targetDataSourceName || null,
    targetDataSourceType: row.targetDataSourceType || null,
    planId: row.planId == null ? null : Number(row.planId),
    planSummary: planJson?.summary || row.planModelSummary || null,
    taskStatus: row.taskStatus,
    scheduleEnabled: Boolean(Number(row.scheduleEnabled || 0)),
    scheduleType: row.scheduleType || "manual",
    cronExpr: row.cronExpr || null,
    generationMode: row.generationMode || "incremental",
    totalRows: Number(row.totalRows || 0),
    batchRows: Number(row.batchRows || 0),
    timelineStartAt: row.timelineStartAt || null,
    timelineDays: Number(row.timelineDays || 0),
    requirementText: row.requirementText || "",
    autoLoad: Boolean(Number(row.autoLoad || 0)),
    loadMode: row.loadMode || "append",
    runCount: Number(row.runCount || 0),
    lastBatchId: row.lastBatchId == null ? null : Number(row.lastBatchId),
    lastRunStatus: row.lastRunStatus || null,
    lastRunMessage: row.lastRunMessage || null,
    lastRunAt: row.lastRunAt || null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function queryAiBusinessDataTasks(whereSql = "", params = []) {
  const scoped = getScopedWhere("t");
  const normalizedWhereSql = String(whereSql || "").trim();
  const finalWhereSql = scoped.sql
    ? `${normalizedWhereSql || "WHERE 1=1"} AND ${scoped.sql}`
    : normalizedWhereSql;
  const finalParams = scoped.sql ? [...params, ...scoped.params] : params;
  const [rows] = await pool.query(
    `SELECT t.id, t.task_name AS taskName, t.instance_id AS instanceId,
            i.instance_name AS instanceName, tpl.template_name AS templateName,
            t.physical_version_no AS physicalVersionNo,
            t.target_data_source_id AS targetDataSourceId,
            ds.source_name AS targetDataSourceName, ds.source_type AS targetDataSourceType,
            t.plan_id AS planId, p.model_summary AS planModelSummary, p.plan_json AS planJson,
            t.task_status AS taskStatus, t.schedule_enabled AS scheduleEnabled,
            t.schedule_type AS scheduleType, t.cron_expr AS cronExpr,
            t.generation_mode AS generationMode, t.total_rows AS totalRows, t.batch_rows AS batchRows,
            t.timeline_start_at AS timelineStartAt, t.timeline_days AS timelineDays,
            t.requirement_text AS requirementText, t.auto_load AS autoLoad, t.load_mode AS loadMode,
            t.run_count AS runCount, t.last_batch_id AS lastBatchId,
            t.last_run_status AS lastRunStatus, t.last_run_message AS lastRunMessage,
            t.last_run_at AS lastRunAt, t.created_by AS createdBy, t.created_at AS createdAt, t.updated_at AS updatedAt
       FROM lab_ai_business_data_task t
       JOIN lab_business_system_instance i ON i.id = t.instance_id
       JOIN lab_business_system_template tpl ON tpl.id = i.template_id
       LEFT JOIN data_lab_sources ds ON ds.id = t.target_data_source_id
       LEFT JOIN lab_ai_business_data_plan p ON p.id = t.plan_id
      ${finalWhereSql}
      ORDER BY t.updated_at DESC, t.id DESC`,
    finalParams
  );
  return rows.map(mapTaskRecord);
}

async function listAiBusinessDataTasks(options = {}) {
  if (options.instanceId) {
    return queryAiBusinessDataTasks("WHERE t.instance_id = ?", [Number(options.instanceId)]);
  }
  return queryAiBusinessDataTasks("", []);
}

async function getAiBusinessDataTaskById(taskId) {
  const tasks = await queryAiBusinessDataTasks("WHERE t.id = ?", [Number(taskId)]);
  if (!tasks[0]) {
    throw new AppError("AI 业务数据任务不存在", 404);
  }
  return tasks[0];
}

async function saveAiBusinessDataTask(payload = {}, user) {
  const projectId = getCurrentProjectId();
  const taskId = payload.id ? Number(payload.id) : null;
  const existing = taskId ? await getAiBusinessDataTaskById(taskId) : null;
  const instanceId = Number(payload.instanceId || existing?.instanceId || 0);
  if (!instanceId) {
    throw new AppError("请选择物理模型实例", 400);
  }
  const physicalVersionNo = Number(payload.physicalVersionNo || existing?.physicalVersionNo || 0);
  const targetDataSourceId = Number(payload.targetDataSourceId || existing?.targetDataSourceId || 0);
  const context = await resolveGenerationContext(instanceId, { physicalVersionNo, targetDataSourceId }, { requireTargetDataSource: true });
  let planId = payload.planId === undefined ? existing?.planId : (payload.planId ? Number(payload.planId) : null);
  if (!planId) {
    const latestPlan = await getLatestAiBusinessDataPlan(context.instance.id, context.physicalVersion.versionNo);
    planId = latestPlan?.id || null;
  }
  if (planId) {
    const plan = await getAiBusinessDataPlanById(planId);
    if (Number(plan.instanceId) !== Number(context.instance.id) || Number(plan.physicalVersionNo) !== Number(context.physicalVersion.versionNo)) {
      throw new AppError("任务绑定的数据方案与物理模型版本不一致", 400);
    }
  }
  const scheduleType = normalizeScheduleType(payload.scheduleType ?? existing?.scheduleType);
  const scheduleEnabled = scheduleType !== "manual" && boolFlag(payload.scheduleEnabled ?? existing?.scheduleEnabled);
  const cronExpr = scheduleType === "manual" ? null : buildTaskCronExpression(scheduleType, payload.cronExpr ?? existing?.cronExpr);
  const generationMode = normalizeGenerationMode(payload.generationMode || existing?.generationMode || "incremental");
  const totalRows = clampInteger(payload.totalRows ?? existing?.totalRows, 300, 1, MAX_BATCH_ROW_LIMIT);
  const batchRows = clampInteger(payload.batchRows ?? existing?.batchRows, Math.min(totalRows, DEFAULT_BATCH_ROW_LIMIT), 1, MAX_BATCH_ROW_LIMIT);
  const taskName = text(payload.taskName || existing?.taskName || `${context.instance.instanceName} V${context.physicalVersion.versionNo} 增量造数`, 128);
  const values = [
    taskName,
    Number(context.instance.id),
    Number(context.physicalVersion.versionNo),
    Number(context.targetDataSource.id),
    planId || null,
    scheduleEnabled ? "running" : "stopped",
    scheduleEnabled ? 1 : 0,
    scheduleType,
    cronExpr,
    generationMode,
    totalRows,
    batchRows,
    text(payload.timelineStartAt ?? existing?.timelineStartAt, 64) || null,
    clampInteger(payload.timelineDays ?? existing?.timelineDays, 90, 1, 3650),
    text(payload.requirementText ?? existing?.requirementText, 4000),
    boolFlag(payload.autoLoad ?? existing?.autoLoad) ? 1 : 0,
    normalizeLoadMode(payload.loadMode || existing?.loadMode),
  ];
  if (existing) {
    await pool.query(
      `UPDATE lab_ai_business_data_task
          SET task_name = ?, instance_id = ?, physical_version_no = ?, target_data_source_id = ?,
              plan_id = ?, task_status = ?, schedule_enabled = ?, schedule_type = ?, cron_expr = ?,
              generation_mode = ?, total_rows = ?, batch_rows = ?, timeline_start_at = ?, timeline_days = ?,
              requirement_text = ?, auto_load = ?, load_mode = ?
        WHERE id = ?${projectId ? " AND project_id = ?" : ""}`,
      [...values, Number(existing.id), ...(projectId ? [projectId] : [])]
    );
    return getAiBusinessDataTaskById(existing.id);
  }
  const [result] = await pool.query(
    `INSERT INTO lab_ai_business_data_task
      (project_id, task_name, instance_id, physical_version_no, target_data_source_id, plan_id,
       task_status, schedule_enabled, schedule_type, cron_expr, generation_mode,
       total_rows, batch_rows, timeline_start_at, timeline_days, requirement_text,
       auto_load, load_mode, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [projectId, ...values, user?.displayName || user?.username || "system"]
  );
  return getAiBusinessDataTaskById(Number(result.insertId));
}

async function updateAiBusinessDataTaskSchedule(taskId, payload = {}) {
  const task = await getAiBusinessDataTaskById(taskId);
  const scoped = getScopedWhere("");
  const scheduleEnabled = task.scheduleType !== "manual" && boolFlag(payload.scheduleEnabled);
  await pool.query(
    `UPDATE lab_ai_business_data_task
        SET schedule_enabled = ?, task_status = ?
      WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [scheduleEnabled ? 1 : 0, scheduleEnabled ? "running" : "stopped", Number(task.id), ...scoped.params]
  );
  return getAiBusinessDataTaskById(task.id);
}

async function deleteAiBusinessDataTask(taskId) {
  const task = await getAiBusinessDataTaskById(taskId);
  const scoped = getScopedWhere("");
  await pool.query(`DELETE FROM lab_ai_business_data_task WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`, [Number(task.id), ...scoped.params]);
  return { id: Number(task.id), instanceId: Number(task.instanceId) };
}

async function listSchedulableAiBusinessDataTasks() {
  return queryAiBusinessDataTasks("WHERE t.schedule_enabled = 1 AND t.task_status = 'running'", []);
}

async function markAiBusinessDataTaskRun(taskId, status, message, batchId = null) {
  await pool.query(
    `UPDATE lab_ai_business_data_task
        SET last_run_status = ?, last_run_message = ?, last_run_at = CURRENT_TIMESTAMP,
            last_batch_id = ?, run_count = run_count + ?
      WHERE id = ?`,
    [status, text(message, 2000), batchId ? Number(batchId) : null, status === "running" ? 0 : 1, Number(taskId)]
  );
}

async function runAiBusinessDataTask(taskId, options = {}, user) {
  const task = await getAiBusinessDataTaskById(taskId);
  await markAiBusinessDataTaskRun(task.id, "running", options.triggerType === "schedule" ? "调度执行中" : "手动执行中", task.lastBatchId);
  try {
    const generationMode = options.triggerType === "schedule" ? "incremental" : normalizeGenerationMode(task.generationMode || "incremental");
    const batchResult = await generateAiBusinessDataBatch(task.instanceId, {
      planId: task.planId,
      physicalVersionNo: task.physicalVersionNo,
      targetDataSourceId: task.targetDataSourceId,
      generationMode,
      totalRows: task.totalRows,
      batchRows: task.batchRows,
      timelineStartAt: task.timelineStartAt,
      timelineDays: task.timelineDays,
      requirementText: task.requirementText,
    }, user || { username: "system" });
    let loadResult = null;
    if (task.autoLoad) {
      loadResult = await loadAiBusinessDataBatch(task.instanceId, batchResult.batch.id, {
        targetDataSourceId: task.targetDataSourceId,
        loadMode: task.loadMode,
      }, user || { username: "system" });
    }
    const message = loadResult
      ? `已生成批次 #${batchResult.batch.batchNo} 并落库 ${Number(loadResult.loadSummary?.loadedRowCount || 0)} 行`
      : `已生成预览批次 #${batchResult.batch.batchNo}`;
    await markAiBusinessDataTaskRun(task.id, "success", message, batchResult.batch.id);
    return {
      task: await getAiBusinessDataTaskById(task.id),
      ...batchResult,
      loadSummary: loadResult?.loadSummary || null,
    };
  } catch (error) {
    await markAiBusinessDataTaskRun(task.id, "failed", error.message || "任务执行失败", null);
    throw error;
  }
}

async function generateAiBusinessDataBatch(instanceId, payload = {}, user) {
  const requirement = buildRequirement({
    ...payload,
    generationMode: payload.generationMode || "incremental",
  });
  const context = await resolveGenerationContext(instanceId, payload, { requireTargetDataSource: requirement.generationMode === "incremental" });
  const state = await buildCurrentDataState(context);
  let planRecord = null;
  if (payload.planId) {
    planRecord = await getAiBusinessDataPlanById(Number(payload.planId));
    if (Number(planRecord.instanceId) !== Number(context.instance.id)) {
      throw new AppError("AI 业务数据方案不属于当前实例", 400);
    }
  }
  const plan = planRecord?.plan || buildFallbackPlan(context, requirement, state);
  const rowTargets = buildBatchRowTargets(plan, context.physicalModel, requirement);
  const compactModel = compactPhysicalModelForPrompt(context.physicalModel, context.logicalModel);
  let generatorMode = "ai";
  let modelMeta = null;
  let rowsByTable;

  try {
    const modelResult = await generateAiBusinessDataRowsByTableWithModel(
      context,
      requirement,
      plan,
      state,
      rowTargets,
      compactModel
    );
    const canonicalized = canonicalizeRowsByComplianceProfile(
      context.physicalModel,
      modelResult.rowsByTable,
      { state }
    );
    const changedCount = Number(canonicalized.summary?.changedCount || 0);
    modelMeta = {
      ...modelResult.modelMeta,
      complianceSummary: canonicalized.summary,
      summary: changedCount > 0
        ? `${modelResult.modelMeta?.summary || "AI 生成业务数据批次"}；平台修正 ${changedCount} 个强规则字段`
        : `${modelResult.modelMeta?.summary || "AI 生成业务数据批次"}；平台强规则校验无修正`,
    };
    rowsByTable = canonicalized.rowsByTable;
  } catch (error) {
    throw new AppError(`AI 业务数据批次生成失败，未生成可审核数据：${error.message || "模型调用失败"}`, 400);
  }

  const validation = validateRowsByTable(context.physicalModel, rowsByTable, state);
  const batchRecord = await insertBatchRecord(context, planRecord, requirement, validation.rowsByTable, validation, generatorMode, modelMeta, user);
  return {
    instance: context.instance,
    plan: planRecord,
    batch: {
      ...batchRecord,
      rowsByTable: validation.rowsByTable,
      previewTables: buildBatchPreview(validation.rowsByTable, context.physicalModel),
    },
    state,
    operator: user?.displayName || user?.username || "system",
  };
}

function buildInsertStatementsForRows(dataSource, table, rows, options = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }
  const dbType = normalizePlatformSourceType(dataSource.sourceType, dataSource.connectionConfig || {});
  const schema = dbType === "postgresql" ? dataSource.connectionConfig.schema : null;
  const batchSize = clampInteger(options?.batchSize, 200, 50, 1000);
  const qualifiedTableName = buildQualifiedTableReference(dbType, table.physicalTableName, schema);
  const columns = Array.isArray(table?.columns) ? table.columns : [];
  const primaryKeyColumns = columns.filter((column) => column.isPrimaryKey).map((column) => quoteIdentifier(dbType, column.columnName));
  const columnSql = columns.map((column) => quoteIdentifier(dbType, column.columnName)).join(", ");
  const statements = [];
  for (let start = 0; start < rows.length; start += batchSize) {
    const batchRows = rows.slice(start, start + batchSize);
    const valuesSql = batchRows.map((row) => (
      `(${columns.map((column) => formatSqlValue(dbType, column.columnType, row?.[column.columnName])).join(", ")})`
    )).join(",\n");
    if (dbType === "postgresql" && primaryKeyColumns.length > 0) {
      statements.push(
        `INSERT INTO ${qualifiedTableName} (${columnSql}) VALUES\n${valuesSql}\nON CONFLICT (${primaryKeyColumns.join(", ")}) DO NOTHING;`
      );
      continue;
    }
    if (dbType === "mysql" && primaryKeyColumns.length > 0) {
      statements.push(`INSERT IGNORE INTO ${qualifiedTableName} (${columnSql}) VALUES\n${valuesSql};`);
      continue;
    }
    statements.push(`INSERT INTO ${qualifiedTableName} (${columnSql}) VALUES\n${valuesSql};`);
  }
  return statements;
}

function buildDeleteStatement(dataSource, physicalTableName) {
  const dbType = normalizePlatformSourceType(dataSource.sourceType, dataSource.connectionConfig || {});
  const schema = dbType === "postgresql" ? dataSource.connectionConfig.schema : null;
  return `DELETE FROM ${buildQualifiedTableReference(dbType, physicalTableName, schema)}`;
}

async function loadRowsToDataSource(dataSource, physicalModel, rowsByTable, loadMode) {
  const sortedTables = sortTablesForGeneration(physicalModel.tables || [], normalizeRelations(physicalModel));
  const tableMap = new Map(sortedTables.map((table) => [String(table.logicalTableName || table.physicalTableName), table]));
  const deleteLogs = [];
  const insertLogs = [];

  if (loadMode === "replace") {
    for (const table of [...sortedTables].reverse()) {
      const physicalTableName = String(table.physicalTableName || "");
      if (!physicalTableName) continue;
      const tableLogs = await executeSqlStatementsOnDataSource(dataSource, [buildDeleteStatement(dataSource, physicalTableName)]);
      deleteLogs.push({
        logicalTableName: String(table.logicalTableName || physicalTableName),
        physicalTableName,
        statementCount: tableLogs.length,
      });
    }
  }

  for (const [logicalTableName, rows] of Object.entries(rowsByTable || {})) {
    const table = tableMap.get(logicalTableName);
    if (!table || !Array.isArray(rows) || rows.length === 0) continue;
    const tableLogs = await executeSqlStatementsOnDataSource(
      dataSource,
      buildInsertStatementsForRows(dataSource, table, rows, { batchSize: 200 })
    );
    insertLogs.push({
      logicalTableName,
      physicalTableName: table.physicalTableName,
      rowCount: rows.length,
      statementCount: tableLogs.length,
    });
  }

  return {
    loadedAt: new Date().toISOString(),
    loadMode,
    targetDataSourceId: Number(dataSource.id),
    targetDataSourceName: dataSource.sourceName,
    targetDataSourceCode: dataSource.sourceCode,
    deletedTableCount: deleteLogs.length,
    loadedTableCount: insertLogs.length,
    loadedRowCount: insertLogs.reduce((sum, item) => sum + Number(item.rowCount || 0), 0),
    tables: insertLogs,
  };
}

async function upsertGenerationState(context, state, loadSummary) {
  const nextState = {
    ...state,
    lastLoadSummary: loadSummary,
    updatedAt: new Date().toISOString(),
  };
  await pool.query(
    `INSERT INTO lab_ai_business_data_state
      (instance_id, physical_version_no, target_data_source_id, state_json)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       physical_version_no = VALUES(physical_version_no),
       target_data_source_id = VALUES(target_data_source_id),
       state_json = VALUES(state_json),
       updated_at = CURRENT_TIMESTAMP`,
    [
      Number(context.instance.id),
      Number(context.physicalVersion.versionNo),
      context.targetDataSource ? Number(context.targetDataSource.id) : null,
      JSON.stringify(nextState),
    ]
  );
  return nextState;
}

async function loadAiBusinessDataBatch(instanceId, batchId, payload = {}, user) {
  const batch = await getAiBusinessDataBatchById(batchId, { includeRows: true });
  if (Number(batch.instanceId) !== Number(instanceId)) {
    throw new AppError("AI 业务数据批次不属于当前实例", 400);
  }
  if (batch.generatorMode !== "ai") {
    throw new AppError("当前批次不是 AI 成功生成的数据，禁止确认落库，请重新生成 AI 预览批次", 400);
  }
  const context = await resolveGenerationContext(instanceId, {
    physicalVersionNo: batch.physicalVersionNo,
    targetDataSourceId: payload.targetDataSourceId || batch.requirement?.targetDataSourceId,
  }, { requireTargetDataSource: true });
  const state = await buildCurrentDataState(context);
  const canonicalized = canonicalizeRowsByComplianceProfile(
    context.physicalModel,
    batch.rowsByTable || {},
    { state }
  );
  const validation = validateRowsByTable(context.physicalModel, canonicalized.rowsByTable, state);
  if (!validation.passed) {
    throw new AppError(`批次校验未通过，存在 ${validation.errorCount} 个阻断问题，请重新生成或修正后再落库`, 400);
  }
  if (Number(canonicalized.summary?.changedCount || 0) > 0) {
    await pool.query(
      `UPDATE lab_ai_business_data_batch
          SET rows_json = ?, validation_json = ?, model_summary = ?
        WHERE id = ?`,
      [
        JSON.stringify(validation.rowsByTable),
        JSON.stringify(validation),
        text(`${batch.modelSummary || "AI 生成业务数据批次"}；落库前平台修正 ${canonicalized.summary.changedCount} 个强规则字段`, 2000),
        Number(batchId),
      ]
    );
  }
  const loadMode = normalizeLoadMode(payload.loadMode);
  const loadSummary = await loadRowsToDataSource(context.targetDataSource, context.physicalModel, validation.rowsByTable, loadMode);
  await pool.query(
    `UPDATE lab_ai_business_data_batch
        SET batch_status = 'loaded', validation_json = ?, load_summary_json = ?, loaded_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [JSON.stringify(validation), JSON.stringify(loadSummary), Number(batchId)]
  );
  await upsertGenerationState(context, await buildCurrentDataState(context), loadSummary);
  return {
    instance: context.instance,
    batch: await getAiBusinessDataBatchById(batchId, { includeRows: false }),
    loadSummary,
    operator: user?.displayName || user?.username || "system",
  };
}

module.exports = {
  listAiBusinessDataPlans,
  generateAiBusinessDataPlan,
  listAiBusinessDataBatches,
  generateAiBusinessDataBatch,
  loadAiBusinessDataBatch,
  listAiBusinessDataTasks,
  saveAiBusinessDataTask,
  updateAiBusinessDataTaskSchedule,
  deleteAiBusinessDataTask,
  listSchedulableAiBusinessDataTasks,
  runAiBusinessDataTask,
  validateRowsByTable,
  canonicalizeRowsByComplianceProfile,
  buildComplianceProfilesForPrompt,
  buildDictionaryBindings,
};
