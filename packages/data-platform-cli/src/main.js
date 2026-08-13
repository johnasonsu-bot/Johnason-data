const { createProfileDatabaseRuntime } = require("./runtime/database");

function loadCorePackage() {
  return require("@johnason/data-platform-core");
}

function createCliRuntimeDependencies({ profile, keychain, mysqlImpl, runtimePorts = {}, corePackage = loadCorePackage() }) {
  if (!keychain || typeof keychain.getSessionToken !== "function") throw new TypeError("Keychain must expose getSessionToken");
  if (!runtimePorts || typeof runtimePorts !== "object" || Array.isArray(runtimePorts)) throw new TypeError("CLI runtime ports must be an object");
  const databaseRuntime = createProfileDatabaseRuntime(profile, keychain, mysqlImpl || require("mysql2/promise"), corePackage);
  const sessionToken = keychain.getSessionToken(profile.name);
  return Object.freeze({
    ...runtimePorts,
    databaseRuntime,
    session: Object.freeze({ token: sessionToken }),
    profile: Object.freeze({
      name: profile.name,
      ...(profile.dataxHome === undefined ? {} : { dataxHome: profile.dataxHome }),
      ...(profile.kafkaBootstrapServers === undefined ? {} : { kafkaBootstrapServers: Object.freeze([...profile.kafkaBootstrapServers]) }),
      ...(profile.currentProjectId === undefined ? {} : { currentProjectId: profile.currentProjectId }),
    }),
  });
}

function createCliDataPlatformCore(options) {
  const corePackage = options?.corePackage || loadCorePackage();
  return corePackage.createDataPlatformCore(createCliRuntimeDependencies({ ...options, corePackage }));
}

async function main() {
  return 0;
}

module.exports = { createCliDataPlatformCore, createCliRuntimeDependencies, main };
