const { sendSuccess } = require("../../common/utils/response");
const service = require("./data-development.service");

async function listDatasources(req, res) {
  const rows = await service.listDatasources();
  return sendSuccess(res, rows, { total: rows.length });
}

async function getDatasource(req, res) {
  return sendSuccess(res, await service.getDatasource(Number(req.params.id)));
}

async function createDatasource(req, res) {
  return sendSuccess(res, await service.createDatasource(req.validatedBody), null, 201);
}

async function updateDatasource(req, res) {
  return sendSuccess(res, await service.updateDatasource(Number(req.params.id), req.validatedBody));
}

async function deleteDatasource(req, res) {
  await service.deleteDatasource(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function testDatasource(req, res) {
  return sendSuccess(res, await service.testDatasource(Number(req.params.id)));
}

async function testDatasourceConfig(req, res) {
  return sendSuccess(res, await service.testDatasourceConfig(req.validatedBody));
}

async function listDatasourceDatabases(req, res) {
  const rows = await service.listDatasourceDatabases(Number(req.params.id));
  return sendSuccess(res, rows, { total: rows.length });
}

async function listDatasourceTables(req, res) {
  const rows = await service.listDatasourceTables(Number(req.params.id), req.query.databaseName);
  return sendSuccess(res, rows, { total: rows.length });
}

async function listDatasourceColumns(req, res) {
  const rows = await service.listDatasourceColumns(Number(req.params.id), req.query.databaseName, req.query.tableName);
  return sendSuccess(res, rows, { total: rows.length });
}

async function listDatasourceFunctions(req, res) {
  const rows = await service.listDatasourceFunctions(Number(req.params.id), req.query.databaseName);
  return sendSuccess(res, rows, { total: rows.length });
}

async function listScriptFolders(req, res) {
  const rows = await service.listScriptFolders();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createScriptFolder(req, res) {
  return sendSuccess(res, await service.createScriptFolder(req.validatedBody), null, 201);
}

async function updateScriptFolder(req, res) {
  return sendSuccess(res, await service.updateScriptFolder(Number(req.params.id), req.validatedBody));
}

async function deleteScriptFolder(req, res) {
  await service.deleteScriptFolder(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function listScripts(req, res) {
  const rows = await service.listScripts(req.query);
  return sendSuccess(res, rows, { total: rows.length });
}

async function getScript(req, res) {
  return sendSuccess(res, await service.getScript(Number(req.params.id)));
}

async function createScript(req, res) {
  return sendSuccess(res, await service.createScript(req.validatedBody), null, 201);
}

async function updateScript(req, res) {
  return sendSuccess(res, await service.updateScript(Number(req.params.id), req.validatedBody));
}

async function deleteScript(req, res) {
  await service.deleteScript(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function saveScriptVersion(req, res) {
  return sendSuccess(res, await service.saveScriptVersion(Number(req.params.id)));
}

async function listScriptVersions(req, res) {
  const rows = await service.listScriptVersions(Number(req.params.id));
  return sendSuccess(res, rows, { total: rows.length });
}

async function saveScriptAs(req, res) {
  return sendSuccess(res, await service.saveScriptAs(Number(req.params.id), req.validatedBody), null, 201);
}

async function executeQuery(req, res) {
  return sendSuccess(res, await service.executeQuery(req.validatedBody));
}

async function listQueryHistory(req, res) {
  const rows = await service.listQueryHistory(req.query);
  return sendSuccess(res, rows, { total: rows.length });
}

async function runCopilotTask(req, res) {
  return sendSuccess(res, await service.runCopilotTask(req.validatedBody, req.user));
}

async function listCopilotSessions(req, res) {
  const rows = await service.listCopilotSessions(req.user, req.query);
  return sendSuccess(res, rows, { total: rows.length });
}

async function listCopilotSessionMessages(req, res) {
  return sendSuccess(res, await service.listCopilotSessionMessages(req.user, Number(req.params.id)));
}

async function runCopilotTaskStream(req, res) {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Connection", "keep-alive");

  const abortController = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    await service.runCopilotTaskStream(req.validatedBody, {
      user: req.user,
      signal: abortController.signal,
      write(event) {
        res.write(`${JSON.stringify(event)}\n`);
      },
    });
  } catch (error) {
    if (!abortController.signal.aborted && !res.writableEnded && !res.destroyed) {
      res.write(`${JSON.stringify({
        type: "error",
        message: error?.message || "智能辅助调用失败",
        details: error?.details || null,
      })}\n`);
    }
  } finally {
    if (!res.writableEnded && !res.destroyed) {
      res.end();
    }
  }
}

async function listWorkflows(req, res) {
  const rows = await service.listWorkflows();
  return sendSuccess(res, rows, { total: rows.length });
}

async function getWorkflow(req, res) {
  return sendSuccess(res, await service.getWorkflow(Number(req.params.id)));
}

async function listOrchestrationTasks(req, res) {
  const rows = await service.listOrchestrationTasks();
  return sendSuccess(res, rows, { total: rows.length });
}

async function getOrchestrationTask(req, res) {
  return sendSuccess(res, await service.getOrchestrationTask(Number(req.params.id)));
}

async function createOrchestrationTask(req, res) {
  return sendSuccess(res, await service.createOrchestrationTask(req.validatedBody), null, 201);
}

async function updateOrchestrationTask(req, res) {
  return sendSuccess(res, await service.updateOrchestrationTask(Number(req.params.id), req.validatedBody));
}

async function deleteOrchestrationTask(req, res) {
  await service.deleteOrchestrationTask(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function saveOrchestrationGraph(req, res) {
  return sendSuccess(res, await service.saveOrchestrationGraph(Number(req.params.id), req.validatedBody));
}

async function compileOrchestrationSql(req, res) {
  return sendSuccess(res, await service.compileOrchestrationSql(Number(req.params.id)));
}

async function previewOrchestrationNode(req, res) {
  return sendSuccess(
    res,
    await service.previewOrchestrationNode(Number(req.params.id), req.params.nodeKey, {
      limit: req.query.limit,
    })
  );
}

async function runOrchestration(req, res) {
  return sendSuccess(res, await service.runOrchestration(Number(req.params.id)), null, 202);
}

async function listProcessingJobs(req, res) {
  const rows = await service.listProcessingJobs(req.query || {});
  return sendSuccess(res, rows, { total: rows.length });
}

async function getProcessingJob(req, res) {
  return sendSuccess(res, await service.getProcessingJob(Number(req.params.id)));
}

async function createProcessingJob(req, res) {
  return sendSuccess(res, await service.createProcessingJob(req.validatedBody), null, 201);
}

async function updateProcessingJob(req, res) {
  return sendSuccess(res, await service.updateProcessingJob(Number(req.params.id), req.validatedBody));
}

async function deleteProcessingJob(req, res) {
  await service.deleteProcessingJob(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function previewProcessingJobDraft(req, res) {
  return sendSuccess(res, await service.previewProcessingJobDraft(req.validatedBody));
}

async function previewProcessingJob(req, res) {
  return sendSuccess(res, await service.previewProcessingJob(Number(req.params.id)));
}

async function runProcessingJob(req, res) {
  return sendSuccess(res, await service.runProcessingJob(Number(req.params.id), req.validatedBody || {}), null, 202);
}

async function listProcessingJobRuns(req, res) {
  const rows = await service.listProcessingJobRuns(Number(req.params.id));
  return sendSuccess(res, rows, { total: rows.length });
}

async function createWorkflow(req, res) {
  return sendSuccess(res, await service.createWorkflow(req.validatedBody), null, 201);
}

async function createWorkflowFromTask(req, res) {
  return sendSuccess(res, await service.createWorkflowFromTask(req.validatedBody), null, 201);
}

async function updateWorkflow(req, res) {
  return sendSuccess(res, await service.updateWorkflow(Number(req.params.id), req.validatedBody));
}

async function deleteWorkflow(req, res) {
  await service.deleteWorkflow(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function saveWorkflowGraph(req, res) {
  return sendSuccess(res, await service.saveWorkflowGraph(Number(req.params.id), req.validatedBody));
}

async function validateWorkflow(req, res) {
  return sendSuccess(res, await service.validateWorkflow(Number(req.params.id)));
}

async function runWorkflow(req, res) {
  return sendSuccess(res, await service.runWorkflow(Number(req.params.id), req.validatedBody || {}), null, 202);
}

async function listWorkflowRuns(req, res) {
  const rows = await service.listWorkflowRuns(Number(req.params.id));
  return sendSuccess(res, rows, { total: rows.length });
}

async function listInstances(req, res) {
  const rows = await service.listInstances(req.query);
  return sendSuccess(res, rows, { total: rows.length });
}

async function getInstance(req, res) {
  return sendSuccess(res, await service.getInstance(Number(req.params.id)));
}

async function listInstanceLogs(req, res) {
  const rows = await service.listInstanceLogs(Number(req.params.id));
  return sendSuccess(res, rows, { total: rows.length });
}

module.exports = {
  createOrchestrationTask,
  compileOrchestrationSql,
  previewOrchestrationNode,
  runOrchestration,
  createProcessingJob,
  deleteProcessingJob,
  getProcessingJob,
  listProcessingJobs,
  listProcessingJobRuns,
  previewProcessingJob,
  previewProcessingJobDraft,
  runProcessingJob,
  updateProcessingJob,
  createDatasource,
  createScript,
  createScriptFolder,
  createWorkflow,
  createWorkflowFromTask,
  deleteOrchestrationTask,
  deleteDatasource,
  deleteScript,
  deleteScriptFolder,
  deleteWorkflow,
  executeQuery,
  getDatasource,
  getInstance,
  getOrchestrationTask,
  getScript,
  getWorkflow,
  listDatasourceColumns,
  listDatasourceFunctions,
  listDatasourceDatabases,
  listDatasourceTables,
  listDatasources,
  listInstanceLogs,
  listInstances,
  listOrchestrationTasks,
  listQueryHistory,
  listCopilotSessionMessages,
  listCopilotSessions,
  runCopilotTask,
  runCopilotTaskStream,
  listScriptFolders,
  listScriptVersions,
  listScripts,
  listWorkflowRuns,
  listWorkflows,
  runWorkflow,
  saveOrchestrationGraph,
  saveScriptAs,
  saveScriptVersion,
  saveWorkflowGraph,
  testDatasource,
  testDatasourceConfig,
  updateOrchestrationTask,
  updateDatasource,
  updateScript,
  updateScriptFolder,
  updateWorkflow,
  validateWorkflow,
};
