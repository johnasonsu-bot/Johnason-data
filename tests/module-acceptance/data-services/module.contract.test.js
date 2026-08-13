const assert = require("node:assert/strict");
const test = require("node:test");
const candidate = require("../../../packages/data-platform-module-data-services");
test("data-services covers every approved baseline API", () => { assert.equal(candidate.moduleManifest.sourceApiKeys.length, 30); assert.equal(candidate.createCapabilities({}).length, 30); });
test("data-services delegates an injected port and fails closed", async () => { let got; const cs = candidate.createCapabilities({ service: { getOverview: async (input, context) => { got = [input, context]; return { ok: true }; } } }); assert.deepEqual(await cs[0].execute({ projectId: 2 }, { actor: { id: 1 } }), { ok: true }); assert.deepEqual(got, [{ projectId: 2 }, { actor: { id: 1 } }]); await assert.rejects(() => candidate.createRuntimeAdapters({}).getOverview({}), /not configured/i); });
