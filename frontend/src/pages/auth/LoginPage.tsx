import {
  ApiOutlined,
  BarChartOutlined,
  BranchesOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  LockOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { getFirstAccessiblePath } from "../../app/permissions";
import { useAuth } from "../../app/providers/AuthProvider";
import { PLATFORM_GUIDE_URL } from "../../constants/platformGuide";
import type { LoginPayload } from "../../types/api";

const capabilityCards = [
  {
    icon: <DatabaseOutlined />,
    title: "数据接入",
    description: "统一纳管数据源、库表对象、接入任务、文件上传、接入概览与接入模型配置。",
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: "质量管控",
    description: "覆盖质量数据源、规则管理、策略配置、任务调度、结果分析和模型管理。",
  },
  {
    icon: <BranchesOutlined />,
    title: "数据开发",
    description: "提供 SQL分析、SQL任务、算子平台、调度管理、开发数据源和开发模型管理。",
  },
  {
    icon: <SearchOutlined />,
    title: "数据地图",
    description: "管理部门、业务系统、独立数据源、组织分类、资源检索、画像与血缘分析。",
  },
  {
    icon: <ExperimentOutlined />,
    title: "数据建模",
    description: "支撑行业调研、逻辑模型、物理模型、模型部署、数据预览和质量报告。",
  },
  {
    icon: <ApiOutlined />,
    title: "数据服务",
    description: "沉淀服务运营、服务目录、应用授权、调用审计、服务测试与模型配置。",
  },
  {
    icon: <BarChartOutlined />,
    title: "报表平台",
    description: "覆盖报表数据源、数据集市、图表资产、报表开发、主题模板和模型管理。",
  },
];

const platformTags = [
  "运营总览",
  "采集接入",
  "质量规则",
  "资源检索与血缘",
  "SQL 开发编排",
  "服务发布",
  "报表可视化",
  "模型与权限治理",
];

export function LoginPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { isAuthenticated, login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isAuthenticated) {
    return <Navigate to={getFirstAccessiblePath(user)} replace />;
  }

  async function handleSubmit(values: LoginPayload) {
    try {
      setSubmitting(true);
      setErrorMessage("");
      const nextUser = await login(values);
      const target =
        (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ||
        getFirstAccessiblePath(nextUser || user);
      navigate(target, { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">

      <div className="login-page__backdrop login-page__backdrop--left" />
      <div className="login-page__backdrop login-page__backdrop--right" />

      <section className="login-hero">
        <div className="login-hero__top">
          <div className="login-brand">
            <span className="login-brand__mark">
              <DatabaseOutlined />
            </span>
            <div className="login-brand__meta">
              <Typography.Text className="login-brand__eyebrow">ME DATA PLATFORM</Typography.Text>
              <Typography.Text className="login-brand__subline">Unified Data Operating Console</Typography.Text>
            </div>
          </div>
          <div className="login-hero__chip">Enterprise Console</div>
        </div>

        <div className="login-hero__content">
          <Typography.Title>AI智能数据中台运营控制台</Typography.Title>
          <Typography.Paragraph className="login-hero__description">
            围绕数据全生命周期建设统一入口，已覆盖接入采集、质量管控、开发编排、资源地图、建模实验、
            数据服务、报表分析与系统治理，支撑从数据生产到服务发布的闭环运营。
          </Typography.Paragraph>

          <div className="login-hero__tags">
            <span>数据全生命周期</span>
            <span>AI 模型增强</span>
            <span>资源画像与血缘</span>
            <span>服务化与可视化输出</span>
          </div>
        </div>

        <div className="login-hero__grid">
          {capabilityCards.map((item) => (
            <div className="login-capability-card" key={item.title}>
              <div className="login-capability-card__icon">{item.icon}</div>
              <div className="login-capability-card__body">
                <Typography.Text className="login-capability-card__title">{item.title}</Typography.Text>
                <Typography.Paragraph className="login-capability-card__description">
                  {item.description}
                </Typography.Paragraph>
              </div>
            </div>
          ))}
        </div>

        <div className="login-hero__roadmap">
          <Typography.Text className="login-hero__roadmap-title">平台能力覆盖</Typography.Text>
          <div className="login-hero__roadmap-tags">
            {platformTags.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <Card className="login-card" variant="borderless">
        <div className="login-card__header">
          <div>
            <Typography.Text className="login-card__eyebrow">WELCOME BACK</Typography.Text>
            <Typography.Title level={3}>登录系统</Typography.Title>
            <Typography.Paragraph type="secondary">请输入账号信息进入控制台</Typography.Paragraph>
          </div>
          <div className="login-card__badge">安全接入</div>
        </div>

        {errorMessage ? <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} /> : null}

        <Form
          className="login-form"
          layout="vertical"
          initialValues={{ username: "admin", password: "Admin@123" }}
          onFinish={handleSubmit}
        >
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input size="large" prefix={<UserOutlined />} autoComplete="username" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            登录并进入控制台
          </Button>
        </Form>

        <div className="login-card__demo">
          <Typography.Text className="login-card__demo-title">演示环境默认账号</Typography.Text>
          <Typography.Text className="login-card__demo-value">admin / Admin@123</Typography.Text>
        </div>

        <div className="login-card__footer">
          <span>统一入口</span>
          <span>权限可控</span>
          <span>审计留痕</span>
        </div>
      </Card>
    </div>
  );
}
