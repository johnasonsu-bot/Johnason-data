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

// backend/src/modules/data-sources/data-source.repository.js
var require_data_source_repository = __commonJS({
  "backend/src/modules/data-sources/data-source.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var { getCurrentProjectId } = require_project_context();
    function mapRow(row) {
      let connectionConfig = row.connectionConfig;
      if (typeof connectionConfig === "string") {
        try {
          connectionConfig = JSON.parse(connectionConfig);
        } catch (error) {
          connectionConfig = {};
        }
      }
      return {
        ...row,
        connectionConfig: connectionConfig || {},
        sourceDomain: row.sourceDomain || "integration"
      };
    }
    async function getDataSourceById(id) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [rows] = await pool.query(
        `SELECT id, source_name AS sourceName, source_code AS sourceCode, 'integration' AS sourceDomain, source_type AS sourceType,
            connection_config AS connectionConfig, owner_name AS ownerName, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM ingestion_data_sources
     WHERE id = ?${projectWhere}`,
        projectId ? [id, projectId] : [id]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    }
    async function listDataSources(sourceDomain = null, sourceIds = []) {
      const projectId = getCurrentProjectId();
      const where = [];
      const params = [];
      if (projectId) {
        where.push("ds.project_id = ?");
        params.push(projectId);
      }
      const normalizedSourceIds = Array.from(new Set((Array.isArray(sourceIds) ? sourceIds : []).map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0)));
      if (normalizedSourceIds.length > 0) {
        where.push(`ds.id IN (${normalizedSourceIds.map(() => "?").join(", ")})`);
        params.push(...normalizedSourceIds);
      }
      const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
      const [rows] = await pool.query(
        `SELECT ds.id, ds.source_name AS sourceName, ds.source_code AS sourceCode, 'integration' AS sourceDomain, ds.source_type AS sourceType,
            ds.connection_config AS connectionConfig, ds.owner_name AS ownerName, ds.status,
            COUNT(DISTINCT it.id) + COUNT(DISTINCT ij.id) + COUNT(DISTINCT fit.id) AS taskReferenceCount,
            ds.created_at AS createdAt, ds.updated_at AS updatedAt
     FROM ingestion_data_sources ds
     LEFT JOIN ingestion_tasks it
       ON (ds.id = it.source_id OR ds.id = it.target_source_id)
      AND it.project_id = ds.project_id
     LEFT JOIN ingestion_jobs ij
       ON ds.id = ij.source_id AND ij.project_id = ds.project_id
     LEFT JOIN file_import_tasks fit
       ON ds.id = fit.target_source_id AND fit.project_id = ds.project_id
     ${whereClause}
     GROUP BY ds.id, ds.source_name, ds.source_code, ds.source_type, ds.connection_config, ds.owner_name, ds.status, ds.created_at, ds.updated_at
     ORDER BY ds.id DESC`,
        params
      );
      return rows.map((row) => ({
        ...mapRow(row),
        taskReferenceCount: Number(row.taskReferenceCount || 0)
      }));
    }
    async function listReferencedTasks(id) {
      const projectId = getCurrentProjectId();
      const taskProjectWhere = projectId ? " AND it.project_id = ?" : "";
      const fileProjectWhere = projectId ? " AND fit.project_id = ?" : "";
      const params = projectId ? [id, id, projectId, id, projectId, id, projectId] : [id, id, id, id];
      const [rows] = await pool.query(
        `SELECT *
     FROM (
       SELECT DISTINCT
              CONCAT('task-', it.id) AS referenceKey,
              'task' AS referenceType,
              it.id,
              it.task_name AS taskName,
              it.task_code AS taskCode,
              it.source_id AS sourceId,
              src.source_name AS sourceName,
              it.target_source_id AS targetSourceId,
              tgt.source_name AS targetSourceName,
              it.source_table AS sourceTable,
              it.target_table AS targetTable,
              it.sync_mode AS syncMode,
              it.status,
              it.updated_at AS updatedAt
       FROM ingestion_tasks it
       LEFT JOIN ingestion_data_sources src ON it.source_id = src.id
       LEFT JOIN ingestion_data_sources tgt ON it.target_source_id = tgt.id
       WHERE (it.source_id = ? OR it.target_source_id = ?)${taskProjectWhere}

       UNION ALL

       SELECT DISTINCT
              CONCAT('job-', ij.id) AS referenceKey,
              'job' AS referenceType,
              ij.id,
              ij.job_name AS taskName,
              ij.job_code AS taskCode,
              ij.source_id AS sourceId,
              src.source_name AS sourceName,
              NULL AS targetSourceId,
              NULL AS targetSourceName,
              NULL AS sourceTable,
              ij.target_table AS targetTable,
              ij.sync_mode AS syncMode,
              ij.status,
              ij.updated_at AS updatedAt
       FROM ingestion_jobs ij
       LEFT JOIN ingestion_data_sources src ON ij.source_id = src.id
       WHERE ij.source_id = ?${projectId ? " AND ij.project_id = ?" : ""}

       UNION ALL

       SELECT DISTINCT
              CONCAT('file-import-', fit.id) AS referenceKey,
              'task' AS referenceType,
              fit.id,
              fit.task_name AS taskName,
              fit.task_code AS taskCode,
              NULL AS sourceId,
              NULL AS sourceName,
              fit.target_source_id AS targetSourceId,
              tgt.source_name AS targetSourceName,
              NULL AS sourceTable,
              fit.target_table AS targetTable,
              'file_import' AS syncMode,
              fit.status,
              fit.updated_at AS updatedAt
       FROM file_import_tasks fit
       LEFT JOIN ingestion_data_sources tgt ON fit.target_source_id = tgt.id
       WHERE fit.target_source_id = ?${fileProjectWhere}
     ) refs
     ORDER BY refs.updatedAt DESC, refs.id DESC`,
        params
      );
      return rows;
    }
    async function createDataSource(payload) {
      const projectId = getCurrentProjectId();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const shadowCode = `ing__${payload.sourceCode}`;
        const [shadowResult] = await connection.query(
          `INSERT INTO data_sources
        (project_id, source_name, source_code, source_domain, source_type, connection_config, owner_name, status)
       VALUES (?, ?, ?, 'integration_shadow', ?, ?, ?, ?)`,
          [
            projectId,
            payload.sourceName,
            shadowCode,
            payload.sourceType,
            JSON.stringify(payload.connectionConfig || {}),
            payload.ownerName,
            payload.status
          ]
        );
        const sourceId = Number(shadowResult.insertId);
        await connection.query(
          `INSERT INTO ingestion_data_sources
        (id, project_id, source_name, source_code, source_type, connection_config, owner_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sourceId,
            projectId,
            payload.sourceName,
            payload.sourceCode,
            payload.sourceType,
            JSON.stringify(payload.connectionConfig || {}),
            payload.ownerName,
            payload.status
          ]
        );
        await connection.commit();
        return getDataSourceById(sourceId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function updateDataSource(id, payload) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.query(
          `UPDATE ingestion_data_sources
       SET source_name = ?, source_code = ?, source_type = ?, connection_config = ?, owner_name = ?, status = ?
       WHERE id = ?${projectWhere}`,
          [
            payload.sourceName,
            payload.sourceCode,
            payload.sourceType,
            JSON.stringify(payload.connectionConfig || {}),
            payload.ownerName,
            payload.status,
            id,
            ...projectId ? [projectId] : []
          ]
        );
        if (Number(result.affectedRows || 0) === 0) {
          await connection.rollback();
          return null;
        }
        await connection.query(
          `UPDATE data_sources
       SET source_name = ?, source_type = ?, connection_config = ?, owner_name = ?, status = ?
       WHERE id = ?${projectWhere}`,
          [
            payload.sourceName,
            payload.sourceType,
            JSON.stringify(payload.connectionConfig || {}),
            payload.ownerName,
            payload.status,
            id,
            ...projectId ? [projectId] : []
          ]
        );
        await connection.commit();
        return getDataSourceById(id);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function deleteDataSource(id) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.query(
          `DELETE FROM ingestion_data_sources WHERE id = ?${projectWhere}`,
          projectId ? [id, projectId] : [id]
        );
        await connection.query(
          `DELETE FROM data_sources WHERE id = ?${projectWhere}`,
          projectId ? [id, projectId] : [id]
        );
        await connection.commit();
        return Number(result.affectedRows || 0) > 0;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function deleteReferencedJobsBySourceId(id) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [result] = await pool.query(
        `DELETE FROM ingestion_jobs WHERE source_id = ?${projectWhere}`,
        projectId ? [id, projectId] : [id]
      );
      return Number(result.affectedRows || 0);
    }
    module2.exports = {
      getDataSourceById,
      listDataSources,
      listReferencedTasks,
      createDataSource,
      updateDataSource,
      deleteDataSource,
      deleteReferencedJobsBySourceId
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

// backend/src/modules/file-imports/file-import.parser.js
var require_file_import_parser = __commonJS({
  "backend/src/modules/file-imports/file-import.parser.js"(exports2, module2) {
    var xlsx = require("xlsx");
    var iconv = require("iconv-lite");
    var xmlJs = require("xml-js");
    var DEFAULT_PREVIEW_LIMIT = 50;
    var FIELD_SAMPLE_LIMIT = 50;
    var PREVIEW_SAMPLE_ROW_LIMIT = 100;
    function decodeBuffer(buffer, encoding = "utf8") {
      const normalized = String(encoding || "utf8").trim().toLowerCase();
      if (normalized && normalized !== "utf8" && normalized !== "utf-8") {
        try {
          return iconv.decode(buffer, normalized);
        } catch (_error) {
        }
      }
      return Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer || "");
    }
    function detectFileType(fileName = "") {
      const matched = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
      return matched ? matched[1] : "";
    }
    function guessDelimiter(text = "") {
      const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 5);
      const candidates = [",", "	", "|", ";"];
      let best = ",";
      let bestScore = -1;
      for (const candidate of candidates) {
        const score = lines.reduce((total, line) => total + line.split(candidate).length - 1, 0);
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
      return best;
    }
    function forEachDelimitedLine(text, callback) {
      let lineStart = 0;
      let lineNumber = 0;
      for (let index = 0; index <= text.length; index += 1) {
        const atEnd = index === text.length;
        const char = atEnd ? "\n" : text[index];
        if (char !== "\n" && !atEnd) {
          continue;
        }
        const lineEnd = index > lineStart && text[index - 1] === "\r" ? index - 1 : index;
        const line = text.slice(lineStart, lineEnd);
        if (!(atEnd && line === "" && lineStart === text.length)) {
          callback(line, lineNumber);
          lineNumber += 1;
        }
        lineStart = index + 1;
      }
    }
    function parseDelimitedLine(line, delimiter = ",", quoteChar = '"') {
      const values = [];
      let current = "";
      let inQuotes = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === quoteChar && inQuotes && next === quoteChar) {
          current += quoteChar;
          index += 1;
          continue;
        }
        if (char === quoteChar) {
          inQuotes = !inQuotes;
          continue;
        }
        if (char === delimiter && !inQuotes) {
          values.push(current);
          current = "";
          continue;
        }
        current += char;
      }
      values.push(current);
      return {
        values,
        inQuotes
      };
    }
    function isEmptyValue(value) {
      return value === null || value === void 0 || String(value).trim() === "";
    }
    function normalizeHeader(value, index) {
      const text = String(value ?? "").trim();
      return text || `field_${index + 1}`;
    }
    function ensureUniqueHeaders(headers) {
      const seen = /* @__PURE__ */ new Map();
      return headers.map((item) => {
        const base = String(item || "").trim() || "field";
        const current = seen.get(base) || 0;
        seen.set(base, current + 1);
        return current === 0 ? base : `${base}_${current + 1}`;
      });
    }
    function normalizeScalarValue(value) {
      if (value === void 0) {
        return null;
      }
      if (value === null) {
        return null;
      }
      if (typeof value === "string") {
        return value.trim();
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return value;
      }
      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
      }
      if (typeof value === "object") {
        return JSON.stringify(value);
      }
      return String(value);
    }
    function matrixToStructuredRows(matrix, options = {}) {
      const headerRowNumber = Math.max(1, Number(options.headerRowNumber || 1));
      const fieldNameMode = String(options.fieldNameMode || "header").toLowerCase();
      const firstDataRowNumber = Math.max(
        1,
        Number(
          options.firstDataRowNumber || (fieldNameMode === "header" ? headerRowNumber + 1 : 1)
        )
      );
      const rows = Array.isArray(matrix) ? matrix : [];
      const width = rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
      const rawHeaders = fieldNameMode === "header" ? Array.from({ length: width }, (_, index) => normalizeHeader(rows[headerRowNumber - 1]?.[index], index)) : Array.from({ length: width }, (_, index) => `field_${index + 1}`);
      const headers = ensureUniqueHeaders(rawHeaders);
      const records = [];
      for (let rowIndex = firstDataRowNumber - 1; rowIndex < rows.length; rowIndex += 1) {
        const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
        const normalizedRow = headers.reduce((result, header, columnIndex) => {
          result[header] = normalizeScalarValue(row[columnIndex]);
          return result;
        }, {});
        const allEmpty = Object.values(normalizedRow).every((value) => isEmptyValue(value));
        if (allEmpty) {
          continue;
        }
        records.push({
          __rowNo: rowIndex + 1,
          ...normalizedRow
        });
      }
      return {
        headers,
        rows: records
      };
    }
    function objectRowsToStructuredRows(rows = []) {
      const headers = ensureUniqueHeaders(
        Array.from(
          rows.reduce((set, row) => {
            Object.keys(row || {}).forEach((key) => set.add(key));
            return set;
          }, /* @__PURE__ */ new Set())
        )
      );
      const records = rows.map((row, index) => headers.reduce((result, header) => {
        result[header] = normalizeScalarValue(row?.[header]);
        return result;
      }, { __rowNo: index + 1 })).filter((row) => Object.entries(row).some(([key, value]) => key !== "__rowNo" && !isEmptyValue(value)));
      return {
        headers,
        rows: records
      };
    }
    function inferValueType(value) {
      if (value === null || value === void 0 || value === "") {
        return "null";
      }
      if (typeof value === "boolean") {
        return "boolean";
      }
      if (typeof value === "number") {
        return Number.isInteger(value) ? "integer" : "decimal";
      }
      const text = String(value).trim();
      if (!text) {
        return "null";
      }
      if (/^(true|false)$/i.test(text)) {
        return "boolean";
      }
      if (/^-?\d+$/.test(text)) {
        return "integer";
      }
      if (/^-?\d+\.\d+$/.test(text)) {
        return "decimal";
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return "date";
      }
      if (/^\d{4}-\d{2}-\d{2}[ tT]\d{2}:\d{2}(:\d{2})?/.test(text)) {
        return "datetime";
      }
      if (text.startsWith("{") && text.endsWith("}") || text.startsWith("[") && text.endsWith("]")) {
        return "json";
      }
      return "string";
    }
    function mergeTypes(current, next) {
      if (!current || current === "null") {
        return next;
      }
      if (!next || next === "null" || current === next) {
        return current;
      }
      if (current === "integer" && next === "decimal" || current === "decimal" && next === "integer") {
        return "decimal";
      }
      if (current === "date" && next === "datetime" || current === "datetime" && next === "date") {
        return "datetime";
      }
      return "string";
    }
    function toSuggestedType(type, maxLength) {
      if (type === "boolean") return "boolean";
      if (type === "integer") return "bigint";
      if (type === "decimal") return "decimal(18,6)";
      if (type === "date") return "date";
      if (type === "datetime") return "datetime";
      if (type === "json") return maxLength > 2e3 ? "text" : "varchar(2000)";
      if (maxLength <= 64) return `varchar(${Math.max(32, maxLength || 32)})`;
      if (maxLength <= 255) return `varchar(${Math.max(64, maxLength)})`;
      return "text";
    }
    function buildSchema(headers, rows = []) {
      return headers.map((header) => {
        let mergedType = "null";
        let maxLength = 0;
        let nullable = false;
        const samples = [];
        const counts = {
          boolean: 0,
          integer: 0,
          decimal: 0,
          date: 0,
          datetime: 0,
          json: 0,
          string: 0
        };
        let nonNullCount = 0;
        rows.forEach((row) => {
          const value = row?.[header];
          const valueType = inferValueType(value);
          mergedType = mergeTypes(mergedType, valueType);
          if (valueType === "null") {
            nullable = true;
            return;
          }
          nonNullCount += 1;
          if (counts[valueType] !== void 0) {
            counts[valueType] += 1;
          } else {
            counts.string += 1;
          }
          const text = typeof value === "string" ? value : JSON.stringify(value);
          maxLength = Math.max(maxLength, String(text || "").length);
          if (samples.length < FIELD_SAMPLE_LIMIT) {
            samples.push(value);
          }
        });
        let resolvedType = mergedType === "null" ? "string" : mergedType;
        if (nonNullCount > 0) {
          const numericCount = counts.integer + counts.decimal;
          const dateTimeCount = counts.date + counts.datetime;
          if (counts.boolean / nonNullCount >= 0.7) {
            resolvedType = "boolean";
          } else if (numericCount / nonNullCount >= 0.6) {
            resolvedType = counts.decimal > 0 ? "decimal" : "integer";
          } else if (dateTimeCount / nonNullCount >= 0.6) {
            resolvedType = counts.datetime > 0 ? "datetime" : "date";
          } else if (counts.json / nonNullCount >= 0.6) {
            resolvedType = "json";
          } else if (counts.string > 0) {
            resolvedType = "string";
          }
        }
        return {
          sourceField: header,
          inferredType: resolvedType,
          suggestedType: toSuggestedType(resolvedType, maxLength),
          nullable: nullable || rows.length === 0,
          maxLength,
          sampleValues: samples
        };
      });
    }
    function resolveJsonRoot(payload, rootPath = "") {
      if (!rootPath) {
        if (Array.isArray(payload)) {
          return payload;
        }
        if (payload && typeof payload === "object") {
          const firstArray = Object.values(payload).find((item) => Array.isArray(item));
          if (Array.isArray(firstArray)) {
            return firstArray;
          }
        }
        return payload;
      }
      return String(rootPath).split(".").filter(Boolean).reduce((current, key) => current && typeof current === "object" ? current[key] : void 0, payload);
    }
    function getByPath(target, pathText = "") {
      return String(pathText).split(".").filter(Boolean).reduce((current, key) => {
        if (Array.isArray(current)) {
          const index = Number(key);
          return Number.isInteger(index) ? current[index] : void 0;
        }
        if (current && typeof current === "object") {
          return current[key];
        }
        return void 0;
      }, target);
    }
    function findFirstObjectArray(target, depth = 0) {
      if (depth > 6 || target === null || target === void 0) {
        return null;
      }
      if (Array.isArray(target) && target.some((item) => item && typeof item === "object")) {
        return target;
      }
      if (target && typeof target === "object") {
        for (const value of Object.values(target)) {
          const result = findFirstObjectArray(value, depth + 1);
          if (result) {
            return result;
          }
        }
      }
      return null;
    }
    function normalizeXmlNode(node) {
      if (node === null || node === void 0) {
        return null;
      }
      if (Array.isArray(node)) {
        return node.map((item) => normalizeXmlNode(item));
      }
      if (typeof node !== "object") {
        return node;
      }
      const result = {};
      Object.entries(node).forEach(([key, value]) => {
        if (key === "_text" || key === "_cdata") {
          result.value = value;
          return;
        }
        if (key === "_attributes" && value && typeof value === "object") {
          Object.entries(value).forEach(([attrKey, attrValue]) => {
            result[`@${attrKey}`] = attrValue;
          });
          return;
        }
        result[key] = normalizeXmlNode(value);
      });
      return result;
    }
    function normalizeXmlRow(row) {
      if (!row || typeof row !== "object") {
        return { value: normalizeScalarValue(row) };
      }
      return Object.entries(row).reduce((result, [key, value]) => {
        if (Array.isArray(value) || value && typeof value === "object") {
          if (value?.value !== void 0 && Object.keys(value).length === 1) {
            result[key] = normalizeScalarValue(value.value);
          } else {
            result[key] = normalizeScalarValue(value);
          }
          return result;
        }
        result[key] = normalizeScalarValue(value);
        return result;
      }, {});
    }
    function parseDelimitedBuffer(buffer, options = {}) {
      const text = decodeBuffer(buffer, options.encoding || "utf8");
      const delimiter = options.delimiter || guessDelimiter(text.slice(0, 1024 * 1024));
      const quoteChar = options.quoteChar || '"';
      if (options.previewOnly) {
        const firstDataRowNumber = Math.max(1, Number(options.firstDataRowNumber || 2));
        const sampleMatrix = [];
        const rowErrors2 = [];
        let totalRows = 0;
        forEachDelimitedLine(text, (line, index) => {
          const parsed = parseDelimitedLine(line, delimiter, quoteChar);
          if (parsed.inQuotes && rowErrors2.length < 100) {
            rowErrors2.push({
              rowNo: index + 1,
              errorType: "parse",
              errorMessage: "\u5F15\u53F7\u672A\u95ED\u5408",
              rawData: line.slice(0, 1e3)
            });
          }
          if (sampleMatrix.length < firstDataRowNumber - 1 + PREVIEW_SAMPLE_ROW_LIMIT) {
            sampleMatrix.push(parsed.values);
          }
          if (index >= firstDataRowNumber - 1 && parsed.values.some((value) => !isEmptyValue(value))) {
            totalRows += 1;
          }
        });
        const structured2 = matrixToStructuredRows(sampleMatrix, options);
        return {
          ...structured2,
          totalRows,
          rowErrors: rowErrors2,
          parseMeta: {
            delimiter,
            quoteChar,
            previewOnly: true
          }
        };
      }
      const rawLines = text.split(/\r?\n/);
      const matrix = [];
      const rowErrors = [];
      rawLines.forEach((line, index) => {
        if (!line && index === rawLines.length - 1) {
          return;
        }
        const parsed = parseDelimitedLine(line, delimiter, quoteChar);
        if (parsed.inQuotes) {
          rowErrors.push({
            rowNo: index + 1,
            errorType: "parse",
            errorMessage: "\u5F15\u53F7\u672A\u95ED\u5408",
            rawData: line
          });
        }
        matrix.push(parsed.values);
      });
      const structured = matrixToStructuredRows(matrix, options);
      return {
        ...structured,
        totalRows: structured.rows.length,
        rowErrors,
        parseMeta: {
          delimiter,
          quoteChar
        }
      };
    }
    function parseExcelBuffer(buffer, options = {}) {
      const workbook = xlsx.read(buffer, { type: "buffer" });
      const sheetNames = workbook.SheetNames || [];
      const selectedSheetName = options.sheetName && sheetNames.includes(options.sheetName) ? options.sheetName : sheetNames[0];
      const sheet = selectedSheetName ? workbook.Sheets[selectedSheetName] : null;
      const matrix = sheet ? xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) : [];
      const structured = matrixToStructuredRows(matrix, options);
      return {
        ...structured,
        rowErrors: [],
        parseMeta: {
          sheetNames,
          selectedSheetName
        }
      };
    }
    function parseJsonBuffer(buffer, options = {}) {
      const text = decodeBuffer(buffer, options.encoding || "utf8");
      const parsed = JSON.parse(text);
      const root = resolveJsonRoot(parsed, options.jsonRootPath || "");
      const rows = Array.isArray(root) ? root : [root];
      const normalizedRows = rows.filter((item) => item && typeof item === "object").map((item) => {
        const next = {};
        Object.entries(item).forEach(([key, value]) => {
          next[key] = normalizeScalarValue(value);
        });
        return next;
      });
      const structured = objectRowsToStructuredRows(normalizedRows);
      return {
        ...structured,
        rowErrors: [],
        parseMeta: {
          jsonRootPath: options.jsonRootPath || ""
        }
      };
    }
    function parseXmlBuffer(buffer, options = {}) {
      const text = decodeBuffer(buffer, options.encoding || "utf8");
      const parsed = xmlJs.xml2js(text, { compact: true, trim: true });
      const normalized = normalizeXmlNode(parsed);
      const resolved = options.xmlRowPath ? getByPath(normalized, options.xmlRowPath) : findFirstObjectArray(normalized);
      const rows = Array.isArray(resolved) ? resolved : resolved ? [resolved] : [];
      const normalizedRows = rows.map((item) => normalizeXmlRow(item));
      const structured = objectRowsToStructuredRows(normalizedRows);
      return {
        ...structured,
        rowErrors: [],
        parseMeta: {
          xmlRowPath: options.xmlRowPath || ""
        }
      };
    }
    function parseFileBuffer(file, options = {}) {
      const fileType = String(options.fileType || detectFileType(file?.originalname || file?.fileName || "")).toLowerCase();
      if (["csv", "txt"].includes(fileType)) {
        return {
          fileType,
          ...parseDelimitedBuffer(file.buffer, options)
        };
      }
      if (["xls", "xlsx"].includes(fileType)) {
        return {
          fileType,
          ...parseExcelBuffer(file.buffer, options)
        };
      }
      if (fileType === "json") {
        return {
          fileType,
          ...parseJsonBuffer(file.buffer, options)
        };
      }
      if (fileType === "xml") {
        return {
          fileType,
          ...parseXmlBuffer(file.buffer, options)
        };
      }
      throw new Error(`\u6682\u4E0D\u652F\u6301\u7684\u6587\u4EF6\u7C7B\u578B\uFF1A${fileType || "unknown"}`);
    }
    function buildPreviewResult(file, parseResult, options = {}) {
      const rows = parseResult.rows || [];
      const sampleRows = rows.slice(0, Number(options.previewLimit || DEFAULT_PREVIEW_LIMIT)).map((row) => {
        const next = { ...row };
        delete next.__rowNo;
        return next;
      });
      return {
        fileName: file.originalname || file.fileName,
        fileSize: Number(file.size || file.fileSize || 0),
        fileType: parseResult.fileType,
        availableSheets: parseResult.parseMeta?.sheetNames || [],
        selectedSheetName: parseResult.parseMeta?.selectedSheetName || options.sheetName || null,
        parseMeta: parseResult.parseMeta || {},
        totalRows: Number.isFinite(Number(parseResult.totalRows)) ? Number(parseResult.totalRows) : rows.length,
        sampleRows,
        rowErrors: parseResult.rowErrors || [],
        schema: buildSchema(parseResult.headers || [], rows)
      };
    }
    module2.exports = {
      buildPreviewResult,
      buildSchema,
      detectFileType,
      parseFileBuffer
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

// backend/src/modules/data-sources/data-source.preview.js
var require_data_source_preview = __commonJS({
  "backend/src/modules/data-sources/data-source.preview.js"(exports2, module2) {
    var path = require("path");
    var { Writable: Writable2 } = require("stream");
    var ftp = require("basic-ftp");
    var { Kafka, logLevel } = require("kafkajs");
    var pdfParse = require("pdf-parse");
    var mammoth = require("mammoth");
    var iconv = require("iconv-lite");
    var metadataService = require_data_source_metadata();
    var AppError = require_app_error();
    var { parseFileBuffer, buildPreviewResult, detectFileType } = require_file_import_parser();
    var { normalizeDatasourceType, inferDatasourceDialect } = require_datasource_dialect();
    var apiIngestionService = require_apiIngestionService();
    var STRUCTURED_FILE_TYPES = /* @__PURE__ */ new Set(["csv", "txt", "xls", "xlsx", "json", "xml"]);
    var DEFAULT_MAX_FILE_BYTES = 1024 * 1024;
    var FTP_PREVIEW_CACHE_TTL_MS = 15 * 1e3;
    var ftpPreviewCache = /* @__PURE__ */ new Map();
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
        maxPreviewBytes: Math.max(1024, Math.min(5 * 1024 * 1024, Number(config.maxPreviewBytes || DEFAULT_MAX_FILE_BYTES)))
      };
    }
    async function withFtpClient(dataSource, handler) {
      const config = getFtpConfig(dataSource);
      if (!config.host || !config.port || !config.user) {
        throw new AppError("FTP \u6570\u636E\u6E90\u7F3A\u5C11\u4E3B\u673A\u3001\u7AEF\u53E3\u6216\u7528\u6237\u540D", 400);
      }
      const maxAttempts = 5;
      let lastError = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const client = new ftp.Client(1e4);
        client.ftp.verbose = false;
        try {
          await connectFtpClient(client, config);
          return await handler(client, config);
        } catch (error) {
          lastError = error;
          if (attempt >= maxAttempts || !isTransientFtpError(error)) {
            throw error;
          }
          await sleep(Math.min(4e3, 700 * 2 ** (attempt - 1)));
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
      return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT"].includes(code) || message.includes("control socket") || message.includes("socket");
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
                  tableComment: entry.modifiedAt ? `\u76EE\u5F55 / ${entry.modifiedAt.toISOString()}` : "\u76EE\u5F55",
                  objectType: "directory",
                  fileSize: 0,
                  modifiedAt: entry.modifiedAt ? entry.modifiedAt.toISOString() : null
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
              modifiedAt: entry.modifiedAt ? entry.modifiedAt.toISOString() : null
            });
          }
        }
        await visit("", 0);
        return result.sort((left, right) => String(left.tableName).localeCompare(String(right.tableName)));
      });
    }
    function collectWritable(chunks) {
      return new Writable2({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          callback();
        }
      });
    }
    async function downloadFtpFile(dataSource, filePath) {
      return withFtpClient(dataSource, async (client, config) => {
        const normalizedFilePath = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
        if (!normalizedFilePath || normalizedFilePath.split("/").some((part) => part === "..")) {
          throw new AppError("FTP \u6587\u4EF6\u4E0D\u5B58\u5728\u6216\u4E0D\u5728\u6839\u76EE\u5F55\u8303\u56F4\u5185", 404);
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
            throw new AppError("FTP \u6587\u4EF6\u4E0D\u5B58\u5728\u6216\u4E0D\u5728\u6839\u76EE\u5F55\u8303\u56F4\u5185", 404);
          }
        }
        if (fileSize > config.maxPreviewBytes) {
          throw new AppError(`\u6587\u4EF6\u8D85\u8FC7\u9884\u89C8\u5927\u5C0F\u9650\u5236 ${config.maxPreviewBytes} \u5B57\u8282`, 400);
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
            modifiedAt
          },
          config,
          buffer: Buffer.concat(chunks)
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
        iconv.decode(buffer, "gbk")
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
          buffer
        };
        const parseResult = parseFileBuffer(pseudoFile, {
          ...parseOptions,
          fileType,
          previewLimit: limit,
          encoding: parseOptions.encoding || config.encoding
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
            columnComment: ""
          })),
          rows: preview.sampleRows,
          contentText: "",
          parseMeta: preview
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
      const promise = parseFtpFile(dataSource, filePath, safeLimit).then((parsed) => {
        ftpPreviewCache.set(cacheKey, {
          expiresAt: Date.now() + FTP_PREVIEW_CACHE_TTL_MS,
          promise: Promise.resolve(parsed)
        });
        trimFtpPreviewCache();
        return parsed;
      }).catch((error) => {
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
        limit
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
        { columnName: "lineNo", ordinalPosition: 1, dataType: "integer", columnType: "integer", isNullable: false, isPrimaryKey: false, columnComment: "\u884C\u53F7" },
        { columnName: "content", ordinalPosition: 2, dataType: "text", columnType: "text", isNullable: true, isPrimaryKey: false, columnComment: "\u5185\u5BB9" }
      ];
    }
    function buildDocumentRows(text = "", limit = 20) {
      return String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, Math.max(1, Math.min(100, Number(limit || 20)))).map((content, index) => ({ lineNo: index + 1, content: content.length > 500 ? `${content.slice(0, 500)}...` : content }));
    }
    function getKafkaConfig(dataSource) {
      const config = dataSource?.connectionConfig || {};
      const bootstrapServers = String(config.bootstrapServers || config.bootstrapServer || `${config.host || ""}${config.port ? `:${config.port}` : ""}`).split(",").map((item) => item.trim()).filter(Boolean);
      return {
        bootstrapServers,
        clientId: String(config.clientId || "medata-ingestion-preview").trim(),
        topicPattern: String(config.topicPattern || "").trim(),
        fromBeginning: Boolean(config.fromBeginning)
      };
    }
    function createKafka(dataSource) {
      const config = getKafkaConfig(dataSource);
      if (!config.bootstrapServers.length) {
        throw new AppError("Kafka \u6570\u636E\u6E90\u7F3A\u5C11 bootstrapServers", 400);
      }
      return new Kafka({
        clientId: config.clientId,
        brokers: config.bootstrapServers,
        logLevel: logLevel.NOTHING,
        retry: { retries: 2 },
        connectionTimeout: 8e3,
        requestTimeout: 1e4
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
        const topics = (await admin.listTopics()).filter((topic) => !topic.startsWith("__")).filter((topic) => !config.topicPattern || topic.includes(config.topicPattern));
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
            partitionCount: partitions.length
          };
        });
      });
    }
    async function getKafkaTopicColumns(dataSource, topicName) {
      return withKafkaAdmin(dataSource, async (admin) => {
        const metadata = await admin.fetchTopicMetadata({ topics: [topicName] });
        const topic = (metadata.topics || []).find((item) => item.name === topicName);
        if (!topic) throw new AppError("Kafka Topic \u4E0D\u5B58\u5728", 404);
        const rows = await sampleKafkaMessages(dataSource, topicName, 20).catch(() => []);
        const businessColumns = inferKafkaBusinessColumns(rows);
        const metadataColumns = [
          { columnName: "_kafka_topic", dataType: "string", columnType: "string", isNullable: false, isPrimaryKey: false, columnComment: "Kafka Topic" },
          { columnName: "_kafka_partition", dataType: "integer", columnType: "integer", isNullable: false, isPrimaryKey: false, columnComment: "Kafka \u5206\u533A" },
          { columnName: "_kafka_offset", dataType: "string", columnType: "string", isNullable: false, isPrimaryKey: false, columnComment: "Kafka \u504F\u79FB\u91CF" },
          { columnName: "_kafka_timestamp", dataType: "string", columnType: "string", isNullable: true, isPrimaryKey: false, columnComment: "Kafka \u6D88\u606F\u65F6\u95F4" },
          { columnName: "_kafka_key", dataType: "string", columnType: "string", isNullable: true, isPrimaryKey: false, columnComment: "Kafka \u6D88\u606F Key" },
          { columnName: "_raw_value", dataType: "text", columnType: "text", isNullable: true, isPrimaryKey: false, columnComment: "\u539F\u59CB\u6D88\u606F\u5185\u5BB9" }
        ];
        return [...businessColumns, ...metadataColumns].map((column, index) => ({
          ...column,
          ordinalPosition: index + 1
        }));
      });
    }
    function inferKafkaBusinessColumns(rows = []) {
      const fields = /* @__PURE__ */ new Map();
      for (const row of rows) {
        const text = String(row?.value || "").trim();
        if (!text || !text.startsWith("{") && !text.startsWith("[")) continue;
        try {
          const parsed = JSON.parse(text);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
            if (!item || typeof item !== "object" || Array.isArray(item)) continue;
            Object.entries(flattenObject(item)).forEach(([key, value]) => {
              const current = fields.get(key) || { values: [], nullable: false };
              if (value === null || value === void 0 || value === "") current.nullable = true;
              if (current.values.length < 20) current.values.push(value);
              fields.set(key, current);
            });
          }
        } catch (_error) {
        }
      }
      return [...fields.entries()].map(([columnName, meta]) => ({
        columnName,
        dataType: inferSampleType(meta.values),
        columnType: inferSampleType(meta.values),
        isNullable: meta.nullable,
        isPrimaryKey: false,
        columnComment: ""
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
    async function sampleKafkaMessages(dataSource, topicName, limit = 20, options = {}) {
      const kafka = createKafka(dataSource);
      const consumer = kafka.consumer({ groupId: `medata-preview-${Date.now()}-${Math.round(Math.random() * 1e4)}` });
      const rows = [];
      const safeLimit = Math.max(1, Math.min(100, Number(limit || 20)));
      const config = getKafkaConfig(dataSource);
      const fromBeginning = options.fromBeginning !== void 0 ? Boolean(options.fromBeginning) : config.fromBeginning;
      const maxWaitMs = Math.max(1e3, Math.min(12e4, Number(options.maxWaitMs || 6e3)));
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
                rawValue
              });
              if (rows.length >= safeLimit) {
                clearTimeout(timer);
                resolve();
              }
            }
          }).catch((error) => {
            clearTimeout(timer);
            reject(error);
          });
        });
        return rows.slice(0, safeLimit);
      } finally {
        await consumer.disconnect().catch(() => {
        });
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
          _raw_value: rawValue
        };
        if (format !== "json") {
          return [{ value: rawValue, ...metadata }];
        }
        try {
          const parsed = JSON.parse(rawValue);
          const resolved = resolveJsonPath(parsed, parseConfig.jsonRootPath || "");
          const items = Array.isArray(resolved) ? resolved : [resolved];
          return items.filter((item) => item && typeof item === "object").map((item) => ({ ...flattenObject(item), ...metadata }));
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
      return parts.reduce((current, part) => current && typeof current === "object" ? current[part] : void 0, value);
    }
    function formatKafkaValue(value) {
      if (!value) return "";
      const text = value.toString("utf8");
      try {
        return JSON.stringify(JSON.parse(text), null, 2);
      } catch (_error) {
        return text.length > 1e3 ? `${text.slice(0, 1e3)}...` : text;
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
          objectType: "api"
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
      const match = files.find(
        (item) => String(item.objectType || "").toLowerCase() !== "directory" && String(item.tableName || "").startsWith(normalized ? `${normalized.replace(/\/+$/, "")}/` : "")
      );
      if (!match) {
        throw new AppError("FTP \u76EE\u5F55\u4E0B\u6CA1\u6709\u53EF\u9884\u89C8\u7684\u6587\u4EF6", 404);
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
          maxWaitMs: sourceConfig.maxWaitMs
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
          limit: safeLimit
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
        return (!normalizedDir || tableName.startsWith(`${normalizedDir}/`)) && matchFilePattern(tableName, sourceConfig.filePattern, sourceConfig.excludePattern);
      });
      if (!matched) {
        throw new AppError("FTP \u76EE\u5F55\u4E0B\u6CA1\u6709\u5339\u914D\u5F53\u524D\u6765\u6E90\u914D\u7F6E\u7684\u6587\u4EF6", 404);
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
        sampleRows(dataSource, objectName, options.sampleSize || 50)
      ]);
      return {
        tableName: objectName,
        tableComment: isFtpSource(dataSource) ? "FTP \u6587\u4EF6" : isKafkaSource(dataSource) ? "Kafka Topic" : "API \u63A5\u53E3",
        columns,
        indexes: [],
        constraints: [],
        sampleRows: rows
      };
    }
    module2.exports = {
      listObjects,
      listColumns,
      sampleRows,
      sampleRowsWithOptions,
      inspectObjectProfile,
      isFtpSource,
      isKafkaSource,
      isApiSource,
      getKafkaConfig
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

// backend/src/modules/ingestion-ai-configs/ingestion-ai-config.repository.js
var require_ingestion_ai_config_repository = __commonJS({
  "backend/src/modules/ingestion-ai-configs/ingestion-ai-config.repository.js"(exports2, module2) {
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
     FROM ingestion_ai_configs c
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
     FROM ingestion_ai_configs c
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
     FROM ingestion_ai_configs
     WHERE scene_code = ?
     LIMIT 1`,
        [sceneCode]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    }
    async function createConfig(payload) {
      const [result] = await pool.query(
        `INSERT INTO ingestion_ai_configs
     (scene_name, scene_code, default_model_provider_id, default_model_name, default_model_version, temperature, max_tokens, timeout_ms, system_prompt, description, owner_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          payload.status
        ]
      );
      return getConfigById(result.insertId);
    }
    async function updateConfig(id, payload) {
      const [result] = await pool.query(
        `UPDATE ingestion_ai_configs
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
    async function deleteConfig(id) {
      const [result] = await pool.query("DELETE FROM ingestion_ai_configs WHERE id = ?", [id]);
      return result.affectedRows > 0;
    }
    module2.exports = {
      listConfigs,
      getConfigById,
      getConfigByCode,
      createConfig,
      updateConfig,
      deleteConfig
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

// backend/src/modules/ingestion-ai-configs/ingestion-ai-config.service.js
var require_ingestion_ai_config_service = __commonJS({
  "backend/src/modules/ingestion-ai-configs/ingestion-ai-config.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var repository = require_ingestion_ai_config_repository();
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
        throw new AppError("AI \u573A\u666F\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
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
        throw new AppError("AI \u573A\u666F\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
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

// backend/src/modules/data-source-research/data-source-research.repository.js
var require_data_source_research_repository = __commonJS({
  "backend/src/modules/data-source-research/data-source-research.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var { getCurrentProjectId } = require_project_context();
    function parseJson(value, fallback) {
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
    function mapRun(row) {
      if (!row) {
        return null;
      }
      return {
        ...row,
        taskId: row.taskId === null || row.taskId === void 0 ? null : Number(row.taskId),
        runNo: row.runNo === null || row.runNo === void 0 ? null : Number(row.runNo),
        sourceId: Number(row.sourceId),
        progressPercent: Number(row.progressPercent || 0),
        config: parseJson(row.configJson, {}),
        selectedTables: parseJson(row.selectedTablesJson, []),
        report: parseJson(row.reportJson, null)
      };
    }
    function mapTask(row) {
      if (!row) {
        return null;
      }
      return {
        ...row,
        id: Number(row.id),
        sourceId: Number(row.sourceId),
        lastRunId: row.lastRunId === null || row.lastRunId === void 0 ? null : Number(row.lastRunId),
        config: parseJson(row.configJson, {}),
        selectedTables: parseJson(row.selectedTablesJson, [])
      };
    }
    function mapLog(row) {
      return {
        ...row,
        runId: Number(row.runId),
        detail: parseJson(row.detailJson, null)
      };
    }
    function mapComparison(row) {
      if (!row) {
        return null;
      }
      return {
        ...row,
        id: Number(row.id),
        taskId: Number(row.taskId),
        baseRunId: Number(row.baseRunId),
        targetRunId: Number(row.targetRunId),
        diff: parseJson(row.diffJson, null),
        aiSummary: parseJson(row.aiSummaryJson, null)
      };
    }
    async function createTask(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO data_source_research_tasks
     (project_id, task_name, source_id, source_name, source_type, database_name, schema_name, table_scope,
      config_json, selected_tables_json, status, description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.taskName,
          payload.sourceId,
          payload.sourceName,
          payload.sourceType,
          payload.databaseName || null,
          payload.schemaName || null,
          payload.tableScope,
          JSON.stringify(payload.config || {}),
          JSON.stringify(payload.selectedTables || []),
          payload.status || "active",
          payload.description || null,
          payload.createdBy || "system"
        ]
      );
      return getTaskById(result.insertId);
    }
    async function getTaskById(id) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [rows] = await pool.query(
        `SELECT id, task_name AS taskName, source_id AS sourceId, source_name AS sourceName, source_type AS sourceType,
            database_name AS databaseName, schema_name AS schemaName, table_scope AS tableScope,
            config_json AS configJson, selected_tables_json AS selectedTablesJson, status,
            last_run_id AS lastRunId, last_run_status AS lastRunStatus, last_run_at AS lastRunAt,
            description, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM data_source_research_tasks
     WHERE id = ?${projectWhere}
     LIMIT 1`,
        projectId ? [id, projectId] : [id]
      );
      return rows[0] ? mapTask(rows[0]) : null;
    }
    async function listTasks(filters = {}) {
      const where = [];
      const params = [];
      const projectId = getCurrentProjectId();
      if (projectId) {
        where.push("project_id = ?");
        params.push(projectId);
      }
      if (filters.sourceId) {
        where.push("source_id = ?");
        params.push(Number(filters.sourceId));
      }
      if (filters.status) {
        where.push("status = ?");
        params.push(filters.status);
      }
      if (filters.keyword) {
        where.push("(task_name LIKE ? OR source_name LIKE ? OR description LIKE ?)");
        const keyword = `%${filters.keyword}%`;
        params.push(keyword, keyword, keyword);
      }
      const [rows] = await pool.query(
        `SELECT id, task_name AS taskName, source_id AS sourceId, source_name AS sourceName, source_type AS sourceType,
            database_name AS databaseName, schema_name AS schemaName, table_scope AS tableScope,
            config_json AS configJson, selected_tables_json AS selectedTablesJson, status,
            last_run_id AS lastRunId, last_run_status AS lastRunStatus, last_run_at AS lastRunAt,
            description, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM data_source_research_tasks
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY updated_at DESC, id DESC`,
        params
      );
      return rows.map(mapTask);
    }
    async function updateTask(id, patch) {
      const fields = [];
      const params = [];
      const mapping = {
        taskName: "task_name",
        sourceId: "source_id",
        sourceName: "source_name",
        sourceType: "source_type",
        databaseName: "database_name",
        schemaName: "schema_name",
        tableScope: "table_scope",
        status: "status",
        lastRunId: "last_run_id",
        lastRunStatus: "last_run_status",
        lastRunAt: "last_run_at",
        description: "description"
      };
      Object.entries(mapping).forEach(([key, column]) => {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          fields.push(`${column} = ?`);
          params.push(patch[key]);
        }
      });
      if (Object.prototype.hasOwnProperty.call(patch, "config")) {
        fields.push("config_json = ?");
        params.push(JSON.stringify(patch.config || {}));
      }
      if (Object.prototype.hasOwnProperty.call(patch, "selectedTables")) {
        fields.push("selected_tables_json = ?");
        params.push(JSON.stringify(patch.selectedTables || []));
      }
      if (!fields.length) {
        return getTaskById(id);
      }
      params.push(id);
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      if (projectId) {
        params.push(projectId);
      }
      await pool.query(
        `UPDATE data_source_research_tasks
     SET ${fields.join(", ")}
     WHERE id = ?${projectWhere}`,
        params
      );
      return getTaskById(id);
    }
    async function deleteTask(id) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const params = projectId ? [id, projectId] : [id];
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `DELETE FROM data_source_research_runs WHERE task_id = ?${projectWhere}`,
          params
        );
        const [result] = await connection.query(
          `DELETE FROM data_source_research_tasks WHERE id = ?${projectWhere}`,
          params
        );
        await connection.commit();
        return Number(result.affectedRows || 0) > 0;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function getNextRunNoByTaskId(taskId) {
      const [rows] = await pool.query(
        "SELECT COALESCE(MAX(run_no), 0) + 1 AS nextRunNo FROM data_source_research_runs WHERE task_id = ?",
        [taskId]
      );
      return Number(rows[0]?.nextRunNo || 1);
    }
    async function createRun(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO data_source_research_runs
     (project_id, task_id, run_no, source_id, run_name, source_name, source_type, database_name, schema_name, table_scope,
      config_json, selected_tables_json, status, progress_percent, current_stage, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.taskId || null,
          payload.runNo || null,
          payload.sourceId,
          payload.runName,
          payload.sourceName,
          payload.sourceType,
          payload.databaseName || null,
          payload.schemaName || null,
          payload.tableScope,
          JSON.stringify(payload.config || {}),
          JSON.stringify(payload.selectedTables || []),
          payload.status || "pending",
          Number(payload.progressPercent || 0),
          payload.currentStage || null,
          payload.createdBy || "system"
        ]
      );
      return getRunById(result.insertId);
    }
    async function getRunById(id) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, run_no AS runNo, source_id AS sourceId, run_name AS runName, source_name AS sourceName, source_type AS sourceType,
            database_name AS databaseName, schema_name AS schemaName, table_scope AS tableScope,
            config_json AS configJson, selected_tables_json AS selectedTablesJson, status,
            progress_percent AS progressPercent, current_stage AS currentStage, report_json AS reportJson,
            summary_text AS summaryText, error_message AS errorMessage, created_by AS createdBy,
            started_at AS startedAt, finished_at AS finishedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM data_source_research_runs
     WHERE id = ?${projectWhere}
     LIMIT 1`,
        projectId ? [id, projectId] : [id]
      );
      return rows[0] ? mapRun(rows[0]) : null;
    }
    async function listRunsBySourceId(sourceId) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, run_no AS runNo, source_id AS sourceId, run_name AS runName, source_name AS sourceName, source_type AS sourceType,
            database_name AS databaseName, schema_name AS schemaName, table_scope AS tableScope,
            config_json AS configJson, selected_tables_json AS selectedTablesJson, status,
            progress_percent AS progressPercent, current_stage AS currentStage,
            summary_text AS summaryText, error_message AS errorMessage, created_by AS createdBy,
            started_at AS startedAt, finished_at AS finishedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM data_source_research_runs
     WHERE source_id = ?${projectWhere}
     ORDER BY created_at DESC, id DESC`,
        projectId ? [sourceId, projectId] : [sourceId]
      );
      return rows.map(mapRun);
    }
    async function listRunsByTaskId(taskId) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, run_no AS runNo, source_id AS sourceId, run_name AS runName, source_name AS sourceName, source_type AS sourceType,
            database_name AS databaseName, schema_name AS schemaName, table_scope AS tableScope,
            config_json AS configJson, selected_tables_json AS selectedTablesJson, status,
            progress_percent AS progressPercent, current_stage AS currentStage,
            summary_text AS summaryText, error_message AS errorMessage, created_by AS createdBy,
            started_at AS startedAt, finished_at AS finishedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM data_source_research_runs
     WHERE task_id = ?${projectWhere}
     ORDER BY created_at DESC, id DESC`,
        projectId ? [taskId, projectId] : [taskId]
      );
      return rows.map(mapRun);
    }
    async function hasActiveRunsByTaskId(taskId) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [rows] = await pool.query(
        `SELECT id
     FROM data_source_research_runs
     WHERE task_id = ?${projectWhere}
       AND status IN ('pending', 'running')
     LIMIT 1`,
        projectId ? [taskId, projectId] : [taskId]
      );
      return rows.length > 0;
    }
    async function updateRun(id, patch) {
      const fields = [];
      const params = [];
      const mapping = {
        runName: "run_name",
        status: "status",
        progressPercent: "progress_percent",
        currentStage: "current_stage",
        summaryText: "summary_text",
        errorMessage: "error_message",
        startedAt: "started_at",
        finishedAt: "finished_at"
      };
      Object.entries(mapping).forEach(([key, column]) => {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          fields.push(`${column} = ?`);
          params.push(patch[key]);
        }
      });
      if (Object.prototype.hasOwnProperty.call(patch, "report")) {
        fields.push("report_json = ?");
        params.push(patch.report ? JSON.stringify(patch.report) : null);
      }
      if (Object.prototype.hasOwnProperty.call(patch, "config")) {
        fields.push("config_json = ?");
        params.push(JSON.stringify(patch.config || {}));
      }
      if (Object.prototype.hasOwnProperty.call(patch, "selectedTables")) {
        fields.push("selected_tables_json = ?");
        params.push(JSON.stringify(patch.selectedTables || []));
      }
      if (!fields.length) {
        return getRunById(id);
      }
      params.push(id);
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      if (projectId) {
        params.push(projectId);
      }
      await pool.query(
        `UPDATE data_source_research_runs
     SET ${fields.join(", ")}
     WHERE id = ?${projectWhere}`,
        params
      );
      return getRunById(id);
    }
    async function appendLog(runId, payload) {
      await pool.query(
        `INSERT INTO data_source_research_logs
     (run_id, stage_key, log_level, message, detail_json)
     VALUES (?, ?, ?, ?, ?)`,
        [
          runId,
          payload.stageKey,
          payload.logLevel || "info",
          payload.message,
          payload.detail ? JSON.stringify(payload.detail) : null
        ]
      );
    }
    async function listLogs(runId) {
      const [rows] = await pool.query(
        `SELECT id, run_id AS runId, stage_key AS stageKey, log_level AS logLevel, message,
            detail_json AS detailJson, created_at AS createdAt
     FROM data_source_research_logs
     WHERE run_id = ?
     ORDER BY id ASC`,
        [runId]
      );
      return rows.map(mapLog);
    }
    async function replaceTableProfiles(runId, tableProfiles = []) {
      await pool.query("DELETE FROM data_source_research_field_profiles WHERE run_id = ?", [runId]);
      await pool.query("DELETE FROM data_source_research_table_profiles WHERE run_id = ?", [runId]);
      for (const profile of tableProfiles) {
        await pool.query(
          `INSERT INTO data_source_research_table_profiles
       (run_id, table_name, table_comment, row_count_mode, row_count, column_count, sample_count,
        category, priority, confidence, suggested_mode, incremental_column,
        metadata_issues_json, evidence_json, risks_json, quality_json, field_summary_json,
        indexes_count, constraints_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            runId,
            profile.tableName,
            profile.tableComment || null,
            profile.rowCountMode || "estimated",
            profile.rowCount ?? null,
            Number(profile.columnCount || 0),
            Number(profile.sampleCount || 0),
            profile.category || null,
            profile.priority || null,
            profile.confidence ?? null,
            profile.suggestedMode || null,
            profile.incrementalColumn || null,
            JSON.stringify(profile.metadataIssues || []),
            JSON.stringify(profile.evidence || []),
            JSON.stringify(profile.risks || []),
            JSON.stringify(profile.quality || {}),
            JSON.stringify(profile.fieldSummary || {}),
            Number(profile.indexes || 0),
            Number(profile.constraints || 0)
          ]
        );
        for (const field of profile.fieldProfiles || []) {
          await pool.query(
            `INSERT INTO data_source_research_field_profiles
         (run_id, table_name, column_name, ordinal_position, data_type, column_type, is_nullable, is_primary_key,
          column_comment, null_rate, distinct_ratio, sample_values_json, issue_tags_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              runId,
              profile.tableName,
              field.columnName,
              Number(field.ordinalPosition || 0),
              field.dataType || null,
              field.columnType || null,
              field.isNullable ? 1 : 0,
              field.isPrimaryKey ? 1 : 0,
              field.columnComment || null,
              field.nullRate ?? null,
              field.distinctRatio ?? null,
              JSON.stringify(field.sampleValues || []),
              JSON.stringify(field.issueTags || [])
            ]
          );
        }
      }
    }
    async function replaceAiBatches(runId, batches = []) {
      await pool.query("DELETE FROM data_source_research_ai_batches WHERE run_id = ?", [runId]);
      for (const batch of batches) {
        await pool.query(
          `INSERT INTO data_source_research_ai_batches
       (run_id, stage_key, batch_no, batch_size, status, input_summary_json, output_json, error_message, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            runId,
            batch.stageKey,
            Number(batch.batchNo || 1),
            Number(batch.batchSize || 0),
            batch.status || "pending",
            JSON.stringify(batch.inputSummary || {}),
            batch.output ? JSON.stringify(batch.output) : null,
            batch.errorMessage || null,
            batch.durationMs ?? null
          ]
        );
      }
    }
    async function reconcileLatestRunningResearchRunsAfterRestart() {
      const [rows] = await pool.query(
        `SELECT id
     FROM data_source_research_runs
     WHERE status IN ('pending', 'running')`
      );
      for (const row of rows) {
        await updateRun(row.id, {
          status: "failed",
          progressPercent: 100,
          currentStage: "failed",
          errorMessage: "\u670D\u52A1\u91CD\u542F\u6216\u4EFB\u52A1\u6267\u884C\u7EBF\u7A0B\u5F02\u5E38\u4E2D\u65AD\uFF0C\u7CFB\u7EDF\u5DF2\u5C06\u8BE5\u8C03\u7814\u4EFB\u52A1\u81EA\u52A8\u4FEE\u6B63\u4E3A\u5931\u8D25\u72B6\u6001\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77\u8C03\u7814\u3002",
          finishedAt: /* @__PURE__ */ new Date()
        });
      }
      return rows.length;
    }
    async function deleteRun(id) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [result] = await pool.query(
        `DELETE FROM data_source_research_runs WHERE id = ?${projectWhere}`,
        projectId ? [id, projectId] : [id]
      );
      return Number(result.affectedRows || 0) > 0;
    }
    async function createComparison(payload) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO data_source_research_report_comparisons
     (project_id, task_id, base_run_id, target_run_id, status, diff_json, ai_summary_json, summary_text, error_message, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.taskId,
          payload.baseRunId,
          payload.targetRunId,
          payload.status || "pending",
          payload.diff ? JSON.stringify(payload.diff) : null,
          payload.aiSummary ? JSON.stringify(payload.aiSummary) : null,
          payload.summaryText || null,
          payload.errorMessage || null,
          payload.createdBy || "system"
        ]
      );
      return getComparisonById(result.insertId);
    }
    async function updateComparison(id, patch) {
      const fields = [];
      const params = [];
      const mapping = {
        status: "status",
        summaryText: "summary_text",
        errorMessage: "error_message"
      };
      Object.entries(mapping).forEach(([key, column]) => {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          fields.push(`${column} = ?`);
          params.push(patch[key]);
        }
      });
      if (Object.prototype.hasOwnProperty.call(patch, "diff")) {
        fields.push("diff_json = ?");
        params.push(patch.diff ? JSON.stringify(patch.diff) : null);
      }
      if (Object.prototype.hasOwnProperty.call(patch, "aiSummary")) {
        fields.push("ai_summary_json = ?");
        params.push(patch.aiSummary ? JSON.stringify(patch.aiSummary) : null);
      }
      if (!fields.length) {
        return getComparisonById(id);
      }
      params.push(id);
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      if (projectId) {
        params.push(projectId);
      }
      await pool.query(
        `UPDATE data_source_research_report_comparisons
     SET ${fields.join(", ")}
     WHERE id = ?${projectWhere}`,
        params
      );
      return getComparisonById(id);
    }
    async function getComparisonById(id) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, base_run_id AS baseRunId, target_run_id AS targetRunId,
            status, diff_json AS diffJson, ai_summary_json AS aiSummaryJson,
            summary_text AS summaryText, error_message AS errorMessage, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM data_source_research_report_comparisons
     WHERE id = ?${projectWhere}
     LIMIT 1`,
        projectId ? [id, projectId] : [id]
      );
      return rows[0] ? mapComparison(rows[0]) : null;
    }
    async function listComparisonsByTaskId(taskId) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, base_run_id AS baseRunId, target_run_id AS targetRunId,
            status, diff_json AS diffJson, ai_summary_json AS aiSummaryJson,
            summary_text AS summaryText, error_message AS errorMessage, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM data_source_research_report_comparisons
     WHERE task_id = ?${projectWhere}
     ORDER BY id DESC`,
        projectId ? [taskId, projectId] : [taskId]
      );
      return rows.map(mapComparison);
    }
    module2.exports = {
      createTask,
      getTaskById,
      listTasks,
      updateTask,
      deleteTask,
      getNextRunNoByTaskId,
      createRun,
      getRunById,
      listRunsBySourceId,
      listRunsByTaskId,
      hasActiveRunsByTaskId,
      updateRun,
      appendLog,
      listLogs,
      replaceTableProfiles,
      replaceAiBatches,
      reconcileLatestRunningResearchRunsAfterRestart,
      deleteRun,
      createComparison,
      updateComparison,
      getComparisonById,
      listComparisonsByTaskId
    };
  }
});

// backend/src/modules/data-source-research/data-source-research.service.js
var require_data_source_research_service = __commonJS({
  "backend/src/modules/data-source-research/data-source-research.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var {
      AlignmentType,
      BorderStyle,
      Document,
      HeadingLevel,
      ImageRun,
      PageOrientation,
      Packer,
      Paragraph,
      Table,
      TableCell,
      TableLayoutType,
      TableRow,
      TextRun,
      WidthType
    } = require("docx");
    var dataSourceRepository = require_data_source_repository();
    var metadataService = require_data_source_metadata();
    var previewService = require_data_source_preview();
    var { testDatabaseConnection } = require_data_source_test_connection();
    var ingestionAiConfigService = require_ingestion_ai_config_service();
    var modelProviderService = require_model_provider_service();
    var repository = require_data_source_research_repository();
    var {
      inferDatasourceDialect,
      normalizeDatasourceType
    } = require_datasource_dialect();
    var SUPPORTED_RESEARCH_SOURCE_TYPES = /* @__PURE__ */ new Set(["mysql", "postgresql", "oracle", "dm", "hive", "ftp", "kafka"]);
    var RESEARCH_ITEM_ALIASES = {
      metadata_inspection: "quality_inspection"
    };
    var TABLE_CLASSIFICATION_PROMPT = `
\u4F60\u662F\u8D44\u6DF1\u6570\u636E\u63A5\u5165\u67B6\u6784\u5E08\u3002\u4F60\u4F1A\u6536\u5230\u4E00\u6279\u7ECF\u8FC7\u89C4\u5219\u5F15\u64CE\u538B\u7F29\u540E\u7684\u8868\u8BC1\u636E\u5361\u3002
\u4F60\u53EA\u8D1F\u8D23\u201C\u8868\u5206\u7C7B\u201D\u8C03\u7814\uFF0C\u5224\u65AD\u6BCF\u5F20\u8868\u7684\u4E1A\u52A1\u89D2\u8272\u3001\u63A5\u5165\u4F18\u5148\u7EA7\u3001\u5206\u7C7B\u8BC1\u636E\u548C\u98CE\u9669\u3002

\u8981\u6C42\uFF1A
1. \u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002
2. \u8BC1\u636E\u5361\u5DF2\u7ECF\u8986\u76D6\u6240\u6709\u5B57\u6BB5\u7684\u7EDF\u8BA1\u6458\u8981\uFF0C\u4E0D\u8981\u5047\u8BBE\u53EA\u5206\u6790\u4E86\u90E8\u5206\u5B57\u6BB5\u3002
3. \u5206\u7C7B\u5FC5\u987B\u4ECE business\u3001dictionary\u3001relation\u3001log\u3001temporary\u3001low_value \u4E2D\u9009\u62E9\u3002
4. \u5982\u679C\u65E0\u6CD5\u786E\u5B9A\uFF0C\u4FDD\u6301\u4FDD\u5B88\u5206\u7C7B\u5E76\u8BF4\u660E\u4F9D\u636E\uFF0C\u4E0D\u8981\u7F16\u9020\u8F93\u5165\u4E2D\u4E0D\u5B58\u5728\u7684\u4E1A\u52A1\u80CC\u666F\u3002

\u8F93\u51FA\u7ED3\u6784\u56FA\u5B9A\u4E3A\uFF1A
{
  "summary": "\u8868\u5206\u7C7B\u603B\u4F53\u7ED3\u8BBA",
  "tableDecisions": [
    {
      "tableName": "\u8868\u540D",
      "category": "business|dictionary|relation|log|temporary|low_value",
      "confidence": 0.82,
      "priority": "high|medium|low",
      "evidence": ["\u5224\u65AD\u4F9D\u636E"],
      "risks": ["\u98CE\u9669\u63D0\u793A"],
      "suggestedMode": "full|incremental|partition|manual_review"
    }
  ]
}`.trim();
    var REPORT_AGGREGATION_PROMPT = `
\u4F60\u662F\u8D44\u6DF1\u6570\u636E\u63A5\u5165\u8D1F\u8D23\u4EBA\u3002\u4F60\u4F1A\u6536\u5230\u591A\u6279\u8868\u5206\u7C7B\u7ED3\u679C\u548C\u89C4\u5219\u753B\u50CF\u3002
\u4F60\u53EA\u8D1F\u8D23\u201C\u8C03\u7814\u62A5\u544A\u6C47\u603B\u201D\uFF0C\u63D0\u70BC\u6574\u4F53\u7ED3\u8BBA\u3001\u4F18\u5148\u7EA7\u548C\u540E\u7EED\u63A5\u5165/\u6CBB\u7406\u7684\u5F52\u7EB3\uFF0C\u4E0D\u91CD\u65B0\u7F16\u9020\u8868\u5206\u7C7B\u3002

\u8981\u6C42\uFF1A
1. \u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002
2. \u8F93\u51FA\u9762\u5411\u6570\u636E\u63A5\u5165\u8D1F\u8D23\u4EBA\uFF0C\u7ED3\u8BBA\u8981\u660E\u786E\u3001\u53EF\u6267\u884C\u3002
3. \u4E0D\u8981\u91CD\u590D\u679A\u4E3E\u6240\u6709\u8868\uFF0C\u53EA\u4FDD\u7559\u5173\u952E\u8868\u548C\u9AD8\u4EF7\u503C\u98CE\u9669\u3002

\u8F93\u51FA\u7ED3\u6784\u56FA\u5B9A\u4E3A\uFF1A
{
  "summary": "\u603B\u4F53\u7ED3\u8BBA",
  "tableDecisions": [],
  "recommendedTables": ["\u5EFA\u8BAE\u4F18\u5148\u63A5\u5165\u8868"],
  "deferredTables": ["\u5EFA\u8BAE\u6682\u7F13\u8868"],
  "governanceSuggestions": ["\u6CBB\u7406\u5EFA\u8BAE"],
  "ingestionSuggestions": ["\u63A5\u5165\u5EFA\u8BAE"]
}`.trim();
    var DATA_SCALE_PROMPT = `
\u4F60\u662F\u6570\u636E\u5BB9\u91CF\u8BC4\u4F30\u4E13\u5BB6\u3002\u4F60\u53EA\u8D1F\u8D23\u201C\u6570\u636E\u89C4\u6A21\u201D\u8C03\u7814\u3002
\u8BF7\u57FA\u4E8E\u8868\u884C\u6570\u3001\u5B57\u6BB5\u6570\u3001\u6837\u672C\u6570\u3001\u7D22\u5F15\u7EA6\u675F\u6570\u91CF\u548C\u884C\u6570\u7EDF\u8BA1\u7B56\u7565\uFF0C\u8BC6\u522B\u5927\u8868\u3001\u7A7A\u8868/\u5C0F\u8868\u3001\u7ED3\u6784\u590D\u6742\u8868\u548C\u5BB9\u91CF\u98CE\u9669\u3002

\u8981\u6C42\uFF1A
1. \u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002
2. \u4E0D\u8981\u4FEE\u6539\u8868\u5206\u7C7B\uFF0C\u53EA\u7ED9\u89C4\u6A21\u5C42\u9762\u7684\u5224\u65AD\u3002
3. \u7ED3\u8BBA\u8981\u80FD\u652F\u6491\u63A5\u5165\u8D44\u6E90\u8BC4\u4F30\u548C\u540C\u6B65\u7A97\u53E3\u89C4\u5212\u3002

\u8F93\u51FA\u7ED3\u6784\u56FA\u5B9A\u4E3A\uFF1A
{
  "summary": "\u89C4\u6A21\u8C03\u7814\u7ED3\u8BBA",
  "largeTables": ["\u5927\u8868"],
  "smallOrEmptyTables": ["\u5C0F\u8868\u6216\u7A7A\u8868"],
  "complexTables": ["\u5B57\u6BB5\u6216\u7EA6\u675F\u8F83\u590D\u6742\u7684\u8868"],
  "suggestions": ["\u5BB9\u91CF\u3001\u5E76\u53D1\u3001\u540C\u6B65\u7A97\u53E3\u5EFA\u8BAE"]
}`.trim();
    var DATA_QUALITY_PROMPT = `
\u4F60\u662F\u6570\u636E\u8D28\u91CF\u548C\u5143\u6570\u636E\u6CBB\u7406\u4E13\u5BB6\u3002\u4F60\u53EA\u8D1F\u8D23\u201C\u6570\u636E\u8D28\u91CF\u201D\u8C03\u7814\u3002
\u8BF7\u5408\u5E76\u5206\u6790\u5B57\u6BB5\u7A7A\u503C\u7387\u3001\u53BB\u91CD\u7387\u3001\u6837\u4F8B\u503C\u3001\u5B57\u6BB5\u6CE8\u91CA\u3001\u8868\u6CE8\u91CA\u3001\u4E3B\u952E\u3001\u589E\u91CF\u5B57\u6BB5\u548C\u5143\u6570\u636E\u95EE\u9898\u3002

\u8981\u6C42\uFF1A
1. \u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002
2. \u95EE\u9898\u7C7B\u578B\u5FC5\u987B\u4F7F\u7528\u4E2D\u6587\uFF0C\u4F8B\u5982\u201C\u5B57\u6BB5\u6CE8\u91CA\u7F3A\u5931\u201D\u201C\u9AD8\u7A7A\u503C\u7387\u201D\u201C\u4F4E\u57FA\u6570\u5B57\u6BB5\u201D\u201C\u9AD8\u57FA\u6570\u5B57\u6BB5\u201D\u201C\u7F3A\u5C11\u4E3B\u952E\u201D\u201C\u7F3A\u5C11\u589E\u91CF\u5B57\u6BB5\u201D\u3002
3. \u5B57\u6BB5\u7EA7\u53D1\u73B0\u5FC5\u987B\u5E26 tableName\u3001columnName\u3001issueTypes\u3001evidence\u3001suggestion\u3002
4. \u4E0D\u8981\u8F93\u51FA\u65E0\u8BC1\u636E\u7684\u8D28\u91CF\u95EE\u9898\u3002

\u8F93\u51FA\u7ED3\u6784\u56FA\u5B9A\u4E3A\uFF1A
{
  "summary": "\u6570\u636E\u8D28\u91CF\u7ED3\u8BBA",
  "issueTypeStats": [{"issueType": "\u4E2D\u6587\u95EE\u9898\u7C7B\u578B", "count": 3}],
  "tableFindings": [{"tableName": "\u8868\u540D", "issueTypes": ["\u4E2D\u6587\u95EE\u9898\u7C7B\u578B"], "evidence": ["\u8BC1\u636E"], "suggestion": "\u5EFA\u8BAE"}],
  "fieldFindings": [{"tableName": "\u8868\u540D", "columnName": "\u5B57\u6BB5\u540D", "issueTypes": ["\u4E2D\u6587\u95EE\u9898\u7C7B\u578B"], "evidence": ["\u8BC1\u636E"], "suggestion": "\u5EFA\u8BAE"}],
  "suggestions": ["\u8D28\u91CF\u6574\u6539\u5EFA\u8BAE"]
}`.trim();
    var INGESTION_ADVICE_PROMPT = `
\u4F60\u662F\u6570\u636E\u63A5\u5165\u65B9\u6848\u67B6\u6784\u5E08\u3002\u4F60\u53EA\u8D1F\u8D23\u201C\u63A5\u5165\u5EFA\u8BAE\u201D\u8C03\u7814\u3002
\u8BF7\u57FA\u4E8E\u8868\u5206\u7C7B\u3001\u6570\u636E\u89C4\u6A21\u3001\u589E\u91CF\u5B57\u6BB5\u3001\u8D28\u91CF\u98CE\u9669\u548C\u4F9D\u8D56\u5173\u7CFB\uFF0C\u7ED9\u51FA\u9996\u6279\u63A5\u5165\u8868\u3001\u6682\u7F13\u8868\u3001\u540C\u6B65\u6A21\u5F0F\u548C\u4EFB\u52A1\u7F16\u6392\u5EFA\u8BAE\u3002

\u8981\u6C42\uFF1A
1. \u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002
2. \u5EFA\u8BAE\u5FC5\u987B\u80FD\u76F4\u63A5\u6307\u5BFC\u63A5\u5165\u4EFB\u52A1\u914D\u7F6E\u3002
3. \u5BF9\u6BCF\u5F20\u5EFA\u8BAE\u63A5\u5165\u8868\u8BF4\u660E\u63A5\u5165\u6A21\u5F0F\u3001\u4F9D\u8D56\u548C\u98CE\u9669\u3002

\u8F93\u51FA\u7ED3\u6784\u56FA\u5B9A\u4E3A\uFF1A
{
  "summary": "\u63A5\u5165\u5EFA\u8BAE\u7ED3\u8BBA",
  "recommendedTables": ["\u4F18\u5148\u63A5\u5165\u8868"],
  "deferredTables": ["\u5EFA\u8BAE\u6682\u7F13\u8868"],
  "tableModes": [{"tableName": "\u8868\u540D", "mode": "full|incremental|partition|manual_review", "reason": "\u539F\u56E0", "risk": "\u98CE\u9669"}],
  "ingestionSuggestions": ["\u540C\u6B65\u7B56\u7565\u3001\u4EFB\u52A1\u62C6\u5206\u3001\u843D\u5E93\u5EFA\u8BAE"]
}`.trim();
    var GOVERNANCE_ADVICE_PROMPT = `
\u4F60\u662F\u6570\u636E\u6CBB\u7406\u987E\u95EE\u3002\u4F60\u53EA\u8D1F\u8D23\u201C\u6CBB\u7406\u5EFA\u8BAE\u201D\u8C03\u7814\u3002
\u8BF7\u57FA\u4E8E\u5143\u6570\u636E\u7F3A\u5931\u3001\u5B57\u6BB5\u8D28\u91CF\u3001\u4E3B\u952E/\u589E\u91CF\u5B57\u6BB5\u7F3A\u5931\u3001\u5173\u7CFB\u53EF\u4FE1\u5EA6\u548C\u5206\u7C7B\u98CE\u9669\uFF0C\u8F93\u51FA\u6CBB\u7406\u4F18\u5148\u7EA7\u548C\u6574\u6539\u52A8\u4F5C\u3002

\u8981\u6C42\uFF1A
1. \u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002
2. \u6CBB\u7406\u5EFA\u8BAE\u8981\u533A\u5206\u201C\u63A5\u5165\u524D\u5FC5\u987B\u5904\u7406\u201D\u548C\u201C\u63A5\u5165\u540E\u53EF\u6301\u7EED\u4F18\u5316\u201D\u3002
3. \u95EE\u9898\u7C7B\u578B\u5FC5\u987B\u4F7F\u7528\u4E2D\u6587\u3002

\u8F93\u51FA\u7ED3\u6784\u56FA\u5B9A\u4E3A\uFF1A
{
  "summary": "\u6CBB\u7406\u5EFA\u8BAE\u7ED3\u8BBA",
  "mustFixBeforeIngestion": ["\u63A5\u5165\u524D\u5FC5\u987B\u5904\u7406"],
  "continuousImprovements": ["\u63A5\u5165\u540E\u6301\u7EED\u4F18\u5316"],
  "tableTasks": [{"tableName": "\u8868\u540D", "issueTypes": ["\u4E2D\u6587\u95EE\u9898\u7C7B\u578B"], "priority": "high|medium|low", "action": "\u6CBB\u7406\u52A8\u4F5C"}],
  "governanceSuggestions": ["\u6CBB\u7406\u5EFA\u8BAE"]
}`.trim();
    var ANALYSIS_ADVICE_PROMPT = `
\u4F60\u662F\u6570\u636E\u5206\u6790\u987E\u95EE\u3002\u4F60\u53EA\u8D1F\u8D23\u201C\u5206\u6790\u5EFA\u8BAE\u201D\u8C03\u7814\u3002
\u8BF7\u57FA\u4E8E\u8868\u5206\u7C7B\u3001\u6570\u636E\u89C4\u6A21\u3001\u5B57\u6BB5\u8BED\u4E49\u3001\u8D28\u91CF\u98CE\u9669\u548C\u8868\u5173\u7CFB\uFF0C\u4F18\u5148\u56F4\u7ED5\u6838\u5FC3\u4E1A\u52A1\u8868\u5224\u65AD\u53EF\u4EE5\u652F\u6301\u54EA\u4E9B\u4E1A\u52A1\u5206\u6790\u3001\u62A5\u8868\u4E3B\u9898\u548C\u540E\u7EED\u63A2\u7D22\u95EE\u9898\u3002

\u8981\u6C42\uFF1A
1. \u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002
2. \u5148\u8BC6\u522B\u6838\u5FC3\u4E1A\u52A1\u8868\uFF0C\u5B57\u5178\u8868\u53EA\u80FD\u4F5C\u4E3A\u7EF4\u5EA6\u89E3\u91CA\u6216\u7F16\u7801\u7FFB\u8BD1\uFF0C\u4E0D\u8981\u628A\u5B57\u5178\u8868\u5F53\u6210\u4E1A\u52A1\u5206\u6790\u4E3B\u8868\u3002
3. \u5FC5\u987B\u7ED3\u5408\u5B57\u6BB5\u6837\u4F8B\u503C\u3001\u5B57\u6BB5\u6CE8\u91CA\u3001\u7A7A\u503C\u7387\u3001\u53BB\u91CD\u7387\u548C\u8868\u5173\u7CFB\uFF0C\u63A8\u65AD\u53EF\u7528\u7EF4\u5EA6\u3001\u53EF\u89C2\u5BDF\u72B6\u6001\u3001\u53EF\u80FD\u7684\u6307\u6807\u53E3\u5F84\u548C\u5F02\u5E38\u8BC6\u522B\u65B9\u5411\u3002
4. \u5206\u6790\u5EFA\u8BAE\u5FC5\u987B\u843D\u5230\u4E1A\u52A1\u5206\u6790\u4E3B\u9898\u3001\u6838\u5FC3\u4E1A\u52A1\u8868\u3001\u5173\u8054\u7EF4\u8868\u3001\u5173\u952E\u5B57\u6BB5\u3001\u6837\u4F8B\u8BC1\u636E\u3001\u5206\u6790\u4EF7\u503C\u548C\u9700\u8981\u786E\u8BA4\u7684\u6570\u636E\u53E3\u5F84\u3002
5. \u4E0D\u8981\u7F16\u9020\u5B57\u6BB5\u548C\u6837\u4F8B\u4E2D\u6CA1\u6709\u4F53\u73B0\u7684\u4E1A\u52A1\u6307\u6807\u3002

\u8F93\u51FA\u7ED3\u6784\u56FA\u5B9A\u4E3A\uFF1A
{
  "summary": "\u5206\u6790\u5EFA\u8BAE\u7ED3\u8BBA",
  "coreBusinessTables": [{"tableName": "\u6838\u5FC3\u4E1A\u52A1\u8868", "reason": "\u9009\u62E9\u4F9D\u636E", "analysisValue": "\u4E1A\u52A1\u5206\u6790\u4EF7\u503C", "suggestedSubjects": ["\u53EF\u505A\u7684\u4E1A\u52A1\u5206\u6790"], "dimensions": ["\u53EF\u7528\u7EF4\u5EA6\u6216\u5173\u952E\u5B57\u6BB5"]}],
  "analysisDirections": [{"direction": "\u5206\u6790\u65B9\u5411", "coreTable": "\u6838\u5FC3\u4E1A\u52A1\u8868", "relatedTables": ["\u5173\u8054\u8868"], "measures": ["\u5EFA\u8BAE\u6307\u6807"], "dimensions": ["\u5206\u6790\u7EF4\u5EA6"], "sampleEvidence": ["\u6837\u4F8B\u8BC1\u636E"], "analysisQuestions": ["\u53EF\u56DE\u7B54\u7684\u4E1A\u52A1\u95EE\u9898"], "outputSuggestions": ["\u62A5\u8868\u6216\u770B\u677F\u5EFA\u8BAE"], "caveats": ["\u53E3\u5F84\u9650\u5236"]}],
  "analysisThemes": [{"theme": "\u5206\u6790\u4E3B\u9898", "tables": ["\u8868\u540D"], "keyFields": ["\u5B57\u6BB5\u540D"], "value": "\u5206\u6790\u4EF7\u503C", "limitations": ["\u9650\u5236"]}],
  "watchItems": ["\u9700\u8981\u6301\u7EED\u5173\u6CE8\u7684\u6570\u636E\u53D8\u5316"],
  "followUpQuestions": ["\u9700\u8981\u4E1A\u52A1\u786E\u8BA4\u7684\u95EE\u9898"],
  "analysisSuggestions": ["\u5206\u6790\u5EFA\u8BAE"]
}`.trim();
    var TABLE_RELATIONSHIP_PROMPT = `
\u4F60\u662F\u8D44\u6DF1\u6570\u636E\u5EFA\u6A21\u4E13\u5BB6\u3002\u4F60\u4F1A\u6536\u5230\u7528\u6237\u672C\u6B21\u9009\u5B9A\u8868\u53CA\u7CFB\u7EDF\u81EA\u52A8\u8865\u5145\u7684\u5173\u8054\u8868\u7ED3\u6784\u6458\u8981\u548C\u89C4\u5219\u5019\u9009\u5173\u7CFB\u3002
\u8BF7\u53EA\u57FA\u4E8E\u8F93\u5165\u4E2D\u7684\u8868\u5206\u6790\u7A33\u5B9A\u5173\u8054\u5173\u7CFB\uFF0C\u4E0D\u8981\u8865\u5145\u8F93\u5165\u4E2D\u4E0D\u5B58\u5728\u7684\u8868\u3002

\u8981\u6C42\uFF1A
1. \u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002
2. \u4F18\u5148\u4FDD\u7559\u663E\u5F0F\u5916\u952E\u548C\u9AD8\u7F6E\u4FE1\u547D\u540D\u89C4\u5219\u5173\u7CFB\uFF1B\u5BF9\u4E0D\u786E\u5B9A\u5173\u7CFB\u4FDD\u6301\u4FDD\u5B88\u3002
3. \u5173\u7CFB\u65B9\u5411\u4F7F\u7528 fromTable/fromField \u6307\u5411 toTable/toField\uFF0C\u5176\u4E2D from \u4FA7\u901A\u5E38\u662F\u5916\u952E\u6216\u5F15\u7528\u5B57\u6BB5\uFF0Cto \u4FA7\u901A\u5E38\u662F\u4E3B\u952E\u3001\u7F16\u7801\u6216\u4E1A\u52A1\u552F\u4E00\u5B57\u6BB5\u3002

\u8F93\u51FA\u7ED3\u6784\u56FA\u5B9A\u4E3A\uFF1A
{
  "summary": "\u8868\u5173\u7CFB\u603B\u4F53\u7ED3\u8BBA",
  "relations": [
    {
      "fromTable": "\u5F15\u7528\u65B9\u8868",
      "fromField": "\u5F15\u7528\u65B9\u5B57\u6BB5",
      "toTable": "\u88AB\u5F15\u7528\u8868",
      "toField": "\u88AB\u5F15\u7528\u5B57\u6BB5",
      "relationType": "1:1|1:N|N:1|N:N",
      "confidence": 0.86,
      "source": "constraint|name_rule|ai",
      "fromFieldRole": "FOREIGN_KEY|REFERENCE",
      "toFieldRole": "PRIMARY_KEY|UNIQUE_KEY|BUSINESS_KEY",
      "evidence": ["\u5224\u65AD\u4F9D\u636E"]
    }
  ]
}`.trim();
    var REPORT_COMPARISON_PROMPT = `
\u4F60\u662F\u8D44\u6DF1\u6570\u636E\u6CBB\u7406\u987E\u95EE\u3002\u4F60\u4F1A\u6536\u5230\u540C\u4E00\u4E2A\u6570\u636E\u6E90\u8C03\u7814\u4EFB\u52A1\u7684\u4E24\u4E2A\u62A5\u544A\u6279\u6B21\u7ED3\u6784\u5316\u5DEE\u5F02\u3002
\u8BF7\u8BC6\u522B\u6570\u636E\u8D28\u91CF\u3001\u8868\u7ED3\u6784\u3001\u5B57\u6BB5\u8D28\u91CF\u548C\u8868\u5173\u7CFB\u7684\u5173\u952E\u53D8\u5316\uFF0C\u8F93\u51FA\u7ED9\u6570\u636E\u63A5\u5165\u8D1F\u8D23\u4EBA\u53EF\u76F4\u63A5\u4F7F\u7528\u7684\u7ED3\u8BBA\u3002

\u8981\u6C42\uFF1A
1. \u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002
2. \u4E0D\u8981\u91CD\u590D\u679A\u4E3E\u5168\u90E8\u660E\u7EC6\uFF0C\u53EA\u63D0\u70BC\u9AD8\u4EF7\u503C\u53D8\u5316\u3001\u98CE\u9669\u548C\u5EFA\u8BAE\u3002
3. \u9700\u8981\u533A\u5206\u53D8\u597D\u3001\u53D8\u5DEE\u548C\u9700\u8981\u4EBA\u5DE5\u786E\u8BA4\u7684\u53D8\u5316\u3002

\u8F93\u51FA\u7ED3\u6784\u56FA\u5B9A\u4E3A\uFF1A
{
  "summary": "\u603B\u4F53\u53D8\u5316\u7ED3\u8BBA",
  "tableClassificationChanges": ["\u8868\u5206\u7C7B\u53D8\u5316"],
  "tableRelationshipChanges": ["\u8868\u5173\u7CFB\u53D8\u5316"],
  "dataScaleChanges": ["\u6570\u636E\u89C4\u6A21\u53D8\u5316"],
  "dataQualityChanges": ["\u6570\u636E\u8D28\u91CF\u53D8\u5316"],
  "ingestionAdviceChanges": ["\u63A5\u5165\u5EFA\u8BAE\u53D8\u5316"],
  "governanceAdviceChanges": ["\u6CBB\u7406\u5EFA\u8BAE\u53D8\u5316"],
  "analysisAdviceChanges": ["\u5206\u6790\u5EFA\u8BAE\u53D8\u5316"],
  "risks": ["\u98CE\u9669"],
  "suggestions": ["\u5EFA\u8BAE"],
  "confidence": 0.86
}`.trim();
    var TRANSPARENT_PNG_BUFFER = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    );
    var activeResearchRuns = /* @__PURE__ */ new Map();
    function createResearchRunCancelledError() {
      const error = new Error("\u8C03\u7814\u4EFB\u52A1\u5DF2\u624B\u52A8\u7EC8\u6B62");
      error.code = "RESEARCH_RUN_CANCELLED";
      return error;
    }
    function isResearchRunCancelledError(error) {
      return error?.code === "RESEARCH_RUN_CANCELLED" || error?.name === "AbortError";
    }
    function getActiveResearchRun(runId) {
      return activeResearchRuns.get(Number(runId)) || null;
    }
    function isResearchRunCancellationRequested(runId) {
      return Boolean(getActiveResearchRun(runId)?.cancelRequested);
    }
    function assertResearchRunNotCancelled(runId) {
      if (isResearchRunCancellationRequested(runId)) {
        throw createResearchRunCancelledError();
      }
    }
    function registerActiveResearchRun(runId) {
      const state = {
        controller: new AbortController(),
        cancelRequested: false
      };
      activeResearchRuns.set(Number(runId), state);
      return state;
    }
    function unregisterActiveResearchRun(runId) {
      activeResearchRuns.delete(Number(runId));
    }
    function normalizeSourceType(sourceType, connectionConfig = {}) {
      const normalized = normalizeDatasourceType(sourceType);
      const dialect = inferDatasourceDialect(normalized, connectionConfig || {});
      return dialect === "unknown" ? normalized : dialect;
    }
    function supportsResearch(dataSource) {
      return SUPPORTED_RESEARCH_SOURCE_TYPES.has(normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig || {}));
    }
    function isObjectPreviewSource(dataSource) {
      return ["ftp", "kafka"].includes(normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig || {}));
    }
    function researchObjectLabel(dataSource) {
      const type = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig || {});
      if (type === "ftp") return "\u6587\u4EF6";
      if (type === "kafka") return "Topic";
      return "\u8868";
    }
    function buildRunName(dataSource) {
      const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
      return `${dataSource.sourceName} \u6570\u636E\u6E90\u8C03\u7814 ${stamp}`;
    }
    function uniqueStrings(values = []) {
      return Array.from(new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean)));
    }
    function hasResearchItem(config, key) {
      return Array.isArray(config?.researchItems) && config.researchItems.includes(key);
    }
    function normalizeResearchItems(items = []) {
      const supported = /* @__PURE__ */ new Set([
        "table_classification",
        "table_relationship",
        "data_scale",
        "quality_inspection",
        "ingestion_advice",
        "governance_advice",
        "analysis_advice"
      ]);
      return uniqueStrings(items.map((item) => RESEARCH_ITEM_ALIASES[item] || item)).filter((item) => supported.has(item));
    }
    function pickDatabaseName(dataSource) {
      return String(dataSource?.connectionConfig?.database || "").trim() || null;
    }
    function pickSchemaName(dataSource) {
      return String(dataSource?.connectionConfig?.schema || "").trim() || null;
    }
    function chunkArray(items, size) {
      const chunks = [];
      const safeSize = Math.max(1, Number(size || 1));
      for (let index = 0; index < items.length; index += safeSize) {
        chunks.push(items.slice(index, index + safeSize));
      }
      return chunks;
    }
    async function runWithConcurrency(items, concurrency, worker) {
      const results = new Array(items.length);
      let cursor = 0;
      const safeConcurrency = Math.max(1, Number(concurrency || 1));
      async function consume() {
        while (cursor < items.length) {
          const currentIndex = cursor;
          cursor += 1;
          results[currentIndex] = await worker(items[currentIndex], currentIndex);
        }
      }
      await Promise.all(Array.from({ length: Math.min(safeConcurrency, items.length) }, () => consume()));
      return results;
    }
    function detectIncrementalColumn(columns = []) {
      const names = ["updated_at", "update_time", "modified_at", "modify_time", "last_update_time", "etl_time", "batch_time", "created_at", "create_time", "id"];
      const normalizedMap = new Map(columns.map((column) => [String(column.columnName || "").trim().toLowerCase(), column.columnName]));
      for (const name of names) {
        if (normalizedMap.has(name)) return normalizedMap.get(name);
      }
      return null;
    }
    function detectLowValueByName(tableName) {
      return /(tmp|temp|bak|backup|test|demo|copy|old|history_tmp|_tmp$|_bak$)/i.test(String(tableName || ""));
    }
    function detectLogTable(tableName, tableComment) {
      return /(log|logs|history|audit|trace|message|event|journal)/i.test(`${tableName} ${tableComment || ""}`);
    }
    function detectRelationTable(tableName, columns = []) {
      if (/(relation|mapping|map|bridge|link|xref)/i.test(String(tableName || ""))) {
        return true;
      }
      const idColumns = columns.filter((column) => /_id$/i.test(String(column.columnName || "")));
      return columns.length > 0 && columns.length <= 10 && idColumns.length >= 2;
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
      } catch (error) {
        return JSON.parse(extractJsonObject(text));
      }
    }
    async function resolveResearchProvider(aiConfig) {
      const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
      if (!provider) {
        throw new AppError("\u6570\u636E\u6E90\u8C03\u7814\u6A21\u578B\u4E0D\u5B58\u5728", 400);
      }
      return modelProviderService.applyModelSelection(provider, {
        modelName: aiConfig.defaultModelName,
        modelVersion: aiConfig.defaultModelVersion
      });
    }
    async function log(runId, stageKey, message, options = {}) {
      await repository.appendLog(runId, {
        stageKey,
        logLevel: options.logLevel || "info",
        message,
        detail: options.detail || null
      });
    }
    async function setRunState(runId, patch, logPayload) {
      const run = await repository.updateRun(runId, patch);
      if (logPayload?.message) {
        await log(runId, logPayload.stageKey || patch.currentStage || "run", logPayload.message, logPayload);
      }
      return run;
    }
    async function markResearchRunCancelled(runId, message = "\u8C03\u7814\u4EFB\u52A1\u5DF2\u624B\u52A8\u7EC8\u6B62") {
      const current = await repository.getRunById(runId);
      if (!current) return null;
      if (!["pending", "running"].includes(String(current.status || ""))) {
        return current;
      }
      const cancelledRun = await setRunState(runId, {
        status: "cancelled",
        progressPercent: 100,
        currentStage: "cancelled",
        errorMessage: message,
        finishedAt: /* @__PURE__ */ new Date()
      }, {
        stageKey: "cancelled",
        message,
        logLevel: "warn"
      });
      if (current.taskId) {
        await repository.updateTask(current.taskId, {
          lastRunId: runId,
          lastRunStatus: cancelledRun.status,
          lastRunAt: cancelledRun.finishedAt || /* @__PURE__ */ new Date()
        });
      }
      return cancelledRun;
    }
    function computeSampleMetrics(sampleRows = [], columns = []) {
      const sampleCount = sampleRows.length;
      const nullRates = {};
      let highNullColumns = 0;
      for (const column of columns) {
        const columnName = column.columnName;
        const nullCount = sampleRows.reduce((sum, row) => {
          const value = row?.[columnName];
          return sum + (value === null || value === void 0 || value === "" ? 1 : 0);
        }, 0);
        const nullRate = sampleCount > 0 ? Number((nullCount / sampleCount).toFixed(6)) : 0;
        nullRates[columnName] = nullRate;
        if (nullRate >= 0.8) {
          highNullColumns += 1;
        }
      }
      return {
        sampleCount,
        nullRates,
        highNullColumns
      };
    }
    function buildFieldProfiles(columns = [], sampleRows = []) {
      const sampleCount = sampleRows.length;
      return columns.map((column) => {
        const values = sampleRows.map((row) => row?.[column.columnName]).filter((value) => value !== null && value !== void 0 && value !== "");
        const distinctValues = new Set(values.map((value) => String(value)));
        const nullCount = sampleRows.length - values.length;
        const nullRate = sampleCount > 0 ? Number((nullCount / sampleCount).toFixed(6)) : 0;
        const distinctRatio = values.length > 0 ? Number((distinctValues.size / values.length).toFixed(6)) : 0;
        const examples = Array.from(distinctValues).slice(0, 5);
        const issueTags = [];
        if (!String(column.columnComment || "").trim()) issueTags.push("\u5B57\u6BB5\u6CE8\u91CA\u7F3A\u5931");
        if (nullRate >= 0.8) issueTags.push("\u9AD8\u7A7A\u503C\u7387");
        if (distinctRatio <= 0.1 && examples.length > 0 && examples.length <= 10) issueTags.push("\u4F4E\u57FA\u6570\u5B57\u6BB5");
        if (distinctRatio >= 0.95 && values.length >= 10) issueTags.push("\u9AD8\u57FA\u6570\u5B57\u6BB5");
        return {
          columnName: column.columnName,
          ordinalPosition: Number(column.ordinalPosition || 0),
          dataType: column.dataType,
          columnType: column.columnType,
          isNullable: Boolean(column.isNullable),
          isPrimaryKey: Boolean(column.isPrimaryKey),
          columnComment: column.columnComment || "",
          nullRate,
          distinctRatio,
          sampleValues: examples,
          issueTags
        };
      });
    }
    function buildFieldSummary(fieldProfiles = []) {
      const primaryKeys = [];
      const timeFields = [];
      const codeLikeFields = [];
      const statusLikeFields = [];
      const typeLikeFields = [];
      const nameLikeFields = [];
      const highNullFields = [];
      const highCardinalityFields = [];
      const lowCardinalityFields = [];
      let missingCommentCount = 0;
      const dataTypeDistribution = {};
      for (const field of fieldProfiles) {
        const columnName = String(field.columnName || "");
        const lowerName = columnName.toLowerCase();
        const dataType = String(field.dataType || "").toLowerCase() || "unknown";
        dataTypeDistribution[dataType] = Number(dataTypeDistribution[dataType] || 0) + 1;
        if (field.isPrimaryKey) primaryKeys.push(columnName);
        if (/(time|date|timestamp|created_at|updated_at|create_time|update_time)/i.test(lowerName) || /(date|time|timestamp)/i.test(dataType)) timeFields.push(columnName);
        if (/(code|no|num|number|id)$/i.test(lowerName)) codeLikeFields.push(columnName);
        if (/(status|state|flag|result)/i.test(lowerName)) statusLikeFields.push(columnName);
        if (/(type|kind|category|level|grade)/i.test(lowerName)) typeLikeFields.push(columnName);
        if (/(name|title|label|desc|remark|comment)/i.test(lowerName)) nameLikeFields.push(columnName);
        if (!String(field.columnComment || "").trim()) missingCommentCount += 1;
        if (field.nullRate >= 0.8) highNullFields.push(columnName);
        if (field.distinctRatio >= 0.95) highCardinalityFields.push(columnName);
        if (field.distinctRatio <= 0.1 && field.sampleValues?.length) lowCardinalityFields.push(columnName);
      }
      return {
        totalFields: fieldProfiles.length,
        primaryKeys,
        timeFields,
        codeLikeFields,
        statusLikeFields,
        typeLikeFields,
        nameLikeFields,
        missingCommentCount,
        highNullFields,
        highCardinalityFields,
        lowCardinalityFields,
        dataTypeDistribution
      };
    }
    function detectDictionaryTable(tableName, tableComment, columns = [], fieldSummary = null) {
      const combined = `${tableName} ${tableComment || ""}`.toLowerCase();
      if (/(dict|dictionary|lookup|enum|code|type|status|level|category|dim)/i.test(combined) || /字典|枚举|代码|状态|分类/.test(tableComment || "")) {
        return true;
      }
      const codeLikeFields = fieldSummary?.codeLikeFields || [];
      const statusLikeFields = fieldSummary?.statusLikeFields || [];
      const nameLikeFields = fieldSummary?.nameLikeFields || [];
      return columns.length > 0 && columns.length <= 12 && codeLikeFields.length + statusLikeFields.length > 0 && nameLikeFields.length > 0;
    }
    function buildMetadataIssues(profile, fieldSummary, metrics) {
      const issues = [];
      const columns = Array.isArray(profile.columns) ? profile.columns : [];
      const primaryKeyCount = columns.filter((column) => column.isPrimaryKey).length;
      if (!profile.tableComment) issues.push("\u7F3A\u5C11\u8868\u6CE8\u91CA");
      if (primaryKeyCount === 0) issues.push("\u7F3A\u5C11\u4E3B\u952E");
      if (fieldSummary.missingCommentCount > 0) issues.push(`\u5B57\u6BB5\u6CE8\u91CA\u7F3A\u5931 ${fieldSummary.missingCommentCount} \u4E2A`);
      if (!detectIncrementalColumn(columns)) issues.push("\u7F3A\u5C11\u660E\u663E\u589E\u91CF\u5B57\u6BB5");
      if (metrics.highNullColumns >= Math.max(3, Math.ceil(columns.length * 0.4))) issues.push("\u6837\u672C\u663E\u793A\u9AD8\u7A7A\u503C\u5B57\u6BB5\u8F83\u591A");
      return issues;
    }
    function classifyTableByRules(profile, metrics, rowCount, fieldSummary) {
      const tableName = profile.tableName || "";
      const tableComment = profile.tableComment || "";
      const columns = Array.isArray(profile.columns) ? profile.columns : [];
      const issues = buildMetadataIssues(profile, fieldSummary, metrics);
      let category = "business";
      let priority = "medium";
      const evidence = [];
      const risks = [...issues];
      if (detectLowValueByName(tableName)) {
        category = "low_value";
        priority = "low";
        evidence.push("\u8868\u540D\u547D\u4E2D\u4E34\u65F6/\u5907\u4EFD/\u6D4B\u8BD5\u6A21\u5F0F");
      } else if (detectDictionaryTable(tableName, tableComment, columns, fieldSummary)) {
        category = "dictionary";
        priority = "medium";
        evidence.push("\u5B57\u6BB5\u7ED3\u6784\u548C\u6CE8\u91CA\u7279\u5F81\u7B26\u5408\u5B57\u5178\u8868\u6A21\u5F0F");
      } else if (detectRelationTable(tableName, columns)) {
        category = "relation";
        priority = "medium";
        evidence.push("\u5B57\u6BB5\u7ED3\u6784\u66F4\u50CF\u5173\u8054\u6216\u6620\u5C04\u8868");
      } else if (detectLogTable(tableName, tableComment)) {
        category = "log";
        priority = "low";
        evidence.push("\u8868\u540D\u6216\u6CE8\u91CA\u547D\u4E2D\u65E5\u5FD7/\u5BA1\u8BA1\u6A21\u5F0F");
      } else {
        category = "business";
        priority = rowCount && rowCount > 1e5 ? "high" : "medium";
        evidence.push("\u4E3B\u952E\u3001\u65F6\u95F4\u5B57\u6BB5\u548C\u5B57\u6BB5\u7ED3\u6784\u66F4\u63A5\u8FD1\u4E1A\u52A1\u8868");
      }
      if (rowCount === null || rowCount === void 0 || rowCount === 0) {
        risks.push("\u8868\u6570\u636E\u91CF\u4E3A\u7A7A\u6216\u672A\u7EDF\u8BA1\u5230");
        if (priority === "high") priority = "medium";
      }
      if (metrics.highNullColumns > 0) evidence.push(`\u6837\u672C\u4E2D\u9AD8\u7A7A\u503C\u5B57\u6BB5 ${metrics.highNullColumns} \u4E2A`);
      if (fieldSummary.timeFields.length > 0) evidence.push(`\u8BC6\u522B\u5230 ${fieldSummary.timeFields.length} \u4E2A\u65F6\u95F4\u7C7B\u5B57\u6BB5`);
      if (fieldSummary.primaryKeys.length > 0) evidence.push(`\u8BC6\u522B\u5230\u4E3B\u952E\u5B57\u6BB5 ${fieldSummary.primaryKeys.join("\u3001")}`);
      return {
        category,
        priority,
        confidence: category === "business" ? 0.72 : 0.82,
        evidence: uniqueStrings(evidence),
        risks: uniqueStrings(risks),
        suggestedMode: detectIncrementalColumn(columns) ? "incremental" : "full"
      };
    }
    function summarizeTables(tableProfiles = []) {
      const categoryStats = {};
      let totalRowCount = 0;
      for (const item of tableProfiles) {
        categoryStats[item.category] = Number(categoryStats[item.category] || 0) + 1;
        if (typeof item.rowCount === "number") totalRowCount += item.rowCount;
      }
      return { totalTables: tableProfiles.length, totalRowCount, categoryStats };
    }
    function buildAiTableCard(tableProfile, options = {}) {
      const fieldProfiles = Array.isArray(tableProfile.fieldProfiles) ? tableProfile.fieldProfiles : [];
      const card = {
        tableName: tableProfile.tableName,
        tableComment: tableProfile.tableComment,
        rowCountMode: tableProfile.rowCountMode,
        rowCount: tableProfile.rowCount,
        columnCount: tableProfile.columnCount,
        sampleCount: tableProfile.sampleCount,
        categoryByRule: tableProfile.category,
        priorityByRule: tableProfile.priority,
        incrementalColumn: tableProfile.incrementalColumn,
        metadataIssues: tableProfile.metadataIssues,
        qualitySummary: { highNullColumns: tableProfile.quality?.highNullColumns || 0 },
        fieldSummary: tableProfile.fieldSummary
      };
      if (options.includeFieldEvidence) {
        card.fieldEvidence = fieldProfiles.slice(0, 40).map((field) => ({
          columnName: field.columnName,
          dataType: field.dataType || field.columnType || "",
          columnComment: field.columnComment || "",
          isPrimaryKey: Boolean(field.isPrimaryKey),
          nullRate: typeof field.nullRate === "number" ? field.nullRate : void 0,
          distinctRatio: typeof field.distinctRatio === "number" ? field.distinctRatio : void 0,
          sampleValues: Array.isArray(field.sampleValues) ? field.sampleValues.slice(0, 5) : [],
          issueTags: Array.isArray(field.issueTags) ? field.issueTags.slice(0, 5) : []
        }));
      }
      return card;
    }
    function buildBatchPromptPayload(source, config, tableCards) {
      return {
        source: {
          sourceName: source.sourceName,
          sourceType: source.sourceType,
          databaseName: pickDatabaseName(source),
          schemaName: pickSchemaName(source)
        },
        config: {
          rowCountMode: config.rowCountMode || "estimated",
          sampleSize: config.sampleSize,
          researchItems: config.researchItems
        },
        tables: tableCards
      };
    }
    function normalizeAiCategory(category) {
      const normalized = String(category || "").trim().toLowerCase();
      return ["business", "dictionary", "relation", "log", "temporary", "low_value"].includes(normalized) ? normalized : null;
    }
    function normalizePriority(priority) {
      const normalized = String(priority || "").trim().toLowerCase();
      return ["high", "medium", "low"].includes(normalized) ? normalized : null;
    }
    function mergeAiDecision(tableProfiles, aiDecision) {
      if (!aiDecision || !Array.isArray(aiDecision.tableDecisions)) return tableProfiles;
      const decisionMap = new Map(aiDecision.tableDecisions.filter((item) => item?.tableName).map((item) => [String(item.tableName), item]));
      return tableProfiles.map((item) => {
        const decision = decisionMap.get(item.tableName);
        if (!decision) return item;
        return {
          ...item,
          category: normalizeAiCategory(decision.category) || item.category,
          priority: normalizePriority(decision.priority) || item.priority,
          confidence: typeof decision.confidence === "number" ? decision.confidence : item.confidence,
          evidence: uniqueStrings([...item.evidence || [], ...Array.isArray(decision.evidence) ? decision.evidence : []]),
          risks: uniqueStrings([...item.risks || [], ...Array.isArray(decision.risks) ? decision.risks : []]),
          suggestedMode: String(decision.suggestedMode || "").trim() || item.suggestedMode
        };
      });
    }
    function clampConfidence(value, fallback = 0.75) {
      const number = Number(value);
      if (!Number.isFinite(number)) return fallback;
      return Math.max(0, Math.min(1, Number(number.toFixed(4))));
    }
    function getUnqualifiedTableName(tableName = "") {
      const parts = String(tableName || "").replace(/[`"]/g, "").split(".").map((item) => item.trim()).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : String(tableName || "").trim();
    }
    function normalizeIdentifier(value = "") {
      return getUnqualifiedTableName(value).toLowerCase().replace(/[^a-z0-9_\u4e00-\u9fa5]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    }
    function splitIdentifierTokens(value = "") {
      return normalizeIdentifier(value).split("_").map((item) => item.trim()).filter(Boolean);
    }
    function singularizeToken(token = "") {
      const normalized = String(token || "").trim();
      if (/ies$/.test(normalized) && normalized.length > 4) {
        return `${normalized.slice(0, -3)}y`;
      }
      if (/s$/.test(normalized) && normalized.length > 3) {
        return normalized.slice(0, -1);
      }
      return normalized;
    }
    function buildTableAliases(tableName = "") {
      const ignoredTokens = /* @__PURE__ */ new Set(["ods", "dwd", "dws", "dim", "fact", "tmp", "temp", "t", "tb", "sys", "biz", "base", "info", "detail", "list", "main", "data"]);
      const normalized = normalizeIdentifier(tableName);
      const rawTokens = splitIdentifierTokens(tableName);
      const businessTokens = rawTokens.filter((token) => !ignoredTokens.has(token));
      const candidates = [
        normalized,
        businessTokens.join("_"),
        rawTokens.slice(-2).join("_"),
        rawTokens.slice(-1).join("_"),
        businessTokens.slice(-2).join("_"),
        businessTokens.slice(-1).join("_"),
        ...businessTokens
      ];
      return uniqueStrings(candidates.flatMap((item) => [item, singularizeToken(item)])).map((item) => normalizeIdentifier(item)).filter((item) => item && item.length >= 2);
    }
    function getProfileFields(profile) {
      const fields = Array.isArray(profile?.fieldProfiles) && profile.fieldProfiles.length ? profile.fieldProfiles : Array.isArray(profile?.columns) ? profile.columns : Array.isArray(profile?.fields) ? profile.fields : [];
      return fields.map((field) => ({
        columnName: String(field?.columnName || "").trim(),
        dataType: String(field?.dataType || field?.columnType || "").trim(),
        columnType: String(field?.columnType || field?.dataType || "").trim(),
        ordinalPosition: Number(field?.ordinalPosition || 0),
        isPrimaryKey: Boolean(field?.isPrimaryKey),
        columnComment: String(field?.columnComment || "").trim(),
        distinctRatio: Number(field?.distinctRatio ?? field?.distinctRate ?? 0)
      })).filter((field) => field.columnName);
    }
    function getPrimaryFields(profile) {
      const fields = getProfileFields(profile);
      const primaryFields = fields.filter((field) => field.isPrimaryKey);
      if (primaryFields.length) return primaryFields;
      const idField = fields.find((field) => normalizeIdentifier(field.columnName) === "id");
      if (idField) return [idField];
      const codeField = fields.find((field) => /(code|no|number|key)$/i.test(String(field.columnName || "")));
      return codeField ? [codeField] : fields.slice(0, 1);
    }
    function pickRelationshipFields(profile) {
      const fields = getProfileFields(profile);
      const selected = [];
      for (const field of fields) {
        const name = normalizeIdentifier(field.columnName);
        if (field.isPrimaryKey || /(id|code|no|num|number|key)$/i.test(name) || /(name|title|label|type|status|state|time|date)$/i.test(name) || Number(field.ordinalPosition || 0) <= 8) {
          selected.push(field);
        }
      }
      const deduped = [];
      const seen = /* @__PURE__ */ new Set();
      for (const field of [...selected, ...fields]) {
        const key = normalizeIdentifier(field.columnName);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(field);
        if (deduped.length >= 24) break;
      }
      return deduped;
    }
    function buildRelationshipEntities(tableProfiles = []) {
      return tableProfiles.map((profile) => ({
        tableName: profile.tableName,
        tableComment: profile.tableComment || "",
        category: profile.category || "business",
        priority: profile.priority || "medium",
        rowCount: profile.rowCount ?? null,
        fields: pickRelationshipFields(profile).map((field) => ({
          columnName: field.columnName,
          dataType: field.dataType || field.columnType || "",
          isPrimaryKey: Boolean(field.isPrimaryKey),
          columnComment: field.columnComment || ""
        }))
      }));
    }
    function getProfileField(profile, columnName) {
      const normalized = normalizeIdentifier(columnName);
      return getProfileFields(profile).find((field) => normalizeIdentifier(field.columnName) === normalized) || null;
    }
    function inferTargetFieldRole(profile, columnName) {
      const field = getProfileField(profile, columnName);
      if (field?.isPrimaryKey) return "PRIMARY_KEY";
      if (Number(field?.distinctRatio ?? field?.distinctRate ?? 0) >= 0.98) return "UNIQUE_KEY";
      return "BUSINESS_KEY";
    }
    function enrichRelationFieldRoles(relation, tableProfiles = []) {
      const tableMap = buildProfileLookupMap(tableProfiles);
      const targetProfile = findProfileByTableReference(tableMap, relation.toTable);
      return {
        ...relation,
        fromFieldRole: relation.fromFieldRole || (relation.source === "constraint" ? "FOREIGN_KEY" : "REFERENCE"),
        toFieldRole: relation.toFieldRole || inferTargetFieldRole(targetProfile, relation.toField),
        joinCondition: relation.joinCondition || `${relation.fromTable}.${relation.fromField} = ${relation.toTable}.${relation.toField}`
      };
    }
    function buildProfileLookupMap(tableProfiles = []) {
      const map = /* @__PURE__ */ new Map();
      for (const profile of tableProfiles) {
        const keys = uniqueStrings([
          profile.tableName,
          getUnqualifiedTableName(profile.tableName),
          normalizeIdentifier(profile.tableName),
          normalizeIdentifier(getUnqualifiedTableName(profile.tableName))
        ]);
        keys.forEach((key) => map.set(String(key), profile));
      }
      return map;
    }
    function findProfileByTableReference(tableMap, tableName = "") {
      if (!tableName) return null;
      return tableMap.get(String(tableName)) || tableMap.get(getUnqualifiedTableName(tableName)) || tableMap.get(normalizeIdentifier(tableName)) || null;
    }
    function buildRelationKey(relation) {
      return [
        normalizeIdentifier(relation.fromTable),
        normalizeIdentifier(relation.fromField),
        normalizeIdentifier(relation.toTable),
        normalizeIdentifier(relation.toField)
      ].join(".");
    }
    function normalizeRelationType(value) {
      const normalized = String(value || "").trim().toUpperCase();
      return ["1:1", "1:N", "N:1", "N:N"].includes(normalized) ? normalized : "N:1";
    }
    function normalizeRelationSource(value) {
      const normalized = String(value || "").trim().toLowerCase();
      return ["constraint", "name_rule", "ai"].includes(normalized) ? normalized : "ai";
    }
    function inferConstraintRelations(tableProfiles = []) {
      const tableMap = buildProfileLookupMap(tableProfiles);
      const relations = [];
      for (const profile of tableProfiles) {
        const constraints = Array.isArray(profile.constraintDetails) ? profile.constraintDetails : [];
        for (const constraint of constraints) {
          const type = String(constraint?.constraintType || "").toLowerCase();
          if (!type.includes("foreign")) continue;
          const columns = Array.isArray(constraint.columns) ? constraint.columns : [];
          const references = Array.isArray(constraint.references) ? constraint.references : [];
          references.forEach((reference, index) => {
            const target = findProfileByTableReference(tableMap, reference?.tableName);
            const fromField = String(columns[index] || columns[0] || "").trim();
            const toField = String(reference?.columnName || "").trim();
            if (!target || target.tableName === profile.tableName || !fromField || !toField) return;
            relations.push({
              fromTable: profile.tableName,
              fromField,
              toTable: target.tableName,
              toField,
              relationType: "N:1",
              confidence: 0.98,
              source: "constraint",
              fromFieldRole: "FOREIGN_KEY",
              toFieldRole: inferTargetFieldRole(target, toField),
              constraintName: constraint.constraintName || "",
              evidence: uniqueStrings([
                `\u663E\u5F0F\u5916\u952E ${constraint.constraintName || ""}`.trim(),
                `${profile.tableName}.${fromField} \u5F15\u7528 ${target.tableName}.${toField}`
              ])
            });
          });
        }
      }
      return relations;
    }
    function findLikelyTargetField(targetProfile, suffix) {
      const primaryFields = getPrimaryFields(targetProfile);
      const normalizedSuffix = normalizeIdentifier(suffix);
      const exactPrimary = primaryFields.find((field) => normalizeIdentifier(field.columnName) === normalizedSuffix);
      if (exactPrimary) return exactPrimary;
      if (normalizedSuffix === "id") {
        return primaryFields.find((field) => /(^id$|_id$)/i.test(normalizeIdentifier(field.columnName))) || null;
      }
      if (["code", "no", "num", "number", "key"].includes(normalizedSuffix)) {
        const matched = primaryFields.find((field) => normalizeIdentifier(field.columnName).endsWith(`_${normalizedSuffix}`) || normalizeIdentifier(field.columnName).endsWith(normalizedSuffix));
        if (matched) return matched;
        return getProfileFields(targetProfile).find((field) => normalizeIdentifier(field.columnName).endsWith(`_${normalizedSuffix}`) || normalizeIdentifier(field.columnName).endsWith(normalizedSuffix)) || null;
      }
      return null;
    }
    function matchFieldAgainstTarget(field, targetProfile) {
      const fieldName = normalizeIdentifier(field.columnName);
      if (!fieldName) return null;
      const aliases = buildTableAliases(targetProfile.tableName);
      const primaryFields = getPrimaryFields(targetProfile);
      const normalizedPrimaryNames = primaryFields.map((item) => normalizeIdentifier(item.columnName));
      const suffixes = ["id", "code", "no", "num", "number", "key"];
      const declaredPrimaryField = getProfileFields(targetProfile).find((item) => item.isPrimaryKey && normalizeIdentifier(item.columnName) === fieldName);
      if (declaredPrimaryField) {
        return {
          toField: declaredPrimaryField.columnName,
          confidence: 0.9,
          evidence: `\u5B57\u6BB5 ${field.columnName} \u4E0E ${targetProfile.tableName} \u7684\u4E3B\u952E\u5B57\u6BB5\u540C\u540D`
        };
      }
      for (const alias of aliases) {
        for (const suffix of suffixes) {
          if (fieldName === `${alias}_${suffix}` || fieldName === `${singularizeToken(alias)}_${suffix}`) {
            const targetField = findLikelyTargetField(targetProfile, suffix);
            if (!targetField) continue;
            return {
              toField: targetField.columnName,
              confidence: suffix === "id" ? 0.88 : 0.82,
              evidence: `\u5B57\u6BB5\u540D ${field.columnName} \u547D\u4E2D ${targetProfile.tableName} \u7684 ${alias}_${suffix} \u5F15\u7528\u6A21\u5F0F`
            };
          }
        }
      }
      if (fieldName !== "id" && normalizedPrimaryNames.includes(fieldName) && /(code|no|num|number|key)$/i.test(fieldName)) {
        const targetField = primaryFields.find((item) => normalizeIdentifier(item.columnName) === fieldName);
        if (!targetField?.isPrimaryKey && Number(targetField?.distinctRatio || 0) < 0.98) return null;
        return {
          toField: targetField?.columnName || field.columnName,
          confidence: 0.72,
          evidence: `\u5B57\u6BB5\u540D ${field.columnName} \u4E0E ${targetProfile.tableName} \u7684\u4E1A\u52A1\u952E\u540D\u79F0\u4E00\u81F4`
        };
      }
      const semanticName = fieldName.replace(/^(assigned|inbound|outbound|related|source|target|current|base|dep|arr|origin|destination)_/, "");
      if (semanticName !== fieldName && /(id|code|no|num|number|key|icao)$/i.test(semanticName)) {
        const targetField = getProfileFields(targetProfile).find((item) => normalizeIdentifier(item.columnName) === semanticName);
        if (targetField) {
          return {
            toField: targetField.columnName,
            confidence: targetField.isPrimaryKey ? 0.86 : 0.8,
            evidence: `\u5B57\u6BB5 ${field.columnName} \u53BB\u9664\u4E1A\u52A1\u65B9\u5411\u524D\u7F00\u540E\u4E0E ${targetProfile.tableName}.${targetField.columnName} \u4E00\u81F4`
          };
        }
      }
      const airportAliases = /* @__PURE__ */ new Set(["airport_icao", "dep_airport", "arr_airport", "origin_airport", "destination_airport"]);
      if (airportAliases.has(fieldName)) {
        const targetField = getProfileFields(targetProfile).find((item) => airportAliases.has(normalizeIdentifier(item.columnName)) && item.isPrimaryKey);
        if (targetField) {
          return {
            toField: targetField.columnName,
            confidence: 0.84,
            multiTarget: true,
            evidence: `\u5B57\u6BB5 ${field.columnName} \u4E0E ${targetProfile.tableName}.${targetField.columnName} \u540C\u5C5E\u673A\u573A ICAO \u4E1A\u52A1\u952E`
          };
        }
      }
      return null;
    }
    function inferNameRuleRelations(tableProfiles = [], existingRelations = []) {
      const existingKeys = new Set(existingRelations.map(buildRelationKey));
      const relations = [];
      for (const sourceProfile of tableProfiles) {
        const fields = getProfileFields(sourceProfile);
        for (const field of fields) {
          if (field.isPrimaryKey) continue;
          const fieldName = normalizeIdentifier(field.columnName);
          if (!/(^|_)(id|code|no|num|number|key)$/i.test(fieldName) && !/(id|code|no|num|number|key)$/i.test(fieldName) && !/(^|_)(airport|icao)$/i.test(fieldName)) continue;
          for (const targetProfile of tableProfiles) {
            if (targetProfile.tableName === sourceProfile.tableName) continue;
            const matched = matchFieldAgainstTarget(field, targetProfile);
            if (!matched?.toField) continue;
            const relation = {
              fromTable: sourceProfile.tableName,
              fromField: field.columnName,
              toTable: targetProfile.tableName,
              toField: matched.toField,
              relationType: "N:1",
              confidence: matched.confidence,
              source: "name_rule",
              evidence: [matched.evidence]
            };
            const key = buildRelationKey(relation);
            if (existingKeys.has(key)) continue;
            existingKeys.add(key);
            relations.push(relation);
            if (!matched.multiTarget) break;
          }
        }
      }
      return relations.sort((left, right) => right.confidence - left.confidence).slice(0, 300);
    }
    function dedupeRelations(relations = []) {
      const map = /* @__PURE__ */ new Map();
      for (const relation of relations) {
        if (!relation?.fromTable || !relation?.fromField || !relation?.toTable || !relation?.toField) continue;
        const key = buildRelationKey(relation);
        const current = map.get(key);
        const normalized = {
          fromTable: relation.fromTable,
          fromField: relation.fromField,
          toTable: relation.toTable,
          toField: relation.toField,
          relationType: normalizeRelationType(relation.relationType),
          confidence: clampConfidence(relation.confidence),
          source: normalizeRelationSource(relation.source),
          fromFieldRole: relation.fromFieldRole || (normalizeRelationSource(relation.source) === "constraint" ? "FOREIGN_KEY" : "REFERENCE"),
          toFieldRole: relation.toFieldRole || "BUSINESS_KEY",
          constraintName: relation.constraintName || "",
          joinCondition: relation.joinCondition || `${relation.fromTable}.${relation.fromField} = ${relation.toTable}.${relation.toField}`,
          evidence: uniqueStrings(Array.isArray(relation.evidence) ? relation.evidence : [relation.evidence].filter(Boolean))
        };
        if (!current || normalized.confidence > current.confidence) {
          map.set(key, {
            ...normalized,
            evidence: uniqueStrings([...current?.evidence || [], ...normalized.evidence])
          });
        } else {
          current.evidence = uniqueStrings([...current.evidence || [], ...normalized.evidence]);
        }
      }
      return Array.from(map.values()).sort((left, right) => {
        if (right.confidence !== left.confidence) return right.confidence - left.confidence;
        return `${left.fromTable}.${left.fromField}`.localeCompare(`${right.fromTable}.${right.fromField}`, "zh-CN");
      });
    }
    function buildRuleRelationshipReport(tableProfiles = []) {
      const constraintRelations = inferConstraintRelations(tableProfiles);
      const nameRuleRelations = inferNameRuleRelations(tableProfiles, constraintRelations);
      return dedupeRelations([...constraintRelations, ...nameRuleRelations].map((relation) => enrichRelationFieldRoles(relation, tableProfiles)));
    }
    async function expandRelationshipProfiles(source, allTables, selectedProfiles, config, signal) {
      if (isObjectPreviewSource(source)) return selectedProfiles;
      const selectedNames = new Set(selectedProfiles.map((profile) => profile.tableName));
      const allTableNames = new Set(allTables.map((table) => table.tableName));
      const registeredTableNames = /* @__PURE__ */ new Set();
      selectedProfiles.forEach((profile) => {
        (profile.sampleRows || []).forEach((row) => {
          Object.values(row || {}).forEach((value) => {
            const candidate = String(value || "").trim();
            if (allTableNames.has(candidate)) registeredTableNames.add(candidate);
          });
        });
        (profile.constraintDetails || []).forEach((constraint) => {
          (constraint.references || []).forEach((reference) => {
            const candidate = String(reference?.tableName || "").trim();
            if (allTableNames.has(candidate)) registeredTableNames.add(candidate);
          });
        });
      });
      const candidates = allTables.filter((table) => registeredTableNames.has(table.tableName) && !selectedNames.has(table.tableName)).slice(0, Math.max(0, Number(config.relationshipDiscoveryMaxTables || 100) - selectedProfiles.length));
      if (!candidates.length) return selectedProfiles;
      const discoveredProfiles = await runWithConcurrency(candidates, Math.min(4, Number(config.metadataConcurrency || 3)), async (table) => {
        if (signal?.aborted) throw createResearchRunCancelledError();
        try {
          const profile = await previewService.inspectObjectProfile(source, table.tableName, {
            sampleSize: Math.min(10, Number(config.sampleSize || 50)),
            tableInfo: table
          });
          const fieldProfiles = buildFieldProfiles(profile.columns || [], profile.sampleRows || []);
          return {
            tableName: table.tableName,
            tableComment: profile.tableComment || table.tableComment || "",
            rowCount: null,
            category: "business",
            priority: "medium",
            constraintDetails: Array.isArray(profile.constraints) ? profile.constraints : [],
            fieldProfiles,
            columns: profile.columns || []
          };
        } catch (_error) {
          return null;
        }
      });
      return [...selectedProfiles, ...discoveredProfiles.filter(Boolean)];
    }
    function buildRelationshipSummary(entities = [], relations = []) {
      if (!entities.length) return "\u5F53\u524D\u8C03\u7814\u8303\u56F4\u5185\u6CA1\u6709\u53EF\u7528\u4E8E\u8868\u5173\u7CFB\u5206\u6790\u7684\u8868\u7ED3\u6784\u3002";
      if (!relations.length) {
        return `\u5F53\u524D\u8C03\u7814\u8303\u56F4\u5305\u542B ${entities.length} \u5F20\u8868\uFF0C\u672A\u8BC6\u522B\u5230\u7A33\u5B9A\u7684\u663E\u5F0F\u5916\u952E\u6216\u9AD8\u7F6E\u4FE1\u547D\u540D\u5173\u8054\u3002`;
      }
      const constraintCount = relations.filter((item) => item.source === "constraint").length;
      const nameRuleCount = relations.filter((item) => item.source === "name_rule").length;
      const aiCount = relations.filter((item) => item.source === "ai").length;
      return `\u5F53\u524D\u8C03\u7814\u8303\u56F4\u5305\u542B ${entities.length} \u5F20\u8868\uFF0C\u8BC6\u522B ${relations.length} \u6761\u8868\u5173\u7CFB\uFF0C\u5176\u4E2D\u663E\u5F0F\u7EA6\u675F ${constraintCount} \u6761\u3001\u547D\u540D\u89C4\u5219 ${nameRuleCount} \u6761\u3001\u6A21\u578B\u8865\u5145 ${aiCount} \u6761\u3002`;
    }
    function buildRelationshipPromptPayload(source, config, entities, candidateRelations) {
      return {
        source: {
          sourceName: source.sourceName,
          sourceType: source.sourceType,
          databaseName: pickDatabaseName(source),
          schemaName: pickSchemaName(source)
        },
        config: {
          tableScope: config.tableScope,
          selectedTableCount: entities.length,
          notes: config.notes || ""
        },
        tables: entities.map((entity) => ({
          ...entity,
          fields: entity.fields.slice(0, 24)
        })),
        candidateRelations: candidateRelations.slice(0, 300)
      };
    }
    function normalizeAiRelationships(parsed, entities, candidateRelations = []) {
      const tableMap = /* @__PURE__ */ new Map();
      const fieldMap = /* @__PURE__ */ new Map();
      for (const entity of entities) {
        const tableKeys = uniqueStrings([entity.tableName, getUnqualifiedTableName(entity.tableName), normalizeIdentifier(entity.tableName)]);
        tableKeys.forEach((key) => tableMap.set(String(key), entity.tableName));
        const fields = /* @__PURE__ */ new Map();
        for (const field of entity.fields || []) {
          fields.set(String(field.columnName), field.columnName);
          fields.set(normalizeIdentifier(field.columnName), field.columnName);
        }
        fieldMap.set(entity.tableName, fields);
      }
      const aiRelations = (Array.isArray(parsed?.relations) ? parsed.relations : []).map((item) => {
        const fromTable = tableMap.get(String(item?.fromTable || "")) || tableMap.get(getUnqualifiedTableName(item?.fromTable || "")) || tableMap.get(normalizeIdentifier(item?.fromTable || ""));
        const toTable = tableMap.get(String(item?.toTable || "")) || tableMap.get(getUnqualifiedTableName(item?.toTable || "")) || tableMap.get(normalizeIdentifier(item?.toTable || ""));
        if (!fromTable || !toTable || fromTable === toTable) return null;
        const fromField = fieldMap.get(fromTable)?.get(String(item?.fromField || "")) || fieldMap.get(fromTable)?.get(normalizeIdentifier(item?.fromField || ""));
        const toField = fieldMap.get(toTable)?.get(String(item?.toField || "")) || fieldMap.get(toTable)?.get(normalizeIdentifier(item?.toField || ""));
        if (!fromField || !toField) return null;
        return enrichRelationFieldRoles({
          fromTable,
          fromField,
          toTable,
          toField,
          relationType: normalizeRelationType(item?.relationType),
          confidence: clampConfidence(item?.confidence, 0.76),
          source: normalizeRelationSource(item?.source || "ai"),
          fromFieldRole: item?.fromFieldRole,
          toFieldRole: item?.toFieldRole,
          evidence: uniqueStrings(Array.isArray(item?.evidence) ? item.evidence : [item?.evidence].filter(Boolean))
        }, entities);
      }).filter(Boolean);
      return {
        summary: normalizeSummaryText(parsed?.summary || "", 1200),
        relations: dedupeRelations([...candidateRelations, ...aiRelations])
      };
    }
    async function analyzeTableRelationships(runId, source, config, tableProfiles, signal) {
      const entities = buildRelationshipEntities(tableProfiles);
      const candidateRelations = buildRuleRelationshipReport(tableProfiles);
      const batch = {
        stageKey: "table_relationship",
        batchNo: 1,
        batchSize: entities.length,
        inputSummary: {
          tableCount: entities.length,
          candidateRelationCount: candidateRelations.length
        },
        status: "pending"
      };
      const startedAt = Date.now();
      const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("data_source_research");
      if (!aiConfig?.defaultModelProviderId) {
        batch.status = "succeeded";
        batch.durationMs = Date.now() - startedAt;
        batch.output = {
          summary: buildRelationshipSummary(entities, candidateRelations),
          relations: candidateRelations,
          mode: "rule_only"
        };
        await log(runId, "table_relationship", "\u672A\u914D\u7F6E\u6570\u636E\u6E90\u8C03\u7814\u6A21\u578B\uFF0C\u8868\u5173\u7CFB\u5DF2\u4F7F\u7528\u89C4\u5219\u5019\u9009\u7ED3\u679C\u751F\u6210", { logLevel: "warn" });
        return {
          report: {
            summary: batch.output.summary,
            entities,
            relations: candidateRelations
          },
          batch
        };
      }
      let provider = null;
      try {
        provider = await resolveResearchProvider(aiConfig);
      } catch (error) {
        batch.status = "succeeded";
        batch.durationMs = Date.now() - startedAt;
        batch.output = {
          summary: buildRelationshipSummary(entities, candidateRelations),
          relations: candidateRelations,
          mode: "rule_only"
        };
        await log(runId, "table_relationship", `${error.message || "\u6570\u636E\u6E90\u8C03\u7814\u6A21\u578B\u4E0D\u5B58\u5728"}\uFF0C\u8868\u5173\u7CFB\u5DF2\u56DE\u9000\u5230\u89C4\u5219\u5019\u9009\u7ED3\u679C`, { logLevel: "warn" });
        return {
          report: {
            summary: batch.output.summary,
            entities,
            relations: candidateRelations
          },
          batch
        };
      }
      try {
        assertResearchRunNotCancelled(runId);
        await log(runId, "table_relationship", "\u5F00\u59CB\u6A21\u578B\u8868\u5173\u7CFB\u8C03\u7814", {
          detail: {
            tableCount: entities.length,
            candidateRelationCount: candidateRelations.length
          }
        });
        const messages = ensureJsonObjectPrompt([
          { role: "system", content: `${TABLE_RELATIONSHIP_PROMPT}

${aiConfig.systemPrompt ? `\u5E73\u53F0\u8865\u5145\u8981\u6C42\uFF1A${aiConfig.systemPrompt}` : ""}

\u5F53\u524D\u4EFB\u52A1\u4E3A\u8868\u5173\u7CFB\u8C03\u7814\uFF0C\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\u3002` },
          { role: "user", content: JSON.stringify(buildRelationshipPromptPayload(source, { ...config, tableScope: config.tableScope }, entities, candidateRelations), null, 2) }
        ], provider);
        const completion = await modelProviderService.generateChatCompletion(provider, messages, {
          temperature: aiConfig.temperature ?? 0.1,
          maxTokens: Number(aiConfig.maxTokens || 2200),
          signal,
          responseFormat: { type: "json_object" }
        });
        assertResearchRunNotCancelled(runId);
        const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
        const normalized = normalizeAiRelationships(parsed, entities, candidateRelations);
        const relations = normalized.relations;
        const summary = normalized.summary || buildRelationshipSummary(entities, relations);
        batch.status = "succeeded";
        batch.output = { summary, relations };
        batch.durationMs = Date.now() - startedAt;
        await log(runId, "table_relationship", "\u6A21\u578B\u8868\u5173\u7CFB\u8C03\u7814\u5B8C\u6210");
        return {
          report: {
            summary,
            entities,
            relations
          },
          batch
        };
      } catch (error) {
        if (isResearchRunCancelledError(error) || isResearchRunCancellationRequested(runId)) {
          throw createResearchRunCancelledError();
        }
        batch.status = "failed";
        batch.errorMessage = error.message || "\u6A21\u578B\u8868\u5173\u7CFB\u8C03\u7814\u5931\u8D25";
        batch.durationMs = Date.now() - startedAt;
        await log(runId, "table_relationship", `\u6A21\u578B\u8868\u5173\u7CFB\u8C03\u7814\u5931\u8D25\uFF0C\u5DF2\u4F7F\u7528\u89C4\u5219\u5019\u9009\u5173\u7CFB: ${error.message || "unknown"}`, { logLevel: "warn" });
        return {
          report: {
            summary: buildRelationshipSummary(entities, candidateRelations),
            entities,
            relations: candidateRelations
          },
          batch
        };
      }
    }
    var DOC_CATEGORY_LABELS = {
      business: "\u4E1A\u52A1\u8868",
      dictionary: "\u5B57\u5178\u8868",
      relation: "\u5173\u8054\u8868",
      log: "\u65E5\u5FD7\u8868",
      temporary: "\u4E34\u65F6\u8868",
      low_value: "\u4F4E\u4EF7\u503C\u8868"
    };
    var DOC_PRIORITY_LABELS = {
      high: "\u9AD8",
      medium: "\u4E2D",
      low: "\u4F4E"
    };
    var DOC_STAGE_LABELS = {
      table_classification: "\u8868\u5206\u7C7B",
      report_aggregation: "\u5168\u5C40\u6C47\u603B",
      table_relationship: "\u8868\u5173\u7CFB",
      data_scale: "\u6570\u636E\u89C4\u6A21",
      quality_inspection: "\u6570\u636E\u8D28\u91CF",
      ingestion_advice: "\u63A5\u5165\u5EFA\u8BAE",
      governance_advice: "\u6CBB\u7406\u5EFA\u8BAE",
      analysis_advice: "\u5206\u6790\u5EFA\u8BAE"
    };
    var DOC_RELATION_SOURCE_LABELS = {
      constraint: "\u663E\u5F0F\u7EA6\u675F",
      name_rule: "\u547D\u540D\u89C4\u5219",
      ai: "\u6A21\u578B\u5224\u65AD"
    };
    function escapeXml(value = "") {
      return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    }
    function truncateText(value = "", maxLength = 80) {
      const text = String(value ?? "").trim();
      if (text.length <= maxLength) return text;
      return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
    }
    function formatDocDateTime(value) {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    function sanitizeDownloadFileName(value = "") {
      const normalized = String(value || "data_source_research_report").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      return normalized || "data_source_research_report";
    }
    function formatDownloadDateTime(value) {
      const date = new Date(value || Date.now());
      const validDate = Number.isNaN(date.getTime()) ? /* @__PURE__ */ new Date() : date;
      const pad = (part) => String(part).padStart(2, "0");
      return `${validDate.getFullYear()}${pad(validDate.getMonth() + 1)}${pad(validDate.getDate())}_${pad(validDate.getHours())}${pad(validDate.getMinutes())}${pad(validDate.getSeconds())}`;
    }
    function createResearchDocTextRun(value, options = {}) {
      return new TextRun({
        text: String(value ?? ""),
        bold: Boolean(options.bold),
        size: Number(options.size || 21),
        font: options.font || "Microsoft YaHei",
        color: options.color || "1F2937"
      });
    }
    function createResearchDocParagraph(value, options = {}) {
      return new Paragraph({
        heading: options.heading,
        alignment: options.alignment,
        pageBreakBefore: Boolean(options.pageBreakBefore),
        spacing: {
          before: Number(options.before || 0),
          after: Number(options.after ?? 120),
          line: Number(options.line || 280)
        },
        children: [
          createResearchDocTextRun(value, {
            bold: options.bold,
            size: options.size,
            font: options.font,
            color: options.color
          })
        ]
      });
    }
    function createResearchDocBullet(value) {
      return new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 70, line: 260 },
        children: [createResearchDocTextRun(value, { size: 20 })]
      });
    }
    function createResearchDocBulletList(values = [], fallback = "\u65E0\u3002", max = 40) {
      const list = uniqueStrings(Array.isArray(values) ? values : []).slice(0, max);
      return list.length ? list.map((item) => createResearchDocBullet(item)) : [createResearchDocParagraph(fallback, { size: 20, color: "64748B" })];
    }
    function formatDocInlineList(values = []) {
      return uniqueStrings(Array.isArray(values) ? values : []).join("\u3001") || "-";
    }
    function formatDocIssueTypes(values = []) {
      return formatDocInlineList((Array.isArray(values) ? values : []).map(translateFieldIssueTag));
    }
    function createResearchDocTable(headers, rows, options = {}) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: options.fixed ? TableLayoutType.FIXED : TableLayoutType.AUTOFIT,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "BFC6D1" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFC6D1" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "BFC6D1" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "BFC6D1" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D7DDE5" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D7DDE5" }
        },
        rows: [
          new TableRow({
            tableHeader: true,
            children: headers.map((header, index) => new TableCell({
              width: Array.isArray(options.widths) && options.widths[index] ? { size: Number(options.widths[index]), type: WidthType.PERCENTAGE } : void 0,
              shading: { fill: options.headerFill || "EEF2FF" },
              margins: { top: 90, bottom: 90, left: 100, right: 100 },
              children: [
                new Paragraph({
                  spacing: { after: 40 },
                  children: [createResearchDocTextRun(header, { bold: true, size: Number(options.headerFontSize || 19), color: options.headerColor || "1E3A8A" })]
                })
              ]
            }))
          }),
          ...(Array.isArray(rows) ? rows : []).map((row, rowIndex) => new TableRow({
            children: row.map((cell, index) => new TableCell({
              width: Array.isArray(options.widths) && options.widths[index] ? { size: Number(options.widths[index]), type: WidthType.PERCENTAGE } : void 0,
              shading: options.zebra !== false && rowIndex % 2 === 1 ? { fill: "F8FAFC" } : void 0,
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  spacing: { after: 40, line: 250 },
                  children: [createResearchDocTextRun(String(cell ?? "-"), {
                    size: options.codeColumns?.includes(index) ? Number(options.codeFontSize || 16) : Number(options.fontSize || 18),
                    font: options.codeColumns?.includes(index) ? "Consolas" : "Microsoft YaHei"
                  })]
                })
              ]
            }))
          }))
        ]
      });
    }
    function buildRelationshipErSvg(tableRelationships) {
      const entities = Array.isArray(tableRelationships?.entities) ? tableRelationships.entities : [];
      if (!entities.length) return null;
      const relations = Array.isArray(tableRelationships?.relations) ? tableRelationships.relations : [];
      const palette = ["#2563EB", "#7C3AED", "#0891B2", "#059669", "#D97706", "#DC2626", "#4F46E5"];
      const nodeWidth = 270;
      const nodeHeight = 178;
      const gapX = 100;
      const gapY = 86;
      const columns = entities.length <= 4 ? 2 : 3;
      const rows = Math.ceil(entities.length / columns);
      const width = Math.max(900, 64 + columns * nodeWidth + (columns - 1) * gapX + 64);
      const height = Math.max(420, 70 + rows * nodeHeight + (rows - 1) * gapY + 70);
      const positions = /* @__PURE__ */ new Map();
      entities.forEach((entity, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        positions.set(entity.tableName, {
          x: 64 + col * (nodeWidth + gapX),
          y: 70 + row * (nodeHeight + gapY),
          color: palette[index % palette.length]
        });
      });
      const relationCountMap = /* @__PURE__ */ new Map();
      relations.forEach((relation) => {
        relationCountMap.set(relation.fromTable, Number(relationCountMap.get(relation.fromTable) || 0) + 1);
        relationCountMap.set(relation.toTable, Number(relationCountMap.get(relation.toTable) || 0) + 1);
      });
      const edgeSvg = relations.filter((relation) => positions.has(relation.fromTable) && positions.has(relation.toTable)).map((relation, index) => {
        const source = positions.get(relation.fromTable);
        const target = positions.get(relation.toTable);
        const forward = target.x >= source.x;
        const sx = forward ? source.x + nodeWidth : source.x;
        const tx = forward ? target.x : target.x + nodeWidth;
        const sy = source.y + 58 + index % 4 * 18;
        const ty = target.y + 58 + index % 4 * 18;
        const curve = Math.max(70, Math.abs(tx - sx) * 0.36);
        const c1x = forward ? sx + curve : sx - curve;
        const c2x = forward ? tx - curve : tx + curve;
        const labelX = (sx + tx) / 2;
        const labelY = (sy + ty) / 2 - 8;
        return `
        <path d="M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}" fill="none" stroke="#475569" stroke-width="2.3" marker-end="url(#arrow)" opacity="0.78"/>
        <rect x="${labelX - 26}" y="${labelY - 13}" width="52" height="24" rx="12" fill="#FFFFFF" stroke="#CBD5E1"/>
        <text x="${labelX}" y="${labelY + 4}" text-anchor="middle" font-family="Arial, Microsoft YaHei" font-size="12" font-weight="700" fill="#334155">${escapeXml(relation.relationType || "N:1")}</text>
      `;
      }).join("");
      const nodeSvg = entities.map((entity, index) => {
        const position = positions.get(entity.tableName);
        const fields = Array.isArray(entity.fields) ? entity.fields.slice(0, 5) : [];
        const hiddenCount = Math.max(0, Number(entity.fields?.length || 0) - fields.length);
        const color = position.color;
        const fieldsSvg = fields.map((field, fieldIndex) => {
          const y = position.y + 100 + fieldIndex * 18;
          const pk = field.isPrimaryKey ? "PK" : "";
          return `
        <text x="${position.x + 18}" y="${y}" font-family="Consolas, Menlo, monospace" font-size="11" fill="#0F172A">${escapeXml(truncateText(field.columnName, 24))}</text>
        <text x="${position.x + nodeWidth - 18}" y="${y}" text-anchor="end" font-family="Arial, Microsoft YaHei" font-size="10" fill="${field.isPrimaryKey ? color : "#64748B"}">${escapeXml(pk || truncateText(field.dataType || "", 14))}</text>
      `;
        }).join("");
        return `
      <g filter="url(#shadow)">
        <rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="12" fill="#FFFFFF" stroke="#D6DEE8"/>
        <path d="M ${position.x} ${position.y + 12} Q ${position.x} ${position.y} ${position.x + 12} ${position.y} H ${position.x + nodeWidth - 12} Q ${position.x + nodeWidth} ${position.y} ${position.x + nodeWidth} ${position.y + 12} V ${position.y + 72} H ${position.x} Z" fill="${color}"/>
        <text x="${position.x + 18}" y="${position.y + 28}" font-family="Arial, Microsoft YaHei" font-size="11" font-weight="700" fill="#DBEAFE">${escapeXml(DOC_CATEGORY_LABELS[entity.category] || "\u6570\u636E\u8868")}</text>
        <text x="${position.x + 18}" y="${position.y + 52}" font-family="Consolas, Menlo, monospace" font-size="15" font-weight="700" fill="#FFFFFF">${escapeXml(truncateText(entity.tableName, 28))}</text>
        <text x="${position.x + 18}" y="${position.y + 72}" font-family="Arial, Microsoft YaHei" font-size="11" fill="#E0F2FE">${escapeXml(truncateText(entity.tableComment || "\u672A\u8865\u5145\u8BF4\u660E", 32))}</text>
        <rect x="${position.x + 16}" y="${position.y + 86}" width="${nodeWidth - 32}" height="70" rx="8" fill="#F8FAFC" stroke="#E2E8F0"/>
        ${fieldsSvg}
        <text x="${position.x + 18}" y="${position.y + 168}" font-family="Arial, Microsoft YaHei" font-size="11" fill="#64748B">\u5B57\u6BB5 ${Number(entity.fields?.length || 0)} \xB7 \u5173\u7CFB ${Number(relationCountMap.get(entity.tableName) || 0)}${hiddenCount ? ` \xB7 +${hiddenCount}` : ""}</text>
      </g>
    `;
      }).join("");
      const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 12 6 L 0 12 z" fill="#475569"/>
        </marker>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.12"/>
        </filter>
        <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#CBD5E1" opacity="0.75"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#F8FAFC"/>
      <rect width="100%" height="100%" fill="url(#dots)"/>
      ${edgeSvg}
      ${nodeSvg}
    </svg>
  `.trim();
      return { svg, width, height };
    }
    function createRelationshipErImageParagraph(tableRelationships) {
      const payload = buildRelationshipErSvg(tableRelationships);
      if (!payload) {
        return createResearchDocParagraph("\u5F53\u524D\u62A5\u544A\u6CA1\u6709\u53EF\u751F\u6210 ER \u56FE\u7684\u8868\u5173\u7CFB\u6570\u636E\u3002", { size: 20 });
      }
      const imageWidth = 900;
      const imageHeight = Math.max(280, Math.min(680, Math.round(payload.height / payload.width * imageWidth)));
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 160 },
        children: [
          new ImageRun({
            type: "svg",
            data: Buffer.from(payload.svg),
            transformation: {
              width: imageWidth,
              height: imageHeight
            },
            fallback: {
              type: "png",
              data: TRANSPARENT_PNG_BUFFER
            }
          })
        ]
      });
    }
    async function buildResearchReportWordBuffer(report) {
      const tables = Array.isArray(report.tables) ? report.tables : [];
      const insights = report.insights || {};
      const recommendations = report.recommendations || {};
      const scaleInsight = insights.dataScale || {};
      const qualityInsight = insights.dataQuality || {};
      const ingestionInsight = insights.ingestionAdvice || {};
      const governanceInsight = insights.governanceAdvice || {};
      const analysisInsight = insights.analysisAdvice || {};
      const largeTables = Array.isArray(scaleInsight.largeTables) && scaleInsight.largeTables.length ? scaleInsight.largeTables : tables.filter((item) => Number(item.rowCount || 0) >= 1e5).map((item) => item.tableName);
      const smallOrEmptyTables = Array.isArray(scaleInsight.smallOrEmptyTables) && scaleInsight.smallOrEmptyTables.length ? scaleInsight.smallOrEmptyTables : tables.filter((item) => Number(item.rowCount || 0) <= 10).map((item) => item.tableName);
      const complexTables = Array.isArray(scaleInsight.complexTables) && scaleInsight.complexTables.length ? scaleInsight.complexTables : tables.filter((item) => Number(item.columnCount || 0) >= 30 || Number(item.constraints || 0) >= 5).map((item) => item.tableName);
      const scaleSuggestions = Array.isArray(scaleInsight.suggestions) && scaleInsight.suggestions.length ? scaleInsight.suggestions : ["\u5927\u8868\u4F18\u5148\u91C7\u7528\u589E\u91CF\u6216\u5206\u533A\u7B56\u7565\uFF0C\u5C0F\u8868\u548C\u5B57\u5178\u8868\u53EF\u5408\u5E76\u5230\u4F4E\u9891\u540C\u6B65\u6279\u6B21\uFF0C\u590D\u6742\u8868\u63A5\u5165\u524D\u5148\u786E\u8BA4\u4E3B\u952E\u3001\u7D22\u5F15\u548C\u5B57\u6BB5\u53E3\u5F84\u3002"];
      const children = [
        createResearchDocParagraph(`${report.run?.runName || "\u6570\u636E\u6E90\u8C03\u7814\u62A5\u544A"}`, {
          alignment: AlignmentType.CENTER,
          bold: true,
          size: 34,
          color: "0F172A",
          after: 90
        }),
        createResearchDocParagraph("Data Source Research Report", {
          alignment: AlignmentType.CENTER,
          size: 20,
          color: "64748B",
          after: 260
        }),
        createResearchDocTable(
          ["\u9879\u76EE\u9879", "\u5185\u5BB9"],
          [
            ["\u6570\u636E\u6E90", report.source?.sourceName || "-"],
            ["\u6570\u636E\u6E90\u7C7B\u578B", report.source?.sourceType || "-"],
            ["\u6570\u636E\u5E93/Schema", [report.source?.databaseName, report.source?.schemaName].filter(Boolean).join(" / ") || "-"],
            ["\u8C03\u7814\u8868\u6570", String(report.overview?.totalTables ?? "-")],
            ["\u7D2F\u8BA1\u884C\u6570", String(report.overview?.totalRowCount ?? "-")],
            ["\u751F\u6210\u65F6\u95F4", formatDocDateTime(report.run?.startedAt || report.run?.createdAt)]
          ],
          { widths: [24, 76] }
        ),
        createResearchDocParagraph("1. \u8C03\u7814\u6982\u89C8", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 160, after: 140 }),
        createResearchDocParagraph(report.overview?.summary || "\u65E0\u3002", { size: 21 })
      ];
      children.push(
        createResearchDocParagraph("2. \u8868\u5206\u7C7B", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 160, after: 140 }),
        createResearchDocTable(
          ["\u5E8F\u53F7", "\u8868\u540D", "\u8868\u6CE8\u91CA", "\u5206\u7C7B", "\u4F18\u5148\u7EA7", "\u884C\u6570", "\u589E\u91CF\u5B57\u6BB5", "\u4E3B\u8981\u95EE\u9898"],
          tables.map((table, index) => [
            String(index + 1),
            table.tableName || "-",
            table.tableComment || "-",
            DOC_CATEGORY_LABELS[table.category] || table.category || "-",
            DOC_PRIORITY_LABELS[table.priority] || table.priority || "-",
            String(table.rowCount ?? "-"),
            table.incrementalColumn || "-",
            formatDocIssueTypes(table.metadataIssues || [])
          ]),
          { widths: [5, 18, 19, 10, 8, 9, 11, 20], fontSize: 16, codeFontSize: 14, codeColumns: [1, 6] }
        )
      );
      children.push(createResearchDocParagraph("3. \u8868\u5173\u7CFB", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 180, after: 140 }));
      if (report.tableRelationships) {
        const relations = Array.isArray(report.tableRelationships.relations) ? report.tableRelationships.relations : [];
        children.push(
          createResearchDocParagraph(report.tableRelationships.summary || buildRelationshipSummary(report.tableRelationships.entities || [], relations), { size: 21 }),
          createRelationshipErImageParagraph(report.tableRelationships),
          relations.length ? createResearchDocTable(
            ["\u5E8F\u53F7", "\u5F15\u7528\u65B9", "\u88AB\u5F15\u7528\u65B9", "\u5173\u7CFB", "\u6765\u6E90", "\u7F6E\u4FE1\u5EA6", "\u4F9D\u636E"],
            relations.map((relation, index) => [
              String(index + 1),
              `${relation.fromTable || "-"}.${relation.fromField || "-"}`,
              `${relation.toTable || "-"}.${relation.toField || "-"}`,
              relation.relationType || "-",
              DOC_RELATION_SOURCE_LABELS[relation.source] || relation.source || "-",
              `${Math.round(Number(relation.confidence || 0) * 100)}%`,
              (relation.evidence || []).join("\uFF1B") || "-"
            ]),
            { widths: [6, 21, 21, 8, 10, 10, 24], fontSize: 16, codeFontSize: 14, codeColumns: [1, 2] }
          ) : createResearchDocParagraph("\u5F53\u524D\u672A\u8BC6\u522B\u5230\u7A33\u5B9A\u8868\u5173\u7CFB\u3002", { size: 20 })
        );
      } else {
        children.push(createResearchDocParagraph("\u5F53\u524D\u6279\u6B21\u672A\u9009\u62E9\u6216\u672A\u751F\u6210\u8868\u5173\u7CFB\u8C03\u7814\u7ED3\u679C\u3002", { size: 20, color: "64748B" }));
      }
      children.push(
        createResearchDocParagraph("4. \u6570\u636E\u89C4\u6A21", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 180, after: 140 }),
        createResearchDocParagraph(scaleInsight.summary || `\u672C\u6B21\u8C03\u7814\u8986\u76D6 ${report.overview?.totalTables ?? tables.length} \u5F20\u8868\uFF0C\u7D2F\u8BA1\u884C\u6570 ${report.overview?.totalRowCount ?? "-"}\u3002`, { size: 21 }),
        createResearchDocTable(
          ["\u9879\u76EE", "\u5185\u5BB9"],
          [
            ["\u5927\u8868", formatDocInlineList(largeTables)],
            ["\u5C0F\u8868/\u7A7A\u8868", formatDocInlineList(smallOrEmptyTables)],
            ["\u590D\u6742\u8868", formatDocInlineList(complexTables)],
            ["\u89C4\u6A21\u5EFA\u8BAE", formatDocInlineList(scaleSuggestions)]
          ],
          { widths: [20, 80], fontSize: 17 }
        ),
        createResearchDocTable(
          ["\u5E8F\u53F7", "\u8868\u540D", "\u884C\u6570", "\u5B57\u6BB5\u6570", "\u6837\u672C\u6570", "\u7D22\u5F15\u6570", "\u7EA6\u675F\u6570"],
          tables.map((table, index) => [
            String(index + 1),
            table.tableName || "-",
            String(table.rowCount ?? "-"),
            String(table.columnCount ?? "-"),
            String(table.sampleCount ?? "-"),
            String(table.indexes ?? "-"),
            String(table.constraints ?? "-")
          ]),
          { widths: [6, 26, 14, 12, 12, 12, 12], fontSize: 16, codeFontSize: 14, codeColumns: [1] }
        )
      );
      children.push(
        createResearchDocParagraph("5. \u6570\u636E\u8D28\u91CF", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 180, after: 140 }),
        createResearchDocParagraph(qualityInsight.summary || "\u6570\u636E\u8D28\u91CF\u7ED3\u679C\u5DF2\u5408\u5E76\u5143\u6570\u636E\u7F3A\u5931\u3001\u5B57\u6BB5\u8D28\u91CF\u548C\u6837\u672C\u8D28\u91CF\u95EE\u9898\u3002", { size: 21 })
      );
      if (Array.isArray(qualityInsight.issueTypeStats) && qualityInsight.issueTypeStats.length) {
        children.push(createResearchDocTable(
          ["\u95EE\u9898\u7C7B\u578B", "\u6570\u91CF"],
          qualityInsight.issueTypeStats.map((item) => [translateFieldIssueTag(item.issueType), String(item.count ?? 0)]),
          { widths: [70, 30], fontSize: 17 }
        ));
      }
      if (Array.isArray(qualityInsight.tableFindings) && qualityInsight.tableFindings.length) {
        children.push(createResearchDocParagraph("\u8868\u7EA7\u8D28\u91CF\u53D1\u73B0", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }));
        children.push(createResearchDocTable(
          ["\u8868\u540D", "\u95EE\u9898\u7C7B\u578B", "\u8BC1\u636E", "\u5EFA\u8BAE"],
          qualityInsight.tableFindings.slice(0, 80).map((item) => [
            item.tableName || "-",
            formatDocIssueTypes(item.issueTypes || []),
            formatDocInlineList(item.evidence || []),
            item.suggestion || "-"
          ]),
          { widths: [24, 22, 28, 26], fontSize: 16, codeFontSize: 14, codeColumns: [0] }
        ));
      }
      if (Array.isArray(qualityInsight.fieldFindings) && qualityInsight.fieldFindings.length) {
        children.push(createResearchDocParagraph("\u5B57\u6BB5\u7EA7\u8D28\u91CF\u53D1\u73B0", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }));
        children.push(createResearchDocTable(
          ["\u8868\u540D", "\u5B57\u6BB5", "\u95EE\u9898\u7C7B\u578B", "\u8BC1\u636E", "\u5EFA\u8BAE"],
          qualityInsight.fieldFindings.slice(0, 120).map((item) => [
            item.tableName || "-",
            item.columnName || "-",
            formatDocIssueTypes(item.issueTypes || []),
            formatDocInlineList(item.evidence || []),
            item.suggestion || "-"
          ]),
          { widths: [20, 18, 20, 22, 20], fontSize: 16, codeFontSize: 14, codeColumns: [0, 1] }
        ));
      }
      children.push(
        createResearchDocParagraph("\u8D28\u91CF\u6574\u6539\u5EFA\u8BAE", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
        ...createResearchDocBulletList(qualityInsight.suggestions || [])
      );
      children.push(
        createResearchDocParagraph("6. \u63A5\u5165\u5EFA\u8BAE", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 180, after: 140 }),
        createResearchDocParagraph(ingestionInsight.summary || "\u63A5\u5165\u5EFA\u8BAE\u57FA\u4E8E\u8868\u5206\u7C7B\u3001\u6570\u636E\u89C4\u6A21\u3001\u589E\u91CF\u5B57\u6BB5\u548C\u8D28\u91CF\u98CE\u9669\u751F\u6210\u3002", { size: 21 }),
        createResearchDocTable(
          ["\u9879\u76EE", "\u5185\u5BB9"],
          [
            ["\u4F18\u5148\u63A5\u5165\u8868", formatDocInlineList(ingestionInsight.recommendedTables || recommendations.recommendedTables || [])],
            ["\u5EFA\u8BAE\u6682\u7F13\u8868", formatDocInlineList(ingestionInsight.deferredTables || recommendations.deferredTables || [])]
          ],
          { widths: [24, 76], fontSize: 17 }
        ),
        createResearchDocParagraph("\u63A5\u5165\u7B56\u7565\u5EFA\u8BAE", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
        ...createResearchDocBulletList(ingestionInsight.ingestionSuggestions || recommendations.ingestionSuggestions || [])
      );
      if (Array.isArray(ingestionInsight.tableModes) && ingestionInsight.tableModes.length) {
        children.push(createResearchDocTable(
          ["\u8868\u540D", "\u63A5\u5165\u6A21\u5F0F", "\u539F\u56E0", "\u98CE\u9669"],
          ingestionInsight.tableModes.slice(0, 100).map((item) => [
            item.tableName || "-",
            item.mode || "-",
            item.reason || "-",
            item.risk || "-"
          ]),
          { widths: [24, 16, 36, 24], fontSize: 16, codeFontSize: 14, codeColumns: [0] }
        ));
      }
      children.push(
        createResearchDocParagraph("7. \u6CBB\u7406\u5EFA\u8BAE", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 180, after: 140 }),
        createResearchDocParagraph(governanceInsight.summary || "\u6CBB\u7406\u5EFA\u8BAE\u8986\u76D6\u63A5\u5165\u524D\u5FC5\u987B\u5904\u7406\u9879\u548C\u63A5\u5165\u540E\u6301\u7EED\u4F18\u5316\u9879\u3002", { size: 21 }),
        createResearchDocParagraph("\u63A5\u5165\u524D\u5FC5\u987B\u5904\u7406", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
        ...createResearchDocBulletList(governanceInsight.mustFixBeforeIngestion || []),
        createResearchDocParagraph("\u63A5\u5165\u540E\u6301\u7EED\u4F18\u5316", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
        ...createResearchDocBulletList(governanceInsight.continuousImprovements || []),
        createResearchDocParagraph("\u6CBB\u7406\u5EFA\u8BAE", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
        ...createResearchDocBulletList(governanceInsight.governanceSuggestions || recommendations.governanceSuggestions || [])
      );
      if (Array.isArray(governanceInsight.tableTasks) && governanceInsight.tableTasks.length) {
        children.push(createResearchDocTable(
          ["\u8868\u540D", "\u95EE\u9898\u7C7B\u578B", "\u4F18\u5148\u7EA7", "\u6CBB\u7406\u52A8\u4F5C"],
          governanceInsight.tableTasks.slice(0, 100).map((item) => [
            item.tableName || "-",
            formatDocIssueTypes(item.issueTypes || []),
            DOC_PRIORITY_LABELS[item.priority] || item.priority || "-",
            item.action || "-"
          ]),
          { widths: [24, 28, 12, 36], fontSize: 16, codeFontSize: 14, codeColumns: [0] }
        ));
      }
      children.push(
        createResearchDocParagraph("8. \u5206\u6790\u5EFA\u8BAE", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 180, after: 140 }),
        createResearchDocParagraph(analysisInsight.summary || "\u5206\u6790\u5EFA\u8BAE\u57FA\u4E8E\u8868\u5206\u7C7B\u3001\u5B57\u6BB5\u8BED\u4E49\u3001\u8D28\u91CF\u98CE\u9669\u548C\u8868\u5173\u7CFB\u751F\u6210\u3002", { size: 21 })
      );
      if (Array.isArray(analysisInsight.coreBusinessTables) && analysisInsight.coreBusinessTables.length) {
        children.push(createResearchDocParagraph("\u6838\u5FC3\u4E1A\u52A1\u8868\u5206\u6790\u5EFA\u8BAE", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }));
        children.push(createResearchDocTable(
          ["\u6838\u5FC3\u4E1A\u52A1\u8868", "\u9009\u62E9\u4F9D\u636E", "\u53EF\u505A\u5206\u6790", "\u53EF\u7528\u7EF4\u5EA6/\u5B57\u6BB5", "\u5206\u6790\u4EF7\u503C"],
          analysisInsight.coreBusinessTables.slice(0, 30).map((item) => [
            item.tableName || "-",
            item.reason || "-",
            formatDocInlineList(item.suggestedSubjects || []),
            formatDocInlineList(item.dimensions || []),
            item.analysisValue || "-"
          ]),
          { widths: [18, 24, 22, 18, 18], fontSize: 16, codeFontSize: 14, codeColumns: [0, 3] }
        ));
      }
      if (Array.isArray(analysisInsight.analysisDirections) && analysisInsight.analysisDirections.length) {
        children.push(createResearchDocParagraph("\u6DF1\u5EA6\u5206\u6790\u65B9\u5411", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }));
        children.push(createResearchDocTable(
          ["\u5206\u6790\u65B9\u5411", "\u6838\u5FC3\u8868", "\u6307\u6807\u53E3\u5F84", "\u5206\u6790\u7EF4\u5EA6", "\u6837\u4F8B\u8BC1\u636E", "\u62A5\u8868\u5EFA\u8BAE"],
          analysisInsight.analysisDirections.slice(0, 40).map((item) => [
            item.direction || "-",
            item.coreTable || "-",
            formatDocInlineList(item.measures || []),
            formatDocInlineList(item.dimensions || []),
            formatDocInlineList(item.sampleEvidence || []),
            formatDocInlineList(item.outputSuggestions || [])
          ]),
          { widths: [16, 15, 17, 18, 20, 14], fontSize: 15, codeFontSize: 13, codeColumns: [1, 3] }
        ));
      }
      if (Array.isArray(analysisInsight.analysisThemes) && analysisInsight.analysisThemes.length) {
        children.push(createResearchDocParagraph("\u4E1A\u52A1\u5206\u6790\u4E3B\u9898", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }));
        children.push(createResearchDocTable(
          ["\u5206\u6790\u4E3B\u9898", "\u76F8\u5173\u8868", "\u5173\u952E\u5B57\u6BB5", "\u5206\u6790\u4EF7\u503C", "\u9650\u5236"],
          analysisInsight.analysisThemes.slice(0, 60).map((item) => [
            item.theme || "-",
            formatDocInlineList(item.tables || []),
            formatDocInlineList(item.keyFields || []),
            item.value || "-",
            formatDocInlineList(item.limitations || [])
          ]),
          { widths: [16, 24, 20, 24, 16], fontSize: 16, codeFontSize: 14, codeColumns: [1, 2] }
        ));
      }
      children.push(
        createResearchDocParagraph("\u5206\u6790\u5EFA\u8BAE", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
        ...createResearchDocBulletList(analysisInsight.analysisSuggestions || recommendations.analysisSuggestions || []),
        createResearchDocParagraph("\u6301\u7EED\u5173\u6CE8\u9879", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
        ...createResearchDocBulletList(analysisInsight.watchItems || []),
        createResearchDocParagraph("\u5F85\u4E1A\u52A1\u786E\u8BA4", { heading: HeadingLevel.HEADING_2, bold: true, size: 23, before: 120, after: 90 }),
        ...createResearchDocBulletList(analysisInsight.followUpQuestions || [])
      );
      if (Array.isArray(report.analysisBatches) && report.analysisBatches.length > 0) {
        children.push(
          createResearchDocParagraph("9. AI \u5206\u6790\u6279\u6B21", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 160, after: 140 }),
          createResearchDocTable(
            ["\u9636\u6BB5", "\u6279\u6B21", "\u8868\u6570", "\u72B6\u6001", "\u8017\u65F6(ms)", "\u9519\u8BEF\u4FE1\u606F"],
            report.analysisBatches.map((item) => [
              DOC_STAGE_LABELS[item.stageKey] || item.stageKey || "-",
              String(item.batchNo ?? "-"),
              String(item.batchSize ?? "-"),
              item.status || "-",
              String(item.durationMs ?? "-"),
              item.errorMessage || "-"
            ]),
            { widths: [22, 8, 8, 12, 14, 36], fontSize: 17 }
          )
        );
      }
      children.push(
        createResearchDocParagraph("\u9644\u5F55\uFF1A\u5B57\u6BB5\u660E\u7EC6", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, pageBreakBefore: true, before: 120, after: 140 }),
        createResearchDocParagraph("\u5B57\u6BB5\u660E\u7EC6\u6309\u8868\u5C55\u5F00\uFF0C\u957F\u5B57\u6BB5\u8868\u5EFA\u8BAE\u5728\u5E73\u53F0\u9875\u9762\u5185\u7EE7\u7EED\u67E5\u770B\u5B8C\u6574\u4EA4\u4E92\u7ED3\u679C\u3002", { size: 20, color: "64748B" })
      );
      tables.forEach((table, tableIndex) => {
        const fields = Array.isArray(table.fieldProfiles) && table.fieldProfiles.length ? table.fieldProfiles : table.columns || [];
        children.push(
          createResearchDocParagraph(`${tableIndex + 1}. ${table.tableName || `\u8868${tableIndex + 1}`}`, {
            heading: HeadingLevel.HEADING_2,
            bold: true,
            size: 23,
            before: 150,
            after: 100
          }),
          createResearchDocTable(
            ["\u5B57\u6BB5\u540D", "\u7C7B\u578B", "\u4E3B\u952E", "\u53EF\u7A7A", "\u5B57\u6BB5\u6CE8\u91CA", "\u95EE\u9898\u7C7B\u578B"],
            fields.map((field) => [
              field.columnName || "-",
              field.dataType || field.columnType || "-",
              field.isPrimaryKey ? "\u662F" : "\u5426",
              field.isNullable === void 0 ? "-" : field.isNullable ? "\u662F" : "\u5426",
              field.columnComment || "-",
              formatDocIssueTypes(field.issueTags || [])
            ]),
            { widths: [22, 15, 7, 7, 35, 14], fontSize: 16, codeFontSize: 14, codeColumns: [0, 1] }
          )
        );
      });
      const document = new Document({
        sections: [
          {
            properties: {
              page: {
                size: {
                  orientation: PageOrientation.LANDSCAPE
                },
                margin: {
                  top: 720,
                  right: 720,
                  bottom: 720,
                  left: 720
                }
              }
            },
            children
          }
        ]
      });
      return Packer.toBuffer(document);
    }
    function buildSummaryText(source, tables, recommendedTables, deferredTables) {
      const businessCount = tables.filter((item) => item.category === "business").length;
      const dictCount = tables.filter((item) => item.category === "dictionary").length;
      const issueCount = tables.reduce((sum, item) => sum + item.metadataIssues.length, 0);
      return `${source.sourceName} \u5171\u8C03\u7814 ${tables.length} \u5F20\u8868\uFF0C\u8BC6\u522B\u4E1A\u52A1\u8868 ${businessCount} \u5F20\u3001\u5B57\u5178\u8868 ${dictCount} \u5F20\u3002\u5EFA\u8BAE\u4F18\u5148\u63A5\u5165 ${recommendedTables.length} \u5F20\u8868\uFF0C\u6682\u7F13 ${deferredTables.length} \u5F20\u8868\uFF0C\u7D2F\u8BA1\u53D1\u73B0 ${issueCount} \u9879\u5143\u6570\u636E\u6216\u8D28\u91CF\u63D0\u793A\u3002`;
    }
    function normalizeSummaryText(text, maxLength = 4e3) {
      const normalized = String(text || "").trim();
      if (!normalized) {
        return "";
      }
      return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
    }
    function buildGovernanceSuggestions(tables = []) {
      const suggestions = [];
      if (tables.some((item) => item.metadataIssues.some((issue) => issue.includes("\u7F3A\u5C11\u4E3B\u952E")))) {
        suggestions.push("\u4F18\u5148\u8865\u9F50\u4E3B\u952E\u6216\u4E1A\u52A1\u552F\u4E00\u952E\u5B9A\u4E49\uFF0C\u907F\u514D\u540E\u7EED\u589E\u91CF\u540C\u6B65\u548C\u53BB\u91CD\u5931\u771F\u3002");
      }
      if (tables.some((item) => item.metadataIssues.some((issue) => issue.includes("\u5B57\u6BB5\u6CE8\u91CA\u7F3A\u5931")))) {
        suggestions.push("\u5EFA\u8BAE\u5728\u63A5\u5165\u524D\u8865\u9F50\u8868\u6CE8\u91CA\u548C\u5B57\u6BB5\u6CE8\u91CA\uFF0C\u964D\u4F4E\u5B57\u6BB5\u6620\u5C04\u6210\u672C\u3002");
      }
      if (tables.some((item) => item.metadataIssues.includes("\u7F3A\u5C11\u660E\u663E\u589E\u91CF\u5B57\u6BB5"))) {
        suggestions.push("\u5BF9\u4E8E\u7F3A\u5C11\u66F4\u65B0\u65F6\u95F4\u5B57\u6BB5\u7684\u8868\uFF0C\u9700\u63D0\u524D\u786E\u8BA4\u5168\u91CF\u540C\u6B65\u7A97\u53E3\u6216\u8865\u5145\u5BA1\u8BA1\u5B57\u6BB5\u3002");
      }
      return suggestions;
    }
    function buildIngestionSuggestions(tables = []) {
      const suggestions = [];
      const highPriorityTables = tables.filter((item) => item.priority === "high");
      if (highPriorityTables.length > 0) {
        suggestions.push(`\u5EFA\u8BAE\u4F18\u5148\u56F4\u7ED5 ${highPriorityTables.slice(0, 5).map((item) => item.tableName).join("\u3001")} \u6784\u5EFA\u9996\u6279\u63A5\u5165\u4EFB\u52A1\u3002`);
      }
      if (tables.some((item) => item.incrementalColumn)) {
        suggestions.push("\u4F18\u5148\u9009\u62E9\u5B58\u5728\u66F4\u65B0\u65F6\u95F4\u6216\u521B\u5EFA\u65F6\u95F4\u5B57\u6BB5\u7684\u8868\u8D70\u589E\u91CF\u63A5\u5165\uFF0C\u51CF\u5C11\u5168\u91CF\u91CD\u5237\u6210\u672C\u3002");
      } else {
        suggestions.push("\u5F53\u524D\u672A\u8BC6\u522B\u5230\u7A33\u5B9A\u589E\u91CF\u5B57\u6BB5\uFF0C\u5EFA\u8BAE\u9996\u6279\u4EFB\u52A1\u91C7\u7528\u5168\u91CF\u6216\u4EBA\u5DE5\u786E\u8BA4\u589E\u91CF\u7B56\u7565\u3002");
      }
      if (tables.some((item) => item.category === "dictionary")) {
        suggestions.push("\u5B57\u5178\u8868\u53EF\u4F5C\u4E3A\u9644\u5C5E\u4EFB\u52A1\u540C\u6B65\uFF0C\u4F18\u5148\u4FDD\u8BC1\u4E1A\u52A1\u8868\u4E0E\u5B57\u5178\u7F16\u7801\u53E3\u5F84\u4E00\u81F4\u3002");
      }
      return suggestions;
    }
    var FIELD_ISSUE_LABELS = {
      missing_comment: "\u5B57\u6BB5\u6CE8\u91CA\u7F3A\u5931",
      high_null_rate: "\u9AD8\u7A7A\u503C\u7387",
      low_cardinality: "\u4F4E\u57FA\u6570\u5B57\u6BB5",
      high_cardinality: "\u9AD8\u57FA\u6570\u5B57\u6BB5"
    };
    function translateFieldIssueTag(tag) {
      return FIELD_ISSUE_LABELS[String(tag || "").trim()] || String(tag || "").trim() || "\u5176\u4ED6\u95EE\u9898";
    }
    function collectIssueTypeStats(issueGroups = []) {
      const map = /* @__PURE__ */ new Map();
      for (const issueTypes of issueGroups) {
        uniqueStrings(issueTypes).forEach((issueType) => {
          map.set(issueType, Number(map.get(issueType) || 0) + 1);
        });
      }
      return Array.from(map.entries()).map(([issueType, count]) => ({ issueType, count }));
    }
    function buildQualityInsights(tables = []) {
      const fieldFindings = [];
      const tableFindings = [];
      for (const table of tables) {
        const tableIssueTypes = uniqueStrings([
          ...table.metadataIssues || [],
          ...!table.incrementalColumn ? ["\u7F3A\u5C11\u589E\u91CF\u5B57\u6BB5"] : []
        ]);
        if (tableIssueTypes.length) {
          tableFindings.push({
            tableName: table.tableName,
            issueTypes: tableIssueTypes,
            evidence: tableIssueTypes,
            suggestion: tableIssueTypes.some((item) => item.includes("\u5B57\u6BB5\u6CE8\u91CA") || item.includes("\u8868\u6CE8\u91CA")) ? "\u8865\u9F50\u8868\u548C\u5B57\u6BB5\u4E1A\u52A1\u8BF4\u660E\u540E\u518D\u6C89\u6DC0\u5230\u6570\u636E\u8D44\u4EA7\u76EE\u5F55\u3002" : "\u63A5\u5165\u524D\u786E\u8BA4\u4E3B\u952E\u3001\u589E\u91CF\u53E3\u5F84\u548C\u8D28\u91CF\u98CE\u9669\u5904\u7406\u65B9\u5F0F\u3002"
          });
        }
        for (const field of table.fieldProfiles || []) {
          const issueTypes = uniqueStrings((field.issueTags || []).map(translateFieldIssueTag));
          if (!issueTypes.length) continue;
          const evidence = [];
          if (typeof field.nullRate === "number") evidence.push(`\u7A7A\u503C\u7387 ${Math.round(field.nullRate * 1e4) / 100}%`);
          if (typeof field.distinctRatio === "number") evidence.push(`\u53BB\u91CD\u7387 ${Math.round(field.distinctRatio * 1e4) / 100}%`);
          if (!field.columnComment) evidence.push("\u5B57\u6BB5\u6CE8\u91CA\u4E3A\u7A7A");
          fieldFindings.push({
            tableName: table.tableName,
            columnName: field.columnName,
            issueTypes,
            evidence: uniqueStrings(evidence),
            suggestion: issueTypes.includes("\u5B57\u6BB5\u6CE8\u91CA\u7F3A\u5931") ? "\u8865\u5145\u5B57\u6BB5\u4E1A\u52A1\u542B\u4E49\u548C\u53E3\u5F84\u8BF4\u660E\u3002" : "\u786E\u8BA4\u5B57\u6BB5\u8D28\u91CF\u89C4\u5219\u548C\u4E1A\u52A1\u53EF\u7528\u6027\u3002"
          });
        }
      }
      const issueTypeStats = collectIssueTypeStats([
        ...tableFindings.map((item) => item.issueTypes),
        ...fieldFindings.map((item) => item.issueTypes)
      ]);
      return {
        summary: `\u8BC6\u522B ${tableFindings.length} \u5F20\u8868\u5B58\u5728\u8868\u7EA7\u8D28\u91CF\u6216\u5143\u6570\u636E\u95EE\u9898\uFF0C${fieldFindings.length} \u4E2A\u5B57\u6BB5\u5B58\u5728\u5B57\u6BB5\u7EA7\u8D28\u91CF\u63D0\u793A\u3002`,
        issueTypeStats,
        tableFindings: tableFindings.slice(0, 100),
        fieldFindings: fieldFindings.slice(0, 300),
        suggestions: uniqueStrings([
          ...buildGovernanceSuggestions(tables),
          "\u5BF9\u9AD8\u7A7A\u503C\u7387\u3001\u4F4E\u57FA\u6570\u548C\u9AD8\u57FA\u6570\u5B57\u6BB5\u8865\u5145\u5B57\u6BB5\u7EA7\u8D28\u91CF\u89C4\u5219\uFF0C\u533A\u5206\u5B57\u5178\u503C\u3001\u679A\u4E3E\u503C\u548C\u4E1A\u52A1\u552F\u4E00\u6807\u8BC6\u3002"
        ])
      };
    }
    function buildIngestionAdviceInsight(tables = [], recommendedTables = [], deferredTables = []) {
      const tableModes = tables.filter((item) => recommendedTables.includes(item.tableName) || deferredTables.includes(item.tableName) || item.priority === "high").map((item) => ({
        tableName: item.tableName,
        mode: item.suggestedMode || (item.incrementalColumn ? "incremental" : "full"),
        reason: item.incrementalColumn ? `\u8BC6\u522B\u5230\u589E\u91CF\u5B57\u6BB5 ${item.incrementalColumn}` : "\u672A\u8BC6\u522B\u7A33\u5B9A\u589E\u91CF\u5B57\u6BB5\uFF0C\u5EFA\u8BAE\u5148\u6309\u5168\u91CF\u6216\u4EBA\u5DE5\u786E\u8BA4\u6A21\u5F0F\u63A5\u5165\u3002",
        risk: (item.risks || []).slice(0, 2).join("\uFF1B") || "-"
      }));
      return {
        summary: `\u5EFA\u8BAE\u4F18\u5148\u63A5\u5165 ${recommendedTables.length} \u5F20\u8868\uFF0C\u6682\u7F13 ${deferredTables.length} \u5F20\u8868\uFF0C\u5E76\u6309\u589E\u91CF\u5B57\u6BB5\u3001\u8D28\u91CF\u98CE\u9669\u548C\u8868\u5173\u7CFB\u62C6\u5206\u63A5\u5165\u6279\u6B21\u3002`,
        recommendedTables,
        deferredTables,
        tableModes,
        ingestionSuggestions: buildIngestionSuggestions(tables)
      };
    }
    function buildGovernanceAdviceInsight(tables = []) {
      const tableTasks = tables.filter((item) => item.metadataIssues?.length || item.risks?.length).map((item) => ({
        tableName: item.tableName,
        issueTypes: uniqueStrings([...item.metadataIssues || [], ...item.risks || []]),
        priority: item.priority === "high" ? "high" : "medium",
        action: item.metadataIssues?.some((issue) => issue.includes("\u5B57\u6BB5\u6CE8\u91CA") || issue.includes("\u8868\u6CE8\u91CA")) ? "\u8865\u9F50\u5143\u6570\u636E\u8BF4\u660E\u3001\u5B57\u6BB5\u53E3\u5F84\u548C\u8D1F\u8D23\u4EBA\u540E\u7EB3\u5165\u8D44\u4EA7\u76EE\u5F55\u3002" : "\u786E\u8BA4\u4E3B\u952E\u3001\u589E\u91CF\u5B57\u6BB5\u548C\u8D28\u91CF\u89C4\u5219\u540E\u518D\u8FDB\u5165\u7A33\u5B9A\u63A5\u5165\u3002"
      }));
      return {
        summary: `\u8BC6\u522B ${tableTasks.length} \u5F20\u8868\u9700\u8981\u6CBB\u7406\u52A8\u4F5C\uFF0C\u4F18\u5148\u5904\u7406\u9AD8\u4F18\u5148\u7EA7\u8868\u7684\u4E3B\u952E\u3001\u6CE8\u91CA\u3001\u589E\u91CF\u5B57\u6BB5\u548C\u8D28\u91CF\u89C4\u5219\u3002`,
        mustFixBeforeIngestion: tableTasks.filter((item) => item.priority === "high").slice(0, 20).map((item) => `${item.tableName}\uFF1A${item.action}`),
        continuousImprovements: [
          "\u5EFA\u7ACB\u8868\u6CE8\u91CA\u3001\u5B57\u6BB5\u6CE8\u91CA\u3001\u4E3B\u952E\u3001\u589E\u91CF\u5B57\u6BB5\u7684\u63A5\u5165\u524D\u68C0\u67E5\u6E05\u5355\u3002",
          "\u5C06\u9AD8\u7A7A\u503C\u7387\u3001\u679A\u4E3E\u503C\u6F02\u79FB\u548C\u552F\u4E00\u6027\u98CE\u9669\u7EB3\u5165\u540E\u7EED\u8D28\u91CF\u76D1\u63A7\u3002"
        ],
        tableTasks: tableTasks.slice(0, 100),
        governanceSuggestions: buildGovernanceSuggestions(tables)
      };
    }
    function buildAnalysisAdviceInsight(tables = [], tableRelationships = null) {
      function fieldLabel(fieldName) {
        const lower = String(fieldName || "").toLowerCase();
        if (/(status|state|flag|result)/i.test(lower)) return "\u72B6\u6001";
        if (/(type|kind|category|level|grade)/i.test(lower)) return "\u7C7B\u578B";
        if (/(code|no|num|number)$/i.test(lower)) return "\u7F16\u7801";
        if (/(date|time|created|updated|apply|approval|reg)/i.test(lower)) return "\u65F6\u95F4";
        if (/(region|city|area|county|province|dept|office|org)/i.test(lower)) return "\u533A\u57DF/\u673A\u6784";
        return "\u7EF4\u5EA6";
      }
      function buildSampleEvidence(table, fields = []) {
        return fields.slice(0, 6).map((fieldName) => {
          const field = (table.fieldProfiles || []).find((item) => item.columnName === fieldName);
          const samples = Array.isArray(field?.sampleValues) ? field.sampleValues.slice(0, 3).join("\u3001") : "";
          const comment = field?.columnComment ? `\uFF08${field.columnComment}\uFF09` : "";
          return `${fieldName}${comment}${samples ? ` \u6837\u4F8B\uFF1A${samples}` : ""}`;
        });
      }
      const businessTables = tables.filter((item) => item.category === "business").sort((left, right) => {
        const priorityWeight = { high: 1, medium: 2, low: 3 };
        const leftPriority = priorityWeight[left.priority] || 9;
        const rightPriority = priorityWeight[right.priority] || 9;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return Number(right.rowCount || 0) - Number(left.rowCount || 0);
      }).slice(0, 6);
      const dictionaryTables = tables.filter((item) => item.category === "dictionary").slice(0, 8);
      const analysisThemes = [];
      const analysisDirections = [];
      const relations = Array.isArray(tableRelationships?.relations) ? tableRelationships.relations : [];
      const relatedTableMap = /* @__PURE__ */ new Map();
      relations.forEach((relation) => {
        if (relation.fromTable && relation.toTable) {
          relatedTableMap.set(relation.fromTable, uniqueStrings([...relatedTableMap.get(relation.fromTable) || [], relation.toTable]));
          relatedTableMap.set(relation.toTable, uniqueStrings([...relatedTableMap.get(relation.toTable) || [], relation.fromTable]));
        }
      });
      const coreBusinessTables = businessTables.map((table) => {
        const summary = table.fieldSummary || {};
        const dimensions = uniqueStrings([
          ...summary.timeFields || [],
          ...summary.statusLikeFields || [],
          ...summary.typeLikeFields || [],
          ...summary.codeLikeFields || [],
          ...summary.nameLikeFields || [],
          ...relatedTableMap.get(table.tableName) || []
        ]).slice(0, 10);
        const suggestedSubjects = uniqueStrings([
          ...summary.timeFields?.length ? ["\u4E1A\u52A1\u91CF\u8D8B\u52BF\u5206\u6790"] : [],
          ...summary.statusLikeFields?.length ? ["\u72B6\u6001\u5206\u5E03\u4E0E\u5F02\u5E38\u72B6\u6001\u76D1\u6D4B"] : [],
          ...summary.typeLikeFields?.length || summary.codeLikeFields?.length ? ["\u4E1A\u52A1\u7C7B\u578B/\u7F16\u7801\u7EF4\u5EA6\u5206\u5E03\u5206\u6790"] : [],
          ...relatedTableMap.get(table.tableName)?.length ? ["\u5173\u8054\u7EF4\u8868\u4E0B\u94BB\u5206\u6790"] : [],
          "\u6838\u5FC3\u660E\u7EC6\u8FFD\u8E2A\u4E0E\u5F02\u5E38\u6837\u672C\u5B9A\u4F4D"
        ]).slice(0, 6);
        return {
          tableName: table.tableName,
          reason: `${table.priority === "high" ? "\u9AD8\u4F18\u5148\u7EA7\u4E1A\u52A1\u8868" : "\u4E1A\u52A1\u4E3B\u8868"}\uFF0C\u884C\u6570 ${table.rowCount ?? "-"}\uFF0C\u5B57\u6BB5 ${table.columnCount ?? "-"} \u4E2A\u3002`,
          analysisValue: "\u53EF\u4F5C\u4E3A\u4E1A\u52A1\u5206\u6790\u4E3B\u8868\uFF0C\u627F\u8F7D\u8D8B\u52BF\u3001\u5206\u5E03\u3001\u72B6\u6001\u3001\u7EF4\u5EA6\u62C6\u5206\u548C\u5F02\u5E38\u660E\u7EC6\u8FFD\u8E2A\u7C7B\u5206\u6790\u3002",
          suggestedSubjects,
          dimensions
        };
      });
      if (businessTables.length) {
        businessTables.forEach((table) => {
          const summary = table.fieldSummary || {};
          const timeFields = summary.timeFields || [];
          const statusFields = summary.statusLikeFields || [];
          const typeFields = summary.typeLikeFields || [];
          const codeFields = summary.codeLikeFields || [];
          const nameFields = summary.nameLikeFields || [];
          const keyFields = uniqueStrings([
            ...timeFields,
            ...statusFields,
            ...typeFields,
            ...codeFields
          ]).slice(0, 10);
          const dimensions = uniqueStrings([
            ...statusFields.map((item) => `${item}\uFF08${fieldLabel(item)}\u5206\u5E03\uFF09`),
            ...typeFields.map((item) => `${item}\uFF08${fieldLabel(item)}\u5206\u5E03\uFF09`),
            ...codeFields.slice(0, 4).map((item) => `${item}\uFF08\u7F16\u7801\u7EF4\u5EA6\uFF09`),
            ...nameFields.slice(0, 4).map((item) => `${item}\uFF08\u540D\u79F0/\u63CF\u8FF0\u7EF4\u5EA6\uFF09`),
            ...(relatedTableMap.get(table.tableName) || []).map((item) => `${item} \u5173\u8054\u4E0B\u94BB`)
          ]).slice(0, 10);
          const measures = uniqueStrings([
            "\u8BB0\u5F55\u6570/\u4E1A\u52A1\u91CF",
            ...timeFields.length ? ["\u6309\u65E5/\u5468/\u6708\u65B0\u589E\u91CF", "\u5904\u7406\u5468\u671F\u6216\u767B\u8BB0\u5468\u671F"] : [],
            ...statusFields.length ? ["\u5404\u72B6\u6001\u6570\u91CF\u5360\u6BD4", "\u5F02\u5E38\u72B6\u6001\u6570\u91CF"] : [],
            ...table.incrementalColumn ? [`\u57FA\u4E8E ${table.incrementalColumn} \u7684\u589E\u91CF\u53D8\u5316\u91CF`] : []
          ]).slice(0, 8);
          analysisDirections.push({
            direction: `${table.tableComment || table.tableName}\u6838\u5FC3\u4E1A\u52A1\u5206\u6790`,
            coreTable: table.tableName,
            relatedTables: (relatedTableMap.get(table.tableName) || []).slice(0, 6),
            measures,
            dimensions,
            sampleEvidence: buildSampleEvidence(table, keyFields),
            analysisQuestions: uniqueStrings([
              `\u53EF\u4EE5\u89C2\u5BDF ${table.tableComment || table.tableName} \u7684\u4E1A\u52A1\u91CF\u8D8B\u52BF\u548C\u5468\u671F\u6CE2\u52A8\u5417\uFF1F`,
              ...statusFields.length ? ["\u4E0D\u540C\u72B6\u6001\u7684\u5360\u6BD4\u3001\u79EF\u538B\u548C\u5F02\u5E38\u72B6\u6001\u662F\u5426\u7A33\u5B9A\uFF1F"] : [],
              ...dimensions.length ? ["\u4E0D\u540C\u7EF4\u5EA6\u4E0B\u4E1A\u52A1\u91CF\u548C\u5F02\u5E38\u5206\u5E03\u662F\u5426\u5B58\u5728\u660E\u663E\u5DEE\u5F02\uFF1F"] : [],
              ...relatedTableMap.get(table.tableName)?.length ? ["\u5173\u8054\u7EF4\u8868\u4E0B\u94BB\u540E\uFF0C\u673A\u6784\u3001\u533A\u57DF\u6216\u7F16\u7801\u53E3\u5F84\u662F\u5426\u4E00\u81F4\uFF1F"] : []
            ]).slice(0, 6),
            outputSuggestions: uniqueStrings([
              "\u6838\u5FC3\u6307\u6807\u5361\uFF1A\u603B\u91CF\u3001\u589E\u91CF\u3001\u5F02\u5E38\u91CF\u3001\u6700\u65B0\u66F4\u65B0\u65F6\u95F4\u3002",
              ...timeFields.length ? ["\u8D8B\u52BF\u56FE\uFF1A\u6309\u767B\u8BB0/\u521B\u5EFA/\u66F4\u65B0\u65F6\u95F4\u5C55\u793A\u4E1A\u52A1\u91CF\u53D8\u5316\u3002"] : [],
              ...statusFields.length || typeFields.length ? ["\u5206\u5E03\u56FE\uFF1A\u6309\u72B6\u6001\u3001\u7C7B\u578B\u3001\u7F16\u7801\u5C55\u793A\u5360\u6BD4\u548C\u5F02\u5E38\u5206\u5E03\u3002"] : [],
              "\u660E\u7EC6\u8868\uFF1A\u4FDD\u7559\u4E3B\u952E\u3001\u65F6\u95F4\u3001\u72B6\u6001\u3001\u7F16\u7801\u548C\u5173\u952E\u8BF4\u660E\u5B57\u6BB5\u7528\u4E8E\u8FFD\u6EAF\u3002"
            ]).slice(0, 6),
            caveats: uniqueStrings([
              "\u9700\u8981\u4E1A\u52A1\u786E\u8BA4\u7EDF\u8BA1\u65F6\u95F4\u5B57\u6BB5\u548C\u4E3B\u6307\u6807\u53E3\u5F84\u3002",
              ...statusFields.length ? ["\u72B6\u6001\u7F16\u7801\u9700\u8981\u4E0E\u5B57\u5178\u8868\u6216\u4E1A\u52A1\u53E3\u5F84\u5BF9\u9F50\u3002"] : [],
              ...table.metadataIssues?.length ? ["\u5B58\u5728\u5143\u6570\u636E\u6216\u8D28\u91CF\u95EE\u9898\uFF0C\u5206\u6790\u524D\u9700\u590D\u6838\u5B57\u6BB5\u542B\u4E49\u3002"] : []
            ]).slice(0, 6)
          });
          analysisThemes.push({
            theme: `${table.tableComment || table.tableName}\u4E1A\u52A1\u5206\u6790`,
            tables: uniqueStrings([table.tableName, ...(relatedTableMap.get(table.tableName) || []).slice(0, 4)]),
            keyFields,
            value: "\u7ED3\u5408\u5B57\u6BB5\u6837\u4F8B\u3001\u65F6\u95F4\u5B57\u6BB5\u3001\u72B6\u6001/\u7C7B\u578B\u5B57\u6BB5\u548C\u5173\u8054\u8868\uFF0C\u5F62\u6210\u4E1A\u52A1\u91CF\u8D8B\u52BF\u3001\u72B6\u6001\u5206\u5E03\u3001\u7EF4\u5EA6\u62C6\u5206\u548C\u5F02\u5E38\u660E\u7EC6\u8FFD\u8E2A\u5206\u6790\u3002",
            limitations: ["\u9700\u786E\u8BA4\u4E1A\u52A1\u6307\u6807\u53E3\u5F84\u3001\u4E3B\u952E\u552F\u4E00\u6027\u3001\u65F6\u95F4\u5B57\u6BB5\u542B\u4E49\u548C\u72B6\u6001\u7F16\u7801\u89E3\u91CA\u3002"]
          });
        });
      }
      if (dictionaryTables.length) {
        analysisThemes.push({
          theme: "\u5B57\u5178\u53E3\u5F84\u6821\u9A8C",
          tables: dictionaryTables.map((item) => item.tableName),
          keyFields: uniqueStrings(dictionaryTables.flatMap((item) => [...item.fieldSummary?.codeLikeFields || [], ...item.fieldSummary?.nameLikeFields || []])).slice(0, 10),
          value: "\u7528\u4E8E\u652F\u6491\u4E1A\u52A1\u8868\u7F16\u7801\u7FFB\u8BD1\u3001\u72B6\u6001\u89E3\u91CA\u548C\u7EF4\u5EA6\u8FC7\u6EE4\u3002",
          limitations: ["\u9700\u4FDD\u8BC1\u5B57\u5178\u7F16\u7801\u4E0E\u4E1A\u52A1\u8868\u5F15\u7528\u5B57\u6BB5\u4E00\u81F4\u3002"]
        });
      }
      return {
        summary: `\u56F4\u7ED5 ${coreBusinessTables.length} \u5F20\u6838\u5FC3\u4E1A\u52A1\u8868\u5F62\u6210 ${analysisThemes.length} \u7C7B\u4E1A\u52A1\u5206\u6790\u4E3B\u9898\uFF0C\u8868\u5173\u7CFB ${tableRelationships?.relations?.length || 0} \u6761\u53EF\u7528\u4E8E\u5173\u8054\u4E0B\u94BB\u548C\u7EF4\u5EA6\u89E3\u91CA\u3002`,
        coreBusinessTables,
        analysisDirections: analysisDirections.slice(0, 30),
        analysisThemes: analysisThemes.slice(0, 20),
        watchItems: [
          "\u5173\u6CE8\u4E1A\u52A1\u8868\u884C\u6570\u3001\u589E\u91CF\u5B57\u6BB5\u548C\u9AD8\u7A7A\u503C\u5B57\u6BB5\u7684\u6279\u6B21\u53D8\u5316\u3002",
          "\u5173\u6CE8\u8868\u5173\u7CFB\u65B0\u589E\u3001\u6D88\u5931\u6216\u7F6E\u4FE1\u5EA6\u4E0B\u964D\u5BF9\u62A5\u8868\u5173\u8054\u53E3\u5F84\u7684\u5F71\u54CD\u3002"
        ],
        followUpQuestions: [
          "\u6838\u5FC3\u4E1A\u52A1\u6307\u6807\u53E3\u5F84\u548C\u7EDF\u8BA1\u5468\u671F\u662F\u5426\u5DF2\u6709\u7EDF\u4E00\u5B9A\u4E49\uFF1F",
          "\u5B57\u5178\u8868\u7F16\u7801\u662F\u5426\u4E0E\u4E1A\u52A1\u8868\u5B57\u6BB5\u4FDD\u6301\u4E00\u4E00\u5BF9\u5E94\uFF1F"
        ],
        analysisSuggestions: [
          "\u4F18\u5148\u56F4\u7ED5\u6838\u5FC3\u4E1A\u52A1\u8868\u5EFA\u7ACB\u4E1A\u52A1\u91CF\u8D8B\u52BF\u3001\u72B6\u6001\u5206\u5E03\u3001\u7EF4\u5EA6\u62C6\u5206\u548C\u5F02\u5E38\u660E\u7EC6\u8FFD\u8E2A\u62A5\u8868\u3002",
          "\u5C06\u5B57\u5178\u8868\u4F5C\u4E3A\u7EF4\u5EA6\u89E3\u91CA\u5C42\uFF0C\u7528\u4E8E\u7F16\u7801\u7FFB\u8BD1\u3001\u72B6\u6001\u89E3\u91CA\u548C\u62A5\u8868\u7B5B\u9009\u6761\u4EF6\u3002",
          "\u5BF9\u6838\u5FC3\u4E1A\u52A1\u8868\u5148\u786E\u8BA4\u7EDF\u8BA1\u65F6\u95F4\u5B57\u6BB5\u3001\u4E1A\u52A1\u4E3B\u952E\u3001\u72B6\u6001\u5B57\u6BB5\u548C\u6307\u6807\u53E3\u5F84\uFF0C\u518D\u8FDB\u5165\u62A5\u8868\u5EFA\u6A21\u3002"
        ]
      };
    }
    function buildScaleInsights(tables = []) {
      const sortedByRows = [...tables].sort((left, right) => Number(right.rowCount || 0) - Number(left.rowCount || 0));
      return {
        summary: `\u672C\u6B21\u8C03\u7814\u8986\u76D6 ${tables.length} \u5F20\u8868\uFF0C\u6700\u5927\u8868 ${sortedByRows[0]?.tableName || "-"} \u884C\u6570 ${sortedByRows[0]?.rowCount ?? 0}\u3002`,
        largeTables: sortedByRows.filter((item) => Number(item.rowCount || 0) >= 1e5).map((item) => item.tableName),
        smallOrEmptyTables: sortedByRows.filter((item) => Number(item.rowCount || 0) <= 10).map((item) => item.tableName),
        complexTables: tables.filter((item) => Number(item.columnCount || 0) >= 30 || Number(item.constraints || 0) >= 5).map((item) => item.tableName),
        suggestions: ["\u5927\u8868\u4F18\u5148\u91C7\u7528\u589E\u91CF\u6216\u5206\u533A\u7B56\u7565\uFF0C\u5C0F\u8868\u548C\u5B57\u5178\u8868\u53EF\u5408\u5E76\u5230\u4F4E\u9891\u540C\u6B65\u6279\u6B21\u3002"]
      };
    }
    function mergeStringList(base = [], addition = []) {
      return uniqueStrings([...base || [], ...Array.isArray(addition) ? addition : []]);
    }
    async function callModulePrompt({ runId, source, config, provider, aiConfig, signal, stageKey, prompt, payload, maxTokens = 1800 }) {
      const batch = {
        stageKey,
        batchNo: 1,
        batchSize: Array.isArray(payload?.tables) ? payload.tables.length : 1,
        inputSummary: { tableCount: Array.isArray(payload?.tables) ? payload.tables.length : void 0 },
        status: "pending"
      };
      const startedAt = Date.now();
      try {
        assertResearchRunNotCancelled(runId);
        await log(runId, stageKey, `\u5F00\u59CB${stageKey}\u6A21\u578B\u5206\u6790`);
        const messages = ensureJsonObjectPrompt([
          { role: "system", content: `${prompt}

${aiConfig.systemPrompt ? `\u5E73\u53F0\u8865\u5145\u8981\u6C42\uFF1A${aiConfig.systemPrompt}` : ""}

\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\u3002` },
          { role: "user", content: JSON.stringify({ ...payload, config }, null, 2) }
        ], provider);
        const completion = await modelProviderService.generateChatCompletion(provider, messages, {
          temperature: aiConfig.temperature ?? 0.1,
          maxTokens: Number(aiConfig.maxTokens || maxTokens),
          signal,
          responseFormat: { type: "json_object" }
        });
        assertResearchRunNotCancelled(runId);
        const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
        batch.status = "succeeded";
        batch.output = parsed;
        batch.durationMs = Date.now() - startedAt;
        await log(runId, stageKey, `${stageKey}\u6A21\u578B\u5206\u6790\u5B8C\u6210`);
        return { output: parsed, batch };
      } catch (error) {
        if (isResearchRunCancelledError(error) || isResearchRunCancellationRequested(runId)) {
          throw createResearchRunCancelledError();
        }
        batch.status = "failed";
        batch.errorMessage = error.message || "\u6A21\u578B\u8C03\u7528\u5931\u8D25";
        batch.durationMs = Date.now() - startedAt;
        await log(runId, stageKey, `${stageKey}\u6A21\u578B\u5206\u6790\u5931\u8D25\uFF0C\u5DF2\u4F7F\u7528\u89C4\u5219\u515C\u5E95: ${error.message || "unknown"}`, { logLevel: "warn" });
        return { output: null, batch };
      }
    }
    async function runModuleInsights(runId, source, config, tables, tableRelationships, signal) {
      const recommendedTables = uniqueStrings(tables.filter((item) => item.priority === "high" && item.category === "business").map((item) => item.tableName));
      const deferredTables = uniqueStrings(tables.filter((item) => ["low_value", "temporary", "log"].includes(item.category)).map((item) => item.tableName));
      const insights = {
        dataScale: buildScaleInsights(tables),
        dataQuality: buildQualityInsights(tables),
        ingestionAdvice: buildIngestionAdviceInsight(tables, recommendedTables, deferredTables),
        governanceAdvice: buildGovernanceAdviceInsight(tables),
        analysisAdvice: buildAnalysisAdviceInsight(tables, tableRelationships)
      };
      const batches = [];
      const requestedAiStages = [
        ["data_scale", "data_scale", DATA_SCALE_PROMPT, "dataScale"],
        ["quality_inspection", "quality_inspection", DATA_QUALITY_PROMPT, "dataQuality"],
        ["ingestion_advice", "ingestion_advice", INGESTION_ADVICE_PROMPT, "ingestionAdvice"],
        ["governance_advice", "governance_advice", GOVERNANCE_ADVICE_PROMPT, "governanceAdvice"],
        ["analysis_advice", "analysis_advice", ANALYSIS_ADVICE_PROMPT, "analysisAdvice"]
      ].filter(([itemKey]) => hasResearchItem(config, itemKey));
      if (!requestedAiStages.length) {
        return { insights, batches };
      }
      const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("data_source_research");
      if (!aiConfig?.defaultModelProviderId) {
        return { insights, batches };
      }
      let provider = null;
      try {
        provider = await resolveResearchProvider(aiConfig);
      } catch (_error) {
        return { insights, batches };
      }
      const tableCards = tables.map((table) => buildAiTableCard(table, { includeFieldEvidence: true }));
      for (const [, stageKey, prompt, insightKey] of requestedAiStages) {
        const result = await callModulePrompt({
          runId,
          source,
          config,
          provider,
          aiConfig,
          signal,
          stageKey,
          prompt,
          payload: {
            source: { sourceName: source.sourceName, sourceType: source.sourceType, databaseName: pickDatabaseName(source), schemaName: pickSchemaName(source) },
            tables: tableCards,
            tableRelationships,
            currentInsight: insights[insightKey]
          }
        });
        batches.push(result.batch);
        if (result.output && typeof result.output === "object") {
          insights[insightKey] = { ...insights[insightKey], ...result.output };
        }
      }
      insights.ingestionAdvice.recommendedTables = mergeStringList(insights.ingestionAdvice.recommendedTables, recommendedTables);
      insights.ingestionAdvice.deferredTables = mergeStringList(insights.ingestionAdvice.deferredTables, deferredTables);
      return { insights, batches };
    }
    async function runAiResearch(runId, source, config, tableProfiles, signal) {
      const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("data_source_research");
      if (!aiConfig?.defaultModelProviderId) {
        await log(runId, "ai_research", "\u672A\u914D\u7F6E\u6570\u636E\u6E90\u8C03\u7814\u6A21\u578B\uFF0C\u5DF2\u4F7F\u7528\u89C4\u5219\u7ED3\u679C\u751F\u6210\u62A5\u544A", { logLevel: "warn" });
        return { aiDecision: null, batches: [] };
      }
      let provider = null;
      try {
        provider = await resolveResearchProvider(aiConfig);
      } catch (error) {
        await log(runId, "ai_research", `${error.message || "\u6570\u636E\u6E90\u8C03\u7814\u6A21\u578B\u4E0D\u5B58\u5728"}\uFF0C\u5DF2\u56DE\u9000\u5230\u89C4\u5219\u7ED3\u679C`, { logLevel: "warn" });
        return { aiDecision: null, batches: [] };
      }
      const tableCards = tableProfiles.map(buildAiTableCard);
      const chunkedCards = chunkArray(tableCards, Number(config.aiBatchSize || 15));
      const batches = [];
      const collectedDecisions = [];
      const collectedRecommendedTables = [];
      const collectedDeferredTables = [];
      const collectedGovernanceSuggestions = [];
      const collectedIngestionSuggestions = [];
      const batchSummaries = [];
      for (let index = 0; index < chunkedCards.length; index += 1) {
        assertResearchRunNotCancelled(runId);
        const batchNo = index + 1;
        const cards = chunkedCards[index];
        const batch = {
          stageKey: "table_classification",
          batchNo,
          batchSize: cards.length,
          inputSummary: { tableNames: cards.map((item) => item.tableName), rowCountMode: config.rowCountMode || "estimated" },
          status: "pending"
        };
        const startedAt2 = Date.now();
        try {
          assertResearchRunNotCancelled(runId);
          await log(runId, "ai_research", `\u5F00\u59CB\u7B2C ${batchNo}/${chunkedCards.length} \u6279\u6A21\u578B\u5206\u7C7B\u5206\u6790`, { detail: batch.inputSummary });
          const messages = ensureJsonObjectPrompt([
            { role: "system", content: `${TABLE_CLASSIFICATION_PROMPT}

${aiConfig.systemPrompt ? `\u5E73\u53F0\u8865\u5145\u8981\u6C42\uFF1A${aiConfig.systemPrompt}` : ""}

\u5F53\u524D\u4EFB\u52A1\u4E3A\u8868\u5206\u7C7B\u6279\u6B21\u5206\u6790\uFF0C\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\u3002` },
            { role: "user", content: JSON.stringify(buildBatchPromptPayload(source, config, cards), null, 2) }
          ], provider);
          const completion = await modelProviderService.generateChatCompletion(provider, messages, {
            temperature: aiConfig.temperature ?? 0.1,
            maxTokens: Number(aiConfig.maxTokens || 1800),
            signal,
            responseFormat: { type: "json_object" }
          });
          assertResearchRunNotCancelled(runId);
          const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
          batch.status = "succeeded";
          batch.output = parsed;
          batch.durationMs = Date.now() - startedAt2;
          collectedDecisions.push(...Array.isArray(parsed.tableDecisions) ? parsed.tableDecisions : []);
          collectedRecommendedTables.push(...Array.isArray(parsed.recommendedTables) ? parsed.recommendedTables : []);
          collectedDeferredTables.push(...Array.isArray(parsed.deferredTables) ? parsed.deferredTables : []);
          collectedGovernanceSuggestions.push(...Array.isArray(parsed.governanceSuggestions) ? parsed.governanceSuggestions : []);
          collectedIngestionSuggestions.push(...Array.isArray(parsed.ingestionSuggestions) ? parsed.ingestionSuggestions : []);
          if (parsed.summary) batchSummaries.push(String(parsed.summary));
          await log(runId, "ai_research", `\u7B2C ${batchNo}/${chunkedCards.length} \u6279\u6A21\u578B\u5206\u7C7B\u5B8C\u6210`);
        } catch (error) {
          if (isResearchRunCancelledError(error) || isResearchRunCancellationRequested(runId)) {
            throw createResearchRunCancelledError();
          }
          batch.status = "failed";
          batch.errorMessage = error.message || "\u6A21\u578B\u8C03\u7528\u5931\u8D25";
          batch.durationMs = Date.now() - startedAt2;
          await log(runId, "ai_research", `\u7B2C ${batchNo}/${chunkedCards.length} \u6279\u6A21\u578B\u5206\u7C7B\u5931\u8D25\uFF0C\u5DF2\u56DE\u9000\u5230\u89C4\u5219\u7ED3\u679C`, {
            logLevel: "warn",
            detail: { error: error.message || "unknown", batchNo }
          });
        }
        batches.push(batch);
      }
      if (!collectedDecisions.length && !collectedRecommendedTables.length && !collectedDeferredTables.length) {
        return { aiDecision: null, batches };
      }
      const aggregateBatch = {
        stageKey: "report_aggregation",
        batchNo: 1,
        batchSize: tableProfiles.length,
        inputSummary: { tableCount: tableProfiles.length, batchCount: chunkedCards.length },
        status: "pending"
      };
      const startedAt = Date.now();
      try {
        assertResearchRunNotCancelled(runId);
        await log(runId, "ai_research", "\u5F00\u59CB\u6A21\u578B\u5168\u5C40\u6C47\u603B\u5206\u6790");
        const messages = ensureJsonObjectPrompt([
          { role: "system", content: `${REPORT_AGGREGATION_PROMPT}

${aiConfig.systemPrompt ? `\u5E73\u53F0\u8865\u5145\u8981\u6C42\uFF1A${aiConfig.systemPrompt}` : ""}

\u5F53\u524D\u4EFB\u52A1\u4E3A\u5168\u5C40\u6C47\u603B\u5206\u6790\uFF0C\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\u3002` },
          {
            role: "user",
            content: JSON.stringify({
              source: { sourceName: source.sourceName, sourceType: source.sourceType, databaseName: pickDatabaseName(source), schemaName: pickSchemaName(source) },
              config,
              batchSummaries,
              tableDecisions: collectedDecisions
            }, null, 2)
          }
        ], provider);
        const completion = await modelProviderService.generateChatCompletion(provider, messages, {
          temperature: aiConfig.temperature ?? 0.1,
          maxTokens: Number(aiConfig.maxTokens || 1800),
          signal,
          responseFormat: { type: "json_object" }
        });
        assertResearchRunNotCancelled(runId);
        const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
        aggregateBatch.status = "succeeded";
        aggregateBatch.output = parsed;
        aggregateBatch.durationMs = Date.now() - startedAt;
        await log(runId, "ai_research", "\u6A21\u578B\u5168\u5C40\u6C47\u603B\u5206\u6790\u5B8C\u6210");
        return {
          aiDecision: {
            summary: parsed.summary || batchSummaries.join(" "),
            tableDecisions: Array.isArray(parsed.tableDecisions) && parsed.tableDecisions.length ? parsed.tableDecisions : collectedDecisions,
            recommendedTables: uniqueStrings((parsed.recommendedTables || []).concat(collectedRecommendedTables)),
            deferredTables: uniqueStrings((parsed.deferredTables || []).concat(collectedDeferredTables)),
            governanceSuggestions: uniqueStrings((parsed.governanceSuggestions || []).concat(collectedGovernanceSuggestions)),
            ingestionSuggestions: uniqueStrings((parsed.ingestionSuggestions || []).concat(collectedIngestionSuggestions))
          },
          batches: [...batches, aggregateBatch]
        };
      } catch (error) {
        if (isResearchRunCancelledError(error) || isResearchRunCancellationRequested(runId)) {
          throw createResearchRunCancelledError();
        }
        aggregateBatch.status = "failed";
        aggregateBatch.errorMessage = error.message || "\u6A21\u578B\u6C47\u603B\u5931\u8D25";
        aggregateBatch.durationMs = Date.now() - startedAt;
        await log(runId, "ai_research", `\u6A21\u578B\u5168\u5C40\u6C47\u603B\u5931\u8D25\uFF0C\u5DF2\u4F7F\u7528\u6279\u6B21\u7ED3\u679C\u56DE\u9000: ${error.message || "unknown"}`, { logLevel: "warn" });
        return {
          aiDecision: {
            summary: batchSummaries.join(" "),
            tableDecisions: collectedDecisions,
            recommendedTables: uniqueStrings(collectedRecommendedTables),
            deferredTables: uniqueStrings(collectedDeferredTables),
            governanceSuggestions: uniqueStrings(collectedGovernanceSuggestions),
            ingestionSuggestions: uniqueStrings(collectedIngestionSuggestions)
          },
          batches: [...batches, aggregateBatch]
        };
      }
    }
    function buildResearchConfigFromPayload(payload = {}, fallback = {}) {
      const rawResearchItems = Array.isArray(payload.researchItems) ? payload.researchItems : Array.isArray(fallback.researchItems) ? fallback.researchItems : [];
      return {
        sampleSize: payload.sampleSize ?? fallback.sampleSize ?? 50,
        maxTables: payload.maxTables ?? fallback.maxTables ?? 50,
        rowCountMode: payload.rowCountMode || fallback.rowCountMode || "estimated",
        metadataConcurrency: payload.metadataConcurrency ?? fallback.metadataConcurrency ?? 3,
        aiBatchSize: payload.aiBatchSize ?? fallback.aiBatchSize ?? 15,
        researchItems: normalizeResearchItems(rawResearchItems),
        notes: payload.notes ?? fallback.notes ?? ""
      };
    }
    function assertValidResearchScope(tableScope, selectedTables) {
      if (tableScope === "manual" && selectedTables.length === 0) {
        throw new AppError("\u624B\u5DE5\u9009\u8868\u6A21\u5F0F\u4E0B\u81F3\u5C11\u9009\u62E9\u4E00\u5F20\u8868", 400);
      }
    }
    async function createResearchRunFromSource(source, payload, user, options = {}) {
      if (!source) throw new AppError("\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      if (!supportsResearch(source)) throw new AppError(`\u5F53\u524D\u4EC5\u652F\u6301 MySQL / PostgreSQL / Hive / FTP / Kafka \u6570\u636E\u6E90\u8C03\u7814\uFF0C\u6682\u4E0D\u652F\u6301 ${source.sourceType}`, 400);
      const selectedTables = uniqueStrings(payload.selectedTables);
      assertValidResearchScope(payload.tableScope, selectedTables);
      const config = buildResearchConfigFromPayload(payload);
      const run = await repository.createRun({
        taskId: options.taskId || null,
        runNo: options.runNo || null,
        sourceId: source.id,
        runName: options.runName || buildRunName(source),
        sourceName: source.sourceName,
        sourceType: source.sourceType,
        databaseName: pickDatabaseName(source),
        schemaName: pickSchemaName(source),
        tableScope: payload.tableScope,
        config,
        selectedTables,
        status: "pending",
        progressPercent: 0,
        currentStage: "created",
        createdBy: user?.displayName || user?.username || "system"
      });
      await log(run.id, "created", "\u8C03\u7814\u4EFB\u52A1\u5DF2\u521B\u5EFA\uFF0C\u7B49\u5F85\u6267\u884C", {
        detail: {
          tableScope: payload.tableScope,
          selectedTableCount: selectedTables.length,
          researchItems: config.researchItems,
          rowCountMode: config.rowCountMode
        }
      });
      if (options.taskId) {
        await repository.updateTask(options.taskId, {
          lastRunId: run.id,
          lastRunStatus: run.status,
          lastRunAt: /* @__PURE__ */ new Date()
        });
      }
      setImmediate(() => {
        executeResearchRun(run.id).catch(async (error) => {
          if (isResearchRunCancelledError(error)) {
            await markResearchRunCancelled(run.id);
            return;
          }
          const failedRun = await repository.updateRun(run.id, {
            status: "failed",
            progressPercent: 100,
            currentStage: "failed",
            errorMessage: error.message || "\u6570\u636E\u6E90\u8C03\u7814\u5931\u8D25",
            finishedAt: /* @__PURE__ */ new Date()
          });
          if (run.taskId) {
            await repository.updateTask(run.taskId, {
              lastRunId: run.id,
              lastRunStatus: failedRun.status,
              lastRunAt: failedRun.finishedAt || /* @__PURE__ */ new Date()
            });
          }
          await log(run.id, "failed", error.message || "\u6570\u636E\u6E90\u8C03\u7814\u5931\u8D25", { logLevel: "error" });
        });
      });
      return run;
    }
    async function createResearchRun(sourceId, payload, user) {
      const source = await dataSourceRepository.getDataSourceById(sourceId);
      if (!source) throw new AppError("\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      if (!supportsResearch(source)) throw new AppError(`\u5F53\u524D\u4EC5\u652F\u6301 MySQL / PostgreSQL / Hive / FTP / Kafka \u6570\u636E\u6E90\u8C03\u7814\uFF0C\u6682\u4E0D\u652F\u6301 ${source.sourceType}`, 400);
      return createResearchRunFromSource(source, payload, user);
    }
    async function createResearchTask(payload, user) {
      const source = await dataSourceRepository.getDataSourceById(payload.sourceId);
      if (!source) throw new AppError("\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      if (!supportsResearch(source)) throw new AppError(`\u5F53\u524D\u4EC5\u652F\u6301 MySQL / PostgreSQL / Hive / FTP / Kafka \u6570\u636E\u6E90\u8C03\u7814\uFF0C\u6682\u4E0D\u652F\u6301 ${source.sourceType}`, 400);
      const selectedTables = uniqueStrings(payload.selectedTables);
      const tableScope = payload.tableScope || "all";
      assertValidResearchScope(tableScope, selectedTables);
      const config = buildResearchConfigFromPayload(payload);
      if (!config.researchItems.length) {
        throw new AppError("\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u8C03\u7814\u65B9\u5411", 400);
      }
      return repository.createTask({
        taskName: payload.taskName,
        sourceId: source.id,
        sourceName: source.sourceName,
        sourceType: source.sourceType,
        databaseName: pickDatabaseName(source),
        schemaName: pickSchemaName(source),
        tableScope,
        config,
        selectedTables,
        status: payload.status || "active",
        description: payload.description || "",
        createdBy: user?.displayName || user?.username || "system"
      });
    }
    async function listResearchTasks(query = {}) {
      const sourceId = Number(query.sourceId || 0) || null;
      const status = ["active", "disabled"].includes(String(query.status || "")) ? String(query.status) : null;
      const keyword = String(query.keyword || "").trim();
      return repository.listTasks({ sourceId, status, keyword });
    }
    async function getResearchTask(taskId) {
      const task = await repository.getTaskById(taskId);
      if (!task) throw new AppError("\u6570\u636E\u8C03\u7814\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
      return task;
    }
    async function updateResearchTask(taskId, payload, user) {
      const current = await getResearchTask(taskId);
      const sourceId = payload.sourceId || current.sourceId;
      const source = await dataSourceRepository.getDataSourceById(sourceId);
      if (!source) throw new AppError("\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      if (!supportsResearch(source)) throw new AppError(`\u5F53\u524D\u4EC5\u652F\u6301 MySQL / PostgreSQL / Hive / FTP / Kafka \u6570\u636E\u6E90\u8C03\u7814\uFF0C\u6682\u4E0D\u652F\u6301 ${source.sourceType}`, 400);
      const nextConfig = buildResearchConfigFromPayload(payload, current.config || {});
      const nextTableScope = payload.tableScope || current.tableScope || "all";
      const nextSelectedTables = Object.prototype.hasOwnProperty.call(payload, "selectedTables") ? uniqueStrings(payload.selectedTables) : uniqueStrings(current.selectedTables);
      assertValidResearchScope(nextTableScope, nextSelectedTables);
      if (!nextConfig.researchItems.length) {
        throw new AppError("\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u8C03\u7814\u65B9\u5411", 400);
      }
      return repository.updateTask(taskId, {
        taskName: payload.taskName || current.taskName,
        sourceId: source.id,
        sourceName: source.sourceName,
        sourceType: source.sourceType,
        databaseName: pickDatabaseName(source),
        schemaName: pickSchemaName(source),
        tableScope: nextTableScope,
        config: nextConfig,
        selectedTables: nextSelectedTables,
        status: payload.status || current.status,
        description: Object.prototype.hasOwnProperty.call(payload, "description") ? payload.description || "" : current.description,
        updatedBy: user?.displayName || user?.username || "system"
      });
    }
    async function deleteResearchTask(taskId) {
      const task = await getResearchTask(taskId);
      if (await repository.hasActiveRunsByTaskId(taskId)) {
        throw new AppError("\u5B58\u5728\u8FD0\u884C\u4E2D\u7684\u8C03\u7814\u6279\u6B21\uFF0C\u6682\u4E0D\u80FD\u5220\u9664\u4EFB\u52A1", 400);
      }
      const deleted = await repository.deleteTask(task.id);
      if (!deleted) throw new AppError("\u6570\u636E\u8C03\u7814\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
      return { id: taskId };
    }
    async function createResearchTaskRun(taskId, user) {
      const task = await getResearchTask(taskId);
      if (task.status === "disabled") {
        throw new AppError("\u5F53\u524D\u8C03\u7814\u4EFB\u52A1\u5DF2\u505C\u7528\uFF0C\u4E0D\u80FD\u6267\u884C", 400);
      }
      const source = await dataSourceRepository.getDataSourceById(task.sourceId);
      if (!source) throw new AppError("\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      if (!supportsResearch(source)) throw new AppError(`\u5F53\u524D\u4EC5\u652F\u6301 MySQL / PostgreSQL / Hive / FTP / Kafka \u6570\u636E\u6E90\u8C03\u7814\uFF0C\u6682\u4E0D\u652F\u6301 ${source.sourceType}`, 400);
      const runNo = await repository.getNextRunNoByTaskId(taskId);
      const payload = {
        ...task.config,
        tableScope: task.tableScope,
        selectedTables: task.selectedTables
      };
      return createResearchRunFromSource(source, payload, user, {
        taskId,
        runNo,
        runName: `${task.taskName} \u7B2C ${runNo} \u6279`
      });
    }
    async function listResearchTaskRuns(taskId) {
      await getResearchTask(taskId);
      return repository.listRunsByTaskId(taskId);
    }
    async function listResearchRuns(sourceId) {
      const source = await dataSourceRepository.getDataSourceById(sourceId);
      if (!source) throw new AppError("\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      return repository.listRunsBySourceId(sourceId);
    }
    async function getResearchRun(runId) {
      const run = await repository.getRunById(runId);
      if (!run) throw new AppError("\u8C03\u7814\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
      return run;
    }
    async function listResearchLogs(runId) {
      await getResearchRun(runId);
      return repository.listLogs(runId);
    }
    async function getResearchReport(runId) {
      const run = await getResearchRun(runId);
      return run.report || null;
    }
    async function downloadResearchReportWord(runId) {
      const run = await getResearchRun(runId);
      if (!run.report) {
        throw new AppError("\u5F53\u524D\u8C03\u7814\u4EFB\u52A1\u6682\u65E0\u53EF\u4E0B\u8F7D\u62A5\u544A", 404);
      }
      const task = run.taskId ? await getResearchTask(run.taskId) : null;
      const buffer = await buildResearchReportWordBuffer(run.report);
      const taskName = task?.taskName || run.runName || run.sourceName || "data_source_research";
      const generatedAt = run.finishedAt || run.updatedAt || run.createdAt;
      return {
        fileName: `${sanitizeDownloadFileName(taskName)}_${formatDownloadDateTime(generatedAt)}.docx`,
        buffer
      };
    }
    async function deleteResearchRun(runId) {
      const run = await getResearchRun(runId);
      if (["pending", "running"].includes(String(run.status || ""))) {
        throw new AppError("\u8FD0\u884C\u4E2D\u7684\u8C03\u7814\u4EFB\u52A1\u4E0D\u652F\u6301\u5220\u9664\uFF0C\u8BF7\u7B49\u5F85\u5B8C\u6210\u540E\u518D\u5220\u9664", 400);
      }
      const deleted = await repository.deleteRun(runId);
      if (!deleted) throw new AppError("\u8C03\u7814\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
      return { id: runId };
    }
    async function terminateResearchRun(runId) {
      const run = await getResearchRun(runId);
      if (!["pending", "running"].includes(String(run.status || ""))) {
        throw new AppError("\u4EC5\u652F\u6301\u7EC8\u6B62\u8FD0\u884C\u4E2D\u7684\u8C03\u7814\u4EFB\u52A1", 400);
      }
      const activeRun = getActiveResearchRun(runId);
      if (activeRun) {
        activeRun.cancelRequested = true;
        activeRun.controller.abort();
      }
      await markResearchRunCancelled(runId);
      return getResearchRun(runId);
    }
    function toTableMap(report) {
      const map = /* @__PURE__ */ new Map();
      for (const table of Array.isArray(report?.tables) ? report.tables : []) {
        if (table?.tableName) {
          map.set(String(table.tableName), table);
        }
      }
      return map;
    }
    function toFieldMap(table) {
      const fields = Array.isArray(table?.fieldProfiles) && table.fieldProfiles.length ? table.fieldProfiles : table?.columns || [];
      const map = /* @__PURE__ */ new Map();
      for (const field of Array.isArray(fields) ? fields : []) {
        if (field?.columnName) {
          map.set(String(field.columnName), field);
        }
      }
      return map;
    }
    function compareStringArrays(before = [], after = []) {
      const beforeSet = new Set((Array.isArray(before) ? before : []).map((item) => String(item || "").trim()).filter(Boolean));
      const afterSet = new Set((Array.isArray(after) ? after : []).map((item) => String(item || "").trim()).filter(Boolean));
      return {
        added: Array.from(afterSet).filter((item) => !beforeSet.has(item)),
        removed: Array.from(beforeSet).filter((item) => !afterSet.has(item))
      };
    }
    function relationKey(relation) {
      return [
        relation?.fromTable,
        relation?.fromField,
        relation?.toTable,
        relation?.toField,
        relation?.relationType
      ].map((item) => String(item || "").trim()).join("|");
    }
    function relationText(relation) {
      if (!relation) return "-";
      return `${relation.fromTable || "-"}.${relation.fromField || "-"} -> ${relation.toTable || "-"}.${relation.toField || "-"}\uFF08${relation.relationType || "-"}\uFF09`;
    }
    function getRecommendationList(report, key) {
      return uniqueStrings(report?.recommendations?.[key] || []);
    }
    function getGovernanceTaskTables(report) {
      return uniqueStrings((report?.insights?.governanceAdvice?.tableTasks || []).map((item) => item.tableName));
    }
    function getAnalysisThemeNames(report) {
      return uniqueStrings((report?.insights?.analysisAdvice?.analysisThemes || []).map((item) => item.theme));
    }
    function describeListChange(label, change) {
      const added = Array.isArray(change?.added) ? change.added : [];
      const removed = Array.isArray(change?.removed) ? change.removed : [];
      if (!added.length && !removed.length) return `${label}\u65E0\u660E\u663E\u53D8\u5316\u3002`;
      const parts = [];
      if (added.length) parts.push(`\u65B0\u589E ${added.slice(0, 8).join("\u3001")}${added.length > 8 ? ` \u7B49 ${added.length} \u9879` : ""}`);
      if (removed.length) parts.push(`\u51CF\u5C11 ${removed.slice(0, 8).join("\u3001")}${removed.length > 8 ? ` \u7B49 ${removed.length} \u9879` : ""}`);
      return `${label}${parts.join("\uFF1B")}\u3002`;
    }
    function summarizeChangedFields(baseTable, targetTable) {
      const baseFields = toFieldMap(baseTable);
      const targetFields = toFieldMap(targetTable);
      const added = [];
      const removed = [];
      const changed = [];
      for (const [fieldName, field] of targetFields.entries()) {
        if (!baseFields.has(fieldName)) {
          added.push(fieldName);
          continue;
        }
        const before = baseFields.get(fieldName);
        const changes = [];
        if (String(before.dataType || before.columnType || "") !== String(field.dataType || field.columnType || "")) {
          changes.push({ field: "dataType", before: before.dataType || before.columnType || "", after: field.dataType || field.columnType || "" });
        }
        if (Boolean(before.isPrimaryKey) !== Boolean(field.isPrimaryKey)) {
          changes.push({ field: "isPrimaryKey", before: Boolean(before.isPrimaryKey), after: Boolean(field.isPrimaryKey) });
        }
        if (before.isNullable !== void 0 && field.isNullable !== void 0 && Boolean(before.isNullable) !== Boolean(field.isNullable)) {
          changes.push({ field: "isNullable", before: Boolean(before.isNullable), after: Boolean(field.isNullable) });
        }
        if (Number.isFinite(Number(before.nullRate)) && Number.isFinite(Number(field.nullRate))) {
          const delta = Number((Number(field.nullRate) - Number(before.nullRate)).toFixed(6));
          if (Math.abs(delta) >= 0.05) {
            changes.push({ field: "nullRate", before: Number(before.nullRate), after: Number(field.nullRate), delta });
          }
        }
        if (changes.length) {
          changed.push({ columnName: fieldName, changes });
        }
      }
      for (const fieldName of baseFields.keys()) {
        if (!targetFields.has(fieldName)) {
          removed.push(fieldName);
        }
      }
      return { added, removed, changed };
    }
    function buildReportComparisonDiff(baseRun, targetRun) {
      const baseReport = baseRun.report || {};
      const targetReport = targetRun.report || {};
      const baseTables = toTableMap(baseReport);
      const targetTables = toTableMap(targetReport);
      const addedTables = [];
      const removedTables = [];
      const changedTables = [];
      for (const [tableName, table] of targetTables.entries()) {
        if (!baseTables.has(tableName)) {
          addedTables.push({ tableName, category: table.category || "", priority: table.priority || "", rowCount: table.rowCount ?? null });
          continue;
        }
        const before = baseTables.get(tableName);
        const tableChanges = [];
        if (String(before.category || "") !== String(table.category || "")) {
          tableChanges.push({ field: "category", before: before.category || "", after: table.category || "" });
        }
        if (String(before.priority || "") !== String(table.priority || "")) {
          tableChanges.push({ field: "priority", before: before.priority || "", after: table.priority || "" });
        }
        const beforeRowCount = before.rowCount === null || before.rowCount === void 0 ? null : Number(before.rowCount);
        const afterRowCount = table.rowCount === null || table.rowCount === void 0 ? null : Number(table.rowCount);
        if (Number.isFinite(beforeRowCount) && Number.isFinite(afterRowCount) && beforeRowCount !== afterRowCount) {
          tableChanges.push({
            field: "rowCount",
            before: beforeRowCount,
            after: afterRowCount,
            delta: afterRowCount - beforeRowCount,
            deltaRate: beforeRowCount === 0 ? null : Number(((afterRowCount - beforeRowCount) / beforeRowCount).toFixed(6))
          });
        }
        const metadataIssueChanges = compareStringArrays(before.metadataIssues, table.metadataIssues);
        const fieldChanges = summarizeChangedFields(before, table);
        const highNullDelta = Number(table.quality?.highNullColumns || 0) - Number(before.quality?.highNullColumns || 0);
        if (tableChanges.length || metadataIssueChanges.added.length || metadataIssueChanges.removed.length || fieldChanges.added.length || fieldChanges.removed.length || fieldChanges.changed.length || highNullDelta !== 0) {
          changedTables.push({
            tableName,
            changes: tableChanges,
            metadataIssues: metadataIssueChanges,
            fields: fieldChanges,
            quality: { highNullColumnsDelta: highNullDelta }
          });
        }
      }
      for (const [tableName, table] of baseTables.entries()) {
        if (!targetTables.has(tableName)) {
          removedTables.push({ tableName, category: table.category || "", priority: table.priority || "", rowCount: table.rowCount ?? null });
        }
      }
      const baseRelations = Array.isArray(baseReport.tableRelationships?.relations) ? baseReport.tableRelationships.relations : [];
      const targetRelations = Array.isArray(targetReport.tableRelationships?.relations) ? targetReport.tableRelationships.relations : [];
      const baseRelationMap = new Map(baseRelations.map((relation) => [relationKey(relation), relation]));
      const targetRelationMap = new Map(targetRelations.map((relation) => [relationKey(relation), relation]));
      const addedRelations = Array.from(targetRelationMap.entries()).filter(([key]) => !baseRelationMap.has(key)).map(([, value]) => value);
      const removedRelations = Array.from(baseRelationMap.entries()).filter(([key]) => !targetRelationMap.has(key)).map(([, value]) => value);
      const classificationChangedTables = changedTables.filter((item) => item.changes.some((change) => ["category", "priority"].includes(change.field))).map((item) => ({
        tableName: item.tableName,
        changes: item.changes.filter((change) => ["category", "priority"].includes(change.field))
      }));
      const rowCountChangedTables = changedTables.map((item) => {
        const rowCountChange = item.changes.find((change) => change.field === "rowCount");
        return rowCountChange ? {
          tableName: item.tableName,
          before: rowCountChange.before,
          after: rowCountChange.after,
          delta: rowCountChange.delta,
          deltaRate: rowCountChange.deltaRate
        } : null;
      }).filter(Boolean).sort((left, right) => Math.abs(Number(right.delta || 0)) - Math.abs(Number(left.delta || 0)));
      const qualityChangedTables = changedTables.filter((item) => item.metadataIssues.added.length || item.metadataIssues.removed.length || item.quality.highNullColumnsDelta !== 0 || item.fields.changed.length).map((item) => ({
        tableName: item.tableName,
        metadataIssues: item.metadataIssues,
        highNullColumnsDelta: item.quality.highNullColumnsDelta,
        changedFields: item.fields.changed.slice(0, 20)
      }));
      const baseGovernanceSuggestions = uniqueStrings([
        ...baseReport.recommendations?.governanceSuggestions || [],
        ...baseReport.insights?.governanceAdvice?.governanceSuggestions || []
      ]);
      const targetGovernanceSuggestions = uniqueStrings([
        ...targetReport.recommendations?.governanceSuggestions || [],
        ...targetReport.insights?.governanceAdvice?.governanceSuggestions || []
      ]);
      const baseAnalysisSuggestions = uniqueStrings([
        ...baseReport.recommendations?.analysisSuggestions || [],
        ...baseReport.insights?.analysisAdvice?.analysisSuggestions || []
      ]);
      const targetAnalysisSuggestions = uniqueStrings([
        ...targetReport.recommendations?.analysisSuggestions || [],
        ...targetReport.insights?.analysisAdvice?.analysisSuggestions || []
      ]);
      const baseTotalRows = Number(baseReport.overview?.totalRowCount || 0);
      const targetTotalRows = Number(targetReport.overview?.totalRowCount || 0);
      const summaryText = [
        `\u57FA\u51C6\u6279\u6B21 ${baseRun.runNo || baseRun.id} \u4E0E\u5BF9\u6BD4\u6279\u6B21 ${targetRun.runNo || targetRun.id}`,
        `\u65B0\u589E\u8868 ${addedTables.length} \u5F20\uFF0C\u79FB\u9664\u8868 ${removedTables.length} \u5F20\uFF0C\u53D8\u5316\u8868 ${changedTables.length} \u5F20`,
        `\u8868\u5173\u7CFB\u65B0\u589E ${addedRelations.length} \u6761\uFF0C\u79FB\u9664 ${removedRelations.length} \u6761`
      ].join("\uFF1B");
      return {
        source: targetReport.source || baseReport.source || {},
        task: {
          baseRunId: baseRun.id,
          targetRunId: targetRun.id,
          baseRunNo: baseRun.runNo,
          targetRunNo: targetRun.runNo
        },
        overview: {
          baseTotalTables: Number(baseReport.overview?.totalTables || baseTables.size),
          targetTotalTables: Number(targetReport.overview?.totalTables || targetTables.size),
          tableDelta: targetTables.size - baseTables.size,
          baseTotalRowCount: baseTotalRows,
          targetTotalRowCount: targetTotalRows,
          rowCountDelta: targetTotalRows - baseTotalRows,
          rowCountDeltaRate: baseTotalRows === 0 ? null : Number(((targetTotalRows - baseTotalRows) / baseTotalRows).toFixed(6))
        },
        tables: {
          added: addedTables,
          removed: removedTables,
          changed: changedTables.slice(0, 200)
        },
        relationships: {
          added: addedRelations.slice(0, 100),
          removed: removedRelations.slice(0, 100)
        },
        modules: {
          tableClassification: {
            addedTables,
            removedTables,
            changedTables: classificationChangedTables.slice(0, 100)
          },
          tableRelationship: {
            added: addedRelations.slice(0, 100),
            removed: removedRelations.slice(0, 100)
          },
          dataScale: {
            rowCountDelta: targetTotalRows - baseTotalRows,
            rowCountDeltaRate: baseTotalRows === 0 ? null : Number(((targetTotalRows - baseTotalRows) / baseTotalRows).toFixed(6)),
            changedTables: rowCountChangedTables.slice(0, 100)
          },
          dataQuality: {
            changedTables: qualityChangedTables.slice(0, 100),
            issueAddedCount: qualityChangedTables.reduce((sum, item) => sum + item.metadataIssues.added.length, 0),
            issueRemovedCount: qualityChangedTables.reduce((sum, item) => sum + item.metadataIssues.removed.length, 0),
            highNullColumnsDelta: qualityChangedTables.reduce((sum, item) => sum + Number(item.highNullColumnsDelta || 0), 0)
          },
          ingestionAdvice: {
            recommendedTables: compareStringArrays(getRecommendationList(baseReport, "recommendedTables"), getRecommendationList(targetReport, "recommendedTables")),
            deferredTables: compareStringArrays(getRecommendationList(baseReport, "deferredTables"), getRecommendationList(targetReport, "deferredTables"))
          },
          governanceAdvice: {
            suggestions: compareStringArrays(baseGovernanceSuggestions, targetGovernanceSuggestions),
            taskTables: compareStringArrays(getGovernanceTaskTables(baseReport), getGovernanceTaskTables(targetReport))
          },
          analysisAdvice: {
            suggestions: compareStringArrays(baseAnalysisSuggestions, targetAnalysisSuggestions),
            themes: compareStringArrays(getAnalysisThemeNames(baseReport), getAnalysisThemeNames(targetReport))
          }
        },
        summaryText
      };
    }
    function buildRuleComparisonSummary(diff) {
      const modules = diff.modules || {};
      const tableClassification = modules.tableClassification || {};
      const tableRelationship = modules.tableRelationship || {};
      const dataScale = modules.dataScale || {};
      const dataQuality = modules.dataQuality || {};
      const ingestionAdvice = modules.ingestionAdvice || {};
      const governanceAdvice = modules.governanceAdvice || {};
      const analysisAdvice = modules.analysisAdvice || {};
      const risks = [];
      const suggestions = [];
      if (diff.tables.removed.length) {
        risks.push(`\u6709 ${diff.tables.removed.length} \u5F20\u8868\u5728\u65B0\u6279\u6B21\u4E2D\u6D88\u5931\uFF0C\u9700\u8981\u786E\u8BA4\u662F\u5426\u4E3A\u6743\u9650\u3001\u5E93\u8868\u53D8\u66F4\u6216\u8C03\u7814\u8303\u56F4\u53D8\u5316\u3002`);
      }
      const worseQualityTables = diff.tables.changed.filter((item) => item.metadataIssues.added.length || item.quality.highNullColumnsDelta > 0);
      if (worseQualityTables.length) {
        risks.push(`${worseQualityTables.length} \u5F20\u8868\u51FA\u73B0\u65B0\u589E\u5143\u6570\u636E\u95EE\u9898\u6216\u9AD8\u7A7A\u503C\u5B57\u6BB5\u589E\u52A0\u3002`);
        suggestions.push("\u4F18\u5148\u590D\u6838\u65B0\u589E\u5143\u6570\u636E\u95EE\u9898\u548C\u9AD8\u7A7A\u503C\u5B57\u6BB5\uFF0C\u5FC5\u8981\u65F6\u6682\u7F13\u81EA\u52A8\u63A5\u5165\u3002");
      }
      if (diff.relationships.removed.length) {
        risks.push(`\u6709 ${diff.relationships.removed.length} \u6761\u8868\u5173\u7CFB\u4E0D\u518D\u7A33\u5B9A\uFF0C\u53EF\u80FD\u5F71\u54CD\u4E0B\u6E38\u5EFA\u6A21\u548C\u5173\u8054\u5206\u6790\u3002`);
      }
      if (diff.tables.added.length) {
        suggestions.push("\u5BF9\u65B0\u589E\u8868\u8865\u5145\u4E1A\u52A1\u5F52\u5C5E\u3001\u4E3B\u952E\u548C\u589E\u91CF\u5B57\u6BB5\u786E\u8BA4\u540E\u518D\u7EB3\u5165\u63A5\u5165\u4EFB\u52A1\u3002");
      }
      if (!risks.length) {
        risks.push("\u672A\u53D1\u73B0\u660E\u663E\u6076\u5316\u98CE\u9669\u3002");
      }
      if (!suggestions.length) {
        suggestions.push("\u5EFA\u8BAE\u6309\u5F53\u524D\u8C03\u7814\u7ED3\u679C\u6301\u7EED\u89C2\u5BDF\u4E0B\u4E00\u6279\u6B21\u53D8\u5316\u3002");
      }
      const tableClassificationChanges = [
        `\u65B0\u589E\u8868 ${diff.tables.added.length} \u5F20\uFF0C\u79FB\u9664\u8868 ${diff.tables.removed.length} \u5F20\uFF0C\u5206\u7C7B\u6216\u4F18\u5148\u7EA7\u53D8\u5316 ${tableClassification.changedTables?.length || 0} \u5F20\u3002`,
        ...(tableClassification.changedTables || []).slice(0, 8).map((item) => {
          const text = item.changes.map((change) => `${change.field === "category" ? "\u5206\u7C7B" : "\u4F18\u5148\u7EA7"}\u7531 ${change.before || "-"} \u53D8\u4E3A ${change.after || "-"}`).join("\uFF1B");
          return `${item.tableName}\uFF1A${text}`;
        })
      ];
      const tableRelationshipChanges = [
        `\u8868\u5173\u7CFB\u65B0\u589E ${tableRelationship.added?.length ?? diff.relationships.added.length} \u6761\uFF0C\u79FB\u9664 ${tableRelationship.removed?.length ?? diff.relationships.removed.length} \u6761\u3002`,
        ...(tableRelationship.added || []).slice(0, 6).map((item) => `\u65B0\u589E\u5173\u7CFB\uFF1A${relationText(item)}`),
        ...(tableRelationship.removed || []).slice(0, 6).map((item) => `\u79FB\u9664\u5173\u7CFB\uFF1A${relationText(item)}`)
      ];
      const dataScaleChanges = [
        `\u7D2F\u8BA1\u884C\u6570\u53D8\u5316 ${dataScale.rowCountDelta ?? diff.overview.rowCountDelta}\uFF0C\u8868\u6570\u91CF\u53D8\u5316 ${diff.overview.tableDelta}\u3002`,
        ...(dataScale.changedTables || []).slice(0, 8).map((item) => `${item.tableName} \u884C\u6570\u7531 ${item.before} \u53D8\u4E3A ${item.after}\uFF0C\u53D8\u5316 ${item.delta}`)
      ];
      const dataQualityChanges = [
        `\u8D28\u91CF\u95EE\u9898\u65B0\u589E ${dataQuality.issueAddedCount || 0} \u9879\uFF0C\u51CF\u5C11 ${dataQuality.issueRemovedCount || 0} \u9879\uFF0C\u9AD8\u7A7A\u503C\u5B57\u6BB5\u51C0\u53D8\u5316 ${dataQuality.highNullColumnsDelta || 0}\u3002`,
        ...worseQualityTables.slice(0, 10).map((item) => `${item.tableName} \u65B0\u589E\u95EE\u9898 ${item.metadataIssues.added.join("\u3001") || "\u65E0"}\uFF0C\u9AD8\u7A7A\u503C\u5B57\u6BB5\u53D8\u5316 ${item.quality.highNullColumnsDelta}`)
      ];
      const ingestionAdviceChanges = [
        describeListChange("\u4F18\u5148\u63A5\u5165\u8868", ingestionAdvice.recommendedTables),
        describeListChange("\u5EFA\u8BAE\u6682\u7F13\u8868", ingestionAdvice.deferredTables)
      ];
      const governanceAdviceChanges = [
        describeListChange("\u6CBB\u7406\u5EFA\u8BAE", governanceAdvice.suggestions),
        describeListChange("\u6CBB\u7406\u4EFB\u52A1\u8868", governanceAdvice.taskTables)
      ];
      const analysisAdviceChanges = [
        describeListChange("\u5206\u6790\u4E3B\u9898", analysisAdvice.themes),
        describeListChange("\u5206\u6790\u5EFA\u8BAE", analysisAdvice.suggestions)
      ];
      return {
        summary: diff.summaryText,
        tableClassificationChanges,
        tableRelationshipChanges,
        dataScaleChanges,
        dataQualityChanges,
        ingestionAdviceChanges,
        governanceAdviceChanges,
        analysisAdviceChanges,
        qualityChanges: dataQualityChanges,
        schemaChanges: [...tableClassificationChanges, ...dataScaleChanges],
        relationshipChanges: tableRelationshipChanges,
        risks,
        suggestions,
        confidence: 0.74
      };
    }
    async function runAiReportComparison(task, baseRun, targetRun, diff) {
      const fallback = buildRuleComparisonSummary(diff);
      const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("data_source_research");
      if (!aiConfig?.defaultModelProviderId) {
        return fallback;
      }
      let provider = null;
      try {
        provider = await resolveResearchProvider(aiConfig);
      } catch {
        return fallback;
      }
      try {
        const messages = ensureJsonObjectPrompt([
          { role: "system", content: `${REPORT_COMPARISON_PROMPT}

${aiConfig.systemPrompt ? `\u5E73\u53F0\u8865\u5145\u8981\u6C42\uFF1A${aiConfig.systemPrompt}` : ""}

\u5F53\u524D\u4EFB\u52A1\u4E3A\u540C\u4E00\u8C03\u7814\u4EFB\u52A1\u7684\u62A5\u544A\u6279\u6B21\u5DEE\u5F02\u5BF9\u6BD4\uFF0C\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\u3002` },
          {
            role: "user",
            content: JSON.stringify({
              task: {
                taskName: task.taskName,
                sourceName: task.sourceName,
                baseRun: { id: baseRun.id, runNo: baseRun.runNo, createdAt: baseRun.createdAt },
                targetRun: { id: targetRun.id, runNo: targetRun.runNo, createdAt: targetRun.createdAt }
              },
              diff
            }, null, 2)
          }
        ], provider);
        const completion = await modelProviderService.generateChatCompletion(provider, messages, {
          temperature: aiConfig.temperature ?? 0.1,
          maxTokens: Number(aiConfig.maxTokens || 1600),
          responseFormat: { type: "json_object" }
        });
        const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
        const pickStringArray = (key, fallbackList = []) => Array.isArray(parsed[key]) ? parsed[key].map(String).slice(0, 20) : fallbackList;
        const tableClassificationChanges = pickStringArray("tableClassificationChanges", fallback.tableClassificationChanges);
        const tableRelationshipChanges = pickStringArray("tableRelationshipChanges", fallback.tableRelationshipChanges || fallback.relationshipChanges);
        const dataScaleChanges = pickStringArray("dataScaleChanges", fallback.dataScaleChanges);
        const dataQualityChanges = pickStringArray("dataQualityChanges", fallback.dataQualityChanges || fallback.qualityChanges);
        const ingestionAdviceChanges = pickStringArray("ingestionAdviceChanges", fallback.ingestionAdviceChanges);
        const governanceAdviceChanges = pickStringArray("governanceAdviceChanges", fallback.governanceAdviceChanges);
        const analysisAdviceChanges = pickStringArray("analysisAdviceChanges", fallback.analysisAdviceChanges);
        return {
          summary: normalizeSummaryText(parsed.summary || fallback.summary, 1200),
          tableClassificationChanges,
          tableRelationshipChanges,
          dataScaleChanges,
          dataQualityChanges,
          ingestionAdviceChanges,
          governanceAdviceChanges,
          analysisAdviceChanges,
          qualityChanges: pickStringArray("qualityChanges", dataQualityChanges),
          schemaChanges: pickStringArray("schemaChanges", [...tableClassificationChanges, ...dataScaleChanges]),
          relationshipChanges: pickStringArray("relationshipChanges", tableRelationshipChanges),
          risks: pickStringArray("risks", fallback.risks),
          suggestions: pickStringArray("suggestions", fallback.suggestions),
          confidence: clampConfidence(parsed.confidence, fallback.confidence)
        };
      } catch {
        return fallback;
      }
    }
    async function compareResearchReports(taskId, payload, user) {
      const task = await getResearchTask(taskId);
      if (payload.baseRunId === payload.targetRunId) {
        throw new AppError("\u8BF7\u9009\u62E9\u4E24\u4E2A\u4E0D\u540C\u7684\u62A5\u544A\u6279\u6B21\u8FDB\u884C\u5BF9\u6BD4", 400);
      }
      const baseRun = await getResearchRun(payload.baseRunId);
      const targetRun = await getResearchRun(payload.targetRunId);
      if (baseRun.taskId !== task.id || targetRun.taskId !== task.id) {
        throw new AppError("\u4EC5\u652F\u6301\u5BF9\u6BD4\u540C\u4E00\u4E2A\u8C03\u7814\u4EFB\u52A1\u4E0B\u7684\u62A5\u544A\u6279\u6B21", 400);
      }
      if (!baseRun.report || !targetRun.report) {
        throw new AppError("\u4E24\u4E2A\u6279\u6B21\u90FD\u9700\u8981\u5DF2\u751F\u6210\u8C03\u7814\u62A5\u544A", 400);
      }
      let comparison = await repository.createComparison({
        taskId: task.id,
        baseRunId: baseRun.id,
        targetRunId: targetRun.id,
        status: "running",
        createdBy: user?.displayName || user?.username || "system"
      });
      try {
        const diff = buildReportComparisonDiff(baseRun, targetRun);
        const aiSummary = await runAiReportComparison(task, baseRun, targetRun, diff);
        comparison = await repository.updateComparison(comparison.id, {
          status: "succeeded",
          diff,
          aiSummary,
          summaryText: aiSummary.summary || diff.summaryText,
          errorMessage: null
        });
        return comparison;
      } catch (error) {
        comparison = await repository.updateComparison(comparison.id, {
          status: "failed",
          errorMessage: error.message || "\u62A5\u544A\u5BF9\u6BD4\u5931\u8D25"
        });
        throw new AppError(comparison.errorMessage, 500);
      }
    }
    async function listResearchComparisons(taskId) {
      await getResearchTask(taskId);
      return repository.listComparisonsByTaskId(taskId);
    }
    async function getResearchComparison(comparisonId) {
      const comparison = await repository.getComparisonById(comparisonId);
      if (!comparison) throw new AppError("\u8C03\u7814\u62A5\u544A\u5BF9\u6BD4\u8BB0\u5F55\u4E0D\u5B58\u5728", 404);
      return comparison;
    }
    async function reconcileRunningResearchRunsAfterRestart() {
      return repository.reconcileLatestRunningResearchRunsAfterRestart();
    }
    async function executeResearchRun(runId) {
      const activeRun = registerActiveResearchRun(runId);
      try {
        const run = await getResearchRun(runId);
        const source = await dataSourceRepository.getDataSourceById(run.sourceId);
        if (!source) throw new AppError("\u8C03\u7814\u5BF9\u5E94\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
        const config = run.config || {};
        assertResearchRunNotCancelled(runId);
        await setRunState(runId, {
          status: "running",
          progressPercent: 5,
          currentStage: "connectivity_check",
          startedAt: /* @__PURE__ */ new Date(),
          errorMessage: null
        }, { stageKey: "connectivity_check", message: "\u5F00\u59CB\u6821\u9A8C\u6570\u636E\u6E90\u8FDE\u901A\u6027" });
        const connectivity = await testDatabaseConnection(source.connectionConfig, source.sourceType);
        assertResearchRunNotCancelled(runId);
        if (!connectivity.success) {
          throw new AppError(connectivity.error || connectivity.message || "\u6570\u636E\u6E90\u8FDE\u901A\u6027\u6821\u9A8C\u5931\u8D25", 400);
        }
        await log(runId, "connectivity_check", connectivity.message || "\u6570\u636E\u6E90\u8FDE\u901A\u6027\u6821\u9A8C\u901A\u8FC7");
        await setRunState(runId, {
          progressPercent: 10,
          currentStage: "load_tables"
        }, { stageKey: "load_tables", message: "\u5F00\u59CB\u8BFB\u53D6\u6570\u636E\u6E90\u8868\u6E05\u5355" });
        const allTables = await previewService.listObjects(source);
        assertResearchRunNotCancelled(runId);
        const selectedTables = run.tableScope === "manual" ? allTables.filter((item) => run.selectedTables.includes(item.tableName)) : allTables.slice(0, Number(config.maxTables || 50));
        if (!selectedTables.length) {
          throw new AppError(`\u5F53\u524D\u6CA1\u6709\u53EF\u8C03\u7814\u7684\u76EE\u6807${researchObjectLabel(source)}`, 400);
        }
        await log(runId, "load_tables", `\u5DF2\u786E\u5B9A ${selectedTables.length} \u4E2A\u76EE\u6807${researchObjectLabel(source)}\u8FDB\u5165\u8C03\u7814`, {
          detail: {
            tableScope: run.tableScope,
            rowCountMode: config.rowCountMode || "estimated",
            tableNames: selectedTables.map((item) => item.tableName),
            tables: selectedTables.map((item) => ({
              tableName: item.tableName,
              tableComment: item.tableComment || ""
            }))
          }
        });
        await setRunState(runId, {
          progressPercent: 15,
          currentStage: "profile_tables"
        }, { stageKey: "profile_tables", message: "\u5F00\u59CB\u8FDB\u884C\u8868\u7EA7\u4E0E\u5B57\u6BB5\u7EA7\u8C03\u7814" });
        const progress = { count: 0 };
        const totalTables = selectedTables.length;
        const tableProfiles = await runWithConcurrency(selectedTables, Number(config.metadataConcurrency || 3), async (table) => {
          assertResearchRunNotCancelled(runId);
          const profile = await previewService.inspectObjectProfile(source, table.tableName, {
            sampleSize: Number(config.sampleSize || 50),
            tableInfo: table
          });
          assertResearchRunNotCancelled(runId);
          let rowCount = null;
          let rowCountMode = String(config.rowCountMode || "estimated");
          if (hasResearchItem(config, "data_scale") && !isObjectPreviewSource(source)) {
            try {
              rowCount = rowCountMode === "exact" ? await metadataService.countRows(source, table.tableName) : await metadataService.estimateRows(source, table.tableName);
            } catch (error) {
              rowCount = await metadataService.estimateRows(source, table.tableName).catch(() => null);
              rowCountMode = "estimated";
              if (!isResearchRunCancellationRequested(runId)) {
                await log(runId, "data_scale", `\u8868 ${table.tableName} \u884C\u6570\u7EDF\u8BA1\u5931\u8D25\uFF0C\u5DF2\u56DE\u9000\u4E3A\u4F30\u7B97\u6216\u7A7A\u503C`, {
                  logLevel: "warn",
                  detail: { error: error.message || "unknown" }
                });
              }
            }
          } else if (isObjectPreviewSource(source)) {
            rowCount = Array.isArray(profile.sampleRows) ? profile.sampleRows.length : null;
            rowCountMode = "sample";
          }
          assertResearchRunNotCancelled(runId);
          const fieldProfiles = buildFieldProfiles(profile.columns || [], profile.sampleRows || []);
          const fieldSummary = buildFieldSummary(fieldProfiles);
          const metrics = computeSampleMetrics(profile.sampleRows || [], profile.columns || []);
          const ruleDecision = classifyTableByRules(profile, metrics, rowCount, fieldSummary);
          const incrementalColumn = detectIncrementalColumn(profile.columns || []);
          progress.count += 1;
          if (!isResearchRunCancellationRequested(runId)) {
            await repository.updateRun(runId, {
              progressPercent: Math.min(70, 15 + Math.round(progress.count / totalTables * 55)),
              currentStage: "profile_tables"
            });
            await log(runId, "profile_tables", `\u5DF2\u5B8C\u6210 ${progress.count}/${totalTables} \u5F20\u8868\u8C03\u7814`, {
              detail: {
                tableName: table.tableName,
                tableComment: profile.tableComment || "",
                rowCountMode
              }
            });
          }
          return {
            tableName: table.tableName,
            tableComment: profile.tableComment || "",
            rowCountMode,
            rowCount,
            columnCount: Array.isArray(profile.columns) ? profile.columns.length : 0,
            sampleCount: metrics.sampleCount,
            category: ruleDecision.category,
            priority: ruleDecision.priority,
            confidence: ruleDecision.confidence,
            evidence: ruleDecision.evidence,
            risks: ruleDecision.risks,
            suggestedMode: ruleDecision.suggestedMode,
            incrementalColumn,
            metadataIssues: buildMetadataIssues(profile, fieldSummary, metrics),
            quality: { sampleCount: metrics.sampleCount, highNullColumns: metrics.highNullColumns, nullRates: metrics.nullRates },
            sampleRows: profile.sampleRows || [],
            indexes: Array.isArray(profile.indexes) ? profile.indexes.length : 0,
            constraints: Array.isArray(profile.constraints) ? profile.constraints.length : 0,
            constraintDetails: Array.isArray(profile.constraints) ? profile.constraints : [],
            fieldSummary,
            fieldProfiles,
            columns: (profile.columns || []).map((column) => ({
              columnName: column.columnName,
              dataType: column.dataType,
              columnType: column.columnType,
              ordinalPosition: Number(column.ordinalPosition || 0),
              isNullable: Boolean(column.isNullable),
              isPrimaryKey: Boolean(column.isPrimaryKey),
              columnComment: column.columnComment || ""
            }))
          };
        });
        assertResearchRunNotCancelled(runId);
        const orderedProfiles = selectedTables.map((table) => tableProfiles.find((item) => item.tableName === table.tableName)).filter(Boolean);
        await repository.replaceTableProfiles(runId, orderedProfiles);
        await setRunState(runId, { progressPercent: 75, currentStage: "persist_profiles" }, { stageKey: "persist_profiles", message: "\u8868\u753B\u50CF\u548C\u5B57\u6BB5\u753B\u50CF\u5DF2\u843D\u5E93" });
        let aiDecision = null;
        let aiBatches = [];
        if (hasResearchItem(config, "table_classification")) {
          await setRunState(runId, { progressPercent: 80, currentStage: "ai_analysis" }, { stageKey: "ai_analysis", message: "\u5F00\u59CB\u8FDB\u884C\u5206\u6279\u6A21\u578B\u5206\u6790" });
          assertResearchRunNotCancelled(runId);
          const aiResult = await runAiResearch(runId, source, config, orderedProfiles, activeRun.controller.signal);
          aiDecision = aiResult.aiDecision;
          aiBatches = aiResult.batches || [];
        }
        let tableRelationships = null;
        if (hasResearchItem(config, "table_relationship")) {
          await setRunState(runId, { progressPercent: 90, currentStage: "table_relationship" }, { stageKey: "table_relationship", message: "\u5F00\u59CB\u8FDB\u884C\u8868\u5173\u7CFB\u8C03\u7814" });
          assertResearchRunNotCancelled(runId);
          const relationshipProfiles = await expandRelationshipProfiles(
            source,
            allTables,
            orderedProfiles,
            config,
            activeRun.controller.signal
          );
          const supplementedCount = Math.max(0, relationshipProfiles.length - orderedProfiles.length);
          if (supplementedCount) {
            await log(runId, "table_relationship", `\u5DF2\u81EA\u52A8\u8865\u5145 ${supplementedCount} \u5F20\u5B58\u5728\u5173\u8054\u7684\u7269\u7406\u8868\u8FDB\u5165\u5173\u7CFB\u5206\u6790`, {
              detail: {
                selectedTableCount: orderedProfiles.length,
                relationshipTableCount: relationshipProfiles.length,
                supplementedTables: relationshipProfiles.filter((profile) => !orderedProfiles.some((item) => item.tableName === profile.tableName)).map((profile) => profile.tableName)
              }
            });
          }
          const relationshipResult = await analyzeTableRelationships(runId, source, { ...config, tableScope: run.tableScope }, relationshipProfiles, activeRun.controller.signal);
          tableRelationships = relationshipResult.report;
          if (relationshipResult.batch) {
            aiBatches = [...aiBatches, relationshipResult.batch];
          }
        }
        assertResearchRunNotCancelled(runId);
        await repository.replaceAiBatches(runId, aiBatches);
        const mergedProfiles = mergeAiDecision(orderedProfiles, aiDecision);
        const stats = summarizeTables(mergedProfiles);
        const moduleInsightResult = await runModuleInsights(runId, source, config, mergedProfiles, tableRelationships, activeRun.controller.signal);
        if (moduleInsightResult.batches.length) {
          aiBatches = [...aiBatches, ...moduleInsightResult.batches];
          await repository.replaceAiBatches(runId, aiBatches);
        }
        const moduleInsights = moduleInsightResult.insights;
        const recommendedTables = uniqueStrings((aiDecision?.recommendedTables || []).concat(moduleInsights.ingestionAdvice?.recommendedTables || []).concat(mergedProfiles.filter((item) => item.priority === "high" && item.category === "business").map((item) => item.tableName)));
        const deferredTables = uniqueStrings((aiDecision?.deferredTables || []).concat(moduleInsights.ingestionAdvice?.deferredTables || []).concat(mergedProfiles.filter((item) => ["low_value", "temporary", "log"].includes(item.category)).map((item) => item.tableName)));
        const report = {
          source: { id: source.id, sourceName: source.sourceName, sourceCode: source.sourceCode, sourceType: source.sourceType, databaseName: pickDatabaseName(source), schemaName: pickSchemaName(source) },
          run: { id: runId, runName: run.runName, createdAt: run.createdAt, startedAt: (/* @__PURE__ */ new Date()).toISOString() },
          config: { ...config, tableScope: run.tableScope, selectedTables: run.selectedTables },
          overview: { totalTables: stats.totalTables, totalRowCount: stats.totalRowCount, categoryStats: stats.categoryStats, summary: aiDecision?.summary || buildSummaryText(source, mergedProfiles, recommendedTables, deferredTables) },
          analysisBatches: aiBatches.map((item) => ({ stageKey: item.stageKey, batchNo: item.batchNo, batchSize: item.batchSize, status: item.status, durationMs: item.durationMs || null, errorMessage: item.errorMessage || null })),
          ...tableRelationships ? { tableRelationships } : {},
          insights: moduleInsights,
          tables: mergedProfiles,
          recommendations: {
            recommendedTables,
            deferredTables,
            governanceSuggestions: uniqueStrings([...aiDecision?.governanceSuggestions || [], ...moduleInsights.governanceAdvice?.governanceSuggestions || [], ...buildGovernanceSuggestions(mergedProfiles)]),
            ingestionSuggestions: uniqueStrings([...aiDecision?.ingestionSuggestions || [], ...moduleInsights.ingestionAdvice?.ingestionSuggestions || [], ...buildIngestionSuggestions(mergedProfiles)]),
            analysisSuggestions: uniqueStrings(moduleInsights.analysisAdvice?.analysisSuggestions || [])
          }
        };
        const summaryText = normalizeSummaryText(report.overview.summary);
        const completedRun = await setRunState(runId, {
          status: "succeeded",
          progressPercent: 100,
          currentStage: "completed",
          summaryText,
          report,
          finishedAt: /* @__PURE__ */ new Date()
        }, { stageKey: "completed", message: "\u8C03\u7814\u62A5\u544A\u5DF2\u751F\u6210" });
        if (run.taskId) {
          await repository.updateTask(run.taskId, {
            lastRunId: runId,
            lastRunStatus: completedRun.status,
            lastRunAt: completedRun.finishedAt || /* @__PURE__ */ new Date()
          });
        }
      } finally {
        unregisterActiveResearchRun(runId);
      }
    }
    module2.exports = {
      createResearchTask,
      listResearchTasks,
      getResearchTask,
      updateResearchTask,
      deleteResearchTask,
      createResearchTaskRun,
      listResearchTaskRuns,
      compareResearchReports,
      listResearchComparisons,
      getResearchComparison,
      createResearchRun,
      listResearchRuns,
      getResearchRun,
      listResearchLogs,
      getResearchReport,
      downloadResearchReportWord,
      deleteResearchRun,
      terminateResearchRun,
      reconcileRunningResearchRunsAfterRestart
    };
  }
});

// backend/src/modules/data-source-research/data-source-research.controller.js
var require_data_source_research_controller = __commonJS({
  "backend/src/modules/data-source-research/data-source-research.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var service = require_data_source_research_service();
    async function createResearchTask(req, res) {
      const result = await service.createResearchTask(req.validatedBody, req.user);
      return sendSuccess(res, result, null, 201);
    }
    async function listResearchTasks(req, res) {
      const rows = await service.listResearchTasks(req.query || {});
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getResearchTask(req, res) {
      const row = await service.getResearchTask(Number(req.params.taskId));
      return sendSuccess(res, row);
    }
    async function updateResearchTask(req, res) {
      const row = await service.updateResearchTask(Number(req.params.taskId), req.validatedBody, req.user);
      return sendSuccess(res, row);
    }
    async function deleteResearchTask(req, res) {
      const result = await service.deleteResearchTask(Number(req.params.taskId));
      return sendSuccess(res, result);
    }
    async function createResearchTaskRun(req, res) {
      const result = await service.createResearchTaskRun(Number(req.params.taskId), req.user);
      return sendSuccess(res, result, null, 201);
    }
    async function listResearchTaskRuns(req, res) {
      const rows = await service.listResearchTaskRuns(Number(req.params.taskId));
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function compareResearchReports(req, res) {
      const result = await service.compareResearchReports(Number(req.params.taskId), req.validatedBody, req.user);
      return sendSuccess(res, result, null, 201);
    }
    async function listResearchComparisons(req, res) {
      const rows = await service.listResearchComparisons(Number(req.params.taskId));
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getResearchComparison(req, res) {
      const row = await service.getResearchComparison(Number(req.params.comparisonId));
      return sendSuccess(res, row);
    }
    async function createResearchRun(req, res) {
      const result = await service.createResearchRun(Number(req.params.sourceId), req.validatedBody, req.user);
      return sendSuccess(res, result, null, 201);
    }
    async function listResearchRuns(req, res) {
      const rows = await service.listResearchRuns(Number(req.params.sourceId));
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getResearchRun(req, res) {
      const row = await service.getResearchRun(Number(req.params.runId));
      return sendSuccess(res, row);
    }
    async function listResearchLogs(req, res) {
      const rows = await service.listResearchLogs(Number(req.params.runId));
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function getResearchReport(req, res) {
      const report = await service.getResearchReport(Number(req.params.runId));
      return sendSuccess(res, report);
    }
    async function downloadResearchReportWord(req, res) {
      const payload = await service.downloadResearchReportWord(Number(req.params.runId));
      const utf8FileName = encodeURIComponent(payload.fileName || "data_source_research_report.docx");
      let asciiFallbackFileName = String(payload.fileName || "data_source_research_report.docx").replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
      const asciiFallbackBaseName = asciiFallbackFileName.replace(/\.[^.]+$/, "");
      if (!/[A-Za-z0-9]/.test(asciiFallbackBaseName)) {
        asciiFallbackFileName = "data_source_research_report.docx";
      }
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${asciiFallbackFileName}"; filename*=UTF-8''${utf8FileName}`);
      return res.send(payload.buffer);
    }
    async function deleteResearchRun(req, res) {
      const result = await service.deleteResearchRun(Number(req.params.runId));
      return sendSuccess(res, result);
    }
    async function terminateResearchRun(req, res) {
      const result = await service.terminateResearchRun(Number(req.params.runId));
      return sendSuccess(res, result);
    }
    module2.exports = {
      createResearchTask,
      listResearchTasks,
      getResearchTask,
      updateResearchTask,
      deleteResearchTask,
      createResearchTaskRun,
      listResearchTaskRuns,
      compareResearchReports,
      listResearchComparisons,
      getResearchComparison,
      createResearchRun,
      listResearchRuns,
      getResearchRun,
      listResearchLogs,
      getResearchReport,
      downloadResearchReportWord,
      deleteResearchRun,
      terminateResearchRun
    };
  }
});

// packages/data-platform-module-data-source-research/src/.runtime-entry.js
var controller0 = require_data_source_research_controller();
var { Writable } = require("node:stream");
var handlers = {
  "GET /api/v1/data-source-research/tasks": controller0["listResearchTasks"],
  "POST /api/v1/data-source-research/tasks": controller0["createResearchTask"],
  "GET /api/v1/data-source-research/tasks/:taskId": controller0["getResearchTask"],
  "PUT /api/v1/data-source-research/tasks/:taskId": controller0["updateResearchTask"],
  "DELETE /api/v1/data-source-research/tasks/:taskId": controller0["deleteResearchTask"],
  "GET /api/v1/data-source-research/tasks/:taskId/runs": controller0["listResearchTaskRuns"],
  "POST /api/v1/data-source-research/tasks/:taskId/runs": controller0["createResearchTaskRun"],
  "GET /api/v1/data-source-research/tasks/:taskId/comparisons": controller0["listResearchComparisons"],
  "POST /api/v1/data-source-research/tasks/:taskId/compare": controller0["compareResearchReports"],
  "GET /api/v1/data-source-research/comparisons/:comparisonId": controller0["getResearchComparison"],
  "POST /api/v1/data-source-research/source/:sourceId/runs": controller0["createResearchRun"],
  "GET /api/v1/data-source-research/source/:sourceId/runs": controller0["listResearchRuns"],
  "GET /api/v1/data-source-research/runs/:runId": controller0["getResearchRun"],
  "GET /api/v1/data-source-research/runs/:runId/logs": controller0["listResearchLogs"],
  "GET /api/v1/data-source-research/runs/:runId/report": controller0["getResearchReport"],
  "GET /api/v1/data-source-research/runs/:runId/report.docx": controller0["downloadResearchReportWord"],
  "POST /api/v1/data-source-research/runs/:runId/terminate": controller0["terminateResearchRun"],
  "DELETE /api/v1/data-source-research/runs/:runId": controller0["deleteResearchRun"]
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
