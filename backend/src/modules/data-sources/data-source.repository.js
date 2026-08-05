const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");

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
    sourceDomain: row.sourceDomain || "integration",
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

  const normalizedSourceIds = Array.from(new Set((Array.isArray(sourceIds) ? sourceIds : [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)));
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
  const params = projectId
    ? [id, id, projectId, id, projectId, id, projectId]
    : [id, id, id, id];
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
        payload.status,
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
        payload.status,
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
        ...(projectId ? [projectId] : [])
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
        ...(projectId ? [projectId] : []),
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

module.exports = {
  getDataSourceById,
  listDataSources,
  listReferencedTasks,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  deleteReferencedJobsBySourceId
};
