const jwt = require("jsonwebtoken");
const { PlatformError } = require("@johnason/data-platform-core-kernel");
const { createProfileDatabaseRuntime } = require("./database");
const { assertCapabilityAccess, resolveProject } = require("./policies");

function error(code, message, statusCode) {
  const value = new PlatformError(code, message);
  value.statusCode = statusCode;
  return value;
}

function parsePermissions(value) {
  if (!value) return { modules: [] };
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return { modules: [] };
  }
}

async function loadActor(databaseRuntime, token, signingSecret, jwtImpl = jwt) {
  if (!token) throw error("UNAUTHENTICATED", "Login is required", 401);
  if (!signingSecret) throw error("RUNTIME_SECRET_MISSING", "Runtime signing secret is missing from the system keychain", 503);

  let claims;
  try {
    claims = jwtImpl.verify(token, signingSecret);
  } catch {
    throw error("SESSION_INVALID", "Login session is invalid or expired", 401);
  }
  if (!claims?.sub || !claims?.sessionId) throw error("SESSION_INVALID", "Login session is invalid or expired", 401);

  const pool = databaseRuntime.pool;
  await pool.query(
    `UPDATE auth_sessions
     SET status = 'expired'
     WHERE status = 'active'
       AND (expires_at <= NOW() OR last_seen_at < DATE_SUB(NOW(), INTERVAL 1800 SECOND))`,
  );
  const [sessions] = await pool.query(
    `SELECT id, user_id AS userId
     FROM auth_sessions
     WHERE id = ? AND status = 'active'
     LIMIT 1`,
    [claims.sessionId],
  );
  const session = sessions[0];
  if (!session || Number(session.userId) !== Number(claims.sub)) {
    throw error("SESSION_REVOKED", "Login session is no longer active", 401);
  }

  const [users] = await pool.query(
    `SELECT u.id, u.username, u.display_name AS displayName, u.role_id AS roleId,
            COALESCE(r.role_code, u.role_code) AS roleCode,
            u.default_project_id AS defaultProjectId, r.role_type AS roleType,
            r.role_name AS roleName, r.permissions_json AS permissions, u.status
     FROM users u
     LEFT JOIN system_roles r ON u.role_id = r.id OR (u.role_id IS NULL AND u.role_code = r.role_code)
     WHERE u.id = ?
     LIMIT 1`,
    [claims.sub],
  );
  const user = users[0];
  if (!user || user.status !== "active") throw error("USER_DISABLED", "User is missing or disabled", 401);
  await pool.query("UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = ? AND status = 'active'", [claims.sessionId]);

  return Object.freeze({
    ...claims,
    id: Number(user.id),
    sub: Number(user.id),
    username: user.username,
    displayName: user.displayName,
    roleId: user.roleId || null,
    roleCode: user.roleCode,
    roleType: user.roleType || null,
    roleName: user.roleName || user.roleCode,
    defaultProjectId: user.defaultProjectId ? Number(user.defaultProjectId) : null,
    permissions: parsePermissions(user.permissions),
  });
}

function createRuntimeConfig(profile, signingSecret) {
  const dataxHome = profile.dataxHome || null;
  return Object.freeze({
    nodeEnv: "production",
    jwtSecret: signingSecret || "",
    jwtExpiresIn: "8h",
    bcryptSaltRounds: 10,
    licenseStorageKey: signingSecret || "",
    dataxHome,
    dataxBin: dataxHome ? require("node:path").join(dataxHome, "bin", "datax.py") : null,
    kafka: Object.freeze({
      enabled: Boolean(profile.kafkaBootstrapServers?.length),
      bootstrapServers: Object.freeze([...(profile.kafkaBootstrapServers || [])]),
      clientId: "data-platform-cli",
      groupIdPrefix: "data-platform-cli",
    }),
  });
}

function unwrapResult(result) {
  return result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "data")
    ? result.data
    : result;
}

function createCliExecution(options) {
  const {
    runtime,
    profileStore,
    keychain,
    databaseRuntimeFactory = createProfileDatabaseRuntime,
    jwtImpl = jwt,
  } = options || {};
  if (!runtime || !profileStore || !keychain) throw new TypeError("runtime, profileStore, and keychain are required");

  function selectedProfile(name) {
    const profile = name ? profileStore.get(name) : profileStore.current();
    if (!profile) throw error("PROFILE_REQUIRED", name ? `Profile not found: ${name}` : "Select a profile or pass --profile", 400);
    return profile;
  }

  return Object.freeze({
    catalog: runtime.catalog,
    moduleManifests: runtime.moduleManifests,
    async executeCapability(capabilityId, input = {}, context = {}) {
      const capability = runtime.catalog.get(capabilityId);
      if (!capability) throw error("CAPABILITY_NOT_FOUND", `Unknown capability: ${capabilityId}`, 404);
      const needsDatabase = capability.executionTargets.some((target) => target.kind === "database");
      if (!needsDatabase) return runtime.executeCapability(capabilityId, input, context);

      const profile = selectedProfile(context.profile);
      const databaseRuntime = databaseRuntimeFactory(profile, keychain);
      try {
        const signingSecret = keychain.getRuntimeSigningSecret(profile.name);
        if (capability.command === "auth login" && !signingSecret) {
          throw error("RUNTIME_SECRET_MISSING", "Runtime signing secret is missing from the system keychain", 503);
        }
        const token = keychain.getSessionToken(profile.name);
        const actor = capability.authRequired
          ? await loadActor(databaseRuntime, token, signingSecret, jwtImpl)
          : null;
        assertCapabilityAccess(capability, actor);
        let projectId = context.projectId
          ? Number(context.projectId)
          : (profile.currentProjectId || actor?.defaultProjectId || null);
        let project = null;
        let projectMember = null;
        if (capability.projectScoped) {
          const resolved = await resolveProject(databaseRuntime, actor, projectId);
          project = resolved.project;
          projectMember = resolved.member;
          projectId = Number(project.id);
        }
        const result = await runtime.executeCapability(capabilityId, input, {
          ...context,
          profile: profile.name,
          projectId,
          actor,
          project,
          projectMember,
          databaseRuntime,
          runtimeDependencies: { config: createRuntimeConfig(profile, signingSecret) },
        });

        if (capability.command === "auth login") {
          const payload = unwrapResult(result);
          if (!payload?.token) throw error("SESSION_TOKEN_MISSING", "Login did not return a session token", 500);
          keychain.setSessionToken(profile.name, payload.token);
          const { token: _token, ...safePayload } = payload;
          return result.data && typeof result.data === "object"
            ? { ...result, data: safePayload }
            : safePayload;
        }
        if (capability.command === "auth logout") keychain.deleteSessionToken(profile.name);
        return result;
      } finally {
        await databaseRuntime.close();
      }
    },
  });
}

module.exports = { createCliExecution, createRuntimeConfig, loadActor };
