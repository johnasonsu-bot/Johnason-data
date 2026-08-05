const { sendSuccess } = require("../../common/utils/response");
const service = require("./ingestion-ai-config.service");

async function listConfigs(req, res) {
  const rows = await service.listConfigs();
  return sendSuccess(res, rows, { total: rows.length });
}

async function updateConfig(req, res) {
  const row = await service.updateConfig(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

module.exports = {
  listConfigs,
  updateConfig
};
