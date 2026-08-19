const test = require("node:test");
const assert = require("node:assert/strict");

const {
  baseline,
  engines,
  databaseCapabilityIds,
  readEvidence,
  validateDatabaseEvidence,
} = require("./gate-harness");

test("database gate enumerates every engine-classified capability", () => {
  for (const engine of engines) {
    assert.equal(databaseCapabilityIds(engine).length, baseline.gates.databaseClassified[engine], engine);
  }
});

test("database gate requires complete real non-mock evidence", () => {
  const requested = process.env.CLI_DATABASE_GATE === "1";
  const selected = process.env.CLI_DATABASE_ENGINE;
  if (requested) assert.ok(engines.includes(selected), "CLI_DATABASE_ENGINE must select mysql, postgresql, oracle, or dm");
  for (const engine of selected ? [selected] : engines) {
    const evidenceFile = process.env[`CLI_DATABASE_GATE_EVIDENCE_${engine.toUpperCase()}`]
      || process.env.CLI_DATABASE_GATE_EVIDENCE;
    const result = validateDatabaseEvidence(engine, readEvidence(evidenceFile));
    if (requested) assert.equal(result.status, "accepted", `${engine}: ${result.failures.join("\n")}`);
    else assert.equal(result.status, evidenceFile ? "accepted" : "blocked", `${engine}: ${result.failures.join("\n")}`);
  }
});
