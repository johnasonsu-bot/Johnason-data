const { sendSuccess } = require("../../common/utils/response");
const service = require("./project-space.service");
const assetService = require("./project-asset.service");

async function listMyProjects(req, res) {
  const rows = await service.listMyProjects(req.user);
  const defaultProjectId = await service.getUserDefaultProjectId(req.user);
  return sendSuccess(res, rows, { total: rows.length, defaultProjectId });
}

async function listProjects(req, res) {
  const rows = await service.listProjects();
  const defaultProjectId = await service.getUserDefaultProjectId(req.user);
  return sendSuccess(res, rows, { total: rows.length, defaultProjectId });
}

async function getProjectDetail(req, res) {
  const row = await service.getProjectDetail(Number(req.params.id));
  return sendSuccess(res, row);
}

async function createProject(req, res) {
  const row = await service.createProject(req.validatedBody, req.user);
  return sendSuccess(res, row, null, 201);
}

async function updateProject(req, res) {
  const row = await service.updateProject(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function updateProjectStatus(req, res) {
  const row = await service.updateProjectStatus(Number(req.params.id), req.validatedBody.status);
  return sendSuccess(res, row);
}

async function setDefaultProject(req, res) {
  const row = await service.setDefaultProject(Number(req.params.id), req.user);
  return sendSuccess(res, row);
}

async function upsertProjectMember(req, res) {
  const row = await service.upsertProjectMember(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function removeProjectMember(req, res) {
  const row = await service.removeProjectMember(Number(req.params.id), Number(req.params.userId));
  return sendSuccess(res, row);
}

async function deleteProject(req, res) {
  const row = await service.deleteProject(Number(req.params.id));
  return sendSuccess(res, row);
}

async function exportProjectAssets(req, res) {
  const payload = await assetService.exportProject(Number(req.params.id), {
    ...(req.query || {}),
    packageKey: req.get("x-project-package-key") || "",
  }, req.user);
  const projectCode = payload.manifest.sourceProject.code || `project_${req.params.id}`;
  const fileName = `${projectCode}-assets-${Date.now()}.medata-project.json`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  return res.status(200).send(JSON.stringify(payload, null, 2));
}

async function createProjectAssetBackup(req, res) {
  const result = await assetService.createProjectBackup(Number(req.params.id), req.user);
  return sendSuccess(res, result, null, 201);
}

async function listProjectAssetBackups(req, res) {
  const rows = await assetService.listProjectBackups(Number(req.params.id));
  return sendSuccess(res, rows, { total: rows.length });
}

async function downloadProjectAssetBackup(req, res) {
  const payload = await assetService.getProjectBackup(Number(req.params.id), Number(req.params.backupId));
  const projectCode = payload?.manifest?.sourceProject?.code || `project_${req.params.id}`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${projectCode}-backup-${req.params.backupId}.medata-project.json"`);
  return res.status(200).send(JSON.stringify(payload, null, 2));
}

async function previewProjectAssetImport(req, res) {
  const payload = await assetService.readPackageFile(req.file);
  const result = await assetService.previewImport(payload);
  return sendSuccess(res, result);
}

async function importProjectAssets(req, res) {
  const payload = await assetService.readPackageFile(req.file);
  const result = await assetService.importProject(payload, {
    mode: req.body?.mode || "new",
    targetProjectId: req.body?.targetProjectId ? Number(req.body.targetProjectId) : null,
    targetProjectName: req.body?.targetProjectName || "",
    targetProjectCode: req.body?.targetProjectCode || "",
    packageKey: req.get("x-project-package-key") || "",
  }, req.user);
  return sendSuccess(res, result, null, 201);
}

async function listProjectAssetTransferLogs(req, res) {
  const rows = await assetService.listTransferLogs(req.query?.projectId ? Number(req.query.projectId) : null);
  return sendSuccess(res, rows, { total: rows.length });
}

module.exports = {
  listMyProjects,
  listProjects,
  getProjectDetail,
  createProject,
  updateProject,
  updateProjectStatus,
  setDefaultProject,
  upsertProjectMember,
  removeProjectMember,
  deleteProject,
  exportProjectAssets,
  createProjectAssetBackup,
  listProjectAssetBackups,
  downloadProjectAssetBackup,
  previewProjectAssetImport,
  importProjectAssets,
  listProjectAssetTransferLogs,
};
