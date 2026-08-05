const { z } = require("zod");

const workflowNodeTypeSchema = z.enum([
  "start",
  "end",
  "script",
  "processing",
  "operator_task",
  "branch",
  "parallel",
  "join",
]);
const workflowEdgeLabelSchema = z.enum(["default", "true", "false"]);
const orchestrationNodeTypeSchema = z.enum(["source", "operator", "output"]);
const datasourceTypeSchema = z.enum(["mysql", "postgresql", "postgres", "gaussdb", "jdbc", "clickhouse", "hive"]);

function optionalNullableTrimmedString(maxLength) {
  return z.preprocess((value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
  }, z.string().max(maxLength).optional().nullable());
}

const datasourcePayloadSchema = z.object({
  name: z.string().min(1).max(128),
  type: datasourceTypeSchema,
  host: z.string().max(255).optional().nullable(),
  port: z.coerce.number().int().positive().optional().nullable(),
  databaseName: z.string().max(128).optional().nullable(),
  username: z.string().max(128).optional().nullable(),
  password: z.string().max(512).optional().nullable(),
  extraConfig: z.record(z.string(), z.any()).optional().default({}),
});

const datasourceConfigPayloadSchema = datasourcePayloadSchema
  .omit({ name: true })
  .extend({
    datasourceId: z.coerce.number().int().positive().optional().nullable(),
  });

function refineDatasourceConnection(schema) {
  return schema.superRefine((value, ctx) => {
    const jdbcUrl = String(value.extraConfig?.jdbcUrl || "").trim();
    const hasHost = Boolean(String(value.host || "").trim());
    const hasPort = Number(value.port || 0) > 0;

    if (!jdbcUrl && !hasHost) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["host"],
        message: "请输入主机地址，或提供 JDBC URL",
      });
    }

    if (!jdbcUrl && !hasPort) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["port"],
        message: "请输入端口，或提供 JDBC URL",
      });
    }
  });
}

function createDatasourcePayloadSchema() {
  return refineDatasourceConnection(datasourcePayloadSchema);
}

const datasourceSchema = createDatasourcePayloadSchema();
const testDatasourceSchema = refineDatasourceConnection(datasourceConfigPayloadSchema);

const scriptFolderSchema = z.object({
  name: z.string().min(1).max(128),
  parentId: z.coerce.number().int().positive().optional().nullable(),
});

const scriptSchema = z.object({
  name: z.string().min(1).max(128),
  folderId: z.coerce.number().int().positive().optional().nullable(),
  datasourceId: z.coerce.number().int().positive(),
  defaultDatabase: z.string().max(128).optional().nullable(),
  description: z.string().max(512).optional().nullable(),
  tags: z.array(z.string().max(64)).optional().default([]),
  content: z.string().min(1),
});

const queryExecuteSchema = z.object({
  datasourceId: z.coerce.number().int().positive(),
  scriptId: z.coerce.number().int().positive().optional().nullable(),
  sqlText: z.string().min(1),
  databaseName: z.string().max(128).optional().nullable(),
  resultLimit: z.coerce.number().int().positive().max(1000).optional().default(200),
});

const copilotTaskSchema = z.object({
  sessionId: z.coerce.number().int().positive().optional().nullable(),
  datasourceId: z.coerce.number().int().positive(),
  databaseName: z.string().max(128).optional().nullable(),
  modelProviderId: z.coerce.number().int().positive().optional().nullable(),
  taskType: z.enum(["auto", "generate_sql", "analyze_sql", "rewrite_sql", "optimize_sql", "explain_sql", "data_research"]),
  prompt: z.string().max(4000).optional().nullable(),
  selectedSql: z.string().max(50000).optional().nullable(),
  editorSql: z.string().max(200000).optional().nullable(),
  errorMessage: z.string().max(4000).optional().nullable(),
  activeExecutionHistoryId: z.coerce.number().int().positive().optional().nullable(),
  selectedTables: z.array(z.string().max(256)).max(5).optional().default([]),
  conversation: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(12000),
  })).max(12).optional().default([]),
});

const workflowSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(512).optional().nullable(),
  cronExpr: z.string().max(128).optional().nullable(),
  isPaused: z.boolean().optional().default(true),
  retryTimes: z.coerce.number().int().min(0).max(10).optional().default(0),
  timeoutSec: z.coerce.number().int().min(1).max(7200).optional().default(300),
  runtimeConfig: z.record(z.string(), z.any()).optional().default({}),
});

const workflowNodeSchema = z.object({
  nodeType: workflowNodeTypeSchema.default("script"),
  scriptId: z.coerce.number().int().positive().optional().nullable(),
  processingJobId: z.coerce.number().int().positive().optional().nullable(),
  orchestrationTaskId: z.coerce.number().int().positive().optional().nullable(),
  nodeKey: z.string().min(1).max(64),
  nodeName: z.string().min(1).max(128),
  positionX: z.coerce.number(),
  positionY: z.coerce.number(),
  width: z.coerce.number().optional().default(240),
  height: z.coerce.number().optional().default(88),
  retryTimes: z.coerce.number().int().min(0).max(10).optional().nullable(),
  retryIntervalSec: z.coerce.number().int().min(0).max(3600).optional().default(5),
  timeoutSec: z.coerce.number().int().min(1).max(7200).optional().nullable(),
  triggerRule: z.enum(["all_success", "all_done"]).optional().default("all_success"),
  nodeConfig: z.record(z.string(), z.any()).optional().default({}),
});

const workflowEdgeSchema = z.object({
  sourceNodeKey: z.string().min(1).max(64),
  targetNodeKey: z.string().min(1).max(64),
  edgeType: z.string().max(32).optional().default("default"),
  edgeLabel: workflowEdgeLabelSchema.optional().nullable().default("default"),
});

const workflowGraphSchema = z.object({
  nodes: z.array(workflowNodeSchema).default([]),
  edges: z.array(workflowEdgeSchema).default([]),
});

const runWorkflowSchema = z.object({
  triggerType: z.string().max(16).optional().default("manual"),
  runParams: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({}),
});

const createWorkflowFromTaskSchema = z.object({
  taskType: z.enum(["script", "processing", "operator_task"]),
  taskId: z.coerce.number().int().positive(),
  name: optionalNullableTrimmedString(128),
});

const orchestrationTaskSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(512).optional().nullable(),
  datasourceId: z.coerce.number().int().positive().optional().nullable(),
  databaseName: z.string().max(128).optional().nullable(),
  cronExpr: z.string().max(128).optional().nullable(),
  isPaused: z.boolean().optional().default(true),
  retryTimes: z.coerce.number().int().min(0).max(10).optional().default(0),
  timeoutSec: z.coerce.number().int().min(1).max(7200).optional().default(300),
  runtimeConfig: z.record(z.string(), z.any()).optional().default({}),
});

const orchestrationNodeSchema = z.object({
  nodeType: orchestrationNodeTypeSchema.default("operator"),
  operatorCode: z.string().min(1).max(64),
  nodeKey: z.string().min(1).max(64),
  nodeName: z.string().min(1).max(128),
  positionX: z.coerce.number(),
  positionY: z.coerce.number(),
  width: z.coerce.number().optional().default(260),
  height: z.coerce.number().optional().default(108),
  nodeConfig: z.record(z.string(), z.any()).optional().default({}),
});

const orchestrationEdgeSchema = z.object({
  sourceNodeKey: z.string().min(1).max(64),
  sourcePort: z.string().max(64).optional().nullable(),
  targetNodeKey: z.string().min(1).max(64),
  targetPort: z.string().max(64).optional().nullable(),
  edgeType: z.string().max(32).optional().default("default"),
  edgeStatus: z.enum(["active", "paused"]).optional().default("active"),
});

const orchestrationGraphSchema = z.object({
  nodes: z.array(orchestrationNodeSchema).default([]),
  edges: z.array(orchestrationEdgeSchema).default([]),
});

const processingStepTypeSchema = z.enum([
  "filter",
  "deduplicate",
  "format",
  "validate",
  "lookup_fill",
]);

const processingStepSchema = z.object({
  stepKey: z.string().min(1).max(64),
  stepName: z.string().min(1).max(128),
  stepType: processingStepTypeSchema,
  enabled: z.boolean().optional().default(true),
  config: z.record(z.string(), z.any()).optional().default({}),
});

const processingScopeModeSchema = z.preprocess((value) => {
  const mode = String(value || "").trim();
  if (!mode || mode === "all") return "all";
  if (["system_time_range", "time_range", "recent_days"].includes(mode)) return "system_time_range";
  return mode;
}, z.enum(["all", "system_time_range"]).optional().default("all"));

const processingScopeSchema = z.object({
  mode: processingScopeModeSchema,
  fieldName: optionalNullableTrimmedString(255),
  timeVariable: z.preprocess((value) => {
    const text = String(value || "").trim();
    return text || null;
  }, z.enum(["current_date", "current_time", "current_timestamp"]).optional().nullable()),
  timeFormat: optionalNullableTrimmedString(64),
  startOffset: z.coerce.number().int().min(-3650).max(3650).optional().nullable(),
  endOffset: z.coerce.number().int().min(-3650).max(3650).optional().nullable(),
  offsetUnit: z.preprocess((value) => {
    const text = String(value || "").trim();
    return text || null;
  }, z.enum(["day", "hour", "minute", "month"]).optional().nullable()),
}).optional().nullable();

const processingTargetMappingSchema = z.object({
  sourceField: z.string().min(1).max(255),
  targetField: z.string().min(1).max(255),
});

const processingTargetConfigSchema = z.object({
  targetMode: z.enum(["create", "existing", "source"]).optional().default("create"),
  writeMode: z.enum(["overwrite", "append"]).optional().default("overwrite"),
  targetDatabaseName: optionalNullableTrimmedString(128),
  targetTableName: optionalNullableTrimmedString(255),
  fieldMappings: z.array(processingTargetMappingSchema).max(300).optional().default([]),
}).optional().nullable();

const processingScheduleConfigSchema = z.object({
  enabled: z.boolean().optional().default(false),
  scheduleType: z.enum(["manual", "daily", "weekly", "cron"]).optional().default("manual"),
  executeTime: optionalNullableTrimmedString(16),
  executeDay: z.coerce.number().int().min(1).max(7).optional().nullable(),
  cronExpr: optionalNullableTrimmedString(128),
}).optional().nullable();

const processingPipelineSchema = z.object({
  sampleLimit: z.coerce.number().int().min(1).max(200).optional().default(50),
  scope: processingScopeSchema,
  schedule: processingScheduleConfigSchema,
  targetConfig: processingTargetConfigSchema,
  steps: z.array(processingStepSchema).max(300).default([]),
});

const processingJobSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(512).optional().nullable(),
  datasourceId: z.coerce.number().int().positive(),
  databaseName: z.string().max(128).optional().nullable(),
  tableName: z.string().min(1).max(255),
  targetTableName: z.string().max(255).optional().nullable(),
  outputMode: z.enum(["overwrite_source", "new_table", "preview_only"]).optional().default("new_table"),
  ownerName: z.string().max(64).optional().nullable(),
  tags: z.array(z.string().max(64)).optional().default([]),
  pipeline: processingPipelineSchema,
});

const processingPreviewSchema = z.object({
  datasourceId: z.coerce.number().int().positive(),
  databaseName: z.string().max(128).optional().nullable(),
  tableName: z.string().min(1).max(255),
  pipeline: processingPipelineSchema,
});

const processingRunSchema = z.object({
  versionNo: z.coerce.number().int().positive().optional().nullable(),
  outputMode: z.enum(["overwrite_source", "new_table", "preview_only"]).optional().nullable(),
  targetTableName: z.string().max(255).optional().nullable(),
});

module.exports = {
  createDatasourceSchema: datasourceSchema,
  testDatasourceSchema,
  updateDatasourceSchema: createDatasourcePayloadSchema(),
  createScriptFolderSchema: scriptFolderSchema,
  updateScriptFolderSchema: scriptFolderSchema,
  createScriptSchema: scriptSchema,
  updateScriptSchema: scriptSchema,
  executeQuerySchema: queryExecuteSchema,
  copilotTaskSchema,
  createWorkflowSchema: workflowSchema,
  updateWorkflowSchema: workflowSchema,
  workflowGraphSchema,
  runWorkflowSchema,
  createWorkflowFromTaskSchema,
  createOrchestrationTaskSchema: orchestrationTaskSchema,
  updateOrchestrationTaskSchema: orchestrationTaskSchema,
  orchestrationGraphSchema,
  createProcessingJobSchema: processingJobSchema,
  updateProcessingJobSchema: processingJobSchema,
  previewProcessingJobSchema: processingPreviewSchema,
  runProcessingJobSchema: processingRunSchema,
};
