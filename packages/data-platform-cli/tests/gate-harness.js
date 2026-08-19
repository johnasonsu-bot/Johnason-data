const { createCapabilityCatalog } = require("@johnason/data-platform-core");

const baseline = require("../../../docs/superpowers/specs/data-platform-cli-coverage-baseline.json");
const engines = Object.freeze(["mysql", "postgresql", "oracle", "dm"]);

function classifiedCapabilities(target) {
  return [...createCapabilityCatalog().values()]
    .filter((capability) => capability.executionTargets.some(target))
    .map((capability) => capability.capabilityId)
    .sort();
}

function apiCapabilityIds() {
  return classifiedCapabilities((target) => target.kind === "api");
}

function databaseCapabilityIds(engine) {
  if (!engines.includes(engine)) throw new TypeError(`Unsupported database gate engine: ${engine}`);
  return classifiedCapabilities((target) => target.kind === "database" && target.engine === engine);
}

module.exports = {
  baseline,
  engines,
  apiCapabilityIds,
  databaseCapabilityIds,
};
