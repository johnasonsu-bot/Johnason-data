const path = require("path");
const multer = require("multer");
const { z } = require("../../common/middleware/validate");

const runtimeUploadDir = path.resolve(__dirname, "../../runtime/data-lab-kb-uploads");
const upload = multer({
  dest: runtimeUploadDir,
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

const knowledgeBaseSchema = z.object({
  kbName: z.string().min(2).max(128),
  kbDesc: z.string().max(512).optional().nullable(),
  industryType: z.string().max(64).optional().nullable(),
  tags: z.array(z.string().max(32)).optional().default([]),
  status: z.enum(["active", "inactive"]).optional().default("active")
});

const sceneSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  sceneCode: z.string().max(64).optional().nullable(),
  sceneName: z.string().min(2).max(128),
  sceneDesc: z.string().max(1024).optional().nullable(),
  industryKbIds: z.array(z.coerce.number().int().positive()).optional().default([]),
  industryKbId: z.coerce.number().int().positive().optional().nullable(),
  kbId: z.coerce.number().int().positive().optional().nullable(),
  enhancementProfileId: z.coerce.number().int().positive().optional().nullable(),
  offlineDataSourceId: z.coerce.number().int().positive().optional().nullable(),
  realtimeDataSourceId: z.coerce.number().int().positive().optional().nullable(),
  initVolume: z.coerce.number().int().min(1).max(100000).optional().default(1000),
  incrVolume: z.coerce.number().int().min(1).max(100000).optional().default(100),
  incrCycle: z.enum(["MINUTE", "HOUR", "DAILY"]).optional().default("DAILY"),
  dirtyEnabled: z.boolean().optional().default(false),
  dirtyRatio: z.coerce.number().min(0).max(1).optional().default(0),
  realtimeEnabled: z.boolean().optional().default(false),
  kafkaTopicMode: z.enum(["AUTO", "MANUAL"]).optional().default("AUTO"),
  kafkaBootstrapServers: z.string().max(255).optional().nullable(),
  strategyModelId: z.coerce.number().int().positive().optional().nullable(),
  generateModelId: z.coerce.number().int().positive().optional().nullable()
});

const schemaGenerateSchema = z.object({
  sceneId: z.coerce.number().int().positive()
});

const sceneAnalyzeSchema = z.object({
  sceneId: z.coerce.number().int().positive()
});

const schemaAdjustSchema = z.object({
  sceneId: z.coerce.number().int().positive(),
  versionId: z.coerce.number().int().positive().optional().nullable(),
  adjustmentPrompt: z.string().min(2).max(2000)
});

const schemaSaveSchema = z.object({
  sceneId: z.coerce.number().int().positive(),
  versionId: z.coerce.number().int().positive().optional().nullable(),
  schema: z.any(),
  summary: z.string().max(1000).optional().nullable(),
});

const schemaConfirmSchema = z.object({
  sceneId: z.coerce.number().int().positive(),
  versionId: z.coerce.number().int().positive().optional().nullable()
});

const schemaDeploySchema = z.object({
  sceneId: z.coerce.number().int().positive(),
  offlineDataSourceId: z.coerce.number().int().positive(),
  realtimeDataSourceId: z.coerce.number().int().positive().optional().nullable(),
});

const strategyGenerateSchema = z.object({
  sceneId: z.coerce.number().int().positive(),
  initVolume: z.coerce.number().int().min(1).max(100000).optional(),
  incrVolume: z.coerce.number().int().min(1).max(100000).optional(),
  incrCycle: z.enum(["MINUTE", "HOUR", "DAILY"]).optional(),
  dirtyEnabled: z.boolean().optional(),
  dirtyRatio: z.coerce.number().min(0).max(1).optional(),
  dirtyProfile: z.record(z.coerce.number()).optional(),
  realtimeEnabled: z.boolean().optional(),
  distributionMode: z.string().max(64).optional(),
  startTime: z.string().max(64).optional()
});

const strategyAdjustSchema = z.object({
  sceneId: z.coerce.number().int().positive(),
  versionId: z.coerce.number().int().positive().optional().nullable(),
  adjustmentPrompt: z.string().min(2).max(2000)
});

const strategyConfirmSchema = z.object({
  sceneId: z.coerce.number().int().positive(),
  versionId: z.coerce.number().int().positive().optional().nullable()
});

const realismReviewSchema = z.object({
  sampleTables: z.coerce.number().int().min(1).max(12).optional().default(6),
  sampleRows: z.coerce.number().int().min(1).max(5).optional().default(2),
  modelProfileId: z.coerce.number().int().positive().optional().nullable(),
});

const dirtyScriptSchema = z.object({
  dirtyRatio: z.coerce.number().min(0).max(1).optional().default(0.05),
  sampleTables: z.coerce.number().int().min(1).max(8).optional().default(3),
  sampleRows: z.coerce.number().int().min(1).max(5).optional().default(3),
  modelProfileId: z.coerce.number().int().positive().optional().nullable(),
});

const topicSchema = z.object({
  sceneId: z.coerce.number().int().positive(),
  topicName: z.string().min(3).max(255),
  topicType: z.enum(["MASTER", "EVENT", "LOG", "TABLE"]).optional().default("TABLE"),
  writeMode: z.enum(["MYSQL_ONLY", "MYSQL_AND_KAFKA", "KAFKA_ONLY"]).optional().default("MYSQL_AND_KAFKA"),
  status: z.enum(["READY", "STOPPED"]).optional().default("READY")
});

const deleteTopicSchema = z.object({
  sceneId: z.coerce.number().int().positive(),
  topicName: z.string().min(3).max(255)
});

const labModelStageTypeValues = [
  "SCHEMA",
  "STRATEGY",
  "DIRTY",
  "REALTIME",
  "researcher",
  "standard_extractor",
  "distribution_analyst",
  "schema_reviewer",
  "realism_reviewer",
  "arbiter",
];

const modelProfileSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  profileName: z.string().min(2).max(128),
  stageType: z.string().trim().min(1).max(32).refine((value) => labModelStageTypeValues.includes(value), "invalid model usage scope"),
  providerId: z.coerce.number().int().positive().optional().nullable(),
  modelName: z.string().min(2).max(128),
  modelVersion: z.string().min(1).max(128),
  modelCode: z.string().min(2).max(64),
  endpointUrl: z.string().max(255).optional().nullable(),
  authMode: z.enum(["bearer", "api_key", "none"]).optional().default("bearer"),
  temperature: z.coerce.number().min(0).max(2).optional().default(0.2),
  maxContextLength: z.coerce.number().int().min(512).max(200000).optional().default(8192),
  systemPrompt: z.string().max(8000).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
  status: z.enum(["active", "inactive"]).optional().default("active")
});

module.exports = {
  upload,
  knowledgeBaseSchema,
  sceneSchema,
  schemaGenerateSchema,
  sceneAnalyzeSchema,
  schemaAdjustSchema,
  schemaSaveSchema,
  schemaConfirmSchema,
  schemaDeploySchema,
  strategyGenerateSchema,
  strategyAdjustSchema,
  strategyConfirmSchema,
  realismReviewSchema,
  dirtyScriptSchema,
  topicSchema,
  deleteTopicSchema,
  modelProfileSchema
};
