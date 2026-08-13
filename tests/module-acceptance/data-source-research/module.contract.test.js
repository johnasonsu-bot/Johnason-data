const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const packageDir = path.join(repoRoot, "packages/data-platform-module-data-source-research");

const SOURCE_API_KEYS = [
  "GET /api/v1/data-source-research/tasks",
  "POST /api/v1/data-source-research/tasks",
  "GET /api/v1/data-source-research/tasks/:taskId",
  "PUT /api/v1/data-source-research/tasks/:taskId",
  "DELETE /api/v1/data-source-research/tasks/:taskId",
  "GET /api/v1/data-source-research/tasks/:taskId/runs",
  "POST /api/v1/data-source-research/tasks/:taskId/runs",
  "GET /api/v1/data-source-research/tasks/:taskId/comparisons",
  "POST /api/v1/data-source-research/tasks/:taskId/compare",
  "GET /api/v1/data-source-research/comparisons/:comparisonId",
  "POST /api/v1/data-source-research/source/:sourceId/runs",
  "GET /api/v1/data-source-research/source/:sourceId/runs",
  "GET /api/v1/data-source-research/runs/:runId",
  "GET /api/v1/data-source-research/runs/:runId/logs",
  "GET /api/v1/data-source-research/runs/:runId/report",
  "GET /api/v1/data-source-research/runs/:runId/report.docx",
  "POST /api/v1/data-source-research/runs/:runId/terminate",
  "DELETE /api/v1/data-source-research/runs/:runId",
];

const SOURCE_FRONTEND_KEYS = [
  "frontend/src/pages/data-source-research/DataSourceResearchPage.tsx",
  "frontend/src/pages/data-source-research/DataSourceResearchDetailPage.tsx",
  "frontend/src/pages/data-sources/components/DataSourceResearchModal.tsx",
];

const ALLOWED_TARGETS = new Set(["mysql", "postgresql", "api"]);
const FORBIDDEN_TARGETS = new Set(["hive", "ftp", "kafka", "oracle", "dm"]);

test("data-source-research candidate exposes exact 0.2.0 package metadata", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
  assert.equal(pkg.name, "@johnason/data-platform-module-data-source-research");
  assert.equal(pkg.version, "0.2.0");
  assert.equal(pkg.private, false);
  assert.deepEqual(pkg.files, ["src", "contracts"]);
  assert.equal(pkg.engines.node, ">=22.20.0");
  assert.equal(pkg.dependencies["@johnason/data-platform-core-kernel"], "0.1.0");
  assert.equal(pkg.dependencies.express, undefined);
  assert.equal(pkg.dependencies.commander, undefined);
});

test("data-source-research manifest maps exact 18 Web API keys and frontend entries", () => {
  const definition = require(packageDir);
  assert.equal(definition.moduleManifest.moduleId, "data-source-research");
  assert.equal(definition.moduleManifest.moduleName, "data-source-research");
  assert.equal(definition.moduleManifest.moduleVersion, "0.2.0");
  assert.equal(definition.moduleManifest.capabilitySchemaVersion, "1.0.0");
  assert.deepEqual(definition.moduleManifest.sourceApiKeys, SOURCE_API_KEYS);
  assert.deepEqual(definition.moduleManifest.sourceFrontendKeys, SOURCE_FRONTEND_KEYS);
  assert.deepEqual(definition.moduleManifest.dependencies, { "@johnason/data-platform-core-kernel": "0.1.0" });
  assert.equal(typeof definition.createCapabilities, "function");
  assert.equal(typeof definition.createRuntimeAdapters, "function");
});

test("every data-source-research capability has policy, schema and safe execution metadata", () => {
  const { createCapabilities, moduleManifest } = require(packageDir);
  const capabilities = createCapabilities({});
  assert.equal(capabilities.length, SOURCE_API_KEYS.length);
  assert.deepEqual(capabilities.flatMap((capability) => capability.sourceApiKeys), SOURCE_API_KEYS);
  assert.deepEqual(moduleManifest.capabilities.map(({ capabilityId }) => capabilityId), capabilities.map(({ capabilityId }) => capabilityId));
  for (const capability of capabilities) {
    assert.match(capability.capabilityId, /^dataSourceResearch\./);
    assert.equal(typeof capability.execute, "function");
    assert.ok(capability.inputSchema);
    assert.ok(capability.outputSchema);
    assert.ok(capability.permission);
    assert.ok(capability.mutation);
    assert.ok(Array.isArray(capability.executionTargets));
    assert.ok(capability.executionTargets.length > 0);
    assert.ok(capability.executionTargets.every((target) => ALLOWED_TARGETS.has(target)), capability.capabilityId);
    assert.ok(capability.executionTargets.every((target) => !FORBIDDEN_TARGETS.has(target)), capability.capabilityId);
  }
});

test("runtime adapters fail closed and capability calls preserve service argument boundaries", async () => {
  const { createCapabilities, createRuntimeAdapters } = require(packageDir);
  const adapters = createRuntimeAdapters({});
  await assert.rejects(() => adapters.listResearchTasks({}), /not configured|CAPABILITY_PORT_NOT_CONFIGURED/);
  const calls = [];
  const context = { actor: { id: 7 }, projectId: 42 };
  const capabilities = createCapabilities({ service: {
    getResearchTask: async (...args) => { calls.push(args); return { id: args[0] }; },
    createResearchRun: async (...args) => { calls.push(args); return { sourceId: args[0] }; },
  } });
  const task = capabilities.find((capability) => capability.capabilityId === "dataSourceResearch.getResearchTask");
  const run = capabilities.find((capability) => capability.capabilityId === "dataSourceResearch.createResearchRun");
  assert.deepEqual(await task.execute({ taskId: 11 }, context), { id: 11 });
  assert.deepEqual(await run.execute({ sourceId: 13, notes: "check" }, context), { sourceId: 13 });
  assert.deepEqual(calls, [[11], [13, { notes: "check" }, context]]);
});

test("legacy Web data-source-research files remain available", () => {
  for (const relativePath of [
    "backend/src/modules/data-source-research/data-source-research.routes.js",
    "backend/src/modules/data-source-research/data-source-research.controller.js",
    "backend/src/modules/data-source-research/data-source-research.service.js",
    "backend/src/modules/data-source-research/data-source-research.repository.js",
  ]) assert.equal(fs.existsSync(path.join(repoRoot, relativePath)), true, relativePath);
});
