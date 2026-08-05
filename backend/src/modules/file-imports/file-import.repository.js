const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");

function parseJsonValue(value, fallback) {
  if (value === null || value === undefined || value === "") {
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
    lastRun: row.lastRunId
      ? {
          id: Number(row.lastRunId),
          runStatus: row.lastRunStatus,
          startTime: row.lastRunStartTime,
          endTime: row.lastRunEndTime,
          totalRows: Number(row.lastRunTotalRows || 0),
          successRows: Number(row.lastRunSuccessRows || 0),
          skippedRows: Number(row.lastRunSkippedRows || 0),
          errorRows: Number(row.lastRunErrorRows || 0),
          errorMessage: row.lastRunErrorMessage || null,
        }
      : null,
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
    updatedAt: row.updatedAt,
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
    createdAt: row.createdAt,
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
    list: rows.map((row) => mapTaskRow(row)),
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
        payload.status || "draft",
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
        JSON.stringify(payload.previewSchema || {}),
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
          JSON.stringify(file.settings || {}),
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
        ...(projectId ? [projectId] : []),
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
        JSON.stringify(payload.previewSchema || {}),
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
  if (payload.totalRows !== undefined) {
    fields.push("total_rows = ?");
    values.push(payload.totalRows);
  }
  if (payload.successRows !== undefined) {
    fields.push("success_rows = ?");
    values.push(payload.successRows);
  }
  if (payload.skippedRows !== undefined) {
    fields.push("skipped_rows = ?");
    values.push(payload.skippedRows);
  }
  if (payload.errorRows !== undefined) {
    fields.push("error_rows = ?");
    values.push(payload.errorRows);
  }
  if (payload.errorMessage !== undefined) {
    fields.push("error_message = ?");
    values.push(payload.errorMessage);
  }
  if (payload.executionInfo !== undefined) {
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
    item.errorMessage || "未知错误",
    JSON.stringify(item.rawData || {}),
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
      createdAt: row.createdAt,
    })),
  };
}

module.exports = {
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
  updateRun,
};
