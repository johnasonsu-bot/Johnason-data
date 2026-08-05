const AppError = require("../../common/errors/app-error");
const { sendSuccess } = require("../../common/utils/response");
const service = require("./file-import.service");

function parseConfigField(rawValue) {
  if (!rawValue) {
    return {};
  }
  if (typeof rawValue === "object") {
    return rawValue;
  }
  try {
    return JSON.parse(rawValue);
  } catch (_error) {
    throw new AppError("配置参数不是合法 JSON", 400);
  }
}

async function previewFiles(req, res) {
  const config = parseConfigField(req.body?.config);
  const result = await service.previewFiles(req.files || [], config);
  return sendSuccess(res, result);
}

async function createTask(req, res) {
  const config = parseConfigField(req.body?.config);
  const result = await service.createTask(req.files || [], config, req.user, req.projectId);
  return sendSuccess(res, result, null, 201);
}

async function updateTask(req, res) {
  const result = await service.updateTask(Number(req.params.id), req.body || {}, req.user);
  return sendSuccess(res, result);
}

async function listTasks(req, res) {
  const result = await service.listTasks({
    page: req.query.page,
    pageSize: req.query.pageSize,
    status: req.query.status,
    targetSourceId: req.query.targetSourceId,
    keyword: req.query.keyword,
  });
  return sendSuccess(res, result.list, {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

async function getTask(req, res) {
  const result = await service.getTaskDetail(Number(req.params.id));
  return sendSuccess(res, result);
}

async function deleteTask(req, res) {
  await service.deleteTask(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function runTaskNow(req, res) {
  const result = await service.runTaskNow(Number(req.params.id));
  return sendSuccess(res, result);
}

async function cancelRun(req, res) {
  const result = await service.cancelRun(Number(req.params.id), Number(req.params.runId));
  return sendSuccess(res, result);
}

async function listRuns(req, res) {
  const result = await service.listRuns(Number(req.params.id), req.query.limit);
  return sendSuccess(res, result, { total: result.length });
}

async function listRunErrors(req, res) {
  const result = await service.listRunErrors(Number(req.params.id), Number(req.params.runId), {
    page: req.query.page,
    pageSize: req.query.pageSize,
    limit: req.query.limit,
  });
  return sendSuccess(res, result.list, {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

async function suggestTechnicalNames(req, res) {
  const result = await service.suggestTechnicalNames(req.validatedBody);
  return sendSuccess(res, result);
}

module.exports = {
  cancelRun,
  createTask,
  deleteTask,
  getTask,
  listRunErrors,
  listRuns,
  listTasks,
  previewFiles,
  runTaskNow,
  suggestTechnicalNames,
  updateTask,
};
