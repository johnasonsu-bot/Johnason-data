import { Alert, Button, Card, Descriptions, Drawer, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchModelProviders } from "../../services/modelProvider";
import {
  debugPromptTemplate,
  fetchPromptTemplates,
  fetchPromptTemplateVersions,
  publishPromptTemplate,
  savePromptTemplateDraft,
  syncDefaultPromptTemplates,
} from "../../services/dataLab";
import type { LabPromptTemplateRecord, LabPromptTemplateVersionRecord, ModelProviderRecord } from "../../types/api";

type PromptSlot = {
  promptType: string;
  sceneName: string;
  sceneCode: string;
  description: string;
  runtimeUsage: string;
};

type PromptRow = PromptSlot & {
  templateId?: number;
  templateName?: string;
  templateCode?: string;
  content?: string;
  userContent?: string;
  temperature?: number | null;
  maxTokens?: number | null;
  status: "active" | "inactive" | "unconfigured";
  defaultModelProviderId?: number | null;
  defaultModelName?: string | null;
  defaultModelVersion?: string | null;
  defaultModelLabel?: string | null;
  latestVersionNo?: number | null;
  latestVersionStatus?: string | null;
};

type PromptFormValues = {
  templateName: string;
  templateCode: string;
  defaultModelProviderId?: number | null;
  defaultModelName?: string | null;
  defaultModelVersion?: string | null;
  content: string;
  userContent: string;
  temperature: number;
  maxTokens: number;
  status: "active" | "inactive";
};

type DebugFormValues = {
  modelProviderId: number;
  input: string;
  temperature: number;
  maxTokens: number;
};

const PROMPT_SLOTS: PromptSlot[] = [
  {
    promptType: "INDUSTRY_METADATA",
    sceneName: "行业孵化元数据抽取",
    sceneCode: "industry_metadata",
    description: "行业级运行时使用。根据行业名称、行业描述和联网证据生成新的子类目。",
    runtimeUsage: "data-lab.incubation-runtime.js -> refreshIndustryMetadata(mode=industry)",
  },
  {
    promptType: "INDUSTRY_CATEGORY_ENHANCE",
    sceneName: "行业子类目深挖",
    sceneCode: "industry_category_enhance",
    description: "子类目运行时使用。针对指定子类目继续联网调研并做增量完善。",
    runtimeUsage: "data-lab.incubation-runtime.js -> refreshIndustryMetadata(mode=category)",
  },
  {
    promptType: "AUTO_RESEARCH",
    sceneName: "自动调研规划",
    sceneCode: "auto_research",
    description: "场景定义生成方案前，抽取业务对象、候选表、候选字典和关系建议。",
    runtimeUsage: "data-lab.service.js -> buildAutoResearchPack",
  },
  {
    promptType: "SCHEMA_DESIGN",
    sceneName: "逻辑模型设计",
    sceneCode: "schema_design",
    description: "根据场景信息和所选知识库内容生成逻辑模型，包括业务表、中文表名、字段、字典表和表关系。",
    runtimeUsage: "data-lab.service.js -> tryGenerateSchemaWithModelV2",
  },
  {
    promptType: "LOGICAL_MODEL_BUILD",
    sceneName: "逻辑模型构建",
    sceneCode: "logical_model_build",
    description: "场景管理新建业务系统模板时使用。基于所选行业孵化子类目资产，自动生成技术字段名、字段类型和表关系。",
    runtimeUsage: "scenario-management.service.js -> createBusinessSystemTemplate",
  },
  {
    promptType: "PHYSICAL_MODEL_DESIGN_DOC",
    sceneName: "物理设计说明",
    sceneCode: "physical_model_design_doc",
    description: "物理模型模块导出数据库设计说明书时使用。基于物理表结构、字段、索引和依赖关系生成设计说明摘要。",
    runtimeUsage: "scenario-management.service.js -> summarizePhysicalDesignDoc",
  },
  {
    promptType: "AI_BUSINESS_DATA_PLAN",
    sceneName: "AI 业务数据方案",
    sceneCode: "ai_business_data_plan",
    description: "AI 业务数据生成首步使用。基于物理模型、表依赖、已落库状态和用户需求生成业务数据方案。",
    runtimeUsage: "ai-business-data.service.js -> generateAiBusinessDataPlan",
  },
  {
    promptType: "AI_BUSINESS_DATA_BATCH",
    sceneName: "AI 业务数据批次",
    sceneCode: "ai_business_data_batch",
    description: "AI 业务数据批次生成时使用。基于方案、物理模型、实体池和批次目标生成可校验业务数据。",
    runtimeUsage: "ai-business-data.service.js -> generateAiBusinessDataBatch",
  },
  {
    promptType: "STRATEGY",
    sceneName: "数据生成策略",
    sceneCode: "strategy_generation",
    description: "根据已确认结构生成首批和增量造数策略。",
    runtimeUsage: "data-lab.service.js -> tryGenerateStrategyWithModelV2",
  },
  {
    promptType: "FIELD_SEMANTIC_CLASSIFY",
    sceneName: "字段语义识别",
    sceneCode: "field_semantic_classify",
    description: "对字段做语义分类，辅助字段规则和真实性校验。",
    runtimeUsage: "data-lab.service.js -> resolveFieldSemanticMapWithModel",
  },
  {
    promptType: "DATA_REALISM_REVIEW",
    sceneName: "真实性评审",
    sceneCode: "data_realism_review",
    description: "对生成样本做真实性、时间链、格式和业务合理性评审。",
    runtimeUsage: "data-lab.service.js -> reviewSceneRealism",
  },
  {
    promptType: "DIRTY_SCRIPT",
    sceneName: "脏数据脚本生成",
    sceneCode: "dirty_script_generation",
    description: "根据样本数据生成后处理脏化脚本。",
    runtimeUsage: "data-lab.service.js -> generateDirtyScript",
  },
];

const HIDDEN_PROMPT_TYPES = new Set([
  "AUTO_RESEARCH",
  "SCHEMA_DESIGN",
  "STRATEGY",
  "FIELD_SEMANTIC_CLASSIFY",
  "DATA_REALISM_REVIEW",
  "DIRTY_SCRIPT",
]);

function statusTag(value: PromptRow["status"]) {
  if (value === "active") return <Tag color="green">启用</Tag>;
  if (value === "inactive") return <Tag>停用</Tag>;
  return <Tag color="gold">未配置</Tag>;
}

function versionTag(value?: string | null) {
  if (value === "published") return <Tag color="green">已发布</Tag>;
  if (value === "draft") return <Tag color="gold">草稿</Tag>;
  return <Tag>{value || "-"}</Tag>;
}

function getProviderModelNameOptions(provider?: ModelProviderRecord | null) {
  return (provider?.modelCatalog || []).map((item) => ({ label: item.label, value: item.name }));
}

function getProviderModelVersionOptions(provider?: ModelProviderRecord | null, modelName?: string | null) {
  const currentModel = (provider?.modelCatalog || []).find((item) => item.name === modelName) || provider?.modelCatalog?.[0];
  return (currentModel?.versions || []).map((item) => ({ label: item.label, value: item.value }));
}

function isVersionSelectionRedundant(modelName?: string | null, versionOptions?: Array<{ label: string; value: string }>) {
  if (!modelName || !versionOptions?.length) {
    return false;
  }
  return versionOptions.length === 1 && versionOptions[0].value === modelName;
}

function renderTemplate(template: string | undefined, variables: Record<string, string>) {
  const raw = String(template || "");
  if (!raw) return "";
  return raw.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => variables[key] || "");
}

function buildPromptRows(templates: LabPromptTemplateRecord[], providers: ModelProviderRecord[]) {
  return PROMPT_SLOTS
    .filter((slot) => !HIDDEN_PROMPT_TYPES.has(slot.promptType))
    .map((slot) => {
    const template = templates
      .filter((item) => item.promptType === slot.promptType)
      .sort((left, right) => Number(right.isDefault) - Number(left.isDefault))[0];
    const provider = template?.defaultModelProviderId
      ? providers.find((item) => item.id === Number(template.defaultModelProviderId))
      : null;
    return {
      ...slot,
      templateId: template?.id,
      templateName: template?.templateName,
      templateCode: template?.templateCode,
      content: template?.content,
      userContent: template?.userContent,
      temperature: template?.temperature ?? null,
      maxTokens: template?.maxTokens ?? null,
      status: (template?.status as PromptRow["status"]) || "unconfigured",
      defaultModelProviderId: template?.defaultModelProviderId || null,
      defaultModelName: template?.defaultModelName || null,
      defaultModelVersion: template?.defaultModelVersion || null,
      defaultModelLabel: provider ? `${provider.configName} / ${template?.defaultModelName || provider.modelName} / ${template?.defaultModelVersion || provider.modelVersion || provider.modelName}` : null,
      latestVersionNo: template?.latestVersionNo || null,
      latestVersionStatus: template?.latestVersionStatus || null,
    } as PromptRow;
  });
}

export function DataLabPromptManagementPage() {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<LabPromptTemplateRecord[]>([]);
  const [providers, setProviders] = useState<ModelProviderRecord[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<PromptRow | null>(null);
  const [versionRows, setVersionRows] = useState<LabPromptTemplateVersionRecord[]>([]);
  const [debugResult, setDebugResult] = useState<{ rawText: string; parsedJson: unknown; validJson: boolean } | null>(null);
  const [submittingDraft, setSubmittingDraft] = useState(false);
  const [submittingPublish, setSubmittingPublish] = useState(false);
  const [debugging, setDebugging] = useState(false);
  const [form] = Form.useForm<PromptFormValues>();
  const [debugForm] = Form.useForm<DebugFormValues>();
  const debugInput = Form.useWatch("input", debugForm);
  const watchedProviderId = Form.useWatch("defaultModelProviderId", form);
  const watchedModelName = Form.useWatch("defaultModelName", form);

  const rows = useMemo(() => buildPromptRows(templates, providers), [templates, providers]);
  const providerOptions = useMemo(
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
    () => getProviderModelNameOptions(selectedProvider),
    [selectedProvider]
  );
  const modelVersionOptions = useMemo(
    () => getProviderModelVersionOptions(selectedProvider, watchedModelName),
    [selectedProvider, watchedModelName]
  );
  const versionSelectionRedundant = useMemo(
    () => isVersionSelectionRedundant(watchedModelName, modelVersionOptions),
    [modelVersionOptions, watchedModelName]
  );

  const renderedDebugUserPrompt = useMemo(
    () => renderTemplate(editingRow?.userContent, { input: String(debugInput || "") }),
    [debugInput, editingRow?.userContent]
  );

  async function loadData() {
    if (!token) return;
    const [promptResponse, providerResponse] = await Promise.all([
      fetchPromptTemplates(token),
      fetchModelProviders(token),
    ]);
    setTemplates(promptResponse.data || []);
    setProviders(providerResponse.data || []);
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  async function handleSyncDefaults() {
    if (!token) return;
    try {
      setSyncing(true);
      await syncDefaultPromptTemplates(token);
      message.success("程序默认系统提示词、用户提示词和运行参数已同步到清单");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  }

  function openEditModal(record: PromptRow) {
    setEditingRow(record);
    form.setFieldsValue({
      templateName: record.templateName || record.sceneName,
      templateCode: record.templateCode || record.sceneCode,
      defaultModelProviderId: record.defaultModelProviderId || undefined,
      defaultModelName: record.defaultModelName || undefined,
      defaultModelVersion: record.defaultModelVersion || undefined,
      content: record.content || "",
      userContent: record.userContent || "{{input}}",
      temperature: record.temperature ?? 0.2,
      maxTokens: record.maxTokens ?? 1200,
      status: record.status === "inactive" ? "inactive" : "active",
    });
    setEditorOpen(true);
  }

  async function openVersionDrawer(record: PromptRow) {
    if (!token) return;
    const response = await fetchPromptTemplateVersions(token, record.promptType);
    setVersionRows(response.data || []);
    setEditingRow(record);
    setVersionOpen(true);
  }

  function openDebugModal(record: PromptRow) {
    setEditingRow(record);
    setDebugResult(null);
    debugForm.setFieldsValue({
      modelProviderId: record.defaultModelProviderId || providerOptions[0]?.value,
      input: "请返回一个最小 JSON 对象，例如 {\"ok\":true}",
      temperature: record.temperature ?? 0.2,
      maxTokens: record.maxTokens ?? 1200,
    });
    setDebugOpen(true);
  }

  function currentPayload() {
    const values = form.getFieldsValue(true) as PromptFormValues;
    return {
      id: editingRow?.templateId,
      promptType: editingRow?.promptType || "",
      templateName: values.templateName,
      templateCode: values.templateCode,
      defaultModelProviderId: values.defaultModelProviderId || null,
      defaultModelName: values.defaultModelName || null,
      defaultModelVersion: values.defaultModelVersion || null,
      content: values.content,
      userContent: values.userContent,
      temperature: values.temperature,
      maxTokens: values.maxTokens,
      status: values.status,
    };
  }

  async function handleSaveDraft() {
    if (!token || !editingRow) return;
    const values = await form.validateFields();
    try {
      setSubmittingDraft(true);
      await savePromptTemplateDraft(token, {
        promptType: editingRow.promptType,
        templateName: values.templateName,
        templateCode: values.templateCode,
        defaultModelProviderId: values.defaultModelProviderId || null,
        defaultModelName: values.defaultModelName || null,
        defaultModelVersion: values.defaultModelVersion || null,
        content: values.content,
        userContent: values.userContent,
        temperature: values.temperature,
        maxTokens: values.maxTokens,
      });
      message.success("提示词草稿已保存");
      const versionResponse = await fetchPromptTemplateVersions(token, editingRow.promptType);
      setVersionRows(versionResponse.data || []);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存草稿失败");
    } finally {
      setSubmittingDraft(false);
    }
  }

  async function handlePublish() {
    if (!token || !editingRow) return;
    const values = await form.validateFields();
    try {
      setSubmittingPublish(true);
      await publishPromptTemplate(token, {
        id: editingRow.templateId,
        promptType: editingRow.promptType,
        templateName: values.templateName,
        templateCode: values.templateCode,
        defaultModelProviderId: values.defaultModelProviderId || null,
        defaultModelName: values.defaultModelName || null,
        defaultModelVersion: values.defaultModelVersion || null,
        content: values.content,
        userContent: values.userContent,
        temperature: values.temperature,
        maxTokens: values.maxTokens,
        status: values.status,
      });
      message.success("系统提示词、用户提示词、默认模型和运行参数已提交后台生效");
      setEditorOpen(false);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "提交系统失败");
    } finally {
      setSubmittingPublish(false);
    }
  }

  async function handleDebug() {
    if (!token || !editingRow) return;
    const values = await debugForm.validateFields();
    const payload = currentPayload();
    try {
      setDebugging(true);
      const response = await debugPromptTemplate(token, {
        promptType: editingRow.promptType,
        modelProviderId: values.modelProviderId,
        prompt: renderTemplate(payload.userContent, { input: values.input }),
        systemPrompt: payload.content,
        temperature: values.temperature,
        maxTokens: values.maxTokens,
      });
      setDebugResult(response.data);
      message.success("测试运行完成");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "测试运行失败");
    } finally {
      setDebugging(false);
    }
  }

  return (
    <Space direction="vertical" size={24} style={{ display: "flex" }}>
      <Card variant="borderless" styles={{ body: { padding: 20 } }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button loading={syncing} onClick={() => void handleSyncDefaults()}>
              同步程序默认提示词
            </Button>
          </Space>

          <Table
            rowKey="promptType"
            dataSource={rows}
            pagination={false}
            columns={[
              { title: "提示词类型", dataIndex: "sceneName", key: "sceneName", width: 180 },
              { title: "运行编码", dataIndex: "sceneCode", key: "sceneCode", width: 180 },
              {
                title: "默认模型",
                key: "defaultModel",
                width: 220,
                render: (_value: unknown, record: PromptRow) => record.defaultModelLabel || "未配置",
              },
              {
                title: "运行参数",
                key: "runtimeParams",
                width: 180,
                render: (_value: unknown, record: PromptRow) => (
                  <span>{`T=${record.temperature ?? "-"} / Max=${record.maxTokens ?? "-"}`}</span>
                ),
              },
              {
                title: "系统提示词",
                dataIndex: "content",
                key: "content",
                ellipsis: true,
                render: (value?: string) => value || "-",
              },
              {
                title: "用户提示词",
                dataIndex: "userContent",
                key: "userContent",
                ellipsis: true,
                render: (value?: string) => value || "-",
              },
              {
                title: "状态",
                dataIndex: "status",
                key: "status",
                width: 100,
                render: (value: PromptRow["status"]) => statusTag(value),
              },
              {
                title: "操作",
                key: "actions",
                width: 220,
                render: (_value: unknown, record: PromptRow) => (
                  <Space>
                    <Button type="text" size="small" onClick={() => openEditModal(record)}>编辑</Button>
                    <Button type="text" size="small" onClick={() => openDebugModal(record)}>测试运行</Button>
                    <Button type="text" size="small" onClick={() => void openVersionDrawer(record)}>版本</Button>
                  </Space>
                ),
              },
            ]}
          />
        </Space>
      </Card>

      <Modal
        open={editorOpen}
        title="编辑提示词配置"
        onCancel={() => setEditorOpen(false)}
        footer={(
          <Space>
            <Button onClick={() => setEditorOpen(false)}>关闭</Button>
            <Button loading={submittingDraft} onClick={() => void handleSaveDraft()}>保存草稿</Button>
            <Button type="primary" loading={submittingPublish} onClick={() => void handlePublish()}>提交系统</Button>
          </Space>
        )}
        width={1320}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changedValues) => {
            if (Object.prototype.hasOwnProperty.call(changedValues, "defaultModelProviderId")) {
              const provider = providers.find((item) => item.id === Number(changedValues.defaultModelProviderId));
              const firstModel = provider?.modelCatalog?.[0];
              form.setFieldsValue({
                defaultModelName: firstModel?.name || provider?.modelName,
                defaultModelVersion: firstModel?.versions?.[0]?.value || provider?.modelVersion || provider?.modelName,
              });
            }
            if (Object.prototype.hasOwnProperty.call(changedValues, "defaultModelName")) {
              const provider = providers.find((item) => item.id === Number(form.getFieldValue("defaultModelProviderId")));
              const currentModel = (provider?.modelCatalog || []).find((item) => item.name === changedValues.defaultModelName);
              form.setFieldValue("defaultModelVersion", currentModel?.versions?.[0]?.value || provider?.modelVersion || provider?.modelName);
            }
          }}
        >
          <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="提示词类型">{editingRow?.sceneName || "-"}</Descriptions.Item>
            <Descriptions.Item label="运行编码">{editingRow?.sceneCode || "-"}</Descriptions.Item>
            <Descriptions.Item label="运行位置" span={2}>{editingRow?.runtimeUsage || "-"}</Descriptions.Item>
            <Descriptions.Item label="用途说明" span={2}>{editingRow?.description || "-"}</Descriptions.Item>
          </Descriptions>

          <Space style={{ width: "100%" }} size={16} align="start" wrap>
            <Form.Item name="templateName" label="模板名称" rules={[{ required: true, message: "请输入模板名称" }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="templateCode" label="模板编码" rules={[{ required: true, message: "请输入模板编码" }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>

          <Space style={{ width: "100%" }} size={16} align="start">
            <Form.Item name="defaultModelProviderId" label="默认模型" style={{ flex: 1 }}>
              <Select
                allowClear
                showSearch
                placeholder="选择系统管理中的对话模型"
                options={providerOptions}
              />
            </Form.Item>
            <Form.Item name="defaultModelName" label="模型名称" style={{ flex: 1 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="选择模型名称"
                options={modelNameOptions}
                disabled={!selectedProvider}
              />
            </Form.Item>
            <Form.Item
              name="defaultModelVersion"
              label="模型版本"
              style={{ flex: 1 }}
              extra={versionSelectionRedundant ? "当前 Provider 未区分独立版本，已自动使用模型名称作为版本标识。" : undefined}
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={versionSelectionRedundant ? "已自动使用模型名称作为版本" : "选择模型版本"}
                options={modelVersionOptions}
                disabled={!modelVersionOptions.length || versionSelectionRedundant}
              />
            </Form.Item>
            <Form.Item name="temperature" label="Temperature" rules={[{ required: true, message: "请输入 Temperature" }]} style={{ width: 180 }}>
              <InputNumber min={0} max={2} step={0.05} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="maxTokens" label="Max Tokens" rules={[{ required: true, message: "请输入 Max Tokens" }]} style={{ width: 180 }}>
              <InputNumber min={1} max={8000} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ width: 160 }}>
              <Select options={[{ label: "启用", value: "active" }, { label: "停用", value: "inactive" }]} />
            </Form.Item>
          </Space>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="占位变量说明"
            description="用户提示词默认支持 {{input}}。运行时会把当前槽位对应的实际输入替换进去。"
          />

          <Form.Item name="content" label="系统提示词" rules={[{ required: true, message: "请输入系统提示词" }]}>
            <Input.TextArea rows={12} placeholder="请输入该槽位当前使用的系统提示词" />
          </Form.Item>

          <Form.Item name="userContent" label="用户提示词" rules={[{ required: true, message: "请输入用户提示词" }]}>
            <Input.TextArea rows={10} placeholder="请输入该槽位当前使用的用户提示词，默认可使用 {{input}} 占位符" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={debugOpen}
        title={`测试运行${editingRow ? ` / ${editingRow.sceneName}` : ""}`}
        onCancel={() => setDebugOpen(false)}
        onOk={() => void handleDebug()}
        confirmLoading={debugging}
        width={1080}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="测试规则"
          description="测试运行会使用当前槽位的系统提示词、用户提示词模板和当前槽位参数。测试输入会替换到用户提示词里的 {{input}}。"
        />

        <Form form={debugForm} layout="vertical">
          <Space style={{ width: "100%" }} size={16} align="start">
            <Form.Item name="modelProviderId" label="测试模型" rules={[{ required: true, message: "请选择测试模型" }]} style={{ flex: 1 }}>
              <Select showSearch options={providerOptions} placeholder="从系统模型管理中选择模型" />
            </Form.Item>
            <Form.Item name="temperature" label="Temperature" rules={[{ required: true }]} style={{ width: 160 }}>
              <InputNumber min={0} max={2} step={0.05} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="maxTokens" label="Max Tokens" rules={[{ required: true }]} style={{ width: 180 }}>
              <InputNumber min={1} max={8000} style={{ width: "100%" }} />
            </Form.Item>
          </Space>
          <Form.Item name="input" label="测试输入" rules={[{ required: true, message: "请输入测试输入" }]}>
            <Input.TextArea rows={5} />
          </Form.Item>
        </Form>

        {editingRow?.content ? (
          <Card size="small" title="当前系统提示词" style={{ marginBottom: 16 }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflow: "auto" }}>
              {editingRow.content}
            </pre>
          </Card>
        ) : null}

        {editingRow?.userContent ? (
          <Card size="small" title="当前用户提示词模板" style={{ marginBottom: 16 }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflow: "auto" }}>
              {editingRow.userContent}
            </pre>
          </Card>
        ) : null}

        {renderedDebugUserPrompt ? (
          <Card size="small" title="渲染后的用户提示词" style={{ marginBottom: 16 }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflow: "auto" }}>
              {renderedDebugUserPrompt}
            </pre>
          </Card>
        ) : null}

        {debugResult ? (
          <Space direction="vertical" size={12} style={{ display: "flex" }}>
            <Card size="small" title="原始输出">
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 320, overflow: "auto" }}>
                {debugResult.rawText}
              </pre>
            </Card>
            <Card size="small" title="结构化解析">
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 320, overflow: "auto" }}>
                {JSON.stringify(debugResult.parsedJson, null, 2)}
              </pre>
            </Card>
          </Space>
        ) : null}
      </Modal>

      <Drawer
        open={versionOpen}
        title={`提示词版本${editingRow ? ` / ${editingRow.sceneName}` : ""}`}
        onClose={() => setVersionOpen(false)}
        width={1040}
      >
        <Table
          rowKey="id"
          dataSource={versionRows}
          pagination={false}
          columns={[
            { title: "版本号", dataIndex: "versionNo", width: 90 },
            { title: "版本状态", dataIndex: "versionStatus", width: 120, render: (value: string) => versionTag(value) },
            { title: "模板名称", dataIndex: "templateName", width: 180 },
            {
              title: "默认模型",
              width: 220,
              render: (_value: unknown, record: LabPromptTemplateVersionRecord) => record.defaultModelProviderName ? `${record.defaultModelProviderName} / ${record.defaultModelName || "-"} / ${record.defaultModelVersion || "-"}` : "未配置",
            },
            {
              title: "运行参数",
              width: 160,
              render: (_value: unknown, record: LabPromptTemplateVersionRecord) => (
                <span>{`T=${record.temperature ?? "-"} / Max=${record.maxTokens ?? "-"}`}</span>
              ),
            },
            { title: "创建人", dataIndex: "createdBy", width: 120 },
            { title: "发布时间", dataIndex: "publishedAt", width: 170, render: (value: string | null) => value || "-" },
            { title: "创建时间", dataIndex: "createdAt", width: 170 },
          ]}
          expandable={{
            expandedRowRender: (record) => (
              <Space direction="vertical" size={12} style={{ display: "flex" }}>
                <Card size="small" title="系统提示词">
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflow: "auto" }}>
                    {record.content}
                  </pre>
                </Card>
                <Card size="small" title="用户提示词">
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflow: "auto" }}>
                    {record.userContent}
                  </pre>
                </Card>
              </Space>
            ),
          }}
        />
      </Drawer>
    </Space>
  );
}
