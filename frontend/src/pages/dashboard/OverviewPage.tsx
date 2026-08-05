import {
  ApiOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BranchesOutlined,
  CheckOutlined,
  DatabaseOutlined,
  RadarChartOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Col, Row } from "antd";
import { useEffect, useMemo, useState } from "react";
import { ChartCard } from "../../components/ui/ChartCard";
import { FeatureCard } from "../../components/ui/FeatureCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchPlatformOverview } from "../../services/platform";
import type { PlatformOverview } from "../../types/api";

const moduleCards = [
  {
    key: "ingestion",
    title: "数据接入",
    tag: "接入",
    icon: <DatabaseOutlined />,
    description: "统一管理数据库、文件、接口和消息等接入入口，形成稳定的数据采集底座。",
    items: [
      { title: "数据源管理", summary: "统一维护连接配置、连通状态和接入对象。" },
      { title: "接入任务与文件导入", summary: "覆盖任务配置、文件上传和同步入口管理。" },
      { title: "接入概览与模型配置", summary: "统一观察运行状态，并维护接入 AI 配置。" },
    ],
  },
  {
    key: "quality",
    title: "质量管控",
    tag: "质量",
    icon: <SafetyCertificateOutlined />,
    description: "围绕质量规则、策略任务和问题分析形成质量检测与闭环治理链路。",
    items: [
      { title: "质量数据源与监控表", summary: "独立维护质量监控范围和表级纳管清单。" },
      { title: "规则与策略配置", summary: "沉淀校验规则、监控策略和推荐结果。" },
      { title: "任务执行与问题分析", summary: "覆盖质量任务调度、结果分析和异常追踪。" },
    ],
  },
  {
    key: "development",
    title: "数据开发",
    tag: "开发",
    icon: <BranchesOutlined />,
    description: "围绕 SQL 开发、编排和模型增强提供日常数据生产与开发协同能力。",
    items: [
      { title: "开发数据源", summary: "独立维护开发场景使用的数据源配置。" },
      { title: "SQL分析与算子平台", summary: "支持 SQL 调试、SQL任务管理、算子任务设计与统一工作流调度。" },
      { title: "模型管理与实例监控", summary: "维护开发模型配置并查看运行实例状态。" },
    ],
  },
  {
    key: "data-map",
    title: "数据地图",
    tag: "地图",
    icon: <SearchOutlined />,
    description: "围绕资源目录和元数据资产建立统一检索、画像、血缘和归属管理视图。",
    items: [
      { title: "部门与业务系统", summary: "维护资源归属的组织和业务系统主数据。" },
      { title: "独立数据源与组织分类", summary: "沉淀地图专属数据源和资源组织目录。" },
      { title: "资源检索与画像血缘", summary: "支持资源搜索、详情画像、字段和血缘查看。" },
    ],
  },
  {
    key: "lab",
    title: "数据建模",
    tag: "建模",
    icon: <BarChartOutlined />,
    description: "覆盖行业调研、逻辑设计、物理实现到部署验证的完整建模建设链路。",
    items: [
      { title: "行业调研与模型概览", summary: "沉淀行业研究结果并汇总建模阶段态势。" },
      { title: "逻辑模型与物理模型", summary: "支撑模型抽象设计、物理落库与结构演进。" },
      { title: "模型部署与质量报告", summary: "覆盖模拟数据、部署预览和质量评估输出。" },
    ],
  },
  {
    key: "service",
    title: "数据服务",
    tag: "服务",
    icon: <ApiOutlined />,
    description: "通过服务目录、授权和调用分析向业务应用输出统一的数据消费能力。",
    items: [
      { title: "服务开发与目录", summary: "维护数据服务清单、接口定义和发布入口。" },
      { title: "应用授权与服务测试", summary: "支持应用接入授权、接口测试和调用校验。" },
      { title: "调用分析与模型管理", summary: "查看运行数据，并维护服务场景模型配置。" },
    ],
  },
  {
    key: "reporting",
    title: "报表平台",
    tag: "报表",
    icon: <AppstoreOutlined />,
    description: "围绕报表开发沉淀数据集、图表资产、主题模板和可视化交付能力。",
    items: [
      { title: "报表数据源", summary: "独立维护报表连接，保证和其他模块隔离使用。" },
      { title: "数据集市与图表资产", summary: "沉淀可复用的数据集和图表模板资产。" },
      { title: "报表开发与模板中心", summary: "支持看板开发、主题模板和模型配置管理。" },
    ],
  },
  {
    key: "system",
    title: "系统管理",
    tag: "治理",
    icon: <SettingOutlined />,
    description: "统一负责用户权限、模型服务和平台知识库等底层治理配置。",
    items: [
      { title: "用户角色与权限", summary: "统一维护账号与角色授权。" },
      { title: "模型服务与平台服务", summary: "维护模型提供方、系统服务和运行配置。" },
      { title: "平台知识库", summary: "沉淀行业、平台和个人知识库治理能力。" },
    ],
  },
];

const operatingLanes = [
  {
    title: "生产接入主线",
    summary: "由数据接入、质量管控和数据开发共同承接采集、校验、开发与编排。 ",
  },
  {
    title: "资源治理主线",
    summary: "由数据地图统一沉淀部门、系统、数据源、资源目录和血缘画像。 ",
  },
  {
    title: "服务输出主线",
    summary: "由数据服务和报表平台承接接口化与可视化两类消费出口。 ",
  },
  {
    title: "智能运营主线",
    summary: "由系统管理沉淀模型、知识与权限治理能力。",
  },
];

export function OverviewPage() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<PlatformOverview | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetchPlatformOverview(token).then((response) => setOverview(response.data));
  }, [token]);

  const stats = useMemo(() => {
    const base = Object.fromEntries((overview?.stats || []).map((item) => [item.key, Number(item.value || 0)]));
    return [
      {
        key: "dataSourceCount",
        label: "数据源池",
        value: Number(base.dataSourceCount || 0),
        icon: <DatabaseOutlined />,
        description: "跨模块已纳管的连接资源",
      },
      {
        key: "ingestionJobCount",
        label: "接入任务",
        value: Number(base.ingestionJobCount || 0),
        icon: <RadarChartOutlined />,
        description: "数据接入模块的采集作业",
      },
      {
        key: "qualityRuleCount",
        label: "质量规则",
        value: Number(base.qualityRuleCount || 0),
        icon: <SafetyCertificateOutlined />,
        description: "已启用的检测规则与标准",
      },
      {
        key: "processingJobCount",
        label: "开发编排",
        value: Number(base.processingJobCount || 0),
        icon: <BranchesOutlined />,
        description: "SQL 与编排相关的作业量",
      },
      {
        key: "dataModelCount",
        label: "建模资产",
        value: Number(base.dataModelCount || 0),
        icon: <BarChartOutlined />,
        description: "逻辑模型、物理模型与实例资产",
      },
      {
        key: "serviceApiCount",
        label: "服务发布",
        value: Number(base.serviceApiCount || 0),
        icon: <ApiOutlined />,
        description: "对外可用的数据服务接口",
      },
    ];
  }, [overview]);

  const assetOverviewOption = useMemo(
    () => ({
      tooltip: { trigger: "item" },
      grid: { left: 24, right: 24, top: 24, bottom: 8, containLabel: true },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#eef2f7" } },
        axisLabel: { color: "#98a2b3" },
      },
      yAxis: {
        type: "category",
        data: stats.map((item) => item.label),
        axisLabel: { color: "#667085" },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: "bar",
          barWidth: 14,
          label: {
            show: true,
            position: "right",
            color: "#1d2939",
            fontWeight: 600,
          },
          data: stats.map((item, index) => ({
            value: item.value,
            itemStyle: {
              color: index % 2 === 0 ? "#1677ff" : "#69b1ff",
              borderRadius: [0, 8, 8, 0],
            },
          })),
        },
      ],
    }),
    [stats]
  );

  return (
    <div className="app-page">
      <PageHeader
        title="平台总览"
        eyebrow="Platform Overview"
        description="围绕数据接入、质量管控、数据开发、数据地图、数据建模、数据服务、报表平台和系统管理，汇总当前能力结构与核心资产规模。"
      />

      <div className="app-page-body">
        <div className="kpi-grid overview-kpi-grid">
          {stats.map((item) => (
            <StatCard key={item.key} title={item.label} value={item.value} icon={item.icon} description={item.description} />
          ))}
        </div>

        <Row gutter={[16, 16]}>
          {moduleCards.map((card) => (
            <Col xs={24} lg={12} xl={8} key={card.key}>
              <FeatureCard title={card.title} description={card.description} icon={card.icon} tag={card.tag}>
                <div className="soft-list soft-list--compact">
                  {card.items.map((item) => (
                    <div className="soft-list__item" key={item.title}>
                      <div>
                        <div className="soft-list__title">{item.title}</div>
                        <div className="soft-list__meta" title={item.summary}>
                          {item.summary}
                        </div>
                      </div>
                      <CheckOutlined style={{ color: "#1677ff", marginTop: 4 }} />
                    </div>
                  ))}
                </div>
              </FeatureCard>
            </Col>
          ))}
        </Row>

        <div className="body-card-grid">
          <div className="span-7">
            <ChartCard
              title="核心资产统计"
              description="基于当前总览接口返回的实际统计值，快速查看平台建设体量。"
              option={assetOverviewOption}
              height={340}
            />
          </div>
          <div className="span-5">
            <FeatureCard
              title="平台建设主线"
              description="当前平台围绕生产接入、资源治理、服务输出和智能运营四条主线持续建设。"
              icon={<AppstoreOutlined />}
              tag="主线"
            >
              <div className="soft-list soft-list--compact">
                {operatingLanes.map((item) => (
                  <div className="soft-list__item" key={item.title}>
                    <div>
                      <div className="soft-list__title">{item.title}</div>
                      <div className="soft-list__meta" title={item.summary}>
                        {item.summary}
                      </div>
                    </div>
                    <CheckOutlined style={{ color: "#1677ff", marginTop: 4 }} />
                  </div>
                ))}
              </div>
            </FeatureCard>
          </div>
        </div>
      </div>
    </div>
  );
}
