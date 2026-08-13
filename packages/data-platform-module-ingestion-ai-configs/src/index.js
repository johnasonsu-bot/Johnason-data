const { validateModuleManifest } = require("@johnason/data-platform-core-kernel");
const { SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS, CAPABILITY_DEFINITIONS } = require("../contracts");
const moduleManifest = Object.freeze({
  ...validateModuleManifest({ moduleName: "ingestion-ai-configs", moduleVersion: "0.2.0", capabilitySchemaVersion: "1.0.0", capabilities: CAPABILITY_DEFINITIONS.map(({ inputSchema, outputSchema, permission, mutation, port, ...definition }) => definition) }),
  moduleId: "ingestion-ai-configs", sourceApiKeys: SOURCE_API_KEYS, sourceFrontendKeys: SOURCE_FRONTEND_KEYS,
  dependencies: Object.freeze({ "@johnason/data-platform-core-kernel": "0.1.0" }),
});
function port(dependencies, name) {
  const service = dependencies?.service || dependencies?.ports || dependencies;
  if (service && typeof service[name] === "function") return service[name].bind(service);
  return async () => { const error = new Error(`ingestion-ai-configs capability port is not configured: ${name}`); error.code = "CAPABILITY_PORT_NOT_CONFIGURED"; throw error; };
}
function createCapabilities(dependencies = {}) { return Object.freeze(CAPABILITY_DEFINITIONS.map((definition) => Object.freeze({ ...definition, id: definition.capabilityId, schema: definition.inputSchema, execute: (input = {}, context = {}) => port(dependencies, definition.port)(input, context) }))); }
function createRuntimeAdapters(dependencies = {}) { const adapters = { service: dependencies.service || {}, databaseRuntime: dependencies.databaseRuntime || null }; for (const definition of CAPABILITY_DEFINITIONS) adapters[definition.port] = port(dependencies, definition.port); return Object.freeze(adapters); }
module.exports = { moduleManifest, createCapabilities, createRuntimeAdapters, SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS };
