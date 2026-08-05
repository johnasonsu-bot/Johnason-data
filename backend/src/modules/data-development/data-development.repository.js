const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");
const { parseJson } = require("./data-development.utils");

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
    passwordEncrypted: includePassword ? row.passwordEncrypted : undefined,
    hasPassword: Boolean(row.passwordEncrypted),
    extraConfig: parseJson(row.extraConfig, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapScriptFolder(row) {
  return {
    id: Number(row.id),
    name: row.name,
    parentId: row.parentId === null ? null : Number(row.parentId),
    createdAt: row.createdAt,
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
    updatedAt: row.updatedAt,
  };
}

function mapScriptVersion(row) {
  return {
    id: Number(row.id),
    scriptId: Number(row.scriptId),
    versionNo: Number(row.versionNo),
    content: row.content,
    createdAt: row.createdAt,
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
    executedAt: row.executedAt,
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
    messageCount: row.messageCount === undefined || row.messageCount === null ? null : Number(row.messageCount),
    lastPreview: row.lastPreview || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
    createdAt: row.createdAt,
  };
}

function mapWorkflow(row) {
  return {
    id: Number(row.id),
    projectId: row.projectId === null || row.projectId === undefined ? null : Number(row.projectId),
    name: row.name,
    description: row.description,
    cronExpr: row.cronExpr,
    isPaused: Boolean(row.isPaused),
    retryTimes: Number(row.retryTimes || 0),
    timeoutSec: Number(row.timeoutSec || 300),
    publishedVersionNo: row.publishedVersionNo === null || row.publishedVersionNo === undefined
      ? null
      : Number(row.publishedVersionNo),
    runtimeConfig: parseJson(row.runtimeConfig, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapWorkflowNode(row) {
  return {
    id: Number(row.id),
    workflowId: Number(row.workflowId),
    nodeType: row.nodeType || "script",
    scriptId: row.scriptId === null || row.scriptId === undefined ? null : Number(row.scriptId),
    scriptName: row.scriptName || null,
    processingJobId: row.processingJobId === null || row.processingJobId === undefined ? null : Number(row.processingJobId),
    processingJobName: row.processingJobName || null,
    orchestrationTaskId: row.orchestrationTaskId === null || row.orchestrationTaskId === undefined ? null : Number(row.orchestrationTaskId),
    orchestrationTaskName: row.orchestrationTaskName || null,
    datasourceId: row.datasourceId === null || row.datasourceId === undefined ? null : Number(row.datasourceId),
    datasourceName: row.datasourceName || null,
    nodeKey: row.nodeKey,
    nodeName: row.nodeName,
    positionX: Number(row.positionX || 0),
    positionY: Number(row.positionY || 0),
    width: Number(row.width || 240),
    height: Number(row.height || 88),
    retryTimes: row.retryTimes === null || row.retryTimes === undefined ? null : Number(row.retryTimes),
    retryIntervalSec: Number(row.retryIntervalSec || 0),
    timeoutSec: row.timeoutSec === null || row.timeoutSec === undefined ? null : Number(row.timeoutSec),
    triggerRule: row.triggerRule || "all_success",
    nodeConfig: parseJson(row.nodeConfig, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
    createdAt: row.createdAt,
  };
}

function mapWorkflowVersion(row) {
  return {
    id: Number(row.id),
    workflowId: Number(row.workflowId),
    versionNo: Number(row.versionNo),
    graphSnapshot: parseJson(row.graphSnapshot, { nodes: [], edges: [] }),
    validation: parseJson(row.validation, null),
    createdAt: row.createdAt,
  };
}

function mapOrchestrationTask(row) {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    datasourceId: row.datasourceId === null || row.datasourceId === undefined ? null : Number(row.datasourceId),
    datasourceName: row.datasourceName || null,
    datasourceType: row.datasourceType || null,
    databaseName: row.databaseName,
    cronExpr: row.cronExpr,
    isPaused: Boolean(row.isPaused),
    retryTimes: Number(row.retryTimes || 0),
    timeoutSec: Number(row.timeoutSec || 300),
    runtimeConfig: parseJson(row.runtimeConfig, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
    updatedAt: row.updatedAt,
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
    createdAt: row.createdAt,
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
    workflowVersionNo: row.workflowVersionNo === null || row.workflowVersionNo === undefined ? null : Number(row.workflowVersionNo),
    graphSnapshot: parseJson(row.graphSnapshot, null),
    workflowRetryCount: Number(row.workflowRetryCount || 0),
    scheduledAt: row.scheduledAt || null,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs === null || row.durationMs === undefined ? null : Number(row.durationMs),
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
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
    scriptId: row.scriptId === null || row.scriptId === undefined ? null : Number(row.scriptId),
    scriptName: row.scriptName || null,
    processingJobId: row.processingJobId === null || row.processingJobId === undefined ? null : Number(row.processingJobId),
    processingJobName: row.processingJobName || null,
    orchestrationTaskId: row.orchestrationTaskId === null || row.orchestrationTaskId === undefined ? null : Number(row.orchestrationTaskId),
    orchestrationTaskName: row.orchestrationTaskName || null,
    triggerType: row.triggerType,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs === null || row.durationMs === undefined ? null : Number(row.durationMs),
    retryCount: Number(row.retryCount || 0),
    runAttempt: Number(row.runAttempt || 1),
    errorMessage: row.errorMessage,
    resultPreview: parseJson(row.resultPreview, null),
    branchResult: parseJson(row.branchResult, null),
    createdAt: row.createdAt,
  };
}

function mapJobLog(row) {
  return {
    id: Number(row.id),
    instanceId: Number(row.instanceId),
    logType: row.logType,
    content: row.content,
    createdAt: row.createdAt,
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
    publishedVersionNo: row.publishedVersionNo === null || row.publishedVersionNo === undefined ? null : Number(row.publishedVersionNo),
    lastRunStatus: row.lastRunStatus || null,
    lastRunAt: row.lastRunAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
    updatedAt: row.updatedAt,
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
    sourceRowCount: row.sourceRowCount === null || row.sourceRowCount === undefined ? null : Number(row.sourceRowCount),
    outputRowCount: row.outputRowCount === null || row.outputRowCount === undefined ? null : Number(row.outputRowCount),
    affectedRows: row.affectedRows === null || row.affectedRows === undefined ? null : Number(row.affectedRows),
    targetTableName: row.targetTableName || null,
    durationMs: row.durationMs === null || row.durationMs === undefined ? null : Number(row.durationMs),
    errorMessage: row.errorMessage || null,
    resultPreview: parseJson(row.resultPreview, null),
    executedSql: row.executedSql || null,
    startedAt: row.startedAt || null,
    finishedAt: row.finishedAt || null,
    createdAt: row.createdAt,
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
    JSON.stringify(payload.extraConfig || {}),
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
    "extra_config_json = ?",
  ];
  const params = [
    payload.name,
    payload.type,
    payload.host,
    payload.port,
    payload.databaseName || null,
    payload.username || null,
    JSON.stringify(payload.extraConfig || {}),
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
    JSON.stringify(payload.tags || []),
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
    ...scoped.params,
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
      versionNo,
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
    JSON.stringify(payload.summary || null),
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
    payload.finishedAt || null,
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
    id,
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

  if (filters.folderId !== undefined && filters.folderId !== null && filters.folderId !== "") {
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
    payload.currentVersion || 1,
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
    ...scoped.params,
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
    payload.resultPreview ? JSON.stringify(payload.resultPreview) : null,
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
    payload.sessionTitle || null,
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
           SUBSTRING_INDEX(GROUP_CONCAT(m.message_text ORDER BY m.id DESC SEPARATOR '\n'), '\n', 1) AS lastPreview
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
    Number(userId),
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
    payload.context ? JSON.stringify(payload.context) : null,
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
    edges: edgeRows.map(mapWorkflowEdge),
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
    nodeCount: Number(row.nodeCount || 0),
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
    edges: edgeRows.map(mapOrchestrationEdge),
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
    nodeCount: Number(row.nodeCount || 0),
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
    JSON.stringify(payload.runtimeConfig || {}),
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
    ...scoped.params,
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
        JSON.stringify(node.nodeConfig || {}),
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
        edge.edgeStatus || "active",
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
    JSON.stringify(payload.runtimeConfig || {}),
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
    ...scoped.params,
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
        node.retryTimes === undefined ? null : node.retryTimes,
        node.retryIntervalSec ?? 5,
        node.timeoutSec === undefined ? null : node.timeoutSec,
        node.triggerRule || "all_success",
        JSON.stringify(node.nodeConfig || {}),
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
    payload.startedAt || null,
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
    payload.durationMs === undefined ? null : payload.durationMs,
    payload.errorMessage || null,
    payload.workflowRetryCount || 0,
    id,
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
    payload.branchResult ? JSON.stringify(payload.branchResult) : null,
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
    payload.durationMs === undefined ? null : payload.durationMs,
    payload.retryCount || 0,
    payload.errorMessage || null,
    payload.resultPreview ? JSON.stringify(payload.resultPreview) : null,
    payload.branchResult ? JSON.stringify(payload.branchResult) : null,
    id,
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

module.exports = {
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
  touchCopilotSession,
};
