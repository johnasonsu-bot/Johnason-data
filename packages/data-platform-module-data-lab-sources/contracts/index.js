const SOURCE_API_KEYS = Object.freeze([
  "GET /api/v1/data-modeling-sources", "GET /api/v1/data-modeling-sources/:id/scenes",
  "GET /api/v1/data-modeling-sources/:id/tables", "GET /api/v1/data-modeling-sources/:id/tables/:tableName/columns",
  "GET /api/v1/data-modeling-sources/:id/tables/:tableName/sample", "POST /api/v1/data-modeling-sources",
  "PUT /api/v1/data-modeling-sources/:id", "DELETE /api/v1/data-modeling-sources/:id",
  "POST /api/v1/data-modeling-sources/test-connection",
]);
const SOURCE_FRONTEND_KEYS = Object.freeze([
  "frontend/src/app/layouts/AppShell.tsx", "frontend/src/pages/data-lab/DataLabSourcesPage.tsx",
  "frontend/src/pages/data-lab/DataLabModelOverviewPage.tsx", "frontend/src/pages/data-lab/SimulationDataPage.tsx",
]);
const PLATFORM = "mysql";
const BUSINESS = Object.freeze(["mysql", "postgresql", "oracle", "dm"]);
const defs = [
  ["list", "listDataModelingSources", [PLATFORM]], ["scenes", "listDataModelingSourceScenes", [PLATFORM]],
  ["tables", "listDataModelingSourceTables", [PLATFORM, ...BUSINESS]], ["columns", "listDataModelingSourceColumns", [PLATFORM, ...BUSINESS]],
  ["sample", "sampleDataModelingSourceRows", [PLATFORM, ...BUSINESS]], ["create", "createDataModelingSource", [PLATFORM]],
  ["update", "updateDataModelingSource", [PLATFORM]], ["delete", "deleteDataModelingSource", [PLATFORM]],
  ["testConnection", "testDataModelingSourceConnection", [PLATFORM, ...BUSINESS]],
];
const CAPABILITY_DEFINITIONS = Object.freeze(defs.map(([name, port, targets], index) => Object.freeze({
  capabilityId: `dataLabSources.${name}`, sourceApiKeys: Object.freeze([SOURCE_API_KEYS[index]]),
  sourceFrontendKeys: SOURCE_FRONTEND_KEYS, inputSchema: Object.freeze({ type: "object", additionalProperties: true }),
  outputSchema: Object.freeze({ type: "object" }), permission: Object.freeze({ allOf: Object.freeze(["data_modeling"]) }),
  mutation: Object.freeze({ kind: ["create", "update"].includes(name) ? "write" : name === "delete" ? "delete" : "read", idempotent: true }),
  executionTargets: Object.freeze(targets), port,
})));
module.exports = { SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS, CAPABILITY_DEFINITIONS };
