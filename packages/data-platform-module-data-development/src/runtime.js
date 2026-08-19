var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// backend/src/common/utils/response.js
var require_response = __commonJS({
  "backend/src/common/utils/response.js"(exports2, module2) {
    function sendSuccess(res, data, meta, statusCode = 200) {
      return res.status(statusCode).json({ success: true, data, meta });
    }
    module2.exports = {
      sendSuccess
    };
  }
});

// backend/src/common/errors/app-error.js
var require_app_error = __commonJS({
  "backend/src/common/errors/app-error.js"(exports2, module2) {
    var AppError = class extends Error {
      constructor(message, statusCode, details) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.details = details;
      }
    };
    module2.exports = AppError;
  }
});

// runtime-port:database
var require_database = __commonJS({
  "runtime-port:database"(exports2, module2) {
    var { createDatabasePoolProxy } = require("@johnason/data-platform-core-kernel");
    var pool = createDatabasePoolProxy();
    module2.exports = { pool, testConnection: async () => {
      const c = await pool.getConnection();
      c.release();
    } };
  }
});

// runtime-port:project-context
var require_project_context = __commonJS({
  "runtime-port:project-context"(exports2, module2) {
    var k = require("@johnason/data-platform-core-kernel");
    module2.exports = { runWithProjectContext: (_context, callback) => callback(), getProjectContext: k.getProjectContext, getCurrentProjectId: k.getCurrentProjectId, getProjectCondition: k.getProjectCondition, addProjectCondition: k.addProjectCondition };
  }
});

// runtime-port:config
var require_config = __commonJS({
  "runtime-port:config"(exports2, module2) {
    var { createRuntimeConfigProxy } = require("@johnason/data-platform-core-kernel");
    module2.exports = createRuntimeConfigProxy();
  }
});

// backend/src/common/utils/database-driver-store.js
var require_database_driver_store = __commonJS({
  "backend/src/common/utils/database-driver-store.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var DRIVER_STORE_ROOT = path.resolve(process.cwd(), "runtime/database-drivers");
    var ACTIVE_MANIFEST_PATH = path.join(DRIVER_STORE_ROOT, "active.json");
    var DATAX_TARGETS = {
      mysql: {
        dataxReader: { relativePath: "reader/mysqlreader/libs", pattern: /(?:mysql-connector|mariadb-java-client).*\.jar$/i },
        dataxWriter: { relativePath: "writer/mysqlwriter/libs", pattern: /(?:mysql-connector|mariadb-java-client).*\.jar$/i }
      },
      postgresql: {
        dataxReader: { relativePath: "reader/postgresqlreader/libs", pattern: /(?:postgresql|pgjdbc).*\.jar$/i },
        dataxWriter: { relativePath: "writer/postgresqlwriter/libs", pattern: /(?:postgresql|pgjdbc).*\.jar$/i }
      },
      oracle: {
        dataxReader: { relativePath: "reader/oraclereader/libs", pattern: /ojdbc.*\.jar$/i },
        dataxWriter: { relativePath: "writer/oraclewriter/libs", pattern: /ojdbc.*\.jar$/i }
      },
      dm: {
        dataxReader: { relativePath: "reader/rdbmsreader/libs", pattern: /dm.*jdbcdriver.*\.jar$/i },
        dataxWriter: { relativePath: "writer/rdbmswriter/libs", pattern: /dm.*jdbcdriver.*\.jar$/i }
      }
    };
    function ensureDriverStore() {
      fs.mkdirSync(DRIVER_STORE_ROOT, { recursive: true });
      return DRIVER_STORE_ROOT;
    }
    function emptyManifest() {
      return { version: 1, bindings: {}, updatedAt: null };
    }
    function readActiveManifest() {
      ensureDriverStore();
      try {
        const parsed = JSON.parse(fs.readFileSync(ACTIVE_MANIFEST_PATH, "utf8"));
        return parsed && typeof parsed === "object" && parsed.bindings ? parsed : emptyManifest();
      } catch {
        return emptyManifest();
      }
    }
    function writeActiveManifest(manifest) {
      ensureDriverStore();
      const next = { version: 1, bindings: manifest?.bindings || {}, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      const tempPath = `${ACTIVE_MANIFEST_PATH}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(next, null, 2), "utf8");
      fs.renameSync(tempPath, ACTIVE_MANIFEST_PATH);
      return next;
    }
    function getActiveDriverBinding(databaseType, target = "query") {
      const key = `${String(databaseType || "").toLowerCase()}:${target}`;
      return readActiveManifest().bindings[key] || null;
    }
    function resolveDriverFile(relativePath) {
      const resolved = path.resolve(DRIVER_STORE_ROOT, String(relativePath || ""));
      const relative = path.relative(DRIVER_STORE_ROOT, resolved);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("\u9A71\u52A8\u6587\u4EF6\u8DEF\u5F84\u8D85\u51FA\u6301\u4E45\u5316\u4ED3\u5E93");
      }
      return resolved;
    }
    function restoreBuiltInDrivers(directory) {
      if (!fs.existsSync(directory)) return;
      for (const name of fs.readdirSync(directory)) {
        if (!name.endsWith(".builtin-disabled")) continue;
        const source = path.join(directory, name);
        const target = path.join(directory, name.slice(0, -".builtin-disabled".length));
        if (!fs.existsSync(target)) fs.renameSync(source, target);
        else fs.unlinkSync(source);
      }
    }
    function materializeDataXTarget(dataxHome, databaseType, target, binding) {
      const config = DATAX_TARGETS[databaseType]?.[target];
      if (!config) return;
      const directory = path.join(dataxHome, "plugin", config.relativePath);
      if (!fs.existsSync(directory)) throw new Error(`DataX \u63D2\u4EF6\u76EE\u5F55\u4E0D\u5B58\u5728: ${config.relativePath}`);
      const managedName = `medata-managed-${databaseType}.jar`;
      const managedPath = path.join(directory, managedName);
      if (fs.existsSync(managedPath)) fs.unlinkSync(managedPath);
      restoreBuiltInDrivers(directory);
      if (!binding) return;
      for (const name of fs.readdirSync(directory)) {
        if (name === managedName || !config.pattern.test(name)) continue;
        fs.renameSync(path.join(directory, name), path.join(directory, `${name}.builtin-disabled`));
      }
      const sourcePath = resolveDriverFile(binding.filePath);
      if (!fs.existsSync(sourcePath)) throw new Error(`\u6FC0\u6D3B\u9A71\u52A8\u6587\u4EF6\u4E0D\u5B58\u5728: ${binding.filePath}`);
      fs.copyFileSync(sourcePath, managedPath);
    }
    function materializeActiveDataXDrivers(dataxHome) {
      const manifest = readActiveManifest();
      for (const databaseType of Object.keys(DATAX_TARGETS)) {
        for (const target of ["dataxReader", "dataxWriter"]) {
          materializeDataXTarget(dataxHome, databaseType, target, manifest.bindings[`${databaseType}:${target}`] || null);
        }
      }
      return manifest;
    }
    module2.exports = {
      ACTIVE_MANIFEST_PATH,
      DRIVER_STORE_ROOT,
      ensureDriverStore,
      getActiveDriverBinding,
      materializeDataXTarget,
      materializeActiveDataXDrivers,
      readActiveManifest,
      resolveDriverFile,
      writeActiveManifest
    };
  }
});

// backend/src/common/utils/datasource-capabilities.js
var require_datasource_capabilities = __commonJS({
  "backend/src/common/utils/datasource-capabilities.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { getActiveDriverBinding } = require_database_driver_store();
    var DATABASE_CAPABILITIES = Object.freeze({
      mysql: Object.freeze({
        type: "mysql",
        label: "MySQL",
        aliases: Object.freeze(["mysql", "mariadb"]),
        defaultPort: 3306,
        driverClassName: "com.mysql.cj.jdbc.Driver",
        healthCheckSql: "SELECT 1 AS ok",
        dataxReader: "mysqlreader",
        dataxWriter: "mysqlwriter",
        nodePackage: "mysql2",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      }),
      postgresql: Object.freeze({
        type: "postgresql",
        label: "PostgreSQL",
        aliases: Object.freeze(["postgresql", "postgres", "pg"]),
        defaultPort: 5432,
        driverClassName: "org.postgresql.Driver",
        healthCheckSql: "SELECT 1 AS ok",
        dataxReader: "postgresqlreader",
        dataxWriter: "postgresqlwriter",
        nodePackage: "pg",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      }),
      oracle: Object.freeze({
        type: "oracle",
        label: "Oracle",
        aliases: Object.freeze(["oracle"]),
        defaultPort: 1521,
        driverClassName: "oracle.jdbc.OracleDriver",
        healthCheckSql: "SELECT 1 AS ok FROM DUAL",
        dataxReader: "oraclereader",
        dataxWriter: "oraclewriter",
        nodePackage: "oracledb",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      }),
      dm: Object.freeze({
        type: "dm",
        label: "\u8FBE\u68A6\u6570\u636E\u5E93",
        aliases: Object.freeze(["dm", "dameng", "dmdb"]),
        defaultPort: 5236,
        driverClassName: "dm.jdbc.driver.DmDriver",
        healthCheckSql: "SELECT 1 AS ok FROM DUAL",
        dataxReader: "rdbmsreader",
        dataxWriter: "rdbmswriter",
        nodePackage: "dmdb",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      })
    });
    var DATABASE_ALIAS_MAP = Object.freeze(Object.fromEntries(
      Object.values(DATABASE_CAPABILITIES).flatMap(
        (capability) => capability.aliases.map((alias) => [alias, capability.type])
      )
    ));
    function getRuntimeDatabaseCapabilityStatus() {
      const pluginRoot = path.resolve(__dirname, "../../../datax/plugin");
      const hasPlugin = (kind, name) => fs.existsSync(path.join(pluginRoot, kind, name, "plugin.json"));
      const hasJar = (kind, name, pattern) => {
        const libs = path.join(pluginRoot, kind, name, "libs");
        return fs.existsSync(libs) && fs.readdirSync(libs).some((fileName) => pattern.test(fileName));
      };
      return listDatabaseCapabilities().map((capability) => {
        let driverLoaded = false;
        try {
          require.resolve(capability.nodePackage);
          driverLoaded = true;
        } catch {
          driverLoaded = false;
        }
        const readerJarReady = capability.type === "oracle" ? hasJar("reader", capability.dataxReader, /^ojdbc.*\.jar$/i) : capability.type === "dm" ? hasJar("reader", capability.dataxReader, /^Dm.*JdbcDriver.*\.jar$/i) : true;
        const writerJarReady = capability.type === "oracle" ? hasJar("writer", capability.dataxWriter, /^ojdbc.*\.jar$/i) : capability.type === "dm" ? hasJar("writer", capability.dataxWriter, /^Dm.*JdbcDriver.*\.jar$/i) : true;
        const managedQueryDriver = getActiveDriverBinding(capability.type, "query");
        return {
          ...capability,
          driverLoaded,
          queryReady: driverLoaded || Boolean(managedQueryDriver),
          managedQueryDriver: managedQueryDriver ? {
            packageId: managedQueryDriver.packageId,
            version: managedQueryDriver.version,
            sha256: managedQueryDriver.sha256
          } : null,
          dataxReaderReady: hasPlugin("reader", capability.dataxReader) && readerJarReady,
          dataxWriterReady: hasPlugin("writer", capability.dataxWriter) && writerJarReady
        };
      });
    }
    function normalizeRegisteredDatabaseType(value) {
      const normalized = String(value || "").trim().toLowerCase();
      return DATABASE_ALIAS_MAP[normalized] || normalized;
    }
    function getDatabaseCapability(value) {
      return DATABASE_CAPABILITIES[normalizeRegisteredDatabaseType(value)] || null;
    }
    function listDatabaseCapabilities() {
      return Object.values(DATABASE_CAPABILITIES);
    }
    function isSupportedDatabaseType(value) {
      return Boolean(getDatabaseCapability(value));
    }
    module2.exports = {
      DATABASE_CAPABILITIES,
      getDatabaseCapability,
      isSupportedDatabaseType,
      listDatabaseCapabilities,
      getRuntimeDatabaseCapabilityStatus,
      normalizeRegisteredDatabaseType
    };
  }
});

// backend/src/common/utils/datasource-dialect.js
var require_datasource_dialect = __commonJS({
  "backend/src/common/utils/datasource-dialect.js"(exports2, module2) {
    var POSTGRESQL = "postgresql";
    var UNKNOWN = "unknown";
    var {
      getDatabaseCapability,
      normalizeRegisteredDatabaseType
    } = require_datasource_capabilities();
    var DIALECT_VENDOR_MAP = {
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
      sqlserver: "sqlserver"
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
          return 1e4;
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
      const normalized = String(rawParams || "").replace(/^[?;]/, "").replace(/;/g, "&");
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
        params
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
        params: parseJdbcParams(matched[4] || "")
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
        return connectionMode === "sid" ? `jdbc:oracle:thin:@${host}:${port}:${database}` : `jdbc:oracle:thin:@//${host}:${port}/${database}`;
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
        jdbcMeta
      };
    }
    module2.exports = {
      POSTGRESQL,
      UNKNOWN,
      buildJdbcUrl,
      getDefaultPort,
      inferDatasourceDialect,
      mapJdbcVendorToDialect,
      normalizeDatasourceType,
      normalizeJdbcUrlForDialect,
      parseJdbcUrl,
      resolveDatasourceConnection
    };
  }
});

// backend/src/modules/data-development/data-development.utils.js
var require_data_development_utils = __commonJS({
  "backend/src/modules/data-development/data-development.utils.js"(exports2, module2) {
    var crypto = require("crypto");
    var env = require_config();
    var {
      inferDatasourceDialect: inferSharedDatasourceDialect,
      normalizeDatasourceType: normalizeSharedDatasourceType,
      resolveDatasourceConnection
    } = require_datasource_dialect();
    var PENDING_PROCESSING_SOURCE_TABLE_PREFIX = "__pending_source_table__";
    function parseJson(value, fallback) {
      if (value === null || value === void 0) {
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
      return String(process.env.DATA_DEV_HOST_ALIASES || "").split(",").map((item) => item.trim()).filter(Boolean).reduce((result, item) => {
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
        ...extraConfig
      };
    }
    function inferDatasourceDialect(input, extraConfig = {}) {
      if (input && typeof input === "object") {
        const sourceType2 = input.storageType || input.type || input.sourceType;
        const payload = buildDatasourceConnectionPayload(input);
        const dialect2 = inferSharedDatasourceDialect(sourceType2, payload);
        return dialect2 === "unknown" ? normalizeDatasourceType(sourceType2) : dialect2;
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
          ...resolved.jdbcUrl ? { jdbcUrl: resolved.jdbcUrl } : {},
          ...resolved.schema ? { schema: resolved.schema } : {},
          ...payload.driverClassName || resolved.driverClassName ? { driverClassName: payload.driverClassName || resolved.driverClassName } : {},
          ...payload.protocol || resolved.protocol ? { protocol: payload.protocol || resolved.protocol } : {},
          ...payload.connectionMode || resolved.connectionMode ? { connectionMode: payload.connectionMode || resolved.connectionMode } : {}
        }
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
        Number(resolved.port || 0)
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
      const normalizedDialect2 = normalizeDatasourceType(dialect);
      if (normalizedDialect2 === "oracle") {
        return `SELECT * FROM (${trimmed}) WHERE ROWNUM <= ${limit}`;
      }
      if (normalizedDialect2 === "dm") {
        return `${trimmed}
FETCH FIRST ${limit} ROWS ONLY`;
      }
      if (normalizedDialect2 === "hive") {
        return `${trimmed}
LIMIT ${limit}`;
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
        affectedRows: sanitizeNumber(result.affectedRows, 0)
      };
    }
    function formatDateTime(date = /* @__PURE__ */ new Date()) {
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
          table: parts[parts.length - 1].replace(/["`]/g, "")
        };
      }
      return {
        scope: defaultScope,
        table: String(tableName || "").replace(/["`]/g, "")
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
      return String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !line.startsWith("SLF4J:")).filter((line) => !line.startsWith("Connecting to ")).filter((line) => !line.startsWith("Connected to:")).filter((line) => !line.startsWith("Driver:")).filter((line) => !line.startsWith("Transaction isolation:")).filter((line) => !line.startsWith("Beeline version")).filter((line) => !line.startsWith("0: jdbc:hive2://")).filter((line) => !line.startsWith("+")).filter((line) => !line.startsWith("|"));
    }
    function quoteIdentifier(identifier, type = "mysql") {
      const normalized = normalizeDatasourceType(type);
      const quote = ["postgresql", "oracle", "dm"].includes(normalized) ? '"' : "`";
      return String(identifier || "").split(".").filter(Boolean).map((part) => `${quote}${String(part).replace(new RegExp(quote, "g"), quote.repeat(2))}${quote}`).join(".");
    }
    module2.exports = {
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
      stripLeadingSqlComments
    };
  }
});

// backend/src/modules/data-development/data-development.repository.js
var require_data_development_repository = __commonJS({
  "backend/src/modules/data-development/data-development.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var { getCurrentProjectId } = require_project_context();
    var { parseJson } = require_data_development_utils();
    function getScopedWhere(alias = "") {
      const projectId = getCurrentProjectId();
      if (!projectId) return { sql: "", params: [], projectId: null };
      const prefix = alias ? `${alias}.` : "";
      return { sql: `${prefix}project_id = ?`, params: [projectId], projectId };
    }
    function mapDatasource(row, includePassword = false) {
      return {
        id: Number(row.id),
        name: row.name,
        type: row.type,
        host: row.host,
        port: Number(row.port),
        databaseName: row.databaseName,
        username: row.username,
        passwordEncrypted: includePassword ? row.passwordEncrypted : void 0,
        hasPassword: Boolean(row.passwordEncrypted),
        extraConfig: parseJson(row.extraConfig, {}),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapScriptFolder(row) {
      return {
        id: Number(row.id),
        name: row.name,
        parentId: row.parentId === null ? null : Number(row.parentId),
        createdAt: row.createdAt
      };
    }
    function mapScript(row) {
      return {
        id: Number(row.id),
        name: row.name,
        folderId: row.folderId === null ? null : Number(row.folderId),
        datasourceId: Number(row.datasourceId),
        datasourceName: row.datasourceName,
        datasourceType: row.datasourceType,
        defaultDatabase: row.defaultDatabase,
        description: row.description,
        tags: parseJson(row.tags, []),
        content: row.content,
        currentVersion: Number(row.currentVersion || 1),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapScriptVersion(row) {
      return {
        id: Number(row.id),
        scriptId: Number(row.scriptId),
        versionNo: Number(row.versionNo),
        content: row.content,
        createdAt: row.createdAt
      };
    }
    function mapQueryHistory(row) {
      return {
        id: Number(row.id),
        datasourceId: Number(row.datasourceId),
        datasourceName: row.datasourceName,
        scriptId: row.scriptId === null ? null : Number(row.scriptId),
        scriptName: row.scriptName || null,
        sqlText: row.sqlText,
        databaseName: row.databaseName,
        status: row.status,
        durationMs: Number(row.durationMs || 0),
        errorMessage: row.errorMessage,
        resultPreview: parseJson(row.resultPreview, null),
        executedAt: row.executedAt
      };
    }
    function mapCopilotSession(row) {
      return {
        id: Number(row.id),
        projectId: Number(row.projectId),
        userId: Number(row.userId),
        datasourceId: Number(row.datasourceId),
        datasourceName: row.datasourceName || null,
        databaseName: row.databaseName || null,
        sessionTitle: row.sessionTitle || null,
        status: row.status,
        lastMessageAt: row.lastMessageAt || null,
        messageCount: row.messageCount === void 0 || row.messageCount === null ? null : Number(row.messageCount),
        lastPreview: row.lastPreview || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapCopilotMessage(row) {
      return {
        id: Number(row.id),
        sessionId: Number(row.sessionId),
        role: row.role,
        taskType: row.taskType || null,
        messageText: row.messageText,
        payload: parseJson(row.payload, null),
        context: parseJson(row.context, null),
        createdAt: row.createdAt
      };
    }
    function mapWorkflow(row) {
      return {
        id: Number(row.id),
        projectId: row.projectId === null || row.projectId === void 0 ? null : Number(row.projectId),
        name: row.name,
        description: row.description,
        cronExpr: row.cronExpr,
        isPaused: Boolean(row.isPaused),
        retryTimes: Number(row.retryTimes || 0),
        timeoutSec: Number(row.timeoutSec || 300),
        publishedVersionNo: row.publishedVersionNo === null || row.publishedVersionNo === void 0 ? null : Number(row.publishedVersionNo),
        runtimeConfig: parseJson(row.runtimeConfig, {}),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapWorkflowNode(row) {
      return {
        id: Number(row.id),
        workflowId: Number(row.workflowId),
        nodeType: row.nodeType || "script",
        scriptId: row.scriptId === null || row.scriptId === void 0 ? null : Number(row.scriptId),
        scriptName: row.scriptName || null,
        processingJobId: row.processingJobId === null || row.processingJobId === void 0 ? null : Number(row.processingJobId),
        processingJobName: row.processingJobName || null,
        orchestrationTaskId: row.orchestrationTaskId === null || row.orchestrationTaskId === void 0 ? null : Number(row.orchestrationTaskId),
        orchestrationTaskName: row.orchestrationTaskName || null,
        datasourceId: row.datasourceId === null || row.datasourceId === void 0 ? null : Number(row.datasourceId),
        datasourceName: row.datasourceName || null,
        nodeKey: row.nodeKey,
        nodeName: row.nodeName,
        positionX: Number(row.positionX || 0),
        positionY: Number(row.positionY || 0),
        width: Number(row.width || 240),
        height: Number(row.height || 88),
        retryTimes: row.retryTimes === null || row.retryTimes === void 0 ? null : Number(row.retryTimes),
        retryIntervalSec: Number(row.retryIntervalSec || 0),
        timeoutSec: row.timeoutSec === null || row.timeoutSec === void 0 ? null : Number(row.timeoutSec),
        triggerRule: row.triggerRule || "all_success",
        nodeConfig: parseJson(row.nodeConfig, {}),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapWorkflowEdge(row) {
      return {
        id: Number(row.id),
        workflowId: Number(row.workflowId),
        sourceNodeKey: row.sourceNodeKey,
        targetNodeKey: row.targetNodeKey,
        edgeType: row.edgeType,
        edgeLabel: row.edgeLabel || "default",
        createdAt: row.createdAt
      };
    }
    function mapWorkflowVersion(row) {
      return {
        id: Number(row.id),
        workflowId: Number(row.workflowId),
        versionNo: Number(row.versionNo),
        graphSnapshot: parseJson(row.graphSnapshot, { nodes: [], edges: [] }),
        validation: parseJson(row.validation, null),
        createdAt: row.createdAt
      };
    }
    function mapOrchestrationTask(row) {
      return {
        id: Number(row.id),
        name: row.name,
        description: row.description,
        datasourceId: row.datasourceId === null || row.datasourceId === void 0 ? null : Number(row.datasourceId),
        datasourceName: row.datasourceName || null,
        datasourceType: row.datasourceType || null,
        databaseName: row.databaseName,
        cronExpr: row.cronExpr,
        isPaused: Boolean(row.isPaused),
        retryTimes: Number(row.retryTimes || 0),
        timeoutSec: Number(row.timeoutSec || 300),
        runtimeConfig: parseJson(row.runtimeConfig, {}),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapOrchestrationNode(row) {
      return {
        id: Number(row.id),
        taskId: Number(row.taskId),
        nodeType: row.nodeType || "operator",
        operatorCode: row.operatorCode,
        nodeKey: row.nodeKey,
        nodeName: row.nodeName,
        positionX: Number(row.positionX || 0),
        positionY: Number(row.positionY || 0),
        width: Number(row.width || 260),
        height: Number(row.height || 108),
        nodeConfig: parseJson(row.nodeConfig, {}),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapOrchestrationEdge(row) {
      return {
        id: Number(row.id),
        taskId: Number(row.taskId),
        sourceNodeKey: row.sourceNodeKey,
        sourcePort: row.sourcePort || null,
        targetNodeKey: row.targetNodeKey,
        targetPort: row.targetPort || null,
        edgeType: row.edgeType,
        edgeStatus: row.edgeStatus || "active",
        createdAt: row.createdAt
      };
    }
    function mapWorkflowRun(row) {
      return {
        id: Number(row.id),
        workflowId: Number(row.workflowId),
        workflowName: row.workflowName || null,
        triggerType: row.triggerType,
        status: row.status,
        runParams: parseJson(row.runParams, {}),
        workflowVersionNo: row.workflowVersionNo === null || row.workflowVersionNo === void 0 ? null : Number(row.workflowVersionNo),
        graphSnapshot: parseJson(row.graphSnapshot, null),
        workflowRetryCount: Number(row.workflowRetryCount || 0),
        scheduledAt: row.scheduledAt || null,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        durationMs: row.durationMs === null || row.durationMs === void 0 ? null : Number(row.durationMs),
        errorMessage: row.errorMessage,
        createdAt: row.createdAt
      };
    }
    function mapJobInstance(row) {
      return {
        id: Number(row.id),
        workflowRunId: Number(row.workflowRunId),
        workflowId: Number(row.workflowId),
        workflowNodeId: Number(row.workflowNodeId),
        workflowNodeKey: row.workflowNodeKey || null,
        workflowName: row.workflowName || null,
        workflowNodeName: row.workflowNodeName || null,
        nodeType: row.nodeType || "script",
        scriptId: row.scriptId === null || row.scriptId === void 0 ? null : Number(row.scriptId),
        scriptName: row.scriptName || null,
        processingJobId: row.processingJobId === null || row.processingJobId === void 0 ? null : Number(row.processingJobId),
        processingJobName: row.processingJobName || null,
        orchestrationTaskId: row.orchestrationTaskId === null || row.orchestrationTaskId === void 0 ? null : Number(row.orchestrationTaskId),
        orchestrationTaskName: row.orchestrationTaskName || null,
        triggerType: row.triggerType,
        status: row.status,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        durationMs: row.durationMs === null || row.durationMs === void 0 ? null : Number(row.durationMs),
        retryCount: Number(row.retryCount || 0),
        runAttempt: Number(row.runAttempt || 1),
        errorMessage: row.errorMessage,
        resultPreview: parseJson(row.resultPreview, null),
        branchResult: parseJson(row.branchResult, null),
        createdAt: row.createdAt
      };
    }
    function mapJobLog(row) {
      return {
        id: Number(row.id),
        instanceId: Number(row.instanceId),
        logType: row.logType,
        content: row.content,
        createdAt: row.createdAt
      };
    }
    function mapProcessingJob(row) {
      return {
        id: Number(row.id),
        name: row.name,
        description: row.description,
        datasourceId: Number(row.datasourceId),
        datasourceName: row.datasourceName || null,
        datasourceType: row.datasourceType || null,
        databaseName: row.databaseName || null,
        tableName: row.tableName,
        targetTableName: row.targetTableName || null,
        outputMode: row.outputMode || "new_table",
        status: row.status || "draft",
        ownerName: row.ownerName || null,
        tags: parseJson(row.tags, []),
        currentVersionNo: Number(row.currentVersionNo || 1),
        publishedVersionNo: row.publishedVersionNo === null || row.publishedVersionNo === void 0 ? null : Number(row.publishedVersionNo),
        lastRunStatus: row.lastRunStatus || null,
        lastRunAt: row.lastRunAt || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapProcessingJobVersion(row) {
      return {
        id: Number(row.id),
        jobId: Number(row.jobId),
        versionNo: Number(row.versionNo),
        versionStatus: row.versionStatus || "draft",
        pipeline: parseJson(row.pipeline, { steps: [], sampleLimit: 50, scope: null, schedule: null, targetConfig: null }),
        compiledSql: row.compiledSql || null,
        summary: parseJson(row.summary, null),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapProcessingRun(row) {
      return {
        id: Number(row.id),
        jobId: Number(row.jobId),
        versionNo: Number(row.versionNo),
        runStatus: row.runStatus,
        triggerType: row.triggerType,
        previewMode: Boolean(row.previewMode),
        sourceRowCount: row.sourceRowCount === null || row.sourceRowCount === void 0 ? null : Number(row.sourceRowCount),
        outputRowCount: row.outputRowCount === null || row.outputRowCount === void 0 ? null : Number(row.outputRowCount),
        affectedRows: row.affectedRows === null || row.affectedRows === void 0 ? null : Number(row.affectedRows),
        targetTableName: row.targetTableName || null,
        durationMs: row.durationMs === null || row.durationMs === void 0 ? null : Number(row.durationMs),
        errorMessage: row.errorMessage || null,
        resultPreview: parseJson(row.resultPreview, null),
        executedSql: row.executedSql || null,
        startedAt: row.startedAt || null,
        finishedAt: row.finishedAt || null,
        createdAt: row.createdAt
      };
    }
    async function getDatasourceById(id, includePassword = false) {
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(`
    SELECT id, name, type, host, port, database_name AS databaseName, username,
           password_encrypted AS passwordEncrypted, extra_config_json AS extraConfig,
           created_at AS createdAt, updated_at AS updatedAt
    FROM dev_datasources
    WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [id, ...scoped.params]);
      return rows[0] ? mapDatasource(rows[0], includePassword) : null;
    }
    async function listDatasources() {
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(`
    SELECT id, name, type, host, port, database_name AS databaseName, username,
           password_encrypted AS passwordEncrypted, extra_config_json AS extraConfig,
           created_at AS createdAt, updated_at AS updatedAt
    FROM dev_datasources
    ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
    ORDER BY updated_at DESC, id DESC
  `, scoped.params);
      return rows.map((row) => mapDatasource(row));
    }
    async function createDatasource(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(`
    INSERT INTO dev_datasources
      (project_id, name, type, host, port, database_name, username, password_encrypted, extra_config_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        projectId,
        payload.name,
        payload.type,
        payload.host,
        payload.port,
        payload.databaseName || null,
        payload.username || null,
        payload.passwordEncrypted || null,
        JSON.stringify(payload.extraConfig || {})
      ]);
      return getDatasourceById(result.insertId);
    }
    async function updateDatasource(id, payload) {
      const fields = [
        "name = ?",
        "type = ?",
        "host = ?",
        "port = ?",
        "database_name = ?",
        "username = ?",
        "extra_config_json = ?"
      ];
      const params = [
        payload.name,
        payload.type,
        payload.host,
        payload.port,
        payload.databaseName || null,
        payload.username || null,
        JSON.stringify(payload.extraConfig || {})
      ];
      if (Object.prototype.hasOwnProperty.call(payload, "passwordEncrypted")) {
        fields.push("password_encrypted = ?");
        params.push(payload.passwordEncrypted || null);
      }
      const scoped = getScopedWhere("");
      params.push(id, ...scoped.params);
      const [result] = await pool.query(`UPDATE dev_datasources SET ${fields.join(", ")} WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`, params);
      if (!result.affectedRows) {
        return null;
      }
      return getDatasourceById(id);
    }
    async function deleteDatasource(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM dev_datasources WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    async function getProcessingJobById(id) {
      const scoped = getScopedWhere("j");
      const [rows] = await pool.query(`
    SELECT j.id, j.name, j.description, j.datasource_id AS datasourceId, d.name AS datasourceName,
           d.type AS datasourceType, j.database_name AS databaseName, j.table_name AS tableName,
           j.target_table_name AS targetTableName, j.output_mode AS outputMode, j.status,
           j.owner_name AS ownerName, j.tags_json AS tags, j.current_version_no AS currentVersionNo,
           j.published_version_no AS publishedVersionNo, j.last_run_status AS lastRunStatus,
           j.last_run_at AS lastRunAt, j.created_at AS createdAt, j.updated_at AS updatedAt
    FROM dev_processing_jobs j
    JOIN dev_datasources d ON d.id = j.datasource_id
    WHERE j.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [id, ...scoped.params]);
      return rows[0] ? mapProcessingJob(rows[0]) : null;
    }
    async function listProcessingJobs(filters = {}) {
      const clauses = [];
      const params = [];
      const scoped = getScopedWhere("j");
      if (scoped.sql) {
        clauses.push(scoped.sql);
        params.push(...scoped.params);
      }
      if (filters.datasourceId) {
        clauses.push("j.datasource_id = ?");
        params.push(Number(filters.datasourceId));
      }
      if (filters.keyword) {
        clauses.push("(j.name LIKE ? OR j.table_name LIKE ? OR j.target_table_name LIKE ?)");
        const pattern = `%${String(filters.keyword).trim()}%`;
        params.push(pattern, pattern, pattern);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const [rows] = await pool.query(`
    SELECT j.id, j.name, j.description, j.datasource_id AS datasourceId, d.name AS datasourceName,
           d.type AS datasourceType, j.database_name AS databaseName, j.table_name AS tableName,
           j.target_table_name AS targetTableName, j.output_mode AS outputMode, j.status,
           j.owner_name AS ownerName, j.tags_json AS tags, j.current_version_no AS currentVersionNo,
           j.published_version_no AS publishedVersionNo, j.last_run_status AS lastRunStatus,
           j.last_run_at AS lastRunAt, j.created_at AS createdAt, j.updated_at AS updatedAt
    FROM dev_processing_jobs j
    JOIN dev_datasources d ON d.id = j.datasource_id
    ${where}
    ORDER BY j.updated_at DESC, j.id DESC
  `, params);
      return rows.map(mapProcessingJob);
    }
    async function createProcessingJob(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(`
    INSERT INTO dev_processing_jobs
      (project_id, name, description, datasource_id, database_name, table_name, target_table_name, output_mode, status, owner_name, tags_json, current_version_no)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `, [
        projectId,
        payload.name,
        payload.description || null,
        payload.datasourceId,
        payload.databaseName || null,
        payload.tableName,
        payload.targetTableName || null,
        payload.outputMode || "new_table",
        payload.status || "draft",
        payload.ownerName || null,
        JSON.stringify(payload.tags || [])
      ]);
      return getProcessingJobById(result.insertId);
    }
    async function updateProcessingJob(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(`
    UPDATE dev_processing_jobs
    SET name = ?, description = ?, datasource_id = ?, database_name = ?, table_name = ?,
        target_table_name = ?, output_mode = ?, status = ?, owner_name = ?, tags_json = ?
    WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [
        payload.name,
        payload.description || null,
        payload.datasourceId,
        payload.databaseName || null,
        payload.tableName,
        payload.targetTableName || null,
        payload.outputMode || "new_table",
        payload.status || "draft",
        payload.ownerName || null,
        JSON.stringify(payload.tags || []),
        id,
        ...scoped.params
      ]);
      if (!result.affectedRows) {
        return null;
      }
      return getProcessingJobById(id);
    }
    async function deleteProcessingJob(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM dev_processing_jobs WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    async function getProcessingJobVersion(jobId, versionNo) {
      const [rows] = await pool.query(`
    SELECT id, job_id AS jobId, version_no AS versionNo, version_status AS versionStatus,
           pipeline_json AS pipeline, compiled_sql AS compiledSql, summary_json AS summary,
           created_at AS createdAt, updated_at AS updatedAt
    FROM dev_processing_job_versions
    WHERE job_id = ? AND version_no = ?
  `, [jobId, versionNo]);
      return rows[0] ? mapProcessingJobVersion(rows[0]) : null;
    }
    async function getLatestProcessingJobVersion(jobId) {
      const [rows] = await pool.query(`
    SELECT id, job_id AS jobId, version_no AS versionNo, version_status AS versionStatus,
           pipeline_json AS pipeline, compiled_sql AS compiledSql, summary_json AS summary,
           created_at AS createdAt, updated_at AS updatedAt
    FROM dev_processing_job_versions
    WHERE job_id = ?
    ORDER BY version_no DESC
    LIMIT 1
  `, [jobId]);
      return rows[0] ? mapProcessingJobVersion(rows[0]) : null;
    }
    async function upsertProcessingJobVersion(jobId, versionNo, payload) {
      const existing = await getProcessingJobVersion(jobId, versionNo);
      if (existing) {
        await pool.query(`
      UPDATE dev_processing_job_versions
      SET version_status = ?, pipeline_json = ?, compiled_sql = ?, summary_json = ?
      WHERE job_id = ? AND version_no = ?
    `, [
          payload.versionStatus || "draft",
          JSON.stringify(payload.pipeline || { steps: [], sampleLimit: 50, scope: null, schedule: null, targetConfig: null }),
          payload.compiledSql || null,
          JSON.stringify(payload.summary || null),
          jobId,
          versionNo
        ]);
        return getProcessingJobVersion(jobId, versionNo);
      }
      const [result] = await pool.query(`
    INSERT INTO dev_processing_job_versions
      (job_id, version_no, version_status, pipeline_json, compiled_sql, summary_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
        jobId,
        versionNo,
        payload.versionStatus || "draft",
        JSON.stringify(payload.pipeline || { steps: [], sampleLimit: 50, scope: null, schedule: null, targetConfig: null }),
        payload.compiledSql || null,
        JSON.stringify(payload.summary || null)
      ]);
      const [rows] = await pool.query(`
    SELECT id, job_id AS jobId, version_no AS versionNo, version_status AS versionStatus,
           pipeline_json AS pipeline, compiled_sql AS compiledSql, summary_json AS summary,
           created_at AS createdAt, updated_at AS updatedAt
    FROM dev_processing_job_versions
    WHERE id = ?
  `, [result.insertId]);
      return rows[0] ? mapProcessingJobVersion(rows[0]) : null;
    }
    async function updateProcessingJobVersionPointers(jobId, payload) {
      const fields = [];
      const params = [];
      if (Object.prototype.hasOwnProperty.call(payload, "currentVersionNo")) {
        fields.push("current_version_no = ?");
        params.push(payload.currentVersionNo);
      }
      if (Object.prototype.hasOwnProperty.call(payload, "publishedVersionNo")) {
        fields.push("published_version_no = ?");
        params.push(payload.publishedVersionNo);
      }
      if (Object.prototype.hasOwnProperty.call(payload, "status")) {
        fields.push("status = ?");
        params.push(payload.status);
      }
      if (Object.prototype.hasOwnProperty.call(payload, "lastRunStatus")) {
        fields.push("last_run_status = ?");
        params.push(payload.lastRunStatus);
      }
      if (Object.prototype.hasOwnProperty.call(payload, "lastRunAt")) {
        fields.push("last_run_at = ?");
        params.push(payload.lastRunAt);
      }
      if (!fields.length) {
        return getProcessingJobById(jobId);
      }
      params.push(jobId);
      await pool.query(`UPDATE dev_processing_jobs SET ${fields.join(", ")} WHERE id = ?`, params);
      return getProcessingJobById(jobId);
    }
    async function createProcessingRun(payload) {
      const [result] = await pool.query(`
    INSERT INTO dev_processing_runs
      (job_id, version_no, run_status, trigger_type, preview_mode, source_row_count, output_row_count,
       affected_rows, target_table_name, duration_ms, error_message, result_preview_json, executed_sql,
       started_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        payload.jobId,
        payload.versionNo,
        payload.runStatus || "pending",
        payload.triggerType || "manual",
        payload.previewMode ? 1 : 0,
        payload.sourceRowCount ?? null,
        payload.outputRowCount ?? null,
        payload.affectedRows ?? null,
        payload.targetTableName || null,
        payload.durationMs ?? null,
        payload.errorMessage || null,
        JSON.stringify(payload.resultPreview || null),
        payload.executedSql || null,
        payload.startedAt || null,
        payload.finishedAt || null
      ]);
      return getProcessingRunById(result.insertId);
    }
    async function updateProcessingRun(id, payload) {
      await pool.query(`
    UPDATE dev_processing_runs
    SET run_status = ?, source_row_count = ?, output_row_count = ?, affected_rows = ?, target_table_name = ?,
        duration_ms = ?, error_message = ?, result_preview_json = ?, executed_sql = ?, started_at = ?, finished_at = ?
    WHERE id = ?
  `, [
        payload.runStatus,
        payload.sourceRowCount ?? null,
        payload.outputRowCount ?? null,
        payload.affectedRows ?? null,
        payload.targetTableName || null,
        payload.durationMs ?? null,
        payload.errorMessage || null,
        JSON.stringify(payload.resultPreview || null),
        payload.executedSql || null,
        payload.startedAt || null,
        payload.finishedAt || null,
        id
      ]);
      return getProcessingRunById(id);
    }
    async function getProcessingRunById(id) {
      const [rows] = await pool.query(`
    SELECT id, job_id AS jobId, version_no AS versionNo, run_status AS runStatus,
           trigger_type AS triggerType, preview_mode AS previewMode, source_row_count AS sourceRowCount,
           output_row_count AS outputRowCount, affected_rows AS affectedRows, target_table_name AS targetTableName,
           duration_ms AS durationMs, error_message AS errorMessage, result_preview_json AS resultPreview,
           executed_sql AS executedSql, started_at AS startedAt, finished_at AS finishedAt, created_at AS createdAt
    FROM dev_processing_runs
    WHERE id = ?
  `, [id]);
      return rows[0] ? mapProcessingRun(rows[0]) : null;
    }
    async function listProcessingRuns(jobId) {
      const [rows] = await pool.query(`
    SELECT id, job_id AS jobId, version_no AS versionNo, run_status AS runStatus,
           trigger_type AS triggerType, preview_mode AS previewMode, source_row_count AS sourceRowCount,
           output_row_count AS outputRowCount, affected_rows AS affectedRows, target_table_name AS targetTableName,
           duration_ms AS durationMs, error_message AS errorMessage, result_preview_json AS resultPreview,
           executed_sql AS executedSql, started_at AS startedAt, finished_at AS finishedAt, created_at AS createdAt
    FROM dev_processing_runs
    WHERE job_id = ?
    ORDER BY id DESC
  `, [jobId]);
      return rows.map(mapProcessingRun);
    }
    async function listScriptFolders() {
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(`
    SELECT id, name, parent_id AS parentId, created_at AS createdAt
    FROM dev_script_folders
    ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
    ORDER BY parent_id ASC, id ASC
  `, scoped.params);
      return rows.map(mapScriptFolder);
    }
    async function createScriptFolder(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(`
    INSERT INTO dev_script_folders (project_id, name, parent_id)
    VALUES (?, ?, ?)
  `, [projectId, payload.name, payload.parentId || null]);
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(`
    SELECT id, name, parent_id AS parentId, created_at AS createdAt
    FROM dev_script_folders WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [result.insertId, ...scoped.params]);
      return mapScriptFolder(rows[0]);
    }
    async function updateScriptFolder(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(`
    UPDATE dev_script_folders
    SET name = ?, parent_id = ?
    WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [payload.name, payload.parentId || null, id, ...scoped.params]);
      if (!result.affectedRows) {
        return null;
      }
      const [rows] = await pool.query(`
    SELECT id, name, parent_id AS parentId, created_at AS createdAt
    FROM dev_script_folders WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [id, ...scoped.params]);
      return mapScriptFolder(rows[0]);
    }
    async function deleteScriptFolder(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM dev_script_folders WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    async function getScriptById(id) {
      const scoped = getScopedWhere("s");
      const [rows] = await pool.query(`
    SELECT s.id, s.name, s.folder_id AS folderId, s.datasource_id AS datasourceId,
           ds.name AS datasourceName, ds.type AS datasourceType,
           s.default_database AS defaultDatabase, s.description,
           s.tags_json AS tags, s.content, s.current_version AS currentVersion,
           s.created_at AS createdAt, s.updated_at AS updatedAt
    FROM dev_sql_scripts s
    JOIN dev_datasources ds ON ds.id = s.datasource_id
    WHERE s.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [id, ...scoped.params]);
      return rows[0] ? mapScript(rows[0]) : null;
    }
    async function listScripts(filters = {}) {
      const where = [];
      const params = [];
      const scoped = getScopedWhere("s");
      if (scoped.sql) {
        where.push(scoped.sql);
        params.push(...scoped.params);
      }
      if (filters.folderId !== void 0 && filters.folderId !== null && filters.folderId !== "") {
        where.push("s.folder_id = ?");
        params.push(Number(filters.folderId));
      }
      if (filters.keyword) {
        where.push("(s.name LIKE ? OR s.description LIKE ? OR s.content LIKE ?)");
        params.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`);
      }
      const [rows] = await pool.query(`
    SELECT s.id, s.name, s.folder_id AS folderId, s.datasource_id AS datasourceId,
           ds.name AS datasourceName, ds.type AS datasourceType,
           s.default_database AS defaultDatabase, s.description,
           s.tags_json AS tags, s.content, s.current_version AS currentVersion,
           s.created_at AS createdAt, s.updated_at AS updatedAt
    FROM dev_sql_scripts s
    JOIN dev_datasources ds ON ds.id = s.datasource_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY s.updated_at DESC, s.id DESC
  `, params);
      return rows.map(mapScript);
    }
    async function createScript(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(`
    INSERT INTO dev_sql_scripts
      (project_id, name, folder_id, datasource_id, default_database, description, tags_json, content, current_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        projectId,
        payload.name,
        payload.folderId || null,
        payload.datasourceId,
        payload.defaultDatabase || null,
        payload.description || null,
        JSON.stringify(payload.tags || []),
        payload.content,
        payload.currentVersion || 1
      ]);
      return getScriptById(result.insertId);
    }
    async function updateScript(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(`
    UPDATE dev_sql_scripts
    SET name = ?, folder_id = ?, datasource_id = ?, default_database = ?, description = ?,
        tags_json = ?, content = ?, current_version = ?
    WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [
        payload.name,
        payload.folderId || null,
        payload.datasourceId,
        payload.defaultDatabase || null,
        payload.description || null,
        JSON.stringify(payload.tags || []),
        payload.content,
        payload.currentVersion,
        id,
        ...scoped.params
      ]);
      if (!result.affectedRows) {
        return null;
      }
      return getScriptById(id);
    }
    async function deleteScript(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM dev_sql_scripts WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    async function createScriptVersion(scriptId, versionNo, content) {
      const [result] = await pool.query(`
    INSERT INTO dev_script_versions (script_id, version_no, content)
    VALUES (?, ?, ?)
  `, [scriptId, versionNo, content]);
      const [rows] = await pool.query(`
    SELECT id, script_id AS scriptId, version_no AS versionNo, content, created_at AS createdAt
    FROM dev_script_versions
    WHERE id = ?
  `, [result.insertId]);
      return mapScriptVersion(rows[0]);
    }
    async function listScriptVersions(scriptId) {
      const [rows] = await pool.query(`
    SELECT id, script_id AS scriptId, version_no AS versionNo, content, created_at AS createdAt
    FROM dev_script_versions
    WHERE script_id = ?
    ORDER BY version_no DESC
  `, [scriptId]);
      return rows.map(mapScriptVersion);
    }
    async function createQueryHistory(payload) {
      const [result] = await pool.query(`
    INSERT INTO dev_query_history
      (datasource_id, script_id, sql_text, database_name, status, duration_ms, error_message, result_preview_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        payload.datasourceId,
        payload.scriptId || null,
        payload.sqlText,
        payload.databaseName || null,
        payload.status,
        payload.durationMs || 0,
        payload.errorMessage || null,
        payload.resultPreview ? JSON.stringify(payload.resultPreview) : null
      ]);
      const [rows] = await pool.query(`
    SELECT h.id, h.datasource_id AS datasourceId, ds.name AS datasourceName,
           h.script_id AS scriptId, s.name AS scriptName,
           h.sql_text AS sqlText, h.database_name AS databaseName, h.status,
           h.duration_ms AS durationMs, h.error_message AS errorMessage,
           h.result_preview_json AS resultPreview, h.executed_at AS executedAt
    FROM dev_query_history h
    JOIN dev_datasources ds ON ds.id = h.datasource_id
    LEFT JOIN dev_sql_scripts s ON s.id = h.script_id
    WHERE h.id = ?${getScopedWhere("ds").sql ? ` AND ${getScopedWhere("ds").sql}` : ""}
  `, [result.insertId, ...getScopedWhere("ds").params]);
      return mapQueryHistory(rows[0]);
    }
    async function listQueryHistory(filters = {}) {
      const where = [];
      const params = [];
      const scoped = getScopedWhere("ds");
      if (scoped.sql) {
        where.push(scoped.sql);
        params.push(...scoped.params);
      }
      if (filters.datasourceId) {
        where.push("h.datasource_id = ?");
        params.push(Number(filters.datasourceId));
      }
      if (filters.scriptId) {
        where.push("h.script_id = ?");
        params.push(Number(filters.scriptId));
      }
      const limit = Math.max(1, Math.min(200, Number(filters.limit || 50)));
      params.push(limit);
      const [rows] = await pool.query(`
    SELECT h.id, h.datasource_id AS datasourceId, ds.name AS datasourceName,
           h.script_id AS scriptId, s.name AS scriptName,
           h.sql_text AS sqlText, h.database_name AS databaseName, h.status,
           h.duration_ms AS durationMs, h.error_message AS errorMessage,
           h.result_preview_json AS resultPreview, h.executed_at AS executedAt
    FROM dev_query_history h
    JOIN dev_datasources ds ON ds.id = h.datasource_id
    LEFT JOIN dev_sql_scripts s ON s.id = h.script_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY h.executed_at DESC, h.id DESC
    LIMIT ?
  `, params);
      return rows.map(mapQueryHistory);
    }
    async function getQueryHistoryById(id) {
      const scoped = getScopedWhere("ds");
      const [rows] = await pool.query(`
    SELECT h.id, h.datasource_id AS datasourceId, ds.name AS datasourceName,
           h.script_id AS scriptId, s.name AS scriptName,
           h.sql_text AS sqlText, h.database_name AS databaseName, h.status,
           h.duration_ms AS durationMs, h.error_message AS errorMessage,
           h.result_preview_json AS resultPreview, h.executed_at AS executedAt
    FROM dev_query_history h
    JOIN dev_datasources ds ON ds.id = h.datasource_id
    LEFT JOIN dev_sql_scripts s ON s.id = h.script_id
    WHERE h.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
    LIMIT 1
  `, [Number(id), ...scoped.params]);
      return rows[0] ? mapQueryHistory(rows[0]) : null;
    }
    async function createCopilotSession(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(`
    INSERT INTO dev_sql_copilot_sessions
      (project_id, user_id, datasource_id, database_name, session_title, status, last_message_at)
    VALUES (?, ?, ?, ?, ?, 'active', NOW())
  `, [
        projectId,
        Number(payload.userId),
        Number(payload.datasourceId),
        payload.databaseName || null,
        payload.sessionTitle || null
      ]);
      return getCopilotSessionById(result.insertId, payload.userId);
    }
    async function getCopilotSessionById(id, userId) {
      const projectId = getCurrentProjectId();
      const [rows] = await pool.query(`
    SELECT s.id, s.project_id AS projectId, s.user_id AS userId,
           s.datasource_id AS datasourceId, ds.name AS datasourceName,
           s.database_name AS databaseName, s.session_title AS sessionTitle,
           s.status, s.last_message_at AS lastMessageAt,
           s.created_at AS createdAt, s.updated_at AS updatedAt
    FROM dev_sql_copilot_sessions s
    JOIN dev_datasources ds ON ds.id = s.datasource_id
    WHERE s.id = ? AND s.project_id = ? AND s.user_id = ?
    LIMIT 1
  `, [Number(id), projectId, Number(userId)]);
      return rows[0] ? mapCopilotSession(rows[0]) : null;
    }
    async function listCopilotSessions(userId, limit = 30) {
      const projectId = getCurrentProjectId();
      const safeLimit = Math.max(1, Math.min(100, Number(limit || 30)));
      const [rows] = await pool.query(`
    SELECT s.id, s.project_id AS projectId, s.user_id AS userId,
           s.datasource_id AS datasourceId, ds.name AS datasourceName,
           s.database_name AS databaseName, s.session_title AS sessionTitle,
           s.status, s.last_message_at AS lastMessageAt,
           s.created_at AS createdAt, s.updated_at AS updatedAt,
           COUNT(m.id) AS messageCount,
           SUBSTRING_INDEX(GROUP_CONCAT(m.message_text ORDER BY m.id DESC SEPARATOR '
'), '
', 1) AS lastPreview
    FROM dev_sql_copilot_sessions s
    JOIN dev_datasources ds ON ds.id = s.datasource_id
    LEFT JOIN dev_sql_copilot_messages m ON m.session_id = s.id
    WHERE s.project_id = ? AND s.user_id = ?
    GROUP BY s.id
    ORDER BY COALESCE(s.last_message_at, s.updated_at, s.created_at) DESC, s.id DESC
    LIMIT ?
  `, [projectId, Number(userId), safeLimit]);
      return rows.map(mapCopilotSession);
    }
    async function touchCopilotSession(id, userId, payload = {}) {
      const projectId = getCurrentProjectId();
      await pool.query(`
    UPDATE dev_sql_copilot_sessions
    SET session_title = COALESCE(?, session_title),
        datasource_id = COALESCE(?, datasource_id),
        database_name = COALESCE(?, database_name),
        last_message_at = NOW()
    WHERE id = ? AND project_id = ? AND user_id = ?
  `, [
        payload.sessionTitle || null,
        payload.datasourceId || null,
        payload.databaseName || null,
        Number(id),
        projectId,
        Number(userId)
      ]);
      return getCopilotSessionById(id, userId);
    }
    async function createCopilotMessage(payload) {
      const [result] = await pool.query(`
    INSERT INTO dev_sql_copilot_messages
      (session_id, role, task_type, message_text, payload_json, context_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
        Number(payload.sessionId),
        payload.role,
        payload.taskType || null,
        payload.messageText,
        payload.payload ? JSON.stringify(payload.payload) : null,
        payload.context ? JSON.stringify(payload.context) : null
      ]);
      const [rows] = await pool.query(`
    SELECT id, session_id AS sessionId, role, task_type AS taskType,
           message_text AS messageText, payload_json AS payload,
           context_json AS context, created_at AS createdAt
    FROM dev_sql_copilot_messages
    WHERE id = ?
  `, [result.insertId]);
      return mapCopilotMessage(rows[0]);
    }
    async function listCopilotMessages(sessionId, userId, limit = 100) {
      const session = await getCopilotSessionById(sessionId, userId);
      if (!session) return [];
      const safeLimit = Math.max(1, Math.min(200, Number(limit || 100)));
      const [rows] = await pool.query(`
    SELECT id, session_id AS sessionId, role, task_type AS taskType,
           message_text AS messageText, payload_json AS payload,
           context_json AS context, created_at AS createdAt
    FROM dev_sql_copilot_messages
    WHERE session_id = ?
    ORDER BY id ASC
    LIMIT ?
  `, [Number(sessionId), safeLimit]);
      return rows.map(mapCopilotMessage);
    }
    async function getWorkflowById(id) {
      const scoped = getScopedWhere("");
      const [workflowRows] = await pool.query(`
    SELECT id, project_id AS projectId, name, description, cron_expr AS cronExpr, is_paused AS isPaused,
           retry_times AS retryTimes, timeout_sec AS timeoutSec,
           published_version_no AS publishedVersionNo,
           runtime_config_json AS runtimeConfig, created_at AS createdAt, updated_at AS updatedAt
    FROM dev_workflows
    WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [id, ...scoped.params]);
      if (!workflowRows[0]) {
        return null;
      }
      const workflow = mapWorkflow(workflowRows[0]);
      const [nodeRows] = await pool.query(`
    SELECT n.id, n.workflow_id AS workflowId, n.node_type AS nodeType, n.script_id AS scriptId, s.name AS scriptName,
           n.processing_job_id AS processingJobId, pj.name AS processingJobName,
           n.orchestration_task_id AS orchestrationTaskId, ot.name AS orchestrationTaskName,
           s.datasource_id AS datasourceId, ds.name AS datasourceName,
           n.node_key AS nodeKey, n.node_name AS nodeName, n.position_x AS positionX,
           n.position_y AS positionY, n.width, n.height, n.retry_times AS retryTimes,
           n.retry_interval_sec AS retryIntervalSec, n.timeout_sec AS timeoutSec,
           n.trigger_rule AS triggerRule, n.node_config_json AS nodeConfig,
           n.created_at AS createdAt, n.updated_at AS updatedAt
    FROM dev_workflow_nodes n
    LEFT JOIN dev_sql_scripts s ON s.id = n.script_id
    LEFT JOIN dev_datasources ds ON ds.id = s.datasource_id
    LEFT JOIN dev_processing_jobs pj ON pj.id = n.processing_job_id
    LEFT JOIN dev_orchestration_tasks ot ON ot.id = n.orchestration_task_id
    WHERE n.workflow_id = ? AND n.is_archived = 0
    ORDER BY n.id ASC
  `, [id]);
      const [edgeRows] = await pool.query(`
    SELECT id, workflow_id AS workflowId, source_node_key AS sourceNodeKey,
           target_node_key AS targetNodeKey, edge_type AS edgeType, edge_label AS edgeLabel, created_at AS createdAt
    FROM dev_workflow_edges
    WHERE workflow_id = ?
    ORDER BY id ASC
  `, [id]);
      return {
        ...workflow,
        nodes: nodeRows.map(mapWorkflowNode),
        edges: edgeRows.map(mapWorkflowEdge)
      };
    }
    async function listWorkflows() {
      const scoped = getScopedWhere("w");
      const [rows] = await pool.query(`
    SELECT w.id, w.project_id AS projectId, w.name, w.description, w.cron_expr AS cronExpr, w.is_paused AS isPaused,
           w.retry_times AS retryTimes, w.timeout_sec AS timeoutSec,
           w.published_version_no AS publishedVersionNo,
           w.runtime_config_json AS runtimeConfig, w.created_at AS createdAt, w.updated_at AS updatedAt,
           COUNT(DISTINCT n.id) AS nodeCount
    FROM dev_workflows w
    LEFT JOIN dev_workflow_nodes n ON n.workflow_id = w.id AND n.is_archived = 0
    ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
    GROUP BY w.id, w.project_id, w.name, w.description, w.cron_expr, w.is_paused, w.retry_times, w.timeout_sec,
             w.published_version_no, w.runtime_config_json, w.created_at, w.updated_at
    ORDER BY w.updated_at DESC, w.id DESC
  `, scoped.params);
      return rows.map((row) => ({
        ...mapWorkflow(row),
        nodeCount: Number(row.nodeCount || 0)
      }));
    }
    async function getOrchestrationTaskById(id) {
      const scoped = getScopedWhere("t");
      const [taskRows] = await pool.query(`
    SELECT t.id, t.name, t.description, t.datasource_id AS datasourceId, ds.name AS datasourceName, ds.type AS datasourceType,
           t.database_name AS databaseName, t.cron_expr AS cronExpr, t.is_paused AS isPaused,
           t.retry_times AS retryTimes, t.timeout_sec AS timeoutSec, t.runtime_config_json AS runtimeConfig,
           t.created_at AS createdAt, t.updated_at AS updatedAt
    FROM dev_orchestration_tasks t
    LEFT JOIN dev_datasources ds ON ds.id = t.datasource_id
    WHERE t.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [id, ...scoped.params]);
      if (!taskRows[0]) {
        return null;
      }
      const task = mapOrchestrationTask(taskRows[0]);
      const [nodeRows] = await pool.query(`
    SELECT id, task_id AS taskId, node_type AS nodeType, operator_code AS operatorCode,
           node_key AS nodeKey, node_name AS nodeName, position_x AS positionX, position_y AS positionY,
           width, height, node_config_json AS nodeConfig, created_at AS createdAt, updated_at AS updatedAt
    FROM dev_orchestration_nodes
    WHERE task_id = ?
    ORDER BY id ASC
  `, [id]);
      const [edgeRows] = await pool.query(`
    SELECT id, task_id AS taskId, source_node_key AS sourceNodeKey, source_port AS sourcePort,
           target_node_key AS targetNodeKey, target_port AS targetPort, edge_type AS edgeType,
           edge_status AS edgeStatus, created_at AS createdAt
    FROM dev_orchestration_edges
    WHERE task_id = ?
    ORDER BY id ASC
  `, [id]);
      return {
        ...task,
        nodes: nodeRows.map(mapOrchestrationNode),
        edges: edgeRows.map(mapOrchestrationEdge)
      };
    }
    async function listOrchestrationTasks() {
      const scoped = getScopedWhere("t");
      const [rows] = await pool.query(`
    SELECT t.id, t.name, t.description, t.datasource_id AS datasourceId, ds.name AS datasourceName, ds.type AS datasourceType,
           t.database_name AS databaseName, t.cron_expr AS cronExpr, t.is_paused AS isPaused,
           t.retry_times AS retryTimes, t.timeout_sec AS timeoutSec, t.runtime_config_json AS runtimeConfig,
           t.created_at AS createdAt, t.updated_at AS updatedAt, COUNT(DISTINCT n.id) AS nodeCount
    FROM dev_orchestration_tasks t
    LEFT JOIN dev_datasources ds ON ds.id = t.datasource_id
    LEFT JOIN dev_orchestration_nodes n ON n.task_id = t.id
    ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
    GROUP BY t.id, t.name, t.description, t.datasource_id, ds.name, ds.type, t.database_name, t.cron_expr, t.is_paused,
             t.retry_times, t.timeout_sec, t.runtime_config_json, t.created_at, t.updated_at
    ORDER BY t.updated_at DESC, t.id DESC
  `, scoped.params);
      return rows.map((row) => ({
        ...mapOrchestrationTask(row),
        nodeCount: Number(row.nodeCount || 0)
      }));
    }
    async function createOrchestrationTask(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(`
    INSERT INTO dev_orchestration_tasks
      (project_id, name, description, datasource_id, database_name, cron_expr, is_paused, retry_times, timeout_sec, runtime_config_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        projectId,
        payload.name,
        payload.description || null,
        payload.datasourceId || null,
        payload.databaseName || null,
        payload.cronExpr || null,
        payload.isPaused ? 1 : 0,
        payload.retryTimes || 0,
        payload.timeoutSec || 300,
        JSON.stringify(payload.runtimeConfig || {})
      ]);
      return getOrchestrationTaskById(result.insertId);
    }
    async function updateOrchestrationTask(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(`
    UPDATE dev_orchestration_tasks
    SET name = ?, description = ?, datasource_id = ?, database_name = ?, cron_expr = ?, is_paused = ?, retry_times = ?, timeout_sec = ?, runtime_config_json = ?
    WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [
        payload.name,
        payload.description || null,
        payload.datasourceId || null,
        payload.databaseName || null,
        payload.cronExpr || null,
        payload.isPaused ? 1 : 0,
        payload.retryTimes || 0,
        payload.timeoutSec || 300,
        JSON.stringify(payload.runtimeConfig || {}),
        id,
        ...scoped.params
      ]);
      if (!result.affectedRows) {
        return null;
      }
      return getOrchestrationTaskById(id);
    }
    async function deleteOrchestrationTask(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM dev_orchestration_tasks WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    async function replaceOrchestrationGraph(taskId, nodes, edges) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query("DELETE FROM dev_orchestration_edges WHERE task_id = ?", [taskId]);
        await connection.query("DELETE FROM dev_orchestration_nodes WHERE task_id = ?", [taskId]);
        for (const node of nodes) {
          await connection.query(`
        INSERT INTO dev_orchestration_nodes
          (task_id, node_type, operator_code, node_key, node_name, position_x, position_y, width, height, node_config_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
            taskId,
            node.nodeType || "operator",
            node.operatorCode,
            node.nodeKey,
            node.nodeName,
            node.positionX || 0,
            node.positionY || 0,
            node.width || 260,
            node.height || 108,
            JSON.stringify(node.nodeConfig || {})
          ]);
        }
        for (const edge of edges) {
          await connection.query(`
        INSERT INTO dev_orchestration_edges
          (task_id, source_node_key, source_port, target_node_key, target_port, edge_type, edge_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
            taskId,
            edge.sourceNodeKey,
            edge.sourcePort || null,
            edge.targetNodeKey,
            edge.targetPort || null,
            edge.edgeType || "default",
            edge.edgeStatus || "active"
          ]);
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return getOrchestrationTaskById(taskId);
    }
    async function createWorkflow(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(`
    INSERT INTO dev_workflows
      (project_id, name, description, cron_expr, is_paused, retry_times, timeout_sec, runtime_config_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        projectId,
        payload.name,
        payload.description || null,
        payload.cronExpr || null,
        payload.isPaused ? 1 : 0,
        payload.retryTimes || 0,
        payload.timeoutSec || 300,
        JSON.stringify(payload.runtimeConfig || {})
      ]);
      return getWorkflowById(result.insertId);
    }
    async function updateWorkflow(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(`
    UPDATE dev_workflows
    SET name = ?, description = ?, cron_expr = ?, is_paused = ?, retry_times = ?, timeout_sec = ?, runtime_config_json = ?
    WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [
        payload.name,
        payload.description || null,
        payload.cronExpr || null,
        payload.isPaused ? 1 : 0,
        payload.retryTimes || 0,
        payload.timeoutSec || 300,
        JSON.stringify(payload.runtimeConfig || {}),
        id,
        ...scoped.params
      ]);
      if (!result.affectedRows) {
        return null;
      }
      return getWorkflowById(id);
    }
    async function deleteWorkflow(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM dev_workflows WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    async function replaceWorkflowGraph(workflowId, nodes, edges) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query("DELETE FROM dev_workflow_edges WHERE workflow_id = ?", [workflowId]);
        await connection.query("UPDATE dev_workflow_nodes SET is_archived = 1 WHERE workflow_id = ?", [workflowId]);
        for (const node of nodes) {
          await connection.query(`
        INSERT INTO dev_workflow_nodes
          (workflow_id, node_type, script_id, processing_job_id, orchestration_task_id,
           node_key, node_name, position_x, position_y, width, height, retry_times,
           retry_interval_sec, timeout_sec, trigger_rule, is_archived, node_config_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        ON DUPLICATE KEY UPDATE
          node_type = VALUES(node_type), script_id = VALUES(script_id),
          processing_job_id = VALUES(processing_job_id), orchestration_task_id = VALUES(orchestration_task_id),
          node_name = VALUES(node_name), position_x = VALUES(position_x), position_y = VALUES(position_y),
          width = VALUES(width), height = VALUES(height), retry_times = VALUES(retry_times),
          retry_interval_sec = VALUES(retry_interval_sec), timeout_sec = VALUES(timeout_sec),
          trigger_rule = VALUES(trigger_rule), is_archived = 0, node_config_json = VALUES(node_config_json)
      `, [
            workflowId,
            node.nodeType || "script",
            node.scriptId || null,
            node.processingJobId || null,
            node.orchestrationTaskId || null,
            node.nodeKey,
            node.nodeName,
            node.positionX || 0,
            node.positionY || 0,
            node.width || 240,
            node.height || 88,
            node.retryTimes === void 0 ? null : node.retryTimes,
            node.retryIntervalSec ?? 5,
            node.timeoutSec === void 0 ? null : node.timeoutSec,
            node.triggerRule || "all_success",
            JSON.stringify(node.nodeConfig || {})
          ]);
        }
        for (const edge of edges) {
          await connection.query(`
        INSERT INTO dev_workflow_edges (workflow_id, source_node_key, target_node_key, edge_type, edge_label)
        VALUES (?, ?, ?, ?, ?)
      `, [workflowId, edge.sourceNodeKey, edge.targetNodeKey, edge.edgeType || "default", edge.edgeLabel || "default"]);
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return getWorkflowById(workflowId);
    }
    async function createWorkflowVersion(workflowId, versionNo, graphSnapshot, validation) {
      const [result] = await pool.query(`
    INSERT INTO dev_workflow_versions (workflow_id, version_no, graph_snapshot_json, validation_json)
    VALUES (?, ?, ?, ?)
  `, [workflowId, versionNo, JSON.stringify(graphSnapshot), validation ? JSON.stringify(validation) : null]);
      const [rows] = await pool.query(`
    SELECT id, workflow_id AS workflowId, version_no AS versionNo,
           graph_snapshot_json AS graphSnapshot, validation_json AS validation, created_at AS createdAt
    FROM dev_workflow_versions
    WHERE id = ?
  `, [result.insertId]);
      return mapWorkflowVersion(rows[0]);
    }
    async function getWorkflowVersion(workflowId, versionNo) {
      const [rows] = await pool.query(`
    SELECT id, workflow_id AS workflowId, version_no AS versionNo,
           graph_snapshot_json AS graphSnapshot, validation_json AS validation, created_at AS createdAt
    FROM dev_workflow_versions
    WHERE workflow_id = ? AND version_no = ?
    LIMIT 1
  `, [workflowId, versionNo]);
      return rows[0] ? mapWorkflowVersion(rows[0]) : null;
    }
    async function getLatestWorkflowVersion(workflowId) {
      const [rows] = await pool.query(`
    SELECT id, workflow_id AS workflowId, version_no AS versionNo,
           graph_snapshot_json AS graphSnapshot, validation_json AS validation, created_at AS createdAt
    FROM dev_workflow_versions
    WHERE workflow_id = ?
    ORDER BY version_no DESC
    LIMIT 1
  `, [workflowId]);
      return rows[0] ? mapWorkflowVersion(rows[0]) : null;
    }
    async function getPublishedWorkflowVersion(workflowId) {
      const workflow = await getWorkflowById(workflowId);
      if (!workflow?.publishedVersionNo) return null;
      return getWorkflowVersion(workflowId, workflow.publishedVersionNo);
    }
    async function updateWorkflowPublishedVersion(workflowId, versionNo) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(`
    UPDATE dev_workflows
    SET published_version_no = ?
    WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [versionNo, workflowId, ...scoped.params]);
      return result.affectedRows > 0;
    }
    async function createWorkflowRun(payload) {
      const [result] = await pool.query(`
    INSERT INTO dev_workflow_runs
      (workflow_id, trigger_type, status, run_params_json, workflow_version_no, graph_snapshot_json,
       workflow_retry_count, scheduled_at, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        payload.workflowId,
        payload.triggerType || "manual",
        payload.status || "pending",
        JSON.stringify(payload.runParams || {}),
        payload.workflowVersionNo || null,
        payload.graphSnapshot ? JSON.stringify(payload.graphSnapshot) : null,
        payload.workflowRetryCount || 0,
        payload.scheduledAt || null,
        payload.startedAt || null
      ]);
      return getWorkflowRunById(result.insertId);
    }
    async function getWorkflowRunById(id) {
      const [rows] = await pool.query(`
    SELECT r.id, r.workflow_id AS workflowId, w.name AS workflowName, r.trigger_type AS triggerType,
           r.status, r.run_params_json AS runParams, r.workflow_version_no AS workflowVersionNo,
           r.graph_snapshot_json AS graphSnapshot, r.workflow_retry_count AS workflowRetryCount,
           r.scheduled_at AS scheduledAt, r.started_at AS startedAt, r.finished_at AS finishedAt,
           r.duration_ms AS durationMs, r.error_message AS errorMessage, r.created_at AS createdAt
    FROM dev_workflow_runs r
    JOIN dev_workflows w ON w.id = r.workflow_id
    WHERE r.id = ?
  `, [id]);
      return rows[0] ? mapWorkflowRun(rows[0]) : null;
    }
    async function updateWorkflowRun(id, payload) {
      const [result] = await pool.query(`
    UPDATE dev_workflow_runs
    SET status = ?, started_at = ?, finished_at = ?, duration_ms = ?, error_message = ?, workflow_retry_count = ?
    WHERE id = ?
  `, [
        payload.status,
        payload.startedAt || null,
        payload.finishedAt || null,
        payload.durationMs === void 0 ? null : payload.durationMs,
        payload.errorMessage || null,
        payload.workflowRetryCount || 0,
        id
      ]);
      if (!result.affectedRows) {
        return null;
      }
      return getWorkflowRunById(id);
    }
    async function listWorkflowRuns(workflowId) {
      const [rows] = await pool.query(`
    SELECT r.id, r.workflow_id AS workflowId, w.name AS workflowName, r.trigger_type AS triggerType,
           r.status, r.run_params_json AS runParams, r.workflow_version_no AS workflowVersionNo,
           r.graph_snapshot_json AS graphSnapshot, r.workflow_retry_count AS workflowRetryCount,
           r.scheduled_at AS scheduledAt, r.started_at AS startedAt, r.finished_at AS finishedAt,
           r.duration_ms AS durationMs, r.error_message AS errorMessage, r.created_at AS createdAt
    FROM dev_workflow_runs r
    JOIN dev_workflows w ON w.id = r.workflow_id
    WHERE r.workflow_id = ?
    ORDER BY r.id DESC
    LIMIT 200
  `, [workflowId]);
      return rows.map(mapWorkflowRun);
    }
    async function findScheduledWorkflowRun(workflowId, scheduledAt) {
      const [rows] = await pool.query(`
    SELECT r.id, r.workflow_id AS workflowId, w.name AS workflowName, r.trigger_type AS triggerType,
           r.status, r.run_params_json AS runParams, r.workflow_version_no AS workflowVersionNo,
           r.graph_snapshot_json AS graphSnapshot, r.workflow_retry_count AS workflowRetryCount,
           r.scheduled_at AS scheduledAt, r.started_at AS startedAt, r.finished_at AS finishedAt,
           r.duration_ms AS durationMs, r.error_message AS errorMessage, r.created_at AS createdAt
    FROM dev_workflow_runs r
    JOIN dev_workflows w ON w.id = r.workflow_id
    WHERE r.workflow_id = ? AND r.trigger_type = 'cron' AND r.scheduled_at = ?
    LIMIT 1
  `, [workflowId, scheduledAt]);
      return rows[0] ? mapWorkflowRun(rows[0]) : null;
    }
    async function listRecoverableWorkflowRuns() {
      const [rows] = await pool.query(`
    SELECT r.id, r.workflow_id AS workflowId, w.name AS workflowName, r.trigger_type AS triggerType,
           r.status, r.run_params_json AS runParams, r.workflow_version_no AS workflowVersionNo,
           r.graph_snapshot_json AS graphSnapshot, r.workflow_retry_count AS workflowRetryCount,
           r.scheduled_at AS scheduledAt, r.started_at AS startedAt, r.finished_at AS finishedAt,
           r.duration_ms AS durationMs, r.error_message AS errorMessage, r.created_at AS createdAt
    FROM dev_workflow_runs r
    JOIN dev_workflows w ON w.id = r.workflow_id
    WHERE r.status IN ('pending', 'running')
    ORDER BY r.id ASC
    LIMIT 200
  `);
      return rows.map(mapWorkflowRun);
    }
    async function createJobInstance(payload) {
      const [result] = await pool.query(`
    INSERT INTO dev_job_instances
      (workflow_run_id, workflow_id, workflow_node_id, node_type, script_id, processing_job_id,
       orchestration_task_id, trigger_type, status, started_at, retry_count, run_attempt,
       error_message, result_preview_json, branch_result_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        payload.workflowRunId,
        payload.workflowId,
        payload.workflowNodeId,
        payload.nodeType || "script",
        payload.scriptId,
        payload.processingJobId || null,
        payload.orchestrationTaskId || null,
        payload.triggerType || "manual",
        payload.status || "pending",
        payload.startedAt || null,
        payload.retryCount || 0,
        payload.runAttempt || 1,
        payload.errorMessage || null,
        payload.resultPreview ? JSON.stringify(payload.resultPreview) : null,
        payload.branchResult ? JSON.stringify(payload.branchResult) : null
      ]);
      return getJobInstanceById(result.insertId);
    }
    async function getJobInstanceById(id) {
      const scoped = getScopedWhere("w");
      const [rows] = await pool.query(`
    SELECT i.id, i.workflow_run_id AS workflowRunId, i.workflow_id AS workflowId,
           i.workflow_node_id AS workflowNodeId, n.node_key AS workflowNodeKey, w.name AS workflowName, n.node_name AS workflowNodeName,
           i.node_type AS nodeType, i.script_id AS scriptId, s.name AS scriptName,
           i.processing_job_id AS processingJobId, pj.name AS processingJobName,
           i.orchestration_task_id AS orchestrationTaskId, ot.name AS orchestrationTaskName,
           i.trigger_type AS triggerType, i.status, i.started_at AS startedAt,
           i.finished_at AS finishedAt, i.duration_ms AS durationMs, i.retry_count AS retryCount, i.run_attempt AS runAttempt,
           i.error_message AS errorMessage, i.result_preview_json AS resultPreview, i.branch_result_json AS branchResult, i.created_at AS createdAt
    FROM dev_job_instances i
    JOIN dev_workflows w ON w.id = i.workflow_id
    JOIN dev_workflow_nodes n ON n.id = i.workflow_node_id
    LEFT JOIN dev_sql_scripts s ON s.id = i.script_id
    LEFT JOIN dev_processing_jobs pj ON pj.id = i.processing_job_id
    LEFT JOIN dev_orchestration_tasks ot ON ot.id = i.orchestration_task_id
    WHERE i.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
  `, [id, ...scoped.params]);
      return rows[0] ? mapJobInstance(rows[0]) : null;
    }
    async function updateJobInstance(id, payload) {
      const [result] = await pool.query(`
    UPDATE dev_job_instances
    SET status = ?, started_at = ?, finished_at = ?, duration_ms = ?, retry_count = ?, error_message = ?, result_preview_json = ?, branch_result_json = ?
    WHERE id = ?
  `, [
        payload.status,
        payload.startedAt || null,
        payload.finishedAt || null,
        payload.durationMs === void 0 ? null : payload.durationMs,
        payload.retryCount || 0,
        payload.errorMessage || null,
        payload.resultPreview ? JSON.stringify(payload.resultPreview) : null,
        payload.branchResult ? JSON.stringify(payload.branchResult) : null,
        id
      ]);
      if (!result.affectedRows) {
        return null;
      }
      return getJobInstanceById(id);
    }
    async function listInstances(filters = {}) {
      const where = [];
      const params = [];
      const scoped = getScopedWhere("w");
      if (scoped.sql) {
        where.push(scoped.sql);
        params.push(...scoped.params);
      }
      if (filters.workflowRunId) {
        where.push("i.workflow_run_id = ?");
        params.push(Number(filters.workflowRunId));
      }
      if (filters.workflowId) {
        where.push("i.workflow_id = ?");
        params.push(Number(filters.workflowId));
      }
      const [rows] = await pool.query(`
    SELECT i.id, i.workflow_run_id AS workflowRunId, i.workflow_id AS workflowId,
           i.workflow_node_id AS workflowNodeId, n.node_key AS workflowNodeKey, w.name AS workflowName, n.node_name AS workflowNodeName,
           i.node_type AS nodeType, i.script_id AS scriptId, s.name AS scriptName,
           i.processing_job_id AS processingJobId, pj.name AS processingJobName,
           i.orchestration_task_id AS orchestrationTaskId, ot.name AS orchestrationTaskName,
           i.trigger_type AS triggerType, i.status, i.started_at AS startedAt,
           i.finished_at AS finishedAt, i.duration_ms AS durationMs, i.retry_count AS retryCount, i.run_attempt AS runAttempt,
           i.error_message AS errorMessage, i.result_preview_json AS resultPreview, i.branch_result_json AS branchResult, i.created_at AS createdAt
    FROM dev_job_instances i
    JOIN dev_workflows w ON w.id = i.workflow_id
    JOIN dev_workflow_nodes n ON n.id = i.workflow_node_id
    LEFT JOIN dev_sql_scripts s ON s.id = i.script_id
    LEFT JOIN dev_processing_jobs pj ON pj.id = i.processing_job_id
    LEFT JOIN dev_orchestration_tasks ot ON ot.id = i.orchestration_task_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY i.id DESC
    LIMIT 500
  `, params);
      return rows.map(mapJobInstance);
    }
    async function createJobLog(payload) {
      const [result] = await pool.query(`
    INSERT INTO dev_job_logs (instance_id, log_type, content)
    VALUES (?, ?, ?)
  `, [payload.instanceId, payload.logType || "info", payload.content]);
      const [rows] = await pool.query(`
    SELECT id, instance_id AS instanceId, log_type AS logType, content, created_at AS createdAt
    FROM dev_job_logs WHERE id = ?
  `, [result.insertId]);
      return mapJobLog(rows[0]);
    }
    async function listJobLogs(instanceId) {
      const [rows] = await pool.query(`
    SELECT id, instance_id AS instanceId, log_type AS logType, content, created_at AS createdAt
    FROM dev_job_logs
    WHERE instance_id = ?
    ORDER BY id ASC
  `, [instanceId]);
      return rows.map(mapJobLog);
    }
    module2.exports = {
      createCopilotMessage,
      createCopilotSession,
      createOrchestrationTask,
      createProcessingJob,
      createProcessingRun,
      createDatasource,
      createJobInstance,
      createJobLog,
      createQueryHistory,
      createScript,
      createScriptFolder,
      createScriptVersion,
      createWorkflow,
      createWorkflowRun,
      createWorkflowVersion,
      deleteOrchestrationTask,
      deleteProcessingJob,
      deleteDatasource,
      deleteScript,
      deleteScriptFolder,
      deleteWorkflow,
      getDatasourceById,
      getCopilotSessionById,
      getQueryHistoryById,
      getJobInstanceById,
      getOrchestrationTaskById,
      getProcessingJobById,
      getProcessingJobVersion,
      getProcessingRunById,
      getPublishedWorkflowVersion,
      getLatestProcessingJobVersion,
      getLatestWorkflowVersion,
      getScriptById,
      getWorkflowById,
      getWorkflowVersion,
      getWorkflowRunById,
      listDatasources,
      listCopilotMessages,
      listCopilotSessions,
      listInstances,
      listJobLogs,
      listOrchestrationTasks,
      listProcessingJobs,
      listProcessingRuns,
      listRecoverableWorkflowRuns,
      listQueryHistory,
      listScriptFolders,
      listScriptVersions,
      listScripts,
      listWorkflowRuns,
      listWorkflows,
      findScheduledWorkflowRun,
      replaceOrchestrationGraph,
      replaceWorkflowGraph,
      upsertProcessingJobVersion,
      updateProcessingJob,
      updateProcessingJobVersionPointers,
      updateProcessingRun,
      updateOrchestrationTask,
      updateDatasource,
      updateJobInstance,
      updateScript,
      updateScriptFolder,
      updateWorkflow,
      updateWorkflowPublishedVersion,
      updateWorkflowRun,
      touchCopilotSession
    };
  }
});

// backend/src/modules/data-development/adapters/mysql.adapter.js
var require_mysql_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/mysql.adapter.js"(exports2, module2) {
    var mysql = require("mysql2/promise");
    var { applyResultLimit, parseTableName, quoteIdentifier, resolveRuntimeDatasourceConfig } = require_data_development_utils();
    function resolveConnectionConfig(config, databaseName) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      return {
        host: resolved.host,
        port: Number(resolved.port || 3306),
        user: resolved.username,
        password: resolved.password,
        database: databaseName || resolved.databaseName || void 0,
        multipleStatements: false,
        connectTimeout: 1e4
      };
    }
    async function withConnection(config, databaseName, handler) {
      const connection = await mysql.createConnection(resolveConnectionConfig(config, databaseName));
      try {
        return await handler(connection);
      } finally {
        await connection.end();
      }
    }
    module2.exports = {
      async testConnection(config) {
        return withConnection(config, config.databaseName, async (connection) => {
          await connection.query("SELECT 1 AS ok");
          return { success: true, message: "MySQL connection succeeded" };
        });
      },
      async getDatabases(config) {
        return withConnection(config, void 0, async (connection) => {
          const [rows] = await connection.query("SHOW DATABASES");
          return rows.map((row) => ({ name: row.Database }));
        });
      },
      async getTables(config, databaseName) {
        return withConnection(config, databaseName, async (connection) => {
          const scope = databaseName || config.databaseName;
          const [rows] = await connection.query(`
        SELECT table_name AS name,
               table_type AS type,
               table_comment AS comment
        FROM information_schema.tables
        WHERE table_schema = ?
        ORDER BY table_name
      `, [scope]);
          return rows.map((row) => ({
            name: row.name,
            type: row.type || "BASE TABLE",
            comment: row.comment || null
          }));
        });
      },
      async getColumns(config, databaseName, tableName) {
        return withConnection(config, databaseName, async (connection) => {
          const parsed = parseTableName(tableName, databaseName || config.databaseName);
          const [rows] = await connection.query(`SHOW FULL COLUMNS FROM ${quoteIdentifier(parsed.scope ? `${parsed.scope}.${parsed.table}` : parsed.table, "mysql")}`);
          return rows.map((row, index) => ({
            name: row.Field,
            position: index + 1,
            dataType: row.Type,
            columnType: row.Type,
            nullable: row.Null === "YES",
            primaryKey: row.Key === "PRI",
            defaultValue: row.Default,
            comment: row.Comment
          }));
        });
      },
      async getFunctions(config, databaseName) {
        return withConnection(config, databaseName, async (connection) => {
          const scope = databaseName || config.databaseName;
          const [rows] = await connection.query(`
        SELECT routine_name AS name, routine_type AS type, routine_schema AS schemaName
        FROM information_schema.routines
        WHERE routine_schema = ?
        ORDER BY routine_type, routine_name
      `, [scope]);
          return rows.map((row) => ({
            name: row.name,
            type: row.type,
            schema: row.schemaName
          }));
        });
      },
      async executeQuery(config, sql, options = {}) {
        return withConnection(config, options.databaseName || config.databaseName, async (connection) => {
          const normalizedSql = applyResultLimit(sql, options.resultLimit, "mysql");
          const [rows, fields] = await connection.query(normalizedSql);
          return {
            fields: Array.isArray(fields) ? fields.map((field) => field.name) : [],
            rows: Array.isArray(rows) ? rows : [],
            rowCount: Array.isArray(rows) ? rows.length : 0,
            executedSql: normalizedSql
          };
        });
      },
      async executeStatement(config, sql, options = {}) {
        return withConnection(config, options.databaseName || config.databaseName, async (connection) => {
          const normalizedSql = String(sql || "").trim().replace(/;+\s*$/, "");
          const [result] = await connection.query(normalizedSql);
          return {
            affectedRows: Number(result?.affectedRows || 0),
            insertId: Number(result?.insertId || 0),
            warningStatus: Number(result?.warningStatus || 0),
            executedSql: normalizedSql
          };
        });
      }
    };
  }
});

// backend/src/common/utils/db-client.js
var require_db_client = __commonJS({
  "backend/src/common/utils/db-client.js"(exports2, module2) {
    var { Client: PgClient } = require("pg");
    var OpenGaussClient = require("node-opengauss/lib/core/client");
    function isGaussDbType(value) {
      return String(value || "").trim().toLowerCase() === "gaussdb";
    }
    function createPostgresLikeClient(config = {}, options = {}) {
      const normalized = {
        host: config.host,
        port: Number(config.port || 5432),
        database: config.database,
        user: config.user || config.username,
        username: config.username || config.user,
        password: config.password,
        connectionTimeoutMillis: Number(config.connectionTimeoutMillis || 0) || void 0,
        ssl: config.ssl,
        application_name: config.application_name
      };
      if (isGaussDbType(options.sourceType || options.storageType || options.protocol)) {
        return new OpenGaussClient({
          host: normalized.host,
          port: normalized.port,
          database: normalized.database,
          user: normalized.user,
          password: normalized.password,
          connectionTimeoutMillis: normalized.connectionTimeoutMillis,
          ssl: normalized.ssl,
          application_name: normalized.application_name
        });
      }
      return new PgClient({
        host: normalized.host,
        port: normalized.port,
        database: normalized.database,
        user: normalized.user,
        password: normalized.password,
        connectionTimeoutMillis: normalized.connectionTimeoutMillis,
        ssl: normalized.ssl,
        application_name: normalized.application_name
      });
    }
    module2.exports = {
      createPostgresLikeClient,
      isGaussDbType
    };
  }
});

// backend/src/modules/data-development/adapters/postgres.adapter.js
var require_postgres_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/postgres.adapter.js"(exports2, module2) {
    var { applyResultLimit, parseTableName, resolveRuntimeDatasourceConfig } = require_data_development_utils();
    var { createPostgresLikeClient } = require_db_client();
    function escapeSqlString(value) {
      return `'${String(value || "").replace(/'/g, "''")}'`;
    }
    function resolveConnectionConfig(config, databaseName) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      return {
        storageType: resolved.storageType,
        host: resolved.host,
        port: Number(resolved.port || 5432),
        user: resolved.username,
        username: resolved.username,
        password: resolved.password,
        database: databaseName || resolved.databaseName || void 0,
        schema: resolved.schema || "public",
        connectionTimeoutMillis: 1e4
      };
    }
    async function withClient(config, databaseName, handler) {
      const connectionConfig = resolveConnectionConfig(config, databaseName);
      const client = createPostgresLikeClient(connectionConfig, {
        sourceType: connectionConfig.storageType
      });
      await client.connect();
      try {
        return await handler(client);
      } finally {
        await client.end();
      }
    }
    module2.exports = {
      async testConnection(config) {
        return withClient(config, config.databaseName, async (client) => {
          await client.query("SELECT 1 AS ok");
          return { success: true, message: "PostgreSQL connection succeeded" };
        });
      },
      async getDatabases(config) {
        return withClient(config, config.databaseName || "postgres", async (client) => {
          const result = await client.query(`
        SELECT datname
        FROM pg_database
        WHERE datistemplate = false
        ORDER BY datname
      `);
          return result.rows.map((row) => ({ name: row.datname }));
        });
      },
      async getTables(config, databaseName) {
        return withClient(config, databaseName || config.databaseName, async (client) => {
          const connectionConfig = resolveConnectionConfig(config, databaseName || config.databaseName);
          const schemaName = connectionConfig.schema || "public";
          const result = await client.query(`
        SELECT t.table_schema,
               t.table_name,
               t.table_type,
               obj_description((quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass, 'pg_class') AS comment
        FROM information_schema.tables t
        WHERE t.table_schema = ${escapeSqlString(schemaName)}
        ORDER BY table_schema, table_name
      `);
          return result.rows.map((row) => ({
            name: `${row.table_schema}.${row.table_name}`,
            type: row.table_type,
            comment: row.comment || null
          }));
        });
      },
      async getColumns(config, databaseName, tableName) {
        return withClient(config, databaseName || config.databaseName, async (client) => {
          const parsed = parseTableName(tableName, "public");
          const result = await client.query(`
        SELECT column_name, ordinal_position, data_type, udt_name, is_nullable, column_default,
               col_description((quote_ident(table_schema) || '.' || quote_ident(table_name))::regclass::oid, ordinal_position) AS comment
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, [parsed.scope || "public", parsed.table]);
          const pkResult = await client.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      `, [parsed.scope || "public", parsed.table]);
          const primaryKeys = new Set(pkResult.rows.map((row) => row.column_name));
          return result.rows.map((row) => ({
            name: row.column_name,
            position: Number(row.ordinal_position),
            dataType: row.data_type,
            columnType: row.udt_name || row.data_type,
            nullable: row.is_nullable === "YES",
            primaryKey: primaryKeys.has(row.column_name),
            defaultValue: row.column_default,
            comment: row.comment || null
          }));
        });
      },
      async getFunctions(config, databaseName) {
        return withClient(config, databaseName || config.databaseName, async (client) => {
          const connectionConfig = resolveConnectionConfig(config, databaseName || config.databaseName);
          const schemaName = connectionConfig.schema || "public";
          const result = await client.query(`
        SELECT n.nspname AS schema_name,
               p.proname AS routine_name,
               CASE p.prokind
                 WHEN 'p' THEN 'PROCEDURE'
                 ELSE 'FUNCTION'
               END AS routine_type
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = ${escapeSqlString(schemaName)}
        ORDER BY n.nspname, p.proname
      `);
          return result.rows.map((row) => ({
            name: row.routine_name,
            type: row.routine_type,
            schema: row.schema_name
          }));
        });
      },
      async executeQuery(config, sql, options = {}) {
        return withClient(config, options.databaseName || config.databaseName, async (client) => {
          const normalizedSql = applyResultLimit(sql, options.resultLimit, "postgresql");
          const result = await client.query(normalizedSql);
          return {
            fields: result.fields?.map((field) => field.name) || [],
            rows: result.rows || [],
            rowCount: Number(result.rowCount || 0),
            executedSql: normalizedSql
          };
        });
      },
      async executeStatement(config, sql, options = {}) {
        return withClient(config, options.databaseName || config.databaseName, async (client) => {
          const normalizedSql = String(sql || "").trim().replace(/;+\s*$/, "");
          const result = await client.query(normalizedSql);
          return {
            affectedRows: Number(result.rowCount || 0),
            executedSql: normalizedSql
          };
        });
      }
    };
  }
});

// backend/src/modules/data-development/adapters/oracle.adapter.js
var require_oracle_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/oracle.adapter.js"(exports2, module2) {
    var oracledb = require("oracledb");
    var {
      applyResultLimit,
      parseTableName,
      quoteIdentifier,
      resolveRuntimeDatasourceConfig
    } = require_data_development_utils();
    function resolveConnectionConfig(config = {}) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      const mode = String(resolved.connectionMode || config.connectionMode || config.extraConfig?.connectionMode || "serviceName").toLowerCase();
      const service = resolved.databaseName || "";
      const connectString = mode === "sid" ? `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${resolved.host})(PORT=${resolved.port || 1521}))(CONNECT_DATA=(SID=${service})))` : `${resolved.host}:${resolved.port || 1521}/${service}`;
      return {
        user: resolved.username,
        password: resolved.password,
        connectString,
        connectTimeout: 10
      };
    }
    async function withConnection(config, handler) {
      const connection = await oracledb.getConnection(resolveConnectionConfig(config));
      try {
        return await handler(connection);
      } finally {
        await connection.close();
      }
    }
    function normalizeResult(result, executedSql) {
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      return {
        fields: Array.isArray(result?.metaData) ? result.metaData.map((item) => item.name) : Object.keys(rows[0] || {}),
        rows,
        rowCount: rows.length,
        affectedRows: Number(result?.rowsAffected || 0),
        executedSql
      };
    }
    function normalizeOracleSql(sql) {
      const normalized = String(sql || "").trim().replace(/;+\s*$/, "").replace(/\bRAND\(\)/gi, "DBMS_RANDOM.VALUE");
      const offsetMatch = normalized.match(/^(.*)\s+LIMIT\s+(\d+)\s+OFFSET\s+(\d+)\s*$/is);
      if (offsetMatch) return `${offsetMatch[1]} OFFSET ${offsetMatch[3]} ROWS FETCH NEXT ${offsetMatch[2]} ROWS ONLY`;
      const limitMatch = normalized.match(/^(.*)\s+LIMIT\s+(\d+)\s*$/is);
      if (limitMatch) return `SELECT * FROM (${limitMatch[1]}) WHERE ROWNUM <= ${limitMatch[2]}`;
      return normalized;
    }
    function schemaName(config) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      return String(resolved.schema || resolved.username || "").toUpperCase();
    }
    function resolveSchemaName(config, candidate) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      const normalizedCandidate = String(candidate || "").trim();
      if (!normalizedCandidate || normalizedCandidate.toUpperCase() === String(resolved.databaseName || "").toUpperCase()) {
        return schemaName(config);
      }
      return normalizedCandidate.toUpperCase();
    }
    module2.exports = {
      async testConnection(config) {
        return withConnection(config, async (connection) => {
          await connection.execute("SELECT 1 AS ok FROM DUAL");
          return { success: true, message: "Oracle \u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F" };
        });
      },
      async getDatabases(config) {
        return module2.exports.getSchemas(config);
      },
      async getSchemas(config) {
        return withConnection(config, async (connection) => {
          const result = await connection.execute("SELECT username AS name FROM all_users ORDER BY username", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
          return (result.rows || []).map((row) => ({ name: row.NAME || row.name }));
        });
      },
      async getTables(config, schema) {
        const owner = resolveSchemaName(config, schema);
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT owner, object_name AS name, object_type AS type FROM all_objects WHERE owner = :owner AND object_type IN ('TABLE', 'VIEW') ORDER BY object_name`,
            { owner },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          return (result.rows || []).map((row) => ({
            name: `${row.OWNER || owner}.${row.NAME || row.name}`,
            type: row.TYPE || row.type,
            comment: null
          }));
        });
      },
      async getColumns(config, schema, tableName) {
        const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
        const owner = String(parsed.scope || schemaName(config)).toUpperCase();
        const table = String(parsed.table || "").toUpperCase();
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT c.column_name, c.column_id, c.data_type, c.data_length, c.data_precision, c.data_scale, c.nullable, c.data_default,
                CASE WHEN EXISTS (SELECT 1 FROM all_constraints ac JOIN all_cons_columns acc ON acc.constraint_name = ac.constraint_name AND acc.owner = ac.owner WHERE ac.constraint_type = 'P' AND ac.owner = c.owner AND acc.table_name = c.table_name AND acc.column_name = c.column_name) THEN 'Y' ELSE 'N' END AS primary_key
           FROM all_tab_columns c WHERE c.owner = :owner AND c.table_name = :tableName ORDER BY c.column_id`,
            { owner, tableName: table },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          return (result.rows || []).map((row) => ({
            name: row.COLUMN_NAME,
            position: Number(row.COLUMN_ID),
            dataType: row.DATA_TYPE,
            columnType: row.DATA_TYPE,
            length: row.DATA_LENGTH,
            precision: row.DATA_PRECISION,
            scale: row.DATA_SCALE,
            nullable: row.NULLABLE === "Y",
            primaryKey: row.PRIMARY_KEY === "Y",
            defaultValue: row.DATA_DEFAULT,
            comment: null
          }));
        });
      },
      async getFunctions(config, schema) {
        const owner = resolveSchemaName(config, schema);
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT owner, object_name AS name, object_type AS type FROM all_objects WHERE owner = :owner AND object_type IN ('FUNCTION', 'PROCEDURE', 'PACKAGE') ORDER BY object_name`,
            { owner },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          return (result.rows || []).map((row) => ({ name: row.NAME, type: row.TYPE, schema: row.OWNER }));
        });
      },
      async getIndexes(config, schema, tableName) {
        const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
        const owner = String(parsed.scope || schemaName(config)).toUpperCase();
        const table = String(parsed.table || "").toUpperCase();
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT i.index_name, i.uniqueness, i.index_type, c.column_name, c.column_position FROM all_indexes i JOIN all_ind_columns c ON c.index_owner = i.owner AND c.index_name = i.index_name WHERE i.table_owner = :owner AND i.table_name = :tableName ORDER BY i.index_name, c.column_position`,
            { owner, tableName: table },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          const grouped = /* @__PURE__ */ new Map();
          for (const row of result.rows || []) {
            if (!grouped.has(row.INDEX_NAME)) grouped.set(row.INDEX_NAME, { indexName: row.INDEX_NAME, unique: row.UNIQUENESS === "UNIQUE", indexType: row.INDEX_TYPE, cardinality: null, columns: [] });
            grouped.get(row.INDEX_NAME).columns.push(row.COLUMN_NAME);
          }
          return [...grouped.values()];
        });
      },
      async getConstraints(config, schema, tableName) {
        const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
        const owner = String(parsed.scope || schemaName(config)).toUpperCase();
        const table = String(parsed.table || "").toUpperCase();
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT c.constraint_name, c.constraint_type, cc.column_name, rc.table_name AS referenced_table_name, rcc.column_name AS referenced_column_name
           FROM all_constraints c LEFT JOIN all_cons_columns cc ON cc.owner = c.owner AND cc.constraint_name = c.constraint_name
           LEFT JOIN all_constraints rc ON rc.owner = c.r_owner AND rc.constraint_name = c.r_constraint_name
           LEFT JOIN all_cons_columns rcc ON rcc.owner = rc.owner AND rcc.constraint_name = rc.constraint_name AND rcc.position = cc.position
          WHERE c.owner = :owner AND c.table_name = :tableName ORDER BY c.constraint_name, cc.position`,
            { owner, tableName: table },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          const typeMap = { P: "PRIMARY KEY", R: "FOREIGN KEY", U: "UNIQUE", C: "CHECK" };
          const grouped = /* @__PURE__ */ new Map();
          for (const row of result.rows || []) {
            if (!grouped.has(row.CONSTRAINT_NAME)) grouped.set(row.CONSTRAINT_NAME, { constraintName: row.CONSTRAINT_NAME, constraintType: typeMap[row.CONSTRAINT_TYPE] || row.CONSTRAINT_TYPE, columns: [], references: [] });
            const item = grouped.get(row.CONSTRAINT_NAME);
            if (row.COLUMN_NAME) item.columns.push(row.COLUMN_NAME);
            if (row.REFERENCED_TABLE_NAME && row.REFERENCED_COLUMN_NAME) item.references.push({ tableName: row.REFERENCED_TABLE_NAME, columnName: row.REFERENCED_COLUMN_NAME });
          }
          return [...grouped.values()];
        });
      },
      async executeQuery(config, sql, options = {}) {
        return withConnection(config, async (connection) => {
          const normalizedSql = applyResultLimit(normalizeOracleSql(sql), options.resultLimit, "oracle");
          const result = await connection.execute(normalizedSql, options.binds || [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
          return normalizeResult(result, normalizedSql);
        });
      },
      async executeStatement(config, sql) {
        return withConnection(config, async (connection) => {
          const originalSql = String(sql || "").trim();
          const normalizedSql = /^BEGIN\b/i.test(originalSql) ? originalSql : originalSql.replace(/;+\s*$/, "");
          const result = await connection.execute(normalizedSql, [], { autoCommit: true });
          return { affectedRows: Number(result?.rowsAffected || 0), executedSql: normalizedSql };
        });
      },
      quoteIdentifier
    };
  }
});

// backend/src/modules/data-development/adapters/dm.adapter.js
var require_dm_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/dm.adapter.js"(exports2, module2) {
    var dmdb = require("dmdb");
    var {
      applyResultLimit,
      parseTableName,
      resolveRuntimeDatasourceConfig
    } = require_data_development_utils();
    function resolveConnectionConfig(config = {}) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      return {
        connectString: `${resolved.host}:${resolved.port || 5236}`,
        user: resolved.username,
        password: resolved.password,
        schema: resolved.schema || void 0,
        connectTimeout: 1e4,
        autoCommit: true
      };
    }
    async function withConnection(config, handler) {
      const connection = await dmdb.getConnection(resolveConnectionConfig(config));
      try {
        return await handler(connection);
      } finally {
        await connection.close();
      }
    }
    function toObjectRows(result) {
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      if (!rows.length || !Array.isArray(rows[0])) return rows;
      const fields = (result.metaData || []).map((item) => item.name);
      return rows.map((row) => Object.fromEntries(fields.map((field, index) => [field, row[index]])));
    }
    function normalizeResult(result, executedSql) {
      const rows = toObjectRows(result);
      return {
        fields: Array.isArray(result?.metaData) ? result.metaData.map((item) => item.name) : Object.keys(rows[0] || {}),
        rows,
        rowCount: rows.length,
        affectedRows: Number(result?.rowsAffected || 0),
        executedSql
      };
    }
    function normalizeDmSql(sql) {
      const normalized = String(sql || "").trim().replace(/;+\s*$/, "");
      const offsetMatch = normalized.match(/^(.*)\s+LIMIT\s+(\d+)\s+OFFSET\s+(\d+)\s*$/is);
      if (offsetMatch) return `${offsetMatch[1]} OFFSET ${offsetMatch[3]} ROWS FETCH NEXT ${offsetMatch[2]} ROWS ONLY`;
      const limitMatch = normalized.match(/^(.*)\s+LIMIT\s+(\d+)\s*$/is);
      if (limitMatch) return `${limitMatch[1]} FETCH FIRST ${limitMatch[2]} ROWS ONLY`;
      return normalized;
    }
    function schemaName(config) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      return String(resolved.schema || resolved.username || "").toUpperCase();
    }
    function resolveSchemaName(config, candidate) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      const normalizedCandidate = String(candidate || "").trim();
      if (!normalizedCandidate || normalizedCandidate.toUpperCase() === String(resolved.databaseName || "").toUpperCase()) {
        return schemaName(config);
      }
      return normalizedCandidate.toUpperCase();
    }
    module2.exports = {
      async testConnection(config) {
        return withConnection(config, async (connection) => {
          await connection.execute("SELECT 1 AS ok FROM DUAL");
          return { success: true, message: "\u8FBE\u68A6\u6570\u636E\u5E93\u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F" };
        });
      },
      async getDatabases(config) {
        return module2.exports.getSchemas(config);
      },
      async getSchemas(config) {
        return withConnection(config, async (connection) => {
          const result = await connection.execute("SELECT username AS name FROM all_users ORDER BY username");
          return toObjectRows(result).map((row) => ({ name: row.NAME || row.name }));
        });
      },
      async getTables(config, schema) {
        const owner = resolveSchemaName(config, schema);
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT owner, object_name AS name, object_type AS type FROM all_objects WHERE owner = ? AND object_type IN ('TABLE', 'VIEW') ORDER BY object_name`,
            [owner]
          );
          return toObjectRows(result).map((row) => ({
            name: `${row.OWNER || owner}.${row.NAME || row.name}`,
            type: row.TYPE || row.type,
            comment: null
          }));
        });
      },
      async getColumns(config, schema, tableName) {
        const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
        const owner = String(parsed.scope || schemaName(config)).toUpperCase();
        const table = String(parsed.table || "").toUpperCase();
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT c.column_name, c.column_id, c.data_type, c.data_length, c.data_precision, c.data_scale, c.nullable, c.data_default,
                CASE WHEN EXISTS (SELECT 1 FROM all_constraints ac JOIN all_cons_columns acc ON acc.constraint_name = ac.constraint_name AND acc.owner = ac.owner WHERE ac.constraint_type = 'P' AND ac.owner = c.owner AND acc.table_name = c.table_name AND acc.column_name = c.column_name) THEN 'Y' ELSE 'N' END AS primary_key
           FROM all_tab_columns c WHERE c.owner = ? AND c.table_name = ? ORDER BY c.column_id`,
            [owner, table]
          );
          return toObjectRows(result).map((row) => ({
            name: row.COLUMN_NAME,
            position: Number(row.COLUMN_ID),
            dataType: row.DATA_TYPE,
            columnType: row.DATA_TYPE,
            length: row.DATA_LENGTH,
            precision: row.DATA_PRECISION,
            scale: row.DATA_SCALE,
            nullable: row.NULLABLE === "Y",
            primaryKey: row.PRIMARY_KEY === "Y",
            defaultValue: row.DATA_DEFAULT,
            comment: null
          }));
        });
      },
      async getFunctions(config, schema) {
        const owner = resolveSchemaName(config, schema);
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT owner, object_name AS name, object_type AS type FROM all_objects WHERE owner = ? AND object_type IN ('FUNCTION', 'PROCEDURE', 'PACKAGE') ORDER BY object_name`,
            [owner]
          );
          return toObjectRows(result).map((row) => ({ name: row.NAME, type: row.TYPE, schema: row.OWNER }));
        });
      },
      async getIndexes(config, schema, tableName) {
        const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
        const owner = String(parsed.scope || schemaName(config)).toUpperCase();
        const table = String(parsed.table || "").toUpperCase();
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT i.index_name, i.uniqueness, i.index_type, c.column_name, c.column_position FROM all_indexes i JOIN all_ind_columns c ON c.index_owner = i.owner AND c.index_name = i.index_name WHERE i.table_owner = ? AND i.table_name = ? ORDER BY i.index_name, c.column_position`,
            [owner, table]
          );
          const grouped = /* @__PURE__ */ new Map();
          for (const row of toObjectRows(result)) {
            if (!grouped.has(row.INDEX_NAME)) grouped.set(row.INDEX_NAME, { indexName: row.INDEX_NAME, unique: row.UNIQUENESS === "UNIQUE", indexType: row.INDEX_TYPE, cardinality: null, columns: [] });
            grouped.get(row.INDEX_NAME).columns.push(row.COLUMN_NAME);
          }
          return [...grouped.values()];
        });
      },
      async getConstraints(config, schema, tableName) {
        const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
        const owner = String(parsed.scope || schemaName(config)).toUpperCase();
        const table = String(parsed.table || "").toUpperCase();
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT c.constraint_name, c.constraint_type, cc.column_name, rc.table_name AS referenced_table_name, rcc.column_name AS referenced_column_name
           FROM all_constraints c LEFT JOIN all_cons_columns cc ON cc.owner = c.owner AND cc.constraint_name = c.constraint_name
           LEFT JOIN all_constraints rc ON rc.owner = c.r_owner AND rc.constraint_name = c.r_constraint_name
           LEFT JOIN all_cons_columns rcc ON rcc.owner = rc.owner AND rcc.constraint_name = rc.constraint_name AND rcc.position = cc.position
          WHERE c.owner = ? AND c.table_name = ? ORDER BY c.constraint_name, cc.position`,
            [owner, table]
          );
          const typeMap = { P: "PRIMARY KEY", R: "FOREIGN KEY", U: "UNIQUE", C: "CHECK" };
          const grouped = /* @__PURE__ */ new Map();
          for (const row of toObjectRows(result)) {
            if (!grouped.has(row.CONSTRAINT_NAME)) grouped.set(row.CONSTRAINT_NAME, { constraintName: row.CONSTRAINT_NAME, constraintType: typeMap[row.CONSTRAINT_TYPE] || row.CONSTRAINT_TYPE, columns: [], references: [] });
            const item = grouped.get(row.CONSTRAINT_NAME);
            if (row.COLUMN_NAME) item.columns.push(row.COLUMN_NAME);
            if (row.REFERENCED_TABLE_NAME && row.REFERENCED_COLUMN_NAME) item.references.push({ tableName: row.REFERENCED_TABLE_NAME, columnName: row.REFERENCED_COLUMN_NAME });
          }
          return [...grouped.values()];
        });
      },
      async executeQuery(config, sql, options = {}) {
        return withConnection(config, async (connection) => {
          const normalizedSql = applyResultLimit(normalizeDmSql(sql), options.resultLimit, "dm");
          const result = await connection.execute(normalizedSql, options.binds || []);
          return normalizeResult(result, normalizedSql);
        });
      },
      async executeStatement(config, sql) {
        return withConnection(config, async (connection) => {
          const normalizedSql = String(sql || "").trim().replace(/;+\s*$/, "");
          const result = await connection.execute(normalizedSql);
          return { affectedRows: Number(result?.rowsAffected || 0), executedSql: normalizedSql };
        });
      }
    };
  }
});

// backend/src/modules/data-development/adapters/clickhouse.adapter.js
var require_clickhouse_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/clickhouse.adapter.js"(exports2, module2) {
    var { applyResultLimit, parseTableName, resolveDatasourceHost, resolveRuntimeDatasourceConfig } = require_data_development_utils();
    function buildBaseUrl(config) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      const protocol = resolved.protocol || "http";
      return `${protocol}://${resolveDatasourceHost(resolved.host)}:${Number(resolved.port || 8123)}`;
    }
    async function request(config, sql, databaseName, format = "json") {
      const searchParams = new URLSearchParams();
      const resolved = resolveRuntimeDatasourceConfig(config);
      if (databaseName || resolved.databaseName) {
        searchParams.set("database", databaseName || resolved.databaseName);
      }
      if (resolved.username) {
        searchParams.set("user", resolved.username);
      }
      if (resolved.password) {
        searchParams.set("password", resolved.password);
      }
      let normalizedSql = String(sql || "").trim().replace(/;+\s*$/, "");
      if (format === "json" && !/\bformat\s+json\b/i.test(normalizedSql)) {
        normalizedSql = `${normalizedSql} FORMAT JSON`;
      }
      const response = await fetch(`${buildBaseUrl(config)}/?${searchParams.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: normalizedSql
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `ClickHouse request failed with status ${response.status}`);
      }
      if (format === "json") {
        return { text, json: JSON.parse(text), executedSql: normalizedSql };
      }
      return { text, executedSql: normalizedSql };
    }
    module2.exports = {
      async testConnection(config) {
        await request(config, "SELECT 1 AS ok", config.databaseName, "json");
        return { success: true, message: "ClickHouse connection succeeded" };
      },
      async getDatabases(config) {
        const result = await request(config, "SHOW DATABASES", void 0, "json");
        return (result.json.data || []).map((row) => ({ name: row.name || Object.values(row)[0] }));
      },
      async getTables(config, databaseName) {
        const scope = databaseName || config.databaseName;
        const result = await request(
          config,
          `SELECT name, engine AS type, comment FROM system.tables WHERE database = ${JSON.stringify(scope)} ORDER BY name`,
          databaseName,
          "json"
        );
        return (result.json.data || []).map((row) => ({
          name: row.name || Object.values(row)[0],
          type: row.type || "BASE TABLE",
          comment: row.comment || null
        }));
      },
      async getColumns(config, databaseName, tableName) {
        const parsed = parseTableName(tableName, databaseName || config.databaseName);
        const result = await request(config, `DESCRIBE TABLE ${parsed.scope}.${parsed.table}`, parsed.scope, "json");
        return (result.json.data || []).map((row, index) => ({
          name: row.name,
          position: index + 1,
          dataType: row.type,
          columnType: row.type,
          nullable: /nullable/i.test(String(row.type || "")),
          primaryKey: false,
          defaultValue: row.default_expression || null,
          comment: row.comment || null
        }));
      },
      async getFunctions() {
        return [];
      },
      async executeQuery(config, sql, options = {}) {
        const normalizedSql = applyResultLimit(sql, options.resultLimit, "clickhouse");
        const result = await request(config, normalizedSql, options.databaseName || config.databaseName, "json");
        const rows = result.json.data || [];
        const fields = result.json.meta?.map((item) => item.name) || Object.keys(rows[0] || {});
        return {
          fields,
          rows,
          rowCount: rows.length,
          executedSql: result.executedSql
        };
      },
      async executeStatement(config, sql, options = {}) {
        const result = await request(config, sql, options.databaseName || config.databaseName, "text");
        return {
          affectedRows: 0,
          message: result.text || "Statement executed",
          executedSql: result.executedSql
        };
      }
    };
  }
});

// backend/src/services/hiveService.js
var require_hiveService = __commonJS({
  "backend/src/services/hiveService.js"(exports2, module2) {
    var hive = require("hive-driver");
    var { resolveDatasourceConnection } = require_datasource_dialect();
    var DEFAULT_HIVE_HOST = process.env.HIVE_HOST || "hive";
    var DEFAULT_HIVE_PORT = Number(process.env.HIVE_PORT || 1e4);
    var DEFAULT_HIVE_TIMEOUT_MS = Number(process.env.HIVE_TIMEOUT_MS || 3e5);
    function normalizeConnectionConfig(config = {}) {
      const source = config.connectionConfig || config;
      const resolved = resolveDatasourceConnection(source.sourceType || "hive", source);
      return {
        host: resolved.host || source.host || DEFAULT_HIVE_HOST,
        port: Number(resolved.port || source.port || DEFAULT_HIVE_PORT),
        database: resolved.database || source.database || "default",
        username: resolved.username || source.username || "hive",
        password: resolved.password || source.password || "hive",
        authType: String(source.authType || source.auth || source.authentication || "plain").toLowerCase()
      };
    }
    function escapeHiveIdentifier(identifier) {
      return String(identifier || "").split(".").filter(Boolean).map((part) => `\`${String(part).replace(/`/g, "``")}\``).join(".");
    }
    function normalizeHiveType(value) {
      const normalized = String(value || "string").trim().toLowerCase();
      if (!normalized) {
        return "STRING";
      }
      if (normalized.includes("bigint")) {
        return "BIGINT";
      }
      if (normalized.includes("smallint") || normalized.includes("tinyint") || normalized === "int" || normalized.includes("integer")) {
        return "INT";
      }
      if (normalized.includes("double")) {
        return "DOUBLE";
      }
      if (normalized.includes("float")) {
        return "FLOAT";
      }
      if (normalized.includes("boolean")) {
        return "BOOLEAN";
      }
      if (normalized.includes("timestamp")) {
        return "TIMESTAMP";
      }
      if (normalized === "date") {
        return "DATE";
      }
      if (normalized.startsWith("decimal") || normalized.startsWith("numeric")) {
        const match = normalized.match(/\(([^)]+)\)/);
        return match ? `DECIMAL(${match[1]})` : "DECIMAL(18,2)";
      }
      return "STRING";
    }
    function escapeHiveComment(value) {
      return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    }
    function buildCreateTableSql(database, tableName, columns, options = {}) {
      const fileType = typeof options === "string" ? options : options.fileType || "parquet";
      const columnSql = columns.map((column) => {
        const comment = String(column.columnComment || "").trim();
        return `  ${escapeHiveIdentifier(column.columnName)} ${normalizeHiveType(column.dataType || column.columnType)}${comment ? ` COMMENT '${escapeHiveComment(comment)}'` : ""}`;
      });
      const storageSql = String(fileType || "parquet").toLowerCase() === "text" ? "ROW FORMAT DELIMITED FIELDS TERMINATED BY '\\t' STORED AS TEXTFILE" : "STORED AS PARQUET";
      const tableComment = typeof options === "object" && options.tableComment ? `COMMENT '${escapeHiveComment(options.tableComment)}' ` : "";
      return [
        `CREATE DATABASE IF NOT EXISTS ${escapeHiveIdentifier(database)};`,
        `USE ${escapeHiveIdentifier(database)};`,
        `CREATE TABLE IF NOT EXISTS ${escapeHiveIdentifier(tableName)} (`,
        columnSql.join(",\n"),
        `) ${tableComment}${storageSql};`
      ].join("\n");
    }
    function splitHiveStatements(sqlText) {
      const statements = [];
      let current = "";
      let quote = null;
      let escaped = false;
      for (const char of String(sqlText || "")) {
        if (escaped) {
          current += char;
          escaped = false;
          continue;
        }
        if (char === "\\") {
          current += char;
          escaped = true;
          continue;
        }
        if (quote) {
          current += char;
          if (char === quote) {
            quote = null;
          }
          continue;
        }
        if (char === "'" || char === '"' || char === "`") {
          current += char;
          quote = char;
          continue;
        }
        if (char === ";") {
          const statement = current.trim();
          if (statement) {
            statements.push(statement);
          }
          current = "";
          continue;
        }
        current += char;
      }
      const tail = current.trim();
      if (tail) {
        statements.push(tail);
      }
      return statements;
    }
    function withTimeout(promise, timeoutMs, label) {
      if (!timeoutMs || timeoutMs <= 0) {
        return promise;
      }
      return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          reject(new Error(`${label}\u8D85\u65F6`));
        }, timeoutMs);
        promise.then((value) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }).catch((error) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          reject(error);
        });
      });
    }
    function createHiveClient(config) {
      const { TCLIService, TCLIService_types } = hive.thrift;
      const connection = new hive.connections.TcpConnection();
      const authProvider = config.authType === "none" || config.authType === "nosasl" ? new hive.auth.NoSaslAuthentication() : new hive.auth.PlainTcpAuthentication({
        username: config.username,
        password: config.password
      });
      const client = new hive.HiveClient(TCLIService, TCLIService_types);
      return {
        client,
        connect: () => client.connect({
          host: config.host,
          port: Number(config.port),
          options: {
            username: config.username,
            password: config.password,
            connect_timeout: DEFAULT_HIVE_TIMEOUT_MS,
            timeout: DEFAULT_HIVE_TIMEOUT_MS
          }
        }, connection, authProvider)
      };
    }
    async function executeHiveStatement(session, utils, statement) {
      const operation = await session.executeStatement(statement, { runAsync: true });
      try {
        await utils.waitUntilReady(operation, false);
        await utils.fetchAll(operation);
        return utils.getResult(operation).getValue();
      } finally {
        await operation.close().catch(() => {
        });
      }
    }
    async function runHiveSql(sqlText, connectionConfig = {}) {
      const config = normalizeConnectionConfig(connectionConfig);
      const statements = splitHiveStatements(sqlText);
      const { TCLIService_types } = hive.thrift;
      const utils = new hive.HiveUtils(TCLIService_types);
      const hiveClient = createHiveClient(config);
      let connectedClient = null;
      let session = null;
      const rows = [];
      try {
        connectedClient = await withTimeout(hiveClient.connect(), DEFAULT_HIVE_TIMEOUT_MS, "Hive \u5BA2\u6237\u7AEF\u8FDE\u63A5");
        session = await connectedClient.openSession({
          client_protocol: TCLIService_types.TProtocolVersion.HIVE_CLI_SERVICE_PROTOCOL_V10
        });
        for (const statement of statements) {
          const result = await withTimeout(
            executeHiveStatement(session, utils, statement),
            DEFAULT_HIVE_TIMEOUT_MS,
            "Hive SQL \u6267\u884C"
          );
          if (Array.isArray(result) && result.length > 0) {
            rows.push(...result);
          }
        }
        return {
          stdout: rows.map((row) => JSON.stringify(row)).join("\n"),
          stderr: "",
          rows
        };
      } catch (error) {
        throw new Error(`Hive SQL \u6267\u884C\u5931\u8D25\uFF1A${error.message}`);
      } finally {
        if (session) {
          await session.close().catch(() => {
          });
        }
        if (connectedClient) {
          connectedClient.close();
        }
      }
    }
    async function tableExists(connectionConfig, tableName) {
      const config = normalizeConnectionConfig(connectionConfig);
      const sql = [
        `USE ${escapeHiveIdentifier(config.database)};`,
        `SHOW TABLES LIKE '${String(tableName || "").replace(/'/g, "\\'")}';`
      ].join("\n");
      const result = await runHiveSql(sql, config);
      return result.stdout.includes(tableName) || result.rows?.some((row) => Object.values(row).some((value) => String(value) === String(tableName)));
    }
    async function ensureTableExists(connectionConfig, tableName, columns, options = {}) {
      const config = normalizeConnectionConfig(connectionConfig);
      const sql = buildCreateTableSql(config.database, tableName, columns, options);
      await runHiveSql(sql, config);
      return { tableName, database: config.database, created: true };
    }
    function buildHiveValueLiteral(value, dataType) {
      const hiveType = normalizeHiveType(dataType);
      if (value === null || value === void 0 || value === "") {
        return "NULL";
      }
      if (["INT", "BIGINT", "FLOAT", "DOUBLE"].includes(hiveType)) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? String(numeric) : "NULL";
      }
      if (hiveType.startsWith("DECIMAL")) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? String(numeric) : "NULL";
      }
      if (hiveType === "BOOLEAN") {
        return value ? "TRUE" : "FALSE";
      }
      return `'${String(value).replace(/'/g, "''")}'`;
    }
    async function loadRows(connectionConfig, tableName, columns, rows, options = {}) {
      const config = normalizeConnectionConfig(connectionConfig);
      const writeMode = String(options.writeMode || "append").toLowerCase();
      const fileType = String(options.fileType || "parquet").toLowerCase();
      const targetColumns = columns.map((column) => ({
        columnName: column.columnName,
        dataType: column.dataType || column.columnType || "string"
      }));
      await ensureTableExists(config, tableName, targetColumns, { fileType });
      if (!Array.isArray(rows) || rows.length === 0) {
        if (writeMode === "overwrite") {
          await runHiveSql(
            [
              `USE ${escapeHiveIdentifier(config.database)};`,
              `TRUNCATE TABLE ${escapeHiveIdentifier(tableName)};`
            ].join("\n"),
            config
          );
        }
        return {
          rowCount: 0,
          writeMode
        };
      }
      const batchSize = Number(options.batchSize || 200);
      const batches = [];
      for (let index = 0; index < rows.length; index += batchSize) {
        batches.push(rows.slice(index, index + batchSize));
      }
      const statements = [`USE ${escapeHiveIdentifier(config.database)};`];
      batches.forEach((batch, index) => {
        const modeSql = writeMode === "overwrite" && index === 0 ? "INSERT OVERWRITE TABLE" : "INSERT INTO TABLE";
        const valuesSql = batch.map((row) => {
          const values = targetColumns.map((column) => buildHiveValueLiteral(row[column.columnName], column.dataType));
          return `(${values.join(", ")})`;
        }).join(",\n");
        statements.push(`${modeSql} ${escapeHiveIdentifier(tableName)} VALUES
${valuesSql};`);
      });
      await runHiveSql(statements.join("\n"), config);
      return {
        rowCount: rows.length,
        writeMode
      };
    }
    module2.exports = {
      normalizeConnectionConfig,
      tableExists,
      ensureTableExists,
      loadRows,
      runHiveSql
    };
  }
});

// backend/src/modules/data-development/adapters/hive.adapter.js
var require_hive_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/hive.adapter.js"(exports2, module2) {
    var hiveService = require_hiveService();
    var { applyResultLimit, cleanHiveOutput, parseCsvLine, parseTableName, quoteIdentifier, resolveDatasourceHost, resolveRuntimeDatasourceConfig } = require_data_development_utils();
    function resolveConfig(config, databaseName) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      return {
        host: resolveDatasourceHost(resolved.host),
        port: Number(resolved.port || 1e4),
        database: databaseName || resolved.databaseName || "default",
        username: resolved.username || "hive",
        password: resolved.password || "hive"
      };
    }
    async function runHiveSql(config, sql, databaseName, showHeader = false) {
      const resolved = resolveConfig(config, databaseName);
      const payload = [
        "!set silent true",
        `!set showHeader ${showHeader ? "true" : "false"}`,
        "!set outputformat csv2",
        `USE ${quoteIdentifier(resolved.database, "hive")};`,
        String(sql || "").trim().replace(/;+\s*$/, "") + ";"
      ].join("\n");
      const result = await hiveService.runHiveSql(payload, resolved);
      return {
        lines: cleanHiveOutput(result.stdout),
        executedSql: payload
      };
    }
    module2.exports = {
      async testConnection(config) {
        await runHiveSql(config, "SHOW DATABASES", config.databaseName, false);
        return { success: true, message: "Hive connection succeeded" };
      },
      async getDatabases(config) {
        const result = await runHiveSql(config, "SHOW DATABASES", config.databaseName, false);
        return result.lines.map((name) => ({ name }));
      },
      async getTables(config, databaseName) {
        const result = await runHiveSql(config, "SHOW TABLES", databaseName, false);
        return result.lines.map((name) => ({ name, type: "BASE TABLE", comment: null }));
      },
      async getColumns(config, databaseName, tableName) {
        const parsed = parseTableName(tableName, databaseName || config.databaseName || "default");
        const result = await runHiveSql(config, `DESCRIBE ${quoteIdentifier(parsed.table, "hive")}`, parsed.scope, false);
        return result.lines.filter((line) => line.includes(",")).map((line, index) => {
          const [name, type] = line.split(",");
          return {
            name: String(name || "").trim(),
            position: index + 1,
            dataType: String(type || "").trim(),
            columnType: String(type || "").trim(),
            nullable: true,
            primaryKey: false,
            defaultValue: null
          };
        }).filter((item) => item.name && !item.name.startsWith("#"));
      },
      async getFunctions() {
        return [];
      },
      async executeQuery(config, sql, options = {}) {
        const resolvedSql = applyResultLimit(sql, options.resultLimit, "hive");
        const result = await runHiveSql(config, resolvedSql, options.databaseName || config.databaseName, true);
        const [headerLine, ...dataLines] = result.lines.filter((line) => line.includes(","));
        const fields = headerLine ? parseCsvLine(headerLine) : [];
        const rows = dataLines.map((line) => {
          const values = parseCsvLine(line);
          return Object.fromEntries(fields.map((field, index) => [field, values[index] ?? null]));
        });
        return {
          fields,
          rows,
          rowCount: rows.length,
          executedSql: result.executedSql
        };
      },
      async executeStatement(config, sql, options = {}) {
        const result = await runHiveSql(config, sql, options.databaseName || config.databaseName, false);
        return {
          affectedRows: 0,
          message: result.lines.join("\n") || "Statement executed",
          executedSql: result.executedSql
        };
      }
    };
  }
});

// backend/src/common/utils/managed-jdbc-runtime.js
var require_managed_jdbc_runtime = __commonJS({
  "backend/src/common/utils/managed-jdbc-runtime.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { spawn, spawnSync } = require("child_process");
    var { getActiveDriverBinding, resolveDriverFile } = require_database_driver_store();
    var JAVA_SOURCE = path.resolve(__dirname, "../../runtime/jdbc/JdbcDriverRunner.java");
    var JAVA_CLASSES = path.resolve(process.cwd(), "runtime/database-drivers/java-runtime/classes");
    var JAVA_CLASS = "medata.jdbc.JdbcDriverRunner";
    function ensureJdbcRunnerCompiled() {
      const classFile = path.join(JAVA_CLASSES, "medata/jdbc/JdbcDriverRunner.class");
      const needsCompile = !fs.existsSync(classFile) || fs.statSync(classFile).mtimeMs < fs.statSync(JAVA_SOURCE).mtimeMs;
      if (!needsCompile) return JAVA_CLASSES;
      fs.mkdirSync(JAVA_CLASSES, { recursive: true });
      const result = spawnSync(process.env.JAVAC_BIN || "javac", ["-encoding", "UTF-8", "-d", JAVA_CLASSES, JAVA_SOURCE], {
        encoding: "utf8",
        windowsHide: true
      });
      if (result.status !== 0) {
        throw new Error(`JDBC \u8FD0\u884C\u5668\u7F16\u8BD1\u5931\u8D25: ${String(result.stderr || result.stdout || "javac \u4E0D\u53EF\u7528").trim()}`);
      }
      return JAVA_CLASSES;
    }
    function encode(value) {
      return Buffer.from(String(value ?? ""), "utf8").toString("base64");
    }
    function serializeParams(params = []) {
      const env = { JDBC_PARAM_COUNT: String(params.length) };
      params.forEach((value, index) => {
        const type = value === null || value === void 0 ? "null" : typeof value === "number" || typeof value === "bigint" ? "number" : typeof value === "boolean" ? "boolean" : "string";
        env[`JDBC_PARAM_${index}_TYPE`] = type;
        env[`JDBC_PARAM_${index}_VALUE_B64`] = encode(value ?? "");
      });
      return env;
    }
    function runJdbcAction(binding, action, payload = {}) {
      const classes = ensureJdbcRunnerCompiled();
      const driverFile = resolveDriverFile(binding.filePath);
      if (!fs.existsSync(driverFile)) throw new Error(`\u9A71\u52A8\u6587\u4EF6\u4E0D\u5B58\u5728: ${binding.filePath}`);
      const javaEnv = {
        PATH: process.env.PATH || "",
        Path: process.env.Path || "",
        SystemRoot: process.env.SystemRoot || "",
        JAVA_HOME: process.env.JAVA_HOME || "",
        TEMP: process.env.TEMP || "",
        TMP: process.env.TMP || "",
        LANG: process.env.LANG || "",
        LC_ALL: process.env.LC_ALL || "",
        JDBC_DRIVER_CLASS: binding.driverClass,
        JDBC_URL: payload.jdbcUrl || "",
        JDBC_USER: payload.username || "",
        JDBC_PASSWORD: payload.password || "",
        JDBC_SQL_BASE64: encode(payload.sql || ""),
        JDBC_MAX_ROWS: String(payload.maxRows || 1e3),
        JDBC_CATALOG: payload.catalog || "",
        JDBC_SCHEMA: payload.schema || "",
        JDBC_TABLE: payload.table || "",
        ...serializeParams(payload.params || [])
      };
      const classPath = `${classes}${path.delimiter}${driverFile}`;
      return new Promise((resolve, reject) => {
        const restrictedIdentity = process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() === 0 ? {
          uid: Number(process.env.JDBC_RUNNER_UID || 65534),
          gid: Number(process.env.JDBC_RUNNER_GID || 65534)
        } : {};
        const child = spawn(process.env.JAVA_BIN || "java", ["-cp", classPath, JAVA_CLASS, action], {
          env: javaEnv,
          windowsHide: true,
          shell: false,
          ...restrictedIdentity
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill();
        }, Number(payload.timeoutMs || 9e4));
        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });
        child.on("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          if (timedOut) {
            reject(new Error(`JDBC \u64CD\u4F5C\u8D85\u8FC7 ${Number(payload.timeoutMs || 9e4)} \u6BEB\u79D2\uFF0C\u5DF2\u7EC8\u6B62`));
            return;
          }
          const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
          let result;
          try {
            result = JSON.parse(line || "{}");
          } catch {
            result = null;
          }
          if (code !== 0 || !result || result.success === false) {
            reject(new Error(result?.error || stderr.trim() || stdout.trim() || `JDBC \u8FD0\u884C\u5668\u9000\u51FA\u7801 ${code}`));
            return;
          }
          resolve(result);
        });
      });
    }
    function getManagedBinding(databaseType) {
      const binding = getActiveDriverBinding(databaseType, "query");
      return binding?.filePath && binding?.driverClass ? binding : null;
    }
    module2.exports = {
      ensureJdbcRunnerCompiled,
      getManagedBinding,
      runJdbcAction
    };
  }
});

// backend/src/modules/data-development/adapters/managed-jdbc.adapter.js
var require_managed_jdbc_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/managed-jdbc.adapter.js"(exports2, module2) {
    var { getDatabaseCapability } = require_datasource_capabilities();
    var { buildJdbcUrl } = require_datasource_dialect();
    var { getManagedBinding, runJdbcAction } = require_managed_jdbc_runtime();
    var {
      applyResultLimit,
      parseTableName,
      resolveRuntimeDatasourceConfig
    } = require_data_development_utils();
    function readValue(row, ...names) {
      for (const name of names) {
        if (Object.prototype.hasOwnProperty.call(row || {}, name)) return row[name];
        const key = Object.keys(row || {}).find((candidate) => candidate.toLowerCase() === String(name).toLowerCase());
        if (key) return row[key];
      }
      return null;
    }
    function prepareSql(sql, binds) {
      let normalizedSql = String(sql || "").trim();
      if (!binds) return { sql: normalizedSql, params: [] };
      if (Array.isArray(binds)) {
        if (/\$\d+/.test(normalizedSql)) {
          const params2 = [];
          normalizedSql = normalizedSql.replace(/\$(\d+)/g, (token, index) => {
            params2.push(binds[Number(index) - 1]);
            return "?";
          });
          return { sql: normalizedSql, params: params2 };
        }
        return { sql: normalizedSql, params: binds };
      }
      const params = [];
      normalizedSql = normalizedSql.replace(/:([a-zA-Z][a-zA-Z0-9_]*)/g, (token, name) => {
        if (!Object.prototype.hasOwnProperty.call(binds, name)) return token;
        params.push(binds[name]);
        return "?";
      });
      return { sql: normalizedSql, params };
    }
    function connectionPayload(databaseType, config, databaseName, extras = {}) {
      const resolved = resolveRuntimeDatasourceConfig({ ...config, ...databaseName ? { databaseName } : {} });
      const jdbcUrl = buildJdbcUrl(databaseType, {
        host: resolved.host,
        port: resolved.port,
        database: databaseName || resolved.databaseName,
        databaseName: databaseName || resolved.databaseName,
        jdbcUrl: databaseName ? "" : resolved.jdbcUrl,
        connectionMode: resolved.connectionMode
      });
      const schema = extras.schema || resolved.schema || (["oracle", "dm"].includes(databaseType) ? resolved.username : databaseType === "postgresql" ? "public" : "");
      return {
        jdbcUrl,
        username: resolved.username,
        password: resolved.password,
        catalog: databaseType === "mysql" ? databaseName || resolved.databaseName || "" : databaseType === "postgresql" ? databaseName || resolved.databaseName || "" : "",
        ...extras,
        schema: databaseType === "mysql" ? "" : schema
      };
    }
    function groupBy(rows, keyResolver, initializer, append) {
      const grouped = /* @__PURE__ */ new Map();
      for (const row of rows || []) {
        const key = keyResolver(row);
        if (!key) continue;
        if (!grouped.has(key)) grouped.set(key, initializer(row, key));
        append(grouped.get(key), row);
      }
      return [...grouped.values()];
    }
    function createManagedJdbcAdapter(databaseType, nativeAdapter) {
      const withBinding = async (handler, fallback) => {
        const binding = getManagedBinding(databaseType);
        return binding ? handler(binding) : fallback();
      };
      return {
        ...nativeAdapter,
        async testConnection(config) {
          return withBinding(async (binding) => {
            const capability = getDatabaseCapability(databaseType);
            await runJdbcAction(binding, "test", { ...connectionPayload(databaseType, config), sql: capability.healthCheckSql });
            return { success: true, message: `${capability.label} JDBC \u9A71\u52A8\u8FDE\u63A5\u6210\u529F` };
          }, () => nativeAdapter.testConnection(config));
        },
        async getDatabases(config) {
          return withBinding(async (binding) => {
            const action = ["oracle", "dm"].includes(databaseType) ? "schemas" : "catalogs";
            const rows = await runJdbcAction(binding, action, connectionPayload(databaseType, config));
            return rows.map((row) => ({ name: readValue(row, "TABLE_CAT", "TABLE_SCHEM", "name") })).filter((row) => row.name);
          }, () => nativeAdapter.getDatabases(config));
        },
        async getSchemas(config) {
          return withBinding(async (binding) => {
            const rows = await runJdbcAction(binding, "schemas", connectionPayload(databaseType, config));
            return rows.map((row) => ({ name: readValue(row, "TABLE_SCHEM", "name") })).filter((row) => row.name);
          }, () => nativeAdapter.getSchemas ? nativeAdapter.getSchemas(config) : nativeAdapter.getDatabases(config));
        },
        async getTables(config, databaseName) {
          return withBinding(async (binding) => {
            const payload = connectionPayload(databaseType, config, databaseType === "mysql" || databaseType === "postgresql" ? databaseName : void 0, {
              schema: ["oracle", "dm"].includes(databaseType) ? databaseName : void 0
            });
            const rows = await runJdbcAction(binding, "tables", payload);
            return rows.map((row) => {
              const table = readValue(row, "TABLE_NAME");
              const schema = readValue(row, "TABLE_SCHEM");
              return {
                name: databaseType === "mysql" || !schema ? table : `${schema}.${table}`,
                type: readValue(row, "TABLE_TYPE") || "TABLE",
                comment: readValue(row, "REMARKS")
              };
            });
          }, () => nativeAdapter.getTables(config, databaseName));
        },
        async getColumns(config, databaseName, tableName) {
          return withBinding(async (binding) => {
            const parsed = parseTableName(tableName, databaseType === "postgresql" ? "public" : databaseName);
            const payload = connectionPayload(databaseType, config, databaseType === "mysql" || databaseType === "postgresql" ? databaseName : void 0, {
              schema: databaseType === "mysql" ? "" : parsed.scope,
              table: parsed.table
            });
            const rows = await runJdbcAction(binding, "columns", payload);
            return rows.map((row, index) => ({
              name: readValue(row, "COLUMN_NAME"),
              position: Number(readValue(row, "ORDINAL_POSITION") || index + 1),
              dataType: readValue(row, "TYPE_NAME") || String(readValue(row, "DATA_TYPE") || ""),
              columnType: readValue(row, "TYPE_NAME") || String(readValue(row, "DATA_TYPE") || ""),
              length: Number(readValue(row, "COLUMN_SIZE") || 0) || null,
              precision: Number(readValue(row, "COLUMN_SIZE") || 0) || null,
              scale: Number(readValue(row, "DECIMAL_DIGITS") || 0) || null,
              nullable: Number(readValue(row, "NULLABLE")) !== 0,
              primaryKey: Boolean(readValue(row, "PRIMARY_KEY")),
              defaultValue: readValue(row, "COLUMN_DEF"),
              comment: readValue(row, "REMARKS")
            }));
          }, () => nativeAdapter.getColumns(config, databaseName, tableName));
        },
        async getFunctions(config, databaseName) {
          return withBinding(async (binding) => {
            const payload = connectionPayload(databaseType, config, databaseType === "mysql" || databaseType === "postgresql" ? databaseName : void 0, {
              schema: ["oracle", "dm"].includes(databaseType) ? databaseName : void 0
            });
            const rows = await runJdbcAction(binding, "functions", payload);
            return rows.map((row) => ({
              name: readValue(row, "FUNCTION_NAME", "PROCEDURE_NAME"),
              type: readValue(row, "ROUTINE_KIND") || "FUNCTION",
              schema: readValue(row, "FUNCTION_SCHEM", "PROCEDURE_SCHEM")
            })).filter((row) => row.name);
          }, () => nativeAdapter.getFunctions(config, databaseName));
        },
        async getIndexes(config, databaseName, tableName) {
          return withBinding(async (binding) => {
            const parsed = parseTableName(tableName, databaseName);
            const scopedDatabase = ["mysql", "postgresql"].includes(databaseType) ? databaseName : void 0;
            const rows = await runJdbcAction(binding, "indexes", connectionPayload(databaseType, config, scopedDatabase, { schema: parsed.scope, table: parsed.table }));
            return groupBy(rows, (row) => readValue(row, "INDEX_NAME"), (row, key) => ({
              indexName: key,
              unique: !Boolean(readValue(row, "NON_UNIQUE")),
              indexType: readValue(row, "TYPE"),
              cardinality: readValue(row, "CARDINALITY"),
              columns: []
            }), (item, row) => {
              const column = readValue(row, "COLUMN_NAME");
              if (column) item.columns.push(column);
            });
          }, () => nativeAdapter.getIndexes ? nativeAdapter.getIndexes(config, databaseName, tableName) : []);
        },
        async getConstraints(config, databaseName, tableName) {
          return withBinding(async (binding) => {
            const parsed = parseTableName(tableName, databaseName);
            const scopedDatabase = ["mysql", "postgresql"].includes(databaseType) ? databaseName : void 0;
            const rows = await runJdbcAction(binding, "constraints", connectionPayload(databaseType, config, scopedDatabase, { schema: parsed.scope, table: parsed.table }));
            return groupBy(rows, (row) => readValue(row, "FK_NAME", "PK_NAME") || readValue(row, "CONSTRAINT_KIND"), (row, key) => ({
              constraintName: key,
              constraintType: readValue(row, "CONSTRAINT_KIND"),
              columns: [],
              references: []
            }), (item, row) => {
              const column = readValue(row, "FKCOLUMN_NAME", "COLUMN_NAME");
              if (column) item.columns.push(column);
              const referenceTable = readValue(row, "PKTABLE_NAME");
              const referenceColumn = readValue(row, "PKCOLUMN_NAME");
              if (referenceTable && referenceColumn) item.references.push({ tableName: referenceTable, columnName: referenceColumn });
            });
          }, () => nativeAdapter.getConstraints ? nativeAdapter.getConstraints(config, databaseName, tableName) : []);
        },
        async executeQuery(config, sql, options = {}) {
          return withBinding(async (binding) => {
            const limitedSql = applyResultLimit(sql, options.resultLimit, databaseType);
            const prepared = prepareSql(limitedSql, options.binds);
            const result = await runJdbcAction(binding, "query", {
              ...connectionPayload(databaseType, config, options.databaseName),
              sql: prepared.sql,
              params: prepared.params,
              maxRows: options.resultLimit || 1e3
            });
            return { ...result, executedSql: prepared.sql };
          }, () => nativeAdapter.executeQuery(config, sql, options));
        },
        async executeStatement(config, sql, options = {}) {
          return withBinding(async (binding) => {
            const prepared = prepareSql(String(sql || "").trim().replace(/;+\s*$/, ""), options.binds);
            const result = await runJdbcAction(binding, "statement", {
              ...connectionPayload(databaseType, config, options.databaseName),
              sql: prepared.sql,
              params: prepared.params
            });
            return { ...result, executedSql: prepared.sql };
          }, () => nativeAdapter.executeStatement(config, sql, options));
        }
      };
    }
    module2.exports = { createManagedJdbcAdapter, prepareSql };
  }
});

// backend/src/modules/data-development/adapters/index.js
var require_adapters = __commonJS({
  "backend/src/modules/data-development/adapters/index.js"(exports2, module2) {
    var mysqlAdapter = require_mysql_adapter();
    var postgresAdapter = require_postgres_adapter();
    var oracleAdapter = require_oracle_adapter();
    var dmAdapter = require_dm_adapter();
    var clickhouseAdapter = require_clickhouse_adapter();
    var hiveAdapter = require_hive_adapter();
    var { inferDatasourceDialect, normalizeDatasourceType } = require_data_development_utils();
    var { createManagedJdbcAdapter } = require_managed_jdbc_adapter();
    var managedAdapters = {
      mysql: createManagedJdbcAdapter("mysql", mysqlAdapter),
      postgresql: createManagedJdbcAdapter("postgresql", postgresAdapter),
      oracle: createManagedJdbcAdapter("oracle", oracleAdapter),
      dm: createManagedJdbcAdapter("dm", dmAdapter)
    };
    function getAdapter(input) {
      const normalized = input && typeof input === "object" ? inferDatasourceDialect(input) : normalizeDatasourceType(input);
      switch (normalized) {
        case "mysql":
          return managedAdapters.mysql;
        case "postgresql":
          return managedAdapters.postgresql;
        case "oracle":
          return managedAdapters.oracle;
        case "dm":
          return managedAdapters.dm;
        case "clickhouse":
          return clickhouseAdapter;
        case "hive":
          return hiveAdapter;
        default:
          throw new Error(`Unsupported datasource type: ${normalized || input}`);
      }
    }
    module2.exports = {
      getAdapter
    };
  }
});

// backend/src/modules/data-development/data-development.scheduler.js
var require_data_development_scheduler = __commonJS({
  "backend/src/modules/data-development/data-development.scheduler.js"(exports2, module2) {
    var cron = require("node-cron");
    var AppError = require_app_error();
    var repository = require_data_development_repository();
    var { getAdapter } = require_adapters();
    var {
      buildResultPreview,
      decryptSecret,
      formatDateTime,
      isQuerySql,
      normalizeDatasourceStorageType,
      resolveRuntimeDatasourceConfig
    } = require_data_development_utils();
    var scheduledTasks = /* @__PURE__ */ new Map();
    var activeRuns = /* @__PURE__ */ new Set();
    function materializeDatasource(datasource) {
      const password = decryptSecret(datasource.passwordEncrypted);
      const resolved = resolveRuntimeDatasourceConfig({
        ...datasource,
        password
      });
      return {
        ...datasource,
        type: resolved.dialect,
        storageType: normalizeDatasourceStorageType(datasource.type),
        host: resolved.host,
        port: resolved.port,
        databaseName: resolved.databaseName,
        username: resolved.username,
        extraConfig: resolved.extraConfig,
        password
      };
    }
    function buildNodeLookup(nodes) {
      return new Map(nodes.map((node) => [node.nodeKey, node]));
    }
    function buildTopologicalOrder(nodes, edges) {
      const inDegree = new Map(nodes.map((node) => [node.nodeKey, 0]));
      const graph = new Map(nodes.map((node) => [node.nodeKey, []]));
      for (const edge of edges) {
        if (!graph.has(edge.sourceNodeKey) || !graph.has(edge.targetNodeKey)) {
          throw new AppError(`Workflow edge references unknown node: ${edge.sourceNodeKey} -> ${edge.targetNodeKey}`, 400);
        }
        graph.get(edge.sourceNodeKey).push(edge.targetNodeKey);
        inDegree.set(edge.targetNodeKey, (inDegree.get(edge.targetNodeKey) || 0) + 1);
      }
      const queue = nodes.filter((node) => (inDegree.get(node.nodeKey) || 0) === 0).map((node) => node.nodeKey);
      const order = [];
      while (queue.length) {
        const nodeKey = queue.shift();
        order.push(nodeKey);
        for (const next of graph.get(nodeKey) || []) {
          inDegree.set(next, (inDegree.get(next) || 0) - 1);
          if ((inDegree.get(next) || 0) === 0) {
            queue.push(next);
          }
        }
      }
      if (order.length !== nodes.length) {
        throw new AppError("Workflow graph contains a cycle", 400);
      }
      return order;
    }
    async function runWithTimeout(task, timeoutSec) {
      const timeoutMs = Math.max(1, Number(timeoutSec || 300)) * 1e3;
      let timer;
      try {
        return await Promise.race([
          task(),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error(`Execution timed out after ${timeoutSec}s`));
            }, timeoutMs);
          })
        ]);
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }
    async function appendLog(instanceId, logType, content) {
      await repository.createJobLog({
        instanceId,
        logType,
        content
      });
    }
    function resolveRuntimeParams(workflow, run) {
      const defaults = workflow.runtimeConfig?.defaultParams;
      return {
        ...defaults && typeof defaults === "object" ? defaults : {},
        ...run.runParams && typeof run.runParams === "object" ? run.runParams : {}
      };
    }
    function interpolateTemplate(value, params) {
      return String(value ?? "").replace(/\$\{([^}]+)\}/g, (_, key) => {
        const trimmedKey = String(key || "").trim();
        const replacement = params[trimmedKey];
        return replacement === null || replacement === void 0 ? "" : String(replacement);
      });
    }
    function parseScalarValue(value) {
      if (value === null || value === void 0) {
        return null;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return value;
      }
      const text = String(value).trim();
      if (!text) {
        return "";
      }
      if (/^(true|false)$/i.test(text)) {
        return text.toLowerCase() === "true";
      }
      if (/^null$/i.test(text)) {
        return null;
      }
      const numeric = Number(text);
      if (!Number.isNaN(numeric) && text === String(numeric)) {
        return numeric;
      }
      return text;
    }
    function compareBranchValue(actualValue, operator, expectedValue) {
      const op = String(operator || "eq").toLowerCase();
      const actual = parseScalarValue(actualValue);
      const expected = parseScalarValue(expectedValue);
      switch (op) {
        case "eq":
          return actual === expected;
        case "ne":
          return actual !== expected;
        case "gt":
          return Number(actual) > Number(expected);
        case "gte":
          return Number(actual) >= Number(expected);
        case "lt":
          return Number(actual) < Number(expected);
        case "lte":
          return Number(actual) <= Number(expected);
        case "contains":
          return String(actual ?? "").includes(String(expected ?? ""));
        case "in": {
          const candidates = Array.isArray(expected) ? expected : String(expected ?? "").split(",").map((item) => parseScalarValue(item));
          return candidates.some((candidate) => candidate === actual);
        }
        default:
          throw new Error(`Unsupported branch operator: ${operator}`);
      }
    }
    function extractFirstCell(result) {
      const firstRow = Array.isArray(result?.rows) ? result.rows[0] : null;
      if (!firstRow || typeof firstRow !== "object") {
        return null;
      }
      const firstKey = Object.keys(firstRow)[0];
      return firstKey ? firstRow[firstKey] : null;
    }
    async function markInstanceSuccess(instance, payload = {}) {
      const finishedAt = /* @__PURE__ */ new Date();
      return repository.updateJobInstance(instance.id, {
        status: "success",
        startedAt: instance.startedAt || /* @__PURE__ */ new Date(),
        finishedAt,
        durationMs: finishedAt.getTime() - new Date(instance.startedAt || finishedAt).getTime(),
        retryCount: payload.retryCount || 0,
        errorMessage: null,
        resultPreview: payload.resultPreview || null,
        branchResult: payload.branchResult || null
      });
    }
    async function markInstanceFailure(instance, error, retryCount = 0) {
      const finishedAt = /* @__PURE__ */ new Date();
      return repository.updateJobInstance(instance.id, {
        status: "failed",
        startedAt: instance.startedAt || /* @__PURE__ */ new Date(),
        finishedAt,
        durationMs: finishedAt.getTime() - new Date(instance.startedAt || finishedAt).getTime(),
        retryCount,
        errorMessage: error?.message || "Node execution failed",
        resultPreview: null,
        branchResult: null
      });
    }
    function waitForRetry(seconds) {
      const delayMs = Math.max(0, Number(seconds || 0)) * 1e3;
      if (!delayMs) return Promise.resolve();
      return new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    async function executeScriptNode({ node, instance, params }) {
      const script = await repository.getScriptById(node.scriptId);
      if (!script) {
        throw new AppError(`Script not found for node ${node.nodeName}`, 404);
      }
      const datasource = await repository.getDatasourceById(script.datasourceId, true);
      if (!datasource) {
        throw new AppError(`Datasource not found for script ${script.name}`, 404);
      }
      const connection = materializeDatasource(datasource);
      const adapter = getAdapter(connection);
      const resultLimit = Number(node.nodeConfig?.resultLimit || 200);
      const databaseName = interpolateTemplate(
        node.nodeConfig?.databaseName || script.defaultDatabase || datasource.databaseName || "",
        params
      ) || void 0;
      const renderedSql = interpolateTemplate(script.content, params);
      await appendLog(instance.id, "sql", renderedSql);
      const result = isQuerySql(renderedSql) ? await adapter.executeQuery(connection, renderedSql, { databaseName, resultLimit }) : await adapter.executeStatement(connection, renderedSql, { databaseName });
      return { resultPreview: buildResultPreview(result) };
    }
    async function executeBranchNode({ node, instance, params, edgeLookup }) {
      const datasourceId = Number(node.nodeConfig?.datasourceId || 0);
      if (!datasourceId) {
        throw new Error(`Branch node ${node.nodeName} is missing datasource configuration`);
      }
      const datasource = await repository.getDatasourceById(datasourceId, true);
      if (!datasource) {
        throw new AppError(`Datasource not found for branch node ${node.nodeName}`, 404);
      }
      const connection = materializeDatasource(datasource);
      const adapter = getAdapter(connection);
      const resultLimit = Number(node.nodeConfig?.resultLimit || 1);
      const databaseName = interpolateTemplate(
        node.nodeConfig?.databaseName || datasource.databaseName || "",
        params
      ) || void 0;
      const sqlText = interpolateTemplate(node.nodeConfig?.sqlText || "", params);
      if (!isQuerySql(sqlText)) {
        throw new Error(`Branch node ${node.nodeName} must use query SQL`);
      }
      const operator = node.nodeConfig?.operator || "eq";
      const expectedValue = interpolateTemplate(node.nodeConfig?.expectedValue ?? "", params);
      await appendLog(instance.id, "sql", sqlText);
      const result = await adapter.executeQuery(connection, sqlText, { databaseName, resultLimit });
      const actualValue = extractFirstCell(result);
      const matched = result.rowCount ? compareBranchValue(actualValue, operator, expectedValue) : Boolean(node.nodeConfig?.emptyAs);
      const selectedEdgeLabel = matched ? "true" : "false";
      const outgoing = edgeLookup.get(node.nodeKey) || [];
      const selectedEdge = outgoing.find((edge) => String(edge.edgeLabel || "default").toLowerCase() === selectedEdgeLabel);
      if (!selectedEdge) {
        throw new Error(`Branch node ${node.nodeName} cannot find ${selectedEdgeLabel} edge`);
      }
      const branchResult = {
        actualValue,
        expectedValue: parseScalarValue(expectedValue),
        operator,
        matched,
        selectedEdgeLabel
      };
      await appendLog(
        instance.id,
        "branch",
        `Branch result: actual=${String(actualValue)} operator=${operator} expected=${String(expectedValue)} matched=${matched}`
      );
      await appendLog(instance.id, "route", `Branch selected ${selectedEdgeLabel} -> ${selectedEdge.targetNodeKey}`);
      return {
        selectedEdgeLabel,
        resultPreview: buildResultPreview(result),
        branchResult
      };
    }
    async function executePassiveNode({ node, instance }) {
      await appendLog(instance.id, "info", `Node ${node.nodeName} executed`);
      return { resultPreview: null };
    }
    async function executeProcessingNode({ node, params }) {
      const service = require_data_development_service();
      const result = await service.runProcessingJob(node.processingJobId, {
        triggerType: "workflow",
        ...node.nodeConfig?.versionNo ? { versionNo: Number(node.nodeConfig.versionNo) } : {},
        ...node.nodeConfig?.outputMode ? { outputMode: node.nodeConfig.outputMode } : {},
        ...node.nodeConfig?.targetTableName ? { targetTableName: interpolateTemplate(node.nodeConfig.targetTableName, params) } : {}
      });
      if (result?.runStatus === "failed") {
        throw new Error(result.errorMessage || `\u6570\u636E\u5904\u7406\u4EFB\u52A1 ${node.nodeName} \u6267\u884C\u5931\u8D25`);
      }
      return {
        resultPreview: result?.resultPreview || {
          rowCount: result?.outputRowCount || 0,
          affectedRows: result?.affectedRows || 0
        }
      };
    }
    async function executeOperatorTaskNode({ node }) {
      const service = require_data_development_service();
      const result = await service.runOrchestration(node.orchestrationTaskId);
      return {
        resultPreview: {
          rowCount: 0,
          affectedRows: result?.statementCount || 0,
          rows: [{ targetTables: result?.targetTables || [], warnings: result?.warnings || [] }]
        }
      };
    }
    async function executeNodeOnce(context) {
      switch (context.node.nodeType) {
        case "start":
        case "end":
        case "parallel":
        case "join":
          return executePassiveNode(context);
        case "script":
          return executeScriptNode(context);
        case "processing":
          return executeProcessingNode(context);
        case "operator_task":
          return executeOperatorTaskNode(context);
        case "branch":
          return executeBranchNode(context);
        default:
          throw new Error(`Unsupported node type: ${context.node.nodeType}`);
      }
    }
    async function executeNodeWithRetry({ workflow, run, node, params, edgeLookup, workflowAttempt }) {
      const startedAt = /* @__PURE__ */ new Date();
      const instance = {
        ...await repository.createJobInstance({
          workflowRunId: run.id,
          workflowId: workflow.id,
          workflowNodeId: node.id,
          nodeType: node.nodeType,
          scriptId: node.scriptId,
          processingJobId: node.processingJobId,
          orchestrationTaskId: node.orchestrationTaskId,
          triggerType: run.triggerType,
          status: "running",
          startedAt,
          retryCount: 0,
          runAttempt: workflowAttempt
        }),
        // MySQL DATETIME columns do not preserve milliseconds. Keep the in-memory
        // start time so sub-second nodes never produce a negative duration.
        startedAt
      };
      await appendLog(instance.id, "info", `\u8282\u70B9 ${node.nodeName} \u4E8E ${formatDateTime()} \u5F00\u59CB\u6267\u884C`);
      const retryTimes = node.retryTimes === null || node.retryTimes === void 0 ? Number(node.nodeConfig?.retryTimes || 0) : Number(node.retryTimes);
      const retryIntervalSec = Number(node.retryIntervalSec ?? node.nodeConfig?.retryIntervalSec ?? 5);
      const timeoutSec = Number(node.timeoutSec ?? node.nodeConfig?.timeoutSec ?? workflow.timeoutSec ?? 300);
      let lastError;
      for (let attempt = 0; attempt <= retryTimes; attempt += 1) {
        if (attempt > 0) {
          await appendLog(instance.id, "retry", `\u8282\u70B9\u91CD\u8BD5 ${attempt}/${retryTimes}\uFF0C\u7B49\u5F85 ${retryIntervalSec} \u79D2`);
          await waitForRetry(retryIntervalSec);
        }
        try {
          const outcome = await runWithTimeout(
            () => executeNodeOnce({ workflow, run, node, instance, params, edgeLookup }),
            timeoutSec
          );
          await markInstanceSuccess(instance, {
            retryCount: attempt,
            resultPreview: outcome?.resultPreview || null,
            branchResult: outcome?.branchResult || null
          });
          await appendLog(instance.id, "success", `\u8282\u70B9 ${node.nodeName} \u6267\u884C\u6210\u529F`);
          return { success: true, outcome: outcome || {}, instance };
        } catch (error) {
          lastError = error;
          await appendLog(instance.id, "error", error.message || "\u8282\u70B9\u6267\u884C\u5931\u8D25");
        }
      }
      await markInstanceFailure(instance, lastError, retryTimes);
      return { success: false, error: lastError || new Error(`\u8282\u70B9 ${node.nodeName} \u6267\u884C\u5931\u8D25`), instance };
    }
    function buildDagState(nodes, edges) {
      const nodeLookup = buildNodeLookup(nodes);
      const incoming = new Map(nodes.map((node) => [node.nodeKey, []]));
      const outgoing = new Map(nodes.map((node) => [node.nodeKey, []]));
      const edgeStates = /* @__PURE__ */ new Map();
      edges.forEach((edge, index) => {
        const runtimeEdge = { ...edge, runtimeKey: `${edge.sourceNodeKey}:${edge.targetNodeKey}:${edge.edgeLabel || "default"}:${index}` };
        incoming.get(edge.targetNodeKey)?.push(runtimeEdge);
        outgoing.get(edge.sourceNodeKey)?.push(runtimeEdge);
        edgeStates.set(runtimeEdge.runtimeKey, "pending");
      });
      return { nodeLookup, incoming, outgoing, edgeStates };
    }
    function settleOutgoingEdges(node, success, outcome, dag) {
      const outgoing = dag.outgoing.get(node.nodeKey) || [];
      for (const edge of outgoing) {
        let state = success || node.nodeType !== "branch" ? "active" : "inactive";
        if (node.nodeType === "branch" && success) {
          state = String(edge.edgeLabel || "default").toLowerCase() === outcome.selectedEdgeLabel ? "active" : "inactive";
        }
        dag.edgeStates.set(edge.runtimeKey, state);
      }
    }
    function deactivateOutgoingEdges(node, dag) {
      for (const edge of dag.outgoing.get(node.nodeKey) || []) {
        dag.edgeStates.set(edge.runtimeKey, "inactive");
      }
    }
    async function createSkippedInstance(workflow, run, node, workflowAttempt, reason) {
      const now = /* @__PURE__ */ new Date();
      const instance = await repository.createJobInstance({
        workflowRunId: run.id,
        workflowId: workflow.id,
        workflowNodeId: node.id,
        nodeType: node.nodeType,
        scriptId: node.scriptId,
        processingJobId: node.processingJobId,
        orchestrationTaskId: node.orchestrationTaskId,
        triggerType: run.triggerType,
        status: "skipped",
        startedAt: now,
        retryCount: 0,
        runAttempt: workflowAttempt
      });
      await repository.updateJobInstance(instance.id, {
        status: "skipped",
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        retryCount: 0,
        errorMessage: reason,
        resultPreview: null,
        branchResult: null
      });
      await appendLog(instance.id, "skip", reason);
    }
    async function executeDag(workflow, run, workflowAttempt) {
      buildTopologicalOrder(workflow.nodes, workflow.edges);
      const dag = buildDagState(workflow.nodes, workflow.edges);
      const statuses = new Map(workflow.nodes.map((node) => [node.nodeKey, "pending"]));
      const params = resolveRuntimeParams(workflow, run);
      while ([...statuses.values()].some((status) => status === "pending")) {
        const ready = [];
        let progressed = false;
        for (const node of workflow.nodes) {
          if (statuses.get(node.nodeKey) !== "pending") continue;
          const incoming = dag.incoming.get(node.nodeKey) || [];
          if (!incoming.length) {
            if (node.nodeType === "start") ready.push(node);
            continue;
          }
          if (!incoming.every((edge) => dag.edgeStates.get(edge.runtimeKey) !== "pending")) continue;
          const activeIncoming = incoming.filter((edge) => dag.edgeStates.get(edge.runtimeKey) === "active");
          if (!activeIncoming.length) {
            statuses.set(node.nodeKey, "skipped");
            deactivateOutgoingEdges(node, dag);
            await createSkippedInstance(workflow, run, node, workflowAttempt, "\u4E0A\u6E38\u5206\u652F\u672A\u6FC0\u6D3B\uFF0C\u8282\u70B9\u5DF2\u8DF3\u8FC7");
            progressed = true;
            continue;
          }
          const triggerRule = node.triggerRule || "all_success";
          const activeSourceStatuses = activeIncoming.map((edge) => statuses.get(edge.sourceNodeKey));
          if (triggerRule === "all_success" && activeSourceStatuses.some((status) => status !== "success")) {
            statuses.set(node.nodeKey, "skipped");
            deactivateOutgoingEdges(node, dag);
            await createSkippedInstance(workflow, run, node, workflowAttempt, "\u4E0A\u6E38\u5B58\u5728\u5931\u8D25\u8282\u70B9\uFF0C\u672A\u6EE1\u8DB3\u5168\u90E8\u6210\u529F\u89E6\u53D1\u89C4\u5219");
            progressed = true;
            continue;
          }
          ready.push(node);
        }
        if (ready.length) {
          progressed = true;
          ready.forEach((node) => statuses.set(node.nodeKey, "running"));
          const results = await Promise.all(ready.map((node) => executeNodeWithRetry({
            workflow,
            run,
            node,
            params,
            edgeLookup: dag.outgoing,
            workflowAttempt
          })));
          results.forEach((result, index) => {
            const node = ready[index];
            statuses.set(node.nodeKey, result.success ? "success" : "failed");
            settleOutgoingEdges(node, result.success, result.outcome || {}, dag);
          });
        }
        if (!progressed) {
          const pendingNames = workflow.nodes.filter((node) => statuses.get(node.nodeKey) === "pending").map((node) => node.nodeName).join("\u3001");
          throw new Error(`\u5DE5\u4F5C\u6D41\u65E0\u6CD5\u7EE7\u7EED\u63A8\u8FDB\uFF0C\u5F85\u5904\u7406\u8282\u70B9\uFF1A${pendingNames}`);
        }
      }
      const failedNodes = workflow.nodes.filter((node) => statuses.get(node.nodeKey) === "failed");
      if (failedNodes.length) {
        throw new Error(`\u5DE5\u4F5C\u6D41\u5B58\u5728\u5931\u8D25\u8282\u70B9\uFF1A${failedNodes.map((node) => node.nodeName).join("\u3001")}`);
      }
      return statuses;
    }
    function resolveRunWorkflow(currentWorkflow, run) {
      const snapshot = run.graphSnapshot;
      if (!snapshot || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) {
        return currentWorkflow;
      }
      return {
        ...currentWorkflow,
        name: snapshot.name || currentWorkflow.name,
        retryTimes: Number(snapshot.retryTimes ?? currentWorkflow.retryTimes ?? 0),
        timeoutSec: Number(snapshot.timeoutSec ?? currentWorkflow.timeoutSec ?? 300),
        runtimeConfig: snapshot.runtimeConfig || currentWorkflow.runtimeConfig || {},
        nodes: snapshot.nodes,
        edges: snapshot.edges
      };
    }
    async function executeWorkflowRun(runId) {
      if (activeRuns.has(runId)) return;
      activeRuns.add(runId);
      const runStartedAt = /* @__PURE__ */ new Date();
      try {
        const run = await repository.getWorkflowRunById(runId);
        if (!run) throw new AppError("Workflow run not found", 404);
        const currentWorkflow = await repository.getWorkflowById(run.workflowId);
        if (!currentWorkflow) throw new AppError("Workflow not found", 404);
        const workflow = resolveRunWorkflow(currentWorkflow, run);
        if (!workflow.nodes.length) throw new AppError("Workflow has no nodes", 400);
        await repository.updateWorkflowRun(runId, {
          status: "running",
          startedAt: runStartedAt,
          finishedAt: null,
          durationMs: null,
          errorMessage: null,
          workflowRetryCount: 0
        });
        const workflowRetryTimes = Number(workflow.retryTimes || 0);
        let lastError;
        for (let attempt = 0; attempt <= workflowRetryTimes; attempt += 1) {
          if (attempt > 0) {
            await repository.updateWorkflowRun(runId, {
              status: "running",
              startedAt: runStartedAt,
              finishedAt: null,
              durationMs: null,
              errorMessage: lastError?.message || null,
              workflowRetryCount: attempt
            });
          }
          try {
            await executeDag(workflow, run, attempt + 1);
            const finishedAt = /* @__PURE__ */ new Date();
            await repository.updateWorkflowRun(runId, {
              status: "success",
              startedAt: runStartedAt,
              finishedAt,
              durationMs: finishedAt.getTime() - runStartedAt.getTime(),
              errorMessage: null,
              workflowRetryCount: attempt
            });
            return;
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError || new Error("Workflow execution failed");
      } catch (error) {
        const finishedAt = /* @__PURE__ */ new Date();
        await repository.updateWorkflowRun(runId, {
          status: "failed",
          startedAt: runStartedAt,
          finishedAt,
          durationMs: finishedAt.getTime() - runStartedAt.getTime(),
          errorMessage: error.message || "Workflow execution failed",
          workflowRetryCount: Number((await repository.getWorkflowRunById(runId))?.workflowRetryCount || 0)
        });
      } finally {
        activeRuns.delete(runId);
      }
    }
    function enqueueWorkflowRun(runId) {
      setTimeout(() => {
        void executeWorkflowRun(runId);
      }, 0);
    }
    function clearSchedule(workflowId) {
      const existing = scheduledTasks.get(workflowId);
      if (existing) {
        existing.stop();
        scheduledTasks.delete(workflowId);
      }
    }
    function normalizeScheduledDate(value = /* @__PURE__ */ new Date()) {
      const scheduledDate = new Date(value);
      scheduledDate.setMilliseconds(0);
      return scheduledDate;
    }
    function upsertWorkflowSchedule(workflow) {
      clearSchedule(workflow.id);
      if (!workflow.cronExpr || workflow.isPaused || !workflow.publishedVersionNo) {
        return;
      }
      if (!cron.validate(workflow.cronExpr)) {
        return;
      }
      const task = cron.schedule(workflow.cronExpr, async () => {
        try {
          const version = await repository.getPublishedWorkflowVersion(workflow.id);
          if (!version) return;
          const scheduledDate = normalizeScheduledDate();
          const scheduledAt = formatDateTime(scheduledDate);
          const existing = await repository.findScheduledWorkflowRun(workflow.id, scheduledAt);
          if (existing) return;
          const run = await repository.createWorkflowRun({
            workflowId: workflow.id,
            triggerType: "cron",
            runParams: {},
            status: "pending",
            workflowVersionNo: version.versionNo,
            graphSnapshot: version.graphSnapshot,
            workflowRetryCount: 0,
            scheduledAt,
            startedAt: null
          });
          enqueueWorkflowRun(run.id);
        } catch (error) {
          console.error(`[workflow-scheduler] failed to create scheduled run for workflow ${workflow.id}:`, error);
        }
      });
      scheduledTasks.set(workflow.id, task);
    }
    async function reloadSchedules() {
      const workflows = await repository.listWorkflows();
      const workflowIds = new Set(workflows.map((workflow) => workflow.id));
      for (const workflowId of scheduledTasks.keys()) {
        if (!workflowIds.has(workflowId)) {
          clearSchedule(workflowId);
        }
      }
      for (const workflow of workflows) {
        upsertWorkflowSchedule(workflow);
      }
    }
    async function startScheduler() {
      await reloadSchedules();
      const recoverableRuns = await repository.listRecoverableWorkflowRuns();
      for (const run of recoverableRuns) {
        enqueueWorkflowRun(run.id);
      }
    }
    module2.exports = {
      buildTopologicalOrder,
      executeDag,
      enqueueWorkflowRun,
      executeWorkflowRun,
      reloadSchedules,
      normalizeScheduledDate,
      startScheduler,
      upsertWorkflowSchedule,
      validateCronExpression: cron.validate
    };
  }
});

// backend/src/modules/data-development/data-development.sql-parser.js
var require_data_development_sql_parser = __commonJS({
  "backend/src/modules/data-development/data-development.sql-parser.js"(exports2, module2) {
    var { Parser } = require("node-sql-parser");
    var AppError = require_app_error();
    var { normalizeDatasourceType } = require_data_development_utils();
    var parser = new Parser();
    var DIALECT_MAP = {
      mysql: "MySQL",
      postgresql: "Postgresql",
      dm: "Postgresql",
      oracle: "MySQL",
      clickhouse: "MySQL",
      hive: "Hive"
    };
    function resolveParserDialect(type) {
      const normalized = normalizeDatasourceType(type);
      return DIALECT_MAP[normalized] || "MySQL";
    }
    function parseSql(sqlText, type) {
      const dialect = resolveParserDialect(type);
      try {
        return parser.astify(String(sqlText || ""), { database: dialect });
      } catch (error) {
        throw new AppError(`SQL \u8BED\u6CD5\u6821\u9A8C\u5931\u8D25: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
      }
    }
    function splitStatements(sqlText, type) {
      const ast = parseSql(sqlText, type);
      return (Array.isArray(ast) ? ast : [ast]).map((item) => parser.sqlify(item, { database: resolveParserDialect(type) }).trim()).filter(Boolean);
    }
    function extractTables(sqlText, type) {
      const dialect = resolveParserDialect(type);
      try {
        const tableList = parser.tableList(String(sqlText || ""), { database: dialect });
        return tableList.map((item) => {
          const [, schemaName, tableName] = String(item || "").split("::");
          return schemaName && schemaName !== "null" ? `${schemaName}.${tableName}` : tableName;
        });
      } catch {
        return [];
      }
    }
    function safeAstify(sqlText, type) {
      const dialect = resolveParserDialect(type);
      try {
        return parser.astify(String(sqlText || ""), { database: dialect });
      } catch {
        return null;
      }
    }
    function normalizeIdentifier(value) {
      if (value && typeof value === "object") {
        if (typeof value.value === "string") {
          return normalizeIdentifier(value.value);
        }
        if (typeof value.column === "string") {
          return normalizeIdentifier(value.column);
        }
        if (value.expr) {
          return normalizeIdentifier(value.expr.value || value.expr.column || value.expr);
        }
      }
      const text = String(value || "").trim();
      if (!text) {
        return "";
      }
      if (text.startsWith("`") && text.endsWith("`") || text.startsWith('"') && text.endsWith('"') || text.startsWith("[") && text.endsWith("]")) {
        return text.slice(1, -1).trim();
      }
      return text;
    }
    function normalizeSourceColumnMap(sourceColumnsByTable) {
      const result = /* @__PURE__ */ new Map();
      Object.entries(sourceColumnsByTable || {}).forEach(([key, columns]) => {
        const normalizedKey = normalizeIdentifier(key);
        if (!normalizedKey) {
          return;
        }
        result.set(
          normalizedKey,
          (Array.isArray(columns) ? columns : []).map((item) => normalizeIdentifier(item)).filter(Boolean)
        );
      });
      return result;
    }
    function uniqueColumns(columns) {
      const output = [];
      const seen = /* @__PURE__ */ new Set();
      (Array.isArray(columns) ? columns : []).forEach((item) => {
        const normalized = normalizeIdentifier(item);
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          output.push(normalized);
        }
      });
      return output;
    }
    function inferExpressionOutputName(expr, index) {
      if (!expr || typeof expr !== "object") {
        return `expr_${index + 1}`;
      }
      if (expr.type === "column_ref" && expr.column && expr.column !== "*") {
        return normalizeIdentifier(expr.column);
      }
      if (expr.type === "aggr_func") {
        return normalizeIdentifier(String(expr.name || "").toLowerCase()) || `expr_${index + 1}`;
      }
      if (expr.type === "function") {
        const functionName = Array.isArray(expr.name?.name) ? expr.name.name.map((item) => normalizeIdentifier(item?.value)).filter(Boolean).join("_") : normalizeIdentifier(expr.name?.name || expr.name?.value || expr.name);
        return functionName || `expr_${index + 1}`;
      }
      if (expr.type === "case") {
        return `case_${index + 1}`;
      }
      if (expr.type === "number" || expr.type === "string" || expr.type === "single_quote_string") {
        return `expr_${index + 1}`;
      }
      return `expr_${index + 1}`;
    }
    function inferColumnsFromStatement(statement, context) {
      if (!statement || typeof statement !== "object") {
        return { columns: [], complete: false };
      }
      if (statement.ast) {
        return inferColumnsFromStatement(statement.ast, context);
      }
      if (Array.isArray(statement)) {
        const lastStatement = statement[statement.length - 1];
        return inferColumnsFromStatement(lastStatement, context);
      }
      if (statement.type !== "select") {
        return { columns: [], complete: false };
      }
      const sourceColumns = context?.sourceColumns || /* @__PURE__ */ new Map();
      const cteCache = context?.cteCache || /* @__PURE__ */ new Map();
      const localSourceColumns = new Map(sourceColumns);
      const withList = Array.isArray(statement.with) ? statement.with : [];
      withList.forEach((cte) => {
        const cteName = normalizeIdentifier(cte?.name?.value || cte?.name);
        if (!cteName) {
          return;
        }
        if (Array.isArray(cte.columns) && cte.columns.length) {
          const explicitColumns = uniqueColumns(cte.columns.map((item) => item?.column || item?.value || item));
          cteCache.set(cteName, explicitColumns);
          localSourceColumns.set(cteName, explicitColumns);
          return;
        }
        const cteResult = inferColumnsFromStatement(cte?.stmt?.ast || cte?.stmt, {
          sourceColumns: localSourceColumns,
          cteCache
        });
        const cteColumns = uniqueColumns(cteResult.columns);
        cteCache.set(cteName, cteColumns);
        localSourceColumns.set(cteName, cteColumns);
      });
      const tableSchemaMap = /* @__PURE__ */ new Map();
      (Array.isArray(statement.from) ? statement.from : []).forEach((item) => {
        const alias = normalizeIdentifier(item?.as);
        if (item?.expr?.ast) {
          const subqueryResult = inferColumnsFromStatement(item.expr.ast, {
            sourceColumns: localSourceColumns,
            cteCache
          });
          const subqueryColumns = uniqueColumns(subqueryResult.columns);
          if (alias) {
            tableSchemaMap.set(alias, subqueryColumns);
          }
          return;
        }
        const tableName = normalizeIdentifier(item?.table);
        const resolvedColumns = uniqueColumns(
          tableSchemaMap.get(tableName) || localSourceColumns.get(tableName) || cteCache.get(tableName) || []
        );
        if (tableName) {
          tableSchemaMap.set(tableName, resolvedColumns);
        }
        if (alias) {
          tableSchemaMap.set(alias, resolvedColumns);
        }
      });
      const outputColumns = [];
      let complete = true;
      (Array.isArray(statement.columns) ? statement.columns : []).forEach((column, index) => {
        const alias = normalizeIdentifier(column?.as);
        if (alias) {
          outputColumns.push(alias);
          return;
        }
        const expr = column?.expr || {};
        if (expr.type === "column_ref" && expr.column === "*") {
          if (expr.table) {
            const scopedColumns = uniqueColumns(tableSchemaMap.get(normalizeIdentifier(expr.table)) || []);
            if (scopedColumns.length) {
              outputColumns.push(...scopedColumns);
            } else {
              complete = false;
            }
            return;
          }
          const mergedColumns = uniqueColumns(
            Array.from(tableSchemaMap.values()).flat()
          );
          if (mergedColumns.length) {
            outputColumns.push(...mergedColumns);
          } else {
            complete = false;
          }
          return;
        }
        const inferredName = inferExpressionOutputName(expr, index);
        if (inferredName) {
          outputColumns.push(inferredName);
          if (!["column_ref"].includes(expr.type || "")) {
            complete = false;
          }
        }
      });
      return {
        columns: uniqueColumns(outputColumns),
        complete
      };
    }
    function inferSelectOutputColumns(sqlText, type, sourceColumnsByTable = {}) {
      const ast = safeAstify(sqlText, type);
      if (!ast) {
        return {
          columns: [],
          complete: false
        };
      }
      return inferColumnsFromStatement(ast, {
        sourceColumns: normalizeSourceColumnMap(sourceColumnsByTable),
        cteCache: /* @__PURE__ */ new Map()
      });
    }
    module2.exports = {
      parseSql,
      splitStatements,
      extractTables,
      inferSelectOutputColumns
    };
  }
});

// backend/src/modules/model-providers/model-provider.repository.js
var require_model_provider_repository = __commonJS({
  "backend/src/modules/model-providers/model-provider.repository.js"(exports2, module2) {
    var { pool } = require_database();
    function mapRow(row) {
      let extraConfig = row.extraConfig;
      if (typeof extraConfig === "string") {
        try {
          extraConfig = JSON.parse(extraConfig);
        } catch (error) {
          extraConfig = {};
        }
      }
      return {
        ...row,
        modelVersion: row.modelVersion || null,
        extraConfig: extraConfig || {}
      };
    }
    async function getModelProviderById(id) {
      const [rows] = await pool.query(
        `SELECT id, config_name AS configName, config_code AS configCode, provider_type AS providerType,
            model_category AS modelCategory, model_name AS modelName, base_url AS baseUrl,
            model_version AS modelVersion, api_key AS apiKey, organization_id AS organizationId, owner_name AS ownerName,
            status, description, extra_config AS extraConfig, created_at AS createdAt, updated_at AS updatedAt
     FROM model_providers
     WHERE id = ?`,
        [id]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    }
    async function listModelProviders() {
      const [rows] = await pool.query(
        `SELECT id, config_name AS configName, config_code AS configCode, provider_type AS providerType,
            model_category AS modelCategory, model_name AS modelName, base_url AS baseUrl,
            model_version AS modelVersion, api_key AS apiKey, organization_id AS organizationId, owner_name AS ownerName,
            status, description, extra_config AS extraConfig, created_at AS createdAt, updated_at AS updatedAt
     FROM model_providers
     ORDER BY id DESC`
      );
      return rows.map(mapRow);
    }
    async function createModelProvider(payload) {
      const [result] = await pool.query(
        `INSERT INTO model_providers
      (config_name, config_code, provider_type, model_category, model_name, model_version, base_url, api_key,
       organization_id, owner_name, status, description, extra_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.configName,
          payload.configCode,
          payload.providerType,
          payload.modelCategory,
          payload.modelName,
          payload.modelVersion || null,
          payload.baseUrl || null,
          payload.apiKey,
          payload.organizationId || null,
          payload.ownerName,
          payload.status,
          payload.description || null,
          JSON.stringify(payload.extraConfig || {})
        ]
      );
      return getModelProviderById(result.insertId);
    }
    async function updateModelProvider(id, payload) {
      const [result] = await pool.query(
        `UPDATE model_providers
     SET config_name = ?, config_code = ?, provider_type = ?, model_category = ?, model_name = ?, model_version = ?, base_url = ?,
         api_key = ?, organization_id = ?, owner_name = ?, status = ?, description = ?, extra_config = ?
     WHERE id = ?`,
        [
          payload.configName,
          payload.configCode,
          payload.providerType,
          payload.modelCategory,
          payload.modelName,
          payload.modelVersion || null,
          payload.baseUrl || null,
          payload.apiKey,
          payload.organizationId || null,
          payload.ownerName,
          payload.status,
          payload.description || null,
          JSON.stringify(payload.extraConfig || {}),
          id
        ]
      );
      if (result.affectedRows === 0) {
        return null;
      }
      return getModelProviderById(id);
    }
    async function deleteModelProvider(id) {
      const [result] = await pool.query("DELETE FROM model_providers WHERE id = ?", [id]);
      return result.affectedRows > 0;
    }
    module2.exports = {
      getModelProviderById,
      listModelProviders,
      createModelProvider,
      updateModelProvider,
      deleteModelProvider
    };
  }
});

// backend/src/modules/model-providers/model-provider.utils.js
var require_model_provider_utils = __commonJS({
  "backend/src/modules/model-providers/model-provider.utils.js"(exports2, module2) {
    var { decryptSecret, encryptSecret } = require_data_development_utils();
    function parseExtraConfig(extraConfig) {
      if (!extraConfig) {
        return {};
      }
      if (typeof extraConfig === "object" && !Array.isArray(extraConfig)) {
        return { ...extraConfig };
      }
      try {
        const parsed = JSON.parse(extraConfig);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (error) {
        return {};
      }
    }
    function sanitizeHeaderValue(key, value) {
      const normalizedKey = String(key || "").toLowerCase();
      if (normalizedKey.includes("authorization") || normalizedKey.includes("api-key") || normalizedKey.includes("apikey") || normalizedKey.includes("token") || normalizedKey.includes("secret")) {
        return maskSecret(String(value || ""));
      }
      return value;
    }
    function isHeaderMapCandidate(headers) {
      if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
        return false;
      }
      return Object.values(headers).every((value) => value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean");
    }
    function sanitizeHeaderMap(headers) {
      if (!isHeaderMapCandidate(headers)) {
        return headers;
      }
      return Object.entries(headers).reduce((result, [key, value]) => {
        result[key] = sanitizeHeaderValue(key, value);
        return result;
      }, {});
    }
    function sanitizeExtraConfig(extraConfig) {
      const next = parseExtraConfig(extraConfig);
      ["defaultHeaders", "inferenceHeaders", "modelListHeaders"].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(next, key)) {
          next[key] = sanitizeHeaderMap(next[key]);
        }
      });
      if (next.headers && typeof next.headers === "object" && !Array.isArray(next.headers)) {
        if (isHeaderMapCandidate(next.headers)) {
          next.headers = sanitizeHeaderMap(next.headers);
        } else {
          ["default", "common", "inference", "modelList", "model_list"].forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(next.headers, key)) {
              next.headers[key] = sanitizeHeaderMap(next.headers[key]);
            }
          });
        }
      }
      return next;
    }
    function maskSecret(value) {
      const text = String(value || "");
      if (!text) {
        return "";
      }
      if (text.length <= 8) {
        return `${text.slice(0, 1)}${"*".repeat(Math.max(2, text.length - 2))}${text.slice(-1)}`;
      }
      return `${text.slice(0, 3)}${"*".repeat(Math.min(16, Math.max(6, text.length - 6)))}${text.slice(-3)}`;
    }
    function normalizeModelCatalog(catalog = [], fallbackModelName = "", fallbackModelVersion = "") {
      const source = Array.isArray(catalog) ? catalog : [];
      const grouped = /* @__PURE__ */ new Map();
      source.forEach((item) => {
        if (!item || typeof item !== "object") {
          return;
        }
        const name = String(item.name || item.modelName || item.label || item.value || "").trim();
        if (!name) {
          return;
        }
        const label = String(item.label || item.modelLabel || name).trim() || name;
        const rawVersions = Array.isArray(item.versions) ? item.versions : [];
        if (!grouped.has(name)) {
          grouped.set(name, {
            name,
            label,
            versions: []
          });
        }
        const bucket = grouped.get(name);
        rawVersions.forEach((versionItem) => {
          const value = String(versionItem?.value || versionItem?.id || versionItem?.modelId || versionItem?.name || "").trim();
          if (!value) {
            return;
          }
          if (!bucket.versions.some((existing) => existing.value === value)) {
            bucket.versions.push({
              value,
              label: String(versionItem?.label || versionItem?.name || value).trim() || value
            });
          }
        });
      });
      const normalized = Array.from(grouped.values()).map((item) => ({
        name: item.name,
        label: item.label,
        versions: item.versions.length ? item.versions : [{ value: item.name, label: item.label }]
      })).sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
      if (normalized.length) {
        return normalized;
      }
      const fallbackName = String(fallbackModelName || "").trim();
      const fallbackVersion = String(fallbackModelVersion || fallbackModelName || "").trim();
      if (!fallbackName && !fallbackVersion) {
        return [];
      }
      return [{
        name: fallbackName || fallbackVersion,
        label: fallbackName || fallbackVersion,
        versions: [{ value: fallbackVersion || fallbackName, label: fallbackVersion || fallbackName }]
      }];
    }
    function findCatalogVersion(catalog = [], modelName, modelVersion) {
      const name = String(modelName || "").trim();
      const version = String(modelVersion || "").trim();
      if (!name || !version) {
        return null;
      }
      const modelEntry = catalog.find((item) => item.name === name);
      if (!modelEntry) {
        return null;
      }
      return modelEntry.versions.find((item) => item.value === version) || null;
    }
    function splitModelIdentity(rawValue, rawLabel) {
      const value = String(rawValue || "").trim();
      const label = String(rawLabel || value).trim() || value;
      const match = value.match(/^(.*?)(?:[-_@:/])((?:20\d{2}[-_]\d{2}[-_]\d{2})|(?:v?\d+(?:\.\d+){0,2}))$/i);
      if (match && match[1]) {
        const modelName = match[1].replace(/[-_@:/]+$/, "").trim();
        const versionToken = match[2].trim();
        if (modelName) {
          return {
            modelName,
            modelLabel: modelName,
            versionValue: value,
            versionLabel: label === value ? versionToken : label
          };
        }
      }
      return {
        modelName: value,
        modelLabel: label,
        versionValue: value,
        versionLabel: label
      };
    }
    function buildModelCatalogFromRemoteModels(models = []) {
      const grouped = /* @__PURE__ */ new Map();
      (Array.isArray(models) ? models : []).forEach((item) => {
        const value = String(item?.value || item?.id || item?.name || "").trim();
        if (!value) {
          return;
        }
        const label = String(item?.label || item?.name || value).trim() || value;
        const parsed = splitModelIdentity(value, label);
        if (!grouped.has(parsed.modelName)) {
          grouped.set(parsed.modelName, {
            name: parsed.modelName,
            label: parsed.modelLabel,
            versions: []
          });
        }
        const bucket = grouped.get(parsed.modelName);
        if (!bucket.versions.some((versionItem) => versionItem.value === parsed.versionValue)) {
          bucket.versions.push({
            value: parsed.versionValue,
            label: parsed.versionLabel
          });
        }
      });
      return normalizeModelCatalog(Array.from(grouped.values()));
    }
    function normalizeRuntimeProvider(provider) {
      if (!provider) {
        return null;
      }
      const extraConfig = parseExtraConfig(provider.extraConfig || provider.extra_config);
      const modelName = String(provider.modelName || provider.model_name || "").trim();
      const modelVersion = String(provider.modelVersion || provider.model_version || "").trim();
      return {
        id: Number(provider.id),
        configName: provider.configName || provider.config_name,
        configCode: provider.configCode || provider.config_code,
        providerType: provider.providerType || provider.provider_type,
        modelCategory: provider.modelCategory || provider.model_category,
        modelName,
        modelVersion: modelVersion || modelName,
        baseUrl: provider.baseUrl || provider.base_url || null,
        apiKey: decryptSecret(provider.apiKey || provider.api_key || ""),
        organizationId: provider.organizationId || provider.organization_id || null,
        ownerName: provider.ownerName || provider.owner_name || null,
        status: provider.status,
        description: provider.description || null,
        extraConfig,
        modelCatalog: normalizeModelCatalog(extraConfig.modelCatalog, modelName, modelVersion || modelName),
        createdAt: provider.createdAt || provider.created_at || null,
        updatedAt: provider.updatedAt || provider.updated_at || null
      };
    }
    function normalizeDisplayProvider(provider) {
      const runtimeProvider = normalizeRuntimeProvider(provider);
      if (!runtimeProvider) {
        return null;
      }
      return {
        ...runtimeProvider,
        apiKey: runtimeProvider.apiKey ? maskSecret(runtimeProvider.apiKey) : "",
        apiKeyMasked: runtimeProvider.apiKey ? maskSecret(runtimeProvider.apiKey) : "",
        hasApiKey: Boolean(runtimeProvider.apiKey),
        extraConfig: sanitizeExtraConfig(runtimeProvider.extraConfig)
      };
    }
    function applyModelSelection(provider, selection = {}) {
      const runtimeProvider = normalizeRuntimeProvider(provider);
      if (!runtimeProvider) {
        return null;
      }
      const requestedModelName = String(selection.modelName || "").trim();
      const requestedModelVersion = String(selection.modelVersion || "").trim();
      const catalog = Array.isArray(runtimeProvider.modelCatalog) ? runtimeProvider.modelCatalog : [];
      const requestedCatalogModel = requestedModelName ? catalog.find((item) => item.name === requestedModelName) : null;
      const requestedCatalogVersion = requestedModelVersion ? catalog.flatMap((item) => item.versions || []).find((item) => item.value === requestedModelVersion) : null;
      const fallbackCatalogModel = catalog.find((item) => item.name === runtimeProvider.modelName) || catalog[0] || null;
      const selectedModelName = requestedCatalogModel?.name || fallbackCatalogModel?.name || requestedModelName || runtimeProvider.modelName;
      const selectedModelVersion = requestedCatalogVersion?.value || requestedCatalogModel?.versions?.[0]?.value || fallbackCatalogModel?.versions?.find((item) => item.value === runtimeProvider.modelVersion)?.value || fallbackCatalogModel?.versions?.[0]?.value || requestedModelVersion || runtimeProvider.modelVersion || runtimeProvider.modelName;
      return {
        ...runtimeProvider,
        modelName: selectedModelVersion,
        modelVersion: selectedModelVersion,
        selectedModelName,
        selectedModelVersion
      };
    }
    function encryptProviderSecret(apiKey) {
      return encryptSecret(String(apiKey || "").trim());
    }
    module2.exports = {
      applyModelSelection,
      buildModelCatalogFromRemoteModels,
      encryptProviderSecret,
      findCatalogVersion,
      maskSecret,
      normalizeDisplayProvider,
      normalizeModelCatalog,
      normalizeRuntimeProvider,
      parseExtraConfig
    };
  }
});

// backend/src/modules/model-providers/model-provider.service.js
var require_model_provider_service = __commonJS({
  "backend/src/modules/model-providers/model-provider.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var repository = require_model_provider_repository();
    var {
      applyModelSelection,
      buildModelCatalogFromRemoteModels,
      encryptProviderSecret,
      normalizeDisplayProvider,
      normalizeModelCatalog,
      normalizeRuntimeProvider,
      parseExtraConfig
    } = require_model_provider_utils();
    async function listModelProviders() {
      const rows = await repository.listModelProviders();
      return rows.map((item) => normalizeDisplayProvider(item));
    }
    async function getModelProviderById(id) {
      const row = await repository.getModelProviderById(id);
      if (!row) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      return normalizeRuntimeProvider(row);
    }
    async function getActiveChatModelProviders() {
      const rows = await repository.listModelProviders();
      return rows.filter((item) => item.status === "active" && item.modelCategory === "chat").map((item) => normalizeRuntimeProvider(item));
    }
    function normalizeProviderPayload(payload, existing = null) {
      const existingRuntime = existing ? normalizeRuntimeProvider(existing) : null;
      const extraConfig = parseExtraConfig(payload.extraConfig);
      const selectedModelName = String(payload.modelName || existingRuntime?.modelName || "").trim();
      const selectedModelVersion = String(payload.modelVersion || existingRuntime?.modelVersion || selectedModelName).trim();
      return {
        ...payload,
        modelName: selectedModelName,
        modelVersion: selectedModelVersion || selectedModelName,
        apiKey: payload.apiKey ? encryptProviderSecret(payload.apiKey) : existing?.apiKey || "",
        extraConfig: {
          ...extraConfig,
          modelCatalog: normalizeModelCatalog(
            extraConfig.modelCatalog,
            selectedModelName,
            selectedModelVersion || selectedModelName
          )
        }
      };
    }
    async function resolveRuntimePayload(payload) {
      const existing = payload.id ? await repository.getModelProviderById(Number(payload.id)) : null;
      if (payload.id && !existing) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      const existingRuntime = existing ? normalizeRuntimeProvider(existing) : null;
      return {
        ...payload,
        providerType: payload.providerType || existingRuntime?.providerType,
        modelCategory: payload.modelCategory || existingRuntime?.modelCategory || "chat",
        baseUrl: payload.baseUrl || existingRuntime?.baseUrl,
        apiKey: payload.apiKey || existingRuntime?.apiKey,
        organizationId: Object.prototype.hasOwnProperty.call(payload, "organizationId") ? payload.organizationId : existingRuntime?.organizationId,
        extraConfig: {
          ...existingRuntime?.extraConfig || {},
          ...parseExtraConfig(payload.extraConfig)
        }
      };
    }
    async function createModelProvider(payload) {
      try {
        if (!payload.apiKey) {
          throw new AppError("API Key \u4E0D\u80FD\u4E3A\u7A7A", 400);
        }
        const row = await repository.createModelProvider(normalizeProviderPayload(payload));
        return normalizeDisplayProvider(row);
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u6A21\u578B\u914D\u7F6E\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function updateModelProvider(id, payload) {
      try {
        const existing = await repository.getModelProviderById(id);
        if (!existing) {
          throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
        }
        const row = await repository.updateModelProvider(id, normalizeProviderPayload(payload, existing));
        if (!row) {
          throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
        }
        return normalizeDisplayProvider(row);
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u6A21\u578B\u914D\u7F6E\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function deleteModelProvider(id) {
      const deleted = await repository.deleteModelProvider(id);
      if (!deleted) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
    }
    async function testModelProvider(payload) {
      const runtimePayload = await resolveRuntimePayload(payload);
      const extraConfig = runtimePayload.extraConfig || {};
      try {
        if (runtimePayload.providerType === "anthropic") {
          return await testAnthropicProvider(runtimePayload, extraConfig);
        }
        return await testOpenAICompatibleProvider(runtimePayload, extraConfig);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(`\u6A21\u578B\u6D4B\u8BD5\u5931\u8D25: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
      }
    }
    async function generateChatCompletion(providerConfig, messages, options = {}) {
      const runtimeProvider = normalizeRuntimeProvider(providerConfig);
      if (!runtimeProvider) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      if (runtimeProvider.status !== "active") {
        throw new AppError("\u5F53\u524D\u6A21\u578B\u914D\u7F6E\u672A\u542F\u7528", 400);
      }
      if (runtimeProvider.modelCategory !== "chat") {
        throw new AppError("\u5F53\u524D\u6A21\u578B\u914D\u7F6E\u4E0D\u662F\u5BF9\u8BDD\u6A21\u578B", 400);
      }
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new AppError("\u6D88\u606F\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      const extraConfig = runtimeProvider.extraConfig || {};
      try {
        if (runtimeProvider.providerType === "anthropic") {
          return await generateAnthropicCompletion(runtimeProvider, messages, options, extraConfig);
        }
        if (resolveInferenceWireApi(extraConfig) === "responses") {
          return await generateResponsesCompletion(runtimeProvider, messages, options, extraConfig);
        }
        return await generateOpenAICompatibleCompletion(runtimeProvider, messages, options, extraConfig);
      } catch (error) {
        if (error?.name === "AbortError") {
          throw error;
        }
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(`\u6A21\u578B\u8C03\u7528\u5931\u8D25: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
      }
    }
    async function generateChatCompletionStream(providerConfig, messages, options = {}, onDelta) {
      const runtimeProvider = normalizeRuntimeProvider(providerConfig);
      if (!runtimeProvider) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      if (runtimeProvider.status !== "active") {
        throw new AppError("\u5F53\u524D\u6A21\u578B\u914D\u7F6E\u672A\u542F\u7528", 400);
      }
      if (runtimeProvider.modelCategory !== "chat") {
        throw new AppError("\u5F53\u524D\u6A21\u578B\u914D\u7F6E\u4E0D\u662F\u5BF9\u8BDD\u6A21\u578B", 400);
      }
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new AppError("\u6D88\u606F\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      const extraConfig = runtimeProvider.extraConfig || {};
      try {
        if (runtimeProvider.providerType === "anthropic") {
          return await generateAnthropicCompletionStream(runtimeProvider, messages, options, extraConfig, onDelta);
        }
        if (resolveInferenceWireApi(extraConfig) === "responses") {
          return await generateResponsesCompletionStream(runtimeProvider, messages, options, extraConfig, onDelta);
        }
        return await generateOpenAICompatibleCompletionStream(runtimeProvider, messages, options, extraConfig, onDelta);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
      }
    }
    async function testOpenAICompatibleProvider(payload, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "model_list");
      const timeoutMs = Number(extraConfig.timeoutMs || 2e4);
      const { models, checkedEndpoint } = await fetchRemoteModelList({
        providerType: payload.providerType,
        baseUrl,
        headers,
        timeoutMs,
        extraConfig
      });
      const modelCatalog = buildModelCatalogFromRemoteModels(models);
      return {
        success: true,
        message: "\u6A21\u578B\u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F\uFF0C\u5DF2\u62C9\u53D6\u6A21\u578B\u5217\u8868",
        providerType: payload.providerType,
        modelName: null,
        modelVersion: null,
        checkedEndpoint,
        models,
        modelCatalog
      };
    }
    async function generateOpenAICompatibleCompletion(payload, messages, options, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const endpointCandidates = buildInferenceEndpoints(baseUrl, "chat/completions", payload.providerType, extraConfig);
      const body = buildChatCompletionsRequestBody(payload, messages, options, extraConfig);
      const { data, checkedEndpoint, adapted } = await requestOpenAICompatibleJson(
        endpointCandidates,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: options.signal
        },
        timeoutMs,
        (parsed) => Boolean(extractOpenAICompatibleContent(parsed)),
        "\u6A21\u578B\u8C03\u7528\u5931\u8D25",
        {
          disableAdaptiveRetry: Boolean(options.disableAdaptiveRetry),
          primaryEndpointOnly: Boolean(options.primaryEndpointOnly)
        }
      );
      const content = extractOpenAICompatibleContent(data);
      if (!content) {
        throw buildModelCallAppError("\u6A21\u578B\u8C03\u7528\u5931\u8D25", checkedEndpoint, endpointCandidates, 200, data, adapted, {
          contentMissing: true
        });
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: {
          ...data,
          checkedEndpoint,
          adapted
        }
      };
    }
    async function generateOpenAICompatibleCompletionStream(payload, messages, options, extraConfig, onDelta) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const endpointCandidates = buildInferenceEndpoints(baseUrl, "chat/completions", payload.providerType, extraConfig);
      const body = buildChatCompletionsRequestBody(payload, messages, options, extraConfig, true);
      const { response, checkedEndpoint } = await requestOpenAICompatibleStreamDetailed(
        endpointCandidates,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: options.signal
        },
        timeoutMs
      );
      const decoder = new TextDecoder("utf-8");
      const reader = response.body.getReader();
      let content = "";
      let buffer = "";
      let streamErrorMessage = "";
      async function consumeFrame(rawFrame) {
        const line = String(rawFrame || "").trim();
        if (!line) return;
        const dataText = line.startsWith("data:") ? line.slice(5).trim() : line;
        if (!dataText || dataText === "[DONE]") return;
        let parsed;
        try {
          parsed = JSON.parse(dataText);
        } catch {
          return;
        }
        const parsedError = extractErrorMessage(parsed);
        if (parsedError) {
          streamErrorMessage = parsedError;
        }
        const choice = Array.isArray(parsed?.choices) ? parsed.choices[0] : null;
        const deltaValue = choice?.delta?.content;
        const deltaText = typeof deltaValue === "string" ? deltaValue : Array.isArray(deltaValue) ? deltaValue.map((item) => typeof item?.text === "string" ? item.text : "").join("") : extractOpenAICompatibleContent(parsed);
        if (deltaText) {
          content += deltaText;
          if (typeof onDelta === "function") {
            await onDelta(deltaText);
          }
        }
      }
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          await consumeFrame(frame);
        }
      }
      buffer += decoder.decode();
      await consumeFrame(buffer);
      if (!content) {
        throw buildModelCallAppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25", checkedEndpoint, buildInferenceEndpoints(baseUrl, "chat/completions", payload.providerType), 200, streamErrorMessage ? { error: streamErrorMessage } : {}, null, {
          contentMissing: true,
          interfaceLabel: "OpenAI chat.completions"
        });
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: null
      };
    }
    async function generateResponsesCompletion(payload, messages, options, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const endpointCandidates = buildInferenceEndpoints(baseUrl, "responses", payload.providerType, extraConfig);
      const body = buildResponsesRequestBody(payload, messages, options, extraConfig);
      const { data, checkedEndpoint, adapted } = await requestOpenAICompatibleJson(
        endpointCandidates,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: options.signal
        },
        timeoutMs,
        (parsed) => Boolean(extractResponsesContent(parsed)),
        "\u6A21\u578B\u8C03\u7528\u5931\u8D25",
        {
          interfaceLabel: "OpenAI Responses API",
          disableAdaptiveRetry: Boolean(options.disableAdaptiveRetry),
          primaryEndpointOnly: Boolean(options.primaryEndpointOnly)
        }
      );
      const content = extractResponsesContent(data);
      if (!content) {
        throw buildModelCallAppError("\u6A21\u578B\u8C03\u7528\u5931\u8D25", checkedEndpoint, endpointCandidates, 200, data, adapted, {
          contentMissing: true,
          interfaceLabel: "OpenAI Responses API"
        });
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: {
          ...data,
          checkedEndpoint,
          adapted
        }
      };
    }
    async function generateResponsesCompletionStream(payload, messages, options, extraConfig, onDelta) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const endpointCandidates = buildInferenceEndpoints(baseUrl, "responses", payload.providerType, extraConfig);
      const body = buildResponsesRequestBody(payload, messages, options, extraConfig, true);
      const { response, checkedEndpoint } = await requestOpenAICompatibleStreamDetailed(
        endpointCandidates,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: options.signal
        },
        timeoutMs
      );
      const { content, finalResponse } = await readResponsesSseStream(response, onDelta);
      if (!content) {
        throw buildModelCallAppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25", checkedEndpoint, endpointCandidates, 200, finalResponse || {}, null, {
          contentMissing: true,
          interfaceLabel: "OpenAI Responses API"
        });
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: finalResponse || null
      };
    }
    async function testAnthropicProvider(payload, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const timeoutMs = Number(extraConfig.timeoutMs || 2e4);
      const headers = mergeExtraHeaders({
        "Content-Type": "application/json",
        "x-api-key": payload.apiKey,
        "anthropic-version": extraConfig.anthropicVersion || "2023-06-01"
      }, extraConfig, "model_list");
      const { models, checkedEndpoint } = await fetchRemoteModelList({
        providerType: payload.providerType,
        baseUrl,
        headers,
        timeoutMs,
        extraConfig
      });
      const modelCatalog = buildModelCatalogFromRemoteModels(models);
      return {
        success: true,
        message: "\u6A21\u578B\u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F\uFF0C\u5DF2\u62C9\u53D6\u6A21\u578B\u5217\u8868",
        providerType: payload.providerType,
        modelName: null,
        modelVersion: null,
        checkedEndpoint,
        models,
        modelCatalog
      };
    }
    async function generateAnthropicCompletion(payload, messages, options, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const systemMessage = messages.find((item) => item.role === "system")?.content || "";
      const userMessages = messages.filter((item) => item.role !== "system").map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content
      }));
      const response = await fetchWithTimeoutRespectAbort(
        `${baseUrl}/v1/messages`,
        {
          method: "POST",
          headers: mergeExtraHeaders({
            "Content-Type": "application/json",
            "x-api-key": payload.apiKey,
            "anthropic-version": extraConfig.anthropicVersion || "2023-06-01"
          }, extraConfig, "inference"),
          body: JSON.stringify({
            model: payload.modelName,
            system: systemMessage || void 0,
            max_tokens: options.maxTokens ?? 1200,
            messages: userMessages
          }),
          signal: options.signal
        },
        timeoutMs
      );
      const data = await parseJsonSafely(response);
      if (!response.ok) {
        throw new AppError(`\u6A21\u578B\u8C03\u7528\u5931\u8D25: ${extractErrorMessage(data) || response.statusText}`, 400);
      }
      const content = extractAnthropicContent(data);
      if (!content) {
        throw new AppError("\u6A21\u578B\u8C03\u7528\u5931\u8D25: \u672A\u8FD4\u56DE\u6709\u6548\u5185\u5BB9", 400);
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: data
      };
    }
    async function generateAnthropicCompletionStream(payload, messages, options, extraConfig, onDelta) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const systemMessage = messages.find((item) => item.role === "system")?.content || "";
      const userMessages = messages.filter((item) => item.role !== "system").map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content
      }));
      const response = await fetchWithTimeout(
        `${baseUrl}/v1/messages`,
        {
          method: "POST",
          headers: mergeExtraHeaders({
            "Content-Type": "application/json",
            "x-api-key": payload.apiKey,
            "anthropic-version": extraConfig.anthropicVersion || "2023-06-01"
          }, extraConfig, "inference"),
          body: JSON.stringify({
            model: payload.modelName,
            system: systemMessage || void 0,
            max_tokens: options.maxTokens ?? 1200,
            messages: userMessages,
            stream: true
          }),
          signal: options.signal
        },
        timeoutMs
      );
      if (!response.ok) {
        const data = await parseJsonSafely(response);
        throw new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${extractErrorMessage(data) || response.statusText}`, 400);
      }
      if (!response.body) {
        throw new AppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: \u672A\u8FD4\u56DE\u6709\u6548\u6D41", 400);
      }
      const decoder = new TextDecoder("utf-8");
      const reader = response.body.getReader();
      let content = "";
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          const dataText = line.slice(5).trim();
          if (!dataText || dataText === "[DONE]") continue;
          let parsed;
          try {
            parsed = JSON.parse(dataText);
          } catch {
            continue;
          }
          const deltaText = parsed?.delta?.text || parsed?.content_block?.text || "";
          if (deltaText) {
            content += deltaText;
            if (typeof onDelta === "function") {
              await onDelta(deltaText);
            }
          }
        }
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: null
      };
    }
    function buildInferenceEndpoints(baseUrl, resourcePath, providerType = "", extraConfig = {}) {
      const defaultEndpoints = buildDefaultInferenceEndpoints(baseUrl, resourcePath, providerType);
      return resolveEndpointCandidates(baseUrl, defaultEndpoints, extraConfig, getInferenceEndpointConfigKeys(resourcePath), "inference");
    }
    function buildDefaultInferenceEndpoints(baseUrl, resourcePath, providerType = "") {
      const normalizedBaseUrl = String(baseUrl).replace(/\/+$/, "");
      if (/\/v1$/i.test(normalizedBaseUrl)) {
        return [`${normalizedBaseUrl}/${resourcePath}`];
      }
      if (String(providerType).toLowerCase() === "custom") {
        return [`${normalizedBaseUrl}/v1/${resourcePath}`, `${normalizedBaseUrl}/${resourcePath}`];
      }
      return [`${normalizedBaseUrl}/${resourcePath}`, `${normalizedBaseUrl}/v1/${resourcePath}`];
    }
    function getInferenceEndpointConfigKeys(resourcePath = "") {
      const keys = [
        "inferencePath",
        "inference_path",
        "endpoints.inference"
      ];
      if (resourcePath === "responses") {
        keys.push("responsesPath", "responses_path", "endpoints.responses");
      }
      if (resourcePath === "chat/completions") {
        keys.push("chatCompletionsPath", "chat_completions_path", "endpoints.chatCompletions", "endpoints.chat_completions");
      }
      return keys;
    }
    function resolveEndpointCandidates(baseUrl, defaultEndpoints, extraConfig, configKeys, scope = "inference") {
      const configuredEndpoints = resolveConfiguredEndpoints(extraConfig, configKeys).map((item) => resolveEndpointUrl(baseUrl, item)).filter(Boolean);
      const disableFallback = resolveDisableFallback(extraConfig, scope);
      if (configuredEndpoints.length) {
        return [...new Set(disableFallback ? configuredEndpoints : [...configuredEndpoints, ...defaultEndpoints])];
      }
      if (disableFallback && defaultEndpoints.length > 1) {
        return [...new Set(defaultEndpoints.slice(0, 1))];
      }
      return [...new Set(defaultEndpoints)];
    }
    function resolveConfiguredEndpoints(extraConfig = {}, configKeys = []) {
      const rawValue = resolveConfigValue(extraConfig, configKeys);
      if (Array.isArray(rawValue)) {
        return rawValue.map((item) => String(item || "").trim()).filter(Boolean);
      }
      if (typeof rawValue === "string") {
        const trimmed = rawValue.trim();
        if (!trimmed) {
          return [];
        }
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              return parsed.map((item) => String(item || "").trim()).filter(Boolean);
            }
          } catch {
            return [trimmed];
          }
        }
        return [trimmed];
      }
      if (isPlainObject(rawValue)) {
        const candidate = rawValue.url || rawValue.path || rawValue.endpoint;
        return candidate ? [String(candidate).trim()].filter(Boolean) : [];
      }
      return [];
    }
    function resolveEndpointUrl(baseUrl, rawEndpoint) {
      const endpoint = String(rawEndpoint || "").trim();
      if (!endpoint) {
        return "";
      }
      if (/^https?:\/\//i.test(endpoint)) {
        return endpoint.replace(/\/+$/, "");
      }
      const normalizedBaseUrl = String(baseUrl || "").replace(/\/+$/, "");
      if (!normalizedBaseUrl) {
        return endpoint;
      }
      try {
        return new URL(endpoint, `${normalizedBaseUrl}/`).toString().replace(/\/+$/, "");
      } catch {
        return `${normalizedBaseUrl}/${endpoint.replace(/^\/+/, "")}`;
      }
    }
    function resolveDisableFallback(extraConfig = {}, scope = "inference") {
      const scopeKeys = scope === "model_list" ? [
        "disableModelListFallback",
        "disable_model_list_fallback",
        "endpoints.disableModelListFallback",
        "endpoints.disable_model_list_fallback"
      ] : [
        "disableInferenceFallback",
        "disable_inference_fallback",
        "endpoints.disableInferenceFallback",
        "endpoints.disable_inference_fallback"
      ];
      const scopedValue = resolveBooleanConfig(extraConfig, scopeKeys);
      if (typeof scopedValue === "boolean") {
        return scopedValue;
      }
      return resolveBooleanConfig(extraConfig, [
        "disableFallbackEndpoints",
        "disable_fallback_endpoints",
        "endpoints.disableFallback",
        "endpoints.disable_fallback"
      ]) === true;
    }
    function resolveBooleanConfig(extraConfig = {}, keys = []) {
      const rawValue = resolveConfigValue(extraConfig, keys);
      if (rawValue === void 0) {
        return void 0;
      }
      if (typeof rawValue === "boolean") {
        return rawValue;
      }
      if (typeof rawValue === "number") {
        return rawValue !== 0;
      }
      if (typeof rawValue === "string") {
        const normalized = rawValue.trim().toLowerCase();
        if (!normalized) {
          return void 0;
        }
        if (["true", "1", "yes", "on"].includes(normalized)) {
          return true;
        }
        if (["false", "0", "no", "off"].includes(normalized)) {
          return false;
        }
      }
      return Boolean(rawValue);
    }
    function resolveConfigValue(source, keyPaths = []) {
      for (const keyPath of keyPaths) {
        const resolved = resolveConfigPathValue(source, keyPath);
        if (resolved !== void 0) {
          return resolved;
        }
      }
      return void 0;
    }
    function resolveConfigPathValue(source, keyPath) {
      const segments = String(keyPath || "").split(".").filter(Boolean);
      let current = source;
      for (const segment of segments) {
        if (!current || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, segment)) {
          return void 0;
        }
        current = current[segment];
      }
      return current;
    }
    async function requestOpenAICompatibleJson(endpointCandidates, init, timeoutMs, validator, errorPrefix, errorOptions = {}) {
      let lastError = null;
      const activeEndpointCandidates = errorOptions.primaryEndpointOnly ? endpointCandidates.slice(0, 1) : endpointCandidates;
      for (const endpoint of activeEndpointCandidates) {
        const adaptiveInit = errorOptions.disableAdaptiveRetry ? null : buildAdaptiveRetryInit(init);
        try {
          const response = await fetchWithTimeoutRespectAbort(endpoint, init, timeoutMs);
          const data = await parseJsonSafely(response);
          if (!response.ok) {
            if (adaptiveInit && shouldRetrySameModel(response.status, data)) {
              const retried = await tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator);
              if (retried) {
                return { ...retried, adapted: true };
              }
            }
            lastError = buildModelCallAppError(errorPrefix, endpoint, activeEndpointCandidates, response.status, data, adaptiveInit, errorOptions);
            continue;
          }
          if (typeof validator === "function" && !validator(data)) {
            if (adaptiveInit) {
              const retried = await tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator);
              if (retried) {
                return { ...retried, adapted: true };
              }
            }
            lastError = buildModelCallAppError(errorPrefix, endpoint, activeEndpointCandidates, response.status, data, adaptiveInit, {
              ...errorOptions,
              contentMissing: true
            });
            continue;
          }
          return {
            data,
            checkedEndpoint: endpoint,
            adapted: false
          };
        } catch (error) {
          if (error?.name === "AbortError") {
            throw error;
          }
          if (adaptiveInit && shouldRetrySameModel(void 0, { error: error?.message || error })) {
            const retried = await tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator);
            if (retried) {
              return { ...retried, adapted: true };
            }
          }
          lastError = buildModelCallAppError(errorPrefix, endpoint, activeEndpointCandidates, void 0, { error: error?.message || error }, adaptiveInit, errorOptions);
        }
      }
      if (lastError instanceof AppError) {
        throw lastError;
      }
      throw new AppError(`${errorPrefix}: ${lastError?.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
    }
    async function tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator) {
      try {
        const response = await fetchWithTimeout(endpoint, adaptiveInit, timeoutMs);
        const data = await parseJsonSafely(response);
        if (!response.ok) {
          return null;
        }
        if (typeof validator === "function" && !validator(data)) {
          return null;
        }
        return {
          data,
          checkedEndpoint: endpoint
        };
      } catch {
        return null;
      }
    }
    function buildAdaptiveRetryInit(init) {
      const bodyText = typeof init?.body === "string" ? init.body : "";
      if (!bodyText) {
        return null;
      }
      try {
        const parsed = JSON.parse(bodyText);
        const nextBody = { ...parsed };
        let changed = false;
        if (typeof nextBody.max_tokens === "number" && nextBody.max_tokens > 512) {
          nextBody.max_tokens = 512;
          changed = true;
        }
        if (typeof nextBody.max_output_tokens === "number" && nextBody.max_output_tokens > 512) {
          nextBody.max_output_tokens = 512;
          changed = true;
        }
        if (typeof nextBody.temperature === "number" && nextBody.temperature > 0.1) {
          nextBody.temperature = 0.1;
          changed = true;
        }
        if (nextBody.response_format) {
          delete nextBody.response_format;
          changed = true;
        }
        if (nextBody.text && typeof nextBody.text === "object" && !Array.isArray(nextBody.text) && nextBody.text.format) {
          nextBody.text = { ...nextBody.text };
          delete nextBody.text.format;
          if (Object.keys(nextBody.text).length === 0) {
            delete nextBody.text;
          }
          changed = true;
        }
        if (!changed) {
          return null;
        }
        return {
          ...init,
          body: JSON.stringify(nextBody)
        };
      } catch {
        return null;
      }
    }
    function shouldRetrySameModel(status, data) {
      const normalizedError = String(extractErrorMessage(data) || data?.raw || data?.error || "").toLowerCase();
      return status === 502 || status === 503 || status === 504 || normalizedError.includes("timeout") || normalizedError.includes("timed out") || normalizedError.includes("\u8D85\u65F6") || normalizedError.includes("terminated") || normalizedError.includes("bad gateway") || normalizedError.includes("<!doctype html>") || normalizedError.includes("<html");
    }
    function buildModelCallAppError(errorPrefix, attemptedEndpoint, endpointCandidates, status, data, adaptiveInit, options = {}) {
      const rawText = typeof data?.raw === "string" ? data.raw : "";
      const extractedMessage = extractErrorMessage(data) || rawText || (status ? `HTTP ${status}` : "unknown error");
      const lowerMessage = String(extractedMessage).toLowerCase();
      const suggestions = [];
      const interfaceLabel = options.interfaceLabel || "OpenAI chat.completions";
      if (lowerMessage.includes("<!doctype html>") || lowerMessage.includes("<html")) {
        suggestions.push("\u63A5\u53E3\u8FD4\u56DE\u4E86 HTML \u9875\u9762\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u5730\u5740\u662F\u5426\u5E94\u5305\u542B /v1\uFF0C\u6216\u786E\u8BA4\u8BE5\u5730\u5740\u786E\u5B9E\u662F OpenAI \u517C\u5BB9 API\u3002");
      }
      if (status === 502 || status === 503 || status === 504 || lowerMessage.includes("terminated") || lowerMessage.includes("bad gateway")) {
        suggestions.push("\u4E0A\u6E38\u7F51\u5173\u4E2D\u65AD\u4E86\u5F53\u524D\u8BF7\u6C42\uFF0C\u5EFA\u8BAE\u7F29\u77ED\u8F93\u5165\u4E0A\u4E0B\u6587\u3001\u51CF\u5C11\u8FD4\u56DE\u957F\u5EA6\uFF0C\u6216\u7A0D\u540E\u91CD\u8BD5\u3002");
      }
      if (options.contentMissing) {
        suggestions.push("\u6A21\u578B\u5DF2\u8FD4\u56DE\u54CD\u5E94\uFF0C\u4F46\u5F53\u524D\u8FD4\u56DE\u7ED3\u6784\u672A\u88AB\u8BC6\u522B\u4E3A\u6709\u6548\u5185\u5BB9\uFF0C\u8BF7\u68C0\u67E5\u7F51\u5173\u8FD4\u56DE\u683C\u5F0F\u662F\u5426\u5B8C\u5168\u517C\u5BB9 OpenAI chat.completions\u3002");
      }
      if (adaptiveInit) {
        suggestions.push("\u7CFB\u7EDF\u5DF2\u5C1D\u8BD5\u4F7F\u7528\u540C\u6A21\u578B\u7684\u4FDD\u5B88\u53C2\u6570\u91CD\u8BD5\u4E00\u6B21\uFF1A\u964D\u4F4E max_tokens\u3001\u964D\u4F4E temperature\uFF0C\u5E76\u79FB\u9664 response_format\u3002");
      }
      return new AppError(`${errorPrefix}: ${extractedMessage}`, 400, {
        attemptedEndpoint,
        endpointCandidates,
        suggestions,
        recommendedMaxTokens: 512
      });
    }
    async function requestOpenAICompatibleStreamDetailed(endpointCandidates, init, timeoutMs) {
      let lastError = null;
      for (const endpoint of endpointCandidates) {
        try {
          const response = await fetchWithTimeout(endpoint, init, timeoutMs);
          if (!response.ok) {
            const data = await parseJsonSafely(response);
            lastError = buildModelCallAppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25", endpoint, endpointCandidates, response.status, data, null, {
              interfaceLabel: "OpenAI chat.completions"
            });
            continue;
          }
          const contentType = String(response.headers.get("content-type") || "").toLowerCase();
          if (contentType.includes("text/html")) {
            const data = await parseJsonSafely(response);
            lastError = new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${extractErrorMessage(data) || "\u63A5\u53E3\u8FD4\u56DE HTML \u9875\u9762"}`, 400);
            continue;
          }
          if (!response.body) {
            lastError = new AppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: \u672A\u8FD4\u56DE\u6709\u6548\u6D41", 400);
            continue;
          }
          return {
            response,
            checkedEndpoint: endpoint
          };
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError instanceof AppError) {
        throw lastError;
      }
      throw new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${lastError?.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
    }
    async function fetchRemoteModelList({ providerType, baseUrl, headers, timeoutMs, extraConfig }) {
      const endpointCandidates = buildModelListEndpoints(providerType, baseUrl, extraConfig);
      let lastError = null;
      for (const endpoint of endpointCandidates) {
        try {
          const response = await fetchWithTimeout(
            endpoint,
            {
              method: "GET",
              headers
            },
            timeoutMs
          );
          const data = await parseJsonSafely(response);
          if (!response.ok) {
            lastError = new AppError(`\u6A21\u578B\u5217\u8868\u83B7\u53D6\u5931\u8D25: ${extractErrorMessage(data) || response.statusText}`, 400);
            continue;
          }
          const models = normalizeRemoteModelList(data);
          if (!models.length) {
            lastError = new AppError("\u6A21\u578B\u5217\u8868\u83B7\u53D6\u5931\u8D25: \u8FDC\u7AEF\u672A\u8FD4\u56DE\u53EF\u7528\u6A21\u578B\u5217\u8868", 400);
            continue;
          }
          return {
            checkedEndpoint: endpoint,
            models
          };
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError instanceof AppError) {
        throw lastError;
      }
      throw new AppError(`\u6A21\u578B\u5217\u8868\u83B7\u53D6\u5931\u8D25: ${lastError?.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
    }
    function buildModelListEndpoints(providerType, baseUrl, extraConfig = {}) {
      const endpoints = [];
      const normalizedProviderType = String(providerType || "").toLowerCase();
      if (normalizedProviderType === "anthropic") {
        endpoints.push(`${baseUrl}/v1/models`);
        return resolveEndpointCandidates(baseUrl, endpoints, extraConfig, [
          "modelListPath",
          "model_list_path",
          "endpoints.modelList",
          "endpoints.model_list"
        ], "model_list");
      }
      if (normalizedProviderType === "azure_openai") {
        const apiVersion = String(extraConfig.apiVersion || "2024-10-21");
        endpoints.push(`${baseUrl}/openai/models?api-version=${encodeURIComponent(apiVersion)}`);
        endpoints.push(`${baseUrl}/openai/deployments?api-version=${encodeURIComponent(apiVersion)}`);
      }
      if (normalizedProviderType === "custom") {
        if (/\/v1$/i.test(baseUrl)) {
          endpoints.push(`${baseUrl}/models`);
        } else {
          endpoints.push(`${baseUrl}/v1/models`);
          endpoints.push(`${baseUrl}/models`);
        }
        return resolveEndpointCandidates(baseUrl, endpoints, extraConfig, [
          "modelListPath",
          "model_list_path",
          "endpoints.modelList",
          "endpoints.model_list"
        ], "model_list");
      }
      endpoints.push(`${baseUrl}/models`);
      if (!/\/v1$/i.test(baseUrl)) {
        endpoints.push(`${baseUrl}/v1/models`);
      }
      return resolveEndpointCandidates(baseUrl, endpoints, extraConfig, [
        "modelListPath",
        "model_list_path",
        "endpoints.modelList",
        "endpoints.model_list"
      ], "model_list");
    }
    function normalizeRemoteModelList(data) {
      const source = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : Array.isArray(data?.result) ? data.result : Array.isArray(data?.items) ? data.items : [];
      const models = source.map((item) => normalizeRemoteModel(item)).filter(Boolean);
      const unique = /* @__PURE__ */ new Map();
      models.forEach((item) => {
        if (!unique.has(item.value)) {
          unique.set(item.value, item);
        }
      });
      return Array.from(unique.values());
    }
    function normalizeRemoteModel(item) {
      if (typeof item === "string") {
        return { value: item, label: item };
      }
      if (!item || typeof item !== "object") {
        return null;
      }
      const value = String(item.id || item.name || item.model || item.model_name || item.deployment_id || item.deploymentId || "").trim();
      if (!value) {
        return null;
      }
      const displayName = String(item.display_name || item.displayName || item.name || item.id || item.model || value).trim();
      return {
        value,
        label: displayName === value ? value : `${displayName} (${value})`
      };
    }
    function buildOpenAICompatibleHeaders(payload, extraConfig, scope = "inference") {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${payload.apiKey}`
      };
      if (payload.organizationId && payload.providerType === "openai") {
        headers["OpenAI-Organization"] = payload.organizationId;
      }
      if (payload.providerType === "azure_openai") {
        delete headers.Authorization;
        headers["api-key"] = payload.apiKey;
      }
      return mergeExtraHeaders(headers, extraConfig, scope);
    }
    function mergeExtraHeaders(baseHeaders, extraConfig, scope = "inference") {
      const commonHeaders = resolveConfiguredHeaders(extraConfig, [
        "defaultHeaders",
        "default_headers",
        "headers.default",
        "headers.common",
        "headers"
      ]);
      const scopedHeaders = scope === "model_list" ? resolveConfiguredHeaders(extraConfig, [
        "modelListHeaders",
        "model_list_headers",
        "headers.modelList",
        "headers.model_list"
      ]) : resolveConfiguredHeaders(extraConfig, [
        "inferenceHeaders",
        "inference_headers",
        "requestHeaders",
        "request_headers",
        "headers.inference"
      ]);
      return mergeHeaderMaps(baseHeaders, commonHeaders, scopedHeaders);
    }
    function resolveConfiguredHeaders(extraConfig, keyPaths = []) {
      const rawValue = resolveConfigValue(extraConfig, keyPaths);
      return isHeaderMapObject(rawValue) ? rawValue : {};
    }
    function isHeaderMapObject(headers) {
      if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
        return false;
      }
      return Object.values(headers).every((value) => value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean");
    }
    function mergeHeaderMaps(...headerMaps) {
      const merged = /* @__PURE__ */ new Map();
      headerMaps.forEach((headers) => {
        if (!isHeaderMapObject(headers)) {
          return;
        }
        Object.entries(headers).forEach(([key, value]) => {
          const headerKey = String(key || "").trim();
          if (!headerKey) {
            return;
          }
          const normalizedHeaderKey = headerKey.toLowerCase();
          if (value == null) {
            merged.delete(normalizedHeaderKey);
            return;
          }
          merged.set(normalizedHeaderKey, {
            key: headerKey,
            value: String(value)
          });
        });
      });
      return Array.from(merged.values()).reduce((result, item) => {
        result[item.key] = item.value;
        return result;
      }, {});
    }
    function isPlainObject(value) {
      return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }
    function parseConfigObject(value) {
      if (isPlainObject(value)) {
        return value;
      }
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        return null;
      }
      try {
        const parsed = JSON.parse(trimmed);
        return isPlainObject(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    function cloneConfigValue(value) {
      if (Array.isArray(value)) {
        return value.map((item) => cloneConfigValue(item));
      }
      if (isPlainObject(value)) {
        return Object.entries(value).reduce((result, [key, itemValue]) => {
          result[key] = cloneConfigValue(itemValue);
          return result;
        }, {});
      }
      return value;
    }
    function mergeConfigObjects(target, override) {
      const base = isPlainObject(target) ? cloneConfigValue(target) : {};
      const nextOverride = parseConfigObject(override);
      if (!nextOverride) {
        return base;
      }
      Object.entries(nextOverride).forEach(([key, value]) => {
        if (value == null) {
          delete base[key];
          return;
        }
        if (isPlainObject(base[key]) && isPlainObject(value)) {
          base[key] = mergeConfigObjects(base[key], value);
          return;
        }
        base[key] = cloneConfigValue(value);
      });
      return base;
    }
    function normalizeBaseUrl(baseUrl) {
      if (!baseUrl) {
        throw new AppError("\u63A5\u53E3\u5730\u5740\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      return String(baseUrl).replace(/\/+$/, "");
    }
    async function fetchWithTimeout(url, init, timeoutMs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } catch (error) {
        if (error.name === "AbortError") {
          throw new AppError("\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u3001\u63A5\u53E3\u5730\u5740\u6216\u9274\u6743\u4FE1\u606F", 400);
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
    async function fetchWithTimeoutRespectAbort(url, init, timeoutMs) {
      const controller = new AbortController();
      const externalSignal = init?.signal;
      let abortedByCaller = false;
      const handleExternalAbort = () => {
        abortedByCaller = true;
        controller.abort();
      };
      if (externalSignal) {
        if (externalSignal.aborted) {
          abortedByCaller = true;
          controller.abort();
        } else {
          externalSignal.addEventListener("abort", handleExternalAbort, { once: true });
        }
      }
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } catch (error) {
        if (error.name === "AbortError") {
          if (abortedByCaller) {
            throw error;
          }
          throw new AppError("\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u3001\u63A5\u53E3\u5730\u5740\u6216\u9274\u6743\u4FE1\u606F", 400);
        }
        throw error;
      } finally {
        clearTimeout(timer);
        if (externalSignal) {
          externalSignal.removeEventListener("abort", handleExternalAbort);
        }
      }
    }
    async function parseJsonSafely(response) {
      const text = await response.text();
      if (!text) {
        return {};
      }
      try {
        return JSON.parse(text);
      } catch (error) {
        return { raw: text };
      }
    }
    function extractErrorMessage(data) {
      if (!data) {
        return "";
      }
      if (typeof data.message === "string") {
        return sanitizeErrorText(data.message);
      }
      if (typeof data.error === "string") {
        return sanitizeErrorText(data.error);
      }
      if (data.error && typeof data.error.message === "string") {
        return sanitizeErrorText(data.error.message);
      }
      const choice = Array.isArray(data.choices) ? data.choices[0] : null;
      const message = choice?.message || {};
      const content = typeof message.content === "string" ? message.content.trim() : "";
      const reasoningContent = typeof message.reasoning_content === "string" ? message.reasoning_content.trim() : "";
      if (!content && reasoningContent) {
        return choice?.finish_reason === "length" ? "\u6A21\u578B\u7684\u601D\u8003\u4EE4\u724C\u5DF2\u8017\u5C3D\uFF0C\u5C1A\u672A\u751F\u6210\u6700\u7EC8\u7B54\u6848\uFF1B\u8BF7\u5173\u95ED\u6DF1\u5EA6\u601D\u8003\u6216\u63D0\u9AD8\u8F93\u51FA Token \u4E0A\u9650" : "\u6A21\u578B\u4EC5\u8FD4\u56DE\u4E86\u601D\u8003\u8FC7\u7A0B\uFF0C\u672A\u751F\u6210\u6700\u7EC8\u7B54\u6848\uFF1B\u8BF7\u68C0\u67E5\u6DF1\u5EA6\u601D\u8003\u53C2\u6570\u4E0E\u8F93\u51FA Token \u4E0A\u9650";
      }
      if (typeof data.raw === "string") {
        return sanitizeErrorText(data.raw);
      }
      return "";
    }
    function sanitizeErrorText(value) {
      const raw = String(value || "");
      if (!raw) return "";
      const lower = raw.toLowerCase();
      if (lower.includes("<!doctype html>") || lower.includes("<html")) {
        return "\u63A5\u53E3\u8FD4\u56DE HTML \u9875\u9762\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u5730\u5740\u662F\u5426\u4E3A OpenAI \u517C\u5BB9 API\uFF08\u901A\u5E38\u9700\u8981 /v1\uFF09\u3002";
      }
      return raw.replace(/\s+/g, " ").trim().slice(0, 300);
    }
    function extractOpenAICompatibleContent(data) {
      const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
      const messageContent = choice?.message?.content;
      if (typeof messageContent === "string") {
        return messageContent;
      }
      if (messageContent && typeof messageContent === "object" && !Array.isArray(messageContent)) {
        return JSON.stringify(messageContent);
      }
      if (Array.isArray(messageContent)) {
        const text = messageContent.map((item) => {
          if (typeof item?.text === "string") return item.text;
          if (typeof item?.output_text === "string") return item.output_text;
          if (item && typeof item === "object" && item?.json && typeof item.json === "object") return JSON.stringify(item.json);
          return "";
        }).filter(Boolean).join("\n");
        if (text) return text;
        const firstJsonLike = messageContent.find((item) => item && typeof item === "object" && !Array.isArray(item));
        if (firstJsonLike) return JSON.stringify(firstJsonLike);
      }
      if (typeof choice?.text === "string") {
        return choice.text;
      }
      return "";
    }
    function extractResponsesContent(data) {
      if (typeof data?.output_text === "string" && data.output_text.trim()) {
        return data.output_text;
      }
      const output = Array.isArray(data?.output) ? data.output : [];
      return output.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        if (Array.isArray(item.content)) return item.content;
        return [item];
      }).map((item) => {
        if (typeof item?.text === "string") return item.text;
        if (typeof item?.output_text === "string") return item.output_text;
        if (typeof item?.refusal === "string") return item.refusal;
        if (item && typeof item === "object" && item?.json && typeof item.json === "object") return JSON.stringify(item.json);
        return "";
      }).filter(Boolean).join("\n");
    }
    function resolveInferenceWireApi(extraConfig = {}) {
      const wireApi = String(extraConfig?.wireApi || extraConfig?.wire_api || "").trim().toLowerCase();
      return wireApi === "responses" ? "responses" : "chat_completions";
    }
    function buildChatCompletionsRequestBody(payload, messages, options, extraConfig, stream = false) {
      const body = {
        model: payload.modelName,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1200
      };
      if (stream) {
        body.stream = true;
      }
      if (options.responseFormat) {
        body.response_format = options.responseFormat;
      }
      return applyReasoningRequestControls(
        applyInferenceRequestBodyOverrides(body, extraConfig, "chat_completions"),
        payload,
        options,
        "chat_completions"
      );
    }
    function buildResponsesRequestBody(payload, messages, options, extraConfig, stream = false) {
      const inputMode = resolveResponsesInputMode(extraConfig);
      const body = {
        model: payload.modelName,
        input: buildResponsesInput(messages, inputMode),
        temperature: options.temperature ?? 0.2,
        max_output_tokens: options.maxTokens ?? 1200
      };
      const instructions = buildResponsesInstructions(messages, inputMode);
      if (instructions) {
        body.instructions = instructions;
      }
      if (stream) {
        body.stream = true;
      }
      const textFormat = normalizeResponsesTextFormat(options.responseFormat);
      if (textFormat) {
        body.text = { format: textFormat };
      }
      if (resolveBooleanConfig(extraConfig, [
        "disableResponseStorage",
        "disable_response_storage",
        "responses.disableResponseStorage",
        "responses.disable_response_storage"
      ]) === true) {
        body.store = false;
      }
      return applyReasoningRequestControls(
        applyInferenceRequestBodyOverrides(body, extraConfig, "responses"),
        payload,
        options,
        "responses"
      );
    }
    function resolveReasoningProviderFamily(payload = {}) {
      const providerType = String(payload.providerType || "").trim().toLowerCase();
      const identity = [payload.baseUrl, payload.modelName, payload.modelVersion, payload.configName, payload.configCode].map((item) => String(item || "").toLowerCase()).join(" ");
      if (providerType === "deepseek" || identity.includes("deepseek")) return "deepseek";
      if (providerType === "qwen" || identity.includes("qwen") || identity.includes("dashscope")) return "qwen";
      if (providerType === "openai" || providerType === "azure_openai") return "openai";
      if (/\b(gpt|o1|o3|o4)[-_a-z0-9.]*/i.test(identity) || identity.includes("openai")) return "openai";
      return null;
    }
    function normalizeReasoningEffort(value, family) {
      const normalized = String(value || "medium").trim().toLowerCase();
      const supported = /* @__PURE__ */ new Set(["low", "medium", "high", "xhigh", "max"]);
      const effort = supported.has(normalized) ? normalized : "medium";
      if (family === "deepseek") {
        if (effort === "low") return "low";
        if (effort === "max" || effort === "xhigh") return "max";
        return "high";
      }
      return effort;
    }
    function applyReasoningRequestControls(body, payload, options = {}, protocol = "chat_completions") {
      if (typeof options.thinkingEnabled !== "boolean") return body;
      const family = resolveReasoningProviderFamily(payload);
      if (!family) return body;
      const enabled = options.thinkingEnabled;
      const effort = normalizeReasoningEffort(options.reasoningEffort, family);
      const thinkingBudget = Number(options.thinkingBudget || 0);
      if (family === "qwen") {
        body.enable_thinking = enabled;
        if (enabled && Number.isInteger(thinkingBudget) && thinkingBudget > 0) {
          body.thinking_budget = thinkingBudget;
        } else {
          delete body.thinking_budget;
        }
        return body;
      }
      if (protocol === "responses") {
        body.reasoning = {
          ...body.reasoning && typeof body.reasoning === "object" ? body.reasoning : {},
          effort: enabled ? effort : "none"
        };
        return body;
      }
      if (family === "deepseek") {
        body.thinking = { type: enabled ? "enabled" : "disabled" };
        if (enabled) body.reasoning_effort = effort;
        else delete body.reasoning_effort;
        return body;
      }
      body.reasoning_effort = enabled ? effort : "none";
      return body;
    }
    function buildReasoningOptions(config = {}) {
      const rawThinkingEnabled = config.thinkingEnabled ?? config.thinking_enabled;
      return {
        thinkingEnabled: rawThinkingEnabled === void 0 || rawThinkingEnabled === null ? void 0 : Boolean(rawThinkingEnabled),
        reasoningEffort: config.reasoningEffort || config.reasoning_effort || "medium",
        thinkingBudget: config.thinkingBudget ?? config.thinking_budget ?? null
      };
    }
    function applyInferenceRequestBodyOverrides(body, extraConfig, protocol) {
      const commonOverride = resolveConfiguredObject(extraConfig, [
        "requestBody",
        "request_body",
        "inferenceBody",
        "inference_body",
        "body.request",
        "body.inference"
      ]);
      const protocolOverride = protocol === "responses" ? resolveConfiguredObject(extraConfig, [
        "responsesBody",
        "responses_body",
        "body.responses"
      ]) : resolveConfiguredObject(extraConfig, [
        "chatCompletionsBody",
        "chat_completions_body",
        "body.chatCompletions",
        "body.chat_completions"
      ]);
      return mergeConfigObjects(mergeConfigObjects(body, commonOverride), protocolOverride);
    }
    function resolveConfiguredObject(extraConfig, keyPaths = []) {
      return parseConfigObject(resolveConfigValue(extraConfig, keyPaths)) || {};
    }
    function resolveResponsesInputMode(extraConfig = {}) {
      const rawValue = resolveConfigValue(extraConfig, [
        "responsesInputMode",
        "responses_input_mode",
        "responses.inputMode",
        "responses.input_mode"
      ]);
      const normalizedValue = String(rawValue || "").trim().toLowerCase();
      if (["string", "text", "instructions"].includes(normalizedValue)) {
        return normalizedValue;
      }
      return "messages";
    }
    function buildResponsesInput(messages, inputMode = "messages") {
      const sourceMessages = Array.isArray(messages) ? messages : [];
      if (inputMode === "string" || inputMode === "text") {
        return serializeMessagesToPrompt(sourceMessages);
      }
      if (inputMode === "instructions") {
        return normalizeResponsesInput(sourceMessages.filter((item) => {
          const normalizedRole = normalizeResponsesRole(item?.role);
          return normalizedRole !== "system" && normalizedRole !== "developer";
        }));
      }
      return normalizeResponsesInput(sourceMessages);
    }
    function buildResponsesInstructions(messages, inputMode = "messages") {
      if (inputMode !== "instructions") {
        return "";
      }
      return (Array.isArray(messages) ? messages : []).filter((item) => {
        const normalizedRole = normalizeResponsesRole(item?.role);
        return normalizedRole === "system" || normalizedRole === "developer";
      }).map((item) => stringifyContentForPrompt(item?.content)).filter(Boolean).join("\n\n");
    }
    function normalizeResponsesInput(messages) {
      return (Array.isArray(messages) ? messages : []).map((item) => ({
        role: normalizeResponsesRole(item?.role),
        content: normalizeResponsesContent(item?.content)
      }));
    }
    function normalizeResponsesRole(role) {
      const normalizedRole = String(role || "user").trim().toLowerCase();
      if (["assistant", "system", "developer"].includes(normalizedRole)) {
        return normalizedRole;
      }
      return "user";
    }
    function normalizeResponsesContent(content) {
      if (typeof content === "string") {
        return content;
      }
      if (Array.isArray(content)) {
        const items = content.map((item) => {
          if (typeof item === "string") {
            return { type: "input_text", text: item };
          }
          if (!item || typeof item !== "object") {
            return null;
          }
          if ((item.type === "text" || item.type === "input_text" || item.type === "output_text") && typeof item.text === "string") {
            return { type: "input_text", text: item.text };
          }
          if (item.type === "image_url" && typeof item?.image_url?.url === "string") {
            return { type: "input_image", image_url: item.image_url.url };
          }
          if (item.type === "input_image" && typeof item.image_url === "string") {
            return { type: "input_image", image_url: item.image_url };
          }
          return null;
        }).filter(Boolean);
        if (items.length) {
          return items;
        }
      }
      if (content && typeof content === "object") {
        return JSON.stringify(content);
      }
      return String(content || "");
    }
    function serializeMessagesToPrompt(messages) {
      return (Array.isArray(messages) ? messages : []).map((item) => {
        const content = stringifyContentForPrompt(item?.content);
        if (!content) {
          return "";
        }
        return `${normalizeResponsesRole(item?.role)}:
${content}`;
      }).filter(Boolean).join("\n\n");
    }
    function stringifyContentForPrompt(content) {
      if (typeof content === "string") {
        return content;
      }
      if (Array.isArray(content)) {
        return content.map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (!item || typeof item !== "object") {
            return "";
          }
          if (typeof item.text === "string") {
            return item.text;
          }
          if (typeof item.output_text === "string") {
            return item.output_text;
          }
          if (typeof item.refusal === "string") {
            return item.refusal;
          }
          if (item.type === "image_url" && typeof item?.image_url?.url === "string") {
            return `[image] ${item.image_url.url}`;
          }
          if (item.type === "input_image" && typeof item.image_url === "string") {
            return `[image] ${item.image_url}`;
          }
          return isPlainObject(item) ? JSON.stringify(item) : "";
        }).filter(Boolean).join("\n");
      }
      if (content && typeof content === "object") {
        return JSON.stringify(content);
      }
      return String(content || "");
    }
    function normalizeResponsesTextFormat(responseFormat) {
      if (!responseFormat || typeof responseFormat !== "object" || Array.isArray(responseFormat)) {
        return null;
      }
      const formatType = String(responseFormat.type || "").trim();
      if (!formatType) {
        return null;
      }
      return { ...responseFormat };
    }
    async function readResponsesSseStream(response, onDelta) {
      if (!response.body) {
        throw new AppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: \u672A\u8FD4\u56DE\u6709\u6548\u6D41", 400);
      }
      const decoder = new TextDecoder("utf-8");
      const reader = response.body.getReader();
      let content = "";
      let buffer = "";
      let eventName = "";
      let dataLines = [];
      let finalResponse = null;
      const flushEvent = async () => {
        const rawData = dataLines.join("\n").trim();
        const currentEventName = eventName.trim();
        eventName = "";
        dataLines = [];
        if (!rawData || rawData === "[DONE]") {
          return;
        }
        let parsed;
        try {
          parsed = JSON.parse(rawData);
        } catch {
          return;
        }
        const eventType = currentEventName || parsed?.type || "";
        if (eventType === "response.error" || parsed?.error) {
          throw new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${extractErrorMessage(parsed) || "\u672A\u77E5\u9519\u8BEF"}`, 400);
        }
        if (eventType === "response.completed") {
          finalResponse = parsed?.response || parsed;
          return;
        }
        const deltaText = extractResponsesStreamDelta(eventType, parsed);
        if (deltaText) {
          content += deltaText;
          if (typeof onDelta === "function") {
            await onDelta(deltaText);
          }
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const rawLine of lines) {
          const line = rawLine.trimEnd();
          if (!line) {
            await flushEvent();
            continue;
          }
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
            continue;
          }
          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }
      }
      await flushEvent();
      if (!content && finalResponse) {
        content = extractResponsesContent(finalResponse);
      }
      return {
        content,
        finalResponse
      };
    }
    function extractResponsesStreamDelta(eventType, payload) {
      if ((eventType === "response.output_text.delta" || payload?.type === "response.output_text.delta") && typeof payload?.delta === "string") {
        return payload.delta;
      }
      if ((eventType === "response.refusal.delta" || payload?.type === "response.refusal.delta") && typeof payload?.delta === "string") {
        return payload.delta;
      }
      return "";
    }
    function extractAnthropicContent(data) {
      if (!Array.isArray(data?.content)) {
        return "";
      }
      return data.content.map((item) => item?.type === "text" && typeof item.text === "string" ? item.text : "").filter(Boolean).join("\n");
    }
    module2.exports = {
      applyModelSelection,
      buildReasoningOptions,
      listModelProviders,
      getModelProviderById,
      getActiveChatModelProviders,
      normalizeRuntimeProvider,
      createModelProvider,
      updateModelProvider,
      deleteModelProvider,
      testModelProvider,
      generateChatCompletion,
      generateChatCompletionStream
    };
  }
});

// backend/src/modules/dev-ai-configs/dev-ai-config.repository.js
var require_dev_ai_config_repository = __commonJS({
  "backend/src/modules/dev-ai-configs/dev-ai-config.repository.js"(exports2, module2) {
    var { pool } = require_database();
    function mapRow(row) {
      return {
        ...row,
        defaultModelProviderId: row.defaultModelProviderId ? Number(row.defaultModelProviderId) : null,
        defaultModelName: row.defaultModelName || null,
        defaultModelVersion: row.defaultModelVersion || null,
        temperature: row.temperature === null || row.temperature === void 0 ? null : Number(row.temperature),
        maxTokens: row.maxTokens === null || row.maxTokens === void 0 ? null : Number(row.maxTokens),
        timeoutMs: row.timeoutMs === null || row.timeoutMs === void 0 ? null : Number(row.timeoutMs)
      };
    }
    async function listConfigs() {
      const [rows] = await pool.query(
        `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature,
            c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM dev_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     ORDER BY c.id DESC`
      );
      return rows.map(mapRow);
    }
    async function getConfigById(id) {
      const [rows] = await pool.query(
        `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature,
            c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM dev_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     WHERE c.id = ?
     LIMIT 1`,
        [id]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    }
    async function getConfigByCode(sceneCode) {
      const [rows] = await pool.query(
        `SELECT id, scene_name AS sceneName, scene_code AS sceneCode,
            default_model_provider_id AS defaultModelProviderId,
            default_model_name AS defaultModelName, default_model_version AS defaultModelVersion,
            temperature,
            max_tokens AS maxTokens, timeout_ms AS timeoutMs,
            system_prompt AS systemPrompt, description, owner_name AS ownerName,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM dev_ai_configs
     WHERE scene_code = ?
     LIMIT 1`,
        [sceneCode]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    }
    async function updateConfig(id, payload) {
      const [result] = await pool.query(
        `UPDATE dev_ai_configs
     SET scene_name = ?, scene_code = ?, default_model_provider_id = ?, default_model_name = ?, default_model_version = ?, temperature = ?, max_tokens = ?, timeout_ms = ?, system_prompt = ?,
         description = ?, owner_name = ?, status = ?
     WHERE id = ?`,
        [
          payload.sceneName,
          payload.sceneCode,
          payload.defaultModelProviderId || null,
          payload.defaultModelName || null,
          payload.defaultModelVersion || null,
          payload.temperature ?? null,
          payload.maxTokens ?? null,
          payload.timeoutMs ?? null,
          payload.systemPrompt || null,
          payload.description || null,
          payload.ownerName,
          payload.status,
          id
        ]
      );
      if (result.affectedRows === 0) {
        return null;
      }
      return getConfigById(id);
    }
    module2.exports = {
      listConfigs,
      getConfigById,
      getConfigByCode,
      updateConfig
    };
  }
});

// backend/src/modules/dev-ai-configs/dev-ai-config.service.js
var require_dev_ai_config_service = __commonJS({
  "backend/src/modules/dev-ai-configs/dev-ai-config.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var repository = require_dev_ai_config_repository();
    var modelProviderService = require_model_provider_service();
    async function listConfigs() {
      return repository.listConfigs();
    }
    async function getActiveConfigByCode(sceneCode) {
      const row = await repository.getConfigByCode(sceneCode);
      if (!row || row.status !== "active") {
        return null;
      }
      return row;
    }
    async function updateConfig(id, payload) {
      const existing = await repository.getConfigById(id);
      if (!existing) {
        throw new AppError("\u6570\u636E\u5F00\u53D1 AI \u573A\u666F\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      const normalizedModel = await validateDefaultProvider(
        payload.defaultModelProviderId ?? existing.defaultModelProviderId,
        payload.defaultModelName ?? existing.defaultModelName,
        payload.defaultModelVersion ?? existing.defaultModelVersion
      );
      const row = await repository.updateConfig(id, {
        ...existing,
        defaultModelProviderId: normalizedModel.defaultModelProviderId,
        defaultModelName: normalizedModel.defaultModelName,
        defaultModelVersion: normalizedModel.defaultModelVersion,
        temperature: payload.temperature ?? existing.temperature ?? null,
        maxTokens: payload.maxTokens ?? existing.maxTokens ?? null,
        timeoutMs: payload.timeoutMs ?? existing.timeoutMs ?? null,
        systemPrompt: payload.systemPrompt || null
      });
      if (!row) {
        throw new AppError("\u6570\u636E\u5F00\u53D1 AI \u573A\u666F\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function validateDefaultProvider(defaultModelProviderId, defaultModelName, defaultModelVersion) {
      if (!defaultModelProviderId) {
        return {
          defaultModelProviderId: null,
          defaultModelName: null,
          defaultModelVersion: null
        };
      }
      const provider = await modelProviderService.getModelProviderById(defaultModelProviderId);
      if (!provider) {
        throw new AppError("\u9ED8\u8BA4\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 400);
      }
      if (provider.modelCategory !== "chat") {
        throw new AppError("\u9ED8\u8BA4\u6A21\u578B\u5FC5\u987B\u9009\u62E9\u5BF9\u8BDD\u6A21\u578B", 400);
      }
      return {
        defaultModelProviderId: Number(defaultModelProviderId),
        defaultModelName: String(defaultModelName || provider.modelName || "").trim() || provider.modelName,
        defaultModelVersion: String(defaultModelVersion || provider.modelVersion || provider.modelName || "").trim() || provider.modelVersion || provider.modelName
      };
    }
    module2.exports = {
      listConfigs,
      getActiveConfigByCode,
      updateConfig
    };
  }
});

// backend/src/modules/data-development/data-development.copilot.js
var require_data_development_copilot = __commonJS({
  "backend/src/modules/data-development/data-development.copilot.js"(exports2, module2) {
    var AppError = require_app_error();
    var repository = require_data_development_repository();
    var { getAdapter } = require_adapters();
    var {
      decryptSecret,
      isQuerySql,
      normalizeDatasourceStorageType,
      quoteIdentifier,
      resolveRuntimeDatasourceConfig
    } = require_data_development_utils();
    var sqlParser = require_data_development_sql_parser();
    var modelProviderService = require_model_provider_service();
    var devAiConfigService = require_dev_ai_config_service();
    var TASK_TYPES = /* @__PURE__ */ new Set(["generate_sql", "analyze_sql", "rewrite_sql", "optimize_sql", "explain_sql", "data_research"]);
    var MAX_AVAILABLE_TABLES = 80;
    var MAX_SCHEMA_TABLES = 8;
    var MAX_COLUMNS_PER_TABLE = 24;
    var MAX_SELECTED_TABLES = 5;
    var MAX_SAMPLE_ROWS_PER_TABLE = 50;
    var MAX_SAMPLE_COLUMNS_PER_TABLE = 16;
    var MAX_SAMPLE_VALUE_LENGTH = 120;
    var MAX_CONVERSATION_ITEMS = 8;
    var TASK_SCENE_CODE_MAP = {
      generate_sql: "sql_generate",
      analyze_sql: "sql_analyze",
      rewrite_sql: "sql_rewrite",
      optimize_sql: "sql_optimize",
      explain_sql: "sql_explain",
      data_research: "sql_data_research"
    };
    function materializeDatasource(datasource) {
      const password = decryptSecret(datasource.passwordEncrypted);
      const resolved = resolveRuntimeDatasourceConfig({
        ...datasource,
        password
      });
      return {
        ...datasource,
        type: resolved.dialect,
        storageType: normalizeDatasourceStorageType(datasource.type),
        host: resolved.host,
        port: resolved.port,
        databaseName: resolved.databaseName,
        username: resolved.username,
        extraConfig: resolved.extraConfig,
        password
      };
    }
    async function requireDatasource(id, includePassword = false) {
      const datasource = await repository.getDatasourceById(id, includePassword);
      if (!datasource) {
        throw new AppError("Datasource not found", 404);
      }
      return datasource;
    }
    async function resolveProvider(modelProviderId) {
      if (modelProviderId) {
        return modelProviderService.getModelProviderById(Number(modelProviderId));
      }
      const providers = await modelProviderService.getActiveChatModelProviders();
      if (!providers.length) {
        throw new AppError("\u672A\u627E\u5230\u53EF\u7528\u7684\u5BF9\u8BDD\u6A21\u578B\uFF0C\u8BF7\u5148\u5728\u7CFB\u7EDF\u6A21\u578B\u7BA1\u7406\u4E2D\u542F\u7528\u4E00\u4E2A\u804A\u5929\u6A21\u578B", 400);
      }
      return providers[0];
    }
    async function resolveTaskConfig(taskType) {
      if (!TASK_TYPES.has(taskType)) {
        return null;
      }
      return devAiConfigService.getActiveConfigByCode(TASK_SCENE_CODE_MAP[taskType]);
    }
    function uniqueStrings(values) {
      return Array.from(
        new Set(
          (Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean)
        )
      );
    }
    function normalizeText(value) {
      return String(value || "").trim();
    }
    function inferTaskType(payload) {
      if (payload.taskType && payload.taskType !== "auto") {
        return payload.taskType;
      }
      const prompt = normalizeText(payload.prompt).toLowerCase();
      if (!prompt && uniqueStrings(payload.selectedTables).length > 0) {
        return "data_research";
      }
      if (payload.errorMessage || /(报错|错误|失败|异常|为什么.*(为空|没有|只有)|字段不存在|语法)/i.test(prompt)) {
        return "analyze_sql";
      }
      if (/(优化|性能|太慢|耗时|索引|扫描)/i.test(prompt)) {
        return "optimize_sql";
      }
      if (/(生成|写一条|写一个|创建.*sql|给出.*sql)/i.test(prompt)) {
        return "generate_sql";
      }
      if (/(解释|说明|口径|粒度|什么意思|做什么)/i.test(prompt)) {
        return "explain_sql";
      }
      if ((payload.selectedSql || payload.editorSql) && /(修改|改成|增加|新增|调整|替换|继续|基于|改写)/i.test(prompt)) {
        return "rewrite_sql";
      }
      return "generate_sql";
    }
    function buildSessionTitle(payload) {
      if (payload.taskType === "data_research" && !normalizeText(payload.prompt)) {
        return `\u5DF2\u9009 ${uniqueStrings(payload.selectedTables).length} \u5F20\u8868\u7684\u6570\u636E\u8C03\u7814`;
      }
      const source = normalizeText(payload.prompt) || normalizeText(payload.selectedSql).split(/\r?\n/)[0] || "SQL \u667A\u80FD\u8F85\u52A9";
      return source.length > 36 ? `${source.slice(0, 36)}\u2026` : source;
    }
    function buildConversationFromMessages(messages) {
      return (Array.isArray(messages) ? messages : []).slice(-MAX_CONVERSATION_ITEMS).map((item) => {
        if (item.role === "user") {
          return { role: "user", content: item.messageText };
        }
        const result = item.payload?.result || item.payload || {};
        const content = [
          result.summary,
          result.explanation,
          result.generatedSql ? `SQL:
${result.generatedSql}` : "",
          Array.isArray(result.risks) && result.risks.length ? `\u98CE\u9669: ${result.risks.join("\uFF1B")}` : ""
        ].filter(Boolean).join("\n\n");
        return { role: "assistant", content: content || item.messageText };
      });
    }
    function addProgress(streamContext, processSteps, phase, title, detail) {
      const step = { phase, title, detail: detail || "", status: "completed" };
      processSteps.push(step);
      streamContext.write?.({ type: "progress", data: step });
    }
    function buildActiveExecutionContext(history) {
      if (!history) return null;
      const preview = history.resultPreview || {};
      const fields = (Array.isArray(preview.fields) ? preview.fields : []).slice(0, 24);
      const rows = (Array.isArray(preview.rows) ? preview.rows : []).slice(0, 12).map((row) => {
        const normalized = {};
        fields.slice(0, 16).forEach((field) => {
          const value = row?.[field];
          normalized[field] = typeof value === "string" && value.length > 200 ? `${value.slice(0, 200)}\u2026` : value;
        });
        return normalized;
      });
      return {
        historyId: history.id,
        status: history.status,
        sqlText: history.sqlText,
        databaseName: history.databaseName,
        durationMs: history.durationMs,
        errorMessage: history.errorMessage || null,
        fields,
        rows,
        rowCount: Number(preview.rowCount || 0),
        affectedRows: Number(preview.affectedRows || 0),
        previewTruncated: Number(preview.rowCount || 0) > rows.length
      };
    }
    function buildPromptKeywords(payload) {
      const source = [
        payload.prompt,
        payload.selectedSql,
        payload.editorSql,
        payload.errorMessage
      ].map((item) => normalizeText(item).toLowerCase()).join(" ");
      return uniqueStrings(
        source.split(/[^a-z0-9_]+/i).map((item) => item.trim()).filter((item) => item.length >= 2)
      );
    }
    function matchTableByReference(tables, reference) {
      const normalizedReference = String(reference || "").toLowerCase();
      if (!normalizedReference) return null;
      return tables.find((item) => {
        const name = String(item.name || "").toLowerCase();
        return name === normalizedReference || name.endsWith(`.${normalizedReference}`);
      }) || null;
    }
    function scoreTable(tableName, keywords) {
      const normalized = String(tableName || "").toLowerCase();
      if (!keywords.length) return 0;
      return keywords.reduce((score, keyword) => {
        if (!keyword) return score;
        if (normalized === keyword) return score + 12;
        if (normalized.endsWith(`.${keyword}`)) return score + 10;
        if (normalized.includes(keyword)) return score + 6;
        return score;
      }, 0);
    }
    function selectCandidateTables(tables, payload, dialect) {
      const keywords = buildPromptKeywords(payload);
      const referencedTables = uniqueStrings([
        ...sqlParser.extractTables(payload.selectedSql, dialect),
        ...sqlParser.extractTables(payload.editorSql, dialect)
      ]);
      const directMatches = referencedTables.map((reference) => matchTableByReference(tables, reference)).filter(Boolean);
      const scoredTables = tables.map((item) => ({ item, score: scoreTable(item.name, keywords) })).sort((left, right) => right.score - left.score || String(left.item.name).localeCompare(String(right.item.name))).map((entry) => entry.item);
      const merged = [];
      const seen = /* @__PURE__ */ new Set();
      for (const item of [...directMatches, ...scoredTables, ...tables]) {
        const key = String(item?.name || "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
      return {
        referencedTables,
        availableTables: merged.slice(0, MAX_AVAILABLE_TABLES),
        schemaTables: merged.slice(0, MAX_SCHEMA_TABLES)
      };
    }
    function normalizeSelectedTables(values) {
      return uniqueStrings(values).slice(0, MAX_SELECTED_TABLES);
    }
    function resolveScopedTables(tables, selectedTables) {
      const normalizedSelections = normalizeSelectedTables(selectedTables);
      if (!normalizedSelections.length) {
        return [];
      }
      return normalizedSelections.map((reference) => matchTableByReference(tables, reference)).filter(Boolean);
    }
    async function loadTableSchemas(adapter, datasource, databaseName, tables) {
      const results = [];
      for (const table of tables) {
        try {
          const columns = await adapter.getColumns(datasource, databaseName, table.name);
          results.push({
            tableName: table.name,
            tableType: table.type,
            columns: (Array.isArray(columns) ? columns : []).slice(0, MAX_COLUMNS_PER_TABLE).map((column) => ({
              name: column.name,
              dataType: column.dataType,
              columnType: column.columnType,
              nullable: Boolean(column.nullable),
              primaryKey: Boolean(column.primaryKey),
              comment: column.comment || ""
            }))
          });
        } catch (error) {
          results.push({
            tableName: table.name,
            tableType: table.type,
            columns: [],
            loadError: error.message || "failed to load columns"
          });
        }
      }
      return results;
    }
    function buildRandomFunction(dialect) {
      switch (String(dialect || "").toLowerCase()) {
        case "postgresql":
        case "postgres":
        case "gaussdb":
          return "RANDOM()";
        case "clickhouse":
          return "rand()";
        case "hive":
          return "rand()";
        case "oracle":
          return "DBMS_RANDOM.VALUE";
        case "dm":
          return "RAND()";
        case "mysql":
        default:
          return "RAND()";
      }
    }
    function sanitizeSampleValue(value) {
      if (value === null || value === void 0) {
        return null;
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (Buffer.isBuffer(value)) {
        return `[binary:${value.length}]`;
      }
      if (typeof value === "string") {
        return value.length > MAX_SAMPLE_VALUE_LENGTH ? `${value.slice(0, MAX_SAMPLE_VALUE_LENGTH)}...` : value;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return value;
      }
      try {
        const text = JSON.stringify(value);
        return text.length > MAX_SAMPLE_VALUE_LENGTH ? `${text.slice(0, MAX_SAMPLE_VALUE_LENGTH)}...` : text;
      } catch (error) {
        const text = String(value);
        return text.length > MAX_SAMPLE_VALUE_LENGTH ? `${text.slice(0, MAX_SAMPLE_VALUE_LENGTH)}...` : text;
      }
    }
    function buildSampleQuery(tableName, columns, dialect) {
      const tableSql = quoteIdentifier(tableName, dialect);
      const selectedColumns = Array.isArray(columns) && columns.length ? columns.map((column) => quoteIdentifier(column, dialect)).join(", ") : "*";
      return `SELECT ${selectedColumns}
FROM ${tableSql}
ORDER BY ${buildRandomFunction(dialect)}
LIMIT ${MAX_SAMPLE_ROWS_PER_TABLE}`;
    }
    async function sampleTableRows(adapter, datasource, databaseName, tableSchema) {
      const selectedColumns = (tableSchema.columns || []).slice(0, MAX_SAMPLE_COLUMNS_PER_TABLE).map((column) => column.name);
      const truncated = (tableSchema.columns || []).length > selectedColumns.length;
      const randomSql = buildSampleQuery(tableSchema.tableName, selectedColumns, datasource.type);
      try {
        const result = await adapter.executeQuery(datasource, randomSql, {
          databaseName: databaseName || datasource.databaseName,
          resultLimit: MAX_SAMPLE_ROWS_PER_TABLE
        });
        const effectiveColumns = selectedColumns.length ? selectedColumns : (result.fields || []).slice(0, MAX_SAMPLE_COLUMNS_PER_TABLE);
        return {
          tableName: tableSchema.tableName,
          rowCount: Number(result.rowCount || (result.rows || []).length || 0),
          columns: effectiveColumns,
          truncated,
          sampleRows: (result.rows || []).map((row) => Object.fromEntries(
            effectiveColumns.map((column) => [column, sanitizeSampleValue(row?.[column])])
          )),
          sampleError: null
        };
      } catch (randomError) {
        const fallbackSql = `SELECT ${selectedColumns.length ? selectedColumns.map((column) => quoteIdentifier(column, datasource.type)).join(", ") : "*"}
FROM ${quoteIdentifier(tableSchema.tableName, datasource.type)}
LIMIT ${MAX_SAMPLE_ROWS_PER_TABLE}`;
        try {
          const result = await adapter.executeQuery(datasource, fallbackSql, {
            databaseName: databaseName || datasource.databaseName,
            resultLimit: MAX_SAMPLE_ROWS_PER_TABLE
          });
          const effectiveColumns = selectedColumns.length ? selectedColumns : (result.fields || []).slice(0, MAX_SAMPLE_COLUMNS_PER_TABLE);
          return {
            tableName: tableSchema.tableName,
            rowCount: Number(result.rowCount || (result.rows || []).length || 0),
            columns: effectiveColumns,
            truncated,
            sampleRows: (result.rows || []).map((row) => Object.fromEntries(
              effectiveColumns.map((column) => [column, sanitizeSampleValue(row?.[column])])
            )),
            sampleError: `\u968F\u673A\u62BD\u6837\u5931\u8D25\uFF0C\u5DF2\u56DE\u9000\u4E3A\u987A\u5E8F\u62BD\u6837: ${randomError.message || "unknown error"}`
          };
        } catch (fallbackError) {
          return {
            tableName: tableSchema.tableName,
            rowCount: 0,
            columns: selectedColumns,
            truncated,
            sampleRows: [],
            sampleError: fallbackError.message || randomError.message || "\u6837\u672C\u6570\u636E\u8BFB\u53D6\u5931\u8D25"
          };
        }
      }
    }
    async function loadTableSamples(adapter, datasource, databaseName, tableSchemas) {
      const sampledTables = [];
      for (const tableSchema of tableSchemas) {
        sampledTables.push(await sampleTableRows(adapter, datasource, databaseName, tableSchema));
      }
      return sampledTables;
    }
    function buildTaskInstructions(taskType) {
      switch (taskType) {
        case "generate_sql":
          return "\u6309\u7528\u6237\u9700\u6C42\u751F\u6210 SQL\u3002";
        case "analyze_sql":
          return "\u5206\u6790 SQL \u62A5\u9519\u3001\u903B\u8F91\u95EE\u9898\u6216\u8BED\u4E49\u95EE\u9898\uFF1B\u53EA\u6709\u786E\u5B9E\u9700\u8981\u4FEE\u590D\u65F6\u624D\u7ED9\u51FA\u4FEE\u590D SQL\u3002";
        case "rewrite_sql":
          return "\u5728\u539F SQL \u57FA\u7840\u4E0A\u6309\u65B0\u589E\u9700\u6C42\u6700\u5C0F\u6539\u52A8\u6539\u5199\u3002";
        case "optimize_sql":
          return "\u5206\u6790\u4E3B\u8981\u6027\u80FD\u95EE\u9898\u5E76\u7ED9\u51FA\u4F18\u5316 SQL \u6216\u4F18\u5316\u5EFA\u8BAE\u3002";
        case "explain_sql":
          return "\u53EA\u89E3\u91CA SQL \u7684\u4F5C\u7528\u3001\u5904\u7406\u903B\u8F91\u3001\u7ED3\u679C\u7C92\u5EA6\u548C\u5173\u952E\u6761\u4EF6\uFF0C\u4E0D\u8981\u539F\u6837\u590D\u8FF0\u6216\u91CD\u65B0\u8F93\u51FA SQL\u3002";
        case "data_research":
          return "\u57FA\u4E8E\u7528\u6237\u9009\u5B9A\u8868\u7684\u771F\u5B9E\u8868\u7ED3\u6784\u3001\u5B57\u6BB5\u6CE8\u91CA\u548C\u6837\u4F8B\u6570\u636E\u5F00\u5C55\u6570\u636E\u8C03\u7814\uFF0C\u53EA\u8F93\u51FA\u4E09\u6761\u805A\u7126\u5B9E\u9645\u4E1A\u52A1\u51B3\u7B56\u3001\u53EF\u76F4\u63A5\u5B9E\u65BD\u7684\u5B8C\u6574\u5206\u6790\u9700\u6C42\u3002";
        default:
          return "\u5B8C\u6210 SQL \u8F85\u52A9\u4EFB\u52A1\u3002";
      }
    }
    function requiresGeneratedSql(taskType) {
      return ["generate_sql", "rewrite_sql", "optimize_sql"].includes(taskType);
    }
    function buildTaskOutputInstructions(taskType, stream = false) {
      if (taskType === "data_research") {
        return stream ? [
          "\u6570\u636E\u8C03\u7814\u4EFB\u52A1\u7981\u6B62\u8F93\u51FA\u3010SQL\u3011\u6BB5\u843D\uFF0C\u5FC5\u987B\u4E25\u683C\u8F93\u51FA\u3010\u5206\u6790\u65B9\u54111\u3011\u3010\u5206\u6790\u65B9\u54112\u3011\u3010\u5206\u6790\u65B9\u54113\u3011\u4E09\u4E2A\u6BB5\u843D\uFF0C\u4E0D\u80FD\u591A\u4E5F\u4E0D\u80FD\u5C11\u3002",
          "\u6BCF\u4E2A\u5206\u6790\u65B9\u5411\u6BB5\u843D\u5FC5\u987B\u9010\u884C\u5305\u542B\uFF1A\u6807\u9898\u3001\u4E1A\u52A1\u95EE\u9898\u3001\u5206\u6790\u5BF9\u8C61\u3001\u5206\u6790\u7EF4\u5EA6\u3001\u6838\u5FC3\u6307\u6807\u3001\u7EDF\u8BA1\u53E3\u5F84\u3001\u6570\u636E\u4F9D\u636E\u3001\u4E1A\u52A1\u4EF7\u503C\u3002",
          "\u6BCF\u4E00\u6761\u90FD\u5FC5\u987B\u662F\u4E00\u9879\u805A\u7126\u5B9E\u9645\u4E1A\u52A1\u9700\u6C42\u3001\u80FD\u591F\u76F4\u63A5\u7528\u4E8E\u540E\u7EED\u751F\u6210 SQL \u7684\u5B8C\u6574\u5206\u6790\u9700\u6C42\uFF1B\u7981\u6B62\u628A\u5B57\u6BB5\u540D\u3001\u7EF4\u5EA6\u3001\u6307\u6807\u6216\u673A\u6784\u540D\u79F0\u5355\u72EC\u62C6\u6210\u5206\u6790\u65B9\u5411\u3002",
          "\u5206\u6790\u65B9\u5411\u5FC5\u987B\u4F9D\u636E\u771F\u5B9E\u8868\u7ED3\u6784\u3001\u5B57\u6BB5\u6CE8\u91CA\u548C\u6837\u4F8B\u503C\u63A8\u65AD\u4E1A\u52A1\u542B\u4E49\uFF0C\u4E09\u6761\u65B9\u5411\u5E94\u5206\u522B\u56DE\u7B54\u4E0D\u540C\u4E14\u660E\u786E\u7684\u4E1A\u52A1\u51B3\u7B56\u95EE\u9898\uFF0C\u907F\u514D\u6CDB\u5316\u7684\u89C4\u6A21\u3001\u8D8B\u52BF\u3001\u5F02\u5E38\u6A21\u677F\u3002"
        ].join("\n") : [
          "\u6570\u636E\u8C03\u7814\u4EFB\u52A1\u7684 generatedSql \u5FC5\u987B\u4E3A\u7A7A\u5B57\u7B26\u4E32\uFF0CanalysisDirections \u5FC5\u987B\u4E25\u683C\u5305\u542B\u4E09\u4E2A\u5BF9\u8C61\u3002",
          "\u6BCF\u4E2A\u5BF9\u8C61\u5FC5\u987B\u5B8C\u6574\u586B\u5199 title\u3001businessQuestion\u3001analysisObject\u3001dimensions\u3001metrics\u3001statisticalScope\u3001sourceFields\u3001businessValue\u3002",
          "\u7981\u6B62\u628A\u5B57\u6BB5\u540D\u3001\u7EF4\u5EA6\u3001\u6307\u6807\u6216\u673A\u6784\u540D\u79F0\u5355\u72EC\u62C6\u6210\u5206\u6790\u65B9\u5411\uFF1B\u6BCF\u6761\u90FD\u5FC5\u987B\u662F\u53EF\u76F4\u63A5\u5B9E\u65BD\u7684\u5B8C\u6574\u4E1A\u52A1\u5206\u6790\u9700\u6C42\u3002"
        ].join("\n");
      }
      if (taskType === "explain_sql") {
        return stream ? "\u89E3\u91CA\u4EFB\u52A1\u53EA\u8F93\u51FA\u6458\u8981\u3001\u5206\u6790\u8BF4\u660E\u548C\u5FC5\u8981\u7684\u8868/\u5047\u8BBE/\u98CE\u9669/\u5EFA\u8BAE\uFF0C\u7981\u6B62\u8F93\u51FA\u3010SQL\u3011\u6BB5\u843D\uFF0C\u7981\u6B62\u590D\u8FF0\u539F SQL\u3002" : "\u89E3\u91CA\u4EFB\u52A1\u7684 generatedSql \u5FC5\u987B\u4E3A\u7A7A\u5B57\u7B26\u4E32\uFF0C\u53EA\u8FD4\u56DE\u89E3\u91CA\u903B\u8F91\uFF0C\u7981\u6B62\u590D\u8FF0\u539F SQL\u3002";
      }
      if (taskType === "analyze_sql") {
        return stream ? "\u5206\u6790\u4EFB\u52A1\u4EE5\u95EE\u9898\u8BCA\u65AD\u4E3A\u4E3B\uFF1B\u4EC5\u5728\u5B58\u5728\u660E\u786E\u3001\u53EF\u843D\u5730\u7684\u4FEE\u590D\u65B9\u6848\u65F6\u8F93\u51FA\u3010SQL\u3011\u6BB5\u843D\uFF0C\u5426\u5219\u7701\u7565\u8BE5\u6BB5\u843D\u3002" : "\u5206\u6790\u4EFB\u52A1\u4EE5\u95EE\u9898\u8BCA\u65AD\u4E3A\u4E3B\uFF1B\u4EC5\u5728\u5B58\u5728\u660E\u786E\u3001\u53EF\u843D\u5730\u7684\u4FEE\u590D\u65B9\u6848\u65F6\u586B\u5199 generatedSql\uFF0C\u5426\u5219\u8FD4\u56DE\u7A7A\u5B57\u7B26\u4E32\u3002";
      }
      return stream ? "\u5FC5\u987B\u8F93\u51FA\u3010SQL\u3011\u6BB5\u843D\uFF0C\u4E14\u53EA\u653E\u53EF\u6267\u884C SQL \u5185\u5BB9\u3002" : "generatedSql \u5FC5\u987B\u586B\u5199\u53EF\u6267\u884C SQL\uFF0C\u4E14\u53EA\u8FD4\u56DE SQL \u5185\u5BB9\u3002";
    }
    function buildSystemPrompt(taskType, datasourceType, configuredPrompt = "") {
      const basePrompt = [
        "\u4F60\u662F\u4F01\u4E1A\u6570\u636E\u5F00\u53D1 SQL\u5206\u6790\u4E2D\u7684 SQL Copilot\u3002",
        "\u5FC5\u987B\u4E25\u683C\u4F9D\u636E\u5F53\u524D\u6570\u636E\u6E90\u5143\u6570\u636E\u56DE\u7B54\uFF0C\u4E0D\u5141\u8BB8\u81C6\u9020\u4E0D\u5B58\u5728\u7684\u8868\u6216\u5B57\u6BB5\u3002",
        `\u5F53\u524D\u6570\u636E\u5E93\u7C7B\u578B/SQL \u65B9\u8A00: ${datasourceType}\u3002`,
        `\u5F53\u524D\u4EFB\u52A1\u7C7B\u578B: ${taskType}\u3002`,
        buildTaskInstructions(taskType),
        buildTaskOutputInstructions(taskType),
        "\u4F18\u5148\u76F4\u63A5\u56DE\u7B54\u7528\u6237\u95EE\u9898\uFF0C\u4E0D\u8981\u8FC7\u5EA6\u53D1\u6563\uFF0C\u4E0D\u8981\u8865\u5145\u65E0\u5173\u80CC\u666F\u3002",
        "\u6240\u6709 SQL \u5FC5\u987B\u7B26\u5408\u5F53\u524D\u6570\u636E\u5E93\u7C7B\u578B/\u65B9\u8A00\uFF0C\u4E0D\u5141\u8BB8\u4F7F\u7528\u5176\u4ED6\u6570\u636E\u5E93\u7684\u8BED\u6CD5\u3002",
        "\u5982\u679C\u65E0\u6CD5\u786E\u8BA4\uFF0C\u660E\u786E\u8BF4\u660E\u4FE1\u606F\u4E0D\u8DB3\uFF0C\u4E0D\u8981\u731C\u6D4B\u3002",
        "\u8FD4\u56DE JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\uFF0C\u4E0D\u8981\u8F93\u51FA\u989D\u5916\u8BF4\u660E\u3002",
        JSON.stringify({
          summary: "string",
          explanation: "string",
          generatedSql: "string",
          assumptions: ["string"],
          risks: ["string"],
          suggestions: ["string"],
          analysisDirections: [{
            title: "string",
            businessQuestion: "string",
            analysisObject: "string",
            dimensions: ["string"],
            metrics: ["string"],
            statisticalScope: "string",
            sourceFields: ["table.field"],
            businessValue: "string"
          }],
          usedTables: [{ tableName: "string", reason: "string", columns: ["string"] }],
          diagnostics: [{ severity: "high|medium|low", title: "string", detail: "string" }]
        })
      ].join("\n");
      return configuredPrompt ? `${configuredPrompt}

${basePrompt}` : basePrompt;
    }
    function buildStreamSystemPrompt(taskType, datasourceType, configuredPrompt = "") {
      const omitsSql = ["explain_sql", "data_research"].includes(taskType);
      const sectionTitles = [
        "\u3010\u6458\u8981\u3011",
        "\u3010\u5206\u6790\u8BF4\u660E\u3011",
        ...omitsSql ? [] : ["\u3010SQL\u3011"],
        ...taskType === "data_research" ? ["\u3010\u5206\u6790\u65B9\u54111\u3011", "\u3010\u5206\u6790\u65B9\u54112\u3011", "\u3010\u5206\u6790\u65B9\u54113\u3011"] : [],
        "\u3010\u4F7F\u7528\u8868\u3011",
        "\u3010\u95EE\u9898\u8BCA\u65AD\u3011",
        "\u3010\u5173\u952E\u5047\u8BBE\u3011",
        "\u3010\u98CE\u9669\u63D0\u793A\u3011",
        ...taskType === "data_research" ? [] : ["\u3010\u540E\u7EED\u5EFA\u8BAE\u3011"]
      ];
      const basePrompt = [
        "\u4F60\u662F\u4F01\u4E1A\u6570\u636E\u5F00\u53D1 SQL\u5206\u6790\u4E2D\u7684 SQL Copilot\u3002",
        "\u5FC5\u987B\u4E25\u683C\u4F9D\u636E\u5F53\u524D\u6570\u636E\u6E90\u5143\u6570\u636E\u56DE\u7B54\uFF0C\u4E0D\u5141\u8BB8\u81C6\u9020\u4E0D\u5B58\u5728\u7684\u8868\u6216\u5B57\u6BB5\u3002",
        `\u5F53\u524D\u6570\u636E\u5E93\u7C7B\u578B/SQL \u65B9\u8A00: ${datasourceType}\u3002`,
        `\u5F53\u524D\u4EFB\u52A1\u7C7B\u578B: ${taskType}\u3002`,
        buildTaskInstructions(taskType),
        buildTaskOutputInstructions(taskType, true),
        "\u4F18\u5148\u76F4\u63A5\u56DE\u7B54\u7528\u6237\u95EE\u9898\uFF0C\u4E0D\u8981\u8FC7\u5EA6\u53D1\u6563\uFF0C\u4E0D\u8981\u8865\u5145\u65E0\u5173\u80CC\u666F\u3002",
        "\u6240\u6709 SQL \u5FC5\u987B\u7B26\u5408\u5F53\u524D\u6570\u636E\u5E93\u7C7B\u578B/\u65B9\u8A00\uFF0C\u4E0D\u5141\u8BB8\u4F7F\u7528\u5176\u4ED6\u6570\u636E\u5E93\u7684\u8BED\u6CD5\u3002",
        "\u8BF7\u4F7F\u7528\u7EAF\u6587\u672C\u5206\u6BB5\u8F93\u51FA\uFF0C\u4E0D\u8981\u8F93\u51FA JSON\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown \u4EE3\u7801\u5757\u3002",
        "\u4F7F\u7528\u4EE5\u4E0B\u6BB5\u843D\u6807\u9898\u7EC4\u7EC7\u56DE\u7B54\uFF1A",
        ...sectionTitles
      ].join("\n");
      return configuredPrompt ? `${configuredPrompt}

${basePrompt}` : basePrompt;
    }
    function buildConversationPrompt(conversation) {
      if (!Array.isArray(conversation) || conversation.length === 0) {
        return "";
      }
      return conversation.slice(-MAX_CONVERSATION_ITEMS).map((item) => `${item.role}: ${item.content}`).join("\n\n");
    }
    function buildUserPrompt(payload, context) {
      const blocks = [
        `\u4EFB\u52A1\u7C7B\u578B: ${payload.taskType}`,
        `\u5F53\u524D\u6570\u636E\u5E93: ${payload.databaseName || context.datasource.databaseName || ""}`,
        `\u5F53\u524D\u6570\u636E\u5E93\u7C7B\u578B/\u65B9\u8A00: ${context.datasource.type}`,
        "\u53EF\u7528\u8868\u6E05\u5355:",
        JSON.stringify(context.availableTableNames),
        "\u91CD\u70B9\u8868\u7ED3\u6784:",
        JSON.stringify(context.tableSchemas)
      ];
      if (context.selectedTables?.length) {
        blocks.push("\u7528\u6237\u6307\u5B9A\u8868\u8303\u56F4:");
        blocks.push(JSON.stringify(context.selectedTables));
      }
      if (context.sampledTables?.length) {
        blocks.push("\u91CD\u70B9\u8868\u6837\u672C\u6570\u636E:");
        blocks.push(JSON.stringify(context.sampledTables));
      }
      if (payload.prompt) {
        blocks.push(`\u7528\u6237\u95EE\u9898:
${payload.prompt}`);
      }
      if (payload.selectedSql) {
        blocks.push(`\u7528\u6237\u9009\u4E2D\u7684 SQL:
${payload.selectedSql}`);
      }
      if (payload.editorSql && payload.editorSql !== payload.selectedSql) {
        blocks.push(`\u7F16\u8F91\u5668\u5F53\u524D SQL:
${payload.editorSql}`);
      }
      if (payload.errorMessage) {
        blocks.push(`\u6700\u8FD1\u6267\u884C\u9519\u8BEF:
${payload.errorMessage}`);
      }
      if (context.activeExecution) {
        blocks.push("\u5F53\u524D\u6FC0\u6D3B\u6267\u884C\u7ED3\u679C:");
        blocks.push(JSON.stringify(context.activeExecution));
      }
      const conversationPrompt = buildConversationPrompt(payload.conversation);
      if (conversationPrompt) {
        blocks.push(`\u6700\u8FD1\u591A\u8F6E\u4E0A\u4E0B\u6587:
${conversationPrompt}`);
      }
      const generatedSqlRequirement = payload.taskType === "data_research" ? "2. \u7981\u6B62\u8F93\u51FA SQL\uFF1B\u5FC5\u987B\u7ED3\u5408\u8868\u7ED3\u6784\u3001\u5B57\u6BB5\u6CE8\u91CA\u548C\u6837\u4F8B\u503C\u751F\u6210\u4E14\u4EC5\u751F\u6210\u4E09\u6761\u5B8C\u6574\u4E1A\u52A1\u5206\u6790\u9700\u6C42\uFF0C\u6BCF\u6761\u90FD\u5305\u542B\u6807\u9898\u3001\u4E1A\u52A1\u95EE\u9898\u3001\u5206\u6790\u5BF9\u8C61\u3001\u5206\u6790\u7EF4\u5EA6\u3001\u6838\u5FC3\u6307\u6807\u3001\u7EDF\u8BA1\u53E3\u5F84\u3001\u6570\u636E\u4F9D\u636E\u548C\u4E1A\u52A1\u4EF7\u503C\uFF0C\u7981\u6B62\u5C06\u5B57\u6BB5\u3001\u7EF4\u5EA6\u6216\u6307\u6807\u62C6\u6210\u72EC\u7ACB\u65B9\u5411\u3002" : payload.taskType === "explain_sql" ? "2. \u53EA\u8FD4\u56DE\u89E3\u91CA\u903B\u8F91\uFF0C\u7981\u6B62\u8F93\u51FA\u6216\u590D\u8FF0\u539F SQL\u3002" : payload.taskType === "analyze_sql" ? "2. \u4EC5\u5728\u786E\u5B9E\u9700\u8981\u4FEE\u590D\u65F6\u8FD4\u56DE\u4FEE\u590D SQL\uFF0C\u4E0D\u9700\u8981\u4FEE\u590D\u65F6\u4E0D\u8981\u8F93\u51FA SQL\u3002" : "2. \u8FD4\u56DE\u7684 SQL \u53EA\u5305\u542B SQL \u5185\u5BB9\uFF0C\u4E0D\u8981\u5E26\u4EE3\u7801\u5757\u3002";
      blocks.push([
        "\u8981\u6C42:",
        "1. \u751F\u6210/\u5206\u6790\u65F6\u5FC5\u987B\u57FA\u4E8E\u5F53\u524D\u6570\u636E\u5E93\u7C7B\u578B/\u65B9\u8A00\u3002",
        generatedSqlRequirement,
        "3. usedTables \u5FC5\u987B\u6765\u81EA\u7ED9\u5B9A\u5143\u6570\u636E\u3002",
        "4. \u5982\u679C\u63D0\u4F9B\u4E86\u6837\u672C\u6570\u636E\uFF0C\u4F18\u5148\u7ED3\u5408\u6837\u672C\u503C\u8BED\u4E49\u7406\u89E3\u4E1A\u52A1\u5B57\u6BB5\u548C\u679A\u4E3E\u542B\u4E49\u3002",
        "5. \u5982\u679C\u63D0\u4F9B\u4E86\u5F53\u524D\u6FC0\u6D3B\u6267\u884C\u7ED3\u679C\uFF0C\u5FC5\u987B\u5728\u56DE\u7B54\u4E2D\u660E\u786E\u5229\u7528\u5176\u5B57\u6BB5\u3001\u884C\u6570\u3001\u9884\u89C8\u503C\u3001\u72B6\u6001\u6216\u9519\u8BEF\uFF0C\u4E0D\u5F97\u5047\u88C5\u770B\u5230\u4E86\u672A\u63D0\u4F9B\u7684\u5B8C\u6574\u7ED3\u679C\u3002",
        "6. \u5982\u679C\u4FE1\u606F\u4E0D\u8DB3\uFF0C\u76F4\u63A5\u8BF4\u660E\u3002"
      ].join("\n"));
      return blocks.join("\n\n");
    }
    function parseJsonObject(content) {
      const raw = normalizeText(content);
      if (!raw) return null;
      const candidates = [raw];
      const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fencedMatch?.[1]) {
        candidates.push(fencedMatch[1].trim());
      }
      const objectMatch = raw.match(/\{[\s\S]*\}/);
      if (objectMatch?.[0]) {
        candidates.push(objectMatch[0].trim());
      }
      for (const candidate of candidates) {
        try {
          return JSON.parse(candidate);
        } catch {
          continue;
        }
      }
      return null;
    }
    function extractSqlSnippet(rawText) {
      const raw = normalizeText(rawText);
      if (!raw) return "";
      const fenced = raw.match(/```sql\s*([\s\S]*?)```/i);
      if (fenced?.[1]) {
        return fenced[1].trim();
      }
      if (isQuerySql(raw) || /^(insert|update|delete|create|alter|drop)\b/i.test(raw)) {
        return raw.replace(/```/g, "").trim();
      }
      return "";
    }
    function resolveGeneratedSql(taskType, candidate, rawText) {
      if (["explain_sql", "data_research"].includes(taskType)) return "";
      return normalizeText(candidate) || extractSqlSnippet(rawText);
    }
    function parseSectionedContent(rawText) {
      const raw = String(rawText || "").replace(/\r/g, "").trim();
      if (!raw) return {};
      const sectionMatches = Array.from(raw.matchAll(/【([^】]+)】/g));
      if (!sectionMatches.length) {
        return {};
      }
      const sections = {};
      for (let index = 0; index < sectionMatches.length; index += 1) {
        const match = sectionMatches[index];
        const title = String(match[1] || "").trim();
        const start = match.index + match[0].length;
        const end = index + 1 < sectionMatches.length ? sectionMatches[index + 1].index : raw.length;
        sections[title] = raw.slice(start, end).trim();
      }
      return sections;
    }
    function parseBulletList(value) {
      return String(value || "").split("\n").map((line) => line.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, "").trim()).filter(Boolean);
    }
    function normalizeDiagnostics(value) {
      if (!Array.isArray(value)) return [];
      return value.map((item) => ({
        severity: ["high", "medium", "low"].includes(String(item?.severity || "").toLowerCase()) ? String(item.severity).toLowerCase() : "medium",
        title: normalizeText(item?.title),
        detail: normalizeText(item?.detail)
      })).filter((item) => item.title || item.detail);
    }
    function parseDiagnosticsFromSections(value) {
      return parseBulletList(value).map((line) => {
        const [severityRaw, titleRaw, detailRaw] = line.split("|").map((item) => String(item || "").trim());
        return {
          severity: ["high", "medium", "low"].includes(severityRaw.toLowerCase()) ? severityRaw.toLowerCase() : "medium",
          title: titleRaw || "",
          detail: detailRaw || ""
        };
      }).filter((item) => item.title || item.detail);
    }
    function normalizeUsedTables(value, availableTableNames) {
      if (!Array.isArray(value)) return [];
      const available = new Set((availableTableNames || []).map((item) => String(item)));
      return value.map((item) => ({
        tableName: normalizeText(item?.tableName),
        reason: normalizeText(item?.reason),
        columns: uniqueStrings(item?.columns)
      })).filter((item) => item.tableName && available.has(item.tableName));
    }
    function parseUsedTablesFromSections(value, availableTableNames) {
      const available = new Set((availableTableNames || []).map((item) => String(item)));
      return parseBulletList(value).map((line) => {
        const [tableNameRaw, reasonRaw, columnsRaw] = line.split("|").map((item) => String(item || "").trim());
        return {
          tableName: tableNameRaw,
          reason: reasonRaw || "",
          columns: uniqueStrings(String(columnsRaw || "").split(",").map((item) => item.trim()))
        };
      }).filter((item) => item.tableName && available.has(item.tableName));
    }
    async function validateGeneratedSql(generatedSql, session) {
      const sqlText = normalizeText(generatedSql);
      if (!sqlText) {
        return {
          valid: false,
          syntaxValid: false,
          objectValid: false,
          explainValid: false,
          messages: ["AI \u672A\u8FD4\u56DE\u53EF\u6267\u884C SQL"]
        };
      }
      const messages = [];
      let syntaxValid = true;
      let objectValid = true;
      let explainValid = false;
      try {
        sqlParser.parseSql(sqlText, session.datasource.type);
      } catch (error) {
        syntaxValid = false;
        objectValid = false;
        messages.push(error.message || "SQL \u8BED\u6CD5\u6821\u9A8C\u5931\u8D25");
        return { valid: false, syntaxValid, objectValid, explainValid, messages };
      }
      const referencedTables = uniqueStrings(sqlParser.extractTables(sqlText, session.datasource.type));
      const availableTables = new Set(
        (session.context.availableTableNames || []).map((item) => String(item).toLowerCase())
      );
      for (const tableName of referencedTables) {
        const normalized = String(tableName || "").toLowerCase();
        const exists = availableTables.has(normalized) || Array.from(availableTables).some((item) => item.endsWith(`.${normalized}`));
        if (!exists) {
          objectValid = false;
          messages.push(`\u672A\u5728\u5F53\u524D${session.datasource.type}\u6570\u636E\u6E90\u4E2D\u8BC6\u522B\u5230\u8868: ${tableName}`);
        }
      }
      if (syntaxValid && objectValid && isQuerySql(sqlText)) {
        try {
          await session.adapter.executeQuery(session.datasource, `EXPLAIN ${sqlText}`, {
            databaseName: session.databaseName || session.datasource.databaseName,
            resultLimit: 20
          });
          explainValid = true;
        } catch (error) {
          messages.push(`Explain \u6821\u9A8C\u672A\u901A\u8FC7: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`);
        }
      } else if (syntaxValid && objectValid) {
        explainValid = true;
      }
      if (syntaxValid && objectValid && explainValid) {
        messages.push(`\u5DF2\u57FA\u4E8E\u5F53\u524D${session.datasource.type}\u65B9\u8A00\u5B8C\u6210 SQL \u6821\u9A8C`);
      }
      return {
        valid: syntaxValid && objectValid && explainValid,
        syntaxValid,
        objectValid,
        explainValid,
        messages
      };
    }
    function buildDefaultUsedTables(context) {
      return context.tableSchemas.slice(0, 3).map((item) => ({
        tableName: item.tableName,
        reason: "\u4F5C\u4E3A\u5F53\u524D\u4EFB\u52A1\u7684\u5019\u9009\u4E0A\u4E0B\u6587\u8868",
        columns: item.columns.slice(0, 6).map((column) => column.name)
      }));
    }
    function summarizeSampledTables(context) {
      return (context.sampledTables || []).map((item) => ({
        tableName: item.tableName,
        rowCount: item.rowCount,
        columns: item.columns,
        truncated: Boolean(item.truncated),
        sampleError: item.sampleError || null
      }));
    }
    function normalizeDirectionList(value) {
      if (Array.isArray(value)) return uniqueStrings(value);
      return uniqueStrings(String(value || "").split(/[、,，;；]/).map((item) => item.trim()));
    }
    function normalizeAnalysisDirection(value) {
      if (!value || typeof value !== "object") return null;
      const direction = {
        title: normalizeText(value.title),
        businessQuestion: normalizeText(value.businessQuestion),
        analysisObject: normalizeText(value.analysisObject),
        dimensions: normalizeDirectionList(value.dimensions),
        metrics: normalizeDirectionList(value.metrics),
        statisticalScope: normalizeText(value.statisticalScope),
        sourceFields: normalizeDirectionList(value.sourceFields),
        businessValue: normalizeText(value.businessValue)
      };
      return direction.title && direction.businessQuestion ? direction : null;
    }
    function parseAnalysisDirectionSection(value) {
      const fieldMap = {
        "\u6807\u9898": "title",
        "\u4E1A\u52A1\u95EE\u9898": "businessQuestion",
        "\u5206\u6790\u5BF9\u8C61": "analysisObject",
        "\u5206\u6790\u7EF4\u5EA6": "dimensions",
        "\u6838\u5FC3\u6307\u6807": "metrics",
        "\u7EDF\u8BA1\u53E3\u5F84": "statisticalScope",
        "\u6570\u636E\u4F9D\u636E": "sourceFields",
        "\u4E1A\u52A1\u4EF7\u503C": "businessValue"
      };
      const parsed = {};
      let currentField = null;
      for (const rawLine of String(value || "").split("\n")) {
        const line = rawLine.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, "").replace(/\*\*/g, "").trim();
        if (!line) continue;
        const match = line.match(/^(标题|业务问题|分析对象|分析维度|核心指标|统计口径|数据依据|业务价值)\s*[：:]\s*(.*)$/);
        if (match) {
          currentField = fieldMap[match[1]];
          parsed[currentField] = match[2].trim();
        } else if (currentField) {
          parsed[currentField] = `${parsed[currentField] || ""}${parsed[currentField] ? "\uFF1B" : ""}${line}`;
        }
      }
      return normalizeAnalysisDirection(parsed);
    }
    function buildFallbackAnalysisDirections(context) {
      const tableNames = context.tableSchemas.map((item) => item.tableName);
      const fields = context.tableSchemas.flatMap((table) => table.columns.map((column) => ({
        tableName: table.tableName,
        name: column.name,
        dataType: String(column.dataType || column.columnType || "").toLowerCase(),
        comment: String(column.comment || "")
      })));
      const findFields = (pattern, typePattern = null) => fields.filter((field) => pattern.test(`${field.name} ${field.comment}`) || (typePattern ? typePattern.test(field.dataType) : false));
      const timeFields = findFields(/时间|日期|创建|提交|完成|time|date|created|updated/i, /date|time/);
      const statusFields = findFields(/状态|结果|阶段|类型|渠道|机构|区域|部门|status|result|type|channel|org|region/i);
      const numericFields = fields.filter((field) => /int|number|numeric|decimal|float|double/.test(field.dataType));
      const identifierFields = findFields(/编号|编码|流水|主键|标识|(^|_)id($|_)|code|no$/i);
      const source = (items) => uniqueStrings(items.slice(0, 8).map((item) => `${item.tableName}.${item.name}`));
      const tableScope = tableNames.join("\u3001") || "\u6240\u9009\u4E1A\u52A1\u8868";
      const dimensionFields = source(statusFields.length ? statusFields : fields);
      const metricFields = source(numericFields.length ? numericFields : identifierFields.length ? identifierFields : fields);
      const timeSource = source(timeFields);
      return [
        {
          title: "\u6838\u5FC3\u4E1A\u52A1\u529E\u7406\u7ED3\u6784\u4E0E\u5DEE\u5F02\u5206\u6790",
          businessQuestion: `\u5F53\u524D ${tableScope} \u6240\u53CD\u6620\u7684\u6838\u5FC3\u4E1A\u52A1\u91CF\u4E3B\u8981\u96C6\u4E2D\u5728\u54EA\u4E9B\u7C7B\u578B\u3001\u6E20\u9053\u6216\u7EC4\u7EC7\uFF0C\u7ED3\u6784\u5DEE\u5F02\u662F\u5426\u9700\u8981\u8C03\u6574\u8D44\u6E90\u914D\u7F6E\uFF1F`,
          analysisObject: `\u6240\u9009\u8868\u4E2D\u7684\u6838\u5FC3\u4E1A\u52A1\u8BB0\u5F55\u53CA\u5176\u6240\u5C5E\u7C7B\u578B\u3001\u6E20\u9053\u6216\u7EC4\u7EC7`,
          dimensions: dimensionFields,
          metrics: ["\u4E1A\u52A1\u8BB0\u5F55\u6570", "\u5404\u5206\u7C7B\u5360\u6BD4", "\u5206\u7C7B\u95F4\u5DEE\u5F02"],
          statisticalScope: `\u6309\u4E1A\u52A1\u552F\u4E00\u6807\u8BC6\u53BB\u91CD\u540E\u7EDF\u8BA1\uFF1B\u5206\u7C7B\u53E3\u5F84\u4EE5 ${dimensionFields.join("\u3001") || "\u53EF\u8BC6\u522B\u7684\u5206\u7C7B\u5B57\u6BB5"} \u7684\u5B9E\u9645\u53D6\u503C\u4E3A\u51C6\u3002`,
          sourceFields: uniqueStrings([...dimensionFields, ...source(identifierFields)]),
          businessValue: "\u8BC6\u522B\u4E1A\u52A1\u91CF\u96C6\u4E2D\u533A\u57DF\u548C\u7ED3\u6784\u5931\u8861\uFF0C\u4E3A\u4EBA\u5458\u3001\u6E20\u9053\u6216\u670D\u52A1\u8D44\u6E90\u914D\u7F6E\u63D0\u4F9B\u4F9D\u636E\u3002"
        },
        {
          title: "\u4E1A\u52A1\u5904\u7406\u65F6\u6548\u4E0E\u79EF\u538B\u73AF\u8282\u5206\u6790",
          businessQuestion: `\u5404\u7C7B\u4E1A\u52A1\u4ECE\u53D1\u751F\u5230\u5B8C\u6210\u9700\u8981\u591A\u957F\u65F6\u95F4\uFF0C\u54EA\u4E9B\u72B6\u6001\u3001\u7EC4\u7EC7\u6216\u6E20\u9053\u5B58\u5728\u660E\u663E\u79EF\u538B\u6216\u5904\u7406\u504F\u6162\uFF1F`,
          analysisObject: "\u5177\u6709\u65F6\u95F4\u548C\u5904\u7406\u72B6\u6001\u4FE1\u606F\u7684\u4E1A\u52A1\u8BB0\u5F55",
          dimensions: uniqueStrings([...dimensionFields, ...timeSource.length ? ["\u65E5/\u5468/\u6708"] : []]),
          metrics: ["\u5904\u7406\u4E1A\u52A1\u91CF", "\u5E73\u5747\u5904\u7406\u65F6\u957F", "\u8D85\u65F6\u4E1A\u52A1\u91CF", "\u5B8C\u6210\u7387"],
          statisticalScope: `\u4EE5 ${timeSource.join("\u3001") || "\u53EF\u8BC6\u522B\u7684\u4E1A\u52A1\u65F6\u95F4\u5B57\u6BB5"} \u786E\u5B9A\u53D1\u751F\u4E0E\u5B8C\u6210\u65F6\u95F4\uFF1B\u5B8C\u6210\u72B6\u6001\u4EE5\u6837\u4F8B\u6570\u636E\u4E2D\u7684\u5B9E\u9645\u72B6\u6001\u503C\u4E3A\u51C6\u3002`,
          sourceFields: uniqueStrings([...timeSource, ...dimensionFields]),
          businessValue: "\u5B9A\u4F4D\u529E\u7406\u74F6\u9888\u548C\u79EF\u538B\u73AF\u8282\uFF0C\u4E3A\u6D41\u7A0B\u4F18\u5316\u4E0E\u670D\u52A1\u65F6\u6548\u8003\u6838\u63D0\u4F9B\u4F9D\u636E\u3002"
        },
        {
          title: "\u4E1A\u52A1\u7ED3\u679C\u8D28\u91CF\u4E0E\u91CD\u70B9\u98CE\u9669\u8BC6\u522B",
          businessQuestion: `\u54EA\u4E9B\u4E1A\u52A1\u7C7B\u578B\u3001\u7EC4\u7EC7\u6216\u6E20\u9053\u7684\u5931\u8D25\u3001\u9000\u56DE\u3001\u5F02\u5E38\u6216\u4F4E\u8D28\u91CF\u7ED3\u679C\u66F4\u96C6\u4E2D\uFF0C\u4E3B\u8981\u98CE\u9669\u7EC4\u5408\u662F\u4EC0\u4E48\uFF1F`,
          analysisObject: "\u5177\u6709\u7ED3\u679C\u3001\u72B6\u6001\u6216\u8D28\u91CF\u7279\u5F81\u7684\u4E1A\u52A1\u8BB0\u5F55",
          dimensions: dimensionFields,
          metrics: ["\u5F02\u5E38\u4E1A\u52A1\u91CF", "\u5F02\u5E38\u7387", "\u5931\u8D25\u6216\u9000\u56DE\u7387", "\u98CE\u9669\u7EC4\u5408\u5360\u6BD4"],
          statisticalScope: `\u5F02\u5E38\u53E3\u5F84\u4EC5\u4F9D\u636E ${source(statusFields).join("\u3001") || "\u53EF\u8BC6\u522B\u7684\u72B6\u6001\u548C\u7ED3\u679C\u5B57\u6BB5"} \u7684\u771F\u5B9E\u53D6\u503C\u5B9A\u4E49\uFF0C\u4E0D\u63A8\u65AD\u6837\u4F8B\u4E2D\u4E0D\u5B58\u5728\u7684\u5F02\u5E38\u7C7B\u578B\u3002`,
          sourceFields: uniqueStrings([...source(statusFields), ...metricFields]),
          businessValue: "\u8BC6\u522B\u9AD8\u98CE\u9669\u4E1A\u52A1\u7EC4\u5408\uFF0C\u652F\u6301\u8D28\u91CF\u6CBB\u7406\u3001\u95EE\u9898\u6392\u67E5\u548C\u91CD\u70B9\u5BF9\u8C61\u8DDF\u8FDB\u3002"
        }
      ];
    }
    function normalizeAnalysisDirections(values, legacySuggestions, context) {
      const directions = (Array.isArray(values) ? values : []).map(normalizeAnalysisDirection).filter(Boolean);
      const legacyDirections = uniqueStrings(legacySuggestions).slice(0, 3).map((item, index) => normalizeAnalysisDirection({
        title: item.split(/[：:]/, 1)[0] || `\u5206\u6790\u65B9\u5411 ${index + 1}`,
        businessQuestion: item,
        analysisObject: context.tableSchemas.map((table) => table.tableName).join("\u3001") || "\u6240\u9009\u4E1A\u52A1\u8868",
        dimensions: [],
        metrics: [],
        statisticalScope: "\u4EE5\u6240\u9009\u8868\u4E2D\u7684\u771F\u5B9E\u5B57\u6BB5\u548C\u6837\u4F8B\u503C\u4E3A\u51C6\u3002",
        sourceFields: [],
        businessValue: "\u7528\u4E8E\u5F62\u6210\u540E\u7EED\u53EF\u6267\u884C\u7684\u6570\u636E\u5206\u6790\u9700\u6C42\u3002"
      })).filter(Boolean);
      return [...directions, ...legacyDirections, ...buildFallbackAnalysisDirections(context)].slice(0, 3);
    }
    function normalizeResult(taskType, rawText, parsed, context, provider) {
      const availableTableNames = context.tableSchemas.map((item) => item.tableName);
      const generatedSql = resolveGeneratedSql(taskType, parsed?.generatedSql, rawText);
      const usedTables = normalizeUsedTables(parsed?.usedTables, availableTableNames);
      const analysisDirections = taskType === "data_research" ? normalizeAnalysisDirections(parsed?.analysisDirections, parsed?.suggestions, context) : [];
      const suggestions = taskType === "data_research" ? analysisDirections.map((item) => item.businessQuestion) : uniqueStrings(parsed?.suggestions);
      return {
        taskType,
        provider: {
          id: provider.id,
          configName: provider.configName,
          modelName: provider.modelName,
          modelVersion: provider.modelVersion || null,
          providerType: provider.providerType
        },
        summary: normalizeText(parsed?.summary) || (taskType === "data_research" ? "\u5DF2\u5B8C\u6210\u6240\u9009\u8868\u7684\u6570\u636E\u8C03\u7814" : "AI \u5DF2\u8FD4\u56DE SQL \u8F85\u52A9\u7ED3\u679C"),
        explanation: normalizeText(parsed?.explanation) || normalizeText(rawText),
        generatedSql,
        assumptions: uniqueStrings(parsed?.assumptions),
        risks: uniqueStrings(parsed?.risks),
        suggestions,
        analysisDirections,
        diagnostics: normalizeDiagnostics(parsed?.diagnostics),
        usedTables: usedTables.length ? usedTables : buildDefaultUsedTables(context),
        referencedTables: context.referencedTables,
        metadataTables: context.tableSchemas.map((item) => ({
          tableName: item.tableName,
          tableType: item.tableType,
          columnCount: item.columns.length
        })),
        sampledTables: summarizeSampledTables(context),
        activeExecution: context.activeExecution,
        validation: context.validation,
        rawText: normalizeText(rawText)
      };
    }
    function normalizeResultFromSections(taskType, rawText, context, provider) {
      const sections = parseSectionedContent(rawText);
      const availableTableNames = context.tableSchemas.map((item) => item.tableName);
      const generatedSql = resolveGeneratedSql(taskType, sections.SQL, rawText);
      const usedTables = parseUsedTablesFromSections(sections["\u4F7F\u7528\u8868"], availableTableNames);
      const parsedDirections = taskType === "data_research" ? [1, 2, 3].map((index) => parseAnalysisDirectionSection(sections[`\u5206\u6790\u65B9\u5411${index}`])).filter(Boolean) : [];
      const analysisDirections = taskType === "data_research" ? normalizeAnalysisDirections(parsedDirections, parseBulletList(sections["\u5206\u6790\u65B9\u5411"]), context) : [];
      const suggestions = taskType === "data_research" ? analysisDirections.map((item) => item.businessQuestion) : uniqueStrings(parseBulletList(sections["\u540E\u7EED\u5EFA\u8BAE"]));
      return {
        taskType,
        provider: {
          id: provider.id,
          configName: provider.configName,
          modelName: provider.modelName,
          modelVersion: provider.modelVersion || null,
          providerType: provider.providerType
        },
        summary: normalizeText(sections["\u6458\u8981"]) || (taskType === "data_research" ? "\u5DF2\u5B8C\u6210\u6240\u9009\u8868\u7684\u6570\u636E\u8C03\u7814" : "AI \u5DF2\u8FD4\u56DE SQL \u8F85\u52A9\u7ED3\u679C"),
        explanation: normalizeText(sections["\u5206\u6790\u8BF4\u660E"]) || normalizeText(rawText),
        generatedSql,
        assumptions: uniqueStrings(parseBulletList(sections["\u5173\u952E\u5047\u8BBE"])),
        risks: uniqueStrings(parseBulletList(sections["\u98CE\u9669\u63D0\u793A"])),
        suggestions,
        analysisDirections,
        diagnostics: parseDiagnosticsFromSections(sections["\u95EE\u9898\u8BCA\u65AD"]),
        usedTables: usedTables.length ? usedTables : buildDefaultUsedTables(context),
        referencedTables: context.referencedTables,
        metadataTables: context.tableSchemas.map((item) => ({
          tableName: item.tableName,
          tableType: item.tableType,
          columnCount: item.columns.length
        })),
        sampledTables: summarizeSampledTables(context),
        activeExecution: context.activeExecution,
        validation: context.validation,
        rawText: normalizeText(rawText)
      };
    }
    async function prepareConversation(payload, user, streamContext) {
      const actualPayload = { ...payload, taskType: inferTaskType(payload) };
      if (!TASK_TYPES.has(actualPayload.taskType)) {
        throw new AppError("\u4E0D\u652F\u6301\u7684 Copilot \u4EFB\u52A1\u7C7B\u578B", 400);
      }
      if (actualPayload.taskType === "data_research" && uniqueStrings(actualPayload.selectedTables).length === 0) {
        throw new AppError("\u6570\u636E\u8C03\u7814\u8BF7\u81F3\u5C11\u9009\u62E9 1 \u5F20\u8868", 400);
      }
      const userId = Number(user?.id || user?.sub || 0);
      if (!userId) {
        return { payload: actualPayload, session: null };
      }
      let session = null;
      let previousMessages = [];
      if (payload.sessionId) {
        session = await repository.getCopilotSessionById(payload.sessionId, userId);
        if (!session) {
          throw new AppError("SQL \u667A\u80FD\u8F85\u52A9\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE", 404);
        }
        if (Number(session.datasourceId) !== Number(payload.datasourceId)) {
          throw new AppError("\u5F53\u524D\u4F1A\u8BDD\u4E0E\u6240\u9009\u6570\u636E\u6E90\u4E0D\u4E00\u81F4\uFF0C\u8BF7\u65B0\u5EFA\u4F1A\u8BDD", 400);
        }
        previousMessages = await repository.listCopilotMessages(session.id, userId, 100);
      } else {
        session = await repository.createCopilotSession({
          userId,
          datasourceId: payload.datasourceId,
          databaseName: payload.databaseName,
          sessionTitle: buildSessionTitle(actualPayload)
        });
      }
      actualPayload.sessionId = session.id;
      actualPayload.conversation = previousMessages.length ? buildConversationFromMessages(previousMessages) : payload.conversation || [];
      await repository.createCopilotMessage({
        sessionId: session.id,
        role: "user",
        taskType: actualPayload.taskType,
        messageText: normalizeText(payload.prompt) || (actualPayload.taskType === "data_research" ? `\u8BF7\u57FA\u4E8E\u5DF2\u9009 ${uniqueStrings(payload.selectedTables).length} \u5F20\u8868\u7684\u7ED3\u6784\u4E0E\u6837\u4F8B\u6570\u636E\u5F00\u5C55\u6570\u636E\u8C03\u7814\u3002` : "\u8BF7\u57FA\u4E8E\u5F53\u524D SQL \u4E0A\u4E0B\u6587\u7EE7\u7EED\u5904\u7406\u3002"),
        context: {
          datasourceId: payload.datasourceId,
          databaseName: payload.databaseName || null,
          selectedTables: payload.selectedTables || [],
          hasSelectedSql: Boolean(payload.selectedSql),
          hasEditorSql: Boolean(payload.editorSql),
          activeExecutionHistoryId: payload.activeExecutionHistoryId || null
        }
      });
      await repository.touchCopilotSession(session.id, userId, {
        sessionTitle: previousMessages.length ? null : buildSessionTitle(actualPayload),
        datasourceId: payload.datasourceId,
        databaseName: payload.databaseName
      });
      streamContext.write?.({ type: "session", data: { sessionId: session.id } });
      return { payload: actualPayload, session };
    }
    async function resolveCopilotSession(payload, streamContext = {}, processSteps = []) {
      addProgress(streamContext, processSteps, "intent", "\u8BC6\u522B\u4EFB\u52A1", `\u5DF2\u8BC6\u522B\u4E3A${buildTaskInstructions(payload.taskType).replace(/。$/, "")}\u4EFB\u52A1`);
      const datasource = materializeDatasource(await requireDatasource(payload.datasourceId, true));
      const adapter = getAdapter(datasource);
      const databaseName = payload.databaseName || datasource.databaseName || void 0;
      const taskConfig = await resolveTaskConfig(payload.taskType);
      addProgress(streamContext, processSteps, "datasource", "\u8BFB\u53D6\u5DE5\u4F5C\u53F0\u4E0A\u4E0B\u6587", `${datasource.name} / ${databaseName || "\u9ED8\u8BA4\u6570\u636E\u5E93"} / ${datasource.type}`);
      let activeExecution = null;
      if (payload.activeExecutionHistoryId) {
        const history = await repository.getQueryHistoryById(payload.activeExecutionHistoryId);
        if (history && Number(history.datasourceId) === Number(payload.datasourceId)) {
          activeExecution = buildActiveExecutionContext(history);
          addProgress(
            streamContext,
            processSteps,
            "execution",
            "\u5F15\u7528\u5F53\u524D\u6267\u884C\u7ED3\u679C",
            `${history.status === "success" ? "\u6267\u884C\u6210\u529F" : "\u6267\u884C\u5931\u8D25"} \xB7 ${activeExecution.rowCount} \u884C \xB7 ${activeExecution.fields.length} \u4E2A\u5B57\u6BB5`
          );
        }
      }
      let provider;
      if (payload.modelProviderId) {
        provider = await resolveProvider(payload.modelProviderId);
      } else if (taskConfig?.defaultModelProviderId) {
        const configuredProvider = await modelProviderService.getModelProviderById(Number(taskConfig.defaultModelProviderId));
        provider = modelProviderService.applyModelSelection(configuredProvider, {
          modelName: taskConfig.defaultModelName,
          modelVersion: taskConfig.defaultModelVersion
        });
      } else {
        provider = await resolveProvider(null);
      }
      const tables = await adapter.getTables(datasource, databaseName);
      const tableList = Array.isArray(tables) ? tables : [];
      const selectedTables = resolveScopedTables(tableList, payload.selectedTables);
      const candidatePayload = activeExecution?.sqlText && !payload.selectedSql && !payload.editorSql ? { ...payload, editorSql: activeExecution.sqlText } : payload;
      const candidates = selectCandidateTables(tableList, candidatePayload, datasource.type);
      const schemaScope = selectedTables.length ? selectedTables : candidates.schemaTables;
      addProgress(
        streamContext,
        processSteps,
        "scope",
        "\u786E\u5B9A\u8868\u8303\u56F4",
        selectedTables.length ? `\u4F7F\u7528\u7528\u6237\u6307\u5B9A\u7684 ${selectedTables.length} \u5F20\u8868` : `\u81EA\u52A8\u5339\u914D ${schemaScope.length} \u5F20\u5019\u9009\u8868`
      );
      const tableSchemas = await loadTableSchemas(adapter, datasource, databaseName, schemaScope);
      addProgress(streamContext, processSteps, "metadata", "\u8BFB\u53D6\u8868\u7ED3\u6784", `\u5DF2\u8BFB\u53D6 ${tableSchemas.length} \u5F20\u8868\u7684\u5B57\u6BB5\u7ED3\u6784`);
      const sampledTables = selectedTables.length ? await loadTableSamples(adapter, datasource, databaseName, tableSchemas) : [];
      if (sampledTables.length) {
        addProgress(
          streamContext,
          processSteps,
          "sample",
          "\u8BFB\u53D6\u6837\u672C\u6570\u636E",
          `\u5DF2\u8BFB\u53D6 ${sampledTables.length} \u5F20\u8868\u3001${sampledTables.reduce((sum, item) => sum + Number(item.rowCount || 0), 0)} \u884C\u6837\u672C`
        );
      }
      return {
        datasource,
        databaseName,
        adapter,
        provider,
        taskConfig,
        context: {
          datasource,
          referencedTables: candidates.referencedTables,
          availableTableNames: candidates.availableTables.map((item) => item.name),
          tableSchemas,
          sampledTables,
          selectedTables: selectedTables.map((item) => item.name),
          activeExecution,
          validation: null
        }
      };
    }
    async function persistAssistantMessage(chatSession, user, payload, result, processSteps) {
      if (!chatSession) return null;
      const message = await repository.createCopilotMessage({
        sessionId: chatSession.id,
        role: "assistant",
        taskType: payload.taskType,
        messageText: result.explanation || result.summary || result.generatedSql || "SQL \u667A\u80FD\u8F85\u52A9\u5DF2\u5B8C\u6210",
        payload: { result, processSteps },
        context: {
          datasourceId: payload.datasourceId,
          databaseName: payload.databaseName || null,
          selectedTables: payload.selectedTables || [],
          activeExecutionHistoryId: payload.activeExecutionHistoryId || null
        }
      });
      await repository.touchCopilotSession(chatSession.id, Number(user?.id || user?.sub), {});
      return message;
    }
    async function runCopilotTask(payload, options = {}) {
      const prepared = await prepareConversation(payload, options.user, options);
      const actualPayload = prepared.payload;
      const processSteps = [];
      const session = await resolveCopilotSession(actualPayload, options, processSteps);
      const { datasource, provider, taskConfig, context } = session;
      addProgress(options, processSteps, "generate", "\u751F\u6210\u56DE\u7B54", "\u6B63\u5728\u7ED3\u5408\u5386\u53F2\u5BF9\u8BDD\u3001SQL \u548C\u5143\u6570\u636E\u751F\u6210\u7ED3\u679C");
      const completion = await modelProviderService.generateChatCompletion(
        provider,
        [
          { role: "system", content: buildSystemPrompt(actualPayload.taskType, datasource.type, taskConfig?.systemPrompt || "") },
          { role: "user", content: buildUserPrompt(actualPayload, context) }
        ],
        {
          temperature: taskConfig?.temperature ?? 0.1,
          maxTokens: taskConfig?.maxTokens ?? 1800,
          timeoutMs: taskConfig?.timeoutMs ?? 3e4,
          responseFormat: { type: "json_object" }
        }
      );
      const rawText = completion?.content || "";
      const parsed = parseJsonObject(rawText);
      const generatedSql = resolveGeneratedSql(actualPayload.taskType, parsed?.generatedSql, rawText);
      if (generatedSql || requiresGeneratedSql(actualPayload.taskType)) {
        context.validation = await validateGeneratedSql(generatedSql, session);
        addProgress(options, processSteps, "validate", "\u6821\u9A8C SQL", context.validation.messages.join("\uFF1B"));
      }
      const result = normalizeResult(actualPayload.taskType, rawText, parsed, context, provider);
      const assistantMessage = await persistAssistantMessage(prepared.session, options.user, actualPayload, result, processSteps);
      return { ...result, sessionId: prepared.session?.id || null, assistantMessage };
    }
    async function runCopilotTaskStream(payload, streamContext = {}) {
      const prepared = await prepareConversation(payload, streamContext.user, streamContext);
      const actualPayload = prepared.payload;
      const processSteps = [];
      const session = await resolveCopilotSession(actualPayload, streamContext, processSteps);
      const { datasource, provider, taskConfig, context } = session;
      streamContext.write?.({
        type: "meta",
        data: {
          taskType: actualPayload.taskType,
          provider: {
            id: provider.id,
            configName: provider.configName,
            modelName: provider.modelName,
            modelVersion: provider.modelVersion || null,
            providerType: provider.providerType
          },
          dialect: datasource.type,
          referencedTables: context.referencedTables,
          metadataTables: context.tableSchemas.map((item) => ({
            tableName: item.tableName,
            tableType: item.tableType,
            columnCount: item.columns.length
          })),
          sampledTables: summarizeSampledTables(context),
          activeExecution: context.activeExecution
        }
      });
      let rawText = "";
      addProgress(streamContext, processSteps, "generate", "\u751F\u6210\u56DE\u7B54", "\u6B63\u5728\u7ED3\u5408\u5386\u53F2\u5BF9\u8BDD\u3001SQL\u3001\u6267\u884C\u7ED3\u679C\u548C\u5143\u6570\u636E\u751F\u6210\u7ED3\u679C");
      await modelProviderService.generateChatCompletionStream(
        provider,
        [
          { role: "system", content: buildStreamSystemPrompt(actualPayload.taskType, datasource.type, taskConfig?.systemPrompt || "") },
          { role: "user", content: buildUserPrompt(actualPayload, context) }
        ],
        {
          temperature: taskConfig?.temperature ?? 0.1,
          maxTokens: taskConfig?.maxTokens ?? 1800,
          timeoutMs: taskConfig?.timeoutMs ?? 3e4,
          signal: streamContext.signal
        },
        async (delta) => {
          rawText += delta;
          streamContext.write?.({ type: "delta", delta });
        }
      );
      const sections = parseSectionedContent(rawText);
      const generatedSql = resolveGeneratedSql(actualPayload.taskType, sections.SQL, rawText);
      if (generatedSql || requiresGeneratedSql(actualPayload.taskType)) {
        context.validation = await validateGeneratedSql(generatedSql, session);
        addProgress(streamContext, processSteps, "validate", "\u6821\u9A8C SQL", context.validation.messages.join("\uFF1B"));
      }
      const result = normalizeResultFromSections(actualPayload.taskType, rawText, context, provider);
      const assistantMessage = await persistAssistantMessage(prepared.session, streamContext.user, actualPayload, result, processSteps);
      streamContext.write?.({
        type: "done",
        data: {
          sessionId: prepared.session?.id || null,
          assistantMessage,
          result
        }
      });
      return result;
    }
    async function listCopilotSessions(user, filters = {}) {
      const userId = Number(user?.id || user?.sub || 0);
      if (!userId) return [];
      return repository.listCopilotSessions(userId, filters.limit);
    }
    async function listCopilotSessionMessages(user, sessionId) {
      const userId = Number(user?.id || user?.sub || 0);
      const session = await repository.getCopilotSessionById(sessionId, userId);
      if (!session) {
        throw new AppError("SQL \u667A\u80FD\u8F85\u52A9\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE", 404);
      }
      const messages = await repository.listCopilotMessages(sessionId, userId, 200);
      return { session, messages };
    }
    module2.exports = {
      listCopilotSessionMessages,
      listCopilotSessions,
      runCopilotTask,
      runCopilotTaskStream
    };
  }
});

// backend/src/modules/data-development/data-development.orchestration-compiler.js
var require_data_development_orchestration_compiler = __commonJS({
  "backend/src/modules/data-development/data-development.orchestration-compiler.js"(exports2, module2) {
    var AppError = require_app_error();
    var scheduler = require_data_development_scheduler();
    var sqlParser = require_data_development_sql_parser();
    var { normalizeDatasourceType, quoteIdentifier } = require_data_development_utils();
    function trimText(value) {
      return String(value ?? "").trim();
    }
    function stripTrailingSemicolon(sqlText) {
      return trimText(sqlText).replace(/;+\s*$/, "");
    }
    function prependInlineAliases(sqlText, inlineAliases) {
      if (!inlineAliases.length) {
        return sqlText;
      }
      const recursiveWithMatch = String(sqlText).match(/^with\s+recursive\b/i);
      if (recursiveWithMatch) {
        return `WITH RECURSIVE
${inlineAliases.join(",\n")},
${String(sqlText).replace(/^with\s+recursive\b/i, "").trimStart()}`;
      }
      if (/^with\b/i.test(String(sqlText))) {
        return `WITH
${inlineAliases.join(",\n")},
${String(sqlText).replace(/^with\b/i, "").trimStart()}`;
      }
      return `WITH
${inlineAliases.join(",\n")}
${sqlText}`;
    }
    function normalizeSqlName(value, fallback = "node") {
      const normalized = String(value || fallback).replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
      return normalized || fallback;
    }
    function indentSql(sqlText, spaces = 2) {
      const padding = " ".repeat(spaces);
      return String(sqlText || "").split("\n").map((line) => line ? `${padding}${line}` : line).join("\n");
    }
    function escapeSqlLiteral(value) {
      if (value === null || value === void 0) {
        return "NULL";
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
      if (typeof value === "boolean") {
        return value ? "TRUE" : "FALSE";
      }
      return `'${String(value).replace(/'/g, "''")}'`;
    }
    function parseStringArray(value) {
      if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
      }
      if (typeof value === "string") {
        return value.split(",").map((item) => item.trim()).filter(Boolean);
      }
      return [];
    }
    function parseObjectArray(value) {
      if (Array.isArray(value)) {
        return value.filter((item) => item && typeof item === "object");
      }
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
        } catch (error) {
          return [];
        }
      }
      return [];
    }
    function uniqueValues(items) {
      return Array.from(new Set(items.filter(Boolean)));
    }
    var VALIDATION_PATTERN_MAP = {
      id_card: "^(\\d{15}|\\d{17}[0-9Xx])$",
      phone: "^1[3-9][0-9]{9}$",
      email: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$",
      credit_code: "^[0-9A-Z]{18}$",
      url: "^(https?:\\/\\/).+",
      ipv4: "^(25[0-5]|2[0-4]\\d|1?\\d?\\d)(\\.(25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}$",
      postal_code: "^\\d{6}$"
    };
    function getValidationPattern(checkType) {
      return VALIDATION_PATTERN_MAP[trimText(checkType)] || null;
    }
    var AI_OPERATOR_CODES = /* @__PURE__ */ new Set(["llm", "llm_row", "llm_batch"]);
    function normalizeAiOperatorCode(value) {
      const operatorCode = trimText(value);
      return operatorCode === "llm" ? "llm_row" : operatorCode;
    }
    function getAiFallbackFieldName(operatorCode) {
      return normalizeAiOperatorCode(operatorCode) === "llm_batch" ? "batch_result" : "llm_reply";
    }
    function normalizeAiOutputFields(nodeConfig, fallbackFieldName = "llm_reply") {
      const parsedFields = parseObjectArray(nodeConfig?.outputFields).map((item) => ({
        fieldName: trimText(item.fieldName || item.name || item.outputFieldName),
        description: trimText(item.description || item.fieldDesc || item.label)
      })).filter((item) => item.fieldName);
      if (parsedFields.length) {
        return parsedFields;
      }
      const legacyFieldName = trimText(nodeConfig?.outputFieldName) || fallbackFieldName;
      return legacyFieldName ? [{ fieldName: legacyFieldName, description: "" }] : [];
    }
    function sanitizePreviewLimit(value, fallback = 20) {
      const next = Number(value);
      if (!Number.isFinite(next) || next <= 0) {
        return fallback;
      }
      return Math.max(1, Math.min(Math.floor(next), 200));
    }
    function buildEdgeMaps(edges) {
      const incoming = /* @__PURE__ */ new Map();
      const outgoing = /* @__PURE__ */ new Map();
      for (const edge of edges) {
        if (!incoming.has(edge.targetNodeKey)) {
          incoming.set(edge.targetNodeKey, []);
        }
        incoming.get(edge.targetNodeKey).push(edge);
        if (!outgoing.has(edge.sourceNodeKey)) {
          outgoing.set(edge.sourceNodeKey, []);
        }
        outgoing.get(edge.sourceNodeKey).push(edge);
      }
      return { incoming, outgoing };
    }
    function normalizeOrchestrationEdgeStatus(value) {
      return trimText(value).toLowerCase() === "paused" ? "paused" : "active";
    }
    function filterActiveEdges(edges) {
      return (Array.isArray(edges) ? edges : []).filter((edge) => normalizeOrchestrationEdgeStatus(edge?.edgeStatus) === "active");
    }
    function buildCteReference(cteName, dialect) {
      return quoteIdentifier(cteName, dialect);
    }
    function buildAliasReference(alias, columnName, dialect) {
      return quoteIdentifier(`${alias}.${columnName}`, dialect);
    }
    function buildWithClause(plans, dialect) {
      return `WITH
${plans.map((item) => `${quoteIdentifier(item.cteName, dialect)} AS (
${indentSql(item.sql, 2)}
)`).join(",\n")}`;
    }
    function buildNodeSelectSql(cteName, dialect, previewLimit) {
      const normalizedLimit = sanitizePreviewLimit(previewLimit, 20);
      const baseSql = `SELECT *
FROM ${buildCteReference(cteName, dialect)}`;
      const normalizedDialect2 = normalizeDatasourceType(dialect);
      if (normalizedDialect2 === "oracle") return `SELECT * FROM (
${indentSql(baseSql, 2)}
) WHERE ROWNUM <= ${normalizedLimit}`;
      if (normalizedDialect2 === "dm") return `${baseSql}
FETCH FIRST ${normalizedLimit} ROWS ONLY`;
      return `${baseSql}
LIMIT ${normalizedLimit}`;
    }
    function buildPlanSelectSql(plan, dialect) {
      return trimText(plan?.inputSql) || `SELECT *
FROM ${buildCteReference(plan.cteName, dialect)}`;
    }
    function buildPlanFromClause(plan, dialect, alias) {
      const aliasSql = alias ? ` AS ${quoteIdentifier(alias, dialect)}` : "";
      if (trimText(plan?.inputSql)) {
        return `(
${indentSql(plan.inputSql, 2)}
)${aliasSql}`;
      }
      return `${buildCteReference(plan.cteName, dialect)}${aliasSql}`;
    }
    function buildHashExpression(fieldExpression, algorithm, dialect) {
      const normalizedDialect2 = normalizeDatasourceType(dialect);
      const safeAlgorithm = trimText(algorithm || "md5").toLowerCase();
      if (normalizedDialect2 === "oracle") {
        const oracleAlgorithm = safeAlgorithm === "sha1" ? "SHA1" : safeAlgorithm === "sha256" ? "SHA256" : "MD5";
        return `STANDARD_HASH(${fieldExpression}, '${oracleAlgorithm}')`;
      }
      if (safeAlgorithm === "sha1") {
        return `SHA1(${fieldExpression})`;
      }
      if (safeAlgorithm === "sha256") {
        return `SHA2(${fieldExpression}, 256)`;
      }
      return `MD5(${fieldExpression})`;
    }
    function resolveBranchCondition(nodeConfig, sourceAlias, dialect) {
      return resolveRuleGroupCondition(
        nodeConfig,
        "branchRules",
        "branchLogic",
        ["branchCondition", "filterCondition", "configText"],
        sourceAlias,
        dialect
      );
    }
    function decorateIncomingPlans(incomingEdges, compiledPlanMap, nodeMap, dialect) {
      return incomingEdges.map((edge) => {
        const plan = compiledPlanMap.get(edge.sourceNodeKey);
        if (!plan) {
          return null;
        }
        const sourceNode = nodeMap.get(edge.sourceNodeKey);
        if (sourceNode?.nodeType === "operator" && trimText(sourceNode.operatorCode) === "branch") {
          const branchCondition = resolveBranchCondition(sourceNode.nodeConfig || {}, "source_data", dialect);
          if (!branchCondition) {
            throw new AppError(`Branch node ${sourceNode.nodeName} must configure a branch condition`, 400);
          }
          const branchRoute = trimText(edge.sourcePort) === "branch_false" ? "branch_false" : "branch_true";
          return {
            ...plan,
            inputSql: `SELECT *
FROM ${buildPlanFromClause(plan, dialect, "source_data")}
WHERE ${branchRoute === "branch_false" ? `NOT (${branchCondition})` : branchCondition}`,
            branchRoute
          };
        }
        return plan;
      }).filter(Boolean);
    }
    function buildNamedSelectList(alias, targetColumns, sourceColumns, dialect) {
      const sourceSet = new Set(sourceColumns);
      return targetColumns.map((columnName) => sourceSet.has(columnName) ? `${buildAliasReference(alias, columnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}` : `NULL AS ${quoteIdentifier(columnName, dialect)}`).join(",\n");
    }
    function buildProjectionSelectList(alias, selectedColumns, dialect) {
      return selectedColumns.map((columnName) => `${buildAliasReference(alias, columnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}`).join(",\n");
    }
    function buildPositionalSelectList(alias, targetColumns, sourceColumns, dialect) {
      return targetColumns.map((columnName, index) => {
        const sourceColumnName = sourceColumns[index];
        return sourceColumnName ? `${buildAliasReference(alias, sourceColumnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}` : `NULL AS ${quoteIdentifier(columnName, dialect)}`;
      }).join(",\n");
    }
    function buildRenameSelectList(columns, renameMappings, dialect) {
      const sourceAlias = "source_data";
      const renameMap = new Map(renameMappings.map((item) => [item.sourceField, item.targetField]));
      const outputColumns = columns.map((columnName) => renameMap.get(columnName) || columnName);
      return {
        outputColumns,
        selectSql: columns.map((columnName) => `${buildAliasReference(sourceAlias, columnName, dialect)} AS ${quoteIdentifier(renameMap.get(columnName) || columnName, dialect)}`).join(",\n")
      };
    }
    function buildOutputStatements(compiledPlans, incoming, outputPlans, dialect) {
      return outputPlans.filter((item) => item.relationName).map((item) => {
        const lineageNodeKeys = collectLineageNodeKeys(item.nodeKey, incoming);
        const withClause = buildWithClause(
          compiledPlans.filter((plan) => lineageNodeKeys.has(plan.nodeKey)),
          dialect
        );
        const outputColumns = (item.columns || []).filter(Boolean);
        const columnSql = outputColumns.length ? ` (${outputColumns.map((columnName) => quoteIdentifier(columnName, dialect)).join(", ")})` : "";
        return {
          nodeKey: item.nodeKey,
          nodeName: item.nodeName,
          targetTable: item.relationName,
          sql: `${withClause}
INSERT INTO ${quoteIdentifier(item.relationName, dialect)}${columnSql}
SELECT *
FROM ${buildCteReference(item.cteName, dialect)};`
        };
      });
    }
    function mergeColumns(columnGroups) {
      const merged = [];
      const seen = /* @__PURE__ */ new Set();
      for (const columns of columnGroups) {
        for (const columnName of columns || []) {
          if (!seen.has(columnName)) {
            seen.add(columnName);
            merged.push(columnName);
          }
        }
      }
      return merged;
    }
    function validateKnownColumns(columns, requiredColumns, nodeName, label) {
      if (!columns.length) {
        throw new AppError(`${label}\u8282\u70B9 ${nodeName} \u9700\u8981\u4E0A\u6E38\u5B57\u6BB5\u7ED3\u6784\u624D\u80FD\u751F\u6210 SQL`, 400);
      }
      const missingColumns = requiredColumns.filter((item) => !columns.includes(item));
      if (missingColumns.length) {
        throw new AppError(`${label}\u8282\u70B9 ${nodeName} \u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u5B57\u6BB5: ${missingColumns.join(", ")}`, 400);
      }
    }
    function validateUniqueColumns(columns, nodeName, label) {
      const duplicated = columns.filter((item, index) => columns.indexOf(item) !== index);
      if (duplicated.length) {
        throw new AppError(`${label}\u8282\u70B9 ${nodeName} \u5B58\u5728\u91CD\u590D\u5B57\u6BB5: ${uniqueValues(duplicated).join(", ")}`, 400);
      }
    }
    function normalizeRenameMappings(value) {
      return parseObjectArray(value).map((item) => ({
        sourceField: trimText(item.sourceField),
        targetField: trimText(item.targetField)
      })).filter((item) => item.sourceField && item.targetField);
    }
    function normalizeSortRules(value) {
      return parseObjectArray(value).map((item) => ({
        fieldName: trimText(item.fieldName),
        direction: trimText(item.direction).toUpperCase() === "DESC" ? "DESC" : "ASC"
      })).filter((item) => item.fieldName);
    }
    function normalizeSourceTimeFilter(value) {
      if (!value || typeof value !== "object") {
        return {
          fieldName: "",
          formatType: "date",
          startValue: "",
          endValue: ""
        };
      }
      return {
        fieldName: trimText(value.fieldName),
        formatType: trimText(value.formatType) || "date",
        startValue: value.startValue === void 0 || value.startValue === null ? "" : String(value.startValue),
        endValue: value.endValue === void 0 || value.endValue === null ? "" : String(value.endValue)
      };
    }
    function normalizeColumnAlignmentRows(value) {
      return parseObjectArray(value).map((row) => ({
        outputField: trimText(row.outputField),
        bindings: parseObjectArray(row.bindings).map((binding) => ({
          sourceNodeKey: trimText(binding.sourceNodeKey),
          fieldName: trimText(binding.fieldName)
        })).filter((binding) => binding.sourceNodeKey || binding.fieldName)
      })).filter((row) => row.outputField || row.bindings.length);
    }
    function normalizeReplaceRules(value, legacyMatchValue, legacyReplaceValue) {
      const parsed = parseObjectArray(value).map((item) => ({
        matchValue: item.matchValue === void 0 || item.matchValue === null ? "" : String(item.matchValue),
        replaceValue: item.replaceValue === void 0 || item.replaceValue === null ? "" : String(item.replaceValue)
      })).filter((item) => item.matchValue !== "" || item.replaceValue !== "");
      if (parsed.length) {
        return parsed;
      }
      const matchValue = legacyMatchValue === void 0 || legacyMatchValue === null ? "" : String(legacyMatchValue);
      const replaceValue = legacyReplaceValue === void 0 || legacyReplaceValue === null ? "" : String(legacyReplaceValue);
      return matchValue !== "" || replaceValue !== "" ? [{ matchValue, replaceValue }] : [];
    }
    function normalizeJoinKeyRules(value) {
      return parseObjectArray(value).map((item) => ({
        leftField: trimText(item.leftField),
        rightField: trimText(item.rightField)
      })).filter((item) => item.leftField && item.rightField);
    }
    function normalizeConditionRules(value) {
      return parseObjectArray(value).map((item) => {
        const referenceFieldRef = trimText(item.referenceFieldRef);
        const separatorIndex = referenceFieldRef.indexOf("::");
        const referenceNodeKey = trimText(item.referenceNodeKey) || (separatorIndex > 0 ? referenceFieldRef.slice(0, separatorIndex) : "");
        const referenceField = trimText(item.referenceField) || (separatorIndex > 0 ? referenceFieldRef.slice(separatorIndex + 2) : "");
        return {
          ruleType: trimText(item.ruleType) || (trimText(item.checkType) ? "builtin" : String(item.domainValues ?? "").trim() ? "domain" : "condition"),
          fieldName: trimText(item.fieldName),
          operator: trimText(item.operator) || "eq",
          value: item.value === void 0 || item.value === null ? "" : String(item.value),
          valueSource: trimText(item.valueSource) || (referenceField ? "upstream_field" : trimText(item.customSql) ? "custom_sql" : "literal"),
          referenceNodeKey,
          referenceField,
          customSql: item.customSql === void 0 || item.customSql === null ? "" : String(item.customSql),
          checkType: trimText(item.checkType) || "phone",
          matchMode: trimText(item.matchMode) || "valid",
          domainValues: item.domainValues === void 0 || item.domainValues === null ? "" : String(item.domainValues)
        };
      }).filter((item) => item.fieldName);
    }
    function normalizeFormatRules(value) {
      return parseObjectArray(value).map((item) => ({
        sourceField: trimText(item.sourceField),
        targetField: trimText(item.targetField),
        transformType: trimText(item.transformType) || "date_to_string",
        formatPattern: item.formatPattern === void 0 || item.formatPattern === null ? "" : String(item.formatPattern),
        targetType: trimText(item.targetType) || "decimal"
      })).filter((item) => item.sourceField && item.targetField);
    }
    function normalizeComplianceRules(value) {
      return parseObjectArray(value).map((item) => ({
        validationType: trimText(item.validationType) || (String(item.customPattern ?? "").trim() ? "regex" : String(item.fixedValue ?? "").trim() ? "fixed_value" : String(item.domainValues ?? "").trim() ? "domain" : "builtin"),
        sourceField: trimText(item.sourceField),
        targetField: trimText(item.targetField),
        checkType: trimText(item.checkType) || "phone",
        customPattern: item.customPattern === void 0 || item.customPattern === null ? "" : String(item.customPattern),
        fixedValue: item.fixedValue === void 0 || item.fixedValue === null ? "" : String(item.fixedValue),
        domainValues: item.domainValues === void 0 || item.domainValues === null ? "" : String(item.domainValues),
        resultMode: trimText(item.resultMode) || "flag",
        defaultValue: item.defaultValue === void 0 || item.defaultValue === null ? "" : String(item.defaultValue)
      })).filter((item) => item.sourceField && item.targetField);
    }
    function normalizeStringRules(value) {
      return parseObjectArray(value).map((item) => ({
        sourceField: trimText(item.sourceField),
        targetField: trimText(item.targetField),
        transformType: trimText(item.transformType) || "trim",
        argument1: item.argument1 === void 0 || item.argument1 === null ? "" : String(item.argument1),
        argument2: item.argument2 === void 0 || item.argument2 === null ? "" : String(item.argument2)
      })).filter((item) => item.sourceField && item.targetField);
    }
    function normalizeDesensitizeRules(value) {
      return parseObjectArray(value).map((item) => ({
        sourceField: trimText(item.sourceField),
        targetField: trimText(item.targetField),
        maskType: trimText(item.maskType) || trimText(item.transform) || "mask",
        transform: trimText(item.transform) || trimText(item.maskType) || "mask",
        maskChar: trimText(item.maskChar) || "*",
        prefixLength: Math.max(0, Number(item.prefixLength || 0)),
        suffixLength: Math.max(0, Number(item.suffixLength || 0)),
        truncateLength: Math.max(0, Number(item.truncateLength || 0)),
        replacePattern: trimText(item.replacePattern) || trimText(item.pattern) || "",
        replaceValue: item.replaceValue === void 0 || item.replaceValue === null ? "" : String(item.replaceValue),
        encryptAlgorithm: trimText(item.encryptAlgorithm) || trimText(item.hashAlgorithm) || "md5",
        salt: trimText(item.salt) || "",
        generalizeLength: Math.max(0, Number(item.generalizeLength || item.truncateLength || 0))
      })).filter((item) => item.sourceField && item.targetField);
    }
    function normalizeOutputFieldMappings(value) {
      return parseObjectArray(value).map((item) => ({
        sourceField: trimText(item.sourceField),
        targetField: trimText(item.targetField)
      })).filter((item) => item.sourceField && item.targetField);
    }
    function parseBooleanFlag(value, fallback = false) {
      if (typeof value === "boolean") {
        return value;
      }
      const normalized = trimText(value).toLowerCase();
      if (["true", "1", "yes", "y", "on"].includes(normalized)) {
        return true;
      }
      if (["false", "0", "no", "n", "off"].includes(normalized)) {
        return false;
      }
      return fallback;
    }
    function normalizeStringAggregateRules(value) {
      return parseObjectArray(value).map((item) => ({
        sourceField: trimText(item.sourceField),
        outputField: trimText(item.outputField),
        separator: item.separator === void 0 || item.separator === null ? "," : String(item.separator),
        distinct: parseBooleanFlag(item.distinct, false)
      })).filter((item) => item.sourceField && item.outputField);
    }
    function normalizeStringSplitConfig(value) {
      if (!value || typeof value !== "object") {
        return {
          sourceField: "",
          outputField: "",
          separator: ",",
          trimItems: true,
          keepEmptyItems: false,
          indexField: ""
        };
      }
      return {
        sourceField: trimText(value.sourceField),
        outputField: trimText(value.outputField),
        separator: value.separator === void 0 || value.separator === null ? "," : String(value.separator),
        trimItems: parseBooleanFlag(value.trimItems, true),
        keepEmptyItems: parseBooleanFlag(value.keepEmptyItems, false),
        indexField: trimText(value.indexField)
      };
    }
    function buildSourceTimeLiteral(value, formatType) {
      const normalizedValue = value === void 0 || value === null ? "" : String(value);
      if (!normalizedValue) {
        return "";
      }
      if (["epoch_seconds", "epoch_millis"].includes(trimText(formatType))) {
        const numericValue = Number(normalizedValue);
        return Number.isFinite(numericValue) ? String(Math.trunc(numericValue)) : escapeSqlLiteral(normalizedValue);
      }
      return escapeSqlLiteral(normalizedValue);
    }
    function buildSourceTimeFilterClauses(sourceAlias, filter, dialect) {
      const normalizedFilter = normalizeSourceTimeFilter(filter);
      if (!normalizedFilter.fieldName) {
        return [];
      }
      const fieldExpression = buildAliasReference(sourceAlias, normalizedFilter.fieldName, dialect);
      const clauses = [];
      if (normalizedFilter.startValue) {
        clauses.push(`${fieldExpression} >= ${buildSourceTimeLiteral(normalizedFilter.startValue, normalizedFilter.formatType)}`);
      }
      if (normalizedFilter.endValue) {
        clauses.push(`${fieldExpression} <= ${buildSourceTimeLiteral(normalizedFilter.endValue, normalizedFilter.formatType)}`);
      }
      return clauses;
    }
    function buildSequentialReplaceExpression(fieldExpression, replaceRules) {
      return replaceRules.reduce((currentExpression, rule) => {
        const matchValue = rule.matchValue === void 0 || rule.matchValue === null ? "" : String(rule.matchValue);
        const replaceValue = rule.replaceValue === void 0 || rule.replaceValue === null ? "" : String(rule.replaceValue);
        const condition = trimText(matchValue) ? `${currentExpression} = ${escapeSqlLiteral(matchValue)}` : `${currentExpression} IS NULL OR ${currentExpression} = ''`;
        return `CASE WHEN ${condition} THEN ${escapeSqlLiteral(replaceValue)} ELSE ${currentExpression} END`;
      }, fieldExpression);
    }
    function buildReplaceSelectList(columns, fieldName, replaceRules, dialect) {
      const sourceAlias = "source_data";
      const fieldExpression = buildAliasReference(sourceAlias, fieldName, dialect);
      const replacedExpression = buildSequentialReplaceExpression(fieldExpression, replaceRules);
      return columns.map((columnName) => {
        if (columnName !== fieldName) {
          return `${buildAliasReference(sourceAlias, columnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}`;
        }
        return `${replacedExpression} AS ${quoteIdentifier(columnName, dialect)}`;
      }).join(",\n");
    }
    function buildDerivedSelectPlan(inputColumns, rules, dialect, buildExpression) {
      const sourceAlias = "source_data";
      const derivedEntries = [];
      const targetColumns = [];
      rules.forEach((rule, index) => {
        const targetField = trimText(rule.targetField || rule.outputField || `field_${index + 1}`);
        if (!targetField) {
          return;
        }
        derivedEntries.push({
          targetField,
          expression: buildExpression(rule, sourceAlias)
        });
        targetColumns.push(targetField);
      });
      validateUniqueColumns(targetColumns, "transform", "\u5B57\u6BB5\u52A0\u5DE5");
      const entryMap = new Map(derivedEntries.map((item) => [item.targetField, item.expression]));
      const outputColumns = [];
      const selectSegments = [];
      inputColumns.forEach((columnName) => {
        const derivedExpression = entryMap.get(columnName);
        outputColumns.push(columnName);
        if (derivedExpression) {
          selectSegments.push(`${derivedExpression} AS ${quoteIdentifier(columnName, dialect)}`);
        } else {
          selectSegments.push(`${buildAliasReference(sourceAlias, columnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}`);
        }
      });
      derivedEntries.forEach((item) => {
        if (outputColumns.includes(item.targetField)) {
          return;
        }
        outputColumns.push(item.targetField);
        selectSegments.push(`${item.expression} AS ${quoteIdentifier(item.targetField, dialect)}`);
      });
      return {
        outputColumns,
        selectSql: selectSegments.join(",\n")
      };
    }
    function toMysqlDatePattern(pattern) {
      const source = trimText(pattern) || "yyyy-MM-dd HH:mm:ss";
      return source.replace(/YYYY/g, "%Y").replace(/yyyy/g, "%Y").replace(/MM/g, "%m").replace(/DD/g, "%d").replace(/dd/g, "%d").replace(/HH24/g, "%H").replace(/HH/g, "%H").replace(/hh/g, "%H").replace(/MI/g, "%i").replace(/mm/g, "%i").replace(/SS/g, "%s").replace(/ss/g, "%s");
    }
    function toPostgresDatePattern(pattern) {
      const source = trimText(pattern) || "YYYY-MM-DD HH24:MI:SS";
      return source.replace(/yyyy/g, "YYYY").replace(/dd/g, "DD").replace(/hh/g, "HH24").replace(/mm/g, "MI").replace(/ss/g, "SS");
    }
    function buildCastExpression(fieldExpression, targetType, dialect) {
      const normalizedDialect2 = normalizeDatasourceType(dialect);
      const normalizedType = trimText(targetType).toLowerCase();
      if (normalizedType === "integer") {
        const type = normalizedDialect2 === "oracle" ? "NUMBER(38)" : ["postgresql", "dm"].includes(normalizedDialect2) ? "INTEGER" : "SIGNED";
        return `CAST(${fieldExpression} AS ${type})`;
      }
      if (normalizedType === "double") {
        const type = normalizedDialect2 === "oracle" ? "BINARY_DOUBLE" : normalizedDialect2 === "postgresql" ? "DOUBLE PRECISION" : "DOUBLE";
        return `CAST(${fieldExpression} AS ${type})`;
      }
      return `CAST(${fieldExpression} AS ${normalizedDialect2 === "oracle" ? "NUMBER(18,6)" : normalizedDialect2 === "postgresql" ? "NUMERIC(18,6)" : "DECIMAL(18,6)"})`;
    }
    function buildStringCastExpression(fieldExpression, dialect) {
      const normalizedDialect2 = normalizeDatasourceType(dialect);
      const targetType = normalizedDialect2 === "postgresql" ? "TEXT" : normalizedDialect2 === "oracle" ? "VARCHAR2(4000)" : normalizedDialect2 === "dm" ? "VARCHAR(4000)" : "CHAR";
      return `CAST(${fieldExpression} AS ${targetType})`;
    }
    function buildDateFormatExpression(fieldExpression, formatPattern, dialect) {
      const normalizedDialect2 = normalizeDatasourceType(dialect);
      if (["postgresql", "oracle", "dm"].includes(normalizedDialect2)) {
        return `TO_CHAR(${fieldExpression}, ${escapeSqlLiteral(toPostgresDatePattern(formatPattern))})`;
      }
      if (normalizedDialect2 === "clickhouse") {
        return `formatDateTime(${fieldExpression}, ${escapeSqlLiteral(toMysqlDatePattern(formatPattern))})`;
      }
      return `DATE_FORMAT(${fieldExpression}, ${escapeSqlLiteral(toMysqlDatePattern(formatPattern))})`;
    }
    function buildStringToDateExpression(fieldExpression, formatPattern, dialect, withTime) {
      const normalizedDialect2 = normalizeDatasourceType(dialect);
      if (["postgresql", "oracle", "dm"].includes(normalizedDialect2)) {
        const parsed2 = withTime ? `TO_TIMESTAMP(${fieldExpression}, ${escapeSqlLiteral(toPostgresDatePattern(formatPattern))})` : `TO_DATE(${fieldExpression}, ${escapeSqlLiteral(toPostgresDatePattern(formatPattern || "YYYY-MM-DD"))})`;
        return withTime ? parsed2 : `CAST(${parsed2} AS DATE)`;
      }
      const parsePattern = escapeSqlLiteral(toMysqlDatePattern(formatPattern));
      if (normalizedDialect2 === "clickhouse") {
        return withTime ? `parseDateTimeBestEffort(${fieldExpression})` : `toDate(parseDateTimeBestEffort(${fieldExpression}))`;
      }
      const parsed = `STR_TO_DATE(${fieldExpression}, ${parsePattern})`;
      return withTime ? parsed : `CAST(${parsed} AS DATE)`;
    }
    function buildRegexMatchExpression(fieldExpression, pattern, dialect) {
      const normalizedDialect2 = normalizeDatasourceType(dialect);
      if (["postgresql", "oracle", "dm"].includes(normalizedDialect2)) {
        return normalizedDialect2 === "postgresql" ? `${fieldExpression} ~ ${escapeSqlLiteral(pattern)}` : `REGEXP_LIKE(${fieldExpression}, ${escapeSqlLiteral(pattern)})`;
      }
      return `${fieldExpression} REGEXP ${escapeSqlLiteral(pattern)}`;
    }
    function isNumericLiteral(value) {
      return /^-?\d+(\.\d+)?$/.test(trimText(value));
    }
    function normalizeFilterSubquerySql(value, dialect) {
      let sqlText = stripTrailingSemicolon(value);
      const wrappedMatch = sqlText.match(/^(?:not\s+)?in\s*\(([\s\S]*)\)$/i);
      if (wrappedMatch) {
        sqlText = stripTrailingSemicolon(wrappedMatch[1]);
      } else if (/^\([\s\S]*\)$/.test(sqlText)) {
        const innerSql = stripTrailingSemicolon(sqlText.slice(1, -1));
        if (/^(select|with)\b/i.test(innerSql)) {
          sqlText = innerSql;
        }
      }
      if (!sqlText || !/^(select|with)\b/i.test(sqlText)) {
        throw new AppError("IN / NOT IN \u81EA\u5B9A\u4E49 SQL \u5FC5\u987B\u662F\u8FD4\u56DE\u5355\u5217\u7ED3\u679C\u7684 SELECT \u67E5\u8BE2", 400);
      }
      const parsed = sqlParser.parseSql(sqlText, dialect);
      const statements = Array.isArray(parsed) ? parsed : [parsed];
      if (statements.length !== 1 || statements[0]?.type !== "select") {
        throw new AppError("IN / NOT IN \u81EA\u5B9A\u4E49 SQL \u4EC5\u652F\u6301\u5355\u6761 SELECT \u67E5\u8BE2", 400);
      }
      const outputColumns = Array.isArray(statements[0]?.columns) ? statements[0].columns : [];
      const selectsWildcard = outputColumns.some((item) => item?.expr?.type === "column_ref" && item.expr.column === "*");
      if (outputColumns.length !== 1 || selectsWildcard) {
        throw new AppError("IN / NOT IN \u81EA\u5B9A\u4E49 SQL \u5FC5\u987B\u660E\u786E\u8FD4\u56DE\u4E00\u4E2A\u5B57\u6BB5", 400);
      }
      return sqlText;
    }
    function buildConditionRuleSqlExpression(rule, sourceAlias, dialect, options = {}) {
      const fieldExpression = buildAliasReference(sourceAlias, rule.fieldName, dialect);
      const textExpression = `COALESCE(${buildStringCastExpression(fieldExpression, dialect)}, '')`;
      const ruleType = trimText(rule.ruleType) || "condition";
      if (ruleType === "builtin") {
        const pattern = getValidationPattern(rule.checkType) || VALIDATION_PATTERN_MAP.phone;
        const matchExpression = buildRegexMatchExpression(textExpression, pattern, dialect);
        return trimText(rule.matchMode) === "invalid" ? `NOT (${matchExpression})` : matchExpression;
      }
      if (ruleType === "domain") {
        const domainValues = parseStringArray(rule.domainValues);
        if (!domainValues.length) {
          return "";
        }
        const inExpression = `${textExpression} IN (${domainValues.map((item) => escapeSqlLiteral(item)).join(", ")})`;
        return trimText(rule.matchMode) === "not_in" ? `NOT (${inExpression})` : inExpression;
      }
      const operator = trimText(rule.operator) || "eq";
      const valueText = trimText(rule.value);
      switch (operator) {
        case "ne":
          return `${textExpression} <> ${escapeSqlLiteral(valueText)}`;
        case "gt":
          return isNumericLiteral(valueText) ? `${fieldExpression} > ${Number(valueText)}` : `${textExpression} > ${escapeSqlLiteral(valueText)}`;
        case "gte":
          return isNumericLiteral(valueText) ? `${fieldExpression} >= ${Number(valueText)}` : `${textExpression} >= ${escapeSqlLiteral(valueText)}`;
        case "lt":
          return isNumericLiteral(valueText) ? `${fieldExpression} < ${Number(valueText)}` : `${textExpression} < ${escapeSqlLiteral(valueText)}`;
        case "lte":
          return isNumericLiteral(valueText) ? `${fieldExpression} <= ${Number(valueText)}` : `${textExpression} <= ${escapeSqlLiteral(valueText)}`;
        case "contains":
          return `${textExpression} LIKE ${escapeSqlLiteral(`%${valueText}%`)}`;
        case "starts_with":
          return `${textExpression} LIKE ${escapeSqlLiteral(`${valueText}%`)}`;
        case "ends_with":
          return `${textExpression} LIKE ${escapeSqlLiteral(`%${valueText}`)}`;
        case "in":
        case "not_in": {
          const operatorSql = operator === "not_in" ? "NOT IN" : "IN";
          const valueSource = trimText(rule.valueSource) || "literal";
          if (valueSource === "upstream_field") {
            const referenceField = trimText(rule.referenceField);
            const referenceNodeKey = trimText(rule.referenceNodeKey);
            const referencePlan = referenceNodeKey ? options.inputPlanMap?.get(referenceNodeKey) : options.primaryInputPlan;
            if (!referenceField || !referencePlan) {
              return "";
            }
            const referenceExpression = buildAliasReference("reference_data", referenceField, dialect);
            const comparableFieldExpression = buildStringCastExpression(fieldExpression, dialect);
            const comparableReferenceExpression = buildStringCastExpression(referenceExpression, dialect);
            const referenceSql = `SELECT ${comparableReferenceExpression}
FROM ${buildPlanFromClause(referencePlan, dialect, "reference_data")}`;
            return `${comparableFieldExpression} ${operatorSql} (
${indentSql(referenceSql, 2)}
)`;
          }
          if (valueSource === "custom_sql") {
            const customSql = normalizeFilterSubquerySql(rule.customSql, dialect);
            return `${fieldExpression} ${operatorSql} (
${indentSql(customSql, 2)}
)`;
          }
          const values = parseStringArray(valueText);
          if (!values.length) {
            return "";
          }
          const inExpression = `${textExpression} IN (${values.map((item) => escapeSqlLiteral(item)).join(", ")})`;
          return operator === "not_in" ? `NOT (${inExpression})` : inExpression;
        }
        case "is_null":
          return `(${fieldExpression} IS NULL OR ${textExpression} = '')`;
        case "is_not_null":
          return `(${fieldExpression} IS NOT NULL AND ${textExpression} <> '')`;
        case "eq":
        default:
          return `${textExpression} = ${escapeSqlLiteral(valueText)}`;
      }
    }
    function buildRuleGroupConditionExpression(rules, logic, sourceAlias, dialect, options = {}) {
      const expressions = normalizeConditionRules(rules).map((rule) => buildConditionRuleSqlExpression(rule, sourceAlias, dialect, options)).filter(Boolean);
      if (!expressions.length) {
        return "";
      }
      const connector = trimText(logic) === "any" ? " OR " : " AND ";
      return expressions.length === 1 ? expressions[0] : `(${expressions.join(connector)})`;
    }
    function resolveRuleGroupCondition(nodeConfig, rulesKey, logicKey, fallbackKeys, sourceAlias, dialect, options = {}) {
      const derivedExpression = buildRuleGroupConditionExpression(nodeConfig?.[rulesKey], nodeConfig?.[logicKey], sourceAlias, dialect, options);
      if (derivedExpression) {
        return derivedExpression;
      }
      const keys = Array.isArray(fallbackKeys) ? fallbackKeys : [fallbackKeys];
      for (const key of keys) {
        const value = trimText(nodeConfig?.[key]);
        if (value) {
          return value;
        }
      }
      return "";
    }
    function buildFormatRuleExpression(rule, sourceAlias, dialect) {
      const fieldExpression = buildAliasReference(sourceAlias, rule.sourceField, dialect);
      switch (trimText(rule.transformType)) {
        case "datetime_to_string":
        case "date_to_string":
          return buildDateFormatExpression(fieldExpression, rule.formatPattern, dialect);
        case "string_to_number":
          return buildCastExpression(fieldExpression, rule.targetType, dialect);
        case "number_to_string":
          return buildStringCastExpression(fieldExpression, dialect);
        case "string_to_date":
          return buildStringToDateExpression(fieldExpression, rule.formatPattern, dialect, false);
        case "string_to_datetime":
          return buildStringToDateExpression(fieldExpression, rule.formatPattern, dialect, true);
        case "datetime_to_date":
          return `CAST(${fieldExpression} AS DATE)`;
        default:
          return fieldExpression;
      }
    }
    function buildValidationPredicateExpression(rule, sourceAlias, dialect) {
      const fieldExpression = buildAliasReference(sourceAlias, rule.sourceField, dialect);
      const textExpression = `COALESCE(${buildStringCastExpression(fieldExpression, dialect)}, '')`;
      const validationType = trimText(rule.validationType) || "builtin";
      if (validationType === "domain") {
        const values = parseStringArray(rule.domainValues);
        if (!values.length) {
          return "FALSE";
        }
        return `${textExpression} IN (${values.map((item) => escapeSqlLiteral(item)).join(", ")})`;
      }
      if (validationType === "regex") {
        const pattern2 = trimText(rule.customPattern);
        return pattern2 ? buildRegexMatchExpression(textExpression, pattern2, dialect) : "FALSE";
      }
      if (validationType === "fixed_value") {
        return `${textExpression} = ${escapeSqlLiteral(trimText(rule.fixedValue))}`;
      }
      const pattern = getValidationPattern(rule.checkType) || VALIDATION_PATTERN_MAP.phone;
      return buildRegexMatchExpression(textExpression, pattern, dialect);
    }
    function buildComplianceRuleExpression(rule, sourceAlias, dialect) {
      const fieldExpression = buildAliasReference(sourceAlias, rule.sourceField, dialect);
      const matchedExpression = buildValidationPredicateExpression(rule, sourceAlias, dialect);
      const defaultValue = trimText(rule.defaultValue);
      if (trimText(rule.resultMode) === "value") {
        return `CASE WHEN ${matchedExpression} THEN ${fieldExpression} ELSE ${defaultValue ? escapeSqlLiteral(defaultValue) : "''"} END`;
      }
      if (defaultValue) {
        return `CASE WHEN ${matchedExpression} THEN 1 ELSE ${escapeSqlLiteral(defaultValue)} END`;
      }
      return `CASE WHEN ${matchedExpression} THEN 1 ELSE 0 END`;
    }
    function buildStringRuleExpression(rule, sourceAlias, dialect) {
      const fieldExpression = buildStringCastExpression(buildAliasReference(sourceAlias, rule.sourceField, dialect), dialect);
      const argument1 = trimText(rule.argument1);
      const argument2 = trimText(rule.argument2);
      switch (trimText(rule.transformType)) {
        case "trim":
          return `TRIM(${fieldExpression})`;
        case "remove_prefix":
          return `SUBSTRING(${fieldExpression}, ${Math.max(1, Number(argument1 || 0) + 1)})`;
        case "remove_suffix":
          return `SUBSTRING(${fieldExpression}, 1, GREATEST(CHAR_LENGTH(${fieldExpression}) - ${Math.max(0, Number(argument1 || 0))}, 0))`;
        case "substring":
          return argument2 ? `SUBSTRING(${fieldExpression}, ${Math.max(1, Number(argument1 || 1))}, ${Math.max(0, Number(argument2 || 0))})` : `SUBSTRING(${fieldExpression}, ${Math.max(1, Number(argument1 || 1))})`;
        case "replace_text":
          return `REPLACE(${fieldExpression}, ${escapeSqlLiteral(argument1)}, ${escapeSqlLiteral(argument2)})`;
        case "upper":
          return `UPPER(${fieldExpression})`;
        case "lower":
          return `LOWER(${fieldExpression})`;
        default:
          return fieldExpression;
      }
    }
    function buildCharLengthExpression(fieldExpression, dialect) {
      return ["oracle", "dm"].includes(normalizeDatasourceType(dialect)) ? `LENGTH(${fieldExpression})` : `CHAR_LENGTH(${fieldExpression})`;
    }
    function buildSubstringExpression(fieldExpression, start, length, dialect) {
      if (["oracle", "dm"].includes(normalizeDatasourceType(dialect))) {
        return length === void 0 ? `SUBSTR(${fieldExpression}, ${start})` : `SUBSTR(${fieldExpression}, ${start}, ${length})`;
      }
      return length === void 0 ? `SUBSTRING(${fieldExpression}, ${start})` : `SUBSTRING(${fieldExpression}, ${start}, ${length})`;
    }
    function buildDesensitizeRuleExpression(rule, sourceAlias, dialect) {
      const normalizedDialect2 = normalizeDatasourceType(dialect);
      const sourceExpression = buildStringCastExpression(buildAliasReference(sourceAlias, rule.sourceField, dialect), dialect);
      const maskType = trimText(rule.transform || rule.maskType) || "mask";
      if (maskType === "encrypt" || maskType === "hash") {
        const algorithm = trimText(rule.encryptAlgorithm || rule.hashAlgorithm) || "md5";
        const salt = trimText(rule.salt);
        const source = salt ? `CONCAT(COALESCE(${sourceExpression}, ''), '${salt.replace(/'/g, "''")}')` : `COALESCE(${sourceExpression}, '')`;
        return buildHashExpression(source, algorithm, dialect);
      }
      if (maskType === "replace") {
        const pattern = trimText(rule.replacePattern || rule.pattern);
        const replacement = String(rule.replaceValue ?? rule.replacement ?? "");
        if (!pattern) {
          throw new AppError(`\u6B65\u9AA4\u3010${rule.stepName || rule.targetField}\u3011\u7F3A\u5C11\u66FF\u6362\u89C4\u5219`, 400);
        }
        return buildRegexReplaceExpression(sourceExpression, pattern, replacement, dialect);
      }
      if (maskType === "generalize" || maskType === "truncate") {
        const length = Math.max(0, Number(rule.generalizeLength || rule.truncateLength || 0));
        return normalizedDialect2 === "postgresql" ? `SUBSTRING(COALESCE(${sourceExpression}, '') FROM 1 FOR ${length})` : `SUBSTR(COALESCE(${sourceExpression}, ''), 1, ${length})`;
      }
      const prefixLength = Math.max(0, Number(rule.prefixLength || 0));
      const suffixLength = Math.max(0, Number(rule.suffixLength || 0));
      const maskChar = escapeSqlLiteral(trimText(rule.maskChar) || "*");
      const fieldLength = buildCharLengthExpression(`COALESCE(${sourceExpression}, '')`, dialect);
      const visiblePrefix = prefixLength > 0 ? buildSubstringExpression(`COALESCE(${sourceExpression}, '')`, 1, prefixLength, dialect) : "''";
      const visibleSuffix = suffixLength > 0 ? buildSubstringExpression(
        `COALESCE(${sourceExpression}, '')`,
        `GREATEST(${fieldLength} - ${suffixLength} + 1, 1)`,
        suffixLength,
        dialect
      ) : "''";
      const maskLength = `GREATEST(${fieldLength} - ${prefixLength} - ${suffixLength}, 0)`;
      const repeatExpression = normalizedDialect2 === "oracle" ? `RPAD('${maskChar.replace(/'/g, "''")}', ${maskLength}, '${maskChar.replace(/'/g, "''")}')` : `REPEAT(${maskChar}, ${maskLength})`;
      return `CASE
    WHEN ${fieldLength} <= ${prefixLength + suffixLength} THEN COALESCE(${sourceExpression}, '')
    ELSE ${buildStringConcatExpression([visiblePrefix, repeatExpression, visibleSuffix], dialect)}
  END`;
    }
    function buildAggregateCaseExpression(aggregateFunction, conditionSql, valueExpression) {
      switch (trimText(aggregateFunction).toLowerCase()) {
        case "count":
          return `SUM(CASE WHEN ${conditionSql} THEN 1 ELSE 0 END)`;
        case "sum":
          return `SUM(CASE WHEN ${conditionSql} THEN ${valueExpression} ELSE NULL END)`;
        case "avg":
          return `AVG(CASE WHEN ${conditionSql} THEN ${valueExpression} ELSE NULL END)`;
        case "min":
          return `MIN(CASE WHEN ${conditionSql} THEN ${valueExpression} ELSE NULL END)`;
        case "max":
        default:
          return `MAX(CASE WHEN ${conditionSql} THEN ${valueExpression} ELSE NULL END)`;
      }
    }
    function normalizeSqlInputBindings(value, inputPlans, nodeName) {
      const bindingMap = new Map(
        parseObjectArray(value).map((item) => ({
          sourceNodeKey: trimText(item.sourceNodeKey),
          alias: trimText(item.alias)
        })).filter((item) => item.sourceNodeKey || item.alias).map((item) => [item.sourceNodeKey, item.alias])
      );
      const aliasSet = /* @__PURE__ */ new Set();
      return inputPlans.map((plan, index) => {
        const defaultAlias = `temp${index + 1}`;
        const fallbackAlias = `input_${index + 1}`;
        const alias = trimText(bindingMap.get(plan.nodeKey) || defaultAlias);
        if (!alias) {
          throw new AppError(`Custom SQL node ${nodeName} has an empty upstream alias`, 400);
        }
        if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(alias)) {
          throw new AppError(
            `Custom SQL node ${nodeName} alias ${alias} must start with a letter or underscore and contain only letters, digits, or underscores`,
            400
          );
        }
        if (aliasSet.has(alias)) {
          throw new AppError(`Custom SQL node ${nodeName} contains duplicate upstream alias ${alias}`, 400);
        }
        aliasSet.add(alias);
        return {
          sourceNodeKey: plan.nodeKey,
          alias,
          fallbackAlias
        };
      });
    }
    function normalizeAggregationRules(value) {
      return parseObjectArray(value).map((item) => ({
        aggregateFunction: normalizeSqlName(item.aggregateFunction || item.func || "count", "count"),
        fieldName: trimText(item.fieldName),
        alias: trimText(item.alias)
      })).filter((item) => item.aggregateFunction);
    }
    function buildDefaultAggregateAlias(rule) {
      const fieldPart = rule.fieldName && rule.fieldName !== "__all__" ? rule.fieldName : "rows";
      return `${rule.aggregateFunction}_${fieldPart}`;
    }
    function buildAggregateExpression(rule, sourceAlias, dialect) {
      const normalizedFunction = trimText(rule.aggregateFunction).toLowerCase();
      const fieldName = trimText(rule.fieldName);
      const targetField = fieldName && fieldName !== "__all__" ? buildAliasReference(sourceAlias, fieldName, dialect) : "*";
      switch (normalizedFunction) {
        case "count":
          return fieldName && fieldName !== "__all__" ? `COUNT(${targetField})` : "COUNT(*)";
        case "count_distinct":
          if (!fieldName || fieldName === "__all__") {
            throw new AppError("\u805A\u5408\u7EDF\u8BA1\u8282\u70B9\u7684 COUNT DISTINCT \u5FC5\u987B\u9009\u62E9\u76EE\u6807\u5B57\u6BB5", 400);
          }
          return `COUNT(DISTINCT ${targetField})`;
        case "sum":
          if (!fieldName || fieldName === "__all__") {
            throw new AppError("\u805A\u5408\u7EDF\u8BA1\u8282\u70B9\u7684 SUM \u5FC5\u987B\u9009\u62E9\u76EE\u6807\u5B57\u6BB5", 400);
          }
          return `SUM(${targetField})`;
        case "avg":
          if (!fieldName || fieldName === "__all__") {
            throw new AppError("\u805A\u5408\u7EDF\u8BA1\u8282\u70B9\u7684 AVG \u5FC5\u987B\u9009\u62E9\u76EE\u6807\u5B57\u6BB5", 400);
          }
          return `AVG(${targetField})`;
        case "max":
          if (!fieldName || fieldName === "__all__") {
            throw new AppError("\u805A\u5408\u7EDF\u8BA1\u8282\u70B9\u7684 MAX \u5FC5\u987B\u9009\u62E9\u76EE\u6807\u5B57\u6BB5", 400);
          }
          return `MAX(${targetField})`;
        case "min":
          if (!fieldName || fieldName === "__all__") {
            throw new AppError("\u805A\u5408\u7EDF\u8BA1\u8282\u70B9\u7684 MIN \u5FC5\u987B\u9009\u62E9\u76EE\u6807\u5B57\u6BB5", 400);
          }
          return `MIN(${targetField})`;
        default:
          throw new AppError(`\u805A\u5408\u7EDF\u8BA1\u8282\u70B9\u6682\u4E0D\u652F\u6301\u51FD\u6570: ${rule.aggregateFunction}`, 400);
      }
    }
    function buildSqlStringExpression(fieldExpression, dialect) {
      const normalizedDialect2 = normalizeDatasourceType(dialect);
      if (normalizedDialect2 === "postgresql") {
        return `CAST(${fieldExpression} AS TEXT)`;
      }
      if (normalizedDialect2 === "oracle") return `CAST(${fieldExpression} AS VARCHAR2(4000))`;
      if (normalizedDialect2 === "dm") return `CAST(${fieldExpression} AS VARCHAR(4000))`;
      if (normalizedDialect2 === "clickhouse") {
        return `toString(${fieldExpression})`;
      }
      if (normalizedDialect2 === "hive") {
        return `CAST(${fieldExpression} AS STRING)`;
      }
      return `CAST(${fieldExpression} AS CHAR)`;
    }
    function buildStringAggregateExpression(rule, sourceAlias, dialect) {
      const normalizedDialect2 = normalizeDatasourceType(dialect);
      const fieldExpression = buildSqlStringExpression(buildAliasReference(sourceAlias, rule.sourceField, dialect), dialect);
      const separator = escapeSqlLiteral(rule.separator === void 0 || rule.separator === null ? "," : String(rule.separator));
      const distinctSql = rule.distinct ? "DISTINCT " : "";
      if (normalizedDialect2 === "postgresql") {
        return `STRING_AGG(${distinctSql}${fieldExpression}, ${separator})`;
      }
      if (["oracle", "dm"].includes(normalizedDialect2)) {
        return `LISTAGG(${distinctSql}${fieldExpression}, ${separator}) WITHIN GROUP (ORDER BY ${fieldExpression})`;
      }
      if (normalizedDialect2 === "clickhouse") {
        return `arrayStringConcat(${rule.distinct ? "groupUniqArray" : "groupArray"}(${fieldExpression}), ${separator})`;
      }
      if (normalizedDialect2 === "hive") {
        return `concat_ws(${separator}, ${rule.distinct ? "collect_set" : "collect_list"}(${fieldExpression}))`;
      }
      return `GROUP_CONCAT(${distinctSql}${fieldExpression} SEPARATOR ${separator})`;
    }
    function buildStringSplitOutputColumns(inputColumns, sourceField, outputField, indexField) {
      const columns = inputColumns.map((columnName) => columnName === sourceField ? outputField : columnName);
      if (!columns.includes(outputField)) {
        columns.push(outputField);
      }
      if (indexField) {
        columns.push(indexField);
      }
      return columns;
    }
    function resolveSourceRelation(node, dialect, fallbackDatabaseName) {
      const tableName = trimText(node.nodeConfig?.tableName);
      if (!tableName) {
        throw new AppError(`Source node ${node.nodeName} must configure a table name`, 400);
      }
      if (tableName.includes(".")) {
        return quoteIdentifier(tableName, dialect);
      }
      const databaseName = trimText(node.nodeConfig?.databaseName || fallbackDatabaseName);
      const normalizedDialect2 = normalizeDatasourceType(dialect);
      if (databaseName && ["mysql", "oracle", "dm", "clickhouse", "hive"].includes(normalizedDialect2)) {
        return quoteIdentifier(`${databaseName}.${tableName}`, dialect);
      }
      return quoteIdentifier(tableName, dialect);
    }
    function resolveFinalPlan(compiledPlans, compiledPlanMap, outgoing, warnings, targetNodeKey) {
      if (targetNodeKey) {
        const targetPlan = compiledPlanMap.get(targetNodeKey);
        if (!targetPlan) {
          throw new AppError(`\u7F16\u6392\u4EFB\u52A1\u4E2D\u4E0D\u5B58\u5728\u8282\u70B9 ${targetNodeKey}`, 404);
        }
        return targetPlan;
      }
      const outputPlans = compiledPlans.filter((item) => item.nodeType === "output");
      if (outputPlans.length) {
        if (outputPlans.length > 1) {
          warnings.push("\u5F53\u524D\u753B\u5E03\u5B58\u5728\u591A\u4E2A\u8F93\u51FA\u8282\u70B9\uFF0CSQL \u9884\u89C8\u9ED8\u8BA4\u5C55\u793A\u6700\u540E\u4E00\u4E2A\u8F93\u51FA\u8282\u70B9\u3002");
        }
        return outputPlans[outputPlans.length - 1];
      }
      const leafPlans = compiledPlans.filter((item) => !(outgoing.get(item.nodeKey) || []).length);
      if (leafPlans.length > 1) {
        warnings.push("\u5F53\u524D\u753B\u5E03\u5B58\u5728\u591A\u4E2A\u672B\u7AEF\u8282\u70B9\uFF0CSQL \u9884\u89C8\u9ED8\u8BA4\u5C55\u793A\u6700\u540E\u4E00\u4E2A\u672B\u7AEF\u8282\u70B9\u3002");
      }
      return leafPlans[leafPlans.length - 1] || compiledPlans[compiledPlans.length - 1] || null;
    }
    function collectLineageNodeKeys(targetNodeKey, incoming) {
      const visited = /* @__PURE__ */ new Set();
      const stack = [targetNodeKey];
      while (stack.length) {
        const current = stack.pop();
        if (!current || visited.has(current)) {
          continue;
        }
        visited.add(current);
        for (const edge of incoming.get(current) || []) {
          stack.push(edge.sourceNodeKey);
        }
      }
      return visited;
    }
    async function compilePlans(task, options = {}) {
      const allNodes = Array.isArray(task?.nodes) ? task.nodes : [];
      const rawEdges = Array.isArray(task?.edges) ? task.edges : [];
      const activeEdges = filterActiveEdges(rawEdges);
      if (!allNodes.length) {
        throw new AppError("\u6570\u636E\u7F16\u6392\u4EFB\u52A1\u6682\u65E0\u8282\u70B9\uFF0C\u65E0\u6CD5\u751F\u6210 SQL \u9884\u89C8", 400);
      }
      const allNodeMap = new Map(allNodes.map((node) => [node.nodeKey, node]));
      const { incoming: fullIncoming } = buildEdgeMaps(activeEdges);
      if (options.targetNodeKey && !allNodeMap.has(options.targetNodeKey)) {
        throw new AppError(`\u7F16\u6392\u4EFB\u52A1\u4E2D\u4E0D\u5B58\u5728\u8282\u70B9 ${options.targetNodeKey}`, 404);
      }
      const scopedNodeKeys = options.targetNodeKey ? collectLineageNodeKeys(options.targetNodeKey, fullIncoming) : null;
      const nodes = scopedNodeKeys ? allNodes.filter((node) => scopedNodeKeys.has(node.nodeKey)) : allNodes;
      const edges = scopedNodeKeys ? activeEdges.filter((edge) => scopedNodeKeys.has(edge.sourceNodeKey) && scopedNodeKeys.has(edge.targetNodeKey)) : activeEdges;
      const executionOrder = scheduler.buildTopologicalOrder(nodes, edges);
      const nodeMap = new Map(nodes.map((node) => [node.nodeKey, node]));
      const { incoming, outgoing } = buildEdgeMaps(edges);
      const warnings = [];
      const dialect = normalizeDatasourceType(options.dialect || task.datasourceType || "mysql");
      const pausedEdgesInScope = rawEdges.filter(
        (edge) => normalizeOrchestrationEdgeStatus(edge?.edgeStatus) !== "active" && (!scopedNodeKeys || scopedNodeKeys.has(edge.sourceNodeKey) || scopedNodeKeys.has(edge.targetNodeKey))
      );
      if (pausedEdgesInScope.length) {
        warnings.push("\u5F53\u524D\u753B\u5E03\u5305\u542B\u5DF2\u6682\u505C\u7684\u8FDE\u7EBF\uFF0CSQL \u9884\u89C8\u548C\u8282\u70B9\u9884\u89C8\u5C06\u81EA\u52A8\u5FFD\u7565\u8FD9\u4E9B\u8DEF\u5F84\u3002");
      }
      const sourceDatasourceIds = uniqueValues(
        nodes.filter((node) => node.nodeType === "source").map((node) => Number(node.nodeConfig?.datasourceId || task.datasourceId || options.datasourceId || 0)).filter((value) => Number.isFinite(value) && value > 0)
      );
      if (sourceDatasourceIds.length > 1) {
        throw new AppError("\u5F53\u524D\u9636\u6BB5 SQL \u9884\u89C8\u4EC5\u652F\u6301\u5355\u6570\u636E\u6E90\u7F16\u6392\u3002", 400);
      }
      const sourceColumnCache = /* @__PURE__ */ new Map();
      const compiledPlans = [];
      const compiledPlanMap = /* @__PURE__ */ new Map();
      async function loadSourceColumns(node) {
        const datasourceId = Number(node.nodeConfig?.datasourceId || task.datasourceId || options.datasourceId || 0);
        const databaseName = trimText(node.nodeConfig?.databaseName || task.databaseName || options.databaseName);
        const tableName = trimText(node.nodeConfig?.tableName);
        if (!datasourceId || !tableName || typeof options.loadSourceColumns !== "function") {
          return [];
        }
        const cacheKey = [datasourceId, databaseName, tableName].join("::");
        if (!sourceColumnCache.has(cacheKey)) {
          const columns = await options.loadSourceColumns({
            datasourceId,
            databaseName,
            tableName
          });
          sourceColumnCache.set(
            cacheKey,
            Array.isArray(columns) ? columns.map((item) => String(item.name || "").trim()).filter(Boolean) : []
          );
        }
        return sourceColumnCache.get(cacheKey) || [];
      }
      for (let index = 0; index < executionOrder.length; index += 1) {
        const nodeKey = executionOrder[index];
        const node = nodeMap.get(nodeKey);
        if (!node) continue;
        const inputPlans = decorateIncomingPlans(incoming.get(nodeKey) || [], compiledPlanMap, nodeMap, dialect);
        const nodeConfig = node.nodeConfig || {};
        const cteName = `cte_${String(index + 1).padStart(2, "0")}_${normalizeSqlName(node.nodeKey, node.nodeType)}`;
        let sql = "";
        let columns = [];
        let relationName = null;
        if (node.nodeType === "source") {
          relationName = resolveSourceRelation(node, dialect, task.databaseName || options.databaseName);
          const sourceColumns = await loadSourceColumns(node);
          const selectedColumns = parseStringArray(nodeConfig.selectedColumns);
          const sourceTimeFilter = normalizeSourceTimeFilter(nodeConfig.sourceTimeFilter);
          if (sourceColumns.length && selectedColumns.length) {
            validateKnownColumns(sourceColumns, selectedColumns, node.nodeName, "\u6570\u636E\u8F93\u5165");
            validateUniqueColumns(selectedColumns, node.nodeName, "\u6570\u636E\u8F93\u5165");
          } else if (selectedColumns.length) {
            validateUniqueColumns(selectedColumns, node.nodeName, "\u6570\u636E\u8F93\u5165");
          }
          if (sourceColumns.length && sourceTimeFilter.fieldName) {
            validateKnownColumns(sourceColumns, [sourceTimeFilter.fieldName], node.nodeName, "\u6570\u636E\u8303\u56F4");
          }
          columns = selectedColumns.length ? selectedColumns.slice() : sourceColumns.slice();
          const fromClause = `${relationName} AS ${quoteIdentifier("source_data", dialect)}`;
          sql = columns.length ? `SELECT
${indentSql(buildProjectionSelectList("source_data", columns, dialect), 2)}
FROM ${fromClause}` : `SELECT *
FROM ${fromClause}`;
          const timeFilterClauses = buildSourceTimeFilterClauses("source_data", sourceTimeFilter, dialect);
          if (timeFilterClauses.length) {
            sql = `${sql}
WHERE ${timeFilterClauses.join("\n  AND ")}`;
          }
        } else if (node.nodeType === "output") {
          if (inputPlans.length !== 1) {
            throw new AppError(`Output node ${node.nodeName} must have exactly one upstream node`, 400);
          }
          relationName = trimText(nodeConfig.targetTable) || null;
          const outputFieldMappings = normalizeOutputFieldMappings(nodeConfig.outputFieldMappings);
          const inputColumns = inputPlans[0].columns.slice();
          if (outputFieldMappings.length) {
            validateKnownColumns(inputColumns, outputFieldMappings.map((item) => item.sourceField), node.nodeName, "\u8F93\u51FA\u5B57\u6BB5\u6620\u5C04");
            validateUniqueColumns(outputFieldMappings.map((item) => item.targetField), node.nodeName, "\u8F93\u51FA\u5B57\u6BB5\u6620\u5C04");
            columns = outputFieldMappings.map((item) => item.targetField);
            sql = `SELECT
${indentSql(
              outputFieldMappings.map((item) => `${buildAliasReference("source_data", item.sourceField, dialect)} AS ${quoteIdentifier(item.targetField, dialect)}`).join(",\n"),
              2
            )}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
          } else {
            columns = inputColumns;
            sql = `SELECT *
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
          }
          if (!relationName) {
            warnings.push(`\u8F93\u51FA\u8282\u70B9 ${node.nodeName} \u5C1A\u672A\u914D\u7F6E\u76EE\u6807\u8868\uFF0C\u672C\u6B21\u4EC5\u751F\u6210\u9884\u89C8 SQL\u3002`);
          }
        } else if (node.nodeType === "operator") {
          switch (node.operatorCode) {
            case "filter": {
              if (!inputPlans.length) {
                throw new AppError(`Filter node ${node.nodeName} must have at least one upstream node`, 400);
              }
              const primaryInputPlan = inputPlans.find((plan2) => plan2.nodeKey === trimText(nodeConfig.schemaSourceNodeKey)) || inputPlans[0];
              const inputPlanMap = new Map(inputPlans.map((plan2) => [plan2.nodeKey, plan2]));
              const conditionRules = normalizeConditionRules(nodeConfig.filterRules);
              if (conditionRules.length) {
                validateKnownColumns(primaryInputPlan.columns.slice(), conditionRules.map((item) => item.fieldName), node.nodeName, "\u6570\u636E\u8FC7\u6EE4");
                const upstreamFieldRules = conditionRules.filter((item) => ["in", "not_in"].includes(item.operator) && item.valueSource === "upstream_field");
                for (const rule of upstreamFieldRules) {
                  if (!rule.referenceField) {
                    throw new AppError(`\u6570\u636E\u8FC7\u6EE4\u8282\u70B9 ${node.nodeName} \u7684\u4E0A\u6E38\u5B57\u6BB5\u53D6\u503C\u65B9\u5F0F\u5FC5\u987B\u9009\u62E9\u5B57\u6BB5`, 400);
                  }
                  const referencePlan = rule.referenceNodeKey ? inputPlanMap.get(rule.referenceNodeKey) : primaryInputPlan;
                  if (!referencePlan) {
                    throw new AppError(`\u6570\u636E\u8FC7\u6EE4\u8282\u70B9 ${node.nodeName} \u5F15\u7528\u7684\u4E0A\u6E38\u8282\u70B9 ${rule.referenceNodeKey} \u672A\u8FDE\u63A5`, 400);
                  }
                  validateKnownColumns(referencePlan.columns.slice(), [rule.referenceField], node.nodeName, "\u6570\u636E\u8FC7\u6EE4\u4E0A\u6E38\u5B57\u6BB5");
                }
                const missingCustomSql = conditionRules.some(
                  (item) => ["in", "not_in"].includes(item.operator) && item.valueSource === "custom_sql" && !trimText(item.customSql)
                );
                if (missingCustomSql) {
                  throw new AppError(`\u6570\u636E\u8FC7\u6EE4\u8282\u70B9 ${node.nodeName} \u7684\u81EA\u5B9A\u4E49 SQL \u4E0D\u80FD\u4E3A\u7A7A`, 400);
                }
              }
              const condition = resolveRuleGroupCondition(
                nodeConfig,
                "filterRules",
                "filterLogic",
                ["filterCondition", "configText"],
                "source_data",
                dialect,
                { primaryInputPlan, inputPlanMap }
              );
              if (!condition) {
                throw new AppError(`Filter node ${node.nodeName} must configure a filter condition`, 400);
              }
              columns = primaryInputPlan.columns.slice();
              sql = `SELECT *
FROM ${buildPlanFromClause(primaryInputPlan, dialect, "source_data")}
WHERE ${condition}`;
              break;
            }
            case "deduplicate": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Deduplicate node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const keys = parseStringArray(nodeConfig.dedupeKeys || nodeConfig.configText);
              if (!keys.length) {
                throw new AppError(`Deduplicate node ${node.nodeName} must configure at least one dedupe key`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              const sortRules = normalizeSortRules(nodeConfig.dedupeSortFields);
              if (!sortRules.length) {
                throw new AppError(`Deduplicate node ${node.nodeName} must configure at least one sort field`, 400);
              }
              validateKnownColumns(inputColumns, keys, node.nodeName, "\u6570\u636E\u53BB\u91CD");
              const partitionBy = keys.map((item) => buildAliasReference("source_data", item, dialect)).join(", ");
              validateKnownColumns(inputColumns, sortRules.map((item) => item.fieldName), node.nodeName, "sort");
              const keepStrategy = trimText(nodeConfig.keepStrategy) || "first";
              const orderBy = sortRules.map((item) => {
                const direction = keepStrategy === "last" ? item.direction === "DESC" ? "ASC" : "DESC" : item.direction;
                return `${buildAliasReference("source_data", item.fieldName, dialect)} ${direction}`;
              }).join(", ");
              if (false) {
                warnings.push(`\u53BB\u91CD\u8282\u70B9 ${node.nodeName} \u6682\u672A\u914D\u7F6E\u6392\u5E8F\u5B57\u6BB5\uFF0CSQL \u9884\u89C8\u6309\u53BB\u91CD\u952E\u6392\u5E8F\u751F\u6210\u3002`);
              }
              columns = inputColumns;
              sql = `SELECT *
FROM (
  SELECT
    source_data.*,
    ROW_NUMBER() OVER (
      PARTITION BY ${partitionBy}
      ORDER BY ${orderBy}
    ) AS ${quoteIdentifier("__medata_rn", dialect)}
  FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}
) AS ${quoteIdentifier("dedupe_data", dialect)}
WHERE ${quoteIdentifier("__medata_rn", dialect)} = 1`;
              break;
            }
            case "select_columns": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Select Columns node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const selectedColumns = parseStringArray(nodeConfig.selectedColumns || nodeConfig.configText);
              if (!selectedColumns.length) {
                throw new AppError(`\u5B57\u6BB5\u9009\u62E9\u8282\u70B9 ${node.nodeName} \u81F3\u5C11\u8981\u9009\u62E9\u4E00\u4E2A\u5B57\u6BB5`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              validateKnownColumns(inputColumns, selectedColumns, node.nodeName, "\u5B57\u6BB5\u9009\u62E9");
              validateUniqueColumns(selectedColumns, node.nodeName, "\u5B57\u6BB5\u9009\u62E9");
              columns = selectedColumns.slice();
              sql = `SELECT
${indentSql(buildProjectionSelectList("source_data", selectedColumns, dialect), 2)}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
              break;
            }
            case "rename_fields": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Rename Fields node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const renameMappings = normalizeRenameMappings(nodeConfig.renameMappings);
              if (!renameMappings.length) {
                throw new AppError(`\u5B57\u6BB5\u91CD\u547D\u540D\u8282\u70B9 ${node.nodeName} \u81F3\u5C11\u8981\u914D\u7F6E\u4E00\u6761\u6620\u5C04`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              validateKnownColumns(inputColumns, renameMappings.map((item) => item.sourceField), node.nodeName, "\u5B57\u6BB5\u91CD\u547D\u540D");
              validateUniqueColumns(renameMappings.map((item) => item.sourceField), node.nodeName, "\u5B57\u6BB5\u91CD\u547D\u540D");
              validateUniqueColumns(renameMappings.map((item) => item.targetField), node.nodeName, "\u5B57\u6BB5\u91CD\u547D\u540D");
              const { outputColumns, selectSql } = buildRenameSelectList(inputColumns, renameMappings, dialect);
              validateUniqueColumns(outputColumns, node.nodeName, "\u5B57\u6BB5\u91CD\u547D\u540D");
              columns = outputColumns;
              sql = `SELECT
${indentSql(selectSql, 2)}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
              break;
            }
            case "sort": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Sort node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const sortRules = normalizeSortRules(nodeConfig.sortFields);
              if (!sortRules.length) {
                throw new AppError(`\u6392\u5E8F\u8282\u70B9 ${node.nodeName} \u81F3\u5C11\u8981\u914D\u7F6E\u4E00\u4E2A\u6392\u5E8F\u5B57\u6BB5`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              validateKnownColumns(inputColumns, sortRules.map((item) => item.fieldName), node.nodeName, "\u6392\u5E8F");
              columns = inputColumns;
              sql = `SELECT *
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}
ORDER BY ${sortRules.map((item) => `${quoteIdentifier(item.fieldName, dialect)} ${item.direction}`).join(", ")}`;
              break;
            }
            case "limit_rows": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Limit Rows node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const limitCount = sanitizePreviewLimit(nodeConfig.limitCount, 100);
              columns = inputPlans[0].columns.slice();
              const baseSql = `SELECT *
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
              sql = normalizedDialect === "oracle" ? `SELECT * FROM (
${indentSql(baseSql, 2)}
) WHERE ROWNUM <= ${limitCount}` : normalizedDialect === "dm" ? `${baseSql}
FETCH FIRST ${limitCount} ROWS ONLY` : `${baseSql}
LIMIT ${limitCount}`;
              break;
            }
            case "branch": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Branch node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const branchRules = normalizeConditionRules(nodeConfig.branchRules);
              if (branchRules.length) {
                validateKnownColumns(inputPlans[0].columns.slice(), branchRules.map((item) => item.fieldName), node.nodeName, "\u5206\u652F\u5224\u65AD");
              }
              const branchCondition = resolveBranchCondition(nodeConfig, "source_data", dialect);
              if (!branchCondition) {
                throw new AppError(`Branch node ${node.nodeName} must configure a branch condition`, 400);
              }
              columns = inputPlans[0].columns.slice();
              sql = `SELECT *
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
              break;
            }
            case "union": {
              if (inputPlans.length < 2) {
                throw new AppError(`Union node ${node.nodeName} must have at least two upstream nodes`, 400);
              }
              const unionKeyword = trimText(nodeConfig.unionMode) === "distinct" ? "UNION" : "UNION ALL";
              const columnMappings = normalizeColumnAlignmentRows(nodeConfig.columnMappings);
              if (columnMappings.length) {
                columns = columnMappings.map((row, index2) => trimText(row.outputField) || `field_${index2 + 1}`);
                validateUniqueColumns(columns, node.nodeName, "\u5E76\u96C6");
                sql = inputPlans.map((item) => {
                  if (item.columns.length) {
                    const referencedFields = columnMappings.map((row) => trimText((row.bindings || []).find((binding) => binding.sourceNodeKey === item.nodeKey)?.fieldName)).filter(Boolean);
                    if (referencedFields.length) {
                      validateKnownColumns(item.columns, referencedFields, `${node.nodeName} / ${item.nodeName}`, "\u5E76\u96C6");
                    }
                  }
                  const selectSegments = columnMappings.map((row, rowIndex) => {
                    const outputField = columns[rowIndex];
                    const binding = (row.bindings || []).find((current) => current.sourceNodeKey === item.nodeKey);
                    const fieldName = trimText(binding?.fieldName);
                    return fieldName ? `${buildAliasReference("source_data", fieldName, dialect)} AS ${quoteIdentifier(outputField, dialect)}` : `NULL AS ${quoteIdentifier(outputField, dialect)}`;
                  });
                  return `SELECT
${indentSql(selectSegments.join(",\n"), 2)}
FROM ${buildPlanFromClause(item, dialect, "source_data")}`;
                }).join(`
${unionKeyword}
`);
              } else {
                const alignMode = trimText(nodeConfig.alignMode) || "by_name";
                const mergedColumns = mergeColumns(inputPlans.map((item) => item.columns || []));
                if (alignMode === "by_name" && mergedColumns.length) {
                  columns = mergedColumns;
                  sql = inputPlans.map((item) => `SELECT
${indentSql(buildNamedSelectList("source_data", columns, item.columns, dialect), 2)}
FROM ${buildPlanFromClause(item, dialect, "source_data")}`).join(`
${unionKeyword}
`);
                  if (inputPlans.some((item) => !item.columns.length)) {
                    warnings.push(`\u5E76\u96C6\u8282\u70B9 ${node.nodeName} \u5B58\u5728\u672A\u8BC6\u522B\u5B57\u6BB5\u7ED3\u6784\u7684\u8F93\u5165\uFF0C\u7CFB\u7EDF\u5DF2\u6309\u53EF\u8BC6\u522B\u5B57\u6BB5\u81EA\u52A8\u8865\u7A7A\u5217\u3002`);
                  }
                } else {
                  const positionalColumns = (inputPlans.find((item) => item.columns.length)?.columns || []).slice();
                  if (positionalColumns.length) {
                    columns = positionalColumns;
                    sql = inputPlans.map((item) => `SELECT
${indentSql(buildPositionalSelectList("source_data", columns, item.columns || [], dialect), 2)}
FROM ${buildPlanFromClause(item, dialect, "source_data")}`).join(`
${unionKeyword}
`);
                    if (inputPlans.some((item) => item.columns.length !== columns.length)) {
                      warnings.push(`\u5E76\u96C6\u8282\u70B9 ${node.nodeName} \u5DF2\u6309\u5B57\u6BB5\u987A\u5E8F\u81EA\u52A8\u8865\u9F50\u7A7A\u5217\u3002`);
                    }
                  } else {
                    columns = inputPlans[0].columns.slice();
                    sql = inputPlans.map((item) => `SELECT *
FROM ${buildPlanFromClause(item, dialect, "source_data")}`).join(`
${unionKeyword}
`);
                    warnings.push(`\u5E76\u96C6\u8282\u70B9 ${node.nodeName} \u672A\u62FF\u5230\u5B8C\u6574\u5B57\u6BB5\u7ED3\u6784\uFF0C\u5DF2\u56DE\u9000\u4E3A\u539F\u59CB ${unionKeyword} \u9884\u89C8\u3002`);
                  }
                }
              }
              break;
            }
            case "intersect": {
              if (inputPlans.length < 2) {
                throw new AppError(`Intersect node ${node.nodeName} must have at least two upstream nodes`, 400);
              }
              const alignMode = trimText(nodeConfig.alignMode) || "by_name";
              const mergedColumns = mergeColumns(inputPlans.map((item) => item.columns || []));
              if (alignMode === "by_name" && mergedColumns.length) {
                columns = mergedColumns;
                sql = inputPlans.map((item) => `SELECT
${indentSql(buildNamedSelectList("source_data", columns, item.columns, dialect), 2)}
FROM ${buildPlanFromClause(item, dialect, "source_data")}`).join("\nINTERSECT\n");
                if (inputPlans.some((item) => !item.columns.length)) {
                  warnings.push(`\u4EA4\u96C6\u8282\u70B9 ${node.nodeName} \u5B58\u5728\u672A\u8BC6\u522B\u5B57\u6BB5\u7ED3\u6784\u7684\u8F93\u5165\uFF0C\u7CFB\u7EDF\u5DF2\u6309\u53EF\u8BC6\u522B\u5B57\u6BB5\u81EA\u52A8\u8865\u7A7A\u5217\u3002`);
                }
              } else {
                const positionalColumns = (inputPlans.find((item) => item.columns.length)?.columns || []).slice();
                if (positionalColumns.length) {
                  columns = positionalColumns;
                  sql = inputPlans.map((item) => `SELECT
${indentSql(buildPositionalSelectList("source_data", columns, item.columns || [], dialect), 2)}
FROM ${buildPlanFromClause(item, dialect, "source_data")}`).join("\nINTERSECT\n");
                  if (inputPlans.some((item) => item.columns.length !== columns.length)) {
                    warnings.push(`\u4EA4\u96C6\u8282\u70B9 ${node.nodeName} \u5DF2\u6309\u5B57\u6BB5\u987A\u5E8F\u81EA\u52A8\u8865\u9F50\u7A7A\u5217\u3002`);
                  }
                } else {
                  columns = inputPlans[0].columns.slice();
                  sql = inputPlans.map((item) => `SELECT *
FROM ${buildPlanFromClause(item, dialect, "source_data")}`).join("\nINTERSECT\n");
                  warnings.push(`\u4EA4\u96C6\u8282\u70B9 ${node.nodeName} \u672A\u62FF\u5230\u5B8C\u6574\u5B57\u6BB5\u7ED3\u6784\uFF0C\u5DF2\u56DE\u9000\u4E3A\u539F\u59CB INTERSECT \u9884\u89C8\u3002`);
                }
              }
              break;
            }
            case "replace": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Replace node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const fieldName = trimText(nodeConfig.fieldName);
              if (!fieldName) {
                throw new AppError(`Replace node ${node.nodeName} must configure a target field`, 400);
              }
              const replaceRules = normalizeReplaceRules(nodeConfig.replaceRules, nodeConfig.matchValue, nodeConfig.replaceValue);
              if (!replaceRules.length) {
                throw new AppError(`Replace node ${node.nodeName} must configure at least one replace rule`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              validateKnownColumns(inputColumns, [fieldName], node.nodeName, "\u5B57\u6BB5\u503C\u66FF\u6362");
              columns = inputColumns;
              sql = `SELECT
${indentSql(buildReplaceSelectList(inputColumns, fieldName, replaceRules, dialect), 2)}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
              break;
            }
            case "join": {
              if (inputPlans.length !== 2) {
                throw new AppError(`Join node ${node.nodeName} must have exactly two upstream nodes`, 400);
              }
              const leftPlan = inputPlans[0];
              const rightPlan = inputPlans[1];
              const joinType = trimText(nodeConfig.joinType) || "left";
              const joinKeys = normalizeJoinKeyRules(nodeConfig.joinKeys);
              const leftOutputFields = parseStringArray(nodeConfig.leftOutputFields);
              const rightOutputFields = parseStringArray(nodeConfig.rightOutputFields);
              const leftColumns = leftPlan.columns.slice();
              const rightColumns = rightPlan.columns.slice();
              const effectiveLeftFields = leftOutputFields.length ? leftOutputFields : leftColumns.slice();
              const effectiveRightFields = rightOutputFields.length ? rightOutputFields : rightColumns.slice();
              validateKnownColumns(leftColumns, effectiveLeftFields, node.nodeName, "\u5173\u8054");
              validateKnownColumns(rightColumns, effectiveRightFields, node.nodeName, "\u5173\u8054");
              if (joinType !== "cross") {
                if (!joinKeys.length) {
                  throw new AppError(`Join node ${node.nodeName} must configure at least one join key`, 400);
                }
                validateKnownColumns(leftColumns, joinKeys.map((item) => item.leftField), node.nodeName, "\u5173\u8054");
                validateKnownColumns(rightColumns, joinKeys.map((item) => item.rightField), node.nodeName, "\u5173\u8054");
              }
              const selectSegments = [];
              const outputColumns = [];
              const seenColumns = /* @__PURE__ */ new Set();
              effectiveLeftFields.forEach((fieldName) => {
                outputColumns.push(fieldName);
                seenColumns.add(fieldName);
                selectSegments.push(`${buildAliasReference("left_data", fieldName, dialect)} AS ${quoteIdentifier(fieldName, dialect)}`);
              });
              effectiveRightFields.forEach((fieldName) => {
                const outputField = seenColumns.has(fieldName) ? `right_${fieldName}` : fieldName;
                outputColumns.push(outputField);
                seenColumns.add(outputField);
                selectSegments.push(`${buildAliasReference("right_data", fieldName, dialect)} AS ${quoteIdentifier(outputField, dialect)}`);
              });
              const joinCondition = joinKeys.length ? joinKeys.map((item) => `${buildAliasReference("left_data", item.leftField, dialect)} = ${buildAliasReference("right_data", item.rightField, dialect)}`).join(" AND ") : "1 = 1";
              const leftFromClause = buildPlanFromClause(leftPlan, dialect, "left_data");
              const rightFromClause = buildPlanFromClause(rightPlan, dialect, "right_data");
              const selectSql = indentSql(selectSegments.join(",\n"), 2);
              const normalizedDialect2 = normalizeDatasourceType(dialect);
              columns = outputColumns;
              if (joinType === "cross") {
                sql = `SELECT
${selectSql}
FROM ${leftFromClause}
CROSS JOIN ${rightFromClause}`;
                break;
              }
              const joinKeywordMap = {
                left: "LEFT JOIN",
                right: "RIGHT JOIN",
                inner: "INNER JOIN",
                full: "FULL OUTER JOIN"
              };
              if (joinType === "full" && ["mysql", "clickhouse"].includes(normalizedDialect2)) {
                const antiCondition = joinKeys.map((item) => `${buildAliasReference("left_data", item.leftField, dialect)} IS NULL`).join(" AND ");
                const leftJoinSql = `SELECT
${selectSql}
FROM ${leftFromClause}
LEFT JOIN ${rightFromClause}
  ON ${joinCondition}`;
                const rightOnlySql = `SELECT
${selectSql}
FROM ${rightFromClause}
LEFT JOIN ${leftFromClause}
  ON ${joinCondition}
WHERE ${antiCondition}`;
                sql = `${leftJoinSql}
UNION ALL
${rightOnlySql}`;
                warnings.push(`\u5173\u8054\u8282\u70B9 ${node.nodeName} \u5728\u5F53\u524D\u6570\u636E\u6E90\u4E0A\u6309 UNION ALL \u6A21\u62DF FULL OUTER JOIN\u3002`);
                break;
              }
              const joinKeyword = joinKeywordMap[joinType] || "LEFT JOIN";
              sql = `SELECT
${selectSql}
FROM ${leftFromClause}
${joinKeyword} ${rightFromClause}
  ON ${joinCondition}`;
              break;
            }
            case "format_convert": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Format Convert node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              const formatRules = normalizeFormatRules(nodeConfig.formatRules);
              if (!formatRules.length) {
                throw new AppError(`Format Convert node ${node.nodeName} must configure at least one rule`, 400);
              }
              validateKnownColumns(inputColumns, formatRules.map((item) => item.sourceField), node.nodeName, "\u683C\u5F0F\u8F6C\u6362");
              validateUniqueColumns(formatRules.map((item) => item.targetField), node.nodeName, "\u683C\u5F0F\u8F6C\u6362");
              const { outputColumns, selectSql } = buildDerivedSelectPlan(
                inputColumns,
                formatRules,
                dialect,
                (rule, sourceAlias) => buildFormatRuleExpression(rule, sourceAlias, dialect)
              );
              columns = outputColumns;
              sql = `SELECT
${indentSql(selectSql, 2)}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
              break;
            }
            case "compliance_check": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Compliance Check node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              const complianceRules = normalizeComplianceRules(nodeConfig.complianceRules);
              if (!complianceRules.length) {
                throw new AppError(`Compliance Check node ${node.nodeName} must configure at least one rule`, 400);
              }
              validateKnownColumns(inputColumns, complianceRules.map((item) => item.sourceField), node.nodeName, "\u6570\u636E\u6821\u9A8C");
              validateUniqueColumns(complianceRules.map((item) => item.targetField), node.nodeName, "\u6570\u636E\u6821\u9A8C");
              const { outputColumns, selectSql } = buildDerivedSelectPlan(
                inputColumns,
                complianceRules,
                dialect,
                (rule, sourceAlias) => buildComplianceRuleExpression(rule, sourceAlias, dialect)
              );
              columns = outputColumns;
              sql = `SELECT
${indentSql(selectSql, 2)}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
              break;
            }
            case "string_transform": {
              if (inputPlans.length !== 1) {
                throw new AppError(`String Transform node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              const stringRules = normalizeStringRules(nodeConfig.stringRules);
              if (!stringRules.length) {
                throw new AppError(`String Transform node ${node.nodeName} must configure at least one rule`, 400);
              }
              validateKnownColumns(inputColumns, stringRules.map((item) => item.sourceField), node.nodeName, "\u5B57\u7B26\u5904\u7406");
              validateUniqueColumns(stringRules.map((item) => item.targetField), node.nodeName, "\u5B57\u7B26\u5904\u7406");
              const { outputColumns, selectSql } = buildDerivedSelectPlan(
                inputColumns,
                stringRules,
                dialect,
                (rule, sourceAlias) => buildStringRuleExpression(rule, sourceAlias, dialect)
              );
              columns = outputColumns;
              sql = `SELECT
${indentSql(selectSql, 2)}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
              break;
            }
            case "desensitize": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Desensitize node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              const desensitizeRules = normalizeDesensitizeRules(nodeConfig.desensitizeRules);
              if (!desensitizeRules.length) {
                throw new AppError(`Desensitize node ${node.nodeName} must configure at least one rule`, 400);
              }
              validateKnownColumns(inputColumns, desensitizeRules.map((item) => item.sourceField), node.nodeName, "\u6570\u636E\u8131\u654F");
              validateUniqueColumns(desensitizeRules.map((item) => item.targetField), node.nodeName, "\u6570\u636E\u8131\u654F");
              const { outputColumns, selectSql } = buildDerivedSelectPlan(
                inputColumns,
                desensitizeRules,
                dialect,
                (rule, sourceAlias) => buildDesensitizeRuleExpression(rule, sourceAlias, dialect)
              );
              columns = outputColumns;
              sql = `SELECT
${indentSql(selectSql, 2)}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
              break;
            }
            case "string_aggregate": {
              if (inputPlans.length !== 1) {
                throw new AppError(`String aggregate node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              const groupByFields = parseStringArray(nodeConfig.groupByFields);
              const aggregateRules = normalizeStringAggregateRules(nodeConfig.stringAggregateRules);
              if (!aggregateRules.length) {
                throw new AppError(`String aggregate node ${node.nodeName} must configure at least one rule`, 400);
              }
              validateKnownColumns(inputColumns, groupByFields.concat(aggregateRules.map((item) => item.sourceField)), node.nodeName, "\u5B57\u7B26\u4E32\u805A\u5408");
              validateUniqueColumns(groupByFields, node.nodeName, "\u5B57\u7B26\u4E32\u805A\u5408");
              validateUniqueColumns(aggregateRules.map((item) => item.outputField), node.nodeName, "\u5B57\u7B26\u4E32\u805A\u5408");
              columns = groupByFields.concat(aggregateRules.map((item) => item.outputField));
              const selectSegments = groupByFields.map((fieldName) => `${buildAliasReference("source_data", fieldName, dialect)} AS ${quoteIdentifier(fieldName, dialect)}`);
              aggregateRules.forEach((rule) => {
                selectSegments.push(`${buildStringAggregateExpression(rule, "source_data", dialect)} AS ${quoteIdentifier(rule.outputField, dialect)}`);
              });
              sql = `SELECT
${indentSql(selectSegments.join(",\n"), 2)}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}${groupByFields.length ? `
GROUP BY ${groupByFields.map((fieldName) => buildAliasReference("source_data", fieldName, dialect)).join(", ")}` : ""}`;
              break;
            }
            case "string_split": {
              if (inputPlans.length !== 1) {
                throw new AppError(`String split node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              const splitConfig = normalizeStringSplitConfig(nodeConfig);
              if (!splitConfig.sourceField || !splitConfig.outputField) {
                throw new AppError(`String split node ${node.nodeName} must configure source and output fields`, 400);
              }
              if (!splitConfig.separator) {
                throw new AppError(`String split node ${node.nodeName} must configure a non-empty separator`, 400);
              }
              validateKnownColumns(inputColumns, [splitConfig.sourceField], node.nodeName, "\u5B57\u7B26\u4E32\u62C6\u5206");
              columns = buildStringSplitOutputColumns(inputColumns, splitConfig.sourceField, splitConfig.outputField, splitConfig.indexField);
              validateUniqueColumns(columns, node.nodeName, "\u5B57\u7B26\u4E32\u62C6\u5206");
              sql = `SELECT *
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
              break;
            }
            case "pivot": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Pivot node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              const groupByFields = parseStringArray(nodeConfig.groupByFields);
              const pivotField = trimText(nodeConfig.pivotField);
              const valueField = trimText(nodeConfig.valueField);
              const aggregateFunction = trimText(nodeConfig.aggregateFunction) || "max";
              const pivotMappings = normalizePivotMappings(nodeConfig.pivotMappings);
              if (!pivotField || !valueField || !pivotMappings.length) {
                throw new AppError(`Pivot node ${node.nodeName} must configure pivot field, value field, and mappings`, 400);
              }
              validateKnownColumns(inputColumns, groupByFields.concat([pivotField, valueField]), node.nodeName, "\u884C\u8F6C\u5217");
              validateUniqueColumns(groupByFields, node.nodeName, "\u884C\u8F6C\u5217");
              validateUniqueColumns(pivotMappings.map((item) => item.outputField), node.nodeName, "\u884C\u8F6C\u5217");
              columns = groupByFields.concat(pivotMappings.map((item) => item.outputField));
              const selectSegments = groupByFields.map((fieldName) => `${buildAliasReference("source_data", fieldName, dialect)} AS ${quoteIdentifier(fieldName, dialect)}`);
              pivotMappings.forEach((item) => {
                const conditionSql = `${buildAliasReference("source_data", pivotField, dialect)} = ${escapeSqlLiteral(item.sourceValue)}`;
                const valueExpression = buildAliasReference("source_data", valueField, dialect);
                selectSegments.push(`${buildAggregateCaseExpression(aggregateFunction, conditionSql, valueExpression)} AS ${quoteIdentifier(item.outputField, dialect)}`);
              });
              sql = `SELECT
${indentSql(selectSegments.join(",\n"), 2)}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}${groupByFields.length ? `
GROUP BY ${groupByFields.map((fieldName) => buildAliasReference("source_data", fieldName, dialect)).join(", ")}` : ""}`;
              break;
            }
            case "unpivot": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Unpivot node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              const groupByFields = parseStringArray(nodeConfig.groupByFields);
              const sourceFields = parseStringArray(nodeConfig.sourceFields);
              const nameField = trimText(nodeConfig.nameField) || "metric_name";
              const valueField = trimText(nodeConfig.valueField) || "metric_value";
              if (!sourceFields.length) {
                throw new AppError(`Unpivot node ${node.nodeName} must configure at least one source field`, 400);
              }
              validateKnownColumns(inputColumns, groupByFields.concat(sourceFields), node.nodeName, "\u5217\u8F6C\u884C");
              columns = groupByFields.concat([nameField, valueField]);
              sql = sourceFields.map((fieldName) => {
                const selectSegments = groupByFields.map((groupField) => `${buildAliasReference("source_data", groupField, dialect)} AS ${quoteIdentifier(groupField, dialect)}`);
                selectSegments.push(`${escapeSqlLiteral(fieldName)} AS ${quoteIdentifier(nameField, dialect)}`);
                selectSegments.push(`${buildAliasReference("source_data", fieldName, dialect)} AS ${quoteIdentifier(valueField, dialect)}`);
                return `SELECT
${indentSql(selectSegments.join(",\n"), 2)}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
              }).join("\nUNION ALL\n");
              break;
            }
            case "window_compute": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Window Compute node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              const functionType = trimText(nodeConfig.functionType) || "row_number";
              const outputField = trimText(nodeConfig.outputField) || "window_value";
              const sourceField = trimText(nodeConfig.sourceField);
              const partitionByFields = parseStringArray(nodeConfig.partitionByFields);
              const orderByFields = normalizeSortRules(nodeConfig.orderByFields);
              validateKnownColumns(inputColumns, partitionByFields, node.nodeName, "\u7A97\u53E3\u8BA1\u7B97");
              validateKnownColumns(inputColumns, orderByFields.map((item) => item.fieldName), node.nodeName, "\u7A97\u53E3\u8BA1\u7B97");
              if (["lag", "lead", "sum", "avg"].includes(functionType)) {
                validateKnownColumns(inputColumns, [sourceField], node.nodeName, "\u7A97\u53E3\u8BA1\u7B97");
              }
              if (["row_number", "rank", "dense_rank", "lag", "lead"].includes(functionType) && !orderByFields.length) {
                throw new AppError(`Window Compute node ${node.nodeName} must configure ORDER BY fields`, 400);
              }
              const partitionSql = partitionByFields.length ? `PARTITION BY ${partitionByFields.map((fieldName) => buildAliasReference("source_data", fieldName, dialect)).join(", ")} ` : "";
              const orderSql = orderByFields.length ? `ORDER BY ${orderByFields.map((item) => `${buildAliasReference("source_data", item.fieldName, dialect)} ${item.direction}`).join(", ")}` : "";
              const overSql = `${partitionSql}${orderSql}`.trim();
              let expression = "";
              if (functionType === "row_number") {
                expression = `ROW_NUMBER() OVER (${overSql})`;
              } else if (functionType === "rank") {
                expression = `RANK() OVER (${overSql})`;
              } else if (functionType === "dense_rank") {
                expression = `DENSE_RANK() OVER (${overSql})`;
              } else if (functionType === "sum") {
                expression = `SUM(${buildAliasReference("source_data", sourceField, dialect)}) OVER (${overSql || partitionSql.trim()})`;
              } else if (functionType === "avg") {
                expression = `AVG(${buildAliasReference("source_data", sourceField, dialect)}) OVER (${overSql || partitionSql.trim()})`;
              } else if (functionType === "lag") {
                const offset = Math.max(1, Number(nodeConfig.offset || 1));
                const defaultValue = nodeConfig.defaultValue === void 0 || nodeConfig.defaultValue === null ? "" : String(nodeConfig.defaultValue);
                expression = `LAG(${buildAliasReference("source_data", sourceField, dialect)}, ${offset}, ${escapeSqlLiteral(defaultValue)}) OVER (${overSql})`;
              } else if (functionType === "lead") {
                const offset = Math.max(1, Number(nodeConfig.offset || 1));
                const defaultValue = nodeConfig.defaultValue === void 0 || nodeConfig.defaultValue === null ? "" : String(nodeConfig.defaultValue);
                expression = `LEAD(${buildAliasReference("source_data", sourceField, dialect)}, ${offset}, ${escapeSqlLiteral(defaultValue)}) OVER (${overSql})`;
              } else {
                throw new AppError(`Unsupported window function ${functionType}`, 400);
              }
              const { outputColumns, selectSql } = buildDerivedSelectPlan(
                inputColumns,
                [{ targetField: outputField, outputField }],
                dialect,
                () => expression
              );
              columns = outputColumns;
              sql = `SELECT
${indentSql(selectSql, 2)}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
              break;
            }
            case "aggregate": {
              if (inputPlans.length !== 1) {
                throw new AppError(`Aggregate node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const inputColumns = inputPlans[0].columns.slice();
              const groupByFields = parseStringArray(nodeConfig.groupByFields);
              const aggregationRules = normalizeAggregationRules(nodeConfig.aggregations);
              if (!aggregationRules.length) {
                throw new AppError(`\u805A\u5408\u7EDF\u8BA1\u8282\u70B9 ${node.nodeName} \u81F3\u5C11\u8981\u914D\u7F6E\u4E00\u4E2A\u805A\u5408\u6307\u6807`, 400);
              }
              validateKnownColumns(inputColumns, groupByFields, node.nodeName, "\u805A\u5408\u7EDF\u8BA1");
              validateUniqueColumns(groupByFields, node.nodeName, "\u805A\u5408\u7EDF\u8BA1");
              const requiredAggregationFields = aggregationRules.map((item) => item.fieldName).filter((item) => item && item !== "__all__");
              validateKnownColumns(inputColumns, requiredAggregationFields, node.nodeName, "\u805A\u5408\u7EDF\u8BA1");
              const outputColumns = groupByFields.slice();
              const selectSegments = groupByFields.map((fieldName) => `${buildAliasReference("source_data", fieldName, dialect)} AS ${quoteIdentifier(fieldName, dialect)}`);
              for (const rule of aggregationRules) {
                const alias = trimText(rule.alias) || buildDefaultAggregateAlias(rule);
                outputColumns.push(alias);
                selectSegments.push(`${buildAggregateExpression(rule, "source_data", dialect)} AS ${quoteIdentifier(alias, dialect)}`);
              }
              validateUniqueColumns(outputColumns, node.nodeName, "\u805A\u5408\u7EDF\u8BA1");
              columns = outputColumns;
              sql = `SELECT
${indentSql(selectSegments.join(",\n"), 2)}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}${groupByFields.length ? `
GROUP BY ${groupByFields.map((fieldName) => buildAliasReference("source_data", fieldName, dialect)).join(", ")}` : ""}`;
              break;
            }
            case "custom_sql": {
              const sqlText = stripTrailingSemicolon(nodeConfig.sqlText || nodeConfig.configText);
              if (!sqlText) {
                throw new AppError(`Custom SQL node ${node.nodeName} must configure SQL text`, 400);
              }
              const sqlInputBindings = normalizeSqlInputBindings(nodeConfig.sqlInputs, inputPlans, node.nodeName);
              const inlineAliases = [];
              const emittedAliases = /* @__PURE__ */ new Set();
              sqlInputBindings.forEach((binding, inputIndex) => {
                const inputPlan = inputPlans[inputIndex];
                inlineAliases.push(`${quoteIdentifier(binding.alias, dialect)} AS (
${indentSql(buildPlanSelectSql(inputPlan, dialect), 2)}
)`);
                emittedAliases.add(binding.alias);
                if (!emittedAliases.has(binding.fallbackAlias)) {
                  inlineAliases.push(
                    `${quoteIdentifier(binding.fallbackAlias, dialect)} AS (
${indentSql(`SELECT *
FROM ${quoteIdentifier(binding.alias, dialect)}`, 2)}
)`
                  );
                  emittedAliases.add(binding.fallbackAlias);
                }
              });
              if (inputPlans.length) {
                const primaryAlias = sqlInputBindings[0]?.alias || "input_1";
                if (!emittedAliases.has("input_data")) {
                  inlineAliases.push(`${quoteIdentifier("input_data", dialect)} AS (
${indentSql(`SELECT *
FROM ${quoteIdentifier(primaryAlias, dialect)}`, 2)}
)`);
                }
              }
              const sourceColumnsByAlias = {};
              sqlInputBindings.forEach((binding, inputIndex) => {
                sourceColumnsByAlias[binding.alias] = inputPlans[inputIndex]?.columns || [];
                sourceColumnsByAlias[binding.fallbackAlias] = inputPlans[inputIndex]?.columns || [];
              });
              if (inputPlans.length) {
                sourceColumnsByAlias.input_data = inputPlans[0]?.columns || [];
              }
              const inferredSqlColumns = sqlParser.inferSelectOutputColumns(sqlText, dialect, sourceColumnsByAlias);
              columns = inferredSqlColumns.columns.length ? inferredSqlColumns.columns : mergeColumns(inputPlans.map((item) => item.columns || []));
              if (!inferredSqlColumns.columns.length) {
                warnings.push(`\u81EA\u5B9A\u4E49 SQL \u8282\u70B9 ${node.nodeName} \u7684\u8F93\u51FA\u5B57\u6BB5\u6682\u672A\u80FD\u4ECE SQL \u4E2D\u8BC6\u522B\uFF0C\u5F53\u524D\u56DE\u9000\u4E3A\u4E0A\u6E38\u5B57\u6BB5\u7ED3\u6784\uFF0C\u8BF7\u4EE5\u8282\u70B9\u9884\u89C8\u7ED3\u679C\u4E3A\u51C6\u3002`);
              } else if (!inferredSqlColumns.complete) {
                warnings.push(`\u81EA\u5B9A\u4E49 SQL \u8282\u70B9 ${node.nodeName} \u7684\u90E8\u5206\u8F93\u51FA\u5B57\u6BB5\u4E3A\u8FD1\u4F3C\u63A8\u65AD\uFF0C\u5EFA\u8BAE\u4E3A\u8BA1\u7B97\u5217\u663E\u5F0F\u8BBE\u7F6E\u522B\u540D\u3002`);
              }
              sql = prependInlineAliases(sqlText, inlineAliases);
              break;
            }
            case "llm":
            case "llm_row":
            case "llm_batch": {
              if (inputPlans.length !== 1) {
                throw new AppError(`AI node ${node.nodeName} must have exactly one upstream node`, 400);
              }
              const normalizedAiOperatorCode = normalizeAiOperatorCode(node.operatorCode);
              const outputFields = normalizeAiOutputFields(
                nodeConfig,
                getAiFallbackFieldName(normalizedAiOperatorCode)
              );
              const outputFieldNames = outputFields.map((item) => item.fieldName);
              const inputColumns = inputPlans[0].columns.slice();
              if (!outputFieldNames.length) {
                throw new AppError(`AI node ${node.nodeName} must configure at least one output field`, 400);
              }
              if (new Set(outputFieldNames).size !== outputFieldNames.length) {
                throw new AppError(`AI node ${node.nodeName} has duplicate output fields`, 400);
              }
              if (normalizedAiOperatorCode === "llm_batch") {
                columns = outputFieldNames.slice();
                sql = `SELECT
  ${outputFieldNames.map((fieldName) => `NULL AS ${quoteIdentifier(fieldName, dialect)}`).join(",\n  ")}`;
                warnings.push(`AI batch node ${node.nodeName} cannot be translated to pure SQL. SQL preview uses a single NULL row as placeholders for ${outputFieldNames.join(", ")}.`);
              } else {
                const duplicatedInputField = outputFieldNames.find((fieldName) => inputColumns.includes(fieldName));
                if (duplicatedInputField) {
                  throw new AppError(`AI node ${node.nodeName} output field ${duplicatedInputField} already exists in upstream schema`, 400);
                }
                columns = inputColumns.concat(outputFieldNames);
                sql = `SELECT
  source_data.*,
  ${outputFieldNames.map((fieldName) => `NULL AS ${quoteIdentifier(fieldName, dialect)}`).join(",\n  ")}
FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
                warnings.push(`AI row node ${node.nodeName} cannot be translated to pure SQL. SQL preview uses NULL as placeholders for ${outputFieldNames.join(", ")}.`);
              }
              break;
            }
            default:
              throw new AppError(`Unsupported orchestration operator: ${node.operatorCode}`, 400);
          }
        } else {
          throw new AppError(`Unsupported orchestration node type: ${node.nodeType}`, 400);
        }
        const plan = {
          nodeKey: node.nodeKey,
          nodeName: node.nodeName,
          nodeType: node.nodeType,
          operatorCode: node.operatorCode,
          cteName,
          sql,
          columns,
          relationName,
          sqlCompatible: !(node.nodeType === "operator" && (AI_OPERATOR_CODES.has(node.operatorCode) || node.operatorCode === "string_split"))
        };
        compiledPlanMap.set(node.nodeKey, plan);
        compiledPlans.push(plan);
      }
      const finalPlan = resolveFinalPlan(compiledPlans, compiledPlanMap, outgoing, warnings, options.targetNodeKey);
      if (!finalPlan) {
        throw new AppError("\u5F53\u524D\u6570\u636E\u7F16\u6392\u56FE\u65E0\u6CD5\u786E\u5B9A\u6700\u7EC8\u8F93\u51FA\u8282\u70B9", 400);
      }
      const finalLineageNodeKeys = collectLineageNodeKeys(finalPlan.nodeKey, incoming);
      const hasRuntimeOperators = compiledPlans.some((item) => finalLineageNodeKeys.has(item.nodeKey) && item.sqlCompatible === false);
      return {
        taskId: Number(task.id),
        taskName: task.name,
        datasourceId: sourceDatasourceIds[0] || task.datasourceId || options.datasourceId || null,
        datasourceType: options.datasourceType || task.datasourceType || dialect,
        databaseName: task.databaseName || options.databaseName || null,
        dialect,
        executionOrder,
        warnings: uniqueValues(warnings),
        compiledPlans,
        compiledPlanMap,
        incoming,
        outputPlans: compiledPlans.filter((item) => item.nodeType === "output"),
        finalPlan,
        finalLineageNodeKeys,
        hasRuntimeOperators
      };
    }
    async function compileOrchestrationTask(task, options = {}) {
      const compiled = await compilePlans(task, options);
      const finalLineagePlans = compiled.compiledPlans.filter((item) => compiled.finalLineageNodeKeys.has(item.nodeKey));
      const withClause = buildWithClause(finalLineagePlans, compiled.dialect);
      const previewSql = `${withClause}
${buildNodeSelectSql(compiled.finalPlan.cteName, compiled.dialect, options.previewLimit)};`;
      const warnings = compiled.warnings.slice();
      const finalInsertColumns = (compiled.finalPlan.columns || []).filter(Boolean);
      const finalInsertColumnSql = finalInsertColumns.length ? ` (${finalInsertColumns.map((columnName) => quoteIdentifier(columnName, compiled.dialect)).join(", ")})` : "";
      const executeSql = !compiled.hasRuntimeOperators && compiled.finalPlan.nodeType === "output" && compiled.finalPlan.relationName ? `${withClause}
INSERT INTO ${quoteIdentifier(compiled.finalPlan.relationName, compiled.dialect)}${finalInsertColumnSql}
SELECT *
FROM ${buildCteReference(compiled.finalPlan.cteName, compiled.dialect)};` : null;
      const outputStatements = compiled.hasRuntimeOperators ? [] : buildOutputStatements(compiled.compiledPlans, compiled.incoming, compiled.outputPlans, compiled.dialect);
      if (compiled.hasRuntimeOperators) {
        warnings.push("Current graph includes at least one AI node in the result path. SQL preview is for structure inspection only and is not executable as the real runtime plan.");
      }
      return {
        taskId: compiled.taskId,
        taskName: compiled.taskName,
        datasourceId: compiled.datasourceId,
        datasourceType: compiled.datasourceType,
        databaseName: compiled.databaseName,
        dialect: compiled.dialect,
        executionOrder: compiled.executionOrder,
        finalNodeKey: compiled.finalPlan.nodeKey,
        finalNodeName: compiled.finalPlan.nodeName,
        previewSql,
        executeSql,
        finalColumns: compiled.finalPlan.columns || [],
        hasRuntimeOperators: compiled.hasRuntimeOperators,
        warnings: uniqueValues(warnings),
        nodeSqls: compiled.compiledPlans.map((item) => ({
          nodeKey: item.nodeKey,
          nodeName: item.nodeName,
          nodeType: item.nodeType,
          operatorCode: item.operatorCode,
          cteName: item.cteName,
          relationName: item.relationName,
          sql: item.sql,
          columns: item.columns || []
        })),
        outputStatements
      };
    }
    module2.exports = {
      compileOrchestrationTask
    };
  }
});

// backend/src/services/apiIngestionService.js
var require_apiIngestionService = __commonJS({
  "backend/src/services/apiIngestionService.js"(exports2, module2) {
    var mysql = require("mysql2/promise");
    var AppError = require_app_error();
    var { pool } = require_database();
    var { createPostgresLikeClient } = require_db_client();
    var { inferDatasourceDialect, resolveDatasourceConnection } = require_datasource_dialect();
    var SENSITIVE_KEY_PATTERN = /(authorization|token|secret|password|apikey|api[_-]?key|access[_-]?key|x-api-key)/i;
    function normalizeApiConnectionConfig(config = {}) {
      const baseUrl = String(config.baseUrl || config.apiBaseUrl || config.url || "").trim().replace(/\/+$/g, "");
      return {
        baseUrl,
        defaultPath: String(config.defaultPath || config.endpointPath || "/").trim() || "/",
        authType: normalizeEnum(config.authType || "none", ["none", "basic", "bearer", "api_key"], "none"),
        bearerToken: String(config.bearerToken || config.token || ""),
        username: String(config.username || config.user || ""),
        password: String(config.password || ""),
        apiKeyName: String(config.apiKeyName || "x-api-key"),
        apiKeyValue: String(config.apiKeyValue || config.apiKey || ""),
        apiKeyIn: normalizeEnum(config.apiKeyIn || "header", ["header", "query", "body"], "header"),
        headers: normalizeKeyValueList(config.headers || config.defaultHeaders),
        timeoutMs: clampNumber(config.timeoutMs, 1e3, 12e4, 3e4)
      };
    }
    function normalizeApiSourceConfig(rawConfig = {}, sourceObject = "") {
      const endpointPath = String(rawConfig.endpointPath || rawConfig.path || sourceObject || "/").trim() || "/";
      const pagination = rawConfig.pagination || {};
      const incremental = rawConfig.incremental || {};
      return {
        rowAdapter: String(rawConfig.rowAdapter || "").trim(),
        endpointPath,
        method: normalizeHttpMethod(rawConfig.method),
        contentType: normalizeEnum(rawConfig.contentType || "application/json", ["application/json", "application/x-www-form-urlencoded", "text/plain"], "application/json"),
        auth: normalizeApiAuthConfig(rawConfig.auth || rawConfig.authentication || {}),
        headers: normalizeKeyValueList(rawConfig.headers),
        queryParams: normalizeKeyValueList(rawConfig.queryParams),
        bodyParams: normalizeKeyValueList(rawConfig.bodyParams),
        bodyTemplate: rawConfig.bodyTemplate === void 0 ? "" : String(rawConfig.bodyTemplate || ""),
        bodyType: normalizeEnum(rawConfig.bodyType || "json", ["json", "form", "text", "none"], "json"),
        includeMetadata: rawConfig.includeMetadata !== false,
        parameterDataSet: normalizeParameterDataSetConfig(rawConfig.parameterDataSet || rawConfig.parameterDataset || {}),
        rateLimit: {
          requestIntervalMs: clampNumber(rawConfig.rateLimit?.requestIntervalMs, 0, 6e4, 0),
          maxRequestsPerRun: clampNumber(rawConfig.rateLimit?.maxRequestsPerRun, 1, 1e4, 1e3)
        },
        pagination: {
          type: normalizeEnum(pagination.type || "none", ["none", "page", "offset", "cursor"], "none"),
          injectInto: normalizeEnum(pagination.injectInto || "query", ["query", "header", "body"], "query"),
          pageParam: String(pagination.pageParam || "page"),
          pageSizeParam: String(pagination.pageSizeParam || "pageSize"),
          offsetParam: String(pagination.offsetParam || "offset"),
          limitParam: String(pagination.limitParam || "limit"),
          cursorParam: String(pagination.cursorParam || "cursor"),
          pageSize: clampNumber(pagination.pageSize, 1, 5e3, 100),
          startPage: clampNumber(pagination.startPage, 0, 1e6, 1),
          startOffset: clampNumber(pagination.startOffset, 0, 1e9, 0),
          maxPages: clampNumber(pagination.maxPages, 1, 1e3, 100),
          nextCursorPath: String(pagination.nextCursorPath || ""),
          stopWhenEmpty: pagination.stopWhenEmpty !== false
        },
        incremental: {
          enabled: Boolean(incremental.enabled),
          cursorField: String(incremental.cursorField || ""),
          startParam: String(incremental.startParam || "startTime"),
          endParam: String(incremental.endParam || "endTime"),
          injectInto: normalizeEnum(incremental.injectInto || "query", ["query", "header", "body"], "query"),
          startValue: incremental.startValue === void 0 ? "" : String(incremental.startValue || "")
        }
      };
    }
    function normalizeApiParseConfig(rawConfig = {}) {
      const recordPath = rawConfig.recordPath !== void 0 ? rawConfig.recordPath : rawConfig.jsonRootPath !== void 0 ? rawConfig.jsonRootPath : "data";
      return {
        responseFormat: normalizeEnum(rawConfig.responseFormat || "json", ["json", "text"], "json"),
        recordPath: String(recordPath).trim(),
        flattenJson: rawConfig.flattenJson !== false,
        keepRawResponse: Boolean(rawConfig.keepRawResponse),
        skipErrorRows: rawConfig.skipErrorRows !== false
      };
    }
    function normalizeApiErrorConfig(rawConfig = {}) {
      return {
        successStatusCodes: normalizeStatusCodes(rawConfig.successStatusCodes, [200]),
        retryStatusCodes: normalizeStatusCodes(rawConfig.retryStatusCodes, [429, 500, 502, 503, 504]),
        maxRetries: clampNumber(rawConfig.maxRetries, 0, 10, 2),
        retryIntervalMs: clampNumber(rawConfig.retryIntervalMs, 500, 6e4, 2e3)
      };
    }
    async function testApiConnection(connectionConfig = {}, options = {}) {
      const config = normalizeApiConnectionConfig(connectionConfig);
      if (!config.baseUrl) {
        return { success: false, message: "\u7F3A\u5C11 API Base URL" };
      }
      const baseReachability = await probeApiReachability(config.baseUrl, config.timeoutMs);
      if (!baseReachability.success) {
        return {
          success: false,
          message: "API Base URL \u8FDE\u901A\u6027\u6D4B\u8BD5\u5931\u8D25",
          error: baseReachability.error
        };
      }
      return {
        success: true,
        message: `API \u5730\u5740\u53EF\u8BBF\u95EE\uFF0C\u72B6\u6001\u7801 ${baseReachability.statusCode}\uFF0C\u8017\u65F6 ${baseReachability.durationMs}ms\uFF1B\u5177\u4F53\u63A5\u53E3\u8BF7\u5728\u63A5\u5165\u4EFB\u52A1\u4E2D\u914D\u7F6E\u5E76\u6D4B\u8BD5\u3002`
      };
    }
    async function probeApiReachability(baseUrl, timeoutMs) {
      try {
        const startedAt = Date.now();
        const response = await fetchWithTimeout(baseUrl, {
          method: "HEAD",
          timeoutMs
        });
        return {
          success: true,
          statusCode: response.status,
          durationMs: Date.now() - startedAt
        };
      } catch (error) {
        if (!isHeadUnsupportedError(error)) {
          return {
            success: false,
            error: error.message
          };
        }
        try {
          const startedAt = Date.now();
          const response = await fetchWithTimeout(baseUrl, {
            method: "GET",
            timeoutMs
          });
          return {
            success: true,
            statusCode: response.status,
            durationMs: Date.now() - startedAt
          };
        } catch (fallbackError) {
          return {
            success: false,
            error: fallbackError.message
          };
        }
      }
    }
    async function fetchWithTimeout(url, { method, timeoutMs }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, {
          method,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }
    }
    function isHeadUnsupportedError(error) {
      const message = String(error?.message || "");
      return /405|method|HEAD/i.test(message);
    }
    async function sampleApiRows(dataSource, objectName, options = {}) {
      const connectionConfig = normalizeApiConnectionConfig(dataSource?.connectionConfig || {});
      const sourceConfig = normalizeApiSourceConfig(options.sourceConfig || {}, objectName || connectionConfig.defaultPath);
      const parseConfig = normalizeApiParseConfig(options.parseConfig || {});
      const errorConfig = normalizeApiErrorConfig(options.errorConfig || {});
      const limit = clampNumber(options.limit, 1, 100, 20);
      const result = await collectApiRows({
        task: { id: 0, taskCode: "preview", sourceTable: objectName },
        connectionConfig,
        sourceConfig: {
          ...sourceConfig,
          pagination: { ...sourceConfig.pagination, maxPages: 1 },
          rateLimit: { ...sourceConfig.rateLimit, maxRequestsPerRun: 1 }
        },
        parseConfig,
        errorConfig,
        state: null,
        limit
      });
      return result.rows.slice(0, limit);
    }
    async function collectApiRows({ task, connectionConfig, sourceConfig, parseConfig, errorConfig, state, limit = null }) {
      const safeConnectionConfig = normalizeApiConnectionConfig(connectionConfig || {});
      const safeSourceConfig = normalizeApiSourceConfig(sourceConfig || {}, task?.sourceTable || "");
      const safeParseConfig = normalizeApiParseConfig(parseConfig || {});
      const safeErrorConfig = normalizeApiErrorConfig(errorConfig || {});
      if (!safeConnectionConfig.baseUrl) {
        throw new AppError("API \u6570\u636E\u6E90\u7F3A\u5C11 Base URL", 400);
      }
      if (!safeSourceConfig.endpointPath) {
        throw new AppError("API \u63A5\u5165\u4EFB\u52A1\u7F3A\u5C11\u63A5\u53E3\u8DEF\u5F84", 400);
      }
      const rows = [];
      const pageResults = [];
      const maxRecords = limit || safeSourceConfig.pagination.pageSize * safeSourceConfig.pagination.maxPages;
      let lastCursorValue = state?.lastCursorValue || safeSourceConfig.incremental.startValue || "";
      let lastPage = safeSourceConfig.pagination.startPage;
      let lastOffset = safeSourceConfig.pagination.startOffset;
      let lastNextCursor = "";
      const parameterRows = await loadParameterDataSetRows(safeSourceConfig.parameterDataSet, task);
      const parameterContexts = buildParameterContexts(parameterRows, safeSourceConfig.parameterDataSet);
      for (const parameterContext of parameterContexts) {
        if (rows.length >= maxRecords) break;
        const paginationState = createInitialPaginationState(safeSourceConfig.pagination, state);
        let nextCursor = paginationState.cursor;
        for (let pageIndex = 0; pageIndex < safeSourceConfig.pagination.maxPages; pageIndex += 1) {
          if (pageIndex >= safeSourceConfig.rateLimit.maxRequestsPerRun || rows.length >= maxRecords) break;
          const context = buildVariableContext({
            task,
            state,
            page: paginationState.page,
            offset: paginationState.offset,
            limit: safeSourceConfig.pagination.pageSize,
            cursor: nextCursor,
            lastCursor: lastCursorValue,
            parameterContext
          });
          const result = await fetchApiPage({
            connectionConfig: safeConnectionConfig,
            sourceConfig: safeSourceConfig,
            parseConfig: safeParseConfig,
            errorConfig: safeErrorConfig,
            context
          });
          const parsedRows = parseApiResponseRows(result, safeParseConfig, safeSourceConfig, {
            page: paginationState.page,
            offset: paginationState.offset,
            cursor: nextCursor
          });
          rows.push(...parsedRows.slice(0, Math.max(0, maxRecords - rows.length)));
          pageResults.push({
            statusCode: result.statusCode,
            durationMs: result.durationMs,
            records: parsedRows.length,
            page: paginationState.page,
            offset: paginationState.offset,
            cursor: nextCursor || null,
            parameterIndex: parameterContext?.datasetIndex ?? null
          });
          const cursorCandidate = safeSourceConfig.pagination.nextCursorPath ? getByPath(result.payload, safeSourceConfig.pagination.nextCursorPath) : null;
          nextCursor = cursorCandidate === void 0 || cursorCandidate === null ? "" : String(cursorCandidate);
          lastPage = paginationState.page;
          lastOffset = paginationState.offset;
          lastNextCursor = nextCursor || "";
          if (safeSourceConfig.pagination.type === "none") break;
          if (safeSourceConfig.pagination.stopWhenEmpty && parsedRows.length === 0) break;
          if (safeSourceConfig.pagination.type === "cursor" && !nextCursor) break;
          if (parsedRows.length < safeSourceConfig.pagination.pageSize && safeSourceConfig.pagination.type !== "cursor") break;
          paginationState.page += 1;
          paginationState.offset += safeSourceConfig.pagination.pageSize;
          if (safeSourceConfig.rateLimit.requestIntervalMs > 0) {
            await delay(safeSourceConfig.rateLimit.requestIntervalMs);
          }
        }
      }
      if (safeSourceConfig.incremental.enabled && safeSourceConfig.incremental.cursorField) {
        lastCursorValue = resolveMaxCursor(rows, safeSourceConfig.incremental.cursorField) || lastCursorValue;
      }
      return {
        rows,
        state: {
          stateKey: "default",
          lastCursorValue: lastCursorValue || null,
          lastPage,
          lastOffset,
          lastNextCursor: lastNextCursor || null,
          lastSuccessTime: (/* @__PURE__ */ new Date()).toISOString()
        },
        pageResults
      };
    }
    function normalizeParameterDataSetConfig(value = {}) {
      return {
        enabled: Boolean(value.enabled),
        sourceId: Number(value.sourceId || value.dataSourceId || 0) || null,
        sql: String(value.sql || value.query || "").trim(),
        limit: clampNumber(value.limit || value.maxRows, 1, 500, 20),
        mode: normalizeEnum(value.mode || "loop", ["loop", "bulk"], "loop"),
        payloadKey: String(value.payloadKey || "items").trim() || "items"
      };
    }
    async function loadParameterDataSetRows(parameterDataSet, task = {}) {
      if (!parameterDataSet?.enabled) return [];
      if (!parameterDataSet.sourceId) {
        throw new AppError("SQL \u53C2\u6570\u96C6\u7F3A\u5C11\u53C2\u6570\u6765\u6E90\u5E93", 400);
      }
      if (!parameterDataSet.sql) {
        throw new AppError("SQL \u53C2\u6570\u96C6\u7F3A\u5C11\u67E5\u8BE2\u8BED\u53E5", 400);
      }
      const safeSql = normalizeReadOnlySql(parameterDataSet.sql);
      const projectWhere = task?.projectId ? " AND project_id = ?" : "";
      const [sourceRows] = await pool.query(
        `SELECT id, source_name AS sourceName, source_type AS sourceType, connection_config AS connectionConfig
     FROM ingestion_data_sources
     WHERE id = ?${projectWhere}`,
        task?.projectId ? [parameterDataSet.sourceId, task.projectId] : [parameterDataSet.sourceId]
      );
      const source = sourceRows[0];
      if (!source) {
        throw new AppError("SQL \u53C2\u6570\u96C6\u6765\u6E90\u5E93\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u9879\u76EE", 404);
      }
      const connectionConfig = parseConnectionConfig(source.connectionConfig);
      const dialect = inferDatasourceDialect(source.sourceType, connectionConfig);
      if (!["mysql", "postgresql"].includes(dialect)) {
        throw new AppError("SQL \u53C2\u6570\u96C6\u5F53\u524D\u4EC5\u652F\u6301 MySQL\u3001PostgreSQL \u548C GaussDB \u6570\u636E\u6E90", 400);
      }
      return queryParameterDataSetRows({
        sourceType: source.sourceType,
        dialect,
        connectionConfig,
        sql: safeSql,
        limit: parameterDataSet.limit
      });
    }
    function normalizeReadOnlySql(sql) {
      const normalized = String(sql || "").trim().replace(/;+$/g, "").trim();
      if (!/^(select|with)\b/i.test(normalized)) {
        throw new AppError("SQL \u53C2\u6570\u96C6\u53EA\u5141\u8BB8\u6267\u884C SELECT \u6216 WITH \u67E5\u8BE2", 400);
      }
      if (normalized.includes(";")) {
        throw new AppError("SQL \u53C2\u6570\u96C6\u4E0D\u5141\u8BB8\u5305\u542B\u591A\u6761 SQL", 400);
      }
      return normalized;
    }
    async function queryParameterDataSetRows({ sourceType, dialect, connectionConfig, sql, limit }) {
      const limitedSql = `SELECT * FROM (${sql}) AS medata_api_param_dataset LIMIT ${Number(limit)}`;
      const resolved = resolveDatasourceConnection(sourceType, connectionConfig || {});
      if (dialect === "mysql") {
        const connection = await mysql.createConnection({
          host: resolved.host,
          port: Number(resolved.port || 3306),
          database: resolved.database,
          user: resolved.username,
          password: resolved.password,
          connectTimeout: 8e3
        });
        try {
          const [rows] = await connection.query(limitedSql);
          return normalizeParameterRows(rows);
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
        connectionTimeoutMillis: 8e3
      }, {
        sourceType
      });
      await client.connect();
      try {
        const result = await client.query(limitedSql);
        return normalizeParameterRows(result.rows || []);
      } finally {
        await client.end();
      }
    }
    function normalizeParameterRows(rows = []) {
      return (Array.isArray(rows) ? rows : []).map((row) => Object.fromEntries(
        Object.entries(row || {}).map(([key, value]) => [key, normalizeParameterValue(value)])
      ));
    }
    function normalizeParameterValue(value) {
      if (value instanceof Date) return value.toISOString();
      if (Buffer.isBuffer(value)) return value.toString("utf8");
      return value;
    }
    function buildParameterContexts(rows = [], parameterDataSet = {}) {
      const parameterRows = Array.isArray(rows) ? rows : [];
      if (!parameterDataSet?.enabled || parameterRows.length === 0) {
        return [{}];
      }
      const payloadKey = String(parameterDataSet.payloadKey || "items").trim() || "items";
      if (parameterDataSet.mode === "bulk") {
        return [buildParameterContext({
          datasetIndex: 0,
          row: null,
          rows: parameterRows,
          payloadKey,
          mode: "bulk"
        })];
      }
      return parameterRows.map((row, index) => buildParameterContext({
        datasetIndex: index,
        row,
        rows: parameterRows,
        payloadKey,
        mode: "loop"
      }));
    }
    function buildParameterContext({ datasetIndex, row, rows, payloadKey, mode }) {
      const dataset = {
        mode,
        index: datasetIndex,
        count: rows.length,
        row: row || {},
        rows,
        [payloadKey]: rows
      };
      const context = {
        dataset,
        datasetIndex,
        "dataset.mode": mode,
        "dataset.index": datasetIndex,
        "dataset.count": rows.length,
        "dataset.row": row || {},
        "dataset.rows": rows,
        [`dataset.${payloadKey}`]: rows
      };
      if (row && typeof row === "object") {
        Object.entries(row).forEach(([key, value]) => {
          context[`dataset.${key}`] = value;
          context[`dataset.row.${key}`] = value;
        });
      }
      return context;
    }
    function parseConnectionConfig(value) {
      if (typeof value === "string") {
        try {
          return JSON.parse(value) || {};
        } catch (error) {
          return {};
        }
      }
      return value || {};
    }
    function inferApiColumns(rows = []) {
      const fields = /* @__PURE__ */ new Map();
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        Object.entries(row).forEach(([key, value]) => {
          const current = fields.get(key) || { values: [], nullable: false };
          if (value === null || value === void 0 || value === "") current.nullable = true;
          if (current.values.length < 20) current.values.push(value);
          fields.set(key, current);
        });
      }
      return [...fields.entries()].map(([columnName, meta], index) => ({
        columnName,
        ordinalPosition: index + 1,
        dataType: inferSampleType(meta.values),
        columnType: inferSampleType(meta.values),
        isNullable: meta.nullable,
        isPrimaryKey: false,
        columnComment: ""
      }));
    }
    function fetchApiPage({ connectionConfig, sourceConfig, parseConfig, errorConfig, context }) {
      return fetchApiPageWithRetry({ connectionConfig, sourceConfig, parseConfig, errorConfig, context });
    }
    async function fetchApiPageWithRetry({ connectionConfig, sourceConfig, parseConfig, errorConfig, context }) {
      let lastError = null;
      for (let attempt = 0; attempt <= errorConfig.maxRetries; attempt += 1) {
        const startedAt = Date.now();
        try {
          const request = buildRequest(connectionConfig, sourceConfig, context);
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), connectionConfig.timeoutMs);
          const response = await fetch(request.url, {
            method: request.method,
            headers: request.headers,
            body: request.body,
            signal: controller.signal
          });
          clearTimeout(timer);
          const text = await response.text();
          const durationMs = Date.now() - startedAt;
          if (!errorConfig.successStatusCodes.includes(response.status)) {
            const message = `API \u8BF7\u6C42\u8FD4\u56DE\u5F02\u5E38\u72B6\u6001\u7801 ${response.status}`;
            if (errorConfig.retryStatusCodes.includes(response.status) && attempt < errorConfig.maxRetries) {
              await delay(errorConfig.retryIntervalMs);
              continue;
            }
            throw new AppError(message, 400, { statusCode: response.status, responseText: truncateText(text) });
          }
          return {
            statusCode: response.status,
            durationMs,
            payload: parseConfig.responseFormat === "json" && text ? JSON.parse(text) : text,
            responseText: text,
            requestInfo: sanitizeRequestInfo(request)
          };
        } catch (error) {
          lastError = error;
          if (attempt < errorConfig.maxRetries) {
            await delay(errorConfig.retryIntervalMs);
            continue;
          }
        }
      }
      throw lastError;
    }
    function buildRequest(connectionConfig, sourceConfig, context) {
      const url = new URL(resolveApiUrl(connectionConfig.baseUrl, sourceConfig.endpointPath));
      const headers = {};
      applyKeyValueList(headers, connectionConfig.headers, context);
      applyKeyValueList(headers, sourceConfig.headers, context);
      const bodyValues = {};
      applyParams(url, headers, bodyValues, sourceConfig.queryParams, "query", context);
      applyParams(url, headers, bodyValues, sourceConfig.bodyParams, "body", context);
      applyAuth(url, headers, bodyValues, resolveRequestAuthConfig(connectionConfig, sourceConfig), context);
      applyPaging(url, headers, bodyValues, sourceConfig.pagination, context);
      let body = null;
      if (!["GET"].includes(sourceConfig.method) && sourceConfig.bodyType !== "none") {
        if (sourceConfig.bodyTemplate) {
          body = renderTemplate(sourceConfig.bodyTemplate, context);
        } else if (sourceConfig.bodyType === "form") {
          const form = new URLSearchParams();
          Object.entries(bodyValues).forEach(([key, value]) => form.set(key, value));
          body = form.toString();
          headers["Content-Type"] = "application/x-www-form-urlencoded";
        } else if (sourceConfig.bodyType === "text") {
          body = Object.values(bodyValues).join("\n");
          headers["Content-Type"] = "text/plain";
        } else {
          body = JSON.stringify(bodyValues);
          headers["Content-Type"] = sourceConfig.contentType;
        }
      }
      return { url: url.toString(), method: sourceConfig.method, headers, body };
    }
    function resolveApiUrl(baseUrl, endpointPath) {
      const path = String(endpointPath || "").trim();
      if (/^https?:\/\//i.test(path)) return path;
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      return `${baseUrl}${normalizedPath}`;
    }
    function applyAuth(url, headers, bodyValues, connectionConfig, context) {
      if (connectionConfig.authType === "basic") {
        const token = Buffer.from(`${connectionConfig.username}:${connectionConfig.password}`).toString("base64");
        headers.Authorization = `Basic ${token}`;
        return;
      }
      if (connectionConfig.authType === "bearer" && connectionConfig.bearerToken) {
        headers.Authorization = `Bearer ${renderTemplate(connectionConfig.bearerToken, context)}`;
        return;
      }
      if (connectionConfig.authType === "api_key" && connectionConfig.apiKeyName && connectionConfig.apiKeyValue) {
        const value = renderTemplate(connectionConfig.apiKeyValue, context);
        if (connectionConfig.apiKeyIn === "query") url.searchParams.set(connectionConfig.apiKeyName, value);
        else if (connectionConfig.apiKeyIn === "body") bodyValues[connectionConfig.apiKeyName] = value;
        else headers[connectionConfig.apiKeyName] = value;
      }
    }
    function resolveRequestAuthConfig(connectionConfig, sourceConfig) {
      const taskAuth = normalizeApiAuthConfig(sourceConfig?.auth || {});
      if (taskAuth.authType !== "none") {
        return taskAuth;
      }
      return connectionConfig;
    }
    function applyPaging(url, headers, bodyValues, pagination, context) {
      if (!pagination || pagination.type === "none") return;
      if (pagination.type === "page") {
        setParamByLocation(url, headers, bodyValues, pagination.injectInto, pagination.pageParam, String(context.page));
        setParamByLocation(url, headers, bodyValues, pagination.injectInto, pagination.pageSizeParam, String(pagination.pageSize));
      } else if (pagination.type === "offset") {
        setParamByLocation(url, headers, bodyValues, pagination.injectInto, pagination.offsetParam, String(context.offset));
        setParamByLocation(url, headers, bodyValues, pagination.injectInto, pagination.limitParam, String(pagination.pageSize));
      } else if (pagination.type === "cursor") {
        if (context.cursor) setParamByLocation(url, headers, bodyValues, pagination.injectInto, pagination.cursorParam, String(context.cursor));
        setParamByLocation(url, headers, bodyValues, pagination.injectInto, pagination.pageSizeParam, String(pagination.pageSize));
      }
    }
    function applyParams(url, headers, bodyValues, params, defaultLocation, context) {
      for (const item of params || []) {
        if (!item || item.enabled === false) continue;
        const name = String(item.name || item.key || "").trim();
        if (!name) continue;
        const value = resolveParamValue(item, context);
        setParamByLocation(url, headers, bodyValues, item.in || item.location || defaultLocation, name, value);
      }
    }
    function setParamByLocation(url, headers, bodyValues, location, name, value) {
      const normalized = String(location || "query").toLowerCase();
      const scalarValue = Array.isArray(value) || value && typeof value === "object" ? JSON.stringify(value) : value;
      if (normalized === "header") headers[name] = scalarValue;
      else if (normalized === "body") bodyValues[name] = value;
      else url.searchParams.set(name, scalarValue);
    }
    function resolveParamValue(item, context) {
      const mode = normalizeEnum(item?.valueMode || "custom", ["custom", "system", "dataset", "checkpoint"], "custom");
      if (mode === "system") {
        return resolveSystemParamValue(item);
      }
      if (mode === "dataset") {
        const field = String(item?.datasetField || "").trim();
        if (!field) return "";
        return context[`dataset.${field}`] ?? getByPath(context, `dataset.row.${field}`) ?? "";
      }
      if (mode === "checkpoint") {
        return resolveCheckpointParamValue(item, context);
      }
      return renderTemplate(item?.value ?? "", context);
    }
    function resolveCheckpointParamValue(item, context) {
      const key = String(item?.checkpointKey || "last_cursor");
      if (key === "last_success_time") {
        return context["state.last_success_time"] || context.last_success_time || "";
      }
      return context["state.last_cursor"] || context.last_cursor || "";
    }
    function resolveSystemParamValue(item) {
      const key = String(item?.systemKey || "now");
      if (key === "value_range") {
        const start = Number(item?.rangeStart ?? 0);
        const end = Number(item?.rangeEnd ?? start);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        return String(Math.floor(min + Math.random() * (max - min + 1)));
      }
      let date = /* @__PURE__ */ new Date();
      if (key === "today") date = /* @__PURE__ */ new Date(`${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}T00:00:00.000Z`);
      if (key === "yesterday") date = new Date(Date.now() - 24 * 60 * 60 * 1e3);
      date = applyDateOffset(date, Number(item?.systemOffsetAmount || 0), item?.systemOffsetUnit || "day");
      return formatSystemDateValue(date, item?.systemFormat, key);
    }
    function applyDateOffset(date, amount, unit) {
      if (!Number.isFinite(amount) || amount === 0) return date;
      const next = new Date(date.getTime());
      const normalized = String(unit || "day");
      if (normalized === "minute") next.setMinutes(next.getMinutes() + amount);
      else if (normalized === "hour") next.setHours(next.getHours() + amount);
      else if (normalized === "month") next.setMonth(next.getMonth() + amount);
      else next.setDate(next.getDate() + amount);
      return next;
    }
    function formatSystemDateValue(date, format, key) {
      const pad = (value) => String(value).padStart(2, "0");
      const year = date.getFullYear();
      const month = pad(date.getMonth() + 1);
      const day = pad(date.getDate());
      const hour = pad(date.getHours());
      const minute = pad(date.getMinutes());
      const second = pad(date.getSeconds());
      const normalized = String(format || "").trim();
      if (normalized === "timestamp_ms" || key === "timestamp") return String(date.getTime());
      if (normalized === "timestamp_s") return String(Math.floor(date.getTime() / 1e3));
      if (normalized === "YYYY-MM-DD") return `${year}-${month}-${day}`;
      if (normalized === "YYYY-MM-DD HH:mm:ss") return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
      if (normalized === "YYYYMMDD") return `${year}${month}${day}`;
      return date.toISOString();
    }
    function parseApiResponseRows(result, parseConfig, sourceConfig, pageState) {
      if (parseConfig.responseFormat === "text") {
        return [{ value: String(result.responseText || ""), ...buildMetadata(sourceConfig, result, pageState) }];
      }
      const resolved = parseConfig.recordPath ? getByPath(result.payload, parseConfig.recordPath) : result.payload;
      const items = Array.isArray(resolved) ? resolved : resolved ? [resolved] : [];
      return items.filter((item) => item !== null && item !== void 0).map((item) => {
        const row = item && typeof item === "object" && !Array.isArray(item) ? parseConfig.flattenJson ? flattenObject(item) : item : { value: item };
        return {
          ...row,
          ...parseConfig.keepRawResponse ? { _raw_response: result.responseText } : {},
          ...buildMetadata(sourceConfig, result, pageState)
        };
      });
    }
    function buildMetadata(sourceConfig, result, pageState) {
      if (sourceConfig.includeMetadata === false) return {};
      return {
        _api_status: result.statusCode,
        _api_page: pageState.page ?? null,
        _api_offset: pageState.offset ?? null,
        _api_cursor: pageState.cursor ?? null,
        _api_request_time: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    function createInitialPaginationState(pagination) {
      return {
        page: Number(pagination.startPage || 1),
        offset: Number(pagination.startOffset || 0),
        cursor: ""
      };
    }
    function buildVariableContext({ task = {}, state = {}, page = 1, offset = 0, limit = 100, cursor = "", lastCursor = "", parameterContext = {} }) {
      const now = /* @__PURE__ */ new Date();
      const today = now.toISOString().slice(0, 10);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1e3).toISOString().slice(0, 10);
      return {
        now: now.toISOString(),
        today,
        yesterday,
        "sys.now": now.toISOString(),
        "sys.today": today,
        "sys.yesterday": yesterday,
        "run.page": page,
        "run.offset": offset,
        "run.limit": limit,
        "run.cursor": cursor || "",
        "state.last_cursor": lastCursor || state?.lastCursorValue || "",
        "state.last_success_time": state?.lastSuccessTime || "",
        "task.code": task?.taskCode || "",
        "task.project_id": task?.projectId || "",
        page,
        offset,
        limit,
        cursor: cursor || "",
        last_cursor: lastCursor || state?.lastCursorValue || "",
        last_success_time: state?.lastSuccessTime || "",
        task_code: task?.taskCode || "",
        project_id: task?.projectId || "",
        ...parameterContext || {}
      };
    }
    function renderTemplate(value, context) {
      return String(value ?? "").replace(/\$\{([a-zA-Z0-9_.]+)\}/g, (_match, key) => {
        const next = context[key] !== void 0 ? context[key] : getByPath(context, key);
        if (Array.isArray(next) || next && typeof next === "object") return JSON.stringify(next);
        return next === void 0 || next === null ? "" : String(next);
      });
    }
    function getByPath(value, path) {
      const parts = String(path || "").replace(/^\$\./, "").split(".").map((item) => item.trim()).filter(Boolean);
      if (!parts.length) return value;
      return parts.reduce((current, part) => {
        if (current === null || current === void 0) return void 0;
        if (Array.isArray(current) && /^\d+$/.test(part)) return current[Number(part)];
        return typeof current === "object" ? current[part] : void 0;
      }, value);
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
    function resolveMaxCursor(rows, cursorField) {
      const values = rows.map((row) => row?.[cursorField]).filter((value) => value !== void 0 && value !== null && value !== "");
      if (!values.length) return null;
      return values.map((value) => String(value)).sort().at(-1);
    }
    function normalizeKeyValueList(value) {
      if (Array.isArray(value)) {
        return value.map((item) => ({
          name: String(item?.name || item?.key || "").trim(),
          value: item?.value === void 0 ? "" : String(item.value),
          in: item?.in || item?.location,
          enabled: item?.enabled !== false,
          valueMode: normalizeEnum(item?.valueMode || "custom", ["custom", "system", "dataset", "checkpoint"], "custom"),
          systemKey: String(item?.systemKey || ""),
          checkpointKey: normalizeEnum(item?.checkpointKey || "last_cursor", ["last_cursor", "last_success_time"], "last_cursor"),
          systemFormat: String(item?.systemFormat || ""),
          systemOffsetAmount: Number(item?.systemOffsetAmount || 0) || 0,
          systemOffsetUnit: normalizeEnum(item?.systemOffsetUnit || "day", ["minute", "hour", "day", "month"], "day"),
          rangeStart: item?.rangeStart,
          rangeEnd: item?.rangeEnd,
          datasetField: String(item?.datasetField || "")
        })).filter((item) => item.name);
      }
      if (value && typeof value === "object") {
        return Object.entries(value).map(([name, itemValue]) => ({ name, value: String(itemValue ?? ""), enabled: true }));
      }
      return [];
    }
    function normalizeApiAuthConfig(value = {}) {
      const authType = normalizeEnum(value.authType || value.type || "none", ["none", "basic", "bearer", "api_key"], "none");
      return {
        authType,
        bearerToken: String(value.bearerToken || value.token || value.value || ""),
        username: String(value.username || value.user || ""),
        password: String(value.password || ""),
        apiKeyName: String(value.apiKeyName || value.name || "x-api-key"),
        apiKeyValue: String(value.apiKeyValue || value.apiKey || value.value || ""),
        apiKeyIn: normalizeEnum(value.apiKeyIn || value.in || "header", ["header", "query", "body"], "header")
      };
    }
    function applyKeyValueList(headers, entries, context) {
      for (const item of entries || []) {
        if (!item || item.enabled === false || !item.name) continue;
        const value = resolveParamValue(item, context);
        headers[item.name] = Array.isArray(value) || value && typeof value === "object" ? JSON.stringify(value) : value;
      }
    }
    function normalizeStatusCodes(value, fallback) {
      if (!Array.isArray(value)) return fallback;
      const result = value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 100 && item <= 599);
      return result.length ? result : fallback;
    }
    function normalizeEnum(value, allowed, fallback) {
      const normalized = String(value || "").trim().toLowerCase();
      return allowed.includes(normalized) ? normalized : fallback;
    }
    function normalizeHttpMethod(value) {
      return normalizeEnum(value || "GET", ["get", "post", "put", "patch"], "get").toUpperCase();
    }
    function clampNumber(value, min, max, fallback) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return fallback;
      return Math.max(min, Math.min(max, numeric));
    }
    function inferSampleType(values = []) {
      const nonEmpty = values.filter((value) => value !== null && value !== void 0 && value !== "");
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
    function sanitizeRequestInfo(request) {
      return {
        url: request.url.replace(/([?&][^=]*(token|secret|password|api[_-]?key|access[_-]?key)[^=]*=)[^&]*/ig, "$1******"),
        method: request.method,
        headers: Object.fromEntries(Object.entries(request.headers || {}).map(([key, value]) => [
          key,
          SENSITIVE_KEY_PATTERN.test(key) ? "******" : value
        ]))
      };
    }
    function truncateText(value, maxLength = 1e3) {
      const text = String(value || "");
      return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
    }
    function delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    module2.exports = {
      collectApiRows,
      inferApiColumns,
      normalizeApiConnectionConfig,
      normalizeApiErrorConfig,
      normalizeApiParseConfig,
      normalizeApiSourceConfig,
      sampleApiRows,
      testApiConnection,
      sanitizeRequestInfo
    };
  }
});

// backend/src/modules/data-sources/data-source.test-connection.js
var require_data_source_test_connection = __commonJS({
  "backend/src/modules/data-sources/data-source.test-connection.js"(exports2, module2) {
    var net = require("net");
    var ftp = require("basic-ftp");
    var { Kafka, logLevel } = require("kafkajs");
    var {
      normalizeDatasourceType,
      parseJdbcUrl,
      resolveDatasourceConnection
    } = require_datasource_dialect();
    var apiIngestionService = require_apiIngestionService();
    var { getAdapter } = require_adapters();
    async function testDatabaseConnection(config, sourceType) {
      const normalizedType = normalizeDatasourceType(sourceType);
      const resolved = resolveDatasourceConnection(sourceType, config || {});
      const { host, port, database, username, password, dialect } = resolved;
      if (!["kafka", "api"].includes(dialect) && (!host || !port)) {
        return {
          success: false,
          message: "\u7F3A\u5C11\u5FC5\u8981\u7684\u8FDE\u63A5\u53C2\u6570"
        };
      }
      if (["mysql", "postgresql", "oracle", "dm"].includes(dialect) && !username) {
        return {
          success: false,
          message: "\u7F3A\u5C11\u5FC5\u8981\u7684\u8FDE\u63A5\u53C2\u6570"
        };
      }
      try {
        switch (dialect) {
          case "mysql":
          case "postgresql":
          case "oracle":
          case "dm":
            return await getAdapter(dialect).testConnection({ ...config, sourceType: dialect, databaseName: database });
          case "hive":
            return await testTcpConnection(host, port, `Hive \u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F ${host}:${port}${database ? `/${database}` : ""}`);
          case "kafka":
            return await testKafkaConnection(config, host, port);
          case "ftp":
            return await testFtpConnection(config, host, port, username, password);
          case "api":
            return await apiIngestionService.testApiConnection(config);
          case "clickhouse":
            return await testTcpConnection(host, port, `ClickHouse \u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F ${host}:${port}${database ? `/${database}` : ""}`);
          default:
            if (normalizedType === "jdbc") {
              const jdbcMeta = parseJdbcUrl(config?.jdbcUrl || config?.url || config?.connectionString);
              const targetLabel = jdbcMeta?.vendor ? `JDBC(${jdbcMeta.vendor})` : "JDBC";
              return await testTcpConnection(host, port, `${targetLabel} \u57FA\u7840\u8FDE\u901A\u6027\u6D4B\u8BD5\u6210\u529F ${host}:${port}${database ? `/${database}` : ""}`);
            }
            return {
              success: true,
              message: `${sourceType} \u7C7B\u578B\u7684\u6570\u636E\u6E90\u6682\u4E0D\u652F\u6301\u81EA\u52A8\u8FDE\u901A\u6027\u6821\u9A8C\uFF0C\u5DF2\u8DF3\u8FC7`
            };
        }
      } catch (error) {
        const friendlyMessage = normalizeDatabaseConnectionError(error, dialect);
        return {
          success: false,
          message: friendlyMessage,
          error: error.message
        };
      }
    }
    function normalizeDatabaseConnectionError(error, dialect) {
      const message = String(error?.message || "").trim();
      if (/cannot find module|module not found/i.test(message)) return "\u6570\u636E\u5E93\u9A71\u52A8\u672A\u5B89\u88C5";
      if (/ORA-01017|invalid username\/password|密码错误|用户名或密码错误/i.test(message)) return "\u6570\u636E\u5E93\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF";
      if (/ORA-12514|ORA-12505|service.*not known|listener.*service/i.test(message)) return "Oracle Service Name \u6216 SID \u4E0D\u5B58\u5728";
      if (/ORA-12170|connect timeout|connection timeout|连接超时/i.test(message)) return "\u6570\u636E\u5E93\u8FDE\u63A5\u8D85\u65F6";
      if (/ECONNREFUSED|network.*error|socket.*error|网络通信异常/i.test(message)) return "\u6570\u636E\u5E93\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25";
      if (/permission|privilege|ORA-01031|没有权限|权限不足/i.test(message)) return "\u5F53\u524D\u7528\u6237\u6CA1\u6709\u6240\u9700\u7684\u6570\u636E\u5E93\u6743\u9650";
      const label = dialect === "oracle" ? "Oracle" : dialect === "dm" ? "\u8FBE\u68A6\u6570\u636E\u5E93" : "\u6570\u636E\u5E93";
      return `${label} \u8FDE\u63A5\u6D4B\u8BD5\u5931\u8D25${message ? `\uFF1A${message}` : ""}`;
    }
    async function testFtpConnection(config, host, port, username, password) {
      if (!username) {
        return { success: false, message: "\u7F3A\u5C11\u5FC5\u8981\u7684\u8FDE\u63A5\u53C2\u6570" };
      }
      const client = new ftp.Client(8e3);
      try {
        await client.connect(host, Number(port));
        if (Boolean(config?.secure || config?.ftps)) {
          await client.useTLS({ host });
        }
        await client.login(username, password);
        await client.send("TYPE I");
        await client.sendIgnoringError("STRU F");
        const rootPath = String(config?.rootPath || config?.path || "/").trim() || "/";
        const files = await client.list(rootPath);
        return {
          success: true,
          message: `FTP \u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F ${host}:${port}${rootPath ? `\uFF0C\u76EE\u5F55: ${rootPath}` : ""}\uFF0C\u53EF\u89C1 ${files.length} \u4E2A\u5BF9\u8C61`
        };
      } finally {
        client.close();
      }
    }
    async function testKafkaConnection(config, host, port) {
      const bootstrapServers = String(config?.bootstrapServers || config?.bootstrapServer || `${host}:${port}`).split(",").map((item) => item.trim()).filter(Boolean);
      if (!bootstrapServers.length) {
        return { success: false, message: "\u7F3A\u5C11 Kafka bootstrapServers" };
      }
      const kafka = new Kafka({
        clientId: String(config?.clientId || "medata-ingestion-test"),
        brokers: bootstrapServers,
        logLevel: logLevel.NOTHING,
        retry: { retries: 2 },
        connectionTimeout: 8e3,
        requestTimeout: 1e4
      });
      const admin = kafka.admin();
      await admin.connect();
      try {
        const topics = await admin.listTopics();
        return {
          success: true,
          message: `Kafka \u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F ${bootstrapServers.join(", ")}\uFF0C\u53EF\u89C1 ${topics.filter((topic) => !topic.startsWith("__")).length} \u4E2A Topic`
        };
      } finally {
        await admin.disconnect();
      }
    }
    function testTcpConnection(host, port, successMessage) {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        const done = (result) => {
          socket.destroy();
          resolve(result);
        };
        socket.setTimeout(5e3);
        socket.once("connect", () => {
          done({
            success: true,
            message: successMessage
          });
        });
        socket.once("timeout", () => {
          done({
            success: false,
            message: "\u8FDE\u63A5\u6D4B\u8BD5\u8D85\u65F6"
          });
        });
        socket.once("error", (error) => {
          done({
            success: false,
            message: "\u8FDE\u63A5\u6D4B\u8BD5\u5931\u8D25",
            error: error.message
          });
        });
        socket.connect(Number(port), host);
      });
    }
    module2.exports = {
      testDatabaseConnection
    };
  }
});

// backend/src/modules/data-development/data-development.service.js
var require_data_development_service = __commonJS({
  "backend/src/modules/data-development/data-development.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var repository = require_data_development_repository();
    var scheduler = require_data_development_scheduler();
    var copilot = require_data_development_copilot();
    var orchestrationCompiler = require_data_development_orchestration_compiler();
    var modelProviderService = require_model_provider_service();
    var { testDatabaseConnection } = require_data_source_test_connection();
    var { getAdapter } = require_adapters();
    var {
      buildDatasourceEnvironmentSignature,
      buildResultPreview,
      decryptSecret,
      encryptSecret,
      formatDateTime,
      inferDatasourceDialect,
      isPendingProcessingSourceTable,
      isQuerySql,
      normalizeDatasourceType,
      normalizeDatasourceStorageType,
      previewRows,
      quoteIdentifier,
      resolveRuntimeDatasourceConfig
    } = require_data_development_utils();
    function normalizeSqlDialect(dialect) {
      const normalized = normalizeDatasourceType(dialect);
      if (normalized === "gaussdb") return "postgresql";
      return normalized;
    }
    function buildIdentifierRef(alias, fieldName, dialect) {
      return `${alias}.${quoteIdentifier(fieldName, dialect)}`;
    }
    function toPostgresDatePattern(format) {
      return String(format || "%Y-%m-%d").replace(/%Y/g, "YYYY").replace(/%m/g, "MM").replace(/%d/g, "DD").replace(/%H/g, "HH24").replace(/%i/g, "MI").replace(/%s/g, "SS");
    }
    function toOracleDatePattern(format) {
      return String(format || "%Y-%m-%d").replace(/%Y/g, "YYYY").replace(/%m/g, "MM").replace(/%d/g, "DD").replace(/%H/g, "HH24").replace(/%i/g, "MI").replace(/%s/g, "SS");
    }
    function normalizeRegexPattern(pattern) {
      const rawPattern = String(pattern || "");
      if (!rawPattern) return { isRegex: true, value: rawPattern };
      try {
        new RegExp(rawPattern);
        return { isRegex: true, value: rawPattern };
      } catch (error) {
        return { isRegex: false, value: rawPattern };
      }
    }
    function buildRegexReplaceExpression2(fieldExpression, pattern, replacement, dialect) {
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      const normalizedPattern = normalizeRegexPattern(pattern);
      const safePattern = normalizedPattern.value.replace(/'/g, "''");
      const safeReplacement = String(replacement || "").replace(/'/g, "''");
      if (!normalizedPattern.isRegex) {
        return `REPLACE(${fieldExpression}, '${safePattern}', '${safeReplacement}')`;
      }
      if (["postgresql", "oracle", "dm", "hive", "mysql"].includes(normalizedDialect2)) {
        return `REGEXP_REPLACE(${fieldExpression}, '${safePattern}', '${safeReplacement}')`;
      }
      return `REGEXP_REPLACE(${fieldExpression}, '${safePattern}', '${safeReplacement}')`;
    }
    function buildSubstringExpression(fieldExpression, start, length, dialect) {
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      const safeStart = Math.max(Number(start || 0), 0);
      const startPos = safeStart + 1;
      if (length === null || length === void 0 || length === "") {
        if (normalizedDialect2 === "postgresql") {
          return `SUBSTRING(${fieldExpression} FROM ${startPos})`;
        }
        return `SUBSTR(${fieldExpression}, ${startPos})`;
      }
      const safeLength = Math.max(Number(length || 0), 0);
      if (normalizedDialect2 === "postgresql") {
        return `SUBSTRING(${fieldExpression} FROM ${startPos} FOR ${safeLength})`;
      }
      return `SUBSTR(${fieldExpression}, ${startPos}, ${safeLength})`;
    }
    var FULL_WIDTH_CHARS = "\u3000\uFF01\uFF02\uFF03\uFF04\uFF05\uFF06\uFF07\uFF08\uFF09\uFF0A\uFF0B\uFF0C\uFF0D\uFF0E\uFF0F\uFF10\uFF11\uFF12\uFF13\uFF14\uFF15\uFF16\uFF17\uFF18\uFF19\uFF1A\uFF1B\uFF1C\uFF1D\uFF1E\uFF1F\uFF20\uFF21\uFF22\uFF23\uFF24\uFF25\uFF26\uFF27\uFF28\uFF29\uFF2A\uFF2B\uFF2C\uFF2D\uFF2E\uFF2F\uFF30\uFF31\uFF32\uFF33\uFF34\uFF35\uFF36\uFF37\uFF38\uFF39\uFF3A\uFF3B\uFF3C\uFF3D\uFF3E\uFF3F\uFF40\uFF41\uFF42\uFF43\uFF44\uFF45\uFF46\uFF47\uFF48\uFF49\uFF4A\uFF4B\uFF4C\uFF4D\uFF4E\uFF4F\uFF50\uFF51\uFF52\uFF53\uFF54\uFF55\uFF56\uFF57\uFF58\uFF59\uFF5A\uFF5B\uFF5C\uFF5D\uFF5E";
    var HALF_WIDTH_CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
    function buildReplaceChainExpression(fieldExpression, searchChars, replaceChars) {
      let expression = fieldExpression;
      for (let index = 0; index < searchChars.length; index += 1) {
        const search = escapeSqlString(searchChars[index]);
        const replacement = escapeSqlString(replaceChars[index] || "");
        expression = `REPLACE(${expression}, '${search}', '${replacement}')`;
      }
      return expression;
    }
    function buildWidthConvertExpression(fieldExpression, direction, dialect) {
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      const fromChars = direction === "full_to_half" ? FULL_WIDTH_CHARS : HALF_WIDTH_CHARS;
      const toChars = direction === "full_to_half" ? HALF_WIDTH_CHARS : FULL_WIDTH_CHARS;
      if (["postgresql", "oracle", "dm", "hive"].includes(normalizedDialect2)) {
        return `TRANSLATE(${fieldExpression}, '${escapeSqlString(fromChars)}', '${escapeSqlString(toChars)}')`;
      }
      return buildReplaceChainExpression(fieldExpression, fromChars, toChars);
    }
    function buildCharLengthExpression(fieldExpression, dialect) {
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      return ["oracle", "dm"].includes(normalizedDialect2) ? `LENGTH(${fieldExpression})` : `CHAR_LENGTH(${fieldExpression})`;
    }
    function buildStringConcatExpression2(parts, dialect) {
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      if (["postgresql", "oracle", "dm", "hive"].includes(normalizedDialect2)) {
        return parts.join(" || ");
      }
      return `CONCAT(${parts.join(", ")})`;
    }
    function buildLeftExpression(fieldExpression, length, dialect) {
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      const safeLength = Math.max(0, Number(length || 0));
      if (normalizedDialect2 === "postgresql") {
        return `SUBSTRING(${fieldExpression} FROM 1 FOR ${safeLength})`;
      }
      return `SUBSTR(${fieldExpression}, 1, ${safeLength})`;
    }
    function buildHashExpression(fieldExpression, algorithm, dialect) {
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      const safeAlgorithm = String(algorithm || "md5").toLowerCase();
      if (normalizedDialect2 === "oracle") {
        const oracleAlgorithm = safeAlgorithm === "sha1" ? "SHA1" : safeAlgorithm === "sha256" ? "SHA256" : "MD5";
        return `STANDARD_HASH(${fieldExpression}, '${oracleAlgorithm}')`;
      }
      if (safeAlgorithm === "sha1") {
        return `SHA1(${fieldExpression})`;
      }
      if (safeAlgorithm === "sha256") {
        return `SHA2(${fieldExpression}, 256)`;
      }
      return `MD5(${fieldExpression})`;
    }
    function buildRightExpression(fieldExpression, length, dialect) {
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      const safeLength = Math.max(0, Number(length || 0));
      const charLength = ["oracle", "dm"].includes(normalizedDialect2) ? `LENGTH(${fieldExpression})` : `CHAR_LENGTH(${fieldExpression})`;
      if (normalizedDialect2 === "postgresql") {
        return `SUBSTRING(${fieldExpression} FROM GREATEST(${charLength} - ${safeLength} + 1, 1))`;
      }
      return `SUBSTR(${fieldExpression}, GREATEST(${charLength} - ${safeLength} + 1, 1))`;
    }
    function buildMaskExpression(fieldExpression, prefixLength, suffixLength, dialect, maskChar = "*") {
      const source = fieldExpression;
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      const lengthExpression = buildCharLengthExpression(source, dialect);
      const maskLength = `GREATEST(${lengthExpression} - ${Number(prefixLength)} - ${Number(suffixLength)}, 0)`;
      const maskLiteral = escapeSqlLiteral(maskChar);
      const repeatExpression = ["oracle", "dm"].includes(normalizedDialect2) ? `RPAD(${maskLiteral}, ${maskLength}, ${maskLiteral})` : `REPEAT(${maskLiteral}, ${maskLength})`;
      return buildStringConcatExpression2([
        buildLeftExpression(source, prefixLength, dialect),
        repeatExpression,
        buildRightExpression(source, suffixLength, dialect)
      ], dialect);
    }
    function materializeDatasource(datasource) {
      const password = decryptSecret(datasource.passwordEncrypted);
      const storageType = normalizeDatasourceStorageType(datasource.storageType || datasource.type);
      const resolved = resolveRuntimeDatasourceConfig({
        ...datasource,
        storageType,
        password
      });
      return {
        ...datasource,
        type: resolved.dialect,
        storageType,
        host: resolved.host,
        port: resolved.port,
        databaseName: resolved.databaseName,
        username: resolved.username,
        extraConfig: resolved.extraConfig,
        password
      };
    }
    function buildPersistenceDatasourcePayload(payload) {
      const resolved = resolveRuntimeDatasourceConfig(payload);
      if (!resolved.host || !resolved.port) {
        throw new AppError("Datasource host/port is required, or the JDBC URL must be parsable", 400);
      }
      return {
        ...payload,
        type: normalizeDatasourceStorageType(payload.type),
        host: resolved.host,
        port: Number(resolved.port),
        databaseName: resolved.databaseName || null,
        username: resolved.username || null,
        extraConfig: resolved.extraConfig
      };
    }
    function hasPasswordValue(payload) {
      return Object.prototype.hasOwnProperty.call(payload, "password") && payload.password !== void 0 && payload.password !== null && String(payload.password).length > 0;
    }
    async function requireDatasource(id, includePassword = false) {
      const datasource = await repository.getDatasourceById(id, includePassword);
      if (!datasource) {
        throw new AppError("Datasource not found", 404);
      }
      return datasource;
    }
    async function requireScript(id) {
      const script = await repository.getScriptById(id);
      if (!script) {
        throw new AppError("Script not found", 404);
      }
      return script;
    }
    async function requireWorkflow(id) {
      const workflow = await repository.getWorkflowById(id);
      if (!workflow) {
        throw new AppError("Workflow not found", 404);
      }
      return workflow;
    }
    async function requireOrchestrationTask(id) {
      const task = await repository.getOrchestrationTaskById(id);
      if (!task) {
        throw new AppError("Orchestration task not found", 404);
      }
      return task;
    }
    function buildWorkflowAdjacency(workflow) {
      const incoming = /* @__PURE__ */ new Map();
      const outgoing = /* @__PURE__ */ new Map();
      for (const node of workflow.nodes || []) {
        incoming.set(node.nodeKey, []);
        outgoing.set(node.nodeKey, []);
      }
      for (const edge of workflow.edges || []) {
        if (outgoing.has(edge.sourceNodeKey)) {
          outgoing.get(edge.sourceNodeKey).push(edge);
        }
        if (incoming.has(edge.targetNodeKey)) {
          incoming.get(edge.targetNodeKey).push(edge);
        }
      }
      return { incoming, outgoing };
    }
    function validateWorkflowGraph(workflow, options = {}) {
      const strict = Boolean(options.strict);
      const errors = [];
      let hasCycle = false;
      let executionOrder = [];
      try {
        executionOrder = scheduler.buildTopologicalOrder(workflow.nodes, workflow.edges);
      } catch (error) {
        hasCycle = true;
        errors.push(error.message || "Workflow graph contains a cycle");
      }
      if (!strict) {
        return {
          valid: errors.length === 0,
          hasCycle,
          nodeCount: workflow.nodes.length,
          edgeCount: workflow.edges.length,
          executionOrder,
          errors
        };
      }
      if (!workflow.nodes.length) {
        errors.push("Workflow has no nodes");
      }
      const starts = workflow.nodes.filter((node) => node.nodeType === "start");
      const ends = workflow.nodes.filter((node) => node.nodeType === "end");
      if (starts.length !== 1) {
        errors.push("Workflow must contain exactly one start node");
      }
      if (!ends.length) {
        errors.push("Workflow must contain at least one end node");
      }
      const { incoming, outgoing } = buildWorkflowAdjacency(workflow);
      for (const node of workflow.nodes) {
        const nodeIncoming = incoming.get(node.nodeKey) || [];
        const nodeOutgoing = outgoing.get(node.nodeKey) || [];
        if (node.nodeType !== "start" && !nodeIncoming.length) {
          errors.push(`\u8282\u70B9 ${node.nodeName} \u5FC5\u987B\u81F3\u5C11\u6709\u4E00\u6761\u8F93\u5165\u8FDE\u7EBF`);
        }
        switch (node.nodeType) {
          case "start":
            if (nodeIncoming.length) {
              errors.push(`Start node ${node.nodeName} cannot have incoming edges`);
            }
            if (nodeOutgoing.length !== 1) {
              errors.push(`Start node ${node.nodeName} must have exactly one outgoing edge`);
            }
            break;
          case "end":
            if (nodeOutgoing.length) {
              errors.push(`End node ${node.nodeName} cannot have outgoing edges`);
            }
            break;
          case "script":
            if (!node.scriptId) {
              errors.push(`Script node ${node.nodeName} must bind a script`);
            }
            if (nodeOutgoing.length > 1) {
              errors.push(`Script node ${node.nodeName} can have at most one outgoing edge`);
            }
            break;
          case "processing":
            if (!node.processingJobId) {
              errors.push(`\u6570\u636E\u5904\u7406\u8282\u70B9 ${node.nodeName} \u5FC5\u987B\u7ED1\u5B9A\u6570\u636E\u5904\u7406\u4EFB\u52A1`);
            }
            if (nodeOutgoing.length > 1) {
              errors.push(`\u6570\u636E\u5904\u7406\u8282\u70B9 ${node.nodeName} \u6700\u591A\u53EA\u80FD\u6709\u4E00\u6761\u8F93\u51FA\u8FDE\u7EBF`);
            }
            break;
          case "operator_task":
            if (!node.orchestrationTaskId) {
              errors.push(`\u7B97\u5B50\u4EFB\u52A1\u8282\u70B9 ${node.nodeName} \u5FC5\u987B\u7ED1\u5B9A\u7B97\u5B50\u4EFB\u52A1`);
            }
            if (nodeOutgoing.length > 1) {
              errors.push(`\u7B97\u5B50\u4EFB\u52A1\u8282\u70B9 ${node.nodeName} \u6700\u591A\u53EA\u80FD\u6709\u4E00\u6761\u8F93\u51FA\u8FDE\u7EBF`);
            }
            break;
          case "branch": {
            if (nodeOutgoing.length !== 2) {
              errors.push(`Branch node ${node.nodeName} must have exactly two outgoing edges`);
            }
            const labels = new Set(nodeOutgoing.map((edge) => String(edge.edgeLabel || "default").toLowerCase()));
            if (!labels.has("true") || !labels.has("false")) {
              errors.push(`Branch node ${node.nodeName} must define true and false edges`);
            }
            if (!node.nodeConfig?.datasourceId) {
              errors.push(`Branch node ${node.nodeName} must configure a datasource`);
            }
            if (!String(node.nodeConfig?.sqlText || "").trim()) {
              errors.push(`Branch node ${node.nodeName} must configure branch SQL`);
            }
            if (!String(node.nodeConfig?.operator || "").trim()) {
              errors.push(`Branch node ${node.nodeName} must configure a comparison operator`);
            }
            break;
          }
          case "parallel":
            if (nodeOutgoing.length < 2) {
              errors.push(`\u5E76\u884C\u5206\u652F\u8282\u70B9 ${node.nodeName} \u81F3\u5C11\u9700\u8981\u4E24\u6761\u8F93\u51FA\u8FDE\u7EBF`);
            }
            break;
          case "join":
            if (nodeIncoming.length < 2) {
              errors.push(`\u5E76\u884C\u6C47\u805A\u8282\u70B9 ${node.nodeName} \u81F3\u5C11\u9700\u8981\u4E24\u6761\u8F93\u5165\u8FDE\u7EBF`);
            }
            if (nodeOutgoing.length > 1) {
              errors.push(`\u5E76\u884C\u6C47\u805A\u8282\u70B9 ${node.nodeName} \u6700\u591A\u53EA\u80FD\u6709\u4E00\u6761\u8F93\u51FA\u8FDE\u7EBF`);
            }
            if (!["all_success", "all_done"].includes(node.triggerRule || "all_success")) {
              errors.push(`\u5E76\u884C\u6C47\u805A\u8282\u70B9 ${node.nodeName} \u7684\u89E6\u53D1\u89C4\u5219\u65E0\u6548`);
            }
            break;
          default:
            errors.push(`Unsupported node type: ${node.nodeType}`);
            break;
        }
      }
      if (starts.length === 1) {
        const visited = /* @__PURE__ */ new Set();
        const stack = [starts[0].nodeKey];
        while (stack.length) {
          const current = stack.pop();
          if (!current || visited.has(current)) continue;
          visited.add(current);
          for (const edge of outgoing.get(current) || []) {
            stack.push(edge.targetNodeKey);
          }
        }
        for (const node of workflow.nodes) {
          if (!visited.has(node.nodeKey)) {
            errors.push(`Node ${node.nodeName} is unreachable from the start node`);
          }
        }
      }
      return {
        valid: errors.length === 0,
        hasCycle,
        nodeCount: workflow.nodes.length,
        edgeCount: workflow.edges.length,
        executionOrder,
        errors
      };
    }
    function buildWorkflowSnapshot(workflow) {
      return {
        workflowId: workflow.id,
        name: workflow.name,
        retryTimes: workflow.retryTimes,
        timeoutSec: workflow.timeoutSec,
        runtimeConfig: workflow.runtimeConfig || {},
        nodes: (workflow.nodes || []).map((node) => ({ ...node })),
        edges: (workflow.edges || []).map((edge) => ({ ...edge }))
      };
    }
    async function publishWorkflowGraph(workflow, validation) {
      const latestVersion = await repository.getLatestWorkflowVersion(workflow.id);
      const versionNo = Number(latestVersion?.versionNo || 0) + 1;
      const version = await repository.createWorkflowVersion(
        workflow.id,
        versionNo,
        buildWorkflowSnapshot(workflow),
        validation
      );
      await repository.updateWorkflowPublishedVersion(workflow.id, versionNo);
      return version;
    }
    async function listDatasources() {
      return repository.listDatasources();
    }
    async function getDatasource(id) {
      return requireDatasource(id);
    }
    async function createDatasource(payload) {
      const datasource = await repository.createDatasource({
        ...buildPersistenceDatasourcePayload(payload),
        passwordEncrypted: encryptSecret(payload.password)
      });
      return datasource;
    }
    async function updateDatasource(id, payload) {
      await requireDatasource(id, true);
      return repository.updateDatasource(id, {
        ...buildPersistenceDatasourcePayload(payload),
        ...hasPasswordValue(payload) ? { passwordEncrypted: encryptSecret(payload.password) } : {}
      });
    }
    async function deleteDatasource(id) {
      const deleted = await repository.deleteDatasource(id);
      if (!deleted) {
        throw new AppError("Datasource not found", 404);
      }
    }
    async function testDatasource(id) {
      const datasource = materializeDatasource(await requireDatasource(id, true));
      return testDatabaseConnection({
        host: datasource.host,
        port: datasource.port,
        database: datasource.databaseName,
        username: datasource.username,
        password: datasource.password,
        jdbcUrl: datasource.extraConfig?.jdbcUrl,
        schema: datasource.extraConfig?.schema,
        driverClassName: datasource.extraConfig?.driverClassName
      }, datasource.storageType || datasource.type);
    }
    async function testDatasourceConfig(payload) {
      let password = payload.password;
      if (!hasPasswordValue(payload) && payload.datasourceId) {
        const existingDatasource = await requireDatasource(payload.datasourceId, true);
        password = decryptSecret(existingDatasource.passwordEncrypted);
      }
      const resolved = resolveRuntimeDatasourceConfig(payload);
      return testDatabaseConnection({
        host: resolved.host,
        port: resolved.port,
        database: resolved.databaseName,
        username: resolved.username,
        password: resolved.password || password,
        jdbcUrl: resolved.jdbcUrl,
        schema: resolved.schema,
        driverClassName: resolved.driverClassName
      }, normalizeDatasourceStorageType(payload.type));
    }
    async function listDatasourceDatabases(id) {
      const datasource = materializeDatasource(await requireDatasource(id, true));
      const adapter = getAdapter(datasource);
      return adapter.getDatabases(datasource);
    }
    async function listDatasourceTables(id, databaseName) {
      const datasource = materializeDatasource(await requireDatasource(id, true));
      const adapter = getAdapter(datasource);
      return adapter.getTables(datasource, databaseName || datasource.databaseName);
    }
    async function listDatasourceColumns(id, databaseName, tableName) {
      if (!tableName) {
        throw new AppError("tableName is required", 400);
      }
      const datasource = materializeDatasource(await requireDatasource(id, true));
      const adapter = getAdapter(datasource);
      return adapter.getColumns(datasource, databaseName || datasource.databaseName, tableName);
    }
    async function listDatasourceFunctions(id, databaseName) {
      const datasource = materializeDatasource(await requireDatasource(id, true));
      const adapter = getAdapter(datasource);
      if (typeof adapter.getFunctions !== "function") {
        return [];
      }
      return adapter.getFunctions(datasource, databaseName || datasource.databaseName);
    }
    async function listScriptFolders() {
      return repository.listScriptFolders();
    }
    async function createScriptFolder(payload) {
      return repository.createScriptFolder(payload);
    }
    async function updateScriptFolder(id, payload) {
      const folder = await repository.updateScriptFolder(id, payload);
      if (!folder) {
        throw new AppError("Script folder not found", 404);
      }
      return folder;
    }
    async function deleteScriptFolder(id) {
      const deleted = await repository.deleteScriptFolder(id);
      if (!deleted) {
        throw new AppError("Script folder not found", 404);
      }
    }
    async function listScripts(filters) {
      return repository.listScripts(filters);
    }
    async function getScript(id) {
      return requireScript(id);
    }
    async function createScript(payload) {
      await requireDatasource(payload.datasourceId);
      const script = await repository.createScript({
        ...payload,
        currentVersion: 1
      });
      await repository.createScriptVersion(script.id, 1, script.content);
      return requireScript(script.id);
    }
    async function updateScript(id, payload) {
      const existing = await requireScript(id);
      await requireDatasource(payload.datasourceId);
      const nextVersion = Number(existing.currentVersion || 1) + 1;
      const script = await repository.updateScript(id, {
        ...payload,
        currentVersion: nextVersion
      });
      await repository.createScriptVersion(id, nextVersion, payload.content);
      return script;
    }
    async function deleteScript(id) {
      const deleted = await repository.deleteScript(id);
      if (!deleted) {
        throw new AppError("Script not found", 404);
      }
    }
    async function saveScriptVersion(id) {
      const script = await requireScript(id);
      const nextVersion = Number(script.currentVersion || 1) + 1;
      const updated = await repository.updateScript(id, {
        ...script,
        tags: script.tags || [],
        currentVersion: nextVersion
      });
      await repository.createScriptVersion(id, nextVersion, script.content);
      return updated;
    }
    async function listScriptVersions(id) {
      await requireScript(id);
      return repository.listScriptVersions(id);
    }
    async function saveScriptAs(id, payload) {
      await requireScript(id);
      return createScript(payload);
    }
    async function executeQuery(payload) {
      const startedAt = Date.now();
      const datasource = materializeDatasource(await requireDatasource(payload.datasourceId, true));
      const adapter = getAdapter(datasource);
      const databaseName = payload.databaseName || datasource.databaseName;
      try {
        const result = isQuerySql(payload.sqlText) ? await adapter.executeQuery(datasource, payload.sqlText, {
          databaseName,
          resultLimit: payload.resultLimit || 200
        }) : await adapter.executeStatement(datasource, payload.sqlText, {
          databaseName
        });
        const history = await repository.createQueryHistory({
          datasourceId: payload.datasourceId,
          scriptId: payload.scriptId,
          sqlText: payload.sqlText,
          databaseName,
          status: "success",
          durationMs: Date.now() - startedAt,
          errorMessage: null,
          resultPreview: buildResultPreview(result)
        });
        return {
          ...result,
          durationMs: Date.now() - startedAt,
          status: "success",
          executedAt: formatDateTime(),
          historyId: history.id
        };
      } catch (error) {
        const history = await repository.createQueryHistory({
          datasourceId: payload.datasourceId,
          scriptId: payload.scriptId,
          sqlText: payload.sqlText,
          databaseName,
          status: "failed",
          durationMs: Date.now() - startedAt,
          errorMessage: error.message || "Query execution failed",
          resultPreview: null
        });
        return {
          fields: [],
          rows: [],
          rowCount: 0,
          durationMs: Date.now() - startedAt,
          status: "failed",
          errorMessage: error.message || "Query execution failed",
          executedAt: formatDateTime(),
          historyId: history.id
        };
      }
    }
    async function listQueryHistory(filters) {
      return repository.listQueryHistory(filters);
    }
    function trimText(value) {
      return String(value || "").trim();
    }
    function buildProcessingSummary(pipeline = {}) {
      const steps = Array.isArray(pipeline.steps) ? pipeline.steps : [];
      return {
        stepCount: steps.length,
        enabledStepCount: steps.filter((item) => item.enabled !== false).length,
        stepTypes: steps.map((item) => item.stepType)
      };
    }
    function buildSourceRelation(databaseName, tableName, dialect) {
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      const normalizedTableName = trimText(tableName);
      if (["postgresql", "gaussdb"].includes(normalizedDialect2)) {
        return quoteIdentifier(normalizedTableName.includes(".") ? normalizedTableName : `public.${normalizedTableName}`, dialect);
      }
      if (normalizedTableName.includes(".")) {
        return quoteIdentifier(normalizedTableName, dialect);
      }
      return databaseName ? `${quoteIdentifier(databaseName, dialect)}.${quoteIdentifier(normalizedTableName, dialect)}` : quoteIdentifier(normalizedTableName, dialect);
    }
    function escapeSqlString(value) {
      return String(value || "").replace(/'/g, "''");
    }
    function buildScopeFilterExpression(scope, dialect) {
      const mode = trimText(scope?.mode) || "all";
      if (mode === "all") return "";
      const fieldName = trimText(scope?.fieldName);
      if (!fieldName) return "";
      const fieldRef = quoteIdentifier(fieldName, dialect);
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      if (mode === "system_time_range") {
        const timeVariable = trimText(scope?.timeVariable) || "current_date";
        const startOffset = Number(scope?.startOffset ?? 0);
        const endOffset = Number(scope?.endOffset ?? 0);
        const offsetUnit = trimText(scope?.offsetUnit) || "day";
        const baseExpression = (() => {
          if (timeVariable === "current_timestamp") {
            return ["oracle", "dm"].includes(normalizedDialect2) ? "SYSTIMESTAMP" : "CURRENT_TIMESTAMP";
          }
          if (timeVariable === "current_time") {
            return ["oracle", "dm"].includes(normalizedDialect2) ? "CURRENT_TIMESTAMP" : "CURRENT_TIME";
          }
          return ["oracle", "dm"].includes(normalizedDialect2) ? "TRUNC(SYSDATE)" : "CURRENT_DATE";
        })();
        const buildOffsetExpression = (offset) => {
          if (!offset) return baseExpression;
          if (normalizedDialect2 === "postgresql") {
            return `${baseExpression} ${offset >= 0 ? "+" : "-"} INTERVAL '${Math.abs(offset)} ${offsetUnit}'`;
          }
          if (["oracle", "dm"].includes(normalizedDialect2)) {
            if (offsetUnit === "day") return `${baseExpression} ${offset >= 0 ? "+" : "-"} ${Math.abs(offset)}`;
            if (offsetUnit === "month") return `ADD_MONTHS(${baseExpression}, ${offset})`;
            if (offsetUnit === "hour") return `${baseExpression} ${offset >= 0 ? "+" : "-"} NUMTODSINTERVAL(${Math.abs(offset)}, 'HOUR')`;
            return `${baseExpression} ${offset >= 0 ? "+" : "-"} NUMTODSINTERVAL(${Math.abs(offset)}, 'MINUTE')`;
          }
          if (normalizedDialect2 === "hive") {
            if (offsetUnit === "day") return `DATE_ADD(${baseExpression}, ${offset})`;
            return `FROM_UNIXTIME(UNIX_TIMESTAMP(${baseExpression}) + ${offset} * ${offsetUnit === "hour" ? 3600 : offsetUnit === "minute" ? 60 : 2592e3})`;
          }
          if (offsetUnit === "day") return `DATE_ADD(${baseExpression}, INTERVAL ${offset} DAY)`;
          if (offsetUnit === "month") return `DATE_ADD(${baseExpression}, INTERVAL ${offset} MONTH)`;
          if (offsetUnit === "hour") return `DATE_ADD(${baseExpression}, INTERVAL ${offset} HOUR)`;
          return `DATE_ADD(${baseExpression}, INTERVAL ${offset} MINUTE)`;
        };
        const expressions = [];
        expressions.push(`${fieldRef} >= ${buildOffsetExpression(startOffset)}`);
        expressions.push(`${fieldRef} <= ${buildOffsetExpression(endOffset)}`);
        return expressions.join(" AND ");
      }
      return "";
    }
    function resolveTargetExecutionConfig({ databaseName, tableName, pipeline, outputMode, targetTableName }) {
      const targetConfig = pipeline?.targetConfig || null;
      const targetMode = trimText(targetConfig?.targetMode) || "";
      const configTargetTableName = trimText(targetConfig?.targetTableName);
      const effectiveOutputMode = targetMode === "source" ? "overwrite_source" : targetMode === "existing" ? "new_table" : outputMode;
      const effectiveTargetTableName = targetMode === "source" ? tableName : configTargetTableName || trimText(targetTableName);
      const effectiveDatabaseName = trimText(targetConfig?.targetDatabaseName) || databaseName;
      return {
        effectiveOutputMode,
        effectiveTargetTableName,
        effectiveDatabaseName,
        writeMode: trimText(targetConfig?.writeMode) || "overwrite",
        targetMode: targetMode || (outputMode === "overwrite_source" ? "source" : "create")
      };
    }
    function buildSafeNumericExpression(fieldExpression, dialect) {
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      const stringExpression = buildStringCastExpression(fieldExpression, dialect);
      const numericPattern = "^[-+]?[0-9]+(\\.[0-9]+)?$";
      if (normalizedDialect2 === "postgresql") {
        return `CASE WHEN ${stringExpression} ~ '${numericPattern}' THEN CAST(${fieldExpression} AS NUMERIC) ELSE NULL END`;
      }
      if (normalizedDialect2 === "oracle") {
        return `CASE WHEN REGEXP_LIKE(${stringExpression}, '${numericPattern}') THEN CAST(${fieldExpression} AS NUMBER) ELSE NULL END`;
      }
      if (normalizedDialect2 === "dm") {
        return `CASE WHEN REGEXP_LIKE(${stringExpression}, '${numericPattern}') THEN CAST(${fieldExpression} AS DECIMAL(38,10)) ELSE NULL END`;
      }
      if (normalizedDialect2 === "hive") {
        return `CASE WHEN ${stringExpression} RLIKE '${numericPattern}' THEN CAST(${fieldExpression} AS DECIMAL(38,10)) ELSE NULL END`;
      }
      return `CASE WHEN ${stringExpression} REGEXP '${numericPattern}' THEN CAST(${fieldExpression} AS DECIMAL(38,10)) ELSE NULL END`;
    }
    function getColumnName(column) {
      if (!column) return "";
      if (typeof column === "string") return trimText(column);
      return trimText(column.name || column.columnName || column.fieldName);
    }
    function getColumnMeta(columns, fieldName) {
      return (Array.isArray(columns) ? columns : []).find((item) => getColumnName(item) === fieldName) || null;
    }
    function isStringLikeColumn(columnMeta) {
      const type = String(columnMeta?.columnType || columnMeta?.dataType || "").toLowerCase();
      return /(char|text|string|json|xml|uuid|enum)/.test(type);
    }
    function buildStringCastExpression(fieldExpression, dialect) {
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      if (normalizedDialect2 === "postgresql") return `CAST(${fieldExpression} AS TEXT)`;
      if (normalizedDialect2 === "oracle") return `CAST(${fieldExpression} AS VARCHAR2(4000))`;
      if (normalizedDialect2 === "dm") return `CAST(${fieldExpression} AS VARCHAR(4000))`;
      if (normalizedDialect2 === "hive") return `CAST(${fieldExpression} AS STRING)`;
      return `CAST(${fieldExpression} AS CHAR)`;
    }
    function buildSelectListWithOverride(columns, alias, targetField, expression, dialect) {
      const normalizedColumns = Array.isArray(columns) ? columns.map((item) => getColumnName(item)).filter(Boolean) : [];
      if (!normalizedColumns.length) {
        return [`${alias}.*`, `${expression} AS ${quoteIdentifier(targetField, dialect)}`].join(", ");
      }
      const hasTarget = normalizedColumns.includes(targetField);
      const selectSegments = normalizedColumns.map((columnName) => columnName === targetField ? `${expression} AS ${quoteIdentifier(columnName, dialect)}` : `${buildIdentifierRef(alias, columnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}`);
      if (!hasTarget) {
        selectSegments.push(`${expression} AS ${quoteIdentifier(targetField, dialect)}`);
      }
      return selectSegments.join(", ");
    }
    function normalizeProcessingStepName(step, index) {
      return trimText(step.stepName) || `${step.stepType}_${index + 1}`;
    }
    function compileProcessingStepSql(step, relationName, dialect, availableColumns = []) {
      const config = step.config || {};
      switch (step.stepType) {
        case "filter": {
          const expression = trimText(config.expression);
          if (!expression) {
            throw new AppError(`\u6B65\u9AA4\u3010${step.stepName}\u3011\u7F3A\u5C11\u8FC7\u6EE4\u8868\u8FBE\u5F0F`, 400);
          }
          return `SELECT * FROM ${relationName} WHERE ${expression}`;
        }
        case "deduplicate": {
          const keyFields = Array.isArray(config.keyFields) ? config.keyFields.map((item) => trimText(item)).filter(Boolean) : [];
          if (!keyFields.length) {
            throw new AppError(`\u6B65\u9AA4\u3010${step.stepName}\u3011\u81F3\u5C11\u9700\u8981\u4E00\u4E2A\u53BB\u91CD\u952E`, 400);
          }
          const orderBy = trimText(config.orderBy) || keyFields.map((field) => quoteIdentifier(field, dialect)).join(", ");
          const partitionBy = keyFields.map((field) => quoteIdentifier(field, dialect)).join(", ");
          return [
            "SELECT *",
            "FROM (",
            `  SELECT src_.*, ROW_NUMBER() OVER (PARTITION BY ${partitionBy} ORDER BY ${orderBy}) AS __rn`,
            `  FROM ${relationName} src_`,
            ") dedup_",
            "WHERE __rn = 1"
          ].join("\n");
        }
        case "format": {
          const fieldName = trimText(config.fieldName);
          const transform = trimText(config.transform);
          if (!fieldName || !transform) {
            throw new AppError(`\u6B65\u9AA4\u3010${step.stepName}\u3011\u7F3A\u5C11\u5B57\u6BB5\u6216\u8F6C\u6362\u52A8\u4F5C`, 400);
          }
          const target = quoteIdentifier(fieldName, dialect);
          const sourceExpression = buildIdentifierRef("src_", fieldName, dialect);
          const columnMeta = getColumnMeta(availableColumns, fieldName);
          const normalizedDialect2 = normalizeSqlDialect(dialect);
          let expression = sourceExpression;
          if (transform === "trim") {
            expression = `TRIM(${isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect)})`;
          } else if (transform === "remove_spaces") {
            expression = `REPLACE(${isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect)}, ' ', '')`;
          } else if (transform === "upper") {
            expression = `UPPER(${isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect)})`;
          } else if (transform === "lower") {
            expression = `LOWER(${isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect)})`;
          } else if (transform === "full_to_half" || transform === "half_to_full") {
            expression = buildWidthConvertExpression(
              isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect),
              transform,
              dialect
            );
          } else if (transform === "date_format") {
            const format = trimText(config.format) || "%Y-%m-%d";
            if (normalizedDialect2 === "postgresql") {
              expression = `TO_CHAR(${sourceExpression}, '${toPostgresDatePattern(format)}')`;
            } else if (["oracle", "dm"].includes(normalizedDialect2)) {
              expression = `TO_CHAR(${sourceExpression}, '${toOracleDatePattern(format)}')`;
            } else if (normalizedDialect2 === "hive") {
              expression = `DATE_FORMAT(${sourceExpression}, '${format}')`;
            } else {
              expression = `DATE_FORMAT(${sourceExpression}, '${format}')`;
            }
          } else if (transform === "regex_replace") {
            const pattern = trimText(config.pattern);
            const replacement = String(config.replacement || "");
            if (!pattern) {
              throw new AppError(`\u6B65\u9AA4\u3010${step.stepName}\u3011\u7F3A\u5C11\u66FF\u6362\u89C4\u5219`, 400);
            }
            expression = buildRegexReplaceExpression2(isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect), pattern, replacement, dialect);
          } else if (transform === "substring") {
            expression = buildSubstringExpression(isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect), config.start, config.length, dialect);
          } else if (transform === "blank_to_null") {
            const textExpression = isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect);
            expression = `NULLIF(TRIM(${textExpression}), '')`;
          } else if (transform === "null_to_default") {
            const defaultValue = escapeSqlString(String(config.defaultValue ?? ""));
            expression = `COALESCE(${sourceExpression}, '${defaultValue}')`;
          } else if (transform === "desensitize_mask" || transform === "mask_mobile" || transform === "mask_id_card" || transform === "mask_email") {
            const textExpression = isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect);
            const legacyPresetMap = {
              mask_mobile: { prefixLength: 3, suffixLength: 4, maskChar: "*" },
              mask_id_card: { prefixLength: 6, suffixLength: 4, maskChar: "*" },
              mask_email: { prefixLength: 1, suffixLength: 0, maskChar: "*" }
            };
            const preset = legacyPresetMap[transform] || {};
            expression = buildMaskExpression(
              textExpression,
              Number(config.prefixLength ?? preset.prefixLength ?? 0),
              Number(config.suffixLength ?? preset.suffixLength ?? 0),
              dialect,
              String(config.maskChar ?? preset.maskChar ?? "*")
            );
          } else if (transform === "desensitize_replace") {
            const textExpression = isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect);
            const pattern = trimText(config.replacePattern || config.pattern);
            const replacement = String(config.replaceValue ?? config.replacement ?? "");
            if (!pattern) {
              throw new AppError(`\u6B65\u9AA4\u3010${step.stepName}\u3011\u7F3A\u5C11\u66FF\u6362\u89C4\u5219`, 400);
            }
            expression = buildRegexReplaceExpression2(textExpression, pattern, replacement, dialect);
          } else if (transform === "desensitize_encrypt") {
            const textExpression = isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect);
            const salt = String(config.salt || "");
            const source = salt ? `CONCAT(${textExpression}, '${escapeSqlString(salt)}')` : textExpression;
            const algorithm = String(config.encryptAlgorithm || "md5").toLowerCase();
            expression = buildHashExpression(source, algorithm, dialect);
          } else if (transform === "desensitize_generalize") {
            const textExpression = isStringLikeColumn(columnMeta) ? sourceExpression : buildStringCastExpression(sourceExpression, dialect);
            const length = Math.max(0, Number(config.generalizeLength ?? config.truncateLength ?? 0));
            expression = buildLeftExpression(`COALESCE(${textExpression}, '')`, length, dialect);
          } else if (transform === "number_round") {
            const precision = Math.max(0, Math.min(8, Number(config.precision || 0)));
            expression = `ROUND(${buildSafeNumericExpression(sourceExpression, dialect)}, ${precision})`;
          } else {
            throw new AppError(`\u6682\u4E0D\u652F\u6301\u7684\u683C\u5F0F\u8F6C\u6362\u7C7B\u578B\uFF1A${transform}`, 400);
          }
          const selectList = buildSelectListWithOverride(availableColumns, "src_", fieldName, expression, dialect);
          return `SELECT ${selectList}
FROM ${relationName} src_`;
        }
        case "validate": {
          const expression = trimText(config.expression);
          const mode = trimText(config.mode) || "keep_valid";
          const validationType = trimText(config.validationType);
          const fieldName = trimText(config.fieldName);
          if (!expression) {
            throw new AppError(`\u6B65\u9AA4\u3010${step.stepName}\u3011\u7F3A\u5C11\u6821\u9A8C\u8868\u8FBE\u5F0F`, 400);
          }
          let finalExpression = expression;
          if (validationType === "range" && fieldName) {
            const fieldExpression = buildIdentifierRef("src_", fieldName, dialect);
            const numericFieldExpression = buildSafeNumericExpression(fieldExpression, dialect);
            const minValue = trimText(config.minValue);
            const maxValue = trimText(config.maxValue);
            if (minValue && maxValue) {
              finalExpression = `${numericFieldExpression} >= ${minValue} AND ${numericFieldExpression} <= ${maxValue}`;
            } else if (minValue) {
              finalExpression = `${numericFieldExpression} >= ${minValue}`;
            } else if (maxValue) {
              finalExpression = `${numericFieldExpression} <= ${maxValue}`;
            }
          } else if (validationType === "length" && fieldName) {
            const fieldExpression = buildIdentifierRef("src_", fieldName, dialect);
            const lengthExpression = buildCharLengthExpression(buildStringCastExpression(fieldExpression, dialect), dialect);
            const minLength = trimText(config.minLength);
            const maxLength = trimText(config.maxLength);
            if (minLength && maxLength) {
              finalExpression = `${lengthExpression} >= ${minLength} AND ${lengthExpression} <= ${maxLength}`;
            } else if (minLength) {
              finalExpression = `${lengthExpression} >= ${minLength}`;
            } else if (maxLength) {
              finalExpression = `${lengthExpression} <= ${maxLength}`;
            }
          }
          if (mode === "drop_invalid") {
            return `SELECT * FROM ${relationName} WHERE ${finalExpression}`;
          }
          const tagFieldName = trimText(config.tagFieldName) || "__validation_status";
          return `SELECT src_.*, CASE WHEN ${finalExpression} THEN 'valid' ELSE 'invalid' END AS ${quoteIdentifier(tagFieldName, dialect)}
FROM ${relationName} src_`;
        }
        case "lookup_fill": {
          const lookupTable = trimText(config.lookupTable);
          const lookupSqlFilter = trimText(config.lookupSqlFilter);
          const sourceField = trimText(config.sourceField);
          const lookupKeyField = trimText(config.lookupKeyField);
          const lookupValueField = trimText(config.lookupValueField);
          const targetField = trimText(config.targetField) || lookupValueField;
          if (!lookupTable || !sourceField || !lookupKeyField || !lookupValueField) {
            throw new AppError(`\u6B65\u9AA4\u3010${step.stepName}\u3011\u7F3A\u5C11\u5173\u8054\u56DE\u586B\u914D\u7F6E`, 400);
          }
          const hasExistingTarget = availableColumns.some((item) => getColumnName(item) === targetField);
          const targetExpression = hasExistingTarget ? `COALESCE(src_.${quoteIdentifier(targetField, dialect)}, lk_.${quoteIdentifier(lookupValueField, dialect)})` : `lk_.${quoteIdentifier(lookupValueField, dialect)}`;
          const selectList = buildSelectListWithOverride(availableColumns, "src_", targetField, targetExpression, dialect);
          return [
            `SELECT ${selectList}`,
            `FROM ${relationName} src_`,
            `LEFT JOIN ${lookupTable} lk_`,
            `  ON src_.${quoteIdentifier(sourceField, dialect)} = lk_.${quoteIdentifier(lookupKeyField, dialect)}${lookupSqlFilter ? ` AND (${lookupSqlFilter})` : ""}`
          ].join("\n");
        }
        default:
          throw new AppError(`\u6682\u4E0D\u652F\u6301\u7684\u5904\u7406\u6B65\u9AA4\u7C7B\u578B\uFF1A${step.stepType}`, 400);
      }
    }
    function compileProcessingPipeline({ databaseName, tableName, pipeline, dialect, outputMode, targetTableName, sourceColumns = [] }) {
      const steps = Array.isArray(pipeline.steps) ? pipeline.steps.filter((item) => item.enabled !== false) : [];
      const sourceRelation = buildSourceRelation(databaseName, tableName, dialect);
      const ctes = [];
      const scopeExpression = buildScopeFilterExpression(pipeline?.scope, dialect);
      let currentRelation = sourceRelation;
      let currentColumns = Array.isArray(sourceColumns) ? [...sourceColumns] : [];
      if (scopeExpression) {
        ctes.push({
          cteName: "scope_base",
          sql: `SELECT * FROM ${sourceRelation} WHERE ${scopeExpression}`,
          stepKey: "__scope__",
          stepName: "\u5904\u7406\u8303\u56F4\u8FC7\u6EE4",
          stepType: "filter"
        });
        currentRelation = "scope_base";
      }
      steps.forEach((step, index) => {
        const cteName = `step_${index + 1}_${normalizeProcessingStepName(step, index).replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}`;
        const sql = compileProcessingStepSql(step, currentRelation, dialect, currentColumns);
        ctes.push({ cteName, sql, stepKey: step.stepKey, stepName: step.stepName, stepType: step.stepType });
        currentRelation = cteName;
        if (step.stepType === "validate" && trimText(step.config?.mode) !== "drop_invalid") {
          const tagFieldName = trimText(step.config?.tagFieldName) || "__validation_status";
          if (!currentColumns.some((item) => getColumnName(item) === tagFieldName)) {
            currentColumns = [...currentColumns, { name: tagFieldName, dataType: "text", columnType: "text" }];
          }
        } else if (step.stepType === "lookup_fill") {
          const targetField = trimText(step.config?.targetField) || trimText(step.config?.lookupValueField);
          if (targetField && !currentColumns.some((item) => getColumnName(item) === targetField)) {
            currentColumns = [...currentColumns, {
              name: targetField,
              dataType: trimText(step.config?.targetFieldDataType) || "text",
              columnType: trimText(step.config?.targetFieldDataType) || "text",
              comment: trimText(step.config?.targetFieldComment) || "\u5173\u8054\u56DE\u586B\u65B0\u589E\u5B57\u6BB5"
            }];
          }
        }
      });
      const previewSql = ctes.length ? `WITH
${ctes.map((item) => `${item.cteName} AS (
${item.sql}
)`).join(",\n")}
SELECT * FROM ${currentRelation}` : `SELECT * FROM ${sourceRelation}`;
      const targetExecution = resolveTargetExecutionConfig({ databaseName, tableName, pipeline, outputMode, targetTableName });
      let executeSql = previewSql;
      if (targetExecution.effectiveOutputMode === "new_table") {
        const target = trimText(targetExecution.effectiveTargetTableName);
        if (!target) {
          throw new AppError("\u5199\u5165\u65B0\u8868\u6A21\u5F0F\u9700\u8981\u76EE\u6807\u8868\u540D", 400);
        }
        const targetRelation = buildSourceRelation(targetExecution.effectiveDatabaseName, target, dialect);
        const createKeyword = targetExecution.writeMode === "append" ? null : "replace";
        executeSql = [
          ...createKeyword === "replace" ? [`DROP TABLE IF EXISTS ${targetRelation};`] : [],
          ...createKeyword === "replace" ? [`CREATE TABLE ${targetRelation} AS`, previewSql] : [`INSERT INTO ${targetRelation}`, previewSql]
        ].join("\n");
      } else if (targetExecution.effectiveOutputMode === "overwrite_source") {
        const stageTable = `${trimText(tableName)}__processing_stage_${Date.now()}`;
        const stageRelation = buildSourceRelation(databaseName, stageTable, dialect);
        executeSql = [
          `DROP TABLE IF EXISTS ${stageRelation};`,
          `CREATE TABLE ${stageRelation} AS`,
          previewSql,
          `TRUNCATE TABLE ${sourceRelation};`,
          `INSERT INTO ${sourceRelation} SELECT * FROM ${stageRelation};`,
          `DROP TABLE IF EXISTS ${stageRelation};`
        ].join("\n");
      }
      return {
        dialect,
        sourceRelation,
        previewSql,
        executeSql,
        ctes,
        finalRelation: currentRelation,
        finalColumns: currentColumns,
        targetExecution,
        warnings: []
      };
    }
    async function requireProcessingJob(id) {
      const job = await repository.getProcessingJobById(id);
      if (!job) {
        throw new AppError("Processing job not found", 404);
      }
      return job;
    }
    async function getProcessingRuntime(job, version) {
      if (isPendingProcessingSourceTable(job.tableName)) {
        throw new AppError("\u8BF7\u5148\u9009\u62E9\u6E90\u8868\u5E76\u4FDD\u5B58\u4EFB\u52A1\u914D\u7F6E", 400);
      }
      const datasource = materializeDatasource(await requireDatasource(job.datasourceId, true));
      const adapter = getAdapter(datasource);
      const sourceColumnsMeta = await adapter.getColumns(
        datasource,
        job.databaseName || datasource.databaseName,
        job.tableName
      );
      const sourceColumns = Array.isArray(sourceColumnsMeta) ? sourceColumnsMeta : [];
      const compiled = compileProcessingPipeline({
        databaseName: job.databaseName || datasource.databaseName,
        tableName: job.tableName,
        pipeline: version.pipeline,
        dialect: datasource.type,
        outputMode: job.outputMode,
        targetTableName: job.targetTableName,
        sourceColumns
      });
      return { datasource, adapter, compiled };
    }
    async function listProcessingJobs(filters) {
      const jobs = await repository.listProcessingJobs(filters);
      const versions = await Promise.all(jobs.map((job) => repository.getLatestProcessingJobVersion(job.id)));
      return jobs.map((job, index) => ({
        ...job,
        version: versions[index] || null
      }));
    }
    async function getProcessingJob(id) {
      const job = await requireProcessingJob(id);
      const version = await repository.getLatestProcessingJobVersion(id);
      const runs = await repository.listProcessingRuns(id);
      return {
        ...job,
        version,
        runs: runs.slice(0, 20)
      };
    }
    async function createProcessingJob(payload) {
      const datasource = await requireDatasource(payload.datasourceId);
      const runtimeDatasource = materializeDatasource(await requireDatasource(payload.datasourceId, true));
      const adapter = getAdapter(runtimeDatasource);
      const sourceColumnsMeta = payload.tableName && !isPendingProcessingSourceTable(payload.tableName) ? await adapter.getColumns(runtimeDatasource, payload.databaseName || runtimeDatasource.databaseName, payload.tableName) : [];
      const sourceColumns = Array.isArray(sourceColumnsMeta) ? sourceColumnsMeta : [];
      const job = await repository.createProcessingJob({
        ...payload,
        status: "draft"
      });
      const compiled = compileProcessingPipeline({
        databaseName: payload.databaseName,
        tableName: payload.tableName,
        pipeline: payload.pipeline,
        dialect: inferDatasourceDialect(datasource),
        outputMode: payload.outputMode,
        targetTableName: payload.targetTableName,
        sourceColumns
      });
      await repository.upsertProcessingJobVersion(job.id, 1, {
        versionStatus: "draft",
        pipeline: payload.pipeline,
        compiledSql: compiled.previewSql,
        summary: buildProcessingSummary(payload.pipeline)
      });
      return getProcessingJob(job.id);
    }
    async function updateProcessingJob(id, payload) {
      await requireProcessingJob(id);
      const datasource = await requireDatasource(payload.datasourceId);
      const runtimeDatasource = materializeDatasource(await requireDatasource(payload.datasourceId, true));
      const adapter = getAdapter(runtimeDatasource);
      const sourceColumnsMeta = payload.tableName && !isPendingProcessingSourceTable(payload.tableName) ? await adapter.getColumns(runtimeDatasource, payload.databaseName || runtimeDatasource.databaseName, payload.tableName) : [];
      const sourceColumns = Array.isArray(sourceColumnsMeta) ? sourceColumnsMeta : [];
      const job = await repository.updateProcessingJob(id, {
        ...payload,
        status: "draft"
      });
      if (!job) {
        throw new AppError("Processing job not found", 404);
      }
      const nextVersionNo = Math.max(Number(job.currentVersionNo || 1), 1);
      const compiled = compileProcessingPipeline({
        databaseName: payload.databaseName,
        tableName: payload.tableName,
        pipeline: payload.pipeline,
        dialect: inferDatasourceDialect(datasource),
        outputMode: payload.outputMode,
        targetTableName: payload.targetTableName,
        sourceColumns
      });
      await repository.upsertProcessingJobVersion(id, nextVersionNo, {
        versionStatus: "draft",
        pipeline: payload.pipeline,
        compiledSql: compiled.previewSql,
        summary: buildProcessingSummary(payload.pipeline)
      });
      return getProcessingJob(id);
    }
    async function deleteProcessingJob(id) {
      const deleted = await repository.deleteProcessingJob(id);
      if (!deleted) {
        throw new AppError("Processing job not found", 404);
      }
    }
    async function previewProcessingJobDraft(payload) {
      const datasource = materializeDatasource(await requireDatasource(payload.datasourceId, true));
      const adapter = getAdapter(datasource);
      const sourceColumnsMeta = await adapter.getColumns(
        datasource,
        payload.databaseName || datasource.databaseName,
        payload.tableName
      );
      const sourceColumns = Array.isArray(sourceColumnsMeta) ? sourceColumnsMeta : [];
      const compiled = compileProcessingPipeline({
        databaseName: payload.databaseName || datasource.databaseName,
        tableName: payload.tableName,
        pipeline: payload.pipeline,
        dialect: datasource.type,
        outputMode: "preview_only",
        targetTableName: null,
        sourceColumns
      });
      const queryResult = await adapter.executeQuery(datasource, compiled.previewSql, {
        databaseName: payload.databaseName || datasource.databaseName,
        resultLimit: payload.pipeline?.sampleLimit || 50
      });
      return {
        previewSql: compiled.previewSql,
        fields: queryResult.fields,
        rows: queryResult.rows,
        rowCount: queryResult.rowCount,
        warnings: compiled.warnings,
        summary: buildProcessingSummary(payload.pipeline)
      };
    }
    async function previewProcessingJob(id) {
      const job = await requireProcessingJob(id);
      const version = await repository.getLatestProcessingJobVersion(id);
      if (!version) {
        throw new AppError("Processing job version not found", 404);
      }
      const runtime = await getProcessingRuntime(job, version);
      const queryResult = await runtime.adapter.executeQuery(runtime.datasource, runtime.compiled.previewSql, {
        databaseName: job.databaseName || runtime.datasource.databaseName,
        resultLimit: version.pipeline?.sampleLimit || 50
      });
      return {
        previewSql: runtime.compiled.previewSql,
        fields: queryResult.fields,
        rows: queryResult.rows,
        rowCount: queryResult.rowCount,
        warnings: runtime.compiled.warnings,
        versionNo: version.versionNo
      };
    }
    async function runProcessingJob(id, options = {}) {
      const job = await requireProcessingJob(id);
      const version = options.versionNo ? await repository.getProcessingJobVersion(id, Number(options.versionNo)) : await repository.getLatestProcessingJobVersion(id);
      if (!version) {
        throw new AppError("Processing job version not found", 404);
      }
      const runtime = await getProcessingRuntime({
        ...job,
        outputMode: options.outputMode || job.outputMode,
        targetTableName: options.targetTableName || job.targetTableName
      }, version);
      const startedAt = Date.now();
      const run = await repository.createProcessingRun({
        jobId: id,
        versionNo: version.versionNo,
        runStatus: "running",
        triggerType: options.triggerType || "manual",
        previewMode: false,
        startedAt: formatDateTime()
      });
      try {
        const statementResult = await runtime.adapter.executeStatement(runtime.datasource, runtime.compiled.executeSql, {
          databaseName: job.databaseName || runtime.datasource.databaseName
        });
        const queryResult = await runtime.adapter.executeQuery(runtime.datasource, runtime.compiled.previewSql, {
          databaseName: job.databaseName || runtime.datasource.databaseName,
          resultLimit: version.pipeline?.sampleLimit || 50
        });
        const finished = await repository.updateProcessingRun(run.id, {
          runStatus: "completed",
          sourceRowCount: null,
          outputRowCount: queryResult.rowCount,
          affectedRows: statementResult.affectedRows ?? queryResult.rowCount,
          targetTableName: options.targetTableName || job.targetTableName,
          durationMs: Date.now() - startedAt,
          errorMessage: null,
          resultPreview: buildResultPreview(queryResult),
          executedSql: runtime.compiled.executeSql,
          startedAt: formatDateTime(new Date(startedAt)),
          finishedAt: formatDateTime()
        });
        await repository.updateProcessingJobVersionPointers(id, {
          lastRunStatus: "completed",
          lastRunAt: formatDateTime(),
          status: "active",
          currentVersionNo: version.versionNo
        });
        return finished;
      } catch (error) {
        const failed = await repository.updateProcessingRun(run.id, {
          runStatus: "failed",
          errorMessage: error.message || "Processing run failed",
          durationMs: Date.now() - startedAt,
          executedSql: runtime.compiled.executeSql,
          startedAt: formatDateTime(new Date(startedAt)),
          finishedAt: formatDateTime()
        });
        await repository.updateProcessingJobVersionPointers(id, {
          lastRunStatus: "failed",
          lastRunAt: formatDateTime()
        });
        return failed;
      }
    }
    async function listProcessingJobRuns(id) {
      await requireProcessingJob(id);
      return repository.listProcessingRuns(id);
    }
    async function runCopilotTask(payload, user) {
      return copilot.runCopilotTask(payload, { user });
    }
    async function runCopilotTaskStream(payload, streamContext = {}) {
      return copilot.runCopilotTaskStream(payload, streamContext);
    }
    async function listCopilotSessions(user, filters = {}) {
      return copilot.listCopilotSessions(user, filters);
    }
    async function listCopilotSessionMessages(user, sessionId) {
      return copilot.listCopilotSessionMessages(user, sessionId);
    }
    async function listWorkflows() {
      return repository.listWorkflows();
    }
    async function getWorkflow(id) {
      return requireWorkflow(id);
    }
    async function listOrchestrationTasks() {
      return repository.listOrchestrationTasks();
    }
    async function getOrchestrationTask(id) {
      return requireOrchestrationTask(id);
    }
    async function createOrchestrationTask(payload) {
      if (payload.datasourceId) {
        await requireDatasource(payload.datasourceId);
      }
      return repository.createOrchestrationTask(payload);
    }
    async function updateOrchestrationTask(id, payload) {
      await requireOrchestrationTask(id);
      if (payload.datasourceId) {
        await requireDatasource(payload.datasourceId);
      }
      return repository.updateOrchestrationTask(id, payload);
    }
    async function deleteOrchestrationTask(id) {
      const deleted = await repository.deleteOrchestrationTask(id);
      if (!deleted) {
        throw new AppError("Orchestration task not found", 404);
      }
    }
    function getOrchestrationSourceDatasourceIds(task) {
      return Array.from(new Set(
        (task.nodes || []).filter((node) => node.nodeType === "source").map((node) => Number(node.nodeConfig?.datasourceId || task.datasourceId || 0)).filter((value) => Number.isFinite(value) && value > 0)
      ));
    }
    async function getOrchestrationSourceDatasources(task) {
      const datasources = [];
      for (const datasourceId of getOrchestrationSourceDatasourceIds(task)) {
        datasources.push(materializeDatasource(await requireDatasource(datasourceId, true)));
      }
      return datasources;
    }
    async function ensureOrchestrationDatasourceEnvironment(task) {
      const datasources = await getOrchestrationSourceDatasources(task);
      const sourceDatasourceIds = getOrchestrationSourceDatasourceIds(task);
      if (!datasources.length) {
        return { datasources, sourceDatasourceIds, effectiveDatasource: null };
      }
      const signatureMap = /* @__PURE__ */ new Map();
      datasources.forEach((datasource) => {
        signatureMap.set(buildDatasourceEnvironmentSignature(datasource), datasource);
      });
      if (signatureMap.size > 1) {
        throw new AppError("\u6570\u636E\u7F16\u6392\u4E2D\u7684\u6240\u6709\u6570\u636E\u8F93\u5165\u5FC5\u987B\u6765\u81EA\u540C\u4E00\u6570\u636E\u5E93\u5730\u5740\u73AF\u5883\uFF0C\u4EC5\u5141\u8BB8\u540C\u4E00\u5B9E\u4F8B\u4E0B\u5207\u6362\u4E0D\u540C\u7528\u6237\u540D\u3002", 400);
      }
      return {
        datasources,
        sourceDatasourceIds,
        effectiveDatasource: datasources[0] || null
      };
    }
    function normalizePreviewLimit(value, max = 200) {
      return Math.max(1, Math.min(Number(value || 20) || 20, max));
    }
    function trimText(value) {
      return String(value || "").trim();
    }
    function uniqueStrings(values) {
      return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
    }
    function isPreviewOnlyWarning(message) {
      const text = trimText(message);
      return text.includes("cannot be translated to pure SQL") || text.includes("SQL preview uses") || text.includes("structure inspection only");
    }
    function filterRunWarnings(values) {
      return uniqueStrings(values).filter((item) => !isPreviewOnlyWarning(item));
    }
    var AI_OPERATOR_CODES = /* @__PURE__ */ new Set(["llm", "llm_row", "llm_batch"]);
    var RUNTIME_OPERATOR_CODES = /* @__PURE__ */ new Set(["string_split"]);
    function normalizeAiOperatorCode(value) {
      const operatorCode = trimText(value);
      return operatorCode === "llm" ? "llm_row" : operatorCode;
    }
    function getAiFallbackFieldName(operatorCode) {
      return normalizeAiOperatorCode(operatorCode) === "llm_batch" ? "batch_result" : "llm_reply";
    }
    function normalizeAiOutputFields(value, legacyFieldName, fallbackFieldName = "llm_reply") {
      let fieldList = [];
      if (Array.isArray(value)) {
        fieldList = value;
      } else if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          fieldList = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          fieldList = [];
        }
      }
      const parsedFields = fieldList.filter((item) => item && typeof item === "object").map((item) => ({
        fieldName: trimText(item.fieldName || item.name || item.outputFieldName),
        description: trimText(item.description || item.fieldDesc || item.label)
      })).filter((item) => item.fieldName);
      if (parsedFields.length) {
        return parsedFields;
      }
      const nextFieldName = trimText(legacyFieldName) || fallbackFieldName;
      return nextFieldName ? [{ fieldName: nextFieldName, description: "" }] : [];
    }
    function findOrchestrationNode(task, nodeKey) {
      const node = (task.nodes || []).find((item) => item.nodeKey === nodeKey);
      if (!node) {
        throw new AppError(`Orchestration node ${nodeKey} not found`, 404);
      }
      return node;
    }
    function parseStringArray(value) {
      if (Array.isArray(value)) {
        return value.map((item) => String(item || "").trim()).filter(Boolean);
      }
      if (typeof value === "string") {
        return value.split(",").map((item) => item.trim()).filter(Boolean);
      }
      return [];
    }
    function normalizePromptVariableMappings(value) {
      if (!Array.isArray(value)) {
        return [];
      }
      return value.filter((item) => item && typeof item === "object").map((item) => {
        const sourceFields = parseStringArray(item.sourceFields);
        const sourceField = trimText(item.sourceField) || sourceFields[0];
        const sourceMode = trimText(item.sourceMode) || (sourceFields.length > 1 ? "selected_fields" : sourceField ? "single_field" : "all_fields");
        return {
          variableName: trimText(item.variableName),
          sourceMode,
          sourceField,
          sourceFields: sourceFields.length ? sourceFields : sourceField ? [sourceField] : [],
          defaultValue: item.defaultValue === void 0 || item.defaultValue === null ? "" : String(item.defaultValue)
        };
      }).filter((item) => item.variableName);
    }
    function buildPromptVariableValueFromRow(row, mapping) {
      const safeRow = row || {};
      const sourceMode = trimText(mapping?.sourceMode) || "single_field";
      if (sourceMode === "all_fields") {
        return Object.keys(safeRow).length ? safeRow : mapping.defaultValue;
      }
      if (sourceMode === "selected_fields") {
        const payload = {};
        (mapping.sourceFields || []).forEach((fieldName) => {
          if (fieldName && Object.prototype.hasOwnProperty.call(safeRow, fieldName)) {
            payload[fieldName] = safeRow[fieldName];
          }
        });
        return Object.keys(payload).length ? payload : mapping.defaultValue;
      }
      const sourceValue = Object.prototype.hasOwnProperty.call(safeRow, mapping.sourceField) ? safeRow[mapping.sourceField] : void 0;
      return sourceValue === void 0 || sourceValue === null || sourceValue === "" ? mapping.defaultValue : sourceValue;
    }
    function stringifyPromptValue(value) {
      if (value === null || value === void 0) {
        return "";
      }
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        return String(value);
      }
    }
    function renderPromptTemplate(template, variables) {
      return String(template || "").replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, rawKey) => {
        const key = String(rawKey || "").trim();
        return stringifyPromptValue(variables?.[key]);
      });
    }
    function buildPromptVariables(row, rowIndex, mappings) {
      const variables = {
        row_index: rowIndex + 1,
        row_json: stringifyPromptValue(row || {})
      };
      Object.entries(row || {}).forEach(([key, value]) => {
        variables[key] = value;
      });
      normalizePromptVariableMappings(mappings).forEach((item) => {
        variables[item.variableName] = buildPromptVariableValueFromRow(row, item);
      });
      return variables;
    }
    function buildBatchPromptVariables(rows, mappings) {
      const safeRows = Array.isArray(rows) ? rows : [];
      const columns = uniqueStrings(safeRows.flatMap((item) => Object.keys(item || {})));
      const variables = {
        row_count: safeRows.length,
        rows_json: stringifyPromptValue(safeRows),
        sample_rows_json: stringifyPromptValue(safeRows),
        columns: columns.join(", "),
        columns_json: stringifyPromptValue(columns)
      };
      columns.forEach((columnName) => {
        variables[columnName] = safeRows.map((row) => row && Object.prototype.hasOwnProperty.call(row, columnName) ? row[columnName] : "");
      });
      normalizePromptVariableMappings(mappings).forEach((item) => {
        if (trimText(item.sourceMode) === "all_fields") {
          variables[item.variableName] = safeRows.length ? safeRows : item.defaultValue;
          return;
        }
        variables[item.variableName] = safeRows.map((row) => buildPromptVariableValueFromRow(row, item));
      });
      return variables;
    }
    function extractJsonObject(text = "") {
      const raw = String(text || "").trim();
      if (!raw) {
        throw new Error("Model returned empty content");
      }
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        return raw.slice(firstBrace, lastBrace + 1);
      }
      throw new Error("JSON object not found in model response");
    }
    function parseJsonObjectWithRecovery(text = "") {
      try {
        return JSON.parse(String(text || "{}"));
      } catch (error) {
        return JSON.parse(extractJsonObject(text));
      }
    }
    function buildAiResponseInstruction(outputFields) {
      const fieldLines = outputFields.map((item) => `- ${item.fieldName}: ${item.description || "string"}`);
      return [
        "Return valid JSON only. The response must be a JSON object.",
        "Use exactly the configured keys below and do not add extra keys.",
        "When a value cannot be extracted, return an empty string.",
        ...fieldLines
      ].join("\n");
    }
    function normalizeAiFieldValue(value) {
      if (value === void 0 || value === null) {
        return "";
      }
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
      }
      return stringifyPromptValue(value);
    }
    function resolveAiOutputValues(content, outputFields) {
      const rawContent = String(content || "");
      const warnings = [];
      let parsed = null;
      try {
        parsed = parseJsonObjectWithRecovery(rawContent);
      } catch (error) {
        if (outputFields.length === 1) {
          return {
            values: { [outputFields[0].fieldName]: rawContent.trim() },
            warnings: ["AI response was not valid JSON. The raw response has been written to the only output field."]
          };
        }
        warnings.push("AI response was not valid JSON. Output fields have been left blank for this preview.");
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        const emptyValues = {};
        outputFields.forEach((item) => {
          emptyValues[item.fieldName] = "";
        });
        if (!warnings.length) {
          warnings.push("AI response is not a JSON object. Output fields have been left blank for this preview.");
        }
        return { values: emptyValues, warnings };
      }
      const values = {};
      const missingFields = [];
      outputFields.forEach((item) => {
        if (Object.prototype.hasOwnProperty.call(parsed, item.fieldName)) {
          values[item.fieldName] = normalizeAiFieldValue(parsed[item.fieldName]);
        } else {
          values[item.fieldName] = "";
          missingFields.push(item.fieldName);
        }
      });
      if (missingFields.length) {
        warnings.push(`AI response did not contain configured keys: ${missingFields.join(", ")}.`);
      }
      return { values, warnings };
    }
    async function requestAiNodeOutput(runtimeProvider, systemPromptTemplate, userPromptTemplate, variables, outputFields) {
      const renderedSystemPrompt = renderPromptTemplate(systemPromptTemplate, variables);
      const renderedUserPrompt = renderPromptTemplate(userPromptTemplate, variables);
      const instruction = buildAiResponseInstruction(outputFields);
      const messages = [{
        role: "system",
        content: renderedSystemPrompt ? `${renderedSystemPrompt}

${instruction}` : instruction
      }, {
        role: "user",
        content: renderedUserPrompt
      }];
      const completion = await modelProviderService.generateChatCompletion(runtimeProvider, messages, {
        temperature: 0.2,
        maxTokens: 1600,
        timeoutMs: 6e4,
        responseFormat: { type: "json_object" }
      });
      return {
        completion,
        ...resolveAiOutputValues(completion?.content || "", outputFields)
      };
    }
    function parseObjectArray(value) {
      if (Array.isArray(value)) {
        return value.filter((item) => item && typeof item === "object");
      }
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
        } catch (error) {
          return [];
        }
      }
      return [];
    }
    function indentSql(sqlText, spaces = 2) {
      const padding = " ".repeat(spaces);
      return String(sqlText || "").split("\n").map((line) => line ? `${padding}${line}` : line).join("\n");
    }
    function escapeSqlLiteral(value) {
      if (value === null || value === void 0) {
        return "NULL";
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
      if (typeof value === "boolean") {
        return value ? "TRUE" : "FALSE";
      }
      if (value instanceof Date) {
        return `'${formatDateTime(value)}'`;
      }
      return `'${String(value).replace(/'/g, "''")}'`;
    }
    var VALIDATION_PATTERN_MAP = {
      id_card: /^(\d{15}|\d{17}[0-9Xx])$/,
      phone: /^1[3-9][0-9]{9}$/,
      email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
      credit_code: /^[0-9A-Z]{18}$/,
      url: /^https?:\/\/.+/i,
      ipv4: /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/,
      postal_code: /^\d{6}$/
    };
    function getValidationPattern(checkType) {
      return VALIDATION_PATTERN_MAP[trimText(checkType)] || null;
    }
    function parseDomainValueList(value) {
      if (Array.isArray(value)) {
        return value.map((item) => String(item ?? "").trim()).filter(Boolean);
      }
      return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    }
    function matchesBuiltinValidation(value, checkType) {
      const pattern = getValidationPattern(checkType);
      const text = value === void 0 || value === null ? "" : String(value).trim();
      return pattern ? pattern.test(text) : false;
    }
    function parseConditionRules(value) {
      return parseObjectArray(value).map((item) => {
        const referenceFieldRef = trimText(item.referenceFieldRef);
        const separatorIndex = referenceFieldRef.indexOf("::");
        const referenceNodeKey = trimText(item.referenceNodeKey) || (separatorIndex > 0 ? referenceFieldRef.slice(0, separatorIndex) : "");
        const referenceField = trimText(item.referenceField) || (separatorIndex > 0 ? referenceFieldRef.slice(separatorIndex + 2) : "");
        return {
          ruleType: trimText(item.ruleType) || (trimText(item.checkType) ? "builtin" : String(item.domainValues ?? "").trim() ? "domain" : "condition"),
          fieldName: trimText(item.fieldName),
          operator: trimText(item.operator) || "eq",
          value: item.value === void 0 || item.value === null ? "" : String(item.value),
          valueSource: trimText(item.valueSource) || (referenceField ? "upstream_field" : trimText(item.customSql) ? "custom_sql" : "literal"),
          referenceNodeKey,
          referenceField,
          customSql: item.customSql === void 0 || item.customSql === null ? "" : String(item.customSql),
          checkType: trimText(item.checkType) || "phone",
          matchMode: trimText(item.matchMode) || "valid",
          domainValues: item.domainValues === void 0 || item.domainValues === null ? "" : String(item.domainValues)
        };
      }).filter((item) => item.fieldName);
    }
    function parseSortRules(value) {
      return parseObjectArray(value).map((item) => ({
        fieldName: trimText(item.fieldName),
        direction: trimText(item.direction).toUpperCase() === "DESC" ? "DESC" : "ASC"
      })).filter((item) => item.fieldName);
    }
    function parseReplaceRules(value) {
      return parseObjectArray(value).map((item) => ({
        matchValue: item.matchValue === void 0 || item.matchValue === null ? "" : String(item.matchValue),
        replaceValue: item.replaceValue === void 0 || item.replaceValue === null ? "" : String(item.replaceValue)
      })).filter((item) => item.matchValue !== "" || item.replaceValue !== "");
    }
    function parseFormatRules(value) {
      return parseObjectArray(value).map((item) => ({
        sourceField: trimText(item.sourceField),
        targetField: trimText(item.targetField),
        transformType: trimText(item.transformType) || "date_to_string",
        formatPattern: item.formatPattern === void 0 || item.formatPattern === null ? "" : String(item.formatPattern),
        targetType: trimText(item.targetType) || "decimal"
      })).filter((item) => item.sourceField && item.targetField);
    }
    function parseComplianceRules(value) {
      return parseObjectArray(value).map((item) => ({
        validationType: trimText(item.validationType) || (String(item.customPattern ?? "").trim() ? "regex" : String(item.fixedValue ?? "").trim() ? "fixed_value" : String(item.domainValues ?? "").trim() ? "domain" : "builtin"),
        sourceField: trimText(item.sourceField),
        targetField: trimText(item.targetField),
        checkType: trimText(item.checkType) || "phone",
        customPattern: item.customPattern === void 0 || item.customPattern === null ? "" : String(item.customPattern),
        fixedValue: item.fixedValue === void 0 || item.fixedValue === null ? "" : String(item.fixedValue),
        domainValues: item.domainValues === void 0 || item.domainValues === null ? "" : String(item.domainValues),
        resultMode: trimText(item.resultMode) || "flag",
        defaultValue: item.defaultValue === void 0 || item.defaultValue === null ? "" : String(item.defaultValue)
      })).filter((item) => item.sourceField && item.targetField);
    }
    function parseStringRules(value) {
      return parseObjectArray(value).map((item) => ({
        sourceField: trimText(item.sourceField),
        targetField: trimText(item.targetField),
        transformType: trimText(item.transformType) || "trim",
        argument1: item.argument1 === void 0 || item.argument1 === null ? "" : String(item.argument1),
        argument2: item.argument2 === void 0 || item.argument2 === null ? "" : String(item.argument2)
      })).filter((item) => item.sourceField && item.targetField);
    }
    function parseDesensitizeRules(value) {
      return parseObjectArray(value).map((item) => ({
        sourceField: trimText(item.sourceField),
        targetField: trimText(item.targetField),
        maskType: trimText(item.maskType) || trimText(item.transform) || "mask",
        transform: trimText(item.transform) || trimText(item.maskType) || "mask",
        maskChar: trimText(item.maskChar) || "*",
        prefixLength: Math.max(0, Number(item.prefixLength || 0)),
        suffixLength: Math.max(0, Number(item.suffixLength || 0)),
        truncateLength: Math.max(0, Number(item.truncateLength || 0)),
        replacePattern: trimText(item.replacePattern) || trimText(item.pattern) || "",
        replaceValue: item.replaceValue === void 0 || item.replaceValue === null ? "" : String(item.replaceValue),
        encryptAlgorithm: trimText(item.encryptAlgorithm) || trimText(item.hashAlgorithm) || "md5",
        salt: trimText(item.salt) || "",
        generalizeLength: Math.max(0, Number(item.generalizeLength || item.truncateLength || 0))
      })).filter((item) => item.sourceField && item.targetField);
    }
    function parseJoinKeyRules(value) {
      return parseObjectArray(value).map((item) => ({
        leftField: trimText(item.leftField),
        rightField: trimText(item.rightField)
      })).filter((item) => item.leftField && item.rightField);
    }
    function parseOutputFieldMappings(value) {
      return parseObjectArray(value).map((item) => ({
        sourceField: trimText(item.sourceField),
        targetField: trimText(item.targetField)
      })).filter((item) => item.sourceField && item.targetField);
    }
    function parseColumnAlignmentRows(value) {
      return parseObjectArray(value).map((row) => ({
        outputField: trimText(row.outputField),
        bindings: parseObjectArray(row.bindings).map((binding) => ({
          sourceNodeKey: trimText(binding.sourceNodeKey),
          fieldName: trimText(binding.fieldName)
        })).filter((binding) => binding.sourceNodeKey)
      })).filter((row) => row.outputField);
    }
    function parseAggregationRules(value) {
      return parseObjectArray(value).map((item) => ({
        aggregateFunction: trimText(item.aggregateFunction || item.func || "count").toLowerCase(),
        fieldName: trimText(item.fieldName),
        alias: trimText(item.alias)
      })).filter((item) => item.aggregateFunction);
    }
    function parseBooleanFlag(value, fallback = false) {
      if (typeof value === "boolean") {
        return value;
      }
      const normalized = trimText(value).toLowerCase();
      if (["true", "1", "yes", "y", "on"].includes(normalized)) {
        return true;
      }
      if (["false", "0", "no", "n", "off"].includes(normalized)) {
        return false;
      }
      return fallback;
    }
    function parseStringAggregateRules(value) {
      return parseObjectArray(value).map((item) => ({
        sourceField: trimText(item.sourceField),
        outputField: trimText(item.outputField),
        separator: item.separator === void 0 || item.separator === null ? "," : String(item.separator),
        distinct: parseBooleanFlag(item.distinct, false)
      })).filter((item) => item.sourceField && item.outputField);
    }
    function parseStringSplitConfig(value) {
      if (!value || typeof value !== "object") {
        return {
          sourceField: "",
          outputField: "",
          separator: ",",
          trimItems: true,
          keepEmptyItems: false,
          indexField: ""
        };
      }
      return {
        sourceField: trimText(value.sourceField),
        outputField: trimText(value.outputField),
        separator: value.separator === void 0 || value.separator === null ? "," : String(value.separator),
        trimItems: parseBooleanFlag(value.trimItems, true),
        keepEmptyItems: parseBooleanFlag(value.keepEmptyItems, false),
        indexField: trimText(value.indexField)
      };
    }
    function getActiveOrchestrationEdges(task) {
      return (task.edges || []).filter((edge) => trimText(edge.edgeStatus).toLowerCase() !== "paused");
    }
    function buildOrchestrationEdgeMaps(task) {
      const incoming = /* @__PURE__ */ new Map();
      const outgoing = /* @__PURE__ */ new Map();
      getActiveOrchestrationEdges(task).forEach((edge) => {
        incoming.set(edge.targetNodeKey, [...incoming.get(edge.targetNodeKey) || [], edge]);
        outgoing.set(edge.sourceNodeKey, [...outgoing.get(edge.sourceNodeKey) || [], edge]);
      });
      return { incoming, outgoing };
    }
    function collectActiveLineageNodeKeys(nodeKey, incoming, trail = /* @__PURE__ */ new Set()) {
      if (!nodeKey || trail.has(nodeKey)) {
        return trail;
      }
      trail.add(nodeKey);
      (incoming.get(nodeKey) || []).forEach((edge) => {
        collectActiveLineageNodeKeys(edge.sourceNodeKey, incoming, trail);
      });
      return trail;
    }
    function orchestrationLineageContainsRuntimeOperator(task, nodeKey) {
      const { incoming } = buildOrchestrationEdgeMaps(task);
      const lineageNodeKeys = collectActiveLineageNodeKeys(nodeKey, incoming);
      return (task.nodes || []).some((node) => {
        if (!lineageNodeKeys.has(node.nodeKey)) {
          return false;
        }
        const operatorCode = trimText(node.operatorCode);
        return AI_OPERATOR_CODES.has(operatorCode) || RUNTIME_OPERATOR_CODES.has(operatorCode);
      });
    }
    function inferRuntimeDataType(value) {
      if (value === null || value === void 0 || value === "") {
        return "string";
      }
      if (typeof value === "boolean") {
        return "boolean";
      }
      if (typeof value === "number") {
        return Number.isInteger(value) ? "integer" : "number";
      }
      if (value instanceof Date) {
        return "datetime";
      }
      const text = String(value).trim();
      if (/^-?\d+$/.test(text)) {
        return "integer";
      }
      if (/^-?\d+(\.\d+)?$/.test(text)) {
        return "number";
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return "date";
      }
      if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(text)) {
        return "datetime";
      }
      return "string";
    }
    function inferRuntimeColumnDataType(fieldName, rows) {
      const inferredTypes = new Set(
        (rows || []).map((row) => row?.[fieldName]).filter((value) => value !== null && value !== void 0 && value !== "").map((value) => inferRuntimeDataType(value))
      );
      if (!inferredTypes.size) {
        return "string";
      }
      if (inferredTypes.size === 1) {
        return Array.from(inferredTypes)[0];
      }
      if (Array.from(inferredTypes).every((item) => ["integer", "number"].includes(item))) {
        return "number";
      }
      if (Array.from(inferredTypes).every((item) => ["date", "datetime"].includes(item))) {
        return "datetime";
      }
      return "string";
    }
    function buildRuntimeColumnMeta(fields, rows) {
      return (fields || []).map((fieldName, index) => {
        const dataType = inferRuntimeColumnDataType(fieldName, rows);
        return {
          name: fieldName,
          position: index + 1,
          dataType,
          columnType: dataType,
          nullable: true,
          primaryKey: false,
          defaultValue: null,
          comment: null
        };
      });
    }
    function normalizeComparableValue(value) {
      if (value === null || value === void 0) {
        return null;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return value;
      }
      const text = String(value).trim();
      if (/^-?\d+(\.\d+)?$/.test(text)) {
        return Number(text);
      }
      return text;
    }
    function evaluateConditionRule(row, rule) {
      const fieldValue = row ? row[rule.fieldName] : void 0;
      const ruleType = trimText(rule.ruleType) || "condition";
      const operator = trimText(rule.operator) || "eq";
      const normalizedValue = rule.value === void 0 || rule.value === null ? "" : String(rule.value);
      const left = normalizeComparableValue(fieldValue);
      const right = normalizeComparableValue(normalizedValue);
      const leftText = left === null ? "" : String(left);
      const rightText = right === null ? "" : String(right);
      if (ruleType === "builtin") {
        const matched = matchesBuiltinValidation(fieldValue, rule.checkType);
        return trimText(rule.matchMode) === "invalid" ? !matched : matched;
      }
      if (ruleType === "domain") {
        const domainValues = parseDomainValueList(rule.domainValues);
        const matched = domainValues.includes(leftText);
        return trimText(rule.matchMode) === "not_in" ? !matched : matched;
      }
      switch (operator) {
        case "ne":
          return leftText !== rightText;
        case "gt":
          return Number(left) > Number(right);
        case "gte":
          return Number(left) >= Number(right);
        case "lt":
          return Number(left) < Number(right);
        case "lte":
          return Number(left) <= Number(right);
        case "contains":
          return leftText.includes(rightText);
        case "starts_with":
          return leftText.startsWith(rightText);
        case "ends_with":
          return leftText.endsWith(rightText);
        case "in": {
          const values = Array.isArray(rule.resolvedValues) ? rule.resolvedValues : rightText.split(",").map((item) => item.trim()).filter(Boolean);
          return values.includes(leftText);
        }
        case "not_in": {
          const values = Array.isArray(rule.resolvedValues) ? rule.resolvedValues : rightText.split(",").map((item) => item.trim()).filter(Boolean);
          return !values.includes(leftText);
        }
        case "is_null":
          return fieldValue === null || fieldValue === void 0 || fieldValue === "";
        case "is_not_null":
          return fieldValue !== null && fieldValue !== void 0 && fieldValue !== "";
        case "eq":
        default:
          return leftText === rightText;
      }
    }
    function evaluateRuleGroup(rows, rules, logic) {
      const rawRules = Array.isArray(rules) ? rules : [];
      const normalizedRules = parseConditionRules(rules).map((rule, index) => ({
        ...rule,
        ...Array.isArray(rawRules[index]?.resolvedValues) ? { resolvedValues: rawRules[index].resolvedValues } : {}
      }));
      if (!normalizedRules.length) {
        return rows.slice();
      }
      const useAny = trimText(logic) === "any";
      return rows.filter((row) => {
        const results = normalizedRules.map((rule) => evaluateConditionRule(row, rule));
        return useAny ? results.some(Boolean) : results.every(Boolean);
      });
    }
    function normalizeRuntimeFilterSubquerySql(value) {
      let sqlText = String(value ?? "").trim().replace(/;+\s*$/, "");
      const wrappedMatch = sqlText.match(/^(?:not\s+)?in\s*\(([\s\S]*)\)$/i);
      if (wrappedMatch) {
        sqlText = String(wrappedMatch[1] || "").trim().replace(/;+\s*$/, "");
      } else if (/^\([\s\S]*\)$/.test(sqlText)) {
        const innerSql = sqlText.slice(1, -1).trim().replace(/;+\s*$/, "");
        if (/^(select|with)\b/i.test(innerSql)) {
          sqlText = innerSql;
        }
      }
      return sqlText;
    }
    async function resolveRuntimeFilterRules(inputResults, primaryInput, rules, context) {
      const normalizedRules = parseConditionRules(rules);
      return Promise.all(normalizedRules.map(async (rule) => {
        if (!["in", "not_in"].includes(rule.operator)) {
          return rule;
        }
        if (rule.valueSource === "upstream_field") {
          const referenceField = trimText(rule.referenceField);
          const referenceInput = trimText(rule.referenceNodeKey) ? inputResults.find((item) => item.sourceNodeKey === trimText(rule.referenceNodeKey)) : primaryInput;
          if (!referenceInput) {
            throw new AppError(`\u6570\u636E\u8FC7\u6EE4\u5F15\u7528\u7684\u4E0A\u6E38\u8282\u70B9 ${rule.referenceNodeKey} \u672A\u8FDE\u63A5`, 400);
          }
          return {
            ...rule,
            resolvedValues: uniqueStrings(
              (referenceInput.rows || []).map((row) => row?.[referenceField]).filter((value) => value !== null && value !== void 0).map((value) => String(normalizeComparableValue(value) ?? ""))
            )
          };
        }
        if (rule.valueSource === "custom_sql") {
          const sqlText = normalizeRuntimeFilterSubquerySql(rule.customSql);
          if (!isQuerySql(sqlText)) {
            throw new AppError("IN / NOT IN \u81EA\u5B9A\u4E49 SQL \u5FC5\u987B\u662F\u8FD4\u56DE\u5355\u5217\u7ED3\u679C\u7684 SELECT \u67E5\u8BE2", 400);
          }
          if (!context.adapter || !context.datasource) {
            throw new AppError("\u6267\u884C\u81EA\u5B9A\u4E49 SQL \u8FC7\u6EE4\u9700\u8981\u53EF\u7528\u7684\u6570\u636E\u6E90", 400);
          }
          const queryResult = await context.adapter.executeQuery(context.datasource, sqlText, {
            databaseName: context.databaseName || context.datasource.databaseName
          });
          const firstField = queryResult.fields?.[0] || Object.keys(queryResult.rows?.[0] || {})[0];
          if (!firstField) {
            return { ...rule, resolvedValues: [] };
          }
          return {
            ...rule,
            resolvedValues: uniqueStrings(
              (queryResult.rows || []).map((row) => row?.[firstField]).filter((value) => value !== null && value !== void 0).map((value) => String(normalizeComparableValue(value) ?? ""))
            )
          };
        }
        return rule;
      }));
    }
    function compareRuntimeValues(left, right) {
      const leftValue = normalizeComparableValue(left);
      const rightValue = normalizeComparableValue(right);
      if (leftValue === rightValue) {
        return 0;
      }
      if (leftValue === null) return -1;
      if (rightValue === null) return 1;
      return leftValue > rightValue ? 1 : -1;
    }
    function sortRuntimeRows(rows, sortRules) {
      const rules = parseSortRules(sortRules);
      if (!rules.length) {
        return rows.slice();
      }
      return rows.slice().sort((leftRow, rightRow) => {
        for (const rule of rules) {
          const compared = compareRuntimeValues(leftRow?.[rule.fieldName], rightRow?.[rule.fieldName]);
          if (compared !== 0) {
            return rule.direction === "DESC" ? -compared : compared;
          }
        }
        return 0;
      });
    }
    function stringifyAggregateValue(value) {
      if (value === null || value === void 0) {
        return "";
      }
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    }
    function buildStringSplitRuntimeRows(rows, splitConfig) {
      const { sourceField, outputField, separator, trimItems, keepEmptyItems, indexField } = splitConfig;
      const safeSeparator = separator || ",";
      const results = [];
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const rawValue = row?.[sourceField];
        const stringValue = rawValue === null || rawValue === void 0 ? "" : String(rawValue);
        const parts = stringValue.split(safeSeparator).map((item) => trimItems ? item.trim() : item);
        const normalizedParts = keepEmptyItems ? parts : parts.filter((item) => item !== "");
        normalizedParts.forEach((part, index) => {
          const nextRow = { ...row || {} };
          if (sourceField !== outputField) {
            delete nextRow[sourceField];
          }
          nextRow[outputField] = part;
          if (indexField) {
            nextRow[indexField] = index + 1;
          }
          results.push(nextRow);
        });
      });
      return results;
    }
    function applyReplaceRuleValue(value, rule) {
      const matchValue = rule.matchValue === void 0 || rule.matchValue === null ? "" : String(rule.matchValue);
      const replaceValue = rule.replaceValue === void 0 || rule.replaceValue === null ? "" : rule.replaceValue;
      const current = value === void 0 || value === null ? "" : String(value);
      if (!matchValue) {
        return current === "" ? replaceValue : value;
      }
      return current === matchValue ? replaceValue : value;
    }
    function formatRuntimeValue(value, rule) {
      const transformType = trimText(rule.transformType);
      if (value === null || value === void 0 || value === "") {
        return "";
      }
      if (transformType === "string_to_number") {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : "";
      }
      if (transformType === "number_to_string") {
        return String(value);
      }
      if (transformType === "datetime_to_date") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? "" : formatDateTime(parsed).slice(0, 10);
      }
      if (["date_to_string", "datetime_to_string"].includes(transformType)) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? String(value) : formatDateTime(parsed);
      }
      if (["string_to_date", "string_to_datetime"].includes(transformType)) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? "" : transformType === "string_to_date" ? formatDateTime(parsed).slice(0, 10) : formatDateTime(parsed);
      }
      return value;
    }
    function evaluateCompliance(value, checkType) {
      return matchesBuiltinValidation(value, checkType);
    }
    function evaluateComplianceRule(row, rule) {
      const sourceValue = row?.[rule.sourceField];
      const validationType = trimText(rule.validationType) || "builtin";
      const sourceText = sourceValue === void 0 || sourceValue === null ? "" : String(sourceValue).trim();
      let matched = false;
      if (validationType === "domain") {
        matched = parseDomainValueList(rule.domainValues).includes(sourceText);
      } else if (validationType === "regex") {
        const patternText = trimText(rule.customPattern);
        if (patternText) {
          try {
            matched = new RegExp(patternText).test(sourceText);
          } catch (error) {
            matched = false;
          }
        }
      } else if (validationType === "fixed_value") {
        matched = sourceText === trimText(rule.fixedValue);
      } else {
        matched = evaluateCompliance(sourceValue, rule.checkType);
      }
      if (trimText(rule.resultMode) === "value") {
        if (matched) {
          return sourceValue;
        }
        return rule.defaultValue === void 0 || rule.defaultValue === null ? "" : rule.defaultValue;
      }
      if (matched) {
        return 1;
      }
      if (rule.defaultValue !== void 0 && rule.defaultValue !== null && String(rule.defaultValue) !== "") {
        return rule.defaultValue;
      }
      return 0;
    }
    function transformStringValue(value, rule) {
      const text = value === void 0 || value === null ? "" : String(value);
      switch (trimText(rule.transformType)) {
        case "trim":
          return text.trim();
        case "remove_prefix":
          return text.slice(Math.max(0, Number(rule.argument1 || 0)));
        case "remove_suffix":
          return text.slice(0, Math.max(0, text.length - Math.max(0, Number(rule.argument1 || 0))));
        case "substring":
          return rule.argument2 ? text.substr(Math.max(0, Number(rule.argument1 || 0)), Math.max(0, Number(rule.argument2 || 0))) : text.slice(Math.max(0, Number(rule.argument1 || 0)));
        case "replace_text":
          return text.split(String(rule.argument1 || "")).join(String(rule.argument2 || ""));
        case "upper":
          return text.toUpperCase();
        case "lower":
          return text.toLowerCase();
        default:
          return text;
      }
    }
    function desensitizeValue(value, rule) {
      const text = value === void 0 || value === null ? "" : String(value);
      const maskType = trimText(rule.transform || rule.maskType) || "mask";
      if (maskType === "encrypt" || maskType === "hash") {
        const algorithm = trimText(rule.encryptAlgorithm || rule.hashAlgorithm) || "md5";
        const salt = trimText(rule.salt);
        const hash = require("crypto").createHash(algorithm === "sha1" ? "sha1" : algorithm === "sha256" ? "sha256" : "md5");
        hash.update(`${text}${salt}`);
        return hash.digest("hex");
      }
      if (maskType === "replace") {
        const pattern = trimText(rule.replacePattern || rule.pattern);
        const replacement = String(rule.replaceValue ?? rule.replacement ?? "");
        if (!pattern) {
          return text;
        }
        try {
          return text.replace(new RegExp(pattern, "g"), replacement);
        } catch (error) {
          return text.includes(pattern) ? text.split(pattern).join(replacement) : text;
        }
      }
      if (maskType === "generalize" || maskType === "truncate") {
        return text.slice(0, Math.max(0, Number(rule.generalizeLength || rule.truncateLength || 0)));
      }
      if (maskType === "randomize") {
        return require("crypto").randomBytes(Math.max(4, Math.min(16, Math.max(1, text.length || 8)))).toString("hex").slice(0, Math.max(8, text.length || 8));
      }
      const prefixLength = Math.max(0, Number(rule.prefixLength || 0));
      const suffixLength = Math.max(0, Number(rule.suffixLength || 0));
      if (text.length <= prefixLength + suffixLength) {
        return text;
      }
      return `${text.slice(0, prefixLength)}${String(rule.maskChar || "*").repeat(Math.max(0, text.length - prefixLength - suffixLength))}${text.slice(text.length - suffixLength)}`;
    }
    function buildCompiledPreviewWithClause(preview) {
      return `WITH
${(preview.nodeSqls || []).filter((item) => item.cteName).map((item) => `${quoteIdentifier(item.cteName, preview.dialect)} AS (
${indentSql(item.sql, 2)}
)`).join(",\n")}`;
    }
    async function materializeCompiledNodeData(task, nodeKey, context, options = {}) {
      const requestedLimit = options.limit === void 0 ? 20 : options.limit;
      const preview = await orchestrationCompiler.compileOrchestrationTask(
        task,
        buildOrchestrationCompilerOptions(task, context, {
          targetNodeKey: nodeKey,
          previewLimit: requestedLimit || 20
        })
      );
      if (!context.adapter || !context.datasource) {
        throw new AppError("Datasource is required for orchestration execution", 400);
      }
      const currentNode = preview.nodeSqls.find((item) => item.nodeKey === preview.finalNodeKey);
      const sqlText = requestedLimit === null || requestedLimit === void 0 ? `${buildCompiledPreviewWithClause(preview)}
SELECT *
FROM ${quoteIdentifier(currentNode?.cteName || preview.finalNodeKey, preview.dialect)}` : preview.previewSql;
      const queryResult = await context.adapter.executeQuery(context.datasource, sqlText, {
        databaseName: context.databaseName || context.datasource.databaseName,
        ...requestedLimit && requestedLimit > 0 ? { resultLimit: requestedLimit } : {}
      });
      const resultPreview = buildResultPreview(queryResult) || { fields: [], rows: [], rowCount: 0 };
      const fields = resultPreview.fields?.length ? resultPreview.fields : preview.finalColumns || [];
      const rows = requestedLimit === null || requestedLimit === void 0 ? queryResult.rows || [] : resultPreview.rows || [];
      return {
        preview,
        currentNode,
        fields,
        rows,
        rowCount: requestedLimit === null || requestedLimit === void 0 ? Number(queryResult.rowCount || rows.length) : resultPreview.rowCount || rows.length,
        warnings: preview.warnings || [],
        columnMeta: buildRuntimeColumnMeta(fields, rows)
      };
    }
    function buildOutputRows(rows, mappings) {
      const normalizedMappings = parseOutputFieldMappings(mappings);
      if (!normalizedMappings.length) {
        return rows.map((row) => ({ ...row || {} }));
      }
      return rows.map(
        (row) => normalizedMappings.reduce((result, mapping) => {
          result[mapping.targetField] = row?.[mapping.sourceField];
          return result;
        }, {})
      );
    }
    async function materializeRuntimeNodeRows(task, nodeKey, context, options = {}, cache = /* @__PURE__ */ new Map()) {
      const cacheKey = `${nodeKey}::${options.limit === null || options.limit === void 0 ? "all" : options.limit}`;
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
      }
      const node = findOrchestrationNode(task, nodeKey);
      const { incoming } = buildOrchestrationEdgeMaps(task);
      const nodeIncomingEdges = incoming.get(nodeKey) || [];
      const promise = (async () => {
        const warnings = [];
        if (!orchestrationLineageContainsRuntimeOperator(task, nodeKey)) {
          return materializeCompiledNodeData(task, nodeKey, context, options);
        }
        const inputResults = [];
        for (const edge of nodeIncomingEdges) {
          const sourceNode = findOrchestrationNode(task, edge.sourceNodeKey);
          const sourceResult = await materializeRuntimeNodeRows(task, edge.sourceNodeKey, context, options, cache);
          if (trimText(sourceNode.operatorCode) === "branch") {
            const filteredRows = evaluateRuleGroup(
              sourceResult.rows || [],
              sourceNode.nodeConfig?.branchRules,
              sourceNode.nodeConfig?.branchLogic
            );
            const trueRows = filteredRows;
            const falseRows = (sourceResult.rows || []).filter((row) => !trueRows.includes(row));
            inputResults.push({
              ...sourceResult,
              sourceNodeKey: edge.sourceNodeKey,
              rows: trimText(edge.sourcePort) === "branch_false" ? falseRows : trueRows,
              rowCount: trimText(edge.sourcePort) === "branch_false" ? falseRows.length : trueRows.length
            });
          } else {
            inputResults.push({
              ...sourceResult,
              sourceNodeKey: edge.sourceNodeKey
            });
          }
          warnings.push(...sourceResult.warnings || []);
        }
        if (node.nodeType === "source") {
          const sourceResult = await materializeCompiledNodeData(task, nodeKey, context, options);
          warnings.push(...sourceResult.warnings || []);
          return { ...sourceResult, warnings: uniqueStrings(warnings.concat(sourceResult.warnings || [])) };
        }
        if (node.nodeType === "output") {
          if (inputResults.length !== 1) {
            throw new AppError(`Output node ${node.nodeName} must have exactly one upstream node`, 400);
          }
          const rows2 = buildOutputRows(inputResults[0].rows || [], node.nodeConfig?.outputFieldMappings);
          const fields2 = rows2[0] ? Object.keys(rows2[0]) : parseOutputFieldMappings(node.nodeConfig?.outputFieldMappings).map((item) => item.targetField);
          return {
            fields: fields2,
            rows: options.limit ? previewRows(rows2, options.limit) : rows2,
            rowCount: rows2.length,
            warnings: uniqueStrings(warnings),
            columnMeta: buildRuntimeColumnMeta(fields2, rows2)
          };
        }
        const operatorCode = normalizeAiOperatorCode(node.operatorCode);
        if (operatorCode === "llm_row" || operatorCode === "llm_batch") {
          if (inputResults.length !== 1) {
            throw new AppError(`AI node ${node.nodeName} must have exactly one upstream node`, 400);
          }
          const upstreamResult = inputResults[0];
          const modelProviderId = Number(node.nodeConfig?.modelProviderId || 0);
          if (!modelProviderId) {
            throw new AppError(`AI node ${node.nodeName} must select a model configuration`, 400);
          }
          const provider = await modelProviderService.getModelProviderById(modelProviderId);
          const runtimeProvider = modelProviderService.applyModelSelection(provider, {
            modelName: trimText(node.nodeConfig?.modelName),
            modelVersion: trimText(node.nodeConfig?.modelVersion)
          });
          const outputFields = normalizeAiOutputFields(
            node.nodeConfig?.outputFields,
            node.nodeConfig?.outputFieldName,
            getAiFallbackFieldName(operatorCode)
          );
          const promptMappings = normalizePromptVariableMappings(node.nodeConfig?.promptVariables);
          const rows2 = [];
          if (operatorCode === "llm_batch") {
            const result = await requestAiNodeOutput(
              runtimeProvider,
              trimText(node.nodeConfig?.systemPrompt),
              trimText(node.nodeConfig?.userPrompt),
              buildBatchPromptVariables(upstreamResult.rows || [], promptMappings),
              outputFields
            );
            warnings.push(...result.warnings);
            rows2.push({ ...result.values });
          } else {
            for (let index = 0; index < (upstreamResult.rows || []).length; index += 1) {
              const row = upstreamResult.rows[index];
              const result = await requestAiNodeOutput(
                runtimeProvider,
                trimText(node.nodeConfig?.systemPrompt),
                trimText(node.nodeConfig?.userPrompt),
                buildPromptVariables(row, index, promptMappings),
                outputFields
              );
              warnings.push(...result.warnings);
              rows2.push({
                ...row,
                ...result.values
              });
            }
          }
          const fields2 = rows2[0] ? Object.keys(rows2[0]) : operatorCode === "llm_batch" ? outputFields.map((item) => item.fieldName) : uniqueStrings((upstreamResult.fields || []).concat(outputFields.map((item) => item.fieldName)));
          return {
            fields: fields2,
            rows: options.limit ? previewRows(rows2, options.limit) : rows2,
            rowCount: rows2.length,
            warnings: uniqueStrings(warnings),
            columnMeta: buildRuntimeColumnMeta(fields2, rows2)
          };
        }
        if (!inputResults.length && node.nodeType === "operator") {
          throw new AppError(`Node ${node.nodeName} has no active upstream input`, 400);
        }
        const primary = inputResults.find((item) => item.sourceNodeKey === trimText(node.nodeConfig?.schemaSourceNodeKey)) || inputResults[0] || { fields: [], rows: [] };
        let rows = (primary.rows || []).map((row) => ({ ...row || {} }));
        switch (trimText(node.operatorCode)) {
          case "filter": {
            const runtimeFilterRules = await resolveRuntimeFilterRules(inputResults, primary, node.nodeConfig?.filterRules, context);
            rows = evaluateRuleGroup(rows, runtimeFilterRules, node.nodeConfig?.filterLogic);
            break;
          }
          case "branch":
            break;
          case "select_columns": {
            const selectedColumns = parseStringArray(node.nodeConfig?.selectedColumns);
            rows = rows.map(
              (row) => (selectedColumns.length ? selectedColumns : Object.keys(row || {})).reduce((result, fieldName) => {
                result[fieldName] = row?.[fieldName];
                return result;
              }, {})
            );
            break;
          }
          case "rename_fields": {
            const renameMappings = parseObjectArray(node.nodeConfig?.renameMappings).map((item) => ({ sourceField: trimText(item.sourceField), targetField: trimText(item.targetField) })).filter((item) => item.sourceField && item.targetField);
            rows = rows.map((row) => {
              const nextRow = { ...row || {} };
              renameMappings.forEach((mapping) => {
                nextRow[mapping.targetField] = nextRow[mapping.sourceField];
                if (mapping.sourceField !== mapping.targetField) {
                  delete nextRow[mapping.sourceField];
                }
              });
              return nextRow;
            });
            break;
          }
          case "sort":
            rows = sortRuntimeRows(rows, node.nodeConfig?.sortFields);
            break;
          case "limit_rows":
            rows = rows.slice(0, Math.max(1, Number(node.nodeConfig?.limitCount || 100)));
            break;
          case "deduplicate": {
            const keys = parseStringArray(node.nodeConfig?.dedupeKeys);
            rows = sortRuntimeRows(rows, node.nodeConfig?.dedupeSortFields);
            const seen = /* @__PURE__ */ new Set();
            rows = rows.filter((row) => {
              const key = JSON.stringify(keys.map((fieldName) => row?.[fieldName]));
              if (seen.has(key)) {
                return false;
              }
              seen.add(key);
              return true;
            });
            break;
          }
          case "replace": {
            const fieldName = trimText(node.nodeConfig?.fieldName);
            const replaceRules = parseReplaceRules(node.nodeConfig?.replaceRules);
            rows = rows.map((row) => {
              const nextRow = { ...row || {} };
              replaceRules.forEach((rule) => {
                nextRow[fieldName] = applyReplaceRuleValue(nextRow[fieldName], rule);
              });
              return nextRow;
            });
            break;
          }
          case "format_convert": {
            const formatRules = parseFormatRules(node.nodeConfig?.formatRules);
            rows = rows.map((row) => {
              const nextRow = { ...row || {} };
              formatRules.forEach((rule) => {
                nextRow[rule.targetField] = formatRuntimeValue(row?.[rule.sourceField], rule);
              });
              return nextRow;
            });
            break;
          }
          case "compliance_check": {
            const complianceRules = parseComplianceRules(node.nodeConfig?.complianceRules);
            rows = rows.map((row) => {
              const nextRow = { ...row || {} };
              complianceRules.forEach((rule) => {
                nextRow[rule.targetField] = evaluateComplianceRule(row, rule);
              });
              return nextRow;
            });
            break;
          }
          case "string_transform": {
            const stringRules = parseStringRules(node.nodeConfig?.stringRules);
            rows = rows.map((row) => {
              const nextRow = { ...row || {} };
              stringRules.forEach((rule) => {
                nextRow[rule.targetField] = transformStringValue(row?.[rule.sourceField], rule);
              });
              return nextRow;
            });
            break;
          }
          case "desensitize": {
            const desensitizeRules = parseDesensitizeRules(node.nodeConfig?.desensitizeRules);
            rows = rows.map((row) => {
              const nextRow = { ...row || {} };
              desensitizeRules.forEach((rule) => {
                nextRow[rule.targetField] = desensitizeValue(row?.[rule.sourceField], rule);
              });
              return nextRow;
            });
            break;
          }
          case "union": {
            const mappings = parseColumnAlignmentRows(node.nodeConfig?.columnMappings);
            const unionMode = trimText(node.nodeConfig?.unionMode) || "all";
            if (mappings.length) {
              rows = inputResults.flatMap(
                (result) => (result.rows || []).map(
                  (row) => mappings.reduce((output, mapping) => {
                    const binding = (mapping.bindings || []).find((item) => item.sourceNodeKey === result.sourceNodeKey) || (mapping.bindings || [])[0];
                    output[mapping.outputField] = binding?.fieldName ? row?.[binding.fieldName] : null;
                    return output;
                  }, {})
                )
              );
            } else {
              const allFields = uniqueStrings(inputResults.flatMap((result) => result.fields || []));
              rows = inputResults.flatMap(
                (result) => (result.rows || []).map(
                  (row) => allFields.reduce((output, fieldName) => {
                    output[fieldName] = row?.[fieldName];
                    return output;
                  }, {})
                )
              );
            }
            if (unionMode === "distinct") {
              const seen = /* @__PURE__ */ new Set();
              rows = rows.filter((row) => {
                const key = JSON.stringify(row);
                if (seen.has(key)) {
                  return false;
                }
                seen.add(key);
                return true;
              });
            }
            break;
          }
          case "join": {
            if (inputResults.length !== 2) {
              throw new AppError(`Join node ${node.nodeName} must have exactly two upstream nodes`, 400);
            }
            const [leftResult, rightResult] = inputResults;
            const joinType = trimText(node.nodeConfig?.joinType) || "left";
            const joinKeys = parseJoinKeyRules(node.nodeConfig?.joinKeys);
            const leftOutputFields = parseStringArray(node.nodeConfig?.leftOutputFields);
            const rightOutputFields = parseStringArray(node.nodeConfig?.rightOutputFields);
            const leftFields = leftOutputFields.length ? leftOutputFields : leftResult.fields || [];
            const rightFields = rightOutputFields.length ? rightOutputFields : rightResult.fields || [];
            const buildJoinedRow = (leftRow, rightRow) => {
              const output = {};
              leftFields.forEach((fieldName) => {
                output[fieldName] = leftRow?.[fieldName];
              });
              rightFields.forEach((fieldName) => {
                const outputField = Object.prototype.hasOwnProperty.call(output, fieldName) ? `right_${fieldName}` : fieldName;
                output[outputField] = rightRow?.[fieldName];
              });
              return output;
            };
            const matches = (leftRow, rightRow) => !joinKeys.length || joinKeys.every((rule) => String(leftRow?.[rule.leftField] ?? "") === String(rightRow?.[rule.rightField] ?? ""));
            const joinedRows = [];
            const matchedRightIndexes = /* @__PURE__ */ new Set();
            (leftResult.rows || []).forEach((leftRow) => {
              const rightMatches = (rightResult.rows || []).map((rightRow, index) => ({ rightRow, index })).filter((item) => matches(leftRow, item.rightRow));
              if (rightMatches.length) {
                rightMatches.forEach((item) => {
                  matchedRightIndexes.add(item.index);
                  joinedRows.push(buildJoinedRow(leftRow, item.rightRow));
                });
              } else if (["left", "full"].includes(joinType)) {
                joinedRows.push(buildJoinedRow(leftRow, null));
              }
            });
            if (["right", "full"].includes(joinType)) {
              (rightResult.rows || []).forEach((rightRow, index) => {
                if (!matchedRightIndexes.has(index)) {
                  joinedRows.push(buildJoinedRow(null, rightRow));
                }
              });
            }
            if (joinType === "inner") {
              rows = joinedRows.filter((row) => Object.values(row).some((value) => value !== void 0 && value !== null));
            } else if (joinType === "cross") {
              rows = (leftResult.rows || []).flatMap((leftRow) => (rightResult.rows || []).map((rightRow) => buildJoinedRow(leftRow, rightRow)));
            } else {
              rows = joinedRows;
            }
            break;
          }
          case "string_aggregate": {
            const groupByFields = parseStringArray(node.nodeConfig?.groupByFields);
            const aggregateRules = parseStringAggregateRules(node.nodeConfig?.stringAggregateRules);
            const groups = /* @__PURE__ */ new Map();
            rows.forEach((row) => {
              const key = JSON.stringify(groupByFields.map((fieldName) => row?.[fieldName]));
              groups.set(key, [...groups.get(key) || [], row]);
            });
            rows = Array.from(groups.values()).map((groupRows) => {
              const base = {};
              groupByFields.forEach((fieldName) => {
                base[fieldName] = groupRows[0]?.[fieldName];
              });
              aggregateRules.forEach((rule) => {
                const values = groupRows.map((row) => stringifyAggregateValue(row?.[rule.sourceField])).filter((value) => value !== "");
                const normalizedValues = rule.distinct ? Array.from(new Set(values)) : values;
                base[rule.outputField] = normalizedValues.join(rule.separator === void 0 || rule.separator === null ? "," : String(rule.separator));
              });
              return base;
            });
            break;
          }
          case "string_split": {
            const splitConfig = parseStringSplitConfig(node.nodeConfig);
            rows = buildStringSplitRuntimeRows(rows, splitConfig);
            break;
          }
          case "aggregate": {
            const groupByFields = parseStringArray(node.nodeConfig?.groupByFields);
            const aggregationRules = parseAggregationRules(node.nodeConfig?.aggregations);
            const groups = /* @__PURE__ */ new Map();
            rows.forEach((row) => {
              const key = JSON.stringify(groupByFields.map((fieldName) => row?.[fieldName]));
              groups.set(key, [...groups.get(key) || [], row]);
            });
            rows = Array.from(groups.values()).map((groupRows) => {
              const base = {};
              groupByFields.forEach((fieldName) => {
                base[fieldName] = groupRows[0]?.[fieldName];
              });
              aggregationRules.forEach((rule) => {
                const values = groupRows.map((row) => row?.[rule.fieldName]).filter((value) => value !== null && value !== void 0 && value !== "");
                const alias = rule.alias || `${rule.aggregateFunction}_${rule.fieldName && rule.fieldName !== "__all__" ? rule.fieldName : "rows"}`;
                switch (rule.aggregateFunction) {
                  case "count_distinct":
                    base[alias] = new Set(values.map((value) => String(value))).size;
                    break;
                  case "sum":
                    base[alias] = values.reduce((sum, value) => sum + Number(value || 0), 0);
                    break;
                  case "avg":
                    base[alias] = values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
                    break;
                  case "max":
                    base[alias] = values.length ? values.reduce((max, value) => compareRuntimeValues(value, max) > 0 ? value : max, values[0]) : null;
                    break;
                  case "min":
                    base[alias] = values.length ? values.reduce((min, value) => compareRuntimeValues(value, min) < 0 ? value : min, values[0]) : null;
                    break;
                  case "count":
                  default:
                    base[alias] = rule.fieldName && rule.fieldName !== "__all__" ? values.length : groupRows.length;
                    break;
                }
              });
              return base;
            });
            break;
          }
          default:
            throw new AppError(`Runtime preview/run after AI does not support operator ${node.nodeName} / ${node.operatorCode} yet`, 400);
        }
        const fields = rows[0] ? Object.keys(rows[0]) : trimText(node.operatorCode) === "string_aggregate" ? parseStringArray(node.nodeConfig?.groupByFields).concat(parseStringAggregateRules(node.nodeConfig?.stringAggregateRules).map((item) => item.outputField)) : trimText(node.operatorCode) === "string_split" ? (() => {
          const splitConfig = parseStringSplitConfig(node.nodeConfig);
          const baseFields = (primary.fields || []).map((fieldName) => fieldName === splitConfig.sourceField ? splitConfig.outputField : fieldName);
          if (!baseFields.includes(splitConfig.outputField)) {
            baseFields.push(splitConfig.outputField);
          }
          if (splitConfig.indexField) {
            baseFields.push(splitConfig.indexField);
          }
          return baseFields;
        })() : primary.fields || [];
        return {
          fields,
          rows: options.limit ? previewRows(rows, options.limit) : rows,
          rowCount: rows.length,
          warnings: uniqueStrings(warnings),
          columnMeta: buildRuntimeColumnMeta(fields, rows)
        };
      })();
      cache.set(cacheKey, promise);
      return promise;
    }
    async function materializeRuntimeNodePreview(task, nodeKey, context, previewLimit) {
      const preview = await orchestrationCompiler.compileOrchestrationTask(
        task,
        buildOrchestrationCompilerOptions(task, context, {
          targetNodeKey: nodeKey,
          previewLimit
        })
      );
      const currentNode = preview.nodeSqls.find((item) => item.nodeKey === preview.finalNodeKey);
      const runtimeData = await materializeRuntimeNodeRows(task, nodeKey, context, { limit: previewLimit }, /* @__PURE__ */ new Map());
      return {
        preview,
        currentNode,
        fields: runtimeData.fields || preview.finalColumns || [],
        rows: runtimeData.rows || [],
        rowCount: runtimeData.rowCount || 0,
        warnings: uniqueStrings((preview.warnings || []).concat(runtimeData.warnings || [])),
        columnMeta: runtimeData.columnMeta || buildRuntimeColumnMeta(runtimeData.fields || preview.finalColumns || [], runtimeData.rows || [])
      };
    }
    function resolveRuntimeSqlType(fieldName, rows, dialect) {
      const inferredType = inferRuntimeColumnDataType(fieldName, rows);
      const normalizedDialect2 = normalizeDatasourceType(dialect);
      if (["integer", "boolean"].includes(inferredType)) {
        return normalizedDialect2 === "oracle" ? "NUMBER(38)" : normalizedDialect2 === "postgresql" ? "BIGINT" : normalizedDialect2 === "clickhouse" ? "Int64" : normalizedDialect2 === "hive" ? "BIGINT" : "BIGINT";
      }
      if (inferredType === "number") {
        return normalizedDialect2 === "oracle" ? "NUMBER(18,6)" : normalizedDialect2 === "postgresql" ? "NUMERIC(18,6)" : normalizedDialect2 === "clickhouse" ? "Float64" : normalizedDialect2 === "hive" ? "DOUBLE" : "DECIMAL(18,6)";
      }
      if (inferredType === "date") {
        return "DATE";
      }
      if (inferredType === "datetime") {
        return ["postgresql", "oracle", "dm"].includes(normalizedDialect2) ? "TIMESTAMP" : normalizedDialect2 === "clickhouse" ? "DateTime" : normalizedDialect2 === "hive" ? "TIMESTAMP" : "DATETIME";
      }
      return normalizedDialect2 === "postgresql" ? "TEXT" : normalizedDialect2 === "oracle" ? "VARCHAR2(2048)" : normalizedDialect2 === "clickhouse" ? "String" : normalizedDialect2 === "hive" ? "STRING" : "VARCHAR(2048)";
    }
    function buildCreateTableStatement(tableName, fields, rows, dialect, overwrite) {
      const normalizedDialect2 = normalizeSqlDialect(dialect);
      if (normalizedDialect2 === "oracle") {
        const dropSql2 = overwrite ? `BEGIN EXECUTE IMMEDIATE 'DROP TABLE ${quoteIdentifier(tableName, dialect).replace(/'/g, "''")}'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;` : "";
        const createSql2 = `CREATE TABLE ${quoteIdentifier(tableName, dialect)} (
${fields.map((fieldName) => `  ${quoteIdentifier(fieldName, dialect)} ${resolveRuntimeSqlType(fieldName, rows, dialect)}`).join(",\n")}
);`;
        return [dropSql2, createSql2].filter(Boolean);
      }
      const dropSql = overwrite ? `DROP TABLE IF EXISTS ${quoteIdentifier(tableName, dialect)};` : "";
      const createSql = `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName, dialect)} (
${fields.map((fieldName) => `  ${quoteIdentifier(fieldName, dialect)} ${resolveRuntimeSqlType(fieldName, rows, dialect)}`).join(",\n")}
);`;
      return [dropSql, createSql].filter(Boolean);
    }
    function buildInsertStatements(tableName, fields, rows, dialect) {
      if (!fields.length || !rows.length) {
        return [];
      }
      const chunkSize = 200;
      const statements = [];
      for (let index = 0; index < rows.length; index += chunkSize) {
        const chunk = rows.slice(index, index + chunkSize);
        if (normalizeSqlDialect(dialect) === "oracle") {
          const target = quoteIdentifier(tableName, dialect);
          const columns = fields.map((fieldName) => quoteIdentifier(fieldName, dialect)).join(", ");
          statements.push(`INSERT ALL
${chunk.map((row) => `  INTO ${target} (${columns}) VALUES (${fields.map((fieldName) => escapeSqlLiteral(row?.[fieldName])).join(", ")})`).join("\n")}
SELECT 1 FROM DUAL;`);
          continue;
        }
        const valuesSql = chunk.map((row) => `(${fields.map((fieldName) => escapeSqlLiteral(row?.[fieldName])).join(", ")})`).join(",\n");
        statements.push(
          `INSERT INTO ${quoteIdentifier(tableName, dialect)} (${fields.map((fieldName) => quoteIdentifier(fieldName, dialect)).join(", ")})
VALUES
${valuesSql};`
        );
      }
      return statements;
    }
    async function buildOrchestrationExecutionContext(task, options = {}) {
      const environmentBundle = await ensureOrchestrationDatasourceEnvironment(task);
      const effectiveDatasourceId = environmentBundle.effectiveDatasource?.id || task.datasourceId || null;
      if (options.requireDatasource && !effectiveDatasourceId) {
        throw new AppError("The current orchestration task is not bound to an executable datasource and cannot preview node output", 400);
      }
      const datasource = environmentBundle.effectiveDatasource || (effectiveDatasourceId ? materializeDatasource(await requireDatasource(effectiveDatasourceId, true)) : null);
      const adapter = datasource ? getAdapter(datasource) : null;
      const databaseName = task.databaseName || datasource?.databaseName || null;
      const fallbackDialect = inferDatasourceDialect(task.datasourceType || "mysql");
      return {
        effectiveDatasourceId,
        datasource,
        adapter,
        databaseName,
        dialect: datasource?.type || fallbackDialect || "mysql"
      };
    }
    function buildOrchestrationCompilerOptions(task, context, overrides = {}) {
      return {
        datasourceId: context.effectiveDatasourceId,
        datasourceType: context.datasource?.storageType || task.datasourceType || null,
        databaseName: context.databaseName,
        dialect: context.dialect,
        ...overrides,
        async loadSourceColumns(source) {
          if (!context.adapter || !context.datasource) {
            return [];
          }
          return context.adapter.getColumns(
            context.datasource,
            source.databaseName || context.datasource.databaseName,
            source.tableName
          );
        }
      };
    }
    async function materializeCompiledNodePreview(task, nodeKey, context, previewLimit) {
      const preview = await orchestrationCompiler.compileOrchestrationTask(
        task,
        buildOrchestrationCompilerOptions(task, context, {
          targetNodeKey: nodeKey,
          previewLimit
        })
      );
      if (!context.adapter || !context.datasource) {
        throw new AppError("Datasource is required for orchestration node preview", 400);
      }
      const queryResult = await context.adapter.executeQuery(context.datasource, preview.previewSql, {
        databaseName: context.databaseName || context.datasource.databaseName,
        resultLimit: previewLimit
      });
      const resultPreview = buildResultPreview(queryResult) || { fields: [], rows: [], rowCount: 0 };
      const currentNode = preview.nodeSqls.find((item) => item.nodeKey === preview.finalNodeKey);
      return {
        preview,
        currentNode,
        fields: resultPreview.fields?.length ? resultPreview.fields : preview.finalColumns || [],
        rows: resultPreview.rows || [],
        rowCount: resultPreview.rowCount || 0
      };
    }
    async function materializeOrchestrationNodePreviewData(task, nodeKey, context, previewLimit) {
      if (orchestrationLineageContainsRuntimeOperator(task, nodeKey)) {
        return materializeRuntimeNodePreview(task, nodeKey, context, previewLimit);
      }
      const compiled = await materializeCompiledNodePreview(task, nodeKey, context, previewLimit);
      return {
        ...compiled,
        columnMeta: buildRuntimeColumnMeta(compiled.fields?.length ? compiled.fields : compiled.preview.finalColumns || [], compiled.rows || []),
        warnings: compiled.preview.warnings || []
      };
    }
    async function saveOrchestrationGraph(id, graph) {
      await requireOrchestrationTask(id);
      await ensureOrchestrationDatasourceEnvironment({ ...graph, datasourceId: null });
      const nodeKeySet = /* @__PURE__ */ new Set();
      const nodeMap = /* @__PURE__ */ new Map();
      for (const node of graph.nodes) {
        if (nodeKeySet.has(node.nodeKey)) {
          throw new AppError(`Duplicate node key: ${node.nodeKey}`, 400);
        }
        nodeKeySet.add(node.nodeKey);
        nodeMap.set(node.nodeKey, node);
      }
      for (const edge of graph.edges) {
        if (!nodeKeySet.has(edge.sourceNodeKey) || !nodeKeySet.has(edge.targetNodeKey)) {
          throw new AppError("Orchestration edge references a node that does not exist", 400);
        }
        const sourceNode = nodeMap.get(edge.sourceNodeKey);
        if (sourceNode?.nodeType === "operator" && String(sourceNode.operatorCode || "").trim() === "branch") {
          const sourcePort = String(edge.sourcePort || "").trim();
          if (sourcePort && !["branch_true", "branch_false"].includes(sourcePort)) {
            throw new AppError(`Branch node ${sourceNode.nodeName} must connect by true/false output ports`, 400);
          }
        }
      }
      try {
        const activeEdges = graph.edges.filter((edge) => String(edge.edgeStatus || "active").trim().toLowerCase() !== "paused");
        scheduler.buildTopologicalOrder(graph.nodes, activeEdges);
      } catch (error) {
        throw new AppError(error.message || "Orchestration graph is invalid", 400);
      }
      return repository.replaceOrchestrationGraph(id, graph.nodes, graph.edges);
    }
    async function compileOrchestrationSql(id) {
      const task = await requireOrchestrationTask(id);
      const environmentBundle = await ensureOrchestrationDatasourceEnvironment(task);
      if (environmentBundle.sourceDatasourceIds.length > 1 && !environmentBundle.effectiveDatasource) {
        throw new AppError("\u5F53\u524D\u9636\u6BB5 SQL \u9884\u89C8\u4EC5\u652F\u6301\u5355\u6570\u636E\u6E90\u7F16\u6392", 400);
      }
      const effectiveDatasourceId = environmentBundle.effectiveDatasource?.id || task.datasourceId || null;
      const datasource = environmentBundle.effectiveDatasource || (effectiveDatasourceId ? materializeDatasource(await requireDatasource(effectiveDatasourceId, true)) : null);
      const adapter = datasource ? getAdapter(datasource) : null;
      const fallbackDialect = inferDatasourceDialect(task.datasourceType || "mysql");
      return orchestrationCompiler.compileOrchestrationTask(task, {
        datasourceId: effectiveDatasourceId,
        datasourceType: datasource?.storageType || task.datasourceType || null,
        databaseName: task.databaseName || datasource?.databaseName || null,
        dialect: datasource?.type || fallbackDialect || "mysql",
        async loadSourceColumns(source) {
          if (!adapter || !datasource) return [];
          return adapter.getColumns(datasource, source.databaseName || datasource.databaseName, source.tableName);
        }
      });
    }
    async function previewOrchestrationNode(id, nodeKey, options = {}) {
      const task = await requireOrchestrationTask(id);
      const previewContext = await buildOrchestrationExecutionContext(task, { requireDatasource: true });
      const requestedPreviewLimit = normalizePreviewLimit(options.limit);
      const previewStartedAt = Date.now();
      const previewResult = await materializeOrchestrationNodePreviewData(task, nodeKey, previewContext, requestedPreviewLimit);
      const previewData = previewResult.preview;
      const currentPreviewNode = previewResult.currentNode;
      return {
        taskId: previewData.taskId,
        taskName: previewData.taskName,
        nodeKey: previewData.finalNodeKey,
        nodeName: previewData.finalNodeName,
        nodeType: currentPreviewNode?.nodeType || "operator",
        operatorCode: currentPreviewNode?.operatorCode || "",
        cteName: currentPreviewNode?.cteName || null,
        datasourceId: previewContext.effectiveDatasourceId,
        datasourceType: previewContext.datasource?.storageType || previewData.datasourceType || task.datasourceType || null,
        databaseName: previewContext.databaseName,
        dialect: previewData.dialect,
        previewSql: previewData.previewSql,
        nodeSql: currentPreviewNode?.sql || "",
        columns: previewData.finalColumns || [],
        columnMeta: previewResult.columnMeta || buildRuntimeColumnMeta(previewResult.fields?.length ? previewResult.fields : previewData.finalColumns || [], previewResult.rows || []),
        warnings: previewResult.warnings || previewData.warnings || [],
        fields: previewResult.fields?.length ? previewResult.fields : previewData.finalColumns || [],
        rows: previewResult.rows || [],
        rowCount: previewResult.rowCount || 0,
        durationMs: Date.now() - previewStartedAt
      };
    }
    async function runOrchestration(id) {
      const task = await requireOrchestrationTask(id);
      const executionContext = await buildOrchestrationExecutionContext(task, { requireDatasource: true });
      if (!executionContext.adapter || !executionContext.datasource) {
        throw new AppError("The current orchestration task is not bound to an executable datasource", 400);
      }
      const startedAt = Date.now();
      const compiled = await orchestrationCompiler.compileOrchestrationTask(
        task,
        buildOrchestrationCompilerOptions(task, executionContext)
      );
      const outputNodes = (task.nodes || []).filter((node) => node.nodeType === "output");
      if (!outputNodes.length) {
        throw new AppError("The current orchestration task has no executable output node. Please configure at least one data output operator.", 400);
      }
      const databaseName = executionContext.databaseName || executionContext.datasource.databaseName;
      const useRowRuntime = compiled.hasRuntimeOperators || outputNodes.some(
        (node) => Boolean(node.nodeConfig?.createTargetTable) || parseOutputFieldMappings(node.nodeConfig?.outputFieldMappings).length
      );
      let statementCount = 0;
      const runtimeWarnings = [...filterRunWarnings(compiled.warnings || [])];
      if (!useRowRuntime && compiled.outputStatements.length) {
        for (const statement of compiled.outputStatements) {
          await executionContext.adapter.executeStatement(executionContext.datasource, statement.sql, {
            databaseName
          });
          statementCount += 1;
        }
      } else {
        const runtimeCache = /* @__PURE__ */ new Map();
        for (const outputNode of outputNodes) {
          const targetTable = trimText(outputNode.nodeConfig?.targetTable);
          if (!targetTable) {
            throw new AppError(`Output node ${outputNode.nodeName} must configure a target table`, 400);
          }
          const writeMode = trimText(outputNode.nodeConfig?.writeMode) || "overwrite";
          if (writeMode === "upsert") {
            throw new AppError(`Output node ${outputNode.nodeName} does not support upsert in mixed runtime mode yet`, 400);
          }
          const outputResult = orchestrationLineageContainsRuntimeOperator(task, outputNode.nodeKey) ? await materializeRuntimeNodeRows(task, outputNode.nodeKey, executionContext, { limit: null }, runtimeCache) : await materializeCompiledNodeData(task, outputNode.nodeKey, executionContext, { limit: null });
          runtimeWarnings.push(...outputResult.warnings || []);
          const fields = outputResult.fields?.length ? outputResult.fields : parseOutputFieldMappings(outputNode.nodeConfig?.outputFieldMappings).map((item) => item.targetField);
          const rows = outputResult.rows || [];
          const statements = [];
          if (outputNode.nodeConfig?.createTargetTable) {
            statements.push(...buildCreateTableStatement(targetTable, fields, rows, executionContext.dialect, writeMode === "overwrite"));
          } else if (writeMode === "overwrite") {
            statements.push(`TRUNCATE TABLE ${quoteIdentifier(targetTable, executionContext.dialect)};`);
          }
          statements.push(...buildInsertStatements(targetTable, fields, rows, executionContext.dialect));
          for (const sqlText of statements) {
            await executionContext.adapter.executeStatement(executionContext.datasource, sqlText, {
              databaseName
            });
            statementCount += 1;
          }
        }
      }
      return {
        taskId: compiled.taskId,
        taskName: compiled.taskName,
        datasourceId: executionContext.effectiveDatasourceId,
        datasourceType: executionContext.datasource.storageType || compiled.datasourceType || null,
        databaseName,
        dialect: compiled.dialect,
        executedAt: formatDateTime(),
        durationMs: Date.now() - startedAt,
        statementCount,
        targetTables: outputNodes.map((item) => trimText(item.nodeConfig?.targetTable)).filter(Boolean),
        warnings: filterRunWarnings(runtimeWarnings)
      };
    }
    async function createWorkflow(payload) {
      if (payload.cronExpr && !scheduler.validateCronExpression(payload.cronExpr)) {
        throw new AppError("Cron \u8868\u8FBE\u5F0F\u683C\u5F0F\u4E0D\u6B63\u786E", 400);
      }
      const workflow = await repository.createWorkflow(payload);
      await scheduler.reloadSchedules();
      return workflow;
    }
    function buildTaskWorkflowGraph(taskType, task) {
      const taskConfig = {
        script: {
          nodeType: "script",
          idField: "scriptId",
          description: "SQL\u4EFB\u52A1"
        },
        processing: {
          nodeType: "processing",
          idField: "processingJobId",
          description: "\u6570\u636E\u5904\u7406\u4EFB\u52A1"
        },
        operator_task: {
          nodeType: "operator_task",
          idField: "orchestrationTaskId",
          description: "\u7B97\u5B50\u5E73\u53F0\u4EFB\u52A1"
        }
      }[taskType];
      if (!taskConfig) {
        throw new AppError("\u4E0D\u652F\u6301\u7684\u8C03\u5EA6\u4EFB\u52A1\u7C7B\u578B", 400);
      }
      return {
        description: taskConfig.description,
        nodes: [
          {
            nodeType: "start",
            nodeKey: "start",
            nodeName: "\u5F00\u59CB",
            positionX: 80,
            positionY: 220,
            width: 240,
            height: 88,
            retryTimes: null,
            retryIntervalSec: 5,
            timeoutSec: null,
            triggerRule: "all_success",
            nodeConfig: {}
          },
          {
            nodeType: taskConfig.nodeType,
            [taskConfig.idField]: task.id,
            nodeKey: "task",
            nodeName: task.name,
            positionX: 400,
            positionY: 220,
            width: 240,
            height: 88,
            retryTimes: null,
            retryIntervalSec: 5,
            timeoutSec: null,
            triggerRule: "all_success",
            nodeConfig: {}
          },
          {
            nodeType: "end",
            nodeKey: "end",
            nodeName: "\u7ED3\u675F",
            positionX: 720,
            positionY: 220,
            width: 240,
            height: 88,
            retryTimes: null,
            retryIntervalSec: 5,
            timeoutSec: null,
            triggerRule: "all_success",
            nodeConfig: {}
          }
        ],
        edges: [
          { sourceNodeKey: "start", targetNodeKey: "task", edgeType: "default", edgeLabel: "default" },
          { sourceNodeKey: "task", targetNodeKey: "end", edgeType: "default", edgeLabel: "default" }
        ]
      };
    }
    async function createWorkflowFromTask(payload) {
      const requireTask = {
        script: requireScript,
        processing: requireProcessingJob,
        operator_task: requireOrchestrationTask
      }[payload.taskType];
      if (!requireTask) {
        throw new AppError("\u4E0D\u652F\u6301\u7684\u8C03\u5EA6\u4EFB\u52A1\u7C7B\u578B", 400);
      }
      const task = await requireTask(payload.taskId);
      const graph = buildTaskWorkflowGraph(payload.taskType, task);
      const defaultName = `${task.name}-\u8C03\u5EA6\u5DE5\u4F5C\u6D41`.slice(0, 128);
      const workflow = await repository.createWorkflow({
        name: payload.name || defaultName,
        description: `\u7531${graph.description}\u3010${task.name}\u3011\u4E00\u952E\u521B\u5EFA`,
        cronExpr: null,
        isPaused: true,
        retryTimes: 0,
        timeoutSec: 300,
        runtimeConfig: {
          sourceTask: {
            taskType: payload.taskType,
            taskId: task.id
          }
        }
      });
      try {
        const saved = await saveWorkflowGraph(workflow.id, graph);
        await scheduler.reloadSchedules();
        return saved;
      } catch (error) {
        await repository.deleteWorkflow(workflow.id);
        throw error;
      }
    }
    async function updateWorkflow(id, payload) {
      const current = await requireWorkflow(id);
      if (payload.cronExpr && !scheduler.validateCronExpression(payload.cronExpr)) {
        throw new AppError("Cron \u8868\u8FBE\u5F0F\u683C\u5F0F\u4E0D\u6B63\u786E", 400);
      }
      if (payload.cronExpr && !payload.isPaused && !current.publishedVersionNo) {
        throw new AppError("\u5DE5\u4F5C\u6D41\u5C1A\u65E0\u53EF\u8FD0\u884C\u7684\u53D1\u5E03\u7248\u672C\uFF0C\u8BF7\u5148\u5B8C\u6210\u5E76\u4FDD\u5B58\u5DE5\u4F5C\u6D41\u753B\u5E03", 400);
      }
      const workflow = await repository.updateWorkflow(id, payload);
      await scheduler.reloadSchedules();
      return workflow;
    }
    async function deleteWorkflow(id) {
      const deleted = await repository.deleteWorkflow(id);
      if (!deleted) {
        throw new AppError("Workflow not found", 404);
      }
      await scheduler.reloadSchedules();
    }
    async function saveWorkflowGraph(id, graph) {
      const currentWorkflow = await requireWorkflow(id);
      const nodeKeySet = /* @__PURE__ */ new Set();
      for (const node of graph.nodes) {
        if (nodeKeySet.has(node.nodeKey)) {
          throw new AppError(`Duplicate node key: ${node.nodeKey}`, 400);
        }
        nodeKeySet.add(node.nodeKey);
        if (node.nodeType === "script") {
          if (!node.scriptId) {
            throw new AppError(`Script node ${node.nodeName} must bind a script`, 400);
          }
          await requireScript(node.scriptId);
        }
        if (node.nodeType === "processing") {
          if (!node.processingJobId) {
            throw new AppError(`\u6570\u636E\u5904\u7406\u8282\u70B9 ${node.nodeName} \u5FC5\u987B\u7ED1\u5B9A\u6570\u636E\u5904\u7406\u4EFB\u52A1`, 400);
          }
          await requireProcessingJob(node.processingJobId);
        }
        if (node.nodeType === "operator_task") {
          if (!node.orchestrationTaskId) {
            throw new AppError(`\u7B97\u5B50\u4EFB\u52A1\u8282\u70B9 ${node.nodeName} \u5FC5\u987B\u7ED1\u5B9A\u7B97\u5B50\u4EFB\u52A1`, 400);
          }
          await requireOrchestrationTask(node.orchestrationTaskId);
        }
        if (node.nodeType === "branch" && node.nodeConfig?.datasourceId) {
          await requireDatasource(Number(node.nodeConfig.datasourceId));
        }
      }
      for (const edge of graph.edges) {
        if (!nodeKeySet.has(edge.sourceNodeKey) || !nodeKeySet.has(edge.targetNodeKey)) {
          throw new AppError("Workflow edge references a node that does not exist", 400);
        }
      }
      const draftValidation = validateWorkflowGraph({
        ...currentWorkflow,
        nodes: graph.nodes,
        edges: graph.edges
      }, { strict: false });
      if (!draftValidation.valid) {
        throw new AppError(draftValidation.errors[0] || "\u5DE5\u4F5C\u6D41\u56FE\u5B58\u5728\u73AF\u8DEF\u6216\u65E0\u6548\u8FDE\u7EBF", 400);
      }
      const workflow = await repository.replaceWorkflowGraph(id, graph.nodes, graph.edges);
      const validation = validateWorkflowGraph(workflow, { strict: true });
      if (validation.valid) {
        await publishWorkflowGraph(workflow, validation);
      }
      return repository.getWorkflowById(id);
    }
    async function validateWorkflow(id) {
      const workflow = await requireWorkflow(id);
      return validateWorkflowGraph(workflow, { strict: true });
    }
    async function runWorkflow(id, options = {}) {
      const workflow = await requireWorkflow(id);
      const validation = validateWorkflowGraph(workflow, { strict: true });
      if (!validation.valid) {
        throw new AppError(validation.errors.join("; "), 400);
      }
      let version = await repository.getPublishedWorkflowVersion(id);
      if (!version) {
        version = await publishWorkflowGraph(workflow, validation);
      }
      const run = await repository.createWorkflowRun({
        workflowId: id,
        triggerType: options.triggerType || "manual",
        runParams: options.runParams || {},
        status: "pending",
        workflowVersionNo: version.versionNo,
        graphSnapshot: version.graphSnapshot,
        workflowRetryCount: 0,
        startedAt: null
      });
      scheduler.enqueueWorkflowRun(run.id);
      return run;
    }
    async function listWorkflowRuns(id) {
      await requireWorkflow(id);
      return repository.listWorkflowRuns(id);
    }
    async function listInstances(filters) {
      return repository.listInstances(filters);
    }
    async function getInstance(id) {
      const instance = await repository.getJobInstanceById(id);
      if (!instance) {
        throw new AppError("Instance not found", 404);
      }
      return instance;
    }
    async function listInstanceLogs(id) {
      await getInstance(id);
      return repository.listJobLogs(id);
    }
    module2.exports = {
      buildTaskWorkflowGraph,
      createOrchestrationTask,
      createProcessingJob,
      createDatasource,
      createScript,
      createScriptFolder,
      createWorkflow,
      createWorkflowFromTask,
      deleteOrchestrationTask,
      deleteProcessingJob,
      deleteDatasource,
      deleteScript,
      deleteScriptFolder,
      deleteWorkflow,
      executeQuery,
      getDatasource,
      getInstance,
      getOrchestrationTask,
      getProcessingJob,
      getScript,
      getWorkflow,
      listDatasourceColumns,
      listDatasourceFunctions,
      listDatasourceDatabases,
      listDatasourceTables,
      listDatasources,
      listInstanceLogs,
      listInstances,
      listOrchestrationTasks,
      listProcessingJobs,
      listProcessingJobRuns,
      compileOrchestrationSql,
      previewProcessingJob,
      previewProcessingJobDraft,
      previewOrchestrationNode,
      runProcessingJob,
      runOrchestration,
      listQueryHistory,
      listCopilotSessionMessages,
      listCopilotSessions,
      runCopilotTask,
      runCopilotTaskStream,
      listScriptFolders,
      listScriptVersions,
      listScripts,
      listWorkflowRuns,
      listWorkflows,
      runWorkflow,
      saveOrchestrationGraph,
      saveScriptAs,
      saveScriptVersion,
      saveWorkflowGraph,
      testDatasource,
      testDatasourceConfig,
      updateOrchestrationTask,
      updateProcessingJob,
      updateDatasource,
      updateScript,
      updateScriptFolder,
      updateWorkflow,
      validateWorkflowGraph,
      validateWorkflow
    };
  }
});

// backend/src/modules/data-development/data-development.controller.js
var require_data_development_controller = __commonJS({
  "backend/src/modules/data-development/data-development.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var service = require_data_development_service();
    async function listDatasources(req, res) {
      const rows = await service.listDatasources();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getDatasource(req, res) {
      return sendSuccess(res, await service.getDatasource(Number(req.params.id)));
    }
    async function createDatasource(req, res) {
      return sendSuccess(res, await service.createDatasource(req.validatedBody), null, 201);
    }
    async function updateDatasource(req, res) {
      return sendSuccess(res, await service.updateDatasource(Number(req.params.id), req.validatedBody));
    }
    async function deleteDatasource(req, res) {
      await service.deleteDatasource(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function testDatasource(req, res) {
      return sendSuccess(res, await service.testDatasource(Number(req.params.id)));
    }
    async function testDatasourceConfig(req, res) {
      return sendSuccess(res, await service.testDatasourceConfig(req.validatedBody));
    }
    async function listDatasourceDatabases(req, res) {
      const rows = await service.listDatasourceDatabases(Number(req.params.id));
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listDatasourceTables(req, res) {
      const rows = await service.listDatasourceTables(Number(req.params.id), req.query.databaseName);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listDatasourceColumns(req, res) {
      const rows = await service.listDatasourceColumns(Number(req.params.id), req.query.databaseName, req.query.tableName);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listDatasourceFunctions(req, res) {
      const rows = await service.listDatasourceFunctions(Number(req.params.id), req.query.databaseName);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listScriptFolders(req, res) {
      const rows = await service.listScriptFolders();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createScriptFolder(req, res) {
      return sendSuccess(res, await service.createScriptFolder(req.validatedBody), null, 201);
    }
    async function updateScriptFolder(req, res) {
      return sendSuccess(res, await service.updateScriptFolder(Number(req.params.id), req.validatedBody));
    }
    async function deleteScriptFolder(req, res) {
      await service.deleteScriptFolder(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function listScripts(req, res) {
      const rows = await service.listScripts(req.query);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getScript(req, res) {
      return sendSuccess(res, await service.getScript(Number(req.params.id)));
    }
    async function createScript(req, res) {
      return sendSuccess(res, await service.createScript(req.validatedBody), null, 201);
    }
    async function updateScript(req, res) {
      return sendSuccess(res, await service.updateScript(Number(req.params.id), req.validatedBody));
    }
    async function deleteScript(req, res) {
      await service.deleteScript(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function saveScriptVersion(req, res) {
      return sendSuccess(res, await service.saveScriptVersion(Number(req.params.id)));
    }
    async function listScriptVersions(req, res) {
      const rows = await service.listScriptVersions(Number(req.params.id));
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function saveScriptAs(req, res) {
      return sendSuccess(res, await service.saveScriptAs(Number(req.params.id), req.validatedBody), null, 201);
    }
    async function executeQuery(req, res) {
      return sendSuccess(res, await service.executeQuery(req.validatedBody));
    }
    async function listQueryHistory(req, res) {
      const rows = await service.listQueryHistory(req.query);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function runCopilotTask(req, res) {
      return sendSuccess(res, await service.runCopilotTask(req.validatedBody, req.user));
    }
    async function listCopilotSessions(req, res) {
      const rows = await service.listCopilotSessions(req.user, req.query);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listCopilotSessionMessages(req, res) {
      return sendSuccess(res, await service.listCopilotSessionMessages(req.user, Number(req.params.id)));
    }
    async function runCopilotTaskStream(req, res) {
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Connection", "keep-alive");
      const abortController = new AbortController();
      res.on("close", () => {
        if (!res.writableEnded) abortController.abort();
      });
      try {
        await service.runCopilotTaskStream(req.validatedBody, {
          user: req.user,
          signal: abortController.signal,
          write(event) {
            res.write(`${JSON.stringify(event)}
`);
          }
        });
      } catch (error) {
        if (!abortController.signal.aborted && !res.writableEnded && !res.destroyed) {
          res.write(`${JSON.stringify({
            type: "error",
            message: error?.message || "\u667A\u80FD\u8F85\u52A9\u8C03\u7528\u5931\u8D25",
            details: error?.details || null
          })}
`);
        }
      } finally {
        if (!res.writableEnded && !res.destroyed) {
          res.end();
        }
      }
    }
    async function listWorkflows(req, res) {
      const rows = await service.listWorkflows();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getWorkflow(req, res) {
      return sendSuccess(res, await service.getWorkflow(Number(req.params.id)));
    }
    async function listOrchestrationTasks(req, res) {
      const rows = await service.listOrchestrationTasks();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getOrchestrationTask(req, res) {
      return sendSuccess(res, await service.getOrchestrationTask(Number(req.params.id)));
    }
    async function createOrchestrationTask(req, res) {
      return sendSuccess(res, await service.createOrchestrationTask(req.validatedBody), null, 201);
    }
    async function updateOrchestrationTask(req, res) {
      return sendSuccess(res, await service.updateOrchestrationTask(Number(req.params.id), req.validatedBody));
    }
    async function deleteOrchestrationTask(req, res) {
      await service.deleteOrchestrationTask(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function saveOrchestrationGraph(req, res) {
      return sendSuccess(res, await service.saveOrchestrationGraph(Number(req.params.id), req.validatedBody));
    }
    async function compileOrchestrationSql(req, res) {
      return sendSuccess(res, await service.compileOrchestrationSql(Number(req.params.id)));
    }
    async function previewOrchestrationNode(req, res) {
      return sendSuccess(
        res,
        await service.previewOrchestrationNode(Number(req.params.id), req.params.nodeKey, {
          limit: req.query.limit
        })
      );
    }
    async function runOrchestration(req, res) {
      return sendSuccess(res, await service.runOrchestration(Number(req.params.id)), null, 202);
    }
    async function listProcessingJobs(req, res) {
      const rows = await service.listProcessingJobs(req.query || {});
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getProcessingJob(req, res) {
      return sendSuccess(res, await service.getProcessingJob(Number(req.params.id)));
    }
    async function createProcessingJob(req, res) {
      return sendSuccess(res, await service.createProcessingJob(req.validatedBody), null, 201);
    }
    async function updateProcessingJob(req, res) {
      return sendSuccess(res, await service.updateProcessingJob(Number(req.params.id), req.validatedBody));
    }
    async function deleteProcessingJob(req, res) {
      await service.deleteProcessingJob(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function previewProcessingJobDraft(req, res) {
      return sendSuccess(res, await service.previewProcessingJobDraft(req.validatedBody));
    }
    async function previewProcessingJob(req, res) {
      return sendSuccess(res, await service.previewProcessingJob(Number(req.params.id)));
    }
    async function runProcessingJob(req, res) {
      return sendSuccess(res, await service.runProcessingJob(Number(req.params.id), req.validatedBody || {}), null, 202);
    }
    async function listProcessingJobRuns(req, res) {
      const rows = await service.listProcessingJobRuns(Number(req.params.id));
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createWorkflow(req, res) {
      return sendSuccess(res, await service.createWorkflow(req.validatedBody), null, 201);
    }
    async function createWorkflowFromTask(req, res) {
      return sendSuccess(res, await service.createWorkflowFromTask(req.validatedBody), null, 201);
    }
    async function updateWorkflow(req, res) {
      return sendSuccess(res, await service.updateWorkflow(Number(req.params.id), req.validatedBody));
    }
    async function deleteWorkflow(req, res) {
      await service.deleteWorkflow(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function saveWorkflowGraph(req, res) {
      return sendSuccess(res, await service.saveWorkflowGraph(Number(req.params.id), req.validatedBody));
    }
    async function validateWorkflow(req, res) {
      return sendSuccess(res, await service.validateWorkflow(Number(req.params.id)));
    }
    async function runWorkflow(req, res) {
      return sendSuccess(res, await service.runWorkflow(Number(req.params.id), req.validatedBody || {}), null, 202);
    }
    async function listWorkflowRuns(req, res) {
      const rows = await service.listWorkflowRuns(Number(req.params.id));
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listInstances(req, res) {
      const rows = await service.listInstances(req.query);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getInstance(req, res) {
      return sendSuccess(res, await service.getInstance(Number(req.params.id)));
    }
    async function listInstanceLogs(req, res) {
      const rows = await service.listInstanceLogs(Number(req.params.id));
      return sendSuccess(res, rows, { total: rows.length });
    }
    module2.exports = {
      createOrchestrationTask,
      compileOrchestrationSql,
      previewOrchestrationNode,
      runOrchestration,
      createProcessingJob,
      deleteProcessingJob,
      getProcessingJob,
      listProcessingJobs,
      listProcessingJobRuns,
      previewProcessingJob,
      previewProcessingJobDraft,
      runProcessingJob,
      updateProcessingJob,
      createDatasource,
      createScript,
      createScriptFolder,
      createWorkflow,
      createWorkflowFromTask,
      deleteOrchestrationTask,
      deleteDatasource,
      deleteScript,
      deleteScriptFolder,
      deleteWorkflow,
      executeQuery,
      getDatasource,
      getInstance,
      getOrchestrationTask,
      getScript,
      getWorkflow,
      listDatasourceColumns,
      listDatasourceFunctions,
      listDatasourceDatabases,
      listDatasourceTables,
      listDatasources,
      listInstanceLogs,
      listInstances,
      listOrchestrationTasks,
      listQueryHistory,
      listCopilotSessionMessages,
      listCopilotSessions,
      runCopilotTask,
      runCopilotTaskStream,
      listScriptFolders,
      listScriptVersions,
      listScripts,
      listWorkflowRuns,
      listWorkflows,
      runWorkflow,
      saveOrchestrationGraph,
      saveScriptAs,
      saveScriptVersion,
      saveWorkflowGraph,
      testDatasource,
      testDatasourceConfig,
      updateOrchestrationTask,
      updateDatasource,
      updateScript,
      updateScriptFolder,
      updateWorkflow,
      validateWorkflow
    };
  }
});

// packages/data-platform-module-data-development/src/.runtime-entry.js
var controller0 = require_data_development_controller();
var { Writable } = require("node:stream");
var handlers = {
  "POST /api/v1/data-development/datasources/test": controller0["testDatasourceConfig"],
  "GET /api/v1/data-development/datasources": controller0["listDatasources"],
  "GET /api/v1/data-development/datasources/:id": controller0["getDatasource"],
  "POST /api/v1/data-development/datasources": controller0["createDatasource"],
  "PUT /api/v1/data-development/datasources/:id": controller0["updateDatasource"],
  "DELETE /api/v1/data-development/datasources/:id": controller0["deleteDatasource"],
  "POST /api/v1/data-development/datasources/:id/test": controller0["testDatasource"],
  "GET /api/v1/data-development/datasources/:id/databases": controller0["listDatasourceDatabases"],
  "GET /api/v1/data-development/datasources/:id/tables": controller0["listDatasourceTables"],
  "GET /api/v1/data-development/datasources/:id/columns": controller0["listDatasourceColumns"],
  "GET /api/v1/data-development/datasources/:id/functions": controller0["listDatasourceFunctions"],
  "GET /api/v1/data-development/script-folders": controller0["listScriptFolders"],
  "POST /api/v1/data-development/script-folders": controller0["createScriptFolder"],
  "PUT /api/v1/data-development/script-folders/:id": controller0["updateScriptFolder"],
  "DELETE /api/v1/data-development/script-folders/:id": controller0["deleteScriptFolder"],
  "GET /api/v1/data-development/scripts": controller0["listScripts"],
  "GET /api/v1/data-development/scripts/:id": controller0["getScript"],
  "POST /api/v1/data-development/scripts": controller0["createScript"],
  "PUT /api/v1/data-development/scripts/:id": controller0["updateScript"],
  "DELETE /api/v1/data-development/scripts/:id": controller0["deleteScript"],
  "POST /api/v1/data-development/scripts/:id/save-version": controller0["saveScriptVersion"],
  "GET /api/v1/data-development/scripts/:id/versions": controller0["listScriptVersions"],
  "POST /api/v1/data-development/scripts/:id/save-as": controller0["saveScriptAs"],
  "POST /api/v1/data-development/queries/execute": controller0["executeQuery"],
  "GET /api/v1/data-development/queries/history": controller0["listQueryHistory"],
  "GET /api/v1/data-development/copilot/sessions": controller0["listCopilotSessions"],
  "GET /api/v1/data-development/copilot/sessions/:id/messages": controller0["listCopilotSessionMessages"],
  "POST /api/v1/data-development/copilot/stream": controller0["runCopilotTaskStream"],
  "POST /api/v1/data-development/copilot": controller0["runCopilotTask"],
  "GET /api/v1/data-development/orchestrations": controller0["listOrchestrationTasks"],
  "GET /api/v1/data-development/orchestrations/:id": controller0["getOrchestrationTask"],
  "POST /api/v1/data-development/orchestrations": controller0["createOrchestrationTask"],
  "PUT /api/v1/data-development/orchestrations/:id": controller0["updateOrchestrationTask"],
  "DELETE /api/v1/data-development/orchestrations/:id": controller0["deleteOrchestrationTask"],
  "PUT /api/v1/data-development/orchestrations/:id/graph": controller0["saveOrchestrationGraph"],
  "GET /api/v1/data-development/orchestrations/:id/sql-preview": controller0["compileOrchestrationSql"],
  "GET /api/v1/data-development/orchestrations/:id/nodes/:nodeKey/preview": controller0["previewOrchestrationNode"],
  "POST /api/v1/data-development/orchestrations/:id/run": controller0["runOrchestration"],
  "GET /api/v1/data-development/operator-tasks": controller0["listOrchestrationTasks"],
  "GET /api/v1/data-development/operator-tasks/:id": controller0["getOrchestrationTask"],
  "POST /api/v1/data-development/operator-tasks": controller0["createOrchestrationTask"],
  "PUT /api/v1/data-development/operator-tasks/:id": controller0["updateOrchestrationTask"],
  "DELETE /api/v1/data-development/operator-tasks/:id": controller0["deleteOrchestrationTask"],
  "PUT /api/v1/data-development/operator-tasks/:id/graph": controller0["saveOrchestrationGraph"],
  "GET /api/v1/data-development/operator-tasks/:id/sql-preview": controller0["compileOrchestrationSql"],
  "GET /api/v1/data-development/operator-tasks/:id/nodes/:nodeKey/preview": controller0["previewOrchestrationNode"],
  "POST /api/v1/data-development/operator-tasks/:id/run": controller0["runOrchestration"],
  "GET /api/v1/data-development/processing/jobs": controller0["listProcessingJobs"],
  "GET /api/v1/data-development/processing/jobs/:id": controller0["getProcessingJob"],
  "POST /api/v1/data-development/processing/jobs/preview": controller0["previewProcessingJobDraft"],
  "POST /api/v1/data-development/processing/jobs": controller0["createProcessingJob"],
  "PUT /api/v1/data-development/processing/jobs/:id": controller0["updateProcessingJob"],
  "DELETE /api/v1/data-development/processing/jobs/:id": controller0["deleteProcessingJob"],
  "POST /api/v1/data-development/processing/jobs/:id/preview": controller0["previewProcessingJob"],
  "POST /api/v1/data-development/processing/jobs/:id/run": controller0["runProcessingJob"],
  "GET /api/v1/data-development/processing/jobs/:id/runs": controller0["listProcessingJobRuns"],
  "GET /api/v1/data-development/workflows": controller0["listWorkflows"],
  "GET /api/v1/data-development/workflows/:id": controller0["getWorkflow"],
  "POST /api/v1/data-development/workflows": controller0["createWorkflow"],
  "POST /api/v1/data-development/workflows/from-task": controller0["createWorkflowFromTask"],
  "PUT /api/v1/data-development/workflows/:id": controller0["updateWorkflow"],
  "DELETE /api/v1/data-development/workflows/:id": controller0["deleteWorkflow"],
  "PUT /api/v1/data-development/workflows/:id/graph": controller0["saveWorkflowGraph"],
  "POST /api/v1/data-development/workflows/:id/validate": controller0["validateWorkflow"],
  "POST /api/v1/data-development/workflows/:id/run": controller0["runWorkflow"],
  "GET /api/v1/data-development/workflows/:id/runs": controller0["listWorkflowRuns"],
  "GET /api/v1/data-development/instances": controller0["listInstances"],
  "GET /api/v1/data-development/instances/:id": controller0["getInstance"],
  "GET /api/v1/data-development/instances/:id/logs": controller0["listInstanceLogs"],
  "GET /api/v1/data-development/scheduling/workflows": controller0["listWorkflows"],
  "GET /api/v1/data-development/scheduling/workflows/:id": controller0["getWorkflow"],
  "POST /api/v1/data-development/scheduling/workflows": controller0["createWorkflow"],
  "POST /api/v1/data-development/scheduling/workflows/from-task": controller0["createWorkflowFromTask"],
  "PUT /api/v1/data-development/scheduling/workflows/:id": controller0["updateWorkflow"],
  "DELETE /api/v1/data-development/scheduling/workflows/:id": controller0["deleteWorkflow"],
  "PUT /api/v1/data-development/scheduling/workflows/:id/graph": controller0["saveWorkflowGraph"],
  "POST /api/v1/data-development/scheduling/workflows/:id/validate": controller0["validateWorkflow"],
  "POST /api/v1/data-development/scheduling/workflows/:id/run": controller0["runWorkflow"],
  "GET /api/v1/data-development/scheduling/workflows/:id/runs": controller0["listWorkflowRuns"],
  "GET /api/v1/data-development/scheduling/instances": controller0["listInstances"],
  "GET /api/v1/data-development/scheduling/instances/:id": controller0["getInstance"],
  "GET /api/v1/data-development/scheduling/instances/:id/logs": controller0["listInstanceLogs"]
};
function routeParams(apiKey, input) {
  const pathTemplate = apiKey.slice(apiKey.indexOf(" ") + 1);
  const params = { ...input && input.params || {} };
  for (const match of pathTemplate.matchAll(/:([A-Za-z0-9_]+)/g)) {
    const name = match[1];
    if (params[name] === void 0) params[name] = input?.[name] ?? (name === "id" ? input?.id : void 0);
  }
  if (pathTemplate.includes("*") && params[0] === void 0) params[0] = input?.path || "/";
  return params;
}
function createResponse() {
  const response = new Writable({
    write(chunk, _encoding, callback) {
      this.chunks.push(Buffer.from(chunk));
      callback();
    },
    final(callback) {
      this.payload ??= Buffer.concat(this.chunks);
      callback();
    }
  });
  response.statusCode = 200;
  response.headers = {};
  response.payload = void 0;
  response.chunks = [];
  response.status = function status(code) {
    this.statusCode = code;
    return this;
  };
  response.setHeader = function setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value;
    return this;
  };
  response.json = function json(value) {
    this.payload = value;
    this.end();
    return value;
  };
  response.send = function send(value) {
    this.payload = value;
    this.end();
    return value;
  };
  response.download = function download(file, name) {
    this.payload = { path: file, filename: name };
    this.end();
    return this.payload;
  };
  return response;
}
async function executeCapability(definition, input = {}, context = {}) {
  const apiKey = definition.sourceApiKeys[0];
  const handler = handlers[apiKey];
  if (typeof handler !== "function") {
    const error = new Error("No bundled handler for " + apiKey);
    error.code = "CAPABILITY_HANDLER_MISSING";
    throw error;
  }
  const method = apiKey.slice(0, apiKey.indexOf(" "));
  const body = input.body && typeof input.body === "object" ? input.body : input;
  const req = context.request || {
    method,
    params: routeParams(apiKey, input),
    query: input.query || (method === "GET" ? input : {}),
    body,
    validatedBody: body,
    headers: input.headers || {},
    user: context.actor || input.actor || null,
    projectId: context.projectId || input.projectId || null,
    file: input.file || null,
    files: input.files || null,
    ip: null,
    protocol: "cli",
    socket: {},
    get(name) {
      return this.headers[String(name).toLowerCase()] || this.headers[name] || "";
    }
  };
  const res = context.response || createResponse();
  const returned = await handler(req, res);
  if (!context.response && returned === res && !res.writableFinished) {
    await new Promise((resolve, reject) => {
      res.once("finish", resolve);
      res.once("error", reject);
    });
  }
  const payload = res.payload === void 0 ? returned : res.payload;
  if (context.response) {
    return { data: payload, meta: null, statusCode: res.statusCode, headers: res.headers || {} };
  }
  if (payload && payload.success === true && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return { data: payload.data, meta: payload.meta ?? null, statusCode: res.statusCode, headers: res.headers };
  }
  return { data: payload, meta: null, statusCode: res.statusCode, headers: res.headers };
}
module.exports = { executeCapability, createResponse, handlerApiKeys: Object.freeze(Object.keys(handlers)) };
