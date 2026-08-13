const { getDatabaseRuntime: kernelGetDatabaseRuntime, validateModuleManifest, authorizeCapability } = require("@johnason/data-platform-core-kernel");
const { createProjectSpaceRepository } = require("./project-space.repository");
const { createProjectSpaceService } = require("./project-space.service");
const { getProjectContext, resolveProject, runWithProjectContext } = require("./project-policy");

const moduleManifest = validateModuleManifest({
  moduleName: "project-spaces", moduleVersion: "0.2.0", capabilitySchemaVersion: "1.0.0",
  capabilities: [
    { capabilityId: "project.list", sourceApiKeys: ["GET /api/v1/projects/my", "GET /api/v1/projects/asset-transfer-logs", "GET /api/v1/projects"], sourceFrontendKeys: ["/projects"], executionTargets: ["web", "cli"] },
    { capabilityId: "project.current", sourceApiKeys: ["POST /api/v1/projects/:id/default"], sourceFrontendKeys: ["/projects/current"], executionTargets: ["web", "cli"] },
    { capabilityId: "project.resolve", sourceApiKeys: ["GET /api/v1/projects/:id", "GET /api/v1/projects/:id/assets/backups", "GET /api/v1/projects/:id/assets/backups/:backupId/download", "GET /api/v1/projects/:id/assets/export"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.use", sourceApiKeys: ["POST /api/v1/projects/assets/import/preview", "POST /api/v1/projects/assets/import", "POST /api/v1/projects/:id/assets/backups"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.access-check", sourceApiKeys: ["POST /api/v1/projects", "PUT /api/v1/projects/:id", "DELETE /api/v1/projects/:id", "POST /api/v1/projects/:id/status", "POST /api/v1/projects/:id/members", "DELETE /api/v1/projects/:id/members/:userId"], sourceFrontendKeys: ["/projects/:id"], executionTargets: ["web", "cli"] },
  ],
});

function createRuntimeAdapters(dependencies = {}) {
  const getDatabaseRuntime = () => dependencies.databaseRuntime || kernelGetDatabaseRuntime();
  const projectRepository = dependencies.projectRepository || createProjectSpaceRepository({ getDatabaseRuntime });
  const service = dependencies.projectService || createProjectSpaceService({ projectRepository });
  return Object.freeze({ projectRepository, service });
}

function createProjectCapabilities(dependencies = {}) {
  const { service } = createRuntimeAdapters(dependencies);
  return Object.freeze({ project: Object.freeze({
    list: service.listMyProjects,
    current: service.getUserDefaultProjectId,
    resolve: service.resolveRequestProject,
    use: service.resolveRequestProject,
    accessCheck: service.resolveRequestProject,
    setDefault: service.setDefaultProject,
  }) });
}

module.exports = { moduleManifest, createProjectCapabilities, createProjectSpaceRepository, createProjectSpaceService, createRuntimeAdapters, authorizeCapability, getProjectContext, resolveProject, runWithProjectContext };
