const SOURCE_API_KEYS = Object.freeze([
  "GET /api/v1/model-providers", "POST /api/v1/model-providers/test-connection", "POST /api/v1/model-providers",
  "PUT /api/v1/model-providers/:id", "DELETE /api/v1/model-providers/:id",
]);
const SOURCE_FRONTEND_KEYS = Object.freeze(["/dashboard/system-models"]);
const defs = [["list", "listModelProviders", ["mysql"]], ["testConnection", "testModelProvider", ["mysql", "api"]], ["create", "createModelProvider", ["mysql"]], ["update", "updateModelProvider", ["mysql"]], ["delete", "deleteModelProvider", ["mysql"]]];
const CAPABILITY_DEFINITIONS = Object.freeze(defs.map(([name, port, targets], index) => Object.freeze({
  capabilityId: `modelProviders.${name}`, sourceApiKeys: Object.freeze([SOURCE_API_KEYS[index]]), sourceFrontendKeys: SOURCE_FRONTEND_KEYS,
  inputSchema: Object.freeze({ type: "object", additionalProperties: true }), outputSchema: Object.freeze({ type: "object" }),
  permission: Object.freeze({ allOf: Object.freeze(["model_providers"]) }), mutation: Object.freeze({ kind: name === "delete" || name === "update" || name === "create" ? "write" : "read", idempotent: name !== "create" }),
  executionTargets: Object.freeze(targets), port,
})));
module.exports = { SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS, CAPABILITY_DEFINITIONS };
