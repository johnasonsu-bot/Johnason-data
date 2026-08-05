import { AppstoreOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Input, Select, Space, Spin, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { fetchReportingDashboards, fetchReportingThemeTemplates } from "../../services/reporting";
import type { ReportingDashboardRecord, ReportingThemeTemplateRecord } from "../../types/api";

type RelationRow = {
  dashboardId: number;
  dashboardName: string;
  themeTemplateId: number | null;
  themeTemplateName: string;
  widgetCount: number;
  status: string;
  ownerName: string;
  updatedAt: string;
};

export function ReportingThemeTemplateRelationsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dashboards, setDashboards] = useState<ReportingDashboardRecord[]>([]);
  const [templates, setTemplates] = useState<ReportingThemeTemplateRecord[]>([]);
  const [templateId, setTemplateId] = useState<number | undefined>();
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    async function load() {
      if (!token) return;
      setLoading(true);
      try {
        const [dashboardResponse, templateResponse] = await Promise.all([
          fetchReportingDashboards(token),
          fetchReportingThemeTemplates(token),
        ]);
        setDashboards(dashboardResponse.data || []);
        setTemplates(templateResponse.data || []);
      } catch (error: any) {
        message.error(`加载模板应用关系失败: ${error.message || "未知错误"}`);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  const relationRows = useMemo<RelationRow[]>(() => {
    const templateMap = new Map(templates.map((item) => [item.id, item.themeName]));
    const text = keyword.trim().toLowerCase();
    return dashboards
      .map((item) => ({
        dashboardId: item.id,
        dashboardName: item.dashboardName,
        themeTemplateId: item.themeTemplateId ? Number(item.themeTemplateId) : null,
        themeTemplateName: item.themeTemplateId ? (templateMap.get(Number(item.themeTemplateId)) || `模板 #${item.themeTemplateId}`) : "未绑定",
        widgetCount: Number(item.widgetCount || 0),
        status: item.status,
        ownerName: item.ownerName,
        updatedAt: item.updatedAt,
      }))
      .filter((item) => {
        if (templateId && item.themeTemplateId !== templateId) return false;
        if (!text) return true;
        return [item.dashboardName, item.themeTemplateName, item.ownerName]
          .some((part) => String(part || "").toLowerCase().includes(text));
      });
  }, [dashboards, keyword, templateId, templates]);

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <PageToolbar
        left={(
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>模板应用关系</Typography.Title>
            <Typography.Text type="secondary">查看主题模板被哪些报表引用，作为第三期应用关系页的最小落地版。</Typography.Text>
          </div>
        )}
        right={<Button icon={<AppstoreOutlined />} onClick={() => navigate("/dashboard/reporting/theme-templates")}>返回模板中心</Button>}
      />

      <Card>
        <Space wrap>
          <Select
            allowClear
            style={{ width: 240 }}
            placeholder="筛选主题模板"
            value={templateId}
            options={templates.map((item) => ({ value: item.id, label: `${item.themeName} (${item.themeCode})` }))}
            onChange={(value) => setTemplateId(value)}
          />
          <Input.Search
            allowClear
            style={{ width: 280 }}
            placeholder="搜索报表名称 / 模板 / 负责人"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </Space>
      </Card>

      <Spin spinning={loading}>
        {relationRows.length ? (
          <Card>
            <Table
              rowKey="dashboardId"
              pagination={{ pageSize: 10 }}
              dataSource={relationRows}
              columns={[
                { title: "报表名称", dataIndex: "dashboardName", render: (_, record) => <Button type="link" onClick={() => navigate(`/dashboard/reporting/workbench/${record.dashboardId}/edit`)}>{record.dashboardName}</Button> },
                { title: "主题模板", dataIndex: "themeTemplateName", width: 180 },
                { title: "组件数", dataIndex: "widgetCount", width: 90 },
                { title: "状态", dataIndex: "status", width: 90, render: (value) => <Tag color={value === "published" ? "blue" : value === "inactive" ? "default" : "gold"}>{value}</Tag> },
                { title: "负责人", dataIndex: "ownerName", width: 120 },
                { title: "更新时间", dataIndex: "updatedAt", width: 180 },
              ]}
            />
          </Card>
        ) : (
          <Empty description="当前没有符合条件的应用关系" />
        )}
      </Spin>
    </Space>
  );
}
