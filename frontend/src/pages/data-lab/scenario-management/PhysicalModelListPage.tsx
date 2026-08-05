import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import { ApartmentOutlined, DatabaseOutlined, DeploymentUnitOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { DataTableCard } from "../../../components/ui/DataTableCard";
import { PageToolbar } from "../../../components/ui/PageToolbar";
import { StatCard } from "../../../components/ui/StatCard";
import {
  createBusinessSystemInstance,
  deleteBusinessSystemInstance,
  fetchBusinessSystemInstances,
  fetchBusinessSystemTemplates,
  type LabBusinessSystemInstancePayload,
} from "../../../services/dataLab";
import type {
  LabBusinessSystemInstanceRecord,
  LabBusinessSystemTemplateRecord,
} from "../../../types/api";
import { formatDateTime, INSTANCE_STATUS_META, renderStatus } from "./scenarioManagementShared";

export function PhysicalModelListPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<LabBusinessSystemInstanceRecord[]>([]);
  const [templates, setTemplates] = useState<LabBusinessSystemTemplateRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [templateFilter, setTemplateFilter] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [dbTypeFilter, setDbTypeFilter] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form] = Form.useForm<LabBusinessSystemInstancePayload>();
  const selectedTemplateId = Form.useWatch("templateId", form);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const [instanceResponse, templateResponse] = await Promise.all([
        fetchBusinessSystemInstances(token),
        fetchBusinessSystemTemplates(token),
      ]);
      setRecords(instanceResponse.data);
      setTemplates(templateResponse.data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载物理模型清单失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  useEffect(() => {
    const templateId = Number(searchParams.get("templateId") || searchParams.get("fromTemplate") || 0);
    if (templateId > 0) {
      form.setFieldsValue({
        templateId,
        instanceStatus: "draft",
        dbType: "mysql",
      });
      setCreateOpen(true);
    }
  }, [form, searchParams]);

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return records.filter((item) => {
      if (templateFilter && item.templateId !== templateFilter) return false;
      if (statusFilter && item.instanceStatus !== statusFilter) return false;
      if (dbTypeFilter && String(item.dbType || "").toLowerCase() !== dbTypeFilter) return false;
      if (!normalizedKeyword) return true;
      const text = [item.instanceName, item.instanceCode, item.templateName, item.industryCode, item.dbType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(normalizedKeyword);
    });
  }, [dbTypeFilter, keyword, records, statusFilter, templateFilter]);

  const templateOptions = useMemo(
    () => templates.map((item) => ({ label: `${item.templateName} (${item.templateCode})`, value: item.id })),
    [templates]
  );

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === Number(selectedTemplateId || 0)) || null,
    [selectedTemplateId, templates]
  );

  const dbTypeOptions = useMemo(
    () =>
      Array.from(new Set(records.map((item) => String(item.dbType || "").toLowerCase()).filter(Boolean))).map((item) => ({
        label: item.toUpperCase(),
        value: item,
      })),
    [records]
  );

  const kpis = useMemo(() => {
    const deployedCount = filteredRecords.filter((item) => Number(item.currentPhysicalVersion || 0) > 0).length;
    const generatedCount = filteredRecords.filter((item) => Number(item.currentGenerationVersion || 0) > 0).length;
    const activeCount = filteredRecords.filter((item) => item.instanceStatus === "active").length;
    return [
      {
        key: "total",
        title: "物理模型实例",
        value: filteredRecords.length,
        icon: <DeploymentUnitOutlined />,
        description: "当前已创建的物理建模实例数量",
      },
      {
        key: "active",
        title: "启用中的实例",
        value: activeCount,
        icon: <ApartmentOutlined />,
        description: "实例状态为启用的物理模型",
      },
      {
        key: "deployed",
        title: "已落库实例",
        value: deployedCount,
        icon: <DatabaseOutlined />,
        description: "已经生成并部署物理模型的实例数量",
      },
      {
        key: "generated",
        title: "已生成仿真方案",
        value: generatedCount,
        icon: <ReloadOutlined />,
        description: "已经产生仿真编排结果的实例数量",
      },
    ];
  }, [filteredRecords]);

  async function handleSubmit(values: LabBusinessSystemInstancePayload) {
    if (!token) return;
    try {
      setCreating(true);
      const response = await createBusinessSystemInstance(token, values);
      setCreateOpen(false);
      form.resetFields();
      await loadData();
      message.success(`已创建物理模型实例：${response.data.instanceName}`);
      navigate(`/dashboard/data-modeling/physical-models/${response.data.id}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "新建物理模型实例失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(record: LabBusinessSystemInstanceRecord) {
    if (!token) return;
    setDeletingId(record.id);
    try {
      const response = await deleteBusinessSystemInstance(token, record.id);
      message.success(`已删除物理模型实例：${response.data.instanceName}`);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除物理模型实例失败");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: ColumnsType<LabBusinessSystemInstanceRecord> = [
    {
      title: "物理模型实例",
      width: 260,
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            style={{ padding: 0, height: "auto", fontWeight: 600, textAlign: "left" }}
            onClick={() => navigate(`/dashboard/data-modeling/physical-models/${record.id}`)}
          >
            {record.instanceName}
          </Button>
          <Typography.Text type="secondary">{record.instanceCode}</Typography.Text>
        </Space>
      ),
    },
    { title: "来源逻辑模型", dataIndex: "templateName", width: 220 },
    { title: "数据库", dataIndex: "dbType", width: 110, render: (value: string) => String(value || "-").toUpperCase() },
    {
      title: "物理版本",
      dataIndex: "currentPhysicalVersion",
      width: 100,
      align: "center",
      render: (value?: number | null) => (value ? `V${value}` : "-"),
    },
    {
      title: "数据方案",
      dataIndex: "currentGenerationVersion",
      width: 100,
      align: "center",
      render: (value?: number | null) => (value ? `V${value}` : "-"),
    },
    {
      title: "状态",
      dataIndex: "instanceStatus",
      width: 100,
      render: (value: string) => renderStatus(value, INSTANCE_STATUS_META),
    },
    { title: "更新时间", dataIndex: "updatedAt", width: 180, render: (value: string) => formatDateTime(value) },
    {
      title: "操作",
      width: 220,
      fixed: "right",
      render: (_value, record) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/dashboard/data-modeling/physical-models/${record.id}`)}>
            查看设计
          </Button>
          <Popconfirm
            title="确认删除这个物理模型实例？"
            description="删除后会一并移除版本记录；如果已被联动数据集引用，系统会阻止删除。"
            onConfirm={() => void handleDelete(record)}
          >
            <Button type="link" danger loading={deletingId === record.id}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="app-page">
      <PageToolbar
        left={(
          <>
            <Select
              allowClear
              style={{ width: 240 }}
              placeholder="按逻辑模型筛选"
              value={templateFilter}
              options={templateOptions}
              onChange={(value) => setTemplateFilter(value)}
            />
            <Select
              allowClear
              style={{ width: 160 }}
              placeholder="按状态筛选"
              value={statusFilter}
              options={[
                { label: "草稿", value: "draft" },
                { label: "启用", value: "active" },
                { label: "归档", value: "archived" },
              ]}
              onChange={(value) => setStatusFilter(value)}
            />
            <Select
              allowClear
              style={{ width: 150 }}
              placeholder="按数据库筛选"
              value={dbTypeFilter}
              options={dbTypeOptions}
              onChange={(value) => setDbTypeFilter(value)}
            />
            <Input.Search
              allowClear
              className="toolbar-search"
              placeholder="搜索实例名称、编码、模板"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </>
        )}
        right={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              新建物理模型
            </Button>
          </Space>
        )}
      />

      <div className="app-page-body">
        <div className="kpi-grid">
          {kpis.map((item) => (
            <StatCard key={item.key} title={item.title} value={item.value} icon={item.icon} description={item.description} />
          ))}
        </div>

        <DataTableCard<LabBusinessSystemInstanceRecord>
          title="物理模型清单"
          extra={<Typography.Text type="secondary">共 {filteredRecords.length} 个</Typography.Text>}
          tableProps={{
            rowKey: "id",
            loading,
            columns,
            dataSource: filteredRecords,
            pagination: { pageSize: 10, showSizeChanger: false },
            scroll: { x: 1360 },
            locale: { emptyText: <Empty description="暂无物理模型实例" /> },
          }}
        />
      </div>

      <Modal
        title="新建物理模型"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          form.resetFields();
        }}
        onOk={() => void form.submit()}
        confirmLoading={creating}
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ instanceStatus: "draft", dbType: "mysql" }}
          onFinish={(values) => void handleSubmit(values)}
        >
          <Form.Item name="templateId" label="来源逻辑模型" rules={[{ required: true, message: "请选择逻辑模型" }]}>
            <Select showSearch optionFilterProp="label" options={templateOptions} />
          </Form.Item>
          {selectedTemplate ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`将基于“${selectedTemplate.templateName}”创建物理模型`}
              description={`当前逻辑版本 V${selectedTemplate.currentLogicalVersion || "-"}，包含 ${selectedTemplate.logicalTableCount || 0} 张逻辑表。`}
            />
          ) : null}
          <Form.Item name="instanceName" label="实例名称" rules={[{ required: true, message: "请输入实例名称" }]}>
            <Input placeholder="例如：畜牧管理物理模型实例" />
          </Form.Item>
          <Form.Item name="instanceCode" label="实例编码">
            <Input placeholder="可不填，系统会自动生成" />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Item name="dbType" label="数据库类型" rules={[{ required: true, message: "请选择数据库类型" }]}>
              <Select
                options={[
                  { label: "MySQL", value: "mysql" },
                  { label: "PostgreSQL", value: "postgresql" },
                ]}
              />
            </Form.Item>
            <Form.Item name="instanceStatus" label="实例状态">
              <Select
                options={[
                  { label: "草稿", value: "draft" },
                  { label: "启用", value: "active" },
                  { label: "归档", value: "archived" },
                ]}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
