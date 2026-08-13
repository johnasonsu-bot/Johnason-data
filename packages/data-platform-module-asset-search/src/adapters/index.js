const { ASSET_TYPES, SOURCE_MODULES } = require("../../contracts");

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

function createRuntimeAdapters(dependencies = {}) {
  const service = dependencies.service || dependencies.assetSearchService || {};
  const repository = dependencies.repository || dependencies.assetSearchRepository || {};
  const metadata = dependencies.metadata || dependencies.metadataService || {};
  const ai = dependencies.ai || dependencies.aiAssistant || {};

  return Object.freeze({
    service,
    repository,
    metadata,
    ai,
    databaseRuntime: dependencies.databaseRuntime || null,
    assetTypes: ASSET_TYPES,
    sourceModules: SOURCE_MODULES,
    search: resolvePort(dependencies, "search"),
    businessDataSearch: resolvePort(dependencies, "businessDataSearch"),
    suggest: resolvePort(dependencies, "suggest"),
    facets: resolvePort(dependencies, "facets"),
    listAiConfigs: resolvePort(dependencies, "listAiConfigs"),
    updateAiConfig: resolvePort(dependencies, "updateAiConfig"),
    listAiRuns: resolvePort(dependencies, "listAiRuns"),
    feedback: resolvePort(dependencies, "feedback"),
  });
}

module.exports = { createRuntimeAdapters, resolvePort };
