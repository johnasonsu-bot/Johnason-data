const {
  DATA_SOURCE_TYPES,
  SOURCE_API_KEYS,
  SOURCE_DEFINITIONS,
  SOURCE_FRONTEND_KEYS,
} = require("../contracts");

const MODULE_ID = "data-sources";
const MODULE_VERSION = "0.2.0";
const CAPABILITY_SCHEMA_VERSION = "0.1.0";
const KERNEL_VERSION = "0.1.0";

const dependencies = Object.freeze({
  "@johnason/data-platform-core-kernel": KERNEL_VERSION,
});

function kernelExecutionTargets(executionTargets) {
  return executionTargets.map((target) => {
    if (target.kind === "database") return `${target.engine}:${target.role || "source"}`;
    if (target.kind === "api") return `api:${target.provider || "external-api"}${target.conditional ? ":conditional" : ""}`;
    return target.kind;
  });
}

const moduleManifest = Object.freeze({
  moduleId: MODULE_ID,
  moduleName: MODULE_ID,
  moduleVersion: MODULE_VERSION,
  capabilitySchemaVersion: CAPABILITY_SCHEMA_VERSION,
  sourceApiKeys: SOURCE_API_KEYS,
  sourceFrontendKeys: SOURCE_FRONTEND_KEYS,
  dependencies,
  capabilities: Object.freeze(SOURCE_DEFINITIONS.map(({ port, executionTargets, ...definition }) => Object.freeze({
    ...definition,
    executionTargets: Object.freeze(kernelExecutionTargets(executionTargets)),
  }))),
});

function resolvePort(dependenciesInput, port) {
  const service = dependenciesInput?.service
    || dependenciesInput?.dataSourceService
    || dependenciesInput?.ports;
  if (service && typeof service[port] === "function") return service[port].bind(service);
  if (typeof dependenciesInput?.[port] === "function") return dependenciesInput[port];
  return async () => {
    const error = new Error(`data-sources capability port is not configured: ${port}`);
    error.code = "CAPABILITY_PORT_NOT_CONFIGURED";
    throw error;
  };
}

function capabilityArgs(capabilityId, input, executionContext) {
  switch (capabilityId) {
    case "data-sources.listReferencedTasks":
      return [input?.id, executionContext];
    case "data-sources.listTables":
      return [input?.id, { includeDirectories: Boolean(input?.includeDirectories) }, executionContext];
    case "data-sources.listColumns":
      return [input?.id, input?.tableName, executionContext];
    case "data-sources.sampleRows":
      return [input?.id, input?.tableName, input?.limit, executionContext];
    case "data-sources.update": {
      const { id, ...payload } = input || {};
      return [id, payload, executionContext];
    }
    case "data-sources.delete":
      return [input?.id, executionContext];
    default:
      return [input, executionContext];
  }
}

function createCapabilities(dependenciesInput = {}) {
  return SOURCE_DEFINITIONS.map((definition) => Object.freeze({
    ...definition,
    id: definition.capabilityId,
    schema: definition.inputSchema,
    execute: async (input = {}, executionContext = {}) => resolvePort(dependenciesInput, definition.port)(
      ...capabilityArgs(definition.capabilityId, input, executionContext),
    ),
  }));
}

function normalizeSourceType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["mariadb"].includes(normalized)) return "mysql";
  if (["postgres", "pg", "gaussdb", "opengauss"].includes(normalized)) return "postgresql";
  if (["dameng", "dmdb"].includes(normalized)) return "dm";
  return normalized;
}

function inferDatabaseEngine(sourceType, connectionConfig = {}) {
  const normalized = normalizeSourceType(sourceType);
  if (["mysql", "postgresql", "oracle", "dm"].includes(normalized)) return normalized;
  if (normalized !== "jdbc") return null;
  const jdbcUrl = String(connectionConfig.jdbcUrl || connectionConfig.url || connectionConfig.connectionString || "").toLowerCase();
  if (jdbcUrl.startsWith("jdbc:mysql:") || jdbcUrl.startsWith("jdbc:mariadb:")) return "mysql";
  if (jdbcUrl.startsWith("jdbc:postgresql:") || jdbcUrl.startsWith("jdbc:postgres:") || jdbcUrl.startsWith("jdbc:gaussdb:") || jdbcUrl.startsWith("jdbc:opengauss:")) return "postgresql";
  if (jdbcUrl.startsWith("jdbc:oracle:")) return "oracle";
  if (jdbcUrl.startsWith("jdbc:dm:")) return "dm";
  return null;
}

function resolveExecutionTargets(input = {}) {
  const source = input?.dataSource || input;
  const sourceType = normalizeSourceType(source?.sourceType);
  if (sourceType === "api") return [{ kind: "api", provider: "external-api" }];
  const engine = inferDatabaseEngine(sourceType, source?.connectionConfig || {});
  return engine ? [{ kind: "database", engine }] : [];
}

function createRuntimeAdapters(dependenciesInput = {}) {
  const service = dependenciesInput.service || dependenciesInput.dataSourceService || {};
  const repository = dependenciesInput.repository || dependenciesInput.dataSourceRepository || {};
  const metadata = dependenciesInput.metadata || dependenciesInput.metadataService || {};
  const adapters = {
    service,
    repository,
    metadata,
    databaseRuntime: dependenciesInput.databaseRuntime || null,
    dataSourceTypes: DATA_SOURCE_TYPES,
    resolveExecutionTargets,
  };
  for (const definition of SOURCE_DEFINITIONS) {
    adapters[definition.port] = resolvePort(dependenciesInput, definition.port);
  }
  return Object.freeze(adapters);
}

module.exports = {
  DATA_SOURCE_TYPES,
  inferDatabaseEngine,
  moduleManifest,
  createCapabilities,
  createRuntimeAdapters,
  resolveExecutionTargets,
};
