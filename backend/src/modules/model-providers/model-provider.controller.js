const { sendSuccess } = require("../../common/utils/response");
const service = require("./model-provider.service");

async function listModelProviders(req, res) {
  const rows = await service.listModelProviders();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createModelProvider(req, res) {
  const row = await service.createModelProvider(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateModelProvider(req, res) {
  const row = await service.updateModelProvider(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function deleteModelProvider(req, res) {
  await service.deleteModelProvider(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function testModelProvider(req, res) {
  const result = await service.testModelProvider(req.validatedBody);
  return sendSuccess(res, result);
}

module.exports = {
  listModelProviders,
  createModelProvider,
  updateModelProvider,
  deleteModelProvider,
  testModelProvider
};
