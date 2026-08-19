const crypto = require("node:crypto");
const { PlatformError } = require("@johnason/data-platform-core-kernel");
const { validateOntologyContract, hash } = require("./contract");

const STAGES = Object.freeze(["preflight", "ingestion", "red", "governance", "ontology", "platform-load", "green"]);

function validateRun(run) {
  if (!run || !Array.isArray(run.checkpoints) || run.checkpoints.map((entry) => entry.stage).join(",") !== STAGES.join(",")) {
    throw new PlatformError("AVIATION_ACCEPTANCE_INCOMPLETE", "Aviation acceptance does not contain seven ordered stages");
  }
  if ((run.bypasses || []).length || run.checkpoints.some((entry) => (entry.bypasses || []).length)) {
    throw new PlatformError("AVIATION_FORBIDDEN_BYPASS", "Forbidden bypass was used during aviation acceptance");
  }
  for (const checkpoint of run.checkpoints) {
    if (checkpoint.projectId !== run.projectId) throw new PlatformError("AVIATION_PROJECT_MISMATCH", "Project ID differs across aviation acceptance");
    if (checkpoint.dependencyAvailable === false) throw new PlatformError("AVIATION_DEPENDENCY_UNAVAILABLE", "A real dependency was unavailable");
    if (checkpoint.governanceComplete === false) throw new PlatformError("AVIATION_GOVERNANCE_PARTIAL", "Governance applied only partially");
  }
  const load = run.checkpoints.find((entry) => entry.stage === "platform-load");
  if (Number(load.metadataCount) <= 0) throw new PlatformError("AVIATION_METADATA_EMPTY", "ODS metadata count is zero");
  if (Number(load.resourceCount) <= 0) throw new PlatformError("AVIATION_RESOURCE_EMPTY", "Data-map resource count is zero");
  if (!load.knowledgeReady) throw new PlatformError("AVIATION_KNOWLEDGE_NOT_READY", "Knowledge-base is not vector-ready");
  if (Number(load.realQueryRows) <= 0) throw new PlatformError("AVIATION_REPORT_EMPTY", "Reporting query returned no real rows");
  if (load.reportingSourceId !== load.expectedReportingSourceId) throw new PlatformError("AVIATION_REPORT_SOURCE_MISMATCH", "Reporting references the wrong data source");
}

function createAviationAcceptance({ executeStage }) {
  if (typeof executeStage !== "function") throw new TypeError("executeStage is required");
  return {
    async run(input) {
      const contract = validateOntologyContract(input.contract);
      if (Number(input.projectId) !== Number(contract.projectId)) {
        throw new PlatformError("AVIATION_PROJECT_MISMATCH", "Contract project differs from CLI project");
      }
      const checkpoints = [];
      for (const stage of STAGES) checkpoints.push(await executeStage(stage, { ...input, contract }));
      const run = {
        id: input.runId || crypto.randomUUID(),
        projectId: input.projectId,
        contractSha256: hash(contract),
        checkpoints,
        bypasses: [],
      };
      validateRun(run);
      return run;
    },
    verify(run) {
      validateRun(run);
      return { verified: true, runId: run.id, contractSha256: run.contractSha256, stages: STAGES.length };
    },
  };
}

module.exports = { createAviationAcceptance, STAGES, validateRun };
