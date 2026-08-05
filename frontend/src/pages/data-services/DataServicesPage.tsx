import {
  ApiOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  LineChartOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { FormSection } from "../../components/ui/FormSection";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { StatusTag } from "../../components/ui/StatusTag";
import {
  createDataService,
  createDataServiceApp,
  createDataServiceAuthorization,
  createDataServiceDataSource,
  debugDataService,
  deleteDataServiceDataSource,
  deleteDataService,
  deleteDataServiceApp,
  deleteDataServiceAuthorization,
  downloadDataServiceInterfaceDoc,
  fetchDataServiceAiConfigs,
  fetchDataServiceApps,
  fetchDataServiceAuthorizations,
  fetchDataServiceDataSourceColumns,
  fetchDataServiceDataSourceSampleRows,
  fetchDataServiceDataSources,
  fetchDataServiceDataSourceTables,
  fetchDataServiceLogs,
  fetchDataServiceOverview,
  fetchDataServiceSqlPreview,
  fetchDataServices,
  recommendDataServiceConfig,
  testDataServiceDataSourceConnection,
  updateDataService,
  updateDataServiceStatus,
  updateDataServiceApp,
  updateDataServiceAuthorization,
  updateDataServiceDataSource,
} from "../../services/dataServices";
import type {
  DataServiceAppRecord,
  DataServiceAiConfigRecord,
  DataServiceAuthorizationRecord,
  DataServiceDataSourceRecord,
  DataServiceLogRecord,
  DataServiceOverview,
  DataServiceQueryFilterConfig,
  DataServiceRecommendResult,
  DataServiceRecord,
  DataSourceColumn,
  DataSourceTable,
} from "../../types/api";

type DataSourceFormValues = {
  sourceName: string;
  sourceCode: string;
  sourceType: "mysql" | "postgresql";
  host: string;
  port?: number;
  database: string;
  schema?: string;
  username: string;
  password?: string;
  ownerName: string;
  status: "active" | "inactive";
};

type ServiceFieldDraft = {
  columnName?: string;
  operator?: "eq" | "like" | "between";
  required?: boolean;
  requirementMode?: "optional" | "required" | "one_of_group";
  requiredGroup?: string | null;
};

type DataServiceView = "dataSources" | "services" | "apps" | "authorizations" | "audit";
type DataServiceStatus = "draft" | "published" | "disabled";

const DATA_SERVICE_STATUS_OPTIONS: Array<{ value: DataServiceStatus; label: string }> = [
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
  { value: "disabled", label: "已停用" },
];

function resolveDataServiceView(pathname: string): DataServiceView {
  if (pathname.includes("service-data-sources")) return "dataSources";
  if (pathname.includes("service-apps")) return "apps";
  if (pathname.includes("service-authorizations") || pathname.includes("service-publish")) return "authorizations";
  if (pathname.includes("service-audit")) return "audit";
  return "services";
}

const DATA_SERVICE_VIEW_COPY: Record<DataServiceView, { title: string; description: string }> = {
  dataSources: {
    title: "数据源管理",
    description: "独立维护数据服务专用数据源，供表转 API 选择使用。",
  },
  services: {
    title: "服务目录",
    description: "管理表转 API 与 SQL 转 API 服务，配置请求路径、参数、返回字段和认证方式。",
  },
  apps: {
    title: "应用管理",
    description: "创建调用方应用并维护访问 Token，用于服务授权和审计。",
  },
  authorizations: {
    title: "授权审批",
    description: "将服务管理开发的服务授权给应用管理创建的应用，调用时使用应用 Token 访问。",
  },
  audit: {
    title: "服务审计",
    description: "查看服务调用日志、最近错误和应用访问情况。",
  },
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function isIsoDateTimeString(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/i.test(value.trim());
}

function isDateOnlyString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function formatDateLikeString(value: string) {
  const trimmed = value.trim();
  if (isDateOnlyString(trimmed)) return trimmed;
  if (!isIsoDateTimeString(trimmed)) return value;
  return formatDateTime(trimmed);
}

function normalizeDateTimeValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDateTimeValue(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeDateTimeValue(item)])
    ) as T;
  }
  if (typeof value === "string") {
    return formatDateLikeString(value) as T;
  }
  return value;
}

function stringifyWithFormattedDates(value: unknown) {
  return JSON.stringify(normalizeDateTimeValue(value), null, 2);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

function formatPercent(value?: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function buildColumnLabel(column: DataSourceColumn) {
  return column.columnComment ? `${column.columnName} (${column.columnComment})` : column.columnName;
}

function buildDataSourcePayload(values: DataSourceFormValues) {
  return {
    sourceName: values.sourceName,
    sourceCode: values.sourceCode,
    sourceType: values.sourceType,
    ownerName: values.ownerName,
    status: values.status,
    connectionConfig: {
      host: values.host,
      port: Number(values.port || (values.sourceType === "postgresql" ? 5432 : 3306)),
      database: values.database,
      schema: values.schema || (values.sourceType === "postgresql" ? "public" : undefined),
      username: values.username,
      password: values.password || "",
    },
  };
}

export function DataServicesPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = resolveDataServiceView(location.pathname);
  const viewCopy = DATA_SERVICE_VIEW_COPY[currentView];
  const showDataSources = currentView === "dataSources";
  const showServices = currentView === "services";
  const showApps = currentView === "apps";
  const showAuthorizations = currentView === "authorizations";
  const showAudit = currentView === "audit";
  const [dataSourceForm] = Form.useForm<DataSourceFormValues>();
  const [serviceForm] = Form.useForm();
  const [appForm] = Form.useForm();
  const [authorizationForm] = Form.useForm();
  const [debugForm] = Form.useForm();
  const [serviceRecommendForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<DataServiceOverview | null>(null);
  const [dataSources, setDataSources] = useState<DataServiceDataSourceRecord[]>([]);
  const [services, setServices] = useState<DataServiceRecord[]>([]);
  const [apps, setApps] = useState<DataServiceAppRecord[]>([]);
  const [authorizations, setAuthorizations] = useState<DataServiceAuthorizationRecord[]>([]);
  const [logs, setLogs] = useState<DataServiceLogRecord[]>([]);
  const [auditServiceId, setAuditServiceId] = useState<number | undefined>();
  const [auditAppId, setAuditAppId] = useState<number | undefined>();
  const [auditDepartment, setAuditDepartment] = useState<string | undefined>();
  const [auditStartAt, setAuditStartAt] = useState<string | undefined>();
  const [auditEndAt, setAuditEndAt] = useState<string | undefined>();
  const [auditParamsKeyword, setAuditParamsKeyword] = useState<string | undefined>();

  const [dataSourceModalOpen, setDataSourceModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [authorizationModalOpen, setAuthorizationModalOpen] = useState(false);
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [authorizationDetailOpen, setAuthorizationDetailOpen] = useState(false);
  const [serviceDetailOpen, setServiceDetailOpen] = useState(false);
  const [serviceRecommendModalOpen, setServiceRecommendModalOpen] = useState(false);

  const [editingDataSource, setEditingDataSource] = useState<DataServiceDataSourceRecord | null>(null);
  const [editingService, setEditingService] = useState<DataServiceRecord | null>(null);
  const [editingApp, setEditingApp] = useState<DataServiceAppRecord | null>(null);
  const [editingAuthorization, setEditingAuthorization] = useState<DataServiceAuthorizationRecord | null>(null);
  const [debuggingService, setDebuggingService] = useState<DataServiceRecord | null>(null);
  const [authorizationTargetApp, setAuthorizationTargetApp] = useState<DataServiceAppRecord | null>(null);
  const [authorizationDetailApp, setAuthorizationDetailApp] = useState<DataServiceAppRecord | null>(null);
  const [authorizationDetailService, setAuthorizationDetailService] = useState<DataServiceRecord | null>(null);

  const [dataSourceSubmitting, setDataSourceSubmitting] = useState(false);
  const [dataSourceTesting, setDataSourceTesting] = useState(false);
  const [serviceSubmitting, setServiceSubmitting] = useState(false);
  const [appSubmitting, setAppSubmitting] = useState(false);
  const [authorizationSubmitting, setAuthorizationSubmitting] = useState(false);
  const [debugSubmitting, setDebugSubmitting] = useState(false);

  const [serviceTables, setServiceTables] = useState<DataSourceTable[]>([]);
  const [serviceRecommendTables, setServiceRecommendTables] = useState<DataSourceTable[]>([]);
  const [serviceColumns, setServiceColumns] = useState<DataSourceColumn[]>([]);
  const [serviceSampleRows, setServiceSampleRows] = useState<Array<Record<string, unknown>>>([]);
  const [serviceSqlPreviewColumns, setServiceSqlPreviewColumns] = useState<Array<{ columnName: string; label?: string; dataType?: string }>>([]);
  const [serviceSqlPreviewRows, setServiceSqlPreviewRows] = useState<Array<Record<string, unknown>>>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [sqlPreviewLoading, setSqlPreviewLoading] = useState(false);
  const [serviceRecommendLoading, setServiceRecommendLoading] = useState(false);
  const [serviceRecommendSummary, setServiceRecommendSummary] = useState<string[]>([]);
  const [debugResult, setDebugResult] = useState<{ data: unknown; meta: Record<string, unknown> } | null>(null);
  const [serviceAiConfigs, setServiceAiConfigs] = useState<DataServiceAiConfigRecord[]>([]);

  const auditDepartmentOptions = useMemo(
    () => Array.from(
      new Set(
        apps
          .map((item) => String(item.departmentName || "").trim())
          .filter(Boolean)
      )
    ).map((item) => ({ label: item, value: item })),
    [apps]
  );
  const auditRangeValue = useMemo<[Dayjs, Dayjs] | null>(() => {
    if (!auditStartAt || !auditEndAt) return null;
    const start = dayjs(auditStartAt);
    const end = dayjs(auditEndAt);
    if (!start.isValid() || !end.isValid()) return null;
    return [start, end];
  }, [auditEndAt, auditStartAt]);

  const watchedServiceMode = Form.useWatch("serviceMode", serviceForm) as "table" | "sql" | undefined;
  const watchedResponseFieldNames = Form.useWatch("responseFieldNames", serviceForm) as string[] | undefined;
  const watchedSourceId = Form.useWatch("sourceId", serviceForm) as number | undefined;
  const watchedRecommendMode = Form.useWatch("serviceMode", serviceRecommendForm) as "table" | "sql" | undefined;

  async function loadAll() {
    if (!token) return;
    setLoading(true);
    try {
      const [
        overviewResponse,
        dataSourcesResponse,
        servicesResponse,
        appsResponse,
        authorizationsResponse,
        logsResponse,
        aiConfigResponse,
      ] = await Promise.all([
        fetchDataServiceOverview(token),
        fetchDataServiceDataSources(token),
        fetchDataServices(token),
        fetchDataServiceApps(token),
        fetchDataServiceAuthorizations(token),
        fetchDataServiceLogs(token, {
          serviceId: auditServiceId,
          appId: auditAppId,
          departmentName: auditDepartment,
          startAt: auditStartAt,
          endAt: auditEndAt,
          paramsKeyword: auditParamsKeyword,
          limit: 50,
        }),
        fetchDataServiceAiConfigs(token),
      ]);

      setOverview(overviewResponse.data);
      setDataSources(dataSourcesResponse.data);
      setServices(servicesResponse.data);
      setApps(appsResponse.data);
      setAuthorizations(authorizationsResponse.data);
      setLogs(logsResponse.data);
      setServiceAiConfigs(aiConfigResponse.data || []);
    } catch (error) {
      message.error(`加载数据服务模块失败: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [token, auditAppId, auditDepartment, auditEndAt, auditParamsKeyword, auditServiceId, auditStartAt]);

  useEffect(() => {
    if (!serviceModalOpen) return;
    if ((watchedServiceMode || "table") === "table") {
      setServiceSqlPreviewColumns([]);
      setServiceSqlPreviewRows([]);
      if (watchedSourceId) {
        void loadServiceMetadata(watchedSourceId, serviceForm.getFieldValue("sourceTable"));
      }
      return;
    }

    setServiceTables([]);
    setServiceColumns([]);
    setServiceSampleRows([]);
    serviceForm.setFieldValue("sourceTable", undefined);
  }, [serviceModalOpen, watchedServiceMode, watchedSourceId]);

  async function loadServiceMetadata(sourceId: number, tableName?: string) {
    if (!token) return;
    setMetadataLoading(true);
    try {
      const tablesResponse = await fetchDataServiceDataSourceTables(token, sourceId);
      setServiceTables(tablesResponse.data);

      const targetTable = tableName || tablesResponse.data[0]?.tableName;
      if (targetTable) {
        const [columnsResponse, sampleResponse] = await Promise.all([
          fetchDataServiceDataSourceColumns(token, sourceId, targetTable),
          fetchDataServiceDataSourceSampleRows(token, sourceId, targetTable, 10),
        ]);
        setServiceColumns(columnsResponse.data);
        setServiceSampleRows(sampleResponse.data || []);
      } else {
        setServiceColumns([]);
        setServiceSampleRows([]);
      }
    } catch (error) {
      message.error(`加载数据表结构失败: ${getErrorMessage(error)}`);
      setServiceTables([]);
      setServiceColumns([]);
      setServiceSampleRows([]);
    } finally {
      setMetadataLoading(false);
    }
  }

  async function loadRecommendTables(sourceId: number, tableName?: string) {
    if (!token) return;
    try {
      const tablesResponse = await fetchDataServiceDataSourceTables(token, sourceId);
      setServiceRecommendTables(tablesResponse.data || []);
      if (tableName) {
        serviceRecommendForm.setFieldValue("sourceTable", tableName);
      }
    } catch (error) {
      message.error(`加载推荐表清单失败: ${getErrorMessage(error)}`);
      setServiceRecommendTables([]);
    }
  }

  function resetServiceSelections() {
    serviceForm.setFieldsValue({
      sourceTable: undefined,
      sourceSql: undefined,
      queryFields: [],
      responseFieldNames: [],
      defaultSortField: undefined,
    });
    setServiceTables([]);
    setServiceColumns([]);
    setServiceSampleRows([]);
    setServiceSqlPreviewColumns([]);
    setServiceSqlPreviewRows([]);
    setServiceRecommendSummary([]);
  }

  async function handleServiceSourceChange(sourceId: number) {
    resetServiceSelections();
    if ((serviceForm.getFieldValue("serviceMode") || "table") === "table") {
      await loadServiceMetadata(sourceId);
    }
  }

  async function handleServiceTableChange(tableName: string) {
    const sourceId = serviceForm.getFieldValue("sourceId") as number | undefined;
    if (!sourceId || !token) return;
    setMetadataLoading(true);
    try {
      const [columnsResponse, sampleResponse] = await Promise.all([
        fetchDataServiceDataSourceColumns(token, sourceId, tableName),
        fetchDataServiceDataSourceSampleRows(token, sourceId, tableName, 10),
      ]);
      setServiceColumns(columnsResponse.data);
      setServiceSampleRows(sampleResponse.data || []);
      serviceForm.setFieldsValue({
        queryFields: [],
        responseFieldNames: [],
        defaultSortField: undefined,
      });
    } catch (error) {
      message.error(`加载字段失败: ${getErrorMessage(error)}`);
      setServiceColumns([]);
      setServiceSampleRows([]);
    } finally {
      setMetadataLoading(false);
    }
  }

  async function handlePreviewServiceSql() {
    if (!token) return;
    const values = await serviceForm.validateFields(["sourceId", "sourceSql"]);
    setSqlPreviewLoading(true);
    try {
      const response = await fetchDataServiceSqlPreview(token, {
        sourceId: Number(values.sourceId),
        sql: String(values.sourceSql || ""),
      });
      setServiceSqlPreviewColumns(response.data.columns || []);
      setServiceSqlPreviewRows(response.data.sampleRows || []);
      serviceForm.setFieldsValue({
        queryFields: [],
        responseFieldNames: [],
        defaultSortField: undefined,
      });
      message.success(`SQL 预览成功，识别 ${response.data.columns.length} 个字段`);
    } catch (error) {
      message.error(`SQL 预览失败: ${getErrorMessage(error)}`);
      setServiceSqlPreviewColumns([]);
      setServiceSqlPreviewRows([]);
    } finally {
      setSqlPreviewLoading(false);
    }
  }

  function clearAuditFilters() {
    setAuditServiceId(undefined);
    setAuditAppId(undefined);
    setAuditDepartment(undefined);
    setAuditParamsKeyword(undefined);
    setAuditStartAt(undefined);
    setAuditEndAt(undefined);
  }

  function openCreateDataSourceModal() {
    setEditingDataSource(null);
    dataSourceForm.resetFields();
    dataSourceForm.setFieldsValue({
      sourceType: "mysql",
      port: 3306,
      ownerName: "system",
      status: "active",
    });
    setDataSourceModalOpen(true);
  }

  function openEditDataSourceModal(record: DataServiceDataSourceRecord) {
    const config = record.connectionConfig || {};
    setEditingDataSource(record);
    dataSourceForm.setFieldsValue({
      sourceName: record.sourceName,
      sourceCode: record.sourceCode,
      sourceType: record.sourceType === "postgresql" ? "postgresql" : "mysql",
      host: String(config.host || ""),
      port: Number(config.port || (record.sourceType === "postgresql" ? 5432 : 3306)),
      database: String(config.database || ""),
      schema: String(config.schema || ""),
      username: String(config.username || ""),
      password: String(config.password || ""),
      ownerName: record.ownerName,
      status: record.status === "inactive" ? "inactive" : "active",
    });
    setDataSourceModalOpen(true);
  }

  function openCreateServiceModal() {
    setEditingService(null);
    setServiceTables([]);
    setServiceColumns([]);
    setServiceSampleRows([]);
    setServiceSqlPreviewColumns([]);
    setServiceSqlPreviewRows([]);
    setServiceRecommendSummary([]);
    serviceForm.resetFields();
    serviceForm.setFieldsValue({
      requestMethod: "GET",
      serviceType: "list",
      serviceMode: "table",
      authType: "token",
      status: "draft",
      pagination: true,
      defaultPageSize: 20,
      maxPageSize: 100,
      defaultSortOrder: "desc",
      ownerName: "system",
      queryFields: [],
      responseFieldNames: [],
    });
    setServiceModalOpen(true);
  }

  async function openEditServiceModal(record: DataServiceRecord) {
    setEditingService(record);
    setServiceModalOpen(true);
    setServiceTables([]);
    setServiceColumns([]);
    setServiceSampleRows([]);
    setServiceSqlPreviewColumns([]);
    setServiceSqlPreviewRows([]);
    setServiceRecommendSummary([]);

    serviceForm.setFieldsValue({
      serviceName: record.serviceName,
      serviceCode: record.serviceCode,
      servicePath: record.servicePath,
      sourceId: record.sourceId || undefined,
      serviceMode: record.serviceMode || "table",
      sourceTable: record.sourceTable || undefined,
      sourceSql: record.sourceSql || undefined,
      requestMethod: record.requestMethod,
      serviceType: record.serviceType,
      authType: record.authType,
      status: record.status,
      description: record.description || undefined,
      ownerName: record.ownerName,
      pagination: record.queryConfig.pagination !== false,
      defaultPageSize: record.queryConfig.defaultPageSize || 20,
      maxPageSize: record.queryConfig.maxPageSize || 100,
      defaultSortField: record.queryConfig.defaultSortField || undefined,
      defaultSortOrder: record.queryConfig.defaultSortOrder || "desc",
      queryFields: record.queryConfig.filters.map((item) => ({
        columnName: item.columnName,
        operator: item.operator,
        required: item.required,
        requirementMode: item.requirementMode || (item.required ? "required" : "optional"),
        requiredGroup: item.requiredGroup || undefined,
      })),
      responseFieldNames: record.responseConfig.fields.map((item) => item.columnName),
    });

    if (record.sourceId && (record.serviceMode || "table") === "table" && record.sourceTable) {
      await loadServiceMetadata(record.sourceId, record.sourceTable);
    }
    if (record.sourceId && (record.serviceMode || "table") === "sql" && record.sourceSql) {
      try {
        const response = await fetchDataServiceSqlPreview(token!, {
          sourceId: record.sourceId,
          sql: record.sourceSql,
        });
        setServiceSqlPreviewColumns(response.data.columns || []);
        setServiceSqlPreviewRows(response.data.sampleRows || []);
      } catch {
        setServiceSqlPreviewColumns([]);
        setServiceSqlPreviewRows([]);
      }
    }
  }

  function openCreateAppModal() {
    setEditingApp(null);
    appForm.resetFields();
    appForm.setFieldsValue({
      departmentName: undefined,
      contactPhone: undefined,
      appDescription: undefined,
      ownerName: "system",
      status: "active",
    });
    setAppModalOpen(true);
  }

  function openServiceRecommendModal() {
    const currentMode = (serviceForm.getFieldValue("serviceMode") || "table") as "table" | "sql";
    const currentSourceId = serviceForm.getFieldValue("sourceId");
    const currentSourceTable = serviceForm.getFieldValue("sourceTable");
    const currentSourceSql = serviceForm.getFieldValue("sourceSql");
    serviceRecommendForm.resetFields();
    serviceRecommendForm.setFieldsValue({
      sourceId: currentSourceId,
      serviceMode: currentMode,
      sourceTable: currentSourceTable,
      sourceSql: currentSourceSql,
      requestMethod: serviceForm.getFieldValue("requestMethod") || "GET",
      serviceType: serviceForm.getFieldValue("serviceType") || "list",
    });
    setServiceRecommendSummary([]);
    setServiceRecommendModalOpen(true);
    if (currentSourceId && currentMode === "table") {
      void loadRecommendTables(currentSourceId, currentSourceTable);
    } else {
      setServiceRecommendTables([]);
    }
  }

  function openEditAppModal(record: DataServiceAppRecord) {
    setEditingApp(record);
    appForm.setFieldsValue({
      departmentName: record.departmentName || undefined,
      appName: record.appName,
      appCode: record.appCode,
      appToken: record.appToken,
      contactPhone: record.contactPhone || undefined,
      appDescription: record.appDescription || undefined,
      ownerName: record.ownerName,
      status: record.status,
    });
    setAppModalOpen(true);
  }

  function openCreateAuthorizationModal(targetApp?: DataServiceAppRecord | null) {
    setEditingAuthorization(null);
    setAuthorizationTargetApp(targetApp || null);
    authorizationForm.resetFields();
    authorizationForm.setFieldsValue({
      appId: targetApp?.id,
      status: "active",
      rateLimitPerMinute: 0,
      dailyLimit: 0,
    });
    setAuthorizationModalOpen(true);
  }

  function openEditAuthorizationModal(record: DataServiceAuthorizationRecord, targetApp?: DataServiceAppRecord | null) {
    setEditingAuthorization(record);
    setAuthorizationTargetApp(targetApp || apps.find((item) => item.id === record.appId) || null);
    authorizationForm.setFieldsValue({
      serviceId: record.serviceId,
      appId: record.appId,
      status: record.status,
      rateLimitPerMinute: record.rateLimitPerMinute,
      dailyLimit: record.dailyLimit,
      ipWhitelistText: record.ipWhitelist.join("\n"),
    });
    setAuthorizationModalOpen(true);
  }

  function openAuthorizationDetailModal(app: DataServiceAppRecord) {
    setAuthorizationDetailApp(app);
    setAuthorizationDetailOpen(true);
  }

  function openServiceDetailModal(serviceId: number) {
    const target = services.find((item) => item.id === serviceId) || null;
    setAuthorizationDetailService(target);
    setServiceDetailOpen(true);
  }

  function openDebugModal(record: DataServiceRecord) {
    setDebuggingService(record);
    debugForm.resetFields();
    setDebugResult(null);
    setDebugModalOpen(true);
  }

  async function handleSubmitDataSource() {
    if (!token) return;
    try {
      const values = await dataSourceForm.validateFields();
      const payload = buildDataSourcePayload(values);
      setDataSourceSubmitting(true);
      if (editingDataSource) {
        await updateDataServiceDataSource(token, editingDataSource.id, payload);
        message.success("数据源已更新");
      } else {
        await createDataServiceDataSource(token, payload);
        message.success("数据源已创建");
      }
      setDataSourceModalOpen(false);
      await loadAll();
    } catch (error: unknown) {
      if (typeof error === "object" && error && "errorFields" in error) return;
      message.error(`保存数据源失败: ${getErrorMessage(error)}`);
    } finally {
      setDataSourceSubmitting(false);
    }
  }

  async function handleTestDataSourceConnection() {
    if (!token) return;
    try {
      const values = await dataSourceForm.validateFields();
      setDataSourceTesting(true);
      const response = await testDataServiceDataSourceConnection(token, buildDataSourcePayload(values));
      if (response.data.success) {
        message.success(response.data.message || "连接测试成功");
      } else {
        message.error(response.data.error || response.data.message || "连接测试失败");
      }
    } catch (error: unknown) {
      if (typeof error === "object" && error && "errorFields" in error) return;
      message.error(`连接测试失败: ${getErrorMessage(error)}`);
    } finally {
      setDataSourceTesting(false);
    }
  }

  async function handleSubmitService() {
    if (!token) return;

    try {
      const values = await serviceForm.validateFields();
      const columnMap = new Map(availableServiceFields.map((item) => [item.columnName, item]));
      const responseFieldNames = (values.responseFieldNames || []) as string[];
      const queryFields = ((values.queryFields || []) as ServiceFieldDraft[])
        .filter((item) => item?.columnName);

      if (!responseFieldNames.length) {
        message.error("请至少选择一个返回字段");
        return;
      }

      const payload = {
        serviceName: values.serviceName,
        serviceCode: values.serviceCode,
        servicePath: values.servicePath,
        sourceId: values.sourceId,
        serviceMode: values.serviceMode,
        sourceTable: values.serviceMode === "table" ? values.sourceTable : undefined,
        sourceSql: values.serviceMode === "sql" ? values.sourceSql : undefined,
        requestMethod: values.requestMethod,
        serviceType: values.serviceType,
        authType: values.authType,
        status: values.status,
        description: values.description,
        ownerName: values.ownerName,
        queryConfig: {
          filters: queryFields.map((item) => {
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
          pagination: Boolean(values.pagination),
          defaultPageSize: values.defaultPageSize,
          maxPageSize: values.maxPageSize,
          defaultSortField: values.defaultSortField,
          defaultSortOrder: values.defaultSortOrder,
        },
        responseConfig: {
          fields: responseFieldNames.map((columnName) => {
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

      setServiceSubmitting(true);
      if (editingService) {
        await updateDataService(token, editingService.id, payload);
        message.success("服务已更新");
      } else {
        await createDataService(token, payload);
        message.success("服务已创建");
      }
      setServiceModalOpen(false);
      await loadAll();
    } catch (error: unknown) {
      if (typeof error === "object" && error && "errorFields" in error) return;
      message.error(`保存服务失败: ${getErrorMessage(error)}`);
    } finally {
      setServiceSubmitting(false);
    }
  }

  async function handleSubmitApp() {
    if (!token) return;
    try {
      const values = await appForm.validateFields();
      setAppSubmitting(true);
      if (editingApp) {
        await updateDataServiceApp(token, editingApp.id, values);
        message.success("应用已更新");
      } else {
        await createDataServiceApp(token, values);
        message.success("应用已创建");
      }
      setAppModalOpen(false);
      await loadAll();
    } catch (error: unknown) {
      if (typeof error === "object" && error && "errorFields" in error) return;
      message.error(`保存应用失败: ${getErrorMessage(error)}`);
    } finally {
      setAppSubmitting(false);
    }
  }

  async function handleSubmitAuthorization() {
    if (!token) return;
    try {
      const values = await authorizationForm.validateFields();
      const payload = {
        serviceId: values.serviceId,
        appId: values.appId,
        status: values.status,
        rateLimitPerMinute: values.rateLimitPerMinute || 0,
        dailyLimit: values.dailyLimit || 0,
        ipWhitelist: String(values.ipWhitelistText || "")
          .split(/\n|,|;/)
          .map((item) => item.trim())
          .filter(Boolean),
      };

      setAuthorizationSubmitting(true);
      if (editingAuthorization) {
        await updateDataServiceAuthorization(token, editingAuthorization.id, payload);
        message.success("授权已更新");
      } else {
        await createDataServiceAuthorization(token, payload);
        message.success("授权已创建");
      }
      setAuthorizationModalOpen(false);
      setAuthorizationTargetApp(null);
      await loadAll();
    } catch (error: unknown) {
      if (typeof error === "object" && error && "errorFields" in error) return;
      message.error(`保存授权失败: ${getErrorMessage(error)}`);
    } finally {
      setAuthorizationSubmitting(false);
    }
  }

  function confirmDeleteService(record: DataServiceRecord) {
    Modal.confirm({
      title: `确认删除服务“${record.serviceName}”？`,
      content: "删除后该服务授权和调用日志会一并清理，已发布接口将不可再调用。",
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!token) return;
        try {
          await deleteDataService(token, record.id);
          message.success("服务已删除");
          await loadAll();
        } catch (error: unknown) {
          message.error(`删除服务失败: ${getErrorMessage(error)}`);
        }
      },
    });
  }

  function confirmDeleteApp(record: DataServiceAppRecord) {
    Modal.confirm({
      title: `确认删除应用“${record.appName}”？`,
      content: "删除后该应用的服务授权会一并清理，历史调用日志会保留但不再关联应用。",
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!token) return;
        try {
          await deleteDataServiceApp(token, record.id);
          message.success("应用已删除");
          await loadAll();
        } catch (error: unknown) {
          message.error(`删除应用失败: ${getErrorMessage(error)}`);
        }
      },
    });
  }

  function confirmDeleteAuthorization(record: DataServiceAuthorizationRecord) {
    Modal.confirm({
      title: `确认删除“${record.appName} -> ${record.serviceName}”授权？`,
      content: "删除后该应用将不能继续调用该服务。",
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!token) return;
        try {
          await deleteDataServiceAuthorization(token, record.id);
          message.success("授权已删除");
          await loadAll();
        } catch (error: unknown) {
          message.error(`删除授权失败: ${getErrorMessage(error)}`);
        }
      },
    });
  }

  function confirmDeleteDataSource(record: DataServiceDataSourceRecord) {
    Modal.confirm({
      title: `确认删除数据源“${record.sourceName}”？`,
      content: record.serviceCount && record.serviceCount > 0
        ? "该数据源仍有关联服务，删除前请先解除服务引用。"
        : "删除后不可恢复。",
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!token) return;
        try {
          await deleteDataServiceDataSource(token, record.id);
          message.success("数据源已删除");
          await loadAll();
        } catch (error: unknown) {
          message.error(`删除数据源失败: ${getErrorMessage(error)}`);
        }
      },
    });
  }

  async function handleDebugService() {
    if (!token || !debuggingService) return;
    try {
      const values = await debugForm.validateFields();
      setDebugSubmitting(true);
      const response = await debugDataService(token, debuggingService.id, values);
      setDebugResult(response.data);
      message.success("调试成功");
    } catch (error: unknown) {
      if (typeof error === "object" && error && "errorFields" in error) return;
      message.error(`调试失败: ${getErrorMessage(error)}`);
    } finally {
      setDebugSubmitting(false);
    }
  }

  const availableServiceFields = useMemo(
    () => ((watchedServiceMode || "table") === "sql"
      ? serviceSqlPreviewColumns.map((column) => ({
        columnName: column.columnName,
        label: column.label || column.columnName,
        dataType: column.dataType || "string",
      }))
      : serviceColumns.map((column) => ({
        columnName: column.columnName,
        label: buildColumnLabel(column),
        dataType: column.dataType || "string",
      }))),
    [serviceColumns, serviceSqlPreviewColumns, watchedServiceMode]
  );

  const serviceColumnOptions = useMemo(
    () => availableServiceFields.map((column) => ({ label: column.label || column.columnName, value: column.columnName })),
    [availableServiceFields]
  );

  const servicePreviewTableColumns = useMemo(
    () => availableServiceFields.map((column) => ({
      title: column.label || column.columnName,
      dataIndex: column.columnName,
      key: column.columnName,
      width: 180,
      ellipsis: true,
      render: (value: unknown) => value === null || value === undefined || value === "" ? "-" : (
        typeof value === "string" ? formatDateLikeString(value) : String(value)
      ),
    })),
    [availableServiceFields]
  );

  const servicePreviewRows = useMemo(
    () => ((watchedServiceMode || "table") === "sql" ? serviceSqlPreviewRows : serviceSampleRows),
    [serviceSampleRows, serviceSqlPreviewRows, watchedServiceMode]
  );

  const selectedResponseFieldSet = useMemo(
    () => new Set(watchedResponseFieldNames || []),
    [watchedResponseFieldNames]
  );

  const allResponseFieldsSelected = availableServiceFields.length > 0
    && availableServiceFields.every((item) => selectedResponseFieldSet.has(item.columnName));

  function updateResponseFieldSelection(columnName: string, checked: boolean) {
    const current = new Set(serviceForm.getFieldValue("responseFieldNames") || []);
    if (checked) {
      current.add(columnName);
    } else {
      current.delete(columnName);
    }
    serviceForm.setFieldValue("responseFieldNames", Array.from(current));
  }

  function toggleSelectAllResponseFields() {
    if (allResponseFieldsSelected) {
      serviceForm.setFieldValue("responseFieldNames", []);
      return;
    }
    serviceForm.setFieldValue("responseFieldNames", availableServiceFields.map((item) => item.columnName));
  }

  async function handleRecommendServiceConfig() {
    if (!token) return;
    try {
      const fieldsToValidate = ["sourceId", "serviceMode", "requestMethod", "serviceType"] as string[];
      if ((serviceRecommendForm.getFieldValue("serviceMode") || "table") === "table") {
        fieldsToValidate.push("sourceTable");
      } else {
        fieldsToValidate.push("sourceSql");
      }
      const values = await serviceRecommendForm.validateFields(fieldsToValidate);
      setServiceRecommendLoading(true);
      const response = await recommendDataServiceConfig(token, {
        sourceId: values.sourceId,
        serviceMode: values.serviceMode,
        sourceTable: values.sourceTable,
        sourceSql: values.sourceSql,
        serviceName: serviceForm.getFieldValue("serviceName"),
        serviceCode: serviceForm.getFieldValue("serviceCode"),
        servicePath: serviceForm.getFieldValue("servicePath"),
        requestMethod: serviceForm.getFieldValue("requestMethod"),
        serviceType: serviceForm.getFieldValue("serviceType"),
        ownerName: serviceForm.getFieldValue("ownerName"),
        description: serviceForm.getFieldValue("description"),
      });
      const recommendation = response.data.recommendation || {} as DataServiceRecommendResult;
      serviceForm.setFieldsValue({
        sourceId: values.sourceId,
        serviceMode: values.serviceMode,
        sourceTable: values.serviceMode === "table" ? values.sourceTable : undefined,
        sourceSql: values.serviceMode === "sql" ? values.sourceSql : undefined,
        serviceName: recommendation.serviceName || serviceForm.getFieldValue("serviceName"),
        serviceCode: recommendation.serviceCode || serviceForm.getFieldValue("serviceCode"),
        servicePath: recommendation.servicePath || serviceForm.getFieldValue("servicePath"),
        requestMethod: recommendation.requestMethod || values.requestMethod || "GET",
        serviceType: recommendation.serviceType || values.serviceType || "list",
        description: recommendation.description || serviceForm.getFieldValue("description"),
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
      if (values.serviceMode === "table") {
        await loadServiceMetadata(values.sourceId, values.sourceTable);
      } else {
        const previewResponse = await fetchDataServiceSqlPreview(token, {
          sourceId: values.sourceId,
          sql: String(values.sourceSql || ""),
        });
        setServiceSqlPreviewColumns(previewResponse.data.columns || []);
        setServiceSqlPreviewRows(previewResponse.data.sampleRows || []);
      }
      setServiceRecommendSummary(recommendation.reasoning || []);
      setServiceRecommendModalOpen(false);
      message.success("AI 推荐已回填到服务表单");
    } catch (error: unknown) {
      if (typeof error === "object" && error && "errorFields" in error) return;
      message.error(`AI 推荐失败: ${getErrorMessage(error)}`);
    } finally {
      setServiceRecommendLoading(false);
    }
  }

  const activeDataSourceOptions = useMemo(
    () =>
      dataSources
        .filter((item) => item.status === "active")
        .map((item) => ({ label: `${item.sourceName} (${item.sourceType})`, value: item.id })),
    [dataSources]
  );

  function buildExampleValue(dataType?: string, fieldName?: string) {
    const normalized = String(dataType || "string").trim().toLowerCase();
    const lowerField = String(fieldName || "").trim().toLowerCase();
    if (normalized.includes("int")) return 1;
    if (normalized.includes("decimal") || normalized.includes("numeric") || normalized.includes("double") || normalized.includes("float") || normalized === "number") return 99.98;
    if (normalized.includes("bool")) return true;
    if (normalized.includes("date") || normalized.includes("time")) return "2026-05-01 10:00:00";
    if (lowerField.includes("phone") || lowerField.includes("mobile")) return "13812345678";
    if (lowerField.includes("id_card")) return "110101199001011234";
    if (lowerField.includes("email")) return "demo@example.com";
    return "示例值";
  }

  function buildAuthGuide(service: DataServiceRecord) {
    if (service.authType === "anonymous") {
      return {
        authType: "免认证",
        description: "当前接口为免认证模式，请求时不需要携带应用访问 Token。",
        headers: "无",
        notes: [
          "可直接使用请求地址和业务参数调用。",
          "如果后续切换为 Token 认证，需要补充应用访问 Token。",
        ],
      };
    }

    return {
      authType: "Token 认证",
      description: "当前接口要求携带应用访问 Token。推荐优先使用 X-App-Token，也兼容 Authorization: Bearer <token>。",
      headers: JSON.stringify({
        "X-App-Token": "svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        Authorization: "Bearer svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      }, null, 2),
      notes: [
        "不要把 token 放在 query 参数里，例如 ?token=... 或 ?Bearer=... 均不会被识别。",
        "Token 请使用“应用管理”里分配给调用方应用的访问 Token。",
        "如果返回 401/403，请检查 Token、授权状态和服务是否已发布。",
      ],
    };
  }

  function buildRequestExample(service: DataServiceRecord) {
    const authGuide = buildAuthGuide(service);
    const params = Object.fromEntries(
      (service.queryConfig.filters || []).flatMap((filter) => {
        if (filter.operator === "between") {
          return [
            [filter.startParamName || `${filter.columnName}Start`, buildExampleValue(filter.dataType, filter.columnName)],
            [filter.endParamName || `${filter.columnName}End`, buildExampleValue(filter.dataType, filter.columnName)],
          ];
        }
        return [[filter.paramName || filter.columnName, buildExampleValue(filter.dataType, filter.columnName)]];
      })
    );
    const url = `${window.location.origin}/api/service${service.servicePath}`;
    if (service.requestMethod === "GET") {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => search.set(key, String(value)));
      const requestLine = `${url}${search.toString() ? `?${search.toString()}` : ""}`;
      return [
        `请求方式: GET`,
        `请求地址: ${requestLine}`,
        `认证方式: ${authGuide.authType}`,
        `请求头:`,
        authGuide.headers,
      ].join("\n");
    }
    return [
      `请求方式: POST`,
      `请求地址: ${url}`,
      `认证方式: ${authGuide.authType}`,
      `请求头:`,
      service.authType === "token"
        ? JSON.stringify({
          "Content-Type": "application/json",
          "X-App-Token": "svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        }, null, 2)
        : JSON.stringify({ "Content-Type": "application/json" }, null, 2),
      `请求体:`,
      JSON.stringify(params, null, 2),
    ].join("\n");
  }

  function buildResponseExample(service: DataServiceRecord) {
    const row = normalizeDateTimeValue(Object.fromEntries(
      (service.responseConfig.fields || []).map((field) => [field.fieldName, buildExampleValue(field.dataType, field.fieldName)])
    ));
    if (service.serviceType === "detail") {
      return stringifyWithFormattedDates({
        code: 0,
        message: "success",
        data: row,
        meta: { returned: Object.keys(row).length ? 1 : 0 },
      });
    }
    return stringifyWithFormattedDates({
      code: 0,
      message: "success",
      data: [row],
      meta: {
        page: 1,
        pageSize: service.queryConfig.defaultPageSize || 20,
        total: Object.keys(row).length ? 1 : 0,
        returned: Object.keys(row).length ? 1 : 0,
      },
    });
  }

  const dataSourceColumns: ColumnsType<DataServiceDataSourceRecord> = [
    { title: "数据源名称", dataIndex: "sourceName", key: "sourceName", width: 160 },
    { title: "数据源编码", dataIndex: "sourceCode", key: "sourceCode", width: 150 },
    { title: "类型", dataIndex: "sourceType", key: "sourceType", width: 110, render: (value: string) => <Tag color="blue">{value}</Tag> },
    {
      title: "连接地址",
      key: "connection",
      width: 220,
      render: (_, record) => {
        const config = record.connectionConfig || {};
        return `${config.host || "-"}:${config.port || "-"} / ${config.database || "-"}`;
      },
    },
    { title: "关联服务", dataIndex: "serviceCount", key: "serviceCount", width: 100 },
    { title: "负责人", dataIndex: "ownerName", key: "ownerName", width: 110 },
    { title: "状态", dataIndex: "status", key: "status", width: 100, render: (value: string) => <StatusTag status={value} /> },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 180,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openEditDataSourceModal(record)}>编辑</Button>
          <Button danger type="link" icon={<DeleteOutlined />} onClick={() => confirmDeleteDataSource(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  const serviceTableColumns: ColumnsType<DataServiceRecord> = [
    { title: "服务名称", dataIndex: "serviceName", key: "serviceName", width: 170 },
    { title: "服务编码", dataIndex: "serviceCode", key: "serviceCode", width: 150 },
    {
      title: "接口路径",
      dataIndex: "servicePath",
      key: "servicePath",
      width: 220,
      render: (value: string) => <Typography.Text copyable>{value}</Typography.Text>,
    },
    { title: "模式", dataIndex: "serviceMode", key: "serviceMode", width: 90, render: (value?: string) => <Tag color={value === "sql" ? "purple" : "blue"}>{value === "sql" ? "SQL" : "表"}</Tag> },
    {
      title: "数据源 / 来源",
      key: "source",
      width: 260,
      render: (_, record) => record.serviceMode === "sql"
        ? `${record.sourceName || "-"} / SQL 模式`
        : `${record.sourceName || "-"} / ${record.sourceTable || "-"}`,
    },
    { title: "请求", dataIndex: "requestMethod", key: "requestMethod", width: 90, render: (value: string) => <Tag color="geekblue">{value}</Tag> },
    { title: "认证", dataIndex: "authType", key: "authType", width: 100, render: (value: string) => <StatusTag status={value === "token" ? "processing" : "active"} label={value === "token" ? "Token 认证" : "免认证"} /> },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: string, record) => (
        <Select
          size="small"
          value={value as DataServiceStatus}
          style={{ width: 96 }}
          options={DATA_SERVICE_STATUS_OPTIONS}
          onChange={async (nextStatus: "draft" | "published" | "disabled") => {
            if (!token) return;
            try {
              await updateDataServiceStatus(token, record.id, nextStatus);
              message.success("服务状态已更新");
              await loadAll();
            } catch (error: unknown) {
              message.error(`更新服务状态失败: ${getErrorMessage(error)}`);
            }
          }}
        />
      ),
    },
    { title: "调用量", dataIndex: "totalCalls", key: "totalCalls", width: 90 },
    { title: "均耗时(ms)", dataIndex: "avgLatencyMs", key: "avgLatencyMs", width: 110, render: (value: number) => Number(value || 0).toFixed(2) },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 210,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/dashboard/services/${record.id}/edit`)}>编辑</Button>
          <Button type="link" onClick={() => openDebugModal(record)}>调试</Button>
          <Button danger type="link" icon={<DeleteOutlined />} onClick={() => confirmDeleteService(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  const appTableColumns: ColumnsType<DataServiceAppRecord> = [
    { title: "所属部门", dataIndex: "departmentName", key: "departmentName", width: 180, render: (value?: string | null) => value || "-" },
    { title: "应用名称", dataIndex: "appName", key: "appName", width: 160 },
    { title: "应用编码", dataIndex: "appCode", key: "appCode", width: 150 },
    { title: "联系电话", dataIndex: "contactPhone", key: "contactPhone", width: 150, render: (value?: string | null) => value || "-" },
    {
      title: "访问 Token",
      dataIndex: "appToken",
      key: "appToken",
      width: 240,
      render: (value: string) => <Typography.Text copyable>{value}</Typography.Text>,
    },
    { title: "授权服务数", dataIndex: "authorizationCount", key: "authorizationCount", width: 110 },
    { title: "负责人", dataIndex: "ownerName", key: "ownerName", width: 110 },
    { title: "状态", dataIndex: "status", key: "status", width: 100, render: (value: string) => <StatusTag status={value} /> },
    {
      title: "操作",
      key: "actions",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openEditAppModal(record)}>编辑</Button>
          <Button danger type="link" icon={<DeleteOutlined />} onClick={() => confirmDeleteApp(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  const authorizationAppColumns: ColumnsType<DataServiceAppRecord> = [
    { title: "所属部门", dataIndex: "departmentName", key: "departmentName", width: 140, render: (value?: string | null) => value || "-" },
    { title: "应用名称", dataIndex: "appName", key: "appName", width: 170 },
    { title: "应用编码", dataIndex: "appCode", key: "appCode", width: 130 },
    { title: "联系电话", dataIndex: "contactPhone", key: "contactPhone", width: 130, render: (value?: string | null) => value || "-" },
    { title: "授权服务数", dataIndex: "authorizationCount", key: "authorizationCount", width: 110 },
    { title: "负责人", dataIndex: "ownerName", key: "ownerName", width: 100 },
    { title: "状态", dataIndex: "status", key: "status", width: 100, render: (value: string) => <StatusTag status={value} /> },
    {
      title: "操作",
      key: "actions",
      width: 190,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openAuthorizationDetailModal(record)}>授权详情</Button>
          <Button type="link" icon={<SafetyCertificateOutlined />} onClick={() => openCreateAuthorizationModal(record)}>新加服务</Button>
        </Space>
      ),
    },
  ];

  const authorizationColumns: ColumnsType<DataServiceAuthorizationRecord> = [
    { title: "服务", dataIndex: "serviceName", key: "serviceName", width: 180 },
    { title: "应用", dataIndex: "appName", key: "appName", width: 160 },
    { title: "分钟调用上限", dataIndex: "rateLimitPerMinute", key: "rateLimitPerMinute", width: 120 },
    { title: "日上限", dataIndex: "dailyLimit", key: "dailyLimit", width: 100 },
    {
      title: "IP 白名单",
      dataIndex: "ipWhitelist",
      key: "ipWhitelist",
      width: 220,
      render: (value: string[]) => (value.length ? value.join(", ") : "不限"),
    },
    { title: "状态", dataIndex: "status", key: "status", width: 100, render: (value: string) => <StatusTag status={value} /> },
    {
      title: "操作",
      key: "actions",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openEditAuthorizationModal(record)}>编辑</Button>
          <Button danger type="link" icon={<DeleteOutlined />} onClick={() => confirmDeleteAuthorization(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  const authorizationDetailColumns: ColumnsType<DataServiceAuthorizationRecord> = [
    {
      title: "服务名称",
      dataIndex: "serviceName",
      key: "serviceName",
      width: 160,
      ellipsis: true,
      render: (value: string, record) => (
        <Button type="link" style={{ paddingInline: 0 }} onClick={() => openServiceDetailModal(record.serviceId)}>
          {value}
        </Button>
      ),
    },
    { title: "服务编码", dataIndex: "serviceCode", key: "serviceCode", width: 140, ellipsis: true },
    { title: "认证类型", key: "authType", width: 100, render: (_, record) => {
      const targetService = services.find((item) => item.id === record.serviceId);
      return targetService?.authType === "token" ? "Token 认证" : "免认证";
    } },
    { title: "分钟上限", dataIndex: "rateLimitPerMinute", key: "rateLimitPerMinute", width: 100 },
    { title: "日上限", dataIndex: "dailyLimit", key: "dailyLimit", width: 90 },
    {
      title: "IP 白名单",
      dataIndex: "ipWhitelist",
      key: "ipWhitelist",
      width: 170,
      ellipsis: true,
      render: (value: string[]) => {
        const text = value.length ? value.join(", ") : "不限";
        return <Typography.Text ellipsis={{ tooltip: text }}>{text}</Typography.Text>;
      },
    },
    { title: "状态", dataIndex: "status", key: "status", width: 90, render: (value: string) => <StatusTag status={value} /> },
    {
      title: "操作",
      key: "actions",
      width: 220,
      fixed: "right",
      render: (_, record) => (
        <Space size={[4, 4]} wrap>
          <Button type="link" onClick={() => openServiceDetailModal(record.serviceId)}>接口详情</Button>
          <Button type="link" onClick={() => openEditAuthorizationModal(record, authorizationDetailApp)}>编辑</Button>
          <Button danger type="link" icon={<DeleteOutlined />} onClick={() => confirmDeleteAuthorization(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  const logColumns: ColumnsType<DataServiceLogRecord> = [
    { title: "调用时间", dataIndex: "calledAt", key: "calledAt", width: 170, render: (value: string) => formatDateTime(value) },
    { title: "服务", dataIndex: "serviceName", key: "serviceName", width: 160 },
    {
      title: "调用部门",
      key: "departmentName",
      width: 160,
      render: (_, record) => apps.find((item) => item.id === record.appId)?.departmentName || "-",
    },
    { title: "调用应用", dataIndex: "appName", key: "appName", width: 140, render: (value?: string | null) => value || "匿名" },
    { title: "方法", dataIndex: "requestMethod", key: "requestMethod", width: 80, render: (value: string) => <Tag>{value}</Tag> },
    { title: "HTTP", dataIndex: "httpStatus", key: "httpStatus", width: 80 },
    { title: "耗时(ms)", dataIndex: "latencyMs", key: "latencyMs", width: 100 },
    { title: "结果", dataIndex: "success", key: "success", width: 90, render: (value: boolean) => <StatusTag status={value ? "active" : "failed"} label={value ? "成功" : "失败"} /> },
    {
      title: "入参条件",
      dataIndex: "requestParams",
      key: "requestParams",
      width: 240,
      render: (value: Record<string, unknown>) => {
        const text = JSON.stringify(value || {});
        return <Typography.Text ellipsis={{ tooltip: text }}>{text}</Typography.Text>;
      },
    },
    { title: "错误", dataIndex: "errorMessage", key: "errorMessage", ellipsis: true },
  ];

  const rankingColumns: ColumnsType<{ name: string; callCount: number }> = [
    { title: "名称", dataIndex: "name", key: "name" },
    { title: "今日调用", dataIndex: "callCount", key: "callCount", width: 120 },
  ];

  return (
    <div className="app-page">
      <div className="app-page-body">
        <PageToolbar
          right={(
            <>
              <Button icon={<ReloadOutlined />} onClick={() => void loadAll()} loading={loading}>刷新</Button>
              {showDataSources ? <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDataSourceModal}>新建数据源</Button> : null}
              {showApps || showAuthorizations ? <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAppModal}>新建应用</Button> : null}
              {showServices ? <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/dashboard/services/create")}>新建服务</Button> : null}
            </>
          )}
        />

        {showDataSources ? (
        <DataTableCard<DataServiceDataSourceRecord>
          title="数据源管理"
          extra={<Typography.Text type="secondary">专用于数据服务，共 {dataSources.length} 个</Typography.Text>}
          tableProps={{
            rowKey: "id",
            loading,
            columns: dataSourceColumns,
            dataSource: dataSources,
            pagination: { pageSize: 5, showSizeChanger: false },
            scroll: { x: 1160 },
          }}
        />
        ) : null}

        {showServices ? (
        <DataTableCard<DataServiceRecord>
          title="服务开发与管理"
          extra={<Typography.Text type="secondary">共 {services.length} 个服务</Typography.Text>}
          tableProps={{
            rowKey: "id",
            loading,
            columns: serviceTableColumns,
            dataSource: services,
            pagination: { pageSize: 6, showSizeChanger: false },
            scroll: { x: 1400 },
          }}
        />
        ) : null}

        {showApps ? (
        <DataTableCard<DataServiceAppRecord>
          title="应用管理"
          extra={<Typography.Text type="secondary">共 {apps.length} 个应用</Typography.Text>}
          tableProps={{
            rowKey: "id",
            loading,
            columns: appTableColumns,
            dataSource: apps,
            pagination: { pageSize: 6, showSizeChanger: false },
            scroll: { x: 1260 },
          }}
        />
        ) : null}

        {showAuthorizations ? (
        <DataTableCard<DataServiceAppRecord>
          title="应用授权清单"
          extra={<Typography.Text type="secondary">默认按应用查看授权，共 {apps.length} 个应用</Typography.Text>}
          tableProps={{
            rowKey: "id",
            loading,
            columns: authorizationAppColumns,
            dataSource: apps,
            pagination: { pageSize: 8, showSizeChanger: false },
            scroll: { x: 1340 },
          }}
        />
        ) : null}

        {showAudit ? (
        <DataTableCard<DataServiceLogRecord>
          className="data-service-audit-card"
          title="服务日志"
          extra={(
            <div className="data-service-audit-toolbar">
              <Select
                allowClear
                className="data-service-audit-toolbar__field"
                placeholder="服务"
                value={auditServiceId}
                options={services.map((item) => ({ label: item.serviceName, value: item.id }))}
                onChange={(value) => setAuditServiceId(value)}
              />
              <Select
                allowClear
                className="data-service-audit-toolbar__field"
                placeholder="应用"
                value={auditAppId}
                options={apps.map((item) => ({ label: item.appName, value: item.id }))}
                onChange={(value) => setAuditAppId(value)}
              />
              <Select
                allowClear
                className="data-service-audit-toolbar__field"
                placeholder="调用部门"
                value={auditDepartment}
                options={auditDepartmentOptions}
                onChange={(value) => setAuditDepartment(value)}
              />
              <Input
                allowClear
                className="data-service-audit-toolbar__field data-service-audit-toolbar__field--keyword"
                placeholder="入参关键字"
                value={auditParamsKeyword}
                onChange={(event) => setAuditParamsKeyword(event.target.value || undefined)}
              />
              <DatePicker.RangePicker
                allowClear
                showTime
                className="data-service-audit-toolbar__field data-service-audit-toolbar__field--range"
                format="YYYY-MM-DD HH:mm:ss"
                placeholder={["开始时间", "结束时间"]}
                value={auditRangeValue}
                onChange={(_value, dateStrings) => {
                  const [startAt, endAt] = dateStrings;
                  setAuditStartAt(startAt || undefined);
                  setAuditEndAt(endAt || undefined);
                }}
              />
              <div className="data-service-audit-toolbar__actions">
                <Button className="data-service-audit-toolbar__clear" onClick={clearAuditFilters}>清空筛选</Button>
              </div>
            </div>
          )}
          tableProps={{
            rowKey: "id",
            loading,
            columns: logColumns,
            dataSource: logs,
            pagination: { pageSize: 8, showSizeChanger: false },
            scroll: { x: 1320 },
          }}
        />
        ) : null}
      </div>

      <Modal
        open={dataSourceModalOpen}
        title={editingDataSource ? "编辑数据源" : "新建数据源"}
        width={760}
        destroyOnHidden
        confirmLoading={dataSourceSubmitting}
        onCancel={() => setDataSourceModalOpen(false)}
        onOk={() => void handleSubmitDataSource()}
        footer={(_, { OkBtn, CancelBtn }) => (
          <>
            <Button onClick={() => void handleTestDataSourceConnection()} loading={dataSourceTesting}>测试连接</Button>
            <CancelBtn />
            <OkBtn />
          </>
        )}
      >
        <Form layout="vertical" form={dataSourceForm}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sourceName" label="数据源名称" rules={[{ required: true, message: "请输入数据源名称" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sourceCode" label="数据源编码" rules={[{ required: true, message: "请输入数据源编码" }]}>
                <Input disabled={Boolean(editingDataSource)} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sourceType" label="数据库类型" rules={[{ required: true, message: "请选择数据库类型" }]}>
                <Select
                  options={[{ value: "mysql", label: "MySQL" }, { value: "postgresql", label: "PostgreSQL" }]}
                  onChange={(value) => dataSourceForm.setFieldValue("port", value === "postgresql" ? 5432 : 3306)}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="host" label="主机地址" rules={[{ required: true, message: "请输入主机地址" }]}>
                <Input placeholder="127.0.0.1" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="port" label="端口" rules={[{ required: true, message: "请输入端口" }]}>
                <InputNumber min={1} max={65535} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="database" label="数据库" rules={[{ required: true, message: "请输入数据库名" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="schema" label="Schema">
                <Input placeholder="PostgreSQL 默认 public" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="password" label="密码">
                <Input.Password />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ownerName" label="负责人" rules={[{ required: true, message: "请输入负责人" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
                <Select options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        open={serviceModalOpen}
        title={editingService ? "编辑服务" : "新建服务"}
        width={1200}
        destroyOnHidden
        confirmLoading={serviceSubmitting}
        onCancel={() => setServiceModalOpen(false)}
        onOk={() => void handleSubmitService()}
      >
        <Form layout="vertical" form={serviceForm}>
          <Space style={{ marginBottom: 16 }} wrap>
            <Button onClick={openServiceRecommendModal} loading={serviceRecommendLoading}>
              AI 推荐
            </Button>
            <Typography.Text type="secondary">
              {serviceAiConfigs.find((item) => item.sceneCode === "service_config_recommendation")?.defaultModelProviderName
                ? "已配置服务开发推荐模型，可根据当前数据源与字段自动生成接口方案。"
                : "当前未配置服务开发推荐模型，建议先到数据服务-模型管理维护提示词和默认模型。"}
            </Typography.Text>
          </Space>

          {serviceRecommendSummary.length ? (
            <Card size="small" style={{ marginBottom: 16 }} title="AI 推荐依据">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {serviceRecommendSummary.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </Card>
          ) : null}

          <FormSection title="基础信息" description="定义表转 API 的基本元信息与调用方式。">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="serviceName" label="服务名称" rules={[{ required: true, message: "请输入服务名称" }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="serviceCode" label="服务编码">
                  <Input placeholder="可留空，保存时自动生成" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="servicePath" label="接口路径" rules={[{ required: true, message: "请输入接口路径" }]}>
                  <Input placeholder="/demo/orders" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="ownerName" label="负责人" rules={[{ required: true, message: "请输入负责人" }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="requestMethod" label="请求方式" rules={[{ required: true, message: "请选择请求方式" }]}>
                  <Select options={[{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }]} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="serviceType" label="服务类型" rules={[{ required: true, message: "请选择服务类型" }]}>
                  <Select options={[{ value: "list", label: "列表查询" }, { value: "detail", label: "详情查询" }]} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="authType" label="认证方式" rules={[{ required: true, message: "请选择认证方式" }]}>
                  <Select options={[{ value: "token", label: "Token 认证" }, { value: "anonymous", label: "免认证" }]} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="status" label="服务状态" rules={[{ required: true, message: "请选择服务状态" }]}>
                  <Select options={[{ value: "draft", label: "草稿" }, { value: "published", label: "已发布" }, { value: "disabled", label: "已停用" }]} />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item name="description" label="服务说明">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          </FormSection>

          <FormSection title="数据来源" description="支持直接选表，也支持 SQL 模式。SQL 模式可基于运行结果选择入参和出参。">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="sourceId" label="数据源" rules={[{ required: true, message: "请选择数据源" }]}>
                  <Select
                    options={activeDataSourceOptions}
                    onChange={(value) => void handleServiceSourceChange(value)}
                    placeholder={activeDataSourceOptions.length ? "请选择数据源" : "请先新建并启用数据源"}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="serviceMode" label="来源模式" rules={[{ required: true, message: "请选择来源模式" }]}>
                  <Select
                    options={[
                      { value: "table", label: "数据表模式" },
                      { value: "sql", label: "SQL 模式" },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="返回字段数">
                  <Input value={`${(watchedResponseFieldNames || []).length}/${availableServiceFields.length}`} disabled />
                </Form.Item>
              </Col>

              {(watchedServiceMode || "table") === "table" ? (
                <Col span={24}>
                  <Form.Item name="sourceTable" label="数据表" rules={[{ required: true, message: "请选择数据表" }]}>
                    <Select
                      loading={metadataLoading}
                      options={serviceTables.map((item) => ({ label: item.tableName, value: item.tableName }))}
                      onChange={(value) => void handleServiceTableChange(value)}
                    />
                  </Form.Item>
                </Col>
              ) : (
                <>
                  <Col span={24}>
                    <Form.Item name="sourceSql" label="查询 SQL" rules={[{ required: true, message: "请输入查询 SQL" }]}>
                      <Input.TextArea rows={6} placeholder="请输入 SELECT 或 WITH ... SELECT 查询 SQL" />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Button onClick={() => void handlePreviewServiceSql()} loading={sqlPreviewLoading}>预览 SQL 结果</Button>
                  </Col>
                </>
              )}
            </Row>

            <Card size="small" title="结果预览" styles={{ body: { paddingTop: 12 } }}>
              <Table
                size="small"
                rowKey={(_, index) => String(index)}
                pagination={false}
                dataSource={servicePreviewRows}
                columns={servicePreviewTableColumns}
                locale={{ emptyText: (watchedServiceMode || "table") === "sql" ? "请先执行 SQL 预览" : "请选择数据表后查看样例数据" }}
                scroll={{ x: "max-content", y: 220 }}
              />
            </Card>
          </FormSection>

          <FormSection title="返回字段" description="返回字段以列表方式维护，支持一键全选或清空。">
            <Space style={{ marginBottom: 12 }}>
              <Button onClick={toggleSelectAllResponseFields}>{allResponseFieldsSelected ? "取消全选" : "一键全选"}</Button>
              <Typography.Text type="secondary">已选 {(watchedResponseFieldNames || []).length} 个字段</Typography.Text>
            </Space>
            <Form.Item name="responseFieldNames" hidden initialValue={[]}>
              <Select mode="multiple" options={serviceColumnOptions} />
            </Form.Item>
            <Table
              size="small"
              rowKey="columnName"
              pagination={false}
              dataSource={availableServiceFields}
              scroll={{ y: 260 }}
              columns={[
                {
                  title: "选择",
                  key: "checked",
                  width: 80,
                  render: (_, record) => (
                    <Checkbox
                      checked={selectedResponseFieldSet.has(record.columnName)}
                      onChange={(event) => updateResponseFieldSelection(record.columnName, event.target.checked)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  ),
                },
                { title: "字段名", dataIndex: "columnName", key: "columnName", width: 220 },
                { title: "字段说明", dataIndex: "label", key: "label", width: 260 },
                { title: "类型", dataIndex: "dataType", key: "dataType", width: 160 },
              ]}
              locale={{ emptyText: "当前还没有可选字段，请先选择数据表或预览 SQL 结果" }}
            />
          </FormSection>

          <FormSection title="查询参数" description="支持普通必填、可选，以及“同组字段至少填一个”的组合必填规则。">
            <Form.List name="queryFields">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ display: "flex" }} size={12}>
                  {fields.map((field) => (
                    <Card key={field.key} size="small">
                      <Row gutter={12}>
                        <Col span={7}>
                          <Form.Item
                            {...field}
                            name={[field.name, "columnName"]}
                            label="字段"
                            rules={[{ required: true, message: "请选择字段" }]}
                          >
                            <Select options={serviceColumnOptions} />
                          </Form.Item>
                        </Col>
                        <Col span={5}>
                          <Form.Item
                            {...field}
                            name={[field.name, "operator"]}
                            label="查询方式"
                            rules={[{ required: true, message: "请选择查询方式" }]}
                            initialValue="eq"
                          >
                            <Select options={[{ value: "eq", label: "精确匹配" }, { value: "like", label: "模糊匹配" }, { value: "between", label: "范围查询" }]} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item {...field} name={[field.name, "requirementMode"]} label="校验规则" initialValue="optional">
                            <Select options={[
                              { value: "optional", label: "可选" },
                              { value: "required", label: "必填" },
                              { value: "one_of_group", label: "组内至少一项" },
                            ]} />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item
                            noStyle
                            shouldUpdate={(prevValues, currentValues) => prevValues.queryFields?.[field.name]?.requirementMode !== currentValues.queryFields?.[field.name]?.requirementMode}
                          >
                            {({ getFieldValue }) => {
                              const requirementMode = getFieldValue(["queryFields", field.name, "requirementMode"]);
                              return requirementMode === "one_of_group" ? (
                                <Form.Item {...field} name={[field.name, "requiredGroup"]} label="分组编码" rules={[{ required: true, message: "请输入分组编码" }]}>
                                  <Input placeholder="如 phone_or_id" />
                                </Form.Item>
                              ) : (
                                <Form.Item label="分组编码">
                                  <Input disabled placeholder="仅组内至少一项时需要" />
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                        </Col>
                        <Col span={2} style={{ display: "flex", alignItems: "end" }}>
                          <Button danger type="link" onClick={() => remove(field.name)}>删除</Button>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                  <Button onClick={() => add({ operator: "eq", required: false, requirementMode: "optional" })}>新增查询参数</Button>
                </Space>
              )}
            </Form.List>
          </FormSection>

          <FormSection title="分页排序" description="控制列表接口的分页和默认排序。">
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="pagination" label="启用分页" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="defaultPageSize" label="默认每页" rules={[{ required: true, message: "请输入默认每页数量" }]}>
                  <InputNumber min={1} max={100} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="maxPageSize" label="最大每页" rules={[{ required: true, message: "请输入最大每页数量" }]}>
                  <InputNumber min={1} max={200} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="defaultSortOrder" label="默认排序">
                  <Select options={[{ value: "desc", label: "倒序" }, { value: "asc", label: "正序" }]} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="defaultSortField" label="默认排序字段">
                  <Select allowClear options={serviceColumnOptions} />
                </Form.Item>
              </Col>
            </Row>
          </FormSection>
        </Form>
      </Modal>

      <Modal
        open={serviceRecommendModalOpen}
        title="AI 推荐"
        width={760}
        destroyOnHidden
        confirmLoading={serviceRecommendLoading}
        onCancel={() => setServiceRecommendModalOpen(false)}
        onOk={() => void handleRecommendServiceConfig()}
        okText="开始推荐"
      >
        <Form layout="vertical" form={serviceRecommendForm}>
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            先选择数据来源和目标表或 SQL，再根据当前来源信息生成推荐接口方案。
          </Typography.Paragraph>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sourceId" label="数据来源" rules={[{ required: true, message: "请选择数据来源" }]}>
                <Select
                  options={activeDataSourceOptions}
                  placeholder="请选择数据来源"
                  onChange={(value) => {
                    serviceRecommendForm.setFieldsValue({ sourceTable: undefined, sourceSql: undefined });
                    setServiceRecommendTables([]);
                    if ((serviceRecommendForm.getFieldValue("serviceMode") || "table") === "table") {
                      void loadRecommendTables(value);
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="serviceMode" label="来源模式" rules={[{ required: true, message: "请选择来源模式" }]}>
                <Select
                  options={[
                    { value: "table", label: "目标表模式" },
                    { value: "sql", label: "SQL 模式" },
                  ]}
                  onChange={(value) => {
                    serviceRecommendForm.setFieldsValue({ sourceTable: undefined, sourceSql: undefined });
                    if (value === "table" && serviceRecommendForm.getFieldValue("sourceId")) {
                      void loadRecommendTables(serviceRecommendForm.getFieldValue("sourceId"));
                    }
                  }}
                />
              </Form.Item>
            </Col>
            {(watchedRecommendMode || "table") === "table" ? (
              <Col span={24}>
                <Form.Item name="sourceTable" label="目标表" rules={[{ required: true, message: "请选择目标表" }]}>
                  <Select
                    options={serviceRecommendTables.map((item) => ({ label: item.tableName, value: item.tableName }))}
                    placeholder="请选择目标表"
                  />
                </Form.Item>
              </Col>
            ) : (
              <Col span={24}>
                <Form.Item name="sourceSql" label="SQL" rules={[{ required: true, message: "请输入 SQL" }]}>
                  <Input.TextArea rows={6} placeholder="请输入用于生成接口方案的查询 SQL" />
                </Form.Item>
              </Col>
            )}
            <Col span={12}>
              <Form.Item name="requestMethod" label="请求方式" rules={[{ required: true, message: "请选择请求方式" }]}>
                <Select options={[{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="serviceType" label="服务类型" rules={[{ required: true, message: "请选择服务类型" }]}>
                <Select options={[{ value: "list", label: "列表查询" }, { value: "detail", label: "详情查询" }]} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        open={appModalOpen}
        title={editingApp ? "编辑应用" : "新建应用"}
        destroyOnHidden
        confirmLoading={appSubmitting}
        onCancel={() => setAppModalOpen(false)}
        onOk={() => void handleSubmitApp()}
      >
        <Form layout="vertical" form={appForm}>
          <Form.Item name="departmentName" label="所属部门" rules={[{ required: true, message: "请输入所属部门" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="appName" label="应用名称" rules={[{ required: true, message: "请输入应用名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="appCode" label="应用编码">
            <Input placeholder="留空将自动生成" />
          </Form.Item>
          <Form.Item name="appToken" label="访问 Token">
            <Input placeholder="留空将自动生成" />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话" rules={[{ required: true, message: "请输入联系电话" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="appDescription" label="应用详情">
            <Input.TextArea rows={4} placeholder="补充应用用途、接入说明、调用场景等" />
          </Form.Item>
          <Form.Item name="ownerName" label="负责人" rules={[{ required: true, message: "请输入负责人" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={authorizationModalOpen}
        title={editingAuthorization ? "编辑授权" : `新增授权${authorizationTargetApp ? ` - ${authorizationTargetApp.appName}` : ""}`}
        destroyOnHidden
        confirmLoading={authorizationSubmitting}
        onCancel={() => {
          setAuthorizationModalOpen(false);
          setAuthorizationTargetApp(null);
        }}
        onOk={() => void handleSubmitAuthorization()}
      >
        <Form layout="vertical" form={authorizationForm}>
          <Form.Item name="serviceId" label="服务" rules={[{ required: true, message: "请选择服务" }]}>
            <Select options={services.map((item) => ({ label: `${item.serviceName} (${item.serviceCode})`, value: item.id }))} />
          </Form.Item>
          <Form.Item name="appId" label="应用" rules={[{ required: true, message: "请选择应用" }]}>
            <Select
              disabled={Boolean(authorizationTargetApp)}
              options={apps.map((item) => ({
                label: `${item.departmentName || "-"} / ${item.appName} (${item.appCode})`,
                value: item.id,
              }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
                <Select options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="rateLimitPerMinute" label="分钟限流">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dailyLimit" label="日调用上限">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ipWhitelistText" label="IP 白名单">
            <Input.TextArea rows={4} placeholder="一行一个 IP，留空表示不限制" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={authorizationDetailOpen}
        title={authorizationDetailApp ? `${authorizationDetailApp.appName} - 授权详情` : "授权详情"}
        width={1260}
        className="authorization-detail-modal"
        destroyOnHidden
        footer={null}
        onCancel={() => {
          setAuthorizationDetailOpen(false);
          setAuthorizationDetailApp(null);
        }}
      >
        {authorizationDetailApp ? (
          <Space direction="vertical" size={16} style={{ display: "flex" }}>
            <Descriptions bordered size="small" column={{ xs: 1, md: 2, xl: 4 }}>
              <Descriptions.Item label="所属部门">{authorizationDetailApp.departmentName || "-"}</Descriptions.Item>
              <Descriptions.Item label="应用名称">{authorizationDetailApp.appName}</Descriptions.Item>
              <Descriptions.Item label="应用编码">{authorizationDetailApp.appCode}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{authorizationDetailApp.contactPhone || "-"}</Descriptions.Item>
              <Descriptions.Item label="访问 Token" span={4}>
                <Typography.Paragraph
                  copyable={{ text: authorizationDetailApp.appToken }}
                  ellipsis={{ rows: 1, tooltip: authorizationDetailApp.appToken }}
                  style={{ marginBottom: 0 }}
                >
                  {authorizationDetailApp.appToken}
                </Typography.Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="应用详情" span={4}>{authorizationDetailApp.appDescription || "-"}</Descriptions.Item>
            </Descriptions>

            <DataTableCard<DataServiceAuthorizationRecord>
              className="authorization-detail-table-card"
              title="已授权服务列表"
              extra={(
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateAuthorizationModal(authorizationDetailApp)}>
                  新加服务
                </Button>
              )}
              tableProps={{
                rowKey: "id",
                columns: authorizationDetailColumns,
                dataSource: authorizations.filter((item) => item.appId === authorizationDetailApp.id),
                className: "authorization-detail-table",
                size: "small",
                pagination: { pageSize: 6, showSizeChanger: false },
                locale: { emptyText: "当前应用还没有授权服务" },
                scroll: { x: 1120 },
              }}
            />
          </Space>
        ) : null}
      </Modal>

      <Modal
        open={serviceDetailOpen}
        title={authorizationDetailService ? `${authorizationDetailService.serviceName} - 接口详情` : "接口详情"}
        width={980}
        destroyOnHidden
        footer={(
          <Space>
            <Button onClick={() => setServiceDetailOpen(false)}>关闭</Button>
            {authorizationDetailService ? (
              <Button
                type="primary"
                onClick={async () => {
                  if (!token || !authorizationDetailService) return;
                  try {
                    await downloadDataServiceInterfaceDoc(
                      token,
                      authorizationDetailService.id,
                      window.location.origin,
                      `${authorizationDetailService.serviceCode || authorizationDetailService.serviceName}_api_doc.docx`
                    );
                    message.success("接口文档已开始下载");
                  } catch (error: unknown) {
                    message.error(`下载接口文档失败: ${getErrorMessage(error)}`);
                  }
                }}
              >
                下载 Word 文档
              </Button>
            ) : null}
          </Space>
        )}
        onCancel={() => {
          setServiceDetailOpen(false);
          setAuthorizationDetailService(null);
        }}
      >
        {authorizationDetailService ? (
          <Space direction="vertical" size={16} style={{ display: "flex" }}>
            {(() => {
              const authGuide = buildAuthGuide(authorizationDetailService);
              return (
                <Card size="small" title="认证说明">
                  <Space direction="vertical" size={8} style={{ display: "flex" }}>
                    <Typography.Text>{authGuide.description}</Typography.Text>
                    <div>
                      <Typography.Text strong>请求头示例</Typography.Text>
                      <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", overflow: "auto" }}>{authGuide.headers}</pre>
                    </div>
                    <div>
                      <Typography.Text strong>调用说明</Typography.Text>
                      <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                        {authGuide.notes.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  </Space>
                </Card>
              );
            })()}

            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="服务名称">{authorizationDetailService.serviceName}</Descriptions.Item>
              <Descriptions.Item label="服务编码">{authorizationDetailService.serviceCode}</Descriptions.Item>
              <Descriptions.Item label="调用方式">{authorizationDetailService.requestMethod}</Descriptions.Item>
              <Descriptions.Item label="认证方式">{authorizationDetailService.authType === "token" ? "Token 认证" : "免认证"}</Descriptions.Item>
              <Descriptions.Item label="请求地址" span={2}>
                <Typography.Text copyable>{`${window.location.origin}/api/service${authorizationDetailService.servicePath}`}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="来源模式">{authorizationDetailService.serviceMode === "sql" ? "SQL 模式" : "数据表模式"}</Descriptions.Item>
              <Descriptions.Item label="数据源">{authorizationDetailService.sourceName || "-"}</Descriptions.Item>
              <Descriptions.Item label="数据表 / SQL" span={2}>
                {authorizationDetailService.serviceMode === "sql"
                  ? (
                    <Typography.Paragraph copyable={{ text: authorizationDetailService.sourceSql || "" }} style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                      {authorizationDetailService.sourceSql || "-"}
                    </Typography.Paragraph>
                  )
                  : (authorizationDetailService.sourceTable || "-")}
              </Descriptions.Item>
              <Descriptions.Item label="服务说明" span={2}>{authorizationDetailService.description || "-"}</Descriptions.Item>
            </Descriptions>

            <DataTableCard
              title="入参定义"
              tableProps={{
                rowKey: (record) => String(record.paramName || record.startParamName || record.columnName),
                pagination: false,
                dataSource: authorizationDetailService.queryConfig.filters || [],
                columns: [
                  { title: "参数说明", dataIndex: "label", key: "label", width: 180 },
                  {
                    title: "参数名",
                    key: "paramName",
                    width: 180,
                    render: (_, record) => record.operator === "between"
                      ? `${record.startParamName || "-"} / ${record.endParamName || "-"}`
                      : (record.paramName || "-"),
                  },
                  { title: "查询方式", dataIndex: "operator", key: "operator", width: 120 },
                  {
                    title: "必填规则",
                    key: "required",
                    width: 180,
                    render: (_, record) => record.requirementMode === "one_of_group"
                      ? `组内至少一项${record.requiredGroup ? ` (${record.requiredGroup})` : ""}`
                      : (record.required ? "必填" : "可选"),
                  },
                  { title: "类型", dataIndex: "dataType", key: "dataType", width: 120 },
                ],
                locale: { emptyText: "当前接口无入参定义" },
                scroll: { x: 920 },
              }}
            />

            <DataTableCard
              title="出参定义"
              tableProps={{
                rowKey: "fieldName",
                pagination: false,
                dataSource: authorizationDetailService.responseConfig.fields || [],
                columns: [
                  { title: "字段说明", dataIndex: "label", key: "label", width: 200 },
                  { title: "返回字段", dataIndex: "fieldName", key: "fieldName", width: 180 },
                  { title: "源字段", dataIndex: "columnName", key: "columnName", width: 180 },
                  { title: "类型", dataIndex: "dataType", key: "dataType", width: 120 },
                ],
                locale: { emptyText: "当前接口无出参定义" },
                scroll: { x: 760 },
              }}
            />

            <Card size="small" title="请求示例">
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflow: "auto" }}>
                {buildRequestExample(authorizationDetailService)}
              </pre>
            </Card>

            <Card size="small" title="返回示例">
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflow: "auto" }}>
                {buildResponseExample(authorizationDetailService)}
              </pre>
            </Card>
          </Space>
        ) : null}
      </Modal>

      <Modal
        open={debugModalOpen}
        title={debuggingService ? `调试服务 - ${debuggingService.serviceName}` : "调试服务"}
        width={840}
        destroyOnHidden
        confirmLoading={debugSubmitting}
        onCancel={() => setDebugModalOpen(false)}
        onOk={() => void handleDebugService()}
      >
        <Form layout="vertical" form={debugForm}>
          {(debuggingService?.queryConfig.filters || []).map((filter: DataServiceQueryFilterConfig) => (
            filter.operator === "between" ? (
              <Row gutter={16} key={`${filter.columnName}-between`}>
                <Col span={12}>
                  <Form.Item
                    name={filter.startParamName || `${filter.columnName}Start`}
                    label={`${filter.label || filter.columnName} 开始`}
                    rules={filter.required ? [{ required: true, message: "请输入起始值" }] : []}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={filter.endParamName || `${filter.columnName}End`}
                    label={`${filter.label || filter.columnName} 结束`}
                    rules={filter.required ? [{ required: true, message: "请输入结束值" }] : []}
                  >
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            ) : (
              <Form.Item
                key={filter.columnName}
                name={filter.paramName || filter.columnName}
                label={filter.label || filter.columnName}
                rules={filter.required ? [{ required: true, message: "请输入参数值" }] : []}
              >
                <Input />
              </Form.Item>
            )
          ))}

          {debugResult ? (
            <Card size="small" title="调试结果">
              <Typography.Paragraph type="secondary">
                返回元信息: {stringifyWithFormattedDates(debugResult.meta)}
              </Typography.Paragraph>
              <pre style={{ margin: 0, maxHeight: 320, overflow: "auto", whiteSpace: "pre-wrap" }}>
                {stringifyWithFormattedDates(debugResult.data)}
              </pre>
            </Card>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
}
