const { getDatabaseRuntime: kernelGetDatabaseRuntime, validateModuleManifest } = require("@johnason/data-platform-core-kernel");
const { createAuthRepository } = require("./auth.repository");
const { createAuthSessionRepository } = require("./auth-session.repository");
const { createAuthService } = require("./auth.service");
const { createSessionPolicy } = require("./session-policy");

const moduleManifest = validateModuleManifest({
  moduleName: "auth",
  moduleVersion: "0.2.0",
  capabilitySchemaVersion: "1.0.0",
  capabilities: [
    { capabilityId: "auth.login", sourceApiKeys: ["POST /api/v1/auth/login"], sourceFrontendKeys: ["/login"], executionTargets: ["web", "cli"] },
    { capabilityId: "auth.profile", sourceApiKeys: ["GET /api/v1/auth/profile"], sourceFrontendKeys: ["/profile"], executionTargets: ["web", "cli"] },
    { capabilityId: "auth.logout", sourceApiKeys: ["POST /api/v1/auth/logout"], sourceFrontendKeys: ["/logout"], executionTargets: ["web", "cli"] },
    { capabilityId: "auth.logout-beacon", sourceApiKeys: ["POST /api/v1/auth/logout-beacon"], sourceFrontendKeys: ["/logout"], executionTargets: ["web", "cli"] },
  ],
});

function createRuntimeAdapters(dependencies) {
  if (!dependencies?.databaseRuntime) throw new TypeError("Auth capabilities require databaseRuntime");
  const getDatabaseRuntime = () => dependencies.databaseRuntime || kernelGetDatabaseRuntime();
  const authRepository = dependencies.authRepository || createAuthRepository({ getDatabaseRuntime });
  const sessionRepository = dependencies.sessionRepository || createAuthSessionRepository({ getDatabaseRuntime });
  const sessionPolicy = dependencies.sessionPolicy || createSessionPolicy(dependencies);
  const service = createAuthService({ ...dependencies, authRepository, sessionRepository, sessionPolicy });
  return Object.freeze({ authRepository, sessionRepository, service });
}

function createAuthCapabilities(dependencies) {
  const { service } = createRuntimeAdapters(dependencies);
  return Object.freeze({ auth: Object.freeze({ login: service.login, profile: service.profile, logout: service.logout, logoutBeacon: service.logout }) });
}

module.exports = {
  moduleManifest,
  createAuthCapabilities,
  createRuntimeAdapters,
  createAuthRepository,
  createAuthSessionRepository,
  createAuthService,
  createSessionPolicy,
};
