const { sendSuccess } = require("../../common/utils/response");
const service = require("./asset-search.service");

async function search(req, res) {
  return sendSuccess(res, await service.search(req.validatedBody, req.user));
}

async function businessDataSearch(req, res) {
  return sendSuccess(res, await service.businessDataSearch(req.validatedBody, req.user));
}

async function suggest(req, res) {
  const rows = await service.suggest(req.query || {}, req.user);
  return sendSuccess(res, rows, { total: rows.length });
}

async function facets(req, res) {
  return sendSuccess(res, await service.facets(req.query || {}, req.user));
}

async function feedback(req, res) {
  return sendSuccess(res, await service.feedback(req.validatedBody, req.user), null, 201);
}

async function listAiConfigs(req, res) {
  const rows = await service.listAiConfigs();
  return sendSuccess(res, rows, { total: rows.length });
}

async function updateAiConfig(req, res) {
  return sendSuccess(res, await service.updateAiConfig(Number(req.params.id), req.validatedBody));
}

async function listAiRuns(req, res) {
  const rows = await service.listAiRuns(req.query || {}, req.user);
  return sendSuccess(res, rows, { total: rows.length });
}

module.exports = {
  businessDataSearch,
  facets,
  feedback,
  listAiConfigs,
  listAiRuns,
  search,
  suggest,
  updateAiConfig,
};
