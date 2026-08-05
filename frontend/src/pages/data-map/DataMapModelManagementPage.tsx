import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchModelProviders } from "../../services/modelProvider";
import {
  fetchDataMapAiConfigs,
  updateDataMapAiConfig,
  type DataMapAiConfig,
} from "../../services/dataMap";
import type { ModelProviderRecord } from "../../types/api";

function buildProviderModelNameOptions(provider?: ModelProviderRecord | null) {
  return (provider?.modelCatalog || []).map((item) => ({ label: item.label, value: item.name }));
}

function buildProviderModelVersionOptions(provider?: ModelProviderRecord | null, modelName?: string) {
  const currentModel = (provider?.modelCatalog || []).find((item) => item.name === modelName)
    || provider?.modelCatalog?.[0];
  return (currentModel?.versions || []).map((item) => ({ label: item.label, value: item.value }));
}

function stringifyJson(value: unknown) {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return "{}";
  }
}

function parseJsonObject(value: string) {
  const text = String(value || "").trim();
  if (!text) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("输出结构必须是 JSON 对象");
  }
  return parsed as Record<string, unknown>;
}

export function DataMapModelManagementPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<DataMapAiConfig[]>([]);
  const [modelProviders, setModelProviders] = useState<ModelProviderRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataMapAiConfig | null>(null);
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

  async function loadData() {
    if (!token) return;
    const [configResponse, modelResponse] = await Promise.all([
      fetchDataMapAiConfigs(token),
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

  function openEditModal(record: DataMapAiConfig) {
    setEditingRecord(record);
    form.setFieldsValue({
      sceneName: record.sceneName,
      sceneCode: record.sceneCode,
      defaultModelProviderId: record.defaultModelProviderId || null,
      defaultModelName: record.defaultModelName || undefined,
      defaultModelVersion: record.defaultModelVersion || undefined,
      temperature: record.temperature ?? undefined,
      maxTokens: record.maxTokens ?? undefined,
      timeoutMs: record.timeoutMs ?? undefined,
      systemPrompt: record.systemPrompt || "",
      userPromptTemplate: record.userPromptTemplate || "",
      outputSchemaText: stringifyJson(record.outputSchema),
      description: record.description || "",
      ownerName: record.ownerName || "System Administrator",
      status: record.status || "active",
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!token || !editingRecord) return;
    const values = await form.validateFields();
    let outputSchema: Record<string, unknown>;
    try {
      outputSchema = parseJsonObject(values.outputSchemaText);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "输出结构不是合法 JSON");
      return;
    }

    setSubmitting(true);
    try {
      await updateDataMapAiConfig(token, editingRecord.id, {
        sceneName: editingRecord.sceneName,
        sceneCode: editingRecord.sceneCode,
        defaultModelProviderId: values.defaultModelProviderId || null,
        defaultModelName: values.defaultModelName || null,
        defaultModelVersion: values.defaultModelVersion || null,
        temperature: values.temperature ?? null,
        maxTokens: values.maxTokens ?? null,
        timeoutMs: values.timeoutMs ?? null,
        systemPrompt: values.systemPrompt || "",
        userPromptTemplate: values.userPromptTemplate || "",
        outputSchema,
        description: values.description || editingRecord.description || "",
        ownerName: values.ownerName || editingRecord.ownerName,
        status: values.status || editingRecord.status,
      });
      message.success("模型场景配置已更新");
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
      <Card variant="borderless" styles={{ body: { padding: 20 } }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>数据地图模型管理</Typography.Title>
            <Typography.Text type="secondary">分别维护数据地图内容画像、字段信息分析的提示词和运行参数。模型供应商复用系统模型配置，场景配置独立保存在数据地图。</Typography.Text>
          </div>

          <Table<DataMapAiConfig>
            rowKey="id"
            dataSource={records}
            pagination={false}
            columns={[
              { title: "AI类型", dataIndex: "sceneName", key: "sceneName", width: 180 },
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
                width: 200,
                render: (_value, record) => `T=${record.temperature ?? "-"} / Max=${record.maxTokens ?? "-"}`,
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

      <Modal open={open} title="编辑数据地图模型配置" onCancel={closeModal} onOk={() => void handleSubmit()} confirmLoading={submitting} width={900}>
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
          <Form.Item name="sceneName" label="AI类型"><Input disabled /></Form.Item>
          <Form.Item name="sceneCode" label="场景编码"><Input disabled /></Form.Item>
          <Form.Item name="defaultModelProviderId" label="默认模型">
            <Select allowClear placeholder="请选择默认对话模型" options={modelOptions} />
          </Form.Item>
          {modelNameOptions.length > 0 ? (
            <Form.Item name="defaultModelName" label="模型名称">
              <Select allowClear options={modelNameOptions} />
            </Form.Item>
          ) : null}
          {modelVersionOptions.length > 0 ? (
            <Form.Item name="defaultModelVersion" label="模型版本">
              <Select allowClear options={modelVersionOptions} />
            </Form.Item>
          ) : null}
          <Space size={16} align="start">
            <Form.Item name="temperature" label="Temperature">
              <InputNumber min={0} max={2} step={0.1} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="maxTokens" label="Max Tokens">
              <InputNumber min={1} max={32000} style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="timeoutMs" label="Timeout(ms)">
              <InputNumber min={1000} max={300000} step={1000} style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select style={{ width: 140 }} options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} />
            </Form.Item>
          </Space>
          <Form.Item name="systemPrompt" label="系统提示词">
            <Input.TextArea rows={8} />
          </Form.Item>
          <Form.Item name="userPromptTemplate" label="用户提示词模板">
            <Input.TextArea rows={5} placeholder="可使用 {{resourceEvidence}} 引用资源画像证据" />
          </Form.Item>
          <Form.Item name="outputSchemaText" label="输出 JSON Schema">
            <Input.TextArea rows={8} />
          </Form.Item>
          <Form.Item name="description" label="说明"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="ownerName" label="负责人"><Input /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
