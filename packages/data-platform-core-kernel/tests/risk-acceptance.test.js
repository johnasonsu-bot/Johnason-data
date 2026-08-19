const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluateModuleEvidence, RISK_GATES } = require("../src");

function acceptedEvidence(overrides = {}) {
  return {
    module: "auth",
    candidateVersion: "0.2.0",
    rollbackVersion: "0.1.0",
    capabilitySchemaVersion: "1.0.0",
    packageIntegrity: "sha512-test",
    startedAt: "2026-08-13T01:00:00.000Z",
    finishedAt: "2026-08-13T01:01:00.000Z",
    riskGates: Object.fromEntries(RISK_GATES.map((gate) => [gate, "passed"])),
    failures: 0,
    secretFindings: 0,
    databaseEvidence: { oracle: { real: true }, dm: { real: true } },
    ...overrides,
  };
}

test("acceptance is computed only when all strict gates pass", () => {
  assert.deepEqual(evaluateModuleEvidence(acceptedEvidence()), { accepted: true, status: "accepted", failures: [] });
});

test("rejects skipped, unknown gates, mocks, secrets, and version ranges", () => {
  const cases = [
    acceptedEvidence({ riskGates: { ...acceptedEvidence().riskGates, transaction: "skipped" } }),
    acceptedEvidence({ riskGates: { ...acceptedEvidence().riskGates, extra: "passed" } }),
    acceptedEvidence({ databaseEvidence: { oracle: { real: false }, dm: { real: true } } }),
    acceptedEvidence({ secretFindings: 1 }),
    acceptedEvidence({ candidateVersion: "^0.2.0" }),
    acceptedEvidence({ startedAt: "2026-08-13T02:00:00.000Z", finishedAt: "2026-08-13T01:00:00.000Z" }),
  ];
  for (const evidence of cases) assert.equal(evaluateModuleEvidence(evidence).accepted, false);
});

test("explicit accepted input cannot override the calculation", () => {
  const result = evaluateModuleEvidence(acceptedEvidence({ accepted: true, failures: 1 }));
  assert.equal(result.accepted, false);
  assert.equal(result.status, "failed");
});
