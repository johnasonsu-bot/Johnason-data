import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { COMMITTEE_ROLE_OPTIONS, defaultSystemPromptForScope, MODEL_SCOPE_OPTIONS, modelScopeLabel } from "../../constants/dataLabModelScopes";
import { debugLabModel, deleteLabModel, fetchLabModels, saveLabModel, setDefaultLabModel, type LabModelPayload } from "../../services/dataLab";
import type { LabModelProfileRecord, ModelProviderRecord } from "../../types/api";

type DebugResult = {
  rawText: string;
  parsedJson: unknown;
  validJson: boolean;
} | null;

type DebugFormValues = {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
};

function boolTag(value: boolean, yes: string, no: string) {
  return value ? <Tag color="green">{yes}</Tag> : <Tag>{no}</Tag>;
}

function statusTag(value: string) {
  return value === "active" ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>;
}

function isVersionSelectionRedundant(modelName?: string, versionOptions?: Array<{ label: string; value: string }>) {
  if (!modelName || !versionOptions?.length) {
    return false;
  }
  return versionOptions.length === 1 && versionOptions[0].value === modelName;
}

export function DataLabModelProfilesPage() {
  const { token } = useAuth();
  const [profiles, setProfiles] = useState<LabModelProfileRecord[]>([]);
  const [providers, setProviders] = useState<Array<Pick<ModelProviderRecord, "id" | "configName" | "configCode" | "providerType" | "modelCategory" | "modelName" | "modelVersion" | "modelCatalog">>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [editing, setEditing] = useState<LabModelProfileRecord | null>(null);
  const [debugTarget, setDebugTarget] = useState<LabModelProfileRecord | null>(null);
  const [debugging, setDebugging] = useState(false);
  const [debugResult, setDebugResult] = useState<DebugResult>(null);
  const [form] = Form.useForm<LabModelPayload>();
  const [debugForm] = Form.useForm<DebugFormValues>();

  const providerId = Form.useWatch("providerId", form);
  const modelName = Form.useWatch("modelName", form);
  const usageScope = Form.useWatch("stageType", form);

  const selectedProvider = useMemo(
    () => providers.find((item) => item.id === Number(providerId)) || null,
    [providerId, providers]
  );

  const providerOptions = useMemo(
    () =>
      providers
        .filter((item) => item.modelCategory === "chat")
        .map((item) => ({
          label: `${item.configName} / ${item.modelName} (${item.providerType})`,
          value: item.id,
        })),
    [providers]
  );

  const modelNameOptions = useMemo(
    () => (selectedProvider?.modelCatalog || []).map((item) => ({ label: item.label, value: item.name })),
    [selectedProvider]
  );

  const modelVersionOptions = useMemo(() => {
    const currentModel = (selectedProvider?.modelCatalog || []).find((item) => item.name === modelName)
      || selectedProvider?.modelCatalog?.[0];
    return (currentModel?.versions || []).map((item) => ({ label: item.label, value: item.value }));
  }, [selectedProvider, modelName]);
  const versionSelectionRedundant = useMemo(
    () => isVersionSelectionRedundant(modelName, modelVersionOptions),
    [modelName, modelVersionOptions]
  );

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetchLabModels(token);
      setProfiles(response.data.profiles || []);
      setProviders(response.data.providers || []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to load model profiles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  useEffect(() => {
    if (!providerId) return;
    const provider = providers.find((item) => item.id === Number(providerId));
    if (!provider) return;
    if (!form.getFieldValue("modelName")) {
      form.setFieldValue("modelName", provider.modelCatalog?.[0]?.name || provider.modelName);
    }
    if (!form.getFieldValue("modelVersion")) {
      form.setFieldValue("modelVersion", provider.modelCatalog?.[0]?.versions?.[0]?.value || provider.modelVersion || provider.modelName);
    }
    if (!form.getFieldValue("modelCode")) {
      form.setFieldValue("modelCode", provider.configCode);
    }
    if (!form.getFieldValue("profileName")) {
      form.setFieldValue("profileName", `${provider.configName} ${modelScopeLabel(usageScope || "researcher")}`);
    }
  }, [providerId, providers, usageScope, form]);

  useEffect(() => {
    if (!usageScope) return;
    const currentPrompt = String(form.getFieldValue("systemPrompt") || "").trim();
    if (!currentPrompt) {
      form.setFieldValue("systemPrompt", defaultSystemPromptForScope(usageScope));
    }
  }, [usageScope, form]);

  function openCreate() {
    setEditing(null);
    setDebugResult(null);
    form.resetFields();
    form.setFieldsValue({
      stageType: "researcher",
      authMode: "bearer",
      temperature: 0.2,
      maxContextLength: 8192,
      status: "active",
      isDefault: false,
      systemPrompt: defaultSystemPromptForScope("researcher"),
    });
    setEditorOpen(true);
  }

  function openEdit(record: LabModelProfileRecord) {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      id: record.id,
      profileName: record.profileName,
      stageType: record.stageType as LabModelPayload["stageType"],
      providerId: record.providerId || undefined,
      modelName: record.modelName,
      modelVersion: record.modelVersion || undefined,
      modelCode: record.modelCode,
      endpointUrl: record.endpointUrl || undefined,
      authMode: record.authMode as LabModelPayload["authMode"],
      temperature: record.temperature,
      maxContextLength: record.maxContextLength,
      systemPrompt: record.systemPrompt || defaultSystemPromptForScope(record.stageType),
      isDefault: record.isDefault,
      status: record.status as LabModelPayload["status"],
    });
    setEditorOpen(true);
  }

  function openDuplicate(record: LabModelProfileRecord) {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      profileName: `${record.profileName} Copy`,
      stageType: record.stageType as LabModelPayload["stageType"],
      providerId: record.providerId || undefined,
      modelName: record.modelName,
      modelVersion: record.modelVersion || undefined,
      modelCode: `${record.modelCode}_copy`.slice(0, 64),
      endpointUrl: record.endpointUrl || undefined,
      authMode: record.authMode as LabModelPayload["authMode"],
      temperature: record.temperature,
      maxContextLength: record.maxContextLength,
      systemPrompt: record.systemPrompt || defaultSystemPromptForScope(record.stageType),
      isDefault: false,
      status: record.status as LabModelPayload["status"],
    });
    setEditorOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    const values = await form.validateFields();
    try {
      setSaving(true);
      await saveLabModel(token, values);
      message.success(values.id ? "Model profile updated." : "Model profile created.");
      setEditorOpen(false);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to save model profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    try {
      await deleteLabModel(token, id);
      message.success("Model profile deleted.");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to delete model profile.");
    }
  }

  async function handleSetDefault(id: number) {
    if (!token) return;
    try {
      await setDefaultLabModel(token, id);
      message.success("Default profile updated.");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to set default profile.");
    }
  }

  function openDebug(record: LabModelProfileRecord) {
    setDebugTarget(record);
    setDebugResult(null);
    debugForm.resetFields();
    debugForm.setFieldsValue({
      temperature: record.temperature ?? 0.2,
      maxTokens: 1200,
      systemPrompt: record.systemPrompt || defaultSystemPromptForScope(record.stageType),
    });
    setDebugOpen(true);
  }

  async function handleDebug() {
    if (!token || !debugTarget) return;
    const values = await debugForm.validateFields();
    try {
      setDebugging(true);
      const response = await debugLabModel(token, {
        profileId: debugTarget.id,
        prompt: values.prompt,
        systemPrompt: values.systemPrompt,
        temperature: values.temperature,
        maxTokens: values.maxTokens,
      });
      setDebugResult(response.data);
      message.success("Debug completed.");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Model debug failed.");
    } finally {
      setDebugging(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Text type="secondary">
            Reuse one chat provider as multiple scene defaults or incubation committee roles. Different usage scopes can carry different system prompts and temperatures.
          </Typography.Text>
          <Button type="primary" onClick={openCreate}>New Profile</Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={profiles}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "Profile Name", dataIndex: "profileName" },
          { title: "Usage Scope", dataIndex: "stageType", width: 180, render: (value: string) => modelScopeLabel(value) },
          { title: "Provider", dataIndex: "providerName", width: 220, render: (value: string | null) => value || "-" },
          { title: "Model", dataIndex: "modelName", width: 180 },
          { title: "Version", dataIndex: "modelVersion", width: 220, render: (value?: string | null) => value || "-" },
          { title: "Model Code", dataIndex: "modelCode", width: 180 },
          { title: "Temperature", dataIndex: "temperature", width: 110 },
          { title: "Default", dataIndex: "isDefault", width: 100, render: (value: boolean) => boolTag(value, "Default", "Normal") },
          { title: "Status", dataIndex: "status", width: 100, render: (value: string) => statusTag(value) },
          {
            title: "Actions",
            width: 360,
            render: (_: unknown, record: LabModelProfileRecord) => (
              <Space>
                <Button type="link" onClick={() => openEdit(record)}>Edit</Button>
                <Button type="link" onClick={() => openDuplicate(record)}>Duplicate</Button>
                <Button type="link" onClick={() => openDebug(record)}>Debug</Button>
                <Button type="link" onClick={() => void handleSetDefault(record.id)} disabled={record.isDefault}>Set Default</Button>
                <Popconfirm title="Delete current model profile?" onConfirm={() => void handleDelete(record.id)}>
                  <Button type="link" danger>Delete</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={editorOpen}
        title={editing ? "Edit Model Profile" : "New Model Profile"}
        onCancel={() => setEditorOpen(false)}
        onOk={() => void handleSave()}
        confirmLoading={saving}
        width={920}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          colon={false}
          onValuesChange={(changedValues) => {
            if (Object.prototype.hasOwnProperty.call(changedValues, "providerId")) {
              const provider = providers.find((item) => item.id === Number(changedValues.providerId));
              const firstModel = provider?.modelCatalog?.[0];
              form.setFieldsValue({
                modelName: firstModel?.name || provider?.modelName,
                modelVersion: firstModel?.versions?.[0]?.value || provider?.modelVersion || provider?.modelName,
              });
            }
            if (Object.prototype.hasOwnProperty.call(changedValues, "modelName")) {
              const provider = providers.find((item) => item.id === Number(form.getFieldValue("providerId")));
              const currentModel = (provider?.modelCatalog || []).find((item) => item.name === changedValues.modelName);
              form.setFieldValue("modelVersion", currentModel?.versions?.[0]?.value || provider?.modelVersion || provider?.modelName);
            }
          }}
        >
          <Space size={16} align="start" style={{ width: "100%" }}>
            <Form.Item name="profileName" label="Profile Name" rules={[{ required: true, message: "Profile name is required." }]} style={{ flex: 1 }}>
              <Input placeholder="DeepSeek Researcher" />
            </Form.Item>
            <Form.Item name="stageType" label="Usage Scope" rules={[{ required: true, message: "Usage scope is required." }]} style={{ flex: 1 }}>
              <Select options={MODEL_SCOPE_OPTIONS} />
            </Form.Item>
          </Space>

          <Space size={16} align="start" style={{ width: "100%" }}>
            <Form.Item name="providerId" label="Provider" rules={[{ required: true, message: "Provider is required." }]} style={{ flex: 1 }}>
              <Select showSearch optionFilterProp="label" options={providerOptions} placeholder="Select a chat provider" />
            </Form.Item>
            <Form.Item name="modelName" label="Model Name" rules={[{ required: true, message: "Model name is required." }]} style={{ flex: 1 }}>
              <Select showSearch optionFilterProp="label" options={modelNameOptions} placeholder="Select a model name" disabled={!selectedProvider} />
            </Form.Item>
          </Space>

          <Space size={16} align="start" style={{ width: "100%" }}>
            <Form.Item name="modelVersion" label="Model Version" rules={[{ required: true, message: "Model version is required." }]} style={{ flex: 1 }}>
              <Select
                showSearch
                optionFilterProp="label"
                options={modelVersionOptions}
                placeholder={versionSelectionRedundant ? "Using model name as version" : "Select a model version"}
                disabled={!modelVersionOptions.length || versionSelectionRedundant}
              />
            </Form.Item>
            <Form.Item name="modelCode" label="Model Code" rules={[{ required: true, message: "Model code is required." }]} style={{ flex: 1 }}>
              <Input placeholder="deepseek_researcher" />
            </Form.Item>
          </Space>
          {versionSelectionRedundant ? (
            <Typography.Text type="secondary">
              The current provider does not expose a separate version dimension. The model name is used as the version identifier.
            </Typography.Text>
          ) : null}

          <Space size={16} align="start" style={{ width: "100%" }}>
            <Form.Item name="endpointUrl" label="Endpoint Override" style={{ flex: 1 }}>
              <Input placeholder="Optional custom endpoint" />
            </Form.Item>
          </Space>

          <Space size={16} align="start" style={{ width: "100%" }}>
            <Form.Item name="authMode" label="Auth Mode" style={{ flex: 1 }}>
              <Select
                options={[
                  { label: "Bearer", value: "bearer" },
                  { label: "API Key", value: "api_key" },
                  { label: "None", value: "none" },
                ]}
              />
            </Form.Item>
            <Form.Item name="temperature" label="Temperature" style={{ flex: 1 }}>
              <InputNumber min={0} max={2} step={0.1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="maxContextLength" label="Max Context Length" style={{ flex: 1 }}>
              <InputNumber min={512} max={200000} step={512} style={{ width: "100%" }} />
            </Form.Item>
          </Space>

          <Space size={16} align="start" style={{ width: "100%" }}>
            <Form.Item name="status" label="Status" style={{ flex: 1 }}>
              <Select options={[{ label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }]} />
            </Form.Item>
            <Form.Item name="isDefault" label="Default For This Scope" valuePropName="checked" style={{ flex: 1 }}>
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item name="systemPrompt" label="System Prompt">
            <Input.TextArea rows={8} placeholder="Optional role-specific system prompt." />
          </Form.Item>

          {COMMITTEE_ROLE_OPTIONS.some((item) => item.value === usageScope) ? (
            <Typography.Text type="secondary">
              This profile can be assigned directly inside an incubation committee member row. The same provider can be duplicated into multiple committee roles.
            </Typography.Text>
          ) : null}
        </Form>
      </Modal>

      <Modal
        open={debugOpen}
        title={debugTarget ? `Debug: ${debugTarget.profileName}` : "Debug Model Profile"}
        onCancel={() => setDebugOpen(false)}
        onOk={() => void handleDebug()}
        confirmLoading={debugging}
        width={960}
        destroyOnHidden
      >
        <Form form={debugForm} layout="vertical" colon={false}>
          <Form.Item name="prompt" label="Prompt" rules={[{ required: true, message: "Prompt is required." }]}>
            <Input.TextArea rows={6} placeholder="Enter a debug prompt." />
          </Form.Item>
          <Space size={16} align="start" style={{ width: "100%" }}>
            <Form.Item name="temperature" label="Temperature" style={{ flex: 1 }}>
              <InputNumber min={0} max={2} step={0.1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="maxTokens" label="Max Tokens" style={{ flex: 1 }}>
              <InputNumber min={128} max={8000} step={128} style={{ width: "100%" }} />
            </Form.Item>
          </Space>
          <Form.Item name="systemPrompt" label="System Prompt Override">
            <Input.TextArea rows={5} />
          </Form.Item>
        </Form>

        {debugResult ? (
          <Card size="small" title="Debug Result">
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <Typography.Text strong>JSON Validity: {debugResult.validJson ? "Valid" : "Invalid"}</Typography.Text>
              <Card size="small" title="Raw Response">
                <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{debugResult.rawText || "-"}</Typography.Paragraph>
              </Card>
              <Card size="small" title="Parsed JSON">
                <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{JSON.stringify(debugResult.parsedJson ?? null, null, 2)}</Typography.Paragraph>
              </Card>
            </Space>
          </Card>
        ) : null}
      </Modal>
    </Space>
  );
}
