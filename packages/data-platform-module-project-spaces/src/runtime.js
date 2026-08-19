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

// backend/src/modules/project-spaces/project-space.service.js
var require_project_space_service = __commonJS({
  "backend/src/modules/project-spaces/project-space.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var repository = require_project_space_repository();
    function isAdmin(user) {
      return String(user?.roleCode || "").toLowerCase() === "admin";
    }
    async function ensureDefaultMembershipForUser(user) {
      const defaultProject = await repository.ensureDefaultProject();
      if (!user?.sub || isAdmin(user)) {
        return defaultProject;
      }
      const existingMember = await repository.getProjectMember(defaultProject.id, user.sub);
      if (!existingMember) {
        await repository.ensureUserMembership(defaultProject.id, user.sub, "developer");
      }
      return defaultProject;
    }
    async function listMyProjects(user) {
      if (!user?.sub) return [];
      await ensureDefaultMembershipForUser(user);
      if (isAdmin(user)) {
        return repository.listProjects();
      }
      return repository.listUserProjects(user.sub);
    }
    async function getUserDefaultProjectId(user) {
      if (!user?.sub) return null;
      const projectId = await repository.getUserDefaultProjectId(user.sub);
      if (!projectId) return null;
      const project = await repository.getProjectById(projectId);
      if (!project || project.status !== "active") {
        return null;
      }
      if (isAdmin(user)) {
        return project.id;
      }
      const member = await repository.getProjectMember(project.id, user.sub);
      return member?.status === "active" ? project.id : null;
    }
    async function resolveRequestProject(user, requestedProjectId) {
      const defaultProject = await ensureDefaultMembershipForUser(user);
      const normalizedRequestedId = Number(requestedProjectId || 0) || null;
      let project = normalizedRequestedId ? await repository.getProjectById(normalizedRequestedId) : null;
      if (!project) {
        const projects = isAdmin(user) ? await repository.listProjects() : await repository.listUserProjects(user.sub);
        project = projects[0] || defaultProject;
      }
      if (!project || project.status !== "active") {
        throw new AppError("\u5F53\u524D\u9879\u76EE\u7A7A\u95F4\u4E0D\u5B58\u5728\u6216\u5DF2\u505C\u7528", 403);
      }
      if (isAdmin(user)) {
        return {
          project,
          member: { projectId: project.id, userId: Number(user.sub), projectRole: "owner", status: "active" }
        };
      }
      const member = await repository.getProjectMember(project.id, user.sub);
      if (!member || member.status !== "active") {
        throw new AppError("\u5F53\u524D\u8D26\u53F7\u65E0\u6743\u8BBF\u95EE\u8BE5\u9879\u76EE\u7A7A\u95F4", 403);
      }
      return { project, member };
    }
    async function listProjects() {
      await repository.ensureDefaultProject();
      return repository.listProjects({ includeInactive: true });
    }
    async function setDefaultProject(id, user) {
      if (!user?.sub) {
        throw new AppError("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u8BBE\u7F6E\u9ED8\u8BA4\u9879\u76EE", 401);
      }
      const project = await repository.getProjectById(id);
      if (!project || project.status !== "active") {
        throw new AppError("\u53EA\u80FD\u5C06\u542F\u7528\u72B6\u6001\u7684\u9879\u76EE\u8BBE\u7F6E\u4E3A\u9ED8\u8BA4\u9879\u76EE", 400);
      }
      if (!isAdmin(user)) {
        const member = await repository.getProjectMember(project.id, user.sub);
        if (!member || member.status !== "active") {
          throw new AppError("\u5F53\u524D\u8D26\u53F7\u65E0\u6743\u5C06\u8BE5\u9879\u76EE\u8BBE\u7F6E\u4E3A\u9ED8\u8BA4\u9879\u76EE", 403);
        }
      }
      await repository.setUserDefaultProject(user.sub, project.id);
      return { defaultProjectId: project.id, project };
    }
    async function getProjectDetail(id) {
      const project = await repository.getProjectById(id);
      if (!project) {
        throw new AppError("\u9879\u76EE\u7A7A\u95F4\u4E0D\u5B58\u5728", 404);
      }
      const members = await repository.listProjectMembers(id);
      return { ...project, members };
    }
    async function createProject(payload, user) {
      const existing = await repository.getProjectByCode(payload.projectCode);
      if (existing) {
        throw new AppError("\u9879\u76EE\u7F16\u7801\u5DF2\u5B58\u5728", 409);
      }
      return repository.createProject(payload, user);
    }
    async function updateProject(id, payload) {
      const existing = await repository.getProjectById(id);
      if (!existing) {
        throw new AppError("\u9879\u76EE\u7A7A\u95F4\u4E0D\u5B58\u5728", 404);
      }
      const conflict = await repository.getProjectByCode(payload.projectCode);
      if (conflict && conflict.id !== Number(id)) {
        throw new AppError("\u9879\u76EE\u7F16\u7801\u5DF2\u5B58\u5728", 409);
      }
      const row = await repository.updateProject(id, payload);
      if (!row) {
        throw new AppError("\u9879\u76EE\u7A7A\u95F4\u4E0D\u5B58\u5728", 404);
      }
      return row;
    }
    async function updateProjectStatus(id, status) {
      const project = await repository.getProjectById(id);
      if (!project) {
        throw new AppError("\u9879\u76EE\u7A7A\u95F4\u4E0D\u5B58\u5728", 404);
      }
      if (project.projectCode === repository.DEFAULT_PROJECT_CODE && status !== "active") {
        throw new AppError("\u9ED8\u8BA4\u9879\u76EE\u7A7A\u95F4\u4E0D\u80FD\u505C\u7528", 400);
      }
      await repository.updateProjectStatus(id, status);
      return repository.getProjectById(id);
    }
    async function upsertProjectMember(projectId, payload) {
      const project = await repository.getProjectById(projectId);
      if (!project) {
        throw new AppError("\u9879\u76EE\u7A7A\u95F4\u4E0D\u5B58\u5728", 404);
      }
      return repository.upsertProjectMember(projectId, payload);
    }
    async function removeProjectMember(projectId, userId) {
      const project = await repository.getProjectById(projectId);
      if (!project) {
        throw new AppError("\u9879\u76EE\u7A7A\u95F4\u4E0D\u5B58\u5728", 404);
      }
      if (project.projectCode === repository.DEFAULT_PROJECT_CODE) {
        throw new AppError("\u9ED8\u8BA4\u9879\u76EE\u6210\u5458\u4E0D\u80FD\u79FB\u9664", 400);
      }
      const deleted = await repository.removeProjectMember(projectId, userId);
      if (!deleted) {
        throw new AppError("\u9879\u76EE\u6210\u5458\u4E0D\u5B58\u5728", 404);
      }
      return { projectId, userId };
    }
    async function deleteProject(id) {
      const project = await repository.getProjectById(id);
      if (!project) {
        throw new AppError("\u9879\u76EE\u7A7A\u95F4\u4E0D\u5B58\u5728", 404);
      }
      if (project.projectCode === repository.DEFAULT_PROJECT_CODE) {
        throw new AppError("\u9ED8\u8BA4\u9879\u76EE\u7A7A\u95F4\u4E0D\u80FD\u5220\u9664", 400);
      }
      await repository.deleteProject(id);
      return { projectId: id, deleted: true };
    }
    module2.exports = {
      listMyProjects,
      getUserDefaultProjectId,
      resolveRequestProject,
      listProjects,
      setDefaultProject,
      getProjectDetail,
      createProject,
      updateProject,
      updateProjectStatus,
      upsertProjectMember,
      removeProjectMember,
      deleteProject
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

// backend/src/modules/project-spaces/project-asset.service.js
var require_project_asset_service = __commonJS({
  "backend/src/modules/project-spaces/project-asset.service.js"(exports2, module2) {
    var crypto = require("crypto");
    var fs = require("fs/promises");
    var path = require("path");
    var AppError = require_app_error();
    var {
      getRuntimeDatabaseCapabilityStatus,
      isSupportedDatabaseType
    } = require_datasource_capabilities();
    var {
      inferDatasourceDialect,
      normalizeDatasourceType
    } = require_datasource_dialect();
    var { pool } = require_database();
    var projectRepository = require_project_space_repository();
    var EXPORT_FORMAT_VERSION = "3.0.0";
    var V2_EXPORT_FORMAT_VERSION = "2.0.0";
    var LEGACY_EXPORT_FORMAT_VERSION = "1.0.0";
    var SUPPORTED_EXPORT_FORMAT_VERSIONS = /* @__PURE__ */ new Set([LEGACY_EXPORT_FORMAT_VERSION, V2_EXPORT_FORMAT_VERSION, EXPORT_FORMAT_VERSION]);
    var SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_]+$/;
    var INTERNAL_EXPORT_TABLES = /* @__PURE__ */ new Set([
      "project_asset_transfer_logs",
      "ingestion_kafka_offsets",
      "ingestion_ftp_file_states",
      "dev_sql_copilot_sessions",
      "dev_sql_copilot_messages",
      "qc_dict_mapping_template",
      "qc_dict_mapping_item",
      "qc_ops_robot_session",
      "qc_ops_robot_message",
      "std_import_batches",
      "std_import_errors"
    ]);
    var SENSITIVE_COLUMN_PATTERN = /(password|secret|token|credential|private_key|public_key|access_key|storage_key|api_key)/i;
    var SENSITIVE_JSON_KEY_PATTERN = /(password|secret|token|credential|privateKey|private_key|publicKey|public_key|accessKey|access_key|storageKey|storage_key|apiKey|api_key|saslPassword|sasl_password)/i;
    var DATABASE_ASSET_TABLES = /* @__PURE__ */ new Set([
      "data_sources",
      "ingestion_data_sources",
      "qc_data_sources",
      "dev_datasources",
      "service_data_sources",
      "report_data_sources",
      "data_lab_sources",
      "dm_data_sources"
    ]);
    var SHARED_PRIMARY_KEY_TABLES = {
      ingestion_data_sources: "data_sources",
      qc_data_sources: "data_sources"
    };
    var IMPLICIT_FOREIGN_KEYS = [
      { childTable: "report_dashboard_widgets", childColumn: "dashboard_id", parentTable: "report_dashboards", parentColumn: "id" },
      { childTable: "qc_monitor_table", childColumn: "business_system_id", parentTable: "dm_business_systems", parentColumn: "id" },
      { childTable: "qc_result_batch", childColumn: "task_id", parentTable: "qc_task", parentColumn: "id" },
      { childTable: "qc_result_batch", childColumn: "monitor_table_id", parentTable: "qc_monitor_table", parentColumn: "id" },
      { childTable: "qc_result_batch", childColumn: "source_id", parentTable: "data_sources", parentColumn: "id" },
      { childTable: "qc_result_batch", childColumn: "business_system_id", parentTable: "dm_business_systems", parentColumn: "id" },
      { childTable: "qc_result_rule_stat", childColumn: "monitor_table_id", parentTable: "qc_monitor_table", parentColumn: "id" },
      { childTable: "qc_result_rule_stat", childColumn: "business_system_id", parentTable: "dm_business_systems", parentColumn: "id" },
      { childTable: "qc_result_rule_stat", childColumn: "baseline_result_batch_id", parentTable: "qc_result_batch", parentColumn: "id" },
      { childTable: "qc_finding", childColumn: "monitor_table_id", parentTable: "qc_monitor_table", parentColumn: "id" },
      { childTable: "qc_finding", childColumn: "business_system_id", parentTable: "dm_business_systems", parentColumn: "id" },
      { childTable: "qc_finding", childColumn: "result_rule_stat_id", parentTable: "qc_result_rule_stat", parentColumn: "id" },
      { childTable: "qc_issue_occurrence", childColumn: "result_rule_stat_id", parentTable: "qc_result_rule_stat", parentColumn: "id" },
      { childTable: "qc_report", childColumn: "online_document_id", parentTable: "online_documents", parentColumn: "id" },
      { childTable: "qc_report", childColumn: "baseline_report_id", parentTable: "qc_report", parentColumn: "id" },
      { childTable: "qc_report", childColumn: "current_report_id", parentTable: "qc_report", parentColumn: "id" },
      { childTable: "qc_report", childColumn: "baseline_batch_id", parentTable: "qc_result_batch", parentColumn: "id" },
      { childTable: "qc_report", childColumn: "current_batch_id", parentTable: "qc_result_batch", parentColumn: "id" },
      { childTable: "dev_workflow_nodes", childColumn: "processing_job_id", parentTable: "dev_processing_jobs", parentColumn: "id" },
      { childTable: "dev_workflow_nodes", childColumn: "orchestration_task_id", parentTable: "dev_orchestration_tasks", parentColumn: "id" },
      { childTable: "dev_job_instances", childColumn: "processing_job_id", parentTable: "dev_processing_jobs", parentColumn: "id" },
      { childTable: "dev_job_instances", childColumn: "orchestration_task_id", parentTable: "dev_orchestration_tasks", parentColumn: "id" },
      { childTable: "online_documents", childColumn: "space_id", parentTable: "online_doc_spaces", parentColumn: "id" },
      { childTable: "online_doc_assets", childColumn: "space_id", parentTable: "online_doc_spaces", parentColumn: "id" },
      { childTable: "online_doc_assets", childColumn: "document_id", parentTable: "online_documents", parentColumn: "id" },
      { childTable: "online_doc_nodes", childColumn: "space_id", parentTable: "online_doc_spaces", parentColumn: "id" },
      { childTable: "online_doc_nodes", childColumn: "parent_id", parentTable: "online_doc_nodes", parentColumn: "id" },
      { childTable: "online_doc_nodes", childColumn: "document_id", parentTable: "online_documents", parentColumn: "id" }
    ];
    var RUNTIME_FILE_COLUMNS = [];
    var RUNTIME_ROOT = path.resolve(process.cwd(), "runtime");
    var MAX_RUNTIME_FILE_SIZE = 20 * 1024 * 1024;
    var PACKAGE_KEY_MIN_LENGTH = 12;
    var PACKAGE_KEY_DERIVATION_ITERATIONS = 21e4;
    var MODULE_REGISTRY = [
      { moduleKey: "dataSources", moduleName: "\u6570\u636E\u6E90", tablePrefixes: ["data_sources", "ingestion_data_sources", "qc_data_sources", "dev_datasources", "service_data_sources", "report_data_sources", "data_lab_sources"] },
      { moduleKey: "dataSourceResearch", moduleName: "\u6570\u636E\u8C03\u7814", tablePrefixes: ["data_source_research_"] },
      { moduleKey: "ingestion", moduleName: "\u6570\u636E\u63A5\u5165", tablePrefixes: ["ingestion_"] },
      { moduleKey: "fileImports", moduleName: "\u6587\u4EF6\u5BFC\u5165", tablePrefixes: ["file_import_"] },
      { moduleKey: "qualityControl", moduleName: "\u8D28\u91CF\u76D1\u63A7", tablePrefixes: ["qc_"] },
      { moduleKey: "dataDevelopment", moduleName: "\u6570\u636E\u5F00\u53D1", tablePrefixes: ["dev_"] },
      { moduleKey: "dataStandards", moduleName: "\u6570\u636E\u6807\u51C6", tablePrefixes: ["std_"] },
      { moduleKey: "dataMap", moduleName: "\u6570\u636E\u5730\u56FE", tablePrefixes: ["dm_"] },
      { moduleKey: "dataServices", moduleName: "\u6570\u636E\u670D\u52A1", tablePrefixes: ["service_"] },
      { moduleKey: "reporting", moduleName: "\u62A5\u8868\u5E73\u53F0", tablePrefixes: ["report_"] },
      { moduleKey: "dataLab", moduleName: "\u6570\u636E\u5B9E\u9A8C\u5BA4", tablePrefixes: ["lab_"] },
      { moduleKey: "assetSearch", moduleName: "\u8D44\u4EA7\u68C0\u7D22", tablePrefixes: ["asset_search_"] }
    ];
    function parseJson(value, fallback = {}) {
      if (!value) return fallback;
      if (typeof value === "object") return value;
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    function stableValue(value) {
      if (value instanceof Date) return value.toISOString();
      if (Buffer.isBuffer(value)) return value.toString("base64");
      if (Array.isArray(value)) return value.map((item) => stableValue(item));
      if (value && typeof value === "object") {
        return Object.keys(value).sort().reduce((result, key) => {
          result[key] = stableValue(value[key]);
          return result;
        }, {});
      }
      return value;
    }
    function calculateSha256(value) {
      return crypto.createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
    }
    function buildPackageIntegrity(packagePayload) {
      const packageWithoutIntegrity = {
        ...packagePayload,
        manifest: { ...packagePayload.manifest }
      };
      delete packageWithoutIntegrity.manifest.integrity;
      return {
        algorithm: "sha256",
        payloadSha256: calculateSha256(packageWithoutIntegrity),
        tables: packagePayload.tables.map((table) => ({
          tableName: table.tableName,
          rowCount: table.rows.length,
          sha256: calculateSha256({ tableName: table.tableName, columns: table.columns, rows: table.rows })
        }))
      };
    }
    function createPackageCryptoContext(packageKey) {
      if (typeof packageKey !== "string" || packageKey.length < PACKAGE_KEY_MIN_LENGTH) {
        throw new AppError(`\u52A0\u5BC6\u8FC1\u79FB\u53E3\u4EE4\u81F3\u5C11\u9700\u8981 ${PACKAGE_KEY_MIN_LENGTH} \u4F4D`, 400);
      }
      const salt = crypto.randomBytes(16);
      return {
        key: crypto.pbkdf2Sync(packageKey, salt, PACKAGE_KEY_DERIVATION_ITERATIONS, 32, "sha256"),
        metadata: {
          algorithm: "aes-256-gcm",
          keyDerivation: "pbkdf2-sha256",
          iterations: PACKAGE_KEY_DERIVATION_ITERATIONS,
          saltBase64: salt.toString("base64")
        }
      };
    }
    function getPackageCryptoKey(metadata, packageKey) {
      if (!metadata || metadata.algorithm !== "aes-256-gcm" || metadata.keyDerivation !== "pbkdf2-sha256") {
        throw new AppError("\u9879\u76EE\u5305\u654F\u611F\u914D\u7F6E\u52A0\u5BC6\u5143\u6570\u636E\u4E0D\u53D7\u652F\u6301", 400);
      }
      if (typeof packageKey !== "string" || packageKey.length < PACKAGE_KEY_MIN_LENGTH) {
        throw new AppError("\u8BE5\u9879\u76EE\u5305\u5305\u542B\u52A0\u5BC6\u654F\u611F\u914D\u7F6E\uFF0C\u8BF7\u63D0\u4F9B\u6B63\u786E\u7684\u8FC1\u79FB\u53E3\u4EE4", 400);
      }
      const iterations = Number(metadata.iterations);
      if (!Number.isInteger(iterations) || iterations < 1e5 || iterations > 1e6) {
        throw new AppError("\u9879\u76EE\u5305\u654F\u611F\u914D\u7F6E\u52A0\u5BC6\u53C2\u6570\u4E0D\u5408\u6CD5", 400);
      }
      return crypto.pbkdf2Sync(packageKey, Buffer.from(metadata.saltBase64, "base64"), iterations, 32, "sha256");
    }
    function encryptPackageValue(value, key) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const plaintext = Buffer.from(JSON.stringify(value), "utf8");
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      return {
        __medataEncrypted: true,
        ivBase64: iv.toString("base64"),
        authTagBase64: cipher.getAuthTag().toString("base64"),
        ciphertextBase64: ciphertext.toString("base64")
      };
    }
    function decryptPackageValue(value, key) {
      if (!value || value.__medataEncrypted !== true) return value;
      try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(value.ivBase64, "base64"));
        decipher.setAuthTag(Buffer.from(value.authTagBase64, "base64"));
        return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.ciphertextBase64, "base64")), decipher.final()]).toString("utf8"));
      } catch {
        throw new AppError("\u9879\u76EE\u5305\u654F\u611F\u914D\u7F6E\u65E0\u6CD5\u89E3\u5BC6\uFF0C\u8FC1\u79FB\u53E3\u4EE4\u4E0D\u6B63\u786E\u6216\u6570\u636E\u5DF2\u635F\u574F", 400);
      }
    }
    function isPathInside(parentPath, targetPath) {
      const relative = path.relative(parentPath, targetPath);
      return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
    }
    function normalizeRuntimeRelativePath(value, urlPrefix = "") {
      const text = String(value || "").trim().replace(/\\/g, "/");
      if (!text) return null;
      const relative = urlPrefix && text.startsWith(urlPrefix) ? text.slice(urlPrefix.length) : text.replace(/^\/+/, "").replace(/^runtime\//, "");
      if (!relative || relative.split("/").some((segment) => !segment || segment === "." || segment === "..")) return null;
      return relative;
    }
    function resolveRuntimeFilePath(value, fileRule) {
      const text = String(value || "").trim();
      if (!text) return null;
      if (fileRule.urlPrefix && text.startsWith(fileRule.urlPrefix)) {
        const relative = normalizeRuntimeRelativePath(text, fileRule.urlPrefix);
        return relative ? path.join(RUNTIME_ROOT, "online-docs-uploads", relative) : null;
      }
      const resolved = path.resolve(text);
      return isPathInside(RUNTIME_ROOT, resolved) ? resolved : null;
    }
    async function collectRuntimeFiles(tables) {
      const files = [];
      const warnings = [];
      for (const rule of RUNTIME_FILE_COLUMNS) {
        const table = tables.find((item) => item.tableName === rule.tableName);
        for (const row of table?.rows || []) {
          const sourcePath = row[rule.columnName];
          const absolutePath = resolveRuntimeFilePath(sourcePath, rule);
          if (!absolutePath) continue;
          try {
            const stat = await fs.stat(absolutePath);
            if (!stat.isFile()) continue;
            if (stat.size > MAX_RUNTIME_FILE_SIZE) {
              warnings.push(`\u8FD0\u884C\u65F6\u6587\u4EF6\u8D85\u8FC7 20MB\uFF0C\u672A\u7EB3\u5165\u9879\u76EE\u5305\uFF1A${path.basename(absolutePath)}`);
              continue;
            }
            const content = await fs.readFile(absolutePath);
            const relativePath = path.relative(RUNTIME_ROOT, absolutePath).replace(/\\/g, "/");
            files.push({
              tableName: rule.tableName,
              rowId: row.id,
              columnName: rule.columnName,
              relativePath,
              size: content.length,
              sha256: crypto.createHash("sha256").update(content).digest("hex"),
              contentBase64: content.toString("base64")
            });
          } catch {
            warnings.push(`\u8FD0\u884C\u65F6\u6587\u4EF6\u4E0D\u5B58\u5728\uFF0C\u672A\u7EB3\u5165\u9879\u76EE\u5305\uFF1A${String(sourcePath)}`);
          }
        }
      }
      return { files, warnings };
    }
    function adaptPackageToCurrent(packagePayload) {
      const sourceVersion = String(packagePayload?.manifest?.exportFormatVersion || "");
      if (sourceVersion === EXPORT_FORMAT_VERSION) return packagePayload;
      const legacyWarnings = sourceVersion === LEGACY_EXPORT_FORMAT_VERSION ? ["\u65E7\u7248\u9879\u76EE\u5305\u672A\u5305\u542B\u5B8C\u6574\u6027\u6821\u9A8C\u548C\u8DE8\u73AF\u5883\u5F15\u7528\u6620\u5C04\uFF0C\u5C06\u6309\u517C\u5BB9\u6A21\u5F0F\u5BFC\u5165\u3002"] : ["V2 \u9879\u76EE\u5305\u5C06\u6309 V3 \u517C\u5BB9\u9002\u914D\u5668\u5BFC\u5165\uFF1B\u672A\u5305\u542B\u7684\u8FD0\u884C\u65F6\u6587\u4EF6\u6309\u7A7A\u96C6\u5904\u7406\u3002"];
      return {
        ...packagePayload,
        files: Array.isArray(packagePayload.files) ? packagePayload.files : [],
        manifest: {
          ...packagePayload.manifest,
          exportFormatVersion: EXPORT_FORMAT_VERSION,
          compatibility: {
            ...packagePayload.manifest?.compatibility || {},
            adaptedFrom: sourceVersion,
            warnings: [...packagePayload.manifest?.compatibility?.warnings || [], ...legacyWarnings]
          }
        }
      };
    }
    function quoteIdentifier(name) {
      if (!SAFE_IDENTIFIER_PATTERN.test(name)) {
        throw new AppError(`\u4E0D\u5B89\u5168\u7684\u6570\u636E\u8868\u6807\u8BC6\uFF1A${name}`, 400);
      }
      return `\`${name}\``;
    }
    function inferModule(tableName) {
      const moduleDef = MODULE_REGISTRY.find(
        (item) => item.tablePrefixes.some((prefix) => tableName === prefix || tableName.startsWith(prefix))
      );
      return moduleDef || { moduleKey: "projectAssets", moduleName: "\u9879\u76EE\u8D44\u4EA7", tablePrefixes: [] };
    }
    async function listTables(connection) {
      const [rows] = await connection.query(
        `SELECT TABLE_NAME AS tableName
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME ASC`
      );
      return rows.map((row) => String(row.tableName || "")).filter((name) => SAFE_IDENTIFIER_PATTERN.test(name));
    }
    async function listColumns(connection, tableName) {
      const [rows] = await connection.query(
        `SELECT COLUMN_NAME AS columnName, EXTRA AS extraInfo, DATA_TYPE AS dataType,
            IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS columnDefault
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION ASC`,
        [tableName]
      );
      return rows.map((row) => ({
        columnName: String(row.columnName || ""),
        extraInfo: String(row.extraInfo || ""),
        dataType: String(row.dataType || ""),
        isNullable: String(row.isNullable || "").toUpperCase() === "YES",
        hasDefault: row.columnDefault !== null && row.columnDefault !== void 0
      })).filter((row) => SAFE_IDENTIFIER_PATTERN.test(row.columnName));
    }
    async function listForeignKeys(connection, tableNames) {
      if (tableNames.length === 0) return [];
      const placeholders = tableNames.map(() => "?").join(", ");
      const [rows] = await connection.query(
        `SELECT TABLE_NAME AS childTable, COLUMN_NAME AS childColumn,
            REFERENCED_TABLE_NAME AS parentTable, REFERENCED_COLUMN_NAME AS parentColumn
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND REFERENCED_TABLE_NAME IS NOT NULL
       AND TABLE_NAME IN (${placeholders})
       AND REFERENCED_TABLE_NAME IN (${placeholders})
     ORDER BY TABLE_NAME ASC, ORDINAL_POSITION ASC`,
        [...tableNames, ...tableNames]
      );
      return rows.map((row) => ({
        childTable: String(row.childTable || ""),
        childColumn: String(row.childColumn || ""),
        parentTable: String(row.parentTable || ""),
        parentColumn: String(row.parentColumn || "id")
      })).filter(
        (row) => SAFE_IDENTIFIER_PATTERN.test(row.childTable) && SAFE_IDENTIFIER_PATTERN.test(row.childColumn) && SAFE_IDENTIFIER_PATTERN.test(row.parentTable) && SAFE_IDENTIFIER_PATTERN.test(row.parentColumn)
      );
    }
    function buildImportOrder(tableNames, foreignKeys) {
      const sorted = [...tableNames].sort((left, right) => left.localeCompare(right));
      const inboundCounts = new Map(sorted.map((tableName) => [tableName, 0]));
      const adjacency = new Map(sorted.map((tableName) => [tableName, /* @__PURE__ */ new Set()]));
      for (const foreignKey of foreignKeys) {
        if (foreignKey.childTable === foreignKey.parentTable) continue;
        if (!adjacency.has(foreignKey.parentTable) || !adjacency.has(foreignKey.childTable)) continue;
        if (!adjacency.get(foreignKey.parentTable).has(foreignKey.childTable)) {
          adjacency.get(foreignKey.parentTable).add(foreignKey.childTable);
          inboundCounts.set(foreignKey.childTable, Number(inboundCounts.get(foreignKey.childTable) || 0) + 1);
        }
      }
      const queue = sorted.filter((tableName) => Number(inboundCounts.get(tableName) || 0) === 0);
      const visited = /* @__PURE__ */ new Set();
      const ordered = [];
      while (queue.length > 0) {
        queue.sort((left, right) => left.localeCompare(right));
        const tableName = queue.shift();
        if (!tableName || visited.has(tableName)) continue;
        visited.add(tableName);
        ordered.push(tableName);
        for (const childTable of [...adjacency.get(tableName) || []].sort((left, right) => left.localeCompare(right))) {
          const count = Number(inboundCounts.get(childTable) || 0) - 1;
          inboundCounts.set(childTable, count);
          if (count === 0) queue.push(childTable);
        }
      }
      return [...ordered, ...sorted.filter((tableName) => !visited.has(tableName))];
    }
    function moveTableBefore(tableNames, beforeTable, afterTable) {
      const beforeIndex = tableNames.indexOf(beforeTable);
      const afterIndex = tableNames.indexOf(afterTable);
      if (beforeIndex < 0 || afterIndex < 0 || beforeIndex < afterIndex) {
        return tableNames;
      }
      const next = [...tableNames];
      next.splice(beforeIndex, 1);
      next.splice(next.indexOf(afterTable), 0, beforeTable);
      return next;
    }
    async function getProjectScopedTables(connection) {
      const [rows] = await connection.query(
        `SELECT TABLE_NAME AS tableName
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND COLUMN_NAME = 'project_id'
       AND TABLE_NAME <> 'project_spaces'
     GROUP BY TABLE_NAME
     ORDER BY TABLE_NAME ASC`
      );
      return rows.map((row) => String(row.tableName || "")).filter((tableName) => SAFE_IDENTIFIER_PATTERN.test(tableName) && !INTERNAL_EXPORT_TABLES.has(tableName));
    }
    async function getRelatedChildTables(connection, projectScopedTables) {
      const allTables = await listTables(connection);
      const tableSet = new Set(projectScopedTables);
      let changed = true;
      while (changed) {
        changed = false;
        const foreignKeys = await listForeignKeys(connection, allTables);
        for (const foreignKey of foreignKeys) {
          if (tableSet.has(foreignKey.parentTable) && !tableSet.has(foreignKey.childTable) && !INTERNAL_EXPORT_TABLES.has(foreignKey.childTable)) {
            tableSet.add(foreignKey.childTable);
            changed = true;
          }
        }
      }
      return [...tableSet].sort((left, right) => left.localeCompare(right));
    }
    function shouldExportRow(tableName, row, projectScopedTables, exportedIds) {
      if (tableName === "qc_recommendation_run" && ["queued", "profiling"].includes(String(row.run_status || "").toLowerCase())) {
        return false;
      }
      if (projectScopedTables.has(tableName)) return true;
      return true;
    }
    function desensitizeRow(row) {
      const next = { ...row };
      for (const key of Object.keys(next)) {
        if (SENSITIVE_COLUMN_PATTERN.test(key) && next[key]) {
          next[key] = null;
        } else {
          next[key] = desensitizeNestedSensitiveValue(next[key]);
        }
      }
      return next;
    }
    function desensitizeNestedSensitiveValue(value) {
      if (Array.isArray(value)) {
        return value.map((item) => desensitizeNestedSensitiveValue(item));
      }
      if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
        return Object.entries(value).reduce((result, [key, item]) => {
          result[key] = SENSITIVE_JSON_KEY_PATTERN.test(key) && item ? null : desensitizeNestedSensitiveValue(item);
          return result;
        }, {});
      }
      if (typeof value === "string") {
        const text = value.trim();
        if (!text || !text.startsWith("{") && !text.startsWith("[")) return value;
        try {
          return JSON.stringify(desensitizeNestedSensitiveValue(JSON.parse(text)));
        } catch {
          return value;
        }
      }
      return value;
    }
    function encryptNestedSensitiveValue(value, key) {
      if (Array.isArray(value)) return value.map((item) => encryptNestedSensitiveValue(item, key));
      if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
        return Object.entries(value).reduce((result, [entryKey, item]) => {
          result[entryKey] = SENSITIVE_JSON_KEY_PATTERN.test(entryKey) && item ? encryptPackageValue(item, key) : encryptNestedSensitiveValue(item, key);
          return result;
        }, {});
      }
      if (typeof value === "string") {
        const text = value.trim();
        if (!text || !text.startsWith("{") && !text.startsWith("[")) return value;
        try {
          return JSON.stringify(encryptNestedSensitiveValue(JSON.parse(text), key));
        } catch {
          return value;
        }
      }
      return value;
    }
    function encryptSensitiveRow(row, key) {
      const next = { ...row };
      for (const columnName of Object.keys(next)) {
        if (SENSITIVE_COLUMN_PATTERN.test(columnName) && next[columnName]) {
          next[columnName] = encryptPackageValue(next[columnName], key);
        } else {
          next[columnName] = encryptNestedSensitiveValue(next[columnName], key);
        }
      }
      return next;
    }
    function decryptNestedSensitiveValue(value, key) {
      if (Array.isArray(value)) return value.map((item) => decryptNestedSensitiveValue(item, key));
      if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
        if (value.__medataEncrypted === true) return decryptPackageValue(value, key);
        return Object.entries(value).reduce((result, [entryKey, item]) => {
          result[entryKey] = decryptNestedSensitiveValue(item, key);
          return result;
        }, {});
      }
      if (typeof value === "string") {
        const text = value.trim();
        if (!text || !text.startsWith("{") && !text.startsWith("[")) return value;
        try {
          return JSON.stringify(decryptNestedSensitiveValue(JSON.parse(text), key));
        } catch {
          return value;
        }
      }
      return value;
    }
    function decryptPackageSensitiveData(packagePayload, packageKey) {
      if (packagePayload.manifest?.sensitiveMode !== "encrypted") return packagePayload;
      const key = getPackageCryptoKey(packagePayload.manifest.sensitiveEncryption, packageKey);
      return {
        ...packagePayload,
        tables: packagePayload.tables.map((table) => ({
          ...table,
          rows: table.rows.map((row) => decryptNestedSensitiveValue(row, key))
        }))
      };
    }
    async function exportTable(connection, tableName, columns, projectId, projectScopedTables, foreignKeysByChild, exportedIds, sensitiveMode, encryptionKey) {
      let rows = [];
      const orderBy = columns.some((column) => column.columnName === "id") ? " ORDER BY id ASC" : "";
      if (projectScopedTables.has(tableName)) {
        const [result] = await connection.query(
          `SELECT * FROM ${quoteIdentifier(tableName)} WHERE project_id = ?${orderBy}`,
          [projectId]
        );
        rows = result;
      } else {
        const linkedParentFilters = (foreignKeysByChild.get(tableName) || []).filter((foreignKey) => exportedIds.has(foreignKey.parentTable));
        const parentFilters = tableName === "report_dashboard_widgets" ? linkedParentFilters.filter((foreignKey) => foreignKey.parentTable === "report_dashboards") : linkedParentFilters;
        if (parentFilters.length === 0) {
          rows = [];
        } else {
          const clauses = [];
          const params = [];
          for (const foreignKey of parentFilters) {
            const ids = [...exportedIds.get(foreignKey.parentTable) || []];
            if (ids.length === 0) continue;
            clauses.push(`${quoteIdentifier(foreignKey.childColumn)} IN (${ids.map(() => "?").join(", ")})`);
            params.push(...ids);
          }
          if (clauses.length > 0) {
            const [result] = await connection.query(
              `SELECT * FROM ${quoteIdentifier(tableName)} WHERE ${clauses.join(" OR ")}${orderBy}`,
              params
            );
            rows = result;
          }
        }
      }
      const idSet = /* @__PURE__ */ new Set();
      for (const row of rows) {
        if (row.id !== void 0 && row.id !== null) {
          idSet.add(Number(row.id));
        }
      }
      exportedIds.set(tableName, idSet);
      return {
        tableName,
        moduleKey: inferModule(tableName).moduleKey,
        columns: columns.map((column) => column.columnName),
        rows: rows.filter((row) => shouldExportRow(tableName, row, projectScopedTables, exportedIds)).map((row) => {
          if (sensitiveMode === "desensitized") return desensitizeRow(row);
          if (sensitiveMode === "encrypted") return encryptSensitiveRow(row, encryptionKey);
          return row;
        })
      };
    }
    function buildModuleSummary(tables) {
      const summary = /* @__PURE__ */ new Map();
      for (const table of tables) {
        const moduleDef = inferModule(table.tableName);
        const current = summary.get(moduleDef.moduleKey) || {
          moduleKey: moduleDef.moduleKey,
          moduleName: moduleDef.moduleName,
          tableCount: 0,
          rowCount: 0
        };
        current.tableCount += 1;
        current.rowCount += table.rows.length;
        summary.set(moduleDef.moduleKey, current);
      }
      return [...summary.values()].sort((left, right) => left.moduleKey.localeCompare(right.moduleKey));
    }
    async function buildPortableReferences(connection, tables) {
      const projectMemberTable = tables.find((table) => table.tableName === "project_members");
      const qualityIssueTable = tables.find((table) => table.tableName === "qc_issue");
      const projectMemberUserIds = new Set((projectMemberTable?.rows || []).map((row) => Number(row.user_id)).filter(Number.isFinite));
      const qualityIssueOwnerIds = new Set((qualityIssueTable?.rows || []).map((row) => Number(row.owner_user_id)).filter((id) => Number.isFinite(id) && id > 0));
      const userIds = [.../* @__PURE__ */ new Set([...projectMemberUserIds, ...qualityIssueOwnerIds])];
      const providerIds = [];
      const references = { users: [], modelProviders: [] };
      if (userIds.length > 0) {
        const [rows] = await connection.query(
          `SELECT id, username, display_name AS displayName
       FROM users WHERE id IN (${userIds.map(() => "?").join(", ")})`,
          userIds
        );
        references.users = rows.map((row) => ({
          id: Number(row.id),
          username: row.username,
          displayName: row.displayName,
          required: projectMemberUserIds.has(Number(row.id))
        }));
      }
      if (providerIds.length > 0) {
        const [rows] = await connection.query(
          `SELECT id, config_code AS configCode, config_name AS configName, model_name AS modelName
       FROM model_providers WHERE id IN (${providerIds.map(() => "?").join(", ")})`,
          providerIds
        );
        references.modelProviders = rows.map((row) => ({
          id: Number(row.id),
          configCode: row.configCode,
          configName: row.configName,
          modelName: row.modelName
        }));
      }
      return references;
    }
    async function exportProject(projectId, options = {}, user = {}) {
      const project = await projectRepository.getProjectById(projectId);
      if (!project) {
        throw new AppError("\u9879\u76EE\u4E0D\u5B58\u5728\uFF0C\u65E0\u6CD5\u5BFC\u51FA", 404);
      }
      const sensitiveMode = options.sensitiveMode === "encrypted" ? "encrypted" : "desensitized";
      const cryptoContext = sensitiveMode === "encrypted" ? createPackageCryptoContext(options.packageKey) : null;
      const connection = await pool.getConnection();
      try {
        const projectScopedTableNames = await getProjectScopedTables(connection);
        const allExportTableNames = await getRelatedChildTables(connection, projectScopedTableNames);
        const foreignKeys = [
          ...await listForeignKeys(connection, allExportTableNames),
          ...IMPLICIT_FOREIGN_KEYS.filter((foreignKey) => allExportTableNames.includes(foreignKey.childTable) && allExportTableNames.includes(foreignKey.parentTable))
        ];
        const importOrder = buildImportOrder(allExportTableNames, foreignKeys);
        const columnsByTable = /* @__PURE__ */ new Map();
        for (const tableName of allExportTableNames) {
          columnsByTable.set(tableName, await listColumns(connection, tableName));
        }
        const foreignKeysByChild = /* @__PURE__ */ new Map();
        for (const foreignKey of foreignKeys) {
          if (!foreignKeysByChild.has(foreignKey.childTable)) {
            foreignKeysByChild.set(foreignKey.childTable, []);
          }
          foreignKeysByChild.get(foreignKey.childTable).push(foreignKey);
        }
        const exportedIds = /* @__PURE__ */ new Map();
        const projectScopedSet = new Set(projectScopedTableNames);
        const tables = [];
        for (const tableName of importOrder) {
          tables.push(await exportTable(
            connection,
            tableName,
            columnsByTable.get(tableName) || [],
            projectId,
            projectScopedSet,
            foreignKeysByChild,
            exportedIds,
            sensitiveMode,
            cryptoContext?.key
          ));
        }
        const nonEmptyTables = tables.filter((table) => table.rows.length > 0 || projectScopedSet.has(table.tableName));
        const runtimeFiles = await collectRuntimeFiles(nonEmptyTables);
        const packagePayload = {
          manifest: {
            exportFormatVersion: EXPORT_FORMAT_VERSION,
            appVersion: "2.0.0",
            packageType: "medata-project-assets",
            exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
            exportedBy: user.username || user.displayName || "system",
            sensitiveMode,
            ...cryptoContext ? { sensitiveEncryption: cryptoContext.metadata } : {},
            sourceProject: {
              id: project.id,
              code: project.projectCode,
              name: project.projectName,
              type: project.projectType
            },
            modules: buildModuleSummary(nonEmptyTables),
            compatibility: {
              minimumImportVersion: V2_EXPORT_FORMAT_VERSION,
              supportedLegacyVersions: [LEGACY_EXPORT_FORMAT_VERSION, V2_EXPORT_FORMAT_VERSION]
            },
            coverage: {
              configurationAssets: true,
              projectRuntimeFiles: true,
              externalPhysicalData: false,
              sensitiveConfiguration: sensitiveMode
            }
          },
          project: {
            projectName: project.projectName,
            projectCode: project.projectCode,
            projectType: project.projectType,
            description: project.description,
            ownerName: project.ownerName,
            status: project.status,
            resourceConfig: project.resourceConfig || {},
            settings: project.settings || {}
          },
          schema: {
            importOrder,
            foreignKeys
          },
          references: await buildPortableReferences(connection, nonEmptyTables),
          tables: nonEmptyTables,
          files: runtimeFiles.files
        };
        packagePayload.manifest.integrity = buildPackageIntegrity(packagePayload);
        await writeTransferLog({
          projectId,
          operationType: "export",
          status: "success",
          operatorName: user.username || user.displayName || "system",
          packageVersion: EXPORT_FORMAT_VERSION,
          modules: packagePayload.manifest.modules,
          summary: {
            tableCount: nonEmptyTables.length,
            rowCount: nonEmptyTables.reduce((sum, table) => sum + table.rows.length, 0),
            runtimeFileCount: runtimeFiles.files.length,
            warnings: runtimeFiles.warnings
          }
        });
        return packagePayload;
      } catch (error) {
        await writeTransferLog({
          projectId,
          operationType: "export",
          status: "failed",
          operatorName: user.username || user.displayName || "system",
          packageVersion: EXPORT_FORMAT_VERSION,
          modules: [],
          summary: {},
          errorMessage: error.message
        });
        throw error;
      } finally {
        connection.release();
      }
    }
    function validatePackage(packagePayload) {
      if (!packagePayload || typeof packagePayload !== "object") {
        throw new AppError("\u9879\u76EE\u8D44\u4EA7\u5305\u683C\u5F0F\u4E0D\u6B63\u786E", 400);
      }
      if (packagePayload.manifest?.packageType !== "medata-project-assets") {
        throw new AppError("\u4E0D\u662F\u6709\u6548\u7684 MeData \u9879\u76EE\u8D44\u4EA7\u5305", 400);
      }
      const sourceVersion = String(packagePayload.manifest?.exportFormatVersion || "");
      if (!SUPPORTED_EXPORT_FORMAT_VERSIONS.has(sourceVersion)) {
        throw new AppError("\u9879\u76EE\u8D44\u4EA7\u5305\u7248\u672C\u4E0D\u517C\u5BB9", 400, {
          supported: [...SUPPORTED_EXPORT_FORMAT_VERSIONS],
          actual: sourceVersion
        });
      }
      if (!Array.isArray(packagePayload.tables)) {
        throw new AppError("\u9879\u76EE\u8D44\u4EA7\u5305\u7F3A\u5C11\u8868\u6570\u636E", 400);
      }
      for (const table of packagePayload.tables) {
        if (!SAFE_IDENTIFIER_PATTERN.test(String(table?.tableName || "")) || !Array.isArray(table?.columns) || !Array.isArray(table?.rows)) {
          throw new AppError("\u9879\u76EE\u8D44\u4EA7\u5305\u5305\u542B\u65E0\u6548\u8868\u6570\u636E", 400);
        }
      }
      if (packagePayload.files !== void 0 && !Array.isArray(packagePayload.files)) {
        throw new AppError("\u9879\u76EE\u8D44\u4EA7\u5305\u8FD0\u884C\u65F6\u6587\u4EF6\u683C\u5F0F\u4E0D\u6B63\u786E", 400);
      }
      const integrity = packagePayload.manifest?.integrity;
      if (sourceVersion !== LEGACY_EXPORT_FORMAT_VERSION && !integrity) {
        throw new AppError("V2/V3 \u9879\u76EE\u8D44\u4EA7\u5305\u7F3A\u5C11\u5B8C\u6574\u6027\u6821\u9A8C\u4FE1\u606F", 400);
      }
      if (integrity) {
        if (integrity.algorithm !== "sha256") {
          throw new AppError("\u9879\u76EE\u8D44\u4EA7\u5305\u5B8C\u6574\u6027\u7B97\u6CD5\u4E0D\u53D7\u652F\u6301", 400);
        }
        const expectedTables = new Map((integrity.tables || []).map((item) => [item.tableName, item]));
        if (expectedTables.size !== packagePayload.tables.length) {
          throw new AppError("\u9879\u76EE\u8D44\u4EA7\u5305\u5B8C\u6574\u6027\u6E05\u5355\u4E0D\u5B8C\u6574", 400);
        }
        for (const table of packagePayload.tables) {
          const expected = expectedTables.get(table.tableName);
          const actualHash = calculateSha256({ tableName: table.tableName, columns: table.columns, rows: table.rows });
          if (!expected || Number(expected.rowCount) !== table.rows.length || expected.sha256 !== actualHash) {
            throw new AppError(`\u9879\u76EE\u8D44\u4EA7\u5305\u8868\u6570\u636E\u6821\u9A8C\u5931\u8D25\uFF1A${table.tableName}`, 400);
          }
        }
        for (const file of packagePayload.files || []) {
          if (!file?.tableName || !file?.columnName || !normalizeRuntimeRelativePath(file.relativePath) || !file.contentBase64) {
            throw new AppError("\u9879\u76EE\u8D44\u4EA7\u5305\u5305\u542B\u65E0\u6548\u8FD0\u884C\u65F6\u6587\u4EF6", 400);
          }
          const content = Buffer.from(file.contentBase64, "base64");
          const hash = crypto.createHash("sha256").update(content).digest("hex");
          if (content.length !== Number(file.size) || hash !== file.sha256) {
            throw new AppError(`\u9879\u76EE\u8D44\u4EA7\u5305\u8FD0\u884C\u65F6\u6587\u4EF6\u6821\u9A8C\u5931\u8D25\uFF1A${file.relativePath}`, 400);
          }
        }
        const actualPayloadHash = buildPackageIntegrity({
          ...packagePayload,
          manifest: { ...packagePayload.manifest, integrity: void 0 }
        }).payloadSha256;
        if (integrity.payloadSha256 !== actualPayloadHash) {
          throw new AppError("\u9879\u76EE\u8D44\u4EA7\u5305\u6574\u4F53\u6821\u9A8C\u5931\u8D25\uFF0C\u6587\u4EF6\u53EF\u80FD\u5DF2\u635F\u574F\u6216\u88AB\u4FEE\u6539", 400);
        }
      }
      return adaptPackageToCurrent(packagePayload);
    }
    function collectPackageDatabaseTypes(packagePayload) {
      const types = /* @__PURE__ */ new Set();
      for (const table of packagePayload?.tables || []) {
        if (!DATABASE_ASSET_TABLES.has(table.tableName)) continue;
        for (const row of table.rows || []) {
          const storedType = row.source_type || row.storage_type || row.datasource_type || row.sourceType || row.storageType;
          const config = parseJson(
            row.connection_config_json || row.connection_config || row.extra_config_json || row.connectionConfig,
            {}
          );
          const dialect = inferDatasourceDialect(storedType, config);
          const normalized = normalizeDatasourceType(dialect || storedType);
          if (isSupportedDatabaseType(normalized)) types.add(normalized);
        }
      }
      return [...types];
    }
    function validatePackageDatabaseCapabilities(packagePayload, statuses = getRuntimeDatabaseCapabilityStatus()) {
      const statusByType = new Map(statuses.map((item) => [item.type, item]));
      const errors = [];
      for (const type of collectPackageDatabaseTypes(packagePayload)) {
        const status = statusByType.get(type);
        if (!status?.queryReady) errors.push(`${status?.label || type} \u67E5\u8BE2\u9A71\u52A8\u672A\u5C31\u7EEA`);
        if (!status?.dataxReaderReady) errors.push(`${status?.label || type} DataX \u8BFB\u53D6\u63D2\u4EF6\u672A\u5C31\u7EEA`);
        if (!status?.dataxWriterReady) errors.push(`${status?.label || type} DataX \u5199\u5165\u63D2\u4EF6\u672A\u5C31\u7EEA`);
      }
      if (errors.length) {
        throw new AppError(`\u76EE\u6807\u73AF\u5883\u6570\u636E\u5E93\u80FD\u529B\u4E0D\u5B8C\u6574\uFF1A${errors.join("\uFF1B")}`, 400, { databaseCapabilityErrors: errors });
      }
      return collectPackageDatabaseTypes(packagePayload);
    }
    async function readPackageFile(file) {
      if (!file?.path) {
        throw new AppError("\u8BF7\u4E0A\u4F20\u9879\u76EE\u8D44\u4EA7\u5305\u6587\u4EF6", 400);
      }
      const raw = await fs.readFile(file.path, "utf8");
      try {
        return JSON.parse(raw);
      } catch {
        throw new AppError("\u9879\u76EE\u8D44\u4EA7\u5305\u4E0D\u662F\u6709\u6548 JSON \u6587\u4EF6", 400);
      } finally {
        await fs.unlink(file.path).catch(() => {
        });
      }
    }
    async function ensureTransferLogTable() {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS project_asset_transfer_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      project_id BIGINT NULL,
      operation_type VARCHAR(16) NOT NULL,
      package_version VARCHAR(32) NULL,
      modules_json JSON NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'running',
      summary_json JSON NULL,
      error_message TEXT NULL,
      operator_name VARCHAR(64) NOT NULL DEFAULT 'system',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_project_asset_transfer_project (project_id, created_at, id),
      KEY idx_project_asset_transfer_operation (operation_type, status, created_at)
    )`
      );
    }
    async function writeTransferLog(payload) {
      await ensureTransferLogTable();
      await pool.query(
        `INSERT INTO project_asset_transfer_logs
      (project_id, operation_type, package_version, modules_json, status, summary_json, error_message, operator_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.projectId || null,
          payload.operationType,
          payload.packageVersion || EXPORT_FORMAT_VERSION,
          JSON.stringify(payload.modules || []),
          payload.status || "success",
          JSON.stringify(payload.summary || {}),
          payload.errorMessage || null,
          payload.operatorName || "system"
        ]
      );
    }
    async function listTransferLogs(projectId) {
      await ensureTransferLogTable();
      const params = [];
      let where = "";
      if (projectId) {
        where = "WHERE project_id = ?";
        params.push(projectId);
      }
      const [rows] = await pool.query(
        `SELECT id, project_id AS projectId, operation_type AS operationType, package_version AS packageVersion,
            modules_json AS modules, status, summary_json AS summary, error_message AS errorMessage,
            operator_name AS operatorName, created_at AS createdAt, updated_at AS updatedAt
     FROM project_asset_transfer_logs
     ${where}
     ORDER BY id DESC
     LIMIT 100`,
        params
      );
      return rows.map((row) => ({
        ...row,
        id: Number(row.id),
        projectId: row.projectId ? Number(row.projectId) : null,
        modules: parseJson(row.modules, []),
        summary: parseJson(row.summary, {})
      }));
    }
    async function ensureProjectBackupTable() {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS project_asset_backups (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      source_project_id BIGINT NOT NULL,
      package_version VARCHAR(32) NOT NULL,
      package_sha256 CHAR(64) NULL,
      package_json LONGTEXT NOT NULL,
      created_by VARCHAR(64) NOT NULL DEFAULT 'system',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_project_asset_backup_project_created (source_project_id, created_at, id)
    )`
      );
    }
    async function createProjectBackup(projectId, user = {}) {
      const project = await projectRepository.getProjectById(projectId);
      if (!project) throw new AppError("\u9879\u76EE\u4E0D\u5B58\u5728\uFF0C\u65E0\u6CD5\u521B\u5EFA\u5907\u4EFD", 404);
      const packagePayload = await exportProject(projectId, { sensitiveMode: "desensitized" }, user);
      await ensureProjectBackupTable();
      const [result] = await pool.query(
        `INSERT INTO project_asset_backups
      (source_project_id, package_version, package_sha256, package_json, created_by)
     VALUES (?, ?, ?, ?, ?)`,
        [
          projectId,
          packagePayload.manifest.exportFormatVersion,
          packagePayload.manifest.integrity?.payloadSha256 || null,
          JSON.stringify(packagePayload),
          user.username || user.displayName || "system"
        ]
      );
      return {
        id: Number(result.insertId),
        projectId,
        packageVersion: packagePayload.manifest.exportFormatVersion,
        packageSha256: packagePayload.manifest.integrity?.payloadSha256 || null,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    async function listProjectBackups(projectId) {
      await ensureProjectBackupTable();
      const [rows] = await pool.query(
        `SELECT id, source_project_id AS projectId, package_version AS packageVersion,
            package_sha256 AS packageSha256, created_by AS createdBy, created_at AS createdAt
     FROM project_asset_backups
     WHERE source_project_id = ?
     ORDER BY id DESC
     LIMIT 100`,
        [projectId]
      );
      return rows.map((row) => ({ ...row, id: Number(row.id), projectId: Number(row.projectId) }));
    }
    async function getProjectBackup(projectId, backupId) {
      await ensureProjectBackupTable();
      const [rows] = await pool.query(
        `SELECT package_json AS packageJson
     FROM project_asset_backups
     WHERE id = ? AND source_project_id = ?
     LIMIT 1`,
        [backupId, projectId]
      );
      if (!rows[0]) throw new AppError("\u9879\u76EE\u5907\u4EFD\u4E0D\u5B58\u5728", 404);
      return parseJson(rows[0].packageJson, null);
    }
    async function buildReferenceMappings(connection, packagePayload) {
      const references = packagePayload.references || {};
      const mappings = { users: /* @__PURE__ */ new Map(), modelProviders: /* @__PURE__ */ new Map(), warnings: [] };
      const users = Array.isArray(references.users) ? references.users : [];
      const providers = Array.isArray(references.modelProviders) ? references.modelProviders : [];
      for (const user of users) {
        const [rows] = await connection.query("SELECT id FROM users WHERE username = ? LIMIT 1", [user.username]);
        if (!rows[0]) {
          if (user.required !== false) throw new AppError(`\u76EE\u6807\u73AF\u5883\u4E0D\u5B58\u5728\u9879\u76EE\u6210\u5458\u8D26\u53F7\uFF1A${user.username}`, 400);
          mappings.warnings.push(`\u8D28\u91CF\u95EE\u9898\u8D1F\u8D23\u4EBA\u8D26\u53F7 ${user.username} \u5728\u76EE\u6807\u73AF\u5883\u4E0D\u5B58\u5728\uFF0C\u76F8\u5173\u95EE\u9898\u5C06\u4FDD\u7559\u8D1F\u8D23\u4EBA\u540D\u79F0\u4F46\u4E0D\u81EA\u52A8\u7ED1\u5B9A\u8D26\u53F7`);
          continue;
        }
        mappings.users.set(String(user.id), Number(rows[0].id));
      }
      for (const provider of providers) {
        const [rows] = await connection.query("SELECT id FROM model_providers WHERE config_code = ? LIMIT 1", [provider.configCode]);
        if (!rows[0]) {
          throw new AppError(`\u76EE\u6807\u73AF\u5883\u7F3A\u5C11\u667A\u80FD\u4F53\u4F9D\u8D56\u7684\u6A21\u578B\u914D\u7F6E\uFF1A${provider.configCode}`, 400);
        }
        mappings.modelProviders.set(String(provider.id), Number(rows[0].id));
      }
      if (!packagePayload.references) {
        mappings.warnings.push("\u65E7\u7248\u9879\u76EE\u5305\u672A\u643A\u5E26\u8DE8\u73AF\u5883\u5F15\u7528\u6620\u5C04\uFF0C\u6210\u5458\u4E0E\u6A21\u578B\u5F15\u7528\u5C06\u6309\u5386\u53F2 ID \u517C\u5BB9\u5BFC\u5165\u3002");
      }
      return mappings;
    }
    async function preflightImport(connection, packagePayload) {
      const missingTables = [];
      const missingColumns = [];
      for (const table of packagePayload.tables) {
        const targetColumns = await listColumns(connection, table.tableName);
        if (targetColumns.length === 0) {
          missingTables.push(table.tableName);
          continue;
        }
        const targetColumnNames = new Set(targetColumns.map((column) => column.columnName));
        const missing = table.columns.filter((columnName) => !targetColumnNames.has(columnName));
        if (missing.length > 0) {
          missingColumns.push({ tableName: table.tableName, columns: missing });
        }
      }
      if (missingTables.length > 0 || missingColumns.length > 0) {
        throw new AppError("\u76EE\u6807\u73AF\u5883\u5C1A\u672A\u5B8C\u6210\u9879\u76EE\u5305\u6240\u9700\u7684\u6570\u636E\u7ED3\u6784\u5347\u7EA7", 400, { missingTables, missingColumns });
      }
      const referenceMappings = await buildReferenceMappings(connection, packagePayload);
      return {
        referenceMappings,
        warnings: [
          ...packagePayload.manifest?.compatibility?.warnings || [],
          ...referenceMappings.warnings
        ]
      };
    }
    async function adaptExternalStandardReferences(connection, packagePayload) {
      const mappingTable = packagePayload.tables.find((table) => table.tableName === "std_field_mappings");
      if (!mappingTable?.rows?.length) return packagePayload;
      const sourceElementIds = [...new Set(mappingTable.rows.map((row) => Number(row.element_id)).filter((id) => Number.isFinite(id) && id > 0))];
      if (sourceElementIds.length === 0) return packagePayload;
      const [rows] = await connection.query(
        `SELECT id FROM std_data_elements WHERE id IN (${sourceElementIds.map(() => "?").join(", ")})`,
        sourceElementIds
      );
      const availableIds = new Set(rows.map((row) => Number(row.id)));
      const retainedRows = mappingTable.rows.filter((row) => availableIds.has(Number(row.element_id)));
      const skippedCount = mappingTable.rows.length - retainedRows.length;
      if (skippedCount === 0) return packagePayload;
      const warning = `\u76EE\u6807\u73AF\u5883\u7F3A\u5C11\u9879\u76EE\u5305\u5F15\u7528\u7684\u5168\u5C40\u6807\u51C6\u6570\u636E\u5143\uFF0C\u5DF2\u8DF3\u8FC7 ${skippedCount} \u6761\u5B57\u6BB5\u91C7\u6807\u6620\u5C04\uFF1B\u5176\u4ED6\u9879\u76EE\u8D44\u4EA7\u4E0D\u53D7\u5F71\u54CD\u3002`;
      return {
        ...packagePayload,
        tables: packagePayload.tables.map((table) => table.tableName === "std_field_mappings" ? { ...table, rows: retainedRows } : table),
        manifest: {
          ...packagePayload.manifest,
          compatibility: {
            ...packagePayload.manifest?.compatibility || {},
            warnings: [...packagePayload.manifest?.compatibility?.warnings || [], warning]
          }
        }
      };
    }
    function buildRuntimeFileMap(packagePayload, targetProjectId, importId = crypto.randomUUID()) {
      return new Map((packagePayload.files || []).map((file) => {
        const extension = path.extname(file.relativePath || "").slice(0, 24);
        const fileName = `${crypto.createHash("sha256").update(`${file.tableName}:${file.rowId}:${file.columnName}:${file.relativePath}`).digest("hex").slice(0, 20)}${extension}`;
        return [
          `${file.tableName}:${file.rowId}:${file.columnName}`,
          { ...file, relativePath: `project-assets/${targetProjectId}/${importId}/${fileName}` }
        ];
      }));
    }
    function resolveImportedRuntimeValue(tableName, row, columnName, runtimeFileMap) {
      const file = runtimeFileMap?.get(`${tableName}:${row.id}:${columnName}`);
      if (!file) return void 0;
      return path.join(RUNTIME_ROOT, file.relativePath);
    }
    async function restoreRuntimeFiles(files = []) {
      const restoredPaths = [];
      for (const file of files) {
        const targetPath = path.resolve(RUNTIME_ROOT, file.relativePath);
        if (!isPathInside(RUNTIME_ROOT, targetPath)) {
          throw new AppError(`\u8FD0\u884C\u65F6\u6587\u4EF6\u8DEF\u5F84\u4E0D\u5B89\u5168\uFF1A${file.relativePath}`, 400);
        }
        const content = Buffer.from(file.contentBase64, "base64");
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, content);
        restoredPaths.push(targetPath);
      }
      return restoredPaths;
    }
    function buildColumnValue(tableName, row, columnName, targetProjectId, idMaps, foreignKeys, referenceMappings, runtimeFileMap) {
      if (columnName === "project_id") return targetProjectId;
      if (tableName === "qc_standard_dictionary" && columnName === "source_system_id") {
        return idMaps.get("dm_business_systems")?.get(String(row.source_system_id)) || null;
      }
      if (tableName === "qc_standard_dictionary" && columnName === "source_id") {
        return idMaps.get("qc_data_sources")?.get(String(row.source_id)) || idMaps.get("data_sources")?.get(String(row.source_id)) || null;
      }
      if (tableName === "qc_strategy" && columnName === "current_version_id") {
        return null;
      }
      const runtimeValue = resolveImportedRuntimeValue(tableName, row, columnName, runtimeFileMap);
      if (runtimeValue !== void 0) return runtimeValue;
      if (tableName === "project_members" && columnName === "user_id" && referenceMappings?.users?.has(String(row.user_id))) {
        return referenceMappings.users.get(String(row.user_id));
      }
      if (tableName === "qc_issue" && columnName === "owner_user_id") {
        return referenceMappings?.users?.get(String(row.owner_user_id)) || null;
      }
      if (columnName === "id" && SHARED_PRIMARY_KEY_TABLES[tableName] && idMaps.has(SHARED_PRIMARY_KEY_TABLES[tableName])) {
        return idMaps.get(SHARED_PRIMARY_KEY_TABLES[tableName]).get(String(row.id)) || row.id;
      }
      const foreignKey = foreignKeys.find((item) => item.childColumn === columnName);
      if (foreignKey && foreignKey.childTable === foreignKey.parentTable) {
        return null;
      }
      if (foreignKey && idMaps.has(foreignKey.parentTable)) {
        const mapped = idMaps.get(foreignKey.parentTable).get(String(row[columnName]));
        return mapped || null;
      }
      if (foreignKey && row[columnName] !== null && row[columnName] !== void 0) {
        return null;
      }
      return row[columnName] === void 0 ? null : row[columnName];
    }
    function formatMysqlDateTime(value) {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const pad = (number) => String(number).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }
    function formatMysqlDate(value) {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const pad = (number) => String(number).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
    function normalizeImportBusinessValue(tableName, columnName, value, context) {
      if ((tableName === "dev_workflows" || tableName === "dev_orchestration_tasks") && columnName === "is_paused") {
        return 1;
      }
      if (tableName === "dev_workflows" && columnName === "published_version_no") {
        return null;
      }
      if (context.mode !== "new") return value;
      if (tableName === "service_apis" && columnName === "service_path" && value) {
        const normalizedPath = String(value).startsWith("/") ? String(value) : `/${value}`;
        return `/imported/project-${context.targetProjectId}${normalizedPath}`;
      }
      if (tableName === "service_api_call_logs" && columnName === "service_path" && value) {
        const normalizedPath = String(value).startsWith("/") ? String(value) : `/${value}`;
        return `/imported/project-${context.targetProjectId}${normalizedPath}`;
      }
      if (tableName === "service_apps" && columnName === "app_token") {
        return `imported_${context.targetProjectId}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
      }
      return value;
    }
    function buildDuplicateStrategy(tableName) {
      if (tableName === "project_members") {
        return "update";
      }
      return "error";
    }
    function normalizeInsertValue(value, column) {
      if (value === void 0) return null;
      if (value === null) return null;
      if (column?.dataType === "date" && (value instanceof Date || typeof value === "string")) {
        return formatMysqlDate(value);
      }
      if (["datetime", "timestamp"].includes(column?.dataType) && (value instanceof Date || typeof value === "string")) {
        return formatMysqlDateTime(value);
      }
      if (value instanceof Date) return formatMysqlDateTime(value);
      if (Buffer.isBuffer(value)) return value;
      if (typeof value === "object") return JSON.stringify(value);
      return value;
    }
    function shouldUseColumnDefault(value, column) {
      return (value === null || value === void 0) && column && !column.isNullable && column.hasDefault;
    }
    async function backfillSelfReferences(connection, tableName, table, selfForeignKeys, idMap) {
      if (!selfForeignKeys.length || !idMap || idMap.size === 0) return;
      for (const row of table.rows) {
        const newId = idMap.get(String(row.id));
        if (!newId) continue;
        for (const foreignKey of selfForeignKeys) {
          const oldParentId = row[foreignKey.childColumn];
          if (!oldParentId) continue;
          const newParentId = idMap.get(String(oldParentId));
          if (!newParentId) continue;
          await connection.query(
            `UPDATE ${quoteIdentifier(tableName)}
         SET ${quoteIdentifier(foreignKey.childColumn)} = ?
         WHERE id = ?`,
            [newParentId, newId]
          );
        }
      }
    }
    async function backfillForeignReferences(connection, tablesByName, foreignKeys, idMaps) {
      for (const foreignKey of foreignKeys) {
        if (foreignKey.childTable === foreignKey.parentTable) continue;
        const childTable = tablesByName.get(foreignKey.childTable);
        const childIdMap = idMaps.get(foreignKey.childTable);
        const parentIdMap = idMaps.get(foreignKey.parentTable);
        if (!childTable || !childIdMap || !parentIdMap) continue;
        for (const row of childTable.rows || []) {
          const newChildId = childIdMap.get(String(row.id));
          const oldParentId = row[foreignKey.childColumn];
          const newParentId = oldParentId === null || oldParentId === void 0 ? null : parentIdMap.get(String(oldParentId));
          if (!newChildId || oldParentId !== null && oldParentId !== void 0 && !newParentId) continue;
          await connection.query(
            `UPDATE ${quoteIdentifier(foreignKey.childTable)}
         SET ${quoteIdentifier(foreignKey.childColumn)} = ?
         WHERE id = ?`,
            [newParentId, newChildId]
          );
        }
      }
    }
    async function backfillQualityPolymorphicReferences(connection, tablesByName, idMaps) {
      const strategyTable = tablesByName.get("qc_strategy");
      const strategyIdMap = idMaps.get("qc_strategy");
      const strategyVersionIdMap = idMaps.get("qc_strategy_version");
      if (strategyTable && strategyIdMap && strategyVersionIdMap) {
        for (const row of strategyTable.rows || []) {
          const newStrategyId = strategyIdMap.get(String(row.id));
          const newVersionId = row.current_version_id ? strategyVersionIdMap.get(String(row.current_version_id)) : null;
          if (newStrategyId) {
            await connection.query("UPDATE qc_strategy SET current_version_id=? WHERE id=?", [newVersionId || null, newStrategyId]);
          }
        }
      }
      for (const tableName of ["qc_report", "qc_ai_analysis_run"]) {
        const table = tablesByName.get(tableName);
        const rowIdMap = idMaps.get(tableName);
        if (!table || !rowIdMap) continue;
        for (const row of table.rows || []) {
          const newRowId = rowIdMap.get(String(row.id));
          if (!newRowId) continue;
          const scope = String(row.report_scope || row.scope_type || "").toLowerCase();
          const parentTable = scope === "system" ? "dm_business_systems" : ["table", "comparison"].includes(scope) ? "qc_monitor_table" : null;
          const mappedScopeRefId = parentTable && row.scope_ref_id ? idMaps.get(parentTable)?.get(String(row.scope_ref_id)) || null : null;
          const updates = ["scope_ref_id = ?"];
          const params = [mappedScopeRefId];
          if (tableName === "qc_report" && Object.prototype.hasOwnProperty.call(row, "object_ref_id")) {
            const objectParentTable = row.object_type === "system" ? "dm_business_systems" : row.object_type === "table" ? "qc_monitor_table" : null;
            const mappedObjectRefId = objectParentTable && row.object_ref_id ? idMaps.get(objectParentTable)?.get(String(row.object_ref_id)) || null : null;
            updates.push("object_ref_id = ?");
            params.push(mappedObjectRefId);
          }
          if (tableName === "qc_report" && row.batch_ids_json) {
            const oldBatchIds = parseJson(row.batch_ids_json, []);
            const mappedBatchIds = (Array.isArray(oldBatchIds) ? oldBatchIds : []).map((id) => idMaps.get("qc_result_batch")?.get(String(id))).filter(Boolean);
            updates.push("batch_ids_json = ?");
            params.push(JSON.stringify(mappedBatchIds));
          }
          if (tableName === "qc_report" && row.deterministic_summary_json) {
            const summary = parseJson(row.deterministic_summary_json, {});
            const mapId = (table2, value) => value ? idMaps.get(table2)?.get(String(value)) || null : null;
            if (Array.isArray(summary.batchIds)) summary.batchIds = summary.batchIds.map((id) => mapId("qc_result_batch", id)).filter(Boolean);
            if (summary.scope === "table" && summary.batch?.id) summary.batch.id = mapId("qc_result_batch", summary.batch.id);
            if (summary.scope === "comparison" && String(summary.comparisonType || "batch") === "batch") {
              if (summary.current?.id) summary.current.id = mapId("qc_result_batch", summary.current.id);
              if (summary.previous?.id) summary.previous.id = mapId("qc_result_batch", summary.previous.id);
            }
            if (summary.scope === "comparison" && String(summary.comparisonType || "batch") !== "batch") {
              if (summary.current?.reportId) summary.current.reportId = mapId("qc_report", summary.current.reportId);
              if (summary.previous?.reportId) summary.previous.reportId = mapId("qc_report", summary.previous.reportId);
              if (summary.sourceReports?.baselineReportId) summary.sourceReports.baselineReportId = mapId("qc_report", summary.sourceReports.baselineReportId);
              if (summary.sourceReports?.currentReportId) summary.sourceReports.currentReportId = mapId("qc_report", summary.sourceReports.currentReportId);
            }
            if (summary.table?.monitorTableId) summary.table.monitorTableId = mapId("qc_monitor_table", summary.table.monitorTableId);
            if (summary.object?.type === "table" && summary.object.objectRefId) summary.object.objectRefId = mapId("qc_monitor_table", summary.object.objectRefId);
            if (summary.object?.type === "system" && summary.object.objectRefId) summary.object.objectRefId = mapId("dm_business_systems", summary.object.objectRefId);
            if (summary.targetSystem?.businessSystemId) summary.targetSystem.businessSystemId = mapId("dm_business_systems", summary.targetSystem.businessSystemId);
            for (const table2 of summary.tables || []) {
              if (table2.resultBatchId) table2.resultBatchId = mapId("qc_result_batch", table2.resultBatchId);
              if (table2.monitorTableId) table2.monitorTableId = mapId("qc_monitor_table", table2.monitorTableId);
              if (table2.businessSystemId) table2.businessSystemId = mapId("dm_business_systems", table2.businessSystemId);
            }
            updates.push("deterministic_summary_json = ?");
            params.push(JSON.stringify(summary));
          }
          params.push(newRowId);
          await connection.query(
            `UPDATE ${quoteIdentifier(tableName)} SET ${updates.join(", ")} WHERE id = ?`,
            params
          );
        }
      }
    }
    async function importRows(connection, packagePayload, targetProjectId, options = {}) {
      const tablesByName = new Map(packagePayload.tables.map((table) => [table.tableName, table]));
      const tableNames = packagePayload.tables.map((table) => table.tableName);
      const foreignKeys = [
        ...await listForeignKeys(connection, tableNames),
        ...IMPLICIT_FOREIGN_KEYS.filter((foreignKey) => tableNames.includes(foreignKey.childTable) && tableNames.includes(foreignKey.parentTable))
      ];
      const importOrder = moveTableBefore(
        buildImportOrder(tableNames, foreignKeys),
        "report_dashboards",
        "report_dashboard_widgets"
      );
      const foreignKeysByChild = /* @__PURE__ */ new Map();
      for (const foreignKey of foreignKeys) {
        if (!foreignKeysByChild.has(foreignKey.childTable)) {
          foreignKeysByChild.set(foreignKey.childTable, []);
        }
        foreignKeysByChild.get(foreignKey.childTable).push(foreignKey);
      }
      const idMaps = /* @__PURE__ */ new Map();
      const summary = [];
      for (const tableName of importOrder) {
        const table = tablesByName.get(tableName);
        if (!table || !Array.isArray(table.rows) || table.rows.length === 0) continue;
        const existingColumns = await listColumns(connection, tableName);
        const columnsByName = new Map(existingColumns.map((column) => [column.columnName, column]));
        const autoColumns = new Set(existingColumns.filter((column) => column.extraInfo.includes("auto_increment")).map((column) => column.columnName));
        const insertColumns = existingColumns.map((column) => column.columnName).filter((columnName) => !autoColumns.has(columnName) && table.columns.includes(columnName));
        const tableIdMap = /* @__PURE__ */ new Map();
        for (const row of table.rows) {
          const insertEntries = insertColumns.map((columnName) => {
            const column = columnsByName.get(columnName);
            const businessValue = normalizeImportBusinessValue(
              tableName,
              columnName,
              buildColumnValue(tableName, row, columnName, targetProjectId, idMaps, foreignKeysByChild.get(tableName) || [], options.referenceMappings, options.runtimeFileMap),
              { mode: options.mode || "new", targetProjectId }
            );
            return {
              columnName,
              column,
              businessValue,
              value: normalizeInsertValue(
                businessValue,
                column
              )
            };
          }).filter(({ businessValue, column }) => !shouldUseColumnDefault(businessValue, column));
          const rowInsertColumns = insertEntries.map(({ columnName }) => columnName);
          const values = insertEntries.map(({ value }) => value);
          const updateColumns = rowInsertColumns.filter(
            (columnName) => columnName !== "id" && columnName !== "project_id" && columnName !== "user_id" && columnName !== "created_at"
          );
          const duplicateUpdateSql = buildDuplicateStrategy(tableName) === "update" && updateColumns.length > 0 ? `ON DUPLICATE KEY UPDATE ${updateColumns.map((columnName) => `${quoteIdentifier(columnName)} = VALUES(${quoteIdentifier(columnName)})`).join(", ")}` : "";
          const [result] = await connection.query(
            `INSERT INTO ${quoteIdentifier(tableName)}
          (${rowInsertColumns.map(quoteIdentifier).join(", ")})
         VALUES (${rowInsertColumns.map(() => "?").join(", ")})
         ${duplicateUpdateSql}`,
            values
          );
          if (row.id !== void 0 && row.id !== null) {
            const insertedIdColumnIndex = rowInsertColumns.indexOf("id");
            const insertedId = insertedIdColumnIndex >= 0 ? values[insertedIdColumnIndex] : result.insertId;
            tableIdMap.set(String(row.id), Number(insertedId || result.insertId || row.id));
          }
        }
        idMaps.set(tableName, tableIdMap);
        await backfillSelfReferences(
          connection,
          tableName,
          table,
          (foreignKeysByChild.get(tableName) || []).filter((foreignKey) => foreignKey.childTable === foreignKey.parentTable),
          tableIdMap
        );
        summary.push({ tableName, rowCount: table.rows.length });
      }
      await backfillForeignReferences(connection, tablesByName, foreignKeys, idMaps);
      await backfillQualityPolymorphicReferences(connection, tablesByName, idMaps);
      return summary;
    }
    function normalizeProjectCode(value) {
      return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
    }
    async function createImportedProject(connection, packagePayload, user, options = {}) {
      const sourceProject = packagePayload.project || {};
      const requestedCode = normalizeProjectCode(options.targetProjectCode);
      const baseCode = requestedCode || normalizeProjectCode(`${sourceProject.projectCode || "imported"}_import_${Date.now()}`);
      const projectName = String(options.targetProjectName || "").trim() || `${sourceProject.projectName || "\u5BFC\u5165\u9879\u76EE"}-\u5BFC\u5165`;
      const [existingRows] = await connection.query(
        `SELECT id FROM project_spaces WHERE project_code = ? LIMIT 1`,
        [baseCode]
      );
      if (existingRows.length > 0) {
        throw new AppError("\u5BFC\u5165\u9879\u76EE\u7F16\u7801\u5DF2\u5B58\u5728\uFF0C\u8BF7\u91CD\u65B0\u586B\u5199\u9879\u76EE\u7F16\u7801", 409);
      }
      const [result] = await connection.query(
        `INSERT INTO project_spaces
      (project_name, project_code, project_type, description, owner_user_id, owner_name, status, resource_config_json, settings_json, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        [
          projectName,
          baseCode,
          sourceProject.projectType || "standard",
          sourceProject.description || "",
          user?.sub || null,
          user?.displayName || user?.username || "system",
          JSON.stringify(sourceProject.resourceConfig || {}),
          JSON.stringify(sourceProject.settings || {}),
          user?.username || "system"
        ]
      );
      await connection.query(
        `INSERT IGNORE INTO project_members
      (project_id, user_id, project_role, permissions_json, status)
     VALUES (?, ?, 'owner', JSON_OBJECT('modules', JSON_ARRAY()), 'active')`,
        [result.insertId, user?.sub || null]
      );
      return Number(result.insertId);
    }
    async function importProject(packagePayload, options = {}, user = {}) {
      packagePayload = validatePackage(packagePayload);
      validatePackageDatabaseCapabilities(packagePayload);
      packagePayload = decryptPackageSensitiveData(packagePayload, options.packageKey);
      const mode = options.mode || "new";
      if (!["new", "overwrite"].includes(mode)) {
        throw new AppError("\u6682\u4EC5\u652F\u6301\u65B0\u5EFA\u9879\u76EE\u5BFC\u5165\u548C\u8986\u76D6\u5BFC\u5165", 400);
      }
      let targetProjectId = Number(options.targetProjectId || 0) || null;
      let automaticBackup = null;
      if (mode === "overwrite") {
        if (!targetProjectId) throw new AppError("\u8986\u76D6\u5BFC\u5165\u5FC5\u987B\u9009\u62E9\u76EE\u6807\u9879\u76EE", 400);
        const targetProject = await projectRepository.getProjectById(targetProjectId);
        if (!targetProject) throw new AppError("\u76EE\u6807\u9879\u76EE\u4E0D\u5B58\u5728", 404);
        if (!options.skipAutomaticBackup) {
          automaticBackup = await createProjectBackup(targetProjectId, user);
        }
      }
      const connection = await pool.getConnection();
      let restoredRuntimePaths = [];
      try {
        packagePayload = await adaptExternalStandardReferences(connection, packagePayload);
        const preflight = await preflightImport(connection, packagePayload);
        await connection.beginTransaction();
        if (mode === "new") {
          targetProjectId = await createImportedProject(connection, packagePayload, user, options);
        } else {
          await projectRepository.deleteProjectScopedAssets(connection, targetProjectId);
        }
        const runtimeFileMap = buildRuntimeFileMap(packagePayload, targetProjectId);
        const tableSummary = await importRows(connection, packagePayload, targetProjectId, {
          mode,
          referenceMappings: preflight.referenceMappings,
          runtimeFileMap
        });
        restoredRuntimePaths = await restoreRuntimeFiles([...runtimeFileMap.values()]);
        await connection.commit();
        const summary = {
          mode,
          tableCount: tableSummary.length,
          rowCount: tableSummary.reduce((sum, item) => sum + item.rowCount, 0),
          tables: tableSummary,
          integrity: {
            verified: Boolean(packagePayload.manifest.integrity),
            expectedRowCount: packagePayload.tables.reduce((sum, table) => sum + table.rows.length, 0),
            importedRowCount: tableSummary.reduce((sum, item) => sum + item.rowCount, 0),
            restoredRuntimeFileCount: restoredRuntimePaths.length
          },
          warnings: preflight.warnings,
          automaticBackup
        };
        await writeTransferLog({
          projectId: targetProjectId,
          operationType: "import",
          status: "success",
          operatorName: user.username || user.displayName || "system",
          packageVersion: packagePayload.manifest.exportFormatVersion,
          modules: packagePayload.manifest.modules || [],
          summary
        });
        return { projectId: targetProjectId, summary };
      } catch (error) {
        await connection.rollback();
        await Promise.all(restoredRuntimePaths.map((filePath) => fs.unlink(filePath).catch(() => {
        })));
        await writeTransferLog({
          projectId: targetProjectId,
          operationType: "import",
          status: "failed",
          operatorName: user.username || user.displayName || "system",
          packageVersion: packagePayload.manifest?.exportFormatVersion || EXPORT_FORMAT_VERSION,
          modules: packagePayload.manifest?.modules || [],
          summary: { mode },
          errorMessage: error.message
        });
        throw error;
      } finally {
        connection.release();
      }
    }
    async function previewImport(packagePayload) {
      packagePayload = validatePackage(packagePayload);
      const databaseTypes = validatePackageDatabaseCapabilities(packagePayload);
      const tables = packagePayload.tables.map((table) => ({
        tableName: table.tableName,
        moduleKey: table.moduleKey || inferModule(table.tableName).moduleKey,
        rowCount: Array.isArray(table.rows) ? table.rows.length : 0
      }));
      return {
        sourceProject: packagePayload.manifest.sourceProject,
        exportedAt: packagePayload.manifest.exportedAt,
        sensitiveMode: packagePayload.manifest.sensitiveMode || "unknown",
        packageVersion: packagePayload.manifest.exportFormatVersion,
        sourcePackageVersion: packagePayload.manifest.compatibility?.adaptedFrom || packagePayload.manifest.exportFormatVersion,
        integrityVerified: Boolean(packagePayload.manifest.integrity),
        warnings: packagePayload.manifest.compatibility?.warnings || [],
        coverage: packagePayload.manifest.coverage || {
          configurationAssets: true,
          projectRuntimeFiles: false,
          externalPhysicalData: false
        },
        modules: packagePayload.manifest.modules || buildModuleSummary(packagePayload.tables),
        tableCount: tables.length,
        rowCount: tables.reduce((sum, table) => sum + table.rowCount, 0),
        runtimeFileCount: (packagePayload.files || []).length,
        databaseTypes,
        tables
      };
    }
    module2.exports = {
      exportProject,
      importProject,
      previewImport,
      readPackageFile,
      listTransferLogs,
      createProjectBackup,
      listProjectBackups,
      getProjectBackup,
      MODULE_REGISTRY,
      __test__: {
        calculateSha256,
        buildPackageIntegrity,
        validatePackage,
        createPackageCryptoContext,
        getPackageCryptoKey,
        encryptPackageValue,
        decryptPackageValue,
        shouldExportRow,
        shouldUseColumnDefault,
        buildColumnValue,
        collectPackageDatabaseTypes,
        validatePackageDatabaseCapabilities
      }
    };
  }
});

// backend/src/modules/project-spaces/project-space.controller.js
var require_project_space_controller = __commonJS({
  "backend/src/modules/project-spaces/project-space.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var service = require_project_space_service();
    var assetService = require_project_asset_service();
    async function listMyProjects(req, res) {
      const rows = await service.listMyProjects(req.user);
      const defaultProjectId = await service.getUserDefaultProjectId(req.user);
      return sendSuccess(res, rows, { total: rows.length, defaultProjectId });
    }
    async function listProjects(req, res) {
      const rows = await service.listProjects();
      const defaultProjectId = await service.getUserDefaultProjectId(req.user);
      return sendSuccess(res, rows, { total: rows.length, defaultProjectId });
    }
    async function getProjectDetail(req, res) {
      const row = await service.getProjectDetail(Number(req.params.id));
      return sendSuccess(res, row);
    }
    async function createProject(req, res) {
      const row = await service.createProject(req.validatedBody, req.user);
      return sendSuccess(res, row, null, 201);
    }
    async function updateProject(req, res) {
      const row = await service.updateProject(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function updateProjectStatus(req, res) {
      const row = await service.updateProjectStatus(Number(req.params.id), req.validatedBody.status);
      return sendSuccess(res, row);
    }
    async function setDefaultProject(req, res) {
      const row = await service.setDefaultProject(Number(req.params.id), req.user);
      return sendSuccess(res, row);
    }
    async function upsertProjectMember(req, res) {
      const row = await service.upsertProjectMember(Number(req.params.id), req.validatedBody);
      return sendSuccess(res, row);
    }
    async function removeProjectMember(req, res) {
      const row = await service.removeProjectMember(Number(req.params.id), Number(req.params.userId));
      return sendSuccess(res, row);
    }
    async function deleteProject(req, res) {
      const row = await service.deleteProject(Number(req.params.id));
      return sendSuccess(res, row);
    }
    async function exportProjectAssets(req, res) {
      const payload = await assetService.exportProject(Number(req.params.id), {
        ...req.query || {},
        packageKey: req.get("x-project-package-key") || ""
      }, req.user);
      const projectCode = payload.manifest.sourceProject.code || `project_${req.params.id}`;
      const fileName = `${projectCode}-assets-${Date.now()}.medata-project.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.status(200).send(JSON.stringify(payload, null, 2));
    }
    async function createProjectAssetBackup(req, res) {
      const result = await assetService.createProjectBackup(Number(req.params.id), req.user);
      return sendSuccess(res, result, null, 201);
    }
    async function listProjectAssetBackups(req, res) {
      const rows = await assetService.listProjectBackups(Number(req.params.id));
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function downloadProjectAssetBackup(req, res) {
      const payload = await assetService.getProjectBackup(Number(req.params.id), Number(req.params.backupId));
      const projectCode = payload?.manifest?.sourceProject?.code || `project_${req.params.id}`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${projectCode}-backup-${req.params.backupId}.medata-project.json"`);
      return res.status(200).send(JSON.stringify(payload, null, 2));
    }
    async function previewProjectAssetImport(req, res) {
      const payload = await assetService.readPackageFile(req.file);
      const result = await assetService.previewImport(payload);
      return sendSuccess(res, result);
    }
    async function importProjectAssets(req, res) {
      const payload = await assetService.readPackageFile(req.file);
      const result = await assetService.importProject(payload, {
        mode: req.body?.mode || "new",
        targetProjectId: req.body?.targetProjectId ? Number(req.body.targetProjectId) : null,
        targetProjectName: req.body?.targetProjectName || "",
        targetProjectCode: req.body?.targetProjectCode || "",
        packageKey: req.get("x-project-package-key") || ""
      }, req.user);
      return sendSuccess(res, result, null, 201);
    }
    async function listProjectAssetTransferLogs(req, res) {
      const rows = await assetService.listTransferLogs(req.query?.projectId ? Number(req.query.projectId) : null);
      return sendSuccess(res, rows, { total: rows.length });
    }
    module2.exports = {
      listMyProjects,
      listProjects,
      getProjectDetail,
      createProject,
      updateProject,
      updateProjectStatus,
      setDefaultProject,
      upsertProjectMember,
      removeProjectMember,
      deleteProject,
      exportProjectAssets,
      createProjectAssetBackup,
      listProjectAssetBackups,
      downloadProjectAssetBackup,
      previewProjectAssetImport,
      importProjectAssets,
      listProjectAssetTransferLogs
    };
  }
});

// packages/data-platform-module-project-spaces/src/.runtime-entry.js
var controller0 = require_project_space_controller();
var { Writable } = require("node:stream");
var handlers = {
  "GET /api/v1/projects/my": controller0["listMyProjects"],
  "GET /api/v1/projects/asset-transfer-logs": controller0["listProjectAssetTransferLogs"],
  "POST /api/v1/projects/assets/import/preview": controller0["previewProjectAssetImport"],
  "POST /api/v1/projects/assets/import": controller0["importProjectAssets"],
  "GET /api/v1/projects": controller0["listProjects"],
  "POST /api/v1/projects": controller0["createProject"],
  "GET /api/v1/projects/:id/assets/backups": controller0["listProjectAssetBackups"],
  "POST /api/v1/projects/:id/assets/backups": controller0["createProjectAssetBackup"],
  "GET /api/v1/projects/:id/assets/backups/:backupId/download": controller0["downloadProjectAssetBackup"],
  "GET /api/v1/projects/:id/assets/export": controller0["exportProjectAssets"],
  "GET /api/v1/projects/:id": controller0["getProjectDetail"],
  "PUT /api/v1/projects/:id": controller0["updateProject"],
  "DELETE /api/v1/projects/:id": controller0["deleteProject"],
  "POST /api/v1/projects/:id/default": controller0["setDefaultProject"],
  "POST /api/v1/projects/:id/status": controller0["updateProjectStatus"],
  "POST /api/v1/projects/:id/members": controller0["upsertProjectMember"],
  "DELETE /api/v1/projects/:id/members/:userId": controller0["removeProjectMember"]
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
