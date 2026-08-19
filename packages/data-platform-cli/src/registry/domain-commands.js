const { validateExecutionTargets } = require("./execution-targets");

const FILE_STREAM_API_KEYS = new Set([
  "GET /api/v1/system-knowledge-bases/documents/:documentId/content",
]);

function createDomainCommands(capabilityCatalog) {
  if (!(capabilityCatalog instanceof Map)) throw new TypeError("capabilityCatalog must be a Map");
  const commands = new Map();
  for (const capability of capabilityCatalog.values()) {
    const command = capability.command;
    const current = commands.get(command) || {
      command,
      capabilityIds: [],
      sourceApiKeys: [],
      sourceFrontendKeys: [],
      modules: [],
      actions: [],
      interactions: [],
      executionModes: [],
      executionTargets: [],
      confirmationRequired: false,
      destructive: false,
      requiresYes: false,
      requiresOutput: false,
      streamOutput: null,
      supportsWait: false,
      supportsTimeout: false,
    };
    current.capabilityIds.push(capability.capabilityId);
    current.sourceApiKeys.push(...capability.sourceApiKeys);
    current.sourceFrontendKeys.push(...capability.sourceFrontendKeys);
    current.modules.push(capability.module);
    current.actions.push(capability.action);
    current.interactions.push(capability.interaction);
    current.executionModes.push(capability.executionMode);
    current.executionTargets.push(...validateExecutionTargets(capability.executionTargets));
    current.confirmationRequired ||= Boolean(capability.confirmationRequired);
    current.destructive ||= capability.action === "delete";
    commands.set(command, current);
  }

  return [...commands.values()].map((definition) => {
    for (const key of ["capabilityIds", "sourceApiKeys", "sourceFrontendKeys", "modules", "actions", "interactions", "executionModes"]) {
      definition[key] = [...new Set(definition[key])];
    }
    definition.executionTargets = validateExecutionTargets(definition.executionTargets);
    definition.requiresYes = definition.confirmationRequired || definition.destructive;
    const fileStream = definition.sourceApiKeys.some((apiKey) => FILE_STREAM_API_KEYS.has(apiKey));
    definition.requiresOutput = definition.interactions.includes("download") || fileStream;
    definition.streamOutput = definition.interactions.includes("stream") && !fileStream ? "ndjson" : null;
    definition.supportsWait = definition.executionModes.includes("async-job-capable");
    definition.supportsTimeout = definition.supportsWait;
    return Object.freeze(definition);
  }).sort((left, right) => left.command.localeCompare(right.command));
}

module.exports = { createDomainCommands };
