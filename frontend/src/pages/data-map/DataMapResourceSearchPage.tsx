import { ClearOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Col, Form, Input, InputNumber, Row, Select, Space, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { StatusTag } from "../../components/ui/StatusTag";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  fetchDataMapBusinessSystems,
  fetchDataMapCatalogs,
  fetchDataMapDataSources,
  fetchDataMapDepartments,
  searchDataMapResources,
  type DataMapBusinessSystem,
  type DataMapCatalog,
  type DataMapDataSource,
  type DataMapDepartment,
  type DataMapResourceSearchResult,
} from "../../services/dataMap";

type SearchFormValues = {
  keyword?: string;
  fieldKeyword?: string;
  keywordScopes?: string;
  departmentId?: number;
  businessSystemId?: number;
  catalogId?: number;
  dataSourceId?: number;
  resourceCategory?: string;
  status?: string;
  profileStatus?: string;
  tag?: string;
  limit?: number;
};

type SearchScope = "resource" | "field" | "tag" | "source";

const defaultSearchScopes: SearchScope[] = ["resource", "field", "tag", "source"];
const searchScopeOptions = [
  { value: "resource", label: "资源信息" },
  { value: "field", label: "字段信息" },
  { value: "tag", label: "业务标签" },
  { value: "source", label: "来源信息" },
];

const categoryOptions = [
  { value: "business", label: "业务表" },
  { value: "dictionary", label: "字典表" },
  { value: "relation", label: "关联表" },
  { value: "log", label: "日志表" },
  { value: "temporary", label: "临时表" },
  { value: "low_value", label: "低价值表" },
];

const categoryLabelMap = Object.fromEntries(categoryOptions.map((item) => [item.value, item.label]));

const statusOptions = [
  { value: "active", label: "启用" },
  { value: "inactive", label: "停用" },
];

const profileStatusOptions = [
  { value: "pending", label: "待画像" },
  { value: "succeeded", label: "已完成" },
  { value: "partial", label: "部分完成" },
  { value: "failed", label: "失败" },
];

const profileStatusMeta: Record<string, { label: string; color: string }> = {
  pending: { label: "待画像", color: "gold" },
  succeeded: { label: "已完成", color: "green" },
  partial: { label: "部分完成", color: "blue" },
  failed: { label: "失败", color: "red" },
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function renderProfileStatus(status?: string | null) {
  const normalized = String(status || "pending");
  const meta = profileStatusMeta[normalized] || { label: normalized, color: "default" };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

export function DataMapResourceSearchPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm<SearchFormValues>();
  const [records, setRecords] = useState<DataMapResourceSearchResult[]>([]);
  const [departments, setDepartments] = useState<DataMapDepartment[]>([]);
  const [systems, setSystems] = useState<DataMapBusinessSystem[]>([]);
  const [catalogs, setCatalogs] = useState<DataMapCatalog[]>([]);
  const [sources, setSources] = useState<DataMapDataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [searchScopes, setSearchScopes] = useState<SearchScope[]>(defaultSearchScopes);

  const selectedDepartmentId = Form.useWatch("departmentId", form);
  const selectedSystemId = Form.useWatch("businessSystemId", form);

  const departmentOptions = useMemo(
    () => departments.map((item) => ({ value: item.id, label: `${item.departmentName} (${item.departmentCode})` })),
    [departments]
  );

  const systemOptions = useMemo(
    () => systems
      .filter((item) => !selectedDepartmentId || item.departmentId === Number(selectedDepartmentId))
      .map((item) => ({ value: item.id, label: `${item.systemName} (${item.systemCode})` })),
    [selectedDepartmentId, systems]
  );

  const catalogOptions = useMemo(
    () => catalogs
      .filter((item) => !selectedDepartmentId || item.departmentId === Number(selectedDepartmentId))
      .filter((item) => !selectedSystemId || !item.businessSystemId || item.businessSystemId === Number(selectedSystemId))
      .map((item) => ({ value: item.id, label: `${item.catalogName} (${item.catalogShortCode})` })),
    [catalogs, selectedDepartmentId, selectedSystemId]
  );

  const sourceOptions = useMemo(
    () => sources
      .filter((item) => !selectedDepartmentId || item.departmentId === Number(selectedDepartmentId))
      .filter((item) => !selectedSystemId || item.businessSystemId === Number(selectedSystemId))
      .map((item) => ({ value: item.id, label: `${item.sourceName} (${item.sourceCode})` })),
    [selectedDepartmentId, selectedSystemId, sources]
  );

  async function loadReferences() {
    if (!token) return;
    setReferenceLoading(true);
    try {
      const [deptRes, systemRes, catalogRes, sourceRes] = await Promise.all([
        fetchDataMapDepartments(token),
        fetchDataMapBusinessSystems(token),
        fetchDataMapCatalogs(token),
        fetchDataMapDataSources(token),
      ]);
      setDepartments(deptRes.data || []);
      setSystems(systemRes.data || []);
      setCatalogs(catalogRes.data || []);
      setSources(sourceRes.data || []);
    } catch (error) {
      message.error(`加载筛选条件失败：${getErrorMessage(error)}`);
    } finally {
      setReferenceLoading(false);
    }
  }

  async function loadResults(values: SearchFormValues = form.getFieldsValue()) {
    if (!token) return;
    setLoading(true);
    try {
      const keyword = String(values.keyword || "").trim();
      const activeScopes = searchScopes.length > 0 ? searchScopes : ["resource"];
      const response = await searchDataMapResources(token, {
        ...values,
        keyword: keyword || undefined,
        keywordScopes: keyword ? activeScopes.join(",") : undefined,
        limit: values.limit || 100,
      });
      setRecords(response.data || []);
    } catch (error) {
      message.error(`资源检索失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    void loadReferences();
    void loadResults({ limit: 100 });
  }, [token]);

  function resetFilters() {
    form.resetFields();
    setSearchScopes(defaultSearchScopes);
    form.setFieldsValue({ limit: 100 });
    void loadResults({ limit: 100 });
  }

  const columns: ColumnsType<DataMapResourceSearchResult> = [
    {
      title: "资源编码",
      dataIndex: "resourceCode",
      width: 240,
      fixed: "left",
      render: (value: string, record) => <Button type="link" onClick={() => navigate(`/dashboard/data-map/resources/${record.id}`)}>{value}</Button>,
    },
    {
      title: "资源摘要",
      key: "summary",
      width: 320,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{record.tableName}</Typography.Text>
          <Typography.Text type="secondary" ellipsis style={{ maxWidth: 280 }}>{record.businessName || record.tableComment || "暂无描述"}</Typography.Text>
          {record.businessGrain ? <Tag>{record.businessGrain}</Tag> : null}
        </Space>
      ),
    },
    {
      title: "来源",
      key: "source",
      width: 280,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{record.departmentName} / {record.systemName}</Typography.Text>
          <Typography.Text type="secondary">{record.sourceName} / {record.catalogName}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "分类与标签",
      key: "tags",
      width: 260,
      render: (_, record) => (
        <Space wrap size={[4, 4]}>
          {record.resourceCategory ? <Tag color="blue">{categoryLabelMap[record.resourceCategory] || record.resourceCategory}</Tag> : null}
          {(record.businessTags || []).map((tag) => <Tag key={tag}>{tag}</Tag>)}
        </Space>
      ),
    },
    {
      title: "字段摘要",
      key: "fields",
      width: 300,
      render: (_, record) => {
        const fields = (record.fieldNames || []).slice(0, 8);
        return (
          <Space wrap size={[4, 4]}>
            <Tag color="geekblue">{record.fieldCount ?? record.columnCount} 字段</Tag>
            {fields.map((field) => <Tag key={field}>{field}</Tag>)}
            {(record.fieldCount || 0) > fields.length ? <Tag>+{(record.fieldCount || 0) - fields.length}</Tag> : null}
          </Space>
        );
      },
    },
    { title: "数据量", dataIndex: "rowCount", width: 110, render: (value) => value ?? "-" },
    {
      title: "画像",
      key: "profile",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          {renderProfileStatus(record.profileStatus)}
          <Typography.Text type="secondary">{formatDateTime(record.profiledAt)}</Typography.Text>
        </Space>
      ),
    },
    { title: "状态", dataIndex: "status", width: 100, render: (value: string) => <StatusTag status={value} /> },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 110,
      render: (_, record) => <Button type="link" onClick={() => navigate(`/dashboard/data-map/resources/${record.id}`)}>详情</Button>,
    },
  ];

  return (
    <div className="app-page">
      <div className="app-page-body">
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Form<SearchFormValues> form={form} layout="vertical" initialValues={{ limit: 100 }} onFinish={(values) => void loadResults(values)}>
            <Card variant="borderless" loading={referenceLoading} className="data-map-search-hero">
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <div>
                  <Typography.Text className="data-map-search-eyebrow">DATA DISCOVERY</Typography.Text>
                  <Typography.Title level={3} style={{ margin: "4px 0 6px" }}>按资源语义检索企业数据资产</Typography.Title>
                  <Typography.Text type="secondary">通过一个搜索入口覆盖资源、字段、标签和来源维度，配合组织与画像状态快速收敛结果。</Typography.Text>
                </div>
                <Form.Item name="keyword" noStyle>
                  <Input.Search
                    allowClear
                    size="large"
                    className="data-map-search-input"
                    placeholder="搜索资源编码 / 表名 / 字段 / 标签 / 来源系统..."
                    enterButton={<Button type="primary" size="large" icon={<SearchOutlined />}>检索</Button>}
                    onSearch={() => form.submit()}
                  />
                </Form.Item>
                <div className="data-map-search-scope">
                  <Typography.Text strong>搜索范围</Typography.Text>
                  <Checkbox.Group
                    options={searchScopeOptions}
                    value={searchScopes}
                    onChange={(values) => setSearchScopes((values.length > 0 ? values : ["resource"]) as SearchScope[])}
                  />
                </div>
              </Space>
            </Card>

            <Card variant="borderless" className="data-map-search-filter-card" style={{ marginTop: 16 }}>
              <Row gutter={16} align="bottom">
                <Col xs={24} lg={4}>
                  <Form.Item name="departmentId" label="部门">
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      options={departmentOptions}
                      onChange={() => form.setFieldsValue({ businessSystemId: undefined, catalogId: undefined, dataSourceId: undefined })}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4}>
                  <Form.Item name="businessSystemId" label="业务系统">
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      options={systemOptions}
                      onChange={() => form.setFieldsValue({ catalogId: undefined, dataSourceId: undefined })}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4}>
                  <Form.Item name="catalogId" label="目录">
                    <Select allowClear showSearch optionFilterProp="label" options={catalogOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4}>
                  <Form.Item name="dataSourceId" label="数据源">
                    <Select allowClear showSearch optionFilterProp="label" options={sourceOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4}>
                  <Form.Item name="resourceCategory" label="资源分类">
                    <Select allowClear options={categoryOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4}>
                  <Form.Item name="profileStatus" label="画像状态">
                    <Select allowClear options={profileStatusOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4}>
                  <Form.Item name="status" label="资源状态">
                    <Select allowClear options={statusOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4}>
                  <Form.Item name="limit" label="返回条数">
                    <InputNumber min={1} max={500} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4}>
                  <Form.Item label="操作">
                    <Space>
                      <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>检索</Button>
                      <Button icon={<ClearOutlined />} onClick={resetFilters}>重置</Button>
                    </Space>
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Form>

          <DataTableCard<DataMapResourceSearchResult>
            title={(
              <Space size={8}>
                <span>检索结果</span>
                <Tag color="blue">{records.length}</Tag>
              </Space>
            )}
            tableProps={{
              rowKey: "id",
              loading,
              columns,
              dataSource: records,
              pagination: { pageSize: 10, showSizeChanger: true },
              scroll: { x: 1800 },
            }}
          />
        </Space>
      </div>
    </div>
  );
}
