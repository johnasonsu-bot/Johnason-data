var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// backend/src/common/utils/response.js
var require_response = __commonJS({
  "backend/src/common/utils/response.js"(exports2, module2) {
    function sendSuccess(res, data, meta, statusCode = 200) {
      return res.status(statusCode).json({ success: true, data, meta });
    }
    module2.exports = {
      sendSuccess
    };
  }
});

// backend/src/common/errors/app-error.js
var require_app_error = __commonJS({
  "backend/src/common/errors/app-error.js"(exports2, module2) {
    var AppError = class extends Error {
      constructor(message, statusCode, details) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.details = details;
      }
    };
    module2.exports = AppError;
  }
});

// runtime-port:config
var require_config = __commonJS({
  "runtime-port:config"(exports2, module2) {
    var { createRuntimeConfigProxy } = require("@johnason/data-platform-core-kernel");
    module2.exports = createRuntimeConfigProxy();
  }
});

// runtime-port:database
var require_database = __commonJS({
  "runtime-port:database"(exports2, module2) {
    var { createDatabasePoolProxy } = require("@johnason/data-platform-core-kernel");
    var pool = createDatabasePoolProxy();
    module2.exports = { pool, testConnection: async () => {
      const c = await pool.getConnection();
      c.release();
    } };
  }
});

// backend/src/common/utils/user-permissions.js
var require_user_permissions = __commonJS({
  "backend/src/common/utils/user-permissions.js"(exports2, module2) {
    function parseJsonObject(value) {
      if (!value) {
        return {};
      }
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch {
          return {};
        }
      }
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }
    function normalizePermissions(permissions) {
      const parsed = parseJsonObject(permissions);
      const modules = Array.isArray(parsed.modules) ? parsed.modules.filter(Boolean) : [];
      const normalizedModules = modules.map((moduleName) => moduleName === "lab" ? "data_modeling" : moduleName);
      return {
        modules: Array.from(new Set(normalizedModules)),
        mode: parsed.mode === "readonly" ? "readonly" : void 0,
        actions: Array.isArray(parsed.actions) ? parsed.actions.filter(Boolean) : void 0
      };
    }
    function normalizeRolePermissions(role) {
      const permissions = normalizePermissions(role?.permissions);
      const roleCode = String(role?.roleCode || "").toLowerCase();
      const roleType = String(role?.roleType || "").toLowerCase();
      if (roleCode === "viewer" || roleType === "viewer") {
        return {
          ...permissions,
          mode: "readonly",
          actions: ["read"]
        };
      }
      return permissions;
    }
    function isReadOnlyUser(user) {
      const permissions = normalizeRolePermissions(user);
      const roleCode = String(user?.roleCode || "").toLowerCase();
      const roleType = String(user?.roleType || "").toLowerCase();
      return roleCode === "viewer" || roleType === "viewer" || permissions.mode === "readonly";
    }
    function hasAnyModulePermission(user, requiredModules) {
      const required = Array.isArray(requiredModules) ? requiredModules.filter(Boolean) : [requiredModules].filter(Boolean);
      if (required.length === 0) {
        return true;
      }
      const modules = new Set(normalizeRolePermissions(user).modules || []);
      return required.some((moduleName) => modules.has(moduleName));
    }
    function getRequiredModulesForApiPath(pathname) {
      const path = String(pathname || "").split("?")[0];
      if (!path.startsWith("/api/")) return [];
      if (path === "/api/auth/profile" || path.startsWith("/api/v1/auth/")) return [];
      if (path === "/api/v1/projects/my") return [];
      const rules = [
        ["/api/v1/projects", ["system_projects"]],
        ["/api/v1/platform", ["overview"]],
        ["/api/v1/asset-search", ["data_map", "ingestion", "quality", "services"]],
        ["/api/v1/data-map", ["data_map"]],
        ["/api/v1/data-standards", ["standards"]],
        ["/api/v1/data-sources", ["ingestion"]],
        ["/api/v1/data-source-research", ["ingestion"]],
        ["/api/v1/ingestion-tasks", ["ingestion"]],
        ["/api/v1/file-imports", ["ingestion"]],
        ["/api/v1/ingestion-ai-configs", ["ingestion"]],
        ["/api/v1/data-modeling-sources", ["data_modeling"]],
        ["/api/v1/data-development", ["ingestion"]],
        ["/api/v1/data-modeling", ["data_modeling"]],
        ["/api/v1/quality-control", ["quality"]],
        ["/api/v1/data-services", ["services"]],
        ["/api/v1/reporting-ai-configs", ["reporting"]],
        ["/api/v1/reporting", ["reporting"]],
        ["/api/v1/dev-ai-configs", ["ingestion"]],
        ["/api/v1/model-providers", ["system_models", "data_map", "standards", "ingestion", "quality", "processing", "services", "reporting", "data_modeling"]]
      ];
      if (path.startsWith("/api/v1/system-management/services")) return ["system_services"];
      if (path.startsWith("/api/v1/system-management/database-drivers")) return ["system_services"];
      if (path.startsWith("/api/v1/system-management/roles")) return ["system_roles"];
      if (path.startsWith("/api/v1/system-management/users")) return ["system_users"];
      if (path.startsWith("/api/v1/system-management/resources")) return ["system_services", "system_users", "system_roles", "system_models"];
      if (path.startsWith("/api/v1/system-management/database-architecture")) return ["system_services"];
      const matched = rules.find(([prefix]) => path.startsWith(prefix));
      return matched ? matched[1] : [];
    }
    var READ_ONLY_ALLOWED_WRITES = [
      /^\/api\/v1\/auth\/logout$/,
      /^\/api\/auth\/logout$/,
      /^\/api\/v1\/asset-search\/search$/,
      /^\/api\/v1\/asset-search\/business-data\/search$/,
      /^\/api\/v1\/data-development\/processing\/jobs\/preview$/,
      /^\/api\/v1\/data-development\/processing\/jobs\/\d+\/preview$/,
      /^\/api\/v1\/reporting\/datasets\/preview$/,
      /^\/api\/v1\/reporting\/dashboards\/preview-chart$/,
      /^\/api\/v1\/reporting\/runtime\/dashboards\/\d+\/preview-chart$/
    ];
    function isReadOnlyAllowedRequest(method, pathname) {
      const normalizedMethod = String(method || "GET").toUpperCase();
      if (["GET", "HEAD", "OPTIONS"].includes(normalizedMethod)) {
        return true;
      }
      const path = String(pathname || "").split("?")[0];
      return READ_ONLY_ALLOWED_WRITES.some((pattern) => pattern.test(path));
    }
    module2.exports = {
      getRequiredModulesForApiPath,
      hasAnyModulePermission,
      isReadOnlyAllowedRequest,
      isReadOnlyUser,
      normalizePermissions,
      normalizeRolePermissions
    };
  }
});

// backend/src/modules/system-management/system-management.repository.js
var require_system_management_repository = __commonJS({
  "backend/src/modules/system-management/system-management.repository.js"(exports2, module2) {
    var { pool } = require_database();
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
    var { normalizeRolePermissions } = require_user_permissions();
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
          permissions: row.permissions
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
          permissions: row.permissions
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
      return rows[0] ? {
        ...rows[0],
        permissions: normalizeRolePermissions({
          roleCode: rows[0].roleCode,
          roleType: rows[0].roleType,
          permissions: rows[0].permissions
        })
      } : null;
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
    module2.exports = {
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
  }
});

// backend/src/modules/project-spaces/project-space.repository.js
var require_project_space_repository = __commonJS({
  "backend/src/modules/project-spaces/project-space.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var DEFAULT_PROJECT_CODE = "default";
    var SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_]+$/;
    var EXTRA_PROJECT_DELETE_STATEMENTS = [
      {
        sql: `DELETE FROM lab_operation_log
          WHERE scene_id IN (SELECT id FROM lab_scene WHERE project_id = ?)`,
        params: (projectId) => [projectId]
      },
      {
        sql: `DELETE FROM reporting_ai_runs
          WHERE source_id IN (SELECT id FROM report_data_sources WHERE project_id = ?)
             OR chart_asset_id IN (SELECT id FROM report_chart_assets WHERE project_id = ?)`,
        params: (projectId) => [projectId, projectId]
      },
      {
        sql: `DELETE FROM ingestion_jobs
          WHERE source_id IN (SELECT id FROM data_sources WHERE project_id = ?)`,
        params: (projectId) => [projectId]
      }
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
        memberCount: row.memberCount === void 0 ? void 0 : Number(row.memberCount || 0),
        createdBy: row.createdBy || "system",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
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
        updatedAt: row.updatedAt
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
      return rows.map((row) => String(row.tableName || "")).filter((tableName) => SAFE_IDENTIFIER_PATTERN.test(tableName));
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
        parentTable: String(row.parentTable || "")
      }));
    }
    function buildProjectScopedDeleteOrder(tableNames, dependencies) {
      const sortedTables = [...tableNames].sort((left, right) => left.localeCompare(right));
      const inboundCounts = new Map(sortedTables.map((tableName) => [tableName, 0]));
      const adjacency = new Map(sortedTables.map((tableName) => [tableName, /* @__PURE__ */ new Set()]));
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
      const visited = /* @__PURE__ */ new Set();
      const topologicalOrder = [];
      while (queue.length > 0) {
        queue.sort((left, right) => left.localeCompare(right));
        const tableName = queue.shift();
        if (!tableName || visited.has(tableName)) {
          continue;
        }
        visited.add(tableName);
        topologicalOrder.push(tableName);
        const children = [...adjacency.get(tableName) || []].sort((left, right) => left.localeCompare(right));
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
     VALUES ('\u9ED8\u8BA4\u9879\u76EE', ?, 'standard', '\u5386\u53F2\u6570\u636E\u548C\u672A\u6307\u5B9A\u9879\u76EE\u7684\u9ED8\u8BA4\u5DE5\u4F5C\u7A7A\u95F4', ?, ?, 'active', JSON_OBJECT(), JSON_OBJECT(), 'system')`,
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
          user?.username || "system"
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
          id
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
          payload.status || "active"
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
    module2.exports = {
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
      deleteProjectScopedAssets
    };
  }
});

// backend/src/modules/system-management/system-management.runtime.js
var require_system_management_runtime = __commonJS({
  "backend/src/modules/system-management/system-management.runtime.js"(exports2, module2) {
    var fs = require("fs");
    var os = require("os");
    var net = require("net");
    var { promisify } = require("util");
    var { execFile, spawn } = require("child_process");
    var execFileAsync = promisify(execFile);
    var RESOURCE_SAMPLE_INTERVAL_MS = 15e3;
    var RESOURCE_PERIODS = {
      "15m": 15 * 60 * 1e3,
      "1h": 60 * 60 * 1e3,
      "6h": 6 * 60 * 60 * 1e3,
      "24h": 24 * 60 * 60 * 1e3
    };
    var latestSystemResourceSnapshot = null;
    var resourceSamplerStarted = false;
    var resourceSamplingPromise = null;
    var resourceHistory = [];
    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    function escapePowerShell(input) {
      return String(input || "").replace(/'/g, "''");
    }
    function isLocalHost(host) {
      const normalized = String(host || "").trim().toLowerCase();
      return !normalized || normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
    }
    async function runPowerShell(command, timeout = 2e4) {
      const { stdout, stderr } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-Command", command],
        {
          timeout,
          windowsHide: true,
          maxBuffer: 1024 * 1024 * 8
        }
      );
      return {
        stdout: String(stdout || "").trim(),
        stderr: String(stderr || "").trim()
      };
    }
    async function runCommand(filePath, args = [], options = {}) {
      const { stdout, stderr } = await execFileAsync(filePath, args, {
        timeout: options.timeout || 3e4,
        cwd: options.cwd,
        windowsHide: true,
        env: {
          ...process.env,
          ...options.env || {}
        },
        maxBuffer: 1024 * 1024 * 8
      });
      return {
        stdout: String(stdout || "").trim(),
        stderr: String(stderr || "").trim()
      };
    }
    function spawnDetached(filePath, args = [], options = {}) {
      const child = spawn(filePath, args, {
        cwd: options.cwd,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: {
          ...process.env,
          ...options.env || {}
        }
      });
      child.unref();
      return child.pid;
    }
    async function waitForPort(host, port, timeoutMs = 2e4) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const reachable = await checkPortReachable(host, port, 1200);
        if (reachable) {
          return true;
        }
        await sleep(500);
      }
      return false;
    }
    async function checkPortReachable(host, port, timeoutMs = 1500) {
      if (!host || !port) {
        return false;
      }
      return new Promise((resolve) => {
        const socket = new net.Socket();
        const done = (value) => {
          socket.destroy();
          resolve(value);
        };
        socket.setTimeout(timeoutMs);
        socket.once("connect", () => done(true));
        socket.once("timeout", () => done(false));
        socket.once("error", () => done(false));
        socket.connect(port, host);
      });
    }
    async function checkHttpReady(url, timeoutMs = 3e3) {
      if (!url) {
        return false;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: "GET",
          signal: controller.signal
        });
        return response.ok;
      } catch (error) {
        return false;
      } finally {
        clearTimeout(timer);
      }
    }
    async function getPortListenerDetails(port) {
      if (!port) {
        return null;
      }
      const command = `
    $listener = Get-NetTCPConnection -State Listen -LocalPort ${Number(port)} -ErrorAction SilentlyContinue | Select-Object -First 1 OwningProcess;
    if (-not $listener) { return }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" |
      Select-Object ProcessId, Name, CommandLine;
    $process | ConvertTo-Json -Compress
  `;
      try {
        const { stdout } = await runPowerShell(command);
        return stdout ? JSON.parse(stdout) : null;
      } catch (error) {
        return null;
      }
    }
    async function getDockerContainerState(containerName) {
      if (!containerName) {
        return null;
      }
      try {
        const { stdout } = await runCommand("docker", [
          "inspect",
          "--format",
          "{{json .State}}",
          containerName
        ], { timeout: 15e3 });
        return stdout ? JSON.parse(stdout) : null;
      } catch (error) {
        return null;
      }
    }
    async function getComposeServiceState(projectName) {
      if (!projectName) {
        return { running: false, containers: [], hasRunning: false, hasDegraded: false };
      }
      try {
        const { stdout } = await runCommand("docker", [
          "ps",
          "-a",
          "--filter",
          `label=com.docker.compose.project=${projectName}`,
          "--format",
          "{{.Names}}	{{.State}}	{{.Status}}"
        ], { timeout: 15e3 });
        const containers = stdout ? stdout.split(/\r?\n/).filter(Boolean).map((line) => {
          const [name, state, status] = line.split("	");
          return { name, state, status };
        }) : [];
        const hasRunning = containers.some((item) => item.state === "running");
        const hasDegraded = containers.some((item) => item.state === "restarting" || item.state === "exited" || item.state === "dead");
        return {
          running: hasRunning,
          containers,
          hasRunning,
          hasDegraded
        };
      } catch (error) {
        return { running: false, containers: [], hasRunning: false, hasDegraded: false };
      }
    }
    async function readDisks() {
      try {
        const { stdout } = await runPowerShell(
          'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID, VolumeName, Size, FreeSpace | ConvertTo-Json -Compress',
          15e3
        );
        if (!stdout) {
          return [];
        }
        const parsed = JSON.parse(stdout);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        return items.map((item) => {
          const size = Number(item.Size || 0);
          const free = Number(item.FreeSpace || 0);
          const used = Math.max(size - free, 0);
          return {
            name: item.DeviceID,
            label: item.VolumeName || item.DeviceID,
            size,
            free,
            used,
            usedPercent: size > 0 ? Number((used / size * 100).toFixed(2)) : 0
          };
        });
      } catch (error) {
        return [];
      }
    }
    function getDiskMaxUsage(disks = []) {
      return disks.reduce((max, disk) => Math.max(max, Number(disk.usedPercent || 0)), 0);
    }
    function normalizeResourcePeriod(period) {
      return Object.prototype.hasOwnProperty.call(RESOURCE_PERIODS, period) ? period : "1h";
    }
    function pruneResourceHistory(now = Date.now()) {
      const cutoff = now - RESOURCE_PERIODS["24h"];
      while (resourceHistory.length > 0) {
        const sampleTime = Date.parse(resourceHistory[0].timestamp);
        if (!Number.isNaN(sampleTime) && sampleTime >= cutoff) {
          break;
        }
        resourceHistory.shift();
      }
    }
    async function sampleCpuUsage() {
      const first = os.cpus();
      await sleep(200);
      const second = os.cpus();
      let idle = 0;
      let total = 0;
      for (let index = 0; index < first.length; index += 1) {
        const firstTimes = first[index].times;
        const secondTimes = second[index].times;
        const idleDiff = secondTimes.idle - firstTimes.idle;
        const totalDiff = Object.keys(firstTimes).reduce(
          (sum, key) => sum + (secondTimes[key] - firstTimes[key]),
          0
        );
        idle += idleDiff;
        total += totalDiff;
      }
      if (!total) {
        return 0;
      }
      return Number(((total - idle) / total * 100).toFixed(2));
    }
    async function collectBaseSystemResources() {
      const cpuUsage = await sampleCpuUsage();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const disks = await readDisks();
      const sampledAt = (/* @__PURE__ */ new Date()).toISOString();
      return {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        uptimeSeconds: os.uptime(),
        cpuUsage,
        totalMemory,
        freeMemory,
        usedMemory: totalMemory - freeMemory,
        memoryUsage: totalMemory > 0 ? Number(((totalMemory - freeMemory) / totalMemory * 100).toFixed(2)) : 0,
        disks,
        managedProcesses: [],
        sampledAt
      };
    }
    async function collectResourceSample(force = false) {
      if (resourceSamplingPromise && !force) {
        return resourceSamplingPromise;
      }
      resourceSamplingPromise = (async () => {
        const snapshot = await collectBaseSystemResources();
        latestSystemResourceSnapshot = snapshot;
        resourceHistory.push({
          timestamp: snapshot.sampledAt,
          cpuUsage: snapshot.cpuUsage,
          memoryUsage: snapshot.memoryUsage,
          usedMemory: snapshot.usedMemory,
          totalMemory: snapshot.totalMemory,
          diskMaxUsage: getDiskMaxUsage(snapshot.disks)
        });
        pruneResourceHistory(Date.parse(snapshot.sampledAt));
        return snapshot;
      })();
      try {
        return await resourceSamplingPromise;
      } finally {
        resourceSamplingPromise = null;
      }
    }
    function ensureResourceSamplerStarted() {
      if (resourceSamplerStarted) {
        return;
      }
      resourceSamplerStarted = true;
      void collectResourceSample(true).catch(() => {
      });
      const timer = setInterval(() => {
        void collectResourceSample(true).catch(() => {
        });
      }, RESOURCE_SAMPLE_INTERVAL_MS);
      if (typeof timer.unref === "function") {
        timer.unref();
      }
    }
    async function getResourceSnapshot(period = "1h") {
      ensureResourceSamplerStarted();
      const normalizedPeriod = normalizeResourcePeriod(period);
      const latestTimestamp = latestSystemResourceSnapshot?.sampledAt ? Date.parse(latestSystemResourceSnapshot.sampledAt) : NaN;
      const needsRefresh = !latestSystemResourceSnapshot || Number.isNaN(latestTimestamp) || Date.now() - latestTimestamp > RESOURCE_SAMPLE_INTERVAL_MS * 2;
      const snapshot = needsRefresh ? await collectResourceSample() : latestSystemResourceSnapshot;
      const cutoff = Date.now() - RESOURCE_PERIODS[normalizedPeriod];
      const history = resourceHistory.filter((item) => {
        const sampleTime = Date.parse(item.timestamp);
        return !Number.isNaN(sampleTime) && sampleTime >= cutoff;
      });
      return {
        ...snapshot,
        history,
        historyPeriod: normalizedPeriod,
        sampleIntervalSeconds: Math.round(RESOURCE_SAMPLE_INTERVAL_MS / 1e3),
        collectedSamples: resourceHistory.length
      };
    }
    function cleanupPidFiles(config) {
      for (const filePath of config.pidFiles || []) {
        try {
          if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (error) {
        }
      }
    }
    async function stopNodeProcessesByPatterns(patterns = []) {
      const filters = patterns.filter(Boolean).map((item) => `$_.CommandLine -match '${escapePowerShell(item)}'`).join(" -or ");
      if (!filters) {
        return;
      }
      const command = `
    $targets = Get-CimInstance Win32_Process |
      Where-Object {
        $_.Name -eq 'node.exe' -and $_.CommandLine -and (${filters})
      };
    foreach ($target in $targets) {
      Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue;
    }
  `;
      await runPowerShell(command, 2e4);
    }
    async function stopProcessByExecutablePath(executablePath) {
      if (!executablePath) {
        return;
      }
      const command = `
    $targets = Get-CimInstance Win32_Process |
      Where-Object {
        $_.ExecutablePath -eq '${escapePowerShell(executablePath)}'
      };
    foreach ($target in $targets) {
      Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue;
    }
  `;
      await runPowerShell(command, 2e4);
    }
    async function stopProcessByPort(port) {
      if (!port) {
        return;
      }
      const command = `
    $targets = Get-NetTCPConnection -LocalPort ${Number(port)} -ErrorAction SilentlyContinue |
      Where-Object { $_.State -eq 'Listen' } |
      Select-Object -ExpandProperty OwningProcess -Unique;
    foreach ($target in $targets) {
      Stop-Process -Id $target -Force -ErrorAction SilentlyContinue;
    }
  `;
      await runPowerShell(command, 2e4);
    }
    async function stopProcessById(processId) {
      if (!processId) {
        return;
      }
      await runPowerShell(`Stop-Process -Id ${Number(processId)} -Force -ErrorAction SilentlyContinue`, 1e4);
    }
    async function getServiceRuntime(service) {
      const host = service.host || "127.0.0.1";
      const reachable = service.port ? await checkPortReachable(host, Number(service.port)) : false;
      const ready = service.config?.readyUrl ? await checkHttpReady(service.config.readyUrl) : reachable;
      const localPortInfo = service.port && isLocalHost(host) ? await getPortListenerDetails(Number(service.port)) : null;
      let runtime = {
        state: ready ? "running" : reachable ? "degraded" : "stopped",
        reachable,
        ready,
        host,
        port: service.port || null,
        pid: localPortInfo?.ProcessId || null,
        processName: localPortInfo?.Name || null,
        commandLine: localPortInfo?.CommandLine || null,
        readyUrl: service.config?.readyUrl || null
      };
      if (service.manageMode === "docker") {
        const state = await getDockerContainerState(service.config?.containerName);
        const containerActive = Boolean(state?.Running || state?.Status === "restarting");
        const healthStatus = state?.Health?.Status || null;
        const containerReady = ready || healthStatus === "healthy" || Boolean(state?.Running) && !healthStatus && !service.config?.readyUrl;
        runtime = {
          ...runtime,
          state: containerReady ? "running" : containerActive ? "degraded" : "stopped",
          reachable: reachable || Boolean(state?.Running),
          ready: containerReady,
          containerName: service.config?.containerName || null,
          containerStatus: state?.Status || null,
          healthStatus
        };
      }
      if (service.manageMode === "docker_compose") {
        const composeState = await getComposeServiceState(service.config?.projectName);
        runtime = {
          ...runtime,
          state: ready ? "running" : composeState.hasRunning || composeState.hasDegraded ? "degraded" : "stopped",
          reachable: reachable || composeState.hasRunning,
          ready,
          containers: composeState.containers.map((item) => item.name),
          containerDetails: composeState.containers,
          projectName: service.config?.projectName || null
        };
      }
      return runtime;
    }
    async function startLocalProcess(service) {
      cleanupPidFiles(service.config || {});
      const executablePath = service.config?.executablePath;
      const workingDirectory = service.config?.workingDirectory;
      const args = Array.isArray(service.config?.args) ? service.config.args.map((item) => String(item)) : [];
      if (!executablePath) {
        throw new Error(`\u670D\u52A1 ${service.serviceName} \u7F3A\u5C11 executablePath \u914D\u7F6E`);
      }
      spawnDetached(executablePath, args, {
        cwd: workingDirectory,
        env: service.config?.env || {}
      });
      if (service.port && isLocalHost(service.host)) {
        await waitForPort(service.host || "127.0.0.1", Number(service.port), 3e4);
      }
    }
    async function startDockerService(service) {
      const containerName = service.config?.containerName;
      const image = service.config?.image;
      const runArgs = Array.isArray(service.config?.runArgs) ? service.config.runArgs : [];
      const state = await getDockerContainerState(containerName);
      if (state) {
        await runCommand("docker", ["start", containerName], { timeout: 6e4 });
      } else {
        await runCommand("docker", ["run", "-d", "--name", containerName, ...runArgs, image], { timeout: 12e4 });
      }
      if (service.port && isLocalHost(service.host)) {
        await waitForPort(service.host || "127.0.0.1", Number(service.port), 12e4);
      }
    }
    async function startComposeService(service) {
      await runCommand(
        "docker",
        ["compose", "-p", service.config?.projectName, "up", "-d"],
        {
          cwd: service.config?.workingDirectory,
          timeout: 12e4,
          env: {
            DEBUG: "false",
            FLASK_DEBUG: "false"
          }
        }
      );
      if (service.port && isLocalHost(service.host)) {
        await waitForPort(service.host || "127.0.0.1", Number(service.port), 18e4);
      }
    }
    async function stopLocalProcess(service, options = {}) {
      if (options.processId) {
        await stopProcessById(options.processId);
        return;
      }
      const patterns = service.config?.commandLinePatterns || [];
      if (service.serviceType === "backend" || service.serviceType === "frontend") {
        await stopNodeProcessesByPatterns(patterns);
        return;
      }
      if (service.serviceType === "mysql") {
        await stopProcessByExecutablePath(service.config?.executablePath);
        return;
      }
      if (service.port && isLocalHost(service.host)) {
        await stopProcessByPort(Number(service.port));
      }
    }
    async function stopDockerService(service) {
      const containerName = service.config?.containerName;
      if (!containerName) {
        return;
      }
      const state = await getDockerContainerState(containerName);
      if (!state) {
        return;
      }
      await runCommand("docker", ["stop", containerName], { timeout: 6e4 });
    }
    async function stopComposeService(service) {
      await runCommand(
        "docker",
        ["compose", "-p", service.config?.projectName, "stop"],
        {
          cwd: service.config?.workingDirectory,
          timeout: 12e4,
          env: {
            DEBUG: "false",
            FLASK_DEBUG: "false"
          }
        }
      );
    }
    async function runCustomServiceCommand(service, action) {
      const commandMap = {
        start: service.config?.startCommand,
        stop: service.config?.stopCommand,
        restart: service.config?.restartCommand
      };
      const command = commandMap[action];
      if (!command) {
        throw new Error(`\u670D\u52A1 ${service.serviceName} \u672A\u914D\u7F6E ${action}Command`);
      }
      await runPowerShell(command, 12e4);
    }
    async function startManagedService(service) {
      if (service.manageMode === "process") {
        return startLocalProcess(service);
      }
      if (service.manageMode === "docker") {
        return startDockerService(service);
      }
      if (service.manageMode === "docker_compose") {
        return startComposeService(service);
      }
      return runCustomServiceCommand(service, "start");
    }
    async function stopManagedService(service, options = {}) {
      if (service.manageMode === "process") {
        return stopLocalProcess(service, options);
      }
      if (service.manageMode === "docker") {
        return stopDockerService(service);
      }
      if (service.manageMode === "docker_compose") {
        return stopComposeService(service);
      }
      return runCustomServiceCommand(service, "stop");
    }
    async function restartManagedService(service, options = {}) {
      await stopManagedService(service, options);
      await sleep(1e3);
      await startManagedService(service);
    }
    async function readSystemResources(managedServices = []) {
      const snapshot = await getResourceSnapshot();
      const managedProcesses = managedServices.filter((item) => item.runtime?.pid).map((item) => ({
        serviceKey: item.serviceKey,
        serviceName: item.serviceName,
        pid: item.runtime.pid,
        port: item.runtime.port || null,
        processName: item.runtime.processName || null
      }));
      return {
        ...snapshot,
        managedProcesses
      };
    }
    module2.exports = {
      sleep,
      isLocalHost,
      spawnDetached,
      waitForPort,
      checkPortReachable,
      checkHttpReady,
      getDockerContainerState,
      getServiceRuntime,
      getResourceSnapshot,
      startManagedService,
      stopManagedService,
      restartManagedService,
      readSystemResources
    };
  }
});

// backend/src/modules/system-management/system-management.service.js
var require_system_management_service = __commonJS({
  "backend/src/modules/system-management/system-management.service.js"(exports2, module2) {
    var path = require("path");
    var bcrypt = require("bcryptjs");
    var { execFile } = require("child_process");
    var { promisify } = require("util");
    var AppError = require_app_error();
    var env = require_config();
    var repository = require_system_management_repository();
    var projectSpaceRepository = require_project_space_repository();
    var runtime = require_system_management_runtime();
    var AGENT_SCRIPT = path.resolve(__dirname, "../../scripts/system-service-agent.js");
    var KAFKA_DEMO_PUMP_SCRIPT = path.resolve(__dirname, "../../scripts/kafka-demo-pump.js");
    var execFileAsync = promisify(execFile);
    function normalizeConfig(payload = {}) {
      return payload.config || {};
    }
    function normalizeServicePayload(payload, existingRecord) {
      return {
        serviceKey: payload.serviceKey,
        serviceName: payload.serviceName,
        serviceCategory: payload.serviceCategory,
        serviceType: payload.serviceType,
        manageMode: payload.manageMode,
        host: payload.host || null,
        port: payload.port || null,
        autoStart: Boolean(payload.autoStart),
        status: payload.status,
        isCore: existingRecord?.isCore || false,
        notes: payload.notes || null,
        config: normalizeConfig(payload)
      };
    }
    function ensureMutableService(record) {
      if (!record) {
        throw new AppError("Service not found.", 404);
      }
    }
    function validateCoreServiceMutation(record, payload) {
      if (!record?.isCore) {
        return;
      }
      if (payload.serviceKey !== record.serviceKey || payload.serviceType !== record.serviceType || payload.manageMode !== record.manageMode) {
        throw new AppError("Core services cannot change key, type, or manage mode.", 400);
      }
    }
    async function listServices() {
      const services = await repository.listServiceConfigs();
      const enriched = await Promise.all(
        services.map(async (service) => ({
          ...service,
          runtime: await runtime.getServiceRuntime(service)
        }))
      );
      return enriched;
    }
    async function createService(payload) {
      const existing = await repository.getServiceConfigByKey(payload.serviceKey);
      if (existing) {
        throw new AppError("Service key already exists.", 409);
      }
      return repository.createServiceConfig(normalizeServicePayload(payload));
    }
    async function updateService(id, payload) {
      const existing = await repository.getServiceConfigById(id);
      ensureMutableService(existing);
      validateCoreServiceMutation(existing, payload);
      const conflict = await repository.getServiceConfigByKey(payload.serviceKey);
      if (conflict && conflict.id !== id) {
        throw new AppError("Service key already exists.", 409);
      }
      const row = await repository.updateServiceConfig(id, normalizeServicePayload(payload, existing));
      if (!row) {
        throw new AppError("Service not found.", 404);
      }
      return row;
    }
    async function deleteService(id) {
      const existing = await repository.getServiceConfigById(id);
      ensureMutableService(existing);
      if (existing.isCore) {
        throw new AppError("Core services cannot be deleted.", 400);
      }
      const deleted = await repository.deleteServiceConfig(id);
      if (!deleted) {
        throw new AppError("Service not found.", 404);
      }
    }
    async function getServiceOrThrow(id) {
      const service = await repository.getServiceConfigById(id);
      if (!service) {
        throw new AppError("Service not found.", 404);
      }
      return service;
    }
    function scheduleAgent(action, envOverrides) {
      runtime.spawnDetached(process.execPath, [AGENT_SCRIPT], {
        cwd: path.resolve(__dirname, "../../.."),
        env: {
          ACTION: action,
          NODE_ENV: env.nodeEnv,
          ...envOverrides
        }
      });
    }
    async function executeServiceAction(id, action) {
      const service = await getServiceOrThrow(id);
      if (!["start", "stop", "restart"].includes(action)) {
        throw new AppError("Unsupported service action.", 400);
      }
      if (service.serviceType === "backend") {
        if (action === "start") {
          throw new AppError("Cannot start the backend service from the current backend session.", 400);
        }
        scheduleAgent(action === "stop" ? "stop-service" : "restart-service", {
          SERVICE_JSON: JSON.stringify(service),
          TARGET_PID: String(process.pid)
        });
        return {
          accepted: true,
          action,
          serviceKey: service.serviceKey,
          message: action === "stop" ? "Backend stop request accepted." : "Backend restart request accepted."
        };
      }
      if (action === "start") {
        await runtime.startManagedService(service);
      } else if (action === "stop") {
        await runtime.stopManagedService(service);
      } else {
        await runtime.restartManagedService(service);
      }
      return {
        accepted: true,
        action,
        serviceKey: service.serviceKey,
        runtime: await runtime.getServiceRuntime(service)
      };
    }
    async function restartWebStack() {
      const backendService = await repository.getServiceConfigByKey("backend");
      const frontendService = await repository.getServiceConfigByKey("frontend");
      if (!backendService || !frontendService) {
        throw new AppError("Backend or frontend service config is missing.", 404);
      }
      scheduleAgent("restart-web-stack", {
        BACKEND_SERVICE_JSON: JSON.stringify(backendService),
        FRONTEND_SERVICE_JSON: JSON.stringify(frontendService),
        TARGET_PID: String(process.pid)
      });
      return {
        accepted: true,
        message: "Docker \u670D\u52A1\u6808\u91CD\u542F\u6307\u4EE4\u5DF2\u63D0\u4EA4\u3002"
      };
    }
    async function startDefaultServices() {
      const services = await repository.listServiceConfigs();
      const defaults = services.filter((item) => item.autoStart && item.status === "active" && item.serviceKey !== "backend");
      for (const service of defaults) {
        await runtime.startManagedService(service);
      }
      return {
        accepted: true,
        startedServiceKeys: defaults.map((item) => item.serviceKey)
      };
    }
    async function runKafkaDemoPump(payload = {}) {
      try {
        const { stdout } = await execFileAsync(process.execPath, [KAFKA_DEMO_PUMP_SCRIPT], {
          cwd: path.resolve(__dirname, "../../.."),
          windowsHide: true,
          timeout: 18e4,
          maxBuffer: 1024 * 1024 * 16,
          env: {
            ...process.env,
            DB_HOST: "127.0.0.1",
            DB_PORT: String(env.db.port),
            DB_USER: env.db.user,
            DB_PASSWORD: env.db.password,
            DB_NAME: env.db.database,
            ...payload.topic ? { KAFKA_TOPIC: String(payload.topic) } : {},
            ...payload.mysqlTable ? { MYSQL_TARGET_TABLE: String(payload.mysqlTable) } : {},
            ...payload.hiveTable ? { HIVE_TARGET_TABLE: String(payload.hiveTable) } : {},
            ...payload.maxMessages ? { KAFKA_MAX_MESSAGES: String(payload.maxMessages) } : {}
          }
        });
        return JSON.parse(String(stdout || "{}").trim() || "{}");
      } catch (error) {
        throw new AppError(`Kafka \u793A\u4F8B\u6267\u884C\u5931\u8D25: ${error.message}`, 500);
      }
    }
    async function listSystemUsers() {
      return repository.listUsers();
    }
    async function listSystemRoles() {
      return repository.listRoles();
    }
    async function resolveRoleOrThrow(roleId) {
      const role = await repository.getRoleById(roleId);
      if (!role) {
        throw new AppError("Role not found.", 400);
      }
      if (role.status !== "active") {
        throw new AppError("Inactive roles cannot be assigned to users.", 400);
      }
      return role;
    }
    function normalizeRolePayloadPermissions(payload) {
      const permissions = payload.permissions || { modules: [] };
      const roleCode = String(payload.roleCode || "").toLowerCase();
      const roleType = String(payload.roleType || "").toLowerCase();
      const modules = Array.isArray(permissions.modules) ? permissions.modules.filter(Boolean) : [];
      if (roleCode === "viewer" || roleType === "viewer") {
        return {
          modules,
          mode: "readonly",
          actions: ["read"]
        };
      }
      return { modules };
    }
    async function createSystemRole(payload) {
      const existing = await repository.getRoleByCode(payload.roleCode);
      if (existing) {
        throw new AppError("Role code already exists.", 409);
      }
      return repository.createRole({
        roleName: payload.roleName,
        roleCode: payload.roleCode,
        roleType: payload.roleType,
        permissions: normalizeRolePayloadPermissions(payload),
        status: payload.status,
        isSystem: false
      });
    }
    async function updateSystemRole(id, payload) {
      const existing = await repository.getRoleById(id);
      if (!existing) {
        throw new AppError("Role not found.", 404);
      }
      if (existing.isSystem && payload.roleCode !== existing.roleCode) {
        throw new AppError("System roles cannot change role code.", 400);
      }
      const conflict = await repository.getRoleByCode(payload.roleCode);
      if (conflict && conflict.id !== id) {
        throw new AppError("Role code already exists.", 409);
      }
      return repository.updateRole(id, {
        roleName: payload.roleName,
        roleCode: existing.isSystem ? existing.roleCode : payload.roleCode,
        roleType: payload.roleType,
        permissions: normalizeRolePayloadPermissions({
          ...payload,
          roleCode: existing.isSystem ? existing.roleCode : payload.roleCode
        }),
        status: payload.status
      });
    }
    async function deleteSystemRole(id) {
      const existing = await repository.getRoleById(id);
      if (!existing) {
        throw new AppError("Role not found.", 404);
      }
      if (existing.isSystem) {
        throw new AppError("Built-in system roles cannot be deleted.", 400);
      }
      const userCount = await repository.countUsersByRoleId(id);
      if (userCount > 0) {
        throw new AppError("The role is still assigned to users and cannot be deleted.", 409);
      }
      const deleted = await repository.deleteRole(id);
      if (!deleted) {
        throw new AppError("Role not found.", 404);
      }
    }
    async function createSystemUser(payload) {
      const existing = await repository.getUserCredentialByUsername(payload.username);
      if (existing) {
        throw new AppError("Username already exists.", 409);
      }
      const role = await resolveRoleOrThrow(payload.roleId);
      const passwordHash = await bcrypt.hash(payload.password, env.bcryptSaltRounds);
      const user = await repository.createUser({
        username: payload.username,
        passwordHash,
        displayName: payload.displayName,
        roleId: role.id,
        roleCode: role.roleCode,
        status: payload.status
      });
      const defaultProject = await projectSpaceRepository.ensureDefaultProject();
      await projectSpaceRepository.ensureUserMembership(
        defaultProject.id,
        user.id,
        role.roleCode === "admin" ? "owner" : "developer"
      );
      return user;
    }
    async function updateSystemUser(id, payload, currentUser) {
      const existing = await repository.getUserById(id);
      if (!existing) {
        throw new AppError("User not found.", 404);
      }
      const conflict = await repository.getUserCredentialByUsername(payload.username);
      if (conflict && conflict.id !== id) {
        throw new AppError("Username already exists.", 409);
      }
      const role = await resolveRoleOrThrow(payload.roleId);
      if (existing.roleCode === "admin" && (payload.status !== "active" || role.roleCode !== "admin")) {
        const adminCount = await repository.countActiveAdminUsers();
        if (adminCount <= 1) {
          throw new AppError("At least one active admin account must remain.", 400);
        }
      }
      if (currentUser?.sub === id && payload.status !== "active") {
        throw new AppError("Cannot disable the currently signed-in user.", 400);
      }
      const passwordHash = payload.password ? await bcrypt.hash(payload.password, env.bcryptSaltRounds) : null;
      return repository.updateUser(id, {
        username: payload.username,
        displayName: payload.displayName,
        roleId: role.id,
        roleCode: role.roleCode,
        status: payload.status,
        passwordHash
      });
    }
    async function deleteSystemUser(id, currentUser) {
      const existing = await repository.getUserById(id);
      if (!existing) {
        throw new AppError("User not found.", 404);
      }
      if (currentUser?.sub === id) {
        throw new AppError("Cannot delete the currently signed-in user.", 400);
      }
      if (existing.roleCode === "admin") {
        const adminCount = await repository.countActiveAdminUsers();
        if (adminCount <= 1) {
          throw new AppError("At least one admin account must remain.", 400);
        }
      }
      const deleted = await repository.deleteUser(id);
      if (!deleted) {
        throw new AppError("User not found.", 404);
      }
    }
    async function getSystemResources(period) {
      return runtime.getResourceSnapshot(period);
    }
    async function getDatabaseArchitecture() {
      const mysqlService = await repository.getServiceConfigByKey("mysql");
      const mysqlRuntime = mysqlService ? await runtime.getServiceRuntime(mysqlService) : null;
      return {
        strategy: "\u5E73\u53F0\u5143\u6570\u636E\u5E93\u5F53\u524D\u7EDF\u4E00\u4F7F\u7528\u4E00\u5957 MySQL\uFF0C\u65B0\u80FD\u529B\u4F18\u5148\u5728\u73B0\u6709\u5B9E\u4F8B\u5185\u6309\u804C\u8D23\u6536\u53E3\u3002",
        instances: [
          {
            key: "mysql-meta",
            name: "Platform MySQL",
            engine: "mysql",
            host: env.db.host,
            port: env.db.port,
            status: mysqlRuntime?.state || "stopped",
            ready: mysqlRuntime?.reachable || false,
            databases: ["medata"],
            scope: "\u5E73\u53F0\u63A7\u5236\u9762\u4E0E\u4F20\u7EDF\u4E1A\u52A1\u578B\u5143\u6570\u636E",
            boundaries: ["\u7528\u6237\u4E0E\u6743\u9650", "\u7CFB\u7EDF\u670D\u52A1\u914D\u7F6E", "\u6570\u636E\u6E90\u7BA1\u7406", "\u63A5\u5165\u4EFB\u52A1\u914D\u7F6E"],
            services: [{ name: "MeData Backend", serviceKey: "backend", database: "medata", purpose: "\u5E73\u53F0\u4E3B\u5143\u6570\u636E\u5E93" }]
          }
        ],
        placementRules: [
          {
            category: "\u5E73\u53F0\u63A7\u5236\u9762\u670D\u52A1",
            target: "mysql",
            examples: ["\u7528\u6237\u7BA1\u7406", "\u89D2\u8272\u7BA1\u7406", "\u670D\u52A1\u6CBB\u7406", "\u7CFB\u7EDF\u7BA1\u7406", "\u4EFB\u52A1\u914D\u7F6E"],
            reason: "\u7ED3\u6784\u7A33\u5B9A\uFF0C\u4E8B\u52A1\u6E05\u6670\uFF0C\u9002\u5408\u914D\u7F6E\u578B\u6570\u636E\u3002"
          },
          {
            category: "\u65B0\u589E\u670D\u52A1",
            target: "mysql",
            examples: ["\u5728\u5355\u673A\u5355\u5E93\u67B6\u6784\u4E0B\u4F18\u5148\u6536\u53E3\u5230 MySQL"],
            reason: "\u5F53\u524D\u4EA7\u54C1\u9762\u5411\u5355\u673A\u4EA4\u4ED8\u4E0E\u8F7B\u91CF\u5316\u6F14\u8FDB\uFF0C\u5143\u6570\u636E\u5E93\u6682\u4E0D\u518D\u5F15\u5165\u7B2C\u4E8C\u5957\u6838\u5FC3\u5B9E\u4F8B\u3002"
          }
        ]
      };
    }
    module2.exports = {
      listServices,
      createService,
      updateService,
      deleteService,
      executeServiceAction,
      restartWebStack,
      startDefaultServices,
      runKafkaDemoPump,
      listSystemUsers,
      listSystemRoles,
      createSystemRole,
      updateSystemRole,
      deleteSystemRole,
      createSystemUser,
      updateSystemUser,
      deleteSystemUser,
      getSystemResources,
      getDatabaseArchitecture
    };
  }
});

// backend/src/common/utils/database-driver-store.js
var require_database_driver_store = __commonJS({
  "backend/src/common/utils/database-driver-store.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var DRIVER_STORE_ROOT = path.resolve(process.cwd(), "runtime/database-drivers");
    var ACTIVE_MANIFEST_PATH = path.join(DRIVER_STORE_ROOT, "active.json");
    var DATAX_TARGETS = {
      mysql: {
        dataxReader: { relativePath: "reader/mysqlreader/libs", pattern: /(?:mysql-connector|mariadb-java-client).*\.jar$/i },
        dataxWriter: { relativePath: "writer/mysqlwriter/libs", pattern: /(?:mysql-connector|mariadb-java-client).*\.jar$/i }
      },
      postgresql: {
        dataxReader: { relativePath: "reader/postgresqlreader/libs", pattern: /(?:postgresql|pgjdbc).*\.jar$/i },
        dataxWriter: { relativePath: "writer/postgresqlwriter/libs", pattern: /(?:postgresql|pgjdbc).*\.jar$/i }
      },
      oracle: {
        dataxReader: { relativePath: "reader/oraclereader/libs", pattern: /ojdbc.*\.jar$/i },
        dataxWriter: { relativePath: "writer/oraclewriter/libs", pattern: /ojdbc.*\.jar$/i }
      },
      dm: {
        dataxReader: { relativePath: "reader/rdbmsreader/libs", pattern: /dm.*jdbcdriver.*\.jar$/i },
        dataxWriter: { relativePath: "writer/rdbmswriter/libs", pattern: /dm.*jdbcdriver.*\.jar$/i }
      }
    };
    function ensureDriverStore() {
      fs.mkdirSync(DRIVER_STORE_ROOT, { recursive: true });
      return DRIVER_STORE_ROOT;
    }
    function emptyManifest() {
      return { version: 1, bindings: {}, updatedAt: null };
    }
    function readActiveManifest() {
      ensureDriverStore();
      try {
        const parsed = JSON.parse(fs.readFileSync(ACTIVE_MANIFEST_PATH, "utf8"));
        return parsed && typeof parsed === "object" && parsed.bindings ? parsed : emptyManifest();
      } catch {
        return emptyManifest();
      }
    }
    function writeActiveManifest(manifest) {
      ensureDriverStore();
      const next = { version: 1, bindings: manifest?.bindings || {}, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      const tempPath = `${ACTIVE_MANIFEST_PATH}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(next, null, 2), "utf8");
      fs.renameSync(tempPath, ACTIVE_MANIFEST_PATH);
      return next;
    }
    function getActiveDriverBinding(databaseType, target = "query") {
      const key = `${String(databaseType || "").toLowerCase()}:${target}`;
      return readActiveManifest().bindings[key] || null;
    }
    function resolveDriverFile(relativePath) {
      const resolved = path.resolve(DRIVER_STORE_ROOT, String(relativePath || ""));
      const relative = path.relative(DRIVER_STORE_ROOT, resolved);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("\u9A71\u52A8\u6587\u4EF6\u8DEF\u5F84\u8D85\u51FA\u6301\u4E45\u5316\u4ED3\u5E93");
      }
      return resolved;
    }
    function restoreBuiltInDrivers(directory) {
      if (!fs.existsSync(directory)) return;
      for (const name of fs.readdirSync(directory)) {
        if (!name.endsWith(".builtin-disabled")) continue;
        const source = path.join(directory, name);
        const target = path.join(directory, name.slice(0, -".builtin-disabled".length));
        if (!fs.existsSync(target)) fs.renameSync(source, target);
        else fs.unlinkSync(source);
      }
    }
    function materializeDataXTarget(dataxHome, databaseType, target, binding) {
      const config = DATAX_TARGETS[databaseType]?.[target];
      if (!config) return;
      const directory = path.join(dataxHome, "plugin", config.relativePath);
      if (!fs.existsSync(directory)) throw new Error(`DataX \u63D2\u4EF6\u76EE\u5F55\u4E0D\u5B58\u5728: ${config.relativePath}`);
      const managedName = `medata-managed-${databaseType}.jar`;
      const managedPath = path.join(directory, managedName);
      if (fs.existsSync(managedPath)) fs.unlinkSync(managedPath);
      restoreBuiltInDrivers(directory);
      if (!binding) return;
      for (const name of fs.readdirSync(directory)) {
        if (name === managedName || !config.pattern.test(name)) continue;
        fs.renameSync(path.join(directory, name), path.join(directory, `${name}.builtin-disabled`));
      }
      const sourcePath = resolveDriverFile(binding.filePath);
      if (!fs.existsSync(sourcePath)) throw new Error(`\u6FC0\u6D3B\u9A71\u52A8\u6587\u4EF6\u4E0D\u5B58\u5728: ${binding.filePath}`);
      fs.copyFileSync(sourcePath, managedPath);
    }
    function materializeActiveDataXDrivers(dataxHome) {
      const manifest = readActiveManifest();
      for (const databaseType of Object.keys(DATAX_TARGETS)) {
        for (const target of ["dataxReader", "dataxWriter"]) {
          materializeDataXTarget(dataxHome, databaseType, target, manifest.bindings[`${databaseType}:${target}`] || null);
        }
      }
      return manifest;
    }
    module2.exports = {
      ACTIVE_MANIFEST_PATH,
      DRIVER_STORE_ROOT,
      ensureDriverStore,
      getActiveDriverBinding,
      materializeDataXTarget,
      materializeActiveDataXDrivers,
      readActiveManifest,
      resolveDriverFile,
      writeActiveManifest
    };
  }
});

// backend/src/common/utils/datasource-capabilities.js
var require_datasource_capabilities = __commonJS({
  "backend/src/common/utils/datasource-capabilities.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { getActiveDriverBinding } = require_database_driver_store();
    var DATABASE_CAPABILITIES = Object.freeze({
      mysql: Object.freeze({
        type: "mysql",
        label: "MySQL",
        aliases: Object.freeze(["mysql", "mariadb"]),
        defaultPort: 3306,
        driverClassName: "com.mysql.cj.jdbc.Driver",
        healthCheckSql: "SELECT 1 AS ok",
        dataxReader: "mysqlreader",
        dataxWriter: "mysqlwriter",
        nodePackage: "mysql2",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      }),
      postgresql: Object.freeze({
        type: "postgresql",
        label: "PostgreSQL",
        aliases: Object.freeze(["postgresql", "postgres", "pg"]),
        defaultPort: 5432,
        driverClassName: "org.postgresql.Driver",
        healthCheckSql: "SELECT 1 AS ok",
        dataxReader: "postgresqlreader",
        dataxWriter: "postgresqlwriter",
        nodePackage: "pg",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      }),
      oracle: Object.freeze({
        type: "oracle",
        label: "Oracle",
        aliases: Object.freeze(["oracle"]),
        defaultPort: 1521,
        driverClassName: "oracle.jdbc.OracleDriver",
        healthCheckSql: "SELECT 1 AS ok FROM DUAL",
        dataxReader: "oraclereader",
        dataxWriter: "oraclewriter",
        nodePackage: "oracledb",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      }),
      dm: Object.freeze({
        type: "dm",
        label: "\u8FBE\u68A6\u6570\u636E\u5E93",
        aliases: Object.freeze(["dm", "dameng", "dmdb"]),
        defaultPort: 5236,
        driverClassName: "dm.jdbc.driver.DmDriver",
        healthCheckSql: "SELECT 1 AS ok FROM DUAL",
        dataxReader: "rdbmsreader",
        dataxWriter: "rdbmswriter",
        nodePackage: "dmdb",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      })
    });
    var DATABASE_ALIAS_MAP = Object.freeze(Object.fromEntries(
      Object.values(DATABASE_CAPABILITIES).flatMap(
        (capability) => capability.aliases.map((alias) => [alias, capability.type])
      )
    ));
    function getRuntimeDatabaseCapabilityStatus() {
      const pluginRoot = path.resolve(__dirname, "../../../datax/plugin");
      const hasPlugin = (kind, name) => fs.existsSync(path.join(pluginRoot, kind, name, "plugin.json"));
      const hasJar = (kind, name, pattern) => {
        const libs = path.join(pluginRoot, kind, name, "libs");
        return fs.existsSync(libs) && fs.readdirSync(libs).some((fileName) => pattern.test(fileName));
      };
      return listDatabaseCapabilities().map((capability) => {
        let driverLoaded = false;
        try {
          require.resolve(capability.nodePackage);
          driverLoaded = true;
        } catch {
          driverLoaded = false;
        }
        const readerJarReady = capability.type === "oracle" ? hasJar("reader", capability.dataxReader, /^ojdbc.*\.jar$/i) : capability.type === "dm" ? hasJar("reader", capability.dataxReader, /^Dm.*JdbcDriver.*\.jar$/i) : true;
        const writerJarReady = capability.type === "oracle" ? hasJar("writer", capability.dataxWriter, /^ojdbc.*\.jar$/i) : capability.type === "dm" ? hasJar("writer", capability.dataxWriter, /^Dm.*JdbcDriver.*\.jar$/i) : true;
        const managedQueryDriver = getActiveDriverBinding(capability.type, "query");
        return {
          ...capability,
          driverLoaded,
          queryReady: driverLoaded || Boolean(managedQueryDriver),
          managedQueryDriver: managedQueryDriver ? {
            packageId: managedQueryDriver.packageId,
            version: managedQueryDriver.version,
            sha256: managedQueryDriver.sha256
          } : null,
          dataxReaderReady: hasPlugin("reader", capability.dataxReader) && readerJarReady,
          dataxWriterReady: hasPlugin("writer", capability.dataxWriter) && writerJarReady
        };
      });
    }
    function normalizeRegisteredDatabaseType(value) {
      const normalized = String(value || "").trim().toLowerCase();
      return DATABASE_ALIAS_MAP[normalized] || normalized;
    }
    function getDatabaseCapability(value) {
      return DATABASE_CAPABILITIES[normalizeRegisteredDatabaseType(value)] || null;
    }
    function listDatabaseCapabilities() {
      return Object.values(DATABASE_CAPABILITIES);
    }
    function isSupportedDatabaseType(value) {
      return Boolean(getDatabaseCapability(value));
    }
    module2.exports = {
      DATABASE_CAPABILITIES,
      getDatabaseCapability,
      isSupportedDatabaseType,
      listDatabaseCapabilities,
      getRuntimeDatabaseCapabilityStatus,
      normalizeRegisteredDatabaseType
    };
  }
});

// backend/src/common/utils/managed-jdbc-runtime.js
var require_managed_jdbc_runtime = __commonJS({
  "backend/src/common/utils/managed-jdbc-runtime.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { spawn, spawnSync } = require("child_process");
    var { getActiveDriverBinding, resolveDriverFile } = require_database_driver_store();
    var JAVA_SOURCE = path.resolve(__dirname, "../../runtime/jdbc/JdbcDriverRunner.java");
    var JAVA_CLASSES = path.resolve(process.cwd(), "runtime/database-drivers/java-runtime/classes");
    var JAVA_CLASS = "medata.jdbc.JdbcDriverRunner";
    function ensureJdbcRunnerCompiled() {
      const classFile = path.join(JAVA_CLASSES, "medata/jdbc/JdbcDriverRunner.class");
      const needsCompile = !fs.existsSync(classFile) || fs.statSync(classFile).mtimeMs < fs.statSync(JAVA_SOURCE).mtimeMs;
      if (!needsCompile) return JAVA_CLASSES;
      fs.mkdirSync(JAVA_CLASSES, { recursive: true });
      const result = spawnSync(process.env.JAVAC_BIN || "javac", ["-encoding", "UTF-8", "-d", JAVA_CLASSES, JAVA_SOURCE], {
        encoding: "utf8",
        windowsHide: true
      });
      if (result.status !== 0) {
        throw new Error(`JDBC \u8FD0\u884C\u5668\u7F16\u8BD1\u5931\u8D25: ${String(result.stderr || result.stdout || "javac \u4E0D\u53EF\u7528").trim()}`);
      }
      return JAVA_CLASSES;
    }
    function encode(value) {
      return Buffer.from(String(value ?? ""), "utf8").toString("base64");
    }
    function serializeParams(params = []) {
      const env = { JDBC_PARAM_COUNT: String(params.length) };
      params.forEach((value, index) => {
        const type = value === null || value === void 0 ? "null" : typeof value === "number" || typeof value === "bigint" ? "number" : typeof value === "boolean" ? "boolean" : "string";
        env[`JDBC_PARAM_${index}_TYPE`] = type;
        env[`JDBC_PARAM_${index}_VALUE_B64`] = encode(value ?? "");
      });
      return env;
    }
    function runJdbcAction(binding, action, payload = {}) {
      const classes = ensureJdbcRunnerCompiled();
      const driverFile = resolveDriverFile(binding.filePath);
      if (!fs.existsSync(driverFile)) throw new Error(`\u9A71\u52A8\u6587\u4EF6\u4E0D\u5B58\u5728: ${binding.filePath}`);
      const javaEnv = {
        PATH: process.env.PATH || "",
        Path: process.env.Path || "",
        SystemRoot: process.env.SystemRoot || "",
        JAVA_HOME: process.env.JAVA_HOME || "",
        TEMP: process.env.TEMP || "",
        TMP: process.env.TMP || "",
        LANG: process.env.LANG || "",
        LC_ALL: process.env.LC_ALL || "",
        JDBC_DRIVER_CLASS: binding.driverClass,
        JDBC_URL: payload.jdbcUrl || "",
        JDBC_USER: payload.username || "",
        JDBC_PASSWORD: payload.password || "",
        JDBC_SQL_BASE64: encode(payload.sql || ""),
        JDBC_MAX_ROWS: String(payload.maxRows || 1e3),
        JDBC_CATALOG: payload.catalog || "",
        JDBC_SCHEMA: payload.schema || "",
        JDBC_TABLE: payload.table || "",
        ...serializeParams(payload.params || [])
      };
      const classPath = `${classes}${path.delimiter}${driverFile}`;
      return new Promise((resolve, reject) => {
        const restrictedIdentity = process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() === 0 ? {
          uid: Number(process.env.JDBC_RUNNER_UID || 65534),
          gid: Number(process.env.JDBC_RUNNER_GID || 65534)
        } : {};
        const child = spawn(process.env.JAVA_BIN || "java", ["-cp", classPath, JAVA_CLASS, action], {
          env: javaEnv,
          windowsHide: true,
          shell: false,
          ...restrictedIdentity
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill();
        }, Number(payload.timeoutMs || 9e4));
        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });
        child.on("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          if (timedOut) {
            reject(new Error(`JDBC \u64CD\u4F5C\u8D85\u8FC7 ${Number(payload.timeoutMs || 9e4)} \u6BEB\u79D2\uFF0C\u5DF2\u7EC8\u6B62`));
            return;
          }
          const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
          let result;
          try {
            result = JSON.parse(line || "{}");
          } catch {
            result = null;
          }
          if (code !== 0 || !result || result.success === false) {
            reject(new Error(result?.error || stderr.trim() || stdout.trim() || `JDBC \u8FD0\u884C\u5668\u9000\u51FA\u7801 ${code}`));
            return;
          }
          resolve(result);
        });
      });
    }
    function getManagedBinding(databaseType) {
      const binding = getActiveDriverBinding(databaseType, "query");
      return binding?.filePath && binding?.driverClass ? binding : null;
    }
    module2.exports = {
      ensureJdbcRunnerCompiled,
      getManagedBinding,
      runJdbcAction
    };
  }
});

// backend/src/modules/system-management/database-driver.repository.js
var require_database_driver_repository = __commonJS({
  "backend/src/modules/system-management/database-driver.repository.js"(exports2, module2) {
    var { pool } = require_database();
    function parseJson(value, fallback) {
      if (!value) return fallback;
      if (typeof value === "object") return value;
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    function mapPackage(row) {
      if (!row) return null;
      return {
        ...row,
        id: Number(row.id),
        fileSize: Number(row.fileSize || 0),
        targets: parseJson(row.targets, [])
      };
    }
    function mapBinding(row) {
      if (!row) return null;
      return {
        ...row,
        id: Number(row.id),
        packageId: Number(row.packageId),
        previousPackageId: row.previousPackageId ? Number(row.previousPackageId) : null
      };
    }
    async function listPackages() {
      const [rows] = await pool.query(`
    SELECT id, database_type AS databaseType, driver_name AS driverName, version,
           driver_class AS driverClass, original_file_name AS originalFileName,
           file_path AS filePath, file_size AS fileSize, sha256, targets_json AS targets,
           validation_status AS validationStatus, validation_message AS validationMessage,
           java_version AS javaVersion, uploaded_by AS uploadedBy, uploaded_by_name AS uploadedByName,
           created_at AS createdAt, updated_at AS updatedAt
      FROM system_database_driver_packages
     ORDER BY created_at DESC, id DESC
  `);
      return rows.map(mapPackage);
    }
    async function getPackageById(id) {
      const [rows] = await pool.query(`
    SELECT id, database_type AS databaseType, driver_name AS driverName, version,
           driver_class AS driverClass, original_file_name AS originalFileName,
           file_path AS filePath, file_size AS fileSize, sha256, targets_json AS targets,
           validation_status AS validationStatus, validation_message AS validationMessage,
           java_version AS javaVersion, uploaded_by AS uploadedBy, uploaded_by_name AS uploadedByName,
           created_at AS createdAt, updated_at AS updatedAt
      FROM system_database_driver_packages WHERE id = ? LIMIT 1
  `, [id]);
      return mapPackage(rows[0]);
    }
    async function getPackageByHash(databaseType, sha256) {
      const [rows] = await pool.query(
        "SELECT id FROM system_database_driver_packages WHERE database_type = ? AND sha256 = ? LIMIT 1",
        [databaseType, sha256]
      );
      return rows[0] || null;
    }
    async function createPackage(payload) {
      const [result] = await pool.query(`
    INSERT INTO system_database_driver_packages
      (database_type, driver_name, version, driver_class, original_file_name, file_path,
       file_size, sha256, targets_json, validation_status, uploaded_by, uploaded_by_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `, [
        payload.databaseType,
        payload.driverName,
        payload.version,
        payload.driverClass,
        payload.originalFileName,
        payload.filePath,
        payload.fileSize,
        payload.sha256,
        JSON.stringify(payload.targets),
        payload.uploadedBy,
        payload.uploadedByName
      ]);
      return getPackageById(result.insertId);
    }
    async function updateValidation(id, payload) {
      await pool.query(`
    UPDATE system_database_driver_packages
       SET validation_status = ?, validation_message = ?, java_version = ?,
           driver_class = COALESCE(?, driver_class)
     WHERE id = ?
  `, [payload.status, payload.message || null, payload.javaVersion || null, payload.driverClass || null, id]);
      return getPackageById(id);
    }
    async function listBindings() {
      const [rows] = await pool.query(`
    SELECT b.id, b.database_type AS databaseType, b.target, b.package_id AS packageId,
           b.previous_package_id AS previousPackageId, b.status,
           b.activated_by AS activatedBy, b.activated_by_name AS activatedByName,
           b.activated_at AS activatedAt,
           p.driver_name AS driverName, p.version, p.driver_class AS driverClass,
           p.file_path AS filePath, p.sha256
      FROM system_database_driver_bindings b
      JOIN system_database_driver_packages p ON p.id = b.package_id
     ORDER BY b.database_type, b.target
  `);
      return rows.map(mapBinding);
    }
    async function replaceBindings(driverPackage, targets, user) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        for (const target of targets) {
          const [currentRows] = await connection.query(
            "SELECT package_id AS packageId FROM system_database_driver_bindings WHERE database_type = ? AND target = ? FOR UPDATE",
            [driverPackage.databaseType, target]
          );
          const previousPackageId = currentRows[0]?.packageId || null;
          await connection.query(`
        INSERT INTO system_database_driver_bindings
          (database_type, target, package_id, previous_package_id, status, activated_by, activated_by_name, activated_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          previous_package_id = package_id,
          package_id = VALUES(package_id),
          status = 'active',
          activated_by = VALUES(activated_by),
          activated_by_name = VALUES(activated_by_name),
          activated_at = NOW()
      `, [driverPackage.databaseType, target, driverPackage.id, previousPackageId, user.id || null, user.username || "system"]);
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return listBindings();
    }
    async function rollbackBinding(databaseType, target, user) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query(`
      SELECT package_id AS packageId, previous_package_id AS previousPackageId
        FROM system_database_driver_bindings
       WHERE database_type = ? AND target = ? FOR UPDATE
    `, [databaseType, target]);
        const current = rows[0];
        if (!current?.previousPackageId) {
          await connection.rollback();
          return null;
        }
        await connection.query(`
      UPDATE system_database_driver_bindings
         SET package_id = ?, previous_package_id = ?, activated_by = ?, activated_by_name = ?, activated_at = NOW()
       WHERE database_type = ? AND target = ?
    `, [current.previousPackageId, current.packageId, user.id || null, user.username || "system", databaseType, target]);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return listBindings();
    }
    async function deactivateBinding(databaseType, target) {
      const [result] = await pool.query(
        "DELETE FROM system_database_driver_bindings WHERE database_type = ? AND target = ?",
        [databaseType, target]
      );
      return result.affectedRows > 0;
    }
    async function deletePackage(id) {
      const [result] = await pool.query("DELETE FROM system_database_driver_packages WHERE id = ?", [id]);
      return result.affectedRows > 0;
    }
    async function createOperationLog(payload) {
      await pool.query(`
    INSERT INTO system_database_driver_operation_logs
      (package_id, database_type, action, status, detail_json, operator_user_id, operator_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
        payload.packageId || null,
        payload.databaseType,
        payload.action,
        payload.status,
        JSON.stringify(payload.detail || {}),
        payload.user?.id || null,
        payload.user?.username || "system"
      ]);
    }
    async function listOperationLogs(packageId, limit = 100) {
      const params = [];
      let where = "";
      if (packageId) {
        where = "WHERE package_id = ?";
        params.push(packageId);
      }
      params.push(Math.min(Math.max(Number(limit) || 100, 1), 500));
      const [rows] = await pool.query(`
    SELECT id, package_id AS packageId, database_type AS databaseType, action, status,
           detail_json AS detail, operator_user_id AS operatorUserId, operator_name AS operatorName,
           created_at AS createdAt
      FROM system_database_driver_operation_logs
      ${where}
     ORDER BY created_at DESC, id DESC LIMIT ?
  `, params);
      return rows.map((row) => ({ ...row, detail: parseJson(row.detail, {}) }));
    }
    module2.exports = {
      createOperationLog,
      createPackage,
      deactivateBinding,
      deletePackage,
      getPackageByHash,
      getPackageById,
      listBindings,
      listOperationLogs,
      listPackages,
      replaceBindings,
      rollbackBinding,
      updateValidation
    };
  }
});

// backend/src/common/utils/datasource-dialect.js
var require_datasource_dialect = __commonJS({
  "backend/src/common/utils/datasource-dialect.js"(exports2, module2) {
    var POSTGRESQL = "postgresql";
    var UNKNOWN = "unknown";
    var {
      getDatabaseCapability,
      normalizeRegisteredDatabaseType
    } = require_datasource_capabilities();
    var DIALECT_VENDOR_MAP = {
      mysql: "mysql",
      mariadb: "mysql",
      postgresql: POSTGRESQL,
      postgres: POSTGRESQL,
      gaussdb: POSTGRESQL,
      opengauss: POSTGRESQL,
      clickhouse: "clickhouse",
      hive: "hive",
      hive2: "hive",
      oracle: "oracle",
      dm: "dm",
      dameng: "dm",
      dmdb: "dm",
      sqlserver: "sqlserver"
    };
    function normalizeDatasourceType(value) {
      const normalized = String(value || "").trim().toLowerCase();
      if (!normalized) {
        return "";
      }
      const registeredType = normalizeRegisteredDatabaseType(normalized);
      if (registeredType !== normalized || getDatabaseCapability(registeredType)) return registeredType;
      if (normalized === "opengauss") {
        return "gaussdb";
      }
      return normalized;
    }
    function mapJdbcVendorToDialect(vendor) {
      return DIALECT_VENDOR_MAP[String(vendor || "").trim().toLowerCase()] || UNKNOWN;
    }
    function getDefaultPort(type) {
      const normalizedType = normalizeDatasourceType(type);
      const registered = getDatabaseCapability(normalizedType);
      if (registered) return registered.defaultPort;
      switch (normalizedType) {
        case "gaussdb":
          return 5432;
        case "clickhouse":
          return 8123;
        case "hive":
          return 1e4;
        case "kafka":
          return 9092;
        case "ftp":
          return 21;
        case "sftp":
          return 22;
        default:
          return 0;
      }
    }
    function parseJdbcParams(rawParams = "") {
      if (!rawParams) {
        return {};
      }
      const normalized = String(rawParams || "").replace(/^[?;]/, "").replace(/;/g, "&");
      const searchParams = new URLSearchParams(normalized);
      const result = {};
      for (const [key, value] of searchParams.entries()) {
        result[key] = value;
      }
      return result;
    }
    function parseStandardJdbcUrl(jdbcUrl) {
      const normalized = String(jdbcUrl || "").trim();
      const matched = normalized.match(/^jdbc:([a-z0-9_]+)(?::([a-z0-9_]+))?:\/\/([^/?;#]+)(?::(\d+))?(?:\/([^?;#]*))?([?;].*)?$/i);
      if (!matched) {
        return null;
      }
      const vendor = String(matched[1] || "").toLowerCase();
      const subProtocol = String(matched[2] || "").toLowerCase() || null;
      const hostToken = String(matched[3] || "").split(",").map((item) => item.trim()).find(Boolean) || "";
      const pathToken = decodeURIComponent(String(matched[5] || "").trim());
      const params = parseJdbcParams(matched[6] || "");
      const database = pathToken || null;
      const schema = params.currentSchema || params.currentschema || params.schema || params.searchpath || null;
      return {
        jdbcUrl: normalized,
        vendor,
        subProtocol,
        dialect: mapJdbcVendorToDialect(subProtocol || vendor),
        host: hostToken || null,
        port: matched[4] ? Number(matched[4]) : null,
        database,
        schema,
        params
      };
    }
    function parseOracleJdbcUrl(jdbcUrl) {
      const normalized = String(jdbcUrl || "").trim();
      const serviceMatched = normalized.match(/^jdbc:oracle(?::[a-z0-9_]+)*:@\/\/([^:/?#]+):(\d+)\/([^?;#]+)([?;].*)?$/i);
      const sidMatched = normalized.match(/^jdbc:oracle(?::[a-z0-9_]+)*:@([^:/?#]+):(\d+):([^?;#]+)([?;].*)?$/i);
      const matched = serviceMatched || sidMatched;
      if (!matched) {
        return null;
      }
      return {
        jdbcUrl: normalized,
        vendor: "oracle",
        subProtocol: null,
        dialect: "oracle",
        host: String(matched[1] || "").trim() || null,
        port: matched[2] ? Number(matched[2]) : null,
        database: decodeURIComponent(String(matched[3] || "").trim()) || null,
        connectionMode: serviceMatched ? "serviceName" : "sid",
        schema: null,
        params: parseJdbcParams(matched[4] || "")
      };
    }
    function parseJdbcUrl(jdbcUrl) {
      const normalized = String(jdbcUrl || "").trim();
      if (!normalized || !/^jdbc:/i.test(normalized)) {
        return null;
      }
      return parseStandardJdbcUrl(normalized) || parseOracleJdbcUrl(normalized);
    }
    function inferDatasourceDialect(sourceType, connectionConfig = {}) {
      const normalizedType = normalizeDatasourceType(sourceType);
      if (!normalizedType) {
        return UNKNOWN;
      }
      if (getDatabaseCapability(normalizedType) || normalizedType === "clickhouse" || normalizedType === "hive" || normalizedType === "kafka" || normalizedType === "api" || normalizedType === "ftp" || normalizedType === "sftp") {
        return normalizedType;
      }
      if (normalizedType === "gaussdb") {
        return POSTGRESQL;
      }
      if (normalizedType === "jdbc") {
        return parseJdbcUrl(connectionConfig.jdbcUrl || connectionConfig.url || connectionConfig.connectionString)?.dialect || UNKNOWN;
      }
      return normalizedType;
    }
    function normalizeJdbcUrlForDialect(jdbcUrl, dialect) {
      const normalized = String(jdbcUrl || "").trim();
      if (!normalized) {
        return "";
      }
      if (dialect === POSTGRESQL) {
        return normalized.replace(/^jdbc:(?:gaussdb|opengauss|postgres):/i, "jdbc:postgresql:");
      }
      if (dialect === "mysql") {
        return normalized.replace(/^jdbc:mariadb:/i, "jdbc:mysql:");
      }
      if (dialect === "hive") {
        return normalized.replace(/^jdbc:hive:/i, "jdbc:hive2:");
      }
      return normalized;
    }
    function buildJdbcUrl(sourceType, connectionConfig = {}, options = {}) {
      const normalizedType = normalizeDatasourceType(sourceType);
      const dialect = options.dialect || inferDatasourceDialect(normalizedType, connectionConfig);
      const existingJdbcUrl = String(connectionConfig.jdbcUrl || connectionConfig.url || "").trim();
      if (existingJdbcUrl) {
        return options.normalize !== false ? normalizeJdbcUrlForDialect(existingJdbcUrl, dialect) : existingJdbcUrl;
      }
      const host = String(connectionConfig.host || "").trim();
      const port = Number(connectionConfig.port || getDefaultPort(dialect || normalizedType));
      const database = String(connectionConfig.database || connectionConfig.databaseName || "").trim();
      if (!host || !port) {
        return "";
      }
      if (dialect === POSTGRESQL) {
        return `jdbc:postgresql://${host}:${port}/${database}`;
      }
      if (dialect === "mysql") {
        return `jdbc:mysql://${host}:${port}/${database}?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai`;
      }
      if (dialect === "clickhouse") {
        return `jdbc:clickhouse://${host}:${port}/${database}`;
      }
      if (dialect === "hive") {
        return `jdbc:hive2://${host}:${port}/${database || "default"}`;
      }
      if (dialect === "oracle") {
        const connectionMode = String(connectionConfig.connectionMode || "serviceName").trim().toLowerCase();
        return connectionMode === "sid" ? `jdbc:oracle:thin:@${host}:${port}:${database}` : `jdbc:oracle:thin:@//${host}:${port}/${database}`;
      }
      if (dialect === "dm") {
        return `jdbc:dm://${host}:${port}/${database}`;
      }
      return "";
    }
    function resolveDatasourceConnection(sourceType, connectionConfig = {}) {
      const normalizedType = normalizeDatasourceType(sourceType);
      const jdbcMeta = parseJdbcUrl(connectionConfig.jdbcUrl || connectionConfig.url || connectionConfig.connectionString);
      const dialect = inferDatasourceDialect(normalizedType, connectionConfig);
      const database = connectionConfig.database || connectionConfig.databaseName || jdbcMeta?.database || null;
      const schema = connectionConfig.schema || connectionConfig.currentSchema || jdbcMeta?.schema || (dialect === POSTGRESQL ? "public" : null);
      const host = connectionConfig.host || jdbcMeta?.host || null;
      const portValue = connectionConfig.port || jdbcMeta?.port || getDefaultPort(dialect || normalizedType);
      const port = Number(portValue || 0) || 0;
      return {
        sourceType: normalizedType,
        dialect,
        host,
        port,
        database,
        schema,
        username: connectionConfig.username || connectionConfig.user || null,
        password: connectionConfig.password || null,
        jdbcUrl: buildJdbcUrl(normalizedType, { ...connectionConfig, database }, { dialect }),
        driverClassName: connectionConfig.driverClassName || null,
        protocol: connectionConfig.protocol || jdbcMeta?.vendor || null,
        connectionMode: connectionConfig.connectionMode || jdbcMeta?.connectionMode || null,
        jdbcMeta
      };
    }
    module2.exports = {
      POSTGRESQL,
      UNKNOWN,
      buildJdbcUrl,
      getDefaultPort,
      inferDatasourceDialect,
      mapJdbcVendorToDialect,
      normalizeDatasourceType,
      normalizeJdbcUrlForDialect,
      parseJdbcUrl,
      resolveDatasourceConnection
    };
  }
});

// backend/src/services/dataxService.js
var require_dataxService = __commonJS({
  "backend/src/services/dataxService.js"(exports2, module2) {
    var { spawn, spawnSync } = require("child_process");
    var fs = require("fs");
    var path = require("path");
    var os = require("os");
    var { v4: uuidv4 } = require("uuid");
    var env = require_config();
    var {
      buildJdbcUrl,
      inferDatasourceDialect,
      normalizeDatasourceType,
      normalizeJdbcUrlForDialect
    } = require_datasource_dialect();
    var { materializeActiveDataXDrivers } = require_database_driver_store();
    var DATA_X_HOME = env.dataxHome ? path.resolve(env.dataxHome) : path.resolve(__dirname, "../../datax");
    var DATA_X_BIN = env.dataxBin ? path.resolve(env.dataxBin) : path.join(DATA_X_HOME, "bin", "datax.py");
    var PYTHON_BIN = env.dataxPython || process.env.PYTHON || "python3";
    var runningJobs = /* @__PURE__ */ new Map();
    function resolveTransferType(type, connection = {}) {
      const normalizedType = normalizeDatasourceType(type);
      const dialect = inferDatasourceDialect(normalizedType, connection || {});
      return dialect === "unknown" ? normalizedType : dialect;
    }
    function buildDataXJob(jobConfig) {
      const { source, writer, fieldMappings, transformRules } = jobConfig;
      let reader = buildReader(source);
      const writerConfig = buildWriter(writer);
      if (fieldMappings && fieldMappings.length > 0) {
        reader = applyFieldMappings(reader, fieldMappings);
      }
      const content = {
        reader,
        writer: writerConfig
      };
      const transformers = buildTransformers(transformRules);
      if (transformers && transformers.length > 0) {
        content.transformer = transformers;
      }
      const job = {
        job: {
          content: [content],
          setting: {
            speed: {
              channel: jobConfig.channel || 1,
              byte: jobConfig.byteSpeed || -1,
              record: jobConfig.recordSpeed || -1
            },
            errorLimit: {
              record: jobConfig.errorRecordLimit || 1e4,
              percentage: jobConfig.errorPercentage || 0.01
            }
          }
        }
      };
      return job;
    }
    function buildReader(source) {
      const connection = source.connection || {};
      const sourceType = resolveTransferType(source.type, connection);
      const table = normalizeTables(connection.table);
      switch (sourceType) {
        case "mysql":
          return {
            name: "mysqlreader",
            parameter: {
              username: connection.username || "",
              password: connection.password || "",
              column: connection.column || ["*"],
              connection: [
                {
                  jdbcUrl: normalizeReaderJdbcUrls(connection, sourceType),
                  table
                }
              ],
              ...connection.splitPk ? { splitPk: connection.splitPk } : {},
              ...connection.where ? { where: connection.where } : {}
            }
          };
        case "postgresql":
          return {
            name: "postgresqlreader",
            parameter: {
              username: connection.username || "",
              password: connection.password || "",
              column: connection.column || ["*"],
              splitPk: connection.splitPk || null,
              connection: [
                {
                  jdbcUrl: normalizeReaderJdbcUrls(connection, sourceType),
                  table
                }
              ],
              where: connection.where || null
            }
          };
        case "oracle":
          return buildJdbcReader("oraclereader", sourceType, connection, table);
        case "dm":
          return buildJdbcReader("rdbmsreader", sourceType, connection, table);
        case "sftp":
        case "ftp":
          return {
            name: "streamreader",
            parameter: {
              column: connection.column || ["*"],
              sliceRecordCount: 100
            }
          };
        case "api":
        case "http":
          return {
            name: "streamreader",
            parameter: {
              column: connection.column || ["*"],
              sliceRecordCount: 100
            }
          };
        default:
          throw new Error(`DataX \u4E0D\u652F\u6301\u6570\u636E\u6E90\u7C7B\u578B ${source.type || sourceType}\uFF0C\u672A\u751F\u6210\u964D\u7EA7\u6D41\u4EFB\u52A1`);
      }
    }
    function buildWriter(writer) {
      const connection = writer.connection || {};
      const writerType = resolveTransferType(writer.type, connection);
      const table = normalizeTables(connection.table);
      switch (writerType) {
        case "mysql":
          return buildMysqlWriter(connection, table, writerType);
        case "postgresql":
          return buildPostgresqlWriter(connection, table, writerType);
        case "oracle":
          return buildJdbcWriter("oraclewriter", writerType, connection, table);
        case "dm":
          return buildJdbcWriter("rdbmswriter", writerType, connection, table);
        case "hive":
          return buildHiveWriter(connection);
        case "kafka":
          return {
            name: "streamwriter",
            parameter: {
              column: ["*"],
              sliceRecordCount: 100
            }
          };
        case "file":
          return {
            name: "txtfilewriter",
            parameter: {
              fileName: connection.fileName || "output",
              path: connection.path || "/tmp/datax/output",
              fileType: connection.fileType || "text",
              fieldDelimiter: connection.fieldDelimiter || ",",
              column: connection.column || ["*"]
            }
          };
        default:
          throw new Error(`DataX \u4E0D\u652F\u6301\u6570\u636E\u6E90\u7C7B\u578B ${writer.type || writerType}\uFF0C\u672A\u751F\u6210\u964D\u7EA7\u6D41\u4EFB\u52A1`);
      }
    }
    function applyFieldMappings(reader, fieldMappings) {
      return reader;
    }
    function normalizeTables(table) {
      if (Array.isArray(table)) {
        return table.filter(Boolean);
      }
      if (table) {
        return [table];
      }
      return [];
    }
    function normalizeReaderJdbcUrls(connection, sourceType = "mysql") {
      const dialect = resolveTransferType(sourceType, connection);
      const normalizeUrl = (value) => normalizeJdbcUrlForDialect(value, dialect);
      if (Array.isArray(connection.jdbcUrl)) {
        return connection.jdbcUrl.filter(Boolean).map(normalizeUrl);
      }
      if (Array.isArray(connection.url)) {
        return connection.url.filter(Boolean).map(normalizeUrl);
      }
      const jdbcUrl = connection.jdbcUrl || connection.url || buildJdbcUrl(sourceType, connection);
      return jdbcUrl ? [normalizeUrl(jdbcUrl)] : [];
    }
    function normalizeWriterJdbcUrl(connection, writerType = "mysql") {
      const dialect = resolveTransferType(writerType, connection);
      const normalizeUrl = (value) => normalizeJdbcUrlForDialect(value, dialect);
      if (Array.isArray(connection.jdbcUrl)) {
        return normalizeUrl(connection.jdbcUrl[0] || "");
      }
      if (Array.isArray(connection.url)) {
        return normalizeUrl(connection.url[0] || "");
      }
      return normalizeUrl(connection.jdbcUrl || connection.url || buildJdbcUrl(writerType, connection));
    }
    function buildJdbcReader(name, sourceType, connection, table) {
      return {
        name,
        parameter: {
          username: connection.username || "",
          password: connection.password || "",
          column: connection.column || ["*"],
          connection: [{ jdbcUrl: normalizeReaderJdbcUrls(connection, sourceType), table }],
          ...connection.splitPk ? { splitPk: connection.splitPk } : {},
          ...connection.where ? { where: connection.where } : {}
        }
      };
    }
    function buildJdbcWriter(name, sourceType, connection, table) {
      const normalizedWriteMode = String(connection.writeMode || "append").toLowerCase();
      const preSql = [...connection.preSql || []];
      if (normalizedWriteMode === "overwrite" && table[0]) {
        const quote = sourceType === "oracle" || sourceType === "dm" ? '"' : "`";
        const target = table[0].split(".").filter(Boolean).map((part) => `${quote}${part.replaceAll(quote, quote + quote)}${quote}`).join(".");
        preSql.unshift(`TRUNCATE TABLE ${target}`);
      }
      return {
        name,
        parameter: {
          username: connection.username || "",
          password: connection.password || "",
          writeMode: normalizedWriteMode === "replace" ? "replace" : "insert",
          column: connection.column || ["*"],
          connection: [{ jdbcUrl: normalizeWriterJdbcUrl(connection, sourceType), table }],
          preSql,
          postSql: connection.postSql || []
        }
      };
    }
    function buildTransformers(transformRules) {
      if (!transformRules || transformRules.length === 0) {
        return null;
      }
      return transformRules.map((rule) => {
        const config = rule.config || {};
        switch (rule.transformType) {
          case "rename":
            return {
              name: "replace",
              rule: {
                destination: config.newName || rule.field,
                source: rule.field
              }
            };
          case "uppercase":
            return {
              name: "replace",
              rule: {
                destination: rule.field,
                source: rule.field,
                replaceWith: config.expression || `upper(${rule.field})`
              }
            };
          case "lowercase":
            return {
              name: "replace",
              rule: {
                destination: rule.field,
                source: rule.field,
                replaceWith: config.expression || `lower(${rule.field})`
              }
            };
          default:
            return null;
        }
      }).filter((t) => t !== null);
    }
    async function executeJob(jobId, jobJson, options = {}) {
      const tempDir = os.tmpdir();
      const jobFileName = `datax_job_${jobId}_${uuidv4()}.json`;
      const jobFilePath = path.join(tempDir, jobFileName);
      try {
        validateDataXEnvironment();
        materializeActiveDataXDrivers(DATA_X_HOME);
        fs.writeFileSync(jobFilePath, JSON.stringify(jobJson, null, 2), "utf8");
        return new Promise((resolve, reject) => {
          const dataXProcess = spawn(PYTHON_BIN, [DATA_X_BIN, jobFilePath], {
            cwd: DATA_X_HOME,
            env: { ...process.env },
            shell: true
          });
          runningJobs.set(jobId, {
            process: dataXProcess,
            cancelRequested: false
          });
          let stdout = "";
          let stderr = "";
          let settled = false;
          const finalize = (code, signal, source) => {
            if (settled) {
              return;
            }
            settled = true;
            const runningJob = runningJobs.get(jobId);
            const cancelRequested = Boolean(runningJob?.cancelRequested);
            runningJobs.delete(jobId);
            try {
              fs.unlinkSync(jobFilePath);
            } catch (e) {
            }
            const result = parseJobResult(stdout, stderr, code, signal, cancelRequested);
            result.completedBy = source;
            if (code === 0 && !signal && !cancelRequested) {
              resolve({
                success: true,
                jobId,
                result
              });
            } else {
              resolve({
                success: false,
                jobId,
                error: result.error || stderr || stdout || `DataX exited with code ${code}`,
                result
              });
            }
          };
          dataXProcess.stdout.on("data", (data) => {
            const chunk = data.toString();
            stdout += chunk;
            const progress = extractLatestProgress(stdout);
            if (progress && typeof options.onProgress === "function") {
              options.onProgress({
                stdout,
                stderr,
                metrics: progress.metrics,
                latestLine: progress.line
              });
            }
          });
          dataXProcess.stderr.on("data", (data) => {
            stderr += data.toString();
          });
          dataXProcess.on("close", (code, signal) => {
            finalize(code, signal, "close");
          });
          dataXProcess.on("exit", (code, signal) => {
            finalize(code, signal, "exit");
          });
          dataXProcess.on("error", (error) => {
            if (settled) {
              return;
            }
            settled = true;
            runningJobs.delete(jobId);
            try {
              fs.unlinkSync(jobFilePath);
            } catch (e) {
            }
            reject({
              success: false,
              jobId,
              error: error.message
            });
          });
        });
      } catch (error) {
        try {
          if (fs.existsSync(jobFilePath)) {
            fs.unlinkSync(jobFilePath);
          }
        } catch (e) {
        }
        throw error;
      }
    }
    function validateDataXEnvironment() {
      if (!fs.existsSync(DATA_X_BIN)) {
        const configuredByEnv = env.dataxBin || env.dataxHome;
        const configHint = configuredByEnv ? `\u5F53\u524D DATAX \u914D\u7F6E\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5 DATAX_HOME / DATAX_BIN\u3002` : "\u5F53\u524D\u672A\u914D\u7F6E DATAX_HOME / DATAX_BIN\u3002";
        throw new Error(
          `DataX \u672A\u5B89\u88C5\u6216\u8DEF\u5F84\u4E0D\u5B58\u5728: ${DATA_X_BIN}\u3002${configHint}`
        );
      }
    }
    function buildMysqlWriter(connection, table, writerType = "mysql") {
      const normalizedWriteMode = String(connection.writeMode || "append").toLowerCase();
      const firstTable = table[0];
      const preSql = [...connection.preSql || []];
      let dataXWriteMode = "insert";
      if (normalizedWriteMode === "replace") {
        dataXWriteMode = "replace";
      } else if (normalizedWriteMode === "overwrite") {
        if (firstTable) {
          preSql.unshift(`TRUNCATE TABLE ${quoteMysqlTableName(firstTable)}`);
        }
      }
      return {
        name: "mysqlwriter",
        parameter: {
          username: connection.username || "",
          password: connection.password || "",
          writeMode: dataXWriteMode,
          session: connection.session || [],
          column: connection.column || ["*"],
          connection: [
            {
              jdbcUrl: normalizeWriterJdbcUrl(connection, writerType),
              table
            }
          ],
          preSql,
          postSql: connection.postSql || []
        }
      };
    }
    function buildPostgresqlWriter(connection, table, writerType = "postgresql") {
      const normalizedWriteMode = String(connection.writeMode || "append").toLowerCase();
      const firstTable = table[0];
      const preSql = [...connection.preSql || []];
      if (normalizedWriteMode === "overwrite" && firstTable) {
        preSql.unshift(`TRUNCATE TABLE ${quotePostgresqlTableName(firstTable)}`);
      }
      return {
        name: "postgresqlwriter",
        parameter: {
          username: connection.username || "",
          password: connection.password || "",
          session: connection.session || [],
          column: connection.column || ["*"],
          connection: [
            {
              jdbcUrl: normalizeWriterJdbcUrl(connection, writerType),
              table
            }
          ],
          preSql,
          postSql: connection.postSql || []
        }
      };
    }
    function buildHiveWriter(connection) {
      const normalizedWriteMode = String(connection.writeMode || "append").toLowerCase();
      const partitionConfig = connection.partitionConfig || {};
      const parameter = {
        defaultFS: connection.defaultFS || "hdfs://localhost:9000",
        fileType: connection.fileType || "text",
        path: connection.path || "/tmp/datax",
        fileName: connection.fileName || "datax",
        column: connection.column || ["*"],
        writeMode: normalizedWriteMode === "partition_overwrite" ? "overwrite" : normalizedWriteMode,
        fieldDelimiter: connection.fieldDelimiter || "	"
      };
      if (normalizedWriteMode === "partition_overwrite") {
        parameter.partition = {
          mode: partitionConfig.mode || "latest",
          partitionColumn: partitionConfig.partitionColumn || "",
          ...partitionConfig.partitionValue ? { partitionValue: partitionConfig.partitionValue } : {}
        };
      }
      return {
        name: "hdfswriter",
        parameter
      };
    }
    function quoteMysqlTableName(tableName) {
      return String(tableName || "").split(".").filter(Boolean).map((part) => `\`${part.replace(/`/g, "``")}\``).join(".");
    }
    function quotePostgresqlTableName(tableName) {
      return String(tableName || "").split(".").filter(Boolean).map((part) => `"${part.replace(/"/g, '""')}"`).join(".");
    }
    function cancelJob(jobId) {
      const runningJob = runningJobs.get(jobId);
      if (runningJob?.process) {
        runningJob.cancelRequested = true;
        terminateProcessTree(runningJob.process);
        return true;
      }
      return false;
    }
    function terminateProcessTree(childProcess) {
      if (!childProcess || !childProcess.pid) {
        return false;
      }
      if (process.platform === "win32") {
        const result = spawnSync("taskkill", ["/PID", String(childProcess.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true
        });
        return result.status === 0;
      }
      try {
        childProcess.kill("SIGTERM");
        return true;
      } catch (error) {
        return false;
      }
    }
    var OUTPUT_TAIL_LIMIT = 8e3;
    function tailText(value, maxLength = OUTPUT_TAIL_LIMIT) {
      const text = String(value || "");
      if (text.length <= maxLength) {
        return text;
      }
      return text.slice(text.length - maxLength);
    }
    function parseJobResult(stdout, stderr, exitCode, signal = null, cancelled = false) {
      const result = {
        exitCode,
        signal,
        metrics: {}
      };
      try {
        const progress = extractLatestProgress(stdout);
        if (progress) {
          result.metrics = progress.metrics;
          result.latestProgressLine = progress.line;
        }
        if (cancelled || signal) {
          result.status = "cancelled";
          result.error = "\u4EFB\u52A1\u5DF2\u53D6\u6D88";
        } else if (stdout.includes("\u4EFB\u52A1\u6267\u884C\u6574\u4E2A\u6210\u529F")) {
          result.status = "success";
          result.error = null;
        } else if (stdout.includes("\u4EFB\u52A1\u6267\u884C\u5931\u8D25")) {
          result.status = "failed";
          result.error = "\u4EFB\u52A1\u6267\u884C\u5931\u8D25";
        }
        if (result.status !== "success") {
          const stderrTail = tailText(stderr);
          const stdoutTail = tailText(stdout);
          if (stderrTail) {
            result.stderr = stderrTail;
          }
          if (stdoutTail) {
            result.stdout = stdoutTail;
          }
          if (!result.error) {
            result.error = stderrTail || stdoutTail || `DataX exited with code ${exitCode}`;
          }
          result.error = normalizeDataXError(result.error);
        }
      } catch (e) {
      }
      return result;
    }
    function isJobRunning(jobId) {
      return runningJobs.has(jobId);
    }
    function getRunningJobIds() {
      return [...runningJobs.keys()];
    }
    function normalizeDataXError(value) {
      const message = String(value || "").trim();
      if (/ClassNotFoundException|NoClassDefFoundError|No suitable driver/i.test(message)) return `\u6570\u636E\u5E93 JDBC \u9A71\u52A8\u672A\u52A0\u8F7D\uFF1A${tailText(message, 1200)}`;
      if (/ORA-01017|invalid username\/password/i.test(message)) return "Oracle \u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF";
      if (/ORA-12514|ORA-12505/i.test(message)) return "Oracle Service Name \u6216 SID \u4E0D\u5B58\u5728";
      if (/ORA-01031|insufficient privileges/i.test(message)) return "Oracle \u5F53\u524D\u7528\u6237\u6743\u9650\u4E0D\u8DB3";
      if (/网络通信异常|connection refused|connect timed out/i.test(message)) return `\u6570\u636E\u5E93\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25\uFF1A${tailText(message, 1200)}`;
      return message;
    }
    function extractLatestProgress(stdout) {
      const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index];
        const metrics = parseProgressLine(line);
        if (metrics) {
          return { line, metrics };
        }
      }
      return null;
    }
    function parseProgressLine(line) {
      if (!line.includes("Total") || !line.includes("Speed") || !line.includes("records")) {
        return null;
      }
      const progressMatch = line.match(
        /Total\s+(\d+)\s+records,\s+(\d+)\s+bytes\s+\|\s+Speed\s+([^,|]+),\s+([^|]+)\|\s+Error\s+(\d+)\s+records,\s+(\d+)\s+bytes.*?\|\s+Percentage\s+([\d.]+)%/i
      );
      if (!progressMatch) {
        return null;
      }
      return {
        totalRecords: parseInt(progressMatch[1], 10),
        totalBytes: parseInt(progressMatch[2], 10),
        speed: progressMatch[3].trim(),
        recordSpeed: progressMatch[4].trim(),
        errorRecords: parseInt(progressMatch[5], 10),
        errorBytes: parseInt(progressMatch[6], 10),
        percentage: Number(progressMatch[7])
      };
    }
    module2.exports = {
      buildDataXJob,
      executeJob,
      cancelJob,
      parseJobResult,
      isJobRunning,
      getRunningJobIds
    };
  }
});

// backend/src/modules/system-management/database-driver.service.js
var require_database_driver_service = __commonJS({
  "backend/src/modules/system-management/database-driver.service.js"(exports2, module2) {
    var crypto = require("crypto");
    var fs = require("fs");
    var path = require("path");
    var AppError = require_app_error();
    var {
      getRuntimeDatabaseCapabilityStatus,
      normalizeRegisteredDatabaseType
    } = require_datasource_capabilities();
    var {
      DRIVER_STORE_ROOT,
      ensureDriverStore,
      materializeActiveDataXDrivers,
      readActiveManifest,
      resolveDriverFile,
      writeActiveManifest
    } = require_database_driver_store();
    var { runJdbcAction } = require_managed_jdbc_runtime();
    var repository = require_database_driver_repository();
    var ALLOWED_TYPES = /* @__PURE__ */ new Set(["mysql", "postgresql", "oracle", "dm"]);
    var ALLOWED_TARGETS = /* @__PURE__ */ new Set(["query", "dataxReader", "dataxWriter"]);
    var DEFAULT_TARGETS = ["query", "dataxReader", "dataxWriter"];
    var DRIVER_DEFAULTS = Object.freeze({
      mysql: { name: "MySQL JDBC", classes: ["com.mysql.cj.jdbc.Driver", "com.mysql.jdbc.Driver", "org.mariadb.jdbc.Driver"] },
      postgresql: { name: "PostgreSQL JDBC", classes: ["org.postgresql.Driver"] },
      oracle: { name: "Oracle JDBC", classes: ["oracle.jdbc.OracleDriver", "oracle.jdbc.driver.OracleDriver"] },
      dm: { name: "\u8FBE\u68A6 JDBC", classes: ["dm.jdbc.driver.DmDriver"] }
    });
    var DATAX_HOME = path.resolve(process.env.DATAX_HOME || path.resolve(__dirname, "../../../datax"));
    function requireAdmin(user) {
      const role = String(user?.roleCode || user?.roleType || "").toLowerCase();
      if (role !== "admin") throw new AppError("\u4EC5\u7CFB\u7EDF\u7BA1\u7406\u5458\u53EF\u4EE5\u7EF4\u62A4\u6570\u636E\u5E93\u9A71\u52A8\u3002", 403);
    }
    function normalizeType(value) {
      const normalized = normalizeRegisteredDatabaseType(value);
      if (!ALLOWED_TYPES.has(normalized)) throw new AppError("\u4EC5\u652F\u6301 MySQL\u3001PostgreSQL\u3001Oracle \u548C\u8FBE\u68A6\u6570\u636E\u5E93\u9A71\u52A8\u3002", 400);
      return normalized;
    }
    function parseTargets(value) {
      let parsed = value;
      if (typeof value === "string") {
        try {
          parsed = JSON.parse(value);
        } catch {
          parsed = value.split(",");
        }
      }
      const targets = Array.from(new Set((Array.isArray(parsed) ? parsed : []).map(String).filter((item) => ALLOWED_TARGETS.has(item))));
      if (!targets.length) throw new AppError("\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u751F\u6548\u76EE\u6807\u3002", 400);
      return targets;
    }
    function sanitizeSegment(value, fallback) {
      const normalized = String(value || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
      return normalized || fallback;
    }
    function inferDriverVersion(fileName) {
      const match = String(fileName || "").match(/(\d+(?:\.\d+){1,4})(?=[^\d.]*\.jar$)/i);
      return match?.[1] || "\u81EA\u5B9A\u4E49\u7248\u672C";
    }
    function getDriverClassCandidates(databaseType, current) {
      return Array.from(new Set([String(current || "").trim(), ...DRIVER_DEFAULTS[databaseType]?.classes || []].filter(Boolean)));
    }
    function calculateSha256(filePath) {
      const hash = crypto.createHash("sha256");
      hash.update(fs.readFileSync(filePath));
      return hash.digest("hex");
    }
    function assertJarFile(file) {
      if (!file?.path || !fs.existsSync(file.path)) throw new AppError("\u8BF7\u9009\u62E9 JDBC JAR \u9A71\u52A8\u6587\u4EF6\u3002", 400);
      if (!/\.jar$/i.test(file.originalname || "")) throw new AppError("\u9A71\u52A8\u6587\u4EF6\u5FC5\u987B\u662F .jar \u683C\u5F0F\u3002", 400);
      const descriptor = fs.openSync(file.path, "r");
      try {
        const header = Buffer.alloc(4);
        fs.readSync(descriptor, header, 0, 4, 0);
        if (header[0] !== 80 || header[1] !== 75) throw new AppError("\u4E0A\u4F20\u6587\u4EF6\u4E0D\u662F\u6709\u6548\u7684 JAR \u5305\u3002", 400);
      } finally {
        fs.closeSync(descriptor);
      }
    }
    function manifestBinding(driverPackage) {
      return {
        packageId: driverPackage.id,
        databaseType: driverPackage.databaseType,
        driverName: driverPackage.driverName,
        version: driverPackage.version,
        driverClass: driverPackage.driverClass,
        filePath: driverPackage.filePath,
        sha256: driverPackage.sha256
      };
    }
    function manifestFromBindings(bindings) {
      const result = { version: 1, bindings: {} };
      for (const binding of bindings) {
        result.bindings[`${binding.databaseType}:${binding.target}`] = {
          packageId: binding.packageId,
          databaseType: binding.databaseType,
          driverName: binding.driverName,
          version: binding.version,
          driverClass: binding.driverClass,
          filePath: binding.filePath,
          sha256: binding.sha256
        };
      }
      return result;
    }
    async function restoreActiveManifest() {
      const bindings = await repository.listBindings();
      const manifest = writeActiveManifest(manifestFromBindings(bindings));
      materializeActiveDataXDrivers(DATAX_HOME);
      return manifest;
    }
    async function listDrivers() {
      const [packages, bindings, logs, capabilities] = await Promise.all([
        repository.listPackages(),
        repository.listBindings(),
        repository.listOperationLogs(null, 50),
        Promise.resolve(getRuntimeDatabaseCapabilityStatus())
      ]);
      return { packages, bindings, logs, capabilities, runtimeManifest: readActiveManifest() };
    }
    async function uploadDriver(file, body, user) {
      requireAdmin(user);
      assertJarFile(file);
      const databaseType = normalizeType(body.databaseType);
      const defaults = DRIVER_DEFAULTS[databaseType];
      const targets = parseTargets(body.targets || DEFAULT_TARGETS);
      const driverClass = String(body.driverClass || defaults.classes[0]).trim();
      if (!/^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)+$/.test(driverClass)) throw new AppError("Driver Class \u683C\u5F0F\u4E0D\u6B63\u786E\u3002", 400);
      const version = String(body.version || inferDriverVersion(file.originalname)).trim();
      if (!version || version.length > 64) throw new AppError("\u8BF7\u8F93\u5165\u4E0D\u8D85\u8FC7 64 \u4E2A\u5B57\u7B26\u7684\u9A71\u52A8\u7248\u672C\u3002", 400);
      const sha256 = calculateSha256(file.path);
      if (await repository.getPackageByHash(databaseType, sha256)) throw new AppError("\u76F8\u540C\u6570\u636E\u5E93\u7C7B\u578B\u548C\u6587\u4EF6\u6821\u9A8C\u503C\u7684\u9A71\u52A8\u5DF2\u5B58\u5728\u3002", 409);
      const destinationDirectory = path.join(ensureDriverStore(), databaseType, sanitizeSegment(version, "unknown"), sha256);
      fs.mkdirSync(destinationDirectory, { recursive: true });
      const destination = path.join(destinationDirectory, "driver.jar");
      fs.renameSync(file.path, destination);
      fs.chmodSync(destination, 420);
      const relativePath = path.relative(DRIVER_STORE_ROOT, destination).replace(/\\/g, "/");
      let driverPackage;
      try {
        driverPackage = await repository.createPackage({
          databaseType,
          driverName: String(body.driverName || defaults.name).trim().slice(0, 128),
          version,
          driverClass,
          originalFileName: path.basename(file.originalname || "driver.jar"),
          filePath: relativePath,
          fileSize: Number(file.size || fs.statSync(destination).size),
          sha256,
          targets,
          uploadedBy: user?.id || null,
          uploadedByName: user?.username || "system"
        });
      } catch (error) {
        try {
          fs.unlinkSync(destination);
        } catch {
        }
        throw error;
      }
      await repository.createOperationLog({ packageId: driverPackage.id, databaseType, action: "upload", status: "success", detail: { sha256, targets }, user });
      return driverPackage;
    }
    async function validateDriver(id, user) {
      requireAdmin(user);
      const driverPackage = await repository.getPackageById(id);
      if (!driverPackage) throw new AppError("\u9A71\u52A8\u5305\u4E0D\u5B58\u5728\u3002", 404);
      let lastError;
      const candidates = getDriverClassCandidates(driverPackage.databaseType, driverPackage.driverClass);
      for (const driverClass of candidates) {
        try {
          const result = await runJdbcAction({ ...manifestBinding(driverPackage), driverClass }, "validate");
          const updated = await repository.updateValidation(id, {
            status: "validated",
            message: "\u9A71\u52A8\u81EA\u52A8\u9A8C\u8BC1\u901A\u8FC7",
            javaVersion: result.javaVersion,
            driverClass
          });
          await repository.createOperationLog({ packageId: id, databaseType: driverPackage.databaseType, action: "validate", status: "success", detail: { ...result, autoDetected: true }, user });
          return updated;
        } catch (error) {
          lastError = error;
        }
      }
      const message = `\u672A\u8BC6\u522B\u5230\u53EF\u7528\u7684 JDBC \u9A71\u52A8\u7C7B\uFF08\u5DF2\u68C0\u67E5\uFF1A${candidates.join("\u3001")}\uFF09`;
      await repository.updateValidation(id, { status: "failed", message });
      await repository.createOperationLog({ packageId: id, databaseType: driverPackage.databaseType, action: "validate", status: "failed", detail: { error: lastError?.message, candidates }, user });
      throw new AppError(`\u9A71\u52A8\u81EA\u52A8\u9A8C\u8BC1\u5931\u8D25\uFF1A${message}`, 400);
    }
    async function uploadAndActivateDriver(file, body, user) {
      let driverPackage;
      try {
        driverPackage = await uploadDriver(file, { ...body, targets: DEFAULT_TARGETS }, user);
        const validated = await validateDriver(driverPackage.id, user);
        await activateDriver(validated.id, DEFAULT_TARGETS, user);
        return listDrivers();
      } catch (error) {
        if (driverPackage?.id) {
          try {
            await deleteDriver(driverPackage.id, user);
          } catch {
          }
        }
        throw error;
      }
    }
    async function activateDriver(id, targetsInput, user) {
      requireAdmin(user);
      const driverPackage = await repository.getPackageById(id);
      if (!driverPackage) throw new AppError("\u9A71\u52A8\u5305\u4E0D\u5B58\u5728\u3002", 404);
      if (driverPackage.validationStatus !== "validated") throw new AppError("\u9A71\u52A8\u5FC5\u987B\u9A8C\u8BC1\u901A\u8FC7\u540E\u624D\u80FD\u6FC0\u6D3B\u3002", 400);
      const targets = parseTargets(targetsInput?.length ? targetsInput : driverPackage.targets);
      const unsupported = targets.filter((target) => !driverPackage.targets.includes(target));
      if (unsupported.length) throw new AppError(`\u9A71\u52A8\u5305\u672A\u58F0\u660E\u751F\u6548\u76EE\u6807\uFF1A${unsupported.join(", ")}`, 400);
      if (targets.some((target) => target.startsWith("datax"))) {
        const runningJobIds = require_dataxService().getRunningJobIds();
        if (runningJobIds.length) throw new AppError(`\u5F53\u524D\u6709 ${runningJobIds.length} \u4E2A DataX \u4EFB\u52A1\u8FD0\u884C\u4E2D\uFF0C\u8BF7\u7B49\u5F85\u4EFB\u52A1\u7ED3\u675F\u540E\u518D\u6FC0\u6D3B\u9A71\u52A8\u3002`, 409);
      }
      const previousManifest = readActiveManifest();
      const nextManifest = JSON.parse(JSON.stringify(previousManifest));
      for (const target of targets) nextManifest.bindings[`${driverPackage.databaseType}:${target}`] = manifestBinding(driverPackage);
      try {
        writeActiveManifest(nextManifest);
        materializeActiveDataXDrivers(DATAX_HOME);
        await repository.replaceBindings(driverPackage, targets, user || {});
        await repository.createOperationLog({ packageId: id, databaseType: driverPackage.databaseType, action: "activate", status: "success", detail: { targets }, user });
        return listDrivers();
      } catch (error) {
        writeActiveManifest(previousManifest);
        try {
          materializeActiveDataXDrivers(DATAX_HOME);
        } catch {
        }
        await repository.createOperationLog({ packageId: id, databaseType: driverPackage.databaseType, action: "activate", status: "failed", detail: { targets, error: error.message }, user });
        throw new AppError(`\u9A71\u52A8\u6FC0\u6D3B\u5931\u8D25\u5E76\u5DF2\u6062\u590D\u539F\u7248\u672C\uFF1A${error.message}`, 500);
      }
    }
    async function rollbackDriver(databaseTypeInput, targetInput, user) {
      requireAdmin(user);
      const databaseType = normalizeType(databaseTypeInput);
      const target = parseTargets([targetInput])[0];
      const currentBindings = await repository.listBindings();
      const current = currentBindings.find((item) => item.databaseType === databaseType && item.target === target);
      if (!current?.previousPackageId) throw new AppError("\u5F53\u524D\u76EE\u6807\u6CA1\u6709\u53EF\u56DE\u6EDA\u7684\u5386\u53F2\u7248\u672C\u3002", 400);
      const previousPackage = await repository.getPackageById(current.previousPackageId);
      if (!previousPackage) throw new AppError("\u53EF\u56DE\u6EDA\u9A71\u52A8\u7248\u672C\u5DF2\u4E0D\u5B58\u5728\u3002", 409);
      const desiredBindings = currentBindings.map((item) => item === current ? {
        ...item,
        packageId: previousPackage.id,
        previousPackageId: current.packageId,
        driverName: previousPackage.driverName,
        version: previousPackage.version,
        driverClass: previousPackage.driverClass,
        filePath: previousPackage.filePath,
        sha256: previousPackage.sha256
      } : item);
      const currentManifest = readActiveManifest();
      try {
        const desiredManifest = writeActiveManifest(manifestFromBindings(desiredBindings));
        materializeActiveDataXDrivers(DATAX_HOME);
        const bindings = await repository.rollbackBinding(databaseType, target, user || {});
        const active = bindings.find((item) => item.databaseType === databaseType && item.target === target);
        await repository.createOperationLog({ packageId: active?.packageId, databaseType, action: "rollback", status: "success", detail: { target }, user });
        return { bindings, runtimeManifest: desiredManifest };
      } catch (error) {
        writeActiveManifest(currentManifest);
        try {
          materializeActiveDataXDrivers(DATAX_HOME);
        } catch {
        }
        await repository.createOperationLog({ packageId: current.packageId, databaseType, action: "rollback", status: "failed", detail: { target, error: error.message }, user });
        throw new AppError(`\u9A71\u52A8\u56DE\u6EDA\u5931\u8D25\u5E76\u5DF2\u6062\u590D\u5F53\u524D\u7248\u672C\uFF1A${error.message}`, 500);
      }
    }
    async function deactivateDriver(databaseTypeInput, targetInput, user) {
      requireAdmin(user);
      const databaseType = normalizeType(databaseTypeInput);
      const target = parseTargets([targetInput])[0];
      if (target.startsWith("datax")) {
        const runningJobIds = require_dataxService().getRunningJobIds();
        if (runningJobIds.length) throw new AppError(`\u5F53\u524D\u6709 ${runningJobIds.length} \u4E2A DataX \u4EFB\u52A1\u8FD0\u884C\u4E2D\uFF0C\u8BF7\u7B49\u5F85\u4EFB\u52A1\u7ED3\u675F\u540E\u518D\u505C\u7528\u9A71\u52A8\u3002`, 409);
      }
      const currentBindings = await repository.listBindings();
      const current = currentBindings.find((item) => item.databaseType === databaseType && item.target === target);
      if (!current) throw new AppError("\u5F53\u524D\u76EE\u6807\u6CA1\u6709\u5DF2\u6FC0\u6D3B\u7684\u7528\u6237\u9A71\u52A8\u3002", 404);
      const desiredBindings = currentBindings.filter((item) => item !== current);
      const currentManifest = readActiveManifest();
      try {
        const manifest = writeActiveManifest(manifestFromBindings(desiredBindings));
        materializeActiveDataXDrivers(DATAX_HOME);
        const removed = await repository.deactivateBinding(databaseType, target);
        if (!removed) throw new Error("\u9A71\u52A8\u7ED1\u5B9A\u72B6\u6001\u5DF2\u53D1\u751F\u53D8\u5316");
        await repository.createOperationLog({ packageId: current.packageId, databaseType, action: "deactivate", status: "success", detail: { target }, user });
        return { bindings: desiredBindings, runtimeManifest: manifest };
      } catch (error) {
        writeActiveManifest(currentManifest);
        try {
          materializeActiveDataXDrivers(DATAX_HOME);
        } catch {
        }
        await repository.createOperationLog({ packageId: current.packageId, databaseType, action: "deactivate", status: "failed", detail: { target, error: error.message }, user });
        throw new AppError(`\u9A71\u52A8\u505C\u7528\u5931\u8D25\u5E76\u5DF2\u6062\u590D\u5F53\u524D\u7248\u672C\uFF1A${error.message}`, 500);
      }
    }
    async function deleteDriver(id, user) {
      requireAdmin(user);
      const driverPackage = await repository.getPackageById(id);
      if (!driverPackage) throw new AppError("\u9A71\u52A8\u5305\u4E0D\u5B58\u5728\u3002", 404);
      const bindings = await repository.listBindings();
      if (bindings.some((item) => item.packageId === driverPackage.id || item.previousPackageId === driverPackage.id)) {
        throw new AppError("\u5F53\u524D\u6216\u53EF\u56DE\u6EDA\u7248\u672C\u4ECD\u5F15\u7528\u8BE5\u9A71\u52A8\uFF0C\u4E0D\u80FD\u5220\u9664\u3002", 409);
      }
      await repository.deletePackage(id);
      const filePath = resolveDriverFile(driverPackage.filePath);
      try {
        fs.unlinkSync(filePath);
      } catch {
      }
      await repository.createOperationLog({ packageId: null, databaseType: driverPackage.databaseType, action: "delete", status: "success", detail: { version: driverPackage.version, sha256: driverPackage.sha256 }, user });
      return { id };
    }
    async function listLogs(packageId) {
      return repository.listOperationLogs(packageId, 200);
    }
    module2.exports = {
      activateDriver,
      deactivateDriver,
      deleteDriver,
      listDrivers,
      listLogs,
      restoreActiveManifest,
      rollbackDriver,
      uploadAndActivateDriver,
      uploadDriver,
      validateDriver,
      __test: {
        getDriverClassCandidates,
        inferDriverVersion
      }
    };
  }
});

// backend/src/modules/system-management/system-management.controller.js
var require_system_management_controller = __commonJS({
  "backend/src/modules/system-management/system-management.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var service = require_system_management_service();
    var databaseDriverService = require_database_driver_service();
    async function listServices(req, res) {
      const rows = await service.listServices();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createService(req, res) {
      const row = await service.createService(req.validatedBody);
      return sendSuccess(res, row, null, 201);
    }
    async function updateService(req, res) {
      const row = await service.updateService(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function deleteService(req, res) {
      await service.deleteService(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function operateService(req, res) {
      const result = await service.executeServiceAction(Number(req.params.id), req.params.action);
      return sendSuccess(res, result);
    }
    async function restartWebStack(req, res) {
      const result = await service.restartWebStack();
      return sendSuccess(res, result);
    }
    async function startDefaultServices(req, res) {
      const result = await service.startDefaultServices();
      return sendSuccess(res, result);
    }
    async function runKafkaDemoPump(req, res) {
      const result = await service.runKafkaDemoPump(req.body || {});
      return sendSuccess(res, result);
    }
    async function listRoles(req, res) {
      const rows = await service.listSystemRoles();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createRole(req, res) {
      const row = await service.createSystemRole(req.validatedBody);
      return sendSuccess(res, row, null, 201);
    }
    async function updateRole(req, res) {
      const row = await service.updateSystemRole(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function deleteRole(req, res) {
      await service.deleteSystemRole(Number(req.params.id));
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function listUsers(req, res) {
      const rows = await service.listSystemUsers();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function createUser(req, res) {
      const row = await service.createSystemUser(req.validatedBody);
      return sendSuccess(res, row, null, 201);
    }
    async function updateUser(req, res) {
      const row = await service.updateSystemUser(Number(req.params.id), req.validatedBody, req.user);
      return sendSuccess(res, row);
    }
    async function deleteUser(req, res) {
      await service.deleteSystemUser(Number(req.params.id), req.user);
      return sendSuccess(res, { id: Number(req.params.id) });
    }
    async function getResources(req, res) {
      const snapshot = await service.getSystemResources(req.query.period);
      return sendSuccess(res, snapshot);
    }
    async function getDatabaseArchitecture(req, res) {
      const result = await service.getDatabaseArchitecture();
      return sendSuccess(res, result);
    }
    async function listDatabaseDrivers(req, res) {
      return sendSuccess(res, await databaseDriverService.listDrivers());
    }
    async function uploadDatabaseDriver(req, res) {
      try {
        const row = await databaseDriverService.uploadDriver(req.file, req.body || {}, req.user);
        return sendSuccess(res, row, null, 201);
      } finally {
        if (req.file?.path) {
          try {
            require("fs").unlinkSync(req.file.path);
          } catch {
          }
        }
      }
    }
    async function uploadAndActivateDatabaseDriver(req, res) {
      try {
        return sendSuccess(res, await databaseDriverService.uploadAndActivateDriver(req.file, req.body || {}, req.user));
      } finally {
        if (req.file?.path) {
          try {
            require("fs").unlinkSync(req.file.path);
          } catch {
          }
        }
      }
    }
    async function validateDatabaseDriver(req, res) {
      return sendSuccess(res, await databaseDriverService.validateDriver(Number(req.params.id), req.user));
    }
    async function activateDatabaseDriver(req, res) {
      return sendSuccess(res, await databaseDriverService.activateDriver(Number(req.params.id), req.body?.targets, req.user));
    }
    async function rollbackDatabaseDriver(req, res) {
      return sendSuccess(res, await databaseDriverService.rollbackDriver(req.body?.databaseType, req.body?.target, req.user));
    }
    async function deactivateDatabaseDriver(req, res) {
      return sendSuccess(res, await databaseDriverService.deactivateDriver(req.body?.databaseType, req.body?.target, req.user));
    }
    async function deleteDatabaseDriver(req, res) {
      return sendSuccess(res, await databaseDriverService.deleteDriver(Number(req.params.id), req.user));
    }
    async function listDatabaseDriverLogs(req, res) {
      return sendSuccess(res, await databaseDriverService.listLogs(Number(req.params.id)));
    }
    module2.exports = {
      listServices,
      createService,
      updateService,
      deleteService,
      operateService,
      restartWebStack,
      startDefaultServices,
      runKafkaDemoPump,
      listRoles,
      createRole,
      updateRole,
      deleteRole,
      listUsers,
      createUser,
      updateUser,
      deleteUser,
      getResources,
      getDatabaseArchitecture,
      listDatabaseDrivers,
      uploadDatabaseDriver,
      uploadAndActivateDatabaseDriver,
      validateDatabaseDriver,
      activateDatabaseDriver,
      rollbackDatabaseDriver,
      deactivateDatabaseDriver,
      deleteDatabaseDriver,
      listDatabaseDriverLogs
    };
  }
});

// packages/data-platform-module-system-management/src/.runtime-entry.js
var controller0 = require_system_management_controller();
var { Writable } = require("node:stream");
var handlers = {
  "GET /api/v1/system-management/services": controller0["listServices"],
  "POST /api/v1/system-management/services": controller0["createService"],
  "POST /api/v1/system-management/services/actions/restart-web-stack": controller0["restartWebStack"],
  "POST /api/v1/system-management/services/actions/start-default": controller0["startDefaultServices"],
  "POST /api/v1/system-management/services/actions/run-kafka-demo-pump": controller0["runKafkaDemoPump"],
  "POST /api/v1/system-management/services/:id/actions/:action": controller0["operateService"],
  "PUT /api/v1/system-management/services/:id": controller0["updateService"],
  "DELETE /api/v1/system-management/services/:id": controller0["deleteService"],
  "GET /api/v1/system-management/database-drivers": controller0["listDatabaseDrivers"],
  "POST /api/v1/system-management/database-drivers/upload-and-activate": controller0["uploadAndActivateDatabaseDriver"],
  "POST /api/v1/system-management/database-drivers/upload": controller0["uploadDatabaseDriver"],
  "POST /api/v1/system-management/database-drivers/rollback": controller0["rollbackDatabaseDriver"],
  "POST /api/v1/system-management/database-drivers/deactivate": controller0["deactivateDatabaseDriver"],
  "POST /api/v1/system-management/database-drivers/:id/validate": controller0["validateDatabaseDriver"],
  "POST /api/v1/system-management/database-drivers/:id/activate": controller0["activateDatabaseDriver"],
  "GET /api/v1/system-management/database-drivers/:id/logs": controller0["listDatabaseDriverLogs"],
  "DELETE /api/v1/system-management/database-drivers/:id": controller0["deleteDatabaseDriver"],
  "GET /api/v1/system-management/roles": controller0["listRoles"],
  "POST /api/v1/system-management/roles": controller0["createRole"],
  "PUT /api/v1/system-management/roles/:id": controller0["updateRole"],
  "DELETE /api/v1/system-management/roles/:id": controller0["deleteRole"],
  "GET /api/v1/system-management/users": controller0["listUsers"],
  "POST /api/v1/system-management/users": controller0["createUser"],
  "PUT /api/v1/system-management/users/:id": controller0["updateUser"],
  "DELETE /api/v1/system-management/users/:id": controller0["deleteUser"],
  "GET /api/v1/system-management/resources": controller0["getResources"],
  "GET /api/v1/system-management/database-architecture": controller0["getDatabaseArchitecture"]
};
function routeParams(apiKey, input) {
  const pathTemplate = apiKey.slice(apiKey.indexOf(" ") + 1);
  const params = { ...input && input.params || {} };
  for (const match of pathTemplate.matchAll(/:([A-Za-z0-9_]+)/g)) {
    const name = match[1];
    if (params[name] === void 0) params[name] = input?.[name] ?? (name === "id" ? input?.id : void 0);
  }
  if (pathTemplate.includes("*") && params[0] === void 0) params[0] = input?.path || "/";
  return params;
}
function createResponse() {
  const response = new Writable({
    write(chunk, _encoding, callback) {
      this.chunks.push(Buffer.from(chunk));
      callback();
    },
    final(callback) {
      this.payload ??= Buffer.concat(this.chunks);
      callback();
    }
  });
  response.statusCode = 200;
  response.headers = {};
  response.payload = void 0;
  response.chunks = [];
  response.status = function status(code) {
    this.statusCode = code;
    return this;
  };
  response.setHeader = function setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value;
    return this;
  };
  response.json = function json(value) {
    this.payload = value;
    this.end();
    return value;
  };
  response.send = function send(value) {
    this.payload = value;
    this.end();
    return value;
  };
  response.download = function download(file, name) {
    this.payload = { path: file, filename: name };
    this.end();
    return this.payload;
  };
  return response;
}
async function executeCapability(definition, input = {}, context = {}) {
  const apiKey = definition.sourceApiKeys[0];
  const handler = handlers[apiKey];
  if (typeof handler !== "function") {
    const error = new Error("No bundled handler for " + apiKey);
    error.code = "CAPABILITY_HANDLER_MISSING";
    throw error;
  }
  const method = apiKey.slice(0, apiKey.indexOf(" "));
  const body = input.body && typeof input.body === "object" ? input.body : input;
  const req = context.request || {
    method,
    params: routeParams(apiKey, input),
    query: input.query || (method === "GET" ? input : {}),
    body,
    validatedBody: body,
    headers: input.headers || {},
    user: context.actor || input.actor || null,
    projectId: context.projectId || input.projectId || null,
    file: input.file || null,
    files: input.files || null,
    ip: null,
    protocol: "cli",
    socket: {},
    get(name) {
      return this.headers[String(name).toLowerCase()] || this.headers[name] || "";
    }
  };
  const res = context.response || createResponse();
  const returned = await handler(req, res);
  if (!context.response && returned === res && !res.writableFinished) {
    await new Promise((resolve, reject) => {
      res.once("finish", resolve);
      res.once("error", reject);
    });
  }
  const payload = res.payload === void 0 ? returned : res.payload;
  if (context.response) {
    return { data: payload, meta: null, statusCode: res.statusCode, headers: res.headers || {} };
  }
  if (payload && payload.success === true && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return { data: payload.data, meta: payload.meta ?? null, statusCode: res.statusCode, headers: res.headers };
  }
  return { data: payload, meta: null, statusCode: res.statusCode, headers: res.headers };
}
module.exports = { executeCapability, createResponse, handlerApiKeys: Object.freeze(Object.keys(handlers)) };
