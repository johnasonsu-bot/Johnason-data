const { sendSuccess } = require("../../common/utils/response");
const { getWebDataPlatformCore, toArtifactDto } = require("../../core/data-platform");

function createProjectSpaceController({ getCore = getWebDataPlatformCore } = {}) {
  const context = (req) => ({ actor: req.user, project: req.project, projectId: req.projectId });
  const data = (result) => result && Object.prototype.hasOwnProperty.call(result, "data") ? result.data : result;
  const execute = (req, capabilityId, input) => getCore().execute(capabilityId, input, context(req));

  async function listMyProjects(req, res) {
    const rows = await execute(req, "project.list-my", {});
    const defaultProjectId = await execute(req, "project.current", {});
    return sendSuccess(res, rows, { total: rows.length, defaultProjectId });
  }

  async function listProjects(req, res) {
    const rows = await execute(req, "project.list", {});
    const defaultProjectId = await execute(req, "project.current", {});
    return sendSuccess(res, rows, { total: rows.length, defaultProjectId });
  }

  async function getProjectDetail(req, res) { return sendSuccess(res, data(await execute(req, "project.detail", { projectId: Number(req.params.id) }))); }
  async function createProject(req, res) { return sendSuccess(res, data(await execute(req, "project.create", { body: req.validatedBody })), null, 201); }
  async function updateProject(req, res) { return sendSuccess(res, data(await execute(req, "project.update", { projectId: Number(req.params.id), body: req.validatedBody }))); }
  async function updateProjectStatus(req, res) { return sendSuccess(res, data(await execute(req, "project.set-status", { projectId: Number(req.params.id), status: req.validatedBody.status }))); }
  async function setDefaultProject(req, res) { return sendSuccess(res, await execute(req, "project.set-default", { projectId: Number(req.params.id) })); }
  async function upsertProjectMember(req, res) { return sendSuccess(res, data(await execute(req, "project.upsert-member", { projectId: Number(req.params.id), body: req.validatedBody }))); }
  async function removeProjectMember(req, res) { return sendSuccess(res, data(await execute(req, "project.remove-member", { projectId: Number(req.params.id), userId: Number(req.params.userId) }))); }
  async function deleteProject(req, res) { return sendSuccess(res, data(await execute(req, "project.remove", { projectId: Number(req.params.id) }))); }

  async function exportProjectAssets(req, res) {
    const payload = data(await execute(req, "project.export-assets", { projectId: Number(req.params.id), options: { ...(req.query || {}), packageKey: req.get("x-project-package-key") || "" } }));
    const projectCode = payload.manifest.sourceProject.code || `project_${req.params.id}`;
    const fileName = `${projectCode}-assets-${Date.now()}.medata-project.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(JSON.stringify(payload, null, 2));
  }

  async function createProjectAssetBackup(req, res) { return sendSuccess(res, data(await execute(req, "project.create-backup", { projectId: Number(req.params.id) })), null, 201); }
  async function listProjectAssetBackups(req, res) {
    const rows = data(await execute(req, "project.list-backups", { projectId: Number(req.params.id) }));
    return sendSuccess(res, rows, { total: rows.length });
  }
  async function downloadProjectAssetBackup(req, res) {
    const payload = data(await execute(req, "project.download-backup", { projectId: Number(req.params.id), backupId: Number(req.params.backupId) }));
    const projectCode = payload?.manifest?.sourceProject?.code || `project_${req.params.id}`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${projectCode}-backup-${req.params.backupId}.medata-project.json"`);
    return res.status(200).send(JSON.stringify(payload, null, 2));
  }

  async function previewProjectAssetImport(req, res) {
    return sendSuccess(res, data(await execute(req, "project.preview-import", { file: toArtifactDto(req.file) })));
  }
  async function importProjectAssets(req, res) {
    const result = data(await execute(req, "project.import-assets", {
      file: toArtifactDto(req.file),
      options: {
        mode: req.body?.mode || "new",
        targetProjectId: req.body?.targetProjectId ? Number(req.body.targetProjectId) : null,
        targetProjectName: req.body?.targetProjectName || "",
        targetProjectCode: req.body?.targetProjectCode || "",
        packageKey: req.get("x-project-package-key") || "",
      },
    }));
    return sendSuccess(res, result, null, 201);
  }
  async function listProjectAssetTransferLogs(req, res) {
    const rows = data(await execute(req, "project.list-transfer-logs", { projectId: req.query?.projectId ? Number(req.query.projectId) : null }));
    return sendSuccess(res, rows, { total: rows.length });
  }

  return Object.freeze({
    listMyProjects, listProjects, getProjectDetail, createProject, updateProject, updateProjectStatus,
    setDefaultProject, upsertProjectMember, removeProjectMember, deleteProject, exportProjectAssets,
    createProjectAssetBackup, listProjectAssetBackups, downloadProjectAssetBackup,
    previewProjectAssetImport, importProjectAssets, listProjectAssetTransferLogs,
  });
}

module.exports = Object.freeze({ ...createProjectSpaceController(), createProjectSpaceController });
