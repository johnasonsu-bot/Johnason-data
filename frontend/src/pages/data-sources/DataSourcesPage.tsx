import {
  ApiOutlined,
  DatabaseOutlined,
  FileOutlined,
  FolderOpenOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  TableOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tree,
  Typography,
  message,
} from "antd";
import type { DataNode } from "antd/es/tree";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { FormSection } from "../../components/ui/FormSection";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { StatCard } from "../../components/ui/StatCard";
import { StatusTag } from "../../components/ui/StatusTag";
import {
  createDataSource,
  deleteDataSource,
  fetchDataSourceColumns,
  fetchDatabaseCapabilities,
  fetchDataSourceReferencedTasks,
  fetchDataSourceSampleRows,
  fetchDataSourceTables,
  fetchDataSources,
  testDataSourceConnection,
  updateDataSource,
} from "../../services/platform";
import type { DatabaseCapabilityStatus } from "../../services/platform";
import type {
  DataSourceColumn,
  DataSourceRecord,
  DataSourceReferencedTask,
  DataSourceSampleRow,
  DataSourceTable,
} from "../../types/api";
import {
  buildConnectionConfigFromForm,
  DATABASE_SOURCE_TYPE_OPTIONS,
  DATASOURCE_CODE_PATTERN,
  getApiFieldErrorMessage,
  getApiFieldErrors,
  getDefaultPort,
  normalizeDatasourceType,
  normalizeDatasourceCode,
} from "../../utils/datasource";

const sourceTypeOptions = [
  ...DATABASE_SOURCE_TYPE_OPTIONS,
  { value: "gaussdb", label: "GaussDB" },
  { value: "jdbc", label: "JDBC" },
  { value: "hive", label: "Hive" },
  { value: "api", label: "API" },
  { value: "ftp", label: "FTP" },
  { value: "sftp", label: "SFTP" },
  { value: "kafka", label: "Kafka" },
  { value: "other", label: "其他" },
];

const defaultPorts: Record<string, number> = {
  mysql: 3306,
  postgresql: 5432,
  gaussdb: 5432,
  jdbc: 0,
  oracle: 1521,
  dm: 5236,
  hive: 10000,
  api: 80,
  ftp: 21,
  sftp: 22,
  kafka: 9092,
  other: 0,
};

type PreviewDetailType = "properties" | "schema" | "sample";

function formatLocalDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function normalizeConnectionConfig(values: Record<string, unknown>) {
  return buildConnectionConfigFromForm(values);
}

const datasourceCodeRules = [
  { required: true, whitespace: true, message: "请输入编码" },
  { min: 2, message: "编码至少 2 个字符" },
  { pattern: DATASOURCE_CODE_PATTERN, message: "编码仅支持字母、数字和下划线" },
];

function downloadCsv(columns: DataSourceColumn[], rows: DataSourceSampleRow[], filename: string) {
  const headers = columns.map((column) => column.columnName);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return "";
          return `"${String(value).replace(/"/g, "\"\"")}"`;
        })
        .join(",")
    ),
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function normalizePreviewPath(value?: unknown) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function getParentDirectory(filePath?: unknown) {
  const normalized = normalizePreviewPath(filePath);
  const index = normalized.lastIndexOf("/");
  return index > -1 ? normalized.slice(0, index) || "/" : "/";
}

function getBaseName(filePath?: unknown) {
  const normalized = normalizePreviewPath(filePath);
  return normalized.split("/").filter(Boolean).pop() || normalized || "/";
}

function getFileExtension(filePath?: unknown) {
  const name = getBaseName(filePath);
  const index = name.lastIndexOf(".");
  return index > -1 ? name.slice(index + 1).toUpperCase() : "-";
}

function formatBytes(value?: number) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
}

function buildDirectoryTree(objects: DataSourceTable[]): DataNode[] {
  const directorySet = new Set<string>(["/"]);
  objects.forEach((item) => {
    const normalized = normalizePreviewPath(item.tableName);
    if (!normalized) return;
    if (item.objectType === "directory") {
      directorySet.add(normalized);
    } else {
      const parts = normalized.split("/").filter(Boolean);
      parts.slice(0, -1).reduce((current, part) => {
        const next = current ? `${current}/${part}` : part;
        directorySet.add(next);
        return next;
      }, "");
    }
  });

  function buildChildren(parent: string): DataNode[] {
    const prefix = parent === "/" ? "" : `${parent}/`;
    return Array.from(directorySet)
      .filter((dir) => dir !== "/" && getParentDirectory(dir) === parent)
      .sort((left, right) => getBaseName(left).localeCompare(getBaseName(right), "zh-CN"))
      .map((dir) => ({
        key: dir,
        title: getBaseName(dir),
        icon: <FolderOpenOutlined />,
        children: buildChildren(dir),
      }));
  }

  return [{ key: "/", title: "根目录", icon: <FolderOpenOutlined />, children: buildChildren("/") }];
}

export function DataSourcesPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const currentSourceType = Form.useWatch("sourceType", form);
  const currentConnectionMode = Form.useWatch("connectionMode", form);
  const normalizedCurrentSourceType = normalizeDatasourceType(currentSourceType);
  const jdbcMode = normalizedCurrentSourceType === "jdbc";
  const oracleMode = normalizedCurrentSourceType === "oracle";
  const dmMode = normalizedCurrentSourceType === "dm";
  const advancedJdbcMode = jdbcMode || oracleMode || dmMode;
  const apiMode = normalizedCurrentSourceType === "api";
  const ftpMode = normalizedCurrentSourceType === "ftp";
  const kafkaMode = normalizedCurrentSourceType === "kafka";

  const [records, setRecords] = useState<DataSourceRecord[]>([]);
  const [databaseCapabilities, setDatabaseCapabilities] = useState<DatabaseCapabilityStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingSourceIds, setCheckingSourceIds] = useState<Set<number>>(() => new Set());
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataSourceRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sourceCodeCustomized, setSourceCodeCustomized] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSourceRecord | null>(null);
  const [referencedTasks, setReferencedTasks] = useState<DataSourceReferencedTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewDataSource, setPreviewDataSource] = useState<DataSourceRecord | null>(null);
  const [previewTables, setPreviewTables] = useState<DataSourceTable[]>([]);
  const [previewTableName, setPreviewTableName] = useState("");
  const [previewColumns, setPreviewColumns] = useState<DataSourceColumn[]>([]);
  const [previewRows, setPreviewRows] = useState<DataSourceSampleRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDirectory, setPreviewDirectory] = useState("/");
  const [previewDetailType, setPreviewDetailType] = useState<PreviewDetailType | null>(null);

  const previewSourceType = normalizeDatasourceType(previewDataSource?.sourceType);
  const previewFtpMode = previewSourceType === "ftp";
  const previewKafkaMode = previewSourceType === "kafka";
  const previewApiMode = previewSourceType === "api";
  const listLoadVersionRef = useRef(0);
  const connectivityBatchRef = useRef(0);
  const previewObjects = useMemo(
    () => previewTables.filter((item) => item.objectType !== "directory"),
    [previewTables]
  );
  const selectedPreviewObject = useMemo(
    () => previewObjects.find((item) => item.tableName === previewTableName) || null,
    [previewObjects, previewTableName]
  );
  const directoryTreeData = useMemo(() => buildDirectoryTree(previewTables), [previewTables]);
  const directoryExpandedKeys = useMemo(() => {
    const keys: string[] = [];
    const collect = (nodes: DataNode[]) => {
      nodes.forEach((node) => {
        keys.push(String(node.key));
        if (Array.isArray(node.children)) collect(node.children as DataNode[]);
      });
    };
    collect(directoryTreeData);
    return keys;
  }, [directoryTreeData]);
  const ftpFilesInDirectory = useMemo(
    () => previewObjects.filter((item) => getParentDirectory(item.tableName) === previewDirectory),
    [previewDirectory, previewObjects]
  );

  function applyFormFieldErrors(error: unknown) {
    const fields = Object.entries(getApiFieldErrors(error))
      .filter(([, errors]) => Array.isArray(errors) && errors.length > 0)
      .map(([name, errors]) => ({
        name,
        errors: (errors || []).map((item) => String(item)),
      }));

    if (fields.length === 0) {
      return false;
    }

    form.setFields(fields);
    return true;
  }

  function setSourceChecking(sourceId: number, checking: boolean) {
    setCheckingSourceIds((current) => {
      const next = new Set(current);
      if (checking) {
        next.add(sourceId);
      } else {
        next.delete(sourceId);
      }
      return next;
    });
  }

  async function refreshConnectivityForRecords(nextRecords: DataSourceRecord[]) {
    if (!token) return;
    const authToken = token;

    const sourceIds = nextRecords.map((record) => record.id).filter((id) => Number.isFinite(id));
    const batchId = ++connectivityBatchRef.current;
    setCheckingSourceIds(new Set(sourceIds));

    if (sourceIds.length === 0) {
      return;
    }

    const pendingIds = [...sourceIds];
    const concurrency = Math.min(4, pendingIds.length);

    async function worker() {
      while (pendingIds.length > 0) {
        const sourceId = pendingIds.shift();
        if (!sourceId || batchId !== connectivityBatchRef.current) {
          return;
        }

        try {
          const response = await fetchDataSources(authToken, { includeConnectivity: true, ids: [sourceId] });
          const connectivityRecord = response.data[0];
          if (batchId !== connectivityBatchRef.current || !connectivityRecord) {
            return;
          }

          setRecords((current) =>
            current.map((record) =>
              record.id === sourceId
                ? {
                    ...record,
                    connectionStatus: connectivityRecord.connectionStatus,
                    connectionMessage: connectivityRecord.connectionMessage,
                    lastCheckedAt: connectivityRecord.lastCheckedAt,
                  }
                : record
            )
          );
        } catch {
          // 单个数据源探活失败不影响列表和其他数据源状态刷新。
        } finally {
          if (batchId === connectivityBatchRef.current) {
            setSourceChecking(sourceId, false);
          }
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  }

  async function loadData(options?: { silent?: boolean; background?: boolean }) {
    if (!token) return;
    const loadVersion = ++listLoadVersionRef.current;
    connectivityBatchRef.current += 1;
    setCheckingSourceIds(new Set());
    if (!options?.background) setLoading(true);

    try {
      const response = await fetchDataSources(token);
      if (loadVersion !== listLoadVersionRef.current) {
        return;
      }
      setRecords(response.data);
      void refreshConnectivityForRecords(response.data);
    } catch (error: any) {
      if (!options?.silent) {
        message.error(`加载数据源失败: ${error.message || "未知错误"}`);
      }
    } finally {
      if (!options?.background && loadVersion === listLoadVersionRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void fetchDatabaseCapabilities(token).then((response) => setDatabaseCapabilities(response.data)).catch(() => setDatabaseCapabilities([]));
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const timer = window.setInterval(() => {
      void loadData({ silent: true, background: true });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [token]);

  useEffect(() => {
    const sourceId = Number((location.state as { openReferencedTasksDataSourceId?: number } | null)?.openReferencedTasksDataSourceId || 0);
    if (!sourceId || records.length === 0) {
      return;
    }

    const matched = records.find((item) => item.id === sourceId);
    if (!matched) {
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    void openReferencedTasksModal(matched);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, records]);

  const filteredRecords = useMemo(() => records.filter((record) => {
    if (keyword) {
      const searchText = `${record.sourceName} ${record.sourceCode} ${record.ownerName}`.toLowerCase();
      if (!searchText.includes(keyword.toLowerCase())) {
        return false;
      }
    }
    if (typeFilter && record.sourceType !== typeFilter) {
      return false;
    }
    if (statusFilter && record.status !== statusFilter) {
      return false;
    }
    return true;
  }), [keyword, records, statusFilter, typeFilter]);

  const currentDatabaseCapability = databaseCapabilities.find((item) => item.type === normalizedCurrentSourceType);

  const kpiItems = useMemo(() => {
    const onlineCount = records.filter((item) => item.connectionStatus === "online").length;
    const activeCount = records.filter((item) => item.status === "active").length;
    const taskCount = records.reduce((sum, item) => sum + Number(item.taskReferenceCount || 0), 0);
    return [
      { key: "total", title: "数据源总量", value: records.length, icon: <DatabaseOutlined />, description: "当前纳管连接数" },
      { key: "online", title: "在线连接", value: onlineCount, icon: <ApiOutlined />, description: "最近一次检测在线" },
      { key: "active", title: "启用配置", value: activeCount, icon: <ReloadOutlined />, description: "处于启用状态的连接" },
      { key: "task", title: "关联任务", value: taskCount, icon: <EyeOutlined />, description: "引用该数据源的接入任务数" },
    ];
  }, [records]);

  function resetModal() {
    form.resetFields();
    setEditingRecord(null);
    setTestResult(null);
    setSourceCodeCustomized(false);
  }

  function closeModal() {
    setOpen(false);
    resetModal();
  }

  function openCreateModal() {
    resetModal();
    form.setFieldsValue({
      sourceType: "mysql",
      ownerName: "平台架构组",
      status: "active",
      port: defaultPorts.mysql,
      passiveMode: true,
      encoding: "utf8",
      maxPreviewBytes: 1048576,
    });
    setOpen(true);
  }

  function openEditModal(record: DataSourceRecord) {
    resetModal();
    setEditingRecord(record);
    setSourceCodeCustomized(true);
    form.setFieldsValue({
      sourceName: record.sourceName,
      sourceCode: record.sourceCode,
      sourceType: record.sourceType,
      ownerName: record.ownerName,
      status: record.status,
      host: record.connectionConfig?.host,
      port: record.connectionConfig?.port ?? defaultPorts[record.sourceType] ?? 0,
      databaseName: record.connectionConfig?.database,
      username: record.connectionConfig?.username,
      password: record.connectionConfig?.password,
      rootPath: record.connectionConfig?.rootPath || record.connectionConfig?.path,
      passiveMode: record.connectionConfig?.passiveMode !== false,
      encoding: record.connectionConfig?.encoding || "utf8",
      maxPreviewBytes: record.connectionConfig?.maxPreviewBytes || 1048576,
      bootstrapServers: record.connectionConfig?.bootstrapServers || record.connectionConfig?.bootstrapServer,
      clientId: record.connectionConfig?.clientId,
      topicPattern: record.connectionConfig?.topicPattern,
      fromBeginning: Boolean(record.connectionConfig?.fromBeginning),
      jdbcUrl: record.connectionConfig?.jdbcUrl,
      schema: record.connectionConfig?.schema,
      driverClassName: record.connectionConfig?.driverClassName,
      connectionMode: record.connectionConfig?.connectionMode || "serviceName",
      baseUrl: record.connectionConfig?.baseUrl || record.connectionConfig?.apiBaseUrl || record.connectionConfig?.url,
      timeoutMs: record.connectionConfig?.timeoutMs || 30000,
    });
    setOpen(true);
  }

  function handleSourceCodeBlur() {
    form.setFieldValue("sourceCode", normalizeDatasourceCode(form.getFieldValue("sourceCode")));
  }

  function handleFormValuesChange(changedValues: Record<string, unknown>) {
    if ("sourceType" in changedValues) {
      const nextType = normalizeDatasourceType(changedValues.sourceType);
      form.setFieldsValue({
        port: defaultPorts[String(changedValues.sourceType)] ?? getDefaultPort(changedValues.sourceType),
        databaseName: undefined,
        schema: undefined,
        jdbcUrl: undefined,
        driverClassName: undefined,
        connectionMode: nextType === "oracle" ? "serviceName" : undefined,
        rootPath: nextType === "ftp" ? "/upload" : undefined,
        passiveMode: nextType === "ftp" ? true : undefined,
        encoding: nextType === "ftp" ? "utf8" : undefined,
        maxPreviewBytes: nextType === "ftp" ? 1048576 : undefined,
        bootstrapServers: nextType === "kafka" ? "117.72.72.113:39092" : undefined,
        clientId: nextType === "kafka" ? "medata-ingestion-preview" : undefined,
        topicPattern: undefined,
        fromBeginning: nextType === "kafka" ? true : undefined,
        baseUrl: nextType === "api" ? "http://127.0.0.1:45121" : undefined,
        timeoutMs: nextType === "api" ? 30000 : undefined,
      });
    }

    if ("sourceCode" in changedValues) {
      setSourceCodeCustomized(true);
      if (form.getFieldError("sourceCode").length > 0) {
        form.setFields([{ name: "sourceCode", errors: [] }]);
      }
    }

    if ("sourceName" in changedValues && !editingRecord && !sourceCodeCustomized) {
      form.setFieldValue("sourceCode", normalizeDatasourceCode(changedValues.sourceName));
      if (form.getFieldError("sourceCode").length > 0) {
        form.setFields([{ name: "sourceCode", errors: [] }]);
      }
    }
  }

  async function openReferencedTasksModal(record: DataSourceRecord) {
    if (!token) return;
    setSelectedDataSource(record);
    setTaskModalOpen(true);
    setTasksLoading(true);
    setReferencedTasks([]);

    try {
      const response = await fetchDataSourceReferencedTasks(token, record.id);
      setReferencedTasks(response.data);
    } catch (error: any) {
      message.error(`加载引用任务失败: ${error.message || "未知错误"}`);
    } finally {
      setTasksLoading(false);
    }
  }

  async function loadPreviewData(record: DataSourceRecord, tableName: string, options?: { includeRows?: boolean }) {
    if (!token) return;
    const includeRows = options?.includeRows !== false;
    if (normalizeDatasourceType(record.sourceType) === "ftp") {
      if (!includeRows) {
        const columnsResponse = await fetchDataSourceColumns(token, record.id, tableName);
        setPreviewColumns(columnsResponse.data);
        setPreviewRows([]);
        return;
      }
      const rowsResponse = await fetchDataSourceSampleRows(token, record.id, tableName);
      setPreviewRows(rowsResponse.data);
      setPreviewColumns(inferColumnsFromRows(rowsResponse.data));
      return;
    }
    const [columnsResponse, rowsResponse] = await Promise.all([
      fetchDataSourceColumns(token, record.id, tableName),
      includeRows ? fetchDataSourceSampleRows(token, record.id, tableName) : Promise.resolve({ data: [] as DataSourceSampleRow[] }),
    ]);
    setPreviewColumns(columnsResponse.data);
    setPreviewRows(rowsResponse.data);
  }

  async function openPreviewModal(record: DataSourceRecord) {
    if (!token) return;
    setPreviewDataSource(record);
    setPreviewModalOpen(true);
    setPreviewLoading(true);
    setPreviewTables([]);
    setPreviewTableName("");
    setPreviewColumns([]);
    setPreviewRows([]);
    setPreviewDirectory("/");
    setPreviewDetailType(null);

    try {
      const type = normalizeDatasourceType(record.sourceType);
      const tablesResponse = await fetchDataSourceTables(token, record.id, { includeDirectories: type === "ftp" });
      const tables = (tablesResponse.data || []).filter((item) => type === "ftp" || item.objectType !== "directory");
      setPreviewTables(tables);
      const preferredTable = String(record.connectionConfig?.table || "").trim();
      const nextTable = preferredTable && tables.some((item) => item.tableName === preferredTable)
        ? preferredTable
        : tables.find((item) => item.objectType !== "directory")?.tableName || "";
      setPreviewTableName(nextTable);
      if (type === "ftp") {
        setPreviewDirectory(nextTable ? getParentDirectory(nextTable) : "/");
      }
      if (nextTable && type !== "ftp") {
        await loadPreviewData(record, nextTable);
      }
    } catch (error: any) {
      message.error(`加载预览失败: ${error.message || "未知错误"}`);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handlePreviewTableChange(tableName: string, options?: { includeRows?: boolean }) {
    if (!previewDataSource) return;
    setPreviewTableName(tableName);
    setPreviewLoading(true);
    try {
      await loadPreviewData(previewDataSource, tableName, options);
    } catch (error: any) {
      message.error(`切换表预览失败: ${error.message || "未知错误"}`);
    } finally {
      setPreviewLoading(false);
    }
  }

  function handlePreviewDirectoryChange(keys: Array<string | number>) {
    const nextDirectory = String(keys[0] || "/");
    setPreviewDirectory(nextDirectory);
  }

  async function openPreviewDetail(tableName: string, type: PreviewDetailType) {
    if (type === "properties") {
      setPreviewTableName(tableName);
      setPreviewDetailType(type);
      return;
    }
    await handlePreviewTableChange(tableName, { includeRows: type === "sample" });
    setPreviewDetailType(type);
  }

  function handleExportPreviewCsv() {
    if (!previewColumns.length || !previewRows.length) {
      message.warning("当前没有可导出的样例数据");
      return;
    }

    downloadCsv(
      previewColumns,
      previewRows,
      `${previewDataSource?.sourceCode || "sample"}_${previewTableName || "preview"}.csv`
    );
  }

  function getPreviewObjectLabel(record?: DataSourceRecord | null) {
    const type = normalizeDatasourceType(record?.sourceType);
    if (type === "ftp") return "文件";
    if (type === "kafka") return "Topic";
    if (type === "api") return "接口";
    return "表";
  }

  function inferColumnsFromRows(rows: DataSourceSampleRow[]): DataSourceColumn[] {
    const firstRow = rows.find((row) => row && typeof row === "object");
    if (!firstRow) return [];
    return Object.keys(firstRow).map((columnName, index) => ({
      columnName,
      ordinalPosition: index + 1,
      dataType: "string",
      columnType: "string",
      isNullable: true,
      isPrimaryKey: false,
      columnComment: "",
    }));
  }

  function getPreviewDescription(record?: DataSourceRecord | null) {
    const type = normalizeDatasourceType(record?.sourceType);
    if (type === "ftp") return "选择 FTP 文件并预览文件路径、文件内容或结构化样例。";
    if (type === "kafka") return "选择 Kafka Topic 并预览 Topic 消息样例。";
    if (type === "api") return "选择 API 接口并预览响应字段和样例数据。";
    return "选择表并导出当前样例数据，快速确认连通与字段结果。";
  }

  async function handleTestConnection() {
    if (!token) return;

    try {
      const type = normalizeDatasourceType(form.getFieldValue("sourceType"));
      const fieldNames = type === "kafka"
        ? ["sourceType", "bootstrapServers", "clientId", "topicPattern", "fromBeginning"]
        : type === "api"
          ? ["sourceType", "baseUrl", "timeoutMs"]
        : type === "ftp"
          ? ["sourceType", "host", "port", "username", "password", "rootPath", "passiveMode", "encoding", "maxPreviewBytes"]
          : ["sourceType", "host", "port", "databaseName", "username", "password", "jdbcUrl", "schema", "driverClassName"];
      const values = (await form.validateFields(fieldNames)) as Record<string, unknown>;

      setTesting(true);
      setTestResult(null);

      const response = await testDataSourceConnection(token, {
        sourceType: values.sourceType,
        connectionConfig: normalizeConnectionConfig({ ...values, sourceType: values.sourceType }),
      });

      setTestResult(response.data);
      if (response.data.success) {
        message.success(response.data.message);
      } else {
        message.error(response.data.message);
      }
    } catch (error: any) {
      if (error?.errorFields) {
        message.error("请先补全连接信息后再测试");
      } else {
        message.error(`连接测试失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit() {
    if (!token) return;

    let values: Record<string, unknown>;
    try {
      values = (await form.validateFields()) as Record<string, unknown>;
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`表单校验失败: ${error?.message || "未知错误"}`);
      }
      return;
    }

    const payload = {
      sourceName: String(values.sourceName ?? "").trim(),
      sourceCode: String(values.sourceCode ?? "").trim(),
      sourceType: values.sourceType,
      ownerName: String(values.ownerName ?? "").trim(),
      status: values.status,
      connectionConfig: normalizeConnectionConfig(values),
    };

    setSubmitting(true);
    try {
      if (editingRecord) {
        await updateDataSource(token, editingRecord.id, payload);
        message.success("数据源更新成功");
      } else {
        await createDataSource(token, payload);
        message.success("数据源创建成功");
      }
      closeModal();
      await loadData();
    } catch (error: any) {
      const actionText = editingRecord ? "更新" : "创建";
      const errorMessage = getApiFieldErrorMessage(error, "未知错误");
      if (applyFormFieldErrors(error)) {
        message.error(errorMessage);
      } else {
        message.error(`${actionText}失败: ${errorMessage}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(record: DataSourceRecord) {
    if (!token) return;
    try {
      await deleteDataSource(token, record.id);
      message.success("数据源删除成功");
      await loadData();
    } catch (error: any) {
      message.error(`删除失败: ${error.message || "未知错误"}`);
    }
  }

  function confirmDelete(record: DataSourceRecord) {
    Modal.confirm({
      title: `确认删除数据源“${record.sourceName}”？`,
      content: "删除后不可恢复，引用该数据源的任务需要重新配置。",
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: () => handleDelete(record),
    });
  }

  const columns: ColumnsType<DataSourceRecord> = [
    { title: "名称", dataIndex: "sourceName", key: "sourceName", width: 180 },
    { title: "编码", dataIndex: "sourceCode", key: "sourceCode", width: 180 },
    { title: "类型", dataIndex: "sourceType", key: "sourceType", width: 120 },
    {
      title: "关联任务",
      dataIndex: "taskReferenceCount",
      key: "taskReferenceCount",
      width: 120,
      render: (value: number | undefined, record) => {
        const count = Number(value || 0);
        if (count === 0) {
          return <Typography.Text type="secondary">0</Typography.Text>;
        }
        return (
          <Button type="link" onClick={() => void openReferencedTasksModal(record)} style={{ paddingInline: 0 }}>
            {count}
          </Button>
        );
      },
    },
    { title: "负责人", dataIndex: "ownerName", key: "ownerName", width: 140 },
    {
      title: "配置状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: string) => <StatusTag status={value} />,
    },
    {
      title: "连通状态",
      dataIndex: "connectionStatus",
      key: "connectionStatus",
      width: 220,
      render: (_: unknown, record) => (
        <Space direction="vertical" size={2}>
          {checkingSourceIds.has(record.id) ? (
            <StatusTag label="检测中" tone="processing" />
          ) : (
            <StatusTag status={record.connectionStatus} />
          )}
          {record.lastCheckedAt ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {formatLocalDateTime(record.lastCheckedAt)}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (value: string) => formatLocalDateTime(value),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 220,
      render: (_: unknown, record) => (
        <Space>
          <Button type="link" onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Button type="link" onClick={() => void openPreviewModal(record)}>
            预览数据
          </Button>
          <Button danger type="link" onClick={() => confirmDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const referencedTaskColumns: ColumnsType<DataSourceReferencedTask> = [
    { title: "任务名称", dataIndex: "taskName", key: "taskName", width: 180 },
    { title: "任务编码", dataIndex: "taskCode", key: "taskCode", width: 220 },
    { title: "来源表", dataIndex: "sourceTable", key: "sourceTable", width: 180 },
    { title: "目标表", dataIndex: "targetTable", key: "targetTable", width: 180 },
    { title: "同步模式", dataIndex: "syncMode", key: "syncMode", width: 120 },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: string) => <StatusTag status={value} />,
    },
    {
      title: "关联角色",
      key: "relationRole",
      width: 120,
      render: (_: unknown, record) => {
        const roles: string[] = [];
        if (selectedDataSource?.id === record.sourceId) roles.push("来源");
        if (selectedDataSource?.id === record.targetSourceId) roles.push("目标");
        return roles.join(" / ") || "-";
      },
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (value: string) => formatLocalDateTime(value),
    },
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_: unknown, record) => (
        <Button type="link" onClick={() => navigate(`/dashboard/data-ingestion-jobs/${record.id}/edit`)}>
          查看任务
        </Button>
      ),
    },
  ];

  function renderPreviewCell(value: unknown) {
    if (value === null || value === undefined || value === "") return "-";
    const text = String(value);
    return text.length > 120 ? (
      <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }} ellipsis={{ rows: 3, expandable: true, symbol: "展开" }}>
        {text}
      </Typography.Paragraph>
    ) : text;
  }

  function renderSampleTable(emptyText: string) {
    return (
      <Table
        rowKey={(record) => JSON.stringify(record)}
        className="app-table"
        loading={previewLoading}
        size="small"
        dataSource={previewRows}
        pagination={{ pageSize: 8, showSizeChanger: false }}
        scroll={{ x: 960 }}
        columns={previewColumns.map((column) => ({
          title: column.columnName,
          dataIndex: column.columnName,
          key: column.columnName,
          render: renderPreviewCell,
        }))}
        locale={{ emptyText }}
      />
    );
  }

  function getPreviewDetailTitle() {
    const objectLabel = getPreviewObjectLabel(previewDataSource);
    if (previewDetailType === "properties") {
      return `${objectLabel}属性${previewTableName ? ` - ${getBaseName(previewTableName)}` : ""}`;
    }
    if (previewDetailType === "schema") {
      if (previewFtpMode) return `文件结构${previewTableName ? ` - ${getBaseName(previewTableName)}` : ""}`;
      return `${objectLabel === "Topic" ? "消息结构" : "字段结构"}${previewTableName ? ` - ${previewTableName}` : ""}`;
    }
    if (previewDetailType === "sample") {
      if (previewFtpMode) return `文件内容预览${previewTableName ? ` - ${getBaseName(previewTableName)}` : ""}`;
      return `${objectLabel === "Topic" ? "消息样例" : "数据样例"}${previewTableName ? ` - ${previewTableName}` : ""}`;
    }
    return "预览详情";
  }

  function renderPreviewDetailContent() {
    const objectLabel = getPreviewObjectLabel(previewDataSource);
    if (!previewDetailType) return null;
    if (previewDetailType === "properties") {
      return renderSelectedObjectDescriptions();
    }
    if (previewDetailType === "schema") {
      return renderObjectSchemaTable();
    }
    return renderSampleTable(previewTableName ? `当前${objectLabel}暂无样例数据` : `请选择${objectLabel}`);
  }

  function renderObjectSchemaTable() {
    return (
      <Table<DataSourceColumn>
        rowKey="columnName"
        className="app-table"
        loading={previewLoading}
        size="small"
        dataSource={previewColumns}
        pagination={{ pageSize: 8, showSizeChanger: false }}
        scroll={{ x: 760 }}
        columns={[
          { title: "字段名", dataIndex: "columnName", width: 180 },
          { title: "类型", dataIndex: "dataType", width: 120, render: (value, record) => value || record.columnType || "-" },
          { title: "主键", dataIndex: "isPrimaryKey", width: 80, render: (value) => value ? "是" : "否" },
          { title: "可为空", dataIndex: "isNullable", width: 90, render: (value) => value ? "是" : "否" },
          { title: "说明", dataIndex: "columnComment", render: (value) => value || "-" },
        ]}
        locale={{ emptyText: "请选择对象后查看结构" }}
      />
    );
  }

  function renderSelectedObjectDescriptions() {
    if (!selectedPreviewObject) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`请选择${getPreviewObjectLabel(previewDataSource)}`} />;
    }
    if (previewFtpMode) {
      return (
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="文件名">{getBaseName(selectedPreviewObject.tableName)}</Descriptions.Item>
          <Descriptions.Item label="目录">{getParentDirectory(selectedPreviewObject.tableName)}</Descriptions.Item>
          <Descriptions.Item label="完整路径" span={2}>{selectedPreviewObject.tableName}</Descriptions.Item>
          <Descriptions.Item label="文件类型">{getFileExtension(selectedPreviewObject.tableName)}</Descriptions.Item>
          <Descriptions.Item label="文件大小">{formatBytes(selectedPreviewObject.fileSize)}</Descriptions.Item>
          <Descriptions.Item label="更新时间" span={2}>{formatLocalDateTime(selectedPreviewObject.modifiedAt || undefined)}</Descriptions.Item>
        </Descriptions>
      );
    }
    if (previewKafkaMode) {
      return (
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Topic">{selectedPreviewObject.tableName}</Descriptions.Item>
          <Descriptions.Item label="分区数">{selectedPreviewObject.partitionCount ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="类型">{selectedPreviewObject.tableType || "TOPIC"}</Descriptions.Item>
          <Descriptions.Item label="说明">{selectedPreviewObject.tableComment || "-"}</Descriptions.Item>
        </Descriptions>
      );
    }
    if (previewApiMode) {
      return (
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="接口路径">{selectedPreviewObject.tableName}</Descriptions.Item>
          <Descriptions.Item label="类型">{selectedPreviewObject.tableType || "API"}</Descriptions.Item>
          <Descriptions.Item label="请求地址" span={2}>{selectedPreviewObject.tableComment || "-"}</Descriptions.Item>
        </Descriptions>
      );
    }
    return (
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="表名">{selectedPreviewObject.tableName}</Descriptions.Item>
        <Descriptions.Item label="类型">{selectedPreviewObject.tableType || "-"}</Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>{selectedPreviewObject.tableComment || "-"}</Descriptions.Item>
      </Descriptions>
    );
  }

  function renderFtpPreviewBrowser() {
    const fileColumns: ColumnsType<DataSourceTable> = [
      {
        title: "文件名称",
        dataIndex: "tableName",
        width: 260,
        render: (value) => (
          <Space size={6}>
            <FileOutlined />
            <Typography.Text ellipsis style={{ maxWidth: 220 }} title={String(value || "")}>
              {getBaseName(value)}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "目录",
        dataIndex: "tableName",
        width: 160,
        render: (value) => getParentDirectory(value),
      },
      { title: "类型", width: 90, render: (_value, record) => getFileExtension(record.tableName) },
      { title: "大小", dataIndex: "fileSize", width: 100, render: formatBytes },
      { title: "更新时间", dataIndex: "modifiedAt", width: 180, render: formatLocalDateTime },
      {
        title: "属性信息",
        width: 110,
        render: (_value, record) => (
          <Button type="link" onClick={() => void openPreviewDetail(record.tableName, "properties")}>
            查看属性
          </Button>
        ),
      },
      {
        title: "字段信息",
        width: 110,
        render: (_value, record) => (
          <Button type="link" onClick={() => void openPreviewDetail(record.tableName, "schema")}>
            文件结构
          </Button>
        ),
      },
      {
        title: "数据预览",
        width: 110,
        render: (_value, record) => (
          <Button type="link" onClick={() => void openPreviewDetail(record.tableName, "sample")}>
            预览
          </Button>
        ),
      },
    ];
    return (
      <Row gutter={12} style={{ minHeight: 560 }}>
        <Col span={5}>
          <Card size="small" title="目录结构" styles={{ body: { padding: 8, height: 520, overflow: "auto" } }}>
            <Tree
              showIcon
              expandedKeys={directoryExpandedKeys}
              selectedKeys={[previewDirectory]}
              treeData={directoryTreeData}
              onSelect={(keys) => handlePreviewDirectoryChange(keys as Array<string | number>)}
            />
          </Card>
        </Col>
        <Col span={19}>
          <Card
            size="small"
            title="文件列表"
            extra={<Typography.Text type="secondary">{ftpFilesInDirectory.length} 个文件</Typography.Text>}
            styles={{ body: { padding: 0 } }}
          >
            <Table<DataSourceTable>
              rowKey="tableName"
              className="app-table"
              size="small"
              loading={previewLoading && !previewRows.length}
              dataSource={ftpFilesInDirectory}
              columns={fileColumns}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ x: 1120, y: 482 }}
              rowClassName={(record) => record.tableName === previewTableName ? "ant-table-row-selected" : ""}
              locale={{ emptyText: "当前目录暂无文件" }}
            />
          </Card>
        </Col>
      </Row>
    );
  }

  function renderStructuredPreviewBrowser() {
    const objectLabel = getPreviewObjectLabel(previewDataSource);
    const objectColumns: ColumnsType<DataSourceTable> = [
      {
        title: objectLabel === "Topic" ? "Topic 名称" : "表名",
        dataIndex: "tableName",
        width: 300,
        render: (value) => (
          <Space size={6}>
            {objectLabel === "Topic" ? <ApiOutlined /> : <TableOutlined />}
            <Typography.Text ellipsis style={{ maxWidth: 280 }} title={String(value || "")}>{value}</Typography.Text>
          </Space>
        ),
      },
      {
        title: objectLabel === "Topic" ? "分区" : "类型",
        width: 110,
        render: (_value, record) => objectLabel === "Topic" ? record.partitionCount ?? "-" : record.tableType || "-",
      },
      {
        title: "说明",
        dataIndex: "tableComment",
        render: (value) => (
          <Typography.Text ellipsis style={{ maxWidth: 300 }} title={String(value || "")}>
            {value || "-"}
          </Typography.Text>
        ),
      },
      {
        title: "属性信息",
        width: 110,
        render: (_value, record) => (
          <Button type="link" onClick={() => void openPreviewDetail(record.tableName, "properties")}>
            查看属性
          </Button>
        ),
      },
      {
        title: "字段信息",
        width: 120,
        render: (_value, record) => (
          <Button type="link" onClick={() => void openPreviewDetail(record.tableName, "schema")}>
            {objectLabel === "Topic" ? "消息结构" : "字段结构"}
          </Button>
        ),
      },
      {
        title: "数据预览",
        width: 120,
        render: (_value, record) => (
          <Button type="link" onClick={() => void openPreviewDetail(record.tableName, "sample")}>
            {objectLabel === "Topic" ? "消息样例" : "数据样例"}
          </Button>
        ),
      },
    ];
    return (
      <Row gutter={12} style={{ minHeight: 560 }}>
        <Col span={5}>
          <Card size="small" title="对象目录" styles={{ body: { padding: 8, height: 520, overflow: "auto" } }}>
            <Tree
              showIcon
              defaultExpandAll
              selectedKeys={["all"]}
              treeData={[
                {
                  key: "all",
                  title: `全部${objectLabel}`,
                  icon: objectLabel === "Topic" ? <ApiOutlined /> : <TableOutlined />,
                },
              ]}
            />
          </Card>
        </Col>
        <Col span={19}>
          <Card
            size="small"
            title={`${objectLabel}清单`}
            extra={<Typography.Text type="secondary">{previewObjects.length} 个</Typography.Text>}
            styles={{ body: { padding: 0 } }}
          >
            <Table<DataSourceTable>
              rowKey="tableName"
              className="app-table"
              size="small"
              loading={previewLoading && !previewRows.length}
              dataSource={previewObjects}
              columns={objectColumns}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: 1080, y: 482 }}
              rowClassName={(record) => record.tableName === previewTableName ? "ant-table-row-selected" : ""}
              locale={{ emptyText: `暂无${objectLabel}` }}
            />
          </Card>
        </Col>
      </Row>
    );
  }

  function renderPreviewBrowser() {
    return (
      <Space direction="vertical" size={12} style={{ display: "flex" }}>
        <Alert type="info" showIcon message={getPreviewDescription(previewDataSource)} />
        {previewFtpMode ? renderFtpPreviewBrowser() : renderStructuredPreviewBrowser()}
      </Space>
    );
  }

  return (
    <div className="app-page">
      <PageToolbar
        left={(
          <>
            <Input.Search
              allowClear
              className="toolbar-search"
              placeholder="搜索名称、编码、负责人"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Select
              allowClear
              placeholder="数据源类型"
              style={{ width: 180 }}
              value={typeFilter}
              options={sourceTypeOptions}
              onChange={setTypeFilter}
            />
            <Select
              allowClear
              placeholder="配置状态"
              style={{ width: 160 }}
              value={statusFilter}
              options={[
                { value: "active", label: "启用" },
                { value: "inactive", label: "停用" },
              ]}
              onChange={setStatusFilter}
            />
          </>
        )}
        right={(
          <>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新建数据源
            </Button>
          </>
        )}
      />

      <div className="app-page-body">
        <div className="kpi-grid">
          {kpiItems.map((item) => (
            <StatCard key={item.key} title={item.title} value={item.value} icon={item.icon} description={item.description} />
          ))}
        </div>

        <DataTableCard<DataSourceRecord>
          title="数据源目录"
          extra={<Typography.Text type="secondary">共 {filteredRecords.length} 条记录</Typography.Text>}
          tableProps={{
            rowKey: "id",
            loading,
            columns,
            dataSource: filteredRecords,
            pagination: { pageSize: 8, showSizeChanger: false },
            scroll: { x: 1680 },
          }}
        />
      </div>

      <Modal
        open={open}
        title={editingRecord ? "编辑数据源" : "新建数据源"}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        destroyOnHidden
        width={840}
        footer={[
          <Button key="test" onClick={() => void handleTestConnection()} loading={testing}>
            测试连接
          </Button>,
          <Button key="cancel" onClick={closeModal}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={() => void handleSubmit()} loading={submitting}>
            {editingRecord ? "保存" : "创建"}
          </Button>,
        ]}
      >
        <Form
          layout="vertical"
          form={form}
          onValuesChange={handleFormValuesChange}
        >
          <Row gutter={16}>
            <Col span={24}>
              <FormSection title="基础信息" description="统一维护名称、编码、类型和负责人。">
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="sourceName" label="数据源名称" rules={[{ required: true, message: "请输入名称" }]}>
                      <Input placeholder="例如：生产 GaussDB 订单库" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="sourceCode" label="数据源编码" rules={datasourceCodeRules}>
                      <Input placeholder="例如：prod_gaussdb_order" onBlur={handleSourceCodeBlur} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="sourceType" label="数据源类型" rules={[{ required: true, message: "请选择类型" }]}>
                      <Select options={sourceTypeOptions} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="ownerName" label="负责人" rules={[{ required: true, message: "请输入负责人" }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="status" label="配置状态" rules={[{ required: true, message: "请选择状态" }]}>
                      <Select options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} />
                    </Form.Item>
                  </Col>
                </Row>
              </FormSection>
            </Col>

            <Col span={24}>
              <FormSection title="连接信息" description={kafkaMode ? "Kafka 只需配置 Broker 地址和预览消费参数。" : apiMode ? "API 数据源只配置公共访问地址，接口路径、认证和请求参数在接入任务中配置。" : ftpMode ? "FTP 连接需要登录账号、根目录和文件预览参数。" : "数据库支持主机端口模式，也支持直接填写 JDBC URL。"}>
                {currentDatabaseCapability ? (
                  <Alert
                    style={{ marginBottom: 16 }}
                    type={currentDatabaseCapability.driverLoaded && currentDatabaseCapability.dataxReaderReady && currentDatabaseCapability.dataxWriterReady ? "success" : "error"}
                    showIcon
                    message={`查询驱动${currentDatabaseCapability.driverLoaded ? "已就绪" : "缺失"}，DataX 读取${currentDatabaseCapability.dataxReaderReady ? "已就绪" : "缺失"}，DataX 写入${currentDatabaseCapability.dataxWriterReady ? "已就绪" : "缺失"}`}
                  />
                ) : null}
                <Row gutter={16}>
                  {kafkaMode ? (
                    <>
                      <Col span={24}>
                        <Form.Item name="bootstrapServers" label="Bootstrap Servers" rules={[{ required: true, message: "请输入 Kafka Broker 地址" }]}>
                          <Input placeholder="例如：117.72.72.113:39092，多个地址用英文逗号分隔" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="clientId" label="客户端标识">
                          <Input placeholder="medata-ingestion-preview" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="topicPattern" label="Topic 过滤">
                          <Input placeholder="可选，按名称包含过滤" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="fromBeginning" label="消息预览起点" valuePropName="checked">
                          <Switch checkedChildren="从头读取" unCheckedChildren="只读新消息" />
                        </Form.Item>
                      </Col>
                    </>
                  ) : apiMode ? (
                    <>
                      <Col span={16}>
                        <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true, message: "请输入 API Base URL" }]}>
                          <Input placeholder="例如：http://127.0.0.1:45121" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="timeoutMs" label="超时时间">
                          <Select
                            options={[
                              { value: 10000, label: "10 秒" },
                              { value: 30000, label: "30 秒" },
                              { value: 60000, label: "60 秒" },
                              { value: 120000, label: "120 秒" },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={24}>
                        <Alert
                          type="info"
                          showIcon
                          message="接口路径、认证方式、请求头、Query 参数和 Body 参数请在数据接入任务中配置。"
                        />
                      </Col>
                    </>
                  ) : (
                    <>
                      <Col span={12}>
                        <Form.Item name="host" label="主机地址" rules={jdbcMode ? [] : [{ required: true, message: "请输入主机地址" }]}>
                          <Input placeholder="例如：127.0.0.1" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="port" label="端口" rules={jdbcMode ? [] : [{ required: true, message: "请输入端口" }]}>
                          <Input type="number" />
                        </Form.Item>
                      </Col>
                      {ftpMode ? (
                        <>
                          <Col span={12}>
                            <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
                              <Input />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
                              <Input.Password />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="rootPath" label="根目录" rules={[{ required: true, message: "请输入 FTP 根目录" }]}>
                              <Input placeholder="/upload" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="encoding" label="文件编码">
                              <Select options={[{ value: "utf8", label: "UTF-8" }, { value: "gb18030", label: "GB18030" }, { value: "gbk", label: "GBK" }]} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="maxPreviewBytes" label="单文件预览上限">
                              <Select options={[524288, 1048576, 2097152, 5242880].map((value) => ({ value, label: `${Math.round(value / 1024 / 1024 * 10) / 10} MB` }))} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="passiveMode" label="被动模式" valuePropName="checked">
                              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                            </Form.Item>
                          </Col>
                        </>
                      ) : (
                        <>
                          <Col span={12}>
                            <Form.Item name="databaseName" label={oracleMode ? (currentConnectionMode === "sid" ? "SID" : "Service Name") : "数据库"}>
                              <Input />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="username" label="用户名">
                              <Input />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="password" label="密码">
                              <Input.Password />
                            </Form.Item>
                          </Col>
                        </>
                      )}
                    </>
                  )}
                  {advancedJdbcMode ? (
                    <>
                      {oracleMode ? (
                        <Col span={12}>
                          <Form.Item name="connectionMode" label="Oracle 连接方式">
                            <Select options={[{ value: "serviceName", label: "Service Name" }, { value: "sid", label: "SID" }]} />
                          </Form.Item>
                        </Col>
                      ) : null}
                      <Col span={24}>
                        <Form.Item name="jdbcUrl" label="JDBC URL" rules={jdbcMode ? [{ required: true, message: "请输入 JDBC URL" }] : []}>
                          <Input placeholder={oracleMode ? "jdbc:oracle:thin:@//host:1521/service" : dmMode ? "jdbc:dm://host:5236/database" : "jdbc:postgresql://host:5432/db"} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="schema" label="Schema">
                          <Input placeholder="public" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="driverClassName" label="Driver Class">
                          <Input placeholder={oracleMode ? "oracle.jdbc.OracleDriver" : dmMode ? "dm.jdbc.driver.DmDriver" : "org.postgresql.Driver"} />
                        </Form.Item>
                      </Col>
                    </>
                  ) : null}
                </Row>
                {testResult ? <Alert message={testResult.message} type={testResult.success ? "success" : "error"} showIcon /> : null}
              </FormSection>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        open={taskModalOpen}
        title={`引用任务列表${selectedDataSource ? ` - ${selectedDataSource.sourceName}` : ""}`}
        footer={null}
        onCancel={() => {
          setTaskModalOpen(false);
          setSelectedDataSource(null);
          setReferencedTasks([]);
        }}
        width={1240}
      >
        <Table
          rowKey="id"
          className="app-table"
          columns={referencedTaskColumns}
          dataSource={referencedTasks}
          loading={tasksLoading}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ x: 1320 }}
          locale={{ emptyText: "当前数据源暂无引用任务" }}
        />
      </Modal>

      <Modal
        open={previewModalOpen}
        title={`${getPreviewObjectLabel(previewDataSource)}数据预览${previewDataSource ? ` - ${previewDataSource.sourceName}` : ""}`}
        footer={null}
        onCancel={() => {
          setPreviewModalOpen(false);
          setPreviewDataSource(null);
          setPreviewTables([]);
          setPreviewTableName("");
          setPreviewColumns([]);
          setPreviewRows([]);
          setPreviewDirectory("/");
          setPreviewDetailType(null);
        }}
        width={1480}
      >
        {renderPreviewBrowser()}
      </Modal>

      <Modal
        open={Boolean(previewDetailType)}
        title={getPreviewDetailTitle()}
        footer={previewDetailType === "sample" ? (
          <Button onClick={handleExportPreviewCsv} disabled={!previewRows.length}>
            导出 CSV
          </Button>
        ) : null}
        onCancel={() => setPreviewDetailType(null)}
        width={previewDetailType === "properties" ? 920 : 1180}
      >
        {renderPreviewDetailContent()}
      </Modal>

    </div>
  );
}
