const SOURCE_API_KEYS = Object.freeze(["GET /api/service/*", "POST /api/service/*"]);
const SOURCE_FRONTEND_KEYS = Object.freeze([]);
const CAPABILITY_DEFINITIONS = Object.freeze([
  ["get", "GET"], ["post", "POST"],
].map(([name, method], index) => Object.freeze({
  capabilityId: `serviceRuntime.${name}`, sourceApiKeys: Object.freeze([SOURCE_API_KEYS[index]]), sourceFrontendKeys: SOURCE_FRONTEND_KEYS,
  inputSchema: Object.freeze({ type: "object", additionalProperties: true }), outputSchema: Object.freeze({ type: "object" }),
  permission: Object.freeze({ allOf: Object.freeze(["service_runtime"]) }), mutation: Object.freeze({ kind: method === "GET" ? "read" : "write", idempotent: method === "GET" }),
  executionTargets: Object.freeze(["mysql", "postgresql", "oracle", "dm", "api"]), port: "handleInvoke",
})));
module.exports = { SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS, CAPABILITY_DEFINITIONS };
