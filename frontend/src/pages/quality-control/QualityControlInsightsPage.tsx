import { CheckCircleOutlined, ClockCircleOutlined, DatabaseOutlined, FileTextOutlined, FullscreenExitOutlined, FullscreenOutlined, ReloadOutlined, SafetyCertificateOutlined, ThunderboltOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Drawer, Empty, Form, Input, Modal, Segmented, Select, Space, Spin, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useAuth } from "../../app/providers/AuthProvider";
import { formatQualityBatchId } from "../../utils/qualityBatch";
import {
  createQualityInsightReport,
  fetchQualityBatchComparison,
  fetchQualityObservability,
  fetchQualityTableBatches,
  fetchQualityOpsDashboard,
  fetchQualityOpsDrilldown,
  fetchQualityIssues,
  fetchQualityReports,
  fetchQualitySystemInsights,
  fetchQualityTableInsights,
  fetchQualityInsightBusinessSystems,
  fetchQualityInsightTags,
  refreshQualityFindings,
  runQualityAiAnalysis,
  saveQualityInsightTag,
  updateQualityMonitorTableGovernance,
} from "../../services/qualityControl";
import { QualityOpsRobot } from "./QualityOpsRobot";
import "./qualityOpsDashboard.css";

type SystemRow = { businessSystemId?: number | null; systemName: string; tableCount: number; batchCount: number; issueRows: number; score: number | null; partialBatchCount: number };
type TableRow = { monitorTableId: number; businessSystemId?: number | null; tableName: string; tableComment?: string; systemName: string; tags: string[]; batchCount: number; issueRows: number; score: number | null; latestCompletedAt?: string };
type DashboardRange = "24h" | "7d" | "30d";
type DrilldownContext = {
  scene: string;
  targetBusinessSystemId?: number;
  monitorTableId?: number;
  strategyVersionId?: number | null;
  ruleCode?: string | null;
  fieldName?: string | null;
  dimension?: string;
  itemType?: "issue" | "finding";
  itemId?: number;
};
type DrilldownData = {
  scene: string;
  title: string;
  metricValue: number | string | null;
  metricUnit?: string;
  total: number;
  summary?: string;
  rangeLabel?: string;
  scopeName?: string;
  columns: Array<{ key: string; title: string; format?: "score" | "percent" | "datetime" | "date" | "hours" }>;
  rows: Array<Record<string, any>>;
};
type QualityOpsDashboard = {
  generatedAt: string;
  scope?: { type: "project" | "system"; businessSystemId?: number | null; systemName?: string | null };
  snapshotAt?: string | null;
  range: DashboardRange;
  trendMode: "hour" | "day" | "batch";
  health: { overallScore: number | null; scoreChange: number | null; grade: string; rulePassRate: number; anomalyRate: number; totalRules: number; failedRules: number; checkedRows: number; anomalyHits: number };
  coverage: { monitoredTableCount: number; enabledTableCount: number; strategyTableCount: number; strategyCoverageRate: number; resultTableCount: number; resultCoverageRate: number; mappedTableCount: number; mappingRate: number; importantTableCount: number; importantCoveredCount: number; importantCoverageRate: number; uncoveredTableCount: number; unconfiguredTableCount: number; unmappedTableCount: number };
  issues: { findingCount: number; pendingFindingCount: number; confirmedFindingCount: number; recurringFindingCount: number; highRiskFindingCount: number; newFindingCount: number; issueCount: number; openIssueCount: number; closedIssueCount: number; overdueIssueCount: number; resolvedInRange: number; closureRate: number; averageResolutionHours: number | null; status: Array<{ issueStatus: string; issueCount: number }>; severity: Array<{ severity: string; findingCount: number }> };
  dimensions: Array<{ key: string; name: string; color: string; covered: boolean; score: number | null; scoreChange: number | null; strategyCount: number; previousStrategyCount: number; ruleCount: number; failedRuleCount: number; checkedRows: number; issueRows: number; issueRate: number }>;
  trend: Array<{ key: string; label: string; completedAt: string; objectName?: string; score: number | null; anomalyRate: number; rulePassRate: number; issueRows: number; checkedRows: number; runCount: number }>;
  issueFlow?: { mode?: "system" | "table"; nodes: Array<{ key: string; type: "system" | "table" | "dimension" | "severity"; label: string; value: number }>; links: Array<{ source: string; target: string; value: number }> };
  topRules?: Array<{ monitorTableId?: number | null; tableName?: string | null; strategyId?: number | null; strategyVersionId?: number | null; strategyVersionNo?: number | null; taskName?: string | null; ruleCode: string; ruleName: string; fieldName?: string | null; severity: string; issueRows: number; totalRows: number; issueRate: number }>;
  riskAssets: Array<{ monitorTableId: number; tableName: string; systemName: string; importanceLevel: string; score: number | null; scoreChange: number | null; anomalyRate: number; rulePassRate: number; failedRuleCount: number; issueRows: number; completedAt: string; status: string }>;
  priorityItems: Array<{ itemType: "issue" | "finding"; id: number; title: string; status: string; severity: string; ownerName?: string | null; dueDate?: string | null; updatedAt?: string | null; occurrenceCount: number; tableName?: string | null; systemName?: string | null; ruleCode?: string | null; fieldName?: string | null; overdue: boolean }>;
  scale: { runCount: number; systemCount: number };
};

function scoreColor(score?: number | null) { return score === null || score === undefined ? "default" : score >= 95 ? "green" : score >= 80 ? "gold" : "red"; }
function formatTime(value?: string | null) { return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-"; }
function qualityDimensionLabel(value?: string | null) {
  const labels: Record<string, string> = {
    completeness: "完整性", uniqueness: "唯一性", consistency: "一致性", timeliness: "时效性", stability: "稳定性",
    non_null: "完整性", duplicate: "唯一性", compliance: "有效性", value_range: "有效性",
    conditional_required: "完整性", conditional_regex: "有效性", field_compare: "一致性", composite_unique: "唯一性",
    freshness: "时效性", volume_anomaly: "稳定性", null_rate_change: "稳定性", batch_completeness: "完整性",
    cross_table_lookup: "一致性", cross_table_consistency: "一致性",
  };
  return labels[String(value || "")] || "其他";
}

function qualityRuleDisplayName(ruleName?: string | null, ruleCode?: string | null) {
  const visibleName = String(ruleName || "").trim();
  if (/[\u4e00-\u9fa5]/.test(visibleName)) return visibleName;
  const source = `${visibleName} ${ruleCode || ""}`.toLowerCase();
  if (/non[_-]?null|required|complete/.test(source)) return "完整性校验";
  if (/duplicate|unique/.test(source)) return "唯一性校验";
  if (/cross|reconcil|compare|consistent|lookup/.test(source)) return "一致性校验";
  if (/fresh|timely|date|time/.test(source)) return "时效性校验";
  if (/volume|anomaly|change|stability/.test(source)) return "稳定性校验";
  if (/regex|pattern|range|domain|compliance|format/.test(source)) return "合规性校验";
  return "质量规则";
}

function severityLabel(value?: string | null) {
  return ({ critical: "严重", high: "高", medium: "中", low: "低" } as Record<string, string>)[String(value || "")] || "其他";
}

function issueStatusLabel(value?: string | null) {
  return ({ pending: "待处理", processing: "处理中", verifying: "待验证", completed: "已完成", ignored: "已忽略" } as Record<string, string>)[String(value || "")] || "其他";
}

function scoreStatus(score: number) {
  if (score >= 95) return { label: "质量优秀", tone: "good" };
  if (score >= 85) return { label: "运行健康", tone: "stable" };
  if (score >= 70) return { label: "需要关注", tone: "warning" };
  return { label: "重点治理", tone: "danger" };
}

function formatCompactNumber(value?: number | null) {
  const numberValue = Number(value || 0);
  if (Math.abs(numberValue) >= 100000000) return `${(numberValue / 100000000).toFixed(1)}亿`;
  if (Math.abs(numberValue) >= 10000) return `${(numberValue / 10000).toFixed(1)}万`;
  return numberValue.toLocaleString("zh-CN");
}

function deltaText(value?: number | null, suffix = "") {
  if (value === null || value === undefined) return "暂无可比基线";
  if (Number(value) === 0) return "较上期持平";
  return `较上期 ${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(1)}${suffix}`;
}

function QualityPanel(props: { title: string; subtitle?: string; className?: string; extra?: ReactNode; children: ReactNode }) {
  const { title, subtitle, className = "", extra, children } = props;
  return <section className={`quality-ops-panel ${className}`.trim()}>
    <div className="quality-ops-panel__header">
      <div>
        <div className="quality-ops-panel__title">{title}</div>
        {subtitle ? <div className="quality-ops-panel__subtitle">{subtitle}</div> : null}
      </div>
      {extra ? <div className="quality-ops-panel__extra">{extra}</div> : null}
    </div>
    <div className="quality-ops-panel__body">{children}</div>
  </section>;
}

export function QualityControlInsightsPage() {
  const { message } = App.useApp();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<QualityOpsDashboard | null>(null);
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [compareTableId, setCompareTableId] = useState<number>();
  const [comparison, setComparison] = useState<any>(null);
  const [batchOptions, setBatchOptions] = useState<any[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<number>();
  const [previousBatchId, setPreviousBatchId] = useState<number>();
  const [observability, setObservability] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [systemsOptions, setSystemsOptions] = useState<Array<{ id: number; systemName: string }>>([]);
  const [tagOptions, setTagOptions] = useState<Array<{ id: number; tagName: string }>>([]);
  const [governanceRow, setGovernanceRow] = useState<TableRow | null>(null);
  const [governanceSaving, setGovernanceSaving] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [range, setRange] = useState<DashboardRange>("7d");
  const [businessSystemId, setBusinessSystemId] = useState<number>();
  const [isExpanded, setIsExpanded] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("systems");
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState<DrilldownData | null>(null);
  const [governanceForm] = Form.useForm();
  const loadSequenceRef = useRef(0);

  async function load(silent = false) {
    if (!token) return;
    const requestId = ++loadSequenceRef.current;
    setLoading(true);
    try {
      const [dashboardResponse, systemResponse, tableResponse, reportResponse, issueResponse, businessSystemResponse, tagResponse] = await Promise.all([
        fetchQualityOpsDashboard(token, range, businessSystemId),
        fetchQualitySystemInsights(token, { latestOnly: true, businessSystemId }),
        fetchQualityTableInsights(token, { businessSystemId, latestOnly: true }),
        fetchQualityReports(token),
        fetchQualityIssues(token, { businessSystemId }),
        fetchQualityInsightBusinessSystems(token),
        fetchQualityInsightTags(token),
      ]);
      if (requestId !== loadSequenceRef.current) return;
      setDashboard(dashboardResponse.data || null);
      setSystems(systemResponse.data || []);
      setTables(tableResponse.data || []);
      setReports(reportResponse.data || []);
      setIssues(issueResponse.data || []);
      setSystemsOptions(businessSystemResponse.data || []);
      setTagOptions(tagResponse.data || []);
    } catch (error) {
      if (requestId === loadSequenceRef.current && !silent) message.error(error instanceof Error ? error.message : "加载质量运营数据失败");
    } finally { if (requestId === loadSequenceRef.current) setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("quality-ops-expanded", isExpanded);
    return () => document.body.classList.remove("quality-ops-expanded");
  }, [isExpanded]);

  useEffect(() => {
    if (!token) return;
    void load(true);
    const timer = window.setInterval(() => void load(true), 60000);
    return () => window.clearInterval(timer);
  }, [token, range, businessSystemId]);

  async function loadComparison(tableId?: number, nextCurrentBatchId?: number, nextPreviousBatchId?: number) {
    if (!token || !tableId) return;
    setCompareTableId(tableId);
    try {
      const batchResponse = batchOptions.length && compareTableId === tableId ? { data: batchOptions } : await fetchQualityTableBatches(token, tableId);
      const rows = batchResponse.data || [];
      setBatchOptions(rows);
      const currentId = nextCurrentBatchId || currentBatchId || rows[0]?.id;
      const previousId = nextPreviousBatchId || previousBatchId || rows.find((item: any) => item.id !== currentId)?.id;
      setCurrentBatchId(currentId);
      setPreviousBatchId(previousId);
      const [comparisonResponse, observabilityResponse] = await Promise.all([
        fetchQualityBatchComparison(token, tableId, currentId, previousId),
        fetchQualityObservability(token, tableId),
      ]);
      setComparison(comparisonResponse.data);
      setObservability(observabilityResponse.data);
    }
    catch (error) { message.error(error instanceof Error ? error.message : "加载跨批次分析失败"); }
  }

  async function openDrilldown(context: DrilldownContext) {
    if (!token) return;
    setDrilldownOpen(true);
    setDrilldownLoading(true);
    setDrilldownData(null);
    try {
      const response = await fetchQualityOpsDrilldown(token, {
        ...context,
        range,
        businessSystemId,
        targetBusinessSystemId: context.targetBusinessSystemId,
        strategyVersionId: context.strategyVersionId || undefined,
        ruleCode: context.ruleCode || undefined,
        fieldName: context.fieldName || undefined,
      });
      setDrilldownData(response.data || null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载指标明细失败");
      setDrilldownOpen(false);
    } finally {
      setDrilldownLoading(false);
    }
  }

  async function generateReport(scope: "system" | "table" | "comparison", scopeRefId?: number | null, title?: string) {
    if (!token) return;
    try {
      await createQualityInsightReport(token, { reportScope: scope, scopeRefId, reportTitle: title });
      message.success("报告已生成，可在报告记录中查看");
      await load();
    } catch (error) { message.error(error instanceof Error ? error.message : "生成报告失败"); }
  }

  async function refreshFindings() {
    if (!token) return;
    try { const response = await refreshQualityFindings(token); message.success(`已刷新 ${response.data.total} 条待确认异常`); await load(); }
    catch (error) { message.error(error instanceof Error ? error.message : "刷新待确认异常失败"); }
  }

  async function analyseComparison() {
    if (!token || !compareTableId) return;
    try {
      const response = await runQualityAiAnalysis(token, { scopeType: "comparison", scopeRefId: compareTableId });
      setAiAnalysis(response.data.ai);
      message.success(response.data.ai?.available ? "AI 研判已生成" : "已返回确定性统计说明");
    } catch (error) { message.error(error instanceof Error ? error.message : "AI 研判失败"); }
  }

  function openGovernance(row: TableRow) {
    setGovernanceRow(row);
    const system = systemsOptions.find((item) => item.systemName === row.systemName);
    governanceForm.setFieldsValue({ businessSystemId: system?.id, importanceLevel: "normal", tagIds: tagOptions.filter((item) => row.tags.includes(item.tagName)).map((item) => item.id) });
  }

  async function saveGovernance() {
    if (!token || !governanceRow) return;
    const values = await governanceForm.validateFields();
    setGovernanceSaving(true);
    try {
      const newTagName = String(values.newTagName || "").trim();
      if (newTagName) await saveQualityInsightTag(token, { tagName: newTagName });
      const refreshedTags = newTagName ? (await fetchQualityInsightTags(token)).data : tagOptions;
      if (newTagName) setTagOptions(refreshedTags);
      await updateQualityMonitorTableGovernance(token, governanceRow.monitorTableId, { businessSystemId: values.businessSystemId || null, importanceLevel: values.importanceLevel, tagIds: [...(values.tagIds || []), ...refreshedTags.filter((item) => item.tagName === newTagName).map((item) => item.id)] });
      message.success("表级系统归属与标签已保存");
      setGovernanceRow(null);
      await load();
    } catch (error) { message.error(error instanceof Error ? error.message : "保存治理配置失败"); }
    finally { setGovernanceSaving(false); }
  }

  const systemColumns: ColumnsType<SystemRow> = [
    { title: "所属系统", dataIndex: "systemName", key: "systemName", render: (value) => <Typography.Text strong>{value}</Typography.Text> },
    { title: "纳管表", dataIndex: "tableCount", key: "tableCount", width: 90 },
    { title: "运行批次", dataIndex: "batchCount", key: "batchCount", width: 100 },
    { title: "问题行", dataIndex: "issueRows", key: "issueRows", width: 100, render: (value) => <Typography.Text type={Number(value) ? "danger" : undefined}>{value}</Typography.Text> },
    { title: "质量得分", dataIndex: "score", key: "score", width: 130, render: (value) => <Tag color={scoreColor(value)}>{value === null ? "待积累" : `${value} 分`}</Tag> },
    { title: "口径提示", key: "partial", width: 130, render: (_v, row) => row.partialBatchCount ? <Tag color="gold">含 {row.partialBatchCount} 个部分可评估批次</Tag> : <Tag color="green">统计完整</Tag> },
    { title: "操作", key: "action", width: 110, render: (_v, row) => <Button type="link" disabled={!row.businessSystemId} onClick={() => void generateReport("system", row.businessSystemId, `${row.systemName}数据质量报告`)}>生成报告</Button> },
  ];
  const tableColumns: ColumnsType<TableRow> = [
    { title: "监控表", dataIndex: "tableName", key: "tableName", render: (value, row) => <Space direction="vertical" size={0}><Typography.Text strong>{value}</Typography.Text><Typography.Text type="secondary">{row.tableComment || "未填写表说明"}</Typography.Text></Space> },
    { title: "所属系统", dataIndex: "systemName", key: "systemName", width: 140 },
    { title: "标签", dataIndex: "tags", key: "tags", width: 160, render: (tags: string[]) => tags?.length ? tags.map((tag) => <Tag key={tag} color="blue">{tag}</Tag>) : <Typography.Text type="secondary">未标记</Typography.Text> },
    { title: "问题行", dataIndex: "issueRows", key: "issueRows", width: 100 },
    { title: "质量得分", dataIndex: "score", key: "score", width: 120, render: (value) => <Tag color={scoreColor(value)}>{value === null ? "待积累" : `${value} 分`}</Tag> },
    { title: "最新运行", dataIndex: "latestCompletedAt", key: "latestCompletedAt", width: 180, render: formatTime },
    { title: "操作", key: "action", width: 220, render: (_v, row) => <Space size={0}><Button type="link" onClick={() => openGovernance(row)}>归属与标签</Button><Button type="link" onClick={() => void loadComparison(row.monitorTableId)}>趋势比较</Button><Button type="link" onClick={() => void generateReport("table", row.monitorTableId, `${row.tableName}数据质量报告`)}>报告</Button></Space> },
  ];
  const drilldownColumns: ColumnsType<Record<string, any>> = (drilldownData?.columns || []).map((column) => ({
    title: column.title,
    dataIndex: column.key,
    key: column.key,
    ellipsis: column.key === "issueTitle" || column.key === "ruleName" || column.key === "strategyName",
    render: (value: any) => {
      if (value === null || value === undefined || value === "") return <Typography.Text type="secondary">-</Typography.Text>;
      if (column.format === "datetime") return formatTime(value);
      if (column.format === "date") return new Date(value).toLocaleDateString("zh-CN");
      if (column.format === "score") return <Tag color={scoreColor(Number(value))}>{Number(value).toFixed(2)} 分</Tag>;
      if (column.format === "percent") return `${Number(value).toFixed(2)}%`;
      if (column.format === "hours") return `${Number(value).toFixed(1)} 小时`;
      if (["severityLabel", "findingStatusLabel", "issueStatusLabel", "resultStatusLabel", "strategyStatusLabel", "evaluationStatusLabel"].includes(column.key)) {
        const warning = ["严重", "高", "待确认", "待处理", "处理中", "待验证", "未覆盖", "未配置", "已重开", "不可评估"].includes(String(value));
        return <Tag color={warning ? "orange" : "green"}>{String(value)}</Tag>;
      }
      return String(value);
    },
  }));
  const selectedTable = useMemo(() => tables.find((item) => item.monitorTableId === compareTableId), [tables, compareTableId]);
  const selectedBusinessSystem = systemsOptions.find((item) => item.id === businessSystemId);
  const scopeSystemName = dashboard?.scope?.systemName || selectedBusinessSystem?.systemName;
  const currentScoreStatus = scoreStatus(Number(dashboard?.health.overallScore || 0));
  const kpis = dashboard ? [
    { key: "pass", label: "规则通过率", value: dashboard.health.rulePassRate, digits: 1, unit: "%", note: `${dashboard.health.totalRules - dashboard.health.failedRules}/${dashboard.health.totalRules} 条规则通过`, tone: dashboard.health.rulePassRate >= 90 ? "stable" : "warning", icon: <CheckCircleOutlined />, scene: "rule_pass" },
    { key: "anomaly", label: "异常命中率", value: dashboard.health.anomalyRate, digits: 2, unit: "%", note: `${formatCompactNumber(dashboard.health.anomalyHits)} / ${formatCompactNumber(dashboard.health.checkedRows)} 检查记录`, tone: dashboard.health.anomalyRate <= 5 ? "stable" : dashboard.health.anomalyRate <= 15 ? "warning" : "danger", icon: <WarningOutlined />, scene: "anomaly_rate" },
    { key: "coverage", label: "结果覆盖率", value: dashboard.coverage.resultCoverageRate, digits: 1, unit: "%", note: `${dashboard.coverage.resultTableCount}/${dashboard.coverage.monitoredTableCount} 张表已有最新结果`, tone: dashboard.coverage.resultCoverageRate >= 80 ? "stable" : "warning", icon: <DatabaseOutlined />, scene: "result_coverage" },
    { key: "findings", label: "待确认异常", value: dashboard.issues.pendingFindingCount, digits: 0, unit: "项", note: `本期新增 ${dashboard.issues.newFindingCount} 项 · 复发 ${dashboard.issues.recurringFindingCount} 项`, tone: dashboard.issues.pendingFindingCount ? "warning" : "stable", icon: <ThunderboltOutlined />, scene: "pending_findings" },
    { key: "issues", label: "待处置问题", value: dashboard.issues.openIssueCount, digits: 0, unit: "项", note: `超期 ${dashboard.issues.overdueIssueCount} 项 · 闭环率 ${dashboard.issues.closureRate}%`, tone: dashboard.issues.overdueIssueCount ? "danger" : dashboard.issues.openIssueCount ? "warning" : "stable", icon: <ClockCircleOutlined />, scene: "open_issues" },
  ] : [];
  const trendOption = useMemo(() => ({
    animationDuration: 500,
    tooltip: { trigger: "axis", backgroundColor: "rgba(255,255,255,.98)", borderColor: "rgba(26,132,177,.28)", textStyle: { color: "#163f54" }, formatter: (items: any[]) => { const first = items?.[0]?.data || {}; const lines = [`${first.objectName ? `${first.objectName}<br/>` : ""}${first.completedAt ? formatTime(first.completedAt) : ""}`]; items.forEach((item) => lines.push(`${item.marker}${item.seriesName}：${Number(item.value ?? 0).toFixed(item.seriesName === "异常命中率" ? 2 : 1)}%`)); return lines.join("<br/>"); } },
    legend: { data: ["质量得分", "规则通过率", "异常命中率"], top: 2, right: 8, itemWidth: 17, itemHeight: 9, itemGap: 14, textStyle: { color: "#476f84", fontSize: 11 } },
    grid: { left: 42, right: 14, top: 32, bottom: 26 },
    xAxis: { type: "category", boundaryGap: false, data: dashboard?.trend.map((item) => item.label) || [], axisLine: { lineStyle: { color: "rgba(65,134,164,.24)" } }, axisTick: { show: false }, axisLabel: { color: "#66889a", fontSize: 11, interval: 0, hideOverlap: true } },
    yAxis: { type: "value", min: 0, max: 100, axisLabel: { color: "#66889a", fontSize: 11, formatter: "{value}%" }, splitLine: { lineStyle: { color: "rgba(74,139,166,.12)" } } },
    series: [
      { name: "质量得分", type: "line", smooth: 0.3, symbol: "circle", symbolSize: 6, lineStyle: { width: 3, color: "#1677ff" }, itemStyle: { color: "#fff", borderColor: "#1677ff", borderWidth: 2 }, areaStyle: { color: "rgba(22,119,255,.11)" }, data: dashboard?.trend.map((item) => ({ ...item, value: item.score })) || [] },
      { name: "规则通过率", type: "line", smooth: 0.3, symbol: "none", lineStyle: { width: 2.2, color: "#12a779" }, data: dashboard?.trend.map((item) => ({ ...item, value: item.rulePassRate })) || [] },
      { name: "异常命中率", type: "line", smooth: 0.3, symbol: "none", lineStyle: { width: 2, type: "dashed", color: "#e49a19" }, data: dashboard?.trend.map((item) => ({ ...item, value: item.anomalyRate })) || [] },
    ],
  }), [dashboard]);
  const issueFlowOption = useMemo(() => ({
    tooltip: { trigger: "item", backgroundColor: "rgba(255,255,255,.98)", borderColor: "rgba(22,119,255,.2)", textStyle: { color: "#21445a" }, formatter: (params: any) => params.dataType === "edge" ? `${params.data.sourceLabel || ""} → ${params.data.targetLabel || ""}<br/>问题行：${formatCompactNumber(params.data.value)}` : `${params.data.label}<br/>问题行：${formatCompactNumber(params.data.value)}` },
    series: [{
      type: "sankey", left: 10, right: 60, top: 6, bottom: 6, nodeWidth: 16, nodeGap: 12, draggable: false, emphasis: { focus: "adjacency" },
      label: { color: "#365f74", fontSize: 11, width: 116, overflow: "truncate", formatter: (params: any) => params.data.label },
      lineStyle: { color: "gradient", opacity: 0.28, curveness: 0.5 },
      data: dashboard?.issueFlow?.nodes.map((item) => ({ name: item.key, label: item.label, value: item.value, itemStyle: { color: item.type === "system" || item.type === "table" ? "#4d9fff" : item.type === "dimension" ? "#29b6a6" : item.key.endsWith("critical") ? "#ef5364" : item.key.endsWith("high") ? "#ff8a5b" : item.key.endsWith("medium") ? "#f2b441" : "#71bd91", borderColor: "rgba(255,255,255,.8)", borderWidth: 1 } })) || [],
      links: dashboard?.issueFlow?.links.map((item) => ({ ...item, sourceLabel: dashboard.issueFlow?.nodes.find((node) => node.key === item.source)?.label, targetLabel: dashboard.issueFlow?.nodes.find((node) => node.key === item.target)?.label })) || [],
    }],
  }), [dashboard]);
  const topRuleRows = dashboard?.topRules?.slice(0, 5) || [];
  const topRuleMax = Math.max(1, ...topRuleRows.map((item) => Number(item.issueRows || 0)));
  const dimensionRadarOption = useMemo(() => {
    const dimensions = dashboard?.dimensions || [];
    const current = dimensions.map((item) => item.score ?? 0);
    const previous = dimensions.map((item) => item.score === null || item.scoreChange === null ? item.score ?? 0 : Math.max(0, Math.min(100, item.score - item.scoreChange)));
    return {
      animationDuration: 500,
      tooltip: {
        trigger: "item",
        confine: true,
        padding: 0,
        borderWidth: 0,
        backgroundColor: "rgba(255,255,255,.98)",
        textStyle: { color: "#21445a" },
        extraCssText: "border-radius:10px;box-shadow:0 8px 24px rgba(26,83,108,.16);",
        formatter: (params: any) => {
          const values = Array.isArray(params.value) ? params.value : [];
          const previousBatch = Number(params.seriesIndex) === 1;
          const dimensionCards = dimensions.map((item, index) => {
            const strategyCount = previousBatch ? item.previousStrategyCount : item.strategyCount;
            const score = strategyCount > 0 ? `${Number(values[index] ?? 0).toFixed(1)}` : "--";
            return `<div class="quality-ops-radar-tooltip__item"><span><i style="background:${item.color}"></i>${item.name}</span><strong>${score}<small>${strategyCount > 0 ? "分" : "未覆盖"}</small></strong><em>${strategyCount} 个策略</em></div>`;
          }).join("");
          return `<div class="quality-ops-radar-tooltip"><div class="quality-ops-radar-tooltip__head"><strong>${params.marker}${params.name}</strong><span>各维度按覆盖策略等权平均</span></div><div class="quality-ops-radar-tooltip__grid">${dimensionCards}</div></div>`;
        },
      },
      legend: { bottom: 0, left: "center", itemWidth: 14, itemHeight: 8, itemGap: 12, textStyle: { color: "#52788b", fontSize: 11 } },
      radar: {
        center: ["50%", "46%"], radius: "64%", splitNumber: 5, axisNameGap: 2,
        indicator: dimensions.map((item) => ({ name: item.name, max: 100 })),
        axisName: { color: "#365f73", fontSize: 11, fontWeight: 600, lineHeight: 14 },
        axisLine: { lineStyle: { color: "rgba(48,135,170,.25)" } },
        splitLine: { lineStyle: { color: ["rgba(43,143,178,.28)", "rgba(43,143,178,.18)", "rgba(43,143,178,.13)", "rgba(43,143,178,.1)"] } },
        splitArea: { areaStyle: { color: ["rgba(218,244,248,.56)", "rgba(240,250,253,.76)", "rgba(225,244,250,.46)", "rgba(250,253,255,.86)"] } },
      },
      series: [{ type: "radar", symbolSize: 6, data: [
        { name: "当前批次", value: current, lineStyle: { width: 2.6, color: "#12a79d", shadowColor: "rgba(18,167,157,.24)", shadowBlur: 8 }, itemStyle: { color: "#fff", borderColor: "#12a79d", borderWidth: 2 }, areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 1, y2: 1, colorStops: [{ offset: 0, color: "rgba(22,119,255,.28)" }, { offset: 1, color: "rgba(18,167,157,.34)" }] } } },
        { name: "上一批次", value: previous, symbol: "none", lineStyle: { width: 1.6, type: "dashed", color: "#8294b2" }, areaStyle: { color: "rgba(125,145,174,.025)" } },
      ] }],
    };
  }, [dashboard]);
  const coverageItems = dashboard ? [
    { key: "strategy", label: "策略配置覆盖", value: dashboard.coverage.strategyTableCount, total: dashboard.coverage.monitoredTableCount, rate: dashboard.coverage.strategyCoverageRate, gap: dashboard.coverage.unconfiguredTableCount },
    { key: "result", label: "质量结果覆盖", value: dashboard.coverage.resultTableCount, total: dashboard.coverage.monitoredTableCount, rate: dashboard.coverage.resultCoverageRate, gap: dashboard.coverage.uncoveredTableCount },
    { key: "mapping", label: "业务系统归属", value: dashboard.coverage.mappedTableCount, total: dashboard.coverage.monitoredTableCount, rate: dashboard.coverage.mappingRate, gap: dashboard.coverage.unmappedTableCount },
    { key: "important", label: "重点表结果覆盖", value: dashboard.coverage.importantCoveredCount, total: dashboard.coverage.importantTableCount, rate: dashboard.coverage.importantCoverageRate, gap: Math.max(0, dashboard.coverage.importantTableCount - dashboard.coverage.importantCoveredCount) },
  ] : [];
  const lifecycleBars = dashboard ? [
    {
      key: "finding", label: "异常识别", total: dashboard.issues.findingCount, alert: null,
      segments: [
        { label: "待确认", value: dashboard.issues.pendingFindingCount, tone: "amber" },
        { label: "已确认", value: dashboard.issues.confirmedFindingCount, tone: "purple" },
        { label: "其他", value: Math.max(0, dashboard.issues.findingCount - dashboard.issues.pendingFindingCount - dashboard.issues.confirmedFindingCount), tone: "muted" },
      ],
    },
    {
      key: "issue", label: "问题处置", total: dashboard.issues.issueCount, alert: `超期 ${dashboard.issues.overdueIssueCount} 项`,
      segments: [
        { label: "待处置", value: dashboard.issues.openIssueCount, tone: "blue" },
        { label: "已闭环", value: dashboard.issues.closedIssueCount, tone: "green" },
      ],
    },
  ] : [];
  const riskSystems = useMemo(() => systems.filter((item) => item.score !== null).sort((left, right) => Number(left.score) - Number(right.score) || Number(right.issueRows) - Number(left.issueRows)).slice(0, 7), [systems]);
  const observations = dashboard ? [
    { label: "低分数据表", value: dashboard.riskAssets.filter((item) => item.score !== null && item.score < 85).length, unit: "张", tone: "danger", scene: "low_score_tables" },
    { label: "失败规则", value: dashboard.health.failedRules, unit: "条", tone: dashboard.health.failedRules ? "warning" : "good", scene: "failed_rules" },
    { label: "重复异常", value: dashboard.issues.recurringFindingCount, unit: "项", tone: "warning", scene: "recurring_findings" },
    { label: "超期问题", value: dashboard.issues.overdueIssueCount, unit: "项", tone: dashboard.issues.overdueIssueCount ? "danger" : "good", scene: "overdue_issues" },
    { label: "未覆盖表", value: dashboard.coverage.uncoveredTableCount, unit: "张", tone: "warning", scene: "uncovered_tables" },
    { label: "平均处置", value: dashboard.issues.averageResolutionHours ?? "--", unit: dashboard.issues.averageResolutionHours === null ? "" : "小时", tone: "blue", scene: "average_resolution" },
  ] : [];
  const systemSummary = dashboard ? [
    { label: "纳管数据表", value: dashboard.coverage.monitoredTableCount, unit: "张", note: `已有结果 ${dashboard.coverage.resultTableCount} 张`, scene: "system_tables" },
    { label: "本期运行", value: dashboard.scale.runCount, unit: "次", note: `检查 ${formatCompactNumber(dashboard.health.checkedRows)} 条`, scene: "period_runs" },
    { label: "异常命中", value: formatCompactNumber(dashboard.health.anomalyHits), unit: "条", note: `命中率 ${dashboard.health.anomalyRate.toFixed(2)}%`, scene: "anomaly_hits" },
  ] : [];

  return <div className={`app-page quality-ops-page${isExpanded ? " quality-ops-page--expanded" : ""}`}>
    <div className="app-page-body">
      <div className={`quality-ops-shell${isExpanded ? " quality-ops-shell--expanded" : ""}`}>
        <header className="quality-ops-header">
          <div className="quality-ops-header__scope">
            <div className="quality-ops-header__system-filter">
              <span>业务系统</span>
              <Select<number>
                allowClear
                showSearch
                value={businessSystemId}
                loading={loading && !systemsOptions.length}
                placeholder="全部系统"
                optionFilterProp="label"
                options={systemsOptions.map((item) => ({ value: item.id, label: item.systemName }))}
                onChange={(value) => {
                  setBusinessSystemId(value);
                  setCompareTableId(undefined);
                  setCurrentBatchId(undefined);
                  setPreviousBatchId(undefined);
                  setBatchOptions([]);
                  setComparison(null);
                  setObservability(null);
                }}
              />
            </div>
            <div className="quality-ops-header__scope-stats">
              <span>{scopeSystemName ? "当前系统" : "系统"} {scopeSystemName || dashboard?.scale.systemCount || 0}</span>
              <span>纳管表 {dashboard?.coverage.monitoredTableCount || 0}</span>
              <span>本期运行 {dashboard?.scale.runCount || 0}</span>
              <span>检查记录 {formatCompactNumber(dashboard?.health.checkedRows)}</span>
            </div>
          </div>
          <div className="quality-ops-header__controls">
            <div className="quality-ops-header__meta">
              <span><ClockCircleOutlined /> {formatTime(new Date(clock).toISOString())}</span>
              <span>快照 {formatTime(dashboard?.snapshotAt)}</span>
              <span className={`quality-ops-status quality-ops-status--${currentScoreStatus.tone}`}><i />{currentScoreStatus.label}</span>
            </div>
            <div className="quality-ops-header__actions">
              <Segmented<DashboardRange> size="small" value={range} onChange={setRange} options={[{ label: "24小时", value: "24h" }, { label: "近7天", value: "7d" }, { label: "近30天", value: "30d" }]} />
              <Button size="small" onClick={() => { setDetailTab("systems"); setDetailOpen(true); }}>综合分析</Button>
              <Button size="small" icon={isExpanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={() => setIsExpanded((current) => !current)}>{isExpanded ? "退出全屏" : "全屏"}</Button>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>刷新</Button>
            </div>
          </div>
        </header>

        {!dashboard && loading ? <div className="quality-ops-loading"><Spin size="large" /></div> : null}
        {dashboard ? <>
          <section className="quality-ops-health-band">
            <button type="button" className={`quality-ops-health-card quality-ops-health-card--${currentScoreStatus.tone}`} onClick={() => void openDrilldown({ scene: "overview" })}>
              <div className="quality-ops-health-card__icon"><SafetyCertificateOutlined /></div>
              <div className="quality-ops-health-card__copy"><span>当前质量状态</span><strong>{currentScoreStatus.label}</strong><small>{deltaText(dashboard.health.scoreChange, "分")}</small></div>
              <div className="quality-ops-health-card__score">{dashboard.health.overallScore === null ? "--" : dashboard.health.overallScore.toFixed(1)}<small>分</small></div>
            </button>
            <div className="quality-ops-kpi-grid">
              {kpis.map((item) => <button type="button" className={`quality-ops-kpi quality-ops-kpi--${item.tone}`} key={item.key} onClick={() => void openDrilldown({ scene: item.scene })}>
                <div className="quality-ops-kpi__top"><span>{item.label}</span>{item.icon}</div>
                <div className="quality-ops-kpi__value">{Number(item.value).toLocaleString("zh-CN", { minimumFractionDigits: item.digits, maximumFractionDigits: item.digits })}<small>{item.unit}</small></div>
                <div className="quality-ops-kpi__note">{item.note}</div>
              </button>)}
            </div>
          </section>

          <section className="quality-ops-screen-grid">
            <QualityPanel title="六维质量健康" className="quality-ops-panel--radar" extra={<button type="button" onClick={() => void openDrilldown({ scene: "dimension" })}>查看明细</button>}>
              <div className="quality-ops-radar-layout">
                <div className="quality-ops-radar-chart"><ReactECharts option={dimensionRadarOption} style={{ width: "100%", height: "100%" }} /></div>
                <div className="quality-ops-radar-dimensions">{dashboard.dimensions.map((item) => <div key={item.key} className={item.covered ? "" : "is-uncovered"} role="button" tabIndex={0} onClick={() => void openDrilldown({ scene: "dimension", dimension: item.key })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") void openDrilldown({ scene: "dimension", dimension: item.key }); }}>
                  <span><i style={{ background: item.color }} />{item.name}</span>
                  <strong>{item.score === null ? "--" : item.score.toFixed(1)}</strong>
                  <small className={Number(item.scoreChange || 0) < 0 ? "is-negative" : ""}>{item.scoreChange === null ? "未覆盖" : Number(item.scoreChange) === 0 ? "持平" : `${Number(item.scoreChange) > 0 ? "+" : ""}${Number(item.scoreChange).toFixed(1)}`}</small>
                </div>)}</div>
              </div>
            </QualityPanel>
            <QualityPanel title="质量运行趋势" subtitle={dashboard.trendMode === "batch" ? "最近运行批次" : range === "24h" ? "按小时聚合" : "按日期聚合"} className="quality-ops-panel--trend">
              {dashboard.trend.length ? <ReactECharts option={trendOption} style={{ width: "100%", height: "100%" }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前时间范围暂无运行数据" />}
            </QualityPanel>
            <QualityPanel title="异常状态与处置" className="quality-ops-panel--status" extra={<button type="button" onClick={() => void openDrilldown({ scene: "issues" })}>问题中心</button>}>
              <div className="quality-ops-status-stacks">
                {lifecycleBars.map((bar) => <div className="quality-ops-status-stack" key={bar.key}>
                  <div className="quality-ops-status-stack__head"><span>{bar.label}</span><strong>{bar.total}<small>项</small></strong>{bar.alert ? <em>{bar.alert}</em> : null}</div>
                  <div className="quality-ops-status-stack__track">
                    {bar.segments.filter((item) => item.value > 0).map((item) => {
                      const ratio = bar.total > 0 ? item.value * 100 / bar.total : 0;
                      return <div key={item.label} className={`quality-ops-status-stack__segment quality-ops-status-stack__segment--${item.tone}`} style={{ width: `${ratio}%` }} title={`${item.label} ${item.value} 项，占比 ${ratio.toFixed(1)}%`}><span>{ratio >= 12 ? `${item.label} ${item.value}` : item.value}</span></div>;
                    })}
                    {!bar.total ? <span className="quality-ops-status-stack__empty">暂无数据</span> : null}
                  </div>
                  <div className="quality-ops-status-stack__legend">{bar.segments.filter((item) => item.value > 0).map((item) => <span key={item.label} className={`is-${item.tone}`}><i />{item.label}<strong>{item.value}</strong><small>{bar.total ? `${(item.value * 100 / bar.total).toFixed(1)}%` : "0%"}</small></span>)}</div>
                </div>)}
                <div className="quality-ops-lifecycle-metrics"><span>闭环率<strong>{dashboard.issues.closureRate.toFixed(1)}%</strong></span><span>平均耗时<strong>{dashboard.issues.averageResolutionHours === null ? "--" : `${dashboard.issues.averageResolutionHours}h`}</strong></span></div>
              </div>
            </QualityPanel>

            <QualityPanel title="治理覆盖与关键观测" className="quality-ops-panel--coverage" extra={<button type="button" onClick={() => void openDrilldown({ scene: "governance" })}>治理明细</button>}>
              <div className="quality-ops-governance-compact">
                <div className="quality-ops-coverage-compact">{coverageItems.map((item) => <div key={item.key}><div><span>{item.label}</span><strong>{item.rate.toFixed(1)}%</strong></div><div className="quality-ops-coverage-list__track"><i style={{ width: `${Math.min(100, item.rate)}%` }} /></div><small>{item.value}/{item.total || 0} · 缺口 {item.gap}</small></div>)}</div>
                <div className="quality-ops-observation-compact">{observations.map((item) => <button type="button" key={item.label} className={`quality-ops-observation-compact__item quality-ops-observation-compact__item--${item.tone}`} onClick={() => void openDrilldown({ scene: item.scene })}><span>{item.label}</span><strong>{item.value}<small>{item.unit}</small></strong></button>)}</div>
              </div>
            </QualityPanel>
            <QualityPanel title="质量问题链路" subtitle={businessSystemId ? "数据表 → 质量维度 → 问题级别" : "业务系统 → 质量维度 → 问题级别"} className="quality-ops-panel--flow">
              {dashboard.issueFlow?.links.length ? <ReactECharts option={issueFlowOption} style={{ width: "100%", height: "100%" }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前批次未发现质量问题链路" />}
            </QualityPanel>
            <QualityPanel title="问题规则 Top 5" className="quality-ops-panel--rules" extra={<button type="button" onClick={() => void openDrilldown({ scene: "top_rules" })}>查看全部</button>}>
              {topRuleRows.length ? <div className="quality-ops-top-rule-list">{topRuleRows.map((item, index) => {
                const color = item.severity === "critical" ? "#ef5364" : item.severity === "high" ? "#ff8a5b" : item.severity === "medium" ? "#f2b441" : "#4d9fff";
                return <button type="button" key={`${item.monitorTableId || item.tableName}-${item.strategyVersionId || item.strategyVersionNo}-${item.ruleCode}-${item.fieldName || "table"}`} title={`数据表：${item.tableName}\n策略：${item.taskName || "当前质量策略"}${item.strategyVersionNo ? ` · V${item.strategyVersionNo}` : ""}\n规则：${qualityRuleDisplayName(item.ruleName, item.ruleCode)}\n字段：${item.fieldName || "整表"}`} onClick={() => void openDrilldown({ scene: "top_rule", monitorTableId: item.monitorTableId || undefined, strategyVersionId: item.strategyVersionId, ruleCode: item.ruleCode, fieldName: item.fieldName })}>
                  <span className="quality-ops-top-rule-list__rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="quality-ops-top-rule-list__meta"><strong>{item.tableName || "未命名数据表"}</strong><small><em>策略{item.strategyVersionNo ? `V${item.strategyVersionNo}` : "未标版本"}</em>{item.taskName || "当前质量策略"}</small><small>{qualityRuleDisplayName(item.ruleName, item.ruleCode)}{item.fieldName ? ` · ${item.fieldName}` : " · 整表"}</small></span>
                  <span className="quality-ops-top-rule-list__bar"><i style={{ width: `${Math.max(4, Number(item.issueRows || 0) / topRuleMax * 100)}%`, background: color }} /></span>
                  <b>{formatCompactNumber(item.issueRows)}</b>
                </button>;
              })}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无异常规则" />}
            </QualityPanel>
          </section>

          <section className="quality-ops-risk-strip">
            {businessSystemId ? <QualityPanel title="系统质量摘要" subtitle={scopeSystemName} extra={<button type="button" onClick={() => void openDrilldown({ scene: "overview" })}>详情</button>}>
              <div className="quality-ops-system-summary">{systemSummary.map((item) => <button type="button" key={item.label} onClick={() => void openDrilldown({ scene: item.scene, targetBusinessSystemId: businessSystemId })}><span>{item.label}</span><strong>{item.value}<small>{item.unit}</small></strong><em>{item.note}</em></button>)}</div>
            </QualityPanel> : <QualityPanel title="高风险系统" extra={<button type="button" onClick={() => void openDrilldown({ scene: "risk_systems" })}>全部</button>}>
              <div className="quality-ops-system-list quality-ops-system-list--compact">{riskSystems.slice(0, 3).map((item, index) => <button type="button" key={String(item.businessSystemId || item.systemName)} onClick={() => void openDrilldown({ scene: "risk_system", targetBusinessSystemId: item.businessSystemId || undefined })}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.systemName}</strong><small>{item.tableCount} 张表 · {formatCompactNumber(item.issueRows)} 问题行</small></div><b>{Number(item.score).toFixed(1)}</b></button>)}{!riskSystems.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无系统质量数据" /> : null}</div>
            </QualityPanel>}
            <QualityPanel title="重点风险对象" extra={<button type="button" onClick={() => void openDrilldown({ scene: "risk_tables" })}>全部</button>}>
              <div className="quality-ops-risk-list quality-ops-risk-list--compact">{dashboard.riskAssets.slice(0, 3).map((item, index) => <button type="button" key={item.monitorTableId} onClick={() => void openDrilldown({ scene: "risk_table", monitorTableId: item.monitorTableId })}><span className="quality-ops-risk-list__rank">{String(index + 1).padStart(2, "0")}</span><span className="quality-ops-risk-list__object"><strong>{item.tableName}</strong><small>{item.systemName}</small></span><span className={`quality-ops-risk-list__score is-${item.status}`}>{item.score === null ? "--" : item.score.toFixed(1)}</span><span className="quality-ops-risk-list__rate">异常 {item.anomalyRate.toFixed(1)}%</span></button>)}{!dashboard.riskAssets.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无风险对象" /> : null}</div>
            </QualityPanel>
            <QualityPanel title="优先处置队列" extra={<button type="button" onClick={() => void refreshFindings()}>刷新异常</button>}>
              <div className="quality-ops-priority-list quality-ops-priority-list--compact">{dashboard.priorityItems.slice(0, 3).map((item) => <button type="button" key={`${item.itemType}-${item.id}`} onClick={() => void openDrilldown({ scene: "priority_item", itemType: item.itemType, itemId: item.id })}><span className={`quality-ops-severity quality-ops-severity--${item.severity}`}>{severityLabel(item.severity)}</span><span className="quality-ops-priority-list__object"><strong>{item.tableName || "质量异常"}</strong><small>{item.title}</small></span><span className="quality-ops-priority-list__state">{item.itemType === "finding" ? "待确认" : issueStatusLabel(item.status)}</span><span className="quality-ops-priority-list__count">{item.occurrenceCount}次{item.overdue ? " · 超期" : ""}</span></button>)}{!dashboard.priorityItems.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前无待处置异常" /> : null}</div>
            </QualityPanel>
          </section>
        </> : null}

        {!dashboard && !loading ? <div className="quality-ops-loading"><Empty description="暂无质量运营数据" /></div> : null}
      </div>

      <Drawer
        title={drilldownData ? `${drilldownData.title} · ${drilldownData.scopeName || "全部系统"}` : "指标明细"}
        width="min(1240px, 94vw)"
        zIndex={1350}
        open={drilldownOpen}
        onClose={() => setDrilldownOpen(false)}
        destroyOnHidden
      >
        <Spin spinning={drilldownLoading}>
          {drilldownData ? <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div className="quality-ops-drilldown-summary">
              <div><span>指标值</span><strong>{drilldownData.metricValue === null || drilldownData.metricValue === undefined ? "--" : drilldownData.metricValue}<small>{drilldownData.metricUnit || ""}</small></strong></div>
              <div><span>明细总数</span><strong>{drilldownData.total}<small>条</small></strong></div>
              <div><span>统计范围</span><strong className="is-text">{drilldownData.rangeLabel || "-"}</strong></div>
              <div><span>系统范围</span><strong className="is-text">{drilldownData.scopeName || "全部系统"}</strong></div>
            </div>
            {drilldownData.summary ? <Alert type="info" showIcon message="指标口径" description={drilldownData.summary} /> : null}
            <Table<Record<string, any>>
              rowKey={(row) => String(row.id || row.monitorTableId || row.resultBatchId || row.businessSystemId || `${row.tableName}-${row.ruleCode}-${row.fieldName}`)}
              loading={drilldownLoading}
              columns={drilldownColumns}
              dataSource={drilldownData.rows}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
              locale={{ emptyText: <Empty description="当前指标没有匹配的明细" /> }}
              scroll={{ x: Math.max(960, drilldownData.columns.length * 145) }}
              size="middle"
            />
          </Space> : <div style={{ minHeight: 240 }} />}
        </Spin>
      </Drawer>

      <Drawer title={`质量分析详情${scopeSystemName ? ` · ${scopeSystemName}` : ""}`} width="min(1180px, 92vw)" zIndex={1300} open={detailOpen} onClose={() => setDetailOpen(false)} destroyOnHidden>
      <Tabs activeKey={detailTab} onChange={setDetailTab} items={[
        { key: "systems", label: `系统质量 (${systems.length})`, children: <Card variant="borderless" className="surface-card"><Table rowKey={(row) => String(row.businessSystemId || row.systemName)} loading={loading} columns={systemColumns} dataSource={systems} pagination={{ pageSize: 8, showSizeChanger: false }} locale={{ emptyText: <Empty description="运行质量任务后将展示系统级统计" /> }} scroll={{ x: 960 }} /></Card> },
        { key: "tables", label: `表级分析 (${tables.length})`, children: <Card variant="borderless" className="surface-card"><Table rowKey="monitorTableId" loading={loading} columns={tableColumns} dataSource={tables} pagination={{ pageSize: 8, showSizeChanger: false }} locale={{ emptyText: <Empty description="暂无已归集的表级质量结果" /> }} scroll={{ x: 1180 }} /></Card> },
        { key: "compare", label: "跨批次比较", children: <Card variant="borderless" className="surface-card"><Space direction="vertical" size={18} style={{ width: "100%" }}><div className="quality-compare-selectors"><Select placeholder="选择监控表" value={compareTableId} onChange={(value) => { setAiAnalysis(null); setCurrentBatchId(undefined); setPreviousBatchId(undefined); setBatchOptions([]); void loadComparison(value); }} options={tables.map((item) => ({ value: item.monitorTableId, label: `${item.tableName} / ${item.systemName}` }))} /><Select placeholder="当前批次" value={currentBatchId} disabled={!compareTableId} onChange={(value) => { setCurrentBatchId(value); void loadComparison(compareTableId, value, previousBatchId); }} options={batchOptions.map((item) => ({ value: item.id, label: `${formatQualityBatchId(item.batchId)} · ${item.score ?? "-"}分` }))} /><Select placeholder="对比批次" value={previousBatchId} disabled={!compareTableId} onChange={(value) => { setPreviousBatchId(value); void loadComparison(compareTableId, currentBatchId, value); }} options={batchOptions.map((item) => ({ value: item.id, label: `${formatQualityBatchId(item.batchId)} · ${item.score ?? "-"}分` }))} /><Button disabled={!comparison?.comparable} onClick={() => void analyseComparison()}>AI 变化研判</Button></div>{comparison?.comparable ? <><Alert type={comparison.change.score >= 0 ? "success" : "warning"} showIcon message={`${selectedTable?.tableName || "当前表"}：质量得分 ${comparison.change.score >= 0 ? "提升" : "下降"} ${Math.abs(comparison.change.score)} 分`} description={`当前批次 ${formatQualityBatchId(comparison.current.batchId)} 对比 ${formatQualityBatchId(comparison.previous.batchId)}；问题行变化 ${comparison.change.issueRows >= 0 ? "+" : ""}${comparison.change.issueRows}，失败规则变化 ${comparison.change.failedRules >= 0 ? "+" : ""}${comparison.change.failedRules}。`} />{aiAnalysis ? <Alert type={aiAnalysis.available ? "info" : "warning"} showIcon message={aiAnalysis.summary || "AI 研判未返回摘要"} description={<Space direction="vertical">{aiAnalysis.suggestions?.length ? <Typography.Text>建议：{aiAnalysis.suggestions.join("；")}</Typography.Text> : null}{aiAnalysis.limitations?.length ? <Typography.Text type="secondary">限制：{aiAnalysis.limitations.join("；")}</Typography.Text> : null}</Space>} /> : null}<Table<any> rowKey={(row) => `${row.ruleCode}-${row.fieldName}`} dataSource={comparison.rules || []} pagination={false} scroll={{ x: 760 }} columns={[{ title: "规则", dataIndex: "ruleCode" }, { title: "字段", dataIndex: "fieldName", render: (value) => value || "表级" }, { title: "本批问题行", dataIndex: "currentIssueRows" }, { title: "对比批次问题行", dataIndex: "previousIssueRows" }, { title: "变化", key: "change", render: (_v, row: any) => <Tag color={row.currentIssueRows > row.previousIssueRows ? "red" : row.currentIssueRows < row.previousIssueRows ? "green" : "default"}>{row.currentIssueRows - row.previousIssueRows}</Tag> }]} /></> : <Empty description={comparison?.reason || "请选择表和两个运行批次查看变化"} />}</Space></Card> },
        { key: "observability", label: "变化观察", children: <Card variant="borderless" className="surface-card"><Space direction="vertical" size={18} style={{ width: "100%" }}><Alert showIcon type="info" message="轻量数据可观测辅助" description="只复用现有批次、策略画像和规则证据，提供 Schema 变化、重点指标波动和简单对账，不建设独立实时可观测平台。" /><Select placeholder="选择监控表查看变化证据" style={{ width: 460, maxWidth: "100%" }} value={compareTableId} onChange={(value) => void loadComparison(value)} options={tables.map((item) => ({ value: item.monitorTableId, label: `${item.tableName} / ${item.systemName}` }))} />{observability?.available ? <><div className="quality-observation-cards"><Card size="small" title="Schema 变化" extra={<Tag color={observability.schema?.status === "changed" ? "orange" : observability.schema?.status === "stable" ? "green" : "blue"}>{observability.schema?.status === "changed" ? "发现变化" : observability.schema?.status === "stable" ? "结构稳定" : "基线积累中"}</Tag>}><Typography.Paragraph type="secondary">{observability.schema?.message}</Typography.Paragraph>{observability.schema?.added?.length ? <Typography.Text>新增字段：{observability.schema.added.join("、")}</Typography.Text> : null}{observability.schema?.removed?.length ? <Typography.Paragraph type="danger">删除字段：{observability.schema.removed.join("、")}</Typography.Paragraph> : null}{observability.schema?.changed?.map((item: any) => <Typography.Paragraph key={item.fieldName}>{item.fieldName}：{item.changes.join("；")}</Typography.Paragraph>)}</Card><Card size="small" title="观察范围"><Space direction="vertical"><Typography.Text>当前批次：{formatQualityBatchId(observability.currentBatch?.batchId)}</Typography.Text><Typography.Text>对比批次：{observability.previousBatch?.batchId ? formatQualityBatchId(observability.previousBatch.batchId) : "基线积累中"}</Typography.Text><Typography.Text>指标规则：{observability.metrics?.length || 0} 条</Typography.Text><Typography.Text>对账规则：{observability.reconciliation?.length || 0} 条</Typography.Text></Space></Card></div><Tabs size="small" items={[{ key: "metrics", label: `指标波动 (${observability.metrics?.length || 0})`, children: <Table<any> rowKey={(row) => `${row.ruleCode}-${row.fieldName}`} pagination={false} dataSource={observability.metrics || []} columns={[{ title: "观察项", dataIndex: "ruleCode" }, { title: "字段", dataIndex: "fieldName", render: (value) => value || "整表" }, { title: "当前值", dataIndex: "metricValue" }, { title: "基线值", dataIndex: "baselineValue" }, { title: "阈值", dataIndex: "thresholdValue" }, { title: "状态", key: "status", render: (_v, row) => <Tag color={Number(row.issueRows) ? "orange" : row.evaluationStatus === "not_evaluable" ? "blue" : "green"}>{Number(row.issueRows) ? "发生波动" : row.evaluationStatus === "not_evaluable" ? "基线积累中" : "正常"}</Tag> }]} /> }, { key: "reconcile", label: `简单对账 (${observability.reconciliation?.length || 0})`, children: <Table<any> rowKey={(row) => `${row.ruleCode}-${row.fieldName}`} pagination={false} dataSource={observability.reconciliation || []} columns={[{ title: "对账规则", dataIndex: "ruleCode" }, { title: "关联字段", dataIndex: "fieldName" }, { title: "检查记录", dataIndex: "totalRows" }, { title: "差异记录", dataIndex: "issueRows" }, { title: "差异率", dataIndex: "issueRate", render: (value) => `${(Number(value || 0) * 100).toFixed(2)}%` }, { title: "结论", key: "status", render: (_v, row) => <Tag color={Number(row.issueRows) ? "orange" : "green"}>{Number(row.issueRows) ? "存在差异" : "一致"}</Tag> }]} /> }]} /></> : <Empty description={observability?.reason || "选择监控表后展示轻量变化观察"} />}</Space></Card> },
        { key: "reports", label: `报告记录 (${reports.length})`, children: <Card variant="borderless" className="surface-card" extra={<Button type="primary" icon={<FileTextOutlined />} onClick={() => void generateReport("system", null, "项目质量总览报告")}>生成项目总览</Button>}><Table<any> rowKey="id" dataSource={reports} pagination={{ pageSize: 8, showSizeChanger: false }} columns={[{ title: "报告名称", dataIndex: "reportTitle" }, { title: "范围", dataIndex: "reportScope", render: (value: string) => ({ system: "系统级", table: "表级", comparison: "跨批次" }[value as "system" | "table" | "comparison"] || value) }, { title: "状态", dataIndex: "reportStatus", render: (value) => <Tag color={value === "success" ? "green" : "red"}>{value === "success" ? "生成成功" : "失败"}</Tag> }, { title: "生成时间", dataIndex: "createdAt", render: formatTime }, { title: "生成者", dataIndex: "createdBy" }]} locale={{ emptyText: <Empty description="手工生成的质量报告会保留在这里" /> }} /></Card> },
        { key: "issues", label: `跟踪问题 (${issues.length})`, children: <Card variant="borderless" className="surface-card"><Table rowKey="id" dataSource={issues} pagination={{ pageSize: 8, showSizeChanger: false }} columns={[{ title: "问题", dataIndex: "issueTitle" }, { title: "状态", dataIndex: "issueStatus", render: (value) => <Tag>{issueStatusLabel(value)}</Tag> }, { title: "级别", dataIndex: "severity", render: (value) => <Tag color={value === "critical" || value === "high" ? "red" : "gold"}>{severityLabel(value)}</Tag> }, { title: "负责人", dataIndex: "ownerName", render: (value) => value || "未指定" }, { title: "出现次数", dataIndex: "occurrenceCount" }, { title: "更新时间", dataIndex: "updatedAt", render: formatTime }]} locale={{ emptyText: <Empty description="待确认异常经人工确认后会进入轻量问题跟踪" /> }} /></Card> },
      ]} />
      </Drawer>
      <Modal title={`配置表级治理归属${governanceRow ? `：${governanceRow.tableName}` : ""}`} zIndex={1400} open={Boolean(governanceRow)} onCancel={() => setGovernanceRow(null)} onOk={() => void saveGovernance()} confirmLoading={governanceSaving} okText="保存配置" destroyOnHidden>
        <Form form={governanceForm} layout="vertical" style={{ marginTop: 18 }}>
          <Form.Item label="所属系统" name="businessSystemId"><Select allowClear placeholder="选择已维护的业务系统" options={systemsOptions.map((item) => ({ value: item.id, label: item.systemName }))} /></Form.Item>
          <Form.Item label="重要级别" name="importanceLevel" initialValue="normal"><Select options={[{ value: "critical", label: "核心" }, { value: "high", label: "高" }, { value: "normal", label: "普通" }, { value: "low", label: "低" }]} /></Form.Item>
          <Form.Item label="质量标签" name="tagIds"><Select mode="multiple" placeholder="选择标签" options={tagOptions.map((item) => ({ value: item.id, label: item.tagName }))} /></Form.Item>
          <Form.Item label="新增标签（可选）" name="newTagName"><Input maxLength={64} placeholder="例如：核心指标、每日巡检" /></Form.Item>
        </Form>
      </Modal>
      <QualityOpsRobot />
    </div>
  </div>;
}
