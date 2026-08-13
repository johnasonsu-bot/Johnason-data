const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const packageDir = path.resolve(__dirname, "../../../packages/data-platform-module-data-lab-sources");
const API_KEYS = [
  "GET /api/v1/data-modeling-sources", "GET /api/v1/data-modeling-sources/:id/scenes",
  "GET /api/v1/data-modeling-sources/:id/tables", "GET /api/v1/data-modeling-sources/:id/tables/:tableName/columns",
  "GET /api/v1/data-modeling-sources/:id/tables/:tableName/sample", "POST /api/v1/data-modeling-sources",
  "PUT /api/v1/data-modeling-sources/:id", "DELETE /api/v1/data-modeling-sources/:id",
  "POST /api/v1/data-modeling-sources/test-connection",
];
test("data-lab-sources candidate exposes exact package and nine APIs", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
  assert.equal(pkg.name, "@johnason/data-platform-module-data-lab-sources");
  assert.equal(pkg.version, "0.2.0");
  assert.equal(pkg.private, false);
  assert.deepEqual(pkg.files, ["src", "contracts"]);
  assert.equal(pkg.dependencies["@johnason/data-platform-core-kernel"], "0.1.0");
  const candidate = require(packageDir);
  assert.equal(candidate.moduleManifest.moduleName, "data-lab-sources");
  assert.equal(candidate.moduleManifest.capabilitySchemaVersion, "1.0.0");
  assert.deepEqual(candidate.moduleManifest.sourceApiKeys, API_KEYS);
});
test("data-lab-sources capabilities preserve metadata and four-database targets", () => {
  const candidate = require(packageDir);
  const capabilities = candidate.createCapabilities({});
  assert.equal(capabilities.length, 9);
  assert.deepEqual(capabilities.flatMap((c) => c.sourceApiKeys), API_KEYS);
  for (const c of capabilities) {
    assert.match(c.capabilityId, /^dataLabSources\./);
    assert.ok(c.inputSchema && c.outputSchema && c.permission && c.mutation);
    assert.ok(c.executionTargets.length > 0);
    assert.ok(c.executionTargets.every((target) => ["mysql", "postgresql", "oracle", "dm"].includes(target)));
  }
});
test("data-lab-sources delegates injected service ports and fails closed", async () => {
  const candidate = require(packageDir);
  const calls = [];
  const capabilities = candidate.createCapabilities({ service: {
    listDataModelingSources: async (input) => { calls.push([input]); return [{ id: 4 }]; },
  } });
  assert.deepEqual(await capabilities[0].execute({ id: 4 }, {}), [{ id: 4 }]);
  assert.deepEqual(calls, [[4]]);
  await assert.rejects(() => candidate.createRuntimeAdapters({}).listDataModelingSources({}), /not configured/i);
});
