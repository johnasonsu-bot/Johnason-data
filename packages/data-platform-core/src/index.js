const {
  PlatformError,
  deepFreeze,
  runWithDatabaseRuntime,
  runWithExecutionContext,
  runWithRuntimeDependencies,
} = require("@johnason/data-platform-core-kernel");

const modulePackages = [
  require("@johnason/data-platform-module-auth"),
  require("@johnason/data-platform-module-project-spaces"),
  require("@johnason/data-platform-module-platform"),
  require("@johnason/data-platform-module-asset-search"),
  require("@johnason/data-platform-module-data-development"),
  require("@johnason/data-platform-module-data-lab"),
  require("@johnason/data-platform-module-data-lab-sources"),
  require("@johnason/data-platform-module-data-map"),
  require("@johnason/data-platform-module-data-services"),
  require("@johnason/data-platform-module-data-source-research"),
  require("@johnason/data-platform-module-data-sources"),
  require("@johnason/data-platform-module-data-standards"),
  require("@johnason/data-platform-module-dev-ai-configs"),
  require("@johnason/data-platform-module-file-imports"),
  require("@johnason/data-platform-module-ingestion-ai-configs"),
  require("@johnason/data-platform-module-ingestion-tasks"),
  require("@johnason/data-platform-module-model-providers"),
  require("@johnason/data-platform-module-quality-control"),
  require("@johnason/data-platform-module-reporting"),
  require("@johnason/data-platform-module-system-knowledge-base"),
  require("@johnason/data-platform-module-system-management"),
];

function createCapabilityCatalog(dependencies = {}) {
  const catalog = new Map();
  const apiOwners = new Map();
  for (const modulePackage of modulePackages) {
    const capabilities = modulePackage.createCapabilities(dependencies);
    for (const [capabilityId, capability] of capabilities) {
      if (catalog.has(capabilityId)) {
        throw new PlatformError("DUPLICATE_CAPABILITY", `Duplicate capability: ${capabilityId}`);
      }
      for (const apiKey of capability.sourceApiKeys) {
        if (apiOwners.has(apiKey)) {
          throw new PlatformError("DUPLICATE_API_OWNER", `Duplicate API owner: ${apiKey}`);
        }
        apiOwners.set(apiKey, capabilityId);
      }
      catalog.set(capabilityId, deepFreeze(capability));
    }
  }
  return catalog;
}

function createCoreRuntime(dependencies = {}) {
  const catalog = createCapabilityCatalog(dependencies);
  return {
    catalog,
    moduleManifests: modulePackages.map((entry) => entry.moduleManifest),
    async executeCapability(capabilityId, input, context) {
      const capability = catalog.get(capabilityId);
      if (!capability) throw new PlatformError("CAPABILITY_NOT_FOUND", `Unknown capability: ${capabilityId}`);
      const executionContext = Object.freeze({ ...(context || {}), capabilityId });
      const invoke = () => runWithExecutionContext(executionContext, () => (
        runWithRuntimeDependencies(executionContext.runtimeDependencies || dependencies, () => capability.execute(input, executionContext))
      ));
      return executionContext.databaseRuntime
        ? runWithDatabaseRuntime(executionContext.databaseRuntime, invoke)
        : invoke();
    },
  };
}

module.exports = { createCapabilityCatalog, createCoreRuntime, ontology: require("./ontology"), ...require("./ontology") };
