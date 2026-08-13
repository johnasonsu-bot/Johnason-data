const { getDatabaseRuntime: kernelGetDatabaseRuntime, validateModuleManifest, authorizeCapability } = require("@johnason/data-platform-core-kernel");
const { createProjectSpaceRepository } = require("./project-space.repository");
const { createProjectSpaceService } = require("./project-space.service");
const { getProjectContext, resolveProject, runWithProjectContext } = require("./project-policy");

const moduleManifest = validateModuleManifest({
  moduleName: "project-spaces", moduleVersion: "0.2.0", capabilitySchemaVersion: "1.0.0",
  capabilities: [
    { capabilityId: "project.list-my", sourceApiKeys: ["GET /api/v1/projects/my"], sourceFrontendKeys: ["/projects/my"], executionTargets: ["web", "cli"] },
    { capabilityId: "project.list", sourceApiKeys: ["GET /api/v1/projects"], sourceFrontendKeys: ["/projects"], executionTargets: ["web", "cli"] },
    { capabilityId: "project.current", sourceApiKeys: [], sourceFrontendKeys: ["/projects/current"], executionTargets: ["web", "cli"] },
    { capabilityId: "project.detail", sourceApiKeys: ["GET /api/v1/projects/:id"], sourceFrontendKeys: ["/projects/:id"], executionTargets: ["web", "cli"] },
    { capabilityId: "project.resolve", sourceApiKeys: [], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.use", sourceApiKeys: [], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.access-check", sourceApiKeys: [], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.set-default", sourceApiKeys: ["POST /api/v1/projects/:id/default"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.create", sourceApiKeys: ["POST /api/v1/projects"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.update", sourceApiKeys: ["PUT /api/v1/projects/:id"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.remove", sourceApiKeys: ["DELETE /api/v1/projects/:id"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.set-status", sourceApiKeys: ["POST /api/v1/projects/:id/status"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.upsert-member", sourceApiKeys: ["POST /api/v1/projects/:id/members"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.remove-member", sourceApiKeys: ["DELETE /api/v1/projects/:id/members/:userId"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.list-transfer-logs", sourceApiKeys: ["GET /api/v1/projects/asset-transfer-logs"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.preview-import", sourceApiKeys: ["POST /api/v1/projects/assets/import/preview"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.import-assets", sourceApiKeys: ["POST /api/v1/projects/assets/import"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.list-backups", sourceApiKeys: ["GET /api/v1/projects/:id/assets/backups"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.create-backup", sourceApiKeys: ["POST /api/v1/projects/:id/assets/backups"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.download-backup", sourceApiKeys: ["GET /api/v1/projects/:id/assets/backups/:backupId/download"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
    { capabilityId: "project.export-assets", sourceApiKeys: ["GET /api/v1/projects/:id/assets/export"], sourceFrontendKeys: [], executionTargets: ["web", "cli"] },
  ],
});

function createRuntimeAdapters(dependencies = {}) {
  const getDatabaseRuntime = () => dependencies.databaseRuntime || kernelGetDatabaseRuntime();
  const projectRepository = dependencies.projectRepository || createProjectSpaceRepository({ getDatabaseRuntime });
  const service = dependencies.projectService || createProjectSpaceService({ projectRepository });
  return Object.freeze({ projectRepository, projectOperations: dependencies.projectOperations || {}, service });
}

function createProjectCapabilities(dependencies = {}) {
  const { service, projectOperations } = createRuntimeAdapters(dependencies);
  function operation(name, action = "read") {
    return async (...args) => {
      authorizeCapability(args.at(-1), { modules: ["data_map"], action, readOnlyAllowed: action === "read" });
      if (typeof projectOperations[name] !== "function") throw new TypeError(`Project capability requires projectOperations.${name}`);
      return projectOperations[name](...args);
    };
  }
  return Object.freeze({ project: Object.freeze({
    listMy: service.listMyProjects,
    list: service.listProjects,
    current: service.getUserDefaultProjectId,
    detail: operation("detail"),
    resolve: service.resolveRequestProject,
    use: service.resolveRequestProject,
    accessCheck: service.resolveRequestProject,
    setDefault: service.setDefaultProject,
    create: operation("create", "write"),
    update: operation("update", "write"),
    remove: operation("remove", "write"),
    setStatus: operation("setStatus", "write"),
    upsertMember: operation("upsertMember", "write"),
    removeMember: operation("removeMember", "write"),
    listTransferLogs: operation("listTransferLogs"),
    previewImport: operation("previewImport"),
    importAssets: operation("importAssets", "write"),
    listBackups: operation("listBackups"),
    createBackup: operation("createBackup", "write"),
    downloadBackup: operation("downloadBackup"),
    exportAssets: operation("exportAssets"),
  }) });
}

module.exports = { moduleManifest, createProjectCapabilities, createProjectSpaceRepository, createProjectSpaceService, createRuntimeAdapters, authorizeCapability, getProjectContext, resolveProject, runWithProjectContext };
