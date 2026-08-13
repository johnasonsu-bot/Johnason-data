const SOURCE_API_KEYS = Object.freeze([
  "GET /api/v1/ingestion-tasks/monitor-overview",
  "GET /api/v1/ingestion-tasks",
  "GET /api/v1/ingestion-tasks/:id",
  "POST /api/v1/ingestion-tasks",
  "PUT /api/v1/ingestion-tasks/:id",
  "DELETE /api/v1/ingestion-tasks/:id",
  "POST /api/v1/ingestion-tasks/recommend-config",
  "POST /api/v1/ingestion-tasks/parse-api-document",
  "POST /api/v1/ingestion-tasks/preview-source",
  "POST /api/v1/ingestion-tasks/:id/start",
  "POST /api/v1/ingestion-tasks/:id/stop",
  "POST /api/v1/ingestion-tasks/:id/run",
  "GET /api/v1/ingestion-tasks/:id/runs",
  "POST /api/v1/ingestion-tasks/:id/runs/:runId/analyze-failure",
]);

const SOURCE_FRONTEND_KEYS = Object.freeze([
  "/dashboard/data-ingestion-monitor",
  "/dashboard/data-ingestion-jobs",
  "/dashboard/data-ingestion-ai",
]);

const PLATFORM = Object.freeze(["mysql"]);
const PLATFORM_API = Object.freeze(["mysql", "api"]);
const BUSINESS_API = Object.freeze(["mysql", "postgresql", "oracle", "dm", "api"]);
const definitions = [
  ["monitorOverview", "getMonitorOverview", PLATFORM],
  ["list", "listTasks", PLATFORM],
  ["detail", "getTask", PLATFORM],
  ["create", "createTask", PLATFORM],
  ["update", "updateTask", PLATFORM],
  ["delete", "deleteTask", PLATFORM],
  ["recommendConfig", "recommendTaskConfig", PLATFORM_API],
  ["parseApiDocument", "parseApiDocument", PLATFORM],
  ["previewSource", "previewSourceData", BUSINESS_API],
  ["start", "startTask", PLATFORM],
  ["stop", "stopTask", PLATFORM],
  ["run", "runTaskNow", BUSINESS_API],
  ["runs", "getJobRuns", PLATFORM],
  ["analyzeFailure", "analyzeJobRunFailure", PLATFORM_API],
];

const CAPABILITY_DEFINITIONS = Object.freeze(definitions.map(([name, port, executionTargets], index) => Object.freeze({
  capabilityId: `ingestionTasks.${name}`,
  sourceApiKeys: Object.freeze([SOURCE_API_KEYS[index]]),
  sourceFrontendKeys: SOURCE_FRONTEND_KEYS,
  inputSchema: Object.freeze({ type: "object", additionalProperties: true }),
  outputSchema: Object.freeze({ type: "object" }),
  permission: Object.freeze({ allOf: Object.freeze(["ingestion"]) }),
  mutation: Object.freeze({
    kind: ["create", "update", "delete", "start", "stop", "run"].includes(name) ? "write" : "read",
    idempotent: ["create", "run"].includes(name) === false,
    audited: ["create", "update", "delete", "start", "stop", "run"].includes(name),
  }),
  executionTargets: Object.freeze(executionTargets),
  port,
})));

module.exports = { SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS, CAPABILITY_DEFINITIONS };
