const { z } = require("../../common/middleware/validate");

const reportDataSourceSchema = z.object({
  sourceName: z.string().min(2),
  sourceCode: z.string().min(2),
  sourceType: z.enum(["mysql", "postgresql", "gaussdb", "oracle", "dm", "hive", "jdbc"]),
  connectionConfig: z.record(z.any()).default({}),
  ownerName: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const reportDataSourceTestSchema = z.object({
  sourceType: z.enum(["mysql", "postgresql", "gaussdb", "oracle", "dm", "hive", "jdbc"]),
  connectionConfig: z.record(z.any()).default({}),
});

const datasetFieldSchema = z.object({
  columnName: z.string().min(1),
  label: z.string().optional(),
  dataType: z.string().optional(),
  role: z.enum(["dimension", "metric", "time", "category", "value"]).optional(),
  aggregation: z.enum(["sum", "avg", "count", "count_distinct", "max", "min"]).optional().nullable(),
  format: z.string().optional().nullable(),
  visible: z.boolean().optional(),
});

const reportDatasetFolderSchema = z.object({
  folderName: z.string().min(1).max(128),
  parentId: z.number().int().positive().optional().nullable(),
});

const reportDatasetSchema = z.object({
  datasetName: z.string().min(2),
  datasetCode: z.string().min(2).optional().nullable(),
  sourceId: z.number().int().positive(),
  folderId: z.number().int().positive().optional().nullable(),
  datasetType: z.enum(["table", "sql"]).default("table"),
  sourceTable: z.string().optional().nullable(),
  sourceSql: z.string().optional().nullable(),
  fields: z.array(datasetFieldSchema).default([]),
  queryConfig: z.record(z.any()).optional(),
  cacheConfig: z.record(z.any()).optional(),
  ownerName: z.string().optional(),
  status: z.enum(["draft", "active", "published", "inactive"]).default("draft"),
  description: z.string().optional().nullable(),
});

const datasetPreviewSchema = z.object({
  sourceId: z.number().int().positive(),
  datasetType: z.enum(["table", "sql"]).default("table"),
  sourceTable: z.string().optional().nullable(),
  sourceSql: z.string().optional().nullable(),
  limit: z.number().int().min(1).max(100).optional(),
});

const aiChartSqlPlanSchema = z.object({
  sourceId: z.number().int().positive(),
  prompt: z.string().min(2).max(2000),
  selectedTables: z.array(z.string().min(1).max(256)).max(5).optional(),
  currentSql: z.string().max(10000).optional().nullable(),
});

const aiChartAnalysisSuggestionSchema = z.object({
  sourceId: z.number().int().positive(),
  analysisDirection: z.string().max(2000).optional().nullable(),
  prompt: z.string().max(2000).optional().nullable(),
  selectedTables: z.array(z.string().min(1).max(256)).max(5).optional(),
});

const aiChartSqlRevisionSchema = z.object({
  sourceId: z.number().int().positive(),
  prompt: z.string().max(2000).optional().nullable(),
  selectedTables: z.array(z.string().min(1).max(256)).max(5).optional(),
  currentSql: z.string().min(1).max(20000),
  revisionInstruction: z.string().min(1).max(2000),
  lastQueryProfile: z.record(z.any()).optional().nullable(),
  lastError: z.string().max(2000).optional().nullable(),
});

const aiChartQuerySchema = z.object({
  sourceId: z.number().int().positive(),
  sourceSql: z.string().min(1).max(20000),
  limit: z.number().int().min(1).max(100).optional(),
});

const aiChartRecommendSchema = z.object({
  prompt: z.string().max(2000).optional(),
  sourceId: z.number().int().positive().optional(),
  sourceSql: z.string().max(20000).optional(),
  fields: z.array(datasetFieldSchema).default([]),
  sampleRows: z.array(z.record(z.any())).default([]),
  rowCount: z.number().int().min(0).optional(),
  profile: z.record(z.any()).optional(),
});

const aiChartFieldMapSchema = z.object({
  prompt: z.string().max(2000).optional().nullable(),
  sourceId: z.number().int().positive().optional(),
  sourceSql: z.string().max(20000).optional().nullable(),
  chartAssetId: z.number().int().positive(),
  chartFamily: z.string().max(64).optional().nullable(),
  fields: z.array(datasetFieldSchema).default([]),
  sampleRows: z.array(z.record(z.any())).default([]),
  rowCount: z.number().int().min(0).optional(),
  profile: z.record(z.any()).optional(),
  currentFieldMap: z.record(z.string()).optional(),
});

const reportChartAssetSchema = z.object({
  chartName: z.string().min(2),
  chartCode: z.string().min(2),
  chartType: z.enum(["echarts"]).default("echarts"),
  category: z.string().optional(),
  renderMode: z.enum(["dataset", "static"]).default("dataset"),
  coverImageUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  config: z.record(z.any()).optional(),
  optionTemplate: z.record(z.any()).optional(),
  mappingSchema: z.record(z.any()).optional(),
  ownerName: z.string().optional(),
  status: z.enum(["draft", "active", "inactive"]).default("draft"),
  isBuiltin: z.boolean().optional(),
});

const themeTemplateConfigSchema = z.object({
  canvas: z.record(z.any()).optional(),
  chrome: z.record(z.any()).optional(),
  semantic: z.record(z.any()).optional(),
  chartCommon: z.record(z.any()).optional(),
  chartVariants: z.record(z.any()).optional(),
});

const reportThemeTemplateSchema = z.object({
  themeName: z.string().min(2),
  themeCode: z.string().min(2),
  category: z.string().optional(),
  description: z.string().optional().nullable(),
  isBuiltin: z.boolean().optional(),
  status: z.enum(["draft", "active", "inactive"]).default("active"),
  previewImage: z.string().optional().nullable(),
  createdBy: z.string().optional(),
  ...themeTemplateConfigSchema.shape,
});

const reportDashboardWidgetSchema = z.object({
  widgetKey: z.string().min(1),
  widgetName: z.string().min(1),
  widgetType: z.enum(["chart", "kpi", "table", "text", "filter", "tabs", "richText", "image"]).default("chart"),
  datasetId: z.number().int().positive().nullable().optional(),
  chartAssetId: z.number().int().positive().nullable().optional(),
  position: z.record(z.any()).optional(),
  props: z.record(z.any()).optional(),
  queryParams: z.record(z.any()).optional(),
});

const reportDashboardSchema = z.object({
  dashboardName: z.string().min(2),
  dashboardCode: z.string().min(2).optional(),
  layoutMode: z.enum(["grid", "free"]).default("grid"),
  themeTemplateId: z.number().int().positive().nullable().optional(),
  themeSettings: z.object({
    defaultInheritTheme: z.boolean().optional(),
    inheritCanvasBackground: z.boolean().optional(),
    allowWidgetThemeOverride: z.boolean().optional(),
  }).optional(),
  themeConfig: z.record(z.any()).optional(),
  filterConfig: z.record(z.any()).optional(),
  canvasConfig: z.record(z.any()).optional(),
  ownerName: z.string().optional(),
  status: z.enum(["draft", "published", "inactive"]).default("draft"),
  description: z.string().optional().nullable(),
  widgets: z.array(reportDashboardWidgetSchema).default([]),
});

const dashboardPreviewSchema = z.object({
  widgetKey: z.string().min(1).optional(),
  widgetType: z.enum(["chart", "kpi", "table", "tabs"]).default("chart"),
  chartAssetId: z.number().int().positive().optional().nullable(),
  datasetId: z.number().int().positive().optional(),
  sourceId: z.number().int().positive().optional(),
  datasetType: z.enum(["table", "sql"]).optional(),
  sourceTable: z.string().optional().nullable(),
  sourceSql: z.string().optional().nullable(),
  chartFamily: z.string().optional(),
  variantName: z.string().optional(),
  accentColor: z.string().optional(),
  palettePreset: z.string().optional(),
  fieldMap: z.record(z.string()).optional(),
  chrome: z.record(z.any()).optional(),
  chartStyle: z.record(z.any()).optional(),
  mapStyle: z.record(z.any()).optional(),
  chartAnalysis: z.record(z.any()).optional(),
  kpi: z.record(z.any()).optional(),
  kpiStyle: z.record(z.any()).optional(),
  kpiAnalysis: z.record(z.any()).optional(),
  table: z.record(z.any()).optional(),
  tableStyle: z.record(z.any()).optional(),
  tabs: z.array(z.record(z.any())).optional(),
  tabsStyle: z.record(z.any()).optional(),
  limit: z.number().int().min(1).max(100).optional(),
}).superRefine((value, ctx) => {
  if (value.widgetType === "chart" && !value.chartAssetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["chartAssetId"],
      message: "图表预览必须指定 chartAssetId",
    });
  }
  if (value.widgetType === "tabs" && !value.chartAssetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["chartAssetId"],
      message: "页签窗口预览当前至少需要一个图表 chartAssetId",
    });
  }
});

module.exports = {
  aiChartAnalysisSuggestionSchema,
  aiChartFieldMapSchema,
  aiChartQuerySchema,
  aiChartRecommendSchema,
  aiChartSqlPlanSchema,
  aiChartSqlRevisionSchema,
  dashboardPreviewSchema,
  datasetPreviewSchema,
  reportChartAssetSchema,
  reportDashboardSchema,
  reportDataSourceSchema,
  reportDataSourceTestSchema,
  reportDatasetFolderSchema,
  reportDatasetSchema,
  reportThemeTemplateSchema,
};
