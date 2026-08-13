const {
  ASSET_TYPES,
  CAPABILITY_DEFINITIONS,
  SOURCE_API_KEYS,
  SOURCE_FRONTEND_KEYS,
  SOURCE_MODULES,
} = require("../contracts");
const { validateModuleManifest } = require("@johnason/data-platform-core-kernel");
const { createRuntimeAdapters } = require("./adapters");

const MODULE_ID = "asset-search";
const MODULE_VERSION = "0.2.0";
const CAPABILITY_SCHEMA_VERSION = "1.0.0";

const validatedManifest = validateModuleManifest({
  moduleName: MODULE_ID,
  moduleVersion: MODULE_VERSION,
  capabilitySchemaVersion: CAPABILITY_SCHEMA_VERSION,
  capabilities: CAPABILITY_DEFINITIONS.map(({ id, capabilityId, sourceApiKeys, sourceFrontendKeys, executionTargets }) => ({
    capabilityId: capabilityId || id,
    sourceApiKeys,
    sourceFrontendKeys,
    executionTargets,
  })),
});

const moduleManifest = Object.freeze({
  ...validatedManifest,
  moduleId: MODULE_ID,
  moduleName: MODULE_ID,
  moduleVersion: MODULE_VERSION,
  capabilitySchemaVersion: CAPABILITY_SCHEMA_VERSION,
  sourceApiKeys: SOURCE_API_KEYS,
  sourceFrontendKeys: SOURCE_FRONTEND_KEYS,
  dependencies: Object.freeze({ "@johnason/data-platform-core-kernel": "0.1.0" }),
  capabilities: Object.freeze(CAPABILITY_DEFINITIONS.map(({ port, ...definition }) => Object.freeze({ ...definition }))),
});

function resolvePort(dependencies, port) {
  const service = dependencies?.service || dependencies?.assetSearchService || dependencies?.ports;
  if (service && typeof service[port] === "function") return service[port].bind(service);
  if (typeof dependencies?.[port] === "function") return dependencies[port];
  return async () => {
    const error = new Error(`asset-search capability port is not configured: ${port}`);
    error.code = "CAPABILITY_PORT_NOT_CONFIGURED";
    throw error;
  };
}

function createCapabilities(dependencies = {}) {
  return CAPABILITY_DEFINITIONS.map(({ port, ...definition }) => Object.freeze({
    ...definition,
    schema: definition.inputSchema,
    execute: async (input = {}, executionContext = {}) => resolvePort(dependencies, port)(input, executionContext),
  }));
}

function createAssetSearchCapabilities(dependencies = {}) {
  const capabilities = createCapabilities(dependencies);
  return Object.freeze({
    assetSearch: Object.freeze(Object.fromEntries(capabilities.map((capability) => [
      capability.capabilityId.slice("assetSearch.".length),
      capability.execute,
    ]))),
  });
}

module.exports = {
  ASSET_TYPES,
  SOURCE_MODULES,
  moduleManifest,
  createCapabilities,
  createAssetSearchCapabilities,
  createRuntimeAdapters,
};
