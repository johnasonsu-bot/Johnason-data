const express = require("express");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const asyncHandler = require("../../common/utils/async-handler");
const { validateBody } = require("../../common/middleware/validate");
const controller = require("./data-development.controller");
const schema = require("./data-development.schema");

const router = express.Router();

router.use(authMiddleware, activationMiddleware);

router.post("/datasources/test", validateBody(schema.testDatasourceSchema), asyncHandler(controller.testDatasourceConfig));
router.get("/datasources", asyncHandler(controller.listDatasources));
router.get("/datasources/:id", asyncHandler(controller.getDatasource));
router.post("/datasources", validateBody(schema.createDatasourceSchema), asyncHandler(controller.createDatasource));
router.put("/datasources/:id", validateBody(schema.updateDatasourceSchema), asyncHandler(controller.updateDatasource));
router.delete("/datasources/:id", asyncHandler(controller.deleteDatasource));
router.post("/datasources/:id/test", asyncHandler(controller.testDatasource));
router.get("/datasources/:id/databases", asyncHandler(controller.listDatasourceDatabases));
router.get("/datasources/:id/tables", asyncHandler(controller.listDatasourceTables));
router.get("/datasources/:id/columns", asyncHandler(controller.listDatasourceColumns));
router.get("/datasources/:id/functions", asyncHandler(controller.listDatasourceFunctions));

router.get("/script-folders", asyncHandler(controller.listScriptFolders));
router.post("/script-folders", validateBody(schema.createScriptFolderSchema), asyncHandler(controller.createScriptFolder));
router.put("/script-folders/:id", validateBody(schema.updateScriptFolderSchema), asyncHandler(controller.updateScriptFolder));
router.delete("/script-folders/:id", asyncHandler(controller.deleteScriptFolder));

router.get("/scripts", asyncHandler(controller.listScripts));
router.get("/scripts/:id", asyncHandler(controller.getScript));
router.post("/scripts", validateBody(schema.createScriptSchema), asyncHandler(controller.createScript));
router.put("/scripts/:id", validateBody(schema.updateScriptSchema), asyncHandler(controller.updateScript));
router.delete("/scripts/:id", asyncHandler(controller.deleteScript));
router.post("/scripts/:id/save-version", asyncHandler(controller.saveScriptVersion));
router.get("/scripts/:id/versions", asyncHandler(controller.listScriptVersions));
router.post("/scripts/:id/save-as", validateBody(schema.createScriptSchema), asyncHandler(controller.saveScriptAs));

router.post("/queries/execute", validateBody(schema.executeQuerySchema), asyncHandler(controller.executeQuery));
router.get("/queries/history", asyncHandler(controller.listQueryHistory));
router.get("/copilot/sessions", asyncHandler(controller.listCopilotSessions));
router.get("/copilot/sessions/:id/messages", asyncHandler(controller.listCopilotSessionMessages));
router.post("/copilot/stream", validateBody(schema.copilotTaskSchema), asyncHandler(controller.runCopilotTaskStream));
router.post("/copilot", validateBody(schema.copilotTaskSchema), asyncHandler(controller.runCopilotTask));

router.get("/orchestrations", asyncHandler(controller.listOrchestrationTasks));
router.get("/orchestrations/:id", asyncHandler(controller.getOrchestrationTask));
router.post("/orchestrations", validateBody(schema.createOrchestrationTaskSchema), asyncHandler(controller.createOrchestrationTask));
router.put("/orchestrations/:id", validateBody(schema.updateOrchestrationTaskSchema), asyncHandler(controller.updateOrchestrationTask));
router.delete("/orchestrations/:id", asyncHandler(controller.deleteOrchestrationTask));
router.put("/orchestrations/:id/graph", validateBody(schema.orchestrationGraphSchema), asyncHandler(controller.saveOrchestrationGraph));
router.get("/orchestrations/:id/sql-preview", asyncHandler(controller.compileOrchestrationSql));
router.get("/orchestrations/:id/nodes/:nodeKey/preview", asyncHandler(controller.previewOrchestrationNode));
router.post("/orchestrations/:id/run", asyncHandler(controller.runOrchestration));

router.get("/operator-tasks", asyncHandler(controller.listOrchestrationTasks));
router.get("/operator-tasks/:id", asyncHandler(controller.getOrchestrationTask));
router.post("/operator-tasks", validateBody(schema.createOrchestrationTaskSchema), asyncHandler(controller.createOrchestrationTask));
router.put("/operator-tasks/:id", validateBody(schema.updateOrchestrationTaskSchema), asyncHandler(controller.updateOrchestrationTask));
router.delete("/operator-tasks/:id", asyncHandler(controller.deleteOrchestrationTask));
router.put("/operator-tasks/:id/graph", validateBody(schema.orchestrationGraphSchema), asyncHandler(controller.saveOrchestrationGraph));
router.get("/operator-tasks/:id/sql-preview", asyncHandler(controller.compileOrchestrationSql));
router.get("/operator-tasks/:id/nodes/:nodeKey/preview", asyncHandler(controller.previewOrchestrationNode));
router.post("/operator-tasks/:id/run", asyncHandler(controller.runOrchestration));

router.get("/processing/jobs", asyncHandler(controller.listProcessingJobs));
router.get("/processing/jobs/:id", asyncHandler(controller.getProcessingJob));
router.post("/processing/jobs/preview", validateBody(schema.previewProcessingJobSchema), asyncHandler(controller.previewProcessingJobDraft));
router.post("/processing/jobs", validateBody(schema.createProcessingJobSchema), asyncHandler(controller.createProcessingJob));
router.put("/processing/jobs/:id", validateBody(schema.updateProcessingJobSchema), asyncHandler(controller.updateProcessingJob));
router.delete("/processing/jobs/:id", asyncHandler(controller.deleteProcessingJob));
router.post("/processing/jobs/:id/preview", asyncHandler(controller.previewProcessingJob));
router.post("/processing/jobs/:id/run", validateBody(schema.runProcessingJobSchema), asyncHandler(controller.runProcessingJob));
router.get("/processing/jobs/:id/runs", asyncHandler(controller.listProcessingJobRuns));

router.get("/workflows", asyncHandler(controller.listWorkflows));
router.get("/workflows/:id", asyncHandler(controller.getWorkflow));
router.post("/workflows", validateBody(schema.createWorkflowSchema), asyncHandler(controller.createWorkflow));
router.post("/workflows/from-task", validateBody(schema.createWorkflowFromTaskSchema), asyncHandler(controller.createWorkflowFromTask));
router.put("/workflows/:id", validateBody(schema.updateWorkflowSchema), asyncHandler(controller.updateWorkflow));
router.delete("/workflows/:id", asyncHandler(controller.deleteWorkflow));
router.put("/workflows/:id/graph", validateBody(schema.workflowGraphSchema), asyncHandler(controller.saveWorkflowGraph));
router.post("/workflows/:id/validate", asyncHandler(controller.validateWorkflow));
router.post("/workflows/:id/run", validateBody(schema.runWorkflowSchema), asyncHandler(controller.runWorkflow));
router.get("/workflows/:id/runs", asyncHandler(controller.listWorkflowRuns));

router.get("/instances", asyncHandler(controller.listInstances));
router.get("/instances/:id", asyncHandler(controller.getInstance));
router.get("/instances/:id/logs", asyncHandler(controller.listInstanceLogs));

router.get("/scheduling/workflows", asyncHandler(controller.listWorkflows));
router.get("/scheduling/workflows/:id", asyncHandler(controller.getWorkflow));
router.post("/scheduling/workflows", validateBody(schema.createWorkflowSchema), asyncHandler(controller.createWorkflow));
router.post("/scheduling/workflows/from-task", validateBody(schema.createWorkflowFromTaskSchema), asyncHandler(controller.createWorkflowFromTask));
router.put("/scheduling/workflows/:id", validateBody(schema.updateWorkflowSchema), asyncHandler(controller.updateWorkflow));
router.delete("/scheduling/workflows/:id", asyncHandler(controller.deleteWorkflow));
router.put("/scheduling/workflows/:id/graph", validateBody(schema.workflowGraphSchema), asyncHandler(controller.saveWorkflowGraph));
router.post("/scheduling/workflows/:id/validate", asyncHandler(controller.validateWorkflow));
router.post("/scheduling/workflows/:id/run", validateBody(schema.runWorkflowSchema), asyncHandler(controller.runWorkflow));
router.get("/scheduling/workflows/:id/runs", asyncHandler(controller.listWorkflowRuns));
router.get("/scheduling/instances", asyncHandler(controller.listInstances));
router.get("/scheduling/instances/:id", asyncHandler(controller.getInstance));
router.get("/scheduling/instances/:id/logs", asyncHandler(controller.listInstanceLogs));

module.exports = router;
