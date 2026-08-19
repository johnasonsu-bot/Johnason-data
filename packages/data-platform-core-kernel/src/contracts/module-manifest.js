const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const CAPABILITY_ID = /^[a-z0-9][a-z0-9.-]*$/;

function fail(message) {
  const error = new TypeError(message);
  error.code = "INVALID_MODULE_MANIFEST";
  throw error;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactVersion(value, field) {
  if (!EXACT_VERSION.test(String(value || ""))) fail(`${field} must be an exact version`);
  return value;
}

function uniqueStrings(values, field) {
  if (!Array.isArray(values)) fail(`${field} must be an array`);
  const result = values.map((value) => String(value));
  if (new Set(result).size !== result.length) fail(`${field} contains duplicate values`);
  return result;
}

function validateModuleManifest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("manifest must be an object");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(input.moduleName || ""))) fail("moduleName is invalid");
  exactVersion(input.moduleVersion, "moduleVersion");
  exactVersion(input.capabilitySchemaVersion, "capabilitySchemaVersion");
  if (!Array.isArray(input.capabilities)) fail("capabilities must be an array");

  const capabilityIds = new Set();
  const apiOwners = new Set();
  const capabilities = input.capabilities.map((candidate) => {
    if (!candidate || typeof candidate !== "object") fail("capability must be an object");
    if (!CAPABILITY_ID.test(String(candidate.capabilityId || ""))) fail("capabilityId is invalid");
    if (capabilityIds.has(candidate.capabilityId)) fail(`duplicate capability: ${candidate.capabilityId}`);
    capabilityIds.add(candidate.capabilityId);
    const sourceApiKeys = uniqueStrings(candidate.sourceApiKeys || [], "sourceApiKeys");
    for (const apiKey of sourceApiKeys) {
      if (apiOwners.has(apiKey)) fail(`duplicate source API: ${apiKey}`);
      apiOwners.add(apiKey);
    }
    const sourceFrontendKeys = uniqueStrings(candidate.sourceFrontendKeys || [], "sourceFrontendKeys");
    const executionTargets = Array.isArray(candidate.executionTargets)
      ? candidate.executionTargets.map((target) => ({ ...target }))
      : fail("executionTargets must be an array");
    return { ...candidate, sourceApiKeys, sourceFrontendKeys, executionTargets };
  });

  return deepFreeze({
    moduleName: input.moduleName,
    moduleVersion: input.moduleVersion,
    capabilitySchemaVersion: input.capabilitySchemaVersion,
    capabilities,
  });
}

module.exports = { validateModuleManifest, deepFreeze, EXACT_VERSION };
