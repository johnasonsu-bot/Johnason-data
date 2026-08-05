const { z } = require("../../common/middleware/validate");

const fieldMappingSchema = z.object({
  sourceField: z.string().min(1, "来源字段不能为空"),
  targetField: z.string().min(1, "目标字段不能为空"),
  dataType: z.string().optional(),
  defaultValue: z.any().optional(),
  isPrimaryKey: z.boolean().optional().default(false)
});

const transformRuleSchema = z.object({
  field: z.string().min(1, "字段名不能为空"),
  transformType: z.enum(["rename", "uppercase", "lowercase", "trim", "date_format", "custom"]),
  config: z.record(z.any()).optional().default({})
});

const incrementalConfigSchema = z.object({
  mode: z.enum(["timestamp", "id", "cdc"]),
  cursorColumn: z.string().optional(),
  timestampColumn: z.string().optional(),
  idColumn: z.string().optional(),
  startValue: z.any().optional(),
  lastValue: z.any().optional(),
  lastRunStartValue: z.any().optional(),
  lastRunEndValue: z.any().optional(),
  lastRunAt: z.string().optional(),
  cdcColumns: z.array(z.string()).optional()
});

const sourceConfigSchema = z.record(z.any()).optional();
const parseConfigSchema = z.record(z.any()).optional();
const errorConfigSchema = z.record(z.any()).optional();

const scheduleConfigSchema = z.object({
  scheduleType: z.enum(["manual", "interval", "daily", "weekly", "monthly", "cron"]),
  cronExpression: z.string().optional(),
  intervalMs: z.number().optional(),
  runTime: z.string().optional(),
  weekDays: z.array(z.number().int().min(0).max(6)).optional(),
  monthDay: z.number().int().min(1).max(31).optional(),
  timezone: z.string().optional().default("Asia/Shanghai"),
  dependencyTaskIds: z.array(z.number().int().positive()).optional().default([]),
  retryCount: z.number().int().min(0).optional().default(0),
  retryIntervalMs: z.number().int().positive().optional()
});

const baseTaskSchema = z.object({
  taskName: z.string().min(2, "任务名称至少 2 个字符").max(128, "任务名称最多 128 个字符"),
  taskCode: z
    .string()
    .min(2, "任务编码至少 2 个字符")
    .max(64, "任务编码最多 64 个字符")
    .regex(/^[a-zA-Z0-9_]+$/, "编码仅支持字母数字下划线"),
  sourceId: z.number().int().positive("来源数据源 ID 必须为正整数"),
  sourceTable: z.string().min(1, "请选择来源对象"),
  targetSourceId: z.number().int().positive("目标数据源 ID 必须为正整数"),
  targetTable: z.string().min(1, "请输入目标表名"),
  targetTableMode: z.enum(["existing", "create"]).default("existing"),
  targetConfig: z.record(z.any()).optional().default({}),
  syncMode: z.enum(["full", "incremental", "cdc"]).default("full"),
  status: z.enum(["draft", "active", "paused", "stopped"]).default("draft"),
  description: z.string().max(512).nullable().optional(),
  ownerName: z.string().trim().min(1, "负责人不能为空").max(64).optional().default("system"),
  scheduleEnabled: z.boolean().optional().default(false)
});

const createTaskSchema = baseTaskSchema.extend({
  fieldMappings: z.array(fieldMappingSchema).min(1, "至少需要一个字段映射"),
  transformRules: z.array(transformRuleSchema).optional().default([]),
  incrementalConfig: incrementalConfigSchema.optional(),
  sourceConfig: sourceConfigSchema,
  parseConfig: parseConfigSchema,
  errorConfig: errorConfigSchema,
  scheduleConfig: scheduleConfigSchema.optional()
});

const updateTaskSchema = z.object({
  taskName: z.string().min(2).max(128).optional(),
  sourceId: z.number().int().positive().optional(),
  sourceTable: z.string().min(1).optional(),
  targetSourceId: z.number().int().positive().optional(),
  targetTable: z.string().min(1).optional(),
  targetTableMode: z.enum(["existing", "create"]).optional(),
  targetConfig: z.record(z.any()).optional(),
  syncMode: z.enum(["full", "incremental", "cdc"]).optional(),
  status: z.enum(["draft", "active", "paused", "stopped"]).optional(),
  description: z.string().max(512).nullable().optional(),
  ownerName: z.string().trim().min(1, "负责人不能为空").max(64).optional(),
  scheduleEnabled: z.boolean().optional(),
  fieldMappings: z.array(fieldMappingSchema).optional(),
  transformRules: z.array(transformRuleSchema).optional(),
  incrementalConfig: incrementalConfigSchema.optional(),
  sourceConfig: sourceConfigSchema,
  parseConfig: parseConfigSchema,
  errorConfig: errorConfigSchema,
  scheduleConfig: scheduleConfigSchema.optional()
});

const previewSourceSchema = z.object({
  sourceId: z.number().int().positive("来源数据源 ID 必须为正整数"),
  sourceTable: z.string().min(1, "请选择来源对象"),
  sourceConfig: sourceConfigSchema,
  parseConfig: parseConfigSchema,
  limit: z.number().int().min(1).max(100).optional().default(20)
});

module.exports = {
  baseTaskSchema,
  createTaskSchema,
  updateTaskSchema,
  previewSourceSchema,
  fieldMappingSchema,
  incrementalConfigSchema,
  scheduleConfigSchema,
  transformRuleSchema
};
