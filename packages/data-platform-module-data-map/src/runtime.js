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

// backend/src/modules/data-map/data-map.repository.js
var require_data_map_repository = __commonJS({
  "backend/src/modules/data-map/data-map.repository.js"(exports2, module2) {
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
    function appendScopedWhere(where, params, alias) {
      const scoped = getScopedWhere(alias);
      if (scoped.sql) {
        where.push(scoped.sql);
        params.push(...scoped.params);
      }
      return scoped.projectId;
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
    function json(value, fallback) {
      return JSON.stringify(value === void 0 ? fallback : value);
    }
    function toNumber(value) {
      return value === null || value === void 0 ? null : Number(value);
    }
    function mapDepartment(row) {
      return {
        id: Number(row.id),
        departmentName: row.departmentName,
        departmentCode: row.departmentCode,
        departmentShortName: row.departmentShortName || "",
        parentId: toNumber(row.parentId),
        parentName: row.parentName || null,
        contactName: row.contactName || "",
        contactPhone: row.contactPhone || "",
        contactEmail: row.contactEmail || "",
        dataOwner: row.dataOwner || "",
        dataSteward: row.dataSteward || "",
        description: row.description || "",
        tags: parseJson(row.tags, []),
        status: row.status,
        systemCount: Number(row.systemCount || 0),
        sourceCount: Number(row.sourceCount || 0),
        resourceCount: Number(row.resourceCount || 0),
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapBusinessSystem(row) {
      return {
        id: Number(row.id),
        departmentId: Number(row.departmentId),
        departmentName: row.departmentName || "",
        departmentCode: row.departmentCode || "",
        systemName: row.systemName,
        systemCode: row.systemCode,
        systemShortName: row.systemShortName || "",
        systemType: row.systemType || "",
        systemLevel: row.systemLevel || "",
        lifecycleStatus: row.lifecycleStatus || "online",
        onlineDate: row.onlineDate || null,
        contactName: row.contactName || "",
        contactPhone: row.contactPhone || "",
        vendorName: row.vendorName || "",
        techOwner: row.techOwner || "",
        description: row.description || "",
        tags: parseJson(row.tags, []),
        status: row.status,
        sourceCount: Number(row.sourceCount || 0),
        resourceCount: Number(row.resourceCount || 0),
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapDataSource(row) {
      return {
        id: Number(row.id),
        departmentId: Number(row.departmentId),
        departmentName: row.departmentName || "",
        departmentCode: row.departmentCode || "",
        businessSystemId: toNumber(row.businessSystemId),
        systemName: row.systemName || "",
        systemCode: row.systemCode || "",
        sourceName: row.sourceName,
        sourceCode: row.sourceCode,
        sourceType: row.sourceType,
        connectionConfig: parseJson(row.connectionConfig, {}),
        ownerName: row.ownerName || "system",
        environment: row.environment || "prod",
        purpose: row.purpose || "",
        sourceRefModule: row.sourceRefModule || "",
        sourceRefId: toNumber(row.sourceRefId),
        sourceRefCode: row.sourceRefCode || "",
        sourceRefSnapshot: parseJson(row.sourceRefSnapshot, null),
        importedAt: row.importedAt || null,
        status: row.status,
        resourceCount: Number(row.resourceCount || 0),
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapCatalog(row) {
      return {
        id: Number(row.id),
        parentId: toNumber(row.parentId),
        catalogName: row.catalogName,
        catalogShortCode: row.catalogShortCode,
        layerCode: row.layerCode || "",
        departmentId: Number(row.departmentId),
        departmentName: row.departmentName || "",
        departmentCode: row.departmentCode || "",
        businessSystemId: toNumber(row.businessSystemId),
        systemName: row.systemName || "",
        systemCode: row.systemCode || "",
        ownerName: row.ownerName || "",
        description: row.description || "",
        sortOrder: Number(row.sortOrder || 0),
        status: row.status,
        resourceCount: Number(row.resourceCount || 0),
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapResource(row) {
      return {
        id: Number(row.id),
        resourceCode: row.resourceCode,
        catalogId: Number(row.catalogId),
        catalogName: row.catalogName || "",
        catalogShortCode: row.catalogShortCode || "",
        departmentId: Number(row.departmentId),
        departmentName: row.departmentName || "",
        departmentCode: row.departmentCode || "",
        businessSystemId: Number(row.businessSystemId),
        systemName: row.systemName || "",
        systemCode: row.systemCode || "",
        dataSourceId: Number(row.dataSourceId),
        sourceName: row.sourceName || "",
        sourceCode: row.sourceCode || "",
        sourceType: row.sourceType || "",
        tableName: row.tableName,
        tableComment: row.tableComment || "",
        rowCount: row.rowCount === null || row.rowCount === void 0 ? null : Number(row.rowCount),
        rowCountMode: row.rowCountMode || "estimated",
        columnCount: Number(row.columnCount || 0),
        resourceCategory: row.resourceCategory || "",
        businessTags: parseJson(row.businessTags, []),
        sourceSnapshot: parseJson(row.sourceSnapshot, {}),
        status: row.status,
        lastSyncedAt: row.lastSyncedAt || null,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapResourceField(row) {
      const standardMapping = row.standardElementId ? {
        id: Number(row.standardMappingId),
        elementId: Number(row.standardElementId),
        elementCode: row.standardElementCode || "",
        elementNameCn: row.standardElementNameCn || "",
        elementNameEn: row.standardElementNameEn || "",
        mappingStatus: row.standardMappingStatus || "",
        confidence: row.standardMappingConfidence === null || row.standardMappingConfidence === void 0 ? null : Number(row.standardMappingConfidence),
        evidence: parseJson(row.standardMappingEvidence, []),
        updatedAt: row.standardMappingUpdatedAt || null
      } : null;
      return {
        id: Number(row.id),
        resourceId: Number(row.resourceId),
        columnName: row.columnName,
        ordinalPosition: Number(row.ordinalPosition || 0),
        dataType: row.dataType || "",
        columnType: row.columnType || "",
        isNullable: Boolean(row.isNullable),
        isPrimaryKey: Boolean(row.isPrimaryKey),
        columnDefault: row.columnDefault,
        columnComment: row.columnComment || "",
        businessName: row.businessName || "",
        semanticTags: parseJson(row.semanticTags, []),
        standardMapping,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapLineageEdge(row) {
      return {
        id: Number(row.id),
        sourceResourceId: toNumber(row.sourceResourceId),
        targetResourceId: toNumber(row.targetResourceId),
        sourceDataSourceId: toNumber(row.sourceDataSourceId),
        targetDataSourceId: toNumber(row.targetDataSourceId),
        sourceTableName: row.sourceTableName,
        targetTableName: row.targetTableName,
        sourceResourceCode: row.sourceResourceCode || "",
        targetResourceCode: row.targetResourceCode || "",
        sourceName: row.sourceName || "",
        targetName: row.targetName || "",
        lineageType: row.lineageType,
        relationLevel: row.relationLevel,
        relationSource: row.relationSource,
        relationSourceId: toNumber(row.relationSourceId),
        confidence: row.confidence,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapResourceContent(row) {
      return {
        id: Number(row.id),
        resourceId: Number(row.resourceId),
        businessName: row.businessName || "",
        businessDefinition: row.businessDefinition || "",
        businessGrain: row.businessGrain || "",
        updateFrequency: row.updateFrequency || "",
        dataOwner: row.dataOwner || "",
        techOwner: row.techOwner || "",
        usageScenarios: parseJson(row.usageScenarios, []),
        usageInstruction: row.usageInstruction || "",
        qualityNote: row.qualityNote || "",
        knownIssues: row.knownIssues || "",
        retentionPeriod: row.retentionPeriod || "",
        serviceSla: row.serviceSla || "",
        extension: parseJson(row.extension, {}),
        updatedBy: row.updatedBy || "system",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapResourceProfile(row) {
      return {
        id: Number(row.id),
        resourceId: Number(row.resourceId),
        profileStatus: row.profileStatus || "pending",
        sampleCount: Number(row.sampleCount || 0),
        rowCount: row.rowCount === null || row.rowCount === void 0 ? null : Number(row.rowCount),
        columnCount: Number(row.columnCount || 0),
        nullableFieldCount: Number(row.nullableFieldCount || 0),
        primaryKeyFields: parseJson(row.primaryKeyFields, []),
        timeRange: parseJson(row.timeRange, {}),
        qualitySummary: parseJson(row.qualitySummary, {}),
        profile: parseJson(row.profile, {}),
        aiSummary: row.aiSummary || "",
        aiOutput: parseJson(row.aiOutput, null),
        aiAnalyzedAt: row.aiAnalyzedAt || null,
        errorMessage: row.errorMessage || "",
        profiledAt: row.profiledAt || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapResourceFieldProfile(row) {
      return {
        id: Number(row.id),
        resourceId: Number(row.resourceId),
        columnName: row.columnName,
        nullRate: row.nullRate === null || row.nullRate === void 0 ? null : Number(row.nullRate),
        sampleValues: parseJson(row.sampleValues, []),
        issueTags: parseJson(row.issueTags, []),
        semanticTags: parseJson(row.semanticTags, []),
        featureTags: parseJson(row.featureTags, []),
        aiBusinessName: row.aiBusinessName || "",
        aiBusinessMeaning: row.aiBusinessMeaning || "",
        aiOutput: parseJson(row.aiOutput, null),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapAiConfig(row) {
      return {
        id: Number(row.id),
        sceneName: row.sceneName,
        sceneCode: row.sceneCode,
        defaultModelProviderId: toNumber(row.defaultModelProviderId),
        defaultModelProviderName: row.defaultModelProviderName || null,
        defaultModelName: row.defaultModelName || null,
        defaultModelVersion: row.defaultModelVersion || null,
        temperature: row.temperature === null || row.temperature === void 0 ? null : Number(row.temperature),
        maxTokens: row.maxTokens === null || row.maxTokens === void 0 ? null : Number(row.maxTokens),
        timeoutMs: row.timeoutMs === null || row.timeoutMs === void 0 ? null : Number(row.timeoutMs),
        systemPrompt: row.systemPrompt || "",
        userPromptTemplate: row.userPromptTemplate || "",
        outputSchema: parseJson(row.outputSchema, {}),
        description: row.description || "",
        ownerName: row.ownerName || "System Administrator",
        status: row.status || "active",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    async function listDepartments() {
      const scoped = getScopedWhere("d");
      const [rows] = await pool.query(
        `SELECT d.id, d.department_name AS departmentName, d.department_code AS departmentCode,
            d.department_short_name AS departmentShortName, d.parent_id AS parentId,
            p.department_name AS parentName, d.contact_name AS contactName, d.contact_phone AS contactPhone,
            d.contact_email AS contactEmail, d.data_owner AS dataOwner, d.data_steward AS dataSteward,
            d.description, d.tags_json AS tags, d.status, d.created_by AS createdBy,
            d.created_at AS createdAt, d.updated_at AS updatedAt,
            COUNT(DISTINCT bs.id) AS systemCount,
            COUNT(DISTINCT ds.id) AS sourceCount,
            COUNT(DISTINCT r.id) AS resourceCount
     FROM dm_departments d
     LEFT JOIN dm_departments p ON p.id = d.parent_id
     LEFT JOIN dm_business_systems bs ON bs.department_id = d.id
     LEFT JOIN dm_data_sources ds ON ds.department_id = d.id
     LEFT JOIN dm_resources r ON r.department_id = d.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     GROUP BY d.id, p.department_name
     ORDER BY d.id DESC`,
        scoped.params
      );
      return rows.map(mapDepartment);
    }
    async function getDepartmentById(id) {
      const rows = await listDepartments();
      return rows.find((row) => row.id === Number(id)) || null;
    }
    async function createDepartment(payload, userName) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO dm_departments
      (project_id, department_name, department_code, department_short_name, parent_id, contact_name, contact_phone,
       contact_email, data_owner, data_steward, description, tags_json, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.departmentName,
          payload.departmentCode,
          payload.departmentShortName || null,
          payload.parentId || null,
          payload.contactName || null,
          payload.contactPhone || null,
          payload.contactEmail || null,
          payload.dataOwner || null,
          payload.dataSteward || null,
          payload.description || null,
          json(payload.tags, []),
          payload.status,
          userName || "system"
        ]
      );
      return getDepartmentById(result.insertId);
    }
    async function updateDepartment(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `UPDATE dm_departments
     SET department_name = ?, department_code = ?, department_short_name = ?, parent_id = ?,
         contact_name = ?, contact_phone = ?, contact_email = ?, data_owner = ?, data_steward = ?,
         description = ?, tags_json = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          payload.departmentName,
          payload.departmentCode,
          payload.departmentShortName || null,
          payload.parentId || null,
          payload.contactName || null,
          payload.contactPhone || null,
          payload.contactEmail || null,
          payload.dataOwner || null,
          payload.dataSteward || null,
          payload.description || null,
          json(payload.tags, []),
          payload.status,
          id,
          ...scoped.params
        ]
      );
      return Number(result.affectedRows || 0) > 0 ? getDepartmentById(id) : null;
    }
    async function deleteDepartment(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM dm_departments WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return Number(result.affectedRows || 0) > 0;
    }
    async function listBusinessSystems() {
      const scoped = getScopedWhere("bs");
      const [rows] = await pool.query(
        `SELECT bs.id, bs.department_id AS departmentId, d.department_name AS departmentName,
            d.department_code AS departmentCode, bs.system_name AS systemName, bs.system_code AS systemCode,
            bs.system_short_name AS systemShortName, bs.system_type AS systemType, bs.system_level AS systemLevel,
            bs.lifecycle_status AS lifecycleStatus, bs.online_date AS onlineDate, bs.contact_name AS contactName,
            bs.contact_phone AS contactPhone, bs.vendor_name AS vendorName, bs.tech_owner AS techOwner,
            bs.description, bs.tags_json AS tags, bs.status, bs.created_by AS createdBy,
            bs.created_at AS createdAt, bs.updated_at AS updatedAt,
            COUNT(DISTINCT ds.id) AS sourceCount,
            COUNT(DISTINCT r.id) AS resourceCount
     FROM dm_business_systems bs
     JOIN dm_departments d ON d.id = bs.department_id
     LEFT JOIN dm_data_sources ds ON ds.business_system_id = bs.id
     LEFT JOIN dm_resources r ON r.business_system_id = bs.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     GROUP BY bs.id, d.department_name, d.department_code
     ORDER BY bs.id DESC`,
        scoped.params
      );
      return rows.map(mapBusinessSystem);
    }
    async function getBusinessSystemById(id) {
      const rows = await listBusinessSystems();
      return rows.find((row) => row.id === Number(id)) || null;
    }
    async function createBusinessSystem(payload, userName) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO dm_business_systems
      (project_id, department_id, system_name, system_code, system_short_name, system_type, system_level,
       lifecycle_status, online_date, contact_name, contact_phone, vendor_name, tech_owner,
       description, tags_json, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.departmentId,
          payload.systemName,
          payload.systemCode,
          payload.systemShortName || null,
          payload.systemType || null,
          payload.systemLevel || null,
          payload.lifecycleStatus || "online",
          payload.onlineDate || null,
          payload.contactName || null,
          payload.contactPhone || null,
          payload.vendorName || null,
          payload.techOwner || null,
          payload.description || null,
          json(payload.tags, []),
          payload.status,
          userName || "system"
        ]
      );
      return getBusinessSystemById(result.insertId);
    }
    async function updateBusinessSystem(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `UPDATE dm_business_systems
     SET department_id = ?, system_name = ?, system_code = ?, system_short_name = ?, system_type = ?,
         system_level = ?, lifecycle_status = ?, online_date = ?, contact_name = ?, contact_phone = ?,
         vendor_name = ?, tech_owner = ?, description = ?, tags_json = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          payload.departmentId,
          payload.systemName,
          payload.systemCode,
          payload.systemShortName || null,
          payload.systemType || null,
          payload.systemLevel || null,
          payload.lifecycleStatus || "online",
          payload.onlineDate || null,
          payload.contactName || null,
          payload.contactPhone || null,
          payload.vendorName || null,
          payload.techOwner || null,
          payload.description || null,
          json(payload.tags, []),
          payload.status,
          id,
          ...scoped.params
        ]
      );
      return Number(result.affectedRows || 0) > 0 ? getBusinessSystemById(id) : null;
    }
    async function deleteBusinessSystem(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM dm_business_systems WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return Number(result.affectedRows || 0) > 0;
    }
    async function listDataSources() {
      const scoped = getScopedWhere("ds");
      const [rows] = await pool.query(
        `SELECT ds.id, ds.department_id AS departmentId, d.department_name AS departmentName,
            d.department_code AS departmentCode, ds.business_system_id AS businessSystemId,
            bs.system_name AS systemName, bs.system_code AS systemCode,
            ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType,
            ds.connection_config AS connectionConfig, ds.owner_name AS ownerName, ds.environment,
            ds.purpose, ds.source_ref_module AS sourceRefModule, ds.source_ref_id AS sourceRefId,
            ds.source_ref_code AS sourceRefCode, ds.source_ref_snapshot_json AS sourceRefSnapshot,
            ds.imported_at AS importedAt, ds.status, ds.created_by AS createdBy,
            ds.created_at AS createdAt, ds.updated_at AS updatedAt,
            COUNT(DISTINCT r.id) AS resourceCount
     FROM dm_data_sources ds
     JOIN dm_departments d ON d.id = ds.department_id
     JOIN dm_business_systems bs ON bs.id = ds.business_system_id
     LEFT JOIN dm_resources r ON r.data_source_id = ds.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     GROUP BY ds.id, d.department_name, d.department_code, bs.system_name, bs.system_code
     ORDER BY ds.id DESC`,
        scoped.params
      );
      return rows.map(mapDataSource);
    }
    async function getDataSourceById(id) {
      const scoped = getScopedWhere("ds");
      const [rows] = await pool.query(
        `SELECT ds.id, ds.department_id AS departmentId, d.department_name AS departmentName,
            d.department_code AS departmentCode, ds.business_system_id AS businessSystemId,
            bs.system_name AS systemName, bs.system_code AS systemCode,
            ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType,
            ds.connection_config AS connectionConfig, ds.owner_name AS ownerName, ds.environment,
            ds.purpose, ds.source_ref_module AS sourceRefModule, ds.source_ref_id AS sourceRefId,
            ds.source_ref_code AS sourceRefCode, ds.source_ref_snapshot_json AS sourceRefSnapshot,
            ds.imported_at AS importedAt, ds.status, ds.created_by AS createdBy,
            ds.created_at AS createdAt, ds.updated_at AS updatedAt,
            COUNT(DISTINCT r.id) AS resourceCount
     FROM dm_data_sources ds
     JOIN dm_departments d ON d.id = ds.department_id
     JOIN dm_business_systems bs ON bs.id = ds.business_system_id
     LEFT JOIN dm_resources r ON r.data_source_id = ds.id
     WHERE ds.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     GROUP BY ds.id, d.department_name, d.department_code, bs.system_name, bs.system_code`,
        [id, ...scoped.params]
      );
      return rows[0] ? mapDataSource(rows[0]) : null;
    }
    async function createDataSource(payload, departmentId, userName) {
      const projectId = getCurrentProjectId();
      const sourceRefSnapshot = payload.sourceRefSnapshot || null;
      const [result] = await pool.query(
        `INSERT INTO dm_data_sources
      (project_id, department_id, business_system_id, source_name, source_code, source_type, connection_config,
       owner_name, environment, purpose, source_ref_module, source_ref_id, source_ref_code,
       source_ref_snapshot_json, imported_at, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          departmentId,
          payload.businessSystemId,
          payload.sourceName,
          payload.sourceCode,
          payload.sourceType,
          json(payload.connectionConfig, {}),
          payload.ownerName || "system",
          payload.environment || "prod",
          payload.purpose || null,
          payload.sourceRefModule || null,
          payload.sourceRefId || null,
          payload.sourceRefCode || null,
          sourceRefSnapshot ? json(sourceRefSnapshot, {}) : null,
          payload.sourceRefModule ? /* @__PURE__ */ new Date() : null,
          payload.status,
          userName || "system"
        ]
      );
      return getDataSourceById(result.insertId);
    }
    async function updateDataSource(id, payload, departmentId) {
      const scoped = getScopedWhere("");
      const sourceRefSnapshot = payload.sourceRefSnapshot || null;
      const [result] = await pool.query(
        `UPDATE dm_data_sources
     SET department_id = ?, business_system_id = ?, source_name = ?, source_code = ?, source_type = ?,
         connection_config = ?, owner_name = ?, environment = ?, purpose = ?, source_ref_module = ?,
         source_ref_id = ?, source_ref_code = ?, source_ref_snapshot_json = ?, imported_at = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          departmentId,
          payload.businessSystemId,
          payload.sourceName,
          payload.sourceCode,
          payload.sourceType,
          json(payload.connectionConfig, {}),
          payload.ownerName || "system",
          payload.environment || "prod",
          payload.purpose || null,
          payload.sourceRefModule || null,
          payload.sourceRefId || null,
          payload.sourceRefCode || null,
          sourceRefSnapshot ? json(sourceRefSnapshot, {}) : null,
          payload.sourceRefModule ? /* @__PURE__ */ new Date() : null,
          payload.status,
          id,
          ...scoped.params
        ]
      );
      return Number(result.affectedRows || 0) > 0 ? getDataSourceById(id) : null;
    }
    async function deleteDataSource(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM dm_data_sources WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return Number(result.affectedRows || 0) > 0;
    }
    async function listCatalogs() {
      const scoped = getScopedWhere("c");
      const [rows] = await pool.query(
        `SELECT c.id, c.parent_id AS parentId, c.catalog_name AS catalogName, c.catalog_short_code AS catalogShortCode,
            c.layer_code AS layerCode, c.department_id AS departmentId, d.department_name AS departmentName,
            d.department_code AS departmentCode, c.business_system_id AS businessSystemId,
            bs.system_name AS systemName, bs.system_code AS systemCode, c.owner_name AS ownerName,
            c.description, c.sort_order AS sortOrder, c.status, c.created_by AS createdBy,
            c.created_at AS createdAt, c.updated_at AS updatedAt,
            COUNT(DISTINCT r.id) AS resourceCount
     FROM dm_catalogs c
     JOIN dm_departments d ON d.id = c.department_id
     LEFT JOIN dm_business_systems bs ON bs.id = c.business_system_id
     LEFT JOIN dm_resources r ON r.catalog_id = c.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     GROUP BY c.id, d.department_name, d.department_code, bs.system_name, bs.system_code
     ORDER BY c.sort_order ASC, c.id DESC`,
        scoped.params
      );
      return rows.map(mapCatalog);
    }
    async function getCatalogById(id) {
      const rows = await listCatalogs();
      return rows.find((row) => row.id === Number(id)) || null;
    }
    async function createCatalog(payload, userName) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO dm_catalogs
      (project_id, parent_id, catalog_name, catalog_short_code, layer_code, department_id, business_system_id,
       owner_name, description, sort_order, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.parentId || null,
          payload.catalogName,
          payload.catalogShortCode,
          payload.layerCode || null,
          payload.departmentId,
          payload.businessSystemId || null,
          payload.ownerName || null,
          payload.description || null,
          Number(payload.sortOrder || 0),
          payload.status,
          userName || "system"
        ]
      );
      return getCatalogById(result.insertId);
    }
    async function updateCatalog(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `UPDATE dm_catalogs
     SET parent_id = ?, catalog_name = ?, catalog_short_code = ?, layer_code = ?, department_id = ?,
         business_system_id = ?, owner_name = ?, description = ?, sort_order = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          payload.parentId || null,
          payload.catalogName,
          payload.catalogShortCode,
          payload.layerCode || null,
          payload.departmentId,
          payload.businessSystemId || null,
          payload.ownerName || null,
          payload.description || null,
          Number(payload.sortOrder || 0),
          payload.status,
          id,
          ...scoped.params
        ]
      );
      return Number(result.affectedRows || 0) > 0 ? getCatalogById(id) : null;
    }
    async function deleteCatalog(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM dm_catalogs WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return Number(result.affectedRows || 0) > 0;
    }
    async function listResources(filters = {}) {
      const where = [];
      const params = [];
      appendScopedWhere(where, params, "r");
      if (filters.keyword) {
        where.push("(r.resource_code LIKE ? OR r.table_name LIKE ? OR r.table_comment LIKE ?)");
        const keyword = `%${filters.keyword}%`;
        params.push(keyword, keyword, keyword);
      }
      if (filters.departmentId) {
        where.push("r.department_id = ?");
        params.push(Number(filters.departmentId));
      }
      if (filters.businessSystemId) {
        where.push("r.business_system_id = ?");
        params.push(Number(filters.businessSystemId));
      }
      if (filters.catalogId) {
        where.push("r.catalog_id = ?");
        params.push(Number(filters.catalogId));
      }
      if (filters.dataSourceId) {
        where.push("r.data_source_id = ?");
        params.push(Number(filters.dataSourceId));
      }
      if (filters.resourceCategory) {
        where.push("r.resource_category = ?");
        params.push(filters.resourceCategory);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const [rows] = await pool.query(
        `SELECT r.id, r.resource_code AS resourceCode, r.catalog_id AS catalogId,
            c.catalog_name AS catalogName, c.catalog_short_code AS catalogShortCode,
            r.department_id AS departmentId, d.department_name AS departmentName,
            d.department_code AS departmentCode, r.business_system_id AS businessSystemId,
            bs.system_name AS systemName, bs.system_code AS systemCode,
            r.data_source_id AS dataSourceId, ds.source_name AS sourceName,
            ds.source_code AS sourceCode, ds.source_type AS sourceType,
            r.table_name AS tableName, r.table_comment AS tableComment, r.row_count AS rowCount,
            r.row_count_mode AS rowCountMode, r.column_count AS columnCount,
            r.resource_category AS resourceCategory, r.business_tags_json AS businessTags,
            r.source_snapshot_json AS sourceSnapshot, r.status, r.last_synced_at AS lastSyncedAt,
            r.created_by AS createdBy, r.created_at AS createdAt, r.updated_at AS updatedAt
     FROM dm_resources r
     JOIN dm_catalogs c ON c.id = r.catalog_id
     JOIN dm_departments d ON d.id = r.department_id
     JOIN dm_business_systems bs ON bs.id = r.business_system_id
     JOIN dm_data_sources ds ON ds.id = r.data_source_id
     ${whereSql}
     ORDER BY r.updated_at DESC, r.id DESC`,
        params
      );
      return rows.map(mapResource);
    }
    async function searchResources(filters = {}) {
      const where = [];
      const params = [];
      appendScopedWhere(where, params, "r");
      const keyword = String(filters.keyword || "").trim();
      const fieldKeyword = String(filters.fieldKeyword || "").trim();
      const tag = String(filters.tag || "").trim();
      const limit = Math.min(Math.max(Number(filters.limit || 100), 1), 500);
      if (keyword) {
        const keywordLike = `%${keyword}%`;
        const rawScopes = String(filters.keywordScopes || "").split(",").map((item) => item.trim()).filter(Boolean);
        const scopes = new Set(rawScopes.length > 0 ? rawScopes : ["resource", "field", "tag", "source"]);
        const keywordWhere = [];
        if (scopes.has("resource")) {
          keywordWhere.push("(r.resource_code LIKE ? OR r.table_name LIKE ? OR r.table_comment LIKE ? OR rc.business_name LIKE ? OR rc.business_definition LIKE ?)");
          params.push(keywordLike, keywordLike, keywordLike, keywordLike, keywordLike);
        }
        if (scopes.has("field")) {
          keywordWhere.push(
            `EXISTS (
          SELECT 1 FROM dm_resource_fields rf
          WHERE rf.resource_id = r.id
            AND (rf.column_name LIKE ? OR rf.column_comment LIKE ? OR rf.business_name LIKE ? OR rf.semantic_tags_json LIKE ?)
        )`
          );
          params.push(keywordLike, keywordLike, keywordLike, keywordLike);
        }
        if (scopes.has("tag")) {
          keywordWhere.push("r.business_tags_json LIKE ?");
          params.push(keywordLike);
        }
        if (scopes.has("source")) {
          keywordWhere.push(
            `(c.catalog_name LIKE ? OR c.catalog_short_code LIKE ?
          OR d.department_name LIKE ? OR d.department_code LIKE ?
          OR bs.system_name LIKE ? OR bs.system_code LIKE ?
          OR ds.source_name LIKE ? OR ds.source_code LIKE ?)`
          );
          params.push(keywordLike, keywordLike, keywordLike, keywordLike, keywordLike, keywordLike, keywordLike, keywordLike);
        }
        if (keywordWhere.length > 0) {
          where.push(`(${keywordWhere.join(" OR ")})`);
        }
      }
      if (fieldKeyword) {
        const fieldKeywordLike = `%${fieldKeyword}%`;
        where.push(
          `EXISTS (
        SELECT 1 FROM dm_resource_fields rf
        WHERE rf.resource_id = r.id
          AND (rf.column_name LIKE ? OR rf.column_comment LIKE ? OR rf.business_name LIKE ? OR rf.semantic_tags_json LIKE ?)
      )`
        );
        params.push(fieldKeywordLike, fieldKeywordLike, fieldKeywordLike, fieldKeywordLike);
      }
      if (filters.departmentId) {
        where.push("r.department_id = ?");
        params.push(Number(filters.departmentId));
      }
      if (filters.businessSystemId) {
        where.push("r.business_system_id = ?");
        params.push(Number(filters.businessSystemId));
      }
      if (filters.catalogId) {
        where.push("r.catalog_id = ?");
        params.push(Number(filters.catalogId));
      }
      if (filters.dataSourceId) {
        where.push("r.data_source_id = ?");
        params.push(Number(filters.dataSourceId));
      }
      if (filters.resourceCategory) {
        where.push("r.resource_category = ?");
        params.push(filters.resourceCategory);
      }
      if (filters.status) {
        where.push("r.status = ?");
        params.push(filters.status);
      }
      if (filters.profileStatus) {
        where.push("COALESCE(rp.profile_status, 'pending') = ?");
        params.push(filters.profileStatus);
      }
      if (tag) {
        where.push("r.business_tags_json LIKE ?");
        params.push(`%${tag}%`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const [rows] = await pool.query(
        `SELECT r.id, r.resource_code AS resourceCode, r.catalog_id AS catalogId,
            c.catalog_name AS catalogName, c.catalog_short_code AS catalogShortCode,
            r.department_id AS departmentId, d.department_name AS departmentName,
            d.department_code AS departmentCode, r.business_system_id AS businessSystemId,
            bs.system_name AS systemName, bs.system_code AS systemCode,
            r.data_source_id AS dataSourceId, ds.source_name AS sourceName,
            ds.source_code AS sourceCode, ds.source_type AS sourceType,
            r.table_name AS tableName, r.table_comment AS tableComment, r.row_count AS rowCount,
            r.row_count_mode AS rowCountMode, r.column_count AS columnCount,
            r.resource_category AS resourceCategory, r.business_tags_json AS businessTags,
            r.source_snapshot_json AS sourceSnapshot, r.status, r.last_synced_at AS lastSyncedAt,
            r.created_by AS createdBy, r.created_at AS createdAt, r.updated_at AS updatedAt,
            rc.business_name AS businessName, rc.business_definition AS businessDefinition,
            rc.business_grain AS businessGrain, rc.data_owner AS dataOwner, rc.tech_owner AS techOwner,
            COALESCE(rp.profile_status, 'pending') AS profileStatus, rp.sample_count AS sampleCount,
            rp.ai_summary AS aiSummary, rp.profiled_at AS profiledAt, rp.ai_analyzed_at AS aiAnalyzedAt,
            fieldAgg.field_count AS fieldCount, fieldAgg.field_names AS fieldNames
     FROM dm_resources r
     JOIN dm_catalogs c ON c.id = r.catalog_id
     JOIN dm_departments d ON d.id = r.department_id
     JOIN dm_business_systems bs ON bs.id = r.business_system_id
     JOIN dm_data_sources ds ON ds.id = r.data_source_id
     LEFT JOIN dm_resource_contents rc ON rc.resource_id = r.id
     LEFT JOIN dm_resource_profiles rp ON rp.resource_id = r.id
     LEFT JOIN (
       SELECT resource_id, COUNT(*) AS field_count,
              GROUP_CONCAT(column_name ORDER BY ordinal_position ASC SEPARATOR ',') AS field_names
       FROM dm_resource_fields
       GROUP BY resource_id
     ) fieldAgg ON fieldAgg.resource_id = r.id
     ${whereSql}
     ORDER BY r.updated_at DESC, r.id DESC
     LIMIT ?`,
        [...params, limit]
      );
      return rows.map((row) => ({
        ...mapResource(row),
        businessName: row.businessName || "",
        businessDefinition: row.businessDefinition || "",
        businessGrain: row.businessGrain || "",
        dataOwner: row.dataOwner || "",
        techOwner: row.techOwner || "",
        profileStatus: row.profileStatus || "pending",
        sampleCount: Number(row.sampleCount || 0),
        aiSummary: row.aiSummary || "",
        profiledAt: row.profiledAt || null,
        aiAnalyzedAt: row.aiAnalyzedAt || null,
        fieldCount: Number(row.fieldCount || row.columnCount || 0),
        fieldNames: String(row.fieldNames || "").split(",").map((item) => item.trim()).filter(Boolean)
      }));
    }
    async function getResourceById(id) {
      const rows = await listResources({});
      return rows.find((row) => row.id === Number(id)) || null;
    }
    async function listResourceFields(resourceId) {
      const [rows] = await pool.query(
        `SELECT f.id, f.resource_id AS resourceId, f.column_name AS columnName, f.ordinal_position AS ordinalPosition,
            f.data_type AS dataType, f.column_type AS columnType, f.is_nullable AS isNullable,
            f.is_primary_key AS isPrimaryKey, f.column_default AS columnDefault, f.column_comment AS columnComment,
            f.business_name AS businessName, f.semantic_tags_json AS semanticTags, f.status,
            f.created_at AS createdAt, f.updated_at AS updatedAt,
            sm.id AS standardMappingId, sm.mapping_status AS standardMappingStatus,
            sm.confidence AS standardMappingConfidence, sm.evidence_json AS standardMappingEvidence,
            sm.updated_at AS standardMappingUpdatedAt,
            e.id AS standardElementId, e.element_code AS standardElementCode,
            e.element_name_cn AS standardElementNameCn, e.element_name_en AS standardElementNameEn
     FROM dm_resource_fields f
     JOIN dm_resources r ON r.id = f.resource_id
     LEFT JOIN std_field_mappings sm ON sm.id = (
       SELECT fm.id
       FROM std_field_mappings fm
       WHERE fm.source_module = 'data_map'
         AND fm.mapping_status <> 'deleted'
         AND fm.resource_id = f.resource_id
         AND fm.table_name = r.table_name
         AND fm.column_name = f.column_name
       ORDER BY CASE fm.mapping_status WHEN 'approved' THEN 0 WHEN 'suggested' THEN 1 ELSE 2 END, fm.id DESC
       LIMIT 1
     )
     LEFT JOIN std_data_elements e ON e.id = sm.element_id AND e.status <> 'deleted'
     WHERE f.resource_id = ?
     ORDER BY f.ordinal_position ASC, f.id ASC`,
        [resourceId]
      );
      return rows.map(mapResourceField);
    }
    function buildFieldSnapshot(resource, field) {
      return {
        resourceCode: resource.resourceCode,
        tableName: resource.tableName,
        columnName: field.columnName,
        dataType: field.dataType || "",
        columnType: field.columnType || "",
        isNullable: Boolean(field.isNullable),
        isPrimaryKey: Boolean(field.isPrimaryKey),
        columnComment: field.columnComment || "",
        businessName: field.businessName || "",
        semanticTags: parseJson(field.semanticTags, [])
      };
    }
    async function getStandardDataElementById(id, db = pool) {
      if (!id) return null;
      const [rows] = await db.query(
        `SELECT e.id, e.element_code AS elementCode, e.element_name_cn AS elementNameCn,
            e.element_name_en AS elementNameEn, e.element_identifier AS elementIdentifier,
            e.definition, e.data_type AS dataType, e.object_class AS objectClass,
            e.property_name AS propertyName, e.representation_term AS representationTerm,
            e.qualifiers_json AS qualifiers, e.aliases_json AS aliases, e.tags_json AS tags,
            e.value_domain_id AS valueDomainId, vd.domain_name AS valueDomainName,
            vd.domain_code AS valueDomainCode, e.reference_standard_id AS referenceStandardId,
            rs.standard_name AS referenceStandardName, e.reference_clause AS referenceClause,
            e.lifecycle_status AS lifecycleStatus, e.status
     FROM std_data_elements e
     LEFT JOIN std_value_domains vd ON vd.id = e.value_domain_id
     LEFT JOIN std_reference_standards rs ON rs.id = e.reference_standard_id
     WHERE e.id = ? AND e.status <> 'deleted'
     LIMIT 1`,
        [id]
      );
      const row = rows[0];
      return row ? {
        id: Number(row.id),
        elementCode: row.elementCode,
        elementNameCn: row.elementNameCn,
        elementNameEn: row.elementNameEn || "",
        elementIdentifier: row.elementIdentifier,
        definition: row.definition || "",
        dataType: row.dataType || "",
        objectClass: row.objectClass || "",
        propertyName: row.propertyName || "",
        representationTerm: row.representationTerm || "",
        qualifiers: parseJson(row.qualifiers, []),
        aliases: parseJson(row.aliases, []),
        tags: parseJson(row.tags, []),
        valueDomainId: toNumber(row.valueDomainId),
        valueDomainName: row.valueDomainName || "",
        valueDomainCode: row.valueDomainCode || "",
        referenceStandardId: toNumber(row.referenceStandardId),
        referenceStandardName: row.referenceStandardName || "",
        referenceClause: row.referenceClause || "",
        lifecycleStatus: row.lifecycleStatus || "",
        status: row.status || ""
      } : null;
    }
    async function listStandardDataElementsForMatching(limit = 500) {
      const [rows] = await pool.query(
        `SELECT e.id, e.element_code AS elementCode, e.element_name_cn AS elementNameCn,
            e.element_name_en AS elementNameEn, e.element_identifier AS elementIdentifier,
            e.definition, e.data_type AS dataType, e.object_class AS objectClass,
            e.property_name AS propertyName, e.representation_term AS representationTerm,
            e.qualifiers_json AS qualifiers, e.aliases_json AS aliases, e.tags_json AS tags,
            e.value_domain_id AS valueDomainId, vd.domain_name AS valueDomainName,
            vd.domain_code AS valueDomainCode, e.reference_standard_id AS referenceStandardId,
            rs.standard_name AS referenceStandardName, e.reference_clause AS referenceClause,
            e.lifecycle_status AS lifecycleStatus, e.status
     FROM std_data_elements e
     LEFT JOIN std_value_domains vd ON vd.id = e.value_domain_id
     LEFT JOIN std_reference_standards rs ON rs.id = e.reference_standard_id
     WHERE e.status <> 'deleted' AND e.lifecycle_status <> 'deprecated'
     ORDER BY CASE e.lifecycle_status WHEN 'published' THEN 0 WHEN 'review' THEN 1 ELSE 2 END, e.updated_at DESC, e.id DESC
     LIMIT ?`,
        [Number(limit || 500)]
      );
      return rows.map((row) => ({
        id: Number(row.id),
        elementCode: row.elementCode,
        elementNameCn: row.elementNameCn,
        elementNameEn: row.elementNameEn || "",
        elementIdentifier: row.elementIdentifier,
        definition: row.definition || "",
        dataType: row.dataType || "",
        objectClass: row.objectClass || "",
        propertyName: row.propertyName || "",
        representationTerm: row.representationTerm || "",
        qualifiers: parseJson(row.qualifiers, []),
        aliases: parseJson(row.aliases, []),
        tags: parseJson(row.tags, []),
        valueDomainId: toNumber(row.valueDomainId),
        valueDomainName: row.valueDomainName || "",
        valueDomainCode: row.valueDomainCode || "",
        referenceStandardId: toNumber(row.referenceStandardId),
        referenceStandardName: row.referenceStandardName || "",
        referenceClause: row.referenceClause || "",
        lifecycleStatus: row.lifecycleStatus || "",
        status: row.status || ""
      }));
    }
    async function replaceFieldStandardMapping(connection, resource, field, mapping) {
      const projectId = getCurrentProjectId();
      await connection.query(
        `UPDATE std_field_mappings
     SET mapping_status = 'deleted'
     WHERE source_module = 'data_map'
       AND resource_id = ?
       AND table_name = ?
       AND column_name = ?
       AND mapping_status <> 'deleted'`,
        [resource.id, resource.tableName, field.columnName]
      );
      if (!mapping?.elementId) {
        return;
      }
      await connection.query(
        `INSERT INTO std_field_mappings
      (project_id, element_id, source_module, resource_id, resource_code, table_name, column_name,
       field_snapshot_json, mapping_status, confidence, evidence_json, created_by, reviewed_by, reviewed_at)
     VALUES (?, ?, 'data_map', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          mapping.elementId,
          resource.id,
          resource.resourceCode,
          resource.tableName,
          field.columnName,
          json(buildFieldSnapshot(resource, field), {}),
          mapping.mappingStatus || "suggested",
          mapping.confidence ?? null,
          json(mapping.evidence, []),
          mapping.createdBy || "system",
          mapping.reviewedBy || null,
          mapping.reviewedAt || null
        ]
      );
    }
    async function updateResourceFieldMetadata(resourceId, columnName, payload) {
      const projectId = getCurrentProjectId();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [fieldRows] = await connection.query(
          `SELECT r.id AS resourceId, r.resource_code AS resourceCode, r.table_name AS tableName,
              f.column_name AS columnName, f.data_type AS dataType, f.column_type AS columnType,
              f.is_nullable AS isNullable, f.is_primary_key AS isPrimaryKey,
              f.column_comment AS columnComment, f.business_name AS businessName,
              f.semantic_tags_json AS semanticTags
       FROM dm_resource_fields f
       JOIN dm_resources r ON r.id = f.resource_id
       WHERE f.resource_id = ? AND f.column_name = ?${projectId ? " AND r.project_id = ?" : ""}
       LIMIT 1`,
          [resourceId, columnName, ...projectId ? [projectId] : []]
        );
        if (!fieldRows.length) {
          await connection.rollback();
          return false;
        }
        const [fieldResult] = await connection.query(
          `UPDATE dm_resource_fields
       SET column_comment = ?, business_name = ?, semantic_tags_json = ?
       WHERE resource_id = ? AND column_name = ?`,
          [
            payload.columnComment || null,
            payload.aiBusinessName || null,
            json(payload.semanticTags, []),
            resourceId,
            columnName
          ]
        );
        if (Number(fieldResult.affectedRows || 0) === 0) {
          await connection.rollback();
          return false;
        }
        const updatedField = {
          ...fieldRows[0],
          columnComment: payload.columnComment || "",
          businessName: payload.aiBusinessName || "",
          semanticTags: json(payload.semanticTags, [])
        };
        await connection.query(
          `INSERT INTO dm_resource_field_profiles
        (resource_id, column_name, semantic_tags_json, feature_tags_json,
         ai_business_name, ai_business_meaning, ai_output_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         semantic_tags_json = VALUES(semantic_tags_json),
         feature_tags_json = VALUES(feature_tags_json),
         ai_business_name = VALUES(ai_business_name),
         ai_business_meaning = VALUES(ai_business_meaning),
         ai_output_json = VALUES(ai_output_json)`,
          [
            resourceId,
            columnName,
            json(payload.semanticTags, []),
            json(payload.featureTags, []),
            payload.aiBusinessName || null,
            payload.aiBusinessMeaning || null,
            json({
              ...payload.aiOutput && typeof payload.aiOutput === "object" ? payload.aiOutput : {},
              businessName: payload.aiBusinessName || "",
              businessMeaning: payload.aiBusinessMeaning || "",
              semanticTags: payload.semanticTags || [],
              featureTags: payload.featureTags || []
            }, {})
          ]
        );
        if (Object.prototype.hasOwnProperty.call(payload, "standardElementId")) {
          const elementId = payload.standardElementId ? Number(payload.standardElementId) : null;
          if (elementId) {
            const element = await getStandardDataElementById(elementId, connection);
            if (!element) {
              const error = new Error("\u6807\u51C6\u6570\u636E\u5143\u4E0D\u5B58\u5728");
              error.code = "STANDARD_ELEMENT_NOT_FOUND";
              throw error;
            }
          }
          await replaceFieldStandardMapping(connection, {
            id: Number(resourceId),
            resourceCode: fieldRows[0].resourceCode,
            tableName: fieldRows[0].tableName
          }, updatedField, elementId ? {
            elementId,
            mappingStatus: "approved",
            confidence: 1,
            evidence: ["\u7528\u6237\u5728\u6570\u636E\u9879\u7F16\u8F91\u4E2D\u7EF4\u62A4\u6570\u636E\u5143\u6620\u5C04"],
            createdBy: payload.updatedBy || "system",
            reviewedBy: payload.updatedBy || "system",
            reviewedAt: /* @__PURE__ */ new Date()
          } : null);
        }
        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function getResourceBySourceAndTable(dataSourceId, tableName) {
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(
        `SELECT id
     FROM dm_resources
     WHERE data_source_id = ? AND table_name = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [dataSourceId, tableName, ...scoped.params]
      );
      return rows[0]?.id ? getResourceById(rows[0].id) : null;
    }
    async function nextResourceCode(connection, scope) {
      const [rows] = await connection.query(
        `SELECT id, current_value AS currentValue
     FROM dm_resource_sequences
     WHERE department_code = ? AND system_code = ? AND catalog_short_code = ?
     FOR UPDATE`,
        [scope.departmentCode, scope.systemCode, scope.catalogShortCode]
      );
      if (!rows.length) {
        await connection.query(
          `INSERT INTO dm_resource_sequences (department_code, system_code, catalog_short_code, current_value)
       VALUES (?, ?, ?, 0)`,
          [scope.departmentCode, scope.systemCode, scope.catalogShortCode]
        );
        return nextResourceCode(connection, scope);
      }
      const nextValue = Number(rows[0].currentValue || 0) + 1;
      await connection.query("UPDATE dm_resource_sequences SET current_value = ? WHERE id = ?", [nextValue, rows[0].id]);
      return `R_${scope.departmentCode}_${scope.systemCode}_${scope.catalogShortCode}_${String(nextValue).padStart(4, "0")}`;
    }
    async function createResourceWithFields(connection, payload) {
      const projectId = payload.projectId || getCurrentProjectId();
      const resourceCode = await nextResourceCode(connection, payload.scope);
      const [result] = await connection.query(
        `INSERT INTO dm_resources
      (project_id, resource_code, catalog_id, department_id, business_system_id, data_source_id, table_name,
       table_comment, row_count, row_count_mode, column_count, resource_category, business_tags_json,
       source_snapshot_json, status, last_synced_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), ?)`,
        [
          projectId,
          resourceCode,
          payload.catalogId,
          payload.departmentId,
          payload.businessSystemId,
          payload.dataSourceId,
          payload.tableName,
          payload.tableComment || null,
          payload.rowCount ?? null,
          payload.rowCountMode || "estimated",
          payload.columns.length,
          payload.resourceCategory || null,
          json(payload.businessTags, []),
          json(payload.sourceSnapshot, {}),
          payload.createdBy || "system"
        ]
      );
      const resourceId = Number(result.insertId);
      for (const column of payload.columns) {
        await connection.query(
          `INSERT INTO dm_resource_fields
        (resource_id, column_name, ordinal_position, data_type, column_type, is_nullable,
         is_primary_key, column_default, column_comment, semantic_tags_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            resourceId,
            column.columnName,
            Number(column.ordinalPosition || 0),
            column.dataType || null,
            column.columnType || null,
            column.isNullable ? 1 : 0,
            column.isPrimaryKey ? 1 : 0,
            column.columnDefault === null || column.columnDefault === void 0 ? null : String(column.columnDefault).slice(0, 512),
            column.columnComment || null,
            json([], [])
          ]
        );
      }
      return resourceId;
    }
    async function registerResources(items) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const ids = [];
        for (const item of items) {
          ids.push(await createResourceWithFields(connection, item));
        }
        await connection.commit();
        return ids;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function updateResource(id, payload) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `UPDATE dm_resources
     SET table_comment = ?, resource_category = ?, business_tags_json = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          payload.tableComment || null,
          payload.resourceCategory || null,
          json(payload.businessTags, []),
          payload.status,
          id,
          ...scoped.params
        ]
      );
      return Number(result.affectedRows || 0) > 0 ? getResourceById(id) : null;
    }
    async function getResourceContent(resourceId) {
      const [rows] = await pool.query(
        `SELECT id, resource_id AS resourceId, business_name AS businessName,
            business_definition AS businessDefinition, business_grain AS businessGrain,
            update_frequency AS updateFrequency, data_owner AS dataOwner, tech_owner AS techOwner,
            usage_scenarios_json AS usageScenarios, usage_instruction AS usageInstruction,
            quality_note AS qualityNote, known_issues AS knownIssues, retention_period AS retentionPeriod,
            service_sla AS serviceSla, extension_json AS extension, updated_by AS updatedBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM dm_resource_contents
     WHERE resource_id = ?
     LIMIT 1`,
        [resourceId]
      );
      return rows[0] ? mapResourceContent(rows[0]) : null;
    }
    async function upsertResourceContent(resourceId, payload, userName) {
      await pool.query(
        `INSERT INTO dm_resource_contents
      (resource_id, business_name, business_definition, business_grain, update_frequency,
       data_owner, tech_owner, usage_scenarios_json, usage_instruction, quality_note,
       known_issues, retention_period, service_sla, extension_json, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       business_name = VALUES(business_name),
       business_definition = VALUES(business_definition),
       business_grain = VALUES(business_grain),
       update_frequency = VALUES(update_frequency),
       data_owner = VALUES(data_owner),
       tech_owner = VALUES(tech_owner),
       usage_scenarios_json = VALUES(usage_scenarios_json),
       usage_instruction = VALUES(usage_instruction),
       quality_note = VALUES(quality_note),
       known_issues = VALUES(known_issues),
       retention_period = VALUES(retention_period),
       service_sla = VALUES(service_sla),
       extension_json = VALUES(extension_json),
       updated_by = VALUES(updated_by)`,
        [
          resourceId,
          payload.businessName || null,
          payload.businessDefinition || null,
          payload.businessGrain || null,
          payload.updateFrequency || null,
          payload.dataOwner || null,
          payload.techOwner || null,
          json(payload.usageScenarios, []),
          payload.usageInstruction || null,
          payload.qualityNote || null,
          payload.knownIssues || null,
          payload.retentionPeriod || null,
          payload.serviceSla || null,
          json(payload.extension, {}),
          userName || "system"
        ]
      );
      return getResourceContent(resourceId);
    }
    async function getResourceProfile(resourceId) {
      const [rows] = await pool.query(
        `SELECT id, resource_id AS resourceId, profile_status AS profileStatus,
            sample_count AS sampleCount, row_count AS rowCount, column_count AS columnCount,
            nullable_field_count AS nullableFieldCount, primary_key_fields_json AS primaryKeyFields,
            time_range_json AS timeRange, quality_summary_json AS qualitySummary,
            profile_json AS profile, ai_summary AS aiSummary, ai_output_json AS aiOutput,
            ai_analyzed_at AS aiAnalyzedAt, error_message AS errorMessage,
            profiled_at AS profiledAt, created_at AS createdAt, updated_at AS updatedAt
     FROM dm_resource_profiles
     WHERE resource_id = ?
     LIMIT 1`,
        [resourceId]
      );
      return rows[0] ? mapResourceProfile(rows[0]) : null;
    }
    async function listResourceFieldProfiles(resourceId) {
      const [rows] = await pool.query(
        `SELECT id, resource_id AS resourceId, column_name AS columnName, null_rate AS nullRate,
            sample_values_json AS sampleValues,
            issue_tags_json AS issueTags, semantic_tags_json AS semanticTags,
            feature_tags_json AS featureTags,
            ai_business_name AS aiBusinessName, ai_business_meaning AS aiBusinessMeaning,
            ai_output_json AS aiOutput, created_at AS createdAt, updated_at AS updatedAt
     FROM dm_resource_field_profiles
     WHERE resource_id = ?
     ORDER BY id ASC`,
        [resourceId]
      );
      return rows.map(mapResourceFieldProfile);
    }
    async function replaceResourceProfile(resourceId, profile, fieldProfiles = []) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `INSERT INTO dm_resource_profiles
        (resource_id, profile_status, sample_count, row_count, column_count, nullable_field_count,
         primary_key_fields_json, time_range_json, quality_summary_json, profile_json,
         error_message, profiled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         profile_status = VALUES(profile_status),
         sample_count = VALUES(sample_count),
         row_count = VALUES(row_count),
         column_count = VALUES(column_count),
         nullable_field_count = VALUES(nullable_field_count),
         primary_key_fields_json = VALUES(primary_key_fields_json),
         time_range_json = VALUES(time_range_json),
         quality_summary_json = VALUES(quality_summary_json),
         profile_json = VALUES(profile_json),
         error_message = VALUES(error_message),
         profiled_at = NOW()`,
          [
            resourceId,
            profile.profileStatus || "succeeded",
            Number(profile.sampleCount || 0),
            profile.rowCount ?? null,
            Number(profile.columnCount || 0),
            Number(profile.nullableFieldCount || 0),
            json(profile.primaryKeyFields, []),
            json(profile.timeRange, {}),
            json(profile.qualitySummary, {}),
            json(profile.profile, {}),
            profile.errorMessage || null
          ]
        );
        await connection.query("DELETE FROM dm_resource_field_profiles WHERE resource_id = ?", [resourceId]);
        for (const item of fieldProfiles) {
          await connection.query(
            `INSERT INTO dm_resource_field_profiles
          (resource_id, column_name, null_rate, sample_values_json,
           issue_tags_json, semantic_tags_json, feature_tags_json, ai_business_name, ai_business_meaning, ai_output_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              resourceId,
              item.columnName,
              item.nullRate ?? null,
              json(item.sampleValues, []),
              json(item.issueTags, []),
              json(item.semanticTags, []),
              json(item.featureTags, []),
              item.aiBusinessName || null,
              item.aiBusinessMeaning || null,
              item.aiOutput ? json(item.aiOutput, {}) : null
            ]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return {
        profile: await getResourceProfile(resourceId),
        fieldProfiles: await listResourceFieldProfiles(resourceId)
      };
    }
    async function updateResourceProfileAi(resourceId, payload, fieldProfiles = []) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `INSERT INTO dm_resource_profiles
        (resource_id, profile_status, ai_summary, ai_output_json, ai_analyzed_at, error_message)
       VALUES (?, ?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE
         profile_status = VALUES(profile_status),
         ai_summary = VALUES(ai_summary),
         ai_output_json = VALUES(ai_output_json),
         ai_analyzed_at = NOW(),
         error_message = VALUES(error_message)`,
          [
            resourceId,
            payload.profileStatus || "succeeded",
            payload.aiSummary || null,
            payload.aiOutput ? json(payload.aiOutput, {}) : null,
            payload.errorMessage || null
          ]
        );
        for (const item of fieldProfiles) {
          await connection.query(
            `INSERT INTO dm_resource_field_profiles
          (resource_id, column_name, sample_values_json, issue_tags_json, semantic_tags_json,
           feature_tags_json, ai_business_name, ai_business_meaning, ai_output_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           issue_tags_json = VALUES(issue_tags_json),
           semantic_tags_json = VALUES(semantic_tags_json),
           feature_tags_json = VALUES(feature_tags_json),
           ai_business_name = VALUES(ai_business_name),
           ai_business_meaning = VALUES(ai_business_meaning),
           ai_output_json = VALUES(ai_output_json)`,
            [
              resourceId,
              item.columnName,
              json(item.sampleValues, []),
              json(item.issueTags, []),
              json(item.semanticTags, []),
              json(item.featureTags, []),
              item.aiBusinessName || null,
              item.aiBusinessMeaning || null,
              item.aiOutput ? json(item.aiOutput, {}) : null
            ]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return {
        profile: await getResourceProfile(resourceId),
        fieldProfiles: await listResourceFieldProfiles(resourceId)
      };
    }
    async function updateResourceFieldProfilesAi(resourceId, fieldProfiles = []) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        for (const item of fieldProfiles) {
          await connection.query(
            `INSERT INTO dm_resource_field_profiles
          (resource_id, column_name, sample_values_json, issue_tags_json, semantic_tags_json,
           feature_tags_json, ai_business_name, ai_business_meaning, ai_output_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           sample_values_json = VALUES(sample_values_json),
           issue_tags_json = VALUES(issue_tags_json),
           semantic_tags_json = VALUES(semantic_tags_json),
           feature_tags_json = VALUES(feature_tags_json),
           ai_business_name = VALUES(ai_business_name),
           ai_business_meaning = VALUES(ai_business_meaning),
           ai_output_json = VALUES(ai_output_json)`,
            [
              resourceId,
              item.columnName,
              json(item.sampleValues, []),
              json(item.issueTags, []),
              json(item.semanticTags, []),
              json(item.featureTags, []),
              item.aiBusinessName || null,
              item.aiBusinessMeaning || null,
              item.aiOutput ? json(item.aiOutput, {}) : null
            ]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return {
        profile: await getResourceProfile(resourceId),
        fieldProfiles: await listResourceFieldProfiles(resourceId)
      };
    }
    async function replaceAiSuggestedFieldStandardMappings(resourceId, suggestions = [], createdBy = "system") {
      const projectId = getCurrentProjectId();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [resourceRows] = await connection.query(
          `SELECT id, resource_code AS resourceCode, table_name AS tableName
       FROM dm_resources
       WHERE id = ?${projectId ? " AND project_id = ?" : ""}
       LIMIT 1`,
          [resourceId, ...projectId ? [projectId] : []]
        );
        const resource = resourceRows[0] ? {
          id: Number(resourceRows[0].id),
          resourceCode: resourceRows[0].resourceCode,
          tableName: resourceRows[0].tableName
        } : null;
        if (!resource) {
          await connection.rollback();
          return;
        }
        const [fieldRows] = await connection.query(
          `SELECT column_name AS columnName, data_type AS dataType, column_type AS columnType,
              is_nullable AS isNullable, is_primary_key AS isPrimaryKey,
              column_comment AS columnComment, business_name AS businessName,
              semantic_tags_json AS semanticTags
       FROM dm_resource_fields
       WHERE resource_id = ?
       ORDER BY ordinal_position ASC, id ASC`,
          [resourceId]
        );
        const fields = fieldRows.map((row) => ({
          columnName: row.columnName,
          dataType: row.dataType || "",
          columnType: row.columnType || "",
          isNullable: Boolean(row.isNullable),
          isPrimaryKey: Boolean(row.isPrimaryKey),
          columnComment: row.columnComment || "",
          businessName: row.businessName || "",
          semanticTags: row.semanticTags
        }));
        const [approvedRows] = await connection.query(
          `SELECT column_name AS columnName
       FROM std_field_mappings
       WHERE source_module = 'data_map'
         AND resource_id = ?
         AND table_name = ?
         AND mapping_status = 'approved'`,
          [resource.id, resource.tableName]
        );
        const approvedColumns = new Set(approvedRows.map((row) => row.columnName));
        const suggestionMap = new Map((Array.isArray(suggestions) ? suggestions : []).filter((item) => item?.columnName).map((item) => [String(item.columnName), item]));
        for (const field of fields) {
          if (approvedColumns.has(field.columnName)) {
            continue;
          }
          await connection.query(
            `UPDATE std_field_mappings
         SET mapping_status = 'deleted'
         WHERE source_module = 'data_map'
           AND resource_id = ?
           AND table_name = ?
           AND column_name = ?
           AND mapping_status <> 'deleted'
           AND mapping_status <> 'approved'`,
            [resource.id, resource.tableName, field.columnName]
          );
          const suggestion = suggestionMap.get(field.columnName);
          if (!suggestion?.elementId) {
            continue;
          }
          await connection.query(
            `INSERT INTO std_field_mappings
          (project_id, element_id, source_module, resource_id, resource_code, table_name, column_name,
           field_snapshot_json, mapping_status, confidence, evidence_json, created_by)
         VALUES (?, ?, 'data_map', ?, ?, ?, ?, ?, 'suggested', ?, ?, ?)`,
            [
              projectId,
              Number(suggestion.elementId),
              resource.id,
              resource.resourceCode,
              resource.tableName,
              field.columnName,
              json(buildFieldSnapshot(resource, field), {}),
              suggestion.confidence ?? null,
              json(suggestion.evidence, []),
              createdBy || "system"
            ]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function deleteResource(id) {
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM dm_resources WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return Number(result.affectedRows || 0) > 0;
    }
    async function deleteResources(ids = []) {
      const normalizedIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter(Boolean))];
      if (normalizedIds.length === 0) {
        return 0;
      }
      const scoped = getScopedWhere("");
      const [result] = await pool.query(
        `DELETE FROM dm_resources WHERE id IN (?)${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [normalizedIds, ...scoped.params]
      );
      return Number(result.affectedRows || 0);
    }
    async function replaceIngestionLineageEdges(edges) {
      const projectId = getCurrentProjectId();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `DELETE FROM dm_resource_lineage_edges WHERE lineage_type = 'ingestion'${projectId ? " AND project_id = ?" : ""}`,
          projectId ? [projectId] : []
        );
        for (const edge of edges) {
          await connection.query(
            `INSERT INTO dm_resource_lineage_edges
          (project_id, source_resource_id, target_resource_id, source_data_source_id, target_data_source_id,
           source_table_name, target_table_name, lineage_type, relation_level, relation_source,
           relation_source_id, confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ingestion', 'table', ?, ?, ?)`,
            [
              projectId,
              edge.sourceResourceId || null,
              edge.targetResourceId || null,
              edge.sourceDataSourceId || null,
              edge.targetDataSourceId || null,
              edge.sourceTableName,
              edge.targetTableName,
              edge.relationSource,
              edge.relationSourceId || null,
              edge.confidence || "high"
            ]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function listLineageEdges(resourceId) {
      const scoped = getScopedWhere("e");
      const [rows] = await pool.query(
        `SELECT e.id, e.source_resource_id AS sourceResourceId, e.target_resource_id AS targetResourceId,
            e.source_data_source_id AS sourceDataSourceId, e.target_data_source_id AS targetDataSourceId,
            e.source_table_name AS sourceTableName, e.target_table_name AS targetTableName,
            sr.resource_code AS sourceResourceCode, tr.resource_code AS targetResourceCode,
            sds.source_name AS sourceName, tds.source_name AS targetName,
            e.lineage_type AS lineageType, e.relation_level AS relationLevel,
            e.relation_source AS relationSource, e.relation_source_id AS relationSourceId,
            e.confidence, e.created_at AS createdAt, e.updated_at AS updatedAt
     FROM dm_resource_lineage_edges e
     LEFT JOIN dm_resources sr ON sr.id = e.source_resource_id
     LEFT JOIN dm_resources tr ON tr.id = e.target_resource_id
     LEFT JOIN dm_data_sources sds ON sds.id = e.source_data_source_id
     LEFT JOIN dm_data_sources tds ON tds.id = e.target_data_source_id
     WHERE (e.source_resource_id = ? OR e.target_resource_id = ?)${scoped.sql ? ` AND ${scoped.sql}` : ""}
     ORDER BY e.updated_at DESC, e.id DESC`,
        [resourceId, resourceId, ...scoped.params]
      );
      return rows.map(mapLineageEdge);
    }
    async function listIngestionTaskLineageFacts() {
      const scoped = getScopedWhere("it");
      const [rows] = await pool.query(
        `SELECT it.id, it.source_id AS sourceId, it.source_table AS sourceTable,
            it.target_source_id AS targetSourceId, it.target_table AS targetTable,
            src.source_code AS sourceCode, tgt.source_code AS targetCode
     FROM ingestion_tasks it
     LEFT JOIN ingestion_data_sources src ON src.id = it.source_id
     LEFT JOIN ingestion_data_sources tgt ON tgt.id = it.target_source_id
     WHERE it.source_table IS NOT NULL
       AND it.target_table IS NOT NULL
       AND it.target_source_id IS NOT NULL${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        scoped.params
      );
      return rows.map((row) => ({
        id: Number(row.id),
        sourceId: Number(row.sourceId),
        sourceCode: row.sourceCode || "",
        sourceTable: row.sourceTable,
        targetSourceId: Number(row.targetSourceId),
        targetCode: row.targetCode || "",
        targetTable: row.targetTable
      }));
    }
    async function listDataSourcesForLineage() {
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(
        `SELECT id, source_code AS sourceCode, source_ref_module AS sourceRefModule,
            source_ref_id AS sourceRefId, source_ref_code AS sourceRefCode
     FROM dm_data_sources${scoped.sql ? ` WHERE ${scoped.sql}` : ""}`,
        scoped.params
      );
      return rows.map((row) => ({
        id: Number(row.id),
        sourceCode: row.sourceCode || "",
        sourceRefModule: row.sourceRefModule || "",
        sourceRefId: toNumber(row.sourceRefId),
        sourceRefCode: row.sourceRefCode || ""
      }));
    }
    async function listResourcesForLineage() {
      const scoped = getScopedWhere("");
      const [rows] = await pool.query(
        `SELECT id, data_source_id AS dataSourceId, table_name AS tableName
     FROM dm_resources${scoped.sql ? ` WHERE ${scoped.sql}` : ""}`,
        scoped.params
      );
      return rows.map((row) => ({
        id: Number(row.id),
        dataSourceId: Number(row.dataSourceId),
        tableName: row.tableName
      }));
    }
    async function getOverview() {
      const projectId = getCurrentProjectId();
      const whereSql = projectId ? "WHERE project_id = ?" : "";
      const params = projectId ? [projectId] : [];
      const [[departmentRows], [systemRows], [sourceRows], [catalogRows], [resourceRows], [lineageRows]] = await Promise.all([
        pool.query(`SELECT COUNT(*) AS total FROM dm_departments ${whereSql}`, params),
        pool.query(`SELECT COUNT(*) AS total FROM dm_business_systems ${whereSql}`, params),
        pool.query(`SELECT COUNT(*) AS total FROM dm_data_sources ${whereSql}`, params),
        pool.query(`SELECT COUNT(*) AS total FROM dm_catalogs ${whereSql}`, params),
        pool.query(`SELECT COUNT(*) AS total FROM dm_resources ${whereSql}`, params),
        pool.query(`SELECT COUNT(*) AS total FROM dm_resource_lineage_edges ${whereSql}`, params)
      ]);
      return {
        departments: Number(departmentRows[0]?.total || 0),
        businessSystems: Number(systemRows[0]?.total || 0),
        dataSources: Number(sourceRows[0]?.total || 0),
        catalogs: Number(catalogRows[0]?.total || 0),
        resources: Number(resourceRows[0]?.total || 0),
        lineageEdges: Number(lineageRows[0]?.total || 0)
      };
    }
    async function listAiConfigs() {
      const [rows] = await pool.query(
        `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.user_prompt_template AS userPromptTemplate,
            c.output_schema_json AS outputSchema, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM dm_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     ORDER BY CASE c.scene_code
       WHEN 'resource_content_profile' THEN 1
       WHEN 'resource_field_profile' THEN 2
       ELSE 99
     END, c.id DESC`
      );
      return rows.map(mapAiConfig);
    }
    async function getAiConfigById(id) {
      const [rows] = await pool.query(
        `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.user_prompt_template AS userPromptTemplate,
            c.output_schema_json AS outputSchema, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM dm_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     WHERE c.id = ?
     LIMIT 1`,
        [id]
      );
      return rows[0] ? mapAiConfig(rows[0]) : null;
    }
    async function getAiConfigByCode(sceneCode) {
      const [rows] = await pool.query(
        `SELECT id, scene_name AS sceneName, scene_code AS sceneCode,
            default_model_provider_id AS defaultModelProviderId,
            default_model_name AS defaultModelName, default_model_version AS defaultModelVersion,
            temperature, max_tokens AS maxTokens, timeout_ms AS timeoutMs,
            system_prompt AS systemPrompt, user_prompt_template AS userPromptTemplate,
            output_schema_json AS outputSchema, description, owner_name AS ownerName,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM dm_ai_configs
     WHERE scene_code = ?
     LIMIT 1`,
        [sceneCode]
      );
      return rows[0] ? mapAiConfig(rows[0]) : null;
    }
    async function updateAiConfig(id, payload) {
      const [result] = await pool.query(
        `UPDATE dm_ai_configs
     SET scene_name = ?, scene_code = ?, default_model_provider_id = ?, default_model_name = ?,
         default_model_version = ?, temperature = ?, max_tokens = ?, timeout_ms = ?,
         system_prompt = ?, user_prompt_template = ?, output_schema_json = ?,
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
          payload.userPromptTemplate || null,
          json(payload.outputSchema, {}),
          payload.description || null,
          payload.ownerName || "System Administrator",
          payload.status,
          id
        ]
      );
      return Number(result.affectedRows || 0) > 0 ? getAiConfigById(id) : null;
    }
    module2.exports = {
      createBusinessSystem,
      createCatalog,
      createDataSource,
      createDepartment,
      deleteBusinessSystem,
      deleteCatalog,
      deleteDataSource,
      deleteDepartment,
      deleteResource,
      deleteResources,
      getBusinessSystemById,
      getCatalogById,
      getDataSourceById,
      getDepartmentById,
      getAiConfigByCode,
      getAiConfigById,
      getOverview,
      getResourceContent,
      getResourceById,
      getResourceProfile,
      getResourceBySourceAndTable,
      getStandardDataElementById,
      listAiConfigs,
      listBusinessSystems,
      listCatalogs,
      listDataSources,
      listDataSourcesForLineage,
      listDepartments,
      listIngestionTaskLineageFacts,
      listLineageEdges,
      listResourceFieldProfiles,
      listResourceFields,
      listResources,
      listResourcesForLineage,
      listStandardDataElementsForMatching,
      registerResources,
      replaceResourceProfile,
      replaceAiSuggestedFieldStandardMappings,
      replaceIngestionLineageEdges,
      searchResources,
      updateAiConfig,
      updateBusinessSystem,
      updateCatalog,
      updateDataSource,
      updateDepartment,
      updateResourceFieldMetadata,
      updateResourceFieldProfilesAi,
      updateResourceProfileAi,
      upsertResourceContent,
      updateResource
    };
  }
});

// backend/src/modules/data-map/data-map.service.js
var require_data_map_service = __commonJS({
  "backend/src/modules/data-map/data-map.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var { pool } = require_database();
    var { getCurrentProjectId } = require_project_context();
    var metadataService = require_data_source_metadata();
    var { testDatabaseConnection } = require_data_source_test_connection();
    var { decryptSecret } = require_data_development_utils();
    var modelProviderService = require_model_provider_service();
    var repository = require_data_map_repository();
    var RESOURCE_CONTENT_PROFILE_SCENE_CODE = "resource_content_profile";
    var RESOURCE_FIELD_PROFILE_SCENE_CODE = "resource_field_profile";
    var FIELD_FEATURE_TAG_CODES = ["primary_key", "foreign_key", "system_time", "business_time", "dictionary_value"];
    var FIELD_FEATURE_TAG_CODE_SET = new Set(FIELD_FEATURE_TAG_CODES);
    var STANDARD_ELEMENT_CANDIDATE_LIMIT = 8;
    var STANDARD_MAPPING_MIN_CONFIDENCE = 0.45;
    var STANDARD_MAPPING_RUNTIME_PROMPT = `
\u6570\u636E\u5BF9\u6807\u8981\u6C42\uFF1A
- \u6BCF\u4E2A fieldInsights \u9879\u90FD\u8981\u5305\u542B standardElementCode\u3001standardElementConfidence\u3001standardElementEvidence\u3002
- standardElementCode \u5FC5\u987B\u4E14\u53EA\u80FD\u4ECE\u8BE5\u5B57\u6BB5\u7684 standardElementCandidates \u4E2D\u9009\u62E9\u3002
- \u53EA\u6709\u5B57\u6BB5\u4E1A\u52A1\u542B\u4E49\u3001\u5B57\u6BB5\u7C7B\u578B\u3001\u6837\u4F8B\u7279\u5F81\u4E0E\u6807\u51C6\u6570\u636E\u5143\u5B9A\u4E49\u8DB3\u591F\u4E00\u81F4\u65F6\u624D\u5339\u914D\uFF1B\u5019\u9009\u4E0D\u5408\u9002\u65F6\u8FD4\u56DE\u7A7A\u5B57\u7B26\u4E32\u3002
- \u4E0D\u8981\u7F16\u9020\u4E0D\u5B58\u5728\u7684\u6807\u51C6\u6570\u636E\u5143\u7F16\u7801\u3002
`.trim();
    var DEFAULT_RESOURCE_CONTENT_PROFILE_PROMPT = `
\u4F60\u662F\u4F01\u4E1A\u6570\u636E\u76EE\u5F55\u548C\u5143\u6570\u636E\u6CBB\u7406\u4E13\u5BB6\u3002\u8BF7\u57FA\u4E8E\u8F93\u5165\u8BC1\u636E\u751F\u6210\u6570\u636E\u8D44\u6E90\u5185\u5BB9\u753B\u50CF\u3002
\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002\u4E0D\u8981\u7F16\u9020\u4E0D\u5B58\u5728\u7684\u5B57\u6BB5\u3001\u6837\u4F8B\u6216\u4E1A\u52A1\u4E8B\u5B9E\u3002
\u8F93\u51FA\u5B57\u6BB5\uFF1Asummary\u3001businessMeaning\u3001businessGrain\u3001usageSuggestions\u3001qualityFindings\u3001riskNotes\u3001tags\u3002
summary \u662F\u9762\u5411\u8D44\u6E90\u76EE\u5F55\u7684\u7B80\u6D01\u6458\u8981\uFF1BbusinessMeaning \u8BF4\u660E\u8868\u627F\u8F7D\u7684\u4E1A\u52A1\u5BF9\u8C61\u548C\u4E1A\u52A1\u6D3B\u52A8\uFF1BbusinessGrain \u8BF4\u660E\u6BCF\u884C\u6570\u636E\u4EE3\u8868\u7684\u4E1A\u52A1\u7C92\u5EA6\u3002
usageSuggestions\u3001qualityFindings\u3001riskNotes\u3001tags \u5FC5\u987B\u7ED3\u5408\u8D44\u6E90\u57FA\u7840\u4FE1\u606F\u3001\u5B57\u6BB5\u7ED3\u6784\u3001\u6837\u4F8B\u753B\u50CF\u548C\u8840\u7F18\u5173\u7CFB\u7ED9\u51FA\uFF0C\u4E0D\u8981\u6CDB\u6CDB\u800C\u8C08\u3002
\u672C\u9636\u6BB5\u53EA\u5206\u6790\u5185\u5BB9\u753B\u50CF\uFF0C\u4E0D\u8F93\u51FA\u5B57\u6BB5\u7EA7 fieldInsights\uFF0C\u4E0D\u8F93\u51FA\u6570\u636E\u5BF9\u6807\u7ED3\u8BBA\u3002
\u672C\u9636\u6BB5\u4E0D\u8F93\u51FA\u6570\u636E\u8131\u654F\u7B56\u7565\uFF0C\u4E0D\u505A\u5206\u7EA7\u5206\u7C7B\u7ED3\u8BBA\u3002`.trim();
    var DEFAULT_RESOURCE_FIELD_PROFILE_PROMPT = `
\u4F60\u662F\u4F01\u4E1A\u6570\u636E\u76EE\u5F55\u5B57\u6BB5\u753B\u50CF\u548C\u6570\u636E\u6807\u51C6\u5BF9\u6807\u4E13\u5BB6\u3002\u8BF7\u57FA\u4E8E\u8F93\u5165\u8BC1\u636E\u751F\u6210\u5B57\u6BB5\u4FE1\u606F\u5206\u6790\u7ED3\u679C\u3002
\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002\u4E0D\u8981\u7F16\u9020\u4E0D\u5B58\u5728\u7684\u5B57\u6BB5\u3001\u6837\u4F8B\u6216\u4E1A\u52A1\u4E8B\u5B9E\u3002
\u8F93\u51FA\u5B57\u6BB5\uFF1AfieldInsights\u3002
fieldInsights \u5FC5\u987B\u8986\u76D6\u8F93\u5165\u4E2D\u7684\u6BCF\u4E2A\u5B57\u6BB5\uFF0C\u6570\u7EC4\u9879\u5305\u542B columnName\u3001aiBusinessName\u3001aiBusinessMeaning\u3001featureTags\u3001issueTags\u3001standardElementCode\u3001standardElementConfidence\u3001standardElementEvidence\u3002
featureTags \u53EA\u80FD\u4F7F\u7528 primary_key\u3001foreign_key\u3001system_time\u3001business_time\u3001dictionary_value\uFF0C\u4E00\u4E2A\u5B57\u6BB5\u53EF\u4EE5\u8FD4\u56DE\u591A\u4E2A\u7279\u5F81\u6807\u7B7E\uFF1B\u65E0\u6CD5\u5224\u65AD\u65F6\u8FD4\u56DE\u7A7A\u6570\u7EC4\u3002
\u8BF7\u7EFC\u5408\u5B57\u6BB5\u540D\u3001\u5B57\u6BB5\u63CF\u8FF0\u3001\u5B57\u6BB5\u7C7B\u578B\u3001\u662F\u5426\u5FC5\u586B\u3001\u662F\u5426\u4E3B\u952E\u3001\u7A7A\u503C\u7387\u3001\u6837\u4F8B\u503C\u7B49\u8BC1\u636E\u5224\u65AD\u7279\u5F81\u6807\u7B7E\uFF0C\u5FC5\u987B\u4F18\u5148\u4F9D\u636E\u5B9E\u9645\u6837\u4F8B\u6570\u636E\u7279\u5F81\uFF0C\u4E0D\u8981\u53EA\u6309\u5B57\u6BB5\u540D\u505A\u673A\u68B0\u5339\u914D\u3002
issueTags \u91CD\u70B9\u6807\u6CE8\u7A7A\u503C\u7387\u5F02\u5E38\u3001\u6837\u4F8B\u503C\u7F3A\u5931\u3001\u7591\u4F3C\u5B57\u5178\u503C\u4E0D\u89C4\u8303\u3001\u5B57\u6BB5\u63CF\u8FF0\u7F3A\u5931\u7B49\u95EE\u9898\uFF1B\u4E0D\u8981\u8F93\u51FA\u8BED\u4E49\u6807\u7B7E\u3002
\u6807\u7B7E\u542B\u4E49\uFF1Aprimary_key=\u4E3B\u952E\u6216\u552F\u4E00\u6807\u8BC6\uFF1Bforeign_key=\u5F15\u7528\u5176\u4ED6\u5B9E\u4F53/\u5B57\u5178/\u533A\u57DF/\u673A\u6784\u7B49\u5BF9\u8C61\u7684\u5173\u8054\u952E\uFF1Bsystem_time=\u521B\u5EFA/\u66F4\u65B0/\u5220\u9664/\u540C\u6B65/ETL\u7B49\u7CFB\u7EDF\u5BA1\u8BA1\u65F6\u95F4\uFF1Bbusiness_time=\u4E1A\u52A1\u4E8B\u4EF6\u3001\u751F\u6548\u3001\u767B\u8BB0\u3001\u51FA\u751F\u3001\u5230\u671F\u7B49\u4E1A\u52A1\u65F6\u95F4\uFF1Bdictionary_value=\u4EE3\u7801\u3001\u679A\u4E3E\u3001\u72B6\u6001\u3001\u7EA7\u522B\u3001\u7C7B\u578B\u3001\u6807\u5FD7\u7B49\u5B57\u5178\u503C\u3002
standardElementCode \u5FC5\u987B\u4E14\u53EA\u80FD\u4ECE\u6BCF\u4E2A\u5B57\u6BB5\u7684 standardElementCandidates \u4E2D\u9009\u62E9\u6700\u5339\u914D\u7684\u6807\u51C6\u6570\u636E\u5143\u7F16\u7801\uFF1B\u5019\u9009\u4E0E\u5B57\u6BB5\u4E1A\u52A1\u542B\u4E49\u3001\u6570\u636E\u7C7B\u578B\u3001\u6837\u4F8B\u503C\u3001\u6807\u51C6\u5B9A\u4E49\u4E0D\u5339\u914D\u65F6\u8FD4\u56DE\u7A7A\u5B57\u7B26\u4E32\uFF0C\u4E0D\u8981\u5F3A\u884C\u5339\u914D\u3002
standardElementConfidence \u53D6 0 \u5230 1\uFF1BstandardElementEvidence \u7528\u6570\u7EC4\u7B80\u8FF0\u5B57\u6BB5\u8BC1\u636E\u4E0E\u6807\u51C6\u5B9A\u4E49\u7684\u5339\u914D\u70B9\u3002
\u672C\u9636\u6BB5\u4E0D\u8F93\u51FA\u6570\u636E\u8131\u654F\u7B56\u7565\uFF0C\u4E0D\u505A\u5206\u7EA7\u5206\u7C7B\u7ED3\u8BBA\u3002`.trim();
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
    function normalizeProfileValue(value) {
      if (value === null || value === void 0) return null;
      if (value instanceof Date) return value.toISOString();
      if (Buffer.isBuffer(value)) return `[Buffer:${value.length}]`;
      if (typeof value === "object") {
        try {
          return JSON.stringify(value).slice(0, 200);
        } catch {
          return String(value).slice(0, 200);
        }
      }
      return String(value).slice(0, 200);
    }
    function uniqueNormalizedValues(values = [], limit = 8) {
      const seen = /* @__PURE__ */ new Set();
      const result = [];
      for (const value of values) {
        const normalized = normalizeProfileValue(value);
        if (normalized === null || normalized === "") continue;
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
        if (result.length >= limit) break;
      }
      return result;
    }
    function isLikelyTimeField(field) {
      const text = `${field.columnName || ""} ${field.dataType || ""} ${field.columnType || ""}`.toLowerCase();
      return /(date|time|timestamp|datetime|created_at|updated_at|create_time|update_time)/.test(text);
    }
    function buildEmptyResourceContent(resourceId) {
      return {
        resourceId,
        businessName: "",
        businessDefinition: "",
        businessGrain: "",
        updateFrequency: "",
        dataOwner: "",
        techOwner: "",
        usageScenarios: [],
        usageInstruction: "",
        qualityNote: "",
        knownIssues: "",
        retentionPeriod: "",
        serviceSla: "",
        extension: {}
      };
    }
    function buildEmptyProfile(resource) {
      return {
        resourceId: resource.id,
        profileStatus: "pending",
        sampleCount: 0,
        rowCount: resource.rowCount ?? null,
        columnCount: resource.columnCount || 0,
        nullableFieldCount: 0,
        primaryKeyFields: [],
        timeRange: {},
        qualitySummary: {},
        profile: {},
        aiSummary: "",
        aiOutput: null,
        aiAnalyzedAt: null,
        errorMessage: "",
        profiledAt: null
      };
    }
    function buildProfileMetrics(resource, fields = [], sampleRows = [], sampleError = "") {
      const sampleCount = sampleRows.length;
      const fieldProfiles = [];
      const primaryKeyFields = fields.filter((field) => field.isPrimaryKey).map((field) => field.columnName);
      let nullableFieldCount = 0;
      let highNullFieldCount = 0;
      let undocumentedFieldCount = 0;
      const timeRange = {};
      for (const field of fields) {
        const values = sampleRows.map((row) => row?.[field.columnName]);
        const nullCount = values.filter((value) => value === null || value === void 0 || value === "").length;
        const nullRate = sampleCount > 0 ? Number((nullCount / sampleCount).toFixed(6)) : null;
        const nonNullValues = values.filter((value) => value !== null && value !== void 0 && value !== "");
        const issueTags = [];
        if (field.isNullable) nullableFieldCount += 1;
        if (!field.columnComment) {
          undocumentedFieldCount += 1;
          issueTags.push("missing_comment");
        }
        if (nullRate !== null && nullRate >= 0.5) {
          highNullFieldCount += 1;
          issueTags.push("high_null_rate");
        }
        if (sampleCount === 0) {
          issueTags.push("no_sample");
        }
        if (isLikelyTimeField(field)) {
          const dates = nonNullValues.map((value) => new Date(value)).filter((date) => !Number.isNaN(date.getTime())).sort((left, right) => left.getTime() - right.getTime());
          if (dates.length > 0) {
            timeRange[field.columnName] = {
              min: dates[0].toISOString(),
              max: dates[dates.length - 1].toISOString()
            };
          }
        }
        fieldProfiles.push({
          columnName: field.columnName,
          nullRate,
          sampleValues: uniqueNormalizedValues(values),
          issueTags,
          semanticTags: [],
          featureTags: []
        });
      }
      const qualitySummary = {
        sampleError,
        highNullFieldCount,
        undocumentedFieldCount,
        nullableFieldCount,
        primaryKeyFieldCount: primaryKeyFields.length,
        noPrimaryKey: primaryKeyFields.length === 0
      };
      return {
        profile: {
          profileStatus: sampleError ? "partial" : "succeeded",
          sampleCount,
          rowCount: resource.rowCount ?? null,
          columnCount: fields.length,
          nullableFieldCount,
          primaryKeyFields,
          timeRange,
          qualitySummary,
          profile: {
            tableName: resource.tableName,
            tableComment: resource.tableComment || "",
            businessTags: resource.businessTags || [],
            generatedBy: "rule_profile"
          },
          errorMessage: sampleError || ""
        },
        fieldProfiles
      };
    }
    function currentUserName(user) {
      return user?.displayName || user?.username || "system";
    }
    function normalizeCode(value) {
      return String(value || "").trim().replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
    }
    function uniqueStrings(values = []) {
      return [...new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean))];
    }
    function normalizeFeatureTags(values = []) {
      return uniqueStrings(values).filter((item) => FIELD_FEATURE_TAG_CODE_SET.has(item));
    }
    function normalizeMatchText(value) {
      return String(value || "").toLowerCase().replace(/[_\-./]+/g, " ").replace(/\s+/g, " ").trim();
    }
    function getMatchParts(value) {
      const text = normalizeMatchText(value);
      const words = text.split(/\s+/).filter((item) => item.length >= 2);
      const chinese = [...text.matchAll(/[\u4e00-\u9fa5]{2,}/g)].map((match) => match[0]);
      return uniqueStrings([...words, ...chinese]);
    }
    function isTypeCompatible(field = {}, element = {}) {
      const fieldType = normalizeMatchText(`${field.dataType || ""} ${field.columnType || ""}`);
      const elementType = normalizeMatchText(element.dataType || "");
      if (!fieldType || !elementType) return true;
      if (/(char|text|string|varchar)/.test(fieldType)) return /(char|text|string|varchar)/.test(elementType);
      if (/(int|number|numeric|decimal|double|float|bigint|smallint)/.test(fieldType)) return /(int|number|numeric|decimal|double|float)/.test(elementType);
      if (/(date|time|timestamp|datetime)/.test(fieldType)) return /(date|time|timestamp|datetime)/.test(elementType);
      return true;
    }
    function buildStandardElementCandidateText(element = {}) {
      return normalizeMatchText([
        element.elementCode,
        element.elementIdentifier,
        element.elementNameCn,
        element.elementNameEn,
        element.objectClass,
        element.propertyName,
        element.representationTerm,
        element.definition,
        element.dataType,
        element.valueDomainName,
        element.referenceStandardName,
        ...element.aliases || [],
        ...element.tags || [],
        ...element.qualifiers || []
      ].join(" "));
    }
    function scoreStandardElementCandidate(field = {}, fieldProfile = {}, element = {}) {
      const fieldText = normalizeMatchText([
        field.columnName,
        field.columnComment,
        field.dataType,
        field.columnType,
        field.businessName,
        ...field.semanticTags || [],
        ...fieldProfile.semanticTags || [],
        ...fieldProfile.featureTags || [],
        ...fieldProfile.sampleValues || []
      ].join(" "));
      if (!fieldText) return 0;
      const elementText = buildStandardElementCandidateText(element);
      let score = 0;
      const strongTerms = [element.elementNameCn, element.elementNameEn, element.elementIdentifier, element.propertyName].map((item) => normalizeMatchText(item)).filter((item) => item.length >= 2);
      strongTerms.forEach((term) => {
        if (fieldText.includes(term)) score += 8;
      });
      for (const alias of element.aliases || []) {
        const term = normalizeMatchText(alias);
        if (term.length >= 2 && fieldText.includes(term)) score += 5;
      }
      const fieldParts = getMatchParts(fieldText);
      const elementParts = new Set(getMatchParts(elementText));
      fieldParts.forEach((part) => {
        if (elementParts.has(part)) score += 2;
      });
      if (isTypeCompatible(field, element)) {
        score += 2;
      } else {
        score -= 3;
      }
      return score;
    }
    function formatStandardElementCandidate(element = {}) {
      return {
        elementCode: element.elementCode,
        elementNameCn: element.elementNameCn,
        elementIdentifier: element.elementIdentifier,
        definition: String(element.definition || "").slice(0, 180),
        dataType: element.dataType || "",
        objectClass: element.objectClass || "",
        propertyName: element.propertyName || "",
        representationTerm: element.representationTerm || "",
        aliases: element.aliases || [],
        tags: element.tags || [],
        valueDomainName: element.valueDomainName || "",
        referenceStandardName: element.referenceStandardName || "",
        referenceClause: element.referenceClause || "",
        lifecycleStatus: element.lifecycleStatus || ""
      };
    }
    async function buildStandardElementCandidates(fields = [], fieldProfiles = []) {
      const elements = await repository.listStandardDataElementsForMatching(500);
      const fieldProfileMap = new Map((fieldProfiles || []).map((item) => [item.columnName, item]));
      const byField = {};
      for (const field of fields || []) {
        const fieldProfile = fieldProfileMap.get(field.columnName) || {};
        const scored = elements.map((element) => ({
          element,
          score: scoreStandardElementCandidate(field, fieldProfile, element)
        })).filter((item) => item.score > 0).sort((left, right) => right.score - left.score).slice(0, STANDARD_ELEMENT_CANDIDATE_LIMIT).map((item) => formatStandardElementCandidate(item.element));
        byField[field.columnName] = scored;
      }
      return {
        byField,
        elementByCode: new Map(elements.map((item) => [String(item.elementCode || "").toUpperCase(), item]))
      };
    }
    function normalizeModelConfidence(value, fallback = 0.7) {
      const number = Number(value);
      if (!Number.isFinite(number)) return fallback;
      if (number > 1) return Math.max(0, Math.min(1, number / 100));
      return Math.max(0, Math.min(1, number));
    }
    function normalizeSimpleTableName(tableName) {
      const normalized = String(tableName || "").trim().replace(/`|"/g, "");
      const parts = normalized.split(".").filter(Boolean);
      return parts[parts.length - 1] || normalized;
    }
    function tableCandidates(tableName) {
      const normalized = String(tableName || "").trim();
      const simple = normalizeSimpleTableName(normalized);
      return uniqueStrings([normalized, simple]);
    }
    function buildCatalogTree(rows = []) {
      const map = new Map(rows.map((item) => [item.id, { ...item, children: [] }]));
      const roots = [];
      for (const item of map.values()) {
        if (item.parentId && map.has(item.parentId)) {
          map.get(item.parentId).children.push(item);
        } else {
          roots.push(item);
        }
      }
      const sortNodes = (nodes) => nodes.sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0) || left.id - right.id).map((node) => ({ ...node, children: sortNodes(node.children || []) }));
      return sortNodes(roots);
    }
    async function requireDepartment(id) {
      const row = await repository.getDepartmentById(id);
      if (!row) {
        throw new AppError("\u90E8\u95E8\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function requireBusinessSystem(id) {
      const row = await repository.getBusinessSystemById(id);
      if (!row) {
        throw new AppError("\u4E1A\u52A1\u7CFB\u7EDF\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function requireDataSource(id) {
      const row = await repository.getDataSourceById(id);
      if (!row) {
        throw new AppError("\u6570\u636E\u5730\u56FE\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function requireCatalog(id) {
      const row = await repository.getCatalogById(id);
      if (!row) {
        throw new AppError("\u76EE\u5F55\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function requireResource(id) {
      const row = await repository.getResourceById(id);
      if (!row) {
        throw new AppError("\u8D44\u6E90\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function runWithDuplicateGuard(operation, duplicateMessage) {
      try {
        return await operation();
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError(duplicateMessage, 409);
        }
        if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
          throw new AppError("\u5F53\u524D\u8BB0\u5F55\u5DF2\u88AB\u5176\u4ED6\u6570\u636E\u5730\u56FE\u5BF9\u8C61\u5F15\u7528\uFF0C\u65E0\u6CD5\u5220\u9664", 409);
        }
        throw error;
      }
    }
    async function createDepartment(payload, user) {
      return runWithDuplicateGuard(
        () => repository.createDepartment(payload, currentUserName(user)),
        "\u90E8\u95E8\u7F16\u7801\u5DF2\u5B58\u5728"
      );
    }
    async function updateDepartment(id, payload) {
      if (payload.parentId && Number(payload.parentId) === Number(id)) {
        throw new AppError("\u4E0A\u7EA7\u90E8\u95E8\u4E0D\u80FD\u9009\u62E9\u81EA\u8EAB", 400);
      }
      await requireDepartment(id);
      if (payload.parentId) {
        await requireDepartment(payload.parentId);
      }
      return runWithDuplicateGuard(async () => {
        const row = await repository.updateDepartment(id, payload);
        if (!row) throw new AppError("\u90E8\u95E8\u4E0D\u5B58\u5728", 404);
        return row;
      }, "\u90E8\u95E8\u7F16\u7801\u5DF2\u5B58\u5728");
    }
    async function deleteDepartment(id) {
      await requireDepartment(id);
      await runWithDuplicateGuard(() => repository.deleteDepartment(id), "");
    }
    async function createBusinessSystem(payload, user) {
      await requireDepartment(payload.departmentId);
      return runWithDuplicateGuard(
        () => repository.createBusinessSystem(payload, currentUserName(user)),
        "\u7CFB\u7EDF\u7F16\u7801\u5DF2\u5B58\u5728"
      );
    }
    async function updateBusinessSystem(id, payload) {
      await requireBusinessSystem(id);
      await requireDepartment(payload.departmentId);
      return runWithDuplicateGuard(async () => {
        const row = await repository.updateBusinessSystem(id, payload);
        if (!row) throw new AppError("\u4E1A\u52A1\u7CFB\u7EDF\u4E0D\u5B58\u5728", 404);
        return row;
      }, "\u7CFB\u7EDF\u7F16\u7801\u5DF2\u5B58\u5728");
    }
    async function deleteBusinessSystem(id) {
      await requireBusinessSystem(id);
      await runWithDuplicateGuard(() => repository.deleteBusinessSystem(id), "");
    }
    async function createDataSource(payload, user) {
      const system = await requireBusinessSystem(payload.businessSystemId);
      return runWithDuplicateGuard(
        () => repository.createDataSource(payload, system.departmentId, currentUserName(user)),
        "\u6570\u636E\u6E90\u7F16\u7801\u5DF2\u5B58\u5728"
      );
    }
    async function updateDataSource(id, payload) {
      await requireDataSource(id);
      const system = await requireBusinessSystem(payload.businessSystemId);
      return runWithDuplicateGuard(async () => {
        const row = await repository.updateDataSource(id, payload, system.departmentId);
        if (!row) throw new AppError("\u6570\u636E\u5730\u56FE\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
        return row;
      }, "\u6570\u636E\u6E90\u7F16\u7801\u5DF2\u5B58\u5728");
    }
    async function deleteDataSource(id) {
      await requireDataSource(id);
      await runWithDuplicateGuard(() => repository.deleteDataSource(id), "");
    }
    async function createCatalog(payload, user) {
      await requireDepartment(payload.departmentId);
      if (payload.businessSystemId) {
        const system = await requireBusinessSystem(payload.businessSystemId);
        if (system.departmentId !== Number(payload.departmentId)) {
          throw new AppError("\u76EE\u5F55\u7ED1\u5B9A\u7684\u4E1A\u52A1\u7CFB\u7EDF\u4E0D\u5C5E\u4E8E\u6240\u9009\u90E8\u95E8", 400);
        }
      }
      if (payload.parentId) {
        await requireCatalog(payload.parentId);
      }
      return repository.createCatalog(payload, currentUserName(user));
    }
    async function updateCatalog(id, payload) {
      if (payload.parentId && Number(payload.parentId) === Number(id)) {
        throw new AppError("\u4E0A\u7EA7\u76EE\u5F55\u4E0D\u80FD\u9009\u62E9\u81EA\u8EAB", 400);
      }
      await requireCatalog(id);
      await requireDepartment(payload.departmentId);
      if (payload.businessSystemId) {
        const system = await requireBusinessSystem(payload.businessSystemId);
        if (system.departmentId !== Number(payload.departmentId)) {
          throw new AppError("\u76EE\u5F55\u7ED1\u5B9A\u7684\u4E1A\u52A1\u7CFB\u7EDF\u4E0D\u5C5E\u4E8E\u6240\u9009\u90E8\u95E8", 400);
        }
      }
      if (payload.parentId) {
        await requireCatalog(payload.parentId);
      }
      const row = await repository.updateCatalog(id, payload);
      if (!row) throw new AppError("\u76EE\u5F55\u4E0D\u5B58\u5728", 404);
      return row;
    }
    async function deleteCatalog(id) {
      await requireCatalog(id);
      await runWithDuplicateGuard(() => repository.deleteCatalog(id), "");
    }
    async function listExternalDataSources(moduleKey = "") {
      const normalized = String(moduleKey || "").trim();
      const modules = normalized ? [normalized] : ["ingestion", "quality", "reporting", "services", "development"];
      const results = [];
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? "WHERE project_id = ?" : "";
      const projectParams = projectId ? [projectId] : [];
      for (const moduleName of modules) {
        if (moduleName === "ingestion") {
          const [rows] = await pool.query(
            `SELECT id, source_name AS sourceName, source_code AS sourceCode, source_type AS sourceType,
                connection_config AS connectionConfig, owner_name AS ownerName, status
         FROM ingestion_data_sources
         ${projectWhere}
         ORDER BY id DESC`,
            projectParams
          );
          results.push(...rows.map((row) => ({
            module: "ingestion",
            id: Number(row.id),
            sourceName: row.sourceName,
            sourceCode: row.sourceCode,
            sourceType: row.sourceType,
            connectionConfig: parseJson(row.connectionConfig, {}),
            ownerName: row.ownerName || "system",
            status: row.status
          })));
        }
        if (moduleName === "quality") {
          const [rows] = await pool.query(
            `SELECT id, source_name AS sourceName, source_code AS sourceCode, source_type AS sourceType,
                connection_config AS connectionConfig, owner_name AS ownerName, status
         FROM qc_data_sources
         ${projectWhere}
         ORDER BY id DESC`,
            projectParams
          );
          results.push(...rows.map((row) => ({
            module: "quality",
            id: Number(row.id),
            sourceName: row.sourceName,
            sourceCode: row.sourceCode,
            sourceType: row.sourceType,
            connectionConfig: parseJson(row.connectionConfig, {}),
            ownerName: row.ownerName || "system",
            status: row.status
          })));
        }
        if (moduleName === "reporting") {
          const [rows] = await pool.query(
            `SELECT id, source_name AS sourceName, source_code AS sourceCode, source_type AS sourceType,
                connection_config AS connectionConfig, owner_name AS ownerName, status
         FROM report_data_sources
         ${projectWhere}
         ORDER BY id DESC`,
            projectParams
          );
          results.push(...rows.map((row) => ({
            module: "reporting",
            id: Number(row.id),
            sourceName: row.sourceName,
            sourceCode: row.sourceCode,
            sourceType: row.sourceType,
            connectionConfig: parseJson(row.connectionConfig, {}),
            ownerName: row.ownerName || "system",
            status: row.status
          })));
        }
        if (moduleName === "services") {
          const [rows] = await pool.query(
            `SELECT id, source_name AS sourceName, source_code AS sourceCode, source_type AS sourceType,
                connection_config AS connectionConfig, owner_name AS ownerName, status
         FROM service_data_sources
         ${projectWhere}
         ORDER BY id DESC`,
            projectParams
          );
          results.push(...rows.map((row) => ({
            module: "services",
            id: Number(row.id),
            sourceName: row.sourceName,
            sourceCode: row.sourceCode,
            sourceType: row.sourceType,
            connectionConfig: parseJson(row.connectionConfig, {}),
            ownerName: row.ownerName || "system",
            status: row.status
          })));
        }
        if (moduleName === "development") {
          const [rows] = await pool.query(
            `SELECT id, name AS sourceName, type AS sourceType, host, port, database_name AS databaseName,
                username, password_encrypted AS passwordEncrypted, extra_config_json AS extraConfig,
                created_at AS createdAt, updated_at AS updatedAt
         FROM dev_datasources
         ${projectWhere}
         ORDER BY id DESC`,
            projectParams
          );
          results.push(...rows.map((row) => {
            const extraConfig = parseJson(row.extraConfig, {});
            return {
              module: "development",
              id: Number(row.id),
              sourceName: row.sourceName,
              sourceCode: `dev_${row.id}`,
              sourceType: row.sourceType,
              connectionConfig: {
                ...extraConfig,
                host: row.host,
                port: Number(row.port || 0),
                database: row.databaseName,
                username: row.username,
                password: decryptSecret(row.passwordEncrypted)
              },
              ownerName: "system",
              status: "active"
            };
          }));
        }
      }
      return results.map((item) => ({
        ...item,
        refKey: `${item.module}:${item.id}`,
        sourceRefModule: item.module,
        sourceRefId: item.id,
        sourceRefCode: item.sourceCode,
        sourceRefSnapshot: item
      }));
    }
    async function testDataSource(payload) {
      return testDatabaseConnection(payload.connectionConfig || {}, payload.sourceType);
    }
    async function listDataSourceTables(id) {
      const source = await requireDataSource(id);
      return metadataService.listTables(source);
    }
    async function listDataSourceColumns(id, tableName) {
      const source = await requireDataSource(id);
      return metadataService.listColumns(source, tableName);
    }
    async function sampleResourceRows(resourceId, limit) {
      const resource = await requireResource(resourceId);
      const source = await requireDataSource(resource.dataSourceId);
      return metadataService.sampleRows(source, resource.tableName, limit);
    }
    async function buildResourceProfile(source, tableName, tableInfo, rowCountMode) {
      const columns = await metadataService.listColumns(source, tableName);
      let rowCount = null;
      let resolvedRowCountMode = rowCountMode || "estimated";
      if (resolvedRowCountMode === "exact") {
        rowCount = await metadataService.countRows(source, tableName).catch(() => null);
        if (rowCount === null) {
          resolvedRowCountMode = "estimated";
          rowCount = await metadataService.estimateRows(source, tableName).catch(() => null);
        }
      } else {
        rowCount = await metadataService.estimateRows(source, tableName).catch(() => null);
        if (rowCount === null) {
          resolvedRowCountMode = "exact";
          rowCount = await metadataService.countRows(source, tableName).catch(() => null);
        }
      }
      return {
        columns,
        rowCount,
        rowCountMode: resolvedRowCountMode,
        tableComment: tableInfo?.tableComment || ""
      };
    }
    async function registerResources(catalogId, payload, user) {
      const catalog = await requireCatalog(catalogId);
      const source = await requireDataSource(payload.dataSourceId);
      const isSameDepartment = source.departmentId === catalog.departmentId;
      const isSameSystem = !catalog.businessSystemId || source.businessSystemId === catalog.businessSystemId;
      if (!isSameDepartment || !isSameSystem) {
        throw new AppError(catalog.businessSystemId ? "\u8D44\u6E90\u6CE8\u518C\u7684\u6570\u636E\u6E90\u5FC5\u987B\u5C5E\u4E8E\u76EE\u5F55\u7ED1\u5B9A\u7684\u90E8\u95E8\u548C\u4E1A\u52A1\u7CFB\u7EDF" : "\u8D44\u6E90\u6CE8\u518C\u7684\u6570\u636E\u6E90\u5FC5\u987B\u5C5E\u4E8E\u76EE\u5F55\u7ED1\u5B9A\u7684\u90E8\u95E8", 400);
      }
      const tableNames = uniqueStrings(payload.tableNames);
      const existingTables = await metadataService.listTables(source);
      const tableInfoMap = new Map(existingTables.map((item) => [item.tableName, item]));
      const availableTableNames = new Set(existingTables.map((item) => item.tableName));
      for (const tableName of tableNames) {
        if (!availableTableNames.has(tableName)) {
          throw new AppError(`\u6570\u636E\u6E90\u4E2D\u4E0D\u5B58\u5728\u8868\uFF1A${tableName}`, 400);
        }
      }
      const scope = {
        departmentCode: normalizeCode(catalog.departmentCode),
        systemCode: normalizeCode(source.systemCode),
        catalogShortCode: normalizeCode(catalog.catalogShortCode)
      };
      const items = [];
      for (const tableName of tableNames) {
        const profile = await buildResourceProfile(source, tableName, tableInfoMap.get(tableName), payload.rowCountMode);
        items.push({
          scope,
          catalogId: catalog.id,
          departmentId: catalog.departmentId,
          businessSystemId: source.businessSystemId,
          dataSourceId: source.id,
          tableName,
          tableComment: profile.tableComment,
          rowCount: profile.rowCount,
          rowCountMode: profile.rowCountMode,
          resourceCategory: payload.resourceCategory || null,
          businessTags: payload.businessTags || [],
          columns: profile.columns,
          sourceSnapshot: {
            sourceId: source.id,
            sourceName: source.sourceName,
            sourceCode: source.sourceCode,
            sourceType: source.sourceType,
            departmentCode: source.departmentCode,
            systemCode: source.systemCode
          },
          createdBy: currentUserName(user)
        });
      }
      const ids = await runWithDuplicateGuard(() => repository.registerResources(items), "\u6240\u9009\u76EE\u5F55\u4E0B\u5DF2\u6CE8\u518C\u76F8\u540C\u6570\u636E\u6E90\u8868");
      await refreshIngestionLineage();
      return Promise.all(ids.map((id) => repository.getResourceById(id)));
    }
    async function updateResource(id, payload) {
      await requireResource(id);
      const row = await repository.updateResource(id, payload);
      if (!row) throw new AppError("\u8D44\u6E90\u4E0D\u5B58\u5728", 404);
      return row;
    }
    async function updateResourceContent(id, payload, user) {
      await requireResource(id);
      return repository.upsertResourceContent(id, payload, currentUserName(user));
    }
    async function updateResourceFieldMetadata(id, columnName, payload, user) {
      await requireResource(id);
      const decodedColumnName = String(columnName || "").trim();
      let updated = false;
      try {
        updated = await repository.updateResourceFieldMetadata(id, decodedColumnName, {
          columnComment: payload.columnComment || "",
          aiBusinessName: payload.aiBusinessName || "",
          aiBusinessMeaning: payload.aiBusinessMeaning || "",
          semanticTags: uniqueStrings(payload.semanticTags || []),
          featureTags: normalizeFeatureTags(payload.featureTags || []),
          ...Object.prototype.hasOwnProperty.call(payload, "standardElementId") ? { standardElementId: payload.standardElementId || null } : {},
          updatedBy: currentUserName(user)
        });
      } catch (error) {
        if (error.code === "STANDARD_ELEMENT_NOT_FOUND") {
          throw new AppError("\u6807\u51C6\u6570\u636E\u5143\u4E0D\u5B58\u5728", 404);
        }
        throw error;
      }
      if (!updated) {
        throw new AppError("\u5B57\u6BB5\u4E0D\u5B58\u5728", 404);
      }
      return getResourceDetail(id);
    }
    function mergeFieldProfileMetrics(metrics, fields = [], existingFieldProfiles = []) {
      const fieldMap = new Map(fields.map((field) => [field.columnName, field]));
      const existingMap = new Map(existingFieldProfiles.map((item) => [item.columnName, item]));
      return (metrics || []).map((item) => {
        const field = fieldMap.get(item.columnName) || {};
        const existing = existingMap.get(item.columnName) || {};
        return {
          ...item,
          semanticTags: uniqueStrings([
            ...field.semanticTags || [],
            ...existing.semanticTags || [],
            ...item.semanticTags || []
          ]),
          featureTags: normalizeFeatureTags(item.featureTags || []),
          aiBusinessName: existing.aiBusinessName || field.businessName || item.aiBusinessName || "",
          aiBusinessMeaning: existing.aiBusinessMeaning || item.aiBusinessMeaning || "",
          aiOutput: existing.aiOutput || item.aiOutput || null
        };
      });
    }
    async function getResourceProfile(id) {
      const resource = await requireResource(id);
      const [profile, fieldProfiles] = await Promise.all([
        repository.getResourceProfile(id),
        repository.listResourceFieldProfiles(id)
      ]);
      return {
        profile: profile || buildEmptyProfile(resource),
        fieldProfiles
      };
    }
    async function refreshResourceProfile(id, payload = {}) {
      const resource = await requireResource(id);
      const source = await requireDataSource(resource.dataSourceId);
      const fields = await repository.listResourceFields(id);
      let sampleRows = [];
      let sampleError = "";
      try {
        sampleRows = await metadataService.sampleRows(source, resource.tableName, Number(payload.sampleLimit || 100));
      } catch (error) {
        sampleError = error.message || "\u6837\u4F8B\u6570\u636E\u91C7\u96C6\u5931\u8D25";
      }
      const metrics = buildProfileMetrics(resource, fields, sampleRows, sampleError);
      const existingFieldProfiles = await repository.listResourceFieldProfiles(id);
      return repository.replaceResourceProfile(id, metrics.profile, mergeFieldProfileMetrics(metrics.fieldProfiles, fields, existingFieldProfiles));
    }
    async function deleteResource(id) {
      await requireResource(id);
      await runWithDuplicateGuard(() => repository.deleteResource(id), "");
      await refreshIngestionLineage();
    }
    async function deleteResources(ids = []) {
      const normalizedIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter(Boolean))];
      for (const id of normalizedIds) {
        await requireResource(id);
      }
      const deletedCount = await runWithDuplicateGuard(() => repository.deleteResources(normalizedIds), "");
      await refreshIngestionLineage();
      return { deletedCount };
    }
    function resolveDmSourceId(dmSources, ingestionSourceId, ingestionSourceCode) {
      const byRefId = dmSources.find((item) => item.sourceRefModule === "ingestion" && Number(item.sourceRefId) === Number(ingestionSourceId));
      if (byRefId) return byRefId.id;
      const byRefCode = dmSources.find((item) => item.sourceRefModule === "ingestion" && item.sourceRefCode && item.sourceRefCode === ingestionSourceCode);
      if (byRefCode) return byRefCode.id;
      const byCode = dmSources.find((item) => item.sourceCode === ingestionSourceCode);
      return byCode?.id || null;
    }
    function findResourceId(resources, dataSourceId, tableName) {
      if (!dataSourceId) return null;
      const candidates = tableCandidates(tableName);
      const matched = resources.find((item) => item.dataSourceId === Number(dataSourceId) && candidates.includes(item.tableName));
      return matched?.id || null;
    }
    async function refreshIngestionLineage() {
      const [facts, dmSources, resources] = await Promise.all([
        repository.listIngestionTaskLineageFacts(),
        repository.listDataSourcesForLineage(),
        repository.listResourcesForLineage()
      ]);
      const edges = [];
      for (const fact of facts) {
        const sourceDataSourceId = resolveDmSourceId(dmSources, fact.sourceId, fact.sourceCode);
        const targetDataSourceId = resolveDmSourceId(dmSources, fact.targetSourceId, fact.targetCode);
        const sourceResourceId = findResourceId(resources, sourceDataSourceId, fact.sourceTable);
        const targetResourceId = findResourceId(resources, targetDataSourceId, fact.targetTable);
        if (!sourceResourceId && !targetResourceId) {
          continue;
        }
        edges.push({
          sourceResourceId,
          targetResourceId,
          sourceDataSourceId,
          targetDataSourceId,
          sourceTableName: fact.sourceTable,
          targetTableName: fact.targetTable,
          relationSource: "ingestion_task",
          relationSourceId: fact.id,
          confidence: sourceDataSourceId && targetDataSourceId ? "high" : "medium"
        });
      }
      await repository.replaceIngestionLineageEdges(edges);
      return { syncedEdges: edges.length };
    }
    function renderPromptTemplate(template, variables = {}) {
      let content = String(template || "");
      for (const [key, value] of Object.entries(variables)) {
        content = content.replaceAll(`{{${key}}}`, String(value ?? ""));
      }
      return content;
    }
    async function resolveDataMapProvider(aiConfig) {
      if (!aiConfig?.defaultModelProviderId) {
        throw new AppError("\u6570\u636E\u5730\u56FE\u6A21\u578B\u672A\u914D\u7F6E\u9ED8\u8BA4\u6A21\u578B", 400);
      }
      const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
      return modelProviderService.applyModelSelection(provider, {
        modelName: aiConfig.defaultModelName,
        modelVersion: aiConfig.defaultModelVersion
      });
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
            content: `${String(item.content || "").trim()}

Return valid JSON only. The response must be a JSON object.`
          };
        }
        return item;
      });
    }
    function buildResourceAiEvidence(resource, content, profile, fieldProfiles, fields, lineage, standardElementCandidatesByField = {}) {
      const fieldProfileMap = new Map((fieldProfiles || []).map((item) => [item.columnName, item]));
      return {
        featureTagAnalysis: {
          output: "featureTags must be an array. Use zero, one, or multiple allowed codes based on field metadata and sample profile evidence.",
          allowedCodes: FIELD_FEATURE_TAG_CODES,
          evidencePolicy: "Use columnName, columnComment, dataType, columnType, isRequired, isPrimaryKey, nullRate and sampleValues together. Prefer conclusions supported by actual sample value patterns over keyword-only guesses."
        },
        resource: {
          resourceCode: resource.resourceCode,
          tableName: resource.tableName,
          tableComment: resource.tableComment,
          resourceCategory: resource.resourceCategory,
          businessTags: resource.businessTags || [],
          rowCount: resource.rowCount,
          columnCount: resource.columnCount,
          catalogName: resource.catalogName,
          catalogShortCode: resource.catalogShortCode
        },
        source: {
          departmentName: resource.departmentName,
          departmentCode: resource.departmentCode,
          businessSystemName: resource.systemName,
          businessSystemCode: resource.systemCode,
          dataSourceName: resource.sourceName,
          dataSourceCode: resource.sourceCode,
          dataSourceType: resource.sourceType
        },
        content: content || buildEmptyResourceContent(resource.id),
        profile: profile || buildEmptyProfile(resource),
        fields: (fields || []).map((field) => {
          const fieldProfile = fieldProfileMap.get(field.columnName) || {};
          return {
            columnName: field.columnName,
            dataType: field.dataType,
            columnType: field.columnType,
            isNullable: field.isNullable,
            isRequired: !field.isNullable,
            isPrimaryKey: field.isPrimaryKey,
            columnComment: field.columnComment,
            sampleProfile: {
              nullRate: fieldProfile.nullRate,
              sampleValues: fieldProfile.sampleValues || [],
              issueTags: fieldProfile.issueTags || []
            },
            currentStandardMapping: field.standardMapping || null,
            standardElementCandidates: standardElementCandidatesByField[field.columnName] || []
          };
        }),
        lineage: (lineage || []).map((edge) => ({
          sourceTableName: edge.sourceTableName,
          targetTableName: edge.targetTableName,
          sourceResourceCode: edge.sourceResourceCode,
          targetResourceCode: edge.targetResourceCode,
          relationSource: edge.relationSource,
          relationSourceId: edge.relationSourceId,
          confidence: edge.confidence
        }))
      };
    }
    async function getActiveDataMapAiConfig(sceneCode, label) {
      const aiConfig = await repository.getAiConfigByCode(sceneCode);
      if (!aiConfig || aiConfig.status !== "active") {
        throw new AppError(`\u6570\u636E\u5730\u56FE${label}\u6A21\u578B\u914D\u7F6E\u672A\u542F\u7528`, 400);
      }
      return aiConfig;
    }
    async function analyzeResourceContentProfile(id, payload = {}, user) {
      const resource = await requireResource(id);
      const refreshed = await refreshResourceProfile(id, { sampleLimit: payload.sampleLimit || 100 });
      let { profile, fieldProfiles } = refreshed;
      const aiConfig = await getActiveDataMapAiConfig(RESOURCE_CONTENT_PROFILE_SCENE_CODE, "\u5185\u5BB9\u753B\u50CF");
      const provider = await resolveDataMapProvider(aiConfig);
      const [content, fields, lineage] = await Promise.all([
        repository.getResourceContent(id),
        repository.listResourceFields(id),
        repository.listLineageEdges(id)
      ]);
      const evidence = buildResourceAiEvidence(resource, content, profile, fieldProfiles, fields, lineage, {});
      const resourceEvidence = JSON.stringify(evidence, null, 2);
      const userPrompt = renderPromptTemplate(
        aiConfig.userPromptTemplate || "\u8BF7\u57FA\u4E8E\u4EE5\u4E0B JSON \u8BC1\u636E\u751F\u6210\u8D44\u6E90\u5185\u5BB9\u753B\u50CF\uFF1A\n{{resourceEvidence}}",
        { resourceEvidence }
      );
      const messages = ensureJsonObjectPrompt([
        { role: "system", content: aiConfig.systemPrompt || DEFAULT_RESOURCE_CONTENT_PROFILE_PROMPT },
        { role: "user", content: userPrompt }
      ], provider);
      try {
        const completion = await modelProviderService.generateChatCompletion(provider, messages, {
          temperature: aiConfig.temperature ?? 0.1,
          maxTokens: Number(aiConfig.maxTokens || 2200),
          timeoutMs: Number(aiConfig.timeoutMs || 3e4),
          responseFormat: { type: "json_object" }
        });
        const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
        const normalizedOutput = {
          summary: parsed.summary || parsed.businessMeaning || "",
          businessMeaning: parsed.businessMeaning || "",
          businessGrain: parsed.businessGrain || "",
          usageSuggestions: uniqueStrings(Array.isArray(parsed.usageSuggestions) ? parsed.usageSuggestions : []),
          qualityFindings: uniqueStrings(Array.isArray(parsed.qualityFindings) ? parsed.qualityFindings : []),
          riskNotes: uniqueStrings(Array.isArray(parsed.riskNotes) ? parsed.riskNotes : []),
          tags: uniqueStrings(Array.isArray(parsed.tags) ? parsed.tags : [])
        };
        return await repository.updateResourceProfileAi(id, {
          profileStatus: "succeeded",
          aiSummary: normalizedOutput.summary,
          aiOutput: normalizedOutput
        }, []);
      } catch (error) {
        await repository.updateResourceProfileAi(id, {
          profileStatus: "failed",
          aiSummary: "",
          aiOutput: null,
          errorMessage: error.message || "\u6A21\u578B\u5206\u6790\u5931\u8D25"
        }, []);
        throw error;
      }
    }
    async function analyzeResourceFieldProfile(id, payload = {}, user) {
      const resource = await requireResource(id);
      const refreshed = await refreshResourceProfile(id, { sampleLimit: payload.sampleLimit || 100 });
      let { profile, fieldProfiles } = refreshed;
      const aiConfig = await getActiveDataMapAiConfig(RESOURCE_FIELD_PROFILE_SCENE_CODE, "\u5B57\u6BB5\u4FE1\u606F");
      const provider = await resolveDataMapProvider(aiConfig);
      const [content, fields, lineage] = await Promise.all([
        repository.getResourceContent(id),
        repository.listResourceFields(id),
        repository.listLineageEdges(id)
      ]);
      const standardCandidates = await buildStandardElementCandidates(fields, fieldProfiles);
      const evidence = buildResourceAiEvidence(resource, content, profile, fieldProfiles, fields, lineage, standardCandidates.byField);
      const resourceEvidence = JSON.stringify(evidence, null, 2);
      const userPrompt = renderPromptTemplate(
        aiConfig.userPromptTemplate || "\u8BF7\u57FA\u4E8E\u4EE5\u4E0B JSON \u8BC1\u636E\u751F\u6210\u5B57\u6BB5\u4FE1\u606F\u5206\u6790\uFF1A\n{{resourceEvidence}}",
        { resourceEvidence }
      );
      const messages = ensureJsonObjectPrompt([
        { role: "system", content: `${aiConfig.systemPrompt || DEFAULT_RESOURCE_FIELD_PROFILE_PROMPT}

${STANDARD_MAPPING_RUNTIME_PROMPT}` },
        { role: "user", content: userPrompt }
      ], provider);
      const completion = await modelProviderService.generateChatCompletion(provider, messages, {
        temperature: aiConfig.temperature ?? 0.1,
        maxTokens: Number(aiConfig.maxTokens || 2200),
        timeoutMs: Number(aiConfig.timeoutMs || 3e4),
        responseFormat: { type: "json_object" }
      });
      const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
      const existingFieldProfileMap = new Map(fieldProfiles.map((item) => [item.columnName, item]));
      const aiInsightMap = new Map((Array.isArray(parsed.fieldInsights) ? parsed.fieldInsights : []).filter((item) => item?.columnName).map((item) => [String(item.columnName), item]));
      const standardSuggestions = [];
      const aiFieldProfiles = fields.map((field) => {
        const item = aiInsightMap.get(field.columnName) || {};
        const itemOutput = { ...item };
        delete itemOutput.semanticTags;
        const existing = existingFieldProfileMap.get(field.columnName) || {};
        const standardElementCode = String(item.standardElementCode || item.dataElementCode || item.elementCode || "").trim().toUpperCase();
        const standardElement = standardElementCode ? standardCandidates.elementByCode.get(standardElementCode) : null;
        const standardElementConfidence = normalizeModelConfidence(item.standardElementConfidence ?? item.confidence, 0.7);
        if (standardElement && standardElementConfidence >= STANDARD_MAPPING_MIN_CONFIDENCE) {
          standardSuggestions.push({
            columnName: field.columnName,
            elementId: standardElement.id,
            confidence: standardElementConfidence,
            evidence: uniqueStrings(Array.isArray(item.standardElementEvidence) ? item.standardElementEvidence : item.evidence || [])
          });
        }
        return {
          columnName: field.columnName,
          sampleValues: existing.sampleValues || [],
          issueTags: uniqueStrings([...existing.issueTags || [], ...Array.isArray(item.issueTags) ? item.issueTags : []]),
          semanticTags: existing.semanticTags || [],
          featureTags: normalizeFeatureTags(item.featureTags || []),
          aiBusinessName: item.aiBusinessName || item.businessName || existing.aiBusinessName || "",
          aiBusinessMeaning: item.aiBusinessMeaning || item.businessMeaning || existing.aiBusinessMeaning || "",
          aiOutput: Object.keys(itemOutput).length > 0 ? itemOutput : existing.aiOutput || null
        };
      });
      const result = await repository.updateResourceFieldProfilesAi(id, aiFieldProfiles);
      await repository.replaceAiSuggestedFieldStandardMappings(id, standardSuggestions, currentUserName(user));
      return result;
    }
    async function analyzeResourceProfile(id, payload = {}, user) {
      await analyzeResourceContentProfile(id, payload, user);
      try {
        return await analyzeResourceFieldProfile(id, payload, user);
      } catch (error) {
        throw error;
      }
    }
    function makeGraphNode(id, label, type, data = {}) {
      return { id, label, type, data };
    }
    async function getResourceLineageGraph(id, query = {}) {
      const resource = await requireResource(id);
      const direction = String(query.direction || "both");
      const edges = await repository.listLineageEdges(id);
      const resources = await repository.listResources({});
      const resourceMap = new Map(resources.map((item) => [item.id, item]));
      const nodes = /* @__PURE__ */ new Map();
      const graphEdges = [];
      const currentNodeId = `resource:${resource.id}`;
      nodes.set(currentNodeId, makeGraphNode(currentNodeId, resource.tableName, "current", {
        resourceId: resource.id,
        resourceCode: resource.resourceCode,
        sourceName: resource.sourceName,
        systemName: resource.systemName
      }));
      function resolveNode(resourceId, dataSourceId, tableName, resourceCode, sourceName) {
        if (resourceId && resourceMap.has(Number(resourceId))) {
          const matched = resourceMap.get(Number(resourceId));
          return makeGraphNode(`resource:${matched.id}`, matched.tableName, matched.id === resource.id ? "current" : "resource", {
            resourceId: matched.id,
            resourceCode: matched.resourceCode,
            sourceName: matched.sourceName,
            systemName: matched.systemName
          });
        }
        const externalId = `external:${dataSourceId || "unknown"}:${String(tableName || "").toLowerCase()}`;
        return makeGraphNode(externalId, tableName || "\u672A\u6CE8\u518C\u8868", "external", {
          resourceCode: resourceCode || "",
          sourceName: sourceName || "",
          dataSourceId: dataSourceId || null
        });
      }
      for (const edge of edges) {
        const isUpstream = Number(edge.targetResourceId) === Number(id);
        const isDownstream = Number(edge.sourceResourceId) === Number(id);
        if (direction === "upstream" && !isUpstream) continue;
        if (direction === "downstream" && !isDownstream) continue;
        const sourceNode = resolveNode(edge.sourceResourceId, edge.sourceDataSourceId, edge.sourceTableName, edge.sourceResourceCode, edge.sourceName);
        const targetNode = resolveNode(edge.targetResourceId, edge.targetDataSourceId, edge.targetTableName, edge.targetResourceCode, edge.targetName);
        nodes.set(sourceNode.id, sourceNode);
        nodes.set(targetNode.id, targetNode);
        graphEdges.push({
          id: `edge:${edge.id}`,
          source: sourceNode.id,
          target: targetNode.id,
          label: edge.relationSourceId ? `${edge.lineageType} #${edge.relationSourceId}` : edge.lineageType,
          data: edge
        });
      }
      return {
        nodes: Array.from(nodes.values()),
        edges: graphEdges
      };
    }
    async function listAiConfigs() {
      return repository.listAiConfigs();
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
    async function updateAiConfig(id, payload) {
      const existing = await repository.getAiConfigById(id);
      if (!existing) {
        throw new AppError("\u6570\u636E\u5730\u56FE\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      const normalizedModel = await validateDefaultProvider(
        payload.defaultModelProviderId ?? existing.defaultModelProviderId,
        payload.defaultModelName ?? existing.defaultModelName,
        payload.defaultModelVersion ?? existing.defaultModelVersion
      );
      const row = await repository.updateAiConfig(id, {
        ...existing,
        ...payload,
        defaultModelProviderId: normalizedModel.defaultModelProviderId,
        defaultModelName: normalizedModel.defaultModelName,
        defaultModelVersion: normalizedModel.defaultModelVersion,
        temperature: payload.temperature ?? existing.temperature ?? null,
        maxTokens: payload.maxTokens ?? existing.maxTokens ?? null,
        timeoutMs: payload.timeoutMs ?? existing.timeoutMs ?? null,
        systemPrompt: payload.systemPrompt || null,
        userPromptTemplate: payload.userPromptTemplate || null,
        outputSchema: payload.outputSchema || existing.outputSchema || {}
      });
      if (!row) {
        throw new AppError("\u6570\u636E\u5730\u56FE\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function getResourceDetail(id) {
      const resource = await requireResource(id);
      const [fields, lineage, content, profile, fieldProfiles] = await Promise.all([
        repository.listResourceFields(id),
        repository.listLineageEdges(id),
        repository.getResourceContent(id),
        repository.getResourceProfile(id),
        repository.listResourceFieldProfiles(id)
      ]);
      return {
        ...resource,
        content: content || buildEmptyResourceContent(id),
        profile: profile || buildEmptyProfile(resource),
        fieldProfiles,
        fields,
        lineage
      };
    }
    module2.exports = {
      analyzeResourceContentProfile,
      analyzeResourceFieldProfile,
      analyzeResourceProfile,
      createBusinessSystem,
      createCatalog,
      createDataSource,
      createDepartment,
      deleteBusinessSystem,
      deleteCatalog,
      deleteDataSource,
      deleteDepartment,
      deleteResource,
      deleteResources,
      getResourceLineageGraph,
      getOverview: repository.getOverview,
      getResourceProfile,
      getResourceDetail,
      listAiConfigs,
      listBusinessSystems: repository.listBusinessSystems,
      listCatalogs: repository.listCatalogs,
      listCatalogTree: async () => buildCatalogTree(await repository.listCatalogs()),
      listDataSourceColumns,
      listDataSourceTables,
      listDataSources: repository.listDataSources,
      listDepartments: repository.listDepartments,
      listExternalDataSources,
      listResources: repository.listResources,
      refreshIngestionLineage,
      refreshResourceProfile,
      registerResources,
      sampleResourceRows,
      searchResources: repository.searchResources,
      testDataSource,
      updateAiConfig,
      updateBusinessSystem,
      updateCatalog,
      updateDataSource,
      updateDepartment,
      updateResourceContent,
      updateResourceFieldMetadata,
      updateResource
    };
  }
});

// backend/src/modules/data-map/data-map.controller.js
var require_data_map_controller = __commonJS({
  "backend/src/modules/data-map/data-map.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var service = require_data_map_service();
    async function getOverview(req, res) {
      return sendSuccess(res, await service.getOverview());
    }
    async function listDepartments(req, res) {
      const rows = await service.listDepartments();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createDepartment(req, res) {
      return sendSuccess(res, await service.createDepartment(req.validatedBody, req.user), null, 201);
    }
    async function updateDepartment(req, res) {
      return sendSuccess(res, await service.updateDepartment(Number(req.params.id), req.validatedBody));
    }
    async function deleteDepartment(req, res) {
      await service.deleteDepartment(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function listBusinessSystems(req, res) {
      const rows = await service.listBusinessSystems();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createBusinessSystem(req, res) {
      return sendSuccess(res, await service.createBusinessSystem(req.validatedBody, req.user), null, 201);
    }
    async function updateBusinessSystem(req, res) {
      return sendSuccess(res, await service.updateBusinessSystem(Number(req.params.id), req.validatedBody));
    }
    async function deleteBusinessSystem(req, res) {
      await service.deleteBusinessSystem(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function listDataSources(req, res) {
      const rows = await service.listDataSources();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listExternalDataSources(req, res) {
      const rows = await service.listExternalDataSources(req.query.module);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createDataSource(req, res) {
      return sendSuccess(res, await service.createDataSource(req.validatedBody, req.user), null, 201);
    }
    async function updateDataSource(req, res) {
      return sendSuccess(res, await service.updateDataSource(Number(req.params.id), req.validatedBody));
    }
    async function deleteDataSource(req, res) {
      await service.deleteDataSource(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function testDataSource(req, res) {
      return sendSuccess(res, await service.testDataSource(req.validatedBody));
    }
    async function listDataSourceTables(req, res) {
      const rows = await service.listDataSourceTables(Number(req.params.id));
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listDataSourceColumns(req, res) {
      const rows = await service.listDataSourceColumns(Number(req.params.id), req.params.tableName);
      return sendSuccess(res, rows, { total: rows.length });
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
    async function registerResources(req, res) {
      const rows = await service.registerResources(Number(req.params.id), req.validatedBody, req.user);
      return sendSuccess(res, rows, { total: rows.length }, 201);
    }
    async function listResources(req, res) {
      const rows = await service.listResources(req.query || {});
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function searchResources(req, res) {
      const rows = await service.searchResources(req.query || {});
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getResourceDetail(req, res) {
      return sendSuccess(res, await service.getResourceDetail(Number(req.params.id)));
    }
    async function updateResource(req, res) {
      return sendSuccess(res, await service.updateResource(Number(req.params.id), req.validatedBody));
    }
    async function updateResourceContent(req, res) {
      return sendSuccess(res, await service.updateResourceContent(Number(req.params.id), req.validatedBody, req.user));
    }
    async function updateResourceField(req, res) {
      return sendSuccess(res, await service.updateResourceFieldMetadata(Number(req.params.id), req.params.columnName, req.validatedBody, req.user));
    }
    async function getResourceProfile(req, res) {
      return sendSuccess(res, await service.getResourceProfile(Number(req.params.id)));
    }
    async function refreshResourceProfile(req, res) {
      return sendSuccess(res, await service.refreshResourceProfile(Number(req.params.id), req.validatedBody));
    }
    async function analyzeResourceProfile(req, res) {
      return sendSuccess(res, await service.analyzeResourceProfile(Number(req.params.id), req.validatedBody, req.user));
    }
    async function analyzeResourceContentProfile(req, res) {
      return sendSuccess(res, await service.analyzeResourceContentProfile(Number(req.params.id), req.validatedBody, req.user));
    }
    async function analyzeResourceFieldProfile(req, res) {
      return sendSuccess(res, await service.analyzeResourceFieldProfile(Number(req.params.id), req.validatedBody, req.user));
    }
    async function getResourceLineageGraph(req, res) {
      return sendSuccess(res, await service.getResourceLineageGraph(Number(req.params.id), req.query || {}));
    }
    async function deleteResource(req, res) {
      await service.deleteResource(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function deleteResources(req, res) {
      return sendSuccess(res, await service.deleteResources(req.validatedBody.ids));
    }
    async function sampleResourceRows(req, res) {
      const rows = await service.sampleResourceRows(Number(req.params.id), req.query.limit);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function refreshIngestionLineage(req, res) {
      return sendSuccess(res, await service.refreshIngestionLineage());
    }
    async function listAiConfigs(req, res) {
      const rows = await service.listAiConfigs();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function updateAiConfig(req, res) {
      return sendSuccess(res, await service.updateAiConfig(Number(req.params.id), req.validatedBody));
    }
    module2.exports = {
      analyzeResourceContentProfile,
      analyzeResourceFieldProfile,
      analyzeResourceProfile,
      createBusinessSystem,
      createCatalog,
      createDataSource,
      createDepartment,
      deleteBusinessSystem,
      deleteCatalog,
      deleteDataSource,
      deleteDepartment,
      deleteResource,
      deleteResources,
      getOverview,
      getResourceDetail,
      getResourceLineageGraph,
      getResourceProfile,
      listAiConfigs,
      listBusinessSystems,
      listCatalogTree,
      listCatalogs,
      listDataSourceColumns,
      listDataSourceTables,
      listDataSources,
      listDepartments,
      listExternalDataSources,
      listResources,
      refreshIngestionLineage,
      registerResources,
      sampleResourceRows,
      searchResources,
      testDataSource,
      refreshResourceProfile,
      updateBusinessSystem,
      updateCatalog,
      updateDataSource,
      updateDepartment,
      updateAiConfig,
      updateResourceContent,
      updateResourceField,
      updateResource
    };
  }
});

// packages/data-platform-module-data-map/src/.runtime-entry.js
var controller0 = require_data_map_controller();
var { Writable } = require("node:stream");
var handlers = {
  "GET /api/v1/data-map/overview": controller0["getOverview"],
  "GET /api/v1/data-map/departments": controller0["listDepartments"],
  "POST /api/v1/data-map/departments": controller0["createDepartment"],
  "PUT /api/v1/data-map/departments/:id": controller0["updateDepartment"],
  "DELETE /api/v1/data-map/departments/:id": controller0["deleteDepartment"],
  "GET /api/v1/data-map/business-systems": controller0["listBusinessSystems"],
  "POST /api/v1/data-map/business-systems": controller0["createBusinessSystem"],
  "PUT /api/v1/data-map/business-systems/:id": controller0["updateBusinessSystem"],
  "DELETE /api/v1/data-map/business-systems/:id": controller0["deleteBusinessSystem"],
  "GET /api/v1/data-map/data-sources/external": controller0["listExternalDataSources"],
  "GET /api/v1/data-map/data-sources": controller0["listDataSources"],
  "POST /api/v1/data-map/data-sources": controller0["createDataSource"],
  "PUT /api/v1/data-map/data-sources/:id": controller0["updateDataSource"],
  "DELETE /api/v1/data-map/data-sources/:id": controller0["deleteDataSource"],
  "POST /api/v1/data-map/data-sources/test-connection": controller0["testDataSource"],
  "GET /api/v1/data-map/data-sources/:id/tables": controller0["listDataSourceTables"],
  "GET /api/v1/data-map/data-sources/:id/tables/:tableName/columns": controller0["listDataSourceColumns"],
  "GET /api/v1/data-map/catalogs/tree": controller0["listCatalogTree"],
  "GET /api/v1/data-map/catalogs": controller0["listCatalogs"],
  "POST /api/v1/data-map/catalogs": controller0["createCatalog"],
  "PUT /api/v1/data-map/catalogs/:id": controller0["updateCatalog"],
  "DELETE /api/v1/data-map/catalogs/:id": controller0["deleteCatalog"],
  "POST /api/v1/data-map/catalogs/:id/register-resources": controller0["registerResources"],
  "POST /api/v1/data-map/lineage/refresh-ingestion": controller0["refreshIngestionLineage"],
  "GET /api/v1/data-map/ai-configs": controller0["listAiConfigs"],
  "PUT /api/v1/data-map/ai-configs/:id": controller0["updateAiConfig"],
  "GET /api/v1/data-map/search/resources": controller0["searchResources"],
  "GET /api/v1/data-map/resources": controller0["listResources"],
  "POST /api/v1/data-map/resources/batch-delete": controller0["deleteResources"],
  "GET /api/v1/data-map/resources/:id": controller0["getResourceDetail"],
  "PUT /api/v1/data-map/resources/:id": controller0["updateResource"],
  "DELETE /api/v1/data-map/resources/:id": controller0["deleteResource"],
  "PUT /api/v1/data-map/resources/:id/content": controller0["updateResourceContent"],
  "PUT /api/v1/data-map/resources/:id/fields/:columnName": controller0["updateResourceField"],
  "GET /api/v1/data-map/resources/:id/profile": controller0["getResourceProfile"],
  "POST /api/v1/data-map/resources/:id/profile/refresh": controller0["refreshResourceProfile"],
  "POST /api/v1/data-map/resources/:id/profile/content-ai-analyze": controller0["analyzeResourceContentProfile"],
  "POST /api/v1/data-map/resources/:id/profile/fields-ai-analyze": controller0["analyzeResourceFieldProfile"],
  "POST /api/v1/data-map/resources/:id/profile/ai-analyze": controller0["analyzeResourceProfile"],
  "GET /api/v1/data-map/resources/:id/lineage-graph": controller0["getResourceLineageGraph"],
  "GET /api/v1/data-map/resources/:id/sample": controller0["sampleResourceRows"]
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
