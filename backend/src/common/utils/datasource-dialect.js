const POSTGRESQL = "postgresql";
const UNKNOWN = "unknown";
const {
  getDatabaseCapability,
  normalizeRegisteredDatabaseType,
} = require("./datasource-capabilities");

const DIALECT_VENDOR_MAP = {
  mysql: "mysql",
  mariadb: "mysql",
  postgresql: POSTGRESQL,
  postgres: POSTGRESQL,
  gaussdb: POSTGRESQL,
  opengauss: POSTGRESQL,
  clickhouse: "clickhouse",
  hive: "hive",
  hive2: "hive",
  oracle: "oracle",
  dm: "dm",
  dameng: "dm",
  dmdb: "dm",
  sqlserver: "sqlserver",
};

function normalizeDatasourceType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  const registeredType = normalizeRegisteredDatabaseType(normalized);
  if (registeredType !== normalized || getDatabaseCapability(registeredType)) return registeredType;
  if (normalized === "opengauss") {
    return "gaussdb";
  }
  return normalized;
}

function mapJdbcVendorToDialect(vendor) {
  return DIALECT_VENDOR_MAP[String(vendor || "").trim().toLowerCase()] || UNKNOWN;
}

function getDefaultPort(type) {
  const normalizedType = normalizeDatasourceType(type);
  const registered = getDatabaseCapability(normalizedType);
  if (registered) return registered.defaultPort;
  switch (normalizedType) {
    case "gaussdb":
      return 5432;
    case "clickhouse":
      return 8123;
    case "hive":
      return 10000;
    case "kafka":
      return 9092;
    case "ftp":
      return 21;
    case "sftp":
      return 22;
    default:
      return 0;
  }
}

function parseJdbcParams(rawParams = "") {
  if (!rawParams) {
    return {};
  }

  const normalized = String(rawParams || "")
    .replace(/^[?;]/, "")
    .replace(/;/g, "&");
  const searchParams = new URLSearchParams(normalized);
  const result = {};
  for (const [key, value] of searchParams.entries()) {
    result[key] = value;
  }
  return result;
}

function parseStandardJdbcUrl(jdbcUrl) {
  const normalized = String(jdbcUrl || "").trim();
  const matched = normalized.match(/^jdbc:([a-z0-9_]+)(?::([a-z0-9_]+))?:\/\/([^/?;#]+)(?::(\d+))?(?:\/([^?;#]*))?([?;].*)?$/i);
  if (!matched) {
    return null;
  }

  const vendor = String(matched[1] || "").toLowerCase();
  const subProtocol = String(matched[2] || "").toLowerCase() || null;
  const hostToken = String(matched[3] || "").split(",").map((item) => item.trim()).find(Boolean) || "";
  const pathToken = decodeURIComponent(String(matched[5] || "").trim());
  const params = parseJdbcParams(matched[6] || "");
  const database = pathToken || null;
  const schema = params.currentSchema || params.currentschema || params.schema || params.searchpath || null;

  return {
    jdbcUrl: normalized,
    vendor,
    subProtocol,
    dialect: mapJdbcVendorToDialect(subProtocol || vendor),
    host: hostToken || null,
    port: matched[4] ? Number(matched[4]) : null,
    database,
    schema,
    params,
  };
}

function parseOracleJdbcUrl(jdbcUrl) {
  const normalized = String(jdbcUrl || "").trim();
  const serviceMatched = normalized.match(/^jdbc:oracle(?::[a-z0-9_]+)*:@\/\/([^:/?#]+):(\d+)\/([^?;#]+)([?;].*)?$/i);
  const sidMatched = normalized.match(/^jdbc:oracle(?::[a-z0-9_]+)*:@([^:/?#]+):(\d+):([^?;#]+)([?;].*)?$/i);
  const matched = serviceMatched || sidMatched;
  if (!matched) {
    return null;
  }

  return {
    jdbcUrl: normalized,
    vendor: "oracle",
    subProtocol: null,
    dialect: "oracle",
    host: String(matched[1] || "").trim() || null,
    port: matched[2] ? Number(matched[2]) : null,
    database: decodeURIComponent(String(matched[3] || "").trim()) || null,
    connectionMode: serviceMatched ? "serviceName" : "sid",
    schema: null,
    params: parseJdbcParams(matched[4] || ""),
  };
}

function parseJdbcUrl(jdbcUrl) {
  const normalized = String(jdbcUrl || "").trim();
  if (!normalized || !/^jdbc:/i.test(normalized)) {
    return null;
  }

  return parseStandardJdbcUrl(normalized) || parseOracleJdbcUrl(normalized);
}

function inferDatasourceDialect(sourceType, connectionConfig = {}) {
  const normalizedType = normalizeDatasourceType(sourceType);
  if (!normalizedType) {
    return UNKNOWN;
  }
  if (getDatabaseCapability(normalizedType) || normalizedType === "clickhouse" || normalizedType === "hive" || normalizedType === "kafka" || normalizedType === "api" || normalizedType === "ftp" || normalizedType === "sftp") {
    return normalizedType;
  }
  if (normalizedType === "gaussdb") {
    return POSTGRESQL;
  }
  if (normalizedType === "jdbc") {
    return parseJdbcUrl(connectionConfig.jdbcUrl || connectionConfig.url || connectionConfig.connectionString)?.dialect || UNKNOWN;
  }
  return normalizedType;
}

function normalizeJdbcUrlForDialect(jdbcUrl, dialect) {
  const normalized = String(jdbcUrl || "").trim();
  if (!normalized) {
    return "";
  }

  if (dialect === POSTGRESQL) {
    return normalized.replace(/^jdbc:(?:gaussdb|opengauss|postgres):/i, "jdbc:postgresql:");
  }
  if (dialect === "mysql") {
    return normalized.replace(/^jdbc:mariadb:/i, "jdbc:mysql:");
  }
  if (dialect === "hive") {
    return normalized.replace(/^jdbc:hive:/i, "jdbc:hive2:");
  }
  return normalized;
}

function buildJdbcUrl(sourceType, connectionConfig = {}, options = {}) {
  const normalizedType = normalizeDatasourceType(sourceType);
  const dialect = options.dialect || inferDatasourceDialect(normalizedType, connectionConfig);
  const existingJdbcUrl = String(connectionConfig.jdbcUrl || connectionConfig.url || "").trim();
  if (existingJdbcUrl) {
    return options.normalize !== false ? normalizeJdbcUrlForDialect(existingJdbcUrl, dialect) : existingJdbcUrl;
  }

  const host = String(connectionConfig.host || "").trim();
  const port = Number(connectionConfig.port || getDefaultPort(dialect || normalizedType));
  const database = String(connectionConfig.database || connectionConfig.databaseName || "").trim();
  if (!host || !port) {
    return "";
  }

  if (dialect === POSTGRESQL) {
    return `jdbc:postgresql://${host}:${port}/${database}`;
  }
  if (dialect === "mysql") {
    return `jdbc:mysql://${host}:${port}/${database}?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai`;
  }
  if (dialect === "clickhouse") {
    return `jdbc:clickhouse://${host}:${port}/${database}`;
  }
  if (dialect === "hive") {
    return `jdbc:hive2://${host}:${port}/${database || "default"}`;
  }
  if (dialect === "oracle") {
    const connectionMode = String(connectionConfig.connectionMode || "serviceName").trim().toLowerCase();
    return connectionMode === "sid"
      ? `jdbc:oracle:thin:@${host}:${port}:${database}`
      : `jdbc:oracle:thin:@//${host}:${port}/${database}`;
  }
  if (dialect === "dm") {
    return `jdbc:dm://${host}:${port}/${database}`;
  }
  return "";
}

function resolveDatasourceConnection(sourceType, connectionConfig = {}) {
  const normalizedType = normalizeDatasourceType(sourceType);
  const jdbcMeta = parseJdbcUrl(connectionConfig.jdbcUrl || connectionConfig.url || connectionConfig.connectionString);
  const dialect = inferDatasourceDialect(normalizedType, connectionConfig);
  const database = connectionConfig.database || connectionConfig.databaseName || jdbcMeta?.database || null;
  const schema = connectionConfig.schema || connectionConfig.currentSchema || jdbcMeta?.schema || (dialect === POSTGRESQL ? "public" : null);
  const host = connectionConfig.host || jdbcMeta?.host || null;
  const portValue = connectionConfig.port || jdbcMeta?.port || getDefaultPort(dialect || normalizedType);
  const port = Number(portValue || 0) || 0;

  return {
    sourceType: normalizedType,
    dialect,
    host,
    port,
    database,
    schema,
    username: connectionConfig.username || connectionConfig.user || null,
    password: connectionConfig.password || null,
    jdbcUrl: buildJdbcUrl(normalizedType, { ...connectionConfig, database }, { dialect }),
    driverClassName: connectionConfig.driverClassName || null,
    protocol: connectionConfig.protocol || jdbcMeta?.vendor || null,
    connectionMode: connectionConfig.connectionMode || jdbcMeta?.connectionMode || null,
    jdbcMeta,
  };
}

module.exports = {
  POSTGRESQL,
  UNKNOWN,
  buildJdbcUrl,
  getDefaultPort,
  inferDatasourceDialect,
  mapJdbcVendorToDialect,
  normalizeDatasourceType,
  normalizeJdbcUrlForDialect,
  parseJdbcUrl,
  resolveDatasourceConnection,
};
