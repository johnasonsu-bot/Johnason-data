const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateOntologyContract,
  validateLineage,
  exportOntologyGraph,
  verifyOntologyGraph,
  exportOntologySimulation,
  verifyOntologySimulation,
  createAviationAcceptance,
} = require("../src/ontology");

function contract() {
  return {
    schemaVersion: "1.0.0",
    contractId: "aviation",
    projectId: 7,
    entities: [{ id: "flight", attributes: [{ id: "flight.id" }] }, { id: "airport", attributes: [{ id: "airport.code" }] }],
    relations: [{ id: "arrival", subject: "flight", object: "airport" }],
    rules: [{ id: "delay", expression: "flight.delayMinutes > 15", references: ["flight"] }],
  };
}

test("ontology contract, lineage, graph, and simulation are deterministic", () => {
  const value = validateOntologyContract(contract());
  const lineage = validateLineage({ schemaVersion: "1.0.0", contractId: "aviation", links: [{ source: "flight.id", target: "airport.code" }] }, value);
  assert.equal(lineage.links.length, 1);
  const graph = exportOntologyGraph(value);
  const simulation = exportOntologySimulation(value);
  assert.equal(verifyOntologyGraph(value, graph).verified, true);
  assert.equal(verifyOntologySimulation(value, simulation).verified, true);
  assert.equal(exportOntologyGraph(value), graph);
  assert.equal(exportOntologySimulation(value), simulation);
});

test("rejects dangling endpoints, lineage, and rule references", () => {
  assert.throws(() => validateOntologyContract({ ...contract(), relations: [{ id: "bad", subject: "flight", object: "missing" }] }), /dangling relation endpoint/i);
  assert.throws(() => validateOntologyContract({ ...contract(), rules: [{ id: "bad", references: ["missing"] }] }), /dangling rule reference/i);
  assert.throws(() => validateLineage({ schemaVersion: "1.0.0", contractId: "aviation", links: [{ source: "missing", target: "flight.id" }] }, contract()), /dangling lineage reference/i);
});

test("aviation acceptance records seven stages and rejects false success", async () => {
  const stages = ["preflight", "ingestion", "red", "governance", "ontology", "platform-load", "green"];
  const acceptance = createAviationAcceptance({
    executeStage: async (stage) => ({
      stage,
      projectId: 7,
      metadataCount: 1,
      resourceCount: 1,
      knowledgeReady: true,
      realQueryRows: 1,
      reportingSourceId: 10,
      expectedReportingSourceId: 10,
      governanceComplete: true,
      dependencyAvailable: true,
      bypasses: [],
      capabilityIds: [`aviation.${stage}`],
    }),
  });
  const result = await acceptance.run({ contract: contract(), projectId: 7 });
  assert.deepEqual(result.checkpoints.map((entry) => entry.stage), stages);
  assert.equal(acceptance.verify(result).verified, true);

  const bad = { ...result, checkpoints: result.checkpoints.map((entry) => entry.stage === "platform-load" ? { ...entry, metadataCount: 0 } : entry) };
  assert.throws(() => acceptance.verify(bad), /metadata count is zero/i);
  assert.throws(() => acceptance.verify({ ...result, bypasses: ["curl"] }), /forbidden bypass/i);
});
