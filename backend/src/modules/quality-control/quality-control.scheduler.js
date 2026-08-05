const cron = require("node-cron");
const { v4: uuidv4 } = require("uuid");
const repository = require("./quality-control.repository");
const { buildQualitySqlBundle } = require("./quality-control.sql-builder");
const ruleNormalizer = require("./quality-control.rule-normalizer");
const { getAdapter } = require("../data-development/adapters");
const { parseTableName } = require("../data-development/data-development.utils");
const {
  inferDatasourceDialect,
  normalizeDatasourceType,
  resolveDatasourceConnection,
} = require("../../common/utils/datasource-dialect");
const metadataService = require("../data-sources/data-source.metadata");
const resultCollector = require("./quality-result-collector.service");
const { buildQualityBatchId } = require("./quality-control.batch-id");

const scheduledTasks = new Map();

function normalizeDialect(value) {
  const dialect = String(value || "").trim().toLowerCase();
  return dialect === "gaussdb" ? "postgresql" : dialect;
}

function quoteIdentifier(identifier, dialect = "mysql") {
  return metadataService.escapeIdentifier(identifier, dialect);
}

function quoteValue(value) {
  return metadataService.escapeValue(value);
}

function normalizeDateTime(value) {
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
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function applyTimeAnchor(date, anchor) {
  const next = new Date(date.getTime());
  const normalizedAnchor = String(anchor || "now");

  if (normalizedAnchor === "day_start") {
    next.setHours(0, 0, 0, 0);
    return next;
  }

  if (normalizedAnchor === "day_end") {
    next.setHours(23, 59, 59, 999);
    return next;
  }

  return next;
}

function applyTimeOffset(date, offsetValue, offsetUnit) {
  const next = new Date(date.getTime());
  const offset = Number(offsetValue || 0);
  const unit = String(offsetUnit || "day");
  if (!offset) {
    return next;
  }
  if (unit === "second") next.setSeconds(next.getSeconds() + offset);
  else if (unit === "minute") next.setMinutes(next.getMinutes() + offset);
  else if (unit === "hour") next.setHours(next.getHours() + offset);
  else if (unit === "month") next.setMonth(next.getMonth() + offset);
  else if (unit === "year") next.setFullYear(next.getFullYear() + offset);
  else next.setDate(next.getDate() + offset);
  return next;
}

function formatTaskTimeValue(date, formatType) {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const hour = padNumber(date.getHours());
  const minute = padNumber(date.getMinutes());
  const second = padNumber(date.getSeconds());
  const normalizedFormat = String(formatType || "datetime");

  if (normalizedFormat === "date") return `${year}-${month}-${day}`;
  if (normalizedFormat === "compact_date") return `${year}${month}${day}`;
  if (normalizedFormat === "compact_datetime") return `${year}${month}${day}${hour}${minute}${second}`;
  if (normalizedFormat === "month") return `${year}${month}`;
  if (normalizedFormat === "epoch_seconds") return Math.floor(date.getTime() / 1000);
  if (normalizedFormat === "epoch_millis") return date.getTime();
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function resolveDynamicTimeValue(options = {}) {
  const baseDate = applyTimeAnchor(new Date(), options.anchor);
  const offsetDate = applyTimeOffset(baseDate, options.offsetValue, options.offsetUnit);
  return formatTaskTimeValue(offsetDate, options.formatType);
}

function getIncrementalMode(fetchConfig = {}) {
  return fetchConfig.incrementalMode === "time_window" ? "time_window" : "cursor";
}

function buildRuntimeDatasource(source) {
  const resolved = resolveDatasourceConnection(source?.sourceType, source?.connectionConfig || {});
  const dialect = normalizeDialect(inferDatasourceDialect(source?.sourceType, source?.connectionConfig || {}));
  return {
    sourceType: source.sourceType,
    storageType: normalizeDatasourceType(source.sourceType),
    type: dialect,
    host: resolved.host,
    port: Number(resolved.port || 0) || 0,
    databaseName: resolved.database,
    username: resolved.username,
    password: resolved.password,
    extraConfig: {
      schema: resolved.schema || undefined,
      jdbcUrl: resolved.jdbcUrl || undefined,
      driverClassName: resolved.driverClassName || undefined,
      connectionMode: resolved.connectionMode || undefined,
    },
  };
}

function normalizeProfileFieldsFromColumns(columns = []) {
  return (Array.isArray(columns) ? columns : []).map((column) => ({
    columnName: String(column?.columnName || "").trim(),
    columnComment: String(column?.columnComment || "").trim(),
    dataType: String(column?.dataType || column?.columnType || "").trim(),
    columnType: String(column?.columnType || column?.dataType || "").trim(),
    isNullable: Boolean(column?.isNullable),
    isPrimaryKey: Boolean(column?.isPrimaryKey),
  })).filter((column) => column.columnName);
}

async function buildRuleProfileForTask(source, task, strategyVersion) {
  const snapshot = strategyVersion?.profileSnapshot && typeof strategyVersion.profileSnapshot === "object"
    ? strategyVersion.profileSnapshot
    : {};
  const profileFields = Array.isArray(snapshot.fields) && snapshot.fields.length
    ? snapshot.fields
    : normalizeProfileFieldsFromColumns(await metadataService.listColumns(source, task.tableName));

  return {
    fields: profileFields,
    tableCatalog: Array.isArray(snapshot.tableCatalog) ? snapshot.tableCatalog : [],
    relatedTableMetadata: Array.isArray(snapshot.relatedTableMetadata) ? snapshot.relatedTableMetadata : [],
  };
}

function startScheduler() {
  console.log("[QualityScheduler] Starting quality scheduler...");
  void loadScheduledTasks();
}

async function loadScheduledTasks() {
  const tasks = await repository.getScheduledTasks();
  for (const task of tasks) {
    await scheduleTask(task);
  }
  console.log(`[QualityScheduler] Loaded ${scheduledTasks.size} scheduled quality tasks`);
}

async function scheduleTask(task) {
  if (!task?.scheduleEnabled || !task.scheduleConfig || task.scheduleConfig.scheduleType === "manual" || task.status !== "active") {
    return false;
  }

  const taskKey = String(task.id);
  if (scheduledTasks.has(taskKey)) {
    await unscheduleTask(task.id);
  }

  const cronExpr = buildCronExpression(task.scheduleConfig);
  if (!cron.validate(cronExpr)) {
    console.error(`[QualityScheduler] Invalid cron expression for task ${task.id}: ${cronExpr}`);
    return false;
  }

  const scheduledJob = cron.schedule(
    cronExpr,
    async () => {
      const latestTask = await repository.getTaskById(task.id);
      if (!latestTask || latestTask.status !== "active") return;
      await runTask(latestTask.id);
    },
    {
      scheduled: true,
      timezone: task.scheduleConfig.timezone || "Asia/Shanghai",
    }
  );

  scheduledTasks.set(taskKey, scheduledJob);
  return true;
}

async function unscheduleTask(taskId) {
  const key = String(taskId);
  const scheduled = scheduledTasks.get(key);
  if (!scheduled) return false;
  scheduled.stop();
  scheduledTasks.delete(key);
  return true;
}

function parseRunTime(runTime) {
  if (typeof runTime !== "string" || !runTime.includes(":")) {
    return { hour: 0, minute: 0 };
  }
  const [hourText, minuteText] = runTime.split(":");
  const hour = Math.min(23, Math.max(0, Number(hourText) || 0));
  const minute = Math.min(59, Math.max(0, Number(minuteText) || 0));
  return { hour, minute };
}

function buildCronExpression(scheduleConfig = {}) {
  const { scheduleType, cronExpression, intervalMs, runTime, weekDays, monthDay } = scheduleConfig;
  if (scheduleType === "cron" && cronExpression) {
    return cronExpression;
  }
  if (scheduleType === "interval" && intervalMs) {
    const seconds = Math.max(1, Math.floor(intervalMs / 1000));
    if (seconds < 60) {
      return `*/${seconds} * * * * *`;
    }
    const minutes = Math.max(1, Math.floor(seconds / 60));
    return `*/${minutes} * * * *`;
  }
  const { hour, minute } = parseRunTime(runTime);
  if (scheduleType === "daily") return `${minute} ${hour} * * *`;
  if (scheduleType === "weekly") {
    const normalizedWeekDays = Array.isArray(weekDays) && weekDays.length > 0 ? weekDays.join(",") : "1";
    return `${minute} ${hour} * * ${normalizedWeekDays}`;
  }
  if (scheduleType === "monthly") {
    return `${minute} ${hour} ${Number(monthDay || 1)} * *`;
  }
  return cronExpression || "0 0 * * *";
}

function buildSystemTimeCutoff(fetchConfig = {}) {
  if (!fetchConfig.systemTimeField) return null;
  return resolveDynamicTimeValue({
    formatType: fetchConfig.systemTimeFormatType || "datetime",
    offsetValue: fetchConfig.systemTimeOffsetValue || 0,
    offsetUnit: fetchConfig.systemTimeOffsetUnit || "day",
  });
}

function buildIncrementalStartValue(fetchConfig = {}) {
  if (getIncrementalMode(fetchConfig) === "cursor" && fetchConfig.lastValue !== null && fetchConfig.lastValue !== undefined && fetchConfig.lastValue !== "") {
    return fetchConfig.lastValue;
  }
  if (fetchConfig.startValueMode === "dynamic_time") {
    return resolveDynamicTimeValue({
      formatType: fetchConfig.startValueFormatType || "datetime",
      offsetValue: fetchConfig.startValueOffsetValue || 0,
      offsetUnit: fetchConfig.startValueOffsetUnit || "day",
      anchor: fetchConfig.startValueAnchor || "now",
    });
  }
  return fetchConfig.startValue;
}

function buildIncrementalEndValue(fetchConfig = {}, fallbackValue = null) {
  if (getIncrementalMode(fetchConfig) === "cursor") {
    return fallbackValue;
  }
  if (fetchConfig.endValueMode === "dynamic_time") {
    return resolveDynamicTimeValue({
      formatType: fetchConfig.endValueFormatType || "datetime",
      offsetValue: fetchConfig.endValueOffsetValue || 0,
      offsetUnit: fetchConfig.endValueOffsetUnit || "day",
      anchor: fetchConfig.endValueAnchor || "now",
    });
  }
  return fetchConfig.endValue;
}

function buildTaskFilterSql(task, dialect, nextCursorValue = null) {
  const fetchConfig = task.fetchConfig || {};
  const whereParts = [];
  const fetchMode = String(task.fetchMode || "full");
  const incrementalMode = getIncrementalMode(fetchConfig);
  const cutoff = buildSystemTimeCutoff(fetchConfig);
  const incrementalStartValue = buildIncrementalStartValue(fetchConfig);
  const incrementalEndValue = buildIncrementalEndValue(fetchConfig, nextCursorValue);

  if (fetchConfig.systemTimeField && cutoff) {
    whereParts.push(`${quoteIdentifier(fetchConfig.systemTimeField, dialect)} <= ${quoteValue(cutoff)}`);
  }

  if (fetchMode === "incremental") {
    const column = String(fetchConfig.incrementalColumn || "").trim();
    if (!column) {
      throw new Error("Incremental fetch requires incrementalColumn");
    }
    if (incrementalMode === "time_window") {
      if (incrementalStartValue !== null && incrementalStartValue !== undefined && incrementalStartValue !== "") {
        whereParts.push(`${quoteIdentifier(column, dialect)} >= ${quoteValue(incrementalStartValue)}`);
      }
      if (incrementalEndValue !== null && incrementalEndValue !== undefined && incrementalEndValue !== "") {
        whereParts.push(`${quoteIdentifier(column, dialect)} < ${quoteValue(incrementalEndValue)}`);
      }
    } else {
      if (nextCursorValue === null || nextCursorValue === undefined || nextCursorValue === "") {
        whereParts.push("1 = 0");
      } else {
        if (incrementalStartValue !== null && incrementalStartValue !== undefined && incrementalStartValue !== "") {
          whereParts.push(`${quoteIdentifier(column, dialect)} > ${quoteValue(incrementalStartValue)}`);
        }
        whereParts.push(`${quoteIdentifier(column, dialect)} <= ${quoteValue(nextCursorValue)}`);
      }
    }
  }

  const whereClause = whereParts.length ? ` WHERE ${whereParts.join(" AND ")}` : "";
  const orderClause = fetchMode === "incremental" && fetchConfig.incrementalColumn
    ? ` ORDER BY ${quoteIdentifier(fetchConfig.incrementalColumn, dialect)} ASC`
    : "";
  const limitClause = fetchMode === "sample" && Number(fetchConfig.sampleSize || 0) > 0
    ? (["oracle", "dm"].includes(normalizeDialect(dialect))
      ? ` FETCH FIRST ${Number(fetchConfig.sampleSize)} ROWS ONLY`
      : ` LIMIT ${Number(fetchConfig.sampleSize)}`)
    : "";

  return {
    cutoff,
    incrementalStartValue,
    incrementalEndValue,
    sql: `SELECT * FROM ${quoteIdentifier(task.tableName, dialect)}${whereClause}${orderClause}${limitClause}`,
  };
}

async function querySingleValue(runtimeDatasource, sql, fieldName) {
  const adapter = getAdapter(runtimeDatasource);
  const result = await adapter.executeQuery(runtimeDatasource, sql, {
    databaseName: runtimeDatasource.databaseName,
  });
  const row = result.rows?.[0] || {};
  return row[fieldName] ?? row[fieldName.toLowerCase()] ?? null;
}

async function resolveNextCursorValue(task, runtimeDatasource, dialect) {
  const fetchConfig = task.fetchConfig || {};
  if (String(task.fetchMode || "full") !== "incremental") {
    return null;
  }
  if (getIncrementalMode(fetchConfig) === "time_window") {
    return buildIncrementalEndValue(fetchConfig, null);
  }
  const column = String(fetchConfig.incrementalColumn || "").trim();
  if (!column) {
    throw new Error("Incremental fetch requires incrementalColumn");
  }
  const cutoff = buildSystemTimeCutoff(fetchConfig);
  const whereClause = cutoff && fetchConfig.systemTimeField
    ? ` WHERE ${quoteIdentifier(fetchConfig.systemTimeField, dialect)} <= ${quoteValue(cutoff)}`
    : "";
  const sql = `SELECT MAX(${quoteIdentifier(column, dialect)}) AS max_value FROM ${quoteIdentifier(task.tableName, dialect)}${whereClause}`;
  return querySingleValue(runtimeDatasource, sql, "max_value");
}

async function executeStatements(runtimeDatasource, statements = []) {
  const adapter = getAdapter(runtimeDatasource);
  for (const statement of statements) {
    const original = String(statement || "").trim();
    const normalized = /^BEGIN\b/i.test(original) ? original : original.replace(/;+\s*$/, "");
    if (!normalized || normalized.startsWith("--")) continue;
    await adapter.executeStatement(runtimeDatasource, normalized, {
      databaseName: runtimeDatasource.databaseName,
    });
  }
}

const DETAIL_RESULT_COLUMNS = [
  { name: "rule_scope", mysqlType: "VARCHAR(32) NOT NULL DEFAULT 'field'", postgresType: "VARCHAR(32) NOT NULL DEFAULT 'field'", oracleType: "VARCHAR2(32) DEFAULT 'field' NOT NULL", dmType: "VARCHAR(32) DEFAULT 'field' NOT NULL" },
  { name: "rule_config_json", mysqlType: "JSON NULL", postgresType: "JSON NULL", oracleType: "CLOB NULL", dmType: "CLOB NULL" },
  { name: "field_names_json", mysqlType: "JSON NULL", postgresType: "JSON NULL", oracleType: "CLOB NULL", dmType: "CLOB NULL" },
  { name: "composite_key_text", mysqlType: "TEXT NULL", postgresType: "TEXT NULL", oracleType: "CLOB NULL", dmType: "CLOB NULL" },
];

const STATS_RESULT_COLUMNS = [
  { name: "rule_scope", mysqlType: "VARCHAR(32) NOT NULL DEFAULT 'field'", postgresType: "VARCHAR(32) NOT NULL DEFAULT 'field'", oracleType: "VARCHAR2(32) DEFAULT 'field' NOT NULL", dmType: "VARCHAR(32) DEFAULT 'field' NOT NULL" },
  { name: "rule_config_json", mysqlType: "JSON NULL", postgresType: "JSON NULL", oracleType: "CLOB NULL", dmType: "CLOB NULL" },
  { name: "field_names_json", mysqlType: "JSON NULL", postgresType: "JSON NULL", oracleType: "CLOB NULL", dmType: "CLOB NULL" },
  { name: "composite_key_text", mysqlType: "TEXT NULL", postgresType: "TEXT NULL", oracleType: "CLOB NULL", dmType: "CLOB NULL" },
  { name: "metric_value", mysqlType: "DECIMAL(18,6) NULL", postgresType: "NUMERIC(18,6) NULL", oracleType: "NUMBER(18,6) NULL", dmType: "DECIMAL(18,6) NULL" },
  { name: "baseline_value", mysqlType: "DECIMAL(18,6) NULL", postgresType: "NUMERIC(18,6) NULL", oracleType: "NUMBER(18,6) NULL", dmType: "DECIMAL(18,6) NULL" },
  { name: "threshold_value", mysqlType: "DECIMAL(18,6) NULL", postgresType: "NUMERIC(18,6) NULL", oracleType: "NUMBER(18,6) NULL", dmType: "DECIMAL(18,6) NULL" },
];

function getDefaultSchema(runtimeDatasource) {
  const dialect = normalizeDialect(runtimeDatasource.type);
  if (dialect === "postgresql") {
    return runtimeDatasource.extraConfig?.schema || "public";
  }
  if (["oracle", "dm"].includes(dialect)) {
    return runtimeDatasource.extraConfig?.schema || runtimeDatasource.username;
  }
  return runtimeDatasource.databaseName;
}

async function resultColumnExists(runtimeDatasource, tableName, columnName) {
  const adapter = getAdapter(runtimeDatasource);
  const dialect = normalizeDialect(runtimeDatasource.type);
  const parsed = parseTableName(tableName, getDefaultSchema(runtimeDatasource));
  const sql = dialect === "oracle"
    ? `SELECT COUNT(*) AS total
       FROM all_tab_columns
       WHERE owner = UPPER(${quoteValue(parsed.scope || runtimeDatasource.username)})
         AND table_name = UPPER(${quoteValue(parsed.table)})
         AND column_name = UPPER(${quoteValue(columnName)})`
    : dialect === "dm"
      ? `SELECT COUNT(*) AS total
       FROM all_tab_columns
       WHERE owner = UPPER(${quoteValue(parsed.scope || runtimeDatasource.username)})
         AND table_name = UPPER(${quoteValue(parsed.table)})
         AND column_name = UPPER(${quoteValue(columnName)})`
      : dialect === "postgresql"
    ? `SELECT COUNT(*) AS total
       FROM information_schema.columns
       WHERE table_schema = ${quoteValue(parsed.scope || "public")}
         AND table_name = ${quoteValue(parsed.table)}
         AND column_name = ${quoteValue(columnName)}`
      : `SELECT COUNT(*) AS total
       FROM information_schema.columns
       WHERE table_schema = ${quoteValue(parsed.scope || runtimeDatasource.databaseName)}
         AND table_name = ${quoteValue(parsed.table)}
         AND column_name = ${quoteValue(columnName)}`;
  const result = await adapter.executeQuery(runtimeDatasource, sql, {
    databaseName: runtimeDatasource.databaseName,
  });
  const row = result.rows?.[0] || {};
  return Number(row.total || row.TOTAL || 0) > 0;
}

async function ensureResultTableColumns(runtimeDatasource, tableName, columns) {
  const adapter = getAdapter(runtimeDatasource);
  const dialect = normalizeDialect(runtimeDatasource.type);
  for (const column of columns) {
    const exists = await resultColumnExists(runtimeDatasource, tableName, column.name);
    if (exists) continue;
    const columnType = dialect === "postgresql"
      ? column.postgresType
      : dialect === "oracle"
        ? column.oracleType
        : dialect === "dm"
          ? column.dmType
          : column.mysqlType;
    const sql = `ALTER TABLE ${quoteIdentifier(tableName, dialect)} ADD COLUMN ${quoteIdentifier(column.name, dialect)} ${columnType}`;
    await adapter.executeStatement(runtimeDatasource, sql, {
      databaseName: runtimeDatasource.databaseName,
    });
  }
}

async function executeQualitySqlBundle(runtimeDatasource, sqlBundle) {
  await executeStatements(runtimeDatasource, sqlBundle.ensureStatements || []);
  await ensureResultTableColumns(runtimeDatasource, sqlBundle.detailTableName, DETAIL_RESULT_COLUMNS);
  await ensureResultTableColumns(runtimeDatasource, sqlBundle.statsTableName, STATS_RESULT_COLUMNS);
  await executeStatements(runtimeDatasource, sqlBundle.ruleStatements || []);
}

async function countBatchRows(runtimeDatasource, tableName, batchId) {
  const adapter = getAdapter(runtimeDatasource);
  const sql = `SELECT COUNT(*) AS total FROM ${quoteIdentifier(tableName, runtimeDatasource.type)} WHERE ${quoteIdentifier("batch_id", runtimeDatasource.type)} = ${quoteValue(batchId)}`;
  const result = await adapter.executeQuery(runtimeDatasource, sql, {
    databaseName: runtimeDatasource.databaseName,
  });
  const row = result.rows?.[0] || {};
  return Number(row.total || row.TOTAL || 0);
}

async function runTask(taskId) {
  const task = await repository.getTaskById(taskId);
  if (!task) {
    throw new Error("Quality task not found");
  }
  const source = await repository.getQualityDataSourceById(task.sourceId);
  if (!source) {
    throw new Error("Source datasource not found");
  }
  const strategyVersion = await repository.getStrategyVersionById(task.strategyVersionId);
  if (!strategyVersion) {
    throw new Error("Strategy version not found");
  }
  const runtimeDatasource = buildRuntimeDatasource(source);
  const dialect = normalizeDialect(runtimeDatasource.type);
  const nextCursorValue = await resolveNextCursorValue(task, runtimeDatasource, dialect);
  const sourceFilter = buildTaskFilterSql(task, dialect, nextCursorValue);
  if (!(await repository.acquireTaskExecution(task.id))) {
    throw new Error("Quality task is already running");
  }
  const batchId = buildQualityBatchId(task.id);
  const executionSteps = [];
  const pushStep = (step, detail) => {
    executionSteps.push({
      step,
      detail,
      at: new Date().toISOString(),
    });
  };

  const taskRun = await repository.createTaskRun({
    projectId: task.projectId,
    taskId: task.id,
    runStatus: "running",
    batchId,
    startTime: new Date(),
    executionInfo: {
      fetchMode: task.fetchMode,
      fetchConfig: task.fetchConfig || {},
      sourceFilterSql: sourceFilter.sql,
      resolvedParameters: {
        systemTimeCutoff: sourceFilter.cutoff,
        incrementalStartValue: sourceFilter.incrementalStartValue,
        incrementalEndValue: sourceFilter.incrementalEndValue,
      },
      steps: executionSteps,
    },
  });

  try {
    pushStep("load_task", "加载任务、数据源与策略版本");
    const primaryKeyColumns = (strategyVersion.fieldStrategies || []).filter((item) => item.isPrimaryKey).map((item) => item.columnName);
    const ruleProfile = await buildRuleProfileForTask(source, task, strategyVersion);
    const normalizedAdvancedRules = await ruleNormalizer.normalizeAdvancedRules(
      strategyVersion.advancedRules || [],
      ruleProfile,
      source,
      { strict: false }
    );
    const sqlBundle = buildQualitySqlBundle({
      dialect,
      tableName: task.tableName,
      detailTableName: task.detailTableName,
      statsTableName: task.statsTableName,
      primaryKeyColumns,
      fieldStrategies: strategyVersion.fieldStrategies || [],
      advancedRules: normalizedAdvancedRules,
      batchId,
      sourceFromSql: `(${sourceFilter.sql})`,
      fullSourceFromSql: quoteIdentifier(task.tableName, dialect),
    });
    pushStep("build_sql", `生成 SQL 完成，共 ${sqlBundle.statementCount} 条语句，规则 ${sqlBundle.advancedRuleCount + primaryKeyColumns.length}`);

    await executeQualitySqlBundle(runtimeDatasource, sqlBundle);
    pushStep("execute_sql", "质量规则 SQL 执行完成");
    const [issueCount, statsCount] = await Promise.all([
      countBatchRows(runtimeDatasource, task.detailTableName, batchId),
      countBatchRows(runtimeDatasource, task.statsTableName, batchId),
    ]);
    pushStep("collect_result", `明细 ${issueCount} 条，统计 ${statsCount} 条`);

    // 统一事实层属于增强写入：失败不影响原任务结果和旧分析页面。
    let factCollection = null;
    try {
      factCollection = await resultCollector.collectTaskRun({ task, taskRun, source, strategyVersion, profileSnapshot: ruleProfile });
      pushStep("collect_fact", `统一结果归集完成，规则 ${factCollection.ruleCount} 条`);
    } catch (collectorError) {
      pushStep("collect_fact_failed", `统一结果归集未完成：${collectorError.message}`);
    }

    const nextFetchConfig = {
      ...(task.fetchConfig || {}),
      ...(String(task.fetchMode) === "incremental" ? {
        ...(getIncrementalMode(task.fetchConfig || {}) === "cursor" ? { lastValue: nextCursorValue } : {}),
        lastRunStartValue: sourceFilter.incrementalStartValue ?? null,
        lastRunEndValue: sourceFilter.incrementalEndValue ?? null,
        lastRunAt: new Date().toISOString(),
      } : {}),
    };

    await repository.updateTask(task.id, {
      status: task.scheduleEnabled ? "active" : "draft",
      lastRunTime: new Date(),
      lastBatchId: batchId,
      lastRunStatus: "completed",
      latestExecutionInfo: {
        issueCount,
        statsCount,
        factCollection,
        batchId,
        fetchMode: task.fetchMode,
        sourceFilterSql: sourceFilter.sql,
        resolvedParameters: {
          systemTimeCutoff: sourceFilter.cutoff,
          incrementalStartValue: sourceFilter.incrementalStartValue,
          incrementalEndValue: sourceFilter.incrementalEndValue,
        },
        steps: executionSteps,
      },
      fetchConfig: nextFetchConfig,
    });

    await repository.updateTaskRun(taskRun.id, {
      runStatus: "completed",
      endTime: new Date(),
      issueCount,
      statsCount,
      executionInfo: {
        batchId,
        issueCount,
        statsCount,
        factCollection,
        fetchMode: task.fetchMode,
        sourceFilterSql: sourceFilter.sql,
        resolvedParameters: {
          systemTimeCutoff: sourceFilter.cutoff,
          incrementalStartValue: sourceFilter.incrementalStartValue,
          incrementalEndValue: sourceFilter.incrementalEndValue,
        },
        steps: executionSteps,
      },
    });

    return repository.getTaskById(task.id);
  } catch (error) {
    pushStep("failed", error.message);
    await repository.updateTask(task.id, {
      status: task.scheduleEnabled ? "active" : "draft",
      lastRunTime: new Date(),
      lastBatchId: batchId,
      lastRunStatus: "failed",
      latestExecutionInfo: {
        batchId,
        fetchMode: task.fetchMode,
        error: error.message,
        sourceFilterSql: sourceFilter.sql,
        failedSql: typeof error?.sql === "string" ? error.sql : "",
        steps: executionSteps,
      },
    });

    await repository.updateTaskRun(taskRun.id, {
      runStatus: "failed",
      endTime: new Date(),
      errorMessage: error.message,
      executionInfo: {
        batchId,
        fetchMode: task.fetchMode,
        error: error.message,
        sourceFilterSql: sourceFilter.sql,
        failedSql: typeof error?.sql === "string" ? error.sql : "",
        steps: executionSteps,
      },
    });
    throw error;
  }
}

async function runTaskNow(taskId) {
  return runTask(taskId);
}

async function buildTaskSqlPreview(taskLike) {
  const task = typeof taskLike === "number" ? await repository.getTaskById(taskLike) : taskLike;
  if (!task) {
    throw new Error("Quality task not found");
  }
  const source = await repository.getQualityDataSourceById(task.sourceId);
  if (!source) {
    throw new Error("Source datasource not found");
  }
  const strategyVersion = await repository.getStrategyVersionById(task.strategyVersionId);
  if (!strategyVersion) {
    throw new Error("Strategy version not found");
  }
  const runtimeDatasource = buildRuntimeDatasource(source);
  const dialect = normalizeDialect(runtimeDatasource.type);
  const nextCursorValue = await resolveNextCursorValue(task, runtimeDatasource, dialect);
  const sourceFilter = buildTaskFilterSql(task, dialect, nextCursorValue);
  const primaryKeyColumns = (strategyVersion.fieldStrategies || []).filter((item) => item.isPrimaryKey).map((item) => item.columnName);
  const ruleProfile = await buildRuleProfileForTask(source, task, strategyVersion);
  const normalizedAdvancedRules = await ruleNormalizer.normalizeAdvancedRules(
    strategyVersion.advancedRules || [],
    ruleProfile,
    source,
    { strict: false }
  );
  const sqlBundle = buildQualitySqlBundle({
    dialect,
    tableName: task.tableName,
    detailTableName: task.detailTableName,
    statsTableName: task.statsTableName,
    primaryKeyColumns,
    fieldStrategies: strategyVersion.fieldStrategies || [],
    advancedRules: normalizedAdvancedRules,
    batchId: "preview_batch",
    sourceFromSql: `(${sourceFilter.sql})`,
    fullSourceFromSql: quoteIdentifier(task.tableName, dialect),
  });

  return {
    fetchMode: task.fetchMode,
    sourceFilterSql: sourceFilter.sql,
    nextCursorValue,
    resolvedParameters: {
      systemTimeCutoff: sourceFilter.cutoff,
      incrementalStartValue: sourceFilter.incrementalStartValue,
      incrementalEndValue: sourceFilter.incrementalEndValue,
    },
    sqlBundle,
    sqlContent: sqlBundle.sqlContent,
  };
}

module.exports = {
  startScheduler,
  loadScheduledTasks,
  scheduleTask,
  unscheduleTask,
  runTaskNow,
  buildTaskSqlPreview,
};
