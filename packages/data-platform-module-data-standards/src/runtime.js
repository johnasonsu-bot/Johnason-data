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
      const normalizedDialect = normalizeDatasourceType(dialect);
      if (normalizedDialect === "oracle") {
        return `SELECT * FROM (${trimmed}) WHERE ROWNUM <= ${limit}`;
      }
      if (normalizedDialect === "dm") {
        return `${trimmed}
FETCH FIRST ${limit} ROWS ONLY`;
      }
      if (normalizedDialect === "hive") {
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

// runtime-port:project-context
var require_project_context = __commonJS({
  "runtime-port:project-context"(exports2, module2) {
    var k = require("@johnason/data-platform-core-kernel");
    module2.exports = { runWithProjectContext: (_context, callback) => callback(), getProjectContext: k.getProjectContext, getCurrentProjectId: k.getCurrentProjectId, getProjectCondition: k.getProjectCondition, addProjectCondition: k.addProjectCondition };
  }
});

// backend/src/modules/data-standards/data-standards.repository.js
var require_data_standards_repository = __commonJS({
  "backend/src/modules/data-standards/data-standards.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var { getCurrentProjectId } = require_project_context();
    function addProjectCondition(where, params, alias = "") {
      const projectId = getCurrentProjectId();
      if (!projectId) return null;
      const prefix = alias ? `${alias}.` : "";
      where.push(`${prefix}project_id = ?`);
      params.push(projectId);
      return projectId;
    }
    function parseJson(value, fallback) {
      if (value === null || value === void 0 || value === "") {
        return fallback;
      }
      if (typeof value === "object") {
        return value;
      }
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    function toNumber(value) {
      return value === null || value === void 0 ? null : Number(value);
    }
    function nullableDate(value) {
      const text = String(value || "").trim();
      return text ? text.slice(0, 10) : null;
    }
    var elementStandardPrefixes = {
      national: "GB",
      industry: "HB",
      enterprise: "QB"
    };
    var elementCodeSerialDigits = 5;
    var elementStandardRegexps = {
      national: "^GB[0-9]{4,5}$",
      industry: "^HB[0-9]{5}$",
      enterprise: "^QB[0-9]{5}$"
    };
    function inferElementStandardType(elementCode) {
      const prefix = String(elementCode || "").trim().slice(0, 2).toUpperCase();
      if (prefix === "GB") return "national";
      if (prefix === "HB") return "industry";
      if (prefix === "QB") return "enterprise";
      return "enterprise";
    }
    function mapCatalog(row) {
      return {
        id: Number(row.id),
        parentId: toNumber(row.parentId),
        parentName: row.parentName || null,
        catalogName: row.catalogName,
        catalogCode: row.catalogCode,
        catalogType: row.catalogType,
        ownerName: row.ownerName || "",
        description: row.description || "",
        sortOrder: Number(row.sortOrder || 0),
        status: row.status,
        elementCount: Number(row.elementCount || 0),
        nationalElementCount: Number(row.nationalElementCount || 0),
        industryElementCount: Number(row.industryElementCount || 0),
        enterpriseElementCount: Number(row.enterpriseElementCount || 0),
        createdBy: row.createdBy || "system",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapReferenceStandard(row) {
      return {
        id: Number(row.id),
        standardCode: row.standardCode,
        standardName: row.standardName,
        standardType: row.standardType,
        standardNo: row.standardNo || "",
        publisher: row.publisher || "",
        effectiveDate: row.effectiveDate || null,
        standardUrl: row.standardUrl || "",
        description: row.description || "",
        status: row.status,
        elementCount: Number(row.elementCount || 0),
        valueDomainCount: Number(row.valueDomainCount || 0),
        createdBy: row.createdBy || "system",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapValueDomain(row) {
      return {
        id: Number(row.id),
        domainCode: row.domainCode,
        domainName: row.domainName,
        domainType: row.domainType,
        valueType: row.valueType,
        dataType: row.dataType || "",
        minValue: row.minValue === null || row.minValue === void 0 ? null : Number(row.minValue),
        maxValue: row.maxValue === null || row.maxValue === void 0 ? null : Number(row.maxValue),
        regexPattern: row.regexPattern || "",
        formatPattern: row.formatPattern || "",
        unit: row.unit || "",
        referenceStandardId: toNumber(row.referenceStandardId),
        referenceStandardName: row.referenceStandardName || "",
        referenceClause: row.referenceClause || "",
        description: row.description || "",
        status: row.status,
        itemCount: Number(row.itemCount || 0),
        elementCount: Number(row.elementCount || 0),
        createdBy: row.createdBy || "system",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapValueDomainItem(row) {
      return {
        id: Number(row.id),
        domainId: Number(row.domainId),
        itemCode: row.itemCode,
        itemLabel: row.itemLabel,
        itemValue: row.itemValue || "",
        itemMeaning: row.itemMeaning || "",
        sortOrder: Number(row.sortOrder || 0),
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapElement(row) {
      return {
        id: Number(row.id),
        standardType: inferElementStandardType(row.elementCode),
        elementIdentifier: row.elementIdentifier,
        elementCode: row.elementCode,
        elementNameCn: row.elementNameCn,
        elementNameEn: row.elementNameEn || "",
        catalogId: toNumber(row.catalogId),
        catalogName: row.catalogName || "",
        catalogCode: row.catalogCode || "",
        objectClass: row.objectClass || "",
        propertyName: row.propertyName || "",
        representationTerm: row.representationTerm || "",
        qualifiers: parseJson(row.qualifiers, []),
        definition: row.definition || "",
        dataType: row.dataType || "string",
        maxLength: toNumber(row.maxLength),
        numericPrecision: toNumber(row.numericPrecision),
        numericScale: toNumber(row.numericScale),
        datetimePrecision: row.datetimePrecision || "",
        formatPattern: row.formatPattern || "",
        unit: row.unit || "",
        valueDomainId: toNumber(row.valueDomainId),
        valueDomainName: row.valueDomainName || "",
        valueDomainCode: row.valueDomainCode || "",
        referenceStandardId: toNumber(row.referenceStandardId),
        referenceStandardName: row.referenceStandardName || "",
        referenceClause: row.referenceClause || "",
        aliases: parseJson(row.aliases, []),
        tags: parseJson(row.tags, []),
        ownerName: row.ownerName || "",
        stewardName: row.stewardName || "",
        lifecycleStatus: row.lifecycleStatus || "draft",
        currentVersionNo: Number(row.currentVersionNo || 1),
        status: row.status || "active",
        mappingCount: Number(row.mappingCount || 0),
        createdBy: row.createdBy || "system",
        publishedAt: row.publishedAt || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapElementVersion(row) {
      return {
        id: Number(row.id),
        elementId: Number(row.elementId),
        versionNo: Number(row.versionNo),
        versionStatus: row.versionStatus,
        snapshot: parseJson(row.snapshot, {}),
        changeSummary: row.changeSummary || "",
        createdBy: row.createdBy || "system",
        publishedAt: row.publishedAt || null,
        createdAt: row.createdAt
      };
    }
    function mapAiConfig(row) {
      return {
        id: Number(row.id),
        sceneName: row.sceneName,
        sceneCode: row.sceneCode,
        defaultModelProviderId: toNumber(row.defaultModelProviderId),
        defaultModelProviderName: row.defaultModelProviderName || "",
        defaultModelName: row.defaultModelName || "",
        defaultModelVersion: row.defaultModelVersion || "",
        temperature: row.temperature === null || row.temperature === void 0 ? null : Number(row.temperature),
        maxTokens: toNumber(row.maxTokens),
        timeoutMs: toNumber(row.timeoutMs),
        systemPrompt: row.systemPrompt || "",
        userPromptTemplate: row.userPromptTemplate || "",
        outputSchema: parseJson(row.outputSchema, {}),
        description: row.description || "",
        ownerName: row.ownerName || "system",
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    async function withTransaction(handler) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await handler(connection);
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function listCatalogs() {
      const projectId = getCurrentProjectId();
      const [rows] = await pool.query(
        `WITH RECURSIVE catalog_descendants AS (
       SELECT id AS ancestor_id, id AS descendant_id
       FROM std_catalogs
       WHERE status <> 'deleted'
       UNION ALL
       SELECT cd.ancestor_id, child.id AS descendant_id
       FROM catalog_descendants cd
       JOIN std_catalogs child ON child.parent_id = cd.descendant_id AND child.status <> 'deleted'
     )
     SELECT c.id, c.parent_id AS parentId, p.catalog_name AS parentName,
            c.catalog_name AS catalogName, c.catalog_code AS catalogCode, c.catalog_type AS catalogType,
            c.owner_name AS ownerName, c.description, c.sort_order AS sortOrder, c.status,
            c.created_by AS createdBy, c.created_at AS createdAt, c.updated_at AS updatedAt,
            COUNT(DISTINCT e.id) AS elementCount,
            COUNT(DISTINCT CASE WHEN e.element_code REGEXP '${elementStandardRegexps.national}' THEN e.id END) AS nationalElementCount,
            COUNT(DISTINCT CASE WHEN e.element_code REGEXP '${elementStandardRegexps.industry}' THEN e.id END) AS industryElementCount,
            COUNT(DISTINCT CASE WHEN e.element_code REGEXP '${elementStandardRegexps.enterprise}' THEN e.id END) AS enterpriseElementCount
     FROM std_catalogs c
     LEFT JOIN std_catalogs p ON p.id = c.parent_id
     LEFT JOIN catalog_descendants cd ON cd.ancestor_id = c.id
     LEFT JOIN std_data_elements e ON e.catalog_id = cd.descendant_id AND e.status <> 'deleted'
     WHERE c.status <> 'deleted'${projectId ? " AND c.project_id = ?" : ""}
     GROUP BY c.id, p.catalog_name
     ORDER BY c.sort_order ASC, c.id ASC`,
        projectId ? [projectId] : []
      );
      return rows.map(mapCatalog);
    }
    async function getCatalogById(id) {
      const projectId = getCurrentProjectId();
      const [rows] = await pool.query(
        `WITH RECURSIVE catalog_descendants AS (
       SELECT id AS ancestor_id, id AS descendant_id
       FROM std_catalogs
       WHERE status <> 'deleted'
       UNION ALL
       SELECT cd.ancestor_id, child.id AS descendant_id
       FROM catalog_descendants cd
       JOIN std_catalogs child ON child.parent_id = cd.descendant_id AND child.status <> 'deleted'
     )
     SELECT c.id, c.parent_id AS parentId, p.catalog_name AS parentName,
            c.catalog_name AS catalogName, c.catalog_code AS catalogCode, c.catalog_type AS catalogType,
            c.owner_name AS ownerName, c.description, c.sort_order AS sortOrder, c.status,
            c.created_by AS createdBy, c.created_at AS createdAt, c.updated_at AS updatedAt,
            COUNT(DISTINCT e.id) AS elementCount,
            COUNT(DISTINCT CASE WHEN e.element_code REGEXP '${elementStandardRegexps.national}' THEN e.id END) AS nationalElementCount,
            COUNT(DISTINCT CASE WHEN e.element_code REGEXP '${elementStandardRegexps.industry}' THEN e.id END) AS industryElementCount,
            COUNT(DISTINCT CASE WHEN e.element_code REGEXP '${elementStandardRegexps.enterprise}' THEN e.id END) AS enterpriseElementCount
     FROM std_catalogs c
     LEFT JOIN std_catalogs p ON p.id = c.parent_id
     LEFT JOIN catalog_descendants cd ON cd.ancestor_id = c.id
     LEFT JOIN std_data_elements e ON e.catalog_id = cd.descendant_id AND e.status <> 'deleted'
     WHERE c.id = ? AND c.status <> 'deleted'${projectId ? " AND c.project_id = ?" : ""}
     GROUP BY c.id, p.catalog_name
     LIMIT 1`,
        projectId ? [id, projectId] : [id]
      );
      return rows[0] ? mapCatalog(rows[0]) : null;
    }
    async function createCatalog(payload, userName) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO std_catalogs
      (project_id, parent_id, catalog_name, catalog_code, catalog_type, owner_name, description, sort_order, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.parentId || null,
          payload.catalogName,
          payload.catalogCode,
          payload.catalogType || "business_domain",
          payload.ownerName || null,
          payload.description || null,
          Number(payload.sortOrder || 0),
          payload.status || "active",
          userName || "system"
        ]
      );
      return getCatalogById(result.insertId);
    }
    async function updateCatalog(id, payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `UPDATE std_catalogs
     SET parent_id = ?, catalog_name = ?, catalog_code = ?, catalog_type = ?, owner_name = ?,
         description = ?, sort_order = ?, status = ?
     WHERE id = ? AND status <> 'deleted'${projectId ? " AND project_id = ?" : ""}`,
        [
          payload.parentId || null,
          payload.catalogName,
          payload.catalogCode,
          payload.catalogType || "business_domain",
          payload.ownerName || null,
          payload.description || null,
          Number(payload.sortOrder || 0),
          payload.status || "active",
          id,
          ...projectId ? [projectId] : []
        ]
      );
      if (!result.affectedRows) return null;
      return getCatalogById(id);
    }
    async function deleteCatalog(id) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(`UPDATE std_catalogs SET status = 'deleted' WHERE id = ?${projectId ? " AND project_id = ?" : ""}`, projectId ? [id, projectId] : [id]);
      return Number(result.affectedRows || 0) > 0;
    }
    async function listReferenceStandards(filters = {}) {
      const where = ["s.status <> 'deleted'"];
      const params = [];
      if (filters.keyword) {
        where.push("(s.standard_code LIKE ? OR s.standard_name LIKE ? OR s.standard_no LIKE ?)");
        const keyword = `%${String(filters.keyword).trim()}%`;
        params.push(keyword, keyword, keyword);
      }
      if (filters.standardType) {
        where.push("s.standard_type = ?");
        params.push(String(filters.standardType));
      }
      addProjectCondition(where, params, "s");
      const [rows] = await pool.query(
        `SELECT s.id, s.standard_code AS standardCode, s.standard_name AS standardName,
            s.standard_type AS standardType, s.standard_no AS standardNo, s.publisher,
            s.effective_date AS effectiveDate, s.standard_url AS standardUrl, s.description, s.status,
            s.created_by AS createdBy, s.created_at AS createdAt, s.updated_at AS updatedAt,
            COUNT(DISTINCT e.id) AS elementCount, COUNT(DISTINCT vd.id) AS valueDomainCount
     FROM std_reference_standards s
     LEFT JOIN std_data_elements e ON e.reference_standard_id = s.id AND e.status <> 'deleted'
     LEFT JOIN std_value_domains vd ON vd.reference_standard_id = s.id AND vd.status <> 'deleted'
     WHERE ${where.join(" AND ")}
     GROUP BY s.id
     ORDER BY s.updated_at DESC, s.id DESC`,
        params
      );
      return rows.map(mapReferenceStandard);
    }
    async function getReferenceStandardById(id) {
      const rows = await listReferenceStandards({});
      return rows.find((item) => item.id === Number(id)) || null;
    }
    async function createReferenceStandard(payload, userName) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO std_reference_standards
      (project_id, standard_code, standard_name, standard_type, standard_no, publisher, effective_date, standard_url, description, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.standardCode,
          payload.standardName,
          payload.standardType || "enterprise",
          payload.standardNo || null,
          payload.publisher || null,
          nullableDate(payload.effectiveDate),
          payload.standardUrl || null,
          payload.description || null,
          payload.status || "active",
          userName || "system"
        ]
      );
      return getReferenceStandardById(result.insertId);
    }
    async function updateReferenceStandard(id, payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `UPDATE std_reference_standards
     SET standard_code = ?, standard_name = ?, standard_type = ?, standard_no = ?, publisher = ?,
         effective_date = ?, standard_url = ?, description = ?, status = ?
     WHERE id = ? AND status <> 'deleted'${projectId ? " AND project_id = ?" : ""}`,
        [
          payload.standardCode,
          payload.standardName,
          payload.standardType || "enterprise",
          payload.standardNo || null,
          payload.publisher || null,
          nullableDate(payload.effectiveDate),
          payload.standardUrl || null,
          payload.description || null,
          payload.status || "active",
          id,
          ...projectId ? [projectId] : []
        ]
      );
      if (!result.affectedRows) return null;
      return getReferenceStandardById(id);
    }
    async function deleteReferenceStandard(id) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(`UPDATE std_reference_standards SET status = 'deleted' WHERE id = ?${projectId ? " AND project_id = ?" : ""}`, projectId ? [id, projectId] : [id]);
      return Number(result.affectedRows || 0) > 0;
    }
    async function listValueDomains(filters = {}) {
      const where = ["vd.status <> 'deleted'"];
      const params = [];
      if (filters.keyword) {
        where.push("(vd.domain_code LIKE ? OR vd.domain_name LIKE ?)");
        const keyword = `%${String(filters.keyword).trim()}%`;
        params.push(keyword, keyword);
      }
      if (filters.domainType) {
        where.push("vd.domain_type = ?");
        params.push(String(filters.domainType));
      }
      addProjectCondition(where, params, "vd");
      const [rows] = await pool.query(
        `SELECT vd.id, vd.domain_code AS domainCode, vd.domain_name AS domainName,
            vd.domain_type AS domainType, vd.value_type AS valueType, vd.data_type AS dataType,
            vd.min_value AS \`minValue\`, vd.max_value AS \`maxValue\`, vd.regex_pattern AS regexPattern,
            vd.format_pattern AS formatPattern, vd.unit, vd.reference_standard_id AS referenceStandardId,
            rs.standard_name AS referenceStandardName, vd.reference_clause AS referenceClause,
            vd.description, vd.status, vd.created_by AS createdBy, vd.created_at AS createdAt, vd.updated_at AS updatedAt,
            COUNT(DISTINCT vi.id) AS itemCount, COUNT(DISTINCT e.id) AS elementCount
     FROM std_value_domains vd
     LEFT JOIN std_reference_standards rs ON rs.id = vd.reference_standard_id
     LEFT JOIN std_value_domain_items vi ON vi.domain_id = vd.id AND vi.status <> 'deleted'
     LEFT JOIN std_data_elements e ON e.value_domain_id = vd.id AND e.status <> 'deleted'
     WHERE ${where.join(" AND ")}
     GROUP BY vd.id, rs.standard_name
     ORDER BY vd.updated_at DESC, vd.id DESC`,
        params
      );
      return rows.map(mapValueDomain);
    }
    async function getValueDomainById(id) {
      const projectId = getCurrentProjectId();
      const [rows] = await pool.query(
        `SELECT vd.id, vd.domain_code AS domainCode, vd.domain_name AS domainName,
            vd.domain_type AS domainType, vd.value_type AS valueType, vd.data_type AS dataType,
            vd.min_value AS \`minValue\`, vd.max_value AS \`maxValue\`, vd.regex_pattern AS regexPattern,
            vd.format_pattern AS formatPattern, vd.unit, vd.reference_standard_id AS referenceStandardId,
            rs.standard_name AS referenceStandardName, vd.reference_clause AS referenceClause,
            vd.description, vd.status, vd.created_by AS createdBy, vd.created_at AS createdAt, vd.updated_at AS updatedAt,
            COUNT(DISTINCT vi.id) AS itemCount, COUNT(DISTINCT e.id) AS elementCount
     FROM std_value_domains vd
     LEFT JOIN std_reference_standards rs ON rs.id = vd.reference_standard_id
     LEFT JOIN std_value_domain_items vi ON vi.domain_id = vd.id AND vi.status <> 'deleted'
     LEFT JOIN std_data_elements e ON e.value_domain_id = vd.id AND e.status <> 'deleted'
     WHERE vd.id = ? AND vd.status <> 'deleted'${projectId ? " AND vd.project_id = ?" : ""}
     GROUP BY vd.id, rs.standard_name
     LIMIT 1`,
        projectId ? [id, projectId] : [id]
      );
      if (!rows[0]) return null;
      const [itemRows] = await pool.query(
        `SELECT id, domain_id AS domainId, item_code AS itemCode, item_label AS itemLabel,
            item_value AS itemValue, item_meaning AS itemMeaning, sort_order AS sortOrder,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM std_value_domain_items
     WHERE domain_id = ? AND status <> 'deleted'${projectId ? " AND project_id = ?" : ""}
     ORDER BY sort_order ASC, id ASC`,
        projectId ? [id, projectId] : [id]
      );
      return {
        ...mapValueDomain(rows[0]),
        items: itemRows.map(mapValueDomainItem)
      };
    }
    async function replaceValueDomainItems(domainId, items, db = pool) {
      const projectId = getCurrentProjectId();
      await db.query(`DELETE FROM std_value_domain_items WHERE domain_id = ?${projectId ? " AND project_id = ?" : ""}`, projectId ? [domainId, projectId] : [domainId]);
      for (const item of items || []) {
        await db.query(
          `INSERT INTO std_value_domain_items
        (project_id, domain_id, item_code, item_label, item_value, item_meaning, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            domainId,
            item.itemCode,
            item.itemLabel,
            item.itemValue || null,
            item.itemMeaning || null,
            Number(item.sortOrder || 0),
            item.status || "active"
          ]
        );
      }
    }
    async function createValueDomain(payload, userName) {
      const projectId = getCurrentProjectId();
      const domainId = await withTransaction(async (db) => {
        const [result] = await db.query(
          `INSERT INTO std_value_domains
        (project_id, domain_code, domain_name, domain_type, value_type, data_type, min_value, max_value, regex_pattern,
         format_pattern, unit, reference_standard_id, reference_clause, description, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            payload.domainCode,
            payload.domainName,
            payload.domainType || "enumeration",
            payload.valueType || "string",
            payload.dataType || null,
            payload.minValue ?? null,
            payload.maxValue ?? null,
            payload.regexPattern || null,
            payload.formatPattern || null,
            payload.unit || null,
            payload.referenceStandardId || null,
            payload.referenceClause || null,
            payload.description || null,
            payload.status || "active",
            userName || "system"
          ]
        );
        await replaceValueDomainItems(result.insertId, payload.items || [], db);
        return result.insertId;
      });
      return getValueDomainById(domainId);
    }
    async function updateValueDomain(id, payload) {
      const projectId = getCurrentProjectId();
      const updated = await withTransaction(async (db) => {
        const [result] = await db.query(
          `UPDATE std_value_domains
       SET domain_code = ?, domain_name = ?, domain_type = ?, value_type = ?, data_type = ?,
           min_value = ?, max_value = ?, regex_pattern = ?, format_pattern = ?, unit = ?,
           reference_standard_id = ?, reference_clause = ?, description = ?, status = ?
       WHERE id = ? AND status <> 'deleted'${projectId ? " AND project_id = ?" : ""}`,
          [
            payload.domainCode,
            payload.domainName,
            payload.domainType || "enumeration",
            payload.valueType || "string",
            payload.dataType || null,
            payload.minValue ?? null,
            payload.maxValue ?? null,
            payload.regexPattern || null,
            payload.formatPattern || null,
            payload.unit || null,
            payload.referenceStandardId || null,
            payload.referenceClause || null,
            payload.description || null,
            payload.status || "active",
            id,
            ...projectId ? [projectId] : []
          ]
        );
        if (!result.affectedRows) return false;
        await replaceValueDomainItems(id, payload.items || [], db);
        return true;
      });
      return updated ? getValueDomainById(id) : null;
    }
    async function deleteValueDomain(id) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(`UPDATE std_value_domains SET status = 'deleted' WHERE id = ?${projectId ? " AND project_id = ?" : ""}`, projectId ? [id, projectId] : [id]);
      return Number(result.affectedRows || 0) > 0;
    }
    function buildElementSelect() {
      return `SELECT e.id, e.element_identifier AS elementIdentifier, e.element_code AS elementCode,
            e.element_name_cn AS elementNameCn, e.element_name_en AS elementNameEn,
            e.catalog_id AS catalogId, c.catalog_name AS catalogName, c.catalog_code AS catalogCode,
            e.object_class AS objectClass, e.property_name AS propertyName, e.representation_term AS representationTerm,
            e.qualifiers_json AS qualifiers, e.definition, e.data_type AS dataType, e.max_length AS maxLength,
            e.numeric_precision_value AS numericPrecision, e.numeric_scale_value AS numericScale,
            e.datetime_precision AS datetimePrecision, e.format_pattern AS formatPattern, e.unit,
            e.value_domain_id AS valueDomainId, vd.domain_name AS valueDomainName, vd.domain_code AS valueDomainCode,
            e.reference_standard_id AS referenceStandardId, rs.standard_name AS referenceStandardName,
            e.reference_clause AS referenceClause, e.aliases_json AS aliases, e.tags_json AS tags,
            e.owner_name AS ownerName, e.steward_name AS stewardName, e.lifecycle_status AS lifecycleStatus,
            e.current_version_no AS currentVersionNo, e.status, e.created_by AS createdBy,
            e.published_at AS publishedAt, e.created_at AS createdAt, e.updated_at AS updatedAt,
            COUNT(DISTINCT fm.id) AS mappingCount
     FROM std_data_elements e
     LEFT JOIN std_catalogs c ON c.id = e.catalog_id
     LEFT JOIN std_value_domains vd ON vd.id = e.value_domain_id
     LEFT JOIN std_reference_standards rs ON rs.id = e.reference_standard_id
     LEFT JOIN std_field_mappings fm ON fm.element_id = e.id AND fm.mapping_status <> 'deleted'`;
    }
    async function listDataElements(filters = {}) {
      const where = ["e.status <> 'deleted'"];
      const params = [];
      if (filters.keyword) {
        where.push("(e.element_code LIKE ? OR e.element_name_cn LIKE ? OR e.element_name_en LIKE ? OR e.element_identifier LIKE ? OR e.definition LIKE ?)");
        const keyword = `%${String(filters.keyword).trim()}%`;
        params.push(keyword, keyword, keyword, keyword, keyword);
      }
      if (filters.catalogId) {
        where.push("e.catalog_id = ?");
        params.push(Number(filters.catalogId));
      }
      if (filters.lifecycleStatus) {
        where.push("e.lifecycle_status = ?");
        params.push(String(filters.lifecycleStatus));
      }
      if (filters.standardType && elementStandardPrefixes[String(filters.standardType)]) {
        const regexp = elementStandardRegexps[String(filters.standardType)];
        where.push("e.element_code REGEXP ?");
        params.push(regexp);
      }
      addProjectCondition(where, params, "e");
      const [rows] = await pool.query(
        `${buildElementSelect()}
     WHERE ${where.join(" AND ")}
     GROUP BY e.id, c.catalog_name, c.catalog_code, vd.domain_name, vd.domain_code, rs.standard_name
     ORDER BY e.updated_at DESC, e.id DESC`,
        params
      );
      return rows.map(mapElement);
    }
    async function getNextElementCode(standardType = "enterprise") {
      const projectId = getCurrentProjectId();
      const prefix = elementStandardPrefixes[String(standardType)] || elementStandardPrefixes.enterprise;
      const [[row]] = await pool.query(
        `SELECT MAX(CAST(SUBSTRING(element_code, 3) AS UNSIGNED)) AS maxNo
     FROM std_data_elements
     WHERE element_code REGEXP ?${projectId ? " AND project_id = ?" : ""}`,
        projectId ? [`^${prefix}[0-9]{4,${elementCodeSerialDigits}}$`, projectId] : [`^${prefix}[0-9]{4,${elementCodeSerialDigits}}$`]
      );
      const currentNo = Number(row?.maxNo || 0);
      return `${prefix}${String(currentNo + 1).padStart(elementCodeSerialDigits, "0")}`;
    }
    async function listDataElementIdentityKeys() {
      const projectId = getCurrentProjectId();
      const [rows] = await pool.query(
        `SELECT id, element_code AS elementCode, element_identifier AS elementIdentifier, status
     FROM std_data_elements${projectId ? " WHERE project_id = ?" : ""}`,
        projectId ? [projectId] : []
      );
      return rows.map((row) => ({
        id: Number(row.id),
        elementCode: row.elementCode,
        elementIdentifier: row.elementIdentifier,
        status: row.status
      }));
    }
    async function getDataElementById(id) {
      const projectId = getCurrentProjectId();
      const [rows] = await pool.query(
        `${buildElementSelect()}
     WHERE e.id = ? AND e.status <> 'deleted'${projectId ? " AND e.project_id = ?" : ""}
     GROUP BY e.id, c.catalog_name, c.catalog_code, vd.domain_name, vd.domain_code, rs.standard_name
     LIMIT 1`,
        projectId ? [id, projectId] : [id]
      );
      return rows[0] ? mapElement(rows[0]) : null;
    }
    function buildElementSnapshot(element) {
      return {
        elementIdentifier: element.elementIdentifier,
        elementCode: element.elementCode,
        elementNameCn: element.elementNameCn,
        elementNameEn: element.elementNameEn,
        catalogId: element.catalogId,
        objectClass: element.objectClass,
        propertyName: element.propertyName,
        representationTerm: element.representationTerm,
        qualifiers: element.qualifiers,
        definition: element.definition,
        dataType: element.dataType,
        maxLength: element.maxLength,
        numericPrecision: element.numericPrecision,
        numericScale: element.numericScale,
        datetimePrecision: element.datetimePrecision,
        formatPattern: element.formatPattern,
        unit: element.unit,
        valueDomainId: element.valueDomainId,
        referenceStandardId: element.referenceStandardId,
        referenceClause: element.referenceClause,
        aliases: element.aliases,
        tags: element.tags,
        ownerName: element.ownerName,
        stewardName: element.stewardName,
        lifecycleStatus: element.lifecycleStatus,
        status: element.status
      };
    }
    async function upsertElementVersion(elementId, versionNo, versionStatus, snapshot, options = {}, db = pool) {
      const projectId = getCurrentProjectId();
      await db.query(
        `INSERT INTO std_data_element_versions
      (project_id, element_id, version_no, version_status, snapshot_json, change_summary, created_by, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      version_status = VALUES(version_status),
      snapshot_json = VALUES(snapshot_json),
      change_summary = VALUES(change_summary),
      created_by = VALUES(created_by),
      published_at = VALUES(published_at)`,
        [
          projectId,
          elementId,
          versionNo,
          versionStatus,
          JSON.stringify(snapshot),
          options.changeSummary || null,
          options.createdBy || "system",
          options.publishedAt || null
        ]
      );
    }
    async function listElementVersions(elementId) {
      const projectId = getCurrentProjectId();
      const [rows] = await pool.query(
        `SELECT id, element_id AS elementId, version_no AS versionNo, version_status AS versionStatus,
            snapshot_json AS snapshot, change_summary AS changeSummary, created_by AS createdBy,
            published_at AS publishedAt, created_at AS createdAt
     FROM std_data_element_versions
     WHERE element_id = ?${projectId ? " AND project_id = ?" : ""}
     ORDER BY version_no DESC`,
        projectId ? [elementId, projectId] : [elementId]
      );
      return rows.map(mapElementVersion);
    }
    async function getDataElementDetail(id) {
      const element = await getDataElementById(id);
      if (!element) return null;
      const versions = await listElementVersions(id);
      return { ...element, versions };
    }
    async function createDataElement(payload, userName) {
      const projectId = getCurrentProjectId();
      const elementId = await withTransaction(async (db) => {
        const [result] = await db.query(
          `INSERT INTO std_data_elements
        (project_id, element_identifier, element_code, element_name_cn, element_name_en, catalog_id,
         object_class, property_name, representation_term, qualifiers_json, definition,
         data_type, max_length, numeric_precision_value, numeric_scale_value, datetime_precision,
         format_pattern, unit, value_domain_id, reference_standard_id, reference_clause,
         aliases_json, tags_json, owner_name, steward_name, lifecycle_status, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            payload.elementIdentifier,
            payload.elementCode,
            payload.elementNameCn,
            payload.elementNameEn || null,
            payload.catalogId || null,
            payload.objectClass || null,
            payload.propertyName || null,
            payload.representationTerm || null,
            JSON.stringify(payload.qualifiers || []),
            payload.definition || null,
            payload.dataType || "string",
            payload.maxLength ?? null,
            payload.numericPrecision ?? null,
            payload.numericScale ?? null,
            payload.datetimePrecision || null,
            payload.formatPattern || null,
            payload.unit || null,
            payload.valueDomainId || null,
            payload.referenceStandardId || null,
            payload.referenceClause || null,
            JSON.stringify(payload.aliases || []),
            JSON.stringify(payload.tags || []),
            payload.ownerName || null,
            payload.stewardName || null,
            payload.lifecycleStatus || "draft",
            payload.status || "active",
            userName || "system"
          ]
        );
        const snapshot = {
          ...payload,
          catalogId: payload.catalogId || null,
          valueDomainId: payload.valueDomainId || null,
          referenceStandardId: payload.referenceStandardId || null,
          lifecycleStatus: payload.lifecycleStatus || "draft",
          status: payload.status || "active"
        };
        await upsertElementVersion(result.insertId, 1, snapshot.lifecycleStatus === "published" ? "published" : "draft", snapshot, {
          createdBy: userName || "system",
          publishedAt: snapshot.lifecycleStatus === "published" ? /* @__PURE__ */ new Date() : null
        }, db);
        return result.insertId;
      });
      return getDataElementDetail(elementId);
    }
    async function updateDataElement(id, payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `UPDATE std_data_elements
     SET element_identifier = ?, element_code = ?, element_name_cn = ?, element_name_en = ?, catalog_id = ?,
         object_class = ?, property_name = ?, representation_term = ?, qualifiers_json = ?, definition = ?,
         data_type = ?, max_length = ?, numeric_precision_value = ?, numeric_scale_value = ?, datetime_precision = ?,
         format_pattern = ?, unit = ?, value_domain_id = ?, reference_standard_id = ?, reference_clause = ?,
         aliases_json = ?, tags_json = ?, owner_name = ?, steward_name = ?, lifecycle_status = ?, status = ?
     WHERE id = ? AND status <> 'deleted'${projectId ? " AND project_id = ?" : ""}`,
        [
          payload.elementIdentifier,
          payload.elementCode,
          payload.elementNameCn,
          payload.elementNameEn || null,
          payload.catalogId || null,
          payload.objectClass || null,
          payload.propertyName || null,
          payload.representationTerm || null,
          JSON.stringify(payload.qualifiers || []),
          payload.definition || null,
          payload.dataType || "string",
          payload.maxLength ?? null,
          payload.numericPrecision ?? null,
          payload.numericScale ?? null,
          payload.datetimePrecision || null,
          payload.formatPattern || null,
          payload.unit || null,
          payload.valueDomainId || null,
          payload.referenceStandardId || null,
          payload.referenceClause || null,
          JSON.stringify(payload.aliases || []),
          JSON.stringify(payload.tags || []),
          payload.ownerName || null,
          payload.stewardName || null,
          payload.lifecycleStatus || "draft",
          payload.status || "active",
          id,
          ...projectId ? [projectId] : []
        ]
      );
      if (!result.affectedRows) return null;
      return getDataElementDetail(id);
    }
    async function publishDataElement(id, options = {}) {
      const projectId = getCurrentProjectId();
      const element = await getDataElementById(id);
      if (!element) return null;
      const versionNo = element.lifecycleStatus === "published" ? element.currentVersionNo + 1 : element.currentVersionNo;
      await withTransaction(async (db) => {
        await db.query(
          `UPDATE std_data_elements
       SET lifecycle_status = 'published', current_version_no = ?, published_at = NOW()
       WHERE id = ? AND status <> 'deleted'${projectId ? " AND project_id = ?" : ""}`,
          projectId ? [versionNo, id, projectId] : [versionNo, id]
        );
        const updated = { ...element, lifecycleStatus: "published", currentVersionNo: versionNo, publishedAt: /* @__PURE__ */ new Date() };
        await upsertElementVersion(id, versionNo, "published", buildElementSnapshot(updated), {
          changeSummary: options.changeSummary || null,
          createdBy: options.createdBy || "system",
          publishedAt: /* @__PURE__ */ new Date()
        }, db);
      });
      return getDataElementDetail(id);
    }
    async function deleteDataElement(id) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(`UPDATE std_data_elements SET status = 'deleted' WHERE id = ?${projectId ? " AND project_id = ?" : ""}`, projectId ? [id, projectId] : [id]);
      return Number(result.affectedRows || 0) > 0;
    }
    async function getOverview() {
      const projectId = getCurrentProjectId();
      const projectClause = projectId ? " AND project_id = ?" : "";
      const projectParams = projectId ? [projectId] : [];
      const [[elementRow]] = await pool.query(
        `SELECT COUNT(*) AS total,
            SUM(lifecycle_status = 'published' AND status <> 'deleted') AS published,
            SUM(lifecycle_status IN ('draft', 'review') AND status <> 'deleted') AS draft
     FROM std_data_elements
     WHERE status <> 'deleted'${projectClause}`,
        projectParams
      );
      const [[catalogRow]] = await pool.query(`SELECT COUNT(*) AS total FROM std_catalogs WHERE status <> 'deleted'${projectClause}`, projectParams);
      const [[domainRow]] = await pool.query(`SELECT COUNT(*) AS total FROM std_value_domains WHERE status <> 'deleted'${projectClause}`, projectParams);
      const [[referenceRow]] = await pool.query(`SELECT COUNT(*) AS total FROM std_reference_standards WHERE status <> 'deleted'${projectClause}`, projectParams);
      const [[mappingRow]] = await pool.query(
        `SELECT COUNT(*) AS total,
            SUM(mapping_status = 'approved') AS approved,
            SUM(mapping_status = 'suggested') AS suggested
     FROM std_field_mappings
     WHERE mapping_status <> 'deleted'${projectClause}`,
        projectParams
      );
      const [recentElements] = await pool.query(
        `${buildElementSelect()}
     WHERE e.status <> 'deleted'${projectId ? " AND e.project_id = ?" : ""}
     GROUP BY e.id, c.catalog_name, c.catalog_code, vd.domain_name, vd.domain_code, rs.standard_name
     ORDER BY e.updated_at DESC
     LIMIT 6`,
        projectParams
      );
      return {
        elementCount: Number(elementRow.total || 0),
        publishedElementCount: Number(elementRow.published || 0),
        draftElementCount: Number(elementRow.draft || 0),
        catalogCount: Number(catalogRow.total || 0),
        valueDomainCount: Number(domainRow.total || 0),
        referenceStandardCount: Number(referenceRow.total || 0),
        mappingCount: Number(mappingRow.total || 0),
        approvedMappingCount: Number(mappingRow.approved || 0),
        suggestedMappingCount: Number(mappingRow.suggested || 0),
        recentElements: recentElements.map(mapElement)
      };
    }
    async function listAiConfigs() {
      const projectId = getCurrentProjectId();
      const [rows] = await pool.query(
        `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            p.config_name AS defaultModelProviderName,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.user_prompt_template AS userPromptTemplate,
            c.output_schema_json AS outputSchema, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt
     FROM std_ai_configs c
     LEFT JOIN model_providers p ON p.id = c.default_model_provider_id
     ${projectId ? "WHERE c.project_id = ?" : ""}
     ORDER BY c.scene_code ASC`,
        projectId ? [projectId] : []
      );
      return rows.map(mapAiConfig);
    }
    async function getAiConfigBySceneCode(sceneCode) {
      const projectId = getCurrentProjectId();
      const [rows] = await pool.query(
        `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            p.config_name AS defaultModelProviderName,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.user_prompt_template AS userPromptTemplate,
            c.output_schema_json AS outputSchema, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt
     FROM std_ai_configs c
     LEFT JOIN model_providers p ON p.id = c.default_model_provider_id
     WHERE c.scene_code = ?${projectId ? " AND c.project_id = ?" : ""}
     LIMIT 1`,
        projectId ? [sceneCode, projectId] : [sceneCode]
      );
      return rows[0] ? mapAiConfig(rows[0]) : null;
    }
    async function getAiConfigById(id) {
      const configs = await listAiConfigs();
      return configs.find((item) => item.id === Number(id)) || null;
    }
    async function createAiConfig(payload, db = pool) {
      const projectId = getCurrentProjectId();
      const [result] = await db.query(
        `INSERT INTO std_ai_configs
      (project_id, scene_name, scene_code, default_model_provider_id, default_model_name, default_model_version,
       temperature, max_tokens, timeout_ms, system_prompt, user_prompt_template, output_schema_json,
       description, owner_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.sceneName,
          payload.sceneCode,
          payload.defaultModelProviderId || null,
          payload.defaultModelName || null,
          payload.defaultModelVersion || null,
          payload.temperature ?? null,
          payload.maxTokens ?? null,
          payload.timeoutMs ?? null,
          payload.systemPrompt || null,
          payload.userPromptTemplate || null,
          JSON.stringify(payload.outputSchema || {}),
          payload.description || null,
          payload.ownerName || "system",
          payload.status || "active"
        ]
      );
      return getAiConfigById(result.insertId);
    }
    async function updateAiConfig(id, payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `UPDATE std_ai_configs
     SET scene_name = ?, scene_code = ?, default_model_provider_id = ?, default_model_name = ?,
         default_model_version = ?, temperature = ?, max_tokens = ?, timeout_ms = ?,
         system_prompt = ?, user_prompt_template = ?, output_schema_json = ?,
         description = ?, owner_name = ?, status = ?
     WHERE id = ?${projectId ? " AND project_id = ?" : ""}`,
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
          payload.userPromptTemplate || null,
          JSON.stringify(payload.outputSchema || {}),
          payload.description || null,
          payload.ownerName || "system",
          payload.status || "active",
          id,
          ...projectId ? [projectId] : []
        ]
      );
      if (!result.affectedRows) return null;
      return getAiConfigById(id);
    }
    async function createAiRun(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO std_ai_runs
      (project_id, scene_code, target_type, target_id, model_provider_id, model_name, model_version,
       request_json, response_json, status, duration_ms, error_message, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.sceneCode,
          payload.targetType || null,
          payload.targetId || null,
          payload.modelProviderId || null,
          payload.modelName || null,
          payload.modelVersion || null,
          payload.request ? JSON.stringify(payload.request) : null,
          payload.response ? JSON.stringify(payload.response) : null,
          payload.status || "success",
          payload.durationMs ?? null,
          payload.errorMessage || null,
          payload.createdBy || "system"
        ]
      );
      return result.insertId;
    }
    async function listFieldMappings(filters = {}) {
      const where = ["fm.mapping_status <> 'deleted'"];
      const params = [];
      addProjectCondition(where, params, "fm");
      if (filters.elementId) {
        where.push("fm.element_id = ?");
        params.push(Number(filters.elementId));
      }
      if (filters.mappingStatus) {
        where.push("fm.mapping_status = ?");
        params.push(String(filters.mappingStatus));
      }
      if (filters.keyword) {
        where.push("(fm.table_name LIKE ? OR fm.column_name LIKE ? OR e.element_name_cn LIKE ? OR e.element_code LIKE ?)");
        const keyword = `%${String(filters.keyword).trim()}%`;
        params.push(keyword, keyword, keyword, keyword);
      }
      const [rows] = await pool.query(
        `SELECT fm.id, fm.element_id AS elementId, e.element_code AS elementCode, e.element_name_cn AS elementNameCn,
            fm.source_module AS sourceModule, fm.resource_id AS resourceId, fm.resource_code AS resourceCode,
            fm.table_name AS tableName, fm.column_name AS columnName, fm.field_snapshot_json AS fieldSnapshot,
            fm.mapping_status AS mappingStatus, fm.confidence, fm.evidence_json AS evidence,
            fm.created_by AS createdBy, fm.reviewed_by AS reviewedBy, fm.reviewed_at AS reviewedAt,
            fm.created_at AS createdAt, fm.updated_at AS updatedAt
     FROM std_field_mappings fm
     JOIN std_data_elements e ON e.id = fm.element_id
     WHERE ${where.join(" AND ")}
     ORDER BY fm.updated_at DESC, fm.id DESC`,
        params
      );
      return rows.map((row) => ({
        id: Number(row.id),
        elementId: Number(row.elementId),
        elementCode: row.elementCode,
        elementNameCn: row.elementNameCn,
        sourceModule: row.sourceModule,
        resourceId: toNumber(row.resourceId),
        resourceCode: row.resourceCode || "",
        tableName: row.tableName,
        columnName: row.columnName,
        fieldSnapshot: parseJson(row.fieldSnapshot, {}),
        mappingStatus: row.mappingStatus,
        confidence: row.confidence === null || row.confidence === void 0 ? null : Number(row.confidence),
        evidence: parseJson(row.evidence, []),
        createdBy: row.createdBy || "system",
        reviewedBy: row.reviewedBy || "",
        reviewedAt: row.reviewedAt || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    }
    module2.exports = {
      buildElementSnapshot,
      createAiConfig,
      createAiRun,
      createCatalog,
      createDataElement,
      createReferenceStandard,
      createValueDomain,
      deleteCatalog,
      deleteDataElement,
      deleteReferenceStandard,
      deleteValueDomain,
      getAiConfigById,
      getAiConfigBySceneCode,
      getCatalogById,
      getDataElementById,
      getDataElementDetail,
      getNextElementCode,
      getOverview,
      getReferenceStandardById,
      getValueDomainById,
      listAiConfigs,
      listCatalogs,
      listDataElementIdentityKeys,
      listDataElements,
      listFieldMappings,
      listReferenceStandards,
      listValueDomains,
      publishDataElement,
      updateAiConfig,
      updateCatalog,
      updateDataElement,
      updateReferenceStandard,
      updateValueDomain
    };
  }
});

// backend/src/modules/data-standards/data-standards.service.js
var require_data_standards_service = __commonJS({
  "backend/src/modules/data-standards/data-standards.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var modelProviderService = require_model_provider_service();
    var repository = require_data_standards_repository();
    var STANDARD_ELEMENT_GENERATION_SCENE = "standard_element_generation";
    var STANDARD_FIELD_MAPPING_SCENE = "standard_field_mapping";
    var ELEMENT_STANDARD_TYPES = {
      national: { prefix: "GB", label: "\u56FD\u5BB6\u6807\u51C6" },
      industry: { prefix: "HB", label: "\u884C\u4E1A\u6807\u51C6" },
      enterprise: { prefix: "QB", label: "\u4F01\u4E1A\u6807\u51C6" }
    };
    var ELEMENT_CODE_SERIAL_DIGITS = 5;
    var ELEMENT_IDENTIFIER_PREFIXES = /* @__PURE__ */ new Set(["STD", "GB", "HB", "QB", "BASE", "DICT", "PERSON", "ORG", "PLACE", "EVENT", "OBJECT", "OPS"]);
    function buildStandardElementGenerationSystemPrompt() {
      return [
        "\u4F60\u662F\u6570\u636E\u6CBB\u7406\u6807\u51C6\u6570\u636E\u5143\u8BBE\u8BA1\u4E13\u5BB6\u3002",
        "\u8BF7\u57FA\u4E8E\u8F93\u5165\u7684\u5B57\u6BB5\u3001\u8868\u3001\u6837\u4F8B\u3001\u4E1A\u52A1\u8BF4\u660E\u548C\u5F15\u7528\u6807\u51C6\u8BC1\u636E\uFF0C\u751F\u6210\u4FDD\u5B88\u7684\u6807\u51C6\u6570\u636E\u5143\u5019\u9009\u3002",
        "standardType \u53EA\u80FD\u53D6 national\u3001industry\u3001enterprise\uFF1BelementCode \u5FC5\u987B\u6309\u6807\u51C6\u7C7B\u578B\u91C7\u7528 GB/HB/QB+\u4E94\u4F4D\u6D41\u6C34\u53F7\uFF0C\u4F8B\u5982 GB00001\u3001HB00001\u3001QB00001\u3002",
        "elementIdentifier \u53EA\u80FD\u4F7F\u7528\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u4E0B\u5212\u7EBF\uFF0C\u4E0D\u8981\u5E26 STD\u3001GB\u3001HB\u3001QB\u3001BASE\u3001DICT\u3001PERSON\u3001ORG\u3001PLACE\u3001EVENT\u3001OBJECT\u3001OPS \u7B49\u524D\u7F00\uFF0C\u4E5F\u4E0D\u8981\u4F7F\u7528 PERSON.NAME\u3001ORG.REGISTERED_ADDRESS\u3001DE02.01.030 \u8FD9\u7C7B\u5206\u6BB5\u524D\u7F00\u5F0F\u6807\u8BC6\u7B26\u3002",
        "\u751F\u6210\u7684 elementCode \u548C elementIdentifier \u4E0D\u80FD\u4E0E\u5DF2\u6709\u6807\u51C6\u6570\u636E\u5143\u91CD\u590D\uFF1B\u5982\u679C\u4E0D\u786E\u5B9A\uFF0C\u4F18\u5148\u4F7F\u7528\u8F93\u5165\u5B57\u6BB5\u8BED\u4E49\u751F\u6210\u65E0\u524D\u7F00\u6807\u8BC6\u7B26\u3002",
        "\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown \u6216\u4EE3\u7801\u5757\u3002",
        "\u4E0D\u8981\u7F16\u9020\u8F93\u5165\u4E2D\u6CA1\u6709\u8BC1\u636E\u652F\u6491\u7684\u884C\u4E1A\u6807\u51C6\u7F16\u53F7\u3001\u503C\u57DF\u6216\u4E1A\u52A1\u4E8B\u5B9E\u3002",
        '\u8F93\u51FA\u7ED3\u6784\uFF1A{"candidates":[{"standardType":"enterprise","elementCode":"QB00001","elementIdentifier":"NAME","elementNameCn":"","elementNameEn":"","objectClass":"","propertyName":"","representationTerm":"","qualifiers":[],"definition":"","dataType":"string","maxLength":null,"numericPrecision":null,"numericScale":null,"formatPattern":"","unit":"","aliases":[],"tags":[],"referenceClause":"","confidence":0.8,"evidence":[],"risks":[]}]}'
      ].join("\n");
    }
    var DEFAULT_AI_CONFIGS = [
      {
        sceneName: "\u6807\u51C6\u6570\u636E\u5143\u751F\u6210",
        sceneCode: STANDARD_ELEMENT_GENERATION_SCENE,
        temperature: 0.2,
        maxTokens: 3e3,
        timeoutMs: 6e4,
        systemPrompt: buildStandardElementGenerationSystemPrompt(),
        userPromptTemplate: "\u8F93\u5165\u8BC1\u636E\uFF1A{{sourceText}}",
        outputSchema: {
          type: "object",
          properties: {
            candidates: { type: "array" }
          }
        },
        description: "\u4ECE\u5B57\u6BB5\u5143\u6570\u636E\u3001\u6837\u4F8B\u548C\u4E1A\u52A1\u8BF4\u660E\u4E2D\u751F\u6210\u6807\u51C6\u6570\u636E\u5143\u5019\u9009\u3002",
        ownerName: "System Administrator",
        status: "active"
      },
      {
        sceneName: "\u5B57\u6BB5\u91C7\u6807\u63A8\u8350",
        sceneCode: STANDARD_FIELD_MAPPING_SCENE,
        temperature: 0.1,
        maxTokens: 3e3,
        timeoutMs: 6e4,
        systemPrompt: [
          "\u4F60\u662F\u6570\u636E\u6CBB\u7406\u5B57\u6BB5\u91C7\u6807\u52A9\u624B\u3002",
          "\u8BF7\u57FA\u4E8E\u5B57\u6BB5\u5143\u6570\u636E\u548C\u5019\u9009\u6807\u51C6\u6570\u636E\u5143\uFF0C\u63A8\u8350\u6700\u5339\u914D\u7684\u6570\u636E\u5143\u5E76\u8BF4\u660E\u8BC1\u636E\u3002",
          "\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002\u5019\u9009\u4E0D\u8DB3\u65F6\u8FD4\u56DE\u7A7A recommendations\u3002",
          '\u8F93\u51FA\u7ED3\u6784\uFF1A{"recommendations":[{"fieldName":"","elementCode":"","confidence":0.85,"evidence":[],"risks":[]}]}'
        ].join("\n"),
        userPromptTemplate: "\u8F93\u5165\u8BC1\u636E\uFF1A{{sourceText}}",
        outputSchema: {
          type: "object",
          properties: {
            recommendations: { type: "array" }
          }
        },
        description: "\u4E3A\u6570\u636E\u5730\u56FE\u5B57\u6BB5\u63A8\u8350\u6807\u51C6\u6570\u636E\u5143\u6620\u5C04\u3002",
        ownerName: "System Administrator",
        status: "active"
      }
    ];
    function currentUserName(user) {
      return user?.displayName || user?.username || "system";
    }
    function normalizeCode(value) {
      return String(value || "").trim().replace(/[^A-Za-z0-9_.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    }
    function normalizeElementIdentifier(value) {
      const text = normalizeCode(value).replace(/[.-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      const parts = text.split("_").filter(Boolean);
      while (parts.length > 1 && ELEMENT_IDENTIFIER_PREFIXES.has(String(parts[0]).toUpperCase())) {
        parts.shift();
      }
      return parts.join("_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
    }
    function inferStandardTypeFromElementCode(elementCode) {
      const prefix = String(elementCode || "").trim().slice(0, 2).toUpperCase();
      const match = Object.entries(ELEMENT_STANDARD_TYPES).find(([, item]) => item.prefix === prefix);
      return match?.[0] || "";
    }
    function normalizeElementStandardType(value, fallback = "enterprise") {
      return ELEMENT_STANDARD_TYPES[String(value || "")] ? String(value) : fallback;
    }
    function assertElementIdentifier(identifier) {
      const text = String(identifier || "").trim();
      const firstPart = text.split(/[._-]/)[0]?.toUpperCase();
      if (ELEMENT_IDENTIFIER_PREFIXES.has(firstPart)) {
        throw new AppError("\u6570\u636E\u5143\u6807\u8BC6\u7B26\u4E0D\u8981\u5E26\u524D\u7F00", 400);
      }
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(text)) {
        throw new AppError("\u6570\u636E\u5143\u6807\u8BC6\u7B26\u4EC5\u652F\u6301\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u4E0B\u5212\u7EBF\uFF0C\u4E14\u5FC5\u987B\u4EE5\u5B57\u6BCD\u5F00\u5934", 400);
      }
    }
    async function prepareDataElementPayload(payload, existing = null) {
      const elementIdentifier = normalizeElementIdentifier(payload.elementIdentifier);
      assertElementIdentifier(elementIdentifier);
      const inferredType = inferStandardTypeFromElementCode(payload.elementCode) || existing?.standardType;
      const standardType = normalizeElementStandardType(payload.standardType, inferredType || "enterprise");
      const prefix = ELEMENT_STANDARD_TYPES[standardType].prefix;
      const elementCode = payload.elementCode ? String(payload.elementCode).trim().toUpperCase() : await repository.getNextElementCode(standardType);
      if (!new RegExp(`^${prefix}[0-9]{${ELEMENT_CODE_SERIAL_DIGITS}}$`).test(elementCode)) {
        throw new AppError(`${ELEMENT_STANDARD_TYPES[standardType].label}\u7F16\u7801\u5FC5\u987B\u91C7\u7528 ${prefix}+\u4E94\u4F4D\u6D41\u6C34\u53F7\uFF0C\u4F8B\u5982 ${prefix}00001`, 400);
      }
      return {
        ...payload,
        standardType,
        elementCode,
        elementIdentifier
      };
    }
    function extractJsonObject(text = "") {
      const raw = String(text || "").trim();
      if (!raw) {
        throw new Error("\u6A21\u578B\u672A\u8FD4\u56DE\u6709\u6548\u5185\u5BB9");
      }
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        return raw.slice(firstBrace, lastBrace + 1);
      }
      throw new Error("\u6A21\u578B\u54CD\u5E94\u4E2D\u672A\u627E\u5230 JSON \u5BF9\u8C61");
    }
    function parseJsonObjectWithRecovery(text = "") {
      try {
        return JSON.parse(String(text || "{}"));
      } catch {
        return JSON.parse(extractJsonObject(text));
      }
    }
    function createElementIdentityState(keys = []) {
      const usedCodes = /* @__PURE__ */ new Set();
      const usedIdentifiers = /* @__PURE__ */ new Set();
      const maxSerialByPrefix = new Map(Object.values(ELEMENT_STANDARD_TYPES).map((item) => [item.prefix, 0]));
      for (const key of keys) {
        const code = String(key.elementCode || "").trim().toUpperCase();
        const identifier = String(key.elementIdentifier || "").trim().toUpperCase();
        if (code) usedCodes.add(code);
        if (identifier) usedIdentifiers.add(identifier);
        const match = code.match(/^(GB|HB|QB)(\d{4,5})$/);
        if (match) {
          maxSerialByPrefix.set(match[1], Math.max(maxSerialByPrefix.get(match[1]) || 0, Number(match[2]) || 0));
        }
      }
      return { usedCodes, usedIdentifiers, maxSerialByPrefix };
    }
    function reserveNextElementCode(standardType, state) {
      const type = normalizeElementStandardType(standardType, "enterprise");
      const prefix = ELEMENT_STANDARD_TYPES[type].prefix;
      let nextNo = Number(state.maxSerialByPrefix.get(prefix) || 0) + 1;
      let code = `${prefix}${String(nextNo).padStart(ELEMENT_CODE_SERIAL_DIGITS, "0")}`;
      while (state.usedCodes.has(code)) {
        nextNo += 1;
        code = `${prefix}${String(nextNo).padStart(ELEMENT_CODE_SERIAL_DIGITS, "0")}`;
      }
      state.maxSerialByPrefix.set(prefix, nextNo);
      state.usedCodes.add(code);
      return code;
    }
    function peekNextElementCode(standardType, state) {
      const type = normalizeElementStandardType(standardType, "enterprise");
      const prefix = ELEMENT_STANDARD_TYPES[type].prefix;
      let nextNo = Number(state.maxSerialByPrefix.get(prefix) || 0) + 1;
      let code = `${prefix}${String(nextNo).padStart(ELEMENT_CODE_SERIAL_DIGITS, "0")}`;
      while (state.usedCodes.has(code)) {
        nextNo += 1;
        code = `${prefix}${String(nextNo).padStart(ELEMENT_CODE_SERIAL_DIGITS, "0")}`;
      }
      return code;
    }
    function normalizeCandidateElementCode(candidateCode, standardType, state) {
      const match = String(candidateCode || "").trim().toUpperCase().match(/^(GB|HB|QB)(\d{4,5})$/);
      const typeFromCode = match ? inferStandardTypeFromElementCode(match[1]) : "";
      const type = normalizeElementStandardType(typeFromCode || standardType, "enterprise");
      const prefix = ELEMENT_STANDARD_TYPES[type].prefix;
      if (match && match[1] === prefix) {
        const serialNo = Number(match[2]) || 0;
        const normalized = `${prefix}${String(serialNo).padStart(ELEMENT_CODE_SERIAL_DIGITS, "0")}`;
        if (serialNo > 0 && new RegExp(`^${prefix}[0-9]{${ELEMENT_CODE_SERIAL_DIGITS}}$`).test(normalized) && !state.usedCodes.has(normalized)) {
          state.usedCodes.add(normalized);
          state.maxSerialByPrefix.set(prefix, Math.max(state.maxSerialByPrefix.get(prefix) || 0, Number(normalized.slice(2)) || 0));
          return normalized;
        }
      }
      return reserveNextElementCode(type, state);
    }
    function reserveElementIdentifier(value, state) {
      const base = normalizeElementIdentifier(value) || "DATA_ELEMENT";
      const root = /^[A-Za-z]/.test(base) ? base : `DE_${base}`;
      let candidate = root;
      let counter = 2;
      while (state.usedIdentifiers.has(candidate.toUpperCase())) {
        candidate = `${root}_${counter}`;
        counter += 1;
      }
      state.usedIdentifiers.add(candidate.toUpperCase());
      return candidate;
    }
    function buildAiGenerationRuntimePrompt(state) {
      const nextCodes = Object.keys(ELEMENT_STANDARD_TYPES).map((type) => `${ELEMENT_STANDARD_TYPES[type].label}:${peekNextElementCode(type, state)}`).join("\uFF0C");
      return [
        "\u8FD0\u884C\u65F6\u7EA6\u675F\uFF1A",
        `\u5F53\u524D\u4E0B\u4E00\u53EF\u7528\u6807\u51C6\u7F16\u7801\u53C2\u8003\uFF1A${nextCodes}\u3002`,
        "\u5982\u679C\u8F93\u5165\u6216\u6A21\u578B\u63A8\u65AD\u51FA\u7684\u7F16\u7801\u3001\u6807\u8BC6\u7B26\u4E0E\u5DF2\u6709\u6570\u636E\u5143\u91CD\u590D\uFF0C\u5FC5\u987B\u6539\u7528\u65B0\u7684\u4E94\u4F4D\u6D41\u6C34\u53F7\u7F16\u7801\u548C\u65E0\u524D\u7F00\u552F\u4E00\u6807\u8BC6\u7B26\u3002",
        "\u6807\u8BC6\u7B26\u793A\u4F8B\uFF1ANAME\u3001REGISTERED_ADDRESS\u3001SOCIAL_CREDIT_CODE\uFF1B\u4E0D\u8981\u8F93\u51FA PERSON.NAME\u3001ORG.REGISTERED_ADDRESS\u3001DE02.01.030\u3002"
      ].join("\n");
    }
    function normalizeSuggestedResult(result, state, defaults = {}) {
      const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
      return {
        ...result,
        candidates: candidates.map((candidate) => {
          const standardType = normalizeElementStandardType(candidate.standardType || inferStandardTypeFromElementCode(candidate.elementCode), "enterprise");
          const elementCode = normalizeCandidateElementCode(candidate.elementCode, standardType, state);
          const identifierSource = candidate.elementIdentifier || candidate.elementNameEn || candidate.propertyName || candidate.elementNameCn || elementCode;
          return {
            ...candidate,
            standardType,
            elementCode,
            elementIdentifier: reserveElementIdentifier(identifierSource, state),
            catalogId: candidate.catalogId || defaults.catalogId || null,
            referenceStandardId: candidate.referenceStandardId || defaults.referenceStandardId || null
          };
        })
      };
    }
    async function ensureDefaultAiConfigs() {
      const configs = await repository.listAiConfigs();
      const existingCodes = new Set(configs.map((item) => item.sceneCode));
      for (const config of DEFAULT_AI_CONFIGS) {
        if (!existingCodes.has(config.sceneCode)) {
          await repository.createAiConfig(config);
        }
      }
    }
    async function getOverview() {
      return repository.getOverview();
    }
    async function listCatalogs() {
      return repository.listCatalogs();
    }
    function buildCatalogTree(catalogs) {
      const nodeMap = /* @__PURE__ */ new Map();
      catalogs.forEach((item) => {
        nodeMap.set(item.id, { ...item, children: [] });
      });
      const roots = [];
      nodeMap.forEach((node) => {
        if (node.parentId && nodeMap.has(node.parentId)) {
          nodeMap.get(node.parentId).children.push(node);
        } else {
          roots.push(node);
        }
      });
      return roots;
    }
    async function listCatalogTree() {
      return buildCatalogTree(await repository.listCatalogs());
    }
    async function createCatalog(payload, user) {
      try {
        return await repository.createCatalog(payload, currentUserName(user));
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u6807\u51C6\u76EE\u5F55\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function updateCatalog(id, payload) {
      if (payload.parentId && Number(payload.parentId) === Number(id)) {
        throw new AppError("\u7236\u7EA7\u76EE\u5F55\u4E0D\u80FD\u9009\u62E9\u81EA\u8EAB", 400);
      }
      try {
        const row = await repository.updateCatalog(id, payload);
        if (!row) throw new AppError("\u6807\u51C6\u76EE\u5F55\u4E0D\u5B58\u5728", 404);
        return row;
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u6807\u51C6\u76EE\u5F55\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function deleteCatalog(id) {
      const deleted = await repository.deleteCatalog(id);
      if (!deleted) throw new AppError("\u6807\u51C6\u76EE\u5F55\u4E0D\u5B58\u5728", 404);
    }
    async function listReferenceStandards(filters) {
      return repository.listReferenceStandards(filters);
    }
    async function createReferenceStandard(payload, user) {
      try {
        return await repository.createReferenceStandard(payload, currentUserName(user));
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u5F15\u7528\u6807\u51C6\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function updateReferenceStandard(id, payload) {
      try {
        const row = await repository.updateReferenceStandard(id, payload);
        if (!row) throw new AppError("\u5F15\u7528\u6807\u51C6\u4E0D\u5B58\u5728", 404);
        return row;
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u5F15\u7528\u6807\u51C6\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function deleteReferenceStandard(id) {
      const deleted = await repository.deleteReferenceStandard(id);
      if (!deleted) throw new AppError("\u5F15\u7528\u6807\u51C6\u4E0D\u5B58\u5728", 404);
    }
    async function listValueDomains(filters) {
      return repository.listValueDomains(filters);
    }
    async function getValueDomainDetail(id) {
      const row = await repository.getValueDomainById(id);
      if (!row) throw new AppError("\u503C\u57DF\u4E0D\u5B58\u5728", 404);
      return row;
    }
    async function createValueDomain(payload, user) {
      try {
        return await repository.createValueDomain(payload, currentUserName(user));
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u503C\u57DF\u7F16\u7801\u6216\u503C\u57DF\u9879\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function updateValueDomain(id, payload) {
      try {
        const row = await repository.updateValueDomain(id, payload);
        if (!row) throw new AppError("\u503C\u57DF\u4E0D\u5B58\u5728", 404);
        return row;
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u503C\u57DF\u7F16\u7801\u6216\u503C\u57DF\u9879\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function deleteValueDomain(id) {
      const deleted = await repository.deleteValueDomain(id);
      if (!deleted) throw new AppError("\u503C\u57DF\u4E0D\u5B58\u5728", 404);
    }
    async function listDataElements(filters) {
      return repository.listDataElements(filters);
    }
    async function getDataElementDetail(id) {
      const row = await repository.getDataElementDetail(id);
      if (!row) throw new AppError("\u6807\u51C6\u6570\u636E\u5143\u4E0D\u5B58\u5728", 404);
      return row;
    }
    async function createDataElement(payload, user) {
      try {
        return await repository.createDataElement(await prepareDataElementPayload(payload), currentUserName(user));
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u6807\u51C6\u6570\u636E\u5143\u6807\u8BC6\u7B26\u6216\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function updateDataElement(id, payload) {
      try {
        const existing = await repository.getDataElementById(id);
        if (!existing) throw new AppError("\u6807\u51C6\u6570\u636E\u5143\u4E0D\u5B58\u5728", 404);
        const row = await repository.updateDataElement(id, await prepareDataElementPayload(payload, existing));
        if (!row) throw new AppError("\u6807\u51C6\u6570\u636E\u5143\u4E0D\u5B58\u5728", 404);
        return row;
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u6807\u51C6\u6570\u636E\u5143\u6807\u8BC6\u7B26\u6216\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function publishDataElement(id, payload, user) {
      const row = await repository.publishDataElement(id, {
        changeSummary: payload.changeSummary || "",
        createdBy: currentUserName(user)
      });
      if (!row) throw new AppError("\u6807\u51C6\u6570\u636E\u5143\u4E0D\u5B58\u5728", 404);
      return row;
    }
    async function deleteDataElement(id) {
      const deleted = await repository.deleteDataElement(id);
      if (!deleted) throw new AppError("\u6807\u51C6\u6570\u636E\u5143\u4E0D\u5B58\u5728", 404);
    }
    async function listFieldMappings(filters) {
      return repository.listFieldMappings(filters);
    }
    async function validateDefaultProvider(defaultModelProviderId, defaultModelName, defaultModelVersion) {
      if (!defaultModelProviderId) {
        return {
          defaultModelProviderId: null,
          defaultModelName: defaultModelName || null,
          defaultModelVersion: defaultModelVersion || null
        };
      }
      const provider = await modelProviderService.getModelProviderById(defaultModelProviderId);
      return {
        defaultModelProviderId: Number(defaultModelProviderId),
        defaultModelName: defaultModelName || provider.modelName,
        defaultModelVersion: defaultModelVersion || provider.modelVersion || provider.modelName
      };
    }
    async function listAiConfigs() {
      await ensureDefaultAiConfigs();
      return repository.listAiConfigs();
    }
    async function updateAiConfig(id, payload) {
      const existing = await repository.getAiConfigById(id);
      if (!existing) throw new AppError("\u6570\u636E\u6807\u51C6\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      const normalizedModel = await validateDefaultProvider(
        payload.defaultModelProviderId ?? existing.defaultModelProviderId,
        payload.defaultModelName ?? existing.defaultModelName,
        payload.defaultModelVersion ?? existing.defaultModelVersion
      );
      const row = await repository.updateAiConfig(id, {
        ...payload,
        defaultModelProviderId: normalizedModel.defaultModelProviderId,
        defaultModelName: normalizedModel.defaultModelName,
        defaultModelVersion: normalizedModel.defaultModelVersion
      });
      if (!row) throw new AppError("\u6570\u636E\u6807\u51C6\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      return row;
    }
    function ruleBasedElementSuggestion(sourceText, payload = {}, state) {
      const text = String(sourceText || "").trim();
      const firstLine = text.split(/\r?\n/).map((item) => item.trim()).find(Boolean) || text;
      const nameMatch = firstLine.match(/(?:字段|名称|中文名|数据元)[:：]\s*([^,，;；\s]+)/);
      const codeMatch = text.match(/[A-Za-z][A-Za-z0-9_]{1,63}/);
      const nameCn = (nameMatch?.[1] || firstLine.replace(/[:：].*$/, "") || "\u6807\u51C6\u6570\u636E\u5143").slice(0, 128);
      const objectClass = /机构|部门|单位/.test(text) ? "\u673A\u6784" : /人员|用户|客户|学生|员工/.test(text) ? "\u4EBA\u5458" : "";
      const propertyName = /手机号|电话/.test(text) ? "\u8054\u7CFB\u7535\u8BDD" : /日期|时间/.test(text) ? "\u65F6\u95F4" : nameCn;
      const representationTerm = /代码|编码|code/i.test(text) ? "\u4EE3\u7801" : /日期|date/i.test(text) ? "\u65E5\u671F" : /金额|余额|price|amount/i.test(text) ? "\u91D1\u989D" : "\u6587\u672C";
      const dataType = /日期|date/i.test(text) ? "date" : /金额|数量|number|int|decimal/i.test(text) ? "decimal" : "string";
      const standardType = "enterprise";
      return normalizeSuggestedResult({
        candidates: [
          {
            standardType,
            elementIdentifier: codeMatch?.[0] || propertyName || nameCn,
            elementCode: "",
            elementNameCn: nameCn,
            elementNameEn: codeMatch?.[0] || "",
            catalogId: payload.catalogId || null,
            objectClass,
            propertyName,
            representationTerm,
            qualifiers: [],
            definition: text.slice(0, 800),
            dataType,
            maxLength: dataType === "string" ? 255 : null,
            numericPrecision: dataType === "decimal" ? 18 : null,
            numericScale: dataType === "decimal" ? 2 : null,
            formatPattern: dataType === "date" ? "YYYY-MM-DD" : "",
            unit: "",
            aliases: [],
            tags: ["rule_fallback"],
            referenceStandardId: payload.referenceStandardId || null,
            referenceClause: "",
            confidence: 0.45,
            evidence: ["\u5F53\u524D\u672A\u914D\u7F6E\u53EF\u7528\u6A21\u578B\uFF0C\u5DF2\u6309\u5B57\u6BB5\u6587\u672C\u505A\u89C4\u5219\u515C\u5E95\u5EFA\u8BAE"],
            risks: ["\u89C4\u5219\u515C\u5E95\u53EA\u9002\u5408\u8D77\u8349\uFF0C\u53D1\u5E03\u524D\u9700\u8981\u4EBA\u5DE5\u8865\u5145\u5B9A\u4E49\u3001\u503C\u57DF\u548C\u5F15\u7528\u6807\u51C6"]
          }
        ],
        mode: "rule_fallback"
      }, state, payload);
    }
    async function suggestDataElements(payload, user) {
      await ensureDefaultAiConfigs();
      const identityState = createElementIdentityState(await repository.listDataElementIdentityKeys());
      const aiConfig = await repository.getAiConfigBySceneCode(STANDARD_ELEMENT_GENERATION_SCENE);
      if (!aiConfig?.defaultModelProviderId || aiConfig.status !== "active") {
        return ruleBasedElementSuggestion(payload.sourceText, payload, identityState);
      }
      const startedAt = Date.now();
      const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
      const runtimeProvider = modelProviderService.applyModelSelection(provider, {
        modelName: aiConfig.defaultModelName,
        modelVersion: aiConfig.defaultModelVersion
      });
      const sourceText = String(payload.sourceText || "").trim();
      const userPrompt = String(aiConfig.userPromptTemplate || "\u8F93\u5165\u8BC1\u636E\uFF1A{{sourceText}}").replace("{{sourceText}}", sourceText);
      const systemPrompt = [
        aiConfig.systemPrompt || DEFAULT_AI_CONFIGS[0].systemPrompt,
        buildAiGenerationRuntimePrompt(identityState)
      ].join("\n\n");
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ];
      try {
        const completion = await modelProviderService.generateChatCompletion(runtimeProvider, messages, {
          temperature: aiConfig.temperature ?? 0.2,
          maxTokens: aiConfig.maxTokens || 3e3,
          timeoutMs: aiConfig.timeoutMs || 6e4
        });
        const parsed = parseJsonObjectWithRecovery(completion.content);
        const result = {
          ...normalizeSuggestedResult(parsed, identityState, payload),
          mode: "model",
          modelProviderId: runtimeProvider.id,
          modelProviderName: runtimeProvider.configName,
          modelName: runtimeProvider.modelName,
          modelVersion: runtimeProvider.modelVersion
        };
        await repository.createAiRun({
          sceneCode: STANDARD_ELEMENT_GENERATION_SCENE,
          modelProviderId: runtimeProvider.id,
          modelName: runtimeProvider.modelName,
          modelVersion: runtimeProvider.modelVersion,
          request: { sourceText, catalogId: payload.catalogId || null, referenceStandardId: payload.referenceStandardId || null },
          response: result,
          status: "success",
          durationMs: Date.now() - startedAt,
          createdBy: currentUserName(user)
        });
        return result;
      } catch (error) {
        await repository.createAiRun({
          sceneCode: STANDARD_ELEMENT_GENERATION_SCENE,
          modelProviderId: runtimeProvider.id,
          modelName: runtimeProvider.modelName,
          modelVersion: runtimeProvider.modelVersion,
          request: { sourceText },
          response: null,
          status: "failed",
          durationMs: Date.now() - startedAt,
          errorMessage: error.message || "\u6A21\u578B\u8C03\u7528\u5931\u8D25",
          createdBy: currentUserName(user)
        });
        throw error;
      }
    }
    module2.exports = {
      createCatalog,
      createDataElement,
      createReferenceStandard,
      createValueDomain,
      deleteCatalog,
      deleteDataElement,
      deleteReferenceStandard,
      deleteValueDomain,
      getDataElementDetail,
      getOverview,
      getValueDomainDetail,
      listAiConfigs,
      listCatalogTree,
      listCatalogs,
      listDataElements,
      listFieldMappings,
      listReferenceStandards,
      listValueDomains,
      publishDataElement,
      suggestDataElements,
      updateAiConfig,
      updateCatalog,
      updateDataElement,
      updateReferenceStandard,
      updateValueDomain
    };
  }
});

// backend/src/modules/data-standards/data-standards.excel.service.js
var require_data_standards_excel_service = __commonJS({
  "backend/src/modules/data-standards/data-standards.excel.service.js"(exports2, module2) {
    var crypto = require("crypto");
    var XLSX = require("xlsx");
    var { pool } = require_database();
    var AppError = require_app_error();
    var { getCurrentProjectId } = require_project_context();
    var TEMPLATE_VERSION = "v1";
    var IMPORT_TYPES = /* @__PURE__ */ new Set(["bundle", "elements", "value-domains"]);
    var IMPORT_STRATEGIES = /* @__PURE__ */ new Set(["append", "update", "merge", "overwrite"]);
    var sheetDefinitions = {
      catalogs: {
        name: "\u6807\u51C6\u76EE\u5F55",
        headers: ["\u76EE\u5F55\u7F16\u7801*", "\u76EE\u5F55\u540D\u79F0*", "\u7236\u7EA7\u76EE\u5F55\u7F16\u7801", "\u76EE\u5F55\u7C7B\u578B", "\u8D23\u4EFB\u4EBA", "\u63CF\u8FF0", "\u6392\u5E8F\u53F7", "\u72B6\u6001"],
        sample: ["CUSTOMER", "\u5BA2\u6237\u4E3B\u9898", "", "\u4E1A\u52A1\u4E3B\u9898", "\u5F20\u4E09", "\u5BA2\u6237\u76F8\u5173\u6807\u51C6", "10", "\u542F\u7528"]
      },
      references: {
        name: "\u5F15\u7528\u6807\u51C6",
        headers: ["\u6807\u51C6\u7F16\u7801*", "\u6807\u51C6\u540D\u79F0*", "\u6807\u51C6\u7C7B\u578B", "\u6807\u51C6\u53F7", "\u53D1\u5E03\u65B9", "\u751F\u6548\u65E5\u671F", "\u6807\u51C6\u7F51\u5740", "\u63CF\u8FF0", "\u72B6\u6001"],
        sample: ["GB-T-DEMO", "\u793A\u4F8B\u5F15\u7528\u6807\u51C6", "\u56FD\u5BB6\u6807\u51C6", "GB/T 00000", "\u793A\u4F8B\u673A\u6784", "2026-01-01", "", "\u793A\u4F8B\u6570\u636E", "\u542F\u7528"]
      },
      domains: {
        name: "\u503C\u57DF",
        headers: ["\u503C\u57DF\u7F16\u7801*", "\u503C\u57DF\u540D\u79F0*", "\u503C\u57DF\u7C7B\u578B", "\u503C\u7C7B\u578B", "\u6570\u636E\u7C7B\u578B", "\u6700\u5C0F\u503C", "\u6700\u5927\u503C", "\u6B63\u5219\u8868\u8FBE\u5F0F", "\u683C\u5F0F\u8868\u8FBE\u5F0F", "\u5355\u4F4D", "\u5F15\u7528\u6807\u51C6\u7F16\u7801", "\u5F15\u7528\u6761\u6B3E", "\u63CF\u8FF0", "\u72B6\u6001"],
        sample: ["CUSTOMER_STATUS", "\u5BA2\u6237\u72B6\u6001", "\u679A\u4E3E", "\u5B57\u7B26\u4E32", "string", "", "", "", "", "", "GB-T-DEMO", "", "\u5BA2\u6237\u72B6\u6001\u4EE3\u7801\u96C6", "\u542F\u7528"]
      },
      items: {
        name: "\u503C\u57DF\u4EE3\u7801\u9879",
        headers: ["\u503C\u57DF\u7F16\u7801*", "\u4EE3\u7801*", "\u4EE3\u7801\u540D\u79F0*", "\u4EE3\u7801\u503C", "\u4EE3\u7801\u542B\u4E49", "\u6392\u5E8F\u53F7", "\u72B6\u6001"],
        sample: ["CUSTOMER_STATUS", "ACTIVE", "\u6B63\u5E38", "1", "\u6B63\u5E38\u5BA2\u6237", "1", "\u542F\u7528"]
      },
      elements: {
        name: "\u6570\u636E\u5143",
        headers: [
          "\u6807\u51C6\u7F16\u7801*",
          "\u6570\u636E\u5143\u6807\u8BC6\u7B26*",
          "\u4E2D\u6587\u540D\u79F0*",
          "\u82F1\u6587\u540D\u79F0",
          "\u6807\u51C6\u7C7B\u578B",
          "\u76EE\u5F55\u7F16\u7801",
          "\u5BF9\u8C61\u7C7B",
          "\u5C5E\u6027",
          "\u8868\u793A\u8BCD",
          "\u4E1A\u52A1\u5B9A\u4E49",
          "\u6570\u636E\u7C7B\u578B*",
          "\u6700\u5927\u957F\u5EA6",
          "\u6570\u503C\u7CBE\u5EA6",
          "\u5C0F\u6570\u4F4D",
          "\u65E5\u671F\u65F6\u95F4\u7CBE\u5EA6",
          "\u683C\u5F0F",
          "\u5355\u4F4D",
          "\u503C\u57DF\u7F16\u7801",
          "\u5F15\u7528\u6807\u51C6\u7F16\u7801",
          "\u5F15\u7528\u6761\u6B3E",
          "\u522B\u540D",
          "\u6807\u7B7E",
          "\u8D23\u4EFB\u4EBA",
          "\u6570\u636E\u7BA1\u5BB6",
          "\u751F\u547D\u5468\u671F\u72B6\u6001",
          "\u72B6\u6001"
        ],
        sample: ["QB00001", "customer_status", "\u5BA2\u6237\u72B6\u6001", "Customer Status", "\u4F01\u4E1A\u6807\u51C6", "CUSTOMER", "\u5BA2\u6237", "\u72B6\u6001", "\u4EE3\u7801", "\u5BA2\u6237\u5F53\u524D\u72B6\u6001", "string", "32", "", "", "", "", "", "CUSTOMER_STATUS", "GB-T-DEMO", "", "\u5BA2\u6237\u72B6\u6001", "\u5BA2\u6237,\u72B6\u6001", "\u5F20\u4E09", "\u674E\u56DB", "\u8349\u7A3F", "\u542F\u7528"]
      }
    };
    var labelMaps = {
      status: { "\u542F\u7528": "active", "\u505C\u7528": "inactive", active: "active", inactive: "inactive" },
      standardType: { "\u56FD\u5BB6\u6807\u51C6": "national", "\u884C\u4E1A\u6807\u51C6": "industry", "\u4F01\u4E1A\u6807\u51C6": "enterprise", national: "national", industry: "industry", enterprise: "enterprise" },
      catalogType: { "\u6839\u76EE\u5F55": "root", "\u4E1A\u52A1\u4E3B\u9898": "business_domain", "\u6280\u672F\u4E3B\u9898": "technical", root: "root", business_domain: "business_domain", technical: "technical" },
      domainType: { "\u679A\u4E3E": "enumeration", "\u8303\u56F4": "range", "\u6B63\u5219": "regex", "\u5F15\u7528\u8868": "reference", "\u81EA\u7531\u6587\u672C": "free_text", enumeration: "enumeration", range: "range", regex: "regex", reference: "reference", free_text: "free_text" },
      valueType: { "\u5B57\u7B26\u4E32": "string", "\u6570\u5B57": "number", "\u65E5\u671F": "date", "\u65E5\u671F\u65F6\u95F4": "datetime", "\u5E03\u5C14": "boolean", string: "string", number: "number", date: "date", datetime: "datetime", boolean: "boolean" },
      lifecycle: { "\u8349\u7A3F": "draft", "\u5F85\u5BA1\u6838": "review", "\u5DF2\u53D1\u5E03": "published", "\u5DF2\u5E9F\u5F03": "deprecated", draft: "draft", review: "review", published: "published", deprecated: "deprecated" }
    };
    function requireProjectId() {
      const projectId = getCurrentProjectId();
      if (!projectId) throw new AppError("\u5F53\u524D\u8BF7\u6C42\u672A\u9009\u62E9\u9879\u76EE\u7A7A\u95F4", 400);
      return projectId;
    }
    function clean(value) {
      if (value === null || value === void 0) return "";
      return String(value).trim();
    }
    function nullable(value) {
      const text = clean(value);
      return text || null;
    }
    function numberOrNull(value) {
      const text = clean(value);
      if (!text) return null;
      const number = Number(text);
      return Number.isFinite(number) ? number : null;
    }
    function integerOrNull(value) {
      const number = numberOrNull(value);
      return Number.isInteger(number) ? number : null;
    }
    function splitList(value) {
      return clean(value).split(/[,，;；]/).map((item) => item.trim()).filter(Boolean);
    }
    function mapped(group, value, fallback) {
      const text = clean(value);
      return labelMaps[group][text] || fallback;
    }
    function rowValue(row, header) {
      return row[header] ?? row[`${header}*`] ?? "";
    }
    function workbookRows(workbook, definition) {
      const sheet = workbook.Sheets[definition.name];
      if (!sheet) return [];
      return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }).map((row, index) => ({
        rowNumber: index + 2,
        row
      })).filter(({ row }) => Object.values(row).some((value) => clean(value)));
    }
    function parseWorkbook(buffer) {
      try {
        const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
        return {
          catalogs: workbookRows(workbook, sheetDefinitions.catalogs),
          references: workbookRows(workbook, sheetDefinitions.references),
          domains: workbookRows(workbook, sheetDefinitions.domains),
          items: workbookRows(workbook, sheetDefinitions.items),
          elements: workbookRows(workbook, sheetDefinitions.elements)
        };
      } catch {
        throw new AppError("Excel \u6587\u4EF6\u65E0\u6CD5\u89E3\u6790\uFF0C\u8BF7\u4F7F\u7528\u7CFB\u7EDF\u4E0B\u8F7D\u7684\u6A21\u677F", 400);
      }
    }
    function mapCatalog(entry) {
      const row = entry.row;
      return { ...entry, code: clean(rowValue(row, "\u76EE\u5F55\u7F16\u7801")), payload: {
        catalogCode: clean(rowValue(row, "\u76EE\u5F55\u7F16\u7801")),
        catalogName: clean(rowValue(row, "\u76EE\u5F55\u540D\u79F0")),
        parentCode: clean(rowValue(row, "\u7236\u7EA7\u76EE\u5F55\u7F16\u7801")),
        catalogType: mapped("catalogType", rowValue(row, "\u76EE\u5F55\u7C7B\u578B"), "business_domain"),
        ownerName: nullable(rowValue(row, "\u8D23\u4EFB\u4EBA")),
        description: nullable(rowValue(row, "\u63CF\u8FF0")),
        sortOrder: integerOrNull(rowValue(row, "\u6392\u5E8F\u53F7")) ?? 0,
        status: mapped("status", rowValue(row, "\u72B6\u6001"), "active")
      } };
    }
    function mapReference(entry) {
      const row = entry.row;
      return { ...entry, code: clean(rowValue(row, "\u6807\u51C6\u7F16\u7801")), payload: {
        standardCode: clean(rowValue(row, "\u6807\u51C6\u7F16\u7801")),
        standardName: clean(rowValue(row, "\u6807\u51C6\u540D\u79F0")),
        standardType: mapped("standardType", rowValue(row, "\u6807\u51C6\u7C7B\u578B"), "enterprise"),
        standardNo: nullable(rowValue(row, "\u6807\u51C6\u53F7")),
        publisher: nullable(rowValue(row, "\u53D1\u5E03\u65B9")),
        effectiveDate: nullable(rowValue(row, "\u751F\u6548\u65E5\u671F")),
        standardUrl: nullable(rowValue(row, "\u6807\u51C6\u7F51\u5740")),
        description: nullable(rowValue(row, "\u63CF\u8FF0")),
        status: mapped("status", rowValue(row, "\u72B6\u6001"), "active")
      } };
    }
    function mapDomain(entry) {
      const row = entry.row;
      return { ...entry, code: clean(rowValue(row, "\u503C\u57DF\u7F16\u7801")), payload: {
        domainCode: clean(rowValue(row, "\u503C\u57DF\u7F16\u7801")),
        domainName: clean(rowValue(row, "\u503C\u57DF\u540D\u79F0")),
        domainType: mapped("domainType", rowValue(row, "\u503C\u57DF\u7C7B\u578B"), "enumeration"),
        valueType: mapped("valueType", rowValue(row, "\u503C\u7C7B\u578B"), "string"),
        dataType: nullable(rowValue(row, "\u6570\u636E\u7C7B\u578B")),
        minValue: numberOrNull(rowValue(row, "\u6700\u5C0F\u503C")),
        maxValue: numberOrNull(rowValue(row, "\u6700\u5927\u503C")),
        regexPattern: nullable(rowValue(row, "\u6B63\u5219\u8868\u8FBE\u5F0F")),
        formatPattern: nullable(rowValue(row, "\u683C\u5F0F\u8868\u8FBE\u5F0F")),
        unit: nullable(rowValue(row, "\u5355\u4F4D")),
        referenceCode: clean(rowValue(row, "\u5F15\u7528\u6807\u51C6\u7F16\u7801")),
        referenceClause: nullable(rowValue(row, "\u5F15\u7528\u6761\u6B3E")),
        description: nullable(rowValue(row, "\u63CF\u8FF0")),
        status: mapped("status", rowValue(row, "\u72B6\u6001"), "active")
      } };
    }
    function mapItem(entry) {
      const row = entry.row;
      const domainCode = clean(rowValue(row, "\u503C\u57DF\u7F16\u7801"));
      const itemCode = clean(rowValue(row, "\u4EE3\u7801"));
      return { ...entry, code: `${domainCode}:${itemCode}`, payload: {
        domainCode,
        itemCode,
        itemLabel: clean(rowValue(row, "\u4EE3\u7801\u540D\u79F0")),
        itemValue: nullable(rowValue(row, "\u4EE3\u7801\u503C")),
        itemMeaning: nullable(rowValue(row, "\u4EE3\u7801\u542B\u4E49")),
        sortOrder: integerOrNull(rowValue(row, "\u6392\u5E8F\u53F7")) ?? 0,
        status: mapped("status", rowValue(row, "\u72B6\u6001"), "active")
      } };
    }
    function mapElement(entry) {
      const row = entry.row;
      return { ...entry, code: clean(rowValue(row, "\u6807\u51C6\u7F16\u7801")), payload: {
        elementCode: clean(rowValue(row, "\u6807\u51C6\u7F16\u7801")),
        elementIdentifier: clean(rowValue(row, "\u6570\u636E\u5143\u6807\u8BC6\u7B26")),
        elementNameCn: clean(rowValue(row, "\u4E2D\u6587\u540D\u79F0")),
        elementNameEn: nullable(rowValue(row, "\u82F1\u6587\u540D\u79F0")),
        standardType: mapped("standardType", rowValue(row, "\u6807\u51C6\u7C7B\u578B"), "enterprise"),
        catalogCode: clean(rowValue(row, "\u76EE\u5F55\u7F16\u7801")),
        objectClass: nullable(rowValue(row, "\u5BF9\u8C61\u7C7B")),
        propertyName: nullable(rowValue(row, "\u5C5E\u6027")),
        representationTerm: nullable(rowValue(row, "\u8868\u793A\u8BCD")),
        definition: nullable(rowValue(row, "\u4E1A\u52A1\u5B9A\u4E49")),
        dataType: clean(rowValue(row, "\u6570\u636E\u7C7B\u578B")) || "string",
        maxLength: integerOrNull(rowValue(row, "\u6700\u5927\u957F\u5EA6")),
        numericPrecision: integerOrNull(rowValue(row, "\u6570\u503C\u7CBE\u5EA6")),
        numericScale: integerOrNull(rowValue(row, "\u5C0F\u6570\u4F4D")),
        datetimePrecision: nullable(rowValue(row, "\u65E5\u671F\u65F6\u95F4\u7CBE\u5EA6")),
        formatPattern: nullable(rowValue(row, "\u683C\u5F0F")),
        unit: nullable(rowValue(row, "\u5355\u4F4D")),
        valueDomainCode: clean(rowValue(row, "\u503C\u57DF\u7F16\u7801")),
        referenceCode: clean(rowValue(row, "\u5F15\u7528\u6807\u51C6\u7F16\u7801")),
        referenceClause: nullable(rowValue(row, "\u5F15\u7528\u6761\u6B3E")),
        aliases: splitList(rowValue(row, "\u522B\u540D")),
        tags: splitList(rowValue(row, "\u6807\u7B7E")),
        ownerName: nullable(rowValue(row, "\u8D23\u4EFB\u4EBA")),
        stewardName: nullable(rowValue(row, "\u6570\u636E\u7BA1\u5BB6")),
        lifecycleStatus: mapped("lifecycle", rowValue(row, "\u751F\u547D\u5468\u671F\u72B6\u6001"), "draft"),
        status: mapped("status", rowValue(row, "\u72B6\u6001"), "active")
      } };
    }
    function error(sheetName, entry, fieldName, message, rawValue = "") {
      return { sheetName, rowNumber: entry.rowNumber, businessCode: entry.code || null, fieldName, rawValue: clean(rawValue), errorType: "validation", errorMessage: message };
    }
    async function loadExisting(projectId) {
      const tables = [
        ["catalogs", `SELECT c.id, c.catalog_code AS code, p.catalog_code AS parentCode
      FROM std_catalogs c
      LEFT JOIN std_catalogs p ON p.id = c.parent_id AND p.project_id = c.project_id
      WHERE c.project_id = ? AND c.status <> 'deleted'`],
        ["references", "SELECT id, standard_code AS code FROM std_reference_standards WHERE project_id = ? AND status <> 'deleted'"],
        ["domains", "SELECT id, domain_code AS code FROM std_value_domains WHERE project_id = ? AND status <> 'deleted'"],
        ["elements", "SELECT id, element_code AS code, element_identifier AS identifier, lifecycle_status AS lifecycleStatus, current_version_no AS currentVersionNo FROM std_data_elements WHERE project_id = ? AND status <> 'deleted'"],
        ["items", `SELECT i.id, CONCAT(d.domain_code, ':', i.item_code) AS code FROM std_value_domain_items i JOIN std_value_domains d ON d.id = i.domain_id WHERE i.project_id = ? AND d.project_id = ? AND i.status <> 'deleted'`]
      ];
      const result = {};
      for (const [key, sql] of tables) {
        const params = key === "items" ? [projectId, projectId] : [projectId];
        const [rows] = await pool.query(sql, params);
        result[key] = new Map(rows.map((row) => [String(row.code).toUpperCase(), row]));
      }
      result.identifiers = new Map([...result.elements.values()].map((row) => [String(row.identifier).toUpperCase(), row]));
      return result;
    }
    function decideAction(strategy, existing) {
      if (strategy === "append") return existing ? "error" : "create";
      if (strategy === "update") return existing ? "update" : "error";
      return existing ? "update" : "create";
    }
    function validateEntries(parsed, existing, strategy) {
      const errors = [];
      const seen = { catalogs: /* @__PURE__ */ new Set(), references: /* @__PURE__ */ new Set(), domains: /* @__PURE__ */ new Set(), items: /* @__PURE__ */ new Set(), elements: /* @__PURE__ */ new Set(), identifiers: /* @__PURE__ */ new Set() };
      const allCodes = {
        catalogs: /* @__PURE__ */ new Set([...existing.catalogs.keys(), ...parsed.catalogs.map((entry) => entry.code.toUpperCase())]),
        references: /* @__PURE__ */ new Set([...existing.references.keys(), ...parsed.references.map((entry) => entry.code.toUpperCase())]),
        domains: /* @__PURE__ */ new Set([...existing.domains.keys(), ...parsed.domains.map((entry) => entry.code.toUpperCase())])
      };
      const groups = [
        ["catalogs", "\u6807\u51C6\u76EE\u5F55", "\u76EE\u5F55\u7F16\u7801", "\u76EE\u5F55\u540D\u79F0"],
        ["references", "\u5F15\u7528\u6807\u51C6", "\u6807\u51C6\u7F16\u7801", "\u6807\u51C6\u540D\u79F0"],
        ["domains", "\u503C\u57DF", "\u503C\u57DF\u7F16\u7801", "\u503C\u57DF\u540D\u79F0"],
        ["items", "\u503C\u57DF\u4EE3\u7801\u9879", "\u503C\u57DF\u7F16\u7801\u548C\u4EE3\u7801", "\u4EE3\u7801\u540D\u79F0"],
        ["elements", "\u6570\u636E\u5143", "\u6807\u51C6\u7F16\u7801", "\u4E2D\u6587\u540D\u79F0"]
      ];
      for (const [key, sheetName, codeField, nameField] of groups) {
        for (const entry of parsed[key]) {
          const normalized = entry.code.toUpperCase();
          if (!entry.code) errors.push(error(sheetName, entry, codeField, `${codeField}\u4E0D\u80FD\u4E3A\u7A7A`));
          if (seen[key].has(normalized)) errors.push(error(sheetName, entry, codeField, `\u6587\u4EF6\u5185${codeField}\u91CD\u590D`));
          seen[key].add(normalized);
          const nameValue = key === "items" ? entry.payload.itemLabel : key === "elements" ? entry.payload.elementNameCn : key === "catalogs" ? entry.payload.catalogName : key === "references" ? entry.payload.standardName : entry.payload.domainName;
          if (!nameValue) errors.push(error(sheetName, entry, nameField, `${nameField}\u4E0D\u80FD\u4E3A\u7A7A`));
          const action = decideAction(strategy, existing[key].get(normalized));
          if (action === "error") errors.push(error(sheetName, entry, codeField, strategy === "append" ? "\u5F53\u524D\u9879\u76EE\u4E2D\u5DF2\u5B58\u5728\uFF0C\u8FFD\u52A0\u6A21\u5F0F\u4E0D\u5141\u8BB8\u4FEE\u6539" : "\u5F53\u524D\u9879\u76EE\u4E2D\u4E0D\u5B58\u5728\uFF0C\u66F4\u65B0\u6A21\u5F0F\u4E0D\u5141\u8BB8\u65B0\u589E"));
          entry.action = action;
        }
      }
      for (const entry of parsed.catalogs) {
        if (entry.payload.parentCode && !allCodes.catalogs.has(entry.payload.parentCode.toUpperCase())) errors.push(error("\u6807\u51C6\u76EE\u5F55", entry, "\u7236\u7EA7\u76EE\u5F55\u7F16\u7801", "\u7236\u7EA7\u76EE\u5F55\u4E0D\u5B58\u5728"));
        if (entry.payload.parentCode && entry.payload.parentCode.toUpperCase() === entry.code.toUpperCase()) errors.push(error("\u6807\u51C6\u76EE\u5F55", entry, "\u7236\u7EA7\u76EE\u5F55\u7F16\u7801", "\u7236\u7EA7\u76EE\u5F55\u4E0D\u80FD\u662F\u81EA\u8EAB"));
      }
      const catalogParents = new Map([...existing.catalogs.entries()].map(([code, row]) => [code, clean(row.parentCode).toUpperCase() || null]));
      for (const entry of parsed.catalogs) catalogParents.set(entry.code.toUpperCase(), entry.payload.parentCode?.toUpperCase() || null);
      for (const entry of parsed.catalogs) {
        const origin = entry.code.toUpperCase();
        const visited = /* @__PURE__ */ new Set([origin]);
        let current = catalogParents.get(origin);
        while (current) {
          if (visited.has(current)) {
            errors.push(error("\u6807\u51C6\u76EE\u5F55", entry, "\u7236\u7EA7\u76EE\u5F55\u7F16\u7801", "\u76EE\u5F55\u5C42\u7EA7\u5B58\u5728\u5FAA\u73AF\u5F15\u7528"));
            break;
          }
          visited.add(current);
          current = catalogParents.get(current);
        }
      }
      for (const entry of parsed.domains) {
        if (entry.payload.referenceCode && !allCodes.references.has(entry.payload.referenceCode.toUpperCase())) errors.push(error("\u503C\u57DF", entry, "\u5F15\u7528\u6807\u51C6\u7F16\u7801", "\u5F15\u7528\u6807\u51C6\u4E0D\u5B58\u5728"));
        if (entry.payload.domainType === "range" && entry.payload.minValue !== null && entry.payload.maxValue !== null && entry.payload.minValue > entry.payload.maxValue) errors.push(error("\u503C\u57DF", entry, "\u6700\u5C0F\u503C", "\u6700\u5C0F\u503C\u4E0D\u80FD\u5927\u4E8E\u6700\u5927\u503C"));
      }
      for (const entry of parsed.items) {
        if (!entry.payload.domainCode || !allCodes.domains.has(entry.payload.domainCode.toUpperCase())) errors.push(error("\u503C\u57DF\u4EE3\u7801\u9879", entry, "\u503C\u57DF\u7F16\u7801", "\u503C\u57DF\u4E0D\u5B58\u5728"));
        if (!entry.payload.itemCode) errors.push(error("\u503C\u57DF\u4EE3\u7801\u9879", entry, "\u4EE3\u7801", "\u4EE3\u7801\u4E0D\u80FD\u4E3A\u7A7A"));
      }
      for (const entry of parsed.elements) {
        const payload = entry.payload;
        if (!/^(GB|HB|QB)\d{5}$/i.test(payload.elementCode)) errors.push(error("\u6570\u636E\u5143", entry, "\u6807\u51C6\u7F16\u7801", "\u6807\u51C6\u7F16\u7801\u5FC5\u987B\u91C7\u7528 GB/HB/QB \u52A0\u4E94\u4F4D\u6D41\u6C34\u53F7"));
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(payload.elementIdentifier)) errors.push(error("\u6570\u636E\u5143", entry, "\u6570\u636E\u5143\u6807\u8BC6\u7B26", "\u6807\u8BC6\u7B26\u4EC5\u652F\u6301\u4EE5\u5B57\u6BCD\u5F00\u5934\u7684\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u4E0B\u5212\u7EBF"));
        const identifierKey = payload.elementIdentifier.toUpperCase();
        if (seen.identifiers.has(identifierKey)) errors.push(error("\u6570\u636E\u5143", entry, "\u6570\u636E\u5143\u6807\u8BC6\u7B26", "\u6587\u4EF6\u5185\u6570\u636E\u5143\u6807\u8BC6\u7B26\u91CD\u590D"));
        seen.identifiers.add(identifierKey);
        const identifierOwner = existing.identifiers.get(identifierKey);
        const codeOwner = existing.elements.get(entry.code.toUpperCase());
        if (identifierOwner && Number(identifierOwner.id) !== Number(codeOwner?.id || 0)) errors.push(error("\u6570\u636E\u5143", entry, "\u6570\u636E\u5143\u6807\u8BC6\u7B26", "\u6807\u8BC6\u7B26\u5DF2\u88AB\u5176\u4ED6\u6570\u636E\u5143\u4F7F\u7528"));
        if (!payload.dataType) errors.push(error("\u6570\u636E\u5143", entry, "\u6570\u636E\u7C7B\u578B", "\u6570\u636E\u7C7B\u578B\u4E0D\u80FD\u4E3A\u7A7A"));
        if (payload.catalogCode && !allCodes.catalogs.has(payload.catalogCode.toUpperCase())) errors.push(error("\u6570\u636E\u5143", entry, "\u76EE\u5F55\u7F16\u7801", "\u6807\u51C6\u76EE\u5F55\u4E0D\u5B58\u5728"));
        if (payload.valueDomainCode && !allCodes.domains.has(payload.valueDomainCode.toUpperCase())) errors.push(error("\u6570\u636E\u5143", entry, "\u503C\u57DF\u7F16\u7801", "\u503C\u57DF\u4E0D\u5B58\u5728"));
        if (payload.referenceCode && !allCodes.references.has(payload.referenceCode.toUpperCase())) errors.push(error("\u6570\u636E\u5143", entry, "\u5F15\u7528\u6807\u51C6\u7F16\u7801", "\u5F15\u7528\u6807\u51C6\u4E0D\u5B58\u5728"));
      }
      return errors;
    }
    function normalizeParsed(rows) {
      return {
        catalogs: rows.catalogs.map(mapCatalog),
        references: rows.references.map(mapReference),
        domains: rows.domains.map(mapDomain),
        items: rows.items.map(mapItem),
        elements: rows.elements.map(mapElement)
      };
    }
    function summarize(parsed, errors) {
      const entries = Object.values(parsed).flat();
      return {
        totalRows: entries.length,
        createRows: entries.filter((entry) => entry.action === "create").length,
        updateRows: entries.filter((entry) => entry.action === "update").length,
        errorRows: new Set(errors.map((item) => `${item.sheetName}:${item.rowNumber}`)).size,
        sheetCounts: Object.fromEntries(Object.entries(parsed).map(([key, rows]) => [key, rows.length]))
      };
    }
    async function previewImport(file, options = {}) {
      if (!file?.buffer) throw new AppError("\u8BF7\u9009\u62E9 Excel \u6587\u4EF6", 400);
      const importType = IMPORT_TYPES.has(options.importType) ? options.importType : "bundle";
      const strategy = IMPORT_STRATEGIES.has(options.strategy) ? options.strategy : "merge";
      const projectId = requireProjectId();
      const parsed = normalizeParsed(parseWorkbook(file.buffer));
      if (importType === "elements") parsed.catalogs = parsed.references = parsed.domains = parsed.items = [];
      if (importType === "value-domains") parsed.catalogs = parsed.references = parsed.elements = [];
      if (Object.values(parsed).every((rows) => rows.length === 0)) throw new AppError("Excel \u4E2D\u672A\u8BC6\u522B\u5230\u5F53\u524D\u5BFC\u5165\u8303\u56F4\u7684\u6570\u636E\uFF0C\u8BF7\u4F7F\u7528\u7CFB\u7EDF\u6A21\u677F\u5E76\u4FDD\u7559\u8868\u5934", 400);
      const existing = await loadExisting(projectId);
      const errors = validateEntries(parsed, existing, strategy);
      return { importType, strategy, templateVersion: TEMPLATE_VERSION, summary: summarize(parsed, errors), errors: errors.slice(0, 500) };
    }
    async function createBatch(projectId, file, options, userName) {
      const [result] = await pool.query(
        `INSERT INTO std_import_batches
      (project_id, import_type, import_strategy, template_version, source_file_name, source_file_size, source_file_hash, status, created_by, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', ?, NOW())`,
        [projectId, options.importType, options.strategy, TEMPLATE_VERSION, file.originalname || "data-standards.xlsx", file.size || file.buffer.length, crypto.createHash("sha256").update(file.buffer).digest("hex"), userName]
      );
      return Number(result.insertId);
    }
    async function saveErrors(batchId, projectId, errors, db = pool) {
      for (const item of errors) {
        await db.query(
          `INSERT INTO std_import_errors
        (project_id, batch_id, sheet_name, excel_row_number, business_code, field_name, raw_value, error_type, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [projectId, batchId, item.sheetName, item.rowNumber, item.businessCode, item.fieldName, item.rawValue, item.errorType, item.errorMessage]
        );
      }
    }
    async function getCodeMaps(db, projectId) {
      const result = {};
      for (const [key, table, column] of [["catalogs", "std_catalogs", "catalog_code"], ["references", "std_reference_standards", "standard_code"], ["domains", "std_value_domains", "domain_code"]]) {
        const [rows] = await db.query(`SELECT id, ${column} AS code FROM ${table} WHERE project_id = ? AND status <> 'deleted'`, [projectId]);
        result[key] = new Map(rows.map((row) => [String(row.code).toUpperCase(), Number(row.id)]));
      }
      return result;
    }
    async function upsertSimpleAssets(db, projectId, parsed, userName) {
      for (const entry of parsed.catalogs) {
        const p = entry.payload;
        await db.query(
          `INSERT INTO std_catalogs (project_id, parent_id, catalog_name, catalog_code, catalog_type, owner_name, description, sort_order, status, created_by)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE catalog_name=VALUES(catalog_name), catalog_type=VALUES(catalog_type), owner_name=VALUES(owner_name), description=VALUES(description), sort_order=VALUES(sort_order), status=VALUES(status)`,
          [projectId, p.catalogName, p.catalogCode, p.catalogType, p.ownerName, p.description, p.sortOrder, p.status, userName]
        );
      }
      for (const entry of parsed.references) {
        const p = entry.payload;
        await db.query(
          `INSERT INTO std_reference_standards (project_id, standard_code, standard_name, standard_type, standard_no, publisher, effective_date, standard_url, description, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE standard_name=VALUES(standard_name), standard_type=VALUES(standard_type), standard_no=VALUES(standard_no), publisher=VALUES(publisher), effective_date=VALUES(effective_date), standard_url=VALUES(standard_url), description=VALUES(description), status=VALUES(status)`,
          [projectId, p.standardCode, p.standardName, p.standardType, p.standardNo, p.publisher, p.effectiveDate, p.standardUrl, p.description, p.status, userName]
        );
      }
    }
    async function executeImport(db, projectId, parsed, strategy, userName) {
      await upsertSimpleAssets(db, projectId, parsed, userName);
      let maps = await getCodeMaps(db, projectId);
      for (const entry of parsed.catalogs) {
        const parentId = entry.payload.parentCode ? maps.catalogs.get(entry.payload.parentCode.toUpperCase()) : null;
        await db.query("UPDATE std_catalogs SET parent_id = ? WHERE project_id = ? AND catalog_code = ?", [parentId || null, projectId, entry.payload.catalogCode]);
      }
      for (const entry of parsed.domains) {
        const p = entry.payload;
        await db.query(
          `INSERT INTO std_value_domains (project_id, domain_code, domain_name, domain_type, value_type, data_type, min_value, max_value, regex_pattern, format_pattern, unit, reference_standard_id, reference_clause, description, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE domain_name=VALUES(domain_name), domain_type=VALUES(domain_type), value_type=VALUES(value_type), data_type=VALUES(data_type), min_value=VALUES(min_value), max_value=VALUES(max_value), regex_pattern=VALUES(regex_pattern), format_pattern=VALUES(format_pattern), unit=VALUES(unit), reference_standard_id=VALUES(reference_standard_id), reference_clause=VALUES(reference_clause), description=VALUES(description), status=VALUES(status)`,
          [projectId, p.domainCode, p.domainName, p.domainType, p.valueType, p.dataType, p.minValue, p.maxValue, p.regexPattern, p.formatPattern, p.unit, p.referenceCode ? maps.references.get(p.referenceCode.toUpperCase()) : null, p.referenceClause, p.description, p.status, userName]
        );
      }
      maps = await getCodeMaps(db, projectId);
      if (strategy === "overwrite") {
        const domainIds = [...new Set([
          ...parsed.domains.map((entry) => maps.domains.get(entry.code.toUpperCase())),
          ...parsed.items.map((entry) => maps.domains.get(entry.payload.domainCode.toUpperCase()))
        ].filter(Boolean))];
        if (domainIds.length) await db.query(`DELETE FROM std_value_domain_items WHERE project_id = ? AND domain_id IN (${domainIds.map(() => "?").join(",")})`, [projectId, ...domainIds]);
      }
      for (const entry of parsed.items) {
        const p = entry.payload;
        await db.query(
          `INSERT INTO std_value_domain_items (project_id, domain_id, item_code, item_label, item_value, item_meaning, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE item_label=VALUES(item_label), item_value=VALUES(item_value), item_meaning=VALUES(item_meaning), sort_order=VALUES(sort_order), status=VALUES(status)`,
          [projectId, maps.domains.get(p.domainCode.toUpperCase()), p.itemCode, p.itemLabel, p.itemValue, p.itemMeaning, p.sortOrder, p.status]
        );
      }
      for (const entry of parsed.elements) {
        const p = entry.payload;
        const [[existingRow]] = await db.query("SELECT id, lifecycle_status AS lifecycleStatus, current_version_no AS currentVersionNo FROM std_data_elements WHERE project_id = ? AND element_code = ? LIMIT 1", [projectId, p.elementCode]);
        const versionNo = existingRow ? Number(existingRow.currentVersionNo || 1) + (existingRow.lifecycleStatus === "published" ? 1 : 0) : 1;
        const lifecycle = existingRow?.lifecycleStatus === "published" ? "draft" : p.lifecycleStatus;
        const values = [p.elementIdentifier, p.elementNameCn, p.elementNameEn, p.catalogCode ? maps.catalogs.get(p.catalogCode.toUpperCase()) : null, p.objectClass, p.propertyName, p.representationTerm, JSON.stringify([]), p.definition, p.dataType, p.maxLength, p.numericPrecision, p.numericScale, p.datetimePrecision, p.formatPattern, p.unit, p.valueDomainCode ? maps.domains.get(p.valueDomainCode.toUpperCase()) : null, p.referenceCode ? maps.references.get(p.referenceCode.toUpperCase()) : null, p.referenceClause, JSON.stringify(p.aliases), JSON.stringify(p.tags), p.ownerName, p.stewardName, lifecycle, versionNo, p.status];
        let elementId;
        if (existingRow) {
          await db.query(
            `UPDATE std_data_elements SET element_identifier=?, element_name_cn=?, element_name_en=?, catalog_id=?, object_class=?, property_name=?, representation_term=?, qualifiers_json=?, definition=?, data_type=?, max_length=?, numeric_precision_value=?, numeric_scale_value=?, datetime_precision=?, format_pattern=?, unit=?, value_domain_id=?, reference_standard_id=?, reference_clause=?, aliases_json=?, tags_json=?, owner_name=?, steward_name=?, lifecycle_status=?, current_version_no=?, status=? WHERE id=? AND project_id=?`,
            [...values, existingRow.id, projectId]
          );
          elementId = existingRow.id;
        } else {
          const [result] = await db.query(
            `INSERT INTO std_data_elements (project_id, element_code, element_identifier, element_name_cn, element_name_en, catalog_id, object_class, property_name, representation_term, qualifiers_json, definition, data_type, max_length, numeric_precision_value, numeric_scale_value, datetime_precision, format_pattern, unit, value_domain_id, reference_standard_id, reference_clause, aliases_json, tags_json, owner_name, steward_name, lifecycle_status, current_version_no, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [projectId, p.elementCode, ...values, userName]
          );
          elementId = result.insertId;
        }
        const snapshot = { ...p, lifecycleStatus: lifecycle };
        await db.query(
          `INSERT INTO std_data_element_versions (project_id, element_id, version_no, version_status, snapshot_json, change_summary, created_by)
       VALUES (?, ?, ?, 'draft', ?, 'Excel \u6279\u91CF\u6CE8\u518C', ?)
       ON DUPLICATE KEY UPDATE snapshot_json=VALUES(snapshot_json), change_summary=VALUES(change_summary), created_by=VALUES(created_by)`,
          [projectId, elementId, versionNo, JSON.stringify(snapshot), userName]
        );
      }
    }
    async function commitImport(file, options = {}, user = {}) {
      const preview = await previewImport(file, options);
      const projectId = requireProjectId();
      const normalizedOptions = { importType: preview.importType, strategy: preview.strategy };
      const userName = user.displayName || user.username || user.sub || "system";
      const batchId = await createBatch(projectId, file, normalizedOptions, userName);
      if (preview.errors.length) {
        await saveErrors(batchId, projectId, preview.errors);
        await pool.query("UPDATE std_import_batches SET status='failed', total_rows=?, error_rows=?, summary_json=?, finished_at=NOW() WHERE id=? AND project_id=?", [preview.summary.totalRows, preview.summary.errorRows, JSON.stringify(preview.summary), batchId, projectId]);
        return { id: batchId, status: "failed", ...preview };
      }
      const parsed = normalizeParsed(parseWorkbook(file.buffer));
      if (preview.importType === "elements") parsed.catalogs = parsed.references = parsed.domains = parsed.items = [];
      if (preview.importType === "value-domains") parsed.catalogs = parsed.references = parsed.elements = [];
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await executeImport(connection, projectId, parsed, preview.strategy, userName);
        await connection.commit();
        await pool.query(
          "UPDATE std_import_batches SET status='success', total_rows=?, created_rows=?, updated_rows=?, summary_json=?, finished_at=NOW() WHERE id=? AND project_id=?",
          [preview.summary.totalRows, preview.summary.createRows, preview.summary.updateRows, JSON.stringify(preview.summary), batchId, projectId]
        );
        return { id: batchId, status: "success", ...preview };
      } catch (cause) {
        await connection.rollback();
        await pool.query("UPDATE std_import_batches SET status='failed', error_message=?, finished_at=NOW() WHERE id=? AND project_id=?", [String(cause.message || cause).slice(0, 4e3), batchId, projectId]);
        throw cause;
      } finally {
        connection.release();
      }
    }
    function addSheet(workbook, definition, rows = [], includeSample = true) {
      const data = [definition.headers, ...rows.length ? rows : includeSample ? [definition.sample] : []];
      const sheet = XLSX.utils.aoa_to_sheet(data);
      sheet["!cols"] = definition.headers.map((header) => ({ wch: Math.max(12, Math.min(32, header.length * 2 + 4)) }));
      XLSX.utils.book_append_sheet(workbook, sheet, definition.name);
    }
    function buildWorkbook(type = "bundle", exportRows = null) {
      const workbook = XLSX.utils.book_new();
      const instructions = XLSX.utils.aoa_to_sheet([
        ["\u6570\u636E\u6807\u51C6\u6279\u91CF\u6CE8\u518C\u6A21\u677F", TEMPLATE_VERSION],
        ["\u8BF4\u660E", "\u5E26 * \u7684\u5B57\u6BB5\u4E3A\u5FC5\u586B\u9879\uFF1B\u8BF7\u4FDD\u6301\u5DE5\u4F5C\u8868\u540D\u79F0\u548C\u8868\u5934\u4E0D\u53D8\u3002"],
        ["\u5BFC\u5165\u7B56\u7565", "\u8FFD\u52A0\u53EA\u65B0\u589E\uFF1B\u66F4\u65B0\u53EA\u4FEE\u6539\u5DF2\u6709\u6570\u636E\uFF1B\u5408\u5E76\u4E3A\u65B0\u589E\u52A0\u66F4\u65B0\uFF1B\u8986\u76D6\u4F1A\u5B8C\u6574\u66FF\u6362\u6240\u5217\u503C\u57DF\u7684\u4EE3\u7801\u9879\u3002"],
        ["\u5173\u8054\u65B9\u5F0F", "\u76EE\u5F55\u3001\u5F15\u7528\u6807\u51C6\u548C\u503C\u57DF\u5747\u901A\u8FC7\u4E1A\u52A1\u7F16\u7801\u5173\u8054\uFF0C\u4E0D\u586B\u5199\u6570\u636E\u5E93 ID\u3002"]
      ]);
      instructions["!cols"] = [{ wch: 18 }, { wch: 90 }];
      XLSX.utils.book_append_sheet(workbook, instructions, "\u4F7F\u7528\u8BF4\u660E");
      const keys = type === "elements" ? ["elements"] : type === "value-domains" ? ["domains", "items"] : ["catalogs", "references", "domains", "items", "elements"];
      for (const key of keys) addSheet(workbook, sheetDefinitions[key], exportRows?.[key] || [], !exportRows);
      return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    }
    async function buildExport(type = "bundle") {
      const projectId = requireProjectId();
      const rows = {};
      const queries = {
        catalogs: `SELECT c.catalog_code, c.catalog_name, p.catalog_code AS parent_code, c.catalog_type, c.owner_name, c.description, c.sort_order, c.status FROM std_catalogs c LEFT JOIN std_catalogs p ON p.id=c.parent_id WHERE c.project_id=? AND c.status<>'deleted' ORDER BY c.sort_order,c.id`,
        references: "SELECT standard_code, standard_name, standard_type, standard_no, publisher, effective_date, standard_url, description, status FROM std_reference_standards WHERE project_id=? AND status<>'deleted' ORDER BY id",
        domains: `SELECT d.domain_code,d.domain_name,d.domain_type,d.value_type,d.data_type,d.min_value,d.max_value,d.regex_pattern,d.format_pattern,d.unit,r.standard_code AS reference_code,d.reference_clause,d.description,d.status FROM std_value_domains d LEFT JOIN std_reference_standards r ON r.id=d.reference_standard_id WHERE d.project_id=? AND d.status<>'deleted' ORDER BY d.id`,
        items: `SELECT d.domain_code,i.item_code,i.item_label,i.item_value,i.item_meaning,i.sort_order,i.status FROM std_value_domain_items i JOIN std_value_domains d ON d.id=i.domain_id WHERE i.project_id=? AND d.project_id=? AND i.status<>'deleted' ORDER BY d.id,i.sort_order,i.id`,
        elements: `SELECT e.element_code,e.element_identifier,e.element_name_cn,e.element_name_en,e.catalog_id,c.catalog_code,e.object_class,e.property_name,e.representation_term,e.definition,e.data_type,e.max_length,e.numeric_precision_value,e.numeric_scale_value,e.datetime_precision,e.format_pattern,e.unit,d.domain_code,r.standard_code AS reference_code,e.reference_clause,e.aliases_json,e.tags_json,e.owner_name,e.steward_name,e.lifecycle_status,e.status FROM std_data_elements e LEFT JOIN std_catalogs c ON c.id=e.catalog_id LEFT JOIN std_value_domains d ON d.id=e.value_domain_id LEFT JOIN std_reference_standards r ON r.id=e.reference_standard_id WHERE e.project_id=? AND e.status<>'deleted' ORDER BY e.id`
      };
      const keys = type === "elements" ? ["elements"] : type === "value-domains" ? ["domains", "items"] : ["catalogs", "references", "domains", "items", "elements"];
      for (const key of keys) {
        const params = key === "items" ? [projectId, projectId] : [projectId];
        const [result] = await pool.query(queries[key], params);
        rows[key] = result.map((row) => exportRow(key, row));
      }
      return buildWorkbook(type, rows);
    }
    function exportRow(key, row) {
      const boolLabel = (value) => value === "active" ? "\u542F\u7528" : "\u505C\u7528";
      if (key === "catalogs") return [row.catalog_code, row.catalog_name, row.parent_code || "", Object.entries(labelMaps.catalogType).find(([, value]) => value === row.catalog_type)?.[0] || row.catalog_type, row.owner_name || "", row.description || "", row.sort_order, boolLabel(row.status)];
      if (key === "references") return [row.standard_code, row.standard_name, row.standard_type, row.standard_no || "", row.publisher || "", row.effective_date || "", row.standard_url || "", row.description || "", boolLabel(row.status)];
      if (key === "domains") return [row.domain_code, row.domain_name, row.domain_type, row.value_type, row.data_type || "", row.min_value ?? "", row.max_value ?? "", row.regex_pattern || "", row.format_pattern || "", row.unit || "", row.reference_code || "", row.reference_clause || "", row.description || "", boolLabel(row.status)];
      if (key === "items") return [row.domain_code, row.item_code, row.item_label, row.item_value || "", row.item_meaning || "", row.sort_order, boolLabel(row.status)];
      const parseJsonList = (value) => {
        try {
          return (typeof value === "string" ? JSON.parse(value) : value || []).join(",");
        } catch {
          return "";
        }
      };
      return [row.element_code, row.element_identifier, row.element_name_cn, row.element_name_en || "", row.element_code.startsWith("GB") ? "\u56FD\u5BB6\u6807\u51C6" : row.element_code.startsWith("HB") ? "\u884C\u4E1A\u6807\u51C6" : "\u4F01\u4E1A\u6807\u51C6", row.catalog_code || "", row.object_class || "", row.property_name || "", row.representation_term || "", row.definition || "", row.data_type, row.max_length ?? "", row.numeric_precision_value ?? "", row.numeric_scale_value ?? "", row.datetime_precision || "", row.format_pattern || "", row.unit || "", row.domain_code || "", row.reference_code || "", row.reference_clause || "", parseJsonList(row.aliases_json), parseJsonList(row.tags_json), row.owner_name || "", row.steward_name || "", row.lifecycle_status, boolLabel(row.status)];
    }
    async function listImportBatches() {
      const projectId = requireProjectId();
      const [rows] = await pool.query(
        `SELECT id, import_type AS importType, import_strategy AS strategy, source_file_name AS fileName, status,
            total_rows AS totalRows, created_rows AS createdRows, updated_rows AS updatedRows,
            skipped_rows AS skippedRows, error_rows AS errorRows, created_by AS createdBy,
            started_at AS startedAt, finished_at AS finishedAt, created_at AS createdAt
     FROM std_import_batches WHERE project_id=? ORDER BY id DESC LIMIT 100`,
        [projectId]
      );
      return rows.map((row) => ({ ...row, id: Number(row.id) }));
    }
    async function buildErrorWorkbook(batchId) {
      const projectId = requireProjectId();
      const [rows] = await pool.query(
        `SELECT sheet_name,excel_row_number AS row_number,business_code,field_name,raw_value,error_type,error_message
     FROM std_import_errors WHERE project_id=? AND batch_id=? ORDER BY sheet_name,row_number,id`,
        [projectId, batchId]
      );
      if (!rows.length) throw new AppError("\u8BE5\u6279\u6B21\u6CA1\u6709\u53EF\u4E0B\u8F7D\u7684\u9519\u8BEF\u660E\u7EC6", 404);
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([["\u5DE5\u4F5C\u8868", "\u884C\u53F7", "\u4E1A\u52A1\u7F16\u7801", "\u9519\u8BEF\u5B57\u6BB5", "\u539F\u59CB\u503C", "\u9519\u8BEF\u7C7B\u578B", "\u9519\u8BEF\u539F\u56E0"], ...rows.map((row) => [row.sheet_name, row.row_number, row.business_code || "", row.field_name || "", row.raw_value || "", row.error_type, row.error_message])]);
      sheet["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 24 }, { wch: 18 }, { wch: 30 }, { wch: 16 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(workbook, sheet, "\u9519\u8BEF\u660E\u7EC6");
      return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    }
    module2.exports = {
      buildErrorWorkbook,
      buildExport,
      buildWorkbook,
      commitImport,
      listImportBatches,
      previewImport,
      __test__: { decideAction, normalizeParsed, parseWorkbook, validateEntries }
    };
  }
});

// backend/src/modules/data-standards/data-standards.controller.js
var require_data_standards_controller = __commonJS({
  "backend/src/modules/data-standards/data-standards.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var service = require_data_standards_service();
    var excelService = require_data_standards_excel_service();
    function excelResponse(res, buffer, fileName) {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      return res.send(buffer);
    }
    async function downloadImportTemplate(req, res) {
      const type = req.query?.type || "bundle";
      return excelResponse(res, excelService.buildWorkbook(type), `\u6570\u636E\u6807\u51C6\u6279\u91CF\u6CE8\u518C\u6A21\u677F_${type}.xlsx`);
    }
    async function exportStandards(req, res) {
      const type = req.query?.type || "bundle";
      return excelResponse(res, await excelService.buildExport(type), `\u6570\u636E\u6807\u51C6\u5BFC\u51FA_${type}_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.xlsx`);
    }
    async function previewImport(req, res) {
      return sendSuccess(res, await excelService.previewImport(req.file, req.body || {}));
    }
    async function commitImport(req, res) {
      return sendSuccess(res, await excelService.commitImport(req.file, req.body || {}, req.user || {}));
    }
    async function listImportBatches(req, res) {
      const rows = await excelService.listImportBatches();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function downloadImportErrors(req, res) {
      return excelResponse(res, await excelService.buildErrorWorkbook(Number(req.params.id)), `\u6570\u636E\u6807\u51C6\u5BFC\u5165\u9519\u8BEF_${req.params.id}.xlsx`);
    }
    async function getOverview(req, res) {
      return sendSuccess(res, await service.getOverview());
    }
    async function listCatalogs(req, res) {
      const rows = await service.listCatalogs();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listCatalogTree(req, res) {
      const rows = await service.listCatalogTree();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createCatalog(req, res) {
      return sendSuccess(res, await service.createCatalog(req.validatedBody, req.user), null, 201);
    }
    async function updateCatalog(req, res) {
      return sendSuccess(res, await service.updateCatalog(Number(req.params.id), req.validatedBody));
    }
    async function deleteCatalog(req, res) {
      await service.deleteCatalog(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function listReferenceStandards(req, res) {
      const rows = await service.listReferenceStandards(req.query || {});
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createReferenceStandard(req, res) {
      return sendSuccess(res, await service.createReferenceStandard(req.validatedBody, req.user), null, 201);
    }
    async function updateReferenceStandard(req, res) {
      return sendSuccess(res, await service.updateReferenceStandard(Number(req.params.id), req.validatedBody));
    }
    async function deleteReferenceStandard(req, res) {
      await service.deleteReferenceStandard(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function listValueDomains(req, res) {
      const rows = await service.listValueDomains(req.query || {});
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getValueDomainDetail(req, res) {
      return sendSuccess(res, await service.getValueDomainDetail(Number(req.params.id)));
    }
    async function createValueDomain(req, res) {
      return sendSuccess(res, await service.createValueDomain(req.validatedBody, req.user), null, 201);
    }
    async function updateValueDomain(req, res) {
      return sendSuccess(res, await service.updateValueDomain(Number(req.params.id), req.validatedBody));
    }
    async function deleteValueDomain(req, res) {
      await service.deleteValueDomain(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function listDataElements(req, res) {
      const rows = await service.listDataElements(req.query || {});
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getDataElementDetail(req, res) {
      return sendSuccess(res, await service.getDataElementDetail(Number(req.params.id)));
    }
    async function createDataElement(req, res) {
      return sendSuccess(res, await service.createDataElement(req.validatedBody, req.user), null, 201);
    }
    async function updateDataElement(req, res) {
      return sendSuccess(res, await service.updateDataElement(Number(req.params.id), req.validatedBody));
    }
    async function publishDataElement(req, res) {
      return sendSuccess(res, await service.publishDataElement(Number(req.params.id), req.validatedBody, req.user));
    }
    async function deleteDataElement(req, res) {
      await service.deleteDataElement(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function listFieldMappings(req, res) {
      const rows = await service.listFieldMappings(req.query || {});
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listAiConfigs(req, res) {
      const rows = await service.listAiConfigs();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function updateAiConfig(req, res) {
      return sendSuccess(res, await service.updateAiConfig(Number(req.params.id), req.validatedBody));
    }
    async function suggestDataElements(req, res) {
      return sendSuccess(res, await service.suggestDataElements(req.validatedBody, req.user));
    }
    module2.exports = {
      commitImport,
      createCatalog,
      createDataElement,
      createReferenceStandard,
      createValueDomain,
      deleteCatalog,
      deleteDataElement,
      deleteReferenceStandard,
      deleteValueDomain,
      downloadImportErrors,
      downloadImportTemplate,
      exportStandards,
      getDataElementDetail,
      getOverview,
      getValueDomainDetail,
      listAiConfigs,
      listCatalogTree,
      listCatalogs,
      listDataElements,
      listFieldMappings,
      listImportBatches,
      listReferenceStandards,
      listValueDomains,
      publishDataElement,
      previewImport,
      suggestDataElements,
      updateAiConfig,
      updateCatalog,
      updateDataElement,
      updateReferenceStandard,
      updateValueDomain
    };
  }
});

// packages/data-platform-module-data-standards/src/.runtime-entry.js
var controller0 = require_data_standards_controller();
var { Writable } = require("node:stream");
var handlers = {
  "GET /api/v1/data-standards/overview": controller0["getOverview"],
  "GET /api/v1/data-standards/import-templates": controller0["downloadImportTemplate"],
  "GET /api/v1/data-standards/exports": controller0["exportStandards"],
  "GET /api/v1/data-standards/imports": controller0["listImportBatches"],
  "GET /api/v1/data-standards/imports/:id/errors": controller0["downloadImportErrors"],
  "POST /api/v1/data-standards/imports/preview": controller0["previewImport"],
  "POST /api/v1/data-standards/imports": controller0["commitImport"],
  "GET /api/v1/data-standards/catalogs/tree": controller0["listCatalogTree"],
  "GET /api/v1/data-standards/catalogs": controller0["listCatalogs"],
  "POST /api/v1/data-standards/catalogs": controller0["createCatalog"],
  "PUT /api/v1/data-standards/catalogs/:id": controller0["updateCatalog"],
  "DELETE /api/v1/data-standards/catalogs/:id": controller0["deleteCatalog"],
  "GET /api/v1/data-standards/reference-standards": controller0["listReferenceStandards"],
  "POST /api/v1/data-standards/reference-standards": controller0["createReferenceStandard"],
  "PUT /api/v1/data-standards/reference-standards/:id": controller0["updateReferenceStandard"],
  "DELETE /api/v1/data-standards/reference-standards/:id": controller0["deleteReferenceStandard"],
  "GET /api/v1/data-standards/value-domains": controller0["listValueDomains"],
  "GET /api/v1/data-standards/value-domains/:id": controller0["getValueDomainDetail"],
  "POST /api/v1/data-standards/value-domains": controller0["createValueDomain"],
  "PUT /api/v1/data-standards/value-domains/:id": controller0["updateValueDomain"],
  "DELETE /api/v1/data-standards/value-domains/:id": controller0["deleteValueDomain"],
  "GET /api/v1/data-standards/elements": controller0["listDataElements"],
  "GET /api/v1/data-standards/elements/:id": controller0["getDataElementDetail"],
  "POST /api/v1/data-standards/elements": controller0["createDataElement"],
  "PUT /api/v1/data-standards/elements/:id": controller0["updateDataElement"],
  "POST /api/v1/data-standards/elements/:id/publish": controller0["publishDataElement"],
  "DELETE /api/v1/data-standards/elements/:id": controller0["deleteDataElement"],
  "GET /api/v1/data-standards/mappings": controller0["listFieldMappings"],
  "GET /api/v1/data-standards/ai-configs": controller0["listAiConfigs"],
  "PUT /api/v1/data-standards/ai-configs/:id": controller0["updateAiConfig"],
  "POST /api/v1/data-standards/ai/suggest-elements": controller0["suggestDataElements"]
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
