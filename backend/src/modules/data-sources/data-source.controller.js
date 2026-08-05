const { sendSuccess } = require("../../common/utils/response");
const service = require("./data-source.service");

async function listDataSources(req, res) {
  const sourceDomain = String(req.query.sourceDomain || "").trim() || undefined;
  const sourceIds = String(req.query.ids || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
  const rows = await service.listDataSources({
    sourceDomain,
    includeConnectivity: ["1", "true"].includes(String(req.query.includeConnectivity || "").toLowerCase()),
    sourceIds,
  });
  return sendSuccess(res, rows, { total: rows.length });
}

async function listReferencedTasks(req, res) {
  const rows = await service.listReferencedTasks(Number(req.params.id));
  return sendSuccess(res, rows, { total: rows.length });
}

async function createDataSource(req, res) {
  const row = await service.createDataSource(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateDataSource(req, res) {
  const row = await service.updateDataSource(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function deleteDataSource(req, res) {
  await service.deleteDataSource(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function testConnection(req, res) {
  const result = await service.testConnection(req.body);
  return sendSuccess(res, result);
}

async function listTables(req, res) {
  const rows = await service.listTables(Number(req.params.id), {
    includeDirectories: ["1", "true"].includes(String(req.query.includeDirectories || "").toLowerCase()),
  });
  return sendSuccess(res, rows, { total: rows.length });
}

async function listColumns(req, res) {
  const rows = await service.listColumns(Number(req.params.id), req.params.tableName);
  return sendSuccess(res, rows, { total: rows.length });
}

async function sampleRows(req, res) {
  const rows = await service.sampleRows(Number(req.params.id), req.params.tableName, req.query.limit);
  return sendSuccess(res, rows, { total: rows.length });
}

module.exports = {
  listDataSources,
  listReferencedTasks,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testConnection,
  listTables,
  listColumns,
  sampleRows
};
