const { validateModuleManifest } = require("@johnason/data-platform-core-kernel");
const { executeCapability } = require("./runtime");
const moduleManifest = validateModuleManifest(require("./manifest.json"));

function createCapabilities(dependencies = {}) {
  const execute = dependencies.executeCapability || executeCapability;
  return new Map(moduleManifest.capabilities.map((definition) => [definition.capabilityId, {
    ...definition,
    execute(input, context) { return execute(definition, input, context); },
  }]));
}

module.exports = { moduleManifest, createCapabilities };
