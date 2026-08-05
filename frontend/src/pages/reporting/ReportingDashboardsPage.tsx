import {
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Form,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { fetchReportingDashboards, deleteReportingDashboard } from "../../services/reporting";
import { publishReportingDashboard } from "../../services/reporting";
import { fetchSystemUsers } from "../../services/systemManagement";
import type { ReportingDashboardPublishConfig, ReportingDashboardRecord, ReportingDashboardWidgetRecord, SystemUserRecord } from "../../types/api";

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

export function ReportingDashboardsPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<ReportingDashboardRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<ReportingDashboardRecord | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishRecord, setPublishRecord] = useState<ReportingDashboardRecord | null>(null);
  const [users, setUsers] = useState<SystemUserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [publishForm] = Form.useForm<ReportingDashboardPublishConfig>();

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetchReportingDashboards(token);
      setRecords(response.data || []);
    } catch (error: any) {
      message.error(`加载仪表板失败: ${error.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  async function loadUsers() {
    if (!token || users.length > 0) return;
    setUsersLoading(true);
    try {
      const response = await fetchSystemUsers(token);
      setUsers(response.data || []);
    } catch (error: any) {
      message.error(`加载用户清单失败: ${error.message || "未知错误"}`);
    } finally {
      setUsersLoading(false);
    }
  }

  const filteredRecords = useMemo(() => records.filter((item) => {
    return !keyword || `${item.dashboardName} ${item.ownerName}`.toLowerCase().includes(keyword.toLowerCase());
  }), [keyword, records]);

  const columns: ColumnsType<ReportingDashboardRecord> = [
    { title: "名称", dataIndex: "dashboardName", key: "dashboardName", width: 200 },
    { title: "布局", dataIndex: "layoutMode", key: "layoutMode", width: 120, render: (value: string) => value === "free" ? "自由画布" : "栅格画布" },
    { title: "部件数", dataIndex: "widgetCount", key: "widgetCount", width: 100 },
    { title: "负责人", dataIndex: "ownerName", key: "ownerName", width: 140 },
    { title: "状态", dataIndex: "status", key: "status", width: 120, render: (value: string) => <Tag color={value === "published" ? "green" : value === "draft" ? "gold" : "default"}>{value}</Tag> },
    { title: "更新时间", dataIndex: "updatedAt", key: "updatedAt", width: 180, render: (value: string) => formatTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => {
            setDetailRecord(record);
            setDetailOpen(true);
          }}>
            查看
          </Button>
          <Button
            type="link"
            onClick={() => {
              const publishConfig = (record.canvasConfig?.publishConfig || {}) as ReportingDashboardPublishConfig;
              setPublishRecord(record);
              publishForm.setFieldsValue({
                accessMode: publishConfig.accessMode || "public",
                allowedUsernames: publishConfig.allowedUsernames?.length
                  ? publishConfig.allowedUsernames
                  : (publishConfig.allowedUsername ? [publishConfig.allowedUsername] : []),
              });
              void loadUsers();
              setPublishOpen(true);
            }}
          >
            分享
          </Button>
          <Button
            danger
            type="link"
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: `确认删除仪表板“${record.dashboardName}”？`,
                content: "删除后画布和部件配置将一并移除。",
                okText: "删除",
                cancelText: "取消",
                okButtonProps: { danger: true },
                onOk: async () => {
                  if (!token) return;
                  try {
                    await deleteReportingDashboard(token, record.id);
                    message.success("仪表板已删除");
                    if (detailRecord?.id === record.id) {
                      setDetailOpen(false);
                      setDetailRecord(null);
                    }
                    await loadData();
                  } catch (error: any) {
                    message.error(`删除失败: ${error.message || "未知错误"}`);
                  }
                },
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const widgetColumns: ColumnsType<ReportingDashboardWidgetRecord> = [
    { title: "部件名称", dataIndex: "widgetName", key: "widgetName", width: 180 },
    { title: "部件类型", dataIndex: "widgetType", key: "widgetType", width: 120 },
    { title: "数据集 ID", dataIndex: "datasetId", key: "datasetId", width: 120, render: (value: number | null | undefined) => value ?? "-" },
    { title: "图表资产 ID", dataIndex: "chartAssetId", key: "chartAssetId", width: 120, render: (value: number | null | undefined) => value ?? "-" },
    { title: "部件键", dataIndex: "widgetKey", key: "widgetKey", width: 220 },
  ];

  return (
    <div className="app-page">
      <PageHeader
        title="仪表板"
        eyebrow="Reporting"
        description="统一查看报表工作台保存的画布、部件和发布状态。"
      />

      <div className="app-page-body">
        <PageToolbar
          left={<Input.Search allowClear className="toolbar-search" placeholder="搜索名称、负责人" value={keyword} onChange={(event) => setKeyword(event.target.value)} />}
          right={<Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>刷新</Button>}
        />

        <DataTableCard<ReportingDashboardRecord>
          title="仪表板目录"
          extra={<Typography.Text type="secondary">共 {filteredRecords.length} 条记录</Typography.Text>}
          tableProps={{
            rowKey: "id",
            loading,
            columns,
            dataSource: filteredRecords,
            pagination: { pageSize: 8, showSizeChanger: false },
            scroll: { x: 1420 },
          }}
        />
      </div>

      <Drawer
        open={detailOpen}
        title={detailRecord ? `仪表板详情 - ${detailRecord.dashboardName}` : "仪表板详情"}
        width={880}
        onClose={() => {
          setDetailOpen(false);
          setDetailRecord(null);
        }}
      >
        {detailRecord ? (
          <Space direction="vertical" size={16} style={{ display: "flex" }}>
            <Card size="small" title="基础信息">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="名称">{detailRecord.dashboardName}</Descriptions.Item>
                <Descriptions.Item label="布局">{detailRecord.layoutMode === "free" ? "自由画布" : "栅格画布"}</Descriptions.Item>
                <Descriptions.Item label="状态">{detailRecord.status}</Descriptions.Item>
                <Descriptions.Item label="负责人">{detailRecord.ownerName}</Descriptions.Item>
                <Descriptions.Item label="更新时间">{formatTime(detailRecord.updatedAt)}</Descriptions.Item>
                <Descriptions.Item label="描述" span={2}>{detailRecord.description || "-"}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="部件列表">
              <Table
                rowKey={(record) => record.id ? String(record.id) : record.widgetKey}
                size="small"
                pagination={false}
                dataSource={detailRecord.widgets || []}
                columns={widgetColumns}
                scroll={{ x: 960 }}
                locale={{ emptyText: "当前仪表板暂无部件" }}
              />
            </Card>

            <Card size="small" title="画布配置">
              <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap", fontFamily: "Consolas, monospace" }}>
                {JSON.stringify(detailRecord.canvasConfig || {}, null, 2)}
              </Typography.Paragraph>
            </Card>
          </Space>
        ) : null}
      </Drawer>

      <Modal
        open={publishOpen}
        title={publishRecord ? `生成分享链接 - ${publishRecord.dashboardName}` : "生成分享链接"}
        onCancel={() => {
          setPublishOpen(false);
          setPublishRecord(null);
        }}
        onOk={async () => {
          if (!token || !publishRecord) return;
          const values = await publishForm.validateFields();
          const response = await publishReportingDashboard(token, publishRecord.id, values);
          const publishConfig = (response.data.canvasConfig?.publishConfig || {}) as ReportingDashboardPublishConfig;
          const shareUrl = publishConfig.shareToken
            ? `${window.location.origin}/reporting/runtime/${publishRecord.id}?shareToken=${publishConfig.shareToken}`
            : `${window.location.origin}/reporting/runtime/${publishRecord.id}`;
          await navigator.clipboard.writeText(shareUrl);
          message.success("分享链接已生成并复制到剪贴板");
          setPublishOpen(false);
          await loadData();
        }}
      >
        <Form form={publishForm} layout="vertical" initialValues={{ accessMode: "public" }}>
          <Form.Item name="accessMode" label="查看权限" rules={[{ required: true, message: "请选择查看权限" }]}>
            <Select options={[
              { value: "public", label: "免登录" },
              { value: "login_user", label: "指定登录用户名" },
            ]} />
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => publishForm.getFieldValue("accessMode") === "login_user" ? (
              <Form.Item
                name="allowedUsernames"
                label="允许查看的登录用户名"
                rules={[{ required: true, type: "array", min: 1, message: "请选择至少一个登录用户" }]}
              >
                <Select
                  mode="multiple"
                  showSearch
                  loading={usersLoading}
                  placeholder="请选择一个或多个用户"
                  optionFilterProp="label"
                  options={users
                    .filter((item) => item.status === "active")
                    .map((item) => ({
                      value: item.username,
                      label: `${item.displayName || item.username}（${item.username}）`,
                    }))}
                  onOpenChange={(open) => {
                    if (open) void loadUsers();
                  }}
                />
              </Form.Item>
            ) : null}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
