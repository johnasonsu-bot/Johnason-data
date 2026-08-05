import { Button, Card, Collapse, Descriptions, Form, Input, Select, Space, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchSystemKnowledgeBases } from "../../services/systemKnowledgeBases";
import { analyzeScene, createScene, fetchSceneDetail, generateSchema, updateScene, type LabScenePayload } from "../../services/dataLab";
import type { SystemKnowledgeBaseRecord, LabSceneAnalysisRecord, LabSceneRecord } from "../../types/api";
import { DataLabSceneTopNav } from "./DataLabSceneTopNav";

type SceneDefinitionValues = Pick<LabScenePayload, "sceneName" | "sceneDesc" | "industryKbIds">;
type TableSpecPreview = { tableName: string; tableLabel?: string; tableComment?: string };
type DictSuggestionPreview = { dictType?: string; tableName?: string; dictName?: string; tableComment?: string };

function safeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeArray<T = Record<string, unknown>>(value: unknown) {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeStringArray(value: unknown) {
  return Array.from(new Set(safeArray(value).map((item) => String(item || "").trim()).filter(Boolean)));
}

function renderJson(value: unknown) {
  return <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 480, overflow: "auto" }}>{JSON.stringify(value, null, 2)}</pre>;
}

function hasIndustryScope(record: SystemKnowledgeBaseRecord) {
  return (record.tags || []).some((tag) => tag === "scope:industry" || tag === "scope:industry_category");
}

export function DataLabSceneEditorPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [scene, setScene] = useState<LabSceneRecord | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<SystemKnowledgeBaseRecord[]>([]);
  const [analysis, setAnalysis] = useState<LabSceneAnalysisRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form] = Form.useForm<SceneDefinitionValues>();
  const selectedIndustryKbIds = Form.useWatch("industryKbIds", form) || [];
  const sceneId = id ? Number(id) : scene?.id;

  useEffect(() => {
    if (!token) return;
    fetchSystemKnowledgeBases(token)
      .then((response) => setKnowledgeBases(response.data.filter((item) => item.status === "active" && hasIndustryScope(item))))
      .catch(() => setKnowledgeBases([]));
  }, [token]);

  useEffect(() => {
    if (!token || !id) return;
    fetchSceneDetail(token, Number(id)).then((response) => {
      const detail = response.data;
      setScene(detail);
      form.setFieldsValue({
        sceneName: detail.sceneName,
        sceneDesc: detail.sceneDesc || undefined,
        industryKbIds: detail.industryKbIds || (detail.industryKbId ? [detail.industryKbId] : undefined),
      });
    });
  }, [form, id, token]);

  const selectedKnowledgeBases = useMemo(() => knowledgeBases.filter((item) => selectedIndustryKbIds.includes(item.id)), [knowledgeBases, selectedIndustryKbIds]);
  const latestSchemaContent = scene?.schemaVersions?.[0]?.content || null;
  const activeAnalysis = analysis || (latestSchemaContent ? {
    sceneId: scene?.id || 0,
    sceneName: scene?.sceneName || "",
    sceneDesc: scene?.sceneDesc || null,
    industryKbIds: scene?.industryKbIds || (scene?.industryKbId ? [scene.industryKbId] : []),
    industryKbNames: scene?.industryKbNames || (scene?.industryKbName ? [scene.industryKbName] : []),
    industryKbId: scene?.industryKbId || null,
    industryKbName: scene?.industryKbName || null,
    scenarioProfile: safeObject(latestSchemaContent?.scenarioProfile),
    researchPack: safeObject(latestSchemaContent?.researchPack),
    modulePlan: safeObject(latestSchemaContent?.modulePlan),
    conceptPlan: safeObject(latestSchemaContent?.conceptPlan),
    summary: String(latestSchemaContent?.researchPack?.summary || latestSchemaContent?.modulePlan?.summary || latestSchemaContent?.conceptPlan?.summary || ""),
  } : null);
  const scenarioProfile = safeObject(activeAnalysis?.scenarioProfile);
  const researchPack = safeObject(activeAnalysis?.researchPack);
  const modulePlan = safeObject(activeAnalysis?.modulePlan);
  const conceptPlan = safeObject(activeAnalysis?.conceptPlan);
  const candidateTableSpecs = useMemo(() => {
    const specs = safeArray(researchPack.candidateTableSpecs);
    return specs.length > 0 ? specs : normalizeStringArray(researchPack.candidateTables).map((tableName) => ({ tableName }));
  }, [researchPack]);
  const dictSuggestionSpecs = useMemo(() => {
    const specs = safeArray(researchPack.dictSuggestionSpecs);
    return specs.length > 0 ? specs as DictSuggestionPreview[] : normalizeStringArray(researchPack.dictSuggestions).map((dictType) => ({ dictType })) as DictSuggestionPreview[];
  }, [researchPack]);
  const relationSuggestions = normalizeStringArray(researchPack.relationSuggestions);

  async function loadSceneDetail(targetSceneId: number) {
    if (!token) return null;
    const response = await fetchSceneDetail(token, targetSceneId);
    setScene(response.data);
    form.setFieldsValue({
      sceneName: response.data.sceneName,
      sceneDesc: response.data.sceneDesc || undefined,
      industryKbIds: response.data.industryKbIds || (response.data.industryKbId ? [response.data.industryKbId] : undefined),
    });
    return response.data;
  }

  async function persistScene(values: SceneDefinitionValues) {
    if (!token) throw new Error("未获取到登录信息");
    const payload: LabScenePayload = {
      sceneName: values.sceneName,
      sceneDesc: values.sceneDesc,
      industryKbIds: (values.industryKbIds || []).map((item) => Number(item)).filter(Boolean),
    };
    if (id) {
      await updateScene(token, { ...payload, id: Number(id) });
      return Number(id);
    }
    const response = await createScene(token, payload);
    return response.data.id;
  }

  async function handleSave() {
    if (!token) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      const nextSceneId = await persistScene(values);
      await loadSceneDetail(nextSceneId);
      message.success("场景定义已保存");
      if (!id) navigate(`/dashboard/data-modeling/scene-editor/${nextSceneId}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleGeneratePlan() {
    if (!token) return;
    const values = await form.validateFields();
    setGenerating(true);
    const key = "scene-plan-generate";
    try {
      message.loading({ key, content: "正在基于场景信息和行业知识库分析并生成逻辑模型", duration: 0 });
      const nextSceneId = await persistScene(values);
      if (!id) navigate(`/dashboard/data-modeling/scene-editor/${nextSceneId}`, { replace: true });
      const analysisResponse = await analyzeScene(token, nextSceneId);
      setAnalysis(analysisResponse.data);
      await generateSchema(token, nextSceneId);
      await loadSceneDetail(nextSceneId);
      message.success({ key, content: "场景分析和逻辑模型生成已完成，请进入逻辑模型设计页继续调整", duration: 2 });
    } catch (error) {
      message.error({ key, content: error instanceof Error ? error.message : "逻辑模型生成失败", duration: 3 });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <DataLabSceneTopNav
        sceneId={sceneId}
        activeKey="edit"
        title={id ? "场景定义" : "新建场景"}
        description="这里填写场景名称、场景描述和行业知识库。点击一次即可完成大模型分析并生成逻辑模型。"
      />

      <Card bordered={false}>
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            系统会综合多个行业知识库内容，结合你填写的场景信息做深度分析，直接生成满足场景要求的逻辑模型。
          </Typography.Paragraph>

          <Form layout="vertical" form={form}>
            <Form.Item name="sceneName" label="场景名称" rules={[{ required: true, message: "请输入场景名称" }]}>
              <Input placeholder="例如：城市公交运营、企业采购审计、电商退款审核" />
            </Form.Item>
            <Form.Item name="sceneDesc" label="场景描述">
              <Input.TextArea rows={5} placeholder="请描述业务过程、涉及对象、核心单据和主要事件。描述越具体，分析和逻辑模型越稳定。" />
            </Form.Item>
            <Form.Item name="industryKbIds" label="行业知识库" rules={[{ required: true, message: "请选择至少一个行业知识库" }]}>
              <Select mode="multiple" showSearch optionFilterProp="label" placeholder="可多选，来源为系统管理-知识库管理-行业知识库" options={knowledgeBases.map((item) => ({ label: item.kbName, value: item.id }))} />
            </Form.Item>
          </Form>

          {selectedKnowledgeBases.length > 0 ? (
            <Card size="small" title="已选行业知识库">
              <Space direction="vertical" size={8} style={{ display: "flex" }}>
                <Typography.Text type="secondary">系统会综合多个知识库内容，并结合用户场景做深度分析。</Typography.Text>
                <Space wrap>{selectedKnowledgeBases.map((item) => <Tag key={item.id}>{item.kbName}</Tag>)}</Space>
              </Space>
            </Card>
          ) : null}

          <Space>
            <Button onClick={() => void handleSave()} loading={saving}>保存草稿</Button>
            <Button type="primary" onClick={() => void handleGeneratePlan()} loading={generating}>分析并生成逻辑模型</Button>
            {sceneId && latestSchemaContent ? <Button onClick={() => navigate(`/dashboard/data-modeling/schema/${sceneId}`)}>进入逻辑模型设计</Button> : null}
          </Space>
        </Space>
      </Card>

      {activeAnalysis ? (
        <Card bordered={false} title="场景分析与规划上下文">
          <Space direction="vertical" size={16} style={{ display: "flex" }}>
            <Descriptions bordered size="small" column={3}>
              <Descriptions.Item label="行业知识库" span={3}>{String((activeAnalysis.industryKbNames || scene?.industryKbNames || []).join(" / ") || activeAnalysis.industryKbName || scene?.industryKbName || "-")}</Descriptions.Item>
              <Descriptions.Item label="识别行业">{String(scenarioProfile.referenceIndustry || scenarioProfile.industry || "-")}</Descriptions.Item>
              <Descriptions.Item label="识别子场景">{String(scenarioProfile.referenceSubScenario || scenarioProfile.subScenario || scenarioProfile.subtype || "-")}</Descriptions.Item>
              <Descriptions.Item label="候选业务表">{candidateTableSpecs.length}</Descriptions.Item>
              <Descriptions.Item label="字典建议">{dictSuggestionSpecs.length}</Descriptions.Item>
              <Descriptions.Item label="关系建议">{relationSuggestions.length}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title="分析摘要"><Space direction="vertical" size={8} style={{ display: "flex" }}>{activeAnalysis.summary ? <Typography.Text>{String(activeAnalysis.summary)}</Typography.Text> : null}{modulePlan.summary ? <Typography.Text type="secondary">{String(modulePlan.summary)}</Typography.Text> : null}{conceptPlan.summary ? <Typography.Text type="secondary">{String(conceptPlan.summary)}</Typography.Text> : null}</Space></Card>
            <Card size="small" title="候选业务表"><Space wrap>{candidateTableSpecs.map((item, index) => <Tag key={`${String((item as Record<string, unknown>).tableName || "table")}-${index}`}>{String((item as Record<string, unknown>).tableName || "")}{String((item as Record<string, unknown>).tableLabel || (item as Record<string, unknown>).tableComment || "").trim() ? ` / ${String((item as Record<string, unknown>).tableLabel || (item as Record<string, unknown>).tableComment || "").trim()}` : ""}</Tag>)}</Space></Card>
            {dictSuggestionSpecs.length > 0 ? <Card size="small" title="字典表建议"><Space wrap>{dictSuggestionSpecs.map((item, index) => <Tag key={`${String((item as Record<string, unknown>).dictType || (item as Record<string, unknown>).tableName || "dict")}-${index}`}>{String((item as Record<string, unknown>).dictType || (item as Record<string, unknown>).tableName || "")}{String((item as Record<string, unknown>).dictName || (item as Record<string, unknown>).tableComment || "").trim() ? ` / ${String((item as Record<string, unknown>).dictName || (item as Record<string, unknown>).tableComment || "").trim()}` : ""}</Tag>)}</Space></Card> : null}
            {relationSuggestions.length > 0 ? <Card size="small" title="表关系建议"><Space wrap>{relationSuggestions.map((item) => <Tag key={item}>{item}</Tag>)}</Space></Card> : null}
            <Collapse size="small" items={[{ key: "recognition-json", label: "场景识别 JSON", children: renderJson(scenarioProfile) }, { key: "research-json", label: "场景分析 JSON", children: renderJson(researchPack) }, { key: "module-json", label: "模块规划 JSON", children: renderJson(modulePlan) }, { key: "raw-json", label: "原始结果 JSON", children: renderJson(activeAnalysis) }]} defaultActiveKey={["recognition-json", "research-json", "module-json"]} />
          </Space>
        </Card>
      ) : null}
    </Space>
  );
}