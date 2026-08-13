const assert = require("node:assert/strict");
const test = require("node:test");
const candidate = require("../../../packages/data-platform-module-data-modeling");
test("data-modeling covers every approved baseline API and frontend entry", () => { assert.equal(candidate.moduleManifest.sourceApiKeys.length, 135); assert.equal(candidate.createCapabilities({}).length, 135); assert.ok(candidate.createCapabilities({}).some((c) => c.executionTargets.includes("api"))); });
test("data-modeling delegates an injected port and fails closed", async () => { let got; const cs = candidate.createCapabilities({ service: { listKnowledgeBases: async (input, context) => { got = [input, context]; return { ok: true }; } } }); assert.deepEqual(await cs[0].execute({ projectId: 2 }, { actor: { id: 1 } }), { ok: true }); assert.deepEqual(got, [{ projectId: 2 }, { actor: { id: 1 } }]); await assert.rejects(() => candidate.createRuntimeAdapters({}).listKnowledgeBases({}), /not configured/i); });
