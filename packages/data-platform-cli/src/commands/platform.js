function createPlatformCommands(dependencies) {
  function databaseCapabilities() {
    if (typeof dependencies.databaseCapabilities !== "function") return {};
    return dependencies.databaseCapabilities();
  }
  return Object.freeze({
    databaseCapabilities,
    async overview(input = {}) {
      if (typeof dependencies.platformOverview === "function") return dependencies.platformOverview(input);
      return { databaseCapabilities: await databaseCapabilities() };
    },
  });
}

module.exports = { createPlatformCommands };
