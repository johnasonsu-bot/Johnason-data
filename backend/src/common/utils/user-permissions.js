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
    mode: parsed.mode === "readonly" ? "readonly" : undefined,
    actions: Array.isArray(parsed.actions) ? parsed.actions.filter(Boolean) : undefined,
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
      actions: ["read"],
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
    ["/api/v1/model-providers", ["system_models", "data_map", "standards", "ingestion", "quality", "processing", "services", "reporting", "data_modeling"]],
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

const READ_ONLY_ALLOWED_WRITES = [
  /^\/api\/v1\/auth\/logout$/,
  /^\/api\/auth\/logout$/,
  /^\/api\/v1\/asset-search\/search$/,
  /^\/api\/v1\/asset-search\/business-data\/search$/,
  /^\/api\/v1\/data-development\/processing\/jobs\/preview$/,
  /^\/api\/v1\/data-development\/processing\/jobs\/\d+\/preview$/,
  /^\/api\/v1\/reporting\/datasets\/preview$/,
  /^\/api\/v1\/reporting\/dashboards\/preview-chart$/,
  /^\/api\/v1\/reporting\/runtime\/dashboards\/\d+\/preview-chart$/,
];

function isReadOnlyAllowedRequest(method, pathname) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(normalizedMethod)) {
    return true;
  }

  const path = String(pathname || "").split("?")[0];
  return READ_ONLY_ALLOWED_WRITES.some((pattern) => pattern.test(path));
}

module.exports = {
  getRequiredModulesForApiPath,
  hasAnyModulePermission,
  isReadOnlyAllowedRequest,
  isReadOnlyUser,
  normalizePermissions,
  normalizeRolePermissions,
};
