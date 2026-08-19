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

// backend/src/modules/platform/platform.repository.js
var require_platform_repository = __commonJS({
  "backend/src/modules/platform/platform.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var { getCurrentProjectId } = require_project_context();
    function projectWhere() {
      const projectId = getCurrentProjectId();
      return projectId ? { sql: " WHERE project_id = ?", params: [projectId] } : { sql: "", params: [] };
    }
    async function countProjectTable(tableName) {
      const scoped = projectWhere();
      const [[row]] = await pool.query(`SELECT COUNT(*) AS total FROM ${tableName}${scoped.sql}`, scoped.params);
      return Number(row?.total || 0);
    }
    async function getModuleMetrics() {
      const [
        dataSourceCount,
        ingestionCount,
        qualityRuleCount,
        processingCount,
        modelTemplateCount,
        modelInstanceCount,
        serviceCount
      ] = await Promise.all([
        countProjectTable("data_sources"),
        countProjectTable("ingestion_tasks"),
        countProjectTable("qc_strategy"),
        countProjectTable("dev_processing_jobs"),
        countProjectTable("lab_business_system_template"),
        countProjectTable("lab_business_system_instance"),
        countProjectTable("service_apis")
      ]);
      return {
        dataSourceCount,
        ingestionJobCount: ingestionCount,
        qualityRuleCount,
        processingJobCount: processingCount,
        dataModelCount: Number(modelTemplateCount || 0) + Number(modelInstanceCount || 0),
        serviceApiCount: serviceCount
      };
    }
    module2.exports = {
      getModuleMetrics
    };
  }
});

// backend/src/modules/platform/platform.service.js
var require_platform_service = __commonJS({
  "backend/src/modules/platform/platform.service.js"(exports2, module2) {
    var platformRepository = require_platform_repository();
    async function getOverview() {
      const metrics = await platformRepository.getModuleMetrics();
      return {
        modules: [
          {
            key: "data-ingestion",
            name: "\u6570\u636E\u63A5\u5165",
            description: "\u7EDF\u4E00\u7BA1\u7406\u6570\u636E\u5E93\u3001\u6587\u4EF6\u3001\u63A5\u53E3\u3001\u6D88\u606F\u7B49\u591A\u6E90\u5F02\u6784\u6570\u636E\u63A5\u5165\u94FE\u8DEF\u3002",
            capabilities: ["\u6570\u636E\u6E90\u767B\u8BB0", "\u63A5\u5165\u4EFB\u52A1\u914D\u7F6E", "\u5168\u91CF/\u589E\u91CF\u540C\u6B65", "\u8FD0\u884C\u76D1\u63A7"],
            total: metrics.ingestionJobCount
          },
          {
            key: "quality-control",
            name: "\u8D28\u91CF\u7BA1\u63A7",
            description: "\u56F4\u7ED5\u8D28\u91CF\u89C4\u5219\u3001\u68C0\u6D4B\u7B56\u7565\u3001\u6267\u884C\u4EFB\u52A1\u548C\u95EE\u9898\u5206\u6790\u5EFA\u7ACB\u6570\u636E\u8D28\u91CF\u95ED\u73AF\u3002",
            capabilities: ["\u89C4\u5219\u7BA1\u7406", "\u7B56\u7565\u914D\u7F6E", "\u8D28\u91CF\u68C0\u6D4B", "\u95EE\u9898\u8FFD\u8E2A"],
            total: metrics.qualityRuleCount
          },
          {
            key: "data-processing",
            name: "\u6570\u636E\u5904\u7406",
            description: "\u63D0\u4F9B\u6570\u636E\u6E05\u6D17\u3001\u8F6C\u6362\u3001\u6807\u51C6\u5316\u548C\u8C03\u5EA6\u7F16\u6392\u7684\u6570\u636E\u52A0\u5DE5\u80FD\u529B\u3002",
            capabilities: ["SQL\u5206\u6790", "SQL\u4EFB\u52A1", "ETL \u7F16\u6392", "\u6E05\u6D17\u6807\u51C6\u5316", "\u8C03\u5EA6\u7BA1\u7406"],
            total: metrics.processingJobCount
          },
          {
            key: "data-modeling",
            name: "\u6570\u636E\u5EFA\u6A21",
            description: "\u6C89\u6DC0\u884C\u4E1A\u573A\u666F\u3001\u903B\u8F91\u6A21\u578B\u3001\u7269\u7406\u6A21\u578B\u548C\u6837\u672C\u65B9\u6848\u7B49\u7ED3\u6784\u5316\u6570\u636E\u8D44\u4EA7\u3002",
            capabilities: ["\u573A\u666F\u6A21\u677F", "\u903B\u8F91\u6A21\u578B", "\u7269\u7406\u6A21\u578B", "\u6837\u672C\u65B9\u6848"],
            total: metrics.dataModelCount
          },
          {
            key: "data-service",
            name: "\u6570\u636E\u670D\u52A1",
            description: "\u901A\u8FC7 API\u3001\u6570\u636E\u96C6\u548C\u670D\u52A1\u76EE\u5F55\u5411\u4E0A\u5C42\u5E94\u7528\u63D0\u4F9B\u7EDF\u4E00\u7684\u6570\u636E\u6D88\u8D39\u51FA\u53E3\u3002",
            capabilities: ["\u670D\u52A1\u7F16\u76EE", "\u7EDF\u4E00\u9274\u6743", "\u53D1\u5E03\u5BA1\u6279", "\u8BBF\u95EE\u7EDF\u8BA1"],
            total: metrics.serviceApiCount
          }
        ],
        stats: [
          { key: "dataSourceCount", label: "\u6570\u636E\u6E90", value: metrics.dataSourceCount },
          { key: "ingestionJobCount", label: "\u63A5\u5165\u4EFB\u52A1", value: metrics.ingestionJobCount },
          { key: "qualityRuleCount", label: "\u8D28\u91CF\u89C4\u5219", value: metrics.qualityRuleCount },
          { key: "processingJobCount", label: "\u5904\u7406\u4EFB\u52A1", value: metrics.processingJobCount },
          { key: "dataModelCount", label: "\u5EFA\u6A21\u8D44\u4EA7", value: metrics.dataModelCount },
          { key: "serviceApiCount", label: "\u6570\u636E\u670D\u52A1", value: metrics.serviceApiCount }
        ]
      };
    }
    module2.exports = {
      getOverview
    };
  }
});

// backend/src/modules/platform/platform.controller.js
var require_platform_controller = __commonJS({
  "backend/src/modules/platform/platform.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var platformService = require_platform_service();
    async function overview(req, res) {
      const result = await platformService.getOverview();
      return sendSuccess(res, result);
    }
    module2.exports = {
      overview
    };
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

// runtime-port:config
var require_config = __commonJS({
  "runtime-port:config"(exports2, module2) {
    var { createRuntimeConfigProxy } = require("@johnason/data-platform-core-kernel");
    module2.exports = createRuntimeConfigProxy();
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

// backend/src/modules/data-sources/data-source.metadata.js
var require_data_source_metadata = __commonJS({
  "backend/src/modules/data-sources/data-source.metadata.js"(exports2, module2) {
    var mysql = require("mysql2/promise");
    var AppError = require_app_error();
    var hiveService = require_hiveService();
    var {
      inferDatasourceDialect,
      normalizeDatasourceType,
      resolveDatasourceConnection
    } = require_datasource_dialect();
    var { createPostgresLikeClient } = require_db_client();
    var { getAdapter } = require_adapters();
    var { getManagedBinding } = require_managed_jdbc_runtime();
    var POSTGRESQL = "postgresql";
    function usesAdapterRuntime(sourceType) {
      return ["oracle", "dm"].includes(sourceType) || Boolean(getManagedBinding(sourceType));
    }
    function resolveAdapterScope(dataSource, sourceType) {
      const config = normalizeConnectionConfig(dataSource);
      return ["oracle", "dm"].includes(sourceType) ? dataSource?.connectionConfig?.schema || config.user : config.database;
    }
    function normalizeSourceType(sourceType, connectionConfig = {}) {
      const normalized = normalizeDatasourceType(sourceType || "mysql");
      if (normalized === "gaussdb") {
        return POSTGRESQL;
      }
      const dialect = inferDatasourceDialect(normalized, connectionConfig);
      return dialect === "unknown" ? normalized || "mysql" : dialect;
    }
    function isPostgreSqlSource(sourceType, connectionConfig = {}) {
      return normalizeSourceType(sourceType, connectionConfig) === POSTGRESQL;
    }
    function isHiveSource(sourceType, connectionConfig = {}) {
      return normalizeSourceType(sourceType, connectionConfig) === "hive";
    }
    function escapeIdentifier(identifier, sourceType = "mysql") {
      const normalized = normalizeSourceType(sourceType);
      const quote = [POSTGRESQL, "oracle", "dm"].includes(normalized) ? '"' : "`";
      return String(identifier || "").split(".").filter(Boolean).map((part) => `${quote}${String(part).replace(new RegExp(quote, "g"), quote.repeat(2))}${quote}`).join(".");
    }
    function escapeValue(value) {
      if (value === null || value === void 0) {
        return "NULL";
      }
      if (value instanceof Date) {
        return `'${formatDateTimeForSql(value)}'`;
      }
      if (typeof value === "number") {
        if (!Number.isFinite(value)) {
          throw new AppError("\u4E0D\u652F\u6301\u5199\u5165\u975E\u6709\u9650\u6570\u503C", 400);
        }
        return String(value);
      }
      if (typeof value === "boolean") {
        return value ? "TRUE" : "FALSE";
      }
      if (Buffer.isBuffer(value)) {
        return `'\\x${value.toString("hex")}'`;
      }
      return `'${String(value).replace(/'/g, "''")}'`;
    }
    function formatDateTimeForSql(value) {
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
      const millisecond = String(date.getMilliseconds()).padStart(3, "0");
      return `${year}-${month}-${day} ${hour}:${minute}:${second}.${millisecond}`;
    }
    function normalizeConnectionConfig(dataSource) {
      const connectionConfig = dataSource?.connectionConfig || {};
      const resolved = resolveDatasourceConnection(dataSource?.sourceType, connectionConfig);
      return {
        sourceType: resolved.dialect,
        host: resolved.host,
        port: Number(resolved.port || 0),
        database: resolved.database,
        schema: resolved.schema || "public",
        user: resolved.username,
        password: resolved.password,
        jdbcUrl: resolved.jdbcUrl,
        driverClassName: resolved.driverClassName || null
      };
    }
    function cleanHiveCliOutput(text) {
      return String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => line !== "No such file or directory").filter((line) => !line.startsWith("SLF4J:")).filter((line) => !line.startsWith("[WARN]")).filter((line) => !line.startsWith("Connecting to ")).filter((line) => !line.startsWith("Connected to:")).filter((line) => !line.startsWith("Driver:")).filter((line) => !line.startsWith("Transaction isolation:")).filter((line) => !line.startsWith("Closing:")).filter((line) => !line.startsWith("Beeline version")).filter((line) => !line.startsWith("0: jdbc:hive2://"));
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
    async function listHiveTables(dataSource) {
      const config = normalizeConnectionConfig(dataSource);
      const sql = [
        "!set silent true",
        "!set showHeader false",
        "!set outputformat csv2",
        `USE ${escapeIdentifier(config.database || "default", "hive")};`,
        "SHOW TABLES;"
      ].join("\n");
      const result = await hiveService.runHiveSql(sql, {
        host: config.host,
        port: config.port,
        database: config.database || "default",
        username: config.user || "hive",
        password: config.password || "hive"
      });
      return cleanHiveCliOutput(result.stdout).filter((tableName) => !tableName.startsWith("__medata_stage_")).filter((tableName) => !tableName.startsWith("+")).filter((tableName) => !tableName.startsWith("|")).map((tableName) => ({
        tableName,
        tableType: "BASE TABLE",
        tableComment: ""
      }));
    }
    async function listHiveColumns(dataSource, tableName) {
      const config = normalizeConnectionConfig(dataSource);
      const sql = [
        "!set silent true",
        "!set showHeader false",
        "!set outputformat csv2",
        `USE ${escapeIdentifier(config.database || "default", "hive")};`,
        `DESCRIBE ${escapeIdentifier(tableName, "hive")};`
      ].join("\n");
      const result = await hiveService.runHiveSql(sql, {
        host: config.host,
        port: config.port,
        database: config.database || "default",
        username: config.user || "hive",
        password: config.password || "hive"
      });
      return cleanHiveCliOutput(result.stdout).filter((line) => line.includes(",")).map((line, index) => {
        const [columnName, columnType] = line.split(",");
        return {
          columnName: String(columnName || "").trim(),
          ordinalPosition: index + 1,
          dataType: String(columnType || "").trim(),
          columnType: String(columnType || "").trim(),
          isNullable: true,
          isPrimaryKey: false,
          columnDefault: null,
          extra: "",
          columnComment: ""
        };
      }).filter((column) => column.columnName && !column.columnName.startsWith("#"));
    }
    async function sampleHiveRows(dataSource, tableName, limit = 100) {
      const config = normalizeConnectionConfig(dataSource);
      const safeLimit = Math.max(1, Math.min(100, Number(limit || 100)));
      const sql = [
        "!set silent true",
        "!set showHeader false",
        "!set outputformat csv2",
        `USE ${escapeIdentifier(config.database || "default", "hive")};`,
        `SELECT * FROM ${escapeIdentifier(tableName, "hive")} LIMIT ${safeLimit};`
      ].join("\n");
      const columns = await listHiveColumns(dataSource, tableName);
      const result = await hiveService.runHiveSql(sql, {
        host: config.host,
        port: config.port,
        database: config.database || "default",
        username: config.user || "hive",
        password: config.password || "hive"
      });
      const lines = cleanHiveCliOutput(result.stdout).filter((line) => line.includes(","));
      return lines.map((line) => {
        const values = parseCsvLine(line);
        return Object.fromEntries(
          columns.map((column, index) => [
            column.columnName,
            sanitizeSampleRow({ value: values[index] ?? null }).value
          ])
        );
      });
    }
    function parseQualifiedTableName(dataSource, tableName = "") {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const normalized = String(tableName || "").trim();
      const parts = normalized.split(".").filter(Boolean);
      if (isPostgreSqlSource(sourceType) || ["oracle", "dm"].includes(sourceType)) {
        if (parts.length >= 2) {
          return {
            schema: parts[parts.length - 2].replace(/"/g, ""),
            tableName: parts[parts.length - 1].replace(/"/g, "")
          };
        }
        return {
          schema: normalizeConnectionConfig(dataSource).schema,
          tableName: normalized.replace(/"/g, "")
        };
      }
      if (parts.length >= 2) {
        return {
          database: parts[parts.length - 2].replace(/`/g, ""),
          tableName: parts[parts.length - 1].replace(/`/g, "")
        };
      }
      return {
        database: normalizeConnectionConfig(dataSource).database,
        tableName: normalized.replace(/`/g, "")
      };
    }
    function buildQualifiedTableName(dataSource, tableName) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const parsed = parseQualifiedTableName(dataSource, tableName);
      if (isPostgreSqlSource(sourceType) || ["oracle", "dm"].includes(sourceType)) {
        return `${parsed.schema}.${parsed.tableName}`;
      }
      return parsed.database ? `${parsed.database}.${parsed.tableName}` : parsed.tableName;
    }
    function formatDefaultValue(sourceType, columnDefault) {
      if (columnDefault === null || columnDefault === void 0) {
        return null;
      }
      const normalized = String(columnDefault).trim();
      if (!normalized) {
        return null;
      }
      if (/^current_timestamp(?:\(\))?$/i.test(normalized) || /^now\(\)$/i.test(normalized)) {
        return "CURRENT_TIMESTAMP";
      }
      if (/^null(?:::.*)?$/i.test(normalized) || isPostgreSqlSource(sourceType) && /^nextval\(/i.test(normalized)) {
        return null;
      }
      return escapeValue(columnDefault);
    }
    function normalizeExtra(extra, sourceType = "mysql") {
      if (!extra) {
        return "";
      }
      const normalized = String(extra).split(" ").filter(Boolean).filter((part) => part.toUpperCase() !== "DEFAULT_GENERATED").join(" ");
      return isPostgreSqlSource(sourceType) ? normalized.toUpperCase() : normalized;
    }
    function normalizeDefaultValueForCompare(columnDefault) {
      if (columnDefault === null || columnDefault === void 0 || columnDefault === "") {
        return null;
      }
      const normalized = String(columnDefault).trim();
      if (!normalized || /^null(?:::.*)?$/i.test(normalized) || /^nextval\(/i.test(normalized)) {
        return null;
      }
      if (/^current_timestamp(?:\(\))?$/i.test(normalized) || /^now\(\)$/i.test(normalized)) {
        return "CURRENT_TIMESTAMP";
      }
      return normalized;
    }
    function normalizePostgreSqlColumnDefault(columnDefault) {
      if (columnDefault === null || columnDefault === void 0) {
        return null;
      }
      const normalized = String(columnDefault).trim();
      if (!normalized || /^null(?:::.*)?$/i.test(normalized) || /^nextval\(/i.test(normalized)) {
        return null;
      }
      if (/^current_timestamp(?:\(\))?$/i.test(normalized) || /^now\(\)$/i.test(normalized)) {
        return "CURRENT_TIMESTAMP";
      }
      const typedStringMatch = normalized.match(/^'(.*)'::/s);
      if (typedStringMatch) {
        return typedStringMatch[1].replace(/''/g, "'");
      }
      const typedNumberMatch = normalized.match(/^(-?\d+(?:\.\d+)?)::/);
      if (typedNumberMatch) {
        return typedNumberMatch[1];
      }
      return normalized;
    }
    function parseColumnTypeDefinition(columnType) {
      const normalized = String(columnType || "").trim().toLowerCase();
      const match = normalized.match(/^([a-z ]+?)(?:\(([^)]+)\))?$/);
      if (!match) {
        return { baseType: normalized, args: [] };
      }
      return {
        baseType: match[1].trim(),
        args: match[2] ? match[2].split(",").map((item) => item.trim()) : []
      };
    }
    function normalizePostgreSqlColumnType(columnType) {
      const rawType = String(columnType || "").trim().toLowerCase().replace(/\s+/g, " ");
      const temporalMatch = rawType.match(/^(timestamp|time)\((\d+)\) (with|without) time zone$/);
      const parsed = temporalMatch ? {
        baseType: `${temporalMatch[1]} ${temporalMatch[3]} time zone`,
        args: [temporalMatch[2]]
      } : parseColumnTypeDefinition(rawType);
      const { baseType, args } = parsed;
      const aliases = {
        varchar: "character varying",
        char: "character",
        int: "integer",
        int4: "integer",
        int8: "bigint",
        int2: "smallint",
        float8: "double precision",
        float4: "real",
        bool: "boolean",
        timestamptz: "timestamp with time zone",
        timestamp: "timestamp without time zone",
        timetz: "time with time zone",
        time: "time without time zone",
        decimal: "numeric"
      };
      const normalizedBaseType = aliases[baseType] || baseType;
      const isTemporalType = normalizedBaseType.startsWith("timestamp ") || normalizedBaseType.startsWith("time ");
      const normalizedArgs = isTemporalType && args.length === 1 && args[0] === "6" ? [] : args;
      return `${normalizedBaseType}${normalizedArgs.length ? `(${normalizedArgs.join(",")})` : ""}`;
    }
    function arePostgreSqlColumnTypesEquivalent(left, right) {
      return normalizePostgreSqlColumnType(left) === normalizePostgreSqlColumnType(right);
    }
    function areColumnTypesEquivalent(left, right, sourceType = "mysql") {
      if (isPostgreSqlSource(sourceType)) {
        return arePostgreSqlColumnTypesEquivalent(left, right);
      }
      return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
    }
    function buildColumnDefinitionSql(sourceType, column) {
      let definition = `${escapeIdentifier(column.columnName, sourceType)} ${column.columnType}`;
      if (!column.isNullable) {
        definition += " NOT NULL";
      }
      const formattedDefault = formatDefaultValue(sourceType, column.columnDefault);
      if (formattedDefault !== null) {
        definition += ` DEFAULT ${formattedDefault}`;
      }
      const extra = normalizeExtra(column.extra, sourceType);
      if (extra) {
        definition += ` ${extra}`;
      }
      if (sourceType === "mysql" && column.columnComment) {
        definition += ` COMMENT ${escapeValue(String(column.columnComment || ""))}`;
      }
      return definition;
    }
    function buildCreateTableSql(dataSource, tableName, columns, options = {}) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
      const columnSql = columns.map((column) => buildColumnDefinitionSql(sourceType, column));
      const primaryKeys = columns.filter((column) => column.isPrimaryKey).map((column) => escapeIdentifier(column.columnName, sourceType));
      if (primaryKeys.length > 0) {
        columnSql.push(`PRIMARY KEY (${primaryKeys.join(", ")})`);
      }
      let sql = `CREATE TABLE ${qualifiedTable} (
${columnSql.join(",\n")}
)`;
      if (sourceType === "mysql" && options.tableComment) {
        sql += ` COMMENT=${escapeValue(String(options.tableComment || ""))}`;
      }
      return sql;
    }
    async function applyTableAndColumnComments(connection, dataSource, tableName, columns, options = {}) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
      const tableComment = String(options.tableComment || "").trim();
      if (sourceType === "mysql") {
        if (tableComment) {
          await executeQuery(connection, sourceType, `ALTER TABLE ${qualifiedTable} COMMENT = ${escapeValue(tableComment)}`);
        }
        return;
      }
      if (sourceType === POSTGRESQL) {
        if (tableComment) {
          await executeQuery(connection, sourceType, `COMMENT ON TABLE ${qualifiedTable} IS ${escapeValue(tableComment)}`);
        }
        for (const column of Array.isArray(columns) ? columns : []) {
          if (!column?.columnName) continue;
          const qualifiedColumn = escapeIdentifier(column.columnName, sourceType);
          const comment = String(column.columnComment || "").trim();
          await executeQuery(
            connection,
            sourceType,
            `COMMENT ON COLUMN ${qualifiedTable}.${qualifiedColumn} IS ${comment ? escapeValue(comment) : "NULL"}`
          );
        }
      }
    }
    function isColumnEquivalent(existingColumn, expectedColumn, sourceType = "mysql") {
      return String(existingColumn.columnName) === String(expectedColumn.columnName) && areColumnTypesEquivalent(existingColumn.columnType, expectedColumn.columnType, sourceType) && Boolean(existingColumn.isNullable) === Boolean(expectedColumn.isNullable) && Boolean(existingColumn.isPrimaryKey) === Boolean(expectedColumn.isPrimaryKey) && normalizeDefaultValueForCompare(existingColumn.columnDefault) === normalizeDefaultValueForCompare(expectedColumn.columnDefault) && normalizeExtra(existingColumn.extra, sourceType).toLowerCase() === normalizeExtra(expectedColumn.extra, sourceType).toLowerCase();
    }
    function getPrimaryKeyColumns(columns) {
      return columns.filter((column) => column.isPrimaryKey).map((column) => column.columnName);
    }
    function arePrimaryKeysEquivalent(existingColumns, expectedColumns) {
      const existingPrimaryKeys = getPrimaryKeyColumns(existingColumns);
      const expectedPrimaryKeys = getPrimaryKeyColumns(expectedColumns);
      return existingPrimaryKeys.length === expectedPrimaryKeys.length && existingPrimaryKeys.every((columnName, index) => columnName === expectedPrimaryKeys[index]);
    }
    function getColumnSyncPlan(existingColumns, expectedColumns, sourceType = "mysql") {
      const existingColumnMap = new Map(existingColumns.map((column) => [column.columnName, column]));
      const additions = [];
      const modifications = [];
      for (const expectedColumn of expectedColumns) {
        const existingColumn = existingColumnMap.get(expectedColumn.columnName);
        if (!existingColumn) {
          additions.push(expectedColumn);
          continue;
        }
        if (!isColumnEquivalent(existingColumn, expectedColumn, sourceType)) {
          modifications.push(expectedColumn);
        }
      }
      return {
        additions,
        modifications,
        primaryKeyChanged: !arePrimaryKeysEquivalent(existingColumns, expectedColumns)
      };
    }
    function buildFriendlyAlterError(error, tableName) {
      if (error instanceof AppError) {
        return error;
      }
      if (error?.code === "ER_INVALID_USE_OF_NULL" || error?.code === "23502") {
        return new AppError(`\u76EE\u6807\u8868 ${tableName} \u5B58\u5728\u7A7A\u503C\u6570\u636E\uFF0C\u65E0\u6CD5\u6536\u7D27\u4E3A NOT NULL\uFF0C\u8BF7\u5148\u6E05\u6D17\u6570\u636E\u540E\u518D\u4FDD\u5B58`, 400);
      }
      if (error?.code === "ER_DUP_ENTRY" || error?.code === "23505") {
        return new AppError(`\u76EE\u6807\u8868 ${tableName} \u5B58\u5728\u91CD\u590D\u6570\u636E\uFF0C\u65E0\u6CD5\u8C03\u6574\u4E3A\u65B0\u7684\u4E3B\u952E\u7EA6\u675F\uFF0C\u8BF7\u5148\u6E05\u6D17\u91CD\u590D\u6570\u636E\u540E\u518D\u4FDD\u5B58`, 400);
      }
      if (error?.code === "ER_DATA_TOO_LONG" || error?.code === "22001") {
        return new AppError(`\u76EE\u6807\u8868 ${tableName} \u5B58\u5728\u8D85\u957F\u6570\u636E\uFF0C\u65E0\u6CD5\u6536\u7F29\u5B57\u6BB5\u957F\u5EA6\uFF0C\u8BF7\u5148\u5904\u7406\u5386\u53F2\u6570\u636E\u540E\u518D\u4FDD\u5B58`, 400);
      }
      if (error?.code === "WARN_DATA_TRUNCATED" || error?.code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD" || error?.code === "22P02") {
        return new AppError(`\u76EE\u6807\u8868 ${tableName} \u4E2D\u5DF2\u6709\u6570\u636E\u4E0E\u65B0\u5B57\u6BB5\u7C7B\u578B\u4E0D\u517C\u5BB9\uFF0C\u8BF7\u5148\u6E05\u6D17\u6570\u636E\u540E\u518D\u4FDD\u5B58`, 400);
      }
      return new AppError(`\u76EE\u6807\u8868 ${tableName} \u7ED3\u6784\u540C\u6B65\u5931\u8D25\uFF1A${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
    }
    function buildPostgreSqlUsingExpression(columnName, existingColumnType, expectedColumnType) {
      const qualifiedColumn = escapeIdentifier(columnName, POSTGRESQL);
      const existingType = parseColumnTypeDefinition(existingColumnType);
      const expectedType = parseColumnTypeDefinition(expectedColumnType);
      const targetBaseType = expectedType.baseType;
      const targetTypeSql = String(expectedColumnType || "").trim();
      const asTrimmedText = `NULLIF(BTRIM(${qualifiedColumn}::text), '')`;
      if (["timestamp", "timestamp without time zone", "timestamp with time zone"].includes(targetBaseType)) {
        return `${asTrimmedText}::${targetTypeSql}`;
      }
      if (targetBaseType === "date") {
        return `${asTrimmedText}::date`;
      }
      if (["time", "time without time zone", "time with time zone"].includes(targetBaseType)) {
        return `${asTrimmedText}::${targetTypeSql}`;
      }
      if (["integer", "bigint", "smallint", "numeric", "real", "double precision"].includes(targetBaseType)) {
        return `NULLIF(REPLACE(BTRIM(${qualifiedColumn}::text), ',', ''), '')::${targetTypeSql}`;
      }
      if (targetBaseType === "boolean") {
        return `CASE
      WHEN ${asTrimmedText} IS NULL THEN NULL
      WHEN LOWER(BTRIM(${qualifiedColumn}::text)) IN ('true', 't', '1', 'yes', 'y') THEN TRUE
      WHEN LOWER(BTRIM(${qualifiedColumn}::text)) IN ('false', 'f', '0', 'no', 'n') THEN FALSE
      ELSE NULL
    END`;
      }
      if (["json", "jsonb", "uuid"].includes(targetBaseType)) {
        return `${asTrimmedText}::${targetTypeSql}`;
      }
      if (["text", "character varying", "varchar"].includes(targetBaseType)) {
        return `${qualifiedColumn}::${targetTypeSql}`;
      }
      return null;
    }
    async function createPostgreSqlClient(dataSource) {
      const config = normalizeConnectionConfig(dataSource);
      const client = createPostgresLikeClient({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        username: config.user,
        password: config.password,
        connectionTimeoutMillis: 5e3
      }, {
        sourceType: dataSource?.sourceType
      });
      await client.connect();
      return client;
    }
    async function withConnection(dataSource, handler) {
      if (!dataSource) {
        throw new AppError("\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      }
      const sourceType = normalizeSourceType(dataSource.sourceType, dataSource.connectionConfig);
      const config = normalizeConnectionConfig(dataSource);
      if (sourceType === "mysql") {
        const connection = await mysql.createConnection({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          connectTimeout: 5e3
        });
        try {
          return await handler(connection, sourceType);
        } finally {
          await connection.end();
        }
      }
      if (sourceType === POSTGRESQL) {
        const client = await createPostgreSqlClient(dataSource);
        try {
          return await handler(client, sourceType);
        } finally {
          await client.end();
        }
      }
      throw new AppError("\u5F53\u524D\u4EC5\u652F\u6301 MySQL / PostgreSQL \u6570\u636E\u6E90\u7684\u5143\u6570\u636E\u63A2\u67E5", 400);
    }
    async function executeQuery(connection, sourceType, sql, params = []) {
      if (sourceType === "mysql") {
        const [rows] = await connection.query(sql, params);
        return rows;
      }
      const result = await connection.query(sql, params);
      return result.rows;
    }
    async function listTables(dataSource) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return listHiveTables(dataSource);
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const adapter = getAdapter(sourceType);
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        const rows = await adapter.getTables(config, resolveAdapterScope(dataSource, sourceType));
        return rows.map((row) => ({ tableName: row.name, tableType: row.type, tableComment: row.comment || "" }));
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        if (sourceType2 === "mysql") {
          const databaseName = normalizeConnectionConfig(dataSource).database;
          return executeQuery(
            connection,
            sourceType2,
            `SELECT table_name AS tableName, table_type AS tableType, table_comment AS tableComment
         FROM information_schema.tables
         WHERE table_schema = ?
         ORDER BY table_name ASC`,
            [databaseName]
          );
        }
        const { database, schema } = normalizeConnectionConfig(dataSource);
        return executeQuery(
          connection,
          sourceType2,
          `SELECT table_name AS "tableName",
              table_type AS "tableType",
              COALESCE(obj_description(format('%I.%I', table_schema, table_name)::regclass, 'pg_class'), '') AS "tableComment"
       FROM information_schema.tables
       WHERE table_catalog = $1
         AND table_schema = $2
         AND table_type IN ('BASE TABLE', 'VIEW')
       ORDER BY table_name ASC`,
          [database, schema]
        );
      });
    }
    async function listColumns(dataSource, tableName) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return listHiveColumns(dataSource, tableName);
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const adapter = getAdapter(sourceType);
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        const rows = await adapter.getColumns(config, resolveAdapterScope(dataSource, sourceType), tableName);
        return rows.map((row) => ({
          columnName: row.name,
          ordinalPosition: row.position,
          dataType: row.dataType,
          columnType: row.columnType,
          isNullable: row.nullable,
          isPrimaryKey: row.primaryKey,
          columnDefault: row.defaultValue,
          columnComment: row.comment || ""
        }));
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        const parsed = parseQualifiedTableName(dataSource, tableName);
        if (sourceType2 === "mysql") {
          const rows2 = await executeQuery(
            connection,
            sourceType2,
            `SELECT column_name AS columnName,
                ordinal_position AS ordinalPosition,
                data_type AS dataType,
                column_type AS columnType,
                is_nullable AS isNullable,
                column_default AS columnDefault,
                column_key AS columnKey,
                extra AS extra,
                column_comment AS columnComment
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ordinal_position ASC`,
            [parsed.database, parsed.tableName]
          );
          return rows2.map((row) => ({
            ...row,
            isNullable: row.isNullable === "YES",
            isPrimaryKey: row.columnKey === "PRI"
          }));
        }
        const { database } = normalizeConnectionConfig(dataSource);
        const rows = await executeQuery(
          connection,
          sourceType2,
          `SELECT c.column_name AS "columnName",
              c.ordinal_position AS "ordinalPosition",
              c.data_type AS "dataType",
              pg_catalog.format_type(a.atttypid, a.atttypmod) AS "columnType",
              c.is_nullable AS "isNullable",
              c.column_default AS "columnDefault",
              CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS "isPrimaryKey",
              COALESCE(pg_catalog.col_description(cls.oid, a.attnum), '') AS "columnComment"
       FROM information_schema.columns c
       JOIN pg_catalog.pg_class cls ON cls.relname = c.table_name
       JOIN pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace AND ns.nspname = c.table_schema
       JOIN pg_catalog.pg_attribute a ON a.attrelid = cls.oid AND a.attname = c.column_name
       LEFT JOIN (
         SELECT kcu.table_schema, kcu.table_name, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
          AND tc.table_name = kcu.table_name
         WHERE tc.constraint_type = 'PRIMARY KEY'
       ) pk
         ON pk.table_schema = c.table_schema
        AND pk.table_name = c.table_name
        AND pk.column_name = c.column_name
       WHERE c.table_catalog = $1
         AND c.table_schema = $2
         AND c.table_name = $3
       ORDER BY c.ordinal_position ASC`,
          [database, parsed.schema, parsed.tableName]
        );
        return rows.map((row) => ({
          ...row,
          isNullable: row.isNullable === "YES",
          isPrimaryKey: Boolean(row.isPrimaryKey),
          columnDefault: normalizePostgreSqlColumnDefault(row.columnDefault),
          extra: ""
        }));
      });
    }
    function groupIndexes(rows) {
      const grouped = /* @__PURE__ */ new Map();
      for (const row of rows) {
        if (!grouped.has(row.indexName)) {
          grouped.set(row.indexName, {
            indexName: row.indexName,
            unique: row.nonUnique === 0 || row.nonUnique === false,
            indexType: row.indexType,
            cardinality: row.cardinality,
            columns: []
          });
        }
        if (row.columnName) {
          grouped.get(row.indexName).columns.push(row.columnName);
        }
      }
      return Array.from(grouped.values());
    }
    async function listIndexes(dataSource, tableName) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return [];
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        return getAdapter(sourceType).getIndexes(config, resolveAdapterScope(dataSource, sourceType), tableName);
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        const parsed = parseQualifiedTableName(dataSource, tableName);
        if (sourceType2 === "mysql") {
          const rows2 = await executeQuery(
            connection,
            sourceType2,
            `SELECT index_name AS indexName,
                non_unique AS nonUnique,
                seq_in_index AS seqInIndex,
                column_name AS columnName,
                index_type AS indexType,
                cardinality AS cardinality
         FROM information_schema.statistics
         WHERE table_schema = ? AND table_name = ?
         ORDER BY index_name ASC, seq_in_index ASC`,
            [parsed.database, parsed.tableName]
          );
          return groupIndexes(rows2);
        }
        const rows = await executeQuery(
          connection,
          sourceType2,
          `SELECT idx.relname AS "indexName",
              NOT ix.indisunique AS "nonUnique",
              ord."seqInIndex" AS "seqInIndex",
              pg_get_indexdef(idx.oid, ord."seqInIndex", TRUE) AS "columnName",
              am.amname AS "indexType"
       FROM pg_class tbl
       JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
       JOIN pg_index ix ON ix.indrelid = tbl.oid
       JOIN pg_class idx ON idx.oid = ix.indexrelid
       JOIN pg_am am ON am.oid = idx.relam
       LEFT JOIN (
         SELECT generate_series(1, 64) AS "seqInIndex"
       ) ord
         ON ord."seqInIndex" <= COALESCE(array_length(string_to_array(ix.indkey::text, ' '), 1), 0)
       WHERE ns.nspname = $1
         AND tbl.relname = $2
       ORDER BY idx.relname ASC, ord."seqInIndex" ASC`,
          [parsed.schema, parsed.tableName]
        );
        return groupIndexes(rows);
      });
    }
    function groupConstraints(rows) {
      const grouped = /* @__PURE__ */ new Map();
      for (const row of rows) {
        if (!grouped.has(row.constraintName)) {
          grouped.set(row.constraintName, {
            constraintName: row.constraintName,
            constraintType: row.constraintType,
            columns: [],
            references: []
          });
        }
        const item = grouped.get(row.constraintName);
        if (row.columnName) {
          item.columns.push(row.columnName);
        }
        if (row.referencedTableName && row.referencedColumnName) {
          item.references.push({
            tableName: row.referencedTableName,
            columnName: row.referencedColumnName
          });
        }
      }
      return Array.from(grouped.values());
    }
    async function listConstraints(dataSource, tableName) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return [];
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        return getAdapter(sourceType).getConstraints(config, resolveAdapterScope(dataSource, sourceType), tableName);
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        const parsed = parseQualifiedTableName(dataSource, tableName);
        if (sourceType2 === "mysql") {
          const rows2 = await executeQuery(
            connection,
            sourceType2,
            `SELECT tc.constraint_name AS constraintName,
                tc.constraint_type AS constraintType,
                kcu.column_name AS columnName,
                kcu.referenced_table_name AS referencedTableName,
                kcu.referenced_column_name AS referencedColumnName,
                kcu.ordinal_position AS ordinalPosition
         FROM information_schema.table_constraints tc
         LEFT JOIN information_schema.key_column_usage kcu
           ON tc.constraint_schema = kcu.constraint_schema
          AND tc.table_name = kcu.table_name
          AND tc.constraint_name = kcu.constraint_name
         WHERE tc.table_schema = ? AND tc.table_name = ?
         ORDER BY tc.constraint_name ASC, kcu.ordinal_position ASC`,
            [parsed.database, parsed.tableName]
          );
          return groupConstraints(rows2);
        }
        const { database } = normalizeConnectionConfig(dataSource);
        const rows = await executeQuery(
          connection,
          sourceType2,
          `SELECT tc.constraint_name AS "constraintName",
              tc.constraint_type AS "constraintType",
              kcu.column_name AS "columnName",
              ccu.table_name AS "referencedTableName",
              ccu.column_name AS "referencedColumnName",
              kcu.ordinal_position AS "ordinalPosition"
       FROM information_schema.table_constraints tc
       LEFT JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
       LEFT JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
       WHERE tc.table_catalog = $1
         AND tc.table_schema = $2
         AND tc.table_name = $3
       ORDER BY tc.constraint_name ASC, kcu.ordinal_position ASC`,
          [database, parsed.schema, parsed.tableName]
        );
        return groupConstraints(rows);
      });
    }
    function sanitizeSampleRow(row) {
      return Object.fromEntries(
        Object.entries(row).map(([key, value]) => {
          if (value instanceof Date) {
            return [key, value.toISOString()];
          }
          if (Buffer.isBuffer(value)) {
            return [key, `[binary:${value.length}]`];
          }
          if (typeof value === "string") {
            return [key, value.length > 200 ? `${value.slice(0, 200)}...` : value];
          }
          return [key, value];
        })
      );
    }
    async function sampleRows(dataSource, tableName, limit = 100) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return sampleHiveRows(dataSource, tableName, limit);
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const adapter = getAdapter(sourceType);
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        const qualified = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
        const result = await adapter.executeQuery(config, `SELECT * FROM ${qualified}`, { resultLimit: limit });
        return (result.rows || []).map((row) => sanitizeSampleRow(row));
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        const safeLimit = Math.max(1, Math.min(100, Number(limit || 100)));
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType2);
        const rows = await executeQuery(connection, sourceType2, `SELECT * FROM ${qualifiedTable} LIMIT ${safeLimit}`);
        return rows.map((row) => sanitizeSampleRow(row));
      });
    }
    function addQueryParam(params, value, sourceType) {
      params.push(value);
      if (isPostgreSqlSource(sourceType)) return `$${params.length}`;
      if (normalizeSourceType(sourceType) === "oracle") return `:${params.length}`;
      return "?";
    }
    function buildSearchWhere(conditionGroups = [], sourceType, params, matchMode = "all") {
      const clauses = [];
      for (const group of conditionGroups) {
        const columns = Array.isArray(group.columns) ? group.columns.map((item) => String(item || "").trim()).filter(Boolean) : [];
        const values = Array.isArray(group.values) ? group.values.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
        if (!columns.length || !values.length) continue;
        const placeholdersByColumn = columns.map((columnName) => {
          const columnSql = escapeIdentifier(columnName, sourceType);
          const placeholders = values.map((value) => addQueryParam(params, value, sourceType)).join(", ");
          return `${columnSql} IN (${placeholders})`;
        });
        clauses.push(`(${placeholdersByColumn.join(" OR ")})`);
      }
      return clauses.join(matchMode === "any" ? " OR " : " AND ");
    }
    async function searchRows(dataSource, tableName, conditionGroups = [], options = {}) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        throw new AppError("\u5F53\u524D\u4E1A\u52A1\u6570\u636E\u68C0\u7D22\u6682\u4E0D\u652F\u6301 Hive \u6570\u636E\u6E90", 400);
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
        const countParams = [];
        const countWhere = buildSearchWhere(conditionGroups, sourceType, countParams, options.matchMode || "all");
        if (!countWhere) throw new AppError("\u4E1A\u52A1\u6570\u636E\u68C0\u7D22\u7F3A\u5C11\u6709\u6548\u5B57\u6BB5\u6761\u4EF6", 400);
        const adapter = getAdapter(sourceType);
        const countResult = await adapter.executeQuery(config, `SELECT COUNT(*) AS total FROM ${qualifiedTable} WHERE ${countWhere}`, { binds: countParams });
        const hitCount = Number(countResult.rows?.[0]?.total || countResult.rows?.[0]?.TOTAL || 0);
        if (!hitCount) return { hitCount: 0, rows: [] };
        const rowParams = [];
        const rowWhere = buildSearchWhere(conditionGroups, sourceType, rowParams, options.matchMode || "all");
        const rowResult = await adapter.executeQuery(config, `SELECT * FROM ${qualifiedTable} WHERE ${rowWhere}`, { binds: rowParams, resultLimit: options.limit || 20 });
        return { hitCount, rows: (rowResult.rows || []).map((row) => sanitizeSampleRow(row)) };
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        const safeLimit = Math.max(1, Math.min(100, Number(options.limit || 20)));
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType2);
        const countParams = [];
        const countWhere = buildSearchWhere(conditionGroups, sourceType2, countParams, options.matchMode || "all");
        if (!countWhere) {
          throw new AppError("\u4E1A\u52A1\u6570\u636E\u68C0\u7D22\u7F3A\u5C11\u6709\u6548\u5B57\u6BB5\u6761\u4EF6", 400);
        }
        const countRows2 = await executeQuery(
          connection,
          sourceType2,
          `SELECT COUNT(*) AS total FROM ${qualifiedTable} WHERE ${countWhere}`,
          countParams
        );
        const hitCount = Number(countRows2[0]?.total || countRows2[0]?.TOTAL || 0);
        if (hitCount === 0) {
          return { hitCount: 0, rows: [] };
        }
        const rowParams = [];
        const rowWhere = buildSearchWhere(conditionGroups, sourceType2, rowParams, options.matchMode || "all");
        const rows = await executeQuery(
          connection,
          sourceType2,
          `SELECT * FROM ${qualifiedTable} WHERE ${rowWhere} LIMIT ${safeLimit}`,
          rowParams
        );
        return {
          hitCount,
          rows: rows.map((row) => sanitizeSampleRow(row))
        };
      });
    }
    function findTableInfo(tables = [], dataSource, tableName) {
      const parsed = parseQualifiedTableName(dataSource, tableName);
      return tables.find((item) => item.tableName === parsed.tableName) || null;
    }
    async function inspectTableProfile(dataSource, tableName, options = {}) {
      const [columns, indexes, constraints, samples] = await Promise.all([
        listColumns(dataSource, tableName),
        listIndexes(dataSource, tableName),
        listConstraints(dataSource, tableName),
        sampleRows(dataSource, tableName, options.sampleSize || 100)
      ]);
      const table = options.tableInfo || null;
      return {
        tableName,
        tableComment: table?.tableComment || "",
        columns,
        indexes,
        constraints,
        sampleRows: samples
      };
    }
    async function inspectTableForRecommendation(dataSource, tableName) {
      const tables = await listTables(dataSource);
      return inspectTableProfile(dataSource, tableName, {
        sampleSize: 100,
        tableInfo: findTableInfo(tables, dataSource, tableName)
      });
    }
    async function countTableRows(connection, dataSource, tableName) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
      const rows = await executeQuery(connection, sourceType, `SELECT COUNT(*) AS total FROM ${qualifiedTable}`);
      return Number(rows[0]?.total || rows[0]?.TOTAL || 0);
    }
    async function countRows(dataSource, tableName) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return null;
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
        const result = await getAdapter(sourceType).executeQuery(config, `SELECT COUNT(*) AS total FROM ${qualifiedTable}`);
        return Number(result.rows?.[0]?.total || result.rows?.[0]?.TOTAL || 0);
      }
      return withConnection(dataSource, async (connection) => countTableRows(connection, dataSource, tableName));
    }
    function buildAdapterEstimateQuery(sourceType, config, parsed) {
      if (sourceType === "mysql") {
        return {
          sql: "SELECT table_rows AS estimatedRows FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1",
          binds: [parsed.database, parsed.tableName]
        };
      }
      if (sourceType === "postgresql") {
        return {
          sql: `SELECT CASE WHEN cls.reltuples < 0 THEN NULL ELSE cls.reltuples END AS "estimatedRows"
               FROM pg_class cls
               JOIN pg_namespace ns ON ns.oid = cls.relnamespace
              WHERE ns.nspname = $1 AND cls.relname = $2
              LIMIT 1`,
          binds: [parsed.schema, parsed.tableName]
        };
      }
      const owner = String(parsed.schema || config.schema || config.username || "").toUpperCase();
      const table = String(parsed.tableName || "").toUpperCase();
      const placeholders = sourceType === "oracle" ? [":1", ":2"] : ["?", "?"];
      return {
        sql: `SELECT num_rows AS estimatedRows FROM all_tables WHERE owner = ${placeholders[0]} AND table_name = ${placeholders[1]}`,
        binds: [owner, table]
      };
    }
    async function estimateRows(dataSource, tableName) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return null;
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        const parsed = parseQualifiedTableName(dataSource, tableName);
        const { sql, binds } = buildAdapterEstimateQuery(sourceType, config, parsed);
        const result = await getAdapter(sourceType).executeQuery(config, sql, { binds });
        const value = result.rows?.[0]?.estimatedRows ?? result.rows?.[0]?.ESTIMATEDROWS ?? result.rows?.[0]?.ESTIMATED_ROWS;
        return value === null || value === void 0 ? null : Math.round(Number(value));
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        const parsed = parseQualifiedTableName(dataSource, tableName);
        if (sourceType2 === "mysql") {
          const rows2 = await executeQuery(
            connection,
            sourceType2,
            `SELECT table_rows AS estimatedRows
         FROM information_schema.tables
         WHERE table_schema = ? AND table_name = ?
         LIMIT 1`,
            [parsed.database, parsed.tableName]
          );
          return rows2[0]?.estimatedRows === null || rows2[0]?.estimatedRows === void 0 ? null : Number(rows2[0].estimatedRows);
        }
        const rows = await executeQuery(
          connection,
          sourceType2,
          `SELECT CASE WHEN cls.reltuples < 0 THEN NULL ELSE cls.reltuples END AS "estimatedRows"
       FROM pg_class cls
       JOIN pg_namespace ns ON ns.oid = cls.relnamespace
       WHERE ns.nspname = $1 AND cls.relname = $2
       LIMIT 1`,
          [parsed.schema, parsed.tableName]
        );
        return rows[0]?.estimatedRows === null || rows[0]?.estimatedRows === void 0 ? null : Math.round(Number(rows[0].estimatedRows));
      });
    }
    async function countNullRows(connection, dataSource, tableName, columnName) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
      const qualifiedColumn = escapeIdentifier(columnName, sourceType);
      const rows = await executeQuery(
        connection,
        sourceType,
        `SELECT COUNT(*) AS total
     FROM ${qualifiedTable}
     WHERE ${qualifiedColumn} IS NULL`
      );
      return Number(rows[0]?.total || rows[0]?.TOTAL || 0);
    }
    async function countLengthOverflowRows(connection, dataSource, tableName, columnName, maxLength) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
      const qualifiedColumn = escapeIdentifier(columnName, sourceType);
      const rows = await executeQuery(
        connection,
        sourceType,
        `SELECT COUNT(*) AS total
     FROM ${qualifiedTable}
     WHERE ${qualifiedColumn} IS NOT NULL
       AND CHAR_LENGTH(${qualifiedColumn}) > ${Number(maxLength)}`
      );
      return Number(rows[0]?.total || rows[0]?.TOTAL || 0);
    }
    async function findDuplicatePrimaryKeyGroups(connection, dataSource, tableName, primaryKeyColumns) {
      if (!primaryKeyColumns.length) {
        return 0;
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
      const keySql = primaryKeyColumns.map((columnName) => escapeIdentifier(columnName, sourceType)).join(", ");
      const whereSql = primaryKeyColumns.map((columnName) => `${escapeIdentifier(columnName, sourceType)} IS NOT NULL`).join(" AND ");
      const rows = await executeQuery(
        connection,
        sourceType,
        `SELECT COUNT(*) AS total
     FROM (
       SELECT ${keySql}
       FROM ${qualifiedTable}
       WHERE ${whereSql}
       GROUP BY ${keySql}
       HAVING COUNT(*) > 1
     ) duplicates`
      );
      return Number(rows[0]?.total || rows[0]?.TOTAL || 0);
    }
    async function precheckSyncPlan(connection, dataSource, tableName, existingColumns, expectedColumns, plan) {
      const tableRowCount = await countTableRows(connection, dataSource, tableName);
      const existingColumnMap = new Map(existingColumns.map((column) => [column.columnName, column]));
      const lengthSensitiveTypes = ["varchar", "char", "character varying", "character"];
      for (const column of plan.additions) {
        const hasDefaultValue = normalizeDefaultValueForCompare(column.columnDefault) !== null;
        if (!column.isNullable && !hasDefaultValue && tableRowCount > 0) {
          throw new AppError(
            `\u76EE\u6807\u8868 ${tableName} \u5DF2\u6709 ${tableRowCount} \u6761\u6570\u636E\uFF0C\u65B0\u589E\u5FC5\u586B\u5B57\u6BB5 ${column.columnName} \u65F6\u5FC5\u987B\u5148\u63D0\u4F9B\u9ED8\u8BA4\u503C\u6216\u5141\u8BB8\u4E3A\u7A7A`,
            400,
            { field: column.columnName, reason: "required_column_without_default" }
          );
        }
      }
      for (const column of plan.modifications) {
        const existingColumn = existingColumnMap.get(column.columnName);
        if (!existingColumn) {
          continue;
        }
        if (existingColumn.isNullable && !column.isNullable) {
          const nullCount = await countNullRows(connection, dataSource, tableName, column.columnName);
          if (nullCount > 0) {
            throw new AppError(
              `\u76EE\u6807\u5B57\u6BB5 ${column.columnName} \u73B0\u6709 ${nullCount} \u6761\u7A7A\u503C\u6570\u636E\uFF0C\u65E0\u6CD5\u6539\u4E3A NOT NULL\uFF0C\u8BF7\u5148\u6E05\u6D17\u6570\u636E`,
              400,
              { field: column.columnName, reason: "null_values_exist", count: nullCount }
            );
          }
        }
        const existingType = parseColumnTypeDefinition(existingColumn.columnType);
        const expectedType = parseColumnTypeDefinition(column.columnType);
        if (lengthSensitiveTypes.includes(existingType.baseType) && lengthSensitiveTypes.includes(expectedType.baseType)) {
          const existingLength = Number(existingType.args[0] || 0);
          const expectedLength = Number(expectedType.args[0] || 0);
          if (existingLength > 0 && expectedLength > 0 && expectedLength < existingLength) {
            const overflowCount = await countLengthOverflowRows(connection, dataSource, tableName, column.columnName, expectedLength);
            if (overflowCount > 0) {
              throw new AppError(
                `\u76EE\u6807\u5B57\u6BB5 ${column.columnName} \u6709 ${overflowCount} \u6761\u6570\u636E\u957F\u5EA6\u8D85\u8FC7 ${expectedLength}\uFF0C\u65E0\u6CD5\u6536\u7F29\u5B57\u6BB5\u957F\u5EA6`,
                400,
                { field: column.columnName, reason: "value_too_long", count: overflowCount, maxLength: expectedLength }
              );
            }
          }
        }
      }
      if (plan.primaryKeyChanged) {
        const expectedPrimaryKeys = getPrimaryKeyColumns(expectedColumns);
        for (const columnName of expectedPrimaryKeys) {
          const nullCount = await countNullRows(connection, dataSource, tableName, columnName);
          if (nullCount > 0) {
            throw new AppError(
              `\u76EE\u6807\u4E3B\u952E\u5B57\u6BB5 ${columnName} \u5B58\u5728 ${nullCount} \u6761\u7A7A\u503C\u6570\u636E\uFF0C\u65E0\u6CD5\u8BBE\u7F6E\u4E3B\u952E`,
              400,
              { field: columnName, reason: "primary_key_null_values", count: nullCount }
            );
          }
        }
        const duplicateGroups = await findDuplicatePrimaryKeyGroups(connection, dataSource, tableName, expectedPrimaryKeys);
        if (duplicateGroups > 0) {
          throw new AppError(
            `\u76EE\u6807\u8868 ${tableName} \u5728\u65B0\u4E3B\u952E\u7EC4\u5408\u4E0A\u5B58\u5728 ${duplicateGroups} \u7EC4\u91CD\u590D\u6570\u636E\uFF0C\u65E0\u6CD5\u8BBE\u7F6E\u4E3B\u952E`,
            400,
            { fields: expectedPrimaryKeys, reason: "primary_key_duplicates", count: duplicateGroups }
          );
        }
      }
    }
    async function createTableFromColumns(dataSource, tableName, columns, options = {}) {
      if (!Array.isArray(columns) || columns.length === 0) {
        throw new AppError("\u65E0\u6CD5\u521B\u5EFA\u76EE\u6807\u8868\uFF0C\u6765\u6E90\u8868\u7F3A\u5C11\u5B57\u6BB5\u5B9A\u4E49", 400);
      }
      return withConnection(dataSource, async (connection, sourceType) => {
        await executeQuery(connection, sourceType, buildCreateTableSql(dataSource, tableName, columns, options));
        await applyTableAndColumnComments(connection, dataSource, tableName, columns, options);
        return { tableName, created: true };
      });
    }
    async function getExistingColumns(connection, dataSource, tableName) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (sourceType === "mysql") {
        const parsed = parseQualifiedTableName(dataSource, tableName);
        const rows = await executeQuery(
          connection,
          sourceType,
          `SELECT column_name AS columnName,
              ordinal_position AS ordinalPosition,
              data_type AS dataType,
              column_type AS columnType,
              is_nullable AS isNullable,
              column_default AS columnDefault,
              column_key AS columnKey,
              extra AS extra,
              column_comment AS columnComment
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ?
       ORDER BY ordinal_position ASC`,
          [parsed.database, parsed.tableName]
        );
        return rows.map((row) => ({
          ...row,
          isNullable: row.isNullable === "YES",
          isPrimaryKey: row.columnKey === "PRI"
        }));
      }
      return listColumns(dataSource, tableName);
    }
    async function syncTableColumnsMySql(connection, dataSource, tableName, columns, options = {}) {
      const existingColumns = await getExistingColumns(connection, dataSource, tableName);
      const plan = getColumnSyncPlan(existingColumns, columns, "mysql");
      const changes = [];
      await precheckSyncPlan(connection, dataSource, tableName, existingColumns, columns, plan);
      try {
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), "mysql");
        for (const column of plan.additions) {
          await executeQuery(connection, "mysql", `ALTER TABLE ${qualifiedTable} ADD COLUMN ${buildColumnDefinitionSql("mysql", column)}`);
          changes.push(`add:${column.columnName}`);
        }
        for (const column of plan.modifications) {
          await executeQuery(connection, "mysql", `ALTER TABLE ${qualifiedTable} MODIFY COLUMN ${buildColumnDefinitionSql("mysql", column)}`);
          changes.push(`modify:${column.columnName}`);
        }
        if (plan.primaryKeyChanged) {
          const existingPrimaryKeys = getPrimaryKeyColumns(existingColumns);
          const expectedPrimaryKeys = getPrimaryKeyColumns(columns);
          if (existingPrimaryKeys.length > 0) {
            await executeQuery(connection, "mysql", `ALTER TABLE ${qualifiedTable} DROP PRIMARY KEY`);
            changes.push("drop_primary_key");
          }
          if (expectedPrimaryKeys.length > 0) {
            await executeQuery(
              connection,
              "mysql",
              `ALTER TABLE ${qualifiedTable} ADD PRIMARY KEY (${expectedPrimaryKeys.map((columnName) => escapeIdentifier(columnName, "mysql")).join(", ")})`
            );
            changes.push(`add_primary_key:${expectedPrimaryKeys.join(",")}`);
          }
        }
      } catch (error) {
        throw buildFriendlyAlterError(error, tableName);
      }
      await applyTableAndColumnComments(connection, dataSource, tableName, columns, options);
      return { tableName, synced: changes.length > 0, changes };
    }
    async function getPostgreSqlPrimaryKeyConstraintName(connection, dataSource, tableName) {
      const parsed = parseQualifiedTableName(dataSource, tableName);
      const rows = await executeQuery(
        connection,
        POSTGRESQL,
        `SELECT tc.constraint_name AS "constraintName"
     FROM information_schema.table_constraints tc
     WHERE tc.table_schema = $1
       AND tc.table_name = $2
       AND tc.constraint_type = 'PRIMARY KEY'
     LIMIT 1`,
        [parsed.schema, parsed.tableName]
      );
      return rows[0]?.constraintName || null;
    }
    function buildPostgreSqlColumnAlterationStatements(tableName, existingColumn, expectedColumn) {
      const qualifiedTable = escapeIdentifier(tableName, POSTGRESQL);
      const qualifiedColumn = escapeIdentifier(expectedColumn.columnName, POSTGRESQL);
      const statements = [];
      if (!arePostgreSqlColumnTypesEquivalent(existingColumn.columnType, expectedColumn.columnType)) {
        const usingExpression = buildPostgreSqlUsingExpression(
          expectedColumn.columnName,
          existingColumn.columnType,
          expectedColumn.columnType
        );
        statements.push(
          `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} TYPE ${expectedColumn.columnType}${usingExpression ? ` USING ${usingExpression}` : ""}`
        );
      }
      if (Boolean(existingColumn.isNullable) !== Boolean(expectedColumn.isNullable)) {
        statements.push(
          expectedColumn.isNullable ? `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} DROP NOT NULL` : `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} SET NOT NULL`
        );
      }
      if (normalizeDefaultValueForCompare(existingColumn.columnDefault) !== normalizeDefaultValueForCompare(expectedColumn.columnDefault)) {
        const formattedDefault = formatDefaultValue(POSTGRESQL, expectedColumn.columnDefault);
        statements.push(
          formattedDefault === null ? `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} DROP DEFAULT` : `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} SET DEFAULT ${formattedDefault}`
        );
      }
      return statements;
    }
    async function applyPostgreSqlColumnAlterations(connection, dataSource, tableName, existingColumn, column) {
      const statements = buildPostgreSqlColumnAlterationStatements(
        buildQualifiedTableName(dataSource, tableName),
        existingColumn,
        column
      );
      for (const sql of statements) {
        await executeQuery(connection, POSTGRESQL, sql);
      }
    }
    async function syncTableColumnsPostgreSql(connection, dataSource, tableName, columns, options = {}) {
      const existingColumns = await getExistingColumns(connection, dataSource, tableName);
      const plan = getColumnSyncPlan(existingColumns, columns, POSTGRESQL);
      const changes = [];
      await precheckSyncPlan(connection, dataSource, tableName, existingColumns, columns, plan);
      try {
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), POSTGRESQL);
        for (const column of plan.additions) {
          await executeQuery(connection, POSTGRESQL, `ALTER TABLE ${qualifiedTable} ADD COLUMN ${buildColumnDefinitionSql(POSTGRESQL, column)}`);
          changes.push(`add:${column.columnName}`);
        }
        const existingColumnMap = new Map(existingColumns.map((column) => [column.columnName, column]));
        for (const column of plan.modifications) {
          await applyPostgreSqlColumnAlterations(
            connection,
            dataSource,
            tableName,
            existingColumnMap.get(column.columnName),
            column
          );
          changes.push(`modify:${column.columnName}`);
        }
        if (plan.primaryKeyChanged) {
          const existingConstraintName = await getPostgreSqlPrimaryKeyConstraintName(connection, dataSource, tableName);
          const expectedPrimaryKeys = getPrimaryKeyColumns(columns);
          if (existingConstraintName) {
            await executeQuery(
              connection,
              POSTGRESQL,
              `ALTER TABLE ${qualifiedTable} DROP CONSTRAINT ${escapeIdentifier(existingConstraintName, POSTGRESQL)}`
            );
            changes.push("drop_primary_key");
          }
          if (expectedPrimaryKeys.length > 0) {
            await executeQuery(
              connection,
              POSTGRESQL,
              `ALTER TABLE ${qualifiedTable} ADD PRIMARY KEY (${expectedPrimaryKeys.map((columnName) => escapeIdentifier(columnName, POSTGRESQL)).join(", ")})`
            );
            changes.push(`add_primary_key:${expectedPrimaryKeys.join(",")}`);
          }
        }
      } catch (error) {
        throw buildFriendlyAlterError(error, tableName);
      }
      await applyTableAndColumnComments(connection, dataSource, tableName, columns, options);
      return { tableName, synced: changes.length > 0, changes };
    }
    async function syncTableColumns(dataSource, tableName, columns, options = {}) {
      if (!Array.isArray(columns) || columns.length === 0) {
        throw new AppError("\u65E0\u6CD5\u540C\u6B65\u76EE\u6807\u8868\uFF0C\u5B57\u6BB5\u5B9A\u4E49\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      return withConnection(dataSource, async (connection, sourceType) => {
        if (sourceType === "mysql") {
          return syncTableColumnsMySql(connection, dataSource, tableName, columns, options);
        }
        return syncTableColumnsPostgreSql(connection, dataSource, tableName, columns, options);
      });
    }
    async function ensureTableMatchesColumns(dataSource, tableName, columns, options = {}) {
      if (!Array.isArray(columns) || columns.length === 0) {
        throw new AppError("\u65E0\u6CD5\u6821\u9A8C\u76EE\u6807\u8868\uFF0C\u5B57\u6BB5\u5B9A\u4E49\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      const tables = await listTables(dataSource);
      const parsed = parseQualifiedTableName(dataSource, tableName);
      const tableExists = tables.some((table) => table.tableName === parsed.tableName);
      if (!tableExists) {
        await createTableFromColumns(dataSource, tableName, columns, options);
        return { tableName, action: "created", reason: "table_not_exists" };
      }
      const existingColumns = await listColumns(dataSource, tableName);
      const plan = getColumnSyncPlan(existingColumns, columns, normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig));
      if (plan.additions.length === 0 && plan.modifications.length === 0 && !plan.primaryKeyChanged) {
        await withConnection(dataSource, async (connection, sourceType) => {
          await applyTableAndColumnComments(connection, dataSource, tableName, columns, options);
        });
        return { tableName, action: "unchanged", reason: null };
      }
      const result = await syncTableColumns(dataSource, tableName, columns, options);
      return {
        tableName,
        action: "synced",
        reason: "schema_mismatch",
        changes: result.changes
      };
    }
    async function getColumnMaximum(dataSource, tableName, columnName) {
      return withConnection(dataSource, async (connection, sourceType) => {
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
        const qualifiedColumn = escapeIdentifier(columnName, sourceType);
        const rows = await executeQuery(
          connection,
          sourceType,
          `SELECT MAX(${qualifiedColumn}) AS max_value FROM ${qualifiedTable}`
        );
        return rows[0] ? rows[0].max_value : null;
      });
    }
    module2.exports = {
      listTables,
      listColumns,
      listIndexes,
      listConstraints,
      sampleRows,
      searchRows,
      countRows,
      estimateRows,
      inspectTableProfile,
      inspectTableForRecommendation,
      createTableFromColumns,
      syncTableColumns,
      ensureTableMatchesColumns,
      getColumnMaximum,
      escapeValue,
      escapeIdentifier,
      __test: {
        buildAdapterEstimateQuery,
        buildColumnDefinitionSql,
        formatDefaultValue,
        normalizePostgreSqlColumnDefault,
        normalizeDefaultValueForCompare,
        arePostgreSqlColumnTypesEquivalent,
        buildPostgreSqlColumnAlterationStatements
      }
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

// backend/src/modules/data-services/data-service.repository.js
var require_data_service_repository = __commonJS({
  "backend/src/modules/data-services/data-service.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var { getCurrentProjectId } = require_project_context();
    function getScopedWhere(alias) {
      const projectId = getCurrentProjectId();
      if (!projectId) {
        return { sql: "", params: [], projectId: null };
      }
      const prefix = alias ? `${alias}.` : "";
      return { sql: `${prefix}project_id = ?`, params: [projectId], projectId };
    }
    function appendScopedWhere(conditions, params, alias) {
      const scoped = getScopedWhere(alias);
      if (scoped.sql) {
        conditions.push(scoped.sql);
        params.push(...scoped.params);
      }
      return scoped.projectId;
    }
    function parseJsonField(value, fallback) {
      if (value === null || value === void 0 || value === "") {
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
    function mapServiceRow(row) {
      return {
        id: Number(row.id),
        projectId: row.projectId === null || row.projectId === void 0 ? null : Number(row.projectId),
        serviceName: row.serviceName,
        serviceCode: row.serviceCode,
        servicePath: row.servicePath,
        requestMethod: row.requestMethod,
        dataDomain: row.dataDomain,
        sourceId: row.sourceId === null || row.sourceId === void 0 ? null : Number(row.sourceId),
        sourceName: row.sourceName || null,
        sourceType: row.sourceType || null,
        serviceMode: row.serviceMode || "table",
        sourceTable: row.sourceTable || null,
        sourceSql: row.sourceSql || null,
        serviceType: row.serviceType || "list",
        authType: row.authType || "token",
        status: row.status || "draft",
        description: row.description || null,
        queryConfig: parseJsonField(row.queryConfig, { filters: [], pagination: true }),
        responseConfig: parseJsonField(row.responseConfig, { fields: [] }),
        ownerName: row.ownerName || "system",
        publishedAt: row.publishedAt || null,
        lastCalledAt: row.lastCalledAt || null,
        totalCalls: Number(row.totalCalls || 0),
        successCalls: Number(row.successCalls || 0),
        failedCalls: Number(row.failedCalls || 0),
        avgLatencyMs: Number(row.avgLatencyMs || 0),
        authorizationCount: Number(row.authorizationCount || 0),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapServiceDataSourceRow(row) {
      return {
        id: Number(row.id),
        projectId: row.projectId === null || row.projectId === void 0 ? null : Number(row.projectId),
        sourceName: row.sourceName,
        sourceCode: row.sourceCode,
        sourceType: row.sourceType,
        connectionConfig: parseJsonField(row.connectionConfig, {}),
        ownerName: row.ownerName || "system",
        status: row.status || "active",
        serviceCount: Number(row.serviceCount || 0),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapAppRow(row) {
      return {
        id: Number(row.id),
        projectId: row.projectId === null || row.projectId === void 0 ? null : Number(row.projectId),
        departmentName: row.departmentName || null,
        appName: row.appName,
        appCode: row.appCode,
        appToken: row.appToken,
        contactPhone: row.contactPhone || null,
        appDescription: row.appDescription || null,
        ownerName: row.ownerName || "system",
        status: row.status || "active",
        authorizationCount: Number(row.authorizationCount || 0),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapAuthorizationRow(row) {
      return {
        id: Number(row.id),
        projectId: row.projectId === null || row.projectId === void 0 ? null : Number(row.projectId),
        serviceId: Number(row.serviceId),
        serviceName: row.serviceName,
        serviceCode: row.serviceCode,
        appId: Number(row.appId),
        appName: row.appName,
        appCode: row.appCode,
        status: row.status || "active",
        rateLimitPerMinute: Number(row.rateLimitPerMinute || 0),
        dailyLimit: Number(row.dailyLimit || 0),
        ipWhitelist: parseJsonField(row.ipWhitelist, []),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapLogRow(row) {
      return {
        id: Number(row.id),
        projectId: row.projectId === null || row.projectId === void 0 ? null : Number(row.projectId),
        serviceId: Number(row.serviceId),
        appId: row.appId === null || row.appId === void 0 ? null : Number(row.appId),
        serviceName: row.serviceName || null,
        serviceCode: row.serviceCode,
        appName: row.appName || null,
        appCode: row.appCode || null,
        servicePath: row.servicePath,
        requestMethod: row.requestMethod,
        authType: row.authType,
        requestParams: parseJsonField(row.requestParams, {}),
        responseStatus: row.responseStatus,
        success: Boolean(row.success),
        httpStatus: Number(row.httpStatus || 0),
        latencyMs: Number(row.latencyMs || 0),
        clientIp: row.clientIp || null,
        errorMessage: row.errorMessage || null,
        calledAt: row.calledAt
      };
    }
    var SERVICE_COLUMNS_SQL = `sa.id,
       sa.project_id AS projectId,
       sa.service_name AS serviceName,
       sa.service_code AS serviceCode,
       sa.service_path AS servicePath,
       sa.request_method AS requestMethod,
       sa.data_domain AS dataDomain,
       sa.service_mode AS serviceMode,
       sa.source_id AS sourceId,
       ds.source_name AS sourceName,
       ds.source_type AS sourceType,
       sa.source_table AS sourceTable,
       sa.source_sql AS sourceSql,
       sa.service_type AS serviceType,
       sa.auth_type AS authType,
       sa.status,
       sa.description,
       sa.query_config_json AS queryConfig,
       sa.response_config_json AS responseConfig,
       sa.owner_name AS ownerName,
       sa.published_at AS publishedAt,
       sa.last_called_at AS lastCalledAt,
       sa.total_calls AS totalCalls,
       sa.success_calls AS successCalls,
       sa.failed_calls AS failedCalls,
       sa.avg_latency_ms AS avgLatencyMs,
       sa.created_at AS createdAt,
       sa.updated_at AS updatedAt`;
    async function getServiceById(id) {
      const scoped = getScopedWhere("sa");
      const [rows] = await pool.query(
        `SELECT ${SERVICE_COLUMNS_SQL}
     FROM service_apis sa
     LEFT JOIN service_data_sources ds ON ds.id = sa.source_id
     WHERE sa.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [id, ...scoped.params]
      );
      return rows[0] ? mapServiceRow(rows[0]) : null;
    }
    async function listServices() {
      const scoped = getScopedWhere("sa");
      const authScoped = getScopedWhere("");
      const params = [...authScoped.params, ...scoped.params];
      const [rows] = await pool.query(
        `SELECT ${SERVICE_COLUMNS_SQL},
            COALESCE(auth.authorizationCount, 0) AS authorizationCount
     FROM service_apis sa
     LEFT JOIN service_data_sources ds ON ds.id = sa.source_id
     LEFT JOIN (
       SELECT service_id, COUNT(*) AS authorizationCount
       FROM service_api_authorizations
       ${authScoped.sql ? `WHERE ${authScoped.sql}` : ""}
       GROUP BY service_id
     ) auth ON auth.service_id = sa.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY sa.updated_at DESC, sa.id DESC`,
        params
      );
      return rows.map((row) => mapServiceRow(row));
    }
    async function createService(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO service_apis (
       project_id, service_name, service_code, service_path, request_method, data_domain,
       service_mode, source_id, source_table, source_sql, service_type, auth_type, status, description,
       query_config_json, response_config_json, owner_name, published_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.serviceName,
          payload.serviceCode,
          payload.servicePath,
          payload.requestMethod,
          payload.dataDomain,
          payload.serviceMode || "table",
          payload.sourceId,
          payload.sourceTable,
          payload.sourceSql || null,
          payload.serviceType,
          payload.authType,
          payload.status,
          payload.description,
          JSON.stringify(payload.queryConfig || { filters: [], pagination: true }),
          JSON.stringify(payload.responseConfig || { fields: [] }),
          payload.ownerName,
          payload.publishedAt || null
        ]
      );
      return getServiceById(result.insertId);
    }
    async function updateService(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `UPDATE service_apis
     SET service_name = ?,
         service_code = ?,
         service_path = ?,
         request_method = ?,
         data_domain = ?,
         service_mode = ?,
         source_id = ?,
         source_table = ?,
         source_sql = ?,
         service_type = ?,
         auth_type = ?,
         status = ?,
         description = ?,
         query_config_json = ?,
         response_config_json = ?,
         owner_name = ?,
         published_at = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          payload.serviceName,
          payload.serviceCode,
          payload.servicePath,
          payload.requestMethod,
          payload.dataDomain,
          payload.serviceMode || "table",
          payload.sourceId,
          payload.sourceTable,
          payload.sourceSql || null,
          payload.serviceType,
          payload.authType,
          payload.status,
          payload.description,
          JSON.stringify(payload.queryConfig || { filters: [], pagination: true }),
          JSON.stringify(payload.responseConfig || { fields: [] }),
          payload.ownerName,
          payload.publishedAt || null,
          id,
          ...scoped.params
        ]
      );
      if (!result.affectedRows) {
        return null;
      }
      return getServiceById(id);
    }
    async function deleteService(id) {
      const scoped = getScopedWhere("");
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `DELETE FROM service_api_authorizations WHERE service_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
          [id, ...scoped.params]
        );
        await connection.query(
          `DELETE FROM service_api_call_logs WHERE service_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
          [id, ...scoped.params]
        );
        const [result] = await connection.query(
          `DELETE FROM service_apis WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
          [id, ...scoped.params]
        );
        await connection.commit();
        return result.affectedRows > 0;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function findPublishedServiceByPath(method, servicePath) {
      const [rows] = await pool.query(
        `SELECT ${SERVICE_COLUMNS_SQL}
     FROM service_apis sa
     LEFT JOIN service_data_sources ds ON ds.id = sa.source_id
     WHERE sa.request_method = ?
       AND sa.service_path = ?
       AND sa.status = 'published'
     LIMIT 1`,
        [method, servicePath]
      );
      return rows[0] ? mapServiceRow(rows[0]) : null;
    }
    async function listServiceDataSources() {
      const scoped = getScopedWhere("ds");
      const serviceScoped = getScopedWhere("");
      const params = [...serviceScoped.params, ...scoped.params];
      const [rows] = await pool.query(
        `SELECT ds.id,
            ds.project_id AS projectId,
            ds.source_name AS sourceName,
            ds.source_code AS sourceCode,
            ds.source_type AS sourceType,
            ds.connection_config AS connectionConfig,
            ds.owner_name AS ownerName,
            ds.status,
            COALESCE(serviceStats.serviceCount, 0) AS serviceCount,
            ds.created_at AS createdAt,
            ds.updated_at AS updatedAt
     FROM service_data_sources ds
     LEFT JOIN (
       SELECT source_id, COUNT(*) AS serviceCount
       FROM service_apis
       ${serviceScoped.sql ? `WHERE ${serviceScoped.sql}` : ""}
       GROUP BY source_id
     ) serviceStats ON serviceStats.source_id = ds.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY ds.updated_at DESC, ds.id DESC`,
        params
      );
      return rows.map((row) => mapServiceDataSourceRow(row));
    }
    async function getServiceDataSourceById(id) {
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(
        `SELECT id,
            project_id AS projectId,
            source_name AS sourceName,
            source_code AS sourceCode,
            source_type AS sourceType,
            connection_config AS connectionConfig,
            owner_name AS ownerName,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM service_data_sources
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [id, ...scoped.params]
      );
      return rows[0] ? mapServiceDataSourceRow(rows[0]) : null;
    }
    async function createServiceDataSource(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO service_data_sources
      (project_id, source_name, source_code, source_type, connection_config, owner_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.sourceName,
          payload.sourceCode,
          payload.sourceType,
          JSON.stringify(payload.connectionConfig || {}),
          payload.ownerName,
          payload.status
        ]
      );
      return getServiceDataSourceById(result.insertId);
    }
    async function updateServiceDataSource(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `UPDATE service_data_sources
     SET source_name = ?,
         source_code = ?,
         source_type = ?,
         connection_config = ?,
         owner_name = ?,
         status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          payload.sourceName,
          payload.sourceCode,
          payload.sourceType,
          JSON.stringify(payload.connectionConfig || {}),
          payload.ownerName,
          payload.status,
          id,
          ...scoped.params
        ]
      );
      if (!result.affectedRows) {
        return null;
      }
      return getServiceDataSourceById(id);
    }
    async function countServiceReferencesByDataSourceId(id) {
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS total
     FROM service_apis
     WHERE source_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return Number(rows[0]?.total || 0);
    }
    async function deleteServiceDataSource(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM service_data_sources WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    function mapServiceAiConfigRow(row) {
      return {
        id: Number(row.id),
        sceneName: row.sceneName,
        sceneCode: row.sceneCode,
        defaultModelProviderId: row.defaultModelProviderId == null ? null : Number(row.defaultModelProviderId),
        defaultModelProviderName: row.defaultModelProviderName || null,
        defaultModelName: row.defaultModelName || null,
        defaultModelVersion: row.defaultModelVersion || null,
        temperature: row.temperature == null ? null : Number(row.temperature),
        maxTokens: row.maxTokens == null ? null : Number(row.maxTokens),
        timeoutMs: row.timeoutMs == null ? null : Number(row.timeoutMs),
        systemPrompt: row.systemPrompt || "",
        description: row.description || null,
        ownerName: row.ownerName || "system",
        status: row.status || "active",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    async function listServiceAiConfigs() {
      const [rows] = await pool.query(
        `SELECT c.id,
            c.scene_name AS sceneName,
            c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName,
            c.default_model_version AS defaultModelVersion,
            c.temperature,
            c.max_tokens AS maxTokens,
            c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt,
            c.description,
            c.owner_name AS ownerName,
            c.status,
            c.created_at AS createdAt,
            c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM service_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     ORDER BY c.id DESC`
      );
      return rows.map(mapServiceAiConfigRow);
    }
    async function getServiceAiConfigById(id) {
      const [rows] = await pool.query(
        `SELECT c.id,
            c.scene_name AS sceneName,
            c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName,
            c.default_model_version AS defaultModelVersion,
            c.temperature,
            c.max_tokens AS maxTokens,
            c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt,
            c.description,
            c.owner_name AS ownerName,
            c.status,
            c.created_at AS createdAt,
            c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM service_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     WHERE c.id = ?
     LIMIT 1`,
        [id]
      );
      return rows[0] ? mapServiceAiConfigRow(rows[0]) : null;
    }
    async function getServiceAiConfigByCode(sceneCode) {
      const [rows] = await pool.query(
        `SELECT id,
            scene_name AS sceneName,
            scene_code AS sceneCode,
            default_model_provider_id AS defaultModelProviderId,
            default_model_name AS defaultModelName,
            default_model_version AS defaultModelVersion,
            temperature,
            max_tokens AS maxTokens,
            timeout_ms AS timeoutMs,
            system_prompt AS systemPrompt,
            description,
            owner_name AS ownerName,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM service_ai_configs
     WHERE scene_code = ?
     LIMIT 1`,
        [sceneCode]
      );
      return rows[0] ? mapServiceAiConfigRow(rows[0]) : null;
    }
    async function updateServiceAiConfig(id, payload) {
      const [result] = await pool.query(
        `UPDATE service_ai_configs
     SET scene_name = ?,
         scene_code = ?,
         default_model_provider_id = ?,
         default_model_name = ?,
         default_model_version = ?,
         temperature = ?,
         max_tokens = ?,
         timeout_ms = ?,
         system_prompt = ?,
         description = ?,
         owner_name = ?,
         status = ?
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
      if (!result.affectedRows) {
        return null;
      }
      return getServiceAiConfigById(id);
    }
    async function listServiceApps() {
      const scoped = getScopedWhere("app");
      const authScoped = getScopedWhere("");
      const params = [...authScoped.params, ...scoped.params];
      const [rows] = await pool.query(
        `SELECT app.id,
            app.project_id AS projectId,
            app.department_name AS departmentName,
            app.app_name AS appName,
            app.app_code AS appCode,
            app.app_token AS appToken,
            app.contact_phone AS contactPhone,
            app.app_description AS appDescription,
            app.owner_name AS ownerName,
            app.status,
            COALESCE(auth.authorizationCount, 0) AS authorizationCount,
            app.created_at AS createdAt,
            app.updated_at AS updatedAt
     FROM service_apps app
     LEFT JOIN (
       SELECT app_id, COUNT(*) AS authorizationCount
       FROM service_api_authorizations
       ${authScoped.sql ? `WHERE ${authScoped.sql}` : ""}
       GROUP BY app_id
     ) auth ON auth.app_id = app.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY app.updated_at DESC, app.id DESC`,
        params
      );
      return rows.map((row) => mapAppRow(row));
    }
    async function getServiceAppById(id) {
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(
        `SELECT id,
            project_id AS projectId,
            department_name AS departmentName,
            app_name AS appName,
            app_code AS appCode,
            app_token AS appToken,
            contact_phone AS contactPhone,
            app_description AS appDescription,
            owner_name AS ownerName,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM service_apps
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [id, ...scoped.params]
      );
      return rows[0] ? mapAppRow(rows[0]) : null;
    }
    async function createServiceApp(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO service_apps (project_id, department_name, app_name, app_code, app_token, contact_phone, app_description, owner_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.departmentName,
          payload.appName,
          payload.appCode,
          payload.appToken,
          payload.contactPhone,
          payload.appDescription,
          payload.ownerName,
          payload.status
        ]
      );
      return getServiceAppById(result.insertId);
    }
    async function updateServiceApp(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `UPDATE service_apps
     SET department_name = ?,
         app_name = ?,
         app_code = ?,
         app_token = ?,
         contact_phone = ?,
         app_description = ?,
         owner_name = ?,
         status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          payload.departmentName,
          payload.appName,
          payload.appCode,
          payload.appToken,
          payload.contactPhone,
          payload.appDescription,
          payload.ownerName,
          payload.status,
          id,
          ...scoped.params
        ]
      );
      if (!result.affectedRows) {
        return null;
      }
      return getServiceAppById(id);
    }
    async function deleteServiceApp(id) {
      const scoped = getScopedWhere("");
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `DELETE FROM service_api_authorizations WHERE app_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
          [id, ...scoped.params]
        );
        await connection.query(
          `UPDATE service_api_call_logs SET app_id = NULL WHERE app_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
          [id, ...scoped.params]
        );
        const [result] = await connection.query(
          `DELETE FROM service_apps WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
          [id, ...scoped.params]
        );
        await connection.commit();
        return result.affectedRows > 0;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function findServiceAppByToken(appToken) {
      const [rows] = await pool.query(
        `SELECT id,
            project_id AS projectId,
            department_name AS departmentName,
            app_name AS appName,
            app_code AS appCode,
            app_token AS appToken,
            contact_phone AS contactPhone,
            app_description AS appDescription,
            owner_name AS ownerName,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM service_apps
     WHERE app_token = ?
     LIMIT 1`,
        [appToken]
      );
      return rows[0] ? mapAppRow(rows[0]) : null;
    }
    async function listAuthorizations() {
      const scoped = getScopedWhere("saa");
      const [rows] = await pool.query(
        `SELECT saa.id,
            saa.project_id AS projectId,
            saa.service_id AS serviceId,
            sa.service_name AS serviceName,
            sa.service_code AS serviceCode,
            saa.app_id AS appId,
            app.app_name AS appName,
            app.app_code AS appCode,
            saa.status,
            saa.rate_limit_per_minute AS rateLimitPerMinute,
            saa.daily_limit AS dailyLimit,
            saa.ip_whitelist_json AS ipWhitelist,
            saa.created_at AS createdAt,
            saa.updated_at AS updatedAt
     FROM service_api_authorizations saa
     INNER JOIN service_apis sa ON sa.id = saa.service_id
     INNER JOIN service_apps app ON app.id = saa.app_id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY saa.updated_at DESC, saa.id DESC`,
        scoped.params
      );
      return rows.map((row) => mapAuthorizationRow(row));
    }
    async function getAuthorizationById(id) {
      const scoped = getScopedWhere("saa");
      const [rows] = await pool.query(
        `SELECT saa.id,
            saa.project_id AS projectId,
            saa.service_id AS serviceId,
            sa.service_name AS serviceName,
            sa.service_code AS serviceCode,
            saa.app_id AS appId,
            app.app_name AS appName,
            app.app_code AS appCode,
            saa.status,
            saa.rate_limit_per_minute AS rateLimitPerMinute,
            saa.daily_limit AS dailyLimit,
            saa.ip_whitelist_json AS ipWhitelist,
            saa.created_at AS createdAt,
            saa.updated_at AS updatedAt
     FROM service_api_authorizations saa
     INNER JOIN service_apis sa ON sa.id = saa.service_id
     INNER JOIN service_apps app ON app.id = saa.app_id
     WHERE saa.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [id, ...scoped.params]
      );
      return rows[0] ? mapAuthorizationRow(rows[0]) : null;
    }
    async function createAuthorization(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO service_api_authorizations (
       project_id, service_id, app_id, status, rate_limit_per_minute, daily_limit, ip_whitelist_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.serviceId,
          payload.appId,
          payload.status,
          payload.rateLimitPerMinute,
          payload.dailyLimit,
          JSON.stringify(payload.ipWhitelist || [])
        ]
      );
      return getAuthorizationById(result.insertId);
    }
    async function updateAuthorization(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `UPDATE service_api_authorizations
     SET service_id = ?,
         app_id = ?,
         status = ?,
         rate_limit_per_minute = ?,
         daily_limit = ?,
         ip_whitelist_json = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          payload.serviceId,
          payload.appId,
          payload.status,
          payload.rateLimitPerMinute,
          payload.dailyLimit,
          JSON.stringify(payload.ipWhitelist || []),
          id,
          ...scoped.params
        ]
      );
      if (!result.affectedRows) {
        return null;
      }
      return getAuthorizationById(id);
    }
    async function deleteAuthorization(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM service_api_authorizations WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    async function findAuthorization(serviceId, appId) {
      const scoped = getScopedWhere("saa");
      const [rows] = await pool.query(
        `SELECT saa.id,
            saa.project_id AS projectId,
            saa.service_id AS serviceId,
            sa.service_name AS serviceName,
            sa.service_code AS serviceCode,
            saa.app_id AS appId,
            app.app_name AS appName,
            app.app_code AS appCode,
            saa.status,
            saa.rate_limit_per_minute AS rateLimitPerMinute,
            saa.daily_limit AS dailyLimit,
            saa.ip_whitelist_json AS ipWhitelist,
            saa.created_at AS createdAt,
            saa.updated_at AS updatedAt
     FROM service_api_authorizations saa
     INNER JOIN service_apis sa ON sa.id = saa.service_id
     INNER JOIN service_apps app ON app.id = saa.app_id
     WHERE saa.service_id = ? AND saa.app_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [serviceId, appId, ...scoped.params]
      );
      return rows[0] ? mapAuthorizationRow(rows[0]) : null;
    }
    async function countCallsSince(serviceId, appId, startTime, endTime = null) {
      const params = [serviceId, appId, startTime];
      let sql = `SELECT COUNT(*) AS total
             FROM service_api_call_logs
             WHERE service_id = ?
               AND app_id = ?
               AND called_at >= ?`;
      if (endTime) {
        sql += " AND called_at < ?";
        params.push(endTime);
      }
      const [rows] = await pool.query(sql, params);
      return Number(rows[0]?.total || 0);
    }
    async function recordServiceCall(payload) {
      const connection = await pool.getConnection();
      const projectId = payload.projectId || getCurrentProjectId() || null;
      try {
        await connection.beginTransaction();
        await connection.query(
          `INSERT INTO service_api_call_logs (
         project_id, service_id, app_id, service_code, service_path, request_method, auth_type,
         request_params_json, response_status, success, http_status, latency_ms, client_ip, error_message
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            payload.serviceId,
            payload.appId,
            payload.serviceCode,
            payload.servicePath,
            payload.requestMethod,
            payload.authType,
            JSON.stringify(payload.requestParams || {}),
            payload.responseStatus,
            payload.success ? 1 : 0,
            payload.httpStatus,
            payload.latencyMs,
            payload.clientIp || null,
            payload.errorMessage || null
          ]
        );
        await connection.query(
          `UPDATE service_apis
       SET total_calls = total_calls + 1,
           success_calls = success_calls + ?,
           failed_calls = failed_calls + ?,
           avg_latency_ms = ROUND(((avg_latency_ms * total_calls) + ?) / (total_calls + 1), 2),
           last_called_at = NOW()
       WHERE id = ?`,
          [
            payload.success ? 1 : 0,
            payload.success ? 0 : 1,
            payload.latencyMs,
            payload.serviceId
          ]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function listServiceLogs(options = {}) {
      const limit = Math.max(1, Math.min(1e3, Number(options.limit || 50) || 50));
      const conditions = [];
      const params = [];
      appendScopedWhere(conditions, params, "log");
      if (options.serviceId) {
        conditions.push("log.service_id = ?");
        params.push(options.serviceId);
      }
      if (options.appId) {
        conditions.push("log.app_id = ?");
        params.push(options.appId);
      }
      if (options.departmentName) {
        conditions.push("app.department_name = ?");
        params.push(options.departmentName);
      }
      if (options.startAt) {
        conditions.push("log.called_at >= ?");
        params.push(options.startAt);
      }
      if (options.endAt) {
        conditions.push("log.called_at <= ?");
        params.push(options.endAt);
      }
      if (options.paramsKeyword) {
        conditions.push("log.request_params_json LIKE ?");
        params.push(`%${options.paramsKeyword}%`);
      }
      const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const [rows] = await pool.query(
        `SELECT log.id,
            log.project_id AS projectId,
            log.service_id AS serviceId,
            log.app_id AS appId,
            sa.service_name AS serviceName,
            log.service_code AS serviceCode,
            app.app_name AS appName,
            app.app_code AS appCode,
            log.service_path AS servicePath,
            log.request_method AS requestMethod,
            log.auth_type AS authType,
            log.request_params_json AS requestParams,
            log.response_status AS responseStatus,
            log.success,
            log.http_status AS httpStatus,
            log.latency_ms AS latencyMs,
            log.client_ip AS clientIp,
            log.error_message AS errorMessage,
            log.called_at AS calledAt
     FROM service_api_call_logs log
     INNER JOIN service_apis sa ON sa.id = log.service_id
     LEFT JOIN service_apps app ON app.id = log.app_id
     ${whereSql}
     ORDER BY log.called_at DESC, log.id DESC
     LIMIT ${limit}`,
        params
      );
      return rows.map((row) => mapLogRow(row));
    }
    async function getOverview() {
      const projectId = getCurrentProjectId();
      const scopedWhere = projectId ? "WHERE project_id = ?" : "";
      const todayWhere = projectId ? "WHERE project_id = ? AND called_at >= CURRENT_DATE()" : "WHERE called_at >= CURRENT_DATE()";
      const logTodayWhere = projectId ? "log.project_id = ? AND log.called_at >= CURRENT_DATE()" : "log.called_at >= CURRENT_DATE()";
      const errorWhere = projectId ? "log.project_id = ? AND log.success = 0" : "log.success = 0";
      const [[serviceSummary]] = await pool.query(
        `SELECT COUNT(*) AS totalServices,
            SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS publishedServices
     FROM service_apis ${scopedWhere}`,
        projectId ? [projectId] : []
      );
      const [[appSummary]] = await pool.query(
        `SELECT COUNT(*) AS totalApps FROM service_apps ${scopedWhere}`,
        projectId ? [projectId] : []
      );
      const [[callSummary]] = await pool.query(
        `SELECT COUNT(*) AS totalCallsToday,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successCallsToday,
            AVG(latency_ms) AS avgLatencyMsToday
     FROM service_api_call_logs
     ${todayWhere}`,
        projectId ? [projectId] : []
      );
      const [topServices] = await pool.query(
        `SELECT sa.id AS serviceId,
            sa.service_name AS serviceName,
            sa.service_code AS serviceCode,
            COUNT(*) AS callCount
     FROM service_api_call_logs log
     INNER JOIN service_apis sa ON sa.id = log.service_id
     WHERE ${logTodayWhere}
     GROUP BY sa.id
     ORDER BY callCount DESC, sa.id DESC
     LIMIT 5`,
        projectId ? [projectId] : []
      );
      const [topApps] = await pool.query(
        `SELECT app.id AS appId,
            app.app_name AS appName,
            app.app_code AS appCode,
            COUNT(*) AS callCount
     FROM service_api_call_logs log
     INNER JOIN service_apps app ON app.id = log.app_id
     WHERE ${logTodayWhere}
     GROUP BY app.id
     ORDER BY callCount DESC, app.id DESC
     LIMIT 5`,
        projectId ? [projectId] : []
      );
      const [recentErrors] = await pool.query(
        `SELECT log.id,
            log.service_id AS serviceId,
            sa.service_name AS serviceName,
            log.service_code AS serviceCode,
            app.app_name AS appName,
            log.error_message AS errorMessage,
            log.http_status AS httpStatus,
            log.called_at AS calledAt
     FROM service_api_call_logs log
     INNER JOIN service_apis sa ON sa.id = log.service_id
     LEFT JOIN service_apps app ON app.id = log.app_id
     WHERE ${errorWhere}
     ORDER BY log.called_at DESC, log.id DESC
     LIMIT 10`,
        projectId ? [projectId] : []
      );
      return {
        totalServices: Number(serviceSummary.totalServices || 0),
        publishedServices: Number(serviceSummary.publishedServices || 0),
        totalApps: Number(appSummary.totalApps || 0),
        totalCallsToday: Number(callSummary.totalCallsToday || 0),
        successRateToday: Number(callSummary.totalCallsToday || 0) ? Number(((callSummary.successCallsToday || 0) / callSummary.totalCallsToday * 100).toFixed(2)) : 0,
        avgLatencyMsToday: Number(callSummary.avgLatencyMsToday || 0),
        topServices: topServices.map((row) => ({
          serviceId: Number(row.serviceId),
          serviceName: row.serviceName,
          serviceCode: row.serviceCode,
          callCount: Number(row.callCount || 0)
        })),
        topApps: topApps.map((row) => ({
          appId: Number(row.appId),
          appName: row.appName,
          appCode: row.appCode,
          callCount: Number(row.callCount || 0)
        })),
        recentErrors: recentErrors.map((row) => ({
          id: Number(row.id),
          serviceId: Number(row.serviceId),
          serviceName: row.serviceName,
          serviceCode: row.serviceCode,
          appName: row.appName || null,
          errorMessage: row.errorMessage || null,
          httpStatus: Number(row.httpStatus || 0),
          calledAt: row.calledAt
        }))
      };
    }
    function startOfDay(date) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
    function addDays(date, days) {
      const next = new Date(date);
      next.setDate(next.getDate() + days);
      return next;
    }
    function formatDashboardCount(value) {
      return `${Number(value || 0)}\u6B21`;
    }
    function formatDayOverDayChange(currentValue, previousValue) {
      const current = Number(currentValue || 0);
      const previous = Number(previousValue || 0);
      if (current === 0 && previous === 0) return "\u8F83\u6628 0%";
      if (previous === 0) return current > 0 ? "\u8F83\u6628 +100%" : "\u8F83\u6628 0%";
      const deltaPercent = (current - previous) / previous * 100;
      const rounded = Math.round(Math.abs(deltaPercent));
      if (rounded === 0) return "\u8F83\u6628 0%";
      return `\u8F83\u6628 ${deltaPercent >= 0 ? "+" : "-"}${rounded}%`;
    }
    function resolveDashboardHeroStatus(successRate, avgLatencyMs, failedCalls) {
      if (successRate >= 98 && avgLatencyMs <= 120 && failedCalls <= 2) return "\u6574\u4F53\u5065\u5EB7";
      if (successRate >= 92 && avgLatencyMs <= 500) return "\u8FD0\u884C\u5E73\u7A33";
      return "\u5B58\u5728\u6CE2\u52A8";
    }
    function buildDashboardRankTone(index) {
      if (index % 3 === 0) return "blue";
      if (index % 3 === 1) return "cyan";
      return "gold";
    }
    function buildDashboardTrendPoints(logs, range, now) {
      const todayStart = startOfDay(now);
      const bucketCount = range === "24h" ? 24 : range === "7d" ? 7 : 30;
      const start = range === "24h" ? todayStart : addDays(todayStart, -(bucketCount - 1));
      const end = now;
      const labels = Array.from({ length: bucketCount }, (_item, index) => {
        const bucketTime = range === "24h" ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), index) : addDays(start, index);
        return range === "24h" ? bucketTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : bucketTime.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
      });
      const buckets = labels.map((label) => ({
        label,
        calls: 0,
        activeApps: 0,
        latencyMs: 0
      }));
      const latencySums = Array.from({ length: bucketCount }, () => 0);
      const latencyCounts = Array.from({ length: bucketCount }, () => 0);
      const appSets = Array.from({ length: bucketCount }, () => /* @__PURE__ */ new Set());
      const startTime = start.getTime();
      const endTime = end.getTime();
      for (const log of logs) {
        const timestamp = new Date(log.calledAt).getTime();
        if (!Number.isFinite(timestamp) || timestamp < startTime || timestamp > endTime) continue;
        const bucketIndex = range === "24h" ? new Date(log.calledAt).getHours() : Math.floor((startOfDay(new Date(log.calledAt)).getTime() - startTime) / (24 * 60 * 60 * 1e3));
        if (bucketIndex < 0 || bucketIndex >= bucketCount) continue;
        buckets[bucketIndex].calls += 1;
        appSets[bucketIndex].add(log.appName || "\u533F\u540D\u5E94\u7528");
        latencySums[bucketIndex] += Number(log.latencyMs || 0);
        latencyCounts[bucketIndex] += 1;
      }
      return buckets.map((bucket, index) => ({
        ...bucket,
        activeApps: appSets[index].size,
        latencyMs: latencyCounts[index] ? Math.round(latencySums[index] / latencyCounts[index]) : 0
      }));
    }
    function filterDashboardLogsByRange(logs, range, now) {
      const todayStart = startOfDay(now);
      const start = range === "24h" ? todayStart : addDays(todayStart, -(range === "7d" ? 6 : 29));
      const startTime = start.getTime();
      const endTime = now.getTime();
      return logs.filter((log) => {
        const timestamp = new Date(log.calledAt).getTime();
        return Number.isFinite(timestamp) && timestamp >= startTime && timestamp <= endTime;
      });
    }
    function buildDashboardServiceRanks(logs) {
      const counts = /* @__PURE__ */ new Map();
      logs.forEach((log) => {
        const label = log.serviceName || log.serviceCode;
        counts.set(label, (counts.get(label) || 0) + 1);
      });
      return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([label, value], index) => ({
        key: `service-${label}`,
        label,
        value,
        displayValue: formatDashboardCount(value),
        tone: buildDashboardRankTone(index)
      }));
    }
    function buildDashboardDepartmentRanks(apps, logs) {
      const appDepartmentById = /* @__PURE__ */ new Map();
      const appDepartmentByName = /* @__PURE__ */ new Map();
      apps.forEach((app) => {
        const departmentName = String(app.departmentName || "").trim();
        if (!departmentName) return;
        appDepartmentById.set(app.id, departmentName);
        appDepartmentByName.set(app.appName, departmentName);
      });
      const departmentCounts = /* @__PURE__ */ new Map();
      logs.forEach((log) => {
        const departmentName = (typeof log.appId === "number" ? appDepartmentById.get(log.appId) : void 0) || appDepartmentByName.get(log.appName || "\u533F\u540D\u5E94\u7528");
        if (!departmentName) return;
        departmentCounts.set(departmentName, (departmentCounts.get(departmentName) || 0) + 1);
      });
      return [...departmentCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([label, value], index) => ({
        key: `department-${label}`,
        label,
        value,
        displayValue: formatDashboardCount(value),
        tone: buildDashboardRankTone(index)
      }));
    }
    function buildDashboardAppActivityMetric(apps, logs) {
      const appCounts = /* @__PURE__ */ new Map();
      logs.forEach((log) => {
        const appName = log.appName || "\u533F\u540D\u5E94\u7528";
        appCounts.set(appName, (appCounts.get(appName) || 0) + 1);
      });
      let highCount = 0;
      let mediumCount = 0;
      let lowCount = 0;
      const sourceNames = /* @__PURE__ */ new Set([
        ...apps.map((item) => item.appName),
        ...appCounts.keys()
      ]);
      sourceNames.forEach((name) => {
        const count = appCounts.get(name) || 0;
        if (count >= 10) highCount += 1;
        else if (count >= 4) mediumCount += 1;
        else lowCount += 1;
      });
      return {
        highCount,
        mediumCount,
        lowCount,
        total: sourceNames.size
      };
    }
    async function getOpsDashboard() {
      const now = /* @__PURE__ */ new Date();
      const todayStart = startOfDay(now);
      const logsWindowStart = addDays(todayStart, -29);
      const projectId = getCurrentProjectId();
      const logsWindowWhere = projectId ? "log.project_id = ? AND log.called_at >= ?" : "log.called_at >= ?";
      const logsWindowParams = projectId ? [projectId, logsWindowStart] : [logsWindowStart];
      const [services, apps, authorizations, recentLogRows] = await Promise.all([
        listServices(),
        listServiceApps(),
        listAuthorizations(),
        pool.query(
          `SELECT log.id,
              log.project_id AS projectId,
              log.service_id AS serviceId,
              log.app_id AS appId,
              sa.service_name AS serviceName,
              log.service_code AS serviceCode,
              app.app_name AS appName,
              app.app_code AS appCode,
              log.service_path AS servicePath,
              log.request_method AS requestMethod,
              log.auth_type AS authType,
              log.request_params_json AS requestParams,
              log.response_status AS responseStatus,
              log.success,
              log.http_status AS httpStatus,
              log.latency_ms AS latencyMs,
              log.client_ip AS clientIp,
              log.error_message AS errorMessage,
              log.called_at AS calledAt
       FROM service_api_call_logs log
       INNER JOIN service_apis sa ON sa.id = log.service_id
       LEFT JOIN service_apps app ON app.id = log.app_id
       WHERE ${logsWindowWhere}
       ORDER BY log.called_at DESC, log.id DESC`,
          logsWindowParams
        )
      ]);
      const logs = recentLogRows[0].map((row) => mapLogRow(row));
      const trackedLogs = logs.filter((log) => String(log.authType || "").trim().toLowerCase() === "token");
      const recent24hLogs = filterDashboardLogsByRange(trackedLogs, "24h", now);
      const yesterdayStart = addDays(todayStart, -1).getTime();
      const todayStartTs = todayStart.getTime();
      const yesterdayLogs = trackedLogs.filter((log) => {
        const timestamp = new Date(log.calledAt).getTime();
        return Number.isFinite(timestamp) && timestamp >= yesterdayStart && timestamp < todayStartTs;
      });
      const rangeLogs7d = filterDashboardLogsByRange(trackedLogs, "7d", now);
      const rangeLogs30d = filterDashboardLogsByRange(trackedLogs, "30d", now);
      const recent24hSuccessCount = recent24hLogs.filter((log) => log.success).length;
      const recent24hFailureCount = recent24hLogs.length - recent24hSuccessCount;
      const recent24hAvgLatencyMs = recent24hLogs.length ? Math.round(recent24hLogs.reduce((sum, log) => sum + Number(log.latencyMs || 0), 0) / recent24hLogs.length) : 0;
      const publishedCount = services.filter((item) => item.status === "published").length;
      const totalApps = apps.length;
      const coverageRate = services.length ? Math.round(publishedCount / Math.max(services.length, 1) * 100) : 0;
      const successRate = recent24hLogs.length ? recent24hSuccessCount / recent24hLogs.length * 100 : 0;
      const runningCount = publishedCount;
      const pendingCount = services.filter((item) => item.status === "draft").length;
      const inactiveCount = services.filter((item) => item.status === "disabled").length;
      return {
        generatedAt: now.toISOString(),
        heroStatus: resolveDashboardHeroStatus(successRate, recent24hAvgLatencyMs, recent24hFailureCount),
        flipMetrics: [
          { key: "services", label: "\u53D1\u5E03\u670D\u52A1\u6570", value: String(publishedCount), accent: `+${Math.max(publishedCount - 1, 0)}`, accentTone: "blue" },
          { key: "apps", label: "\u5E94\u7528\u6570", value: String(totalApps), accent: `\u6D3B\u8DC3${Math.max(totalApps, 0)}`, accentTone: "green" },
          { key: "authorizations", label: "\u6388\u6743\u6570", value: String(authorizations.length), accent: `\u8986\u76D6${coverageRate}%`, accentTone: "blue" },
          { key: "calls", label: "\u4ECA\u65E5\u8C03\u7528\u91CF", value: String(recent24hLogs.length), accent: formatDayOverDayChange(recent24hLogs.length, yesterdayLogs.length), accentTone: "green" },
          { key: "success", label: "\u5E73\u5747\u6210\u529F\u7387", value: `${Math.round(successRate)}%` }
        ],
        trendByRange: {
          "24h": buildDashboardTrendPoints(trackedLogs, "24h", now),
          "7d": buildDashboardTrendPoints(trackedLogs, "7d", now),
          "30d": buildDashboardTrendPoints(trackedLogs, "30d", now)
        },
        serviceRanksByRange: {
          "24h": buildDashboardServiceRanks(recent24hLogs),
          "7d": buildDashboardServiceRanks(rangeLogs7d),
          "30d": buildDashboardServiceRanks(rangeLogs30d)
        },
        departmentRanksByRange: {
          "24h": buildDashboardDepartmentRanks(apps, recent24hLogs),
          "7d": buildDashboardDepartmentRanks(apps, rangeLogs7d),
          "30d": buildDashboardDepartmentRanks(apps, rangeLogs30d)
        },
        statusMetric: {
          publishedRate: coverageRate,
          runningCount,
          pendingCount,
          inactiveCount
        },
        authorizationMetric: {
          tableCount: services.filter((item) => item.serviceMode === "table").length,
          sqlCount: services.filter((item) => item.serviceMode === "sql").length
        },
        appActivityMetric: buildDashboardAppActivityMetric(apps, recent24hLogs),
        reminderMetric: {
          slowCalls: recent24hLogs.filter((item) => Number(item.latencyMs || 0) > 300).length,
          failedCalls: recent24hFailureCount,
          pendingAuthorizations: authorizations.filter((item) => item.status !== "active").length
        }
      };
    }
    module2.exports = {
      countCallsSince,
      countServiceReferencesByDataSourceId,
      createAuthorization,
      createService,
      createServiceDataSource,
      createServiceApp,
      deleteAuthorization,
      deleteService,
      deleteServiceDataSource,
      deleteServiceApp,
      findAuthorization,
      findPublishedServiceByPath,
      findServiceAppByToken,
      getAuthorizationById,
      getOverview,
      getOpsDashboard,
      getServiceAiConfigByCode,
      getServiceAiConfigById,
      getServiceDataSourceById,
      getServiceAppById,
      getServiceById,
      listAuthorizations,
      listServiceAiConfigs,
      listServiceDataSources,
      listServiceApps,
      listServiceLogs,
      listServices,
      recordServiceCall,
      updateServiceAiConfig,
      updateAuthorization,
      updateService,
      updateServiceDataSource,
      updateServiceApp
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

// backend/src/modules/data-services/data-service.runtime.js
var require_data_service_runtime = __commonJS({
  "backend/src/modules/data-services/data-service.runtime.js"(exports2, module2) {
    var AppError = require_app_error();
    var { escapeIdentifier } = require_data_source_metadata();
    var { resolveDatasourceConnection } = require_datasource_dialect();
    var MAX_PAGE_SIZE = 100;
    function normalizeServicePath(value) {
      const normalized = `/${String(value || "").trim().replace(/^\/+/, "").replace(/\/+/g, "/")}`;
      if (normalized === "/") {
        throw new AppError("\u670D\u52A1\u8DEF\u5F84\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      return normalized;
    }
    function normalizeRequestMethod(value) {
      const normalized = String(value || "GET").trim().toUpperCase();
      if (!["GET", "POST"].includes(normalized)) {
        throw new AppError("\u5F53\u524D\u4EC5\u652F\u6301 GET \u548C POST \u8BF7\u6C42", 400);
      }
      return normalized;
    }
    function normalizeAuthType(value) {
      const normalized = String(value || "token").trim().toLowerCase();
      if (!["anonymous", "token"].includes(normalized)) {
        throw new AppError("\u8BA4\u8BC1\u65B9\u5F0F\u4EC5\u652F\u6301 anonymous \u6216 token", 400);
      }
      return normalized;
    }
    function normalizeServiceStatus(value) {
      const normalized = String(value || "draft").trim().toLowerCase();
      if (!["draft", "published", "disabled"].includes(normalized)) {
        throw new AppError("\u670D\u52A1\u72B6\u6001\u4EC5\u652F\u6301 draft\u3001published\u3001disabled", 400);
      }
      return normalized;
    }
    function normalizeServiceType(value) {
      const normalized = String(value || "list").trim().toLowerCase();
      if (!["list", "detail"].includes(normalized)) {
        throw new AppError("\u670D\u52A1\u7C7B\u578B\u4EC5\u652F\u6301 list \u6216 detail", 400);
      }
      return normalized;
    }
    function normalizeServiceMode(value) {
      const normalized = String(value || "table").trim().toLowerCase();
      if (!["table", "sql"].includes(normalized)) {
        throw new AppError("\u670D\u52A1\u6A21\u5F0F\u4EC5\u652F\u6301 table \u6216 sql", 400);
      }
      return normalized;
    }
    function getPlaceholder(dialect, index) {
      if (dialect === "postgresql") return `$${index}`;
      if (dialect === "oracle") return `:${index}`;
      return "?";
    }
    function getFlatValue(rawValue) {
      if (Array.isArray(rawValue)) {
        return rawValue[0];
      }
      return rawValue;
    }
    function hasValue(value) {
      return !(value === void 0 || value === null || String(value).trim() === "");
    }
    function normalizeNumber(value, fieldLabel) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new AppError(`${fieldLabel} \u5FC5\u987B\u4E3A\u6570\u503C`, 400);
      }
      return parsed;
    }
    function shouldKeepNumericString(value, fieldLabel = "") {
      const text = String(value ?? "").trim();
      if (!/^-?\d+$/.test(text)) return false;
      if (text.length >= 16) return true;
      const normalizedLabel = String(fieldLabel || "").trim().toLowerCase();
      return /(id[_\s-]*no|card|证件|身份证)/i.test(normalizedLabel);
    }
    function normalizeBoolean(value) {
      const normalized = String(value).trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "0", "no", "n"].includes(normalized)) return false;
      throw new AppError("\u5E03\u5C14\u53C2\u6570\u53D6\u503C\u65E0\u6548", 400);
    }
    function convertValueByType(value, dataType = "string", fieldLabel = "\u53C2\u6570") {
      if (value === void 0 || value === null || value === "") {
        return value;
      }
      const normalizedType = String(dataType || "string").trim().toLowerCase();
      if (["int", "integer", "bigint", "decimal", "numeric", "float", "double"].includes(normalizedType)) {
        if (shouldKeepNumericString(value, fieldLabel)) {
          return String(value).trim();
        }
        return normalizeNumber(value, fieldLabel);
      }
      if (["boolean", "bool"].includes(normalizedType)) {
        return normalizeBoolean(value);
      }
      return value;
    }
    function getParamValue(input, key) {
      if (!key) return void 0;
      return getFlatValue(input?.[key]);
    }
    function buildQualifiedTableName(dataSource, tableName, dialect) {
      const resolved = resolveDatasourceConnection(dataSource?.sourceType, dataSource?.connectionConfig || {});
      if (["postgresql", "oracle", "dm"].includes(dialect)) {
        const schema = String(resolved.schema || (dialect === "postgresql" ? "public" : resolved.username || "")).trim();
        return escapeIdentifier(`${schema}.${tableName}`, dialect);
      }
      const database = String(resolved.database || "").trim();
      if (database) {
        return escapeIdentifier(`${database}.${tableName}`, dialect);
      }
      return escapeIdentifier(tableName, dialect);
    }
    function normalizeSourceSql(sqlText = "") {
      const normalized = String(sqlText || "").trim().replace(/;+\s*$/g, "");
      if (!normalized) {
        throw new AppError("SQL \u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      if (!/^(select|with)\b/i.test(normalized)) {
        throw new AppError("\u5F53\u524D\u4EC5\u652F\u6301 SELECT / WITH \u67E5\u8BE2 SQL", 400);
      }
      return normalized;
    }
    function stripTrailingLimitOffset(sqlText = "") {
      return String(sqlText || "").trim().replace(/\s+offset\s+\d+\s*$/i, "").replace(/\s+limit\s+\d+\s*$/i, "").trim();
    }
    function buildSelectFields(responseFields, dialect) {
      if (!Array.isArray(responseFields) || responseFields.length === 0) {
        throw new AppError("\u81F3\u5C11\u9700\u8981\u9009\u62E9\u4E00\u4E2A\u8FD4\u56DE\u5B57\u6BB5", 400);
      }
      return responseFields.map((field) => {
        const columnName = String(field.columnName || "").trim();
        const fieldName = String(field.fieldName || field.columnName || "").trim();
        if (!columnName || !fieldName) {
          throw new AppError("\u8FD4\u56DE\u5B57\u6BB5\u914D\u7F6E\u4E0D\u5B8C\u6574", 400);
        }
        return `${escapeIdentifier(columnName, dialect)} AS ${escapeIdentifier(fieldName, dialect)}`;
      });
    }
    function buildWhereFragments(filters, input, dialect, params) {
      const clauses = [];
      const parameterMeta = [];
      const oneOfGroups = /* @__PURE__ */ new Map();
      for (const filter of Array.isArray(filters) ? filters : []) {
        const operator = String(filter.operator || "eq").trim().toLowerCase();
        const columnName = String(filter.columnName || "").trim();
        const label = String(filter.label || filter.paramName || columnName || "\u53C2\u6570");
        const dataType = String(filter.dataType || "string").trim();
        const requirementMode = String(filter.requirementMode || (filter.required ? "required" : "optional")).trim().toLowerCase();
        const requiredGroup = String(filter.requiredGroup || "").trim();
        if (!columnName) {
          continue;
        }
        const columnSql = escapeIdentifier(columnName, dialect);
        if (operator === "between") {
          const startValue = getParamValue(input, filter.startParamName);
          const endValue = getParamValue(input, filter.endParamName);
          const hasStart = hasValue(startValue);
          const hasEnd = hasValue(endValue);
          if (requirementMode === "required" && (!hasStart || !hasEnd)) {
            throw new AppError(`${label} \u7684\u8D77\u6B62\u53C2\u6570\u4E0D\u80FD\u4E3A\u7A7A`, 400);
          }
          if (requirementMode === "one_of_group" && requiredGroup) {
            const current = oneOfGroups.get(requiredGroup) || [];
            oneOfGroups.set(requiredGroup, [...current, hasStart && hasEnd]);
          }
          if (hasStart && hasEnd) {
            params.push(convertValueByType(startValue, dataType, `${label}\u5F00\u59CB\u503C`));
            params.push(convertValueByType(endValue, dataType, `${label}\u7ED3\u675F\u503C`));
            clauses.push(
              `${columnSql} BETWEEN ${getPlaceholder(dialect, params.length - 1)} AND ${getPlaceholder(dialect, params.length)}`
            );
            parameterMeta.push({
              key: `${filter.startParamName || columnName}~${filter.endParamName || columnName}`,
              value: [startValue, endValue]
            });
          } else if (hasStart || hasEnd) {
            throw new AppError(`${label} \u9700\u8981\u540C\u65F6\u63D0\u4F9B\u8D77\u59CB\u503C\u548C\u7ED3\u675F\u503C`, 400);
          }
          continue;
        }
        const rawValue = getParamValue(input, filter.paramName);
        if (!hasValue(rawValue)) {
          if (requirementMode === "required") {
            throw new AppError(`${label} \u4E0D\u80FD\u4E3A\u7A7A`, 400);
          }
          if (requirementMode === "one_of_group" && requiredGroup) {
            const current = oneOfGroups.get(requiredGroup) || [];
            oneOfGroups.set(requiredGroup, [...current, false]);
          }
          continue;
        }
        const value = convertValueByType(rawValue, dataType, label);
        if (operator === "like") {
          params.push(`%${String(value)}%`);
          clauses.push(`${columnSql} LIKE ${getPlaceholder(dialect, params.length)}`);
        } else {
          params.push(value);
          clauses.push(`${columnSql} = ${getPlaceholder(dialect, params.length)}`);
        }
        parameterMeta.push({
          key: filter.paramName || columnName,
          value: rawValue
        });
        if (requirementMode === "one_of_group" && requiredGroup) {
          const current = oneOfGroups.get(requiredGroup) || [];
          oneOfGroups.set(requiredGroup, [...current, true]);
        }
      }
      Array.from(oneOfGroups.entries()).forEach(([groupKey, values]) => {
        if (!values.some(Boolean)) {
          throw new AppError(`\u7EC4\u5408\u53C2\u6570 ${groupKey} \u81F3\u5C11\u9700\u8981\u586B\u5199\u4E00\u4E2A\u5B57\u6BB5`, 400);
        }
      });
      return { clauses, parameterMeta };
    }
    function buildServiceSql(serviceApi, dataSource, runtimeInput = {}) {
      const resolved = resolveDatasourceConnection(dataSource?.sourceType, dataSource?.connectionConfig || {});
      const dialect = resolved.dialect;
      if (!["mysql", "postgresql", "oracle", "dm"].includes(dialect)) {
        throw new AppError("\u5F53\u524D\u6570\u636E\u6E90\u7C7B\u578B\u4E0D\u652F\u6301\u53D1\u5E03 API", 400);
      }
      const serviceType = normalizeServiceType(serviceApi.serviceType);
      const serviceMode = normalizeServiceMode(serviceApi.serviceMode);
      const queryConfig = serviceApi.queryConfig || {};
      const responseConfig = serviceApi.responseConfig || {};
      const filters = queryConfig.filters || [];
      const responseFields = responseConfig.fields || [];
      const tableName = String(serviceApi.sourceTable || "").trim();
      const sourceSql = serviceApi.sourceSql ? normalizeSourceSql(serviceApi.sourceSql) : "";
      const executableSourceSql = serviceMode === "sql" ? stripTrailingLimitOffset(sourceSql) : sourceSql;
      if (serviceMode === "table" && !tableName) {
        throw new AppError("\u670D\u52A1\u672A\u7ED1\u5B9A\u6570\u636E\u8868", 400);
      }
      if (serviceMode === "sql" && !sourceSql) {
        throw new AppError("\u670D\u52A1\u672A\u914D\u7F6E SQL", 400);
      }
      const selectFields = buildSelectFields(responseFields, dialect);
      const fromSql = serviceMode === "sql" ? `(${executableSourceSql}) ${dialect === "oracle" ? "" : "AS "}${escapeIdentifier("service_sql_result", dialect)}` : buildQualifiedTableName(dataSource, tableName, dialect);
      const params = [];
      const { clauses, parameterMeta } = buildWhereFragments(filters, runtimeInput, dialect, params);
      const whereSql = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
      const normalizedPageNum = Math.max(1, Number(runtimeInput.pageNum || 1) || 1);
      const requestedPageSize = Math.max(1, Number(runtimeInput.pageSize || queryConfig.defaultPageSize || 20) || 20);
      const maxPageSize = Math.max(1, Number(queryConfig.maxPageSize || MAX_PAGE_SIZE) || MAX_PAGE_SIZE);
      const pageSize = Math.min(requestedPageSize, maxPageSize);
      let orderSql = "";
      if (queryConfig.defaultSortField) {
        const direction = String(queryConfig.defaultSortOrder || "desc").trim().toUpperCase() === "ASC" ? "ASC" : "DESC";
        orderSql = ` ORDER BY ${escapeIdentifier(queryConfig.defaultSortField, dialect)} ${direction}`;
      }
      if (serviceType === "detail") {
        return {
          dialect,
          parameterMeta,
          dataSql: dialect === "oracle" ? `SELECT * FROM (SELECT ${selectFields.join(", ")} FROM ${fromSql}${whereSql}${orderSql}) WHERE ROWNUM <= 1` : dialect === "dm" ? `SELECT ${selectFields.join(", ")} FROM ${fromSql}${whereSql}${orderSql} FETCH FIRST 1 ROWS ONLY` : `SELECT ${selectFields.join(", ")} FROM ${fromSql}${whereSql}${orderSql} LIMIT 1`,
          dataParams: params,
          countSql: null,
          countParams: [],
          meta: {
            pageNum: 1,
            pageSize: 1,
            serviceType,
            serviceMode,
            paginationEnabled: false
          }
        };
      }
      const paginationEnabled = queryConfig.pagination !== false;
      const countSql = paginationEnabled ? `SELECT COUNT(*) AS total FROM ${fromSql}${whereSql}` : null;
      let dataSql = `SELECT ${selectFields.join(", ")} FROM ${fromSql}${whereSql}${orderSql}`;
      const dataParams = [...params];
      if (paginationEnabled) {
        if (dialect === "postgresql") {
          dataParams.push(pageSize);
          dataParams.push((normalizedPageNum - 1) * pageSize);
          dataSql += ` LIMIT ${getPlaceholder(dialect, dataParams.length - 1)} OFFSET ${getPlaceholder(dialect, dataParams.length)}`;
        } else if (dialect === "oracle" || dialect === "dm") {
          const offset = (normalizedPageNum - 1) * pageSize;
          dataSql += ` OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
        } else {
          const offset = (normalizedPageNum - 1) * pageSize;
          dataSql += ` LIMIT ${offset}, ${pageSize}`;
        }
      }
      return {
        dialect,
        parameterMeta,
        dataSql,
        dataParams,
        countSql,
        countParams: params,
        meta: {
          pageNum: normalizedPageNum,
          pageSize,
          serviceType,
          serviceMode,
          paginationEnabled
        }
      };
    }
    function sanitizeRequestParams(input) {
      const result = {};
      for (const [key, value] of Object.entries(input || {})) {
        if (value === void 0) continue;
        const nextValue = Array.isArray(value) ? value.map((item) => String(item)).slice(0, 5) : String(value);
        result[key] = typeof nextValue === "string" && nextValue.length > 256 ? `${nextValue.slice(0, 256)}...` : nextValue;
      }
      return result;
    }
    function normalizeIpList(value) {
      if (Array.isArray(value)) {
        return value.map((item) => String(item || "").trim()).filter(Boolean);
      }
      return String(value || "").split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);
    }
    function isIpAllowed(clientIp, whitelist) {
      const rules = normalizeIpList(whitelist);
      if (rules.length === 0) {
        return true;
      }
      return rules.includes(clientIp);
    }
    module2.exports = {
      MAX_PAGE_SIZE,
      buildServiceSql,
      isIpAllowed,
      normalizeAuthType,
      normalizeIpList,
      normalizeRequestMethod,
      normalizeServiceMode,
      normalizeServicePath,
      normalizeServiceStatus,
      normalizeServiceType,
      normalizeSourceSql,
      sanitizeRequestParams
    };
  }
});

// backend/src/modules/data-services/data-service.service.js
var require_data_service_service = __commonJS({
  "backend/src/modules/data-services/data-service.service.js"(exports2, module2) {
    var crypto = require("crypto");
    var mysql = require("mysql2/promise");
    var {
      Document,
      HeadingLevel,
      Packer,
      Paragraph,
      Table,
      TableCell,
      TableRow,
      TextRun,
      WidthType
    } = require("docx");
    var AppError = require_app_error();
    var metadataService = require_data_source_metadata();
    var { testDatabaseConnection } = require_data_source_test_connection();
    var repository = require_data_service_repository();
    var { createPostgresLikeClient } = require_db_client();
    var { resolveDatasourceConnection } = require_datasource_dialect();
    var { getAdapter } = require_adapters();
    var { getManagedBinding } = require_managed_jdbc_runtime();
    var modelProviderService = require_model_provider_service();
    var {
      buildServiceSql,
      isIpAllowed,
      normalizeAuthType,
      normalizeIpList,
      normalizeRequestMethod,
      normalizeServiceMode,
      normalizeServicePath,
      normalizeServiceStatus,
      normalizeServiceType,
      normalizeSourceSql,
      sanitizeRequestParams
    } = require_data_service_runtime();
    function buildDuplicateErrorMessage(error, defaultMessage) {
      if (error?.code === "ER_DUP_ENTRY") {
        return "\u7F16\u7801\u6216\u8DEF\u5F84\u5DF2\u5B58\u5728\uFF0C\u8BF7\u8C03\u6574\u540E\u91CD\u8BD5";
      }
      return defaultMessage;
    }
    function buildAppDuplicateErrorMessage(error, defaultMessage) {
      if (error?.code === "ER_DUP_ENTRY") {
        return "\u5E94\u7528\u7F16\u7801\u6216\u4EE4\u724C\u5DF2\u5B58\u5728\uFF0C\u8BF7\u8C03\u6574\u540E\u91CD\u8BD5";
      }
      return defaultMessage;
    }
    function buildDataSourceDuplicateErrorMessage(error, defaultMessage) {
      if (error?.code === "ER_DUP_ENTRY") {
        return "\u6570\u636E\u6E90\u7F16\u7801\u5DF2\u5B58\u5728\uFF0C\u8BF7\u8C03\u6574\u540E\u91CD\u8BD5";
      }
      return defaultMessage;
    }
    var DEFAULT_SERVICE_CONFIG_SYSTEM_PROMPT = [
      "\u4F60\u662F\u8D44\u6DF1\u6570\u636E\u670D\u52A1\u67B6\u6784\u5E08\uFF0C\u8D1F\u8D23\u4E3A\u201C\u6570\u636E\u670D\u52A1 / \u8868\u8F6C API \u6216 SQL \u8F6C API\u201D\u751F\u6210\u53EF\u76F4\u63A5\u843D\u5730\u7684\u63A8\u8350\u914D\u7F6E\u3002",
      "\u4F60\u5FC5\u987B\u7EFC\u5408\u6570\u636E\u6E90\u7C7B\u578B\u3001\u8868\u7ED3\u6784\u6216 SQL \u7ED3\u679C\u5B57\u6BB5\u3001\u6837\u4F8B\u6570\u636E\u4E0E\u5F53\u524D\u8868\u5355\u4E0A\u4E0B\u6587\uFF0C\u7ED9\u51FA\u670D\u52A1\u540D\u79F0\u3001\u670D\u52A1\u7F16\u7801\u3001\u63A5\u53E3\u8DEF\u5F84\u3001\u8BF7\u6C42\u65B9\u5F0F\u3001\u67E5\u8BE2\u53C2\u6570\u548C\u8FD4\u56DE\u5B57\u6BB5\u5EFA\u8BAE\u3002",
      "\u5BF9\u4E8E\u5217\u8868\u670D\u52A1\uFF0C\u4F18\u5148\u63A8\u8350\u66F4\u65B0\u65F6\u95F4\u7C7B\u5B57\u6BB5\u4F5C\u4E3A\u9ED8\u8BA4\u6392\u5E8F\u5B57\u6BB5\uFF0C\u6392\u5E8F\u65B9\u5411\u4F18\u5148\u5012\u5E8F(desc)\u3002",
      "\u670D\u52A1\u7F16\u7801\u53EA\u5141\u8BB8\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\uFF1B\u5982\u679C\u5141\u8BB8\u7559\u7A7A\uFF0C\u4E5F\u8981\u540C\u65F6\u7ED9\u51FA\u4E00\u4E2A\u53EF\u76F4\u63A5\u843D\u5730\u7684\u5EFA\u8BAE\u503C\u3002",
      "\u8F93\u51FA\u5FC5\u987B\u662F JSON\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\uFF0C\u4E0D\u8981\u89E3\u91CA\u3002",
      "\u5B57\u6BB5\u56FA\u5B9A\u4E3A\uFF1AserviceName\u3001serviceCode\u3001servicePath\u3001requestMethod\u3001serviceType\u3001description\u3001defaultSortField\u3001defaultSortOrder\u3001queryFields\u3001responseFieldNames\u3001reasoning\u3002",
      "queryFields \u4E2D\u53EF\u5305\u542B requirementMode(required|optional|one_of_group) \u4E0E requiredGroup\u3002",
      "\u5982\u679C\u4FE1\u606F\u4E0D\u8DB3\uFF0C\u4F18\u5148\u8FD4\u56DE\u4FDD\u5B88\u4E14\u53EF\u6267\u884C\u7684\u5EFA\u8BAE\u3002"
    ].join("\n");
    function normalizeText(value, fallback = "") {
      const normalized = String(value || "").trim();
      return normalized || fallback;
    }
    function sanitizeSqlText(sql = "") {
      return String(sql || "").replace(/;\s*$/g, "").trim();
    }
    function slugifyIdentifier(value, fallback = "service") {
      const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      return normalized || fallback;
    }
    function guessFieldDataTypeFromValue(value) {
      if (value === null || value === void 0 || value === "") return "string";
      if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
      if (typeof value === "boolean") return "boolean";
      const text = String(value).trim();
      if (!text) return "string";
      if (/^-?\d+$/.test(text)) return "integer";
      if (/^-?\d+\.\d+$/.test(text)) return "number";
      if (/^(true|false)$/i.test(text)) return "boolean";
      if (/^\d{4}-\d{2}-\d{2}(?:[ tT]\d{2}:\d{2}:\d{2})?/.test(text)) return "datetime";
      return "string";
    }
    function guessExampleValueByDataType(dataType = "string", fieldName = "field") {
      const normalized = String(dataType || "string").trim().toLowerCase();
      if (normalized.includes("int")) return 1;
      if (normalized.includes("decimal") || normalized.includes("numeric") || normalized.includes("double") || normalized.includes("float") || normalized === "number") return 99.98;
      if (normalized.includes("bool")) return true;
      if (normalized.includes("date") || normalized.includes("time")) return "2026-05-01 10:00:00";
      const lowerName = String(fieldName || "").trim().toLowerCase();
      if (lowerName.includes("phone")) return "13812345678";
      if (lowerName.includes("mobile")) return "13812345678";
      if (lowerName.includes("id_card")) return "110101199001011234";
      if (lowerName.includes("email")) return "demo@example.com";
      if (lowerName.includes("name")) return "\u793A\u4F8B\u503C";
      return "\u793A\u4F8B\u503C";
    }
    function buildServiceCodeSuggestion(payload = {}, existingRecord = null) {
      if (existingRecord?.serviceCode) {
        return existingRecord.serviceCode;
      }
      const base = slugifyIdentifier(
        payload.serviceCode || payload.serviceName || payload.servicePath || payload.sourceTable || "service_api"
      );
      return `${base}_${String(Date.now()).slice(-6)}`;
    }
    function normalizeRequirementMode(value, requiredFlag) {
      const normalized = String(value || "").trim().toLowerCase();
      if (normalized === "one_of_group") return "one_of_group";
      if (normalized === "required") return "required";
      if (requiredFlag === true) return "required";
      return "optional";
    }
    function stripMarkdownFence(text = "") {
      const normalized = String(text || "").trim();
      const matched = normalized.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
      return matched ? matched[1].trim() : normalized;
    }
    function ensureJsonObjectPrompt(messages = [], provider = null) {
      if (!Array.isArray(messages)) return [];
      const extraInstruction = "\u53EA\u8F93\u51FA\u4E00\u4E2A JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\uFF0C\u4E0D\u8981\u8865\u5145\u89E3\u91CA\u3002";
      return messages.map((message, index) => {
        if (index !== 0 || message?.role !== "system") {
          return message;
        }
        return {
          ...message,
          content: `${String(message.content || "")}
${extraInstruction}`.trim()
        };
      });
    }
    function pickRecommendedSortField(columns = []) {
      const normalized = Array.isArray(columns) ? columns : [];
      const candidates = [
        "update_time",
        "updated_at",
        "last_update_time",
        "modify_time",
        "modified_at",
        "reg_time",
        "create_time",
        "created_at",
        "event_time"
      ];
      const availableNames = normalized.map((item) => String(item?.columnName || "").trim());
      for (const candidate of candidates) {
        if (availableNames.includes(candidate)) {
          return candidate;
        }
      }
      return availableNames[0] || null;
    }
    function normalizeServiceDataSourcePayload(payload, existingRecord = null) {
      return {
        sourceName: String(payload.sourceName || "").trim(),
        sourceCode: String(payload.sourceCode || "").trim(),
        sourceType: String(payload.sourceType || "mysql").trim().toLowerCase(),
        connectionConfig: payload.connectionConfig || {},
        ownerName: String(payload.ownerName || existingRecord?.ownerName || "system").trim() || "system",
        status: String(payload.status || existingRecord?.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active"
      };
    }
    async function ensureActiveDataSource(sourceId) {
      const dataSource = await repository.getServiceDataSourceById(sourceId);
      if (!dataSource) {
        throw new AppError("\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      }
      if (dataSource.status !== "active") {
        throw new AppError("\u6570\u636E\u6E90\u672A\u542F\u7528\uFF0C\u65E0\u6CD5\u53D1\u5E03\u670D\u52A1", 400);
      }
      return dataSource;
    }
    async function describeServiceColumns(dataSource, payload = {}) {
      const serviceMode = normalizeServiceMode(payload.serviceMode || payload.mode || "table");
      if (serviceMode === "table") {
        const sourceTable = String(payload.sourceTable || "").trim();
        if (!sourceTable) {
          throw new AppError("\u8BF7\u5148\u9009\u62E9\u6570\u636E\u8868", 400);
        }
        const tables = await metadataService.listTables(dataSource);
        const tableExists = tables.some((item) => item.tableName === sourceTable);
        if (!tableExists) {
          throw new AppError("\u6240\u9009\u6570\u636E\u8868\u4E0D\u5B58\u5728", 400);
        }
        const columns = await metadataService.listColumns(dataSource, sourceTable);
        const sampleRows = await metadataService.sampleRows(dataSource, sourceTable, 10).catch(() => []);
        return {
          serviceMode,
          columns: columns.map((column) => ({
            columnName: column.columnName,
            label: column.columnComment || column.columnName,
            dataType: String(column.dataType || "string").trim().toLowerCase()
          })),
          sampleRows,
          sourceTable,
          sourceSql: null
        };
      }
      const sourceSql = normalizeSourceSql(payload.sourceSql);
      if (!sourceSql) {
        throw new AppError("SQL \u6A21\u5F0F\u4E0B\u5FC5\u987B\u586B\u5199\u67E5\u8BE2 SQL", 400);
      }
      const preview = await previewServiceSql(dataSource.id, sourceSql);
      return {
        serviceMode,
        columns: preview.columns,
        sampleRows: preview.sampleRows,
        sourceTable: null,
        sourceSql
      };
    }
    async function validateServiceSchema(dataSource, payload = {}) {
      const serviceStructure = await describeServiceColumns(dataSource, payload);
      const columnMap = new Map(serviceStructure.columns.map((column) => [column.columnName, column]));
      const queryConfig = payload.queryConfig || {};
      const responseConfig = payload.responseConfig || {};
      const normalizedFilters = (queryConfig.filters || []).map((filter, index) => {
        const columnName = String(filter.columnName || "").trim();
        const column = columnMap.get(columnName);
        if (!column) {
          throw new AppError(`\u67E5\u8BE2\u5B57\u6BB5 ${columnName} \u4E0D\u5B58\u5728`, 400);
        }
        const operator = String(filter.operator || "eq").trim().toLowerCase();
        if (!["eq", "like", "between"].includes(operator)) {
          throw new AppError(`\u5B57\u6BB5 ${columnName} \u7684\u67E5\u8BE2\u65B9\u5F0F\u4E0D\u652F\u6301`, 400);
        }
        const requirementMode = normalizeRequirementMode(filter.requirementMode, filter.required);
        const requiredGroup = requirementMode === "one_of_group" ? normalizeText(filter.requiredGroup, `group_${index + 1}`) : null;
        return {
          columnName,
          label: String(filter.label || column.label || columnName).trim(),
          paramName: operator === "between" ? null : String(filter.paramName || columnName).trim(),
          startParamName: operator === "between" ? String(filter.startParamName || `${columnName}Start`).trim() : null,
          endParamName: operator === "between" ? String(filter.endParamName || `${columnName}End`).trim() : null,
          operator,
          required: requirementMode === "required",
          requirementMode,
          requiredGroup,
          dataType: String(filter.dataType || column.dataType || "string").trim().toLowerCase()
        };
      });
      const normalizedResponseFields = (responseConfig.fields || []).map((field) => {
        const columnName = String(field.columnName || "").trim();
        const column = columnMap.get(columnName);
        if (!column) {
          throw new AppError(`\u8FD4\u56DE\u5B57\u6BB5 ${columnName} \u4E0D\u5B58\u5728`, 400);
        }
        return {
          columnName,
          fieldName: String(field.fieldName || columnName).trim(),
          label: String(field.label || column.label || columnName).trim(),
          dataType: String(field.dataType || column.dataType || "string").trim().toLowerCase()
        };
      });
      if (normalizedResponseFields.length === 0) {
        throw new AppError("\u8BF7\u81F3\u5C11\u52FE\u9009\u4E00\u4E2A\u8FD4\u56DE\u5B57\u6BB5", 400);
      }
      const defaultSortField = queryConfig?.defaultSortField ? String(queryConfig.defaultSortField).trim() : null;
      if (defaultSortField && !columnMap.has(defaultSortField)) {
        throw new AppError(`\u9ED8\u8BA4\u6392\u5E8F\u5B57\u6BB5 ${defaultSortField} \u4E0D\u5B58\u5728`, 400);
      }
      return {
        queryConfig: {
          filters: normalizedFilters,
          pagination: queryConfig?.pagination !== false,
          defaultPageSize: Number(queryConfig?.defaultPageSize || 20) || 20,
          maxPageSize: Number(queryConfig?.maxPageSize || 100) || 100,
          defaultSortField,
          defaultSortOrder: String(queryConfig?.defaultSortOrder || "desc").trim().toLowerCase() === "asc" ? "asc" : "desc"
        },
        responseConfig: {
          fields: normalizedResponseFields
        },
        structure: serviceStructure
      };
    }
    async function prepareServicePayload(payload, existingRecord = null) {
      const dataSource = await ensureActiveDataSource(Number(payload.sourceId));
      const serviceStatus = normalizeServiceStatus(payload.status);
      const serviceType = normalizeServiceType(payload.serviceType);
      const serviceMode = normalizeServiceMode(payload.serviceMode || existingRecord?.serviceMode || "table");
      const { queryConfig, responseConfig, structure } = await validateServiceSchema(dataSource, {
        ...payload,
        serviceMode
      });
      return {
        serviceName: String(payload.serviceName || "").trim(),
        serviceCode: normalizeText(payload.serviceCode, buildServiceCodeSuggestion(payload, existingRecord)),
        servicePath: normalizeServicePath(payload.servicePath),
        requestMethod: normalizeRequestMethod(payload.requestMethod),
        dataDomain: String(payload.dataDomain || "api-service").trim() || "api-service",
        sourceId: dataSource.id,
        serviceMode,
        sourceTable: structure.sourceTable,
        sourceSql: structure.sourceSql,
        serviceType,
        authType: normalizeAuthType(payload.authType),
        status: serviceStatus,
        description: String(payload.description || "").trim() || null,
        queryConfig,
        responseConfig,
        ownerName: String(payload.ownerName || existingRecord?.ownerName || "system").trim() || "system",
        publishedAt: serviceStatus === "published" ? existingRecord?.publishedAt || /* @__PURE__ */ new Date() : null
      };
    }
    async function listServices() {
      return repository.listServices();
    }
    async function listServiceDataSources() {
      return repository.listServiceDataSources();
    }
    async function getOverview() {
      return repository.getOverview();
    }
    async function getOpsDashboard() {
      return repository.getOpsDashboard();
    }
    async function listServiceApps() {
      return repository.listServiceApps();
    }
    async function listAuthorizations() {
      return repository.listAuthorizations();
    }
    async function listServiceLogs(options = {}) {
      return repository.listServiceLogs(options);
    }
    async function createService(payload) {
      try {
        const normalized = await prepareServicePayload(payload);
        return await repository.createService(normalized);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(buildDuplicateErrorMessage(error, "\u521B\u5EFA\u670D\u52A1\u5931\u8D25"), error.statusCode || 400);
      }
    }
    async function updateService(id, payload) {
      const existing = await repository.getServiceById(id);
      if (!existing) {
        throw new AppError("\u670D\u52A1\u4E0D\u5B58\u5728", 404);
      }
      try {
        const normalized = await prepareServicePayload(payload, existing);
        const updated = await repository.updateService(id, normalized);
        if (!updated) {
          throw new AppError("\u670D\u52A1\u4E0D\u5B58\u5728", 404);
        }
        return updated;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(buildDuplicateErrorMessage(error, "\u66F4\u65B0\u670D\u52A1\u5931\u8D25"), error.statusCode || 400);
      }
    }
    async function updateServiceStatus(id, status) {
      const existing = await repository.getServiceById(id);
      if (!existing) {
        throw new AppError("\u670D\u52A1\u4E0D\u5B58\u5728", 404);
      }
      const updated = await repository.updateService(id, {
        ...existing,
        status: normalizeServiceStatus(status)
      });
      if (!updated) {
        throw new AppError("\u670D\u52A1\u4E0D\u5B58\u5728", 404);
      }
      return updated;
    }
    async function deleteService(id) {
      const existing = await repository.getServiceById(id);
      if (!existing) {
        throw new AppError("\u670D\u52A1\u4E0D\u5B58\u5728", 404);
      }
      const deleted = await repository.deleteService(id);
      if (!deleted) {
        throw new AppError("\u670D\u52A1\u4E0D\u5B58\u5728", 404);
      }
      return { id, deleted: true };
    }
    async function createServiceDataSource(payload) {
      try {
        const normalized = normalizeServiceDataSourcePayload(payload);
        return await repository.createServiceDataSource(normalized);
      } catch (error) {
        throw new AppError(buildDataSourceDuplicateErrorMessage(error, "\u521B\u5EFA\u6570\u636E\u6E90\u5931\u8D25"), error.statusCode || 400);
      }
    }
    async function updateServiceDataSource(id, payload) {
      const existing = await repository.getServiceDataSourceById(id);
      if (!existing) {
        throw new AppError("\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      }
      try {
        const normalized = normalizeServiceDataSourcePayload(payload, existing);
        return await repository.updateServiceDataSource(id, normalized);
      } catch (error) {
        throw new AppError(buildDataSourceDuplicateErrorMessage(error, "\u66F4\u65B0\u6570\u636E\u6E90\u5931\u8D25"), error.statusCode || 400);
      }
    }
    async function deleteServiceDataSource(id) {
      const existing = await repository.getServiceDataSourceById(id);
      if (!existing) {
        throw new AppError("\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      }
      const referenceCount = await repository.countServiceReferencesByDataSourceId(id);
      if (referenceCount > 0) {
        throw new AppError("\u5F53\u524D\u6570\u636E\u6E90\u4ECD\u6709\u5173\u8054\u670D\u52A1\uFF0C\u65E0\u6CD5\u5220\u9664", 409, { referenceCount });
      }
      const deleted = await repository.deleteServiceDataSource(id);
      if (!deleted) {
        throw new AppError("\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      }
      return { id, deleted: true };
    }
    async function testServiceDataSourceConnection(payload) {
      const normalized = normalizeServiceDataSourcePayload(payload);
      return testDatabaseConnection(normalized.connectionConfig, normalized.sourceType);
    }
    async function ensureServiceDataSource(sourceId) {
      const dataSource = await repository.getServiceDataSourceById(sourceId);
      if (!dataSource) {
        throw new AppError("\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      }
      return dataSource;
    }
    async function listServiceDataSourceTables(sourceId) {
      const dataSource = await ensureActiveDataSource(sourceId);
      return metadataService.listTables(dataSource);
    }
    async function listServiceDataSourceColumns(sourceId, tableName) {
      const dataSource = await ensureActiveDataSource(sourceId);
      return metadataService.listColumns(dataSource, tableName);
    }
    async function sampleServiceDataSourceRows(sourceId, tableName, limit) {
      const dataSource = await ensureServiceDataSource(sourceId);
      return metadataService.sampleRows(dataSource, tableName, limit);
    }
    function buildPreviewSql(sql = "", limit = 20, dialect = "mysql") {
      const normalized = sanitizeSqlText(sql);
      if (!normalized) {
        throw new AppError("SQL \u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      if (!/^\s*(select|with)\b/i.test(normalized)) {
        throw new AppError("\u4EC5\u652F\u6301\u67E5\u8BE2\u7C7B SQL \u9884\u89C8", 400);
      }
      if (/\blimit\s+\d+\s*$/i.test(normalized) || /\bfetch\s+first\s+\d+\s+rows\s+only\s*$/i.test(normalized) || /\brownum\b/i.test(normalized)) {
        return normalized;
      }
      const safeLimit = Math.max(1, Math.min(100, Number(limit || 20) || 20));
      if (dialect === "oracle") return `SELECT * FROM (${normalized}) WHERE ROWNUM <= ${safeLimit}`;
      if (dialect === "dm") return `${normalized} FETCH FIRST ${safeLimit} ROWS ONLY`;
      return `${normalized} LIMIT ${safeLimit}`;
    }
    function inferPreviewColumns(fieldNames = [], sampleRows = []) {
      return fieldNames.map((name) => {
        const sampleValue = sampleRows.find((row) => row && Object.prototype.hasOwnProperty.call(row, name) && row[name] !== null && row[name] !== void 0)?.[name];
        return {
          columnName: name,
          label: name,
          dataType: guessFieldDataTypeFromValue(sampleValue)
        };
      });
    }
    async function previewServiceSql(sourceId, sql, limit = 20) {
      const dataSource = await ensureActiveDataSource(Number(sourceId));
      return withServiceConnection(dataSource, async (connection, dialect) => {
        const previewSql = buildPreviewSql(sql, limit, dialect);
        if (dialect === "mysql") {
          const [rows, fields] = await connection.query(previewSql);
          const sampleRows2 = Array.isArray(rows) ? rows : [];
          const columns2 = inferPreviewColumns((fields || []).map((field) => field.name), sampleRows2);
          return {
            columns: columns2,
            sampleRows: sampleRows2,
            rowCount: sampleRows2.length
          };
        }
        const result = await connection.query(previewSql);
        const sampleRows = Array.isArray(result.rows) ? result.rows : [];
        const columns = inferPreviewColumns((result.fields || []).map((field) => field.name), sampleRows);
        return {
          columns,
          sampleRows,
          rowCount: sampleRows.length
        };
      });
    }
    async function listServiceAiConfigs() {
      return repository.listServiceAiConfigs();
    }
    async function validateServiceDefaultProvider(defaultModelProviderId, defaultModelName, defaultModelVersion) {
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
    async function updateServiceAiConfig(id, payload) {
      const existing = await repository.getServiceAiConfigById(id);
      if (!existing) {
        throw new AppError("\u6570\u636E\u670D\u52A1 AI \u573A\u666F\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      const normalizedModel = await validateServiceDefaultProvider(
        payload.defaultModelProviderId ?? existing.defaultModelProviderId,
        payload.defaultModelName ?? existing.defaultModelName,
        payload.defaultModelVersion ?? existing.defaultModelVersion
      );
      const row = await repository.updateServiceAiConfig(id, {
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
        throw new AppError("\u6570\u636E\u670D\u52A1 AI \u573A\u666F\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function getActiveServiceAiConfigByCode(sceneCode) {
      const row = await repository.getServiceAiConfigByCode(sceneCode);
      if (!row || row.status !== "active") {
        return null;
      }
      return row;
    }
    async function resolveServiceRecommendationProvider(aiConfig) {
      if (aiConfig?.defaultModelProviderId) {
        const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
        return modelProviderService.applyModelSelection(provider, {
          modelName: aiConfig.defaultModelName,
          modelVersion: aiConfig.defaultModelVersion
        });
      }
      const providers = await modelProviderService.getActiveChatModelProviders();
      if (!providers.length) {
        throw new AppError("\u672A\u627E\u5230\u53EF\u7528\u7684\u5BF9\u8BDD\u6A21\u578B\uFF0C\u8BF7\u5148\u5728\u6A21\u578B\u7BA1\u7406\u4E2D\u7EF4\u62A4\u670D\u52A1\u5F00\u53D1\u63A8\u8350\u573A\u666F\u9ED8\u8BA4\u6A21\u578B", 400);
      }
      return providers[0];
    }
    function buildServiceRecommendationPrompt(payload, dataSource, structure, aiConfig) {
      const columns = (structure.columns || []).map((column) => ({
        columnName: column.columnName,
        label: column.label || column.columnName,
        dataType: column.dataType || "string"
      }));
      const sampleRows = Array.isArray(structure.sampleRows) ? structure.sampleRows.slice(0, 5) : [];
      return [
        {
          role: "system",
          content: aiConfig?.systemPrompt || DEFAULT_SERVICE_CONFIG_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: JSON.stringify({
            currentForm: {
              serviceName: payload.serviceName || "",
              serviceCode: payload.serviceCode || "",
              servicePath: payload.servicePath || "",
              requestMethod: payload.requestMethod || "GET",
              serviceType: payload.serviceType || "list",
              ownerName: payload.ownerName || "system",
              description: payload.description || "",
              serviceMode: structure.serviceMode,
              sourceTable: structure.sourceTable || null
            },
            dataSource: {
              id: dataSource.id,
              sourceName: dataSource.sourceName,
              sourceCode: dataSource.sourceCode,
              sourceType: dataSource.sourceType,
              database: dataSource.connectionConfig?.database || null
            },
            sourceSql: structure.serviceMode === "sql" ? structure.sourceSql : null,
            resultColumns: columns,
            sampleRows,
            outputSchema: {
              serviceName: "\u63A8\u8350\u7684\u670D\u52A1\u540D\u79F0",
              serviceCode: "\u63A8\u8350\u7684\u670D\u52A1\u7F16\u7801\uFF0C\u53EF\u4E3A\u7A7A\uFF0C\u4F46\u6700\u597D\u7ED9\u51FA\u5EFA\u8BAE\u503C",
              servicePath: "\u63A8\u8350\u7684\u63A5\u53E3\u8DEF\u5F84\uFF0C\u5F62\u5982 /demo/query_user",
              requestMethod: "GET \u6216 POST",
              serviceType: "list \u6216 detail",
              description: "1~3 \u53E5\u670D\u52A1\u8BF4\u660E",
              defaultSortField: "\u9ED8\u8BA4\u6392\u5E8F\u5B57\u6BB5\uFF0C\u4F18\u5148\u63A8\u8350\u66F4\u65B0\u65F6\u95F4\u7C7B\u5B57\u6BB5",
              defaultSortOrder: "asc \u6216 desc\uFF0C\u4F18\u5148 desc",
              queryFields: [
                {
                  columnName: "\u5B57\u6BB5\u540D",
                  operator: "eq | like | between",
                  required: false,
                  requirementMode: "optional | required | one_of_group",
                  requiredGroup: "phone_or_id"
                }
              ],
              responseFieldNames: ["\u8FD4\u56DE\u5B57\u6BB5\u6570\u7EC4"],
              reasoning: ["\u63A8\u8350\u4F9D\u636E\u6570\u7EC4"]
            }
          })
        }
      ];
    }
    function parseServiceRecommendation(rawText = "", structure = {}) {
      const normalized = stripMarkdownFence(rawText);
      let parsed = {};
      try {
        parsed = JSON.parse(normalized);
      } catch (error) {
        throw new AppError(`AI \u670D\u52A1\u914D\u7F6E\u63A8\u8350\u7ED3\u679C\u89E3\u6790\u5931\u8D25: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
      }
      const availableColumns = new Set((structure.columns || []).map((item) => item.columnName));
      const responseFieldNames = Array.isArray(parsed.responseFieldNames) ? parsed.responseFieldNames.filter((item) => availableColumns.has(String(item || "").trim())).map((item) => String(item).trim()) : [];
      const queryFields = Array.isArray(parsed.queryFields) ? parsed.queryFields.map((item, index) => {
        const columnName = String(item?.columnName || "").trim();
        if (!availableColumns.has(columnName)) return null;
        return {
          columnName,
          operator: ["eq", "like", "between"].includes(String(item?.operator || "").trim().toLowerCase()) ? String(item.operator).trim().toLowerCase() : "eq",
          required: Boolean(item?.required),
          requirementMode: normalizeRequirementMode(item?.requirementMode, item?.required),
          requiredGroup: normalizeRequirementMode(item?.requirementMode, item?.required) === "one_of_group" ? normalizeText(item?.requiredGroup, `group_${index + 1}`) : null
        };
      }).filter(Boolean) : [];
      const fallbackResponseFieldNames = responseFieldNames.length ? responseFieldNames : (structure.columns || []).slice(0, 8).map((item) => item.columnName);
      const normalizedSortField = availableColumns.has(String(parsed.defaultSortField || "").trim()) ? String(parsed.defaultSortField || "").trim() : pickRecommendedSortField(structure.columns || []);
      const normalizedSortOrder = String(parsed.defaultSortOrder || "desc").trim().toLowerCase() === "asc" ? "asc" : "desc";
      return {
        serviceName: normalizeText(parsed.serviceName, ""),
        serviceCode: normalizeText(parsed.serviceCode, ""),
        servicePath: normalizeText(parsed.servicePath, ""),
        requestMethod: normalizeRequestMethod(parsed.requestMethod || "GET"),
        serviceType: normalizeServiceType(parsed.serviceType || "list"),
        description: normalizeText(parsed.description, ""),
        defaultSortField: normalizedSortField,
        defaultSortOrder: normalizedSortOrder,
        queryFields,
        responseFieldNames: fallbackResponseFieldNames,
        reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.map((item) => String(item || "").trim()).filter(Boolean) : []
      };
    }
    async function recommendServiceConfig(payload) {
      const dataSource = await ensureActiveDataSource(Number(payload.sourceId));
      const structure = await describeServiceColumns(dataSource, payload);
      const aiConfig = await getActiveServiceAiConfigByCode("service_config_recommendation");
      const provider = await resolveServiceRecommendationProvider(aiConfig);
      const completion = await modelProviderService.generateChatCompletion(
        provider,
        ensureJsonObjectPrompt(buildServiceRecommendationPrompt(payload, dataSource, structure, aiConfig), provider),
        {
          temperature: aiConfig?.temperature ?? 0.1,
          maxTokens: Number(aiConfig?.maxTokens || 1200),
          timeoutMs: Number(aiConfig?.timeoutMs || 12e4),
          responseFormat: { type: "json_object" }
        }
      );
      return {
        modelProviderId: provider.id,
        modelProviderName: provider.configName,
        modelName: provider.modelName,
        recommendation: parseServiceRecommendation(completion.content, structure)
      };
    }
    function generateAppToken() {
      return `svc_${crypto.randomBytes(18).toString("hex")}`;
    }
    function generateAppCode() {
      return `app_${crypto.randomBytes(6).toString("hex")}`;
    }
    async function createServiceApp(payload) {
      try {
        const normalizedAppCode = String(payload.appCode || "").trim() || generateAppCode();
        return await repository.createServiceApp({
          departmentName: String(payload.departmentName || "").trim() || null,
          appName: String(payload.appName || "").trim(),
          appCode: normalizedAppCode,
          appToken: String(payload.appToken || generateAppToken()).trim(),
          contactPhone: String(payload.contactPhone || "").trim() || null,
          appDescription: String(payload.appDescription || "").trim() || null,
          ownerName: String(payload.ownerName || "system").trim() || "system",
          status: String(payload.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active"
        });
      } catch (error) {
        throw new AppError(buildAppDuplicateErrorMessage(error, "\u521B\u5EFA\u5E94\u7528\u5931\u8D25"), error.statusCode || 400);
      }
    }
    async function updateServiceApp(id, payload) {
      const existing = await repository.getServiceAppById(id);
      if (!existing) {
        throw new AppError("\u5E94\u7528\u4E0D\u5B58\u5728", 404);
      }
      try {
        const normalizedAppCode = String(payload.appCode || "").trim() || existing.appCode || generateAppCode();
        return await repository.updateServiceApp(id, {
          departmentName: String(payload.departmentName || existing.departmentName || "").trim() || null,
          appName: String(payload.appName || "").trim(),
          appCode: normalizedAppCode,
          appToken: String(payload.appToken || existing.appToken || generateAppToken()).trim(),
          contactPhone: String(payload.contactPhone || existing.contactPhone || "").trim() || null,
          appDescription: String(payload.appDescription || existing.appDescription || "").trim() || null,
          ownerName: String(payload.ownerName || existing.ownerName || "system").trim() || "system",
          status: String(payload.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active"
        });
      } catch (error) {
        throw new AppError(buildAppDuplicateErrorMessage(error, "\u66F4\u65B0\u5E94\u7528\u5931\u8D25"), error.statusCode || 400);
      }
    }
    async function deleteServiceApp(id) {
      const existing = await repository.getServiceAppById(id);
      if (!existing) {
        throw new AppError("\u5E94\u7528\u4E0D\u5B58\u5728", 404);
      }
      const deleted = await repository.deleteServiceApp(id);
      if (!deleted) {
        throw new AppError("\u5E94\u7528\u4E0D\u5B58\u5728", 404);
      }
      return { id, deleted: true };
    }
    async function createAuthorization(payload) {
      const service = await repository.getServiceById(Number(payload.serviceId));
      if (!service) {
        throw new AppError("\u670D\u52A1\u4E0D\u5B58\u5728", 404);
      }
      const app = await repository.getServiceAppById(Number(payload.appId));
      if (!app) {
        throw new AppError("\u5E94\u7528\u4E0D\u5B58\u5728", 404);
      }
      try {
        return await repository.createAuthorization({
          serviceId: service.id,
          appId: app.id,
          status: String(payload.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active",
          rateLimitPerMinute: Math.max(0, Number(payload.rateLimitPerMinute || 0) || 0),
          dailyLimit: Math.max(0, Number(payload.dailyLimit || 0) || 0),
          ipWhitelist: normalizeIpList(payload.ipWhitelist)
        });
      } catch (error) {
        if (error?.code === "ER_DUP_ENTRY") {
          throw new AppError("\u8BE5\u5E94\u7528\u5DF2\u6388\u6743\u5F53\u524D\u670D\u52A1", 409);
        }
        throw new AppError("\u521B\u5EFA\u6388\u6743\u5931\u8D25", error.statusCode || 400);
      }
    }
    async function updateAuthorization(id, payload) {
      const existing = await repository.getAuthorizationById(id);
      if (!existing) {
        throw new AppError("\u6388\u6743\u4E0D\u5B58\u5728", 404);
      }
      const service = await repository.getServiceById(Number(payload.serviceId));
      if (!service) {
        throw new AppError("\u670D\u52A1\u4E0D\u5B58\u5728", 404);
      }
      const app = await repository.getServiceAppById(Number(payload.appId));
      if (!app) {
        throw new AppError("\u5E94\u7528\u4E0D\u5B58\u5728", 404);
      }
      try {
        return await repository.updateAuthorization(id, {
          serviceId: service.id,
          appId: app.id,
          status: String(payload.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active",
          rateLimitPerMinute: Math.max(0, Number(payload.rateLimitPerMinute || 0) || 0),
          dailyLimit: Math.max(0, Number(payload.dailyLimit || 0) || 0),
          ipWhitelist: normalizeIpList(payload.ipWhitelist)
        });
      } catch (error) {
        if (error?.code === "ER_DUP_ENTRY") {
          throw new AppError("\u8BE5\u5E94\u7528\u5DF2\u6388\u6743\u5F53\u524D\u670D\u52A1", 409);
        }
        throw new AppError("\u66F4\u65B0\u6388\u6743\u5931\u8D25", error.statusCode || 400);
      }
    }
    async function deleteAuthorization(id) {
      const existing = await repository.getAuthorizationById(id);
      if (!existing) {
        throw new AppError("\u6388\u6743\u4E0D\u5B58\u5728", 404);
      }
      const deleted = await repository.deleteAuthorization(id);
      if (!deleted) {
        throw new AppError("\u6388\u6743\u4E0D\u5B58\u5728", 404);
      }
      return { id, deleted: true };
    }
    function normalizeInterfaceBaseUrl(baseUrl = "") {
      const text = String(baseUrl || "").trim().replace(/\/+$/, "");
      return text || "";
    }
    function buildInterfaceRequestUrl(serviceApi, baseUrl = "") {
      const servicePath = String(serviceApi?.servicePath || "").trim();
      const prefix = normalizeInterfaceBaseUrl(baseUrl);
      return `${prefix || ""}/api/service${servicePath}`.replace(/([^:]\/)\/+/g, "$1");
    }
    function createDocParagraph(text, options = {}) {
      return new Paragraph({
        heading: options.heading,
        spacing: { before: options.before || 0, after: options.after || 80 },
        children: [
          new TextRun({
            text: String(text || ""),
            bold: Boolean(options.bold),
            size: options.size || 24
          })
        ]
      });
    }
    function createDocTable(headers, rows) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: headers.map((header) => new TableCell({
              children: [createDocParagraph(header, { bold: true, size: 22, after: 40 })]
            }))
          }),
          ...rows.map((row) => new TableRow({
            children: row.map((cell) => new TableCell({
              children: [createDocParagraph(cell, { size: 22, after: 40 })]
            }))
          }))
        ]
      });
    }
    function createDocCodeBlock(text) {
      return new Paragraph({
        spacing: { before: 40, after: 120 },
        children: [
          new TextRun({
            text: String(text || ""),
            size: 20,
            font: "Consolas"
          })
        ]
      });
    }
    function buildAuthDocInfo(serviceApi) {
      const authType = normalizeAuthType(serviceApi?.authType || "token");
      if (authType === "anonymous") {
        return {
          authType: "\u514D\u8BA4\u8BC1",
          authDescription: "\u5F53\u524D\u63A5\u53E3\u4E3A\u514D\u8BA4\u8BC1\u6A21\u5F0F\uFF0C\u8C03\u7528\u65F6\u4E0D\u9700\u8981\u643A\u5E26\u5E94\u7528\u8BBF\u95EE Token\u3002",
          headerExamples: [
            ["Authorization", "\u65E0"],
            ["X-App-Token", "\u65E0"]
          ],
          callNotes: [
            "\u53EF\u76F4\u63A5\u6309 URL \u4E0E\u53C2\u6570\u8C03\u7528\u63A5\u53E3\u3002",
            "\u5982\u540E\u7EED\u5207\u6362\u4E3A Token \u8BA4\u8BC1\uFF0C\u9700\u8981\u5728\u8BF7\u6C42\u5934\u4E2D\u8865\u5145\u5E94\u7528\u8BBF\u95EE Token\u3002"
          ]
        };
      }
      return {
        authType: "Token \u8BA4\u8BC1",
        authDescription: "\u5F53\u524D\u63A5\u53E3\u8981\u6C42\u643A\u5E26\u5E94\u7528\u8BBF\u95EE Token\u3002\u63A8\u8350\u4F18\u5148\u4F7F\u7528 X-App-Token\uFF0C\u4E5F\u517C\u5BB9 Authorization: Bearer <token>\u3002",
        headerExamples: [
          ["X-App-Token", "svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"],
          ["Authorization", "Bearer svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"]
        ],
        callNotes: [
          "\u4E0D\u8981\u628A token \u653E\u5728 query \u53C2\u6570\u91CC\uFF0C\u4F8B\u5982 ?token=... \u6216 ?Bearer=... \u5747\u4E0D\u4F1A\u88AB\u8BC6\u522B\u3002",
          "Token \u8BF7\u4F7F\u7528\u201C\u5E94\u7528\u7BA1\u7406\u201D\u91CC\u5206\u914D\u7ED9\u8C03\u7528\u65B9\u5E94\u7528\u7684\u8BBF\u95EE Token\u3002",
          "\u5982\u679C\u63A5\u53E3\u8FD4\u56DE 401/403\uFF0C\u8BF7\u4F18\u5148\u68C0\u67E5 Token \u662F\u5426\u6B63\u786E\u3001\u5E94\u7528\u662F\u5426\u5DF2\u6388\u6743\u3001\u670D\u52A1\u72B6\u6001\u662F\u5426\u5DF2\u53D1\u5E03\u3002"
        ]
      };
    }
    function sanitizeDocFileName(fileName = "") {
      return String(fileName || "service_interface_document").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    }
    function buildRequestExample(serviceApi, requestUrl) {
      const authInfo = buildAuthDocInfo(serviceApi);
      const filters = Array.isArray(serviceApi?.queryConfig?.filters) ? serviceApi.queryConfig.filters : [];
      const sampleParams = {};
      for (const filter of filters) {
        const dataType = String(filter?.dataType || "string").trim().toLowerCase();
        if (filter?.operator === "between") {
          sampleParams[filter.startParamName || `${filter.columnName}Start`] = guessExampleValueByDataType(dataType, filter.columnName);
          sampleParams[filter.endParamName || `${filter.columnName}End`] = guessExampleValueByDataType(dataType, filter.columnName);
          continue;
        }
        sampleParams[filter.paramName || filter.columnName] = guessExampleValueByDataType(dataType, filter.columnName);
      }
      const method = normalizeRequestMethod(serviceApi?.requestMethod || "GET");
      if (method === "GET") {
        const searchParams = new URLSearchParams();
        Object.entries(sampleParams).forEach(([key, value]) => searchParams.set(key, String(value)));
        const headerLines = authInfo.authType === "Token \u8BA4\u8BC1" ? [
          `  -H "X-App-Token: svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\`
        ] : [];
        return {
          method,
          url: `${requestUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
          body: null,
          headers: authInfo.authType === "Token \u8BA4\u8BC1" ? { "X-App-Token": "svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" } : {},
          curl: [
            `curl -X GET "${requestUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ""}" \\`,
            ...headerLines,
            `  -H "Accept: application/json"`
          ].join("\n")
        };
      }
      return {
        method,
        url: requestUrl,
        body: sampleParams,
        headers: authInfo.authType === "Token \u8BA4\u8BC1" ? {
          "Content-Type": "application/json",
          "X-App-Token": "svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        } : {
          "Content-Type": "application/json"
        },
        curl: [
          `curl -X POST "${requestUrl}" \\`,
          ...authInfo.authType === "Token \u8BA4\u8BC1" ? [`  -H "X-App-Token: svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\`] : [],
          `  -H "Content-Type: application/json" \\`,
          `  -d '${JSON.stringify(sampleParams, null, 2)}'`
        ].join("\n")
      };
    }
    function buildResponseExample(serviceApi) {
      const fields = Array.isArray(serviceApi?.responseConfig?.fields) ? serviceApi.responseConfig.fields : [];
      const row = {};
      for (const field of fields) {
        row[field.fieldName || field.columnName] = guessExampleValueByDataType(field.dataType, field.fieldName || field.columnName);
      }
      if ((serviceApi?.serviceType || "list") === "detail") {
        return {
          code: 0,
          message: "success",
          data: row,
          meta: {
            serviceCode: serviceApi?.serviceCode || "",
            returned: Object.keys(row).length ? 1 : 0
          }
        };
      }
      return {
        code: 0,
        message: "success",
        data: [row],
        meta: {
          serviceCode: serviceApi?.serviceCode || "",
          page: 1,
          pageSize: Number(serviceApi?.queryConfig?.defaultPageSize || 20),
          total: Object.keys(row).length ? 1 : 0,
          returned: Object.keys(row).length ? 1 : 0
        }
      };
    }
    async function exportServiceInterfaceDoc(id, options = {}) {
      const serviceApi = await repository.getServiceById(id);
      if (!serviceApi) {
        throw new AppError("\u670D\u52A1\u4E0D\u5B58\u5728", 404);
      }
      const requestUrl = buildInterfaceRequestUrl(serviceApi, options.baseUrl || "");
      const authInfo = buildAuthDocInfo(serviceApi);
      const requestExample = buildRequestExample(serviceApi, requestUrl);
      const responseExample = buildResponseExample(serviceApi);
      const requestParams = (serviceApi.queryConfig?.filters || []).map((item) => [
        String(item.label || item.columnName || "-"),
        String(item.paramName || item.startParamName || item.columnName || "-"),
        String(item.operator || "-"),
        item.requirementMode === "one_of_group" ? `\u7EC4\u5185\u81F3\u5C11\u4E00\u9879${item.requiredGroup ? ` (${item.requiredGroup})` : ""}` : item.required ? "\u662F" : "\u5426",
        String(item.dataType || "-")
      ]);
      const responseParams = (serviceApi.responseConfig?.fields || []).map((item) => [
        String(item.label || item.columnName || "-"),
        String(item.fieldName || item.columnName || "-"),
        String(item.dataType || "-")
      ]);
      const document = new Document({
        sections: [
          {
            children: [
              createDocParagraph(`${serviceApi.serviceName} \u63A5\u53E3\u8BF4\u660E`, { heading: HeadingLevel.HEADING_1, bold: true, size: 32, after: 120 }),
              createDocParagraph("\u4E00\u3001\u57FA\u7840\u4FE1\u606F", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 80 }),
              createDocTable(
                ["\u5B57\u6BB5", "\u5185\u5BB9"],
                [
                  ["\u670D\u52A1\u540D\u79F0", serviceApi.serviceName],
                  ["\u670D\u52A1\u7F16\u7801", serviceApi.serviceCode],
                  ["\u8C03\u7528\u65B9\u5F0F", serviceApi.requestMethod],
                  ["\u8BF7\u6C42\u5730\u5740", requestUrl],
                  ["\u8BA4\u8BC1\u65B9\u5F0F", authInfo.authType],
                  ["\u6570\u636E\u6E90 / \u6765\u6E90", serviceApi.serviceMode === "sql" ? `${serviceApi.sourceName || "-"} / SQL \u6A21\u5F0F` : `${serviceApi.sourceName || "-"} / ${serviceApi.sourceTable || "-"}`],
                  ["\u670D\u52A1\u8BF4\u660E", serviceApi.description || "-"]
                ]
              ),
              createDocParagraph("\u4E8C\u3001\u8BA4\u8BC1\u8BF4\u660E", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 }),
              createDocTable(
                ["\u5B57\u6BB5", "\u5185\u5BB9"],
                [
                  ["\u8BA4\u8BC1\u6A21\u5F0F", authInfo.authType],
                  ["\u8BA4\u8BC1\u8BF4\u660E", authInfo.authDescription]
                ]
              ),
              createDocParagraph("\u8BF7\u6C42\u5934\u793A\u4F8B", { bold: true, size: 22, before: 80 }),
              createDocTable(["Header", "\u793A\u4F8B\u503C"], authInfo.headerExamples),
              createDocParagraph("\u8C03\u7528\u6CE8\u610F\u4E8B\u9879", { bold: true, size: 22, before: 80 }),
              ...authInfo.callNotes.map((item) => createDocParagraph(`- ${item}`, { size: 22, after: 30 })),
              createDocParagraph("\u4E09\u3001\u8BF7\u6C42\u53C2\u6570", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 }),
              requestParams.length > 0 ? createDocTable(["\u53C2\u6570\u8BF4\u660E", "\u53C2\u6570\u540D", "\u67E5\u8BE2\u65B9\u5F0F", "\u5FC5\u586B", "\u7C7B\u578B"], requestParams) : createDocParagraph("\u5F53\u524D\u63A5\u53E3\u65E0\u5165\u53C2\u3002", { size: 22 }),
              createDocParagraph("\u56DB\u3001\u8BF7\u6C42\u793A\u4F8B", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 }),
              createDocTable(
                ["\u5B57\u6BB5", "\u5185\u5BB9"],
                [
                  ["\u8BF7\u6C42\u65B9\u5F0F", requestExample.method],
                  ["\u8BF7\u6C42\u5730\u5740", requestExample.url],
                  ["\u8BF7\u6C42\u5934", requestExample.headers && Object.keys(requestExample.headers).length ? JSON.stringify(requestExample.headers, null, 2) : "\u65E0"],
                  ["\u8BF7\u6C42\u4F53", requestExample.body ? JSON.stringify(requestExample.body, null, 2) : "\u65E0"]
                ]
              ),
              createDocParagraph("curl \u793A\u4F8B", { bold: true, size: 22, before: 80 }),
              createDocCodeBlock(requestExample.curl),
              serviceApi.serviceMode === "sql" && serviceApi.sourceSql ? createDocParagraph("\u4E94\u3001SQL \u6765\u6E90\u8BF4\u660E", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 }) : createDocParagraph("\u4E94\u3001\u54CD\u5E94\u5B57\u6BB5", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 }),
              serviceApi.serviceMode === "sql" && serviceApi.sourceSql ? createDocCodeBlock(serviceApi.sourceSql) : createDocParagraph(""),
              createDocParagraph(serviceApi.serviceMode === "sql" && serviceApi.sourceSql ? "\u516D\u3001\u54CD\u5E94\u5B57\u6BB5" : "\u4E94\u3001\u54CD\u5E94\u5B57\u6BB5", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 }),
              responseParams.length > 0 ? createDocTable(["\u5B57\u6BB5\u8BF4\u660E", "\u8FD4\u56DE\u5B57\u6BB5", "\u7C7B\u578B"], responseParams) : createDocParagraph("\u5F53\u524D\u63A5\u53E3\u65E0\u51FA\u53C2\u5B9A\u4E49\u3002", { size: 22 }),
              createDocParagraph(serviceApi.serviceMode === "sql" && serviceApi.sourceSql ? "\u4E03\u3001\u8FD4\u56DE\u793A\u4F8B" : "\u516D\u3001\u8FD4\u56DE\u793A\u4F8B", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 }),
              createDocCodeBlock(JSON.stringify(responseExample, null, 2))
            ]
          }
        ]
      });
      return {
        fileName: `${sanitizeDocFileName(serviceApi.serviceCode || serviceApi.serviceName)}_api_doc.docx`,
        buffer: await Packer.toBuffer(document),
        service: serviceApi
      };
    }
    async function withServiceConnection(dataSource, handler) {
      const resolved = resolveDatasourceConnection(dataSource?.sourceType, dataSource?.connectionConfig || {});
      if (["mysql", "postgresql", "oracle", "dm"].includes(resolved.dialect) && getManagedBinding(resolved.dialect)) {
        const adapter = getAdapter(resolved.dialect);
        const runtimeConfig = {
          ...dataSource.connectionConfig || {},
          sourceType: resolved.dialect,
          databaseName: resolved.database
        };
        const managedConnection = {
          async query(sql, params = []) {
            const result = await adapter.executeQuery(runtimeConfig, sql, { binds: params });
            return { rows: result.rows || [], fields: (result.fields || []).map((name) => ({ name })) };
          },
          async execute(sql, params = []) {
            const result = await adapter.executeQuery(runtimeConfig, sql, { binds: params });
            return [result.rows || [], (result.fields || []).map((name) => ({ name }))];
          }
        };
        return handler(managedConnection, resolved.dialect);
      }
      if (resolved.dialect === "mysql") {
        const connection = await mysql.createConnection({
          host: resolved.host,
          port: resolved.port,
          database: resolved.database,
          user: resolved.username,
          password: resolved.password,
          connectTimeout: 5e3
        });
        try {
          return await handler(connection, "mysql");
        } finally {
          await connection.end();
        }
      }
      if (resolved.dialect === "postgresql") {
        const client = createPostgresLikeClient({
          host: resolved.host,
          port: resolved.port,
          database: resolved.database,
          user: resolved.username,
          username: resolved.username,
          password: resolved.password,
          connectionTimeoutMillis: 5e3
        }, {
          sourceType: dataSource?.sourceType
        });
        await client.connect();
        try {
          return await handler(client, "postgresql");
        } finally {
          await client.end();
        }
      }
      if (["oracle", "dm"].includes(resolved.dialect)) {
        const adapter = getAdapter(resolved.dialect);
        const runtimeConfig = {
          ...dataSource.connectionConfig || {},
          sourceType: resolved.dialect,
          databaseName: resolved.database
        };
        return handler({
          async query(sql, params = []) {
            const result = await adapter.executeQuery(runtimeConfig, sql, { binds: params });
            return { rows: result.rows || [], fields: (result.fields || []).map((name) => ({ name })) };
          }
        }, resolved.dialect);
      }
      throw new AppError("\u5F53\u524D\u6570\u636E\u6E90\u7C7B\u578B\u4E0D\u652F\u6301\u8FD0\u884C\u670D\u52A1", 400);
    }
    async function executeQuery(connection, dialect, sql, params = []) {
      if (dialect === "mysql") {
        const [rows] = await connection.execute(sql, params);
        return rows;
      }
      const result = await connection.query(sql, params);
      return result.rows;
    }
    async function executeServiceQuery(serviceApi, dataSource, runtimeInput) {
      const sqlBundle = buildServiceSql(serviceApi, dataSource, runtimeInput);
      return withServiceConnection(dataSource, async (connection, dialect) => {
        const rows = await executeQuery(connection, dialect, sqlBundle.dataSql, sqlBundle.dataParams);
        let total = Array.isArray(rows) ? rows.length : 0;
        if (sqlBundle.countSql) {
          const countRows = await executeQuery(connection, dialect, sqlBundle.countSql, sqlBundle.countParams);
          total = Number(countRows[0]?.total || countRows[0]?.TOTAL || 0);
        }
        if (sqlBundle.meta.serviceType === "detail") {
          return {
            data: rows[0] || null,
            meta: {
              ...sqlBundle.meta,
              total: rows[0] ? 1 : 0,
              returned: rows[0] ? 1 : 0
            }
          };
        }
        return {
          data: rows,
          meta: {
            ...sqlBundle.meta,
            total,
            returned: rows.length
          }
        };
      });
    }
    async function debugService(id, runtimeInput = {}) {
      const serviceApi = await repository.getServiceById(id);
      if (!serviceApi) {
        throw new AppError("\u670D\u52A1\u4E0D\u5B58\u5728", 404);
      }
      const dataSource = await ensureActiveDataSource(serviceApi.sourceId);
      return executeServiceQuery(serviceApi, dataSource, runtimeInput);
    }
    async function inspectServiceJob(id, context = {}) {
      const serviceApi = await repository.getServiceById(id);
      if (!serviceApi || serviceApi.status !== "published") {
        throw new AppError("\u670D\u52A1\u4E0D\u5B58\u5728\u6216\u672A\u53D1\u5E03", 404);
      }
      await validateAuthorization(serviceApi, context, { forceToken: true });
      const recentLogs = await repository.listServiceLogs({ serviceId: serviceApi.id, limit: 20 });
      return {
        id: String(serviceApi.id),
        job_id: String(serviceApi.id),
        status: serviceApi.status,
        logs: recentLogs.map(
          (item) => `${item.calledAt || item.createdAt || ""} ${item.responseStatus || "unknown"}`.trim()
        )
      };
    }
    function extractAppToken(headers = {}) {
      const authorization = String(headers.authorization || headers.Authorization || "").trim();
      if (authorization.toLowerCase().startsWith("bearer ")) {
        return authorization.slice(7).trim();
      }
      return String(headers["x-app-token"] || headers["X-App-Token"] || headers["app-token"] || "").trim();
    }
    function extractClientIp(context = {}) {
      const requestIp = String(context.req?.ip || context.ip || "").trim();
      if (requestIp) {
        return requestIp;
      }
      const forwarded = String(context.headers?.["x-forwarded-for"] || "").trim();
      return forwarded ? forwarded.split(",")[0].trim() : "unknown";
    }
    async function validateAuthorization(serviceApi, context, options = {}) {
      if (serviceApi.authType === "anonymous" && options.forceToken !== true) {
        return { app: null, authorization: null };
      }
      function buildAppBoundError(message, statusCode, app2) {
        const error = new AppError(message, statusCode);
        error.app = app2 || null;
        return error;
      }
      const appToken = extractAppToken(context.headers || {});
      if (!appToken) {
        throw new AppError("\u7F3A\u5C11\u5E94\u7528\u8BBF\u95EE Token", 401);
      }
      const app = await repository.findServiceAppByToken(appToken);
      if (!app || app.status !== "active") {
        throw new AppError("\u670D\u52A1\u8BBF\u95EE Token \u65E0\u6548", 401);
      }
      const authorization = await repository.findAuthorization(serviceApi.id, app.id);
      if (!authorization || authorization.status !== "active") {
        throw buildAppBoundError("\u5F53\u524D\u5E94\u7528\u672A\u6388\u6743\u8BBF\u95EE\u8BE5\u670D\u52A1", 403, app);
      }
      const clientIp = extractClientIp(context);
      if (!isIpAllowed(clientIp, authorization.ipWhitelist)) {
        throw buildAppBoundError("\u5F53\u524D IP \u4E0D\u5728\u670D\u52A1\u767D\u540D\u5355\u5185", 403, app);
      }
      const now = /* @__PURE__ */ new Date();
      if (authorization.rateLimitPerMinute > 0) {
        const minuteStart = new Date(now.getTime() - 60 * 1e3);
        const minuteCalls = await repository.countCallsSince(serviceApi.id, app.id, minuteStart);
        if (minuteCalls >= authorization.rateLimitPerMinute) {
          throw buildAppBoundError("\u670D\u52A1\u8C03\u7528\u5DF2\u8FBE\u5230\u5206\u949F\u9650\u6D41\u9608\u503C", 429, app);
        }
      }
      if (authorization.dailyLimit > 0) {
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayCalls = await repository.countCallsSince(serviceApi.id, app.id, dayStart);
        if (dayCalls >= authorization.dailyLimit) {
          throw buildAppBoundError("\u670D\u52A1\u8C03\u7528\u5DF2\u8FBE\u5230\u65E5\u8C03\u7528\u4E0A\u9650", 429, app);
        }
      }
      return { app, authorization };
    }
    async function safeRecordServiceCall(payload) {
      try {
        await repository.recordServiceCall(payload);
      } catch (error) {
        console.error("[data-services] recordServiceCall failed:", error.message);
      }
    }
    async function invokeService(method, servicePath, runtimeInput = {}, context = {}) {
      const normalizedMethod = normalizeRequestMethod(method);
      const normalizedPath = normalizeServicePath(servicePath);
      const serviceApi = await repository.findPublishedServiceByPath(normalizedMethod, normalizedPath);
      if (!serviceApi) {
        throw new AppError("\u670D\u52A1\u4E0D\u5B58\u5728\u6216\u672A\u53D1\u5E03", 404);
      }
      const startedAt = Date.now();
      const clientIp = extractClientIp(context);
      let app = null;
      try {
        const authContext = await validateAuthorization(serviceApi, context);
        app = authContext.app;
        const dataSource = await ensureActiveDataSource(serviceApi.sourceId);
        const result = await executeServiceQuery(serviceApi, dataSource, runtimeInput);
        await safeRecordServiceCall({
          projectId: serviceApi.projectId || null,
          serviceId: serviceApi.id,
          appId: app?.id || null,
          serviceCode: serviceApi.serviceCode,
          servicePath: serviceApi.servicePath,
          requestMethod: serviceApi.requestMethod,
          authType: serviceApi.authType,
          requestParams: sanitizeRequestParams(runtimeInput),
          responseStatus: "success",
          success: true,
          httpStatus: 200,
          latencyMs: Date.now() - startedAt,
          clientIp,
          errorMessage: null
        });
        return {
          service: {
            id: serviceApi.id,
            serviceName: serviceApi.serviceName,
            serviceCode: serviceApi.serviceCode
          },
          app: app ? { id: app.id, appName: app.appName, appCode: app.appCode } : null,
          ...result
        };
      } catch (error) {
        app = error?.app || app;
        await safeRecordServiceCall({
          projectId: serviceApi.projectId || null,
          serviceId: serviceApi.id,
          appId: app?.id || null,
          serviceCode: serviceApi.serviceCode,
          servicePath: serviceApi.servicePath,
          requestMethod: serviceApi.requestMethod,
          authType: serviceApi.authType,
          requestParams: sanitizeRequestParams(runtimeInput),
          responseStatus: "failed",
          success: false,
          httpStatus: error.statusCode || 500,
          latencyMs: Date.now() - startedAt,
          clientIp,
          errorMessage: error.message
        });
        throw error;
      }
    }
    module2.exports = {
      createAuthorization,
      createService,
      createServiceApp,
      createServiceDataSource,
      deleteAuthorization,
      deleteService,
      deleteServiceDataSource,
      deleteServiceApp,
      debugService,
      exportServiceInterfaceDoc,
      getOverview,
      getOpsDashboard,
      getActiveServiceAiConfigByCode,
      invokeService,
      inspectServiceJob,
      listAuthorizations,
      listServiceAiConfigs,
      listServiceDataSourceColumns,
      listServiceDataSources,
      listServiceDataSourceTables,
      listServiceApps,
      listServiceLogs,
      listServices,
      previewServiceSql,
      recommendServiceConfig,
      sampleServiceDataSourceRows,
      testServiceDataSourceConnection,
      updateAuthorization,
      updateServiceAiConfig,
      updateServiceStatus,
      updateService,
      updateServiceApp,
      updateServiceDataSource
    };
  }
});

// backend/src/common/utils/user-permissions.js
var require_user_permissions = __commonJS({
  "backend/src/common/utils/user-permissions.js"(exports2, module2) {
    function parseJsonObject(value) {
      if (!value) {
        return {};
      }
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch {
          return {};
        }
      }
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }
    function normalizePermissions(permissions) {
      const parsed = parseJsonObject(permissions);
      const modules = Array.isArray(parsed.modules) ? parsed.modules.filter(Boolean) : [];
      const normalizedModules = modules.map((moduleName) => moduleName === "lab" ? "data_modeling" : moduleName);
      return {
        modules: Array.from(new Set(normalizedModules)),
        mode: parsed.mode === "readonly" ? "readonly" : void 0,
        actions: Array.isArray(parsed.actions) ? parsed.actions.filter(Boolean) : void 0
      };
    }
    function normalizeRolePermissions(role) {
      const permissions = normalizePermissions(role?.permissions);
      const roleCode = String(role?.roleCode || "").toLowerCase();
      const roleType = String(role?.roleType || "").toLowerCase();
      if (roleCode === "viewer" || roleType === "viewer") {
        return {
          ...permissions,
          mode: "readonly",
          actions: ["read"]
        };
      }
      return permissions;
    }
    function isReadOnlyUser(user) {
      const permissions = normalizeRolePermissions(user);
      const roleCode = String(user?.roleCode || "").toLowerCase();
      const roleType = String(user?.roleType || "").toLowerCase();
      return roleCode === "viewer" || roleType === "viewer" || permissions.mode === "readonly";
    }
    function hasAnyModulePermission(user, requiredModules) {
      const required = Array.isArray(requiredModules) ? requiredModules.filter(Boolean) : [requiredModules].filter(Boolean);
      if (required.length === 0) {
        return true;
      }
      const modules = new Set(normalizeRolePermissions(user).modules || []);
      return required.some((moduleName) => modules.has(moduleName));
    }
    function getRequiredModulesForApiPath(pathname) {
      const path = String(pathname || "").split("?")[0];
      if (!path.startsWith("/api/")) return [];
      if (path === "/api/auth/profile" || path.startsWith("/api/v1/auth/")) return [];
      if (path === "/api/v1/projects/my") return [];
      const rules = [
        ["/api/v1/projects", ["system_projects"]],
        ["/api/v1/platform", ["overview"]],
        ["/api/v1/asset-search", ["data_map", "ingestion", "quality", "services"]],
        ["/api/v1/data-map", ["data_map"]],
        ["/api/v1/data-standards", ["standards"]],
        ["/api/v1/data-sources", ["ingestion"]],
        ["/api/v1/data-source-research", ["ingestion"]],
        ["/api/v1/ingestion-tasks", ["ingestion"]],
        ["/api/v1/file-imports", ["ingestion"]],
        ["/api/v1/ingestion-ai-configs", ["ingestion"]],
        ["/api/v1/data-modeling-sources", ["data_modeling"]],
        ["/api/v1/data-development", ["ingestion"]],
        ["/api/v1/data-modeling", ["data_modeling"]],
        ["/api/v1/quality-control", ["quality"]],
        ["/api/v1/data-services", ["services"]],
        ["/api/v1/reporting-ai-configs", ["reporting"]],
        ["/api/v1/reporting", ["reporting"]],
        ["/api/v1/dev-ai-configs", ["ingestion"]],
        ["/api/v1/model-providers", ["system_models", "data_map", "standards", "ingestion", "quality", "processing", "services", "reporting", "data_modeling"]]
      ];
      if (path.startsWith("/api/v1/system-management/services")) return ["system_services"];
      if (path.startsWith("/api/v1/system-management/database-drivers")) return ["system_services"];
      if (path.startsWith("/api/v1/system-management/roles")) return ["system_roles"];
      if (path.startsWith("/api/v1/system-management/users")) return ["system_users"];
      if (path.startsWith("/api/v1/system-management/resources")) return ["system_services", "system_users", "system_roles", "system_models"];
      if (path.startsWith("/api/v1/system-management/database-architecture")) return ["system_services"];
      const matched = rules.find(([prefix]) => path.startsWith(prefix));
      return matched ? matched[1] : [];
    }
    var READ_ONLY_ALLOWED_WRITES = [
      /^\/api\/v1\/auth\/logout$/,
      /^\/api\/auth\/logout$/,
      /^\/api\/v1\/asset-search\/search$/,
      /^\/api\/v1\/asset-search\/business-data\/search$/,
      /^\/api\/v1\/data-development\/processing\/jobs\/preview$/,
      /^\/api\/v1\/data-development\/processing\/jobs\/\d+\/preview$/,
      /^\/api\/v1\/reporting\/datasets\/preview$/,
      /^\/api\/v1\/reporting\/dashboards\/preview-chart$/,
      /^\/api\/v1\/reporting\/runtime\/dashboards\/\d+\/preview-chart$/
    ];
    function isReadOnlyAllowedRequest(method, pathname) {
      const normalizedMethod = String(method || "GET").toUpperCase();
      if (["GET", "HEAD", "OPTIONS"].includes(normalizedMethod)) {
        return true;
      }
      const path = String(pathname || "").split("?")[0];
      return READ_ONLY_ALLOWED_WRITES.some((pattern) => pattern.test(path));
    }
    module2.exports = {
      getRequiredModulesForApiPath,
      hasAnyModulePermission,
      isReadOnlyAllowedRequest,
      isReadOnlyUser,
      normalizePermissions,
      normalizeRolePermissions
    };
  }
});

// backend/src/modules/auth/auth.repository.js
var require_auth_repository = __commonJS({
  "backend/src/modules/auth/auth.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var { normalizeRolePermissions } = require_user_permissions();
    function mapUser(row) {
      return {
        id: row.id,
        username: row.username,
        passwordHash: row.passwordHash,
        displayName: row.displayName,
        roleId: row.roleId || null,
        roleCode: row.roleCode,
        roleType: row.roleType || null,
        roleName: row.roleName || null,
        defaultProjectId: row.defaultProjectId ? Number(row.defaultProjectId) : null,
        permissions: normalizeRolePermissions({
          roleCode: row.roleCode,
          roleType: row.roleType,
          permissions: row.permissions
        }),
        status: row.status
      };
    }
    async function findByUsername(username) {
      const [rows] = await pool.query(
        `SELECT u.id, u.username, u.password_hash AS passwordHash, u.display_name AS displayName,
            u.role_id AS roleId, COALESCE(r.role_code, u.role_code) AS roleCode,
            u.default_project_id AS defaultProjectId,
            r.role_type AS roleType, r.role_name AS roleName, r.permissions_json AS permissions, u.status
     FROM users u
     LEFT JOIN system_roles r ON u.role_id = r.id OR (u.role_id IS NULL AND u.role_code = r.role_code)
     WHERE u.username = ? LIMIT 1`,
        [username]
      );
      return rows[0] ? mapUser(rows[0]) : null;
    }
    async function findProfileById(id) {
      const [rows] = await pool.query(
        `SELECT u.id, u.username, u.display_name AS displayName, u.role_id AS roleId,
            COALESCE(r.role_code, u.role_code) AS roleCode,
            u.default_project_id AS defaultProjectId,
            r.role_type AS roleType, r.role_name AS roleName, r.permissions_json AS permissions, u.status
     FROM users u
     LEFT JOIN system_roles r ON u.role_id = r.id OR (u.role_id IS NULL AND u.role_code = r.role_code)
     WHERE u.id = ? LIMIT 1`,
        [id]
      );
      return rows[0] ? mapUser(rows[0]) : null;
    }
    module2.exports = {
      findByUsername,
      findProfileById
    };
  }
});

// backend/src/modules/auth/auth-session.repository.js
var require_auth_session_repository = __commonJS({
  "backend/src/modules/auth/auth-session.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var ACTIVE_STATUS = "active";
    var SESSION_IDLE_TIMEOUT_SECONDS = 30 * 60;
    function getExecutor(executor) {
      return executor || pool;
    }
    async function expireStaleSessions(executor) {
      await getExecutor(executor).query(
        `UPDATE auth_sessions
     SET status = 'expired'
     WHERE status = ?
       AND (
         expires_at <= NOW()
         OR last_seen_at < DATE_SUB(NOW(), INTERVAL ? SECOND)
       )`,
        [ACTIVE_STATUS, SESSION_IDLE_TIMEOUT_SECONDS]
      );
    }
    async function countActiveSessions(executor) {
      const db = getExecutor(executor);
      await expireStaleSessions(db);
      const [rows] = await db.query(
        `SELECT COUNT(*) AS total
     FROM auth_sessions
     WHERE status = ?`,
        [ACTIVE_STATUS]
      );
      return Number(rows[0]?.total || 0);
    }
    async function countActiveSessionsForUser(userId, executor) {
      const db = getExecutor(executor);
      await expireStaleSessions(db);
      const [rows] = await db.query(
        `SELECT COUNT(*) AS total
     FROM auth_sessions
     WHERE status = ?
       AND user_id = ?`,
        [ACTIVE_STATUS, userId]
      );
      return Number(rows[0]?.total || 0);
    }
    async function createSession(session, executor) {
      await getExecutor(executor).query(
        `INSERT INTO auth_sessions
      (id, user_id, username, status, issued_at, expires_at, last_seen_at, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.userId,
          session.username,
          ACTIVE_STATUS,
          session.issuedAt,
          session.expiresAt,
          session.issuedAt,
          session.userAgent || null,
          session.ipAddress || null
        ]
      );
    }
    async function findActiveSession(sessionId, executor) {
      if (!sessionId) {
        return null;
      }
      const db = getExecutor(executor);
      await expireStaleSessions(db);
      const [rows] = await db.query(
        `SELECT id, user_id AS userId, username, status, issued_at AS issuedAt,
            expires_at AS expiresAt, last_seen_at AS lastSeenAt
     FROM auth_sessions
     WHERE id = ?
       AND status = ?
     LIMIT 1`,
        [sessionId, ACTIVE_STATUS]
      );
      return rows[0] || null;
    }
    async function touchSession(sessionId, executor) {
      await getExecutor(executor).query(
        `UPDATE auth_sessions
     SET last_seen_at = NOW()
     WHERE id = ?
       AND status = ?`,
        [sessionId, ACTIVE_STATUS]
      );
    }
    async function revokeSession(sessionId, executor) {
      if (!sessionId) {
        return;
      }
      await getExecutor(executor).query(
        `UPDATE auth_sessions
     SET status = 'revoked',
         revoked_at = NOW()
     WHERE id = ?
       AND status = ?`,
        [sessionId, ACTIVE_STATUS]
      );
    }
    async function revokeActiveSessionsForUser(userId, executor) {
      if (!userId) {
        return 0;
      }
      const [result] = await getExecutor(executor).query(
        `UPDATE auth_sessions
     SET status = 'revoked',
         revoked_at = NOW()
     WHERE user_id = ?
       AND status = ?`,
        [userId, ACTIVE_STATUS]
      );
      return Number(result?.affectedRows || 0);
    }
    async function listOldestActiveSessions(limit, executor) {
      const normalizedLimit = Number(limit || 0);
      if (!Number.isInteger(normalizedLimit) || normalizedLimit <= 0) {
        return [];
      }
      const db = getExecutor(executor);
      await expireStaleSessions(db);
      const [rows] = await db.query(
        `SELECT id, user_id AS userId, username, issued_at AS issuedAt, last_seen_at AS lastSeenAt
     FROM auth_sessions
     WHERE status = ?
     ORDER BY last_seen_at ASC, issued_at ASC, created_at ASC
     LIMIT ?`,
        [ACTIVE_STATUS, normalizedLimit]
      );
      return rows;
    }
    async function revokeSessionsByIds(sessionIds, executor) {
      const normalizedIds = Array.from(new Set((sessionIds || []).filter(Boolean)));
      if (normalizedIds.length === 0) {
        return 0;
      }
      const placeholders = normalizedIds.map(() => "?").join(", ");
      const [result] = await getExecutor(executor).query(
        `UPDATE auth_sessions
     SET status = 'revoked',
         revoked_at = NOW()
     WHERE status = ?
       AND id IN (${placeholders})`,
        [ACTIVE_STATUS, ...normalizedIds]
      );
      return Number(result?.affectedRows || 0);
    }
    module2.exports = {
      countActiveSessions,
      countActiveSessionsForUser,
      createSession,
      findActiveSession,
      touchSession,
      revokeSession,
      revokeActiveSessionsForUser,
      listOldestActiveSessions,
      revokeSessionsByIds,
      expireStaleSessions
    };
  }
});

// backend/src/modules/auth/auth.service.js
var require_auth_service = __commonJS({
  "backend/src/modules/auth/auth.service.js"(exports2, module2) {
    var bcrypt = require("bcryptjs");
    var crypto = require("crypto");
    var jwt = require("jsonwebtoken");
    var AppError = require_app_error();
    var { pool } = require_database();
    var env = require_config();
    var authRepository = require_auth_repository();
    var sessionRepository = require_auth_session_repository();
    function toAuthUser(user) {
      return {
        id: user.id,
        sub: user.id,
        username: user.username,
        displayName: user.displayName,
        roleId: user.roleId || null,
        roleCode: user.roleCode,
        roleType: user.roleType || null,
        roleName: user.roleName || user.roleCode,
        defaultProjectId: user.defaultProjectId || null,
        permissions: user.permissions || { modules: [] }
      };
    }
    async function enforceConcurrentLimit() {
      return;
    }
    async function login(payload, context = {}) {
      const user = await authRepository.findByUsername(payload.username);
      if (!user || user.status !== "active") {
        throw new AppError("\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF", 401);
      }
      const isMatched = await bcrypt.compare(payload.password, user.passwordHash);
      if (!isMatched) {
        throw new AppError("\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF", 401);
      }
      const authUser = toAuthUser(user);
      const connection = await pool.getConnection();
      const sessionId = crypto.randomUUID();
      const token = jwt.sign(
        {
          sub: authUser.id,
          sessionId,
          username: authUser.username,
          displayName: authUser.displayName,
          roleId: authUser.roleId,
          roleCode: authUser.roleCode,
          roleType: authUser.roleType,
          roleName: authUser.roleName,
          permissions: authUser.permissions
        },
        env.jwtSecret,
        { expiresIn: env.jwtExpiresIn }
      );
      const decoded = jwt.decode(token);
      const issuedAt = decoded?.iat ? new Date(decoded.iat * 1e3) : /* @__PURE__ */ new Date();
      const expiresAt = decoded?.exp ? new Date(decoded.exp * 1e3) : new Date(Date.now() + 8 * 60 * 60 * 1e3);
      try {
        await connection.beginTransaction();
        await enforceConcurrentLimit(authUser.id, connection);
        await sessionRepository.createSession({
          id: sessionId,
          userId: authUser.id,
          username: authUser.username,
          issuedAt,
          expiresAt,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress
        }, connection);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return {
        token,
        user: authUser
      };
    }
    async function getProfile(userId) {
      const user = await authRepository.findProfileById(userId);
      if (!user || user.status !== "active") {
        throw new AppError("\u7528\u6237\u4E0D\u5B58\u5728\u6216\u5DF2\u505C\u7528", 401);
      }
      return {
        user: toAuthUser(user)
      };
    }
    async function logout(user) {
      await sessionRepository.revokeSession(user?.sessionId);
      return { success: true };
    }
    async function logoutByToken(token) {
      if (!token) {
        return { success: true };
      }
      try {
        const user = jwt.verify(token, env.jwtSecret);
        await sessionRepository.revokeSession(user?.sessionId);
      } catch {
        return { success: true };
      }
      return { success: true };
    }
    module2.exports = {
      login,
      getProfile,
      logout,
      logoutByToken
    };
  }
});

// backend/src/modules/auth/auth.controller.js
var require_auth_controller = __commonJS({
  "backend/src/modules/auth/auth.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var authService = require_auth_service();
    async function login(req, res) {
      const result = await authService.login(req.validatedBody, {
        userAgent: req.headers["user-agent"] || "",
        ipAddress: req.ip || req.socket?.remoteAddress || ""
      });
      return sendSuccess(res, result);
    }
    async function profile(req, res) {
      const result = await authService.getProfile(req.user.sub);
      return sendSuccess(res, result);
    }
    async function logout(req, res) {
      const result = await authService.logout(req.user);
      return sendSuccess(res, result);
    }
    async function logoutBeacon(req, res) {
      const token = req.body?.token || "";
      const result = await authService.logoutByToken(token);
      return sendSuccess(res, result);
    }
    module2.exports = {
      login,
      profile,
      logout,
      logoutBeacon
    };
  }
});

// backend/src/modules/reporting/reporting.repository.js
var require_reporting_repository = __commonJS({
  "backend/src/modules/reporting/reporting.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var { getCurrentProjectId } = require_project_context();
    function getScopedWhere(alias, options = {}) {
      const projectId = getCurrentProjectId();
      if (!projectId) {
        return { sql: "", params: [], projectId: null };
      }
      const prefix = alias ? `${alias}.` : "";
      const sql = options.includeBuiltin ? `(${prefix}project_id = ? OR ${prefix}is_builtin = 1)` : `${prefix}project_id = ?`;
      return { sql, params: [projectId], projectId };
    }
    function parseJsonField(value, fallback) {
      if (value === null || value === void 0 || value === "") {
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
    function mapDataSourceRow(row) {
      return {
        id: Number(row.id),
        sourceName: row.sourceName,
        sourceCode: row.sourceCode,
        sourceType: row.sourceType,
        connectionConfig: parseJsonField(row.connectionConfig, {}),
        ownerName: row.ownerName || "system",
        status: row.status || "active",
        datasetCount: Number(row.datasetCount || 0),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapDatasetFolderRow(row) {
      return {
        id: Number(row.id),
        folderName: row.folderName,
        parentId: row.parentId === null ? null : Number(row.parentId),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapDatasetRow(row) {
      return {
        id: Number(row.id),
        datasetName: row.datasetName,
        datasetCode: row.datasetCode,
        sourceId: Number(row.sourceId),
        folderId: row.folderId === null ? null : Number(row.folderId),
        sourceName: row.sourceName || null,
        sourceType: row.sourceType || null,
        folderName: row.folderName || null,
        datasetType: row.datasetType || "table",
        sourceTable: row.sourceTable || null,
        sourceSql: row.sourceSql || null,
        fields: parseJsonField(row.fields, []),
        queryConfig: parseJsonField(row.queryConfig, {}),
        cacheConfig: parseJsonField(row.cacheConfig, {}),
        ownerName: row.ownerName || "system",
        status: row.status || "draft",
        description: row.description || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapChartAssetRow(row) {
      return {
        id: Number(row.id),
        chartName: row.chartName,
        chartCode: row.chartCode,
        chartType: row.chartType || "echarts",
        category: row.category || "custom",
        chartFamily: row.chartFamily || row.category || "custom",
        variantName: row.variantName || row.chartName,
        renderMode: row.renderMode || "dataset",
        coverImageUrl: row.coverImageUrl || null,
        description: row.description || null,
        tags: parseJsonField(row.tags, []),
        config: parseJsonField(row.config, {}),
        optionTemplate: parseJsonField(row.optionTemplate, {}),
        mappingSchema: parseJsonField(row.mappingSchema, {}),
        ownerName: row.ownerName || "system",
        status: row.status || "draft",
        isBuiltin: Boolean(row.isBuiltin),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapWidgetRow(row) {
      return {
        id: Number(row.id),
        widgetKey: row.widgetKey,
        widgetName: row.widgetName,
        widgetType: row.widgetType,
        datasetId: row.datasetId == null ? null : Number(row.datasetId),
        chartAssetId: row.chartAssetId == null ? null : Number(row.chartAssetId),
        position: parseJsonField(row.position, {}),
        props: parseJsonField(row.props, {}),
        queryParams: parseJsonField(row.queryParams, {})
      };
    }
    function mapDashboardRow(row, widgets = []) {
      return {
        id: Number(row.id),
        dashboardName: row.dashboardName,
        dashboardCode: row.dashboardCode,
        layoutMode: row.layoutMode || "grid",
        themeTemplateId: row.themeTemplateId == null ? null : Number(row.themeTemplateId),
        themeSettings: parseJsonField(row.themeSettings, {}),
        themeConfig: parseJsonField(row.themeConfig, {}),
        filterConfig: parseJsonField(row.filterConfig, {}),
        canvasConfig: parseJsonField(row.canvasConfig, {}),
        ownerName: row.ownerName || "system",
        status: row.status || "draft",
        description: row.description || null,
        widgetCount: Number(row.widgetCount || widgets.length || 0),
        widgets,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapThemeTemplateRow(row) {
      return {
        id: Number(row.id),
        themeName: row.themeName,
        themeCode: row.themeCode,
        category: row.category || "general",
        description: row.description || null,
        isBuiltin: Boolean(row.isBuiltin),
        status: row.status || "active",
        previewImage: row.previewImage || null,
        createdBy: row.createdBy || "system",
        canvas: parseJsonField(row.canvas, {}),
        chrome: parseJsonField(row.chrome, {}),
        semantic: parseJsonField(row.semantic, {}),
        chartCommon: parseJsonField(row.chartCommon, {}),
        chartVariants: parseJsonField(row.chartVariants, {}),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function buildAiRunInsertParams(payload = {}) {
      const provider = payload.provider || {};
      return [
        payload.sceneCode,
        payload.sourceId || null,
        payload.promptText || null,
        payload.generatedSql || null,
        payload.finalSql || null,
        provider.id || payload.modelProviderId || null,
        provider.modelName || payload.modelName || null,
        provider.modelVersion || payload.modelVersion || null,
        payload.chartFamily || null,
        payload.chartAssetId || null,
        JSON.stringify(payload.fieldMap || {}),
        JSON.stringify(payload.request || {}),
        JSON.stringify(payload.response || {}),
        payload.status || "success",
        payload.durationMs == null ? null : Number(payload.durationMs),
        payload.errorMessage || null,
        payload.createdBy || "system"
      ];
    }
    async function createReportingAiRun(payload) {
      const [result] = await pool.query(
        `INSERT INTO reporting_ai_runs
      (scene_code, source_id, prompt_text, generated_sql, final_sql, model_provider_id, model_name, model_version,
       chart_family, chart_asset_id, field_map_json, request_json, response_json, status, duration_ms, error_message, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        buildAiRunInsertParams(payload)
      );
      return {
        id: Number(result.insertId),
        sceneCode: payload.sceneCode,
        status: payload.status || "success"
      };
    }
    async function listReportDataSources() {
      const scoped = getScopedWhere("s");
      const datasetScoped = getScopedWhere("");
      const params = [
        ...datasetScoped.params,
        ...scoped.params
      ];
      const [rows] = await pool.query(
        `SELECT s.id,
            s.source_name AS sourceName,
            s.source_code AS sourceCode,
            s.source_type AS sourceType,
            s.connection_config AS connectionConfig,
            s.owner_name AS ownerName,
            s.status,
            COALESCE(ds.datasetCount, 0) AS datasetCount,
            s.created_at AS createdAt,
            s.updated_at AS updatedAt
     FROM report_data_sources s
     LEFT JOIN (
       SELECT source_id, COUNT(*) AS datasetCount
       FROM report_datasets
       ${datasetScoped.sql ? `WHERE ${datasetScoped.sql}` : ""}
       GROUP BY source_id
     ) ds ON ds.source_id = s.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY s.updated_at DESC, s.id DESC`,
        params
      );
      return rows.map(mapDataSourceRow);
    }
    async function getReportDataSourceById(id) {
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(
        `SELECT id,
            source_name AS sourceName,
            source_code AS sourceCode,
            source_type AS sourceType,
            connection_config AS connectionConfig,
            owner_name AS ownerName,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM report_data_sources
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [id, ...scoped.params]
      );
      return rows[0] ? mapDataSourceRow(rows[0]) : null;
    }
    async function createReportDataSource(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO report_data_sources
      (project_id, source_name, source_code, source_type, connection_config, owner_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.sourceName,
          payload.sourceCode,
          payload.sourceType,
          JSON.stringify(payload.connectionConfig || {}),
          payload.ownerName,
          payload.status
        ]
      );
      return getReportDataSourceById(result.insertId);
    }
    async function updateReportDataSource(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `UPDATE report_data_sources
     SET source_name = ?, source_code = ?, source_type = ?, connection_config = ?, owner_name = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          payload.sourceName,
          payload.sourceCode,
          payload.sourceType,
          JSON.stringify(payload.connectionConfig || {}),
          payload.ownerName,
          payload.status,
          id,
          ...scoped.params
        ]
      );
      if (!result.affectedRows) {
        return null;
      }
      return getReportDataSourceById(id);
    }
    async function deleteReportDataSource(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM report_data_sources WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    async function countDatasetsBySourceId(id) {
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS total
     FROM report_datasets
     WHERE source_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return Number(rows[0]?.total || 0);
    }
    async function listReportDatasetFolders() {
      const scoped = getScopedWhere("f");
      const [rows] = await pool.query(
        `SELECT f.id,
            f.folder_name AS folderName,
            f.parent_id AS parentId,
            f.created_at AS createdAt,
            f.updated_at AS updatedAt
     FROM report_dataset_folders f
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY f.parent_id ASC, f.folder_name ASC, f.id ASC`,
        scoped.params
      );
      return rows.map(mapDatasetFolderRow);
    }
    async function getReportDatasetFolderById(id) {
      const scoped = getScopedWhere("f");
      const [rows] = await pool.query(
        `SELECT f.id,
            f.folder_name AS folderName,
            f.parent_id AS parentId,
            f.created_at AS createdAt,
            f.updated_at AS updatedAt
     FROM report_dataset_folders f
     WHERE f.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [id, ...scoped.params]
      );
      return rows[0] ? mapDatasetFolderRow(rows[0]) : null;
    }
    async function createReportDatasetFolder(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO report_dataset_folders (project_id, folder_name, parent_id)
     VALUES (?, ?, ?)`,
        [
          projectId,
          payload.folderName,
          payload.parentId || null
        ]
      );
      return getReportDatasetFolderById(result.insertId);
    }
    async function updateReportDatasetFolder(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `UPDATE report_dataset_folders
     SET folder_name = ?, parent_id = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          payload.folderName,
          payload.parentId || null,
          id,
          ...scoped.params
        ]
      );
      if (!result.affectedRows) {
        return null;
      }
      return getReportDatasetFolderById(id);
    }
    async function deleteReportDatasetFolder(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM report_dataset_folders WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    async function listReportDatasets() {
      const scoped = getScopedWhere("d");
      const [rows] = await pool.query(
        `SELECT d.id,
            d.dataset_name AS datasetName,
            d.dataset_code AS datasetCode,
            d.source_id AS sourceId,
            d.folder_id AS folderId,
            s.source_name AS sourceName,
            s.source_type AS sourceType,
            f.folder_name AS folderName,
            d.dataset_type AS datasetType,
            d.source_table AS sourceTable,
            d.source_sql AS sourceSql,
            d.fields_json AS fields,
            d.query_config_json AS queryConfig,
            d.cache_config_json AS cacheConfig,
            d.owner_name AS ownerName,
            d.status,
            d.description,
            d.created_at AS createdAt,
            d.updated_at AS updatedAt
     FROM report_datasets d
     INNER JOIN report_data_sources s ON s.id = d.source_id
     LEFT JOIN report_dataset_folders f ON f.id = d.folder_id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY d.updated_at DESC, d.id DESC`,
        scoped.params
      );
      return rows.map(mapDatasetRow);
    }
    async function getReportDatasetById(id) {
      const scoped = getScopedWhere("d");
      const [rows] = await pool.query(
        `SELECT d.id,
            d.dataset_name AS datasetName,
            d.dataset_code AS datasetCode,
            d.source_id AS sourceId,
            d.folder_id AS folderId,
            s.source_name AS sourceName,
            s.source_type AS sourceType,
            f.folder_name AS folderName,
            d.dataset_type AS datasetType,
            d.source_table AS sourceTable,
            d.source_sql AS sourceSql,
            d.fields_json AS fields,
            d.query_config_json AS queryConfig,
            d.cache_config_json AS cacheConfig,
            d.owner_name AS ownerName,
            d.status,
            d.description,
            d.created_at AS createdAt,
            d.updated_at AS updatedAt
     FROM report_datasets d
     INNER JOIN report_data_sources s ON s.id = d.source_id
     LEFT JOIN report_dataset_folders f ON f.id = d.folder_id
     WHERE d.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [id, ...scoped.params]
      );
      return rows[0] ? mapDatasetRow(rows[0]) : null;
    }
    async function createReportDataset(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO report_datasets
      (project_id, dataset_name, dataset_code, source_id, folder_id, dataset_type, source_table, source_sql, fields_json, query_config_json, cache_config_json, owner_name, status, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.datasetName,
          payload.datasetCode,
          payload.sourceId,
          payload.folderId || null,
          payload.datasetType,
          payload.sourceTable,
          payload.sourceSql,
          JSON.stringify(payload.fields || []),
          JSON.stringify(payload.queryConfig || {}),
          JSON.stringify(payload.cacheConfig || {}),
          payload.ownerName,
          payload.status,
          payload.description || null
        ]
      );
      return getReportDatasetById(result.insertId);
    }
    async function updateReportDataset(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `UPDATE report_datasets
     SET dataset_name = ?, dataset_code = ?, source_id = ?, folder_id = ?, dataset_type = ?, source_table = ?, source_sql = ?,
         fields_json = ?, query_config_json = ?, cache_config_json = ?, owner_name = ?, status = ?, description = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          payload.datasetName,
          payload.datasetCode,
          payload.sourceId,
          payload.folderId || null,
          payload.datasetType,
          payload.sourceTable,
          payload.sourceSql,
          JSON.stringify(payload.fields || []),
          JSON.stringify(payload.queryConfig || {}),
          JSON.stringify(payload.cacheConfig || {}),
          payload.ownerName,
          payload.status,
          payload.description || null,
          id,
          ...scoped.params
        ]
      );
      if (!result.affectedRows) {
        return null;
      }
      return getReportDatasetById(id);
    }
    async function deleteReportDataset(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM report_datasets WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    async function listReportChartAssets() {
      const scoped = getScopedWhere("", { includeBuiltin: true });
      const [rows] = await pool.query(
        `SELECT id,
            chart_name AS chartName,
            chart_code AS chartCode,
            chart_type AS chartType,
            category,
            JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.chartFamily')) AS chartFamily,
            JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.variantName')) AS variantName,
            render_mode AS renderMode,
            cover_image_url AS coverImageUrl,
            description,
            tags_json AS tags,
            config_json AS config,
            option_template_json AS optionTemplate,
            mapping_schema_json AS mappingSchema,
            owner_name AS ownerName,
            status,
            is_builtin AS isBuiltin,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM report_chart_assets
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY is_builtin DESC, updated_at DESC, id DESC`,
        scoped.params
      );
      return rows.map(mapChartAssetRow);
    }
    async function listReportThemeTemplates() {
      const scoped = getScopedWhere("t", { includeBuiltin: true });
      const [rows] = await pool.query(
        `SELECT t.id,
            t.theme_name AS themeName,
            t.theme_code AS themeCode,
            t.category,
            t.description,
            t.is_builtin AS isBuiltin,
            t.status,
            t.preview_image AS previewImage,
            t.created_by AS createdBy,
            c.canvas_json AS canvas,
            c.chrome_json AS chrome,
            c.semantic_json AS semantic,
            c.chart_common_json AS chartCommon,
            c.chart_variants_json AS chartVariants,
            t.created_at AS createdAt,
            t.updated_at AS updatedAt
     FROM report_theme_templates t
     LEFT JOIN report_theme_template_configs c ON c.template_id = t.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY t.is_builtin DESC, t.updated_at DESC, t.id DESC`,
        scoped.params
      );
      return rows.map(mapThemeTemplateRow);
    }
    async function getReportThemeTemplateById(id) {
      const scoped = getScopedWhere("t", { includeBuiltin: true });
      const [rows] = await pool.query(
        `SELECT t.id,
            t.theme_name AS themeName,
            t.theme_code AS themeCode,
            t.category,
            t.description,
            t.is_builtin AS isBuiltin,
            t.status,
            t.preview_image AS previewImage,
            t.created_by AS createdBy,
            c.canvas_json AS canvas,
            c.chrome_json AS chrome,
            c.semantic_json AS semantic,
            c.chart_common_json AS chartCommon,
            c.chart_variants_json AS chartVariants,
            t.created_at AS createdAt,
            t.updated_at AS updatedAt
     FROM report_theme_templates t
     LEFT JOIN report_theme_template_configs c ON c.template_id = t.id
     WHERE t.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [id, ...scoped.params]
      );
      return rows[0] ? mapThemeTemplateRow(rows[0]) : null;
    }
    async function createReportThemeTemplate(payload) {
      const projectId = getCurrentProjectId();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.query(
          `INSERT INTO report_theme_templates
        (project_id, theme_name, theme_code, category, description, is_builtin, status, preview_image, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            payload.themeName,
            payload.themeCode,
            payload.category,
            payload.description || null,
            payload.isBuiltin ? 1 : 0,
            payload.status,
            payload.previewImage || null,
            payload.createdBy
          ]
        );
        await connection.query(
          `INSERT INTO report_theme_template_configs
        (template_id, canvas_json, chrome_json, semantic_json, chart_common_json, chart_variants_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
          [
            result.insertId,
            JSON.stringify(payload.canvas || {}),
            JSON.stringify(payload.chrome || {}),
            JSON.stringify(payload.semantic || {}),
            JSON.stringify(payload.chartCommon || {}),
            JSON.stringify(payload.chartVariants || {})
          ]
        );
        await connection.commit();
        return getReportThemeTemplateById(result.insertId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function updateReportThemeTemplate(id, payload) {
      const scoped = getScopedWhere("", { includeBuiltin: true });
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.query(
          `UPDATE report_theme_templates
       SET theme_name = ?, theme_code = ?, category = ?, description = ?, is_builtin = ?, status = ?, preview_image = ?, created_by = ?
       WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
          [
            payload.themeName,
            payload.themeCode,
            payload.category,
            payload.description || null,
            payload.isBuiltin ? 1 : 0,
            payload.status,
            payload.previewImage || null,
            payload.createdBy,
            id,
            ...scoped.params
          ]
        );
        if (!result.affectedRows) {
          await connection.rollback();
          return null;
        }
        await connection.query(
          `INSERT INTO report_theme_template_configs
        (template_id, canvas_json, chrome_json, semantic_json, chart_common_json, chart_variants_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        canvas_json = VALUES(canvas_json),
        chrome_json = VALUES(chrome_json),
        semantic_json = VALUES(semantic_json),
        chart_common_json = VALUES(chart_common_json),
        chart_variants_json = VALUES(chart_variants_json)`,
          [
            id,
            JSON.stringify(payload.canvas || {}),
            JSON.stringify(payload.chrome || {}),
            JSON.stringify(payload.semantic || {}),
            JSON.stringify(payload.chartCommon || {}),
            JSON.stringify(payload.chartVariants || {})
          ]
        );
        await connection.commit();
        return getReportThemeTemplateById(id);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function deleteReportThemeTemplate(id) {
      const scoped = getScopedWhere("", { includeBuiltin: true });
      const [result] = await pool.query(
        `DELETE FROM report_theme_templates WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    async function getReportChartAssetById(id) {
      const scoped = getScopedWhere("", { includeBuiltin: true });
      const [rows] = await pool.query(
        `SELECT id,
            chart_name AS chartName,
            chart_code AS chartCode,
            chart_type AS chartType,
            category,
            JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.chartFamily')) AS chartFamily,
            JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.variantName')) AS variantName,
            render_mode AS renderMode,
            cover_image_url AS coverImageUrl,
            description,
            tags_json AS tags,
            config_json AS config,
            option_template_json AS optionTemplate,
            mapping_schema_json AS mappingSchema,
            owner_name AS ownerName,
            status,
            is_builtin AS isBuiltin,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM report_chart_assets
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [id, ...scoped.params]
      );
      return rows[0] ? mapChartAssetRow(rows[0]) : null;
    }
    async function createReportChartAsset(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO report_chart_assets
      (project_id, chart_name, chart_code, chart_type, category, render_mode, cover_image_url, description, tags_json, config_json, option_template_json, mapping_schema_json, owner_name, status, is_builtin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.chartName,
          payload.chartCode,
          payload.chartType,
          payload.category,
          payload.renderMode,
          payload.coverImageUrl || null,
          payload.description || null,
          JSON.stringify(payload.tags || []),
          JSON.stringify(payload.config || {}),
          JSON.stringify(payload.optionTemplate || {}),
          JSON.stringify(payload.mappingSchema || {}),
          payload.ownerName,
          payload.status,
          payload.isBuiltin ? 1 : 0
        ]
      );
      return getReportChartAssetById(result.insertId);
    }
    async function updateReportChartAsset(id, payload) {
      const scoped = getScopedWhere("", { includeBuiltin: true });
      const [result] = await pool.query(
        `UPDATE report_chart_assets
     SET chart_name = ?, chart_code = ?, chart_type = ?, category = ?, render_mode = ?, cover_image_url = ?, description = ?,
         tags_json = ?, config_json = ?, option_template_json = ?, mapping_schema_json = ?, owner_name = ?, status = ?, is_builtin = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          payload.chartName,
          payload.chartCode,
          payload.chartType,
          payload.category,
          payload.renderMode,
          payload.coverImageUrl || null,
          payload.description || null,
          JSON.stringify(payload.tags || []),
          JSON.stringify(payload.config || {}),
          JSON.stringify(payload.optionTemplate || {}),
          JSON.stringify(payload.mappingSchema || {}),
          payload.ownerName,
          payload.status,
          payload.isBuiltin ? 1 : 0,
          id,
          ...scoped.params
        ]
      );
      if (!result.affectedRows) {
        return null;
      }
      return getReportChartAssetById(id);
    }
    async function deleteReportChartAsset(id) {
      const scoped = getScopedWhere("", { includeBuiltin: true });
      const [result] = await pool.query(
        `DELETE FROM report_chart_assets WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    async function listReportDashboards() {
      const scoped = getScopedWhere("d");
      const [rows] = await pool.query(
        `SELECT d.id,
            d.dashboard_name AS dashboardName,
            d.dashboard_code AS dashboardCode,
            d.layout_mode AS layoutMode,
            d.theme_template_id AS themeTemplateId,
            d.theme_settings_json AS themeSettings,
            d.theme_config_json AS themeConfig,
            d.filter_config_json AS filterConfig,
            d.canvas_config_json AS canvasConfig,
            d.owner_name AS ownerName,
            d.status,
            d.description,
            COALESCE(w.widgetCount, 0) AS widgetCount,
            d.created_at AS createdAt,
            d.updated_at AS updatedAt
     FROM report_dashboards d
     LEFT JOIN (
       SELECT dashboard_id, COUNT(*) AS widgetCount
       FROM report_dashboard_widgets
       GROUP BY dashboard_id
     ) w ON w.dashboard_id = d.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY d.updated_at DESC, d.id DESC`,
        scoped.params
      );
      return rows.map((row) => mapDashboardRow(row));
    }
    async function getReportDashboardByName(name) {
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(
        `SELECT id,
            dashboard_name AS dashboardName,
            dashboard_code AS dashboardCode,
            layout_mode AS layoutMode,
            theme_template_id AS themeTemplateId,
            theme_settings_json AS themeSettings,
            theme_config_json AS themeConfig,
            filter_config_json AS filterConfig,
            canvas_config_json AS canvasConfig,
            owner_name AS ownerName,
            status,
            description,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM report_dashboards
     WHERE dashboard_name = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [name, ...scoped.params]
      );
      return rows[0] ? mapDashboardRow(rows[0]) : null;
    }
    async function listWidgetsByDashboardId(dashboardId) {
      const [rows] = await pool.query(
        `SELECT id,
            widget_key AS widgetKey,
            widget_name AS widgetName,
            widget_type AS widgetType,
            dataset_id AS datasetId,
            chart_asset_id AS chartAssetId,
            position_json AS position,
            props_json AS props,
            query_params_json AS queryParams
     FROM report_dashboard_widgets
     WHERE dashboard_id = ?
     ORDER BY id ASC`,
        [dashboardId]
      );
      return rows.map(mapWidgetRow);
    }
    async function getReportDashboardById(id) {
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(
        `SELECT id,
            dashboard_name AS dashboardName,
            dashboard_code AS dashboardCode,
            layout_mode AS layoutMode,
            theme_template_id AS themeTemplateId,
            theme_settings_json AS themeSettings,
            theme_config_json AS themeConfig,
            filter_config_json AS filterConfig,
            canvas_config_json AS canvasConfig,
            owner_name AS ownerName,
            status,
            description,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM report_dashboards
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [id, ...scoped.params]
      );
      if (!rows[0]) {
        return null;
      }
      const widgets = await listWidgetsByDashboardId(id);
      return mapDashboardRow(rows[0], widgets);
    }
    async function getReportDashboardSummaryById(id) {
      const scoped = getScopedWhere("d");
      const [rows] = await pool.query(
        `SELECT d.id,
            d.dashboard_name AS dashboardName,
            d.dashboard_code AS dashboardCode,
            d.layout_mode AS layoutMode,
            d.theme_template_id AS themeTemplateId,
            d.theme_settings_json AS themeSettings,
            d.theme_config_json AS themeConfig,
            d.filter_config_json AS filterConfig,
            d.canvas_config_json AS canvasConfig,
            d.owner_name AS ownerName,
            d.status,
            d.description,
            d.created_at AS createdAt,
            d.updated_at AS updatedAt
     FROM report_dashboards d
     WHERE d.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [id, ...scoped.params]
      );
      return rows[0] ? mapDashboardRow(rows[0]) : null;
    }
    async function replaceDashboardWidgets(connection, dashboardId, widgets = []) {
      await connection.query("DELETE FROM report_dashboard_widgets WHERE dashboard_id = ?", [dashboardId]);
      for (const widget of widgets) {
        await connection.query(
          `INSERT INTO report_dashboard_widgets
        (dashboard_id, widget_key, widget_name, widget_type, dataset_id, chart_asset_id, position_json, props_json, query_params_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            dashboardId,
            widget.widgetKey,
            widget.widgetName,
            widget.widgetType,
            widget.datasetId || null,
            widget.chartAssetId || null,
            JSON.stringify(widget.position || {}),
            JSON.stringify(widget.props || {}),
            JSON.stringify(widget.queryParams || {})
          ]
        );
      }
    }
    async function createReportDashboard(payload) {
      const projectId = getCurrentProjectId();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.query(
          `INSERT INTO report_dashboards
        (project_id, dashboard_name, dashboard_code, layout_mode, theme_template_id, theme_settings_json, theme_config_json, filter_config_json, canvas_config_json, owner_name, status, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            payload.dashboardName,
            payload.dashboardCode,
            payload.layoutMode,
            payload.themeTemplateId || null,
            JSON.stringify(payload.themeSettings || {}),
            JSON.stringify(payload.themeConfig || {}),
            JSON.stringify(payload.filterConfig || {}),
            JSON.stringify(payload.canvasConfig || {}),
            payload.ownerName,
            payload.status,
            payload.description || null
          ]
        );
        await replaceDashboardWidgets(connection, result.insertId, payload.widgets || []);
        await connection.commit();
        return getReportDashboardById(result.insertId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function updateReportDashboard(id, payload) {
      const scoped = getScopedWhere("");
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.query(
          `UPDATE report_dashboards
       SET dashboard_name = ?, dashboard_code = ?, layout_mode = ?, theme_template_id = ?, theme_settings_json = ?, theme_config_json = ?, filter_config_json = ?, canvas_config_json = ?,
           owner_name = ?, status = ?, description = ?
       WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
          [
            payload.dashboardName,
            payload.dashboardCode,
            payload.layoutMode,
            payload.themeTemplateId || null,
            JSON.stringify(payload.themeSettings || {}),
            JSON.stringify(payload.themeConfig || {}),
            JSON.stringify(payload.filterConfig || {}),
            JSON.stringify(payload.canvasConfig || {}),
            payload.ownerName,
            payload.status,
            payload.description || null,
            id,
            ...scoped.params
          ]
        );
        if (!result.affectedRows) {
          await connection.rollback();
          return null;
        }
        await replaceDashboardWidgets(connection, id, payload.widgets || []);
        await connection.commit();
        return getReportDashboardById(id);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function deleteReportDashboard(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM report_dashboards WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return result.affectedRows > 0;
    }
    async function getReportingOverview() {
      const projectId = getCurrentProjectId();
      const scopedWhere = projectId ? "WHERE project_id = ?" : "";
      const sharedWhere = projectId ? "WHERE project_id = ? OR is_builtin = 1" : "";
      const params = projectId ? [projectId, projectId, projectId, projectId, projectId] : [];
      const [[overview]] = await pool.query(
        `SELECT
       (SELECT COUNT(*) FROM report_data_sources ${scopedWhere}) AS totalSources,
       (SELECT COUNT(*) FROM report_datasets ${scopedWhere}) AS totalDatasets,
       (SELECT COUNT(*) FROM report_chart_assets ${sharedWhere}) AS totalCharts,
       (SELECT COUNT(*) FROM report_dashboards ${scopedWhere}) AS totalDashboards,
       (SELECT COUNT(*) FROM report_theme_templates ${sharedWhere}) AS totalThemeTemplates`,
        params
      );
      return {
        totalSources: Number(overview.totalSources || 0),
        totalDatasets: Number(overview.totalDatasets || 0),
        totalCharts: Number(overview.totalCharts || 0),
        totalDashboards: Number(overview.totalDashboards || 0),
        totalThemeTemplates: Number(overview.totalThemeTemplates || 0)
      };
    }
    module2.exports = {
      countDatasetsBySourceId,
      createReportingAiRun,
      createReportChartAsset,
      createReportDashboard,
      createReportDataSource,
      createReportDatasetFolder,
      createReportDataset,
      createReportThemeTemplate,
      deleteReportChartAsset,
      deleteReportDashboard,
      deleteReportDataSource,
      deleteReportDatasetFolder,
      deleteReportDataset,
      deleteReportThemeTemplate,
      getReportChartAssetById,
      getReportDashboardById,
      getReportDashboardByName,
      getReportDashboardSummaryById,
      getReportDataSourceById,
      getReportDatasetFolderById,
      getReportDatasetById,
      getReportThemeTemplateById,
      getReportingOverview,
      listReportChartAssets,
      listReportDashboards,
      listReportDataSources,
      listReportDatasetFolders,
      listReportDatasets,
      listReportThemeTemplates,
      updateReportChartAsset,
      updateReportDashboard,
      updateReportDataSource,
      updateReportDatasetFolder,
      updateReportDataset,
      updateReportThemeTemplate
    };
  }
});

// backend/src/modules/reporting/reporting-ai-config.repository.js
var require_reporting_ai_config_repository = __commonJS({
  "backend/src/modules/reporting/reporting-ai-config.repository.js"(exports2, module2) {
    var { pool } = require_database();
    function parseJsonField(value, fallback) {
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
    function mapRow(row) {
      return {
        ...row,
        id: Number(row.id),
        defaultModelProviderId: row.defaultModelProviderId ? Number(row.defaultModelProviderId) : null,
        defaultModelName: row.defaultModelName || null,
        defaultModelVersion: row.defaultModelVersion || null,
        temperature: row.temperature === null || row.temperature === void 0 ? null : Number(row.temperature),
        maxTokens: row.maxTokens === null || row.maxTokens === void 0 ? null : Number(row.maxTokens),
        timeoutMs: row.timeoutMs === null || row.timeoutMs === void 0 ? null : Number(row.timeoutMs),
        inputSchema: parseJsonField(row.inputSchema, {})
      };
    }
    var SELECT_SQL = `
  SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
         c.default_model_provider_id AS defaultModelProviderId,
         c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
         c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
         c.input_schema_json AS inputSchema, c.system_prompt AS systemPrompt,
         c.description, c.owner_name AS ownerName, c.status,
         c.created_at AS createdAt, c.updated_at AS updatedAt,
         p.config_name AS defaultModelProviderName
  FROM reporting_ai_configs c
  LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
`;
    async function listConfigs() {
      const [rows] = await pool.query(`${SELECT_SQL} ORDER BY c.id DESC`);
      return rows.map(mapRow);
    }
    async function getConfigById(id) {
      const [rows] = await pool.query(`${SELECT_SQL} WHERE c.id = ? LIMIT 1`, [id]);
      return rows[0] ? mapRow(rows[0]) : null;
    }
    async function getConfigByCode(sceneCode) {
      const [rows] = await pool.query(`${SELECT_SQL} WHERE c.scene_code = ? LIMIT 1`, [sceneCode]);
      return rows[0] ? mapRow(rows[0]) : null;
    }
    async function createConfig(payload) {
      const [result] = await pool.query(
        `INSERT INTO reporting_ai_configs
      (scene_name, scene_code, default_model_provider_id, default_model_name, default_model_version,
       temperature, max_tokens, timeout_ms, input_schema_json, system_prompt, description, owner_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.sceneName,
          payload.sceneCode,
          payload.defaultModelProviderId || null,
          payload.defaultModelName || null,
          payload.defaultModelVersion || null,
          payload.temperature ?? null,
          payload.maxTokens ?? null,
          payload.timeoutMs ?? null,
          JSON.stringify(payload.inputSchema || {}),
          payload.systemPrompt || null,
          payload.description || null,
          payload.ownerName || "System Administrator",
          payload.status || "active"
        ]
      );
      return getConfigById(result.insertId);
    }
    async function updateConfig(id, payload) {
      const [result] = await pool.query(
        `UPDATE reporting_ai_configs
     SET scene_name = ?, scene_code = ?, default_model_provider_id = ?, default_model_name = ?,
         default_model_version = ?, temperature = ?, max_tokens = ?, timeout_ms = ?,
         input_schema_json = ?, system_prompt = ?, description = ?, owner_name = ?, status = ?
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
          JSON.stringify(payload.inputSchema || {}),
          payload.systemPrompt || null,
          payload.description || null,
          payload.ownerName || "System Administrator",
          payload.status || "active",
          id
        ]
      );
      if (!result.affectedRows) {
        return null;
      }
      return getConfigById(id);
    }
    module2.exports = {
      createConfig,
      getConfigByCode,
      getConfigById,
      listConfigs,
      updateConfig
    };
  }
});

// backend/src/modules/reporting/reporting-ai-config.service.js
var require_reporting_ai_config_service = __commonJS({
  "backend/src/modules/reporting/reporting-ai-config.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var modelProviderService = require_model_provider_service();
    var repository = require_reporting_ai_config_repository();
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
        throw new AppError("\u62A5\u8868 AI \u573A\u666F\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
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
        inputSchema: payload.inputSchema || existing.inputSchema || {},
        systemPrompt: payload.systemPrompt || null
      });
      if (!row) {
        throw new AppError("\u62A5\u8868 AI \u573A\u666F\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function ensureBuiltinConfig(payload) {
      const existing = await repository.getConfigByCode(payload.sceneCode);
      if (existing) {
        if (!existing.systemPrompt) {
          return repository.updateConfig(existing.id, {
            ...existing,
            systemPrompt: payload.systemPrompt || existing.systemPrompt,
            inputSchema: existing.inputSchema && Object.keys(existing.inputSchema).length ? existing.inputSchema : payload.inputSchema
          });
        }
        return existing;
      }
      return repository.createConfig(payload);
    }
    module2.exports = {
      ensureBuiltinConfig,
      getActiveConfigByCode,
      listConfigs,
      updateConfig
    };
  }
});

// backend/src/modules/reporting/reporting.theme-presets.js
var require_reporting_theme_presets = __commonJS({
  "backend/src/modules/reporting/reporting.theme-presets.js"(exports2, module2) {
    var KPI_THEME_TEMPLATES = [
      { key: "clean-card", label: "\u7559\u767D\u7ECF\u5178", category: "light", chrome: { backgroundColor: "#ffffff", borderColor: "#d9e2ef", borderWidth: 1, borderRadius: 16, shadowPreset: "none", paddingPreset: "comfortable", titleColor: "#1f2d3d" }, kpiStyle: { itemBackgroundColor: "#ffffff", itemBorderColor: "#e5eaf1", itemBorderWidth: 0, itemBorderRadius: 12, dividerColor: "#e5eaf1", dividerStyle: "solid", valueColor: "#1f2d3d", metricLabelColor: "#66758a", compareLabelColor: "#5b6b82" } },
      { key: "soft-panel", label: "\u67D4\u5149\u5361\u7247", category: "light", chrome: { backgroundColor: "#f8fbff", borderColor: "#d7e2f0", borderWidth: 1, borderRadius: 20, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#2a3f57" }, kpiStyle: { itemBackgroundColor: "#ffffff", itemBorderColor: "#dfe7f3", itemBorderWidth: 1, itemBorderRadius: 14, dividerColor: "#dfe7f3", dividerStyle: "solid", valueColor: "#2a3f57", metricLabelColor: "#70839a", compareLabelColor: "#5a718b" } },
      { key: "highlight-frame", label: "\u660E\u84DD\u5546\u52A1", category: "blue", chrome: { backgroundColor: "#ffffff", borderColor: "#7faef5", borderWidth: 2, borderRadius: 18, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#1d3e6f" }, kpiStyle: { itemBackgroundColor: "#ffffff", itemBorderColor: "#cfe0fb", itemBorderWidth: 1, itemBorderRadius: 16, dividerColor: "#cfe0fb", dividerStyle: "solid", valueColor: "#255fa8", metricLabelColor: "#5f7ea8", compareLabelColor: "#3b82f6" } },
      { key: "mist-card", label: "\u67D4\u5149\u5361\u7247", category: "light", chrome: { backgroundColor: "#f4f7fb", borderColor: "#d7e2f2", borderWidth: 1, borderRadius: 18, shadowPreset: "soft", paddingPreset: "comfortable" }, kpiStyle: { itemBackgroundColor: "#f8fafc", itemBorderColor: "#cbd5e1", itemBorderWidth: 0, itemBorderRadius: 12, dividerColor: "#cbd5e1", dividerStyle: "solid", valueColor: "#2563eb", metricLabelColor: null, compareLabelColor: null } },
      { key: "midnight-panel", label: "\u6DF1\u6D77\u9762\u677F", category: "dark", chrome: { backgroundColor: "#0b1220", borderColor: "#243247", borderWidth: 1, borderRadius: 20, shadowPreset: "medium", paddingPreset: "comfortable", titleColor: "#e5eefc" }, kpiStyle: { itemBackgroundColor: "#111c2f", itemBorderColor: "#26354b", itemBorderWidth: 1, itemBorderRadius: 18, dividerColor: "#26354b", dividerStyle: "solid", valueColor: "#f8fbff", metricLabelColor: "#94a8c6", compareLabelColor: "#5eead4" } },
      { key: "obsidian-glow", label: "\u77F3\u58A8\u5149\u6CFD", category: "dark", chrome: { backgroundColor: "#0a0f1a", borderColor: "#2c3b52", borderWidth: 1, borderRadius: 22, shadowPreset: "medium", paddingPreset: "spacious", titleColor: "#eef4ff" }, kpiStyle: { itemBackgroundColor: "#121c2d", itemBorderColor: "#32445f", itemBorderWidth: 1, itemBorderRadius: 18, dividerColor: "#32445f", dividerStyle: "solid", valueColor: "#f5f9ff", metricLabelColor: "#98a9c2", compareLabelColor: "#7dd3fc" } },
      { key: "aurora-night", label: "\u51B7\u8F89\u591C\u8272", category: "dark", chrome: { backgroundColor: "#07131b", borderColor: "#1d3d48", borderWidth: 1, borderRadius: 20, shadowPreset: "medium", paddingPreset: "comfortable", titleColor: "#e7fbff" }, kpiStyle: { itemBackgroundColor: "#0d1f28", itemBorderColor: "#1f4f5a", itemBorderWidth: 1, itemBorderRadius: 18, dividerColor: "rgba(84,214,214,0.18)", dividerStyle: "solid", valueColor: "#7df9ff", metricLabelColor: "#9cc9d0", compareLabelColor: "#67e8f9" } },
      { key: "warm-paper", label: "\u6696\u7C73\u7ECF\u8425", category: "warm", chrome: { backgroundColor: "#fff7ed", borderColor: "#e7cba3", borderWidth: 1, borderRadius: 16, shadowPreset: "none", paddingPreset: "comfortable", titleColor: "#654321" }, kpiStyle: { itemBackgroundColor: "#fff0d9", itemBorderColor: "#e7cba3", itemBorderWidth: 0, itemBorderRadius: 14, dividerColor: "#e5c69a", dividerStyle: "solid", valueColor: "#9a4f12", metricLabelColor: "#765334", compareLabelColor: "#b8651b" } },
      { key: "emerald-card", label: "\u9752\u7EFF\u7ECF\u8425", category: "green", chrome: { backgroundColor: "#f3fbf8", borderColor: "#7fd1b9", borderWidth: 1, borderRadius: 20, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#155e4a" }, kpiStyle: { itemBackgroundColor: "#effcf6", itemBorderColor: "#6ee7b7", itemBorderWidth: 1, itemBorderRadius: 14, dividerColor: "#6ee7b7", dividerStyle: "solid", valueColor: "#059669", metricLabelColor: "#4f7c69", compareLabelColor: "#047857" } },
      { key: "forest-report", label: "\u677E\u77F3\u5206\u6790", category: "green", chrome: { backgroundColor: "#eff8f2", borderColor: "#72b68b", borderWidth: 1, borderRadius: 18, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#2c5a3f" }, kpiStyle: { itemBackgroundColor: "#f8fcf9", itemBorderColor: "#b7d9c1", itemBorderWidth: 1, itemBorderRadius: 14, dividerColor: "#c9e4d2", dividerStyle: "solid", valueColor: "#166534", metricLabelColor: "#486b57", compareLabelColor: "#15803d" } },
      { key: "coral-panel", label: "\u6696\u7C73\u7ECF\u8425", category: "warm", chrome: { backgroundColor: "#fff8f5", borderColor: "#e7c7b8", borderWidth: 1, borderRadius: 18, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#7b5b49" }, kpiStyle: { itemBackgroundColor: "#fffdfb", itemBorderColor: "#edd6cc", itemBorderWidth: 1, itemBorderRadius: 16, dividerColor: "#edd6cc", dividerStyle: "solid", valueColor: "#9a5b37", metricLabelColor: "#8f6a52", compareLabelColor: "#a06741" } },
      { key: "slate-card", label: "\u77F3\u677F\u5206\u680F", category: "light", chrome: { backgroundColor: "#f7f9fc", borderColor: "#94a3b8", borderWidth: 2, borderRadius: 14, shadowPreset: "none", paddingPreset: "compact", titleColor: "#334155" }, kpiStyle: { itemBackgroundColor: "#f8fafc", itemBorderColor: "#cbd5e1", itemBorderWidth: 0, itemBorderRadius: 0, dividerColor: "#94a3b8", dividerStyle: "dashed", valueColor: "#334155", metricLabelColor: "#64748b", compareLabelColor: "#475569" } },
      { key: "neon-frame", label: "\u51B7\u9752\u4E2D\u67A2", category: "blue", chrome: { backgroundColor: "#081521", borderColor: "#35d0ff", borderWidth: 2, borderRadius: 18, shadowPreset: "medium", paddingPreset: "spacious", titleColor: "#dcf7ff" }, kpiStyle: { itemBackgroundColor: "#102433", itemBorderColor: "#2a6178", itemBorderWidth: 1, itemBorderRadius: 14, dividerColor: "rgba(83,221,255,0.22)", dividerStyle: "solid", valueColor: "#5fe2ff", metricLabelColor: "#9fd9e8", compareLabelColor: "#53ddff" } },
      { key: "glass-minimal", label: "\u4E91\u5E55\u5206\u6790", category: "blue", chrome: { backgroundColor: "#f7fbff", borderColor: "#d6e7fb", borderWidth: 1, borderRadius: 20, shadowPreset: "soft", paddingPreset: "spacious", titleColor: "#24476b" }, kpiStyle: { itemBackgroundColor: "rgba(255,255,255,0.78)", itemBorderColor: "#e4eefb", itemBorderWidth: 1, itemBorderRadius: 20, dividerColor: "#e4eefb", dividerStyle: "solid", valueColor: "#2f7cf6", metricLabelColor: "#6b8cad", compareLabelColor: "#4b93ff" } },
      { key: "violet-glow", label: "\u51B7\u7D2B\u5206\u6790", category: "purple", chrome: { backgroundColor: "#f7f4ff", borderColor: "#b7a2ff", borderWidth: 2, borderRadius: 18, shadowPreset: "medium", paddingPreset: "spacious", titleColor: "#4c1d95" }, kpiStyle: { itemBackgroundColor: "#f1ebff", itemBorderColor: "#c4b5fd", itemBorderWidth: 1, itemBorderRadius: 16, dividerColor: "#d8ccff", dividerStyle: "solid", valueColor: "#6d28d9", metricLabelColor: "#6b5a91", compareLabelColor: "#8b5cf6" } },
      { key: "plum-night", label: "\u6DF1\u7D2B\u591C\u8272", category: "purple", chrome: { backgroundColor: "#171222", borderColor: "#4c3c68", borderWidth: 1, borderRadius: 20, shadowPreset: "medium", paddingPreset: "comfortable", titleColor: "#f3ebff" }, kpiStyle: { itemBackgroundColor: "#20192d", itemBorderColor: "#574071", itemBorderWidth: 1, itemBorderRadius: 18, dividerColor: "#574071", dividerStyle: "solid", valueColor: "#f5edff", metricLabelColor: "#c7badb", compareLabelColor: "#c084fc" } },
      { key: "number-banner", label: "\u7559\u767D\u7ECF\u5178", category: "light", chrome: { backgroundColor: "#ffffff", borderColor: "#dbe5f3", borderWidth: 1, borderRadius: 16, shadowPreset: "none", paddingPreset: "comfortable" }, kpiStyle: { itemBackgroundColor: "#ffffff", itemBorderColor: "#dbe5f3", itemBorderWidth: 0, itemBorderRadius: 16, dividerColor: "#dbe5f3", dividerStyle: "solid", valueColor: "#1d4ed8", metricLabelColor: null, compareLabelColor: null } },
      { key: "progress-focus", label: "\u7559\u767D\u8FDB\u5EA6", category: "blue", chrome: { backgroundColor: "#ffffff", borderColor: "#dbe5f3", borderWidth: 1, borderRadius: 16, shadowPreset: "soft", paddingPreset: "comfortable" }, kpiStyle: { itemBackgroundColor: "#f8fafc", itemBorderColor: "#dbe5f3", itemBorderWidth: 1, itemBorderRadius: 16, dividerColor: "#dbe5f3", dividerStyle: "solid", valueColor: "#2563eb", metricLabelColor: null, compareLabelColor: "#2563eb" } },
      { key: "executive-ink", label: "\u58A8\u91D1\u5C42\u6B21", category: "dark", chrome: { backgroundColor: "#14110f", borderColor: "#5a4630", borderWidth: 1, borderRadius: 22, shadowPreset: "medium", paddingPreset: "spacious", titleColor: "#f3dfb2" }, kpiStyle: { itemBackgroundColor: "#1b1714", itemBorderColor: "#6a5438", itemBorderWidth: 1, itemBorderRadius: 18, dividerColor: "rgba(214,180,86,0.24)", dividerStyle: "solid", valueColor: "#e3b86b", metricLabelColor: "#c8b48a", compareLabelColor: "#f1d18a" } },
      { key: "boardroom-silver", label: "\u94F6\u7070\u4E13\u4E1A", category: "light", chrome: { backgroundColor: "#f7f8fa", borderColor: "#cfd5dd", borderWidth: 1, borderRadius: 18, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#344054" }, kpiStyle: { itemBackgroundColor: "#ffffff", itemBorderColor: "#dde3ea", itemBorderWidth: 1, itemBorderRadius: 14, dividerColor: "#d7dde5", dividerStyle: "solid", valueColor: "#111827", metricLabelColor: "#667085", compareLabelColor: "#475467" } },
      { key: "capital-blueprint", label: "\u6DF1\u84DD\u9A7E\u9A76\u8231", category: "blue", chrome: { backgroundColor: "#edf4ff", borderColor: "#9fbbe4", borderWidth: 1, borderRadius: 20, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#173b68" }, kpiStyle: { itemBackgroundColor: "#e7f1ff", itemBorderColor: "#b9cfef", itemBorderWidth: 1, itemBorderRadius: 16, dividerColor: "#abc4e8", dividerStyle: "solid", valueColor: "#1d4f91", metricLabelColor: "#587497", compareLabelColor: "#2f68b2" } },
      { key: "private-banking", label: "\u7C73\u68D5\u6C47\u62A5", category: "warm", chrome: { backgroundColor: "#fbf8f2", borderColor: "#d7c8ae", borderWidth: 1, borderRadius: 20, shadowPreset: "soft", paddingPreset: "comfortable", titleColor: "#5b4630" }, kpiStyle: { itemBackgroundColor: "#fffdf9", itemBorderColor: "#e8decd", itemBorderWidth: 1, itemBorderRadius: 16, dividerColor: "#e6dccb", dividerStyle: "solid", valueColor: "#7b5a34", metricLabelColor: "#8c745a", compareLabelColor: "#a06b2c" } }
    ];
    function buildFlipperBackground(primary, itemBackground, category) {
      if (category === "dark" || CATEGORY_META[category] === "\u6DF1\u8272\u7CFB") {
        return `linear-gradient(180deg, ${primary} 0%, ${itemBackground || "#15110d"} 100%)`;
      }
      if (category === "warm" || CATEGORY_META[category] === "\u6696\u7C73\u7CFB") {
        return `linear-gradient(180deg, ${primary} 0%, #5f432d 100%)`;
      }
      if (category === "green" || CATEGORY_META[category] === "\u9752\u7EFF\u7CFB") {
        return `linear-gradient(180deg, ${primary} 0%, #14532d 100%)`;
      }
      if (category === "purple" || CATEGORY_META[category] === "\u51B7\u7D2B\u7CFB") {
        return `linear-gradient(180deg, ${primary} 0%, #312e81 100%)`;
      }
      return `linear-gradient(180deg, ${primary} 0%, ${itemBackground || "#1e293b"} 100%)`;
    }
    var CATEGORY_META = {
      light: "\u4E2D\u6027\u8272",
      dark: "\u6DF1\u8272\u7CFB",
      blue: "\u84DD\u9752\u7CFB",
      green: "\u9752\u7EFF\u7CFB",
      warm: "\u6696\u7C73\u7CFB",
      purple: "\u51B7\u7D2B\u7CFB"
    };
    function toThemeTemplate(template, index) {
      const primary = template.kpiStyle.valueColor || (template.category === "dark" ? "#34d3ff" : template.category === "green" ? "#059669" : template.category === "warm" ? "#b45309" : template.category === "purple" ? "#7c3aed" : "#1677ff");
      const titleColor = template.chrome.titleColor || (template.category === "dark" ? "#eef4ff" : "#101828");
      const borderColor = template.chrome.borderColor || "#dce6f5";
      const backgroundColor = template.chrome.backgroundColor || "#ffffff";
      const darkCanvas = template.category === "dark";
      const isExecutiveInk = template.key === "executive-ink";
      const isCapitalBlueprint = template.key === "capital-blueprint";
      const isHighlightFrame = template.key === "highlight-frame";
      const isGlassMinimal = template.key === "glass-minimal";
      const isNeonFrame = template.key === "neon-frame";
      const isWarmPaper = template.key === "warm-paper";
      const isVioletGlow = template.key === "violet-glow";
      const executiveInkCommonPalette = ["#d6b36a", "#b88a44", "#f1d089", "#8e6a37", "#f5e6bb"];
      const executiveInkBarPalette = ["#c9a35f", "#e4c27d"];
      const executiveInkHorizontalPalette = ["#d6b36a", "#b88a44", "#f1d089", "#9b7440", "#f3dfb2"];
      const executiveInkLinePalette = ["#d6b36a", "#f1d089", "#b88a44", "#f3dfb2"];
      const executiveInkMapPalette = ["#2a211a", "#4e3b27", "#7b5d37", "#b88a44", "#f1d089"];
      const capitalBlueprintCommonPalette = ["#173b68", "#255fa8", "#3f7ae0", "#63b4ef", "#9fd9f6"];
      const capitalBlueprintBarPalette = ["#1d4f91", "#4fa7ff"];
      const capitalBlueprintHorizontalPalette = ["#1d4f91", "#2f68b2", "#4f8cff", "#5fc8df", "#8fb7ff"];
      const capitalBlueprintLinePalette = ["#214f8f", "#4f8cff", "#66c5f0", "#8fb7ff"];
      const capitalBlueprintMapPalette = ["#edf4ff", "#d3e4ff", "#a9c8ff", "#5f98f2", "#1d4f91"];
      const warmPaperCommonPalette = ["#9a4f12", "#c77522", "#e3a24a", "#8d6b35", "#c8583a"];
      const warmPaperBarPalette = ["#c77522", "#f0b35a"];
      const warmPaperHorizontalPalette = ["#8a5a2b", "#a96b2a", "#c77522", "#e3a24a", "#c8583a"];
      const warmPaperLinePalette = ["#9a4f12", "#d88428", "#8d6b35", "#c8583a"];
      const warmPaperMapPalette = ["#fff7ed", "#f6dfbc", "#edbd7b", "#d88428", "#8a4f1f"];
      const violetGlowCommonPalette = ["#6d28d9", "#8b5cf6", "#22d3ee", "#f472b6", "#a78bfa"];
      const violetGlowBarPalette = ["#7c3aed", "#22d3ee"];
      const violetGlowHorizontalPalette = ["#6d28d9", "#8b5cf6", "#a78bfa", "#22d3ee", "#f472b6"];
      const violetGlowLinePalette = ["#7c3aed", "#22d3ee", "#f472b6", "#a78bfa"];
      const violetGlowMapPalette = ["#f7f4ff", "#e9ddff", "#c4b5fd", "#8b5cf6", "#581c87"];
      const highlightFrameCommonPalette = ["#255fa8", "#4b93ff", "#8ab8ff", "#bed7ff", "#e8f1ff"];
      const highlightFrameHorizontalPalette = ["#255fa8", "#4b93ff", "#73a7ff", "#9fc4ff", "#c6ddff"];
      const glassMinimalCommonPalette = ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"];
      const neonFrameCommonPalette = ["#53ddff", "#2fb4ff", "#59f0dc", "#8ec5ff", "#c6ecff"];
      const neonFrameMapPalette = ["#0b2230", "#11415a", "#156b8b", "#2fb4ff", "#53ddff"];
      return {
        themeName: template.label,
        themeCode: template.key,
        category: CATEGORY_META[template.category] || template.category,
        description: `${CATEGORY_META[template.category] || template.category}\u5185\u7F6E\u4E3B\u9898\u6A21\u677F`,
        isBuiltin: true,
        status: "active",
        previewImage: null,
        createdBy: "system",
        canvas: {
          backgroundType: darkCanvas ? "gradient" : "solid",
          backgroundColor: darkCanvas ? backgroundColor : backgroundColor,
          backgroundGradient: darkCanvas ? `linear-gradient(180deg, ${backgroundColor} 0%, ${backgroundColor} 100%)` : null,
          backgroundImage: null,
          overlayColor: darkCanvas ? "#07131b" : "#ffffff",
          overlayOpacity: darkCanvas ? 0.08 : 0,
          dashboardTitleColor: titleColor
        },
        chrome: {
          backgroundColor,
          borderColor,
          borderWidth: template.chrome.borderWidth || 1,
          borderRadius: template.chrome.borderRadius || 16,
          shadowPreset: template.chrome.shadowPreset || "none",
          titleColor,
          subtitleColor: darkCanvas ? "#9cc9d0" : "#667085",
          paddingPreset: template.chrome.paddingPreset || "comfortable"
        },
        semantic: {
          primary,
          secondary: isExecutiveInk ? "#b88a44" : isCapitalBlueprint ? "#5b8ff9" : isWarmPaper ? "#c77522" : isVioletGlow ? "#8b5cf6" : isHighlightFrame ? "#4b93ff" : isGlassMinimal ? "#66b5ff" : isNeonFrame ? "#2fb4ff" : primary,
          success: "#12b76a",
          warning: "#f59e0b",
          danger: "#ef4444",
          info: isExecutiveInk ? "#f1d089" : isCapitalBlueprint ? "#78c6f2" : isWarmPaper ? "#e3a24a" : isVioletGlow ? "#22d3ee" : isHighlightFrame ? "#8ab8ff" : isGlassMinimal ? "#8ed5ff" : isNeonFrame ? "#53ddff" : primary,
          textPrimary: isExecutiveInk ? "#f5e6bb" : isCapitalBlueprint ? "#173b68" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#1d3e6f" : isGlassMinimal ? "#24476b" : isNeonFrame ? "#dcf7ff" : darkCanvas ? "#f8fbff" : "#101828",
          textSecondary: isExecutiveInk ? "#c8b48a" : isCapitalBlueprint ? "#5d7798" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : darkCanvas ? "#c7d2e3" : "#667085",
          textTertiary: isExecutiveInk ? "#9f8359" : isCapitalBlueprint ? "#8aa5c6" : isWarmPaper ? "#9d7a52" : isVioletGlow ? "#9b8ac4" : isHighlightFrame ? "#8faed1" : isGlassMinimal ? "#9ab6d3" : isNeonFrame ? "#6aa9bf" : darkCanvas ? "#94a3b8" : "#98a2b3",
          lineSubtle: isExecutiveInk ? "rgba(214,180,86,0.18)" : isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f2ddbf" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : borderColor,
          lineStrong: isExecutiveInk ? "#6a5438" : isCapitalBlueprint ? "#a8c0e6" : isWarmPaper ? "#e0bd89" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#7faef5" : isGlassMinimal ? "#d6e7fb" : isNeonFrame ? "#2a6178" : borderColor
        },
        chartCommon: {
          palette: isExecutiveInk ? executiveInkCommonPalette : isCapitalBlueprint ? capitalBlueprintCommonPalette : isHighlightFrame ? highlightFrameCommonPalette : isGlassMinimal ? glassMinimalCommonPalette : isNeonFrame ? neonFrameCommonPalette : isWarmPaper ? warmPaperCommonPalette : isVioletGlow ? violetGlowCommonPalette : [primary, "#4f8cff", "#76a8ff", "#9cc3ff", "#c6dcff"],
          labelColor: isExecutiveInk ? "#e8d8ae" : isCapitalBlueprint ? "#173b68" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#1d3e6f" : isGlassMinimal ? "#24476b" : isNeonFrame ? "#dcf7ff" : darkCanvas ? "#d4e4f8" : "#344054",
          labelFontSize: 14,
          legendColor: isExecutiveInk ? "#d9c39b" : isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : darkCanvas ? "#d4e4f8" : "#344054",
          legendInactiveColor: isExecutiveInk ? "#8f744d" : isCapitalBlueprint ? "#8aa5c6" : isWarmPaper ? "#b99a75" : isVioletGlow ? "#a89bcb" : isHighlightFrame ? "#9eb9d8" : isGlassMinimal ? "#abc2dd" : isNeonFrame ? "#6aa9bf" : darkCanvas ? "#7f95b2" : "#98a2b3",
          guideLineColor: isExecutiveInk ? "#9b7440" : isCapitalBlueprint ? "#94b7e4" : isWarmPaper ? "#dcb783" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#3db8d6" : borderColor,
          tooltipBackground: isExecutiveInk ? "#241c16" : isWarmPaper ? "#4a2f1f" : isVioletGlow ? "#2e1065" : darkCanvas ? "#0f1f35" : "#101828",
          tooltipTextColor: "#ffffff",
          emphasisShadowColor: isExecutiveInk ? "rgba(214,180,86,0.28)" : isCapitalBlueprint ? "rgba(59,111,182,0.18)" : isWarmPaper ? "rgba(154,79,18,0.16)" : isVioletGlow ? "rgba(109,40,217,0.18)" : isHighlightFrame ? "rgba(75,147,255,0.16)" : isGlassMinimal ? "rgba(102,181,255,0.16)" : isNeonFrame ? "rgba(83,221,255,0.22)" : darkCanvas ? "rgba(52,211,255,0.24)" : "rgba(15,23,42,0.14)"
        },
        chartVariants: {
          pie: {
            palette: isExecutiveInk ? executiveInkCommonPalette : isCapitalBlueprint ? capitalBlueprintCommonPalette : isHighlightFrame ? highlightFrameCommonPalette : isGlassMinimal ? glassMinimalCommonPalette : isNeonFrame ? neonFrameCommonPalette : isWarmPaper ? warmPaperCommonPalette : isVioletGlow ? violetGlowCommonPalette : [primary, "#4f8cff", "#76a8ff", "#9cc3ff", "#c6dcff"],
            centerTitleColor: isExecutiveInk ? "#bfa67a" : isCapitalBlueprint ? "#5d7798" : isWarmPaper ? "#9d7a52" : isVioletGlow ? "#8a79b8" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : darkCanvas ? "#cfe3ff" : "#667085",
            centerValueColor: isExecutiveInk ? "#f5e6bb" : isCapitalBlueprint ? "#173b68" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#1d3e6f" : isGlassMinimal ? "#24476b" : isNeonFrame ? "#dcf7ff" : darkCanvas ? "#f8fbff" : "#101828",
            centerUnitColor: isExecutiveInk ? "#e7d2a5" : isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : darkCanvas ? "#f8fbff" : "#101828",
            centerMetaColor: isExecutiveInk ? "#9f8359" : isCapitalBlueprint ? "#8aa5c6" : isWarmPaper ? "#b99a75" : isVioletGlow ? "#a89bcb" : isHighlightFrame ? "#9eb9d8" : isGlassMinimal ? "#abc2dd" : isNeonFrame ? "#6aa9bf" : darkCanvas ? "#94a3b8" : "#98a2b3",
            labelColor: isExecutiveInk ? "#ddcaa2" : isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : darkCanvas ? "#d4e4f8" : "#344054",
            valueColor: isExecutiveInk ? "#f5e6bb" : isCapitalBlueprint ? "#173b68" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#1d3e6f" : isGlassMinimal ? "#24476b" : isNeonFrame ? "#dcf7ff" : darkCanvas ? "#ffffff" : "#101828",
            guideLineColor: isExecutiveInk ? "#8f6b3b" : isCapitalBlueprint ? "#94b7e4" : isWarmPaper ? "#dcb783" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#3db8d6" : borderColor,
            sliceBorderColor: isExecutiveInk ? "#2a211a" : isCapitalBlueprint ? "#f7fbff" : isWarmPaper ? "#fff7ed" : isVioletGlow ? "#f7f4ff" : isHighlightFrame ? "#ffffff" : isGlassMinimal ? "#f9fcff" : isNeonFrame ? "#0f2c3d" : darkCanvas ? "#16304f" : "#ffffff",
            shadowColor: isExecutiveInk ? "rgba(214,180,86,0.22)" : isCapitalBlueprint ? "rgba(91,143,249,0.18)" : isWarmPaper ? "rgba(154,79,18,0.16)" : isVioletGlow ? "rgba(109,40,217,0.2)" : isHighlightFrame ? "rgba(75,147,255,0.16)" : isGlassMinimal ? "rgba(102,181,255,0.16)" : isNeonFrame ? "rgba(83,221,255,0.22)" : darkCanvas ? "rgba(52,211,255,0.24)" : "rgba(15,23,42,0.14)",
            defaultInnerRadius: 52,
            defaultOuterRadius: 82,
            defaultLabelMode: "outside"
          },
          bar: {
            palette: isExecutiveInk ? executiveInkBarPalette : isCapitalBlueprint ? capitalBlueprintBarPalette : isHighlightFrame ? ["#255fa8", "#4b93ff"] : isGlassMinimal ? ["#2f7cf6", "#66b5ff"] : isNeonFrame ? ["#2fb4ff", "#53ddff"] : isWarmPaper ? warmPaperBarPalette : isVioletGlow ? violetGlowBarPalette : template.category === "dark" ? [primary, "#c89b5c"] : template.category === "warm" ? [primary, "#9f8a4d"] : template.category === "green" ? [primary, "#4fae9a"] : template.category === "purple" ? [primary, "#d07ce3"] : template.category === "blue" ? [primary, "#43c7c6"] : [primary, "#6f8fb8"],
            labelColor: isExecutiveInk ? "#f7ecd0" : isCapitalBlueprint ? "#24476b" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#ffffff" : isGlassMinimal ? "#ffffff" : isNeonFrame ? "#eafcff" : darkCanvas ? "#d4e4f8" : "#ffffff",
            legendColor: isExecutiveInk ? "#dcc9a0" : isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : darkCanvas ? "#e8d8ae" : "#344054",
            axisColor: isExecutiveInk ? "#725838" : isCapitalBlueprint ? "#9db8de" : isWarmPaper ? "#d8b98a" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#2a6178" : darkCanvas ? "#6b5a3e" : borderColor,
            axisLabelColor: isExecutiveInk ? "#c8b48a" : isCapitalBlueprint ? "#4f6988" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : darkCanvas ? "#e8d8ae" : titleColor,
            splitLineColor: isExecutiveInk ? "rgba(214,180,86,0.14)" : isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f0dcc0" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : darkCanvas ? "rgba(214,180,86,0.16)" : borderColor,
            barBorderRadius: 8
          },
          horizontalBar: {
            palette: isExecutiveInk ? executiveInkHorizontalPalette : isCapitalBlueprint ? capitalBlueprintHorizontalPalette : isHighlightFrame ? highlightFrameHorizontalPalette : isGlassMinimal ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"] : isNeonFrame ? ["#2fb4ff", "#53ddff", "#59f0dc", "#8ec5ff", "#c6ecff"] : isWarmPaper ? warmPaperHorizontalPalette : isVioletGlow ? violetGlowHorizontalPalette : template.category === "dark" ? [primary, "#c89b5c", "#f0bf62", "#8b78e6", "#ef8f98"] : template.category === "warm" ? [primary, "#9f8a4d", "#d08b57", "#c77d36", "#7b5a34"] : template.category === "green" ? [primary, "#4fae9a", "#8fcf6a", "#3aa7d1", "#6bc18f"] : template.category === "purple" ? [primary, "#d07ce3", "#f0b455", "#8f7cff", "#ef8fc8"] : template.category === "blue" ? [primary, "#43c7c6", "#f4b95d", "#8f7cff", "#f28f8f"] : [primary, "#6f8fb8", "#f4b95d", "#8f7cff", "#f28f8f"],
            labelColor: isExecutiveInk ? "#1b1714" : isCapitalBlueprint ? "#24476b" : isWarmPaper ? "#fff8ee" : isVioletGlow ? "#ffffff" : isHighlightFrame ? "#ffffff" : isGlassMinimal ? "#ffffff" : isNeonFrame ? "#062231" : darkCanvas ? "#d4e4f8" : "#ffffff",
            legendColor: isExecutiveInk ? "#dcc9a0" : isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : darkCanvas ? "#e8d8ae" : "#344054",
            axisColor: isExecutiveInk ? "#725838" : isCapitalBlueprint ? "#9db8de" : isWarmPaper ? "#d8b98a" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#2a6178" : darkCanvas ? "#6b5a3e" : borderColor,
            axisLabelColor: isExecutiveInk ? "#c8b48a" : isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : darkCanvas ? "#e8d8ae" : titleColor,
            splitLineColor: isExecutiveInk ? "rgba(214,180,86,0.14)" : isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f0dcc0" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : darkCanvas ? "rgba(214,180,86,0.16)" : borderColor,
            barBorderRadius: 10,
            colorCount: 5
          },
          sankey: {
            palette: isExecutiveInk ? executiveInkHorizontalPalette : isCapitalBlueprint ? capitalBlueprintHorizontalPalette : isHighlightFrame ? highlightFrameHorizontalPalette : isGlassMinimal ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"] : isNeonFrame ? ["#2fb4ff", "#53ddff", "#59f0dc", "#8ec5ff", "#c6ecff"] : isWarmPaper ? warmPaperHorizontalPalette : isVioletGlow ? violetGlowHorizontalPalette : template.category === "dark" ? [primary, "#c89b5c", "#f0bf62", "#8b78e6", "#ef8f98"] : template.category === "warm" ? [primary, "#9f8a4d", "#d08b57", "#c77d36", "#7b5a34"] : template.category === "green" ? [primary, "#4fae9a", "#8fcf6a", "#3aa7d1", "#6bc18f"] : template.category === "purple" ? [primary, "#d07ce3", "#f0b455", "#8f7cff", "#ef8fc8"] : template.category === "blue" ? [primary, "#43c7c6", "#f4b95d", "#8f7cff", "#f28f8f"] : [primary, "#6f8fb8", "#f4b95d", "#8f7cff", "#f28f8f"],
            labelColor: isExecutiveInk ? "#c8b48a" : isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : darkCanvas ? "#e8d8ae" : titleColor,
            nodeBorderColor: isExecutiveInk ? "#2a211a" : isCapitalBlueprint ? "#f7fbff" : isWarmPaper ? "#fff7ed" : isVioletGlow ? "#f7f4ff" : isHighlightFrame ? "#ffffff" : isGlassMinimal ? "#f9fcff" : isNeonFrame ? "#0f2c3d" : darkCanvas ? "#16304f" : "#ffffff",
            nodeBorderWidth: 1,
            nodeBorderRadius: isExecutiveInk ? 3 : isNeonFrame ? 5 : 4,
            linkOpacity: isExecutiveInk ? 0.34 : isCapitalBlueprint ? 0.3 : isWarmPaper ? 0.32 : isVioletGlow ? 0.3 : isNeonFrame ? 0.34 : darkCanvas ? 0.32 : 0.28,
            linkCurveness: isWarmPaper ? 0.42 : isExecutiveInk ? 0.46 : isVioletGlow ? 0.52 : 0.5
          },
          gauge: {
            palette: isExecutiveInk ? executiveInkHorizontalPalette : isCapitalBlueprint ? capitalBlueprintHorizontalPalette : isHighlightFrame ? highlightFrameHorizontalPalette : isGlassMinimal ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"] : isNeonFrame ? ["#2fb4ff", "#53ddff", "#59f0dc", "#8ec5ff", "#c6ecff"] : isWarmPaper ? warmPaperHorizontalPalette : isVioletGlow ? violetGlowHorizontalPalette : template.category === "dark" ? [primary, "#c89b5c", "#f0bf62", "#8b78e6", "#ef8f98"] : template.category === "warm" ? [primary, "#9f8a4d", "#d08b57", "#c77d36", "#7b5a34"] : template.category === "green" ? [primary, "#4fae9a", "#8fcf6a", "#3aa7d1", "#6bc18f"] : template.category === "purple" ? [primary, "#d07ce3", "#f0b455", "#8f7cff", "#ef8fc8"] : template.category === "blue" ? [primary, "#43c7c6", "#f4b95d", "#8f7cff", "#f28f8f"] : [primary, "#6f8fb8", "#f4b95d", "#8f7cff", "#f28f8f"],
            pointerColor: isExecutiveInk ? "#f1d089" : isCapitalBlueprint ? "#3b6fb6" : isWarmPaper ? "#d88428" : isVioletGlow ? "#8b5cf6" : isHighlightFrame ? "#4b93ff" : isGlassMinimal ? "#2f7cf6" : isNeonFrame ? "#53ddff" : primary,
            detailColor: isExecutiveInk ? "#f5e6bb" : isCapitalBlueprint ? "#173b68" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#1d3e6f" : isGlassMinimal ? "#24476b" : isNeonFrame ? "#dcf7ff" : darkCanvas ? "#ffffff" : "#101828",
            titleColor: isExecutiveInk ? "#bfa67a" : isCapitalBlueprint ? "#5d7798" : isWarmPaper ? "#9d7a52" : isVioletGlow ? "#8a79b8" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : darkCanvas ? "#cfe3ff" : "#667085",
            axisLabelColor: isExecutiveInk ? "#c8b48a" : isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : darkCanvas ? "#e8d8ae" : titleColor,
            splitLineColor: isExecutiveInk ? "#8f6b3b" : isCapitalBlueprint ? "#94b7e4" : isWarmPaper ? "#dcb783" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#3db8d6" : borderColor,
            startAngle: 210,
            endAngle: -30,
            radius: "90%",
            progressWidth: isExecutiveInk ? 16 : isNeonFrame ? 20 : 18,
            axisLineWidth: isExecutiveInk ? 16 : isNeonFrame ? 20 : 18,
            pointerLength: isWarmPaper ? "56%" : isNeonFrame ? "60%" : "58%",
            detailFontSize: isExecutiveInk ? 26 : 24,
            detailFontWeight: isExecutiveInk ? 800 : 700,
            titleFontSize: 14
          },
          funnel: {
            palette: isExecutiveInk ? executiveInkHorizontalPalette : isCapitalBlueprint ? capitalBlueprintHorizontalPalette : isHighlightFrame ? highlightFrameHorizontalPalette : isGlassMinimal ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"] : isNeonFrame ? ["#2fb4ff", "#53ddff", "#59f0dc", "#8ec5ff", "#c6ecff"] : isWarmPaper ? warmPaperHorizontalPalette : isVioletGlow ? violetGlowHorizontalPalette : template.category === "dark" ? [primary, "#c89b5c", "#f0bf62", "#8b78e6", "#ef8f98"] : template.category === "warm" ? [primary, "#9f8a4d", "#d08b57", "#c77d36", "#7b5a34"] : template.category === "green" ? [primary, "#4fae9a", "#8fcf6a", "#3aa7d1", "#6bc18f"] : template.category === "purple" ? [primary, "#d07ce3", "#f0b455", "#8f7cff", "#ef8fc8"] : template.category === "blue" ? [primary, "#43c7c6", "#f4b95d", "#8f7cff", "#f28f8f"] : [primary, "#6f8fb8", "#f4b95d", "#8f7cff", "#f28f8f"],
            labelColor: isExecutiveInk ? "#c8b48a" : isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : darkCanvas ? "#e8d8ae" : titleColor,
            valueColor: isExecutiveInk ? "#f5e6bb" : isCapitalBlueprint ? "#173b68" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#1d3e6f" : isGlassMinimal ? "#24476b" : isNeonFrame ? "#dcf7ff" : darkCanvas ? "#ffffff" : "#101828",
            guideLineColor: isExecutiveInk ? "#8f6b3b" : isCapitalBlueprint ? "#94b7e4" : isWarmPaper ? "#dcb783" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#3db8d6" : borderColor,
            blockBorderColor: isExecutiveInk ? "#2a211a" : isCapitalBlueprint ? "#f7fbff" : isWarmPaper ? "#fff7ed" : isVioletGlow ? "#f7f4ff" : isHighlightFrame ? "#ffffff" : isGlassMinimal ? "#f9fcff" : isNeonFrame ? "#0f2c3d" : darkCanvas ? "#16304f" : "#ffffff",
            blockBorderWidth: 1,
            itemGap: isExecutiveInk ? 3 : isWarmPaper ? 4 : 2,
            sortOrder: "descending"
          },
          wordCloud: {
            palette: isExecutiveInk ? executiveInkHorizontalPalette : isCapitalBlueprint ? capitalBlueprintHorizontalPalette : isHighlightFrame ? highlightFrameHorizontalPalette : isGlassMinimal ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"] : isNeonFrame ? ["#2fb4ff", "#53ddff", "#59f0dc", "#8ec5ff", "#c6ecff"] : isWarmPaper ? warmPaperHorizontalPalette : isVioletGlow ? violetGlowHorizontalPalette : template.category === "dark" ? [primary, "#c89b5c", "#f0bf62", "#8b78e6", "#ef8f98"] : template.category === "warm" ? [primary, "#9f8a4d", "#d08b57", "#c77d36", "#7b5a34"] : template.category === "green" ? [primary, "#4fae9a", "#8fcf6a", "#3aa7d1", "#6bc18f"] : template.category === "purple" ? [primary, "#d07ce3", "#f0b455", "#8f7cff", "#ef8fc8"] : template.category === "blue" ? [primary, "#43c7c6", "#f4b95d", "#8f7cff", "#f28f8f"] : [primary, "#6f8fb8", "#f4b95d", "#8f7cff", "#f28f8f"],
            shape: isWarmPaper ? "cardioid" : isVioletGlow || isNeonFrame ? "diamond" : "circle",
            gridSize: isExecutiveInk ? 9 : isWarmPaper ? 12 : 10,
            rotationStep: isNeonFrame ? 90 : 45,
            minFontSize: 12,
            maxFontSize: isExecutiveInk ? 44 : 40,
            fontWeight: isExecutiveInk ? 800 : 700,
            textShadowColor: isExecutiveInk ? "rgba(214,180,86,0.26)" : isCapitalBlueprint ? "rgba(59,111,182,0.18)" : isWarmPaper ? "rgba(154,79,18,0.18)" : isVioletGlow ? "rgba(109,40,217,0.2)" : isHighlightFrame ? "rgba(75,147,255,0.18)" : isGlassMinimal ? "rgba(102,181,255,0.18)" : isNeonFrame ? "rgba(83,221,255,0.28)" : darkCanvas ? "rgba(52,211,255,0.26)" : "rgba(15,23,42,0.12)",
            textShadowBlur: isNeonFrame ? 18 : darkCanvas ? 14 : 10
          },
          line: {
            palette: isExecutiveInk ? executiveInkLinePalette : isCapitalBlueprint ? capitalBlueprintLinePalette : isWarmPaper ? warmPaperLinePalette : isVioletGlow ? violetGlowLinePalette : isHighlightFrame ? ["#255fa8", "#4b93ff", "#8ab8ff", "#bed7ff"] : isGlassMinimal ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff"] : isNeonFrame ? ["#53ddff", "#2fb4ff", "#59f0dc", "#8ec5ff"] : [primary, "#4f8cff", "#76a8ff", "#9cc3ff"],
            lineWidth: isExecutiveInk ? 3 : 3,
            lineSmooth: true,
            showSymbol: true,
            symbolSize: isExecutiveInk ? 6 : 5,
            labelPosition: "top",
            pointBorderColor: isExecutiveInk ? "#14110f" : isWarmPaper ? "#fff7ed" : isVioletGlow ? "#f7f4ff" : isNeonFrame ? "#081521" : "#ffffff",
            areaOpacity: isExecutiveInk ? 0.14 : isCapitalBlueprint ? 0.16 : isWarmPaper ? 0.18 : isVioletGlow ? 0.16 : isGlassMinimal ? 0.14 : isNeonFrame ? 0.16 : 0.18,
            axisColor: isExecutiveInk ? "#725838" : isCapitalBlueprint ? "#9db8de" : isWarmPaper ? "#d8b98a" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#2a6178" : borderColor,
            axisLabelColor: isExecutiveInk ? "#c8b48a" : isCapitalBlueprint ? "#4f6988" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : titleColor,
            splitLineColor: isExecutiveInk ? "rgba(214,180,86,0.14)" : isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f0dcc0" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : borderColor
          },
          area: {
            palette: isExecutiveInk ? executiveInkLinePalette : isCapitalBlueprint ? capitalBlueprintLinePalette : isWarmPaper ? warmPaperLinePalette : isVioletGlow ? violetGlowLinePalette : isHighlightFrame ? ["#255fa8", "#4b93ff", "#8ab8ff", "#bed7ff"] : isGlassMinimal ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff"] : isNeonFrame ? ["#53ddff", "#2fb4ff", "#59f0dc", "#8ec5ff"] : [primary, "#4f8cff", "#76a8ff", "#9cc3ff"],
            lineWidth: 3,
            lineSmooth: true,
            showSymbol: true,
            symbolSize: 6,
            labelPosition: "top",
            pointBorderColor: isExecutiveInk ? "#14110f" : isWarmPaper ? "#fff7ed" : isVioletGlow ? "#f7f4ff" : isNeonFrame ? "#081521" : "#ffffff",
            areaOpacity: isExecutiveInk ? 0.24 : isCapitalBlueprint ? 0.2 : isWarmPaper ? 0.22 : isVioletGlow ? 0.2 : isGlassMinimal ? 0.18 : isNeonFrame ? 0.22 : 0.24,
            axisColor: isExecutiveInk ? "#725838" : isCapitalBlueprint ? "#9db8de" : isWarmPaper ? "#d8b98a" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#2a6178" : borderColor,
            axisLabelColor: isExecutiveInk ? "#c8b48a" : isCapitalBlueprint ? "#4f6988" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : titleColor,
            splitLineColor: isExecutiveInk ? "rgba(214,180,86,0.14)" : isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f0dcc0" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : borderColor
          },
          scatter: {
            palette: isExecutiveInk ? executiveInkHorizontalPalette : isCapitalBlueprint ? capitalBlueprintHorizontalPalette : isHighlightFrame ? highlightFrameHorizontalPalette : isGlassMinimal ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff", "#d5e6ff"] : isNeonFrame ? ["#2fb4ff", "#53ddff", "#59f0dc", "#8ec5ff", "#c6ecff"] : isWarmPaper ? warmPaperHorizontalPalette : isVioletGlow ? violetGlowHorizontalPalette : template.category === "dark" ? [primary, "#c89b5c", "#f0bf62", "#8b78e6", "#ef8f98"] : template.category === "warm" ? [primary, "#9f8a4d", "#d08b57", "#c77d36", "#7b5a34"] : template.category === "green" ? [primary, "#4fae9a", "#8fcf6a", "#3aa7d1", "#6bc18f"] : template.category === "purple" ? [primary, "#d07ce3", "#f0b455", "#8f7cff", "#ef8fc8"] : template.category === "blue" ? [primary, "#43c7c6", "#f4b95d", "#8f7cff", "#f28f8f"] : [primary, "#6f8fb8", "#f4b95d", "#8f7cff", "#f28f8f"],
            labelColor: isExecutiveInk ? "#c8b48a" : isCapitalBlueprint ? "#4f6988" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : titleColor,
            legendColor: isExecutiveInk ? "#dcc9a0" : isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : darkCanvas ? "#e8d8ae" : "#344054",
            axisColor: isExecutiveInk ? "#725838" : isCapitalBlueprint ? "#9db8de" : isWarmPaper ? "#d8b98a" : isVioletGlow ? "#c4b5fd" : isHighlightFrame ? "#8fb8fa" : isGlassMinimal ? "#c1d8f8" : isNeonFrame ? "#2a6178" : borderColor,
            axisLabelColor: isExecutiveInk ? "#c8b48a" : isCapitalBlueprint ? "#4f6988" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : titleColor,
            splitLineColor: isExecutiveInk ? "rgba(214,180,86,0.14)" : isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f0dcc0" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : borderColor,
            symbolSize: isExecutiveInk ? 18 : isNeonFrame ? 18 : 16,
            pointBorderColor: isExecutiveInk ? "#14110f" : isWarmPaper ? "#fff7ed" : isVioletGlow ? "#f7f4ff" : isNeonFrame ? "#081521" : "#ffffff",
            pointBorderWidth: isExecutiveInk ? 2 : 1,
            pointOpacity: isExecutiveInk ? 0.86 : isNeonFrame ? 0.88 : 0.82,
            labelPosition: "top"
          },
          radar: {
            palette: isExecutiveInk ? executiveInkLinePalette : isCapitalBlueprint ? capitalBlueprintLinePalette : isWarmPaper ? warmPaperLinePalette : isVioletGlow ? violetGlowLinePalette : isHighlightFrame ? ["#255fa8", "#4b93ff", "#8ab8ff", "#bed7ff"] : isGlassMinimal ? ["#2f7cf6", "#66b5ff", "#8ed5ff", "#a7c4ff"] : isNeonFrame ? ["#53ddff", "#2fb4ff", "#59f0dc", "#8ec5ff"] : [primary, "#4f8cff", "#76a8ff", "#9cc3ff"],
            gridLineColor: isExecutiveInk ? "rgba(214,180,86,0.18)" : isCapitalBlueprint ? "#d8e6f8" : isWarmPaper ? "#f0dcc0" : isVioletGlow ? "#eadfff" : isHighlightFrame ? "#d9e6fb" : isGlassMinimal ? "#e7f0fb" : isNeonFrame ? "rgba(83,221,255,0.16)" : "#dbe7f3",
            indicatorTextColor: isExecutiveInk ? "#d9c39b" : isCapitalBlueprint ? "#4f6988" : isWarmPaper ? "#765334" : isVioletGlow ? "#6b5a91" : isHighlightFrame ? "#5f7ea8" : isGlassMinimal ? "#6b8cad" : isNeonFrame ? "#9fd9e8" : "#344054",
            areaOpacity: isExecutiveInk ? 0.18 : isCapitalBlueprint ? 0.18 : isWarmPaper ? 0.2 : isVioletGlow ? 0.18 : isGlassMinimal ? 0.16 : isNeonFrame ? 0.18 : 0.22,
            pointColor: isExecutiveInk ? "#f1d089" : isCapitalBlueprint ? "#3b6fb6" : isWarmPaper ? "#d88428" : isVioletGlow ? "#8b5cf6" : isHighlightFrame ? "#4b93ff" : isGlassMinimal ? "#66b5ff" : isNeonFrame ? "#53ddff" : "#1677ff",
            primaryColor: isExecutiveInk ? executiveInkLinePalette[0] : isCapitalBlueprint ? capitalBlueprintLinePalette[0] : isWarmPaper ? warmPaperLinePalette[0] : isVioletGlow ? violetGlowLinePalette[0] : isHighlightFrame ? "#255fa8" : isGlassMinimal ? "#2f7cf6" : isNeonFrame ? "#53ddff" : primary,
            secondaryColor: isExecutiveInk ? executiveInkLinePalette[1] : isCapitalBlueprint ? capitalBlueprintLinePalette[1] : isWarmPaper ? warmPaperLinePalette[1] : isVioletGlow ? violetGlowLinePalette[1] : isHighlightFrame ? "#4b93ff" : isGlassMinimal ? "#66b5ff" : isNeonFrame ? "#2fb4ff" : "#4f8cff"
          },
          map: {
            regionPalette: isExecutiveInk ? executiveInkMapPalette : isCapitalBlueprint ? capitalBlueprintMapPalette : isWarmPaper ? warmPaperMapPalette : isVioletGlow ? violetGlowMapPalette : isHighlightFrame ? ["#eef5ff", "#d4e4ff", "#a8c7ff", "#4b93ff", "#255fa8"] : isGlassMinimal ? ["#f1f7ff", "#dff0ff", "#b7ddff", "#7fbfff", "#2f7cf6"] : isNeonFrame ? neonFrameMapPalette : template.category === "dark" ? ["#0f1f35", "#17304f", "#275d7a", primary, "#7dd3fc"] : template.category === "warm" ? ["#fbf8f2", "#ead8b9", "#d7b489", "#a06b2c", primary] : template.category === "green" ? ["#effcf6", "#d8f3e5", "#9edbb8", "#4fae9a", primary] : template.category === "purple" ? ["#f7f4ff", "#eadfff", "#c4b5fd", "#8b5cf6", primary] : template.category === "blue" ? ["#eef5ff", "#d5e6ff", "#9cc3ff", "#4f8cff", primary] : ["#f7f8fa", "#e2e8f0", "#cbd5e1", "#94a3b8", primary],
            regionBorderColor: isExecutiveInk ? "#8f6b3b" : isCapitalBlueprint ? "#8fb1d6" : isWarmPaper ? "#d8a86a" : isVioletGlow ? "#a78bfa" : isNeonFrame ? "#2fb4ff" : borderColor,
            labelColor: isExecutiveInk ? "#e7d2a5" : isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#654321" : isVioletGlow ? "#4c1d95" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : template.category === "warm" ? "#765334" : template.category === "green" ? "#486b57" : template.category === "purple" ? darkCanvas ? "#d8ccff" : "#6b5a91" : darkCanvas ? "#d4e4f8" : "#344054",
            visualMapTextColor: isExecutiveInk ? "#d9c39b" : isCapitalBlueprint ? "#31587f" : isWarmPaper ? "#765334" : isVioletGlow ? "#5b21b6" : isHighlightFrame ? "#355b8a" : isGlassMinimal ? "#567ca7" : isNeonFrame ? "#bceeff" : template.category === "warm" ? "#8c745a" : template.category === "green" ? "#4f7c69" : template.category === "purple" ? darkCanvas ? "#c7badb" : "#8a79b8" : darkCanvas ? "#c7d2e3" : "#344054"
          },
          kpi: {
            valueColor: template.kpiStyle.valueColor || primary,
            labelColor: template.kpiStyle.metricLabelColor || (darkCanvas ? "#9cc9d0" : "#667085"),
            compareColor: template.kpiStyle.compareLabelColor || primary,
            dividerColor: template.kpiStyle.dividerColor || borderColor,
            itemBackgroundColor: template.kpiStyle.itemBackgroundColor || backgroundColor,
            flipperBackground: template.kpiStyle.flipperBackground || buildFlipperBackground(template.kpiStyle.valueColor || primary, template.kpiStyle.itemBackgroundColor || backgroundColor, template.category),
            progressTrackColor: isWarmPaper ? "#f4dfc1" : isVioletGlow ? "#e9ddff" : darkCanvas ? "#17304f" : "#edf4ff",
            progressFillColor: template.kpiStyle.valueColor || primary
          },
          table: {
            headerBackground: isWarmPaper ? "#fff0d9" : isVioletGlow ? "#f1ebff" : darkCanvas ? "#10223d" : backgroundColor,
            headerTextColor: titleColor,
            rowBackground: isWarmPaper ? "#fffaf3" : isVioletGlow ? "#fbfaff" : backgroundColor,
            rowAlternateBackground: isWarmPaper ? "#fff4e6" : isVioletGlow ? "#f6f1ff" : darkCanvas ? "rgba(14,28,49,0.92)" : "#fafcff",
            rowBorderColor: borderColor
          },
          tabs: {
            tabBarBackground: isWarmPaper ? "#fff0d9" : isVioletGlow ? "#f1ebff" : darkCanvas ? "#10223d" : backgroundColor,
            activeTextColor: primary,
            inactiveTextColor: isWarmPaper ? "#9d7a52" : isVioletGlow ? "#8a79b8" : darkCanvas ? "#8aa4c7" : "#667085",
            activeBackground: isWarmPaper ? "#fff8ee" : isVioletGlow ? "#ffffff" : darkCanvas ? "rgba(52,211,255,0.12)" : "#ffffff",
            indicatorColor: primary
          }
        }
      };
    }
    var BUILTIN_THEME_TEMPLATES = KPI_THEME_TEMPLATES.filter((template) => !["mist-card", "number-banner", "progress-focus", "coral-panel"].includes(template.key)).map(toThemeTemplate);
    module2.exports = {
      BUILTIN_THEME_TEMPLATES
    };
  }
});

// backend/src/modules/reporting/reporting.service.js
var require_reporting_service = __commonJS({
  "backend/src/modules/reporting/reporting.service.js"(exports2, module2) {
    var mysql = require("mysql2/promise");
    var crypto = require("crypto");
    var { Parser } = require("node-sql-parser");
    var AppError = require_app_error();
    var metadataService = require_data_source_metadata();
    var modelProviderService = require_model_provider_service();
    var { testDatabaseConnection } = require_data_source_test_connection();
    var { createPostgresLikeClient } = require_db_client();
    var { resolveDatasourceConnection } = require_datasource_dialect();
    var { getAdapter } = require_adapters();
    var { getManagedBinding } = require_managed_jdbc_runtime();
    var { pool } = require_database();
    var { decryptSecret } = require_data_development_utils();
    var { getCurrentProjectId } = require_project_context();
    var repository = require_reporting_repository();
    var reportingAiConfigService = require_reporting_ai_config_service();
    var { BUILTIN_THEME_TEMPLATES } = require_reporting_theme_presets();
    var sqlParser = new Parser();
    var AI_ANALYSIS_SUGGESTION_SCENE_CODE = "chart_analysis_suggestion";
    var AI_SQL_PLAN_SCENE_CODE = "chart_sql_plan";
    var AI_SQL_REVISION_SCENE_CODE = "chart_sql_revision";
    var AI_CHART_RECOMMENDATION_SCENE_CODE = "chart_recommendation";
    var AI_CHART_FIELD_MAP_SCENE_CODE = "chart_field_mapping";
    var MAX_AI_AVAILABLE_TABLES = 80;
    var MAX_AI_SCHEMA_TABLES = 5;
    var MAX_AI_SELECTED_TABLES = 5;
    var MAX_AI_TABLE_SAMPLE_ROWS = 50;
    var MAX_AI_TABLE_SAMPLE_VALUE_LENGTH = 100;
    var MAX_AI_SAMPLE_ROWS = 100;
    var MAX_AI_QUERY_LIMIT = 100;
    var AI_QUERY_TIMEOUT_MS = 3e4;
    var AI_SUPPORTED_CHART_FAMILIES = [
      "bar",
      "horizontalBar",
      "line",
      "area",
      "pie",
      "radar",
      "combo",
      "scatterBubble",
      "heatmap",
      "map",
      "treemap",
      "sankey",
      "gauge",
      "funnel",
      "wordCloud"
    ];
    function normalizeText(value, fallback = "") {
      const normalized = String(value || "").trim();
      return normalized || fallback;
    }
    function uniqueStrings(values = []) {
      return Array.from(
        new Set(
          (Array.isArray(values) ? values : []).map((item) => normalizeText(item)).filter(Boolean)
        )
      );
    }
    function resolvePublishAllowedUsernames(publishConfig = {}) {
      const allowedUsernames = uniqueStrings(publishConfig.allowedUsernames);
      if (allowedUsernames.length) {
        return allowedUsernames;
      }
      const allowedUsername = normalizeText(publishConfig.allowedUsername);
      return allowedUsername ? [allowedUsername] : [];
    }
    function asArray(value) {
      return Array.isArray(value) ? value : [];
    }
    function normalizeChartFamily(value = "") {
      const normalized = String(value || "").trim();
      const lower = normalized.toLowerCase();
      if (!lower) return "";
      if (lower.includes("wordcloud") || lower.includes("word cloud") || lower.includes("\u8BCD\u4E91")) return "wordCloud";
      if (["horizontalbar", "horizontal_bar", "bar_horizontal"].includes(lower) || lower.includes("horizontal") || lower.includes("\u6761\u5F62")) return "horizontalBar";
      if (["scatterbubble", "scatter_bubble"].includes(lower) || lower.includes("scatter") || lower.includes("bubble") || lower.includes("\u6563\u70B9") || lower.includes("\u6C14\u6CE1")) return "scatterBubble";
      if (lower.includes("combo") || lower.includes("\u7EC4\u5408")) return "combo";
      if (lower.includes("sankey") || lower.includes("\u6851\u57FA")) return "sankey";
      if (lower.includes("treemap") || lower.includes("tree") || lower.includes("\u6811\u56FE")) return "treemap";
      if (lower.includes("heat") || lower.includes("\u70ED\u529B")) return "heatmap";
      if (lower.includes("map") || lower.includes("\u5730\u56FE")) return "map";
      if (lower.includes("radar") || lower.includes("\u96F7\u8FBE")) return "radar";
      if (lower.includes("gauge") || lower.includes("\u4EEA\u8868")) return "gauge";
      if (lower.includes("funnel") || lower.includes("\u6F0F\u6597")) return "funnel";
      if (lower.includes("area") || lower.includes("\u9762\u79EF")) return "area";
      if (lower.includes("pie") || lower.includes("rose") || lower.includes("\u997C") || lower.includes("\u73AF\u5F62") || lower.includes("\u73AB\u7470")) return "pie";
      if (lower.includes("line") || lower.includes("\u6298\u7EBF")) return "line";
      if (lower.includes("bar") || lower.includes("column") || lower.includes("\u67F1")) return "bar";
      return normalized;
    }
    function normalizeChartAssetFamily(asset = null) {
      if (!asset) return "";
      return normalizeChartFamily(
        asset.chartFamily || asset.config?.chartFamily || asset.chartCode || asset.chartName || asset.category
      );
    }
    function buildProviderSummary(provider) {
      return provider ? {
        id: provider.id,
        configName: provider.configName,
        providerType: provider.providerType,
        modelName: provider.modelName,
        modelVersion: provider.modelVersion || null
      } : null;
    }
    async function recordReportingAiRun(payload = {}) {
      try {
        return await repository.createReportingAiRun(payload);
      } catch (error) {
        console.warn("[reporting-ai] failed to record ai run", error.message || error);
        return null;
      }
    }
    function renderPromptTemplate(template = "", variables = {}) {
      const source = String(template || "");
      if (!source) return "";
      return source.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
        const value = variables[key];
        if (value === null || value === void 0) return "";
        return typeof value === "string" ? value : JSON.stringify(value, null, 2);
      });
    }
    function buildShareToken() {
      return crypto.randomBytes(16).toString("hex");
    }
    function sanitizeSqlText(sql = "") {
      return String(sql || "").replace(/;\s*$/g, "").trim();
    }
    function buildAiSqlDialectRules(dialect) {
      const normalizedDialect = String(dialect || "mysql").trim().toLowerCase();
      const rules = [
        `\u5FC5\u987B\u4E25\u683C\u8F93\u51FA ${normalizedDialect || "mysql"} \u65B9\u8A00 SQL\uFF0C\u4E0D\u5141\u8BB8\u6DF7\u7528\u5176\u4ED6\u6570\u636E\u5E93\u7684\u51FD\u6570\u3001\u7C7B\u578B\u8F6C\u6362\u3001\u5206\u9875\u3001\u65E5\u671F\u6216\u5B57\u7B26\u4E32\u8BED\u6CD5\u3002`,
        "\u5982\u679C\u5B57\u6BB5\u7C7B\u578B\u4E0D\u786E\u5B9A\uFF0C\u4F18\u5148\u4F7F\u7528\u66F4\u7A33\u59A5\u3001\u517C\u5BB9\u5F53\u524D\u65B9\u8A00\u7684\u663E\u5F0F CAST/COALESCE/\u65E5\u671F\u51FD\u6570\u5199\u6CD5\u3002"
      ];
      if (normalizedDialect === "postgresql" || normalizedDialect === "gaussdb") {
        rules.push(
          "PostgreSQL/GaussDB \u793A\u4F8B: \u65E5\u671F\u805A\u5408\u4F18\u5148\u4F7F\u7528 DATE_TRUNC \u6216 EXTRACT\uFF0C\u683C\u5F0F\u5316\u4F18\u5148\u4F7F\u7528 TO_CHAR\uFF0C\u7C7B\u578B\u8F6C\u6362\u53EF\u4F7F\u7528 CAST(...) \u6216 ::type\uFF0C\u5B57\u7B26\u4E32\u5339\u914D\u53EF\u4F7F\u7528 ILIKE\u3002",
          "\u4E0D\u8981\u4F7F\u7528 MySQL \u4E13\u5C5E\u8BED\u6CD5\uFF0C\u4F8B\u5982 DATE_FORMAT\u3001STR_TO_DATE\u3001IFNULL\u3001TIMESTAMPDIFF\u3001LIMIT offset,count\u3002"
        );
        return rules;
      }
      if (normalizedDialect === "oracle") {
        rules.push(
          "Oracle \u793A\u4F8B: \u65E5\u671F\u683C\u5F0F\u5316\u4F7F\u7528 TO_CHAR\uFF0C\u65E5\u671F\u89E3\u6790\u4F7F\u7528 TO_DATE/TO_TIMESTAMP\uFF0C\u7A7A\u503C\u5904\u7406\u4F7F\u7528 COALESCE/NVL\uFF0C\u968F\u673A\u6392\u5E8F\u4F7F\u7528 DBMS_RANDOM.VALUE\uFF0C\u9650\u5236\u884C\u6570\u4F7F\u7528 FETCH FIRST \u6216 ROWNUM\u3002",
          "\u4E0D\u8981\u4F7F\u7528 MySQL \u4E13\u5C5E\u8BED\u6CD5\uFF0C\u4F8B\u5982\u53CD\u5F15\u53F7\u3001DATE_FORMAT\u3001STR_TO_DATE\u3001IFNULL\u3001LIMIT\u3002"
        );
        return rules;
      }
      if (normalizedDialect === "dm") {
        rules.push(
          "\u8FBE\u68A6\u6570\u636E\u5E93\u793A\u4F8B: \u6807\u8BC6\u7B26\u4F7F\u7528\u53CC\u5F15\u53F7\uFF0C\u65E5\u671F\u683C\u5F0F\u5316\u4F7F\u7528 TO_CHAR\uFF0C\u9650\u5236\u884C\u6570\u4F7F\u7528 OFFSET ... FETCH \u6216 FETCH FIRST\u3002",
          "\u4E0D\u8981\u4F7F\u7528 MySQL \u4E13\u5C5E\u8BED\u6CD5\uFF0C\u4F8B\u5982\u53CD\u5F15\u53F7\u3001LIMIT offset,count\u3002"
        );
        return rules;
      }
      rules.push(
        "MySQL \u793A\u4F8B: \u65E5\u671F\u683C\u5F0F\u5316\u4F18\u5148\u4F7F\u7528 DATE_FORMAT\uFF0C\u65E5\u671F\u89E3\u6790\u4F18\u5148\u4F7F\u7528 STR_TO_DATE\uFF0C\u7A7A\u503C\u5904\u7406\u4F18\u5148\u4F7F\u7528 IFNULL \u6216 COALESCE\uFF0C\u65F6\u95F4\u5DEE\u4F18\u5148\u4F7F\u7528 TIMESTAMPDIFF\u3002",
        "\u4E0D\u8981\u4F7F\u7528 PostgreSQL \u4E13\u5C5E\u8BED\u6CD5\uFF0C\u4F8B\u5982 ::type\u3001ILIKE\u3001DATE_TRUNC\u3001TO_CHAR\u3001OFFSET ... FETCH\u3002"
      );
      return rules;
    }
    function buildAiSqlAutoRevisionInstruction(dialect, reason = "") {
      const normalizedReason = normalizeText(reason);
      return [
        `\u8BF7\u4E25\u683C\u6309\u7167\u5F53\u524D\u6570\u636E\u6E90\u7684 ${dialect} \u65B9\u8A00\u4FEE\u590D SQL\u3002`,
        "\u4FDD\u7559\u539F\u59CB\u7EDF\u8BA1\u610F\u56FE\uFF0C\u53EA\u4FEE\u6B63\u8BED\u6CD5\u3001\u51FD\u6570\u3001\u7C7B\u578B\u8F6C\u6362\u3001\u8868\u5B57\u6BB5\u5F15\u7528\u3001\u522B\u540D\u3001\u805A\u5408\u3001\u6392\u5E8F\u3001\u5206\u9875\u6216\u6267\u884C\u8BA1\u5212\u95EE\u9898\u3002",
        normalizedReason ? `\u5DF2\u77E5\u95EE\u9898: ${normalizedReason}` : ""
      ].filter(Boolean).join(" ");
    }
    function createAiSqlValidationResult() {
      return {
        valid: false,
        syntaxValid: false,
        objectValid: false,
        explainValid: false,
        messages: []
      };
    }
    function decorateAiSqlResultWithAutoCorrection(result, autoCorrection = {}) {
      if (!result) return result;
      const messages = uniqueStrings([
        ...result.validation?.messages || [],
        ...asArray(autoCorrection.messages)
      ]);
      return {
        ...result,
        summary: autoCorrection.summary || result.summary,
        validation: result.validation ? {
          ...result.validation,
          messages
        } : result.validation,
        autoCorrection: {
          attempted: Boolean(autoCorrection.attempted),
          applied: Boolean(autoCorrection.applied),
          reason: normalizeText(autoCorrection.reason),
          originalSql: sanitizeSqlText(autoCorrection.originalSql),
          revisedSql: sanitizeSqlText(autoCorrection.revisedSql || result.generatedSql),
          messages
        }
      };
    }
    function buildAiQueryAutoCorrection(autoCorrection = {}, governance = {}) {
      const messages = uniqueStrings([
        ...governance.messages || [],
        ...asArray(autoCorrection.messages)
      ]);
      return {
        attempted: Boolean(autoCorrection.attempted),
        applied: Boolean(autoCorrection.applied),
        reason: normalizeText(autoCorrection.reason),
        originalSql: sanitizeSqlText(autoCorrection.originalSql),
        revisedSql: sanitizeSqlText(autoCorrection.revisedSql),
        messages
      };
    }
    function buildPreviewSql(sql = "", limit, dialect = "mysql") {
      const normalized = sanitizeSqlText(sql);
      if (!normalized) {
        throw new AppError("SQL \u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      if (!/^\s*(select|with)\b/i.test(normalized)) {
        throw new AppError("\u4EC5\u652F\u6301\u67E5\u8BE2\u7C7B SQL \u9884\u89C8", 400);
      }
      if (/\blimit\s+\d+(\s*,\s*\d+)?(\s+offset\s+\d+)?\s*$/i.test(normalized) || /\bfetch\s+first\s+\d+\s+rows\s+only\s*$/i.test(normalized) || /\brownum\b/i.test(normalized)) {
        return normalized;
      }
      const resolvedLimit = Number(limit);
      if (!Number.isFinite(resolvedLimit) || resolvedLimit <= 0) {
        return normalized;
      }
      const safeLimit = Math.max(1, Math.min(100, Math.floor(resolvedLimit)));
      if (dialect === "oracle") return `SELECT * FROM (${normalized}) WHERE ROWNUM <= ${safeLimit}`;
      if (dialect === "dm") return `${normalized} FETCH FIRST ${safeLimit} ROWS ONLY`;
      return `${normalized} LIMIT ${safeLimit}`;
    }
    function resolveParserDialect(dialect) {
      const normalized = String(dialect || "").trim().toLowerCase();
      if (normalized === "postgresql" || normalized === "gaussdb") return "PostgreSQL";
      if (normalized === "oracle") return "MySQL";
      if (normalized === "dm") return "PostgreSQL";
      return "MySQL";
    }
    function hasUnsafeSqlKeyword(sql) {
      return /\b(insert|update|delete|drop|alter|truncate|create|replace|merge|call|grant|revoke|load|outfile|infile|execute|exec)\b/i.test(sql);
    }
    function hasSelectStar(astNode) {
      if (!astNode || typeof astNode !== "object") return false;
      if (Array.isArray(astNode.columns) && astNode.columns.some((column) => column?.expr?.type === "column_ref" && column.expr.column === "*")) {
        return true;
      }
      const nextNodes = [];
      if (Array.isArray(astNode.with)) {
        astNode.with.forEach((item) => {
          if (item?.stmt) nextNodes.push(item.stmt.ast || item.stmt);
        });
      }
      if (Array.isArray(astNode.from)) {
        astNode.from.forEach((item) => {
          if (item?.expr?.ast) nextNodes.push(item.expr.ast);
        });
      }
      return nextNodes.some(hasSelectStar);
    }
    function extractSqlTables(sql, dialect) {
      try {
        return uniqueStrings(
          sqlParser.tableList(sql, { database: resolveParserDialect(dialect) }).map((item) => {
            const [, schemaName, tableName] = String(item || "").split("::");
            return schemaName && schemaName !== "null" ? `${schemaName}.${tableName}` : tableName;
          })
        );
      } catch {
        return [];
      }
    }
    function extractCteNames(sql, dialect) {
      try {
        const ast = sqlParser.astify(sql, { database: resolveParserDialect(dialect) });
        const statement = Array.isArray(ast) ? ast[0] : ast;
        return new Set(
          asArray(statement?.with).map((item) => normalizeTableNameForMatch(item?.name?.value || item?.name)).filter(Boolean)
        );
      } catch {
        return /* @__PURE__ */ new Set();
      }
    }
    function normalizeTableNameForMatch(value = "") {
      return String(value || "").replace(/[`"]/g, "").trim().toLowerCase();
    }
    function tableExistsInAvailableTables(tableName, availableTables = []) {
      const normalized = normalizeTableNameForMatch(tableName);
      if (!normalized) return false;
      return availableTables.some((item) => {
        const candidate = normalizeTableNameForMatch(item.tableName || item.name || item);
        return candidate === normalized || candidate.endsWith(`.${normalized}`) || normalized.endsWith(`.${candidate}`);
      });
    }
    function tableNameMatchesSelection(tableName, selectedTable) {
      const left = normalizeTableNameForMatch(tableName);
      const right = normalizeTableNameForMatch(selectedTable);
      if (!left || !right) return false;
      return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`);
    }
    function ensureSafeReportAiSql(sql, dialect = "mysql", options = {}) {
      const normalized = sanitizeSqlText(sql);
      if (!normalized) {
        throw new AppError("SQL \u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      if (!/^\s*(select|with)\b/i.test(normalized)) {
        throw new AppError("\u4EC5\u5141\u8BB8\u6267\u884C\u53EA\u8BFB\u67E5\u8BE2 SQL", 400);
      }
      if (/[;]\s*\S/.test(normalized) || (normalized.match(/;/g) || []).length > 1) {
        throw new AppError("\u4EC5\u5141\u8BB8\u6267\u884C\u5355\u6761\u67E5\u8BE2 SQL", 400);
      }
      if (hasUnsafeSqlKeyword(normalized)) {
        throw new AppError("SQL \u5305\u542B\u975E\u53EA\u8BFB\u6216\u9AD8\u98CE\u9669\u5173\u952E\u5B57\uFF0C\u5DF2\u963B\u6B62\u6267\u884C", 400);
      }
      let ast;
      try {
        ast = sqlParser.astify(normalized.replace(/\?/g, "'x'"), { database: resolveParserDialect(dialect) });
      } catch (error) {
        throw new AppError(`SQL \u8BED\u6CD5\u6821\u9A8C\u5931\u8D25: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
      }
      const astList = Array.isArray(ast) ? ast : [ast];
      if (astList.length !== 1 || !astList.every((item) => item?.type === "select")) {
        throw new AppError("\u4EC5\u5141\u8BB8\u6267\u884C\u5355\u6761\u53EA\u8BFB SELECT \u67E5\u8BE2", 400);
      }
      if (options.disallowSelectStar !== false && astList.some(hasSelectStar)) {
        throw new AppError("AI \u56FE\u8868\u67E5\u8BE2\u4E0D\u5141\u8BB8 SELECT *\uFF0C\u8BF7\u660E\u786E\u9009\u62E9\u7EF4\u5EA6\u548C\u6307\u6807\u5B57\u6BB5", 400);
      }
      return normalized;
    }
    function guessFieldDataTypeFromValue(value) {
      if (value === null || value === void 0 || value === "") return "string";
      if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
      if (typeof value === "boolean") return "boolean";
      const text = String(value).trim();
      if (/^-?\d+$/.test(text)) return "integer";
      if (/^-?\d+\.\d+$/.test(text)) return "number";
      if (/^(true|false)$/i.test(text)) return "boolean";
      if (/^\d{4}-\d{2}-\d{2}(?:[ tT]\d{2}:\d{2}:\d{2})?/.test(text)) return "datetime";
      return "string";
    }
    function inferFieldRoleFromDataType(dataType = "", fieldName = "") {
      if (fieldName && isGeoDimensionFieldName(fieldName)) {
        return "dimension";
      }
      const normalized = String(dataType || "").trim().toLowerCase();
      if (/(int|decimal|numeric|number|double|float|real|money|bigint|smallint|tinyint)/i.test(normalized)) {
        return "metric";
      }
      if (/(date|time|timestamp|year)/i.test(normalized)) {
        return "time";
      }
      return "dimension";
    }
    function inferPreviewColumns(fieldNames = [], sampleRows = []) {
      return fieldNames.map((name) => {
        const sampleValue = sampleRows.find((row) => row && Object.prototype.hasOwnProperty.call(row, name) && row[name] !== null && row[name] !== void 0)?.[name];
        const dataType = guessFieldDataTypeFromValue(sampleValue);
        return {
          columnName: name,
          label: name,
          dataType,
          role: inferFieldRoleFromDataType(dataType, name)
        };
      });
    }
    function mergePreviewFieldMetadata(storedFields = [], previewFields = []) {
      const storedFieldMap = new Map(
        asArray(storedFields).filter((item) => item?.columnName).map((item) => [item.columnName, item])
      );
      return asArray(previewFields).map((field) => {
        const stored = storedFieldMap.get(field.columnName) || {};
        return {
          ...stored,
          ...field,
          label: stored.label || field.label,
          visible: stored.visible ?? field.visible,
          aggregation: stored.aggregation ?? field.aggregation,
          role: field.role || stored.role || inferFieldRoleFromDataType(
            field.dataType || stored.dataType,
            field.columnName || stored.columnName || field.label || stored.label
          ),
          dataType: field.dataType || stored.dataType || "string"
        };
      });
    }
    function normalizeNumber(value, fallback = 0) {
      const next = Number(value);
      return Number.isFinite(next) ? next : fallback;
    }
    function normalizeChartDimension(value, fallback) {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      const normalized = normalizeText(value, "");
      return normalized || fallback;
    }
    var CHROME_PADDING_PRESET_MAP = {
      compact: { left: 8, right: 8, top: 8, bottom: 8 },
      comfortable: { left: 18, right: 18, top: 16, bottom: 16 },
      spacious: { left: 28, right: 28, top: 24, bottom: 24 }
    };
    function resolveChromePadding(preset) {
      return CHROME_PADDING_PRESET_MAP[preset || "comfortable"] || CHROME_PADDING_PRESET_MAP.comfortable;
    }
    function resolveBarLabelPosition(isHorizontalBarChart, valuePosition) {
      if (isHorizontalBarChart) {
        return valuePosition === "inside" ? "insideRight" : "right";
      }
      return valuePosition === "inside" ? "insideTop" : "top";
    }
    function formatMetricValue(value, decimals = 0, prefix = "", suffix = "") {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) return `${prefix || ""}${value ?? "-"}${suffix || ""}`;
      return `${prefix || ""}${numericValue.toFixed(Math.max(0, Number(decimals || 0)))}${suffix || ""}`;
    }
    function buildChromeConfig(chrome = {}, styleOverrides = {}) {
      return {
        titleText: chrome.titleText || styleOverrides.titleText || null,
        showTitle: chrome.showTitle !== false,
        titleAlign: chrome.titleAlign || styleOverrides.titleAlign || "left",
        titleColor: chrome.titleColor || styleOverrides.titleColor || "#101828",
        titleFontSize: normalizeNumber(chrome.titleFontSize, 18),
        titleFontWeight: normalizeNumber(chrome.titleFontWeight, 700),
        paddingPreset: chrome.paddingPreset || styleOverrides.paddingPreset || "comfortable",
        backgroundColor: chrome.backgroundColor || styleOverrides.backgroundColor || "#ffffff",
        backgroundImage: chrome.backgroundImage || styleOverrides.backgroundImage || null,
        borderColor: chrome.borderColor || "#eef2f7",
        borderWidth: normalizeNumber(chrome.borderWidth, 1),
        borderRadius: normalizeNumber(chrome.borderRadius, 16),
        shadowPreset: chrome.shadowPreset || "none"
      };
    }
    function buildChartStyleConfig(chartStyle = {}, styleOverrides = {}, legacyChrome = {}) {
      return {
        palette: Array.isArray(chartStyle.palette) ? chartStyle.palette : void 0,
        palettePreset: chartStyle.palettePreset || styleOverrides.palettePreset || null,
        accentColor: chartStyle.accentColor || styleOverrides.accentColor || null,
        barSeriesLayout: chartStyle.barSeriesLayout || styleOverrides.barSeriesLayout || "grouped",
        barPrimaryColor: chartStyle.barPrimaryColor || styleOverrides.barPrimaryColor || null,
        barSecondaryColor: chartStyle.barSecondaryColor || styleOverrides.barSecondaryColor || null,
        barGap: chartStyle.barGap || styleOverrides.barGap || null,
        barCategoryGap: chartStyle.barCategoryGap || styleOverrides.barCategoryGap || null,
        barValuePosition: chartStyle.barValuePosition || styleOverrides.barValuePosition || "top",
        legendPrimaryName: chartStyle.legendPrimaryName || styleOverrides.legendPrimaryName || null,
        legendSecondaryName: chartStyle.legendSecondaryName || styleOverrides.legendSecondaryName || null,
        horizontalBarPalette: Array.isArray(chartStyle.horizontalBarPalette) ? chartStyle.horizontalBarPalette : [],
        horizontalBarColorCount: normalizeNumber(chartStyle.horizontalBarColorCount ?? styleOverrides.horizontalBarColorCount, 1),
        horizontalBarSortOrder: chartStyle.horizontalBarSortOrder || styleOverrides.horizontalBarSortOrder || "none",
        sankeyNodeWidth: normalizeNumber(chartStyle.sankeyNodeWidth ?? styleOverrides.sankeyNodeWidth, 16),
        sankeyNodeGap: normalizeNumber(chartStyle.sankeyNodeGap ?? styleOverrides.sankeyNodeGap, 18),
        sankeyNodeBorderColor: chartStyle.sankeyNodeBorderColor || styleOverrides.sankeyNodeBorderColor || "#ffffff",
        sankeyNodeBorderWidth: normalizeNumber(chartStyle.sankeyNodeBorderWidth ?? styleOverrides.sankeyNodeBorderWidth, 1),
        sankeyNodeBorderRadius: normalizeNumber(chartStyle.sankeyNodeBorderRadius ?? styleOverrides.sankeyNodeBorderRadius, 4),
        sankeyLinkOpacity: chartStyle.sankeyLinkOpacity ?? styleOverrides.sankeyLinkOpacity ?? 0.28,
        sankeyLinkCurveness: chartStyle.sankeyLinkCurveness ?? styleOverrides.sankeyLinkCurveness ?? 0.5,
        gaugePointerColor: chartStyle.gaugePointerColor || styleOverrides.gaugePointerColor || null,
        gaugeDetailColor: chartStyle.gaugeDetailColor || styleOverrides.gaugeDetailColor || null,
        gaugeTitleColor: chartStyle.gaugeTitleColor || styleOverrides.gaugeTitleColor || null,
        gaugeMetricName: chartStyle.gaugeMetricName ?? styleOverrides.gaugeMetricName ?? "\u6307\u6807",
        gaugeAxisLabelColor: chartStyle.gaugeAxisLabelColor || styleOverrides.gaugeAxisLabelColor || null,
        gaugeSplitLineColor: chartStyle.gaugeSplitLineColor || styleOverrides.gaugeSplitLineColor || null,
        gaugeStartAngle: normalizeNumber(chartStyle.gaugeStartAngle ?? styleOverrides.gaugeStartAngle, 210),
        gaugeEndAngle: normalizeNumber(chartStyle.gaugeEndAngle ?? styleOverrides.gaugeEndAngle, -30),
        gaugeRadius: normalizeChartDimension(chartStyle.gaugeRadius ?? styleOverrides.gaugeRadius, "90%"),
        gaugeProgressWidth: normalizeNumber(chartStyle.gaugeProgressWidth ?? styleOverrides.gaugeProgressWidth, 18),
        gaugeAxisLineWidth: normalizeNumber(chartStyle.gaugeAxisLineWidth ?? styleOverrides.gaugeAxisLineWidth, 18),
        gaugePointerLength: normalizeChartDimension(chartStyle.gaugePointerLength ?? styleOverrides.gaugePointerLength, "58%"),
        gaugeDetailFontSize: normalizeNumber(chartStyle.gaugeDetailFontSize ?? styleOverrides.gaugeDetailFontSize, 24),
        gaugeDetailFontWeight: normalizeNumber(chartStyle.gaugeDetailFontWeight ?? styleOverrides.gaugeDetailFontWeight, 700),
        gaugeTitleFontSize: normalizeNumber(chartStyle.gaugeTitleFontSize ?? styleOverrides.gaugeTitleFontSize, 14),
        funnelValueColor: chartStyle.funnelValueColor || styleOverrides.funnelValueColor || null,
        funnelLabelLineColor: chartStyle.funnelLabelLineColor || styleOverrides.funnelLabelLineColor || null,
        funnelBlockBorderColor: chartStyle.funnelBlockBorderColor || styleOverrides.funnelBlockBorderColor || null,
        funnelBlockBorderWidth: normalizeNumber(chartStyle.funnelBlockBorderWidth ?? styleOverrides.funnelBlockBorderWidth, 1),
        funnelItemGap: normalizeNumber(chartStyle.funnelItemGap ?? styleOverrides.funnelItemGap, 2),
        funnelSortOrder: chartStyle.funnelSortOrder || styleOverrides.funnelSortOrder || "descending",
        funnelLabelPosition: chartStyle.funnelLabelPosition || styleOverrides.funnelLabelPosition || "outside",
        funnelShowName: chartStyle.funnelShowName !== false && styleOverrides.funnelShowName !== false,
        funnelShowValue: chartStyle.funnelShowValue !== false && styleOverrides.funnelShowValue !== false,
        wordCloudShape: chartStyle.wordCloudShape || styleOverrides.wordCloudShape || "circle",
        wordCloudGridSize: normalizeNumber(chartStyle.wordCloudGridSize ?? styleOverrides.wordCloudGridSize, 10),
        wordCloudRotationStep: normalizeNumber(chartStyle.wordCloudRotationStep ?? styleOverrides.wordCloudRotationStep, 45),
        wordCloudMinFontSize: normalizeNumber(chartStyle.wordCloudMinFontSize ?? styleOverrides.wordCloudMinFontSize, 12),
        wordCloudMaxFontSize: normalizeNumber(chartStyle.wordCloudMaxFontSize ?? styleOverrides.wordCloudMaxFontSize, 40),
        wordCloudFontWeight: normalizeNumber(chartStyle.wordCloudFontWeight ?? styleOverrides.wordCloudFontWeight, 700),
        wordCloudTextShadowColor: chartStyle.wordCloudTextShadowColor || styleOverrides.wordCloudTextShadowColor || null,
        wordCloudTextShadowBlur: normalizeNumber(chartStyle.wordCloudTextShadowBlur ?? styleOverrides.wordCloudTextShadowBlur, 10),
        scatterSymbolSize: normalizeNumber(chartStyle.scatterSymbolSize ?? styleOverrides.scatterSymbolSize, 16),
        scatterPointBorderColor: chartStyle.scatterPointBorderColor || styleOverrides.scatterPointBorderColor || chartStyle.pointBorderColor || styleOverrides.pointBorderColor || "#ffffff",
        scatterPointBorderWidth: normalizeNumber(chartStyle.scatterPointBorderWidth ?? styleOverrides.scatterPointBorderWidth, 1),
        scatterPointOpacity: chartStyle.scatterPointOpacity ?? styleOverrides.scatterPointOpacity ?? 0.82,
        scatterLabelPosition: chartStyle.scatterLabelPosition || styleOverrides.scatterLabelPosition || "top",
        radarLayout: chartStyle.radarLayout || styleOverrides.radarLayout || "single",
        radarPrimaryColor: chartStyle.radarPrimaryColor || styleOverrides.radarPrimaryColor || null,
        radarSecondaryColor: chartStyle.radarSecondaryColor || styleOverrides.radarSecondaryColor || null,
        radarPointColor: chartStyle.radarPointColor || styleOverrides.radarPointColor || null,
        radarAreaOpacity: chartStyle.radarAreaOpacity ?? styleOverrides.radarAreaOpacity ?? null,
        mapRegionPalette: Array.isArray(chartStyle.mapRegionPalette) ? chartStyle.mapRegionPalette : [],
        mapRegionBorderColor: chartStyle.mapRegionBorderColor || styleOverrides.mapRegionBorderColor || null,
        mapLabelColor: chartStyle.mapLabelColor || styleOverrides.mapLabelColor || null,
        mapVisualMapTextColor: chartStyle.mapVisualMapTextColor || styleOverrides.mapVisualMapTextColor || null,
        axisColor: chartStyle.axisColor || styleOverrides.axisColor || null,
        axisLabelColor: chartStyle.axisLabelColor || styleOverrides.axisLabelColor || null,
        splitLineColor: chartStyle.splitLineColor || styleOverrides.splitLineColor || null,
        xAxisUnitLabel: chartStyle.xAxisUnitLabel || styleOverrides.xAxisUnitLabel || "",
        yAxisUnitLabel: chartStyle.yAxisUnitLabel || styleOverrides.yAxisUnitLabel || "",
        axisLabelFontSize: normalizeNumber(chartStyle.axisLabelFontSize ?? styleOverrides.axisLabelFontSize, 12),
        axisLabelFontWeight: normalizeNumber(chartStyle.axisLabelFontWeight ?? styleOverrides.axisLabelFontWeight, 400),
        legendPosition: chartStyle.legendPosition || styleOverrides.legendPosition || "bottom",
        showLegend: chartStyle.showLegend !== false && legacyChrome.showLegend !== false,
        showAxis: chartStyle.showAxis !== false && legacyChrome.showAxis !== false,
        showXAxis: typeof chartStyle.showXAxis === "boolean" ? chartStyle.showXAxis : true,
        showYAxis: typeof chartStyle.showYAxis === "boolean" ? chartStyle.showYAxis : true,
        showGridLines: typeof chartStyle.showGridLines === "boolean" ? chartStyle.showGridLines : false,
        showLabels: chartStyle.showLabels !== false && legacyChrome.showLabels !== false,
        showDataLabels: Boolean(chartStyle.showDataLabels ?? legacyChrome.showDataLabels),
        dataLabelColor: chartStyle.dataLabelColor || legacyChrome.dataLabelColor || "#ffffff",
        dataLabelFontSize: normalizeNumber(chartStyle.dataLabelFontSize ?? legacyChrome.dataLabelFontSize, 14),
        dataLabelFontWeight: normalizeNumber(chartStyle.dataLabelFontWeight ?? legacyChrome.dataLabelFontWeight, 500),
        legendTextColor: chartStyle.legendTextColor || styleOverrides.legendTextColor || null,
        legendFontSize: normalizeNumber(chartStyle.legendFontSize ?? styleOverrides.legendFontSize, 14),
        legendFontWeight: normalizeNumber(chartStyle.legendFontWeight ?? styleOverrides.legendFontWeight, 500)
      };
    }
    function buildMapStyleConfig(mapStyle = {}, styleOverrides = {}, legacyChrome = {}) {
      const sourceCenter = Array.isArray(mapStyle.center) && mapStyle.center.length >= 2 ? [Number(mapStyle.center[0]), Number(mapStyle.center[1])] : null;
      const overrideCenter = Array.isArray(styleOverrides.center) && styleOverrides.center.length >= 2 ? [Number(styleOverrides.center[0]), Number(styleOverrides.center[1])] : null;
      const legacyCenter = Array.isArray(legacyChrome.center) && legacyChrome.center.length >= 2 ? [Number(legacyChrome.center[0]), Number(legacyChrome.center[1])] : null;
      const resolvedCenter = [sourceCenter, overrideCenter, legacyCenter].find((value) => Array.isArray(value) && value.every((item) => Number.isFinite(item))) || null;
      const zoomValue = Number(mapStyle.zoom ?? styleOverrides.zoom ?? legacyChrome.zoom);
      return {
        provinceCode: mapStyle.provinceCode || styleOverrides.provinceCode || legacyChrome.provinceCode || null,
        center: resolvedCenter,
        zoom: Number.isFinite(zoomValue) && zoomValue > 0 ? zoomValue : null
      };
    }
    function buildChartAnalysisConfig(chartAnalysis = {}, legacyChrome = {}) {
      return {
        showExtrema: Boolean(chartAnalysis.showExtrema ?? legacyChrome.showExtrema)
      };
    }
    function getMapRegionPalette(chartStyle = {}) {
      const configured = Array.isArray(chartStyle.mapRegionPalette) ? chartStyle.mapRegionPalette.filter((item) => typeof item === "string" && item.trim().length > 0) : [];
      const fallback = ["#eef5ff", "#d5e6ff", "#9cc3ff", "#4f8cff", chartStyle.accentColor || "#1677ff"];
      return fallback.map((color, index) => configured[index] || color);
    }
    function buildKpiStyleConfig(kpiStyle = {}, legacyChrome = {}, props = {}) {
      const valueColor = kpiStyle.valueColor || legacyChrome.valueColor || "#1677ff";
      const valueFontSize = normalizeNumber(kpiStyle.valueFontSize ?? legacyChrome.valueFontSize, 34);
      const itemBackgroundColor = kpiStyle.itemBackgroundColor || props.itemBackgroundColor || "#ffffff";
      const flipperBackground = props.flipperBackground || kpiStyle.flipperBackground || `linear-gradient(180deg, ${valueColor} 0%, ${itemBackgroundColor} 100%)`;
      return {
        themeKey: kpiStyle.themeKey || props.themeKey || null,
        themeMode: kpiStyle.themeMode || props.themeMode || "all",
        itemSize: kpiStyle.itemSize || props.itemSize || "medium",
        multiValueLayout: kpiStyle.multiValueLayout || props.multiValueLayout || "verticalList",
        contentOrientation: kpiStyle.contentOrientation || props.contentOrientation || "vertical",
        itemsPerRow: normalizeNumber(kpiStyle.itemsPerRow ?? props.itemsPerRow, 2),
        itemsPerColumn: normalizeNumber(kpiStyle.itemsPerColumn ?? props.itemsPerColumn, 3),
        itemMinWidth: normalizeNumber(kpiStyle.itemMinWidth ?? props.itemMinWidth, 180),
        itemGap: normalizeNumber(kpiStyle.itemGap ?? props.itemGap, 16),
        itemAlign: kpiStyle.itemAlign || props.itemAlign || "left",
        showDivider: kpiStyle.showDivider !== false && props.showDivider !== false,
        showValue: kpiStyle.showValue !== false && legacyChrome.showValue !== false,
        valueColor,
        valueFontSize,
        valueFontWeight: normalizeNumber(kpiStyle.valueFontWeight ?? legacyChrome.valueFontWeight, 700),
        valuePrefixColor: kpiStyle.valuePrefixColor || legacyChrome.valuePrefixColor || valueColor,
        valuePrefixFontSize: normalizeNumber(kpiStyle.valuePrefixFontSize ?? legacyChrome.valuePrefixFontSize, Math.max(12, valueFontSize - 14)),
        valueSuffixColor: kpiStyle.valueSuffixColor || legacyChrome.valueSuffixColor || valueColor,
        valueSuffixFontSize: normalizeNumber(kpiStyle.valueSuffixFontSize ?? legacyChrome.valueSuffixFontSize, Math.max(12, valueFontSize - 14)),
        dividerStyle: kpiStyle.dividerStyle || props.dividerStyle || "solid",
        dividerWidth: normalizeNumber(kpiStyle.dividerWidth ?? props.dividerWidth, 1),
        dividerColor: kpiStyle.dividerColor || props.dividerColor || "#e5e7eb",
        flipperBackground,
        flipperGap: normalizeNumber(kpiStyle.flipperGap ?? props.flipperGap, 6),
        flipperDigitWidth: normalizeNumber(kpiStyle.flipperDigitWidth ?? props.flipperDigitWidth, 56),
        flipperDigitHeight: normalizeNumber(kpiStyle.flipperDigitHeight ?? props.flipperDigitHeight, 52),
        flipperDigitRadius: normalizeNumber(kpiStyle.flipperDigitRadius ?? props.flipperDigitRadius, 10),
        hoverElevated: kpiStyle.hoverElevated !== false && props.hoverElevated !== false,
        trendColorMode: kpiStyle.trendColorMode || props.trendColorMode || "auto",
        itemBackgroundColor,
        itemBorderColor: kpiStyle.itemBorderColor || props.itemBorderColor || "#e5e7eb",
        itemBorderWidth: normalizeNumber(kpiStyle.itemBorderWidth ?? props.itemBorderWidth, 0),
        itemBorderRadius: normalizeNumber(kpiStyle.itemBorderRadius ?? props.itemBorderRadius, 12),
        showMetricLabel: kpiStyle.showMetricLabel !== false && props.showMetricLabel !== false,
        metricLabelColor: kpiStyle.metricLabelColor || props.metricLabelColor || "#667085",
        metricLabelFontSize: normalizeNumber(kpiStyle.metricLabelFontSize ?? props.metricLabelFontSize, 16),
        metricLabelFontWeight: normalizeNumber(kpiStyle.metricLabelFontWeight ?? props.metricLabelFontWeight, 600),
        compareLabelColor: kpiStyle.compareLabelColor || props.compareLabelColor || "#52c41a",
        compareLabelFontSize: normalizeNumber(kpiStyle.compareLabelFontSize ?? props.compareLabelFontSize, 16),
        compareLabelFontWeight: normalizeNumber(kpiStyle.compareLabelFontWeight ?? props.compareLabelFontWeight, 600)
      };
    }
    function buildKpiAnalysisConfig(kpiAnalysis = {}, props = {}) {
      return {
        showTrend: kpiAnalysis.showTrend !== false && props.showTrend !== false
      };
    }
    function buildTableStyleConfig(tableStyle = {}, props = {}) {
      return {
        showIndex: tableStyle.showIndex !== false && props.showIndex !== false,
        compact: Boolean(tableStyle.compact ?? props.compact),
        striped: tableStyle.striped !== false && props.striped !== false
      };
    }
    function buildTabsStyleConfig(tabsStyle = {}) {
      return {
        tabBarBackgroundColor: tabsStyle.tabBarBackgroundColor || "#f8fafc",
        activeTextColor: tabsStyle.activeTextColor || "#1677ff",
        inactiveTextColor: tabsStyle.inactiveTextColor || "#667085"
      };
    }
    function withCompactGrid(option = {}, overrides = {}) {
      return {
        ...option,
        grid: {
          left: 12,
          right: 12,
          top: 36,
          bottom: 18,
          containLabel: true,
          ...option.grid || {},
          ...overrides || {}
        }
      };
    }
    function buildKpiPreview(rows = [], fieldMap = {}, chrome = {}, kpiStyle = {}, kpiAnalysis = {}, props = {}) {
      const kpiConfig = props.kpi && typeof props.kpi === "object" ? props.kpi : props;
      const valueField = fieldMap.valueField || fieldMap.yField || "value";
      const compareField = fieldMap.compareField || "compare_value";
      const targetField = fieldMap.targetField || "target_value";
      const labelField = fieldMap.nameField || fieldMap.labelField || "label";
      const row = rows[0] || {};
      const items = rows.map((entry) => {
        const entryPrimaryValue = entry[valueField] ?? null;
        const entryCompareValue = Boolean(fieldMap.compareField) ? entry[compareField] ?? null : null;
        const entryTargetValue = entry[targetField] ?? null;
        const entryTrendPercent = Boolean(fieldMap.compareField) && entryCompareValue !== null && Number(entryCompareValue) !== 0 ? Number(((Number(entryPrimaryValue || 0) - Number(entryCompareValue || 0)) / Number(entryCompareValue) * 100).toFixed(2)) : null;
        return {
          primaryValue: entryPrimaryValue,
          compareValue: entryCompareValue,
          targetValue: entryTargetValue,
          trendPercent: entryTrendPercent,
          label: entry[labelField] || props.metricLabel || chrome.titleText || "\u6307\u6807\u503C",
          formattedValue: formatMetricValue(entryPrimaryValue, kpiConfig.decimals, kpiConfig.valuePrefix, kpiConfig.valueSuffix)
        };
      });
      const primaryValue = row[valueField] ?? null;
      const hasCompareField = Boolean(fieldMap.compareField);
      const compareValue = hasCompareField ? row[compareField] ?? null : null;
      const targetValue = row[targetField] ?? null;
      const trendPercent = hasCompareField && compareValue !== null && Number(compareValue) !== 0 ? Number(((Number(primaryValue || 0) - Number(compareValue || 0)) / Number(compareValue) * 100).toFixed(2)) : null;
      return {
        widgetType: "kpi",
        dataset: null,
        chartAsset: null,
        fields: [],
        sampleRows: rows,
        fieldMap,
        chrome,
        kpiStyle,
        kpiAnalysis,
        kpi: {
          items,
          primaryValue,
          compareValue,
          targetValue,
          trendPercent,
          label: row[labelField] || props.metricLabel || chrome.titleText || "\u6307\u6807\u503C",
          mode: kpiConfig.mode || props.kpiMode || "number",
          layout: kpiConfig.layout || "vertical",
          prefix: kpiConfig.valuePrefix || "",
          suffix: kpiConfig.valueSuffix || "",
          valuePrefix: kpiConfig.valuePrefix || "",
          valueSuffix: kpiConfig.valueSuffix || "",
          decimals: normalizeNumber(kpiConfig.decimals, 0),
          showTrend: kpiAnalysis.showTrend !== false,
          formattedValue: formatMetricValue(primaryValue, kpiConfig.decimals, kpiConfig.valuePrefix, kpiConfig.valueSuffix),
          formattedCompareValue: compareValue === null ? null : formatMetricValue(compareValue, kpiConfig.decimals, kpiConfig.valuePrefix, kpiConfig.valueSuffix),
          formattedTargetValue: targetValue === null ? null : formatMetricValue(targetValue, kpiConfig.decimals, kpiConfig.valuePrefix, kpiConfig.valueSuffix),
          showMetricLabel: kpiStyle.showMetricLabel !== false,
          valuePrefixColor: kpiStyle.valuePrefixColor,
          valuePrefixFontSize: kpiStyle.valuePrefixFontSize,
          valueSuffixColor: kpiStyle.valueSuffixColor,
          valueSuffixFontSize: kpiStyle.valueSuffixFontSize,
          metricLabelColor: kpiStyle.metricLabelColor,
          metricLabelFontSize: kpiStyle.metricLabelFontSize,
          metricLabelFontWeight: kpiStyle.metricLabelFontWeight,
          compareLabel: kpiConfig.compareLabel || "\u540C\u6BD4",
          compareLabelColor: kpiStyle.compareLabelColor,
          compareLabelFontSize: kpiStyle.compareLabelFontSize,
          compareLabelFontWeight: kpiStyle.compareLabelFontWeight
        }
      };
    }
    function buildTablePreview(rows = [], fields = [], fieldMap = {}, chrome = {}, tableStyle = {}, props = {}) {
      const visibleColumns = props.columns && Array.isArray(props.columns) && props.columns.length > 0 ? normalizeReportTableColumns(props.columns) : fields.map((field) => ({
        key: field.columnName,
        title: field.label || field.columnName,
        dataIndex: field.columnName
      }));
      return {
        widgetType: "table",
        dataset: null,
        chartAsset: null,
        fields,
        sampleRows: rows,
        fieldMap,
        chrome,
        tableStyle,
        table: {
          columns: visibleColumns,
          rows,
          pageSize: normalizeNumber(props.pageSize, 10),
          showIndex: tableStyle.showIndex !== false,
          compact: Boolean(tableStyle.compact),
          striped: tableStyle.striped !== false
        }
      };
    }
    function normalizeReportTableColumns(columns = []) {
      return (Array.isArray(columns) ? columns : []).map((column) => {
        if (typeof column === "string") {
          const dataIndex2 = normalizeText(column);
          return dataIndex2 ? { key: dataIndex2, title: dataIndex2, dataIndex: dataIndex2 } : null;
        }
        if (!column || typeof column !== "object") return null;
        const dataIndex = normalizeText(column.dataIndex || column.key);
        if (!dataIndex) return null;
        return {
          ...column,
          key: normalizeText(column.key, dataIndex),
          title: normalizeText(column.title, dataIndex),
          dataIndex
        };
      }).filter(Boolean);
    }
    function buildSankeyEmptyOption(optionTemplate = {}, message = "\u8BF7\u5148\u4E3A\u6851\u57FA\u56FE\u914D\u7F6E\u6709\u6548\u7684\u6765\u6E90\u3001\u53BB\u5411\u548C\u6743\u91CD\u5B57\u6BB5") {
      const baseSeries = Array.isArray(optionTemplate.series) ? optionTemplate.series[0] || {} : {};
      return {
        ...optionTemplate,
        graphic: {
          type: "text",
          left: "center",
          top: "middle",
          silent: true,
          style: {
            text: message,
            fill: "#98a2b3",
            fontSize: 14,
            fontWeight: 500,
            textAlign: "center"
          }
        },
        series: [
          {
            ...baseSeries,
            type: "sankey",
            data: [],
            links: []
          }
        ]
      };
    }
    function hasSankeyCycle(links = []) {
      const nodeSet = /* @__PURE__ */ new Set();
      const adjacency = /* @__PURE__ */ new Map();
      const indegree = /* @__PURE__ */ new Map();
      links.forEach((link) => {
        const source = normalizeText(link?.source);
        const target = normalizeText(link?.target);
        if (!source || !target) return;
        nodeSet.add(source);
        nodeSet.add(target);
        if (!adjacency.has(source)) adjacency.set(source, /* @__PURE__ */ new Set());
        if (!adjacency.has(target)) adjacency.set(target, /* @__PURE__ */ new Set());
        if (!indegree.has(source)) indegree.set(source, 0);
        if (!indegree.has(target)) indegree.set(target, 0);
        if (!adjacency.get(source).has(target)) {
          adjacency.get(source).add(target);
          indegree.set(target, Number(indegree.get(target) || 0) + 1);
        }
      });
      const queue = [];
      nodeSet.forEach((node) => {
        if (Number(indegree.get(node) || 0) === 0) {
          queue.push(node);
        }
      });
      let visited = 0;
      while (queue.length) {
        const current = queue.shift();
        visited += 1;
        const neighbors = adjacency.get(current) || /* @__PURE__ */ new Set();
        neighbors.forEach((neighbor) => {
          const nextDegree = Number(indegree.get(neighbor) || 0) - 1;
          indegree.set(neighbor, nextDegree);
          if (nextDegree === 0) {
            queue.push(neighbor);
          }
        });
      }
      return visited !== nodeSet.size;
    }
    function getSankeyPalette(chartStyle = {}) {
      const configured = Array.isArray(chartStyle.palette) ? chartStyle.palette.filter((item) => typeof item === "string" && item.trim()) : [];
      if (configured.length) {
        return configured;
      }
      return [
        chartStyle.accentColor || "#1677ff",
        "#55c6a9",
        "#f4b95d",
        "#8f7cff",
        "#f28f8f"
      ];
    }
    function buildSankeyNodeMeta(series = {}) {
      const outgoing = /* @__PURE__ */ new Set();
      const incoming = /* @__PURE__ */ new Set();
      const links = Array.isArray(series.links) ? series.links : [];
      links.forEach((link) => {
        if (!link || typeof link !== "object") return;
        if (link.source !== void 0 && link.source !== null) outgoing.add(String(link.source));
        if (link.target !== void 0 && link.target !== null) incoming.add(String(link.target));
      });
      return { outgoing, incoming };
    }
    function resolveSankeyLabelPlacement(name, meta) {
      const hasOutgoing = meta.outgoing.has(name);
      const hasIncoming = meta.incoming.has(name);
      if (!hasOutgoing && hasIncoming) {
        return { position: "left", align: "right" };
      }
      return { position: "right", align: "left" };
    }
    function applySankeyChartStyle(option = {}, chrome = {}, chartStyle = {}) {
      const nextOption = { ...option || {} };
      const paddingPresetMap = {
        compact: { left: 4, right: 4, top: 4, bottom: 4 },
        comfortable: { left: 12, right: 12, top: 8, bottom: 8 },
        spacious: { left: 20, right: 20, top: 16, bottom: 16 }
      };
      const resolvedPadding = paddingPresetMap[chrome.paddingPreset || "comfortable"] || paddingPresetMap.comfortable;
      const palette = getSankeyPalette(chartStyle);
      if (!Array.isArray(nextOption.series)) {
        return nextOption;
      }
      nextOption.series = nextOption.series.map((item) => {
        if (item?.type !== "sankey") {
          return item;
        }
        const meta = buildSankeyNodeMeta(item);
        const data = Array.isArray(item.data) ? item.data.map((node, index) => {
          const baseNode = node && typeof node === "object" && !Array.isArray(node) ? { ...node } : { name: String(node || "") };
          const name = String(baseNode.name || "");
          const placement = resolveSankeyLabelPlacement(name, meta);
          return {
            ...baseNode,
            itemStyle: {
              ...baseNode.itemStyle || {},
              color: palette[index % palette.length] || chartStyle.accentColor || baseNode.itemStyle?.color || "#1677ff",
              borderColor: chartStyle.sankeyNodeBorderColor || baseNode.itemStyle?.borderColor || "#ffffff",
              borderWidth: normalizeNumber(chartStyle.sankeyNodeBorderWidth ?? baseNode.itemStyle?.borderWidth, 1),
              borderRadius: normalizeNumber(chartStyle.sankeyNodeBorderRadius ?? baseNode.itemStyle?.borderRadius, 4)
            },
            label: {
              ...baseNode.label || {},
              show: chartStyle.showLabels !== false,
              position: baseNode.label?.position || placement.position,
              align: baseNode.label?.align || placement.align,
              verticalAlign: baseNode.label?.verticalAlign || "middle",
              distance: baseNode.label?.distance ?? 8,
              color: chartStyle.dataLabelColor || baseNode.label?.color || "#344054",
              fontSize: normalizeNumber(chartStyle.dataLabelFontSize ?? baseNode.label?.fontSize, 14),
              fontWeight: normalizeNumber(chartStyle.dataLabelFontWeight ?? baseNode.label?.fontWeight, 500)
            }
          };
        }) : item.data;
        return {
          ...item,
          left: item.left ?? resolvedPadding.left,
          right: item.right ?? resolvedPadding.right,
          top: item.top ?? resolvedPadding.top,
          bottom: item.bottom ?? resolvedPadding.bottom,
          nodeAlign: item.nodeAlign || "justify",
          draggable: item.draggable ?? false,
          nodeWidth: normalizeNumber(chartStyle.sankeyNodeWidth ?? item.nodeWidth, 16),
          nodeGap: normalizeNumber(chartStyle.sankeyNodeGap ?? item.nodeGap, 18),
          emphasis: {
            focus: "adjacency",
            ...item.emphasis || {}
          },
          labelLayout: {
            hideOverlap: false,
            ...item.labelLayout || {}
          },
          lineStyle: {
            color: "gradient",
            ...item.lineStyle || {},
            opacity: Number(chartStyle.sankeyLinkOpacity ?? item.lineStyle?.opacity ?? 0.28),
            curveness: Number(chartStyle.sankeyLinkCurveness ?? item.lineStyle?.curveness ?? 0.5)
          },
          data
        };
      });
      if (nextOption.legend) {
        nextOption.legend = { ...nextOption.legend || {}, show: false };
      }
      return nextOption;
    }
    function getFunnelPalette(chartStyle = {}) {
      const configured = Array.isArray(chartStyle.palette) ? chartStyle.palette.filter((item) => typeof item === "string" && item.trim()) : [];
      if (configured.length) {
        return configured;
      }
      return [
        chartStyle.accentColor || "#1677ff",
        "#55c6a9",
        "#f4b95d",
        "#8f7cff",
        "#f28f8f"
      ];
    }
    function formatFunnelLabelValue(value) {
      if (value === null || value === void 0 || value === "") {
        return "";
      }
      return String(value);
    }
    function applyFunnelChartStyle(option = {}, chrome = {}, chartStyle = {}) {
      const nextOption = { ...option || {} };
      const resolvedPadding = resolveChromePadding(chrome.paddingPreset);
      const palette = getFunnelPalette(chartStyle);
      if (!Array.isArray(nextOption.series)) {
        return nextOption;
      }
      nextOption.color = palette;
      nextOption.series = nextOption.series.map((item) => {
        if (item?.type !== "funnel") {
          return item;
        }
        const labelFontSize = normalizeNumber(chartStyle.dataLabelFontSize ?? item.label?.fontSize, 14);
        const labelFontWeight = normalizeNumber(chartStyle.dataLabelFontWeight ?? item.label?.fontWeight, 500);
        const labelColor = chartStyle.dataLabelColor || item.label?.color || "#344054";
        const valueColor = chartStyle.funnelValueColor || labelColor;
        const labelLineColor = chartStyle.funnelLabelLineColor || item.labelLine?.lineStyle?.color || "#98a2b3";
        const borderColor = chartStyle.funnelBlockBorderColor || item.itemStyle?.borderColor || "#ffffff";
        const borderWidth = normalizeNumber(chartStyle.funnelBlockBorderWidth ?? item.itemStyle?.borderWidth, 1);
        const gap = normalizeNumber(chartStyle.funnelItemGap ?? item.gap, 2);
        const sortOrder = normalizeText(chartStyle.funnelSortOrder, normalizeText(item.sort, "descending"));
        const labelPosition = chartStyle.funnelLabelPosition === "inside" ? "inside" : "right";
        const showName = chartStyle.funnelShowName !== false;
        const showValue = chartStyle.funnelShowValue !== false;
        const showLabel = chartStyle.showLabels !== false && (showName || showValue);
        const data = Array.isArray(item.data) ? item.data.map((entry, index) => {
          const baseEntry = entry && typeof entry === "object" && !Array.isArray(entry) ? { ...entry } : { value: entry };
          return {
            ...baseEntry,
            itemStyle: {
              ...baseEntry.itemStyle || {},
              color: palette[index % palette.length] || chartStyle.accentColor || baseEntry.itemStyle?.color || "#1677ff",
              borderColor,
              borderWidth
            }
          };
        }) : item.data;
        return {
          ...item,
          left: item.left ?? resolvedPadding.left,
          right: item.right ?? resolvedPadding.right,
          top: item.top ?? resolvedPadding.top,
          bottom: item.bottom ?? resolvedPadding.bottom,
          sort: ["ascending", "descending", "none"].includes(sortOrder) ? sortOrder : "descending",
          gap,
          itemStyle: {
            ...item.itemStyle || {},
            borderColor,
            borderWidth
          },
          label: {
            ...item.label || {},
            show: showLabel,
            position: labelPosition,
            align: labelPosition === "inside" ? "center" : item.label?.align,
            verticalAlign: labelPosition === "inside" ? "middle" : item.label?.verticalAlign,
            color: labelColor,
            fontSize: labelFontSize,
            fontWeight: labelFontWeight,
            formatter: (params) => {
              const name = params?.name ? String(params.name) : "";
              const value = formatFunnelLabelValue(params?.value);
              if (showName && showValue) {
                if (name && value) return `{name|${name}}
{value|${value}}`;
                if (name) return `{name|${name}}`;
                return value ? `{value|${value}}` : "";
              }
              if (showName) return name ? `{name|${name}}` : "";
              if (showValue) return value ? `{value|${value}}` : "";
              return "";
            },
            rich: {
              ...(item.label || {}).rich || {},
              name: {
                color: labelColor,
                fontSize: labelFontSize,
                fontWeight: labelFontWeight,
                lineHeight: labelFontSize + 4
              },
              value: {
                color: valueColor,
                fontSize: Math.max(labelFontSize, labelFontSize + 1),
                fontWeight: 700,
                lineHeight: labelFontSize + 6
              }
            }
          },
          labelLine: {
            ...item.labelLine || {},
            show: showLabel && labelPosition !== "inside",
            lineStyle: {
              ...(item.labelLine || {}).lineStyle || {},
              color: labelLineColor
            }
          },
          data
        };
      });
      if (nextOption.legend) {
        delete nextOption.legend;
      }
      return nextOption;
    }
    function getWordCloudPalette(chartStyle = {}) {
      const configured = Array.isArray(chartStyle.palette) ? chartStyle.palette.filter((item) => typeof item === "string" && item.trim()) : [];
      if (configured.length) {
        return configured;
      }
      return [
        chartStyle.accentColor || "#1677ff",
        "#55c6a9",
        "#f4b95d",
        "#8f7cff",
        "#f28f8f"
      ];
    }
    function resolveWordCloudRotationRange(step) {
      const resolvedStep = normalizeNumber(step, 45);
      return resolvedStep <= 0 ? [0, 0] : [-90, 90];
    }
    function applyWordCloudChartStyle(option = {}, chrome = {}, chartStyle = {}) {
      const nextOption = { ...option || {} };
      const palette = getWordCloudPalette(chartStyle);
      const resolvedPadding = resolveChromePadding(chrome.paddingPreset);
      if (!Array.isArray(nextOption.series)) {
        return nextOption;
      }
      nextOption.color = palette;
      nextOption.series = nextOption.series.map((item) => {
        if (item?.type !== "wordCloud") {
          return item;
        }
        const shadowColor = chartStyle.wordCloudTextShadowColor || item.textStyle?.shadowColor || "rgba(15,23,42,0.14)";
        const shadowBlur = normalizeNumber(chartStyle.wordCloudTextShadowBlur ?? item.textStyle?.shadowBlur, 10);
        const fontWeight = normalizeNumber(chartStyle.wordCloudFontWeight ?? item.textStyle?.fontWeight, 700);
        const minFontSize = normalizeNumber(chartStyle.wordCloudMinFontSize ?? item.sizeRange?.[0], 12);
        const maxFontSize = normalizeNumber(chartStyle.wordCloudMaxFontSize ?? item.sizeRange?.[1], 40);
        const rotationStep = normalizeNumber(chartStyle.wordCloudRotationStep ?? item.rotationStep, 45);
        const data = Array.isArray(item.data) ? item.data.map((entry, index) => {
          const baseEntry = entry && typeof entry === "object" && !Array.isArray(entry) ? { ...entry } : { name: String(entry || ""), value: 0 };
          return {
            ...baseEntry,
            textStyle: {
              ...baseEntry.textStyle || {},
              color: palette[index % palette.length] || chartStyle.accentColor || "#1677ff",
              fontWeight,
              shadowColor,
              shadowBlur
            }
          };
        }) : item.data;
        return {
          ...item,
          type: "wordCloud",
          shape: normalizeText(chartStyle.wordCloudShape, normalizeText(item.shape, "circle")),
          left: resolvedPadding.left,
          right: resolvedPadding.right,
          top: resolvedPadding.top,
          bottom: resolvedPadding.bottom,
          width: void 0,
          height: void 0,
          gridSize: normalizeNumber(chartStyle.wordCloudGridSize ?? item.gridSize, 10),
          rotationStep,
          rotationRange: resolveWordCloudRotationRange(rotationStep),
          sizeRange: [
            Math.max(8, Math.min(minFontSize, maxFontSize)),
            Math.max(minFontSize, maxFontSize)
          ],
          drawOutOfBound: item.drawOutOfBound ?? false,
          textStyle: {
            ...item.textStyle || {},
            fontFamily: item.textStyle?.fontFamily || "sans-serif",
            fontWeight,
            shadowColor,
            shadowBlur
          },
          emphasis: {
            ...item.emphasis || {},
            focus: item.emphasis?.focus || "self",
            textStyle: {
              ...item.emphasis?.textStyle || {},
              shadowColor,
              shadowBlur: Math.max(shadowBlur, shadowBlur + 4)
            }
          },
          data
        };
      });
      if (nextOption.legend) {
        delete nextOption.legend;
      }
      return nextOption;
    }
    function getGaugePalette(chartStyle = {}) {
      const configured = Array.isArray(chartStyle.palette) ? chartStyle.palette.filter((item) => typeof item === "string" && item.trim()) : [];
      if (configured.length) {
        return configured;
      }
      return [
        chartStyle.accentColor || "#1677ff",
        "#55c6a9",
        "#f4b95d",
        "#8f7cff",
        "#f28f8f"
      ];
    }
    function buildGaugeAxisLineColors(palette = []) {
      const values = Array.isArray(palette) && palette.length ? palette : ["#1677ff"];
      return values.map((color, index) => [Number(((index + 1) / values.length).toFixed(4)), color]);
    }
    function applyGaugeChartStyle(option = {}, _chrome = {}, chartStyle = {}) {
      const nextOption = { ...option || {} };
      const palette = getGaugePalette(chartStyle);
      const configuredMetricName = typeof chartStyle.gaugeMetricName === "string" ? chartStyle.gaugeMetricName : null;
      if (!Array.isArray(nextOption.series)) {
        return nextOption;
      }
      const pointerColor = chartStyle.gaugePointerColor || chartStyle.accentColor || palette[0] || "#1677ff";
      const detailColor = chartStyle.gaugeDetailColor || "#101828";
      const titleColor = chartStyle.gaugeTitleColor || "#667085";
      const axisLabelColor = chartStyle.gaugeAxisLabelColor || "#344054";
      const splitLineColor = chartStyle.gaugeSplitLineColor || "#98a2b3";
      const progressWidth = normalizeNumber(chartStyle.gaugeProgressWidth, 18);
      const axisLineWidth = normalizeNumber(chartStyle.gaugeAxisLineWidth, progressWidth);
      nextOption.color = palette;
      nextOption.series = nextOption.series.map((item) => {
        if (item?.type !== "gauge") {
          return item;
        }
        return {
          ...item,
          type: "gauge",
          startAngle: normalizeNumber(chartStyle.gaugeStartAngle ?? item.startAngle, 210),
          endAngle: normalizeNumber(chartStyle.gaugeEndAngle ?? item.endAngle, -30),
          radius: normalizeChartDimension(chartStyle.gaugeRadius ?? item.radius, "90%"),
          data: Array.isArray(item.data) ? item.data.map((entry = {}) => ({
            ...entry,
            name: configuredMetricName ?? entry?.name ?? "\u6307\u6807"
          })) : item.data,
          progress: {
            ...item.progress || {},
            show: item.progress?.show ?? true,
            roundCap: item.progress?.roundCap ?? true,
            width: progressWidth,
            itemStyle: {
              ...item.progress?.itemStyle || {},
              color: pointerColor
            }
          },
          axisLine: {
            ...item.axisLine || {},
            roundCap: item.axisLine?.roundCap ?? true,
            lineStyle: {
              ...(item.axisLine || {}).lineStyle || {},
              width: axisLineWidth,
              color: buildGaugeAxisLineColors(palette)
            }
          },
          pointer: {
            ...item.pointer || {},
            show: item.pointer?.show ?? true,
            length: normalizeChartDimension(chartStyle.gaugePointerLength ?? item.pointer?.length, "58%"),
            itemStyle: {
              ...item.pointer?.itemStyle || {},
              color: pointerColor
            }
          },
          anchor: {
            ...item.anchor || {},
            show: item.anchor?.show ?? true,
            showAbove: item.anchor?.showAbove ?? true,
            size: item.anchor?.size ?? 10,
            itemStyle: {
              ...item.anchor?.itemStyle || {},
              color: pointerColor
            }
          },
          itemStyle: {
            ...item.itemStyle || {},
            color: pointerColor
          },
          axisTick: {
            ...item.axisTick || {},
            lineStyle: {
              ...(item.axisTick || {}).lineStyle || {},
              color: splitLineColor
            }
          },
          splitLine: {
            ...item.splitLine || {},
            lineStyle: {
              ...(item.splitLine || {}).lineStyle || {},
              color: splitLineColor
            }
          },
          axisLabel: {
            ...item.axisLabel || {},
            color: axisLabelColor
          },
          title: {
            ...item.title || {},
            show: item.title?.show ?? true,
            color: titleColor,
            fontSize: normalizeNumber(chartStyle.gaugeTitleFontSize ?? item.title?.fontSize, 14)
          },
          detail: {
            ...item.detail || {},
            show: item.detail?.show ?? true,
            color: detailColor,
            fontSize: normalizeNumber(chartStyle.gaugeDetailFontSize ?? item.detail?.fontSize, 24),
            fontWeight: normalizeNumber(chartStyle.gaugeDetailFontWeight ?? item.detail?.fontWeight, 700)
          }
        };
      });
      if (nextOption.legend) {
        nextOption.legend = { ...nextOption.legend || {}, show: false };
      }
      return nextOption;
    }
    function applyChartStyle(option = {}, chrome = {}, chartStyle = {}, mapStyle = {}, chartAnalysis = {}) {
      const nextOption = { ...option || {} };
      if (chrome.showTitle === false) {
        delete nextOption.title;
      } else if (chrome.titleText) {
        nextOption.title = {
          ...nextOption.title || {},
          text: chrome.titleText,
          textStyle: {
            ...(nextOption.title || {}).textStyle || {},
            color: chrome.titleColor || "#101828",
            fontSize: chrome.titleFontSize || 18,
            fontWeight: chrome.titleFontWeight || 700
          },
          left: chrome.titleAlign === "center" ? "center" : chrome.titleAlign === "right" ? "right" : "left"
        };
      }
      const isSankeyChart = Array.isArray(nextOption.series) && nextOption.series.some((item) => item?.type === "sankey");
      if (isSankeyChart) {
        return applySankeyChartStyle(nextOption, chrome, chartStyle);
      }
      const isFunnelChart = Array.isArray(nextOption.series) && nextOption.series.some((item) => item?.type === "funnel");
      if (isFunnelChart) {
        return applyFunnelChartStyle(nextOption, chrome, chartStyle);
      }
      const isWordCloudChart = Array.isArray(nextOption.series) && nextOption.series.some((item) => item?.type === "wordCloud");
      if (isWordCloudChart) {
        return applyWordCloudChartStyle(nextOption, chrome, chartStyle);
      }
      const isGaugeChart = Array.isArray(nextOption.series) && nextOption.series.some((item) => item?.type === "gauge");
      if (isGaugeChart) {
        return applyGaugeChartStyle(nextOption, chrome, chartStyle);
      }
      const isHorizontalBarChart = Array.isArray(nextOption.series) && nextOption.series.some((item) => item?.type === "bar") && (Array.isArray(nextOption.yAxis) ? nextOption.yAxis[0] : nextOption.yAxis)?.type === "category";
      const isScatterChart = Array.isArray(nextOption.series) && nextOption.series.some((item) => item?.type === "scatter");
      const paddingPresetMap = {
        compact: { left: 4, right: 4, top: 8, bottom: 4 },
        comfortable: { left: 18, right: 18, top: 24, bottom: 18 },
        spacious: { left: 40, right: 40, top: 52, bottom: 40 }
      };
      const resolvedPadding = paddingPresetMap[chrome.paddingPreset || "comfortable"] || paddingPresetMap.comfortable;
      const barAxisExtraLeft = chartStyle.showYAxis !== false ? 28 : 0;
      const barAxisExtraBottom = chartStyle.showXAxis !== false ? 28 : 0;
      const legendPosition = chartStyle.legendPosition || "bottom";
      const barLegendExtraBottom = chartStyle.showLegend !== false && legendPosition === "bottom" ? 10 : 0;
      const barLegendExtraTop = chartStyle.showLegend !== false && legendPosition === "top" ? 10 : 0;
      const barLegendExtraLeft = chartStyle.showLegend !== false && legendPosition === "left" ? 10 : 0;
      const barLegendExtraRight = chartStyle.showLegend !== false && legendPosition === "right" ? 10 : 0;
      const axisColor = chartStyle.axisColor || null;
      const axisLabelColor = chartStyle.axisLabelColor || null;
      const splitLineColor = chartStyle.splitLineColor || null;
      const axisLabelFontSize = normalizeNumber(chartStyle.axisLabelFontSize, 12);
      const axisLabelFontWeight = normalizeNumber(chartStyle.axisLabelFontWeight, 400);
      const xAxisUnitLabel = normalizeText(chartStyle.xAxisUnitLabel, "");
      const yAxisUnitLabel = normalizeText(chartStyle.yAxisUnitLabel, "");
      nextOption.grid = {
        ...nextOption.grid || {},
        left: resolvedPadding.left + barAxisExtraLeft + barLegendExtraLeft,
        right: resolvedPadding.right + barLegendExtraRight,
        top: resolvedPadding.top + barLegendExtraTop,
        bottom: resolvedPadding.bottom + Math.max(barAxisExtraBottom, barLegendExtraBottom),
        containLabel: true
      };
      if (chartStyle.showLegend === false) {
        delete nextOption.legend;
      }
      if (chartStyle.showAxis === false) {
        if (nextOption.xAxis) nextOption.xAxis = Array.isArray(nextOption.xAxis) ? nextOption.xAxis.map((item) => ({ ...item, show: false })) : { ...nextOption.xAxis, show: false };
        if (nextOption.yAxis) nextOption.yAxis = Array.isArray(nextOption.yAxis) ? nextOption.yAxis.map((item) => ({ ...item, show: false })) : { ...nextOption.yAxis, show: false };
      }
      if (typeof chartStyle.showXAxis === "boolean" && nextOption.xAxis) {
        const applyAxisVisibility = (axis) => ({
          ...axis,
          show: chartStyle.showXAxis,
          axisLine: { ...axis.axisLine || {}, show: chartStyle.showXAxis },
          axisTick: { ...axis.axisTick || {}, show: chartStyle.showXAxis },
          axisLabel: { ...axis.axisLabel || {}, show: chartStyle.showXAxis }
        });
        nextOption.xAxis = Array.isArray(nextOption.xAxis) ? nextOption.xAxis.map(applyAxisVisibility) : applyAxisVisibility(nextOption.xAxis);
      }
      if (typeof chartStyle.showYAxis === "boolean" && nextOption.yAxis) {
        const applyAxisVisibility = (axis) => ({
          ...axis,
          show: chartStyle.showYAxis,
          axisLine: { ...axis.axisLine || {}, show: chartStyle.showYAxis },
          axisTick: { ...axis.axisTick || {}, show: chartStyle.showYAxis },
          axisLabel: { ...axis.axisLabel || {}, show: chartStyle.showYAxis }
        });
        nextOption.yAxis = Array.isArray(nextOption.yAxis) ? nextOption.yAxis.map(applyAxisVisibility) : applyAxisVisibility(nextOption.yAxis);
      }
      if (nextOption.xAxis) {
        const applyAxis = (axis) => ({
          ...axis,
          name: xAxisUnitLabel || axis.name,
          nameTextStyle: {
            ...axis.nameTextStyle || {},
            color: axisLabelColor || (axis.nameTextStyle || {}).color,
            fontSize: axisLabelFontSize || (axis.nameTextStyle || {}).fontSize,
            fontWeight: axisLabelFontWeight || (axis.nameTextStyle || {}).fontWeight
          },
          axisLine: {
            ...axis.axisLine || {},
            lineStyle: {
              ...(axis.axisLine || {}).lineStyle || {},
              color: axisColor || (axis.axisLine || {}).lineStyle?.color
            }
          },
          axisLabel: {
            ...axis.axisLabel || {},
            color: axisLabelColor || (axis.axisLabel || {}).color,
            fontSize: axisLabelFontSize || (axis.axisLabel || {}).fontSize,
            fontWeight: axisLabelFontWeight || (axis.axisLabel || {}).fontWeight
          },
          splitLine: {
            ...axis.splitLine || {},
            show: Boolean(chartStyle.showGridLines),
            lineStyle: {
              ...(axis.splitLine || {}).lineStyle || {},
              color: splitLineColor || (axis.splitLine || {}).lineStyle?.color
            }
          }
        });
        nextOption.xAxis = Array.isArray(nextOption.xAxis) ? nextOption.xAxis.map(applyAxis) : applyAxis(nextOption.xAxis);
      }
      if (nextOption.yAxis) {
        const applyAxis = (axis) => ({
          ...axis,
          name: yAxisUnitLabel || axis.name,
          nameTextStyle: {
            ...axis.nameTextStyle || {},
            color: axisLabelColor || (axis.nameTextStyle || {}).color,
            fontSize: axisLabelFontSize || (axis.nameTextStyle || {}).fontSize,
            fontWeight: axisLabelFontWeight || (axis.nameTextStyle || {}).fontWeight
          },
          axisLine: {
            ...axis.axisLine || {},
            lineStyle: {
              ...(axis.axisLine || {}).lineStyle || {},
              color: axisColor || (axis.axisLine || {}).lineStyle?.color
            }
          },
          axisLabel: {
            ...axis.axisLabel || {},
            color: axisLabelColor || (axis.axisLabel || {}).color,
            fontSize: axisLabelFontSize || (axis.axisLabel || {}).fontSize,
            fontWeight: axisLabelFontWeight || (axis.axisLabel || {}).fontWeight
          },
          splitLine: {
            ...axis.splitLine || {},
            show: Boolean(chartStyle.showGridLines),
            lineStyle: {
              ...(axis.splitLine || {}).lineStyle || {},
              color: splitLineColor || (axis.splitLine || {}).lineStyle?.color
            }
          }
        });
        nextOption.yAxis = Array.isArray(nextOption.yAxis) ? nextOption.yAxis.map(applyAxis) : applyAxis(nextOption.yAxis);
      }
      if (Array.isArray(nextOption.series)) {
        const scatterPalette = Array.isArray(chartStyle.palette) && chartStyle.palette.length ? chartStyle.palette : [chartStyle.accentColor || "#1677ff", "#55c6a9", "#f4b95d", "#8f7cff", "#f28f8f"].filter(Boolean);
        const scatterBorderColor = chartStyle.scatterPointBorderColor || chartStyle.pointBorderColor || chrome.backgroundColor || "#ffffff";
        const scatterBorderWidth = normalizeNumber(chartStyle.scatterPointBorderWidth, 1);
        const scatterOpacity = Math.max(0, Math.min(1, Number(chartStyle.scatterPointOpacity ?? 0.82)));
        const scatterLabelPosition = chartStyle.scatterLabelPosition || "top";
        const scatterSymbolSize = normalizeNumber(chartStyle.scatterSymbolSize, 16);
        nextOption.series = nextOption.series.map((item) => ({
          ...item,
          label: {
            ...item.label || {},
            show: item.type === "map" || item.type === "pie" || item.type === "funnel" || item.type === "radar" ? chartStyle.showLabels !== false : item.type === "pictorialBar" ? false : chartStyle.showLabels !== false,
            position: item.type === "bar" ? resolveBarLabelPosition(isHorizontalBarChart, chartStyle.barValuePosition) : item.type === "scatter" ? scatterLabelPosition : item.label?.position,
            color: chartStyle.dataLabelColor || "#ffffff",
            fontSize: chartStyle.dataLabelFontSize || 14,
            fontWeight: chartStyle.dataLabelFontWeight || 500
          }
        }));
        nextOption.series = nextOption.series.map((item, seriesIndex) => item.type === "scatter" ? {
          ...item,
          name: item.name || chartStyle.legendPrimaryName || "\u6563\u70B9",
          symbolSize: normalizeNumber(item.symbolSize ?? chartStyle.scatterSymbolSize, 16),
          itemStyle: {
            ...item.itemStyle || {},
            color: item.itemStyle?.color || scatterPalette[seriesIndex % Math.max(1, scatterPalette.length)] || chartStyle.accentColor || "#1677ff",
            opacity: scatterOpacity,
            borderColor: scatterBorderColor,
            borderWidth: scatterBorderWidth
          },
          data: Array.isArray(item.data) ? item.data.map((entry, dataIndex) => {
            const paletteColor = scatterPalette[dataIndex % Math.max(1, scatterPalette.length)] || chartStyle.accentColor || "#1677ff";
            if (entry && typeof entry === "object" && !Array.isArray(entry)) {
              return {
                ...entry,
                symbolSize: normalizeNumber(entry.symbolSize ?? scatterSymbolSize, scatterSymbolSize),
                itemStyle: {
                  ...entry.itemStyle || {},
                  color: paletteColor,
                  opacity: scatterOpacity,
                  borderColor: scatterBorderColor,
                  borderWidth: scatterBorderWidth
                },
                label: {
                  ...entry.label || {},
                  show: chartStyle.showLabels !== false,
                  position: scatterLabelPosition,
                  color: chartStyle.dataLabelColor || "#344054",
                  fontSize: chartStyle.dataLabelFontSize || 14,
                  fontWeight: chartStyle.dataLabelFontWeight || 500
                }
              };
            }
            return {
              value: entry,
              symbolSize: scatterSymbolSize,
              itemStyle: {
                color: paletteColor,
                opacity: scatterOpacity,
                borderColor: scatterBorderColor,
                borderWidth: scatterBorderWidth
              },
              label: {
                show: chartStyle.showLabels !== false,
                position: scatterLabelPosition,
                color: chartStyle.dataLabelColor || "#344054",
                fontSize: chartStyle.dataLabelFontSize || 14,
                fontWeight: chartStyle.dataLabelFontWeight || 500
              }
            };
          }) : item.data
        } : item);
        if (mapStyle.provinceCode) {
          nextOption.series = nextOption.series.map((item) => item.type === "map" ? { ...item, map: mapStyle.provinceCode } : item);
        }
        nextOption.series = nextOption.series.map((item) => item.type === "map" ? {
          ...item,
          roam: true,
          center: Array.isArray(mapStyle.center) ? mapStyle.center : item.center,
          zoom: typeof mapStyle.zoom === "number" ? mapStyle.zoom : item.zoom,
          itemStyle: {
            ...item.itemStyle || {},
            borderColor: chartStyle.mapRegionBorderColor || item.itemStyle?.borderColor
          },
          label: {
            ...item.label || {},
            color: chartStyle.mapLabelColor || item.label?.color
          }
        } : item);
        if (chartAnalysis.showExtrema) {
          nextOption.series = nextOption.series.map((item) => ({
            ...item,
            markPoint: {
              ...item.markPoint || {},
              data: [{ type: "max", name: "\u6700\u5927\u503C" }, { type: "min", name: "\u6700\u5C0F\u503C" }]
            }
          }));
        }
      }
      if (isScatterChart && !nextOption.legend && chartStyle.showLegend !== false) {
        const scatterLegendSeries = Array.isArray(nextOption.series) ? nextOption.series.filter((item) => item?.type === "scatter") : [];
        nextOption.legend = {
          data: scatterLegendSeries.map((item, index) => item.name || chartStyle.legendPrimaryName || `\u6563\u70B9${index + 1}`),
          top: legendPosition === "top" ? 4 : void 0,
          bottom: legendPosition === "bottom" ? 4 : void 0,
          left: legendPosition === "left" ? 8 : legendPosition === "right" ? void 0 : "center",
          right: legendPosition === "right" ? 8 : void 0,
          orient: legendPosition === "left" || legendPosition === "right" ? "vertical" : "horizontal"
        };
      }
      if (nextOption.legend) {
        nextOption.legend = {
          ...nextOption.legend || {},
          show: chartStyle.showLegend !== false,
          top: legendPosition === "top" ? 4 : void 0,
          bottom: legendPosition === "bottom" ? 4 : void 0,
          left: legendPosition === "left" ? 8 : legendPosition === "right" ? void 0 : "center",
          right: legendPosition === "right" ? 8 : void 0,
          orient: legendPosition === "left" || legendPosition === "right" ? "vertical" : "horizontal",
          textStyle: {
            ...(nextOption.legend || {}).textStyle || {},
            color: chartStyle.legendTextColor || ((nextOption.legend || {}).textStyle || {}).color,
            fontSize: chartStyle.legendFontSize || ((nextOption.legend || {}).textStyle || {}).fontSize || 14,
            fontWeight: chartStyle.legendFontWeight || ((nextOption.legend || {}).textStyle || {}).fontWeight || 500
          }
        };
      }
      if (nextOption.visualMap || Array.isArray(nextOption.series) && nextOption.series.some((item) => item?.type === "map")) {
        nextOption.visualMap = {
          ...nextOption.visualMap || {},
          inRange: {
            ...(nextOption.visualMap || {}).inRange || {},
            color: getMapRegionPalette(chartStyle)
          },
          textStyle: {
            ...(nextOption.visualMap || {}).textStyle || {},
            color: chartStyle.mapVisualMapTextColor || ((nextOption.visualMap || {}).textStyle || {}).color
          }
        };
      }
      return nextOption;
    }
    function buildDefaultChartAssets() {
      return [
        {
          chartName: "\u57FA\u7840\u67F1\u72B6\u56FE",
          chartCode: "builtin_bar_basic",
          chartType: "echarts",
          category: "\u6BD4\u8F83\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u7C7B\u522B\u5BF9\u6BD4\u7684\u57FA\u7840\u67F1\u72B6\u56FE\u6A21\u677F",
          tags: ["bar", "compare"],
          config: {
            chartFamily: "bar",
            variantName: "\u57FA\u7840\u84DD\u67F1",
            palettePreset: "ocean",
            accentColor: "#1677ff",
            xField: "category",
            yField: "value",
            color: "#1677ff"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: [{ type: "bar", data: [], itemStyle: { borderRadius: [6, 6, 0, 0] } }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "\u5206\u7C7B\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "\u6307\u6807\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u9713\u8679\u6E10\u53D8\u67F1\u56FE",
          chartCode: "builtin_bar_gradient_neon",
          chartType: "echarts",
          category: "\u6BD4\u8F83\u5206\u6790",
          renderMode: "dataset",
          description: "\u9AD8\u5BF9\u6BD4\u9713\u8679\u6E10\u53D8\u67F1\u56FE\uFF0C\u9002\u5408\u5927\u5C4F\u548C\u91CD\u70B9\u6307\u6807\u5C55\u793A",
          tags: ["bar", "gradient", "neon"],
          config: {
            chartFamily: "bar",
            variantName: "\u9713\u8679\u6E10\u53D8",
            palettePreset: "neon",
            accentColor: "#14f1ff",
            xField: "category",
            yField: "value",
            colorStart: "#34d3ff",
            colorEnd: "#267dff"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            grid: { left: 24, right: 24, top: 24, bottom: 24, containLabel: true },
            xAxis: { type: "category", data: [], axisLine: { lineStyle: { color: "#9fb9ff" } } },
            yAxis: { type: "value", splitLine: { lineStyle: { color: "rgba(113,142,191,0.18)" } } },
            series: [{ type: "bar", data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "\u5206\u7C7B\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "\u6307\u6807\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u91D1\u5C5E\u8D28\u611F\u67F1\u56FE",
          chartCode: "builtin_bar_metal",
          chartType: "echarts",
          category: "\u6BD4\u8F83\u5206\u6790",
          renderMode: "dataset",
          description: "\u9AD8\u5149\u91D1\u5C5E\u8D28\u611F\u67F1\u56FE\uFF0C\u9002\u5408\u6B63\u5F0F\u62A5\u8868\u548C\u9AD8\u7AEF\u9A7E\u9A76\u8231",
          tags: ["bar", "metal", "luxury"],
          config: {
            chartFamily: "bar",
            variantName: "\u91D1\u5C5E\u8D28\u611F",
            palettePreset: "gold",
            accentColor: "#d7a129",
            xField: "category",
            yField: "value",
            colorStart: "#f9e08b",
            colorEnd: "#c28a14"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: [{ type: "bar", data: [], itemStyle: { borderRadius: [12, 12, 0, 0] } }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "\u5206\u7C7B\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "\u6307\u6807\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u80F6\u56CA\u67F1\u56FE",
          chartCode: "builtin_bar_capsule",
          chartType: "echarts",
          category: "\u6BD4\u8F83\u5206\u6790",
          renderMode: "dataset",
          description: "\u67D4\u548C\u5706\u89D2\u7684\u80F6\u56CA\u67F1\u56FE\uFF0C\u66F4\u9002\u5408\u4F1A\u5458\u62A5\u544A\u548C\u5546\u4E1A\u4EEA\u8868\u76D8",
          tags: ["bar", "capsule", "soft"],
          config: {
            chartFamily: "bar",
            variantName: "\u80F6\u56CA\u98CE\u683C",
            palettePreset: "fresh",
            accentColor: "#52c41a",
            xField: "category",
            yField: "value",
            colorStart: "#8ce99a",
            colorEnd: "#34a853"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: [{ type: "bar", data: [], barWidth: 24, itemStyle: { borderRadius: 999 } }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "\u5206\u7C7B\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "\u6307\u6807\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u5F71\u5B50\u7ACB\u4F53\u67F1\u56FE",
          chartCode: "builtin_bar_shadow_volume",
          chartType: "echarts",
          category: "\u6BD4\u8F83\u5206\u6790",
          renderMode: "dataset",
          description: "\u5E26\u6295\u5F71\u548C\u4F53\u79EF\u611F\u7684\u67F1\u56FE\uFF0C\u9002\u5408\u91CD\u70B9\u5BF9\u6BD4\u5C55\u793A",
          tags: ["bar", "shadow", "volume"],
          config: {
            chartFamily: "bar",
            variantName: "\u6295\u5F71\u89C6\u89C9",
            palettePreset: "sunset",
            accentColor: "#ff7a45",
            xField: "category",
            yField: "value",
            colorStart: "#ffbb7a",
            colorEnd: "#ff7a45"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: [{ type: "bar", data: [], itemStyle: { borderRadius: [10, 10, 0, 0], shadowBlur: 16, shadowColor: "rgba(255,122,69,0.28)" } }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "\u5206\u7C7B\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "\u6307\u6807\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u5806\u53E0\u67F1\u72B6\u56FE",
          chartCode: "builtin_bar_stacked",
          chartType: "echarts",
          category: "\u6BD4\u8F83\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u5206\u7EC4\u5BF9\u6BD4\u7684\u5806\u53E0\u67F1\u72B6\u56FE\u6A21\u677F",
          tags: ["bar", "stacked", "compare"],
          config: {
            chartFamily: "bar",
            variantName: "\u5806\u53E0\u7ECF\u5178",
            palettePreset: "business",
            accentColor: "#5b8ff9",
            xField: "category",
            yField: "value",
            seriesField: "series_name"
          },
          optionTemplate: {
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
            legend: {},
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: []
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "\u5206\u7C7B\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "\u6307\u6807\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] },
              { key: "seriesField", label: "\u7CFB\u5217\u5B57\u6BB5", required: false, acceptRoles: ["dimension", "category"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u57FA\u7840\u6298\u7EBF\u56FE",
          chartCode: "builtin_line_basic",
          chartType: "echarts",
          category: "\u8D8B\u52BF\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u8D8B\u52BF\u5206\u6790\u7684\u57FA\u7840\u6298\u7EBF\u56FE\u6A21\u677F",
          tags: ["line", "trend"],
          config: {
            chartFamily: "line",
            variantName: "\u7ECF\u5178\u6298\u7EBF",
            palettePreset: "ocean",
            accentColor: "#13c2c2",
            xField: "category",
            yField: "value",
            smooth: true,
            color: "#13c2c2"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: [{ type: "line", smooth: true, data: [], areaStyle: { opacity: 0.12 } }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "X \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "Y \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u9713\u8679\u5149\u5E26\u6298\u7EBF\u56FE",
          chartCode: "builtin_line_glow",
          chartType: "echarts",
          category: "\u8D8B\u52BF\u5206\u6790",
          renderMode: "dataset",
          description: "\u5E26\u9AD8\u5149\u548C\u9634\u5F71\u7684\u70AB\u5F69\u6298\u7EBF\u56FE\uFF0C\u9002\u5408\u5173\u952E\u8D8B\u52BF\u5C55\u793A",
          tags: ["line", "glow", "trend"],
          config: {
            chartFamily: "line",
            variantName: "\u9713\u8679\u5149\u5E26",
            palettePreset: "neon",
            accentColor: "#2de2e6",
            xField: "category",
            yField: "value",
            smooth: true,
            color: "#2de2e6"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: [{ type: "line", smooth: true, data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "X \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "Y \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u53CC\u6E10\u53D8\u9762\u79EF\u6298\u7EBF\u56FE",
          chartCode: "builtin_line_dual_gradient",
          chartType: "echarts",
          category: "\u8D8B\u52BF\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u8425\u6536\u3001\u6D41\u91CF\u7B49\u8D8B\u52BF\u7684\u53CC\u5C42\u6E10\u53D8\u6298\u7EBF\u9762\u79EF\u56FE",
          tags: ["line", "gradient", "area"],
          config: {
            chartFamily: "line",
            variantName: "\u53CC\u6E10\u53D8\u9762\u79EF",
            palettePreset: "skyline",
            accentColor: "#4f8cff",
            xField: "category",
            yField: "value",
            smooth: true,
            colorStart: "#83b7ff",
            colorEnd: "#3867ff"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: [{ type: "line", smooth: true, data: [], areaStyle: { opacity: 0.24 } }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "X \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "Y \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u9636\u68AF\u6298\u7EBF\u56FE",
          chartCode: "builtin_line_step",
          chartType: "echarts",
          category: "\u8D8B\u52BF\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u9608\u503C\u3001\u9636\u6BB5\u53D8\u5316\u7684\u9636\u68AF\u6298\u7EBF\u56FE",
          tags: ["line", "step", "trend"],
          config: {
            chartFamily: "line",
            variantName: "\u9636\u68AF\u98CE\u683C",
            palettePreset: "tech",
            accentColor: "#5f63ff",
            xField: "category",
            yField: "value"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: [{ type: "line", step: "middle", data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "X \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "Y \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u4E1D\u6ED1\u6781\u7EC6\u6298\u7EBF\u56FE",
          chartCode: "builtin_line_slim",
          chartType: "echarts",
          category: "\u8D8B\u52BF\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u8F7B\u76C8\u98CE\u683C\u5206\u6790\u9875\u7684\u7EC6\u7EBF\u8D8B\u52BF\u56FE",
          tags: ["line", "slim", "minimal"],
          config: {
            chartFamily: "line",
            variantName: "\u6781\u7EC6\u7B80\u7EA6",
            palettePreset: "mint",
            accentColor: "#36cfc9",
            xField: "category",
            yField: "value",
            smooth: true
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: [{ type: "line", smooth: true, data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "X \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "Y \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u9762\u79EF\u56FE",
          chartCode: "builtin_area_basic",
          chartType: "echarts",
          category: "\u8D8B\u52BF\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u5C55\u793A\u65F6\u95F4\u5E8F\u5217\u8D8B\u52BF\u548C\u6CE2\u52A8\u533A\u95F4\u7684\u9762\u79EF\u56FE\u6A21\u677F",
          tags: ["area", "trend"],
          config: {
            chartFamily: "line",
            variantName: "\u57FA\u7840\u9762\u79EF",
            palettePreset: "fresh",
            accentColor: "#52c41a",
            xField: "category",
            yField: "value",
            smooth: true,
            color: "#52c41a"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: [{ type: "line", smooth: true, data: [], areaStyle: { opacity: 0.2 } }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "X \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "Y \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u8F7B\u67D4\u5806\u53E0\u9762\u79EF\u56FE",
          chartCode: "builtin_area_soft_stack",
          chartType: "echarts",
          category: "\u8D8B\u52BF\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u5C55\u793A\u591A\u4E2A\u7CFB\u5217\u5360\u6BD4\u53D8\u5316\u7684\u67D4\u548C\u5F69\u8272\u9762\u79EF\u56FE",
          tags: ["area", "soft", "stacked"],
          config: {
            chartFamily: "line",
            variantName: "\u67D4\u548C\u5806\u53E0",
            palettePreset: "pastel",
            accentColor: "#84cc16",
            xField: "category",
            yField: "value",
            seriesField: "series_name"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            legend: {},
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: []
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "X \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "Y \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] },
              { key: "seriesField", label: "\u7CFB\u5217\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u57FA\u7840\u997C\u56FE",
          chartCode: "builtin_pie_basic",
          chartType: "echarts",
          category: "\u5360\u6BD4\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u5360\u6BD4\u5206\u6790\u7684\u57FA\u7840\u997C\u56FE\u6A21\u677F",
          tags: ["pie", "ratio"],
          config: {
            chartFamily: "pie",
            variantName: "\u7ECF\u5178\u73AF\u5F62",
            palettePreset: "business",
            accentColor: "#1677ff",
            nameField: "category",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { trigger: "item" },
            legend: { bottom: 0 },
            series: [{ type: "pie", radius: ["40%", "70%"], avoidLabelOverlap: true, data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "nameField", label: "\u540D\u79F0\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u6563\u70B9\u56FE",
          chartCode: "builtin_scatter_basic",
          chartType: "echarts",
          category: "\u5173\u7CFB\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u5206\u6790\u4E24\u4E2A\u6307\u6807\u95F4\u5173\u7CFB\u7684\u6563\u70B9\u56FE\u6A21\u677F",
          tags: ["scatter", "relation"],
          config: {
            xField: "x_value",
            yField: "y_value"
          },
          optionTemplate: {
            tooltip: { trigger: "item" },
            xAxis: { type: "value" },
            yAxis: { type: "value" },
            series: [{ type: "scatter", data: [], symbolSize: 16 }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "X \u6307\u6807\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] },
              { key: "yField", label: "Y \u6307\u6807\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u96F7\u8FBE\u56FE",
          chartCode: "builtin_radar_basic",
          chartType: "echarts",
          category: "\u6BD4\u8F83\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u591A\u6307\u6807\u6A2A\u5411\u5BF9\u6BD4\u7684\u96F7\u8FBE\u56FE\u6A21\u677F",
          tags: ["radar", "compare"],
          config: {
            nameField: "category",
            valueField: "value",
            valueField2: ""
          },
          optionTemplate: {
            tooltip: {},
            radar: { indicator: [] },
            series: [{ type: "radar", data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "nameField", label: "\u6307\u6807\u540D\u79F0\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6307\u6807\u5B57\u6BB5\u4E00", required: true, acceptRoles: ["metric", "value"] },
              { key: "valueField2", label: "\u6307\u6807\u5B57\u6BB5\u4E8C\uFF08\u53EF\u9009\uFF09", required: false, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u6F0F\u6597\u56FE",
          chartCode: "builtin_funnel_basic",
          chartType: "echarts",
          category: "\u8F6C\u5316\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u9636\u6BB5\u8F6C\u5316\u5206\u6790\u7684\u6F0F\u6597\u56FE\u6A21\u677F",
          tags: ["funnel", "conversion"],
          config: {
            nameField: "category",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { trigger: "item" },
            series: [{ type: "funnel", data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "nameField", label: "\u9636\u6BB5\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u8BCD\u4E91\u56FE",
          chartCode: "builtin_wordcloud_basic",
          chartType: "echarts",
          category: "\u6587\u672C\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u70ED\u8BCD\u3001\u6807\u7B7E\u805A\u7C7B\u548C\u8206\u60C5\u5173\u952E\u8BCD\u5206\u5E03\u7684\u8BCD\u4E91\u56FE\u6A21\u677F",
          tags: ["wordcloud", "text", "keyword"],
          config: {
            chartFamily: "wordCloud",
            variantName: "\u57FA\u7840\u8BCD\u4E91",
            palettePreset: "business",
            accentColor: "#1677ff",
            nameField: "category",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { trigger: "item", formatter: "{b}: {c}" },
            series: [{
              type: "wordCloud",
              shape: "circle",
              left: "center",
              top: "center",
              width: "100%",
              height: "100%",
              sizeRange: [16, 52],
              rotationRange: [-90, 90],
              rotationStep: 45,
              gridSize: 10,
              drawOutOfBound: false,
              textStyle: {
                fontFamily: "sans-serif",
                fontWeight: 700
              },
              emphasis: {
                focus: "self",
                textStyle: {
                  shadowBlur: 12,
                  shadowColor: "rgba(15,23,42,0.14)"
                }
              },
              data: []
            }]
          },
          mappingSchema: {
            fields: [
              { key: "nameField", label: "\u8BCD\u9879\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6743\u91CD\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u4EEA\u8868\u76D8",
          chartCode: "builtin_gauge_basic",
          chartType: "echarts",
          category: "\u6307\u6807\u76D1\u63A7",
          renderMode: "dataset",
          description: "\u9002\u5408\u5355\u6307\u6807\u8FDB\u5EA6\u548C\u8FBE\u6210\u7387\u5C55\u793A\u7684\u4EEA\u8868\u76D8\u6A21\u677F",
          tags: ["gauge", "kpi"],
          config: {
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { formatter: "{a}<br/>{b}: {c}%" },
            series: [{ type: "gauge", progress: { show: true }, detail: { valueAnimation: true }, data: [{ value: 0, name: "\u6307\u6807" }] }]
          },
          mappingSchema: {
            fields: [
              { key: "valueField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u7ACB\u4F53\u67F1\u72B6\u56FE",
          chartCode: "builtin_bar_3d_like",
          chartType: "echarts",
          category: "\u6BD4\u8F83\u5206\u6790",
          renderMode: "dataset",
          description: "\u4F7F\u7528\u4F2A 3D \u67F1\u4F53\u548C\u9AD8\u5149\u9876\u9762\u589E\u5F3A\u89C6\u89C9\u51B2\u51FB\u7684\u67F1\u72B6\u56FE\u6A21\u677F",
          tags: ["bar", "3d", "pictorial"],
          config: {
            xField: "category",
            yField: "value",
            color: "#3f8cff"
          },
          optionTemplate: {
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
            grid: { left: 24, right: 24, top: 24, bottom: 24, containLabel: true },
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: []
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "\u5206\u7C7B\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "\u6307\u6807\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u6A2A\u5411\u6392\u540D\u6761\u5F62\u56FE",
          chartCode: "builtin_bar_horizontal",
          chartType: "echarts",
          category: "\u6BD4\u8F83\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408 TopN \u6392\u540D\u548C\u6A2A\u5411\u6BD4\u8F83\u7684\u6761\u5F62\u56FE\u6A21\u677F",
          tags: ["bar", "ranking", "horizontal"],
          config: {
            xField: "value",
            yField: "category",
            color: "#5b8ff9"
          },
          optionTemplate: {
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
            grid: { left: 24, right: 24, top: 24, bottom: 24, containLabel: true },
            xAxis: { type: "value" },
            yAxis: { type: "category", data: [] },
            series: [{ type: "bar", data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] },
              { key: "yField", label: "\u5206\u7C7B\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u5806\u53E0\u9762\u79EF\u56FE",
          chartCode: "builtin_area_stacked",
          chartType: "echarts",
          category: "\u8D8B\u52BF\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u6309\u7CFB\u5217\u7D2F\u8BA1\u8D8B\u52BF\u5C55\u793A\u7684\u5806\u53E0\u9762\u79EF\u56FE\u6A21\u677F",
          tags: ["area", "stacked", "trend"],
          config: {
            xField: "category",
            yField: "value",
            seriesField: "series_name"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            legend: {},
            xAxis: { type: "category", data: [] },
            yAxis: { type: "value" },
            series: []
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "X \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "Y \u8F74\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] },
              { key: "seriesField", label: "\u7CFB\u5217\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u5F69\u8272\u591A\u73AF\u56FE",
          chartCode: "builtin_pie_multi_ring",
          chartType: "echarts",
          category: "\u5360\u6BD4\u5206\u6790",
          renderMode: "dataset",
          description: "\u5E26\u67D4\u548C\u5F69\u73AF\u548C\u7CBE\u81F4\u6807\u7B7E\u7684\u9AD8\u989C\u503C\u73AF\u56FE\u6A21\u677F",
          tags: ["pie", "ring", "colorful"],
          config: {
            chartFamily: "pie",
            variantName: "\u5F69\u8272\u591A\u73AF",
            palettePreset: "rainbow",
            accentColor: "#7c5cff",
            nameField: "category",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { trigger: "item" },
            legend: { bottom: 0 },
            series: [{ type: "pie", radius: ["48%", "72%"], data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "nameField", label: "\u540D\u79F0\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u534A\u73AF KPI \u56FE",
          chartCode: "builtin_pie_half_ring",
          chartType: "echarts",
          category: "\u5360\u6BD4\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u4F1A\u5458\u62A5\u544A\u548C\u603B\u89C8\u5361\u7247\u7684\u534A\u73AF KPI \u56FE",
          tags: ["pie", "half", "kpi"],
          config: {
            chartFamily: "pie",
            variantName: "\u534A\u73AFKPI",
            palettePreset: "sunset",
            accentColor: "#ff7a45",
            nameField: "category",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { trigger: "item" },
            series: [{ type: "pie", startAngle: 180, radius: ["56%", "82%"], center: ["50%", "72%"], data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "nameField", label: "\u540D\u79F0\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u73BB\u7483\u8D28\u611F\u73AF\u56FE",
          chartCode: "builtin_pie_glass",
          chartType: "echarts",
          category: "\u5360\u6BD4\u5206\u6790",
          renderMode: "dataset",
          description: "\u5E26\u9AD8\u5149\u8FB9\u7F18\u548C\u900F\u660E\u5C42\u6B21\u7684\u7CBE\u81F4\u73AF\u56FE\u6A21\u677F",
          tags: ["pie", "glass", "premium"],
          config: {
            chartFamily: "pie",
            variantName: "\u73BB\u7483\u8D28\u611F",
            palettePreset: "aqua",
            accentColor: "#36cfc9",
            nameField: "category",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { trigger: "item" },
            legend: { bottom: 0 },
            series: [{ type: "pie", radius: ["42%", "68%"], itemStyle: { borderColor: "#ffffff", borderWidth: 3 }, data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "nameField", label: "\u540D\u79F0\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u5357\u4E01\u683C\u5C14\u73AB\u7470\u56FE",
          chartCode: "builtin_rose_pie",
          chartType: "echarts",
          category: "\u5360\u6BD4\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u91CD\u70B9\u5206\u7C7B\u5F3A\u8C03\u7684\u73AB\u7470\u56FE\u6A21\u677F",
          tags: ["pie", "rose", "ratio"],
          config: {
            chartFamily: "pie",
            variantName: "\u73AB\u7470\u56FE",
            palettePreset: "rose",
            accentColor: "#ff5c8a",
            nameField: "category",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { trigger: "item" },
            legend: { bottom: 0 },
            series: [{ type: "pie", radius: [24, 110], roseType: "area", data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "nameField", label: "\u540D\u79F0\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u70ED\u529B\u56FE",
          chartCode: "builtin_heatmap_basic",
          chartType: "echarts",
          category: "\u5206\u5E03\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u4E8C\u7EF4\u5206\u5E03\u548C\u5F3A\u5EA6\u5206\u6790\u7684\u70ED\u529B\u56FE\u6A21\u677F",
          tags: ["heatmap", "matrix"],
          config: {
            xField: "x_name",
            yField: "y_name",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { position: "top" },
            grid: { height: "70%", top: "10%" },
            xAxis: { type: "category", data: [] },
            yAxis: { type: "category", data: [] },
            visualMap: { min: 0, max: 100, calculable: true, orient: "horizontal", left: "center", bottom: "4%" },
            series: [{ type: "heatmap", data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "X \u7EF4\u5EA6\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "yField", label: "Y \u7EF4\u5EA6\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u4E2D\u56FD\u5730\u56FE",
          chartCode: "builtin_china_map_basic",
          chartType: "echarts",
          category: "\u533A\u57DF\u5206\u6790",
          renderMode: "dataset",
          description: "\u652F\u6301\u5168\u56FD\u7701\u7EA7\u6309 6 \u4F4D\u884C\u653F\u533A\u5212\u7F16\u7801\u6E32\u67D3\u7684\u4E2D\u56FD\u5730\u56FE\u6A21\u677F",
          tags: ["map", "china", "adcode"],
          config: {
            mapField: "adcode",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { trigger: "item" },
            visualMap: { min: 0, max: 100, left: "left", top: "bottom", calculable: true },
            series: [{ type: "map", map: "china", roam: true, data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "mapField", label: "\u884C\u653F\u533A\u5212\u7F16\u7801\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u4E2D\u56FD\u5730\u56FE\xB7\u5546\u52A1\u84DD",
          chartCode: "builtin_china_map_business",
          chartType: "echarts",
          category: "\u533A\u57DF\u5206\u6790",
          renderMode: "dataset",
          description: "\u5546\u52A1\u9A7E\u9A76\u8231\u98CE\u683C\u7684\u4E2D\u56FD\u5730\u56FE\u6A21\u677F",
          tags: ["map", "china", "business", "adcode"],
          config: {
            chartFamily: "map",
            variantName: "\u5546\u52A1\u84DD",
            palettePreset: "business",
            accentColor: "#5b8ff9",
            mapField: "adcode",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { trigger: "item" },
            visualMap: { min: 0, max: 100, left: "left", top: "bottom", calculable: true, textStyle: { color: "#5d7092" } },
            series: [{ type: "map", map: "china", roam: true, itemStyle: { areaColor: "#eaf2ff", borderColor: "#8fb7ff" }, emphasis: { itemStyle: { areaColor: "#5b8ff9" } }, data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "mapField", label: "\u884C\u653F\u533A\u5212\u7F16\u7801\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u4E2D\u56FD\u5730\u56FE\xB7\u9713\u8679\u591C\u666F",
          chartCode: "builtin_china_map_neon",
          chartType: "echarts",
          category: "\u533A\u57DF\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u5927\u5C4F\u591C\u666F\u9A7E\u9A76\u8231\u7684\u9713\u8679\u4E2D\u56FD\u5730\u56FE\u6A21\u677F",
          tags: ["map", "china", "neon", "adcode"],
          config: {
            chartFamily: "map",
            variantName: "\u9713\u8679\u591C\u666F",
            palettePreset: "neon",
            accentColor: "#14f1ff",
            mapField: "adcode",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { trigger: "item" },
            visualMap: { min: 0, max: 100, left: "left", top: "bottom", calculable: true, textStyle: { color: "#d8fbff" } },
            series: [{ type: "map", map: "china", roam: true, itemStyle: { areaColor: "#102a43", borderColor: "#2fe3ff" }, emphasis: { itemStyle: { areaColor: "#1d4ed8" } }, data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "mapField", label: "\u884C\u653F\u533A\u5212\u7F16\u7801\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u4E2D\u56FD\u5730\u56FE\xB7\u6696\u91D1\u8FD0\u8425",
          chartCode: "builtin_china_map_gold",
          chartType: "echarts",
          category: "\u533A\u57DF\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u5546\u4E1A\u6C47\u62A5\u548C\u8FD0\u8425\u770B\u677F\u7684\u6696\u91D1\u4E2D\u56FD\u5730\u56FE\u6A21\u677F",
          tags: ["map", "china", "gold", "adcode"],
          config: {
            chartFamily: "map",
            variantName: "\u6696\u91D1\u8FD0\u8425",
            palettePreset: "gold",
            accentColor: "#d7a129",
            mapField: "adcode",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { trigger: "item" },
            visualMap: { min: 0, max: 100, left: "left", top: "bottom", calculable: true, textStyle: { color: "#7c5a10" } },
            series: [{ type: "map", map: "china", roam: true, itemStyle: { areaColor: "#fff8e1", borderColor: "#d4a72c" }, emphasis: { itemStyle: { areaColor: "#f6c453" } }, data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "mapField", label: "\u884C\u653F\u533A\u5212\u7F16\u7801\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u6811\u56FE",
          chartCode: "builtin_treemap_basic",
          chartType: "echarts",
          category: "\u5C42\u7EA7\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u591A\u5C42\u7EA7\u5360\u6BD4\u548C\u5206\u5C42\u89C4\u6A21\u5206\u6790\u7684\u6811\u56FE\u6A21\u677F",
          tags: ["treemap", "hierarchy"],
          config: {
            nameField: "category",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { formatter: "{b}: {c}" },
            series: [{ type: "treemap", roam: false, data: [] }]
          },
          mappingSchema: {
            fields: [
              { key: "nameField", label: "\u540D\u79F0\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6570\u503C\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u6851\u57FA\u56FE",
          chartCode: "builtin_sankey_basic",
          chartType: "echarts",
          category: "\u6D41\u5411\u5206\u6790",
          renderMode: "dataset",
          description: "\u9002\u5408\u6765\u6E90\u53BB\u5411\u548C\u6D41\u91CF\u8F6C\u79FB\u5206\u6790\u7684\u6851\u57FA\u56FE\u6A21\u677F",
          tags: ["sankey", "flow"],
          config: {
            sourceField: "source_name",
            targetField: "target_name",
            valueField: "value"
          },
          optionTemplate: {
            tooltip: { trigger: "item" },
            series: [{
              type: "sankey",
              left: 12,
              right: 12,
              top: 8,
              bottom: 8,
              nodeWidth: 16,
              nodeGap: 18,
              nodeAlign: "justify",
              draggable: false,
              emphasis: { focus: "adjacency" },
              lineStyle: { color: "gradient", opacity: 0.28, curveness: 0.5 },
              labelLayout: { hideOverlap: false },
              data: [],
              links: []
            }]
          },
          mappingSchema: {
            fields: [
              { key: "sourceField", label: "\u6765\u6E90\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "targetField", label: "\u53BB\u5411\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category"] },
              { key: "valueField", label: "\u6743\u91CD\u5B57\u6BB5", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u67F1\u7EBF\u7EC4\u5408\u56FE",
          chartCode: "builtin_combo_bar_line",
          chartType: "echarts",
          category: "\u7EC4\u5408\u56FE",
          renderMode: "dataset",
          description: "\u9002\u5408\u6570\u91CF\u4E0E\u8D8B\u52BF\u540C\u5C4F\u5C55\u793A\u7684\u67F1\u7EBF\u7EC4\u5408\u56FE\u6A21\u677F",
          tags: ["combo", "bar", "line"],
          config: {
            chartFamily: "combo",
            variantName: "\u67F1\u7EBF\u7EC4\u5408",
            palettePreset: "business",
            accentColor: "#1677ff",
            xField: "category",
            barField: "value",
            lineField: "line_value"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            legend: {},
            xAxis: { type: "category", data: [] },
            yAxis: [{ type: "value" }, { type: "value" }],
            series: []
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "\u5206\u7C7B\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "barField", label: "\u67F1\u56FE\u6307\u6807", required: true, acceptRoles: ["metric", "value"] },
              { key: "lineField", label: "\u6298\u7EBF\u6307\u6807", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u53CC\u8F74\u67F1\u7EBF\u56FE",
          chartCode: "builtin_combo_dual_axis",
          chartType: "echarts",
          category: "\u7EC4\u5408\u56FE",
          renderMode: "dataset",
          description: "\u9002\u5408\u4E24\u4E2A\u91CF\u7EB2\u5DEE\u5F02\u8F83\u5927\u6307\u6807\u7684\u53CC\u8F74\u67F1\u7EBF\u7EC4\u5408\u56FE",
          tags: ["combo", "dual-axis", "line"],
          config: {
            chartFamily: "combo",
            variantName: "\u53CC\u8F74\u67F1\u7EBF",
            palettePreset: "neon",
            accentColor: "#5f63ff",
            xField: "category",
            barField: "value",
            lineField: "line_value"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            legend: {},
            xAxis: { type: "category", data: [] },
            yAxis: [{ type: "value" }, { type: "value" }],
            series: []
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "\u5206\u7C7B\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "barField", label: "\u67F1\u56FE\u6307\u6807", required: true, acceptRoles: ["metric", "value"] },
              { key: "lineField", label: "\u6298\u7EBF\u6307\u6807", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        },
        {
          chartName: "\u67F1\u9762\u7EC4\u5408\u56FE",
          chartCode: "builtin_combo_bar_area",
          chartType: "echarts",
          category: "\u7EC4\u5408\u56FE",
          renderMode: "dataset",
          description: "\u9002\u5408\u4F53\u91CF\u548C\u8D8B\u52BF\u9762\u79EF\u540C\u5C4F\u5C55\u793A\u7684\u67F1\u9762\u7EC4\u5408\u56FE",
          tags: ["combo", "bar", "area"],
          config: {
            chartFamily: "combo",
            variantName: "\u67F1\u9762\u7EC4\u5408",
            palettePreset: "sunset",
            accentColor: "#ff7a45",
            xField: "category",
            barField: "value",
            lineField: "line_value"
          },
          optionTemplate: {
            tooltip: { trigger: "axis" },
            legend: {},
            xAxis: { type: "category", data: [] },
            yAxis: [{ type: "value" }, { type: "value" }],
            series: []
          },
          mappingSchema: {
            fields: [
              { key: "xField", label: "\u5206\u7C7B\u5B57\u6BB5", required: true, acceptRoles: ["dimension", "category", "time"] },
              { key: "barField", label: "\u67F1\u56FE\u6307\u6807", required: true, acceptRoles: ["metric", "value"] },
              { key: "lineField", label: "\u9762\u79EF\u6307\u6807", required: true, acceptRoles: ["metric", "value"] }
            ]
          },
          ownerName: "System Administrator",
          status: "active",
          isBuiltin: true
        }
      ].map((asset) => {
        const nextConfig = asset.config && typeof asset.config === "object" ? { ...asset.config } : {};
        if (!nextConfig.chartFamily) {
          nextConfig.chartFamily = normalizeChartFamily(asset.chartCode || asset.chartName || asset.category);
        }
        if (!nextConfig.variantName) {
          nextConfig.variantName = asset.chartName;
        }
        return {
          ...asset,
          config: nextConfig
        };
      });
    }
    function buildChartOption(asset, rows = [], fieldMap = {}, styleOverrides = {}) {
      const optionTemplate = asset.optionTemplate || {};
      const config = { ...asset.config || {}, ...styleOverrides || {} };
      const hasStyleOverride = Boolean(styleOverrides.palettePreset || styleOverrides.accentColor);
      const provinceNameMap = {
        "11": "\u5317\u4EAC",
        "12": "\u5929\u6D25",
        "13": "\u6CB3\u5317",
        "14": "\u5C71\u897F",
        "15": "\u5185\u8499\u53E4",
        "21": "\u8FBD\u5B81",
        "22": "\u5409\u6797",
        "23": "\u9ED1\u9F99\u6C5F",
        "31": "\u4E0A\u6D77",
        "32": "\u6C5F\u82CF",
        "33": "\u6D59\u6C5F",
        "34": "\u5B89\u5FBD",
        "35": "\u798F\u5EFA",
        "36": "\u6C5F\u897F",
        "37": "\u5C71\u4E1C",
        "41": "\u6CB3\u5357",
        "42": "\u6E56\u5317",
        "43": "\u6E56\u5357",
        "44": "\u5E7F\u4E1C",
        "45": "\u5E7F\u897F",
        "46": "\u6D77\u5357",
        "50": "\u91CD\u5E86",
        "51": "\u56DB\u5DDD",
        "52": "\u8D35\u5DDE",
        "53": "\u4E91\u5357",
        "54": "\u897F\u85CF",
        "61": "\u9655\u897F",
        "62": "\u7518\u8083",
        "63": "\u9752\u6D77",
        "64": "\u5B81\u590F",
        "65": "\u65B0\u7586",
        "71": "\u53F0\u6E7E",
        "81": "\u9999\u6E2F",
        "82": "\u6FB3\u95E8"
      };
      const paletteMap = {
        ocean: ["#1677ff", "#69b1ff", "#91caff", "#bae0ff"],
        business: ["#5b8ff9", "#5d7092", "#61d9a5", "#65789b"],
        neon: ["#14f1ff", "#267dff", "#7c5cff", "#ff7ad9"],
        gold: ["#d7a129", "#f9e08b", "#c28a14", "#8c6a0a"],
        fresh: ["#52c41a", "#8ce99a", "#34a853", "#d9f7be"],
        sunset: ["#ff7a45", "#ffbb7a", "#ff9c6e", "#ffd8bf"],
        rainbow: ["#7c5cff", "#ff7ad9", "#36cfc9", "#fadb14"],
        rose: ["#ff5c8a", "#ffa0c4", "#d6336c", "#ffd6e7"],
        aqua: ["#36cfc9", "#5eead4", "#08979c", "#ccfbf1"],
        pastel: ["#84cc16", "#c4b5fd", "#f9a8d4", "#93c5fd"],
        skyline: ["#4f8cff", "#83b7ff", "#3867ff", "#c7d8ff"],
        tech: ["#5f63ff", "#8a8dff", "#2b2fbb", "#c7c9ff"],
        mint: ["#36cfc9", "#8ce3dd", "#13c2c2", "#d2f5f3"]
      };
      function getPaletteColors() {
        if (Array.isArray(config.palette) && config.palette.length) {
          return config.palette;
        }
        return paletteMap[config.palettePreset] || paletteMap.ocean;
      }
      function getAccentColor(fallback = "#1677ff") {
        return config.accentColor || config.color || fallback;
      }
      function buildBarSeriesOption({
        xField,
        yField,
        yField2,
        color,
        colorStart,
        colorEnd,
        borderRadius,
        shadowBlur,
        shadowColor,
        barWidth,
        topColor,
        chartCode
      }) {
        const paletteColors = getPaletteColors();
        const accentColor = getAccentColor("#1677ff");
        const secondaryColor = config.barSecondaryColor || paletteColors[1] || "#55c6a9";
        const resolvedTopColor = topColor || config.barTopColor || paletteColors[2] || "#a8c6ff";
        const gradientStart = hasStyleOverride ? paletteColors[1] || accentColor : colorStart;
        const gradientEnd = hasStyleOverride ? accentColor : colorEnd;
        const resolvedColor = colorStart && colorEnd ? {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: gradientStart },
            { offset: 1, color: gradientEnd }
          ]
        } : color || accentColor;
        const resolvedShadowColor = shadowColor || `${paletteColors[1] || accentColor}66`;
        const baseSeries = Array.isArray(optionTemplate.series) ? optionTemplate.series[0] || {} : {};
        const baseItemStyle = baseSeries.itemStyle || {};
        const categories = rows.map((row) => row[xField]);
        const primaryValues = rows.map((row) => Number(row[yField] || 0));
        const secondaryValues = yField2 ? rows.map((row) => Number(row[yField2] || 0)) : [];
        const buildBarSeries = (name, data, colorValue, index = 0) => ({
          ...baseSeries,
          type: "bar",
          name,
          data,
          stack: config.barSeriesLayout === "stacked" ? "total" : void 0,
          barGap: config.barSeriesLayout === "overlap" ? "-35%" : config.barGap || "30%",
          barCategoryGap: config.barCategoryGap || "40%",
          barWidth: barWidth || config.barWidth || baseSeries.barWidth,
          z: config.barSeriesLayout === "overlap" ? 10 - index : baseSeries.z,
          itemStyle: {
            ...baseItemStyle,
            color: colorValue,
            borderRadius: borderRadius ?? config.barBorderRadius ?? baseItemStyle.borderRadius,
            shadowBlur: shadowBlur ?? baseItemStyle.shadowBlur,
            shadowColor: resolvedShadowColor ?? baseItemStyle.shadowColor
          },
          label: {
            ...baseSeries.label || {},
            position: config.barValuePosition === "inside" ? "inside" : "top"
          }
        });
        const series = [buildBarSeries(yField, primaryValues, resolvedColor, 0)];
        if (yField2 && config.barSeriesLayout !== "single") {
          series.push(buildBarSeries(yField2, secondaryValues, secondaryColor, 1));
        }
        if (chartCode === "builtin_bar_3d_like" && !yField2 && config.barSeriesLayout === "single") {
          const topSeries = (values, index = 0) => ({
            type: "pictorialBar",
            symbol: "diamond",
            symbolSize: [barWidth || config.barWidth || 28, 12],
            symbolOffset: [0, -6],
            symbolPosition: "end",
            z: config.barSeriesLayout === "overlap" ? 20 - index : 12,
            data: values,
            itemStyle: { color: resolvedTopColor },
            barGap: config.barSeriesLayout === "overlap" ? "-35%" : config.barGap || "30%",
            barCategoryGap: config.barCategoryGap || "40%"
          });
          series.push(topSeries(primaryValues, 0));
          if (yField2 && config.barSeriesLayout !== "single") {
            series.push(topSeries(secondaryValues, 1));
          }
        }
        return {
          ...optionTemplate,
          legend: yField2 && config.barSeriesLayout !== "single" ? { ...optionTemplate.legend || {}, data: [yField, yField2] } : optionTemplate.legend,
          xAxis: { ...optionTemplate.xAxis || {}, data: categories },
          series
        };
      }
      function buildLineSeriesOption({
        xField,
        yField,
        color,
        colorStart,
        colorEnd,
        step,
        smooth,
        areaOpacity
      }) {
        const baseSeries = Array.isArray(optionTemplate.series) ? optionTemplate.series[0] || {} : {};
        const paletteColors = getPaletteColors();
        const resolvedColor = color || colorEnd || colorStart || getAccentColor(paletteColors[0] || "#13c2c2");
        const gradientStart = hasStyleOverride ? paletteColors[1] || resolvedColor : colorStart;
        const gradientEnd = hasStyleOverride ? resolvedColor : colorEnd;
        const resolvedAreaColor = colorStart && colorEnd ? {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: gradientStart },
            { offset: 1, color: gradientEnd }
          ]
        } : {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: `${resolvedColor}cc` },
            { offset: 1, color: `${paletteColors[1] || resolvedColor}22` }
          ]
        };
        return {
          ...optionTemplate,
          xAxis: { ...optionTemplate.xAxis || {}, data: rows.map((row) => row[xField]) },
          series: [
            {
              ...baseSeries,
              type: "line",
              smooth: smooth ?? baseSeries.smooth ?? true,
              step: step ?? baseSeries.step,
              data: rows.map((row) => Number(row[yField] || 0)),
              itemStyle: { ...baseSeries.itemStyle || {}, color: resolvedColor },
              lineStyle: { ...baseSeries.lineStyle || {}, color: resolvedColor, width: baseSeries.lineStyle?.width || 3 },
              areaStyle: {
                ...baseSeries.areaStyle || {},
                opacity: areaOpacity ?? baseSeries.areaStyle?.opacity,
                color: resolvedAreaColor,
                shadowBlur: asset.chartCode === "builtin_line_glow" ? 18 : baseSeries.areaStyle?.shadowBlur,
                shadowColor: asset.chartCode === "builtin_line_glow" ? `${resolvedColor}99` : baseSeries.areaStyle?.shadowColor
              }
            }
          ]
        };
      }
      function buildPieSeriesOption({ nameField, valueField, radius, center }) {
        const baseSeries = Array.isArray(optionTemplate.series) ? optionTemplate.series[0] || {} : {};
        const paletteColors = getPaletteColors();
        return {
          ...optionTemplate,
          color: paletteColors,
          series: [
            {
              ...baseSeries,
              type: "pie",
              radius: radius || baseSeries.radius,
              center: center || baseSeries.center,
              data: rows.map((row) => ({
                name: row[nameField],
                value: Number(row[valueField] || 0)
              }))
            }
          ]
        };
      }
      function buildStackedAreaOption({ xField, yField, seriesField, opacity = 0.18 }) {
        const categories = Array.from(new Set(rows.map((row) => row[xField])));
        const seriesNames = Array.from(new Set(rows.map((row) => row[seriesField])));
        const paletteColors = getPaletteColors();
        return {
          ...optionTemplate,
          color: paletteColors,
          legend: { ...optionTemplate.legend || {}, data: seriesNames },
          xAxis: { ...optionTemplate.xAxis || {}, data: categories },
          series: seriesNames.map((name, index) => ({
            type: "line",
            stack: "total",
            smooth: true,
            areaStyle: { opacity, color: paletteColors[index % paletteColors.length] },
            name,
            data: categories.map((category) => {
              const target = rows.find((row) => row[xField] === category && row[seriesField] === name);
              return target ? Number(target[yField] || 0) : 0;
            })
          }))
        };
      }
      if (asset.chartCode === "builtin_bar_basic") {
        const xField = fieldMap.xField || config.xField;
        const yField = fieldMap.yField || config.yField;
        const yField2 = fieldMap.yField2 || config.yField2;
        const paletteColors = getPaletteColors();
        const accentColor = config.barPrimaryColor || getAccentColor(paletteColors[0] || "#1677ff");
        const secondaryColor = config.barSecondaryColor || paletteColors[1] || "#55c6a9";
        const categories = rows.map((row) => row[xField]);
        const firstSeries = {
          ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
          type: "bar",
          name: yField,
          data: rows.map((row) => Number(row[yField] || 0)),
          itemStyle: {
            color: accentColor,
            borderRadius: [6, 6, 0, 0]
          }
        };
        if (yField2) {
          return withCompactGrid({
            ...optionTemplate,
            legend: { ...optionTemplate.legend || {}, data: [yField, yField2] },
            xAxis: { ...optionTemplate.xAxis || {}, data: categories },
            series: [
              {
                ...firstSeries,
                stack: config.barSeriesLayout === "stacked" ? "total" : void 0,
                barGap: config.barGap || (config.barSeriesLayout === "overlap" ? "-35%" : "30%"),
                barCategoryGap: config.barCategoryGap || "40%",
                barWidth: config.barWidth || 28
              },
              {
                ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
                type: "bar",
                name: yField2,
                data: rows.map((row) => Number(row[yField2] || 0)),
                stack: config.barSeriesLayout === "stacked" ? "total" : void 0,
                barGap: config.barGap || (config.barSeriesLayout === "overlap" ? "-35%" : "30%"),
                barCategoryGap: config.barCategoryGap || "40%",
                barWidth: config.barWidth || 28,
                itemStyle: {
                  color: secondaryColor,
                  borderRadius: [6, 6, 0, 0]
                }
              }
            ]
          }, { top: 16, bottom: 10, left: 10, right: 10 });
        }
        return withCompactGrid({
          ...optionTemplate,
          xAxis: { ...optionTemplate.xAxis || {}, data: categories },
          series: [firstSeries]
        }, { top: 16, bottom: 10, left: 10, right: 10 });
      }
      if (asset.chartCode === "builtin_line_basic") {
        const xField = fieldMap.xField || config.xField;
        const yField = fieldMap.yField || config.yField;
        const accentColor = getAccentColor("#13c2c2");
        return withCompactGrid({
          ...optionTemplate,
          xAxis: { ...optionTemplate.xAxis || {}, data: rows.map((row) => row[xField]) },
          series: [
            {
              ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
              type: "line",
              smooth: config.smooth !== false,
              data: rows.map((row) => row[yField]),
              itemStyle: { color: accentColor },
              lineStyle: { color: accentColor },
              areaStyle: { opacity: 0.12, color: accentColor }
            }
          ]
        }, { top: 16, bottom: 10, left: 10, right: 10 });
      }
      if (asset.chartCode === "builtin_bar_stacked") {
        const xField = fieldMap.xField || config.xField;
        const yField = fieldMap.yField || config.yField;
        const seriesField = fieldMap.seriesField || config.seriesField;
        const categories = Array.from(new Set(rows.map((row) => row[xField])));
        const seriesNames = seriesField ? Array.from(new Set(rows.map((row) => row[seriesField]))) : ["\u503C"];
        return {
          ...optionTemplate,
          legend: { ...optionTemplate.legend || {}, data: seriesNames },
          xAxis: { ...optionTemplate.xAxis || {}, data: categories },
          series: seriesNames.map((name) => ({
            type: "bar",
            stack: "total",
            name,
            data: categories.map((category) => {
              const target = rows.find((row) => row[xField] === category && (!seriesField || row[seriesField] === name));
              return target ? Number(target[yField] || 0) : 0;
            })
          }))
        };
      }
      if (asset.chartCode === "builtin_bar_gradient_neon" || asset.chartCode === "builtin_bar_metal" || asset.chartCode === "builtin_bar_capsule" || asset.chartCode === "builtin_bar_shadow_volume" || asset.chartCode === "builtin_bar_3d_like") {
        const xField = fieldMap.xField || config.xField;
        const yField = fieldMap.yField || config.yField;
        const yField2 = fieldMap.yField2 || config.yField2;
        return buildBarSeriesOption({
          xField,
          yField,
          yField2,
          color: config.color,
          colorStart: config.colorStart,
          colorEnd: config.colorEnd,
          borderRadius: Array.isArray(optionTemplate.series?.[0]?.itemStyle?.borderRadius) ? optionTemplate.series[0].itemStyle.borderRadius : optionTemplate.series?.[0]?.itemStyle?.borderRadius,
          shadowBlur: optionTemplate.series?.[0]?.itemStyle?.shadowBlur,
          shadowColor: optionTemplate.series?.[0]?.itemStyle?.shadowColor,
          barWidth: optionTemplate.series?.[0]?.barWidth,
          topColor: config.barTopColor,
          chartCode: asset.chartCode
        });
      }
      if (asset.chartCode === "builtin_area_basic") {
        const xField = fieldMap.xField || config.xField;
        const yField = fieldMap.yField || config.yField;
        const accentColor = getAccentColor("#52c41a");
        return {
          ...optionTemplate,
          xAxis: { ...optionTemplate.xAxis || {}, data: rows.map((row) => row[xField]) },
          series: [
            {
              ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
              type: "line",
              smooth: true,
              data: rows.map((row) => row[yField]),
              itemStyle: { color: accentColor },
              lineStyle: { color: accentColor },
              areaStyle: { opacity: 0.24, color: accentColor }
            }
          ]
        };
      }
      if (asset.chartCode === "builtin_pie_basic") {
        const nameField = fieldMap.nameField || config.nameField;
        const valueField = fieldMap.valueField || config.valueField;
        return buildPieSeriesOption({ nameField, valueField, radius: ["52%", "82%"], center: ["50%", "48%"] });
      }
      if (asset.chartCode === "builtin_scatter_basic") {
        const xField = fieldMap.xField || config.xField;
        const yField = fieldMap.yField || config.yField;
        return {
          ...optionTemplate,
          series: [
            {
              ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
              type: "scatter",
              data: rows.map((row) => [Number(row[xField] || 0), Number(row[yField] || 0)])
            }
          ]
        };
      }
      if (asset.chartCode === "builtin_china_map_basic" || asset.chartCode === "builtin_china_map_business" || asset.chartCode === "builtin_china_map_neon" || asset.chartCode === "builtin_china_map_gold") {
        const mapField = fieldMap.mapField || config.mapField;
        const valueField = fieldMap.valueField || config.valueField;
        const provinceCode = String(styleOverrides.provinceCode || config.provinceCode || "").trim();
        const mapScope = provinceCode && provinceCode.length === 6 ? provinceCode : "china";
        const mapLabelShow = asset.chartCode !== "builtin_china_map_neon";
        const aggregated = /* @__PURE__ */ new Map();
        rows.forEach((row) => {
          const rawCode = String(row?.[mapField] ?? "").trim();
          const nextValue = Number(row?.[valueField] ?? 0);
          if (!rawCode || !Number.isFinite(nextValue)) {
            return;
          }
          aggregated.set(rawCode, Number((aggregated.get(rawCode) || 0) + nextValue));
        });
        const data = Array.from(aggregated.entries()).map(([rawCode, value]) => {
          const provincePrefix = String(rawCode).length >= 2 ? String(rawCode).slice(0, 2) : String(rawCode);
          return {
            adcode: String(rawCode),
            name: provinceNameMap[provincePrefix] || String(rawCode),
            value
          };
        });
        const values = data.map((item) => Number(item.value || 0)).filter((item) => Number.isFinite(item));
        const min = values.length ? Math.min(...values) : 0;
        const max = values.length ? Math.max(...values) : 100;
        const inRangeColor = getMapRegionPalette({
          accentColor: styleOverrides.accentColor,
          mapRegionPalette: Array.isArray(styleOverrides.mapRegionPalette) ? styleOverrides.mapRegionPalette : []
        });
        return {
          ...optionTemplate,
          visualMap: {
            ...optionTemplate.visualMap || {},
            min,
            max: max <= min ? min + 1 : max,
            calculable: true,
            inRange: { color: inRangeColor },
            textStyle: {
              ...(optionTemplate.visualMap || {}).textStyle || {},
              color: styleOverrides.mapVisualMapTextColor || ((optionTemplate.visualMap || {}).textStyle || {}).color
            }
          },
          series: [
            {
              ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
              type: "map",
              map: mapScope,
              itemStyle: {
                ...((Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}) || {}).itemStyle || {},
                borderColor: styleOverrides.mapRegionBorderColor || (((Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {}) || {}).itemStyle || {}).borderColor
              },
              label: {
                show: true,
                color: styleOverrides.mapLabelColor || (asset.chartCode === "builtin_china_map_neon" ? "#d8fbff" : "#425466"),
                formatter: (params) => {
                  if (styleOverrides.showDataLabels) return params.value ?? "";
                  if (styleOverrides.showLabels !== false && mapLabelShow) return params.name || "";
                  return "";
                }
              },
              data
            }
          ]
        };
      }
      if (asset.chartCode === "builtin_radar_basic") {
        const nameField = fieldMap.nameField || config.nameField;
        const valueField = fieldMap.valueField || config.valueField;
        const valueField2 = fieldMap.valueField2 || fieldMap.yField2 || config.valueField2;
        const radarLayout = styleOverrides.radarLayout || config.radarLayout || "single";
        const paletteColors = getPaletteColors();
        const primaryColor = styleOverrides.radarPrimaryColor || styleOverrides.radarPointColor || paletteColors[0] || getAccentColor("#1677ff");
        const secondaryColor = styleOverrides.radarSecondaryColor || paletteColors[1] || "#4f8cff";
        const primaryValues = rows.map((row) => Number(row[valueField] || 0));
        const secondaryValues = valueField2 ? rows.map((row) => Number(row[valueField2] || 0)) : [];
        const maxValue = Math.max(...primaryValues, ...secondaryValues, 1);
        const data = [
          {
            value: primaryValues,
            name: styleOverrides.legendPrimaryName || valueField || "\u6307\u6807\u4E00",
            itemStyle: { color: primaryColor, borderColor: primaryColor },
            areaStyle: { color: primaryColor, opacity: Number(styleOverrides.radarAreaOpacity ?? 0.22) }
          }
        ];
        if (radarLayout === "dual" && valueField2) {
          data.push({
            value: secondaryValues,
            name: styleOverrides.legendSecondaryName || valueField2 || "\u6307\u6807\u4E8C",
            itemStyle: { color: secondaryColor, borderColor: secondaryColor },
            areaStyle: { color: secondaryColor, opacity: Number(styleOverrides.radarAreaOpacity ?? 0.16) }
          });
        }
        return {
          ...optionTemplate,
          color: data.map((item) => item.itemStyle.color),
          legend: data.length > 1 ? { ...optionTemplate.legend || {}, data: data.map((item) => item.name) } : optionTemplate.legend,
          radar: {
            ...optionTemplate.radar || {},
            center: ["50%", "52%"],
            radius: "70%",
            indicator: rows.map((row) => ({ name: String(row[nameField]), max: maxValue }))
          },
          series: [
            {
              ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
              type: "radar",
              data
            }
          ]
        };
      }
      if (asset.chartCode === "builtin_funnel_basic") {
        const nameField = fieldMap.nameField || config.nameField;
        const valueField = fieldMap.valueField || config.valueField;
        return {
          ...optionTemplate,
          series: [
            {
              ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
              type: "funnel",
              data: rows.map((row) => ({ name: row[nameField], value: Number(row[valueField] || 0) }))
            }
          ]
        };
      }
      if (asset.chartCode === "builtin_wordcloud_basic") {
        const nameField = fieldMap.nameField || config.nameField;
        const valueField = fieldMap.valueField || config.valueField;
        return {
          ...optionTemplate,
          series: [
            {
              ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
              type: "wordCloud",
              data: rows.map((row) => ({
                name: String(row[nameField] || ""),
                value: Number(row[valueField] || 0)
              })).filter((item) => item.name)
            }
          ]
        };
      }
      if (asset.chartCode === "builtin_gauge_basic") {
        const valueField = fieldMap.valueField || config.valueField;
        const value = Number(rows?.[0]?.[valueField] || 0);
        return {
          ...optionTemplate,
          series: [
            {
              ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
              type: "gauge",
              data: [{ value, name: "\u6307\u6807" }]
            }
          ]
        };
      }
      if (asset.chartCode === "builtin_bar_horizontal") {
        const xField = fieldMap.xField || config.xField;
        const yField = fieldMap.yField || config.yField;
        const paletteColors = Array.isArray(config.horizontalBarPalette) && config.horizontalBarPalette.length ? config.horizontalBarPalette : [
          config.barPrimaryColor || getAccentColor("#5b8ff9"),
          config.barSecondaryColor || "#55c6a9",
          "#f4b95d",
          "#8f7cff",
          "#f28f8f"
        ];
        const colorCount = Math.max(1, Math.min(5, Number(config.horizontalBarColorCount || 1)));
        const rowsWithValue = rows.map((row) => ({
          category: String(row[yField] || ""),
          value: Number(row[xField] || 0)
        }));
        if (config.horizontalBarSortOrder === "desc-top") {
          rowsWithValue.sort((a, b) => b.value - a.value);
        } else if (config.horizontalBarSortOrder === "desc-bottom") {
          rowsWithValue.sort((a, b) => a.value - b.value);
        }
        return {
          ...optionTemplate,
          yAxis: { ...optionTemplate.yAxis || {}, inverse: true, data: rowsWithValue.map((row) => row.category) },
          series: [
            {
              ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
              type: "bar",
              data: rowsWithValue.map((row, index) => ({
                value: row.value,
                itemStyle: {
                  color: paletteColors[index % colorCount],
                  borderRadius: [0, 10, 10, 0]
                },
                label: {
                  show: config.showLabels !== false,
                  position: config.barValuePosition === "inside" ? "inside" : "right"
                }
              }))
            }
          ]
        };
      }
      if (asset.chartCode === "builtin_area_stacked") {
        const xField = fieldMap.xField || config.xField;
        const yField = fieldMap.yField || config.yField;
        const seriesField = fieldMap.seriesField || config.seriesField;
        return buildStackedAreaOption({ xField, yField, seriesField, opacity: 0.18 });
      }
      if (asset.chartCode === "builtin_area_soft_stack") {
        const xField = fieldMap.xField || config.xField;
        const yField = fieldMap.yField || config.yField;
        const seriesField = fieldMap.seriesField || config.seriesField;
        return buildStackedAreaOption({ xField, yField, seriesField, opacity: 0.3 });
      }
      if (asset.chartCode === "builtin_rose_pie") {
        const nameField = fieldMap.nameField || config.nameField;
        const valueField = fieldMap.valueField || config.valueField;
        return buildPieSeriesOption({ nameField, valueField });
      }
      if (asset.chartCode === "builtin_pie_multi_ring" || asset.chartCode === "builtin_pie_half_ring" || asset.chartCode === "builtin_pie_glass") {
        const nameField = fieldMap.nameField || config.nameField;
        const valueField = fieldMap.valueField || config.valueField;
        return buildPieSeriesOption({ nameField, valueField });
      }
      if (asset.chartCode === "builtin_heatmap_basic") {
        const xField = fieldMap.xField || config.xField;
        const yField = fieldMap.yField || config.yField;
        const valueField = fieldMap.valueField || config.valueField;
        const xNames = Array.from(new Set(rows.map((row) => row[xField])));
        const yNames = Array.from(new Set(rows.map((row) => row[yField])));
        const maxValue = Math.max(...rows.map((row) => Number(row[valueField] || 0)), 1);
        return {
          ...optionTemplate,
          xAxis: { ...optionTemplate.xAxis || {}, data: xNames },
          yAxis: { ...optionTemplate.yAxis || {}, data: yNames },
          visualMap: { ...optionTemplate.visualMap || {}, max: maxValue },
          series: [
            {
              ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
              type: "heatmap",
              data: rows.map((row) => [xNames.indexOf(row[xField]), yNames.indexOf(row[yField]), Number(row[valueField] || 0)])
            }
          ]
        };
      }
      if (asset.chartCode === "builtin_treemap_basic") {
        const nameField = fieldMap.nameField || config.nameField;
        const valueField = fieldMap.valueField || config.valueField;
        return {
          ...optionTemplate,
          series: [
            {
              ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
              type: "treemap",
              data: rows.map((row) => ({
                name: String(row[nameField]),
                value: Number(row[valueField] || 0)
              }))
            }
          ]
        };
      }
      if (asset.chartCode === "builtin_sankey_basic") {
        const sourceField = fieldMap.sourceField || config.sourceField;
        const targetField = fieldMap.targetField || config.targetField;
        const valueField = fieldMap.valueField || config.valueField;
        if (!sourceField || !targetField || !valueField) {
          return buildSankeyEmptyOption(optionTemplate);
        }
        const links = rows.map((row) => ({
          source: normalizeText(row[sourceField]),
          target: normalizeText(row[targetField]),
          value: Number(row[valueField] || 0)
        })).filter((item) => item.source && item.target && item.source !== item.target && Number.isFinite(item.value) && item.value > 0);
        if (!links.length) {
          return buildSankeyEmptyOption(optionTemplate);
        }
        if (hasSankeyCycle(links)) {
          return buildSankeyEmptyOption(optionTemplate, "\u5F53\u524D\u6570\u636E\u5B58\u5728\u73AF\u8DEF\uFF0C\u65E0\u6CD5\u751F\u6210\u6851\u57FA\u56FE");
        }
        const nodeNames = Array.from(new Set(links.flatMap((link) => [link.source, link.target])));
        return {
          ...optionTemplate,
          series: [
            {
              ...Array.isArray(optionTemplate.series) ? optionTemplate.series[0] : {},
              type: "sankey",
              data: nodeNames.map((name) => ({ name })),
              links
            }
          ]
        };
      }
      if (asset.chartCode === "builtin_line_glow" || asset.chartCode === "builtin_line_dual_gradient" || asset.chartCode === "builtin_line_step" || asset.chartCode === "builtin_line_slim") {
        const xField = fieldMap.xField || config.xField;
        const yField = fieldMap.yField || config.yField;
        return buildLineSeriesOption({
          xField,
          yField,
          color: config.color || config.accentColor,
          colorStart: config.colorStart,
          colorEnd: config.colorEnd,
          step: optionTemplate.series?.[0]?.step,
          smooth: optionTemplate.series?.[0]?.smooth ?? config.smooth,
          areaOpacity: optionTemplate.series?.[0]?.areaStyle?.opacity ?? (asset.chartCode === "builtin_line_dual_gradient" ? 0.24 : 0.12)
        });
      }
      if (asset.chartCode === "builtin_combo_bar_line" || asset.chartCode === "builtin_combo_dual_axis" || asset.chartCode === "builtin_combo_bar_area") {
        const xField = fieldMap.xField || config.xField;
        const barField = fieldMap.barField || config.barField;
        const lineField = fieldMap.lineField || config.lineField;
        const isArea = asset.chartCode === "builtin_combo_bar_area";
        const paletteColors = getPaletteColors();
        const barColor = getAccentColor("#1677ff");
        const lineColor = paletteColors[1] || (asset.chartCode === "builtin_combo_dual_axis" ? "#7c5cff" : "#fa8c16");
        return {
          ...optionTemplate,
          color: paletteColors,
          legend: { ...optionTemplate.legend || {}, data: ["\u67F1\u56FE", isArea ? "\u9762\u79EF" : "\u6298\u7EBF"] },
          xAxis: { ...optionTemplate.xAxis || {}, data: rows.map((row) => row[xField]) },
          series: [
            {
              type: "bar",
              name: "\u67F1\u56FE",
              data: rows.map((row) => Number(row[barField] || 0)),
              itemStyle: { color: barColor, borderRadius: [10, 10, 0, 0] }
            },
            {
              type: "line",
              name: isArea ? "\u9762\u79EF" : "\u6298\u7EBF",
              yAxisIndex: 1,
              smooth: true,
              data: rows.map((row) => Number(row[lineField] || 0)),
              itemStyle: { color: lineColor },
              lineStyle: { color: lineColor, width: 3 },
              areaStyle: isArea ? { opacity: 0.18, color: lineColor } : void 0
            }
          ]
        };
      }
      return optionTemplate;
    }
    function normalizeReportDataSourcePayload(payload, existingRecord = null) {
      return {
        sourceName: normalizeText(payload.sourceName),
        sourceCode: normalizeText(payload.sourceCode),
        sourceType: normalizeText(payload.sourceType).toLowerCase(),
        connectionConfig: payload.connectionConfig || {},
        ownerName: normalizeText(payload.ownerName, existingRecord?.ownerName || "system"),
        status: String(payload.status || existingRecord?.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active"
      };
    }
    function normalizeDatasetPayload(payload, fields = [], existingRecord = null) {
      const datasetType = String(payload.datasetType || existingRecord?.datasetType || "table").trim().toLowerCase();
      return {
        datasetName: normalizeText(payload.datasetName),
        datasetCode: normalizeText(existingRecord?.datasetCode || payload.datasetCode || ""),
        sourceId: Number(payload.sourceId),
        folderId: payload.folderId === void 0 ? existingRecord?.folderId ?? null : payload.folderId === null || payload.folderId === "" ? null : Number(payload.folderId),
        datasetType,
        sourceTable: datasetType === "table" ? normalizeText(payload.sourceTable) : null,
        sourceSql: datasetType === "sql" ? sanitizeSqlText(payload.sourceSql) : null,
        fields,
        queryConfig: payload.queryConfig || {},
        cacheConfig: payload.cacheConfig || {},
        ownerName: normalizeText(payload.ownerName, existingRecord?.ownerName || "system"),
        status: String(payload.status || existingRecord?.status || "draft").trim().toLowerCase(),
        description: normalizeText(payload.description, "") || null
      };
    }
    function buildInternalDatasetCode() {
      const timestampPart = Date.now().toString(36);
      const randomPart = Math.random().toString(36).slice(2, 8);
      return `rpt_ds_${timestampPart}_${randomPart}`;
    }
    function assignInternalDatasetCode(normalized) {
      return {
        ...normalized,
        datasetCode: buildInternalDatasetCode()
      };
    }
    function normalizeDatasetFolderPayload(payload, existingRecord = null) {
      return {
        folderName: normalizeText(payload.folderName, existingRecord?.folderName || ""),
        parentId: payload.parentId === void 0 ? existingRecord?.parentId ?? null : payload.parentId === null || payload.parentId === "" ? null : Number(payload.parentId)
      };
    }
    function normalizeChartAssetPayload(payload, existingRecord = null) {
      return {
        chartName: normalizeText(payload.chartName),
        chartCode: normalizeText(payload.chartCode),
        chartType: normalizeText(payload.chartType || existingRecord?.chartType || "echarts"),
        category: normalizeText(payload.category, existingRecord?.category || "custom"),
        renderMode: normalizeText(payload.renderMode, existingRecord?.renderMode || "dataset"),
        coverImageUrl: normalizeText(payload.coverImageUrl, "") || null,
        description: normalizeText(payload.description, "") || null,
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        config: payload.config || {},
        optionTemplate: payload.optionTemplate || {},
        mappingSchema: payload.mappingSchema || {},
        ownerName: normalizeText(payload.ownerName, existingRecord?.ownerName || "system"),
        status: String(payload.status || existingRecord?.status || "draft").trim().toLowerCase(),
        isBuiltin: Boolean(payload.isBuiltin ?? existingRecord?.isBuiltin)
      };
    }
    function normalizeDashboardPayload(payload, existingRecord = null) {
      return {
        dashboardName: normalizeText(payload.dashboardName),
        dashboardCode: normalizeText(existingRecord?.dashboardCode || payload.dashboardCode || ""),
        layoutMode: normalizeText(payload.layoutMode, existingRecord?.layoutMode || "grid"),
        themeTemplateId: payload.themeTemplateId ? Number(payload.themeTemplateId) : null,
        themeSettings: payload.themeSettings || {},
        themeConfig: payload.themeConfig || {},
        filterConfig: payload.filterConfig || {},
        canvasConfig: payload.canvasConfig || {},
        ownerName: normalizeText(payload.ownerName, existingRecord?.ownerName || "system"),
        status: String(payload.status || existingRecord?.status || "draft").trim().toLowerCase(),
        description: normalizeText(payload.description, "") || null,
        widgets: Array.isArray(payload.widgets) ? payload.widgets.map((item) => ({
          widgetKey: normalizeText(item.widgetKey),
          widgetName: normalizeText(item.widgetName),
          widgetType: normalizeText(item.widgetType, "chart"),
          datasetId: item.datasetId ? Number(item.datasetId) : null,
          chartAssetId: item.chartAssetId ? Number(item.chartAssetId) : null,
          position: item.position || {},
          props: item.props || {},
          queryParams: item.queryParams || {}
        })) : []
      };
    }
    function buildInternalDashboardCode() {
      const timestampPart = Date.now().toString(36);
      const randomPart = Math.random().toString(36).slice(2, 8);
      return `rpt_dash_${timestampPart}_${randomPart}`;
    }
    function assignInternalDashboardCode(normalized) {
      const next = { ...normalized };
      next.dashboardCode = buildInternalDashboardCode();
      return next;
    }
    function normalizeThemePalette(values, fallback = []) {
      const normalized = Array.isArray(values) ? values.map((item) => normalizeText(item)).filter(Boolean) : [];
      return normalized.length ? normalized : fallback;
    }
    function hydrateThemeTemplateChartVariants(template = {}) {
      const chartVariants = template.chartVariants && typeof template.chartVariants === "object" ? { ...template.chartVariants } : {};
      const sankey = chartVariants.sankey && typeof chartVariants.sankey === "object" ? { ...chartVariants.sankey } : {};
      const gauge = chartVariants.gauge && typeof chartVariants.gauge === "object" ? { ...chartVariants.gauge } : {};
      const funnel = chartVariants.funnel && typeof chartVariants.funnel === "object" ? { ...chartVariants.funnel } : {};
      const wordCloud = chartVariants.wordCloud && typeof chartVariants.wordCloud === "object" ? { ...chartVariants.wordCloud } : {};
      const scatter = chartVariants.scatter && typeof chartVariants.scatter === "object" ? { ...chartVariants.scatter } : {};
      const horizontalBar = chartVariants.horizontalBar && typeof chartVariants.horizontalBar === "object" ? chartVariants.horizontalBar : {};
      const line = chartVariants.line && typeof chartVariants.line === "object" ? chartVariants.line : {};
      const pie = chartVariants.pie && typeof chartVariants.pie === "object" ? chartVariants.pie : {};
      const chartCommon = template.chartCommon && typeof template.chartCommon === "object" ? template.chartCommon : {};
      const chrome = template.chrome && typeof template.chrome === "object" ? template.chrome : {};
      const semantic = template.semantic && typeof template.semantic === "object" ? template.semantic : {};
      const fallbackPalette = normalizeThemePalette(
        horizontalBar.palette,
        normalizeThemePalette(
          chartCommon.palette,
          [
            normalizeText(semantic.primary),
            normalizeText(semantic.secondary),
            "#f4b95d",
            "#8f7cff",
            "#f28f8f"
          ].filter(Boolean)
        )
      );
      chartVariants.sankey = {
        ...sankey,
        palette: normalizeThemePalette(sankey.palette, fallbackPalette),
        labelColor: normalizeText(
          sankey.labelColor,
          normalizeText(horizontalBar.axisLabelColor, normalizeText(horizontalBar.labelColor, normalizeText(chartCommon.labelColor, normalizeText(chrome.titleColor, "#344054"))))
        ),
        nodeBorderColor: normalizeText(sankey.nodeBorderColor, normalizeText(pie.sliceBorderColor, normalizeText(chrome.backgroundColor, "#ffffff"))),
        nodeBorderWidth: normalizeNumber(sankey.nodeBorderWidth, 1),
        nodeBorderRadius: normalizeNumber(sankey.nodeBorderRadius, normalizeNumber(horizontalBar.barBorderRadius, 4)),
        linkOpacity: sankey.linkOpacity == null ? 0.28 : Number(sankey.linkOpacity),
        linkCurveness: sankey.linkCurveness == null ? 0.5 : Number(sankey.linkCurveness)
      };
      chartVariants.gauge = {
        ...gauge,
        palette: normalizeThemePalette(gauge.palette, fallbackPalette),
        pointerColor: normalizeText(gauge.pointerColor, normalizeText(semantic.primary, fallbackPalette[0] || "#1677ff")),
        detailColor: normalizeText(gauge.detailColor, normalizeText(pie.centerValueColor, normalizeText(semantic.textPrimary, normalizeText(chrome.titleColor, "#101828")))),
        titleColor: normalizeText(gauge.titleColor, normalizeText(pie.centerTitleColor, normalizeText(semantic.textSecondary, normalizeText(chartCommon.legendColor, "#667085")))),
        axisLabelColor: normalizeText(
          gauge.axisLabelColor,
          normalizeText(horizontalBar.axisLabelColor, normalizeText(chartCommon.labelColor, normalizeText(chrome.titleColor, "#344054")))
        ),
        splitLineColor: normalizeText(
          gauge.splitLineColor,
          normalizeText(horizontalBar.axisColor, normalizeText(semantic.lineStrong, normalizeText(chrome.borderColor, "#98a2b3")))
        ),
        startAngle: normalizeNumber(gauge.startAngle, 210),
        endAngle: normalizeNumber(gauge.endAngle, -30),
        radius: normalizeChartDimension(gauge.radius, "90%"),
        progressWidth: normalizeNumber(gauge.progressWidth, 18),
        axisLineWidth: normalizeNumber(gauge.axisLineWidth, normalizeNumber(gauge.progressWidth, 18)),
        pointerLength: normalizeChartDimension(gauge.pointerLength, "58%"),
        detailFontSize: normalizeNumber(gauge.detailFontSize, 24),
        detailFontWeight: normalizeNumber(gauge.detailFontWeight, 700),
        titleFontSize: normalizeNumber(gauge.titleFontSize, 14)
      };
      chartVariants.funnel = {
        ...funnel,
        palette: normalizeThemePalette(funnel.palette, fallbackPalette),
        labelColor: normalizeText(
          funnel.labelColor,
          normalizeText(horizontalBar.axisLabelColor, normalizeText(chartCommon.labelColor, normalizeText(chrome.titleColor, "#344054")))
        ),
        valueColor: normalizeText(funnel.valueColor, normalizeText(pie.valueColor, normalizeText(semantic.textPrimary, normalizeText(chrome.titleColor, "#101828")))),
        guideLineColor: normalizeText(
          funnel.guideLineColor,
          normalizeText(pie.guideLineColor, normalizeText(chartCommon.guideLineColor, normalizeText(chrome.borderColor, "#98a2b3")))
        ),
        blockBorderColor: normalizeText(funnel.blockBorderColor, normalizeText(pie.sliceBorderColor, normalizeText(chrome.backgroundColor, "#ffffff"))),
        blockBorderWidth: normalizeNumber(funnel.blockBorderWidth, 1),
        itemGap: normalizeNumber(funnel.itemGap, 2),
        sortOrder: normalizeText(funnel.sortOrder, "descending")
      };
      chartVariants.wordCloud = {
        ...wordCloud,
        palette: normalizeThemePalette(wordCloud.palette, fallbackPalette),
        shape: normalizeText(wordCloud.shape, "circle"),
        gridSize: normalizeNumber(wordCloud.gridSize, 10),
        rotationStep: normalizeNumber(wordCloud.rotationStep, 45),
        minFontSize: normalizeNumber(wordCloud.minFontSize, 12),
        maxFontSize: normalizeNumber(wordCloud.maxFontSize, 40),
        fontWeight: normalizeNumber(wordCloud.fontWeight, 700),
        textShadowColor: normalizeText(wordCloud.textShadowColor, normalizeText(chartCommon.emphasisShadowColor, normalizeText(semantic.primary, "rgba(15,23,42,0.14)"))),
        textShadowBlur: normalizeNumber(wordCloud.textShadowBlur, 10)
      };
      chartVariants.scatter = {
        ...scatter,
        palette: normalizeThemePalette(scatter.palette, normalizeThemePalette(line.palette, fallbackPalette)),
        labelColor: normalizeText(
          scatter.labelColor,
          normalizeText(line.axisLabelColor, normalizeText(chartCommon.labelColor, normalizeText(chrome.titleColor, "#344054")))
        ),
        legendColor: normalizeText(scatter.legendColor, normalizeText(chartCommon.legendColor, normalizeText(chrome.titleColor, "#344054"))),
        axisColor: normalizeText(
          scatter.axisColor,
          normalizeText(line.axisColor, normalizeText(semantic.lineStrong, normalizeText(chrome.borderColor, "#98a2b3")))
        ),
        axisLabelColor: normalizeText(
          scatter.axisLabelColor,
          normalizeText(line.axisLabelColor, normalizeText(chartCommon.labelColor, normalizeText(chrome.titleColor, "#344054")))
        ),
        splitLineColor: normalizeText(
          scatter.splitLineColor,
          normalizeText(line.splitLineColor, normalizeText(semantic.lineSubtle, normalizeText(chrome.borderColor, "#e5e7eb")))
        ),
        symbolSize: normalizeNumber(scatter.symbolSize, 16),
        pointBorderColor: normalizeText(scatter.pointBorderColor, normalizeText(line.pointBorderColor, normalizeText(chrome.backgroundColor, "#ffffff"))),
        pointBorderWidth: normalizeNumber(scatter.pointBorderWidth, 1),
        pointOpacity: scatter.pointOpacity == null ? 0.82 : Number(scatter.pointOpacity),
        labelPosition: normalizeText(scatter.labelPosition, normalizeText(line.labelPosition, "top"))
      };
      return chartVariants;
    }
    function hydrateThemeTemplateRecord(record) {
      if (!record) return record;
      const canvas = record.canvas && typeof record.canvas === "object" ? record.canvas : {};
      const chrome = record.chrome && typeof record.chrome === "object" ? record.chrome : {};
      return {
        ...record,
        canvas: {
          ...canvas,
          dashboardTitleColor: normalizeText(canvas.dashboardTitleColor, normalizeText(chrome.titleColor, "#101828"))
        },
        chartVariants: hydrateThemeTemplateChartVariants(record)
      };
    }
    function normalizeThemeTemplatePayload(payload, existingRecord = null) {
      const existingCanvas = existingRecord?.canvas && typeof existingRecord.canvas === "object" ? existingRecord.canvas : {};
      const existingChrome = existingRecord?.chrome && typeof existingRecord.chrome === "object" ? existingRecord.chrome : {};
      const canvas = payload.canvas && typeof payload.canvas === "object" ? payload.canvas : {};
      const chrome = payload.chrome && typeof payload.chrome === "object" ? payload.chrome : {};
      const normalized = {
        themeName: normalizeText(payload.themeName, existingRecord?.themeName || ""),
        themeCode: normalizeText(payload.themeCode, existingRecord?.themeCode || ""),
        category: normalizeText(payload.category, existingRecord?.category || "general"),
        description: normalizeText(payload.description, "") || null,
        isBuiltin: Boolean(payload.isBuiltin ?? existingRecord?.isBuiltin),
        status: String(payload.status || existingRecord?.status || "active").trim().toLowerCase(),
        previewImage: normalizeText(payload.previewImage, "") || null,
        createdBy: normalizeText(payload.createdBy, existingRecord?.createdBy || "system"),
        canvas: {
          ...canvas,
          dashboardTitleColor: normalizeText(
            canvas.dashboardTitleColor,
            normalizeText(existingCanvas.dashboardTitleColor, normalizeText(chrome.titleColor, normalizeText(existingChrome.titleColor, "#101828")))
          )
        },
        chrome: chrome || {},
        semantic: payload.semantic || {},
        chartCommon: payload.chartCommon || {},
        chartVariants: payload.chartVariants || {}
      };
      return {
        ...normalized,
        chartVariants: hydrateThemeTemplateChartVariants(normalized)
      };
    }
    function buildDatasetFolderChildrenMap(folders = []) {
      const childrenMap = /* @__PURE__ */ new Map();
      for (const folder of folders) {
        const parentId = folder.parentId == null ? null : Number(folder.parentId);
        if (parentId == null) continue;
        const children = childrenMap.get(parentId) || [];
        children.push(Number(folder.id));
        childrenMap.set(parentId, children);
      }
      return childrenMap;
    }
    function collectDatasetFolderDescendantIds(folders = [], folderId) {
      const descendants = /* @__PURE__ */ new Set();
      const childrenMap = buildDatasetFolderChildrenMap(folders);
      const stack = [Number(folderId)];
      while (stack.length) {
        const current = stack.pop();
        if (current == null || descendants.has(current)) continue;
        descendants.add(current);
        const children = childrenMap.get(current) || [];
        for (const childId of children) {
          stack.push(childId);
        }
      }
      return descendants;
    }
    async function ensureReportDataSource(id) {
      const row = await repository.getReportDataSourceById(Number(id));
      if (!row) {
        throw new AppError("\u62A5\u8868\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      }
      return hydrateReportDataSource(row);
    }
    async function hydrateReportDataSource(row) {
      const referenceId = Number(row?.connectionConfig?.devDatasourceId || 0);
      if (!referenceId) return row;
      const projectId = getCurrentProjectId();
      const conditions = ["id = ?"];
      const params = [referenceId];
      if (projectId) {
        conditions.push("project_id = ?");
        params.push(projectId);
      }
      const [rows] = await pool.query(
        `SELECT id, type, host, port, database_name AS databaseName, username,
            password_encrypted AS passwordEncrypted, extra_config_json AS extraConfig
       FROM dev_datasources
      WHERE ${conditions.join(" AND ")}
      LIMIT 1`,
        params
      );
      const datasource = rows[0];
      if (!datasource) {
        throw new AppError("\u62A5\u8868\u5F15\u7528\u7684\u6570\u636E\u5F00\u53D1\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 400);
      }
      let extraConfig = datasource.extraConfig || {};
      if (typeof extraConfig === "string") {
        try {
          extraConfig = JSON.parse(extraConfig);
        } catch {
          extraConfig = {};
        }
      }
      return {
        ...row,
        sourceType: datasource.type || row.sourceType,
        connectionConfig: {
          ...row.connectionConfig,
          host: datasource.host,
          port: Number(datasource.port || 0),
          database: datasource.databaseName,
          databaseName: datasource.databaseName,
          username: datasource.username,
          password: decryptSecret(datasource.passwordEncrypted),
          ...extraConfig
        }
      };
    }
    async function ensureReportDatasetFolder(id) {
      const row = await repository.getReportDatasetFolderById(Number(id));
      if (!row) {
        throw new AppError("\u6570\u636E\u96C6\u6587\u4EF6\u5939\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function ensureReportDatasetFolderParent(folderId, parentId) {
      if (parentId == null) {
        return null;
      }
      const resolvedParentId = Number(parentId);
      const parent = await ensureReportDatasetFolder(resolvedParentId);
      if (folderId != null) {
        const resolvedFolderId = Number(folderId);
        if (resolvedParentId === resolvedFolderId) {
          throw new AppError("\u6587\u4EF6\u5939\u4E0D\u80FD\u8BBE\u7F6E\u4E3A\u81EA\u8EAB\u7684\u4E0A\u7EA7\u6587\u4EF6\u5939", 400);
        }
        const folders = await repository.listReportDatasetFolders();
        const descendantIds = collectDatasetFolderDescendantIds(folders, resolvedFolderId);
        if (descendantIds.has(resolvedParentId)) {
          throw new AppError("\u4E0A\u7EA7\u6587\u4EF6\u5939\u4E0D\u80FD\u9009\u62E9\u81EA\u8EAB\u7684\u5B50\u6587\u4EF6\u5939", 400);
        }
      }
      return parent;
    }
    async function ensureActiveReportDataSource(id) {
      const row = await ensureReportDataSource(id);
      if (row.status !== "active") {
        throw new AppError("\u62A5\u8868\u6570\u636E\u6E90\u672A\u542F\u7528", 400);
      }
      return row;
    }
    async function ensureReportDataset(id) {
      const row = await repository.getReportDatasetById(Number(id));
      if (!row) {
        throw new AppError("\u6570\u636E\u96C6\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function ensureReportChartAsset(id) {
      const row = await repository.getReportChartAssetById(Number(id));
      if (!row) {
        throw new AppError("\u56FE\u8868\u8D44\u4EA7\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function ensureReportDashboard(id) {
      const row = await repository.getReportDashboardById(Number(id));
      if (!row) {
        throw new AppError("\u4EEA\u8868\u677F\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function ensureReportThemeTemplate(id) {
      const row = await repository.getReportThemeTemplateById(Number(id));
      if (!row) {
        throw new AppError("\u4E3B\u9898\u6A21\u677F\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function withReportConnection(dataSource, callback) {
      const resolved = resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
      const dialect = resolved.dialect;
      if (["mysql", "postgresql", "oracle", "dm"].includes(dialect) && getManagedBinding(dialect)) {
        const adapter = getAdapter(dialect);
        const runtimeConfig = {
          ...dataSource.connectionConfig || {},
          sourceType: dialect,
          databaseName: resolved.database
        };
        const connection = {
          async query(input, params) {
            const sql = typeof input === "object" ? input.sql : input;
            const binds = typeof input === "object" ? input.values || params : params;
            const result = await adapter.executeQuery(runtimeConfig, sql, { binds });
            if (dialect === "mysql") {
              return [result.rows || [], (result.fields || []).map((name) => ({ name }))];
            }
            return {
              rows: result.rows || [],
              fields: (result.fields || []).map((name) => ({ name })),
              rowCount: result.rowCount || 0
            };
          }
        };
        return callback(connection, dialect);
      }
      if (dialect === "mysql") {
        const connection = await mysql.createConnection({
          host: resolved.host,
          port: resolved.port || 3306,
          user: resolved.username,
          password: resolved.password,
          database: resolved.database,
          charset: "utf8mb4"
        });
        try {
          return await callback(connection, dialect);
        } finally {
          await connection.end();
        }
      }
      if (dialect === "postgresql") {
        const client = createPostgresLikeClient({
          host: resolved.host,
          port: resolved.port || 5432,
          database: resolved.database,
          user: resolved.username,
          password: resolved.password
        }, { sourceType: dataSource.sourceType });
        await client.connect();
        try {
          return await callback(client, dialect);
        } finally {
          await client.end();
        }
      }
      if (["oracle", "dm"].includes(dialect)) {
        const adapter = getAdapter(dialect);
        const runtimeConfig = {
          ...dataSource.connectionConfig || {},
          sourceType: dialect,
          databaseName: resolved.database
        };
        const connection = {
          async query(input) {
            const sql = typeof input === "object" ? input.sql : input;
            const result = await adapter.executeQuery(runtimeConfig, sql);
            return {
              rows: result.rows || [],
              fields: (result.fields || []).map((name) => ({ name })),
              rowCount: result.rowCount || 0
            };
          }
        };
        return callback(connection, dialect);
      }
      throw new AppError(`\u5F53\u524D\u6682\u4E0D\u652F\u6301 ${dataSource.sourceType} \u7C7B\u578B\u7684\u6570\u636E\u9884\u89C8`, 400);
    }
    async function explainReportSql(dataSource, sql) {
      const startedAt = Date.now();
      try {
        await withReportConnection(dataSource, async (connection, dialect) => {
          if (dialect === "mysql") {
            await connection.query(`EXPLAIN ${sql}`);
            return;
          }
          await connection.query(dialect === "oracle" ? `EXPLAIN PLAN FOR ${sql}` : `EXPLAIN ${sql}`);
        });
        return {
          explainValid: true,
          durationMs: Date.now() - startedAt,
          messages: ["SQL \u5DF2\u901A\u8FC7\u5F53\u524D\u6570\u636E\u6E90 EXPLAIN \u6821\u9A8C"]
        };
      } catch (error) {
        return {
          explainValid: false,
          durationMs: Date.now() - startedAt,
          messages: [`EXPLAIN \u6821\u9A8C\u672A\u901A\u8FC7: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`]
        };
      }
    }
    async function resolveReportingAiProvider(sceneCode) {
      const aiConfig = await reportingAiConfigService.getActiveConfigByCode(sceneCode);
      let provider = null;
      if (aiConfig?.defaultModelProviderId) {
        provider = await modelProviderService.getModelProviderById(Number(aiConfig.defaultModelProviderId));
        provider = modelProviderService.applyModelSelection(provider, {
          modelName: aiConfig.defaultModelName,
          modelVersion: aiConfig.defaultModelVersion
        });
      } else {
        const providers = await modelProviderService.getActiveChatModelProviders();
        provider = providers[0] || null;
      }
      if (!provider) {
        throw new AppError("\u672A\u627E\u5230\u53EF\u7528\u7684\u5BF9\u8BDD\u6A21\u578B\uFF0C\u8BF7\u5148\u5728\u62A5\u8868\u6A21\u578B\u7BA1\u7406\u4E2D\u914D\u7F6E\u9ED8\u8BA4\u6A21\u578B", 400);
      }
      return { aiConfig, provider };
    }
    function buildAiRuntimeOptions(aiConfig, fallback = {}) {
      return {
        temperature: aiConfig?.temperature ?? fallback.temperature ?? 0.1,
        maxTokens: aiConfig?.maxTokens ?? fallback.maxTokens ?? 1600,
        timeoutMs: aiConfig?.timeoutMs ?? fallback.timeoutMs ?? 3e4,
        responseFormat: { type: "json_object" }
      };
    }
    function buildAiAnalysisSuggestionSystemPrompt(configuredPrompt = "", variables = {}) {
      const renderedPrompt = renderPromptTemplate(configuredPrompt, {
        sceneCode: AI_ANALYSIS_SUGGESTION_SCENE_CODE,
        ...variables
      });
      return [
        renderedPrompt || "\u4F60\u662F\u62A5\u8868\u5E73\u53F0\u4E2D\u7684\u6570\u636E\u5206\u6790\u9700\u6C42\u89C4\u5212\u52A9\u624B\u3002",
        "\u5FC5\u987B\u57FA\u4E8E\u771F\u5B9E\u6570\u636E\u6E90\u5143\u6570\u636E\u3001\u5019\u9009\u8868\u5B57\u6BB5\u548C\u968F\u673A\u6837\u4F8B\u6570\u636E\uFF0C\u7ED3\u5408\u7528\u6237\u5206\u6790\u65B9\u5411\u751F\u6210\u53EF\u843D\u5230 SQL \u548C\u56FE\u8868\u7684\u5206\u6790\u9700\u6C42\u3002",
        "\u6BCF\u6761\u5EFA\u8BAE\u8981\u8D34\u5408\u4E1A\u52A1\u573A\u666F\uFF0C\u660E\u786E\u5206\u6790\u5BF9\u8C61\u3001\u7EDF\u8BA1\u53E3\u5F84\u3001\u7EF4\u5EA6\u3001\u6307\u6807\u3001\u7B5B\u9009\u8303\u56F4\u548C\u63A8\u8350\u56FE\u8868\u65B9\u5411\u3002",
        "\u51E1\u662F\u63D0\u5230\u8868\u540D\u6216\u5B57\u6BB5\u540D\uFF0C\u4F18\u5148\u8F93\u51FA\u4E3A \u7269\u7406\u540D\uFF08\u4E2D\u6587\u8BF4\u660E\uFF09\u3002\u5982\u679C\u5143\u6570\u636E\u91CC\u6709\u771F\u5B9E\u4E2D\u6587\u6CE8\u91CA\uFF0C\u76F4\u63A5\u4F7F\u7528\uFF1B\u5982\u679C\u6CA1\u6709\u4F46\u80FD\u4ECE\u547D\u540D\u8BED\u4E49\u51C6\u786E\u5224\u65AD\uFF0C\u53EF\u8865\u5145\u7B80\u6D01\u4E2D\u6587\u8BF4\u660E\uFF1B\u5982\u679C\u4ECD\u4E0D\u786E\u5B9A\uFF0C\u53EA\u5199\u7269\u7406\u540D\u3002",
        "\u4E0D\u8981\u7F16\u9020\u4E0D\u5B58\u5728\u7684\u8868\u6216\u5B57\u6BB5\uFF1B\u5982\u679C\u4FE1\u606F\u4E0D\u8DB3\uFF0C\u7ED9\u51FA\u4FDD\u5B88\u53EF\u6267\u884C\u7684\u9700\u6C42\u5E76\u5728 caveats \u4E2D\u8BF4\u660E\u9650\u5236\u3002",
        "\u8F93\u51FA\u5FC5\u987B\u662F JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown\uFF0C\u4E0D\u8981\u4EE3\u7801\u5757\u3002",
        JSON.stringify({
          suggestions: [{
            title: "\u5206\u6790\u9700\u6C42\u6807\u9898",
            analysisPrompt: "\u53EF\u76F4\u63A5\u7528\u4E8E\u751F\u6210 SQL \u7684\u5B8C\u6574\u81EA\u7136\u8BED\u8A00\u9700\u6C42",
            businessScenario: "\u4E1A\u52A1\u573A\u666F",
            dimensions: ["\u7EF4\u5EA6\u5B57\u6BB5\u6216\u7EF4\u5EA6\u65B9\u5411"],
            metrics: ["\u6307\u6807\u5B57\u6BB5\u6216\u7EDF\u8BA1\u53E3\u5F84"],
            filters: ["\u7B5B\u9009\u6761\u4EF6"],
            chartHint: "\u63A8\u8350\u56FE\u8868\u65B9\u5411",
            reason: "\u63A8\u8350\u4F9D\u636E",
            caveats: ["\u9650\u5236\u6216\u5047\u8BBE"]
          }],
          summary: "\u6574\u4F53\u5EFA\u8BAE\u8BF4\u660E"
        })
      ].filter(Boolean).join("\n");
    }
    function buildAiAnalysisSuggestionUserPrompt(payload, context) {
      const annotationGuide = asArray(context.tableSchemas).map((table) => ({
        tableName: table.tableName,
        tableComment: resolveAnalysisAnnotationLabel(table.tableName, table.tableComment, "table") || null,
        columns: asArray(table.columns).map((column) => ({
          name: column.name,
          comment: resolveAnalysisAnnotationLabel(column.name, column.comment, "field") || null
        }))
      }));
      return [
        "\u7528\u6237\u5206\u6790\u65B9\u5411:",
        payload.analysisDirection || payload.prompt || "",
        "",
        "\u5F53\u524D\u53EF\u7528\u8868\uFF08\u6700\u591A80\u5F20\uFF09:",
        JSON.stringify(context.availableTables, null, 2),
        "",
        "\u5019\u9009\u8868\u5B57\u6BB5\u7ED3\u6784\uFF08\u6700\u591A5\u5F20\u8868\uFF09:",
        JSON.stringify(context.tableSchemas, null, 2),
        "",
        context.tableSamples?.length ? [
          "\u5019\u9009\u8868\u968F\u673A\u6837\u4F8B\u6570\u636E\uFF08\u6BCF\u8868\u6700\u591A50\u884C\uFF0C\u5B57\u6BB5\u503C\u6700\u591A100\u5B57\u7B26\uFF09:",
          JSON.stringify(context.tableSamples, null, 2),
          ""
        ].join("\n") : "",
        "\u8868\u540D\u4E0E\u5B57\u6BB5\u540D\u4E2D\u6587\u6CE8\u91CA\u53C2\u8003\uFF08\u751F\u6210\u6587\u6848\u65F6\u5FC5\u987B\u5E26\u4E0A\uFF09:",
        JSON.stringify(annotationGuide, null, 2),
        "",
        "\u751F\u6210\u8981\u6C42:",
        "1. \u8FD4\u56DE 3 \u5230 6 \u6761\u5EFA\u8BAE\uFF0CanalysisPrompt \u8981\u80FD\u76F4\u63A5\u4F20\u7ED9\u81EA\u7136\u8BED\u8A00\u751F\u6210 SQL\u3002",
        "2. \u6BCF\u6761\u5EFA\u8BAE\u53EA\u80FD\u5F15\u7528\u5019\u9009\u8868\u5B57\u6BB5\u7ED3\u6784\u4E2D\u80FD\u5224\u65AD\u5B58\u5728\u7684\u8868\u6216\u5B57\u6BB5\u3002",
        "3. \u4F18\u5148\u8986\u76D6\u8D8B\u52BF\u3001\u6392\u540D\u3001\u7ED3\u6784\u5360\u6BD4\u3001\u5F02\u5E38\u6CE2\u52A8\u3001\u533A\u57DF\u5206\u5E03\u3001\u660E\u7EC6\u6838\u67E5\u7B49\u4E1A\u52A1\u573A\u666F\u4E2D\u6700\u9002\u5408\u5F53\u524D\u6570\u636E\u7684\u4E00\u5230\u6570\u7C7B\u3002",
        "4. \u5982\u679C\u7528\u6237\u7ED9\u4E86\u5206\u6790\u65B9\u5411\uFF0C\u5EFA\u8BAE\u5FC5\u987B\u56F4\u7ED5\u8BE5\u65B9\u5411\u5C55\u5F00\u3002",
        "5. \u51E1\u662F\u8F93\u51FA\u8868\u540D\u3001\u5B57\u6BB5\u540D\u3001\u7EF4\u5EA6\u3001\u6307\u6807\u65F6\uFF0C\u4F18\u5148\u5199\u6210\u201C\u7269\u7406\u540D\uFF08\u4E2D\u6587\u8BF4\u660E\uFF09\u201D\uFF1B\u6CA1\u6709\u628A\u63E1\u65F6\u53EA\u5199\u7269\u7406\u540D\uFF0C\u4E0D\u8981\u8F93\u51FA\u201C\u672A\u7EF4\u62A4\u4E2D\u6587\u6CE8\u91CA\u201D\u7B49\u5360\u4F4D\u8BCD\u3002"
      ].filter(Boolean).join("\n");
    }
    function normalizeAiAnalysisSuggestions(parsed, context) {
      const annotationContext = buildAnalysisAnnotationContext(context);
      return asArray(parsed?.suggestions).map((item, index) => ({
        id: normalizeText(item?.id, `suggestion_${index + 1}`),
        title: normalizeText(item?.title, `\u5206\u6790\u5EFA\u8BAE ${index + 1}`),
        analysisPrompt: normalizeText(item?.analysisPrompt || item?.prompt || item?.requirement),
        businessScenario: normalizeText(item?.businessScenario || item?.scenario),
        dimensions: uniqueStrings(item?.dimensions),
        metrics: uniqueStrings(item?.metrics),
        filters: uniqueStrings(item?.filters),
        chartHint: normalizeText(item?.chartHint || item?.chart),
        reason: normalizeText(item?.reason),
        caveats: uniqueStrings(item?.caveats || item?.risks)
      })).filter((item) => item.analysisPrompt).slice(0, 6).map((item, index) => annotateAnalysisSuggestionItem({
        ...item,
        rank: index + 1,
        id: item.id || `suggestion_${index + 1}`
      }, annotationContext));
    }
    function buildDeterministicAnalysisSuggestions(context, direction = "") {
      const tableSchemas = asArray(context.tableSchemas);
      const allColumns = tableSchemas.flatMap((table) => asArray(table.columns).map((column) => ({
        tableName: table.tableName,
        name: column.name,
        dataType: String(column.dataType || column.columnType || "").toLowerCase(),
        comment: column.comment || ""
      })));
      const timeColumn = allColumns.find((column) => /date|time|timestamp|datetime|year|month|日期|时间|月份|年度/.test(`${column.name} ${column.comment} ${column.dataType}`));
      const metricColumn = allColumns.find((column) => /int|decimal|number|numeric|double|float|amount|price|qty|count|金额|数量|次数|面积|收入|成本|得分/.test(`${column.name} ${column.comment} ${column.dataType}`));
      const geoColumn = allColumns.find((column) => /province|city|region|area|district|county|省|市|地区|区域|区县/.test(`${column.name} ${column.comment}`));
      const categoryColumn = allColumns.find((column) => column !== timeColumn && column !== metricColumn && column !== geoColumn);
      const primaryTable = tableSchemas[0]?.tableName || context.availableTables?.[0]?.tableName || "\u5F53\u524D\u6570\u636E\u8868";
      const metricName = metricColumn?.name || "\u8BB0\u5F55\u6570";
      const categoryName = categoryColumn?.name || geoColumn?.name || "\u5206\u7C7B\u7EF4\u5EA6";
      const directionPrefix = normalizeText(direction) ? `\u56F4\u7ED5\u201C${normalizeText(direction)}\u201D\uFF0C` : "";
      const suggestions = [];
      if (timeColumn && metricColumn) {
        suggestions.push({
          title: "\u6838\u5FC3\u6307\u6807\u8D8B\u52BF\u5206\u6790",
          analysisPrompt: `${directionPrefix}\u6309${timeColumn.name}\u7EDF\u8BA1${primaryTable}\u4E2D${metricName}\u7684\u53D8\u5316\u8D8B\u52BF\uFF0C\u8F93\u51FA\u65F6\u95F4\u7EF4\u5EA6\u3001\u6307\u6807\u503C\uFF0C\u5E76\u6309\u65F6\u95F4\u5347\u5E8F\u5C55\u793A\u3002`,
          businessScenario: "\u8DDF\u8E2A\u6838\u5FC3\u6307\u6807\u968F\u65F6\u95F4\u7684\u53D8\u5316\uFF0C\u8BC6\u522B\u589E\u957F\u3001\u4E0B\u964D\u548C\u5468\u671F\u6CE2\u52A8\u3002",
          dimensions: [timeColumn.name],
          metrics: [metricName],
          filters: [],
          chartHint: "\u6298\u7EBF\u56FE\u6216\u9762\u79EF\u56FE",
          reason: "\u5019\u9009\u8868\u4E2D\u540C\u65F6\u5B58\u5728\u65F6\u95F4\u5B57\u6BB5\u548C\u6570\u503C\u6307\u6807\uFF0C\u9002\u5408\u505A\u8D8B\u52BF\u5206\u6790\u3002",
          caveats: []
        });
      }
      if ((categoryColumn || geoColumn) && metricColumn) {
        suggestions.push({
          title: "\u5206\u7C7B\u6392\u540D\u5BF9\u6BD4",
          analysisPrompt: `${directionPrefix}\u6309${categoryName}\u6C47\u603B${primaryTable}\u4E2D${metricName}\uFF0C\u7EDF\u8BA1\u5404\u5206\u7C7B\u7684\u6307\u6807\u503C\uFF0C\u6309\u6307\u6807\u503C\u5012\u5E8F\u53D6\u524D 10\u3002`,
          businessScenario: "\u6BD4\u8F83\u4E0D\u540C\u7C7B\u522B\u3001\u7EC4\u7EC7\u3001\u6E20\u9053\u6216\u533A\u57DF\u7684\u8D21\u732E\u5DEE\u5F02\u3002",
          dimensions: [categoryName],
          metrics: [metricName],
          filters: ["Top 10"],
          chartHint: "\u67F1\u5F62\u56FE\u6216\u6761\u5F62\u56FE",
          reason: "\u5019\u9009\u8868\u4E2D\u5B58\u5728\u53EF\u5206\u7EC4\u5B57\u6BB5\u548C\u6570\u503C\u5B57\u6BB5\uFF0C\u9002\u5408\u505A\u6392\u540D\u5BF9\u6BD4\u3002",
          caveats: []
        });
      }
      if (geoColumn && metricColumn) {
        suggestions.push({
          title: "\u533A\u57DF\u5206\u5E03\u5206\u6790",
          analysisPrompt: `${directionPrefix}\u6309${geoColumn.name}\u7EDF\u8BA1${primaryTable}\u4E2D${metricName}\u7684\u533A\u57DF\u5206\u5E03\uFF0C\u8F93\u51FA\u5730\u533A\u548C\u6307\u6807\u503C\uFF0C\u5E76\u6309\u6307\u6807\u503C\u5012\u5E8F\u6392\u5217\u3002`,
          businessScenario: "\u89C2\u5BDF\u6307\u6807\u5728\u4E0D\u540C\u5730\u533A\u7684\u5206\u5E03\uFF0C\u5B9A\u4F4D\u9AD8\u503C\u6216\u4F4E\u503C\u533A\u57DF\u3002",
          dimensions: [geoColumn.name],
          metrics: [metricName],
          filters: [],
          chartHint: "\u5730\u56FE\u6216\u6392\u540D\u6761\u5F62\u56FE",
          reason: "\u5019\u9009\u8868\u4E2D\u8BC6\u522B\u5230\u5730\u533A\u5B57\u6BB5\uFF0C\u9002\u5408\u505A\u533A\u57DF\u5206\u6790\u3002",
          caveats: []
        });
      }
      suggestions.push({
        title: "\u6570\u636E\u660E\u7EC6\u6838\u67E5",
        analysisPrompt: `${directionPrefix}\u67E5\u8BE2${primaryTable}\u7684\u5173\u952E\u660E\u7EC6\u5B57\u6BB5\uFF0C\u4FDD\u7559\u4E3B\u8981\u5206\u7C7B\u3001\u65F6\u95F4\u548C\u6570\u503C\u5B57\u6BB5\uFF0C\u53D6\u6700\u65B0\u6216\u6700\u6709\u4EE3\u8868\u6027\u7684 100 \u6761\u8BB0\u5F55\u7528\u4E8E\u6570\u636E\u6838\u67E5\u3002`,
        businessScenario: "\u5728\u751F\u6210\u6C47\u603B\u56FE\u8868\u524D\u6838\u67E5\u6837\u4F8B\u8BB0\u5F55\uFF0C\u786E\u8BA4\u5B57\u6BB5\u542B\u4E49\u548C\u6570\u636E\u8D28\u91CF\u3002",
        dimensions: [categoryColumn?.name, timeColumn?.name].filter(Boolean),
        metrics: [metricColumn?.name].filter(Boolean),
        filters: ["LIMIT 100"],
        chartHint: "\u660E\u7EC6\u8868",
        reason: "\u660E\u7EC6\u6838\u67E5\u53EF\u4EE5\u5E2E\u52A9\u786E\u8BA4\u5B57\u6BB5\u8BED\u4E49\u548C\u540E\u7EED\u7EDF\u8BA1\u53E3\u5F84\u3002",
        caveats: ["\u5B57\u6BB5\u542B\u4E49\u4ECD\u9700\u7ED3\u5408\u4E1A\u52A1\u53E3\u5F84\u4EBA\u5DE5\u786E\u8BA4\u3002"]
      });
      const annotationContext = buildAnalysisAnnotationContext(context);
      return suggestions.slice(0, 6).map((item, index) => annotateAnalysisSuggestionItem({
        ...item,
        id: `fallback_${index + 1}`,
        rank: index + 1
      }, annotationContext));
    }
    function extractJsonObject(text = "") {
      const raw = String(text || "").trim();
      if (!raw) {
        throw new Error("\u6A21\u578B\u672A\u8FD4\u56DE\u6709\u6548\u5185\u5BB9");
      }
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced?.[1]) {
        return fenced[1].trim();
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
        const extracted = extractJsonObject(text);
        try {
          return JSON.parse(extracted);
        } catch {
          return JSON.parse(
            extracted.replace(/,\s*([}\]])/g, "$1").replace(/^\uFEFF/, "")
          );
        }
      }
    }
    function escapeRegExp(value = "") {
      return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    var AI_ANALYSIS_IDENTIFIER_PHRASE_LABELS = {
      rule_category: "\u89C4\u5219\u7C7B\u522B",
      issue_rows: "\u95EE\u9898\u884C\u6570",
      issue_count: "\u95EE\u9898\u6570\u91CF",
      table_name: "\u8868\u540D",
      column_name: "\u5B57\u6BB5\u540D",
      created_at: "\u521B\u5EFA\u65F6\u95F4",
      updated_at: "\u66F4\u65B0\u65F6\u95F4",
      source_name: "\u6570\u636E\u6E90\u540D\u79F0",
      source_id: "\u6570\u636E\u6E90ID"
    };
    var AI_ANALYSIS_IDENTIFIER_TOKEN_LABELS = {
      amount: "\u91D1\u989D",
      avg: "\u5E73\u5747",
      category: "\u7C7B\u522B",
      city: "\u57CE\u5E02",
      code: "\u7F16\u7801",
      count: "\u6570\u91CF",
      created: "\u521B\u5EFA",
      date: "\u65E5\u671F",
      day: "\u65E5",
      district: "\u533A\u53BF",
      field: "\u5B57\u6BB5",
      id: "ID",
      issue: "\u95EE\u9898",
      level: "\u7B49\u7EA7",
      month: "\u6708",
      name: "\u540D\u79F0",
      order: "\u8BA2\u5355",
      province: "\u7701\u4EFD",
      qty: "\u6570\u91CF",
      quality: "\u8D28\u91CF",
      rate: "\u6BD4\u7387",
      region: "\u533A\u57DF",
      row: "\u884C",
      rows: "\u884C\u6570",
      rule: "\u89C4\u5219",
      sales: "\u9500\u552E",
      score: "\u5F97\u5206",
      source: "\u6765\u6E90",
      stat: "\u7EDF\u8BA1",
      stats: "\u7EDF\u8BA1",
      status: "\u72B6\u6001",
      table: "\u8868",
      time: "\u65F6\u95F4",
      total: "\u603B\u91CF",
      type: "\u7C7B\u578B",
      updated: "\u66F4\u65B0",
      user: "\u7528\u6237",
      value: "\u6570\u503C",
      year: "\u5E74"
    };
    var AI_ANALYSIS_IDENTIFIER_IGNORED_TOKENS = /* @__PURE__ */ new Set([
      "adm",
      "ads",
      "app",
      "bak",
      "data",
      "dim",
      "dwd",
      "dwm",
      "fact",
      "medata",
      "ods",
      "dw",
      "tmp"
    ]);
    function normalizeAnalysisIdentifier(value = "") {
      return String(value || "").split(".").filter(Boolean).pop()?.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "";
    }
    function inferAnalysisSemanticLabel(value = "", kind = "field") {
      const normalized = normalizeAnalysisIdentifier(value);
      if (!normalized) return "";
      if (AI_ANALYSIS_IDENTIFIER_PHRASE_LABELS[normalized]) {
        return AI_ANALYSIS_IDENTIFIER_PHRASE_LABELS[normalized];
      }
      const rawTokens = normalized.split("_").filter(Boolean);
      const tokens = rawTokens.filter((token) => token && !AI_ANALYSIS_IDENTIFIER_IGNORED_TOKENS.has(token) && !/^\d+$/.test(token));
      if (!tokens.length) return "";
      const recognized = [];
      const unknown = [];
      tokens.forEach((token) => {
        const label = AI_ANALYSIS_IDENTIFIER_TOKEN_LABELS[token];
        if (label) {
          recognized.push(label);
        } else {
          unknown.push(token);
        }
      });
      if (!recognized.length) return "";
      if (unknown.length > Math.max(1, Math.floor(tokens.length / 2))) return "";
      if (kind === "table" && recognized.length < 2) return "";
      return recognized.join("");
    }
    function resolveAnalysisAnnotationLabel(name = "", comment = "", kind = "field") {
      const explicitComment = normalizeText(comment);
      if (explicitComment) return explicitComment;
      return inferAnalysisSemanticLabel(name, kind);
    }
    function buildAnalysisDisplayLabel(name = "", comment = "", kind = "field") {
      const normalizedName = normalizeText(name);
      if (!normalizedName) return "";
      const annotation = resolveAnalysisAnnotationLabel(normalizedName, comment, kind);
      return annotation ? `${normalizedName}\uFF08${annotation}\uFF09` : normalizedName;
    }
    function sanitizeAnalysisPlaceholderText(text = "") {
      return normalizeText(text).replace(/[（(]\s*未维护中文注释\s*[)）]/g, "").replace(/([（(][^()（）]*?)[，,]\s*未维护中文注释\s*([)）])/g, "$1$2").replace(/\s*[，,]?\s*未维护中文注释/g, "").replace(/[（(]\s*[)）]/g, "").replace(/\s{2,}/g, " ").trim();
    }
    function buildAnalysisAnnotationContext(context = {}) {
      const tableEntries = [];
      const fieldEntries = [];
      asArray(context.tableSchemas).forEach((table) => {
        const tableName = normalizeText(table?.tableName);
        if (!tableName) return;
        const tableComment = normalizeText(table?.tableComment || table?.comment);
        const shortTableName = tableName.split(".").filter(Boolean).pop() || tableName;
        const tableLabel = buildAnalysisDisplayLabel(tableName, tableComment, "table");
        tableEntries.push({ token: tableName, label: tableLabel, annotated: tableLabel !== tableName });
        if (shortTableName !== tableName) {
          tableEntries.push({
            token: shortTableName,
            label: buildAnalysisDisplayLabel(shortTableName, tableComment, "table"),
            annotated: buildAnalysisDisplayLabel(shortTableName, tableComment, "table") !== shortTableName
          });
        }
        asArray(table.columns).forEach((column) => {
          const columnName = normalizeText(column?.name || column?.columnName);
          if (!columnName) return;
          const columnComment = normalizeText(column?.comment || column?.columnComment);
          const fieldLabel = buildAnalysisDisplayLabel(columnName, columnComment, "field");
          fieldEntries.push({
            token: `${tableName}.${columnName}`,
            label: `${tableName}.${fieldLabel}`,
            annotated: fieldLabel !== columnName
          });
          fieldEntries.push({ token: columnName, label: fieldLabel, annotated: fieldLabel !== columnName });
        });
      });
      asArray(context.availableTables).forEach((table) => {
        const tableName = normalizeText(table?.tableName);
        if (!tableName) return;
        const tableComment = normalizeText(table?.tableComment || table?.comment);
        const shortTableName = tableName.split(".").filter(Boolean).pop() || tableName;
        const tableLabel = buildAnalysisDisplayLabel(tableName, tableComment, "table");
        tableEntries.push({ token: tableName, label: tableLabel, annotated: tableLabel !== tableName });
        if (shortTableName !== tableName) {
          tableEntries.push({
            token: shortTableName,
            label: buildAnalysisDisplayLabel(shortTableName, tableComment, "table"),
            annotated: buildAnalysisDisplayLabel(shortTableName, tableComment, "table") !== shortTableName
          });
        }
      });
      const exactFieldMap = /* @__PURE__ */ new Map();
      fieldEntries.forEach((entry) => {
        if (!entry.token || !entry.label) return;
        const key = entry.token.toLowerCase();
        const existing = exactFieldMap.get(key);
        if (!existing || !existing.annotated && entry.annotated) {
          exactFieldMap.set(key, { label: entry.label, annotated: Boolean(entry.annotated) });
        }
      });
      const exactTableMap = /* @__PURE__ */ new Map();
      tableEntries.forEach((entry) => {
        if (!entry.token || !entry.label) return;
        const key = entry.token.toLowerCase();
        const existing = exactTableMap.get(key);
        if (!existing || !existing.annotated && entry.annotated) {
          exactTableMap.set(key, { label: entry.label, annotated: Boolean(entry.annotated) });
        }
      });
      const replacementEntries = [
        ...Array.from(exactTableMap.entries()).map(([token, entry]) => ({ token, label: entry.label })),
        ...Array.from(exactFieldMap.entries()).map(([token, entry]) => ({ token, label: entry.label }))
      ].sort((left, right) => right.token.length - left.token.length);
      return {
        exactFieldMap,
        exactTableMap,
        replacementEntries
      };
    }
    function annotateAnalysisText(text = "", annotationContext) {
      let nextText = sanitizeAnalysisPlaceholderText(text);
      if (!nextText || !annotationContext?.replacementEntries?.length) {
        return nextText;
      }
      annotationContext.replacementEntries.forEach((entry) => {
        const rawToken = String(entry.token || "");
        const label = String(entry.label || "");
        if (!rawToken || !label) return;
        const pattern = rawToken.includes(".") ? new RegExp(`${escapeRegExp(rawToken)}(?![\uFF08(])`, "g") : new RegExp(`(?<![a-zA-Z0-9_])${escapeRegExp(rawToken)}(?![a-zA-Z0-9_\uFF08(])`, "g");
        nextText = nextText.replace(pattern, label);
      });
      return nextText;
    }
    function annotateAnalysisTokenList(values = [], annotationContext) {
      return uniqueStrings(
        asArray(values).map((value) => {
          const normalizedValue = sanitizeAnalysisPlaceholderText(value);
          if (!normalizedValue) return "";
          return annotationContext?.exactFieldMap?.get(normalizedValue.toLowerCase())?.label || annotationContext?.exactTableMap?.get(normalizedValue.toLowerCase())?.label || annotateAnalysisText(normalizedValue, annotationContext);
        })
      );
    }
    function annotateAnalysisSuggestionItem(item = {}, annotationContext) {
      return {
        ...item,
        analysisPrompt: annotateAnalysisText(item.analysisPrompt, annotationContext),
        businessScenario: annotateAnalysisText(item.businessScenario, annotationContext),
        dimensions: annotateAnalysisTokenList(item.dimensions, annotationContext),
        metrics: annotateAnalysisTokenList(item.metrics, annotationContext),
        filters: uniqueStrings(asArray(item.filters).map((value) => annotateAnalysisText(value, annotationContext))),
        reason: annotateAnalysisText(item.reason, annotationContext),
        caveats: uniqueStrings(asArray(item.caveats).map((value) => annotateAnalysisText(value, annotationContext)))
      };
    }
    function extractAiSuggestionObjects(text = "") {
      const raw = String(text || "");
      const suggestionsKeyIndex = raw.indexOf('"suggestions"');
      if (suggestionsKeyIndex < 0) return [];
      const listStart = raw.indexOf("[", suggestionsKeyIndex);
      if (listStart < 0) return [];
      const suggestions = [];
      let depth = 0;
      let objectStart = -1;
      let inString = false;
      let escaped = false;
      for (let index = listStart + 1; index < raw.length; index += 1) {
        const char = raw[index];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (inString) {
          continue;
        }
        if (char === "{") {
          if (depth === 0) {
            objectStart = index;
          }
          depth += 1;
          continue;
        }
        if (char === "}") {
          depth -= 1;
          if (depth === 0 && objectStart >= 0) {
            const objectText = raw.slice(objectStart, index + 1);
            try {
              suggestions.push(parseJsonObjectWithRecovery(objectText));
            } catch {
            }
            objectStart = -1;
          }
          continue;
        }
        if (char === "]" && depth === 0) {
          break;
        }
      }
      return suggestions;
    }
    function parseAiAnalysisSuggestionPayload(text = "") {
      try {
        return parseJsonObjectWithRecovery(text);
      } catch {
        const suggestions = extractAiSuggestionObjects(text);
        if (!suggestions.length) {
          throw new Error("\u6A21\u578B\u54CD\u5E94\u4E2D\u672A\u627E\u5230\u53EF\u6062\u590D\u7684\u5206\u6790\u5EFA\u8BAE");
        }
        return { suggestions };
      }
    }
    function buildPromptKeywords(payload = {}) {
      return uniqueStrings(
        [payload.prompt, payload.currentSql].map((item) => normalizeText(item).toLowerCase()).join(" ").split(/[^a-z0-9_\u4e00-\u9fa5]+/i).map((item) => item.trim()).filter((item) => item.length >= 2)
      );
    }
    function scoreAiCandidateTable(table, keywords = [], selectedTables = []) {
      const tableName = String(table.tableName || table.name || "");
      const tableComment = String(table.tableComment || table.comment || "");
      const normalizedName = tableName.toLowerCase();
      const normalizedComment = tableComment.toLowerCase();
      let score = selectedTables.some((item) => tableNameMatchesSelection(tableName, item)) ? 1e3 : 0;
      keywords.forEach((keyword) => {
        const lower = keyword.toLowerCase();
        if (normalizedName === lower) score += 30;
        else if (normalizedName.endsWith(`.${lower}`)) score += 24;
        else if (normalizedName.includes(lower)) score += 12;
        if (normalizedComment.includes(lower)) score += 8;
      });
      return score;
    }
    function selectAiCandidateTables(tables = [], payload = {}) {
      const selectedTables = uniqueStrings(payload.selectedTables).slice(0, MAX_AI_SELECTED_TABLES);
      const keywords = buildPromptKeywords(payload);
      const allTables = asArray(tables);
      const selectedSet = new Set(selectedTables.map((item) => normalizeTableNameForMatch(item)));
      const selectedMatches = allTables.filter((item) => selectedTables.some((selected) => tableNameMatchesSelection(item.tableName || item.name, selected)));
      const scored = allTables.filter((item) => !selectedSet.size || selectedTables.some((selected) => tableNameMatchesSelection(item.tableName || item.name, selected))).map((item) => ({ item, score: scoreAiCandidateTable(item, keywords, selectedTables) })).sort((left, right) => right.score - left.score || String(left.item.tableName || "").localeCompare(String(right.item.tableName || ""), "zh-CN")).map((entry) => entry.item);
      const source = selectedSet.size ? scored.length ? scored : selectedMatches : scored;
      const merged = [];
      const seen = /* @__PURE__ */ new Set();
      for (const item of source) {
        const key = normalizeTableNameForMatch(item.tableName || item.name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
      return {
        availableTables: merged.slice(0, MAX_AI_AVAILABLE_TABLES),
        schemaTables: merged.slice(0, MAX_AI_SCHEMA_TABLES)
      };
    }
    function normalizeAiSampleValue(value) {
      if (value instanceof Date) return value.toISOString();
      if (Buffer.isBuffer(value)) return `[binary:${value.length}]`;
      if (typeof value === "string") {
        return value.length > MAX_AI_TABLE_SAMPLE_VALUE_LENGTH ? `${value.slice(0, MAX_AI_TABLE_SAMPLE_VALUE_LENGTH)}...` : value;
      }
      return value;
    }
    function normalizeAiSampleRow(row = {}, columns = []) {
      const columnNames = asArray(columns).map((column) => column.name || column.columnName).filter(Boolean);
      const sourceNames = columnNames.length ? columnNames : Object.keys(row || {});
      return Object.fromEntries(
        sourceNames.filter((name) => Object.prototype.hasOwnProperty.call(row || {}, name)).map((name) => [name, normalizeAiSampleValue(row[name])])
      );
    }
    function buildRandomSampleSql(dataSource, tableName, dialect, limit = MAX_AI_TABLE_SAMPLE_ROWS) {
      const resolved = resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
      const database = resolved.database;
      const schema = resolved.schema || "public";
      const parts = String(tableName || "").split(".").filter(Boolean).map((item) => item.replace(/[`"]/g, ""));
      const name = parts[parts.length - 1] || String(tableName || "").replace(/[`"]/g, "");
      const namespace = parts.length >= 2 ? parts[parts.length - 2] : ["postgresql", "oracle", "dm"].includes(dialect) ? schema : database;
      const qualifiedTable = namespace ? metadataService.escapeIdentifier(`${namespace}.${name}`, dialect) : metadataService.escapeIdentifier(name, dialect);
      const safeLimit = Math.max(1, Math.min(MAX_AI_TABLE_SAMPLE_ROWS, Number(limit || MAX_AI_TABLE_SAMPLE_ROWS) || MAX_AI_TABLE_SAMPLE_ROWS));
      const randomFunction = dialect === "postgresql" ? "RANDOM()" : dialect === "oracle" ? "DBMS_RANDOM.VALUE" : "RAND()";
      const baseSql = `SELECT * FROM ${qualifiedTable} ORDER BY ${randomFunction}`;
      return buildPreviewSql(baseSql, safeLimit, dialect);
    }
    async function loadAiTableSamples(dataSource, tableSchemas = []) {
      const results = [];
      for (const table of asArray(tableSchemas).slice(0, MAX_AI_SELECTED_TABLES)) {
        try {
          const rows = await withReportConnection(dataSource, async (connection, dialect) => {
            const sql = buildRandomSampleSql(dataSource, table.tableName, dialect, MAX_AI_TABLE_SAMPLE_ROWS);
            if (dialect === "mysql") {
              const [resultRows] = await connection.query({
                sql,
                timeout: AI_QUERY_TIMEOUT_MS
              });
              return Array.isArray(resultRows) ? resultRows : [];
            }
            const result = await connection.query(sql);
            return Array.isArray(result.rows) ? result.rows : [];
          });
          results.push({
            tableName: table.tableName,
            rowCount: rows.length,
            sampleRows: rows.map((row) => normalizeAiSampleRow(row, table.columns))
          });
        } catch (error) {
          results.push({
            tableName: table.tableName,
            rowCount: 0,
            sampleRows: [],
            loadError: error.message || "\u6837\u4F8B\u6570\u636E\u8BFB\u53D6\u5931\u8D25"
          });
        }
      }
      return results;
    }
    async function loadAiTableSchemas(dataSource, tables = []) {
      const results = [];
      for (const table of tables) {
        const tableName = table.tableName || table.name;
        try {
          const columns = await metadataService.listColumns(dataSource, tableName);
          results.push({
            tableName,
            tableType: table.tableType || table.type || "",
            tableComment: table.tableComment || table.comment || "",
            columns: asArray(columns).map((column) => ({
              name: column.columnName,
              dataType: column.dataType,
              columnType: column.columnType,
              nullable: Boolean(column.isNullable),
              primaryKey: Boolean(column.isPrimaryKey),
              comment: column.columnComment || ""
            }))
          });
        } catch (error) {
          results.push({
            tableName,
            tableType: table.tableType || table.type || "",
            tableComment: table.tableComment || table.comment || "",
            columns: [],
            loadError: error.message || "\u5B57\u6BB5\u52A0\u8F7D\u5931\u8D25"
          });
        }
      }
      return results;
    }
    function buildAiSqlSystemPrompt(dialect, configuredPrompt = "", variables = {}) {
      const renderedPrompt = renderPromptTemplate(configuredPrompt, {
        dialect,
        sceneCode: AI_SQL_PLAN_SCENE_CODE,
        ...variables
      });
      return [
        renderedPrompt || "\u4F60\u662F\u62A5\u8868\u5E73\u53F0\u4E2D\u7684\u81EA\u7136\u8BED\u8A00\u8F6C SQL \u52A9\u624B\u3002",
        `\u5F53\u524D\u6570\u636E\u5E93 SQL \u65B9\u8A00: ${dialect}\u3002`,
        "\u5FC5\u987B\u4E25\u683C\u4F9D\u636E\u7ED9\u5B9A\u6570\u636E\u6E90\u5143\u6570\u636E\u751F\u6210 SQL\uFF0C\u4E0D\u5141\u8BB8\u81C6\u9020\u4E0D\u5B58\u5728\u7684\u8868\u6216\u5B57\u6BB5\u3002",
        ...buildAiSqlDialectRules(dialect),
        "\u53EA\u80FD\u751F\u6210\u4E00\u6761\u53EA\u8BFB SELECT \u6216 WITH \u67E5\u8BE2 SQL\uFF0C\u4E0D\u80FD\u5305\u542B INSERT\u3001UPDATE\u3001DELETE\u3001DDL\u3001\u5B58\u50A8\u8FC7\u7A0B\u6216\u591A\u8BED\u53E5\u3002",
        "\u4E0D\u8981 SELECT *\uFF0C\u5FC5\u987B\u660E\u786E\u8F93\u51FA\u9002\u5408\u56FE\u8868\u4F7F\u7528\u7684\u7EF4\u5EA6\u5B57\u6BB5\u548C\u6307\u6807\u5B57\u6BB5\u3002",
        "\u5982\u679C\u63D0\u4F9B\u4E86\u8868\u6837\u4F8B\u6570\u636E\uFF0C\u53EF\u4EE5\u53C2\u8003\u6837\u4F8B\u503C\u7406\u89E3\u5B57\u6BB5\u542B\u4E49\uFF0C\u4F46\u4ECD\u5FC5\u987B\u4EE5\u5B57\u6BB5\u7ED3\u6784\u4E3A\u51C6\u3002",
        "\u4F18\u5148\u751F\u6210\u805A\u5408\u67E5\u8BE2\uFF0C\u5E76\u4E3A\u8F93\u51FA\u5B57\u6BB5\u8BBE\u7F6E\u6E05\u6670\u7A33\u5B9A\u7684\u82F1\u6587\u6216\u62FC\u97F3\u522B\u540D\u3002",
        "\u5982\u679C\u9700\u6C42\u4FE1\u606F\u4E0D\u8DB3\uFF0C\u628A questions \u5199\u6E05\u695A\uFF0CgeneratedSql \u53EF\u4EE5\u4E3A\u7A7A\u3002",
        "\u8F93\u51FA\u5FC5\u987B\u662F JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown\uFF0C\u4E0D\u8981\u4EE3\u7801\u5757\u3002",
        JSON.stringify({
          summary: "\u7B80\u77ED\u8BF4\u660E",
          generatedSql: "SQL",
          usedTables: [{ tableName: "\u8868\u540D", reason: "\u4F7F\u7528\u539F\u56E0", columns: ["\u5B57\u6BB5"] }],
          assumptions: ["\u5047\u8BBE"],
          risks: ["\u98CE\u9669"],
          questions: ["\u9700\u8981\u8FFD\u95EE\u7684\u95EE\u9898"],
          confidence: 0.8
        })
      ].filter(Boolean).join("\n");
    }
    function buildAiSqlRevisionSystemPrompt(dialect, configuredPrompt = "", variables = {}) {
      const renderedPrompt = renderPromptTemplate(configuredPrompt, {
        dialect,
        sceneCode: AI_SQL_REVISION_SCENE_CODE,
        ...variables
      });
      return [
        renderedPrompt || "\u4F60\u662F\u62A5\u8868\u5E73\u53F0\u4E2D\u7684 SQL \u4E8C\u6B21\u4FEE\u6539\u52A9\u624B\u3002",
        `\u5F53\u524D\u6570\u636E\u5E93 SQL \u65B9\u8A00: ${dialect}\u3002`,
        "\u5FC5\u987B\u57FA\u4E8E\u7528\u6237\u5F53\u524D SQL\u3001\u4FEE\u6539\u8981\u6C42\u3001\u7ED3\u679C\u753B\u50CF\u548C\u7ED9\u5B9A\u8868\u7ED3\u6784\u505A\u6700\u5C0F\u5FC5\u8981\u4FEE\u6539\u3002",
        ...buildAiSqlDialectRules(dialect),
        "\u53EA\u80FD\u8FD4\u56DE\u4E00\u6761\u53EA\u8BFB SELECT \u6216 WITH \u67E5\u8BE2 SQL\uFF0C\u4E0D\u80FD\u5305\u542B INSERT\u3001UPDATE\u3001DELETE\u3001DDL\u3001\u5B58\u50A8\u8FC7\u7A0B\u6216\u591A\u8BED\u53E5\u3002",
        "\u4E0D\u8981 SELECT *\uFF0C\u5FC5\u987B\u660E\u786E\u8F93\u51FA\u9002\u5408\u56FE\u8868\u4F7F\u7528\u7684\u7EF4\u5EA6\u5B57\u6BB5\u548C\u6307\u6807\u5B57\u6BB5\u3002",
        "\u5982\u679C\u63D0\u4F9B\u4E86\u8868\u6837\u4F8B\u6570\u636E\uFF0C\u53EF\u4EE5\u53C2\u8003\u6837\u4F8B\u503C\u7406\u89E3\u5B57\u6BB5\u542B\u4E49\uFF0C\u4F46\u4ECD\u5FC5\u987B\u4EE5\u5B57\u6BB5\u7ED3\u6784\u4E3A\u51C6\u3002",
        "\u5982\u679C\u65E0\u6CD5\u5B89\u5168\u4FEE\u6539\uFF0C\u628A questions \u5199\u6E05\u695A\uFF0CgeneratedSql \u53EF\u4EE5\u4E3A\u7A7A\u3002",
        "\u8F93\u51FA\u5FC5\u987B\u662F JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown\uFF0C\u4E0D\u8981\u4EE3\u7801\u5757\u3002",
        JSON.stringify({
          summary: "\u7B80\u77ED\u8BF4\u660E",
          generatedSql: "\u4FEE\u6539\u540E\u7684 SQL",
          usedTables: [{ tableName: "\u8868\u540D", reason: "\u4F7F\u7528\u539F\u56E0", columns: ["\u5B57\u6BB5"] }],
          assumptions: ["\u5047\u8BBE"],
          risks: ["\u98CE\u9669"],
          questions: ["\u9700\u8981\u8FFD\u95EE\u7684\u95EE\u9898"],
          confidence: 0.8
        })
      ].filter(Boolean).join("\n");
    }
    function buildAiSqlUserPrompt(payload, context) {
      const datasource = {
        dialect: context.dialect
      };
      return [
        "\u7528\u6237\u62A5\u8868\u9700\u6C42:",
        payload.prompt,
        "",
        "\u5F53\u524D\u53EF\u7528\u8868\uFF08\u6700\u591A80\u5F20\uFF09:",
        JSON.stringify(context.availableTables, null, 2),
        "",
        "\u5019\u9009\u8868\u5B57\u6BB5\u7ED3\u6784\uFF08\u6700\u591A5\u5F20\u8868\uFF09:",
        JSON.stringify(context.tableSchemas, null, 2),
        "",
        context.tableSamples?.length ? [
          "\u5019\u9009\u8868\u968F\u673A\u6837\u4F8B\u6570\u636E\uFF08\u6BCF\u8868\u6700\u591A50\u884C\uFF0C\u5B57\u6BB5\u503C\u6700\u591A100\u5B57\u7B26\uFF09:",
          JSON.stringify(context.tableSamples, null, 2),
          ""
        ].join("\n") : "",
        payload.currentSql ? `\u7528\u6237\u5F53\u524D\u5DF2\u6709 SQL:
${payload.currentSql}` : "",
        "",
        "\u751F\u6210\u8981\u6C42:",
        "1. generatedSql \u53EA\u8FD4\u56DE SQL \u5185\u5BB9\uFF0C\u4E0D\u8981\u5E26\u5206\u53F7\u3002",
        "2. usedTables \u53EA\u80FD\u6765\u81EA\u5019\u9009\u8868\u5B57\u6BB5\u7ED3\u6784\u3002",
        `3. \u5FC5\u987B\u4F7F\u7528 ${context.dialect} \u65B9\u8A00\u751F\u6210 SQL\uFF0C\u4E0D\u5141\u8BB8\u6DF7\u7528\u5176\u4ED6\u6570\u636E\u5E93\u7684\u51FD\u6570\u3001\u7C7B\u578B\u8F6C\u6362\u3001\u65E5\u671F\u683C\u5F0F\u5316\u6216\u5206\u9875\u8BED\u6CD5\u3002`,
        "4. \u5982\u679C\u6D89\u53CA\u5730\u533A\u7EDF\u8BA1\uFF0C\u4F18\u5148\u8BC6\u522B\u5730\u533A\u540D\u79F0\u3001\u7701\u5E02\u540D\u79F0\u6216\u884C\u653F\u533A\u5212\u7F16\u7801\u5B57\u6BB5\u3002",
        "5. \u8FD4\u56DE\u5B57\u6BB5\u6570\u91CF\u5E94\u63A7\u5236\u5728\u56FE\u8868\u53CB\u597D\u7684\u8303\u56F4\u5185\uFF0C\u5E38\u89C1\u7ED3\u6784\u4E3A 1 \u4E2A\u7EF4\u5EA6 + 1 \u5230 2 \u4E2A\u6307\u6807\u3002",
        "",
        "\u53EF\u7528\u4E8E\u63D0\u793A\u8BCD\u53D8\u91CF\u7684\u4E0A\u4E0B\u6587:",
        JSON.stringify({
          datasource,
          tables: context.tableSchemas,
          tableSamples: context.tableSamples || [],
          prompt: payload.prompt,
          currentSql: payload.currentSql || ""
        }, null, 2)
      ].filter(Boolean).join("\n");
    }
    function buildAiSqlRevisionUserPrompt(payload, context) {
      const datasource = {
        dialect: context.dialect
      };
      return [
        "\u7528\u6237\u539F\u59CB\u62A5\u8868\u9700\u6C42:",
        payload.prompt || "",
        "",
        "\u7528\u6237\u5F53\u524D SQL:",
        payload.currentSql || "",
        "",
        "\u7528\u6237\u672C\u6B21\u4FEE\u6539\u8981\u6C42:",
        payload.revisionInstruction || "",
        "",
        payload.lastError ? `\u4E0A\u6B21\u6267\u884C\u9519\u8BEF:
${payload.lastError}` : "",
        "",
        payload.lastQueryProfile ? [
          "\u4E0A\u6B21\u67E5\u8BE2\u7ED3\u679C\u753B\u50CF:",
          JSON.stringify(payload.lastQueryProfile, null, 2),
          ""
        ].join("\n") : "",
        "\u5F53\u524D\u53EF\u7528\u8868\uFF08\u6700\u591A80\u5F20\uFF09:",
        JSON.stringify(context.availableTables, null, 2),
        "",
        "\u5019\u9009\u8868\u5B57\u6BB5\u7ED3\u6784\uFF08\u6700\u591A5\u5F20\u8868\uFF09:",
        JSON.stringify(context.tableSchemas, null, 2),
        "",
        context.tableSamples?.length ? [
          "\u5019\u9009\u8868\u968F\u673A\u6837\u4F8B\u6570\u636E\uFF08\u6BCF\u8868\u6700\u591A50\u884C\uFF0C\u5B57\u6BB5\u503C\u6700\u591A100\u5B57\u7B26\uFF09:",
          JSON.stringify(context.tableSamples, null, 2),
          ""
        ].join("\n") : "",
        "\u4FEE\u6539\u8981\u6C42:",
        "1. generatedSql \u53EA\u8FD4\u56DE\u4FEE\u6539\u540E\u7684 SQL \u5185\u5BB9\uFF0C\u4E0D\u8981\u5E26\u5206\u53F7\u3002",
        "2. \u5C3D\u91CF\u4FDD\u7559\u5F53\u524D SQL \u5DF2\u786E\u8BA4\u7684\u8868\u3001\u8FC7\u6EE4\u6761\u4EF6\u548C\u53E3\u5F84\uFF0C\u53EA\u6309\u7528\u6237\u672C\u6B21\u8981\u6C42\u8C03\u6574\u3002",
        "3. usedTables \u53EA\u80FD\u6765\u81EA\u5019\u9009\u8868\u5B57\u6BB5\u7ED3\u6784\u3002",
        `4. \u5FC5\u987B\u4F7F\u7528 ${context.dialect} \u65B9\u8A00\u4FEE\u590D SQL\uFF0C\u4E0D\u5141\u8BB8\u6DF7\u7528\u5176\u4ED6\u6570\u636E\u5E93\u8BED\u6CD5\u3002`,
        "5. \u5982\u679C\u7ED9\u51FA\u4E86\u4E0A\u6B21\u9519\u8BEF\u4FE1\u606F\uFF0C\u5FC5\u987B\u57FA\u4E8E\u9519\u8BEF\u539F\u56E0\u4FEE\u590D SQL\uFF0C\u800C\u4E0D\u662F\u91CD\u590D\u539F\u9519\u8BEF\u5199\u6CD5\u3002",
        "6. \u8FD4\u56DE\u5B57\u6BB5\u6570\u91CF\u5E94\u63A7\u5236\u5728\u56FE\u8868\u53CB\u597D\u7684\u8303\u56F4\u5185\u3002",
        "",
        "\u53EF\u7528\u4E8E\u63D0\u793A\u8BCD\u53D8\u91CF\u7684\u4E0A\u4E0B\u6587:",
        JSON.stringify({
          datasource,
          tables: context.tableSchemas,
          tableSamples: context.tableSamples || [],
          prompt: payload.prompt || "",
          currentSql: payload.currentSql || "",
          revisionInstruction: payload.revisionInstruction || "",
          lastQueryProfile: payload.lastQueryProfile || null,
          lastError: payload.lastError || ""
        }, null, 2)
      ].filter(Boolean).join("\n");
    }
    function normalizeAiSqlPlan(rawText, parsed, context, provider, validation) {
      const generatedSql = normalizeText(parsed?.generatedSql);
      const availableTableNames = new Set(context.tableSchemas.map((item) => String(item.tableName)));
      const usedTables = asArray(parsed?.usedTables).map((item) => ({
        tableName: normalizeText(item?.tableName),
        reason: normalizeText(item?.reason),
        columns: uniqueStrings(item?.columns)
      })).filter((item) => item.tableName && availableTableNames.has(item.tableName));
      return {
        provider: buildProviderSummary(provider),
        dialect: context.dialect,
        summary: normalizeText(parsed?.summary, generatedSql ? "AI \u5DF2\u751F\u6210\u62A5\u8868\u67E5\u8BE2 SQL" : "AI \u672A\u751F\u6210\u53EF\u6267\u884C SQL"),
        generatedSql,
        usedTables,
        assumptions: uniqueStrings(parsed?.assumptions),
        risks: uniqueStrings(parsed?.risks),
        questions: uniqueStrings(parsed?.questions),
        confidence: Number.isFinite(Number(parsed?.confidence)) ? Number(parsed.confidence) : null,
        validation,
        metadata: {
          availableTables: context.availableTables,
          tableSchemas: context.tableSchemas,
          tableSamples: context.tableSamples || [],
          rawText
        }
      };
    }
    async function validateGeneratedReportSql(dataSource, sql, dialect, availableTables = []) {
      const validation = createAiSqlValidationResult();
      let safeSql = "";
      try {
        safeSql = ensureSafeReportAiSql(sql, dialect);
        validation.syntaxValid = true;
        const referencedTables = extractSqlTables(safeSql, dialect);
        const cteNames = extractCteNames(safeSql, dialect);
        const missingTables = referencedTables.filter((tableName) => {
          const normalizedTableName = normalizeTableNameForMatch(tableName);
          return !cteNames.has(normalizedTableName) && !tableExistsInAvailableTables(tableName, availableTables);
        });
        validation.objectValid = missingTables.length === 0;
        if (missingTables.length) {
          validation.messages.push(...missingTables.map((tableName) => `\u672A\u5728\u5F53\u524D\u6570\u636E\u6E90\u4E2D\u8BC6\u522B\u5230\u8868: ${tableName}`));
        }
        if (validation.objectValid) {
          const explainResult = await explainReportSql(dataSource, safeSql);
          validation.explainValid = explainResult.explainValid;
          validation.messages.push(...explainResult.messages);
        }
        validation.valid = validation.syntaxValid && validation.objectValid && validation.explainValid;
      } catch (error) {
        validation.messages.push(error.message || "SQL \u6821\u9A8C\u5931\u8D25");
      }
      validation.messages = uniqueStrings(validation.messages);
      return {
        validation,
        safeSql
      };
    }
    async function executeAiChartSqlRevisionRound(payload, options = {}) {
      const selectedTables = uniqueStrings(payload.selectedTables).slice(0, MAX_AI_SELECTED_TABLES);
      const dataSource = options.dataSource || await ensureActiveReportDataSource(payload.sourceId);
      const resolved = options.resolved || resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
      const dialect = options.dialect || resolved.dialect || dataSource.sourceType || "mysql";
      const currentSql = sanitizeSqlText(payload.currentSql);
      if (!currentSql) {
        throw new AppError("\u8BF7\u5148\u63D0\u4F9B\u9700\u8981\u4FEE\u590D\u7684 SQL", 400);
      }
      const tables = options.tables || await metadataService.listTables(dataSource);
      const referencedTables = extractSqlTables(currentSql, dialect);
      const candidates = selectAiCandidateTables(tables, {
        prompt: `${payload.prompt || ""} ${payload.revisionInstruction || ""}`,
        currentSql,
        selectedTables: selectedTables.length ? selectedTables : referencedTables
      });
      const tableSchemas = await loadAiTableSchemas(dataSource, candidates.schemaTables);
      const tableSamples = await loadAiTableSamples(dataSource, tableSchemas);
      const context = {
        dialect,
        availableTables: candidates.availableTables.map((item) => ({
          tableName: item.tableName || item.name,
          tableType: item.tableType || item.type || "",
          tableComment: item.tableComment || item.comment || ""
        })),
        tableSchemas,
        tableSamples
      };
      const resolvedAi = await resolveReportingAiProvider(AI_SQL_REVISION_SCENE_CODE);
      const aiConfig = resolvedAi.aiConfig;
      const provider = resolvedAi.provider;
      const completion = await modelProviderService.generateChatCompletion(
        provider,
        [
          {
            role: "system",
            content: buildAiSqlRevisionSystemPrompt(dialect, aiConfig?.systemPrompt || "", {
              datasource: {
                sourceId: Number(payload.sourceId),
                sourceType: dataSource.sourceType,
                sourceName: dataSource.sourceName,
                dialect
              },
              tables: context.tableSchemas,
              tableSamples: context.tableSamples,
              prompt: payload.prompt || "",
              currentSql,
              revisionInstruction: payload.revisionInstruction || "",
              lastQueryProfile: payload.lastQueryProfile || null,
              lastError: payload.lastError || ""
            })
          },
          { role: "user", content: buildAiSqlRevisionUserPrompt({ ...payload, currentSql }, context) }
        ],
        buildAiRuntimeOptions(aiConfig, { maxTokens: 1800 })
      );
      const rawText = completion?.content || "";
      const parsed = parseJsonObjectWithRecovery(rawText);
      const generatedSql = normalizeText(parsed?.generatedSql);
      const validation = createAiSqlValidationResult();
      let safeSql = "";
      if (!generatedSql) {
        validation.messages.push("AI \u672A\u8FD4\u56DE\u53EF\u6267\u884C SQL");
        const result2 = normalizeAiSqlPlan(rawText, parsed, { ...context, dialect }, provider, validation);
        return {
          dataSource,
          dialect,
          tables,
          currentSql,
          provider,
          validation,
          result: result2,
          rawText,
          parsed,
          context,
          selectedTables
        };
      }
      const validationResult = await validateGeneratedReportSql(dataSource, generatedSql, dialect, tables);
      safeSql = validationResult.safeSql;
      Object.assign(validation, validationResult.validation);
      if (safeSql) {
        parsed.generatedSql = safeSql;
      }
      const result = normalizeAiSqlPlan(rawText, parsed, { ...context, dialect }, provider, validation);
      return {
        dataSource,
        dialect,
        tables,
        currentSql,
        provider,
        validation,
        result,
        rawText,
        parsed,
        context,
        selectedTables
      };
    }
    async function attemptAutoReviseAiChartSql(payload, options = {}) {
      const reason = uniqueStrings([
        normalizeText(payload.lastError),
        ...asArray(options.validationMessages)
      ]).join("\uFF1B");
      const revisionInstruction = payload.revisionInstruction || buildAiSqlAutoRevisionInstruction(options.dialect || "mysql", reason);
      try {
        const revision = await executeAiChartSqlRevisionRound({
          ...payload,
          currentSql: payload.currentSql,
          revisionInstruction,
          lastError: reason || payload.lastError || ""
        }, options);
        return {
          success: true,
          revision
        };
      } catch (error) {
        return {
          success: false,
          error
        };
      }
    }
    async function previewValidatedAiChartQuery(dataSource, sourceSql, limit) {
      const explainResult = await explainReportSql(dataSource, sourceSql);
      if (!explainResult.explainValid) {
        throw new AppError(explainResult.messages.join("\uFF1B") || "SQL \u6267\u884C\u8BA1\u5212\u6821\u9A8C\u672A\u901A\u8FC7", 400);
      }
      const preview = await previewAiSqlStructure(dataSource, sourceSql, limit);
      return {
        explainResult,
        preview
      };
    }
    function isNumericDataType(dataType = "") {
      return /(int|decimal|numeric|number|double|float|real|money|bigint|smallint|tinyint)/i.test(String(dataType || ""));
    }
    function isTimeDataType(dataType = "") {
      return /(date|time|timestamp|year)/i.test(String(dataType || ""));
    }
    function isGeoDimensionFieldName(name = "") {
      const raw = String(name || "").trim();
      if (!raw) return false;
      const normalized = raw.toLowerCase();
      return /(adcode|province(?:_?(name|code))?|city(?:_?(name|code))?|region(?:_?(name|code))?|district(?:_?(name|code))?|county(?:_?(name|code))?)/i.test(normalized) || /行政区划|行政区|地区|区域|省份|城市|地市|区县|县区|省代码|省编码|市代码|市编码/.test(raw);
    }
    function isGeoMappingField(field = {}) {
      return isGeoDimensionFieldName(`${field?.columnName || field?.name || ""} ${field?.label || ""}`);
    }
    function looksLikeDate(value) {
      return typeof value === "string" && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value.trim());
    }
    function looksLikeNumber(value) {
      if (typeof value === "number") return Number.isFinite(value);
      if (value === null || value === void 0 || value === "") return false;
      return /^-?\d+(?:\.\d+)?$/.test(String(value).trim());
    }
    function profileAiResult(fields = [], sampleRows = [], rowCount = 0) {
      const rows = asArray(sampleRows);
      const profiles = asArray(fields).map((field) => {
        const columnName = field.columnName || field.name;
        const values = rows.map((row) => row?.[columnName]).filter((value) => value !== null && value !== void 0 && value !== "");
        const distinctValues = uniqueStrings(values.map((value) => String(value))).slice(0, 20);
        const numericValues = values.filter(looksLikeNumber);
        const dateValues = values.filter(looksLikeDate);
        const dataType = String(field.dataType || "").trim().toLowerCase();
        const role = isGeoDimensionFieldName(columnName) ? "dimension" : isNumericDataType(dataType) || values.length > 0 && numericValues.length / values.length >= 0.8 ? "metric" : isTimeDataType(dataType) || values.length > 0 && dateValues.length / values.length >= 0.8 ? "time" : "dimension";
        return {
          columnName,
          label: field.label || columnName,
          dataType: dataType || field.dataType || "string",
          role,
          semanticType: isGeoDimensionFieldName(columnName) ? "geo" : null,
          distinctCount: distinctValues.length,
          sampleValues: distinctValues.slice(0, 8)
        };
      }).filter((item) => item.columnName);
      return {
        rowCount: Number(rowCount || rows.length || 0),
        sampleCount: rows.length,
        fields: profiles,
        dimensions: profiles.filter((item) => item.role === "dimension"),
        metrics: profiles.filter((item) => item.role === "metric"),
        timeFields: profiles.filter((item) => item.role === "time"),
        geographyFields: profiles.filter((item) => item.semanticType === "geo")
      };
    }
    function enrichPreviewFieldsWithProfile(fields = [], profile) {
      const profileMap = new Map(asArray(profile?.fields).map((item) => [item.columnName, item]));
      return asArray(fields).map((field) => {
        const matched = profileMap.get(field.columnName);
        return {
          ...field,
          role: matched?.role || field.role || "dimension"
        };
      });
    }
    function pickFieldName(fields = [], preferred = []) {
      const list = asArray(fields);
      for (const matcher of preferred) {
        const found = list.find((item) => {
          const text = `${item.columnName || ""} ${item.label || ""}`.toLowerCase();
          return typeof matcher === "function" ? matcher(item) : text.includes(String(matcher).toLowerCase());
        });
        if (found?.columnName) return found.columnName;
      }
      return list[0]?.columnName || null;
    }
    function findChartAssetByFamily(chartAssets = [], family = "") {
      const normalizedFamily = normalizeChartFamily(family);
      return asArray(chartAssets).find((asset) => asset.status !== "inactive" && normalizeChartAssetFamily(asset) === normalizedFamily) || asArray(chartAssets).find((asset) => asset.status !== "inactive" && normalizeChartAssetFamily(asset) === "bar") || asArray(chartAssets).find((asset) => asset.status !== "inactive") || null;
    }
    function buildRecommendationEntry(chartAssets, family, title, reason, score, fieldMap, widgetType = "chart") {
      const normalizedFamily = normalizeChartFamily(family);
      const asset = widgetType === "chart" ? findChartAssetByFamily(chartAssets, normalizedFamily) : null;
      return {
        chartFamily: normalizedFamily,
        chartAssetId: asset?.id || null,
        chartName: asset?.chartName || (widgetType === "kpi" ? "\u6307\u6807\u770B\u677F" : widgetType === "table" ? "\u660E\u7EC6\u8868" : title),
        widgetType,
        title,
        reason,
        score,
        fieldMap
      };
    }
    function getChartAssetMappingFields(asset = null) {
      const fields = asset?.mappingSchema && typeof asset.mappingSchema === "object" ? asset.mappingSchema.fields : [];
      return Array.isArray(fields) ? fields : [];
    }
    function resolveMappingFieldRole(field = {}) {
      if (isGeoMappingField(field)) return "dimension";
      const role = String(field?.role || "").toLowerCase();
      if (role) return role;
      const dataType = String(field?.dataType || field?.type || "").toLowerCase();
      if (/(int|decimal|numeric|number|double|float|real|money|bigint|smallint|tinyint)/i.test(dataType)) return "metric";
      if (/(date|time|timestamp|year)/i.test(dataType)) return "time";
      return "dimension";
    }
    function fieldRoleMatchesAcceptedRole(role, acceptedRole) {
      const accepted = String(acceptedRole || "").toLowerCase();
      if (!accepted) return true;
      if (accepted === role) return true;
      if (accepted === "value" && role === "metric") return true;
      if (accepted === "category" && role === "dimension") return true;
      return false;
    }
    function applyDefaultFieldMapBySchema(currentFieldMap = {}, asset = null, fields = []) {
      const mappingFields = getChartAssetMappingFields(asset);
      if (!mappingFields.length || !Array.isArray(fields) || !fields.length) {
        return { ...currentFieldMap || {} };
      }
      const nextFieldMap = { ...currentFieldMap || {} };
      const availableFields = fields.filter((item) => item?.columnName);
      const fieldMap = new Map(availableFields.map((item) => [item.columnName, item]));
      const hasField = (fieldName) => Boolean(fieldName && fieldMap.has(fieldName));
      const isAccepted = (fieldName, acceptedRoles = []) => {
        if (!fieldName) return false;
        if (!acceptedRoles.length) return true;
        const field = fieldMap.get(fieldName);
        if (!field) return false;
        const role = resolveMappingFieldRole(field);
        return acceptedRoles.some((item) => fieldRoleMatchesAcceptedRole(role, item));
      };
      const pickField = (acceptedRoles = [], options = {}) => {
        const exclude = new Set(asArray(options.exclude).filter(Boolean));
        const preferMetric = Boolean(options.preferMetric);
        const preferGeo = Boolean(options.preferGeo);
        if (preferGeo) {
          const geoField = availableFields.find((item) => {
            if (exclude.has(item.columnName)) return false;
            return isGeoMappingField(item) && isAccepted(item.columnName, acceptedRoles);
          });
          if (geoField?.columnName) return geoField.columnName;
        }
        if (preferMetric) {
          const metricField = availableFields.find((item) => {
            if (exclude.has(item.columnName)) return false;
            return ["metric", "value"].includes(resolveMappingFieldRole(item)) && isAccepted(item.columnName, acceptedRoles);
          });
          if (metricField?.columnName) return metricField.columnName;
        }
        return availableFields.find((item) => !exclude.has(item.columnName) && isAccepted(item.columnName, acceptedRoles))?.columnName || "";
      };
      for (const field of mappingFields) {
        if (!field?.key) continue;
        if (hasField(nextFieldMap[field.key])) {
          continue;
        }
        const acceptedRoles = Array.isArray(field.acceptRoles) ? field.acceptRoles : [];
        const preferGeo = field.key === "mapField";
        const preferMetric = !preferGeo && acceptedRoles.some((item) => ["metric", "value"].includes(String(item || "").toLowerCase()));
        const exclude = preferMetric ? Object.entries(nextFieldMap).filter(([key, value]) => key !== field.key && value).map(([, value]) => value) : [];
        nextFieldMap[field.key] = pickField(acceptedRoles, { exclude, preferMetric, preferGeo });
      }
      return nextFieldMap;
    }
    function validateRecommendationFieldMap(recommendation, chartAssets = [], profile = {}) {
      const availableFields = new Set(asArray(profile?.fields).map((item) => item.columnName).filter(Boolean));
      const fieldMap = recommendation?.fieldMap && typeof recommendation.fieldMap === "object" ? recommendation.fieldMap : {};
      const messages = [];
      let valid = true;
      if (recommendation?.widgetType === "table") {
        return { valid: true, messages: [], missingRequiredKeys: [], unknownFields: [] };
      }
      const asset = recommendation?.chartAssetId ? chartAssets.find((item) => Number(item.id) === Number(recommendation.chartAssetId)) : null;
      const mappingFields = recommendation?.widgetType === "kpi" ? [{ key: "valueField", required: true }] : getChartAssetMappingFields(asset);
      const missingRequiredKeys = mappingFields.filter((item) => item.required !== false && !fieldMap[item.key]).map((item) => item.key);
      const unknownFields = Object.entries(fieldMap).filter(([, value]) => value && !availableFields.has(value)).map(([key, value]) => ({ key, value }));
      if (missingRequiredKeys.length) {
        valid = false;
        messages.push(`\u5B57\u6BB5\u6620\u5C04\u7F3A\u5C11\u5FC5\u586B\u9879: ${missingRequiredKeys.join(", ")}`);
      }
      if (unknownFields.length) {
        valid = false;
        messages.push(`\u5B57\u6BB5\u6620\u5C04\u5305\u542B\u67E5\u8BE2\u7ED3\u679C\u4E2D\u4E0D\u5B58\u5728\u7684\u5B57\u6BB5: ${unknownFields.map((item) => `${item.key}=${item.value}`).join(", ")}`);
      }
      return {
        valid,
        messages,
        missingRequiredKeys,
        unknownFields
      };
    }
    function attachFieldMapValidation(recommendations = [], chartAssets = [], profile = {}) {
      return asArray(recommendations).map((item) => ({
        ...item,
        fieldMapValidation: validateRecommendationFieldMap(item, chartAssets, profile)
      }));
    }
    function buildDeterministicRecommendations(profile, chartAssets = [], prompt = "") {
      const metrics = asArray(profile?.metrics);
      const dimensions = asArray(profile?.dimensions);
      const timeFields = asArray(profile?.timeFields);
      const geoFields = asArray(profile?.geographyFields);
      const firstMetric = pickFieldName(metrics);
      const secondMetric = metrics.find((item) => item.columnName !== firstMetric)?.columnName || null;
      const firstDimension = pickFieldName(dimensions);
      const firstTime = pickFieldName(timeFields);
      const firstGeo = pickFieldName(geoFields);
      const rowCount = Number(profile?.rowCount || 0);
      const recommendations = [];
      if (firstTime && firstMetric) {
        recommendations.push(buildRecommendationEntry(
          chartAssets,
          "line",
          "\u8D8B\u52BF\u6298\u7EBF\u56FE",
          "\u67E5\u8BE2\u7ED3\u679C\u5305\u542B\u65F6\u95F4\u5B57\u6BB5\u548C\u6307\u6807\u5B57\u6BB5\uFF0C\u9002\u5408\u89C2\u5BDF\u8D8B\u52BF\u53D8\u5316\u3002",
          0.95,
          { xField: firstTime, yField: firstMetric, ...secondMetric ? { yField2: secondMetric } : {} }
        ));
        recommendations.push(buildRecommendationEntry(
          chartAssets,
          "area",
          "\u8D8B\u52BF\u9762\u79EF\u56FE",
          "\u9002\u5408\u7A81\u51FA\u6307\u6807\u968F\u65F6\u95F4\u53D8\u5316\u7684\u89C4\u6A21\u548C\u7D2F\u8BA1\u611F\u3002",
          0.86,
          { xField: firstTime, yField: firstMetric }
        ));
      }
      if (firstGeo && firstMetric) {
        recommendations.push(buildRecommendationEntry(
          chartAssets,
          "map",
          "\u533A\u57DF\u5730\u56FE",
          "\u67E5\u8BE2\u7ED3\u679C\u5305\u542B\u5730\u533A\u5B57\u6BB5\u548C\u6307\u6807\u5B57\u6BB5\uFF0C\u9002\u5408\u505A\u533A\u57DF\u5206\u5E03\u5206\u6790\u3002",
          /地区|区域|地图|省|城市|city|province/i.test(prompt) ? 0.96 : 0.9,
          { mapField: firstGeo, valueField: firstMetric }
        ));
      }
      if (firstDimension && firstMetric) {
        recommendations.push(buildRecommendationEntry(
          chartAssets,
          "bar",
          "\u5206\u7C7B\u67F1\u5F62\u56FE",
          "\u4E00\u7EF4\u5206\u7C7B\u548C\u6307\u6807\u5B57\u6BB5\u9002\u5408\u505A\u6A2A\u5411\u6BD4\u8F83\u3002",
          0.88,
          { xField: firstDimension, yField: firstMetric, ...secondMetric ? { yField2: secondMetric } : {} }
        ));
        recommendations.push(buildRecommendationEntry(
          chartAssets,
          "horizontalBar",
          "\u6392\u540D\u6761\u5F62\u56FE",
          "\u5206\u7C7B\u8F83\u591A\u6216\u6392\u540D\u573A\u666F\u4E0B\u6A2A\u5411\u6761\u5F62\u56FE\u66F4\u6613\u9605\u8BFB\u3002",
          0.84,
          { yField: firstDimension, xField: firstMetric }
        ));
        if (rowCount > 0 && rowCount <= 12) {
          recommendations.push(buildRecommendationEntry(
            chartAssets,
            "pie",
            "\u5360\u6BD4\u997C\u56FE",
            "\u5206\u7C7B\u6570\u91CF\u8F83\u5C11\u65F6\u53EF\u7528\u4E8E\u5C55\u793A\u5360\u6BD4\u7ED3\u6784\u3002",
            0.76,
            { nameField: firstDimension, valueField: firstMetric }
          ));
        }
      }
      if (firstMetric && secondMetric && (firstTime || firstDimension)) {
        const xField = firstTime || firstDimension;
        recommendations.push(buildRecommendationEntry(
          chartAssets,
          "combo",
          "\u7EC4\u5408\u56FE",
          "\u591A\u6307\u6807\u7ED3\u679C\u9002\u5408\u7528\u67F1\u7EBF\u7EC4\u5408\u5BF9\u6BD4\u4E3B\u6B21\u6307\u6807\u3002",
          0.8,
          { xField, barField: firstMetric, lineField: secondMetric }
        ));
      }
      if (!firstDimension && firstMetric) {
        recommendations.push(buildRecommendationEntry(
          chartAssets,
          "kpi",
          "\u6307\u6807\u5361",
          "\u7ED3\u679C\u4EE5\u5355\u6307\u6807\u6216\u5C11\u91CF\u6307\u6807\u4E3A\u4E3B\uFF0C\u9002\u5408\u4F5C\u4E3A\u5173\u952E\u6307\u6807\u5361\u3002",
          0.82,
          { valueField: firstMetric },
          "kpi"
        ));
      }
      recommendations.push(buildRecommendationEntry(
        chartAssets,
        "table",
        "\u7ED3\u679C\u660E\u7EC6\u8868",
        "\u4FDD\u7559\u67E5\u8BE2\u7ED3\u679C\u660E\u7EC6\uFF0C\u4FBF\u4E8E\u5BA1\u6838\u5B57\u6BB5\u548C\u6570\u636E\u3002",
        0.55,
        {},
        "table"
      ));
      const unique = [];
      const seen = /* @__PURE__ */ new Set();
      recommendations.filter((item) => item.widgetType !== "chart" || item.chartAssetId).sort((left, right) => Number(right.score || 0) - Number(left.score || 0)).forEach((item) => {
        const key = `${item.widgetType}:${item.chartFamily}:${item.chartAssetId || ""}`;
        if (seen.has(key)) return;
        seen.add(key);
        unique.push(item);
      });
      return unique.slice(0, 6);
    }
    function normalizeAiRecommendations(parsed, fallbackRecommendations, chartAssets, profile) {
      const fallbackByFamily = new Map(fallbackRecommendations.map((item) => [normalizeChartFamily(item.chartFamily || item.widgetType), item]));
      const normalized = asArray(parsed?.recommendations).map((item) => {
        const widgetType = ["kpi", "table"].includes(String(item?.widgetType || "").toLowerCase()) ? String(item.widgetType).toLowerCase() : "chart";
        const family = widgetType === "chart" ? normalizeChartFamily(item?.chartFamily) : widgetType;
        if (widgetType === "chart" && !AI_SUPPORTED_CHART_FAMILIES.includes(family)) return null;
        const fallback = fallbackByFamily.get(family) || fallbackRecommendations[0];
        let asset = null;
        if (widgetType === "chart") {
          const requestedAsset = item?.chartAssetId ? chartAssets.find((assetItem) => Number(assetItem.id) === Number(item.chartAssetId)) : null;
          asset = requestedAsset && normalizeChartAssetFamily(requestedAsset) === family ? requestedAsset : findChartAssetByFamily(chartAssets, family);
        }
        if (widgetType === "chart" && !asset) return null;
        return {
          chartFamily: family,
          chartAssetId: asset?.id || null,
          chartName: asset?.chartName || fallback?.chartName || "",
          widgetType,
          title: normalizeText(item?.title, fallback?.title || asset?.chartName || "AI \u63A8\u8350\u56FE\u8868"),
          reason: normalizeText(item?.reason, fallback?.reason || "\u57FA\u4E8E\u67E5\u8BE2\u7ED3\u679C\u5B57\u6BB5\u753B\u50CF\u63A8\u8350"),
          score: Number.isFinite(Number(item?.score)) ? Number(item.score) : fallback?.score || 0.7,
          fieldMap: {
            ...fallback?.fieldMap || {},
            ...item?.fieldMap && typeof item.fieldMap === "object" ? item.fieldMap : {}
          }
        };
      }).filter(Boolean);
      const merged = [];
      const seen = /* @__PURE__ */ new Set();
      [...normalized, ...fallbackRecommendations].forEach((item) => {
        const key = `${item.widgetType}:${item.chartFamily}:${item.chartAssetId || ""}:${JSON.stringify(item.fieldMap || {})}`;
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(item);
      });
      return merged.filter((item) => item.widgetType !== "chart" || item.chartAssetId).sort((left, right) => Number(right.score || 0) - Number(left.score || 0)).slice(0, 6).map((item, index) => ({ ...item, rank: index + 1, profileSummary: index === 0 ? {
        dimensions: asArray(profile?.dimensions).map((field) => field.columnName),
        metrics: asArray(profile?.metrics).map((field) => field.columnName),
        timeFields: asArray(profile?.timeFields).map((field) => field.columnName),
        geographyFields: asArray(profile?.geographyFields).map((field) => field.columnName)
      } : void 0 }));
    }
    function buildAiRecommendationSystemPrompt(configuredPrompt = "", variables = {}) {
      const renderedPrompt = renderPromptTemplate(configuredPrompt, {
        sceneCode: AI_CHART_RECOMMENDATION_SCENE_CODE,
        supportedChartFamilies: AI_SUPPORTED_CHART_FAMILIES,
        ...variables
      });
      return [
        renderedPrompt || "\u4F60\u662F\u62A5\u8868\u5E73\u53F0\u4E2D\u7684\u56FE\u8868\u63A8\u8350\u52A9\u624B\u3002",
        "\u5FC5\u987B\u7ED3\u5408\u67E5\u8BE2\u7ED3\u679C\u5B57\u6BB5\u753B\u50CF\u548C\u5E73\u53F0\u652F\u6301\u7684\u56FE\u8868\u65CF\u63A8\u8350\u53EF\u843D\u5730\u7684\u56FE\u8868\u3002",
        `\u5F53\u524D\u652F\u6301\u7684 chartFamily: ${AI_SUPPORTED_CHART_FAMILIES.join(", ")}\u3002`,
        "\u4E0D\u8981\u63A8\u8350\u5F53\u524D\u5E73\u53F0\u4E0D\u652F\u6301\u7684\u56FE\u8868\u7C7B\u578B\uFF0C\u4E0D\u8981\u7F16\u9020\u5B57\u6BB5\u3002",
        "fieldMap \u5FC5\u987B\u53EA\u4F7F\u7528\u5B57\u6BB5\u753B\u50CF\u4E2D\u5B58\u5728\u7684 columnName\u3002",
        "\u8F93\u51FA\u5FC5\u987B\u662F JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown\uFF0C\u4E0D\u8981\u4EE3\u7801\u5757\u3002",
        JSON.stringify({
          recommendations: [{
            chartFamily: "bar",
            widgetType: "chart",
            title: "\u56FE\u8868\u6807\u9898",
            reason: "\u63A8\u8350\u539F\u56E0",
            score: 0.9,
            fieldMap: { xField: "\u5B57\u6BB5", yField: "\u5B57\u6BB5" }
          }]
        })
      ].filter(Boolean).join("\n");
    }
    function buildAiRecommendationUserPrompt(payload, profile, fallbackRecommendations) {
      return [
        "\u7528\u6237\u539F\u59CB\u9700\u6C42:",
        payload.prompt || "",
        "",
        "\u67E5\u8BE2\u7ED3\u679C\u5B57\u6BB5\u753B\u50CF:",
        JSON.stringify(profile, null, 2),
        "",
        "\u89C4\u5219\u5F15\u64CE\u5019\u9009\u63A8\u8350:",
        JSON.stringify(fallbackRecommendations, null, 2),
        "",
        "\u8BF7\u5728\u5019\u9009\u57FA\u7840\u4E0A\u8FD4\u56DE 1 \u5230 5 \u4E2A\u63A8\u8350\uFF0C\u4F18\u5148\u4FDD\u8BC1\u5B57\u6BB5\u6620\u5C04\u53EF\u6267\u884C\u3002"
      ].join("\n");
    }
    function buildAiFieldMapSystemPrompt(configuredPrompt = "", variables = {}) {
      const renderedPrompt = renderPromptTemplate(configuredPrompt, {
        sceneCode: AI_CHART_FIELD_MAP_SCENE_CODE,
        ...variables
      });
      return [
        renderedPrompt || "\u4F60\u662F\u62A5\u8868\u5E73\u53F0\u4E2D\u7684\u56FE\u8868\u5B57\u6BB5\u6620\u5C04\u52A9\u624B\u3002",
        "\u5FC5\u987B\u6839\u636E\u76EE\u6807\u56FE\u8868\u98CE\u683C\u7684\u5B57\u6BB5\u8981\u6C42\uFF0C\u4ECE\u67E5\u8BE2\u7ED3\u679C\u5B57\u6BB5\u4E2D\u5206\u914D\u6700\u5408\u9002\u7684\u5206\u7C7B\u5B57\u6BB5\u3001\u6307\u6807\u5B57\u6BB5\u3001\u65F6\u95F4\u5B57\u6BB5\u7B49\u3002",
        "\u4F18\u5148\u7ED3\u5408\u5B57\u6BB5\u753B\u50CF\u3001\u5B57\u6BB5\u540D\u8BED\u4E49\u3001\u6837\u4F8B\u6570\u636E\u548C\u7528\u6237\u539F\u59CB\u9700\u6C42\u5224\u65AD\uFF0C\u4E0D\u8981\u673A\u68B0\u6309\u6570\u636E\u7C7B\u578B\u731C\u6D4B\u3002",
        "\u53EA\u80FD\u4F7F\u7528\u67E5\u8BE2\u7ED3\u679C\u4E2D\u5B58\u5728\u7684 columnName\uFF0C\u4E0D\u8981\u7F16\u9020\u5B57\u6BB5\u3002",
        "\u8F93\u51FA\u5FC5\u987B\u662F JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown\uFF0C\u4E0D\u8981\u4EE3\u7801\u5757\u3002",
        JSON.stringify({
          fieldMap: {
            xField: "\u5B57\u6BB5\u540D",
            yField: "\u5B57\u6BB5\u540D"
          },
          reason: "\u4E3A\u4EC0\u4E48\u8FD9\u6837\u5206\u914D"
        })
      ].filter(Boolean).join("\n");
    }
    function buildAiFieldMapUserPrompt(payload, profile, asset, fallbackFieldMap = {}) {
      return [
        "\u7528\u6237\u539F\u59CB\u9700\u6C42:",
        payload.prompt || "",
        "",
        "\u76EE\u6807\u56FE\u8868\u8D44\u4EA7:",
        JSON.stringify({
          chartAssetId: asset?.id || null,
          chartName: asset?.chartName || "",
          chartCode: asset?.chartCode || "",
          chartFamily: normalizeChartAssetFamily(asset),
          variantName: asset?.variantName || asset?.config?.variantName || "",
          mappingSchema: asset?.mappingSchema || {}
        }, null, 2),
        "",
        "\u67E5\u8BE2\u7ED3\u679C\u5B57\u6BB5\u753B\u50CF:",
        JSON.stringify(profile, null, 2),
        "",
        "\u67E5\u8BE2\u6837\u4F8B\u6570\u636E\uFF08\u8282\u9009\uFF09:",
        JSON.stringify(asArray(payload.sampleRows).slice(0, 20), null, 2),
        "",
        "\u5F53\u524D\u9ED8\u8BA4\u5B57\u6BB5\u6620\u5C04:",
        JSON.stringify(fallbackFieldMap, null, 2),
        "",
        "\u8BF7\u8FD4\u56DE\u6700\u5408\u9002\u7684 fieldMap\uFF0C\u4FDD\u8BC1\u5B57\u6BB5\u89D2\u8272\u548C\u56FE\u8868\u8981\u6C42\u5339\u914D\u3002"
      ].join("\n");
    }
    async function previewDatasetStructure(dataSource, datasetType, sourceTable, sourceSql, limit) {
      if (datasetType === "table") {
        if (!sourceTable) {
          throw new AppError("\u8BF7\u9009\u62E9\u6E90\u8868", 400);
        }
        const [fields, rows] = await Promise.all([
          metadataService.listColumns(dataSource, sourceTable),
          metadataService.sampleRows(dataSource, sourceTable, limit)
        ]);
        return {
          fields: fields.map((field) => ({
            columnName: field.columnName,
            label: field.columnComment || field.columnName,
            dataType: String(field.dataType || "string").trim().toLowerCase(),
            role: inferFieldRoleFromDataType(field.dataType, field.columnName || field.columnComment),
            aggregation: null,
            visible: true
          })),
          sampleRows: rows,
          rowCount: rows.length
        };
      }
      return withReportConnection(dataSource, async (connection, dialect) => {
        const previewSql = buildPreviewSql(sourceSql, limit, dialect);
        if (dialect === "mysql") {
          const [rows, fields] = await connection.query(previewSql);
          const sampleRows2 = Array.isArray(rows) ? rows : [];
          const inferred2 = inferPreviewColumns((fields || []).map((item) => item.name), sampleRows2);
          return {
            fields: inferred2.map((field) => ({
              ...field,
              role: field.role || inferFieldRoleFromDataType(field.dataType, field.columnName || field.label),
              aggregation: null,
              visible: true
            })),
            sampleRows: sampleRows2,
            rowCount: sampleRows2.length
          };
        }
        const result = await connection.query(previewSql);
        const sampleRows = Array.isArray(result.rows) ? result.rows : [];
        const inferred = inferPreviewColumns((result.fields || []).map((item) => item.name), sampleRows);
        return {
          fields: inferred.map((field) => ({
            ...field,
            role: field.role || inferFieldRoleFromDataType(field.dataType, field.columnName || field.label),
            aggregation: null,
            visible: true
          })),
          sampleRows,
          rowCount: sampleRows.length
        };
      });
    }
    async function previewAiSqlStructure(dataSource, sourceSql, limit = MAX_AI_SAMPLE_ROWS) {
      return withReportConnection(dataSource, async (connection, dialect) => {
        const previewSql = buildPreviewSql(sourceSql, Math.max(1, Math.min(MAX_AI_QUERY_LIMIT, Number(limit || MAX_AI_SAMPLE_ROWS) || MAX_AI_SAMPLE_ROWS)), dialect);
        if (dialect === "mysql") {
          const [rows, fields] = await connection.query({
            sql: previewSql,
            timeout: AI_QUERY_TIMEOUT_MS
          });
          const sampleRows2 = Array.isArray(rows) ? rows : [];
          const inferred2 = inferPreviewColumns((fields || []).map((item) => item.name), sampleRows2);
          return {
            fields: inferred2.map((field) => ({
              ...field,
              role: field.role || inferFieldRoleFromDataType(field.dataType, field.columnName || field.label),
              aggregation: null,
              visible: true
            })),
            sampleRows: sampleRows2,
            rowCount: sampleRows2.length
          };
        }
        const result = await connection.query(previewSql);
        const sampleRows = Array.isArray(result.rows) ? result.rows : [];
        const inferred = inferPreviewColumns((result.fields || []).map((item) => item.name), sampleRows);
        return {
          fields: inferred.map((field) => ({
            ...field,
            role: field.role || inferFieldRoleFromDataType(field.dataType, field.columnName || field.label),
            aggregation: null,
            visible: true
          })),
          sampleRows,
          rowCount: sampleRows.length
        };
      });
    }
    async function ensureBuiltinChartAssets() {
      const existing = await repository.listReportChartAssets();
      const existingMap = new Map(existing.map((item) => [item.chartCode, item]));
      for (const asset of buildDefaultChartAssets()) {
        const matched = existingMap.get(asset.chartCode);
        if (!matched) {
          await repository.createReportChartAsset(asset);
          continue;
        }
        await repository.updateReportChartAsset(matched.id, { ...matched, ...asset });
      }
    }
    async function ensureBuiltinThemeTemplates() {
      const existing = await repository.listReportThemeTemplates();
      const existingMap = new Map(existing.map((item) => [item.themeCode, item]));
      for (const template of BUILTIN_THEME_TEMPLATES) {
        const matched = existingMap.get(template.themeCode);
        if (!matched) {
          await repository.createReportThemeTemplate(template);
          continue;
        }
        if (!matched.isBuiltin) {
          continue;
        }
        const shouldRefreshBuiltinTemplate = [
          "clean-card",
          "soft-panel",
          "slate-card",
          "boardroom-silver",
          "executive-ink",
          "capital-blueprint",
          "warm-paper",
          "violet-glow",
          "highlight-frame",
          "glass-minimal",
          "neon-frame",
          "progress-focus"
        ].includes(template.themeCode);
        const needsHorizontalBarBackfill = template.chartVariants?.horizontalBar && (!matched.chartVariants || !matched.chartVariants.horizontalBar);
        const needsLineBackfill = template.chartVariants?.line && (!matched.chartVariants || !matched.chartVariants.line);
        const needsRadarBackfill = template.chartVariants?.radar && (!matched.chartVariants || !matched.chartVariants.radar);
        const needsSankeyBackfill = template.chartVariants?.sankey && (!matched.chartVariants || !matched.chartVariants.sankey);
        const needsGaugeBackfill = template.chartVariants?.gauge && (!matched.chartVariants || !matched.chartVariants.gauge);
        const needsFunnelBackfill = template.chartVariants?.funnel && (!matched.chartVariants || !matched.chartVariants.funnel);
        const needsWordCloudBackfill = template.chartVariants?.wordCloud && (!matched.chartVariants || !matched.chartVariants.wordCloud);
        const needsScatterBackfill = template.chartVariants?.scatter && (!matched.chartVariants || !matched.chartVariants.scatter);
        const needsDashboardTitleColorBackfill = template.canvas?.dashboardTitleColor && (!matched.canvas || !matched.canvas.dashboardTitleColor);
        const expectedMapVariant = template.chartVariants?.map || null;
        const matchedMapVariant = matched.chartVariants?.map || null;
        const needsMapRefresh = !!expectedMapVariant && JSON.stringify({
          regionPalette: Array.isArray(matchedMapVariant?.regionPalette) ? matchedMapVariant.regionPalette : null,
          regionBorderColor: matchedMapVariant?.regionBorderColor || null,
          labelColor: matchedMapVariant?.labelColor || null,
          visualMapTextColor: matchedMapVariant?.visualMapTextColor || null
        }) !== JSON.stringify({
          regionPalette: Array.isArray(expectedMapVariant?.regionPalette) ? expectedMapVariant.regionPalette : null,
          regionBorderColor: expectedMapVariant?.regionBorderColor || null,
          labelColor: expectedMapVariant?.labelColor || null,
          visualMapTextColor: expectedMapVariant?.visualMapTextColor || null
        });
        if (shouldRefreshBuiltinTemplate) {
          await repository.updateReportThemeTemplate(matched.id, {
            ...matched,
            ...template
          });
          continue;
        }
        if (needsHorizontalBarBackfill || needsLineBackfill || needsRadarBackfill || needsSankeyBackfill || needsGaugeBackfill || needsFunnelBackfill || needsWordCloudBackfill || needsScatterBackfill || needsDashboardTitleColorBackfill || needsMapRefresh) {
          await repository.updateReportThemeTemplate(matched.id, {
            ...matched,
            ...needsDashboardTitleColorBackfill ? {
              canvas: {
                ...matched.canvas || {},
                dashboardTitleColor: template.canvas.dashboardTitleColor
              }
            } : {},
            chartVariants: {
              ...matched.chartVariants || {},
              ...needsHorizontalBarBackfill ? { horizontalBar: template.chartVariants.horizontalBar } : {},
              ...needsLineBackfill ? { line: template.chartVariants.line } : {},
              ...needsRadarBackfill ? { radar: template.chartVariants.radar } : {},
              ...needsSankeyBackfill ? { sankey: template.chartVariants.sankey } : {},
              ...needsGaugeBackfill ? { gauge: template.chartVariants.gauge } : {},
              ...needsFunnelBackfill ? { funnel: template.chartVariants.funnel } : {},
              ...needsWordCloudBackfill ? { wordCloud: template.chartVariants.wordCloud } : {},
              ...needsScatterBackfill ? { scatter: template.chartVariants.scatter } : {},
              ...needsMapRefresh ? { map: template.chartVariants.map } : {}
            }
          });
          continue;
        }
      }
    }
    async function getOverview() {
      await ensureBuiltinChartAssets();
      await ensureBuiltinThemeTemplates();
      return repository.getReportingOverview();
    }
    async function listReportDataSources() {
      return repository.listReportDataSources();
    }
    async function createReportDataSource(payload) {
      try {
        const normalized = normalizeReportDataSourcePayload(payload);
        return await repository.createReportDataSource(normalized);
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u62A5\u8868\u6570\u636E\u6E90\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function updateReportDataSource(id, payload) {
      await ensureReportDataSource(id);
      try {
        const normalized = normalizeReportDataSourcePayload(payload);
        const row = await repository.updateReportDataSource(Number(id), normalized);
        if (!row) {
          throw new AppError("\u62A5\u8868\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
        }
        return row;
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u62A5\u8868\u6570\u636E\u6E90\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function deleteReportDataSource(id) {
      await ensureReportDataSource(id);
      const datasetCount = await repository.countDatasetsBySourceId(Number(id));
      if (datasetCount > 0) {
        throw new AppError("\u62A5\u8868\u6570\u636E\u6E90\u4ECD\u88AB\u6570\u636E\u96C6\u5F15\u7528\uFF0C\u65E0\u6CD5\u5220\u9664", 409, { datasetCount });
      }
      const deleted = await repository.deleteReportDataSource(Number(id));
      return { id: Number(id), deleted };
    }
    async function testReportDataSourceConnection(payload) {
      return testDatabaseConnection(payload.connectionConfig || {}, payload.sourceType);
    }
    async function listReportDataSourceTables(sourceId) {
      const dataSource = await ensureActiveReportDataSource(sourceId);
      return metadataService.listTables(dataSource);
    }
    async function listReportDataSourceColumns(sourceId, tableName) {
      const dataSource = await ensureActiveReportDataSource(sourceId);
      return metadataService.listColumns(dataSource, tableName);
    }
    async function sampleReportDataSourceRows(sourceId, tableName, limit) {
      const dataSource = await ensureActiveReportDataSource(sourceId);
      return metadataService.sampleRows(dataSource, tableName, limit);
    }
    async function suggestAiChartAnalysis(payload) {
      const startedAt = Date.now();
      let provider = null;
      const selectedTables = uniqueStrings(payload.selectedTables).slice(0, MAX_AI_SELECTED_TABLES);
      try {
        const dataSource = await ensureActiveReportDataSource(payload.sourceId);
        const resolved = resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
        const dialect = resolved.dialect || dataSource.sourceType || "mysql";
        const tables = await metadataService.listTables(dataSource);
        const candidates = selectAiCandidateTables(tables, {
          prompt: payload.analysisDirection || payload.prompt || "",
          selectedTables
        });
        const tableSchemas = await loadAiTableSchemas(dataSource, candidates.schemaTables);
        const tableSamples = await loadAiTableSamples(dataSource, tableSchemas);
        const context = {
          dialect,
          availableTables: candidates.availableTables.map((item) => ({
            tableName: item.tableName || item.name,
            tableType: item.tableType || item.type || "",
            tableComment: item.tableComment || item.comment || ""
          })),
          tableSchemas,
          tableSamples
        };
        const fallbackSuggestions = buildDeterministicAnalysisSuggestions(context, payload.analysisDirection || payload.prompt || "");
        let warning = null;
        let rawText = "";
        let suggestions = fallbackSuggestions;
        try {
          const resolvedAi = await resolveReportingAiProvider(AI_ANALYSIS_SUGGESTION_SCENE_CODE);
          const aiConfig = resolvedAi.aiConfig;
          provider = resolvedAi.provider;
          const completion = await modelProviderService.generateChatCompletion(
            provider,
            [
              {
                role: "system",
                content: buildAiAnalysisSuggestionSystemPrompt(aiConfig?.systemPrompt || "", {
                  datasource: {
                    sourceId: Number(payload.sourceId),
                    sourceType: dataSource.sourceType,
                    sourceName: dataSource.sourceName,
                    dialect
                  },
                  tables: context.tableSchemas,
                  tableSamples: context.tableSamples,
                  analysisDirection: payload.analysisDirection || payload.prompt || "",
                  dialect
                })
              },
              { role: "user", content: buildAiAnalysisSuggestionUserPrompt(payload, context) }
            ],
            buildAiRuntimeOptions(aiConfig, { maxTokens: 1600 })
          );
          rawText = completion?.content || "";
          const parsed = parseAiAnalysisSuggestionPayload(rawText);
          suggestions = normalizeAiAnalysisSuggestions(parsed, context);
          if (!suggestions.length) {
            warning = "\u6A21\u578B\u672A\u8FD4\u56DE\u53EF\u7528\u5206\u6790\u5EFA\u8BAE\uFF0C\u5DF2\u4F7F\u7528\u89C4\u5219\u5EFA\u8BAE";
            suggestions = fallbackSuggestions;
          }
        } catch (error) {
          warning = error.message || "\u6A21\u578B\u751F\u6210\u5206\u6790\u5EFA\u8BAE\u5931\u8D25\uFF0C\u5DF2\u4F7F\u7528\u89C4\u5219\u5EFA\u8BAE";
        }
        const result = {
          provider: buildProviderSummary(provider),
          summary: warning ? "\u5DF2\u751F\u6210\u89C4\u5219\u5206\u6790\u5EFA\u8BAE" : "\u5DF2\u751F\u6210\u5206\u6790\u5EFA\u8BAE",
          suggestions,
          fallbackSuggestions,
          warning,
          metadata: {
            availableTables: context.availableTables,
            tableSchemas: context.tableSchemas,
            tableSamples: context.tableSamples,
            rawText
          }
        };
        const audit = await recordReportingAiRun({
          sceneCode: AI_ANALYSIS_SUGGESTION_SCENE_CODE,
          sourceId: payload.sourceId,
          promptText: payload.analysisDirection || payload.prompt || "",
          provider: buildProviderSummary(provider),
          request: { selectedTables, dialect },
          response: result,
          status: warning ? "warning" : "success",
          durationMs: Date.now() - startedAt,
          errorMessage: warning
        });
        return { ...result, auditRunId: audit?.id || null };
      } catch (error) {
        await recordReportingAiRun({
          sceneCode: AI_ANALYSIS_SUGGESTION_SCENE_CODE,
          sourceId: payload.sourceId,
          promptText: payload.analysisDirection || payload.prompt || "",
          provider: buildProviderSummary(provider),
          request: { selectedTables },
          status: "failed",
          durationMs: Date.now() - startedAt,
          errorMessage: error.message || "\u751F\u6210\u5206\u6790\u5EFA\u8BAE\u5931\u8D25"
        });
        throw error;
      }
    }
    async function listReportDatasets() {
      return repository.listReportDatasets();
    }
    async function listReportDatasetFolders() {
      return repository.listReportDatasetFolders();
    }
    async function createReportDatasetFolder(payload) {
      const normalized = normalizeDatasetFolderPayload(payload);
      if (!normalized.folderName) {
        throw new AppError("\u8BF7\u8F93\u5165\u6587\u4EF6\u5939\u540D\u79F0", 400);
      }
      await ensureReportDatasetFolderParent(null, normalized.parentId);
      return repository.createReportDatasetFolder(normalized);
    }
    async function updateReportDatasetFolder(id, payload) {
      const existingRecord = await repository.getReportDatasetFolderById(Number(id));
      if (!existingRecord) {
        throw new AppError("\u6570\u636E\u96C6\u6587\u4EF6\u5939\u4E0D\u5B58\u5728", 404);
      }
      const normalized = normalizeDatasetFolderPayload(payload, existingRecord);
      if (!normalized.folderName) {
        throw new AppError("\u8BF7\u8F93\u5165\u6587\u4EF6\u5939\u540D\u79F0", 400);
      }
      await ensureReportDatasetFolderParent(Number(id), normalized.parentId);
      return repository.updateReportDatasetFolder(Number(id), normalized);
    }
    async function deleteReportDatasetFolder(id) {
      const deleted = await repository.deleteReportDatasetFolder(Number(id));
      if (!deleted) {
        throw new AppError("\u6570\u636E\u96C6\u6587\u4EF6\u5939\u4E0D\u5B58\u5728", 404);
      }
      return { id: Number(id), deleted: true };
    }
    async function previewReportDataset(payload) {
      const dataSource = await ensureActiveReportDataSource(payload.sourceId);
      return previewDatasetStructure(
        dataSource,
        payload.datasetType,
        payload.sourceTable,
        payload.sourceSql,
        payload.limit
      );
    }
    function buildDatasetTableQuerySql(dataSource, tableName, dialect) {
      if (!normalizeText(tableName)) {
        throw new AppError("\u8BF7\u9009\u62E9\u6E90\u8868", 400);
      }
      const resolved = resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
      const database = resolved.database;
      const schema = resolved.schema || "public";
      const parts = String(tableName || "").split(".").filter(Boolean).map((item) => item.replace(/[`"]/g, ""));
      const name = parts[parts.length - 1] || String(tableName || "").replace(/[`"]/g, "");
      const namespace = parts.length >= 2 ? parts[parts.length - 2] : ["postgresql", "oracle", "dm"].includes(dialect) ? schema : database;
      const qualifiedTable = namespace ? metadataService.escapeIdentifier(`${namespace}.${name}`, dialect) : metadataService.escapeIdentifier(name, dialect);
      return `SELECT * FROM ${qualifiedTable}`;
    }
    async function loadReportDatasetRows(dataSource, datasetType, sourceTable, sourceSql) {
      return withReportConnection(dataSource, async (connection, dialect) => {
        const normalizedDatasetType = String(datasetType || "table").trim().toLowerCase();
        const sql = normalizedDatasetType === "table" ? buildDatasetTableQuerySql(dataSource, sourceTable, dialect) : ensureSafeReportAiSql(sourceSql, dialect, { disallowSelectStar: false });
        if (dialect === "mysql") {
          const [rows] = await connection.query({
            sql,
            timeout: AI_QUERY_TIMEOUT_MS
          });
          return Array.isArray(rows) ? rows : [];
        }
        const result = await connection.query(sql);
        return Array.isArray(result.rows) ? result.rows : [];
      });
    }
    async function planAiChartSql(payload) {
      const startedAt = Date.now();
      let provider = null;
      const selectedTables = uniqueStrings(payload.selectedTables).slice(0, MAX_AI_SELECTED_TABLES);
      try {
        const dataSource = await ensureActiveReportDataSource(payload.sourceId);
        const resolved = resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
        const dialect = resolved.dialect || dataSource.sourceType || "mysql";
        const tables = await metadataService.listTables(dataSource);
        const candidates = selectAiCandidateTables(tables, { ...payload, selectedTables });
        const tableSchemas = await loadAiTableSchemas(dataSource, candidates.schemaTables);
        const tableSamples = await loadAiTableSamples(dataSource, tableSchemas);
        const context = {
          dialect,
          availableTables: candidates.availableTables.map((item) => ({
            tableName: item.tableName || item.name,
            tableType: item.tableType || item.type || "",
            tableComment: item.tableComment || item.comment || ""
          })),
          tableSchemas,
          tableSamples
        };
        const resolvedAi = await resolveReportingAiProvider(AI_SQL_PLAN_SCENE_CODE);
        const aiConfig = resolvedAi.aiConfig;
        provider = resolvedAi.provider;
        const completion = await modelProviderService.generateChatCompletion(
          provider,
          [
            {
              role: "system",
              content: buildAiSqlSystemPrompt(dialect, aiConfig?.systemPrompt || "", {
                datasource: {
                  sourceId: Number(payload.sourceId),
                  sourceType: dataSource.sourceType,
                  sourceName: dataSource.sourceName,
                  dialect
                },
                tables: context.tableSchemas,
                tableSamples: context.tableSamples,
                prompt: payload.prompt,
                currentSql: payload.currentSql || ""
              })
            },
            { role: "user", content: buildAiSqlUserPrompt(payload, context) }
          ],
          buildAiRuntimeOptions(aiConfig, { maxTokens: 1800 })
        );
        const rawText = completion?.content || "";
        const parsed = parseJsonObjectWithRecovery(rawText);
        const generatedSql = normalizeText(parsed?.generatedSql);
        const validation = createAiSqlValidationResult();
        if (!generatedSql) {
          validation.messages.push("AI \u672A\u8FD4\u56DE\u53EF\u6267\u884C SQL");
          const result2 = normalizeAiSqlPlan(rawText, parsed, { ...context, dialect }, provider, validation);
          const audit2 = await recordReportingAiRun({
            sceneCode: AI_SQL_PLAN_SCENE_CODE,
            sourceId: payload.sourceId,
            promptText: payload.prompt,
            provider: buildProviderSummary(provider),
            request: { selectedTables, currentSql: payload.currentSql || "", dialect },
            response: result2,
            status: "warning",
            durationMs: Date.now() - startedAt,
            errorMessage: validation.messages.join("; ")
          });
          return { ...result2, auditRunId: audit2?.id || null };
        }
        const validationResult = await validateGeneratedReportSql(dataSource, generatedSql, dialect, tables);
        Object.assign(validation, validationResult.validation);
        if (validationResult.safeSql) {
          parsed.generatedSql = validationResult.safeSql;
        }
        let result = normalizeAiSqlPlan(rawText, parsed, { ...context, dialect }, provider, validation);
        if (!validation.valid) {
          const autoRevision = await attemptAutoReviseAiChartSql({
            sourceId: payload.sourceId,
            prompt: payload.prompt,
            selectedTables,
            currentSql: generatedSql,
            lastError: validation.messages.join("\uFF1B")
          }, {
            dataSource,
            resolved,
            dialect,
            tables,
            validationMessages: validation.messages
          });
          if (autoRevision.success && autoRevision.revision?.result) {
            provider = autoRevision.revision.provider || provider;
            const revisedResult = autoRevision.revision.result;
            result = decorateAiSqlResultWithAutoCorrection(revisedResult, {
              attempted: true,
              applied: revisedResult.validation?.valid,
              reason: validation.messages.join("\uFF1B"),
              originalSql: generatedSql,
              revisedSql: revisedResult.generatedSql,
              summary: revisedResult.validation?.valid ? "AI \u5DF2\u6309\u5F53\u524D\u6570\u636E\u6E90\u65B9\u8A00\u81EA\u52A8\u4FEE\u590D SQL" : "AI \u5DF2\u5C1D\u8BD5\u6309\u5F53\u524D\u6570\u636E\u6E90\u65B9\u8A00\u81EA\u52A8\u4FEE\u590D SQL\uFF0C\u4F46\u4ECD\u9700\u4EBA\u5DE5\u786E\u8BA4",
              messages: [
                revisedResult.validation?.valid ? `\u5DF2\u6839\u636E\u5F53\u524D\u6570\u636E\u6E90 ${dialect} \u65B9\u8A00\u81EA\u52A8\u4FEE\u590D\u9996\u6B21\u751F\u6210 SQL` : `\u5DF2\u6839\u636E\u5F53\u524D\u6570\u636E\u6E90 ${dialect} \u65B9\u8A00\u5C1D\u8BD5\u81EA\u52A8\u4FEE\u590D\u9996\u6B21\u751F\u6210 SQL\uFF0C\u4F46\u6821\u9A8C\u4ECD\u672A\u5B8C\u5168\u901A\u8FC7`,
                `\u9996\u6B21\u751F\u6210\u95EE\u9898: ${validation.messages.join("\uFF1B")}`
              ]
            });
          } else if (!autoRevision.success) {
            result = decorateAiSqlResultWithAutoCorrection(result, {
              attempted: true,
              applied: false,
              reason: validation.messages.join("\uFF1B"),
              originalSql: generatedSql,
              revisedSql: result.generatedSql,
              summary: "AI \u9996\u6B21\u751F\u6210 SQL \u6821\u9A8C\u672A\u901A\u8FC7\uFF0C\u81EA\u52A8\u4FEE\u590D\u5931\u8D25",
              messages: [
                `\u5DF2\u5C1D\u8BD5\u6839\u636E\u5F53\u524D\u6570\u636E\u6E90 ${dialect} \u65B9\u8A00\u81EA\u52A8\u4FEE\u590D SQL\uFF0C\u4F46\u672A\u6210\u529F`,
                autoRevision.error?.message || "\u81EA\u52A8\u4FEE\u590D\u8C03\u7528\u5931\u8D25"
              ]
            });
          }
        }
        const audit = await recordReportingAiRun({
          sceneCode: AI_SQL_PLAN_SCENE_CODE,
          sourceId: payload.sourceId,
          promptText: payload.prompt,
          generatedSql: result.generatedSql,
          finalSql: result.generatedSql,
          provider: buildProviderSummary(provider),
          request: { selectedTables, currentSql: payload.currentSql || "", dialect },
          response: result,
          status: result.validation.valid ? "success" : "warning",
          durationMs: Date.now() - startedAt,
          errorMessage: result.validation.valid ? null : result.validation.messages.join("; ")
        });
        return { ...result, auditRunId: audit?.id || null };
      } catch (error) {
        await recordReportingAiRun({
          sceneCode: AI_SQL_PLAN_SCENE_CODE,
          sourceId: payload.sourceId,
          promptText: payload.prompt,
          provider: buildProviderSummary(provider),
          request: {
            selectedTables,
            currentSql: payload.currentSql || ""
          },
          status: "failed",
          durationMs: Date.now() - startedAt,
          errorMessage: error.message || "\u751F\u6210 SQL \u5931\u8D25"
        });
        throw error;
      }
    }
    async function reviseAiChartSql(payload) {
      const startedAt = Date.now();
      let provider = null;
      const selectedTables = uniqueStrings(payload.selectedTables).slice(0, MAX_AI_SELECTED_TABLES);
      try {
        const revision = await executeAiChartSqlRevisionRound(payload);
        const { dataSource, dialect, tables, currentSql } = revision;
        provider = revision.provider;
        if (!revision.result.generatedSql) {
          const audit2 = await recordReportingAiRun({
            sceneCode: AI_SQL_REVISION_SCENE_CODE,
            sourceId: payload.sourceId,
            promptText: payload.revisionInstruction || payload.prompt || "",
            finalSql: currentSql,
            provider: buildProviderSummary(provider),
            request: {
              selectedTables,
              prompt: payload.prompt || "",
              currentSql,
              revisionInstruction: payload.revisionInstruction || "",
              dialect
            },
            response: revision.result,
            status: "warning",
            durationMs: Date.now() - startedAt,
            errorMessage: revision.validation.messages.join("; ")
          });
          return { ...revision.result, auditRunId: audit2?.id || null };
        }
        let result = revision.result;
        if (!result.validation.valid) {
          const autoRevision = await attemptAutoReviseAiChartSql({
            sourceId: payload.sourceId,
            prompt: payload.prompt || "",
            selectedTables,
            currentSql: result.generatedSql,
            lastQueryProfile: payload.lastQueryProfile || null,
            lastError: result.validation.messages.join("\uFF1B")
          }, {
            dataSource,
            dialect,
            tables,
            validationMessages: result.validation.messages
          });
          if (autoRevision.success && autoRevision.revision?.result) {
            provider = autoRevision.revision.provider || provider;
            const revisedResult = autoRevision.revision.result;
            result = decorateAiSqlResultWithAutoCorrection(revisedResult, {
              attempted: true,
              applied: revisedResult.validation?.valid,
              reason: revision.validation.messages.join("\uFF1B"),
              originalSql: revision.result.generatedSql,
              revisedSql: revisedResult.generatedSql,
              summary: revisedResult.validation?.valid ? "AI \u5DF2\u81EA\u52A8\u4FEE\u590D\u4FEE\u6539\u540E\u7684 SQL" : "AI \u5DF2\u5C1D\u8BD5\u81EA\u52A8\u4FEE\u590D\u4FEE\u6539\u540E\u7684 SQL\uFF0C\u4F46\u4ECD\u9700\u4EBA\u5DE5\u786E\u8BA4",
              messages: [
                revisedResult.validation?.valid ? `\u5DF2\u6839\u636E\u5F53\u524D\u6570\u636E\u6E90 ${dialect} \u65B9\u8A00\u81EA\u52A8\u4FEE\u590D\u672C\u6B21\u4FEE\u6539 SQL` : `\u5DF2\u6839\u636E\u5F53\u524D\u6570\u636E\u6E90 ${dialect} \u65B9\u8A00\u5C1D\u8BD5\u81EA\u52A8\u4FEE\u590D\u672C\u6B21\u4FEE\u6539 SQL\uFF0C\u4F46\u6821\u9A8C\u4ECD\u672A\u5B8C\u5168\u901A\u8FC7`,
                `\u672C\u6B21\u4FEE\u6539\u95EE\u9898: ${revision.validation.messages.join("\uFF1B")}`
              ]
            });
          } else if (!autoRevision.success) {
            result = decorateAiSqlResultWithAutoCorrection(result, {
              attempted: true,
              applied: false,
              reason: revision.validation.messages.join("\uFF1B"),
              originalSql: revision.result.generatedSql,
              revisedSql: result.generatedSql,
              summary: "AI \u4FEE\u6539 SQL \u540E\u6821\u9A8C\u672A\u901A\u8FC7\uFF0C\u81EA\u52A8\u4FEE\u590D\u5931\u8D25",
              messages: [
                `\u5DF2\u5C1D\u8BD5\u6839\u636E\u5F53\u524D\u6570\u636E\u6E90 ${dialect} \u65B9\u8A00\u81EA\u52A8\u4FEE\u590D\u4FEE\u6539\u540E\u7684 SQL\uFF0C\u4F46\u672A\u6210\u529F`,
                autoRevision.error?.message || "\u81EA\u52A8\u4FEE\u590D\u8C03\u7528\u5931\u8D25"
              ]
            });
          }
        }
        const audit = await recordReportingAiRun({
          sceneCode: AI_SQL_REVISION_SCENE_CODE,
          sourceId: payload.sourceId,
          promptText: payload.revisionInstruction || payload.prompt || "",
          generatedSql: result.generatedSql,
          finalSql: result.generatedSql,
          provider: buildProviderSummary(provider),
          request: {
            selectedTables,
            prompt: payload.prompt || "",
            currentSql,
            revisionInstruction: payload.revisionInstruction || "",
            lastQueryProfile: payload.lastQueryProfile || null,
            lastError: payload.lastError || "",
            dialect
          },
          response: result,
          status: result.validation.valid ? "success" : "warning",
          durationMs: Date.now() - startedAt,
          errorMessage: result.validation.valid ? null : result.validation.messages.join("; ")
        });
        return { ...result, auditRunId: audit?.id || null };
      } catch (error) {
        await recordReportingAiRun({
          sceneCode: AI_SQL_REVISION_SCENE_CODE,
          sourceId: payload.sourceId,
          promptText: payload.revisionInstruction || payload.prompt || "",
          finalSql: sanitizeSqlText(payload.currentSql),
          provider: buildProviderSummary(provider),
          request: {
            selectedTables,
            prompt: payload.prompt || "",
            revisionInstruction: payload.revisionInstruction || ""
          },
          status: "failed",
          durationMs: Date.now() - startedAt,
          errorMessage: error.message || "\u4FEE\u6539 SQL \u5931\u8D25"
        });
        throw error;
      }
    }
    async function runAiChartQuery(payload) {
      const startedAt = Date.now();
      try {
        const dataSource = await ensureActiveReportDataSource(payload.sourceId);
        const resolved = resolveDatasourceConnection(dataSource.sourceType, dataSource.connectionConfig || {});
        const dialect = resolved.dialect || dataSource.sourceType || "mysql";
        const requestedSql = sanitizeSqlText(payload.sourceSql);
        const limit = Math.max(1, Math.min(MAX_AI_QUERY_LIMIT, Number(payload.limit || MAX_AI_SAMPLE_ROWS) || MAX_AI_SAMPLE_ROWS));
        let sourceSql = requestedSql;
        let autoCorrection = null;
        let execution;
        try {
          sourceSql = ensureSafeReportAiSql(requestedSql, dialect);
          execution = await previewValidatedAiChartQuery(dataSource, sourceSql, limit);
        } catch (error) {
          const autoRevision = await attemptAutoReviseAiChartSql({
            sourceId: payload.sourceId,
            currentSql: requestedSql,
            selectedTables: extractSqlTables(requestedSql, dialect),
            lastError: error.message || "SQL \u6267\u884C\u5931\u8D25"
          }, {
            dataSource,
            resolved,
            dialect,
            validationMessages: [error.message || "SQL \u6267\u884C\u5931\u8D25"]
          });
          if (!autoRevision.success || !autoRevision.revision?.result?.validation?.valid || !autoRevision.revision.result.generatedSql) {
            throw error;
          }
          sourceSql = autoRevision.revision.result.generatedSql;
          execution = await previewValidatedAiChartQuery(dataSource, sourceSql, limit);
          autoCorrection = buildAiQueryAutoCorrection({
            attempted: true,
            applied: true,
            reason: error.message || "SQL \u6267\u884C\u5931\u8D25",
            originalSql: requestedSql,
            revisedSql: sourceSql,
            messages: [`\u6267\u884C\u524D\u5DF2\u6309\u5F53\u524D\u6570\u636E\u6E90 ${dialect} \u65B9\u8A00\u81EA\u52A8\u4FEE\u590D SQL`]
          }, execution.explainResult);
        }
        const explainResult = execution.explainResult;
        const preview = execution.preview;
        const profile = profileAiResult(preview.fields, preview.sampleRows, preview.rowCount);
        const fields = enrichPreviewFieldsWithProfile(preview.fields, profile);
        const result = {
          sourceId: Number(payload.sourceId),
          sourceSql,
          fields,
          sampleRows: preview.sampleRows,
          rowCount: preview.rowCount,
          profile,
          durationMs: Date.now() - startedAt,
          governance: {
            limit,
            timeoutMs: AI_QUERY_TIMEOUT_MS,
            explainValid: explainResult.explainValid,
            messages: autoCorrection?.messages || explainResult.messages
          },
          autoCorrection
        };
        const audit = await recordReportingAiRun({
          sceneCode: "chart_query",
          sourceId: payload.sourceId,
          finalSql: sourceSql,
          request: { limit, dialect },
          response: {
            rowCount: result.rowCount,
            fields: result.fields,
            profile: result.profile,
            governance: result.governance,
            autoCorrection: result.autoCorrection
          },
          status: "success",
          durationMs: result.durationMs
        });
        return { ...result, auditRunId: audit?.id || null };
      } catch (error) {
        await recordReportingAiRun({
          sceneCode: "chart_query",
          sourceId: payload.sourceId,
          finalSql: sanitizeSqlText(payload.sourceSql),
          request: { limit: payload.limit || MAX_AI_SAMPLE_ROWS },
          status: "failed",
          durationMs: Date.now() - startedAt,
          errorMessage: error.message || "\u6267\u884C\u67E5\u8BE2\u5931\u8D25"
        });
        throw error;
      }
    }
    async function recommendAiChart(payload) {
      const startedAt = Date.now();
      const fields = asArray(payload.fields);
      const sampleRows = asArray(payload.sampleRows).slice(0, MAX_AI_SAMPLE_ROWS);
      const profile = payload.profile && typeof payload.profile === "object" ? payload.profile : profileAiResult(fields, sampleRows, payload.rowCount || sampleRows.length);
      await ensureBuiltinChartAssets();
      const chartAssets = await repository.listReportChartAssets();
      let fallbackRecommendations = buildDeterministicRecommendations(profile, chartAssets, payload.prompt || "");
      let provider = null;
      let modelWarning = null;
      let rawText = "";
      let recommendations = fallbackRecommendations;
      try {
        const resolved = await resolveReportingAiProvider(AI_CHART_RECOMMENDATION_SCENE_CODE);
        provider = resolved.provider;
        const completion = await modelProviderService.generateChatCompletion(
          provider,
          [
            {
              role: "system",
              content: buildAiRecommendationSystemPrompt(resolved.aiConfig?.systemPrompt || "", {
                prompt: payload.prompt || "",
                profile,
                sampleRows,
                fallbackRecommendations
              })
            },
            { role: "user", content: buildAiRecommendationUserPrompt(payload, profile, fallbackRecommendations) }
          ],
          buildAiRuntimeOptions(resolved.aiConfig, { maxTokens: 1600 })
        );
        rawText = completion?.content || "";
        const parsed = parseJsonObjectWithRecovery(rawText);
        recommendations = normalizeAiRecommendations(parsed, fallbackRecommendations, chartAssets, profile);
      } catch (error) {
        modelWarning = error.message || "\u6A21\u578B\u63A8\u8350\u5931\u8D25\uFF0C\u5DF2\u4F7F\u7528\u89C4\u5219\u63A8\u8350\u7ED3\u679C";
      }
      fallbackRecommendations = attachFieldMapValidation(fallbackRecommendations, chartAssets, profile);
      recommendations = attachFieldMapValidation(recommendations, chartAssets, profile);
      const result = {
        provider: buildProviderSummary(provider),
        profile,
        recommendations,
        fallbackRecommendations,
        warning: modelWarning,
        rawText
      };
      const top = recommendations[0] || null;
      const audit = await recordReportingAiRun({
        sceneCode: AI_CHART_RECOMMENDATION_SCENE_CODE,
        sourceId: payload.sourceId || null,
        promptText: payload.prompt || "",
        finalSql: payload.sourceSql || null,
        provider: buildProviderSummary(provider),
        chartFamily: top?.chartFamily || null,
        chartAssetId: top?.chartAssetId || null,
        fieldMap: top?.fieldMap || {},
        request: {
          fields,
          rowCount: payload.rowCount || sampleRows.length,
          profile
        },
        response: result,
        status: modelWarning ? "warning" : "success",
        durationMs: Date.now() - startedAt,
        errorMessage: modelWarning
      });
      return { ...result, auditRunId: audit?.id || null };
    }
    async function allocateAiChartFieldMap(payload) {
      const fields = asArray(payload.fields);
      const sampleRows = asArray(payload.sampleRows).slice(0, MAX_AI_SAMPLE_ROWS);
      const profile = payload.profile && typeof payload.profile === "object" ? payload.profile : profileAiResult(fields, sampleRows, payload.rowCount || sampleRows.length);
      await ensureBuiltinChartAssets();
      const chartAssets = await repository.listReportChartAssets();
      const asset = chartAssets.find((item) => Number(item.id) === Number(payload.chartAssetId));
      if (!asset) {
        throw new AppError("\u672A\u627E\u5230\u76EE\u6807\u56FE\u8868\u8D44\u4EA7", 404);
      }
      const fallbackRecommendation = buildRecommendationEntry(
        chartAssets,
        payload.chartFamily || normalizeChartAssetFamily(asset),
        asset.chartName || "\u56FE\u8868",
        "\u9ED8\u8BA4\u5B57\u6BB5\u6620\u5C04",
        0.5,
        payload.currentFieldMap || {},
        "chart"
      );
      const fallbackFieldMap = validateRecommendationFieldMap(
        {
          widgetType: "chart",
          chartAssetId: asset.id,
          fieldMap: payload.currentFieldMap || {}
        },
        chartAssets,
        { ...profile, fields }
      ).valid ? payload.currentFieldMap || {} : fallbackRecommendation.fieldMap || {};
      let provider = null;
      let rawText = "";
      let reason = "";
      let warning = null;
      let fieldMap = fallbackFieldMap;
      try {
        const resolved = await resolveReportingAiProvider(AI_CHART_FIELD_MAP_SCENE_CODE);
        provider = resolved.provider;
        const completion = await modelProviderService.generateChatCompletion(
          provider,
          [
            {
              role: "system",
              content: buildAiFieldMapSystemPrompt(resolved.aiConfig?.systemPrompt || "", {
                prompt: payload.prompt || "",
                profile,
                sampleRows,
                chartAsset: asset,
                currentFieldMap: fallbackFieldMap
              })
            },
            { role: "user", content: buildAiFieldMapUserPrompt(payload, profile, asset, fallbackFieldMap) }
          ],
          buildAiRuntimeOptions(resolved.aiConfig, { maxTokens: 1200 })
        );
        rawText = completion?.content || "";
        const parsed = parseJsonObjectWithRecovery(rawText);
        if (parsed?.fieldMap && typeof parsed.fieldMap === "object") {
          fieldMap = {
            ...fallbackFieldMap,
            ...parsed.fieldMap
          };
        }
        reason = normalizeText(parsed?.reason, "");
      } catch (error) {
        warning = error.message || "\u6A21\u578B\u5B57\u6BB5\u5206\u914D\u5931\u8D25\uFF0C\u5DF2\u4F7F\u7528\u9ED8\u8BA4\u6620\u5C04";
      }
      const validation = validateRecommendationFieldMap(
        {
          widgetType: "chart",
          chartAssetId: asset.id,
          fieldMap
        },
        chartAssets,
        { ...profile, fields }
      );
      if (!validation.valid) {
        fieldMap = fallbackFieldMap;
      }
      return {
        provider: buildProviderSummary(provider),
        chartAssetId: asset.id,
        chartFamily: normalizeChartAssetFamily(asset),
        fieldMap,
        reason,
        validation: validateRecommendationFieldMap(
          {
            widgetType: "chart",
            chartAssetId: asset.id,
            fieldMap
          },
          chartAssets,
          { ...profile, fields }
        ),
        warning,
        rawText
      };
    }
    async function createReportDataset(payload) {
      await ensureActiveReportDataSource(payload.sourceId);
      if (payload.folderId != null) {
        await ensureReportDatasetFolder(payload.folderId);
      }
      const preview = await previewReportDataset({ ...payload, limit: 20 });
      const normalizedFields = Array.isArray(payload.fields) && payload.fields.length > 0 ? payload.fields : preview.fields;
      const normalized = assignInternalDatasetCode(normalizeDatasetPayload(payload, normalizedFields));
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await repository.createReportDataset(attempt === 0 ? normalized : assignInternalDatasetCode(normalized));
        } catch (error) {
          if (error.code === "ER_DUP_ENTRY" && attempt < 2) {
            continue;
          }
          if (error.code === "ER_DUP_ENTRY") {
            throw new AppError("\u6570\u636E\u96C6\u5185\u90E8\u7F16\u7801\u751F\u6210\u51B2\u7A81\uFF0C\u8BF7\u91CD\u8BD5", 409);
          }
          throw error;
        }
      }
      throw new AppError("\u6570\u636E\u96C6\u5185\u90E8\u7F16\u7801\u751F\u6210\u5931\u8D25", 500);
    }
    async function updateReportDataset(id, payload) {
      const existing = await ensureReportDataset(id);
      await ensureActiveReportDataSource(payload.sourceId);
      if (payload.folderId != null) {
        await ensureReportDatasetFolder(payload.folderId);
      }
      const submittedFields = Array.isArray(payload.fields) ? payload.fields : [];
      const normalizedFields = submittedFields.length > 0 ? submittedFields : (await previewReportDataset({ ...payload, limit: 20 })).fields;
      const normalizedBase = normalizeDatasetPayload(payload, normalizedFields, existing);
      const normalized = normalizeText(normalizedBase.datasetCode) ? normalizedBase : assignInternalDatasetCode(normalizedBase);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const row = await repository.updateReportDataset(
            Number(id),
            attempt === 0 ? normalized : assignInternalDatasetCode(normalized)
          );
          if (!row) {
            throw new AppError("\u6570\u636E\u96C6\u4E0D\u5B58\u5728", 404);
          }
          return row;
        } catch (error) {
          if (error.code === "ER_DUP_ENTRY" && attempt < 2) {
            continue;
          }
          if (error.code === "ER_DUP_ENTRY") {
            throw new AppError("\u6570\u636E\u96C6\u5185\u90E8\u7F16\u7801\u5F02\u5E38\uFF0C\u8BF7\u91CD\u8BD5", 409);
          }
          throw error;
        }
      }
      throw new AppError("\u6570\u636E\u96C6\u5185\u90E8\u7F16\u7801\u751F\u6210\u5931\u8D25", 500);
    }
    async function deleteReportDataset(id) {
      await ensureReportDataset(id);
      const deleted = await repository.deleteReportDataset(Number(id));
      return { id: Number(id), deleted };
    }
    async function listReportChartAssets() {
      await ensureBuiltinChartAssets();
      return repository.listReportChartAssets();
    }
    async function listReportThemeTemplates() {
      await ensureBuiltinThemeTemplates();
      const rows = await repository.listReportThemeTemplates();
      return rows.map(hydrateThemeTemplateRecord);
    }
    async function createReportThemeTemplate(payload) {
      const normalized = normalizeThemeTemplatePayload(payload);
      try {
        return hydrateThemeTemplateRecord(await repository.createReportThemeTemplate(normalized));
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u4E3B\u9898\u6A21\u677F\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function updateReportThemeTemplate(id, payload) {
      const existing = await ensureReportThemeTemplate(id);
      if (existing.isBuiltin) {
        throw new AppError("\u5185\u7F6E\u6A21\u677F\u4E0D\u652F\u6301\u76F4\u63A5\u7F16\u8F91\uFF0C\u8BF7\u5148\u590D\u5236\u4E3A\u81EA\u5B9A\u4E49\u6A21\u677F", 403);
      }
      const normalized = normalizeThemeTemplatePayload(payload, existing);
      try {
        const row = await repository.updateReportThemeTemplate(Number(id), normalized);
        if (!row) {
          throw new AppError("\u4E3B\u9898\u6A21\u677F\u4E0D\u5B58\u5728", 404);
        }
        return hydrateThemeTemplateRecord(row);
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u4E3B\u9898\u6A21\u677F\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function deleteReportThemeTemplate(id) {
      const existing = await ensureReportThemeTemplate(id);
      if (existing.isBuiltin) {
        throw new AppError("\u5185\u7F6E\u6A21\u677F\u4E0D\u652F\u6301\u5220\u9664", 403);
      }
      const deleted = await repository.deleteReportThemeTemplate(Number(id));
      return { id: Number(id), deleted };
    }
    async function createReportChartAsset(payload) {
      const normalized = normalizeChartAssetPayload(payload);
      try {
        return await repository.createReportChartAsset(normalized);
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u56FE\u8868\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function updateReportChartAsset(id, payload) {
      const existing = await ensureReportChartAsset(id);
      const normalized = normalizeChartAssetPayload(payload, existing);
      try {
        const row = await repository.updateReportChartAsset(Number(id), normalized);
        if (!row) {
          throw new AppError("\u56FE\u8868\u8D44\u4EA7\u4E0D\u5B58\u5728", 404);
        }
        return row;
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u56FE\u8868\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function deleteReportChartAsset(id) {
      await ensureReportChartAsset(id);
      const deleted = await repository.deleteReportChartAsset(Number(id));
      return { id: Number(id), deleted };
    }
    async function listReportDashboards() {
      return repository.listReportDashboards();
    }
    async function getReportDashboard(id) {
      const row = await repository.getReportDashboardById(Number(id));
      if (!row) {
        throw new AppError("\u4EEA\u8868\u677F\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function getReportDashboardRuntime(id, options = {}) {
      const row = await repository.getReportDashboardById(Number(id));
      if (!row) {
        throw new AppError("\u4EEA\u8868\u677F\u4E0D\u5B58\u5728", 404);
      }
      const publishConfig = row.canvasConfig?.publishConfig || {};
      const accessMode = String(publishConfig.accessMode || "").trim().toLowerCase();
      const shareToken = String(publishConfig.shareToken || "").trim();
      const allowedUsernames = resolvePublishAllowedUsernames(publishConfig);
      const requestToken = String(options.shareToken || "").trim();
      const currentUser = options.user?.username ? String(options.user.username).trim() : "";
      if (accessMode === "public") {
        if (!shareToken || requestToken !== shareToken) {
          throw new AppError("\u5206\u4EAB\u94FE\u63A5\u65E0\u6548\u6216\u5DF2\u5931\u6548", 403);
        }
        return row;
      }
      if (accessMode === "login_user") {
        if (!currentUser) {
          throw new AppError("\u8BF7\u5148\u767B\u5F55\u540E\u67E5\u770B\u8BE5\u62A5\u8868", 401);
        }
        if (allowedUsernames.length && !allowedUsernames.includes(currentUser)) {
          throw new AppError("\u5F53\u524D\u8D26\u53F7\u65E0\u6743\u67E5\u770B\u8BE5\u62A5\u8868", 403);
        }
        return row;
      }
      if (!currentUser) {
        throw new AppError("\u8BF7\u5148\u767B\u5F55\u540E\u67E5\u770B\u8BE5\u62A5\u8868", 401);
      }
      return row;
    }
    async function ensureReportDashboardRuntimeAccess(id, options = {}) {
      return getReportDashboardRuntime(id, options);
    }
    async function createReportDashboard(payload) {
      const normalized = assignInternalDashboardCode(normalizeDashboardPayload(payload));
      const duplicateByName = await repository.getReportDashboardByName(normalized.dashboardName);
      if (duplicateByName) {
        throw new AppError("\u4EEA\u8868\u677F\u540D\u79F0\u5DF2\u5B58\u5728", 409, { fieldErrors: { dashboardName: ["\u4EEA\u8868\u677F\u540D\u79F0\u5DF2\u5B58\u5728"] } });
      }
      if (normalized.themeTemplateId) {
        await ensureReportThemeTemplate(normalized.themeTemplateId);
      }
      for (const widget of normalized.widgets) {
        if (widget.datasetId) {
          await ensureReportDataset(widget.datasetId);
        }
        if (widget.chartAssetId) {
          await ensureReportChartAsset(widget.chartAssetId);
        }
      }
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await repository.createReportDashboard(attempt === 0 ? normalized : assignInternalDashboardCode(normalized));
        } catch (error) {
          if (error.code === "ER_DUP_ENTRY" && attempt < 2) {
            continue;
          }
          if (error.code === "ER_DUP_ENTRY") {
            throw new AppError("\u62A5\u8868\u5185\u90E8\u7F16\u7801\u751F\u6210\u51B2\u7A81\uFF0C\u8BF7\u91CD\u8BD5", 409);
          }
          throw error;
        }
      }
      throw new AppError("\u62A5\u8868\u5185\u90E8\u7F16\u7801\u751F\u6210\u5931\u8D25", 500);
    }
    async function updateReportDashboard(id, payload) {
      const existing = await ensureReportDashboard(id);
      const normalized = normalizeDashboardPayload(payload, existing);
      const duplicateByName = await repository.getReportDashboardByName(normalized.dashboardName);
      if (duplicateByName && Number(duplicateByName.id) !== Number(id)) {
        throw new AppError("\u4EEA\u8868\u677F\u540D\u79F0\u5DF2\u5B58\u5728", 409, { fieldErrors: { dashboardName: ["\u4EEA\u8868\u677F\u540D\u79F0\u5DF2\u5B58\u5728"] } });
      }
      if (normalized.themeTemplateId) {
        await ensureReportThemeTemplate(normalized.themeTemplateId);
      }
      for (const widget of normalized.widgets) {
        if (widget.datasetId) {
          await ensureReportDataset(widget.datasetId);
        }
        if (widget.chartAssetId) {
          await ensureReportChartAsset(widget.chartAssetId);
        }
      }
      try {
        const row = await repository.updateReportDashboard(Number(id), normalized);
        if (!row) {
          throw new AppError("\u4EEA\u8868\u677F\u4E0D\u5B58\u5728", 404);
        }
        return row;
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u4EEA\u8868\u677F\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function publishReportDashboard(id, payload = {}) {
      const existing = await ensureReportDashboard(Number(id));
      const accessMode = payload.accessMode === "public" ? "public" : payload.accessMode === "login_user" ? "login_user" : "";
      const shareToken = accessMode ? normalizeText(payload.shareToken) || existing.canvasConfig?.publishConfig?.shareToken || buildShareToken() : null;
      const allowedUsernames = accessMode === "login_user" ? uniqueStrings(payload.allowedUsernames) : [];
      const normalized = normalizeDashboardPayload({
        ...existing,
        widgets: existing.widgets || [],
        canvasConfig: {
          ...existing.canvasConfig || {},
          publishConfig: {
            accessMode,
            allowAnonymous: accessMode === "public",
            allowedUsername: accessMode === "login_user" ? allowedUsernames[0] || null : null,
            allowedUsernames: accessMode === "login_user" ? allowedUsernames : [],
            shareToken
          }
        }
      }, existing);
      const row = await repository.updateReportDashboard(Number(id), normalized);
      if (!row) {
        throw new AppError("\u4EEA\u8868\u677F\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function deleteReportDashboard(id) {
      await ensureReportDashboard(id);
      const deleted = await repository.deleteReportDashboard(Number(id));
      return { id: Number(id), deleted };
    }
    async function previewDashboardChart(payload) {
      const widgetType = String(payload.widgetType || "chart").trim().toLowerCase();
      const chartAsset = payload.chartAssetId ? await ensureReportChartAsset(payload.chartAssetId) : null;
      let dataset = null;
      let dataSource = null;
      let datasetType = null;
      let sourceTable = null;
      let sourceSql = null;
      let preview;
      let fieldCandidates = [];
      if (payload.datasetId) {
        dataset = await ensureReportDataset(payload.datasetId);
        dataSource = await ensureActiveReportDataSource(dataset.sourceId);
        datasetType = dataset.datasetType;
        sourceTable = dataset.sourceTable;
        sourceSql = dataset.sourceSql;
        const structurePreviewLimit = widgetType === "table" ? payload.limit || 20 : void 0;
        preview = await previewDatasetStructure(
          dataSource,
          datasetType,
          sourceTable,
          sourceSql,
          structurePreviewLimit
        );
        fieldCandidates = mergePreviewFieldMetadata(dataset.fields, preview.fields);
      } else if (payload.sourceId) {
        dataSource = await ensureActiveReportDataSource(payload.sourceId);
        datasetType = payload.datasetType || (payload.sourceSql ? "sql" : "table");
        sourceTable = payload.sourceTable;
        sourceSql = payload.sourceSql;
        const structurePreviewLimit = widgetType === "table" ? payload.limit || 20 : void 0;
        preview = await previewDatasetStructure(
          dataSource,
          datasetType,
          sourceTable,
          sourceSql,
          structurePreviewLimit
        );
        fieldCandidates = preview.fields;
      } else {
        throw new AppError("\u9884\u89C8\u56FE\u8868\u65F6\u5FC5\u987B\u9009\u62E9\u6570\u636E\u96C6\uFF0C\u6216\u76F4\u63A5\u6307\u5B9A\u6570\u636E\u6E90\u548C\u67E5\u8BE2\u914D\u7F6E", 400);
      }
      const fieldMap = applyDefaultFieldMapBySchema({ ...payload.fieldMap || {} }, chartAsset, fieldCandidates);
      for (const item of fieldCandidates) {
        if (!fieldMap.xField && ["dimension", "category", "time"].includes(item.role || "")) fieldMap.xField = item.columnName;
        if (!fieldMap.yField && ["metric", "value"].includes(item.role || "")) fieldMap.yField = item.columnName;
        if (!fieldMap.yField2 && ["metric", "value"].includes(item.role || "") && item.columnName !== fieldMap.yField) fieldMap.yField2 = item.columnName;
        if (!fieldMap.nameField && ["dimension", "category"].includes(item.role || "")) fieldMap.nameField = item.columnName;
        if (!fieldMap.valueField && ["metric", "value"].includes(item.role || "")) fieldMap.valueField = item.columnName;
        if (!fieldMap.valueField2 && ["metric", "value"].includes(item.role || "") && item.columnName !== fieldMap.valueField) fieldMap.valueField2 = item.columnName;
      }
      if (!fieldMap.xField && fieldCandidates[0]) fieldMap.xField = fieldCandidates[0].columnName;
      if (!fieldMap.yField && fieldCandidates[1]) fieldMap.yField = fieldCandidates[1].columnName;
      if (!fieldMap.yField2) {
        const secondaryMetric = fieldCandidates.find((item) => ["metric", "value"].includes(item.role || "") && item.columnName !== fieldMap.yField);
        if (secondaryMetric) fieldMap.yField2 = secondaryMetric.columnName;
      }
      if (!fieldMap.nameField && fieldCandidates[0]) fieldMap.nameField = fieldCandidates[0].columnName;
      if (!fieldMap.mapField) {
        const geoField = fieldCandidates.find((item) => isGeoMappingField(item));
        if (geoField?.columnName) {
          fieldMap.mapField = geoField.columnName;
        }
      }
      if (!fieldMap.mapField && fieldMap.nameField) fieldMap.mapField = fieldMap.nameField;
      if (!fieldMap.mapField && fieldCandidates[0]) fieldMap.mapField = fieldCandidates[0].columnName;
      if (!fieldMap.valueField && fieldCandidates[1]) fieldMap.valueField = fieldCandidates[1].columnName;
      if (!fieldMap.valueField2) {
        const secondaryValueMetric = fieldCandidates.find((item) => ["metric", "value"].includes(item.role || "") && item.columnName !== fieldMap.valueField);
        if (secondaryValueMetric) fieldMap.valueField2 = secondaryValueMetric.columnName;
      }
      const chrome = buildChromeConfig(payload.chrome || {}, payload);
      const chartStyle = buildChartStyleConfig(payload.chartStyle || {}, payload, payload.chrome || {});
      const mapStyle = buildMapStyleConfig(payload.mapStyle || {}, payload, payload.chrome || {});
      const chartAnalysis = buildChartAnalysisConfig(payload.chartAnalysis || {}, payload.chrome || {});
      const kpiStyle = buildKpiStyleConfig(payload.kpiStyle || {}, payload.chrome || {}, payload);
      const kpiAnalysis = buildKpiAnalysisConfig(payload.kpiAnalysis || {}, payload);
      const tableStyle = buildTableStyleConfig(payload.tableStyle || {}, payload);
      const tabsStyle = buildTabsStyleConfig(payload.tabsStyle || {});
      const visualizationRows = widgetType === "table" ? preview.sampleRows : await loadReportDatasetRows(dataSource, datasetType, sourceTable, sourceSql);
      if (widgetType === "kpi") {
        return {
          ...buildKpiPreview(visualizationRows, fieldMap, chrome, kpiStyle, kpiAnalysis, payload),
          dataset,
          fields: preview.fields
        };
      }
      if (widgetType === "table") {
        return {
          ...buildTablePreview(preview.sampleRows, preview.fields, fieldMap, chrome, tableStyle, payload),
          dataset
        };
      }
      if (widgetType === "tabs") {
        const tabs = Array.isArray(payload.tabs) ? payload.tabs : [];
        const items = tabs.map((item, index) => {
          const tabType = String(item.widgetType || "chart").trim().toLowerCase();
          if (tabType === "kpi") {
            const itemKpiStyle = buildKpiStyleConfig(item.kpiStyle || {}, item.chrome || chrome, item);
            const itemKpiAnalysis = buildKpiAnalysisConfig(item.kpiAnalysis || {}, item);
            return {
              key: normalizeText(item.key, `tab_${index + 1}`),
              title: normalizeText(item.title, `\u6307\u6807\u9875\u7B7E ${index + 1}`),
              widgetType: "kpi",
              kpi: buildKpiPreview(visualizationRows, fieldMap, chrome, itemKpiStyle, itemKpiAnalysis, item).kpi,
              chrome: buildChromeConfig(item.chrome || chrome, item),
              kpiStyle: itemKpiStyle,
              kpiAnalysis: itemKpiAnalysis
            };
          }
          if (tabType === "table") {
            const itemTableStyle = buildTableStyleConfig(item.tableStyle || {}, item);
            return {
              key: normalizeText(item.key, `tab_${index + 1}`),
              title: normalizeText(item.title, `\u660E\u7EC6\u9875\u7B7E ${index + 1}`),
              widgetType: "table",
              table: buildTablePreview(preview.sampleRows, preview.fields, fieldMap, chrome, itemTableStyle, item).table,
              chrome: buildChromeConfig(item.chrome || chrome, item),
              tableStyle: itemTableStyle
            };
          }
          const tabChartAsset = chartAsset || null;
          const itemChartStyle = buildChartStyleConfig(item.chartStyle || {}, item, item.chrome || chrome);
          const itemMapStyle = buildMapStyleConfig(item.mapStyle || {}, item, item.chrome || chrome);
          const itemChartAnalysis = buildChartAnalysisConfig(item.chartAnalysis || {}, item.chrome || chrome);
          return {
            key: normalizeText(item.key, `tab_${index + 1}`),
            title: normalizeText(item.title, `\u56FE\u8868\u9875\u7B7E ${index + 1}`),
            widgetType: "chart",
            option: tabChartAsset ? applyChartStyle(buildChartOption(tabChartAsset, visualizationRows, fieldMap, {
              chartFamily: item.chartFamily || payload.chartFamily,
              variantName: item.variantName || payload.variantName,
              accentColor: itemChartStyle.accentColor || payload.accentColor,
              palettePreset: itemChartStyle.palettePreset || payload.palettePreset,
              palette: itemChartStyle.palette,
              barSeriesLayout: itemChartStyle.barSeriesLayout,
              barPrimaryColor: itemChartStyle.barPrimaryColor,
              barSecondaryColor: itemChartStyle.barSecondaryColor,
              barGap: itemChartStyle.barGap,
              barCategoryGap: itemChartStyle.barCategoryGap,
              barValuePosition: itemChartStyle.barValuePosition,
              horizontalBarPalette: itemChartStyle.horizontalBarPalette,
              horizontalBarColorCount: itemChartStyle.horizontalBarColorCount,
              horizontalBarSortOrder: itemChartStyle.horizontalBarSortOrder,
              legendPrimaryName: itemChartStyle.legendPrimaryName,
              legendSecondaryName: itemChartStyle.legendSecondaryName,
              radarLayout: itemChartStyle.radarLayout,
              radarPrimaryColor: itemChartStyle.radarPrimaryColor,
              radarSecondaryColor: itemChartStyle.radarSecondaryColor,
              radarPointColor: itemChartStyle.radarPointColor,
              radarAreaOpacity: itemChartStyle.radarAreaOpacity,
              mapRegionPalette: itemChartStyle.mapRegionPalette,
              mapRegionBorderColor: itemChartStyle.mapRegionBorderColor,
              mapLabelColor: itemChartStyle.mapLabelColor,
              mapVisualMapTextColor: itemChartStyle.mapVisualMapTextColor,
              provinceCode: itemMapStyle.provinceCode,
              showLabels: itemChartStyle.showLabels,
              showDataLabels: itemChartStyle.showDataLabels
            }), buildChromeConfig(item.chrome || chrome, item), itemChartStyle, itemMapStyle, itemChartAnalysis) : {},
            chrome: buildChromeConfig(item.chrome || chrome, item),
            chartStyle: itemChartStyle,
            mapStyle: itemMapStyle,
            chartAnalysis: itemChartAnalysis
          };
        });
        return {
          widgetType: "tabs",
          dataset,
          chartAsset,
          fields: preview.fields,
          sampleRows: visualizationRows,
          fieldMap,
          chrome,
          tabsStyle,
          tabs: {
            defaultActiveKey: items[0]?.key || null,
            items
          }
        };
      }
      return {
        widgetType: "chart",
        dataset,
        chartAsset,
        fields: preview.fields,
        sampleRows: visualizationRows,
        chartStyle,
        mapStyle,
        chartAnalysis,
        option: applyChartStyle(buildChartOption(chartAsset, visualizationRows, fieldMap, {
          chartFamily: payload.chartFamily,
          variantName: payload.variantName,
          accentColor: chartStyle.accentColor || payload.accentColor,
          palettePreset: chartStyle.palettePreset || payload.palettePreset,
          palette: chartStyle.palette,
          barSeriesLayout: chartStyle.barSeriesLayout,
          barPrimaryColor: chartStyle.barPrimaryColor,
          barSecondaryColor: chartStyle.barSecondaryColor,
          barGap: chartStyle.barGap,
          barCategoryGap: chartStyle.barCategoryGap,
          barValuePosition: chartStyle.barValuePosition,
          horizontalBarPalette: chartStyle.horizontalBarPalette,
          horizontalBarColorCount: chartStyle.horizontalBarColorCount,
          horizontalBarSortOrder: chartStyle.horizontalBarSortOrder,
          legendPrimaryName: chartStyle.legendPrimaryName,
          legendSecondaryName: chartStyle.legendSecondaryName,
          radarLayout: chartStyle.radarLayout,
          radarPrimaryColor: chartStyle.radarPrimaryColor,
          radarSecondaryColor: chartStyle.radarSecondaryColor,
          radarPointColor: chartStyle.radarPointColor,
          radarAreaOpacity: chartStyle.radarAreaOpacity,
          mapRegionPalette: chartStyle.mapRegionPalette,
          mapRegionBorderColor: chartStyle.mapRegionBorderColor,
          mapLabelColor: chartStyle.mapLabelColor,
          mapVisualMapTextColor: chartStyle.mapVisualMapTextColor,
          provinceCode: mapStyle.provinceCode,
          showLabels: chartStyle.showLabels,
          showDataLabels: chartStyle.showDataLabels
        }), chrome, chartStyle, mapStyle, chartAnalysis),
        fieldMap,
        chrome
      };
    }
    async function previewRuntimeDashboardChart(id, payload, options = {}) {
      await ensureReportDashboardRuntimeAccess(Number(id), options);
      const dashboard = await ensureReportDashboard(Number(id));
      return previewDashboardChart(resolveRuntimeDashboardPreviewPayload(dashboard, payload));
    }
    function resolveRuntimeDashboardPreviewPayload(dashboard, payload = {}) {
      const hasDirectBinding = Number(payload.datasetId || 0) > 0 || Number(payload.sourceId || 0) > 0 || Boolean(normalizeText(payload.sourceTable)) || Boolean(normalizeText(payload.sourceSql));
      if (hasDirectBinding) return payload;
      const widgets = Array.isArray(dashboard?.widgets) ? dashboard.widgets : [];
      const requestedKey = normalizeText(payload.widgetKey);
      const requestedWidget = requestedKey ? widgets.find((widget) => normalizeText(widget.widgetKey) === requestedKey) : null;
      const fallbackWidget = requestedWidget?.datasetId ? requestedWidget : widgets.find((widget) => Number(widget.datasetId || 0) > 0);
      if (fallbackWidget?.datasetId) {
        return { ...payload, datasetId: Number(fallbackWidget.datasetId) };
      }
      return payload;
    }
    module2.exports = {
      createReportChartAsset,
      createReportDashboard,
      createReportDataSource,
      createReportDataset,
      createReportDatasetFolder,
      createReportThemeTemplate,
      deleteReportChartAsset,
      deleteReportDashboard,
      deleteReportDataSource,
      deleteReportDataset,
      deleteReportDatasetFolder,
      deleteReportThemeTemplate,
      ensureReportDashboardRuntimeAccess,
      getOverview,
      getReportDashboard,
      getReportDashboardRuntime,
      listReportChartAssets,
      listReportDashboards,
      listReportDataSourceColumns,
      listReportDataSourceTables,
      listReportDataSources,
      listReportDatasets,
      listReportDatasetFolders,
      listReportThemeTemplates,
      allocateAiChartFieldMap,
      planAiChartSql,
      previewDashboardChart,
      previewRuntimeDashboardChart,
      normalizeReportTableColumns,
      resolveRuntimeDashboardPreviewPayload,
      previewReportDataset,
      publishReportDashboard,
      recommendAiChart,
      reviseAiChartSql,
      runAiChartQuery,
      sampleReportDataSourceRows,
      suggestAiChartAnalysis,
      testReportDataSourceConnection,
      updateReportChartAsset,
      updateReportDashboard,
      updateReportDataSource,
      updateReportDataset,
      updateReportDatasetFolder,
      updateReportThemeTemplate
    };
  }
});

// backend/src/modules/reporting/reporting.controller.js
var require_reporting_controller = __commonJS({
  "backend/src/modules/reporting/reporting.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var service = require_reporting_service();
    async function getOverview(req, res) {
      const data = await service.getOverview();
      return sendSuccess(res, data);
    }
    async function listReportDataSources(req, res) {
      const rows = await service.listReportDataSources();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createReportDataSource(req, res) {
      const row = await service.createReportDataSource(req.validatedBody);
      return sendSuccess(res, row, null, 201);
    }
    async function updateReportDataSource(req, res) {
      const row = await service.updateReportDataSource(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function deleteReportDataSource(req, res) {
      const data = await service.deleteReportDataSource(Number(req.params.id));
      return sendSuccess(res, data);
    }
    async function testReportDataSourceConnection(req, res) {
      const data = await service.testReportDataSourceConnection(req.validatedBody);
      return sendSuccess(res, data);
    }
    async function listReportDataSourceTables(req, res) {
      const rows = await service.listReportDataSourceTables(Number(req.params.id));
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listReportDataSourceColumns(req, res) {
      const rows = await service.listReportDataSourceColumns(Number(req.params.id), req.params.tableName);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function sampleReportDataSourceRows(req, res) {
      const rows = await service.sampleReportDataSourceRows(Number(req.params.id), req.params.tableName, req.query.limit);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listReportDatasets(req, res) {
      const rows = await service.listReportDatasets();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listReportDatasetFolders(req, res) {
      const rows = await service.listReportDatasetFolders();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createReportDatasetFolder(req, res) {
      const row = await service.createReportDatasetFolder(req.validatedBody);
      return sendSuccess(res, row, null, 201);
    }
    async function updateReportDatasetFolder(req, res) {
      const row = await service.updateReportDatasetFolder(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function deleteReportDatasetFolder(req, res) {
      const data = await service.deleteReportDatasetFolder(Number(req.params.id));
      return sendSuccess(res, data);
    }
    async function previewReportDataset(req, res) {
      const data = await service.previewReportDataset(req.validatedBody);
      return sendSuccess(res, data);
    }
    async function createReportDataset(req, res) {
      const row = await service.createReportDataset(req.validatedBody);
      return sendSuccess(res, row, null, 201);
    }
    async function updateReportDataset(req, res) {
      const row = await service.updateReportDataset(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function deleteReportDataset(req, res) {
      const data = await service.deleteReportDataset(Number(req.params.id));
      return sendSuccess(res, data);
    }
    async function listReportChartAssets(req, res) {
      const rows = await service.listReportChartAssets();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listReportThemeTemplates(req, res) {
      const rows = await service.listReportThemeTemplates();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listRuntimeReportThemeTemplates(req, res) {
      await service.ensureReportDashboardRuntimeAccess(Number(req.params.id), {
        shareToken: req.query.shareToken,
        user: req.user
      });
      const rows = await service.listReportThemeTemplates();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createReportThemeTemplate(req, res) {
      const row = await service.createReportThemeTemplate(req.validatedBody);
      return sendSuccess(res, row, null, 201);
    }
    async function updateReportThemeTemplate(req, res) {
      const row = await service.updateReportThemeTemplate(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function deleteReportThemeTemplate(req, res) {
      const data = await service.deleteReportThemeTemplate(Number(req.params.id));
      return sendSuccess(res, data);
    }
    async function createReportChartAsset(req, res) {
      const row = await service.createReportChartAsset(req.validatedBody);
      return sendSuccess(res, row, null, 201);
    }
    async function updateReportChartAsset(req, res) {
      const row = await service.updateReportChartAsset(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function deleteReportChartAsset(req, res) {
      const data = await service.deleteReportChartAsset(Number(req.params.id));
      return sendSuccess(res, data);
    }
    async function listReportDashboards(req, res) {
      const rows = await service.listReportDashboards();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getReportDashboard(req, res) {
      const row = await service.getReportDashboard(Number(req.params.id));
      return sendSuccess(res, row);
    }
    async function getReportDashboardRuntime(req, res) {
      const row = await service.getReportDashboardRuntime(Number(req.params.id), {
        shareToken: req.query.shareToken,
        user: req.user
      });
      return sendSuccess(res, row);
    }
    async function createReportDashboard(req, res) {
      const row = await service.createReportDashboard(req.validatedBody);
      return sendSuccess(res, row, null, 201);
    }
    async function updateReportDashboard(req, res) {
      const row = await service.updateReportDashboard(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function publishReportDashboard(req, res) {
      const row = await service.publishReportDashboard(Number(req.params.id), req.body || {});
      return sendSuccess(res, row);
    }
    async function deleteReportDashboard(req, res) {
      const data = await service.deleteReportDashboard(Number(req.params.id));
      return sendSuccess(res, data);
    }
    async function previewDashboardChart(req, res) {
      const data = await service.previewDashboardChart(req.validatedBody);
      return sendSuccess(res, data);
    }
    async function previewRuntimeDashboardChart(req, res) {
      const data = await service.previewRuntimeDashboardChart(Number(req.params.id), req.validatedBody, {
        shareToken: req.query.shareToken,
        user: req.user
      });
      return sendSuccess(res, data);
    }
    async function planAiChartSql(req, res) {
      const data = await service.planAiChartSql(req.validatedBody);
      return sendSuccess(res, data);
    }
    async function suggestAiChartAnalysis(req, res) {
      const data = await service.suggestAiChartAnalysis(req.validatedBody);
      return sendSuccess(res, data);
    }
    async function reviseAiChartSql(req, res) {
      const data = await service.reviseAiChartSql(req.validatedBody);
      return sendSuccess(res, data);
    }
    async function runAiChartQuery(req, res) {
      const data = await service.runAiChartQuery(req.validatedBody);
      return sendSuccess(res, data);
    }
    async function recommendAiChart(req, res) {
      const data = await service.recommendAiChart(req.validatedBody);
      return sendSuccess(res, data);
    }
    async function allocateAiChartFieldMap(req, res) {
      const data = await service.allocateAiChartFieldMap(req.validatedBody);
      return sendSuccess(res, data);
    }
    module2.exports = {
      createReportChartAsset,
      createReportDashboard,
      createReportDataSource,
      createReportDataset,
      createReportDatasetFolder,
      createReportThemeTemplate,
      deleteReportChartAsset,
      deleteReportDashboard,
      deleteReportDataSource,
      deleteReportDataset,
      deleteReportDatasetFolder,
      deleteReportThemeTemplate,
      getOverview,
      getReportDashboard,
      getReportDashboardRuntime,
      listReportChartAssets,
      listReportDashboards,
      listReportDataSourceColumns,
      listReportDataSourceTables,
      listReportDataSources,
      listReportDatasets,
      listReportDatasetFolders,
      listReportThemeTemplates,
      listRuntimeReportThemeTemplates,
      allocateAiChartFieldMap,
      planAiChartSql,
      previewDashboardChart,
      previewRuntimeDashboardChart,
      previewReportDataset,
      recommendAiChart,
      reviseAiChartSql,
      runAiChartQuery,
      sampleReportDataSourceRows,
      suggestAiChartAnalysis,
      testReportDataSourceConnection,
      publishReportDashboard,
      updateReportChartAsset,
      updateReportDashboard,
      updateReportDataSource,
      updateReportDataset,
      updateReportDatasetFolder,
      updateReportThemeTemplate
    };
  }
});

// packages/data-platform-module-platform/src/.runtime-entry.js
var controller0 = require_platform_controller();
var { Writable } = require("node:stream");
var handlers = {
  "GET /api/v1/platform/overview": controller0["overview"],
  "GET /api/health": async (_req, res) => res.json({ status: "ok", service: "medata-platform" }),
  "GET /api/v1/platform/database-capabilities": async (_req, res) => res.json({ data: require_datasource_capabilities().getRuntimeDatabaseCapabilityStatus() }),
  "GET /api/v1/jobs/:id": async (req, res) => res.json(await require_data_service_service().inspectServiceJob(Number(req.params.id), { headers: req.headers, ip: req.ip, req })),
  "POST /api/auth/login": require_auth_controller().login,
  "GET /api/auth/profile": require_auth_controller().profile,
  "GET /api/v1/reporting/runtime/dashboards/:id": require_reporting_controller().getReportDashboardRuntime
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
