const { z } = require("zod");
const { createAuthCommands } = require("../commands/auth");
const { createConfigCommands } = require("../commands/config");
const { createPlatformCommands } = require("../commands/platform");
const { createProjectCommands } = require("../commands/project");
const { createSystemDoctorCommands } = require("../commands/system-doctor");

const anyObject = z.record(z.unknown()).default({});
const anyOutput = z.unknown();
const databaseTarget = Object.freeze([{ kind: "database", engine: "mysql", role: "platform-authority" }]);
const localTarget = Object.freeze([{ kind: "local" }]);

function definition(command, capabilityId, handler, metadata = {}) {
  return Object.freeze({
    command,
    capabilityId,
    modules: Object.freeze([...(metadata.modules || [])]),
    action: metadata.action || "read",
    sourceApiKeys: Object.freeze([...(metadata.sourceApiKeys || [])]),
    sourceFrontendKeys: Object.freeze([...(metadata.sourceFrontendKeys || [])]),
    executionTargets: metadata.local ? localTarget : databaseTarget,
    inputSchema: anyObject,
    outputSchema: anyOutput,
    handler,
  });
}

function createFoundationCommands(dependencies) {
  const auth = createAuthCommands(dependencies);
  const project = createProjectCommands(dependencies);
  const platform = createPlatformCommands(dependencies);
  const system = createSystemDoctorCommands(dependencies);
  const config = dependencies.profileStore && dependencies.keychain ? createConfigCommands(dependencies) : Object.freeze({});
  const definitions = [
    definition("auth login", "auth.login", auth.login, { action: "write", sourceApiKeys: ["POST /api/v1/auth/login"], sourceFrontendKeys: ["/login"] }),
    definition("auth profile", "auth.profile", auth.profile, { sourceApiKeys: ["GET /api/v1/auth/profile"], sourceFrontendKeys: ["/profile"] }),
    definition("auth logout", "auth.logout", auth.logout, { action: "write", sourceApiKeys: ["POST /api/v1/auth/logout"], sourceFrontendKeys: ["/logout"] }),
    definition("project list", "project.list-my", project.list, { modules: ["system_projects"], sourceApiKeys: ["GET /api/v1/projects/my"], sourceFrontendKeys: ["/projects/my"] }),
    definition("project current", "project.current", project.current, { modules: ["system_projects"], sourceFrontendKeys: ["/projects/current"] }),
    definition("project resolve", "project.resolve", project.resolve, { modules: ["system_projects"] }),
    definition("project use", "project.use", project.use, { modules: ["system_projects"], action: "write" }),
    definition("project access-check", "project.access-check", project.accessCheck, { modules: ["system_projects"] }),
    definition("platform overview", "platform.overview", platform.overview, { sourceApiKeys: ["GET /api/v1/platform/overview"] }),
    definition("system doctor", "system.doctor", system.doctor),
    definition("system doctor health", "system.doctor.health", system.health, { local: true, sourceApiKeys: ["GET /api/health"] }),
    definition("system doctor database-capabilities", "system.doctor.database-capabilities", platform.databaseCapabilities, { local: true, sourceApiKeys: ["GET /api/v1/platform/database-capabilities"] }),
    ...Object.entries(config).map(([name, handler]) => definition(`config ${name}`, `config.${name}`, handler, { local: true })),
  ];
  Object.assign(definitions, { auth, config, platform, project, system });
  return Object.freeze(definitions);
}

module.exports = { createFoundationCommands };
