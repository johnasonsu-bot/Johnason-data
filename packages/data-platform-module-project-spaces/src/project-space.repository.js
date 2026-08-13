const DEFAULT_PROJECT_CODE = "default";

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function mapProjectRow(row) {
  return {
    id: Number(row.id), projectName: row.projectName, projectCode: row.projectCode,
    projectType: row.projectType || "standard", description: row.description || "",
    ownerUserId: row.ownerUserId ? Number(row.ownerUserId) : null, ownerName: row.ownerName || "system",
    status: row.status || "active", resourceConfig: parseJson(row.resourceConfig, {}), settings: parseJson(row.settings, {}),
    memberCount: row.memberCount === undefined ? undefined : Number(row.memberCount || 0), createdBy: row.createdBy || "system",
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

function mapMemberRow(row) {
  return {
    id: Number(row.id), projectId: Number(row.projectId), userId: Number(row.userId), username: row.username,
    displayName: row.displayName, projectRole: row.projectRole || "developer", permissions: parseJson(row.permissions, { modules: [] }),
    status: row.status || "active", createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

function createProjectSpaceRepository({ getDatabaseRuntime }) {
  if (typeof getDatabaseRuntime !== "function") throw new TypeError("Project space repository requires getDatabaseRuntime");
  const pool = () => getDatabaseRuntime().pool;
  const projectFields = "id, project_name AS projectName, project_code AS projectCode, project_type AS projectType, description, owner_user_id AS ownerUserId, owner_name AS ownerName, status, resource_config_json AS resourceConfig, settings_json AS settings, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt";

  async function getProjectById(id) {
    const [rows] = await pool().query(`SELECT ${projectFields} FROM project_spaces WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? mapProjectRow(rows[0]) : null;
  }
  async function getProjectByCode(code) {
    const [rows] = await pool().query(`SELECT ${projectFields} FROM project_spaces WHERE project_code = ? LIMIT 1`, [code]);
    return rows[0] ? mapProjectRow(rows[0]) : null;
  }
  async function ensureDefaultProject() {
    const existing = await getProjectByCode(DEFAULT_PROJECT_CODE);
    if (existing) return existing;
    const [adminRows] = await pool().query("SELECT id, display_name AS displayName FROM users WHERE role_code = 'admin' ORDER BY id ASC LIMIT 1");
    const owner = adminRows[0] || null;
    await pool().query("INSERT INTO project_spaces (project_name, project_code, project_type, description, owner_user_id, owner_name, status, resource_config_json, settings_json, created_by) VALUES ('默认项目', ?, 'standard', '历史数据和未指定项目的默认工作空间', ?, ?, 'active', JSON_OBJECT(), JSON_OBJECT(), 'system')", [DEFAULT_PROJECT_CODE, owner?.id || null, owner?.displayName || "system"]);
    return getProjectByCode(DEFAULT_PROJECT_CODE);
  }
  async function ensureUserMembership(projectId, userId, projectRole = "developer") {
    if (!projectId || !userId) return;
    await pool().query("INSERT IGNORE INTO project_members (project_id, user_id, project_role, permissions_json, status) VALUES (?, ?, ?, JSON_OBJECT('modules', JSON_ARRAY()), 'active')", [projectId, userId, projectRole]);
  }
  async function listProjects({ includeInactive = false } = {}) {
    const [rows] = await pool().query(`SELECT p.${projectFields.replaceAll(", ", ", p.")}, COUNT(m.id) AS memberCount FROM project_spaces p LEFT JOIN project_members m ON m.project_id = p.id AND m.status = 'active' ${includeInactive ? "" : "WHERE p.status = 'active'"} GROUP BY p.id ORDER BY p.id ASC`);
    return rows.map(mapProjectRow);
  }
  async function listUserProjects(userId) {
    const [rows] = await pool().query(`SELECT p.${projectFields.replaceAll(", ", ", p.")} FROM project_members m INNER JOIN project_spaces p ON p.id = m.project_id WHERE m.user_id = ? AND m.status = 'active' AND p.status = 'active' ORDER BY p.id ASC`, [userId]);
    return rows.map(mapProjectRow);
  }
  async function getProjectMember(projectId, userId) {
    const [rows] = await pool().query("SELECT m.id, m.project_id AS projectId, m.user_id AS userId, u.username, u.display_name AS displayName, m.project_role AS projectRole, m.permissions_json AS permissions, m.status, m.created_at AS createdAt, m.updated_at AS updatedAt FROM project_members m INNER JOIN users u ON u.id = m.user_id WHERE m.project_id = ? AND m.user_id = ? LIMIT 1", [projectId, userId]);
    return rows[0] ? mapMemberRow(rows[0]) : null;
  }
  async function getUserDefaultProjectId(userId) {
    const [rows] = await pool().query("SELECT default_project_id AS projectId FROM users WHERE id = ? LIMIT 1", [userId]);
    return rows[0]?.projectId ? Number(rows[0].projectId) : null;
  }
  async function setUserDefaultProject(userId, projectId) { const [result] = await pool().query("UPDATE users SET default_project_id = ? WHERE id = ?", [projectId, userId]); return Number(result.affectedRows || 0) > 0; }
  return Object.freeze({ ensureDefaultProject, ensureUserMembership, listProjects, listUserProjects, getProjectById, getProjectByCode, getProjectMember, getUserDefaultProjectId, setUserDefaultProject });
}

module.exports = { DEFAULT_PROJECT_CODE, createProjectSpaceRepository, mapMemberRow, mapProjectRow };
