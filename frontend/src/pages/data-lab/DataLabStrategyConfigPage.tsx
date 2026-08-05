import { Button, Card, Form, InputNumber, Modal, Select, Space, Switch, Table, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  confirmStrategy,
  fetchSceneDetail,
  generateDirtyScript,
  generateStrategy,
  initScene,
  runSceneOnce,
  updateScene,
  type LabScenePayload,
} from "../../services/dataLab";
import type { LabSceneRecord } from "../../types/api";
import { DataLabSceneTopNav } from "./DataLabSceneTopNav";

type DataGenerationValues = Pick<
  LabScenePayload,
  "initVolume" | "incrVolume" | "incrCycle" | "dirtyRatio" | "realtimeEnabled"
>;

const CYCLE_OPTIONS = [
  { label: "分钟", value: "MINUTE" },
  { label: "小时", value: "HOUR" },
  { label: "天", value: "DAILY" },
];

export function DataLabStrategyConfigPage() {
  const { token } = useAuth();
  const { id } = useParams();
  const [scene, setScene] = useState<LabSceneRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [runningInit, setRunningInit] = useState(false);
  const [runningIncr, setRunningIncr] = useState(false);
  const [dirtyScriptLoading, setDirtyScriptLoading] = useState(false);
  const [dirtyScriptOpen, setDirtyScriptOpen] = useState(false);
  const [dirtyScriptResult, setDirtyScriptResult] = useState<Record<string, unknown> | null>(null);
  const [form] = Form.useForm<DataGenerationValues>();

  async function load() {
    if (!token || !id) return;
    const response = await fetchSceneDetail(token, Number(id));
    const nextScene = response.data;
    setScene(nextScene);
    form.setFieldsValue({
      initVolume: nextScene.initVolume,
      incrVolume: nextScene.incrVolume,
      incrCycle: nextScene.incrCycle as DataGenerationValues["incrCycle"],
      dirtyRatio: nextScene.dirtyRatio,
      realtimeEnabled: nextScene.realtimeEnabled,
    });
  }

  useEffect(() => {
    void load();
  }, [token, id]);

  const latest = scene?.strategyVersions?.[0];
  const tables = useMemo(
    () => ((latest?.content?.tables || []) as Array<Record<string, unknown>>),
    [latest?.id]
  );

  async function saveGenerationSettings(values: DataGenerationValues) {
    if (!token || !scene) {
      throw new Error("缺少场景上下文");
    }
    const dirtyRatio = Number(values.dirtyRatio || 0);
    await updateScene(token, {
      id: scene.id,
      sceneName: scene.sceneName,
      sceneDesc: scene.sceneDesc || undefined,
      industryKbId: scene.industryKbId || undefined,
      enhancementProfileId: scene.enhancementProfileId || undefined,
      initVolume: Number(values.initVolume || scene.initVolume || 1000),
      incrVolume: Number(values.incrVolume || scene.incrVolume || 100),
      incrCycle: (values.incrCycle as LabScenePayload["incrCycle"]) || (scene.incrCycle as LabScenePayload["incrCycle"]) || "DAILY",
      dirtyEnabled: dirtyRatio > 0,
      dirtyRatio,
      realtimeEnabled: Boolean(values.realtimeEnabled),
    });
  }

  async function handleSave() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await saveGenerationSettings(values);
      await load();
      message.success("数据生成参数已保存");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateConfig() {
    if (!token || !id) return;
    const values = await form.validateFields();
    const key = "data-generation-config";
    setGenerating(true);
    try {
      message.loading({ key, content: "正在生成数据生成配置", duration: 0 });
      await saveGenerationSettings(values);
      await generateStrategy(token, {
        sceneId: Number(id),
        initVolume: Number(values.initVolume || 1000),
        incrVolume: Number(values.incrVolume || 100),
        incrCycle: values.incrCycle || "DAILY",
        dirtyEnabled: Number(values.dirtyRatio || 0) > 0,
        dirtyRatio: Number(values.dirtyRatio || 0),
        realtimeEnabled: Boolean(values.realtimeEnabled),
      });
      await load();
      message.success({ key, content: "数据生成配置已生成", duration: 2 });
    } catch (error) {
      message.error({ key, content: error instanceof Error ? error.message : "生成数据配置失败", duration: 3 });
    } finally {
      setGenerating(false);
    }
  }

  async function handleConfirmConfig() {
    if (!token || !id) return;
    const key = "data-generation-confirm";
    setConfirming(true);
    try {
      message.loading({ key, content: "正在确认数据生成配置", duration: 0 });
      await confirmStrategy(token, Number(id));
      await load();
      message.success({ key, content: "数据生成配置已确认", duration: 2 });
    } catch (error) {
      message.error({ key, content: error instanceof Error ? error.message : "确认数据生成配置失败", duration: 3 });
    } finally {
      setConfirming(false);
    }
  }

  async function handleRunInit() {
    if (!token || !id) return;
    const key = "data-generation-init";
    setRunningInit(true);
    try {
      message.loading({ key, content: "正在生成首批测试数据", duration: 0 });
      await initScene(token, Number(id));
      await load();
      message.success({ key, content: "首批测试数据已生成", duration: 2 });
    } catch (error) {
      message.error({ key, content: error instanceof Error ? error.message : "生成首批数据失败", duration: 3 });
    } finally {
      setRunningInit(false);
    }
  }

  async function handleRunIncrement() {
    if (!token || !id) return;
    const key = "data-generation-incr";
    setRunningIncr(true);
    try {
      message.loading({ key, content: "正在生成增量测试数据", duration: 0 });
      await runSceneOnce(token, Number(id));
      await load();
      message.success({ key, content: "增量测试数据已生成", duration: 2 });
    } catch (error) {
      message.error({ key, content: error instanceof Error ? error.message : "生成增量数据失败", duration: 3 });
    } finally {
      setRunningIncr(false);
    }
  }

  async function handleGenerateDirtyScript() {
    if (!token || !id) return;
    const values = await form.validateFields();
    const key = "data-generation-dirty-script";
    setDirtyScriptLoading(true);
    try {
      message.loading({ key, content: "正在生成脏数据后处理脚本", duration: 0 });
      const response = await generateDirtyScript(token, Number(id), {
        dirtyRatio: Number(values.dirtyRatio || 0.05),
        sampleTables: 3,
        sampleRows: 3,
      });
      setDirtyScriptResult(response.data);
      setDirtyScriptOpen(true);
      message.success({ key, content: "脏数据脚本已生成", duration: 2 });
    } catch (error) {
      message.error({ key, content: error instanceof Error ? error.message : "生成脏数据脚本失败", duration: 3 });
    } finally {
      setDirtyScriptLoading(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <DataLabSceneTopNav
        sceneId={id ? Number(id) : undefined}
        activeKey="strategy"
        title="数据生成"
        description="在这里维护生成规模、增量周期、脏数据比例和实时开关，并执行测试数据生成。"
      />

      <Card bordered={false}>
        <Form form={form} layout="vertical">
          <Space size={16} align="start" style={{ width: "100%" }}>
            <Form.Item name="initVolume" label="初始化规模" style={{ minWidth: 180 }}>
              <InputNumber min={1} max={1000000} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="incrVolume" label="增量规模" style={{ minWidth: 180 }}>
              <InputNumber min={1} max={1000000} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="incrCycle" label="增量周期" style={{ minWidth: 160 }}>
              <Select options={CYCLE_OPTIONS} />
            </Form.Item>
            <Form.Item name="dirtyRatio" label="脏数据比例" style={{ minWidth: 180 }}>
              <InputNumber min={0} max={1} step={0.01} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="realtimeEnabled" label="实时生成" valuePropName="checked" style={{ minWidth: 120 }}>
              <Switch />
            </Form.Item>
          </Space>
        </Form>

        <Space>
          <Button onClick={() => void handleSave()} loading={saving}>保存参数</Button>
          <Button type="primary" onClick={() => void handleGenerateConfig()} loading={generating}>生成配置</Button>
          <Button onClick={() => void handleConfirmConfig()} loading={confirming}>确认配置</Button>
          <Button onClick={() => void handleRunInit()} loading={runningInit}>生成首批数据</Button>
          <Button onClick={() => void handleRunIncrement()} loading={runningIncr}>生成增量数据</Button>
          <Button onClick={() => void handleGenerateDirtyScript()} loading={dirtyScriptLoading}>生成脏数据脚本</Button>
        </Space>
      </Card>

      <Card bordered={false} title="当前配置摘要">
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          当前页只关注数据生成参数，不再承载复杂策略解释、自然语言调参和脏规则细节维护。
        </Typography.Paragraph>
        <Table
          rowKey={(record) => String(record.tableName)}
          dataSource={tables}
          pagination={false}
          columns={[
            { title: "表名", dataIndex: "tableName" },
            { title: "初始化", dataIndex: "initRows", width: 100 },
            { title: "增量", dataIndex: "incrRows", width: 100 },
            { title: "写入方式", dataIndex: "writeMode", width: 140 },
            { title: "Topic", dataIndex: "topicName" },
          ]}
        />
      </Card>

      <Modal
        open={dirtyScriptOpen}
        title="脏数据后处理脚本"
        onCancel={() => setDirtyScriptOpen(false)}
        footer={null}
        width={980}
        destroyOnHidden
      >
        {dirtyScriptResult ? (
          <Space direction="vertical" size={12} style={{ display: "flex" }}>
            <Typography.Paragraph>{String(dirtyScriptResult.summary || "已生成脏数据后处理脚本")}</Typography.Paragraph>
            <Typography.Text type="secondary">
              方言：{String(dirtyScriptResult.scriptLanguage || "-")} / 使用模型：{dirtyScriptResult.usedModel ? "是" : "否"}
            </Typography.Text>
            <Card size="small" title="操作清单">
              <Table
                rowKey={(_, index) => String(index)}
                dataSource={Array.isArray(dirtyScriptResult.operationChecklist) ? dirtyScriptResult.operationChecklist : []}
                pagination={false}
                columns={[
                  { title: "表", dataIndex: "tableName", width: 180 },
                  { title: "动作", dataIndex: "actionType", width: 180 },
                  { title: "字段", dataIndex: "fieldName", width: 180 },
                  { title: "说明", dataIndex: "description" },
                ]}
              />
            </Card>
            <Card size="small" title="脚本内容">
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{String(dirtyScriptResult.scriptContent || "")}</pre>
            </Card>
          </Space>
        ) : null}
      </Modal>
    </Space>
  );
}
