import {
  CloudServerOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Alert, Button, Col, Dropdown, Form, Input, Modal, Row, Select, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { StatusTag } from "../../components/ui/StatusTag";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  createModelProvider,
  deleteModelProvider,
  fetchModelProviders,
  testModelProviderConnection,
  updateModelProvider,
  type ModelProviderPayload,
  type ModelProviderTestPayload,
} from "../../services/modelProvider";
import type { ModelProviderRecord } from "../../types/api";
import { SystemPageLayout } from "./SystemPageLayout";

const providerTypeOptions = [
  { value: "openai", label: "OpenAI" },
  { value: "azure_openai", label: "Azure OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "qwen", label: "通义千问" },
  { value: "zhipu", label: "智谱 AI" },
  { value: "baidu", label: "百度千帆" },
  { value: "custom", label: "自定义兼容接口" },
];

const modelCategoryOptions = [
  { value: "chat", label: "对话模型" },
  { value: "embedding", label: "向量模型" },
  { value: "rerank", label: "重排模型" },
  { value: "vision", label: "多模态视觉" },
  { value: "speech", label: "语音模型" },
];

const defaultBaseUrlMap: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  azure_openai: "",
  anthropic: "https://api.anthropic.com",
  deepseek: "https://api.deepseek.com",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  zhipu: "https://open.bigmodel.cn/api/paas/v4",
  baidu: "",
  custom: "",
};

type TestFeedback = {
  type: "success" | "error";
  message: string;
  description?: string;
};

type ModelCatalogItem = NonNullable<ModelProviderRecord["modelCatalog"]>[number];

function maskApiKey(value: string) {
  if (!value) return "-";
  if (value.length <= 10) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 4)}********${value.slice(-4)}`;
}

function buildFallbackCatalog(record?: Partial<ModelProviderRecord> | null): ModelCatalogItem[] {
  if (record?.modelCatalog?.length) {
    return record.modelCatalog;
  }
  const modelName = String(record?.modelName || "").trim();
  const modelVersion = String(record?.modelVersion || record?.modelName || "").trim();
  if (!modelName && !modelVersion) {
    return [];
  }
  return [{
    name: modelName || modelVersion,
    label: modelName || modelVersion,
    versions: [{ value: modelVersion || modelName, label: modelVersion || modelName }],
  }];
}

function getModelNameOptions(catalog: ModelCatalogItem[]) {
  return catalog.map((item) => ({ value: item.name, label: item.label }));
}

function getModelVersionOptions(catalog: ModelCatalogItem[], modelName?: string) {
  const current = catalog.find((item) => item.name === modelName) || catalog[0];
  return (current?.versions || []).map((item) => ({ value: item.value, label: item.label }));
}

function isVersionSelectionRedundant(modelName?: string, versionOptions?: Array<{ value: string; label: string }>) {
  if (!modelName || !versionOptions?.length) {
    return false;
  }
  return versionOptions.length === 1 && versionOptions[0].value === modelName;
}

export function SystemModelProvidersPage() {
  const { token, user } = useAuth();
  const [records, setRecords] = useState<ModelProviderRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ModelProviderRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<TestFeedback | null>(null);
  const [remoteModelCatalog, setRemoteModelCatalog] = useState<ModelCatalogItem[]>([]);
  const [testedEndpoint, setTestedEndpoint] = useState("");
  const [form] = Form.useForm();
  const watchedModelName = Form.useWatch("modelName", form);

  const modelNameOptions = useMemo(() => getModelNameOptions(remoteModelCatalog), [remoteModelCatalog]);
  const modelVersionOptions = useMemo(() => getModelVersionOptions(remoteModelCatalog, watchedModelName), [remoteModelCatalog, watchedModelName]);
  const versionSelectionRedundant = useMemo(
    () => isVersionSelectionRedundant(watchedModelName, modelVersionOptions),
    [modelVersionOptions, watchedModelName]
  );

  const stats = useMemo(() => {
    const activeCount = records.filter((item) => item.status === "active").length;
    const chatCount = records.filter((item) => item.modelCategory === "chat").length;
    const providerCount = new Set(records.map((item) => item.providerType)).size;
    return [
      { title: "配置总数", value: records.length, description: "已维护的模型配置项", icon: <RobotOutlined /> },
      { title: "启用配置", value: activeCount, description: "当前可被业务调用", icon: <ThunderboltOutlined /> },
      { title: "厂商数量", value: providerCount, description: "接入的提供方类型", icon: <CloudServerOutlined /> },
      { title: "对话模型", value: chatCount, description: "默认对话场景配置", icon: <ReloadOutlined /> },
    ];
  }, [records]);

  async function loadData() {
    if (!token) return;
    const response = await fetchModelProviders(token);
    setRecords(response.data);
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  function resetTestState() {
    setTestFeedback(null);
    setRemoteModelCatalog([]);
    setTestedEndpoint("");
    form.setFieldValue("modelName", undefined);
    form.setFieldValue("modelVersion", undefined);
  }

  function closeModal() {
    setOpen(false);
    setEditingRecord(null);
    setTesting(false);
    setTestFeedback(null);
    setRemoteModelCatalog([]);
    setTestedEndpoint("");
    form.resetFields();
  }

  function openCreateModal() {
    setEditingRecord(null);
    setTestFeedback(null);
    setRemoteModelCatalog([]);
    setTestedEndpoint("");
    form.resetFields();
    form.setFieldsValue({
      providerType: "openai",
      modelCategory: "chat",
      status: "active",
      ownerName: user?.displayName || user?.username || "系统管理员",
      baseUrl: defaultBaseUrlMap.openai,
    });
    setOpen(true);
  }

  function openEditModal(record: ModelProviderRecord) {
    setEditingRecord(record);
    setTestFeedback(null);
    setRemoteModelCatalog(buildFallbackCatalog(record));
    setTestedEndpoint(record.baseUrl || "");
    const nextExtraConfig = { ...(record.extraConfig || {}) } as Record<string, unknown>;
    delete nextExtraConfig.modelCatalog;
    form.setFieldsValue({
      ...record,
      apiKey: "",
      extraConfigText: Object.keys(nextExtraConfig).length ? JSON.stringify(nextExtraConfig, null, 2) : "",
    });
    setOpen(true);
  }

  function normalizeConfigCode(input: string) {
    return String(input || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  function parseExtraConfig(rawValue: string) {
    if (!rawValue) return {};
    try {
      return JSON.parse(rawValue);
    } catch {
      message.error("扩展配置必须是合法 JSON");
      return null;
    }
  }

  function buildPayload(values: any): ModelProviderPayload | null {
    const extraConfig = parseExtraConfig(values.extraConfigText || "");
    if (extraConfig === null) return null;

    return {
      configName: values.configName,
      configCode: values.configCode,
      providerType: values.providerType,
      modelCategory: values.modelCategory,
      modelName: values.modelName,
      modelVersion: values.modelVersion,
      baseUrl: values.baseUrl || undefined,
      apiKey: values.apiKey || "",
      organizationId: values.organizationId || undefined,
      ownerName: values.ownerName,
      status: values.status,
      description: values.description || undefined,
      extraConfig: {
        ...extraConfig,
        modelCatalog: remoteModelCatalog,
      },
    };
  }

  async function handleTestConnection() {
    if (!token) return;
    setTestFeedback(null);

    try {
      if (!editingRecord && !String(form.getFieldValue("apiKey") || "").trim()) {
        message.warning("请先输入 API Key 再测试");
        return;
      }
      const values = await form.validateFields(["providerType", "modelCategory", "baseUrl"]);
      const extraConfig = parseExtraConfig(form.getFieldValue("extraConfigText") || "");
      if (extraConfig === null) return;

      const payload: ModelProviderTestPayload = {
        id: editingRecord?.id,
        providerType: values.providerType,
        modelCategory: values.modelCategory,
        baseUrl: values.baseUrl,
        apiKey: form.getFieldValue("apiKey") || undefined,
        organizationId: form.getFieldValue("organizationId") || undefined,
        extraConfig,
      };

      setTesting(true);
      const response = await testModelProviderConnection(token, payload);
      const nextCatalog = response.data.modelCatalog || [];
      const currentModelName = String(form.getFieldValue("modelName") || "");
      const matched = nextCatalog.find((item) => item.name === currentModelName) || nextCatalog[0];

      setRemoteModelCatalog(nextCatalog);
      setTestedEndpoint(response.data.checkedEndpoint);
      form.setFieldsValue({
        modelName: matched?.name || undefined,
        modelVersion: matched?.versions?.[0]?.value || undefined,
      });

      setTestFeedback({
        type: "success",
        message: "测试成功",
        description: `已连接远端并拉取 ${response.data.models?.length || 0} 个模型，接口 ${response.data.checkedEndpoint}`,
      });
      message.success("远端模型列表拉取成功");
    } catch (error: any) {
      if (error?.errorFields) {
        message.warning("请先补全接口地址和密钥后再测试");
        return;
      }

      setRemoteModelCatalog([]);
      setTestedEndpoint("");
      form.setFieldsValue({ modelName: undefined, modelVersion: undefined });
      setTestFeedback({
        type: "error",
        message: "测试失败",
        description: error.message || "未知错误",
      });
      message.error(`测试失败: ${error.message || "未知错误"}`);
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit() {
    if (!token) return;
    try {
      const values = await form.validateFields();
      const payload = buildPayload(values);
      if (!payload) return;

      setSubmitting(true);
      if (editingRecord) {
        await updateModelProvider(token, editingRecord.id, payload);
        message.success("模型配置已更新");
      } else {
        await createModelProvider(token, payload);
        message.success("模型配置已创建");
      }

      closeModal();
      await loadData();
    } catch (error: any) {
      if (error?.errorFields) {
        message.warning("请先补全必填项");
      } else {
        message.error(`${editingRecord ? "更新失败" : "创建失败"}: ${error.message || "未知错误"}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(record: ModelProviderRecord) {
    if (!token) return;
    try {
      await deleteModelProvider(token, record.id);
      message.success("模型配置已删除");
      await loadData();
    } catch (error: any) {
      message.error(`删除失败: ${error.message || "未知错误"}`);
    }
  }

  const columns: ColumnsType<ModelProviderRecord> = [
    { title: "配置名称", dataIndex: "configName", key: "configName", width: 180 },
    { title: "配置编码", dataIndex: "configCode", key: "configCode", width: 180 },
    {
      title: "厂商类型",
      dataIndex: "providerType",
      key: "providerType",
      width: 140,
      render: (value: string) => providerTypeOptions.find((item) => item.value === value)?.label || value,
    },
    {
      title: "模型类别",
      dataIndex: "modelCategory",
      key: "modelCategory",
      width: 140,
      render: (value: string) => modelCategoryOptions.find((item) => item.value === value)?.label || value,
    },
    { title: "模型名称", dataIndex: "modelName", key: "modelName", width: 180 },
    { title: "模型版本", dataIndex: "modelVersion", key: "modelVersion", width: 220, render: (value?: string | null) => value || "-" },
    {
      title: "API Key",
      dataIndex: "apiKey",
      key: "apiKey",
      width: 220,
      render: (value: string, record) => record.apiKeyMasked || maskApiKey(value),
    },
    { title: "负责人", dataIndex: "ownerName", key: "ownerName", width: 140 },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: string) => <StatusTag status={value} />,
    },
    { title: "更新时间", dataIndex: "updatedAt", key: "updatedAt", width: 180 },
    {
      title: "操作",
      key: "actions",
      width: 100,
      render: (_: unknown, record) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "edit", label: "编辑" },
              { type: "divider" },
              { key: "delete", label: "删除", danger: true },
            ],
            onClick: ({ key }) => {
              if (key === "edit") openEditModal(record);
              if (key === "delete") {
                Modal.confirm({
                  title: `确认删除配置“${record.configName}”？`,
                  content: "删除后相关业务配置将无法继续复用该模型。",
                  okText: "删除",
                  cancelText: "取消",
                  okButtonProps: { danger: true },
                  onOk: () => handleDelete(record),
                });
              }
            },
          }}
        >
          <Button icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <SystemPageLayout
        title="模型管理"
        description="统一维护模型提供方、接口地址、密钥与分类，让 AI 能力接入更可控、更清晰。"
        heroDescription="模型管理页遵循统一系统页规范，改为先测试连通并拉取远端模型列表，再从列表中选择模型名称，避免手填误差。"
        heroBadges={["先测后选", "远端模型列表选择", "删除收纳进更多菜单"]}
        stats={stats}
        activeTab="models"
        hideHero
        toolbarRight={
          <>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新建配置
            </Button>
          </>
        }
      >
        <Alert
          type="info"
          showIcon
          message="先测试，再选择模型名称"
          description="配置模型地址与 API Key 后，点击模型名称右侧的测试按钮，系统会去远端拉取模型列表，模型名称只能从远端返回的列表中选择。"
        />

        <DataTableCard<ModelProviderRecord>
          title="模型配置列表"
          tableProps={{
            rowKey: "id",
            columns,
            dataSource: records,
            pagination: { pageSize: 8, showSizeChanger: false },
            scroll: { x: 1500 },
          }}
        />
      </SystemPageLayout>

      <Modal
        open={open}
        title={editingRecord ? "编辑模型配置" : "新建模型配置"}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        destroyOnHidden
        width={900}
        footer={[
          <Button key="cancel" onClick={closeModal}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={() => void handleSubmit()} loading={submitting}>
            {editingRecord ? "保存" : "创建"}
          </Button>,
        ]}
      >
        <Form
          layout="vertical"
          form={form}
          autoComplete="off"
          onValuesChange={(changedValues) => {
            const shouldResetRemoteModels = ["providerType", "modelCategory", "baseUrl", "apiKey", "organizationId", "extraConfigText"]
              .some((field) => Object.prototype.hasOwnProperty.call(changedValues, field));

            if (shouldResetRemoteModels) {
              resetTestState();
            }

            if (changedValues.providerType) {
              form.setFieldValue("baseUrl", defaultBaseUrlMap[changedValues.providerType] || "");
            }

            if (Object.prototype.hasOwnProperty.call(changedValues, "modelName")) {
              const nextVersions = getModelVersionOptions(remoteModelCatalog, changedValues.modelName);
              form.setFieldValue("modelVersion", nextVersions[0]?.value);
            }
          }}
        >
          <input type="text" autoComplete="username" style={{ display: "none" }} />
          <input type="password" autoComplete="new-password" style={{ display: "none" }} />
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="configName" label="配置名称" rules={[{ required: true, message: "请输入配置名称" }]}>
                <Input placeholder="例如：GPT-5.4 生产对话模型" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="configCode" label="配置编码" rules={[{ required: true, message: "请输入配置编码" }]}>
                <Input
                  placeholder="例如：gpt_5_4_prod"
                  onChange={(event) => {
                    const normalized = normalizeConfigCode(event.target.value);
                    if (normalized !== event.target.value) {
                      form.setFieldValue("configCode", normalized);
                    }
                  }}
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item name="providerType" label="厂商类型" rules={[{ required: true, message: "请选择厂商类型" }]}>
                <Select options={providerTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="modelCategory" label="模型类别" rules={[{ required: true, message: "请选择模型类别" }]}>
                <Select options={modelCategoryOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
                <Select options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item name="baseUrl" label="接口地址" rules={[{ required: true, message: "请输入接口地址" }]}>
                <Input autoComplete="off" placeholder="例如：https://api.openai.com/v1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="organizationId" label="组织 ID / 租户标识">
                <Input autoComplete="new-password" placeholder="按厂商需要选填" />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                name="apiKey"
                label="API Key"
                rules={editingRecord ? undefined : [{ required: true, message: "请输入 API Key" }]}
                extra={editingRecord ? `已加密保存，当前展示为脱敏值 ${editingRecord.apiKeyMasked || editingRecord.apiKey || "-" }。留空表示不修改。` : "保存后只保留脱敏展示，后续编辑不会回显明文。"}
              >
                <Input.Password
                  autoComplete="new-password"
                  placeholder={editingRecord ? "留空表示沿用已保存密钥" : "请输入模型服务 API Key"}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Row gutter={12} align="bottom">
                <Col span={9}>
                  <Form.Item
                    name="modelName"
                    label="模型名称"
                    rules={[{ required: true, message: "请先测试并从远端列表中选择模型名称" }]}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      options={modelNameOptions}
                      placeholder="请先测试并选择模型名称"
                      notFoundContent="暂无模型，请先点击右侧测试按钮"
                      disabled={!modelNameOptions.length}
                    />
                  </Form.Item>
                </Col>
                <Col span={9}>
                  <Form.Item
                    name="modelVersion"
                    label="模型版本"
                    rules={[{ required: true, message: "请选择模型版本" }]}
                    extra={versionSelectionRedundant ? "当前接口未区分独立版本，已自动使用模型名称作为版本标识。" : undefined}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      options={modelVersionOptions}
                      placeholder="选择模型名称后自动加载版本"
                      notFoundContent="暂无版本"
                      disabled={!modelVersionOptions.length || versionSelectionRedundant}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label=" ">
                    <Button block icon={<SearchOutlined />} loading={testing} onClick={() => void handleTestConnection()}>
                      测试
                    </Button>
                  </Form.Item>
                </Col>
              </Row>
              {testedEndpoint ? (
                <div style={{ marginTop: -18, marginBottom: 8, color: "#667085", fontSize: 12 }}>
                  已拉取接口：{testedEndpoint}
                </div>
              ) : null}
            </Col>

            <Col span={12}>
              <Form.Item name="ownerName" label="负责人" rules={[{ required: true, message: "请输入负责人" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="description" label="说明">
                <Input placeholder="例如：知识问答 / 对话生成 / 结构化抽取" />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                name="extraConfigText"
                label="扩展配置 JSON"
                extra="请输入合法 JSON，可按厂商要求补充扩展配置"
              >
                <Input.TextArea
                  rows={6}
                  placeholder='{"apiVersion":"2024-10-21"}'
                />
              </Form.Item>
            </Col>
          </Row>

          {testFeedback ? <Alert type={testFeedback.type} showIcon message={testFeedback.message} description={testFeedback.description} /> : null}
        </Form>
      </Modal>
    </>
  );
}
