"use strict";

const SOURCE_API_KEYS = Object.freeze([
  "GET /api/v1/platform/overview",
  "GET /api/health",
  "GET /api/v1/platform/database-capabilities",
  "GET /api/v1/jobs/:id",
  "POST /api/auth/login",
  "GET /api/auth/profile",
  "GET /api/v1/reporting/runtime/dashboards/:id",
]);

const SOURCE_FRONTEND_KEYS = Object.freeze([
  "frontend/src/pages/dashboard/OverviewPage.tsx",
]);

const CAPABILITY_DEFINITIONS = Object.freeze([
  {
    capabilityId: "platform.overview",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[0]]),
    sourceFrontendKeys: Object.freeze([...SOURCE_FRONTEND_KEYS]),
    inputSchema: Object.freeze({ type: "object", additionalProperties: true }),
    outputSchema: Object.freeze({ type: "object" }),
    permission: Object.freeze({ modules: Object.freeze(["overview"]), action: "read" }),
    mutation: Object.freeze({ kind: "read", idempotent: true }),
    executionTargets: Object.freeze(["mysql:platform-authority"]),
    port: "overview",
  },
  {
    capabilityId: "platform.health",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[1]]),
    sourceFrontendKeys: Object.freeze([]),
    inputSchema: Object.freeze({ type: "object", additionalProperties: true }),
    outputSchema: Object.freeze({ type: "object" }),
    permission: Object.freeze({ modules: Object.freeze([]), action: "anonymous" }),
    mutation: Object.freeze({ kind: "read", idempotent: true }),
    executionTargets: Object.freeze(["local"]),
    port: "health",
  },
  {
    capabilityId: "platform.database-capabilities",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[2]]),
    sourceFrontendKeys: Object.freeze([]),
    inputSchema: Object.freeze({ type: "object", additionalProperties: true }),
    outputSchema: Object.freeze({ type: "array" }),
    permission: Object.freeze({ modules: Object.freeze([]), action: "anonymous" }),
    mutation: Object.freeze({ kind: "read", idempotent: true }),
    executionTargets: Object.freeze(["local"]),
    port: "databaseCapabilities",
  },
  {
    capabilityId: "platform.job",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[3]]),
    sourceFrontendKeys: Object.freeze([]),
    inputSchema: Object.freeze({ type: "object", required: Object.freeze(["id"]) }),
    outputSchema: Object.freeze({ type: "object" }),
    permission: Object.freeze({ modules: Object.freeze([]), action: "anonymous" }),
    mutation: Object.freeze({ kind: "read", idempotent: true }),
    executionTargets: Object.freeze(["mysql:platform-authority"]),
    port: "jobShow",
  },
  {
    capabilityId: "platform.auth-login",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[4]]),
    sourceFrontendKeys: Object.freeze([]),
    inputSchema: Object.freeze({ type: "object", required: Object.freeze(["username", "password"]) }),
    outputSchema: Object.freeze({ type: "object" }),
    permission: Object.freeze({ modules: Object.freeze([]), action: "anonymous" }),
    mutation: Object.freeze({ kind: "write", idempotent: false, audited: true }),
    executionTargets: Object.freeze(["mysql:platform-authority"]),
    port: "authLogin",
  },
  {
    capabilityId: "platform.auth-profile",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[5]]),
    sourceFrontendKeys: Object.freeze([]),
    inputSchema: Object.freeze({ type: "object", additionalProperties: true }),
    outputSchema: Object.freeze({ type: "object" }),
    permission: Object.freeze({ modules: Object.freeze([]), action: "read" }),
    mutation: Object.freeze({ kind: "read", idempotent: true }),
    executionTargets: Object.freeze(["mysql:platform-authority"]),
    port: "authProfile",
  },
  {
    capabilityId: "platform.reporting-runtime-dashboard",
    sourceApiKeys: Object.freeze([SOURCE_API_KEYS[6]]),
    sourceFrontendKeys: Object.freeze([]),
    inputSchema: Object.freeze({ type: "object", required: Object.freeze(["id"]) }),
    outputSchema: Object.freeze({ type: "object" }),
    permission: Object.freeze({ modules: Object.freeze(["reporting"]), action: "read" }),
    mutation: Object.freeze({ kind: "read", idempotent: true }),
    executionTargets: Object.freeze(["mysql:platform-authority"]),
    port: "reportingRuntimeDashboard",
  },
]);

module.exports = { SOURCE_API_KEYS, SOURCE_FRONTEND_KEYS, CAPABILITY_DEFINITIONS };
