const { sendSuccess } = require("../../common/utils/response");
const service = require("./ingestion-task.service");
const recommendationService = require("./ingestion-task.recommendation.service");
const apiDocumentParserService = require("./ingestion-api-document-parser.service");

async function listTasks(req, res) {
  const { status, syncMode, lastRunStatus, sourceId, keyword, page, pageSize } = req.query;

  const filters = {
    status,
    syncMode: syncMode ? String(syncMode).trim() : undefined,
    lastRunStatus: lastRunStatus ? String(lastRunStatus).trim() : undefined,
    sourceId: sourceId ? parseInt(sourceId, 10) : undefined,
    keyword: keyword ? String(keyword).trim() : undefined,
    page: page ? parseInt(page, 10) : 1,
    pageSize: pageSize ? parseInt(pageSize, 10) : 20
  };

  const result = await service.listTasks(filters);
  return sendSuccess(res, result.list, {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize
  });
}

async function getTask(req, res) {
  const task = await service.getTaskDetail(Number(req.params.id));
  return sendSuccess(res, task);
}

async function createTask(req, res) {
  const task = await service.createTask(req.validatedBody);
  return sendSuccess(res, task, null, 201);
}

async function updateTask(req, res) {
  const task = await service.updateTask(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, task);
}

async function deleteTask(req, res) {
  await service.deleteTask(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function startTask(req, res) {
  const task = await service.startTask(Number(req.params.id));
  return sendSuccess(res, task);
}

async function stopTask(req, res) {
  const task = await service.stopTask(Number(req.params.id));
  return sendSuccess(res, task);
}

async function runTaskNow(req, res) {
  const task = await service.runTaskNow(Number(req.params.id));
  return sendSuccess(res, task);
}

async function getJobRuns(req, res) {
  const { limit } = req.query;
  const runs = await service.getJobRuns(
    Number(req.params.id),
    limit ? parseInt(limit, 10) : undefined
  );
  return sendSuccess(res, runs, { total: runs.length });
}

async function getMonitorOverview(req, res) {
  const { pageSize, runLimit } = req.query;
  const data = await service.getMonitorOverview({
    pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    runLimit: runLimit ? parseInt(runLimit, 10) : undefined,
  });
  return sendSuccess(res, data);
}

async function recommendTaskConfig(req, res) {
  const result = await recommendationService.recommendTaskConfig(req.validatedBody);
  return sendSuccess(res, result);
}

async function parseApiDocument(req, res) {
  const result = await apiDocumentParserService.parseApiDocument({
    sourceId: req.body?.sourceId,
    inputText: req.body?.inputText,
    file: req.file,
  });
  return sendSuccess(res, result);
}

async function previewSourceData(req, res) {
  const result = await service.previewSourceData(req.validatedBody);
  return sendSuccess(res, result);
}

async function analyzeJobRunFailure(req, res) {
  const result = await service.analyzeJobRunFailure(
    Number(req.params.id),
    Number(req.params.runId),
    req.validatedBody
  );
  return sendSuccess(res, result);
}

module.exports = {
  listTasks,
  getMonitorOverview,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  startTask,
  stopTask,
  runTaskNow,
  getJobRuns,
  recommendTaskConfig,
  parseApiDocument,
  previewSourceData,
  analyzeJobRunFailure
};
