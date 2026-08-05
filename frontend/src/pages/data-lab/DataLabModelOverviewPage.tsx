import {
  ArrowRightOutlined,
  BgColorsOutlined,
  BranchesOutlined,
  DeploymentUnitOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Card, Progress, Tag, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  fetchBusinessSystemInstances,
  fetchBusinessSystemTemplates,
  fetchIndustryDataSources,
  fetchIndustryIncubations,
  fetchLabDataSources,
} from "../../services/dataLab";
import type {
  DataSourceRecord,
  LabBusinessSystemInstanceRecord,
  LabBusinessSystemTemplateRecord,
  LabIndustryDataSourceRecord,
  LabIndustryIncubationRecord,
} from "../../types/api";
import { isScenarioDatabaseSource } from "../../utils/datasource";

type StageItem = {
  key: string;
  stage: string;
  title: string;
  summary: string;
  route: string;
  icon: ReactNode;
  heroMetric: { label: string; value: number; helper: string };
  progress: { current: number; total: number };
  capabilities: Array<{ title: string; description: string }>;
  deliverables: Array<{ title: string; description: string }>;
  values: Array<{ title: string; description: string }>;
  tags: string[];
};

function percent(current: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

export function DataLabModelOverviewPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [selectedStageKey, setSelectedStageKey] = useState("research");
  const [incubations, setIncubations] = useState<LabIndustryIncubationRecord[]>([]);
  const [templates, setTemplates] = useState<LabBusinessSystemTemplateRecord[]>([]);
  const [instances, setInstances] = useState<LabBusinessSystemInstanceRecord[]>([]);
  const [datasets, setDatasets] = useState<LabIndustryDataSourceRecord[]>([]);
  const [targetDataSources, setTargetDataSources] = useState<DataSourceRecord[]>([]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [incubationResponse, templateResponse, instanceResponse, datasetResponse, targetResponse] = await Promise.all([
        fetchIndustryIncubations(token),
        fetchBusinessSystemTemplates(token),
        fetchBusinessSystemInstances(token),
        fetchIndustryDataSources(token),
        fetchLabDataSources(token),
      ]);
      setIncubations(incubationResponse.data || []);
      setTemplates(templateResponse.data || []);
      setInstances(instanceResponse.data || []);
      setDatasets(datasetResponse.data || []);
      setTargetDataSources((targetResponse.data || []).filter((item) => isScenarioDatabaseSource(item)));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载模型概览失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const metrics = useMemo(() => {
    const activeLogicalCount = templates.filter((item) => item.templateStatus === "active").length;
    const deployedPhysicalCount = instances.filter((item) => Number(item.currentPhysicalVersion || 0) > 0).length;
    const generationReadyCount = instances.filter((item) => Number(item.currentGenerationVersion || 0) > 0).length;
    const dirtyReadyCount = instances.filter((item) => Number(item.currentDirtyVersion || 0) > 0).length;
    const readyDatasetCount = datasets.filter((item) => {
      const summary = (item.linkagePreview?.summary || {}) as Record<string, unknown>;
      return Number(summary.readyInstanceCount || 0) > 0;
    }).length;

    return {
      activeLogicalCount,
      deployedPhysicalCount,
      generationReadyCount,
      dirtyReadyCount,
      readyDatasetCount,
      totalLogicalTables: templates.reduce((sum, item) => sum + Number(item.logicalTableCount || 0), 0),
      totalRelations: templates.reduce((sum, item) => sum + Number(item.relationCount || 0), 0),
      totalRounds: incubations.reduce((sum, item) => sum + Number(item.latestRoundNo || 0), 0),
    };
  }, [datasets, incubations, instances, templates]);

  const stages = useMemo<StageItem[]>(
    () => [
      {
        key: "research",
        stage: "Stage 01",
        title: "数据调研",
        summary: "围绕行业范围、业务对象与标准依据建立研究底座，为后续模型设计提供统一认知与边界约束。",
        route: "/dashboard/data-modeling/research",
        icon: <BranchesOutlined />,
        heroMetric: {
          label: "调研专题",
          value: incubations.length,
          helper: `累计轮次 ${metrics.totalRounds}`,
        },
        progress: {
          current: incubations.filter((item) => Number(item.latestRoundNo || 0) > 0).length,
          total: incubations.length,
        },
        capabilities: [
          { title: "行业识别", description: "识别主题范围、子类目与对象边界。" },
          { title: "标准归集", description: "归并政策规范、标准文件与证据来源。" },
          { title: "口径统一", description: "沉淀术语体系与后续建模基础口径。" },
        ],
        deliverables: [
          { title: "范围清单", description: "形成结构化的行业范围、子类目与对象清单。" },
          { title: "标准资产", description: "沉淀证据索引、标准术语与研究资料。" },
          { title: "边界说明", description: "为逻辑设计提供统一的业务边界约束。" },
        ],
        values: [
          { title: "减少返工", description: "前置完成范围澄清，降低后续结构反复调整。" },
          { title: "统一认知", description: "让后续设计建立在一致的行业理解基础上。" },
          { title: "资产沉淀", description: "将一次性调研成果转化为长期可复用资产。" },
        ],
        tags: ["行业范围", "标准依据", "对象边界"],
      },
      {
        key: "logical",
        stage: "Stage 02",
        title: "逻辑建模",
        summary: "基于研究资产构建业务语义层，定义实体、主题、关系与字典结构，形成统一且稳定的逻辑蓝图。",
        route: "/dashboard/data-modeling/logical-models",
        icon: <NodeIndexOutlined />,
        heroMetric: {
          label: "逻辑模型",
          value: templates.length,
          helper: `启用模型 ${metrics.activeLogicalCount}`,
        },
        progress: {
          current: metrics.activeLogicalCount,
          total: templates.length,
        },
        capabilities: [
          { title: "实体抽象", description: "定义业务对象、主题域与核心结构。" },
          { title: "关系设计", description: "梳理逻辑表关系、主从链路与字典体系。" },
          { title: "语义统一", description: "统一命名规范与模型表达口径。" },
        ],
        deliverables: [
          { title: "模型模板", description: "形成可复用的业务系统逻辑模型模板。" },
          { title: "关系蓝图", description: "明确逻辑实体、关系链路与主题结构。" },
          { title: "逻辑版本", description: "沉淀可继承、可扩展的逻辑版本资产。" },
        ],
        values: [
          { title: "统一语义", description: "确保跨角色对模型语义的理解保持一致。" },
          { title: "支撑实现", description: "为物理实现和部署验证提供稳定语义基础。" },
          { title: "便于复用", description: "提升模型在后续扩展与实例化中的可复用性。" },
        ],
        tags: ["业务语义", "逻辑实体", "关系链路"],
      },
      {
        key: "physical",
        stage: "Stage 03",
        title: "物理实现",
        summary: "将逻辑模型映射为数据库层面的表结构、字段定义与部署目标，完成模型的工程化落地准备。",
        route: "/dashboard/data-modeling/physical-models",
        icon: <DeploymentUnitOutlined />,
        heroMetric: {
          label: "物理实例",
          value: instances.length,
          helper: `已落库 ${metrics.deployedPhysicalCount}`,
        },
        progress: {
          current: metrics.deployedPhysicalCount,
          total: instances.length,
        },
        capabilities: [
          { title: "结构映射", description: "完成逻辑对象到物理表结构的转换。" },
          { title: "约束配置", description: "配置字段类型、索引与约束策略。" },
          { title: "目标绑定", description: "绑定目标库并生成可部署实例。" },
        ],
        deliverables: [
          { title: "物理结构", description: "输出物理表结构、字段映射与 DDL 结果。" },
          { title: "部署实例", description: "生成可落库、可部署的物理模型实例。" },
          { title: "目标绑定", description: "明确模型对应的部署目标库与位置。" },
        ],
        values: [
          { title: "工程落地", description: "推动模型从逻辑设计进入工程化实施阶段。" },
          { title: "问题前置", description: "提前暴露数据库适配与字段约束问题。" },
          { title: "部署准备", description: "为样本生成、联调和正式部署奠定基础。" },
        ],
        tags: ["DDL", "目标库", "部署实例"],
      },
      {
        key: "deployment",
        stage: "Stage 04",
        title: "部署验证",
        summary: "围绕物理实例组织样本方案、脏数据与联动数据集，形成面向联调、验收与上线前检查的数据资产。",
        route: "/dashboard/data-modeling/simulation",
        icon: <BgColorsOutlined />,
        heroMetric: {
          label: "数据方案",
          value: metrics.generationReadyCount,
          helper: `联动数据集 ${metrics.readyDatasetCount}`,
        },
        progress: {
          current: metrics.readyDatasetCount + metrics.generationReadyCount,
          total: Math.max(datasets.length + instances.length, 1),
        },
        capabilities: [
          { title: "样本生成", description: "生成验证样本、场景数据与测试数据集。" },
          { title: "质量校验", description: "模拟异常样本并验证数据质量表现。" },
          { title: "联动演练", description: "验证跨实例联动与部署前可用性。" },
        ],
        deliverables: [
          { title: "数据方案", description: "输出样本方案、数据预览与结果检查材料。" },
          { title: "测试样本", description: "沉淀脏数据样本与质量验证素材。" },
          { title: "联动成果", description: "形成跨实例联动数据集与验证结果。" },
        ],
        values: [
          { title: "结果可验", description: "让模型成果在上线前具备可验证的数据结果。" },
          { title: "风险前移", description: "提前识别质量问题与联动协同风险。" },
          { title: "上线支撑", description: "为联调、验收和上线前检查提供依据。" },
        ],
        tags: ["样本方案", "质量验证", "联动数据"],
      },
    ],
    [datasets.length, incubations.length, instances.length, metrics, templates.length]
  );

  const selectedStage = stages.find((item) => item.key === selectedStageKey) || stages[0];

  useEffect(() => {
    if (!stages.some((item) => item.key === selectedStageKey)) {
      setSelectedStageKey(stages[0]?.key || "research");
    }
  }, [selectedStageKey, stages]);

  return (
    <div className="app-page model-overview-page">
      <div className="app-page-body">
        <Card bordered={false} className="surface-card model-overview__hero-card" loading={loading}>
          <div className="model-overview__hero">
            <div className="model-overview__hero-copy">
              <Typography.Text className="page-header__eyebrow">Workflow View</Typography.Text>
              <Typography.Title level={3} style={{ margin: "8px 0 10px" }}>
                从研究研判到部署验证的一体化建模路径
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                数据建模模块覆盖从行业研究、逻辑设计、物理实现到部署验证的完整建设链路，用于统一承载模型规划、结构设计、实例落地与结果验证等核心工作。
              </Typography.Paragraph>
              <div className="model-overview__summary-tags">
                <Tag bordered={false}>逻辑模型 {templates.length}</Tag>
                <Tag bordered={false}>物理实例 {instances.length}</Tag>
                <Tag bordered={false}>实体表 {metrics.totalLogicalTables}</Tag>
                <Tag bordered={false}>关系链路 {metrics.totalRelations}</Tag>
                <Tag bordered={false}>目标库 {targetDataSources.length}</Tag>
              </div>
            </div>
            <div className="model-overview__hero-side">
              <div className="model-overview__hero-metric">
                <span>当前聚焦阶段</span>
                <strong>{selectedStage.title}</strong>
                <em>{selectedStage.heroMetric.helper}</em>
              </div>
              <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadData()}>
                刷新
              </Button>
            </div>
          </div>
        </Card>

        <Card bordered={false} className="surface-card" loading={loading}>
          <div className="model-overview__section-head">
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                建设流程
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ margin: "6px 0 0" }}>
                按“研究研判 → 逻辑设计 → 物理实现 → 部署验证”组织，点击阶段卡片可切换下方详情。
              </Typography.Paragraph>
            </div>
          </div>

          <div className="model-overview__journey">
            {stages.map((item, index) => {
              const active = item.key === selectedStage.key;
              return (
                <button
                  type="button"
                  key={item.key}
                  className={`model-overview__journey-node${active ? " is-active" : ""}`}
                  onClick={() => setSelectedStageKey(item.key)}
                >
                  <div className="model-overview__journey-head">
                    <span className="model-overview__journey-icon">{item.icon}</span>
                    <span className="model-overview__flow-badge">{item.stage}</span>
                  </div>
                  <div className="model-overview__journey-title">{item.title}</div>
                  <div className="model-overview__journey-meta">
                    {item.heroMetric.label} {item.heroMetric.value}
                  </div>
                  {index < stages.length - 1 ? <span className="model-overview__journey-line" /> : null}
                </button>
              );
            })}
          </div>

          <div className="model-overview__focus">
            <div className="model-overview__focus-main">
              <div className="model-overview__focus-header">
                <div>
                  <Typography.Text className="page-header__eyebrow">{selectedStage.stage}</Typography.Text>
                  <Typography.Title level={3} style={{ margin: "8px 0 10px" }}>
                    {selectedStage.title}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {selectedStage.summary}
                  </Typography.Paragraph>
                </div>
                <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate(selectedStage.route)}>
                  进入该阶段
                </Button>
              </div>

              <div className="model-overview__focus-grid">
                <Card bordered={false} className="model-overview__focus-card">
                  <Typography.Title level={5} style={{ marginTop: 0 }}>
                    核心能力
                  </Typography.Title>
                  <div className="model-overview__capability-list">
                    {selectedStage.capabilities.map((item) => (
                      <div className="model-overview__capability-item" key={item.title}>
                        <div className="model-overview__capability-title">{item.title}</div>
                        <div className="model-overview__capability-desc">{item.description}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card bordered={false} className="model-overview__focus-card">
                  <Typography.Title level={5} style={{ marginTop: 0 }}>
                    阶段成果
                  </Typography.Title>
                  <div className="model-overview__capability-list">
                    {selectedStage.deliverables.map((item) => (
                      <div className="model-overview__capability-item" key={item.title}>
                        <div className="model-overview__capability-title">{item.title}</div>
                        <div className="model-overview__capability-desc">{item.description}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card bordered={false} className="model-overview__focus-card model-overview__focus-card--value">
                  <Typography.Title level={5} style={{ marginTop: 0 }}>
                    业务价值
                  </Typography.Title>
                  <div className="model-overview__capability-list">
                    {selectedStage.values.map((item) => (
                      <div className="model-overview__capability-item" key={item.title}>
                        <div className="model-overview__capability-title">{item.title}</div>
                        <div className="model-overview__capability-desc">{item.description}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            <div className="model-overview__focus-sidepanel">
              <Card bordered={false} className="model-overview__metric-panel">
                <div className="model-overview__metric-panel-label">{selectedStage.heroMetric.label}</div>
                <div className="model-overview__metric-panel-value">{selectedStage.heroMetric.value}</div>
                <div className="model-overview__metric-panel-helper">{selectedStage.heroMetric.helper}</div>
                <div className="model-overview__metric-panel-progress">
                  <div className="model-overview__metric-panel-progress-meta">
                    <span>阶段进展</span>
                    <span>{percent(selectedStage.progress.current, selectedStage.progress.total)}%</span>
                  </div>
                  <Progress percent={percent(selectedStage.progress.current, selectedStage.progress.total)} showInfo={false} strokeColor="#1677ff" trailColor="#e8eef7" />
                </div>
              </Card>

              <Card bordered={false} className="model-overview__metric-panel">
                <Typography.Title level={5} style={{ marginTop: 0 }}>
                  关键标签
                </Typography.Title>
                <div className="model-overview__keyword-tags">
                  {selectedStage.tags.map((item) => (
                    <Tag bordered={false} key={item}>
                      {item}
                    </Tag>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
