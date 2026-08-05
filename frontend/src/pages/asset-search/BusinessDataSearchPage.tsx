import { ClearOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, Form, InputNumber, List, Row, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  fetchAssetSearchFacets,
  searchBusinessData,
  type AssetSearchFacetOptions,
  type BusinessDataSearchResponse,
  type BusinessDataSearchTableResult,
} from "../../services/assetSearch";
import {
  fetchDataMapCatalogs,
  fetchDataMapDataSources,
  type DataMapCatalog,
  type DataMapDataSource,
} from "../../services/dataMap";
import { fetchStandardDataElements, type StandardDataElement } from "../../services/dataStandards";

type BusinessDataSearchFormValues = {
  conditions?: Array<{
    elementId?: number;
    values?: string[];
  }>;
  matchMode?: "all" | "any";
  catalogId?: number;
  departmentId?: number;
  businessSystemId?: number;
  dataSourceId?: number;
  status?: string;
  limit?: number;
  perResourceLimit?: number;
};

type RowRecord = Record<string, unknown> & { __rowKey: string };

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.map((item) => String(item)).join("、");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function buildRowColumns(rows: Record<string, unknown>[]): ColumnsType<RowRecord> {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 60);
  return keys.map((key) => ({
    title: key,
    dataIndex: key,
    key,
    width: 180,
    ellipsis: true,
    render: (value: unknown) => formatCellValue(value),
  }));
}

function BusinessDataResultCard({ result, onOpen }: { result: BusinessDataSearchTableResult; onOpen: (path: string) => void }) {
  const rows: RowRecord[] = result.rows.map((row, index) => ({
    ...row,
    __rowKey: `${result.resourceId}-${index}`,
  }));
  const columns = buildRowColumns(result.rows);

  return (
    <Card className="asset-search-result-card" variant="borderless">
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <div className="asset-search-result-card__header">
          <Space wrap>
            <Typography.Title level={5} style={{ margin: 0 }}>{result.tableName}</Typography.Title>
            <Tag color="blue">{result.hitCount} 条命中</Tag>
            <Tag>{result.resourceCode}</Tag>
            {result.resourceStatus ? <Tag color="green">{result.resourceStatus}</Tag> : null}
          </Space>
          <Typography.Text type="secondary">返回 {result.returnedCount} 条明细</Typography.Text>
        </div>
        <Row gutter={[12, 8]}>
          <Col xs={24} lg={8}><Typography.Text type="secondary">表描述：</Typography.Text>{formatCellValue(result.tableComment)}</Col>
          <Col xs={24} lg={8}><Typography.Text type="secondary">组织目录：</Typography.Text>{formatCellValue(result.catalogName)}</Col>
          <Col xs={24} lg={8}><Typography.Text type="secondary">部门系统：</Typography.Text>{formatCellValue(result.departmentName)} / {formatCellValue(result.businessSystemName)}</Col>
          <Col xs={24} lg={8}><Typography.Text type="secondary">数据源：</Typography.Text>{formatCellValue(result.dataSourceName)}</Col>
          <Col xs={24} lg={8}><Typography.Text type="secondary">资源分类：</Typography.Text>{formatCellValue(result.resourceCategory)}</Col>
        </Row>
        <Space wrap size={[6, 6]}>
          {result.matchedFields.map((field) => (
            <Tag key={`${field.elementId}-${field.columnName}`} color="geekblue">
              {field.elementCode} {field.elementNameCn} / {field.columnName}
            </Tag>
          ))}
        </Space>
        <Table<RowRecord>
          size="small"
          rowKey="__rowKey"
          columns={columns}
          dataSource={rows}
          pagination={rows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
          scroll={{ x: "max-content" }}
        />
        <Space wrap>
          {result.actions.map((action) => (
            <Button key={action.path} type="link" onClick={() => onOpen(action.path)}>{action.label}</Button>
          ))}
        </Space>
      </Space>
    </Card>
  );
}

export function BusinessDataSearchPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm<BusinessDataSearchFormValues>();
  const [facets, setFacets] = useState<AssetSearchFacetOptions | null>(null);
  const [catalogs, setCatalogs] = useState<DataMapCatalog[]>([]);
  const [dataSources, setDataSources] = useState<DataMapDataSource[]>([]);
  const [elementOptions, setElementOptions] = useState<StandardDataElement[]>([]);
  const [response, setResponse] = useState<BusinessDataSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const selectedDepartmentId = Form.useWatch("departmentId", form);
  const selectedBusinessSystemId = Form.useWatch("businessSystemId", form);

  const departmentOptions = useMemo(
    () => (facets?.departments || []).map((item) => ({ value: item.id, label: `${item.label} (${item.code})` })),
    [facets]
  );

  const systemOptions = useMemo(
    () => (facets?.businessSystems || [])
      .filter((item) => !selectedDepartmentId || item.departmentId === Number(selectedDepartmentId))
      .map((item) => ({ value: item.id, label: `${item.label} (${item.code})` })),
    [facets, selectedDepartmentId]
  );

  const catalogOptions = useMemo(
    () => catalogs
      .filter((item) => !selectedDepartmentId || item.departmentId === Number(selectedDepartmentId))
      .filter((item) => !selectedBusinessSystemId || !item.businessSystemId || item.businessSystemId === Number(selectedBusinessSystemId))
      .map((item) => ({ value: item.id, label: `${item.catalogName} (${item.catalogShortCode})` })),
    [catalogs, selectedBusinessSystemId, selectedDepartmentId]
  );

  const dataSourceOptions = useMemo(
    () => dataSources
      .filter((item) => !selectedDepartmentId || item.departmentId === Number(selectedDepartmentId))
      .filter((item) => !selectedBusinessSystemId || item.businessSystemId === Number(selectedBusinessSystemId))
      .map((item) => ({ value: item.id, label: `${item.sourceName} (${item.sourceCode})` })),
    [dataSources, selectedBusinessSystemId, selectedDepartmentId]
  );

  async function loadOptions() {
    if (!token) return;
    setOptionsLoading(true);
    try {
      const [facetRes, catalogRes, sourceRes, elementRes] = await Promise.all([
        fetchAssetSearchFacets(token),
        fetchDataMapCatalogs(token),
        fetchDataMapDataSources(token),
        fetchStandardDataElements(token, { lifecycleStatus: "published" }),
      ]);
      setFacets(facetRes.data);
      setCatalogs(catalogRes.data || []);
      setDataSources(sourceRes.data || []);
      setElementOptions(elementRes.data || []);
    } catch (error) {
      message.error(`加载检索条件失败：${getErrorMessage(error)}`);
    } finally {
      setOptionsLoading(false);
    }
  }

  async function runSearch(values: BusinessDataSearchFormValues = form.getFieldsValue()) {
    if (!token) return;
    const conditions = (values.conditions || [])
      .map((condition) => ({
        elementId: Number(condition.elementId || 0),
        values: Array.from(new Set((condition.values || []).map((item) => String(item || "").trim()).filter(Boolean))),
      }))
      .filter((condition) => condition.elementId > 0 && condition.values.length > 0);
    if (!conditions.length) {
      message.warning("请至少选择一个数据元并填写检索值");
      return;
    }

    setLoading(true);
    try {
      const res = await searchBusinessData(token, {
        conditions,
        matchMode: values.matchMode || "all",
        filters: {
          catalogId: values.catalogId,
          departmentId: values.departmentId,
          businessSystemId: values.businessSystemId,
          dataSourceId: values.dataSourceId,
          status: values.status,
        },
        limit: values.limit || 100,
        perResourceLimit: values.perResourceLimit || 20,
      });
      setResponse(res.data);
      if (res.data.errors?.length) {
        message.warning(`部分表检索失败：${res.data.errors.map((item) => `${item.tableName} ${item.message}`).join("；")}`);
      }
    } catch (error) {
      message.error(`业务数据检索失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  function resetSearch() {
    form.setFieldsValue({
      conditions: [{ values: [] }],
      matchMode: "all",
      catalogId: undefined,
      departmentId: undefined,
      businessSystemId: undefined,
      dataSourceId: undefined,
      status: undefined,
      limit: 100,
      perResourceLimit: 20,
    });
    setResponse(null);
  }

  useEffect(() => {
    void loadOptions();
  }, [token]);

  return (
    <div className="app-page asset-search-page">
      <div className="app-page-body">
        <Form<BusinessDataSearchFormValues>
          form={form}
          layout="vertical"
          initialValues={{ conditions: [{ values: [] }], matchMode: "all", limit: 100, perResourceLimit: 20 }}
          onFinish={(values) => void runSearch(values)}
        >
          <Card className="asset-search-hero" variant="borderless" loading={optionsLoading}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <div>
                <Typography.Text className="asset-search-eyebrow">BUSINESS DATA DISCOVERY</Typography.Text>
                <Typography.Title level={3} style={{ margin: "4px 0 6px" }}>业务数据检索</Typography.Title>
                <Typography.Text type="secondary">基于数据地图字段与标准数据元的对标关系，在关联字段中按业务值检索真实数据明细。</Typography.Text>
              </div>

              <Form.List name="conditions">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    {fields.map((field, index) => (
                      <Row key={field.key} gutter={12} align="bottom">
                        <Col xs={24} lg={9}>
                          <Form.Item
                            name={[field.name, "elementId"]}
                            label={index === 0 ? "标准数据元" : " "}
                            rules={[{ required: true, message: "请选择标准数据元" }]}
                          >
                            <Select
                              showSearch
                              allowClear
                              optionFilterProp="label"
                              loading={optionsLoading}
                              placeholder="选择数据元，例如：身份证件号码"
                              options={elementOptions.map((item) => ({
                                value: item.id,
                                label: `${item.elementCode} ${item.elementNameCn}`,
                              }))}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} lg={11}>
                          <Form.Item
                            name={[field.name, "values"]}
                            label={index === 0 ? "检索值" : " "}
                            rules={[{ required: true, message: "请输入检索值" }]}
                          >
                            <Select
                              mode="tags"
                              tokenSeparators={[",", "，", " ", "\n"]}
                              placeholder="输入一个或多个精确匹配值"
                              open={false}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} lg={4}>
                          <Form.Item label={index === 0 ? "操作" : " "}>
                            <Space>
                              <Button icon={<PlusOutlined />} onClick={() => add({ values: [] })}>新增</Button>
                              <Button disabled={fields.length <= 1} onClick={() => remove(field.name)}>删除</Button>
                            </Space>
                          </Form.Item>
                        </Col>
                      </Row>
                    ))}
                  </Space>
                )}
              </Form.List>

              <Row gutter={16} align="bottom">
                <Col xs={24} lg={4}>
                  <Form.Item name="matchMode" label="多条件关系">
                    <Select options={[
                      { value: "all", label: "全部条件" },
                      { value: "any", label: "任一条件" },
                    ]} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4}>
                  <Form.Item name="departmentId" label="部门">
                    <Select allowClear showSearch optionFilterProp="label" options={departmentOptions} onChange={() => form.setFieldsValue({ businessSystemId: undefined, dataSourceId: undefined, catalogId: undefined })} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4}>
                  <Form.Item name="businessSystemId" label="业务系统">
                    <Select allowClear showSearch optionFilterProp="label" options={systemOptions} onChange={() => form.setFieldsValue({ dataSourceId: undefined, catalogId: undefined })} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4}>
                  <Form.Item name="catalogId" label="组织目录">
                    <Select allowClear showSearch optionFilterProp="label" options={catalogOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4}>
                  <Form.Item name="dataSourceId" label="数据源">
                    <Select allowClear showSearch optionFilterProp="label" options={dataSourceOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={3}>
                  <Form.Item name="status" label="资源状态">
                    <Select allowClear options={(facets?.statuses || []).map((item) => ({ value: item.value, label: item.label }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={3}>
                  <Form.Item name="limit" label="返回表数">
                    <InputNumber min={1} max={500} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={3}>
                  <Form.Item name="perResourceLimit" label="每表明细">
                    <InputNumber min={1} max={100} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={6}>
                  <Form.Item label="操作">
                    <Space>
                      <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>检索</Button>
                      <Button icon={<ClearOutlined />} onClick={resetSearch}>重置</Button>
                    </Space>
                  </Form.Item>
                </Col>
              </Row>
            </Space>
          </Card>
        </Form>

        <Card className="asset-search-summary" variant="borderless">
          <Space wrap size={[12, 8]}>
            <Tag color="blue">命中表 {response?.stats.totalTables || 0}</Tag>
            <Tag color="geekblue">命中数据 {response?.stats.totalRows || 0}</Tag>
            <Tag>关联字段 {response?.stats.targetFieldCount || 0}</Tag>
            <Tag>候选资源 {response?.stats.targetResourceCount || 0}</Tag>
          </Space>
        </Card>

        {response?.errors?.length ? (
          <Alert
            type="warning"
            showIcon
            message="部分表检索失败"
            description={response.errors.map((item) => `${item.tableName}：${item.message}`).join("；")}
          />
        ) : null}

        {response?.results?.length ? (
          <List
            loading={loading}
            dataSource={response.results}
            split={false}
            renderItem={(result) => (
              <List.Item key={result.resourceId}>
                <BusinessDataResultCard result={result} onOpen={navigate} />
              </List.Item>
            )}
          />
        ) : (
          <Card className="asset-search-results" variant="borderless">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={loading ? "正在检索" : "暂无业务数据检索结果"} />
          </Card>
        )}
      </div>
    </div>
  );
}
