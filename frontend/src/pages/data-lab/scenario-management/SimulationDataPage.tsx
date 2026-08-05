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
  Tabs,
  Typography,
  message,
} from "antd";
import { ApartmentOutlined, BgColorsOutlined, LinkOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { DataTableCard } from "../../../components/ui/DataTableCard";
import { PageToolbar } from "../../../components/ui/PageToolbar";
import { StatCard } from "../../../components/ui/StatCard";
import {
  createIndustryDataSource,
  deleteIndustryDataSource,
  fetchBusinessSystemInstances,
  fetchIndustryDataSources,
  type LabIndustryDataSourcePayload,
} from "../../../services/dataLab";
import type {
  LabBusinessSystemInstanceRecord,
  LabIndustryDataSourceRecord,
} from "../../../types/api";
import { DataLabSourcesPage } from "../DataLabSourcesPage";
import {
  DATA_SOURCE_STATUS_META,
  renderStatus,
  renderThemeTags,
  formatDateTime,
} from "./scenarioManagementShared";

type SimulationListTab = "sources" | "datasets";

export function SimulationDataPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [instances, setInstances] = useState<LabBusinessSystemInstanceRecord[]>([]);
  const [datasets, setDatasets] = useState<LabIndustryDataSourceRecord[]>([]);
  const [activeTab, setActiveTab] = useState<SimulationListTab>("sources");
  const [keyword, setKeyword] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string | undefined>();
  const [datasetStatusFilter, setDatasetStatusFilter] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form] = Form.useForm<LabIndustryDataSourcePayload>();
  const selectedIndustryCode = Form.useWatch("industryCode", form);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const [instanceResponse, datasetResponse] = await Promise.all([
        fetchBusinessSystemInstances(token),
        fetchIndustryDataSources(token),
      ]);
      setInstances(instanceResponse.data);
      setDatasets(datasetResponse.data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载模型部署清单失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  const industryOptions = useMemo(
    () =>
      Array.from(new Set(instances.map((item) => String(item.industryCode || "")).filter(Boolean))).map((item) => ({
        label: item,
        value: item,
      })),
    [instances]
  );

  const instanceOptions = useMemo(
    () =>
      instances
        .filter((item) => !selectedIndustryCode || item.industryCode === selectedIndustryCode)
        .map((item) => ({ label: `${item.instanceName} (${item.instanceCode})`, value: item.id })),
    [instances, selectedIndustryCode]
  );

  const filteredDatasets = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return datasets.filter((item) => {
      if (industryFilter && item.industryCode !== industryFilter) return false;
      if (datasetStatusFilter && item.sourceStatus !== datasetStatusFilter) return false;
      if (!normalizedKeyword) return true;
      const text = [item.dataSourceName, item.dataSourceCode, item.industryCode, ...(item.selectedThemes || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(normalizedKeyword);
    });
  }, [datasetStatusFilter, datasets, industryFilter, keyword]);

  const activeKpis = useMemo(() => {
    const readyCount = datasets.filter((item) => {
      const summary = (item.linkagePreview?.summary || {}) as Record<string, unknown>;
      return Number(summary.readyInstanceCount || 0) > 0;
    }).length;
    const entityCount = datasets.reduce((sum, item) => {
      const summary = (item.linkagePreview?.summary || {}) as Record<string, unknown>;
      return sum + Number(summary.sharedEntityCount || 0);
    }, 0);
    const instanceCount = datasets.reduce((sum, item) => sum + Number(item.instanceCount || 0), 0);
    const deployReadyCount = instances.filter((item) => Number(item.currentPhysicalVersion || 0) > 0).length;

    return [
      {
        key: "instances",
        title: "可部署实例",
        value: deployReadyCount,
        icon: <ApartmentOutlined />,
        description: "当前已生成物理模型、可用于部署和装载的业务实例数量",
      },
      {
        key: "datasets",
        title: "联动数据集",
        value: datasets.length,
        icon: <LinkOutlined />,
        description: "当前已创建的联动数据集数量",
      },
      {
        key: "assemblies",
        title: "装配实例数",
        value: instanceCount,
        icon: <ReloadOutlined />,
        description: "所有联动数据集累计装配的业务实例数量",
      },
      {
        key: "entities",
        title: "共享实体数",
        value: entityCount + readyCount,
        icon: <BgColorsOutlined />,
        description: "联动数据集中的共享实体与可联动覆盖规模",
      },
    ];
  }, [datasets, instances]);

  async function handleSubmit(values: LabIndustryDataSourcePayload) {
    if (!token) return;
    try {
      setCreating(true);
      const response = await createIndustryDataSource(token, values);
      setCreateOpen(false);
      form.resetFields();
      await loadData();
      message.success(`已创建联动数据集：${response.data.dataSourceName}`);
      navigate(`/dashboard/data-modeling/simulation/datasets/${response.data.id}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "新建联动数据集失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(record: LabIndustryDataSourceRecord) {
    if (!token) return;
    setDeletingId(record.id);
    try {
      const response = await deleteIndustryDataSource(token, record.id);
      message.success(`已删除联动数据集：${response.data.dataSourceName}`);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除联动数据集失败");
    } finally {
      setDeletingId(null);
    }
  }

  const datasetColumns: ColumnsType<LabIndustryDataSourceRecord> = [
    {
      title: "联动数据集",
      width: 260,
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            style={{ padding: 0, height: "auto", fontWeight: 600, textAlign: "left" }}
            onClick={() => navigate(`/dashboard/data-modeling/simulation/datasets/${record.id}`)}
          >
            {record.dataSourceName}
          </Button>
          <Typography.Text type="secondary">{record.dataSourceCode}</Typography.Text>
        </Space>
      ),
    },
    { title: "行业编码", dataIndex: "industryCode", width: 140 },
    { title: "共享主题", dataIndex: "selectedThemes", width: 220, render: (value: string[]) => renderThemeTags(value) },
    { title: "装配实例", dataIndex: "instanceCount", width: 100, align: "center" },
    {
      title: "状态",
      dataIndex: "sourceStatus",
      width: 100,
      render: (value: string) => renderStatus(value, DATA_SOURCE_STATUS_META),
    },
    { title: "更新时间", dataIndex: "updatedAt", width: 180, render: (value: string) => formatDateTime(value) },
    {
      title: "操作",
      width: 180,
      fixed: "right",
      render: (_value, record) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/dashboard/data-modeling/simulation/datasets/${record.id}`)}>
            查看联动
          </Button>
          <Popconfirm
            title="确认删除这个联动数据集？"
            description="删除后将移除当前联动数据集及装配关系，但不会删除业务实例本身。"
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
            {activeTab === "datasets" ? (
              <>
                <Select
                  allowClear
                  style={{ width: 180 }}
                  placeholder="按行业编码筛选"
                  value={industryFilter}
                  options={industryOptions}
                  onChange={(value) => setIndustryFilter(value)}
                />
                <Select
                  allowClear
                  style={{ width: 160 }}
                  placeholder="按数据集状态筛选"
                  value={datasetStatusFilter}
                  options={[
                    { label: "草稿", value: "draft" },
                    { label: "启用", value: "active" },
                    { label: "归档", value: "archived" },
                  ]}
                  onChange={(value) => setDatasetStatusFilter(value)}
                />
                <Input.Search
                  allowClear
                  className="toolbar-search"
                  placeholder="搜索数据集名称、编码、主题"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
              </>
            ) : null}
          </>
        )}
        right={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
              刷新
            </Button>
            {activeTab === "datasets" ? (
              <Button type="primary" onClick={() => setCreateOpen(true)}>
                新建联动数据集
              </Button>
            ) : null}
          </Space>
        )}
      />

      <div className="app-page-body">
        <div className="kpi-grid">
          {activeKpis.map((item) => (
            <StatCard key={item.key} title={item.title} value={item.value} icon={item.icon} description={item.description} />
          ))}
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={(value) => setActiveTab(value as SimulationListTab)}
          items={[
            {
              key: "sources",
              label: "数据源",
              children: <DataLabSourcesPage />,
            },
            {
              key: "datasets",
              label: "联动数据集",
              children: (
                <DataTableCard<LabIndustryDataSourceRecord>
                  title="联动数据集清单"
                  extra={<Typography.Text type="secondary">共 {filteredDatasets.length} 项</Typography.Text>}
                  tableProps={{
                    rowKey: "id",
                    loading,
                    columns: datasetColumns,
                    dataSource: filteredDatasets,
                    pagination: { pageSize: 10, showSizeChanger: false },
                    scroll: { x: 1180 },
                    locale: { emptyText: <Empty description="暂无联动数据集" /> },
                  }}
                />
              ),
            },
          ]}
        />
      </div>

      <Modal
        title="新建联动数据集"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          form.resetFields();
        }}
        onOk={() => void form.submit()}
        confirmLoading={creating}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ sourceStatus: "draft", selectedThemes: ["user", "merchant", "activity"], instanceIds: [] }}
          onFinish={(values) => void handleSubmit(values)}
        >
          <Form.Item name="dataSourceName" label="数据集名称" rules={[{ required: true, message: "请输入联动数据集名称" }]}>
            <Input placeholder="例如：畜牧行业联动数据集" />
          </Form.Item>
          <Form.Item name="dataSourceCode" label="数据集编码">
            <Input placeholder="可不填，系统会自动生成" />
          </Form.Item>
          <Form.Item name="industryCode" label="行业编码" rules={[{ required: true, message: "请选择行业编码" }]}>
            <Select showSearch optionFilterProp="label" options={industryOptions} />
          </Form.Item>
          <Form.Item name="selectedThemes" label="共享主题" rules={[{ required: true, message: "请至少选择一个共享主题" }]}>
            <Select
              mode="multiple"
              options={[
                { label: "用户身份", value: "user" },
                { label: "经营主体", value: "merchant" },
                { label: "业务活动", value: "activity" },
              ]}
            />
          </Form.Item>
          <Form.Item name="instanceIds" label="装配实例" rules={[{ required: true, message: "请至少选择两个业务实例" }]}>
            <Select mode="multiple" showSearch optionFilterProp="label" options={instanceOptions} />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="联动预览基于实例当前数据方案实时生成"
            description="尚未生成数据方案的实例会保留装配关系，但需要后续补齐数据方案后才能完整参与联动。"
          />
          <Form.Item name="dataSourceDesc" label="数据集说明">
            <Input.TextArea rows={4} placeholder="描述联动目标、共享实体范围和主题说明" />
          </Form.Item>
          <Form.Item name="sourceStatus" label="数据集状态">
            <Select
              options={[
                { label: "草稿", value: "draft" },
                { label: "启用", value: "active" },
                { label: "归档", value: "archived" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
