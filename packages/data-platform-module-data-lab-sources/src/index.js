const { validateModuleManifest } = require("@johnason/data-platform-core-kernel");
const { SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS, CAPABILITY_DEFINITIONS } = require("../contracts");
const dependencies = Object.freeze({ "@johnason/data-platform-core-kernel": "0.1.0" });
const moduleManifest = Object.freeze({
  ...validateModuleManifest({ moduleName: "data-lab-sources", moduleVersion: "0.2.0", capabilitySchemaVersion: "1.0.0",
    capabilities: CAPABILITY_DEFINITIONS.map(({ inputSchema, outputSchema, permission, mutation, port, ...definition }) => definition) }),
  moduleId: "data-lab-sources", sourceApiKeys: SOURCE_API_KEYS, sourceFrontendKeys: SOURCE_FRONTEND_KEYS, dependencies,
});
function resolvePort(input, port) {
  const service = input?.service || input?.dataLabSourcesService || input?.ports || input;
  if (service && typeof service[port] === "function") return service[port].bind(service);
  return async () => { const error = new Error(`data-lab-sources capability port is not configured: ${port}`); error.code = "CAPABILITY_PORT_NOT_CONFIGURED"; throw error; };
}
function argsFor(id, input = {}, context = {}) {
  if (id === "dataLabSources.list" || id === "dataLabSources.scenes") return [input.id, context];
  if (id === "dataLabSources.tables") return [input.id, { includeDirectories: Boolean(input.includeDirectories) }, context];
  if (id === "dataLabSources.columns" || id === "dataLabSources.sample") return [input.id, input.tableName, input.limit, context];
  if (id === "dataLabSources.update") { const { id: sourceId, ...payload } = input; return [sourceId, payload, context]; }
  if (id === "dataLabSources.delete") return [input.id, context];
  return [input, context];
}
function createCapabilities(input = {}) { return Object.freeze(CAPABILITY_DEFINITIONS.map((definition) => Object.freeze({ ...definition, id: definition.capabilityId, schema: definition.inputSchema, execute: async (value = {}, context = {}) => resolvePort(input, definition.port)(...argsFor(definition.capabilityId, value, context)) }))); }
function createRuntimeAdapters(input = {}) { const adapters = { service: input.service || input.dataLabSourcesService || {}, databaseRuntime: input.databaseRuntime || null }; for (const d of CAPABILITY_DEFINITIONS) adapters[d.port] = resolvePort(input, d.port); return Object.freeze(adapters); }
module.exports = { moduleManifest, createCapabilities, createRuntimeAdapters, SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS };
