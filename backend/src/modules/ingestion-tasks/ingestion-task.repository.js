const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");

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
    scheduleEnabled: row.scheduleEnabled === undefined ? undefined : Boolean(row.scheduleEnabled),
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

  if (payload.taskName !== undefined) {
    fields.push("task_name = ?");
    values.push(payload.taskName);
  }
  if (payload.sourceId !== undefined) {
    fields.push("source_id = ?");
    values.push(payload.sourceId);
  }
  if (payload.sourceTable !== undefined) {
    fields.push("source_table = ?");
    values.push(payload.sourceTable);
  }
  if (payload.targetSourceId !== undefined) {
    fields.push("target_source_id = ?");
    values.push(payload.targetSourceId);
  }
  if (payload.targetType !== undefined) {
    fields.push("target_type = ?");
    values.push(payload.targetType);
  }
  if (payload.targetTable !== undefined) {
    fields.push("target_table = ?");
    values.push(payload.targetTable);
  }
  if (payload.targetConfig !== undefined) {
    fields.push("target_config = ?");
    values.push(JSON.stringify(payload.targetConfig));
  }
  if (payload.syncMode !== undefined) {
    fields.push("sync_mode = ?");
    values.push(payload.syncMode);
  }
  if (payload.status !== undefined) {
    fields.push("status = ?");
    values.push(payload.status);
  }
  if (payload.description !== undefined) {
    fields.push("description = ?");
    values.push(payload.description);
  }
  if (payload.ownerName !== undefined) {
    fields.push("owner_name = ?");
    values.push(payload.ownerName);
  }
  if (payload.scheduleEnabled !== undefined) {
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

  if (
    payload.fieldMappings !== undefined ||
    payload.transformRules !== undefined ||
    payload.incrementalConfig !== undefined ||
    payload.sourceConfig !== undefined ||
    payload.parseConfig !== undefined ||
    payload.errorConfig !== undefined ||
    payload.scheduleConfig !== undefined
  ) {
    await upsertTaskConfig(id, payload);
  }

  return getTaskById(id);
}

async function upsertTaskConfig(taskId, payload) {
  const existingTask = await getTaskById(taskId);
  const [existing] = await pool.query("SELECT id FROM ingestion_configs WHERE task_id = ?", [taskId]);

  const nextFieldMappings = payload.fieldMappings !== undefined ? payload.fieldMappings : existingTask?.fieldMappings || [];
  const nextTransformRules = payload.transformRules !== undefined ? payload.transformRules : existingTask?.transformRules || [];
  const nextIncrementalConfig = payload.incrementalConfig !== undefined ? payload.incrementalConfig : existingTask?.incrementalConfig || null;
  const nextSourceConfig = payload.sourceConfig !== undefined ? payload.sourceConfig : existingTask?.sourceConfig || null;
  const nextParseConfig = payload.parseConfig !== undefined ? payload.parseConfig : existingTask?.parseConfig || null;
  const nextErrorConfig = payload.errorConfig !== undefined ? payload.errorConfig : existingTask?.errorConfig || null;
  const nextScheduleConfig = payload.scheduleConfig !== undefined ? payload.scheduleConfig : existingTask?.scheduleConfig || null;

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
  const normalizedLimit = limit === null || limit === undefined ? null : Math.max(1, Number(limit) || 0);
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
    executionInfo: null,
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

  if (payload.runStatus !== undefined) {
    fields.push("run_status = ?");
    values.push(payload.runStatus);
  }
  if (payload.startTime !== undefined) {
    fields.push("start_time = ?");
    values.push(payload.startTime);
  }
  if (payload.endTime !== undefined) {
    fields.push("end_time = ?");
    values.push(payload.endTime);
  }
  if (payload.recordsCount !== undefined) {
    fields.push("records_count = ?");
    values.push(payload.recordsCount);
  }
  if (payload.errorMessage !== undefined) {
    fields.push("error_message = ?");
    values.push(payload.errorMessage);
  }
  if (payload.executionInfo !== undefined) {
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
      endTime: new Date(),
      errorMessage: "检测到该运行记录已被后续执行覆盖，已自动修正为异常结束",
      executionInfo: {
        recovered: true,
        recoveredAt: new Date().toISOString(),
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
    const hasSuccessFlag =
      executionInfo.success === true ||
      nested.status === "success" ||
      nested.exitCode === 0 ||
      String(stdout).includes("任务执行整个成功");
    const hasFailureFlag =
      Boolean(row.errorMessage) ||
      Boolean(executionInfo.error) ||
      nested.status === "failed" ||
      (nested.exitCode !== undefined && nested.exitCode !== null && nested.exitCode !== 0) ||
      String(stdout).includes("任务执行失败");

    if (hasSuccessFlag) {
      await updateJobRun(row.id, {
        runStatus: "completed",
        endTime: new Date(),
        recordsCount: executionInfo.recordsCount || nested.metrics?.totalRecords || row.recordsCount || 0
      });
      await updateTaskStatus(row.taskId, "active");
      updatedCount += 1;
      continue;
    }

    if (hasFailureFlag) {
      await updateJobRun(row.id, {
        runStatus: "failed",
        endTime: new Date(),
        errorMessage: row.errorMessage || executionInfo.error?.message || nested.error || "任务异常结束"
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
      endTime: new Date(),
      errorMessage: "服务重启后检测到该任务未正常收尾，已自动修正为异常结束",
      executionInfo: {
        recovered: true,
        recoveredAt: new Date().toISOString(),
        recoveredReason: "service_restarted"
      }
    });
    await updateTaskStatus(row.taskId, "active");
  }

  return rows.length;
}

async function cleanupOldJobRuns(options = {}) {
  const retentionDays = Math.max(1, Number(options.retentionDays) || 30);
  const batchSize = Math.max(100, Math.min(5000, Number(options.batchSize) || 1000));
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
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
    lastProcessedOffset: row.lastProcessedOffset === null || row.lastProcessedOffset === undefined ? null : Number(row.lastProcessedOffset),
    lastCommittedOffset: row.lastCommittedOffset === null || row.lastCommittedOffset === undefined ? null : Number(row.lastCommittedOffset),
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
      payload.messageTimestamp || null,
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
      payload.processedAt || null,
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
      payload.errorMessage || null,
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

module.exports = {
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
