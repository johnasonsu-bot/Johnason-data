const assert = require("node:assert/strict");
const test = require("node:test");
const candidate = require("../../../packages/data-platform-module-reporting-ai-configs");

test("reporting-ai-configs covers both baseline APIs and strict manifest", () => {
  assert.deepEqual(candidate.moduleManifest.sourceApiKeys, ["GET /api/v1/reporting-ai-configs", "PUT /api/v1/reporting-ai-configs/:id"]);
  assert.equal(candidate.createCapabilities({}).length, 2);
  assert.deepEqual(candidate.createCapabilities({})[0].executionTargets, ["mysql"]);
});

test("reporting-ai-configs delegates and fails closed", async () => {
  let input;
  const capabilities = candidate.createCapabilities({ service: {
    listConfigs: async (value, context) => { input = [value, context]; return []; },
  } });
  assert.deepEqual(await capabilities[0].execute({ projectId: 1 }, { actor: { id: 2 } }), []);
  assert.deepEqual(input, [{ projectId: 1 }, { actor: { id: 2 } }]);
  await assert.rejects(() => candidate.createRuntimeAdapters({}).listConfigs({}), /not configured/i);
});
