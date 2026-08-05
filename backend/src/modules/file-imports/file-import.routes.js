const express = require("express");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const asyncHandler = require("../../common/utils/async-handler");
const { validateBody } = require("../../common/middleware/validate");
const controller = require("./file-import.controller");
const { suggestTechnicalNamesSchema, upload } = require("./file-import.schema");

const router = express.Router();

router.use(authMiddleware, activationMiddleware);

router.get("/", asyncHandler(controller.listTasks));
router.get("/:id", asyncHandler(controller.getTask));
router.get("/:id/runs", asyncHandler(controller.listRuns));
router.get("/:id/runs/:runId/errors", asyncHandler(controller.listRunErrors));
router.post("/:id/runs/:runId/cancel", asyncHandler(controller.cancelRun));
router.post("/preview", upload.array("files", 20), asyncHandler(controller.previewFiles));
router.post("/", upload.array("files", 20), asyncHandler(controller.createTask));
router.post("/suggest-technical-names", validateBody(suggestTechnicalNamesSchema), asyncHandler(controller.suggestTechnicalNames));
router.put("/:id", asyncHandler(controller.updateTask));
router.post("/:id/run", asyncHandler(controller.runTaskNow));
router.delete("/:id", asyncHandler(controller.deleteTask));

module.exports = router;
