const { z } = require("../../common/middleware/validate");

const researchItemEnum = z.enum([
  "table_classification",
  "table_relationship",
  "data_scale",
  "quality_inspection",
  "metadata_inspection",
  "ingestion_advice",
  "governance_advice",
  "analysis_advice"
]);

const createResearchRunSchema = z.object({
  tableScope: z.enum(["all", "manual"]).default("all"),
  selectedTables: z.array(z.string().trim().min(1)).max(500).optional().default([]),
  sampleSize: z.number().int().min(10).max(200).default(50),
  maxTables: z.number().int().min(1).max(500).default(50),
  rowCountMode: z.enum(["estimated", "exact"]).default("estimated"),
  metadataConcurrency: z.number().int().min(1).max(8).default(3),
  aiBatchSize: z.number().int().min(5).max(30).default(15),
  researchItems: z.array(researchItemEnum).min(1, "至少选择一个调研方向").max(8),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

const researchTaskBaseShape = {
  taskName: z.string().trim().min(1, "请输入调研任务名称").max(128),
  sourceId: z.number().int().positive("请选择数据源"),
  tableScope: z.enum(["all", "manual"]).default("all"),
  selectedTables: z.array(z.string().trim().min(1)).max(500).optional().default([]),
  sampleSize: z.number().int().min(10).max(200).default(50),
  maxTables: z.number().int().min(1).max(500).default(50),
  rowCountMode: z.enum(["estimated", "exact"]).default("estimated"),
  metadataConcurrency: z.number().int().min(1).max(8).default(3),
  aiBatchSize: z.number().int().min(5).max(30).default(15),
  researchItems: z.array(researchItemEnum).min(1, "至少选择一个调研方向").max(8),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  status: z.enum(["active", "disabled"]).optional().default("active"),
};

const createResearchTaskSchema = z.object(researchTaskBaseShape);

const updateResearchTaskSchema = z.object({
  ...researchTaskBaseShape,
  taskName: researchTaskBaseShape.taskName.optional(),
  sourceId: researchTaskBaseShape.sourceId.optional(),
  tableScope: researchTaskBaseShape.tableScope.optional(),
  selectedTables: researchTaskBaseShape.selectedTables.optional(),
  sampleSize: researchTaskBaseShape.sampleSize.optional(),
  maxTables: researchTaskBaseShape.maxTables.optional(),
  rowCountMode: researchTaskBaseShape.rowCountMode.optional(),
  metadataConcurrency: researchTaskBaseShape.metadataConcurrency.optional(),
  aiBatchSize: researchTaskBaseShape.aiBatchSize.optional(),
  researchItems: researchTaskBaseShape.researchItems.optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

const compareResearchReportsSchema = z.object({
  baseRunId: z.number().int().positive("请选择基准报告批次"),
  targetRunId: z.number().int().positive("请选择对比报告批次"),
});

module.exports = {
  createResearchRunSchema,
  createResearchTaskSchema,
  updateResearchTaskSchema,
  compareResearchReportsSchema,
  researchItemEnum
};
