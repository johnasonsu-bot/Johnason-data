const { sendSuccess } = require("../../common/utils/response");
const service = require("./reporting.service");

async function getOverview(req, res) {
  const data = await service.getOverview();
  return sendSuccess(res, data);
}

async function listReportDataSources(req, res) {
  const rows = await service.listReportDataSources();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createReportDataSource(req, res) {
  const row = await service.createReportDataSource(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateReportDataSource(req, res) {
  const row = await service.updateReportDataSource(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function deleteReportDataSource(req, res) {
  const data = await service.deleteReportDataSource(Number(req.params.id));
  return sendSuccess(res, data);
}

async function testReportDataSourceConnection(req, res) {
  const data = await service.testReportDataSourceConnection(req.validatedBody);
  return sendSuccess(res, data);
}

async function listReportDataSourceTables(req, res) {
  const rows = await service.listReportDataSourceTables(Number(req.params.id));
  return sendSuccess(res, rows, { total: rows.length });
}

async function listReportDataSourceColumns(req, res) {
  const rows = await service.listReportDataSourceColumns(Number(req.params.id), req.params.tableName);
  return sendSuccess(res, rows, { total: rows.length });
}

async function sampleReportDataSourceRows(req, res) {
  const rows = await service.sampleReportDataSourceRows(Number(req.params.id), req.params.tableName, req.query.limit);
  return sendSuccess(res, rows, { total: rows.length });
}

async function listReportDatasets(req, res) {
  const rows = await service.listReportDatasets();
  return sendSuccess(res, rows, { total: rows.length });
}

async function listReportDatasetFolders(req, res) {
  const rows = await service.listReportDatasetFolders();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createReportDatasetFolder(req, res) {
  const row = await service.createReportDatasetFolder(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateReportDatasetFolder(req, res) {
  const row = await service.updateReportDatasetFolder(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function deleteReportDatasetFolder(req, res) {
  const data = await service.deleteReportDatasetFolder(Number(req.params.id));
  return sendSuccess(res, data);
}

async function previewReportDataset(req, res) {
  const data = await service.previewReportDataset(req.validatedBody);
  return sendSuccess(res, data);
}

async function createReportDataset(req, res) {
  const row = await service.createReportDataset(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateReportDataset(req, res) {
  const row = await service.updateReportDataset(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function deleteReportDataset(req, res) {
  const data = await service.deleteReportDataset(Number(req.params.id));
  return sendSuccess(res, data);
}

async function listReportChartAssets(req, res) {
  const rows = await service.listReportChartAssets();
  return sendSuccess(res, rows, { total: rows.length });
}

async function listReportThemeTemplates(req, res) {
  const rows = await service.listReportThemeTemplates();
  return sendSuccess(res, rows, { total: rows.length });
}

async function listRuntimeReportThemeTemplates(req, res) {
  await service.ensureReportDashboardRuntimeAccess(Number(req.params.id), {
    shareToken: req.query.shareToken,
    user: req.user,
  });
  const rows = await service.listReportThemeTemplates();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createReportThemeTemplate(req, res) {
  const row = await service.createReportThemeTemplate(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateReportThemeTemplate(req, res) {
  const row = await service.updateReportThemeTemplate(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function deleteReportThemeTemplate(req, res) {
  const data = await service.deleteReportThemeTemplate(Number(req.params.id));
  return sendSuccess(res, data);
}

async function createReportChartAsset(req, res) {
  const row = await service.createReportChartAsset(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateReportChartAsset(req, res) {
  const row = await service.updateReportChartAsset(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function deleteReportChartAsset(req, res) {
  const data = await service.deleteReportChartAsset(Number(req.params.id));
  return sendSuccess(res, data);
}

async function listReportDashboards(req, res) {
  const rows = await service.listReportDashboards();
  return sendSuccess(res, rows, { total: rows.length });
}

async function getReportDashboard(req, res) {
  const row = await service.getReportDashboard(Number(req.params.id));
  return sendSuccess(res, row);
}

async function getReportDashboardRuntime(req, res) {
  const row = await service.getReportDashboardRuntime(Number(req.params.id), {
    shareToken: req.query.shareToken,
    user: req.user,
  });
  return sendSuccess(res, row);
}

async function createReportDashboard(req, res) {
  const row = await service.createReportDashboard(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateReportDashboard(req, res) {
  const row = await service.updateReportDashboard(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function publishReportDashboard(req, res) {
  const row = await service.publishReportDashboard(Number(req.params.id), req.body || {});
  return sendSuccess(res, row);
}

async function deleteReportDashboard(req, res) {
  const data = await service.deleteReportDashboard(Number(req.params.id));
  return sendSuccess(res, data);
}

async function previewDashboardChart(req, res) {
  const data = await service.previewDashboardChart(req.validatedBody);
  return sendSuccess(res, data);
}

async function previewRuntimeDashboardChart(req, res) {
  const data = await service.previewRuntimeDashboardChart(Number(req.params.id), req.validatedBody, {
    shareToken: req.query.shareToken,
    user: req.user,
  });
  return sendSuccess(res, data);
}

async function planAiChartSql(req, res) {
  const data = await service.planAiChartSql(req.validatedBody);
  return sendSuccess(res, data);
}

async function suggestAiChartAnalysis(req, res) {
  const data = await service.suggestAiChartAnalysis(req.validatedBody);
  return sendSuccess(res, data);
}

async function reviseAiChartSql(req, res) {
  const data = await service.reviseAiChartSql(req.validatedBody);
  return sendSuccess(res, data);
}

async function runAiChartQuery(req, res) {
  const data = await service.runAiChartQuery(req.validatedBody);
  return sendSuccess(res, data);
}

async function recommendAiChart(req, res) {
  const data = await service.recommendAiChart(req.validatedBody);
  return sendSuccess(res, data);
}

async function allocateAiChartFieldMap(req, res) {
  const data = await service.allocateAiChartFieldMap(req.validatedBody);
  return sendSuccess(res, data);
}

module.exports = {
  createReportChartAsset,
  createReportDashboard,
  createReportDataSource,
  createReportDataset,
  createReportDatasetFolder,
  createReportThemeTemplate,
  deleteReportChartAsset,
  deleteReportDashboard,
  deleteReportDataSource,
  deleteReportDataset,
  deleteReportDatasetFolder,
  deleteReportThemeTemplate,
  getOverview,
  getReportDashboard,
  getReportDashboardRuntime,
  listReportChartAssets,
  listReportDashboards,
  listReportDataSourceColumns,
  listReportDataSourceTables,
  listReportDataSources,
  listReportDatasets,
  listReportDatasetFolders,
  listReportThemeTemplates,
  listRuntimeReportThemeTemplates,
  allocateAiChartFieldMap,
  planAiChartSql,
  previewDashboardChart,
  previewRuntimeDashboardChart,
  previewReportDataset,
  recommendAiChart,
  reviseAiChartSql,
  runAiChartQuery,
  sampleReportDataSourceRows,
  suggestAiChartAnalysis,
  testReportDataSourceConnection,
  publishReportDashboard,
  updateReportChartAsset,
  updateReportDashboard,
  updateReportDataSource,
  updateReportDataset,
  updateReportDatasetFolder,
  updateReportThemeTemplate,
};
