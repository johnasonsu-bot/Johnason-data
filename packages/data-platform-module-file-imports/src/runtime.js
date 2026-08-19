var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

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

// backend/src/modules/file-imports/file-import.repository.js
var require_file_import_repository = __commonJS({
  "backend/src/modules/file-imports/file-import.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var { getCurrentProjectId } = require_project_context();
    function parseJsonValue(value, fallback) {
      if (value === null || value === void 0 || value === "") {
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
    function mapTaskRow(row) {
      return {
        id: Number(row.id),
        taskName: row.taskName,
        taskCode: row.taskCode,
        targetSourceId: Number(row.targetSourceId),
        targetSourceName: row.targetSourceName || null,
        targetSourceType: row.targetSourceType || null,
        targetTable: row.targetTable,
        targetTableMode: row.targetTableMode,
        writeMode: row.writeMode,
        description: row.description || "",
        ownerName: row.ownerName,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        parseOptions: parseJsonValue(row.parseOptions, {}),
        fieldMappings: parseJsonValue(row.fieldMappings, []),
        previewSchema: parseJsonValue(row.previewSchema, {}),
        lastRun: row.lastRunId ? {
          id: Number(row.lastRunId),
          runStatus: row.lastRunStatus,
          startTime: row.lastRunStartTime,
          endTime: row.lastRunEndTime,
          totalRows: Number(row.lastRunTotalRows || 0),
          successRows: Number(row.lastRunSuccessRows || 0),
          skippedRows: Number(row.lastRunSkippedRows || 0),
          errorRows: Number(row.lastRunErrorRows || 0),
          errorMessage: row.lastRunErrorMessage || null
        } : null
      };
    }
    function mapFileRow(row) {
      return {
        id: Number(row.id),
        taskId: Number(row.taskId),
        fileName: row.fileName,
        storedFileName: row.storedFileName,
        fileExt: row.fileExt,
        filePath: row.filePath,
        fileSize: Number(row.fileSize || 0),
        fileHash: row.fileHash || null,
        fileOrder: Number(row.fileOrder || 0),
        sheetName: row.sheetName || null,
        settings: parseJsonValue(row.settings, {}),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    function mapRunRow(row) {
      return {
        id: Number(row.id),
        taskId: Number(row.taskId),
        runStatus: row.runStatus,
        startTime: row.startTime,
        endTime: row.endTime,
        totalRows: Number(row.totalRows || 0),
        successRows: Number(row.successRows || 0),
        skippedRows: Number(row.skippedRows || 0),
        errorRows: Number(row.errorRows || 0),
        errorMessage: row.errorMessage || null,
        executionInfo: parseJsonValue(row.executionInfo, {}),
        createdAt: row.createdAt
      };
    }
    async function listTasks(filters = {}) {
      const page = Math.max(1, Number(filters.page || 1));
      const pageSize = Math.max(1, Math.min(100, Number(filters.pageSize || 20)));
      const where = [];
      const params = [];
      const projectId = getCurrentProjectId();
      if (projectId) {
        where.push("fit.project_id = ?");
        params.push(projectId);
      }
      if (filters.status) {
        where.push("fit.status = ?");
        params.push(filters.status);
      }
      if (filters.targetSourceId) {
        where.push("fit.target_source_id = ?");
        params.push(Number(filters.targetSourceId));
      }
      if (filters.keyword) {
        where.push("(fit.task_name LIKE ? OR fit.task_code LIKE ? OR fit.target_table LIKE ?)");
        const keyword = `%${String(filters.keyword).trim()}%`;
        params.push(keyword, keyword, keyword);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const [totalRows] = await pool.query(
        `SELECT COUNT(*) AS total
     FROM file_import_tasks fit
     ${whereSql}`,
        params
      );
      const total = Number(totalRows[0]?.total || 0);
      const offset = (page - 1) * pageSize;
      const [rows] = await pool.query(
        `SELECT fit.id, fit.task_name AS taskName, fit.task_code AS taskCode,
            fit.target_source_id AS targetSourceId, ds.source_name AS targetSourceName, ds.source_type AS targetSourceType,
            fit.target_table AS targetTable, fit.target_table_mode AS targetTableMode, fit.write_mode AS writeMode,
            fit.description, fit.owner_name AS ownerName, fit.status, fit.created_at AS createdAt, fit.updated_at AS updatedAt,
            cfg.parse_options_json AS parseOptions, cfg.field_mappings_json AS fieldMappings, cfg.preview_schema_json AS previewSchema,
            run.id AS lastRunId, run.run_status AS lastRunStatus, run.start_time AS lastRunStartTime, run.end_time AS lastRunEndTime,
            run.total_rows AS lastRunTotalRows, run.success_rows AS lastRunSuccessRows, run.skipped_rows AS lastRunSkippedRows,
            run.error_rows AS lastRunErrorRows, run.error_message AS lastRunErrorMessage
     FROM file_import_tasks fit
     LEFT JOIN data_sources ds ON fit.target_source_id = ds.id
     LEFT JOIN file_import_configs cfg ON cfg.task_id = fit.id
     LEFT JOIN file_import_runs run
       ON run.id = (
         SELECT r1.id
         FROM file_import_runs r1
         WHERE r1.task_id = fit.id
         ORDER BY r1.created_at DESC, r1.id DESC
         LIMIT 1
       )
     ${whereSql}
     ORDER BY fit.updated_at DESC, fit.id DESC
     LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );
      return {
        total,
        page,
        pageSize,
        list: rows.map((row) => mapTaskRow(row))
      };
    }
    async function getTaskById(id) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND fit.project_id = ?" : "";
      const [rows] = await pool.query(
        `SELECT fit.id, fit.task_name AS taskName, fit.task_code AS taskCode,
            fit.target_source_id AS targetSourceId, ds.source_name AS targetSourceName, ds.source_type AS targetSourceType,
            fit.target_table AS targetTable, fit.target_table_mode AS targetTableMode, fit.write_mode AS writeMode,
            fit.description, fit.owner_name AS ownerName, fit.status, fit.created_at AS createdAt, fit.updated_at AS updatedAt,
            cfg.parse_options_json AS parseOptions, cfg.field_mappings_json AS fieldMappings, cfg.preview_schema_json AS previewSchema,
            run.id AS lastRunId, run.run_status AS lastRunStatus, run.start_time AS lastRunStartTime, run.end_time AS lastRunEndTime,
            run.total_rows AS lastRunTotalRows, run.success_rows AS lastRunSuccessRows, run.skipped_rows AS lastRunSkippedRows,
            run.error_rows AS lastRunErrorRows, run.error_message AS lastRunErrorMessage
     FROM file_import_tasks fit
     LEFT JOIN data_sources ds ON fit.target_source_id = ds.id
     LEFT JOIN file_import_configs cfg ON cfg.task_id = fit.id
     LEFT JOIN file_import_runs run
       ON run.id = (
         SELECT r1.id
         FROM file_import_runs r1
         WHERE r1.task_id = fit.id
         ORDER BY r1.created_at DESC, r1.id DESC
         LIMIT 1
       )
     WHERE fit.id = ?${projectWhere}
     LIMIT 1`,
        projectId ? [id, projectId] : [id]
      );
      return rows[0] ? mapTaskRow(rows[0]) : null;
    }
    async function listTaskFiles(taskId) {
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, file_name AS fileName, stored_file_name AS storedFileName,
            file_ext AS fileExt, file_path AS filePath, file_size AS fileSize, file_hash AS fileHash,
            file_order AS fileOrder, sheet_name AS sheetName, settings_json AS settings,
            created_at AS createdAt, updated_at AS updatedAt
     FROM file_import_task_files
     WHERE task_id = ?
     ORDER BY file_order ASC, id ASC`,
        [taskId]
      );
      return rows.map((row) => mapFileRow(row));
    }
    async function createTask(payload) {
      const projectId = Number(payload.projectId || getCurrentProjectId() || 0) || null;
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.query(
          `INSERT INTO file_import_tasks
        (project_id, task_name, task_code, target_source_id, target_table, target_table_mode, write_mode, description, owner_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            payload.taskName,
            payload.taskCode,
            payload.targetSourceId,
            payload.targetTable,
            payload.targetTableMode || "create",
            payload.writeMode || "append",
            payload.description || null,
            payload.ownerName || "system",
            payload.status || "draft"
          ]
        );
        const taskId = Number(result.insertId);
        await connection.query(
          `INSERT INTO file_import_configs
        (task_id, parse_options_json, field_mappings_json, preview_schema_json)
       VALUES (?, ?, ?, ?)`,
          [
            taskId,
            JSON.stringify(payload.parseOptions || {}),
            JSON.stringify(payload.fieldMappings || []),
            JSON.stringify(payload.previewSchema || {})
          ]
        );
        for (const file of payload.files || []) {
          await connection.query(
            `INSERT INTO file_import_task_files
          (task_id, file_name, stored_file_name, file_ext, file_path, file_size, file_hash, file_order, sheet_name, settings_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              taskId,
              file.fileName,
              file.storedFileName,
              file.fileExt,
              file.filePath,
              file.fileSize || 0,
              file.fileHash || null,
              file.fileOrder || 0,
              file.sheetName || null,
              JSON.stringify(file.settings || {})
            ]
          );
        }
        await connection.commit();
        return taskId;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function updateTask(id, payload) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.query(
          `UPDATE file_import_tasks
       SET task_name = ?, target_source_id = ?, target_table = ?, target_table_mode = ?,
           write_mode = ?, description = ?, status = ?, updated_at = NOW()
       WHERE id = ?${projectWhere}`,
          [
            payload.taskName,
            payload.targetSourceId,
            payload.targetTable,
            payload.targetTableMode || "create",
            payload.writeMode || "append",
            payload.description || null,
            payload.status || "draft",
            id,
            ...projectId ? [projectId] : []
          ]
        );
        if (Number(result.affectedRows || 0) === 0) {
          await connection.rollback();
          return false;
        }
        await connection.query(
          `INSERT INTO file_import_configs
        (task_id, parse_options_json, field_mappings_json, preview_schema_json)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        parse_options_json = VALUES(parse_options_json),
        field_mappings_json = VALUES(field_mappings_json),
        preview_schema_json = VALUES(preview_schema_json),
        updated_at = NOW()`,
          [
            id,
            JSON.stringify(payload.parseOptions || {}),
            JSON.stringify(payload.fieldMappings || []),
            JSON.stringify(payload.previewSchema || {})
          ]
        );
        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    async function deleteTask(id) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [result] = await pool.query(
        `DELETE FROM file_import_tasks WHERE id = ?${projectWhere}`,
        projectId ? [id, projectId] : [id]
      );
      return Number(result.affectedRows || 0) > 0;
    }
    async function createRun(taskId) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO file_import_runs (project_id, task_id, run_status, start_time)
     VALUES (?, ?, 'running', NOW())`,
        [projectId, taskId]
      );
      return Number(result.insertId);
    }
    async function updateRun(runId, payload) {
      const fields = [];
      const values = [];
      if (payload.runStatus !== void 0) {
        fields.push("run_status = ?");
        values.push(payload.runStatus);
      }
      if (payload.startTime !== void 0) {
        fields.push("start_time = ?");
        values.push(payload.startTime);
      }
      if (payload.endTime !== void 0) {
        fields.push("end_time = ?");
        values.push(payload.endTime);
      }
      if (payload.totalRows !== void 0) {
        fields.push("total_rows = ?");
        values.push(payload.totalRows);
      }
      if (payload.successRows !== void 0) {
        fields.push("success_rows = ?");
        values.push(payload.successRows);
      }
      if (payload.skippedRows !== void 0) {
        fields.push("skipped_rows = ?");
        values.push(payload.skippedRows);
      }
      if (payload.errorRows !== void 0) {
        fields.push("error_rows = ?");
        values.push(payload.errorRows);
      }
      if (payload.errorMessage !== void 0) {
        fields.push("error_message = ?");
        values.push(payload.errorMessage);
      }
      if (payload.executionInfo !== void 0) {
        fields.push("execution_info_json = ?");
        values.push(JSON.stringify(payload.executionInfo || {}));
      }
      if (fields.length === 0) {
        return;
      }
      values.push(runId);
      await pool.query(`UPDATE file_import_runs SET ${fields.join(", ")} WHERE id = ?`, values);
    }
    async function addRunErrors(runId, items = []) {
      if (!Array.isArray(items) || items.length === 0) {
        return;
      }
      const values = items.map((item) => [
        runId,
        item.fileId || null,
        item.fileName || null,
        item.sheetName || null,
        item.rowNo || null,
        item.columnName || null,
        item.errorType || "parse",
        item.errorMessage || "\u672A\u77E5\u9519\u8BEF",
        JSON.stringify(item.rawData || {})
      ]);
      await pool.query(
        `INSERT INTO file_import_run_errors
      (run_id, file_id, file_name, sheet_name, row_no, column_name, error_type, error_message, raw_data_json)
     VALUES ?`,
        [values]
      );
    }
    async function listRuns(taskId, limit = 20) {
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, run_status AS runStatus, start_time AS startTime, end_time AS endTime,
            total_rows AS totalRows, success_rows AS successRows, skipped_rows AS skippedRows, error_rows AS errorRows,
            error_message AS errorMessage, execution_info_json AS executionInfo, created_at AS createdAt
     FROM file_import_runs
     WHERE task_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
        [taskId, Math.max(1, Math.min(100, Number(limit || 20)))]
      );
      return rows.map((row) => mapRunRow(row));
    }
    async function getRunById(runId) {
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, run_status AS runStatus, start_time AS startTime, end_time AS endTime,
            total_rows AS totalRows, success_rows AS successRows, skipped_rows AS skippedRows, error_rows AS errorRows,
            error_message AS errorMessage, execution_info_json AS executionInfo, created_at AS createdAt
     FROM file_import_runs
     WHERE id = ?
     LIMIT 1`,
        [runId]
      );
      return rows[0] ? mapRunRow(rows[0]) : null;
    }
    async function listRunErrors(runId, options = {}) {
      const page = Math.max(1, Number(options.page || 1));
      const pageSize = Math.max(1, Math.min(500, Number(options.pageSize || options.limit || 20)));
      const offset = (page - 1) * pageSize;
      const [totalRows] = await pool.query(
        "SELECT COUNT(*) AS total FROM file_import_run_errors WHERE run_id = ?",
        [runId]
      );
      const total = Number(totalRows[0]?.total || 0);
      const [rows] = await pool.query(
        `SELECT id, run_id AS runId, file_id AS fileId, file_name AS fileName, sheet_name AS sheetName,
            row_no AS rowNo, column_name AS columnName, error_type AS errorType, error_message AS errorMessage,
            raw_data_json AS rawData, created_at AS createdAt
     FROM file_import_run_errors
     WHERE run_id = ?
     ORDER BY id ASC
     LIMIT ? OFFSET ?`,
        [runId, pageSize, offset]
      );
      return {
        total,
        page,
        pageSize,
        list: rows.map((row) => ({
          id: Number(row.id),
          runId: Number(row.runId),
          fileId: row.fileId ? Number(row.fileId) : null,
          fileName: row.fileName || null,
          sheetName: row.sheetName || null,
          rowNo: row.rowNo ? Number(row.rowNo) : null,
          columnName: row.columnName || null,
          errorType: row.errorType,
          errorMessage: row.errorMessage,
          rawData: parseJsonValue(row.rawData, {}),
          createdAt: row.createdAt
        }))
      };
    }
    module2.exports = {
      addRunErrors,
      createRun,
      createTask,
      deleteTask,
      getRunById,
      getTaskById,
      listRunErrors,
      listRuns,
      listTaskFiles,
      listTasks,
      updateTask,
      updateRun
    };
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

// backend/src/modules/file-imports/file-import.service.js
var require_file_import_service = __commonJS({
  "backend/src/modules/file-imports/file-import.service.js"(exports2, module2) {
    var crypto = require("crypto");
    var fs = require("fs");
    var path = require("path");
    var mysql = require("mysql2/promise");
    var AppError = require_app_error();
    var repository = require_file_import_repository();
    var dataSourceRepository = require_data_source_repository();
    var dataSourceMetadata = require_data_source_metadata();
    var hiveService = require_hiveService();
    var ingestionAiConfigService = require_ingestion_ai_config_service();
    var modelProviderService = require_model_provider_service();
    var { createPostgresLikeClient } = require_db_client();
    var { inferDatasourceDialect, normalizeDatasourceType, resolveDatasourceConnection } = require_datasource_dialect();
    var { buildPreviewResult, detectFileType, parseFileBuffer } = require_file_import_parser();
    var STORAGE_ROOT = path.resolve(__dirname, "../../../runtime/file-imports");
    var SUPPORTED_FILE_TYPES = /* @__PURE__ */ new Set(["csv", "txt", "xls", "xlsx", "json", "xml"]);
    var SUPPORTED_TARGET_DIALECTS = /* @__PURE__ */ new Set(["mysql", "postgresql", "hive"]);
    var DEFAULT_PREVIEW_LIMIT = 50;
    var FIELD_TRANSLATION_SAMPLE_LIMIT = 50;
    var FIELD_TRANSLATION_SAMPLE_TEXT_LIMIT = 160;
    function ensureStorageRoot() {
      fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    }
    function safeJsonParse(value, fallback) {
      if (value === null || value === void 0 || value === "") {
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
      const slug = String(taskName || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
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
        [/更新/g, "updated"]
      ];
      let text = String(value || "").trim().replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().replace(/[()（）【】\[\]{}]/g, " ").replace(/[\/\\|,.，。:：;；'"`~!@#$%^&*+=?<>-]/g, " ");
      tokenMap.forEach(([pattern, replacement]) => {
        text = text.replace(pattern, ` ${replacement} `);
      });
      text = text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      if (!text || /[\u4e00-\u9fa5]/.test(text)) {
        text = fallback;
      }
      if (mode === "camelCase") {
        return text.split("_").filter(Boolean).map((part, index) => index === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`).join("");
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
      return String(value || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).map((item) => item.trim()).filter(Boolean);
    }
    var ENGLISH_FIELD_TOKEN_LABELS = {
      id: "\u6807\u8BC6",
      no: "\u7F16\u53F7",
      num: "\u53F7\u7801",
      number: "\u7F16\u53F7",
      code: "\u7F16\u7801",
      name: "\u540D\u79F0",
      type: "\u7C7B\u578B",
      status: "\u72B6\u6001",
      date: "\u65E5\u671F",
      time: "\u65F6\u95F4",
      at: "\u65F6\u95F4",
      created: "\u521B\u5EFA",
      updated: "\u66F4\u65B0",
      create: "\u521B\u5EFA",
      update: "\u66F4\u65B0",
      remark: "\u5907\u6CE8",
      memo: "\u5907\u6CE8",
      note: "\u5907\u6CE8",
      desc: "\u63CF\u8FF0",
      description: "\u63CF\u8FF0",
      text: "\u6587\u672C",
      value: "\u503C",
      amount: "\u91D1\u989D",
      price: "\u4EF7\u683C",
      count: "\u6570\u91CF",
      qty: "\u6570\u91CF",
      quantity: "\u6570\u91CF",
      weight: "\u6743\u91CD",
      rate: "\u6BD4\u4F8B",
      ratio: "\u6BD4\u4F8B",
      flag: "\u6807\u5FD7",
      phone: "\u7535\u8BDD",
      mobile: "\u624B\u673A\u53F7",
      tel: "\u7535\u8BDD",
      email: "\u90AE\u7BB1",
      address: "\u5730\u5740",
      addr: "\u5730\u5740",
      province: "\u7701\u4EFD",
      city: "\u57CE\u5E02",
      county: "\u533A\u53BF",
      district: "\u533A\u5212",
      road: "\u9053\u8DEF",
      street: "\u8857\u9053",
      doorplate: "\u95E8\u724C",
      park: "\u56ED\u533A",
      zone: "\u533A\u57DF",
      functional: "\u529F\u80FD",
      building: "\u5EFA\u7B51",
      house: "\u623F\u5C4B",
      room: "\u623F\u95F4",
      population: "\u4EBA\u53E3",
      person: "\u4EBA\u5458",
      user: "\u7528\u6237",
      customer: "\u5BA2\u6237",
      certificate: "\u8BC1\u4E66",
      cert: "\u8BC1\u4E66",
      gender: "\u6027\u522B",
      marriage: "\u5A5A\u59FB",
      registration: "\u767B\u8BB0",
      reg: "\u767B\u8BB0",
      office: "\u673A\u6784",
      org: "\u673A\u6784",
      organization: "\u673A\u6784",
      dept: "\u90E8\u95E8",
      department: "\u90E8\u95E8"
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
        reason: "fallback_rule"
      };
    }
    function normalizeDataTypeCandidate(value) {
      const text = String(value || "").trim().toLowerCase();
      if (!text) return "";
      const varcharMatch = text.match(/^varchar\((\d+)\)$/);
      if (varcharMatch) {
        const length = Math.max(32, Math.min(4e3, Number(varcharMatch[1] || 255)));
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
        if (value === null || value === void 0) return max;
        return Math.max(max, String(value).trim().length);
      }, 0);
      const maxLength = Math.max(Number(context.maxLength || 0), sampleMaxLength);
      if (maxLength > 255) return "text";
      if (maxLength > 128) return "varchar(255)";
      if (maxLength > 64) return "varchar(128)";
      return "varchar(64)";
    }
    function getNonEmptySamples(context = {}) {
      return (context.sampleValues || []).map((value) => value === null || value === void 0 ? "" : String(value).trim()).filter(Boolean);
    }
    function shouldPreferStringField(context = {}) {
      const text = [
        context.sourceField,
        context.targetField,
        context.columnComment
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
      return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}[ tT]\d{1,2}:\d{2}(:\d{2})?$/.test(value) && !Number.isNaN(new Date(value.replace(/\//g, "-")).getTime());
    }
    function isBooleanText(value) {
      return /^(true|false|1|0|yes|no|y|n|是|否)$/i.test(value);
    }
    function isJsonText(value) {
      if (!(value.startsWith("{") && value.endsWith("}") || value.startsWith("[") && value.endsWith("]"))) {
        return false;
      }
      return Boolean(safeJsonParse(value, null));
    }
    function normalizeSuggestedDataType(rawDataType, context = {}) {
      const candidate = normalizeDataTypeCandidate(rawDataType) || normalizeDataTypeCandidate(context.dataType) || getConservativeStringType(context);
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
        tab: "	",
        comma: ",",
        semicolon: ";"
      };
      const rawDelimiter = raw.delimiter === "" || raw.delimiter === null || raw.delimiter === void 0 ? void 0 : String(raw.delimiter);
      return {
        headerRowNumber: Math.max(1, Number(raw.headerRowNumber || 1)),
        firstDataRowNumber: Math.max(1, Number(raw.firstDataRowNumber || 2)),
        fieldNameMode: ["header", "generated"].includes(String(raw.fieldNameMode || "").toLowerCase()) ? String(raw.fieldNameMode).toLowerCase() : "header",
        delimiter: rawDelimiter ? delimiterMap[String(rawDelimiter).trim().toLowerCase()] || rawDelimiter : void 0,
        quoteChar: raw.quoteChar ? String(raw.quoteChar) : '"',
        encoding: raw.encoding ? String(raw.encoding) : "utf8",
        jsonRootPath: raw.jsonRootPath ? String(raw.jsonRootPath) : "",
        xmlRowPath: raw.xmlRowPath ? String(raw.xmlRowPath) : "",
        technicalNameMode: ["snake_case", "camelCase", "upper_snake"].includes(String(raw.technicalNameMode || "")) ? String(raw.technicalNameMode) : "snake_case",
        skipErrorRows: Boolean(raw.skipErrorRows),
        rebuildTargetTable: Boolean(raw.rebuildTargetTable),
        previewLimit,
        batchSize: Math.max(1, Math.min(1e3, Number(raw.batchSize || 200)))
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
          fileName: normalizedName
        };
      });
    }
    function normalizeFileOptions(fileName, optionsMap = /* @__PURE__ */ new Map()) {
      const current = optionsMap.get(normalizeUploadedFileName(fileName)) || {};
      return {
        sheetName: current.sheetName ? String(current.sheetName) : void 0,
        jsonRootPath: current.jsonRootPath ? String(current.jsonRootPath) : void 0,
        xmlRowPath: current.xmlRowPath ? String(current.xmlRowPath) : void 0
      };
    }
    function buildFileOptionsMap(items = []) {
      return new Map(
        (Array.isArray(items) ? items : []).filter((item) => item && item.fileName).map((item) => [normalizeUploadedFileName(item.fileName), item])
      );
    }
    function mergePreviewSchemas(previews = [], technicalNameMode = "snake_case") {
      const fieldMap = /* @__PURE__ */ new Map();
      previews.forEach((preview) => {
        (preview.schema || []).forEach((field, index) => {
          const existing = fieldMap.get(field.sourceField);
          const suggestedTargetField = normalizeIdentifier(
            field.sourceField,
            `field_${fieldMap.size + 1}`,
            technicalNameMode
          );
          const next = existing ? {
            ...existing,
            nullable: existing.nullable || field.nullable,
            maxLength: Math.max(Number(existing.maxLength || 0), Number(field.maxLength || 0)),
            sampleValues: [.../* @__PURE__ */ new Set([...existing.sampleValues || [], ...field.sampleValues || []])].slice(0, FIELD_TRANSLATION_SAMPLE_LIMIT),
            sourceFiles: [.../* @__PURE__ */ new Set([...existing.sourceFiles || [], preview.fileName])],
            order: Math.min(existing.order, index)
          } : {
            sourceField: field.sourceField,
            targetField: suggestedTargetField,
            dataType: field.suggestedType,
            inferredType: field.inferredType,
            nullable: field.nullable,
            maxLength: field.maxLength,
            sampleValues: field.sampleValues || [],
            sourceFiles: [preview.fileName],
            order: index
          };
          fieldMap.set(field.sourceField, next);
        });
      });
      return Array.from(fieldMap.values()).sort((a, b) => a.order - b.order).map((item, index) => ({
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
        columnComment: item.sourceField
      }));
    }
    function normalizeFieldMappings(items = [], fallbackSchema = [], technicalNameMode = "snake_case") {
      const sourceMap = new Map(fallbackSchema.map((item) => [item.sourceField, item]));
      const usedTargets = /* @__PURE__ */ new Set();
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
          customValue: item.customValue !== void 0 && item.customValue !== null ? String(item.customValue) : null,
          autoMapped: Boolean(item.autoMapped),
          matchStatus: item.matchStatus || null,
          isPrimaryKey: Boolean(item.isPrimaryKey),
          nullable: item.nullable !== void 0 ? Boolean(item.nullable) : Boolean(schemaField.nullable),
          maxLength: Number(item.maxLength || schemaField.maxLength || 0),
          sampleValues: Array.isArray(item.sampleValues) ? item.sampleValues : schemaField.sampleValues || [],
          sourceFiles: Array.isArray(item.sourceFiles) ? item.sourceFiles : schemaField.sourceFiles || [],
          columnComment: String(item.columnComment || schemaField.columnComment || sourceField || targetField)
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
        fieldMappings: Array.isArray(raw.fieldMappings) ? raw.fieldMappings : []
      };
    }
    function ensureFiles(files = []) {
      if (!Array.isArray(files) || files.length === 0) {
        throw new AppError("\u8BF7\u81F3\u5C11\u4E0A\u4F20\u4E00\u4E2A\u6587\u4EF6", 400);
      }
      files.forEach((file) => {
        const fileType = detectFileType(file.originalname || "");
        if (!SUPPORTED_FILE_TYPES.has(fileType)) {
          throw new AppError(`\u6682\u4E0D\u652F\u6301\u7684\u6587\u4EF6\u7C7B\u578B\uFF1A${file.originalname}`, 400);
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
          previewOnly: true
        });
        return buildPreviewResult(file, parseResult, {
          ...parseOptions,
          ...fileOptions
        });
      });
      const mergedSchema = mergePreviewSchemas(previews, parseOptions.technicalNameMode);
      return {
        parseOptions,
        previews,
        mergedSchema
      };
    }
    function buildStoredFilePreviewContext(taskFiles = [], rawConfig = {}) {
      const pseudoFiles = (Array.isArray(taskFiles) ? taskFiles : []).map((file) => ({
        originalname: file.fileName,
        fileName: file.fileName,
        buffer: fs.readFileSync(file.filePath),
        size: file.fileSize
      }));
      return buildPreviewContext(pseudoFiles, rawConfig);
    }
    async function previewFiles(files, rawConfig = {}) {
      const context = buildPreviewContext(files, rawConfig);
      return {
        files: context.previews,
        mergedSchema: context.mergedSchema,
        suggestedMappings: normalizeFieldMappings([], context.mergedSchema, context.parseOptions.technicalNameMode)
      };
    }
    function ensureTargetSupported(targetSource) {
      if (!targetSource) {
        throw new AppError("\u76EE\u6807\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      }
      const dialect = resolveTargetDialect(targetSource);
      if (!SUPPORTED_TARGET_DIALECTS.has(dialect)) {
        throw new AppError(`\u5F53\u524D\u4EC5\u652F\u6301\u5BFC\u5165\u5230 MySQL / PostgreSQL / GaussDB / Hive\uFF0C\u5F53\u524D\u76EE\u6807\u7C7B\u578B\u4E3A ${targetSource.sourceType}`, 400);
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
        throw new AppError("\u81F3\u5C11\u9700\u8981\u4E00\u4E2A\u542F\u7528\u5B57\u6BB5", 400);
      }
      return enabledMappings.map((item) => ({
        columnName: item.targetField,
        columnType: toTargetColumnType(item.dataType, targetDialect),
        dataType: toTargetColumnType(item.dataType, targetDialect),
        isNullable: item.nullable !== false,
        isPrimaryKey: Boolean(item.isPrimaryKey),
        columnDefault: null,
        extra: "",
        columnComment: item.columnComment || item.sourceField
      }));
    }
    function parseBooleanValue(value) {
      if (value === null || value === void 0 || value === "") {
        return null;
      }
      if (typeof value === "boolean") {
        return value;
      }
      const text = String(value).trim().toLowerCase();
      if (["1", "true", "yes", "y", "\u662F"].includes(text)) return true;
      if (["0", "false", "no", "n", "\u5426"].includes(text)) return false;
      throw new Error("\u65E0\u6CD5\u89E3\u6790\u4E3A\u5E03\u5C14\u503C");
    }
    function convertCellValue(value, dataType, targetDialect) {
      if (value === null || value === void 0 || value === "") {
        return null;
      }
      const normalized = String(dataType || "text").trim().toLowerCase();
      if (normalized.includes("bool")) {
        return parseBooleanValue(value);
      }
      if (normalized.includes("int")) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
          throw new Error("\u65E0\u6CD5\u89E3\u6790\u4E3A\u6574\u6570");
        }
        return Math.trunc(parsed);
      }
      if (normalized.includes("decimal") || normalized.includes("numeric") || normalized === "double" || normalized === "float" || normalized === "real") {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
          throw new Error("\u65E0\u6CD5\u89E3\u6790\u4E3A\u6570\u503C");
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
          throw new Error("\u65E0\u6CD5\u89E3\u6790\u4E3A\u65E5\u671F");
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
        ...item.settings || {}
      })));
      taskFiles.forEach((taskFile) => {
        const buffer = fs.readFileSync(taskFile.filePath);
        const pseudoFile = {
          originalname: taskFile.fileName,
          buffer,
          size: taskFile.fileSize,
          fileName: taskFile.fileName
        };
        const fileOptions = normalizeFileOptions(taskFile.fileName, fileOptionsMap);
        const parseResult = parseFileBuffer(pseudoFile, {
          ...parseOptions,
          ...fileOptions,
          ...taskFile.sheetName ? { sheetName: taskFile.sheetName } : {}
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
            rawData: { raw: error.rawData || null }
          });
        });
        parseResult.rows.forEach((row) => {
          rows.push({
            fileId: taskFile.id,
            fileName: taskFile.fileName,
            sheetName: parseResult.parseMeta?.selectedSheetName || taskFile.sheetName || null,
            rowNo: row.__rowNo || null,
            raw: row
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
            const rawValue = mapping.mappingMode === "custom" ? mapping.customValue : row.raw?.[mapping.sourceField];
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
              raw: row.raw
            }
          });
        } catch (error) {
          const mapping = failedMapping || {};
          const sourceLabel = mapping.mappingMode === "custom" ? "\u81EA\u5B9A\u4E49\u503C" : mapping.sourceField || "-";
          const targetLabel = mapping.targetField || mapping.sourceField || "-";
          const rawValueText = failedRawValue === null || failedRawValue === void 0 || failedRawValue === "" ? "\u7A7A\u503C" : String(failedRawValue);
          const message = `\u5B57\u6BB5\u8F6C\u6362\u5931\u8D25\uFF1A\u6765\u6E90\u5B57\u6BB5\u300C${sourceLabel}\u300D-> \u76EE\u6807\u5B57\u6BB5\u300C${targetLabel}\u300D\uFF0C\u76EE\u6807\u7C7B\u578B\u300C${mapping.dataType || "-"}\u300D\uFF0C\u539F\u59CB\u503C\u300C${rawValueText}\u300D\uFF0C\u539F\u56E0\uFF1A${error.message || "\u65E0\u6CD5\u5B8C\u6210\u7C7B\u578B\u8F6C\u6362"}`;
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
              row: row.raw
            }
          };
          if (!skipErrorRows) {
            throw new AppError(`\u7B2C ${row.rowNo || "?"} \u884C\u5B57\u6BB5\u8F6C\u6362\u5931\u8D25\uFF1A${detail.errorMessage}`, 400, detail);
          }
          errors.push(detail);
        }
      });
      return {
        rows: targetRows,
        errors
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
          connectTimeout: 1e4
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
        connectionTimeoutMillis: 1e4
      }, {
        sourceType: normalizeDatasourceType(dataSource.sourceType) === "gaussdb" ? "gaussdb" : "postgresql"
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
            `TRUNCATE TABLE ${dataSourceMetadata.escapeIdentifier(tableName, "hive")};`
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
            `DROP TABLE IF EXISTS ${dataSourceMetadata.escapeIdentifier(tableName, "hive")};`
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
      const messages = [error?.column, error?.columnName, error?.field, error?.sqlMessage, error?.message].filter(Boolean).map((item) => String(item));
      const patterns = [
        /(?:column|field)\s+['"`]([^'"`]+)['"`]/i,
        /for column\s+['"`]([^'"`]+)['"`]/i,
        /column\s+"([^"]+)"/i
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
        const columns2 = fieldMappings.filter((item) => item.enabled !== false).map((item) => ({ columnName: item.targetField, dataType: item.dataType }));
        await hiveService.loadRows(dataSource.connectionConfig || {}, tableName, columns2, targetRows.map((item) => item.data), {
          writeMode: "append",
          batchSize: 200
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
        const placeholders = columns.map((_, index) => dialect === "postgresql" ? `${placeholderPrefix}${index + 1}` : placeholderPrefix).join(", ");
        const sql = `INSERT INTO ${escapeLiteralIdentifier(tableName, dialect)} (${columnSql}) VALUES (${placeholders})`;
        for (const row of targetRows) {
          const values = columns.map((column) => row.data[column] ?? null);
          try {
            await connection.query(sql, values);
            successRows += 1;
          } catch (error) {
            const columnName = inferErrorColumnName(error, columns);
            const errorMessage = columnName ? `\u5199\u5165\u76EE\u6807\u8868\u5931\u8D25\uFF1A\u5B57\u6BB5\u300C${columnName}\u300D\uFF0C\u539F\u56E0\uFF1A${error.message || "\u5199\u5165\u76EE\u6807\u8868\u5931\u8D25"}` : error.message || "\u5199\u5165\u76EE\u6807\u8868\u5931\u8D25";
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
                errorCode: error.code || null
              }
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
          tableComment: task.description || task.taskName
        });
        return { action: rebuildTargetTable ? "rebuilt" : "ensured" };
      }
      if (rebuildTargetTable || task.targetTableMode === "create") {
        if (rebuildTargetTable) {
          await dropTargetTableIfExists(dataSource, task.targetTable, targetDialect);
        }
        const result = await dataSourceMetadata.ensureTableMatchesColumns(dataSource, task.targetTable, targetColumns, {
          tableComment: task.description || task.taskName
        });
        return rebuildTargetTable ? { ...result, action: "rebuilt" } : result;
      }
      const tables = await dataSourceMetadata.listTables(dataSource);
      const exists = tables.some((item) => item.tableName === task.targetTable);
      if (!exists) {
        throw new AppError(`\u76EE\u6807\u8868 ${task.targetTable} \u4E0D\u5B58\u5728`, 400);
      }
      const existingColumns = await dataSourceMetadata.listColumns(dataSource, task.targetTable);
      const targetColumnSet = new Set(existingColumns.map((item) => String(item.columnName || "").trim().toLowerCase()));
      const missingMappings = fieldMappings.filter((item) => item.enabled !== false).filter((item) => !targetColumnSet.has(String(item.targetField || "").trim().toLowerCase()));
      if (missingMappings.length > 0) {
        throw new AppError(
          `\u5DF2\u6709\u8868\u6620\u5C04\u4E2D\u5B58\u5728\u672A\u5339\u914D\u76EE\u6807\u5B57\u6BB5\uFF1A${missingMappings.map((item) => item.targetField || item.sourceField).join("\u3001")}`,
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
            settings: fileOptionsMap.get(file.originalname) || {}
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
        throw new AppError("\u4EFB\u52A1\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      if (!payload.targetSourceId) {
        throw new AppError("\u8BF7\u9009\u62E9\u76EE\u6807\u6570\u636E\u6E90", 400);
      }
      if (!payload.targetTable) {
        throw new AppError("\u76EE\u6807\u8868\u540D\u4E0D\u80FD\u4E3A\u7A7A", 400);
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
            mergedSchema: preview.mergedSchema
          },
          fieldMappings,
          files: taskFiles
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
        status: rawConfig.status || current.status || "draft"
      }, user);
      if (!payload.taskName) {
        throw new AppError("\u4EFB\u52A1\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      if (!payload.targetSourceId) {
        throw new AppError("\u8BF7\u9009\u62E9\u76EE\u6807\u6570\u636E\u6E90", 400);
      }
      if (!payload.targetTable) {
        throw new AppError("\u76EE\u6807\u8868\u540D\u4E0D\u80FD\u4E3A\u7A7A", 400);
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
          mergedSchema: preview.mergedSchema
        },
        fieldMappings
      });
      if (!updated) {
        throw new AppError("\u6587\u4EF6\u4E0A\u4F20\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
      }
      return getTaskDetail(current.id);
    }
    async function getTaskDetail(id) {
      const task = await repository.getTaskById(Number(id));
      if (!task) {
        throw new AppError("\u6587\u4EF6\u4E0A\u4F20\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
      }
      const files = await repository.listTaskFiles(task.id);
      return {
        ...task,
        files
      };
    }
    async function listTasks(filters = {}) {
      return repository.listTasks(filters);
    }
    async function deleteTask(id) {
      const task = await getTaskDetail(id);
      const deleted = await repository.deleteTask(task.id);
      if (!deleted) {
        throw new AppError("\u6587\u4EF6\u4E0A\u4F20\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
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
          throw new AppError("\u5B58\u5728\u89E3\u6790\u9519\u8BEF\u884C\uFF0C\u4E14\u5F53\u524D\u914D\u7F6E\u4E3A\u9047\u9519\u7EC8\u6B62", 400, parseErrors[0]);
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
            progressPercent: rawRows.length > 0 ? Number((initialErrorCount / rawRows.length * 100).toFixed(2)) : 100,
            rowsPerSecond: 0,
            elapsedSeconds: Number(((Date.now() - runStartedAt) / 1e3).toFixed(1)),
            targetDialect,
            fileCount: (task.files || []).length,
            targetTable: task.targetTable
          }
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
                errorRows: initialErrorCount + progress.errorRows
              };
              const currentRun = await repository.getRunById(runId);
              if (currentRun?.runStatus === "cancelling") {
                const cancellationError = new Error("\u7528\u6237\u624B\u52A8\u7EC8\u6B62");
                cancellationError.code = "FILE_IMPORT_CANCELLED";
                throw cancellationError;
              }
              const isFinalProgress = progress.processedRows >= converted.rows.length;
              if (!isFinalProgress && now - lastProgressUpdateAt < 1e3) {
                return;
              }
              lastProgressUpdateAt = now;
              const elapsedSeconds2 = Math.max((now - runStartedAt) / 1e3, 1e-3);
              await repository.updateRun(runId, {
                totalRows: rawRows.length,
                successRows: latestProgress.successRows,
                skippedRows: latestProgress.errorRows,
                errorRows: latestProgress.errorRows,
                executionInfo: {
                  phase: "writing",
                  processedRows: latestProgress.processedRows,
                  progressPercent: rawRows.length > 0 ? Number((latestProgress.processedRows / rawRows.length * 100).toFixed(2)) : 100,
                  rowsPerSecond: Number((latestProgress.processedRows / elapsedSeconds2).toFixed(2)),
                  elapsedSeconds: Number(elapsedSeconds2.toFixed(1)),
                  targetDialect,
                  fileCount: (task.files || []).length,
                  targetTable: task.targetTable
                }
              });
            }
          );
        } catch (error) {
          if (error.code !== "FILE_IMPORT_CANCELLED") {
            throw error;
          }
          const interruptedInsertErrors = Array.isArray(error.insertErrors) ? error.insertErrors : [];
          allErrors = [...allErrors, ...interruptedInsertErrors];
          const elapsedSeconds2 = Math.max((Date.now() - runStartedAt) / 1e3, 1e-3);
          await repository.addRunErrors(runId, allErrors);
          await repository.updateRun(runId, {
            runStatus: "cancelled",
            endTime: /* @__PURE__ */ new Date(),
            totalRows: rawRows.length,
            successRows: latestProgress.successRows,
            skippedRows: latestProgress.errorRows,
            errorRows: latestProgress.errorRows,
            errorMessage: "\u7528\u6237\u624B\u52A8\u7EC8\u6B62",
            executionInfo: {
              phase: "cancelled",
              processedRows: latestProgress.processedRows,
              progressPercent: rawRows.length > 0 ? Number((latestProgress.processedRows / rawRows.length * 100).toFixed(2)) : 100,
              rowsPerSecond: Number((latestProgress.processedRows / elapsedSeconds2).toFixed(2)),
              elapsedSeconds: Number(elapsedSeconds2.toFixed(1)),
              targetDialect,
              fileCount: (task.files || []).length,
              targetTable: task.targetTable
            }
          });
          return { taskId: task.id, runId, cancelled: true };
        }
        allErrors = [...allErrors, ...insertErrors];
        const elapsedSeconds = Math.max((Date.now() - runStartedAt) / 1e3, 1e-3);
        await repository.addRunErrors(runId, allErrors);
        await repository.updateRun(runId, {
          runStatus: allErrors.length > 0 ? "completed" : "completed",
          endTime: /* @__PURE__ */ new Date(),
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
            rebuildTargetTable: Boolean(task.parseOptions?.rebuildTargetTable)
          }
        });
        return {
          taskId: task.id,
          runId
        };
      } catch (error) {
        const elapsedSeconds = Math.max((Date.now() - runStartedAt) / 1e3, 1e-3);
        await repository.updateRun(runId, {
          runStatus: "failed",
          endTime: /* @__PURE__ */ new Date(),
          errorMessage: error.message || "\u6587\u4EF6\u5BFC\u5165\u5931\u8D25",
          executionInfo: {
            phase: "failed",
            rowsPerSecond: 0,
            elapsedSeconds: Number(elapsedSeconds.toFixed(1)),
            taskId: task.id,
            targetTable: task.targetTable
          }
        });
        throw error;
      }
    }
    async function cancelRun(taskId, runId) {
      const task = await getTaskDetail(taskId);
      const run = await repository.getRunById(runId);
      if (!run || Number(run.taskId) !== Number(task.id)) {
        throw new AppError("\u8FD0\u884C\u8BB0\u5F55\u4E0D\u5B58\u5728", 404);
      }
      if (run.runStatus === "cancelled") {
        return { taskId: task.id, runId: run.id, runStatus: "cancelled" };
      }
      if (run.runStatus !== "running" && run.runStatus !== "cancelling") {
        throw new AppError("\u53EA\u6709\u8FD0\u884C\u4E2D\u7684\u4EFB\u52A1\u53EF\u4EE5\u7EC8\u6B62", 400);
      }
      await repository.updateRun(run.id, {
        runStatus: "cancelling",
        errorMessage: "\u7528\u6237\u8BF7\u6C42\u7EC8\u6B62"
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
        throw new AppError("\u8FD0\u884C\u8BB0\u5F55\u4E0D\u5B58\u5728", 404);
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
          modelVersion: aiConfig.defaultModelVersion || provider.modelVersion || provider.modelName
        });
      }
      const providers = await modelProviderService.getActiveChatModelProviders();
      return providers[0] || null;
    }
    function buildFallbackSuggestions(fields = [], technicalNameMode = "snake_case", fieldContexts = []) {
      const used = /* @__PURE__ */ new Set();
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
          dataType: normalizeSuggestedDataType(context.dataType, { ...context, targetField })
        };
      });
    }
    function normalizePromptSampleValue(value) {
      if (value === null || value === void 0) {
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
      return normalized.length > FIELD_TRANSLATION_SAMPLE_TEXT_LIMIT ? `${normalized.slice(0, FIELD_TRANSLATION_SAMPLE_TEXT_LIMIT)}...` : normalized;
    }
    function normalizeSuggestionFieldContexts(items = []) {
      return (Array.isArray(items) ? items : []).map((item) => {
        if (typeof item === "string") {
          return {
            sourceField: item.trim(),
            targetField: "",
            columnComment: "",
            dataType: "",
            inferredType: "",
            maxLength: 0,
            currentDataType: "",
            sampleValues: []
          };
        }
        const sourceField = String(item?.sourceField || item?.fieldName || item?.name || "").trim();
        const sampleValues = Array.isArray(item?.sampleValues) ? item.sampleValues.slice(0, FIELD_TRANSLATION_SAMPLE_LIMIT).map(normalizePromptSampleValue).filter((value) => value !== "") : [];
        return {
          sourceField,
          targetField: String(item?.targetField || "").trim(),
          columnComment: String(item?.columnComment || item?.comment || "").trim(),
          dataType: String(item?.dataType || item?.targetType || item?.suggestedType || "").trim(),
          currentDataType: String(item?.dataType || item?.targetType || item?.suggestedType || "").trim(),
          inferredType: String(item?.inferredType || "").trim(),
          maxLength: Number(item?.maxLength || 0),
          nullable: item?.nullable === void 0 ? void 0 : Boolean(item.nullable),
          sampleValues
        };
      }).filter((item) => item.sourceField);
    }
    function parseModelJsonObject(content) {
      const parsed = safeJsonParse(content, null);
      if (parsed) return parsed;
      const text = String(content || "").trim();
      const match = text.match(/\{[\s\S]*\}/);
      return match ? safeJsonParse(match[0], null) : null;
    }
    function normalizeModelSuggestions(fieldContexts, suggestions, fallback, technicalNameMode) {
      const used = /* @__PURE__ */ new Set();
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
          columnComment
        });
        return {
          sourceField: field,
          targetField,
          englishName: targetField,
          dataType,
          columnComment,
          chineseComment: columnComment,
          direction,
          reason: String(matched.reason || "model_generated")
        };
      });
    }
    async function suggestTechnicalNames(payload = {}) {
      const fieldContexts = normalizeSuggestionFieldContexts(payload.fields);
      const fields = fieldContexts.map((item) => item.sourceField);
      if (fields.length === 0) {
        throw new AppError("\u5B57\u6BB5\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      const technicalNameMode = ["snake_case", "camelCase", "upper_snake"].includes(String(payload.technicalNameMode || "")) ? String(payload.technicalNameMode) : "snake_case";
      const fallback = buildFallbackSuggestions(fields, technicalNameMode, fieldContexts);
      const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("file_upload_naming").catch(() => null);
      const provider = await resolveSuggestionProvider(payload.modelProviderId).catch(() => null);
      const modelConfigured = Boolean(payload.modelProviderId || aiConfig?.defaultModelProviderId);
      const systemPrompt = String(
        aiConfig?.systemPrompt || "\u4F60\u662F\u6587\u4EF6\u4E0A\u4F20\u5165\u5E93\u573A\u666F\u4E2D\u7684\u5B57\u6BB5\u547D\u540D\u52A9\u624B\u3002\u8BF7\u628A\u4E2D\u6587\u5B57\u6BB5\u540D\u8F6C\u6362\u6210\u82F1\u6587\u6280\u672F\u540D\uFF0C\u53EA\u8FD4\u56DE JSON\u3002"
      ).trim();
      const translationPrompt = [
        systemPrompt,
        "",
        "\u672C\u6B21\u4EFB\u52A1\u5FC5\u987B\u652F\u6301\u5B57\u6BB5\u540D\u53CC\u5411\u7FFB\u8BD1\uFF1A",
        "1. sourceField \u662F\u4E2D\u6587\u4E1A\u52A1\u540D\u65F6\uFF0CtargetField \u8F93\u51FA\u82F1\u6587\u6570\u636E\u5E93\u6280\u672F\u540D\uFF0CcolumnComment \u4FDD\u7559\u6216\u7CBE\u70BC\u4E2D\u6587\u5B57\u6BB5\u6CE8\u91CA\u3002",
        "2. sourceField \u662F\u82F1\u6587\u6280\u672F\u540D\u65F6\uFF0CtargetField \u8F93\u51FA\u89C4\u8303\u5316\u540E\u7684\u82F1\u6587\u6280\u672F\u540D\uFF0CcolumnComment \u8F93\u51FA\u4E2D\u6587\u5B57\u6BB5\u6CE8\u91CA\u3002",
        "3. targetField \u5FC5\u987B\u662F\u53EF\u843D\u5E93\u5B57\u6BB5\u540D\uFF0C\u4E0D\u5305\u542B\u4E2D\u6587\u3001\u7A7A\u683C\u3001\u77ED\u6A2A\u7EBF\u6216\u7279\u6B8A\u5B57\u7B26\u3002",
        "4. \u5FC5\u987B\u7ED3\u5408\u6BCF\u4E2A\u5B57\u6BB5\u7684 sampleValues \u7406\u89E3\u5B57\u6BB5\u4E1A\u52A1\u542B\u4E49\uFF0CsampleValues \u662F\u6700\u591A 50 \u6761\u771F\u5B9E\u6837\u4F8B\u6570\u636E\u3002",
        "5. \u5FC5\u987B\u540C\u65F6\u5224\u65AD dataType\uFF0C\u7ED3\u5408 currentDataType\u3001inferredType\u3001\u5B57\u6BB5\u540D\u3001\u5B57\u6BB5\u6CE8\u91CA\u548C sampleValues \u9009\u62E9\u76EE\u6807\u7C7B\u578B\u3002",
        "6. dataType \u53EF\u9009\uFF1Avarchar(64)\u3001varchar(128)\u3001varchar(255)\u3001text\u3001bigint\u3001int\u3001decimal(18,6)\u3001date\u3001datetime\u3001boolean\u3001json\u3001jsonb\u3002",
        "7. \u7C7B\u578B\u5224\u65AD\u5FC5\u987B\u4FDD\u5B88\uFF1A\u7F16\u7801\u3001\u7F16\u53F7\u3001ID\u3001\u72B6\u6001\u3001\u6807\u8BC6\u3001\u7535\u8BDD\u3001\u8BC1\u4EF6\u53F7\u3001\u90AE\u7F16\u7B49\u5373\u4F7F\u6837\u4F8B\u770B\u8D77\u6765\u662F\u6570\u5B57\uFF0C\u4E5F\u4F18\u5148\u7528 varchar\uFF1B\u65E5\u671F\u65F6\u95F4\u53EA\u6709\u6240\u6709\u975E\u7A7A\u6837\u4F8B\u90FD\u6E05\u6670\u7B26\u5408\u65E5\u671F/\u65F6\u95F4\u683C\u5F0F\u624D\u7528 date/datetime\uFF1B\u6570\u503C\u53EA\u6709\u6240\u6709\u975E\u7A7A\u6837\u4F8B\u90FD\u80FD\u7A33\u5B9A\u89E3\u6790\u4E14\u4E0D\u662F\u7F16\u7801\u7C7B\u5B57\u6BB5\u624D\u7528\u6570\u503C\u7C7B\u578B\uFF1B\u4E0D\u597D\u8BC6\u522B\u4E00\u5F8B\u7528 varchar \u6216 text\u3002",
        '8. \u5FC5\u987B\u4E25\u683C\u8FD4\u56DE JSON \u5BF9\u8C61\uFF1A{"suggestions":[{"sourceField":"...","targetField":"...","columnComment":"...","dataType":"varchar(64)","reason":"..."}]}\u3002'
      ].join("\n");
      if (!provider) {
        return {
          mode: "fallback",
          modelConfigured,
          fallbackReason: modelConfigured ? "model_error" : "not_configured",
          suggestions: fallback
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
                instruction: "\u8BF7\u9010\u4E2A\u5B57\u6BB5\u7ED3\u5408 sourceField\u3001targetField\u3001columnComment\u3001currentDataType\u3001inferredType \u548C sampleValues \u63A8\u65AD\u4E1A\u52A1\u542B\u4E49\uFF0C\u518D\u7ED9\u51FA targetField\u3001columnComment \u4E0E dataType\u3002\u6570\u503C\u548C\u65E5\u671F\u65F6\u95F4\u5FC5\u987B\u4FDD\u5B88\u5224\u65AD\uFF0C\u4E0D\u786E\u5B9A\u65F6\u8FD4\u56DE\u5B57\u7B26\u4E32\u7C7B\u578B\u3002",
                dataTypePolicy: {
                  stringFirst: "\u65E0\u6CD5\u660E\u786E\u5224\u65AD\u3001\u5B58\u5728\u6DF7\u5408\u503C\u3001\u5B58\u5728\u7F16\u7801/ID/\u72B6\u6001/\u7535\u8BDD/\u8BC1\u4EF6\u53F7/\u90AE\u7F16\u8BED\u4E49\u65F6\uFF0C\u4F7F\u7528 varchar \u6216 text\u3002",
                  numeric: "\u53EA\u6709\u6240\u6709\u975E\u7A7A\u6837\u4F8B\u90FD\u662F\u53EF\u8BA1\u7B97\u6570\u503C\uFF0C\u4E14\u5B57\u6BB5\u4E0D\u662F\u7F16\u7801/ID/\u72B6\u6001\u7C7B\uFF0C\u624D\u4F7F\u7528 int\u3001bigint \u6216 decimal(18,6)\u3002",
                  dateTime: "\u53EA\u6709\u6240\u6709\u975E\u7A7A\u6837\u4F8B\u90FD\u662F\u660E\u786E\u65E5\u671F\u6216\u65E5\u671F\u65F6\u95F4\u683C\u5F0F\uFF0C\u624D\u4F7F\u7528 date \u6216 datetime\uFF1BYYYYMMDD\u3001\u6570\u5B57\u65E5\u671F\u3001\u6DF7\u5408\u6587\u672C\u4F18\u5148\u5B57\u7B26\u4E32\u3002"
                },
                output: {
                  suggestions: [
                    {
                      sourceField: "\u4E2D\u6587\u5B57\u6BB5\u540D",
                      targetField: "snake_case_name",
                      columnComment: "\u4E2D\u6587\u5B57\u6BB5\u6CE8\u91CA",
                      dataType: "varchar(64)",
                      reason: "\u7B80\u77ED\u8BF4\u660E"
                    },
                    {
                      sourceField: "english_field_name",
                      targetField: "english_field_name",
                      columnComment: "\u4E2D\u6587\u5B57\u6BB5\u6CE8\u91CA",
                      dataType: "decimal(18,6)",
                      reason: "\u7B80\u77ED\u8BF4\u660E"
                    }
                  ]
                }
              })
            }
          ],
          {
            temperature: aiConfig?.temperature ?? 0.1,
            maxTokens: aiConfig?.maxTokens ?? 1600,
            timeoutMs: aiConfig?.timeoutMs ?? void 0,
            responseFormat: { type: "json_object" }
          }
        );
        const parsed = parseModelJsonObject(response.content);
        const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : Array.isArray(parsed) ? parsed : null;
        if (!suggestions) {
          throw new Error("\u6A21\u578B\u672A\u8FD4\u56DE\u6709\u6548\u5EFA\u8BAE");
        }
        return {
          mode: "model",
          modelConfigured: true,
          modelProviderId: provider.id,
          modelProviderName: provider.configName,
          suggestions: normalizeModelSuggestions(fieldContexts, suggestions, fallback, technicalNameMode)
        };
      } catch (error) {
        return {
          mode: "fallback",
          modelConfigured: true,
          fallbackReason: "model_error",
          errorMessage: error.message || "\u6A21\u578B\u8C03\u7528\u5931\u8D25",
          modelProviderId: provider.id,
          modelProviderName: provider.configName,
          suggestions: fallback
        };
      }
    }
    module2.exports = {
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
      updateTask
    };
  }
});

// backend/src/modules/file-imports/file-import.controller.js
var require_file_import_controller = __commonJS({
  "backend/src/modules/file-imports/file-import.controller.js"(exports2, module2) {
    var AppError = require_app_error();
    var { sendSuccess } = require_response();
    var service = require_file_import_service();
    function parseConfigField(rawValue) {
      if (!rawValue) {
        return {};
      }
      if (typeof rawValue === "object") {
        return rawValue;
      }
      try {
        return JSON.parse(rawValue);
      } catch (_error) {
        throw new AppError("\u914D\u7F6E\u53C2\u6570\u4E0D\u662F\u5408\u6CD5 JSON", 400);
      }
    }
    async function previewFiles(req, res) {
      const config = parseConfigField(req.body?.config);
      const result = await service.previewFiles(req.files || [], config);
      return sendSuccess(res, result);
    }
    async function createTask(req, res) {
      const config = parseConfigField(req.body?.config);
      const result = await service.createTask(req.files || [], config, req.user, req.projectId);
      return sendSuccess(res, result, null, 201);
    }
    async function updateTask(req, res) {
      const result = await service.updateTask(Number(req.params.id), req.body || {}, req.user);
      return sendSuccess(res, result);
    }
    async function listTasks(req, res) {
      const result = await service.listTasks({
        page: req.query.page,
        pageSize: req.query.pageSize,
        status: req.query.status,
        targetSourceId: req.query.targetSourceId,
        keyword: req.query.keyword
      });
      return sendSuccess(res, result.list, {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize
      });
    }
    async function getTask(req, res) {
      const result = await service.getTaskDetail(Number(req.params.id));
      return sendSuccess(res, result);
    }
    async function deleteTask(req, res) {
      await service.deleteTask(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function runTaskNow(req, res) {
      const result = await service.runTaskNow(Number(req.params.id));
      return sendSuccess(res, result);
    }
    async function cancelRun(req, res) {
      const result = await service.cancelRun(Number(req.params.id), Number(req.params.runId));
      return sendSuccess(res, result);
    }
    async function listRuns(req, res) {
      const result = await service.listRuns(Number(req.params.id), req.query.limit);
      return sendSuccess(res, result, { total: result.length });
    }
    async function listRunErrors(req, res) {
      const result = await service.listRunErrors(Number(req.params.id), Number(req.params.runId), {
        page: req.query.page,
        pageSize: req.query.pageSize,
        limit: req.query.limit
      });
      return sendSuccess(res, result.list, {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize
      });
    }
    async function suggestTechnicalNames(req, res) {
      const result = await service.suggestTechnicalNames(req.validatedBody);
      return sendSuccess(res, result);
    }
    module2.exports = {
      cancelRun,
      createTask,
      deleteTask,
      getTask,
      listRunErrors,
      listRuns,
      listTasks,
      previewFiles,
      runTaskNow,
      suggestTechnicalNames,
      updateTask
    };
  }
});

// packages/data-platform-module-file-imports/src/.runtime-entry.js
var controller0 = require_file_import_controller();
var { Writable } = require("node:stream");
var handlers = {
  "GET /api/v1/file-imports": controller0["listTasks"],
  "GET /api/v1/file-imports/:id": controller0["getTask"],
  "GET /api/v1/file-imports/:id/runs": controller0["listRuns"],
  "GET /api/v1/file-imports/:id/runs/:runId/errors": controller0["listRunErrors"],
  "POST /api/v1/file-imports/:id/runs/:runId/cancel": controller0["cancelRun"],
  "POST /api/v1/file-imports/preview": controller0["previewFiles"],
  "POST /api/v1/file-imports": controller0["createTask"],
  "POST /api/v1/file-imports/suggest-technical-names": controller0["suggestTechnicalNames"],
  "PUT /api/v1/file-imports/:id": controller0["updateTask"],
  "POST /api/v1/file-imports/:id/run": controller0["runTaskNow"],
  "DELETE /api/v1/file-imports/:id": controller0["deleteTask"]
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
