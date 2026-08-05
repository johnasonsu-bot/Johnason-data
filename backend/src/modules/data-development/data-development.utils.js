const crypto = require("crypto");
const env = require("../../config/env");
const {
  inferDatasourceDialect: inferSharedDatasourceDialect,
  normalizeDatasourceType: normalizeSharedDatasourceType,
  resolveDatasourceConnection,
} = require("../../common/utils/datasource-dialect");

const PENDING_PROCESSING_SOURCE_TABLE_PREFIX = "__pending_source_table__";

function parseJson(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function normalizeDatasourceStorageType(type) {
  return normalizeSharedDatasourceType(type || "mysql") || "mysql";
}

function normalizeDatasourceType(type) {
  const normalized = normalizeDatasourceStorageType(type);
  if (normalized === "gaussdb") {
    return "postgresql";
  }
  return normalized;
}

function isPendingProcessingSourceTable(tableName) {
  return String(tableName || "").startsWith(PENDING_PROCESSING_SOURCE_TABLE_PREFIX);
}

function parseDatasourceHostAliases() {
  return String(process.env.DATA_DEV_HOST_ALIASES || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((result, item) => {
      const [from, to] = item.split("=").map((part) => part.trim());
      if (!from || !to) {
        return result;
      }
      result[from.toLowerCase()] = to;
      return result;
    }, {});
}

function resolveDatasourceHost(host) {
  const normalizedHost = String(host || "").trim();
  if (!normalizedHost) {
    return normalizedHost;
  }

  const aliases = parseDatasourceHostAliases();
  return aliases[normalizedHost.toLowerCase()] || normalizedHost;
}

function buildDatasourceConnectionPayload(input = {}) {
  const extraConfig = parseJson(input.extraConfig, {});
  return {
    host: input.host,
    port: input.port,
    database: input.database || input.databaseName,
    databaseName: input.databaseName || input.database,
    username: input.username,
    password: input.password,
    ...extraConfig,
  };
}

function inferDatasourceDialect(input, extraConfig = {}) {
  if (input && typeof input === "object") {
    const sourceType = input.storageType || input.type || input.sourceType;
    const payload = buildDatasourceConnectionPayload(input);
    const dialect = inferSharedDatasourceDialect(sourceType, payload);
    return dialect === "unknown" ? normalizeDatasourceType(sourceType) : dialect;
  }

  const sourceType = input;
  const dialect = inferSharedDatasourceDialect(sourceType, extraConfig || {});
  return dialect === "unknown" ? normalizeDatasourceType(sourceType) : dialect;
}

function resolveRuntimeDatasourceConfig(input = {}) {
  const storageType = normalizeDatasourceStorageType(input.storageType || input.type || input.sourceType);
  const payload = buildDatasourceConnectionPayload(input);
  const resolved = resolveDatasourceConnection(storageType, payload);
  const dialect = resolved.dialect === "unknown" ? normalizeDatasourceType(storageType) : resolved.dialect;

  return {
    storageType,
    dialect,
    host: resolveDatasourceHost(resolved.host || input.host),
    port: Number(resolved.port || input.port || 0) || 0,
    databaseName: resolved.database || input.databaseName || null,
    username: resolved.username || input.username || null,
    password: resolved.password || input.password || "",
    schema: resolved.schema || payload.schema || null,
    jdbcUrl: resolved.jdbcUrl || payload.jdbcUrl || "",
    driverClassName: payload.driverClassName || resolved.driverClassName || null,
    protocol: payload.protocol || resolved.protocol || null,
    connectionMode: payload.connectionMode || resolved.connectionMode || null,
    extraConfig: {
      ...parseJson(input.extraConfig, {}),
      ...(resolved.jdbcUrl ? { jdbcUrl: resolved.jdbcUrl } : {}),
      ...(resolved.schema ? { schema: resolved.schema } : {}),
      ...(payload.driverClassName || resolved.driverClassName
        ? { driverClassName: payload.driverClassName || resolved.driverClassName }
        : {}),
      ...(payload.protocol || resolved.protocol ? { protocol: payload.protocol || resolved.protocol } : {}),
      ...(payload.connectionMode || resolved.connectionMode
        ? { connectionMode: payload.connectionMode || resolved.connectionMode }
        : {}),
    },
  };
}

function buildDatasourceEnvironmentSignature(datasource) {
  if (!datasource) {
    return "";
  }

  const resolved = resolveRuntimeDatasourceConfig(datasource);
  return [
    resolved.dialect,
    resolveDatasourceHost(resolved.host).toLowerCase(),
    Number(resolved.port || 0),
  ].join("::");
}

function buildCipherKey() {
  return crypto.createHash("sha256").update(String(env.licenseStorageKey || env.jwtSecret || "medata")).digest();
}

function encryptSecret(plainText) {
  if (!plainText) {
    return null;
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", buildCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]).toString("base64");
  return `${iv.toString("base64")}:${encrypted}`;
}

function decryptSecret(cipherText) {
  if (!cipherText) {
    return "";
  }

  const [ivBase64, payload] = String(cipherText).split(":");
  if (!ivBase64 || !payload) {
    return String(cipherText);
  }

  try {
    const decipher = crypto.createDecipheriv("aes-256-cbc", buildCipherKey(), Buffer.from(ivBase64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(payload, "base64")), decipher.final()]).toString("utf8");
  } catch (error) {
    return String(cipherText);
  }
}

function isQuerySql(sql) {
  const normalized = stripLeadingSqlComments(sql).toLowerCase();
  return /^(select|show|describe|desc|with|explain)\b/.test(normalized);
}

function hasLimitClause(sql) {
  return /\blimit\s+\d+|\bfetch\s+first\s+\d+\s+rows\s+only|\brownum\b/i.test(String(sql || ""));
}

function applyResultLimit(sql, resultLimit, dialect = "mysql") {
  const limit = Number(resultLimit || 0);
  if (!limit || !isQuerySql(sql) || hasLimitClause(sql)) {
    return String(sql || "");
  }

  const trimmed = String(sql || "").trim().replace(/;+\s*$/, "");
  const normalizedDialect = normalizeDatasourceType(dialect);
  if (normalizedDialect === "oracle") {
    return `SELECT * FROM (${trimmed}) WHERE ROWNUM <= ${limit}`;
  }
  if (normalizedDialect === "dm") {
    return `${trimmed}\nFETCH FIRST ${limit} ROWS ONLY`;
  }
  if (normalizedDialect === "hive") {
    return `${trimmed}\nLIMIT ${limit}`;
  }
  return `${trimmed} LIMIT ${limit}`;
}

function stripLeadingSqlComments(sql) {
  let text = String(sql || "").trimStart();

  while (text) {
    if (text.startsWith("--")) {
      const newlineIndex = text.indexOf("\n");
      text = newlineIndex === -1 ? "" : text.slice(newlineIndex + 1).trimStart();
      continue;
    }

    if (text.startsWith("/*")) {
      const blockEndIndex = text.indexOf("*/");
      text = blockEndIndex === -1 ? "" : text.slice(blockEndIndex + 2).trimStart();
      continue;
    }

    break;
  }

  return text.trim();
}

function previewRows(rows, maxRows = 20) {
  return Array.isArray(rows) ? rows.slice(0, maxRows) : [];
}

function sanitizeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function buildResultPreview(result) {
  if (!result) {
    return null;
  }

  return {
    fields: Array.isArray(result.fields) ? result.fields.slice(0, 64) : [],
    rows: previewRows(result.rows, 20),
    rowCount: sanitizeNumber(result.rowCount, Array.isArray(result.rows) ? result.rows.length : 0),
    affectedRows: sanitizeNumber(result.affectedRows, 0),
  };
}

function formatDateTime(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  const second = String(value.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function parseTableName(tableName, defaultScope) {
  const parts = String(tableName || "").split(".").filter(Boolean);
  if (parts.length >= 2) {
    return {
      scope: parts[parts.length - 2].replace(/["`]/g, ""),
      table: parts[parts.length - 1].replace(/["`]/g, ""),
    };
  }

  return {
    scope: defaultScope,
    table: String(tableName || "").replace(/["`]/g, ""),
  };
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

function cleanHiveOutput(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("SLF4J:"))
    .filter((line) => !line.startsWith("Connecting to "))
    .filter((line) => !line.startsWith("Connected to:"))
    .filter((line) => !line.startsWith("Driver:"))
    .filter((line) => !line.startsWith("Transaction isolation:"))
    .filter((line) => !line.startsWith("Beeline version"))
    .filter((line) => !line.startsWith("0: jdbc:hive2://"))
    .filter((line) => !line.startsWith("+"))
    .filter((line) => !line.startsWith("|"));
}

function quoteIdentifier(identifier, type = "mysql") {
  const normalized = normalizeDatasourceType(type);
  const quote = ["postgresql", "oracle", "dm"].includes(normalized) ? '"' : "`";
  return String(identifier || "")
    .split(".")
    .filter(Boolean)
    .map((part) => `${quote}${String(part).replace(new RegExp(quote, "g"), quote.repeat(2))}${quote}`)
    .join(".");
}

module.exports = {
  applyResultLimit,
  buildDatasourceEnvironmentSignature,
  buildResultPreview,
  cleanHiveOutput,
  decryptSecret,
  encryptSecret,
  formatDateTime,
  inferDatasourceDialect,
  isPendingProcessingSourceTable,
  isQuerySql,
  normalizeDatasourceStorageType,
  normalizeDatasourceType,
  parseCsvLine,
  resolveDatasourceHost,
  resolveRuntimeDatasourceConfig,
  parseJson,
  parseTableName,
  previewRows,
  quoteIdentifier,
  sanitizeNumber,
  stripLeadingSqlComments,
};
