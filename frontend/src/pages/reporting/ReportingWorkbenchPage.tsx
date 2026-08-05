import {
  BgColorsOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { fetchReportingDashboards, deleteReportingDashboard, publishReportingDashboard } from "../../services/reporting";
import { fetchSystemUsers } from "../../services/systemManagement";
import type { ReportingDashboardPublishConfig, ReportingDashboardRecord, SystemUserRecord } from "../../types/api";

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

export function ReportingWorkbenchPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<ReportingDashboardRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
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
      message.error(`加载仪表盘清单失败: ${error.message || "未知错误"}`);
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
    { title: "名称", dataIndex: "dashboardName", key: "dashboardName", width: 220 },
    { title: "布局", dataIndex: "layoutMode", key: "layoutMode", width: 120, render: (value: string) => value === "free" ? "自由画布" : "栅格画布" },
    { title: "部件数", dataIndex: "widgetCount", key: "widgetCount", width: 100 },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: string) => <Tag color={value === "published" ? "green" : value === "draft" ? "gold" : "default"}>{value}</Tag>,
    },
    { title: "负责人", dataIndex: "ownerName", key: "ownerName", width: 140 },
    { title: "更新时间", dataIndex: "updatedAt", key: "updatedAt", width: 180, render: (value: string) => formatTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 220,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              const runtimeToken = token ? `?runtimeToken=${encodeURIComponent(token)}` : "";
              window.open(`/reporting/runtime/${record.id}${runtimeToken}`, "_blank", "noopener,noreferrer");
            }}
          >
            预览
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => navigate(`/dashboard/reporting/workbench/${record.id}/edit`)}>
            编辑
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
            onClick={() => {
              Modal.confirm({
                title: `确认删除仪表盘“${record.dashboardName}”？`,
                content: "删除后画布、图表部件和配置将一并移除。",
                okText: "删除",
                cancelText: "取消",
                okButtonProps: { danger: true },
                onOk: async () => {
                  if (!token) return;
                  try {
                    await deleteReportingDashboard(token, record.id);
                    message.success("仪表盘已删除");
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

  return (
    <div className="app-page">
      <div className="app-page-body">
        <PageToolbar
          left={<Input.Search allowClear className="toolbar-search" placeholder="搜索仪表盘名称、负责人" value={keyword} onChange={(event) => setKeyword(event.target.value)} />}
          right={(
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>刷新</Button>
              <Button icon={<BgColorsOutlined />} onClick={() => navigate("/dashboard/reporting/chart-library")}>图表库</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/dashboard/reporting/workbench/create")}>新建仪表盘</Button>
            </Space>
          )}
        />

        <DataTableCard<ReportingDashboardRecord>
          title="仪表盘清单"
          extra={<Typography.Text type="secondary">共 {filteredRecords.length} 条记录</Typography.Text>}
          tableProps={{
            rowKey: "id",
            loading,
            columns,
            dataSource: filteredRecords,
            pagination: { pageSize: 10, showSizeChanger: false },
            scroll: { x: 1480 },
          }}
        />

      </div>

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
