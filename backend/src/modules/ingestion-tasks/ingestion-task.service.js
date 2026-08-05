const AppError = require("../../common/errors/app-error");
const repository = require("./ingestion-task.repository");
const dataSourceRepository = require("../data-sources/data-source.repository");
const dataSourceMetadata = require("../data-sources/data-source.metadata");
const dataSourcePreview = require("../data-sources/data-source.preview");
const schedulerService = require("../../services/schedulerService");
const modelProviderService = require("../model-providers/model-provider.service");
const ingestionAiConfigService = require("../ingestion-ai-configs/ingestion-ai-config.service");
const hiveService = require("../../services/hiveService");
const apiIngestionService = require("../../services/apiIngestionService");
const {
  inferDatasourceDialect,
  normalizeDatasourceType,
} = require("../../common/utils/datasource-dialect");

const failureAnalysisCache = new Map();
const SUPPORTED_RDBMS_DIALECTS = new Set(["mysql", "postgresql"]);
const SUPPORTED_STREAM_SOURCE_DIALECTS = new Set(["kafka", "ftp", "api"]);
const SUPPORTED_TARGET_DIALECTS = new Set(["mysql", "postgresql", "hive"]);

function resolveDatasourceDialect(sourceType, connectionConfig = {}) {
  const normalizedType = normalizeDatasourceType(sourceType);
  const dialect = inferDatasourceDialect(normalizedType, connectionConfig || {});
  return dialect === "unknown" ? normalizedType : dialect;
}

async function listTasks(filters) {
  return repository.listTasks(filters);
}

async function getMonitorOverview(options = {}) {
  const pageSize = Math.max(20, Math.min(500, Number(options.pageSize) || 200));
  const runLimit = Math.max(10, Math.min(200, Number(options.runLimit) || 50));
  const taskResult = await repository.listTasks({ page: 1, pageSize });
  const tasks = taskResult.list || [];
  const taskIds = tasks.map((task) => task.id);

  await Promise.all(taskIds.flatMap((taskId) => ([
    repository.reconcileTerminalRunningJobRuns(taskId),
    repository.reconcileHistoricalRunningJobRuns(taskId),
  ])));

  const [dataSources, runs] = await Promise.all([
    dataSourceRepository.listDataSources({ includeConnectivity: true }),
    repository.getJobRunSummariesByTaskIds(taskIds, runLimit),
  ]);

  const runsByTask = {};
  for (const run of runs) {
    if (!runsByTask[run.taskId]) {
      runsByTask[run.taskId] = [];
    }
    runsByTask[run.taskId].push(run);
  }

  return {
    tasks,
    dataSources,
    runsByTask,
    runLimit,
    totalTasks: taskResult.total || tasks.length,
  };
}

function shouldRegisterTaskSchedule(task) {
  return Boolean(
    task
    && task.scheduleEnabled === true
    && task.status === "active"
    && task.scheduleConfig
    && task.scheduleConfig.scheduleType
    && task.scheduleConfig.scheduleType !== "manual"
  );
}

async function createTask(payload) {
  try {
    const existingTask = await repository.getTaskByCode(payload.taskCode);
    if (existingTask) {
      throw new AppError("任务编码已存在", 409);
    }

    const normalizedPayload = await normalizeTaskPayload(payload);
    const createdTask = await repository.createTask(normalizedPayload);

    if (shouldRegisterTaskSchedule(createdTask)) {
      await schedulerService.scheduleTask(createdTask);
    }

    return createdTask;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("任务编码已存在", 409);
    }
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      throw new AppError("指定的数据源不存在", 400);
    }
    throw error;
  }
}

async function updateTask(id, payload) {
  try {
    const existingTask = await repository.getTaskById(id);
    if (!existingTask) {
      throw new AppError("任务不存在", 404);
    }

    if (existingTask.status === "running") {
      throw new AppError("任务正在运行中，不允许修改", 400);
    }

    const mergedPayload = {
      ...existingTask,
      ...payload,
      fieldMappings: payload.fieldMappings !== undefined ? payload.fieldMappings : existingTask.fieldMappings,
      transformRules: payload.transformRules !== undefined ? payload.transformRules : existingTask.transformRules,
      incrementalConfig: payload.incrementalConfig !== undefined ? payload.incrementalConfig : existingTask.incrementalConfig,
      sourceConfig: payload.sourceConfig !== undefined ? payload.sourceConfig : existingTask.sourceConfig,
      parseConfig: payload.parseConfig !== undefined ? payload.parseConfig : existingTask.parseConfig,
      errorConfig: payload.errorConfig !== undefined ? payload.errorConfig : existingTask.errorConfig,
      scheduleConfig: payload.scheduleConfig !== undefined ? payload.scheduleConfig : existingTask.scheduleConfig
    };

    const normalizedPayload = await normalizeTaskPayload(mergedPayload, true, existingTask);
    const updatedTask = await repository.updateTask(id, normalizedPayload);

    if (shouldRegisterTaskSchedule(updatedTask)) {
      await schedulerService.scheduleTask(updatedTask);
    } else {
      await schedulerService.unscheduleTask(id);
    }

    return updatedTask;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("任务编码已存在", 409);
    }
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      throw new AppError("指定的数据源不存在", 400);
    }
    throw error;
  }
}

async function previewTaskUpdate(id, payload) {
  const existingTask = await repository.getTaskById(id);
  if (!existingTask) {
    throw new AppError("任务不存在", 404);
  }

  if (existingTask.status === "running") {
    throw new AppError("任务正在运行中，不允许修改", 400);
  }

  const mergedPayload = {
    ...existingTask,
    ...payload,
    fieldMappings: payload.fieldMappings !== undefined ? payload.fieldMappings : existingTask.fieldMappings,
    transformRules: payload.transformRules !== undefined ? payload.transformRules : existingTask.transformRules,
    incrementalConfig: payload.incrementalConfig !== undefined ? payload.incrementalConfig : existingTask.incrementalConfig,
    sourceConfig: payload.sourceConfig !== undefined ? payload.sourceConfig : existingTask.sourceConfig,
    parseConfig: payload.parseConfig !== undefined ? payload.parseConfig : existingTask.parseConfig,
    errorConfig: payload.errorConfig !== undefined ? payload.errorConfig : existingTask.errorConfig,
    scheduleConfig: payload.scheduleConfig !== undefined ? payload.scheduleConfig : existingTask.scheduleConfig,
  };

  const normalizedPayload = await normalizeTaskPayload(mergedPayload, true, existingTask);
  return {
    existingTask,
    normalizedPayload,
    previewTask: {
      ...existingTask,
      ...normalizedPayload,
      id: existingTask.id,
    },
  };
}

async function previewSourceData(payload) {
  const source = await dataSourceRepository.getDataSourceById(payload.sourceId);
  if (!source) {
    throw new AppError("来源数据源不存在", 400);
  }

  const sourceDialect = resolveDatasourceDialect(source.sourceType, source.connectionConfig || {});
  const normalizedSourceTable = normalizeTableNameBySourceType(payload.sourceTable, source.sourceType);
  const sourceConfig = normalizeSourceConfig(sourceDialect, payload.sourceConfig || {}, normalizedSourceTable);
  const parseConfig = normalizeParseConfig(sourceDialect, payload.parseConfig || {});
  const limit = Math.max(1, Math.min(100, Number(payload.limit || 20)));
  const rows = await dataSourcePreview.sampleRowsWithOptions(source, normalizedSourceTable, {
    sourceConfig,
    parseConfig,
    limit,
  });

  return {
    sourceId: source.id,
    sourceName: source.sourceName,
    sourceType: sourceDialect,
    sourceTable: normalizedSourceTable,
    sourceConfig,
    parseConfig,
    rows,
    totalPreviewRows: rows.length,
  };
}

async function normalizeTaskPayload(payload, isUpdate = false, existingTask = null) {
  const source = await dataSourceRepository.getDataSourceById(payload.sourceId);
  const target = await dataSourceRepository.getDataSourceById(payload.targetSourceId);
  const normalizedSourceTable = normalizeTableNameBySourceType(payload.sourceTable, source?.sourceType);
  const normalizedTargetTable = normalizeTableNameBySourceType(payload.targetTable, target?.sourceType);

  if (!source) {
    throw new AppError("来源数据源不存在", 400);
  }
  if (!target) {
    throw new AppError("目标数据源不存在", 400);
  }
  const sourceDialect = resolveDatasourceDialect(source.sourceType, source.connectionConfig || {});
  const targetDialect = resolveDatasourceDialect(target.sourceType, target.connectionConfig || {});

  const isRdbmsSource = SUPPORTED_RDBMS_DIALECTS.has(sourceDialect);
  const isStreamSource = SUPPORTED_STREAM_SOURCE_DIALECTS.has(sourceDialect);
  if (!isRdbmsSource && !isStreamSource) {
    throw new AppError("当前接入任务仅支持 MySQL / PostgreSQL / Kafka / FTP / API 来源数据源，GaussDB 与兼容 JDBC 连接可按对应方言接入", 400);
  }
  if (!SUPPORTED_TARGET_DIALECTS.has(targetDialect)) {
    throw new AppError("当前接入任务仅支持 MySQL / PostgreSQL / Hive 方言目标数据源，GaussDB 与兼容 JDBC 连接可按对应方言接入", 400);
  }

  const sourceConfig = normalizeSourceConfig(sourceDialect, payload.sourceConfig || {}, normalizedSourceTable);
  const parseConfig = normalizeParseConfig(sourceDialect, payload.parseConfig || {});
  const errorConfig = normalizeErrorConfig(payload.errorConfig || {});
  const sourceColumns = isStreamSource
    ? await resolveStreamSourceColumns(source, sourceDialect, normalizedSourceTable, sourceConfig, parseConfig)
    : await dataSourceMetadata.listColumns(source, normalizedSourceTable);
  if (!sourceColumns.length) {
    throw new AppError(isStreamSource ? "来源对象没有可识别字段，请先确认样例数据或解析规则" : "来源表不存在或没有字段", 400);
  }
  const sourceTables = isRdbmsSource ? await dataSourceMetadata.listTables(source) : [];
  const sourceTableComment = isRdbmsSource
    ? resolveSourceTableComment(sourceTables, normalizedSourceTable)
    : `${sourceDialect === "kafka" ? "Kafka Topic" : sourceDialect === "ftp" ? "FTP 文件" : "API 接口"} ${normalizedSourceTable}`;

  const targetConfig = normalizeTargetConfig(payload.targetConfig || {}, target.sourceType, target.connectionConfig || {});

  const fieldMappings = (payload.fieldMappings || []).map((mapping) => ({
    ...mapping,
    dataType: mapping.dataType || sourceColumns.find((column) => column.columnName === mapping.sourceField)?.dataType
  }));

  if (!fieldMappings.length) {
    throw new AppError("至少需要一个字段映射", 400);
  }

  const targetColumnsFromMappings = buildTargetColumnsFromMappings(
    sourceColumns,
    fieldMappings,
    target.sourceType,
    target.connectionConfig || {}
  );

  if (SUPPORTED_RDBMS_DIALECTS.has(targetDialect)) {
    const existingTargetTables = await dataSourceMetadata.listTables(target);
    const targetTableExists = existingTargetTables.some(
      (table) => table.tableName === normalizeTableNameBySourceType(normalizedTargetTable, target.sourceType)
    );

    if (payload.targetTableMode === "create") {
      await dataSourceMetadata.ensureTableMatchesColumns(
        target,
        normalizedTargetTable,
        targetColumnsFromMappings,
        { tableComment: sourceTableComment }
      );
    }

    if (payload.targetTableMode !== "create" && !targetTableExists) {
      throw new AppError("目标表不存在，请切换为自动建表或先创建目标表", 400);
    }
  } else if (targetDialect === "hive") {
    if (payload.targetTableMode === "create") {
      await hiveService.ensureTableExists(
        target.connectionConfig || {},
        normalizedTargetTable,
        targetColumnsFromMappings,
        { fileType: targetConfig.fileType || "parquet" }
      );
    } else {
      const exists = await hiveService.tableExists(target.connectionConfig || {}, normalizedTargetTable);
      if (!exists) {
        throw new AppError("Hive 目标表不存在，请先创建目标表或切换为自动建表", 400);
      }
    }
  }

  if (sourceDialect === "api" && payload.syncMode === "cdc") {
    throw new AppError("API 接入任务不支持 CDC，同步模式请选择全量或增量", 400);
  }

  const incrementalConfig = isRdbmsSource
    ? normalizeIncrementalConfig(
        payload.syncMode,
        payload.incrementalConfig,
        sourceColumns,
        isUpdate ? existingTask?.incrementalConfig || null : null
      )
    : null;
  const scheduleConfig = await normalizeScheduleConfig(
    payload.scheduleConfig,
    isUpdate ? existingTask?.id || payload.id || null : null
  );

  return {
    ...(isUpdate && payload.id ? { id: payload.id } : {}),
    taskName: payload.taskName,
    taskCode: payload.taskCode,
    sourceId: payload.sourceId,
    sourceTable: normalizedSourceTable,
    targetSourceId: payload.targetSourceId,
    targetType: target.sourceType,
    targetTable: normalizedTargetTable,
    targetConfig: {
      ...targetConfig,
      table: [normalizedTargetTable],
      column: fieldMappings.map((item) => item.targetField)
    },
    syncMode: payload.syncMode,
    status: payload.status,
    description: payload.description,
    ownerName: payload.ownerName,
    scheduleEnabled: payload.scheduleEnabled,
    fieldMappings,
    transformRules: payload.transformRules || [],
    incrementalConfig,
    sourceConfig,
    parseConfig,
    errorConfig,
    scheduleConfig
  };
}

async function resolveStreamSourceColumns(source, sourceDialect, sourceObject, sourceConfig, parseConfig = {}) {
  if (sourceDialect === "api") {
    const rows = await dataSourcePreview.sampleRowsWithOptions(source, sourceObject, {
      sourceConfig,
      parseConfig,
      limit: 20,
    });
    return apiIngestionService.inferApiColumns(rows);
  }

  if (sourceDialect === "ftp" && sourceConfig.pathMode === "directory") {
    const files = await dataSourcePreview.listObjects(source, { includeDirectories: false });
    const matched = files.find((item) =>
      String(item.objectType || item.tableType || "").toLowerCase() !== "directory" &&
      isPathUnderDirectory(item.tableName, sourceConfig.rootDir) &&
      matchFilePattern(item.tableName, sourceConfig.filePattern, sourceConfig.excludePattern)
    );
    if (!matched) {
      throw new AppError("FTP 目录下没有匹配文件，无法推断字段", 400);
    }
    return dataSourcePreview.listColumns(source, matched.tableName);
  }

  return dataSourcePreview.listColumns(source, sourceObject);
}

function isPathUnderDirectory(filePath, directory) {
  const normalizedFile = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const normalizedDir = String(directory || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalizedDir) return true;
  return normalizedFile === normalizedDir || normalizedFile.startsWith(`${normalizedDir}/`);
}

function matchFilePattern(filePath, filePattern = "*", excludePattern = "") {
  const normalizedPath = String(filePath || "").replace(/\\/g, "/");
  const fileName = normalizedPath.split("/").pop() || normalizedPath;
  if (excludePattern) {
    try {
      if (new RegExp(excludePattern).test(fileName) || new RegExp(excludePattern).test(normalizedPath)) {
        return false;
      }
    } catch (_error) {
      // Ignore invalid optional exclude pattern; validation should not block existing tasks.
    }
  }
  const pattern = String(filePattern || "*").trim();
  if (!pattern || pattern === "*") return true;
  if (pattern.startsWith("/") && pattern.endsWith("/")) {
    return new RegExp(pattern.slice(1, -1)).test(fileName) || new RegExp(pattern.slice(1, -1)).test(normalizedPath);
  }
  const regexText = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regexText}$`, "i").test(fileName);
}

function normalizeSourceConfig(sourceDialect, rawConfig = {}, sourceObject = "") {
  if (sourceDialect === "kafka") {
    const topic = String(rawConfig.topic || sourceObject || "").trim();
    if (!topic) {
      throw new AppError("Kafka 接入任务必须选择 Topic", 400);
    }
    const consumerGroupId = String(rawConfig.consumerGroupId || rawConfig.groupId || `medata_ingestion_${topic}`).trim();
    const startMode = normalizeEnum(rawConfig.startMode || rawConfig.offsetReset || "latest", ["earliest", "latest", "stored"], "latest");
    const batchSize = Math.max(1, Math.min(5000, Number(rawConfig.batchSize || rawConfig.maxMessages || 100)));
    const maxWaitMs = Math.max(1000, Math.min(120000, Number(rawConfig.maxWaitMs || rawConfig.pollTimeoutMs || 10000)));
    return {
      topic,
      consumerGroupId,
      startMode,
      batchSize,
      maxWaitMs,
      includeMetadata: rawConfig.includeMetadata !== false,
      commitMode: normalizeEnum(rawConfig.commitMode || "after_write", ["after_write"], "after_write"),
    };
  }

  if (sourceDialect === "ftp") {
    const rootDir = String(rawConfig.rootDir || rawConfig.directory || sourceObject || "").trim().replace(/\\/g, "/");
    if (!rootDir) {
      throw new AppError("FTP 接入任务必须配置根目录或文件路径", 400);
    }
    const pathMode = rawConfig.pathMode || (/\.[A-Za-z0-9]+$/.test(rootDir) ? "file" : "directory");
    return {
      rootDir,
      pathMode: normalizeEnum(pathMode, ["file", "directory"], "directory"),
      recursive: rawConfig.recursive !== false,
      maxDepth: Math.max(0, Math.min(10, Number(rawConfig.maxDepth ?? 3))),
      filePattern: String(rawConfig.filePattern || "*.txt").trim() || "*.txt",
      excludePattern: String(rawConfig.excludePattern || "\\.(tmp|writing)$").trim(),
      batchFileLimit: Math.max(1, Math.min(500, Number(rawConfig.batchFileLimit || 20))),
      stabilitySeconds: Math.max(0, Math.min(3600, Number(rawConfig.stabilitySeconds || 0))),
      postProcessAction: normalizeEnum(rawConfig.postProcessAction || "keep", ["keep", "delete", "archive"], "keep"),
      archiveDir: rawConfig.archiveDir ? String(rawConfig.archiveDir).trim().replace(/\\/g, "/") : "",
    };
  }

  if (sourceDialect === "api") {
    return apiIngestionService.normalizeApiSourceConfig(rawConfig, sourceObject);
  }

  return rawConfig || {};
}

function normalizeParseConfig(sourceDialect, rawConfig = {}) {
  if (sourceDialect === "kafka") {
    return {
      messageFormat: normalizeEnum(rawConfig.messageFormat || rawConfig.fileType || "json", ["json", "text", "csv", "txt"], "json"),
      encoding: String(rawConfig.encoding || "utf8").trim() || "utf8",
      jsonRootPath: rawConfig.jsonRootPath ? String(rawConfig.jsonRootPath).trim() : "",
      flattenJson: rawConfig.flattenJson !== false,
      delimiter: rawConfig.delimiter ? String(rawConfig.delimiter) : undefined,
      skipErrorRows: rawConfig.skipErrorRows !== false,
      keepRawValue: rawConfig.keepRawValue !== false,
    };
  }

  if (sourceDialect === "ftp") {
    return {
      fileType: normalizeEnum(rawConfig.fileType || "txt", ["csv", "txt", "xls", "xlsx", "json", "xml"], "txt"),
      encoding: String(rawConfig.encoding || "utf8").trim() || "utf8",
      delimiter: rawConfig.delimiter ? String(rawConfig.delimiter) : undefined,
      quoteChar: rawConfig.quoteChar ? String(rawConfig.quoteChar) : "\"",
      headerRowNumber: Math.max(1, Number(rawConfig.headerRowNumber || 1)),
      firstDataRowNumber: Math.max(1, Number(rawConfig.firstDataRowNumber || 2)),
      fieldNameMode: normalizeEnum(rawConfig.fieldNameMode || "header", ["header", "generated"], "header"),
      jsonRootPath: rawConfig.jsonRootPath ? String(rawConfig.jsonRootPath).trim() : "",
      xmlRowPath: rawConfig.xmlRowPath ? String(rawConfig.xmlRowPath).trim() : "",
      sheetName: rawConfig.sheetName ? String(rawConfig.sheetName).trim() : undefined,
      skipErrorRows: rawConfig.skipErrorRows !== false,
    };
  }

  if (sourceDialect === "api") {
    return apiIngestionService.normalizeApiParseConfig(rawConfig);
  }

  return rawConfig || {};
}

function normalizeErrorConfig(rawConfig = {}) {
  if (rawConfig?.successStatusCodes || rawConfig?.retryStatusCodes || rawConfig?.maxRetries !== undefined) {
    const apiErrorConfig = apiIngestionService.normalizeApiErrorConfig(rawConfig);
    return {
      ...apiErrorConfig,
      parseErrorAction: normalizeEnum(rawConfig.parseErrorAction || "skip", ["skip", "fail"], "skip"),
      writeErrorAction: normalizeEnum(rawConfig.writeErrorAction || "fail", ["skip", "fail"], "fail"),
    };
  }
  return {
    parseErrorAction: normalizeEnum(rawConfig.parseErrorAction || "skip", ["skip", "fail"], "skip"),
    writeErrorAction: normalizeEnum(rawConfig.writeErrorAction || "fail", ["skip", "fail"], "fail"),
  };
}

async function normalizeScheduleConfig(rawScheduleConfig, currentTaskId = null) {
  if (!rawScheduleConfig) {
    return rawScheduleConfig;
  }

  const dependencyTaskIds = Array.from(
    new Set(
      (rawScheduleConfig.dependencyTaskIds || [])
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  );

  if (currentTaskId && dependencyTaskIds.includes(Number(currentTaskId))) {
    throw new AppError("任务依赖不能包含当前任务自身", 400);
  }

  if (dependencyTaskIds.length > 0) {
    const dependencyTasks = await Promise.all(
      dependencyTaskIds.map((dependencyTaskId) => repository.getTaskById(dependencyTaskId))
    );
    const missingDependencyTaskIds = dependencyTasks
      .map((task, index) => (task ? null : dependencyTaskIds[index]))
      .filter((item) => item !== null);

    if (missingDependencyTaskIds.length > 0) {
      throw new AppError(`依赖任务不存在: ${missingDependencyTaskIds.join(", ")}`, 400);
    }

    if (currentTaskId) {
      await assertNoDependencyCycle(Number(currentTaskId), dependencyTaskIds);
    }
  }

  const retryCount = Math.max(0, Number(rawScheduleConfig.retryCount) || 0);
  const retryIntervalMs = rawScheduleConfig.retryIntervalMs === undefined || rawScheduleConfig.retryIntervalMs === null
    ? undefined
    : Math.max(1000, Number(rawScheduleConfig.retryIntervalMs) || 0);

  if (retryCount > 0 && !retryIntervalMs) {
    throw new AppError("配置失败重试时，必须设置有效的重试间隔", 400);
  }

  return {
    ...rawScheduleConfig,
    dependencyTaskIds,
    retryCount,
    retryIntervalMs: retryCount > 0 ? retryIntervalMs : undefined
  };
}

async function assertNoDependencyCycle(taskId, dependencyTaskIds) {
  const visited = new Set();

  async function walk(currentTaskId, chain) {
    if (visited.has(currentTaskId)) {
      return;
    }
    visited.add(currentTaskId);

    const currentTask = await repository.getTaskById(currentTaskId);
    const nextDependencyTaskIds = currentTask?.scheduleConfig?.dependencyTaskIds || [];

    for (const nextDependencyTaskId of nextDependencyTaskIds) {
      if (Number(nextDependencyTaskId) === Number(taskId)) {
        throw new AppError(`任务依赖存在循环引用: ${[...chain, currentTaskId, taskId].join(" -> ")}`, 400);
      }
      await walk(Number(nextDependencyTaskId), [...chain, currentTaskId]);
    }
  }

  for (const dependencyTaskId of dependencyTaskIds) {
    await walk(Number(dependencyTaskId), [taskId]);
  }
}

function normalizeIncrementalConfig(syncMode, rawIncrementalConfig, sourceColumns, existingIncrementalConfig = null) {
  if (syncMode === "full") {
    return null;
  }

  const raw = rawIncrementalConfig || existingIncrementalConfig || {};
  const mode = raw.mode || "timestamp";
  const cursorColumn = raw.cursorColumn || raw.timestampColumn || raw.idColumn;

  if (syncMode === "incremental") {
    if (!["timestamp", "id"].includes(mode)) {
      throw new AppError("增量同步仅支持时间字段或序号字段", 400);
    }

    if (!cursorColumn) {
      throw new AppError("增量同步必须选择增量字段", 400);
    }

    const sourceColumn = sourceColumns.find((column) => column.columnName === cursorColumn);
    if (!sourceColumn) {
      throw new AppError("增量字段不存在于来源表结构中", 400);
    }

    return {
      mode,
      cursorColumn,
      ...(mode === "timestamp" ? { timestampColumn: cursorColumn } : {}),
      ...(mode === "id" ? { idColumn: cursorColumn } : {}),
      startValue:
        raw.startValue !== undefined && raw.startValue !== null && raw.startValue !== ""
          ? raw.startValue
          : existingIncrementalConfig?.startValue !== undefined && existingIncrementalConfig?.startValue !== null && existingIncrementalConfig?.startValue !== ""
            ? existingIncrementalConfig.startValue
            : mode === "timestamp"
              ? "1970-01-01 00:00:00"
              : "0",
      ...(raw.lastValue !== undefined
        ? { lastValue: raw.lastValue }
        : existingIncrementalConfig?.lastValue !== undefined
          ? { lastValue: existingIncrementalConfig.lastValue }
          : {}),
      ...(raw.lastRunStartValue !== undefined
        ? { lastRunStartValue: raw.lastRunStartValue }
        : existingIncrementalConfig?.lastRunStartValue !== undefined
          ? { lastRunStartValue: existingIncrementalConfig.lastRunStartValue }
          : {}),
      ...(raw.lastRunEndValue !== undefined
        ? { lastRunEndValue: raw.lastRunEndValue }
        : existingIncrementalConfig?.lastRunEndValue !== undefined
          ? { lastRunEndValue: existingIncrementalConfig.lastRunEndValue }
          : {}),
      ...(raw.lastRunAt !== undefined
        ? { lastRunAt: raw.lastRunAt }
        : existingIncrementalConfig?.lastRunAt !== undefined
          ? { lastRunAt: existingIncrementalConfig.lastRunAt }
          : {})
    };
  }

  if (syncMode === "cdc") {
    const cdcColumns = Array.isArray(raw.cdcColumns) ? raw.cdcColumns.filter(Boolean) : [];
    if (cdcColumns.length === 0) {
      throw new AppError("CDC 同步必须配置监听字段", 400);
    }

    return {
      mode: "cdc",
      cdcColumns
    };
  }

  return null;
}

function normalizeTargetConfig(targetConfig, targetType, connectionConfig = {}) {
  const normalizedTargetType = resolveDatasourceDialect(targetType, connectionConfig);
  const writeMode = targetConfig.writeMode || "append";
  const partitionConfig = targetConfig.partitionConfig || null;

  if (normalizedTargetType === "mysql") {
    const allowedWriteModes = ["append", "replace", "overwrite"];
    if (!allowedWriteModes.includes(writeMode)) {
      throw new AppError("MySQL 目标仅支持追加写、替换写和覆盖写", 400);
    }

    return {
      ...targetConfig,
      writeMode
    };
  }

  if (normalizedTargetType === "postgresql") {
    const allowedWriteModes = ["append", "overwrite"];
    if (!allowedWriteModes.includes(writeMode)) {
      throw new AppError("PostgreSQL 目标仅支持追加写和覆盖写", 400);
    }

    return {
      ...targetConfig,
      writeMode
    };
  }

  if (normalizedTargetType === "hive") {
    const allowedWriteModes = ["append", "overwrite", "partition_overwrite"];
    if (!allowedWriteModes.includes(writeMode)) {
      throw new AppError("Hive 目标仅支持追加写、覆盖写和覆盖最新分区", 400);
    }

    if (writeMode === "partition_overwrite") {
      if (!partitionConfig || !partitionConfig.partitionColumn) {
        throw new AppError("分区覆盖模式必须指定分区字段", 400);
      }

      if ((partitionConfig.mode || "latest") === "custom" && !partitionConfig.partitionValue) {
        throw new AppError("自定义分区覆盖必须指定分区值", 400);
      }
    }

    return {
      ...targetConfig,
      writeMode,
      ...(writeMode === "partition_overwrite"
        ? {
            partitionConfig: {
              mode: partitionConfig?.mode || "latest",
              partitionColumn: partitionConfig?.partitionColumn,
              ...(partitionConfig?.partitionValue
                ? { partitionValue: partitionConfig.partitionValue }
                : {})
            }
          }
        : {})
    };
  }

  return {
    ...targetConfig,
    writeMode
  };
}

function normalizeTableNameBySourceType(tableName, sourceType) {
  if (tableName === undefined || tableName === null) {
    return tableName;
  }

  return tableName;
}

async function deleteTask(id) {
  try {
    const existingTask = await repository.getTaskById(id);
    if (!existingTask) {
      throw new AppError("任务不存在", 404);
    }

    await schedulerService.unscheduleTask(id);
    const deleted = await repository.deleteTask(id);

    if (!deleted) {
      throw new AppError("任务不存在", 404);
    }

    return { id };
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      throw new AppError("任务已被引用，无法删除", 409);
    }
    throw error;
  }
}

async function startTask(id) {
  const task = await repository.getTaskById(id);
  if (!task) {
    throw new AppError("任务不存在", 404);
  }

  if (task.status === "running") {
    throw new AppError("浠诲姟宸茬粡鍦ㄨ繍琛屼腑", 400);
  }

  if (!task.scheduleConfig || !task.scheduleConfig.scheduleType || task.scheduleConfig.scheduleType === "manual") {
    throw new AppError("任务没有配置有效的调度计划", 400);
  }

  await repository.updateTaskStatus(id, "active");
  await repository.updateTask(id, { scheduleEnabled: true });
  const updatedTask = await repository.getTaskById(id);
  await schedulerService.scheduleTask(updatedTask);
  return updatedTask;
}

async function stopTask(id) {
  const task = await repository.getTaskById(id);
  if (!task) {
    throw new AppError("任务不存在", 404);
  }

  await schedulerService.unscheduleTask(id);
  await repository.updateTask(id, { scheduleEnabled: false });
  await repository.updateTaskStatus(id, "paused");
  await schedulerService.stopTaskRun(id);
  return repository.getTaskById(id);
}

async function runTaskNow(id) {
  const task = await repository.getTaskById(id);
  if (!task) {
    throw new AppError("任务不存在", 404);
  }

  if (task.status === "running") {
    throw new AppError("任务正在运行中", 400);
  }

  try {
    return await schedulerService.runTaskNow(id);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`立即执行失败: ${error.message}`, 500);
  }
}

async function getTaskDetail(id) {
  const task = await repository.getTaskById(id);
  if (!task) {
    throw new AppError("任务不存在", 404);
  }

  return task;
}

async function getJobRuns(taskId, limit) {
  const task = await repository.getTaskById(taskId);
  if (!task) {
    throw new AppError("任务不存在", 404);
  }

  await repository.reconcileTerminalRunningJobRuns(taskId);
  await repository.reconcileHistoricalRunningJobRuns(taskId);
  const normalizedLimit = limit === null || limit === undefined ? null : limit;
  return repository.getJobRuns(taskId, normalizedLimit);
}

async function analyzeJobRunFailure(taskId, runId, payload = {}) {
  const task = await repository.getTaskById(taskId);
  if (!task) {
    throw new AppError("任务不存在", 404);
  }

  const run = await repository.getJobRunById(taskId, runId);
  if (!run) {
    throw new AppError("运行记录不存在", 404);
  }

  if (run.runStatus !== "failed") {
    throw new AppError("仅支持分析失败状态的运行日志", 400);
  }

  const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("log_analysis");
  const provider = payload.modelProviderId
    ? await modelProviderService.getModelProviderById(payload.modelProviderId)
    : await resolveDefaultAnalysisProvider(aiConfig);
  const cacheKey = buildFailureAnalysisCacheKey(task, run, provider, payload.note);
  const cached = failureAnalysisCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const messages = ensureJsonObjectPrompt(buildFailureAnalysisPrompt(task, run, payload.note, aiConfig?.systemPrompt), provider);
  const completion = await modelProviderService.generateChatCompletion(provider, messages, {
    temperature: aiConfig?.temperature ?? 0.1,
    maxTokens: Number(aiConfig?.maxTokens || 512),
    timeoutMs: Number(aiConfig?.timeoutMs || 45000),
    responseFormat: { type: "json_object" }
  });
  const analysis = parseAnalysisResult(completion.content);

  const result = {
    runId: run.id,
    taskId,
    modelProviderId: provider.id,
    modelProviderName: provider.configName,
    modelName: provider.modelName,
    analysis,
    rawText: completion.content
  };

  failureAnalysisCache.set(cacheKey, result);
  trimFailureAnalysisCache();

  return result;
}

async function reconcileRunningJobsAfterRestart() {
  return repository.reconcileLatestRunningJobRunsAfterRestart();
}

async function resolveDefaultAnalysisProvider(aiConfig = null) {
  if (aiConfig?.defaultModelProviderId) {
    const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
    return modelProviderService.applyModelSelection(provider, {
      modelName: aiConfig.defaultModelName,
      modelVersion: aiConfig.defaultModelVersion,
    });
  }

  const providers = await modelProviderService.getActiveChatModelProviders();

  if (!providers.length) {
    throw new AppError("未找到可用的对话模型，请先在系统管理中启用大模型配置", 400);
  }

  return providers[0];
}

function buildFailureAnalysisPrompt(task, run, note = "", systemPromptOverride = "") {
  const executionInfo = run.executionInfo || {};
  const nested = executionInfo.executionInfo || executionInfo.result || {};
  const error = executionInfo.error || {};
  const stdout = normalizeLogContent(executionInfo.stdout || nested.stdout || error.stdout || "");
  const stderr = normalizeLogContent(executionInfo.stderr || nested.stderr || error.stderr || "");
  const primaryLog = selectPrimaryFailureLog(run.errorMessage, stderr, stdout);
  const secondaryLog = primaryLog === stderr ? stdout : stderr;

  return [
    {
      role: "system",
      content:
        systemPromptOverride ||
        "你是资深数据集成故障分析专家。请优先依据错误摘要、关键日志片段和执行指标，判断最可能的失败原因，并给出可执行排查建议。输出必须是 JSON，对象结构固定为 causeSummary、rootCause、evidence、suggestions、confidence、severity，不要输出 Markdown。"
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: {
            id: task.id,
            taskName: task.taskName,
            taskCode: task.taskCode,
            sourceName: task.sourceName,
            sourceTable: task.sourceTable,
            targetSourceName: task.targetSourceName,
            targetTable: task.targetTable,
            syncMode: task.syncMode
          },
          run: {
            id: run.id,
            runStatus: run.runStatus,
            startTime: run.startTime,
            endTime: run.endTime,
            recordsCount: run.recordsCount,
            errorMessage: run.errorMessage || "",
            metrics: extractExecutionMetrics(executionInfo, nested),
            progress: extractExecutionProgress(executionInfo, nested),
            error: summarizeErrorObject(error)
          },
          logs: {
            primary: primaryLog,
            secondary: secondaryLog
          },
          extraNote: note || "",
          outputFormat: {
            causeSummary: "一句话概括失败原因",
            rootCause: "详细根因说明",
            evidence: ["从日志提取的关键证据"],
            suggestions: ["建议的排查或修复动作"],
            confidence: "high | medium | low",
            severity: "critical | high | medium | low"
          }
        },
        null,
        2
      )
    }
  ];
}

function ensureJsonObjectPrompt(messages = [], provider = null) {
  const providerText = `${provider?.providerType || ""} ${provider?.configName || ""} ${provider?.modelName || ""}`.toLowerCase();
  if (!providerText.includes("deepseek")) {
    return messages;
  }
  return (Array.isArray(messages) ? messages : []).map((item, index, list) => {
    if (!item || typeof item !== "object") return item;
    if (index === 0 || index === list.length - 1) {
      return {
        ...item,
        content: `${String(item.content || "").trim()}\n\nReturn valid JSON only. The response must be a JSON object.`,
      };
    }
    return item;
  });
}

function normalizeLogContent(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const normalized = text.replace(/\r\n/g, "\n");
  return normalized.length > 4000 ? normalized.slice(-4000) : normalized;
}

function extractExecutionMetrics(executionInfo, nested) {
  const metrics = executionInfo.metrics || nested.metrics || {};
  return {
    totalRecords: metrics.totalRecords ?? null,
    successRecords: metrics.successRecords ?? null,
    errorRecords: metrics.errorRecords ?? null,
    speed: metrics.recordSpeed || metrics.speed || null
  };
}

function extractExecutionProgress(executionInfo, nested) {
  return {
    phase: executionInfo.phase || nested.phase || null,
    progressAt: executionInfo.progressAt || nested.progressAt || null,
    lastRunAt: executionInfo.lastRunAt || nested.lastRunAt || null
  };
}

function summarizeErrorObject(error) {
  if (!error || typeof error !== "object") {
    return {};
  }

  return {
    message: error.message || "",
    code: error.code || "",
    type: error.type || "",
    stack: summarizeStack(error.stack)
  };
}

function summarizeStack(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const lines = text.split(/\r?\n/).slice(0, 8);
  return lines.join("\n");
}

function selectPrimaryFailureLog(errorMessage, stderr, stdout) {
  if (stderr) {
    return stderr;
  }

  if (errorMessage) {
    return String(errorMessage);
  }

  return stdout;
}

function buildFailureAnalysisCacheKey(task, run, provider, note = "") {
  const fingerprint = [
    task.id,
    run.id,
    provider.id,
    run.runStatus,
    run.endTime || "",
    run.errorMessage || "",
    JSON.stringify(run.executionInfo || {}),
    note || ""
  ].join("|");

  return fingerprint;
}

function trimFailureAnalysisCache() {
  const maxEntries = 100;
  if (failureAnalysisCache.size <= maxEntries) {
    return;
  }

  const overflow = failureAnalysisCache.size - maxEntries;
  const keys = failureAnalysisCache.keys();
  for (let index = 0; index < overflow; index += 1) {
    const next = keys.next();
    if (next.done) {
      break;
    }
    failureAnalysisCache.delete(next.value);
  }
}

function parseAnalysisResult(content) {
  const normalized = String(content || "").trim();

  if (!normalized) {
    throw new AppError("模型未返回分析结果", 400);
  }

  try {
    const parsed = JSON.parse(extractJsonObject(normalized));
    return {
      causeSummary: parsed.causeSummary || "未识别",
      rootCause: parsed.rootCause || "",
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.map(String).filter(Boolean) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String).filter(Boolean) : [],
      confidence: normalizeEnum(parsed.confidence, ["high", "medium", "low"], "medium"),
      severity: normalizeEnum(parsed.severity, ["critical", "high", "medium", "low"], "medium")
    };
  } catch (_error) {
    return {
      causeSummary: normalized.slice(0, 120),
      rootCause: normalized,
      evidence: [],
      suggestions: [],
      confidence: "low",
      severity: "medium"
    };
  }
}

function extractJsonObject(content) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("invalid json");
  }

  return content.slice(start, end + 1);
}

function normalizeEnum(value, allowedValues, fallback) {
  const normalized = String(value || "").toLowerCase();
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function resolveTargetColumnType(mapping, sourceColumn, targetType = "mysql", connectionConfig = {}) {
  const mappingDataType = String(mapping.dataType || "").trim();
  const normalizedTargetType = resolveDatasourceDialect(targetType, connectionConfig);
  const sourceColumnType = String(sourceColumn?.columnType || "").trim();
  const sourceTypeDefinition = parseColumnTypeDefinitionForMapping(sourceColumnType || mappingDataType);

  if (normalizedTargetType === "postgresql" && ["json", "jsonb"].includes(sourceTypeDefinition.baseType)) {
    return "text";
  }

  if (sourceColumn?.columnType) {
    const sourceDataType = String(sourceColumn.dataType || "").trim().toLowerCase();
    const mappingBaseType = mappingDataType.toLowerCase();

    if (!mappingDataType) {
      return sourceColumnType;
    }

    if (mappingDataType.includes("(") || mappingDataType.includes(" ")) {
      return normalizeColumnTypeForTarget(mappingDataType, normalizedTargetType);
    }

    if (mappingBaseType === sourceDataType) {
      return normalizeColumnTypeForTarget(sourceColumnType, normalizedTargetType);
    }
  }

  return normalizeColumnTypeForTarget(
    mappingDataType || sourceColumn?.columnType || sourceColumn?.dataType || "varchar(255)",
    normalizedTargetType
  );
}

function buildTargetColumnsFromMappings(sourceColumns, fieldMappings, targetType = "mysql", connectionConfig = {}) {
  const normalizedTargetType = resolveDatasourceDialect(targetType, connectionConfig);
  return fieldMappings.map((mapping) => {
    const sourceColumn = sourceColumns.find((column) => column.columnName === mapping.sourceField);
    const columnType = resolveTargetColumnType(mapping, sourceColumn, targetType, connectionConfig);
    const hasExplicitDefault = Object.prototype.hasOwnProperty.call(mapping, "defaultValue")
      && mapping.defaultValue !== undefined;

    return {
      columnName: mapping.targetField,
      columnType,
      dataType: columnType,
      isNullable: !mapping.isPrimaryKey,
      isPrimaryKey: Boolean(mapping.isPrimaryKey),
      columnDefault: hasExplicitDefault ? mapping.defaultValue : sourceColumn?.columnDefault ?? null,
      extra: normalizedTargetType === "postgresql" ? "" : sourceColumn?.extra || "",
      columnComment: sourceColumn?.columnComment || ""
    };
  });
}

function normalizeColumnTypeForTarget(columnType, targetType) {
  const { baseType, args } = parseColumnTypeDefinitionForMapping(columnType);
  const isUnsigned = /\bunsigned\b/.test(baseType);
  const normalizedBaseType = baseType.replace(/\bunsigned\b/g, "").replace(/\s+/g, " ").trim();
  const normalizedTargetType = String(targetType || "").toLowerCase() === "postgres" ? "postgresql" : String(targetType || "").toLowerCase();

  if (normalizedTargetType === "mysql") {
    if (["varchar2", "nvarchar2", "varchar", "char", "nchar"].includes(normalizedBaseType)) {
      return `${normalizedBaseType === "varchar2" || normalizedBaseType === "nvarchar2" ? "varchar" : normalizedBaseType}(${Number(args[0] || 255)})`;
    }
    if (["number", "numeric", "decimal"].includes(normalizedBaseType)) {
      if (args.length >= 2) {
        return `decimal(${Number(args[0] || 18)},${Number(args[1] || 2)})`;
      }
      const precision = Number(args[0] || 0);
      if (precision > 0 && precision <= 10) {
        return "int";
      }
      if (precision > 10) {
        return "bigint";
      }
      return "decimal(18,2)";
    }
    if (["tinyint", "smallint", "mediumint", "int", "integer", "bigint"].includes(normalizedBaseType)) {
      const mysqlType = normalizedBaseType === "integer" ? "int" : normalizedBaseType;
      return `${mysqlType}${isUnsigned ? " unsigned" : ""}`;
    }
    if (["float", "double", "double precision", "real"].includes(normalizedBaseType)) {
      const mysqlType = normalizedBaseType === "double precision" ? "double" : normalizedBaseType;
      return `${mysqlType}${args.length ? `(${args.join(",")})` : ""}${isUnsigned ? " unsigned" : ""}`;
    }
    if (["boolean", "bool"].includes(normalizedBaseType)) {
      return "tinyint(1)";
    }
    if (["bit", "binary", "varbinary"].includes(normalizedBaseType)) {
      return `${normalizedBaseType}${args.length ? `(${args.join(",")})` : ""}`;
    }
    if (["blob", "longblob", "mediumblob", "tinyblob", "json", "time", "year"].includes(normalizedBaseType)) {
      return normalizedBaseType;
    }
    if (["enum", "set"].includes(normalizedBaseType) && args.length) {
      return `${normalizedBaseType}(${args.join(",")})`;
    }
    if (["timestamp", "datetime", "date", "datetime2", "datetimeoffset", "smalldatetime"].includes(normalizedBaseType)) {
      return normalizedBaseType === "date" ? "date" : "datetime";
    }
    if (["clob", "text", "longtext", "mediumtext", "tinytext"].includes(normalizedBaseType)) {
      return "text";
    }
  }

  if (normalizedTargetType === "postgresql") {
    if (["character varying", "varchar"].includes(normalizedBaseType)) {
      return `varchar(${Number(args[0] || 255)})`;
    }
    if (["character", "char"].includes(normalizedBaseType)) {
      return `char(${Number(args[0] || 1)})`;
    }
    if (["timestamp without time zone", "timestamp with time zone"].includes(normalizedBaseType)) {
      return normalizedBaseType;
    }
    if (["time without time zone", "time with time zone"].includes(normalizedBaseType)) {
      return normalizedBaseType;
    }
    if (["json", "jsonb"].includes(normalizedBaseType)) {
      return "text";
    }
    if (["varchar2", "nvarchar2", "varchar", "char", "nchar"].includes(normalizedBaseType)) {
      return `${normalizedBaseType === "char" || normalizedBaseType === "nchar" ? "char" : "varchar"}(${Number(args[0] || 255)})`;
    }
    if (["number", "numeric", "decimal"].includes(normalizedBaseType)) {
      if (args.length >= 2) {
        return `numeric(${Number(args[0] || 18)},${Number(args[1] || 2)})`;
      }
      const precision = Number(args[0] || 0);
      if (precision > 0 && precision <= 10) {
        return "integer";
      }
      if (precision > 10) {
        return "bigint";
      }
      return "numeric(18,2)";
    }
    if (["tinyint"].includes(normalizedBaseType)) {
      return isUnsigned ? "smallint" : "smallint";
    }
    if (["smallint"].includes(normalizedBaseType)) {
      return isUnsigned ? "integer" : "smallint";
    }
    if (["mediumint", "int", "integer"].includes(normalizedBaseType)) {
      return isUnsigned ? "bigint" : "integer";
    }
    if (["bigint"].includes(normalizedBaseType)) {
      return isUnsigned ? "numeric(20,0)" : "bigint";
    }
    if (["float"].includes(normalizedBaseType)) {
      return "real";
    }
    if (["double", "double precision"].includes(normalizedBaseType)) {
      return "double precision";
    }
    if (["bit", "boolean", "bool"].includes(normalizedBaseType)) {
      return normalizedBaseType === "bit" && Number(args[0] || 0) > 1 ? `bit(${Number(args[0])})` : "boolean";
    }
    if (["blob", "longblob", "mediumblob", "tinyblob", "binary", "varbinary"].includes(normalizedBaseType)) {
      return "bytea";
    }
    if (["json"].includes(normalizedBaseType)) {
      return "text";
    }
    if (["timestamp", "datetime", "date", "datetime2", "datetimeoffset", "smalldatetime"].includes(normalizedBaseType)) {
      return normalizedBaseType === "date" ? "date" : "timestamp";
    }
    if (["time"].includes(normalizedBaseType)) {
      return "time";
    }
    if (["year"].includes(normalizedBaseType)) {
      return "integer";
    }
    if (["clob", "text", "longtext", "mediumtext", "tinytext"].includes(normalizedBaseType)) {
      return "text";
    }
  }

  if (normalizedTargetType === "postgresql" && isUnsigned) {
    if (normalizedBaseType === "decimal") {
      return args.length >= 2
        ? `numeric(${Number(args[0] || 18)},${Number(args[1] || 2)})`
        : "numeric(18,2)";
    }
    if (normalizedBaseType === "numeric") {
      return args.length >= 2
        ? `numeric(${Number(args[0] || 18)},${Number(args[1] || 2)})`
        : "numeric(18,2)";
    }
  }

  return getTargetTextType(normalizedTargetType);
}

function parseColumnTypeDefinitionForMapping(columnType) {
  const normalized = String(columnType || "").trim().toLowerCase();
  const match = normalized.match(/^([a-z0-9_ ]+?)(?:\(([^)]+)\))?$/);
  return {
    baseType: match ? match[1].trim() : normalized,
    args: match?.[2] ? match[2].split(",").map((item) => item.trim()) : [],
  };
}

function getTargetTextType(targetType = "mysql") {
  const normalizedTargetType = String(targetType || "").toLowerCase();
  if (normalizedTargetType === "hive") {
    return "string";
  }
  return "text";
}

function resolveSourceTableComment(tables = [], tableName = "") {
  const normalized = String(tableName || "").trim().replace(/["`]/g, "");
  if (!normalized) {
    return "";
  }

  const candidates = [normalized];
  const simple = normalized.split(".").filter(Boolean).pop();
  if (simple && simple !== normalized) {
    candidates.push(simple);
  }

  const matched = (Array.isArray(tables) ? tables : []).find((item) => {
    const current = String(item?.tableName || "").trim().replace(/["`]/g, "");
    return candidates.includes(current);
  });

  return String(matched?.tableComment || "").trim();
}
module.exports = {
  listTasks,
  getMonitorOverview,
  createTask,
  updateTask,
  previewTaskUpdate,
  previewSourceData,
  deleteTask,
  startTask,
  stopTask,
  runTaskNow,
  getTaskDetail,
  getJobRuns,
  analyzeJobRunFailure,
  reconcileRunningJobsAfterRestart,
  buildTargetColumnsFromMappings,
};
