const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createOntologyCommands } = require("../src/commands/ontology");
const { createAviationAcceptanceCommands } = require("../src/commands/aviation-acceptance");
const { main } = require("../src/main");

function contract() {
  return { schemaVersion: "1.0.0", contractId: "aviation", projectId: 9, entities: [{ id: "flight", attributes: [] }], relations: [], rules: [] };
}

test("ontology CLI writes and verifies graph and simulation files", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ontology-cli-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const contractFile = path.join(root, "contract.json");
  fs.writeFileSync(contractFile, JSON.stringify(contract()));
  const commands = createOntologyCommands();
  const graph = path.join(root, "graph.html");
  const simulation = path.join(root, "simulation.html");
  assert.ok(commands.exportGraph(contractFile, graph).bytes > 0);
  assert.ok(commands.exportSimulation(contractFile, simulation).bytes > 0);
  assert.equal(commands.verifyGraph(contractFile, graph).verified, true);
  assert.equal(commands.verifySimulation(contractFile, simulation).verified, true);
});

test("aviation CLI executes only injected registered stages", async () => {
  const called = [];
  const commands = createAviationAcceptanceCommands({
    executeStage: async (stage) => {
      called.push(stage);
      return { stage, projectId: 9, metadataCount: 1, resourceCount: 1, knowledgeReady: true, realQueryRows: 1, reportingSourceId: 3, expectedReportingSourceId: 3, governanceComplete: true, dependencyAvailable: true, bypasses: [], capabilityIds: [`cap.${stage}`] };
    },
  });
  const run = await commands.run({ projectId: 9, contract: contract() });
  assert.equal(commands.verify(run).verified, true);
  assert.equal(called.length, 7);
});

test("aviation facade rejects stage files that merely claim successful checkpoints", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aviation-facade-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const contractFile = path.join(root, "contract.json");
  const evidenceFile = path.join(root, "evidence.json");
  fs.writeFileSync(contractFile, JSON.stringify(contract()));
  fs.writeFileSync(evidenceFile, JSON.stringify({
    id: "fake-run",
    real: false,
    mock: true,
    bypassCount: 0,
    secretFindings: 0,
    environmentFingerprint: { environment: "test" },
    checkpoints: [],
  }));
  let stdout = "";
  const code = await main([
    "--json", "acceptance", "aviation-ontology", "run",
    "--contract", contractFile, "--project", "9", "--stage-evidence", evidenceFile,
  ], {
    runtime: { catalog: new Map(), executeCapability() {} },
    stdout: { write(chunk) { stdout += chunk; } },
    stderr: { write() {} },
  });
  assert.equal(code, 2);
  assert.equal(JSON.parse(stdout).error.code, "AVIATION_REAL_EVIDENCE_REQUIRED");
});
