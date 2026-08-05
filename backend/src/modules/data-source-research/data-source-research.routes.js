const express = require("express");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const asyncHandler = require("../../common/utils/async-handler");
const { validateBody } = require("../../common/middleware/validate");
const controller = require("./data-source-research.controller");
const {
  compareResearchReportsSchema,
  createResearchRunSchema,
  createResearchTaskSchema,
  updateResearchTaskSchema
} = require("./data-source-research.schema");

const router = express.Router();

router.use(authMiddleware, activationMiddleware);
router.get("/tasks", asyncHandler(controller.listResearchTasks));
router.post("/tasks", validateBody(createResearchTaskSchema), asyncHandler(controller.createResearchTask));
router.get("/tasks/:taskId", asyncHandler(controller.getResearchTask));
router.put("/tasks/:taskId", validateBody(updateResearchTaskSchema), asyncHandler(controller.updateResearchTask));
router.delete("/tasks/:taskId", asyncHandler(controller.deleteResearchTask));
router.get("/tasks/:taskId/runs", asyncHandler(controller.listResearchTaskRuns));
router.post("/tasks/:taskId/runs", asyncHandler(controller.createResearchTaskRun));
router.get("/tasks/:taskId/comparisons", asyncHandler(controller.listResearchComparisons));
router.post("/tasks/:taskId/compare", validateBody(compareResearchReportsSchema), asyncHandler(controller.compareResearchReports));
router.get("/comparisons/:comparisonId", asyncHandler(controller.getResearchComparison));
router.post("/source/:sourceId/runs", validateBody(createResearchRunSchema), asyncHandler(controller.createResearchRun));
router.get("/source/:sourceId/runs", asyncHandler(controller.listResearchRuns));
router.get("/runs/:runId", asyncHandler(controller.getResearchRun));
router.get("/runs/:runId/logs", asyncHandler(controller.listResearchLogs));
router.get("/runs/:runId/report", asyncHandler(controller.getResearchReport));
router.get("/runs/:runId/report.docx", asyncHandler(controller.downloadResearchReportWord));
router.post("/runs/:runId/terminate", asyncHandler(controller.terminateResearchRun));
router.delete("/runs/:runId", asyncHandler(controller.deleteResearchRun));

module.exports = router;
