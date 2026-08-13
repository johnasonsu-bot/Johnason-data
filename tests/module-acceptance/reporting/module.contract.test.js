const assert = require("node:assert/strict");
const test = require("node:test");
const candidate = require("../../../packages/data-platform-module-reporting");
test("reporting covers every approved baseline API", () => { assert.equal(candidate.moduleManifest.sourceApiKeys.length, 41); assert.equal(candidate.createCapabilities({}).length, 41); });
test("reporting delegates an injected port and fails closed", async () => { let got; const cs = candidate.createCapabilities({ service: { listRuntimeReportThemeTemplates: async (input, context) => { got = [input, context]; return { ok: true }; } } }); assert.deepEqual(await cs[0].execute({ projectId: 2 }, { actor: { id: 1 } }), { ok: true }); assert.deepEqual(got, [{ projectId: 2 }, { actor: { id: 1 } }]); await assert.rejects(() => candidate.createRuntimeAdapters({}).listRuntimeReportThemeTemplates({}), /not configured/i); });
