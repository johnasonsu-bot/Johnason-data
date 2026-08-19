const { PlatformError } = require("@johnason/data-platform-core-kernel");

function forbidden(code, message, details) {
  const error = new PlatformError(code, message, details);
  error.statusCode = 403;
  return error;
}

function requiredModules(sourceApiKeys) {
  const paths = sourceApiKeys.map((apiKey) => apiKey.slice(apiKey.indexOf(" ") + 1));
  const modules = new Set();
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
    ["/api/v1/model-providers", ["system_models", "data_map", "standards", "ingestion", "quality", "processing", "services", "reporting", "data_modeling"]],
  ];
  for (const path of paths) {
    if (path === "/api/auth/profile" || path.startsWith("/api/v1/auth/") || path === "/api/v1/projects/my") continue;
    if (path.startsWith("/api/v1/system-management/services") || path.startsWith("/api/v1/system-management/database-drivers") || path.startsWith("/api/v1/system-management/database-architecture")) modules.add("system_services");
    else if (path.startsWith("/api/v1/system-management/roles")) modules.add("system_roles");
    else if (path.startsWith("/api/v1/system-management/users")) modules.add("system_users");
    else if (path.startsWith("/api/v1/system-management/resources")) ["system_services", "system_users", "system_roles", "system_models"].forEach((name) => modules.add(name));
    else {
      const matched = rules.find(([prefix]) => path.startsWith(prefix));
      for (const name of matched?.[1] || []) modules.add(name);
    }
  }
  return [...modules];
}

function assertCapabilityAccess(capability, actor) {
  if (!actor) return;
  const required = requiredModules(capability.sourceApiKeys || []);
  const owned = new Set(actor.permissions?.modules || []);
  if (required.length > 0 && !required.some((name) => owned.has(name))) {
    throw forbidden("MODULE_PERMISSION_FORBIDDEN", "Current role cannot access this module", { requiredModules: required });
  }
  const readOnly = [actor.roleCode, actor.roleType].some((value) => String(value || "").toLowerCase() === "viewer")
    || actor.permissions?.mode === "readonly";
  const allowedWrite = capability.command === "auth logout"
    || capability.command === "asset search"
    || capability.action === "read";
  if (readOnly && !allowedWrite) throw forbidden("READ_ONLY_FORBIDDEN", "Read-only users cannot run mutating commands");
}

async function resolveProject(databaseRuntime, actor, requestedProjectId) {
  if (!actor) throw forbidden("PROJECT_ACCESS_FORBIDDEN", "Project access requires login");
  const pool = databaseRuntime.pool;
  const projectId = Number(requestedProjectId || actor.defaultProjectId || 0) || null;
  let projects;
  if (projectId) {
    [projects] = await pool.query(
      `SELECT id, project_name AS projectName, project_code AS projectCode, status
       FROM project_spaces WHERE id = ? LIMIT 1`,
      [projectId],
    );
  } else if (String(actor.roleCode).toLowerCase() === "admin") {
    [projects] = await pool.query(
      `SELECT id, project_name AS projectName, project_code AS projectCode, status
       FROM project_spaces WHERE status = 'active' ORDER BY id ASC LIMIT 1`,
    );
  } else {
    [projects] = await pool.query(
      `SELECT p.id, p.project_name AS projectName, p.project_code AS projectCode, p.status
       FROM project_members m
       INNER JOIN project_spaces p ON p.id = m.project_id
       WHERE m.user_id = ? AND m.status = 'active' AND p.status = 'active'
       ORDER BY p.id ASC LIMIT 1`,
      [actor.sub],
    );
  }
  const project = projects[0];
  if (!project || project.status !== "active") throw forbidden("PROJECT_ACCESS_FORBIDDEN", "Project is missing or disabled");

  if (String(actor.roleCode).toLowerCase() === "admin") {
    return { project, member: { projectId: Number(project.id), userId: Number(actor.sub), projectRole: "owner", status: "active" } };
  }
  const [members] = await pool.query(
    `SELECT project_id AS projectId, user_id AS userId, project_role AS projectRole,
            permissions_json AS permissions, status
     FROM project_members
     WHERE project_id = ? AND user_id = ? AND status = 'active'
     LIMIT 1`,
    [project.id, actor.sub],
  );
  if (!members[0]) throw forbidden("PROJECT_ACCESS_FORBIDDEN", "Current user is not an active project member");
  return { project, member: members[0] };
}

module.exports = { assertCapabilityAccess, requiredModules, resolveProject };
