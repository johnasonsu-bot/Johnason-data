const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const AppError = require("../../common/errors/app-error");
const repository = require("./file-import.repository");
const dataSourceRepository = require("../data-sources/data-source.repository");
const dataSourceMetadata = require("../data-sources/data-source.metadata");
const hiveService = require("../../services/hiveService");
const ingestionAiConfigService = require("../ingestion-ai-configs/ingestion-ai-config.service");
const modelProviderService = require("../model-providers/model-provider.service");
const { createPostgresLikeClient } = require("../../common/utils/db-client");
const { inferDatasourceDialect, normalizeDatasourceType, resolveDatasourceConnection } = require("../../common/utils/datasource-dialect");
const { buildPreviewResult, detectFileType, parseFileBuffer } = require("./file-import.parser");

const STORAGE_ROOT = path.resolve(__dirname, "../../../runtime/file-imports");
const SUPPORTED_FILE_TYPES = new Set(["csv", "txt", "xls", "xlsx", "json", "xml"]);
const SUPPORTED_TARGET_DIALECTS = new Set(["mysql", "postgresql", "hive"]);
const DEFAULT_PREVIEW_LIMIT = 50;
const FIELD_TRANSLATION_SAMPLE_LIMIT = 50;
const FIELD_TRANSLATION_SAMPLE_TEXT_LIMIT = 160;

function ensureStorageRoot() {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function resolveTargetDialect(source) {
  const normalizedType = normalizeDatasourceType(source?.sourceType);
  const dialect = inferDatasourceDialect(normalizedType, source?.connectionConfig || {});
  return dialect === "unknown" ? normalizedType : dialect;
}

function buildDefaultTaskCode(taskName = "") {
  const slug = String(taskName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return `${slug || "file_import"}_${Date.now()}`;
}

function normalizeIdentifier(value, fallback = "field", mode = "snake_case") {
  const tokenMap = [
    [/编号|编码|代码/g, "code"],
    [/名称|名字|姓名/g, "name"],
    [/时间|日期/g, "time"],
    [/电话|手机号/g, "phone"],
    [/地址/g, "address"],
    [/状态/g, "status"],
    [/类型/g, "type"],
    [/金额/g, "amount"],
    [/数量/g, "count"],
    [/价格/g, "price"],
    [/备注|说明/g, "remark"],
    [/城市/g, "city"],
    [/省/g, "province"],
    [/国家/g, "country"],
    [/年龄/g, "age"],
    [/性别/g, "gender"],
    [/身份证/g, "id_card"],
    [/创建/g, "created"],
    [/更新/g, "updated"],
  ];

  let text = String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[()（）【】\[\]{}]/g, " ")
    .replace(/[\/\\|,.，。:：;；'"`~!@#$%^&*+=?<>-]/g, " ");
  tokenMap.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, ` ${replacement} `);
  });
  text = text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!text || /[\u4e00-\u9fa5]/.test(text)) {
    text = fallback;
  }

  if (mode === "camelCase") {
    return text
      .split("_")
      .filter(Boolean)
      .map((part, index) => (index === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`))
      .join("");
  }

  if (mode === "upper_snake") {
    return text.toUpperCase();
  }

  return text;
}

function hasChineseText(value = "") {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function splitEnglishFieldName(value = "") {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const ENGLISH_FIELD_TOKEN_LABELS = {
  id: "标识",
  no: "编号",
  num: "号码",
  number: "编号",
  code: "编码",
  name: "名称",
  type: "类型",
  status: "状态",
  date: "日期",
  time: "时间",
  at: "时间",
  created: "创建",
  updated: "更新",
  create: "创建",
  update: "更新",
  remark: "备注",
  memo: "备注",
  note: "备注",
  desc: "描述",
  description: "描述",
  text: "文本",
  value: "值",
  amount: "金额",
  price: "价格",
  count: "数量",
  qty: "数量",
  quantity: "数量",
  weight: "权重",
  rate: "比例",
  ratio: "比例",
  flag: "标志",
  phone: "电话",
  mobile: "手机号",
  tel: "电话",
  email: "邮箱",
  address: "地址",
  addr: "地址",
  province: "省份",
  city: "城市",
  county: "区县",
  district: "区划",
  road: "道路",
  street: "街道",
  doorplate: "门牌",
  park: "园区",
  zone: "区域",
  functional: "功能",
  building: "建筑",
  house: "房屋",
  room: "房间",
  population: "人口",
  person: "人员",
  user: "用户",
  customer: "客户",
  certificate: "证书",
  cert: "证书",
  gender: "性别",
  marriage: "婚姻",
  registration: "登记",
  reg: "登记",
  office: "机构",
  org: "机构",
  organization: "机构",
  dept: "部门",
  department: "部门",
};

function buildFallbackColumnComment(sourceField = "") {
  const text = String(sourceField || "").trim();
  if (!text) return "";
  if (hasChineseText(text)) return text;
  const parts = splitEnglishFieldName(text);
  if (!parts.length) return text;
  const translated = parts.map((part) => ENGLISH_FIELD_TOKEN_LABELS[part] || part);
  if (translated.every((part, index) => part === parts[index])) {
    return text;
  }
  return translated.join("");
}

function buildFieldTranslationFallback(sourceField, index, technicalNameMode = "snake_case") {
  const targetField = normalizeIdentifier(sourceField, `field_${index + 1}`, technicalNameMode);
  return {
    sourceField,
    targetField,
    englishName: targetField,
    columnComment: buildFallbackColumnComment(sourceField) || sourceField || targetField,
    chineseComment: buildFallbackColumnComment(sourceField) || sourceField || targetField,
    direction: hasChineseText(sourceField) ? "zh_to_en" : "en_to_zh",
    reason: "fallback_rule",
  };
}

function normalizeDataTypeCandidate(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  const varcharMatch = text.match(/^varchar\((\d+)\)$/);
  if (varcharMatch) {
    const length = Math.max(32, Math.min(4000, Number(varcharMatch[1] || 255)));
    return `varchar(${length})`;
  }
  if (text === "string") return "string";
  if (["text", "mediumtext", "longtext"].includes(text)) return "text";
  if (text.includes("char")) return "varchar(255)";
  if (text === "int" || text === "integer") return "int";
  if (text.includes("bigint") || text === "long") return "bigint";
  if (text.includes("decimal") || text.includes("numeric") || ["double", "float", "real"].includes(text)) return "decimal(18,6)";
  if (text === "date") return "date";
  if (text.includes("datetime") || text.includes("timestamp") || text.includes("time")) return "datetime";
  if (text.includes("bool")) return "boolean";
  if (text === "jsonb") return "jsonb";
  if (text.includes("json")) return "json";
  return "";
}

function getConservativeStringType(context = {}) {
  const sampleMaxLength = (context.sampleValues || []).reduce((max, value) => {
    if (value === null || value === undefined) return max;
    return Math.max(max, String(value).trim().length);
  }, 0);
  const maxLength = Math.max(Number(context.maxLength || 0), sampleMaxLength);
  if (maxLength > 255) return "text";
  if (maxLength > 128) return "varchar(255)";
  if (maxLength > 64) return "varchar(128)";
  return "varchar(64)";
}

function getNonEmptySamples(context = {}) {
  return (context.sampleValues || [])
    .map((value) => (value === null || value === undefined ? "" : String(value).trim()))
    .filter(Boolean);
}

function shouldPreferStringField(context = {}) {
  const text = [
    context.sourceField,
    context.targetField,
    context.columnComment,
  ].filter(Boolean).join(" ");
  return /(code|id|no|number|status|flag|phone|tel|mobile|zip|postal|card|cert|编号|编码|代码|状态|标志|电话|手机|证件|身份证|邮编)/i.test(text);
}

function hasLeadingZeroNumeric(samples = []) {
  return samples.some((value) => /^-?0\d+$/.test(value) || /^-?0\d+\.\d+$/.test(value));
}

function allSamplesMatch(samples = [], predicate) {
  return samples.length > 0 && samples.every(predicate);
}

function isIntegerText(value) {
  return /^-?\d+$/.test(value);
}

function isNumberText(value) {
  return /^-?\d+(\.\d+)?$/.test(value);
}

function isDateText(value) {
  return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value) && !Number.isNaN(new Date(value.replace(/\//g, "-")).getTime());
}

function isDateTimeText(value) {
  return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}[ tT]\d{1,2}:\d{2}(:\d{2})?$/.test(value)
    && !Number.isNaN(new Date(value.replace(/\//g, "-")).getTime());
}

function isBooleanText(value) {
  return /^(true|false|1|0|yes|no|y|n|是|否)$/i.test(value);
}

function isJsonText(value) {
  if (!((value.startsWith("{") && value.endsWith("}")) || (value.startsWith("[") && value.endsWith("]")))) {
    return false;
  }
  return Boolean(safeJsonParse(value, null));
}

function normalizeSuggestedDataType(rawDataType, context = {}) {
  const candidate = normalizeDataTypeCandidate(rawDataType)
    || normalizeDataTypeCandidate(context.dataType)
    || getConservativeStringType(context);
  const samples = getNonEmptySamples(context);
  const stringType = getConservativeStringType(context);

  if (["string", "text"].includes(candidate) || candidate.startsWith("varchar(")) {
    return candidate === "string" ? stringType : candidate;
  }
  if (samples.length === 0) {
    return stringType;
  }
  if (shouldPreferStringField(context) && ["int", "bigint", "decimal(18,6)", "date", "datetime"].includes(candidate)) {
    return stringType;
  }
  if ((candidate === "int" || candidate === "bigint") && (!allSamplesMatch(samples, isIntegerText) || hasLeadingZeroNumeric(samples))) {
    return stringType;
  }
  if (candidate === "decimal(18,6)" && (!allSamplesMatch(samples, isNumberText) || hasLeadingZeroNumeric(samples))) {
    return stringType;
  }
  if (candidate === "date" && !allSamplesMatch(samples, isDateText)) {
    return stringType;
  }
  if (candidate === "datetime" && !allSamplesMatch(samples, (value) => isDateTimeText(value) || isDateText(value))) {
    return stringType;
  }
  if (candidate === "boolean" && !allSamplesMatch(samples, isBooleanText)) {
    return stringType;
  }
  if ((candidate === "json" || candidate === "jsonb") && !allSamplesMatch(samples, isJsonText)) {
    return stringType;
  }
  return candidate;
}

function normalizeParseOptions(raw = {}) {
  const previewLimit = Math.max(10, Math.min(200, Number(raw.previewLimit || DEFAULT_PREVIEW_LIMIT)));
  const delimiterMap = {
    pipe: "|",
    vertical_bar: "|",
    bar: "|",
    tab: "\t",
    comma: ",",
    semicolon: ";",
  };
  const rawDelimiter = raw.delimiter === "" || raw.delimiter === null || raw.delimiter === undefined
    ? undefined
    : String(raw.delimiter);
  return {
    headerRowNumber: Math.max(1, Number(raw.headerRowNumber || 1)),
    firstDataRowNumber: Math.max(1, Number(raw.firstDataRowNumber || 2)),
    fieldNameMode: ["header", "generated"].includes(String(raw.fieldNameMode || "").toLowerCase()) ? String(raw.fieldNameMode).toLowerCase() : "header",
    delimiter: rawDelimiter ? (delimiterMap[String(rawDelimiter).trim().toLowerCase()] || rawDelimiter) : undefined,
    quoteChar: raw.quoteChar ? String(raw.quoteChar) : "\"",
    encoding: raw.encoding ? String(raw.encoding) : "utf8",
    jsonRootPath: raw.jsonRootPath ? String(raw.jsonRootPath) : "",
    xmlRowPath: raw.xmlRowPath ? String(raw.xmlRowPath) : "",
    technicalNameMode: ["snake_case", "camelCase", "upper_snake"].includes(String(raw.technicalNameMode || "")) ? String(raw.technicalNameMode) : "snake_case",
    skipErrorRows: Boolean(raw.skipErrorRows),
    rebuildTargetTable: Boolean(raw.rebuildTargetTable),
    previewLimit,
    batchSize: Math.max(1, Math.min(1000, Number(raw.batchSize || 200))),
  };
}

function looksLikeMojibake(text = "") {
  return /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(String(text || ""));
}

function normalizeUploadedFileName(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "unnamed_file";
  }
  if (!looksLikeMojibake(text)) {
    return text;
  }
  try {
    const decoded = Buffer.from(text, "latin1").toString("utf8").trim();
    return decoded || text;
  } catch (_error) {
    return text;
  }
}

function normalizeIncomingFiles(files = []) {
  return (Array.isArray(files) ? files : []).map((file) => {
    const normalizedName = normalizeUploadedFileName(file?.originalname || file?.fileName || "");
    return {
      ...file,
      originalname: normalizedName,
      fileName: normalizedName,
    };
  });
}

function normalizeFileOptions(fileName, optionsMap = new Map()) {
  const current = optionsMap.get(normalizeUploadedFileName(fileName)) || {};
  return {
    sheetName: current.sheetName ? String(current.sheetName) : undefined,
    jsonRootPath: current.jsonRootPath ? String(current.jsonRootPath) : undefined,
    xmlRowPath: current.xmlRowPath ? String(current.xmlRowPath) : undefined,
  };
}

function buildFileOptionsMap(items = []) {
  return new Map(
    (Array.isArray(items) ? items : [])
      .filter((item) => item && item.fileName)
      .map((item) => [normalizeUploadedFileName(item.fileName), item])
  );
}

function mergePreviewSchemas(previews = [], technicalNameMode = "snake_case") {
  const fieldMap = new Map();
  previews.forEach((preview) => {
    (preview.schema || []).forEach((field, index) => {
      const existing = fieldMap.get(field.sourceField);
      const suggestedTargetField = normalizeIdentifier(
        field.sourceField,
        `field_${fieldMap.size + 1}`,
        technicalNameMode
      );
      const next = existing
        ? {
            ...existing,
            nullable: existing.nullable || field.nullable,
            maxLength: Math.max(Number(existing.maxLength || 0), Number(field.maxLength || 0)),
            sampleValues: [...new Set([...(existing.sampleValues || []), ...(field.sampleValues || [])])].slice(0, FIELD_TRANSLATION_SAMPLE_LIMIT),
            sourceFiles: [...new Set([...(existing.sourceFiles || []), preview.fileName])],
            order: Math.min(existing.order, index),
          }
        : {
            sourceField: field.sourceField,
            targetField: suggestedTargetField,
            dataType: field.suggestedType,
            inferredType: field.inferredType,
            nullable: field.nullable,
            maxLength: field.maxLength,
            sampleValues: field.sampleValues || [],
            sourceFiles: [preview.fileName],
            order: index,
          };
      fieldMap.set(field.sourceField, next);
    });
  });

  return Array.from(fieldMap.values())
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({
      sourceField: item.sourceField,
      targetField: item.targetField || `field_${index + 1}`,
      dataType: item.dataType,
      inferredType: item.inferredType,
      nullable: item.nullable,
      maxLength: item.maxLength,
      sampleValues: item.sampleValues,
      sourceFiles: item.sourceFiles,
      enabled: true,
      isPrimaryKey: false,
      columnComment: item.sourceField,
    }));
}

function normalizeFieldMappings(items = [], fallbackSchema = [], technicalNameMode = "snake_case") {
  const sourceMap = new Map(fallbackSchema.map((item) => [item.sourceField, item]));
  const usedTargets = new Set();
  const sourceItems = Array.isArray(items) && items.length > 0 ? items : fallbackSchema;
  return sourceItems.map((item, index) => {
    const sourceField = String(item.sourceField || "").trim();
    const schemaField = sourceMap.get(sourceField) || {};
    let targetField = normalizeIdentifier(
      item.targetField || schemaField.targetField || sourceField,
      `field_${index + 1}`,
      technicalNameMode
    );
    while (usedTargets.has(targetField)) {
      targetField = `${targetField}_${usedTargets.size + 1}`;
    }
    usedTargets.add(targetField);
    return {
      sourceField,
      targetField,
      dataType: String(item.dataType || schemaField.dataType || "text"),
      inferredType: item.inferredType || schemaField.inferredType || null,
      enabled: item.enabled !== false,
      mappingMode: String(item.mappingMode || "source") === "custom" ? "custom" : "source",
      customValue: item.customValue !== undefined && item.customValue !== null ? String(item.customValue) : null,
      autoMapped: Boolean(item.autoMapped),
      matchStatus: item.matchStatus || null,
      isPrimaryKey: Boolean(item.isPrimaryKey),
      nullable: item.nullable !== undefined ? Boolean(item.nullable) : Boolean(schemaField.nullable),
      maxLength: Number(item.maxLength || schemaField.maxLength || 0),
      sampleValues: Array.isArray(item.sampleValues) ? item.sampleValues : (schemaField.sampleValues || []),
      sourceFiles: Array.isArray(item.sourceFiles) ? item.sourceFiles : (schemaField.sourceFiles || []),
      columnComment: String(item.columnComment || schemaField.columnComment || sourceField || targetField),
    };
  });
}

function normalizeCreatePayload(raw, user) {
  const parseOptions = normalizeParseOptions(raw.parseOptions || {});
  return {
    taskName: String(raw.taskName || "").trim(),
    taskCode: String(raw.taskCode || "").trim() || buildDefaultTaskCode(raw.taskName),
    targetSourceId: Number(raw.targetSourceId || 0),
    targetTable: String(raw.targetTable || "").trim(),
    targetTableMode: String(raw.targetTableMode || "create") === "existing" ? "existing" : "create",
    writeMode: String(raw.writeMode || "append") === "overwrite" ? "overwrite" : "append",
    description: String(raw.description || "").trim(),
    status: String(raw.status || "draft"),
    ownerName: String(raw.ownerName || user?.displayName || user?.username || "system"),
    parseOptions,
    fileOptions: Array.isArray(raw.fileOptions) ? raw.fileOptions : [],
    fieldMappings: Array.isArray(raw.fieldMappings) ? raw.fieldMappings : [],
  };
}

function ensureFiles(files = []) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new AppError("请至少上传一个文件", 400);
  }
  files.forEach((file) => {
    const fileType = detectFileType(file.originalname || "");
    if (!SUPPORTED_FILE_TYPES.has(fileType)) {
      throw new AppError(`暂不支持的文件类型：${file.originalname}`, 400);
    }
  });
}

function buildPreviewContext(files, rawConfig = {}) {
  const normalizedFiles = normalizeIncomingFiles(files);
  ensureFiles(normalizedFiles);
  const parseOptions = normalizeParseOptions(rawConfig.parseOptions || rawConfig);
  const fileOptionsMap = buildFileOptionsMap(rawConfig.fileOptions || []);
  const previews = normalizedFiles.map((file) => {
    const fileOptions = normalizeFileOptions(file.originalname, fileOptionsMap);
    const parseResult = parseFileBuffer(file, {
      ...parseOptions,
      ...fileOptions,
      previewOnly: true,
    });
    return buildPreviewResult(file, parseResult, {
      ...parseOptions,
      ...fileOptions,
    });
  });
  const mergedSchema = mergePreviewSchemas(previews, parseOptions.technicalNameMode);
  return {
    parseOptions,
    previews,
    mergedSchema,
  };
}

function buildStoredFilePreviewContext(taskFiles = [], rawConfig = {}) {
  const pseudoFiles = (Array.isArray(taskFiles) ? taskFiles : []).map((file) => ({
    originalname: file.fileName,
    fileName: file.fileName,
    buffer: fs.readFileSync(file.filePath),
    size: file.fileSize,
  }));
  return buildPreviewContext(pseudoFiles, rawConfig);
}

async function previewFiles(files, rawConfig = {}) {
  const context = buildPreviewContext(files, rawConfig);
  return {
    files: context.previews,
    mergedSchema: context.mergedSchema,
    suggestedMappings: normalizeFieldMappings([], context.mergedSchema, context.parseOptions.technicalNameMode),
  };
}

function ensureTargetSupported(targetSource) {
  if (!targetSource) {
    throw new AppError("目标数据源不存在", 404);
  }
  const dialect = resolveTargetDialect(targetSource);
  if (!SUPPORTED_TARGET_DIALECTS.has(dialect)) {
    throw new AppError(`当前仅支持导入到 MySQL / PostgreSQL / GaussDB / Hive，当前目标类型为 ${targetSource.sourceType}`, 400);
  }
  return dialect;
}

function toTargetColumnType(dataType, targetDialect) {
  const normalized = String(dataType || "text").trim().toLowerCase();
  if (targetDialect === "hive") {
    if (normalized.includes("boolean")) return "boolean";
    if (normalized.includes("bigint")) return "bigint";
    if (normalized.includes("int")) return "int";
    if (normalized.includes("decimal") || normalized.includes("numeric")) return normalized.replace(/^numeric/, "decimal");
    if (normalized.includes("date") && !normalized.includes("time")) return "date";
    if (normalized.includes("time")) return "timestamp";
    return "string";
  }
  if (targetDialect === "postgresql") {
    if (normalized.includes("datetime")) return "timestamp";
    if (normalized.includes("tinyint")) return "smallint";
    if (normalized.includes("json")) return "jsonb";
    if (normalized === "string") return "text";
    return normalized.replace(/^numeric/, "numeric");
  }
  if (normalized === "boolean") return "tinyint(1)";
  if (normalized === "string") return "text";
  if (normalized.includes("json")) return "json";
  return normalized.replace(/^timestamp$/, "datetime");
}

function buildTargetColumns(fieldMappings, targetDialect) {
  const enabledMappings = fieldMappings.filter((item) => item.enabled !== false);
  if (enabledMappings.length === 0) {
    throw new AppError("至少需要一个启用字段", 400);
  }
  return enabledMappings.map((item) => ({
    columnName: item.targetField,
    columnType: toTargetColumnType(item.dataType, targetDialect),
    dataType: toTargetColumnType(item.dataType, targetDialect),
    isNullable: item.nullable !== false,
    isPrimaryKey: Boolean(item.isPrimaryKey),
    columnDefault: null,
    extra: "",
    columnComment: item.columnComment || item.sourceField,
  }));
}

function parseBooleanValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "是"].includes(text)) return true;
  if (["0", "false", "no", "n", "否"].includes(text)) return false;
  throw new Error("无法解析为布尔值");
}

function convertCellValue(value, dataType, targetDialect) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const normalized = String(dataType || "text").trim().toLowerCase();
  if (normalized.includes("bool")) {
    return parseBooleanValue(value);
  }
  if (normalized.includes("int")) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error("无法解析为整数");
    }
    return Math.trunc(parsed);
  }
  if (normalized.includes("decimal") || normalized.includes("numeric") || normalized === "double" || normalized === "float" || normalized === "real") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error("无法解析为数值");
    }
    return parsed;
  }
  if (normalized.includes("json")) {
    if (typeof value === "string") {
      JSON.parse(value);
      return value;
    }
    return JSON.stringify(value);
  }
  if (normalized === "date") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("无法解析为日期");
    }
    return parsed.toISOString().slice(0, 10);
  }
  if (normalized.includes("time")) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return String(value);
    }
    return parsed.toISOString().slice(0, 19).replace("T", " ");
  }
  if (targetDialect === "hive") {
    return String(value);
  }
  return String(value);
}

function buildRowsForInsert(taskFiles, parseOptions, fieldMappings) {
  const errors = [];
  const rows = [];
  const fileOptionsMap = buildFileOptionsMap(taskFiles.map((item) => ({
    fileName: item.fileName,
    ...(item.settings || {}),
  })));

  taskFiles.forEach((taskFile) => {
    const buffer = fs.readFileSync(taskFile.filePath);
    const pseudoFile = {
      originalname: taskFile.fileName,
      buffer,
      size: taskFile.fileSize,
      fileName: taskFile.fileName,
    };
    const fileOptions = normalizeFileOptions(taskFile.fileName, fileOptionsMap);
    const parseResult = parseFileBuffer(pseudoFile, {
      ...parseOptions,
      ...fileOptions,
      ...(taskFile.sheetName ? { sheetName: taskFile.sheetName } : {}),
    });
    (parseResult.rowErrors || []).forEach((error) => {
      errors.push({
        fileId: taskFile.id,
        fileName: taskFile.fileName,
        sheetName: parseResult.parseMeta?.selectedSheetName || taskFile.sheetName || null,
        rowNo: error.rowNo || null,
        columnName: null,
        errorType: error.errorType || "parse",
        errorMessage: error.errorMessage,
        rawData: { raw: error.rawData || null },
      });
    });
    parseResult.rows.forEach((row) => {
      rows.push({
        fileId: taskFile.id,
        fileName: taskFile.fileName,
        sheetName: parseResult.parseMeta?.selectedSheetName || taskFile.sheetName || null,
        rowNo: row.__rowNo || null,
        raw: row,
      });
    });
  });

  return { rows, errors };
}

function mapRowsToTargetRows(rawRows, fieldMappings, targetDialect, skipErrorRows) {
  const targetRows = [];
  const errors = [];
  const enabledMappings = fieldMappings.filter((item) => item.enabled !== false);

  rawRows.forEach((row) => {
    const next = {};
    let failedMapping = null;
    let failedRawValue = null;
    try {
      enabledMappings.forEach((mapping) => {
        const rawValue = mapping.mappingMode === "custom"
          ? mapping.customValue
          : row.raw?.[mapping.sourceField];
        failedMapping = mapping;
        failedRawValue = rawValue;
        next[mapping.targetField] = convertCellValue(rawValue, mapping.dataType, targetDialect);
      });
      targetRows.push({
        data: next,
        meta: {
          fileId: row.fileId,
          fileName: row.fileName,
          sheetName: row.sheetName,
          rowNo: row.rowNo,
          raw: row.raw,
        },
      });
    } catch (error) {
      const mapping = failedMapping || {};
      const sourceLabel = mapping.mappingMode === "custom" ? "自定义值" : (mapping.sourceField || "-");
      const targetLabel = mapping.targetField || mapping.sourceField || "-";
      const rawValueText = failedRawValue === null || failedRawValue === undefined || failedRawValue === ""
        ? "空值"
        : String(failedRawValue);
      const message = `字段转换失败：来源字段「${sourceLabel}」-> 目标字段「${targetLabel}」，目标类型「${mapping.dataType || "-"}」，原始值「${rawValueText}」，原因：${error.message || "无法完成类型转换"}`;
      const detail = {
        fileId: row.fileId,
        fileName: row.fileName,
        sheetName: row.sheetName,
        rowNo: row.rowNo,
        columnName: targetLabel,
        errorType: "convert",
        errorMessage: message,
        rawData: {
          sourceField: mapping.sourceField || null,
          targetField: mapping.targetField || null,
          dataType: mapping.dataType || null,
          rawValue: failedRawValue,
          row: row.raw,
        },
      };
      if (!skipErrorRows) {
        throw new AppError(`第 ${row.rowNo || "?"} 行字段转换失败：${detail.errorMessage}`, 400, detail);
      }
      errors.push(detail);
    }
  });

  return {
    rows: targetRows,
    errors,
  };
}

async function withSqlConnection(dataSource, handler) {
  const resolved = resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
  const dialect = resolveTargetDialect(dataSource);
  if (dialect === "mysql") {
    const connection = await mysql.createConnection({
      host: resolved.host,
      port: Number(resolved.port || 3306),
      database: resolved.database,
      user: resolved.username,
      password: resolved.password,
      connectTimeout: 10000,
    });
    try {
      return await handler(connection, dialect);
    } finally {
      await connection.end();
    }
  }

  const client = createPostgresLikeClient({
    host: resolved.host,
    port: Number(resolved.port || 5432),
    database: resolved.database,
    user: resolved.username,
    username: resolved.username,
    password: resolved.password,
    connectionTimeoutMillis: 10000,
  }, {
    sourceType: normalizeDatasourceType(dataSource.sourceType) === "gaussdb" ? "gaussdb" : "postgresql",
  });
  await client.connect();
  try {
    return await handler(client, dialect);
  } finally {
    await client.end();
  }
}

function escapeLiteralIdentifier(name, dialect) {
  return dataSourceMetadata.escapeIdentifier(name, dialect);
}

async function truncateTargetTable(dataSource, tableName, targetDialect) {
  if (targetDialect === "hive") {
    const config = hiveService.normalizeConnectionConfig(dataSource.connectionConfig || {});
    await hiveService.runHiveSql(
      [
        `USE ${dataSourceMetadata.escapeIdentifier(config.database || "default", "hive")};`,
        `TRUNCATE TABLE ${dataSourceMetadata.escapeIdentifier(tableName, "hive")};`,
      ].join("\n"),
      config
    );
    return;
  }
  await withSqlConnection(dataSource, async (connection, dialect) => {
    const sql = `TRUNCATE TABLE ${escapeLiteralIdentifier(tableName, dialect)}`;
    if (dialect === "mysql") {
      await connection.query(sql);
      return;
    }
    await connection.query(sql);
  });
}

async function dropTargetTableIfExists(dataSource, tableName, targetDialect) {
  if (targetDialect === "hive") {
    const config = hiveService.normalizeConnectionConfig(dataSource.connectionConfig || {});
    await hiveService.runHiveSql(
      [
        `USE ${dataSourceMetadata.escapeIdentifier(config.database || "default", "hive")};`,
        `DROP TABLE IF EXISTS ${dataSourceMetadata.escapeIdentifier(tableName, "hive")};`,
      ].join("\n"),
      config
    );
    return;
  }
  await withSqlConnection(dataSource, async (connection, dialect) => {
    await connection.query(`DROP TABLE IF EXISTS ${escapeLiteralIdentifier(tableName, dialect)}`);
  });
}

function inferErrorColumnName(error, columns = []) {
  const columnSet = new Set(columns.map((column) => String(column || "").toLowerCase()));
  const messages = [error?.column, error?.columnName, error?.field, error?.sqlMessage, error?.message]
    .filter(Boolean)
    .map((item) => String(item));
  const patterns = [
    /(?:column|field)\s+['"`]([^'"`]+)['"`]/i,
    /for column\s+['"`]([^'"`]+)['"`]/i,
    /column\s+"([^"]+)"/i,
  ];

  for (const message of messages) {
    const direct = columns.find((column) => String(column).toLowerCase() === message.toLowerCase());
    if (direct) {
      return direct;
    }
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match?.[1] && columnSet.has(match[1].toLowerCase())) {
        return columns.find((column) => String(column).toLowerCase() === match[1].toLowerCase()) || match[1];
      }
    }
  }

  return null;
}

async function insertRows(dataSource, tableName, fieldMappings, targetRows, targetDialect, skipErrorRows, onProgress) {
  const insertErrors = [];
  if (targetDialect === "hive") {
    const columns = fieldMappings
      .filter((item) => item.enabled !== false)
      .map((item) => ({ columnName: item.targetField, dataType: item.dataType }));
    await hiveService.loadRows(dataSource.connectionConfig || {}, tableName, columns, targetRows.map((item) => item.data), {
      writeMode: "append",
      batchSize: 200,
    });
    if (onProgress) {
      await onProgress({ processedRows: targetRows.length, successRows: targetRows.length, errorRows: 0 });
    }
    return insertErrors;
  }

  const columns = fieldMappings.filter((item) => item.enabled !== false).map((item) => item.targetField);
  await withSqlConnection(dataSource, async (connection, dialect) => {
    let processedRows = 0;
    let successRows = 0;
    const columnSql = columns.map((column) => escapeLiteralIdentifier(column, dialect)).join(", ");
    const placeholderPrefix = dialect === "postgresql" ? "$" : "?";
    const placeholders = columns
      .map((_, index) => (dialect === "postgresql" ? `${placeholderPrefix}${index + 1}` : placeholderPrefix))
      .join(", ");
    const sql = `INSERT INTO ${escapeLiteralIdentifier(tableName, dialect)} (${columnSql}) VALUES (${placeholders})`;
    for (const row of targetRows) {
      const values = columns.map((column) => row.data[column] ?? null);
      try {
        await connection.query(sql, values);
        successRows += 1;
      } catch (error) {
        const columnName = inferErrorColumnName(error, columns);
        const errorMessage = columnName
          ? `写入目标表失败：字段「${columnName}」，原因：${error.message || "写入目标表失败"}`
          : (error.message || "写入目标表失败");
        const detail = {
          fileId: row.meta.fileId,
          fileName: row.meta.fileName,
          sheetName: row.meta.sheetName,
          rowNo: row.meta.rowNo,
          columnName,
          errorType: "insert",
          errorMessage,
          rawData: {
            row: row.meta.raw,
            values: row.data,
            errorCode: error.code || null,
          },
        };
        if (!skipErrorRows) {
          throw new AppError(errorMessage, 400, detail);
        }
        insertErrors.push(detail);
      } finally {
        processedRows += 1;
        if (onProgress && (processedRows % 500 === 0 || processedRows === targetRows.length)) {
          try {
            await onProgress({ processedRows, successRows, errorRows: insertErrors.length });
          } catch (progressError) {
            progressError.insertErrors = [...insertErrors];
            throw progressError;
          }
        }
      }
    }
  });
  return insertErrors;
}

async function ensureTargetTable(dataSource, task, fieldMappings, targetDialect) {
  const targetColumns = buildTargetColumns(fieldMappings, targetDialect);
  const rebuildTargetTable = Boolean(task.parseOptions?.rebuildTargetTable);
  if (targetDialect === "hive") {
    if (rebuildTargetTable) {
      await dropTargetTableIfExists(dataSource, task.targetTable, targetDialect);
    }
    await hiveService.ensureTableExists(dataSource.connectionConfig || {}, task.targetTable, targetColumns, {
      tableComment: task.description || task.taskName,
    });
    return { action: rebuildTargetTable ? "rebuilt" : "ensured" };
  }

  if (rebuildTargetTable || task.targetTableMode === "create") {
    if (rebuildTargetTable) {
      await dropTargetTableIfExists(dataSource, task.targetTable, targetDialect);
    }
    const result = await dataSourceMetadata.ensureTableMatchesColumns(dataSource, task.targetTable, targetColumns, {
      tableComment: task.description || task.taskName,
    });
    return rebuildTargetTable ? { ...result, action: "rebuilt" } : result;
  }

  const tables = await dataSourceMetadata.listTables(dataSource);
  const exists = tables.some((item) => item.tableName === task.targetTable);
  if (!exists) {
    throw new AppError(`目标表 ${task.targetTable} 不存在`, 400);
  }
  const existingColumns = await dataSourceMetadata.listColumns(dataSource, task.targetTable);
  const targetColumnSet = new Set(existingColumns.map((item) => String(item.columnName || "").trim().toLowerCase()));
  const missingMappings = fieldMappings
    .filter((item) => item.enabled !== false)
    .filter((item) => !targetColumnSet.has(String(item.targetField || "").trim().toLowerCase()));
  if (missingMappings.length > 0) {
    throw new AppError(
      `已有表映射中存在未匹配目标字段：${missingMappings.map((item) => item.targetField || item.sourceField).join("、")}`,
      400
    );
  }
  return { action: "existing" };
}

async function saveUploadedFiles(taskCode, files, rawFileOptions = []) {
  ensureStorageRoot();
  const taskDir = path.join(STORAGE_ROOT, taskCode);
  fs.mkdirSync(taskDir, { recursive: true });
  const fileOptionsMap = buildFileOptionsMap(rawFileOptions);

  try {
    return files.map((file, index) => {
      const fileExt = detectFileType(file.originalname);
      const storedFileName = `${String(index + 1).padStart(2, "0")}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${fileExt}`;
      const filePath = path.join(taskDir, storedFileName);
      fs.writeFileSync(filePath, file.buffer);
      return {
        fileName: file.originalname,
        storedFileName,
        fileExt,
        filePath,
        fileSize: Number(file.size || file.buffer?.length || 0),
        fileHash: crypto.createHash("sha256").update(file.buffer).digest("hex"),
        fileOrder: index,
        sheetName: fileOptionsMap.get(file.originalname)?.sheetName || null,
        settings: fileOptionsMap.get(file.originalname) || {},
      };
    });
  } catch (error) {
    fs.rmSync(taskDir, { recursive: true, force: true });
    throw error;
  }
}

async function createTask(files, rawConfig, user, projectId) {
  const payload = normalizeCreatePayload(rawConfig, user);
  if (!payload.taskName) {
    throw new AppError("任务名称不能为空", 400);
  }
  if (!payload.targetSourceId) {
    throw new AppError("请选择目标数据源", 400);
  }
  if (!payload.targetTable) {
    throw new AppError("目标表名不能为空", 400);
  }
  const normalizedFiles = normalizeIncomingFiles(files);
  const preview = await previewFiles(normalizedFiles, payload);
  const targetSource = await dataSourceRepository.getDataSourceById(payload.targetSourceId);
  ensureTargetSupported(targetSource);
  const taskFiles = await saveUploadedFiles(payload.taskCode, normalizedFiles, payload.fileOptions);
  const fieldMappings = normalizeFieldMappings(payload.fieldMappings, preview.mergedSchema, payload.parseOptions.technicalNameMode);

  try {
    const taskId = await repository.createTask({
      ...payload,
      projectId: Number(projectId || user?.defaultProjectId || 0) || null,
      parseOptions: payload.parseOptions,
      previewSchema: {
        files: preview.files,
        mergedSchema: preview.mergedSchema,
      },
      fieldMappings,
      files: taskFiles,
    });
    return getTaskDetail(taskId);
  } catch (error) {
    fs.rmSync(path.join(STORAGE_ROOT, payload.taskCode), { recursive: true, force: true });
    throw error;
  }
}

async function updateTask(id, rawConfig, user) {
  const current = await getTaskDetail(id);
  const payload = normalizeCreatePayload({
    ...rawConfig,
    taskCode: current.taskCode,
    status: rawConfig.status || current.status || "draft",
  }, user);
  if (!payload.taskName) {
    throw new AppError("任务名称不能为空", 400);
  }
  if (!payload.targetSourceId) {
    throw new AppError("请选择目标数据源", 400);
  }
  if (!payload.targetTable) {
    throw new AppError("目标表名不能为空", 400);
  }
  const targetSource = await dataSourceRepository.getDataSourceById(payload.targetSourceId);
  ensureTargetSupported(targetSource);
  const preview = buildStoredFilePreviewContext(current.files || [], payload);
  const fieldMappings = normalizeFieldMappings(payload.fieldMappings, preview.mergedSchema, payload.parseOptions.technicalNameMode);
  const updated = await repository.updateTask(current.id, {
    ...payload,
    status: current.status || payload.status,
    previewSchema: {
      files: preview.previews,
      mergedSchema: preview.mergedSchema,
    },
    fieldMappings,
  });
  if (!updated) {
    throw new AppError("文件上传任务不存在", 404);
  }
  return getTaskDetail(current.id);
}

async function getTaskDetail(id) {
  const task = await repository.getTaskById(Number(id));
  if (!task) {
    throw new AppError("文件上传任务不存在", 404);
  }
  const files = await repository.listTaskFiles(task.id);
  return {
    ...task,
    files,
  };
}

async function listTasks(filters = {}) {
  return repository.listTasks(filters);
}

async function deleteTask(id) {
  const task = await getTaskDetail(id);
  const deleted = await repository.deleteTask(task.id);
  if (!deleted) {
    throw new AppError("文件上传任务不存在", 404);
  }
  const taskDir = path.join(STORAGE_ROOT, task.taskCode);
  fs.rmSync(taskDir, { recursive: true, force: true });
}

async function runTaskNow(id) {
  const task = await getTaskDetail(id);
  const targetSource = await dataSourceRepository.getDataSourceById(task.targetSourceId);
  const targetDialect = ensureTargetSupported(targetSource);
  const fieldMappings = normalizeFieldMappings(task.fieldMappings || [], task.previewSchema?.mergedSchema || [], task.parseOptions?.technicalNameMode || "snake_case");
  const runId = await repository.createRun(task.id);
  const runStartedAt = Date.now();

  try {
    const { rows: rawRows, errors: parseErrors } = buildRowsForInsert(task.files || [], task.parseOptions || {}, fieldMappings);
    if (parseErrors.length > 0 && !task.parseOptions?.skipErrorRows) {
      throw new AppError("存在解析错误行，且当前配置为遇错终止", 400, parseErrors[0]);
    }
    const converted = mapRowsToTargetRows(rawRows, fieldMappings, targetDialect, Boolean(task.parseOptions?.skipErrorRows));
    let allErrors = [...parseErrors, ...converted.errors];
    const initialErrorCount = allErrors.length;
    let lastProgressUpdateAt = 0;

    await repository.updateRun(runId, {
      totalRows: rawRows.length,
      successRows: 0,
      skippedRows: initialErrorCount,
      errorRows: initialErrorCount,
      executionInfo: {
        phase: "preparing_target",
        processedRows: initialErrorCount,
        progressPercent: rawRows.length > 0 ? Number(((initialErrorCount / rawRows.length) * 100).toFixed(2)) : 100,
        rowsPerSecond: 0,
        elapsedSeconds: Number(((Date.now() - runStartedAt) / 1000).toFixed(1)),
        targetDialect,
        fileCount: (task.files || []).length,
        targetTable: task.targetTable,
      },
    });

    await ensureTargetTable(targetSource, task, fieldMappings, targetDialect);
    if (task.writeMode === "overwrite") {
      await truncateTargetTable(targetSource, task.targetTable, targetDialect);
    }
    let latestProgress = { processedRows: initialErrorCount, successRows: 0, errorRows: initialErrorCount };
    let insertErrors = [];
    try {
      insertErrors = await insertRows(
        targetSource,
        task.targetTable,
        fieldMappings,
        converted.rows,
        targetDialect,
        Boolean(task.parseOptions?.skipErrorRows),
        async (progress) => {
          const now = Date.now();
          latestProgress = {
            processedRows: Math.min(rawRows.length, initialErrorCount + progress.processedRows),
            successRows: progress.successRows,
            errorRows: initialErrorCount + progress.errorRows,
          };
          const currentRun = await repository.getRunById(runId);
          if (currentRun?.runStatus === "cancelling") {
            const cancellationError = new Error("用户手动终止");
            cancellationError.code = "FILE_IMPORT_CANCELLED";
            throw cancellationError;
          }
          const isFinalProgress = progress.processedRows >= converted.rows.length;
          if (!isFinalProgress && now - lastProgressUpdateAt < 1000) {
            return;
          }
          lastProgressUpdateAt = now;
          const elapsedSeconds = Math.max((now - runStartedAt) / 1000, 0.001);
          await repository.updateRun(runId, {
            totalRows: rawRows.length,
            successRows: latestProgress.successRows,
            skippedRows: latestProgress.errorRows,
            errorRows: latestProgress.errorRows,
            executionInfo: {
              phase: "writing",
              processedRows: latestProgress.processedRows,
              progressPercent: rawRows.length > 0 ? Number(((latestProgress.processedRows / rawRows.length) * 100).toFixed(2)) : 100,
              rowsPerSecond: Number((latestProgress.processedRows / elapsedSeconds).toFixed(2)),
              elapsedSeconds: Number(elapsedSeconds.toFixed(1)),
              targetDialect,
              fileCount: (task.files || []).length,
              targetTable: task.targetTable,
            },
          });
        }
      );
    } catch (error) {
      if (error.code !== "FILE_IMPORT_CANCELLED") {
        throw error;
      }
      const interruptedInsertErrors = Array.isArray(error.insertErrors) ? error.insertErrors : [];
      allErrors = [...allErrors, ...interruptedInsertErrors];
      const elapsedSeconds = Math.max((Date.now() - runStartedAt) / 1000, 0.001);
      await repository.addRunErrors(runId, allErrors);
      await repository.updateRun(runId, {
        runStatus: "cancelled",
        endTime: new Date(),
        totalRows: rawRows.length,
        successRows: latestProgress.successRows,
        skippedRows: latestProgress.errorRows,
        errorRows: latestProgress.errorRows,
        errorMessage: "用户手动终止",
        executionInfo: {
          phase: "cancelled",
          processedRows: latestProgress.processedRows,
          progressPercent: rawRows.length > 0 ? Number(((latestProgress.processedRows / rawRows.length) * 100).toFixed(2)) : 100,
          rowsPerSecond: Number((latestProgress.processedRows / elapsedSeconds).toFixed(2)),
          elapsedSeconds: Number(elapsedSeconds.toFixed(1)),
          targetDialect,
          fileCount: (task.files || []).length,
          targetTable: task.targetTable,
        },
      });
      return { taskId: task.id, runId, cancelled: true };
    }
    allErrors = [...allErrors, ...insertErrors];
    const elapsedSeconds = Math.max((Date.now() - runStartedAt) / 1000, 0.001);

    await repository.addRunErrors(runId, allErrors);
    await repository.updateRun(runId, {
      runStatus: allErrors.length > 0 ? "completed" : "completed",
      endTime: new Date(),
      totalRows: rawRows.length,
      successRows: converted.rows.length - insertErrors.length,
      skippedRows: allErrors.length,
      errorRows: allErrors.length,
      executionInfo: {
        phase: "completed",
        processedRows: rawRows.length,
        progressPercent: 100,
        rowsPerSecond: Number((rawRows.length / elapsedSeconds).toFixed(2)),
        elapsedSeconds: Number(elapsedSeconds.toFixed(1)),
        targetDialect,
        fileCount: (task.files || []).length,
        targetTable: task.targetTable,
        rebuildTargetTable: Boolean(task.parseOptions?.rebuildTargetTable),
      },
    });

    return {
      taskId: task.id,
      runId,
    };
  } catch (error) {
    const elapsedSeconds = Math.max((Date.now() - runStartedAt) / 1000, 0.001);
    await repository.updateRun(runId, {
      runStatus: "failed",
      endTime: new Date(),
      errorMessage: error.message || "文件导入失败",
      executionInfo: {
        phase: "failed",
        rowsPerSecond: 0,
        elapsedSeconds: Number(elapsedSeconds.toFixed(1)),
        taskId: task.id,
        targetTable: task.targetTable,
      },
    });
    throw error;
  }
}

async function cancelRun(taskId, runId) {
  const task = await getTaskDetail(taskId);
  const run = await repository.getRunById(runId);
  if (!run || Number(run.taskId) !== Number(task.id)) {
    throw new AppError("运行记录不存在", 404);
  }
  if (run.runStatus === "cancelled") {
    return { taskId: task.id, runId: run.id, runStatus: "cancelled" };
  }
  if (run.runStatus !== "running" && run.runStatus !== "cancelling") {
    throw new AppError("只有运行中的任务可以终止", 400);
  }
  await repository.updateRun(run.id, {
    runStatus: "cancelling",
    errorMessage: "用户请求终止",
  });
  return { taskId: task.id, runId: run.id, runStatus: "cancelling" };
}

async function listRuns(taskId, limit = 20) {
  await getTaskDetail(taskId);
  return repository.listRuns(Number(taskId), limit);
}

async function listRunErrors(taskId, runId, options = {}) {
  await getTaskDetail(taskId);
  const run = await repository.getRunById(Number(runId));
  if (!run || Number(run.taskId) !== Number(taskId)) {
    throw new AppError("运行记录不存在", 404);
  }
  return repository.listRunErrors(Number(runId), options);
}

async function resolveSuggestionProvider(modelProviderId) {
  if (modelProviderId) {
    return modelProviderService.getModelProviderById(Number(modelProviderId));
  }
  const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("file_upload_naming").catch(() => null);
  if (aiConfig?.defaultModelProviderId) {
    const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
    return modelProviderService.applyModelSelection(provider, {
      modelName: aiConfig.defaultModelName || provider.modelName,
      modelVersion: aiConfig.defaultModelVersion || provider.modelVersion || provider.modelName,
    });
  }
  const providers = await modelProviderService.getActiveChatModelProviders();
  return providers[0] || null;
}

function buildFallbackSuggestions(fields = [], technicalNameMode = "snake_case", fieldContexts = []) {
  const used = new Set();
  return fields.map((field, index) => {
    const fallback = buildFieldTranslationFallback(field, index, technicalNameMode);
    const context = fieldContexts[index] || { sourceField: field };
    let targetField = fallback.targetField;
    while (used.has(targetField)) {
      targetField = `${targetField}_${used.size + 1}`;
    }
    used.add(targetField);
    return {
      ...fallback,
      targetField,
      englishName: targetField,
      dataType: normalizeSuggestedDataType(context.dataType, { ...context, targetField }),
    };
  });
}

function normalizePromptSampleValue(value) {
  if (value === null || value === undefined) {
    return value;
  }
  let text;
  if (typeof value === "string") {
    text = value;
  } else {
    try {
      text = JSON.stringify(value);
    } catch (_error) {
      text = String(value);
    }
  }
  const normalized = String(text || "").trim();
  return normalized.length > FIELD_TRANSLATION_SAMPLE_TEXT_LIMIT
    ? `${normalized.slice(0, FIELD_TRANSLATION_SAMPLE_TEXT_LIMIT)}...`
    : normalized;
}

function normalizeSuggestionFieldContexts(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (typeof item === "string") {
        return {
          sourceField: item.trim(),
          targetField: "",
          columnComment: "",
          dataType: "",
          inferredType: "",
          maxLength: 0,
          currentDataType: "",
          sampleValues: [],
        };
      }
      const sourceField = String(item?.sourceField || item?.fieldName || item?.name || "").trim();
      const sampleValues = Array.isArray(item?.sampleValues)
        ? item.sampleValues
          .slice(0, FIELD_TRANSLATION_SAMPLE_LIMIT)
          .map(normalizePromptSampleValue)
          .filter((value) => value !== "")
        : [];
      return {
        sourceField,
        targetField: String(item?.targetField || "").trim(),
        columnComment: String(item?.columnComment || item?.comment || "").trim(),
        dataType: String(item?.dataType || item?.targetType || item?.suggestedType || "").trim(),
        currentDataType: String(item?.dataType || item?.targetType || item?.suggestedType || "").trim(),
        inferredType: String(item?.inferredType || "").trim(),
        maxLength: Number(item?.maxLength || 0),
        nullable: item?.nullable === undefined ? undefined : Boolean(item.nullable),
        sampleValues,
      };
    })
    .filter((item) => item.sourceField);
}

function parseModelJsonObject(content) {
  const parsed = safeJsonParse(content, null);
  if (parsed) return parsed;
  const text = String(content || "").trim();
  const match = text.match(/\{[\s\S]*\}/);
  return match ? safeJsonParse(match[0], null) : null;
}

function normalizeModelSuggestions(fieldContexts, suggestions, fallback, technicalNameMode) {
  const used = new Set();
  return fieldContexts.map((context, index) => {
    const field = context.sourceField;
    const matched = (suggestions || []).find((item) => String(item?.sourceField || "").trim() === field) || {};
    const baseFallback = fallback[index] || buildFieldTranslationFallback(field, index, technicalNameMode);
    const direction = hasChineseText(field) ? "zh_to_en" : "en_to_zh";
    const rawTargetField = matched.targetField || matched.englishName || matched.technicalName || baseFallback.targetField || field;
    let targetField = normalizeIdentifier(rawTargetField, `field_${index + 1}`, technicalNameMode);
    while (used.has(targetField)) {
      targetField = `${targetField}_${used.size + 1}`;
    }
    used.add(targetField);
    const rawComment = matched.columnComment || matched.chineseComment || matched.fieldComment || matched.comment;
    const columnComment = String(rawComment || baseFallback.columnComment || field || targetField).trim();
    const dataType = normalizeSuggestedDataType(matched.dataType || matched.targetType || matched.columnType, {
      ...context,
      targetField,
      columnComment,
    });
    return {
      sourceField: field,
      targetField,
      englishName: targetField,
      dataType,
      columnComment,
      chineseComment: columnComment,
      direction,
      reason: String(matched.reason || "model_generated"),
    };
  });
}

async function suggestTechnicalNames(payload = {}) {
  const fieldContexts = normalizeSuggestionFieldContexts(payload.fields);
  const fields = fieldContexts.map((item) => item.sourceField);
  if (fields.length === 0) {
    throw new AppError("字段名称不能为空", 400);
  }
  const technicalNameMode = ["snake_case", "camelCase", "upper_snake"].includes(String(payload.technicalNameMode || "")) ? String(payload.technicalNameMode) : "snake_case";
  const fallback = buildFallbackSuggestions(fields, technicalNameMode, fieldContexts);
  const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("file_upload_naming").catch(() => null);
  const provider = await resolveSuggestionProvider(payload.modelProviderId).catch(() => null);
  const modelConfigured = Boolean(payload.modelProviderId || aiConfig?.defaultModelProviderId);
  const systemPrompt = String(
    aiConfig?.systemPrompt
    || "你是文件上传入库场景中的字段命名助手。请把中文字段名转换成英文技术名，只返回 JSON。"
  ).trim();
  const translationPrompt = [
    systemPrompt,
    "",
    "本次任务必须支持字段名双向翻译：",
    "1. sourceField 是中文业务名时，targetField 输出英文数据库技术名，columnComment 保留或精炼中文字段注释。",
    "2. sourceField 是英文技术名时，targetField 输出规范化后的英文技术名，columnComment 输出中文字段注释。",
    "3. targetField 必须是可落库字段名，不包含中文、空格、短横线或特殊字符。",
    "4. 必须结合每个字段的 sampleValues 理解字段业务含义，sampleValues 是最多 50 条真实样例数据。",
    "5. 必须同时判断 dataType，结合 currentDataType、inferredType、字段名、字段注释和 sampleValues 选择目标类型。",
    "6. dataType 可选：varchar(64)、varchar(128)、varchar(255)、text、bigint、int、decimal(18,6)、date、datetime、boolean、json、jsonb。",
    "7. 类型判断必须保守：编码、编号、ID、状态、标识、电话、证件号、邮编等即使样例看起来是数字，也优先用 varchar；日期时间只有所有非空样例都清晰符合日期/时间格式才用 date/datetime；数值只有所有非空样例都能稳定解析且不是编码类字段才用数值类型；不好识别一律用 varchar 或 text。",
    "8. 必须严格返回 JSON 对象：{\"suggestions\":[{\"sourceField\":\"...\",\"targetField\":\"...\",\"columnComment\":\"...\",\"dataType\":\"varchar(64)\",\"reason\":\"...\"}]}。",
  ].join("\n");

  if (!provider) {
    return {
      mode: "fallback",
      modelConfigured,
      fallbackReason: modelConfigured ? "model_error" : "not_configured",
      suggestions: fallback,
    };
  }

  try {
    const response = await modelProviderService.generateChatCompletion(
      provider,
      [
        {
          role: "system",
          content: translationPrompt
        },
        {
          role: "user",
          content: JSON.stringify({
            technicalNameMode,
            fields,
            fieldContexts,
            instruction: "请逐个字段结合 sourceField、targetField、columnComment、currentDataType、inferredType 和 sampleValues 推断业务含义，再给出 targetField、columnComment 与 dataType。数值和日期时间必须保守判断，不确定时返回字符串类型。",
            dataTypePolicy: {
              stringFirst: "无法明确判断、存在混合值、存在编码/ID/状态/电话/证件号/邮编语义时，使用 varchar 或 text。",
              numeric: "只有所有非空样例都是可计算数值，且字段不是编码/ID/状态类，才使用 int、bigint 或 decimal(18,6)。",
              dateTime: "只有所有非空样例都是明确日期或日期时间格式，才使用 date 或 datetime；YYYYMMDD、数字日期、混合文本优先字符串。",
            },
            output: {
              suggestions: [
                {
                  sourceField: "中文字段名",
                  targetField: "snake_case_name",
                  columnComment: "中文字段注释",
                  dataType: "varchar(64)",
                  reason: "简短说明"
                },
                {
                  sourceField: "english_field_name",
                  targetField: "english_field_name",
                  columnComment: "中文字段注释",
                  dataType: "decimal(18,6)",
                  reason: "简短说明"
                }
              ]
            }
          })
        }
      ],
      {
        temperature: aiConfig?.temperature ?? 0.1,
        maxTokens: aiConfig?.maxTokens ?? 1600,
        timeoutMs: aiConfig?.timeoutMs ?? undefined,
        responseFormat: { type: "json_object" },
      }
    );
    const parsed = parseModelJsonObject(response.content);
    const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : (Array.isArray(parsed) ? parsed : null);
    if (!suggestions) {
      throw new Error("模型未返回有效建议");
    }

    return {
      mode: "model",
      modelConfigured: true,
      modelProviderId: provider.id,
      modelProviderName: provider.configName,
      suggestions: normalizeModelSuggestions(fieldContexts, suggestions, fallback, technicalNameMode),
    };
  } catch (error) {
    return {
      mode: "fallback",
      modelConfigured: true,
      fallbackReason: "model_error",
      errorMessage: error.message || "模型调用失败",
      modelProviderId: provider.id,
      modelProviderName: provider.configName,
      suggestions: fallback,
    };
  }
}

module.exports = {
  cancelRun,
  createTask,
  deleteTask,
  getTaskDetail,
  listRunErrors,
  listRuns,
  listTasks,
  previewFiles,
  runTaskNow,
  suggestTechnicalNames,
  updateTask,
};
