const crypto = require("node:crypto");

function toArtifactDto(file) {
  if (!file || typeof file !== "object" || Array.isArray(file)) throw new TypeError("Uploaded file metadata is required");
  const artifact = {
    name: file.originalname || file.name || file.filename,
  };
  if (file.size !== undefined) artifact.size = file.size;
  if (file.mimetype !== undefined || file.mediaType !== undefined) artifact.mediaType = file.mimetype || file.mediaType;
  if (file.path !== undefined) artifact.path = file.path;
  return Object.freeze(artifact);
}

function createProjectOperations({ projectService, assetService }) {
  if (!projectService || !assetService) throw new TypeError("Web project services are required");
  return Object.freeze({
    detail: (projectId) => projectService.getProjectDetail(projectId),
    create: (body, actor) => projectService.createProject(body, actor),
    update: (projectId, body) => projectService.updateProject(projectId, body),
    remove: (projectId) => projectService.deleteProject(projectId),
    setStatus: (projectId, status) => projectService.updateProjectStatus(projectId, status),
    upsertMember: (projectId, body) => projectService.upsertProjectMember(projectId, body),
    removeMember: (projectId, userId) => projectService.removeProjectMember(projectId, userId),
    listTransferLogs: (projectId) => assetService.listTransferLogs(projectId),
    async previewImport(file) {
      return assetService.previewImport(await assetService.readPackageFile(file));
    },
    async importAssets(file, options, actor) {
      return assetService.importProject(await assetService.readPackageFile(file), options, actor);
    },
    listBackups: (projectId) => assetService.listProjectBackups(projectId),
    createBackup: (projectId, actor) => assetService.createProjectBackup(projectId, actor),
    downloadBackup: (projectId, backupId) => assetService.getProjectBackup(projectId, backupId),
    exportAssets: (projectId, options, actor) => assetService.exportProject(projectId, options, actor),
  });
}

function defaultDatabaseRuntime() {
  const database = require("../config/database");
  return Object.freeze({
    pool: database.pool,
    testConnection: database.testConnection,
    async close() {},
  });
}

function defaultProjectOperations() {
  return createProjectOperations({
    projectService: require("../modules/project-spaces/project-space.service"),
    assetService: require("../modules/project-spaces/project-asset.service"),
  });
}

function createWebRuntimeDependencies(options = {}) {
  const environment = options.env || require("../config/env");
  const jwtImpl = options.jwtImpl || require("jsonwebtoken");
  const passwordHasher = options.passwordHasher || require("bcryptjs");
  const clock = options.clock || Object.freeze({ now: () => new Date() });
  const idGenerator = options.idGenerator || crypto.randomUUID;
  const errorFactory = options.errorFactory || ((message, statusCode) => {
    const AppError = require("../common/errors/app-error");
    return new AppError(message, statusCode);
  });
  const databaseRuntime = options.databaseRuntime || defaultDatabaseRuntime();
  const projectOperations = options.projectOperations || defaultProjectOperations();
  const jwtCodec = Object.freeze({
    sign(payload) {
      return jwtImpl.sign(payload, environment.jwtSecret, { expiresIn: environment.jwtExpiresIn });
    },
    decode(token) {
      return jwtImpl.decode(token);
    },
    verify(token) {
      return jwtImpl.verify(token, environment.jwtSecret);
    },
  });

  return Object.freeze({
    databaseRuntime,
    auth: Object.freeze({ jwtCodec, passwordHasher, clock, idGenerator, errorFactory }),
    project: Object.freeze({ projectOperations }),
  });
}

function createWebDataPlatformCore(options = {}) {
  const corePackage = options.corePackage || require("@johnason/data-platform-core");
  const runtimeDependencies = options.runtimeDependencies || createWebRuntimeDependencies(options);
  return corePackage.createDataPlatformCore(runtimeDependencies);
}

let webCore;
function getWebDataPlatformCore() {
  if (!webCore) webCore = createWebDataPlatformCore();
  return webCore;
}

module.exports = {
  createProjectOperations,
  createWebDataPlatformCore,
  createWebRuntimeDependencies,
  getWebDataPlatformCore,
  toArtifactDto,
};
