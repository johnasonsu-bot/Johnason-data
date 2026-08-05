const { z } = require("../../common/middleware/validate");

const monitorSourceSchema = z.object({
  scopeMode: z.enum(["all", "manual"]).default("all"),
  selectedTables: z.array(z.string().trim().min(1)).max(1000).optional().default([]),
  detailTableName: z.string().trim().min(1).max(128).optional().default("medata_quality_issue_detail"),
  statsTableName: z.string().trim().min(1).max(128).optional().default("medata_quality_issue_stats"),
  status: z.enum(["active", "inactive"]).default("active"),
});

const qualitySourceSchema = z.object({
  sourceName: z.string().trim().min(2, "数据源名称至少 2 个字符"),
  sourceCode: z.string().trim().min(2, "数据源编码至少 2 个字符").regex(/^[a-zA-Z0-9_]+$/, "编码仅支持字母数字下划线"),
  sourceType: z.enum(["mysql", "postgresql", "gaussdb", "jdbc", "oracle", "dm", "api", "sftp", "kafka", "hive", "other"]),
  ownerName: z.string().trim().min(2, "负责人至少 2 个字符").optional().default("system"),
  status: z.enum(["active", "inactive"]).default("active"),
  connectionConfig: z.record(z.any()).optional().default({}),
});

const updateAiConfigSchema = z.object({
  defaultModelProviderId: z.number().int().positive().nullable().optional(),
  defaultModelName: z.string().trim().max(128).optional().or(z.literal("")),
  defaultModelVersion: z.string().trim().max(128).optional().or(z.literal("")),
  temperature: z.number().min(0).max(2).nullable().optional(),
  maxTokens: z.number().int().min(1).max(32000).nullable().optional(),
  timeoutMs: z.number().int().min(1000).max(7200000).nullable().optional(),
  thinkingEnabled: z.boolean().optional(),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh", "max"]).nullable().optional(),
  thinkingBudget: z.number().int().min(1).max(1000000).nullable().optional(),
  systemPrompt: z.string().trim().max(8000).optional().or(z.literal("")),
});

const regexRuleSchema = z.object({
  id: z.number().int().positive().optional(),
  ruleCode: z.string().trim().min(2).max(64).regex(/^[a-z0-9_]+$/, "规则编码仅支持小写字母、数字和下划线"),
  ruleName: z.string().trim().min(2).max(128),
  ruleScene: z.string().trim().min(2).max(32).default("compliance"),
  regexPattern: z.string().trim().min(1).max(1024),
  matchExamples: z.array(z.string().trim().max(255)).optional().default([]),
  mismatchExamples: z.array(z.string().trim().max(255)).optional().default([]),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["active", "inactive"]).default("active"),
  isBuiltin: z.boolean().optional().default(false),
});

const regexRuleAiAnalyzeSchema = z.object({
  ruleName: z.string().trim().min(2).max(128),
  ruleScene: z.enum(["compliance", "general"]).optional().default("compliance"),
  currentRuleCode: z.string().trim().max(64).optional().or(z.literal("")),
});

const dictionaryItemSchema = z.object({
  id: z.number().int().positive().optional(),
  itemCode: z.string().trim().min(1).max(128),
  itemLabel: z.string().trim().min(1).max(255),
  itemValue: z.string().trim().max(255).optional().or(z.literal("")),
  minValue: z.number().optional().nullable(),
  maxValue: z.number().optional().nullable(),
  sortOrder: z.number().int().min(0).optional().default(0),
  status: z.enum(["active", "inactive"]).default("active"),
});

const dictionaryFilterSchema = z.object({
  field: z.string().trim().min(1).max(255),
  operator: z.enum(["eq", "ne", "in", "not_in", "contains", "starts_with", "gt", "gte", "lt", "lte", "is_null", "is_not_null"]),
  value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]).optional().nullable(),
});

const dictionarySchema = z.object({
  id: z.number().int().positive().optional(),
  dictCode: z.string().trim().min(2).max(64).regex(/^[a-z0-9_]+$/, "字典编码仅支持小写字母、数字和下划线"),
  dictName: z.string().trim().min(2).max(128),
  dictCategory: z.string().trim().min(2).max(64).default("general"),
  valueType: z.enum(["string", "number"]).default("string"),
  dictDesc: z.string().trim().max(512).optional().or(z.literal("")),
  registrationMode: z.enum(["manual", "table"]).optional().default("manual"),
  sourceSystemId: z.number().int().positive().nullable().optional(),
  sourceId: z.number().int().positive().nullable().optional(),
  sourceTable: z.string().trim().max(255).optional().or(z.literal("")),
  codeField: z.string().trim().max(128).optional().or(z.literal("")),
  valueField: z.string().trim().max(128).optional().or(z.literal("")),
  labelField: z.string().trim().max(128).optional().or(z.literal("")),
  filterConfig: z.array(dictionaryFilterSchema).max(20).optional().default([]),
  status: z.enum(["active", "inactive"]).default("active"),
  items: z.array(dictionaryItemSchema).max(5000).optional().default([]),
}).superRefine((value, context) => {
  if (value.registrationMode !== "table") return;
  if (!value.sourceSystemId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceSystemId"], message: "请选择来源系统" });
  if (!value.sourceId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceId"], message: "请选择数据源" });
  if (!value.sourceTable) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceTable"], message: "请选择来源表" });
  if (!value.codeField) context.addIssue({ code: z.ZodIssueCode.custom, path: ["codeField"], message: "请选择编码字段" });
});

const dictionaryPreviewSchema = z.object({
  sourceId: z.number().int().positive(),
  sourceTable: z.string().trim().min(1).max(255),
  codeField: z.string().trim().min(1).max(128),
  valueField: z.string().trim().max(128).optional().or(z.literal("")),
  labelField: z.string().trim().max(128).optional().or(z.literal("")),
  filterConfig: z.array(dictionaryFilterSchema).max(20).optional().default([]),
  limit: z.number().int().min(1).max(5000).optional().default(1000),
});

const dictionarySourcePreviewSchema = z.object({
  sourceId: z.number().int().positive(),
  sourceTable: z.string().trim().min(1).max(255),
  filterConfig: z.array(dictionaryFilterSchema).max(20).optional().default([]),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

const dictionaryAnalysisFieldMappingSchema = z.object({
  tableMode: z.enum(["single", "combined"]),
  dictionaryTypeField: z.string().trim().max(128).optional().or(z.literal("")),
  dictionaryNameField: z.string().trim().max(128).optional().or(z.literal("")),
  itemCodeField: z.string().trim().min(1).max(128),
  itemValueField: z.string().trim().max(128).optional().or(z.literal("")),
  itemLabelField: z.string().trim().max(128).optional().or(z.literal("")),
  dictionaryName: z.string().trim().max(128).optional().or(z.literal("")),
  dictionaryCode: z.string().trim().max(64).optional().or(z.literal("")),
  reason: z.string().trim().max(1000).optional().or(z.literal("")),
});

const dictionaryAiAnalyzeSchema = z.object({
  sourceSystemId: z.number().int().positive(),
  sourceId: z.number().int().positive(),
  sourceTable: z.string().trim().min(1).max(255),
  sampleSize: z.number().int().min(10).max(500).optional().default(100),
  sampleMode: z.enum(["random", "head"]).optional().default("random"),
  fieldMapping: dictionaryAnalysisFieldMappingSchema.optional(),
});

const dictionaryBatchSchema = z.object({
  dictionaries: z.array(dictionarySchema).min(1, "请至少选择一个字典").max(100),
});

const dictionaryBatchDeleteSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1, "请至少选择一个字典").max(100),
});

const taskTimeFormatSchema = z.enum([
  "date",
  "datetime",
  "compact_date",
  "compact_datetime",
  "month",
  "epoch_seconds",
  "epoch_millis",
]);

const taskTimeOffsetUnitSchema = z.enum([
  "second",
  "minute",
  "hour",
  "day",
  "month",
  "year",
]);

const taskIncrementalModeSchema = z.enum(["cursor", "time_window"]);
const taskTimeAnchorSchema = z.enum(["now", "day_start", "day_end"]);

const fieldStrategySchema = z.object({
  columnName: z.string().trim().min(1).max(255),
  columnComment: z.string().trim().max(512).optional().or(z.literal("")),
  sampleValues: z.array(z.string().trim().max(255)).optional().default([]),
  valueRate: z.number().min(0).max(1).optional().default(0),
  isPrimaryKey: z.boolean().optional().default(false),
  nonNullCheck: z.boolean().optional().default(false),
  complianceRuleCodes: z.array(z.string().trim().min(1).max(64)).optional().default([]),
  duplicateCheck: z.boolean().optional().default(false),
  recommendationReason: z.string().trim().max(1000).optional().or(z.literal("")),
  valueRangeConfig: z.object({
    mode: z.enum(["none", "dictionary", "custom_list", "number_range", "date_range", "list", "range"]).default("none"),
    sourceType: z.string().trim().max(32).optional().nullable(),
    sourceId: z.number().int().positive().optional().nullable(),
    sourceLabel: z.string().trim().max(255).optional().or(z.literal("")),
    allowedValues: z.array(z.string().trim().max(255)).optional().default([]),
    minValue: z.number().optional().nullable(),
    maxValue: z.number().optional().nullable(),
    startDate: z.string().trim().max(32).optional().nullable().or(z.literal("")),
    endDate: z.string().trim().max(32).optional().nullable().or(z.literal("")),
  }).optional().default({ mode: "none" }),
});

const conditionOperatorSchema = z.enum(["=", "!=", "in", "not_in", "is_null", "is_not_null"]);

const advancedRuleSchema = z.object({
  ruleId: z.string().trim().min(1).max(512).optional(),
  ruleName: z.string().trim().min(1).max(255),
  ruleScope: z.enum(["table", "row", "cross_table", "aggregate"]).optional().default("table"),
  ruleCategory: z.enum([
    "conditional_required",
    "conditional_regex",
    "field_compare",
    "composite_unique",
    "freshness",
    "cross_table_lookup",
    "cross_table_consistency",
    "volume_anomaly",
    "null_rate_change",
    "batch_completeness",
  ]),
  enabled: z.boolean().optional().default(true),
  severity: z.enum(["low", "medium", "high"]).optional().default("medium"),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  config: z.object({
    conditionField: z.string().trim().max(255).optional().or(z.literal("")),
    conditionOperator: conditionOperatorSchema.optional(),
    conditionValue: z.any().optional(),
    conditionValues: z.array(z.any()).optional(),
    targetField: z.string().trim().max(255).optional().or(z.literal("")),
    targetFields: z.array(z.string().trim().min(1).max(255)).optional(),
    regexPattern: z.string().trim().max(1000).optional().or(z.literal("")),
    requirement: z.enum(["required", "empty"]).optional(),
    leftField: z.string().trim().max(255).optional().or(z.literal("")),
    compareOperator: z.enum(["<", "<=", "=", ">=", ">", "!="]).optional(),
    rightField: z.string().trim().max(255).optional().or(z.literal("")),
    valueType: z.enum(["text", "number", "date", "datetime", "integer", "int", "long", "float", "double", "decimal"]).optional(),
    fieldNames: z.array(z.string().trim().min(1).max(255)).optional(),
    ignoreBlank: z.boolean().optional(),
    timeField: z.string().trim().max(255).optional().or(z.literal("")),
    maxDelayValue: z.number().int().positive().optional(),
    maxDelayUnit: z.enum(["minute", "hour", "day", "month"]).optional(),
    baseline: z.enum(["current_time", "task_time", "batch_time"]).optional(),
    baselineMode: z.enum(["last_batch", "recent_avg"]).optional(),
    lookbackBatches: z.number().int().min(1).max(30).optional(),
    minHistoryBatches: z.number().int().min(1).max(30).optional(),
    warmupPolicy: z.enum(["collect_only", "upper_threshold"]).optional(),
    warmupThreshold: z.number().min(0).max(1000000000000).nullable().optional(),
    thresholdPercent: z.number().min(0).max(1000).optional(),
    direction: z.enum(["increase", "decrease", "both"]).optional(),
    metricField: z.string().trim().max(255).optional().or(z.literal("")),
    dimensionField: z.string().trim().max(255).nullable().optional().or(z.literal("")),
    expectedDistinctCount: z.number().int().positive().optional(),
    refTable: z.string().trim().max(255).optional().or(z.literal("")),
    referenceTable: z.string().trim().max(255).optional().or(z.literal("")),
    localField: z.string().trim().max(255).optional().or(z.literal("")),
    refField: z.string().trim().max(255).optional().or(z.literal("")),
    localFields: z.array(z.string().trim().min(1).max(255)).optional(),
    refFields: z.array(z.string().trim().min(1).max(255)).optional(),
    comparePairs: z.array(z.object({
      localField: z.string().trim().min(1).max(255),
      refField: z.string().trim().min(1).max(255),
    })).optional(),
  }).passthrough().optional().default({}),
}).passthrough();

const strategyDraftSchema = z.object({
  summary: z.string().trim().max(2000).optional().or(z.literal("")),
  fieldStrategies: z.array(fieldStrategySchema).min(1, "至少配置一个字段策略"),
  advancedRules: z.array(advancedRuleSchema).max(200).optional().default([]),
  rowRules: z.array(advancedRuleSchema).max(200).optional().default([]),
  tableRules: z.array(advancedRuleSchema).max(200).optional().default([]),
  statRules: z.array(advancedRuleSchema).max(200).optional().default([]),
  crossTableRules: z.array(advancedRuleSchema).max(200).optional().default([]),
});

const recommendationSamplingSchema = z.object({
  sampleSize: z.number().int().min(10).max(500).optional().default(100),
  sampleMode: z.enum(["random", "latest", "head"]).optional().default("random"),
  orderField: z.string().trim().max(255).optional().or(z.literal("")),
  tableKind: z.enum(["master", "transaction", "event", "batch", "snapshot", "reference", "general"]).optional().default("general"),
  ruleStrength: z.enum(["basic", "balanced", "strict"]).optional().default("balanced"),
  monitorDirections: z.array(z.enum(["completeness", "uniqueness", "validity", "consistency", "timeliness", "stability", "referential_integrity", "relationship", "structure"])).min(1).max(8).optional().default(["completeness", "validity", "consistency", "timeliness", "stability"]),
  keyFields: z.array(z.string().trim().min(1).max(255)).max(30).optional().default([]),
  referenceTables: z.array(z.string().trim().min(1).max(255)).max(20).optional().default([]),
  baselineMode: z.enum(["last_batch", "recent_avg"]).optional().default("recent_avg"),
  lookbackBatches: z.number().int().min(1).max(30).optional().default(7),
  minHistoryBatches: z.number().int().min(1).max(30).optional().default(3),
  warmupPolicy: z.enum(["collect_only", "upper_threshold"]).optional().default("collect_only"),
  warmupThreshold: z.number().min(0).max(1000000000000).optional(),
});

const recommendationApplySchema = strategyDraftSchema.extend({
  reviewedRuleIds: z.array(z.string().trim().min(1).max(512)).max(200).optional().default([]),
});

const qualityTaskFetchConfigSchema = z.object({
  incrementalColumn: z.string().trim().max(255).optional().or(z.literal("")),
  incrementalMode: taskIncrementalModeSchema.optional().default("cursor"),
  startValue: z.any().optional(),
  startValueMode: z.enum(["literal", "dynamic_time"]).optional().default("literal"),
  startValueFormatType: taskTimeFormatSchema.optional().default("datetime"),
  startValueOffsetValue: z.number().int().min(-3650).max(3650).optional(),
  startValueOffsetUnit: taskTimeOffsetUnitSchema.optional().default("day"),
  startValueAnchor: taskTimeAnchorSchema.optional().default("now"),
  endValue: z.any().optional(),
  endValueMode: z.enum(["literal", "dynamic_time"]).optional().default("literal"),
  endValueFormatType: taskTimeFormatSchema.optional().default("datetime"),
  endValueOffsetValue: z.number().int().min(-3650).max(3650).optional(),
  endValueOffsetUnit: taskTimeOffsetUnitSchema.optional().default("day"),
  endValueAnchor: taskTimeAnchorSchema.optional().default("now"),
  lastValue: z.any().optional(),
  lastRunStartValue: z.any().optional(),
  lastRunEndValue: z.any().optional(),
  lastRunAt: z.string().trim().max(64).optional().or(z.literal("")),
  sampleSize: z.number().int().min(1).max(100000).optional(),
  systemTimeField: z.string().trim().max(255).optional().or(z.literal("")),
  systemTimeFormatType: taskTimeFormatSchema.optional().default("datetime"),
  systemTimeOffsetValue: z.number().int().min(-3650).max(3650).optional(),
  systemTimeOffsetUnit: taskTimeOffsetUnitSchema.optional().default("day"),
}).optional().default({});

const qualityTaskScheduleConfigSchema = z.object({
  scheduleType: z.enum(["manual", "interval", "daily", "weekly", "monthly", "cron"]),
  cronExpression: z.string().trim().max(128).optional().or(z.literal("")),
  intervalMs: z.number().int().min(1000).optional(),
  runTime: z.string().trim().max(16).optional().or(z.literal("")),
  weekDays: z.array(z.number().int().min(0).max(6)).optional(),
  monthDay: z.number().int().min(1).max(31).optional(),
  timezone: z.string().trim().max(64).optional().default("Asia/Shanghai"),
}).optional();

const qualityTaskSchema = z.object({
  taskName: z.string().trim().min(2).max(128),
  taskCode: z.string().trim().min(2).max(64).regex(/^[a-z0-9_]+$/, "任务编码仅支持小写字母、数字和下划线"),
  strategyVersionId: z.number().int().positive(),
  fetchMode: z.enum(["full", "incremental", "sample"]).default("full"),
  fetchConfig: qualityTaskFetchConfigSchema,
  scheduleEnabled: z.boolean().optional().default(false),
  scheduleConfig: qualityTaskScheduleConfigSchema,
  status: z.enum(["draft", "active", "paused", "stopped"]).default("draft"),
  ownerName: z.string().trim().min(1).max(64).optional().default("system"),
  detailTableName: z.string().trim().max(128).optional().or(z.literal("")),
  statsTableName: z.string().trim().max(128).optional().or(z.literal("")),
});

const updateQualityTaskSchema = qualityTaskSchema.partial();

module.exports = {
  monitorSourceSchema,
  qualitySourceSchema,
  updateAiConfigSchema,
  regexRuleSchema,
  regexRuleAiAnalyzeSchema,
  dictionarySchema,
  dictionaryPreviewSchema,
  dictionarySourcePreviewSchema,
  dictionaryAiAnalyzeSchema,
  dictionaryBatchSchema,
  dictionaryBatchDeleteSchema,
  strategyDraftSchema,
  recommendationSamplingSchema,
  recommendationApplySchema,
  qualityTaskSchema,
  updateQualityTaskSchema,
};
