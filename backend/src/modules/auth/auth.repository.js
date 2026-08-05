const { pool } = require("../../config/database");
const { normalizeRolePermissions } = require("../../common/utils/user-permissions");

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    displayName: row.displayName,
    roleId: row.roleId || null,
    roleCode: row.roleCode,
    roleType: row.roleType || null,
    roleName: row.roleName || null,
    defaultProjectId: row.defaultProjectId ? Number(row.defaultProjectId) : null,
    permissions: normalizeRolePermissions({
      roleCode: row.roleCode,
      roleType: row.roleType,
      permissions: row.permissions,
    }),
    status: row.status
  };
}

async function findByUsername(username) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.password_hash AS passwordHash, u.display_name AS displayName,
            u.role_id AS roleId, COALESCE(r.role_code, u.role_code) AS roleCode,
            u.default_project_id AS defaultProjectId,
            r.role_type AS roleType, r.role_name AS roleName, r.permissions_json AS permissions, u.status
     FROM users u
     LEFT JOIN system_roles r ON u.role_id = r.id OR (u.role_id IS NULL AND u.role_code = r.role_code)
     WHERE u.username = ? LIMIT 1`,
    [username]
  );

  return rows[0] ? mapUser(rows[0]) : null;
}

async function findProfileById(id) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.display_name AS displayName, u.role_id AS roleId,
            COALESCE(r.role_code, u.role_code) AS roleCode,
            u.default_project_id AS defaultProjectId,
            r.role_type AS roleType, r.role_name AS roleName, r.permissions_json AS permissions, u.status
     FROM users u
     LEFT JOIN system_roles r ON u.role_id = r.id OR (u.role_id IS NULL AND u.role_code = r.role_code)
     WHERE u.id = ? LIMIT 1`,
    [id]
  );

  return rows[0] ? mapUser(rows[0]) : null;
}

module.exports = {
  findByUsername,
  findProfileById
};
