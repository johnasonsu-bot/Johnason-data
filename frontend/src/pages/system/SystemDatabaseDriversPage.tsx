import { DatabaseOutlined, UploadOutlined } from "@ant-design/icons";
import { App as AntdApp, Button, Space, Typography, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { StatusTag } from "../../components/ui/StatusTag";
import {
  fetchDatabaseDrivers,
  uploadAndActivateDatabaseDriver,
  type DatabaseDriverManagementData,
  type DatabaseDriverPackage,
} from "../../services/systemManagement";
import { SystemPageLayout } from "./SystemPageLayout";

type DatabaseType = DatabaseDriverPackage["databaseType"];

const databases: Array<{ type: DatabaseType; name: string; color: string; abbreviation: string }> = [
  { type: "mysql", name: "MySQL", color: "#00758f", abbreviation: "MY" },
  { type: "postgresql", name: "PostgreSQL", color: "#336791", abbreviation: "PG" },
  { type: "oracle", name: "Oracle", color: "#c74634", abbreviation: "OR" },
  { type: "dm", name: "达梦数据库", color: "#1769aa", abbreviation: "DM" },
];

const emptyData: DatabaseDriverManagementData = {
  packages: [],
  bindings: [],
  logs: [],
  capabilities: [],
  runtimeManifest: { bindings: {} },
};

function formatFileSize(value?: number) {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

export function SystemDatabaseDriversPage() {
  const { token } = useAuth();
  const { message: messageApi } = AntdApp.useApp();
  const [data, setData] = useState<DatabaseDriverManagementData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [updatingType, setUpdatingType] = useState<DatabaseType | null>(null);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetchDatabaseDrivers(token);
      setData(response.data);
    } catch (error: any) {
      messageApi.error(error.message || "加载驱动状态失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, [token]);

  async function updateDriver(databaseType: DatabaseType, file: File) {
    if (!token) return;
    const key = `database-driver-${databaseType}`;
    setUpdatingType(databaseType);
    messageApi.loading({ key, content: "正在验证并更新驱动...", duration: 0 });
    try {
      const response = await uploadAndActivateDatabaseDriver(token, databaseType, file);
      setData(response.data);
      messageApi.success({ key, content: "驱动已验证并更新生效" });
    } catch (error: any) {
      messageApi.error({ key, content: error.message || "驱动更新失败" });
      await loadData();
    } finally {
      setUpdatingType(null);
    }
  }

  const rows = useMemo(() => databases.map((database) => {
    const capability = data.capabilities.find((item) => item.type === database.type);
    const binding = data.bindings.find((item) => item.databaseType === database.type && item.target === "query");
    const driverPackage = binding ? data.packages.find((item) => item.id === binding.packageId) : undefined;
    const ready = Boolean(capability?.queryReady && capability?.dataxReaderReady && capability?.dataxWriterReady);
    return { ...database, capability, binding, driverPackage, ready };
  }), [data]);

  const columns: ColumnsType<(typeof rows)[number]> = [
    {
      title: "数据库驱动",
      width: 300,
      render: (_, record) => (
        <Space size={14}>
          <span style={{ width: 42, height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: `${record.color}14`, color: record.color, fontWeight: 700 }}>
            {record.abbreviation}
          </span>
          <span>
            <Typography.Text strong style={{ display: "block", fontSize: 16 }}>{record.name}</Typography.Text>
            <Typography.Text type="secondary">JDBC</Typography.Text>
          </span>
        </Space>
      ),
    },
    { title: "运行环境", width: 160, render: (_, record) => record.driverPackage?.javaVersion ? `JRE ${record.driverPackage.javaVersion}` : "应用内置" },
    { title: "当前版本", width: 180, render: (_, record) => record.binding?.version || "内置版本" },
    { title: "文件大小", width: 120, render: (_, record) => formatFileSize(record.driverPackage?.fileSize) },
    {
      title: "状态",
      width: 150,
      render: (_, record) => record.ready
        ? <StatusTag label={record.binding ? "已更新" : "内置可用"} tone="success" />
        : <StatusTag label="需要更新" tone="warning" />,
    },
    { title: "更新时间", width: 190, render: (_, record) => formatDateTime(record.binding?.activatedAt) },
    {
      title: "操作",
      width: 150,
      align: "right",
      render: (_, record) => (
        <Upload
          accept=".jar"
          maxCount={1}
          showUploadList={false}
          beforeUpload={(file) => {
            void updateDriver(record.type, file);
            return false;
          }}
        >
          <Button type="primary" icon={<UploadOutlined />} loading={updatingType === record.type}>
            上传更新
          </Button>
        </Upload>
      ),
    },
  ];

  return (
    <SystemPageLayout
      title="驱动管理"
      description="上传 JDBC JAR 后自动验证并更新生效。"
      hideHero
      hideToolbar
    >
      <DataTableCard
        title={<Space><DatabaseOutlined />驱动列表</Space>}
        tableProps={{
          rowKey: "type",
          dataSource: rows,
          columns,
          loading,
          pagination: false,
          scroll: { x: 1250 },
        }}
      />
    </SystemPageLayout>
  );
}

export default SystemDatabaseDriversPage;
