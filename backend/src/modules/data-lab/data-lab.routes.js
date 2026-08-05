const express = require("express");
const multer = require("multer");
const authMiddleware = require("../../common/middleware/auth");
const activationMiddleware = require("../../common/middleware/activation");
const asyncHandler = require("../../common/utils/async-handler");
const { validateBody, z } = require("../../common/middleware/validate");
const controller = require("./data-lab.controller");
const { upload, knowledgeBaseSchema, sceneSchema, sceneAnalyzeSchema, schemaGenerateSchema, schemaAdjustSchema, schemaSaveSchema, schemaConfirmSchema, schemaDeploySchema, strategyGenerateSchema, strategyAdjustSchema, strategyConfirmSchema, realismReviewSchema, dirtyScriptSchema, topicSchema, deleteTopicSchema, modelProfileSchema } = require("./data-lab.schema");

const router = express.Router();
const enhancementImportUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const businessSystemTemplateStatusSchema = z.enum(["draft", "active", "archived"]);
const businessSystemTemplateSchema = z.object({
  templateName: z.string().min(2).max(128),
  templateCode: z.string().max(64).optional().nullable(),
  industryCode: z.string().max(64).optional().nullable(),
  templateDesc: z.string().max(1024).optional().nullable(),
  sourceIncubationId: z.coerce.number().int().positive().optional().nullable(),
  sourceCategoryCodes: z.array(z.string().min(1).max(128)).optional().default([]),
  templateStatus: businessSystemTemplateStatusSchema.optional().default("draft"),
});
const businessSystemTemplateUpdateSchema = z.object({
  templateName: z.string().min(2).max(128),
  templateCode: z.string().max(64).optional().nullable(),
  industryCode: z.string().max(64).optional().nullable(),
  templateDesc: z.string().max(1024).optional().nullable(),
  templateStatus: businessSystemTemplateStatusSchema.optional().default("draft"),
});
const businessSystemLogicalModelSaveSchema = z.object({
  logicalModel: z.record(z.any()),
  summary: z.string().max(1024).optional().nullable(),
});
const businessSystemInstanceStatusSchema = z.enum(["draft", "active", "archived"]);
const businessSystemInstanceCreateSchema = z.object({
  templateId: z.coerce.number().int().positive(),
  instanceName: z.string().min(2).max(128),
  instanceCode: z.string().max(64).optional().nullable(),
  dbType: z.enum(["mysql", "postgresql", "postgres"]).optional().default("mysql"),
  instanceStatus: businessSystemInstanceStatusSchema.optional().default("draft"),
  targetDataSourceId: z.coerce.number().int().positive().optional().nullable(),
});
const industryDataSourceStatusSchema = z.enum(["draft", "active", "archived"]);
const industryDataSourceThemeSchema = z.enum(["user", "merchant", "activity"]);
const industryDataSourceCreateSchema = z.object({
  dataSourceName: z.string().min(2).max(128),
  dataSourceCode: z.string().max(64).optional().nullable(),
  industryCode: z.string().max(64).optional().nullable(),
  dataSourceDesc: z.string().max(1024).optional().nullable(),
  sourceStatus: industryDataSourceStatusSchema.optional().default("draft"),
  selectedThemes: z.array(industryDataSourceThemeSchema).min(1).optional().default(["user", "merchant", "activity"]),
  instanceIds: z.array(z.coerce.number().int().positive()).min(2),
});
const businessSystemPhysicalModelGenerateSchema = z.object({
  targetDataSourceId: z.coerce.number().int().positive().optional().nullable(),
  dbType: z.enum(["mysql", "postgresql", "postgres"]).optional().nullable(),
  summary: z.string().max(1024).optional().nullable(),
});
const businessSystemPhysicalModelSaveSchema = z.object({
  physicalVersionNo: z.coerce.number().int().positive().optional().nullable(),
  physicalModel: z.record(z.any()),
  summary: z.string().max(1024).optional().nullable(),
});
const businessSystemPhysicalDesignDocSchema = z.object({
  physicalVersionNo: z.coerce.number().int().positive().optional().nullable(),
  dbType: z.enum(["mysql", "postgresql", "postgres"]).optional().nullable(),
  summary: z.string().max(1024).optional().nullable(),
});
const businessSystemPhysicalModelDeploySchema = z.object({
  physicalVersionNo: z.coerce.number().int().positive().optional().nullable(),
  targetDataSourceId: z.coerce.number().int().positive(),
  summary: z.string().max(1024).optional().nullable(),
});
const businessSystemGenerationPlanGenerateSchema = z.object({
  physicalVersionNo: z.coerce.number().int().positive().optional().nullable(),
  targetDataSourceId: z.coerce.number().int().positive().optional().nullable(),
  initialDataVolume: z.coerce.number().int().min(100).max(200000).optional(),
  incrementalDataVolume: z.coerce.number().int().min(0).max(100000).optional(),
  incrementCycleDays: z.coerce.number().int().min(1).max(365).optional(),
  sharedMasterSize: z.coerce.number().int().min(1).max(100000).optional(),
  businessMasterSize: z.coerce.number().int().min(1).max(100000).optional(),
  transactionScale: z.coerce.number().int().min(1).max(1000000).optional(),
  sampleRowsPerTable: z.coerce.number().int().min(1).max(20).optional(),
  timelineStartAt: z.string().max(64).optional().nullable(),
  timelineDays: z.coerce.number().int().min(1).max(3650).optional(),
  summary: z.string().max(1024).optional().nullable(),
});
const businessSystemDirtyDataGenerateSchema = z.object({
  generationVersionNo: z.coerce.number().int().positive().optional().nullable(),
  dirtyRatio: z.coerce.number().min(0.01).max(0.5).optional(),
  focusCategories: z.array(z.enum(["D1", "D2", "D3", "D4", "D5", "D6"])).optional().default([]),
  summary: z.string().max(1024).optional().nullable(),
});
const businessSystemDirtyDataPatchSchema = z.object({
  generationVersionNo: z.coerce.number().int().positive().optional().nullable(),
  dirtyRatio: z.coerce.number().min(0.01).max(0.5).optional(),
  focusCategories: z.array(z.enum(["D1", "D2", "D3", "D4", "D5", "D6"])).optional(),
  summary: z.string().max(1024).optional().nullable(),
});
const aiBusinessDataGenerationModeSchema = z.enum(["initial", "incremental"]);
const aiBusinessDataPlanGenerateSchema = z.object({
  physicalVersionNo: z.coerce.number().int().positive().optional().nullable(),
  targetDataSourceId: z.coerce.number().int().positive().optional().nullable(),
  generationMode: aiBusinessDataGenerationModeSchema.optional().default("initial"),
  totalRows: z.coerce.number().int().min(1).max(5000).optional(),
  batchRows: z.coerce.number().int().min(1).max(5000).optional(),
  timelineStartAt: z.string().max(64).optional().nullable(),
  timelineDays: z.coerce.number().int().min(1).max(3650).optional(),
  requirementText: z.string().max(4000).optional().nullable(),
  summary: z.string().max(1024).optional().nullable(),
});
const aiBusinessDataBatchGenerateSchema = z.object({
  planId: z.coerce.number().int().positive().optional().nullable(),
  physicalVersionNo: z.coerce.number().int().positive().optional().nullable(),
  targetDataSourceId: z.coerce.number().int().positive().optional().nullable(),
  generationMode: aiBusinessDataGenerationModeSchema.optional().default("incremental"),
  totalRows: z.coerce.number().int().min(1).max(5000).optional(),
  batchRows: z.coerce.number().int().min(1).max(5000).optional(),
  timelineStartAt: z.string().max(64).optional().nullable(),
  timelineDays: z.coerce.number().int().min(1).max(3650).optional(),
  requirementText: z.string().max(4000).optional().nullable(),
  summary: z.string().max(1024).optional().nullable(),
});
const aiBusinessDataBatchLoadSchema = z.object({
  targetDataSourceId: z.coerce.number().int().positive().optional().nullable(),
  loadMode: z.enum(["append", "replace"]).optional().default("append"),
});
const aiBusinessDataTaskSaveSchema = z.object({
  id: z.coerce.number().int().positive().optional().nullable(),
  taskName: z.string().min(1).max(128),
  instanceId: z.coerce.number().int().positive(),
  physicalVersionNo: z.coerce.number().int().positive(),
  targetDataSourceId: z.coerce.number().int().positive(),
  planId: z.coerce.number().int().positive().optional().nullable(),
  scheduleEnabled: z.boolean().optional().default(false),
  scheduleType: z.enum(["manual", "hourly", "daily", "weekly", "cron"]).optional().default("manual"),
  cronExpr: z.string().max(128).optional().nullable(),
  generationMode: aiBusinessDataGenerationModeSchema.optional().default("incremental"),
  totalRows: z.coerce.number().int().min(1).max(5000).optional(),
  batchRows: z.coerce.number().int().min(1).max(5000).optional(),
  timelineStartAt: z.string().max(64).optional().nullable(),
  timelineDays: z.coerce.number().int().min(1).max(3650).optional(),
  requirementText: z.string().max(4000).optional().nullable(),
  autoLoad: z.boolean().optional().default(false),
  loadMode: z.enum(["append", "replace"]).optional().default("append"),
});
const aiBusinessDataTaskScheduleSchema = z.object({
  scheduleEnabled: z.boolean().optional().default(false),
});

router.use(authMiddleware, activationMiddleware);

router.get("/kb/list", asyncHandler(controller.listKnowledgeBases));
router.get("/kb/detail/:id", asyncHandler(controller.getKnowledgeBaseDetail));
router.post("/kb/create", validateBody(knowledgeBaseSchema), asyncHandler(controller.createKnowledgeBase));
router.post("/kb/update/:id", validateBody(knowledgeBaseSchema), asyncHandler(controller.updateKnowledgeBase));
router.post("/kb/upload", upload.single("file"), asyncHandler(controller.uploadKnowledgeDocument));
router.post("/kb/doc/reparse/:docId", asyncHandler(controller.reparseKnowledgeDocument));
router.post("/kb/delete/:id", asyncHandler(controller.deleteKnowledgeBase));

router.get("/scene/list", asyncHandler(controller.listScenes));
router.get("/scene/detail/:id", asyncHandler(controller.getSceneDetail));
router.post("/scene/create", validateBody(sceneSchema), asyncHandler(controller.createScene));
router.post("/scene/update", validateBody(sceneSchema.extend({ id: z.coerce.number().int().positive() })), asyncHandler(controller.updateScene));
router.post("/scene/copy/:id", asyncHandler(controller.copyScene));
router.post("/scene/delete/:id", asyncHandler(controller.deleteScene));

router.post("/scene/analyze", validateBody(sceneAnalyzeSchema), asyncHandler(controller.analyzeScene));
router.post("/scene/schema/generate", validateBody(schemaGenerateSchema), asyncHandler(controller.generateSchema));
router.post("/scene/schema/adjust", validateBody(schemaAdjustSchema), asyncHandler(controller.adjustSchema));
router.post("/scene/schema/save", validateBody(schemaSaveSchema), asyncHandler(controller.saveSchema));
router.post("/scene/schema/confirm", validateBody(schemaConfirmSchema), asyncHandler(controller.confirmSchema));
router.post("/scene/schema/deploy", validateBody(schemaDeploySchema), asyncHandler(controller.deploySceneSchema));
router.get("/scene/schema/version/list/:sceneId", asyncHandler(controller.listSchemaVersions));
router.get("/scene/schema/version/detail/:sceneId/:versionId", asyncHandler(controller.getSchemaVersionDetail));
router.get("/scene/schema/version/diff/:sceneId", asyncHandler(controller.getSchemaVersionDiff));
router.post("/scene/schema/version/rollback", validateBody(z.object({ sceneId: z.coerce.number().int().positive(), versionId: z.coerce.number().int().positive() })), asyncHandler(controller.rollbackSchemaVersion));

router.post("/scene/strategy/generate", validateBody(strategyGenerateSchema), asyncHandler(controller.generateStrategy));
router.post("/scene/strategy/adjust", validateBody(strategyAdjustSchema), asyncHandler(controller.adjustStrategy));
router.post("/scene/strategy/confirm", validateBody(strategyConfirmSchema), asyncHandler(controller.confirmStrategy));
router.get("/scene/strategy/version/list/:sceneId", asyncHandler(controller.listStrategyVersions));
router.get("/scene/strategy/version/diff/:sceneId", asyncHandler(controller.getStrategyVersionDiff));
router.post("/scene/strategy/version/rollback", validateBody(z.object({ sceneId: z.coerce.number().int().positive(), versionId: z.coerce.number().int().positive() })), asyncHandler(controller.rollbackStrategyVersion));

router.post("/scene/init/:id", asyncHandler(controller.initScene));
router.post("/scene/task/start/:id", asyncHandler(controller.startSceneTask));
router.post("/scene/task/stop/:id", asyncHandler(controller.stopSceneTask));
router.post("/scene/task/runOnce/:id", asyncHandler(controller.runSceneOnce));
router.post("/scene/task/rerunFailed/:id", asyncHandler(controller.rerunFailedTasks));
router.post("/scene/backfill/:id", validateBody(z.object({ rows: z.coerce.number().int().min(1).max(100000).optional(), fromTime: z.string().max(64).optional().nullable(), toTime: z.string().max(64).optional().nullable() })), asyncHandler(controller.backfillScene));
router.post("/scene/realtime/start/:id", asyncHandler(controller.startRealtime));
router.post("/scene/realtime/stop/:id", asyncHandler(controller.stopRealtime));

router.get("/scene/topic/list/:sceneId", asyncHandler(controller.listTopics));
router.get("/scene/topic/message/preview", asyncHandler(controller.previewTopicMessages));
router.post("/scene/topic/create", validateBody(topicSchema), asyncHandler(controller.createTopic));
router.post("/scene/topic/delete", validateBody(deleteTopicSchema), asyncHandler(controller.deleteTopic));
router.get("/scene/topic/metrics/:sceneId", asyncHandler(controller.getTopicMetrics));

router.get("/scene/table/list/:sceneId", asyncHandler(controller.listSceneTables));
router.get("/scene/table/dataPreview", asyncHandler(controller.previewSceneTableData));
router.get("/scene/table/exportCsv", asyncHandler(controller.exportSceneTableCsv));
router.post("/scene/reviewRealism/:sceneId", validateBody(realismReviewSchema), asyncHandler(controller.reviewSceneRealism));
router.post("/scene/dirty/script/:sceneId", validateBody(dirtyScriptSchema), asyncHandler(controller.generateDirtyScript));
router.get("/scene/quality/report/:sceneId", asyncHandler(controller.getQualityReport));
router.post("/scene/quality/report/rebuild/:sceneId", asyncHandler(controller.refreshQualityReport));
router.get("/scene/run/log/:sceneId", asyncHandler(controller.getRunLogs));

router.get("/scenario-management/templates", asyncHandler(controller.listBusinessSystemTemplates));
router.post("/scenario-management/templates/build-jobs", validateBody(businessSystemTemplateSchema), asyncHandler(controller.startBusinessSystemTemplateBuildJob));
router.get("/scenario-management/templates/build-jobs/:jobId", asyncHandler(controller.getBusinessSystemTemplateBuildJob));
router.get("/scenario-management/templates/:id/logical-model/versions", asyncHandler(controller.listBusinessSystemTemplateLogicalVersions));
router.get("/scenario-management/templates/:id", asyncHandler(controller.getBusinessSystemTemplateDetail));
router.post("/scenario-management/templates", validateBody(businessSystemTemplateSchema), asyncHandler(controller.createBusinessSystemTemplate));
router.post("/scenario-management/templates/:id/update-basic", validateBody(businessSystemTemplateUpdateSchema), asyncHandler(controller.updateBusinessSystemTemplateBasic));
router.post("/scenario-management/templates/:id/delete", asyncHandler(controller.deleteBusinessSystemTemplate));
router.post("/scenario-management/templates/:id/logical-model/save", validateBody(businessSystemLogicalModelSaveSchema), asyncHandler(controller.saveBusinessSystemTemplateLogicalModel));
router.post("/scenario-management/instances", validateBody(businessSystemInstanceCreateSchema), asyncHandler(controller.createBusinessSystemInstance));
router.get("/scenario-management/instances", asyncHandler(controller.listBusinessSystemInstances));
router.get("/scenario-management/instances/:id", asyncHandler(controller.getBusinessSystemInstanceDetail));
router.post("/scenario-management/instances/:id/delete", asyncHandler(controller.deleteBusinessSystemInstance));
router.get("/scenario-management/data-sources", asyncHandler(controller.listIndustryDataSources));
router.get("/scenario-management/data-sources/:id", asyncHandler(controller.getIndustryDataSourceDetail));
router.get("/scenario-management/data-sources/:id/entities/:entityId", asyncHandler(controller.getIndustryDataSourceSharedEntityDetail));
router.post("/scenario-management/data-sources", validateBody(industryDataSourceCreateSchema), asyncHandler(controller.createIndustryDataSource));
router.post("/scenario-management/data-sources/:id/delete", asyncHandler(controller.deleteIndustryDataSource));
router.post("/scenario-management/data-sources/:id/rebuild-preview", asyncHandler(controller.rebuildIndustryDataSourcePreview));
router.get("/scenario-management/instances/:id/physical-model/versions", asyncHandler(controller.listBusinessSystemInstancePhysicalVersions));
router.post("/scenario-management/instances/:id/physical-model/generate", validateBody(businessSystemPhysicalModelGenerateSchema), asyncHandler(controller.generateBusinessSystemInstancePhysicalModel));
router.post("/scenario-management/instances/:id/physical-model/save", validateBody(businessSystemPhysicalModelSaveSchema), asyncHandler(controller.saveBusinessSystemInstancePhysicalModel));
router.post("/scenario-management/instances/:id/physical-model/versions/:versionId/delete", asyncHandler(controller.deleteBusinessSystemInstancePhysicalVersion));
router.post("/scenario-management/instances/:id/physical-model/design-doc", validateBody(businessSystemPhysicalDesignDocSchema), asyncHandler(controller.exportBusinessSystemInstancePhysicalDesignDoc));
router.post("/scenario-management/instances/:id/physical-model/deploy", validateBody(businessSystemPhysicalModelDeploySchema), asyncHandler(controller.deployBusinessSystemInstancePhysicalModel));
router.get("/scenario-management/instances/:id/generation-plan/versions", asyncHandler(controller.listBusinessSystemInstanceGenerationVersions));
router.post("/scenario-management/instances/:id/generation-plan/generate", validateBody(businessSystemGenerationPlanGenerateSchema), asyncHandler(controller.generateBusinessSystemInstanceGenerationPlan));
router.post("/scenario-management/instances/:id/generation-plan/versions/:versionId/delete", asyncHandler(controller.deleteBusinessSystemInstanceGenerationVersion));
router.get("/scenario-management/instances/:id/dirty-data/versions", asyncHandler(controller.listBusinessSystemInstanceDirtyVersions));
router.post("/scenario-management/instances/:id/dirty-data/generate", validateBody(businessSystemDirtyDataGenerateSchema), asyncHandler(controller.generateBusinessSystemInstanceDirtyData));
router.post("/scenario-management/instances/:id/dirty-data/versions/:versionId/delete", asyncHandler(controller.deleteBusinessSystemInstanceDirtyVersion));
router.post("/scenario-management/dirty-profiles/:versionId/patch", validateBody(businessSystemDirtyDataPatchSchema), asyncHandler(controller.patchBusinessSystemDirtyDataVersion));
router.get("/scenario-management/instances/:id/quality-report", asyncHandler(controller.getBusinessSystemInstanceQualityReport));
router.post("/scenario-management/instances/:id/quality-report/rebuild", asyncHandler(controller.rebuildBusinessSystemInstanceQualityReport));
router.get("/scenario-management/instances/:id/ai-business-data/plans", asyncHandler(controller.listAiBusinessDataPlans));
router.post("/scenario-management/instances/:id/ai-business-data/plans/generate", validateBody(aiBusinessDataPlanGenerateSchema), asyncHandler(controller.generateAiBusinessDataPlan));
router.get("/scenario-management/instances/:id/ai-business-data/batches", asyncHandler(controller.listAiBusinessDataBatches));
router.post("/scenario-management/instances/:id/ai-business-data/batches/generate", validateBody(aiBusinessDataBatchGenerateSchema), asyncHandler(controller.generateAiBusinessDataBatch));
router.post("/scenario-management/instances/:id/ai-business-data/batches/:batchId/load", validateBody(aiBusinessDataBatchLoadSchema), asyncHandler(controller.loadAiBusinessDataBatch));
router.get("/scenario-management/ai-business-data/tasks", asyncHandler(controller.listAiBusinessDataTasks));
router.post("/scenario-management/ai-business-data/tasks", validateBody(aiBusinessDataTaskSaveSchema), asyncHandler(controller.saveAiBusinessDataTask));
router.post("/scenario-management/ai-business-data/tasks/:taskId/schedule", validateBody(aiBusinessDataTaskScheduleSchema), asyncHandler(controller.updateAiBusinessDataTaskSchedule));
router.post("/scenario-management/ai-business-data/tasks/:taskId/run", asyncHandler(controller.runAiBusinessDataTask));
router.post("/scenario-management/ai-business-data/tasks/:taskId/delete", asyncHandler(controller.deleteAiBusinessDataTask));

router.get("/ops/dashboard", asyncHandler(controller.getOpsDashboard));

router.get("/model/list", asyncHandler(controller.listLabModels));
router.post("/model/save", validateBody(modelProfileSchema), asyncHandler(controller.saveLabModel));
router.post("/model/delete/:id", asyncHandler(controller.deleteLabModel));
router.post("/model/setDefault/:id", asyncHandler(controller.setDefaultLabModel));
router.post("/model/debug", validateBody(z.object({
  profileId: z.coerce.number().int().positive(),
  prompt: z.string().min(1).max(8000),
  systemPrompt: z.string().max(8000).optional().nullable(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  maxTokens: z.coerce.number().int().min(1).max(8000).optional(),
})), asyncHandler(controller.debugLabModel));
router.get("/prompt/list", asyncHandler(controller.listPromptTemplates));
router.post("/prompt/sync-defaults", asyncHandler(controller.syncDefaultPromptTemplates));
router.post("/prompt/save", validateBody(z.object({
  id: z.coerce.number().int().positive().optional(),
  promptType: z.string().min(2).max(32),
  templateName: z.string().min(2).max(128),
  templateCode: z.string().min(2).max(64),
  content: z.string().min(1).max(20000),
  userContent: z.string().min(1).max(20000).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  maxTokens: z.coerce.number().int().min(1).max(8000).optional(),
  defaultModelProviderId: z.coerce.number().int().positive().optional().nullable(),
  defaultModelName: z.string().max(128).optional().nullable(),
  defaultModelVersion: z.string().max(128).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
  status: z.enum(["active", "inactive"]).optional().default("active"),
})), asyncHandler(controller.savePromptTemplate));
router.post("/prompt/save-draft", validateBody(z.object({
  promptType: z.string().min(2).max(32),
  templateName: z.string().min(2).max(128),
  templateCode: z.string().min(2).max(64),
  content: z.string().min(1).max(20000),
  userContent: z.string().min(1).max(20000).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  maxTokens: z.coerce.number().int().min(1).max(8000).optional(),
  defaultModelProviderId: z.coerce.number().int().positive().optional().nullable(),
  defaultModelName: z.string().max(128).optional().nullable(),
  defaultModelVersion: z.string().max(128).optional().nullable(),
})), asyncHandler(controller.savePromptTemplateDraft));
router.post("/prompt/publish", validateBody(z.object({
  id: z.coerce.number().int().positive().optional(),
  promptType: z.string().min(2).max(32),
  templateName: z.string().min(2).max(128),
  templateCode: z.string().min(2).max(64),
  content: z.string().min(1).max(20000),
  userContent: z.string().min(1).max(20000).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  maxTokens: z.coerce.number().int().min(1).max(8000).optional(),
  defaultModelProviderId: z.coerce.number().int().positive().optional().nullable(),
  defaultModelName: z.string().max(128).optional().nullable(),
  defaultModelVersion: z.string().max(128).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
})), asyncHandler(controller.publishPromptTemplate));
router.post("/prompt/delete/:id", asyncHandler(controller.deletePromptTemplate));
router.get("/prompt/version/list/:promptType", asyncHandler(controller.listPromptTemplateVersions));
router.post("/prompt/debug", validateBody(z.object({
  promptType: z.string().min(2).max(32),
  modelProviderId: z.coerce.number().int().positive(),
  prompt: z.string().min(1).max(8000),
  systemPrompt: z.string().min(1).max(20000),
  temperature: z.coerce.number().min(0).max(2).optional(),
  maxTokens: z.coerce.number().int().min(1).max(8000).optional(),
})), asyncHandler(controller.debugPromptTemplate));
router.get("/template/list", asyncHandler(controller.listSceneTemplates));
router.post("/template/save", validateBody(z.object({
  id: z.coerce.number().int().positive().optional(),
  templateName: z.string().min(2).max(128),
  templateCode: z.string().min(2).max(64),
  category: z.string().max(64).optional().nullable(),
  sceneDesc: z.string().max(1024).optional().nullable(),
  schema: z.any(),
  strategy: z.any().optional().nullable(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
})), asyncHandler(controller.saveSceneTemplate));
router.post("/template/delete/:id", asyncHandler(controller.deleteSceneTemplate));
router.get("/operation/logs", asyncHandler(controller.listOperationLogs));
router.get("/enhancement/list", asyncHandler(controller.listScenarioEnhancements));
router.get("/enhancement/detail/:id", asyncHandler(controller.getScenarioEnhancementDetail));
router.post("/enhancement/save", validateBody(z.object({
  id: z.coerce.number().int().positive().optional(),
  profileName: z.string().min(2).max(128),
  profileCode: z.string().max(64).optional().nullable(),
  industry: z.string().min(2).max(32),
  subScenario: z.string().max(64).optional().nullable(),
  profileDesc: z.string().max(1024).optional().nullable(),
  locale: z.string().max(32).optional().nullable(),
  businessStyle: z.string().max(64).optional().nullable(),
  confidenceThreshold: z.coerce.number().min(0).max(1).optional().default(0.6),
  priority: z.coerce.number().int().min(0).max(9999).optional().default(100),
  status: z.enum(["draft", "active", "inactive"]).optional().default("draft"),
  isSystem: z.boolean().optional().default(false),
  sourceRefs: z.array(z.string().min(1).max(512)).optional().default([]),
  dictionaries: z.array(z.object({
    dictType: z.string().min(2).max(64),
    itemCode: z.string().min(1).max(64),
    itemLabel: z.string().min(1).max(128),
    itemValue: z.record(z.any()).optional().default({}),
    sourceRefs: z.array(z.string().min(1).max(512)).optional().default([]),
    weight: z.coerce.number().int().min(0).max(9999).optional().default(1),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
    status: z.enum(["active", "inactive"]).optional().default("active"),
  })).optional().default([]),
  distributionRules: z.array(z.object({
    ruleType: z.string().min(2).max(64),
    ruleName: z.string().min(2).max(128),
    ruleCode: z.string().min(2).max(64),
    ruleConfig: z.record(z.any()).optional().default({}),
    sourceRefs: z.array(z.string().min(1).max(512)).optional().default([]),
    status: z.enum(["active", "inactive"]).optional().default("active"),
  })).optional().default([]),
  fieldRules: z.array(z.object({
    tableName: z.string().max(128).optional().nullable().default(""),
    fieldName: z.string().min(1).max(128),
    generatorType: z.string().min(2).max(64),
    ruleConfig: z.record(z.any()).optional().default({}),
    sourceRefs: z.array(z.string().min(1).max(512)).optional().default([]),
    status: z.enum(["active", "inactive"]).optional().default("active"),
  })).optional().default([]),
  complianceRules: z.array(z.object({
    ruleCode: z.string().min(2).max(64),
    ruleName: z.string().min(2).max(128),
    tableName: z.string().max(128).optional().nullable().default(""),
    fieldName: z.string().min(1).max(128),
    ruleType: z.string().min(2).max(64),
    ruleConfig: z.record(z.any()).optional().default({}),
    sourceRefs: z.array(z.string().min(1).max(512)).optional().default([]),
    issueCategory: z.string().min(2).max(32).optional().default("合规性"),
    severity: z.enum(["low", "medium", "high"]).optional().default("medium"),
    status: z.enum(["active", "inactive"]).optional().default("active"),
  })).optional().default([]),
  pluginBindings: z.array(z.object({
    pluginKey: z.string().min(2).max(64),
    pluginName: z.string().min(2).max(128),
    bindingScope: z.enum(["industry", "sub_scenario", "profile"]).optional().default("industry"),
    bindingConfig: z.any().optional().default({}),
    status: z.enum(["active", "inactive"]).optional().default("active"),
  })).optional().default([]),
  extendedRules: z.array(z.object({
    ruleCategory: z.enum(["linkage", "temporal", "cardinality", "state_flow", "code"]),
    moduleKey: z.string().min(2).max(64),
    ruleCode: z.string().min(2).max(64),
    ruleName: z.string().min(2).max(128),
    industryScope: z.string().max(32).optional().nullable(),
    sceneScope: z.string().max(64).optional().nullable(),
    tableName: z.string().max(128).optional().nullable(),
    fieldName: z.string().max(128).optional().nullable(),
    ruleConfig: z.record(z.any()).optional().default({}),
    sourceRefs: z.array(z.string().min(1).max(512)).optional().default([]),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
    status: z.enum(["active", "inactive"]).optional().default("active"),
  })).optional().default([]),
  recognition: z.any().optional().default({}),
  researchCatalog: z.any().optional().default({}),
  modulePlanner: z.any().optional().default({}),
  schemaGuides: z.any().optional().default({}),
  relationPatterns: z.any().optional().default([]),
  stateMachines: z.any().optional().default([]),
  codeRules: z.any().optional().default([]),
  fieldSemantics: z.any().optional().default([]),
  valueCorpora: z.object({
    entries: z.array(z.object({
      tableName: z.string().max(128).optional().nullable().default(""),
      fieldName: z.string().min(1).max(128),
      values: z.array(z.any()).optional().default([]),
      sourceRefs: z.array(z.string().min(1).max(512)).optional().default([]),
    })).optional().default([]),
    fields: z.record(z.array(z.any())).optional().default({}),
    tableFields: z.record(z.record(z.array(z.any()))).optional().default({}),
  }).optional().default({}),
  distributionProfiles: z.any().optional().default({}),
  qualityGates: z.any().optional().default({}),
  realismRules: z.any().optional().default([]),
  dirtyDataProfiles: z.any().optional().default({}),
  trainingAssets: z.any().optional().default({}),
  evaluationRubric: z.any().optional().default({}),
  overridePolicies: z.any().optional().default({}),
})), asyncHandler(controller.saveScenarioEnhancement));
router.post("/enhancement/delete/:id", asyncHandler(controller.deleteScenarioEnhancement));
router.post("/enhancement/preview", validateBody(z.object({
  sceneName: z.string().min(2).max(128),
  sceneDesc: z.string().max(1024).optional().nullable(),
  knowledgeText: z.string().max(20000).optional().nullable(),
})), asyncHandler(controller.previewScenarioRecognition));
router.get("/enhancement/export/:id", asyncHandler(controller.exportScenarioEnhancement));
router.post("/enhancement/import", enhancementImportUpload.single("file"), asyncHandler(controller.importScenarioEnhancement));

router.get("/incubation/list", asyncHandler(controller.listIndustryIncubations));
router.get("/incubation/detail/:id", asyncHandler(controller.getIndustryIncubationDetail));
router.get("/incubation/stats/:id", asyncHandler(controller.getIndustryIncubationStats));
router.get("/incubation/logs/:id", asyncHandler(controller.listIndustryIncubationLogs));
router.post("/incubation/save", validateBody(z.object({
  id: z.coerce.number().int().positive().optional(),
  incubationName: z.string().min(2).max(128),
  incubationCode: z.string().max(64).optional().nullable(),
  industryCode: z.string().max(32).optional().nullable(),
  enhancementProfileId: z.coerce.number().int().positive().optional().nullable(),
  incubationDesc: z.string().max(1024).optional().nullable(),
  status: z.enum(["draft", "active", "archived"]).optional().default("draft"),
  languagePolicy: z.any().optional(),
  autoResearchPolicy: z.any().optional(),
  modelCommittee: z.any().optional(),
  scenarioPool: z.any().optional(),
  scenarioCoverage: z.any().optional(),
  evidenceCatalog: z.any().optional(),
  standardAssets: z.any().optional(),
  publicDataProfiles: z.any().optional(),
  trainingSettings: z.any().optional(),
  evaluationRubric: z.any().optional(),
  overridePolicies: z.any().optional(),
})), asyncHandler(controller.saveIndustryIncubation));
router.post("/incubation/delete/:id", asyncHandler(controller.deleteIndustryIncubation));
router.post("/incubation/category/delete/:id", validateBody(z.object({
  categoryCode: z.string().max(128).optional().nullable(),
  categoryName: z.string().max(128).optional().nullable(),
})), asyncHandler(controller.deleteIndustryCategory));
router.post("/incubation/refresh-metadata/:id", asyncHandler(controller.refreshIndustryMetadata));
router.post("/incubation/run/start/:id", validateBody(z.object({
  roundCount: z.coerce.number().int().min(1).max(12).optional(),
  categoryCode: z.string().max(128).optional().nullable(),
  categoryName: z.string().max(128).optional().nullable(),
})), asyncHandler(controller.startIndustryIncubationRun));
router.post("/incubation/run/stop/:id", asyncHandler(controller.stopIndustryIncubationRun));
router.post("/incubation/category-iteration/:id", validateBody(z.object({
  categoryCode: z.string().max(128).optional().nullable(),
  categoryName: z.string().max(128).optional().nullable(),
  continueIteration: z.boolean(),
})), asyncHandler(controller.updateIndustryCategoryIteration));
router.post("/incubation/round/generate", validateBody(z.object({
  incubationId: z.coerce.number().int().positive(),
})), asyncHandler(controller.generateIndustryIncubationRound));
router.post("/incubation/round/execute/:id", asyncHandler(controller.executeIndustryIncubationRound));
router.post("/incubation/round/update", validateBody(z.object({
  id: z.coerce.number().int().positive(),
  roundStatus: z.enum(["draft", "running", "completed", "failed"]).optional(),
  resultSummary: z.any().optional().default({}),
  enhancementDelta: z.any().optional().default({}),
  startedAt: z.string().max(64).optional().nullable(),
  endedAt: z.string().max(64).optional().nullable(),
})), asyncHandler(controller.updateIndustryIncubationRound));
router.post("/incubation/sync-enhancement/:id", asyncHandler(controller.syncIndustryIncubationToEnhancement));
router.post("/incubation/rebuild-dictionary-ownership/:id", asyncHandler(controller.rebuildIndustryIncubationDictionaryOwnership));

module.exports = router;
