export type DatasourceConnectionConfigLike = {
  host?: unknown;
  port?: unknown;
  database?: unknown;
  databaseName?: unknown;
  username?: unknown;
  password?: unknown;
  rootPath?: unknown;
  path?: unknown;
  passiveMode?: unknown;
  encoding?: unknown;
  maxPreviewBytes?: unknown;
  bootstrapServers?: unknown;
  clientId?: unknown;
  topicPattern?: unknown;
  fromBeginning?: unknown;
  jdbcUrl?: unknown;
  url?: unknown;
  schema?: unknown;
  driverClassName?: unknown;
  connectionMode?: unknown;
  baseUrl?: unknown;
  timeoutMs?: unknown;
};

const POSTGRESQL = "postgresql";
const UNKNOWN = "unknown";
export const DATASOURCE_CODE_PATTERN = /^[a-zA-Z0-9_]+$/;

export const DATABASE_CAPABILITIES = {
  mysql: { type: "mysql", label: "MySQL", defaultPort: 3306 },
  postgresql: { type: POSTGRESQL, label: "PostgreSQL", defaultPort: 5432 },
  oracle: { type: "oracle", label: "Oracle", defaultPort: 1521 },
  dm: { type: "dm", label: "达梦数据库", defaultPort: 5236 },
} as const;

export const DATABASE_SOURCE_TYPE_OPTIONS = Object.values(DATABASE_CAPABILITIES).map((item) => ({
  value: item.type,
  label: item.label,
}));

const DIALECT_VENDOR_MAP: Record<string, string> = {
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

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function toOptionalText(value: unknown) {
  const text = toText(value);
  return text || undefined;
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function parseJdbcParams(rawParams = "") {
  if (!rawParams) {
    return {};
  }

  const normalized = String(rawParams || "")
    .replace(/^[?;]/, "")
    .replace(/;/g, "&");
  const searchParams = new URLSearchParams(normalized);
  const result: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    result[key] = value;
  }
  return result;
}

function mapJdbcVendorToDialect(vendor: unknown) {
  return DIALECT_VENDOR_MAP[toText(vendor).toLowerCase()] || UNKNOWN;
}

function parseStandardJdbcUrl(jdbcUrl: string) {
  const matched = jdbcUrl.match(/^jdbc:([a-z0-9_]+)(?::([a-z0-9_]+))?:\/\/([^/?;#]+)(?::(\d+))?(?:\/([^?;#]*))?([?;].*)?$/i);
  if (!matched) {
    return null;
  }

  const vendor = toText(matched[1]).toLowerCase();
  const subProtocol = toText(matched[2]).toLowerCase() || null;
  const hostToken = toText(matched[3]).split(",").map((item) => item.trim()).find(Boolean) || "";
  const database = decodeURIComponent(toText(matched[5])) || null;
  const params = parseJdbcParams(matched[6] || "");
  const schema = params.currentSchema || params.currentschema || params.schema || params.searchpath || null;

  return {
    jdbcUrl,
    vendor,
    subProtocol,
    host: hostToken || null,
    port: matched[4] ? Number(matched[4]) : null,
    database,
    schema,
    dialect: mapJdbcVendorToDialect(subProtocol || vendor),
  };
}

function parseOracleJdbcUrl(jdbcUrl: string) {
  const matched = jdbcUrl.match(/^jdbc:oracle(?::[a-z0-9_]+)*:@\/\/([^:/?#]+):(\d+)\/([^?;#]+)([?;].*)?$/i);
  if (!matched) {
    return null;
  }

  return {
    jdbcUrl,
    vendor: "oracle",
    subProtocol: null,
    host: toText(matched[1]) || null,
    port: matched[2] ? Number(matched[2]) : null,
    database: decodeURIComponent(toText(matched[3])) || null,
    schema: null,
    dialect: "oracle",
  };
}

export function normalizeDatasourceType(value?: unknown) {
  const normalized = toText(value).toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized === "postgres") {
    return POSTGRESQL;
  }
  if (["dameng", "dmdb"].includes(normalized)) {
    return "dm";
  }
  if (normalized === "opengauss") {
    return "gaussdb";
  }
  return normalized;
}

export function parseJdbcUrl(rawJdbcUrl?: unknown) {
  const jdbcUrl = toText(rawJdbcUrl);
  if (!jdbcUrl || !/^jdbc:/i.test(jdbcUrl)) {
    return null;
  }
  return parseStandardJdbcUrl(jdbcUrl) || parseOracleJdbcUrl(jdbcUrl);
}

export function inferDatasourceDialect(
  sourceType?: unknown,
  connectionConfig: DatasourceConnectionConfigLike = {}
) {
  const normalizedType = normalizeDatasourceType(sourceType);
  if (!normalizedType) {
    return UNKNOWN;
  }
  if (["mysql", POSTGRESQL, "clickhouse", "hive", "oracle", "dm", "kafka", "api", "ftp", "sftp"].includes(normalizedType)) {
    return normalizedType;
  }
  if (normalizedType === "gaussdb") {
    return POSTGRESQL;
  }
  if (normalizedType === "jdbc") {
    return parseJdbcUrl(connectionConfig.jdbcUrl || connectionConfig.url)?.dialect || UNKNOWN;
  }
  return normalizedType;
}

export function getDefaultPort(sourceType?: unknown) {
  const normalizedType = normalizeDatasourceType(sourceType);
  const databaseCapability = DATABASE_CAPABILITIES[normalizedType as keyof typeof DATABASE_CAPABILITIES];
  if (databaseCapability) return databaseCapability.defaultPort;
  switch (normalizedType) {
    case "gaussdb":
      return DATABASE_CAPABILITIES.postgresql.defaultPort;
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
    case "api":
      return 0;
    default:
      return 0;
  }
}

export function usesJdbcUrl(sourceType?: unknown, jdbcUrl?: unknown) {
  return normalizeDatasourceType(sourceType) === "jdbc" || Boolean(toText(jdbcUrl));
}

export function normalizeDatasourceCode(value?: unknown) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  return text
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function inferDatasourceFieldErrors(error: unknown) {
  const message = error instanceof Error ? String(error.message || "").trim() : "";
  if (!message) {
    return {};
  }

  if (message.includes("数据源编码已存在") || (/duplicate/i.test(message) && /source[_\s-]*code/i.test(message))) {
    return {
      sourceCode: [message],
    } as Record<string, string[]>;
  }

  return {};
}

export function getApiFieldErrors(error: unknown) {
  if (!error || typeof error !== "object") {
    return inferDatasourceFieldErrors(error);
  }

  const details = "details" in error ? (error as { details?: unknown }).details : undefined;
  if (!details || typeof details !== "object") {
    return inferDatasourceFieldErrors(error);
  }

  if ("fieldErrors" in details && details.fieldErrors && typeof details.fieldErrors === "object") {
    return details.fieldErrors as Record<string, string[] | undefined>;
  }

  return inferDatasourceFieldErrors(error);
}

export function getApiFieldErrorMessage(error: unknown, fallback = "请求失败") {
  const fieldErrors = getApiFieldErrors(error);
  for (const messages of Object.values(fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) {
      return String(messages[0] || fallback);
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function buildConnectionConfigFromForm(values: Record<string, unknown>) {
  const sourceType = normalizeDatasourceType(values.sourceType);
  if (sourceType === "kafka") {
    const result = {
      bootstrapServers: toOptionalText(values.bootstrapServers),
      clientId: toOptionalText(values.clientId),
      topicPattern: toOptionalText(values.topicPattern),
      fromBeginning: Boolean(values.fromBeginning),
    };
    return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined && value !== ""));
  }
  if (sourceType === "ftp") {
    const result = {
      host: toOptionalText(values.host),
      port: toOptionalNumber(values.port),
      username: toOptionalText(values.username),
      password: toOptionalText(values.password),
      rootPath: toOptionalText(values.rootPath),
      passiveMode: values.passiveMode !== false,
      encoding: toOptionalText(values.encoding),
      maxPreviewBytes: toOptionalNumber(values.maxPreviewBytes),
    };
    return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined && value !== ""));
  }
  if (sourceType === "api") {
    const result = {
      baseUrl: toOptionalText(values.baseUrl),
      timeoutMs: toOptionalNumber(values.timeoutMs),
    };
    return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined && value !== ""));
  }
  const result = {
    host: toOptionalText(values.host),
    port: toOptionalNumber(values.port),
    database: toOptionalText(values.databaseName),
    username: toOptionalText(values.username),
    password: toOptionalText(values.password),
    jdbcUrl: toOptionalText(values.jdbcUrl),
    schema: toOptionalText(values.schema),
    driverClassName: toOptionalText(values.driverClassName),
    connectionMode: toOptionalText(values.connectionMode),
  };

  return Object.fromEntries(
    Object.entries(result).filter(([, value]) => value !== undefined && value !== "")
  );
}

export function buildDevDatasourceExtraConfig(
  values: Record<string, unknown>,
  current: Record<string, unknown> = {}
) {
  const next = { ...current };
  const jdbcUrl = toOptionalText(values.jdbcUrl);
  const schema = toOptionalText(values.schema);
  const driverClassName = toOptionalText(values.driverClassName);

  if (jdbcUrl) next.jdbcUrl = jdbcUrl;
  else delete next.jdbcUrl;

  if (schema) next.schema = schema;
  else delete next.schema;

  if (driverClassName) next.driverClassName = driverClassName;
  else delete next.driverClassName;

  return next;
}

export function isScenarioDatabaseSource(record?: {
  status?: string;
  sourceType?: unknown;
  connectionConfig?: DatasourceConnectionConfigLike;
}) {
  if (String(record?.status || "").toLowerCase() !== "active") {
    return false;
  }
  const dialect = inferDatasourceDialect(record?.sourceType, record?.connectionConfig || {});
  return ["mysql", POSTGRESQL].includes(dialect);
}

export function toScenarioDbType(record?: {
  sourceType?: unknown;
  connectionConfig?: DatasourceConnectionConfigLike;
}): "mysql" | "postgresql" {
  return inferDatasourceDialect(record?.sourceType, record?.connectionConfig || {}) === POSTGRESQL
    ? POSTGRESQL
    : "mysql";
}
