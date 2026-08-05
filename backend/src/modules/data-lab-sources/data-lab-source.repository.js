const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");

function getScopedWhere(alias = "") {
  const projectId = getCurrentProjectId();
  if (!projectId) return { sql: "", params: [] };
  const prefix = alias ? `${alias}.` : "";
  return { sql: `${prefix}project_id = ?`, params: [projectId] };
}

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
    connectionConfig: connectionConfig || {}
  };
}

async function getDataSourceById(id) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, source_name AS sourceName, source_code AS sourceCode, source_type AS sourceType,
            connection_config AS connectionConfig, owner_name AS ownerName, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM data_lab_sources
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

async function listDataSources() {
  const scoped = getScopedWhere("ds");
  const [rows] = await pool.query(
    `SELECT ds.id, ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType,
            ds.connection_config AS connectionConfig, ds.owner_name AS ownerName, ds.status,
            COUNT(DISTINCT s.id) AS sceneReferenceCount,
            ds.created_at AS createdAt, ds.updated_at AS updatedAt
     FROM data_lab_sources ds
     LEFT JOIN lab_scene s
       ON ds.id = s.offline_data_source_id OR ds.id = s.realtime_data_source_id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     GROUP BY ds.id, ds.source_name, ds.source_code, ds.source_type, ds.connection_config, ds.owner_name, ds.status, ds.created_at, ds.updated_at
     ORDER BY ds.id DESC`,
    scoped.params
  );

  return rows.map((row) => ({
    ...mapRow(row),
    sceneReferenceCount: Number(row.sceneReferenceCount || 0)
  }));
}

async function listReferencedScenes(id) {
  const scoped = getScopedWhere("s");
  const [rows] = await pool.query(
    `SELECT s.id, s.scene_code AS sceneCode, s.scene_name AS sceneName, s.status, s.updated_at AS updatedAt,
            s.offline_data_source_id AS offlineDataSourceId, s.realtime_data_source_id AS realtimeDataSourceId
     FROM lab_scene s
     WHERE (s.offline_data_source_id = ? OR s.realtime_data_source_id = ?)${scoped.sql ? ` AND ${scoped.sql}` : ""}
     ORDER BY s.updated_at DESC, s.id DESC`,
    [id, id, ...scoped.params]
  );

  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    offlineDataSourceId: row.offlineDataSourceId ? Number(row.offlineDataSourceId) : null,
    realtimeDataSourceId: row.realtimeDataSourceId ? Number(row.realtimeDataSourceId) : null
  }));
}

async function getSceneReferenceCount(id) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM lab_scene
     WHERE (offline_data_source_id = ? OR realtime_data_source_id = ?)${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, id, ...scoped.params]
  );

  return Number(rows[0]?.total || 0);
}

async function createDataSource(payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO data_lab_sources
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

  return getDataSourceById(result.insertId);
}

async function updateDataSource(id, payload) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE data_lab_sources
     SET source_name = ?, source_code = ?, source_type = ?, connection_config = ?, owner_name = ?, status = ?
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

  if (result.affectedRows === 0) {
    return null;
  }

  return getDataSourceById(id);
}

async function deleteDataSource(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM data_lab_sources WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return result.affectedRows > 0;
}

module.exports = {
  getDataSourceById,
  listDataSources,
  listReferencedScenes,
  getSceneReferenceCount,
  createDataSource,
  updateDataSource,
  deleteDataSource
};
