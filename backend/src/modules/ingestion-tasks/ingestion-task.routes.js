const express = require("express");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const asyncHandler = require("../../common/utils/async-handler");
const { validateBody } = require("../../common/middleware/validate");
const controller = require("./ingestion-task.controller");
const { createTaskSchema, updateTaskSchema, previewSourceSchema } = require("./ingestion-task.schema");
const { analyzeFailureSchema } = require("./ingestion-task.analysis-schema");
const { recommendTaskConfigSchema } = require("./ingestion-task.recommendation-schema");
const { upload: apiDocumentUpload } = require("./ingestion-api-document-parser.schema");

const router = express.Router();

router.use(authMiddleware, activationMiddleware);

router.get("/monitor-overview", asyncHandler(controller.getMonitorOverview));
router.get("/", asyncHandler(controller.listTasks));
router.get("/:id", asyncHandler(controller.getTask));
router.post("/", validateBody(createTaskSchema), asyncHandler(controller.createTask));
router.put("/:id", validateBody(updateTaskSchema), asyncHandler(controller.updateTask));
router.delete("/:id", asyncHandler(controller.deleteTask));
router.post("/recommend-config", validateBody(recommendTaskConfigSchema), asyncHandler(controller.recommendTaskConfig));
router.post("/parse-api-document", apiDocumentUpload.single("file"), asyncHandler(controller.parseApiDocument));
router.post("/preview-source", validateBody(previewSourceSchema), asyncHandler(controller.previewSourceData));
router.post("/:id/start", asyncHandler(controller.startTask));
router.post("/:id/stop", asyncHandler(controller.stopTask));
router.post("/:id/run", asyncHandler(controller.runTaskNow));
router.get("/:id/runs", asyncHandler(controller.getJobRuns));
router.post("/:id/runs/:runId/analyze-failure", validateBody(analyzeFailureSchema), asyncHandler(controller.analyzeJobRunFailure));

module.exports = router;
