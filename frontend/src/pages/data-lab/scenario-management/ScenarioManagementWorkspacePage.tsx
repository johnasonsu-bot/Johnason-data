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
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  createBusinessSystemInstance,
  createIndustryDataSource,
  deleteBusinessSystemInstance,
  deleteBusinessSystemTemplate,
  deleteIndustryDataSource,
  fetchBusinessSystemInstances,
  fetchBusinessSystemTemplateBuildJob,
  fetchBusinessSystemTemplates,
  fetchIndustryDataSources,
  fetchIndustryIncubationDetail,
  fetchIndustryIncubations,
  fetchLabDataSources,
  startBusinessSystemTemplateBuildJob,
  type LabBusinessSystemInstancePayload,
  type LabBusinessSystemTemplatePayload,
  type LabIndustryDataSourcePayload,
} from "../../../services/dataLab";
import type {
  DataSourceRecord,
  LabBusinessSystemInstanceRecord,
  LabBusinessSystemTemplateBuildJobRecord,
  LabBusinessSystemTemplateRecord,
  LabIndustryDataSourceRecord,
  LabIndustryIncubationRecord,
} from "../../../types/api";
import { isScenarioDatabaseSource, toScenarioDbType } from "../../../utils/datasource";

const TEMPLATE_STATUS_META: Record<string, { color: string; label: string }> = {
  draft: { color: "default", label: "草稿" },
  active: { color: "processing", label: "启用" },
  archived: { color: "gold", label: "归档" },
};

const INSTANCE_STATUS_META: Record<string, { color: string; label: string }> = {
  draft: { color: "default", label: "草稿" },
  active: { color: "processing", label: "启用" },
  archived: { color: "gold", label: "归档" },
};

const DATA_SOURCE_STATUS_META: Record<string, { color: string; label: string }> = {
  draft: { color: "default", label: "草稿" },
  active: { color: "processing", label: "启用" },
  archived: { color: "gold", label: "归档" },
};

const DATA_SOURCE_THEME_META: Record<string, { color: string; label: string }> = {
  user: { color: "blue", label: "用户身份" },
  merchant: { color: "green", label: "经营主体" },
  activity: { color: "purple", label: "业务活动" },
};

function renderStatus(value: string, metaMap: Record<string, { color: string; label: string }>) {
  const meta = metaMap[value] || { color: "default", label: value || "-" };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function renderCodeTags(values: string[]) {
  if (!Array.isArray(values) || values.length === 0) return "-";
  return (
    <Space size={[4, 4]} wrap>
      {values.map((item) => (
        <Tag key={item}>{item}</Tag>
      ))}
    </Space>
  );
}

function renderThemeTags(values: string[]) {
  if (!Array.isArray(values) || values.length === 0) return "-";
  return (
    <Space size={[4, 4]} wrap>
      {values.map((item) => {
        const meta = DATA_SOURCE_THEME_META[item] || { color: "default", label: item };
        return (
          <Tag color={meta.color} key={item}>
            {meta.label}
          </Tag>
        );
      })}
    </Space>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return String(value).replace("T", " ").replace(/\.\d+Z?$/, "");
}

function renderBuildJobStatus(status?: string | null) {
  if (status === "completed") return <Tag color="green">已完成</Tag>;
  if (status === "failed") return <Tag color="red">失败</Tag>;
  if (status === "running") return <Tag color="processing">分析中</Tag>;
  return <Tag color="gold">排队中</Tag>;
}

function normalizeCategoryOptions(record: LabIndustryIncubationRecord | null) {
  const researchCatalog =
    record?.standardAssets && typeof record.standardAssets === "object"
      ? (record.standardAssets as { researchCatalog?: { categoryTree?: Array<Record<string, unknown>> } }).researchCatalog
      : undefined;
  const categoryTree = Array.isArray(researchCatalog?.categoryTree) ? researchCatalog.categoryTree : [];
  return categoryTree
    .map((item) => ({
      label: String(item?.categoryName || item?.categoryCode || ""),
      value: String(item?.categoryCode || ""),
    }))
    .filter((item) => item.value);
}

export function ScenarioManagementWorkspacePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<LabBusinessSystemTemplateRecord[]>([]);
  const [instances, setInstances] = useState<LabBusinessSystemInstanceRecord[]>([]);
  const [dataSources, setDataSources] = useState<LabIndustryDataSourceRecord[]>([]);
  const [targetDataSources, setTargetDataSources] = useState<DataSourceRecord[]>([]);
  const [incubations, setIncubations] = useState<LabIndustryIncubationRecord[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [selectedIncubation, setSelectedIncubation] = useState<LabIndustryIncubationRecord | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingDataSources, setLoadingDataSources] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateBuildModalOpen, setTemplateBuildModalOpen] = useState(false);
  const [instanceModalOpen, setInstanceModalOpen] = useState(false);
  const [dataSourceModalOpen, setDataSourceModalOpen] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [creatingDataSource, setCreatingDataSource] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
  const [deletingInstanceId, setDeletingInstanceId] = useState<number | null>(null);
  const [deletingDataSourceId, setDeletingDataSourceId] = useState<number | null>(null);
  const [activeTemplateBuildJobId, setActiveTemplateBuildJobId] = useState<string | null>(null);
  const [activeTemplateBuildJob, setActiveTemplateBuildJob] = useState<LabBusinessSystemTemplateBuildJobRecord | null>(null);
  const [templateForm] = Form.useForm<LabBusinessSystemTemplatePayload>();
  const [instanceForm] = Form.useForm<LabBusinessSystemInstancePayload>();
  const [dataSourceForm] = Form.useForm<LabIndustryDataSourcePayload>();
  const selectedTemplateId = Form.useWatch("templateId", instanceForm);
  const selectedIndustryCode = Form.useWatch("industryCode", dataSourceForm);
  const selectedTargetDataSourceId = Form.useWatch("targetDataSourceId", instanceForm);

  async function loadTemplates() {
    if (!token) return;
    setLoadingTemplates(true);
    try {
      setTemplates((await fetchBusinessSystemTemplates(token)).data);
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function loadInstances() {
    if (!token) return;
    setLoadingInstances(true);
    try {
      setInstances((await fetchBusinessSystemInstances(token)).data);
    } finally {
      setLoadingInstances(false);
    }
  }

  async function loadDataSources() {
    if (!token) return;
    setLoadingDataSources(true);
    try {
      setDataSources((await fetchIndustryDataSources(token)).data);
    } finally {
      setLoadingDataSources(false);
    }
  }

  async function loadIncubations() {
    if (!token) return;
    setIncubations((await fetchIndustryIncubations(token)).data);
  }

  async function loadTargetDataSources() {
    if (!token) return;
    const response = await fetchLabDataSources(token, { includeConnectivity: true });
    setTargetDataSources(response.data.filter((item) => isScenarioDatabaseSource(item)));
  }

  useEffect(() => {
    if (!token) return;
    void Promise.all([loadTemplates(), loadInstances(), loadDataSources(), loadIncubations(), loadTargetDataSources()]);
  }, [token]);

  useEffect(() => {
    if (!token || !activeTemplateBuildJobId) {
      return undefined;
    }

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const response = await fetchBusinessSystemTemplateBuildJob(token, activeTemplateBuildJobId);
        if (cancelled) {
          return;
        }
        setActiveTemplateBuildJob(response.data);
        if (response.data.status === "completed") {
          setCreatingTemplate(false);
          void loadTemplates();
          message.success(`模板创建完成：${response.data.result?.templateName || response.data.templateName}`);
          if (response.data.result?.templateId) {
            navigate(`/dashboard/data-modeling/scenario-management/templates/${response.data.result.templateId}`);
          }
          return;
        }
        if (response.data.status === "failed") {
          setCreatingTemplate(false);
          message.error(response.data.errorMessage || "模板构建失败");
          return;
        }
        timer = window.setTimeout(() => {
          void poll();
        }, 1500);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setCreatingTemplate(false);
        message.error(error instanceof Error ? error.message : "获取模板构建进度失败");
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [token, activeTemplateBuildJobId, navigate]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === Number(selectedTemplateId)) || null,
    [selectedTemplateId, templates]
  );

  const industryOptions = useMemo(
    () =>
      Array.from(new Set(instances.map((item) => String(item.industryCode || "")).filter(Boolean))).map((item) => ({
        label: item,
        value: item,
      })),
    [instances]
  );

  const instanceOptions = useMemo(
    () =>
      instances
        .filter((item) => !selectedIndustryCode || item.industryCode === selectedIndustryCode)
        .map((item) => ({ label: `${item.instanceName} (${item.instanceCode})`, value: item.id })),
    [instances, selectedIndustryCode]
  );

  const targetDataSourceOptions = useMemo(
    () =>
      targetDataSources.map((item) => ({
        label: `${item.sourceName} (${item.sourceCode}) / ${String(item.sourceType || "").toUpperCase()}`,
        value: item.id,
      })),
    [targetDataSources]
  );

  const selectedTargetDataSource = useMemo(
    () => targetDataSources.find((item) => item.id === Number(selectedTargetDataSourceId || 0)) || null,
    [targetDataSources, selectedTargetDataSourceId]
  );

  async function handleIncubationChange(value?: number) {
    if (!token || !value) {
      setSelectedIncubation(null);
      setCategoryOptions([]);
      templateForm.setFieldsValue({ industryCode: undefined, sourceCategoryCodes: [] });
      return;
    }
    const response = await fetchIndustryIncubationDetail(token, value);
    setSelectedIncubation(response.data);
    setCategoryOptions(normalizeCategoryOptions(response.data));
    templateForm.setFieldsValue({ industryCode: response.data.industryCode, sourceCategoryCodes: [] });
  }

  async function submitTemplate(values: LabBusinessSystemTemplatePayload) {
    if (!token) return;
    try {
      setCreatingTemplate(true);
      const response = await startBusinessSystemTemplateBuildJob(token, values);
      message.success(`已提交模板构建任务：${response.data.templateName}`);
      setTemplateModalOpen(false);
      setTemplateBuildModalOpen(true);
      setActiveTemplateBuildJobId(response.data.id);
      setActiveTemplateBuildJob(response.data);
      templateForm.resetFields();
      setSelectedIncubation(null);
      setCategoryOptions([]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建模板失败");
    } finally {
      setCreatingTemplate(false);
    }
  }

  async function submitInstance(values: LabBusinessSystemInstancePayload) {
    if (!token) return;
    try {
      setCreatingInstance(true);
      const response = await createBusinessSystemInstance(token, {
        ...values,
        dbType: undefined,
      });
      message.success(`已创建实例：${response.data.instanceName}`);
      setInstanceModalOpen(false);
      instanceForm.resetFields();
      await loadInstances();
      navigate(`/dashboard/data-modeling/scenario-management/instances/${response.data.id}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建实例失败");
    } finally {
      setCreatingInstance(false);
    }
  }

  async function submitDataSource(values: LabIndustryDataSourcePayload) {
    if (!token) return;
    try {
      setCreatingDataSource(true);
      const response = await createIndustryDataSource(token, values);
      message.success(`已创建行业数据源：${response.data.dataSourceName}`);
      setDataSourceModalOpen(false);
      dataSourceForm.resetFields();
      await loadDataSources();
      navigate(`/dashboard/data-modeling/scenario-management/data-sources/${response.data.id}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建行业数据源失败");
    } finally {
      setCreatingDataSource(false);
    }
  }

  async function handleDeleteTemplate(record: LabBusinessSystemTemplateRecord) {
    if (!token) return;
    setDeletingTemplateId(record.id);
    try {
      const response = await deleteBusinessSystemTemplate(token, record.id);
      message.success(`已删除模板：${response.data.templateName}`);
      await loadTemplates();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除模板失败");
    } finally {
      setDeletingTemplateId(null);
    }
  }

  async function handleDeleteInstance(record: LabBusinessSystemInstanceRecord) {
    if (!token) return;
    setDeletingInstanceId(record.id);
    try {
      const response = await deleteBusinessSystemInstance(token, record.id);
      message.success(`已删除实例：${response.data.instanceName}`);
      await loadInstances();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除实例失败");
    } finally {
      setDeletingInstanceId(null);
    }
  }

  async function handleDeleteDataSource(record: LabIndustryDataSourceRecord) {
    if (!token) return;
    setDeletingDataSourceId(record.id);
    try {
      const response = await deleteIndustryDataSource(token, record.id);
      message.success(`已删除行业数据源：${response.data.dataSourceName}`);
      await loadDataSources();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除行业数据源失败");
    } finally {
      setDeletingDataSourceId(null);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(300px, 340px) minmax(0, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Card bordered={false}>
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <div>
                <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
                  场景管理工作台
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  入口按“模板沉淀、实例落库、行业联动”三段组织。左侧负责创建入口，右侧负责列表维护和详情跳转。
                </Typography.Paragraph>
              </div>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button type="primary" block onClick={() => setTemplateModalOpen(true)}>
                  新建业务系统模板
                </Button>
                <Button
                  type="primary"
                  ghost
                  block
                  disabled={templates.length === 0}
                  onClick={() => {
                    instanceForm.setFieldsValue({
                      instanceStatus: "draft",
                      targetDataSourceId: targetDataSources[0]?.id,
                    });
                    setInstanceModalOpen(true);
                  }}
                >
                  新建业务系统实例
                </Button>
                <Button
                  type="primary"
                  ghost
                  block
                  disabled={instances.length < 2}
                  onClick={() => {
                    dataSourceForm.setFieldsValue({
                      industryCode: industryOptions[0]?.value,
                      sourceStatus: "draft",
                      selectedThemes: ["user", "merchant", "activity"],
                      instanceIds: [],
                    });
                    setDataSourceModalOpen(true);
                  }}
                >
                  新建行业数据源
                </Button>
                <Button block onClick={() => navigate("/dashboard/data-modeling/scenes")}>
                  进入旧版场景
                </Button>
              </Space>
              <Alert
                type="info"
                showIcon
                message="使用建议"
                description="先沉淀模板，再创建实例并绑定目标数据源，最后用行业数据源把多个实例组织成联动视图。"
              />
            </Space>
          </Card>

          <Card bordered={false} title="当前概览">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <Card size="small">
                <Statistic title="模板数" value={templates.length} />
              </Card>
              <Card size="small">
                <Statistic title="实例数" value={instances.length} />
              </Card>
              <Card size="small">
                <Statistic title="行业数据源" value={dataSources.length} />
              </Card>
              <Card size="small">
                <Statistic title="可用目标库" value={targetDataSources.length} />
              </Card>
            </div>
          </Card>

          <Card bordered={false} title="功能入口">
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <Alert
                type="success"
                showIcon
                message="1. 业务系统模板"
                description="从行业孵化资产沉淀逻辑模型，形成可复用的业务蓝图。"
              />
              <Alert
                type="info"
                showIcon
                message="2. 业务系统实例"
                description="选择目标数据源后，把逻辑模型落成物理模型和数据方案。"
              />
              <Alert
                type="warning"
                showIcon
                message="3. 行业数据源"
                description="把多个实例组合成统一的行业数据联动视图。"
              />
            </Space>
          </Card>
        </Space>

        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Card bordered={false} title="业务系统模板">
            <Table
              rowKey="id"
              loading={loadingTemplates}
              dataSource={templates}
              pagination={{ pageSize: 8, size: "small" }}
              locale={{ emptyText: <Empty description="暂无模板" /> }}
              columns={[
                {
                  title: "模板名称",
                  width: 260,
                  render: (_: unknown, record: LabBusinessSystemTemplateRecord) => (
                    <Space direction="vertical" size={0}>
                      <Button
                        type="link"
                        style={{ padding: 0, height: "auto", fontWeight: 600, textAlign: "left" }}
                        onClick={() => navigate(`/dashboard/data-modeling/scenario-management/templates/${record.id}`)}
                      >
                        {record.templateName}
                      </Button>
                      <Typography.Text type="secondary">{record.templateCode}</Typography.Text>
                    </Space>
                  ),
                },
                { title: "行业编码", dataIndex: "industryCode", width: 140 },
                { title: "来源子类目", dataIndex: "sourceCategoryCodes", render: (value: string[]) => renderCodeTags(value) },
                { title: "逻辑表", dataIndex: "logicalTableCount", width: 90, align: "center" as const },
                { title: "字典", dataIndex: "dictionaryCount", width: 80, align: "center" as const },
                {
                  title: "状态",
                  dataIndex: "templateStatus",
                  width: 100,
                  render: (value: string) => renderStatus(value, TEMPLATE_STATUS_META),
                },
                { title: "更新时间", dataIndex: "updatedAt", width: 180, render: (value: string) => formatDateTime(value) },
                {
                  title: "操作",
                  width: 220,
                  render: (_: unknown, record: LabBusinessSystemTemplateRecord) => (
                    <Space>
                      <Button type="link" onClick={() => navigate(`/dashboard/data-modeling/scenario-management/templates/${record.id}`)}>
                        查看
                      </Button>
                      <Button
                        type="link"
                        onClick={() => {
                          instanceForm.setFieldsValue({
                            templateId: record.id,
                            instanceName: `${record.templateName}实例`,
                            instanceCode: `${record.templateCode}_instance`,
                            instanceStatus: "draft",
                            targetDataSourceId: targetDataSources[0]?.id,
                          });
                          setInstanceModalOpen(true);
                        }}
                      >
                        建实例
                      </Button>
                      <Popconfirm
                        title="确认删除这个模板？"
                        description="如果模板下还有实例，系统会阻止删除。"
                        onConfirm={() => void handleDeleteTemplate(record)}
                      >
                        <Button type="link" danger loading={deletingTemplateId === record.id}>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>

          <Card bordered={false} title="业务系统实例">
            <Table
              rowKey="id"
              loading={loadingInstances}
              dataSource={instances}
              pagination={{ pageSize: 8, size: "small" }}
              locale={{ emptyText: <Empty description="暂无实例" /> }}
              columns={[
                {
                  title: "实例名称",
                  width: 260,
                  render: (_: unknown, record: LabBusinessSystemInstanceRecord) => (
                    <Space direction="vertical" size={0}>
                      <Button
                        type="link"
                        style={{ padding: 0, height: "auto", fontWeight: 600, textAlign: "left" }}
                        onClick={() => navigate(`/dashboard/data-modeling/scenario-management/instances/${record.id}`)}
                      >
                        {record.instanceName}
                      </Button>
                      <Typography.Text type="secondary">{record.instanceCode}</Typography.Text>
                    </Space>
                  ),
                },
                { title: "模板", dataIndex: "templateName", width: 200 },
                {
                  title: "数据库",
                  dataIndex: "dbType",
                  width: 110,
                  render: (value: string) => String(value || "-").toUpperCase(),
                },
                {
                  title: "数据方案",
                  dataIndex: "currentGenerationVersion",
                  width: 100,
                  align: "center" as const,
                  render: (value?: number | null) => (value ? `V${value}` : "-"),
                },
                {
                  title: "脏数据",
                  dataIndex: "currentDirtyVersion",
                  width: 100,
                  align: "center" as const,
                  render: (value?: number | null) => (value ? `V${value}` : "-"),
                },
                {
                  title: "状态",
                  dataIndex: "instanceStatus",
                  width: 100,
                  render: (value: string) => renderStatus(value, INSTANCE_STATUS_META),
                },
                { title: "更新时间", dataIndex: "updatedAt", width: 180, render: (value: string) => formatDateTime(value) },
                {
                  title: "操作",
                  width: 200,
                  render: (_: unknown, record: LabBusinessSystemInstanceRecord) => (
                    <Space>
                      <Button type="link" onClick={() => navigate(`/dashboard/data-modeling/scenario-management/instances/${record.id}`)}>
                        查看详情
                      </Button>
                      <Popconfirm
                        title="确认删除这个实例？"
                        description="删除后会一并移除该实例的版本记录；如已被行业数据源装配，系统会阻止删除。"
                        onConfirm={() => void handleDeleteInstance(record)}
                      >
                        <Button type="link" danger loading={deletingInstanceId === record.id}>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>

          <Card bordered={false} title="行业数据源">
            <Table
              rowKey="id"
              loading={loadingDataSources}
              dataSource={dataSources}
              pagination={{ pageSize: 8, size: "small" }}
              locale={{ emptyText: <Empty description="暂无行业数据源" /> }}
              columns={[
                {
                  title: "数据源名称",
                  width: 260,
                  render: (_: unknown, record: LabIndustryDataSourceRecord) => (
                    <Space direction="vertical" size={0}>
                      <Button
                        type="link"
                        style={{ padding: 0, height: "auto", fontWeight: 600, textAlign: "left" }}
                        onClick={() => navigate(`/dashboard/data-modeling/scenario-management/data-sources/${record.id}`)}
                      >
                        {record.dataSourceName}
                      </Button>
                      <Typography.Text type="secondary">{record.dataSourceCode}</Typography.Text>
                    </Space>
                  ),
                },
                { title: "行业编码", dataIndex: "industryCode", width: 140 },
                { title: "共享主题", dataIndex: "selectedThemes", width: 220, render: (value: string[]) => renderThemeTags(value) },
                { title: "装配实例", dataIndex: "instanceCount", width: 100, align: "center" as const },
                {
                  title: "状态",
                  dataIndex: "sourceStatus",
                  width: 100,
                  render: (value: string) => renderStatus(value, DATA_SOURCE_STATUS_META),
                },
                { title: "更新时间", dataIndex: "updatedAt", width: 180, render: (value: string) => formatDateTime(value) },
                {
                  title: "操作",
                  width: 200,
                  render: (_: unknown, record: LabIndustryDataSourceRecord) => (
                    <Space>
                      <Button type="link" onClick={() => navigate(`/dashboard/data-modeling/scenario-management/data-sources/${record.id}`)}>
                        查看联动
                      </Button>
                      <Popconfirm
                        title="确认删除这个行业数据源？"
                        description="删除后会移除装配关系，但不会删除业务系统实例。"
                        onConfirm={() => void handleDeleteDataSource(record)}
                      >
                        <Button type="link" danger loading={deletingDataSourceId === record.id}>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Space>
      </div>

      <Modal
        title="新建业务系统模板"
        open={templateModalOpen}
        onCancel={() => {
          setTemplateModalOpen(false);
          templateForm.resetFields();
          setSelectedIncubation(null);
          setCategoryOptions([]);
        }}
        onOk={() => void templateForm.submit()}
        confirmLoading={creatingTemplate}
        width={720}
      >
        <Form
          form={templateForm}
          layout="vertical"
          initialValues={{ templateStatus: "draft", sourceCategoryCodes: [] }}
          onFinish={(values) => void submitTemplate(values)}
        >
          <Form.Item name="templateName" label="模板名称" rules={[{ required: true, message: "请输入模板名称" }]}>
            <Input placeholder="例如：畜牧管理业务系统模板" />
          </Form.Item>
          <Form.Item name="templateCode" label="模板编码">
            <Input placeholder="可不填，系统会自动生成" />
          </Form.Item>
          <Form.Item name="sourceIncubationId" label="关联行业孵化项目">
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="可选"
              options={incubations.map((item) => ({ label: `${item.incubationName} (${item.industryCode})`, value: item.id }))}
              onChange={(value) => void handleIncubationChange(value)}
            />
          </Form.Item>
          <Form.Item name="industryCode" label="行业编码">
            <Input placeholder="未关联孵化项目时可手工填写" />
          </Form.Item>
          <Form.Item name="sourceCategoryCodes" label="孵化子类目">
            <Select
              mode="multiple"
              allowClear
              disabled={!selectedIncubation}
              placeholder={selectedIncubation ? "选择一个或多个子类目" : "请先选择行业孵化项目"}
              options={categoryOptions}
            />
          </Form.Item>
          <Form.Item name="templateDesc" label="模板说明">
            <Input.TextArea rows={4} placeholder="描述该模板面向的业务场景、系统边界与目标" />
          </Form.Item>
          <Form.Item name="templateStatus" label="模板状态">
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
        title="AI 正在分析模板"
        open={templateBuildModalOpen}
        onCancel={() => setTemplateBuildModalOpen(false)}
        width={760}
        footer={[
          <Button key="close" onClick={() => setTemplateBuildModalOpen(false)}>
            {activeTemplateBuildJob?.status === "completed" ? "关闭" : "后台继续"}
          </Button>,
          activeTemplateBuildJob?.status === "completed" && activeTemplateBuildJob.result?.templateId ? (
            <Button
              key="view"
              type="primary"
              onClick={() => {
                setTemplateBuildModalOpen(false);
                navigate(`/dashboard/data-modeling/scenario-management/templates/${activeTemplateBuildJob.result?.templateId}`);
              }}
            >
              查看模板
            </Button>
          ) : null,
        ]}
      >
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Alert
            type={
              activeTemplateBuildJob?.status === "failed"
                ? "error"
                : activeTemplateBuildJob?.status === "completed"
                  ? "success"
                  : "info"
            }
            showIcon
            message={
              activeTemplateBuildJob?.status === "failed"
                ? "AI 分析失败"
                : activeTemplateBuildJob?.status === "completed"
                  ? "AI 分析完成"
                  : "AI 正在分批分析模板结构"
            }
            description={
              activeTemplateBuildJob
                ? `当前模板：${activeTemplateBuildJob.templateName}；状态：${activeTemplateBuildJob.currentStage || activeTemplateBuildJob.status}`
                : "任务已提交，正在等待 AI 返回结果。"
            }
          />

          <Card size="small">
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <Typography.Text strong>构建进度</Typography.Text>
                {renderBuildJobStatus(activeTemplateBuildJob?.status)}
              </div>
              <Progress
                percent={Math.max(0, Math.min(100, Number(activeTemplateBuildJob?.progressPercent || 0)))}
                status={
                  activeTemplateBuildJob?.status === "failed"
                    ? "exception"
                    : activeTemplateBuildJob?.status === "completed"
                      ? "success"
                      : "active"
                }
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                <Card size="small">
                  <Statistic title="当前阶段" value={activeTemplateBuildJob?.currentStage || "-"} />
                </Card>
                <Card size="small">
                  <Statistic title="日志条数" value={activeTemplateBuildJob?.logs?.length || 0} />
                </Card>
                <Card size="small">
                  <Statistic title="开始时间" value={formatDateTime(activeTemplateBuildJob?.createdAt)} />
                </Card>
              </div>
            </Space>
          </Card>

          {activeTemplateBuildJob?.errorMessage ? (
            <Alert type="error" showIcon message="错误信息" description={activeTemplateBuildJob.errorMessage} />
          ) : null}

          <Card size="small" title="分析日志">
            {activeTemplateBuildJob?.logs?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 360, overflowY: "auto" }}>
                {activeTemplateBuildJob.logs.map((log) => (
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
                        <Typography.Paragraph
                          type="secondary"
                          style={{ marginBottom: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                        >
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

      <Modal
        title="新建业务系统实例"
        open={instanceModalOpen}
        onCancel={() => {
          setInstanceModalOpen(false);
          instanceForm.resetFields();
        }}
        onOk={() => void instanceForm.submit()}
        confirmLoading={creatingInstance}
        width={640}
      >
        <Form
          form={instanceForm}
          layout="vertical"
          initialValues={{ instanceStatus: "draft", targetDataSourceId: targetDataSources[0]?.id }}
          onFinish={(values) => void submitInstance(values)}
        >
          <Form.Item name="templateId" label="来源模板" rules={[{ required: true, message: "请选择模板" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={templates.map((item) => ({ label: `${item.templateName} (${item.templateCode})`, value: item.id }))}
            />
          </Form.Item>
          {selectedTemplate ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`将基于模板“${selectedTemplate.templateName}”创建实例`}
              description={`当前模板逻辑版本 V${selectedTemplate.currentLogicalVersion || "-"}，包含 ${selectedTemplate.logicalTableCount || 0} 张逻辑表。`}
            />
          ) : null}
          <Form.Item name="instanceName" label="实例名称" rules={[{ required: true, message: "请输入实例名称" }]}>
            <Input placeholder="例如：畜牧管理测试实例" />
          </Form.Item>
          <Form.Item name="instanceCode" label="实例编码">
            <Input placeholder="可不填，系统会自动生成" />
          </Form.Item>
          <Form.Item name="targetDataSourceId" label="默认目标数据源">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="可选，后续也可以在实例详情页重新绑定"
              options={targetDataSourceOptions}
            />
          </Form.Item>
          {selectedTargetDataSource ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`默认部署目标：${selectedTargetDataSource.sourceName}`}
              description={`${String(selectedTargetDataSource.sourceType || "").toUpperCase()} / ${String(selectedTargetDataSource.connectionConfig?.host || "-")}:${String(selectedTargetDataSource.connectionConfig?.port || "-")} / ${String(selectedTargetDataSource.connectionConfig?.database || "-")}`}
            />
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Item label="数据库类型">
              <Input
                value={selectedTargetDataSource ? String(toScenarioDbType(selectedTargetDataSource) || "").toUpperCase() : ""}
                placeholder="自动识别"
                disabled
              />
            </Form.Item>
            <Form.Item name="instanceStatus" label="实例状态">
              <Select
                options={[
                  { label: "草稿", value: "draft" },
                  { label: "启用", value: "active" },
                  { label: "归档", value: "archived" },
                ]}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title="新建行业数据源"
        open={dataSourceModalOpen}
        onCancel={() => {
          setDataSourceModalOpen(false);
          dataSourceForm.resetFields();
        }}
        onOk={() => void dataSourceForm.submit()}
        confirmLoading={creatingDataSource}
        width={700}
      >
        <Form
          form={dataSourceForm}
          layout="vertical"
          initialValues={{ sourceStatus: "draft", selectedThemes: ["user", "merchant", "activity"], instanceIds: [] }}
          onFinish={(values) => void submitDataSource(values)}
        >
          <Form.Item name="dataSourceName" label="数据源名称" rules={[{ required: true, message: "请输入行业数据源名称" }]}>
            <Input placeholder="例如：畜牧行业联动数据源" />
          </Form.Item>
          <Form.Item name="dataSourceCode" label="数据源编码">
            <Input placeholder="可不填，系统会自动生成" />
          </Form.Item>
          <Form.Item name="industryCode" label="行业编码" rules={[{ required: true, message: "请选择行业编码" }]}>
            <Select showSearch optionFilterProp="label" options={industryOptions} />
          </Form.Item>
          <Form.Item name="selectedThemes" label="共享主题" rules={[{ required: true, message: "请至少选择一个共享主题" }]}>
            <Select
              mode="multiple"
              options={[
                { label: "用户身份", value: "user" },
                { label: "经营主体", value: "merchant" },
                { label: "业务活动", value: "activity" },
              ]}
            />
          </Form.Item>
          <Form.Item name="instanceIds" label="装配实例" rules={[{ required: true, message: "请至少选择两个业务系统实例" }]}>
            <Select mode="multiple" showSearch optionFilterProp="label" options={instanceOptions} />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="联动预览基于实例当前数据方案实时生成"
            description="还未生成数据方案的实例会保留装配关系，但会在详情页提示待补齐。"
          />
          <Form.Item name="dataSourceDesc" label="数据源说明">
            <Input.TextArea rows={4} placeholder="说明联动目标、共享实体范围和主题域" />
          </Form.Item>
          <Form.Item name="sourceStatus" label="数据源状态">
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
    </Space>
  );
}
