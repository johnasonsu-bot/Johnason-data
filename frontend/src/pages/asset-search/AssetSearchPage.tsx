import { BulbOutlined, ClearOutlined, FilterOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Checkbox, Col, Collapse, Empty, Form, Input, InputNumber, List, Row, Select, Space, Switch, Tabs, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { StatusTag } from "../../components/ui/StatusTag";
import {
  fetchAssetSearchFacets,
  sendAssetSearchFeedback,
  searchAssets,
  type AssetSearchFacetOptions,
  type AssetSearchResponse,
  type AssetSearchResult,
  type AssetSourceModule,
  type AssetType,
} from "../../services/assetSearch";

type SearchFormValues = {
  keyword?: string;
  aiEnabled?: boolean;
  scope?: "all" | AssetType;
  sourceModules?: AssetSourceModule[];
  departmentId?: number;
  businessSystemId?: number;
  dataSourceRef?: string;
  status?: string;
  owner?: string;
  profileStatus?: string;
  limit?: number;
};

type AssetSearchFeedbackValue = "accurate" | "inaccurate" | "irrelevant";

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  table: "表资源",
  field: "字段",
  datasource: "数据源",
  ingestion_task: "接入任务",
  quality_rule: "质量规则",
  quality_strategy: "质量策略",
  quality_result: "质量结果",
  service_api: "服务API",
  service_app: "服务应用",
};

const SOURCE_MODULE_LABELS: Record<AssetSourceModule, string> = {
  data_map: "数据地图",
  ingestion: "数据接入",
  quality: "质量管控",
  services: "数据服务",
};

const DEFAULT_MODULES: AssetSourceModule[] = ["data_map", "ingestion", "quality", "services"];

const scopeOptions = [
  { value: "all", label: "全部" },
  { value: "table", label: "表资源" },
  { value: "field", label: "字段" },
  { value: "datasource", label: "数据源" },
  { value: "ingestion_task", label: "接入任务" },
  { value: "quality_rule", label: "质量规则" },
  { value: "quality_strategy", label: "质量策略" },
  { value: "service_api", label: "服务API" },
];

const tabItems = [
  { key: "all", label: "全部" },
  { key: "table", label: "表资源" },
  { key: "field", label: "字段" },
  { key: "ingestion", label: "接入" },
  { key: "quality", label: "质量" },
  { key: "services", label: "服务" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

function asText(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.length ? value.join("、") : "-";
  return String(value);
}

function moduleColor(moduleName: AssetSourceModule) {
  if (moduleName === "data_map") return "blue";
  if (moduleName === "ingestion") return "cyan";
  if (moduleName === "quality") return "gold";
  return "green";
}

function typeColor(assetType: AssetType) {
  if (assetType === "field") return "geekblue";
  if (assetType === "service_api") return "green";
  if (assetType.startsWith("quality")) return "orange";
  if (assetType === "ingestion_task") return "cyan";
  return "blue";
}

function FieldResultCard({ result, onOpen, onFeedback }: { result: AssetSearchResult; onOpen: (path: string) => void; onFeedback: (result: AssetSearchResult, feedback: AssetSearchFeedbackValue) => void }) {
  const context = result.context || {};
  return (
    <Card className="asset-search-result-card asset-search-field-card" variant="borderless">
      <Space direction="vertical" size={10} style={{ width: "100%" }}>
        <div className="asset-search-result-card__header">
          <Space wrap>
            <Typography.Title level={5} style={{ margin: 0 }}>{result.title}</Typography.Title>
            <Tag color={moduleColor(result.sourceModule)}>{SOURCE_MODULE_LABELS[result.sourceModule]}</Tag>
            <Tag color="geekblue">字段</Tag>
            {result.status ? <StatusTag status={result.status} /> : null}
          </Space>
          <Typography.Text type="secondary">得分 {Math.round(result.score)}</Typography.Text>
        </div>
        <Row gutter={[12, 8]}>
          <Col xs={24} lg={8}><Typography.Text type="secondary">字段注释：</Typography.Text>{asText(context.fieldComment)}</Col>
          <Col xs={24} lg={8}><Typography.Text type="secondary">字段类型：</Typography.Text>{asText(context.fieldType)}</Col>
          <Col xs={24} lg={8}><Typography.Text type="secondary">所属表：</Typography.Text>{asText(context.tableName)} / {asText(context.resourceCode)}</Col>
          <Col xs={24} lg={8}><Typography.Text type="secondary">部门系统：</Typography.Text>{asText(context.departmentName)} / {asText(context.businessSystemName)}</Col>
          <Col xs={24} lg={8}><Typography.Text type="secondary">数据源：</Typography.Text>{asText(context.dataSourceName)}</Col>
          <Col xs={24} lg={8}><Typography.Text type="secondary">组织分类：</Typography.Text>{asText(context.organizationCatalog)}</Col>
        </Row>
        <Space wrap size={[6, 6]}>
          {(context.semanticTags as string[] | undefined || []).map((tag) => <Tag key={`s-${tag}`}>{tag}</Tag>)}
          {(context.featureTags as string[] | undefined || []).map((tag) => <Tag key={`f-${tag}`} color="purple">{tag}</Tag>)}
          {(context.sampleValues as string[] | undefined || []).slice(0, 5).map((value) => <Tag key={`v-${value}`} color="default">{value}</Tag>)}
        </Space>
        {result.highlights.length > 0 ? (
          <Space direction="vertical" size={4}>
            {result.highlights.slice(0, 3).map((item, index) => (
              <Typography.Text key={`${item.field}-${index}`} type="secondary">{item.text}</Typography.Text>
            ))}
          </Space>
        ) : null}
        {context.aiReason ? <Alert type="info" showIcon message="AI 推荐理由" description={asText(context.aiReason)} /> : null}
        <Space wrap>
          {result.actions.map((action) => (
            <Button key={action.path} type="link" onClick={() => onOpen(action.path)}>{action.label}</Button>
          ))}
          <Button size="small" onClick={() => onFeedback(result, "accurate")}>准确</Button>
          <Button size="small" onClick={() => onFeedback(result, "inaccurate")}>不准确</Button>
          <Button size="small" onClick={() => onFeedback(result, "irrelevant")}>不相关</Button>
        </Space>
      </Space>
    </Card>
  );
}

function GenericResultCard({ result, onOpen, onFeedback }: { result: AssetSearchResult; onOpen: (path: string) => void; onFeedback: (result: AssetSearchResult, feedback: AssetSearchFeedbackValue) => void }) {
  return (
    <Card className="asset-search-result-card" variant="borderless">
      <Space direction="vertical" size={10} style={{ width: "100%" }}>
        <div className="asset-search-result-card__header">
          <Space wrap>
            <Typography.Title level={5} style={{ margin: 0 }}>{result.title}</Typography.Title>
            <Tag color={moduleColor(result.sourceModule)}>{SOURCE_MODULE_LABELS[result.sourceModule]}</Tag>
            <Tag color={typeColor(result.assetType)}>{ASSET_TYPE_LABELS[result.assetType]}</Tag>
            {result.status ? <StatusTag status={result.status} /> : null}
          </Space>
          <Typography.Text type="secondary">得分 {Math.round(result.score)}</Typography.Text>
        </div>
        <Space direction="vertical" size={2}>
          {result.subtitle ? <Typography.Text strong>{result.subtitle}</Typography.Text> : null}
          {result.description ? <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>{result.description}</Typography.Paragraph> : null}
        </Space>
        <Space wrap size={[6, 6]}>
          {(result.tags || []).filter(Boolean).slice(0, 8).map((tag) => <Tag key={tag}>{tag}</Tag>)}
          {result.owner ? <Tag color="default">负责人：{result.owner}</Tag> : null}
        </Space>
        {result.highlights.length > 0 ? (
          <Space direction="vertical" size={4}>
            {result.highlights.slice(0, 3).map((item, index) => (
              <Typography.Text key={`${item.field}-${index}`} type="secondary">{item.text}</Typography.Text>
            ))}
          </Space>
        ) : null}
        {result.context?.aiReason ? <Alert type="info" showIcon message="AI 推荐理由" description={asText(result.context.aiReason)} /> : null}
        <Space wrap>
          {result.actions.map((action) => (
            <Button key={action.path} type="link" onClick={() => onOpen(action.path)}>{action.label}</Button>
          ))}
          <Button size="small" onClick={() => onFeedback(result, "accurate")}>准确</Button>
          <Button size="small" onClick={() => onFeedback(result, "inaccurate")}>不准确</Button>
          <Button size="small" onClick={() => onFeedback(result, "irrelevant")}>不相关</Button>
        </Space>
      </Space>
    </Card>
  );
}

export function AssetSearchPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm<SearchFormValues>();
  const [facets, setFacets] = useState<AssetSearchFacetOptions | null>(null);
  const [response, setResponse] = useState<AssetSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [facetLoading, setFacetLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const selectedDepartmentId = Form.useWatch("departmentId", form);
  const selectedSourceModules = Form.useWatch("sourceModules", form) || DEFAULT_MODULES;

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

  const dataSourceOptions = useMemo(
    () => (facets?.dataSources || [])
      .filter((item) => selectedSourceModules.includes(item.sourceModule))
      .map((item) => ({ value: `${item.sourceModule}:${item.id}`, label: `${SOURCE_MODULE_LABELS[item.sourceModule]} / ${item.label} (${item.code})` })),
    [facets, selectedSourceModules]
  );

  const results = response?.results || [];
  const filteredResults = useMemo(() => {
    if (activeTab === "all") return results;
    if (activeTab === "table") return results.filter((item) => item.assetType === "table");
    if (activeTab === "field") return results.filter((item) => item.assetType === "field");
    if (activeTab === "ingestion") return results.filter((item) => item.sourceModule === "ingestion");
    if (activeTab === "quality") return results.filter((item) => item.sourceModule === "quality");
    if (activeTab === "services") return results.filter((item) => item.sourceModule === "services");
    return results;
  }, [activeTab, results]);

  async function loadFacets() {
    if (!token) return;
    setFacetLoading(true);
    try {
      const res = await fetchAssetSearchFacets(token);
      setFacets(res.data);
    } catch (error) {
      message.error(`加载筛选条件失败：${getErrorMessage(error)}`);
    } finally {
      setFacetLoading(false);
    }
  }

  async function runSearch(values: SearchFormValues = form.getFieldsValue()) {
    if (!token) return;
    setLoading(true);
    try {
      const scope = values.scope || "all";
      const res = await searchAssets(token, {
        keyword: values.keyword || "",
        aiEnabled: Boolean(values.aiEnabled),
        scopes: scope === "all" ? [] : [scope],
        sourceModules: values.sourceModules?.length ? values.sourceModules : DEFAULT_MODULES,
        filters: {
          departmentId: values.departmentId,
          businessSystemId: values.businessSystemId,
          dataSourceRef: values.dataSourceRef,
          status: values.status,
          owner: values.owner,
          profileStatus: values.profileStatus,
        },
        limit: values.limit || 100,
      });
      setResponse(res.data);
      if (res.data.errors?.length) {
        message.warning(`部分模块检索失败：${res.data.errors.map((item) => `${item.sourceModule} ${item.message}`).join("；")}`);
      }
    } catch (error) {
      message.error(`元数据检索失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  function resetSearch() {
    form.setFieldsValue({
      keyword: "",
      aiEnabled: false,
      scope: "all",
      sourceModules: DEFAULT_MODULES,
      departmentId: undefined,
      businessSystemId: undefined,
      dataSourceRef: undefined,
      status: undefined,
      owner: undefined,
      profileStatus: undefined,
      limit: 100,
    });
    void runSearch({
      scope: "all",
      sourceModules: DEFAULT_MODULES,
      limit: 100,
    });
  }

  async function handleFeedback(result: AssetSearchResult, feedback: AssetSearchFeedbackValue) {
    if (!token) return;
    try {
      await sendAssetSearchFeedback(token, {
        keyword: response?.keyword || form.getFieldValue("keyword") || "",
        aiEnabled: Boolean(form.getFieldValue("aiEnabled")),
        mode: response?.mode || "",
        resultId: result.id,
        feedback,
        resultSnapshot: result,
      });
      message.success("反馈已记录");
    } catch (error) {
      message.error(`反馈提交失败：${getErrorMessage(error)}`);
    }
  }

  useEffect(() => {
    if (!token) return;
    void loadFacets();
    void runSearch({ scope: "all", sourceModules: DEFAULT_MODULES, limit: 100 });
  }, [token]);

  return (
    <div className="app-page asset-search-page">
      <div className="app-page-body">
        <Form<SearchFormValues>
          form={form}
          layout="vertical"
          initialValues={{ aiEnabled: false, scope: "all", sourceModules: DEFAULT_MODULES, limit: 100 }}
          onFinish={(values) => void runSearch(values)}
        >
          <Card className="asset-search-hero" variant="borderless" loading={facetLoading}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <div>
                <Typography.Text className="asset-search-eyebrow">GLOBAL METADATA DISCOVERY</Typography.Text>
                <Typography.Title level={3} style={{ margin: "4px 0 6px" }}>元数据检索</Typography.Title>
                <Typography.Text type="secondary">统一检索数据地图、数据接入、质量管控和数据服务资产，支持表、字段、任务、规则、策略和服务 API 多粒度结果。</Typography.Text>
              </div>
              <div className="asset-search-mainbar">
                <Form.Item name="keyword" noStyle>
                  <Input
                    allowClear
                    size="large"
                    placeholder="搜索表名 / 字段名 / 字段注释 / 服务路径 / 质量规则，例如：婚姻登记里男方国籍字段在哪些表"
                    onPressEnter={() => form.submit()}
                  />
                </Form.Item>
                <Button type="primary" size="large" icon={<SearchOutlined />} loading={loading} onClick={() => form.submit()}>检索</Button>
              </div>
              <div className="asset-search-controls">
                <Form.Item name="aiEnabled" valuePropName="checked" noStyle>
                  <Switch checkedChildren="AI 辅助" unCheckedChildren="AI 辅助" />
                </Form.Item>
                <Typography.Text type="secondary">默认普通检索，不调用大模型；开启后若模型链路未配置会安全降级。</Typography.Text>
              </div>
              <div className="asset-search-scope">
                <Typography.Text strong>搜索范围</Typography.Text>
                <Form.Item name="scope" noStyle>
                  <Select options={scopeOptions} style={{ width: 180 }} />
                </Form.Item>
              </div>
              <div className="asset-search-scope">
                <Typography.Text strong>来源模块</Typography.Text>
                <Form.Item name="sourceModules" noStyle>
                  <Checkbox.Group
                    options={DEFAULT_MODULES.map((value) => ({ value, label: SOURCE_MODULE_LABELS[value] }))}
                    onChange={(values) => {
                      if (values.length === 0) {
                        form.setFieldsValue({ sourceModules: DEFAULT_MODULES });
                      }
                      form.setFieldsValue({ dataSourceRef: undefined });
                    }}
                  />
                </Form.Item>
              </div>
            </Space>
          </Card>

          <Collapse
            className="asset-search-filter-collapse"
            items={[{
              key: "filters",
              label: <Space><FilterOutlined />筛选条件</Space>,
              children: (
                <Row gutter={16} align="bottom">
                  <Col xs={24} lg={4}>
                    <Form.Item name="departmentId" label="部门">
                      <Select allowClear showSearch optionFilterProp="label" options={departmentOptions} onChange={() => form.setFieldsValue({ businessSystemId: undefined })} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={4}>
                    <Form.Item name="businessSystemId" label="业务系统">
                      <Select allowClear showSearch optionFilterProp="label" options={systemOptions} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={5}>
                    <Form.Item name="dataSourceRef" label="数据源">
                      <Select allowClear showSearch optionFilterProp="label" options={dataSourceOptions} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={4}>
                    <Form.Item name="status" label="状态">
                      <Select allowClear options={(facets?.statuses || []).map((item) => ({ value: item.value, label: item.label }))} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={4}>
                    <Form.Item name="profileStatus" label="画像状态">
                      <Select allowClear options={[
                        { value: "pending", label: "待画像" },
                        { value: "succeeded", label: "已完成" },
                        { value: "partial", label: "部分完成" },
                        { value: "failed", label: "失败" },
                      ]} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={4}>
                    <Form.Item name="owner" label="负责人">
                      <Input allowClear />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={3}>
                    <Form.Item name="limit" label="返回条数">
                      <InputNumber min={1} max={500} style={{ width: "100%" }} />
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
              ),
            }]}
          />
        </Form>

        {response?.ai && (form.getFieldValue("aiEnabled") || response.ai.fallbackReason) ? (
          <Card className="asset-search-ai-panel" variant="borderless">
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              {!response.ai.enabled && response.ai.fallbackReason ? (
                <Alert type="warning" showIcon message="AI 辅助已安全降级" description={response.ai.summary} />
              ) : null}
              {response.ai.enabled && response.ai.summary ? (
                <Alert type="info" showIcon message="AI 归纳总结" description={response.ai.summary} />
              ) : null}
              <Space wrap>
                <BulbOutlined />
                <Typography.Text strong>AI 理解：</Typography.Text>
                <Typography.Text>{response.ai.intent || "-"}</Typography.Text>
              </Space>
              <Space wrap>
                <Typography.Text strong>改写关键词：</Typography.Text>
                {(response.ai.expandedKeywords || []).map((item) => <Tag key={item} color="blue">{item}</Tag>)}
              </Space>
              {(response.ai.suggestions || []).length ? (
                <Space wrap>
                  <Typography.Text strong>推荐：</Typography.Text>
                  {(response.ai.suggestions || []).map((item) => <Tag key={item}>{item}</Tag>)}
                </Space>
              ) : null}
              {(response.ai.recommendedResults || []).length ? (
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <Typography.Text strong>推荐结果</Typography.Text>
                  {(response.ai.recommendedResults || []).map((item) => {
                    const matched = results.find((result) => result.id === item.id);
                    return (
                      <Typography.Text key={item.id} type="secondary">
                        {matched?.title || item.id}：{item.reason || "相关性较高"}
                      </Typography.Text>
                    );
                  })}
                </Space>
              ) : null}
            </Space>
          </Card>
        ) : null}

        <Card className="asset-search-summary" variant="borderless">
          <Space wrap size={[12, 8]}>
            <Tag color="blue">总计 {response?.stats.total || 0}</Tag>
            {Object.entries(response?.stats.bySourceModule || {}).map(([moduleName, count]) => (
              <Tag key={moduleName} color={moduleColor(moduleName as AssetSourceModule)}>{SOURCE_MODULE_LABELS[moduleName as AssetSourceModule] || moduleName} {count}</Tag>
            ))}
            {Object.entries(response?.stats.byAssetType || {}).map(([assetType, count]) => (
              <Tag key={assetType}>{ASSET_TYPE_LABELS[assetType as AssetType] || assetType} {count}</Tag>
            ))}
          </Space>
        </Card>

        <Card className="asset-search-results" variant="borderless">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems.map((tab) => ({
              key: tab.key,
              label: tab.label,
              children: filteredResults.length > 0 ? (
                <List
                  loading={loading}
                  dataSource={filteredResults}
                  split={false}
                  renderItem={(result) => (
                    <List.Item key={result.id}>
                      {result.assetType === "field"
                        ? <FieldResultCard result={result} onOpen={navigate} onFeedback={handleFeedback} />
                        : <GenericResultCard result={result} onOpen={navigate} onFeedback={handleFeedback} />}
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={loading ? "正在检索" : "暂无匹配资产"} />
              ),
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
