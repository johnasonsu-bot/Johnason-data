const path = require("path");
const { Writable } = require("stream");
const ftp = require("basic-ftp");
const { Kafka, logLevel } = require("kafkajs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const iconv = require("iconv-lite");
const metadataService = require("./data-source.metadata");
const AppError = require("../../common/errors/app-error");
const { parseFileBuffer, buildPreviewResult, detectFileType } = require("../file-imports/file-import.parser");
const { normalizeDatasourceType, inferDatasourceDialect } = require("../../common/utils/datasource-dialect");
const apiIngestionService = require("../../services/apiIngestionService");

const STRUCTURED_FILE_TYPES = new Set(["csv", "txt", "xls", "xlsx", "json", "xml"]);
const DOCUMENT_FILE_TYPES = new Set(["pdf", "docx"]);
const DEFAULT_MAX_FILE_BYTES = 1024 * 1024;
const FTP_PREVIEW_CACHE_TTL_MS = 15 * 1000;
const ftpPreviewCache = new Map();

function normalizeSourceType(dataSource) {
  const normalized = normalizeDatasourceType(dataSource?.sourceType);
  const dialect = inferDatasourceDialect(normalized, dataSource?.connectionConfig || {});
  return dialect === "unknown" ? normalized : dialect;
}

function isFtpSource(dataSource) {
  return normalizeSourceType(dataSource) === "ftp";
}

function isKafkaSource(dataSource) {
  return normalizeSourceType(dataSource) === "kafka";
}

function isApiSource(dataSource) {
  return normalizeSourceType(dataSource) === "api";
}

function getFtpConfig(dataSource) {
  const config = dataSource?.connectionConfig || {};
  return {
    host: String(config.host || "").trim(),
    port: Number(config.port || 21),
    user: String(config.username || config.user || "").trim(),
    password: String(config.password || ""),
    secure: Boolean(config.secure || config.ftps),
    rootPath: String(config.rootPath || config.path || "/").trim() || "/",
    passiveMode: config.passiveMode !== false,
    encoding: String(config.encoding || "utf8").trim() || "utf8",
    maxPreviewBytes: Math.max(1024, Math.min(5 * 1024 * 1024, Number(config.maxPreviewBytes || DEFAULT_MAX_FILE_BYTES))),
  };
}

async function withFtpClient(dataSource, handler) {
  const config = getFtpConfig(dataSource);
  if (!config.host || !config.port || !config.user) {
    throw new AppError("FTP 数据源缺少主机、端口或用户名", 400);
  }
  const maxAttempts = 5;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = new ftp.Client(10000);
    client.ftp.verbose = false;
    try {
      await connectFtpClient(client, config);
      return await handler(client, config);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isTransientFtpError(error)) {
        throw error;
      }
      await sleep(Math.min(4000, 700 * 2 ** (attempt - 1)));
    } finally {
      client.close();
    }
  }
  throw lastError;
}

function isTransientFtpError(error) {
  if (error instanceof AppError) return false;
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT"].includes(code)
    || message.includes("control socket")
    || message.includes("socket");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectFtpClient(client, config) {
  await client.connect(config.host, Number(config.port || 21));
  if (config.secure) {
    await client.useTLS({ host: config.host });
  }
  await client.login(config.user, config.password);
  await client.send("TYPE I");
  await client.sendIgnoringError("STRU F");
}

function normalizeRemotePath(rootPath, relativePath = "") {
  const root = String(rootPath || "/").replace(/\\/g, "/").replace(/\/+$/, "") || "/";
  const rel = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!rel) return root;
  return root === "/" ? `/${rel}` : `${root}/${rel}`;
}

async function listFtpFiles(dataSource, options = {}) {
  return withFtpClient(dataSource, async (client, config) => {
    const result = [];
    async function visit(relativeDir, depth) {
      if (depth > 2 || result.length >= 500) return;
      const remoteDir = normalizeRemotePath(config.rootPath, relativeDir);
      const entries = await client.list(remoteDir);
      for (const entry of entries) {
        const relativePath = [relativeDir, entry.name].filter(Boolean).join("/");
        if (entry.isDirectory) {
          if (options.includeDirectories) {
            result.push({
              tableName: relativePath,
              tableType: "DIRECTORY",
              tableComment: entry.modifiedAt ? `目录 / ${entry.modifiedAt.toISOString()}` : "目录",
              objectType: "directory",
              fileSize: 0,
              modifiedAt: entry.modifiedAt ? entry.modifiedAt.toISOString() : null,
            });
          }
          await visit(relativePath, depth + 1);
          continue;
        }
        result.push({
          tableName: relativePath,
          tableType: "FILE",
          tableComment: `${entry.size || 0} bytes${entry.modifiedAt ? ` / ${entry.modifiedAt.toISOString()}` : ""}`,
          objectType: "file",
          fileSize: Number(entry.size || 0),
          modifiedAt: entry.modifiedAt ? entry.modifiedAt.toISOString() : null,
        });
      }
    }
    await visit("", 0);
    return result.sort((left, right) => String(left.tableName).localeCompare(String(right.tableName)));
  });
}

function collectWritable(chunks) {
  return new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });
}

async function downloadFtpFile(dataSource, filePath) {
  return withFtpClient(dataSource, async (client, config) => {
    const normalizedFilePath = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalizedFilePath || normalizedFilePath.split("/").some((part) => part === "..")) {
      throw new AppError("FTP 文件不存在或不在根目录范围内", 404);
    }

    const remotePath = normalizeRemotePath(config.rootPath, normalizedFilePath);
    let fileSize = 0;
    let modifiedAt = null;
    try {
      fileSize = Number(await client.size(remotePath)) || 0;
    } catch (_error) {
      try {
        const parentDir = getRemoteParentDir(normalizedFilePath);
        const fileName = path.posix.basename(normalizedFilePath);
        const entries = await client.list(normalizeRemotePath(config.rootPath, parentDir));
        const entry = entries.find((item) => item.name === fileName && !item.isDirectory);
        if (!entry) throw _error;
        fileSize = Number(entry.size || 0);
        modifiedAt = entry.modifiedAt ? entry.modifiedAt.toISOString() : null;
      } catch {
        throw new AppError("FTP 文件不存在或不在根目录范围内", 404);
      }
    }

    if (fileSize > config.maxPreviewBytes) {
      throw new AppError(`文件超过预览大小限制 ${config.maxPreviewBytes} 字节`, 400);
    }
    const chunks = [];
    await client.downloadTo(collectWritable(chunks), remotePath);
    return {
      file: {
        tableName: normalizedFilePath,
        tableType: "FILE",
        tableComment: `${fileSize} bytes${modifiedAt ? ` / ${modifiedAt}` : ""}`,
        objectType: "file",
        fileSize,
        modifiedAt,
      },
      config,
      buffer: Buffer.concat(chunks),
    };
  });
}

function getRemoteParentDir(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const dirname = path.posix.dirname(normalized);
  return dirname === "." ? "" : dirname;
}

function decodeText(buffer, encoding = "utf8") {
  const normalized = String(encoding || "utf8").trim().toLowerCase();
  if (normalized && normalized !== "utf8" && normalized !== "utf-8" && iconv.encodingExists(normalized)) {
    return iconv.decode(buffer, normalized);
  }
  const candidates = [
    buffer.toString("utf8"),
    iconv.decode(buffer, "gb18030"),
    iconv.decode(buffer, "gbk"),
  ];
  return candidates.find((item) => item && !item.includes("\uFFFD")) || candidates[0] || "";
}

async function parseFtpFile(dataSource, filePath, limit = 20, parseOptions = {}) {
  const { file, config, buffer } = await downloadFtpFile(dataSource, filePath);
  const fileType = String(parseOptions.fileType || detectFileType(filePath)).toLowerCase();
  if (STRUCTURED_FILE_TYPES.has(fileType)) {
    const pseudoFile = {
      originalname: path.basename(filePath),
      fileName: path.basename(filePath),
      fileSize: buffer.length,
      size: buffer.length,
      buffer,
    };
    const parseResult = parseFileBuffer(pseudoFile, {
      ...parseOptions,
      fileType,
      previewLimit: limit,
      encoding: parseOptions.encoding || config.encoding,
    });
    const preview = buildPreviewResult(pseudoFile, parseResult, { previewLimit: limit });
    return {
      file,
      fileType,
      columns: preview.schema.map((item, index) => ({
        columnName: item.fieldName || item.sourceField || `field_${index + 1}`,
        ordinalPosition: index + 1,
        dataType: item.dataType || item.inferredType || item.suggestedType || "string",
        columnType: item.columnType || item.suggestedType || item.dataType || item.inferredType || "string",
        isNullable: item.nullable !== false,
        isPrimaryKey: false,
        columnComment: "",
      })),
      rows: preview.sampleRows,
      contentText: "",
      parseMeta: preview,
    };
  }
  if (fileType === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return { file, fileType, columns: buildDocumentColumns(), rows: buildDocumentRows(result.value, limit), contentText: result.value || "", parseMeta: {} };
  }
  if (fileType === "pdf") {
    const result = await pdfParse(buffer);
    return { file, fileType, columns: buildDocumentColumns(), rows: buildDocumentRows(result.text, limit), contentText: result.text || "", parseMeta: { pages: result.numpages || null } };
  }
  const text = decodeText(buffer, parseOptions.encoding || config.encoding);
  return { file, fileType: fileType || "text", columns: buildDocumentColumns(), rows: buildDocumentRows(text, limit), contentText: text, parseMeta: {} };
}

async function parseFtpFileCached(dataSource, filePath, limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 20)));
  const cacheKey = buildFtpPreviewCacheKey(dataSource, filePath, safeLimit);
  const now = Date.now();
  const cached = ftpPreviewCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }
  const promise = parseFtpFile(dataSource, filePath, safeLimit)
    .then((parsed) => {
      ftpPreviewCache.set(cacheKey, {
        expiresAt: Date.now() + FTP_PREVIEW_CACHE_TTL_MS,
        promise: Promise.resolve(parsed),
      });
      trimFtpPreviewCache();
      return parsed;
    })
    .catch((error) => {
      ftpPreviewCache.delete(cacheKey);
      throw error;
    });
  ftpPreviewCache.set(cacheKey, { expiresAt: now + FTP_PREVIEW_CACHE_TTL_MS, promise });
  return promise;
}

function buildFtpPreviewCacheKey(dataSource, filePath, limit) {
  const config = getFtpConfig(dataSource);
  const sourceId = dataSource?.id || dataSource?.sourceId || dataSource?.sourceCode || "adhoc";
  return [
    sourceId,
    config.host,
    config.port,
    config.user,
    config.rootPath,
    String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, ""),
    limit,
  ].join("|");
}

function trimFtpPreviewCache() {
  const now = Date.now();
  for (const [key, entry] of ftpPreviewCache.entries()) {
    if (entry.expiresAt <= now || ftpPreviewCache.size > 100) {
      ftpPreviewCache.delete(key);
    }
  }
}

function buildDocumentColumns() {
  return [
    { columnName: "lineNo", ordinalPosition: 1, dataType: "integer", columnType: "integer", isNullable: false, isPrimaryKey: false, columnComment: "行号" },
    { columnName: "content", ordinalPosition: 2, dataType: "text", columnType: "text", isNullable: true, isPrimaryKey: false, columnComment: "内容" },
  ];
}

function buildDocumentRows(text = "", limit = 20) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, Math.max(1, Math.min(100, Number(limit || 20))))
    .map((content, index) => ({ lineNo: index + 1, content: content.length > 500 ? `${content.slice(0, 500)}...` : content }));
}

function getKafkaConfig(dataSource) {
  const config = dataSource?.connectionConfig || {};
  const bootstrapServers = String(config.bootstrapServers || config.bootstrapServer || `${config.host || ""}${config.port ? `:${config.port}` : ""}`)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    bootstrapServers,
    clientId: String(config.clientId || "medata-ingestion-preview").trim(),
    topicPattern: String(config.topicPattern || "").trim(),
    fromBeginning: Boolean(config.fromBeginning),
  };
}

function createKafka(dataSource) {
  const config = getKafkaConfig(dataSource);
  if (!config.bootstrapServers.length) {
    throw new AppError("Kafka 数据源缺少 bootstrapServers", 400);
  }
  return new Kafka({
    clientId: config.clientId,
    brokers: config.bootstrapServers,
    logLevel: logLevel.NOTHING,
    retry: { retries: 2 },
    connectionTimeout: 8000,
    requestTimeout: 10000,
  });
}

async function withKafkaAdmin(dataSource, handler) {
  const kafka = createKafka(dataSource);
  const admin = kafka.admin();
  await admin.connect();
  try {
    return await handler(admin, kafka);
  } finally {
    await admin.disconnect();
  }
}

async function listKafkaTopics(dataSource) {
  const config = getKafkaConfig(dataSource);
  return withKafkaAdmin(dataSource, async (admin) => {
    const topics = (await admin.listTopics())
      .filter((topic) => !topic.startsWith("__"))
      .filter((topic) => !config.topicPattern || topic.includes(config.topicPattern));
    const metadata = topics.length ? await admin.fetchTopicMetadata({ topics }) : { topics: [] };
    const topicMap = new Map((metadata.topics || []).map((item) => [item.name, item]));
    return topics.sort().map((topic) => {
      const meta = topicMap.get(topic);
      const partitions = meta?.partitions || [];
      return {
        tableName: topic,
        tableType: "TOPIC",
        tableComment: `${partitions.length} partitions`,
        objectType: "topic",
        partitionCount: partitions.length,
      };
    });
  });
}

async function getKafkaTopicColumns(dataSource, topicName) {
  return withKafkaAdmin(dataSource, async (admin) => {
    const metadata = await admin.fetchTopicMetadata({ topics: [topicName] });
    const topic = (metadata.topics || []).find((item) => item.name === topicName);
    if (!topic) throw new AppError("Kafka Topic 不存在", 404);
    const rows = await sampleKafkaMessages(dataSource, topicName, 20).catch(() => []);
    const businessColumns = inferKafkaBusinessColumns(rows);
    const metadataColumns = [
      { columnName: "_kafka_topic", dataType: "string", columnType: "string", isNullable: false, isPrimaryKey: false, columnComment: "Kafka Topic" },
      { columnName: "_kafka_partition", dataType: "integer", columnType: "integer", isNullable: false, isPrimaryKey: false, columnComment: "Kafka 分区" },
      { columnName: "_kafka_offset", dataType: "string", columnType: "string", isNullable: false, isPrimaryKey: false, columnComment: "Kafka 偏移量" },
      { columnName: "_kafka_timestamp", dataType: "string", columnType: "string", isNullable: true, isPrimaryKey: false, columnComment: "Kafka 消息时间" },
      { columnName: "_kafka_key", dataType: "string", columnType: "string", isNullable: true, isPrimaryKey: false, columnComment: "Kafka 消息 Key" },
      { columnName: "_raw_value", dataType: "text", columnType: "text", isNullable: true, isPrimaryKey: false, columnComment: "原始消息内容" },
    ];
    return [...businessColumns, ...metadataColumns].map((column, index) => ({
      ...column,
      ordinalPosition: index + 1,
    }));
  });
}

function inferKafkaBusinessColumns(rows = []) {
  const fields = new Map();
  for (const row of rows) {
    const text = String(row?.value || "").trim();
    if (!text || (!text.startsWith("{") && !text.startsWith("["))) continue;
    try {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        Object.entries(flattenObject(item)).forEach(([key, value]) => {
          const current = fields.get(key) || { values: [], nullable: false };
          if (value === null || value === undefined || value === "") current.nullable = true;
          if (current.values.length < 20) current.values.push(value);
          fields.set(key, current);
        });
      }
    } catch (_error) {
      // Non-JSON messages are represented by _raw_value.
    }
  }
  return [...fields.entries()].map(([columnName, meta]) => ({
    columnName,
    dataType: inferSampleType(meta.values),
    columnType: inferSampleType(meta.values),
    isNullable: meta.nullable,
    isPrimaryKey: false,
    columnComment: "",
  }));
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

function inferSampleType(values = []) {
  const nonEmpty = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (!nonEmpty.length) return "text";
  if (nonEmpty.every((value) => typeof value === "boolean" || ["true", "false", "0", "1"].includes(String(value).toLowerCase()))) {
    return "boolean";
  }
  if (nonEmpty.every((value) => Number.isInteger(Number(value)))) {
    return "bigint";
  }
  if (nonEmpty.every((value) => Number.isFinite(Number(value)))) {
    return "decimal(18,2)";
  }
  if (nonEmpty.every((value) => !Number.isNaN(new Date(value).getTime())) && nonEmpty.some((value) => String(value).includes("-"))) {
    return "datetime";
  }
  const maxLength = Math.max(...nonEmpty.map((value) => String(value).length));
  return maxLength > 255 ? "text" : "varchar(255)";
}

async function sampleKafkaMessages(dataSource, topicName, limit = 20, options = {}) {
  const kafka = createKafka(dataSource);
  const consumer = kafka.consumer({ groupId: `medata-preview-${Date.now()}-${Math.round(Math.random() * 10000)}` });
  const rows = [];
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 20)));
  const config = getKafkaConfig(dataSource);
  const fromBeginning = options.fromBeginning !== undefined ? Boolean(options.fromBeginning) : config.fromBeginning;
  const maxWaitMs = Math.max(1000, Math.min(120000, Number(options.maxWaitMs || 6000)));
  await consumer.connect();
  try {
    await consumer.subscribe({ topic: topicName, fromBeginning });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, maxWaitMs);
      consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const rawValue = message.value ? message.value.toString("utf8") : "";
          rows.push({
            topic,
            partition,
            offset: message.offset,
            timestamp: message.timestamp ? new Date(Number(message.timestamp)).toISOString() : null,
            key: message.key ? message.key.toString("utf8") : "",
            value: formatKafkaValue(message.value),
            rawValue,
          });
          if (rows.length >= safeLimit) {
            clearTimeout(timer);
            resolve();
          }
        },
      }).catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    return rows.slice(0, safeLimit);
  } finally {
    await consumer.disconnect().catch(() => {});
  }
}

function parseKafkaPreviewMessages(messages = [], parseConfig = {}, sourceConfig = {}) {
  const format = String(parseConfig.messageFormat || "json").toLowerCase();
  return messages.flatMap((message) => {
    const rawValue = message.rawValue ?? message.value ?? "";
    const metadata = sourceConfig.includeMetadata === false ? {} : {
      _kafka_topic: message.topic,
      _kafka_partition: message.partition,
      _kafka_offset: message.offset,
      _kafka_timestamp: message.timestamp,
      _kafka_key: message.key || "",
      _raw_value: rawValue,
    };
    if (format !== "json") {
      return [{ value: rawValue, ...metadata }];
    }
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
  });
}

function resolveJsonPath(value, jsonPath = "") {
  const parts = String(jsonPath || "").replace(/^\$\./, "").split(".").map((item) => item.trim()).filter(Boolean);
  return parts.reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), value);
}

function formatKafkaValue(value) {
  if (!value) return "";
  const text = value.toString("utf8");
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch (_error) {
    return text.length > 1000 ? `${text.slice(0, 1000)}...` : text;
  }
}

async function listObjects(dataSource, options = {}) {
  if (isFtpSource(dataSource)) return listFtpFiles(dataSource, options);
  if (isKafkaSource(dataSource)) return listKafkaTopics(dataSource);
  if (isApiSource(dataSource)) {
    const config = apiIngestionService.normalizeApiConnectionConfig(dataSource?.connectionConfig || {});
    const endpointPath = config.defaultPath || "/";
    return [{
      tableName: endpointPath,
      tableType: "API",
      tableComment: `${config.baseUrl}${endpointPath}`,
      objectType: "api",
    }];
  }
  return metadataService.listTables(dataSource);
}

async function listColumns(dataSource, objectName) {
  if (isFtpSource(dataSource)) {
    const targetObjectName = await resolveFtpPreviewFile(dataSource, objectName);
    const parsed = await parseFtpFileCached(dataSource, targetObjectName, 20);
    return parsed.columns;
  }
  if (isKafkaSource(dataSource)) return getKafkaTopicColumns(dataSource, objectName);
  if (isApiSource(dataSource)) {
    const rows = await apiIngestionService.sampleApiRows(dataSource, objectName, { limit: 20 });
    return apiIngestionService.inferApiColumns(rows);
  }
  return metadataService.listColumns(dataSource, objectName);
}

async function resolveFtpPreviewFile(dataSource, objectName) {
  const normalized = String(objectName || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (detectFileType(normalized)) {
    return normalized;
  }
  const files = await listFtpFiles(dataSource, { includeDirectories: false });
  const match = files.find((item) =>
    String(item.objectType || "").toLowerCase() !== "directory" &&
    String(item.tableName || "").startsWith(normalized ? `${normalized.replace(/\/+$/, "")}/` : "")
  );
  if (!match) {
    throw new AppError("FTP 目录下没有可预览的文件", 404);
  }
  return match.tableName;
}

async function sampleRows(dataSource, objectName, limit = 20) {
  if (isFtpSource(dataSource)) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit || 20)));
    const targetObjectName = await resolveFtpPreviewFile(dataSource, objectName);
    const parsed = await parseFtpFileCached(dataSource, targetObjectName, safeLimit);
    return parsed.rows.slice(0, safeLimit);
  }
  if (isKafkaSource(dataSource)) {
    const messages = await sampleKafkaMessages(dataSource, objectName, limit);
    return parseKafkaPreviewMessages(messages);
  }
  if (isApiSource(dataSource)) return apiIngestionService.sampleApiRows(dataSource, objectName, { limit });
  return metadataService.sampleRows(dataSource, objectName, limit);
}

async function sampleRowsWithOptions(dataSource, objectName, options = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(options.limit || 20)));
  const sourceConfig = options.sourceConfig || {};
  const parseConfig = options.parseConfig || {};
  if (isKafkaSource(dataSource)) {
    const topic = sourceConfig.topic || objectName;
    const messages = await sampleKafkaMessages(dataSource, topic, safeLimit, {
      fromBeginning: String(sourceConfig.startMode || "").toLowerCase() === "earliest",
      maxWaitMs: sourceConfig.maxWaitMs,
    });
    return parseKafkaPreviewMessages(messages, parseConfig, sourceConfig).slice(0, safeLimit);
  }
  if (isFtpSource(dataSource)) {
    const filePath = await resolveFtpPreviewFileByConfig(dataSource, objectName, sourceConfig);
    const parsed = await parseFtpFile(dataSource, filePath, safeLimit, parseConfig);
    return parsed.rows.slice(0, safeLimit);
  }
  if (isApiSource(dataSource)) {
    return apiIngestionService.sampleApiRows(dataSource, objectName, {
      sourceConfig,
      parseConfig,
      errorConfig: options.errorConfig || {},
      limit: safeLimit,
    });
  }
  return metadataService.sampleRows(dataSource, objectName, safeLimit);
}

async function resolveFtpPreviewFileByConfig(dataSource, objectName, sourceConfig = {}) {
  const rootDir = String(sourceConfig.rootDir || objectName || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (String(sourceConfig.pathMode || "").toLowerCase() === "file" || detectFileType(rootDir)) {
    return rootDir;
  }
  const files = await listFtpFiles(dataSource, { includeDirectories: false });
  const normalizedDir = rootDir.replace(/\/+$/g, "");
  const matched = files.find((item) => {
    const tableName = String(item.tableName || "").replace(/\\/g, "/");
    return (!normalizedDir || tableName.startsWith(`${normalizedDir}/`))
      && matchFilePattern(tableName, sourceConfig.filePattern, sourceConfig.excludePattern);
  });
  if (!matched) {
    throw new AppError("FTP 目录下没有匹配当前来源配置的文件", 404);
  }
  return matched.tableName;
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
    }
  }
  const pattern = String(filePattern || "*").trim();
  if (!pattern || pattern === "*") return true;
  const regexText = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${regexText}$`, "i").test(fileName);
}

async function inspectObjectProfile(dataSource, objectName, options = {}) {
  if (!isFtpSource(dataSource) && !isKafkaSource(dataSource) && !isApiSource(dataSource)) {
    return metadataService.inspectTableProfile(dataSource, objectName, options);
  }
  const [columns, rows] = await Promise.all([
    listColumns(dataSource, objectName),
    sampleRows(dataSource, objectName, options.sampleSize || 50),
  ]);
  return {
    tableName: objectName,
    tableComment: isFtpSource(dataSource) ? "FTP 文件" : isKafkaSource(dataSource) ? "Kafka Topic" : "API 接口",
    columns,
    indexes: [],
    constraints: [],
    sampleRows: rows,
  };
}

module.exports = {
  listObjects,
  listColumns,
  sampleRows,
  sampleRowsWithOptions,
  inspectObjectProfile,
  isFtpSource,
  isKafkaSource,
  isApiSource,
  getKafkaConfig,
};
