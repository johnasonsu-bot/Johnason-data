const SOURCE_API_KEYS = Object.freeze([
  "GET /api/v1/file-imports", "GET /api/v1/file-imports/:id", "GET /api/v1/file-imports/:id/runs",
  "GET /api/v1/file-imports/:id/runs/:runId/errors", "POST /api/v1/file-imports/:id/runs/:runId/cancel",
  "POST /api/v1/file-imports/preview", "POST /api/v1/file-imports", "POST /api/v1/file-imports/suggest-technical-names",
  "PUT /api/v1/file-imports/:id", "POST /api/v1/file-imports/:id/run", "DELETE /api/v1/file-imports/:id",
]);
const SOURCE_FRONTEND_KEYS = Object.freeze(["/dashboard/data-file-imports"]);
const defs = [
  ["list", "listTasks"], ["detail", "getTask"], ["runs", "listRuns"], ["runErrors", "listRunErrors"],
  ["cancelRun", "cancelRun"], ["preview", "previewFiles"], ["create", "createTask"],
  ["suggestTechnicalNames", "suggestTechnicalNames"], ["update", "updateTask"], ["run", "runTaskNow"], ["delete", "deleteTask"],
];
const CAPABILITY_DEFINITIONS = Object.freeze(defs.map(([name, port], index) => Object.freeze({
  capabilityId: `fileImports.${name}`, sourceApiKeys: Object.freeze([SOURCE_API_KEYS[index]]), sourceFrontendKeys: SOURCE_FRONTEND_KEYS,
  inputSchema: Object.freeze({ type: "object", additionalProperties: true }), outputSchema: Object.freeze({ type: "object" }),
  permission: Object.freeze({ allOf: Object.freeze(["file_imports"]) }),
  mutation: Object.freeze({ kind: ["create", "update", "delete", "cancelRun", "run"].includes(name) ? "write" : "read", idempotent: !["create", "run"].includes(name) }),
  executionTargets: Object.freeze(["mysql"]), port,
})));
module.exports = { SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS, CAPABILITY_DEFINITIONS };
