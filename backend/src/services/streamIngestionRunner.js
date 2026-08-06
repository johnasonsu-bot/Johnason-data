const path = require("path");
const crypto = require("crypto");
const { Writable } = require("stream");
const ftp = require("basic-ftp");
const { Kafka, logLevel } = require("kafkajs");
const mysql = require("mysql2/promise");
const AppError = require("../common/errors/app-error");
const repository = require("../modules/ingestion-tasks/ingestion-task.repository");
const dataSourceMetadata = require("../modules/data-sources/data-source.metadata");
const { parseFileBuffer } = require("../modules/file-imports/file-import.parser");
const hiveService = require("./hiveService");
const apiIngestionService = require("./apiIngestionService");
const { adaptApiRows } = require("./apiRowAdapters");
const { buildConflictClause, deduplicateRowsByKeys } = require("./sqlInsertBuilder");
const { createPostgresLikeClient } = require("../common/utils/db-client");
const { inferDatasourceDialect, resolveDatasourceConnection } = require("../common/utils/datasource-dialect");

async function executeStreamTask(task, jobRun = null) {
  const sourceDialect = inferDatasourceDialect(task.sourceType, task.sourceConnectionConfig || {});
  if (sourceDialect === "kafka") {
    return executeKafkaTask(task);
  }
  if (sourceDialect === "ftp") {
    return executeFtpTask(task, jobRun);
  }
  if (sourceDialect === "api") {
    return executeApiTask(task, jobRun);
  }
  throw new Error(`Unsupported stream source dialect: ${sourceDialect}`);
}

async function executeApiTask(task, jobRun = null) {
  const sourceConfig = task.sourceConfig || {};
  const parseConfig = task.parseConfig || {};
  const errorConfig = task.errorConfig || {};
  const state = await repository.getApiSyncState(task.id, "default");
  const collectResult = await apiIngestionService.collectApiRows({
    task,
    connectionConfig: task.sourceConnectionConfig || {},
    sourceConfig,
    parseConfig,
    errorConfig,
    state,
  });
  const adaptedRows = adaptApiRows(sourceConfig.rowAdapter, collectResult.rows);
  const writeResult = await writeMappedRows(task, adaptedRows);
  await repository.upsertApiSyncState({
    projectId: task.projectId || null,
    taskId: task.id,
    stateKey: collectResult.state.stateKey,
    lastCursorValue: collectResult.state.lastCursorValue,
    lastSuccessTime: collectResult.state.lastSuccessTime,
    lastPage: collectResult.state.lastPage,
    lastOffset: collectResult.state.lastOffset,
    lastNextCursor: collectResult.state.lastNextCursor,
    lastRunId: jobRun?.id || null,
    status: "completed",
  });

  return {
    success: true,
    recordsCount: writeResult.recordsCount,
    metrics: {
      totalRecords: adaptedRows.length,
      successRecords: writeResult.recordsCount,
      errorRecords: 0,
    },
    executionInfo: {
      engine: "node-api-fetch",
      sourceType: "api",
      endpointPath: sourceConfig.endpointPath || task.sourceTable,
      syncMode: task.syncMode || "full",
      pageResults: collectResult.pageResults,
      fetchedRecords: collectResult.rows.length,
      acceptedRecords: adaptedRows.length,
      writtenRecords: writeResult.recordsCount,
      targetTable: task.targetTable,
      state: collectResult.state,
    },
  };
}

async function executeKafkaTask(task) {
  const sourceConfig = task.sourceConfig || {};
  const parseConfig = task.parseConfig || {};
  const topic = sourceConfig.topic || task.sourceTable;
  const kafka = createKafka(task.sourceConnectionConfig || {});
  const groupId = sourceConfig.consumerGroupId || `medata_ingestion_${task.taskCode || task.id}`;
  const consumer = kafka.consumer({ groupId });
  const rows = [];
  const offsets = new Map();
  const batchSize = Math.max(1, Number(sourceConfig.batchSize || 100));
  const maxWaitMs = Math.max(1000, Number(sourceConfig.maxWaitMs || 10000));
  const fromBeginning = String(sourceConfig.startMode || "latest") === "earliest";

  await consumer.connect();
  try {
    await consumer.subscribe({ topic, fromBeginning });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        consumer.pause([{ topic }]);
        resolve();
      }, maxWaitMs);
      consumer.run({
        autoCommit: false,
        eachMessage: async ({ topic: itemTopic, partition, message }) => {
          rows.push(...parseKafkaMessage(itemTopic, partition, message, parseConfig, sourceConfig));
          const key = `${itemTopic}:${partition}`;
          offsets.set(key, {
            topic: itemTopic,
            partition,
            offset: Number(message.offset),
            timestamp: message.timestamp ? new Date(Number(message.timestamp)) : null,
          });
          if (rows.length >= batchSize) {
            clearTimeout(timer);
            consumer.pause([{ topic }]);
            resolve();
          }
        },
      }).catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    const writeResult = await writeMappedRows(task, rows);
    const commitPayload = [...offsets.values()].map((item) => ({
      topic: item.topic,
      partition: item.partition,
      offset: String(item.offset + 1),
    }));
    if (commitPayload.length > 0) {
      await consumer.commitOffsets(commitPayload);
      await Promise.all([...offsets.values()].map((item) =>
        repository.upsertKafkaOffset({
          taskId: task.id,
          topicName: item.topic,
          partitionId: item.partition,
          lastProcessedOffset: item.offset,
          lastCommittedOffset: item.offset + 1,
          messageTimestamp: item.timestamp,
        })
      ));
    }

    return {
      success: true,
      recordsCount: writeResult.recordsCount,
      metrics: {
        totalRecords: rows.length,
        successRecords: writeResult.recordsCount,
        errorRecords: 0,
      },
      executionInfo: {
        engine: "node-kafkajs",
        sourceType: "kafka",
        topic,
        consumerGroupId: groupId,
        readRecords: rows.length,
        writtenRecords: writeResult.recordsCount,
        committedOffsets: commitPayload,
        targetTable: task.targetTable,
      },
    };
  } finally {
    await consumer.disconnect().catch(() => {});
  }
}

function createKafka(config = {}) {
  const bootstrapServers = String(config.bootstrapServers || config.bootstrapServer || `${config.host || ""}${config.port ? `:${config.port}` : ""}`)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!bootstrapServers.length) {
    throw new AppError("Kafka 数据源缺少 bootstrapServers", 400);
  }
  return new Kafka({
    clientId: String(config.clientId || "medata-ingestion-runner"),
    brokers: bootstrapServers,
    logLevel: logLevel.NOTHING,
    retry: { retries: 2 },
    connectionTimeout: 8000,
    requestTimeout: 10000,
  });
}

function parseKafkaMessage(topic, partition, message, parseConfig, sourceConfig) {
  const rawValue = message.value ? message.value.toString(parseConfig.encoding || "utf8") : "";
  const metadata = sourceConfig.includeMetadata === false ? {} : {
    _kafka_topic: topic,
    _kafka_partition: partition,
    _kafka_offset: message.offset,
    _kafka_timestamp: message.timestamp ? new Date(Number(message.timestamp)).toISOString() : null,
    _kafka_key: message.key ? message.key.toString("utf8") : "",
    _raw_value: rawValue,
  };
  const format = String(parseConfig.messageFormat || "json").toLowerCase();
  if (format === "json") {
    try {
      const parsed = JSON.parse(rawValue);
      const resolved = resolveJsonPath(parsed, parseConfig.jsonRootPath || "");
      const items = Array.isArray(resolved) ? resolved : [resolved];
      return items
        .filter((item) => item && typeof item === "object")
        .map((item) => ({ ...flattenObject(item), ...metadata }));
    } catch (error) {
      if (parseConfig.skipErrorRows === false) {
        throw error;
      }
      return [];
    }
  }
  return [{ value: rawValue, ...metadata }];
}

async function executeFtpTask(task, jobRun = null) {
  const sourceConfig = task.sourceConfig || {};
  const parseConfig = task.parseConfig || {};
  const files = await listFtpCandidateFiles(task.sourceConnectionConfig || {}, sourceConfig);
  const isIncrementalMode = String(task.syncMode || "full").toLowerCase() === "incremental";
  const completedStates = isIncrementalMode ? await repository.listCompletedFtpFileStates(task.id) : [];
  const completedByPath = new Map(completedStates.map((item) => [item.remotePath, item]));
  const selectedFiles = files
    .filter((file) => !isIncrementalMode || shouldProcessFtpFile(file, completedByPath.get(file.relativePath)))
    .slice(0, sourceConfig.batchFileLimit || 20);
  const rawRows = [];
  const fileResults = [];

  for (const file of selectedFiles) {
    await repository.upsertFtpFileState({
      taskId: task.id,
      remotePath: file.relativePath,
      fileSize: file.size,
      modifiedAt: file.modifiedAt,
      status: "processing",
      lastRunId: jobRun?.id || null,
    });
    try {
      const buffer = await downloadFtpFile(task.sourceConnectionConfig || {}, file.relativePath);
      const fileHash = crypto.createHash("sha1").update(buffer).digest("hex");
      const parseResult = parseFileBuffer({
        originalname: path.posix.basename(file.relativePath),
        fileName: path.posix.basename(file.relativePath),
        buffer,
        size: buffer.length,
      }, {
        ...parseConfig,
        fileType: parseConfig.fileType || detectFileType(file.relativePath),
      });
      if ((parseResult.rowErrors || []).length > 0 && parseConfig.skipErrorRows === false) {
        throw new AppError(`文件 ${file.relativePath} 存在解析错误`, 400, parseResult.rowErrors[0]);
      }
      parseResult.rows.forEach((row) => {
        rawRows.push({
          ...row,
          _source_file_path: file.relativePath,
          _source_file_name: path.posix.basename(file.relativePath),
          _source_file_size: file.size,
          _source_file_mtime: file.modifiedAt ? new Date(file.modifiedAt).toISOString() : null,
          _source_line_no: row.__rowNo || null,
        });
      });
      fileResults.push({ ...file, rows: parseResult.rows.length, fileHash, status: "completed" });
    } catch (error) {
      await repository.upsertFtpFileState({
        taskId: task.id,
        remotePath: file.relativePath,
        fileSize: file.size,
        modifiedAt: file.modifiedAt,
        status: "failed",
        lastRunId: jobRun?.id || null,
        errorMessage: error.message,
      });
      if (parseConfig.skipErrorRows === false) {
        throw error;
      }
      fileResults.push({ ...file, rows: 0, status: "failed", errorMessage: error.message });
    }
  }

  const writeResult = await writeMappedRows(task, rawRows);
  for (const file of fileResults.filter((item) => item.status === "completed")) {
    await repository.upsertFtpFileState({
      taskId: task.id,
      remotePath: file.relativePath,
      fileSize: file.size,
      modifiedAt: file.modifiedAt,
      fileHash: file.fileHash,
      status: "completed",
      lastRunId: jobRun?.id || null,
      processedRows: file.rows,
      processedAt: new Date(),
    });
    await postProcessFtpFile(task.sourceConnectionConfig || {}, sourceConfig, file.relativePath);
  }

  return {
    success: true,
    recordsCount: writeResult.recordsCount,
    metrics: {
      totalRecords: rawRows.length,
      successRecords: writeResult.recordsCount,
      errorRecords: fileResults.filter((item) => item.status === "failed").length,
    },
    executionInfo: {
      engine: "node-ftp-parser",
      sourceType: "ftp",
      syncMode: isIncrementalMode ? "incremental" : "full",
      rootDir: sourceConfig.rootDir,
      matchedFiles: files.length,
      processedFiles: selectedFiles.length,
      skippedFiles: Math.max(0, files.length - selectedFiles.length),
      writtenRecords: writeResult.recordsCount,
      fileResults,
      targetTable: task.targetTable,
    },
  };
}

async function writeMappedRows(task, sourceRows) {
  const fieldMappings = (task.fieldMappings || []).filter((item) => item.targetField);
  let targetRows = sourceRows.map((row) => Object.fromEntries(
    fieldMappings.map((mapping) => [mapping.targetField, convertCellValue(row[mapping.sourceField], mapping.dataType)])
  ));
  const targetColumns = fieldMappings.map((mapping) => mapping.targetField);
  if (String(task.targetConfig?.writeMode || "append").toLowerCase() === "upsert") {
    targetRows = deduplicateRowsByKeys(targetRows, task.targetConfig?.keyFields || []);
  }
  const targetDialect = inferDatasourceDialect(task.targetSourceType || task.targetType, task.targetConnectionConfig || {});

  if (targetDialect === "mysql") {
    await writeMysqlRows(task.targetConnectionConfig || {}, task.targetTable, targetColumns, targetRows, task.targetConfig || {});
  } else if (targetDialect === "postgresql") {
    await writePostgresqlRows(task.targetConnectionConfig || {}, task.targetTable, targetColumns, targetRows, task.targetConfig || {});
  } else if (targetDialect === "hive") {
    const columns = fieldMappings.map((mapping) => ({ columnName: mapping.targetField, dataType: mapping.dataType || "string" }));
    await hiveService.loadRows(task.targetConnectionConfig || {}, task.targetTable, columns, targetRows, task.targetConfig || {});
  } else {
    throw new Error(`Unsupported stream target dialect: ${targetDialect}`);
  }
  return { recordsCount: targetRows.length };
}

async function writeMysqlRows(connectionConfig, tableName, targetColumns, rows, options = {}) {
  const connection = await mysql.createConnection(buildSqlConnectionConfig(connectionConfig, 3306));
  try {
    const qualifiedTable = dataSourceMetadata.escapeIdentifier(tableName, "mysql");
    if (String(options.writeMode || "append").toLowerCase() === "overwrite") {
      await connection.query(`TRUNCATE TABLE ${qualifiedTable}`);
    }
    await insertRows(connection, "mysql", qualifiedTable, targetColumns, rows, options);
  } finally {
    await connection.end();
  }
}

async function writePostgresqlRows(connectionConfig, tableName, targetColumns, rows, options = {}) {
  const resolved = resolveDatasourceConnection("postgresql", connectionConfig || {});
  const client = createPostgresLikeClient({
    host: resolved.host,
    port: Number(resolved.port || 5432),
    database: resolved.database,
    user: resolved.username,
    username: resolved.username,
    password: resolved.password,
    connectionTimeoutMillis: 5000,
  }, { sourceType: "postgresql" });
  await client.connect();
  try {
    const qualifiedTable = dataSourceMetadata.escapeIdentifier(tableName, "postgresql");
    if (String(options.writeMode || "append").toLowerCase() === "overwrite") {
      await client.query(`TRUNCATE TABLE ${qualifiedTable}`);
    }
    await insertRows(client, "postgresql", qualifiedTable, targetColumns, rows, options);
  } finally {
    await client.end();
  }
}

async function insertRows(connection, dialect, qualifiedTable, targetColumns, rows, options = {}) {
  if (!rows.length || !targetColumns.length) return;
  const batchSize = 500;
  const verb = dialect === "mysql" && String(options.writeMode || "").toLowerCase() === "replace" ? "REPLACE" : "INSERT";
  const columnSql = targetColumns.map((column) => dataSourceMetadata.escapeIdentifier(column, dialect)).join(", ");
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values = [];
    const placeholders = batch.map((row, rowIndex) => {
      const rowPlaceholders = targetColumns.map((column, columnIndex) => {
        values.push(row[column] === undefined ? null : row[column]);
        return dialect === "postgresql" ? `$${rowIndex * targetColumns.length + columnIndex + 1}` : "?";
      });
      return `(${rowPlaceholders.join(", ")})`;
    });
    const conflictClause = buildConflictClause(dialect, targetColumns, options);
    await connection.query(`${verb} INTO ${qualifiedTable} (${columnSql}) VALUES ${placeholders.join(", ")}${conflictClause}`, values);
  }
}

function buildSqlConnectionConfig(connectionConfig, defaultPort) {
  const resolved = resolveDatasourceConnection(connectionConfig.sourceType || "mysql", connectionConfig || {});
  return {
    host: resolved.host,
    port: Number(resolved.port || defaultPort),
    database: resolved.database,
    user: resolved.username,
    password: resolved.password,
    connectTimeout: 5000,
  };
}

function convertCellValue(value, dataType) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(dataType || "text").toLowerCase();
  if (normalized.includes("json")) return typeof value === "string" ? value : JSON.stringify(value);
  if (normalized.includes("int")) return Math.trunc(Number(value));
  if (normalized.includes("decimal") || normalized.includes("numeric") || normalized.includes("double") || normalized.includes("float")) return Number(value);
  if (normalized === "date") return new Date(value).toISOString().slice(0, 10);
  if (normalized.includes("time")) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString().slice(0, 19).replace("T", " ");
  }
  if (normalized.includes("bool")) return ["1", "true", "yes", "是"].includes(String(value).toLowerCase());
  return String(value);
}

async function listFtpCandidateFiles(connectionConfig, sourceConfig) {
  return withFtpClient(connectionConfig, async (client, config) => {
    const result = [];
    if (sourceConfig.pathMode === "file") {
      const filePath = sourceConfig.rootDir.replace(/^\/+/, "");
      const stat = await getFtpFileStat(client, config, filePath);
      return [{ relativePath: filePath, ...stat }];
    }
    await visitFtpDirectory(client, config, sourceConfig.rootDir, sourceConfig, result, 0);
    return result
      .filter((file) => matchFilePattern(file.relativePath, sourceConfig.filePattern, sourceConfig.excludePattern))
      .filter((file) => isStableFile(file, sourceConfig.stabilitySeconds))
      .sort((left, right) => String(left.relativePath).localeCompare(String(right.relativePath)));
  });
}

async function visitFtpDirectory(client, config, relativeDir, sourceConfig, result, depth) {
  if (depth > Number(sourceConfig.maxDepth || 3) || result.length >= 2000) return;
  const remoteDir = normalizeRemotePath(config.rootPath, relativeDir);
  const entries = await client.list(remoteDir);
  for (const entry of entries) {
    const relativePath = [String(relativeDir || "").replace(/^\/+|\/+$/g, ""), entry.name].filter(Boolean).join("/");
    if (entry.isDirectory) {
      if (sourceConfig.recursive !== false) {
        await visitFtpDirectory(client, config, relativePath, sourceConfig, result, depth + 1);
      }
      continue;
    }
    result.push({
      relativePath,
      size: Number(entry.size || 0),
      modifiedAt: entry.modifiedAt || null,
    });
  }
}

async function getFtpFileStat(client, config, relativePath) {
  const parentDir = path.posix.dirname(relativePath) === "." ? "" : path.posix.dirname(relativePath);
  const fileName = path.posix.basename(relativePath);
  const entries = await client.list(normalizeRemotePath(config.rootPath, parentDir));
  const entry = entries.find((item) => item.name === fileName && !item.isDirectory);
  if (!entry) throw new AppError(`FTP 文件不存在：${relativePath}`, 404);
  return { size: Number(entry.size || 0), modifiedAt: entry.modifiedAt || null };
}

async function downloadFtpFile(connectionConfig, relativePath) {
  return withFtpClient(connectionConfig, async (client, config) => {
    const chunks = [];
    await client.downloadTo(collectWritable(chunks), normalizeRemotePath(config.rootPath, relativePath));
    return Buffer.concat(chunks);
  });
}

async function postProcessFtpFile(connectionConfig, sourceConfig, relativePath) {
  const action = String(sourceConfig.postProcessAction || "keep").toLowerCase();
  if (action === "keep") return;
  await withFtpClient(connectionConfig, async (client, config) => {
    const sourcePath = normalizeRemotePath(config.rootPath, relativePath);
    if (action === "delete") {
      await client.remove(sourcePath);
      return;
    }
    if (action === "archive" && sourceConfig.archiveDir) {
      const archiveRelativePath = [sourceConfig.archiveDir.replace(/^\/+|\/+$/g, ""), path.posix.basename(relativePath)].filter(Boolean).join("/");
      const archivePath = normalizeRemotePath(config.rootPath, archiveRelativePath);
      await ensureFtpDirectory(client, path.posix.dirname(archivePath));
      await client.rename(sourcePath, archivePath);
    }
  });
}

async function ensureFtpDirectory(client, remoteDir) {
  const parts = String(remoteDir || "").split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    await client.ensureDir(current);
  }
}

async function withFtpClient(connectionConfig, handler) {
  const config = {
    host: String(connectionConfig.host || "").trim(),
    port: Number(connectionConfig.port || 21),
    user: String(connectionConfig.username || connectionConfig.user || "").trim(),
    password: String(connectionConfig.password || ""),
    secure: Boolean(connectionConfig.secure || connectionConfig.ftps),
    rootPath: String(connectionConfig.rootPath || connectionConfig.path || "/").trim() || "/",
  };
  if (!config.host || !config.user) {
    throw new AppError("FTP 数据源缺少主机或用户名", 400);
  }
  const client = new ftp.Client(15000);
  client.ftp.verbose = false;
  try {
    await client.access({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      secure: config.secure,
    });
    return await handler(client, config);
  } finally {
    client.close();
  }
}

function collectWritable(chunks) {
  return new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });
}

function normalizeRemotePath(rootPath, relativePath = "") {
  const root = String(rootPath || "/").replace(/\\/g, "/").replace(/\/+$/, "") || "/";
  const rel = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!rel) return root;
  return root === "/" ? `/${rel}` : `${root}/${rel}`;
}

function matchFilePattern(filePath, filePattern = "*", excludePattern = "") {
  const fileName = String(filePath || "").split("/").pop() || "";
  if (excludePattern && new RegExp(excludePattern).test(fileName)) return false;
  const pattern = String(filePattern || "*").trim();
  if (!pattern || pattern === "*") return true;
  const regexText = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${regexText}$`, "i").test(fileName);
}

function isStableFile(file, stabilitySeconds = 0) {
  if (!stabilitySeconds || !file.modifiedAt) return true;
  return Date.now() - new Date(file.modifiedAt).getTime() >= Number(stabilitySeconds) * 1000;
}

function shouldProcessFtpFile(file, completedState) {
  if (!completedState) return true;
  const previousSize = Number(completedState.fileSize || 0);
  const nextSize = Number(file.size || 0);
  const previousModified = completedState.modifiedAt ? new Date(completedState.modifiedAt).getTime() : 0;
  const nextModified = file.modifiedAt ? new Date(file.modifiedAt).getTime() : 0;
  return previousSize !== nextSize || previousModified !== nextModified;
}

function detectFileType(filePath) {
  const ext = path.posix.extname(String(filePath || "")).replace(".", "").toLowerCase();
  return ext || "txt";
}

function flattenObject(value, prefix = "", result = {}) {
  Object.entries(value || {}).forEach(([key, item]) => {
    const nextKey = prefix ? `${prefix}_${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      flattenObject(item, nextKey, result);
    } else {
      result[nextKey] = Array.isArray(item) ? JSON.stringify(item) : item;
    }
  });
  return result;
}

function resolveJsonPath(value, jsonPath = "") {
  const parts = String(jsonPath || "").replace(/^\$\./, "").split(".").map((item) => item.trim()).filter(Boolean);
  return parts.reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), value);
}

module.exports = {
  executeStreamTask,
};
