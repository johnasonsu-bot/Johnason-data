const express = require("express");
const fs = require("fs");
const multer = require("multer");
const os = require("os");
const path = require("path");
const authMiddleware = require("../../common/middleware/auth");
const requireFeature = require("../../common/middleware/license-feature");
const asyncHandler = require("../../common/utils/async-handler");
const { validateBody } = require("../../common/middleware/validate");
const controller = require("./project-space.controller");
const {
  projectSchema,
  projectStatusSchema,
  projectMemberSchema,
} = require("./project-space.schema");

const router = express.Router();
const uploadDir = path.join(os.tmpdir(), "medata-project-assets");
fs.mkdirSync(uploadDir, { recursive: true });
const projectAssetUploadLimitMb = Math.max(1, Number(process.env.PROJECT_ASSET_UPLOAD_LIMIT_MB || 512));
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: projectAssetUploadLimitMb * 1024 * 1024 },
});

router.use(authMiddleware);

router.get("/my", asyncHandler(controller.listMyProjects));
router.get("/asset-transfer-logs", requireFeature("system_projects"), asyncHandler(controller.listProjectAssetTransferLogs));
router.post("/assets/import/preview", requireFeature("system_projects"), upload.single("file"), asyncHandler(controller.previewProjectAssetImport));
router.post("/assets/import", requireFeature("system_projects"), upload.single("file"), asyncHandler(controller.importProjectAssets));
router.get("/", requireFeature("system_projects"), asyncHandler(controller.listProjects));
router.post("/", requireFeature("system_projects"), validateBody(projectSchema), asyncHandler(controller.createProject));
router.get("/:id/assets/backups", requireFeature("system_projects"), asyncHandler(controller.listProjectAssetBackups));
router.post("/:id/assets/backups", requireFeature("system_projects"), asyncHandler(controller.createProjectAssetBackup));
router.get("/:id/assets/backups/:backupId/download", requireFeature("system_projects"), asyncHandler(controller.downloadProjectAssetBackup));
router.get("/:id/assets/export", requireFeature("system_projects"), asyncHandler(controller.exportProjectAssets));
router.get("/:id", requireFeature("system_projects"), asyncHandler(controller.getProjectDetail));
router.put("/:id", requireFeature("system_projects"), validateBody(projectSchema), asyncHandler(controller.updateProject));
router.delete("/:id", requireFeature("system_projects"), asyncHandler(controller.deleteProject));
router.post("/:id/default", requireFeature("system_projects"), asyncHandler(controller.setDefaultProject));
router.post("/:id/status", requireFeature("system_projects"), validateBody(projectStatusSchema), asyncHandler(controller.updateProjectStatus));
router.post("/:id/members", requireFeature("system_projects"), validateBody(projectMemberSchema), asyncHandler(controller.upsertProjectMember));
router.delete("/:id/members/:userId", requireFeature("system_projects"), asyncHandler(controller.removeProjectMember));

module.exports = router;
