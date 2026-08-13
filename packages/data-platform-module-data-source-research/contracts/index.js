const SOURCE_API_KEYS = Object.freeze([
  "GET /api/v1/data-source-research/tasks", "POST /api/v1/data-source-research/tasks",
  "GET /api/v1/data-source-research/tasks/:taskId", "PUT /api/v1/data-source-research/tasks/:taskId",
  "DELETE /api/v1/data-source-research/tasks/:taskId", "GET /api/v1/data-source-research/tasks/:taskId/runs",
  "POST /api/v1/data-source-research/tasks/:taskId/runs", "GET /api/v1/data-source-research/tasks/:taskId/comparisons",
  "POST /api/v1/data-source-research/tasks/:taskId/compare", "GET /api/v1/data-source-research/comparisons/:comparisonId",
  "POST /api/v1/data-source-research/source/:sourceId/runs", "GET /api/v1/data-source-research/source/:sourceId/runs",
  "GET /api/v1/data-source-research/runs/:runId", "GET /api/v1/data-source-research/runs/:runId/logs",
  "GET /api/v1/data-source-research/runs/:runId/report", "GET /api/v1/data-source-research/runs/:runId/report.docx",
  "POST /api/v1/data-source-research/runs/:runId/terminate", "DELETE /api/v1/data-source-research/runs/:runId",
]);
const SOURCE_FRONTEND_KEYS = Object.freeze([
  "frontend/src/pages/data-source-research/DataSourceResearchPage.tsx",
  "frontend/src/pages/data-source-research/DataSourceResearchDetailPage.tsx",
  "frontend/src/pages/data-sources/components/DataSourceResearchModal.tsx",
]);
const PLATFORM = Object.freeze({ kind: "database", engine: "mysql", role: "platform-authority" });
const BUSINESS = Object.freeze([
  Object.freeze({ kind: "database", engine: "mysql", role: "business-datasource" }),
  Object.freeze({ kind: "database", engine: "postgresql", role: "business-datasource" }),
  Object.freeze({ kind: "api", provider: "external-api" }),
]);
const definitions = [
  ["listResearchTasks", "listResearchTasks", "read", [PLATFORM]], ["createResearchTask", "createResearchTask", "write", [PLATFORM]],
  ["getResearchTask", "getResearchTask", "read", [PLATFORM]], ["updateResearchTask", "updateResearchTask", "write", [PLATFORM]],
  ["deleteResearchTask", "deleteResearchTask", "delete", [PLATFORM]], ["listResearchTaskRuns", "listResearchTaskRuns", "read", [PLATFORM]],
  ["createResearchTaskRun", "createResearchTaskRun", "write", [PLATFORM, ...BUSINESS]], ["listResearchComparisons", "listResearchComparisons", "read", [PLATFORM]],
  ["compareResearchReports", "compareResearchReports", "write", [PLATFORM, { kind: "api", provider: "external-api" }]],
  ["getResearchComparison", "getResearchComparison", "read", [PLATFORM]], ["createResearchRun", "createResearchRun", "write", [PLATFORM, ...BUSINESS]],
  ["listResearchRuns", "listResearchRuns", "read", [PLATFORM]], ["getResearchRun", "getResearchRun", "read", [PLATFORM]],
  ["listResearchLogs", "listResearchLogs", "read", [PLATFORM]], ["getResearchReport", "getResearchReport", "read", [PLATFORM]],
  ["downloadResearchReportWord", "downloadResearchReportWord", "read", [PLATFORM]], ["terminateResearchRun", "terminateResearchRun", "write", [PLATFORM]],
  ["deleteResearchRun", "deleteResearchRun", "delete", [PLATFORM]],
];
const idFor = (name) => `dataSourceResearch.${name}`;
const inputSchema = (name) => Object.freeze({ type: "object", additionalProperties: true, title: name });
const outputSchema = Object.freeze({ type: "object" });
const CAPABILITY_DEFINITIONS = Object.freeze(definitions.map(([name, port, action, targets], index) => Object.freeze({
  capabilityId: idFor(name), sourceApiKeys: Object.freeze([SOURCE_API_KEYS[index]]),
  sourceFrontendKeys: SOURCE_FRONTEND_KEYS, inputSchema: inputSchema(name), outputSchema,
  permission: Object.freeze({ allOf: Object.freeze(["ingestion"]) }),
  mutation: Object.freeze({ kind: action, idempotent: action !== "write", audited: action !== "read", destructive: action === "delete" }),
  executionTargets: Object.freeze(targets.map((target) => target.kind === "database" ? target.engine : "api")),
  port,
})));
module.exports = { SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS, CAPABILITY_DEFINITIONS };
