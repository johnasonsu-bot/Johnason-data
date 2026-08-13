function policyError(message, code, statusCode, details = {}) {
  const error = new Error(message);
  error.name = "PolicyError";
  error.code = code;
  error.statusCode = statusCode;
  error.retryable = false;
  error.details = Object.freeze({ ...details });
  return error;
}

function normalizePermissions(actor) {
  const raw = actor?.permissions && typeof actor.permissions === "object" ? actor.permissions : {};
  const modules = Array.isArray(raw.modules) ? raw.modules.filter(Boolean).map((value) => value === "lab" ? "data_modeling" : value) : [];
  const viewer = [actor?.roleCode, actor?.roleType].some((value) => String(value || "").toLowerCase() === "viewer");
  return Object.freeze({ modules: Object.freeze([...new Set(modules)]), readOnly: viewer || raw.mode === "readonly" });
}

function authorizeCapability(actor, { modules, action = "read", readOnlyAllowed = false } = {}) {
  const requiredModules = Array.isArray(modules) ? modules.filter(Boolean) : [modules].filter(Boolean);
  const permissions = normalizePermissions(actor);
  if (requiredModules.length > 0 && !requiredModules.some((moduleName) => permissions.modules.includes(moduleName))) {
    throw policyError("当前角色无权访问该功能模块", "MODULE_PERMISSION_FORBIDDEN", 403, { modules: requiredModules });
  }
  if (permissions.readOnly && action !== "read" && !readOnlyAllowed) {
    throw policyError("只读用户仅允许查看，不能执行新建、修改、删除、运行或发布操作", "READ_ONLY_FORBIDDEN", 403, { modules: requiredModules });
  }
  return true;
}

module.exports = { policyError, normalizePermissions, authorizeCapability };
