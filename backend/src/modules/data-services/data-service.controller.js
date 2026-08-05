const { sendSuccess } = require("../../common/utils/response");
const service = require("./data-service.service");

async function getOverview(req, res) {
  const data = await service.getOverview();
  return sendSuccess(res, data);
}

async function getOpsDashboard(req, res) {
  const data = await service.getOpsDashboard();
  return sendSuccess(res, data);
}

async function listServiceDataSources(req, res) {
  const rows = await service.listServiceDataSources();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createServiceDataSource(req, res) {
  const row = await service.createServiceDataSource(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateServiceDataSource(req, res) {
  const row = await service.updateServiceDataSource(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function deleteServiceDataSource(req, res) {
  const result = await service.deleteServiceDataSource(Number(req.params.id));
  return sendSuccess(res, result);
}

async function testServiceDataSourceConnection(req, res) {
  const result = await service.testServiceDataSourceConnection(req.validatedBody);
  return sendSuccess(res, result);
}

async function listServiceDataSourceTables(req, res) {
  const rows = await service.listServiceDataSourceTables(Number(req.params.id));
  return sendSuccess(res, rows, { total: rows.length });
}

async function listServiceDataSourceColumns(req, res) {
  const rows = await service.listServiceDataSourceColumns(Number(req.params.id), req.params.tableName);
  return sendSuccess(res, rows, { total: rows.length });
}

async function sampleServiceDataSourceRows(req, res) {
  const rows = await service.sampleServiceDataSourceRows(Number(req.params.id), req.params.tableName, req.query.limit);
  return sendSuccess(res, rows, { total: rows.length });
}

async function previewServiceSql(req, res) {
  const data = await service.previewServiceSql(req.validatedBody.sourceId, req.validatedBody.sql);
  return sendSuccess(res, data);
}

async function listServices(req, res) {
  const rows = await service.listServices();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createService(req, res) {
  const row = await service.createService(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateService(req, res) {
  const row = await service.updateService(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function updateServiceStatus(req, res) {
  const row = await service.updateServiceStatus(Number(req.params.id), req.validatedBody.status);
  return sendSuccess(res, row);
}

async function deleteService(req, res) {
  const result = await service.deleteService(Number(req.params.id));
  return sendSuccess(res, result);
}

async function debugService(req, res) {
  const result = await service.debugService(Number(req.params.id), req.body || {});
  return sendSuccess(res, result);
}

async function exportServiceInterfaceDoc(req, res) {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const defaultBaseUrl = host ? `${protocol}://${host}` : "";
  const payload = await service.exportServiceInterfaceDoc(Number(req.params.id), {
    baseUrl: req.query.baseUrl ? String(req.query.baseUrl) : defaultBaseUrl,
  });
  const utf8FileName = encodeURIComponent(payload.fileName || "service_api_doc.docx");
  let asciiFallbackFileName = String(payload.fileName || "service_api_doc.docx")
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/"/g, "");
  if (!asciiFallbackFileName) {
    asciiFallbackFileName = "service_api_doc.docx";
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiFallbackFileName}"; filename*=UTF-8''${utf8FileName}`
  );
  return res.send(payload.buffer);
}

async function recommendServiceConfig(req, res) {
  const result = await service.recommendServiceConfig(req.validatedBody);
  return sendSuccess(res, result);
}

async function listServiceAiConfigs(req, res) {
  const rows = await service.listServiceAiConfigs();
  return sendSuccess(res, rows, { total: rows.length });
}

async function updateServiceAiConfig(req, res) {
  const row = await service.updateServiceAiConfig(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function listServiceApps(req, res) {
  const rows = await service.listServiceApps();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createServiceApp(req, res) {
  const row = await service.createServiceApp(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateServiceApp(req, res) {
  const row = await service.updateServiceApp(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function deleteServiceApp(req, res) {
  const result = await service.deleteServiceApp(Number(req.params.id));
  return sendSuccess(res, result);
}

async function listAuthorizations(req, res) {
  const rows = await service.listAuthorizations();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createAuthorization(req, res) {
  const row = await service.createAuthorization(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateAuthorization(req, res) {
  const row = await service.updateAuthorization(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function deleteAuthorization(req, res) {
  const result = await service.deleteAuthorization(Number(req.params.id));
  return sendSuccess(res, result);
}

async function listServiceLogs(req, res) {
  const rows = await service.listServiceLogs({
    serviceId: req.query.serviceId ? Number(req.query.serviceId) : undefined,
    appId: req.query.appId ? Number(req.query.appId) : undefined,
    departmentName: req.query.departmentName ? String(req.query.departmentName) : undefined,
    startAt: req.query.startAt ? String(req.query.startAt) : undefined,
    endAt: req.query.endAt ? String(req.query.endAt) : undefined,
    paramsKeyword: req.query.paramsKeyword ? String(req.query.paramsKeyword) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  return sendSuccess(res, rows, { total: rows.length });
}

module.exports = {
  createAuthorization,
  createService,
  createServiceApp,
  createServiceDataSource,
  deleteAuthorization,
  deleteService,
  deleteServiceDataSource,
  deleteServiceApp,
  debugService,
  exportServiceInterfaceDoc,
  getOverview,
  getOpsDashboard,
  listAuthorizations,
  listServiceAiConfigs,
  listServiceDataSourceColumns,
  listServiceDataSourceTables,
  listServiceDataSources,
  listServiceApps,
  listServiceLogs,
  listServices,
  previewServiceSql,
  recommendServiceConfig,
  sampleServiceDataSourceRows,
  testServiceDataSourceConnection,
  updateAuthorization,
  updateServiceStatus,
  updateService,
  updateServiceAiConfig,
  updateServiceApp,
  updateServiceDataSource,
};
