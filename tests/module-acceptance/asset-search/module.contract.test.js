const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const packageDir = path.join(repoRoot, "packages/data-platform-module-asset-search");
const packageJsonPath = path.join(packageDir, "package.json");

const expectedApiKeys = [
  "POST /api/v1/asset-search/search",
  "POST /api/v1/asset-search/business-data/search",
  "GET /api/v1/asset-search/suggest",
  "GET /api/v1/asset-search/facets",
  "GET /api/v1/asset-search/ai-configs",
  "PUT /api/v1/asset-search/ai-configs/:id",
  "GET /api/v1/asset-search/ai-runs",
  "POST /api/v1/asset-search/feedback",
];

const expectedFrontendKeys = [
  "frontend/src/pages/asset-search/AssetSearchPage.tsx",
  "frontend/src/pages/asset-search/BusinessDataSearchPage.tsx",
  "frontend/src/pages/asset-search/AssetSearchModelManagementPage.tsx",
];

test("asset-search acceptance package is an exact 0.2.0 candidate", () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  assert.equal(pkg.name, "@johnason/data-platform-module-asset-search");
  assert.equal(pkg.version, "0.2.0");
  assert.equal(pkg.private, false);
  assert.deepEqual(pkg.files, ["src", "contracts"]);
  assert.equal(pkg.engines.node, ">=22.20.0");
  assert.equal(pkg.dependencies["@johnason/data-platform-core-kernel"], "0.1.0");
  assert.equal(pkg.dependencies.express, undefined);
  assert.equal(pkg.dependencies.commander, undefined);
});

test("asset-search candidate exports transport-neutral module contract", () => {
  const candidate = require(packageDir);
  assert.equal(typeof candidate.createCapabilities, "function");
  assert.equal(typeof candidate.createRuntimeAdapters, "function");
  assert.ok(candidate.moduleManifest);
  assert.equal(candidate.moduleManifest.moduleName, "asset-search");
  assert.equal(candidate.moduleManifest.moduleVersion, "0.2.0");
  assert.equal(candidate.moduleManifest.capabilitySchemaVersion, "1.0.0");
  assert.equal(typeof candidate.createAssetSearchCapabilities, "function");
  assert.deepEqual(candidate.moduleManifest.sourceApiKeys, expectedApiKeys);
  assert.deepEqual(candidate.moduleManifest.sourceFrontendKeys, expectedFrontendKeys);
});

test("asset-search manifest maps each baseline API exactly once", () => {
  const candidate = require(packageDir);
  const capabilities = candidate.createCapabilities({});
  assert.equal(capabilities.length, 8);

  const apiKeys = capabilities.flatMap((capability) => capability.sourceApiKeys || []);
  assert.deepEqual([...new Set(apiKeys)], expectedApiKeys);
  assert.equal(apiKeys.length, expectedApiKeys.length);
  assert.ok(capabilities.every((capability) => capability.sourceFrontendKeys?.length));
  assert.ok(capabilities.every((capability) => capability.schema));
  assert.ok(capabilities.every((capability) => capability.permission));
  assert.ok(capabilities.every((capability) => capability.mutation));
  assert.ok(capabilities.every((capability) => capability.executionTargets?.length));
  assert.ok(capabilities.every((capability) => typeof capability.execute === "function"));
});

test("asset-search Web compatibility files remain available", () => {
  const servicePath = path.join(repoRoot, "backend/src/modules/asset-search/asset-search.service.js");
  const controllerPath = path.join(repoRoot, "backend/src/modules/asset-search/asset-search.controller.js");
  assert.equal(fs.existsSync(servicePath), true);
  assert.equal(fs.existsSync(controllerPath), true);
  assert.match(fs.readFileSync(servicePath, "utf8"), /module\.exports\s*=\s*\{/);
  assert.match(fs.readFileSync(controllerPath, "utf8"), /module\.exports\s*=\s*\{/);
});
