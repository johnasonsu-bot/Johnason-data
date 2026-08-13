const SOURCE_API_KEYS = Object.freeze([
  "GET /api/v1/data-sources",
  "GET /api/v1/data-sources/:id/tasks",
  "GET /api/v1/data-sources/:id/tables",
  "GET /api/v1/data-sources/:id/tables/:tableName/columns",
  "GET /api/v1/data-sources/:id/tables/:tableName/sample",
  "POST /api/v1/data-sources",
  "PUT /api/v1/data-sources/:id",
  "DELETE /api/v1/data-sources/:id",
  "POST /api/v1/data-sources/test-connection",
]);

const SOURCE_FRONTEND_KEYS = Object.freeze([
  "frontend/src/pages/data-sources/DataSourcesPage.tsx",
  "frontend/src/pages/data-file-imports/FileImportWorkspacePage.tsx",
  "frontend/src/pages/data-ingestion-jobs/TaskConfigPage.tsx",
]);

const PLATFORM_DATABASE_TARGET = Object.freeze({
  kind: "database",
  engine: "mysql",
  role: "platform-authority",
});

const CONDITIONAL_SOURCE_TARGETS = Object.freeze([
  Object.freeze({ kind: "api", provider: "external-api", conditional: true }),
  Object.freeze({ kind: "database", engine: "mysql", conditional: true }),
  Object.freeze({ kind: "database", engine: "postgresql", conditional: true }),
  Object.freeze({ kind: "database", engine: "oracle", conditional: true }),
  Object.freeze({ kind: "database", engine: "dm", conditional: true }),
]);

const DATA_SOURCE_TYPES = Object.freeze([
  "mysql",
  "postgresql",
  "gaussdb",
  "jdbc",
  "oracle",
  "dm",
  "api",
  "ftp",
  "sftp",
  "kafka",
  "hive",
  "other",
]);

function objectSchema(properties = {}, required = []) {
  return Object.freeze({
    type: "object",
    properties: Object.freeze(properties),
    ...(required.length ? { required: Object.freeze(required) } : {}),
  });
}

const SOURCE_DEFINITIONS = Object.freeze([
  {
    capabilityId: "data-sources.list",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[0]]),
    sourceFrontendKeys: Object.freeze([SOURCE_FRONTEND_KEYS[0], SOURCE_FRONTEND_KEYS[1], SOURCE_FRONTEND_KEYS[2]]),
    inputSchema: objectSchema({ sourceDomain: { type: "string" }, includeConnectivity: { type: "boolean" }, sourceIds: { type: "array" } }),
    outputSchema: Object.freeze({ type: "array" }),
    permission: Object.freeze({ allOf: Object.freeze(["ingestion"]) }),
    mutation: Object.freeze({ kind: "read", idempotent: true }),
    executionTargets: Object.freeze([PLATFORM_DATABASE_TARGET]),
    port: "listDataSources",
  },
  {
    capabilityId: "data-sources.listReferencedTasks",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[1]]),
    sourceFrontendKeys: Object.freeze([SOURCE_FRONTEND_KEYS[0]]),
    inputSchema: objectSchema({ id: { type: ["number", "string"] } }, ["id"]),
    outputSchema: Object.freeze({ type: "array" }),
    permission: Object.freeze({ allOf: Object.freeze(["ingestion"]) }),
    mutation: Object.freeze({ kind: "read", idempotent: true }),
    executionTargets: Object.freeze([PLATFORM_DATABASE_TARGET]),
    port: "listReferencedTasks",
  },
  {
    capabilityId: "data-sources.listTables",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[2]]),
    sourceFrontendKeys: Object.freeze([SOURCE_FRONTEND_KEYS[0], SOURCE_FRONTEND_KEYS[1], SOURCE_FRONTEND_KEYS[2]]),
    inputSchema: objectSchema({ id: { type: ["number", "string"] }, includeDirectories: { type: "boolean" } }, ["id"]),
    outputSchema: Object.freeze({ type: "array" }),
    permission: Object.freeze({ allOf: Object.freeze(["ingestion"]) }),
    mutation: Object.freeze({ kind: "read", idempotent: true }),
    executionTargets: Object.freeze([PLATFORM_DATABASE_TARGET, ...CONDITIONAL_SOURCE_TARGETS]),
    port: "listTables",
  },
  {
    capabilityId: "data-sources.listColumns",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[3]]),
    sourceFrontendKeys: Object.freeze([SOURCE_FRONTEND_KEYS[0], SOURCE_FRONTEND_KEYS[1], SOURCE_FRONTEND_KEYS[2]]),
    inputSchema: objectSchema({ id: { type: ["number", "string"] }, tableName: { type: "string" } }, ["id", "tableName"]),
    outputSchema: Object.freeze({ type: "array" }),
    permission: Object.freeze({ allOf: Object.freeze(["ingestion"]) }),
    mutation: Object.freeze({ kind: "read", idempotent: true }),
    executionTargets: Object.freeze([PLATFORM_DATABASE_TARGET, ...CONDITIONAL_SOURCE_TARGETS]),
    port: "listColumns",
  },
  {
    capabilityId: "data-sources.sampleRows",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[4]]),
    sourceFrontendKeys: Object.freeze([SOURCE_FRONTEND_KEYS[0], SOURCE_FRONTEND_KEYS[1], SOURCE_FRONTEND_KEYS[2]]),
    inputSchema: objectSchema({ id: { type: ["number", "string"] }, tableName: { type: "string" }, limit: { type: "number" } }, ["id", "tableName"]),
    outputSchema: Object.freeze({ type: "array" }),
    permission: Object.freeze({ allOf: Object.freeze(["ingestion"]) }),
    mutation: Object.freeze({ kind: "read", idempotent: true }),
    executionTargets: Object.freeze([PLATFORM_DATABASE_TARGET, ...CONDITIONAL_SOURCE_TARGETS]),
    port: "sampleRows",
  },
  {
    capabilityId: "data-sources.create",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[5]]),
    sourceFrontendKeys: Object.freeze([SOURCE_FRONTEND_KEYS[0]]),
    inputSchema: objectSchema({ sourceName: { type: "string" }, sourceCode: { type: "string" }, sourceType: { enum: DATA_SOURCE_TYPES } }, ["sourceName", "sourceCode", "sourceType"]),
    outputSchema: Object.freeze({ type: "object" }),
    permission: Object.freeze({ allOf: Object.freeze(["ingestion"]) }),
    mutation: Object.freeze({ kind: "write", idempotent: true, audited: true }),
    executionTargets: Object.freeze([PLATFORM_DATABASE_TARGET]),
    port: "createDataSource",
  },
  {
    capabilityId: "data-sources.update",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[6]]),
    sourceFrontendKeys: Object.freeze([SOURCE_FRONTEND_KEYS[0]]),
    inputSchema: objectSchema({ id: { type: ["number", "string"] }, sourceName: { type: "string" }, sourceCode: { type: "string" }, sourceType: { enum: DATA_SOURCE_TYPES } }, ["id", "sourceName", "sourceCode", "sourceType"]),
    outputSchema: Object.freeze({ type: "object" }),
    permission: Object.freeze({ allOf: Object.freeze(["ingestion"]) }),
    mutation: Object.freeze({ kind: "write", idempotent: true, audited: true }),
    executionTargets: Object.freeze([PLATFORM_DATABASE_TARGET]),
    port: "updateDataSource",
  },
  {
    capabilityId: "data-sources.delete",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[7]]),
    sourceFrontendKeys: Object.freeze([SOURCE_FRONTEND_KEYS[0]]),
    inputSchema: objectSchema({ id: { type: ["number", "string"] } }, ["id"]),
    outputSchema: Object.freeze({ type: "object" }),
    permission: Object.freeze({ allOf: Object.freeze(["ingestion"]) }),
    mutation: Object.freeze({ kind: "delete", idempotent: true, audited: true, destructive: true }),
    executionTargets: Object.freeze([PLATFORM_DATABASE_TARGET]),
    port: "deleteDataSource",
  },
  {
    capabilityId: "data-sources.testConnection",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[8]]),
    sourceFrontendKeys: Object.freeze([SOURCE_FRONTEND_KEYS[0]]),
    inputSchema: objectSchema({ sourceType: { type: "string" }, connectionConfig: { type: "object" } }, ["sourceType", "connectionConfig"]),
    outputSchema: Object.freeze({ type: "object" }),
    permission: Object.freeze({ allOf: Object.freeze(["ingestion"]) }),
    mutation: Object.freeze({ kind: "read", idempotent: true }),
    executionTargets: Object.freeze([...CONDITIONAL_SOURCE_TARGETS]),
    port: "testConnection",
  },
]);

module.exports = {
  DATA_SOURCE_TYPES,
  CONDITIONAL_SOURCE_TARGETS,
  PLATFORM_DATABASE_TARGET,
  SOURCE_API_KEYS,
  SOURCE_DEFINITIONS,
  SOURCE_FRONTEND_KEYS,
};
