import {
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  MoreOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { formatQualityBatchId } from "../../utils/qualityBatch";
import {
  createQualityInsightReport,
  deleteQualityReport,
  downloadQualityReportMarkdown,
  downloadQualityReportWord,
  fetchQualityInsightBusinessSystems,
  fetchQualityReportCenterOverview,
  fetchQualityReportComparisonOptions,
  fetchQualityReportDetail,
  fetchQualityReports,
  fetchQualityTableBatches,
  fetchQualityTableInsights,
  previewQualityReportComparison,
} from "../../services/qualityControl";

type ReportScope = "table" | "system" | "comparison";
type ReportMode = "snapshot" | "comparison";
type ComparisonType = "batch" | "table_report" | "system_report";

const scopeLabels: Record<ReportScope, string> = {
  table: "表级报告",
  system: "系统级报告",
  comparison: "批次差异分析",
};

const comparisonTypeLabels: Record<ComparisonType, string> = {
  batch: "表运行批次差异",
  table_report: "表级报告差异",
  system_report: "系统级报告差异",
};

function reportTypeLabel(report: any) {
  return report?.reportScope === "comparison" ? comparisonTypeLabels[(report.comparisonType || "batch") as ComparisonType] : scopeLabels[report?.reportScope as ReportScope] || "质量报告";
}

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
}

function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function scoreColor(score?: number | null) {
  if (score === null || score === undefined) return "#94a3b8";
  if (score >= 90) return "#2f9e44";
  if (score >= 80) return "#1677ff";
  if (score >= 70) return "#fa8c16";
  return "#cf1322";
}

function renderScore(score?: number | null) {
  if (score === null || score === undefined) return <Tag>待评估</Tag>;
  return <span className="quality-report-score" style={{ color: scoreColor(score), background: `${scoreColor(score)}12` }}>{Number(score).toFixed(1)}<small>分</small></span>;
}

export function QualityControlReportsPage() {
  const { message } = App.useApp();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>({});
  const [systems, setSystems] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [comparisonOptions, setComparisonOptions] = useState<any[]>([]);
  const [activeMode, setActiveMode] = useState<ReportMode>("snapshot");
  const [activeSnapshotScope, setActiveSnapshotScope] = useState<"table" | "system">("table");
  const [activeComparisonType, setActiveComparisonType] = useState<ComparisonType>("batch");
  const [keyword, setKeyword] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [deletingReportId, setDeletingReportId] = useState<number>();
  const [comparisonPreview, setComparisonPreview] = useState<any>(null);
  const [comparisonPreviewLoading, setComparisonPreviewLoading] = useState(false);
  const [form] = Form.useForm();
  const scope = Form.useWatch("reportScope", form) as ReportScope;
  const scopeRefId = Form.useWatch("scopeRefId", form);
  const comparisonType = (Form.useWatch("comparisonType", form) || "batch") as ComparisonType;
  const comparisonObjectKey = Form.useWatch("comparisonObjectKey", form);
  useEffect(() => {
    if (!token || scope === "system" || !scopeRefId || (scope === "comparison" && comparisonType !== "batch")) {
      setBatches([]);
      return;
    }
    void fetchQualityTableBatches(token, Number(scopeRefId)).then((response) => {
      const rows = response.data || [];
      setBatches(rows);
      if (scope === "table" && rows[0]) form.setFieldValue("resultBatchId", rows[0].id);
      if (scope === "comparison" && comparisonType === "batch" && rows.length >= 2) {
        form.setFieldsValue({ currentResultBatchId: rows[0].id, previousResultBatchId: rows[1].id });
      }
    }).catch(() => setBatches([]));
  }, [token, scope, scopeRefId, comparisonType, form]);

  const selectableSourceReports = useMemo(() => {
    if (scope !== "comparison" || comparisonType === "batch") return [];
    if (comparisonType === "table_report") return comparisonOptions.filter((item) => item.reportScope === "table" && Number(item.scopeRefId) === Number(scopeRefId));
    if (!comparisonObjectKey) return [];
    if (comparisonObjectKey === "project") return comparisonOptions.filter((item) => item.reportScope === "system" && !item.scopeRefId);
    const systemId = Number(String(comparisonObjectKey).replace("system:", ""));
    return comparisonOptions.filter((item) => item.reportScope === "system" && Number(item.scopeRefId) === systemId);
  }, [scope, comparisonType, comparisonOptions, scopeRefId, comparisonObjectKey]);

  useEffect(() => {
    if (scope !== "comparison" || comparisonType === "batch") return;
    setComparisonPreview(null);
    if (selectableSourceReports.length >= 2) form.setFieldsValue({ currentReportId: selectableSourceReports[0].id, baselineReportId: selectableSourceReports[1].id });
    else form.setFieldsValue({ currentReportId: undefined, baselineReportId: undefined });
  }, [scope, comparisonType, selectableSourceReports, form]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [reportResponse, overviewResponse, systemResponse, tableResponse, comparisonOptionResponse] = await Promise.all([
        fetchQualityReports(token),
        fetchQualityReportCenterOverview(token),
        fetchQualityInsightBusinessSystems(token),
        fetchQualityTableInsights(token),
        fetchQualityReportComparisonOptions(token),
      ]);
      setReports(reportResponse.data || []);
      setOverview(overviewResponse.data || {});
      setSystems(systemResponse.data || []);
      setTables(tableResponse.data || []);
      setComparisonOptions(comparisonOptionResponse.data || []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载报告中心失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  function openCreate() {
    form.resetFields();
    form.setFieldsValue({
      reportScope: activeMode === "comparison" ? "comparison" : activeSnapshotScope,
      comparisonType: activeComparisonType,
      scopeRefId: undefined,
      comparisonObjectKey: undefined,
      reportTitle: "",
      useAi: true,
    });
    setBatches([]);
    setComparisonPreview(null);
    setCreateOpen(true);
  }

  async function checkComparison() {
    if (!token) return;
    const values = await form.validateFields(["comparisonType", "scopeRefId", "comparisonObjectKey", "currentResultBatchId", "previousResultBatchId", "currentReportId", "baselineReportId"]);
    if (values.currentResultBatchId && values.currentResultBatchId === values.previousResultBatchId) {
      message.warning("当前批次和基准批次不能相同");
      return;
    }
    if (values.currentReportId && values.currentReportId === values.baselineReportId) {
      message.warning("当前报告和基准报告不能相同");
      return;
    }
    setComparisonPreviewLoading(true);
    try {
      const response = await previewQualityReportComparison(token, values);
      setComparisonPreview(response.data);
    } catch (error) {
      setComparisonPreview(null);
      message.error(error instanceof Error ? error.message : "可比性检查失败");
    } finally {
      setComparisonPreviewLoading(false);
    }
  }

  async function submit() {
    if (!token) return;
    const values = await form.validateFields();
    if (values.reportScope === "comparison" && values.comparisonType === "batch" && values.currentResultBatchId === values.previousResultBatchId) {
      message.warning("当前批次和对比批次不能相同");
      return;
    }
    if (values.reportScope === "comparison" && values.currentReportId && values.currentReportId === values.baselineReportId) {
      message.warning("当前报告和基准报告不能相同");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createQualityInsightReport(token, values);
      message.success(result.data.aiUsed ? "正式质量报告及AI分析已生成" : "正式质量报告已生成");
      setCreateOpen(false);
      if (values.reportScope === "comparison") {
        setActiveMode("comparison");
        setActiveComparisonType(values.comparisonType || "batch");
      } else {
        setActiveMode("snapshot");
        setActiveSnapshotScope(values.reportScope);
      }
      await load();
      await openPreview(result.data.id);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "生成报告失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function openPreview(id: number) {
    if (!token) return;
    setPreviewLoading(true);
    try {
      setPreview((await fetchQualityReportDetail(token, id)).data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载报告失败");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDownload(report: any, format: "md" | "docx") {
    if (!token) return;
    const key = `${report.id}-${format}`;
    setDownloading(key);
    try {
      if (format === "md") await downloadQualityReportMarkdown(token, report.id, `${report.reportTitle}.md`);
      else await downloadQualityReportWord(token, report.id, `${report.reportTitle}.docx`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "下载报告失败");
    } finally {
      setDownloading("");
    }
  }

  async function handleDelete(report: any) {
    if (!token) return;
    setDeletingReportId(Number(report.id));
    try {
      await deleteQualityReport(token, Number(report.id));
      if (preview?.id === report.id) setPreview(null);
      await load();
      message.success("质量报告已删除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除质量报告失败");
    } finally {
      setDeletingReportId(undefined);
    }
  }

  const filteredReports = useMemo(() => reports.filter((report) => {
    if (activeMode === "snapshot" && report.reportScope !== activeSnapshotScope) return false;
    if (activeMode === "comparison" && (report.reportScope !== "comparison" || (report.comparisonType || "batch") !== activeComparisonType)) return false;
    const text = `${report.reportTitle || ""} ${report.objectName || ""} ${report.systemName || ""} ${report.batchLabel || ""} ${formatQualityBatchId(report.batchLabel)}`.toLowerCase();
    if (keyword.trim() && !text.includes(keyword.trim().toLowerCase())) return false;
    if (gradeFilter === "excellent" && !(report.score >= 90)) return false;
    if (gradeFilter === "good" && !(report.score >= 80 && report.score < 90)) return false;
    if (gradeFilter === "attention" && !(report.score >= 70 && report.score < 80)) return false;
    if (gradeFilter === "risk" && !(report.score < 70)) return false;
    return true;
  }), [reports, activeMode, activeSnapshotScope, activeComparisonType, keyword, gradeFilter]);

  const actionColumn = {
    title: "操作",
    key: "action",
    fixed: "right" as const,
    width: 216,
    render: (_value: unknown, row: any) => (
      <Space size={2}>
        <Button type="link" onClick={() => void openPreview(row.id)}>预览</Button>
        <Popconfirm
          title="删除质量报告"
          description="删除后不可恢复，请确认。"
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true, loading: deletingReportId === row.id }}
          onConfirm={() => void handleDelete(row)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} aria-label={`删除${row.reportTitle}`} />
        </Popconfirm>
        <Dropdown menu={{ items: [
          { key: "md", label: "导出 Markdown", icon: <FileTextOutlined /> },
          { key: "docx", label: "导出 Word", icon: <DownloadOutlined /> },
        ], onClick: ({ key }) => void handleDownload(row, key as "md" | "docx") }}>
          <Button type="text" icon={<MoreOutlined />} loading={downloading.startsWith(`${row.id}-`)} />
        </Dropdown>
      </Space>
    ),
  };

  const tableColumns: ColumnsType<any> = [
    { title: "报告名称", dataIndex: "reportTitle", width: 260, fixed: "left", ellipsis: true, render: (value, row) => <Button type="link" className="quality-report-title-link" onClick={() => void openPreview(row.id)}>{value}</Button> },
    { title: "所属系统 / 数据表", width: 240, render: (_value, row) => <div className="quality-report-object"><strong>{row.objectName}</strong><span>{row.systemName}</span></div> },
    { title: "运行批次", dataIndex: "batchLabel", width: 260, ellipsis: true, render: (value) => formatQualityBatchId(value) },
    { title: "质量得分", dataIndex: "score", width: 108, render: renderScore },
    { title: "维度覆盖", dataIndex: "coverageRate", width: 130, render: (value) => <div className="quality-report-coverage"><Progress percent={Number(value || 0)} size="small" showInfo={false} /><span>{Number(value || 0).toFixed(1)}%</span></div> },
    { title: "问题行", dataIndex: "issueRows", width: 100, render: formatNumber },
    { title: "待整改", dataIndex: "openIssueCount", width: 90, render: (value) => value ? <Tag color="orange">{value} 个</Tag> : <Tag color="green">已清零</Tag> },
    { title: "AI分析", dataIndex: "aiStatus", width: 100, render: (value) => value === "success" ? <Tag color="purple">已生成</Tag> : value === "unavailable" ? <Tag color="orange">已降级</Tag> : <Tag>未启用</Tag> },
    { title: "生成时间", dataIndex: "createdAt", width: 175, render: formatTime },
    actionColumn,
  ];

  const systemColumns: ColumnsType<any> = [
    { title: "报告名称", dataIndex: "reportTitle", width: 260, fixed: "left", ellipsis: true, render: (value, row) => <Button type="link" className="quality-report-title-link" onClick={() => void openPreview(row.id)}>{value}</Button> },
    { title: "统计系统", dataIndex: "systemName", width: 200, render: (value) => <div className="quality-report-object"><strong>{value}</strong><span>系统级质量快照</span></div> },
    { title: "覆盖数据表", dataIndex: "coveredTableCount", width: 110, render: (value) => `${formatNumber(value)} 张` },
    { title: "质量得分", dataIndex: "score", width: 108, render: renderScore },
    { title: "维度覆盖", dataIndex: "coverageRate", width: 130, render: (value) => <div className="quality-report-coverage"><Progress percent={Number(value || 0)} size="small" showInfo={false} /><span>{Number(value || 0).toFixed(1)}%</span></div> },
    { title: "高风险表", dataIndex: "highRiskTableCount", width: 100, render: (value) => value ? <Tag color="red">{value} 张</Tag> : <Tag color="green">0 张</Tag> },
    { title: "问题行", dataIndex: "issueRows", width: 105, render: formatNumber },
    { title: "待整改", dataIndex: "openIssueCount", width: 90, render: (value) => value ? <Tag color="orange">{value} 个</Tag> : <Tag color="green">已清零</Tag> },
    { title: "生成时间", dataIndex: "createdAt", width: 175, render: formatTime },
    actionColumn,
  ];

  const comparisonColumns: ColumnsType<any> = [
    { title: "报告名称", dataIndex: "reportTitle", width: 260, fixed: "left", ellipsis: true, render: (value, row) => <Button type="link" className="quality-report-title-link" onClick={() => void openPreview(row.id)}>{value}</Button> },
    { title: "比较类型", dataIndex: "comparisonType", width: 145, render: (value: ComparisonType) => <Tag color="purple">{comparisonTypeLabels[value || "batch"]}</Tag> },
    { title: "分析对象", width: 225, render: (_value, row) => <div className="quality-report-object"><strong>{row.objectName}</strong><span>{row.systemName}</span></div> },
    { title: "基准 / 当前", dataIndex: "batchLabel", width: 360, ellipsis: true, render: (value) => formatQualityBatchId(value) },
    { title: "得分变化", dataIndex: "scoreChange", width: 115, render: (value) => <span className={`quality-report-delta ${Number(value) >= 0 ? "is-positive" : "is-negative"}`}>{Number(value) >= 0 ? "+" : ""}{Number(value || 0).toFixed(2)} 分</span> },
    { title: "问题行变化", dataIndex: "issueRowsChange", width: 120, render: (value) => <span className={Number(value) <= 0 ? "quality-report-positive" : "quality-report-negative"}>{Number(value) >= 0 ? "+" : ""}{formatNumber(value)}</span> },
    { title: "新增问题", dataIndex: "newIssueCount", width: 95, render: (value) => value ? <Tag color="red">{value} 项</Tag> : <Tag color="green">0 项</Tag> },
    { title: "已消除", dataIndex: "resolvedIssueCount", width: 95, render: (value) => <Tag color={value ? "green" : "default"}>{value || 0} 项</Tag> },
    { title: "可比性", dataIndex: "comparabilityLabel", width: 100, render: (value, row) => <Tag color={row.comparabilityLevel === "direct" ? "green" : row.comparabilityLevel === "unavailable" ? "red" : "orange"}>{value || "直接可比"}</Tag> },
    { title: "生成时间", dataIndex: "createdAt", width: 175, render: formatTime },
    actionColumn,
  ];

  const capabilityCards = [
    {
      mode: "snapshot" as ReportMode,
      title: "质量快照报告",
      desc: "生成表级、系统级和项目总览质量快照，固化评分、覆盖、问题证据和治理状态。",
      icon: <FileDoneOutlined />,
      color: "#1677ff",
      stats: [["表级", overview.table?.reportCount || 0, "份"], ["系统级", overview.system?.reportCount || 0, "份"], ["平均得分", overview.averageScore ?? "-", "分"]],
    },
    {
      mode: "comparison" as ReportMode,
      title: "差异分析报告",
      desc: "支持表运行批次、表级报告和系统级报告三种同层级比较，识别质量与治理变化。",
      icon: <SwapOutlined />,
      color: "#7c3aed",
      stats: [["批次", overview.comparison?.byType?.batch || 0, "份"], ["表报告", overview.comparison?.byType?.tableReport || 0, "份"], ["系统报告", overview.comparison?.byType?.systemReport || 0, "份"]],
    },
  ];

  return <div className="app-page quality-report-center-page">
    <div className="app-page-body">
      <Card className="surface-card quality-report-stat-strip" styles={{ body: { padding: "14px 18px" } }}>
        {[
          { label: "报告总数", value: overview.reportCount || 0, suffix: "份", icon: <FileTextOutlined />, color: "#1677ff" },
          { label: "本月生成", value: overview.monthlyReportCount || 0, suffix: "份", icon: <FileDoneOutlined />, color: "#13a8a8" },
          { label: "平均质量得分", value: overview.averageScore ?? "-", suffix: "分", icon: <SafetyCertificateOutlined />, color: "#2f9e44" },
          { label: "平均维度覆盖", value: overview.averageCoverageRate ?? 0, suffix: "%", icon: <CheckCircleOutlined />, color: "#722ed1" },
          { label: "待整改问题", value: overview.openIssueCount || 0, suffix: "个", icon: <WarningOutlined />, color: "#fa8c16" },
        ].map((item) => <div className="quality-report-stat-item" key={item.label}><span className="quality-report-stat-item__icon" style={{ color: item.color, background: `${item.color}12` }}>{item.icon}</span><Statistic title={item.label} value={item.value} suffix={item.suffix} valueStyle={{ fontSize: 23, color: "#183153", fontWeight: 700 }} /></div>)}
      </Card>

      <div className="quality-report-capabilities">
        {capabilityCards.map((item) => <Card key={item.mode} className={`surface-card quality-report-capability ${activeMode === item.mode ? "is-active" : ""}`} onClick={() => setActiveMode(item.mode)}>
          <div className="quality-report-capability__top">
            <span className="quality-report-capability__icon" style={{ color: item.color, background: `${item.color}12` }}>{item.icon}</span>
            <div><Typography.Title level={4}>{item.title}</Typography.Title><Typography.Text type="secondary">{item.desc}</Typography.Text></div>
          </div>
          <div className="quality-report-capability__stats">
            {item.stats.map(([label, value, suffix]) => <div key={String(label)}><span>{label}</span><strong style={{ color: item.color }}>{value}<small>{suffix}</small></strong></div>)}
          </div>
        </Card>)}
      </div>

      <Card className="surface-card quality-report-archive" styles={{ body: { paddingTop: 0 } }}>
        {activeMode === "snapshot" ? <Tabs activeKey={activeSnapshotScope} onChange={(key) => setActiveSnapshotScope(key as "table" | "system")} items={([
          ["table", "表级报告"], ["system", "系统级报告"],
        ] as Array<["table" | "system", string]>).map(([key, label]) => ({ key, label: <span>{label}<b className="quality-report-tab-count">{reports.filter((item) => item.reportScope === key).length}</b></span> }))} /> : <Tabs activeKey={activeComparisonType} onChange={(key) => setActiveComparisonType(key as ComparisonType)} items={([
          ["batch", "表运行批次差异"], ["table_report", "表级报告差异"], ["system_report", "系统级报告差异"],
        ] as Array<[ComparisonType, string]>).map(([key, label]) => ({ key, label: <span>{label}<b className="quality-report-tab-count">{reports.filter((item) => item.reportScope === "comparison" && (item.comparisonType || "batch") === key).length}</b></span> }))} />}
        <div className="quality-report-toolbar">
          <Space wrap>
            <Input.Search allowClear value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索报告、系统、数据表或批次" style={{ width: 300 }} />
            <Select allowClear value={gradeFilter} onChange={setGradeFilter} placeholder="质量等级" style={{ width: 130 }} options={[{ value: "excellent", label: "优秀（≥90）" }, { value: "good", label: "良好（80-89）" }, { value: "attention", label: "关注（70-79）" }, { value: "risk", label: "高风险（<70）" }]} />
          </Space>
          <Space><Typography.Text type="secondary">共 {filteredReports.length} 份报告</Typography.Text><Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>生成{activeMode === "comparison" ? comparisonTypeLabels[activeComparisonType] : scopeLabels[activeSnapshotScope]}</Button></Space>
        </div>
        <Table rowKey="id" loading={loading} columns={activeMode === "comparison" ? comparisonColumns : activeSnapshotScope === "table" ? tableColumns : systemColumns} dataSource={filteredReports} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 份` }} locale={{ emptyText: <Empty description={`暂无${activeMode === "comparison" ? comparisonTypeLabels[activeComparisonType] : scopeLabels[activeSnapshotScope]}，点击右上角生成`} /> }} scroll={{ x: activeMode === "comparison" ? 1750 : 1700 }} />
      </Card>

      <Modal title="生成正式数据质量报告" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void submit()} confirmLoading={submitting} okText="生成报告" width={760} destroyOnHidden>
        <div className="quality-report-create-tip"><SafetyCertificateOutlined /><span>报告将固化当前统计快照，自动生成质量维度、趋势、重点问题和正式排版；AI失败不影响确定性报告。</span></div>
        <Form form={form} layout="vertical" style={{ marginTop: 18 }}>
          <Form.Item label="分析模式" name="reportScope" rules={[{ required: true }]}><Select disabled options={activeMode === "comparison" ? [{ value: "comparison", label: "差异分析报告" }] : [{ value: activeSnapshotScope, label: scopeLabels[activeSnapshotScope] }]} /></Form.Item>
          {scope === "comparison" ? <Form.Item label="比较类型" name="comparisonType" rules={[{ required: true }]}><Select onChange={() => { form.setFieldsValue({ scopeRefId: undefined, comparisonObjectKey: undefined, currentResultBatchId: undefined, previousResultBatchId: undefined, currentReportId: undefined, baselineReportId: undefined }); setComparisonPreview(null); }} options={Object.entries(comparisonTypeLabels).map(([value, label]) => ({ value, label }))} /></Form.Item> : null}
          {scope === "system" ? <Form.Item label="业务系统" name="scopeRefId" extra="不选择时生成当前项目全部系统的质量总览"><Select allowClear showSearch optionFilterProp="label" placeholder="选择系统或生成项目总览" options={systems.map((item) => ({ value: item.id, label: `${item.systemName} / ${item.systemCode}` }))} /></Form.Item> : null}
          {scope === "table" || (scope === "comparison" && ["batch", "table_report"].includes(comparisonType)) ? <Form.Item label="监控表" name="scopeRefId" rules={[{ required: true, message: "请选择监控表" }]}><Select showSearch optionFilterProp="label" placeholder="选择需要分析的数据表" onChange={() => setComparisonPreview(null)} options={tables.map((item) => ({ value: item.monitorTableId, label: `${item.tableName} / ${item.systemName}` }))} /></Form.Item> : null}
          {scope === "comparison" && comparisonType === "system_report" ? <Form.Item label="比较对象" name="comparisonObjectKey" rules={[{ required: true, message: "请选择业务系统或项目总览" }]}><Select showSearch optionFilterProp="label" placeholder="选择系统级报告对象" onChange={() => setComparisonPreview(null)} options={[{ value: "project", label: "项目质量总览" }, ...systems.map((item) => ({ value: `system:${item.id}`, label: `${item.systemName} / ${item.systemCode}` }))]} /></Form.Item> : null}
          {scope === "table" ? <Form.Item label="运行批次" name="resultBatchId" rules={[{ required: true, message: "请选择运行批次" }]}><Select placeholder="选择需要生成报告的批次" options={batches.map((item) => ({ value: item.id, label: `${formatQualityBatchId(item.batchId)} · ${formatTime(item.completedAt)} · ${item.score ?? "-"}分` }))} /></Form.Item> : null}
          {scope === "comparison" && comparisonType === "batch" ? <div className="quality-report-batch-selectors"><Form.Item label="当前批次" name="currentResultBatchId" rules={[{ required: true, message: "请选择当前批次" }]}><Select onChange={() => setComparisonPreview(null)} options={batches.map((item) => ({ value: item.id, label: `${formatQualityBatchId(item.batchId)} · ${formatTime(item.completedAt)} · ${item.score ?? "-"}分` }))} /></Form.Item><Form.Item label="基准批次" name="previousResultBatchId" rules={[{ required: true, message: "请选择基准批次" }]}><Select onChange={() => setComparisonPreview(null)} options={batches.map((item) => ({ value: item.id, label: `${formatQualityBatchId(item.batchId)} · ${formatTime(item.completedAt)} · ${item.score ?? "-"}分` }))} /></Form.Item></div> : null}
          {scope === "comparison" && comparisonType !== "batch" ? <>
            <div className="quality-report-batch-selectors">
              <Form.Item label="当前报告" name="currentReportId" rules={[{ required: true, message: "请选择当前报告" }]}><Select showSearch optionFilterProp="label" onChange={() => setComparisonPreview(null)} placeholder="选择较新的质量报告" options={selectableSourceReports.map((item) => ({ value: item.id, label: `${item.reportTitle} · ${formatTime(item.snapshotAt)} · ${item.score ?? "-"}分 · ${item.templateVersion}` }))} /></Form.Item>
              <Form.Item label="基准报告" name="baselineReportId" rules={[{ required: true, message: "请选择基准报告" }]}><Select showSearch optionFilterProp="label" onChange={() => setComparisonPreview(null)} placeholder="选择作为基准的历史报告" options={selectableSourceReports.map((item) => ({ value: item.id, label: `${item.reportTitle} · ${formatTime(item.snapshotAt)} · ${item.score ?? "-"}分 · ${item.templateVersion}` }))} /></Form.Item>
            </div>
            {!selectableSourceReports.length ? <Alert type="warning" showIcon message="当前对象没有可比较的历史报告" description="至少需要两份同一张表或同一系统的质量快照报告。" /> : null}
          </> : null}
          {scope === "comparison" ? <div className="quality-report-comparability-check">
            <Button loading={comparisonPreviewLoading} onClick={() => void checkComparison()}>检查可比性</Button>
            {comparisonPreview?.comparability ? <Alert showIcon type={comparisonPreview.comparability.level === "direct" ? "success" : comparisonPreview.comparability.level === "unavailable" ? "error" : "warning"} message={comparisonPreview.comparability.levelLabel || "可比性检查"} description={<div><div>{comparisonPreview.comparability.message}</div>{comparisonPreview.comparability.reasons?.map((item: string) => <div key={item}>• {item}</div>)}</div>} /> : null}
          </div> : null}
          <Form.Item label="报告名称" name="reportTitle"><Input maxLength={255} placeholder="留空自动生成：对象名称_质量报告/差异分析报告_时间或批次" /></Form.Item>
          <Form.Item name="useAi" valuePropName="checked"><Checkbox><Space><RobotOutlined />使用模型管理中的“质量分析与报告”场景生成摘要和整改建议</Space></Checkbox></Form.Item>
        </Form>
      </Modal>

      <Drawer title={preview?.reportTitle || "正式质量报告"} open={Boolean(preview) || previewLoading} loading={previewLoading} onClose={() => setPreview(null)} width={1180} styles={{ body: { padding: 0, background: "#eef3f8" } }} extra={preview ? <Space><Button icon={<DownloadOutlined />} loading={downloading === `${preview.id}-md`} onClick={() => void handleDownload(preview, "md")}>Markdown</Button><Button icon={<DownloadOutlined />} loading={downloading === `${preview.id}-docx`} onClick={() => void handleDownload(preview, "docx")}>Word</Button></Space> : null}>
        {preview ? <div className="quality-report-drawer"><div className="quality-report-drawer__meta"><Space wrap><Tag color="blue">{reportTypeLabel(preview)}</Tag>{preview.reportScope === "comparison" ? <Tag color={preview.comparabilityLevel === "direct" ? "green" : "orange"}>{preview.comparabilityLabel || "条件可比"}</Tag> : null}<Tag color="green">生成成功</Tag><Typography.Text type="secondary">报告编号 QC-{String(preview.id).padStart(6, "0")} · {formatTime(preview.createdAt)}</Typography.Text></Space></div><div className="quality-report-preview" dangerouslySetInnerHTML={{ __html: preview.reportHtml || "<p>报告内容为空</p>" }} /></div> : null}
      </Drawer>
    </div>
  </div>;
}
