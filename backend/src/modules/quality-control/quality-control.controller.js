const { sendSuccess } = require("../../common/utils/response");
const service = require("./quality-control.service");
const analytics = require("./quality-analytics.service");

async function listQualitySources(req, res) {
  const rows = await service.listQualitySources({
    includeTableStats: !["0", "false"].includes(String(req.query.includeTableStats || "").toLowerCase()),
  });
  return sendSuccess(res, rows, { total: rows.length });
}

async function listQualitySourceTables(req, res) {
  const rows = await service.listQualitySourceTables(Number(req.params.sourceId));
  return sendSuccess(res, rows, { total: rows.length });
}

async function listQualitySourceColumns(req, res) {
  const rows = await service.listQualitySourceColumns(Number(req.params.sourceId), req.params.tableName);
  return sendSuccess(res, rows, { total: rows.length });
}

async function previewDictionarySourceRows(req, res) {
  const result = await service.previewDictionarySourceRows(req.validatedBody);
  return sendSuccess(res, result);
}

async function createQualitySource(req, res) {
  const row = await service.createQualitySource(req.validatedBody, req.user);
  return sendSuccess(res, row);
}

async function updateQualitySource(req, res) {
  const row = await service.updateQualitySource(Number(req.params.sourceId), req.validatedBody, req.user);
  return sendSuccess(res, row);
}

async function deleteQualitySource(req, res) {
  const data = await service.deleteQualitySource(Number(req.params.sourceId));
  return sendSuccess(res, data);
}

async function getQualitySourceMonitor(req, res) {
  const data = await service.getQualitySourceMonitor(Number(req.params.sourceId));
  return sendSuccess(res, data);
}

async function saveQualitySourceMonitor(req, res) {
  const data = await service.saveQualitySourceMonitor(Number(req.params.sourceId), req.validatedBody, req.user);
  return sendSuccess(res, data);
}

async function syncQualitySourceTables(req, res) {
  const data = await service.syncQualitySourceTables(Number(req.params.sourceId));
  return sendSuccess(res, data);
}

async function listAiConfigs(req, res) {
  const rows = await service.listAiConfigs();
  return sendSuccess(res, rows, { total: rows.length });
}

async function listAiConfigVersions(req, res) {
  const rows = await service.listAiConfigVersions(Number(req.params.id));
  return sendSuccess(res, rows, { total: rows.length });
}

async function updateAiConfig(req, res) {
  const row = await service.updateAiConfig(Number(req.params.id), req.validatedBody, req.user);
  return sendSuccess(res, row);
}

async function listRegexRules(req, res) {
  const rows = await service.listRegexRules();
  return sendSuccess(res, rows, { total: rows.length });
}

async function analyzeRegexRule(req, res) {
  const row = await service.analyzeRegexRule(req.validatedBody);
  return sendSuccess(res, row);
}

async function saveRegexRule(req, res) {
  const row = await service.saveRegexRule(req.validatedBody, req.user);
  return sendSuccess(res, row);
}

async function deleteRegexRule(req, res) {
  await service.deleteRegexRule(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function listDictionaries(req, res) {
  const rows = await service.listDictionaries();
  return sendSuccess(res, rows, { total: rows.length });
}

async function getDictionaryDetail(req, res) {
  const row = await service.getDictionaryDetail(Number(req.params.id));
  return sendSuccess(res, row);
}

async function saveDictionary(req, res) {
  const row = await service.saveDictionary(req.validatedBody, req.user);
  return sendSuccess(res, row);
}

async function analyzeDictionaryTable(req, res) {
  const result = await service.analyzeDictionaryTable(req.validatedBody);
  return sendSuccess(res, result);
}

async function batchSaveDictionaries(req, res) {
  const rows = await service.batchSaveDictionaries(req.validatedBody, req.user);
  return sendSuccess(res, rows, { total: rows.length });
}

async function batchDeleteDictionaries(req, res) {
  return sendSuccess(res, await service.batchDeleteDictionaries(req.validatedBody.ids));
}

async function deleteDictionary(req, res) {
  await service.deleteDictionary(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function listDictionaryBusinessSystems(req, res) {
  const rows = await service.listDictionaryBusinessSystems();
  return sendSuccess(res, rows, { total: rows.length });
}

async function previewDictionaryValues(req, res) {
  const result = await service.previewDictionaryValues(req.validatedBody);
  return sendSuccess(res, result);
}

async function listSubmittedStrategyOptions(req, res) {
  const rows = await service.listSubmittedStrategyOptions();
  return sendSuccess(res, rows, { total: rows.length });
}

async function listTasks(req, res) {
  const rows = await service.listTasks(req.query);
  return sendSuccess(res, rows, { total: rows.length });
}

async function getTaskDetail(req, res) {
  const row = await service.getTaskDetail(Number(req.params.id));
  return sendSuccess(res, row);
}

async function createTask(req, res) {
  const row = await service.createTask(req.validatedBody, req.user);
  return sendSuccess(res, row, null, 201);
}

async function updateTask(req, res) {
  const row = await service.updateTask(Number(req.params.id), req.validatedBody, req.user);
  return sendSuccess(res, row);
}

async function deleteTask(req, res) {
  const row = await service.deleteTask(Number(req.params.id));
  return sendSuccess(res, row);
}

async function startTask(req, res) {
  const row = await service.startTask(Number(req.params.id));
  return sendSuccess(res, row);
}

async function stopTask(req, res) {
  const row = await service.stopTask(Number(req.params.id));
  return sendSuccess(res, row);
}

async function runTaskNow(req, res) {
  const row = await service.runTaskNow(Number(req.params.id));
  return sendSuccess(res, row);
}

async function listTaskRuns(req, res) {
  const rows = await service.listTaskRuns(Number(req.params.id), Number(req.query.limit || 50));
  return sendSuccess(res, rows, { total: rows.length });
}

async function previewTaskSql(req, res) {
  const taskId = req.params.id ? Number(req.params.id) : null;
  const row = await service.previewTaskSql(req.validatedBody, taskId, req.user);
  return sendSuccess(res, row);
}

async function listStrategyTables(req, res) {
  const rows = await service.listStrategyTables({
    sourceId: req.query.sourceId,
    strategyStatus: req.query.strategyStatus,
    businessSystemId: req.query.businessSystemId,
    keyword: req.query.keyword,
  });
  return sendSuccess(res, rows, { total: rows.length });
}

async function deleteStrategyTable(req, res) {
  const row = await service.deleteStrategyTable(Number(req.params.monitorTableId));
  return sendSuccess(res, row);
}

async function getStrategyDetail(req, res) {
  const data = await service.getStrategyDetail(Number(req.params.monitorTableId));
  return sendSuccess(res, data);
}

async function recommendStrategy(req, res) {
  const data = await service.recommendStrategy(Number(req.params.monitorTableId), req.validatedBody);
  return sendSuccess(res, data);
}

async function startRecommendation(req, res) {
  const data = await service.startRecommendation(Number(req.params.monitorTableId), req.validatedBody);
  return sendSuccess(res, data, undefined, 202);
}

async function getRecommendationRun(req, res) {
  const data = await service.getRecommendationRun(Number(req.params.monitorTableId), Number(req.params.runId));
  return sendSuccess(res, data);
}

async function applyRecommendationRun(req, res) {
  const data = await service.applyRecommendationRun(Number(req.params.monitorTableId), Number(req.params.runId), req.validatedBody, req.user);
  return sendSuccess(res, data);
}

async function rejectRecommendationRun(req, res) {
  const data = await service.rejectRecommendationRun(Number(req.params.monitorTableId), Number(req.params.runId), req.user);
  return sendSuccess(res, data);
}

async function saveStrategyDraft(req, res) {
  const data = await service.saveStrategyDraft(Number(req.params.monitorTableId), req.validatedBody, req.user);
  return sendSuccess(res, data);
}

async function submitStrategy(req, res) {
  const data = await service.submitStrategy(Number(req.params.monitorTableId), req.validatedBody, req.user);
  return sendSuccess(res, data);
}

async function listStrategyVersions(req, res) {
  const rows = await service.listStrategyVersions(Number(req.params.monitorTableId));
  return sendSuccess(res, rows, { total: rows.length });
}

async function deleteStrategyVersion(req, res) {
  const data = await service.deleteStrategyVersion(Number(req.params.monitorTableId), Number(req.params.versionId));
  return sendSuccess(res, data);
}

async function getStrategyVersionSql(req, res) {
  const data = await service.getStrategyVersionSql(Number(req.params.versionId));
  return sendSuccess(res, data);
}

async function getAnalysisOverview(req, res) {
  const data = await service.getAnalysisOverview(Number(req.params.sourceId), req.query);
  return sendSuccess(res, data);
}

async function listAnalysisStats(req, res) {
  const data = await service.listAnalysisStats(Number(req.params.sourceId), req.query);
  return sendSuccess(res, data.rows, { total: data.rows.length, exists: data.exists });
}

async function listAnalysisDetails(req, res) {
  const data = await service.listAnalysisDetails(Number(req.params.sourceId), req.query);
  return sendSuccess(res, data.rows, { total: data.rows.length, exists: data.exists });
}

async function deleteAnalysisTableResults(req, res) {
  const data = await service.deleteAnalysisTableResults(Number(req.params.sourceId), String(req.params.tableName || ""));
  return sendSuccess(res, data);
}

async function getQualityInsightsOverview(req, res) { return sendSuccess(res, await analytics.getOverview(req.query)); }
async function getQualityOpsDashboard(req, res) { return sendSuccess(res, await analytics.getOpsDashboard(req.query)); }
async function getQualityOpsDrilldown(req, res) { return sendSuccess(res, await analytics.getOpsDrilldown(req.query)); }
async function listQualitySystemInsights(req, res) { const data = await analytics.listSystemQuality(req.query); return sendSuccess(res, data, { total: data.length }); }
async function listQualityTableInsights(req, res) { const data = await analytics.listTableQuality(req.query); return sendSuccess(res, data, { total: data.length }); }
async function listQualityTableBatches(req, res) { const data = await analytics.listTableBatches(req.query); return sendSuccess(res, data, { total: data.length }); }
async function compareQualityBatches(req, res) { return sendSuccess(res, await analytics.compareBatches(req.query)); }
async function getQualityObservability(req, res) { return sendSuccess(res, await analytics.getObservability(req.query)); }
async function listQualityTags(req, res) { const data = await analytics.listTags(); return sendSuccess(res, data, { total: data.length }); }
async function listQualityBusinessSystems(req, res) { const data = await analytics.listBusinessSystems(); return sendSuccess(res, data, { total: data.length }); }
async function saveQualityTag(req, res) { return sendSuccess(res, await analytics.saveTag(req.body || {}, req.user)); }
async function updateMonitorTableGovernance(req, res) { return sendSuccess(res, await analytics.updateTableGovernance(Number(req.params.monitorTableId), req.body || {}, req.user)); }
async function getQualityReportCenterOverview(req, res) { return sendSuccess(res, await analytics.getReportCenterOverview()); }
async function listQualityReportComparisonOptions(req, res) { const data = await analytics.listReportComparisonOptions(req.query); return sendSuccess(res, data, { total: data.length }); }
async function previewQualityReportComparison(req, res) { return sendSuccess(res, await analytics.previewReportComparison(req.body || {})); }
async function createQualityReport(req, res) { return sendSuccess(res, await analytics.createReport(req.body || {}, req.user), null, 201); }
async function listQualityReports(req, res) { const data = await analytics.listReports(req.query); return sendSuccess(res, data, { total: data.length }); }
async function getQualityReportDetail(req, res) { return sendSuccess(res, await analytics.getReportDetail(Number(req.params.id))); }
function setDownloadFileName(res, fileName, fallback) {
  const utf8FileName = encodeURIComponent(fileName || fallback);
  let asciiFallback = String(fileName || fallback).replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  if (!/[A-Za-z0-9]/.test(asciiFallback.replace(/\.[^.]+$/, ""))) asciiFallback = fallback;
  res.setHeader("Content-Disposition", `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8FileName}`);
}
async function downloadQualityReportMarkdown(req, res) {
  const payload = await analytics.downloadReportMarkdown(Number(req.params.id));
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  setDownloadFileName(res, payload.fileName, "quality_report.md");
  return res.send(payload.content);
}
async function downloadQualityReportWord(req, res) {
  const payload = await analytics.downloadReportWord(Number(req.params.id));
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  setDownloadFileName(res, payload.fileName, "quality_report.docx");
  return res.send(payload.buffer);
}
async function deleteQualityReport(req, res) { return sendSuccess(res, await analytics.deleteReport(Number(req.params.id))); }
async function listQualityFindings(req, res) { const data = await analytics.listFindings(req.query); return sendSuccess(res, data, { total: data.length }); }
async function listQualityAssignableUsers(req, res) { const data = await analytics.listAssignableUsers(); return sendSuccess(res, data, { total: data.length }); }
async function reviewQualityFinding(req, res) { return sendSuccess(res, await analytics.reviewFinding(Number(req.params.id), req.body || {}, req.user)); }
async function listQualityIssues(req, res) { const data = await analytics.listIssues(req.query, req.user); return sendSuccess(res, data, { total: data.length }); }
async function getQualityIssueDetail(req, res) { return sendSuccess(res, await analytics.getIssueDetail(Number(req.params.id), req.user)); }
async function updateQualityIssueStatus(req, res) { return sendSuccess(res, await analytics.updateIssueStatus(Number(req.params.id), req.body || {}, req.user)); }
async function materializeQualityFindings(req, res) { return sendSuccess(res, await analytics.materializeFindings()); }
async function runQualityAiAnalysis(req, res) { return sendSuccess(res, await analytics.runAiAnalysis(req.body || {})); }
async function queryQualityOpsRobot(req, res) { return sendSuccess(res, await analytics.queryOpsRobot(req.body || {}, req.user)); }
async function listQualityOpsRobotSessions(req, res) { return sendSuccess(res, await analytics.listOpsRobotSessions(req.user)); }
async function getQualityOpsRobotSessionMessages(req, res) { return sendSuccess(res, await analytics.getOpsRobotSessionMessages(Number(req.params.id), req.user)); }

module.exports = {
  listQualitySources,
  listQualitySourceTables,
  listQualitySourceColumns,
  previewDictionarySourceRows,
  createQualitySource,
  updateQualitySource,
  deleteQualitySource,
  getQualitySourceMonitor,
  saveQualitySourceMonitor,
  syncQualitySourceTables,
  listAiConfigs,
  listAiConfigVersions,
  updateAiConfig,
  listRegexRules,
  analyzeRegexRule,
  saveRegexRule,
  deleteRegexRule,
  listDictionaries,
  getDictionaryDetail,
  saveDictionary,
  analyzeDictionaryTable,
  batchSaveDictionaries,
  batchDeleteDictionaries,
  deleteDictionary,
  listDictionaryBusinessSystems,
  previewDictionaryValues,
  listSubmittedStrategyOptions,
  listTasks,
  getTaskDetail,
  createTask,
  updateTask,
  deleteTask,
  startTask,
  stopTask,
  runTaskNow,
  listTaskRuns,
  previewTaskSql,
  listStrategyTables,
  deleteStrategyTable,
  getStrategyDetail,
  recommendStrategy,
  startRecommendation,
  getRecommendationRun,
  applyRecommendationRun,
  rejectRecommendationRun,
  saveStrategyDraft,
  submitStrategy,
  listStrategyVersions,
  deleteStrategyVersion,
  getStrategyVersionSql,
  getAnalysisOverview,
  listAnalysisStats,
  listAnalysisDetails,
  deleteAnalysisTableResults,
  getQualityInsightsOverview,
  getQualityOpsDashboard,
  getQualityOpsDrilldown,
  listQualitySystemInsights,
  listQualityTableInsights,
  listQualityTableBatches,
  compareQualityBatches,
  getQualityObservability,
  listQualityTags,
  listQualityBusinessSystems,
  saveQualityTag,
  updateMonitorTableGovernance,
  getQualityReportCenterOverview,
  listQualityReportComparisonOptions,
  previewQualityReportComparison,
  createQualityReport,
  listQualityReports,
  getQualityReportDetail,
  downloadQualityReportMarkdown,
  downloadQualityReportWord,
  deleteQualityReport,
  listQualityFindings,
  listQualityAssignableUsers,
  reviewQualityFinding,
  listQualityIssues,
  getQualityIssueDetail,
  updateQualityIssueStatus,
  materializeQualityFindings,
  runQualityAiAnalysis,
  queryQualityOpsRobot,
  listQualityOpsRobotSessions,
  getQualityOpsRobotSessionMessages,
};
