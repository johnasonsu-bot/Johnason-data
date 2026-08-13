const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

function exactVersion(value, label) {
  if (typeof value !== "string" || !EXACT_VERSION.test(value)) {
    throw new TypeError(`${label} must be an exact version`);
  }
  return value;
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new TypeError(`${label} must be an array of non-empty strings`);
  }
  return Object.freeze([...value]);
}

function validateAggregateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new TypeError("Aggregate manifest is required");
  exactVersion(manifest.aggregateVersion, "Aggregate version");
  exactVersion(manifest.capabilitySchemaVersion, "Aggregate capability schema version");
  if (!manifest.kernel || typeof manifest.kernel !== "object" || Array.isArray(manifest.kernel)) throw new TypeError("Aggregate kernel selection is required");
  nonEmptyString(manifest.kernel.packageName, "Kernel package name");
  exactVersion(manifest.kernel.version, "Kernel version");
  if (!Array.isArray(manifest.modules) || manifest.modules.length === 0) throw new TypeError("Aggregate modules are required");
  if (!Array.isArray(manifest.sourceApiAliases)) throw new TypeError("Aggregate source API aliases must be an array");

  const packageNames = new Set();
  const moduleNames = new Set();
  for (const selection of manifest.modules) {
    if (!selection || typeof selection !== "object" || Array.isArray(selection)) throw new TypeError("Aggregate module selection must be an object");
    nonEmptyString(selection.packageName, "Module package name");
    nonEmptyString(selection.moduleName, "Module name");
    exactVersion(selection.candidateVersion, `${selection.packageName} candidate version`);
    exactVersion(selection.rollbackVersion, `${selection.packageName} rollback version`);
    exactVersion(selection.capabilitySchemaVersion, `${selection.packageName} capability schema version`);
    nonEmptyString(selection.factoryExport, `${selection.packageName} factory export`);
    if (packageNames.has(selection.packageName)) throw new TypeError(`Duplicate module package: ${selection.packageName}`);
    if (moduleNames.has(selection.moduleName)) throw new TypeError(`Duplicate module name: ${selection.moduleName}`);
    packageNames.add(selection.packageName);
    moduleNames.add(selection.moduleName);
  }
  return manifest;
}

function aliasKey(sourceApiKey, canonicalCapabilityId, aliasCapabilityId) {
  return `${sourceApiKey}\u0000${canonicalCapabilityId}\u0000${aliasCapabilityId}`;
}

function validateAlias(alias) {
  if (!alias || typeof alias !== "object" || Array.isArray(alias)) throw new TypeError("Source API alias must be an object");
  return aliasKey(
    nonEmptyString(alias.sourceApiKey, "Source API alias key"),
    nonEmptyString(alias.canonicalCapabilityId, "Canonical capability ID"),
    nonEmptyString(alias.aliasCapabilityId, "Alias capability ID"),
  );
}

function createCapabilityCatalog({ manifest, aggregatePackageVersion, kernelVersion, dependencyVersions, modules }) {
  validateAggregateManifest(manifest);
  if (aggregatePackageVersion !== manifest.aggregateVersion) {
    throw new TypeError("Aggregate package version mismatch");
  }
  if (!dependencyVersions || typeof dependencyVersions !== "object" || Array.isArray(dependencyVersions)) {
    throw new TypeError("Dependency lock versions are required");
  }
  if (!modules || typeof modules !== "object" || Array.isArray(modules)) throw new TypeError("Resolved modules are required");
  if (dependencyVersions[manifest.kernel.packageName] !== manifest.kernel.version) {
    throw new TypeError(`Dependency lock version mismatch for ${manifest.kernel.packageName}`);
  }
  if (kernelVersion !== manifest.kernel.version) {
    throw new TypeError(`Kernel export version mismatch for ${manifest.kernel.packageName}`);
  }

  const declaredAliases = new Set();
  const aliasesBySource = new Map();
  for (const alias of manifest.sourceApiAliases) {
    const key = validateAlias(alias);
    if (declaredAliases.has(key)) throw new TypeError(`Duplicate source API alias: ${alias.sourceApiKey}`);
    declaredAliases.add(key);
    const sourceAliases = aliasesBySource.get(alias.sourceApiKey) || [];
    sourceAliases.push(alias);
    aliasesBySource.set(alias.sourceApiKey, sourceAliases);
  }
  const definitions = new Map();
  const sourceDefinitions = new Map();
  const sourceOccurrences = new Map();
  const moduleVersions = {};

  for (const selection of manifest.modules) {
    if (dependencyVersions[selection.packageName] !== selection.candidateVersion) {
      throw new TypeError(`Dependency lock version mismatch for ${selection.packageName}`);
    }
    const moduleExports = modules[selection.packageName];
    if (!moduleExports) throw new TypeError(`Missing required module: ${selection.packageName}`);
    if (typeof moduleExports[selection.factoryExport] !== "function") {
      throw new TypeError(`Missing required module factory ${selection.factoryExport} from ${selection.packageName}`);
    }
    const exportedManifest = moduleExports.moduleManifest;
    if (!exportedManifest || typeof exportedManifest !== "object") throw new TypeError(`Missing module manifest export from ${selection.packageName}`);
    if (exportedManifest.moduleName !== selection.moduleName) throw new TypeError(`Module export name mismatch for ${selection.packageName}`);
    if (exportedManifest.moduleVersion !== selection.candidateVersion) throw new TypeError(`Module export version mismatch for ${selection.packageName}`);
    if (selection.capabilitySchemaVersion !== manifest.capabilitySchemaVersion
      || exportedManifest.capabilitySchemaVersion !== selection.capabilitySchemaVersion) {
      throw new TypeError(`Incompatible capability schema for ${selection.packageName}`);
    }
    if (!Array.isArray(exportedManifest.capabilities)) throw new TypeError(`Missing capabilities from ${selection.packageName}`);
    moduleVersions[selection.moduleName] = selection.candidateVersion;

    for (const capability of exportedManifest.capabilities) {
      const capabilityId = nonEmptyString(capability?.capabilityId, `${selection.packageName} capability ID`);
      if (definitions.has(capabilityId)) throw new TypeError(`Duplicate capability ID: ${capabilityId}`);
      const definition = Object.freeze({
        capabilityId,
        moduleName: selection.moduleName,
        packageName: selection.packageName,
        moduleVersion: selection.candidateVersion,
        rollbackVersion: selection.rollbackVersion,
        capabilitySchemaVersion: selection.capabilitySchemaVersion,
        sourceApiKeys: stringArray(capability.sourceApiKeys, `${capabilityId} source API keys`),
        sourceFrontendKeys: stringArray(capability.sourceFrontendKeys, `${capabilityId} source frontend keys`),
        executionTargets: stringArray(capability.executionTargets, `${capabilityId} execution targets`),
      });
      definitions.set(capabilityId, definition);

      for (const sourceApiKey of definition.sourceApiKeys) {
        const occurrences = sourceOccurrences.get(sourceApiKey) || [];
        occurrences.push(capabilityId);
        sourceOccurrences.set(sourceApiKey, occurrences);
      }
    }
  }

  for (const [sourceApiKey, capabilityIds] of sourceOccurrences) {
    const sourceAliases = aliasesBySource.get(sourceApiKey) || [];
    const canonicalIds = new Set(sourceAliases.map((alias) => alias.canonicalCapabilityId));
    const canonicalCapabilityId = capabilityIds.length === 1 ? capabilityIds[0] : [...canonicalIds][0];
    if (capabilityIds.length > 1 && canonicalIds.size !== 1) {
      throw new TypeError(`Duplicate source API key without alias: ${sourceApiKey}`);
    }
    if (!capabilityIds.includes(canonicalCapabilityId)) throw new TypeError(`Invalid source API alias: ${sourceApiKey}`);
    for (const aliasCapabilityId of capabilityIds.filter((capabilityId) => capabilityId !== canonicalCapabilityId)) {
      if (!declaredAliases.has(aliasKey(sourceApiKey, canonicalCapabilityId, aliasCapabilityId))) {
        throw new TypeError(`Duplicate source API key without alias: ${sourceApiKey}`);
      }
    }
    sourceDefinitions.set(sourceApiKey, definitions.get(canonicalCapabilityId));
  }

  for (const alias of manifest.sourceApiAliases) {
    const occurrences = sourceOccurrences.get(alias.sourceApiKey) || [];
    if (alias.canonicalCapabilityId === alias.aliasCapabilityId
      || !occurrences.includes(alias.canonicalCapabilityId)
      || !occurrences.includes(alias.aliasCapabilityId)) {
      throw new TypeError(`Invalid source API alias: ${alias.sourceApiKey}`);
    }
  }

  const values = Object.freeze([...definitions.values()]);
  const versions = Object.freeze({ ...moduleVersions });
  return Object.freeze({
    get(capabilityId) {
      const definition = definitions.get(capabilityId);
      if (!definition) throw new TypeError(`Unknown capability: ${capabilityId}`);
      return definition;
    },
    getBySourceApiKey(sourceApiKey) {
      const definition = sourceDefinitions.get(sourceApiKey);
      if (!definition) throw new TypeError(`Unknown source API key: ${sourceApiKey}`);
      return definition;
    },
    values() {
      return values;
    },
    moduleVersions: versions,
  });
}

module.exports = { createCapabilityCatalog, validateAggregateManifest };
