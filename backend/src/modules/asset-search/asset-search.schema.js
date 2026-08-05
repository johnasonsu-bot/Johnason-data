const { z } = require("../../common/middleware/validate");
const { ASSET_TYPES, SOURCE_MODULES } = require("./asset-search.repository");

const searchFiltersSchema = z.object({
  departmentId: z.coerce.number().int().positive().optional(),
  businessSystemId: z.coerce.number().int().positive().optional(),
  dataSourceId: z.coerce.number().int().positive().optional(),
  catalogId: z.coerce.number().int().positive().optional(),
  organizationCatalogId: z.coerce.number().int().positive().optional(),
  resourceCategory: z.string().trim().optional(),
  assetCategory: z.string().trim().optional(),
  status: z.string().trim().optional(),
  fieldStatus: z.string().trim().optional(),
  owner: z.string().trim().optional(),
  profileStatus: z.string().trim().optional(),
}).passthrough().optional().default({});

const searchSchema = z.object({
  keyword: z.string().trim().max(500).optional().default(""),
  aiEnabled: z.boolean().optional().default(false),
  scopes: z.array(z.enum(ASSET_TYPES)).optional().default([]),
  sourceModules: z.array(z.enum(SOURCE_MODULES)).optional().default([]),
  filters: searchFiltersSchema,
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

const businessDataSearchConditionSchema = z.object({
  elementId: z.coerce.number().int().positive(),
  values: z.array(z.coerce.string().trim().min(1).max(512)).min(1).max(20),
});

const businessDataSearchSchema = z.object({
  conditions: z.array(businessDataSearchConditionSchema).min(1).max(5),
  matchMode: z.enum(["all", "any"]).optional().default("all"),
  filters: searchFiltersSchema,
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  perResourceLimit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const feedbackSchema = z.object({
  keyword: z.string().trim().max(500).optional().default(""),
  aiEnabled: z.boolean().optional().default(false),
  mode: z.string().trim().max(32).optional().default(""),
  resultId: z.string().trim().max(255),
  feedback: z.enum(["accurate", "inaccurate", "irrelevant"]),
  comment: z.string().trim().max(1000).optional().default(""),
  resultSnapshot: z.record(z.unknown()).optional().default({}),
});

const aiConfigSchema = z.object({
  defaultModelProviderId: z.coerce.number().int().positive().nullable().optional(),
  defaultModelName: z.string().trim().max(128).nullable().optional(),
  defaultModelVersion: z.string().trim().max(128).nullable().optional(),
  temperature: z.coerce.number().min(0).max(2).nullable().optional(),
  maxTokens: z.coerce.number().int().min(1).max(32000).nullable().optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(300000).nullable().optional(),
  systemPrompt: z.string().trim().max(20000).optional().default(""),
  description: z.string().trim().max(512).optional().default(""),
  ownerName: z.string().trim().max(64).optional().default("System Administrator"),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

module.exports = {
  aiConfigSchema,
  businessDataSearchSchema,
  feedbackSchema,
  searchSchema,
};
