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

// runtime-port:config
var require_config = __commonJS({
  "runtime-port:config"(exports2, module2) {
    var { createRuntimeConfigProxy } = require("@johnason/data-platform-core-kernel");
    module2.exports = createRuntimeConfigProxy();
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

// backend/src/modules/auth/auth.repository.js
var require_auth_repository = __commonJS({
  "backend/src/modules/auth/auth.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var { normalizeRolePermissions } = require_user_permissions();
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
          permissions: row.permissions
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
    module2.exports = {
      findByUsername,
      findProfileById
    };
  }
});

// backend/src/modules/auth/auth-session.repository.js
var require_auth_session_repository = __commonJS({
  "backend/src/modules/auth/auth-session.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var ACTIVE_STATUS = "active";
    var SESSION_IDLE_TIMEOUT_SECONDS = 30 * 60;
    function getExecutor(executor) {
      return executor || pool;
    }
    async function expireStaleSessions(executor) {
      await getExecutor(executor).query(
        `UPDATE auth_sessions
     SET status = 'expired'
     WHERE status = ?
       AND (
         expires_at <= NOW()
         OR last_seen_at < DATE_SUB(NOW(), INTERVAL ? SECOND)
       )`,
        [ACTIVE_STATUS, SESSION_IDLE_TIMEOUT_SECONDS]
      );
    }
    async function countActiveSessions(executor) {
      const db = getExecutor(executor);
      await expireStaleSessions(db);
      const [rows] = await db.query(
        `SELECT COUNT(*) AS total
     FROM auth_sessions
     WHERE status = ?`,
        [ACTIVE_STATUS]
      );
      return Number(rows[0]?.total || 0);
    }
    async function countActiveSessionsForUser(userId, executor) {
      const db = getExecutor(executor);
      await expireStaleSessions(db);
      const [rows] = await db.query(
        `SELECT COUNT(*) AS total
     FROM auth_sessions
     WHERE status = ?
       AND user_id = ?`,
        [ACTIVE_STATUS, userId]
      );
      return Number(rows[0]?.total || 0);
    }
    async function createSession(session, executor) {
      await getExecutor(executor).query(
        `INSERT INTO auth_sessions
      (id, user_id, username, status, issued_at, expires_at, last_seen_at, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.userId,
          session.username,
          ACTIVE_STATUS,
          session.issuedAt,
          session.expiresAt,
          session.issuedAt,
          session.userAgent || null,
          session.ipAddress || null
        ]
      );
    }
    async function findActiveSession(sessionId, executor) {
      if (!sessionId) {
        return null;
      }
      const db = getExecutor(executor);
      await expireStaleSessions(db);
      const [rows] = await db.query(
        `SELECT id, user_id AS userId, username, status, issued_at AS issuedAt,
            expires_at AS expiresAt, last_seen_at AS lastSeenAt
     FROM auth_sessions
     WHERE id = ?
       AND status = ?
     LIMIT 1`,
        [sessionId, ACTIVE_STATUS]
      );
      return rows[0] || null;
    }
    async function touchSession(sessionId, executor) {
      await getExecutor(executor).query(
        `UPDATE auth_sessions
     SET last_seen_at = NOW()
     WHERE id = ?
       AND status = ?`,
        [sessionId, ACTIVE_STATUS]
      );
    }
    async function revokeSession(sessionId, executor) {
      if (!sessionId) {
        return;
      }
      await getExecutor(executor).query(
        `UPDATE auth_sessions
     SET status = 'revoked',
         revoked_at = NOW()
     WHERE id = ?
       AND status = ?`,
        [sessionId, ACTIVE_STATUS]
      );
    }
    async function revokeActiveSessionsForUser(userId, executor) {
      if (!userId) {
        return 0;
      }
      const [result] = await getExecutor(executor).query(
        `UPDATE auth_sessions
     SET status = 'revoked',
         revoked_at = NOW()
     WHERE user_id = ?
       AND status = ?`,
        [userId, ACTIVE_STATUS]
      );
      return Number(result?.affectedRows || 0);
    }
    async function listOldestActiveSessions(limit, executor) {
      const normalizedLimit = Number(limit || 0);
      if (!Number.isInteger(normalizedLimit) || normalizedLimit <= 0) {
        return [];
      }
      const db = getExecutor(executor);
      await expireStaleSessions(db);
      const [rows] = await db.query(
        `SELECT id, user_id AS userId, username, issued_at AS issuedAt, last_seen_at AS lastSeenAt
     FROM auth_sessions
     WHERE status = ?
     ORDER BY last_seen_at ASC, issued_at ASC, created_at ASC
     LIMIT ?`,
        [ACTIVE_STATUS, normalizedLimit]
      );
      return rows;
    }
    async function revokeSessionsByIds(sessionIds, executor) {
      const normalizedIds = Array.from(new Set((sessionIds || []).filter(Boolean)));
      if (normalizedIds.length === 0) {
        return 0;
      }
      const placeholders = normalizedIds.map(() => "?").join(", ");
      const [result] = await getExecutor(executor).query(
        `UPDATE auth_sessions
     SET status = 'revoked',
         revoked_at = NOW()
     WHERE status = ?
       AND id IN (${placeholders})`,
        [ACTIVE_STATUS, ...normalizedIds]
      );
      return Number(result?.affectedRows || 0);
    }
    module2.exports = {
      countActiveSessions,
      countActiveSessionsForUser,
      createSession,
      findActiveSession,
      touchSession,
      revokeSession,
      revokeActiveSessionsForUser,
      listOldestActiveSessions,
      revokeSessionsByIds,
      expireStaleSessions
    };
  }
});

// backend/src/modules/auth/auth.service.js
var require_auth_service = __commonJS({
  "backend/src/modules/auth/auth.service.js"(exports2, module2) {
    var bcrypt = require("bcryptjs");
    var crypto = require("crypto");
    var jwt = require("jsonwebtoken");
    var AppError = require_app_error();
    var { pool } = require_database();
    var env = require_config();
    var authRepository = require_auth_repository();
    var sessionRepository = require_auth_session_repository();
    function toAuthUser(user) {
      return {
        id: user.id,
        sub: user.id,
        username: user.username,
        displayName: user.displayName,
        roleId: user.roleId || null,
        roleCode: user.roleCode,
        roleType: user.roleType || null,
        roleName: user.roleName || user.roleCode,
        defaultProjectId: user.defaultProjectId || null,
        permissions: user.permissions || { modules: [] }
      };
    }
    async function enforceConcurrentLimit() {
      return;
    }
    async function login(payload, context = {}) {
      const user = await authRepository.findByUsername(payload.username);
      if (!user || user.status !== "active") {
        throw new AppError("\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF", 401);
      }
      const isMatched = await bcrypt.compare(payload.password, user.passwordHash);
      if (!isMatched) {
        throw new AppError("\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF", 401);
      }
      const authUser = toAuthUser(user);
      const connection = await pool.getConnection();
      const sessionId = crypto.randomUUID();
      const token = jwt.sign(
        {
          sub: authUser.id,
          sessionId,
          username: authUser.username,
          displayName: authUser.displayName,
          roleId: authUser.roleId,
          roleCode: authUser.roleCode,
          roleType: authUser.roleType,
          roleName: authUser.roleName,
          permissions: authUser.permissions
        },
        env.jwtSecret,
        { expiresIn: env.jwtExpiresIn }
      );
      const decoded = jwt.decode(token);
      const issuedAt = decoded?.iat ? new Date(decoded.iat * 1e3) : /* @__PURE__ */ new Date();
      const expiresAt = decoded?.exp ? new Date(decoded.exp * 1e3) : new Date(Date.now() + 8 * 60 * 60 * 1e3);
      try {
        await connection.beginTransaction();
        await enforceConcurrentLimit(authUser.id, connection);
        await sessionRepository.createSession({
          id: sessionId,
          userId: authUser.id,
          username: authUser.username,
          issuedAt,
          expiresAt,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress
        }, connection);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return {
        token,
        user: authUser
      };
    }
    async function getProfile(userId) {
      const user = await authRepository.findProfileById(userId);
      if (!user || user.status !== "active") {
        throw new AppError("\u7528\u6237\u4E0D\u5B58\u5728\u6216\u5DF2\u505C\u7528", 401);
      }
      return {
        user: toAuthUser(user)
      };
    }
    async function logout(user) {
      await sessionRepository.revokeSession(user?.sessionId);
      return { success: true };
    }
    async function logoutByToken(token) {
      if (!token) {
        return { success: true };
      }
      try {
        const user = jwt.verify(token, env.jwtSecret);
        await sessionRepository.revokeSession(user?.sessionId);
      } catch {
        return { success: true };
      }
      return { success: true };
    }
    module2.exports = {
      login,
      getProfile,
      logout,
      logoutByToken
    };
  }
});

// backend/src/modules/auth/auth.controller.js
var require_auth_controller = __commonJS({
  "backend/src/modules/auth/auth.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var authService = require_auth_service();
    async function login(req, res) {
      const result = await authService.login(req.validatedBody, {
        userAgent: req.headers["user-agent"] || "",
        ipAddress: req.ip || req.socket?.remoteAddress || ""
      });
      return sendSuccess(res, result);
    }
    async function profile(req, res) {
      const result = await authService.getProfile(req.user.sub);
      return sendSuccess(res, result);
    }
    async function logout(req, res) {
      const result = await authService.logout(req.user);
      return sendSuccess(res, result);
    }
    async function logoutBeacon(req, res) {
      const token = req.body?.token || "";
      const result = await authService.logoutByToken(token);
      return sendSuccess(res, result);
    }
    module2.exports = {
      login,
      profile,
      logout,
      logoutBeacon
    };
  }
});

// packages/data-platform-module-auth/src/.runtime-entry.js
var controller0 = require_auth_controller();
var { Writable } = require("node:stream");
var handlers = {
  "POST /api/v1/auth/login": controller0["login"],
  "GET /api/v1/auth/profile": controller0["profile"],
  "POST /api/v1/auth/logout": controller0["logout"],
  "POST /api/v1/auth/logout-beacon": controller0["logoutBeacon"]
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
