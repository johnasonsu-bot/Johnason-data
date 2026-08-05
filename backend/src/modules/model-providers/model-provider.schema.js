const { z } = require("../../common/middleware/validate");

const providerTypeSchema = z.enum(["openai", "azure_openai", "anthropic", "deepseek", "qwen", "zhipu", "baidu", "custom"]);
const modelCategorySchema = z.enum(["chat", "embedding", "rerank", "vision", "speech"]);

const baseProviderSchema = z.object({
  configName: z.string().min(2, "配置名称至少 2 个字符").max(128),
  configCode: z.string().min(2, "配置编码至少 2 个字符").max(64).regex(/^[a-zA-Z0-9_]+$/, "编码仅支持字母、数字和下划线"),
  providerType: providerTypeSchema,
  modelCategory: modelCategorySchema.default("chat"),
  modelName: z.string().min(1, "模型名称不能为空").max(128),
  modelVersion: z.string().trim().min(1, "模型版本不能为空").max(128),
  baseUrl: z.string().trim().max(255).optional().or(z.literal("")),
  organizationId: z.string().trim().max(128).optional().or(z.literal("")),
  ownerName: z.string().trim().min(2, "负责人至少 2 个字符").max(64),
  status: z.enum(["active", "inactive"]).default("active"),
  description: z.string().trim().max(512).optional().or(z.literal("")),
  extraConfig: z.record(z.any()).optional().default({}),
});

const createModelProviderSchema = baseProviderSchema.extend({
  apiKey: z.string().trim().min(8, "API Key 长度至少 8 位").max(512),
});

const updateModelProviderSchema = baseProviderSchema.extend({
  apiKey: z.string().trim().max(512).optional().or(z.literal("")),
});

const testModelProviderSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  providerType: providerTypeSchema,
  modelCategory: modelCategorySchema.default("chat"),
  baseUrl: z.string().trim().min(1, "接口地址不能为空").max(255),
  apiKey: z.string().trim().max(512).optional().or(z.literal("")),
  organizationId: z.string().trim().max(128).optional().or(z.literal("")),
  extraConfig: z.record(z.any()).optional().default({}),
});

module.exports = {
  createModelProviderSchema,
  updateModelProviderSchema,
  testModelProviderSchema,
};
