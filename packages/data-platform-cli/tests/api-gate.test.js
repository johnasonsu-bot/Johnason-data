const test = require("node:test");
const assert = require("node:assert/strict");

const { baseline, apiCapabilityIds, readEvidence, validateApiEvidence } = require("./gate-harness");

test("API gate enumerates every classified capability", () => {
  assert.equal(apiCapabilityIds().length, baseline.gates.apiClassified);
});

test("API gate requires complete real non-mock evidence", () => {
  const requested = process.env.CLI_API_GATE === "1";
  const result = validateApiEvidence(readEvidence(process.env.CLI_API_GATE_EVIDENCE));
  if (requested) assert.equal(result.status, "accepted", result.failures.join("\n"));
  else assert.equal(result.status, process.env.CLI_API_GATE_EVIDENCE ? "accepted" : "blocked", result.failures.join("\n"));
});
