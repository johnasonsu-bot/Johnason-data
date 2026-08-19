const { exportHtml, verifyHtml } = require("./html");

function exportOntologyGraph(contract) { return exportHtml("ontology-graph", contract); }
function verifyOntologyGraph(contract, html) { return verifyHtml("ontology-graph", contract, html); }

module.exports = { exportOntologyGraph, verifyOntologyGraph };
