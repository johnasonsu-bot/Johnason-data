const { AsyncLocalStorage } = require("async_hooks");

const projectContextStorage = new AsyncLocalStorage();

function runWithProjectContext(context, callback) {
  return projectContextStorage.run(context || {}, callback);
}

function getProjectContext() {
  return projectContextStorage.getStore() || {};
}

function getCurrentProjectId() {
  const projectId = getProjectContext().projectId;
  return projectId ? Number(projectId) : null;
}

function getProjectCondition(alias = "") {
  const projectId = getCurrentProjectId();
  if (!projectId) {
    return { sql: "", params: [] };
  }

  const prefix = alias ? `${alias}.` : "";
  return { sql: `${prefix}project_id = ?`, params: [projectId] };
}

function addProjectCondition(conditions, params, alias = "") {
  const condition = getProjectCondition(alias);
  if (!condition.sql) {
    return null;
  }
  conditions.push(condition.sql);
  params.push(...condition.params);
  return condition.params[0];
}

module.exports = {
  runWithProjectContext,
  getProjectContext,
  getCurrentProjectId,
  getProjectCondition,
  addProjectCondition,
};
