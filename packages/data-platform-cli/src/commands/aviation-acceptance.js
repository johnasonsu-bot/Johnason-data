const { createAviationAcceptance } = require("@johnason/data-platform-core");

function createAviationAcceptanceCommands(dependencies) {
  const acceptance = createAviationAcceptance({ executeStage: dependencies.executeStage });
  return {
    run(input) { return acceptance.run(input); },
    verify(run) { return acceptance.verify(run); },
  };
}

module.exports = { createAviationAcceptanceCommands };
