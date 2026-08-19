const { PlatformError } = require("@johnason/data-platform-core-kernel");
const { validateOntologyContract, hash } = require("./contract");

function escapeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function exportHtml(kind, contractInput) {
  const contract = validateOntologyContract(contractInput);
  const digest = hash(contract);
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${kind} ${contract.contractId}</title></head><body data-artifact-kind="${kind}" data-contract-sha256="${digest}"><main id="artifact"></main><script id="ontology-contract" type="application/json">${escapeJson(contract)}</script><script>document.getElementById("artifact").textContent=${JSON.stringify(kind)}+": "+JSON.parse(document.getElementById("ontology-contract").textContent).contractId;</script></body></html>\n`;
}

function verifyHtml(kind, contractInput, html) {
  const contract = validateOntologyContract(contractInput);
  const digest = hash(contract);
  if (!String(html).includes(`data-artifact-kind="${kind}"`) || !String(html).includes(`data-contract-sha256="${digest}"`)) {
    throw new PlatformError("ONTOLOGY_ARTIFACT_MISMATCH", `${kind} artifact does not match contract`);
  }
  const match = String(html).match(/<script id="ontology-contract" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match || hash(JSON.parse(match[1])) !== digest) throw new PlatformError("ONTOLOGY_ARTIFACT_MISMATCH", `${kind} embedded contract is invalid`);
  return { verified: true, kind, contractSha256: digest };
}

module.exports = { exportHtml, verifyHtml };
