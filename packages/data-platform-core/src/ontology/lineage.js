const { PlatformError } = require("@johnason/data-platform-core-kernel");
const { validateOntologyContract, stable } = require("./contract");

function validateLineage(input, contractInput) {
  const contract = validateOntologyContract(contractInput);
  if (!input || input.contractId !== contract.contractId || !Array.isArray(input.links)) {
    throw new PlatformError("ONTOLOGY_LINEAGE_INVALID", "Lineage contract does not match ontology contract");
  }
  const references = new Set(contract.entities.flatMap((entity) => [entity.id, ...(entity.attributes || []).map((attribute) => attribute.id)]));
  for (const link of input.links) {
    if (!references.has(link.source) || !references.has(link.target)) {
      throw new PlatformError("ONTOLOGY_DANGLING_LINEAGE", `Dangling lineage reference: ${link.source} -> ${link.target}`);
    }
  }
  return Object.freeze(stable(input));
}

module.exports = { validateLineage };
