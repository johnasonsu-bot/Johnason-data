const test = require("node:test");
const assert = require("node:assert/strict");

const PACKAGE_NAME = "@johnason/data-platform-module-data-sources";
const PACKAGE_ROOT = "../../../packages/data-platform-module-data-sources";

const SOURCE_API_KEYS = [
  "GET /api/v1/data-sources",
  "GET /api/v1/data-sources/:id/tasks",
  "GET /api/v1/data-sources/:id/tables",
  "GET /api/v1/data-sources/:id/tables/:tableName/columns",
  "GET /api/v1/data-sources/:id/tables/:tableName/sample",
  "POST /api/v1/data-sources",
  "PUT /api/v1/data-sources/:id",
  "DELETE /api/v1/data-sources/:id",
  "POST /api/v1/data-sources/test-connection",
];

const SOURCE_FRONTEND_KEYS = [
  "frontend/src/pages/data-sources/DataSourcesPage.tsx",
  "frontend/src/pages/data-file-imports/FileImportWorkspacePage.tsx",
  "frontend/src/pages/data-ingestion-jobs/TaskConfigPage.tsx",
];

test("data-sources candidate exposes the exact nine Web API keys", () => {
  const definition = require(PACKAGE_ROOT);

  assert.equal(definition.moduleManifest.moduleId, "data-sources");
  assert.equal(definition.moduleManifest.moduleVersion, "0.2.0");
  assert.equal(definition.moduleManifest.capabilitySchemaVersion, "1.0.0");
  assert.deepEqual(definition.moduleManifest.sourceApiKeys, SOURCE_API_KEYS);
  assert.deepEqual(definition.moduleManifest.sourceFrontendKeys, SOURCE_FRONTEND_KEYS);
  assert.equal(typeof definition.createCapabilities, "function");
  assert.equal(typeof definition.createRuntimeAdapters, "function");
});

test("every data-sources capability has immutable contract metadata", () => {
  const { createCapabilities } = require(PACKAGE_ROOT);
  const capabilities = createCapabilities({});

  assert.equal(capabilities.length, SOURCE_API_KEYS.length);
  assert.deepEqual(capabilities.flatMap((capability) => capability.sourceApiKeys), SOURCE_API_KEYS);
  for (const capability of capabilities) {
    assert.match(capability.capabilityId, /^data-sources\./);
    assert.deepEqual(capability.sourceApiKeys.length, 1);
    assert.ok(capability.sourceFrontendKeys.length > 0);
    assert.equal(typeof capability.execute, "function");
    assert.ok(capability.inputSchema);
    assert.ok(capability.outputSchema);
    assert.ok(capability.permission);
    assert.ok(capability.mutation);
    assert.ok(Array.isArray(capability.executionTargets));
    assert.ok(capability.executionTargets.length > 0);
  }
});

test("dynamic data-source targets only resolve to API or the four supported database engines", () => {
  const { createRuntimeAdapters } = require(PACKAGE_ROOT);
  const adapters = createRuntimeAdapters({});

  assert.deepEqual(adapters.resolveExecutionTargets({ sourceType: "api" }), [
    { kind: "api", provider: "external-api" },
  ]);
  assert.deepEqual(adapters.resolveExecutionTargets({ sourceType: "postgres" }), [
    { kind: "database", engine: "postgresql" },
  ]);
  assert.deepEqual(adapters.resolveExecutionTargets({ sourceType: "dameng" }), [
    { kind: "database", engine: "dm" },
  ]);
  assert.deepEqual(adapters.resolveExecutionTargets({ sourceType: "ftp" }), []);
});

test("platform registry operations do not claim source-engine execution", () => {
  const { createCapabilities } = require(PACKAGE_ROOT);
  const capabilities = createCapabilities({});
  const target = (capabilityId) => capabilities.find((capability) => capability.capabilityId === capabilityId).executionTargets;

  assert.deepEqual(target("data-sources.list"), [{ kind: "database", engine: "mysql", role: "platform-authority" }]);
  assert.deepEqual(target("data-sources.listReferencedTasks"), [{ kind: "database", engine: "mysql", role: "platform-authority" }]);
  assert.deepEqual(target("data-sources.create"), [{ kind: "database", engine: "mysql", role: "platform-authority" }]);
  assert.deepEqual(target("data-sources.delete"), [{ kind: "database", engine: "mysql", role: "platform-authority" }]);
  assert.deepEqual(target("data-sources.listTables"), [
    { kind: "database", engine: "mysql", role: "platform-authority" },
    { kind: "api", provider: "external-api", conditional: true },
    { kind: "database", engine: "mysql", conditional: true },
    { kind: "database", engine: "postgresql", conditional: true },
    { kind: "database", engine: "oracle", conditional: true },
    { kind: "database", engine: "dm", conditional: true },
  ]);
});

test("capability execution delegates through injected runtime ports", async () => {
  const calls = [];
  const { createCapabilities } = require(PACKAGE_ROOT);
  const capabilities = createCapabilities({
    service: {
      listDataSources: async (input) => {
        calls.push(["listDataSources", input]);
        return [{ id: 1 }];
      },
    },
  });

  const result = await capabilities.find((capability) => capability.capabilityId === "data-sources.list").execute(
    { sourceDomain: "integration" },
    { actor: { id: 1 }, projectId: "p1" }
  );

  assert.deepEqual(result, [{ id: 1 }]);
  assert.deepEqual(calls, [["listDataSources", { sourceDomain: "integration" }]]);
});

test("capabilities preserve legacy service argument boundaries", async () => {
  const calls = [];
  const { createCapabilities } = require(PACKAGE_ROOT);
  const capabilities = createCapabilities({
    service: {
      listColumns: async (...args) => {
        calls.push(args);
        return [];
      },
      updateDataSource: async (...args) => {
        calls.push(args);
        return { id: args[0] };
      },
    },
  });
  const context = { projectId: "p1" };

  await capabilities.find((capability) => capability.capabilityId === "data-sources.listColumns")
    .execute({ id: 7, tableName: "orders" }, context);
  await capabilities.find((capability) => capability.capabilityId === "data-sources.update")
    .execute({ id: 7, sourceName: "Orders", sourceCode: "orders", sourceType: "mysql" }, context);

  assert.deepEqual(calls, [
    [7, "orders", context],
    [7, { sourceName: "Orders", sourceCode: "orders", sourceType: "mysql" }, context],
  ]);
});

test("package metadata remains transport neutral and uses the exact kernel version", () => {
  const packageJson = require(`${PACKAGE_ROOT}/package.json`);
  assert.equal(packageJson.name, PACKAGE_NAME);
  assert.equal(packageJson.version, "0.2.0");
  assert.equal(packageJson.dependencies["@johnason/data-platform-core-kernel"], "0.1.0");
  assert.equal(packageJson.dependencies.express, undefined);
  assert.equal(packageJson.dependencies.commander, undefined);
});

test("data-sources module manifest keeps kernel execution targets transport-neutral", () => {
  const { moduleManifest } = require(PACKAGE_ROOT);
  for (const capability of moduleManifest.capabilities) {
    assert.ok(capability.executionTargets.every((target) => typeof target === "string"));
  }
});

test("data-sources module validates its manifest through the shared kernel contract", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "../../../packages/data-platform-module-data-sources/src/index.js"), "utf8");
  assert.match(source, /validateModuleManifest/);
});
