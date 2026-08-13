const assert = require("node:assert/strict");
const test = require("node:test");
const candidate = require("../../../packages/data-platform-module-data-development");
test("data-development covers every approved baseline API", () => { assert.equal(candidate.moduleManifest.sourceApiKeys.length, 82); assert.equal(candidate.createCapabilities({}).length, 82); });
test("data-development delegates an injected port and fails closed", async () => { let got; const cs = candidate.createCapabilities({ service: { testDatasourceConfig: async (input, context) => { got = [input, context]; return { ok: true }; } } }); assert.deepEqual(await cs[0].execute({ projectId: 2 }, { actor: { id: 1 } }), { ok: true }); assert.deepEqual(got, [{ projectId: 2 }, { actor: { id: 1 } }]); await assert.rejects(() => candidate.createRuntimeAdapters({}).testDatasourceConfig({}), /not configured/i); });
