import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchDataServiceAiConfigs, updateDataServiceAiConfig } from "../../services/dataServices";
import { fetchModelProviders } from "../../services/modelProvider";
import type { DataServiceAiConfigRecord, ModelProviderRecord } from "../../types/api";

const SCENE_LABELS: Record<string, string> = {
  service_config_recommendation: "服务开发推荐",
};

function getSceneLabel(record: DataServiceAiConfigRecord) {
  return SCENE_LABELS[String(record.sceneCode || "")] || record.sceneName || record.sceneCode;
}

function buildProviderModelNameOptions(provider?: ModelProviderRecord | null) {
  return (provider?.modelCatalog || []).map((item) => ({ label: item.label, value: item.name }));
}

function buildProviderModelVersionOptions(provider?: ModelProviderRecord | null, modelName?: string) {
  const currentModel = (provider?.modelCatalog || []).find((item) => item.name === modelName) || provider?.modelCatalog?.[0];
  return (currentModel?.versions || []).map((item) => ({ label: item.label, value: item.value }));
}

export function DataServiceModelManagementPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<DataServiceAiConfigRecord[]>([]);
  const [providers, setProviders] = useState<ModelProviderRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataServiceAiConfigRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const watchedProviderId = Form.useWatch("defaultModelProviderId", form);
  const watchedModelName = Form.useWatch("defaultModelName", form);

  const modelOptions = useMemo(
    () => providers
      .filter((item) => item.status === "active" && item.modelCategory === "chat")
      .map((item) => ({ label: `${item.configName} / ${item.modelName}`, value: item.id })),
    [providers]
  );

  const selectedProvider = useMemo(
    () => providers.find((item) => item.id === Number(watchedProviderId)) || null,
    [providers, watchedProviderId]
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
    const [configRes, providerRes] = await Promise.all([
      fetchDataServiceAiConfigs(token),
      fetchModelProviders(token),
    ]);
    setRecords(configRes.data || []);
    setProviders(providerRes.data || []);
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  function closeModal() {
    setOpen(false);
    setEditingRecord(null);
    form.resetFields();
  }

  function openEditModal(record: DataServiceAiConfigRecord) {
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
    setSubmitting(true);
    try {
      await updateDataServiceAiConfig(token, editingRecord.id, {
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
      <Card bordered={false} styles={{ body: { padding: 20 } }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Typography.Title level={4} style={{ margin: 0 }}>模型管理</Typography.Title>

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
                width: 360,
                render: (_value, record) => record.defaultModelProviderName
                  ? `${record.defaultModelProviderName} / ${record.defaultModelName || "-"} / ${record.defaultModelVersion || "-"}`
                  : "未配置",
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

      <Modal open={open} title="编辑模型场景配置" onCancel={closeModal} onOk={() => void handleSubmit()} confirmLoading={submitting} width={760}>
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changedValues) => {
            if (Object.prototype.hasOwnProperty.call(changedValues, "defaultModelProviderId")) {
              const provider = providers.find((item) => item.id === Number(changedValues.defaultModelProviderId));
              const firstModel = provider?.modelCatalog?.[0];
              form.setFieldsValue({
                defaultModelName: firstModel?.name,
                defaultModelVersion: firstModel?.versions?.[0]?.value,
              });
            }
            if (Object.prototype.hasOwnProperty.call(changedValues, "defaultModelName")) {
              const provider = providers.find((item) => item.id === Number(form.getFieldValue("defaultModelProviderId")));
              const currentModel = (provider?.modelCatalog || []).find((item) => item.name === changedValues.defaultModelName);
              form.setFieldValue("defaultModelVersion", currentModel?.versions?.[0]?.value);
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
            <Select allowClear placeholder="请选择模型版本" options={modelVersionOptions} disabled={!selectedProvider || !watchedModelName} />
          </Form.Item>
          <Space size={16} style={{ display: "flex" }}>
            <Form.Item name="temperature" label="Temperature" style={{ flex: 1 }}>
              <InputNumber min={0} max={2} step={0.1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="maxTokens" label="Max Tokens" style={{ flex: 1 }}>
              <InputNumber min={1} max={32000} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="timeoutMs" label="Timeout(ms)" style={{ flex: 1 }}>
              <InputNumber min={1000} max={7200000} step={1000} style={{ width: "100%" }} />
            </Form.Item>
          </Space>
          <Form.Item name="systemPrompt" label="系统提示词">
            <Input.TextArea rows={10} placeholder="请输入该场景默认使用的系统提示词" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
