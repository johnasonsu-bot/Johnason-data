function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeRolePermissions(role) {
  const parsed = parseJsonObject(role?.permissions);
  const modules = Array.isArray(parsed.modules) ? parsed.modules.filter(Boolean) : [];
  const permissions = {
    modules: Array.from(new Set(modules.map((moduleName) => moduleName === "lab" ? "data_modeling" : moduleName))),
  };
  if (parsed.mode === "readonly") permissions.mode = "readonly";
  if (Array.isArray(parsed.actions)) permissions.actions = parsed.actions.filter(Boolean);
  if (String(role?.roleCode || "").toLowerCase() === "viewer" || String(role?.roleType || "").toLowerCase() === "viewer") {
    return { ...permissions, mode: "readonly", actions: ["read"] };
  }
  return permissions;
}

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
    permissions: normalizeRolePermissions(row),
    status: row.status,
  };
}

function createAuthRepository({ getDatabaseRuntime }) {
  if (typeof getDatabaseRuntime !== "function") throw new TypeError("Auth repository requires getDatabaseRuntime");

  function pool() {
    return getDatabaseRuntime().pool;
  }

  async function findByUsername(username) {
    const [rows] = await pool().query(
      `SELECT u.id, u.username, u.password_hash AS passwordHash, u.display_name AS displayName,
              u.role_id AS roleId, COALESCE(r.role_code, u.role_code) AS roleCode,
              u.default_project_id AS defaultProjectId,
              r.role_type AS roleType, r.role_name AS roleName, r.permissions_json AS permissions, u.status
       FROM users u
       LEFT JOIN system_roles r ON u.role_id = r.id OR (u.role_id IS NULL AND u.role_code = r.role_code)
       WHERE u.username = ? LIMIT 1`,
      [username],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async function findProfileById(id) {
    const [rows] = await pool().query(
      `SELECT u.id, u.username, u.display_name AS displayName, u.role_id AS roleId,
              COALESCE(r.role_code, u.role_code) AS roleCode,
              u.default_project_id AS defaultProjectId,
              r.role_type AS roleType, r.role_name AS roleName, r.permissions_json AS permissions, u.status
       FROM users u
       LEFT JOIN system_roles r ON u.role_id = r.id OR (u.role_id IS NULL AND u.role_code = r.role_code)
       WHERE u.id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  return Object.freeze({ findByUsername, findProfileById });
}

module.exports = { createAuthRepository, mapUser, normalizeRolePermissions };
