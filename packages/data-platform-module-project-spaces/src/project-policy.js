const { AsyncLocalStorage } = require("node:async_hooks");
const { authorizeCapability, policyError } = require("@johnason/data-platform-core-kernel");

const contextStorage = new AsyncLocalStorage();

function isAdmin(actor) {
  return String(actor?.roleCode || "").toLowerCase() === "admin";
}

function projectError(message, code, statusCode, details = {}) {
  return policyError(message, code, statusCode, details);
}

function runWithProjectContext(context, callback) {
  if (!context || typeof context !== "object" || Array.isArray(context)) throw new TypeError("Project context must be an object");
  if (typeof callback !== "function") throw new TypeError("Project context callback must be a function");
  return contextStorage.run(Object.freeze({ ...context }), callback);
}

function getProjectContext() {
  return contextStorage.getStore() || Object.freeze({});
}

async function resolveProject(actor, requestedProjectId, projectService) {
  if (!projectService || typeof projectService.resolveRequestProject !== "function") throw new TypeError("resolveProject requires projectService");
  return projectService.resolveRequestProject(actor, requestedProjectId);
}

module.exports = { authorizeCapability, getProjectContext, isAdmin, projectError, resolveProject, runWithProjectContext };
