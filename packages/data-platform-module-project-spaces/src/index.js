const { getDatabaseRuntime: kernelGetDatabaseRuntime, validateModuleManifest, authorizeCapability } = require("@johnason/data-platform-core-kernel");
const { createProjectSpaceRepository } = require("./project-space.repository");
const { createProjectSpaceService } = require("./project-space.service");
const { getProjectContext, projectError, resolveProject, runWithProjectContext } = require("./project-policy");

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

function requestError(message = "项目空间请求无效") {
  return projectError(message, "PROJECT_REQUEST_INVALID", 400);
}

function positiveId(value, label = "项目") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw requestError(`${label}标识无效`);
  return id;
}

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw requestError(`${label}无效`);
  return { ...value };
}

function projectBody(value) {
  const body = record(value, "项目内容");
  if (typeof body.projectCode !== "string" || !body.projectCode.trim()) throw requestError("项目编码无效");
  return body;
}

function fileMetadata(value) {
  const file = record(value, "导入文件元数据");
  if (typeof (file.originalname || file.name) !== "string" || !(file.originalname || file.name).trim()) throw requestError("导入文件名无效");
  if (file.size !== undefined && (!Number.isSafeInteger(Number(file.size)) || Number(file.size) < 0)) throw requestError("导入文件大小无效");
  return file;
}

function importOptions(value) {
  const options = record(value || {}, "导入选项");
  const mode = options.mode || "new";
  if (!["new", "overwrite"].includes(mode)) throw requestError("导入模式无效");
  if (options.targetProjectId !== undefined && options.targetProjectId !== null && options.targetProjectId !== "") options.targetProjectId = positiveId(options.targetProjectId);
  if (mode === "overwrite" && !options.targetProjectId) throw requestError("覆盖导入必须选择目标项目");
  return { ...options, mode };
}

function publicValue(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(publicValue));
  if (!value || typeof value !== "object") return value;
  return Object.freeze(Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/secret|password|token|credential|authorization|internal/i.test(key))
    .map(([key, item]) => [key, publicValue(item)])));
}

function mappedPortError(error) {
  if (error?.code && String(error.code).startsWith("PROJECT_")) return error;
  const sourceCode = String(error?.code || "").toUpperCase();
  if (sourceCode.includes("CONFLICT") || Number(error?.statusCode) === 409) return projectError("项目空间资源冲突", "PROJECT_CONFLICT", 409);
  if (sourceCode.includes("NOT_FOUND") || Number(error?.statusCode) === 404) return projectError("项目空间资源不存在", "PROJECT_NOT_FOUND", 404);
  if (Number(error?.statusCode) >= 400 && Number(error.statusCode) < 500) return projectError("项目空间操作无效", "PROJECT_OPERATION_INVALID", Number(error.statusCode));
  return projectError("项目空间操作失败", "PROJECT_OPERATION_FAILED", 500);
}

function validResult(value, kind) {
  if (kind === "list") return Array.isArray(value);
  if (kind === "record") return Boolean(value && typeof value === "object" && !Array.isArray(value));
  if (kind === "deleted") return Boolean(value && typeof value === "object" && value.deleted === true && Number.isInteger(Number(value.projectId)));
  return false;
}

const projectOperationDescriptors = Object.freeze({
  detail: { action: "read", result: "record", normalize: (id) => [positiveId(id)] },
  create: { action: "write", result: "record", normalize: (body, actor) => [projectBody(body), actor] },
  update: { action: "write", result: "record", normalize: (id, body) => [positiveId(id), projectBody(body)] },
  remove: { action: "write", result: "deleted", normalize: (id) => [positiveId(id)] },
  setStatus: { action: "write", result: "record", normalize: (id, status) => { if (typeof status !== "string" || !status.trim()) throw requestError("项目状态无效"); return [positiveId(id), status]; } },
  upsertMember: { action: "write", result: "record", normalize: (id, body) => { const member = record(body, "项目成员"); member.userId = positiveId(member.userId, "成员"); return [positiveId(id), member]; } },
  removeMember: { action: "write", result: "record", normalize: (id, userId) => [positiveId(id), positiveId(userId, "成员")] },
  listTransferLogs: { action: "read", result: "list", normalize: (options = {}) => { const query = record(options, "日志查询"); return [query.projectId === undefined || query.projectId === null || query.projectId === "" ? null : positiveId(query.projectId)]; } },
  previewImport: { action: "write", result: "record", normalize: (file) => [fileMetadata(file)] },
  importAssets: { action: "write", result: "record", normalize: (file, options, actor) => [fileMetadata(file), importOptions(options), actor] },
  listBackups: { action: "read", result: "list", normalize: (id) => [positiveId(id)] },
  createBackup: { action: "write", result: "record", normalize: (id, actor) => [positiveId(id), actor] },
  downloadBackup: { action: "read", result: "record", normalize: (id, backupId) => [positiveId(id), positiveId(backupId, "备份")] },
  exportAssets: { action: "read", result: "record", normalize: (id, options = {}, actor) => [positiveId(id), record(options, "导出选项"), actor] },
});

function createProjectCapabilities(dependencies = {}) {
  const { service, projectOperations } = createRuntimeAdapters(dependencies);
  function operation(name) {
    const descriptor = projectOperationDescriptors[name];
    return async (...args) => {
      authorizeCapability(args.at(-1), { modules: ["system_projects"], action: descriptor.action, readOnlyAllowed: descriptor.action === "read" });
      if (typeof projectOperations[name] !== "function") throw new TypeError(`Project capability requires projectOperations.${name}`);
      let result;
      try {
        result = await projectOperations[name](...descriptor.normalize(...args));
      } catch (error) {
        throw mappedPortError(error);
      }
      if (!validResult(result, descriptor.result)) throw projectError("项目空间返回结果无效", "PROJECT_PORT_INVALID_RESULT", 502);
      return Object.freeze({ data: publicValue(result) });
    };
  }
  function systemOperation(serviceOperation, action = "read") {
    return async (...args) => {
      authorizeCapability(args.at(-1), { modules: ["system_projects"], action, readOnlyAllowed: action === "read" });
      return serviceOperation(...args);
    };
  }
  return Object.freeze({ project: Object.freeze({
    listMy: service.listMyProjects,
    list: systemOperation(service.listProjects),
    current: service.getUserDefaultProjectId,
    detail: operation("detail"),
    resolve: service.resolveRequestProject,
    use: service.resolveRequestProject,
    accessCheck: service.resolveRequestProject,
    setDefault: systemOperation(service.setDefaultProject, "write"),
    create: operation("create"),
    update: operation("update"),
    remove: operation("remove"),
    setStatus: operation("setStatus"),
    upsertMember: operation("upsertMember"),
    removeMember: operation("removeMember"),
    listTransferLogs: operation("listTransferLogs"),
    previewImport: operation("previewImport"),
    importAssets: operation("importAssets"),
    listBackups: operation("listBackups"),
    createBackup: operation("createBackup"),
    downloadBackup: operation("downloadBackup"),
    exportAssets: operation("exportAssets"),
  }) });
}

module.exports = { moduleManifest, createProjectCapabilities, createProjectSpaceRepository, createProjectSpaceService, createRuntimeAdapters, authorizeCapability, getProjectContext, resolveProject, runWithProjectContext };
