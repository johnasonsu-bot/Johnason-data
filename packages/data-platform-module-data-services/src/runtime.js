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

// runtime-port:project-context
var require_project_context = __commonJS({
  "runtime-port:project-context"(exports2, module2) {
    var k = require("@johnason/data-platform-core-kernel");
    module2.exports = { runWithProjectContext: (_context, callback) => callback(), getProjectContext: k.getProjectContext, getCurrentProjectId: k.getCurrentProjectId, getProjectCondition: k.getProjectCondition, addProjectCondition: k.addProjectCondition };
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

// backend/src/modules/data-services/data-service.controller.js
var require_data_service_controller = __commonJS({
  "backend/src/modules/data-services/data-service.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var service = require_data_service_service();
    async function getOverview(req, res) {
      const data = await service.getOverview();
      return sendSuccess(res, data);
    }
    async function getOpsDashboard(req, res) {
      const data = await service.getOpsDashboard();
      return sendSuccess(res, data);
    }
    async function listServiceDataSources(req, res) {
      const rows = await service.listServiceDataSources();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createServiceDataSource(req, res) {
      const row = await service.createServiceDataSource(req.validatedBody);
      return sendSuccess(res, row, null, 201);
    }
    async function updateServiceDataSource(req, res) {
      const row = await service.updateServiceDataSource(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function deleteServiceDataSource(req, res) {
      const result = await service.deleteServiceDataSource(Number(req.params.id));
      return sendSuccess(res, result);
    }
    async function testServiceDataSourceConnection(req, res) {
      const result = await service.testServiceDataSourceConnection(req.validatedBody);
      return sendSuccess(res, result);
    }
    async function listServiceDataSourceTables(req, res) {
      const rows = await service.listServiceDataSourceTables(Number(req.params.id));
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function listServiceDataSourceColumns(req, res) {
      const rows = await service.listServiceDataSourceColumns(Number(req.params.id), req.params.tableName);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function sampleServiceDataSourceRows(req, res) {
      const rows = await service.sampleServiceDataSourceRows(Number(req.params.id), req.params.tableName, req.query.limit);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function previewServiceSql(req, res) {
      const data = await service.previewServiceSql(req.validatedBody.sourceId, req.validatedBody.sql);
      return sendSuccess(res, data);
    }
    async function listServices(req, res) {
      const rows = await service.listServices();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createService(req, res) {
      const row = await service.createService(req.validatedBody);
      return sendSuccess(res, row, null, 201);
    }
    async function updateService(req, res) {
      const row = await service.updateService(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function updateServiceStatus(req, res) {
      const row = await service.updateServiceStatus(Number(req.params.id), req.validatedBody.status);
      return sendSuccess(res, row);
    }
    async function deleteService(req, res) {
      const result = await service.deleteService(Number(req.params.id));
      return sendSuccess(res, result);
    }
    async function debugService(req, res) {
      const result = await service.debugService(Number(req.params.id), req.body || {});
      return sendSuccess(res, result);
    }
    async function exportServiceInterfaceDoc(req, res) {
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.get("host");
      const defaultBaseUrl = host ? `${protocol}://${host}` : "";
      const payload = await service.exportServiceInterfaceDoc(Number(req.params.id), {
        baseUrl: req.query.baseUrl ? String(req.query.baseUrl) : defaultBaseUrl
      });
      const utf8FileName = encodeURIComponent(payload.fileName || "service_api_doc.docx");
      let asciiFallbackFileName = String(payload.fileName || "service_api_doc.docx").replace(/[^\x20-\x7E]+/g, "_").replace(/"/g, "");
      if (!asciiFallbackFileName) {
        asciiFallbackFileName = "service_api_doc.docx";
      }
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${asciiFallbackFileName}"; filename*=UTF-8''${utf8FileName}`
      );
      return res.send(payload.buffer);
    }
    async function recommendServiceConfig(req, res) {
      const result = await service.recommendServiceConfig(req.validatedBody);
      return sendSuccess(res, result);
    }
    async function listServiceAiConfigs(req, res) {
      const rows = await service.listServiceAiConfigs();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function updateServiceAiConfig(req, res) {
      const row = await service.updateServiceAiConfig(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function listServiceApps(req, res) {
      const rows = await service.listServiceApps();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createServiceApp(req, res) {
      const row = await service.createServiceApp(req.validatedBody);
      return sendSuccess(res, row, null, 201);
    }
    async function updateServiceApp(req, res) {
      const row = await service.updateServiceApp(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function deleteServiceApp(req, res) {
      const result = await service.deleteServiceApp(Number(req.params.id));
      return sendSuccess(res, result);
    }
    async function listAuthorizations(req, res) {
      const rows = await service.listAuthorizations();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createAuthorization(req, res) {
      const row = await service.createAuthorization(req.validatedBody);
      return sendSuccess(res, row, null, 201);
    }
    async function updateAuthorization(req, res) {
      const row = await service.updateAuthorization(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function deleteAuthorization(req, res) {
      const result = await service.deleteAuthorization(Number(req.params.id));
      return sendSuccess(res, result);
    }
    async function listServiceLogs(req, res) {
      const rows = await service.listServiceLogs({
        serviceId: req.query.serviceId ? Number(req.query.serviceId) : void 0,
        appId: req.query.appId ? Number(req.query.appId) : void 0,
        departmentName: req.query.departmentName ? String(req.query.departmentName) : void 0,
        startAt: req.query.startAt ? String(req.query.startAt) : void 0,
        endAt: req.query.endAt ? String(req.query.endAt) : void 0,
        paramsKeyword: req.query.paramsKeyword ? String(req.query.paramsKeyword) : void 0,
        limit: req.query.limit ? Number(req.query.limit) : void 0
      });
      return sendSuccess(res, rows, { total: rows.length });
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
      listAuthorizations,
      listServiceAiConfigs,
      listServiceDataSourceColumns,
      listServiceDataSourceTables,
      listServiceDataSources,
      listServiceApps,
      listServiceLogs,
      listServices,
      previewServiceSql,
      recommendServiceConfig,
      sampleServiceDataSourceRows,
      testServiceDataSourceConnection,
      updateAuthorization,
      updateServiceStatus,
      updateService,
      updateServiceAiConfig,
      updateServiceApp,
      updateServiceDataSource
    };
  }
});

// packages/data-platform-module-data-services/src/.runtime-entry.js
var controller0 = require_data_service_controller();
var { Writable } = require("node:stream");
var handlers = {
  "GET /api/v1/data-services/overview": controller0["getOverview"],
  "GET /api/v1/data-services/ops-dashboard": controller0["getOpsDashboard"],
  "GET /api/v1/data-services/data-sources": controller0["listServiceDataSources"],
  "POST /api/v1/data-services/data-sources": controller0["createServiceDataSource"],
  "PUT /api/v1/data-services/data-sources/:id": controller0["updateServiceDataSource"],
  "DELETE /api/v1/data-services/data-sources/:id": controller0["deleteServiceDataSource"],
  "POST /api/v1/data-services/data-sources/test-connection": controller0["testServiceDataSourceConnection"],
  "GET /api/v1/data-services/data-sources/:id/tables": controller0["listServiceDataSourceTables"],
  "GET /api/v1/data-services/data-sources/:id/tables/:tableName/columns": controller0["listServiceDataSourceColumns"],
  "GET /api/v1/data-services/data-sources/:id/tables/:tableName/sample": controller0["sampleServiceDataSourceRows"],
  "POST /api/v1/data-services/data-sources/sql-preview": controller0["previewServiceSql"],
  "GET /api/v1/data-services/services": controller0["listServices"],
  "POST /api/v1/data-services/services/recommend-config": controller0["recommendServiceConfig"],
  "POST /api/v1/data-services/services": controller0["createService"],
  "PUT /api/v1/data-services/services/:id/status": controller0["updateServiceStatus"],
  "PUT /api/v1/data-services/services/:id": controller0["updateService"],
  "DELETE /api/v1/data-services/services/:id": controller0["deleteService"],
  "GET /api/v1/data-services/services/:id/docx": controller0["exportServiceInterfaceDoc"],
  "POST /api/v1/data-services/services/:id/debug": controller0["debugService"],
  "GET /api/v1/data-services/ai-configs": controller0["listServiceAiConfigs"],
  "PUT /api/v1/data-services/ai-configs/:id": controller0["updateServiceAiConfig"],
  "GET /api/v1/data-services/apps": controller0["listServiceApps"],
  "POST /api/v1/data-services/apps": controller0["createServiceApp"],
  "PUT /api/v1/data-services/apps/:id": controller0["updateServiceApp"],
  "DELETE /api/v1/data-services/apps/:id": controller0["deleteServiceApp"],
  "GET /api/v1/data-services/authorizations": controller0["listAuthorizations"],
  "POST /api/v1/data-services/authorizations": controller0["createAuthorization"],
  "PUT /api/v1/data-services/authorizations/:id": controller0["updateAuthorization"],
  "DELETE /api/v1/data-services/authorizations/:id": controller0["deleteAuthorization"],
  "GET /api/v1/data-services/logs": controller0["listServiceLogs"],
  "GET /api/service/*": async (req, res) => {
    const result = await require_data_service_service().invokeService(req.method, req.params[0] || "/", req.method === "GET" ? req.query : req.body, { headers: req.headers, ip: req.ip, req });
    return res.json({ success: true, data: result.data, meta: result.meta, service: result.service, app: result.app });
  },
  "POST /api/service/*": async (req, res) => {
    const result = await require_data_service_service().invokeService(req.method, req.params[0] || "/", req.method === "GET" ? req.query : req.body, { headers: req.headers, ip: req.ip, req });
    return res.json({ success: true, data: result.data, meta: result.meta, service: result.service, app: result.app });
  }
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
