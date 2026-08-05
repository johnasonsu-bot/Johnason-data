import {
  AppstoreOutlined,
  BarChartOutlined,
  BgColorsOutlined,
  DatabaseOutlined,
  DotChartOutlined,
  CheckOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Col, Row, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { FeatureCard } from "../../components/ui/FeatureCard";
import { StatCard } from "../../components/ui/StatCard";
import { fetchReportingOverview } from "../../services/reporting";
import type { ReportingOverview } from "../../types/api";

const moduleCards = [
  {
    key: "sources",
    title: "数据源管理",
    tag: "连接",
    icon: <DatabaseOutlined />,
    description: "独立维护报表连接，和其他模块隔离管理。",
    items: [
      { title: "连接配置", summary: "维护库连接、账号、状态和负责人。" },
      { title: "连通验证", summary: "进入数据集定义前先确认连接可用。" },
    ],
  },
  {
    key: "datasets",
    title: "数据集市",
    tag: "复用",
    icon: <DotChartOutlined />,
    description: "把表或 SQL 沉淀成可复用的数据集。",
    items: [
      { title: "表 / SQL 双模式", summary: "支持直接选表，也支持沉淀查询 SQL。" },
      { title: "预览校验", summary: "保存前先看字段和样例结果。" },
    ],
  },
  {
    key: "charts",
    title: "图表资产",
    tag: "图表",
    icon: <AppstoreOutlined />,
    description: "统一管理内置和自定义图表模板。",
    items: [
      { title: "模板管理", summary: "集中维护常用图表模板和分类标签。" },
      { title: "自定义资产", summary: "支持沉淀自定义配置供多个看板复用。" },
    ],
  },
  {
    key: "dashboards",
    title: "报表开发",
    tag: "画布",
    icon: <BarChartOutlined />,
    description: "在独立画布里组合数据、图表和组件配置。",
    items: [
      { title: "画布编排", summary: "拖入图表、调整布局并绑定数据。" },
      { title: "预览分享", summary: "支持运行预览和分享链接。" },
    ],
  },
  {
    key: "templates",
    title: "模板中心",
    tag: "主题",
    icon: <BgColorsOutlined />,
    description: "统一管理画布、容器和图表的主题模板。",
    items: [
      { title: "主题模板", summary: "维护画布、容器和图表风格参数。" },
      { title: "统一落参", summary: "在指定入口把模板初始化进组件配置。" },
    ],
  },
  {
    key: "models",
    title: "模型管理",
    tag: "AI",
    icon: <SettingOutlined />,
    description: "维护报表平台 AI 场景的默认模型配置。",
    items: [
      { title: "默认模型", summary: "按场景选择模型、版本和调用参数。" },
      { title: "提示词维护", summary: "统一管理系统提示词和输入 Schema。" },
    ],
  },
];

export function ReportingOverviewPage() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<ReportingOverview | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetchReportingOverview(token).then((response) => {
      setOverview(response.data);
    });
  }, [token]);

  const stats = useMemo(() => [
    {
      key: "sources",
      label: "报表数据源",
      value: Number(overview?.totalSources || 0),
      icon: <DatabaseOutlined />,
      description: "独立于其他模块的连接总量",
    },
    {
      key: "datasets",
      label: "数据集",
      value: Number(overview?.totalDatasets || 0),
      icon: <DotChartOutlined />,
      description: "可供报表开发复用的数据集资产",
    },
    {
      key: "charts",
      label: "图表资产",
      value: Number(overview?.totalCharts || 0),
      icon: <AppstoreOutlined />,
      description: "内置和自定义 ECharts 图表模板",
    },
    {
      key: "dashboards",
      label: "仪表板",
      value: Number(overview?.totalDashboards || 0),
      icon: <BarChartOutlined />,
      description: "已沉淀的报表页面与看板",
    },
    {
      key: "themeTemplates",
      label: "模板中心",
      value: Number(overview?.totalThemeTemplates || 0),
      icon: <BgColorsOutlined />,
      description: "可复用的报表主题模板",
    },
  ], [overview]);

  return (
    <div className="app-page">
      <div className="app-page-body">
        <div className="kpi-grid reporting-overview-kpi-grid">
          {stats.map((item) => (
            <StatCard key={item.key} title={item.label} value={item.value} icon={item.icon} description={item.description} />
          ))}
        </div>

        <div className="reporting-overview__section">
          <Typography.Title level={4} style={{ margin: 0 }}>
            模块说明
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: "6px 0 0" }}>
            六个模块分别负责连接、数据、图表、画布、主题和 AI 辅助配置，目标是把报表开发沉淀成可复用资产。
          </Typography.Paragraph>
        </div>

        <Row gutter={[14, 14]} className="reporting-overview__module-grid">
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
      </div>
    </div>
  );
}
