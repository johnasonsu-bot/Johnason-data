const { z } = require("../../common/middleware/validate");

const serviceFilterSchema = z.object({
  columnName: z.string().min(1),
  label: z.string().optional(),
  paramName: z.string().optional(),
  startParamName: z.string().optional(),
  endParamName: z.string().optional(),
  operator: z.enum(["eq", "like", "between"]).default("eq"),
  required: z.boolean().optional(),
  requirementMode: z.enum(["optional", "required", "one_of_group"]).optional(),
  requiredGroup: z.string().optional().nullable(),
  dataType: z.string().optional(),
});

const serviceResponseFieldSchema = z.object({
  columnName: z.string().min(1),
  fieldName: z.string().optional(),
  label: z.string().optional(),
  dataType: z.string().optional(),
});

const serviceConfigSchema = z.object({
  serviceName: z.string().min(2),
  serviceCode: z.string().optional().nullable(),
  servicePath: z.string().min(2),
  requestMethod: z.enum(["GET", "POST"]),
  dataDomain: z.string().optional(),
  sourceId: z.number().int().positive(),
  serviceMode: z.enum(["table", "sql"]).default("table"),
  sourceTable: z.string().optional().nullable(),
  sourceSql: z.string().optional().nullable(),
  serviceType: z.enum(["list", "detail"]).default("list"),
  authType: z.enum(["anonymous", "token"]).default("token"),
  status: z.enum(["draft", "published", "disabled"]).default("draft"),
  description: z.string().optional(),
  ownerName: z.string().optional(),
  queryConfig: z.object({
    filters: z.array(serviceFilterSchema).default([]),
    pagination: z.boolean().optional(),
    defaultPageSize: z.number().int().positive().optional(),
    maxPageSize: z.number().int().positive().optional(),
    defaultSortField: z.string().optional().nullable(),
    defaultSortOrder: z.enum(["asc", "desc"]).optional(),
  }).default({ filters: [], pagination: true }),
  responseConfig: z.object({
    fields: z.array(serviceResponseFieldSchema).min(1),
  }),
});

const serviceStatusSchema = z.object({
  status: z.enum(["draft", "published", "disabled"]),
});

const serviceDataSourceSchema = z.object({
  sourceName: z.string().min(2),
  sourceCode: z.string().min(2),
  sourceType: z.enum(["mysql", "postgresql"]),
  connectionConfig: z.record(z.any()).default({}),
  ownerName: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const serviceAppSchema = z.object({
  departmentName: z.string().min(2),
  appName: z.string().min(2),
  appCode: z.string().trim().optional().or(z.literal("")),
  appToken: z.string().optional(),
  contactPhone: z.string().optional(),
  appDescription: z.string().optional(),
  ownerName: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const authorizationSchema = z.object({
  serviceId: z.number().int().positive(),
  appId: z.number().int().positive(),
  status: z.enum(["active", "inactive"]).default("active"),
  rateLimitPerMinute: z.number().int().nonnegative().optional(),
  dailyLimit: z.number().int().nonnegative().optional(),
  ipWhitelist: z.union([z.string(), z.array(z.string())]).optional(),
});

const serviceSqlPreviewSchema = z.object({
  sourceId: z.number().int().positive(),
  sql: z.string().min(1),
});

const serviceRecommendSchema = z.object({
  sourceId: z.number().int().positive(),
  serviceMode: z.enum(["table", "sql"]).default("table"),
  sourceTable: z.string().optional().nullable(),
  sourceSql: z.string().optional().nullable(),
  serviceName: z.string().optional().nullable(),
  serviceCode: z.string().optional().nullable(),
  servicePath: z.string().optional().nullable(),
  requestMethod: z.enum(["GET", "POST"]).optional(),
  serviceType: z.enum(["list", "detail"]).optional(),
  ownerName: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const serviceAiConfigSchema = z.object({
  defaultModelProviderId: z.number().int().positive().nullable().optional(),
  defaultModelName: z.string().trim().max(128).optional().or(z.literal("")),
  defaultModelVersion: z.string().trim().max(128).optional().or(z.literal("")),
  temperature: z.number().min(0).max(2).nullable().optional(),
  maxTokens: z.number().int().min(1).max(32000).nullable().optional(),
  timeoutMs: z.number().int().min(1000).max(7200000).nullable().optional(),
  systemPrompt: z.string().trim().max(12000).optional().or(z.literal("")),
});

module.exports = {
  authorizationSchema,
  serviceAiConfigSchema,
  serviceDataSourceSchema,
  serviceAppSchema,
  serviceConfigSchema,
  serviceStatusSchema,
  serviceRecommendSchema,
  serviceSqlPreviewSchema,
};
