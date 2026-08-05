const { sendSuccess } = require("../../common/utils/response");
const service = require("./data-lab.service");
const enhancementService = require("./data-lab.enhancement");
const incubationService = require("./data-lab.incubation-runtime");
const scenarioManagementService = require("./scenario-management/scenario-management.service");
const aiBusinessDataService = require("./scenario-management/ai-business-data.service");
const scheduler = require("./data-lab.scheduler");

async function listKnowledgeBases(req, res) { return sendSuccess(res, await service.listKnowledgeBases()); }
async function getKnowledgeBaseDetail(req, res) { return sendSuccess(res, await service.getKnowledgeBaseDetail(Number(req.params.id))); }
async function createKnowledgeBase(req, res) { return sendSuccess(res, await service.createKnowledgeBase(req.validatedBody, req.user), null, 201); }
async function updateKnowledgeBase(req, res) { return sendSuccess(res, await service.updateKnowledgeBase(Number(req.params.id), req.validatedBody)); }
async function uploadKnowledgeDocument(req, res) { return sendSuccess(res, await service.uploadKnowledgeDocument({ kbId: Number(req.body.kbId), file: req.file }), null, 201); }
async function reparseKnowledgeDocument(req, res) { return sendSuccess(res, await service.reparseKnowledgeDocument(Number(req.params.docId))); }
async function deleteKnowledgeBase(req, res) { await service.deleteKnowledgeBase(Number(req.params.id)); return sendSuccess(res, { id: Number(req.params.id) }); }

async function listScenes(req, res) { return sendSuccess(res, await service.listScenes()); }
async function getSceneDetail(req, res) { return sendSuccess(res, await service.getSceneDetail(Number(req.params.id))); }
async function createScene(req, res) { return sendSuccess(res, await service.createScene(req.validatedBody, req.user), null, 201); }
async function updateScene(req, res) { return sendSuccess(res, await service.updateScene(req.validatedBody)); }
async function copyScene(req, res) { return sendSuccess(res, await service.copyScene(Number(req.params.id), req.user), null, 201); }
async function deleteScene(req, res) { return sendSuccess(res, await service.deleteScene(Number(req.params.id))); }

async function analyzeScene(req, res) { return sendSuccess(res, await service.analyzeScene(req.validatedBody), null, 201); }
async function generateSchema(req, res) { return sendSuccess(res, await service.generateSchema(req.validatedBody), null, 201); }
async function adjustSchema(req, res) { return sendSuccess(res, await service.adjustSchema(req.validatedBody), null, 201); }
async function saveSchema(req, res) { return sendSuccess(res, await service.saveSchema(req.validatedBody), null, 201); }
async function confirmSchema(req, res) { return sendSuccess(res, await service.confirmSchema(req.validatedBody)); }
async function deploySceneSchema(req, res) { return sendSuccess(res, await service.deploySceneSchema(req.validatedBody)); }
async function listSchemaVersions(req, res) { return sendSuccess(res, await service.listSchemaVersions(Number(req.params.sceneId))); }
async function getSchemaVersionDetail(req, res) { return sendSuccess(res, (await service.listSchemaVersions(Number(req.params.sceneId))).find((item) => item.id === Number(req.params.versionId)) || null); }

async function generateStrategy(req, res) { return sendSuccess(res, await service.generateStrategy(req.validatedBody), null, 201); }
async function adjustStrategy(req, res) { return sendSuccess(res, await service.adjustStrategy(req.validatedBody), null, 201); }
async function confirmStrategy(req, res) { return sendSuccess(res, await service.confirmStrategy(req.validatedBody)); }
async function listStrategyVersions(req, res) { return sendSuccess(res, await service.listStrategyVersions(Number(req.params.sceneId))); }
async function getSchemaVersionDiff(req, res) { return sendSuccess(res, await service.getSchemaVersionDiff(Number(req.params.sceneId), Number(req.query.fromVersionId), Number(req.query.toVersionId))); }
async function getStrategyVersionDiff(req, res) { return sendSuccess(res, await service.getStrategyVersionDiff(Number(req.params.sceneId), Number(req.query.fromVersionId), Number(req.query.toVersionId))); }
async function rollbackSchemaVersion(req, res) { return sendSuccess(res, await service.rollbackSchemaVersion(Number(req.body.sceneId), Number(req.body.versionId))); }
async function rollbackStrategyVersion(req, res) { return sendSuccess(res, await service.rollbackStrategyVersion(Number(req.body.sceneId), Number(req.body.versionId))); }

async function initScene(req, res) { return sendSuccess(res, await service.initializeScene(Number(req.params.id))); }
async function startSceneTask(req, res) {
  const result = await service.startSceneTask(Number(req.params.id));
  await scheduler.reloadSchedules();
  return sendSuccess(res, result);
}
async function stopSceneTask(req, res) {
  const result = await service.stopSceneTask(Number(req.params.id));
  await scheduler.reloadSchedules();
  return sendSuccess(res, result);
}
async function runSceneOnce(req, res) { return sendSuccess(res, await service.runSceneOnce(Number(req.params.id))); }
async function rerunFailedTasks(req, res) { return sendSuccess(res, await service.rerunFailedTasks(Number(req.params.id))); }
async function backfillScene(req, res) { return sendSuccess(res, await service.backfillScene(Number(req.params.id), req.validatedBody)); }
async function startRealtime(req, res) {
  const result = await service.startRealtime(Number(req.params.id));
  await scheduler.reloadSchedules();
  return sendSuccess(res, result);
}
async function stopRealtime(req, res) {
  const result = await service.stopRealtime(Number(req.params.id));
  await scheduler.reloadSchedules();
  return sendSuccess(res, result);
}

async function listTopics(req, res) { return sendSuccess(res, await service.listSceneTopics(Number(req.params.sceneId))); }
async function previewTopicMessages(req, res) { return sendSuccess(res, await service.previewTopicMessages(Number(req.query.sceneId), String(req.query.topicName || ""), Number(req.query.limit || 20))); }
async function createTopic(req, res) { return sendSuccess(res, await service.createSceneTopic(Number(req.body.sceneId), req.validatedBody), null, 201); }
async function deleteTopic(req, res) { return sendSuccess(res, await service.deleteSceneTopic(Number(req.body.sceneId), req.validatedBody.topicName)); }
async function getTopicMetrics(req, res) { return sendSuccess(res, await service.getTopicMetrics(Number(req.params.sceneId))); }

async function listSceneTables(req, res) { return sendSuccess(res, await service.listSceneBusinessTables(Number(req.params.sceneId))); }
async function previewSceneTableData(req, res) { return sendSuccess(res, await service.previewSceneTableData({ sceneId: Number(req.query.sceneId), tableName: String(req.query.tableName || ""), page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20), sortField: req.query.sortField ? String(req.query.sortField) : undefined, sortOrder: req.query.sortOrder ? String(req.query.sortOrder) : undefined })); }
async function exportSceneTableCsv(req, res) { return sendSuccess(res, await service.exportSceneTableCsv(Number(req.query.sceneId), String(req.query.tableName || ""))); }
async function reviewSceneRealism(req, res) { return sendSuccess(res, await service.reviewSceneRealism(Number(req.params.sceneId), req.validatedBody), null, 201); }
async function generateDirtyScript(req, res) { return sendSuccess(res, await service.generateDirtyScript(Number(req.params.sceneId), req.validatedBody), null, 201); }
async function getQualityReport(req, res) { return sendSuccess(res, await service.getQualityReport(Number(req.params.sceneId))); }
async function refreshQualityReport(req, res) { return sendSuccess(res, await service.rebuildQualityReport(Number(req.params.sceneId))); }
async function getRunLogs(req, res) { return sendSuccess(res, await service.getRunLogs(Number(req.params.sceneId))); }
async function getOpsDashboard(req, res) { return sendSuccess(res, await service.getOpsDashboard()); }

async function listLabModels(req, res) { return sendSuccess(res, await service.listLabModels()); }
async function saveLabModel(req, res) { return sendSuccess(res, await service.saveLabModel(req.validatedBody), null, req.validatedBody.id ? 200 : 201); }
async function deleteLabModel(req, res) { return sendSuccess(res, await service.deleteLabModel(Number(req.params.id))); }
async function setDefaultLabModel(req, res) { return sendSuccess(res, await service.setDefaultLabModel(Number(req.params.id))); }
async function debugLabModel(req, res) { return sendSuccess(res, await service.debugLabModel(req.validatedBody)); }
async function listPromptTemplates(req, res) { return sendSuccess(res, await service.listPromptTemplates()); }
async function savePromptTemplate(req, res) { return sendSuccess(res, await service.savePromptTemplate(req.validatedBody, req.user), null, req.validatedBody.id ? 200 : 201); }
async function savePromptTemplateDraft(req, res) { return sendSuccess(res, await service.savePromptTemplateDraft(req.validatedBody, req.user), null, 201); }
async function publishPromptTemplate(req, res) { return sendSuccess(res, await service.publishPromptTemplate(req.validatedBody, req.user), null, req.validatedBody.id ? 200 : 201); }
async function deletePromptTemplate(req, res) { return sendSuccess(res, await service.deletePromptTemplate(Number(req.params.id))); }
async function syncDefaultPromptTemplates(req, res) { return sendSuccess(res, await service.syncDefaultPromptTemplates()); }
async function listPromptTemplateVersions(req, res) { return sendSuccess(res, await service.listPromptTemplateVersions(String(req.params.promptType || ""))); }
async function debugPromptTemplate(req, res) { return sendSuccess(res, await service.debugPromptTemplate(req.validatedBody)); }
async function listSceneTemplates(req, res) { return sendSuccess(res, await service.listSceneTemplates()); }
async function saveSceneTemplate(req, res) { return sendSuccess(res, await service.saveSceneTemplate(req.validatedBody), null, req.validatedBody.id ? 200 : 201); }
async function deleteSceneTemplate(req, res) { return sendSuccess(res, await service.deleteSceneTemplate(Number(req.params.id))); }
async function listOperationLogs(req, res) { return sendSuccess(res, await service.listOperationLogs(req.query.sceneId ? Number(req.query.sceneId) : null)); }
async function listScenarioEnhancements(req, res) { return sendSuccess(res, await enhancementService.listScenarioEnhancements()); }
async function getScenarioEnhancementDetail(req, res) { return sendSuccess(res, await enhancementService.getScenarioEnhancementDetail(Number(req.params.id))); }
async function saveScenarioEnhancement(req, res) { return sendSuccess(res, await enhancementService.saveScenarioEnhancement(req.validatedBody, req.user), null, req.validatedBody.id ? 200 : 201); }
async function deleteScenarioEnhancement(req, res) { return sendSuccess(res, await enhancementService.deleteScenarioEnhancement(Number(req.params.id))); }
async function previewScenarioRecognition(req, res) { return sendSuccess(res, await enhancementService.previewScenarioRecognition(req.validatedBody)); }
async function exportScenarioEnhancement(req, res) {
  const payload = await enhancementService.exportScenarioEnhancementPackage(Number(req.params.id));
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${payload.profile.profileCode || `scenario_enhancement_${req.params.id}`}.json\"`);
  return res.send(JSON.stringify(payload, null, 2));
}
async function importScenarioEnhancement(req, res) {
  const rawText = req.file?.buffer?.toString("utf8") || req.body?.packageJson || "";
  let payload = req.body;
  if (rawText) {
    payload = JSON.parse(rawText);
  }
  return sendSuccess(res, await enhancementService.importScenarioEnhancementPackage(payload, req.user), null, 201);
}
async function listIndustryIncubations(req, res) { return sendSuccess(res, await incubationService.listIndustryIncubations()); }
async function getIndustryIncubationDetail(req, res) { return sendSuccess(res, await incubationService.getIndustryIncubationDetail(Number(req.params.id))); }
async function getIndustryIncubationStats(req, res) { return sendSuccess(res, await incubationService.getIndustryIncubationStats(Number(req.params.id))); }
async function listIndustryIncubationLogs(req, res) { return sendSuccess(res, await incubationService.listIndustryIncubationLogs(Number(req.params.id))); }
async function saveIndustryIncubation(req, res) { return sendSuccess(res, await incubationService.saveIndustryIncubation(req.validatedBody, req.user), null, req.validatedBody.id ? 200 : 201); }
async function deleteIndustryIncubation(req, res) { return sendSuccess(res, await incubationService.deleteIndustryIncubation(Number(req.params.id))); }
async function deleteIndustryCategory(req, res) { return sendSuccess(res, await incubationService.deleteIndustryCategory(Number(req.params.id), req.validatedBody || {}, req.user)); }
async function refreshIndustryMetadata(req, res) { return sendSuccess(res, await incubationService.refreshIndustryMetadata(Number(req.params.id), req.user)); }
async function startIndustryIncubationRun(req, res) { return sendSuccess(res, await incubationService.startIndustryIncubationRun(Number(req.params.id), req.validatedBody || {}, req.user)); }
async function stopIndustryIncubationRun(req, res) { return sendSuccess(res, await incubationService.stopIndustryIncubationRun(Number(req.params.id))); }
async function updateIndustryCategoryIteration(req, res) { return sendSuccess(res, await incubationService.updateIndustryCategoryIteration(Number(req.params.id), req.validatedBody || {})); }
async function generateIndustryIncubationRound(req, res) { return sendSuccess(res, await incubationService.generateIndustryIncubationRound(Number(req.body.incubationId), req.user), null, 201); }
async function updateIndustryIncubationRound(req, res) { return sendSuccess(res, await incubationService.updateIndustryIncubationRound(req.validatedBody)); }
async function syncIndustryIncubationToEnhancement(req, res) { return sendSuccess(res, await incubationService.syncIndustryIncubationToEnhancement(Number(req.params.id), req.user)); }
async function executeIndustryIncubationRound(req, res) { return sendSuccess(res, await incubationService.executeIndustryIncubationRound(Number(req.params.id), req.user)); }
async function rebuildIndustryIncubationDictionaryOwnership(req, res) { return sendSuccess(res, await incubationService.rebuildIndustryIncubationDictionaryOwnership(Number(req.params.id))); }
async function listBusinessSystemTemplates(req, res) { return sendSuccess(res, await scenarioManagementService.listBusinessSystemTemplates()); }
async function getBusinessSystemTemplateDetail(req, res) { return sendSuccess(res, await scenarioManagementService.getBusinessSystemTemplateDetail(Number(req.params.id))); }
async function startBusinessSystemTemplateBuildJob(req, res) { return sendSuccess(res, await scenarioManagementService.startBusinessSystemTemplateBuildJob(req.validatedBody, req.user), null, 201); }
async function getBusinessSystemTemplateBuildJob(req, res) { return sendSuccess(res, await scenarioManagementService.getBusinessSystemTemplateBuildJob(String(req.params.jobId || ""))); }
async function createBusinessSystemTemplate(req, res) { return sendSuccess(res, await scenarioManagementService.createBusinessSystemTemplate(req.validatedBody, req.user), null, 201); }
async function updateBusinessSystemTemplateBasic(req, res) { return sendSuccess(res, await scenarioManagementService.updateBusinessSystemTemplateBasic(Number(req.params.id), req.validatedBody)); }
async function deleteBusinessSystemTemplate(req, res) { return sendSuccess(res, await scenarioManagementService.deleteBusinessSystemTemplate(Number(req.params.id))); }
async function listBusinessSystemTemplateLogicalVersions(req, res) { return sendSuccess(res, await scenarioManagementService.listBusinessSystemTemplateLogicalVersions(Number(req.params.id))); }
async function saveBusinessSystemTemplateLogicalModel(req, res) { return sendSuccess(res, await scenarioManagementService.saveBusinessSystemTemplateLogicalModel(Number(req.params.id), req.validatedBody, req.user), null, 201); }
async function createBusinessSystemInstance(req, res) { return sendSuccess(res, await scenarioManagementService.createBusinessSystemInstance(req.validatedBody, req.user), null, 201); }
async function listBusinessSystemInstances(req, res) { return sendSuccess(res, await scenarioManagementService.listBusinessSystemInstances()); }
async function getBusinessSystemInstanceDetail(req, res) { return sendSuccess(res, await scenarioManagementService.getBusinessSystemInstanceDetail(Number(req.params.id))); }
async function deleteBusinessSystemInstance(req, res) { return sendSuccess(res, await scenarioManagementService.deleteBusinessSystemInstance(Number(req.params.id))); }
async function listIndustryDataSources(req, res) { return sendSuccess(res, await scenarioManagementService.listIndustryDataSources()); }
async function getIndustryDataSourceDetail(req, res) { return sendSuccess(res, await scenarioManagementService.getIndustryDataSourceDetail(Number(req.params.id))); }
async function getIndustryDataSourceSharedEntityDetail(req, res) { return sendSuccess(res, await scenarioManagementService.getIndustryDataSourceSharedEntityDetail(Number(req.params.id), String(req.params.entityId || ""))); }
async function createIndustryDataSource(req, res) { return sendSuccess(res, await scenarioManagementService.createIndustryDataSource(req.validatedBody, req.user), null, 201); }
async function deleteIndustryDataSource(req, res) { return sendSuccess(res, await scenarioManagementService.deleteIndustryDataSource(Number(req.params.id))); }
async function rebuildIndustryDataSourcePreview(req, res) { return sendSuccess(res, await scenarioManagementService.rebuildIndustryDataSourcePreview(Number(req.params.id))); }
async function listBusinessSystemInstancePhysicalVersions(req, res) { return sendSuccess(res, await scenarioManagementService.listBusinessSystemInstancePhysicalVersions(Number(req.params.id))); }
async function generateBusinessSystemInstancePhysicalModel(req, res) { return sendSuccess(res, await scenarioManagementService.generateBusinessSystemInstancePhysicalModel(Number(req.params.id), req.validatedBody || {}, req.user), null, 201); }
async function saveBusinessSystemInstancePhysicalModel(req, res) { return sendSuccess(res, await scenarioManagementService.saveBusinessSystemInstancePhysicalModel(Number(req.params.id), req.validatedBody || {}, req.user), null, 201); }
async function deleteBusinessSystemInstancePhysicalVersion(req, res) { return sendSuccess(res, await scenarioManagementService.deleteBusinessSystemInstancePhysicalVersion(Number(req.params.id), Number(req.params.versionId))); }
async function exportBusinessSystemInstancePhysicalDesignDoc(req, res) {
  const payload = await scenarioManagementService.exportBusinessSystemInstancePhysicalDesignDoc(Number(req.params.id), req.validatedBody || {});
  const utf8FileName = encodeURIComponent(payload.fileName || "数据库设计说明书摘要.docx");
  let asciiFallbackFileName = String(payload.fileName || "physical_design_doc_summary.docx")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  const asciiFallbackBaseName = asciiFallbackFileName.replace(/\.[^.]+$/, "");
  if (!/[A-Za-z0-9]/.test(asciiFallbackBaseName)) {
    asciiFallbackFileName = "physical_design_doc_summary.docx";
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${asciiFallbackFileName}"; filename*=UTF-8''${utf8FileName}`);
  return res.send(payload.buffer);
}
async function deployBusinessSystemInstancePhysicalModel(req, res) { return sendSuccess(res, await scenarioManagementService.deployBusinessSystemInstancePhysicalModel(Number(req.params.id), req.validatedBody || {}, req.user), null, 201); }
async function listBusinessSystemInstanceGenerationVersions(req, res) { return sendSuccess(res, await scenarioManagementService.listBusinessSystemInstanceGenerationVersions(Number(req.params.id))); }
async function generateBusinessSystemInstanceGenerationPlan(req, res) { return sendSuccess(res, await scenarioManagementService.generateBusinessSystemInstanceGenerationPlan(Number(req.params.id), req.validatedBody || {}, req.user), null, 201); }
async function deleteBusinessSystemInstanceGenerationVersion(req, res) { return sendSuccess(res, await scenarioManagementService.deleteBusinessSystemInstanceGenerationVersion(Number(req.params.id), Number(req.params.versionId))); }
async function listBusinessSystemInstanceDirtyVersions(req, res) { return sendSuccess(res, await scenarioManagementService.listBusinessSystemInstanceDirtyVersions(Number(req.params.id))); }
async function generateBusinessSystemInstanceDirtyData(req, res) { return sendSuccess(res, await scenarioManagementService.generateBusinessSystemInstanceDirtyData(Number(req.params.id), req.validatedBody || {}, req.user), null, 201); }
async function deleteBusinessSystemInstanceDirtyVersion(req, res) { return sendSuccess(res, await scenarioManagementService.deleteBusinessSystemInstanceDirtyVersion(Number(req.params.id), Number(req.params.versionId))); }
async function patchBusinessSystemDirtyDataVersion(req, res) { return sendSuccess(res, await scenarioManagementService.patchBusinessSystemDirtyDataVersion(Number(req.params.versionId), req.validatedBody || {}, req.user)); }
async function getBusinessSystemInstanceQualityReport(req, res) { return sendSuccess(res, await scenarioManagementService.getBusinessSystemInstanceQualityReport(Number(req.params.id))); }
async function rebuildBusinessSystemInstanceQualityReport(req, res) { return sendSuccess(res, await scenarioManagementService.rebuildBusinessSystemInstanceQualityReport(Number(req.params.id))); }
async function listAiBusinessDataPlans(req, res) { return sendSuccess(res, await aiBusinessDataService.listAiBusinessDataPlans(Number(req.params.id))); }
async function generateAiBusinessDataPlan(req, res) { return sendSuccess(res, await aiBusinessDataService.generateAiBusinessDataPlan(Number(req.params.id), req.validatedBody || {}, req.user), null, 201); }
async function listAiBusinessDataBatches(req, res) { return sendSuccess(res, await aiBusinessDataService.listAiBusinessDataBatches(Number(req.params.id))); }
async function generateAiBusinessDataBatch(req, res) { return sendSuccess(res, await aiBusinessDataService.generateAiBusinessDataBatch(Number(req.params.id), req.validatedBody || {}, req.user), null, 201); }
async function loadAiBusinessDataBatch(req, res) { return sendSuccess(res, await aiBusinessDataService.loadAiBusinessDataBatch(Number(req.params.id), Number(req.params.batchId), req.validatedBody || {}, req.user)); }
async function listAiBusinessDataTasks(req, res) { return sendSuccess(res, await aiBusinessDataService.listAiBusinessDataTasks({ instanceId: req.query.instanceId ? Number(req.query.instanceId) : null })); }
async function saveAiBusinessDataTask(req, res) {
  const task = await aiBusinessDataService.saveAiBusinessDataTask(req.validatedBody || {}, req.user);
  await scheduler.reloadAiBusinessDataTaskSchedules();
  return sendSuccess(res, task, null, req.validatedBody?.id ? 200 : 201);
}
async function updateAiBusinessDataTaskSchedule(req, res) {
  const task = await aiBusinessDataService.updateAiBusinessDataTaskSchedule(Number(req.params.taskId), req.validatedBody || {});
  await scheduler.reloadAiBusinessDataTaskSchedules();
  return sendSuccess(res, task);
}
async function deleteAiBusinessDataTask(req, res) {
  const result = await aiBusinessDataService.deleteAiBusinessDataTask(Number(req.params.taskId));
  await scheduler.reloadAiBusinessDataTaskSchedules();
  return sendSuccess(res, result);
}
async function runAiBusinessDataTask(req, res) { return sendSuccess(res, await aiBusinessDataService.runAiBusinessDataTask(Number(req.params.taskId), { triggerType: "manual" }, req.user), null, 201); }

module.exports = {
  listKnowledgeBases, getKnowledgeBaseDetail, createKnowledgeBase, updateKnowledgeBase, uploadKnowledgeDocument, reparseKnowledgeDocument, deleteKnowledgeBase,
  listScenes, getSceneDetail, createScene, updateScene, copyScene, deleteScene, analyzeScene,
  generateSchema, adjustSchema, saveSchema, confirmSchema, deploySceneSchema, listSchemaVersions, getSchemaVersionDetail,
  generateStrategy, adjustStrategy, confirmStrategy, listStrategyVersions, getSchemaVersionDiff, getStrategyVersionDiff, rollbackSchemaVersion, rollbackStrategyVersion,
  initScene, startSceneTask, stopSceneTask, runSceneOnce, rerunFailedTasks, backfillScene, startRealtime, stopRealtime,
  listTopics, previewTopicMessages, createTopic, deleteTopic, getTopicMetrics,
  listSceneTables, previewSceneTableData, exportSceneTableCsv, reviewSceneRealism, generateDirtyScript, getQualityReport, refreshQualityReport, getRunLogs, getOpsDashboard,
  listLabModels, saveLabModel, deleteLabModel, setDefaultLabModel, debugLabModel, listPromptTemplates, savePromptTemplate, savePromptTemplateDraft, publishPromptTemplate, deletePromptTemplate, syncDefaultPromptTemplates, listPromptTemplateVersions, debugPromptTemplate, listSceneTemplates, saveSceneTemplate, deleteSceneTemplate, listOperationLogs,
  listScenarioEnhancements, getScenarioEnhancementDetail, saveScenarioEnhancement, deleteScenarioEnhancement, previewScenarioRecognition, exportScenarioEnhancement, importScenarioEnhancement,
  listIndustryIncubations, getIndustryIncubationDetail, getIndustryIncubationStats, listIndustryIncubationLogs, saveIndustryIncubation, deleteIndustryIncubation, deleteIndustryCategory, refreshIndustryMetadata, startIndustryIncubationRun, stopIndustryIncubationRun, updateIndustryCategoryIteration, generateIndustryIncubationRound, updateIndustryIncubationRound, syncIndustryIncubationToEnhancement, executeIndustryIncubationRound, rebuildIndustryIncubationDictionaryOwnership,
  listBusinessSystemTemplates, getBusinessSystemTemplateDetail, startBusinessSystemTemplateBuildJob, getBusinessSystemTemplateBuildJob, createBusinessSystemTemplate, updateBusinessSystemTemplateBasic, deleteBusinessSystemTemplate, listBusinessSystemTemplateLogicalVersions, saveBusinessSystemTemplateLogicalModel,
  createBusinessSystemInstance, listBusinessSystemInstances, getBusinessSystemInstanceDetail, deleteBusinessSystemInstance, listIndustryDataSources, getIndustryDataSourceDetail, getIndustryDataSourceSharedEntityDetail, createIndustryDataSource, deleteIndustryDataSource, rebuildIndustryDataSourcePreview, listBusinessSystemInstancePhysicalVersions, generateBusinessSystemInstancePhysicalModel, saveBusinessSystemInstancePhysicalModel, deleteBusinessSystemInstancePhysicalVersion, exportBusinessSystemInstancePhysicalDesignDoc, deployBusinessSystemInstancePhysicalModel, listBusinessSystemInstanceGenerationVersions, generateBusinessSystemInstanceGenerationPlan, deleteBusinessSystemInstanceGenerationVersion, listBusinessSystemInstanceDirtyVersions, generateBusinessSystemInstanceDirtyData, deleteBusinessSystemInstanceDirtyVersion, patchBusinessSystemDirtyDataVersion, getBusinessSystemInstanceQualityReport, rebuildBusinessSystemInstanceQualityReport,
  listAiBusinessDataPlans, generateAiBusinessDataPlan, listAiBusinessDataBatches, generateAiBusinessDataBatch, loadAiBusinessDataBatch,
  listAiBusinessDataTasks, saveAiBusinessDataTask, updateAiBusinessDataTaskSchedule, deleteAiBusinessDataTask, runAiBusinessDataTask
};
