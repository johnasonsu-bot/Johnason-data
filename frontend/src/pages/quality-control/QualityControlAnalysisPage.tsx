import {
  ArrowLeftOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  TableOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Popconfirm,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  deleteQualityAnalysisTableResults,
  fetchQualityAnalysisDetails,
  fetchQualityAnalysisOverview,
  fetchQualityAnalysisStats,
  fetchQualityInsightsOverview,
  fetchQualityStrategyTables,
  fetchQualitySystemInsights,
  fetchQualitySourceColumns,
  fetchQualitySources,
} from "../../services/qualityControl";
import type {
  DataSourceColumn,
  QualityAnalysisOverview,
  QualityIssueDetailRecord,
  QualityIssueStatRecord,
  QualityMonitorSourceRecord,
  QualityMonitorTableRecord,
} from "../../types/api";
import { formatQualityBatchId } from "../../utils/qualityBatch";

type TableSummaryRow = {
  sourceId: number;
  sourceName: string;
  tableName: string;
  tableComment: string;
  issueRows: number;
  statCount: number;
  batchCount: number;
  latestDetectedAt: string;
};

type BatchSummaryRow = {
  batchId: string;
  issueRows: number;
  statCount: number;
  ruleCount: number;
  latestDetectedAt: string;
};

type TableSystemInfo = {
  businessSystemId: number | null;
  businessSystemName: string;
};

type AnalysisRuleGroup = "field" | "row" | "stat" | "cross";

const RULE_GROUP_LABELS: Record<AnalysisRuleGroup, string> = {
  field: "字段级规则",
  row: "行级规则",
  stat: "统计型规则",
  cross: "跨表规则",
};

function toTimeValue(value?: string | null) {
  return value ? new Date(value).getTime() || 0 : 0;
}

function formatCell(value?: string | null, fallback = "-") {
  return String(value || "").trim() || fallback;
}

function formatAnalysisDateTime(value?: string | null, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function maxTimeText(current?: string | null, next?: string | null) {
  return toTimeValue(next) > toTimeValue(current) ? String(next || "") : String(current || "");
}

function getRuleGroup(ruleCategory?: string | null): AnalysisRuleGroup {
  const category = String(ruleCategory || "").trim().toLowerCase();
  if (["conditional_required", "conditional_regex", "field_compare", "composite_unique"].includes(category)) return "row";
  if (["freshness", "volume_anomaly", "null_rate_change", "batch_completeness"].includes(category)) return "stat";
  if (["cross_table_lookup", "cross_table_consistency"].includes(category)) return "cross";
  return "field";
}

function renderDetailAction(record: QualityIssueStatRecord, onClick: (record: QualityIssueStatRecord) => void) {
  if (String(record.ruleCategory || "").trim().toLowerCase() === "freshness") {
    return (
      <Button type="link" disabled>
        仅统计值
      </Button>
    );
  }
  const hasIssues = Number(record.issueRows || 0) > 0;
  return (
    <Button type="link" disabled={!hasIssues} onClick={() => hasIssues && onClick(record)}>
      {hasIssues ? "查看问题明细" : "无问题明细"}
    </Button>
  );
}

function formatRuleCategory(value?: string | null) {
  const category = String(value || "").trim().toLowerCase();
  if (category === "non_null") return "非空检测";
  if (category === "duplicate") return "重复检测";
  if (category === "compliance") return "合规校验";
  if (category === "value_range") return "值域范围";
  if (category === "conditional_required") return "条件型非空/置空";
  if (category === "conditional_regex") return "条件型格式校验";
  if (category === "field_compare") return "跨字段比较";
  if (category === "composite_unique") return "联合字段唯一";
  if (category === "freshness") return "数据时效性";
  if (category === "volume_anomaly") return "数据量波动";
  if (category === "null_rate_change") return "空值率变化";
  if (category === "batch_completeness") return "批次完整性";
  if (category === "cross_table_lookup") return "跨表存在性";
  if (category === "cross_table_consistency") return "跨表一致性";
  return "其他规则";
}

function formatQualityDimension(value?: string | null) {
  const category = String(value || "").trim().toLowerCase();
  if (["non_null", "conditional_required", "batch_completeness"].includes(category)) return "完整性";
  if (["duplicate", "composite_unique"].includes(category)) return "唯一性";
  if (["compliance", "conditional_regex", "value_range"].includes(category)) return "有效性";
  if (["field_compare", "cross_table_lookup", "cross_table_consistency"].includes(category)) return "一致性";
  if (category === "freshness") return "时效性";
  if (["volume_anomaly", "null_rate_change"].includes(category)) return "稳定性";
  return "其他";
}

function formatRuleCode(ruleCode?: string | null, ruleCategory?: string | null) {
  const code = String(ruleCode || "-").trim();
  const category = String(ruleCategory || "").trim().toLowerCase();
  if (category !== "cross_table_lookup" && category !== "cross_table_consistency") return code;
  const type = category === "cross_table_consistency" ? "consistency" : "lookup";
  const suffix = code.match(/_([a-f0-9]{8,})$/i)?.[1];
  return suffix ? `cross_${type}_${suffix}` : `cross_${type}`;
}

function getCrossReferenceTable(ruleConfig?: Record<string, unknown>) {
  const config = ruleConfig && typeof ruleConfig === "object" ? ruleConfig : {};
  return String(config.refTable || config.referenceTable || "").trim();
}

function getDisplayIssueRows(record: Pick<QualityIssueStatRecord, "ruleCategory" | "issueRows">) {
  const category = String(record.ruleCategory || "").trim().toLowerCase();
  if (category === "freshness") {
    return Number(record.issueRows || 0) > 0 ? 1 : 0;
  }
  return Number(record.issueRows || 0);
}

export function QualityControlAnalysisPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sources, setSources] = useState<QualityMonitorSourceRecord[]>([]);
  const [tableKeyword, setTableKeyword] = useState("");
  const [businessSystemFilter, setBusinessSystemFilter] = useState<string | undefined>(undefined);

  const [selectedSource, setSelectedSource] = useState<QualityMonitorSourceRecord | null>(null);
  const [overview, setOverview] = useState<QualityAnalysisOverview | null>(null);
  const [sourceStats, setSourceStats] = useState<QualityIssueStatRecord[]>([]);
  const [sourceHistoryStats, setSourceHistoryStats] = useState<QualityIssueStatRecord[]>([]);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchStats, setBatchStats] = useState<QualityIssueStatRecord[]>([]);
  const [selectedStat, setSelectedStat] = useState<QualityIssueStatRecord | null>(null);
  const [detailRows, setDetailRows] = useState<QualityIssueDetailRecord[]>([]);
  const [tableCommentMap, setTableCommentMap] = useState<Record<string, string>>({});
  const [tableSystemMap, setTableSystemMap] = useState<Record<string, TableSystemInfo>>({});
  const [fieldCommentMap, setFieldCommentMap] = useState<Record<string, Record<string, string>>>({});
  const [unifiedOverview, setUnifiedOverview] = useState<any>(null);
  const [systemInsights, setSystemInsights] = useState<any[]>([]);

  function buildTableKey(sourceId: number, tableName: string) {
    return `${sourceId}:${tableName}`;
  }

  function getFieldComment(sourceId: number, tableName: string, fieldName?: string | null) {
    if (!fieldName) return "-";
    return fieldCommentMap[buildTableKey(sourceId, tableName)]?.[fieldName] || "-";
  }

  function getTableComment(sourceId: number, tableName: string) {
    return tableCommentMap[buildTableKey(sourceId, tableName)] || "-";
  }

  function formatCrossFieldNames(tableName: string, fieldNames?: string | null) {
    return String(fieldNames || "")
      .split(",")
      .map((fieldName) => fieldName.trim())
      .filter(Boolean)
      .map((fieldName) => {
        const comment = selectedSource ? getFieldComment(selectedSource.sourceId, tableName, fieldName) : "-";
        return comment !== "-" ? `${fieldName}（${comment}）` : fieldName;
      })
      .join("、") || "-";
  }

  function renderCrossRuleCode(value: string, record: QualityIssueStatRecord | QualityIssueDetailRecord) {
    const referenceTable = getCrossReferenceTable(record.ruleConfig);
    return (
      <Space direction="vertical" size={2} style={{ display: "flex", minWidth: 0 }}>
        <Typography.Text code ellipsis={{ tooltip: value }}>
          {formatRuleCode(value, record.ruleCategory)}
        </Typography.Text>
        {referenceTable ? <Typography.Text type="secondary" ellipsis={{ tooltip: referenceTable }}>关联表：{referenceTable}</Typography.Text> : null}
      </Space>
    );
  }

  function renderEllipsisText(value?: string | null, rows = 2) {
    const text = formatCell(value);
    return (
      <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows, tooltip: text }}>
        {text}
      </Typography.Paragraph>
    );
  }

  function buildRuleDescription(record: Pick<QualityIssueStatRecord, "ruleCategory" | "fieldName" | "fieldComment">) {
    const fieldText = record.fieldComment && record.fieldComment !== "-"
      ? `${record.fieldName} / ${record.fieldComment}`
      : record.fieldName;
    const category = String(record.ruleCategory || "").trim().toLowerCase();
    if (category === "non_null") return `${fieldText} 不允许为空`;
    if (category === "duplicate") return `${fieldText} 不应出现重复值`;
    if (category === "compliance") return `${fieldText} 需要满足格式或合规规则`;
    if (category === "value_range") return `${fieldText} 需要落在允许值域内`;
    if (category === "conditional_required") return `${fieldText} 需要满足条件型非空/置空规则`;
    if (category === "conditional_regex") return `${fieldText} 需要满足条件型格式规则`;
    if (category === "field_compare") return `${fieldText} 需要满足跨字段比较规则`;
    if (category === "composite_unique") return `${fieldText} 组合需要保持唯一`;
    if (category === "freshness") return `${fieldText} 需要满足数据时效性要求`;
    if (category === "volume_anomaly") return `${fieldText} 需要满足数据量波动阈值`;
    if (category === "null_rate_change") return `${fieldText} 需要满足空值率波动阈值`;
    if (category === "batch_completeness") return `${fieldText} 需要满足批次完整性要求`;
    if (category === "cross_table_lookup") return `${fieldText} 需要在关联主数据中存在`;
    if (category === "cross_table_consistency") return `${fieldText} 需要与关联主数据保持一致`;
    return `${fieldText} 命中质量规则`;
  }

  async function hydrateTableComments(records: QualityMonitorSourceRecord[]) {
    if (!token || records.length === 0) return;
    const responses = await Promise.all(records.map((item) => fetchQualityStrategyTables(token, { sourceId: item.sourceId }).catch(() => null)));
    const nextMap: Record<string, string> = {};
    const nextSystemMap: Record<string, TableSystemInfo> = {};
    responses.forEach((response, index) => {
      const source = records[index];
      const monitorTables = response?.data || [];
      monitorTables.forEach((table: QualityMonitorTableRecord) => {
        const tableKey = buildTableKey(source.sourceId, table.tableName);
        nextMap[tableKey] = table.tableComment || "";
        nextSystemMap[tableKey] = {
          businessSystemId: table.businessSystemId == null ? null : Number(table.businessSystemId),
          businessSystemName: String(table.businessSystemName || "").trim() || "未归属系统",
        };
      });
    });
    setTableCommentMap((current) => ({ ...current, ...nextMap }));
    setTableSystemMap((current) => ({ ...current, ...nextSystemMap }));
  }

  async function hydrateFieldComments(sourceId: number, tableName: string) {
    if (!token || !sourceId || !tableName) return;
    const key = buildTableKey(sourceId, tableName);
    if (fieldCommentMap[key]) return;
    const response = await fetchQualitySourceColumns(token, sourceId, tableName).catch(() => null);
    const nextComments = Object.fromEntries(((response?.data || []) as DataSourceColumn[]).map((item) => [item.columnName, item.columnComment || ""]));
    setFieldCommentMap((current) => ({ ...current, [key]: nextComments }));
  }

  async function loadSources() {
    if (!token) return;
    setSourcesLoading(true);
    try {
      const response = await fetchQualitySources(token, { includeTableStats: false });
      setSources(response.data.filter((item) => item.supportedQuality && item.id));
    } catch (error: any) {
      message.error(error.message || "加载质量数据源失败");
    } finally {
      setSourcesLoading(false);
    }
  }

  async function enterSource(record: QualityMonitorSourceRecord) {
    if (!token) return;
    setLoading(true);
    try {
      const [overviewResponse, statsResponse, historyStatsResponse] = await Promise.all([
        fetchQualityAnalysisOverview(token, record.sourceId, { latestOnly: true }),
        fetchQualityAnalysisStats(token, record.sourceId, { latestOnly: true, limit: 5000 }),
        fetchQualityAnalysisStats(token, record.sourceId, { limit: 5000 }),
      ]);
      await hydrateTableComments([record]);
      setSelectedSource(record);
      setOverview(overviewResponse.data);
      setSourceStats(statsResponse.data);
      setSourceHistoryStats(historyStatsResponse.data);
      setSelectedTableName(null);
      setSelectedBatchId(null);
      setBatchStats([]);
      setSelectedStat(null);
      setDetailRows([]);
    } catch (error: any) {
      message.error(error.message || "加载结果分析失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadAllTables() {
    if (!token || sources.length === 0) return;
    setLoading(true);
    try {
      const targetSources = sources;
      const [responses, unifiedOverviewResponse, systemInsightResponse] = await Promise.all([
        Promise.all(targetSources.map(async (record) => {
          const [overviewResponse, statsResponse, historyStatsResponse] = await Promise.all([
            fetchQualityAnalysisOverview(token, record.sourceId, { latestOnly: true }),
            fetchQualityAnalysisStats(token, record.sourceId, { latestOnly: true, limit: 5000 }),
            fetchQualityAnalysisStats(token, record.sourceId, { limit: 5000 }),
          ]);
          return {
            source: record,
            overview: overviewResponse.data,
            stats: statsResponse.data,
            historyStats: historyStatsResponse.data,
          };
        })),
        fetchQualityInsightsOverview(token, { latestOnly: true }),
        fetchQualitySystemInsights(token, { latestOnly: true }),
      ]);
      setUnifiedOverview(unifiedOverviewResponse.data);
      setSystemInsights(systemInsightResponse.data || []);
      await hydrateTableComments(targetSources);

      const mergedStats = responses.flatMap((item) =>
        item.stats.map((row) => ({
          ...row,
          tableName: row.tableName,
          sourceId: item.source.sourceId,
          sourceName: item.source.sourceName || "",
        }))
      ) as Array<QualityIssueStatRecord & { sourceId: number; sourceName: string }>;
      const mergedHistoryStats = responses.flatMap((item) =>
        item.historyStats.map((row) => ({
          ...row,
          tableName: row.tableName,
          sourceId: item.source.sourceId,
          sourceName: item.source.sourceName || "",
        }))
      ) as Array<QualityIssueStatRecord & { sourceId: number; sourceName: string }>;

      const aggregateOverview: QualityAnalysisOverview = {
        detailTableName: "",
        statsTableName: "",
        detailTableExists: responses.some((item) => item.overview.detailTableExists),
        statsTableExists: responses.some((item) => item.overview.statsTableExists),
        totalIssues: responses.reduce((sum, item) => sum + Number(item.overview.totalIssues || 0), 0),
        detailIssueCount: responses.reduce((sum, item) => sum + Number(item.overview.detailIssueCount || 0), 0),
        affectedTables: new Set(mergedStats.map((item) => `${item.sourceId}:${item.tableName}`)).size,
        batchCount: new Set(mergedStats.map((item) => `${item.sourceId}:${item.batchId}`)).size,
        latestDetectedAt: responses
          .map((item) => item.overview.latestDetectedAt || "")
          .sort((a, b) => toTimeValue(b) - toTimeValue(a))[0] || null,
        topTables: [],
        topRules: [],
      };

      setSelectedSource(null);
      setOverview(aggregateOverview);
      setSourceStats(mergedStats);
      setSourceHistoryStats(mergedHistoryStats);
      setSelectedTableName(null);
      setSelectedBatchId(null);
      setBatchStats([]);
      setSelectedStat(null);
      setDetailRows([]);
    } catch (error: any) {
      message.error(error.message || "加载结果分析失败");
    } finally {
      setLoading(false);
    }
  }

  async function enterBatch(batchId: string) {
    if (!token || !selectedSource || !selectedTableName) return;
    setLoading(true);
    try {
      const response = await fetchQualityAnalysisStats(token, selectedSource.sourceId, {
        tableName: selectedTableName,
        batchId,
        limit: 500,
      });
      await hydrateFieldComments(selectedSource.sourceId, selectedTableName);
      setSelectedBatchId(batchId);
      setBatchStats(response.data);
      setSelectedStat(null);
      setDetailRows([]);
    } catch (error: any) {
      message.error(error.message || "加载运行批次失败");
    } finally {
      setLoading(false);
    }
  }

  async function enterStat(stat: QualityIssueStatRecord) {
    if (!token || !selectedSource) return;
    setLoading(true);
    try {
      const response = await fetchQualityAnalysisDetails(token, selectedSource.sourceId, {
        tableName: stat.tableName,
        batchId: stat.batchId,
        ruleCode: stat.ruleCode,
        limit: 500,
      });
      await hydrateFieldComments(selectedSource.sourceId, stat.tableName);
      setSelectedStat(stat);
      setDetailRows(response.data);
    } catch (error: any) {
      message.error(error.message || "加载问题明细失败");
    } finally {
      setLoading(false);
    }
  }

  function backToSources() {
    setSelectedTableName(null);
    setSelectedBatchId(null);
    setBatchStats([]);
    setSelectedStat(null);
    setDetailRows([]);
    void loadAllTables();
  }

  function backToTables() {
    setSelectedTableName(null);
    setSelectedBatchId(null);
    setBatchStats([]);
    setSelectedStat(null);
    setDetailRows([]);
  }

  function backToBatches() {
    setSelectedBatchId(null);
    setBatchStats([]);
    setSelectedStat(null);
    setDetailRows([]);
  }

  function backToStats() {
    setSelectedStat(null);
    setDetailRows([]);
  }

  useEffect(() => {
    void loadSources();
  }, [token]);

  useEffect(() => {
    if (sources.length > 0) {
      void loadAllTables();
    }
  }, [sources, token]);

  const tableRows = useMemo<TableSummaryRow[]>(() => {
    const summaryMap = new Map<string, TableSummaryRow>();
    for (const row of sourceStats as Array<QualityIssueStatRecord & { sourceId?: number; sourceName?: string }>) {
      const key = `${row.sourceId || selectedSource?.sourceId || 0}:${row.tableName}`;
      const current = summaryMap.get(key) || {
        sourceId: Number(row.sourceId || selectedSource?.sourceId || 0),
        sourceName: String(row.sourceName || selectedSource?.sourceName || "-"),
        tableName: row.tableName,
        tableComment: getTableComment(Number(row.sourceId || selectedSource?.sourceId || 0), row.tableName),
        issueRows: 0,
        statCount: 0,
        batchCount: 0,
        latestDetectedAt: "",
      };
      current.issueRows += getDisplayIssueRows(row);
      current.statCount += 1;
      current.latestDetectedAt = maxTimeText(current.latestDetectedAt, row.detectedAt);
      summaryMap.set(key, current);
    }
    for (const item of summaryMap.values()) {
      const batchSet = new Set(
        (sourceHistoryStats as Array<QualityIssueStatRecord & { sourceId?: number }>)
          .filter((row) => row.tableName === item.tableName && Number(row.sourceId || selectedSource?.sourceId || 0) === item.sourceId)
          .map((row) => row.batchId)
          .filter(Boolean),
      );
      item.batchCount = batchSet.size;
    }
    return Array.from(summaryMap.values()).sort((left, right) => right.issueRows - left.issueRows);
  }, [selectedSource?.sourceId, selectedSource?.sourceName, sourceHistoryStats, sourceStats, tableCommentMap]);

  const businessSystemOptions = useMemo(() => {
    const optionMap = new Map<string, string>();
    tableRows.forEach((row) => {
      const system = tableSystemMap[buildTableKey(row.sourceId, row.tableName)];
      const value = system?.businessSystemId == null ? "unassigned" : `system:${system.businessSystemId}`;
      optionMap.set(value, system?.businessSystemName || "未归属系统");
    });
    return Array.from(optionMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
  }, [tableRows, tableSystemMap]);

  const filteredTableRows = useMemo(() => {
    const keyword = tableKeyword.trim().toLowerCase();
    return tableRows.filter((row) => {
      const system = tableSystemMap[buildTableKey(row.sourceId, row.tableName)];
      const systemValue = system?.businessSystemId == null ? "unassigned" : `system:${system.businessSystemId}`;
      const matchesSystem = !businessSystemFilter || businessSystemFilter === systemValue;
      const matchesKeyword = !keyword
        || row.tableName.toLowerCase().includes(keyword)
        || row.tableComment.toLowerCase().includes(keyword);
      return matchesSystem && matchesKeyword;
    });
  }, [businessSystemFilter, tableKeyword, tableRows, tableSystemMap]);

  const batchRows = useMemo<BatchSummaryRow[]>(() => {
    if (!selectedTableName) return [];
    const rows = sourceHistoryStats.filter((item) => item.tableName === selectedTableName);
    const summaryMap = new Map<string, BatchSummaryRow>();
    for (const row of rows) {
      const current = summaryMap.get(row.batchId) || {
        batchId: row.batchId,
        issueRows: 0,
        statCount: 0,
        ruleCount: 0,
        latestDetectedAt: "",
      };
      current.issueRows += getDisplayIssueRows(row);
      current.statCount += 1;
      current.latestDetectedAt = maxTimeText(current.latestDetectedAt, row.detectedAt);
      summaryMap.set(row.batchId, current);
    }
    for (const item of summaryMap.values()) {
      const ruleSet = new Set(
        rows
          .filter((row) => row.batchId === item.batchId)
          .map((row) => `${row.ruleCode}:${row.fieldName}`),
      );
      item.ruleCount = ruleSet.size;
    }
    return Array.from(summaryMap.values()).sort((left, right) => toTimeValue(right.latestDetectedAt) - toTimeValue(left.latestDetectedAt));
  }, [selectedTableName, sourceHistoryStats]);

  const currentScopeStats = useMemo(() => {
    const baseRows = selectedBatchId
      ? batchStats
      : selectedTableName
        ? sourceStats.filter((item) => item.tableName === selectedTableName)
        : sourceStats;
    return baseRows;
  }, [batchStats, selectedBatchId, selectedTableName, sourceStats]);

  const kpis = useMemo(() => {
    if (!overview) return [];
    const issueTotal = selectedStat ? detailRows.length : currentScopeStats.reduce((sum, item) => sum + getDisplayIssueRows(item), 0);
    const totalRows = currentScopeStats.reduce((sum, item) => sum + Number(item.totalRows || 0), 0);
    const statCount = currentScopeStats.length;
    const batchCountInScope = selectedBatchId ? 1 : (selectedTableName ? batchRows.length : overview.batchCount);
    const groupCounts = {
      field: 0,
      row: 0,
      stat: 0,
      cross: 0,
    };
    for (const row of currentScopeStats) {
      const group = getRuleGroup(row.ruleCategory);
      groupCounts[group] += getDisplayIssueRows(row);
    }
    const latestDetectedText = selectedStat
      ? formatAnalysisDateTime(selectedStat.detectedAt)
      : selectedBatchId
        ? formatAnalysisDateTime(batchRows.find((item) => item.batchId === selectedBatchId)?.latestDetectedAt)
        : selectedTableName
          ? formatAnalysisDateTime(batchRows[0]?.latestDetectedAt)
          : formatAnalysisDateTime(overview.latestDetectedAt);
    const dimensionValue = selectedStat
      ? detailRows.length
      : selectedBatchId
        ? currentScopeStats.length
        : selectedTableName
          ? batchRows.length
          : tableRows.length;
    const dimensionTitle = selectedStat
      ? "问题明细"
      : selectedBatchId
        ? "统计项数"
        : selectedTableName
          ? "运行批次"
          : "涉及表数";
    return [
      { key: "issues", title: "问题总数", value: issueTotal, icon: <WarningOutlined /> },
      { key: "dimension", title: dimensionTitle, value: dimensionValue, icon: <TableOutlined /> },
      { key: "statCount", title: "统计规则", value: statCount, icon: <DatabaseOutlined /> },
      { key: "issueRate", title: "问题率", value: totalRows > 0 ? `${((issueTotal / totalRows) * 100).toFixed(2)}%` : "-" , icon: <UnorderedListOutlined /> },
      {
        key: "avgBatchIssue",
        title: selectedTableName && !selectedBatchId ? "最新批次问题" : "平均每批问题",
        value: selectedTableName && !selectedBatchId ? issueTotal : (batchCountInScope > 0 ? Math.round(issueTotal / batchCountInScope) : 0),
        icon: <DatabaseOutlined />,
      },
      { key: "field", title: "字段级问题", value: groupCounts.field, icon: <UnorderedListOutlined /> },
      { key: "row", title: "行级问题", value: groupCounts.row, icon: <UnorderedListOutlined /> },
      { key: "stat", title: "统计型问题", value: groupCounts.stat, icon: <UnorderedListOutlined /> },
      { key: "cross", title: "跨表问题", value: groupCounts.cross, icon: <UnorderedListOutlined /> },
      { key: "latest", title: "最后监测", value: latestDetectedText, icon: <DatabaseOutlined /> },
    ];
  }, [batchRows, currentScopeStats, detailRows.length, overview, selectedBatchId, selectedStat, selectedTableName, tableRows.length]);

  const ruleGroupSummary = useMemo(() => {
    const buckets: Record<AnalysisRuleGroup, { group: AnalysisRuleGroup; label: string; issueRows: number; statCount: number }> = {
      field: { group: "field", label: RULE_GROUP_LABELS.field, issueRows: 0, statCount: 0 },
      row: { group: "row", label: RULE_GROUP_LABELS.row, issueRows: 0, statCount: 0 },
      stat: { group: "stat", label: RULE_GROUP_LABELS.stat, issueRows: 0, statCount: 0 },
      cross: { group: "cross", label: RULE_GROUP_LABELS.cross, issueRows: 0, statCount: 0 },
    };
    for (const row of currentScopeStats) {
      const bucket = buckets[getRuleGroup(row.ruleCategory)];
      bucket.issueRows += Number(row.issueRows || 0);
      bucket.statCount += 1;
    }
    return Object.values(buckets);
  }, [currentScopeStats]);

  const statsByGroup = useMemo<Record<AnalysisRuleGroup, QualityIssueStatRecord[]>>(
    () => {
      const enrich = (item: QualityIssueStatRecord) => ({
        ...item,
        tableComment: selectedSource ? getTableComment(selectedSource.sourceId, item.tableName) : item.tableComment || "",
        fieldComment: selectedSource ? getFieldComment(selectedSource.sourceId, item.tableName, item.fieldName) : item.fieldComment || "",
        ruleDescription: buildRuleDescription({
          ruleCategory: item.ruleCategory,
          fieldName: item.fieldName,
          fieldComment: selectedSource ? getFieldComment(selectedSource.sourceId, item.tableName, item.fieldName) : item.fieldComment || "",
        }),
      });
      return {
        field: currentScopeStats.filter((item) => getRuleGroup(item.ruleCategory) === "field").map(enrich),
        row: currentScopeStats.filter((item) => getRuleGroup(item.ruleCategory) === "row").map(enrich),
        stat: currentScopeStats.filter((item) => getRuleGroup(item.ruleCategory) === "stat").map(enrich),
        cross: currentScopeStats.filter((item) => getRuleGroup(item.ruleCategory) === "cross").map(enrich),
      };
    },
    [currentScopeStats, selectedSource, tableCommentMap, fieldCommentMap],
  );

  const detailRowsWithComments = useMemo(
    () => detailRows.map((item) => ({
      ...item,
      tableComment: selectedSource ? getTableComment(selectedSource.sourceId, item.tableName) : item.tableComment || "",
      fieldComment: selectedSource ? getFieldComment(selectedSource.sourceId, item.tableName, item.fieldName) : item.fieldComment || "",
      ruleDescription: item.ruleDescription || item.issueMessage || buildRuleDescription({
        ruleCategory: item.ruleCategory,
        fieldName: item.fieldName,
        fieldComment: selectedSource ? getFieldComment(selectedSource.sourceId, item.tableName, item.fieldName) : item.fieldComment || "",
      }),
    })),
    [detailRows, selectedSource, tableCommentMap, fieldCommentMap],
  );

  const tableColumns: ColumnsType<TableSummaryRow> = [
    ...(selectedSource ? [] : [{ title: "数据源", dataIndex: "sourceName", key: "sourceName", width: 110 } as any]),
    { title: "表名", dataIndex: "tableName", key: "tableName", width: 220 },
    { title: "表注释", dataIndex: "tableComment", key: "tableComment", width: 180, render: (value) => formatCell(value) },
    { title: "问题总数", dataIndex: "issueRows", key: "issueRows", width: 110 },
    { title: "统计规则数", dataIndex: "statCount", key: "statCount", width: 100 },
    { title: "批次总数", dataIndex: "batchCount", key: "batchCount", width: 100 },
    { title: "最后监测", dataIndex: "latestDetectedAt", key: "latestDetectedAt", width: 170, render: (value) => formatAnalysisDateTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 160,
      render: (_value, record) => (
        <Space>
          <Button
            type="link"
            onClick={() => {
              if (!selectedSource) {
                const source = sources.find((item) => item.sourceId === record.sourceId) || null;
                if (source) {
                  void enterSource(source).then(() => setSelectedTableName(record.tableName));
                  return;
                }
              }
              setSelectedTableName(record.tableName);
            }}
          >
            查看明细
          </Button>
          <Popconfirm
            title={`确认删除表 ${record.tableName} 的分析结果吗？`}
            description="会删除该表涉及的所有批次问题统计和问题明细。"
            onConfirm={async () => {
              if (!token) return;
              const result = await deleteQualityAnalysisTableResults(token, record.sourceId, record.tableName);
              message.success(`已删除 ${record.tableName} 的分析结果，涉及 ${result.data.deletedBatchCount} 个批次`);
              if (selectedSource) {
                await enterSource(selectedSource);
              } else {
                await loadAllTables();
              }
            }}
          >
            <Button type="link" danger>删除结果</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const batchColumns: ColumnsType<BatchSummaryRow> = [
    { title: "批次号", dataIndex: "batchId", key: "batchId", width: 260, render: (value) => formatQualityBatchId(value) },
    { title: "问题总数", dataIndex: "issueRows", key: "issueRows", width: 120 },
    { title: "统计规则数", dataIndex: "statCount", key: "statCount", width: 120 },
    { title: "问题项数", dataIndex: "ruleCount", key: "ruleCount", width: 120 },
    { title: "最近检测时间", dataIndex: "latestDetectedAt", key: "latestDetectedAt", width: 180, render: (value) => formatAnalysisDateTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_value, record) => (
        <Button type="link" onClick={() => void enterBatch(record.batchId)}>
          查看问题明细
        </Button>
      ),
    },
  ];

  const statColumns: ColumnsType<QualityIssueStatRecord> = [
    { title: "规则分组", dataIndex: "ruleCategory", key: "ruleGroup", width: 120, render: (value) => RULE_GROUP_LABELS[getRuleGroup(value)] || "字段级规则" },
    { title: "监控方向", dataIndex: "ruleCategory", key: "qualityDimension", width: 110, render: (value) => formatQualityDimension(value) },
    { title: "规则类别", dataIndex: "ruleCategory", key: "ruleCategory", width: 160, render: (value) => formatRuleCategory(value) },
    { title: "规则编码", dataIndex: "ruleCode", key: "ruleCode", width: 180 },
    { title: "字段", dataIndex: "fieldName", key: "fieldName", width: 160 },
    { title: "总行数", dataIndex: "totalRows", key: "totalRows", width: 120 },
    { title: "问题行数", dataIndex: "issueRows", key: "issueRows", width: 120 },
    { title: "问题率", dataIndex: "issueRate", key: "issueRate", width: 120, render: (value) => `${(Number(value || 0) * 100).toFixed(2)}%` },
    { title: "当前指标", dataIndex: "metricValue", key: "metricValue", width: 120, render: (value) => value === null || value === undefined ? "-" : Number(value).toFixed(2) },
    { title: "基线值", dataIndex: "baselineValue", key: "baselineValue", width: 120, render: (value) => value === null || value === undefined ? "-" : Number(value).toFixed(2) },
    { title: "阈值", dataIndex: "thresholdValue", key: "thresholdValue", width: 120, render: (value) => value === null || value === undefined ? "-" : Number(value).toFixed(2) },
    { title: "检测时间", dataIndex: "detectedAt", key: "detectedAt", width: 180, render: (value) => formatAnalysisDateTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_value, record) => renderDetailAction(record, (item) => void enterStat(item)),
    },
  ];

  const fieldStatColumns: ColumnsType<QualityIssueStatRecord> = [
    { title: "监控方向", dataIndex: "ruleCategory", key: "qualityDimension", width: 110, render: (value) => formatQualityDimension(value) },
    { title: "规则类别", dataIndex: "ruleCategory", key: "ruleCategory", width: 160, render: (value) => formatRuleCategory(value) },
    { title: "规则编码", dataIndex: "ruleCode", key: "ruleCode", width: 180 },
    { title: "字段", dataIndex: "fieldName", key: "fieldName", width: 180, render: (value, record) => record.fieldComment && record.fieldComment !== "-" ? `${value} / ${record.fieldComment}` : value },
    { title: "规则描述", dataIndex: "ruleDescription", key: "ruleDescription", width: 260 },
    { title: "总行数", dataIndex: "totalRows", key: "totalRows", width: 120 },
    { title: "问题行数", dataIndex: "issueRows", key: "issueRows", width: 120 },
    { title: "问题率", dataIndex: "issueRate", key: "issueRate", width: 120, render: (value) => `${(Number(value || 0) * 100).toFixed(2)}%` },
    { title: "检测时间", dataIndex: "detectedAt", key: "detectedAt", width: 180, render: (value) => formatAnalysisDateTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_value, record) => renderDetailAction(record, (item) => void enterStat(item)),
    },
  ];

  const rowStatColumns: ColumnsType<QualityIssueStatRecord> = [
    { title: "监控方向", dataIndex: "ruleCategory", key: "qualityDimension", width: 110, render: (value) => formatQualityDimension(value) },
    { title: "规则类别", dataIndex: "ruleCategory", key: "ruleCategory", width: 160, render: (value) => formatRuleCategory(value) },
    { title: "规则编码", dataIndex: "ruleCode", key: "ruleCode", width: 220 },
    { title: "关联字段", dataIndex: "fieldName", key: "fieldName", width: 220, render: (value, record) => record.fieldComment && record.fieldComment !== "-" ? `${value} / ${record.fieldComment}` : value },
    {
      title: "规则描述",
      dataIndex: "ruleDescription",
      key: "ruleDescription",
      width: 300,
      render: (value) => (
        <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, tooltip: value || "-" }}>
          {value || "-"}
        </Typography.Paragraph>
      ),
    },
    { title: "问题行数", dataIndex: "issueRows", key: "issueRows", width: 120 },
    { title: "问题率", dataIndex: "issueRate", key: "issueRate", width: 120, render: (value) => `${(Number(value || 0) * 100).toFixed(2)}%` },
    { title: "检测时间", dataIndex: "detectedAt", key: "detectedAt", width: 180, render: (value) => formatAnalysisDateTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_value, record) => renderDetailAction(record, (item) => void enterStat(item)),
    },
  ];

  const statRuleColumns: ColumnsType<QualityIssueStatRecord> = [
    { title: "监控方向", dataIndex: "ruleCategory", key: "qualityDimension", width: 110, render: (value) => formatQualityDimension(value) },
    { title: "规则类别", dataIndex: "ruleCategory", key: "ruleCategory", width: 160, render: (value) => formatRuleCategory(value) },
    { title: "指标字段", dataIndex: "fieldName", key: "fieldName", width: 180, render: (value, record) => record.fieldComment && record.fieldComment !== "-" ? `${value} / ${record.fieldComment}` : value },
    {
      title: "规则描述",
      dataIndex: "ruleDescription",
      key: "ruleDescription",
      width: 300,
      render: (value) => (
        <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, tooltip: value || "-" }}>
          {value || "-"}
        </Typography.Paragraph>
      ),
    },
    { title: "当前指标", dataIndex: "metricValue", key: "metricValue", width: 120, render: (value) => value === null || value === undefined ? "-" : Number(value).toFixed(2) },
    { title: "基线值", dataIndex: "baselineValue", key: "baselineValue", width: 120, render: (value) => value === null || value === undefined ? "-" : Number(value).toFixed(2) },
    { title: "阈值", dataIndex: "thresholdValue", key: "thresholdValue", width: 120, render: (value) => value === null || value === undefined ? "-" : Number(value).toFixed(2) },
    {
      title: "偏差率",
      key: "deviationRate",
      width: 120,
      render: (_value, record) => {
        const current = Number(record.metricValue ?? 0);
        const baseline = Number(record.baselineValue ?? 0);
        if (!baseline) return "-";
        return `${(((current - baseline) / Math.abs(baseline)) * 100).toFixed(2)}%`;
      },
    },
    {
      title: "问题行数",
      key: "issueRows",
      width: 120,
      render: (_value, record) => getDisplayIssueRows(record),
    },
    { title: "检测时间", dataIndex: "detectedAt", key: "detectedAt", width: 180, render: (value) => formatAnalysisDateTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_value, record) => renderDetailAction(record, (item) => void enterStat(item)),
    },
  ];

  const crossStatColumns: ColumnsType<QualityIssueStatRecord> = [
    { title: "监控方向", dataIndex: "ruleCategory", key: "qualityDimension", width: 110, render: (value) => formatQualityDimension(value) },
    {
      title: "校验项",
      dataIndex: "ruleCode",
      key: "ruleCode",
      width: 250,
      render: (value, record) => renderCrossRuleCode(value, record),
    },
    {
      title: "关联/比对字段",
      dataIndex: "fieldName",
      key: "fieldName",
      width: 320,
      render: (value, record) => renderEllipsisText(formatCrossFieldNames(record.tableName, value), 2),
    },
    {
      title: "问题情况",
      key: "issueSummary",
      width: 210,
      render: (_value, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>问题 {Number(record.issueRows || 0)} 行</Typography.Text>
          <Typography.Text type="secondary">共 {Number(record.totalRows || 0)} 行 · {`${(Number(record.issueRate || 0) * 100).toFixed(2)}%`}</Typography.Text>
        </Space>
      ),
    },
    { title: "检测时间", dataIndex: "detectedAt", key: "detectedAt", width: 170, render: (value) => formatAnalysisDateTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 130,
      render: (_value, record) => (
        <Button type="link" onClick={() => void enterStat(record)}>
          查看问题明细
        </Button>
      ),
    },
  ];

  const crossDetailColumns: ColumnsType<QualityIssueDetailRecord> = [
    {
      title: "校验项",
      dataIndex: "ruleCode",
      key: "ruleCode",
      width: 240,
      render: (value, record) => renderCrossRuleCode(value, record),
    },
    {
      title: "一致性比对字段",
      dataIndex: "fieldName",
      key: "fieldName",
      width: 280,
      render: (value, record) => renderEllipsisText(formatCrossFieldNames(record.tableName, value), 2),
    },
    { title: "主键快照", dataIndex: "pkText", key: "pkText", width: 290, render: (value) => renderEllipsisText(value, 2) },
    { title: "比对字段值", dataIndex: "fieldValueText", key: "fieldValueText", width: 390, render: (value) => renderEllipsisText(value, 3) },
    { title: "问题说明", dataIndex: "issueMessage", key: "issueMessage", width: 260, render: (value) => renderEllipsisText(value, 2) },
    { title: "问题级别", dataIndex: "issueLevel", key: "issueLevel", width: 110 },
    { title: "检测时间", dataIndex: "detectedAt", key: "detectedAt", width: 170, render: (value) => formatAnalysisDateTime(value) },
  ];

  const detailColumns: ColumnsType<QualityIssueDetailRecord> = [
    { title: "批次号", dataIndex: "batchId", key: "batchId", width: 260, render: (value) => formatQualityBatchId(value) },
    { title: "表名", dataIndex: "tableName", key: "tableName", width: 260, render: (value, record) => record.tableComment ? `${value} / ${record.tableComment}` : value },
    { title: "规则编码", dataIndex: "ruleCode", key: "ruleCode", width: 180 },
    { title: "规则名称", dataIndex: "ruleName", key: "ruleName", width: 180, render: (value, record) => formatCell(value, `${record.ruleCategory} / ${record.fieldName}`) },
    {
      title: "规则描述",
      dataIndex: "ruleDescription",
      key: "ruleDescription",
      width: 260,
      render: (value) => (
        <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, tooltip: value || "-" }}>
          {value || "-"}
        </Typography.Paragraph>
      ),
    },
    { title: "字段", dataIndex: "fieldName", key: "fieldName", width: 220, render: (value, record) => record.fieldComment ? `${value} / ${record.fieldComment}` : value },
    { title: "主键快照", dataIndex: "pkText", key: "pkText", width: 220, render: (value) => formatCell(value) },
    { title: "字段值", dataIndex: "fieldValueText", key: "fieldValueText", width: 220, render: (value) => formatCell(value) },
    { title: "问题级别", dataIndex: "issueLevel", key: "issueLevel", width: 120 },
    {
      title: "问题说明",
      dataIndex: "issueMessage",
      key: "issueMessage",
      width: 280,
      render: (value, record) => (
        <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 3, tooltip: value || `字段 ${record.fieldName} 命中规则 ${record.ruleCode}` }}>
          {value || `字段 ${record.fieldName} 命中规则 ${record.ruleCode}`}
        </Typography.Paragraph>
      ),
    },
    { title: "检测时间", dataIndex: "detectedAt", key: "detectedAt", width: 180, render: (value) => formatAnalysisDateTime(value) },
  ];

  const breadcrumb = (
    <Space size={8} wrap split={<Typography.Text type="secondary">/</Typography.Text>}>
      <Button type="link" onClick={backToSources} style={{ paddingInline: 0 }}>
        表清单
      </Button>
      {selectedSource ? (
        <Button type="link" onClick={backToTables} style={{ paddingInline: 0 }}>
          {selectedSource.sourceName}
        </Button>
      ) : null}
      {selectedTableName ? (
        <Button type="link" onClick={backToBatches} style={{ paddingInline: 0 }}>
          {selectedTableName}
        </Button>
      ) : null}
      {selectedBatchId ? (
        <Button type="link" onClick={backToStats} style={{ paddingInline: 0 }}>
          {formatQualityBatchId(selectedBatchId)}
        </Button>
      ) : null}
      {selectedStat ? (
        <Typography.Text>{formatRuleCode(selectedStat.ruleCode, selectedStat.ruleCategory)} / {selectedStat.fieldName}</Typography.Text>
      ) : null}
    </Space>
  );

  const currentTitle = selectedStat
    ? "问题明细"
    : selectedBatchId
      ? "问题统计"
      : selectedTableName
        ? "运行批次"
        : "表清单";

  return (
    <div className="app-page">
      <PageToolbar
        left={selectedStat || selectedBatchId || selectedTableName ? breadcrumb : (
          <>
            <Select
              allowClear
              style={{ width: 220 }}
              placeholder="按所属系统过滤"
              value={businessSystemFilter}
              options={businessSystemOptions}
              onChange={setBusinessSystemFilter}
            />
            <Input.Search
              allowClear
              className="toolbar-search"
              placeholder="搜索表名称或表注释"
              value={tableKeyword}
              onChange={(event) => setTableKeyword(event.target.value)}
            />
          </>
        )}
        right={(
          <Space>
            {selectedStat || selectedBatchId || selectedTableName ? (
              <Button icon={<ArrowLeftOutlined />} onClick={selectedStat ? backToStats : selectedBatchId ? backToBatches : selectedTableName ? backToTables : backToSources}>
                返回上一级
              </Button>
            ) : null}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void (selectedSource ? enterSource(selectedSource) : loadAllTables())}
              loading={loading || sourcesLoading}
            >
              刷新
            </Button>
          </Space>
        )}
      />

      <div className="app-page-body">
        {overview ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
              {kpis.map((item) => (
                <div
                  key={item.key}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #edf1f7",
                    background: "#fff",
                    minHeight: 86,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {item.title}
                    </Typography.Text>
                    <span style={{ color: "#3b82f6", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      {item.icon}
                    </span>
                  </div>
                  <Typography.Text strong style={{ fontSize: item.key === "latest" ? 16 : 20, lineHeight: 1.2 }}>
                    {item.value}
                  </Typography.Text>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {selectedSource && overview && (!overview.detailTableExists || !overview.statsTableExists) ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="当前数据源中尚未发现质量结果表"
            description={`问题明细表：${overview.detailTableName}；问题统计表：${overview.statsTableName}`}
          />
        ) : null}

        {!selectedTableName ? <Card variant="borderless" className="surface-card" title="系统级质量分析" style={{ marginBottom: 16 }} extra={<Typography.Text type="secondary">每表最新完成批次</Typography.Text>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { title: "平均质量得分", value: unifiedOverview?.averageScore ?? "-", suffix: "分" },
              { title: "最新批次", value: unifiedOverview?.batchCount || 0, suffix: "批" },
              { title: "最新批次问题行", value: Number(unifiedOverview?.issueRows || 0).toLocaleString(), suffix: "行" },
              { title: "系统归属率", value: unifiedOverview?.systemMappingRate || 0, suffix: "%" },
            ].map((item) => <div key={item.title} style={{ padding: "14px 16px", border: "1px solid #e7edf5", borderRadius: 12, background: "linear-gradient(180deg,#fbfdff,#f6f9fd)" }}><Typography.Text type="secondary">{item.title}</Typography.Text><div style={{ marginTop: 8 }}><Typography.Text strong style={{ color: "#1677ff", fontSize: 24 }}>{item.value}</Typography.Text><Typography.Text type="secondary"> {item.suffix}</Typography.Text></div></div>)}
          </div>
          <Table<any> rowKey={(row) => String(row.businessSystemId || row.systemName)} size="small" pagination={false} dataSource={systemInsights} columns={[
            { title: "所属系统", dataIndex: "systemName", render: (value) => <Typography.Text strong>{value}</Typography.Text> },
            { title: "纳管表", dataIndex: "tableCount", width: 100 },
            { title: "最新批次", dataIndex: "batchCount", width: 110 },
            { title: "问题行", dataIndex: "issueRows", width: 120, render: (value) => Number(value).toLocaleString() },
            { title: "质量得分", dataIndex: "score", width: 120, render: (value) => <Typography.Text type={Number(value) < 80 ? "danger" : undefined} strong>{value === null ? "待积累" : `${value} 分`}</Typography.Text> },
            { title: "统计口径", dataIndex: "partialBatchCount", width: 140, render: (value) => value ? <Tag color="gold">含部分可评估批次</Tag> : <Tag color="green">统计完整</Tag> },
          ]} locale={{ emptyText: <Empty description="完成质量任务并配置所属系统后展示系统级分析" /> }} />
        </Card> : null}

        <Card variant="borderless" className="surface-card" title={selectedTableName ? currentTitle : "表级最新批次统计"}>
          {!selectedTableName ? (
            <Table<TableSummaryRow>
              rowKey={(record) => `${record.sourceId}-${record.tableName}`}
              loading={loading}
              columns={tableColumns}
              dataSource={filteredTableRows}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ x: selectedSource ? 1460 : 1640 }}
              locale={{ emptyText: <Empty description="当前暂无表级分析结果" /> }}
            />
          ) : null}

          {selectedTableName && !selectedBatchId ? (
            <Table<BatchSummaryRow>
              rowKey="batchId"
              loading={loading}
              columns={batchColumns}
              dataSource={batchRows}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ x: 1200 }}
              locale={{ emptyText: <Empty description="当前数据表暂无运行批次" /> }}
            />
          ) : null}

          {selectedBatchId && !selectedStat ? (
            <Tabs
              items={[
                {
                  key: "field",
                  label: `字段级规则 (${statsByGroup.field.length})`,
                  children: (
                    <Table<QualityIssueStatRecord>
                      rowKey={(record) => `${record.statId}-${record.batchId}-${record.fieldName}`}
                      loading={loading}
                      columns={fieldStatColumns}
                      dataSource={statsByGroup.field}
                      pagination={{ pageSize: 8, showSizeChanger: false }}
                      scroll={{ x: 1220 }}
                      locale={{ emptyText: <Empty description="当前批次暂无字段级问题统计" /> }}
                    />
                  ),
                },
                {
                  key: "row",
                  label: `行级规则 (${statsByGroup.row.length})`,
                  children: (
                    <Table<QualityIssueStatRecord>
                      rowKey={(record) => `${record.statId}-${record.batchId}-${record.fieldName}`}
                      loading={loading}
                      columns={rowStatColumns}
                      dataSource={statsByGroup.row}
                      pagination={{ pageSize: 8, showSizeChanger: false }}
                      scroll={{ x: 1180 }}
                      locale={{ emptyText: <Empty description="当前批次暂无行级问题统计" /> }}
                    />
                  ),
                },
                {
                  key: "stat",
                  label: `统计型规则 (${statsByGroup.stat.length})`,
                  children: (
                    <Table<QualityIssueStatRecord>
                      rowKey={(record) => `${record.statId}-${record.batchId}-${record.fieldName}`}
                      loading={loading}
                      columns={statRuleColumns}
                      dataSource={statsByGroup.stat}
                      pagination={{ pageSize: 8, showSizeChanger: false }}
                      scroll={{ x: 1300 }}
                      locale={{ emptyText: <Empty description="当前批次暂无统计型问题统计" /> }}
                    />
                  ),
                },
                {
                  key: "cross",
                  label: `跨表规则 (${statsByGroup.cross.length})`,
                  children: (
                    <Table<QualityIssueStatRecord>
                      rowKey={(record) => `${record.statId}-${record.batchId}-${record.fieldName}`}
                      loading={loading}
                      columns={crossStatColumns}
                      dataSource={statsByGroup.cross}
                      pagination={{ pageSize: 8, showSizeChanger: false }}
                      tableLayout="fixed"
                      scroll={{ x: 1080 }}
                      locale={{ emptyText: <Empty description="当前批次暂无跨表问题统计" /> }}
                    />
                  ),
                },
              ]}
            />
          ) : null}

          {selectedStat ? (
            <Table<QualityIssueDetailRecord>
              rowKey={(record) => `${record.issueId}-${record.batchId}`}
              loading={loading}
              columns={getRuleGroup(selectedStat.ruleCategory) === "cross" ? crossDetailColumns : detailColumns}
              dataSource={detailRowsWithComments}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              tableLayout="fixed"
              scroll={{ x: getRuleGroup(selectedStat.ruleCategory) === "cross" ? 1740 : 2080 }}
              locale={{ emptyText: <Empty description="当前规则暂无问题明细" /> }}
            />
          ) : null}
        </Card>
      </div>
    </div>
  );
}
