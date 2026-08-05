const express = require("express");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const asyncHandler = require("../../common/utils/async-handler");
const { validateBody } = require("../../common/middleware/validate");
const controller = require("./quality-control.controller");
const {
  monitorSourceSchema,
  qualitySourceSchema,
  updateAiConfigSchema,
  regexRuleSchema,
  regexRuleAiAnalyzeSchema,
  dictionarySchema,
  dictionaryPreviewSchema,
  dictionarySourcePreviewSchema,
  dictionaryAiAnalyzeSchema,
  dictionaryBatchSchema,
  dictionaryBatchDeleteSchema,
  strategyDraftSchema,
  recommendationSamplingSchema,
  recommendationApplySchema,
  qualityTaskSchema,
  updateQualityTaskSchema,
} = require("./quality-control.schema");

const router = express.Router();

router.use(authMiddleware, activationMiddleware);

router.get("/data-sources", asyncHandler(controller.listQualitySources));
router.post("/data-sources", validateBody(qualitySourceSchema), asyncHandler(controller.createQualitySource));
router.put("/data-sources/:sourceId", validateBody(qualitySourceSchema), asyncHandler(controller.updateQualitySource));
router.delete("/data-sources/:sourceId", asyncHandler(controller.deleteQualitySource));
router.get("/data-sources/:sourceId/tables", asyncHandler(controller.listQualitySourceTables));
router.get("/data-sources/:sourceId/tables/:tableName/columns", asyncHandler(controller.listQualitySourceColumns));
router.get("/data-sources/:sourceId/monitor", asyncHandler(controller.getQualitySourceMonitor));
router.post("/data-sources/:sourceId/monitor", validateBody(monitorSourceSchema), asyncHandler(controller.saveQualitySourceMonitor));
router.post("/data-sources/:sourceId/sync-tables", asyncHandler(controller.syncQualitySourceTables));

router.get("/ai-configs", asyncHandler(controller.listAiConfigs));
router.get("/ai-configs/:id/versions", asyncHandler(controller.listAiConfigVersions));
router.put("/ai-configs/:id", validateBody(updateAiConfigSchema), asyncHandler(controller.updateAiConfig));

router.get("/rules/regex", asyncHandler(controller.listRegexRules));
router.post("/rules/regex/ai-analyze", validateBody(regexRuleAiAnalyzeSchema), asyncHandler(controller.analyzeRegexRule));
router.post("/rules/regex", validateBody(regexRuleSchema), asyncHandler(controller.saveRegexRule));
router.delete("/rules/regex/:id", asyncHandler(controller.deleteRegexRule));

router.get("/rules/dictionaries", asyncHandler(controller.listDictionaries));
router.get("/rules/dictionaries/options/business-systems", asyncHandler(controller.listDictionaryBusinessSystems));
router.post("/rules/dictionaries/source-preview", validateBody(dictionarySourcePreviewSchema), asyncHandler(controller.previewDictionarySourceRows));
router.post("/rules/dictionaries/preview", validateBody(dictionaryPreviewSchema), asyncHandler(controller.previewDictionaryValues));
router.post("/rules/dictionaries/ai-analyze", validateBody(dictionaryAiAnalyzeSchema), asyncHandler(controller.analyzeDictionaryTable));
router.post("/rules/dictionaries/batch", validateBody(dictionaryBatchSchema), asyncHandler(controller.batchSaveDictionaries));
router.post("/rules/dictionaries/batch-delete", validateBody(dictionaryBatchDeleteSchema), asyncHandler(controller.batchDeleteDictionaries));
router.get("/rules/dictionaries/:id", asyncHandler(controller.getDictionaryDetail));
router.post("/rules/dictionaries", validateBody(dictionarySchema), asyncHandler(controller.saveDictionary));
router.delete("/rules/dictionaries/:id", asyncHandler(controller.deleteDictionary));

router.get("/tasks/strategy-options", asyncHandler(controller.listSubmittedStrategyOptions));
router.get("/tasks", asyncHandler(controller.listTasks));
router.post("/tasks/preview-sql", validateBody(qualityTaskSchema), asyncHandler(controller.previewTaskSql));
router.get("/tasks/:id", asyncHandler(controller.getTaskDetail));
router.post("/tasks", validateBody(qualityTaskSchema), asyncHandler(controller.createTask));
router.post("/tasks/:id/preview-sql", validateBody(updateQualityTaskSchema), asyncHandler(controller.previewTaskSql));
router.put("/tasks/:id", validateBody(updateQualityTaskSchema), asyncHandler(controller.updateTask));
router.delete("/tasks/:id", asyncHandler(controller.deleteTask));
router.post("/tasks/:id/start", asyncHandler(controller.startTask));
router.post("/tasks/:id/stop", asyncHandler(controller.stopTask));
router.post("/tasks/:id/run", asyncHandler(controller.runTaskNow));
router.get("/tasks/:id/runs", asyncHandler(controller.listTaskRuns));

router.get("/strategies/tables", asyncHandler(controller.listStrategyTables));
router.delete("/strategies/tables/:monitorTableId", asyncHandler(controller.deleteStrategyTable));
  router.get("/strategies/tables/:monitorTableId", asyncHandler(controller.getStrategyDetail));
  router.post("/strategies/tables/:monitorTableId/recommend", validateBody(recommendationSamplingSchema), asyncHandler(controller.recommendStrategy));
  router.post("/strategies/tables/:monitorTableId/recommendations", validateBody(recommendationSamplingSchema), asyncHandler(controller.startRecommendation));
  router.get("/strategies/tables/:monitorTableId/recommendations/:runId", asyncHandler(controller.getRecommendationRun));
  router.post("/strategies/tables/:monitorTableId/recommendations/:runId/apply", validateBody(recommendationApplySchema), asyncHandler(controller.applyRecommendationRun));
router.post("/strategies/tables/:monitorTableId/recommendations/:runId/reject", asyncHandler(controller.rejectRecommendationRun));
router.post("/strategies/tables/:monitorTableId/save-draft", validateBody(strategyDraftSchema), asyncHandler(controller.saveStrategyDraft));
router.post("/strategies/tables/:monitorTableId/submit", validateBody(strategyDraftSchema), asyncHandler(controller.submitStrategy));
router.get("/strategies/tables/:monitorTableId/versions", asyncHandler(controller.listStrategyVersions));
router.delete("/strategies/tables/:monitorTableId/versions/:versionId", asyncHandler(controller.deleteStrategyVersion));
router.get("/strategies/versions/:versionId/sql", asyncHandler(controller.getStrategyVersionSql));

router.get("/analysis/:sourceId/overview", asyncHandler(controller.getAnalysisOverview));
router.get("/analysis/:sourceId/stats", asyncHandler(controller.listAnalysisStats));
router.get("/analysis/:sourceId/details", asyncHandler(controller.listAnalysisDetails));
router.delete("/analysis/:sourceId/tables/:tableName", asyncHandler(controller.deleteAnalysisTableResults));

// 轻量质量运营：统一事实层、系统分析、人工报告和问题跟踪。所有统计均在服务端聚合。
router.get("/insights/overview", asyncHandler(controller.getQualityInsightsOverview));
router.get("/insights/ops-dashboard", asyncHandler(controller.getQualityOpsDashboard));
router.get("/insights/ops-drilldown", asyncHandler(controller.getQualityOpsDrilldown));
router.get("/insights/systems", asyncHandler(controller.listQualitySystemInsights));
router.get("/insights/tables", asyncHandler(controller.listQualityTableInsights));
router.get("/insights/table-batches", asyncHandler(controller.listQualityTableBatches));
router.get("/insights/batch-comparison", asyncHandler(controller.compareQualityBatches));
router.get("/insights/observability", asyncHandler(controller.getQualityObservability));
router.get("/insights/tags", asyncHandler(controller.listQualityTags));
router.get("/insights/business-systems", asyncHandler(controller.listQualityBusinessSystems));
router.post("/insights/tags", asyncHandler(controller.saveQualityTag));
router.put("/insights/tables/:monitorTableId/governance", asyncHandler(controller.updateMonitorTableGovernance));
router.get("/insights/report-center-overview", asyncHandler(controller.getQualityReportCenterOverview));
router.get("/insights/report-comparison-options", asyncHandler(controller.listQualityReportComparisonOptions));
router.post("/insights/report-comparisons/preview", asyncHandler(controller.previewQualityReportComparison));
router.post("/insights/reports", asyncHandler(controller.createQualityReport));
router.get("/insights/reports", asyncHandler(controller.listQualityReports));
router.get("/insights/reports/:id/report.md", asyncHandler(controller.downloadQualityReportMarkdown));
router.get("/insights/reports/:id/report.docx", asyncHandler(controller.downloadQualityReportWord));
router.delete("/insights/reports/:id", asyncHandler(controller.deleteQualityReport));
router.get("/insights/reports/:id", asyncHandler(controller.getQualityReportDetail));
router.get("/insights/findings", asyncHandler(controller.listQualityFindings));
router.get("/insights/assignable-users", asyncHandler(controller.listQualityAssignableUsers));
router.post("/insights/findings/:id/review", asyncHandler(controller.reviewQualityFinding));
router.get("/insights/issues", asyncHandler(controller.listQualityIssues));
router.get("/insights/issues/:id", asyncHandler(controller.getQualityIssueDetail));
router.post("/insights/issues/:id/status", asyncHandler(controller.updateQualityIssueStatus));
router.post("/insights/findings/refresh", asyncHandler(controller.materializeQualityFindings));
router.post("/insights/ai-analysis", asyncHandler(controller.runQualityAiAnalysis));
router.get("/insights/robot/sessions", asyncHandler(controller.listQualityOpsRobotSessions));
router.get("/insights/robot/sessions/:id/messages", asyncHandler(controller.getQualityOpsRobotSessionMessages));
router.post("/insights/robot/query", asyncHandler(controller.queryQualityOpsRobot));

module.exports = router;
