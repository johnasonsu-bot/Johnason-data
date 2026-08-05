const { z } = require("../../common/middleware/validate");

const statusSchema = z.enum(["active", "inactive"]).default("active");
const codeSchema = z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9_]+$/, "编码仅支持字母数字下划线");
const optionalText = (max = 512) => z.string().trim().max(max).optional().nullable().or(z.literal(""));
const optionalPositiveId = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().positive().optional()
);
const optionalNullablePositiveId = z.preprocess(
  (value) => (value === "" ? null : value),
  z.coerce.number().int().positive().nullable().optional()
);
const tagsSchema = z.array(z.string().trim().min(1).max(64)).max(30).optional().default([]);

const departmentSchema = z.object({
  departmentName: z.string().trim().min(2).max(128),
  departmentCode: codeSchema,
  departmentShortName: optionalText(64),
  parentId: z.coerce.number().int().positive().optional().nullable(),
  contactName: optionalText(64),
  contactPhone: optionalText(64),
  contactEmail: optionalText(128),
  dataOwner: optionalText(64),
  dataSteward: optionalText(64),
  description: optionalText(4000),
  tags: tagsSchema,
  status: statusSchema,
});

const businessSystemSchema = z.object({
  departmentId: z.coerce.number().int().positive(),
  systemName: z.string().trim().min(2).max(128),
  systemCode: codeSchema,
  systemShortName: optionalText(64),
  systemType: optionalText(64),
  systemLevel: optionalText(32),
  lifecycleStatus: z.string().trim().max(32).optional().default("online"),
  onlineDate: optionalText(32),
  contactName: optionalText(64),
  contactPhone: optionalText(64),
  vendorName: optionalText(128),
  techOwner: optionalText(64),
  description: optionalText(4000),
  tags: tagsSchema,
  status: statusSchema,
});

const dataSourceSchema = z.object({
  businessSystemId: z.coerce.number().int().positive(),
  sourceName: z.string().trim().min(2).max(128),
  sourceCode: codeSchema,
  sourceType: z.enum(["mysql", "postgresql", "gaussdb", "jdbc", "oracle", "dm", "api", "sftp", "kafka", "hive", "clickhouse", "other"]),
  connectionConfig: z.record(z.any()).optional().default({}),
  ownerName: z.string().trim().min(1).max(64).default("system"),
  environment: z.string().trim().max(32).optional().default("prod"),
  purpose: optionalText(255),
  sourceRefModule: optionalText(32),
  sourceRefId: z.coerce.number().int().positive().optional().nullable(),
  sourceRefCode: optionalText(64),
  sourceRefSnapshot: z.record(z.any()).optional().nullable(),
  status: statusSchema,
});

const testDataSourceSchema = z.object({
  sourceType: dataSourceSchema.shape.sourceType,
  connectionConfig: z.record(z.any()).optional().default({}),
});

const catalogSchema = z.object({
  parentId: z.coerce.number().int().positive().optional().nullable(),
  catalogName: z.string().trim().min(2).max(128),
  catalogShortCode: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_]+$/, "目录简称仅支持字母数字下划线"),
  layerCode: optionalText(32),
  departmentId: z.coerce.number().int().positive(),
  businessSystemId: optionalPositiveId,
  ownerName: optionalText(64),
  description: optionalText(4000),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional().default(0),
  status: statusSchema,
});

const registerResourcesSchema = z.object({
  dataSourceId: z.coerce.number().int().positive(),
  tableNames: z.array(z.string().trim().min(1).max(255)).min(1).max(500),
  resourceCategory: optionalText(64),
  businessTags: tagsSchema,
  rowCountMode: z.enum(["estimated", "exact"]).optional().default("estimated"),
});

const updateResourceSchema = z.object({
  tableComment: optionalText(512),
  resourceCategory: optionalText(64),
  businessTags: tagsSchema,
  status: statusSchema,
});

const updateResourceFieldSchema = z.object({
  columnComment: optionalText(512),
  aiBusinessName: optionalText(128),
  aiBusinessMeaning: optionalText(4000),
  semanticTags: tagsSchema,
  featureTags: z.array(z.enum(["primary_key", "foreign_key", "system_time", "business_time", "dictionary_value"])).max(5).optional().default([]),
  standardElementId: optionalNullablePositiveId,
});

const batchDeleteResourcesSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
});

const resourceContentSchema = z.object({
  businessName: optionalText(128),
  businessDefinition: optionalText(8000),
  businessGrain: optionalText(255),
  updateFrequency: optionalText(64),
  dataOwner: optionalText(64),
  techOwner: optionalText(64),
  usageScenarios: z.array(z.string().trim().min(1).max(128)).max(30).optional().default([]),
  usageInstruction: optionalText(8000),
  qualityNote: optionalText(8000),
  knownIssues: optionalText(8000),
  retentionPeriod: optionalText(64),
  serviceSla: optionalText(128),
  extension: z.record(z.any()).optional().default({}),
});

const refreshResourceProfileSchema = z.object({
  sampleLimit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

const analyzeResourceProfileSchema = z.object({
  sampleLimit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

const aiConfigSchema = z.object({
  sceneName: z.string().trim().min(2).max(128),
  sceneCode: codeSchema,
  defaultModelProviderId: z.coerce.number().int().positive().optional().nullable(),
  defaultModelName: optionalText(128),
  defaultModelVersion: optionalText(128),
  temperature: z.coerce.number().min(0).max(2).nullable().optional(),
  maxTokens: z.coerce.number().int().min(1).max(32000).nullable().optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(300000).nullable().optional(),
  systemPrompt: z.string().trim().max(16000).optional().or(z.literal("")),
  userPromptTemplate: z.string().trim().max(16000).optional().or(z.literal("")),
  outputSchema: z.record(z.any()).optional().default({}),
  description: optionalText(512),
  ownerName: z.string().trim().min(1).max(64).default("System Administrator"),
  status: statusSchema,
});

module.exports = {
  aiConfigSchema,
  analyzeResourceProfileSchema,
  batchDeleteResourcesSchema,
  businessSystemSchema,
  catalogSchema,
  dataSourceSchema,
  departmentSchema,
  refreshResourceProfileSchema,
  registerResourcesSchema,
  resourceContentSchema,
  testDataSourceSchema,
  updateResourceFieldSchema,
  updateResourceSchema,
};
