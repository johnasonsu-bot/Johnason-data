const { validateModuleManifest } = require("@johnason/data-platform-core-kernel");
const { SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS, CAPABILITY_DEFINITIONS } = require("../contracts");

const dependencies = Object.freeze({ "@johnason/data-platform-core-kernel": "0.1.0" });
const moduleManifest = Object.freeze({
  ...validateModuleManifest({
    moduleName: "ingestion-tasks",
    moduleVersion: "0.2.0",
    capabilitySchemaVersion: "1.0.0",
    capabilities: CAPABILITY_DEFINITIONS.map(({ inputSchema, outputSchema, permission, mutation, port, ...definition }) => definition),
  }),
  moduleId: "ingestion-tasks",
  sourceApiKeys: SOURCE_API_KEYS,
  sourceFrontendKeys: SOURCE_FRONTEND_KEYS,
  dependencies,
});

function resolvePort(input, name) {
  const service = input?.service || input?.ingestionTasksService || input?.ports || input;
  if (service && typeof service[name] === "function") return service[name].bind(service);
  return async () => {
    const error = new Error(`ingestion-tasks capability port is not configured: ${name}`);
    error.code = "CAPABILITY_PORT_NOT_CONFIGURED";
    throw error;
  };
}

function argsFor(capabilityId, input = {}, context = {}) {
  switch (capabilityId) {
    case "ingestionTasks.detail":
    case "ingestionTasks.delete":
    case "ingestionTasks.start":
    case "ingestionTasks.stop":
    case "ingestionTasks.runs":
      return [input.id, context];
    case "ingestionTasks.update":
      return [input.id, input.body === undefined ? input : input.body, context];
    case "ingestionTasks.analyzeFailure":
      return [input.id, input.runId, input.body === undefined ? input : input.body, context];
    case "ingestionTasks.run":
      return [input.id, input.body === undefined ? input : input.body, context];
    case "ingestionTasks.create":
    case "ingestionTasks.recommendConfig":
    case "ingestionTasks.parseApiDocument":
    case "ingestionTasks.previewSource":
      return [input.body === undefined ? input : input.body, context];
    default:
      return [input, context];
  }
}

function createCapabilities(input = {}) {
  return Object.freeze(CAPABILITY_DEFINITIONS.map((definition) => Object.freeze({
    ...definition,
    id: definition.capabilityId,
    schema: definition.inputSchema,
    execute: async (value = {}, context = {}) => resolvePort(input, definition.port)(...argsFor(definition.capabilityId, value, context)),
  })));
}

function createRuntimeAdapters(input = {}) {
  const adapters = { service: input.service || input.ingestionTasksService || {}, databaseRuntime: input.databaseRuntime || null };
  for (const definition of CAPABILITY_DEFINITIONS) adapters[definition.port] = resolvePort(input, definition.port);
  return Object.freeze(adapters);
}

module.exports = { moduleManifest, createCapabilities, createRuntimeAdapters, SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS };
