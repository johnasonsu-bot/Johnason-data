import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { BranchesOutlined, NodeIndexOutlined, ReloadOutlined, TableOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { DataTableCard } from "../../../components/ui/DataTableCard";
import { PageToolbar } from "../../../components/ui/PageToolbar";
import { StatCard } from "../../../components/ui/StatCard";
import {
  deleteBusinessSystemTemplate,
  fetchBusinessSystemTemplateBuildJob,
  fetchBusinessSystemTemplates,
  fetchIndustryIncubationDetail,
  fetchIndustryIncubations,
  startBusinessSystemTemplateBuildJob,
  type LabBusinessSystemTemplatePayload,
} from "../../../services/dataLab";
import type {
  LabBusinessSystemTemplateBuildJobRecord,
  LabBusinessSystemTemplateRecord,
  LabIndustryIncubationRecord,
} from "../../../types/api";
import {
  formatDateTime,
  normalizeCategoryOptions,
  renderBuildJobStatus,
  renderCodeTags,
  renderStatus,
  TEMPLATE_STATUS_META,
} from "./scenarioManagementShared";

const ACTIVE_TEMPLATE_BUILD_JOB_STORAGE_KEY = "data_lab_active_template_build_job_ids";
const LEGACY_ACTIVE_TEMPLATE_BUILD_JOB_STORAGE_KEY = "data_lab_active_template_build_job_id";

export function LogicalModelListPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<LabBusinessSystemTemplateRecord[]>([]);
  const [incubations, setIncubations] = useState<LabIndustryIncubationRecord[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [selectedIncubation, setSelectedIncubation] = useState<LabIndustryIncubationRecord | null>(null);
  const [keyword, setKeyword] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeBuildJobIds, setActiveBuildJobIds] = useState<string[]>([]);
  const [trackedBuildJobs, setTrackedBuildJobs] = useState<Record<string, LabBusinessSystemTemplateBuildJobRecord>>({});
  const [selectedBuildJobId, setSelectedBuildJobId] = useState<string | null>(null);
  const [buildModalOpen, setBuildModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form] = Form.useForm<LabBusinessSystemTemplatePayload>();

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const [templateResponse, incubationResponse] = await Promise.all([
        fetchBusinessSystemTemplates(token),
        fetchIndustryIncubations(token),
      ]);
      setRecords(templateResponse.data);
      setIncubations(incubationResponse.data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载逻辑模型清单失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedJobIds = window.localStorage.getItem(ACTIVE_TEMPLATE_BUILD_JOB_STORAGE_KEY);
    const legacyJobId = window.localStorage.getItem(LEGACY_ACTIVE_TEMPLATE_BUILD_JOB_STORAGE_KEY);
    const parsedIds = (() => {
      if (!storedJobIds) return [];
      try {
        const value = JSON.parse(storedJobIds);
        return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
      } catch {
        return [];
      }
    })();
    const mergedIds = Array.from(new Set([...parsedIds, ...(legacyJobId ? [legacyJobId] : [])]));
    if (mergedIds.length > 0) {
      setActiveBuildJobIds((current) => (current.length > 0 ? current : mergedIds));
      setSelectedBuildJobId((current) => current || mergedIds[mergedIds.length - 1]);
    }
    window.localStorage.removeItem(LEGACY_ACTIVE_TEMPLATE_BUILD_JOB_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeBuildJobIds.length > 0) {
      window.localStorage.setItem(ACTIVE_TEMPLATE_BUILD_JOB_STORAGE_KEY, JSON.stringify(activeBuildJobIds));
      return;
    }
    window.localStorage.removeItem(ACTIVE_TEMPLATE_BUILD_JOB_STORAGE_KEY);
  }, [activeBuildJobIds]);

  useEffect(() => {
    if (selectedBuildJobId && trackedBuildJobs[selectedBuildJobId]) {
      return;
    }
    if (activeBuildJobIds.length > 0) {
      setSelectedBuildJobId(activeBuildJobIds[activeBuildJobIds.length - 1]);
      return;
    }
    const trackedIds = Object.keys(trackedBuildJobs);
    setSelectedBuildJobId(trackedIds.length > 0 ? trackedIds[trackedIds.length - 1] : null);
  }, [activeBuildJobIds, selectedBuildJobId, trackedBuildJobs]);

  useEffect(() => {
    if (!token || activeBuildJobIds.length === 0) {
      return undefined;
    }

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const responses = await Promise.all(
          activeBuildJobIds.map(async (jobId) => {
            try {
              const response = await fetchBusinessSystemTemplateBuildJob(token, jobId);
              return { jobId, data: response.data, error: null };
            } catch (error) {
              return { jobId, data: null, error };
            }
          })
        );
        if (cancelled) return;

        let shouldReload = false;
        const finishedJobIds = new Set<string>();
        setTrackedBuildJobs((current) => {
          const nextJobs = { ...current };
          responses.forEach(({ jobId, data }) => {
            if (data) {
              nextJobs[jobId] = data;
            }
          });
          return nextJobs;
        });

        responses.forEach(({ jobId, data, error }) => {
          if (error) {
            finishedJobIds.add(jobId);
            message.error(error instanceof Error ? error.message : `获取任务进度失败：${jobId}`);
            return;
          }
          if (!data) return;
          if (data.status === "completed") {
            finishedJobIds.add(jobId);
            shouldReload = true;
            message.success(`逻辑模型创建完成：${data.result?.templateName || data.templateName}`);
            return;
          }
          if (data.status === "failed") {
            finishedJobIds.add(jobId);
            message.error(data.errorMessage || `逻辑模型构建失败：${data.templateName}`);
          }
        });

        setCreating(false);
        if (finishedJobIds.size > 0) {
          setActiveBuildJobIds((current) => current.filter((jobId) => !finishedJobIds.has(jobId)));
        }
        if (shouldReload) {
          await loadData();
        }

        if (responses.some(({ data }) => data && data.status !== "completed" && data.status !== "failed")) {
          timer = window.setTimeout(() => {
            void poll();
          }, 1500);
        }
      } catch (error) {
        if (cancelled) return;
        setCreating(false);
        message.error(error instanceof Error ? error.message : "获取逻辑模型构建进度失败");
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [activeBuildJobIds, token]);

  const activeBuildJobs = useMemo(
    () => activeBuildJobIds.map((jobId) => trackedBuildJobs[jobId]).filter(Boolean),
    [activeBuildJobIds, trackedBuildJobs]
  );

  const selectedBuildJob = selectedBuildJobId ? trackedBuildJobs[selectedBuildJobId] || null : null;

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return records.filter((item) => {
      if (industryFilter && item.industryCode !== industryFilter) return false;
      if (statusFilter && item.templateStatus !== statusFilter) return false;
      if (!normalizedKeyword) return true;
      const text = [
        item.templateName,
        item.templateCode,
        item.industryCode,
        item.templateDesc,
        ...(item.sourceCategoryCodes || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(normalizedKeyword);
    });
  }, [industryFilter, keyword, records, statusFilter]);

  const industryOptions = useMemo(
    () =>
      Array.from(new Set(records.map((item) => String(item.industryCode || "")).filter(Boolean))).map((item) => ({
        label: item,
        value: item,
      })),
    [records]
  );

  const kpis = useMemo(() => {
    const totalTables = filteredRecords.reduce((sum, item) => sum + Number(item.logicalTableCount || 0), 0);
    const totalRelations = filteredRecords.reduce((sum, item) => sum + Number(item.relationCount || 0), 0);
    const activeCount = filteredRecords.filter((item) => item.templateStatus === "active").length;
    return [
      {
        key: "total",
        title: "逻辑模型数",
        value: filteredRecords.length,
        icon: <NodeIndexOutlined />,
        description: "当前纳入建模流程的业务系统模板数量",
      },
      {
        key: "active",
        title: "启用中的模型",
        value: activeCount,
        icon: <BranchesOutlined />,
        description: "已进入正式使用状态的逻辑模型",
      },
      {
        key: "tables",
        title: "逻辑表总量",
        value: totalTables,
        icon: <TableOutlined />,
        description: "当前清单内逻辑表的累计数量",
      },
      {
        key: "relations",
        title: "关系总量",
        value: totalRelations,
        icon: <ReloadOutlined />,
        description: "当前清单内模型关系的累计数量",
      },
    ];
  }, [filteredRecords]);

  async function handleIncubationChange(value?: number) {
    if (!token || !value) {
      setSelectedIncubation(null);
      setCategoryOptions([]);
      form.setFieldsValue({ industryCode: undefined, sourceCategoryCodes: [] });
      return;
    }
    const response = await fetchIndustryIncubationDetail(token, value);
    setSelectedIncubation(response.data);
    setCategoryOptions(normalizeCategoryOptions(response.data));
    form.setFieldsValue({ industryCode: response.data.industryCode, sourceCategoryCodes: [] });
  }

  async function handleSubmit(values: LabBusinessSystemTemplatePayload) {
    if (!token) return;
    try {
      setCreating(true);
      const response = await startBusinessSystemTemplateBuildJob(token, values);
      setCreateOpen(false);
      setBuildModalOpen(true);
      setActiveBuildJobIds((current) => Array.from(new Set([...current, response.data.id])));
      setTrackedBuildJobs((current) => ({ ...current, [response.data.id]: response.data }));
      setSelectedBuildJobId(response.data.id);
      form.resetFields();
      setSelectedIncubation(null);
      setCategoryOptions([]);
      message.success(`已提交逻辑模型构建任务：${response.data.templateName}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "新建逻辑模型失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(record: LabBusinessSystemTemplateRecord) {
    if (!token) return;
    setDeletingId(record.id);
    try {
      const response = await deleteBusinessSystemTemplate(token, record.id);
      message.success(`已删除逻辑模型：${response.data.templateName}`);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除逻辑模型失败");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: ColumnsType<LabBusinessSystemTemplateRecord> = [
    {
      title: "逻辑模型",
      width: 260,
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            style={{ padding: 0, height: "auto", fontWeight: 600, textAlign: "left" }}
            onClick={() => navigate(`/dashboard/data-modeling/logical-models/${record.id}`)}
          >
            {record.templateName}
          </Button>
          <Typography.Text type="secondary">{record.templateCode}</Typography.Text>
        </Space>
      ),
    },
    { title: "行业编码", dataIndex: "industryCode", width: 140 },
    { title: "来源子类目", dataIndex: "sourceCategoryCodes", render: (value: string[]) => renderCodeTags(value) },
    { title: "逻辑表", dataIndex: "logicalTableCount", width: 100, align: "center" },
    { title: "关系", dataIndex: "relationCount", width: 100, align: "center" },
    {
      title: "状态",
      dataIndex: "templateStatus",
      width: 100,
      render: (value: string) => renderStatus(value, TEMPLATE_STATUS_META),
    },
    { title: "更新时间", dataIndex: "updatedAt", width: 180, render: (value: string) => formatDateTime(value) },
    {
      title: "操作",
      width: 180,
      fixed: "right",
      render: (_value, record) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/dashboard/data-modeling/logical-models/${record.id}`)}>
            查看设计
          </Button>
          <Popconfirm
            title="确认删除这个逻辑模型？"
            description="删除后将移除模板与逻辑版本；如果已创建物理模型实例，系统会阻止删除。"
            onConfirm={() => void handleDelete(record)}
          >
            <Button type="link" danger loading={deletingId === record.id}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="app-page">
      <PageToolbar
        left={(
          <>
            <Select
              allowClear
              style={{ width: 180 }}
              placeholder="按行业编码筛选"
              value={industryFilter}
              options={industryOptions}
              onChange={(value) => setIndustryFilter(value)}
            />
            <Select
              allowClear
              style={{ width: 160 }}
              placeholder="按状态筛选"
              value={statusFilter}
              options={[
                { label: "草稿", value: "draft" },
                { label: "启用", value: "active" },
                { label: "归档", value: "archived" },
              ]}
              onChange={(value) => setStatusFilter(value)}
            />
            <Input.Search
              allowClear
              className="toolbar-search"
              placeholder="搜索模型名称、编码、描述"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </>
        )}
        right={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              新建逻辑模型
            </Button>
          </Space>
        )}
      />

      <div className="app-page-body">
        {activeBuildJobs.length > 0 ? (
          <Card style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <Space>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    逻辑模型正在后台构建
                  </Typography.Title>
                  <Tag color="processing">{activeBuildJobs.length} 个任务</Tag>
                </Space>
                <Button onClick={() => setBuildModalOpen(true)}>
                  查看进度
                </Button>
              </div>
              {activeBuildJobs.map((job) => (
                <Alert
                  key={job.id}
                  type="info"
                  showIcon
                  message={`${job.templateName} / ${job.currentStage || job.status}`}
                  description={`进度：${Math.max(0, Math.min(100, Number(job.progressPercent || 0)))}%`}
                  action={(
                    <Button
                      size="small"
                      onClick={() => {
                        setSelectedBuildJobId(job.id);
                        setBuildModalOpen(true);
                      }}
                    >
                      查看
                    </Button>
                  )}
                />
              ))}
            </Space>
          </Card>
        ) : null}

        <div className="kpi-grid">
          {kpis.map((item) => (
            <StatCard key={item.key} title={item.title} value={item.value} icon={item.icon} description={item.description} />
          ))}
        </div>

        <DataTableCard<LabBusinessSystemTemplateRecord>
          title="逻辑模型清单"
          extra={<Typography.Text type="secondary">共 {filteredRecords.length} 个</Typography.Text>}
          tableProps={{
            rowKey: "id",
            loading,
            columns,
            dataSource: filteredRecords,
            pagination: { pageSize: 10, showSizeChanger: false },
            scroll: { x: 1280 },
            locale: { emptyText: <Empty description="暂无逻辑模型" /> },
          }}
        />
      </div>

      <Modal
        title="新建逻辑模型"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          form.resetFields();
          setSelectedIncubation(null);
          setCategoryOptions([]);
        }}
        onOk={() => void form.submit()}
        confirmLoading={creating}
        width={720}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ templateStatus: "draft", sourceCategoryCodes: [] }}
          onFinish={(values) => void handleSubmit(values)}
        >
          <Form.Item name="templateName" label="模型名称" rules={[{ required: true, message: "请输入逻辑模型名称" }]}>
            <Input placeholder="例如：畜牧管理逻辑模型" />
          </Form.Item>
          <Form.Item name="templateCode" label="模型编码">
            <Input placeholder="可不填，系统会自动生成" />
          </Form.Item>
          <Form.Item name="sourceIncubationId" label="关联数据调研项目">
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="可选"
              options={incubations.map((item) => ({ label: `${item.incubationName} (${item.industryCode})`, value: item.id }))}
              onChange={(value) => void handleIncubationChange(value)}
            />
          </Form.Item>
          <Form.Item name="industryCode" label="行业编码">
            <Input placeholder="未关联调研项目时可手工填写" />
          </Form.Item>
          <Form.Item name="sourceCategoryCodes" label="调研子类目">
            <Select
              mode="multiple"
              allowClear
              disabled={!selectedIncubation}
              placeholder={selectedIncubation ? "选择一个或多个子类目" : "请先选择数据调研项目"}
              options={categoryOptions}
            />
          </Form.Item>
          <Form.Item name="templateDesc" label="模型说明">
            <Input.TextArea rows={4} placeholder="描述模型面向的业务场景、对象边界与建模目标" />
          </Form.Item>
          <Form.Item name="templateStatus" label="模型状态">
            <Select
              options={[
                { label: "草稿", value: "draft" },
                { label: "启用", value: "active" },
                { label: "归档", value: "archived" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="AI 正在分析逻辑模型"
        open={buildModalOpen}
        onCancel={() => setBuildModalOpen(false)}
        width={760}
        footer={[
          <Button key="close" onClick={() => setBuildModalOpen(false)}>
            {selectedBuildJob?.status === "completed" ? "关闭" : "后台继续"}
          </Button>,
          selectedBuildJob?.status === "completed" && selectedBuildJob.result?.templateId ? (
            <Button
              key="view"
              type="primary"
              onClick={() => {
                setBuildModalOpen(false);
                navigate(`/dashboard/data-modeling/logical-models/${selectedBuildJob.result?.templateId}`);
              }}
            >
              查看设计
            </Button>
          ) : null,
        ]}
      >
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          {activeBuildJobs.length > 1 ? (
            <Select
              value={selectedBuildJobId || undefined}
              options={activeBuildJobs.map((job) => ({
                label: `${job.templateName} / ${job.currentStage || job.status}`,
                value: job.id,
              }))}
              onChange={(value) => setSelectedBuildJobId(value)}
            />
          ) : null}

          <Alert
            type={
              selectedBuildJob?.status === "failed"
                ? "error"
                : selectedBuildJob?.status === "completed"
                  ? "success"
                  : "info"
            }
            showIcon
            message={
              selectedBuildJob?.status === "failed"
                ? "逻辑模型分析失败"
                : selectedBuildJob?.status === "completed"
                  ? "逻辑模型分析完成"
                  : "AI 正在分批构建逻辑模型"
            }
            description={
              selectedBuildJob
                ? `当前模型：${selectedBuildJob.templateName}；状态：${selectedBuildJob.currentStage || selectedBuildJob.status}`
                : "任务已提交，正在等待 AI 返回结果。"
            }
          />

          <Card size="small">
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <Typography.Text strong>构建进度</Typography.Text>
                {renderBuildJobStatus(selectedBuildJob?.status)}
              </div>
              <Progress
                percent={Math.max(0, Math.min(100, Number(selectedBuildJob?.progressPercent || 0)))}
                status={
                  selectedBuildJob?.status === "failed"
                    ? "exception"
                    : selectedBuildJob?.status === "completed"
                      ? "success"
                      : "active"
                }
              />
            </Space>
          </Card>

          {selectedBuildJob?.errorMessage ? (
            <Alert type="error" showIcon message="错误信息" description={selectedBuildJob.errorMessage} />
          ) : null}

          <Card size="small" title="分析日志">
            {selectedBuildJob?.logs?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 360, overflowY: "auto" }}>
                {selectedBuildJob.logs.map((log) => (
                  <Card key={`${log.seq}-${log.createdAt}`} size="small">
                    <Space direction="vertical" size={4} style={{ display: "flex" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <Typography.Text strong>{log.message}</Typography.Text>
                        <Tag color={log.level === "error" ? "red" : log.level === "warning" ? "gold" : "blue"}>
                          {log.level}
                        </Tag>
                      </div>
                      <Typography.Text type="secondary">
                        {formatDateTime(log.createdAt)} / {log.stepKey}
                      </Typography.Text>
                      {log.detail && Object.keys(log.detail).length > 0 ? (
                        <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {JSON.stringify(log.detail, null, 2)}
                        </Typography.Paragraph>
                      ) : null}
                    </Space>
                  </Card>
                ))}
              </div>
            ) : (
              <Empty description="AI 日志准备中" />
            )}
          </Card>
        </Space>
      </Modal>
    </div>
  );
}
