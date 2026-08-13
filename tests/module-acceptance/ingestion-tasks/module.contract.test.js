const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const packageDir = path.resolve(__dirname, "../../../packages/data-platform-module-ingestion-tasks");
const API_KEYS = [
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
];
const API_OR_DB = ["mysql", "postgresql", "oracle", "dm", "api"];

test("ingestion-tasks exposes the package and exact fourteen API keys", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
  assert.equal(pkg.name, "@johnason/data-platform-module-ingestion-tasks");
  assert.equal(pkg.version, "0.2.0");
  assert.equal(pkg.private, false);
  assert.deepEqual(pkg.files, ["src", "contracts"]);
  assert.equal(pkg.dependencies["@johnason/data-platform-core-kernel"], "0.1.0");
  const candidate = require(packageDir);
  assert.equal(candidate.moduleManifest.moduleName, "ingestion-tasks");
  assert.equal(candidate.moduleManifest.capabilitySchemaVersion, "1.0.0");
  assert.deepEqual(candidate.moduleManifest.sourceApiKeys, API_KEYS);
});

test("ingestion-tasks preserves capability policy and execution targets", () => {
  const candidate = require(packageDir);
  const capabilities = candidate.createCapabilities({});
  assert.equal(capabilities.length, API_KEYS.length);
  assert.deepEqual(capabilities.flatMap((capability) => capability.sourceApiKeys), API_KEYS);
  for (const capability of capabilities) {
    assert.match(capability.capabilityId, /^ingestionTasks\./);
    assert.ok(capability.inputSchema && capability.outputSchema && capability.permission && capability.mutation);
    assert.ok(capability.executionTargets.length > 0);
    assert.ok(capability.executionTargets.every((target) => API_OR_DB.includes(target)));
  }
  assert.ok(capabilities.find((capability) => capability.capabilityId === "ingestionTasks.recommendConfig").executionTargets.includes("api"));
  assert.ok(capabilities.find((capability) => capability.capabilityId === "ingestionTasks.previewSource").executionTargets.includes("oracle"));
  assert.ok(capabilities.find((capability) => capability.capabilityId === "ingestionTasks.run").executionTargets.includes("dm"));
});

test("ingestion-tasks delegates controller-shaped ports and fails closed", async () => {
  const candidate = require(packageDir);
  const calls = [];
  const capabilities = candidate.createCapabilities({ service: {
    listTasks: async (input, context) => { calls.push(["listTasks", input, context]); return [{ id: 9 }]; },
  } });
  assert.deepEqual(await capabilities.find((capability) => capability.capabilityId === "ingestionTasks.list").execute({ projectId: 4 }, { actor: { id: 1 } }), [{ id: 9 }]);
  assert.deepEqual(calls, [["listTasks", { projectId: 4 }, { actor: { id: 1 } }]]);
  await assert.rejects(() => candidate.createRuntimeAdapters({}).listTasks({}), /not configured/i);
});

test("ingestion-tasks normalizes id and runId for legacy service ports", async () => {
  const candidate = require(packageDir);
  const calls = [];
  const capabilities = candidate.createCapabilities({ service: {
    getTask: async (...args) => { calls.push(["getTask", ...args]); return { id: args[0] }; },
    analyzeJobRunFailure: async (...args) => { calls.push(["analyzeJobRunFailure", ...args]); return { ok: true }; },
  } });
  await capabilities.find((capability) => capability.capabilityId === "ingestionTasks.detail").execute({ id: 8 }, { actor: { id: 2 } });
  await capabilities.find((capability) => capability.capabilityId === "ingestionTasks.analyzeFailure").execute({ id: 8, runId: 3, body: { includeLogs: true } }, { actor: { id: 2 } });
  assert.equal(calls[0][0], "getTask");
  assert.deepEqual(calls[0].slice(1), [8, { actor: { id: 2 } }]);
  assert.deepEqual(calls[1].slice(0, 4), ["analyzeJobRunFailure", 8, 3, { includeLogs: true }]);
});
