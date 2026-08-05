const { sendSuccess } = require("../../common/utils/response");
const service = require("./data-source-research.service");

async function createResearchTask(req, res) {
  const result = await service.createResearchTask(req.validatedBody, req.user);
  return sendSuccess(res, result, null, 201);
}

async function listResearchTasks(req, res) {
  const rows = await service.listResearchTasks(req.query || {});
  return sendSuccess(res, rows, { total: rows.length });
}

async function getResearchTask(req, res) {
  const row = await service.getResearchTask(Number(req.params.taskId));
  return sendSuccess(res, row);
}

async function updateResearchTask(req, res) {
  const row = await service.updateResearchTask(Number(req.params.taskId), req.validatedBody, req.user);
  return sendSuccess(res, row);
}

async function deleteResearchTask(req, res) {
  const result = await service.deleteResearchTask(Number(req.params.taskId));
  return sendSuccess(res, result);
}

async function createResearchTaskRun(req, res) {
  const result = await service.createResearchTaskRun(Number(req.params.taskId), req.user);
  return sendSuccess(res, result, null, 201);
}

async function listResearchTaskRuns(req, res) {
  const rows = await service.listResearchTaskRuns(Number(req.params.taskId));
  return sendSuccess(res, rows, { total: rows.length });
}

async function compareResearchReports(req, res) {
  const result = await service.compareResearchReports(Number(req.params.taskId), req.validatedBody, req.user);
  return sendSuccess(res, result, null, 201);
}

async function listResearchComparisons(req, res) {
  const rows = await service.listResearchComparisons(Number(req.params.taskId));
  return sendSuccess(res, rows, { total: rows.length });
}

async function getResearchComparison(req, res) {
  const row = await service.getResearchComparison(Number(req.params.comparisonId));
  return sendSuccess(res, row);
}

async function createResearchRun(req, res) {
  const result = await service.createResearchRun(Number(req.params.sourceId), req.validatedBody, req.user);
  return sendSuccess(res, result, null, 201);
}

async function listResearchRuns(req, res) {
  const rows = await service.listResearchRuns(Number(req.params.sourceId));
  return sendSuccess(res, rows, { total: rows.length });
}

async function getResearchRun(req, res) {
  const row = await service.getResearchRun(Number(req.params.runId));
  return sendSuccess(res, row);
}

async function listResearchLogs(req, res) {
  const rows = await service.listResearchLogs(Number(req.params.runId));
  return sendSuccess(res, rows, { total: rows.length });
}

async function getResearchReport(req, res) {
  const report = await service.getResearchReport(Number(req.params.runId));
  return sendSuccess(res, report);
}

async function downloadResearchReportWord(req, res) {
  const payload = await service.downloadResearchReportWord(Number(req.params.runId));
  const utf8FileName = encodeURIComponent(payload.fileName || "data_source_research_report.docx");
  let asciiFallbackFileName = String(payload.fileName || "data_source_research_report.docx")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  const asciiFallbackBaseName = asciiFallbackFileName.replace(/\.[^.]+$/, "");
  if (!/[A-Za-z0-9]/.test(asciiFallbackBaseName)) {
    asciiFallbackFileName = "data_source_research_report.docx";
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${asciiFallbackFileName}"; filename*=UTF-8''${utf8FileName}`);
  return res.send(payload.buffer);
}

async function deleteResearchRun(req, res) {
  const result = await service.deleteResearchRun(Number(req.params.runId));
  return sendSuccess(res, result);
}

async function terminateResearchRun(req, res) {
  const result = await service.terminateResearchRun(Number(req.params.runId));
  return sendSuccess(res, result);
}

module.exports = {
  createResearchTask,
  listResearchTasks,
  getResearchTask,
  updateResearchTask,
  deleteResearchTask,
  createResearchTaskRun,
  listResearchTaskRuns,
  compareResearchReports,
  listResearchComparisons,
  getResearchComparison,
  createResearchRun,
  listResearchRuns,
  getResearchRun,
  listResearchLogs,
  getResearchReport,
  downloadResearchReportWord,
  deleteResearchRun,
  terminateResearchRun
};
