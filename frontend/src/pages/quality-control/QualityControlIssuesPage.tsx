import { CheckCircleOutlined, ClockCircleOutlined, RobotOutlined, WarningOutlined } from "@ant-design/icons";
import { App, Button, Card, DatePicker, Drawer, Empty, Form, Input, Modal, Select, Space, Statistic, Table, Tabs, Tag, Timeline, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchQualityAssignableUsers, fetchQualityFindings, fetchQualityIssueDetail, fetchQualityIssues, reviewQualityFinding, runQualityAiAnalysis, updateQualityIssueStatus } from "../../services/qualityControl";
import type { QualityAssignableUser } from "../../services/qualityControl";

const findingStatusLabels: Record<string, string> = { pending_confirmation: "待确认", confirmed: "已确认为问题", expected_change: "符合预期", false_positive: "误报", ignored: "已忽略" };
const issueStatusLabels: Record<string, string> = { pending: "待处理", processing: "处理中", verifying: "待验证", completed: "已完成", ignored: "已忽略", reopened: "已重开" };
const allProblemStatusLabels = { ...findingStatusLabels, ...issueStatusLabels };
const severityColors: Record<string, string> = { critical: "red", high: "volcano", medium: "gold", low: "blue" };
const severityLabels: Record<string, string> = { critical: "紧急", high: "高", medium: "中", low: "低" };
function formatTime(value?: string | null) { return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-"; }
function formatDateOnly(value?: string | null) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString("zh-CN"); }
function compareText(left: unknown, right: unknown) { return String(left || "").localeCompare(String(right || ""), "zh-CN"); }
function compareDate(left?: string | null, right?: string | null) { return new Date(left || 0).getTime() - new Date(right || 0).getTime(); }
function resolveProblemStatus(row: any) { return row.findingStatus === "confirmed" && row.issueStatus ? row.issueStatus : row.findingStatus; }
function problemStatusColor(status: string) { return ({ pending_confirmation: "processing", confirmed: "red", pending: "gold", processing: "processing", verifying: "cyan", completed: "green", reopened: "volcano" } as Record<string, string>)[status] || "default"; }
const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function QualityControlIssuesPage() {
  const { message } = App.useApp();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [findings, setFindings] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<QualityAssignableUser[]>([]);
  const [reviewRow, setReviewRow] = useState<any>(null);
  const [issueDetail, setIssueDetail] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiReview, setAiReview] = useState<any>(null);
  const [issueNote, setIssueNote] = useState("");
  const [activeTab, setActiveTab] = useState("findings");
  const [keyword, setKeyword] = useState("");
  const [systemFilter, setSystemFilter] = useState<string>();
  const [severityFilter, setSeverityFilter] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<string>();
  const [reviewForm] = Form.useForm();

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [findingResponse, issueResponse, userResponse] = await Promise.all([fetchQualityFindings(token), fetchQualityIssues(token), fetchQualityAssignableUsers(token)]);
      setFindings(findingResponse.data || []);
      setIssues(issueResponse.data || []);
      setAssignableUsers(userResponse.data || []);
    } catch (error) { message.error(error instanceof Error ? error.message : "加载问题中心失败"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [token]);

  function openReview(row: any, action = "confirm") {
    setReviewRow(row);
    reviewForm.setFieldsValue({ action, note: "", ownerUserId: undefined, dueDate: "" });
  }

  async function submitReview() {
    if (!token || !reviewRow) return;
    const values = await reviewForm.validateFields();
    setSubmitting(true);
    try {
      await reviewQualityFinding(token, reviewRow.id, { ...values, dueDate: values.dueDate?.format ? values.dueDate.format("YYYY-MM-DD") : values.dueDate });
      message.success(values.action === "confirm" ? "已确认为治理问题" : "异常反馈已保存");
      setReviewRow(null);
      await load();
    } catch (error) { message.error(error instanceof Error ? error.message : "提交失败"); }
    finally { setSubmitting(false); }
  }

  async function openIssue(id: number) {
    if (!token) return;
    try { setIssueNote(""); setIssueDetail((await fetchQualityIssueDetail(token, id)).data); }
    catch (error) { message.error(error instanceof Error ? error.message : "加载问题详情失败"); }
  }

  async function changeIssueStatus(status: string) {
    if (!token || !issueDetail) return;
    try {
      await updateQualityIssueStatus(token, issueDetail.id, { issueStatus: status, note: issueNote || undefined });
      message.success("问题状态已更新");
      setIssueNote("");
      await openIssue(issueDetail.id);
      await load();
    } catch (error) { message.error(error instanceof Error ? error.message : "更新状态失败"); }
  }

  async function analyseFinding(row: any) {
    if (!token) return;
    setAiReview({ loading: true, row });
    try { setAiReview({ row, data: (await runQualityAiAnalysis(token, { scopeType: "table", scopeRefId: row.monitorTableId })).data.ai }); }
    catch (error) { setAiReview(null); message.error(error instanceof Error ? error.message : "AI 研判失败"); }
  }

  const pendingCount = findings.filter((item) => item.findingStatus === "pending_confirmation").length;
  const processingCount = issues.filter((item) => ["pending", "processing", "verifying", "reopened"].includes(item.issueStatus)).length;
  const completedCount = issues.filter((item) => item.issueStatus === "completed").length;
  const overdueCount = issues.filter((item) => item.dueDate && new Date(item.dueDate).getTime() < Date.now() && item.issueStatus !== "completed").length;
  const systemOptions = useMemo(() => Array.from(new Set([...findings, ...issues].map((item) => item.systemName).filter(Boolean))).sort().map((value) => ({ value, label: value })), [findings, issues]);
  const statusOptions = Object.entries(activeTab === "findings" ? allProblemStatusLabels : issueStatusLabels).map(([value, label]) => ({ value, label }));
  const matchesKeyword = (row: any) => !keyword.trim() || [row.tableName, row.systemName, row.fieldName, row.ruleCode, row.issueTitle, row.ownerName].some((value) => String(value || "").toLowerCase().includes(keyword.trim().toLowerCase()));
  const filteredFindings = useMemo(() => findings.filter((row) => matchesKeyword(row) && (!systemFilter || row.systemName === systemFilter) && (!severityFilter || row.severity === severityFilter) && (!statusFilter || resolveProblemStatus(row) === statusFilter)), [findings, keyword, systemFilter, severityFilter, statusFilter]);
  const filteredIssues = useMemo(() => issues.filter((row) => matchesKeyword(row) && (!systemFilter || row.systemName === systemFilter) && (!severityFilter || row.severity === severityFilter) && (!statusFilter || row.issueStatus === statusFilter)), [issues, keyword, systemFilter, severityFilter, statusFilter]);
  const findingColumns: ColumnsType<any> = [
    { title: "异常对象", key: "object", width: 260, sorter: (left, right) => compareText(left.tableName, right.tableName), render: (_v, row) => <Space direction="vertical" size={2} style={{ minWidth: 0, width: "100%" }}><Typography.Text strong ellipsis={{ tooltip: row.tableName }} style={{ maxWidth: 235 }}>{row.tableName}</Typography.Text><Typography.Text type="secondary" ellipsis={{ tooltip: `${row.systemName || "未归属系统"} · ${row.fieldName || "表级"}` }} style={{ maxWidth: 235 }}>{row.systemName || "未归属系统"} · {row.fieldName || "表级"}</Typography.Text></Space> },
    { title: "命中规则", key: "rule", width: 230, sorter: (left, right) => compareText(left.ruleCode, right.ruleCode), render: (_v, row) => <Space direction="vertical" size={2} style={{ minWidth: 0, width: "100%" }}><Typography.Text code ellipsis={{ tooltip: row.ruleCode }} style={{ maxWidth: 205 }}>{row.ruleCode}</Typography.Text><Typography.Text type="secondary">问题行 {Number(row.issueRows || 0).toLocaleString()} · {(Number(row.issueRate || 0) * 100).toFixed(2)}%</Typography.Text></Space> },
    { title: "级别", dataIndex: "severity", width: 90, sorter: (left, right) => (severityRank[left.severity] || 0) - (severityRank[right.severity] || 0), render: (value) => <Tag color={severityColors[value] || "default"}>{severityLabels[value] || "中"}</Tag> },
    { title: "状态", key: "problemStatus", width: 130, sorter: (left, right) => compareText(allProblemStatusLabels[resolveProblemStatus(left)], allProblemStatusLabels[resolveProblemStatus(right)]), render: (_value, row) => { const status = resolveProblemStatus(row); return <Tag color={problemStatusColor(status)}>{allProblemStatusLabels[status] || status}</Tag>; } },
    { title: "出现", key: "occurrence", width: 160, sorter: (left, right) => Number(left.occurrenceCount || 0) - Number(right.occurrenceCount || 0) || compareDate(left.lastSeenAt, right.lastSeenAt), render: (_v, row) => <Space direction="vertical" size={0}><Typography.Text>{row.occurrenceCount} 次</Typography.Text><Typography.Text type="secondary">{formatTime(row.lastSeenAt)}</Typography.Text></Space> },
    { title: "操作", key: "actions", width: 220, fixed: "right", render: (_v, row) => <Space size={4}><Button type="link" onClick={() => void analyseFinding(row)} icon={<RobotOutlined />}>AI研判</Button>{row.findingStatus === "pending_confirmation" ? <Button type="link" onClick={() => openReview(row, "confirm")}>异常反馈与确认</Button> : row.issueId ? <Button type="link" onClick={() => void openIssue(row.issueId)}>查看问题</Button> : null}</Space> },
  ];
  const issueColumns: ColumnsType<any> = [
    { title: "问题标题", dataIndex: "issueTitle", width: 360, sorter: (left, right) => compareText(left.issueTitle, right.issueTitle), render: (value, row) => <Button type="link" style={{ padding: 0, maxWidth: "100%" }} onClick={() => void openIssue(row.id)}><Typography.Text ellipsis={{ tooltip: value }} style={{ color: "inherit" }}>{value}</Typography.Text></Button> },
    { title: "状态", dataIndex: "issueStatus", width: 120, sorter: (left, right) => compareText(issueStatusLabels[left.issueStatus], issueStatusLabels[right.issueStatus]), render: (value) => <Tag color={value === "completed" ? "green" : value === "processing" ? "processing" : value === "verifying" ? "cyan" : "default"}>{issueStatusLabels[value] || value}</Tag> },
    { title: "级别", dataIndex: "severity", width: 100, sorter: (left, right) => (severityRank[left.severity] || 0) - (severityRank[right.severity] || 0), render: (value) => <Tag color={severityColors[value] || "default"}>{severityLabels[value] || "中"}</Tag> },
    { title: "负责人", dataIndex: "ownerName", width: 130, sorter: (left, right) => compareText(left.ownerName, right.ownerName), render: (value) => value || "未指定" },
    { title: "截止日期", dataIndex: "dueDate", width: 130, sorter: (left, right) => compareDate(left.dueDate, right.dueDate), render: (value, row) => value ? <Typography.Text type={new Date(value).getTime() < Date.now() && row.issueStatus !== "completed" ? "danger" : undefined}>{formatDateOnly(value)}</Typography.Text> : "-" },
    { title: "复发次数", dataIndex: "occurrenceCount", width: 100, sorter: (left, right) => Number(left.occurrenceCount || 0) - Number(right.occurrenceCount || 0) },
    { title: "更新时间", dataIndex: "updatedAt", width: 180, sorter: (left, right) => compareDate(left.updatedAt, right.updatedAt), render: formatTime },
  ];
  const stats = useMemo(() => [
    { title: "待确认异常", value: pendingCount, icon: <WarningOutlined />, color: "#d46b08" },
    { title: "处理中问题", value: processingCount, icon: <ClockCircleOutlined />, color: "#1677ff" },
    { title: "已完成问题", value: completedCount, icon: <CheckCircleOutlined />, color: "#389e0d" },
    { title: "已逾期", value: overdueCount, icon: <WarningOutlined />, color: "#cf1322" },
  ], [pendingCount, processingCount, completedCount, overdueCount]);

  return <div className="app-page quality-issues-page">
    <div className="app-page-body">
      <div className="quality-issues-stat-grid">{stats.map((item) => <Card key={item.title} variant="borderless" className="surface-card"><div className="quality-issues-stat-card"><Statistic title={item.title} value={item.value} valueStyle={{ color: item.color, fontSize: 26 }} /><span style={{ color: item.color, background: `${item.color}12` }}>{item.icon}</span></div></Card>)}</div>
      <Tabs activeKey={activeTab} onChange={(key) => { setActiveTab(key); setStatusFilter(undefined); }} items={[
        { key: "findings", label: `所有问题 (${findings.length})`, children: <><div className="quality-issues-filterbar"><Input.Search allowClear value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索对象、字段、规则或负责人" style={{ width: 280 }} /><Select allowClear value={systemFilter} onChange={setSystemFilter} placeholder="所属系统" style={{ width: 180 }} options={systemOptions} /><Select allowClear value={severityFilter} onChange={setSeverityFilter} placeholder="问题级别" style={{ width: 120 }} options={Object.entries(severityLabels).map(([value, label]) => ({ value, label }))} /><Select allowClear value={statusFilter} onChange={setStatusFilter} placeholder="处理状态" style={{ width: 150 }} options={statusOptions} /></div><Card variant="borderless" className="surface-card"><Table rowKey="id" loading={loading} columns={findingColumns} dataSource={filteredFindings} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }} scroll={{ x: 1120 }} locale={{ emptyText: <Empty description="暂无质量问题" /> }} /></Card></> },
        { key: "issues", label: `跟踪问题 (${issues.length})`, children: <><div className="quality-issues-filterbar"><Input.Search allowClear value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索问题、对象或负责人" style={{ width: 280 }} /><Select allowClear value={systemFilter} onChange={setSystemFilter} placeholder="所属系统" style={{ width: 180 }} options={systemOptions} /><Select allowClear value={severityFilter} onChange={setSeverityFilter} placeholder="问题级别" style={{ width: 120 }} options={Object.entries(severityLabels).map(([value, label]) => ({ value, label }))} /><Select allowClear value={statusFilter} onChange={setStatusFilter} placeholder="处理状态" style={{ width: 150 }} options={statusOptions} /></div><Card variant="borderless" className="surface-card"><Table rowKey="id" loading={loading} columns={issueColumns} dataSource={filteredIssues} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }} scroll={{ x: 1050 }} locale={{ emptyText: <Empty description="确认真实异常后会生成治理问题" /> }} /></Card></> },
      ]} />
      <Modal title="AI 问题研判" open={Boolean(aiReview)} onCancel={() => setAiReview(null)} footer={<Button onClick={() => setAiReview(null)}>关闭</Button>} confirmLoading={aiReview?.loading} destroyOnHidden>
        {aiReview?.loading ? <Typography.Text type="secondary">正在生成研判结果…</Typography.Text> : <Space direction="vertical" size={14} style={{ width: "100%" }}><Typography.Text type="secondary">{aiReview?.row?.tableName}{aiReview?.row?.fieldName ? ` · ${aiReview.row.fieldName}` : ""}</Typography.Text><Typography.Paragraph style={{ marginBottom: 0 }}>{aiReview?.data?.summary || "暂未生成研判摘要"}</Typography.Paragraph>{aiReview?.data?.suggestions?.length ? <Card size="small" styles={{ body: { padding: "12px 14px" } }}><Typography.Text strong>治理建议</Typography.Text><ul className="quality-issues-ai-suggestions">{aiReview.data.suggestions.map((item: string) => <li key={item}>{item}</li>)}</ul></Card> : null}</Space>}
      </Modal>
      <Modal title="异常反馈与确认" open={Boolean(reviewRow)} onCancel={() => setReviewRow(null)} onOk={() => void submitReview()} confirmLoading={submitting} okText="提交">
        <Form form={reviewForm} layout="vertical" style={{ marginTop: 18 }}>
          <Form.Item label="处理结论" name="action" rules={[{ required: true }]}><Select options={[{ value: "confirm", label: "确认为真实问题" }, { value: "expected", label: "符合预期变化" }, { value: "false_positive", label: "标记为误报" }, { value: "ignore", label: "忽略" }]} /></Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.action !== next.action}>{({ getFieldValue }) => getFieldValue("action") === "confirm" ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><Form.Item label="负责人" name="ownerUserId" rules={[{ required: true, message: "请选择负责人" }]}><Select showSearch optionFilterProp="label" placeholder="选择系统注册用户" options={assignableUsers.map((item) => ({ value: item.id, label: `${item.displayName || item.username}（${item.username}）` }))} /></Form.Item><Form.Item label="截止日期" name="dueDate"><DatePicker style={{ width: "100%" }} /></Form.Item></div> : null}</Form.Item>
          <Form.Item label="处理说明" name="note"><Input.TextArea rows={4} maxLength={2000} placeholder="记录确认依据、误报原因或后续核查建议" /></Form.Item>
        </Form>
      </Modal>
      <Drawer title={issueDetail?.issueTitle || "问题详情"} open={Boolean(issueDetail)} onClose={() => setIssueDetail(null)} width={620} extra={issueDetail ? <Space><Button onClick={() => void changeIssueStatus("processing")}>开始处理</Button><Button onClick={() => void changeIssueStatus("verifying")}>提交验证</Button><Button type="primary" onClick={() => void changeIssueStatus("completed")}>完成</Button></Space> : null}>
        {issueDetail ? <Space direction="vertical" size={18} style={{ width: "100%" }}><Card size="small" style={{ background: "#f7faff" }}><Space wrap><Tag color={severityColors[issueDetail.severity]}>{severityLabels[issueDetail.severity] || "中"}</Tag><Tag>{issueStatusLabels[issueDetail.issueStatus] || issueDetail.issueStatus}</Tag><Typography.Text>负责人：{issueDetail.ownerName || "未指定"}</Typography.Text><Typography.Text>截止：{issueDetail.dueDate ? formatDateOnly(issueDetail.dueDate) : "未设置"}</Typography.Text></Space></Card><Typography.Paragraph>{issueDetail.description || "暂无问题描述"}</Typography.Paragraph><Input.TextArea value={issueNote} onChange={(event) => setIssueNote(event.target.value)} rows={3} maxLength={1000} placeholder="填写本次处理或验证说明，状态更新后会写入时间线" /><Typography.Title level={5}>处理时间线</Typography.Title><Timeline items={(issueDetail.events || []).map((event: any) => ({ children: <Space direction="vertical" size={0}><Typography.Text>{event.eventNote || event.eventType}</Typography.Text><Typography.Text type="secondary">{event.operatorName} · {formatTime(event.createdAt)}</Typography.Text></Space> }))} /></Space> : null}
      </Drawer>
    </div>
  </div>;
}
