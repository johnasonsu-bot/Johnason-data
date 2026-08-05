import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Transfer,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TransferItem } from "antd/es/transfer";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  compareDataSourceResearchReports,
  createDataSourceResearchTaskRun,
  deleteDataSourceResearchRun,
  downloadDataSourceResearchReportWord,
  fetchDataSourceResearchComparisons,
  fetchDataSourceResearchReport,
  fetchDataSourceResearchRun,
  fetchDataSourceResearchTask,
  fetchDataSourceResearchTaskRuns,
  fetchDataSourceTables,
  fetchDataSources,
  terminateDataSourceResearchRun,
  updateDataSourceResearchTask,
} from "../../services/platform";
import type {
  DataSourceRecord,
  DataSourceResearchReport,
  DataSourceResearchReportComparisonRecord,
  DataSourceResearchRunRecord,
  DataSourceResearchTableRelationshipReport,
  DataSourceResearchTaskRecord,
  DataSourceTable,
} from "../../types/api";
import { inferDatasourceDialect } from "../../utils/datasource";
import { ResearchRelationshipErGraph } from "./components/ResearchRelationshipErGraph";
import {
  RESEARCH_ITEM_LABELS,
  RESEARCH_ITEM_OPTIONS,
  buildReportMarkdown,
  categoryLabel,
  downloadTextFile,
  formatDateTime,
  formatNumber,
  formatPercentage,
  getResearchObjectLabels,
  isResearchItemKey,
  normalizeResearchItemKey,
  priorityLabel,
  renderStatusTag,
  sortResearchTables,
  type ResearchItemKey,
} from "./researchCommon";

type ResearchTable = DataSourceResearchReport["tables"][number];
type RelationshipRelation = DataSourceResearchTableRelationshipReport["relations"][number];
type RelationshipEntity = DataSourceResearchTableRelationshipReport["entities"][number];

type ResearchFieldRow = {
  tableName: string;
  tableComment?: string;
  columnName: string;
  ordinalPosition?: number;
  dataType?: string;
  columnType?: string;
  isNullable?: boolean;
  isPrimaryKey?: boolean;
  columnComment?: string;
  nullRate?: number;
  distinctRatio?: number;
  sampleValues?: string[];
  issueTags?: string[];
};

type MetricItem = {
  key: string;
  title: string;
  value: ReactNode;
  description?: ReactNode;
};

type AnalysisCoreBusinessTable = {
  tableName: string;
  reason?: string;
  analysisValue?: string;
  suggestedSubjects?: string[];
  dimensions?: string[];
};

type AnalysisDirection = {
  direction: string;
  coreTable?: string;
  relatedTables?: string[];
  measures?: string[];
  dimensions?: string[];
  sampleEvidence?: string[];
  analysisQuestions?: string[];
  outputSuggestions?: string[];
  caveats?: string[];
};

type ResearchTaskFormValues = {
  taskName: string;
  sourceId: number;
  tableScope: "all" | "manual";
  selectedTables: string[];
  sampleSize: number;
  maxTables: number;
  rowCountMode: "estimated" | "exact";
  metadataConcurrency: number;
  aiBatchSize: number;
  researchItems: ResearchItemKey[];
  notes?: string;
  description?: string;
  status: "active" | "disabled";
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #eef2f7",
  borderRadius: 8,
  padding: 16,
  background: "#fff",
};

const metricBoxStyle: React.CSSProperties = {
  border: "1px solid #edf1f7",
  borderRadius: 8,
  padding: "12px 14px",
  minHeight: 82,
  background: "#fbfcfe",
};

const compactCardStyles = {
  header: { minHeight: 42, padding: "0 16px" },
  body: { padding: 14 },
};

const topCompactCardStyles = {
  header: { minHeight: 38, padding: "0 16px" },
  body: { padding: "10px 14px" },
};

const overviewMetricBoxStyle: React.CSSProperties = {
  border: "1px solid #edf1f7",
  borderRadius: 8,
  padding: "6px 10px",
  minHeight: 54,
  background: "#fbfcfe",
};

const topOverviewMetricBoxStyle: React.CSSProperties = {
  ...overviewMetricBoxStyle,
  padding: "5px 9px",
  minHeight: 48,
};

const RELATION_SOURCE_LABELS: Record<string, string> = {
  constraint: "显式约束",
  name_rule: "命名规则",
  ai: "模型判断",
};

function rowCountModeLabel(value?: string | null) {
  return value === "exact" ? "精确统计" : "估算优先";
}

function tableScopeLabel(scope?: string, selectedCount = 0, maxTables?: number, labels = getResearchObjectLabels()) {
  return scope === "manual"
    ? `手工勾选 ${selectedCount} ${labels.objectUnit}${labels.objectName}`
    : `${labels.allScopePrefix}前 ${maxTables || 50} ${labels.objectUnit}${labels.objectName}`;
}

function formatTimeRange(start?: string | null, end?: string | null) {
  return `${formatDateTime(start)} 至 ${formatDateTime(end)}`;
}

function relationSourceLabel(value?: string) {
  return RELATION_SOURCE_LABELS[String(value || "")] || value || "-";
}

function renderArrayTags(values?: unknown[], color?: string, max = 20) {
  const list = (Array.isArray(values) ? values : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (!list.length) return "-";
  const visible = list.slice(0, max);
  return (
    <Space size={[4, 4]} wrap>
      {visible.map((item, index) => (
        <Tag
          key={`${item}-${index}`}
          color={color}
          style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={item}
        >
          {item}
        </Tag>
      ))}
      {list.length > visible.length ? <Tag>+{list.length - visible.length}</Tag> : null}
    </Space>
  );
}

const FIELD_ISSUE_LABELS: Record<string, string> = {
  missing_comment: "字段注释缺失",
  high_null_rate: "高空值率",
  low_cardinality: "低基数字段",
  high_cardinality: "高基数字段",
};

function issueTypeLabel(value?: unknown) {
  const text = String(value || "").trim();
  return FIELD_ISSUE_LABELS[text] || text || "其他问题";
}

function renderIssueTags(values?: unknown[], color = "red", max = 8) {
  return renderArrayTags((values || []).map(issueTypeLabel), color, max);
}

function renderTextList(values?: string[], pageSize = 5) {
  const list = (values || []).map((item) => item.trim()).filter(Boolean);
  if (!list.length) return <Typography.Text type="secondary">暂无</Typography.Text>;
  return (
    <List
      size="small"
      dataSource={list}
      pagination={list.length > pageSize ? { pageSize, size: "small", showSizeChanger: false, hideOnSinglePage: true } : false}
      renderItem={(item) => <List.Item>{item}</List.Item>}
    />
  );
}

function renderIssueList(values?: string[], max = 8) {
  const list = (values || []).map((item) => item.trim()).filter(Boolean);
  const visible = list.slice(0, max);
  return list.length ? (
    <Space direction="vertical" size={4}>
      {visible.map((item) => <Typography.Text key={item}>{item}</Typography.Text>)}
      {list.length > visible.length ? <Typography.Text type="secondary">+{list.length - visible.length} 项</Typography.Text> : null}
    </Space>
  ) : "-";
}

function renderSummaryAlert(message?: string, type: "info" | "success" = "info") {
  if (!message) return null;
  return (
    <Alert
      type={type}
      showIcon
      message={(
        <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, expandable: true, symbol: "展开" }}>
          {message}
        </Typography.Paragraph>
      )}
    />
  );
}

function renderMetricGrid(items: MetricItem[]) {
  return (
    <Row gutter={[12, 12]}>
      {items.map((item) => (
        <Col xs={12} md={6} key={item.key}>
          <div style={metricBoxStyle}>
            <Typography.Text type="secondary">{item.title}</Typography.Text>
            <Typography.Title level={4} style={{ margin: "4px 0 0" }}>{item.value}</Typography.Title>
            {item.description ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {item.description}
              </Typography.Text>
            ) : null}
          </div>
        </Col>
      ))}
    </Row>
  );
}

function renderOverviewMetricGrid(items: MetricItem[]) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
      {items.map((item) => (
        <div key={item.key} style={overviewMetricBoxStyle}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.title}</Typography.Text>
          <Typography.Title level={4} style={{ margin: "1px 0 0", fontSize: 20 }}>{item.value}</Typography.Title>
          {item.description ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {item.description}
            </Typography.Text>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function renderTopOverviewMetricGrid(items: MetricItem[]) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
      {items.map((item) => (
        <div key={item.key} style={topOverviewMetricBoxStyle}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.title}</Typography.Text>
          <Typography.Title level={4} style={{ margin: 0, fontSize: 19 }}>{item.value}</Typography.Title>
          {item.description ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {item.description}
            </Typography.Text>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Section(props: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div style={sectionStyle}>
      <Space style={{ justifyContent: "space-between", width: "100%", marginBottom: 12 }} align="center" wrap>
        <Typography.Title level={5} style={{ margin: 0 }}>{props.title}</Typography.Title>
        {props.extra}
      </Space>
      {props.children}
    </div>
  );
}

function getTableFields(table: ResearchTable): ResearchFieldRow[] {
  const fields = table.fieldProfiles?.length ? table.fieldProfiles : table.columns;
  return (fields || [])
    .map((field) => {
      const profile = field as Partial<ResearchFieldRow>;
      return {
        tableName: table.tableName,
        tableComment: table.tableComment,
        columnName: field.columnName,
        ordinalPosition: field.ordinalPosition,
        dataType: field.dataType,
        columnType: field.columnType,
        isNullable: field.isNullable,
        isPrimaryKey: field.isPrimaryKey,
        columnComment: field.columnComment,
        nullRate: typeof profile.nullRate === "number" ? profile.nullRate : undefined,
        distinctRatio: typeof profile.distinctRatio === "number" ? profile.distinctRatio : undefined,
        sampleValues: Array.isArray(profile.sampleValues) ? profile.sampleValues : undefined,
        issueTags: Array.isArray(profile.issueTags) ? profile.issueTags : undefined,
      };
    })
    .sort((left, right) => Number(left.ordinalPosition || 0) - Number(right.ordinalPosition || 0));
}

function getFieldRows(report?: DataSourceResearchReport | null) {
  return (report?.tables || []).flatMap(getTableFields);
}

function hasPrimaryKey(table: ResearchTable) {
  return getTableFields(table).some((field) => Boolean(field.isPrimaryKey));
}

function missingFieldCommentCount(table: ResearchTable) {
  return getTableFields(table).filter((field) => !String(field.columnComment || "").trim()).length;
}

function tableMetadataIssueTypes(table: ResearchTable) {
  return [
    ...(table.metadataIssues || []),
    ...(!hasPrimaryKey(table) ? ["缺少主键"] : []),
    ...(!String(table.incrementalColumn || "").trim() ? ["缺少增量字段"] : []),
  ];
}

function normalizeStringList(values?: unknown[]) {
  return (Array.isArray(values) ? values : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function primaryKeyFields(table: ResearchTable) {
  const summaryValues = normalizeStringList(table.fieldSummary?.primaryKeys);
  if (summaryValues.length) return summaryValues;
  return getTableFields(table).filter((field) => field.isPrimaryKey).map((field) => field.columnName);
}

function timeFields(table: ResearchTable) {
  const summaryValues = normalizeStringList(table.fieldSummary?.timeFields);
  if (summaryValues.length) return summaryValues;
  return getTableFields(table)
    .filter((field) => /time|date|created|updated|日期|时间/i.test(`${field.columnName} ${field.columnComment || ""} ${field.dataType || field.columnType || ""}`))
    .map((field) => field.columnName);
}

function codeStatusFields(table: ResearchTable) {
  const summaryValues = [
    ...normalizeStringList(table.fieldSummary?.codeLikeFields),
    ...normalizeStringList(table.fieldSummary?.statusLikeFields),
    ...normalizeStringList(table.fieldSummary?.typeLikeFields),
  ];
  if (summaryValues.length) return Array.from(new Set(summaryValues));
  return getTableFields(table)
    .filter((field) => /code|status|type|state|flag|编码|状态|类型|标识/i.test(`${field.columnName} ${field.columnComment || ""}`))
    .map((field) => field.columnName);
}

function nameFields(table: ResearchTable) {
  const summaryValues = normalizeStringList(table.fieldSummary?.nameLikeFields);
  if (summaryValues.length) return summaryValues;
  return getTableFields(table)
    .filter((field) => /name|title|名称|标题/i.test(`${field.columnName} ${field.columnComment || ""}`))
    .map((field) => field.columnName);
}

function highNullFields(table: ResearchTable) {
  const summaryValues = normalizeStringList(table.fieldSummary?.highNullFields);
  if (summaryValues.length) return summaryValues;
  return getTableFields(table)
    .filter((field) => Number(field.nullRate || 0) >= 0.5)
    .map((field) => field.columnName);
}

function topDataTypeStats(rows: ResearchFieldRow[], max = 8) {
  return Object.entries(rows.reduce<Record<string, number>>((acc, field) => {
    const key = String(field.dataType || field.columnType || "unknown").toLowerCase();
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {}))
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, max);
}

function formatCountRatio(count: number, total: number) {
  return `${formatNumber(count)} / ${formatNumber(total)}`;
}

function priorityStats(tables: ResearchTable[]) {
  return tables.reduce<Record<string, number>>((acc, table) => {
    const key = table.priority || "unknown";
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
}

function truncateText(value: string, max: number) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function buildResearchReportFileNameBase(taskName: string, generatedAt?: string | null) {
  const safeTaskName = String(taskName || "数据调研报告")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "数据调研报告";
  const date = new Date(generatedAt || Date.now());
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (value: number) => String(value).padStart(2, "0");
  const timestamp = `${validDate.getFullYear()}${pad(validDate.getMonth() + 1)}${pad(validDate.getDate())}_${pad(validDate.getHours())}${pad(validDate.getMinutes())}${pad(validDate.getSeconds())}`;
  return `${safeTaskName}_${timestamp}`;
}

function normalizeResearchReport(value?: DataSourceResearchReport | null): DataSourceResearchReport | null {
  if (!value) return null;
  const source = value.source || {};
  const run = value.run || {};
  const config = value.config || {};
  const overview = value.overview || {};
  const recommendations = value.recommendations || {};
  const tables = Array.isArray(value.tables) ? value.tables : [];

  return {
    ...value,
    source: {
      id: Number(source.id || 0),
      sourceName: source.sourceName || "",
      sourceCode: source.sourceCode || "",
      sourceType: source.sourceType || "",
      databaseName: source.databaseName,
      schemaName: source.schemaName,
    },
    run: {
      id: Number(run.id || 0),
      runName: run.runName || "",
      createdAt: run.createdAt || "",
      startedAt: run.startedAt,
    },
    config: {
      ...config,
      tableScope: config.tableScope || "all",
      selectedTables: Array.isArray(config.selectedTables) ? config.selectedTables : [],
      researchItems: Array.isArray(config.researchItems) ? config.researchItems : [],
    },
    overview: {
      totalTables: Number(overview.totalTables ?? tables.length),
      totalRowCount: Number(overview.totalRowCount || 0),
      categoryStats: overview.categoryStats || {},
      summary: overview.summary || "",
    },
    tables,
    recommendations: {
      recommendedTables: Array.isArray(recommendations.recommendedTables) ? recommendations.recommendedTables : [],
      deferredTables: Array.isArray(recommendations.deferredTables) ? recommendations.deferredTables : [],
      governanceSuggestions: Array.isArray(recommendations.governanceSuggestions) ? recommendations.governanceSuggestions : [],
      ingestionSuggestions: Array.isArray(recommendations.ingestionSuggestions) ? recommendations.ingestionSuggestions : [],
      analysisSuggestions: Array.isArray(recommendations.analysisSuggestions) ? recommendations.analysisSuggestions : [],
    },
  };
}

export function DataSourceResearchDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [taskForm] = Form.useForm<ResearchTaskFormValues>();
  const taskId = Number(params.taskId || 0);
  const tableScope = Form.useWatch("tableScope", taskForm) || "all";
  const selectedTables = Form.useWatch("selectedTables", taskForm) || [];
  const selectedSourceId = Form.useWatch("sourceId", taskForm);

  const [task, setTask] = useState<DataSourceResearchTaskRecord | null>(null);
  const [runs, setRuns] = useState<DataSourceResearchRunRecord[]>([]);
  const [activeRun, setActiveRun] = useState<DataSourceResearchRunRecord | null>(null);
  const [report, setReport] = useState<DataSourceResearchReport | null>(null);
  const [comparisons, setComparisons] = useState<DataSourceResearchReportComparisonRecord[]>([]);
  const [selectedComparison, setSelectedComparison] = useState<DataSourceResearchReportComparisonRecord | null>(null);
  const [sources, setSources] = useState<DataSourceRecord[]>([]);
  const [sourceTables, setSourceTables] = useState<DataSourceTable[]>([]);
  const [baseRunId, setBaseRunId] = useState<number | undefined>();
  const [targetRunId, setTargetRunId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingRunDetail, setLoadingRunDetail] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [runningTask, setRunningTask] = useState(false);
  const [terminatingRunId, setTerminatingRunId] = useState<number | null>(null);
  const [downloadingRunId, setDownloadingRunId] = useState<number | null>(null);
  const [comparing, setComparing] = useState(false);
  const [qualityTableFilter, setQualityTableFilter] = useState<string | undefined>();
  const [relationshipTableFilter, setRelationshipTableFilter] = useState<string | undefined>();
  const taskConfig = useMemo(() => ({
    sampleSize: task?.config?.sampleSize || 50,
    maxTables: task?.config?.maxTables || 50,
    rowCountMode: task?.config?.rowCountMode || "estimated",
    metadataConcurrency: task?.config?.metadataConcurrency || 3,
    aiBatchSize: task?.config?.aiBatchSize || 15,
    notes: task?.config?.notes || "",
    researchItems: task?.config?.researchItems || [],
  }), [task]);

  const reportConfig = useMemo(() => ({
    sampleSize: report?.config?.sampleSize || taskConfig.sampleSize,
    maxTables: report?.config?.maxTables || taskConfig.maxTables,
    rowCountMode: report?.config?.rowCountMode || taskConfig.rowCountMode,
    metadataConcurrency: report?.config?.metadataConcurrency || taskConfig.metadataConcurrency,
    aiBatchSize: report?.config?.aiBatchSize || taskConfig.aiBatchSize,
    notes: report?.config?.notes || taskConfig.notes,
    researchItems: report?.config?.researchItems || taskConfig.researchItems,
    tableScope: report?.config?.tableScope || task?.tableScope || "all",
    selectedTables: report?.config?.selectedTables || task?.selectedTables || [],
  }), [report, task, taskConfig]);

  const selectedResearchItems = useMemo(() => {
    const merged = [
      ...taskConfig.researchItems,
      ...reportConfig.researchItems,
      ...(report?.tableRelationships ? ["table_relationship"] : []),
    ];
    const unique = Array.from(new Set(merged.map(normalizeResearchItemKey).filter(Boolean))) as ResearchItemKey[];
    return unique.length ? unique : RESEARCH_ITEM_OPTIONS.map((item) => item.value);
  }, [taskConfig, reportConfig, report]);

  const fieldRows = useMemo(() => getFieldRows(report), [report]);
  const sortedTables = useMemo(() => sortResearchTables(report?.tables || []), [report]);
  const selectedFormSource = useMemo(() => sources.find((item) => item.id === selectedSourceId), [selectedSourceId, sources]);
  const objectLabels = useMemo(
    () => getResearchObjectLabels(selectedFormSource?.sourceType || report?.source?.sourceType || task?.sourceType),
    [report?.source?.sourceType, selectedFormSource?.sourceType, task?.sourceType]
  );
  const tableFilterOptions = useMemo(() => (report?.tables || []).map((item) => ({
    value: item.tableName,
    label: item.tableName,
  })), [report]);
  const supportedSources = useMemo(() => sources.filter((item) => (
    ["mysql", "postgresql", "hive", "ftp", "kafka"].includes(inferDatasourceDialect(item.sourceType, item.connectionConfig || {}))
  )), [sources]);
  const tableTransferData = useMemo<TransferItem[]>(() => sourceTables.map((item) => ({
    key: item.tableName,
    title: item.tableName,
    description: item.tableComment || "",
  })), [sourceTables]);
  const successfulRuns = useMemo(() => runs.filter((item) => item.status === "succeeded"), [runs]);
  const runOptions = successfulRuns.map((item) => ({
    value: item.id,
    label: `第 ${item.runNo || item.id} 批 / ${formatDateTime(item.finishedAt || item.createdAt)}`,
  }));

  async function loadSources() {
    if (!token) return;
    try {
      const response = await fetchDataSources(token, { includeConnectivity: true });
      setSources(response.data || []);
    } catch (error: any) {
      message.error(`加载数据源失败: ${error.message || "未知错误"}`);
    }
  }

  async function loadTables(sourceId?: number) {
    if (!token || !sourceId) {
      setSourceTables([]);
      return;
    }
    setLoadingTables(true);
    try {
      const response = await fetchDataSourceTables(token, sourceId);
      setSourceTables(response.data || []);
    } catch (error: any) {
      setSourceTables([]);
      message.error(`加载表清单失败: ${error.message || "未知错误"}`);
    } finally {
      setLoadingTables(false);
    }
  }

  async function loadRunDetail(runId: number, options?: { silent?: boolean }) {
    if (!token || !runId) return;
    if (!options?.silent) setLoadingRunDetail(true);
    try {
      const [runResponse, reportResponse] = await Promise.all([
        fetchDataSourceResearchRun(token, runId),
        fetchDataSourceResearchReport(token, runId),
      ]);
      setActiveRun(runResponse.data || null);
      setReport(normalizeResearchReport(reportResponse.data));
    } catch (error: any) {
      message.error(`加载调研批次详情失败: ${error.message || "未知错误"}`);
    } finally {
      if (!options?.silent) setLoadingRunDetail(false);
    }
  }

  async function loadPage(options?: { selectRunId?: number; silent?: boolean }) {
    if (!token || !taskId) return;
    if (!options?.silent) setLoading(true);
    try {
      const [taskResponse, runResponse, comparisonResponse] = await Promise.all([
        fetchDataSourceResearchTask(token, taskId),
        fetchDataSourceResearchTaskRuns(token, taskId),
        fetchDataSourceResearchComparisons(token, taskId),
      ]);
      const nextTask = taskResponse.data || null;
      const nextRuns = runResponse.data || [];
      const nextComparisons = comparisonResponse.data || [];
      const queryRunId = Number(searchParams.get("runId") || 0);
      const nextRunId = options?.selectRunId || queryRunId || activeRun?.id || nextTask?.lastRunId || nextRuns[0]?.id;

      setTask(nextTask);
      setRuns(nextRuns);
      setComparisons(nextComparisons);
      setSelectedComparison((current) => current && nextComparisons.some((item) => item.id === current.id) ? current : nextComparisons[0] || null);

      if (nextRunId) {
        await loadRunDetail(nextRunId, { silent: options?.silent });
      } else {
        setActiveRun(null);
        setReport(null);
      }
    } catch (error: any) {
      message.error(`加载数据调研详情失败: ${error.message || "未知错误"}`);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    void loadPage();
  }, [token, taskId]);

  useEffect(() => {
    if (!token) return;
    void loadSources();
  }, [token]);

  useEffect(() => {
    if (!taskModalOpen) return;
    void loadTables(selectedSourceId);
  }, [selectedSourceId, taskModalOpen, token]);

  useEffect(() => {
    if (!activeRun || !["pending", "running"].includes(String(activeRun.status || ""))) return;
    const timer = window.setInterval(() => {
      void loadPage({ selectRunId: activeRun.id, silent: true });
    }, 2500);
    return () => window.clearInterval(timer);
  }, [activeRun, token, taskId]);

  function openEditTask() {
    if (!task) return;
    const researchItems = taskConfig.researchItems
      .map(normalizeResearchItemKey)
      .filter(isResearchItemKey);

    taskForm.setFieldsValue({
      taskName: task.taskName,
      sourceId: task.sourceId,
      tableScope: task.tableScope,
      selectedTables: task.selectedTables || [],
      sampleSize: taskConfig.sampleSize,
      maxTables: taskConfig.maxTables,
      rowCountMode: taskConfig.rowCountMode,
      metadataConcurrency: taskConfig.metadataConcurrency,
      aiBatchSize: taskConfig.aiBatchSize,
      researchItems: researchItems.length ? researchItems : ["table_classification", "data_scale", "quality_inspection", "ingestion_advice"],
      notes: taskConfig.notes,
      description: task.description || "",
      status: task.status || "active",
    });
    setTaskModalOpen(true);
  }

  async function handleSubmitTask() {
    if (!token || !task) return;
    try {
      const values = await taskForm.validateFields();
      setTaskSubmitting(true);
      await updateDataSourceResearchTask(token, task.id, values);
      message.success("数据调研任务已更新");
      setTaskModalOpen(false);
      await loadPage({ selectRunId: activeRun?.id });
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`保存数据调研任务失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setTaskSubmitting(false);
    }
  }

  async function handleSelectRun(runId: number) {
    setSearchParams({ runId: String(runId) });
    await loadRunDetail(runId);
  }

  async function handleRunTask() {
    if (!token || !task) return;
    setRunningTask(true);
    try {
      const response = await createDataSourceResearchTaskRun(token, task.id);
      message.success("调研批次已启动");
      setSearchParams({ runId: String(response.data.id) });
      await loadPage({ selectRunId: response.data.id });
    } catch (error: any) {
      message.error(`启动调研失败: ${error.message || "未知错误"}`);
    } finally {
      setRunningTask(false);
    }
  }

  async function handleTerminateRun(runId: number) {
    if (!token) return;
    setTerminatingRunId(runId);
    try {
      await terminateDataSourceResearchRun(token, runId);
      message.success("调研批次已终止");
      await loadPage({ selectRunId: runId });
    } catch (error: any) {
      message.error(`终止调研批次失败: ${error.message || "未知错误"}`);
    } finally {
      setTerminatingRunId(null);
    }
  }

  async function handleDeleteRun(runId: number) {
    if (!token) return;
    try {
      await deleteDataSourceResearchRun(token, runId);
      message.success("调研批次已删除");
      await loadPage({ selectRunId: undefined });
    } catch (error: any) {
      message.error(`删除调研批次失败: ${error.message || "未知错误"}`);
    }
  }

  function handleDownloadReport(format: "json" | "md") {
    if (!activeRun || !report) {
      message.warning("当前批次暂无可下载报告");
      return;
    }
    const filenameBase = buildResearchReportFileNameBase(
      task?.taskName || activeRun.runName,
      activeRun.finishedAt || activeRun.updatedAt || activeRun.createdAt,
    );
    if (format === "json") {
      downloadTextFile(`${filenameBase}.json`, JSON.stringify(report, null, 2), "application/json");
      return;
    }
    downloadTextFile(`${filenameBase}.md`, buildReportMarkdown(report), "text/markdown");
  }

  async function handleDownloadWord(targetRun: DataSourceResearchRunRecord) {
    if (!token || targetRun.status !== "succeeded") {
      message.warning("当前批次暂无可下载报告");
      return;
    }
    try {
      setDownloadingRunId(targetRun.id);
      const fallbackFileName = `${buildResearchReportFileNameBase(
        task?.taskName || targetRun.runName,
        targetRun.finishedAt || targetRun.updatedAt || targetRun.createdAt,
      )}.docx`;
      await downloadDataSourceResearchReportWord(token, targetRun.id, fallbackFileName);
    } catch (error: any) {
      message.error(`下载 Word 报告失败: ${error.message || "未知错误"}`);
    } finally {
      setDownloadingRunId(null);
    }
  }

  async function handleCompareReports() {
    if (!token || !task || !baseRunId || !targetRunId) {
      message.warning("请选择两个报告批次");
      return;
    }
    if (baseRunId === targetRunId) {
      message.warning("基准批次和对比批次不能相同");
      return;
    }
    setComparing(true);
    try {
      const response = await compareDataSourceResearchReports(token, task.id, { baseRunId, targetRunId });
      setSelectedComparison(response.data);
      const comparisonResponse = await fetchDataSourceResearchComparisons(token, task.id);
      setComparisons(comparisonResponse.data || []);
      message.success("调研报告对比已生成");
    } catch (error: any) {
      message.error(`生成报告对比失败: ${error.message || "未知错误"}`);
    } finally {
      setComparing(false);
    }
  }

  function renderBatchSection() {
    const runColumns: ColumnsType<DataSourceResearchRunRecord> = [
      { title: "批次", width: 58, render: (_value, record) => record.runNo ? `第 ${record.runNo} 批` : record.id },
      { title: "名称", dataIndex: "runName", width: 118, ellipsis: true },
      { title: "状态", dataIndex: "status", width: 62, render: renderStatusTag },
      { title: "进度", dataIndex: "progressPercent", width: 56, render: (value) => `${value || 0}%` },
      {
        title: "完成时间",
        width: 112,
        render: (_value, record) => (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {formatDateTime(record.finishedAt || record.startedAt)}
          </Typography.Text>
        ),
      },
      {
        title: "操作",
        width: 96,
        render: (_value, record) => (
          <Space size={2}>
            <Button type="link" style={{ paddingInline: 4 }} onClick={() => void handleSelectRun(record.id)}>查看</Button>
            {["pending", "running"].includes(String(record.status || "")) ? (
              <Popconfirm title="确认终止该批次？" onConfirm={() => void handleTerminateRun(record.id)}>
                <Button type="link" danger style={{ paddingInline: 4 }} loading={terminatingRunId === record.id}>终止</Button>
              </Popconfirm>
            ) : null}
            <Button type="link" style={{ paddingInline: 4 }} loading={downloadingRunId === record.id} onClick={() => void handleDownloadWord(record)} disabled={record.status !== "succeeded"}>Word</Button>
            <Popconfirm title="确认删除该批次？" onConfirm={() => void handleDeleteRun(record.id)} okButtonProps={{ danger: true }}>
              <Button type="link" danger style={{ paddingInline: 4 }} disabled={["pending", "running"].includes(String(record.status || ""))}>删</Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return (
      <Card title="批次情况" loading={loading} variant="borderless" size="small" styles={topCompactCardStyles} style={{ height: "100%" }}>
        <Space direction="vertical" size={6} style={{ display: "flex" }}>
          <Space style={{ justifyContent: "space-between", width: "100%" }} align="center" wrap>
            <Space wrap>
              <Select
                placeholder="选择调研批次"
                style={{ width: 240 }}
                value={activeRun?.id}
                options={runs.map((item) => ({
                  value: item.id,
                  label: `${item.runNo ? `第 ${item.runNo} 批` : item.id} / ${item.runName}`,
                }))}
                onChange={(value) => void handleSelectRun(value)}
              />
            </Space>
            {activeRun ? (
              <Space size={10} wrap>
                {renderStatusTag(activeRun.status)}
                <Progress
                  percent={activeRun.progressPercent}
                  size="small"
                  style={{ width: 96 }}
                  status={activeRun.status === "failed" ? "exception" : undefined}
                />
                <Typography.Text type="secondary">{formatTimeRange(activeRun.startedAt, activeRun.finishedAt)}</Typography.Text>
              </Space>
            ) : null}
            {activeRun && ["pending", "running"].includes(String(activeRun.status || "")) ? (
              <Popconfirm title="确认终止当前调研批次？" onConfirm={() => void handleTerminateRun(activeRun.id)}>
                <Button danger icon={<StopOutlined />} loading={terminatingRunId === activeRun.id}>终止当前批次</Button>
              </Popconfirm>
            ) : null}
          </Space>

          {activeRun?.errorMessage ? <Alert type="error" showIcon message={activeRun.errorMessage} /> : null}
          {!activeRun ? (
            <Empty description="当前任务暂无调研批次" />
          ) : null}

          <Table<DataSourceResearchRunRecord>
            rowKey="id"
            size="small"
            columns={runColumns}
            dataSource={runs}
            pagination={{ pageSize: 3, showSizeChanger: false, hideOnSinglePage: true }}
            scroll={{ x: 502 }}
            rowClassName={(record) => record.id === activeRun?.id ? "ant-table-row-selected" : ""}
            locale={{ emptyText: "当前任务暂无调研批次" }}
          />
        </Space>
      </Card>
    );
  }

  function renderScaleTab() {
    if (!report) return <Empty description={loadingRunDetail ? "正在加载报告" : "当前批次尚未生成报告"} />;
    const scaleInsight = report.insights?.dataScale;
    const largeTables = scaleInsight?.largeTables?.length
      ? scaleInsight.largeTables
      : sortedTables.filter((item) => Number(item.rowCount || 0) >= 100000).map((item) => item.tableName);
    const smallOrEmptyTables = scaleInsight?.smallOrEmptyTables?.length
      ? scaleInsight.smallOrEmptyTables
      : sortedTables.filter((item) => Number(item.rowCount || 0) <= 10).map((item) => item.tableName);
    const complexTables = scaleInsight?.complexTables?.length
      ? scaleInsight.complexTables
      : sortedTables.filter((item) => Number(item.columnCount || 0) >= 30 || Number(item.constraints || 0) >= 5).map((item) => item.tableName);
    const scaleSuggestions = scaleInsight?.suggestions?.length
      ? scaleInsight.suggestions
      : [objectLabels.defaultScaleSuggestion];
    const columns: ColumnsType<ResearchTable> = [
      { title: objectLabels.objectNameTitle, dataIndex: "tableName", width: 240, fixed: "left" },
      { title: objectLabels.objectCommentTitle, dataIndex: "tableComment", width: 240, render: (value) => value || "-" },
      { title: objectLabels.rowCountTitle, dataIndex: "rowCount", width: 130, render: formatNumber, sorter: (a, b) => Number(a.rowCount || 0) - Number(b.rowCount || 0) },
      { title: "字段数", dataIndex: "columnCount", width: 100 },
      { title: "样本数", dataIndex: "sampleCount", width: 100 },
      { title: "索引数", dataIndex: "indexes", width: 100 },
      { title: "约束数", dataIndex: "constraints", width: 100 },
    ];
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {renderMetricGrid([
          { key: "tables", title: objectLabels.objectCountTitle, value: formatNumber(report.overview.totalTables), description: tableScopeLabel(reportConfig.tableScope, reportConfig.selectedTables?.length || 0, reportConfig.maxTables, objectLabels) },
          { key: "rows", title: objectLabels.recordCountTitle, value: formatNumber(report.overview.totalRowCount), description: rowCountModeLabel(reportConfig.rowCountMode) },
          { key: "sample", title: "抽样条数", value: formatNumber(reportConfig.sampleSize), description: objectLabels.sampleSizeDescription },
          { key: "fields", title: "字段总数", value: formatNumber(fieldRows.length), description: `调研${objectLabels.objectName}字段合计` },
        ])}
        {renderSummaryAlert(scaleInsight?.summary || report.overview.summary, "success")}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Section title={objectLabels.largeObjectTitle}>{renderArrayTags(largeTables, "red", 40)}</Section>
          </Col>
          <Col xs={24} lg={8}>
            <Section title={objectLabels.smallObjectTitle}>{renderArrayTags(smallOrEmptyTables, "orange", 40)}</Section>
          </Col>
          <Col xs={24} lg={8}>
            <Section title={objectLabels.complexObjectTitle}>{renderArrayTags(complexTables, "blue", 40)}</Section>
          </Col>
          <Col span={24}>
            <Section title="规模评估建议">{renderTextList(scaleSuggestions)}</Section>
          </Col>
        </Row>
        <Section title="数据规模明细">
          <Table<ResearchTable>
            rowKey="tableName"
            size="small"
            columns={columns}
            dataSource={sortedTables}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 960 }}
          />
        </Section>
      </Space>
    );
  }

  function renderClassificationTab() {
    if (!report) return <Empty description={loadingRunDetail ? "正在加载报告" : "当前批次尚未生成报告"} />;
    const categoryStats = Object.entries(report.overview.categoryStats || {});
    const totalTables = report.tables.length;
    const primaryKeyTableCount = report.tables.filter(hasPrimaryKey).length;
    const tableCommentCount = report.tables.filter((table) => String(table.tableComment || "").trim()).length;
    const missingTableCommentCount = totalTables - tableCommentCount;
    const missingFieldCommentTotal = report.tables.reduce((sum, table) => sum + missingFieldCommentCount(table), 0);
    const timeFieldTableCount = report.tables.filter((table) => timeFields(table).length).length;
    const highNullFieldTotal = report.tables.reduce((sum, table) => sum + highNullFields(table).length, 0);
    const dataTypeStats = topDataTypeStats(fieldRows, 10);
    const explorationSummary = `本次探查 ${formatNumber(totalTables)} ${objectLabels.objectUnit}${objectLabels.objectName}、${formatNumber(fieldRows.length)} 个字段，${objectLabels.recordCountTitle} ${formatNumber(report.overview.totalRowCount)}；识别 ${categoryStats.map(([key, value]) => `${categoryLabel(key)} ${formatNumber(value)}`).join("、") || "暂无分类分布"}。主键覆盖 ${formatCountRatio(primaryKeyTableCount, totalTables)}，${objectLabels.objectCommentTitle}覆盖 ${formatCountRatio(tableCommentCount, totalTables)}，${formatNumber(timeFieldTableCount)} ${objectLabels.objectUnit}${objectLabels.objectName}包含时间类字段。`;
    const columns: ColumnsType<ResearchTable> = [
      { title: objectLabels.objectNameTitle, dataIndex: "tableName", width: 230, fixed: "left" },
      { title: objectLabels.objectCommentTitle, dataIndex: "tableComment", width: 220, render: (value) => value || "-" },
      { title: "分类", dataIndex: "category", width: 120, render: categoryLabel },
      { title: objectLabels.rowCountTitle, dataIndex: "rowCount", width: 120, render: formatNumber },
      { title: "字段数", dataIndex: "columnCount", width: 90 },
      { title: "主键字段", width: 180, render: (_value, record) => renderArrayTags(primaryKeyFields(record), "green", 3) },
      { title: "时间字段", width: 220, render: (_value, record) => renderArrayTags(timeFields(record), "blue", 4) },
      { title: "代码/状态字段", width: 240, render: (_value, record) => renderArrayTags(codeStatusFields(record), "cyan", 4) },
      { title: "缺注释字段", width: 110, render: (_value, record) => missingFieldCommentCount(record) },
      { title: "高空值字段", width: 220, render: (_value, record) => renderArrayTags(highNullFields(record), "orange", 4) },
    ];
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {renderMetricGrid([
          { key: "tables", title: `探查${objectLabels.objectName}数`, value: formatNumber(totalTables), description: tableScopeLabel(reportConfig.tableScope, reportConfig.selectedTables?.length || 0, reportConfig.maxTables, objectLabels) },
          { key: "fields", title: "字段总数", value: formatNumber(fieldRows.length), description: `平均 ${totalTables ? (fieldRows.length / totalTables).toFixed(1) : "0"} 个/${objectLabels.objectName}` },
          { key: "primaryKey", title: "主键覆盖", value: formatCountRatio(primaryKeyTableCount, totalTables), description: `已识别主键的${objectLabels.objectName}` },
          { key: "comments", title: `${objectLabels.objectCommentTitle}覆盖`, value: formatCountRatio(tableCommentCount, totalTables), description: `缺失 ${formatNumber(missingTableCommentCount)} ${objectLabels.objectUnit}` },
        ])}
        {renderSummaryAlert(explorationSummary)}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Section title={objectLabels.objectTypeStatsTitle}>
              {categoryStats.length ? (
                <Space size={[6, 6]} wrap>
                  {categoryStats.map(([key, value]) => <Tag key={key} color="blue">{categoryLabel(key)}：{value}</Tag>)}
                </Space>
              ) : <Typography.Text type="secondary">暂无分类统计</Typography.Text>}
            </Section>
          </Col>
          <Col xs={24} lg={8}>
            <Section title="字段类型分布">
              {dataTypeStats.length ? (
                <Space size={[6, 6]} wrap>
                  {dataTypeStats.map(([key, value]) => <Tag key={key} color="geekblue">{key}：{value}</Tag>)}
                </Space>
              ) : <Typography.Text type="secondary">暂无字段类型统计</Typography.Text>}
            </Section>
          </Col>
          <Col xs={24} lg={8}>
            <Section title="元数据完整性">
              <Space size={[6, 6]} wrap>
                <Tag color="green">有主键：{primaryKeyTableCount}</Tag>
                <Tag color={missingTableCommentCount ? "orange" : "green"}>缺{objectLabels.objectCommentTitle}：{missingTableCommentCount}</Tag>
                <Tag color={missingFieldCommentTotal ? "orange" : "green"}>缺字段注释：{missingFieldCommentTotal}</Tag>
                <Tag color={highNullFieldTotal ? "orange" : "default"}>高空值字段：{highNullFieldTotal}</Tag>
              </Space>
            </Section>
          </Col>
        </Row>
        <Section title={objectLabels.objectDetailTitle}>
          <Table<ResearchTable>
            rowKey="tableName"
            size="small"
            columns={columns}
            dataSource={sortedTables}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 1560 }}
            expandable={{
              expandedRowRender: (record) => (
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="主键字段">{renderArrayTags(primaryKeyFields(record), "green", 8)}</Descriptions.Item>
                  <Descriptions.Item label="时间字段">{renderArrayTags(timeFields(record), "blue", 8)}</Descriptions.Item>
                  <Descriptions.Item label="代码/状态字段">{renderArrayTags(codeStatusFields(record), "cyan", 8)}</Descriptions.Item>
                  <Descriptions.Item label="名称字段">{renderArrayTags(nameFields(record), undefined, 8)}</Descriptions.Item>
                  <Descriptions.Item label="字段类型分布">{renderArrayTags(Object.entries(record.fieldSummary?.dataTypeDistribution || {}).map(([key, value]) => `${key}：${value}`), "geekblue", 10)}</Descriptions.Item>
                  <Descriptions.Item label="元数据问题">{renderIssueList(record.metadataIssues)}</Descriptions.Item>
                </Descriptions>
              ),
            }}
          />
        </Section>
      </Space>
    );
  }

  function renderQualityTab() {
    if (!report) return <Empty description={loadingRunDetail ? "正在加载报告" : "当前批次尚未生成报告"} />;
    const qualityInsight = report.insights?.dataQuality;
    const qualityFieldRows = [...fieldRows]
      .filter((field) => !qualityTableFilter || field.tableName === qualityTableFilter)
      .sort((left, right) => Number(right.nullRate || 0) - Number(left.nullRate || 0));
    const filteredTables = sortedTables.filter((table) => !qualityTableFilter || table.tableName === qualityTableFilter);
    const highNullFields = qualityFieldRows.filter((field) => Number(field.nullRate || 0) >= 0.5);
    const issueFields = qualityFieldRows.filter((field) => field.issueTags?.length);
    const missingTableComments = filteredTables.filter((table) => !String(table.tableComment || "").trim()).length;
    const missingPrimaryKeys = filteredTables.filter((table) => !hasPrimaryKey(table)).length;
    const missingFieldComments = filteredTables.reduce((sum, table) => sum + missingFieldCommentCount(table), 0);
    const qualityFieldFindings = (qualityInsight?.fieldFindings || []).filter((item) => !qualityTableFilter || item.tableName === qualityTableFilter);
    const tableColumns: ColumnsType<ResearchTable> = [
      { title: objectLabels.objectNameTitle, dataIndex: "tableName", width: 240 },
      { title: objectLabels.objectCommentTitle, dataIndex: "tableComment", width: 180, render: (value) => value || <Tag color="orange">缺失</Tag> },
      { title: "主键", width: 90, render: (_value, record) => hasPrimaryKey(record) ? <Tag color="green">已识别</Tag> : <Tag color="orange">缺失</Tag> },
      { title: "字段注释缺失", width: 130, render: (_value, record) => missingFieldCommentCount(record) },
      { title: "样本数", dataIndex: ["quality", "sampleCount"], width: 100, render: (value, record) => value ?? record.sampleCount ?? "-" },
      { title: "高空值字段数", dataIndex: ["quality", "highNullColumns"], width: 130, render: (value) => value ?? 0 },
      {
        title: "高空值字段",
        width: 360,
        render: (_value, record) => {
          const values = Object.entries(record.quality?.nullRates || {})
            .filter(([, rate]) => Number(rate) >= 0.5)
            .map(([column, rate]) => `${column} ${formatPercentage(rate)}`);
          return renderArrayTags(values, "orange", 8);
        },
      },
      { title: "问题类型", width: 420, render: (_value, record) => renderIssueTags(tableMetadataIssueTypes(record), "orange", 6) },
    ];
    const fieldColumns: ColumnsType<ResearchFieldRow> = [
      { title: objectLabels.objectNameTitle, dataIndex: "tableName", width: 220, fixed: "left" },
      { title: "字段名", dataIndex: "columnName", width: 180 },
      { title: "字段注释", dataIndex: "columnComment", width: 220, render: (value) => value || <Tag color="orange">缺失</Tag> },
      { title: "类型", dataIndex: "dataType", width: 130, render: (value, record) => value || record.columnType || "-" },
      { title: "空值率", dataIndex: "nullRate", width: 100, render: formatPercentage, sorter: (a, b) => Number(a.nullRate || 0) - Number(b.nullRate || 0) },
      { title: "去重率", dataIndex: "distinctRatio", width: 100, render: formatPercentage },
      { title: "问题类型", dataIndex: "issueTags", width: 180, render: (value) => renderIssueTags(value, "red", 4) },
      { title: "样例值", dataIndex: "sampleValues", render: (value) => renderArrayTags(value, undefined, 5) },
    ];
    const findingColumns: ColumnsType<{ tableName: string; columnName?: string; issueTypes?: string[]; evidence?: string[]; suggestion?: string }> = [
      { title: objectLabels.objectNameTitle, dataIndex: "tableName", width: 220 },
      { title: "字段", dataIndex: "columnName", width: 180, render: (value) => value || "-" },
      { title: "问题类型", dataIndex: "issueTypes", width: 220, render: (value) => renderIssueTags(value, "red", 6) },
      { title: "证据", dataIndex: "evidence", render: (value) => renderArrayTags(value, "blue", 4) },
      { title: "建议", dataIndex: "suggestion", width: 260, render: (value) => value || "-" },
    ];
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Space style={{ justifyContent: "space-between", width: "100%" }} align="center" wrap>
          <Typography.Text type="secondary">合并展示数据质量和元数据缺失问题，字段级内容支持按{objectLabels.objectName}筛选。</Typography.Text>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={`筛选字段所属${objectLabels.objectName}`}
            style={{ width: 280 }}
            value={qualityTableFilter}
            options={tableFilterOptions}
            onChange={setQualityTableFilter}
          />
        </Space>
        {renderMetricGrid([
          { key: "tables", title: `质量问题${objectLabels.objectName}`, value: formatNumber(qualityInsight?.tableFindings?.length ?? filteredTables.filter((table) => tableMetadataIssueTypes(table).length).length), description: "含元数据和质量问题" },
          { key: "fields", title: "字段画像数", value: formatNumber(qualityFieldRows.length), description: "包含空值率、去重率、样例值" },
          { key: "highNull", title: "高空值字段", value: formatNumber(highNullFields.length), description: "空值率大于等于 50%" },
          { key: "issues", title: "问题字段", value: formatNumber(qualityFieldFindings.length || issueFields.length), description: `缺注释字段 ${missingFieldComments}，缺主键${objectLabels.objectName} ${missingPrimaryKeys}` },
        ])}
        {renderSummaryAlert(qualityInsight?.summary)}
        {qualityInsight?.issueTypeStats?.length ? (
          <Section title="问题类型统计">
            <Space size={[6, 6]} wrap>
              {qualityInsight.issueTypeStats.map((item) => <Tag key={item.issueType} color="red">{issueTypeLabel(item.issueType)}：{item.count}</Tag>)}
              {missingTableComments ? <Tag color="orange">缺{objectLabels.objectCommentTitle}：{missingTableComments}</Tag> : null}
            </Space>
          </Section>
        ) : null}
        <Section title={objectLabels.objectQualityTitle}>
          <Table<ResearchTable>
            rowKey="tableName"
            size="small"
            columns={tableColumns}
            dataSource={filteredTables}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 1680 }}
          />
        </Section>
        <Section title="字段质量明细">
          <Table<ResearchFieldRow>
            rowKey={(record) => `${record.tableName}-${record.columnName}`}
            size="small"
            columns={fieldColumns}
            dataSource={qualityFieldRows}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 1340 }}
          />
        </Section>
        {qualityFieldFindings.length ? (
          <Section title="模型字段级发现">
            <Table
              rowKey={(record) => `${record.tableName}-${record.columnName}-${record.suggestion}`}
              size="small"
              columns={findingColumns}
              dataSource={qualityFieldFindings}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ x: 1100 }}
            />
          </Section>
        ) : null}
        {qualityInsight?.suggestions?.length ? <Section title="质量整改建议">{renderTextList(qualityInsight.suggestions)}</Section> : null}
      </Space>
    );
  }

  function renderIngestionAdviceTab() {
    if (!report) return <Empty description={loadingRunDetail ? "正在加载报告" : "当前批次尚未生成报告"} />;
    const insight = report.insights?.ingestionAdvice;
    const recommendedTables = insight?.recommendedTables || report.recommendations.recommendedTables;
    const deferredTables = insight?.deferredTables || report.recommendations.deferredTables;
    const pStats = Object.entries(priorityStats(report.tables));
    const modeStats = Object.entries(sortedTables.reduce<Record<string, number>>((acc, table) => {
      const key = table.suggestedMode || "unknown";
      acc[key] = Number(acc[key] || 0) + 1;
      return acc;
    }, {}));
    const columns: ColumnsType<ResearchTable> = [
      { title: objectLabels.objectNameTitle, dataIndex: "tableName", width: 240, fixed: "left" },
      { title: "分类", dataIndex: "category", width: 120, render: categoryLabel },
      { title: "优先级", dataIndex: "priority", width: 100, render: priorityLabel },
      { title: "接入模式", dataIndex: "suggestedMode", width: 140, render: (value) => value || "-" },
      { title: "增量字段", dataIndex: "incrementalColumn", width: 160, render: (value) => value || "-" },
      { title: "置信度", dataIndex: "confidence", width: 100, render: formatPercentage },
      { title: "推荐依据", dataIndex: "evidence", width: 420, render: (value) => renderArrayTags(value, "blue", 4) },
      { title: "风险", dataIndex: "risks", width: 320, render: (value) => renderArrayTags(value, "orange", 6) },
    ];
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {renderMetricGrid([
          { key: "recommended", title: "优先接入", value: formatNumber(recommendedTables.length), description: `推荐进入接入任务配置的${objectLabels.objectName}` },
          { key: "deferred", title: "建议暂缓", value: formatNumber(deferredTables.length), description: "需治理后再接入" },
          { key: "modes", title: "模式建议", value: formatNumber(insight?.tableModes?.length || sortedTables.length), description: `${objectLabels.objectName}级同步模式` },
          { key: "ingestion", title: "接入建议", value: formatNumber((insight?.ingestionSuggestions || report.recommendations.ingestionSuggestions).length), description: "同步策略和落库建议" },
        ])}
        {renderSummaryAlert(insight?.summary)}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Section title={objectLabels.recommendedObjectTitle}>
              {renderArrayTags(recommendedTables, "green", 40)}
            </Section>
          </Col>
          <Col xs={24} lg={12}>
            <Section title={objectLabels.deferredObjectTitle}>
              {renderArrayTags(deferredTables, "orange", 40)}
            </Section>
          </Col>
          <Col xs={24} lg={12}>
            <Section title="接入优先级分布">
              {pStats.length ? (
                <Space size={[6, 6]} wrap>
                  {pStats.map(([key, value]) => <Tag key={key} color={key === "high" ? "red" : key === "medium" ? "orange" : "default"}>{priorityLabel(key)}：{value}</Tag>)}
                </Space>
              ) : <Typography.Text type="secondary">暂无优先级统计</Typography.Text>}
            </Section>
          </Col>
          <Col xs={24} lg={12}>
            <Section title="同步模式分布">
              {modeStats.length ? (
                <Space size={[6, 6]} wrap>
                  {modeStats.map(([key, value]) => <Tag key={key} color={key === "incremental" ? "green" : "blue"}>{key}：{value}</Tag>)}
                </Space>
              ) : <Typography.Text type="secondary">暂无同步模式统计</Typography.Text>}
            </Section>
          </Col>
          <Col span={24}>
            <Section title="接入建议">
              {renderTextList(insight?.ingestionSuggestions || report.recommendations.ingestionSuggestions)}
            </Section>
          </Col>
        </Row>
        {insight?.tableModes?.length ? (
          <Section title={objectLabels.objectModeTitle}>
            <Table
              rowKey="tableName"
              size="small"
              dataSource={insight.tableModes}
              columns={[
                { title: objectLabels.objectNameTitle, dataIndex: "tableName", width: 240 },
                { title: "模式", dataIndex: "mode", width: 140, render: (value) => value || "-" },
                { title: "原因", dataIndex: "reason" },
                { title: "风险", dataIndex: "risk", width: 260, render: (value) => value || "-" },
              ]}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ x: 980 }}
            />
          </Section>
        ) : null}
        <Section title="接入策略明细">
          <Table<ResearchTable>
            rowKey="tableName"
            size="small"
            columns={columns}
            dataSource={sortedTables}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 1600 }}
          />
        </Section>
      </Space>
    );
  }

  function renderGovernanceAdviceTab() {
    if (!report) return <Empty description={loadingRunDetail ? "正在加载报告" : "当前批次尚未生成报告"} />;
    const insight = report.insights?.governanceAdvice;
    const tableTasks = insight?.tableTasks || sortedTables
      .filter((table) => tableMetadataIssueTypes(table).length)
      .map((table) => ({ tableName: table.tableName, issueTypes: tableMetadataIssueTypes(table), priority: table.priority, action: "补齐元数据、主键、增量字段和质量规则。" }));
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {renderMetricGrid([
          { key: "tasks", title: `治理${objectLabels.objectName}数`, value: formatNumber(tableTasks.length), description: `存在治理动作的${objectLabels.objectName}` },
          { key: "must", title: "接入前处理", value: formatNumber(insight?.mustFixBeforeIngestion?.length || 0), description: "高优先级治理动作" },
          { key: "continuous", title: "持续优化", value: formatNumber(insight?.continuousImprovements?.length || 0), description: "接入后治理动作" },
          { key: "suggestions", title: "治理建议", value: formatNumber((insight?.governanceSuggestions || report.recommendations.governanceSuggestions).length), description: "可执行建议" },
        ])}
        {renderSummaryAlert(insight?.summary)}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}><Section title="接入前必须处理">{renderTextList(insight?.mustFixBeforeIngestion)}</Section></Col>
          <Col xs={24} lg={12}><Section title="接入后持续优化">{renderTextList(insight?.continuousImprovements)}</Section></Col>
          <Col span={24}><Section title="治理建议">{renderTextList(insight?.governanceSuggestions || report.recommendations.governanceSuggestions)}</Section></Col>
        </Row>
        <Section title={objectLabels.objectGovernanceTitle}>
          <Table
            rowKey="tableName"
            size="small"
            dataSource={tableTasks}
            columns={[
              { title: objectLabels.objectNameTitle, dataIndex: "tableName", width: 240 },
              { title: "问题类型", dataIndex: "issueTypes", width: 280, render: (value) => renderIssueTags(value, "orange", 8) },
              { title: "优先级", dataIndex: "priority", width: 100, render: priorityLabel },
              { title: "治理动作", dataIndex: "action", render: (value) => value || "-" },
            ]}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 980 }}
          />
        </Section>
      </Space>
    );
  }

  function renderAnalysisAdviceTab() {
    if (!report) return <Empty description={loadingRunDetail ? "正在加载报告" : "当前批次尚未生成报告"} />;
    const insight = report.insights?.analysisAdvice;
    const coreBusinessTables: AnalysisCoreBusinessTable[] = insight?.coreBusinessTables?.length
      ? insight.coreBusinessTables
      : sortedTables
        .filter((table) => table.category === "business")
        .slice(0, 6)
        .map((table) => ({
          tableName: table.tableName,
          reason: `${priorityLabel(table.priority)}优先级业务${objectLabels.objectName}，${objectLabels.rowCountTitle} ${formatNumber(table.rowCount)}，字段 ${formatNumber(table.columnCount)} 个。`,
          analysisValue: `可作为业务分析主${objectLabels.objectName}，支撑趋势、分布、状态和明细追踪分析。`,
          suggestedSubjects: ["业务量趋势分析", "状态分布分析", "维度拆分分析", "异常明细追踪"],
          dimensions: [
            ...(table.fieldSummary?.timeFields || []),
            ...(table.fieldSummary?.statusLikeFields || []),
            ...(table.fieldSummary?.typeLikeFields || []),
            ...(table.fieldSummary?.codeLikeFields || []),
          ].slice(0, 10),
        }));
    const themes = insight?.analysisThemes || [];
    const analysisDirections: AnalysisDirection[] = insight?.analysisDirections?.length
      ? insight.analysisDirections
      : coreBusinessTables.map((item) => ({
        direction: `${item.tableName}业务分析`,
        coreTable: item.tableName,
        relatedTables: [],
        measures: ["记录数/业务量", "新增量", "异常量"],
        dimensions: item.dimensions || [],
        sampleEvidence: [],
        analysisQuestions: ["业务量趋势是否稳定？", "不同状态和维度下是否存在异常分布？"],
        outputSuggestions: ["核心指标卡", "趋势图", "分布图", "异常明细表"],
        caveats: ["需要确认统计时间字段、业务主键和指标口径。"],
      }));
    const coreTableNames = coreBusinessTables.map((item) => item.tableName).filter(Boolean);
    const analysisSuggestionList = Array.from(new Set([
      ...(coreTableNames.length ? [`优先围绕 ${coreTableNames.slice(0, 4).join("、")} 建立业务量趋势、状态分布、维度拆分和异常明细追踪分析。`] : []),
      `先确认核心业务${objectLabels.objectName}的统计时间字段、业务主键、状态字段和指标口径，再进入报表建模。`,
      ...((insight?.analysisSuggestions || report.recommendations.analysisSuggestions || []).map((item) => item.trim()).filter(Boolean)),
    ]));
    const coreColumns: ColumnsType<AnalysisCoreBusinessTable> = [
      { title: objectLabels.coreObjectTitle, dataIndex: "tableName", width: 180 },
      { title: "选择依据", dataIndex: "reason", width: 240, render: (value) => value || "-" },
      { title: "可做分析", dataIndex: "suggestedSubjects", width: 260, render: (value) => renderArrayTags(value, "blue", 6) },
      { title: "可用维度/字段", dataIndex: "dimensions", width: 220, render: (value) => renderArrayTags(value, undefined, 8) },
    ];
    const directionColumns: ColumnsType<AnalysisDirection> = [
      { title: "分析方向", dataIndex: "direction", width: 180, fixed: "left" },
      { title: "核心表", dataIndex: "coreTable", width: 180, render: (value) => value || "-" },
      { title: "指标口径", dataIndex: "measures", width: 220, render: (value) => renderArrayTags(value, "green", 6) },
      { title: "分析维度", dataIndex: "dimensions", width: 260, render: (value) => renderArrayTags(value, "blue", 8) },
      { title: "样例证据", dataIndex: "sampleEvidence", width: 320, render: (value) => renderArrayTags(value, undefined, 5) },
      { title: "可回答问题", dataIndex: "analysisQuestions", width: 300, render: (value) => renderIssueList(value, 4) },
      { title: "报表建议", dataIndex: "outputSuggestions", width: 260, render: (value) => renderArrayTags(value, "purple", 5) },
      { title: "口径限制", dataIndex: "caveats", width: 260, render: (value) => renderIssueList(value, 4) },
    ];
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {renderMetricGrid([
          { key: "core", title: objectLabels.coreObjectTitle, value: formatNumber(coreBusinessTables.length), description: `分析主${objectLabels.objectName}候选` },
          { key: "directions", title: "分析方向", value: formatNumber(analysisDirections.length), description: "结合样例证据" },
          { key: "watch", title: "关注项", value: formatNumber(insight?.watchItems?.length || 0), description: "需持续观察" },
          { key: "suggestions", title: "分析建议", value: formatNumber(analysisSuggestionList.length), description: "后续分析动作" },
        ])}
        {renderSummaryAlert(insight?.summary)}
        <Section title={`${objectLabels.coreObjectTitle}分析建议`}>
          <Table<AnalysisCoreBusinessTable>
            rowKey="tableName"
            size="small"
            dataSource={coreBusinessTables}
            columns={coreColumns}
            pagination={{ pageSize: 5, showSizeChanger: false, hideOnSinglePage: true }}
            scroll={{ x: 900 }}
            locale={{ emptyText: `暂无${objectLabels.coreObjectTitle}分析建议` }}
          />
        </Section>
        <Section title="深度分析方向">
          <Table<AnalysisDirection>
            rowKey={(record) => `${record.coreTable || ""}-${record.direction}`}
            size="small"
            dataSource={analysisDirections}
            columns={directionColumns}
            pagination={{ pageSize: 4, showSizeChanger: false, hideOnSinglePage: true }}
            scroll={{ x: 1980 }}
            locale={{ emptyText: "暂无深度分析方向" }}
          />
        </Section>
        <Section title="业务分析主题">
          <Table
            rowKey={(record) => record.theme}
            size="small"
            dataSource={themes}
            columns={[
              { title: "主题", dataIndex: "theme", width: 180 },
              { title: `相关${objectLabels.objectName}`, dataIndex: "tables", width: 220, render: (value) => renderArrayTags(value, "blue", 6) },
              { title: "关键字段", dataIndex: "keyFields", width: 220, render: (value) => renderArrayTags(value, undefined, 6) },
              { title: "分析价值", dataIndex: "value", width: 260, render: (value) => value || "-" },
              { title: "限制", dataIndex: "limitations", width: 160, render: (value) => renderArrayTags(value, "orange", 4) },
            ]}
            pagination={{ pageSize: 5, showSizeChanger: false, hideOnSinglePage: true }}
            scroll={{ x: 1040 }}
            locale={{ emptyText: "暂无分析主题建议" }}
          />
        </Section>
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={8}><Section title="分析建议">{renderTextList(analysisSuggestionList, 4)}</Section></Col>
          <Col xs={24} xl={8}><Section title="持续关注项">{renderTextList(insight?.watchItems, 4)}</Section></Col>
          <Col xs={24} xl={8}><Section title="待业务确认">{renderTextList(insight?.followUpQuestions, 4)}</Section></Col>
        </Row>
      </Space>
    );
  }

  function renderRelationshipTab() {
    if (!report) return <Empty description={loadingRunDetail ? "正在加载报告" : "当前批次尚未生成报告"} />;
    const relationship = report.tableRelationships;
    if (!relationship) return <Empty description={`当前批次未生成${objectLabels.relationshipTitle}调研结果`} />;
    const filteredRelations = relationship.relations.filter((relation) => !relationshipTableFilter || relation.fromTable === relationshipTableFilter || relation.toTable === relationshipTableFilter);
    const filteredEntities = relationship.entities.filter((entity) => !relationshipTableFilter || entity.tableName === relationshipTableFilter);
    const relationColumns: ColumnsType<RelationshipRelation> = [
      { title: `来源${objectLabels.objectName}`, dataIndex: "fromTable", width: 200 },
      { title: "来源字段", dataIndex: "fromField", width: 160 },
      { title: `目标${objectLabels.objectName}`, dataIndex: "toTable", width: 200 },
      { title: "目标字段", dataIndex: "toField", width: 160 },
      { title: "关系", dataIndex: "relationType", width: 100 },
      { title: "来源", dataIndex: "source", width: 110, render: relationSourceLabel },
      { title: "置信度", dataIndex: "confidence", width: 100, render: formatPercentage },
      { title: "证据", dataIndex: "evidence", render: (value) => renderArrayTags(value, "blue", 4) },
    ];
    const entityColumns: ColumnsType<RelationshipEntity> = [
      { title: objectLabels.objectNameTitle, dataIndex: "tableName", width: 240 },
      { title: objectLabels.objectCommentTitle, dataIndex: "tableComment", width: 220, render: (value) => value || "-" },
      { title: "分类", dataIndex: "category", width: 120, render: categoryLabel },
      { title: "优先级", dataIndex: "priority", width: 100, render: priorityLabel },
      { title: objectLabels.rowCountTitle, dataIndex: "rowCount", width: 120, render: formatNumber },
      { title: "字段数", dataIndex: "fields", width: 100, render: (value) => value?.length || 0 },
    ];
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Space style={{ justifyContent: "space-between", width: "100%" }} align="center" wrap>
          <Typography.Text type="secondary">{objectLabels.relationshipDescription}</Typography.Text>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={`筛选关系${objectLabels.objectName}`}
            style={{ width: 280 }}
            value={relationshipTableFilter}
            options={relationship.entities.map((item) => ({ value: item.tableName, label: item.tableName }))}
            onChange={setRelationshipTableFilter}
          />
        </Space>
        {renderMetricGrid([
          { key: "entities", title: `关系${objectLabels.objectName}数`, value: formatNumber(filteredEntities.length), description: `参与关系识别的${objectLabels.objectName}` },
          { key: "relations", title: "关系数量", value: formatNumber(filteredRelations.length), description: "字段级关联关系" },
          { key: "constraint", title: "显式约束", value: formatNumber(filteredRelations.filter((item) => item.source === "constraint").length), description: "来自数据库约束" },
          { key: "ai", title: "模型判断", value: formatNumber(filteredRelations.filter((item) => item.source === "ai").length), description: "来自大模型分析" },
        ])}
        {renderSummaryAlert(relationship.summary)}
        <Section title={`${objectLabels.relationshipTitle} ER 图`}>
          <ResearchRelationshipErGraph value={relationship} height={620} />
        </Section>
        <Section title={`${objectLabels.relationshipTitle}明细`}>
          <Table<RelationshipRelation>
            rowKey={(record) => `${record.fromTable}-${record.fromField}-${record.toTable}-${record.toField}-${record.relationType}`}
            size="small"
            columns={relationColumns}
            dataSource={filteredRelations}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 1240 }}
          />
        </Section>
        <Section title={objectLabels.entityTitle}>
          <Table<RelationshipEntity>
            rowKey="tableName"
            size="small"
            columns={entityColumns}
            dataSource={filteredEntities}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 900 }}
            expandable={{
              expandedRowRender: (record) => (
                <Table
                  rowKey="columnName"
                  size="small"
                  pagination={{ pageSize: 8, showSizeChanger: false, hideOnSinglePage: true }}
                  dataSource={record.fields || []}
                  columns={[
                    { title: "字段名", dataIndex: "columnName", width: 220 },
                    { title: "类型", dataIndex: "dataType", width: 140, render: (value) => value || "-" },
                    { title: "主键", dataIndex: "isPrimaryKey", width: 90, render: (value) => value ? "是" : "否" },
                    { title: "字段注释", dataIndex: "columnComment", render: (value) => value || "-" },
                  ]}
                />
              ),
            }}
          />
        </Section>
      </Space>
    );
  }

  function renderComparisonTab() {
    const diff = selectedComparison?.diff;
    const ai = selectedComparison?.aiSummary;
    const moduleChanges = [
      { key: "classification", title: `${objectLabels.objectName}分类变化`, values: ai?.tableClassificationChanges || ai?.schemaChanges },
      { key: "relationship", title: `${objectLabels.relationshipTitle}变化`, values: ai?.tableRelationshipChanges || ai?.relationshipChanges },
      { key: "scale", title: "数据规模变化", values: ai?.dataScaleChanges },
      { key: "quality", title: "数据质量变化", values: ai?.dataQualityChanges || ai?.qualityChanges },
      { key: "ingestion", title: "接入建议变化", values: ai?.ingestionAdviceChanges },
      { key: "governance", title: "治理建议变化", values: ai?.governanceAdviceChanges },
      { key: "analysis", title: "分析建议变化", values: ai?.analysisAdviceChanges },
    ];
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Section title="生成报告结果对比" extra={<Typography.Text type="secondary">同一任务下至少需要两个成功报告批次</Typography.Text>}>
          <Space wrap>
            <Select placeholder="基准报告批次" style={{ width: 280 }} value={baseRunId} options={runOptions} onChange={setBaseRunId} />
            <Select placeholder="对比报告批次" style={{ width: 280 }} value={targetRunId} options={runOptions} onChange={setTargetRunId} />
            <Button type="primary" loading={comparing} disabled={successfulRuns.length < 2} onClick={() => void handleCompareReports()}>生成对比</Button>
          </Space>
        </Section>
        <Table<DataSourceResearchReportComparisonRecord>
          rowKey="id"
          size="small"
          dataSource={comparisons}
          pagination={{ pageSize: 5, showSizeChanger: false }}
          columns={[
            { title: "基准批次", dataIndex: "baseRunId", width: 120 },
            { title: "对比批次", dataIndex: "targetRunId", width: 120 },
            { title: "状态", dataIndex: "status", width: 100, render: renderStatusTag },
            { title: "摘要", dataIndex: "summaryText", ellipsis: true, render: (value) => value || "-" },
            { title: "创建时间", dataIndex: "createdAt", width: 180, render: formatDateTime },
            { title: "操作", width: 90, render: (_value, record) => <Button type="link" onClick={() => setSelectedComparison(record)}>查看</Button> },
          ]}
          locale={{ emptyText: "暂无报告对比记录" }}
        />
        {selectedComparison ? (
          <Section title="对比结论">
            <Space direction="vertical" size={14} style={{ width: "100%" }}>
              {selectedComparison.errorMessage ? <Alert type="error" showIcon message={selectedComparison.errorMessage} /> : null}
              {renderSummaryAlert(ai?.summary || selectedComparison.summaryText || diff?.summaryText || "暂无摘要")}
              <Descriptions bordered size="small" column={4}>
                <Descriptions.Item label={`${objectLabels.objectName}数量变化`}>{diff?.overview?.tableDelta ?? "-"}</Descriptions.Item>
                <Descriptions.Item label={`${objectLabels.rowCountTitle}变化`}>{diff?.overview?.rowCountDelta ?? "-"}</Descriptions.Item>
                <Descriptions.Item label={`新增${objectLabels.objectName}`}>{diff?.tables?.added?.length ?? 0}</Descriptions.Item>
                <Descriptions.Item label={`移除${objectLabels.objectName}`}>{diff?.tables?.removed?.length ?? 0}</Descriptions.Item>
                <Descriptions.Item label={`变化${objectLabels.objectName}`}>{diff?.tables?.changed?.length ?? 0}</Descriptions.Item>
                <Descriptions.Item label="新增关系">{diff?.relationships?.added?.length ?? 0}</Descriptions.Item>
                <Descriptions.Item label="移除关系">{diff?.relationships?.removed?.length ?? 0}</Descriptions.Item>
                <Descriptions.Item label="置信度">{ai?.confidence ? `${Math.round(ai.confidence * 100)}%` : "-"}</Descriptions.Item>
              </Descriptions>
              <Row gutter={[16, 16]}>
                {moduleChanges.map((item) => (
                  <Col xs={24} lg={item.key === "analysis" ? 24 : 12} key={item.key}>
                    <Section title={item.title}>{renderTextList(item.values)}</Section>
                  </Col>
                ))}
              </Row>
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}><Section title="风险识别">{renderTextList(ai?.risks)}</Section></Col>
                <Col xs={24} lg={12}><Section title="处理建议">{renderTextList(ai?.suggestions)}</Section></Col>
              </Row>
            </Space>
          </Section>
        ) : (
          <Empty description="请选择或生成一条报告对比记录" />
        )}
      </Space>
    );
  }

  function renderResearchTab(key: ResearchItemKey) {
    switch (key) {
      case "table_classification":
        return renderClassificationTab();
      case "table_relationship":
        return renderRelationshipTab();
      case "data_scale":
        return renderScaleTab();
      case "quality_inspection":
        return renderQualityTab();
      case "ingestion_advice":
        return renderIngestionAdviceTab();
      case "governance_advice":
        return renderGovernanceAdviceTab();
      case "analysis_advice":
        return renderAnalysisAdviceTab();
      default:
        return <Empty description="暂无调研结果" />;
    }
  }

  const tabItems = [
    ...selectedResearchItems.map((item) => ({
      key: item,
      label: RESEARCH_ITEM_LABELS[item],
      children: renderResearchTab(item),
    })),
    {
      key: "comparison",
      label: "报告结果对比",
      children: renderComparisonTab(),
    },
  ];

  const canDeleteActiveRun = activeRun && !["pending", "running"].includes(String(activeRun.status || ""));

  return (
    <div className="app-page">
      <Space direction="vertical" size={12} style={{ display: "flex" }}>
        <Space style={{ justifyContent: "space-between", width: "100%" }} align="center" wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dashboard/data-source-research")}>返回调研清单</Button>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void loadPage({ selectRunId: activeRun?.id })} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlayCircleOutlined />} disabled={!task || task.status === "disabled"} loading={runningTask} onClick={() => void handleRunTask()}>执行任务</Button>
            <Button icon={<DownloadOutlined />} disabled={!report} onClick={() => handleDownloadReport("md")}>Markdown</Button>
            <Button icon={<DownloadOutlined />} disabled={!report} onClick={() => handleDownloadReport("json")}>JSON</Button>
            {activeRun ? (
              <Button icon={<DownloadOutlined />} loading={downloadingRunId === activeRun.id} disabled={activeRun.status !== "succeeded"} onClick={() => void handleDownloadWord(activeRun)}>Word</Button>
            ) : null}
            {activeRun ? (
              <Popconfirm title="确认删除当前调研批次？" onConfirm={() => void handleDeleteRun(activeRun.id)} okButtonProps={{ danger: true }}>
                <Button danger icon={<DeleteOutlined />} disabled={!canDeleteActiveRun}>删除批次</Button>
              </Popconfirm>
            ) : null}
          </Space>
        </Space>

        {task ? (
          <>
            <Row gutter={[12, 12]} align="stretch">
              <Col xs={24} xl={10}>
                <Card
                  title="调研概览"
                  loading={loading}
                  variant="borderless"
                  size="small"
                  styles={topCompactCardStyles}
                  extra={(
                    <Space size={8}>
                      {renderStatusTag(task.status)}
                      <Button size="small" icon={<EditOutlined />} onClick={openEditTask}>编辑任务</Button>
                    </Space>
                  )}
                  style={{ height: "100%" }}
                >
                  <Space direction="vertical" size={6} style={{ display: "flex" }}>
                    <Space direction="vertical" size={4} style={{ display: "flex" }}>
                      <Space style={{ justifyContent: "space-between", width: "100%" }} align="start" wrap>
                        <Space direction="vertical" size={1}>
                          <Typography.Title level={4} style={{ margin: 0, fontSize: 19 }}>{task.taskName}</Typography.Title>
                          <Typography.Text type="secondary">
                            {task.sourceName} / {task.sourceType}{task.databaseName ? ` / ${task.databaseName}` : ""}
                          </Typography.Text>
                        </Space>
                        <Typography.Text type="secondary">最近运行：{formatDateTime(task.lastRunAt)}</Typography.Text>
                      </Space>
                      <Space size={[6, 4]} wrap>
                        <Tag color="blue">{tableScopeLabel(task.tableScope, task.selectedTables?.length || 0, taskConfig.maxTables, objectLabels)}</Tag>
                        <Tag>{rowCountModeLabel(taskConfig.rowCountMode)}</Tag>
                        {selectedResearchItems.map((item) => <Tag key={item}>{RESEARCH_ITEM_LABELS[item]}</Tag>)}
                      </Space>
                    </Space>
                    {report ? (
                      <>
                        {renderTopOverviewMetricGrid([
                          { key: "tables", title: objectLabels.objectCountTitle, value: formatNumber(report.overview.totalTables), description: "当前批次" },
                          { key: "rows", title: objectLabels.recordCountTitle, value: formatNumber(report.overview.totalRowCount), description: rowCountModeLabel(reportConfig.rowCountMode) },
                          { key: "recommended", title: "优先接入", value: formatNumber(report.recommendations.recommendedTables.length), description: `推荐接入${objectLabels.objectName}` },
                          { key: "relationships", title: objectLabels.relationshipTitle, value: formatNumber(report.tableRelationships?.relations.length || 0), description: "字段级关系" },
                        ])}
                        {report.overview.summary ? (
                          <Typography.Paragraph
                            type="secondary"
                            ellipsis={{ rows: 1, expandable: true, symbol: "展开" }}
                            style={{ marginBottom: 0 }}
                          >
                            {report.overview.summary}
                          </Typography.Paragraph>
                        ) : null}
                      </>
                    ) : (
                      <Alert type="info" showIcon message="当前选中批次尚未生成调研报告，批次完成后会自动展示各调研方向结果。" />
                    )}
                  </Space>
                </Card>
              </Col>
              <Col xs={24} xl={14}>
                {renderBatchSection()}
              </Col>
            </Row>

            <Card title="调研结果明细" loading={loadingRunDetail} variant="borderless" size="small" styles={compactCardStyles}>
              <Tabs items={tabItems} />
            </Card>
          </>
        ) : (
          <Card loading={loading} variant="borderless">
            <Empty description="调研任务不存在或正在加载" />
          </Card>
        )}
      </Space>

      <Modal
        open={taskModalOpen}
        title="编辑调研任务"
        onCancel={() => setTaskModalOpen(false)}
        onOk={() => void handleSubmitTask()}
        confirmLoading={taskSubmitting}
        width={1100}
      >
        <Form form={taskForm} layout="vertical">
          <Row gutter={16} style={{ marginLeft: 0, marginRight: 0 }}>
            <Col xs={24} md={8}>
              <Form.Item name="taskName" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
                <Input placeholder="例如：核心业务库数据调研" />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item name="sourceId" label="数据源" rules={[{ required: true, message: "请选择数据源" }]}>
                <Select showSearch optionFilterProp="label" options={supportedSources.map((item) => ({ value: item.id, label: `${item.sourceName} / ${item.sourceType}` }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="status" label="任务状态">
                <Select options={[{ value: "active", label: "启用" }, { value: "disabled", label: "停用" }]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16} style={{ marginLeft: 0, marginRight: 0 }}>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Form.Item name="tableScope" label={`${objectLabels.objectName}范围`}>
                <Select options={[{ label: `${objectLabels.allScopePrefix}前 N ${objectLabels.objectUnit}${objectLabels.objectName}`, value: "all" }, { label: `手工勾选${objectLabels.objectName}`, value: "manual" }]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Form.Item name="sampleSize" label={objectLabels.sampleSizeTitle}>
                <Select options={[20, 50, 100, 200].map((value) => ({ label: `${value} 条`, value }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Form.Item name="maxTables" label={`最大探查${objectLabels.objectName}数`}>
                <InputNumber min={1} max={500} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Form.Item name="rowCountMode" label="行数统计策略">
                <Select options={[{ label: "估算优先", value: "estimated" }, { label: "精确统计", value: "exact" }]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Form.Item name="metadataConcurrency" label="元数据并发度">
                <InputNumber min={1} max={8} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Form.Item name="aiBatchSize" label={`AI批次${objectLabels.objectName}数`}>
                <InputNumber min={5} max={30} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="researchItems" label="调研方向" rules={[{ required: true, message: "请选择调研方向" }]}>
            <Checkbox.Group options={RESEARCH_ITEM_OPTIONS} />
          </Form.Item>
          <Form.Item name="description" label="任务说明">
            <Input.TextArea rows={2} placeholder="描述本任务关注的数据域、业务背景或长期观察目标" />
          </Form.Item>
          <Form.Item name="notes" label="模型补充说明">
            <Input.TextArea rows={2} placeholder="可选，补充业务背景、优先关注主题域或特殊约束" />
          </Form.Item>
          {tableScope === "manual" ? (
            <Form.Item name="selectedTables" label={`指定${objectLabels.objectName}范围${selectedTables.length ? `（已选 ${selectedTables.length} ${objectLabels.objectUnit}）` : ""}`} rules={[{ required: true, message: `请至少选择一个${objectLabels.objectName}` }]}>
              <Transfer
                dataSource={tableTransferData}
                titles={[`可选${objectLabels.objectName}`, `已选${objectLabels.objectName}`]}
                targetKeys={selectedTables}
                onChange={(nextTargetKeys) => taskForm.setFieldValue("selectedTables", nextTargetKeys)}
                render={(item) => (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>{item.title}</Typography.Text>
                    {item.description ? <Typography.Text type="secondary">{item.description}</Typography.Text> : null}
                  </Space>
                )}
                listStyle={{ width: "calc((100% - 56px) / 2)", height: 360 }}
                showSearch
                oneWay
                filterOption={(inputValue, item) => `${item.title || ""} ${item.description || ""}`.toLowerCase().includes(inputValue.toLowerCase())}
                disabled={loadingTables}
              />
            </Form.Item>
          ) : (
            <Alert
              type="success"
              showIcon
              message={`${objectLabels.allScopePrefix}模式会按当前${objectLabels.objectName}清单顺序截取前 N ${objectLabels.objectUnit}${objectLabels.objectName}进行调研`}
              description={`当前可用${objectLabels.objectName}数 ${sourceTables.length} ${objectLabels.objectUnit}，实际执行时按“最大探查${objectLabels.objectName}数”限制。`}
            />
          )}
        </Form>
      </Modal>
    </div>
  );
}
