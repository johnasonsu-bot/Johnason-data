const fs = require("node:fs");
const path = require("node:path");
const {
  validateOntologyContract,
  validateLineage,
  exportOntologyGraph,
  verifyOntologyGraph,
  exportOntologySimulation,
  verifyOntologySimulation,
} = require("@johnason/data-platform-core");
const { readInputFile, assertOutputPath } = require("./file-io");

function createOntologyCommands() {
  return {
    validateContract(file) { return validateOntologyContract(readInputFile(file)); },
    validateLineage(file, contractFile) { return validateLineage(readInputFile(file), readInputFile(contractFile)); },
    exportGraph(contractFile, output) {
      const target = assertOutputPath(output);
      fs.writeFileSync(target, exportOntologyGraph(readInputFile(contractFile)));
      return { output: target, bytes: fs.statSync(target).size };
    },
    verifyGraph(contractFile, htmlFile) {
      return verifyOntologyGraph(readInputFile(contractFile), fs.readFileSync(path.resolve(htmlFile), "utf8"));
    },
    exportSimulation(contractFile, output) {
      const target = assertOutputPath(output);
      fs.writeFileSync(target, exportOntologySimulation(readInputFile(contractFile)));
      return { output: target, bytes: fs.statSync(target).size };
    },
    verifySimulation(contractFile, htmlFile) {
      return verifyOntologySimulation(readInputFile(contractFile), fs.readFileSync(path.resolve(htmlFile), "utf8"));
    },
  };
}

module.exports = { createOntologyCommands };
