import { Tag } from "antd";
import type { DataSourceResearchLogRecord, DataSourceResearchReport } from "../../types/api";

export type ResearchObjectLabels = {
  objectName: string;
  objectUnit: string;
  allScopePrefix: string;
  objectCountTitle: string;
  recordCountTitle: string;
  rowCountTitle: string;
  sampleSizeTitle: string;
  sampleSizeDescription: string;
  objectNameTitle: string;
  objectCommentTitle: string;
  objectTypeStatsTitle: string;
  objectDetailTitle: string;
  objectQualityTitle: string;
  recommendedObjectTitle: string;
  deferredObjectTitle: string;
  objectModeTitle: string;
  objectGovernanceTitle: string;
  coreObjectTitle: string;
  relationshipTitle: string;
  relationshipDescription: string;
  entityTitle: string;
  largeObjectTitle: string;
  smallObjectTitle: string;
  complexObjectTitle: string;
  defaultScaleSuggestion: string;
};

export type ResearchItemKey =
  | "table_classification"
  | "table_relationship"
  | "data_scale"
  | "quality_inspection"
  | "ingestion_advice"
  | "governance_advice"
  | "analysis_advice";

export const RESEARCH_ITEM_OPTIONS: Array<{ label: string; value: ResearchItemKey }> = [
  { label: "表分类", value: "table_classification" },
  { label: "表关系", value: "table_relationship" },
  { label: "数据规模", value: "data_scale" },
  { label: "数据质量", value: "quality_inspection" },
  { label: "接入建议", value: "ingestion_advice" },
  { label: "治理建议", value: "governance_advice" },
  { label: "分析建议", value: "analysis_advice" },
];

export const RESEARCH_ITEM_LABELS = Object.fromEntries(RESEARCH_ITEM_OPTIONS.map((item) => [item.value, item.label])) as Record<ResearchItemKey, string>;

const CATEGORY_LABELS: Record<string, string> = {
  business: "业务表",
  dictionary: "字典表",
  relation: "关联表",
  log: "日志表",
  temporary: "临时表",
  low_value: "低价值表",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const FIELD_ISSUE_LABELS: Record<string, string> = {
  missing_comment: "字段注释缺失",
  high_null_rate: "高空值率",
  low_cardinality: "低基数字段",
  high_cardinality: "高基数字段",
};

const AI_STAGE_LABELS: Record<string, string> = {
  table_classification: "表分类",
  report_aggregation: "全局汇总",
  table_relationship: "表关系",
  data_scale: "数据规模",
  quality_inspection: "数据质量",
  ingestion_advice: "接入建议",
  governance_advice: "治理建议",
  analysis_advice: "分析建议",
};

const RESEARCH_ITEM_ALIASES: Record<string, ResearchItemKey> = {
  metadata_inspection: "quality_inspection",
};

const DATABASE_OBJECT_LABELS: ResearchObjectLabels = {
  objectName: "表",
  objectUnit: "张",
  allScopePrefix: "全库",
  objectCountTitle: "调研表数",
  recordCountTitle: "累计行数",
  rowCountTitle: "行数",
  sampleSizeTitle: "数据抽样条数",
  sampleSizeDescription: "单表最大样本",
  objectNameTitle: "表名",
  objectCommentTitle: "表注释",
  objectTypeStatsTitle: "表类型分布",
  objectDetailTitle: "表探查明细",
  objectQualityTitle: "表级质量概览",
  recommendedObjectTitle: "优先接入表",
  deferredObjectTitle: "建议暂缓表",
  objectModeTitle: "表级接入模式建议",
  objectGovernanceTitle: "表级治理任务",
  coreObjectTitle: "核心业务表",
  relationshipTitle: "表关系",
  relationshipDescription: "表关系包含字段级关联，可按来源表或目标表筛选。",
  entityTitle: "实体表明细",
  largeObjectTitle: "大表",
  smallObjectTitle: "小表/空表",
  complexObjectTitle: "复杂表",
  defaultScaleSuggestion: "大表优先采用增量或分区策略，小表和字典表可合并到低频同步批次，复杂表接入前先确认主键、索引和字段口径。",
};

export function getResearchObjectLabels(sourceType?: unknown): ResearchObjectLabels {
  const normalized = String(sourceType || "").trim().toLowerCase();
  if (normalized === "ftp") {
    return {
      ...DATABASE_OBJECT_LABELS,
      objectName: "文件",
      objectUnit: "个",
      allScopePrefix: "目录",
      objectCountTitle: "调研文件数",
      recordCountTitle: "样例行数",
      rowCountTitle: "样例行数",
      sampleSizeTitle: "文件抽样行数",
      sampleSizeDescription: "单文件最大样本",
      objectNameTitle: "文件路径",
      objectCommentTitle: "文件信息",
      objectTypeStatsTitle: "文件类型分布",
      objectDetailTitle: "文件探查明细",
      objectQualityTitle: "文件级质量概览",
      recommendedObjectTitle: "优先接入文件",
      deferredObjectTitle: "建议暂缓文件",
      objectModeTitle: "文件级接入模式建议",
      objectGovernanceTitle: "文件级治理任务",
      coreObjectTitle: "核心文件",
      relationshipTitle: "文件关系",
      relationshipDescription: "文件关系包含字段级关联，可按来源文件或目标文件筛选。",
      entityTitle: "实体文件明细",
      largeObjectTitle: "大文件",
      smallObjectTitle: "小文件/空文件",
      complexObjectTitle: "复杂文件",
      defaultScaleSuggestion: "大文件优先控制预览大小并评估分批接入，小文件可合并到低频同步批次，结构复杂文件接入前先确认字段口径和编码格式。",
    };
  }
  if (normalized === "kafka") {
    return {
      ...DATABASE_OBJECT_LABELS,
      objectName: "Topic",
      objectUnit: "个",
      allScopePrefix: "Topic 清单",
      objectCountTitle: "调研 Topic 数",
      recordCountTitle: "消息样例数",
      rowCountTitle: "消息样例数",
      sampleSizeTitle: "消息抽样条数",
      sampleSizeDescription: "单 Topic 最大样本",
      objectNameTitle: "Topic 名称",
      objectCommentTitle: "Topic 信息",
      objectTypeStatsTitle: "Topic 类型分布",
      objectDetailTitle: "Topic 探查明细",
      objectQualityTitle: "Topic 级质量概览",
      recommendedObjectTitle: "优先接入 Topic",
      deferredObjectTitle: "建议暂缓 Topic",
      objectModeTitle: "Topic 级接入模式建议",
      objectGovernanceTitle: "Topic 级治理任务",
      coreObjectTitle: "核心 Topic",
      relationshipTitle: "Topic 关系",
      relationshipDescription: "Topic 关系包含字段级关联，可按来源 Topic 或目标 Topic 筛选。",
      entityTitle: "实体 Topic 明细",
      largeObjectTitle: "大 Topic",
      smallObjectTitle: "小 Topic/空 Topic",
      complexObjectTitle: "复杂 Topic",
      defaultScaleSuggestion: "高流量 Topic 优先采用限速消费和位点管理，低流量 Topic 可合并到低频接入批次，结构复杂消息接入前先确认消息格式、主键和事件时间。",
    };
  }
  return DATABASE_OBJECT_LABELS;
}

export function isResearchItemKey(value: unknown): value is ResearchItemKey {
  return RESEARCH_ITEM_OPTIONS.some((item) => item.value === value);
}

export function normalizeResearchItemKey(value: unknown): ResearchItemKey | null {
  const normalized = RESEARCH_ITEM_ALIASES[String(value || "")] || value;
  return isResearchItemKey(normalized) ? normalized : null;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function formatNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "-";
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return String(value);
  return numberValue.toLocaleString("zh-CN");
}

export function formatPercentage(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(2)}%`;
}

export function categoryLabel(value?: string) {
  return CATEGORY_LABELS[String(value || "").trim().toLowerCase()] || value || "-";
}

export function priorityLabel(value?: string) {
  return PRIORITY_LABELS[String(value || "").trim().toLowerCase()] || value || "-";
}

function issueTypeLabel(value?: unknown) {
  const text = String(value || "").trim();
  return FIELD_ISSUE_LABELS[text] || text || "其他问题";
}

export function stageLabel(value?: string) {
  return AI_STAGE_LABELS[String(value || "")] || value || "-";
}

export function renderStatusTag(status?: string | null) {
  const map: Record<string, { color: string; label: string }> = {
    active: { color: "processing", label: "启用" },
    disabled: { color: "default", label: "停用" },
    pending: { color: "default", label: "待执行" },
    running: { color: "processing", label: "运行中" },
    succeeded: { color: "success", label: "成功" },
    failed: { color: "error", label: "失败" },
    cancelled: { color: "orange", label: "已终止" },
  };
  const meta = map[String(status || "")] || { color: "default", label: status || "-" };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

export function formatLogLine(item: DataSourceResearchLogRecord) {
  const prefix = `[${formatDateTime(item.createdAt)}] [${item.logLevel.toUpperCase()}] ${item.message}`;
  const detail = item.detail || {};
  const tableName = String((detail as Record<string, unknown>).tableName || "").trim();
  return tableName ? `${prefix} | ${tableName}` : prefix;
}

export function sortResearchTables<T extends { category?: string; priority?: string; tableName?: string }>(tables: T[] = []) {
  const priorityWeight: Record<string, number> = { high: 1, medium: 2, low: 3 };
  const categoryWeight: Record<string, number> = { business: 1, dictionary: 2, relation: 3, log: 4, temporary: 5, low_value: 6 };
  return [...tables].sort((left, right) => {
    const leftPriority = priorityWeight[String(left.priority || "").toLowerCase()] || 99;
    const rightPriority = priorityWeight[String(right.priority || "").toLowerCase()] || 99;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    const leftCategory = categoryWeight[String(left.category || "").toLowerCase()] || 99;
    const rightCategory = categoryWeight[String(right.category || "").toLowerCase()] || 99;
    if (leftCategory !== rightCategory) return leftCategory - rightCategory;
    return String(left.tableName || "").localeCompare(String(right.tableName || ""), "zh-CN");
  });
}

export function buildReportMarkdown(report: DataSourceResearchReport) {
  const lines: string[] = [];
  const labels = getResearchObjectLabels(report.source?.sourceType);
  const tables = report.tables || [];
  const scaleInsight = report.insights?.dataScale;
  const largeTables = scaleInsight?.largeTables?.length
    ? scaleInsight.largeTables
    : tables.filter((item) => Number(item.rowCount || 0) >= 100000).map((item) => item.tableName);
  const smallOrEmptyTables = scaleInsight?.smallOrEmptyTables?.length
    ? scaleInsight.smallOrEmptyTables
    : tables.filter((item) => Number(item.rowCount || 0) <= 10).map((item) => item.tableName);
  const complexTables = scaleInsight?.complexTables?.length
    ? scaleInsight.complexTables
    : tables.filter((item) => Number(item.columnCount || 0) >= 30 || Number(item.constraints || 0) >= 5).map((item) => item.tableName);
  const scaleSuggestions = scaleInsight?.suggestions?.length
    ? scaleInsight.suggestions
    : [labels.defaultScaleSuggestion];
  lines.push(`# ${report.run.runName}`);
  lines.push("");
  lines.push("## 概览");
  lines.push(`- 数据源：${report.source.sourceName}`);
  lines.push(`- 类型：${report.source.sourceType}`);
  if (report.source.databaseName) {
    lines.push(`- 数据库：${report.source.databaseName}`);
  }
  lines.push(`- ${labels.objectCountTitle}：${report.overview.totalTables}`);
  lines.push(`- ${labels.recordCountTitle}：${report.overview.totalRowCount || "-"}`);
  lines.push(`- 总结：${report.overview.summary}`);
  lines.push("");
  lines.push("## 推荐结果");
  lines.push(`- 优先接入：${report.recommendations.recommendedTables.join("、") || "-"}`);
  lines.push(`- 建议暂缓：${report.recommendations.deferredTables.join("、") || "-"}`);
  lines.push("");
  lines.push("## 数据规模");
  lines.push(`- 总结：${scaleInsight?.summary || report.overview.summary || "-"}`);
  lines.push(`- ${labels.largeObjectTitle}：${largeTables.join("、") || "-"}`);
  lines.push(`- ${labels.smallObjectTitle}：${smallOrEmptyTables.join("、") || "-"}`);
  lines.push(`- ${labels.complexObjectTitle}：${complexTables.join("、") || "-"}`);
  lines.push(`- 建议：${scaleSuggestions.join("；") || "-"}`);
  lines.push("");
  if (report.insights?.dataQuality) {
    lines.push("## 数据质量");
    lines.push(`- 总结：${report.insights.dataQuality.summary || "-"}`);
    lines.push(`- 问题类型：${report.insights.dataQuality.issueTypeStats?.map((item) => `${issueTypeLabel(item.issueType)} ${item.count}`).join("、") || "-"}`);
    lines.push(`- 整改建议：${report.insights.dataQuality.suggestions?.join("；") || "-"}`);
    lines.push("");
  }
  if (report.insights?.ingestionAdvice) {
    lines.push("## 接入建议");
    lines.push(`- 总结：${report.insights.ingestionAdvice.summary || "-"}`);
    lines.push(`- 优先接入：${report.insights.ingestionAdvice.recommendedTables?.join("、") || report.recommendations.recommendedTables.join("、") || "-"}`);
    lines.push(`- 建议暂缓：${report.insights.ingestionAdvice.deferredTables?.join("、") || report.recommendations.deferredTables.join("、") || "-"}`);
    lines.push(`- 策略建议：${report.insights.ingestionAdvice.ingestionSuggestions?.join("；") || report.recommendations.ingestionSuggestions.join("；") || "-"}`);
    lines.push("");
  }
  if (report.insights?.governanceAdvice) {
    lines.push("## 治理建议");
    lines.push(`- 总结：${report.insights.governanceAdvice.summary || "-"}`);
    lines.push(`- 接入前处理：${report.insights.governanceAdvice.mustFixBeforeIngestion?.join("；") || "-"}`);
    lines.push(`- 持续优化：${report.insights.governanceAdvice.continuousImprovements?.join("；") || "-"}`);
    lines.push(`- 治理建议：${report.insights.governanceAdvice.governanceSuggestions?.join("；") || report.recommendations.governanceSuggestions.join("；") || "-"}`);
    lines.push("");
  }
  if (report.insights?.analysisAdvice) {
    lines.push("## 分析建议");
    lines.push(`- 总结：${report.insights.analysisAdvice.summary || "-"}`);
    lines.push(`- ${labels.coreObjectTitle}：${report.insights.analysisAdvice.coreBusinessTables?.map((item) => item.tableName).join("、") || "-"}`);
    lines.push(`- 深度分析方向：${report.insights.analysisAdvice.analysisDirections?.map((item) => item.direction).join("、") || "-"}`);
    lines.push(`- 分析建议：${report.insights.analysisAdvice.analysisSuggestions?.join("；") || report.recommendations.analysisSuggestions?.join("；") || "-"}`);
    lines.push(`- 持续关注：${report.insights.analysisAdvice.watchItems?.join("；") || "-"}`);
    lines.push(`- 待确认问题：${report.insights.analysisAdvice.followUpQuestions?.join("；") || "-"}`);
    lines.push("");
  }
  if (report.tableRelationships) {
    lines.push(`## ${labels.relationshipTitle}调研`);
    lines.push(`- 总结：${report.tableRelationships.summary || "-"}`);
    report.tableRelationships.relations.forEach((relation) => {
      lines.push(`- ${relation.fromTable}.${relation.fromField} -> ${relation.toTable}.${relation.toField}（${relation.relationType}）`);
    });
    lines.push("");
  }
  lines.push(`## ${labels.objectName}明细`);
  report.tables.forEach((table) => {
    lines.push(`### ${table.tableName}${table.tableComment ? `（${table.tableComment}）` : ""}`);
    lines.push(`- 分类：${categoryLabel(table.category)}`);
    lines.push(`- 优先级：${priorityLabel(table.priority)}`);
    lines.push(`- ${labels.rowCountTitle}：${table.rowCount ?? "-"}`);
    lines.push(`- 质量问题：${table.metadataIssues.map(issueTypeLabel).join("、") || "-"}`);
    lines.push("");
  });
  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
