const env = require("../../config/env");
const { createCoreRuntime } = require("@johnason/data-platform-core");

const runtime = createCoreRuntime({ config: env });
const apiOwners = new Map();
for (const [capabilityId, capability] of runtime.catalog) {
  for (const apiKey of capability.sourceApiKeys) apiOwners.set(apiKey, capabilityId);
}

function normalizePath(value) {
  return `/${String(value || "").split("/").filter(Boolean).join("/")}`;
}

function apiKeyForRequest(req) {
  const routePath = req?.route?.path;
  if (typeof routePath !== "string") return null;
  const path = routePath.startsWith("/api/")
    ? normalizePath(routePath)
    : normalizePath(`${req.baseUrl || ""}/${routePath}`);
  return `${String(req.method || "GET").toUpperCase()} ${path}`;
}

function capabilityIdForRequest(req) {
  return apiOwners.get(apiKeyForRequest(req)) || null;
}

async function executeWebCapability(req, res) {
  const capabilityId = capabilityIdForRequest(req);
  if (!capabilityId) return false;
  await runtime.executeCapability(capabilityId, {}, {
    actor: req.user || null,
    projectId: req.projectId || null,
    project: req.project || null,
    projectMember: req.projectMember || null,
    request: req,
    response: res,
  });
  return true;
}

function createWebCoreHandler(apiKey) {
  const capabilityId = apiOwners.get(apiKey);
  if (!capabilityId) throw new TypeError(`No aggregate capability owns ${apiKey}`);
  return (req, res) => runtime.executeCapability(capabilityId, {}, {
    actor: req.user || null,
    projectId: req.projectId || null,
    project: req.project || null,
    projectMember: req.projectMember || null,
    request: req,
    response: res,
  });
}

module.exports = {
  apiKeyForRequest,
  capabilityIdForRequest,
  executeWebCapability,
  createWebCoreHandler,
  mappedApiKeys: Object.freeze([...apiOwners.keys()].sort()),
};
