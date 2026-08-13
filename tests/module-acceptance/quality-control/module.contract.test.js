const assert = require("node:assert/strict");
const test = require("node:test");
const candidate = require("../../../packages/data-platform-module-quality-control");
test("quality-control covers every approved baseline API", () => { assert.equal(candidate.moduleManifest.sourceApiKeys.length, 87); assert.equal(candidate.createCapabilities({}).length, 87); });
test("quality-control delegates an injected port and fails closed", async () => { let got; const cs = candidate.createCapabilities({ service: { listQualitySources: async (input, context) => { got = [input, context]; return { ok: true }; } } }); assert.deepEqual(await cs[0].execute({ projectId: 2 }, { actor: { id: 1 } }), { ok: true }); assert.deepEqual(got, [{ projectId: 2 }, { actor: { id: 1 } }]); await assert.rejects(() => candidate.createRuntimeAdapters({}).listQualitySources({}), /not configured/i); });
