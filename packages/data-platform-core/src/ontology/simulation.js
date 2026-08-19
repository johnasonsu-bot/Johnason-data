const { exportHtml, verifyHtml } = require("./html");

function exportOntologySimulation(contract) { return exportHtml("ontology-simulation", contract); }
function verifyOntologySimulation(contract, html) { return verifyHtml("ontology-simulation", contract, html); }

module.exports = { exportOntologySimulation, verifyOntologySimulation };
