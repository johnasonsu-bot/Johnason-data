const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const packageDir = path.join(repoRoot, "packages/data-platform-module-platform");
const expectedApiKeys = [
  "GET /api/v1/platform/overview",
  "GET /api/health",
  "GET /api/v1/platform/database-capabilities",
  "GET /api/v1/jobs/:id",
  "POST /api/auth/login",
  "GET /api/auth/profile",
  "GET /api/v1/reporting/runtime/dashboards/:id",
];

test("platform candidate package declares the exact seven baseline source API keys", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
  assert.equal(pkg.name, "@johnason/data-platform-module-platform");
  assert.equal(pkg.version, "0.2.0");
  assert.equal(pkg.private, false);
  assert.deepEqual(pkg.files, ["src", "contracts"]);
  assert.equal(pkg.engines.node, ">=22.20.0");
  assert.equal(pkg.dependencies["@johnason/data-platform-core-kernel"], "0.1.0");
  const candidate = require(packageDir);
  assert.equal(candidate.moduleManifest.moduleName, "platform");
  assert.equal(candidate.moduleManifest.moduleVersion, "0.2.0");
  assert.equal(candidate.moduleManifest.capabilitySchemaVersion, "1.0.0");
  assert.deepEqual(candidate.moduleManifest.capabilities.flatMap((capability) => capability.sourceApiKeys), expectedApiKeys);
});

test("platform capabilities declare schema, permission, mutation and execution target metadata", () => {
  const candidate = require(packageDir);
  const capabilities = candidate.createCapabilities({});
  assert.equal(capabilities.length, expectedApiKeys.length);
  assert.deepEqual(capabilities.flatMap((capability) => capability.sourceApiKeys), expectedApiKeys);
  for (const capability of capabilities) {
    assert.ok(capability.capabilityId.startsWith("platform."));
    assert.ok(Array.isArray(capability.sourceFrontendKeys));
    assert.ok(capability.inputSchema);
    assert.ok(capability.outputSchema);
    assert.ok(capability.permission);
    assert.ok(capability.mutation);
    assert.ok(capability.executionTargets.length > 0);
    if (capability.capabilityId === "platform.overview") {
      assert.deepEqual(capability.executionTargets, [{ kind: "database", engine: "mysql", role: "platform-authority" }]);
    }
    assert.equal(typeof capability.execute, "function");
  }
});

test("platform runtime adapters expose Web and CLI compatibility ports", () => {
  const { createRuntimeAdapters } = require(packageDir);
  const databaseRuntime = { pool: { query: async () => [[]] }, testConnection: async () => {}, close: async () => {} };
  const adapters = createRuntimeAdapters({ databaseRuntime });
  assert.equal(adapters.databaseRuntime, databaseRuntime);
  for (const key of ["health", "databaseCapabilities", "jobShow", "authLogin", "authProfile", "reportingRuntimeDashboard"]) {
    assert.equal(typeof adapters[key], "function");
  }
});

test("platform module manifest keeps kernel execution targets transport-neutral", () => {
  const { moduleManifest } = require(packageDir);
  for (const capability of moduleManifest.capabilities) {
    assert.ok(capability.executionTargets.every((target) => typeof target === "string"));
  }
});
