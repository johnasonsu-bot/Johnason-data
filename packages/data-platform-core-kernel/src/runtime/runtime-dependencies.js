const { AsyncLocalStorage } = require("node:async_hooks");
const { PlatformError } = require("../contracts/errors");
const { getDatabaseRuntime } = require("./database-runtime");
const { getExecutionContext } = require("./execution-context");

const storage = new AsyncLocalStorage();

function runWithRuntimeDependencies(dependencies, callback) {
  if (typeof callback !== "function") throw new TypeError("callback is required");
  return storage.run(Object.freeze({ ...(dependencies || {}) }), callback);
}

function getRuntimeDependencies() {
  return storage.getStore() || {};
}

function createDatabasePoolProxy() {
  return new Proxy({}, {
    get(_target, property) {
      const pool = getDatabaseRuntime().pool;
      const value = pool[property];
      return typeof value === "function" ? value.bind(pool) : value;
    },
  });
}

function createRuntimeConfigProxy() {
  function wrap(resolve) {
    return new Proxy({}, {
      get(_target, property) {
        const value = resolve()?.[property];
        if (value && typeof value === "object" && !Array.isArray(value)) return wrap(() => resolve()?.[property]);
        return value;
      },
      ownKeys() { return Reflect.ownKeys(resolve() || {}); },
      getOwnPropertyDescriptor() { return { configurable: true, enumerable: true }; },
    });
  }
  return wrap(() => getRuntimeDependencies().config || {});
}

function getProjectContext() {
  try {
    const context = getExecutionContext();
    return { projectId: context.projectId || null, project: context.project || null, member: context.projectMember || null };
  } catch (error) {
    if (error.code === "EXECUTION_CONTEXT_MISSING") return {};
    throw error;
  }
}

function getCurrentProjectId() {
  const value = getProjectContext().projectId;
  return value ? Number(value) : null;
}

function getProjectCondition(alias = "") {
  const projectId = getCurrentProjectId();
  if (!projectId) return { sql: "", params: [] };
  return { sql: `${alias ? `${alias}.` : ""}project_id = ?`, params: [projectId] };
}

function addProjectCondition(conditions, params, alias = "") {
  const condition = getProjectCondition(alias);
  if (!condition.sql) return null;
  conditions.push(condition.sql);
  params.push(...condition.params);
  return condition.params[0];
}

function requireRuntimeDependency(name) {
  const value = getRuntimeDependencies()[name];
  if (value === undefined) throw new PlatformError("RUNTIME_DEPENDENCY_MISSING", `Runtime dependency is missing: ${name}`);
  return value;
}

module.exports = {
  runWithRuntimeDependencies,
  getRuntimeDependencies,
  createDatabasePoolProxy,
  createRuntimeConfigProxy,
  getProjectContext,
  getCurrentProjectId,
  getProjectCondition,
  addProjectCondition,
  requireRuntimeDependency,
};
