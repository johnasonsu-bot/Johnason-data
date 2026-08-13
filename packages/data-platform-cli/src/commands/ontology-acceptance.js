const fs = require("node:fs");

const localTarget = Object.freeze([{ kind: "local" }]);
const databaseTarget = Object.freeze([{ kind: "database", engine: "mysql", role: "platform-authority" }]);
const inputSchema = Object.freeze({
  parse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Native CLI input must be an object");
    return value;
  },
});
const outputSchema = Object.freeze({ parse(value) { return value; } });

function portError(name) {
  const error = new Error(`Native CLI capability port is not configured: ${name}`);
  error.code = "CAPABILITY_PORT_NOT_CONFIGURED";
  error.statusCode = 503;
  error.exitCode = 7;
  return error;
}

function invokePort(dependencies, name, input) {
  const ports = dependencies.ontologyPorts || dependencies.acceptancePorts || {};
  if (typeof ports[name] !== "function") throw portError(name);
  return ports[name](input);
}

function uniqueIds(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
  const ids = values.map((value) => value?.id);
  if (ids.some((id) => typeof id !== "string" || id.trim().length === 0) || new Set(ids).size !== ids.length) {
    throw new TypeError(`${label} ids must be unique non-empty strings`);
  }
  return ids;
}

function validateContract(contract) {
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) throw new TypeError("Ontology contract must be an object");
  if (typeof contract.version !== "string" || contract.version.trim().length === 0) throw new TypeError("Ontology contract version is required");
  const entityIds = new Set(uniqueIds(contract.entities, "Ontology entity"));
  const relationIds = uniqueIds(contract.relations, "Ontology relation");
  const ruleIds = uniqueIds(contract.rules, "Ontology rule");
  for (const relation of contract.relations) {
    if (!entityIds.has(relation.subject) || !entityIds.has(relation.object)) {
      throw new TypeError(`dangling relation endpoint: ${relation.id}`);
    }
    for (const key of ["sourceTable", "sourceField", "targetTable", "targetField", "keyRole", "joinCondition"]) {
      if (typeof relation[key] !== "string" || relation[key].trim().length === 0) throw new TypeError(`relation ${relation.id} is missing ${key}`);
    }
  }
  return Object.freeze({ valid: true, version: contract.version, entities: entityIds.size, relations: relationIds.length, rules: ruleIds.length });
}

function validateLineage(lineage) {
  if (!lineage || typeof lineage !== "object" || Array.isArray(lineage)) throw new TypeError("Lineage contract must be an object");
  const edges = lineage.edges;
  if (!Array.isArray(edges)) throw new TypeError("Lineage edges must be an array");
  for (const edge of edges) {
    for (const key of ["subject", "object", "sourceTable", "sourceField", "targetTable", "targetField", "keyRole", "joinCondition"]) {
      if (typeof edge[key] !== "string" || edge[key].trim().length === 0) throw new TypeError(`lineage edge is missing ${key}`);
    }
  }
  return Object.freeze({ valid: true, version: lineage.version || null, edges: edges.length });
}

async function jsonInputHandler(input, validator) {
  return validator(input.contract || input);
}

function definition(command, capabilityId, handler, { action = "read", inputMode = "json", executionTargets = localTarget } = {}) {
  return Object.freeze({
    command,
    capabilityId,
    modules: Object.freeze(["ontology-acceptance"]),
    action,
    sourceApiKeys: Object.freeze([]),
    sourceFrontendKeys: Object.freeze([]),
    executionTargets,
    inputSchema,
    outputSchema,
    inputMode,
    handler,
  });
}

function createOntologyAcceptanceCommands(dependencies = {}) {
  const port = (name) => async (input) => invokePort(dependencies, name, input);
  const commands = [
    definition("ontology contract validate", "ontology.contract.validate", (input) => jsonInputHandler(input, validateContract)),
    definition("ontology contract import", "ontology.contract.import", port("contractImport"), { action: "write", executionTargets: databaseTarget }),
    definition("ontology contract show", "ontology.contract.show", port("contractShow"), { executionTargets: databaseTarget }),
    definition("ontology contract diff", "ontology.contract.diff", port("contractDiff"), { executionTargets: databaseTarget }),
    definition("ontology lineage validate", "ontology.lineage.validate", (input) => jsonInputHandler(input, validateLineage)),
    definition("ontology lineage import", "ontology.lineage.import", port("lineageImport"), { action: "write", executionTargets: databaseTarget }),
    definition("ontology lineage show", "ontology.lineage.show", port("lineageShow"), { executionTargets: databaseTarget }),
    definition("ontology graph export", "ontology.graph.export", port("graphExport"), { action: "write" }),
    definition("ontology graph verify", "ontology.graph.verify", port("graphVerify")),
    definition("ontology simulation export", "ontology.simulation.export", port("simulationExport"), { action: "write" }),
    definition("ontology simulation verify", "ontology.simulation.verify", port("simulationVerify")),
    definition("acceptance aviation-ontology preflight", "acceptance.aviation-ontology.preflight", port("preflight")),
    definition("acceptance aviation-ontology run", "acceptance.aviation-ontology.run", port("run"), { action: "write", executionTargets: databaseTarget }),
    definition("acceptance aviation-ontology verify", "acceptance.aviation-ontology.verify", port("verify"), { executionTargets: databaseTarget }),
    definition("acceptance aviation-ontology report", "acceptance.aviation-ontology.report", port("report"), { executionTargets: databaseTarget }),
    definition("standard field-mapping apply", "standard.field-mapping.apply", port("fieldMappingApply"), { action: "write", executionTargets: databaseTarget }),
    definition("knowledge-base wait", "knowledge-base.wait", port("knowledgeWait"), { executionTargets: databaseTarget }),
    definition("knowledge-base search", "knowledge-base.search", port("knowledgeSearch"), { executionTargets: databaseTarget }),
    definition("reconcile project", "reconcile.project", port("reconcileProject"), { executionTargets: databaseTarget }),
    definition("project asset import preview", "project.asset-import-preview", port("assetImportPreview"), { executionTargets: databaseTarget }),
    definition("audit show", "audit.show", port("auditShow"), { executionTargets: databaseTarget }),
  ];
  return Object.freeze(commands);
}

module.exports = { createOntologyAcceptanceCommands, validateContract, validateLineage };
