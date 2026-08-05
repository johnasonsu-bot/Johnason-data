const { pool } = require("../../config/database");

const DEFAULT_PROJECT_CODE = "default";
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_]+$/;
const EXTRA_PROJECT_DELETE_STATEMENTS = [
  {
    sql: `DELETE FROM lab_operation_log
          WHERE scene_id IN (SELECT id FROM lab_scene WHERE project_id = ?)`,
    params: (projectId) => [projectId],
  },
  {
    sql: `DELETE FROM reporting_ai_runs
          WHERE source_id IN (SELECT id FROM report_data_sources WHERE project_id = ?)
             OR chart_asset_id IN (SELECT id FROM report_chart_assets WHERE project_id = ?)`,
    params: (projectId) => [projectId, projectId],
  },
  {
    sql: `DELETE FROM ingestion_jobs
          WHERE source_id IN (SELECT id FROM data_sources WHERE project_id = ?)`,
    params: (projectId) => [projectId],
  },
];

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapProjectRow(row) {
  return {
    id: Number(row.id),
    projectName: row.projectName,
    projectCode: row.projectCode,
    projectType: row.projectType || "standard",
    description: row.description || "",
    ownerUserId: row.ownerUserId ? Number(row.ownerUserId) : null,
    ownerName: row.ownerName || "system",
    status: row.status || "active",
    resourceConfig: parseJson(row.resourceConfig, {}),
    settings: parseJson(row.settings, {}),
    memberCount: row.memberCount === undefined ? undefined : Number(row.memberCount || 0),
    createdBy: row.createdBy || "system",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMemberRow(row) {
  return {
    id: Number(row.id),
    projectId: Number(row.projectId),
    userId: Number(row.userId),
    username: row.username,
    displayName: row.displayName,
    projectRole: row.projectRole || "developer",
    permissions: parseJson(row.permissions, { modules: [] }),
    status: row.status || "active",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function quoteIdentifier(name) {
  if (!SAFE_IDENTIFIER_PATTERN.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return `\`${name}\``;
}

async function listProjectScopedTables(connection) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS tableName
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND COLUMN_NAME = 'project_id'
       AND TABLE_NAME <> 'project_spaces'
     GROUP BY TABLE_NAME
     ORDER BY TABLE_NAME ASC`
  );
  return rows
    .map((row) => String(row.tableName || ""))
    .filter((tableName) => SAFE_IDENTIFIER_PATTERN.test(tableName));
}

async function listProjectScopedDependencies(connection, tableNames) {
  if (tableNames.length === 0) {
    return [];
  }
  const placeholders = tableNames.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS childTable, REFERENCED_TABLE_NAME AS parentTable
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND REFERENCED_TABLE_NAME IS NOT NULL
       AND TABLE_NAME IN (${placeholders})
       AND REFERENCED_TABLE_NAME IN (${placeholders})`,
    [...tableNames, ...tableNames]
  );
  return rows.map((row) => ({
    childTable: String(row.childTable || ""),
    parentTable: String(row.parentTable || ""),
  }));
}

function buildProjectScopedDeleteOrder(tableNames, dependencies) {
  const sortedTables = [...tableNames].sort((left, right) => left.localeCompare(right));
  const inboundCounts = new Map(sortedTables.map((tableName) => [tableName, 0]));
  const adjacency = new Map(sortedTables.map((tableName) => [tableName, new Set()]));

  for (const { childTable, parentTable } of dependencies) {
    if (childTable === parentTable) {
      continue;
    }
    if (!adjacency.has(parentTable) || !adjacency.has(childTable)) {
      continue;
    }
    const children = adjacency.get(parentTable);
    if (!children.has(childTable)) {
      children.add(childTable);
      inboundCounts.set(childTable, Number(inboundCounts.get(childTable) || 0) + 1);
    }
  }

  const queue = sortedTables.filter((tableName) => Number(inboundCounts.get(tableName) || 0) === 0);
  const visited = new Set();
  const topologicalOrder = [];

  while (queue.length > 0) {
    queue.sort((left, right) => left.localeCompare(right));
    const tableName = queue.shift();
    if (!tableName || visited.has(tableName)) {
      continue;
    }
    visited.add(tableName);
    topologicalOrder.push(tableName);

    const children = [...(adjacency.get(tableName) || [])].sort((left, right) => left.localeCompare(right));
    for (const childTable of children) {
      const nextInboundCount = Number(inboundCounts.get(childTable) || 0) - 1;
      inboundCounts.set(childTable, nextInboundCount);
      if (nextInboundCount === 0) {
        queue.push(childTable);
      }
    }
  }

  const unresolved = sortedTables.filter((tableName) => !visited.has(tableName)).reverse();
  return [...topologicalOrder.reverse(), ...unresolved];
}

async function deleteProjectScopedAssets(connection, projectId) {
  for (const statement of EXTRA_PROJECT_DELETE_STATEMENTS) {
    await connection.query(statement.sql, statement.params(projectId));
  }

  const tableNames = await listProjectScopedTables(connection);
  const dependencies = await listProjectScopedDependencies(connection, tableNames);
  const deleteOrder = buildProjectScopedDeleteOrder(tableNames, dependencies);

  for (const tableName of deleteOrder) {
    await connection.query(
      `DELETE FROM ${quoteIdentifier(tableName)} WHERE project_id = ?`,
      [projectId]
    );
  }
}

async function findDefaultProject() {
  const [rows] = await pool.query(
    `SELECT id, project_name AS projectName, project_code AS projectCode, project_type AS projectType,
            description, owner_user_id AS ownerUserId, owner_name AS ownerName, status,
            resource_config_json AS resourceConfig, settings_json AS settings,
            created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM project_spaces
     WHERE project_code = ?
     LIMIT 1`,
    [DEFAULT_PROJECT_CODE]
  );
  return rows[0] ? mapProjectRow(rows[0]) : null;
}

async function ensureDefaultProject() {
  const existing = await findDefaultProject();
  if (existing) return existing;

  const [adminRows] = await pool.query(
    `SELECT id, display_name AS displayName
     FROM users
     WHERE role_code = 'admin'
     ORDER BY id ASC
     LIMIT 1`
  );
  const owner = adminRows[0] || null;
  await pool.query(
    `INSERT INTO project_spaces
      (project_name, project_code, project_type, description, owner_user_id, owner_name, status, resource_config_json, settings_json, created_by)
     VALUES ('默认项目', ?, 'standard', '历史数据和未指定项目的默认工作空间', ?, ?, 'active', JSON_OBJECT(), JSON_OBJECT(), 'system')`,
    [DEFAULT_PROJECT_CODE, owner?.id || null, owner?.displayName || "system"]
  );
  return findDefaultProject();
}

async function ensureUserMembership(projectId, userId, projectRole = "developer") {
  if (!projectId || !userId) return;
  await pool.query(
    `INSERT IGNORE INTO project_members
      (project_id, user_id, project_role, permissions_json, status)
     VALUES (?, ?, ?, JSON_OBJECT('modules', JSON_ARRAY()), 'active')`,
    [projectId, userId, projectRole]
  );
}

async function ensureAllUsersDefaultMembership() {
  const defaultProject = await ensureDefaultProject();
  await pool.query(
    `INSERT IGNORE INTO project_members
      (project_id, user_id, project_role, permissions_json, status)
     SELECT ?, u.id, CASE WHEN u.role_code = 'admin' THEN 'owner' ELSE 'developer' END, JSON_OBJECT('modules', JSON_ARRAY()), 'active'
     FROM users u`,
    [defaultProject.id]
  );
  return defaultProject;
}

async function listProjects({ includeInactive = false } = {}) {
  const [rows] = await pool.query(
    `SELECT p.id, p.project_name AS projectName, p.project_code AS projectCode, p.project_type AS projectType,
            p.description, p.owner_user_id AS ownerUserId, p.owner_name AS ownerName, p.status,
            p.resource_config_json AS resourceConfig, p.settings_json AS settings, p.created_by AS createdBy,
            p.created_at AS createdAt, p.updated_at AS updatedAt, COUNT(m.id) AS memberCount
     FROM project_spaces p
     LEFT JOIN project_members m ON m.project_id = p.id AND m.status = 'active'
     ${includeInactive ? "" : "WHERE p.status = 'active'"}
     GROUP BY p.id, p.project_name, p.project_code, p.project_type, p.description, p.owner_user_id, p.owner_name,
              p.status, p.resource_config_json, p.settings_json, p.created_by, p.created_at, p.updated_at
     ORDER BY p.id ASC`
  );
  return rows.map(mapProjectRow);
}

async function listUserProjects(userId) {
  const [rows] = await pool.query(
    `SELECT p.id, p.project_name AS projectName, p.project_code AS projectCode, p.project_type AS projectType,
            p.description, p.owner_user_id AS ownerUserId, p.owner_name AS ownerName, p.status,
            p.resource_config_json AS resourceConfig, p.settings_json AS settings, p.created_by AS createdBy,
            p.created_at AS createdAt, p.updated_at AS updatedAt
     FROM project_members m
     INNER JOIN project_spaces p ON p.id = m.project_id
     WHERE m.user_id = ?
       AND m.status = 'active'
       AND p.status = 'active'
     ORDER BY p.id ASC`,
    [userId]
  );
  return rows.map(mapProjectRow);
}

async function getProjectById(id) {
  const [rows] = await pool.query(
    `SELECT id, project_name AS projectName, project_code AS projectCode, project_type AS projectType,
            description, owner_user_id AS ownerUserId, owner_name AS ownerName, status,
            resource_config_json AS resourceConfig, settings_json AS settings,
            created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM project_spaces
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ? mapProjectRow(rows[0]) : null;
}

async function getProjectByCode(projectCode) {
  const [rows] = await pool.query(
    `SELECT id, project_name AS projectName, project_code AS projectCode, project_type AS projectType,
            description, owner_user_id AS ownerUserId, owner_name AS ownerName, status,
            resource_config_json AS resourceConfig, settings_json AS settings,
            created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM project_spaces
     WHERE project_code = ?
     LIMIT 1`,
    [projectCode]
  );
  return rows[0] ? mapProjectRow(rows[0]) : null;
}

async function getProjectMember(projectId, userId) {
  const [rows] = await pool.query(
    `SELECT m.id, m.project_id AS projectId, m.user_id AS userId, u.username, u.display_name AS displayName,
            m.project_role AS projectRole, m.permissions_json AS permissions, m.status,
            m.created_at AS createdAt, m.updated_at AS updatedAt
     FROM project_members m
     INNER JOIN users u ON u.id = m.user_id
     WHERE m.project_id = ? AND m.user_id = ?
     LIMIT 1`,
    [projectId, userId]
  );
  return rows[0] ? mapMemberRow(rows[0]) : null;
}

async function getUserDefaultProjectId(userId) {
  const [rows] = await pool.query(
    `SELECT default_project_id AS defaultProjectId
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0]?.defaultProjectId ? Number(rows[0].defaultProjectId) : null;
}

async function setUserDefaultProject(userId, projectId) {
  const [result] = await pool.query(
    `UPDATE users SET default_project_id = ? WHERE id = ?`,
    [projectId, userId]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function listProjectMembers(projectId) {
  const [rows] = await pool.query(
    `SELECT m.id, m.project_id AS projectId, m.user_id AS userId, u.username, u.display_name AS displayName,
            m.project_role AS projectRole, m.permissions_json AS permissions, m.status,
            m.created_at AS createdAt, m.updated_at AS updatedAt
     FROM project_members m
     INNER JOIN users u ON u.id = m.user_id
     WHERE m.project_id = ?
     ORDER BY m.id ASC`,
    [projectId]
  );
  return rows.map(mapMemberRow);
}

async function createProject(payload, user) {
  const [result] = await pool.query(
    `INSERT INTO project_spaces
      (project_name, project_code, project_type, description, owner_user_id, owner_name, status, resource_config_json, settings_json, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.projectName,
      payload.projectCode,
      payload.projectType || "standard",
      payload.description || null,
      payload.ownerUserId || user?.sub || null,
      payload.ownerName || user?.displayName || user?.username || "system",
      payload.status || "active",
      JSON.stringify(payload.resourceConfig || {}),
      JSON.stringify(payload.settings || {}),
      user?.username || "system",
    ]
  );
  await ensureUserMembership(result.insertId, payload.ownerUserId || user?.sub, "owner");
  return getProjectById(result.insertId);
}

async function updateProject(id, payload) {
  const [result] = await pool.query(
    `UPDATE project_spaces
     SET project_name = ?, project_code = ?, project_type = ?, description = ?, owner_user_id = ?,
         owner_name = ?, status = ?, resource_config_json = ?, settings_json = ?
     WHERE id = ?`,
    [
      payload.projectName,
      payload.projectCode,
      payload.projectType || "standard",
      payload.description || null,
      payload.ownerUserId || null,
      payload.ownerName || "system",
      payload.status || "active",
      JSON.stringify(payload.resourceConfig || {}),
      JSON.stringify(payload.settings || {}),
      id,
    ]
  );
  if (!result.affectedRows) return null;
  if (payload.ownerUserId) {
    await ensureUserMembership(id, payload.ownerUserId, "owner");
  }
  return getProjectById(id);
}

async function updateProjectStatus(id, status) {
  const [result] = await pool.query(
    `UPDATE project_spaces SET status = ? WHERE id = ?`,
    [status, id]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function upsertProjectMember(projectId, payload) {
  await pool.query(
    `INSERT INTO project_members
      (project_id, user_id, project_role, permissions_json, status)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       project_role = VALUES(project_role),
       permissions_json = VALUES(permissions_json),
       status = VALUES(status)`,
    [
      projectId,
      payload.userId,
      payload.projectRole || "developer",
      JSON.stringify(payload.permissions || { modules: [] }),
      payload.status || "active",
    ]
  );
  return getProjectMember(projectId, payload.userId);
}

async function removeProjectMember(projectId, userId) {
  const [result] = await pool.query(
    `DELETE FROM project_members WHERE project_id = ? AND user_id = ?`,
    [projectId, userId]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function deleteProject(id) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await deleteProjectScopedAssets(connection, id);
    const [result] = await connection.query(
      `DELETE FROM project_spaces WHERE id = ?`,
      [id]
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

module.exports = {
  DEFAULT_PROJECT_CODE,
  ensureDefaultProject,
  ensureAllUsersDefaultMembership,
  ensureUserMembership,
  listProjects,
  listUserProjects,
  getProjectById,
  getProjectByCode,
  getProjectMember,
  getUserDefaultProjectId,
  setUserDefaultProject,
  listProjectMembers,
  createProject,
  updateProject,
  updateProjectStatus,
  upsertProjectMember,
  removeProjectMember,
  deleteProject,
  deleteProjectScopedAssets,
};
