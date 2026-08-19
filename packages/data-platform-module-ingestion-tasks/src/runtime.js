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

// backend/src/modules/ingestion-tasks/ingestion-task.repository.js
var require_ingestion_task_repository = __commonJS({
  "backend/src/modules/ingestion-tasks/ingestion-task.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var { getCurrentProjectId } = require_project_context();
    function parseJsonField(value) {
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch (error) {
          return null;
        }
      }
      return value;
    }
    function mapRow(row) {
      return {
        ...row,
        scheduleEnabled: row.scheduleEnabled === void 0 ? void 0 : Boolean(row.scheduleEnabled),
        targetConfig: parseJsonField(row.targetConfig) || {},
        fieldMappings: parseJsonField(row.fieldMappings) || [],
        transformRules: parseJsonField(row.transformRules) || [],
        incrementalConfig: parseJsonField(row.incrementalConfig) || null,
        sourceConfig: parseJsonField(row.sourceConfig) || null,
        parseConfig: parseJsonField(row.parseConfig) || null,
        errorConfig: parseJsonField(row.errorConfig) || null,
        scheduleConfig: parseJsonField(row.scheduleConfig) || null,
        executionInfo: parseJsonField(row.executionInfo) || null,
        lastExecutionInfo: parseJsonField(row.lastExecutionInfo) || null,
        sourceConnectionConfig: parseJsonField(row.sourceConnectionConfig) || {},
        targetConnectionConfig: parseJsonField(row.targetConnectionConfig) || {}
      };
    }
    async function listTasks(filters = {}) {
      const { status, syncMode, lastRunStatus, sourceId, keyword, page = 1, pageSize = 20 } = filters;
      const offset = (page - 1) * pageSize;
      let whereClause = "";
      const params = [];
      const projectId = getCurrentProjectId();
      if (projectId) {
        whereClause += " AND t.project_id = ?";
        params.push(projectId);
      }
      if (status) {
        whereClause += " AND t.status = ?";
        params.push(status);
      }
      if (syncMode) {
        whereClause += " AND t.sync_mode = ?";
        params.push(syncMode);
      }
      if (lastRunStatus) {
        whereClause += " AND jr.run_status = ?";
        params.push(lastRunStatus);
      }
      if (sourceId) {
        whereClause += " AND t.source_id = ?";
        params.push(sourceId);
      }
      if (keyword) {
        whereClause += " AND (t.task_name LIKE ? OR t.task_code LIKE ? OR t.source_table LIKE ? OR t.target_table LIKE ?)";
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      }
      const lastRunJoinSql = `
    LEFT JOIN ingestion_job_runs jr ON jr.id = (
      SELECT r.id
      FROM ingestion_job_runs r FORCE INDEX (idx_ingestion_job_runs_task_created_id)
      WHERE r.task_id = t.id
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 1
    )`;
      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total
     FROM ingestion_tasks t
     ${lastRunStatus ? lastRunJoinSql : ""}
     WHERE 1=1 ${whereClause}`,
        params
      );
      const [rows] = await pool.query(
        `SELECT t.id, t.project_id AS projectId, t.task_name AS taskName, t.task_code AS taskCode, t.source_id AS sourceId,
            t.source_table AS sourceTable, t.target_source_id AS targetSourceId, t.target_type AS targetType,
            t.target_table AS targetTable, t.target_config AS targetConfig, t.sync_mode AS syncMode,
            t.status, t.description, t.owner_name AS ownerName, t.schedule_enabled AS scheduleEnabled,
            t.created_at AS createdAt, t.updated_at AS updatedAt,
            s.source_name AS sourceName,
            ts.source_name AS targetSourceName,
            c.field_mappings AS fieldMappings, c.transform_rules AS transformRules,
            c.incremental_config AS incrementalConfig, c.source_config AS sourceConfig,
            c.parse_config AS parseConfig, c.error_config AS errorConfig, c.schedule_config AS scheduleConfig,
            jr.start_time AS lastRunTime, jr.end_time AS lastEndTime, jr.run_status AS lastRunStatus,
            jr.records_count AS lastRecordsCount
     FROM ingestion_tasks t
     LEFT JOIN ingestion_data_sources s ON t.source_id = s.id
     LEFT JOIN ingestion_data_sources ts ON t.target_source_id = ts.id
     LEFT JOIN ingestion_configs c ON t.id = c.task_id
     ${lastRunJoinSql}
     WHERE 1=1 ${whereClause}
     ORDER BY t.id DESC
     LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );
      return {
        list: rows.map(mapRow),
        total: countRows[0].total,
        page,
        pageSize
      };
    }
    async function getTaskById(id) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND t.project_id = ?" : "";
      const [rows] = await pool.query(
        `SELECT t.id, t.project_id AS projectId, t.task_name AS taskName, t.task_code AS taskCode, t.source_id AS sourceId,
            t.source_table AS sourceTable, t.target_source_id AS targetSourceId, t.target_type AS targetType,
            t.target_table AS targetTable, t.target_config AS targetConfig, t.sync_mode AS syncMode,
            t.status, t.description, t.owner_name AS ownerName, t.schedule_enabled AS scheduleEnabled,
            t.created_at AS createdAt, t.updated_at AS updatedAt,
            s.source_name AS sourceName, s.source_type AS sourceType, s.connection_config AS sourceConnectionConfig,
            ts.source_name AS targetSourceName, ts.source_type AS targetSourceType, ts.connection_config AS targetConnectionConfig
     FROM ingestion_tasks t
     LEFT JOIN ingestion_data_sources s ON t.source_id = s.id
     LEFT JOIN ingestion_data_sources ts ON t.target_source_id = ts.id
     WHERE t.id = ?${projectWhere}`,
        projectId ? [id, projectId] : [id]
      );
      if (!rows[0]) {
        return null;
      }
      const task = mapRow(rows[0]);
      const [configRows] = await pool.query(
        `SELECT id, field_mappings AS fieldMappings, transform_rules AS transformRules,
            incremental_config AS incrementalConfig, source_config AS sourceConfig,
            parse_config AS parseConfig, error_config AS errorConfig, schedule_config AS scheduleConfig,
            created_at AS createdAt, updated_at AS updatedAt
     FROM ingestion_configs
     WHERE task_id = ?`,
        [id]
      );
      if (!configRows[0]) {
        return task;
      }
      const config = mapRow(configRows[0]);
      return {
        ...task,
        fieldMappings: config.fieldMappings,
        transformRules: config.transformRules,
        incrementalConfig: config.incrementalConfig,
        sourceConfig: config.sourceConfig,
        parseConfig: config.parseConfig,
        errorConfig: config.errorConfig,
        scheduleConfig: config.scheduleConfig,
        config
      };
    }
    async function getTaskByCode(code) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [rows] = await pool.query(
        `SELECT id, task_name AS taskName, task_code AS taskCode
     FROM ingestion_tasks
     WHERE task_code = ?${projectWhere}`,
        projectId ? [code, projectId] : [code]
      );
      return rows[0] || null;
    }
    async function createTask(payload) {
      const projectId = getCurrentProjectId();
      const {
        taskName,
        taskCode,
        sourceId,
        sourceTable,
        targetSourceId,
        targetType,
        targetTable,
        targetConfig,
        syncMode,
        status,
        description,
        ownerName,
        scheduleEnabled
      } = payload;
      const [result] = await pool.query(
        `INSERT INTO ingestion_tasks
     (project_id, task_name, task_code, source_id, source_table, target_source_id, target_type, target_table, target_config, sync_mode, status, description, owner_name, schedule_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          taskName,
          taskCode,
          sourceId,
          sourceTable,
          targetSourceId,
          targetType,
          targetTable,
          JSON.stringify(targetConfig || {}),
          syncMode || "full",
          status || "draft",
          description || null,
          ownerName || "system",
          scheduleEnabled ? 1 : 0
        ]
      );
      await upsertTaskConfig(result.insertId, payload);
      return getTaskById(result.insertId);
    }
    async function updateTask(id, payload) {
      const fields = [];
      const values = [];
      if (payload.taskName !== void 0) {
        fields.push("task_name = ?");
        values.push(payload.taskName);
      }
      if (payload.sourceId !== void 0) {
        fields.push("source_id = ?");
        values.push(payload.sourceId);
      }
      if (payload.sourceTable !== void 0) {
        fields.push("source_table = ?");
        values.push(payload.sourceTable);
      }
      if (payload.targetSourceId !== void 0) {
        fields.push("target_source_id = ?");
        values.push(payload.targetSourceId);
      }
      if (payload.targetType !== void 0) {
        fields.push("target_type = ?");
        values.push(payload.targetType);
      }
      if (payload.targetTable !== void 0) {
        fields.push("target_table = ?");
        values.push(payload.targetTable);
      }
      if (payload.targetConfig !== void 0) {
        fields.push("target_config = ?");
        values.push(JSON.stringify(payload.targetConfig));
      }
      if (payload.syncMode !== void 0) {
        fields.push("sync_mode = ?");
        values.push(payload.syncMode);
      }
      if (payload.status !== void 0) {
        fields.push("status = ?");
        values.push(payload.status);
      }
      if (payload.description !== void 0) {
        fields.push("description = ?");
        values.push(payload.description);
      }
      if (payload.ownerName !== void 0) {
        fields.push("owner_name = ?");
        values.push(payload.ownerName);
      }
      if (payload.scheduleEnabled !== void 0) {
        fields.push("schedule_enabled = ?");
        values.push(payload.scheduleEnabled ? 1 : 0);
      }
      if (fields.length > 0) {
        const projectId = getCurrentProjectId();
        const projectWhere = projectId ? " AND project_id = ?" : "";
        values.push(id);
        if (projectId) {
          values.push(projectId);
        }
        await pool.query(`UPDATE ingestion_tasks SET ${fields.join(", ")} WHERE id = ?${projectWhere}`, values);
      }
      if (payload.fieldMappings !== void 0 || payload.transformRules !== void 0 || payload.incrementalConfig !== void 0 || payload.sourceConfig !== void 0 || payload.parseConfig !== void 0 || payload.errorConfig !== void 0 || payload.scheduleConfig !== void 0) {
        await upsertTaskConfig(id, payload);
      }
      return getTaskById(id);
    }
    async function upsertTaskConfig(taskId, payload) {
      const existingTask = await getTaskById(taskId);
      const [existing] = await pool.query("SELECT id FROM ingestion_configs WHERE task_id = ?", [taskId]);
      const nextFieldMappings = payload.fieldMappings !== void 0 ? payload.fieldMappings : existingTask?.fieldMappings || [];
      const nextTransformRules = payload.transformRules !== void 0 ? payload.transformRules : existingTask?.transformRules || [];
      const nextIncrementalConfig = payload.incrementalConfig !== void 0 ? payload.incrementalConfig : existingTask?.incrementalConfig || null;
      const nextSourceConfig = payload.sourceConfig !== void 0 ? payload.sourceConfig : existingTask?.sourceConfig || null;
      const nextParseConfig = payload.parseConfig !== void 0 ? payload.parseConfig : existingTask?.parseConfig || null;
      const nextErrorConfig = payload.errorConfig !== void 0 ? payload.errorConfig : existingTask?.errorConfig || null;
      const nextScheduleConfig = payload.scheduleConfig !== void 0 ? payload.scheduleConfig : existingTask?.scheduleConfig || null;
      const configValues = [
        JSON.stringify(nextFieldMappings),
        JSON.stringify(nextTransformRules),
        nextIncrementalConfig ? JSON.stringify(nextIncrementalConfig) : null,
        nextSourceConfig ? JSON.stringify(nextSourceConfig) : null,
        nextParseConfig ? JSON.stringify(nextParseConfig) : null,
        nextErrorConfig ? JSON.stringify(nextErrorConfig) : null,
        nextScheduleConfig ? JSON.stringify(nextScheduleConfig) : null
      ];
      if (existing[0]) {
        await pool.query(
          `UPDATE ingestion_configs
       SET field_mappings = ?, transform_rules = ?, incremental_config = ?, source_config = ?, parse_config = ?, error_config = ?, schedule_config = ?
       WHERE task_id = ?`,
          [...configValues, taskId]
        );
        return;
      }
      await pool.query(
        `INSERT INTO ingestion_configs (task_id, field_mappings, transform_rules, incremental_config, source_config, parse_config, error_config, schedule_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [taskId, ...configValues]
      );
    }
    async function deleteTask(id) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [result] = await pool.query(
        `DELETE FROM ingestion_tasks WHERE id = ?${projectWhere}`,
        projectId ? [id, projectId] : [id]
      );
      return result.affectedRows > 0;
    }
    async function updateTaskStatus(id, status) {
      const projectId = getCurrentProjectId();
      const projectWhere = projectId ? " AND project_id = ?" : "";
      const [result] = await pool.query(
        `UPDATE ingestion_tasks SET status = ? WHERE id = ?${projectWhere}`,
        projectId ? [status, id, projectId] : [status, id]
      );
      return result.affectedRows > 0;
    }
    async function getJobRuns(taskId, limit = null) {
      const normalizedLimit = limit === null || limit === void 0 ? null : Math.max(1, Number(limit) || 0);
      const sql = `SELECT id, task_id AS taskId, run_status AS runStatus, start_time AS startTime,
                      end_time AS endTime, records_count AS recordsCount, error_message AS errorMessage,
                      execution_info AS executionInfo, created_at AS createdAt
               FROM ingestion_job_runs
               WHERE task_id = ?
               ORDER BY created_at DESC${normalizedLimit ? "\n               LIMIT ?" : ""}`;
      const [rows] = await pool.query(sql, normalizedLimit ? [taskId, normalizedLimit] : [taskId]);
      return rows.map(mapRow);
    }
    async function getJobRunsByTaskIds(taskIds = [], limit = 50) {
      const normalizedTaskIds = Array.from(new Set((taskIds || []).map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0)));
      if (!normalizedTaskIds.length) {
        return [];
      }
      const normalizedLimit = Math.max(1, Number(limit) || 50);
      const placeholders = normalizedTaskIds.map(() => "?").join(", ");
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, run_status AS runStatus, start_time AS startTime,
            end_time AS endTime, records_count AS recordsCount, error_message AS errorMessage,
            execution_info AS executionInfo, created_at AS createdAt
     FROM (
       SELECT r.*,
              ROW_NUMBER() OVER (PARTITION BY r.task_id ORDER BY r.created_at DESC, r.id DESC) AS row_num
       FROM ingestion_job_runs r
       WHERE r.task_id IN (${placeholders})
     ) ranked
     WHERE row_num <= ?
     ORDER BY taskId DESC, createdAt DESC, id DESC`,
        [...normalizedTaskIds, normalizedLimit]
      );
      return rows.map(mapRow);
    }
    async function getJobRunSummariesByTaskIds(taskIds = [], limit = 50) {
      const normalizedTaskIds = Array.from(new Set((taskIds || []).map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0)));
      if (!normalizedTaskIds.length) {
        return [];
      }
      const normalizedLimit = Math.max(1, Number(limit) || 50);
      const placeholders = normalizedTaskIds.map(() => "?").join(", ");
      const [rows] = await pool.query(
        `SELECT id, taskId, runStatus, startTime, endTime, recordsCount, errorMessage, createdAt
     FROM (
       SELECT r.id,
              r.task_id AS taskId,
              r.run_status AS runStatus,
              r.start_time AS startTime,
              r.end_time AS endTime,
              r.records_count AS recordsCount,
              r.error_message AS errorMessage,
              r.created_at AS createdAt,
              ROW_NUMBER() OVER (PARTITION BY r.task_id ORDER BY r.created_at DESC, r.id DESC) AS row_num
       FROM ingestion_job_runs r
       WHERE r.task_id IN (${placeholders})
     ) ranked
     WHERE row_num <= ?
     ORDER BY taskId DESC, createdAt DESC, id DESC`,
        [...normalizedTaskIds, normalizedLimit]
      );
      return rows.map((row) => ({
        ...row,
        executionInfo: null
      }));
    }
    async function getJobRunById(taskId, runId) {
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, run_status AS runStatus, start_time AS startTime,
            end_time AS endTime, records_count AS recordsCount, error_message AS errorMessage,
            execution_info AS executionInfo, created_at AS createdAt
     FROM ingestion_job_runs
     WHERE task_id = ? AND id = ?
     LIMIT 1`,
        [taskId, runId]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    }
    async function getLatestJobRun(taskId) {
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, run_status AS runStatus, start_time AS startTime,
            end_time AS endTime, records_count AS recordsCount, error_message AS errorMessage,
            execution_info AS executionInfo, created_at AS createdAt
     FROM ingestion_job_runs
     WHERE task_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
        [taskId]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    }
    async function getLatestRunningJobRun(taskId) {
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, run_status AS runStatus, start_time AS startTime,
            end_time AS endTime, records_count AS recordsCount, error_message AS errorMessage,
            execution_info AS executionInfo, created_at AS createdAt
     FROM ingestion_job_runs
     WHERE task_id = ?
       AND run_status = 'running'
     ORDER BY created_at DESC
     LIMIT 1`,
        [taskId]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    }
    async function createJobRun(payload) {
      const projectId = payload.projectId || getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO ingestion_job_runs
     (project_id, task_id, run_status, start_time, end_time, records_count, error_message, execution_info)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId || null,
          payload.taskId,
          payload.runStatus || "pending",
          payload.startTime || null,
          payload.endTime || null,
          payload.recordsCount || 0,
          payload.errorMessage || null,
          payload.executionInfo ? JSON.stringify(payload.executionInfo) : null
        ]
      );
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, run_status AS runStatus, start_time AS startTime,
            end_time AS endTime, records_count AS recordsCount, error_message AS errorMessage,
            execution_info AS executionInfo, created_at AS createdAt
     FROM ingestion_job_runs
     WHERE id = ?`,
        [result.insertId]
      );
      return mapRow(rows[0]);
    }
    async function updateJobRun(id, payload) {
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
      if (payload.recordsCount !== void 0) {
        fields.push("records_count = ?");
        values.push(payload.recordsCount);
      }
      if (payload.errorMessage !== void 0) {
        fields.push("error_message = ?");
        values.push(payload.errorMessage);
      }
      if (payload.executionInfo !== void 0) {
        fields.push("execution_info = ?");
        values.push(JSON.stringify(payload.executionInfo));
      }
      if (fields.length > 0) {
        values.push(id);
        await pool.query(`UPDATE ingestion_job_runs SET ${fields.join(", ")} WHERE id = ?`, values);
      }
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, run_status AS runStatus, start_time AS startTime,
            end_time AS endTime, records_count AS recordsCount, error_message AS errorMessage,
            execution_info AS executionInfo, created_at AS createdAt
     FROM ingestion_job_runs
     WHERE id = ?`,
        [id]
      );
      return mapRow(rows[0]);
    }
    async function getScheduledTasks() {
      const [rows] = await pool.query(
        `SELECT t.id, t.project_id AS projectId, t.task_name AS taskName, t.task_code AS taskCode, t.source_id AS sourceId,
            t.source_table AS sourceTable, t.target_source_id AS targetSourceId, t.target_type AS targetType,
            t.target_table AS targetTable, t.target_config AS targetConfig, t.sync_mode AS syncMode,
            t.status, t.schedule_enabled AS scheduleEnabled,
            s.source_name AS sourceName, s.source_type AS sourceType, s.connection_config AS sourceConnectionConfig,
            ts.source_name AS targetSourceName, ts.source_type AS targetSourceType, ts.connection_config AS targetConnectionConfig,
            c.field_mappings AS fieldMappings, c.transform_rules AS transformRules,
            c.incremental_config AS incrementalConfig, c.source_config AS sourceConfig,
            c.parse_config AS parseConfig, c.error_config AS errorConfig, c.schedule_config AS scheduleConfig
     FROM ingestion_tasks t
     LEFT JOIN ingestion_data_sources s ON t.source_id = s.id
     LEFT JOIN ingestion_data_sources ts ON t.target_source_id = ts.id
     LEFT JOIN ingestion_configs c ON t.id = c.task_id
     WHERE t.schedule_enabled = 1 AND t.status = 'active'`
      );
      return rows.map(mapRow);
    }
    async function reconcileHistoricalRunningJobRuns(taskId) {
      const [rows] = await pool.query(
        `SELECT r.id
     FROM ingestion_job_runs r
     WHERE r.task_id = ?
       AND r.run_status = 'running'
       AND EXISTS (
         SELECT 1
         FROM ingestion_job_runs newer
         WHERE newer.task_id = r.task_id
           AND newer.created_at > r.created_at
       )`,
        [taskId]
      );
      for (const row of rows) {
        await updateJobRun(row.id, {
          runStatus: "failed",
          endTime: /* @__PURE__ */ new Date(),
          errorMessage: "\u68C0\u6D4B\u5230\u8BE5\u8FD0\u884C\u8BB0\u5F55\u5DF2\u88AB\u540E\u7EED\u6267\u884C\u8986\u76D6\uFF0C\u5DF2\u81EA\u52A8\u4FEE\u6B63\u4E3A\u5F02\u5E38\u7ED3\u675F",
          executionInfo: {
            recovered: true,
            recoveredAt: (/* @__PURE__ */ new Date()).toISOString(),
            recoveredReason: "superseded_by_newer_run"
          }
        });
      }
      return rows.length;
    }
    async function reconcileTerminalRunningJobRuns(taskId) {
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, run_status AS runStatus, records_count AS recordsCount,
            error_message AS errorMessage, execution_info AS executionInfo, start_time AS startTime
     FROM ingestion_job_runs
     WHERE task_id = ?
       AND run_status = 'running'`,
        [taskId]
      );
      let updatedCount = 0;
      for (const rawRow of rows) {
        const row = mapRow(rawRow);
        const executionInfo = row.executionInfo || {};
        const nested = executionInfo.executionInfo || executionInfo.result || {};
        const stdout = nested.stdout || executionInfo.stdout || "";
        const hasSuccessFlag = executionInfo.success === true || nested.status === "success" || nested.exitCode === 0 || String(stdout).includes("\u4EFB\u52A1\u6267\u884C\u6574\u4E2A\u6210\u529F");
        const hasFailureFlag = Boolean(row.errorMessage) || Boolean(executionInfo.error) || nested.status === "failed" || nested.exitCode !== void 0 && nested.exitCode !== null && nested.exitCode !== 0 || String(stdout).includes("\u4EFB\u52A1\u6267\u884C\u5931\u8D25");
        if (hasSuccessFlag) {
          await updateJobRun(row.id, {
            runStatus: "completed",
            endTime: /* @__PURE__ */ new Date(),
            recordsCount: executionInfo.recordsCount || nested.metrics?.totalRecords || row.recordsCount || 0
          });
          await updateTaskStatus(row.taskId, "active");
          updatedCount += 1;
          continue;
        }
        if (hasFailureFlag) {
          await updateJobRun(row.id, {
            runStatus: "failed",
            endTime: /* @__PURE__ */ new Date(),
            errorMessage: row.errorMessage || executionInfo.error?.message || nested.error || "\u4EFB\u52A1\u5F02\u5E38\u7ED3\u675F"
          });
          await updateTaskStatus(row.taskId, "active");
          updatedCount += 1;
        }
      }
      return updatedCount;
    }
    async function reconcileLatestRunningJobRunsAfterRestart() {
      const [rows] = await pool.query(
        `SELECT r.id, r.task_id AS taskId
     FROM ingestion_job_runs r
     WHERE r.run_status = 'running'
       AND NOT EXISTS (
         SELECT 1
         FROM ingestion_job_runs newer
         WHERE newer.task_id = r.task_id
           AND newer.created_at > r.created_at
       )`
      );
      for (const row of rows) {
        await updateJobRun(row.id, {
          runStatus: "failed",
          endTime: /* @__PURE__ */ new Date(),
          errorMessage: "\u670D\u52A1\u91CD\u542F\u540E\u68C0\u6D4B\u5230\u8BE5\u4EFB\u52A1\u672A\u6B63\u5E38\u6536\u5C3E\uFF0C\u5DF2\u81EA\u52A8\u4FEE\u6B63\u4E3A\u5F02\u5E38\u7ED3\u675F",
          executionInfo: {
            recovered: true,
            recoveredAt: (/* @__PURE__ */ new Date()).toISOString(),
            recoveredReason: "service_restarted"
          }
        });
        await updateTaskStatus(row.taskId, "active");
      }
      return rows.length;
    }
    async function cleanupOldJobRuns(options = {}) {
      const retentionDays = Math.max(1, Number(options.retentionDays) || 30);
      const batchSize = Math.max(100, Math.min(5e3, Number(options.batchSize) || 1e3));
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1e3);
      let deleted = 0;
      while (true) {
        const [result] = await pool.query(
          `DELETE FROM ingestion_job_runs
       WHERE created_at < ?
       ORDER BY created_at ASC
       LIMIT ${batchSize}`,
          [cutoffDate]
        );
        const affectedRows = Number(result.affectedRows || 0);
        deleted += affectedRows;
        if (affectedRows < batchSize) {
          break;
        }
      }
      return {
        deleted,
        cutoffDate,
        retentionDays
      };
    }
    async function getKafkaOffsets(taskId, topicName) {
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, topic_name AS topicName, partition_id AS partitionId,
            last_processed_offset AS lastProcessedOffset,
            last_committed_offset AS lastCommittedOffset,
            message_timestamp AS messageTimestamp,
            updated_at AS updatedAt
     FROM ingestion_kafka_offsets
     WHERE task_id = ? AND topic_name = ?`,
        [taskId, topicName]
      );
      return rows.map((row) => ({
        ...row,
        partitionId: Number(row.partitionId),
        lastProcessedOffset: row.lastProcessedOffset === null || row.lastProcessedOffset === void 0 ? null : Number(row.lastProcessedOffset),
        lastCommittedOffset: row.lastCommittedOffset === null || row.lastCommittedOffset === void 0 ? null : Number(row.lastCommittedOffset)
      }));
    }
    async function upsertKafkaOffset(payload) {
      await pool.query(
        `INSERT INTO ingestion_kafka_offsets
      (task_id, topic_name, partition_id, last_processed_offset, last_committed_offset, message_timestamp)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_processed_offset = VALUES(last_processed_offset),
       last_committed_offset = VALUES(last_committed_offset),
       message_timestamp = VALUES(message_timestamp),
       updated_at = CURRENT_TIMESTAMP`,
        [
          payload.taskId,
          payload.topicName,
          payload.partitionId,
          payload.lastProcessedOffset ?? null,
          payload.lastCommittedOffset ?? null,
          payload.messageTimestamp || null
        ]
      );
    }
    async function getFtpFileState(taskId, remotePath) {
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, remote_path AS remotePath, file_size AS fileSize,
            modified_at AS modifiedAt, file_hash AS fileHash, status, last_run_id AS lastRunId,
            processed_rows AS processedRows, error_message AS errorMessage,
            processed_at AS processedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM ingestion_ftp_file_states
     WHERE task_id = ? AND remote_path = ?
     LIMIT 1`,
        [taskId, remotePath]
      );
      return rows[0] || null;
    }
    async function listCompletedFtpFileStates(taskId) {
      const [rows] = await pool.query(
        `SELECT id, task_id AS taskId, remote_path AS remotePath, file_size AS fileSize,
            modified_at AS modifiedAt, file_hash AS fileHash, status, last_run_id AS lastRunId,
            processed_rows AS processedRows, error_message AS errorMessage,
            processed_at AS processedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM ingestion_ftp_file_states
     WHERE task_id = ? AND status = 'completed'`,
        [taskId]
      );
      return rows;
    }
    async function upsertFtpFileState(payload) {
      await pool.query(
        `INSERT INTO ingestion_ftp_file_states
      (task_id, remote_path, file_size, modified_at, file_hash, status, last_run_id, processed_rows, error_message, processed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       file_size = VALUES(file_size),
       modified_at = VALUES(modified_at),
       file_hash = VALUES(file_hash),
       status = VALUES(status),
       last_run_id = VALUES(last_run_id),
       processed_rows = VALUES(processed_rows),
       error_message = VALUES(error_message),
       processed_at = VALUES(processed_at),
       updated_at = CURRENT_TIMESTAMP`,
        [
          payload.taskId,
          payload.remotePath,
          payload.fileSize ?? null,
          payload.modifiedAt || null,
          payload.fileHash || null,
          payload.status || "discovered",
          payload.lastRunId || null,
          payload.processedRows || 0,
          payload.errorMessage || null,
          payload.processedAt || null
        ]
      );
    }
    async function getApiSyncState(taskId, stateKey = "default") {
      const [rows] = await pool.query(
        `SELECT id, project_id AS projectId, task_id AS taskId, state_key AS stateKey,
            last_cursor_value AS lastCursorValue, last_success_time AS lastSuccessTime,
            last_page AS lastPage, last_offset AS lastOffset, last_next_cursor AS lastNextCursor,
            last_run_id AS lastRunId, status, error_message AS errorMessage,
            created_at AS createdAt, updated_at AS updatedAt
     FROM ingestion_api_sync_states
     WHERE task_id = ? AND state_key = ?
     LIMIT 1`,
        [taskId, stateKey]
      );
      return rows[0] || null;
    }
    async function upsertApiSyncState(payload) {
      const projectId = payload.projectId || getCurrentProjectId();
      await pool.query(
        `INSERT INTO ingestion_api_sync_states
      (project_id, task_id, state_key, last_cursor_value, last_success_time, last_page, last_offset, last_next_cursor, last_run_id, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_cursor_value = VALUES(last_cursor_value),
       last_success_time = VALUES(last_success_time),
       last_page = VALUES(last_page),
       last_offset = VALUES(last_offset),
       last_next_cursor = VALUES(last_next_cursor),
       last_run_id = VALUES(last_run_id),
       status = VALUES(status),
       error_message = VALUES(error_message),
       updated_at = CURRENT_TIMESTAMP`,
        [
          projectId || null,
          payload.taskId,
          payload.stateKey || "default",
          payload.lastCursorValue || null,
          formatMysqlDateTime(payload.lastSuccessTime),
          payload.lastPage ?? null,
          payload.lastOffset ?? null,
          payload.lastNextCursor || null,
          payload.lastRunId || null,
          payload.status || "completed",
          payload.errorMessage || null
        ]
      );
    }
    function formatMysqlDateTime(value) {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return value;
      return parsed.toISOString().slice(0, 19).replace("T", " ");
    }
    module2.exports = {
      listTasks,
      getTaskById,
      getTaskByCode,
      createTask,
      updateTask,
      deleteTask,
      updateTaskStatus,
      getJobRuns,
      getJobRunsByTaskIds,
      getJobRunSummariesByTaskIds,
      getJobRunById,
      getLatestJobRun,
      getLatestRunningJobRun,
      createJobRun,
      updateJobRun,
      cleanupOldJobRuns,
      getKafkaOffsets,
      upsertKafkaOffset,
      getFtpFileState,
      listCompletedFtpFileStates,
      upsertFtpFileState,
      getApiSyncState,
      upsertApiSyncState,
      getScheduledTasks,
      reconcileTerminalRunningJobRuns,
      reconcileHistoricalRunningJobRuns,
      reconcileLatestRunningJobRunsAfterRestart
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

// backend/src/services/dataxService.js
var require_dataxService = __commonJS({
  "backend/src/services/dataxService.js"(exports2, module2) {
    var { spawn, spawnSync } = require("child_process");
    var fs = require("fs");
    var path = require("path");
    var os = require("os");
    var { v4: uuidv4 } = require("uuid");
    var env = require_config();
    var {
      buildJdbcUrl,
      inferDatasourceDialect,
      normalizeDatasourceType,
      normalizeJdbcUrlForDialect
    } = require_datasource_dialect();
    var { materializeActiveDataXDrivers } = require_database_driver_store();
    var DATA_X_HOME = env.dataxHome ? path.resolve(env.dataxHome) : path.resolve(__dirname, "../../datax");
    var DATA_X_BIN = env.dataxBin ? path.resolve(env.dataxBin) : path.join(DATA_X_HOME, "bin", "datax.py");
    var PYTHON_BIN = env.dataxPython || process.env.PYTHON || "python3";
    var runningJobs = /* @__PURE__ */ new Map();
    function resolveTransferType(type, connection = {}) {
      const normalizedType = normalizeDatasourceType(type);
      const dialect = inferDatasourceDialect(normalizedType, connection || {});
      return dialect === "unknown" ? normalizedType : dialect;
    }
    function buildDataXJob(jobConfig) {
      const { source, writer, fieldMappings, transformRules } = jobConfig;
      let reader = buildReader(source);
      const writerConfig = buildWriter(writer);
      if (fieldMappings && fieldMappings.length > 0) {
        reader = applyFieldMappings(reader, fieldMappings);
      }
      const content = {
        reader,
        writer: writerConfig
      };
      const transformers = buildTransformers(transformRules);
      if (transformers && transformers.length > 0) {
        content.transformer = transformers;
      }
      const job = {
        job: {
          content: [content],
          setting: {
            speed: {
              channel: jobConfig.channel || 1,
              byte: jobConfig.byteSpeed || -1,
              record: jobConfig.recordSpeed || -1
            },
            errorLimit: {
              record: jobConfig.errorRecordLimit || 1e4,
              percentage: jobConfig.errorPercentage || 0.01
            }
          }
        }
      };
      return job;
    }
    function buildReader(source) {
      const connection = source.connection || {};
      const sourceType = resolveTransferType(source.type, connection);
      const table = normalizeTables(connection.table);
      switch (sourceType) {
        case "mysql":
          return {
            name: "mysqlreader",
            parameter: {
              username: connection.username || "",
              password: connection.password || "",
              column: connection.column || ["*"],
              connection: [
                {
                  jdbcUrl: normalizeReaderJdbcUrls(connection, sourceType),
                  table
                }
              ],
              ...connection.splitPk ? { splitPk: connection.splitPk } : {},
              ...connection.where ? { where: connection.where } : {}
            }
          };
        case "postgresql":
          return {
            name: "postgresqlreader",
            parameter: {
              username: connection.username || "",
              password: connection.password || "",
              column: connection.column || ["*"],
              splitPk: connection.splitPk || null,
              connection: [
                {
                  jdbcUrl: normalizeReaderJdbcUrls(connection, sourceType),
                  table
                }
              ],
              where: connection.where || null
            }
          };
        case "oracle":
          return buildJdbcReader("oraclereader", sourceType, connection, table);
        case "dm":
          return buildJdbcReader("rdbmsreader", sourceType, connection, table);
        case "sftp":
        case "ftp":
          return {
            name: "streamreader",
            parameter: {
              column: connection.column || ["*"],
              sliceRecordCount: 100
            }
          };
        case "api":
        case "http":
          return {
            name: "streamreader",
            parameter: {
              column: connection.column || ["*"],
              sliceRecordCount: 100
            }
          };
        default:
          throw new Error(`DataX \u4E0D\u652F\u6301\u6570\u636E\u6E90\u7C7B\u578B ${source.type || sourceType}\uFF0C\u672A\u751F\u6210\u964D\u7EA7\u6D41\u4EFB\u52A1`);
      }
    }
    function buildWriter(writer) {
      const connection = writer.connection || {};
      const writerType = resolveTransferType(writer.type, connection);
      const table = normalizeTables(connection.table);
      switch (writerType) {
        case "mysql":
          return buildMysqlWriter(connection, table, writerType);
        case "postgresql":
          return buildPostgresqlWriter(connection, table, writerType);
        case "oracle":
          return buildJdbcWriter("oraclewriter", writerType, connection, table);
        case "dm":
          return buildJdbcWriter("rdbmswriter", writerType, connection, table);
        case "hive":
          return buildHiveWriter(connection);
        case "kafka":
          return {
            name: "streamwriter",
            parameter: {
              column: ["*"],
              sliceRecordCount: 100
            }
          };
        case "file":
          return {
            name: "txtfilewriter",
            parameter: {
              fileName: connection.fileName || "output",
              path: connection.path || "/tmp/datax/output",
              fileType: connection.fileType || "text",
              fieldDelimiter: connection.fieldDelimiter || ",",
              column: connection.column || ["*"]
            }
          };
        default:
          throw new Error(`DataX \u4E0D\u652F\u6301\u6570\u636E\u6E90\u7C7B\u578B ${writer.type || writerType}\uFF0C\u672A\u751F\u6210\u964D\u7EA7\u6D41\u4EFB\u52A1`);
      }
    }
    function applyFieldMappings(reader, fieldMappings) {
      return reader;
    }
    function normalizeTables(table) {
      if (Array.isArray(table)) {
        return table.filter(Boolean);
      }
      if (table) {
        return [table];
      }
      return [];
    }
    function normalizeReaderJdbcUrls(connection, sourceType = "mysql") {
      const dialect = resolveTransferType(sourceType, connection);
      const normalizeUrl = (value) => normalizeJdbcUrlForDialect(value, dialect);
      if (Array.isArray(connection.jdbcUrl)) {
        return connection.jdbcUrl.filter(Boolean).map(normalizeUrl);
      }
      if (Array.isArray(connection.url)) {
        return connection.url.filter(Boolean).map(normalizeUrl);
      }
      const jdbcUrl = connection.jdbcUrl || connection.url || buildJdbcUrl(sourceType, connection);
      return jdbcUrl ? [normalizeUrl(jdbcUrl)] : [];
    }
    function normalizeWriterJdbcUrl(connection, writerType = "mysql") {
      const dialect = resolveTransferType(writerType, connection);
      const normalizeUrl = (value) => normalizeJdbcUrlForDialect(value, dialect);
      if (Array.isArray(connection.jdbcUrl)) {
        return normalizeUrl(connection.jdbcUrl[0] || "");
      }
      if (Array.isArray(connection.url)) {
        return normalizeUrl(connection.url[0] || "");
      }
      return normalizeUrl(connection.jdbcUrl || connection.url || buildJdbcUrl(writerType, connection));
    }
    function buildJdbcReader(name, sourceType, connection, table) {
      return {
        name,
        parameter: {
          username: connection.username || "",
          password: connection.password || "",
          column: connection.column || ["*"],
          connection: [{ jdbcUrl: normalizeReaderJdbcUrls(connection, sourceType), table }],
          ...connection.splitPk ? { splitPk: connection.splitPk } : {},
          ...connection.where ? { where: connection.where } : {}
        }
      };
    }
    function buildJdbcWriter(name, sourceType, connection, table) {
      const normalizedWriteMode = String(connection.writeMode || "append").toLowerCase();
      const preSql = [...connection.preSql || []];
      if (normalizedWriteMode === "overwrite" && table[0]) {
        const quote = sourceType === "oracle" || sourceType === "dm" ? '"' : "`";
        const target = table[0].split(".").filter(Boolean).map((part) => `${quote}${part.replaceAll(quote, quote + quote)}${quote}`).join(".");
        preSql.unshift(`TRUNCATE TABLE ${target}`);
      }
      return {
        name,
        parameter: {
          username: connection.username || "",
          password: connection.password || "",
          writeMode: normalizedWriteMode === "replace" ? "replace" : "insert",
          column: connection.column || ["*"],
          connection: [{ jdbcUrl: normalizeWriterJdbcUrl(connection, sourceType), table }],
          preSql,
          postSql: connection.postSql || []
        }
      };
    }
    function buildTransformers(transformRules) {
      if (!transformRules || transformRules.length === 0) {
        return null;
      }
      return transformRules.map((rule) => {
        const config = rule.config || {};
        switch (rule.transformType) {
          case "rename":
            return {
              name: "replace",
              rule: {
                destination: config.newName || rule.field,
                source: rule.field
              }
            };
          case "uppercase":
            return {
              name: "replace",
              rule: {
                destination: rule.field,
                source: rule.field,
                replaceWith: config.expression || `upper(${rule.field})`
              }
            };
          case "lowercase":
            return {
              name: "replace",
              rule: {
                destination: rule.field,
                source: rule.field,
                replaceWith: config.expression || `lower(${rule.field})`
              }
            };
          default:
            return null;
        }
      }).filter((t) => t !== null);
    }
    async function executeJob(jobId, jobJson, options = {}) {
      const tempDir = os.tmpdir();
      const jobFileName = `datax_job_${jobId}_${uuidv4()}.json`;
      const jobFilePath = path.join(tempDir, jobFileName);
      try {
        validateDataXEnvironment();
        materializeActiveDataXDrivers(DATA_X_HOME);
        fs.writeFileSync(jobFilePath, JSON.stringify(jobJson, null, 2), "utf8");
        return new Promise((resolve, reject) => {
          const dataXProcess = spawn(PYTHON_BIN, [DATA_X_BIN, jobFilePath], {
            cwd: DATA_X_HOME,
            env: { ...process.env },
            shell: true
          });
          runningJobs.set(jobId, {
            process: dataXProcess,
            cancelRequested: false
          });
          let stdout = "";
          let stderr = "";
          let settled = false;
          const finalize = (code, signal, source) => {
            if (settled) {
              return;
            }
            settled = true;
            const runningJob = runningJobs.get(jobId);
            const cancelRequested = Boolean(runningJob?.cancelRequested);
            runningJobs.delete(jobId);
            try {
              fs.unlinkSync(jobFilePath);
            } catch (e) {
            }
            const result = parseJobResult(stdout, stderr, code, signal, cancelRequested);
            result.completedBy = source;
            if (code === 0 && !signal && !cancelRequested) {
              resolve({
                success: true,
                jobId,
                result
              });
            } else {
              resolve({
                success: false,
                jobId,
                error: result.error || stderr || stdout || `DataX exited with code ${code}`,
                result
              });
            }
          };
          dataXProcess.stdout.on("data", (data) => {
            const chunk = data.toString();
            stdout += chunk;
            const progress = extractLatestProgress(stdout);
            if (progress && typeof options.onProgress === "function") {
              options.onProgress({
                stdout,
                stderr,
                metrics: progress.metrics,
                latestLine: progress.line
              });
            }
          });
          dataXProcess.stderr.on("data", (data) => {
            stderr += data.toString();
          });
          dataXProcess.on("close", (code, signal) => {
            finalize(code, signal, "close");
          });
          dataXProcess.on("exit", (code, signal) => {
            finalize(code, signal, "exit");
          });
          dataXProcess.on("error", (error) => {
            if (settled) {
              return;
            }
            settled = true;
            runningJobs.delete(jobId);
            try {
              fs.unlinkSync(jobFilePath);
            } catch (e) {
            }
            reject({
              success: false,
              jobId,
              error: error.message
            });
          });
        });
      } catch (error) {
        try {
          if (fs.existsSync(jobFilePath)) {
            fs.unlinkSync(jobFilePath);
          }
        } catch (e) {
        }
        throw error;
      }
    }
    function validateDataXEnvironment() {
      if (!fs.existsSync(DATA_X_BIN)) {
        const configuredByEnv = env.dataxBin || env.dataxHome;
        const configHint = configuredByEnv ? `\u5F53\u524D DATAX \u914D\u7F6E\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5 DATAX_HOME / DATAX_BIN\u3002` : "\u5F53\u524D\u672A\u914D\u7F6E DATAX_HOME / DATAX_BIN\u3002";
        throw new Error(
          `DataX \u672A\u5B89\u88C5\u6216\u8DEF\u5F84\u4E0D\u5B58\u5728: ${DATA_X_BIN}\u3002${configHint}`
        );
      }
    }
    function buildMysqlWriter(connection, table, writerType = "mysql") {
      const normalizedWriteMode = String(connection.writeMode || "append").toLowerCase();
      const firstTable = table[0];
      const preSql = [...connection.preSql || []];
      let dataXWriteMode = "insert";
      if (normalizedWriteMode === "replace") {
        dataXWriteMode = "replace";
      } else if (normalizedWriteMode === "overwrite") {
        if (firstTable) {
          preSql.unshift(`TRUNCATE TABLE ${quoteMysqlTableName(firstTable)}`);
        }
      }
      return {
        name: "mysqlwriter",
        parameter: {
          username: connection.username || "",
          password: connection.password || "",
          writeMode: dataXWriteMode,
          session: connection.session || [],
          column: connection.column || ["*"],
          connection: [
            {
              jdbcUrl: normalizeWriterJdbcUrl(connection, writerType),
              table
            }
          ],
          preSql,
          postSql: connection.postSql || []
        }
      };
    }
    function buildPostgresqlWriter(connection, table, writerType = "postgresql") {
      const normalizedWriteMode = String(connection.writeMode || "append").toLowerCase();
      const firstTable = table[0];
      const preSql = [...connection.preSql || []];
      if (normalizedWriteMode === "overwrite" && firstTable) {
        preSql.unshift(`TRUNCATE TABLE ${quotePostgresqlTableName(firstTable)}`);
      }
      return {
        name: "postgresqlwriter",
        parameter: {
          username: connection.username || "",
          password: connection.password || "",
          session: connection.session || [],
          column: connection.column || ["*"],
          connection: [
            {
              jdbcUrl: normalizeWriterJdbcUrl(connection, writerType),
              table
            }
          ],
          preSql,
          postSql: connection.postSql || []
        }
      };
    }
    function buildHiveWriter(connection) {
      const normalizedWriteMode = String(connection.writeMode || "append").toLowerCase();
      const partitionConfig = connection.partitionConfig || {};
      const parameter = {
        defaultFS: connection.defaultFS || "hdfs://localhost:9000",
        fileType: connection.fileType || "text",
        path: connection.path || "/tmp/datax",
        fileName: connection.fileName || "datax",
        column: connection.column || ["*"],
        writeMode: normalizedWriteMode === "partition_overwrite" ? "overwrite" : normalizedWriteMode,
        fieldDelimiter: connection.fieldDelimiter || "	"
      };
      if (normalizedWriteMode === "partition_overwrite") {
        parameter.partition = {
          mode: partitionConfig.mode || "latest",
          partitionColumn: partitionConfig.partitionColumn || "",
          ...partitionConfig.partitionValue ? { partitionValue: partitionConfig.partitionValue } : {}
        };
      }
      return {
        name: "hdfswriter",
        parameter
      };
    }
    function quoteMysqlTableName(tableName) {
      return String(tableName || "").split(".").filter(Boolean).map((part) => `\`${part.replace(/`/g, "``")}\``).join(".");
    }
    function quotePostgresqlTableName(tableName) {
      return String(tableName || "").split(".").filter(Boolean).map((part) => `"${part.replace(/"/g, '""')}"`).join(".");
    }
    function cancelJob(jobId) {
      const runningJob = runningJobs.get(jobId);
      if (runningJob?.process) {
        runningJob.cancelRequested = true;
        terminateProcessTree(runningJob.process);
        return true;
      }
      return false;
    }
    function terminateProcessTree(childProcess) {
      if (!childProcess || !childProcess.pid) {
        return false;
      }
      if (process.platform === "win32") {
        const result = spawnSync("taskkill", ["/PID", String(childProcess.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true
        });
        return result.status === 0;
      }
      try {
        childProcess.kill("SIGTERM");
        return true;
      } catch (error) {
        return false;
      }
    }
    var OUTPUT_TAIL_LIMIT = 8e3;
    function tailText(value, maxLength = OUTPUT_TAIL_LIMIT) {
      const text = String(value || "");
      if (text.length <= maxLength) {
        return text;
      }
      return text.slice(text.length - maxLength);
    }
    function parseJobResult(stdout, stderr, exitCode, signal = null, cancelled = false) {
      const result = {
        exitCode,
        signal,
        metrics: {}
      };
      try {
        const progress = extractLatestProgress(stdout);
        if (progress) {
          result.metrics = progress.metrics;
          result.latestProgressLine = progress.line;
        }
        if (cancelled || signal) {
          result.status = "cancelled";
          result.error = "\u4EFB\u52A1\u5DF2\u53D6\u6D88";
        } else if (stdout.includes("\u4EFB\u52A1\u6267\u884C\u6574\u4E2A\u6210\u529F")) {
          result.status = "success";
          result.error = null;
        } else if (stdout.includes("\u4EFB\u52A1\u6267\u884C\u5931\u8D25")) {
          result.status = "failed";
          result.error = "\u4EFB\u52A1\u6267\u884C\u5931\u8D25";
        }
        if (result.status !== "success") {
          const stderrTail = tailText(stderr);
          const stdoutTail = tailText(stdout);
          if (stderrTail) {
            result.stderr = stderrTail;
          }
          if (stdoutTail) {
            result.stdout = stdoutTail;
          }
          if (!result.error) {
            result.error = stderrTail || stdoutTail || `DataX exited with code ${exitCode}`;
          }
          result.error = normalizeDataXError(result.error);
        }
      } catch (e) {
      }
      return result;
    }
    function isJobRunning(jobId) {
      return runningJobs.has(jobId);
    }
    function getRunningJobIds() {
      return [...runningJobs.keys()];
    }
    function normalizeDataXError(value) {
      const message = String(value || "").trim();
      if (/ClassNotFoundException|NoClassDefFoundError|No suitable driver/i.test(message)) return `\u6570\u636E\u5E93 JDBC \u9A71\u52A8\u672A\u52A0\u8F7D\uFF1A${tailText(message, 1200)}`;
      if (/ORA-01017|invalid username\/password/i.test(message)) return "Oracle \u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF";
      if (/ORA-12514|ORA-12505/i.test(message)) return "Oracle Service Name \u6216 SID \u4E0D\u5B58\u5728";
      if (/ORA-01031|insufficient privileges/i.test(message)) return "Oracle \u5F53\u524D\u7528\u6237\u6743\u9650\u4E0D\u8DB3";
      if (/网络通信异常|connection refused|connect timed out/i.test(message)) return `\u6570\u636E\u5E93\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25\uFF1A${tailText(message, 1200)}`;
      return message;
    }
    function extractLatestProgress(stdout) {
      const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index];
        const metrics = parseProgressLine(line);
        if (metrics) {
          return { line, metrics };
        }
      }
      return null;
    }
    function parseProgressLine(line) {
      if (!line.includes("Total") || !line.includes("Speed") || !line.includes("records")) {
        return null;
      }
      const progressMatch = line.match(
        /Total\s+(\d+)\s+records,\s+(\d+)\s+bytes\s+\|\s+Speed\s+([^,|]+),\s+([^|]+)\|\s+Error\s+(\d+)\s+records,\s+(\d+)\s+bytes.*?\|\s+Percentage\s+([\d.]+)%/i
      );
      if (!progressMatch) {
        return null;
      }
      return {
        totalRecords: parseInt(progressMatch[1], 10),
        totalBytes: parseInt(progressMatch[2], 10),
        speed: progressMatch[3].trim(),
        recordSpeed: progressMatch[4].trim(),
        errorRecords: parseInt(progressMatch[5], 10),
        errorBytes: parseInt(progressMatch[6], 10),
        percentage: Number(progressMatch[7])
      };
    }
    module2.exports = {
      buildDataXJob,
      executeJob,
      cancelJob,
      parseJobResult,
      isJobRunning,
      getRunningJobIds
    };
  }
});

// backend/src/services/apiRowAdapters.js
var require_apiRowAdapters = __commonJS({
  "backend/src/services/apiRowAdapters.js"(exports2, module2) {
    var crypto = require("crypto");
    function adaptApiRows(adapterCode, rows = [], now = /* @__PURE__ */ new Date()) {
      const code = String(adapterCode || "").trim();
      if (!code) return rows;
      if (code === "aviationstack_flight_schedule") {
        return rows.filter(isChinaSouthernGuangzhouDeparture).filter(hasRequiredAviationstackFields).map((row) => adaptAviationstackFlight(row, now));
      }
      throw new Error(`Unsupported API row adapter: ${code}`);
    }
    function resolveApiRowAdapter(task = {}, sourceConfig = {}) {
      const explicit = String(sourceConfig.rowAdapter || "").trim();
      if (explicit) return explicit;
      const sourceType = String(task.sourceType || task.sourceDialect || "").toLowerCase();
      const sourceTable = String(task.sourceTable || "").trim().toLowerCase();
      const targetTable = String(task.targetTable || "").trim().toLowerCase();
      if (sourceType === "api" && sourceTable === "/flights" && targetTable === "ods_flight_schedule") {
        return "aviationstack_flight_schedule";
      }
      return "";
    }
    function resolveApiSourceConfig(task = {}, sourceConfig = {}) {
      const normalizedSourceConfig = sourceConfig && typeof sourceConfig === "object" ? sourceConfig : {};
      const adapterCode = resolveApiRowAdapter(task, normalizedSourceConfig);
      if (adapterCode !== "aviationstack_flight_schedule") {
        return normalizedSourceConfig;
      }
      const queryParams = Array.isArray(normalizedSourceConfig.queryParams) ? [...normalizedSourceConfig.queryParams] : Object.entries(normalizedSourceConfig.queryParams || {}).map(([name, value]) => ({ name, value }));
      const existingNames = new Set(queryParams.map((item) => String(item?.name || item?.key || "").trim().toLowerCase()).filter(Boolean));
      const requiredParams = [
        { name: "airline_iata", value: "CZ" },
        { name: "dep_iata", value: "CAN" }
      ];
      return {
        ...normalizedSourceConfig,
        rowAdapter: adapterCode,
        queryParams: queryParams.concat(requiredParams.filter((item) => !existingNames.has(item.name)))
      };
    }
    function adaptAviationstackFlight(row, now) {
      const flightNo = firstText(row.flight_iata, `${row.airline_iata || ""}${row.flight_number || ""}`);
      const depAirport = "ZGGG";
      const arrAirport = firstText(row.arrival_icao).toUpperCase();
      const std = firstText(row.departure_scheduled);
      const sta = firstText(row.arrival_scheduled);
      const flightDate = firstText(row.flight_date, std.slice(0, 10));
      const sourceRecordId = `${flightNo}|${flightDate}|CAN|${firstText(row.arrival_iata).toUpperCase()}`;
      const businessKey = `${flightNo}|${flightDate}|${depAirport}|${arrAirport}`;
      const actualOrEstimated = firstText(row.departure_actual, row.departure_estimated);
      return {
        flight_segment_id: `AS_${crypto.createHash("sha1").update(sourceRecordId).digest("hex")}`,
        flight_no: flightNo,
        dep_airport: depAirport,
        arr_airport: arrAirport,
        segment_type: String(arrAirport).toUpperCase().startsWith("Z") ? "DOM" : "INT",
        std,
        sta,
        atd: firstText(row.departure_actual) || null,
        flight_status: firstText(row.flight_status, "unknown"),
        delay_code_raw: firstText(row.departure_delay_code, row.delay_code) || null,
        delay_minutes: calculateDelayMinutes(std, actualOrEstimated, row.departure_delay),
        tail_no: firstText(row.aircraft_registration) || null,
        carrier_code: firstText(row.airline_iata, row.airline_icao, "CZ"),
        updated_at: now.toISOString(),
        record_source: "AVIATIONSTACK",
        source_record_id: sourceRecordId,
        business_key: businessKey,
        source_updated_at: firstText(row.departure_actual, row.departure_estimated, row.arrival_actual, row.arrival_estimated) || null,
        ingested_at: now.toISOString(),
        raw_payload: JSON.stringify(row)
      };
    }
    function isChinaSouthernGuangzhouDeparture(row) {
      const airlineIata = firstText(row.airline_iata).toUpperCase();
      const airlineIcao = firstText(row.airline_icao).toUpperCase();
      const flightIata = firstText(row.flight_iata).toUpperCase();
      const departureIata = firstText(row.departure_iata).toUpperCase();
      const departureIcao = firstText(row.departure_icao).toUpperCase();
      const isChinaSouthern = airlineIata ? airlineIata === "CZ" : airlineIcao ? airlineIcao === "CSN" : flightIata.startsWith("CZ");
      const isGuangzhou = departureIata === "CAN" || departureIcao === "ZGGG";
      return isChinaSouthern && isGuangzhou;
    }
    function hasRequiredAviationstackFields(row) {
      const flightNo = firstText(row.flight_iata, `${row.airline_iata || ""}${row.flight_number || ""}`);
      const flightDate = firstText(row.flight_date);
      const arrivalIata = firstText(row.arrival_iata);
      const arrivalIcao = firstText(row.arrival_icao);
      return Boolean(
        /\d/.test(flightNo) && flightDate && firstText(row.departure_scheduled) && firstText(row.arrival_scheduled) && arrivalIata && /^[A-Z]{4}$/.test(arrivalIcao.toUpperCase())
      );
    }
    function calculateDelayMinutes(scheduled, actualOrEstimated, providedDelay) {
      const explicit = Number(providedDelay);
      if (providedDelay !== null && providedDelay !== void 0 && providedDelay !== "" && Number.isFinite(explicit)) {
        return Math.max(0, Math.round(explicit));
      }
      const scheduledAt = Date.parse(scheduled);
      const comparisonAt = Date.parse(actualOrEstimated);
      if (!Number.isFinite(scheduledAt) || !Number.isFinite(comparisonAt)) return 0;
      return Math.max(0, Math.round((comparisonAt - scheduledAt) / 6e4));
    }
    function firstText(...values) {
      const value = values.find((item) => item !== null && item !== void 0 && String(item).trim() !== "");
      return value === void 0 ? "" : String(value).trim();
    }
    module2.exports = {
      adaptApiRows,
      resolveApiRowAdapter,
      resolveApiSourceConfig
    };
  }
});

// backend/src/services/sqlInsertBuilder.js
var require_sqlInsertBuilder = __commonJS({
  "backend/src/services/sqlInsertBuilder.js"(exports2, module2) {
    var dataSourceMetadata = require_data_source_metadata();
    function buildConflictClause(dialect, targetColumns = [], options = {}) {
      if (dialect !== "postgresql" || String(options.writeMode || "append").toLowerCase() !== "upsert") {
        return "";
      }
      const keyFields = (Array.isArray(options.keyFields) ? options.keyFields : []).map((field) => String(field || "").trim()).filter((field) => field && targetColumns.includes(field));
      if (!keyFields.length) {
        throw new Error("PostgreSQL upsert requires at least one keyFields entry present in field mappings");
      }
      const escapedKeys = keyFields.map((field) => dataSourceMetadata.escapeIdentifier(field, dialect));
      const updates = targetColumns.filter((field) => !keyFields.includes(field)).map((field) => {
        const escaped = dataSourceMetadata.escapeIdentifier(field, dialect);
        return `${escaped} = EXCLUDED.${escaped}`;
      });
      return updates.length ? ` ON CONFLICT (${escapedKeys.join(", ")}) DO UPDATE SET ${updates.join(", ")}` : ` ON CONFLICT (${escapedKeys.join(", ")}) DO NOTHING`;
    }
    function deduplicateRowsByKeys(rows = [], keyFields = []) {
      if (!keyFields.length || rows.length < 2) return rows;
      const deduplicated = [];
      const indexByKey = /* @__PURE__ */ new Map();
      for (const row of rows) {
        const key = JSON.stringify(keyFields.map((field) => row[field] ?? null));
        const existingIndex = indexByKey.get(key);
        if (existingIndex === void 0) {
          indexByKey.set(key, deduplicated.length);
          deduplicated.push(row);
          continue;
        }
        const existing = deduplicated[existingIndex];
        const existingTime = Date.parse(existing.source_updated_at || existing.updated_at || "");
        const candidateTime = Date.parse(row.source_updated_at || row.updated_at || "");
        if (!Number.isFinite(existingTime) || !Number.isFinite(candidateTime) || candidateTime >= existingTime) {
          deduplicated[existingIndex] = row;
        }
      }
      return deduplicated;
    }
    module2.exports = {
      buildConflictClause,
      deduplicateRowsByKeys
    };
  }
});

// backend/src/services/streamIngestionRunner.js
var require_streamIngestionRunner = __commonJS({
  "backend/src/services/streamIngestionRunner.js"(exports2, module2) {
    var path = require("path");
    var crypto = require("crypto");
    var { Writable: Writable2 } = require("stream");
    var ftp = require("basic-ftp");
    var { Kafka, logLevel } = require("kafkajs");
    var mysql = require("mysql2/promise");
    var AppError = require_app_error();
    var repository = require_ingestion_task_repository();
    var dataSourceMetadata = require_data_source_metadata();
    var { parseFileBuffer } = require_file_import_parser();
    var hiveService = require_hiveService();
    var apiIngestionService = require_apiIngestionService();
    var { adaptApiRows, resolveApiSourceConfig } = require_apiRowAdapters();
    var { buildConflictClause, deduplicateRowsByKeys } = require_sqlInsertBuilder();
    var { createPostgresLikeClient } = require_db_client();
    var { inferDatasourceDialect, resolveDatasourceConnection } = require_datasource_dialect();
    async function executeStreamTask(task, jobRun = null) {
      const sourceDialect = inferDatasourceDialect(task.sourceType, task.sourceConnectionConfig || {});
      if (sourceDialect === "kafka") {
        return executeKafkaTask(task);
      }
      if (sourceDialect === "ftp") {
        return executeFtpTask(task, jobRun);
      }
      if (sourceDialect === "api") {
        return executeApiTask(task, jobRun);
      }
      throw new Error(`Unsupported stream source dialect: ${sourceDialect}`);
    }
    async function executeApiTask(task, jobRun = null) {
      const sourceConfig = resolveApiSourceConfig(task, task.sourceConfig || {});
      const parseConfig = task.parseConfig || {};
      const errorConfig = task.errorConfig || {};
      const state = await repository.getApiSyncState(task.id, "default");
      const collectResult = await apiIngestionService.collectApiRows({
        task,
        connectionConfig: task.sourceConnectionConfig || {},
        sourceConfig,
        parseConfig,
        errorConfig,
        state
      });
      const adaptedRows = adaptApiRows(sourceConfig.rowAdapter, collectResult.rows);
      const writeResult = await writeMappedRows(task, adaptedRows);
      await repository.upsertApiSyncState({
        projectId: task.projectId || null,
        taskId: task.id,
        stateKey: collectResult.state.stateKey,
        lastCursorValue: collectResult.state.lastCursorValue,
        lastSuccessTime: collectResult.state.lastSuccessTime,
        lastPage: collectResult.state.lastPage,
        lastOffset: collectResult.state.lastOffset,
        lastNextCursor: collectResult.state.lastNextCursor,
        lastRunId: jobRun?.id || null,
        status: "completed"
      });
      return {
        success: true,
        recordsCount: writeResult.recordsCount,
        metrics: {
          totalRecords: adaptedRows.length,
          successRecords: writeResult.recordsCount,
          errorRecords: 0
        },
        executionInfo: {
          engine: "node-api-fetch",
          sourceType: "api",
          endpointPath: sourceConfig.endpointPath || task.sourceTable,
          syncMode: task.syncMode || "full",
          pageResults: collectResult.pageResults,
          fetchedRecords: collectResult.rows.length,
          acceptedRecords: adaptedRows.length,
          writtenRecords: writeResult.recordsCount,
          targetTable: task.targetTable,
          state: collectResult.state
        }
      };
    }
    async function executeKafkaTask(task) {
      const sourceConfig = task.sourceConfig || {};
      const parseConfig = task.parseConfig || {};
      const topic = sourceConfig.topic || task.sourceTable;
      const kafka = createKafka(task.sourceConnectionConfig || {});
      const groupId = sourceConfig.consumerGroupId || `medata_ingestion_${task.taskCode || task.id}`;
      const consumer = kafka.consumer({ groupId });
      const rows = [];
      const offsets = /* @__PURE__ */ new Map();
      const batchSize = Math.max(1, Number(sourceConfig.batchSize || 100));
      const maxWaitMs = Math.max(1e3, Number(sourceConfig.maxWaitMs || 1e4));
      const fromBeginning = String(sourceConfig.startMode || "latest") === "earliest";
      await consumer.connect();
      try {
        await consumer.subscribe({ topic, fromBeginning });
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            consumer.pause([{ topic }]);
            resolve();
          }, maxWaitMs);
          consumer.run({
            autoCommit: false,
            eachMessage: async ({ topic: itemTopic, partition, message }) => {
              rows.push(...parseKafkaMessage(itemTopic, partition, message, parseConfig, sourceConfig));
              const key = `${itemTopic}:${partition}`;
              offsets.set(key, {
                topic: itemTopic,
                partition,
                offset: Number(message.offset),
                timestamp: message.timestamp ? new Date(Number(message.timestamp)) : null
              });
              if (rows.length >= batchSize) {
                clearTimeout(timer);
                consumer.pause([{ topic }]);
                resolve();
              }
            }
          }).catch((error) => {
            clearTimeout(timer);
            reject(error);
          });
        });
        const writeResult = await writeMappedRows(task, rows);
        const commitPayload = [...offsets.values()].map((item) => ({
          topic: item.topic,
          partition: item.partition,
          offset: String(item.offset + 1)
        }));
        if (commitPayload.length > 0) {
          await consumer.commitOffsets(commitPayload);
          await Promise.all([...offsets.values()].map(
            (item) => repository.upsertKafkaOffset({
              taskId: task.id,
              topicName: item.topic,
              partitionId: item.partition,
              lastProcessedOffset: item.offset,
              lastCommittedOffset: item.offset + 1,
              messageTimestamp: item.timestamp
            })
          ));
        }
        return {
          success: true,
          recordsCount: writeResult.recordsCount,
          metrics: {
            totalRecords: rows.length,
            successRecords: writeResult.recordsCount,
            errorRecords: 0
          },
          executionInfo: {
            engine: "node-kafkajs",
            sourceType: "kafka",
            topic,
            consumerGroupId: groupId,
            readRecords: rows.length,
            writtenRecords: writeResult.recordsCount,
            committedOffsets: commitPayload,
            targetTable: task.targetTable
          }
        };
      } finally {
        await consumer.disconnect().catch(() => {
        });
      }
    }
    function createKafka(config = {}) {
      const bootstrapServers = String(config.bootstrapServers || config.bootstrapServer || `${config.host || ""}${config.port ? `:${config.port}` : ""}`).split(",").map((item) => item.trim()).filter(Boolean);
      if (!bootstrapServers.length) {
        throw new AppError("Kafka \u6570\u636E\u6E90\u7F3A\u5C11 bootstrapServers", 400);
      }
      return new Kafka({
        clientId: String(config.clientId || "medata-ingestion-runner"),
        brokers: bootstrapServers,
        logLevel: logLevel.NOTHING,
        retry: { retries: 2 },
        connectionTimeout: 8e3,
        requestTimeout: 1e4
      });
    }
    function parseKafkaMessage(topic, partition, message, parseConfig, sourceConfig) {
      const rawValue = message.value ? message.value.toString(parseConfig.encoding || "utf8") : "";
      const metadata = sourceConfig.includeMetadata === false ? {} : {
        _kafka_topic: topic,
        _kafka_partition: partition,
        _kafka_offset: message.offset,
        _kafka_timestamp: message.timestamp ? new Date(Number(message.timestamp)).toISOString() : null,
        _kafka_key: message.key ? message.key.toString("utf8") : "",
        _raw_value: rawValue
      };
      const format = String(parseConfig.messageFormat || "json").toLowerCase();
      if (format === "json") {
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
      }
      return [{ value: rawValue, ...metadata }];
    }
    async function executeFtpTask(task, jobRun = null) {
      const sourceConfig = task.sourceConfig || {};
      const parseConfig = task.parseConfig || {};
      const files = await listFtpCandidateFiles(task.sourceConnectionConfig || {}, sourceConfig);
      const isIncrementalMode = String(task.syncMode || "full").toLowerCase() === "incremental";
      const completedStates = isIncrementalMode ? await repository.listCompletedFtpFileStates(task.id) : [];
      const completedByPath = new Map(completedStates.map((item) => [item.remotePath, item]));
      const selectedFiles = files.filter((file) => !isIncrementalMode || shouldProcessFtpFile(file, completedByPath.get(file.relativePath))).slice(0, sourceConfig.batchFileLimit || 20);
      const rawRows = [];
      const fileResults = [];
      for (const file of selectedFiles) {
        await repository.upsertFtpFileState({
          taskId: task.id,
          remotePath: file.relativePath,
          fileSize: file.size,
          modifiedAt: file.modifiedAt,
          status: "processing",
          lastRunId: jobRun?.id || null
        });
        try {
          const buffer = await downloadFtpFile(task.sourceConnectionConfig || {}, file.relativePath);
          const fileHash = crypto.createHash("sha1").update(buffer).digest("hex");
          const parseResult = parseFileBuffer({
            originalname: path.posix.basename(file.relativePath),
            fileName: path.posix.basename(file.relativePath),
            buffer,
            size: buffer.length
          }, {
            ...parseConfig,
            fileType: parseConfig.fileType || detectFileType(file.relativePath)
          });
          if ((parseResult.rowErrors || []).length > 0 && parseConfig.skipErrorRows === false) {
            throw new AppError(`\u6587\u4EF6 ${file.relativePath} \u5B58\u5728\u89E3\u6790\u9519\u8BEF`, 400, parseResult.rowErrors[0]);
          }
          parseResult.rows.forEach((row) => {
            rawRows.push({
              ...row,
              _source_file_path: file.relativePath,
              _source_file_name: path.posix.basename(file.relativePath),
              _source_file_size: file.size,
              _source_file_mtime: file.modifiedAt ? new Date(file.modifiedAt).toISOString() : null,
              _source_line_no: row.__rowNo || null
            });
          });
          fileResults.push({ ...file, rows: parseResult.rows.length, fileHash, status: "completed" });
        } catch (error) {
          await repository.upsertFtpFileState({
            taskId: task.id,
            remotePath: file.relativePath,
            fileSize: file.size,
            modifiedAt: file.modifiedAt,
            status: "failed",
            lastRunId: jobRun?.id || null,
            errorMessage: error.message
          });
          if (parseConfig.skipErrorRows === false) {
            throw error;
          }
          fileResults.push({ ...file, rows: 0, status: "failed", errorMessage: error.message });
        }
      }
      const writeResult = await writeMappedRows(task, rawRows);
      for (const file of fileResults.filter((item) => item.status === "completed")) {
        await repository.upsertFtpFileState({
          taskId: task.id,
          remotePath: file.relativePath,
          fileSize: file.size,
          modifiedAt: file.modifiedAt,
          fileHash: file.fileHash,
          status: "completed",
          lastRunId: jobRun?.id || null,
          processedRows: file.rows,
          processedAt: /* @__PURE__ */ new Date()
        });
        await postProcessFtpFile(task.sourceConnectionConfig || {}, sourceConfig, file.relativePath);
      }
      return {
        success: true,
        recordsCount: writeResult.recordsCount,
        metrics: {
          totalRecords: rawRows.length,
          successRecords: writeResult.recordsCount,
          errorRecords: fileResults.filter((item) => item.status === "failed").length
        },
        executionInfo: {
          engine: "node-ftp-parser",
          sourceType: "ftp",
          syncMode: isIncrementalMode ? "incremental" : "full",
          rootDir: sourceConfig.rootDir,
          matchedFiles: files.length,
          processedFiles: selectedFiles.length,
          skippedFiles: Math.max(0, files.length - selectedFiles.length),
          writtenRecords: writeResult.recordsCount,
          fileResults,
          targetTable: task.targetTable
        }
      };
    }
    async function writeMappedRows(task, sourceRows) {
      const fieldMappings = (task.fieldMappings || []).filter((item) => item.targetField);
      let targetRows = sourceRows.map((row) => Object.fromEntries(
        fieldMappings.map((mapping) => [mapping.targetField, convertCellValue(row[mapping.sourceField], mapping.dataType)])
      ));
      const targetColumns = fieldMappings.map((mapping) => mapping.targetField);
      if (String(task.targetConfig?.writeMode || "append").toLowerCase() === "upsert") {
        targetRows = deduplicateRowsByKeys(targetRows, task.targetConfig?.keyFields || []);
      }
      const targetDialect = inferDatasourceDialect(task.targetSourceType || task.targetType, task.targetConnectionConfig || {});
      if (targetDialect === "mysql") {
        await writeMysqlRows(task.targetConnectionConfig || {}, task.targetTable, targetColumns, targetRows, task.targetConfig || {});
      } else if (targetDialect === "postgresql") {
        await writePostgresqlRows(task.targetConnectionConfig || {}, task.targetTable, targetColumns, targetRows, task.targetConfig || {});
      } else if (targetDialect === "hive") {
        const columns = fieldMappings.map((mapping) => ({ columnName: mapping.targetField, dataType: mapping.dataType || "string" }));
        await hiveService.loadRows(task.targetConnectionConfig || {}, task.targetTable, columns, targetRows, task.targetConfig || {});
      } else {
        throw new Error(`Unsupported stream target dialect: ${targetDialect}`);
      }
      return { recordsCount: targetRows.length };
    }
    async function writeMysqlRows(connectionConfig, tableName, targetColumns, rows, options = {}) {
      const connection = await mysql.createConnection(buildSqlConnectionConfig(connectionConfig, 3306));
      try {
        const qualifiedTable = dataSourceMetadata.escapeIdentifier(tableName, "mysql");
        if (String(options.writeMode || "append").toLowerCase() === "overwrite") {
          await connection.query(`TRUNCATE TABLE ${qualifiedTable}`);
        }
        await insertRows(connection, "mysql", qualifiedTable, targetColumns, rows, options);
      } finally {
        await connection.end();
      }
    }
    async function writePostgresqlRows(connectionConfig, tableName, targetColumns, rows, options = {}) {
      const resolved = resolveDatasourceConnection("postgresql", connectionConfig || {});
      const client = createPostgresLikeClient({
        host: resolved.host,
        port: Number(resolved.port || 5432),
        database: resolved.database,
        user: resolved.username,
        username: resolved.username,
        password: resolved.password,
        connectionTimeoutMillis: 5e3
      }, { sourceType: "postgresql" });
      await client.connect();
      try {
        const qualifiedTable = dataSourceMetadata.escapeIdentifier(tableName, "postgresql");
        if (String(options.writeMode || "append").toLowerCase() === "overwrite") {
          await client.query(`TRUNCATE TABLE ${qualifiedTable}`);
        }
        await insertRows(client, "postgresql", qualifiedTable, targetColumns, rows, options);
      } finally {
        await client.end();
      }
    }
    async function insertRows(connection, dialect, qualifiedTable, targetColumns, rows, options = {}) {
      if (!rows.length || !targetColumns.length) return;
      const batchSize = 500;
      const verb = dialect === "mysql" && String(options.writeMode || "").toLowerCase() === "replace" ? "REPLACE" : "INSERT";
      const columnSql = targetColumns.map((column) => dataSourceMetadata.escapeIdentifier(column, dialect)).join(", ");
      for (let offset = 0; offset < rows.length; offset += batchSize) {
        const batch = rows.slice(offset, offset + batchSize);
        const values = [];
        const placeholders = batch.map((row, rowIndex) => {
          const rowPlaceholders = targetColumns.map((column, columnIndex) => {
            values.push(row[column] === void 0 ? null : row[column]);
            return dialect === "postgresql" ? `$${rowIndex * targetColumns.length + columnIndex + 1}` : "?";
          });
          return `(${rowPlaceholders.join(", ")})`;
        });
        const conflictClause = buildConflictClause(dialect, targetColumns, options);
        await connection.query(`${verb} INTO ${qualifiedTable} (${columnSql}) VALUES ${placeholders.join(", ")}${conflictClause}`, values);
      }
    }
    function buildSqlConnectionConfig(connectionConfig, defaultPort) {
      const resolved = resolveDatasourceConnection(connectionConfig.sourceType || "mysql", connectionConfig || {});
      return {
        host: resolved.host,
        port: Number(resolved.port || defaultPort),
        database: resolved.database,
        user: resolved.username,
        password: resolved.password,
        connectTimeout: 5e3
      };
    }
    function convertCellValue(value, dataType) {
      if (value === void 0 || value === null || value === "") return null;
      const normalized = String(dataType || "text").toLowerCase();
      if (normalized.includes("json")) return typeof value === "string" ? value : JSON.stringify(value);
      if (normalized.includes("int")) return Math.trunc(Number(value));
      if (normalized.includes("decimal") || normalized.includes("numeric") || normalized.includes("double") || normalized.includes("float")) return Number(value);
      if (normalized === "date") return new Date(value).toISOString().slice(0, 10);
      if (normalized.includes("time")) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString().slice(0, 19).replace("T", " ");
      }
      if (normalized.includes("bool")) return ["1", "true", "yes", "\u662F"].includes(String(value).toLowerCase());
      return String(value);
    }
    async function listFtpCandidateFiles(connectionConfig, sourceConfig) {
      return withFtpClient(connectionConfig, async (client, config) => {
        const result = [];
        if (sourceConfig.pathMode === "file") {
          const filePath = sourceConfig.rootDir.replace(/^\/+/, "");
          const stat = await getFtpFileStat(client, config, filePath);
          return [{ relativePath: filePath, ...stat }];
        }
        await visitFtpDirectory(client, config, sourceConfig.rootDir, sourceConfig, result, 0);
        return result.filter((file) => matchFilePattern(file.relativePath, sourceConfig.filePattern, sourceConfig.excludePattern)).filter((file) => isStableFile(file, sourceConfig.stabilitySeconds)).sort((left, right) => String(left.relativePath).localeCompare(String(right.relativePath)));
      });
    }
    async function visitFtpDirectory(client, config, relativeDir, sourceConfig, result, depth) {
      if (depth > Number(sourceConfig.maxDepth || 3) || result.length >= 2e3) return;
      const remoteDir = normalizeRemotePath(config.rootPath, relativeDir);
      const entries = await client.list(remoteDir);
      for (const entry of entries) {
        const relativePath = [String(relativeDir || "").replace(/^\/+|\/+$/g, ""), entry.name].filter(Boolean).join("/");
        if (entry.isDirectory) {
          if (sourceConfig.recursive !== false) {
            await visitFtpDirectory(client, config, relativePath, sourceConfig, result, depth + 1);
          }
          continue;
        }
        result.push({
          relativePath,
          size: Number(entry.size || 0),
          modifiedAt: entry.modifiedAt || null
        });
      }
    }
    async function getFtpFileStat(client, config, relativePath) {
      const parentDir = path.posix.dirname(relativePath) === "." ? "" : path.posix.dirname(relativePath);
      const fileName = path.posix.basename(relativePath);
      const entries = await client.list(normalizeRemotePath(config.rootPath, parentDir));
      const entry = entries.find((item) => item.name === fileName && !item.isDirectory);
      if (!entry) throw new AppError(`FTP \u6587\u4EF6\u4E0D\u5B58\u5728\uFF1A${relativePath}`, 404);
      return { size: Number(entry.size || 0), modifiedAt: entry.modifiedAt || null };
    }
    async function downloadFtpFile(connectionConfig, relativePath) {
      return withFtpClient(connectionConfig, async (client, config) => {
        const chunks = [];
        await client.downloadTo(collectWritable(chunks), normalizeRemotePath(config.rootPath, relativePath));
        return Buffer.concat(chunks);
      });
    }
    async function postProcessFtpFile(connectionConfig, sourceConfig, relativePath) {
      const action = String(sourceConfig.postProcessAction || "keep").toLowerCase();
      if (action === "keep") return;
      await withFtpClient(connectionConfig, async (client, config) => {
        const sourcePath = normalizeRemotePath(config.rootPath, relativePath);
        if (action === "delete") {
          await client.remove(sourcePath);
          return;
        }
        if (action === "archive" && sourceConfig.archiveDir) {
          const archiveRelativePath = [sourceConfig.archiveDir.replace(/^\/+|\/+$/g, ""), path.posix.basename(relativePath)].filter(Boolean).join("/");
          const archivePath = normalizeRemotePath(config.rootPath, archiveRelativePath);
          await ensureFtpDirectory(client, path.posix.dirname(archivePath));
          await client.rename(sourcePath, archivePath);
        }
      });
    }
    async function ensureFtpDirectory(client, remoteDir) {
      const parts = String(remoteDir || "").split("/").filter(Boolean);
      let current = "";
      for (const part of parts) {
        current += `/${part}`;
        await client.ensureDir(current);
      }
    }
    async function withFtpClient(connectionConfig, handler) {
      const config = {
        host: String(connectionConfig.host || "").trim(),
        port: Number(connectionConfig.port || 21),
        user: String(connectionConfig.username || connectionConfig.user || "").trim(),
        password: String(connectionConfig.password || ""),
        secure: Boolean(connectionConfig.secure || connectionConfig.ftps),
        rootPath: String(connectionConfig.rootPath || connectionConfig.path || "/").trim() || "/"
      };
      if (!config.host || !config.user) {
        throw new AppError("FTP \u6570\u636E\u6E90\u7F3A\u5C11\u4E3B\u673A\u6216\u7528\u6237\u540D", 400);
      }
      const client = new ftp.Client(15e3);
      client.ftp.verbose = false;
      try {
        await client.access({
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          secure: config.secure
        });
        return await handler(client, config);
      } finally {
        client.close();
      }
    }
    function collectWritable(chunks) {
      return new Writable2({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          callback();
        }
      });
    }
    function normalizeRemotePath(rootPath, relativePath = "") {
      const root = String(rootPath || "/").replace(/\\/g, "/").replace(/\/+$/, "") || "/";
      const rel = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
      if (!rel) return root;
      return root === "/" ? `/${rel}` : `${root}/${rel}`;
    }
    function matchFilePattern(filePath, filePattern = "*", excludePattern = "") {
      const fileName = String(filePath || "").split("/").pop() || "";
      if (excludePattern && new RegExp(excludePattern).test(fileName)) return false;
      const pattern = String(filePattern || "*").trim();
      if (!pattern || pattern === "*") return true;
      const regexText = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
      return new RegExp(`^${regexText}$`, "i").test(fileName);
    }
    function isStableFile(file, stabilitySeconds = 0) {
      if (!stabilitySeconds || !file.modifiedAt) return true;
      return Date.now() - new Date(file.modifiedAt).getTime() >= Number(stabilitySeconds) * 1e3;
    }
    function shouldProcessFtpFile(file, completedState) {
      if (!completedState) return true;
      const previousSize = Number(completedState.fileSize || 0);
      const nextSize = Number(file.size || 0);
      const previousModified = completedState.modifiedAt ? new Date(completedState.modifiedAt).getTime() : 0;
      const nextModified = file.modifiedAt ? new Date(file.modifiedAt).getTime() : 0;
      return previousSize !== nextSize || previousModified !== nextModified;
    }
    function detectFileType(filePath) {
      const ext = path.posix.extname(String(filePath || "")).replace(".", "").toLowerCase();
      return ext || "txt";
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
    function resolveJsonPath(value, jsonPath = "") {
      const parts = String(jsonPath || "").replace(/^\$\./, "").split(".").map((item) => item.trim()).filter(Boolean);
      return parts.reduce((current, part) => current && typeof current === "object" ? current[part] : void 0, value);
    }
    module2.exports = {
      executeStreamTask
    };
  }
});

// backend/src/services/schedulerService.js
var require_schedulerService = __commonJS({
  "backend/src/services/schedulerService.js"(exports2, module2) {
    var cron = require("node-cron");
    var { v4: uuidv4 } = require("uuid");
    var AppError = require_app_error();
    var dataxService = require_dataxService();
    var repository = require_ingestion_task_repository();
    var dataSourceMetadata = require_data_source_metadata();
    var mysql = require("mysql2/promise");
    var { createPostgresLikeClient } = require_db_client();
    var hiveService = require_hiveService();
    var streamIngestionRunner = require_streamIngestionRunner();
    var {
      inferDatasourceDialect,
      normalizeDatasourceType,
      resolveDatasourceConnection
    } = require_datasource_dialect();
    var scheduledTasks = /* @__PURE__ */ new Map();
    var PROGRESS_PERSIST_INTERVAL_MS = 3e4;
    function startScheduler() {
      console.log("[Scheduler] Starting scheduler service...");
      loadScheduledTasks();
    }
    async function loadScheduledTasks() {
      try {
        const recoveredCount = await repository.reconcileLatestRunningJobRunsAfterRestart();
        if (recoveredCount > 0) {
          console.log(`[Scheduler] Recovered ${recoveredCount} stale running job records after restart`);
        }
        const tasks = await repository.getScheduledTasks();
        console.log(`[Scheduler] Found ${tasks.length} scheduled tasks to load`);
        for (const task of tasks) {
          await scheduleTask(task);
        }
        console.log(`[Scheduler] Loaded ${scheduledTasks.size} scheduled tasks`);
      } catch (error) {
        console.error("[Scheduler] Failed to load scheduled tasks:", error);
      }
    }
    async function scheduleTask(task) {
      if (!task.scheduleConfig) {
        console.warn(`[Scheduler] Task ${task.id} has no schedule config, skipping`);
        return false;
      }
      const { scheduleType, timezone } = task.scheduleConfig;
      if (scheduleType === "manual") {
        return false;
      }
      const taskKey = task.id.toString();
      if (scheduledTasks.has(taskKey)) {
        unscheduleTask(task.id);
      }
      const cronExpr = buildCronExpression(task.scheduleConfig);
      if (!cron.validate(cronExpr)) {
        console.error(`[Scheduler] Invalid cron expression for task ${task.id}: ${cronExpr}`);
        return false;
      }
      const jobId = uuidv4();
      const scheduledJob = cron.schedule(
        cronExpr,
        async () => {
          const latestTask = await repository.getTaskById(task.id);
          if (!latestTask) {
            console.warn(`[Scheduler] Scheduled task ${task.id} no longer exists, skipping`);
            return;
          }
          console.log(`[Scheduler] Executing scheduled task ${latestTask.id} (${latestTask.taskName})`);
          await executeScheduledTask(latestTask);
        },
        {
          scheduled: true,
          timezone: timezone || "Asia/Shanghai"
        }
      );
      scheduledTasks.set(taskKey, {
        job: scheduledJob,
        taskId: task.id,
        taskCode: task.taskCode,
        jobId
      });
      console.log(`[Scheduler] Scheduled task ${task.id} with cron: ${cronExpr}`);
      return true;
    }
    async function unscheduleTask(taskId) {
      const taskKey = taskId.toString();
      const scheduled = scheduledTasks.get(taskKey);
      if (scheduled) {
        scheduled.job.stop();
        scheduledTasks.delete(taskKey);
        console.log(`[Scheduler] Unscheduled task ${taskId}`);
        return true;
      }
      return false;
    }
    async function runTaskNow(taskId) {
      const task = await repository.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }
      if (task.status === "running") {
        throw new Error(`Task ${taskId} is already running`);
      }
      await assertTaskDependenciesSatisfied(task);
      await repository.updateTaskStatus(taskId, "running");
      const refreshedTask = await repository.getTaskById(taskId);
      void executeScheduledTask(refreshedTask).catch((error) => {
        console.error(`[Scheduler] Background run failed for task ${taskId}:`, error);
      });
      return refreshedTask;
    }
    async function stopTaskRun(taskId) {
      const runningJobRun = await repository.getLatestRunningJobRun(taskId);
      if (!runningJobRun) {
        return {
          cancelled: false,
          reason: "no_running_job"
        };
      }
      const executionInfo = runningJobRun.executionInfo || {};
      const nestedExecutionInfo = executionInfo.executionInfo || executionInfo.result || {};
      const processJobId = executionInfo.processJobId || nestedExecutionInfo.processJobId || executionInfo.runId || null;
      if (!processJobId) {
        return {
          cancelled: false,
          reason: "missing_process_job_id",
          runId: runningJobRun.id
        };
      }
      const cancelled = dataxService.cancelJob(processJobId);
      if (!cancelled) {
        return {
          cancelled: false,
          reason: "job_not_found_in_memory",
          runId: runningJobRun.id,
          processJobId
        };
      }
      await repository.updateJobRun(runningJobRun.id, {
        runStatus: "cancelled",
        endTime: /* @__PURE__ */ new Date(),
        errorMessage: "\u4EFB\u52A1\u5DF2\u624B\u52A8\u505C\u6B62",
        executionInfo: {
          ...executionInfo,
          processJobId,
          cancelled: true,
          cancelledAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      return {
        cancelled: true,
        runId: runningJobRun.id,
        processJobId
      };
    }
    function buildCronExpression(scheduleConfig = {}) {
      const {
        scheduleType,
        cronExpression,
        intervalMs,
        runTime,
        weekDays,
        monthDay
      } = scheduleConfig;
      if (scheduleType === "cron" && cronExpression) {
        return cronExpression;
      }
      if (scheduleType === "interval" && intervalMs) {
        const seconds = Math.max(1, Math.floor(intervalMs / 1e3));
        if (seconds < 60) {
          return `*/${seconds} * * * * *`;
        }
        const minutes = Math.max(1, Math.floor(seconds / 60));
        return `*/${minutes} * * * *`;
      }
      const { hour, minute } = parseRunTime(runTime);
      if (scheduleType === "daily") {
        return `${minute} ${hour} * * *`;
      }
      if (scheduleType === "weekly") {
        const normalizedWeekDays = Array.isArray(weekDays) && weekDays.length > 0 ? weekDays.join(",") : "1";
        return `${minute} ${hour} * * ${normalizedWeekDays}`;
      }
      if (scheduleType === "monthly") {
        const normalizedMonthDay = Number(monthDay || 1);
        return `${minute} ${hour} ${normalizedMonthDay} * *`;
      }
      return cronExpression || "0 0 * * *";
    }
    function parseRunTime(runTime) {
      if (typeof runTime !== "string" || !runTime.includes(":")) {
        return { hour: 0, minute: 0 };
      }
      const [hourText, minuteText] = runTime.split(":");
      const hour = Math.min(23, Math.max(0, Number(hourText) || 0));
      const minute = Math.min(59, Math.max(0, Number(minuteText) || 0));
      return { hour, minute };
    }
    async function executeScheduledTask(task) {
      const runId = uuidv4();
      console.log(`[Scheduler] Starting job run ${runId} for task ${task.id}`);
      const processJobId = `${task.taskCode}_${Date.now()}`;
      const retryCount = Math.max(0, Number(task.scheduleConfig?.retryCount) || 0);
      const retryIntervalMs = Math.max(1e3, Number(task.scheduleConfig?.retryIntervalMs) || 1e3);
      const jobRun = await repository.createJobRun({
        taskId: task.id,
        projectId: task.projectId || null,
        runStatus: "running",
        startTime: /* @__PURE__ */ new Date(),
        executionInfo: { runId, processJobId, scheduled: true }
      });
      try {
        await assertTaskDependenciesSatisfied(task);
        const result = await executeTaskWithRetry(task, jobRun, processJobId, {
          runId,
          retryCount,
          retryIntervalMs
        });
        if (result.cancelled) {
          await repository.updateJobRun(jobRun.id, {
            runStatus: "cancelled",
            endTime: /* @__PURE__ */ new Date(),
            recordsCount: result.recordsCount || 0,
            errorMessage: "\u4EFB\u52A1\u5DF2\u624B\u52A8\u505C\u6B62",
            executionInfo: {
              runId,
              processJobId,
              scheduled: true,
              retryCount,
              attempts: result.attempts,
              retried: result.attempts > 1,
              attemptHistory: result.attemptHistory,
              ...result
            }
          });
          await restoreTaskStatusAfterRun(task.id, "active");
          console.log(`[Scheduler] Task ${task.id} cancelled`);
          return result;
        }
        await repository.updateJobRun(jobRun.id, {
          runStatus: "completed",
          endTime: /* @__PURE__ */ new Date(),
          recordsCount: result.recordsCount || 0,
          executionInfo: {
            runId,
            processJobId,
            scheduled: true,
            retryCount,
            attempts: result.attempts,
            retried: result.attempts > 1,
            attemptHistory: result.attemptHistory,
            ...result
          }
        });
        await restoreTaskStatusAfterRun(task.id, "active");
        console.log(`[Scheduler] Task ${task.id} completed successfully`);
        return result;
      } catch (error) {
        if (isTaskCancellationError(error)) {
          console.log(`[Scheduler] Task ${task.id} cancelled:`, error.message);
          await repository.updateJobRun(jobRun.id, {
            runStatus: "cancelled",
            endTime: /* @__PURE__ */ new Date(),
            errorMessage: error.message || "\u4EFB\u52A1\u5DF2\u624B\u52A8\u505C\u6B62",
            executionInfo: {
              runId,
              processJobId,
              scheduled: true,
              cancelled: true,
              cancelledAt: (/* @__PURE__ */ new Date()).toISOString(),
              result: error.executionInfo || null
            }
          });
          await restoreTaskStatusAfterRun(task.id, "active");
          return {
            cancelled: true,
            errorMessage: error.message || "\u4EFB\u52A1\u5DF2\u624B\u52A8\u505C\u6B62"
          };
        }
        console.error(`[Scheduler] Task ${task.id} failed:`, error.message);
        await repository.updateJobRun(jobRun.id, {
          runStatus: "failed",
          endTime: /* @__PURE__ */ new Date(),
          errorMessage: error.message,
          executionInfo: {
            runId,
            processJobId,
            scheduled: true,
            retryCount,
            attempts: Array.isArray(error.attemptHistory) ? error.attemptHistory.length : 1,
            retried: retryCount > 0,
            attemptHistory: error.attemptHistory || [],
            error: {
              message: error.message,
              stack: error.stack || null
            },
            result: error.executionInfo || null
          }
        });
        await restoreTaskStatusAfterRun(task.id, "active");
        throw error;
      }
    }
    async function assertTaskDependenciesSatisfied(task) {
      const dependencyTaskIds = Array.isArray(task.scheduleConfig?.dependencyTaskIds) ? task.scheduleConfig.dependencyTaskIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0) : [];
      if (!dependencyTaskIds.length) {
        return;
      }
      const dependencyTasks = await Promise.all(
        dependencyTaskIds.map((dependencyTaskId) => repository.getTaskById(dependencyTaskId))
      );
      for (let index = 0; index < dependencyTaskIds.length; index += 1) {
        const dependencyTaskId = dependencyTaskIds[index];
        const dependencyTask = dependencyTasks[index];
        if (!dependencyTask) {
          throw new AppError(`\u4F9D\u8D56\u4EFB\u52A1\u4E0D\u5B58\u5728: ${dependencyTaskId}`, 400, { dependencyTaskId });
        }
        await repository.reconcileTerminalRunningJobRuns(dependencyTaskId);
        await repository.reconcileHistoricalRunningJobRuns(dependencyTaskId);
        const latestJobRun = await repository.getLatestJobRun(dependencyTaskId);
        if (!latestJobRun) {
          throw new AppError(`\u4F9D\u8D56\u4EFB\u52A1\u3010${dependencyTask.taskName}\u3011\u5C1A\u65E0\u6210\u529F\u8FD0\u884C\u8BB0\u5F55\uFF0C\u5F53\u524D\u4EFB\u52A1\u4E0D\u80FD\u6267\u884C`, 400, {
            dependencyTaskId,
            dependencyTaskName: dependencyTask.taskName,
            dependencyRunStatus: "not_run"
          });
        }
        if (latestJobRun.runStatus !== "completed") {
          throw new AppError(`\u4F9D\u8D56\u4EFB\u52A1\u3010${dependencyTask.taskName}\u3011\u6700\u8FD1\u4E00\u6B21\u8FD0\u884C\u72B6\u6001\u4E3A${translateRunStatus(latestJobRun.runStatus)}\uFF0C\u5F53\u524D\u4EFB\u52A1\u4E0D\u80FD\u6267\u884C`, 400, {
            dependencyTaskId,
            dependencyTaskName: dependencyTask.taskName,
            dependencyRunStatus: latestJobRun.runStatus,
            dependencyRunId: latestJobRun.id
          });
        }
      }
    }
    async function executeTaskWithRetry(task, jobRun, processJobId, options = {}) {
      const retryCount = Math.max(0, Number(options.retryCount) || 0);
      const retryIntervalMs = Math.max(1e3, Number(options.retryIntervalMs) || 1e3);
      const runId = options.runId || null;
      const attemptHistory = [];
      for (let attempt = 1; attempt <= retryCount + 1; attempt += 1) {
        try {
          const result = await executeTask(task, jobRun, processJobId);
          return {
            ...result,
            attempts: attempt,
            attemptHistory
          };
        } catch (error) {
          if (isTaskCancellationError(error)) {
            error.attemptHistory = attemptHistory;
            throw error;
          }
          attemptHistory.push({
            attempt,
            failedAt: (/* @__PURE__ */ new Date()).toISOString(),
            message: error.message
          });
          if (attempt > retryCount) {
            error.attemptHistory = attemptHistory;
            throw error;
          }
          await repository.updateJobRun(jobRun.id, {
            executionInfo: {
              ...jobRun.executionInfo || {},
              runId,
              processJobId,
              scheduled: true,
              retryCount,
              attempts: attempt,
              retried: true,
              nextRetryAt: new Date(Date.now() + retryIntervalMs).toISOString(),
              attemptHistory
            }
          });
          await delay(retryIntervalMs);
        }
      }
      throw new Error("\u4EFB\u52A1\u91CD\u8BD5\u6D41\u7A0B\u5F02\u5E38\u7ED3\u675F");
    }
    function translateRunStatus(status) {
      if (status === "completed") {
        return "\u6210\u529F";
      }
      if (status === "failed") {
        return "\u5931\u8D25";
      }
      if (status === "running") {
        return "\u8FD0\u884C\u4E2D";
      }
      if (status === "cancelled") {
        return "\u5DF2\u53D6\u6D88";
      }
      return status || "\u672A\u77E5";
    }
    function delay(ms) {
      return new Promise((resolve) => {
        setTimeout(resolve, ms);
      });
    }
    async function restoreTaskStatusAfterRun(taskId, fallbackStatus = "active") {
      const latestTask = await repository.getTaskById(taskId);
      const latestStatus = latestTask?.status;
      const nextStatus = latestStatus === "paused" || latestStatus === "stopped" ? latestStatus : fallbackStatus;
      await repository.updateTaskStatus(taskId, nextStatus);
    }
    function isTaskCancellationError(error) {
      return Boolean(
        error?.cancelled || error?.executionInfo?.status === "cancelled" || error?.executionInfo?.cancelled === true
      );
    }
    async function executeTask(task, jobRun, processJobId) {
      const sourceRuntime = parseConnectionConfig(task.sourceConnectionConfig || {}, task.sourceType || "mysql");
      if (["kafka", "ftp", "api"].includes(sourceRuntime.dialect)) {
        return streamIngestionRunner.executeStreamTask(task, jobRun, processJobId);
      }
      const incrementalRuntime = await prepareIncrementalRuntime(task);
      const targetRuntime = parseConnectionConfig(task.targetConnectionConfig || {}, task.targetSourceType || task.targetType || "mysql");
      const targetType = targetRuntime.dialect;
      if (targetType === "hive") {
        const result2 = await executeHiveTargetTask(task, incrementalRuntime);
        if (incrementalRuntime && incrementalRuntime.nextCursorValue !== void 0 && incrementalRuntime.nextCursorValue !== null) {
          await repository.updateTask(task.id, {
            incrementalConfig: {
              ...task.incrementalConfig || {},
              mode: incrementalRuntime.mode,
              cursorColumn: incrementalRuntime.cursorColumn,
              ...incrementalRuntime.mode === "timestamp" ? { timestampColumn: incrementalRuntime.cursorColumn } : {},
              ...incrementalRuntime.mode === "id" ? { idColumn: incrementalRuntime.cursorColumn } : {},
              ...task.incrementalConfig?.startValue !== void 0 ? { startValue: task.incrementalConfig.startValue } : {},
              lastValue: incrementalRuntime.nextCursorValue,
              lastRunStartValue: incrementalRuntime.previousCursorValue ?? null,
              lastRunEndValue: incrementalRuntime.nextCursorValue,
              lastRunAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          });
        }
        return {
          success: true,
          recordsCount: result2.recordsCount || 0,
          metrics: result2.metrics || {},
          executionInfo: {
            ...result2.executionInfo,
            incremental: incrementalRuntime ? {
              mode: incrementalRuntime.mode,
              cursorColumn: incrementalRuntime.cursorColumn,
              previousCursorValue: incrementalRuntime.previousCursorValue ?? null,
              nextCursorValue: incrementalRuntime.nextCursorValue ?? null,
              whereClause: incrementalRuntime.whereClause
            } : null
          }
        };
      }
      if (targetRuntime.sourceType === "gaussdb") {
        const result2 = await executeGaussDbTargetTask(task, incrementalRuntime);
        if (incrementalRuntime && incrementalRuntime.nextCursorValue !== void 0 && incrementalRuntime.nextCursorValue !== null) {
          await repository.updateTask(task.id, {
            incrementalConfig: {
              ...task.incrementalConfig || {},
              mode: incrementalRuntime.mode,
              cursorColumn: incrementalRuntime.cursorColumn,
              ...incrementalRuntime.mode === "timestamp" ? { timestampColumn: incrementalRuntime.cursorColumn } : {},
              ...incrementalRuntime.mode === "id" ? { idColumn: incrementalRuntime.cursorColumn } : {},
              ...task.incrementalConfig?.startValue !== void 0 ? { startValue: task.incrementalConfig.startValue } : {},
              lastValue: incrementalRuntime.nextCursorValue,
              lastRunStartValue: incrementalRuntime.previousCursorValue ?? null,
              lastRunEndValue: incrementalRuntime.nextCursorValue,
              lastRunAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          });
        }
        return {
          success: true,
          recordsCount: result2.recordsCount || 0,
          metrics: result2.metrics || {},
          executionInfo: {
            ...result2.executionInfo,
            incremental: incrementalRuntime ? {
              mode: incrementalRuntime.mode,
              cursorColumn: incrementalRuntime.cursorColumn,
              previousCursorValue: incrementalRuntime.previousCursorValue ?? null,
              nextCursorValue: incrementalRuntime.nextCursorValue ?? null,
              whereClause: incrementalRuntime.whereClause
            } : null
          }
        };
      }
      if (sourceRuntime.sourceType === "gaussdb") {
        const result2 = await executeGaussDbSourceTask(task, incrementalRuntime);
        if (incrementalRuntime && incrementalRuntime.nextCursorValue !== void 0 && incrementalRuntime.nextCursorValue !== null) {
          await repository.updateTask(task.id, {
            incrementalConfig: {
              ...task.incrementalConfig || {},
              mode: incrementalRuntime.mode,
              cursorColumn: incrementalRuntime.cursorColumn,
              ...incrementalRuntime.mode === "timestamp" ? { timestampColumn: incrementalRuntime.cursorColumn } : {},
              ...incrementalRuntime.mode === "id" ? { idColumn: incrementalRuntime.cursorColumn } : {},
              ...task.incrementalConfig?.startValue !== void 0 ? { startValue: task.incrementalConfig.startValue } : {},
              lastValue: incrementalRuntime.nextCursorValue,
              lastRunStartValue: incrementalRuntime.previousCursorValue ?? null,
              lastRunEndValue: incrementalRuntime.nextCursorValue,
              lastRunAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          });
        }
        return {
          success: true,
          recordsCount: result2.recordsCount || 0,
          metrics: result2.metrics || {},
          executionInfo: {
            ...result2.executionInfo,
            incremental: incrementalRuntime ? {
              mode: incrementalRuntime.mode,
              cursorColumn: incrementalRuntime.cursorColumn,
              previousCursorValue: incrementalRuntime.previousCursorValue ?? null,
              nextCursorValue: incrementalRuntime.nextCursorValue ?? null,
              whereClause: incrementalRuntime.whereClause
            } : null
          }
        };
      }
      const jobConfig = buildJobConfig(task, incrementalRuntime);
      const jobJson = dataxService.buildDataXJob(jobConfig);
      let lastProgressPersistAt = 0;
      const result = await dataxService.executeJob(processJobId, jobJson, {
        onProgress: ({ metrics }) => {
          if (!jobRun) {
            return;
          }
          const now = Date.now();
          if (now - lastProgressPersistAt < PROGRESS_PERSIST_INTERVAL_MS) {
            return;
          }
          lastProgressPersistAt = now;
          repository.updateJobRun(jobRun.id, {
            recordsCount: metrics.totalRecords || 0,
            executionInfo: {
              runId: jobRun.executionInfo?.runId || processJobId,
              processJobId,
              scheduled: true,
              progressAt: (/* @__PURE__ */ new Date()).toISOString(),
              metrics
            }
          }).catch((error) => {
            console.error(`[Scheduler] Failed to persist progress for task ${task.id}:`, error.message);
          });
        }
      });
      if (result.success) {
        if (result.cancelled || result.result?.status === "cancelled") {
          return {
            cancelled: true,
            recordsCount: result.result?.metrics?.totalRecords || 0,
            metrics: result.result?.metrics || {},
            executionInfo: result.result || null
          };
        }
        if (incrementalRuntime && incrementalRuntime.nextCursorValue !== void 0 && incrementalRuntime.nextCursorValue !== null) {
          await repository.updateTask(task.id, {
            incrementalConfig: {
              ...task.incrementalConfig || {},
              mode: incrementalRuntime.mode,
              cursorColumn: incrementalRuntime.cursorColumn,
              ...incrementalRuntime.mode === "timestamp" ? { timestampColumn: incrementalRuntime.cursorColumn } : {},
              ...incrementalRuntime.mode === "id" ? { idColumn: incrementalRuntime.cursorColumn } : {},
              ...task.incrementalConfig?.startValue !== void 0 ? { startValue: task.incrementalConfig.startValue } : {},
              lastValue: incrementalRuntime.nextCursorValue,
              lastRunStartValue: incrementalRuntime.previousCursorValue ?? null,
              lastRunEndValue: incrementalRuntime.nextCursorValue,
              lastRunAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          });
        }
        return {
          success: true,
          recordsCount: result.result?.metrics?.totalRecords || 0,
          metrics: result.result?.metrics || {},
          executionInfo: {
            ...result.result || {},
            incremental: incrementalRuntime ? {
              mode: incrementalRuntime.mode,
              cursorColumn: incrementalRuntime.cursorColumn,
              previousCursorValue: incrementalRuntime.previousCursorValue ?? null,
              nextCursorValue: incrementalRuntime.nextCursorValue ?? null,
              whereClause: incrementalRuntime.whereClause
            } : null
          }
        };
      } else {
        const error = new Error(result.error || "Task execution failed");
        error.executionInfo = result.result || null;
        error.cancelled = result.cancelled === true || result.result?.status === "cancelled";
        throw error;
      }
    }
    async function executeHiveTargetTask(task, incrementalRuntime = null) {
      const sourceRows = await fetchSourceRows(task, incrementalRuntime);
      const fieldMappings = task.fieldMappings || [];
      const targetColumns = fieldMappings.map((item) => ({
        columnName: item.targetField,
        dataType: item.dataType || "string"
      }));
      const transformedRows = sourceRows.map((row) => Object.fromEntries(
        fieldMappings.map((mapping) => [mapping.targetField, row[mapping.sourceField]])
      ));
      await hiveService.loadRows(
        task.targetConnectionConfig || {},
        task.targetTable,
        targetColumns,
        transformedRows,
        {
          writeMode: task.targetConfig?.writeMode || "append",
          fileType: task.targetConfig?.fileType || "parquet"
        }
      );
      return {
        recordsCount: transformedRows.length,
        metrics: {
          totalRecords: transformedRows.length,
          errorRecords: 0
        },
        executionInfo: {
          engine: "hive-driver",
          writeMode: task.targetConfig?.writeMode || "append",
          targetTable: task.targetTable
        }
      };
    }
    async function executeGaussDbSourceTask(task, incrementalRuntime = null) {
      const sourceRows = await fetchSourceRows(task, incrementalRuntime);
      const fieldMappings = task.fieldMappings || [];
      const targetColumns = fieldMappings.map((item) => item.targetField).filter(Boolean);
      const transformedRows = sourceRows.map((row) => Object.fromEntries(
        fieldMappings.map((mapping) => [mapping.targetField, row[mapping.sourceField]])
      ));
      const targetRuntime = parseConnectionConfig(task.targetConnectionConfig || {}, task.targetSourceType || task.targetType || "mysql");
      if (targetRuntime.dialect !== "mysql") {
        throw new Error(`Unsupported GaussDB source target dialect: ${targetRuntime.dialect}`);
      }
      await writeMysqlRows(targetRuntime, task.targetTable, targetColumns, transformedRows, {
        writeMode: task.targetConfig?.writeMode || "append"
      });
      return {
        recordsCount: transformedRows.length,
        metrics: {
          totalRecords: transformedRows.length,
          errorRecords: 0
        },
        executionInfo: {
          engine: "node-opengauss-to-mysql",
          writeMode: task.targetConfig?.writeMode || "append",
          targetTable: task.targetTable
        }
      };
    }
    async function writeMysqlRows(connectionConfig, tableName, targetColumns, rows, options = {}) {
      const writeMode = String(options.writeMode || "append").toLowerCase();
      const connection = await mysql.createConnection({
        host: connectionConfig.host,
        port: Number(connectionConfig.port),
        database: connectionConfig.database,
        user: connectionConfig.username,
        password: connectionConfig.password,
        connectTimeout: 5e3
      });
      try {
        const qualifiedTable = dataSourceMetadata.escapeIdentifier(tableName, "mysql");
        if (writeMode === "overwrite") {
          await connection.query(`TRUNCATE TABLE ${qualifiedTable}`);
        }
        if (rows.length > 0 && targetColumns.length > 0) {
          await insertMysqlRows(connection, qualifiedTable, targetColumns, rows, {
            replace: writeMode === "replace"
          });
        }
      } finally {
        await connection.end();
      }
    }
    async function insertMysqlRows(connection, qualifiedTable, targetColumns, rows, options = {}) {
      const batchSize = 500;
      const verb = options.replace ? "REPLACE" : "INSERT";
      const columnSql = targetColumns.map((column) => dataSourceMetadata.escapeIdentifier(column, "mysql")).join(", ");
      for (let offset = 0; offset < rows.length; offset += batchSize) {
        const batch = rows.slice(offset, offset + batchSize);
        const values = [];
        const rowPlaceholders = batch.map((row) => {
          const placeholders = targetColumns.map((column) => {
            values.push(row[column] === void 0 ? null : row[column]);
            return "?";
          });
          return `(${placeholders.join(", ")})`;
        });
        await connection.query(
          `${verb} INTO ${qualifiedTable} (${columnSql}) VALUES ${rowPlaceholders.join(", ")}`,
          values
        );
      }
    }
    async function executeGaussDbTargetTask(task, incrementalRuntime = null) {
      const sourceRows = await fetchSourceRows(task, incrementalRuntime);
      const fieldMappings = task.fieldMappings || [];
      const targetColumns = fieldMappings.map((item) => item.targetField).filter(Boolean);
      const transformedRows = sourceRows.map((row) => Object.fromEntries(
        fieldMappings.map((mapping) => [mapping.targetField, row[mapping.sourceField]])
      ));
      const targetConfig = parseConnectionConfig(task.targetConnectionConfig || {}, task.targetSourceType || task.targetType || "gaussdb");
      const writeMode = String(task.targetConfig?.writeMode || "append").toLowerCase();
      const qualifiedTable = dataSourceMetadata.escapeIdentifier(task.targetTable, "gaussdb");
      const client = createPostgresLikeClient({
        host: targetConfig.host,
        port: Number(targetConfig.port),
        database: targetConfig.database,
        user: targetConfig.username,
        username: targetConfig.username,
        password: targetConfig.password,
        connectionTimeoutMillis: 5e3
      }, {
        sourceType: "gaussdb"
      });
      await client.connect();
      try {
        if (writeMode === "overwrite") {
          await client.query(`TRUNCATE TABLE ${qualifiedTable}`);
        }
        if (transformedRows.length > 0 && targetColumns.length > 0) {
          await insertGaussDbRows(client, qualifiedTable, targetColumns, transformedRows);
        }
      } finally {
        await client.end();
      }
      return {
        recordsCount: transformedRows.length,
        metrics: {
          totalRecords: transformedRows.length,
          errorRecords: 0
        },
        executionInfo: {
          engine: "node-opengauss",
          writeMode,
          targetTable: task.targetTable
        }
      };
    }
    async function insertGaussDbRows(client, qualifiedTable, targetColumns, rows) {
      const batchSize = 200;
      const columnSql = targetColumns.map((column) => dataSourceMetadata.escapeIdentifier(column, "gaussdb")).join(", ");
      for (let offset = 0; offset < rows.length; offset += batchSize) {
        const batch = rows.slice(offset, offset + batchSize);
        const values = [];
        const rowPlaceholders = batch.map((row, rowIndex) => {
          const placeholders = targetColumns.map((column, columnIndex) => {
            values.push(row[column] === void 0 ? null : row[column]);
            return `$${rowIndex * targetColumns.length + columnIndex + 1}`;
          });
          return `(${placeholders.join(", ")})`;
        });
        await client.query(
          `INSERT INTO ${qualifiedTable} (${columnSql}) VALUES ${rowPlaceholders.join(", ")}`,
          values
        );
      }
    }
    async function fetchSourceRows(task, incrementalRuntime = null) {
      const connection = parseConnectionConfig(task.sourceConnectionConfig || {}, task.sourceType || "mysql");
      const sourceType = connection.dialect;
      const fieldMappings = task.fieldMappings || [];
      const sourceFields = fieldMappings.length > 0 ? [...new Set(fieldMappings.map((item) => item.sourceField))] : ["*"];
      const selectSql = sourceFields[0] === "*" ? "*" : sourceFields.map((field) => escapeSourceIdentifier(field, sourceType)).join(", ");
      const tableSql = escapeSourceIdentifier(task.sourceTable, sourceType);
      const whereSql = incrementalRuntime?.whereClause ? ` WHERE ${incrementalRuntime.whereClause}` : "";
      const sql = `SELECT ${selectSql} FROM ${tableSql}${whereSql}`;
      if (sourceType === "postgresql") {
        const client = createPostgresLikeClient({
          host: connection.host,
          port: Number(connection.port),
          database: connection.database,
          user: connection.username,
          username: connection.username,
          password: connection.password,
          connectionTimeoutMillis: 5e3
        }, {
          sourceType: String(task.sourceType || "").trim().toLowerCase() === "gaussdb" ? "gaussdb" : "postgresql"
        });
        await client.connect();
        try {
          const result = await client.query(sql);
          return result.rows;
        } finally {
          await client.end();
        }
      }
      if (sourceType !== "mysql") {
        throw new Error(`Unsupported ingestion source dialect: ${sourceType}`);
      }
      const conn = await mysql.createConnection({
        host: connection.host,
        port: Number(connection.port),
        database: connection.database,
        user: connection.username,
        password: connection.password,
        connectTimeout: 5e3
      });
      try {
        const [rows] = await conn.query(sql);
        return rows;
      } finally {
        await conn.end();
      }
    }
    function escapeSourceIdentifier(identifier, sourceType = "mysql") {
      return dataSourceMetadata.escapeIdentifier(identifier, sourceType);
    }
    function buildJobConfig(task, incrementalRuntime = null) {
      const sourceConfig = parseConnectionConfig(task.sourceConnectionConfig || {}, task.sourceType || "mysql");
      const targetConfig = parseConnectionConfig(task.targetConnectionConfig || {}, task.targetSourceType || task.targetType || "mysql");
      const targetConnection = {
        ...targetConfig,
        ...task.targetConfig || {}
      };
      const fieldMappings = task.fieldMappings || [];
      const transformRules = task.transformRules || [];
      const sourceColumns = fieldMappings.length > 0 ? buildReaderColumns(fieldMappings, transformRules, sourceConfig.dialect || "mysql") : sourceConfig.column || ["*"];
      return {
        source: {
          type: sourceConfig.dialect || "mysql",
          connection: {
            ...sourceConfig,
            table: task.sourceTable ? [task.sourceTable] : sourceConfig.table || [],
            column: sourceColumns,
            ...incrementalRuntime?.whereClause ? { where: incrementalRuntime.whereClause } : {}
          }
        },
        writer: {
          type: targetConfig.dialect || task.targetSourceType || task.targetType,
          connection: {
            ...targetConnection,
            table: task.targetTable ? [task.targetTable] : targetConnection.table || [],
            column: fieldMappings.length > 0 ? fieldMappings.map((item) => item.targetField) : targetConnection.column || ["*"]
          }
        },
        fieldMappings,
        transformRules,
        channel: 1
      };
    }
    async function prepareIncrementalRuntime(task) {
      if (task.syncMode !== "incremental") {
        return null;
      }
      const incrementalConfig = task.incrementalConfig || {};
      const sourceConfig = parseConnectionConfig(task.sourceConnectionConfig || {}, task.sourceType || "mysql");
      const mode = incrementalConfig.mode || "timestamp";
      const cursorColumn = incrementalConfig.cursorColumn || incrementalConfig.timestampColumn || incrementalConfig.idColumn;
      if (!cursorColumn) {
        throw new Error("\u589E\u91CF\u4EFB\u52A1\u7F3A\u5C11\u589E\u91CF\u5B57\u6BB5\u914D\u7F6E");
      }
      const nextCursorValue = await dataSourceMetadata.getColumnMaximum(
        {
          sourceType: task.sourceType || "mysql",
          connectionConfig: task.sourceConnectionConfig || {}
        },
        task.sourceTable,
        cursorColumn
      );
      const previousCursorValue = incrementalConfig.lastValue !== void 0 && incrementalConfig.lastValue !== null ? incrementalConfig.lastValue : incrementalConfig.startValue !== void 0 ? incrementalConfig.startValue : null;
      const normalizedPreviousCursorValue = normalizeIncrementalCursorValue(mode, previousCursorValue);
      const normalizedNextCursorValue = normalizeIncrementalCursorValue(mode, nextCursorValue);
      return {
        mode,
        cursorColumn,
        previousCursorValue: normalizedPreviousCursorValue,
        nextCursorValue: normalizedNextCursorValue,
        whereClause: buildIncrementalWhereClause(
          sourceConfig.dialect || task.sourceType || "mysql",
          mode,
          cursorColumn,
          normalizedPreviousCursorValue,
          normalizedNextCursorValue
        )
      };
    }
    function buildIncrementalWhereClause(sourceType, mode, cursorColumn, previousCursorValue, nextCursorValue) {
      const quotedColumn = dataSourceMetadata.escapeIdentifier(cursorColumn, sourceType);
      if (nextCursorValue === null || nextCursorValue === void 0) {
        return "1 = 0";
      }
      const nextValueSql = formatIncrementalValue(sourceType, mode, nextCursorValue);
      if (previousCursorValue === null || previousCursorValue === void 0 || previousCursorValue === "") {
        return `${quotedColumn} <= ${nextValueSql}`;
      }
      const previousValueSql = formatIncrementalValue(sourceType, mode, previousCursorValue);
      return `${quotedColumn} > ${previousValueSql} AND ${quotedColumn} <= ${nextValueSql}`;
    }
    function formatIncrementalValue(sourceType, mode, value) {
      const escaped = dataSourceMetadata.escapeValue(value);
      return escaped;
    }
    function normalizeIncrementalCursorValue(mode, value) {
      if (value === null || value === void 0 || value === "") {
        return value;
      }
      if (mode !== "timestamp") {
        return value;
      }
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) {
        return value;
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
    function parseConnectionConfig(config, sourceType = "mysql") {
      if (typeof config === "string") {
        try {
          config = JSON.parse(config);
        } catch (e) {
          return {};
        }
      }
      if (!config) {
        return {};
      }
      const connection = config.connection && Array.isArray(config.connection) ? config.connection[0] || {} : {};
      const mergedConfig = {
        ...config,
        jdbcUrl: config.jdbcUrl || config.url || connection.jdbcUrl,
        table: config.table || connection.table,
        column: config.column
      };
      const normalizedType = normalizeDatasourceType(sourceType || config.dbType || config.sourceType || "mysql");
      const resolved = resolveDatasourceConnection(sourceType || normalizedType, mergedConfig);
      const dialect = inferDatasourceDialect(normalizedType, mergedConfig);
      return {
        sourceType: normalizedType,
        dialect: dialect === "unknown" ? normalizedType || "mysql" : dialect,
        username: resolved.username || mergedConfig.username,
        password: resolved.password || mergedConfig.password,
        jdbcUrl: resolved.jdbcUrl || mergedConfig.jdbcUrl || mergedConfig.url || "",
        host: resolved.host || mergedConfig.host,
        port: Number(resolved.port || mergedConfig.port || 0) || 0,
        database: resolved.database || mergedConfig.database || mergedConfig.databaseName,
        schema: resolved.schema || mergedConfig.schema || null,
        serviceName: mergedConfig.serviceName,
        sid: mergedConfig.sid,
        table: mergedConfig.table,
        column: mergedConfig.column,
        driverClassName: resolved.driverClassName || mergedConfig.driverClassName || null,
        protocol: resolved.protocol || mergedConfig.protocol || null
      };
    }
    function getScheduledTaskCount() {
      return scheduledTasks.size;
    }
    function isTaskScheduled(taskId) {
      return scheduledTasks.has(taskId.toString());
    }
    function buildReaderColumns(fieldMappings, transformRules, sourceType = "mysql") {
      const customRuleMap = new Map(
        (transformRules || []).filter((rule) => rule.transformType === "custom").map((rule) => [rule.field, rule.config || {}])
      );
      const primaryKeyFields = fieldMappings.filter((item) => item.isPrimaryKey && !String(item.sourceField || "").startsWith("__custom_")).map((item) => item.sourceField);
      return fieldMappings.map((mapping) => {
        const config = customRuleMap.get(mapping.targetField);
        if (!config) {
          return buildDefaultReaderColumn(mapping, sourceType);
        }
        const ruleType = String(config.ruleType || "");
        const sourceFields = Array.isArray(config.sourceFields) ? config.sourceFields.map(String).filter(Boolean) : [];
        const sql = buildCustomColumnExpression(
          ruleType,
          mapping,
          sourceFields,
          primaryKeyFields,
          config.customValue,
          sourceType
        );
        return sql || buildDefaultReaderColumn(mapping, sourceType);
      });
    }
    function buildDefaultReaderColumn(mapping, sourceType = "mysql") {
      const sourceField = String(mapping.sourceField || "").trim();
      if (!sourceField) {
        return sourceField;
      }
      const normalizedType = String(mapping.dataType || "").trim().toLowerCase();
      if (String(sourceType).toLowerCase() === "postgresql" && ["json", "jsonb"].includes(normalizedType)) {
        const sourceColumn = escapeSqlIdentifier(sourceField, sourceType);
        return `${sourceColumn}::text AS ${sourceColumn}`;
      }
      return sourceField;
    }
    function buildCustomColumnExpression(ruleType, mapping, sourceFields, primaryKeyFields, customValue, sourceType = "mysql") {
      const targetField = escapeSqlIdentifier(mapping.targetField, sourceType);
      switch (ruleType) {
        case "current_time":
          return `${getCurrentTimeExpression(sourceType)} AS ${targetField}`;
        case "random_md5":
          return `${getRandomHashExpression(sourceType)} AS ${targetField}`;
        case "primary_key_md5": {
          const fields = primaryKeyFields.length > 0 ? primaryKeyFields : [mapping.sourceField].filter(Boolean);
          return buildMd5Expression(fields, targetField, sourceType);
        }
        case "business_field_md5":
          return buildMd5Expression(sourceFields, targetField, sourceType);
        case "custom_value":
          return `${dataSourceMetadata.escapeValue(customValue ?? "")} AS ${targetField}`;
        default:
          return null;
      }
    }
    function buildMd5Expression(sourceFields, targetField, sourceType = "mysql") {
      const fields = (sourceFields || []).filter((field) => field && !String(field).startsWith("__custom_"));
      if (fields.length === 0) {
        return `${getRandomHashExpression(sourceType)} AS ${targetField}`;
      }
      if (String(sourceType).toLowerCase() === "postgresql") {
        const normalized2 = fields.map((field) => `COALESCE(CAST(${escapeSqlIdentifier(field, sourceType)} AS TEXT), '')`);
        return `MD5(CONCAT_WS('|', ${normalized2.join(", ")})) AS ${targetField}`;
      }
      const normalized = fields.map((field) => `COALESCE(CAST(${escapeSqlIdentifier(field, sourceType)} AS CHAR), '')`);
      return `MD5(CONCAT_WS('|', ${normalized.join(", ")})) AS ${targetField}`;
    }
    function getCurrentTimeExpression(sourceType = "mysql") {
      return String(sourceType).toLowerCase() === "postgresql" ? "CURRENT_TIMESTAMP" : "NOW()";
    }
    function getRandomHashExpression(sourceType = "mysql") {
      if (String(sourceType).toLowerCase() === "postgresql") {
        return "MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text)";
      }
      return "MD5(UUID())";
    }
    function escapeSqlIdentifier(identifier, sourceType = "mysql") {
      if (String(sourceType).toLowerCase() === "postgresql") {
        return `"${String(identifier || "").replace(/"/g, '""')}"`;
      }
      return `\`${String(identifier || "").replace(/`/g, "``")}\``;
    }
    module2.exports = {
      startScheduler,
      scheduleTask,
      unscheduleTask,
      runTaskNow,
      stopTaskRun,
      loadScheduledTasks,
      getScheduledTaskCount,
      isTaskScheduled
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

// backend/src/modules/ingestion-tasks/ingestion-task.service.js
var require_ingestion_task_service = __commonJS({
  "backend/src/modules/ingestion-tasks/ingestion-task.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var repository = require_ingestion_task_repository();
    var dataSourceRepository = require_data_source_repository();
    var dataSourceMetadata = require_data_source_metadata();
    var dataSourcePreview = require_data_source_preview();
    var schedulerService = require_schedulerService();
    var modelProviderService = require_model_provider_service();
    var ingestionAiConfigService = require_ingestion_ai_config_service();
    var hiveService = require_hiveService();
    var apiIngestionService = require_apiIngestionService();
    var {
      inferDatasourceDialect,
      normalizeDatasourceType
    } = require_datasource_dialect();
    var failureAnalysisCache = /* @__PURE__ */ new Map();
    var SUPPORTED_RDBMS_DIALECTS = /* @__PURE__ */ new Set(["mysql", "postgresql"]);
    var SUPPORTED_STREAM_SOURCE_DIALECTS = /* @__PURE__ */ new Set(["kafka", "ftp", "api"]);
    var SUPPORTED_TARGET_DIALECTS = /* @__PURE__ */ new Set(["mysql", "postgresql", "hive"]);
    function resolveDatasourceDialect(sourceType, connectionConfig = {}) {
      const normalizedType = normalizeDatasourceType(sourceType);
      const dialect = inferDatasourceDialect(normalizedType, connectionConfig || {});
      return dialect === "unknown" ? normalizedType : dialect;
    }
    async function listTasks(filters) {
      return repository.listTasks(filters);
    }
    async function getMonitorOverview(options = {}) {
      const pageSize = Math.max(20, Math.min(500, Number(options.pageSize) || 200));
      const runLimit = Math.max(10, Math.min(200, Number(options.runLimit) || 50));
      const taskResult = await repository.listTasks({ page: 1, pageSize });
      const tasks = taskResult.list || [];
      const taskIds = tasks.map((task) => task.id);
      await Promise.all(taskIds.flatMap((taskId) => [
        repository.reconcileTerminalRunningJobRuns(taskId),
        repository.reconcileHistoricalRunningJobRuns(taskId)
      ]));
      const [dataSources, runs] = await Promise.all([
        dataSourceRepository.listDataSources({ includeConnectivity: true }),
        repository.getJobRunSummariesByTaskIds(taskIds, runLimit)
      ]);
      const runsByTask = {};
      for (const run of runs) {
        if (!runsByTask[run.taskId]) {
          runsByTask[run.taskId] = [];
        }
        runsByTask[run.taskId].push(run);
      }
      return {
        tasks,
        dataSources,
        runsByTask,
        runLimit,
        totalTasks: taskResult.total || tasks.length
      };
    }
    function shouldRegisterTaskSchedule(task) {
      return Boolean(
        task && task.scheduleEnabled === true && task.status === "active" && task.scheduleConfig && task.scheduleConfig.scheduleType && task.scheduleConfig.scheduleType !== "manual"
      );
    }
    async function createTask(payload) {
      try {
        const existingTask = await repository.getTaskByCode(payload.taskCode);
        if (existingTask) {
          throw new AppError("\u4EFB\u52A1\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        const normalizedPayload = await normalizeTaskPayload(payload);
        const createdTask = await repository.createTask(normalizedPayload);
        if (shouldRegisterTaskSchedule(createdTask)) {
          await schedulerService.scheduleTask(createdTask);
        }
        return createdTask;
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u4EFB\u52A1\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        if (error.code === "ER_NO_REFERENCED_ROW_2") {
          throw new AppError("\u6307\u5B9A\u7684\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 400);
        }
        throw error;
      }
    }
    async function updateTask(id, payload) {
      try {
        const existingTask = await repository.getTaskById(id);
        if (!existingTask) {
          throw new AppError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
        }
        if (existingTask.status === "running") {
          throw new AppError("\u4EFB\u52A1\u6B63\u5728\u8FD0\u884C\u4E2D\uFF0C\u4E0D\u5141\u8BB8\u4FEE\u6539", 400);
        }
        const mergedPayload = {
          ...existingTask,
          ...payload,
          targetTableMode: normalizeTargetTableMode(
            payload.targetTableMode,
            existingTask.targetConfig?.targetTableMode
          ),
          fieldMappings: payload.fieldMappings !== void 0 ? payload.fieldMappings : existingTask.fieldMappings,
          transformRules: payload.transformRules !== void 0 ? payload.transformRules : existingTask.transformRules,
          incrementalConfig: payload.incrementalConfig !== void 0 ? payload.incrementalConfig : existingTask.incrementalConfig,
          sourceConfig: payload.sourceConfig !== void 0 ? payload.sourceConfig : existingTask.sourceConfig,
          parseConfig: payload.parseConfig !== void 0 ? payload.parseConfig : existingTask.parseConfig,
          errorConfig: payload.errorConfig !== void 0 ? payload.errorConfig : existingTask.errorConfig,
          scheduleConfig: payload.scheduleConfig !== void 0 ? payload.scheduleConfig : existingTask.scheduleConfig
        };
        const normalizedPayload = await normalizeTaskPayload(mergedPayload, true, existingTask);
        const updatedTask = await repository.updateTask(id, normalizedPayload);
        if (shouldRegisterTaskSchedule(updatedTask)) {
          await schedulerService.scheduleTask(updatedTask);
        } else {
          await schedulerService.unscheduleTask(id);
        }
        return updatedTask;
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u4EFB\u52A1\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        if (error.code === "ER_NO_REFERENCED_ROW_2") {
          throw new AppError("\u6307\u5B9A\u7684\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 400);
        }
        throw error;
      }
    }
    async function previewTaskUpdate(id, payload) {
      const existingTask = await repository.getTaskById(id);
      if (!existingTask) {
        throw new AppError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
      }
      if (existingTask.status === "running") {
        throw new AppError("\u4EFB\u52A1\u6B63\u5728\u8FD0\u884C\u4E2D\uFF0C\u4E0D\u5141\u8BB8\u4FEE\u6539", 400);
      }
      const mergedPayload = {
        ...existingTask,
        ...payload,
        targetTableMode: normalizeTargetTableMode(
          payload.targetTableMode,
          existingTask.targetConfig?.targetTableMode
        ),
        fieldMappings: payload.fieldMappings !== void 0 ? payload.fieldMappings : existingTask.fieldMappings,
        transformRules: payload.transformRules !== void 0 ? payload.transformRules : existingTask.transformRules,
        incrementalConfig: payload.incrementalConfig !== void 0 ? payload.incrementalConfig : existingTask.incrementalConfig,
        sourceConfig: payload.sourceConfig !== void 0 ? payload.sourceConfig : existingTask.sourceConfig,
        parseConfig: payload.parseConfig !== void 0 ? payload.parseConfig : existingTask.parseConfig,
        errorConfig: payload.errorConfig !== void 0 ? payload.errorConfig : existingTask.errorConfig,
        scheduleConfig: payload.scheduleConfig !== void 0 ? payload.scheduleConfig : existingTask.scheduleConfig
      };
      const normalizedPayload = await normalizeTaskPayload(mergedPayload, true, existingTask);
      return {
        existingTask,
        normalizedPayload,
        previewTask: {
          ...existingTask,
          ...normalizedPayload,
          id: existingTask.id
        }
      };
    }
    async function previewSourceData(payload) {
      const source = await dataSourceRepository.getDataSourceById(payload.sourceId);
      if (!source) {
        throw new AppError("\u6765\u6E90\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 400);
      }
      const sourceDialect = resolveDatasourceDialect(source.sourceType, source.connectionConfig || {});
      const normalizedSourceTable = normalizeTableNameBySourceType(payload.sourceTable, source.sourceType);
      const sourceConfig = normalizeSourceConfig(sourceDialect, payload.sourceConfig || {}, normalizedSourceTable);
      const parseConfig = normalizeParseConfig(sourceDialect, payload.parseConfig || {});
      const limit = Math.max(1, Math.min(100, Number(payload.limit || 20)));
      const rows = await dataSourcePreview.sampleRowsWithOptions(source, normalizedSourceTable, {
        sourceConfig,
        parseConfig,
        limit
      });
      return {
        sourceId: source.id,
        sourceName: source.sourceName,
        sourceType: sourceDialect,
        sourceTable: normalizedSourceTable,
        sourceConfig,
        parseConfig,
        rows,
        totalPreviewRows: rows.length
      };
    }
    async function normalizeTaskPayload(payload, isUpdate = false, existingTask = null) {
      const source = await dataSourceRepository.getDataSourceById(payload.sourceId);
      const target = await dataSourceRepository.getDataSourceById(payload.targetSourceId);
      const normalizedSourceTable = normalizeTableNameBySourceType(payload.sourceTable, source?.sourceType);
      const normalizedTargetTable = normalizeTableNameBySourceType(payload.targetTable, target?.sourceType);
      if (!source) {
        throw new AppError("\u6765\u6E90\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 400);
      }
      if (!target) {
        throw new AppError("\u76EE\u6807\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 400);
      }
      const sourceDialect = resolveDatasourceDialect(source.sourceType, source.connectionConfig || {});
      const targetDialect = resolveDatasourceDialect(target.sourceType, target.connectionConfig || {});
      const isRdbmsSource = SUPPORTED_RDBMS_DIALECTS.has(sourceDialect);
      const isStreamSource = SUPPORTED_STREAM_SOURCE_DIALECTS.has(sourceDialect);
      if (!isRdbmsSource && !isStreamSource) {
        throw new AppError("\u5F53\u524D\u63A5\u5165\u4EFB\u52A1\u4EC5\u652F\u6301 MySQL / PostgreSQL / Kafka / FTP / API \u6765\u6E90\u6570\u636E\u6E90\uFF0CGaussDB \u4E0E\u517C\u5BB9 JDBC \u8FDE\u63A5\u53EF\u6309\u5BF9\u5E94\u65B9\u8A00\u63A5\u5165", 400);
      }
      if (!SUPPORTED_TARGET_DIALECTS.has(targetDialect)) {
        throw new AppError("\u5F53\u524D\u63A5\u5165\u4EFB\u52A1\u4EC5\u652F\u6301 MySQL / PostgreSQL / Hive \u65B9\u8A00\u76EE\u6807\u6570\u636E\u6E90\uFF0CGaussDB \u4E0E\u517C\u5BB9 JDBC \u8FDE\u63A5\u53EF\u6309\u5BF9\u5E94\u65B9\u8A00\u63A5\u5165", 400);
      }
      const sourceConfig = normalizeSourceConfig(sourceDialect, payload.sourceConfig || {}, normalizedSourceTable);
      const parseConfig = normalizeParseConfig(sourceDialect, payload.parseConfig || {});
      const errorConfig = normalizeErrorConfig(payload.errorConfig || {});
      const sourceColumns = isStreamSource ? await resolveStreamSourceColumns(source, sourceDialect, normalizedSourceTable, sourceConfig, parseConfig) : await dataSourceMetadata.listColumns(source, normalizedSourceTable);
      if (!sourceColumns.length) {
        throw new AppError(isStreamSource ? "\u6765\u6E90\u5BF9\u8C61\u6CA1\u6709\u53EF\u8BC6\u522B\u5B57\u6BB5\uFF0C\u8BF7\u5148\u786E\u8BA4\u6837\u4F8B\u6570\u636E\u6216\u89E3\u6790\u89C4\u5219" : "\u6765\u6E90\u8868\u4E0D\u5B58\u5728\u6216\u6CA1\u6709\u5B57\u6BB5", 400);
      }
      const sourceTables = isRdbmsSource ? await dataSourceMetadata.listTables(source) : [];
      const sourceTableComment = isRdbmsSource ? resolveSourceTableComment(sourceTables, normalizedSourceTable) : `${sourceDialect === "kafka" ? "Kafka Topic" : sourceDialect === "ftp" ? "FTP \u6587\u4EF6" : "API \u63A5\u53E3"} ${normalizedSourceTable}`;
      const targetConfig = normalizeTargetConfig(payload.targetConfig || {}, target.sourceType, target.connectionConfig || {});
      const fieldMappings = (payload.fieldMappings || []).map((mapping) => ({
        ...mapping,
        dataType: mapping.dataType || sourceColumns.find((column) => column.columnName === mapping.sourceField)?.dataType
      }));
      if (!fieldMappings.length) {
        throw new AppError("\u81F3\u5C11\u9700\u8981\u4E00\u4E2A\u5B57\u6BB5\u6620\u5C04", 400);
      }
      const targetColumnsFromMappings = buildTargetColumnsFromMappings(
        sourceColumns,
        fieldMappings,
        target.sourceType,
        target.connectionConfig || {}
      );
      if (SUPPORTED_RDBMS_DIALECTS.has(targetDialect)) {
        const existingTargetTables = await dataSourceMetadata.listTables(target);
        const targetTableExists = existingTargetTables.some(
          (table) => table.tableName === normalizeTableNameBySourceType(normalizedTargetTable, target.sourceType)
        );
        if (normalizeTargetTableMode(payload.targetTableMode) === "create") {
          await dataSourceMetadata.ensureTableMatchesColumns(
            target,
            normalizedTargetTable,
            targetColumnsFromMappings,
            { tableComment: sourceTableComment }
          );
        }
        if (normalizeTargetTableMode(payload.targetTableMode) !== "create" && !targetTableExists) {
          throw new AppError("\u76EE\u6807\u8868\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5207\u6362\u4E3A\u81EA\u52A8\u5EFA\u8868\u6216\u5148\u521B\u5EFA\u76EE\u6807\u8868", 400);
        }
      } else if (targetDialect === "hive") {
        if (normalizeTargetTableMode(payload.targetTableMode) === "create") {
          await hiveService.ensureTableExists(
            target.connectionConfig || {},
            normalizedTargetTable,
            targetColumnsFromMappings,
            { fileType: targetConfig.fileType || "parquet" }
          );
        } else {
          const exists = await hiveService.tableExists(target.connectionConfig || {}, normalizedTargetTable);
          if (!exists) {
            throw new AppError("Hive \u76EE\u6807\u8868\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5148\u521B\u5EFA\u76EE\u6807\u8868\u6216\u5207\u6362\u4E3A\u81EA\u52A8\u5EFA\u8868", 400);
          }
        }
      }
      if (sourceDialect === "api" && payload.syncMode === "cdc") {
        throw new AppError("API \u63A5\u5165\u4EFB\u52A1\u4E0D\u652F\u6301 CDC\uFF0C\u540C\u6B65\u6A21\u5F0F\u8BF7\u9009\u62E9\u5168\u91CF\u6216\u589E\u91CF", 400);
      }
      const incrementalConfig = isRdbmsSource ? normalizeIncrementalConfig(
        payload.syncMode,
        payload.incrementalConfig,
        sourceColumns,
        isUpdate ? existingTask?.incrementalConfig || null : null
      ) : null;
      const scheduleConfig = await normalizeScheduleConfig(
        payload.scheduleConfig,
        isUpdate ? existingTask?.id || payload.id || null : null
      );
      return {
        ...isUpdate && payload.id ? { id: payload.id } : {},
        taskName: payload.taskName,
        taskCode: payload.taskCode,
        sourceId: payload.sourceId,
        sourceTable: normalizedSourceTable,
        targetSourceId: payload.targetSourceId,
        targetType: target.sourceType,
        targetTable: normalizedTargetTable,
        targetConfig: {
          ...targetConfig,
          table: [normalizedTargetTable],
          column: fieldMappings.map((item) => item.targetField),
          targetTableMode: normalizeTargetTableMode(payload.targetTableMode)
        },
        syncMode: payload.syncMode,
        status: payload.status,
        description: payload.description,
        ownerName: payload.ownerName,
        scheduleEnabled: payload.scheduleEnabled,
        fieldMappings,
        transformRules: payload.transformRules || [],
        incrementalConfig,
        sourceConfig,
        parseConfig,
        errorConfig,
        scheduleConfig
      };
    }
    async function resolveStreamSourceColumns(source, sourceDialect, sourceObject, sourceConfig, parseConfig = {}) {
      if (sourceDialect === "api") {
        const rows = await dataSourcePreview.sampleRowsWithOptions(source, sourceObject, {
          sourceConfig,
          parseConfig,
          limit: 20
        });
        return apiIngestionService.inferApiColumns(rows);
      }
      if (sourceDialect === "ftp" && sourceConfig.pathMode === "directory") {
        const files = await dataSourcePreview.listObjects(source, { includeDirectories: false });
        const matched = files.find(
          (item) => String(item.objectType || item.tableType || "").toLowerCase() !== "directory" && isPathUnderDirectory(item.tableName, sourceConfig.rootDir) && matchFilePattern(item.tableName, sourceConfig.filePattern, sourceConfig.excludePattern)
        );
        if (!matched) {
          throw new AppError("FTP \u76EE\u5F55\u4E0B\u6CA1\u6709\u5339\u914D\u6587\u4EF6\uFF0C\u65E0\u6CD5\u63A8\u65AD\u5B57\u6BB5", 400);
        }
        return dataSourcePreview.listColumns(source, matched.tableName);
      }
      return dataSourcePreview.listColumns(source, sourceObject);
    }
    function isPathUnderDirectory(filePath, directory) {
      const normalizedFile = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
      const normalizedDir = String(directory || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
      if (!normalizedDir) return true;
      return normalizedFile === normalizedDir || normalizedFile.startsWith(`${normalizedDir}/`);
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
      if (pattern.startsWith("/") && pattern.endsWith("/")) {
        return new RegExp(pattern.slice(1, -1)).test(fileName) || new RegExp(pattern.slice(1, -1)).test(normalizedPath);
      }
      const regexText = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
      return new RegExp(`^${regexText}$`, "i").test(fileName);
    }
    function normalizeSourceConfig(sourceDialect, rawConfig = {}, sourceObject = "") {
      if (sourceDialect === "kafka") {
        const topic = String(rawConfig.topic || sourceObject || "").trim();
        if (!topic) {
          throw new AppError("Kafka \u63A5\u5165\u4EFB\u52A1\u5FC5\u987B\u9009\u62E9 Topic", 400);
        }
        const consumerGroupId = String(rawConfig.consumerGroupId || rawConfig.groupId || `medata_ingestion_${topic}`).trim();
        const startMode = normalizeEnum(rawConfig.startMode || rawConfig.offsetReset || "latest", ["earliest", "latest", "stored"], "latest");
        const batchSize = Math.max(1, Math.min(5e3, Number(rawConfig.batchSize || rawConfig.maxMessages || 100)));
        const maxWaitMs = Math.max(1e3, Math.min(12e4, Number(rawConfig.maxWaitMs || rawConfig.pollTimeoutMs || 1e4)));
        return {
          topic,
          consumerGroupId,
          startMode,
          batchSize,
          maxWaitMs,
          includeMetadata: rawConfig.includeMetadata !== false,
          commitMode: normalizeEnum(rawConfig.commitMode || "after_write", ["after_write"], "after_write")
        };
      }
      if (sourceDialect === "ftp") {
        const rootDir = String(rawConfig.rootDir || rawConfig.directory || sourceObject || "").trim().replace(/\\/g, "/");
        if (!rootDir) {
          throw new AppError("FTP \u63A5\u5165\u4EFB\u52A1\u5FC5\u987B\u914D\u7F6E\u6839\u76EE\u5F55\u6216\u6587\u4EF6\u8DEF\u5F84", 400);
        }
        const pathMode = rawConfig.pathMode || (/\.[A-Za-z0-9]+$/.test(rootDir) ? "file" : "directory");
        return {
          rootDir,
          pathMode: normalizeEnum(pathMode, ["file", "directory"], "directory"),
          recursive: rawConfig.recursive !== false,
          maxDepth: Math.max(0, Math.min(10, Number(rawConfig.maxDepth ?? 3))),
          filePattern: String(rawConfig.filePattern || "*.txt").trim() || "*.txt",
          excludePattern: String(rawConfig.excludePattern || "\\.(tmp|writing)$").trim(),
          batchFileLimit: Math.max(1, Math.min(500, Number(rawConfig.batchFileLimit || 20))),
          stabilitySeconds: Math.max(0, Math.min(3600, Number(rawConfig.stabilitySeconds || 0))),
          postProcessAction: normalizeEnum(rawConfig.postProcessAction || "keep", ["keep", "delete", "archive"], "keep"),
          archiveDir: rawConfig.archiveDir ? String(rawConfig.archiveDir).trim().replace(/\\/g, "/") : ""
        };
      }
      if (sourceDialect === "api") {
        return apiIngestionService.normalizeApiSourceConfig(rawConfig, sourceObject);
      }
      return rawConfig || {};
    }
    function normalizeParseConfig(sourceDialect, rawConfig = {}) {
      if (sourceDialect === "kafka") {
        return {
          messageFormat: normalizeEnum(rawConfig.messageFormat || rawConfig.fileType || "json", ["json", "text", "csv", "txt"], "json"),
          encoding: String(rawConfig.encoding || "utf8").trim() || "utf8",
          jsonRootPath: rawConfig.jsonRootPath ? String(rawConfig.jsonRootPath).trim() : "",
          flattenJson: rawConfig.flattenJson !== false,
          delimiter: rawConfig.delimiter ? String(rawConfig.delimiter) : void 0,
          skipErrorRows: rawConfig.skipErrorRows !== false,
          keepRawValue: rawConfig.keepRawValue !== false
        };
      }
      if (sourceDialect === "ftp") {
        return {
          fileType: normalizeEnum(rawConfig.fileType || "txt", ["csv", "txt", "xls", "xlsx", "json", "xml"], "txt"),
          encoding: String(rawConfig.encoding || "utf8").trim() || "utf8",
          delimiter: rawConfig.delimiter ? String(rawConfig.delimiter) : void 0,
          quoteChar: rawConfig.quoteChar ? String(rawConfig.quoteChar) : '"',
          headerRowNumber: Math.max(1, Number(rawConfig.headerRowNumber || 1)),
          firstDataRowNumber: Math.max(1, Number(rawConfig.firstDataRowNumber || 2)),
          fieldNameMode: normalizeEnum(rawConfig.fieldNameMode || "header", ["header", "generated"], "header"),
          jsonRootPath: rawConfig.jsonRootPath ? String(rawConfig.jsonRootPath).trim() : "",
          xmlRowPath: rawConfig.xmlRowPath ? String(rawConfig.xmlRowPath).trim() : "",
          sheetName: rawConfig.sheetName ? String(rawConfig.sheetName).trim() : void 0,
          skipErrorRows: rawConfig.skipErrorRows !== false
        };
      }
      if (sourceDialect === "api") {
        return apiIngestionService.normalizeApiParseConfig(rawConfig);
      }
      return rawConfig || {};
    }
    function normalizeErrorConfig(rawConfig = {}) {
      if (rawConfig?.successStatusCodes || rawConfig?.retryStatusCodes || rawConfig?.maxRetries !== void 0) {
        const apiErrorConfig = apiIngestionService.normalizeApiErrorConfig(rawConfig);
        return {
          ...apiErrorConfig,
          parseErrorAction: normalizeEnum(rawConfig.parseErrorAction || "skip", ["skip", "fail"], "skip"),
          writeErrorAction: normalizeEnum(rawConfig.writeErrorAction || "fail", ["skip", "fail"], "fail")
        };
      }
      return {
        parseErrorAction: normalizeEnum(rawConfig.parseErrorAction || "skip", ["skip", "fail"], "skip"),
        writeErrorAction: normalizeEnum(rawConfig.writeErrorAction || "fail", ["skip", "fail"], "fail")
      };
    }
    async function normalizeScheduleConfig(rawScheduleConfig, currentTaskId = null) {
      if (!rawScheduleConfig) {
        return rawScheduleConfig;
      }
      const dependencyTaskIds = Array.from(
        new Set(
          (rawScheduleConfig.dependencyTaskIds || []).map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)
        )
      );
      if (currentTaskId && dependencyTaskIds.includes(Number(currentTaskId))) {
        throw new AppError("\u4EFB\u52A1\u4F9D\u8D56\u4E0D\u80FD\u5305\u542B\u5F53\u524D\u4EFB\u52A1\u81EA\u8EAB", 400);
      }
      if (dependencyTaskIds.length > 0) {
        const dependencyTasks = await Promise.all(
          dependencyTaskIds.map((dependencyTaskId) => repository.getTaskById(dependencyTaskId))
        );
        const missingDependencyTaskIds = dependencyTasks.map((task, index) => task ? null : dependencyTaskIds[index]).filter((item) => item !== null);
        if (missingDependencyTaskIds.length > 0) {
          throw new AppError(`\u4F9D\u8D56\u4EFB\u52A1\u4E0D\u5B58\u5728: ${missingDependencyTaskIds.join(", ")}`, 400);
        }
        if (currentTaskId) {
          await assertNoDependencyCycle(Number(currentTaskId), dependencyTaskIds);
        }
      }
      const retryCount = Math.max(0, Number(rawScheduleConfig.retryCount) || 0);
      const retryIntervalMs = rawScheduleConfig.retryIntervalMs === void 0 || rawScheduleConfig.retryIntervalMs === null ? void 0 : Math.max(1e3, Number(rawScheduleConfig.retryIntervalMs) || 0);
      if (retryCount > 0 && !retryIntervalMs) {
        throw new AppError("\u914D\u7F6E\u5931\u8D25\u91CD\u8BD5\u65F6\uFF0C\u5FC5\u987B\u8BBE\u7F6E\u6709\u6548\u7684\u91CD\u8BD5\u95F4\u9694", 400);
      }
      return {
        ...rawScheduleConfig,
        dependencyTaskIds,
        retryCount,
        retryIntervalMs: retryCount > 0 ? retryIntervalMs : void 0
      };
    }
    async function assertNoDependencyCycle(taskId, dependencyTaskIds) {
      const visited = /* @__PURE__ */ new Set();
      async function walk(currentTaskId, chain) {
        if (visited.has(currentTaskId)) {
          return;
        }
        visited.add(currentTaskId);
        const currentTask = await repository.getTaskById(currentTaskId);
        const nextDependencyTaskIds = currentTask?.scheduleConfig?.dependencyTaskIds || [];
        for (const nextDependencyTaskId of nextDependencyTaskIds) {
          if (Number(nextDependencyTaskId) === Number(taskId)) {
            throw new AppError(`\u4EFB\u52A1\u4F9D\u8D56\u5B58\u5728\u5FAA\u73AF\u5F15\u7528: ${[...chain, currentTaskId, taskId].join(" -> ")}`, 400);
          }
          await walk(Number(nextDependencyTaskId), [...chain, currentTaskId]);
        }
      }
      for (const dependencyTaskId of dependencyTaskIds) {
        await walk(Number(dependencyTaskId), [taskId]);
      }
    }
    function normalizeIncrementalConfig(syncMode, rawIncrementalConfig, sourceColumns, existingIncrementalConfig = null) {
      if (syncMode === "full") {
        return null;
      }
      const raw = rawIncrementalConfig || existingIncrementalConfig || {};
      const mode = raw.mode || "timestamp";
      const cursorColumn = raw.cursorColumn || raw.timestampColumn || raw.idColumn;
      if (syncMode === "incremental") {
        if (!["timestamp", "id"].includes(mode)) {
          throw new AppError("\u589E\u91CF\u540C\u6B65\u4EC5\u652F\u6301\u65F6\u95F4\u5B57\u6BB5\u6216\u5E8F\u53F7\u5B57\u6BB5", 400);
        }
        if (!cursorColumn) {
          throw new AppError("\u589E\u91CF\u540C\u6B65\u5FC5\u987B\u9009\u62E9\u589E\u91CF\u5B57\u6BB5", 400);
        }
        const sourceColumn = sourceColumns.find((column) => column.columnName === cursorColumn);
        if (!sourceColumn) {
          throw new AppError("\u589E\u91CF\u5B57\u6BB5\u4E0D\u5B58\u5728\u4E8E\u6765\u6E90\u8868\u7ED3\u6784\u4E2D", 400);
        }
        return {
          mode,
          cursorColumn,
          ...mode === "timestamp" ? { timestampColumn: cursorColumn } : {},
          ...mode === "id" ? { idColumn: cursorColumn } : {},
          startValue: raw.startValue !== void 0 && raw.startValue !== null && raw.startValue !== "" ? raw.startValue : existingIncrementalConfig?.startValue !== void 0 && existingIncrementalConfig?.startValue !== null && existingIncrementalConfig?.startValue !== "" ? existingIncrementalConfig.startValue : mode === "timestamp" ? "1970-01-01 00:00:00" : "0",
          ...raw.lastValue !== void 0 ? { lastValue: raw.lastValue } : existingIncrementalConfig?.lastValue !== void 0 ? { lastValue: existingIncrementalConfig.lastValue } : {},
          ...raw.lastRunStartValue !== void 0 ? { lastRunStartValue: raw.lastRunStartValue } : existingIncrementalConfig?.lastRunStartValue !== void 0 ? { lastRunStartValue: existingIncrementalConfig.lastRunStartValue } : {},
          ...raw.lastRunEndValue !== void 0 ? { lastRunEndValue: raw.lastRunEndValue } : existingIncrementalConfig?.lastRunEndValue !== void 0 ? { lastRunEndValue: existingIncrementalConfig.lastRunEndValue } : {},
          ...raw.lastRunAt !== void 0 ? { lastRunAt: raw.lastRunAt } : existingIncrementalConfig?.lastRunAt !== void 0 ? { lastRunAt: existingIncrementalConfig.lastRunAt } : {}
        };
      }
      if (syncMode === "cdc") {
        const cdcColumns = Array.isArray(raw.cdcColumns) ? raw.cdcColumns.filter(Boolean) : [];
        if (cdcColumns.length === 0) {
          throw new AppError("CDC \u540C\u6B65\u5FC5\u987B\u914D\u7F6E\u76D1\u542C\u5B57\u6BB5", 400);
        }
        return {
          mode: "cdc",
          cdcColumns
        };
      }
      return null;
    }
    function normalizeTargetConfig(targetConfig, targetType, connectionConfig = {}) {
      const normalizedTargetType = resolveDatasourceDialect(targetType, connectionConfig);
      const writeMode = targetConfig.writeMode || "append";
      const partitionConfig = targetConfig.partitionConfig || null;
      if (normalizedTargetType === "mysql") {
        const allowedWriteModes = ["append", "replace", "overwrite"];
        if (!allowedWriteModes.includes(writeMode)) {
          throw new AppError("MySQL \u76EE\u6807\u4EC5\u652F\u6301\u8FFD\u52A0\u5199\u3001\u66FF\u6362\u5199\u548C\u8986\u76D6\u5199", 400);
        }
        return {
          ...targetConfig,
          writeMode
        };
      }
      if (normalizedTargetType === "postgresql") {
        const allowedWriteModes = ["append", "upsert", "overwrite"];
        if (!allowedWriteModes.includes(writeMode)) {
          throw new AppError("PostgreSQL \u76EE\u6807\u4EC5\u652F\u6301\u8FFD\u52A0\u5199\u3001\u4E3B\u952E\u66F4\u65B0\u548C\u8986\u76D6\u5199", 400);
        }
        const keyFields = Array.isArray(targetConfig.keyFields) ? targetConfig.keyFields.map((field) => String(field || "").trim()).filter(Boolean) : [];
        if (writeMode === "upsert" && keyFields.length === 0) {
          throw new AppError("PostgreSQL \u4E3B\u952E\u66F4\u65B0\u6A21\u5F0F\u5FC5\u987B\u914D\u7F6E keyFields", 400);
        }
        return {
          ...targetConfig,
          writeMode,
          ...writeMode === "upsert" ? { keyFields } : {}
        };
      }
      if (normalizedTargetType === "hive") {
        const allowedWriteModes = ["append", "overwrite", "partition_overwrite"];
        if (!allowedWriteModes.includes(writeMode)) {
          throw new AppError("Hive \u76EE\u6807\u4EC5\u652F\u6301\u8FFD\u52A0\u5199\u3001\u8986\u76D6\u5199\u548C\u8986\u76D6\u6700\u65B0\u5206\u533A", 400);
        }
        if (writeMode === "partition_overwrite") {
          if (!partitionConfig || !partitionConfig.partitionColumn) {
            throw new AppError("\u5206\u533A\u8986\u76D6\u6A21\u5F0F\u5FC5\u987B\u6307\u5B9A\u5206\u533A\u5B57\u6BB5", 400);
          }
          if ((partitionConfig.mode || "latest") === "custom" && !partitionConfig.partitionValue) {
            throw new AppError("\u81EA\u5B9A\u4E49\u5206\u533A\u8986\u76D6\u5FC5\u987B\u6307\u5B9A\u5206\u533A\u503C", 400);
          }
        }
        return {
          ...targetConfig,
          writeMode,
          ...writeMode === "partition_overwrite" ? {
            partitionConfig: {
              mode: partitionConfig?.mode || "latest",
              partitionColumn: partitionConfig?.partitionColumn,
              ...partitionConfig?.partitionValue ? { partitionValue: partitionConfig.partitionValue } : {}
            }
          } : {}
        };
      }
      return {
        ...targetConfig,
        writeMode
      };
    }
    function normalizeTableNameBySourceType(tableName, sourceType) {
      if (tableName === void 0 || tableName === null) {
        return tableName;
      }
      return tableName;
    }
    async function deleteTask(id) {
      try {
        const existingTask = await repository.getTaskById(id);
        if (!existingTask) {
          throw new AppError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
        }
        await schedulerService.unscheduleTask(id);
        const deleted = await repository.deleteTask(id);
        if (!deleted) {
          throw new AppError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
        }
        return { id };
      } catch (error) {
        if (error.code === "ER_ROW_IS_REFERENCED_2") {
          throw new AppError("\u4EFB\u52A1\u5DF2\u88AB\u5F15\u7528\uFF0C\u65E0\u6CD5\u5220\u9664", 409);
        }
        throw error;
      }
    }
    async function startTask(id) {
      const task = await repository.getTaskById(id);
      if (!task) {
        throw new AppError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
      }
      if (task.status === "running") {
        throw new AppError("\u6D60\u8BF2\u59DF\u5BB8\u832C\u7CA1\u9366\u3128\u7E4D\u741B\u5C7C\u8151", 400);
      }
      if (!task.scheduleConfig || !task.scheduleConfig.scheduleType || task.scheduleConfig.scheduleType === "manual") {
        throw new AppError("\u4EFB\u52A1\u6CA1\u6709\u914D\u7F6E\u6709\u6548\u7684\u8C03\u5EA6\u8BA1\u5212", 400);
      }
      await repository.updateTaskStatus(id, "active");
      await repository.updateTask(id, { scheduleEnabled: true });
      const updatedTask = await repository.getTaskById(id);
      await schedulerService.scheduleTask(updatedTask);
      return updatedTask;
    }
    async function stopTask(id) {
      const task = await repository.getTaskById(id);
      if (!task) {
        throw new AppError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
      }
      await schedulerService.unscheduleTask(id);
      await repository.updateTask(id, { scheduleEnabled: false });
      await repository.updateTaskStatus(id, "paused");
      await schedulerService.stopTaskRun(id);
      return repository.getTaskById(id);
    }
    async function runTaskNow(id) {
      const task = await repository.getTaskById(id);
      if (!task) {
        throw new AppError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
      }
      if (task.status === "running") {
        throw new AppError("\u4EFB\u52A1\u6B63\u5728\u8FD0\u884C\u4E2D", 400);
      }
      try {
        return await schedulerService.runTaskNow(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(`\u7ACB\u5373\u6267\u884C\u5931\u8D25: ${error.message}`, 500);
      }
    }
    async function getTaskDetail(id) {
      const task = await repository.getTaskById(id);
      if (!task) {
        throw new AppError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
      }
      return task;
    }
    async function getJobRuns(taskId, limit) {
      const task = await repository.getTaskById(taskId);
      if (!task) {
        throw new AppError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
      }
      await repository.reconcileTerminalRunningJobRuns(taskId);
      await repository.reconcileHistoricalRunningJobRuns(taskId);
      const normalizedLimit = limit === null || limit === void 0 ? null : limit;
      return repository.getJobRuns(taskId, normalizedLimit);
    }
    async function analyzeJobRunFailure(taskId, runId, payload = {}) {
      const task = await repository.getTaskById(taskId);
      if (!task) {
        throw new AppError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404);
      }
      const run = await repository.getJobRunById(taskId, runId);
      if (!run) {
        throw new AppError("\u8FD0\u884C\u8BB0\u5F55\u4E0D\u5B58\u5728", 404);
      }
      if (run.runStatus !== "failed") {
        throw new AppError("\u4EC5\u652F\u6301\u5206\u6790\u5931\u8D25\u72B6\u6001\u7684\u8FD0\u884C\u65E5\u5FD7", 400);
      }
      const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("log_analysis");
      const provider = payload.modelProviderId ? await modelProviderService.getModelProviderById(payload.modelProviderId) : await resolveDefaultAnalysisProvider(aiConfig);
      const cacheKey = buildFailureAnalysisCacheKey(task, run, provider, payload.note);
      const cached = failureAnalysisCache.get(cacheKey);
      if (cached) {
        return cached;
      }
      const messages = ensureJsonObjectPrompt(buildFailureAnalysisPrompt(task, run, payload.note, aiConfig?.systemPrompt), provider);
      const completion = await modelProviderService.generateChatCompletion(provider, messages, {
        temperature: aiConfig?.temperature ?? 0.1,
        maxTokens: Number(aiConfig?.maxTokens || 512),
        timeoutMs: Number(aiConfig?.timeoutMs || 45e3),
        responseFormat: { type: "json_object" }
      });
      const analysis = parseAnalysisResult(completion.content);
      const result = {
        runId: run.id,
        taskId,
        modelProviderId: provider.id,
        modelProviderName: provider.configName,
        modelName: provider.modelName,
        analysis,
        rawText: completion.content
      };
      failureAnalysisCache.set(cacheKey, result);
      trimFailureAnalysisCache();
      return result;
    }
    async function reconcileRunningJobsAfterRestart() {
      return repository.reconcileLatestRunningJobRunsAfterRestart();
    }
    async function resolveDefaultAnalysisProvider(aiConfig = null) {
      if (aiConfig?.defaultModelProviderId) {
        const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
        return modelProviderService.applyModelSelection(provider, {
          modelName: aiConfig.defaultModelName,
          modelVersion: aiConfig.defaultModelVersion
        });
      }
      const providers = await modelProviderService.getActiveChatModelProviders();
      if (!providers.length) {
        throw new AppError("\u672A\u627E\u5230\u53EF\u7528\u7684\u5BF9\u8BDD\u6A21\u578B\uFF0C\u8BF7\u5148\u5728\u7CFB\u7EDF\u7BA1\u7406\u4E2D\u542F\u7528\u5927\u6A21\u578B\u914D\u7F6E", 400);
      }
      return providers[0];
    }
    function buildFailureAnalysisPrompt(task, run, note = "", systemPromptOverride = "") {
      const executionInfo = run.executionInfo || {};
      const nested = executionInfo.executionInfo || executionInfo.result || {};
      const error = executionInfo.error || {};
      const stdout = normalizeLogContent(executionInfo.stdout || nested.stdout || error.stdout || "");
      const stderr = normalizeLogContent(executionInfo.stderr || nested.stderr || error.stderr || "");
      const primaryLog = selectPrimaryFailureLog(run.errorMessage, stderr, stdout);
      const secondaryLog = primaryLog === stderr ? stdout : stderr;
      return [
        {
          role: "system",
          content: systemPromptOverride || "\u4F60\u662F\u8D44\u6DF1\u6570\u636E\u96C6\u6210\u6545\u969C\u5206\u6790\u4E13\u5BB6\u3002\u8BF7\u4F18\u5148\u4F9D\u636E\u9519\u8BEF\u6458\u8981\u3001\u5173\u952E\u65E5\u5FD7\u7247\u6BB5\u548C\u6267\u884C\u6307\u6807\uFF0C\u5224\u65AD\u6700\u53EF\u80FD\u7684\u5931\u8D25\u539F\u56E0\uFF0C\u5E76\u7ED9\u51FA\u53EF\u6267\u884C\u6392\u67E5\u5EFA\u8BAE\u3002\u8F93\u51FA\u5FC5\u987B\u662F JSON\uFF0C\u5BF9\u8C61\u7ED3\u6784\u56FA\u5B9A\u4E3A causeSummary\u3001rootCause\u3001evidence\u3001suggestions\u3001confidence\u3001severity\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002"
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: {
                id: task.id,
                taskName: task.taskName,
                taskCode: task.taskCode,
                sourceName: task.sourceName,
                sourceTable: task.sourceTable,
                targetSourceName: task.targetSourceName,
                targetTable: task.targetTable,
                syncMode: task.syncMode
              },
              run: {
                id: run.id,
                runStatus: run.runStatus,
                startTime: run.startTime,
                endTime: run.endTime,
                recordsCount: run.recordsCount,
                errorMessage: run.errorMessage || "",
                metrics: extractExecutionMetrics(executionInfo, nested),
                progress: extractExecutionProgress(executionInfo, nested),
                error: summarizeErrorObject(error)
              },
              logs: {
                primary: primaryLog,
                secondary: secondaryLog
              },
              extraNote: note || "",
              outputFormat: {
                causeSummary: "\u4E00\u53E5\u8BDD\u6982\u62EC\u5931\u8D25\u539F\u56E0",
                rootCause: "\u8BE6\u7EC6\u6839\u56E0\u8BF4\u660E",
                evidence: ["\u4ECE\u65E5\u5FD7\u63D0\u53D6\u7684\u5173\u952E\u8BC1\u636E"],
                suggestions: ["\u5EFA\u8BAE\u7684\u6392\u67E5\u6216\u4FEE\u590D\u52A8\u4F5C"],
                confidence: "high | medium | low",
                severity: "critical | high | medium | low"
              }
            },
            null,
            2
          )
        }
      ];
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
    function normalizeLogContent(value) {
      const text = String(value || "").trim();
      if (!text) {
        return "";
      }
      const normalized = text.replace(/\r\n/g, "\n");
      return normalized.length > 4e3 ? normalized.slice(-4e3) : normalized;
    }
    function extractExecutionMetrics(executionInfo, nested) {
      const metrics = executionInfo.metrics || nested.metrics || {};
      return {
        totalRecords: metrics.totalRecords ?? null,
        successRecords: metrics.successRecords ?? null,
        errorRecords: metrics.errorRecords ?? null,
        speed: metrics.recordSpeed || metrics.speed || null
      };
    }
    function extractExecutionProgress(executionInfo, nested) {
      return {
        phase: executionInfo.phase || nested.phase || null,
        progressAt: executionInfo.progressAt || nested.progressAt || null,
        lastRunAt: executionInfo.lastRunAt || nested.lastRunAt || null
      };
    }
    function summarizeErrorObject(error) {
      if (!error || typeof error !== "object") {
        return {};
      }
      return {
        message: error.message || "",
        code: error.code || "",
        type: error.type || "",
        stack: summarizeStack(error.stack)
      };
    }
    function summarizeStack(value) {
      const text = String(value || "").trim();
      if (!text) {
        return "";
      }
      const lines = text.split(/\r?\n/).slice(0, 8);
      return lines.join("\n");
    }
    function selectPrimaryFailureLog(errorMessage, stderr, stdout) {
      if (stderr) {
        return stderr;
      }
      if (errorMessage) {
        return String(errorMessage);
      }
      return stdout;
    }
    function buildFailureAnalysisCacheKey(task, run, provider, note = "") {
      const fingerprint = [
        task.id,
        run.id,
        provider.id,
        run.runStatus,
        run.endTime || "",
        run.errorMessage || "",
        JSON.stringify(run.executionInfo || {}),
        note || ""
      ].join("|");
      return fingerprint;
    }
    function trimFailureAnalysisCache() {
      const maxEntries = 100;
      if (failureAnalysisCache.size <= maxEntries) {
        return;
      }
      const overflow = failureAnalysisCache.size - maxEntries;
      const keys = failureAnalysisCache.keys();
      for (let index = 0; index < overflow; index += 1) {
        const next = keys.next();
        if (next.done) {
          break;
        }
        failureAnalysisCache.delete(next.value);
      }
    }
    function parseAnalysisResult(content) {
      const normalized = String(content || "").trim();
      if (!normalized) {
        throw new AppError("\u6A21\u578B\u672A\u8FD4\u56DE\u5206\u6790\u7ED3\u679C", 400);
      }
      try {
        const parsed = JSON.parse(extractJsonObject(normalized));
        return {
          causeSummary: parsed.causeSummary || "\u672A\u8BC6\u522B",
          rootCause: parsed.rootCause || "",
          evidence: Array.isArray(parsed.evidence) ? parsed.evidence.map(String).filter(Boolean) : [],
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String).filter(Boolean) : [],
          confidence: normalizeEnum(parsed.confidence, ["high", "medium", "low"], "medium"),
          severity: normalizeEnum(parsed.severity, ["critical", "high", "medium", "low"], "medium")
        };
      } catch (_error) {
        return {
          causeSummary: normalized.slice(0, 120),
          rootCause: normalized,
          evidence: [],
          suggestions: [],
          confidence: "low",
          severity: "medium"
        };
      }
    }
    function extractJsonObject(content) {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start === -1 || end === -1 || end < start) {
        throw new Error("invalid json");
      }
      return content.slice(start, end + 1);
    }
    function normalizeEnum(value, allowedValues, fallback) {
      const normalized = String(value || "").toLowerCase();
      return allowedValues.includes(normalized) ? normalized : fallback;
    }
    function resolveTargetColumnType(mapping, sourceColumn, targetType = "mysql", connectionConfig = {}) {
      const mappingDataType = String(mapping.dataType || "").trim();
      const normalizedTargetType = resolveDatasourceDialect(targetType, connectionConfig);
      const sourceColumnType = String(sourceColumn?.columnType || "").trim();
      if (sourceColumn?.columnType) {
        const sourceDataType = String(sourceColumn.dataType || "").trim().toLowerCase();
        const mappingBaseType = mappingDataType.toLowerCase();
        if (!mappingDataType) {
          return sourceColumnType;
        }
        if (mappingDataType.includes("(") || mappingDataType.includes(" ")) {
          return normalizeColumnTypeForTarget(mappingDataType, normalizedTargetType);
        }
        if (mappingBaseType === sourceDataType) {
          return normalizeColumnTypeForTarget(sourceColumnType, normalizedTargetType);
        }
      }
      return normalizeColumnTypeForTarget(
        mappingDataType || sourceColumn?.columnType || sourceColumn?.dataType || "varchar(255)",
        normalizedTargetType
      );
    }
    function buildTargetColumnsFromMappings(sourceColumns, fieldMappings, targetType = "mysql", connectionConfig = {}) {
      const normalizedTargetType = resolveDatasourceDialect(targetType, connectionConfig);
      return fieldMappings.map((mapping) => {
        const sourceColumn = sourceColumns.find((column) => column.columnName === mapping.sourceField);
        const columnType = resolveTargetColumnType(mapping, sourceColumn, targetType, connectionConfig);
        const hasExplicitDefault = Object.prototype.hasOwnProperty.call(mapping, "defaultValue") && mapping.defaultValue !== void 0;
        return {
          columnName: mapping.targetField,
          columnType,
          dataType: columnType,
          isNullable: !mapping.isPrimaryKey,
          isPrimaryKey: Boolean(mapping.isPrimaryKey),
          columnDefault: hasExplicitDefault ? mapping.defaultValue : sourceColumn?.columnDefault ?? null,
          extra: normalizedTargetType === "postgresql" ? "" : sourceColumn?.extra || "",
          columnComment: sourceColumn?.columnComment || ""
        };
      });
    }
    function normalizeColumnTypeForTarget(columnType, targetType) {
      const { baseType, args } = parseColumnTypeDefinitionForMapping(columnType);
      const isUnsigned = /\bunsigned\b/.test(baseType);
      const normalizedBaseType = baseType.replace(/\bunsigned\b/g, "").replace(/\s+/g, " ").trim();
      const normalizedTargetType = String(targetType || "").toLowerCase() === "postgres" ? "postgresql" : String(targetType || "").toLowerCase();
      if (normalizedTargetType === "mysql") {
        if (["varchar2", "nvarchar2", "varchar", "char", "nchar"].includes(normalizedBaseType)) {
          return `${normalizedBaseType === "varchar2" || normalizedBaseType === "nvarchar2" ? "varchar" : normalizedBaseType}(${Number(args[0] || 255)})`;
        }
        if (["number", "numeric", "decimal"].includes(normalizedBaseType)) {
          if (args.length >= 2) {
            return `decimal(${Number(args[0] || 18)},${Number(args[1] || 2)})`;
          }
          const precision = Number(args[0] || 0);
          if (precision > 0 && precision <= 10) {
            return "int";
          }
          if (precision > 10) {
            return "bigint";
          }
          return "decimal(18,2)";
        }
        if (["tinyint", "smallint", "mediumint", "int", "integer", "bigint"].includes(normalizedBaseType)) {
          const mysqlType = normalizedBaseType === "integer" ? "int" : normalizedBaseType;
          return `${mysqlType}${isUnsigned ? " unsigned" : ""}`;
        }
        if (["float", "double", "double precision", "real"].includes(normalizedBaseType)) {
          const mysqlType = normalizedBaseType === "double precision" ? "double" : normalizedBaseType;
          return `${mysqlType}${args.length ? `(${args.join(",")})` : ""}${isUnsigned ? " unsigned" : ""}`;
        }
        if (["boolean", "bool"].includes(normalizedBaseType)) {
          return "tinyint(1)";
        }
        if (["bit", "binary", "varbinary"].includes(normalizedBaseType)) {
          return `${normalizedBaseType}${args.length ? `(${args.join(",")})` : ""}`;
        }
        if (["blob", "longblob", "mediumblob", "tinyblob", "json", "time", "year"].includes(normalizedBaseType)) {
          return normalizedBaseType;
        }
        if (["enum", "set"].includes(normalizedBaseType) && args.length) {
          return `${normalizedBaseType}(${args.join(",")})`;
        }
        if (["timestamp", "datetime", "date", "datetime2", "datetimeoffset", "smalldatetime"].includes(normalizedBaseType)) {
          return normalizedBaseType === "date" ? "date" : "datetime";
        }
        if (["clob", "text", "longtext", "mediumtext", "tinytext"].includes(normalizedBaseType)) {
          return "text";
        }
      }
      if (normalizedTargetType === "postgresql") {
        if (["character varying", "varchar"].includes(normalizedBaseType)) {
          return `varchar(${Number(args[0] || 255)})`;
        }
        if (["character", "char"].includes(normalizedBaseType)) {
          return `char(${Number(args[0] || 1)})`;
        }
        if (["timestamp without time zone", "timestamp with time zone", "timestamptz"].includes(normalizedBaseType)) {
          return normalizedBaseType === "timestamptz" ? "timestamp with time zone" : normalizedBaseType;
        }
        if (["time without time zone", "time with time zone"].includes(normalizedBaseType)) {
          return normalizedBaseType;
        }
        if (["json", "jsonb"].includes(normalizedBaseType)) {
          return normalizedBaseType;
        }
        if (["varchar2", "nvarchar2", "varchar", "char", "nchar"].includes(normalizedBaseType)) {
          return `${normalizedBaseType === "char" || normalizedBaseType === "nchar" ? "char" : "varchar"}(${Number(args[0] || 255)})`;
        }
        if (["number", "numeric", "decimal"].includes(normalizedBaseType)) {
          if (args.length >= 2) {
            return `numeric(${Number(args[0] || 18)},${Number(args[1] || 2)})`;
          }
          const precision = Number(args[0] || 0);
          if (precision > 0 && precision <= 10) {
            return "integer";
          }
          if (precision > 10) {
            return "bigint";
          }
          return "numeric(18,2)";
        }
        if (["tinyint"].includes(normalizedBaseType)) {
          return isUnsigned ? "smallint" : "smallint";
        }
        if (["smallint"].includes(normalizedBaseType)) {
          return isUnsigned ? "integer" : "smallint";
        }
        if (["mediumint", "int", "integer"].includes(normalizedBaseType)) {
          return isUnsigned ? "bigint" : "integer";
        }
        if (["bigint"].includes(normalizedBaseType)) {
          return isUnsigned ? "numeric(20,0)" : "bigint";
        }
        if (["float"].includes(normalizedBaseType)) {
          return "real";
        }
        if (["double", "double precision"].includes(normalizedBaseType)) {
          return "double precision";
        }
        if (["bit", "boolean", "bool"].includes(normalizedBaseType)) {
          return normalizedBaseType === "bit" && Number(args[0] || 0) > 1 ? `bit(${Number(args[0])})` : "boolean";
        }
        if (["blob", "longblob", "mediumblob", "tinyblob", "binary", "varbinary"].includes(normalizedBaseType)) {
          return "bytea";
        }
        if (["json"].includes(normalizedBaseType)) {
          return "text";
        }
        if (["timestamp", "datetime", "date", "datetime2", "datetimeoffset", "smalldatetime"].includes(normalizedBaseType)) {
          return normalizedBaseType === "date" ? "date" : "timestamp";
        }
        if (["time"].includes(normalizedBaseType)) {
          return "time";
        }
        if (["year"].includes(normalizedBaseType)) {
          return "integer";
        }
        if (["clob", "text", "longtext", "mediumtext", "tinytext"].includes(normalizedBaseType)) {
          return "text";
        }
      }
      if (normalizedTargetType === "postgresql" && isUnsigned) {
        if (normalizedBaseType === "decimal") {
          return args.length >= 2 ? `numeric(${Number(args[0] || 18)},${Number(args[1] || 2)})` : "numeric(18,2)";
        }
        if (normalizedBaseType === "numeric") {
          return args.length >= 2 ? `numeric(${Number(args[0] || 18)},${Number(args[1] || 2)})` : "numeric(18,2)";
        }
      }
      return getTargetTextType(normalizedTargetType);
    }
    function parseColumnTypeDefinitionForMapping(columnType) {
      const normalized = String(columnType || "").trim().toLowerCase();
      const match = normalized.match(/^([a-z0-9_ ]+?)(?:\(([^)]+)\))?$/);
      return {
        baseType: match ? match[1].trim() : normalized,
        args: match?.[2] ? match[2].split(",").map((item) => item.trim()) : []
      };
    }
    function getTargetTextType(targetType = "mysql") {
      const normalizedTargetType = String(targetType || "").toLowerCase();
      if (normalizedTargetType === "hive") {
        return "string";
      }
      return "text";
    }
    function normalizeTargetTableMode(value, existingValue) {
      return value === "create" || value === void 0 && existingValue === "create" ? "create" : "existing";
    }
    function resolveSourceTableComment(tables = [], tableName = "") {
      const normalized = String(tableName || "").trim().replace(/["`]/g, "");
      if (!normalized) {
        return "";
      }
      const candidates = [normalized];
      const simple = normalized.split(".").filter(Boolean).pop();
      if (simple && simple !== normalized) {
        candidates.push(simple);
      }
      const matched = (Array.isArray(tables) ? tables : []).find((item) => {
        const current = String(item?.tableName || "").trim().replace(/["`]/g, "");
        return candidates.includes(current);
      });
      return String(matched?.tableComment || "").trim();
    }
    module2.exports = {
      listTasks,
      getMonitorOverview,
      createTask,
      updateTask,
      previewTaskUpdate,
      previewSourceData,
      deleteTask,
      startTask,
      stopTask,
      runTaskNow,
      getTaskDetail,
      getJobRuns,
      analyzeJobRunFailure,
      reconcileRunningJobsAfterRestart,
      buildTargetColumnsFromMappings,
      normalizeTargetTableMode
    };
  }
});

// backend/src/modules/ingestion-tasks/ingestion-task.recommendation.service.js
var require_ingestion_task_recommendation_service = __commonJS({
  "backend/src/modules/ingestion-tasks/ingestion-task.recommendation.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var dataSourceRepository = require_data_source_repository();
    var dataSourcePreview = require_data_source_preview();
    var ingestionAiConfigService = require_ingestion_ai_config_service();
    var modelProviderService = require_model_provider_service();
    var DEFAULT_TASK_CONFIG_SYSTEM_PROMPT = `
\u4F60\u662F\u8D44\u6DF1\u6570\u636E\u96C6\u6210\u67B6\u6784\u5E08\uFF0C\u8D1F\u8D23\u4E3A\u201C\u521B\u5EFA\u63A5\u5165\u4EFB\u52A1\u201D\u751F\u6210\u53EF\u76F4\u63A5\u843D\u5730\u7684\u63A8\u8350\u914D\u7F6E\u3002

[\u8F93\u5165\u524D\u63D0]
1. \u7528\u6237\u4F1A\u5148\u9009\u62E9\uFF1A\u6765\u6E90\u6570\u636E\u6E90\u3001\u6765\u6E90\u8868\u3001\u76EE\u6807\u6570\u636E\u6E90\u3002
2. \u5F53\u524D\u573A\u666F\u9ED8\u8BA4\u63A8\u8350\uFF1AtargetTableMode = create\uFF0C\u4E5F\u5C31\u662F\u201C\u81EA\u52A8\u521B\u5EFA\u76EE\u6807\u8868\u201D\u3002
3. ownerName \u76F4\u63A5\u4F7F\u7528\u5F53\u524D\u7CFB\u7EDF\u767B\u5F55\u7528\u6237\uFF0C\u4E0D\u8981\u865A\u6784\u5176\u4ED6\u8D1F\u8D23\u4EBA\u3002
4. \u4F60\u5FC5\u987B\u7EFC\u5408\u6765\u6E90\u5BF9\u8C61\u7ED3\u6784\u3001\u7D22\u5F15\u3001\u7EA6\u675F\u3001\u6837\u4F8B\u6570\u636E\u3001\u5F53\u524D\u8868\u5355\u4E0A\u4E0B\u6587\u548C\u76EE\u6807\u6570\u636E\u6E90\u4FE1\u606F\u7ED9\u51FA\u5EFA\u8BAE\u3002
5. \u6765\u6E90\u5BF9\u8C61\u53EF\u80FD\u662F\u6570\u636E\u5E93\u8868\u3001Kafka Topic \u6216 FTP \u6587\u4EF6/\u76EE\u5F55\u3002Kafka/FTP \u573A\u666F\u8981\u57FA\u4E8E\u6837\u4F8B\u6D88\u606F\u6216\u6837\u4F8B\u6587\u4EF6\u63A8\u65AD\u5B57\u6BB5\u3002

[\u5B57\u6BB5\u586B\u5199\u8981\u6C42]
1. taskName\uFF08\u4EFB\u52A1\u540D\u79F0\uFF09
\u8981\u6C42\uFF1A\u540D\u79F0\u6E05\u6670\u3001\u4E1A\u52A1\u5316\uFF0C\u80FD\u4F53\u73B0\u540C\u6B65\u5BF9\u8C61\u548C\u52A8\u4F5C\uFF0C\u9002\u5408\u76F4\u63A5\u5C55\u793A\u7ED9\u4E1A\u52A1\u6216\u8FD0\u7EF4\u4EBA\u5458\u3002

2. taskCode\uFF08\u4EFB\u52A1\u7F16\u7801\uFF09
\u8981\u6C42\uFF1A\u5FC5\u987B\u751F\u6210\u3002
\u683C\u5F0F\uFF1A\u4EC5\u5141\u8BB8\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u3002
\u89C4\u5219\uFF1A\u7981\u6B62\u7A7A\u683C\u3001\u4E2D\u6587\u3001\u77ED\u6A2A\u7EBF\u548C\u5176\u4ED6\u7279\u6B8A\u5B57\u7B26\u3002
\u5EFA\u8BAE\uFF1A\u4F18\u5148\u4F53\u73B0\u6765\u6E90\u7CFB\u7EDF\u3001\u6765\u6E90\u8868\u6216\u4E1A\u52A1\u4E3B\u9898\uFF0C\u957F\u5EA6\u63A7\u5236\u5728 64 \u4E2A\u5B57\u7B26\u4EE5\u5185\u3002

3. ownerName\uFF08\u8D1F\u8D23\u4EBA\uFF09
\u8981\u6C42\uFF1A\u56FA\u5B9A\u586B\u5199\u5F53\u524D\u7CFB\u7EDF\u767B\u5F55\u7528\u6237\uFF0C\u4E0D\u8981\u6539\u5199\u6210\u5176\u4ED6\u4EBA\u540D\uFF0C\u4E0D\u8981\u7559\u7A7A\u3002

4. description\uFF08\u4EFB\u52A1\u8BF4\u660E\uFF09
\u8981\u6C42\uFF1A\u7528 1 \u5230 3 \u53E5\u6982\u62EC\u4EFB\u52A1\u76EE\u7684\u3001\u6765\u6E90\u5BF9\u8C61\u3001\u76EE\u6807\u7528\u9014\u548C\u5173\u952E\u540C\u6B65\u7B56\u7565\uFF0C\u4FBF\u4E8E\u540E\u7EED\u7EF4\u62A4\u3002

5. syncMode\uFF08\u540C\u6B65\u6A21\u5F0F\uFF09
\u53EF\u9009\u503C\uFF1Afull | incremental | cdc
\u8981\u6C42\uFF1A\u6839\u636E\u6765\u6E90\u8868\u7279\u5F81\u9009\u62E9\u6700\u5408\u7406\u6A21\u5F0F\u3002
\u89C4\u5219\uFF1A\u5982\u679C\u5B58\u5728\u7A33\u5B9A\u66F4\u65B0\u65F6\u95F4\u3001\u65F6\u95F4\u6233\u6216\u9012\u589E\u4E3B\u952E\uFF0C\u4F18\u5148\u63A8\u8350 incremental\uFF1B\u53EA\u6709\u660E\u786E\u9002\u5408\u53D8\u66F4\u6355\u83B7\u65F6\u624D\u63A8\u8350 cdc\uFF1B\u5426\u5219\u63A8\u8350 full\u3002
Kafka \u6765\u6E90\u56FA\u5B9A\u63A8\u8350 full\uFF0C\u542B\u4E49\u4E3A\u6279\u91CF\u6D88\u8D39 Topic \u6D88\u606F\uFF1BFTP \u6765\u6E90\u53EA\u80FD\u63A8\u8350 full \u6216 incremental\uFF0Cfull \u8868\u793A\u6BCF\u6B21\u8BFB\u53D6\u5339\u914D\u6587\u4EF6\uFF0Cincremental \u8868\u793A\u53EA\u8BFB\u53D6\u65B0\u589E\u6216\u53D8\u5316\u6587\u4EF6\u3002

6. targetTableMode\uFF08\u76EE\u6807\u8868\u6A21\u5F0F\uFF09
\u8981\u6C42\uFF1A\u56FA\u5B9A\u8FD4\u56DE create\u3002

7. targetTable\uFF08\u76EE\u6807\u8868\u540D\uFF09
\u8981\u6C42\uFF1A\u5FC5\u987B\u751F\u6210\u76EE\u6807\u8868\u540D\u3002
\u683C\u5F0F\uFF1A\u4EC5\u5141\u8BB8\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u3002
\u5EFA\u8BAE\uFF1A\u540D\u79F0\u4F53\u73B0\u4E1A\u52A1\u8BED\u4E49\uFF0C\u53EF\u5E26 ods\u3001dwd\u3001ads \u7B49\u5206\u5C42\u524D\u7F00\u3002

8. writeMode\uFF08\u5199\u5165\u6A21\u5F0F\uFF09
\u53EF\u9009\u503C\uFF1Aappend | replace | overwrite | partition_overwrite
\u8981\u6C42\uFF1A\u7ED3\u5408\u540C\u6B65\u6A21\u5F0F\u548C\u76EE\u6807\u8868\u7528\u9014\u63A8\u8350\u6700\u5408\u9002\u7B56\u7565\uFF0C\u5E76\u4FDD\u6301\u53EF\u6267\u884C\u3002

9. partitionMode / partitionColumn / partitionValue\uFF08\u5206\u533A\u5199\u5165\u914D\u7F6E\uFF09
\u8981\u6C42\uFF1A\u53EA\u6709\u5728\u786E\u5B9E\u9002\u5408\u5206\u533A\u5199\u5165\u65F6\u624D\u586B\u5199\uFF1B\u5426\u5219\u8FD4\u56DE null\u3002

10. incrementalConfig.mode\uFF08\u589E\u91CF\u6A21\u5F0F\uFF09
\u53EF\u9009\u503C\uFF1Atimestamp | id | cdc | null
\u8981\u6C42\uFF1A\u4EC5\u5F53 syncMode \u4E3A incremental \u6216 cdc \u65F6\u586B\u5199\u5408\u7406\u503C\uFF1B\u5426\u5219\u8FD4\u56DE null\u3002

11. incrementalConfig.cursorColumn\uFF08\u589E\u91CF\u6E38\u6807\u5B57\u6BB5\uFF09
\u8981\u6C42\uFF1A\u82E5\u4F7F\u7528 incremental\uFF0C\u5FC5\u987B\u9009\u62E9\u6765\u6E90\u8868\u4E2D\u771F\u5B9E\u5B58\u5728\u4E14\u7A33\u5B9A\u53EF\u7528\u7684\u5B57\u6BB5\u3002

12. incrementalConfig.startValue\uFF08\u589E\u91CF\u8D77\u59CB\u503C\uFF09
\u8981\u6C42\uFF1A\u7ED9\u51FA\u5408\u7406\u8D77\u59CB\u503C\u3002
\u89C4\u5219\uFF1Atimestamp \u7C7B\u578B\u53EF\u7ED9\u51FA\u6807\u51C6\u65F6\u95F4\u5B57\u7B26\u4E32\uFF1Bid \u7C7B\u578B\u53EF\u7ED9\u51FA 0 \u6216\u5176\u4ED6\u5408\u7406\u8D77\u70B9\uFF1B\u4E0D\u7528\u65F6\u8FD4\u56DE null\u3002

13. cdcColumns\uFF08CDC\u76D1\u542C\u5B57\u6BB5\uFF09
\u8981\u6C42\uFF1A\u4EC5\u5F53 syncMode = cdc \u65F6\u8FD4\u56DE\u5EFA\u8BAE\u76D1\u542C\u5B57\u6BB5\u6570\u7EC4\uFF1B\u5426\u5219\u8FD4\u56DE\u7A7A\u6570\u7EC4\u3002

14. fieldMappings\uFF08\u5B57\u6BB5\u6620\u5C04\uFF09
\u8981\u6C42\uFF1A\u5FC5\u987B\u5C3D\u91CF\u5B8C\u6574\u3002
\u89C4\u5219\uFF1AsourceField \u5FC5\u987B\u6765\u81EA\u6765\u6E90\u8868\u771F\u5B9E\u5B57\u6BB5\uFF1BtargetField \u5FC5\u987B\u53EF\u4F5C\u4E3A\u65B0\u5EFA\u76EE\u6807\u8868\u5B57\u6BB5\u540D\uFF1B
enabled \u8868\u793A\u8BE5\u5B57\u6BB5\u662F\u5426\u53C2\u4E0E\u540C\u6B65\uFF1BdataType \u5C3D\u91CF\u7ED9\u51FA\u51C6\u786E\u7C7B\u578B\uFF1BisPrimaryKey \u6839\u636E\u6765\u6E90\u4E3B\u952E\u5224\u65AD\uFF1BdefaultValue \u65E0\u660E\u786E\u9700\u8981\u65F6\u8FD4\u56DE null\u3002

15. transformRules\uFF08\u8F6C\u6362\u89C4\u5219\uFF09
\u8981\u6C42\uFF1A\u4EC5\u5728\u786E\u6709\u5FC5\u8981\u65F6\u751F\u6210\u8F6C\u6362\u89C4\u5219\uFF1B\u65E0\u5FC5\u8981\u65F6\u8FD4\u56DE\u7A7A\u6570\u7EC4\uFF0C\u4E0D\u8981\u4E3A\u4E86\u51D1\u6570\u5F3A\u884C\u751F\u6210\u3002

16. scheduleConfig\uFF08\u8C03\u5EA6\u914D\u7F6E\uFF09
\u8981\u6C42\uFF1A\u9ED8\u8BA4\u63A8\u8350 manual\uFF0C\u9664\u975E\u573A\u666F\u660E\u786E\u9700\u8981\u81EA\u52A8\u8C03\u5EA6\u3002

17. reasoning\uFF08\u63A8\u8350\u4F9D\u636E\uFF09
\u8981\u6C42\uFF1A\u8FD4\u56DE\u6570\u7EC4\uFF0C\u7B80\u8981\u8BF4\u660E\u6BCF\u9879\u5173\u952E\u63A8\u8350\u4F9D\u636E\uFF0C\u4FBF\u4E8E\u4EBA\u5DE5\u5BA1\u6838\u3002

[\u8F93\u51FA\u7EAA\u5F8B]
1. \u8F93\u51FA\u5FC5\u987B\u662F JSON\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\uFF0C\u4E0D\u8981\u8F93\u51FA\u89E3\u91CA\u6027\u524D\u7F00\u3002
2. \u6240\u6709\u5B57\u6BB5\u5FC5\u987B\u4E25\u683C\u6309\u65E2\u5B9A\u7ED3\u6784\u8FD4\u56DE\u3002
3. \u4E0D\u8981\u7F16\u9020\u6765\u6E90\u8868\u4E2D\u4E0D\u5B58\u5728\u7684\u5B57\u6BB5\u540D\u3002
4. \u5982\u679C\u67D0\u9879\u65E0\u6CD5\u786E\u5B9A\uFF0C\u4F18\u5148\u8FD4\u56DE\u4FDD\u5B88\u4E14\u53EF\u6267\u884C\u7684\u9ED8\u8BA4\u503C\u3002
`.trim();
    async function recommendTaskConfig(payload) {
      const source = await dataSourceRepository.getDataSourceById(payload.sourceId);
      if (!source) {
        throw new AppError("\u6765\u6E90\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      }
      const target = payload.targetSourceId ? await dataSourceRepository.getDataSourceById(payload.targetSourceId) : null;
      const sourceProfile = await dataSourcePreview.inspectObjectProfile(source, payload.sourceTable, { sampleSize: 20 });
      const targetProfile = target && payload.targetTable && payload.targetTableMode === "existing" ? await dataSourcePreview.inspectObjectProfile(target, payload.targetTable, { sampleSize: 20 }) : null;
      const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("task_config_recommendation");
      const provider = await resolveDefaultProvider(aiConfig);
      const completion = await modelProviderService.generateChatCompletion(
        provider,
        ensureJsonObjectPrompt(
          buildTaskRecommendationPrompt(payload, source, sourceProfile, target, targetProfile, resolveTaskRecommendationSystemPrompt(aiConfig?.systemPrompt)),
          provider
        ),
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
        recommendation: await parseRecommendationResult(completion.content, sourceProfile, payload, source, target, provider)
      };
    }
    function resolveTaskRecommendationSystemPrompt(systemPromptOverride = "") {
      const normalized = String(systemPromptOverride || "").trim();
      if (!normalized) {
        return "";
      }
      const questionMarkCount = (normalized.match(/\?/g) || []).length;
      const chineseCount = (normalized.match(/[\u4e00-\u9fff]/g) || []).length;
      const latinCount = (normalized.match(/[A-Za-z]/g) || []).length;
      if (questionMarkCount >= 20 && chineseCount < 20 && latinCount < 80) {
        return "";
      }
      return normalized;
    }
    async function resolveDefaultProvider(aiConfig) {
      if (aiConfig?.defaultModelProviderId) {
        const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
        return modelProviderService.applyModelSelection(provider, {
          modelName: aiConfig.defaultModelName,
          modelVersion: aiConfig.defaultModelVersion
        });
      }
      const providers = await modelProviderService.getActiveChatModelProviders();
      if (!providers.length) {
        throw new AppError("\u672A\u627E\u5230\u53EF\u7528\u7684\u5BF9\u8BDD\u6A21\u578B\uFF0C\u8BF7\u5148\u5728AI\u914D\u7F6E\u7BA1\u7406\u4E2D\u7EF4\u62A4\u4EFB\u52A1\u914D\u7F6E\u573A\u666F\u9ED8\u8BA4\u6A21\u578B", 400);
      }
      return providers[0];
    }
    function buildTaskRecommendationPrompt(payload, source, sourceProfile, target, targetProfile, systemPromptOverride = "") {
      const compactSourceProfile = compactTableProfileForPrompt(sourceProfile);
      const compactTargetProfile = compactTableProfileForPrompt(targetProfile);
      return [
        {
          role: "system",
          content: (systemPromptOverride || DEFAULT_TASK_CONFIG_SYSTEM_PROMPT) + " \u8F93\u51FA\u5FC5\u987B\u662F JSON\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown\u3002\u5B57\u6BB5\u7ED3\u6784\u56FA\u5B9A\u4E3A taskName\u3001taskCode\u3001ownerName\u3001description\u3001syncMode\u3001targetTableMode\u3001targetTable\u3001writeMode\u3001partitionMode\u3001partitionColumn\u3001partitionValue\u3001incrementalConfig\u3001cdcColumns\u3001fieldMappings\u3001transformRules\u3001scheduleConfig\u3001reasoning\u3002"
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              currentForm: payload,
              sourceDataSource: {
                id: source.id,
                sourceName: source.sourceName,
                sourceCode: source.sourceCode,
                sourceType: source.sourceType,
                sourceObjectType: resolveSourceObjectType(source),
                database: source.connectionConfig?.database
              },
              sourceTableProfile: compactSourceProfile,
              targetDataSource: target ? {
                id: target.id,
                sourceName: target.sourceName,
                sourceCode: target.sourceCode,
                sourceType: target.sourceType,
                database: target.connectionConfig?.database
              } : null,
              targetTableProfile: compactTargetProfile,
              outputSchema: {
                taskName: "\u63A8\u8350\u7684\u4EFB\u52A1\u540D\u79F0",
                taskCode: "\u63A8\u8350\u7684\u4EFB\u52A1\u7F16\u7801\uFF0C\u4F7F\u7528\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u4E0B\u5212\u7EBF",
                ownerName: "\u5F53\u524D\u767B\u5F55\u7528\u6237\u8D1F\u8D23\u4EBA",
                description: "\u63A8\u8350\u8BF4\u660E",
                syncMode: "full | incremental | cdc",
                targetTableMode: "create",
                targetTable: "\u63A8\u8350\u76EE\u6807\u8868\u540D",
                writeMode: "append | replace | overwrite | partition_overwrite",
                partitionMode: "latest | custom | null",
                partitionColumn: "\u5206\u533A\u5B57\u6BB5\u6216 null",
                partitionValue: "\u5206\u533A\u503C\u6216 null",
                incrementalConfig: {
                  mode: "timestamp | id | cdc | null",
                  cursorColumn: "\u589E\u91CF\u5B57\u6BB5\u6216 null",
                  startValue: "\u63A8\u8350\u8D77\u59CB\u503C\u6216 null"
                },
                cdcColumns: ["CDC\u5B57\u6BB5\u6570\u7EC4\uFF0C\u53EF\u4E3A\u7A7A"],
                fieldMappings: [
                  {
                    sourceField: "\u6765\u6E90\u5B57\u6BB5",
                    targetField: "\u76EE\u6807\u5B57\u6BB5",
                    enabled: true,
                    dataType: "\u5B57\u6BB5\u7C7B\u578B",
                    isPrimaryKey: false,
                    defaultValue: null
                  }
                ],
                transformRules: [
                  {
                    field: "\u5B57\u6BB5\u540D",
                    transformType: "rename | uppercase | lowercase | trim | date_format | custom",
                    config: {}
                  }
                ],
                scheduleConfig: {
                  scheduleType: "manual | interval | daily | weekly | monthly | null",
                  intervalSeconds: null,
                  runTime: null,
                  weekDays: [],
                  monthDay: null,
                  timezone: "Asia/Shanghai"
                },
                reasoning: ["\u63A8\u8350\u4F9D\u636E\uFF0C\u6570\u7EC4"]
              }
            },
            null,
            2
          )
        }
      ];
    }
    function compactTableProfileForPrompt(profile) {
      if (!profile) {
        return null;
      }
      return {
        tableName: profile.tableName || "",
        tableComment: profile.tableComment || "",
        columns: Array.isArray(profile.columns) ? profile.columns.slice(0, 60).map((item) => ({
          columnName: item.columnName,
          dataType: item.dataType,
          columnType: item.columnType,
          isNullable: item.isNullable,
          isPrimaryKey: item.isPrimaryKey,
          columnComment: item.columnComment || ""
        })) : [],
        indexes: Array.isArray(profile.indexes) ? profile.indexes.slice(0, 20).map((item) => ({
          indexName: item.indexName,
          unique: item.unique,
          indexType: item.indexType,
          columns: Array.isArray(item.columns) ? item.columns.slice(0, 10) : []
        })) : [],
        constraints: Array.isArray(profile.constraints) ? profile.constraints.slice(0, 20).map((item) => ({
          constraintName: item.constraintName,
          constraintType: item.constraintType,
          columns: Array.isArray(item.columns) ? item.columns.slice(0, 10) : [],
          references: Array.isArray(item.references) ? item.references.slice(0, 5) : []
        })) : [],
        sampleRows: Array.isArray(profile.sampleRows) ? profile.sampleRows.slice(0, 5).map(compactSampleRowForPrompt) : []
      };
    }
    function compactSampleRowForPrompt(row) {
      const entries = Object.entries(row || {}).slice(0, 20).map(([key, value]) => [
        key,
        typeof value === "string" ? value.slice(0, 120) : value
      ]);
      return Object.fromEntries(entries);
    }
    async function parseRecommendationResult(content, sourceProfile, payload, source, target, provider) {
      const normalized = String(content || "").trim();
      if (!normalized) {
        throw new AppError("AI\u672A\u8FD4\u56DE\u4EFB\u52A1\u914D\u7F6E\u63A8\u8350\u7ED3\u679C", 400);
      }
      try {
        const parsed = await parseRecommendationPayload(normalized, provider);
        return normalizeRecommendationPayload(parsed, sourceProfile, payload, source, target);
      } catch (error) {
        throw new AppError(`AI\u4EFB\u52A1\u914D\u7F6E\u63A8\u8350\u7ED3\u679C\u89E3\u6790\u5931\u8D25: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
      }
    }
    async function parseRecommendationPayload(content, provider) {
      const direct = tryParseJson(content);
      if (direct) {
        return direct;
      }
      const repaired = await repairRecommendationPayload(provider, content);
      if (repaired) {
        return repaired;
      }
      throw new Error("\u65E0\u6CD5\u5C06\u6A21\u578B\u8F93\u51FA\u89E3\u6790\u4E3A\u5408\u6CD5 JSON");
    }
    function normalizeRecommendationPayload(parsed, sourceProfile, payload, source, target) {
      const sourceColumns = Array.isArray(sourceProfile?.columns) ? sourceProfile.columns : [];
      const sourceColumnMap = new Map(sourceColumns.map((item) => [item.columnName, item]));
      const fieldMappings = Array.isArray(parsed.fieldMappings) ? parsed.fieldMappings : [];
      const taskName = parsed.taskName || "";
      const taskCode = parsed.taskCode || buildFallbackTaskCode(parsed, payload, source, target);
      const normalizedTargetType = String(target?.sourceType || "").toLowerCase();
      const normalizedSourceType = resolveSourceObjectType(source);
      const syncMode = normalizeSyncModeBySource(parsed.syncMode, normalizedSourceType);
      return {
        taskName,
        taskCode,
        ownerName: payload.ownerName || parsed.ownerName || "",
        description: parsed.description || "",
        syncMode,
        targetTableMode: normalizeEnum(parsed.targetTableMode, ["existing", "create"], "create"),
        targetTable: parsed.targetTable || "",
        writeMode: normalizeWriteMode(parsed.writeMode, normalizedTargetType),
        partitionMode: normalizeNullableEnum(parsed.partitionMode, ["latest", "custom"]),
        partitionColumn: parsed.partitionColumn || null,
        partitionValue: parsed.partitionValue || null,
        incrementalConfig: parsed.incrementalConfig ? {
          mode: normalizeNullableEnum(parsed.incrementalConfig.mode, ["timestamp", "id", "cdc"]),
          cursorColumn: parsed.incrementalConfig.cursorColumn || null,
          startValue: parsed.incrementalConfig.startValue ?? null
        } : null,
        cdcColumns: Array.isArray(parsed.cdcColumns) ? parsed.cdcColumns.map(String).filter(Boolean) : [],
        fieldMappings: fieldMappings.map((item) => ({
          sourceField: String(item.sourceField || ""),
          targetField: String(item.targetField || ""),
          enabled: item.enabled !== false,
          dataType: item.dataType || sourceColumnMap.get(String(item.sourceField || ""))?.dataType,
          isPrimaryKey: Boolean(item.isPrimaryKey),
          defaultValue: item.defaultValue ?? void 0
        })).filter((item) => item.sourceField),
        transformRules: Array.isArray(parsed.transformRules) ? parsed.transformRules : [],
        scheduleConfig: parsed.scheduleConfig || null,
        reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.map(String).filter(Boolean) : []
      };
    }
    function resolveSourceObjectType(source) {
      const raw = String(source?.sourceType || source?.connectionConfig?.dialect || "").toLowerCase();
      if (raw.includes("kafka")) return "kafka";
      if (raw.includes("ftp")) return "ftp";
      if (raw.includes("postgres")) return "postgresql";
      if (raw.includes("mysql")) return "mysql";
      return raw || "unknown";
    }
    function normalizeSyncModeBySource(value, sourceType) {
      const normalized = normalizeEnum(value, ["full", "incremental", "cdc"], "full");
      if (sourceType === "kafka") return "full";
      if (sourceType === "ftp") return normalized === "incremental" ? "incremental" : "full";
      return normalized;
    }
    async function repairRecommendationPayload(provider, rawText) {
      try {
        const response = await modelProviderService.generateChatCompletion(
          provider,
          ensureJsonObjectPrompt([
            {
              role: "system",
              content: "\u4F60\u662F JSON \u4FEE\u590D\u52A9\u624B\u3002\u8BF7\u628A\u8F93\u5165\u5185\u5BB9\u6574\u7406\u6210\u4E00\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u53EA\u8F93\u51FA JSON\uFF0C\u4E0D\u8981 Markdown\uFF0C\u4E0D\u8981\u89E3\u91CA\u3002\u5B57\u6BB5\u56FA\u5B9A\u4E3A\uFF1AtaskName\u3001taskCode\u3001ownerName\u3001description\u3001syncMode\u3001targetTableMode\u3001targetTable\u3001writeMode\u3001partitionMode\u3001partitionColumn\u3001partitionValue\u3001incrementalConfig\u3001cdcColumns\u3001fieldMappings\u3001transformRules\u3001scheduleConfig\u3001reasoning\u3002"
            },
            {
              role: "user",
              content: JSON.stringify({ rawText }, null, 2)
            }
          ], provider),
          {
            temperature: 0,
            maxTokens: 1800,
            timeoutMs: 12e4,
            responseFormat: { type: "json_object" }
          }
        );
        return tryParseJson(response.content);
      } catch (_error) {
        return null;
      }
    }
    function buildFallbackTaskCode(parsed, payload, source, target) {
      const candidates = [
        parsed?.taskCode,
        parsed?.taskName,
        payload?.taskCode,
        payload?.taskName,
        payload?.sourceTable,
        source?.sourceCode && target?.sourceCode ? `${source.sourceCode}_${target.sourceCode}_${payload?.sourceTable || "task"}` : null,
        source?.sourceCode && payload?.sourceTable ? `${source.sourceCode}_${payload.sourceTable}` : null,
        "ingestion_task"
      ];
      for (const candidate of candidates) {
        const normalized = String(candidate || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
        if (normalized) {
          return normalized.slice(0, 64);
        }
      }
      return "ingestion_task";
    }
    function extractJsonObject(content) {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start === -1 || end === -1 || end < start) {
        throw new Error("invalid json");
      }
      return content.slice(start, end + 1);
    }
    function tryParseJson(content) {
      const normalized = String(content || "").trim();
      if (!normalized) {
        return null;
      }
      try {
        return JSON.parse(extractJsonObject(normalized));
      } catch (_error) {
        return null;
      }
    }
    function normalizeEnum(value, allowedValues, fallback) {
      const normalized = String(value || "").toLowerCase();
      return allowedValues.includes(normalized) ? normalized : fallback;
    }
    function normalizeNullableEnum(value, allowedValues) {
      if (value === null || value === void 0 || value === "") {
        return null;
      }
      const normalized = String(value).toLowerCase();
      return allowedValues.includes(normalized) ? normalized : null;
    }
    function normalizeWriteMode(value, targetType = "") {
      const normalized = String(value || "").toLowerCase();
      const normalizedTargetType = String(targetType || "").toLowerCase() === "postgres" ? "postgresql" : String(targetType || "").toLowerCase();
      if (normalizedTargetType === "postgresql") {
        return ["append", "overwrite"].includes(normalized) ? normalized : "append";
      }
      if (normalizedTargetType === "hive") {
        return ["append", "overwrite", "partition_overwrite"].includes(normalized) ? normalized : "append";
      }
      if (normalizedTargetType === "mysql") {
        return ["append", "replace", "overwrite"].includes(normalized) ? normalized : "append";
      }
      return ["append", "replace", "overwrite", "partition_overwrite"].includes(normalized) ? normalized : "append";
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
    module2.exports = {
      recommendTaskConfig
    };
  }
});

// backend/src/modules/data-lab/data-lab.pdf-extractor.js
var require_data_lab_pdf_extractor = __commonJS({
  "backend/src/modules/data-lab/data-lab.pdf-extractor.js"(exports2, module2) {
    var pdfParse = require("pdf-parse");
    var MAX_PDF_TEXT_LENGTH = 2e4;
    function cleanText(text, maxLength = MAX_PDF_TEXT_LENGTH) {
      return String(text || "").replace(/\r/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[^\S\n]+/g, " ").trim().slice(0, maxLength);
    }
    function normalizePdfDate(value) {
      const raw = String(value || "").trim();
      if (!raw) return null;
      const matched = raw.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
      if (!matched) {
        return null;
      }
      const [, year, month, day, hour = "00", minute = "00", second = "00"] = matched;
      const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
      const date = new Date(iso);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    async function extractPdfTextFromBuffer(buffer) {
      const parsed = await pdfParse(buffer);
      return {
        text: cleanText(parsed.text),
        pageCount: Number(parsed.numpages || 0),
        info: parsed.info || {},
        metadata: parsed.metadata || null,
        publishedAt: normalizePdfDate(parsed.info?.ModDate || parsed.info?.CreationDate || null)
      };
    }
    module2.exports = {
      extractPdfTextFromBuffer,
      normalizePdfDate
    };
  }
});

// backend/src/modules/ingestion-tasks/ingestion-api-document-parser.service.js
var require_ingestion_api_document_parser_service = __commonJS({
  "backend/src/modules/ingestion-tasks/ingestion-api-document-parser.service.js"(exports2, module2) {
    var path = require("path");
    var mammoth = require("mammoth");
    var XLSX = require("xlsx");
    var AppError = require_app_error();
    var dataSourceRepository = require_data_source_repository();
    var ingestionAiConfigService = require_ingestion_ai_config_service();
    var modelProviderService = require_model_provider_service();
    var apiIngestionService = require_apiIngestionService();
    var { extractPdfTextFromBuffer } = require_data_lab_pdf_extractor();
    var MAX_TEXT_LENGTH = 4e4;
    var ALLOWED_EXTENSIONS = /* @__PURE__ */ new Set([".pdf", ".docx", ".xlsx", ".xls", ".json", ".yaml", ".yml", ".md", ".txt", ".html", ".htm"]);
    var DEFAULT_SYSTEM_PROMPT = [
      "\u4F60\u662F\u6570\u636E\u63A5\u5165\u5E73\u53F0\u7684 API \u63A5\u53E3\u6587\u6863\u89E3\u6790\u52A9\u624B\u3002",
      "\u57FA\u4E8E\u7528\u6237\u6587\u5B57\u548C\u63A5\u53E3\u6587\u6863\u63D0\u53D6\u53EF\u6267\u884C\u7684 API \u63A5\u5165\u914D\u7F6E\uFF1B\u4E0D\u5F97\u7F16\u9020\u53C2\u6570\u3001\u8BA4\u8BC1\u4FE1\u606F\u6216\u54CD\u5E94\u5B57\u6BB5\u3002",
      "\u8BA4\u8BC1\u5BC6\u94A5\u3001Token\u3001\u5BC6\u7801\u4EC5\u8BC6\u522B\u540D\u79F0\u3001\u4F4D\u7F6E\u548C\u7C7B\u578B\uFF0Cvalue \u5FC5\u987B\u8FD4\u56DE\u7A7A\u5B57\u7B26\u4E32\u3002",
      "\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown\u3002\u82E5\u4FE1\u606F\u4E0D\u8DB3\uFF0C\u5728 missingItems \u548C assumptions \u4E2D\u8BF4\u660E\u3002",
      "\u8F93\u51FA\u5B57\u6BB5\u56FA\u5B9A\u4E3A summary\u3001confidence\u3001assumptions\u3001missingItems\u3001reasoning\u3001sourceConfig\u3001parseConfig\u3001errorConfig\u3002"
    ].join("\n");
    async function parseApiDocument({ sourceId, inputText, file }) {
      const source = await dataSourceRepository.getDataSourceById(Number(sourceId));
      if (!source) throw new AppError("\u6765\u6E90\u6570\u636E\u6E90\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u9879\u76EE", 404);
      if (String(source.sourceType || "").toLowerCase() !== "api") {
        throw new AppError("AI \u63A5\u53E3\u6587\u6863\u89E3\u6790\u4EC5\u652F\u6301 API \u7C7B\u578B\u6765\u6E90\u6570\u636E\u6E90", 400);
      }
      const document = file ? await extractDocumentText(file) : { text: "", fileName: null, fileType: null };
      const userText = String(inputText || "").trim();
      if (!userText && !document.text) throw new AppError("\u8BF7\u8F93\u5165\u63A5\u53E3\u8C03\u7528\u8BF4\u660E\u6216\u4E0A\u4F20\u63A5\u53E3\u6587\u6863", 400);
      const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("api_document_parser");
      const provider = await resolveProvider(aiConfig);
      const response = await modelProviderService.generateChatCompletion(provider, buildPrompt({
        source,
        userText,
        documentText: document.text,
        systemPrompt: String(aiConfig?.systemPrompt || "").trim() || DEFAULT_SYSTEM_PROMPT
      }), {
        temperature: aiConfig?.temperature ?? 0.1,
        maxTokens: Number(aiConfig?.maxTokens || 4e3),
        timeoutMs: Number(aiConfig?.timeoutMs || 12e4),
        responseFormat: { type: "json_object" }
      });
      const proposal = normalizeProposal(parseJson(response.content), `${userText}
${document.text}`, source);
      return {
        proposal,
        document: {
          fileName: document.fileName,
          fileType: document.fileType,
          extractedTextLength: document.text.length
        },
        model: {
          providerName: provider.configName,
          modelName: provider.modelName
        }
      };
    }
    async function extractDocumentText(file) {
      const fileName = String(file.originalname || "").trim();
      const extension = path.extname(fileName).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        throw new AppError("\u4EC5\u652F\u6301 PDF\u3001Word\u3001Excel\u3001JSON\u3001YAML\u3001Markdown\u3001\u6587\u672C\u548C HTML \u683C\u5F0F\u7684\u63A5\u53E3\u6587\u6863", 400);
      }
      let text = "";
      if (extension === ".pdf") {
        text = (await extractPdfTextFromBuffer(file.buffer)).text;
      } else if (extension === ".docx") {
        text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
      } else if ([".xlsx", ".xls"].includes(extension)) {
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        text = workbook.SheetNames.slice(0, 8).map((sheetName) => `# ${sheetName}
${XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])}`).join("\n\n");
      } else {
        text = file.buffer.toString("utf8");
      }
      text = String(text || "").replace(/\u0000/g, "").trim().slice(0, MAX_TEXT_LENGTH);
      if (!text) throw new AppError("\u672A\u80FD\u4ECE\u6587\u6863\u63D0\u53D6\u53EF\u89E3\u6790\u6587\u672C\uFF1B\u626B\u63CF\u7248 PDF \u8BF7\u4E0A\u4F20\u53EF\u590D\u5236\u6587\u672C\u7248\u6216\u7C98\u8D34\u63A5\u53E3\u8BF4\u660E", 400);
      return { text, fileName, fileType: extension.slice(1) };
    }
    async function resolveProvider(aiConfig) {
      if (aiConfig?.defaultModelProviderId) {
        const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
        return modelProviderService.applyModelSelection(provider, {
          modelName: aiConfig.defaultModelName,
          modelVersion: aiConfig.defaultModelVersion
        });
      }
      const providers = await modelProviderService.getActiveChatModelProviders();
      if (!providers.length) throw new AppError("\u672A\u627E\u5230\u53EF\u7528\u5BF9\u8BDD\u6A21\u578B\uFF0C\u8BF7\u5148\u5728\u6A21\u578B\u7BA1\u7406\u4E2D\u914D\u7F6E\u201CAPI \u63A5\u53E3\u6587\u6863\u89E3\u6790\u201D\u573A\u666F", 400);
      return providers[0];
    }
    function buildPrompt({ source, userText, documentText, systemPrompt }) {
      const connection = source.connectionConfig || {};
      return [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            apiDataSource: {
              sourceName: source.sourceName,
              sourceCode: source.sourceCode,
              baseUrl: connection.baseUrl || connection.apiBaseUrl || connection.url || "",
              defaultPath: connection.defaultPath || connection.endpointPath || ""
            },
            userInput: userText.slice(0, 12e3),
            documentText: documentText.slice(0, MAX_TEXT_LENGTH),
            outputSchema: {
              summary: "\u63A5\u53E3\u7528\u9014",
              confidence: "high | medium | low",
              assumptions: ["\u4FDD\u5B88\u5047\u8BBE"],
              missingItems: ["\u5F85\u786E\u8BA4\u4FE1\u606F"],
              reasoning: ["\u8BC6\u522B\u4F9D\u636E"],
              sourceConfig: {
                endpointPath: "/path",
                method: "GET | POST | PUT | PATCH",
                contentType: "application/json | application/x-www-form-urlencoded | text/plain",
                auth: { type: "none | bearer | basic | api_key", apiKeyName: "", apiKeyIn: "header | query | body" },
                headers: [{ name: "", value: "", valueMode: "custom", valueType: "text", description: "" }],
                queryParams: [{ name: "", value: "", valueMode: "custom | system | checkpoint", valueType: "text", description: "" }],
                bodyParams: [{ name: "", value: "", valueMode: "custom | system | checkpoint", valueType: "text", description: "" }],
                bodyType: "json | form | text | none",
                bodyTemplate: "",
                pagination: { type: "none | page | offset | cursor", injectInto: "query | header | body", pageParam: "page", pageSizeParam: "pageSize", offsetParam: "offset", limitParam: "limit", cursorParam: "cursor", pageSize: 100, startPage: 1, maxPages: 100, nextCursorPath: "" },
                incremental: { enabled: false, cursorField: "", startParam: "startTime", endParam: "endTime", injectInto: "query | header | body", startValue: "" }
              },
              parseConfig: { responseFormat: "json | text", recordPath: "data", flattenJson: true, skipErrorRows: true },
              errorConfig: { successStatusCodes: [200], retryStatusCodes: [429, 500, 502, 503, 504], maxRetries: 2, retryIntervalMs: 2e3 }
            }
          })
        }
      ];
    }
    function parseJson(content) {
      const text = String(content || "").trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      try {
        return JSON.parse(text);
      } catch {
        throw new AppError("\u6A21\u578B\u672A\u8FD4\u56DE\u5408\u6CD5\u7684\u63A5\u53E3\u914D\u7F6E JSON\uFF0C\u8BF7\u8C03\u6574\u63D0\u793A\u8BCD\u6216\u91CD\u65B0\u89E3\u6790", 400);
      }
    }
    function normalizeProposal(raw, inputText = "", source = null) {
      const sourceConfig = apiIngestionService.normalizeApiSourceConfig(raw?.sourceConfig || {}, raw?.sourceConfig?.endpointPath || "");
      const parseConfig = apiIngestionService.normalizeApiParseConfig(raw?.parseConfig || {});
      const errorConfig = apiIngestionService.normalizeApiErrorConfig(raw?.errorConfig || {});
      sourceConfig.auth = { ...sourceConfig.auth, bearerToken: "", password: "", apiKeyValue: "" };
      [sourceConfig.headers, sourceConfig.queryParams, sourceConfig.bodyParams].forEach((items) => items.forEach((item) => {
        if (/(authorization|token|secret|password|api[-_]?key)/i.test(item.name)) item.value = "";
      }));
      mergeExplicitInput(sourceConfig, parseConfig, inputText);
      sourceConfig.endpointPath = normalizeEndpointPath(sourceConfig.endpointPath, source?.connectionConfig || {});
      if (!/(增量|incremental|位点|cursor)/i.test(String(inputText || ""))) {
        sourceConfig.incremental = { ...sourceConfig.incremental, enabled: false };
      }
      normalizeRequestParamModes(sourceConfig);
      configureIncrementalParams(sourceConfig, raw?.sourceConfig?.incremental || {});
      if (sourceConfig.bodyParams.length > 0) {
        sourceConfig.bodyTemplate = "";
      }
      return {
        summary: String(raw?.summary || "\u5DF2\u6839\u636E\u63A5\u53E3\u8BF4\u660E\u751F\u6210\u53C2\u6570\u914D\u7F6E\u65B9\u6848\u3002"),
        confidence: ["high", "medium", "low"].includes(String(raw?.confidence || "")) ? raw.confidence : "medium",
        assumptions: normalizeTextList(raw?.assumptions),
        missingItems: normalizeTextList(raw?.missingItems),
        reasoning: normalizeTextList(raw?.reasoning),
        sourceConfig,
        parseConfig,
        errorConfig
      };
    }
    function normalizeRequestParamModes(sourceConfig) {
      const validSystemKeys = /* @__PURE__ */ new Set(["now", "today", "yesterday", "timestamp", "value_range"]);
      const incrementalStartParam = sourceConfig.incremental?.enabled ? String(sourceConfig.incremental.startParam || "").trim() : "";
      [sourceConfig.headers, sourceConfig.queryParams, sourceConfig.bodyParams].forEach((items) => items.forEach((item) => {
        if (item.valueMode === "system" && !validSystemKeys.has(String(item.systemKey || ""))) {
          item.valueMode = "custom";
        }
        if (item.valueMode === "dataset" && !String(item.datasetField || "").trim()) {
          item.valueMode = "custom";
        }
        if (item.valueMode === "checkpoint" && String(item.name || "").trim() !== incrementalStartParam) {
          item.valueMode = "custom";
        }
      }));
    }
    function normalizeEndpointPath(value, connectionConfig = {}) {
      const raw = String(value || "").trim();
      if (!/^https?:\/\//i.test(raw)) return raw || "/";
      try {
        const endpoint = new URL(raw);
        const baseUrl = String(connectionConfig.baseUrl || connectionConfig.apiBaseUrl || connectionConfig.url || "").trim();
        if (/^https?:\/\//i.test(baseUrl)) {
          const base = new URL(baseUrl);
          const basePath = base.pathname.replace(/\/+$/, "");
          if (endpoint.origin === base.origin && basePath && endpoint.pathname.startsWith(`${basePath}/`)) {
            return `${endpoint.pathname.slice(basePath.length)}${endpoint.search}` || "/";
          }
        }
        return `${endpoint.pathname}${endpoint.search}` || "/";
      } catch {
        return raw;
      }
    }
    function mergeExplicitInput(sourceConfig, parseConfig, inputText) {
      const text = String(inputText || "");
      const methodAndPath = text.match(/\b(GET|POST|PUT|PATCH)\s+(\/[^\s,，;；]+)/i);
      if (methodAndPath) {
        sourceConfig.method = methodAndPath[1].toUpperCase();
        if (!sourceConfig.endpointPath || sourceConfig.endpointPath === "/") sourceConfig.endpointPath = methodAndPath[2];
      }
      const recordPathMatch = text.match(/\b(?:data|result|response)(?:\.[A-Za-z_][\w]*)+/i);
      if (recordPathMatch && (!parseConfig.recordPath || parseConfig.recordPath === "data")) {
        parseConfig.recordPath = recordPathMatch[0];
      }
      const headerNames = extractNamedParams(text, /(?:Header|请求头)\s*(?:参数)?\s*([^；;。\n]*?)(?=，\s*(?:Query|查询|URL)|[；;。\n]|$)/i);
      const queryNames = extractNamedParams(text, /(?:Query|查询参数|URL\s*参数)\s*(?:参数)?\s*([^；;。\n]*?)(?=[；;。\n]|$)/i);
      headerNames.forEach((name) => addInputParam(sourceConfig.headers, name));
      queryNames.forEach((name) => addInputParam(sourceConfig.queryParams, name));
      if (headerNames.some((name) => /token|api[-_]?key|app[-_]?token|authorization/i.test(name)) && sourceConfig.auth.authType === "none") {
        const keyName = headerNames.find((name) => /token|api[-_]?key|app[-_]?token|authorization/i.test(name));
        sourceConfig.auth = { ...sourceConfig.auth, authType: "api_key", apiKeyName: keyName, apiKeyIn: "header", apiKeyValue: "" };
      }
      const hasPageParams = queryNames.includes("page") && queryNames.some((name) => /page.?size|size|limit/i.test(name));
      if (hasPageParams && sourceConfig.pagination.type === "none") {
        sourceConfig.pagination = { ...sourceConfig.pagination, type: "page", pageParam: "page", pageSizeParam: queryNames.find((name) => /page.?size|size|limit/i.test(name)) || "pageSize" };
      }
      const incrementalParam = queryNames.find((name) => /updated|start|since|cursor|time/i.test(name));
      if (incrementalParam || /增量|incremental/i.test(text)) {
        sourceConfig.incremental = {
          ...sourceConfig.incremental,
          enabled: true,
          startParam: incrementalParam || sourceConfig.incremental.startParam || "startTime",
          injectInto: "query"
        };
      }
    }
    function extractNamedParams(text, pattern) {
      const match = String(text || "").match(pattern);
      if (!match) return [];
      return String(match[1] || "").split(/[、,，\s]+/).map((value) => value.replace(/[（(].*?[）)]/g, "").trim()).filter((value) => /^[A-Za-z_][\w.-]*$/.test(value));
    }
    function addInputParam(params, name) {
      if (!name || params.some((item) => item.name === name)) return;
      params.push({ name, value: "", enabled: true, valueMode: "custom", valueType: "text" });
    }
    function configureIncrementalParams(sourceConfig, rawIncremental) {
      if (!sourceConfig.incremental?.enabled) return;
      const injectInto = rawIncremental.injectInto || sourceConfig.incremental.injectInto || "query";
      const startParam = String(rawIncremental.startParam || sourceConfig.incremental.startParam || "startTime").trim();
      const endParam = String(rawIncremental.endParam || "").trim();
      sourceConfig.incremental.injectInto = injectInto;
      sourceConfig.incremental.startParam = startParam;
      sourceConfig.incremental.endParam = endParam;
      const params = injectInto === "header" ? sourceConfig.headers : injectInto === "body" ? sourceConfig.bodyParams : sourceConfig.queryParams;
      upsertGeneratedParam(params, startParam, {
        valueMode: "checkpoint",
        checkpointKey: "last_cursor",
        valueType: "datetime",
        description: "\u589E\u91CF\u540C\u6B65\u8D77\u59CB\u4F4D\u70B9"
      });
      if (endParam) {
        upsertGeneratedParam(params, endParam, {
          valueMode: "system",
          systemKey: "now",
          systemFormat: "YYYY-MM-DD HH:mm:ss",
          valueType: "datetime",
          description: "\u589E\u91CF\u540C\u6B65\u7ED3\u675F\u65F6\u95F4"
        });
      }
    }
    function upsertGeneratedParam(params, name, patch) {
      if (!name) return;
      const existing = params.find((item) => item.name === name);
      if (existing) {
        Object.assign(existing, patch, { value: "", enabled: true });
        return;
      }
      params.push({ name, value: "", enabled: true, ...patch });
    }
    function normalizeTextList(value) {
      return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20) : [];
    }
    module2.exports = { parseApiDocument };
  }
});

// backend/src/modules/ingestion-tasks/ingestion-task.controller.js
var require_ingestion_task_controller = __commonJS({
  "backend/src/modules/ingestion-tasks/ingestion-task.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var service = require_ingestion_task_service();
    var recommendationService = require_ingestion_task_recommendation_service();
    var apiDocumentParserService = require_ingestion_api_document_parser_service();
    async function listTasks(req, res) {
      const { status, syncMode, lastRunStatus, sourceId, keyword, page, pageSize } = req.query;
      const filters = {
        status,
        syncMode: syncMode ? String(syncMode).trim() : void 0,
        lastRunStatus: lastRunStatus ? String(lastRunStatus).trim() : void 0,
        sourceId: sourceId ? parseInt(sourceId, 10) : void 0,
        keyword: keyword ? String(keyword).trim() : void 0,
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 20
      };
      const result = await service.listTasks(filters);
      return sendSuccess(res, result.list, {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize
      });
    }
    async function getTask(req, res) {
      const task = await service.getTaskDetail(Number(req.params.id));
      return sendSuccess(res, task);
    }
    async function createTask(req, res) {
      const task = await service.createTask(req.validatedBody);
      return sendSuccess(res, task, null, 201);
    }
    async function updateTask(req, res) {
      const task = await service.updateTask(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, task);
    }
    async function deleteTask(req, res) {
      await service.deleteTask(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function startTask(req, res) {
      const task = await service.startTask(Number(req.params.id));
      return sendSuccess(res, task);
    }
    async function stopTask(req, res) {
      const task = await service.stopTask(Number(req.params.id));
      return sendSuccess(res, task);
    }
    async function runTaskNow(req, res) {
      const task = await service.runTaskNow(Number(req.params.id));
      return sendSuccess(res, task);
    }
    async function getJobRuns(req, res) {
      const { limit } = req.query;
      const runs = await service.getJobRuns(
        Number(req.params.id),
        limit ? parseInt(limit, 10) : void 0
      );
      return sendSuccess(res, runs, { total: runs.length });
    }
    async function getMonitorOverview(req, res) {
      const { pageSize, runLimit } = req.query;
      const data = await service.getMonitorOverview({
        pageSize: pageSize ? parseInt(pageSize, 10) : void 0,
        runLimit: runLimit ? parseInt(runLimit, 10) : void 0
      });
      return sendSuccess(res, data);
    }
    async function recommendTaskConfig(req, res) {
      const result = await recommendationService.recommendTaskConfig(req.validatedBody);
      return sendSuccess(res, result);
    }
    async function parseApiDocument(req, res) {
      const result = await apiDocumentParserService.parseApiDocument({
        sourceId: req.body?.sourceId,
        inputText: req.body?.inputText,
        file: req.file
      });
      return sendSuccess(res, result);
    }
    async function previewSourceData(req, res) {
      const result = await service.previewSourceData(req.validatedBody);
      return sendSuccess(res, result);
    }
    async function analyzeJobRunFailure(req, res) {
      const result = await service.analyzeJobRunFailure(
        Number(req.params.id),
        Number(req.params.runId),
        req.validatedBody
      );
      return sendSuccess(res, result);
    }
    module2.exports = {
      listTasks,
      getMonitorOverview,
      getTask,
      createTask,
      updateTask,
      deleteTask,
      startTask,
      stopTask,
      runTaskNow,
      getJobRuns,
      recommendTaskConfig,
      parseApiDocument,
      previewSourceData,
      analyzeJobRunFailure
    };
  }
});

// packages/data-platform-module-ingestion-tasks/src/.runtime-entry.js
var controller0 = require_ingestion_task_controller();
var { Writable } = require("node:stream");
var handlers = {
  "GET /api/v1/ingestion-tasks/monitor-overview": controller0["getMonitorOverview"],
  "GET /api/v1/ingestion-tasks": controller0["listTasks"],
  "GET /api/v1/ingestion-tasks/:id": controller0["getTask"],
  "POST /api/v1/ingestion-tasks": controller0["createTask"],
  "PUT /api/v1/ingestion-tasks/:id": controller0["updateTask"],
  "DELETE /api/v1/ingestion-tasks/:id": controller0["deleteTask"],
  "POST /api/v1/ingestion-tasks/recommend-config": controller0["recommendTaskConfig"],
  "POST /api/v1/ingestion-tasks/parse-api-document": controller0["parseApiDocument"],
  "POST /api/v1/ingestion-tasks/preview-source": controller0["previewSourceData"],
  "POST /api/v1/ingestion-tasks/:id/start": controller0["startTask"],
  "POST /api/v1/ingestion-tasks/:id/stop": controller0["stopTask"],
  "POST /api/v1/ingestion-tasks/:id/run": controller0["runTaskNow"],
  "GET /api/v1/ingestion-tasks/:id/runs": controller0["getJobRuns"],
  "POST /api/v1/ingestion-tasks/:id/runs/:runId/analyze-failure": controller0["analyzeJobRunFailure"]
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
