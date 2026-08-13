const { validateModuleManifest } = require("@johnason/data-platform-core-kernel");
const { SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS, CAPABILITY_DEFINITIONS } = require("../contracts");
const MODULE_ID = "data-source-research";
const MODULE_VERSION = "0.2.0";
const CAPABILITY_SCHEMA_VERSION = "1.0.0";
const dependencies = Object.freeze({ "@johnason/data-platform-core-kernel": "0.1.0" });
const moduleManifest = Object.freeze({
  ...validateModuleManifest({ moduleName: MODULE_ID, moduleVersion: MODULE_VERSION, capabilitySchemaVersion: CAPABILITY_SCHEMA_VERSION,
    capabilities: CAPABILITY_DEFINITIONS.map(({ inputSchema, outputSchema, permission, mutation, port, ...definition }) => definition) }),
  moduleId: MODULE_ID, sourceApiKeys: SOURCE_API_KEYS, sourceFrontendKeys: SOURCE_FRONTEND_KEYS, dependencies,
});
function resolvePort(input, port) {
  const service = input?.service || input?.dataSourceResearchService || input?.ports || input;
  if (service && typeof service[port] === "function") return service[port].bind(service);
  return async () => { const error = new Error(`data-source-research capability port is not configured: ${port}`); error.code = "CAPABILITY_PORT_NOT_CONFIGURED"; throw error; };
}
function argsFor(id, input = {}, context = {}) {
  if (/getResearchTask$/.test(id)) return [input.taskId];
  if (/createResearchRun$/.test(id)) { const { sourceId, ...payload } = input; return [sourceId, payload, context]; }
  if (/taskRun$/.test(id) || /ResearchTaskRun$/.test(id)) return [input.taskId, input.payload || input, context];
  if (/task$/.test(id) && input.taskId !== undefined) return [input.taskId, input.payload || input, context];
  return [input, context];
}
function createCapabilities(input = {}) {
  return Object.freeze(CAPABILITY_DEFINITIONS.map((definition) => Object.freeze({
    ...definition, id: definition.capabilityId, schema: definition.inputSchema,
    execute: async (value = {}, context = {}) => resolvePort(input, definition.port)(...argsFor(definition.capabilityId, value, context)),
  })));
}
function createRuntimeAdapters(input = {}) {
  const adapters = { service: input.service || input.dataSourceResearchService || {}, databaseRuntime: input.databaseRuntime || null };
  for (const definition of CAPABILITY_DEFINITIONS) adapters[definition.port] = resolvePort(input, definition.port);
  return Object.freeze(adapters);
}
module.exports = { moduleManifest, createCapabilities, createRuntimeAdapters, SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS };
