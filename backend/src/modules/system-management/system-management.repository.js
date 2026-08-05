const { pool } = require("../../config/database");

function parseConfig(config) {
  if (!config) {
    return {};
  }

  if (typeof config === "string") {
    try {
      return JSON.parse(config);
    } catch (error) {
      return {};
    }
  }

  return config;
}

const { normalizeRolePermissions } = require("../../common/utils/user-permissions");

function mapServiceRow(row) {
  return {
    id: row.id,
    serviceKey: row.serviceKey,
    serviceName: row.serviceName,
    serviceCategory: row.serviceCategory,
    serviceType: row.serviceType,
    manageMode: row.manageMode,
    host: row.host,
    port: row.port,
    autoStart: Boolean(row.autoStart),
    status: row.status,
    isCore: Boolean(row.isCore),
    notes: row.notes,
    config: parseConfig(row.config),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapRoleRow(row) {
  return {
    id: row.id,
    roleName: row.roleName,
    roleCode: row.roleCode,
    roleType: row.roleType,
    permissions: normalizeRolePermissions({
      roleCode: row.roleCode,
      roleType: row.roleType,
      permissions: row.permissions,
    }),
    status: row.status,
    isSystem: Boolean(row.isSystem),
    userCount: Number(row.userCount || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapUserRow(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    roleId: row.roleId || null,
    roleCode: row.roleCode,
    roleName: row.roleName || null,
    roleType: row.roleType || null,
    permissions: normalizeRolePermissions({
      roleCode: row.roleCode,
      roleType: row.roleType,
      permissions: row.permissions,
    }),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function listServiceConfigs() {
  const [rows] = await pool.query(
    `SELECT id, service_key AS serviceKey, service_name AS serviceName, service_category AS serviceCategory,
            service_type AS serviceType, manage_mode AS manageMode, host, port, auto_start AS autoStart,
            status, is_core AS isCore, notes, config_json AS config,
            created_at AS createdAt, updated_at AS updatedAt
     FROM system_service_configs
     ORDER BY is_core DESC, service_category ASC, id ASC`
  );

  return rows.map(mapServiceRow);
}

async function getServiceConfigById(id) {
  const [rows] = await pool.query(
    `SELECT id, service_key AS serviceKey, service_name AS serviceName, service_category AS serviceCategory,
            service_type AS serviceType, manage_mode AS manageMode, host, port, auto_start AS autoStart,
            status, is_core AS isCore, notes, config_json AS config,
            created_at AS createdAt, updated_at AS updatedAt
     FROM system_service_configs
     WHERE id = ? LIMIT 1`,
    [id]
  );

  return rows[0] ? mapServiceRow(rows[0]) : null;
}

async function getServiceConfigByKey(serviceKey) {
  const [rows] = await pool.query(
    `SELECT id, service_key AS serviceKey, service_name AS serviceName, service_category AS serviceCategory,
            service_type AS serviceType, manage_mode AS manageMode, host, port, auto_start AS autoStart,
            status, is_core AS isCore, notes, config_json AS config,
            created_at AS createdAt, updated_at AS updatedAt
     FROM system_service_configs
     WHERE service_key = ? LIMIT 1`,
    [serviceKey]
  );

  return rows[0] ? mapServiceRow(rows[0]) : null;
}

async function createServiceConfig(payload) {
  const [result] = await pool.query(
    `INSERT INTO system_service_configs
      (service_key, service_name, service_category, service_type, manage_mode, host, port,
       auto_start, status, is_core, notes, config_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.serviceKey,
      payload.serviceName,
      payload.serviceCategory,
      payload.serviceType,
      payload.manageMode,
      payload.host || null,
      payload.port || null,
      payload.autoStart ? 1 : 0,
      payload.status,
      payload.isCore ? 1 : 0,
      payload.notes || null,
      JSON.stringify(payload.config || {})
    ]
  );

  return getServiceConfigById(result.insertId);
}

async function updateServiceConfig(id, payload) {
  const [result] = await pool.query(
    `UPDATE system_service_configs
     SET service_key = ?, service_name = ?, service_category = ?, service_type = ?, manage_mode = ?,
         host = ?, port = ?, auto_start = ?, status = ?, notes = ?, config_json = ?
     WHERE id = ?`,
    [
      payload.serviceKey,
      payload.serviceName,
      payload.serviceCategory,
      payload.serviceType,
      payload.manageMode,
      payload.host || null,
      payload.port || null,
      payload.autoStart ? 1 : 0,
      payload.status,
      payload.notes || null,
      JSON.stringify(payload.config || {}),
      id
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getServiceConfigById(id);
}

async function deleteServiceConfig(id) {
  const [result] = await pool.query("DELETE FROM system_service_configs WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

async function listRoles() {
  const [rows] = await pool.query(
    `SELECT r.id, r.role_name AS roleName, r.role_code AS roleCode, r.role_type AS roleType,
            r.permissions_json AS permissions, r.status, r.is_system AS isSystem,
            r.created_at AS createdAt, r.updated_at AS updatedAt,
            COUNT(u.id) AS userCount
     FROM system_roles r
     LEFT JOIN users u ON u.role_id = r.id
     GROUP BY r.id, r.role_name, r.role_code, r.role_type, r.permissions_json, r.status, r.is_system, r.created_at, r.updated_at
     ORDER BY r.is_system DESC, r.id ASC`
  );

  return rows.map(mapRoleRow);
}

async function getRoleById(id) {
  const [rows] = await pool.query(
    `SELECT id, role_name AS roleName, role_code AS roleCode, role_type AS roleType,
            permissions_json AS permissions, status, is_system AS isSystem,
            created_at AS createdAt, updated_at AS updatedAt
     FROM system_roles
     WHERE id = ? LIMIT 1`,
    [id]
  );

  return rows[0] ? mapRoleRow(rows[0]) : null;
}

async function getRoleByCode(roleCode) {
  const [rows] = await pool.query(
    `SELECT id, role_name AS roleName, role_code AS roleCode, role_type AS roleType,
            permissions_json AS permissions, status, is_system AS isSystem,
            created_at AS createdAt, updated_at AS updatedAt
     FROM system_roles
     WHERE role_code = ? LIMIT 1`,
    [roleCode]
  );

  return rows[0] ? mapRoleRow(rows[0]) : null;
}

async function createRole(payload) {
  const [result] = await pool.query(
    `INSERT INTO system_roles (role_name, role_code, role_type, permissions_json, status, is_system)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      payload.roleName,
      payload.roleCode,
      payload.roleType,
      JSON.stringify(payload.permissions || { modules: [] }),
      payload.status,
      payload.isSystem ? 1 : 0
    ]
  );

  return getRoleById(result.insertId);
}

async function updateRole(id, payload) {
  const [result] = await pool.query(
    `UPDATE system_roles
     SET role_name = ?, role_code = ?, role_type = ?, permissions_json = ?, status = ?
     WHERE id = ?`,
    [
      payload.roleName,
      payload.roleCode,
      payload.roleType,
      JSON.stringify(payload.permissions || { modules: [] }),
      payload.status,
      id
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getRoleById(id);
}

async function deleteRole(id) {
  const [result] = await pool.query("DELETE FROM system_roles WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

async function countUsersByRoleId(roleId) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM users WHERE role_id = ?",
    [roleId]
  );

  return Number(rows[0]?.total || 0);
}

async function listUsers() {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.display_name AS displayName, u.role_id AS roleId,
            COALESCE(r.role_code, u.role_code) AS roleCode, r.role_type AS roleType, r.role_name AS roleName,
            r.permissions_json AS permissions, u.status,
            u.created_at AS createdAt, u.updated_at AS updatedAt
     FROM users u
     LEFT JOIN system_roles r ON u.role_id = r.id OR (u.role_id IS NULL AND u.role_code = r.role_code)
     ORDER BY u.id DESC`
  );

  return rows.map(mapUserRow);
}

async function getUserById(id) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.display_name AS displayName, u.role_id AS roleId,
            COALESCE(r.role_code, u.role_code) AS roleCode, r.role_type AS roleType, r.role_name AS roleName,
            r.permissions_json AS permissions, u.status,
            u.created_at AS createdAt, u.updated_at AS updatedAt
     FROM users u
     LEFT JOIN system_roles r ON u.role_id = r.id OR (u.role_id IS NULL AND u.role_code = r.role_code)
     WHERE u.id = ? LIMIT 1`,
    [id]
  );

  return rows[0] ? mapUserRow(rows[0]) : null;
}

async function getUserCredentialByUsername(username) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.password_hash AS passwordHash, u.display_name AS displayName,
            u.role_id AS roleId, COALESCE(r.role_code, u.role_code) AS roleCode, r.role_type AS roleType, r.role_name AS roleName,
            r.permissions_json AS permissions, u.status
     FROM users u
     LEFT JOIN system_roles r ON u.role_id = r.id OR (u.role_id IS NULL AND u.role_code = r.role_code)
     WHERE u.username = ? LIMIT 1`,
    [username]
  );

  return rows[0]
    ? {
        ...rows[0],
        permissions: normalizeRolePermissions({
          roleCode: rows[0].roleCode,
          roleType: rows[0].roleType,
          permissions: rows[0].permissions,
        })
      }
    : null;
}

async function countActiveAdminUsers() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users
     WHERE role_code = 'admin' AND status = 'active'`
  );

  return Number(rows[0]?.total || 0);
}

async function createUser(payload) {
  const [result] = await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role_id, role_code, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [payload.username, payload.passwordHash, payload.displayName, payload.roleId || null, payload.roleCode, payload.status]
  );

  return getUserById(result.insertId);
}

async function updateUser(id, payload) {
  const params = [payload.username, payload.displayName, payload.roleId || null, payload.roleCode, payload.status];
  let sql = `UPDATE users
             SET username = ?, display_name = ?, role_id = ?, role_code = ?, status = ?`;

  if (payload.passwordHash) {
    sql += ", password_hash = ?";
    params.push(payload.passwordHash);
  }

  sql += " WHERE id = ?";
  params.push(id);

  const [result] = await pool.query(sql, params);

  if (result.affectedRows === 0) {
    return null;
  }

  return getUserById(id);
}

async function deleteUser(id) {
  const [result] = await pool.query("DELETE FROM users WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

module.exports = {
  listServiceConfigs,
  getServiceConfigById,
  getServiceConfigByKey,
  createServiceConfig,
  updateServiceConfig,
  deleteServiceConfig,
  listRoles,
  getRoleById,
  getRoleByCode,
  createRole,
  updateRole,
  deleteRole,
  countUsersByRoleId,
  listUsers,
  getUserById,
  getUserCredentialByUsername,
  countActiveAdminUsers,
  createUser,
  updateUser,
  deleteUser
};
