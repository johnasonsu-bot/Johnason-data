import { AppstoreOutlined, CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Col, Empty, Input, Row, Space, Spin, Tabs, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { createReportingThemeTemplate, deleteReportingThemeTemplate, fetchReportingDashboards, fetchReportingThemeTemplates, updateReportingThemeTemplate } from "../../services/reporting";
import type { ReportingDashboardRecord, ReportingThemeTemplateRecord } from "../../types/api";

export function ReportingThemeTemplateCenterPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ReportingThemeTemplateRecord[]>([]);
  const [dashboards, setDashboards] = useState<ReportingDashboardRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [categoryTab, setCategoryTab] = useState<string>("all");

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [response, dashboardResponse] = await Promise.all([
        fetchReportingThemeTemplates(token),
        fetchReportingDashboards(token),
      ]);
      setRecords(response.data || []);
      setDashboards(dashboardResponse.data || []);
    } catch (error: any) {
      message.error(`加载主题模板失败: ${error.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(records.map((item) => item.category).filter(Boolean)));
    return ["all", ...unique];
  }, [records]);

  const filtered = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return records.filter((item) => {
      if (categoryTab !== "all" && item.category !== categoryTab) return false;
      if (!text) return true;
      return [item.themeName, item.themeCode, item.description, item.category]
        .filter(Boolean)
        .some((part) => String(part).toLowerCase().includes(text));
    });
  }, [categoryTab, keyword, records]);

  const referenceCountMap = useMemo(() => {
    const next = new Map<number, number>();
    dashboards.forEach((item) => {
      const key = Number(item.themeTemplateId || 0);
      if (!key) return;
      next.set(key, (next.get(key) || 0) + 1);
    });
    return next;
  }, [dashboards]);

  async function handleCopy(record: ReportingThemeTemplateRecord) {
    if (!token) return;
    await createReportingThemeTemplate(token, {
      themeName: `${record.themeName} 副本`,
      themeCode: `${record.themeCode}_copy_${Date.now().toString().slice(-4)}`,
      category: record.category,
      description: record.description || null,
      status: "draft",
      isBuiltin: false,
      canvas: record.canvas || {},
      chrome: record.chrome || {},
      semantic: record.semantic || {},
      chartCommon: record.chartCommon || {},
      chartVariants: record.chartVariants || {},
    });
    message.success("主题模板副本已创建");
    await load();
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <PageToolbar
        right={(
          <Space>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => navigate("/dashboard/reporting/theme-templates/create")}>新建模板</Button>
            <Button icon={<AppstoreOutlined />} onClick={() => navigate("/dashboard/reporting/workbench")}>返回报表开发</Button>
          </Space>
        )}
      />

      <Card>
        <Space direction="vertical" size={12} style={{ display: "flex" }}>
          <Input.Search placeholder="搜索模板名称或编码" allowClear style={{ width: 280 }} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          <Tabs
            activeKey={categoryTab}
            onChange={setCategoryTab}
            items={categories.map((item) => ({
              key: item,
              label: item === "all" ? "全部" : item,
            }))}
          />
        </Space>
      </Card>

      <Spin spinning={loading}>
        {filtered.length ? (
          <Row gutter={[16, 16]}>
            {filtered.map((item) => (
              <Col key={item.id} xs={24} sm={12} lg={8} xl={6}>
                <Card
                  hoverable
                  title={item.themeName}
                  extra={item.isBuiltin ? <Tag color="blue">内置</Tag> : <Tag>自定义</Tag>}
                  actions={[
                    <Button
                      key="edit"
                      type="link"
                      icon={<EditOutlined />}
                      disabled={item.isBuiltin}
                      title={item.isBuiltin ? "内置模板不支持编辑" : undefined}
                      onClick={() => navigate(`/dashboard/reporting/theme-templates/${item.id}/edit`)}
                    >
                      编辑
                    </Button>,
                    <Button key="copy" type="link" icon={<CopyOutlined />} onClick={() => void handleCopy(item)}>复制</Button>,
                    <Button
                      key="delete"
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={item.isBuiltin}
                      title={item.isBuiltin ? "内置模板不支持删除" : undefined}
                      onClick={async () => {
                        if (!token) return;
                        await deleteReportingThemeTemplate(token, item.id);
                        message.success("模板已删除");
                        await load();
                      }}
                    >
                      删除
                    </Button>,
                    <Button
                      key="status"
                      type="link"
                      onClick={async () => {
                        if (!token) return;
                        await updateReportingThemeTemplate(token, item.id, {
                          ...item,
                          status: item.status === "active" ? "inactive" : "active",
                        });
                        message.success(item.status === "active" ? "模板已停用" : "模板已发布");
                        await load();
                      }}
                    >
                      {item.status === "active" ? "停用" : "发布"}
                    </Button>,
                  ]}
                >
                  <div
                    style={{
                      height: 104,
                      borderRadius: 12,
                      marginBottom: 10,
                      background: String(item.canvas?.backgroundImage || item.canvas?.backgroundGradient || item.canvas?.backgroundColor || "linear-gradient(180deg, #f7f9fc 0%, #eef3fa 100%)"),
                      border: `1px solid ${String(item.chrome?.borderColor || "#dce6f5")}`,
                      boxShadow: item.chrome?.shadowPreset === "medium" ? "0 12px 32px rgba(15,23,42,0.14)" : item.chrome?.shadowPreset === "soft" ? "0 8px 24px rgba(15,23,42,0.10)" : "none",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 16,
                        borderRadius: 10,
                        background: String(item.chrome?.backgroundColor || "#ffffff"),
                        border: `1px solid ${String(item.chrome?.borderColor || "#dce6f5")}`,
                      }}
                    />
                  </div>
                  <Space size={[8, 8]} wrap>
                    <Tag>{item.category}</Tag>
                    <Tag color="gold">引用 {referenceCountMap.get(item.id) || 0}</Tag>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="没有匹配的主题模板" />
        )}
      </Spin>
    </Space>
  );
}
