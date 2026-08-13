const SOURCE_API_KEYS = Object.freeze(["GET /api/v1/dev-ai-configs", "PUT /api/v1/dev-ai-configs/:id"]);
const SOURCE_FRONTEND_KEYS = Object.freeze(["/dashboard/data-development/sql-tasks"]);
const CAPABILITY_DEFINITIONS = Object.freeze([
  ["listConfigs", "listConfigs", "read"], ["updateConfig", "updateConfig", "write"],
].map(([name, port, kind], index) => Object.freeze({ capabilityId: `devAiConfigs.${name}`, sourceApiKeys: Object.freeze([SOURCE_API_KEYS[index]]), sourceFrontendKeys: SOURCE_FRONTEND_KEYS, inputSchema: Object.freeze({ type: "object", additionalProperties: true }), outputSchema: Object.freeze({ type: "object" }), permission: Object.freeze({ allOf: Object.freeze(["data_development"]) }), mutation: Object.freeze({ kind, idempotent: true }), executionTargets: Object.freeze(["mysql"]), port })));
module.exports = { SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS, CAPABILITY_DEFINITIONS };
