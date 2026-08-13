const express = require("express");
const authMiddleware = require("../../common/middleware/auth");
const optionalAuthMiddleware = require("../../common/middleware/optional-auth");
const activationMiddleware = require("../../common/middleware/activation");
const asyncHandler = require("../../common/utils/async-handler");
const { validateBody } = require("../../common/middleware/validate");
const controller = require("./reporting.controller");
const {
  aiChartAnalysisSuggestionSchema,
  aiChartFieldMapSchema,
  aiChartQuerySchema,
  aiChartRecommendSchema,
  aiChartSqlPlanSchema,
  aiChartSqlRevisionSchema,
  dashboardPreviewSchema,
  datasetPreviewSchema,
  reportChartAssetSchema,
  reportDashboardSchema,
  reportDataSourceSchema,
  reportDataSourceTestSchema,
  reportDatasetSchema,
  reportDatasetFolderSchema,
  reportThemeTemplateSchema,
} = require("./reporting.schema");

const router = express.Router();

router.get("/runtime/dashboards/:id/theme-templates", optionalAuthMiddleware, asyncHandler(controller.listRuntimeReportThemeTemplates));
router.post("/runtime/dashboards/:id/preview-chart", optionalAuthMiddleware, validateBody(dashboardPreviewSchema), asyncHandler(controller.previewRuntimeDashboardChart));

router.use(authMiddleware, activationMiddleware);

router.get("/overview", asyncHandler(controller.getOverview));

router.post("/ai/chart/analysis-suggestions", validateBody(aiChartAnalysisSuggestionSchema), asyncHandler(controller.suggestAiChartAnalysis));
router.post("/ai/chart/sql-plan", validateBody(aiChartSqlPlanSchema), asyncHandler(controller.planAiChartSql));
router.post("/ai/chart/sql-revise", validateBody(aiChartSqlRevisionSchema), asyncHandler(controller.reviseAiChartSql));
router.post("/ai/chart/query", validateBody(aiChartQuerySchema), asyncHandler(controller.runAiChartQuery));
router.post("/ai/chart/recommend", validateBody(aiChartRecommendSchema), asyncHandler(controller.recommendAiChart));
router.post("/ai/chart/field-map", validateBody(aiChartFieldMapSchema), asyncHandler(controller.allocateAiChartFieldMap));

router.get("/data-sources", asyncHandler(controller.listReportDataSources));
router.post("/data-sources", validateBody(reportDataSourceSchema), asyncHandler(controller.createReportDataSource));
router.put("/data-sources/:id", validateBody(reportDataSourceSchema), asyncHandler(controller.updateReportDataSource));
router.delete("/data-sources/:id", asyncHandler(controller.deleteReportDataSource));
router.post("/data-sources/test-connection", validateBody(reportDataSourceTestSchema), asyncHandler(controller.testReportDataSourceConnection));
router.get("/data-sources/:id/tables", asyncHandler(controller.listReportDataSourceTables));
router.get("/data-sources/:id/tables/:tableName/columns", asyncHandler(controller.listReportDataSourceColumns));
router.get("/data-sources/:id/tables/:tableName/sample", asyncHandler(controller.sampleReportDataSourceRows));

router.get("/dataset-folders", asyncHandler(controller.listReportDatasetFolders));
router.post("/dataset-folders", validateBody(reportDatasetFolderSchema), asyncHandler(controller.createReportDatasetFolder));
router.put("/dataset-folders/:id", validateBody(reportDatasetFolderSchema), asyncHandler(controller.updateReportDatasetFolder));
router.delete("/dataset-folders/:id", asyncHandler(controller.deleteReportDatasetFolder));

router.get("/datasets", asyncHandler(controller.listReportDatasets));
router.post("/datasets/preview", validateBody(datasetPreviewSchema), asyncHandler(controller.previewReportDataset));
router.post("/datasets", validateBody(reportDatasetSchema), asyncHandler(controller.createReportDataset));
router.put("/datasets/:id", validateBody(reportDatasetSchema), asyncHandler(controller.updateReportDataset));
router.delete("/datasets/:id", asyncHandler(controller.deleteReportDataset));

router.get("/chart-assets", asyncHandler(controller.listReportChartAssets));
router.post("/chart-assets", validateBody(reportChartAssetSchema), asyncHandler(controller.createReportChartAsset));
router.put("/chart-assets/:id", validateBody(reportChartAssetSchema), asyncHandler(controller.updateReportChartAsset));
router.delete("/chart-assets/:id", asyncHandler(controller.deleteReportChartAsset));

router.get("/theme-templates", asyncHandler(controller.listReportThemeTemplates));
router.post("/theme-templates", validateBody(reportThemeTemplateSchema), asyncHandler(controller.createReportThemeTemplate));
router.put("/theme-templates/:id", validateBody(reportThemeTemplateSchema), asyncHandler(controller.updateReportThemeTemplate));
router.delete("/theme-templates/:id", asyncHandler(controller.deleteReportThemeTemplate));

router.get("/dashboards", asyncHandler(controller.listReportDashboards));
router.get("/dashboards/:id", asyncHandler(controller.getReportDashboard));
router.post("/dashboards/:id/publish", asyncHandler(controller.publishReportDashboard));
router.post("/dashboards/preview-chart", validateBody(dashboardPreviewSchema), asyncHandler(controller.previewDashboardChart));
router.post("/dashboards", validateBody(reportDashboardSchema), asyncHandler(controller.createReportDashboard));
router.put("/dashboards/:id", validateBody(reportDashboardSchema), asyncHandler(controller.updateReportDashboard));
router.delete("/dashboards/:id", asyncHandler(controller.deleteReportDashboard));

module.exports = router;
