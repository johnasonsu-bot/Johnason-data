import {
  ArrowLeftOutlined,
  RobotOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { TabsProps } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { PageHeader } from "../../components/ui/PageHeader";
import { PageToolbar } from "../../components/ui/PageToolbar";
import {
  createDataService,
  fetchDataServiceAiConfigs,
  fetchDataServiceDataSourceColumns,
  fetchDataServiceDataSourceSampleRows,
  fetchDataServiceDataSourceTables,
  fetchDataServiceDataSources,
  fetchDataServiceSqlPreview,
  fetchDataServices,
  recommendDataServiceConfig,
  updateDataService,
} from "../../services/dataServices";
import type {
  DataServiceAiConfigRecord,
  DataServiceRecommendResult,
  DataServiceRecord,
  DataSourceColumn,
  DataSourceTable,
} from "../../types/api";

type StepKey = "basic" | "source" | "response" | "query";

type ServiceFieldDraft = {
  columnName?: string;
  operator?: "eq" | "like" | "between";
  required?: boolean;
  requirementMode?: "optional" | "required" | "one_of_group";
  requiredGroup?: string | null;
};

type ServiceFormValues = {
  serviceName: string;
  serviceCode?: string;
  servicePath: string;
  ownerName: string;
  requestMethod: "GET" | "POST";
  serviceType: "list" | "detail";
  authType: "anonymous" | "token";
  status: "draft" | "published" | "disabled";
  description?: string;
  sourceId?: number;
  serviceMode: "table" | "sql";
  sourceTable?: string;
  sourceSql?: string;
  responseFieldNames: string[];
  queryFields: ServiceFieldDraft[];
  pagination: boolean;
  defaultPageSize: number;
  maxPageSize: number;
  defaultSortField?: string;
  defaultSortOrder: "asc" | "desc";
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

function buildColumnLabel(column: DataSourceColumn) {
  return column.columnComment ? `${column.columnName} (${column.columnComment})` : column.columnName;
}

function isIsoDateTimeString(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/i.test(value.trim());
}

function isDateOnlyString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function formatPreviewDateTime(value: string) {
  const trimmed = value.trim();
  if (isDateOnlyString(trimmed)) return trimmed;
  if (!isIsoDateTimeString(trimmed)) return value;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  if (hours === "00" && minutes === "00" && seconds === "00") {
    return `${year}-${month}-${day}`;
  }
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatPreviewCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string") return formatPreviewDateTime(value);
  return String(value);
}

function DraggableTableRegion({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;
    const target = wrapper.querySelector(".ant-table-content, .ant-table-body") as HTMLElement | null;
    if (!target) return undefined;

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    const handleMouseDown = (event: MouseEvent) => {
      isDragging = true;
      startX = event.pageX;
      startScrollLeft = target.scrollLeft;
      target.style.cursor = "grabbing";
      target.style.userSelect = "none";
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) return;
      target.scrollLeft = startScrollLeft - (event.pageX - startX);
    };

    const handleMouseUp = () => {
      isDragging = false;
      target.style.cursor = "grab";
      target.style.removeProperty("user-select");
    };

    target.style.cursor = "grab";
    target.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      target.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [children]);

  return <div ref={wrapperRef}>{children}</div>;
}

export function DataServiceWorkspacePage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const params = useParams();
  const serviceId = params.id ? Number(params.id) : null;
  const isEditMode = Number.isFinite(serviceId) && serviceId !== null;

  const [form] = Form.useForm<ServiceFormValues>();
  const [recommendForm] = Form.useForm();
  const [activeStep, setActiveStep] = useState<StepKey>("basic");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [sqlPreviewLoading, setSqlPreviewLoading] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendModalOpen, setRecommendModalOpen] = useState(false);
  const [recommendSummary, setRecommendSummary] = useState<string[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [services, setServices] = useState<DataServiceRecord[]>([]);
  const [serviceAiConfigs, setServiceAiConfigs] = useState<DataServiceAiConfigRecord[]>([]);
  const [serviceTables, setServiceTables] = useState<DataSourceTable[]>([]);
  const [recommendTables, setRecommendTables] = useState<DataSourceTable[]>([]);
  const [serviceColumns, setServiceColumns] = useState<DataSourceColumn[]>([]);
  const [serviceSampleRows, setServiceSampleRows] = useState<Array<Record<string, unknown>>>([]);
  const [serviceSqlPreviewColumns, setServiceSqlPreviewColumns] = useState<Array<{ columnName: string; label?: string; dataType?: string }>>([]);
  const [serviceSqlPreviewRows, setServiceSqlPreviewRows] = useState<Array<Record<string, unknown>>>([]);
  const [selectedResponseFields, setSelectedResponseFields] = useState<string[]>([]);

  const watchedServiceMode = Form.useWatch("serviceMode", form) as "table" | "sql" | undefined;
  const watchedSourceId = Form.useWatch("sourceId", form) as number | undefined;
  const watchedRecommendMode = Form.useWatch("serviceMode", recommendForm) as "table" | "sql" | undefined;

  useEffect(() => {
    form.setFieldsValue({
      requestMethod: "GET",
      serviceType: "list",
      authType: "token",
      status: "draft",
      serviceMode: "table",
      responseFieldNames: [],
      queryFields: [],
      pagination: true,
      defaultPageSize: 20,
      maxPageSize: 100,
      defaultSortOrder: "desc",
      ownerName: "system",
    });
    setSelectedResponseFields([]);
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      if (!token) return;
      setLoading(true);
      try {
        const [sourceRes, serviceRes, aiRes] = await Promise.all([
          fetchDataServiceDataSources(token),
          fetchDataServices(token),
          fetchDataServiceAiConfigs(token),
        ]);
        setSources(sourceRes.data || []);
        setServices(serviceRes.data || []);
        setServiceAiConfigs(aiRes.data || []);

        if (serviceId) {
          const target = (serviceRes.data || []).find((item) => item.id === serviceId);
          if (!target) {
            message.error("服务不存在");
            navigate("/dashboard/services");
            return;
          }
          form.setFieldsValue({
            serviceName: target.serviceName,
            serviceCode: target.serviceCode,
            servicePath: target.servicePath,
            ownerName: target.ownerName,
            requestMethod: target.requestMethod,
            serviceType: target.serviceType,
            authType: target.authType,
            status: target.status,
            description: target.description || undefined,
            sourceId: target.sourceId || undefined,
            serviceMode: target.serviceMode || "table",
            sourceTable: target.sourceTable || undefined,
            sourceSql: target.sourceSql || undefined,
            responseFieldNames: target.responseConfig.fields.map((item) => item.columnName),
            queryFields: target.queryConfig.filters.map((item) => ({
              columnName: item.columnName,
              operator: item.operator,
              required: item.required,
              requirementMode: item.requirementMode || (item.required ? "required" : "optional"),
              requiredGroup: item.requiredGroup || undefined,
            })),
            pagination: target.queryConfig.pagination !== false,
            defaultPageSize: target.queryConfig.defaultPageSize || 20,
            maxPageSize: target.queryConfig.maxPageSize || 100,
            defaultSortField: target.queryConfig.defaultSortField || undefined,
            defaultSortOrder: (target.queryConfig.defaultSortOrder as "asc" | "desc") || "desc",
          });
          setSelectedResponseFields(target.responseConfig.fields.map((item) => item.columnName));

          if ((target.serviceMode || "table") === "table" && target.sourceId && target.sourceTable) {
            await loadServiceMetadata(target.sourceId, target.sourceTable);
          }
          if ((target.serviceMode || "table") === "sql" && target.sourceId && target.sourceSql) {
            await previewSql(target.sourceId, target.sourceSql, false);
          }
        }
      } catch (error) {
        message.error(`加载服务页面失败: ${getErrorMessage(error)}`);
      } finally {
        setLoading(false);
      }
    }
    void loadInitialData();
  }, [token, serviceId]);

  useEffect(() => {
    if (!watchedSourceId || !token || (watchedServiceMode || "table") !== "table") return;
    if (!form.getFieldValue("sourceTable")) {
      void loadServiceMetadata(watchedSourceId);
    }
  }, [watchedSourceId, watchedServiceMode, token]);

  async function loadServiceMetadata(sourceId: number, tableName?: string) {
    if (!token) return;
    setMetadataLoading(true);
    try {
      const tablesResponse = await fetchDataServiceDataSourceTables(token, sourceId);
      setServiceTables(tablesResponse.data || []);
      const selectedTable = tableName || form.getFieldValue("sourceTable") || tablesResponse.data?.[0]?.tableName;
      if (selectedTable) {
        const [columnsRes, sampleRes] = await Promise.all([
          fetchDataServiceDataSourceColumns(token, sourceId, selectedTable),
          fetchDataServiceDataSourceSampleRows(token, sourceId, selectedTable, 10),
        ]);
        setServiceColumns(columnsRes.data || []);
        setServiceSampleRows(sampleRes.data || []);
        if (!form.getFieldValue("sourceTable")) {
          form.setFieldValue("sourceTable", selectedTable);
        }
      } else {
        setServiceColumns([]);
        setServiceSampleRows([]);
      }
    } catch (error) {
      message.error(`加载表结构失败: ${getErrorMessage(error)}`);
      setServiceTables([]);
      setServiceColumns([]);
      setServiceSampleRows([]);
    } finally {
      setMetadataLoading(false);
    }
  }

  async function loadRecommendTables(sourceId: number) {
    if (!token) return;
    const response = await fetchDataServiceDataSourceTables(token, sourceId);
    setRecommendTables(response.data || []);
  }

  async function handleSourceChange(sourceId: number) {
    form.setFieldsValue({
      sourceTable: undefined,
      sourceSql: undefined,
      responseFieldNames: [],
      queryFields: [],
      defaultSortField: undefined,
    });
    setServiceColumns([]);
    setServiceSampleRows([]);
    setServiceSqlPreviewColumns([]);
    setServiceSqlPreviewRows([]);
    setSelectedResponseFields([]);
    if ((form.getFieldValue("serviceMode") || "table") === "table") {
      await loadServiceMetadata(sourceId);
    }
  }

  async function handleTableChange(tableName: string) {
    const sourceId = form.getFieldValue("sourceId");
    if (!sourceId) return;
    await loadServiceMetadata(Number(sourceId), tableName);
    form.setFieldsValue({
      responseFieldNames: [],
      queryFields: [],
      defaultSortField: undefined,
    });
    setSelectedResponseFields([]);
  }

  async function previewSql(sourceId: number, sql: string, resetSelections = true) {
    if (!token) return;
    setSqlPreviewLoading(true);
    try {
      const response = await fetchDataServiceSqlPreview(token, { sourceId, sql });
      setServiceSqlPreviewColumns(response.data.columns || []);
      setServiceSqlPreviewRows(response.data.sampleRows || []);
      if (resetSelections) {
        form.setFieldsValue({
          responseFieldNames: [],
          queryFields: [],
          defaultSortField: undefined,
        });
        setSelectedResponseFields([]);
      }
      message.success(`SQL 预览成功，识别 ${response.data.columns.length} 个字段`);
    } catch (error) {
      message.error(`SQL 预览失败: ${getErrorMessage(error)}`);
      setServiceSqlPreviewColumns([]);
      setServiceSqlPreviewRows([]);
    } finally {
      setSqlPreviewLoading(false);
    }
  }

  async function handlePreviewSql() {
    const values = await form.validateFields(["sourceId", "sourceSql"]);
    await previewSql(Number(values.sourceId), String(values.sourceSql || ""), true);
  }

  const availableFields = useMemo(
    () => ((watchedServiceMode || "table") === "sql"
      ? serviceSqlPreviewColumns.map((item) => ({
        columnName: item.columnName,
        label: item.label || item.columnName,
        dataType: item.dataType || "string",
      }))
      : serviceColumns.map((item) => ({
        columnName: item.columnName,
        label: buildColumnLabel(item),
        dataType: item.dataType || "string",
      }))),
    [serviceColumns, serviceSqlPreviewColumns, watchedServiceMode]
  );

  const fieldOptions = useMemo(
    () => availableFields.map((item) => ({ label: item.label, value: item.columnName })),
    [availableFields]
  );

  const selectedResponseFieldSet = useMemo(
    () => new Set(selectedResponseFields || []),
    [selectedResponseFields]
  );

  const allFieldsSelected = availableFields.length > 0 && availableFields.every((item) => selectedResponseFieldSet.has(item.columnName));

  function toggleResponseField(columnName: string, checked: boolean) {
    const current = new Set(selectedResponseFields || []);
    if (checked) {
      current.add(columnName);
    } else {
      current.delete(columnName);
    }
    const next = Array.from(current);
    setSelectedResponseFields(next);
    form.setFieldValue("responseFieldNames", next);
  }

  function toggleAllResponseFields() {
    const next = allFieldsSelected ? [] : availableFields.map((item) => item.columnName);
    setSelectedResponseFields(next);
    form.setFieldValue("responseFieldNames", next);
  }

  async function openRecommendModal() {
    recommendForm.resetFields();
    recommendForm.setFieldsValue({
      sourceId: form.getFieldValue("sourceId"),
      serviceMode: form.getFieldValue("serviceMode") || "table",
      sourceTable: form.getFieldValue("sourceTable"),
      sourceSql: form.getFieldValue("sourceSql"),
      requestMethod: form.getFieldValue("requestMethod") || "GET",
      serviceType: form.getFieldValue("serviceType") || "list",
    });
    setRecommendSummary([]);
    setRecommendModalOpen(true);
    const sourceId = form.getFieldValue("sourceId");
    if (sourceId && (form.getFieldValue("serviceMode") || "table") === "table") {
      await loadRecommendTables(sourceId);
    } else {
      setRecommendTables([]);
    }
  }

  async function handleRecommend() {
    if (!token) return;
    try {
      const fieldsToValidate = ["sourceId", "serviceMode", "requestMethod", "serviceType"] as string[];
      if ((recommendForm.getFieldValue("serviceMode") || "table") === "table") {
        fieldsToValidate.push("sourceTable");
      } else {
        fieldsToValidate.push("sourceSql");
      }
      const values = await recommendForm.validateFields(fieldsToValidate);
      setRecommendLoading(true);
      const response = await recommendDataServiceConfig(token, values);
      const recommendation = response.data.recommendation || {} as DataServiceRecommendResult;
      form.setFieldsValue({
        sourceId: values.sourceId,
        serviceMode: values.serviceMode,
        sourceTable: values.serviceMode === "table" ? values.sourceTable : undefined,
        sourceSql: values.serviceMode === "sql" ? values.sourceSql : undefined,
        serviceName: recommendation.serviceName || form.getFieldValue("serviceName"),
        serviceCode: recommendation.serviceCode || form.getFieldValue("serviceCode"),
        servicePath: recommendation.servicePath || form.getFieldValue("servicePath"),
        requestMethod: recommendation.requestMethod || values.requestMethod || "GET",
        serviceType: recommendation.serviceType || values.serviceType || "list",
        description: recommendation.description || form.getFieldValue("description"),
        defaultSortField: recommendation.defaultSortField || undefined,
        defaultSortOrder: recommendation.defaultSortOrder || "desc",
        queryFields: (recommendation.queryFields || []).map((item) => ({
          columnName: item.columnName,
          operator: item.operator || "eq",
          required: Boolean(item.required),
          requirementMode: item.requirementMode || (item.required ? "required" : "optional"),
          requiredGroup: item.requiredGroup || undefined,
        })),
        responseFieldNames: recommendation.responseFieldNames || [],
      });
      setSelectedResponseFields(recommendation.responseFieldNames || []);
      if (values.serviceMode === "table") {
        await loadServiceMetadata(values.sourceId, values.sourceTable);
      } else {
        await previewSql(values.sourceId, values.sourceSql, false);
      }
      setRecommendSummary(recommendation.reasoning || []);
      setRecommendModalOpen(false);
      message.success("AI 推荐已回填");
    } catch (error) {
      if (typeof error === "object" && error && "errorFields" in error) return;
      message.error(`AI 推荐失败: ${getErrorMessage(error)}`);
    } finally {
      setRecommendLoading(false);
    }
  }

  async function handleSave() {
    if (!token) return;
    try {
      const values = await form.validateFields();
      const fullValues = {
        ...form.getFieldsValue(true),
        ...values,
      } as ServiceFormValues;
      const columnMap = new Map(availableFields.map((item) => [item.columnName, item]));
      const responseFieldNames = selectedResponseFields || [];
      if (!responseFieldNames.length) {
        message.error("请至少选择一个返回字段");
        setActiveStep("response");
        return;
      }
      const payload = {
        serviceName: fullValues.serviceName,
        serviceCode: fullValues.serviceCode,
        servicePath: fullValues.servicePath,
        ownerName: fullValues.ownerName,
        requestMethod: fullValues.requestMethod,
        serviceType: fullValues.serviceType,
        authType: fullValues.authType,
        status: fullValues.status,
        description: fullValues.description,
        sourceId: fullValues.sourceId,
        serviceMode: fullValues.serviceMode,
        sourceTable: fullValues.serviceMode === "table" ? fullValues.sourceTable : undefined,
        sourceSql: fullValues.serviceMode === "sql" ? fullValues.sourceSql : undefined,
        queryConfig: {
          filters: (fullValues.queryFields || []).filter((item) => item?.columnName).map((item) => {
            const columnName = String(item.columnName);
            const operator = String(item.operator || "eq");
            const column = columnMap.get(columnName);
            const requirementMode = String(item.requirementMode || (item.required ? "required" : "optional"));
            return {
              columnName,
              operator,
              required: requirementMode === "required",
              requirementMode,
              requiredGroup: requirementMode === "one_of_group" ? (item.requiredGroup || null) : null,
              label: column?.label || columnName,
              dataType: column?.dataType || "string",
              paramName: operator === "between" ? undefined : columnName,
              startParamName: operator === "between" ? `${columnName}Start` : undefined,
              endParamName: operator === "between" ? `${columnName}End` : undefined,
            };
          }),
          pagination: Boolean(fullValues.pagination),
          defaultPageSize: fullValues.defaultPageSize,
          maxPageSize: fullValues.maxPageSize,
          defaultSortField: fullValues.defaultSortField,
          defaultSortOrder: fullValues.defaultSortOrder,
        },
        responseConfig: {
          fields: responseFieldNames.map((columnName: string) => {
            const column = columnMap.get(columnName);
            return {
              columnName,
              fieldName: columnName,
              label: column?.label || columnName,
              dataType: column?.dataType || "string",
            };
          }),
        },
      };

      setSaving(true);
      if (serviceId) {
        await updateDataService(token, serviceId, payload);
        message.success("服务已更新");
      } else {
        await createDataService(token, payload);
        message.success("服务已创建");
      }
      navigate("/dashboard/services");
    } catch (error) {
      if (typeof error === "object" && error && "errorFields" in error) return;
      message.error(`保存服务失败: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  const previewColumns = useMemo(
    () => availableFields.map((item) => ({
      title: item.label,
      dataIndex: item.columnName,
      key: item.columnName,
      width: 180,
      ellipsis: true,
      render: (value: unknown) => formatPreviewCellValue(value),
    })),
    [availableFields]
  );

  const previewRows = useMemo(
    () => ((watchedServiceMode || "table") === "sql" ? serviceSqlPreviewRows : serviceSampleRows),
    [serviceSampleRows, serviceSqlPreviewRows, watchedServiceMode]
  );

  const activeSourceOptions = useMemo(
    () => sources.filter((item) => item.status === "active").map((item) => ({
      label: `${item.sourceName} (${item.sourceType})`,
      value: item.id,
    })),
    [sources]
  );

  const tabItems: TabsProps["items"] = [
    {
      key: "basic",
      label: "基础配置",
      forceRender: true,
      children: (
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <Form layout="vertical" form={form}>
            <Row gutter={[12, 8]}>
              <Col xs={24} md={12}><Form.Item name="serviceName" label="服务名称" rules={[{ required: true, message: "请输入服务名称" }]}><Input /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="serviceCode" label="服务编码"><Input placeholder="可留空，保存时自动生成" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="servicePath" label="接口路径" rules={[{ required: true, message: "请输入接口路径" }]}><Input placeholder="/demo/orders" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="ownerName" label="负责人" rules={[{ required: true, message: "请输入负责人" }]}><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="requestMethod" label="请求方式" rules={[{ required: true, message: "请选择请求方式" }]}><Select options={[{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }]} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="serviceType" label="服务类型" rules={[{ required: true, message: "请选择服务类型" }]}><Select options={[{ value: "list", label: "列表查询" }, { value: "detail", label: "详情查询" }]} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="authType" label="认证方式" rules={[{ required: true, message: "请选择认证方式" }]}><Select options={[{ value: "token", label: "Token 认证" }, { value: "anonymous", label: "免认证" }]} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="status" label="服务状态" rules={[{ required: true, message: "请选择服务状态" }]}><Select options={[{ value: "draft", label: "草稿" }, { value: "published", label: "已发布" }, { value: "disabled", label: "停用" }]} /></Form.Item></Col>
              <Col xs={24} md={16}><Form.Item name="description" label="服务说明"><Input /></Form.Item></Col>
            </Row>
          </Form>
        </Card>
      ),
    },
    {
      key: "source",
      label: "数据来源",
      forceRender: true,
      children: (
        <Space direction="vertical" size={12} style={{ display: "flex" }}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Form layout="vertical" form={form}>
              <Row gutter={[12, 8]}>
                <Col xs={24} md={8}>
                  <Form.Item name="sourceId" label="数据源" rules={[{ required: true, message: "请选择数据源" }]}>
                    <Select options={activeSourceOptions} onChange={(value) => void handleSourceChange(value)} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="serviceMode" label="来源模式" rules={[{ required: true, message: "请选择来源模式" }]}>
                    <Select options={[{ value: "table", label: "数据表模式" }, { value: "sql", label: "SQL 模式" }]} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="返回字段数">
                    <Input disabled value={`${selectedResponseFields.length}/${availableFields.length}`} />
                  </Form.Item>
                </Col>
                {(watchedServiceMode || "table") === "table" ? (
                  <Col span={24}>
                    <Form.Item name="sourceTable" label="数据表" rules={[{ required: true, message: "请选择数据表" }]}>
                      <Select loading={metadataLoading} options={serviceTables.map((item) => ({ label: item.tableName, value: item.tableName }))} onChange={(value) => void handleTableChange(value)} />
                    </Form.Item>
                  </Col>
                ) : (
                  <>
                    <Col span={24}>
                      <Form.Item name="sourceSql" label="查询 SQL" rules={[{ required: true, message: "请输入查询 SQL" }]}>
                        <Input.TextArea rows={5} placeholder="请输入 SELECT 或 WITH ... SELECT 查询 SQL" />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Button onClick={() => void handlePreviewSql()} loading={sqlPreviewLoading}>预览 SQL 结果</Button>
                    </Col>
                  </>
                )}
              </Row>
            </Form>
          </Card>

          <Card size="small" title="结果预览" styles={{ body: { padding: 12 } }}>
            <DraggableTableRegion>
              <Table
                size="small"
                rowKey={(_, index) => String(index)}
                pagination={false}
                dataSource={previewRows}
                columns={previewColumns}
                locale={{ emptyText: (watchedServiceMode || "table") === "sql" ? "请先预览 SQL 结果" : "请选择数据表后查看样例数据" }}
                scroll={{ x: "max-content", y: 260 }}
              />
            </DraggableTableRegion>
          </Card>
        </Space>
      ),
    },
    {
      key: "query",
      label: "查询排序",
      forceRender: true,
      children: (
        <Row gutter={12}>
          <Col xs={24} xl={15}>
            <Card size="small" title="查询参数" styles={{ body: { padding: 12 } }}>
              <Form layout="vertical" form={form}>
                <Form.List name="queryFields">
                  {(fields, { add, remove }) => (
                    <Space direction="vertical" size={8} style={{ display: "flex" }}>
                      {fields.map((field) => (
                        <Card key={field.key} size="small" styles={{ body: { padding: 12 } }}>
                          <Row gutter={[8, 4]}>
                            <Col span={6}><Form.Item {...field} name={[field.name, "columnName"]} label="字段" rules={[{ required: true, message: "请选择字段" }]}><Select options={fieldOptions} /></Form.Item></Col>
                            <Col span={5}><Form.Item {...field} name={[field.name, "operator"]} label="查询方式" initialValue="eq"><Select options={[{ value: "eq", label: "精确匹配" }, { value: "like", label: "模糊匹配" }, { value: "between", label: "范围查询" }]} /></Form.Item></Col>
                            <Col span={5}><Form.Item {...field} name={[field.name, "requirementMode"]} label="校验规则" initialValue="optional"><Select options={[{ value: "optional", label: "可选" }, { value: "required", label: "必填" }, { value: "one_of_group", label: "组内至少一项" }]} /></Form.Item></Col>
                            <Col span={6}>
                              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.queryFields?.[field.name]?.requirementMode !== cur.queryFields?.[field.name]?.requirementMode}>
                                {({ getFieldValue }) => {
                                  const currentMode = getFieldValue(["queryFields", field.name, "requirementMode"]);
                                  return currentMode === "one_of_group" ? (
                                    <Form.Item {...field} name={[field.name, "requiredGroup"]} label="分组编码" rules={[{ required: true, message: "请输入分组编码" }]}>
                                      <Input placeholder="如 phone_or_id" />
                                    </Form.Item>
                                  ) : (
                                    <Form.Item label="分组编码"><Input disabled placeholder="仅组内至少一项时需要" /></Form.Item>
                                  );
                                }}
                              </Form.Item>
                            </Col>
                            <Col span={2} style={{ display: "flex", alignItems: "center", justifyContent: "end" }}>
                              <Button danger type="link" onClick={() => remove(field.name)}>删除</Button>
                            </Col>
                          </Row>
                        </Card>
                      ))}
                      <Button size="small" onClick={() => add({ operator: "eq", requirementMode: "optional" })}>新增查询参数</Button>
                    </Space>
                  )}
                </Form.List>
              </Form>
            </Card>
          </Col>
          <Col xs={24} xl={9}>
            <Card size="small" title="分页排序" styles={{ body: { padding: 12 } }}>
              <Form layout="vertical" form={form}>
                <Row gutter={[8, 4]}>
                  <Col span={8}><Form.Item name="pagination" label="启用分页" valuePropName="checked"><Switch /></Form.Item></Col>
                  <Col span={8}><Form.Item name="defaultPageSize" label="默认每页"><InputNumber min={1} max={100} style={{ width: "100%" }} /></Form.Item></Col>
                  <Col span={8}><Form.Item name="maxPageSize" label="最大每页"><InputNumber min={1} max={200} style={{ width: "100%" }} /></Form.Item></Col>
                  <Col span={12}><Form.Item name="defaultSortOrder" label="默认排序"><Select options={[{ value: "desc", label: "倒序" }, { value: "asc", label: "正序" }]} /></Form.Item></Col>
                  <Col span={12}><Form.Item name="defaultSortField" label="默认排序字段"><Select allowClear options={fieldOptions} /></Form.Item></Col>
                </Row>
                {recommendSummary.length ? (
                  <Card size="small" title="AI 推荐依据" styles={{ body: { padding: 12 } }}>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {recommendSummary.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </Card>
                ) : null}
              </Form>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: "response",
      label: "返回字段",
      forceRender: true,
      children: (
        <Card size="small" styles={{ body: { padding: 12 } }}>
          <Space style={{ marginBottom: 12 }}>
            <Button size="small" onClick={toggleAllResponseFields}>{allFieldsSelected ? "取消全选" : "一键全选"}</Button>
            <Typography.Text type="secondary">已选 {selectedResponseFields.length} 个字段</Typography.Text>
          </Space>
          <Table
            size="small"
            rowKey="columnName"
            pagination={false}
            dataSource={availableFields}
            scroll={{ y: 420 }}
            columns={[
              {
                title: "选择",
                key: "checked",
                width: 80,
                render: (_, record) => (
                  <Checkbox
                    checked={selectedResponseFieldSet.has(record.columnName)}
                    onChange={(event) => toggleResponseField(record.columnName, event.target.checked)}
                  />
                ),
              },
              { title: "字段名", dataIndex: "columnName", key: "columnName", width: 220 },
              { title: "字段说明", dataIndex: "label", key: "label", width: 280 },
              { title: "类型", dataIndex: "dataType", key: "dataType", width: 160 },
            ]}
            locale={{ emptyText: "当前没有可选字段，请先选择数据来源" }}
          />
        </Card>
      ),
    },
  ];

  return (
    <div className="app-page">
      <PageHeader
        title={isEditMode ? "编辑服务" : "新建服务"}
        eyebrow="Data Service"
        description="服务开发改为独立工作台，按顶部标签完成配置，避免弹窗过长。"
      />

      <div className="app-page-body">
        <Form form={form} component={false}>
          <Form.Item name="responseFieldNames" hidden initialValue={[]}>
            <Select mode="multiple" options={fieldOptions} />
          </Form.Item>
        </Form>

        <PageToolbar
          left={(
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dashboard/services")}>返回列表</Button>
              <Button icon={<RobotOutlined />} onClick={() => void openRecommendModal()} loading={recommendLoading}>AI 推荐</Button>
            </Space>
          )}
          right={(
            <Button type="primary" icon={<SaveOutlined />} onClick={() => void handleSave()} loading={saving}>
              保存服务
            </Button>
          )}
        />

        <Card bordered={false} loading={loading} styles={{ body: { padding: 16 } }}>
          <Tabs
            activeKey={activeStep}
            onChange={(key) => setActiveStep(key as StepKey)}
            items={tabItems}
            size="small"
            type="card"
          />
        </Card>
      </div>

      <Modal
        open={recommendModalOpen}
        title="AI 推荐"
        width={720}
        onCancel={() => setRecommendModalOpen(false)}
        onOk={() => void handleRecommend()}
        confirmLoading={recommendLoading}
        okText="开始推荐"
        destroyOnHidden
      >
        <Form layout="vertical" form={recommendForm}>
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            先选择数据来源和目标表或 SQL，再生成推荐的接口名称、路径、返回字段、查询参数和默认排序。
          </Typography.Paragraph>
          <Row gutter={[12, 8]}>
            <Col span={12}>
              <Form.Item name="sourceId" label="数据来源" rules={[{ required: true, message: "请选择数据来源" }]}>
                <Select
                  options={activeSourceOptions}
                  onChange={(value) => {
                    recommendForm.setFieldsValue({ sourceTable: undefined, sourceSql: undefined });
                    setRecommendTables([]);
                    if ((recommendForm.getFieldValue("serviceMode") || "table") === "table") {
                      void loadRecommendTables(value);
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="serviceMode" label="来源模式" rules={[{ required: true, message: "请选择来源模式" }]}>
                <Select
                  options={[{ value: "table", label: "目标表模式" }, { value: "sql", label: "SQL 模式" }]}
                  onChange={(value) => {
                    recommendForm.setFieldsValue({ sourceTable: undefined, sourceSql: undefined });
                    if (value === "table" && recommendForm.getFieldValue("sourceId")) {
                      void loadRecommendTables(recommendForm.getFieldValue("sourceId"));
                    }
                  }}
                />
              </Form.Item>
            </Col>
            {(watchedRecommendMode || "table") === "table" ? (
              <Col span={24}>
                <Form.Item name="sourceTable" label="目标表" rules={[{ required: true, message: "请选择目标表" }]}>
                  <Select options={recommendTables.map((item) => ({ label: item.tableName, value: item.tableName }))} />
                </Form.Item>
              </Col>
            ) : (
              <Col span={24}>
                <Form.Item name="sourceSql" label="SQL" rules={[{ required: true, message: "请输入 SQL" }]}>
                  <Input.TextArea rows={5} placeholder="请输入用于推荐的查询 SQL" />
                </Form.Item>
              </Col>
            )}
            <Col span={12}><Form.Item name="requestMethod" label="请求方式" rules={[{ required: true, message: "请选择请求方式" }]}><Select options={[{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="serviceType" label="服务类型" rules={[{ required: true, message: "请选择服务类型" }]}><Select options={[{ value: "list", label: "列表查询" }, { value: "detail", label: "详情查询" }]} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
