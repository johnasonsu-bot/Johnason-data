import { Alert, Button, Card, Drawer, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchModelProviders } from "../../services/modelProvider";
import { fetchQualityAiConfigs, fetchQualityAiConfigVersions, updateQualityAiConfig, type QualityAiConfigPayload } from "../../services/qualityControl";
import type { ModelProviderRecord, QualityAiConfigRecord, QualityAiConfigVersionRecord } from "../../types/api";

const SCENE_LABELS: Record<string, string> = {
  quality_strategy_recommendation: "策略推荐",
  quality_regex_rule_analysis: "合规规则智能解析",
  quality_dictionary_analysis: "业务字典表解析",
  quality_analysis_report: "质量分析与报告",
  quality_issue_assistant: "问题研判与整改建议",
  quality_ops_robot: "质量运营机器人",
};

function buildProviderModelNameOptions(provider?: ModelProviderRecord | null) {
  return (provider?.modelCatalog || []).map((item) => ({ label: item.label, value: item.name }));
}

function buildProviderModelVersionOptions(provider?: ModelProviderRecord | null, modelName?: string) {
  const currentModel = (provider?.modelCatalog || []).find((item) => item.name === modelName) || provider?.modelCatalog?.[0];
  return (currentModel?.versions || []).map((item) => ({ label: item.label, value: item.value }));
}

function isVersionSelectionRedundant(modelName?: string, versionOptions?: Array<{ label: string; value: string }>) {
  if (!modelName || !versionOptions?.length) return false;
  return versionOptions.length === 1 && versionOptions[0].value === modelName;
}

function getSceneLabel(record: QualityAiConfigRecord) {
  return SCENE_LABELS[String(record.sceneCode || "")] || record.sceneName || record.sceneCode;
}

type ReasoningProviderFamily = "deepseek" | "openai" | "qwen" | null;

function resolveReasoningProviderFamily(provider?: ModelProviderRecord | null): ReasoningProviderFamily {
  if (!provider) return null;
  const providerType = String(provider.providerType || "").toLowerCase();
  const identity = [provider.baseUrl, provider.modelName, provider.modelVersion, provider.configName, provider.configCode]
    .map((item) => String(item || "").toLowerCase())
    .join(" ");
  if (providerType === "deepseek" || identity.includes("deepseek")) return "deepseek";
  if (providerType === "qwen" || identity.includes("qwen") || identity.includes("dashscope")) return "qwen";
  if (providerType === "openai" || providerType === "azure_openai" || identity.includes("openai") || /\b(gpt|o1|o3|o4)[-_a-z0-9.]*/i.test(identity)) return "openai";
  return null;
}

function getDefaultReasoningEffort(family: ReasoningProviderFamily) {
  return family === "deepseek" ? "high" : "medium";
}

function getReasoningEffortOptions(family: ReasoningProviderFamily) {
  if (family === "deepseek") {
    return [
      { value: "low", label: "低" },
      { value: "high", label: "高" },
      { value: "max", label: "最大" },
    ];
  }
  return [
    { value: "low", label: "低" },
    { value: "medium", label: "中" },
    { value: "high", label: "高" },
    { value: "xhigh", label: "超高" },
    { value: "max", label: "最大" },
  ];
}

export function QualityControlModelManagementPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<QualityAiConfigRecord[]>([]);
  const [modelProviders, setModelProviders] = useState<ModelProviderRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<QualityAiConfigRecord | null>(null);
  const [versionRows, setVersionRows] = useState<QualityAiConfigVersionRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const watchedProviderId = Form.useWatch("defaultModelProviderId", form);
  const watchedModelName = Form.useWatch("defaultModelName", form);
  const watchedThinkingEnabled = Form.useWatch("thinkingEnabled", form);

  const modelOptions = useMemo(
    () => modelProviders
      .filter((item) => item.status === "active" && item.modelCategory === "chat")
      .map((item) => ({ label: `${item.configName} / ${item.modelName}`, value: item.id })),
    [modelProviders]
  );

  const selectedProvider = useMemo(
    () => modelProviders.find((item) => item.id === Number(watchedProviderId)) || null,
    [modelProviders, watchedProviderId]
  );
  const reasoningProviderFamily = useMemo(
    () => resolveReasoningProviderFamily(selectedProvider ? { ...selectedProvider, modelName: watchedModelName || selectedProvider.modelName } : null),
    [selectedProvider, watchedModelName]
  );

  const modelNameOptions = useMemo(() => buildProviderModelNameOptions(selectedProvider), [selectedProvider]);
  const modelVersionOptions = useMemo(() => buildProviderModelVersionOptions(selectedProvider, watchedModelName), [selectedProvider, watchedModelName]);
  const versionSelectionRedundant = useMemo(() => isVersionSelectionRedundant(watchedModelName, modelVersionOptions), [modelVersionOptions, watchedModelName]);

  async function loadData() {
    if (!token) return;
    const [configResponse, modelResponse] = await Promise.all([
      fetchQualityAiConfigs(token),
      fetchModelProviders(token),
    ]);
    setRecords(configResponse.data || []);
    setModelProviders(modelResponse.data || []);
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  function closeModal() {
    setOpen(false);
    setEditingRecord(null);
    form.resetFields();
  }

  function openEditModal(record: QualityAiConfigRecord) {
    const provider = modelProviders.find((item) => item.id === Number(record.defaultModelProviderId)) || null;
    const family = resolveReasoningProviderFamily(provider ? { ...provider, modelName: record.defaultModelName || provider.modelName } : null);
    setEditingRecord(record);
    form.setFieldsValue({
      sceneName: getSceneLabel(record),
      sceneCode: record.sceneCode,
      defaultModelProviderId: record.defaultModelProviderId || null,
      defaultModelName: record.defaultModelName || undefined,
      defaultModelVersion: record.defaultModelVersion || undefined,
      temperature: record.temperature ?? undefined,
      maxTokens: record.maxTokens ?? undefined,
      timeoutMs: record.timeoutMs ?? undefined,
      thinkingEnabled: Boolean(record.thinkingEnabled),
      reasoningEffort: record.reasoningEffort || getDefaultReasoningEffort(family),
      thinkingBudget: record.thinkingBudget ?? undefined,
      systemPrompt: record.systemPrompt || "",
    });
    setOpen(true);
  }

  async function openVersionDrawer(record: QualityAiConfigRecord) {
    if (!token) return;
    const response = await fetchQualityAiConfigVersions(token, record.id);
    setVersionRows(response.data || []);
    setEditingRecord(record);
    setVersionOpen(true);
  }

  async function handleSubmit() {
    if (!token || !editingRecord) return;
    const values = await form.validateFields();
    const payload: QualityAiConfigPayload = {
      defaultModelProviderId: values.defaultModelProviderId || null,
      defaultModelName: values.defaultModelName || null,
      defaultModelVersion: values.defaultModelVersion || null,
      temperature: values.temperature ?? null,
      maxTokens: values.maxTokens ?? null,
      timeoutMs: values.timeoutMs ?? null,
      thinkingEnabled: Boolean(values.thinkingEnabled),
      reasoningEffort: values.thinkingEnabled && reasoningProviderFamily !== "qwen" ? values.reasoningEffort || null : null,
      thinkingBudget: values.thinkingEnabled && reasoningProviderFamily === "qwen" ? values.thinkingBudget ?? null : null,
      systemPrompt: values.systemPrompt || undefined,
    };

    setSubmitting(true);
    try {
      await updateQualityAiConfig(token, editingRecord.id, payload);
      message.success("质量策略模型配置已更新");
      closeModal();
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Quality"
        title="模型管理"
        description="统一维护质量策略、分析报告、问题研判和运营机器人的模型、参数与提示词；业务统计始终由系统确定性计算。"
      />

      <div className="app-page-body">
        <Card variant="borderless" styles={{ body: { padding: 20 } }}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Table
              rowKey="id"
              dataSource={records}
              pagination={false}
              columns={[
                {
                  title: "AI类型",
                  key: "sceneName",
                  width: 180,
                  render: (_value, record) => getSceneLabel(record),
                },
                { title: "场景编码", dataIndex: "sceneCode", key: "sceneCode", width: 220 },
                {
                  title: "默认模型",
                  key: "defaultModel",
                  width: 320,
                  render: (_value, record) => record.defaultModelProviderName
                    ? `${record.defaultModelProviderName} / ${record.defaultModelName || "-"} / ${record.defaultModelVersion || "-"}`
                    : "未配置",
                },
                {
                  title: "深度思考",
                  key: "thinking",
                  width: 130,
                  render: (_value, record) => record.thinkingEnabled
                    ? <Tag color="blue">开启{record.reasoningEffort ? ` · ${record.reasoningEffort}` : ""}</Tag>
                    : <Tag>关闭</Tag>,
                },
                {
                  title: "场景系统提示词",
                  dataIndex: "systemPrompt",
                  key: "systemPrompt",
                  ellipsis: true,
                  render: (value?: string | null) => value || "-",
                },
                {
                  title: "状态",
                  dataIndex: "status",
                  key: "status",
                  width: 100,
                  render: (value: string) => <Tag color={value === "active" ? "green" : "default"}>{value === "active" ? "启用" : "停用"}</Tag>,
                },
                {
                  title: "操作",
                  key: "actions",
                  width: 180,
                  render: (_value, record) => (
                    <Space size={12} split={<span style={{ color: "#d9d9d9" }}>|</span>}>
                      <Button type="text" size="small" onClick={() => openEditModal(record)}>编辑</Button>
                      <Button type="text" size="small" onClick={() => void openVersionDrawer(record)}>版本</Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Space>
        </Card>
      </div>

      <Modal open={open} title="编辑质量模型场景配置" onCancel={closeModal} onOk={() => void handleSubmit()} confirmLoading={submitting} width={760}>
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changedValues) => {
            if (Object.prototype.hasOwnProperty.call(changedValues, "defaultModelProviderId")) {
              const provider = modelProviders.find((item) => item.id === Number(changedValues.defaultModelProviderId));
              const firstModel = provider?.modelCatalog?.[0];
              const family = resolveReasoningProviderFamily(provider);
              form.setFieldsValue({
                defaultModelName: firstModel?.name,
                defaultModelVersion: firstModel?.versions?.[0]?.value,
                thinkingEnabled: false,
                reasoningEffort: getDefaultReasoningEffort(family),
                thinkingBudget: undefined,
              });
            }
            if (Object.prototype.hasOwnProperty.call(changedValues, "defaultModelName")) {
              const provider = modelProviders.find((item) => item.id === Number(form.getFieldValue("defaultModelProviderId")));
              const currentModel = (provider?.modelCatalog || []).find((item) => item.name === changedValues.defaultModelName);
              const family = resolveReasoningProviderFamily(provider ? { ...provider, modelName: changedValues.defaultModelName } : null);
              form.setFieldsValue({
                defaultModelVersion: currentModel?.versions?.[0]?.value,
                thinkingEnabled: false,
                reasoningEffort: getDefaultReasoningEffort(family),
                thinkingBudget: undefined,
              });
            }
          }}
        >
          <Form.Item name="sceneName" label="AI类型">
            <Input disabled />
          </Form.Item>
          <Form.Item name="sceneCode" label="场景编码">
            <Input disabled />
          </Form.Item>
          <Form.Item name="defaultModelProviderId" label="默认模型">
            <Select allowClear placeholder="请选择默认对话模型" options={modelOptions} />
          </Form.Item>
          <Form.Item name="defaultModelName" label="模型名称">
            <Select allowClear placeholder="选择模型名称" options={modelNameOptions} disabled={!selectedProvider} />
          </Form.Item>
          <Form.Item name="defaultModelVersion" label="模型版本">
            <Select
              allowClear
              placeholder={versionSelectionRedundant ? "当前模型未区分独立版本" : "请选择模型版本"}
              options={modelVersionOptions}
              disabled={!modelVersionOptions.length || versionSelectionRedundant}
            />
          </Form.Item>
          {versionSelectionRedundant ? (
            <Typography.Text type="secondary" style={{ marginTop: -12, display: "block" }}>
              当前 Provider 未区分独立版本，系统会默认使用模型名称作为版本标识。
            </Typography.Text>
          ) : null}
          <Form.Item name="temperature" label="Temperature">
            <InputNumber min={0} max={2} step={0.1} style={{ width: "100%" }} placeholder="0.1" />
          </Form.Item>
          <Form.Item name="maxTokens" label="Max Tokens">
            <InputNumber min={1} max={32000} style={{ width: "100%" }} placeholder="2400" />
          </Form.Item>
          <Form.Item name="timeoutMs" label="Timeout(ms)">
            <InputNumber min={1000} max={7200000} style={{ width: "100%" }} placeholder="90000" />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="深度思考参数会按模型厂商自动转换"
            description="DeepSeek 使用 thinking.type 与 reasoning_effort；OpenAI/GPT 使用 reasoning_effort（Responses 接口自动转换为 reasoning.effort）；通义千问使用 enable_thinking，并可设置 thinking_budget。开启后通常会增加响应时间和 Token 消耗。"
          />
          <Form.Item
            name="thinkingEnabled"
            label="开启深度思考"
            valuePropName="checked"
            extra={reasoningProviderFamily
              ? "关闭时会向支持切换的模型发送对应的关闭参数，避免模型只返回思考过程而没有最终答案。"
              : "当前模型厂商或兼容网关暂未被自动识别，不会发送未经确认的思考参数。"}
          >
            <Switch
              checkedChildren="已开启"
              unCheckedChildren="已关闭"
              disabled={!reasoningProviderFamily}
            />
          </Form.Item>
          {watchedThinkingEnabled && reasoningProviderFamily && reasoningProviderFamily !== "qwen" ? (
            <Form.Item name="reasoningEffort" label="思考强度" rules={[{ required: true, message: "请选择思考强度" }]}>
              <Select options={getReasoningEffortOptions(reasoningProviderFamily)} />
            </Form.Item>
          ) : null}
          {watchedThinkingEnabled && reasoningProviderFamily === "qwen" ? (
            <Form.Item
              name="thinkingBudget"
              label="思考预算（Tokens）"
              extra="选填。不同千问模型支持的上限不同；留空时由模型使用自身默认思考长度。"
            >
              <InputNumber min={1} style={{ width: "100%" }} placeholder="使用模型默认值" />
            </Form.Item>
          ) : null}
          <Form.Item name="systemPrompt" label="策略推荐系统提示词（统一维护）" extra="用于字段业务语义识别、规则资产选择和候选生成；已生成的推荐结果不会受影响。">
            <Input.TextArea rows={14} placeholder="请输入质量策略推荐场景默认使用的系统提示词" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        open={versionOpen}
        title={`质量提示词版本${editingRecord ? ` / ${getSceneLabel(editingRecord)}` : ""}`}
        onClose={() => setVersionOpen(false)}
        width={920}
      >
        <Table
          rowKey="id"
          dataSource={versionRows}
          pagination={false}
          columns={[
            { title: "版本号", dataIndex: "versionNo", width: 90 },
            { title: "版本状态", dataIndex: "versionStatus", width: 110, render: (value: string) => <Tag color={value === "published" ? "green" : "gold"}>{value}</Tag> },
            {
              title: "默认模型",
              width: 260,
              render: (_value, record: QualityAiConfigVersionRecord) => record.defaultModelProviderName
                ? `${record.defaultModelProviderName} / ${record.defaultModelName || "-"} / ${record.defaultModelVersion || "-"}`
                : "未配置",
            },
            {
              title: "运行参数",
              width: 280,
              render: (_value, record: QualityAiConfigVersionRecord) => [
                `T=${record.temperature ?? "-"}`,
                `Max=${record.maxTokens ?? "-"}`,
                `Timeout=${record.timeoutMs ?? "-"}`,
                record.thinkingEnabled
                  ? `深度思考=开启${record.reasoningEffort ? `(${record.reasoningEffort})` : ""}${record.thinkingBudget ? ` / Budget=${record.thinkingBudget}` : ""}`
                  : "深度思考=关闭",
              ].join(" / "),
            },
            { title: "创建人", dataIndex: "createdBy", width: 120 },
            { title: "发布时间", dataIndex: "publishedAt", width: 170, render: (value?: string | null) => value || "-" },
            { title: "创建时间", dataIndex: "createdAt", width: 170 },
          ]}
          expandable={{
            expandedRowRender: (record) => (
              <Card size="small" title="系统提示词">
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 320, overflow: "auto" }}>
                  {record.systemPrompt || "-"}
                </pre>
              </Card>
            ),
          }}
        />
      </Drawer>
    </div>
  );
}
