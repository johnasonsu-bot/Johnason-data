const { sendSuccess } = require("../../common/utils/response");
const service = require("./data-map.service");

async function getOverview(req, res) {
  return sendSuccess(res, await service.getOverview());
}

async function listDepartments(req, res) {
  const rows = await service.listDepartments();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createDepartment(req, res) {
  return sendSuccess(res, await service.createDepartment(req.validatedBody, req.user), null, 201);
}

async function updateDepartment(req, res) {
  return sendSuccess(res, await service.updateDepartment(Number(req.params.id), req.validatedBody));
}

async function deleteDepartment(req, res) {
  await service.deleteDepartment(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function listBusinessSystems(req, res) {
  const rows = await service.listBusinessSystems();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createBusinessSystem(req, res) {
  return sendSuccess(res, await service.createBusinessSystem(req.validatedBody, req.user), null, 201);
}

async function updateBusinessSystem(req, res) {
  return sendSuccess(res, await service.updateBusinessSystem(Number(req.params.id), req.validatedBody));
}

async function deleteBusinessSystem(req, res) {
  await service.deleteBusinessSystem(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function listDataSources(req, res) {
  const rows = await service.listDataSources();
  return sendSuccess(res, rows, { total: rows.length });
}

async function listExternalDataSources(req, res) {
  const rows = await service.listExternalDataSources(req.query.module);
  return sendSuccess(res, rows, { total: rows.length });
}

async function createDataSource(req, res) {
  return sendSuccess(res, await service.createDataSource(req.validatedBody, req.user), null, 201);
}

async function updateDataSource(req, res) {
  return sendSuccess(res, await service.updateDataSource(Number(req.params.id), req.validatedBody));
}

async function deleteDataSource(req, res) {
  await service.deleteDataSource(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function testDataSource(req, res) {
  return sendSuccess(res, await service.testDataSource(req.validatedBody));
}

async function listDataSourceTables(req, res) {
  const rows = await service.listDataSourceTables(Number(req.params.id));
  return sendSuccess(res, rows, { total: rows.length });
}

async function listDataSourceColumns(req, res) {
  const rows = await service.listDataSourceColumns(Number(req.params.id), req.params.tableName);
  return sendSuccess(res, rows, { total: rows.length });
}

async function listCatalogs(req, res) {
  const rows = await service.listCatalogs();
  return sendSuccess(res, rows, { total: rows.length });
}

async function listCatalogTree(req, res) {
  const rows = await service.listCatalogTree();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createCatalog(req, res) {
  return sendSuccess(res, await service.createCatalog(req.validatedBody, req.user), null, 201);
}

async function updateCatalog(req, res) {
  return sendSuccess(res, await service.updateCatalog(Number(req.params.id), req.validatedBody));
}

async function deleteCatalog(req, res) {
  await service.deleteCatalog(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function registerResources(req, res) {
  const rows = await service.registerResources(Number(req.params.id), req.validatedBody, req.user);
  return sendSuccess(res, rows, { total: rows.length }, 201);
}

async function listResources(req, res) {
  const rows = await service.listResources(req.query || {});
  return sendSuccess(res, rows, { total: rows.length });
}

async function searchResources(req, res) {
  const rows = await service.searchResources(req.query || {});
  return sendSuccess(res, rows, { total: rows.length });
}

async function getResourceDetail(req, res) {
  return sendSuccess(res, await service.getResourceDetail(Number(req.params.id)));
}

async function updateResource(req, res) {
  return sendSuccess(res, await service.updateResource(Number(req.params.id), req.validatedBody));
}

async function updateResourceContent(req, res) {
  return sendSuccess(res, await service.updateResourceContent(Number(req.params.id), req.validatedBody, req.user));
}

async function updateResourceField(req, res) {
  return sendSuccess(res, await service.updateResourceFieldMetadata(Number(req.params.id), req.params.columnName, req.validatedBody, req.user));
}

async function getResourceProfile(req, res) {
  return sendSuccess(res, await service.getResourceProfile(Number(req.params.id)));
}

async function refreshResourceProfile(req, res) {
  return sendSuccess(res, await service.refreshResourceProfile(Number(req.params.id), req.validatedBody));
}

async function analyzeResourceProfile(req, res) {
  return sendSuccess(res, await service.analyzeResourceProfile(Number(req.params.id), req.validatedBody, req.user));
}

async function analyzeResourceContentProfile(req, res) {
  return sendSuccess(res, await service.analyzeResourceContentProfile(Number(req.params.id), req.validatedBody, req.user));
}

async function analyzeResourceFieldProfile(req, res) {
  return sendSuccess(res, await service.analyzeResourceFieldProfile(Number(req.params.id), req.validatedBody, req.user));
}

async function getResourceLineageGraph(req, res) {
  return sendSuccess(res, await service.getResourceLineageGraph(Number(req.params.id), req.query || {}));
}

async function deleteResource(req, res) {
  await service.deleteResource(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function deleteResources(req, res) {
  return sendSuccess(res, await service.deleteResources(req.validatedBody.ids));
}

async function sampleResourceRows(req, res) {
  const rows = await service.sampleResourceRows(Number(req.params.id), req.query.limit);
  return sendSuccess(res, rows, { total: rows.length });
}

async function refreshIngestionLineage(req, res) {
  return sendSuccess(res, await service.refreshIngestionLineage());
}

async function listAiConfigs(req, res) {
  const rows = await service.listAiConfigs();
  return sendSuccess(res, rows, { total: rows.length });
}

async function updateAiConfig(req, res) {
  return sendSuccess(res, await service.updateAiConfig(Number(req.params.id), req.validatedBody));
}

module.exports = {
  analyzeResourceContentProfile,
  analyzeResourceFieldProfile,
  analyzeResourceProfile,
  createBusinessSystem,
  createCatalog,
  createDataSource,
  createDepartment,
  deleteBusinessSystem,
  deleteCatalog,
  deleteDataSource,
  deleteDepartment,
  deleteResource,
  deleteResources,
  getOverview,
  getResourceDetail,
  getResourceLineageGraph,
  getResourceProfile,
  listAiConfigs,
  listBusinessSystems,
  listCatalogTree,
  listCatalogs,
  listDataSourceColumns,
  listDataSourceTables,
  listDataSources,
  listDepartments,
  listExternalDataSources,
  listResources,
  refreshIngestionLineage,
  registerResources,
  sampleResourceRows,
  searchResources,
  testDataSource,
  refreshResourceProfile,
  updateBusinessSystem,
  updateCatalog,
  updateDataSource,
  updateDepartment,
  updateAiConfig,
  updateResourceContent,
  updateResourceField,
  updateResource,
};
