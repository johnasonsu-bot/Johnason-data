import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchModelProviders } from "../../services/modelProvider";
import {
  fetchAssetSearchAiRuns,
  fetchAssetSearchAiConfigs,
  updateAssetSearchAiConfig,
  type AssetSearchAiConfig,
  type AssetSearchAiRunRecord,
} from "../../services/assetSearch";
import type { ModelProviderRecord } from "../../types/api";

function buildProviderModelNameOptions(provider?: ModelProviderRecord | null) {
  return (provider?.modelCatalog || []).map((item) => ({ label: item.label, value: item.name }));
}

function buildProviderModelVersionOptions(provider?: ModelProviderRecord | null, modelName?: string) {
  const currentModel = (provider?.modelCatalog || []).find((item) => item.name === modelName)
    || provider?.modelCatalog?.[0];
  return (currentModel?.versions || []).map((item) => ({ label: item.label, value: item.value }));
}

export function AssetSearchModelManagementPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<AssetSearchAiConfig[]>([]);
  const [runs, setRuns] = useState<AssetSearchAiRunRecord[]>([]);
  const [modelProviders, setModelProviders] = useState<ModelProviderRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AssetSearchAiConfig | null>(null);
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
    const [configResponse, modelResponse, runResponse] = await Promise.all([
      fetchAssetSearchAiConfigs(token),
      fetchModelProviders(token),
      fetchAssetSearchAiRuns(token, 20),
    ]);
    setRecords(configResponse.data || []);
    setModelProviders(modelResponse.data || []);
    setRuns(runResponse.data || []);
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  function closeModal() {
    setOpen(false);
    setEditingRecord(null);
    form.resetFields();
  }

  function openEditModal(record: AssetSearchAiConfig) {
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
      description: record.description || "",
      ownerName: record.ownerName || "System Administrator",
      status: record.status || "active",
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!token || !editingRecord) return;
    const values = await form.validateFields();

    setSubmitting(true);
    try {
      await updateAssetSearchAiConfig(token, editingRecord.id, {
        defaultModelProviderId: values.defaultModelProviderId || null,
        defaultModelName: values.defaultModelName || null,
        defaultModelVersion: values.defaultModelVersion || null,
        temperature: values.temperature ?? null,
        maxTokens: values.maxTokens ?? null,
        timeoutMs: values.timeoutMs ?? null,
        systemPrompt: values.systemPrompt || "",
        description: values.description || editingRecord.description || "",
        ownerName: values.ownerName || editingRecord.ownerName,
        status: values.status || editingRecord.status,
      });
      message.success("元数据检索模型配置已更新");
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
            <Typography.Title level={4} style={{ margin: 0 }}>元数据检索模型管理</Typography.Title>
            <Typography.Text type="secondary">
              维护查询理解、关键词扩展、候选重排和结果总结四个 AI 场景。未配置默认模型时，元数据检索会自动降级为普通检索。
            </Typography.Text>
          </div>

          <Table<AssetSearchAiConfig>
            rowKey="id"
            dataSource={records}
            pagination={false}
            columns={[
              { title: "AI 类型", dataIndex: "sceneName", key: "sceneName", width: 180 },
              { title: "场景编码", dataIndex: "sceneCode", key: "sceneCode", width: 260 },
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
                width: 180,
                render: (_value, record) => `T=${record.temperature ?? "-"} / Max=${record.maxTokens ?? "-"}`,
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

      <Card variant="borderless" styles={{ body: { padding: 20 } }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>最近 AI 运行记录</Typography.Title>
            <Typography.Text type="secondary">用于确认 AI 辅助检索是否进入模型链路、是否降级、候选数量和耗时。审计记录不保存候选资产明细。</Typography.Text>
          </div>
          <Table<AssetSearchAiRunRecord>
            rowKey="id"
            dataSource={runs}
            pagination={false}
            columns={[
              { title: "时间", dataIndex: "createdAt", key: "createdAt", width: 170 },
              { title: "关键词", dataIndex: "keyword", key: "keyword", ellipsis: true, render: (value?: string) => value || "-" },
              {
                title: "状态",
                key: "status",
                width: 150,
                render: (_value, record) => (
                  <Space size={4}>
                    <Tag color={record.status === "success" ? "green" : "orange"}>{record.status === "success" ? "成功" : "降级"}</Tag>
                    {record.fallbackReason ? <Tag>{record.fallbackReason}</Tag> : null}
                  </Space>
                ),
              },
              {
                title: "阶段",
                dataIndex: "usedStages",
                key: "usedStages",
                width: 320,
                render: (value: string[]) => value?.length ? value.join(" / ") : "-",
              },
              {
                title: "数量",
                key: "counts",
                width: 140,
                render: (_value, record) => `候选 ${record.candidateCount} / 返回 ${record.resultCount}`,
              },
              {
                title: "耗时",
                dataIndex: "durationMs",
                key: "durationMs",
                width: 100,
                render: (value: number) => `${value || 0}ms`,
              },
              {
                title: "错误摘要",
                dataIndex: "errorMessage",
                key: "errorMessage",
                ellipsis: true,
                render: (value?: string | null) => value || "-",
              },
            ]}
          />
        </Space>
      </Card>

      <Modal open={open} title="编辑元数据检索模型配置" onCancel={closeModal} onOk={() => void handleSubmit()} confirmLoading={submitting} width={820}>
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
          <Form.Item name="sceneName" label="AI 类型"><Input disabled /></Form.Item>
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
            <Input.TextArea rows={10} />
          </Form.Item>
          <Form.Item name="description" label="说明"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="ownerName" label="负责人"><Input /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
