const crypto = require("node:crypto");
const { PlatformError } = require("@johnason/data-platform-core-kernel");

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function fail(code, message) {
  throw new PlatformError(code, message);
}

function validateOntologyContract(input) {
  if (!input || typeof input !== "object") fail("ONTOLOGY_CONTRACT_INVALID", "Ontology contract must be an object");
  if (!/^\d+\.\d+\.\d+$/.test(String(input.schemaVersion || ""))) fail("ONTOLOGY_CONTRACT_INVALID", "Ontology schemaVersion must be exact");
  if (!input.contractId) fail("ONTOLOGY_CONTRACT_INVALID", "Ontology contractId is required");
  if (!Array.isArray(input.entities) || !input.entities.length) fail("ONTOLOGY_CONTRACT_INVALID", "Ontology entities are required");
  const entityIds = new Set();
  const referenceIds = new Set();
  for (const entity of input.entities) {
    if (!entity.id || entityIds.has(entity.id)) fail("ONTOLOGY_CONTRACT_INVALID", `Duplicate entity: ${entity.id}`);
    entityIds.add(entity.id);
    referenceIds.add(entity.id);
    for (const attribute of entity.attributes || []) {
      if (!attribute.id || referenceIds.has(attribute.id)) fail("ONTOLOGY_CONTRACT_INVALID", `Duplicate reference: ${attribute.id}`);
      referenceIds.add(attribute.id);
    }
  }
  const relationIds = new Set();
  for (const relation of input.relations || []) {
    if (!relation.id || relationIds.has(relation.id)) fail("ONTOLOGY_CONTRACT_INVALID", `Duplicate relation: ${relation.id}`);
    relationIds.add(relation.id);
    if (!entityIds.has(relation.subject) || !entityIds.has(relation.object)) {
      fail("ONTOLOGY_DANGLING_ENDPOINT", `Dangling relation endpoint: ${relation.id}`);
    }
  }
  for (const rule of input.rules || []) {
    for (const reference of rule.references || []) {
      if (!referenceIds.has(reference)) fail("ONTOLOGY_DANGLING_RULE", `Dangling rule reference: ${reference}`);
    }
  }
  return Object.freeze(stable({
    ...input,
    entities: input.entities,
    relations: input.relations || [],
    rules: input.rules || [],
  }));
}

module.exports = { validateOntologyContract, stable, hash };
