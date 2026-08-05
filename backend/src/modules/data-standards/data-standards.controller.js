const { sendSuccess } = require("../../common/utils/response");
const service = require("./data-standards.service");
const excelService = require("./data-standards.excel.service");

function excelResponse(res, buffer, fileName) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  return res.send(buffer);
}

async function downloadImportTemplate(req, res) {
  const type = req.query?.type || "bundle";
  return excelResponse(res, excelService.buildWorkbook(type), `数据标准批量注册模板_${type}.xlsx`);
}

async function exportStandards(req, res) {
  const type = req.query?.type || "bundle";
  return excelResponse(res, await excelService.buildExport(type), `数据标准导出_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function previewImport(req, res) {
  return sendSuccess(res, await excelService.previewImport(req.file, req.body || {}));
}

async function commitImport(req, res) {
  return sendSuccess(res, await excelService.commitImport(req.file, req.body || {}, req.user || {}));
}

async function listImportBatches(req, res) {
  const rows = await excelService.listImportBatches();
  return sendSuccess(res, rows, { total: rows.length });
}

async function downloadImportErrors(req, res) {
  return excelResponse(res, await excelService.buildErrorWorkbook(Number(req.params.id)), `数据标准导入错误_${req.params.id}.xlsx`);
}

async function getOverview(req, res) {
  return sendSuccess(res, await service.getOverview());
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

async function listReferenceStandards(req, res) {
  const rows = await service.listReferenceStandards(req.query || {});
  return sendSuccess(res, rows, { total: rows.length });
}

async function createReferenceStandard(req, res) {
  return sendSuccess(res, await service.createReferenceStandard(req.validatedBody, req.user), null, 201);
}

async function updateReferenceStandard(req, res) {
  return sendSuccess(res, await service.updateReferenceStandard(Number(req.params.id), req.validatedBody));
}

async function deleteReferenceStandard(req, res) {
  await service.deleteReferenceStandard(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function listValueDomains(req, res) {
  const rows = await service.listValueDomains(req.query || {});
  return sendSuccess(res, rows, { total: rows.length });
}

async function getValueDomainDetail(req, res) {
  return sendSuccess(res, await service.getValueDomainDetail(Number(req.params.id)));
}

async function createValueDomain(req, res) {
  return sendSuccess(res, await service.createValueDomain(req.validatedBody, req.user), null, 201);
}

async function updateValueDomain(req, res) {
  return sendSuccess(res, await service.updateValueDomain(Number(req.params.id), req.validatedBody));
}

async function deleteValueDomain(req, res) {
  await service.deleteValueDomain(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function listDataElements(req, res) {
  const rows = await service.listDataElements(req.query || {});
  return sendSuccess(res, rows, { total: rows.length });
}

async function getDataElementDetail(req, res) {
  return sendSuccess(res, await service.getDataElementDetail(Number(req.params.id)));
}

async function createDataElement(req, res) {
  return sendSuccess(res, await service.createDataElement(req.validatedBody, req.user), null, 201);
}

async function updateDataElement(req, res) {
  return sendSuccess(res, await service.updateDataElement(Number(req.params.id), req.validatedBody));
}

async function publishDataElement(req, res) {
  return sendSuccess(res, await service.publishDataElement(Number(req.params.id), req.validatedBody, req.user));
}

async function deleteDataElement(req, res) {
  await service.deleteDataElement(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function listFieldMappings(req, res) {
  const rows = await service.listFieldMappings(req.query || {});
  return sendSuccess(res, rows, { total: rows.length });
}

async function listAiConfigs(req, res) {
  const rows = await service.listAiConfigs();
  return sendSuccess(res, rows, { total: rows.length });
}

async function updateAiConfig(req, res) {
  return sendSuccess(res, await service.updateAiConfig(Number(req.params.id), req.validatedBody));
}

async function suggestDataElements(req, res) {
  return sendSuccess(res, await service.suggestDataElements(req.validatedBody, req.user));
}

module.exports = {
  commitImport,
  createCatalog,
  createDataElement,
  createReferenceStandard,
  createValueDomain,
  deleteCatalog,
  deleteDataElement,
  deleteReferenceStandard,
  deleteValueDomain,
  downloadImportErrors,
  downloadImportTemplate,
  exportStandards,
  getDataElementDetail,
  getOverview,
  getValueDomainDetail,
  listAiConfigs,
  listCatalogTree,
  listCatalogs,
  listDataElements,
  listFieldMappings,
  listImportBatches,
  listReferenceStandards,
  listValueDomains,
  publishDataElement,
  previewImport,
  suggestDataElements,
  updateAiConfig,
  updateCatalog,
  updateDataElement,
  updateReferenceStandard,
  updateValueDomain,
};
