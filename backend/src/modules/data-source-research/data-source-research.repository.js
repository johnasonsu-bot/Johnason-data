const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") {
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
    taskId: row.taskId === null || row.taskId === undefined ? null : Number(row.taskId),
    runNo: row.runNo === null || row.runNo === undefined ? null : Number(row.runNo),
    sourceId: Number(row.sourceId),
    progressPercent: Number(row.progressPercent || 0),
    config: parseJson(row.configJson, {}),
    selectedTables: parseJson(row.selectedTablesJson, []),
    report: parseJson(row.reportJson, null),
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
    lastRunId: row.lastRunId === null || row.lastRunId === undefined ? null : Number(row.lastRunId),
    config: parseJson(row.configJson, {}),
    selectedTables: parseJson(row.selectedTablesJson, []),
  };
}

function mapLog(row) {
  return {
    ...row,
    runId: Number(row.runId),
    detail: parseJson(row.detailJson, null),
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
    aiSummary: parseJson(row.aiSummaryJson, null),
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
      errorMessage: "服务重启或任务执行线程异常中断，系统已将该调研任务自动修正为失败状态，请重新发起调研。",
      finishedAt: new Date()
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

module.exports = {
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
