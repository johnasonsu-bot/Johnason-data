import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchModelProviders } from "../../services/modelProvider";
import { fetchReportingAiConfigs, updateReportingAiConfig, type ReportingAiConfigPayload } from "../../services/reportingAiConfig";
import type { ModelProviderRecord, ReportingAiConfigRecord } from "../../types/api";

const SCENE_LABELS: Record<string, string> = {
  chart_analysis_suggestion: "数据分析需求建议",
  chart_sql_plan: "自然语言生成查询 SQL",
  chart_sql_revision: "二次修改查询 SQL",
  chart_recommendation: "查询结果推荐图表",
  chart_field_mapping: "图表字段智能映射",
};

const PROMPT_VARIABLES: Record<string, Array<{ name: string; description: string }>> = {
  chart_analysis_suggestion: [
    { name: "${datasource}", description: "当前报表数据源、类型和方言" },
    { name: "${tables}", description: "候选表与字段结构" },
    { name: "${tableSamples}", description: "候选表随机样例数据" },
    { name: "${analysisDirection}", description: "用户输入的分析方向" },
    { name: "${dialect}", description: "数据库 SQL 方言" },
    { name: "${sceneCode}", description: "当前 AI 场景编码" },
  ],
  chart_sql_plan: [
    { name: "${datasource}", description: "当前报表数据源、类型和方言" },
    { name: "${tables}", description: "候选表与字段结构" },
    { name: "${tableSamples}", description: "候选表随机样例数据" },
    { name: "${prompt}", description: "用户输入的报表需求" },
    { name: "${currentSql}", description: "用户当前已有 SQL" },
    { name: "${dialect}", description: "数据库 SQL 方言" },
    { name: "${sceneCode}", description: "当前 AI 场景编码" },
  ],
  chart_sql_revision: [
    { name: "${datasource}", description: "当前报表数据源、类型和方言" },
    { name: "${tables}", description: "候选表与字段结构" },
    { name: "${tableSamples}", description: "候选表随机样例数据" },
    { name: "${prompt}", description: "用户原始报表需求" },
    { name: "${currentSql}", description: "用户当前 SQL" },
    { name: "${revisionInstruction}", description: "本次修改要求" },
    { name: "${lastQueryProfile}", description: "上次查询结果画像" },
    { name: "${lastError}", description: "上次执行错误" },
    { name: "${dialect}", description: "数据库 SQL 方言" },
    { name: "${sceneCode}", description: "当前 AI 场景编码" },
  ],
  chart_recommendation: [
    { name: "${profile}", description: "查询结果字段画像" },
    { name: "${sampleRows}", description: "查询样例数据" },
    { name: "${fallbackRecommendations}", description: "规则引擎候选推荐" },
    { name: "${prompt}", description: "用户原始分析需求" },
    { name: "${supportedChartFamilies}", description: "平台支持的图表族" },
    { name: "${sceneCode}", description: "当前 AI 场景编码" },
  ],
  chart_field_mapping: [
    { name: "${profile}", description: "查询结果字段画像" },
    { name: "${sampleRows}", description: "查询样例数据" },
    { name: "${chartAsset}", description: "目标图表资产与映射要求" },
    { name: "${currentFieldMap}", description: "当前默认字段映射" },
    { name: "${prompt}", description: "用户原始分析需求" },
    { name: "${sceneCode}", description: "当前 AI 场景编码" },
  ],
};

function buildProviderModelNameOptions(provider?: ModelProviderRecord | null) {
  return (provider?.modelCatalog || []).map((item) => ({ label: item.label, value: item.name }));
}

function buildProviderModelVersionOptions(provider?: ModelProviderRecord | null, modelName?: string) {
  const currentModel = (provider?.modelCatalog || []).find((item) => item.name === modelName)
    || provider?.modelCatalog?.[0];
  return (currentModel?.versions || []).map((item) => ({ label: item.label, value: item.value }));
}

function isVersionSelectionRedundant(modelName?: string, versionOptions?: Array<{ label: string; value: string }>) {
  if (!modelName || !versionOptions?.length) return false;
  return versionOptions.length === 1 && versionOptions[0].value === modelName;
}

function getSceneLabel(record: ReportingAiConfigRecord) {
  return SCENE_LABELS[String(record.sceneCode || "")] || record.sceneName || record.sceneCode;
}

function stringifySchema(value?: Record<string, unknown>) {
  return JSON.stringify(value || {}, null, 2);
}

export function ReportingModelManagementPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<ReportingAiConfigRecord[]>([]);
  const [modelProviders, setModelProviders] = useState<ModelProviderRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ReportingAiConfigRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const watchedProviderId = Form.useWatch("defaultModelProviderId", form);
  const watchedModelName = Form.useWatch("defaultModelName", form);

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

  const modelNameOptions = useMemo(
    () => buildProviderModelNameOptions(selectedProvider),
    [selectedProvider]
  );

  const modelVersionOptions = useMemo(
    () => buildProviderModelVersionOptions(selectedProvider, watchedModelName),
    [selectedProvider, watchedModelName]
  );

  const versionSelectionRedundant = useMemo(
    () => isVersionSelectionRedundant(watchedModelName, modelVersionOptions),
    [modelVersionOptions, watchedModelName]
  );

  const promptVariables = useMemo(
    () => PROMPT_VARIABLES[String(editingRecord?.sceneCode || "")] || [],
    [editingRecord?.sceneCode]
  );

  async function loadData() {
    if (!token) return;
    const [configResponse, modelResponse] = await Promise.all([
      fetchReportingAiConfigs(token),
      fetchModelProviders(token),
    ]);
    setRecords((configResponse.data || []).filter((item) =>
      ["chart_analysis_suggestion", "chart_sql_plan", "chart_sql_revision", "chart_recommendation", "chart_field_mapping"].includes(String(item.sceneCode || ""))
    ));
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

  function openEditModal(record: ReportingAiConfigRecord) {
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
      inputSchemaText: stringifySchema(record.inputSchema),
      systemPrompt: record.systemPrompt || "",
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!token || !editingRecord) return;
    const values = await form.validateFields();
    let inputSchema: Record<string, unknown> = {};
    try {
      inputSchema = JSON.parse(values.inputSchemaText || "{}");
      if (!inputSchema || typeof inputSchema !== "object" || Array.isArray(inputSchema)) {
        throw new Error("入参 Schema 必须是 JSON 对象");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "入参 Schema 不是有效 JSON");
      return;
    }

    const payload: ReportingAiConfigPayload = {
      sceneName: editingRecord.sceneName,
      sceneCode: editingRecord.sceneCode,
      defaultModelProviderId: values.defaultModelProviderId || null,
      defaultModelName: values.defaultModelName || null,
      defaultModelVersion: values.defaultModelVersion || null,
      temperature: values.temperature ?? null,
      maxTokens: values.maxTokens ?? null,
      timeoutMs: values.timeoutMs ?? null,
      inputSchema,
      systemPrompt: values.systemPrompt || undefined,
      description: editingRecord.description,
      ownerName: editingRecord.ownerName,
      status: editingRecord.status,
    };

    setSubmitting(true);
    try {
      await updateReportingAiConfig(token, editingRecord.id, payload);
      message.success("报表模型配置已更新");
      closeModal();
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Space direction="vertical" size={24} style={{ display: "flex" }}>
      <Card bordered={false} styles={{ body: { padding: 20 } }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Table
            rowKey="id"
            dataSource={records}
            pagination={false}
            columns={[
              {
                title: "AI 类型",
                key: "sceneName",
                width: 220,
                render: (_value, record) => getSceneLabel(record),
              },
              { title: "场景编码", dataIndex: "sceneCode", key: "sceneCode", width: 220 },
              {
                title: "默认模型",
                key: "defaultModel",
                width: 360,
                render: (_value, record) => record.defaultModelProviderName
                  ? `${record.defaultModelProviderName} / ${record.defaultModelName || "-"} / ${record.defaultModelVersion || "-"}`
                  : "未配置",
              },
              {
                title: "参数",
                key: "params",
                width: 260,
                render: (_value, record) => [
                  `Temp: ${record.temperature ?? "-"}`,
                  `Tokens: ${record.maxTokens ?? "-"}`,
                  `Timeout: ${record.timeoutMs ?? "-"}`,
                ].join(" / "),
              },
              {
                title: "入参",
                key: "inputSchema",
                width: 220,
                ellipsis: true,
                render: (_value, record) => Object.keys(record.inputSchema || {}).join(" / ") || "-",
              },
              {
                title: "系统提示词",
                dataIndex: "systemPrompt",
                key: "systemPrompt",
                ellipsis: true,
                render: (value?: string) => value || "-",
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
                width: 100,
                render: (_value, record) => <Button type="text" size="small" onClick={() => openEditModal(record)}>编辑</Button>,
              },
            ]}
          />
        </Space>
      </Card>

      <Modal open={open} title="编辑报表模型配置" onCancel={closeModal} onOk={() => void handleSubmit()} confirmLoading={submitting} width={820}>
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changedValues) => {
            if (Object.prototype.hasOwnProperty.call(changedValues, "defaultModelProviderId")) {
              const provider = modelProviders.find((item) => item.id === Number(changedValues.defaultModelProviderId));
              const firstModel = provider?.modelCatalog?.[0];
              form.setFieldsValue({
                defaultModelName: firstModel?.name,
                defaultModelVersion: firstModel?.versions?.[0]?.value,
              });
            }
            if (Object.prototype.hasOwnProperty.call(changedValues, "defaultModelName")) {
              const provider = modelProviders.find((item) => item.id === Number(form.getFieldValue("defaultModelProviderId")));
              const currentModel = (provider?.modelCatalog || []).find((item) => item.name === changedValues.defaultModelName);
              form.setFieldValue("defaultModelVersion", currentModel?.versions?.[0]?.value);
            }
          }}
        >
          <Form.Item name="sceneName" label="AI 类型">
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
            <InputNumber min={1} max={32000} style={{ width: "100%" }} placeholder="1800" />
          </Form.Item>
          <Form.Item name="timeoutMs" label="Timeout(ms)">
            <InputNumber min={1000} max={7200000} style={{ width: "100%" }} placeholder="30000" />
          </Form.Item>
          <Form.Item name="inputSchemaText" label="入参 Schema">
            <Input.TextArea rows={8} spellCheck={false} placeholder="请输入 JSON 对象" />
          </Form.Item>
          {promptVariables.length ? (
            <Card size="small" title="提示词变量" styles={{ body: { padding: 12 } }}>
              <Space size={[6, 6]} wrap>
                {promptVariables.map((item) => (
                  <Tag key={item.name} color="blue">{item.name}：{item.description}</Tag>
                ))}
              </Space>
            </Card>
          ) : null}
          <Form.Item name="systemPrompt" label="系统提示词">
            <Input.TextArea rows={10} placeholder="请输入该报表 AI 场景默认使用的系统提示词" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
