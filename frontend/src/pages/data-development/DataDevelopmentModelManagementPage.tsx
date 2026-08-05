import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchDevAiConfigs, updateDevAiConfig, type DevAiConfigPayload } from "../../services/devAiConfig";
import { fetchModelProviders } from "../../services/modelProvider";
import type { DevAiConfigRecord, ModelProviderRecord } from "../../types/api";

const SCENE_LABELS: Record<string, string> = {
  sql_generate: "SQL 生成",
  sql_analyze: "SQL 问题分析",
  sql_rewrite: "SQL 改写",
  sql_optimize: "SQL 优化",
  sql_explain: "SQL 解释",
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

function getSceneLabel(record: DevAiConfigRecord) {
  return SCENE_LABELS[String(record.sceneCode || "")] || record.sceneName || record.sceneCode;
}

export function DataDevelopmentModelManagementPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<DevAiConfigRecord[]>([]);
  const [modelProviders, setModelProviders] = useState<ModelProviderRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DevAiConfigRecord | null>(null);
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
      fetchDevAiConfigs(token),
      fetchModelProviders(token),
    ]);
    setRecords(
      (configResponse.data || []).filter((item) =>
        ["sql_generate", "sql_analyze", "sql_rewrite", "sql_optimize", "sql_explain"].includes(String(item.sceneCode || ""))
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

  function openEditModal(record: DevAiConfigRecord) {
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
    const payload: DevAiConfigPayload = {
      sceneName: editingRecord.sceneName,
      sceneCode: editingRecord.sceneCode,
      defaultModelProviderId: values.defaultModelProviderId || null,
      defaultModelName: values.defaultModelName || null,
      defaultModelVersion: values.defaultModelVersion || null,
      temperature: values.temperature ?? null,
      maxTokens: values.maxTokens ?? null,
      timeoutMs: values.timeoutMs ?? null,
      systemPrompt: values.systemPrompt || undefined,
      description: editingRecord.description,
      ownerName: editingRecord.ownerName,
      status: editingRecord.status,
    };

    setSubmitting(true);
    try {
      await updateDevAiConfig(token, editingRecord.id, payload);
      message.success("数据开发模型配置已更新");
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
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>模型管理</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0" }}>
              分别维护 SQL 生成、问题分析、改写、优化、解释五类场景的默认模型、参数和提示词。
            </Typography.Paragraph>
          </div>

          <Table
            rowKey="id"
            dataSource={records}
            pagination={false}
            columns={[
              {
                title: "AI 类型",
                key: "sceneName",
                width: 180,
                render: (_value, record) => getSceneLabel(record),
              },
              { title: "场景编码", dataIndex: "sceneCode", key: "sceneCode", width: 180 },
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

      <Modal open={open} title="编辑数据开发模型配置" onCancel={closeModal} onOk={() => void handleSubmit()} confirmLoading={submitting} width={760}>
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
          <Form.Item name="systemPrompt" label="系统提示词">
            <Input.TextArea rows={10} placeholder="请输入该 SQL 场景默认使用的系统提示词" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
