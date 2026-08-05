import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchIngestionAiConfigs, updateIngestionAiConfig, type IngestionAiConfigPayload } from "../../services/ingestionAiConfig";
import { fetchModelProviders } from "../../services/modelProvider";
import type { IngestionAiConfigRecord, ModelProviderRecord } from "../../types/api";

const TEXT = {
  title: "模型管理",
  typeCol: "AI类型",
  codeCol: "场景编码",
  modelCol: "默认模型",
  promptCol: "系统提示词",
  statusCol: "状态",
  actionCol: "操作",
  notConfigured: "未配置",
  enabled: "启用",
  disabled: "停用",
  edit: "编辑",
  editConfig: "编辑模型场景配置",
  defaultModelLabel: "默认模型",
  defaultModelPlaceholder: "请选择默认对话模型",
  systemPromptLabel: "系统提示词",
  systemPromptPlaceholder: "请输入该场景默认使用的系统提示词",
  updated: "模型场景配置已更新",
  submitFailed: "提交失败",
  modelNameLabel: "模型名称",
  modelNamePlaceholder: "选择模型名称",
  modelVersionLabel: "模型版本",
  modelVersionPlaceholder: "请选择模型版本",
  temperatureLabel: "Temperature",
  maxTokensLabel: "Max Tokens",
  timeoutMsLabel: "Timeout(ms)",
  sceneTypeLabel: "AI类型",
  sceneCodeLabel: "场景编码",
};

const SCENE_LABELS: Record<string, string> = {
  log_analysis: "日志分析",
  task_config_recommendation: "任务配置推荐",
  data_source_research: "数据源调研",
  file_upload_naming: "文件上传",
  data_lab_scenario_analysis: "场景建模分析",
  data_lab_schema_refinement: "结构迭代调整",
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
  if (!modelName || !versionOptions?.length) {
    return false;
  }
  return versionOptions.length === 1 && versionOptions[0].value === modelName;
}

function getSceneLabel(record: IngestionAiConfigRecord) {
  return SCENE_LABELS[String(record.sceneCode || "")] || record.sceneName || record.sceneCode;
}

export function IngestionAiManagementPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<IngestionAiConfigRecord[]>([]);
  const [modelProviders, setModelProviders] = useState<ModelProviderRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IngestionAiConfigRecord | null>(null);
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

  async function loadData() {
    if (!token) return;
    const [configResponse, modelResponse] = await Promise.all([
      fetchIngestionAiConfigs(token),
      fetchModelProviders(token),
    ]);

    setRecords(
      (configResponse.data || []).filter(
        (item) => !["data_lab_schema_refinement", "data_lab_scenario_analysis"].includes(String(item.sceneCode || ""))
      )
    );
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

  function openEditModal(record: IngestionAiConfigRecord) {
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
      systemPrompt: record.systemPrompt || "",
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!token || !editingRecord) return;
    const values = await form.validateFields();
    const payload: IngestionAiConfigPayload = {
      sceneName: editingRecord.sceneName,
      sceneCode: editingRecord.sceneCode,
      defaultModelProviderId: values.defaultModelProviderId || null,
      defaultModelName: values.defaultModelName || null,
      defaultModelVersion: values.defaultModelVersion || null,
      temperature: values.temperature ?? null,
      maxTokens: values.maxTokens ?? null,
      timeoutMs: values.timeoutMs ?? null,
      systemPrompt: values.systemPrompt || undefined,
      ownerName: editingRecord.ownerName,
      status: editingRecord.status,
    };

    setSubmitting(true);
    try {
      await updateIngestionAiConfig(token, editingRecord.id, payload);
      message.success(TEXT.updated);
      closeModal();
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : TEXT.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Space direction="vertical" size={24} style={{ display: "flex" }}>
      <Card bordered={false} styles={{ body: { padding: 20 } }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>{TEXT.title}</Typography.Title>
          </div>

          <Table
            rowKey="id"
            dataSource={records}
            pagination={false}
            columns={[
              {
                title: TEXT.typeCol,
                key: "sceneName",
                width: 180,
                render: (_value, record) => getSceneLabel(record),
              },
              { title: TEXT.codeCol, dataIndex: "sceneCode", key: "sceneCode", width: 220 },
              {
                title: TEXT.modelCol,
                key: "defaultModel",
                width: 360,
                render: (_value, record) => record.defaultModelProviderName
                  ? `${record.defaultModelProviderName} / ${record.defaultModelName || "-"} / ${record.defaultModelVersion || "-"}`
                  : TEXT.notConfigured,
              },
              {
                title: TEXT.promptCol,
                dataIndex: "systemPrompt",
                key: "systemPrompt",
                ellipsis: true,
                render: (value?: string) => value || "-",
              },
              {
                title: TEXT.statusCol,
                dataIndex: "status",
                key: "status",
                width: 100,
                render: (value: string) => <Tag color={value === "active" ? "green" : "default"}>{value === "active" ? TEXT.enabled : TEXT.disabled}</Tag>,
              },
              {
                title: TEXT.actionCol,
                key: "actions",
                width: 100,
                render: (_value, record) => <Button type="text" size="small" onClick={() => openEditModal(record)}>{TEXT.edit}</Button>,
              },
            ]}
          />
        </Space>
      </Card>

      <Modal open={open} title={TEXT.editConfig} onCancel={closeModal} onOk={() => void handleSubmit()} confirmLoading={submitting} width={760}>
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
          <Form.Item name="sceneName" label={TEXT.sceneTypeLabel}>
            <Input disabled />
          </Form.Item>
          <Form.Item name="sceneCode" label={TEXT.sceneCodeLabel}>
            <Input disabled />
          </Form.Item>
          <Form.Item name="defaultModelProviderId" label={TEXT.defaultModelLabel}>
            <Select allowClear placeholder={TEXT.defaultModelPlaceholder} options={modelOptions} />
          </Form.Item>
          <Form.Item name="defaultModelName" label={TEXT.modelNameLabel}>
            <Select allowClear placeholder={TEXT.modelNamePlaceholder} options={modelNameOptions} disabled={!selectedProvider} />
          </Form.Item>
          <Form.Item name="defaultModelVersion" label={TEXT.modelVersionLabel}>
            <Select
              allowClear
              placeholder={versionSelectionRedundant ? "当前模型未区分独立版本" : TEXT.modelVersionPlaceholder}
              options={modelVersionOptions}
              disabled={!modelVersionOptions.length || versionSelectionRedundant}
            />
          </Form.Item>
          {versionSelectionRedundant ? (
            <Typography.Text type="secondary" style={{ marginTop: -12, display: "block" }}>
              当前 Provider 未区分独立版本，系统会默认使用模型名称作为版本标识。
            </Typography.Text>
          ) : null}
          <Form.Item name="temperature" label={TEXT.temperatureLabel}>
            <InputNumber min={0} max={2} step={0.1} style={{ width: "100%" }} placeholder="0.1" />
          </Form.Item>
          <Form.Item name="maxTokens" label={TEXT.maxTokensLabel}>
            <InputNumber min={1} max={32000} style={{ width: "100%" }} placeholder="1800" />
          </Form.Item>
          <Form.Item name="timeoutMs" label={TEXT.timeoutMsLabel}>
            <InputNumber min={1000} max={7200000} style={{ width: "100%" }} placeholder="6000000" />
          </Form.Item>
          <Form.Item name="systemPrompt" label={TEXT.systemPromptLabel}>
            <Input.TextArea rows={10} placeholder={TEXT.systemPromptPlaceholder} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
