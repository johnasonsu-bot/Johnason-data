import {
  AutoComplete,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
  Upload,
  message
} from "antd";
import { EyeOutlined, InfoCircleOutlined, UploadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  createTask,
  fetchTasks,
  fetchTaskById,
  parseApiDocument,
  previewIngestionSource,
  recommendTaskConfig,
  updateTask,
  type ApiDocumentParserProposal
} from "../../services/ingestionTask";
import {
  fetchDataSourceColumns,
  fetchDataSourceTables,
  fetchDataSources
} from "../../services/platform";
import type {
  DataSourceColumn,
  DataSourceRecord,
  DataSourceTable,
  FieldMapping,
  IngestionTask,
  IngestionWriteMode
} from "../../types/api";
import { inferDatasourceDialect } from "../../utils/datasource";
import { inferTargetTableMode, type TargetTableMode } from "./task-target-mode";

type BusinessScheduleType = "manual" | "interval" | "daily" | "weekly" | "monthly" | "cron";
type IncrementalMode = "timestamp" | "id";

type MappingRow = FieldMapping & {
  enabled: boolean;
  sourceComment?: string;
  isCustom?: boolean;
  autoInferredType?: boolean;
  customRuleType?: CustomRuleType;
  customValue?: string;
  customSourceFields?: string[];
};

type CustomRuleType =
  | "none"
  | "current_time"
  | "random_md5"
  | "primary_key_md5"
  | "business_field_md5"
  | "custom_value";

type TaskFormValues = {
  taskName?: string;
  taskCode?: string;
  ownerName?: string;
  description?: string;
  status?: IngestionTask["status"];
  sourceId?: number;
  sourceTable?: string;
  targetSourceId?: number;
  targetTable?: string;
  targetTableMode?: TargetTableMode;
  syncMode?: IngestionTask["syncMode"];
  writeMode?: IngestionWriteMode;
  incrementalMode?: IncrementalMode;
  cursorColumn?: string;
  startValue?: string;
  cdcColumns?: string;
  scheduleType?: BusinessScheduleType;
  intervalSeconds?: number;
  cronExpression?: string;
  runTime?: string;
  weekDays?: number[];
  monthDay?: number;
  timezone?: string;
  dependencyTaskIds?: number[];
  retryCount?: number;
  retryIntervalSeconds?: number;
  kafkaConsumerGroupId?: string;
  kafkaStartMode?: "latest" | "earliest" | "stored";
  kafkaBatchSize?: number;
  kafkaMaxWaitSeconds?: number;
  kafkaMessageFormat?: "json" | "text" | "csv" | "txt";
  kafkaJsonRootPath?: string;
  ftpPathMode?: "directory" | "file";
  ftpRecursive?: boolean;
  ftpMaxDepth?: number;
  ftpFilePattern?: string;
  ftpExcludePattern?: string;
  ftpBatchFileLimit?: number;
  ftpStabilitySeconds?: number;
  ftpPostProcessAction?: "keep" | "delete" | "archive";
  ftpArchiveDir?: string;
  apiMethod?: "GET" | "POST" | "PUT" | "PATCH";
  apiContentType?: "application/json" | "application/x-www-form-urlencoded" | "text/plain";
  apiAuthType?: "none" | "bearer" | "basic" | "api_key";
  apiBearerToken?: string;
  apiAuthUsername?: string;
  apiAuthPassword?: string;
  apiKeyIn?: "header" | "query" | "body";
  apiKeyName?: string;
  apiKeyValue?: string;
  apiParams?: ApiRequestParam[];
  apiParamDatasetEnabled?: boolean;
  apiParamDatasetSourceId?: number;
  apiParamDatasetSql?: string;
  apiParamDatasetLimit?: number;
  apiParamDatasetMode?: "loop" | "bulk";
  apiParamDatasetPayloadKey?: string;
  apiBodyType?: "json" | "form" | "text" | "none";
  apiBodyTemplate?: string;
  apiRecordPath?: string;
  apiPaginationType?: "none" | "page" | "offset" | "cursor";
  apiPaginationInjectInto?: "query" | "header" | "body";
  apiPageParam?: string;
  apiPageSizeParam?: string;
  apiOffsetParam?: string;
  apiLimitParam?: string;
  apiCursorParam?: string;
  apiNextCursorPath?: string;
  apiPageSize?: number;
  apiStartPage?: number;
  apiMaxPages?: number;
  apiCursorField?: string;
  apiStartValue?: string;
  apiIncrementalStartParam?: string;
  apiIncrementalEndParam?: string;
  apiIncrementalInjectInto?: "query" | "header" | "body";
  apiSuccessStatusCodes?: string;
  apiRetryStatusCodes?: string;
  fileType?: "txt" | "csv" | "xls" | "xlsx" | "json" | "xml";
  fileEncoding?: string;
  fileDelimiter?: string;
  fileHeaderRowNumber?: number;
  fileFirstDataRowNumber?: number;
  fileFieldNameMode?: "header" | "generated";
  jsonRootPath?: string;
  xmlRowPath?: string;
  skipErrorRows?: boolean;
};

type ApiRequestParam = {
  enabled?: boolean;
  location?: "header" | "query" | "body";
  name?: string;
  value?: string;
  valueMode?: "custom" | "system" | "dataset" | "checkpoint";
  systemKey?: "now" | "today" | "yesterday" | "timestamp" | "value_range";
  checkpointKey?: "last_cursor" | "last_success_time";
  systemFormat?: string;
  systemOffsetAmount?: number;
  systemOffsetUnit?: "minute" | "hour" | "day" | "month";
  rangeStart?: string;
  rangeEnd?: string;
  datasetField?: string;
  valueType?: "text" | "number" | "boolean" | "datetime";
  description?: string;
};

type AiRecommendFormValues = {
  sourceId?: number;
  sourceTable?: string;
  targetSourceId?: number;
};

type SourcePreviewResult = {
  sourceName: string;
  sourceType: string;
  sourceTable: string;
  rows: Array<Record<string, unknown>>;
  totalPreviewRows: number;
};

type ApiConfigSummary = {
  method: string;
  authType: string;
  paginationType: string;
  syncMode: string;
  paramCount: number;
};

const compactItemStyle: CSSProperties = { marginBottom: 12 };
const compactControlStyle: CSSProperties = { width: "100%" };
const wideControlStyle: CSSProperties = { width: "100%" };
const ftpObjectTypeLabel: Record<string, string> = {
  directory: "目录",
  file: "文件"
};
const defaultInitialValues: TaskFormValues = {
  syncMode: "full",
  status: "draft",
  targetTableMode: "existing",
  writeMode: "append",
  scheduleType: "manual",
  incrementalMode: "timestamp",
  startValue: "1970-01-01 00:00:00",
  timezone: "Asia/Shanghai",
  retryCount: 0,
  retryIntervalSeconds: 60,
  kafkaStartMode: "latest",
  kafkaBatchSize: 100,
  kafkaMaxWaitSeconds: 10,
  kafkaMessageFormat: "json",
  ftpPathMode: "directory",
  ftpRecursive: true,
  ftpMaxDepth: 3,
  ftpFilePattern: "*.txt",
  ftpExcludePattern: "\\.(tmp|writing)$",
  ftpBatchFileLimit: 20,
  ftpStabilitySeconds: 0,
  ftpPostProcessAction: "keep",
  apiMethod: "GET",
  apiContentType: "application/json",
  apiAuthType: "none",
  apiKeyIn: "header",
  apiBodyType: "json",
  apiParams: [],
  apiParamDatasetEnabled: false,
  apiParamDatasetLimit: 20,
  apiParamDatasetMode: "loop",
  apiParamDatasetPayloadKey: "items",
  apiRecordPath: "data",
  apiPaginationType: "none",
  apiPaginationInjectInto: "query",
  apiPageParam: "page",
  apiPageSizeParam: "pageSize",
  apiOffsetParam: "offset",
  apiLimitParam: "limit",
  apiCursorParam: "cursor",
  apiPageSize: 100,
  apiStartPage: 1,
  apiMaxPages: 100,
  apiIncrementalStartParam: "startTime",
  apiIncrementalEndParam: "endTime",
  apiIncrementalInjectInto: "query",
  apiSuccessStatusCodes: "200",
  apiRetryStatusCodes: "429,500,502,503,504",
  fileType: "txt",
  fileEncoding: "utf8",
  fileHeaderRowNumber: 1,
  fileFirstDataRowNumber: 2,
  fileFieldNameMode: "header",
  skipErrorRows: true
};

const defaultApiConfigSummary: ApiConfigSummary = {
  method: "GET",
  authType: "none",
  paginationType: "none",
  syncMode: "full",
  paramCount: 0,
};

const weekDayOptions = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 0, label: "周日" }
];

const customRuleOptions = [
  { value: "none", label: "直接映射/不设置" },
  { value: "current_time", label: "当前系统时间" },
  { value: "random_md5", label: "随机MD5值" },
  { value: "primary_key_md5", label: "主键MD5值" },
  { value: "business_field_md5", label: "业务字段MD5值" },
  { value: "custom_value", label: "自定义值" }
] as const;

const customDataTypeOptions = [
  "varchar(255)",
  "varchar(64)",
  "varchar(32)",
  "char(32)",
  "text",
  "bigint",
  "int",
  "decimal(18,2)",
  "datetime",
  "timestamp",
  "date",
  "tinyint"
].map((value) => ({ value, label: value }));

const editableDataTypeOptions = [
  "text",
  "varchar(255)",
  "varchar(128)",
  "varchar(64)",
  "varchar(32)",
  "char(32)",
  "bigint",
  "integer",
  "int",
  "smallint",
  "numeric(18,2)",
  "decimal(18,2)",
  "timestamp",
  "datetime",
  "date",
  "time",
  "boolean",
  "jsonb",
  "json",
  "bytea",
  "string"
].map((value) => ({ value, label: value }));

function normalizeApiParamList(value: unknown, location: ApiRequestParam["location"]): ApiRequestParam[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        enabled: item?.enabled !== false,
        location: (item?.location || item?.in || location) as ApiRequestParam["location"],
        name: String(item?.name || item?.key || "").trim(),
        value: item?.value === undefined || item?.value === null ? "" : String(item.value),
        valueMode: (item?.valueMode || "custom") as ApiRequestParam["valueMode"],
        systemKey: item?.systemKey as ApiRequestParam["systemKey"],
        checkpointKey: (item?.checkpointKey || "last_cursor") as ApiRequestParam["checkpointKey"],
        systemFormat: String(item?.systemFormat || ""),
        systemOffsetAmount: Number(item?.systemOffsetAmount || 0),
        systemOffsetUnit: (item?.systemOffsetUnit || "day") as ApiRequestParam["systemOffsetUnit"],
        rangeStart: item?.rangeStart === undefined || item?.rangeStart === null ? "" : String(item.rangeStart),
        rangeEnd: item?.rangeEnd === undefined || item?.rangeEnd === null ? "" : String(item.rangeEnd),
        datasetField: String(item?.datasetField || ""),
        valueType: (item?.valueType || item?.type || "text") as ApiRequestParam["valueType"],
        description: String(item?.description || ""),
      }))
      .filter((item) => item.name);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([name, itemValue]) => ({
      enabled: true,
      location,
      name,
      value: itemValue === undefined || itemValue === null ? "" : String(itemValue),
      valueMode: "custom",
      valueType: "text",
      description: "",
    }));
  }
  return [];
}

function buildApiParamList(sourceConfig: Record<string, any> = {}): ApiRequestParam[] {
  const params = [
    ...normalizeApiParamList(sourceConfig.headers, "header"),
    ...normalizeApiParamList(sourceConfig.queryParams, "query"),
    ...normalizeApiParamList(sourceConfig.bodyParams, "body"),
  ];
  const incremental = sourceConfig.incremental || {};
  if (incremental.enabled) {
    const injectLocation = (incremental.injectInto || "query") as ApiRequestParam["location"];
    const startParam = String(incremental.startParam || "").trim();
    const endParam = String(incremental.endParam || "").trim();
    const hasParam = (name: string) => params.some((item) => item.location === injectLocation && item.name === name);
    if (startParam && !hasParam(startParam)) {
      params.push({
        enabled: true,
        location: injectLocation,
        name: startParam,
        valueMode: "checkpoint",
        checkpointKey: "last_cursor",
        valueType: "datetime",
        description: "增量同步起始位点",
      });
    }
    if (endParam && !hasParam(endParam)) {
      params.push({
        enabled: true,
        location: injectLocation,
        name: endParam,
        valueMode: "system",
        systemKey: "now",
        systemFormat: "YYYY-MM-DD HH:mm:ss",
        systemOffsetUnit: "day",
        valueType: "datetime",
        description: "增量同步结束时间",
      });
    }
  }
  return params;
}

function splitApiParams(params: ApiRequestParam[] = []) {
  const result = {
    headers: [] as Array<Record<string, unknown>>,
    queryParams: [] as Array<Record<string, unknown>>,
    bodyParams: [] as Array<Record<string, unknown>>,
  };
  for (const item of params || []) {
    const name = String(item?.name || "").trim();
    if (!name) continue;
    const normalized = {
      name,
      value: item?.value === undefined || item?.value === null ? "" : String(item.value),
      valueMode: item?.valueMode || "custom",
      systemKey: item?.systemKey || "",
      checkpointKey: item?.checkpointKey || "last_cursor",
      systemFormat: item?.systemFormat || "",
      systemOffsetAmount: Number(item?.systemOffsetAmount || 0),
      systemOffsetUnit: item?.systemOffsetUnit || "day",
      rangeStart: item?.rangeStart || "",
      rangeEnd: item?.rangeEnd || "",
      datasetField: item?.datasetField || "",
      enabled: item?.enabled !== false,
      valueType: item?.valueType || "text",
      description: item?.description || "",
    };
    if (item.location === "header") result.headers.push(normalized);
    else if (item.location === "body") result.bodyParams.push(normalized);
    else result.queryParams.push(normalized);
  }
  return result;
}

function parseApiStatusCodes(value: unknown, fallback: number[]) {
  const codes = String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 100 && item <= 599);
  return codes.length ? codes : fallback;
}

function buildApiAuthConfig(values: TaskFormValues) {
  const authType = values.apiAuthType || "none";
  if (authType === "bearer") {
    return { type: "bearer", bearerToken: values.apiBearerToken || "" };
  }
  if (authType === "basic") {
    return { type: "basic", username: values.apiAuthUsername || "", password: values.apiAuthPassword || "" };
  }
  if (authType === "api_key") {
    return {
      type: "api_key",
      apiKeyIn: values.apiKeyIn || "header",
      apiKeyName: values.apiKeyName || "",
      apiKeyValue: values.apiKeyValue || "",
    };
  }
  return { type: "none" };
}

function normalizeTargetSourceType(
  targetSourceType?: string,
  connectionConfig?: DataSourceRecord["connectionConfig"]
) {
  const dialect = inferDatasourceDialect(targetSourceType, connectionConfig || {});
  if (dialect && dialect !== "unknown") {
    return dialect;
  }
  const normalized = String(targetSourceType || "").trim().toLowerCase();
  return normalized === "postgres" ? "postgresql" : normalized;
}

function getTargetTextType(
  targetSourceType?: string,
  connectionConfig?: DataSourceRecord["connectionConfig"]
) {
  return normalizeTargetSourceType(targetSourceType, connectionConfig) === "hive" ? "string" : "text";
}

function suggestTargetDataType(
  column: DataSourceColumn,
  targetSourceType?: string,
  connectionConfig?: DataSourceRecord["connectionConfig"]
) {
  const normalizedTargetType = normalizeTargetSourceType(targetSourceType, connectionConfig);
  const rawType = String(column.columnType || column.dataType || "").trim();
  const lowered = rawType.toLowerCase();

  if (!rawType) {
    return getTargetTextType(normalizedTargetType, connectionConfig);
  }

  if (normalizedTargetType === "postgresql") {
    if (/(enum|set)/.test(lowered)) return "text";
    if (/(varchar|character varying|char)/.test(lowered)) return rawType;
    if (/(bigint)/.test(lowered)) return /unsigned/.test(lowered) ? "numeric(20,0)" : "bigint";
    if (/(mediumint|int|integer)/.test(lowered)) return /unsigned/.test(lowered) ? "bigint" : "integer";
    if (/(smallint|tinyint)/.test(lowered)) return /unsigned/.test(lowered) ? "integer" : "smallint";
    if (/(decimal|numeric)/.test(lowered)) return rawType.replace(/decimal/ig, "numeric");
    if (/(double precision|double)/.test(lowered)) return "double precision";
    if (/(float|real)/.test(lowered)) return "real";
    if (/(datetime|timestamp)/.test(lowered)) return "timestamp";
    if (/(date)/.test(lowered)) return "date";
    if (/(time)/.test(lowered)) return "time";
    if (/(json)/.test(lowered)) return "jsonb";
    if (/(blob|binary|varbinary)/.test(lowered)) return "bytea";
    if (/(bool|boolean|bit)/.test(lowered)) return "boolean";
    if (/(text|clob)/.test(lowered)) return "text";
    return "text";
  }

  if (normalizedTargetType === "hive") {
    if (/(bigint)/.test(lowered)) return "bigint";
    if (/(int|integer|smallint|tinyint)/.test(lowered)) return "int";
    if (/(decimal|numeric)/.test(lowered)) return "decimal(18,2)";
    if (/(double|float|real)/.test(lowered)) return "double";
    if (/(date)/.test(lowered)) return "date";
    if (/(datetime|timestamp|time)/.test(lowered)) return "timestamp";
    return "string";
  }

  if (normalizedTargetType === "mysql") {
    if (/(enum|set)/.test(lowered)) return "text";
    return rawType;
  }

  return getTargetTextType(normalizedTargetType, connectionConfig);
}

function normalizeMappingDataType(
  value: string | undefined,
  targetSourceType?: string,
  connectionConfig?: DataSourceRecord["connectionConfig"]
) {
  const rawType = String(value || "").trim();
  if (!rawType) {
    return getTargetTextType(targetSourceType, connectionConfig);
  }
  return suggestTargetDataType(
    {
      columnName: "",
      ordinalPosition: 0,
      dataType: rawType,
      columnType: rawType,
      isNullable: true,
      isPrimaryKey: false,
    },
    targetSourceType,
    connectionConfig
  );
}

function formatPreviewCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function formatFileSize(value?: number) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function inferPreviewColumnType(values: unknown[]) {
  const samples = values.filter((value) => value !== null && value !== undefined);
  if (samples.length === 0) return "text";
  if (samples.every((value) => typeof value === "boolean")) return "boolean";
  if (samples.every((value) => typeof value === "number")) {
    return samples.every((value) => Number.isInteger(value)) ? "bigint" : "double";
  }
  if (samples.every((value) => typeof value === "object")) return "json";

  const stringSamples = samples.map((value) => String(value).trim()).filter(Boolean);
  if (
    stringSamples.length > 0 &&
    stringSamples.every((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
  ) {
    return "date";
  }
  if (
    stringSamples.length > 0 &&
    stringSamples.every((value) => /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(value))
  ) {
    return "timestamp";
  }

  return "text";
}

function inferColumnsFromPreviewRows(
  rows: Array<Record<string, unknown>>,
  existingColumns: DataSourceColumn[]
) {
  const columnNames = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );
  const existingColumnMap = new Map(existingColumns.map((column) => [column.columnName, column] as const));

  return columnNames.map<DataSourceColumn>((columnName, index) => {
    const existing = existingColumnMap.get(columnName);
    if (existing) {
      return { ...existing, ordinalPosition: index + 1 };
    }
    const inferredType = inferPreviewColumnType(rows.map((row) => row?.[columnName]));
    return {
      columnName,
      ordinalPosition: index + 1,
      dataType: inferredType,
      columnType: inferredType,
      isNullable: rows.some((row) => row?.[columnName] === null || row?.[columnName] === undefined),
      isPrimaryKey: false,
      columnComment: "",
    };
  });
}

function buildSourceColumnsFromMappings(mappings: MappingRow[]): DataSourceColumn[] {
  const seen = new Set<string>();
  return mappings
    .filter((item) => item.sourceField && !item.isCustom && !String(item.sourceField).startsWith("__custom_"))
    .filter((item) => {
      if (seen.has(item.sourceField)) return false;
      seen.add(item.sourceField);
      return true;
    })
    .map((item, index) => {
      const dataType = item.dataType || "text";
      return {
        columnName: item.sourceField,
        ordinalPosition: index + 1,
        dataType,
        columnType: dataType,
        isNullable: true,
        isPrimaryKey: Boolean(item.isPrimaryKey),
        columnComment: item.sourceComment || "",
      };
    });
}

export function TaskConfigPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const [form] = Form.useForm<TaskFormValues>();
  const [aiRecommendForm] = Form.useForm<AiRecommendFormValues>();

  const sourceId = Form.useWatch("sourceId", form);
  const sourceTable = Form.useWatch("sourceTable", form);
  const targetSourceId = Form.useWatch("targetSourceId", form);
  const targetTable = Form.useWatch("targetTable", form);
  const targetTableMode = Form.useWatch("targetTableMode", form) || "existing";
  const syncMode = Form.useWatch("syncMode", form) || "full";
  const incrementalMode = Form.useWatch("incrementalMode", form) || "timestamp";
  const scheduleType = Form.useWatch("scheduleType", form) || "manual";
  const apiBodyType = Form.useWatch("apiBodyType", form) || "json";
  const apiMethod = Form.useWatch("apiMethod", form) || "GET";
  const apiPaginationType = Form.useWatch("apiPaginationType", form) || "none";
  const apiAuthType = Form.useWatch("apiAuthType", form) || "none";
  const apiParamDatasetEnabled = Form.useWatch("apiParamDatasetEnabled", form);

  const [submitting, setSubmitting] = useState(false);
  const [aiRecommending, setAiRecommending] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [dataSources, setDataSources] = useState<DataSourceRecord[]>([]);
  const [sourceTables, setSourceTables] = useState<DataSourceTable[]>([]);
  const [aiSourceTables, setAiSourceTables] = useState<DataSourceTable[]>([]);
  const [targetTables, setTargetTables] = useState<DataSourceTable[]>([]);
  const [sourceColumns, setSourceColumns] = useState<DataSourceColumn[]>([]);
  const [targetColumns, setTargetColumns] = useState<DataSourceColumn[]>([]);
  const [fieldMappings, setFieldMappings] = useState<MappingRow[]>([]);
  const [taskOptions, setTaskOptions] = useState<IngestionTask[]>([]);
  const [activeDataTypeDropdownIndex, setActiveDataTypeDropdownIndex] = useState<number | null>(null);
  const [aiRecommendLogs, setAiRecommendLogs] = useState<string[]>([]);
  const [aiRecommendReasoning, setAiRecommendReasoning] = useState<string[]>([]);
  const [aiSourceId, setAiSourceId] = useState<number | undefined>();
  const [currentTask, setCurrentTask] = useState<IngestionTask | null>(null);
  const [sourcePreviewOpen, setSourcePreviewOpen] = useState(false);
  const [sourcePreviewLoading, setSourcePreviewLoading] = useState(false);
  const [sourcePreviewResult, setSourcePreviewResult] = useState<SourcePreviewResult | null>(null);
  const [ftpObjectPickerOpen, setFtpObjectPickerOpen] = useState(false);
  const [ftpObjectSearch, setFtpObjectSearch] = useState("");
  const [apiBasicModalOpen, setApiBasicModalOpen] = useState(false);
  const [apiParamsModalOpen, setApiParamsModalOpen] = useState(false);
  const [apiStrategyModalOpen, setApiStrategyModalOpen] = useState(false);
  const [apiConfigSummary, setApiConfigSummary] = useState<ApiConfigSummary>(defaultApiConfigSummary);
  const [apiDocumentModalOpen, setApiDocumentModalOpen] = useState(false);
  const [apiDocumentParsing, setApiDocumentParsing] = useState(false);
  const [apiDocumentInput, setApiDocumentInput] = useState("");
  const [apiDocumentFile, setApiDocumentFile] = useState<File | null>(null);
  const [apiDocumentProposal, setApiDocumentProposal] = useState<ApiDocumentParserProposal | null>(null);
  const apiMappingLockedRef = useRef(false);

  function refreshApiConfigSummary() {
    setApiConfigSummary({
      method: form.getFieldValue("apiMethod") || "GET",
      authType: form.getFieldValue("apiAuthType") || "none",
      paginationType: form.getFieldValue("apiPaginationType") || "none",
      syncMode: form.getFieldValue("syncMode") || "full",
      paramCount: (form.getFieldValue("apiParams") || []).length,
    });
  }

  function openApiDocumentParser() {
    if (!sourceId || !isApiSource) {
      message.warning("请先选择 API 类型来源数据源");
      return;
    }
    setApiDocumentModalOpen(true);
  }

  async function handleParseApiDocument() {
    if (!token || !sourceId) return;
    if (!apiDocumentInput.trim() && !apiDocumentFile) {
      message.warning("请输入接口调用说明或上传接口文档");
      return;
    }
    setApiDocumentParsing(true);
    try {
      const response = await parseApiDocument(token, {
        sourceId,
        inputText: apiDocumentInput,
        file: apiDocumentFile,
      });
      setApiDocumentProposal(response.data.proposal);
      message.success("已生成接口参数配置方案，请核对后确认回填");
    } catch (error: any) {
      message.error(error?.message || "接口文档解析失败");
    } finally {
      setApiDocumentParsing(false);
    }
  }

  function applyApiDocumentProposal() {
    if (!apiDocumentProposal) return;
    const sourceConfig = apiDocumentProposal.sourceConfig || {};
    const auth = sourceConfig.auth || {};
    const toFormParams = (items: any[], location: ApiRequestParam["location"]): ApiRequestParam[] =>
      (Array.isArray(items) ? items : []).map((item) => ({
        ...item,
        location,
        value: item?.value === undefined ? "" : String(item.value),
        valueMode: item?.valueMode || "custom",
        valueType: item?.valueType || "text",
      }));
    const pagination = sourceConfig.pagination || {};
    const incremental = sourceConfig.incremental || {};
    const parseConfig = apiDocumentProposal.parseConfig || {};
    const errorConfig = apiDocumentProposal.errorConfig || {};
    form.setFieldsValue({
      sourceTable: sourceConfig.endpointPath || form.getFieldValue("sourceTable"),
      apiMethod: sourceConfig.method || "GET",
      apiContentType: sourceConfig.contentType || "application/json",
      apiAuthType: auth.authType || auth.type || "none",
      apiBearerToken: auth.bearerToken || "",
      apiAuthUsername: auth.username || "",
      apiAuthPassword: auth.password || "",
      apiKeyIn: auth.apiKeyIn || "header",
      apiKeyName: auth.apiKeyName || "",
      apiKeyValue: auth.apiKeyValue || "",
      apiBodyType: sourceConfig.bodyType || "json",
      apiBodyTemplate: sourceConfig.bodyTemplate || "",
      apiParams: [
        ...toFormParams(sourceConfig.headers, "header"),
        ...toFormParams(sourceConfig.queryParams, "query"),
        ...toFormParams(sourceConfig.bodyParams, "body"),
      ],
      apiRecordPath: parseConfig.recordPath ?? "",
      apiPaginationType: pagination.type || "none",
      apiPaginationInjectInto: pagination.injectInto || "query",
      apiPageParam: pagination.pageParam || "page",
      apiPageSizeParam: pagination.pageSizeParam || "pageSize",
      apiOffsetParam: pagination.offsetParam || "offset",
      apiLimitParam: pagination.limitParam || "limit",
      apiCursorParam: pagination.cursorParam || "cursor",
      apiNextCursorPath: pagination.nextCursorPath || "",
      apiPageSize: pagination.pageSize || 100,
      apiStartPage: pagination.startPage ?? 1,
      apiMaxPages: pagination.maxPages || 100,
      syncMode: incremental.enabled ? "incremental" : "full",
      apiCursorField: incremental.cursorField || "",
      apiStartValue: incremental.startValue || "",
      apiIncrementalStartParam: incremental.startParam || "startTime",
      apiIncrementalEndParam: incremental.endParam ?? "",
      apiIncrementalInjectInto: incremental.injectInto || "query",
      skipErrorRows: parseConfig.skipErrorRows !== false,
      apiSuccessStatusCodes: Array.isArray(errorConfig.successStatusCodes) ? errorConfig.successStatusCodes.join(",") : "200",
      apiRetryStatusCodes: Array.isArray(errorConfig.retryStatusCodes) ? errorConfig.retryStatusCodes.join(",") : "429,500,502,503,504",
      retryCount: errorConfig.maxRetries ?? form.getFieldValue("retryCount"),
      retryIntervalSeconds: errorConfig.retryIntervalMs ? Math.max(1, Math.round(Number(errorConfig.retryIntervalMs) / 1000)) : form.getFieldValue("retryIntervalSeconds"),
    });
    refreshApiConfigSummary();
    setApiDocumentModalOpen(false);
    message.success("方案已回填。请通过“预览”验证接口响应后再保存任务。");
  }

  const sourceRecord = useMemo(
    () => dataSources.find((item) => item.id === sourceId),
    [dataSources, sourceId]
  );
  const sourceType = useMemo(
    () => normalizeTargetSourceType(sourceRecord?.sourceType, sourceRecord?.connectionConfig),
    [sourceRecord]
  );
  const isKafkaSource = sourceType === "kafka";
  const isFtpSource = sourceType === "ftp";
  const isApiSource = sourceType === "api";
  const isStreamSource = isKafkaSource || isFtpSource || isApiSource;

  const targetSourceRecord = useMemo(
    () => dataSources.find((item) => item.id === targetSourceId),
    [dataSources, targetSourceId]
  );
  const targetSourceType = useMemo(
    () => normalizeTargetSourceType(targetSourceRecord?.sourceType, targetSourceRecord?.connectionConfig),
    [targetSourceRecord]
  );
  const aiSourceRecord = useMemo(
    () => dataSources.find((item) => item.id === aiSourceId),
    [dataSources, aiSourceId]
  );
  const aiSourceType = useMemo(
    () => normalizeTargetSourceType(aiSourceRecord?.sourceType, aiSourceRecord?.connectionConfig),
    [aiSourceRecord]
  );
  const dependencyTaskOptions = useMemo(
    () =>
      taskOptions.map((item) => ({
        value: item.id,
        label: `${item.taskName} (${item.taskCode})`,
        disabled: item.id === taskId
      })),
    [taskId, taskOptions]
  );
  const sourcePreviewColumns = useMemo<ColumnsType<Record<string, unknown>>>(() => {
    const rows = sourcePreviewResult?.rows || [];
    const keys = Array.from(rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()));
    return keys.map((key) => ({
      title: key,
      dataIndex: key,
      key,
      width: key === "_raw_value" ? 320 : 160,
      ellipsis: true,
      render: (value: unknown) => formatPreviewCell(value)
    }));
  }, [sourcePreviewResult]);
  const filteredFtpObjects = useMemo(() => {
    const keyword = ftpObjectSearch.trim().toLowerCase();
    if (!keyword) return sourceTables;
    return sourceTables.filter((item) => {
      const text = [
        item.tableName,
        item.tableComment,
        item.tableType,
        item.objectType
      ].filter(Boolean).join(" ").toLowerCase();
      return text.includes(keyword);
    });
  }, [ftpObjectSearch, sourceTables]);

  useEffect(() => {
    void loadSources();
  }, [token]);

  useEffect(() => {
    void loadTaskOptions();
  }, [token]);

  useEffect(() => {
    if (!sourceId) {
      setSourceTables([]);
      apiMappingLockedRef.current = false;
      return;
    }
    apiMappingLockedRef.current = isApiSource;

    void loadTables(sourceId, "source");
  }, [sourceId, sourceType, isApiSource]);

  useEffect(() => {
    if (!aiSourceId) {
      setAiSourceTables([]);
      return;
    }

    void loadTables(aiSourceId, "ai-source");
  }, [aiSourceId]);

  useEffect(() => {
    if (!targetSourceId) {
      setTargetTables([]);
      return;
    }

    void loadTables(targetSourceId, "target");
  }, [targetSourceId]);

  useEffect(() => {
    if (!sourceId || !sourceTable) {
      setSourceColumns([]);
      setFieldMappings([]);
      return;
    }

    if (isApiSource || apiMappingLockedRef.current) {
      return;
    }

    void loadColumns(sourceId, sourceTable, "source");
  }, [sourceId, sourceTable, isApiSource]);

  useEffect(() => {
    if (targetTableMode !== "existing" || !targetSourceId || !targetTable) {
      setTargetColumns([]);
      if (isApiSource || apiMappingLockedRef.current) {
        return;
      }
      setFieldMappings((current) =>
        sourceColumns.length === 0 && current.length > 0
          ? current
          :
        buildMappings(
          sourceColumns,
          [],
          current,
          targetTableMode,
          targetSourceRecord?.sourceType || targetSourceType,
          targetSourceRecord?.connectionConfig
        )
      );
      return;
    }

    void loadColumns(targetSourceId, targetTable, "target");
  }, [targetSourceId, targetTable, targetTableMode, sourceColumns, isApiSource]);

  useEffect(() => {
    if (sourceColumns.length === 0) {
      return;
    }
    if (isApiSource || apiMappingLockedRef.current) {
      return;
    }
    setFieldMappings((current) =>
      buildMappings(
        sourceColumns,
        targetColumns,
        current,
        targetTableMode,
        targetSourceRecord?.sourceType || targetSourceType,
        targetSourceRecord?.connectionConfig
      )
    );
  }, [sourceColumns, targetColumns, targetSourceRecord, targetSourceType, targetTableMode, isApiSource]);

  useEffect(() => {
    if (!isEditMode || !id || dataSources.length === 0) {
      return;
    }

    void loadTask(Number(id));
  }, [dataSources.length, id, isEditMode]);

  async function loadSources() {
    if (!token) {
      return;
    }

    try {
      const res = await fetchDataSources(token);
      setDataSources(res.data.filter((item) => item.status === "active"));
    } catch (error: any) {
      message.error(`加载数据源失败: ${error.message || "未知错误"}`);
    }
  }

  async function loadTaskOptions() {
    if (!token) {
      return;
    }

    try {
      const res = await fetchTasks(token, {
        page: 1,
        pageSize: 1000
      });
      setTaskOptions(res.data || []);
    } catch (error: any) {
      message.error(`加载任务列表失败: ${error.message || "未知错误"}`);
    }
  }

  async function loadTables(dataSourceId: number, kind: "source" | "target" | "ai-source") {
    if (!token) {
      return;
    }

    try {
      const selectedSource = dataSources.find((item) => item.id === dataSourceId);
      const selectedType = normalizeTargetSourceType(selectedSource?.sourceType, selectedSource?.connectionConfig);
      const res = await fetchDataSourceTables(token, dataSourceId, {
        includeDirectories: (kind === "source" || kind === "ai-source") && selectedType === "ftp"
      });
      if (kind === "source") {
        setSourceTables(res.data);
      } else if (kind === "ai-source") {
        setAiSourceTables(res.data);
      } else {
        setTargetTables(res.data);
      }
    } catch (error: any) {
      message.error(`加载${kind === "source" ? "来源" : "目标"}表失败: ${error.message || "未知错误"}`);
    }
  }

  async function loadColumns(
    dataSourceId: number,
    tableName: string,
    kind: "source" | "target"
  ) {
    if (!token) {
      return;
    }

    try {
      const res = await fetchDataSourceColumns(token, dataSourceId, tableName);
      if (kind === "source") {
        setSourceColumns(res.data);
        setFieldMappings((current) =>
          buildMappings(
            res.data,
            targetColumns,
            current,
            targetTableMode,
            targetSourceRecord?.sourceType || targetSourceType,
            targetSourceRecord?.connectionConfig
          )
        );
      } else {
        setTargetColumns(res.data);
        if (isApiSource || apiMappingLockedRef.current) {
          return;
        }
        setFieldMappings((current) =>
          buildMappings(
            sourceColumns,
            res.data,
            current,
            targetTableMode,
            targetSourceRecord?.sourceType || targetSourceType,
            targetSourceRecord?.connectionConfig
          )
        );
      }
    } catch (error: any) {
      message.error(`加载${kind === "source" ? "来源" : "目标"}字段失败: ${error.message || "未知错误"}`);
    }
  }

  async function loadTask(currentId: number) {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetchTaskById(token, currentId);
      const task = res.data;
      setCurrentTask(task);
      setTaskId(task.id);
      const loadedSource = dataSources.find((source) => source.id === task.sourceId);
      apiMappingLockedRef.current = normalizeTargetSourceType(loadedSource?.sourceType || task.sourceType, loadedSource?.connectionConfig) === "api";

      const taskRuleMap = new Map(
        (task.transformRules || [])
          .filter((rule) => rule.transformType === "custom")
          .map((rule) => [rule.field, rule])
      );

      form.setFieldsValue({
        taskName: task.taskName,
        taskCode: task.taskCode,
        ownerName: task.ownerName,
        description: task.description,
        status: task.status === "running" ? "active" : task.status,
        sourceId: task.sourceId,
        sourceTable: task.sourceTable,
        targetSourceId: task.targetSourceId,
        targetTable: task.targetTable,
        targetTableMode: inferTargetTableMode(task),
        syncMode: (task.sourceType === "api" || normalizeTargetSourceType((task as any).sourceType, undefined) === "api") && (task.sourceConfig as any)?.incremental?.enabled
          ? "incremental"
          : task.syncMode,
        writeMode: task.targetConfig?.writeMode || "append",
        incrementalMode: task.incrementalConfig?.mode === "id" ? "id" : "timestamp",
        cursorColumn:
          task.incrementalConfig?.cursorColumn ||
          task.incrementalConfig?.timestampColumn ||
          task.incrementalConfig?.idColumn,
        startValue:
          task.incrementalConfig?.startValue === null ||
          task.incrementalConfig?.startValue === undefined
            ? undefined
            : String(task.incrementalConfig.startValue),
        cdcColumns: task.incrementalConfig?.cdcColumns?.join(", "),
        scheduleType: resolveScheduleType(task.scheduleConfig),
        intervalSeconds: task.scheduleConfig?.intervalMs
          ? Math.floor(task.scheduleConfig.intervalMs / 1000)
          : undefined,
        cronExpression: task.scheduleConfig?.cronExpression,
        runTime: task.scheduleConfig?.runTime,
        weekDays: task.scheduleConfig?.weekDays,
        monthDay: task.scheduleConfig?.monthDay,
        timezone: task.scheduleConfig?.timezone || "Asia/Shanghai",
        dependencyTaskIds: task.scheduleConfig?.dependencyTaskIds || [],
        retryCount: task.scheduleConfig?.retryCount || 0,
        retryIntervalSeconds: task.scheduleConfig?.retryIntervalMs
          ? Math.floor(task.scheduleConfig.retryIntervalMs / 1000)
          : 60,
        kafkaConsumerGroupId: String((task.sourceConfig as any)?.consumerGroupId || ""),
        kafkaStartMode: ((task.sourceConfig as any)?.startMode as TaskFormValues["kafkaStartMode"]) || "latest",
        kafkaBatchSize: Number((task.sourceConfig as any)?.batchSize || 100),
        kafkaMaxWaitSeconds: Math.floor(Number((task.sourceConfig as any)?.maxWaitMs || 10000) / 1000),
        kafkaMessageFormat: ((task.parseConfig as any)?.messageFormat as TaskFormValues["kafkaMessageFormat"]) || "json",
        kafkaJsonRootPath: String((task.parseConfig as any)?.jsonRootPath || ""),
        apiMethod: ((task.sourceConfig as any)?.method as TaskFormValues["apiMethod"]) || "GET",
        apiContentType: ((task.sourceConfig as any)?.contentType as TaskFormValues["apiContentType"]) || "application/json",
        apiAuthType: ((task.sourceConfig as any)?.auth?.type || (task.sourceConfig as any)?.auth?.authType || "none") as TaskFormValues["apiAuthType"],
        apiBearerToken: String((task.sourceConfig as any)?.auth?.bearerToken || (task.sourceConfig as any)?.auth?.token || ""),
        apiAuthUsername: String((task.sourceConfig as any)?.auth?.username || ""),
        apiAuthPassword: String((task.sourceConfig as any)?.auth?.password || ""),
        apiKeyIn: ((task.sourceConfig as any)?.auth?.apiKeyIn || (task.sourceConfig as any)?.auth?.in || "header") as TaskFormValues["apiKeyIn"],
        apiKeyName: String((task.sourceConfig as any)?.auth?.apiKeyName || (task.sourceConfig as any)?.auth?.name || ""),
        apiKeyValue: String((task.sourceConfig as any)?.auth?.apiKeyValue || (task.sourceConfig as any)?.auth?.apiKey || ""),
        apiParams: buildApiParamList((task.sourceConfig || {}) as Record<string, any>),
        apiParamDatasetEnabled: Boolean((task.sourceConfig as any)?.parameterDataSet?.enabled),
        apiParamDatasetSourceId: Number((task.sourceConfig as any)?.parameterDataSet?.sourceId || 0) || undefined,
        apiParamDatasetSql: String((task.sourceConfig as any)?.parameterDataSet?.sql || ""),
        apiParamDatasetLimit: Number((task.sourceConfig as any)?.parameterDataSet?.limit || 20),
        apiParamDatasetMode: ((task.sourceConfig as any)?.parameterDataSet?.mode as TaskFormValues["apiParamDatasetMode"]) || "loop",
        apiParamDatasetPayloadKey: String((task.sourceConfig as any)?.parameterDataSet?.payloadKey || "items"),
        apiBodyType: ((task.sourceConfig as any)?.bodyType as TaskFormValues["apiBodyType"]) || "json",
        apiBodyTemplate: String((task.sourceConfig as any)?.bodyTemplate || ""),
        apiRecordPath: String((task.parseConfig as any)?.recordPath || "data"),
        apiPaginationType: ((task.sourceConfig as any)?.pagination?.type as TaskFormValues["apiPaginationType"]) || "none",
        apiPaginationInjectInto: ((task.sourceConfig as any)?.pagination?.injectInto as TaskFormValues["apiPaginationInjectInto"]) || "query",
        apiPageParam: String((task.sourceConfig as any)?.pagination?.pageParam || "page"),
        apiPageSizeParam: String((task.sourceConfig as any)?.pagination?.pageSizeParam || "pageSize"),
        apiOffsetParam: String((task.sourceConfig as any)?.pagination?.offsetParam || "offset"),
        apiLimitParam: String((task.sourceConfig as any)?.pagination?.limitParam || "limit"),
        apiCursorParam: String((task.sourceConfig as any)?.pagination?.cursorParam || "cursor"),
        apiNextCursorPath: String((task.sourceConfig as any)?.pagination?.nextCursorPath || ""),
        apiPageSize: Number((task.sourceConfig as any)?.pagination?.pageSize || 100),
        apiStartPage: Number((task.sourceConfig as any)?.pagination?.startPage || 1),
        apiMaxPages: Number((task.sourceConfig as any)?.pagination?.maxPages || 100),
        apiCursorField: String((task.sourceConfig as any)?.incremental?.cursorField || ""),
        apiStartValue: String((task.sourceConfig as any)?.incremental?.startValue || ""),
        apiIncrementalStartParam: String((task.sourceConfig as any)?.incremental?.startParam || "startTime"),
        apiIncrementalEndParam: String((task.sourceConfig as any)?.incremental?.endParam || "endTime"),
        apiIncrementalInjectInto: ((task.sourceConfig as any)?.incremental?.injectInto as TaskFormValues["apiIncrementalInjectInto"]) || "query",
        apiSuccessStatusCodes: Array.isArray((task.errorConfig as any)?.successStatusCodes) ? (task.errorConfig as any).successStatusCodes.join(",") : "200",
        apiRetryStatusCodes: Array.isArray((task.errorConfig as any)?.retryStatusCodes) ? (task.errorConfig as any).retryStatusCodes.join(",") : "429,500,502,503,504",
        ftpPathMode: ((task.sourceConfig as any)?.pathMode as TaskFormValues["ftpPathMode"]) || "directory",
        ftpRecursive: (task.sourceConfig as any)?.recursive !== false,
        ftpMaxDepth: Number((task.sourceConfig as any)?.maxDepth ?? 3),
        ftpFilePattern: String((task.sourceConfig as any)?.filePattern || "*.txt"),
        ftpExcludePattern: String((task.sourceConfig as any)?.excludePattern || "\\.(tmp|writing)$"),
        ftpBatchFileLimit: Number((task.sourceConfig as any)?.batchFileLimit || 20),
        ftpStabilitySeconds: Number((task.sourceConfig as any)?.stabilitySeconds || 0),
        ftpPostProcessAction: ((task.sourceConfig as any)?.postProcessAction as TaskFormValues["ftpPostProcessAction"]) || "keep",
        ftpArchiveDir: String((task.sourceConfig as any)?.archiveDir || ""),
        fileType: ((task.parseConfig as any)?.fileType as TaskFormValues["fileType"]) || "txt",
        fileEncoding: String((task.parseConfig as any)?.encoding || "utf8"),
        fileDelimiter: String((task.parseConfig as any)?.delimiter || ""),
        fileHeaderRowNumber: Number((task.parseConfig as any)?.headerRowNumber || 1),
        fileFirstDataRowNumber: Number((task.parseConfig as any)?.firstDataRowNumber || 2),
        fileFieldNameMode: ((task.parseConfig as any)?.fieldNameMode as TaskFormValues["fileFieldNameMode"]) || "header",
        jsonRootPath: String((task.parseConfig as any)?.jsonRootPath || ""),
        xmlRowPath: String((task.parseConfig as any)?.xmlRowPath || ""),
        skipErrorRows: (task.parseConfig as any)?.skipErrorRows !== false
      });
      const loadedApiParams = buildApiParamList((task.sourceConfig || {}) as Record<string, any>);
      setApiConfigSummary({
        method: String((task.sourceConfig as any)?.method || "GET"),
        authType: String((task.sourceConfig as any)?.auth?.type || (task.sourceConfig as any)?.auth?.authType || "none"),
        paginationType: String((task.sourceConfig as any)?.pagination?.type || "none"),
        syncMode: (task.sourceConfig as any)?.incremental?.enabled ? "incremental" : String(task.syncMode || "full"),
        paramCount: loadedApiParams.length,
      });

      const loadedTarget = dataSources.find((source) => source.id === task.targetSourceId);
      const targetConnectionConfig = loadedTarget?.connectionConfig;
      const loadedTargetType = loadedTarget?.sourceType || task.targetType;
      const loadedMappings = (task.fieldMappings || []).map((item) => {
        const customRule = taskRuleMap.get(item.targetField);
        const config = (customRule?.config || {}) as Record<string, unknown>;

        return {
          ...item,
          dataType: normalizeMappingDataType(item.dataType, loadedTargetType, targetConnectionConfig),
          enabled: Boolean(item.targetField),
          autoInferredType: false,
          isCustom: String(config.generatedBy || "") === "custom_field" || item.sourceField.startsWith("__custom_"),
          customRuleType: (config.ruleType as CustomRuleType | undefined) || "none",
          customValue: typeof config.customValue === "string" ? config.customValue : "",
          customSourceFields: Array.isArray(config.sourceFields)
            ? config.sourceFields.map(String)
            : []
        };
      });
      setFieldMappings(loadedMappings);
      if (normalizeTargetSourceType(loadedSource?.sourceType, loadedSource?.connectionConfig) === "api") {
        setSourceColumns(buildSourceColumnsFromMappings(loadedMappings));
      }
    } catch (error: any) {
      message.error(`加载任务失败: ${error.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  }

  function appendAiRecommendLog(text: string) {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setAiRecommendLogs((current) => [...current, `[${time}] ${text}`]);
  }

  function openAiRecommendModal() {
    const nextSourceId = form.getFieldValue("sourceId");
    aiRecommendForm.setFieldsValue({
      sourceId: nextSourceId,
      sourceTable: form.getFieldValue("sourceTable"),
      targetSourceId: form.getFieldValue("targetSourceId")
    });
    setAiSourceId(nextSourceId);
    setAiRecommendLogs([
      "等待选择来源数据源、来源表和目标数据源。",
      "提交后将调用 AI 推荐并把结果回填到创建任务表单。"
    ]);
    setAiRecommendReasoning([]);
    setAiModalOpen(true);
  }

  function closeAiRecommendModal() {
    if (aiRecommending) {
      return;
    }
    setAiModalOpen(false);
  }

  async function handleAiRecommend() {
    if (!token) {
      return;
    }
    try {
      const values = await aiRecommendForm.validateFields();
      const selectedSourceId = values.sourceId!;
      const selectedSourceTable = values.sourceTable!;
      const selectedTargetSourceId = values.targetSourceId!;

      appendAiRecommendLog("已完成参数校验。");
      appendAiRecommendLog(`来源数据源=${selectedSourceId}，来源表=${selectedSourceTable}。`);
      appendAiRecommendLog(`目标数据源=${selectedTargetSourceId}，目标表模式固定为自动创建。`);

      form.setFieldsValue({
        sourceId: selectedSourceId,
        sourceTable: selectedSourceTable,
        targetSourceId: selectedTargetSourceId,
        targetTableMode: "create",
        ownerName: user?.displayName || user?.username || form.getFieldValue("ownerName") || "system"
      });

      setAiRecommending(true);
      appendAiRecommendLog("开始调用 AI 配置推荐接口。");
      const res = await recommendTaskConfig(token, {
        sourceId: selectedSourceId,
        sourceTable: selectedSourceTable,
        targetSourceId: selectedTargetSourceId,
        targetTableMode: "create",
        taskName: form.getFieldValue("taskName"),
        taskCode: form.getFieldValue("taskCode"),
        ownerName: user?.displayName || user?.username || form.getFieldValue("ownerName") || "system",
        description: form.getFieldValue("description")
      });
      appendAiRecommendLog("AI 推荐接口返回成功。");
      const recommendation = res.data?.recommendation || res.data || {};
      const recommendedIncremental = recommendation.incrementalConfig || {};
      setAiRecommendReasoning(
        Array.isArray(recommendation.reasoning)
          ? recommendation.reasoning.map(String).filter(Boolean)
          : []
      );

      form.setFieldsValue({
        taskName: recommendation.taskName || form.getFieldValue("taskName"),
        taskCode:
          recommendation.taskCode ||
          form.getFieldValue("taskCode") ||
          buildRecommendedTaskCode(
            recommendation.taskName || form.getFieldValue("taskName"),
            selectedSourceTable
          ),
        ownerName:
          user?.displayName ||
          user?.username ||
          recommendation.ownerName ||
          form.getFieldValue("ownerName") ||
          "system",
        description: recommendation.description || form.getFieldValue("description"),
        syncMode: recommendation.syncMode || form.getFieldValue("syncMode") || "full",
        targetTableMode: "create",
        targetTable: recommendation.targetTable || form.getFieldValue("targetTable"),
        writeMode:
          recommendation.writeMode ||
          recommendation.targetConfig?.writeMode ||
          form.getFieldValue("writeMode") ||
          "append",
        incrementalMode: recommendedIncremental.mode === "id" ? "id" : "timestamp",
        cursorColumn:
          recommendedIncremental.cursorColumn ||
          recommendedIncremental.timestampColumn ||
          recommendedIncremental.idColumn,
        startValue:
          recommendedIncremental.startValue === null ||
          recommendedIncremental.startValue === undefined
            ? form.getFieldValue("startValue")
            : String(recommendedIncremental.startValue),
        cdcColumns: Array.isArray(recommendedIncremental.cdcColumns)
          ? recommendedIncremental.cdcColumns.join(", ")
          : Array.isArray(recommendation.cdcColumns)
            ? recommendation.cdcColumns.join(", ")
            : form.getFieldValue("cdcColumns")
      });

      if (Array.isArray(recommendation.fieldMappings) && recommendation.fieldMappings.length > 0) {
        const recommendedMappings = recommendation.fieldMappings.map((item: FieldMapping & { enabled?: boolean }) => ({
            ...item,
            dataType: normalizeMappingDataType(
              item.dataType,
              targetSourceRecord?.sourceType || targetSourceType,
              targetSourceRecord?.connectionConfig
            ),
            enabled: item.enabled !== false
          }));
        setFieldMappings(recommendedMappings);
        const invalidMappings = recommendedMappings.filter((item: MappingRow) => !item.sourceField || !item.targetField);
        appendAiRecommendLog(
          invalidMappings.length > 0
            ? `字段映射预检查：发现 ${invalidMappings.length} 条不完整映射，请人工修正。`
            : `字段映射预检查：共生成 ${recommendedMappings.length} 条映射，结构完整。`
        );
      } else {
        regenerateMappings();
        appendAiRecommendLog("字段映射预检查：AI 未返回映射，已按当前来源/目标结构重新生成默认映射。");
      }

      appendAiRecommendLog("已将推荐结果回填到创建任务表单。");
      appendAiRecommendLog("字段映射已更新，可继续人工调整后保存任务。");
      message.success("AI已完成任务配置推荐");
      setAiModalOpen(false);
    } catch (error: any) {
      if (error?.errorFields) {
        appendAiRecommendLog("参数校验未通过，请补全来源数据源、来源表和目标数据源。");
        return;
      }
      const errorMessage = String(error?.message || "未知错误");
      const friendlyMessage = errorMessage.includes("非 JSON 响应")
        ? "AI推荐接口返回了页面内容而不是 JSON，请先刷新页面后重试；若仍失败，再检查网关或登录态。"
        : errorMessage;
      appendAiRecommendLog(`AI 推荐失败：${friendlyMessage}`);
      message.error(`AI配置推荐失败: ${friendlyMessage}`);
    } finally {
      setAiRecommending(false);
    }
  }

  function buildSourcePreviewConfig(values: TaskFormValues) {
    if (isKafkaSource) {
      return {
        sourceConfig: {
          topic: values.sourceTable,
          consumerGroupId: values.kafkaConsumerGroupId || `medata_${values.taskCode || values.sourceTable}`,
          startMode: values.kafkaStartMode || "latest",
          batchSize: values.kafkaBatchSize || 100,
          maxWaitMs: (values.kafkaMaxWaitSeconds || 10) * 1000,
          includeMetadata: true,
          commitMode: "after_write"
        },
        parseConfig: {
          messageFormat: values.kafkaMessageFormat || "json",
          jsonRootPath: values.kafkaJsonRootPath || "",
          encoding: "utf8",
          skipErrorRows: values.skipErrorRows !== false,
          keepRawValue: true
        },
        errorConfig: {
          parseErrorAction: values.skipErrorRows === false ? "fail" : "skip",
          writeErrorAction: "fail"
        }
      };
    }

    if (isFtpSource) {
      return {
        sourceConfig: {
          rootDir: values.sourceTable,
          pathMode: values.ftpPathMode || "directory",
          recursive: values.ftpRecursive !== false,
          maxDepth: values.ftpMaxDepth ?? 3,
          filePattern: values.ftpFilePattern || "*.txt",
          excludePattern: values.ftpExcludePattern || "\\.(tmp|writing)$",
          batchFileLimit: values.ftpBatchFileLimit || 20,
          stabilitySeconds: values.ftpStabilitySeconds || 0,
          postProcessAction: values.ftpPostProcessAction || "keep",
          archiveDir: values.ftpArchiveDir || ""
        },
        parseConfig: {
          fileType: values.fileType || "txt",
          encoding: values.fileEncoding || "utf8",
          delimiter: values.fileDelimiter || undefined,
          headerRowNumber: values.fileHeaderRowNumber || 1,
          firstDataRowNumber: values.fileFirstDataRowNumber || 2,
          fieldNameMode: values.fileFieldNameMode || "header",
          jsonRootPath: values.jsonRootPath || "",
          xmlRowPath: values.xmlRowPath || "",
          skipErrorRows: values.skipErrorRows !== false
        },
        errorConfig: {
          parseErrorAction: values.skipErrorRows === false ? "fail" : "skip",
          writeErrorAction: "fail"
        }
      };
    }

    if (isApiSource) {
      const paginationType = values.apiPaginationType || "none";
      const apiParams = splitApiParams(values.apiParams || []);
      return {
        sourceConfig: {
          endpointPath: values.sourceTable,
          method: values.apiMethod || "GET",
          contentType: values.apiContentType || "application/json",
          auth: buildApiAuthConfig(values),
          headers: apiParams.headers,
          queryParams: apiParams.queryParams,
          bodyParams: apiParams.bodyParams,
          parameterDataSet: {
            enabled: Boolean(values.apiParamDatasetEnabled),
            sourceId: values.apiParamDatasetSourceId || null,
            sql: values.apiParamDatasetSql || "",
            limit: values.apiParamDatasetLimit || 20,
            mode: values.apiParamDatasetMode || "loop",
            payloadKey: values.apiParamDatasetPayloadKey || "items"
          },
          bodyType: values.apiBodyType || "json",
          bodyTemplate: values.apiBodyTemplate || "",
          includeMetadata: true,
          pagination: {
            type: paginationType,
            injectInto: values.apiPaginationInjectInto || "query",
            pageParam: values.apiPageParam || "page",
            pageSizeParam: values.apiPageSizeParam || "pageSize",
            offsetParam: values.apiOffsetParam || "offset",
            limitParam: values.apiLimitParam || "limit",
            cursorParam: values.apiCursorParam || "cursor",
            nextCursorPath: values.apiNextCursorPath || "",
            pageSize: values.apiPageSize || 100,
            startPage: values.apiStartPage || 1,
            maxPages: values.apiMaxPages || 100
          },
          incremental: {
            enabled: values.syncMode === "incremental",
            cursorField: values.apiCursorField || "",
            startParam: values.apiIncrementalStartParam || "startTime",
            endParam: values.apiIncrementalEndParam || "",
            injectInto: values.apiIncrementalInjectInto || "query",
            startValue: values.apiStartValue || ""
          }
        },
        parseConfig: {
          responseFormat: "json",
          recordPath: values.apiRecordPath || "data",
          flattenJson: true,
          keepRawResponse: false,
          skipErrorRows: values.skipErrorRows !== false
        },
        errorConfig: {
          successStatusCodes: parseApiStatusCodes(values.apiSuccessStatusCodes, [200]),
          retryStatusCodes: parseApiStatusCodes(values.apiRetryStatusCodes, [429, 500, 502, 503, 504]),
          maxRetries: values.retryCount ?? 0,
          retryIntervalMs: (values.retryIntervalSeconds || 60) * 1000,
          parseErrorAction: values.skipErrorRows === false ? "fail" : "skip",
          writeErrorAction: "fail"
        }
      };
    }

    return {};
  }

  async function handlePreviewSource() {
    if (!token) {
      return;
    }

    try {
      await form.validateFields(["sourceId", "sourceTable"]);
      const values = form.getFieldsValue(true);
      const streamConfig = buildSourcePreviewConfig(values) as {
        sourceConfig?: Record<string, unknown>;
        parseConfig?: Record<string, unknown>;
      };
      setSourcePreviewLoading(true);
      const res = await previewIngestionSource(token, {
        sourceId: values.sourceId!,
        sourceTable: values.sourceTable!,
        sourceConfig: streamConfig.sourceConfig,
        parseConfig: streamConfig.parseConfig,
        limit: 20
      });
      setSourcePreviewResult(res.data);
      const previewColumns = inferColumnsFromPreviewRows(res.data.rows || [], sourceColumns);
      if (previewColumns.length > 0) {
        setSourceColumns(previewColumns);
        setFieldMappings((current) =>
          buildMappings(
            previewColumns,
            targetColumns,
            current,
            targetTableMode,
            targetSourceRecord?.sourceType || targetSourceType,
            targetSourceRecord?.connectionConfig
          )
        );
      }
      setSourcePreviewOpen(true);
      message.success(
        previewColumns.length > 0
          ? `已预览 ${res.data.totalPreviewRows} 条数据，并刷新 ${previewColumns.length} 个来源字段`
          : `已预览 ${res.data.totalPreviewRows} 条数据，未发现可刷新字段`
      );
    } catch (error: any) {
      if (error?.errorFields) {
        message.warning("请先选择来源数据源和来源对象");
        return;
      }
      message.error(error?.message || "来源数据预览失败");
    } finally {
      setSourcePreviewLoading(false);
    }
  }

  async function handleSubmit() {
    if (!token) {
      return;
    }

    const values = await form.validateFields();
    const invalidCustomField = fieldMappings.find(
      (item) =>
        item.enabled &&
        item.isCustom &&
        (!item.targetField ||
          (item.customRuleType === "custom_value" && !String(item.customValue || "").trim()) ||
          (item.customRuleType === "business_field_md5" &&
            (!item.customSourceFields || item.customSourceFields.length === 0)))
    );

    if (invalidCustomField) {
      message.warning("请完善自定义字段的目标字段名和取值规则");
      return;
    }

    const payload: Record<string, unknown> = {
      taskName: values.taskName,
      taskCode: values.taskCode,
      ownerName: values.ownerName || user?.displayName || user?.username || "system",
      description: values.description,
      status: values.status || "draft",
      sourceId: values.sourceId,
      sourceTable: values.sourceTable,
      targetSourceId: values.targetSourceId,
      targetTable: values.targetTable,
      targetTableMode: values.targetTableMode,
      syncMode: values.syncMode,
      targetConfig: {
        writeMode: values.writeMode || "append",
        ...(values.writeMode === "upsert"
          ? {
              keyFields:
                currentTask?.targetConfig?.keyFields ||
                fieldMappings
                  .filter((item) => item.enabled && item.isPrimaryKey && item.targetField)
                  .map((item) => item.targetField)
            }
          : {})
      },
      fieldMappings: fieldMappings
        .filter((item) => item.enabled && item.targetField)
        .map(({ enabled, sourceComment, isCustom, customRuleType, customValue, customSourceFields, ...item }) => item),
      transformRules: buildTransformRules(),
      scheduleEnabled: values.scheduleType !== "manual"
    };

    if (isKafkaSource) {
      Object.assign(payload, buildSourcePreviewConfig(values));
    }

    if (isFtpSource) {
      Object.assign(payload, buildSourcePreviewConfig(values));
    }

    if (isApiSource) {
      try {
        Object.assign(payload, buildSourcePreviewConfig(values));
      } catch (error: any) {
        message.error(error?.message || "API 请求参数配置不正确");
        return;
      }
    }

    if (!isStreamSource && values.syncMode === "incremental") {
      payload.incrementalConfig = {
        mode: values.incrementalMode,
        cursorColumn: values.cursorColumn,
        timestampColumn:
          values.incrementalMode === "timestamp" ? values.cursorColumn : undefined,
        idColumn: values.incrementalMode === "id" ? values.cursorColumn : undefined,
        startValue: values.startValue
      };
    }

    if (!isStreamSource && values.syncMode === "cdc") {
      payload.incrementalConfig = {
        mode: "cdc",
        cdcColumns: String(values.cdcColumns || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      };
    }

    payload.scheduleConfig = values.scheduleType === "manual"
      ? {
        scheduleType: "manual",
        timezone: values.timezone || "Asia/Shanghai",
        dependencyTaskIds: values.dependencyTaskIds || [],
        retryCount: Number(values.retryCount) || 0,
        retryIntervalMs:
          Number(values.retryCount) > 0 && values.retryIntervalSeconds
            ? Number(values.retryIntervalSeconds) * 1000
            : undefined
      }
      : {
          scheduleType: values.scheduleType,
          intervalMs:
            values.scheduleType === "interval" && values.intervalSeconds
              ? Number(values.intervalSeconds) * 1000
              : undefined,
          cronExpression: values.scheduleType === "cron" ? values.cronExpression : undefined,
          runTime:
            values.scheduleType === "daily" ||
            values.scheduleType === "weekly" ||
            values.scheduleType === "monthly"
              ? values.runTime
              : undefined,
          weekDays: values.scheduleType === "weekly" ? values.weekDays : undefined,
          monthDay: values.scheduleType === "monthly" ? values.monthDay : undefined,
          timezone: values.timezone || "Asia/Shanghai",
          dependencyTaskIds: values.dependencyTaskIds || [],
          retryCount: Number(values.retryCount) || 0,
          retryIntervalMs:
            Number(values.retryCount) > 0 && values.retryIntervalSeconds
              ? Number(values.retryIntervalSeconds) * 1000
              : undefined
        };

    setSubmitting(true);
    try {
      if (isEditMode && taskId) {
        await updateTask(token, taskId, payload);
      } else {
        await createTask(token, payload as any);
      }
      message.success("任务保存成功");
      navigate("/dashboard/data-ingestion-jobs", { replace: true });
    } catch (error: any) {
      message.error(`${isEditMode ? "更新" : "创建"}失败: ${error.message || "未知错误"}`);
    } finally {
      setSubmitting(false);
    }
  }

  function regenerateMappings() {
    setFieldMappings(
      buildMappings(
        sourceColumns,
        targetColumns,
        [],
        targetTableMode,
        targetSourceRecord?.sourceType || targetSourceType,
        targetSourceRecord?.connectionConfig
      )
    );
  }

  function selectFtpObject(record: DataSourceTable) {
    form.setFieldValue("sourceTable", record.tableName);
    if (record.objectType === "file") {
      form.setFieldValue("ftpPathMode", "file");
    } else if (record.objectType === "directory") {
      form.setFieldValue("ftpPathMode", "directory");
    }
    setFtpObjectPickerOpen(false);
  }

  function toggleAllMappings(checked: boolean) {
    setFieldMappings((current) => current.map((item) => ({ ...item, enabled: checked })));
  }

  function addCustomMapping() {
    setFieldMappings((current) => [
      ...current,
      {
        enabled: true,
        isCustom: true,
        sourceField: `__custom_${current.filter((item) => item.isCustom).length + 1}`,
        sourceComment: "自定义字段",
        targetField: "",
        dataType: "varchar(255)",
        autoInferredType: false,
        isPrimaryKey: false,
        customRuleType: "custom_value",
        customValue: "",
        customSourceFields: []
      }
    ]);
  }

  function patchMapping(index: number, patch: Partial<MappingRow>) {
    setFieldMappings((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
              ...(Object.prototype.hasOwnProperty.call(patch, "dataType") ? { autoInferredType: false } : {}),
            }
          : item
      )
    );
  }

  function removeCustomMapping(index: number) {
    setFieldMappings((current) => current.filter((_item, itemIndex) => itemIndex !== index));
  }

  function buildTransformRules() {
    return fieldMappings
      .filter((item) => item.enabled && item.targetField)
      .flatMap((item) => {
        const rules: Array<{ field: string; transformType: "custom"; config: Record<string, unknown> }> = [];

        if (item.isCustom) {
          rules.push({
            field: item.targetField,
            transformType: "custom",
            config: {
              ruleType: item.customRuleType || "custom_value",
              sourceField: item.sourceField,
              sourceComment: item.sourceComment,
              customValue: item.customValue || null,
              sourceFields: item.customSourceFields || [],
              generatedBy: "custom_field"
            }
          });
          return rules;
        }

        if (item.customRuleType && item.customRuleType !== "none") {
          rules.push({
            field: item.targetField,
            transformType: "custom",
            config: {
              ruleType: item.customRuleType,
              customValue: item.customValue || null,
              sourceFields: item.customSourceFields || [],
              generatedBy: "field_rule"
            }
          });
        }

        return rules;
      });
  }

  const mappingColumns: ColumnsType<MappingRow> = [
    {
      title: (
        <Checkbox
          checked={fieldMappings.length > 0 && fieldMappings.every((item) => item.enabled)}
          indeterminate={
            fieldMappings.some((item) => item.enabled) &&
            !fieldMappings.every((item) => item.enabled)
          }
          onChange={(event) => toggleAllMappings(event.target.checked)}
        >
          启用
        </Checkbox>
      ),
      dataIndex: "enabled",
      width: 96,
      render: (value: boolean, _record, index) => (
        <Checkbox
          checked={value}
          onChange={(event) => patchMapping(index, { enabled: event.target.checked })}
        />
      )
    },
    {
      title: "来源字段",
      dataIndex: "sourceField",
      width: 220,
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.isCustom ? record.targetField || "自定义字段" : value}</Typography.Text>
          {record.sourceComment ? (
            <Typography.Text type="secondary">{record.sourceComment}</Typography.Text>
          ) : null}
        </Space>
      )
    },
    {
      title: "目标字段",
      dataIndex: "targetField",
      width: 260,
      render: (value: string, record, index) =>
        targetTableMode === "existing" ? (
          <Select
            allowClear
            showSearch
            disabled={!record.enabled}
            optionFilterProp="label"
            placeholder="选择目标字段"
            style={{ width: "100%" }}
            value={value || undefined}
            options={targetColumns.map((column) => ({
              value: column.columnName,
              label: column.columnComment
                ? `${column.columnName} (${column.columnComment})`
                : column.columnName
            }))}
            onChange={(nextValue) => patchMapping(index, { targetField: nextValue || "" })}
          />
        ) : (
          <Input
            disabled={!record.enabled}
            placeholder="输入目标字段名"
            value={value}
            onChange={(event) => patchMapping(index, { targetField: event.target.value })}
          />
        )
    },
    {
      title: "取值规则",
      dataIndex: "customRuleType",
      width: 340,
      render: (_value: CustomRuleType | undefined, record, index) => (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Select
            disabled={!record.enabled}
            options={customRuleOptions.map((item) => ({ value: item.value, label: item.label }))}
            style={{ width: "100%" }}
            value={record.customRuleType || "none"}
            onChange={(nextValue) =>
              patchMapping(index, {
                customRuleType: nextValue as CustomRuleType,
                customValue: nextValue === "custom_value" ? record.customValue || "" : undefined,
                customSourceFields:
                  nextValue === "business_field_md5" ? record.customSourceFields || [] : undefined
              })
            }
          />
          {record.customRuleType === "custom_value" ? (
            <Input
              disabled={!record.enabled}
              placeholder="输入固定值"
              value={record.customValue}
              onChange={(event) => patchMapping(index, { customValue: event.target.value })}
            />
          ) : null}
          {record.customRuleType === "business_field_md5" ? (
            <Select
              mode="multiple"
              disabled={!record.enabled}
              options={sourceColumns.map((column) => ({
                value: column.columnName,
                label: column.columnComment
                  ? `${column.columnName} (${column.columnComment})`
                  : column.columnName
              }))}
              placeholder="选择参与MD5计算的业务字段"
              style={{ width: "100%" }}
              value={record.customSourceFields || []}
              onChange={(nextValue) =>
                patchMapping(index, { customSourceFields: nextValue })
              }
            />
          ) : null}
        </Space>
      )
    },
    {
      title: "字段类型",
      dataIndex: "dataType",
      width: 180,
      render: (value: string, record, index) =>
        (
          <AutoComplete
            disabled={!record.enabled}
            options={record.isCustom ? customDataTypeOptions : editableDataTypeOptions}
            placeholder="输入或选择字段类型"
            value={value}
            open={record.enabled && activeDataTypeDropdownIndex === index}
            style={{ width: "100%" }}
            onChange={(nextValue) => patchMapping(index, { dataType: nextValue })}
            onFocus={() => setActiveDataTypeDropdownIndex(index)}
            onBlur={() => setActiveDataTypeDropdownIndex((current) => (current === index ? null : current))}
            onSelect={(nextValue) => {
              patchMapping(index, { dataType: String(nextValue || "") });
              setActiveDataTypeDropdownIndex(null);
            }}
            filterOption={(inputValue, option) =>
              String(option?.value || "").toLowerCase().includes(String(inputValue || "").toLowerCase())
            }
          />
        )
    },
    {
      title: "主键",
      dataIndex: "isPrimaryKey",
      width: 80,
      render: (value: boolean, _record, index) => (
        <Checkbox
          checked={value}
          onChange={(event) => patchMapping(index, { isPrimaryKey: event.target.checked })}
        />
      )
    },
    {
      title: "操作",
      dataIndex: "actions",
      width: 90,
      render: (_value, record, index) =>
        record.isCustom ? (
          <Button danger type="link" onClick={() => removeCustomMapping(index)}>
            删除
          </Button>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        )
    }
  ];
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Row justify="space-between" align="middle">
        <Col>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            {isEditMode ? "编辑接入任务" : "新建接入任务"}
          </Typography.Title>
          <Typography.Text type="secondary">
            配置来源、目标、字段映射和调度策略。
          </Typography.Text>
        </Col>
        <Col>
          <Space>
            <Button
              ghost
              type="primary"
              loading={aiRecommending}
              onClick={openAiRecommendModal}
            >
              AI配置推荐
            </Button>
            <Button
              onClick={() => navigate("/dashboard/data-ingestion-jobs", { replace: true })}
            >
              取消
            </Button>
            <Button
              type="primary"
              loading={submitting}
              onClick={() => void handleSubmit()}
            >
              {isEditMode ? "保存任务" : "创建任务"}
            </Button>
          </Space>
        </Col>
      </Row>

      <Form<TaskFormValues>
        form={form}
        layout="vertical"
        colon={false}
        initialValues={defaultInitialValues}
      >
        <Card variant="borderless" loading={loading} styles={{ body: { padding: 20 } }}>
          <Card
            size="small"
            title="1. 基本信息"
            variant="borderless"
            style={{ marginBottom: 16, background: "#fafafa" }}
            styles={{ body: { padding: 16 } }}
          >
            <Row gutter={[12, 0]}>
              <Col xs={24} md={12} xl={8}>
                <Form.Item
                  label="任务名称"
                  name="taskName"
                  rules={[{ required: true, message: "请输入任务名称" }]}
                  style={compactItemStyle}
                >
                  <Input
                    placeholder="例如：婚姻登记信息同步"
                    style={wideControlStyle}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={8}>
                <Form.Item
                  label="任务编码"
                  name="taskCode"
                  rules={[
                    { required: !isEditMode, message: "请输入任务编码" },
                    {
                      pattern: /^[a-zA-Z0-9_]+$/,
                      message: "仅支持字母、数字和下划线"
                    }
                  ]}
                  style={compactItemStyle}
                >
                  <Input
                    disabled={isEditMode}
                    placeholder="例如：job_ods_marr_sync"
                    style={compactControlStyle}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={8}>
                <Form.Item
                  label="负责人"
                  name="ownerName"
                  rules={[{ required: true, message: "请输入负责人" }]}
                  style={compactItemStyle}
                >
                  <Input
                    style={compactControlStyle}
                    placeholder="AI推荐时自动带入当前登录用户"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={8}>
                <Form.Item label="任务状态" name="status" style={compactItemStyle}>
                  <Select
                    options={[
                      { value: "draft", label: "草稿" },
                      { value: "active", label: "已启用" },
                      { value: "paused", label: "已暂停" },
                      { value: "stopped", label: "已停止" }
                    ]}
                    style={compactControlStyle}
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item label="任务说明" name="description" style={{ marginBottom: 0 }}>
                  <Input.TextArea
                    rows={2}
                    placeholder="补充任务用途、执行说明或注意事项"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {currentTask?.lastRunStatus || currentTask?.lastExecutionInfo ? (
            <Card
              size="small"
              title="最近一次执行结果"
              variant="borderless"
              style={{ marginBottom: 16, background: "#fafafa" }}
              styles={{ body: { padding: 16 } }}
            >
              <Row gutter={[12, 8]}>
                <Col xs={24} md={8}>
                  <Typography.Text type="secondary">运行状态</Typography.Text>
                  <div>{currentTask.lastRunStatus || "-"}</div>
                </Col>
                <Col xs={24} md={8}>
                  <Typography.Text type="secondary">开始时间</Typography.Text>
                  <div>{currentTask.lastRunTime || "-"}</div>
                </Col>
                <Col xs={24} md={8}>
                  <Typography.Text type="secondary">结束时间</Typography.Text>
                  <div>{currentTask.lastEndTime || "-"}</div>
                </Col>
                <Col xs={24} md={8}>
                  <Typography.Text type="secondary">写入记录数</Typography.Text>
                  <div>{String((currentTask.lastExecutionInfo as any)?.recordsCount ?? "-")}</div>
                </Col>
                <Col xs={24} md={16}>
                  <Typography.Text type="secondary">执行引擎</Typography.Text>
                  <div>{String((currentTask.lastExecutionInfo as any)?.executionInfo?.engine ?? (currentTask.lastExecutionInfo as any)?.result?.executionInfo?.engine ?? "-")}</div>
                </Col>
                <Col xs={24} md={12}>
                  <Typography.Text type="secondary">增量字段</Typography.Text>
                  <div>{String((currentTask.lastExecutionInfo as any)?.executionInfo?.incremental?.cursorColumn ?? (currentTask.lastExecutionInfo as any)?.result?.executionInfo?.incremental?.cursorColumn ?? "-")}</div>
                </Col>
                <Col xs={24} md={12}>
                  <Typography.Text type="secondary">最新游标</Typography.Text>
                  <div>{String((currentTask.lastExecutionInfo as any)?.executionInfo?.incremental?.nextCursorValue ?? (currentTask.lastExecutionInfo as any)?.result?.executionInfo?.incremental?.nextCursorValue ?? "-")}</div>
                </Col>
                <Col xs={24}>
                  <Typography.Text type="secondary">执行摘要</Typography.Text>
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {String((currentTask.lastExecutionInfo as any)?.error?.message
                      ?? (currentTask.lastExecutionInfo as any)?.result?.error?.message
                      ?? (currentTask.lastExecutionInfo as any)?.executionInfo?.targetTable
                      ?? (currentTask.lastExecutionInfo as any)?.result?.executionInfo?.targetTable
                      ?? "-")}
                  </div>
                </Col>
              </Row>
            </Card>
          ) : null}

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Card
                size="small"
                title={
                  <Space>
                    <span>2. 来源配置</span>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      loading={sourcePreviewLoading}
                      onClick={() => void handlePreviewSource()}
                    >
                      预览
                    </Button>
                    {isApiSource ? (
                      <Button size="small" type="primary" ghost onClick={openApiDocumentParser}>
                        AI接口文档解析
                      </Button>
                    ) : null}
                  </Space>
                }
                variant="borderless"
                style={{ background: "#fafafa" }}
                styles={{ body: { padding: 16 } }}
              >
                <Row gutter={[12, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="来源数据源"
                      name="sourceId"
                      rules={[{ required: true, message: "请选择来源数据源" }]}
                      style={compactItemStyle}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="选择数据源"
                        style={compactControlStyle}
                        options={dataSources.map((item) => ({
                          value: item.id,
                          label: `${item.sourceName} (${item.connectionConfig?.database || item.sourceCode})`
                        }))}
                        onChange={() => {
                          form.setFieldsValue({
                            sourceTable: undefined,
                            cursorColumn: undefined,
                            cdcColumns: undefined,
                            syncMode: "full",
                            kafkaStartMode: "latest",
                            kafkaBatchSize: 100,
                            kafkaMaxWaitSeconds: 10,
                            kafkaMessageFormat: "json",
                            ftpPathMode: "directory",
                            ftpRecursive: true,
                            ftpMaxDepth: 3,
                            ftpFilePattern: "*.txt",
                            ftpBatchFileLimit: 20,
                            ftpPostProcessAction: "keep",
                            apiMethod: "GET",
                            apiContentType: "application/json",
                            apiBodyType: "json",
                            apiAuthType: "none",
                            apiBearerToken: "",
                            apiAuthUsername: "",
                            apiAuthPassword: "",
                            apiKeyIn: "header",
                            apiKeyName: "",
                            apiKeyValue: "",
                            apiParams: [],
                            apiBodyTemplate: "",
                            apiRecordPath: "data",
                            apiPaginationType: "none",
                            apiPageParam: "page",
                            apiPageSizeParam: "pageSize",
                            apiOffsetParam: "offset",
                            apiLimitParam: "limit",
                            apiCursorParam: "cursor",
                            apiNextCursorPath: "",
                            apiPageSize: 100,
                            apiStartPage: 1,
                            apiMaxPages: 100,
                            apiCursorField: undefined,
                            apiStartValue: "",
                            fileType: "txt",
                            fileEncoding: "utf8",
                            fileHeaderRowNumber: 1,
                            fileFirstDataRowNumber: 2,
                            fileFieldNameMode: "header",
                            skipErrorRows: true
                          });
                          setApiConfigSummary(defaultApiConfigSummary);
                          setSourceColumns([]);
                          setFieldMappings([]);
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label={isKafkaSource ? "Kafka Topic" : isFtpSource ? "FTP 目录/文件" : isApiSource ? "接口路径" : "来源表"}
                      required
                      style={compactItemStyle}
                    >
                      <Space.Compact style={compactControlStyle}>
                        <Form.Item
                          name="sourceTable"
                          noStyle
                          rules={[{ required: true, message: isKafkaSource ? "请选择 Topic" : isFtpSource ? "请选择目录或文件" : isApiSource ? "请输入接口路径" : "请选择来源表" }]}
                        >
                          {isApiSource ? (
                            <AutoComplete
                              placeholder="例如：/api/service/orders，可输入完整 URL"
                              style={compactControlStyle}
                              options={sourceTables.map((item) => ({
                                value: item.tableName,
                                label: item.tableComment
                                  ? `${item.tableName} (${item.tableComment})`
                                  : item.tableName
                              }))}
                              filterOption={(inputValue, option) =>
                                String(option?.value || "").toLowerCase().includes(inputValue.toLowerCase()) ||
                                String(option?.label || "").toLowerCase().includes(inputValue.toLowerCase())
                              }
                            />
                          ) : (
                            <Select
                              showSearch
                              optionFilterProp="label"
                              placeholder={isKafkaSource ? "选择 Topic" : isFtpSource ? "选择 FTP 目录或文件" : "选择来源表"}
                              style={{ width: isFtpSource ? "calc(100% - 72px)" : "100%" }}
                              options={sourceTables.map((item) => ({
                                value: item.tableName,
                                label: item.tableComment
                                  ? `${item.tableName} (${item.tableComment})`
                                  : item.tableName
                              }))}
                            />
                          )}
                        </Form.Item>
                        {isFtpSource ? (
                          <Button style={{ width: 72 }} onClick={() => setFtpObjectPickerOpen(true)}>
                            浏览
                          </Button>
                        ) : null}
                      </Space.Compact>
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Typography.Text type="secondary">
                      {isStreamSource
                        ? "Kafka、FTP、API 接入会按来源对象读取样例并推断字段，运行状态通过位点、文件处理状态或接口游标续跑。"
                        : "AI配置推荐已移到页面顶部。推荐时会单独弹窗选择来源数据源、来源表和目标数据源，再自动回填任务信息。"}
                    </Typography.Text>
                  </Col>
                  {isKafkaSource ? (
                    <>
                      <Col xs={24} md={12}>
                        <Form.Item label="消费组 ID" name="kafkaConsumerGroupId" style={compactItemStyle}>
                          <Input placeholder="不填则按任务编码自动生成" style={compactControlStyle} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item label="消费起点" name="kafkaStartMode" style={compactItemStyle}>
                          <Select
                            style={compactControlStyle}
                            options={[
                              { value: "latest", label: "从最新消息开始" },
                              { value: "earliest", label: "从最早消息开始" },
                              { value: "stored", label: "沿用已保存位点" }
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item label="每批最大消息数" name="kafkaBatchSize" style={compactItemStyle}>
                          <InputNumber min={1} max={5000} style={compactControlStyle} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item label="单次等待秒数" name="kafkaMaxWaitSeconds" style={compactItemStyle}>
                          <InputNumber min={1} max={120} style={compactControlStyle} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item label="消息格式" name="kafkaMessageFormat" style={compactItemStyle}>
                          <Select
                            style={compactControlStyle}
                            options={[
                              { value: "json", label: "JSON" },
                              { value: "text", label: "文本原文" }
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item label="JSON 根路径" name="kafkaJsonRootPath" style={compactItemStyle}>
                          <Input placeholder="例如：data.items，可留空" style={compactControlStyle} />
                        </Form.Item>
                      </Col>
                    </>
                  ) : null}
                  {isFtpSource ? (
                    <>
                      <Col xs={24} md={8}>
                        <Form.Item label="读取对象" name="ftpPathMode" style={compactItemStyle}>
                          <Select
                            style={compactControlStyle}
                            options={[
                              { value: "directory", label: "目录批量读取" },
                              { value: "file", label: "单文件读取" }
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="递归读取子目录" name="ftpRecursive" valuePropName="checked" style={compactItemStyle}>
                          <Checkbox>启用</Checkbox>
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="最大目录深度" name="ftpMaxDepth" style={compactItemStyle}>
                          <InputNumber min={0} max={10} style={compactControlStyle} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="文件名匹配" name="ftpFilePattern" style={compactItemStyle}>
                          <Input placeholder="例如：user_registration_*.txt" style={compactControlStyle} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="单批文件数" name="ftpBatchFileLimit" style={compactItemStyle}>
                          <InputNumber min={1} max={500} style={compactControlStyle} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="文件稳定等待秒数" name="ftpStabilitySeconds" style={compactItemStyle}>
                          <InputNumber min={0} max={3600} style={compactControlStyle} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="处理后动作" name="ftpPostProcessAction" style={compactItemStyle}>
                          <Select
                            style={compactControlStyle}
                            options={[
                              { value: "keep", label: "保留源文件" },
                              { value: "delete", label: "成功后删除" },
                              { value: "archive", label: "成功后归档" }
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="归档目录" name="ftpArchiveDir" style={compactItemStyle}>
                          <Input placeholder="例如：archive/ecommerce_user_registration" style={compactControlStyle} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="文件类型" name="fileType" style={compactItemStyle}>
                          <Select
                            style={compactControlStyle}
                            options={["txt", "csv", "xls", "xlsx", "json", "xml"].map((value) => ({ value, label: value.toUpperCase() }))}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="编码" name="fileEncoding" style={compactItemStyle}>
                          <Select
                            style={compactControlStyle}
                            options={[
                              { value: "utf8", label: "UTF-8" },
                              { value: "gbk", label: "GBK" },
                              { value: "gb18030", label: "GB18030" }
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="字段分隔符" name="fileDelimiter" style={compactItemStyle}>
                          <Select
                            allowClear
                            style={compactControlStyle}
                            options={[
                              { value: ",", label: "逗号 ," },
                              { value: "\t", label: "Tab" },
                              { value: "|", label: "竖线 |" },
                              { value: ";", label: "分号 ;" }
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="字段名行" name="fileHeaderRowNumber" style={compactItemStyle}>
                          <InputNumber min={1} style={compactControlStyle} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="首个数据行" name="fileFirstDataRowNumber" style={compactItemStyle}>
                          <InputNumber min={1} style={compactControlStyle} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="字段名模式" name="fileFieldNameMode" style={compactItemStyle}>
                          <Select
                            style={compactControlStyle}
                            options={[
                              { value: "header", label: "读取表头" },
                              { value: "generated", label: "自动生成" }
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="JSON 根路径" name="jsonRootPath" style={compactItemStyle}>
                          <Input placeholder="JSON 文件可填" style={compactControlStyle} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item label="XML 行路径" name="xmlRowPath" style={compactItemStyle}>
                          <Input placeholder="XML 文件可填" style={compactControlStyle} />
                        </Form.Item>
                      </Col>
                    </>
                  ) : null}
                  {isApiSource ? (
                    <Col xs={24}>
                      <Row gutter={[12, 12]}>
                        <Col xs={24} md={8}>
                          <Card size="small" title="接口基础配置" extra={<Button size="small" onClick={() => setApiBasicModalOpen(true)}>配置</Button>}>
                            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                              配置请求类型、内容格式、返回记录路径、认证方式和请求体类型。
                            </Typography.Paragraph>
                            <Typography.Text>当前：{apiConfigSummary.method || "GET"} / {apiConfigSummary.authType === "none" ? "无认证" : apiConfigSummary.authType === "api_key" ? "API Key" : apiConfigSummary.authType}</Typography.Text>
                          </Card>
                        </Col>
                        <Col xs={24} md={8}>
                          <Card size="small" title="请求参数配置" extra={<Button size="small" onClick={() => setApiParamsModalOpen(true)}>配置</Button>}>
                            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                              管理 Header、Query、Body 参数，支持自定义值、系统参数和 SQL 参数集字段。
                            </Typography.Paragraph>
                            <Typography.Text>当前：{apiConfigSummary.paramCount} 个参数</Typography.Text>
                          </Card>
                        </Col>
                        <Col xs={24} md={8}>
                          <Card size="small" title="执行策略配置" extra={<Button size="small" onClick={() => setApiStrategyModalOpen(true)}>配置</Button>}>
                            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                              配置分页、增量位点、解析错误处理和接口同步模式。
                            </Typography.Paragraph>
                            <Typography.Text>当前：{apiConfigSummary.paginationType === "none" ? "不分页" : "分页"} / {apiConfigSummary.syncMode === "incremental" ? "增量同步" : "全量同步"}</Typography.Text>
                          </Card>
                        </Col>
                      </Row>
                    </Col>
                  ) : null}
                  {isStreamSource && !isApiSource ? (
                    <Col xs={24} md={isFtpSource ? 8 : 12}>
                      <Form.Item label="解析错误处理" name="skipErrorRows" style={compactItemStyle}>
                        <Select
                          style={compactControlStyle}
                          options={[
                            { value: true, label: "跳过错误记录继续执行" },
                            { value: false, label: "遇到错误立即终止" }
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  ) : null}
                  {!isApiSource ? (
                  <Col xs={24} md={isFtpSource ? 8 : 12}>
                    <Form.Item
                      label={
                        <Space size={4}>
                          <span>同步模式</span>
                          {isFtpSource ? (
                            <Tooltip title="全量读取每次扫描并读取所有匹配文件，配合覆盖写可避免重复数据；增量读取会记录已成功处理文件的路径、大小和修改时间，后续只读取新增文件或已变化文件。">
                              <InfoCircleOutlined style={{ color: "#8c8c8c" }} />
                            </Tooltip>
                          ) : null}
                        </Space>
                      }
                      name="syncMode"
                      rules={[{ required: true, message: "请选择同步模式" }]}
                      style={compactItemStyle}
                    >
                      <Select
                        style={compactControlStyle}
                        options={isStreamSource
                          ? isKafkaSource
                            ? [{ value: "full", label: "批量消费" }]
                            : isFtpSource
                              ? [
                                { value: "full", label: "文件全量读取" },
                                { value: "incremental", label: "文件增量读取" }
                              ]
                              : [
                                  { value: "full", label: "接口全量同步" },
                                  { value: "incremental", label: "接口增量同步" }
                                ]
                          : [
                              { value: "full", label: "全量同步" },
                              { value: "incremental", label: "增量同步" },
                              { value: "cdc", label: "CDC" }
                            ]}
                      />
                    </Form.Item>
                  </Col>
                  ) : null}
                  {!isStreamSource && syncMode === "incremental" ? (
                    <>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="增量类型"
                          name="incrementalMode"
                          rules={[{ required: true, message: "请选择增量类型" }]}
                          style={compactItemStyle}
                        >
                          <Select
                            style={compactControlStyle}
                            options={[
                              { value: "timestamp", label: "时间字段" },
                              { value: "id", label: "序号字段" }
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="增量字段"
                          name="cursorColumn"
                          rules={[{ required: true, message: "请选择增量字段" }]}
                          style={compactItemStyle}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            placeholder="选择来源字段"
                            style={wideControlStyle}
                            options={sourceColumns.map((column) => ({
                              value: column.columnName,
                              label: column.columnComment
                                ? `${column.columnName} (${column.columnComment})`
                                : column.columnName
                            }))}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="首次起始值"
                          name="startValue"
                          style={compactItemStyle}
                        >
                          <Input
                            placeholder={
                              incrementalMode === "timestamp"
                                ? "例如：2025-01-01 00:00:00"
                                : "例如：0"
                            }
                            style={compactControlStyle}
                          />
                        </Form.Item>
                      </Col>
                    </>
                  ) : null}
                  {!isStreamSource && syncMode === "cdc" ? (
                    <Col xs={24}>
                      <Form.Item
                        label="CDC 监听字段"
                        name="cdcColumns"
                        rules={[{ required: true, message: "请输入 CDC 监听字段" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input
                          placeholder="多个字段用逗号分隔，例如：updated_at, deleted_flag"
                          style={wideControlStyle}
                        />
                      </Form.Item>
                    </Col>
                  ) : null}
                </Row>
              </Card>
            </Col>

            <Col xs={24} xl={12}>
              <Card
                size="small"
                title="3. 目标配置"
                variant="borderless"
                style={{ background: "#fafafa" }}
                styles={{ body: { padding: 16 } }}
              >
                <Row gutter={[12, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="目标数据源"
                      name="targetSourceId"
                      rules={[{ required: true, message: "请选择目标数据源" }]}
                      style={compactItemStyle}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="选择数据源"
                        style={compactControlStyle}
                        options={dataSources.map((item) => ({
                          value: item.id,
                          label: `${item.sourceName} (${item.connectionConfig?.database || item.sourceCode})`
                        }))}
                        onChange={() => {
                          form.setFieldsValue({ targetTable: undefined });
                          setTargetColumns([]);
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="目标表模式"
                      name="targetTableMode"
                      rules={[{ required: true, message: "请选择目标表模式" }]}
                      style={compactItemStyle}
                    >
                      <Select
                        style={compactControlStyle}
                        options={[
                          { value: "existing", label: "选择已有表" },
                          { value: "create", label: "自动创建目标表" }
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    {targetTableMode === "existing" ? (
                      <Form.Item
                        label="目标表"
                        name="targetTable"
                        rules={[{ required: true, message: "请选择目标表" }]}
                        style={compactItemStyle}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder="选择目标表"
                          style={compactControlStyle}
                          options={targetTables.map((item) => ({
                            value: item.tableName,
                            label: item.tableComment
                              ? `${item.tableName} (${item.tableComment})`
                              : item.tableName
                          }))}
                        />
                      </Form.Item>
                    ) : (
                      <Form.Item
                        label="新目标表名"
                        name="targetTable"
                        rules={[{ required: true, message: "请输入目标表名" }]}
                        style={compactItemStyle}
                      >
                        <Input
                          placeholder="例如：ods_marriage_registration"
                          style={compactControlStyle}
                        />
                      </Form.Item>
                    )}
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="数据写入模式"
                      name="writeMode"
                      rules={[{ required: true, message: "请选择写入模式" }]}
                      style={compactItemStyle}
                    >
                      <Select
                        style={compactControlStyle}
                        options={getWriteModeOptions(
                          targetSourceRecord?.sourceType || targetSourceType,
                          targetSourceRecord?.connectionConfig
                        )}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
          <Divider />

          <Row justify="space-between" align="middle">
            <Col>
              <Typography.Title level={5} style={{ marginBottom: 0 }}>
                4. 字段映射
              </Typography.Title>
            </Col>
            <Col>
              <Space>
                <Typography.Text type="secondary">
                  来源字段数：{sourceColumns.length}
                </Typography.Text>
                <Button onClick={addCustomMapping}>新增自定义字段</Button>
                <Button onClick={regenerateMappings} disabled={sourceColumns.length === 0}>
                  重新生成映射
                </Button>
              </Space>
            </Col>
          </Row>

          <Table
            columns={mappingColumns}
            dataSource={fieldMappings}
            pagination={false}
            rowKey={(record) => record.sourceField}
            scroll={{ y: 360 }}
            style={{ marginTop: 12 }}
          />

          <Divider />

          <Typography.Title level={5}>5. 调度配置</Typography.Title>
          <Row gutter={[12, 0]}>
            <Col xs={24} md={12} xl={8}>
              <Form.Item label="调度方式" name="scheduleType" style={compactItemStyle}>
                <Select
                  style={compactControlStyle}
                  options={[
                    { value: "manual", label: "手动执行" },
                    { value: "daily", label: "每天执行" },
                    { value: "weekly", label: "每周执行" },
                    { value: "monthly", label: "每月执行" },
                    { value: "interval", label: "固定间隔" },
                    { value: "cron", label: "Cron 表达式" }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={8}>
              {scheduleType === "interval" ? (
                <Form.Item
                  label="间隔秒数"
                  name="intervalSeconds"
                  rules={[{ required: true, message: "请输入间隔秒数" }]}
                  style={compactItemStyle}
                >
                  <InputNumber min={1} style={compactControlStyle} />
                </Form.Item>
              ) : null}
              {scheduleType === "cron" ? (
                <Form.Item
                  label="Cron 表达式"
                  name="cronExpression"
                  rules={[{ required: true, message: "请输入 Cron 表达式" }]}
                  style={compactItemStyle}
                >
                  <Input placeholder="例如：5 */2 * * *" style={compactControlStyle} />
                </Form.Item>
              ) : null}
              {scheduleType === "daily" ||
              scheduleType === "weekly" ||
              scheduleType === "monthly" ? (
                <Form.Item
                  label="执行时间"
                  name="runTime"
                  rules={[{ required: true, message: "请选择执行时间" }]}
                  style={compactItemStyle}
                >
                  <Input style={compactControlStyle} type="time" />
                </Form.Item>
              ) : null}
            </Col>
            <Col xs={24} md={12} xl={8}>
              {scheduleType === "weekly" ? (
                <Form.Item
                  label="执行日"
                  name="weekDays"
                  rules={[{ required: true, message: "请选择执行日" }]}
                  style={compactItemStyle}
                >
                  <Select
                    mode="multiple"
                    placeholder="选择每周执行日"
                    style={compactControlStyle}
                    options={weekDayOptions}
                  />
                </Form.Item>
              ) : null}
              {scheduleType === "monthly" ? (
                <Form.Item
                  label="每月日期"
                  name="monthDay"
                  rules={[{ required: true, message: "请输入每月执行日期" }]}
                  style={compactItemStyle}
                >
                  <InputNumber min={1} max={31} style={compactControlStyle} />
                </Form.Item>
              ) : null}
              {scheduleType !== "manual" ? (
                <Form.Item label="时区" name="timezone" style={compactItemStyle}>
                  <Input placeholder="Asia/Shanghai" style={compactControlStyle} />
                </Form.Item>
              ) : null}
            </Col>
          </Row>
          <Row gutter={[12, 0]}>
            <Col xs={24}>
              <Form.Item label="依赖任务" name="dependencyTaskIds" style={compactItemStyle}>
                <Select
                  mode="multiple"
                  showSearch
                  optionFilterProp="label"
                  placeholder="可选择一个或多个前置任务"
                  style={compactControlStyle}
                  options={dependencyTaskOptions}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[12, 0]}>
            <Col xs={24} md={12}>
              <Form.Item label="失败重试次数" name="retryCount" style={compactItemStyle}>
                <InputNumber min={0} max={20} style={compactControlStyle} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="重试间隔(秒)"
                name="retryIntervalSeconds"
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const retryCount = Number(getFieldValue("retryCount")) || 0;
                      if (retryCount <= 0) {
                        return Promise.resolve();
                      }
                      if (Number(value) > 0) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("请设置有效的重试间隔"));
                    }
                  })
                ]}
                style={compactItemStyle}
              >
                <InputNumber min={1} style={compactControlStyle} />
              </Form.Item>
            </Col>
          </Row>
        </Card>
        <Modal
          open={apiBasicModalOpen}
          title="接口基础配置"
          width={860}
          okText="完成"
          cancelText="关闭"
          onOk={() => {
            refreshApiConfigSummary();
            setApiBasicModalOpen(false);
          }}
          onCancel={() => {
            refreshApiConfigSummary();
            setApiBasicModalOpen(false);
          }}
          destroyOnHidden={false}
        >
          <Typography.Paragraph type="secondary">
            配置请求方式、内容格式、返回记录路径、认证方式和请求体格式。API 地址端口来自数据源，接口路径在来源对象中维护。
          </Typography.Paragraph>
          <Row gutter={[12, 0]}>
            <Col xs={24} md={8}>
              <Form.Item label="请求类型" name="apiMethod" style={compactItemStyle}>
                <Select style={compactControlStyle} options={["GET", "POST", "PUT", "PATCH"].map((value) => ({ value, label: value }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Content-Type" name="apiContentType" style={compactItemStyle}>
                <Select
                  style={compactControlStyle}
                  options={[
                    { value: "application/json", label: "JSON" },
                    { value: "application/x-www-form-urlencoded", label: "表单" },
                    { value: "text/plain", label: "文本" }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="返回记录路径" name="apiRecordPath" style={compactItemStyle}>
                <Input placeholder="例如：data.records；根对象可留空" style={compactControlStyle} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="认证方式" name="apiAuthType" style={compactItemStyle}>
                <Select
                  style={compactControlStyle}
                  options={[
                    { value: "none", label: "无认证" },
                    { value: "bearer", label: "Bearer Token" },
                    { value: "basic", label: "Basic 认证" },
                    { value: "api_key", label: "API Key" }
                  ]}
                />
              </Form.Item>
            </Col>
            {apiAuthType === "bearer" ? (
              <Col xs={24} md={16}>
                <Form.Item label="Bearer Token" name="apiBearerToken" style={compactItemStyle} rules={[{ required: true, message: "请输入 Token" }]}>
                  <Input.Password placeholder="支持变量，例如：${sys.today}" />
                </Form.Item>
              </Col>
            ) : null}
            {apiAuthType === "basic" ? (
              <>
                <Col xs={24} md={8}>
                  <Form.Item label="用户名" name="apiAuthUsername" style={compactItemStyle} rules={[{ required: true, message: "请输入用户名" }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="密码" name="apiAuthPassword" style={compactItemStyle} rules={[{ required: true, message: "请输入密码" }]}>
                    <Input.Password />
                  </Form.Item>
                </Col>
              </>
            ) : null}
            {apiAuthType === "api_key" ? (
              <>
                <Col xs={24} md={8}>
                  <Form.Item label="密钥位置" name="apiKeyIn" style={compactItemStyle} rules={[{ required: true, message: "请选择密钥位置" }]}>
                    <Select
                      options={[
                        { value: "header", label: "请求头" },
                        { value: "query", label: "URL 参数" },
                        { value: "body", label: "请求体" }
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="密钥名称" name="apiKeyName" style={compactItemStyle} rules={[{ required: true, message: "请输入密钥名称" }]}>
                    <Input placeholder="例如：X-App-Token" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="密钥值" name="apiKeyValue" style={compactItemStyle} rules={[{ required: true, message: "请输入密钥值" }]}>
                    <Input.Password placeholder="支持变量，例如：${sys.today}" />
                  </Form.Item>
                </Col>
              </>
            ) : null}
            <Col xs={24} md={8}>
              <Form.Item label="Body 类型" name="apiBodyType" style={compactItemStyle}>
                <Select
                  style={compactControlStyle}
                  options={[
                    { value: "json", label: "JSON 对象" },
                    { value: "form", label: "表单参数" },
                    { value: "text", label: "文本模板" },
                    { value: "none", label: "无 Body" }
                  ]}
                />
              </Form.Item>
            </Col>
            {apiBodyType === "text" ? (
              <Col xs={24}>
                <Form.Item label="Body 文本模板" name="apiBodyTemplate" style={compactItemStyle}>
                  <Input.TextArea rows={3} placeholder='例如：{"page":${run.page},"limit":${run.limit}}' />
                </Form.Item>
              </Col>
            ) : null}
          </Row>
        </Modal>
        <Modal
          open={apiParamsModalOpen}
          title="请求参数配置"
          width={1400}
          okText="完成"
          cancelText="关闭"
          onOk={() => {
            refreshApiConfigSummary();
            setApiParamsModalOpen(false);
          }}
          onCancel={() => {
            refreshApiConfigSummary();
            setApiParamsModalOpen(false);
          }}
          destroyOnHidden={false}
        >
          <Space direction="vertical" size={12} style={{ display: "flex" }}>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              参数可写入 Header、Query 或 Body。参数值支持自定义、系统参数和 SQL 参数集字段；SQL 参数集可按查询结果逐行循环调用接口，也可一次性作为数组传入。
            </Typography.Paragraph>
            <Card size="small" title="数据库参数集" styles={{ body: { padding: 12 } }}>
              <Row gutter={[12, 0]}>
                <Col xs={24} md={6}>
                  <Form.Item label="启用 SQL 参数集" name="apiParamDatasetEnabled" valuePropName="checked" style={compactItemStyle}>
                    <Checkbox>启用</Checkbox>
                  </Form.Item>
                </Col>
                {apiParamDatasetEnabled ? (
                  <>
                    <Col xs={24} md={6}>
                      <Form.Item label="参数来源库" name="apiParamDatasetSourceId" rules={[{ required: true, message: "请选择参数来源库" }]} style={compactItemStyle}>
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder="选择数据库数据源"
                          options={dataSources
                            .filter((item) => ["mysql", "postgresql"].includes(normalizeTargetSourceType(item.sourceType, item.connectionConfig)))
                            .map((item) => ({
                              value: item.id,
                              label: `${item.sourceName} (${item.connectionConfig?.database || item.sourceCode})`
                            }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={4}>
                      <Form.Item label="读取条数" name="apiParamDatasetLimit" style={compactItemStyle}>
                        <InputNumber min={1} max={500} style={compactControlStyle} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={4}>
                      <Form.Item label="传入方式" name="apiParamDatasetMode" style={compactItemStyle}>
                        <Select
                          options={[
                            { value: "loop", label: "逐行循环传入" },
                            { value: "bulk", label: "一次性数组传入" }
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={4}>
                      <Form.Item label="数组参数名" name="apiParamDatasetPayloadKey" style={compactItemStyle}>
                        <Input placeholder="例如：items" />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item label="SQL 查询" name="apiParamDatasetSql" rules={[{ required: true, message: "请输入 SQL 查询" }]} style={compactItemStyle}>
                        <Input.TextArea rows={4} placeholder="例如：SELECT id_card_num FROM user_param_source ORDER BY id LIMIT 20" />
                      </Form.Item>
                    </Col>
                  </>
                ) : null}
              </Row>
            </Card>
            <Form.Item label="请求参数" style={compactItemStyle}>
              <Form.List name="apiParams">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: "100%" }} size={10}>
                    {fields.map((field) => (
                      <Card key={field.key} size="small" styles={{ body: { padding: 12 } }}>
                        <Row gutter={[8, 8]} align="top">
                          <Col flex="40px">
                            <Form.Item name={[field.name, "enabled"]} valuePropName="checked" style={{ marginBottom: 0 }}>
                              <Checkbox />
                            </Form.Item>
                          </Col>
                          <Col flex="0 0 120px">
                            <Form.Item name={[field.name, "location"]} label="位置" style={compactItemStyle} rules={[{ required: true, message: "请选择位置" }]}>
                              <Select options={[{ value: "header", label: "Header" }, { value: "query", label: "Query" }, { value: "body", label: "Body" }]} />
                            </Form.Item>
                          </Col>
                          <Col flex="0 0 180px">
                            <Form.Item name={[field.name, "name"]} label="参数名" style={compactItemStyle} rules={[{ required: true, message: "请输入参数名" }]}>
                              <Input placeholder="参数名" />
                            </Form.Item>
                          </Col>
                          <Col flex="0 0 140px">
                            <Form.Item name={[field.name, "valueMode"]} label="取值方式" style={compactItemStyle}>
                              <Select options={[{ value: "custom", label: "自定义" }, { value: "system", label: "系统参数" }, { value: "dataset", label: "SQL字段" }, { value: "checkpoint", label: "增量位点" }]} />
                            </Form.Item>
                          </Col>
                          <Col flex="0 0 120px">
                            <Form.Item name={[field.name, "valueType"]} label="类型" style={compactItemStyle}>
                              <Select options={[{ value: "text", label: "文本" }, { value: "number", label: "数字" }, { value: "boolean", label: "布尔" }, { value: "datetime", label: "日期时间" }]} />
                            </Form.Item>
                          </Col>
                          <Col flex="1 1 420px" style={{ minWidth: 320 }}>
                            <Form.Item shouldUpdate noStyle>
                              {({ getFieldValue }) => {
                                const mode = getFieldValue(["apiParams", field.name, "valueMode"]) || "custom";
                                const systemKey = getFieldValue(["apiParams", field.name, "systemKey"]);
                                if (mode === "system") {
                                  return (
                                    <Row gutter={[8, 8]} wrap={false}>
                                      <Col flex="1 1 150px">
                                        <Form.Item name={[field.name, "systemKey"]} label="系统参数" style={compactItemStyle}>
                                          <Select
                                            options={[
                                              { value: "now", label: "当前时间" },
                                              { value: "today", label: "当前日期" },
                                              { value: "yesterday", label: "昨日日期" },
                                              { value: "timestamp", label: "时间戳" },
                                              { value: "value_range", label: "值域随机值" }
                                            ]}
                                          />
                                        </Form.Item>
                                      </Col>
                                      {systemKey === "value_range" ? (
                                        <>
                                          <Col flex="1 1 120px">
                                            <Form.Item name={[field.name, "rangeStart"]} label="值域下限" style={compactItemStyle}>
                                              <Input placeholder="例如：1" />
                                            </Form.Item>
                                          </Col>
                                          <Col flex="1 1 120px">
                                            <Form.Item name={[field.name, "rangeEnd"]} label="值域上限" style={compactItemStyle}>
                                              <Input placeholder="例如：100" />
                                            </Form.Item>
                                          </Col>
                                        </>
                                      ) : (
                                        <>
                                          <Col flex="1 1 170px">
                                            <Form.Item name={[field.name, "systemFormat"]} label="时间格式" style={compactItemStyle}>
                                              <Select
                                                allowClear
                                                placeholder="默认 ISO"
                                                options={[
                                                  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
                                                  { value: "YYYY-MM-DD HH:mm:ss", label: "YYYY-MM-DD HH:mm:ss" },
                                                  { value: "YYYYMMDD", label: "YYYYMMDD" },
                                                  { value: "timestamp_ms", label: "毫秒时间戳" },
                                                  { value: "timestamp_s", label: "秒时间戳" }
                                                ]}
                                              />
                                            </Form.Item>
                                          </Col>
                                          <Col flex="0 0 96px">
                                            <Form.Item name={[field.name, "systemOffsetAmount"]} label="偏移量" style={compactItemStyle}>
                                              <InputNumber style={compactControlStyle} />
                                            </Form.Item>
                                          </Col>
                                          <Col flex="0 0 110px">
                                            <Form.Item name={[field.name, "systemOffsetUnit"]} label="偏移单位" style={compactItemStyle}>
                                              <Select options={[{ value: "minute", label: "分钟" }, { value: "hour", label: "小时" }, { value: "day", label: "天" }, { value: "month", label: "月" }]} />
                                            </Form.Item>
                                          </Col>
                                        </>
                                      )}
                                    </Row>
                                  );
                                }
                                if (mode === "dataset") {
                                  return (
                                    <Row gutter={[8, 8]} wrap={false}>
                                      <Col flex="1 1 260px">
                                        <Form.Item name={[field.name, "datasetField"]} label="SQL 结果字段" style={compactItemStyle}>
                                          <Input placeholder="例如：id_card_num" />
                                        </Form.Item>
                                      </Col>
                                    </Row>
                                  );
                                }
                                if (mode === "checkpoint") {
                                  return (
                                    <Row gutter={[8, 8]} wrap={false}>
                                      <Col flex="1 1 260px">
                                        <Form.Item name={[field.name, "checkpointKey"]} label="位点值" style={compactItemStyle}>
                                          <Select
                                            options={[
                                              { value: "last_cursor", label: "上次成功位点" },
                                              { value: "last_success_time", label: "上次成功时间" }
                                            ]}
                                          />
                                        </Form.Item>
                                      </Col>
                                    </Row>
                                  );
                                }
                                return (
                                  <Row gutter={[8, 8]} wrap={false}>
                                    <Col flex="1 1 240px">
                                      <Form.Item name={[field.name, "value"]} label="参数值" style={compactItemStyle}>
                                        <Input placeholder="可输入固定值或 ${sys.today}" />
                                      </Form.Item>
                                    </Col>
                                    <Col flex="1 1 180px">
                                      <Form.Item name={[field.name, "description"]} label="说明" style={compactItemStyle}>
                                        <Input placeholder="参数用途说明" />
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                );
                              }}
                            </Form.Item>
                          </Col>
                          <Col flex="0 0 64px">
                            <Button style={{ marginTop: 30 }} onClick={() => remove(field.name)}>删除</Button>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Space wrap>
                      <Button onClick={() => add({ enabled: true, location: "query", valueMode: "custom", valueType: "text", systemOffsetUnit: "day", checkpointKey: "last_cursor" })}>添加参数</Button>
                      <Typography.Text type="secondary">
                        系统变量兼容：${"{sys.now}"}、${"{sys.today}"}、${"{run.page}"}、${"{state.last_cursor}"}；SQL 字段可用 ${"{dataset.field}"} 引用。
                      </Typography.Text>
                    </Space>
                  </Space>
                )}
              </Form.List>
            </Form.Item>
          </Space>
        </Modal>
        <Modal
          open={apiStrategyModalOpen}
          title="执行策略配置"
          width={920}
          okText="完成"
          cancelText="关闭"
          onOk={() => {
            refreshApiConfigSummary();
            setApiStrategyModalOpen(false);
          }}
          onCancel={() => {
            refreshApiConfigSummary();
            setApiStrategyModalOpen(false);
          }}
          destroyOnHidden={false}
        >
          <Typography.Paragraph type="secondary">
            配置接口分页、增量位点和解析错误处理。请求参数在“请求参数配置”中统一维护；失败重试使用页面底部调度配置。
          </Typography.Paragraph>
          <Row gutter={[12, 0]}>
            <Col xs={24} md={8}>
              <Form.Item label="分页方式" name="apiPaginationType" style={compactItemStyle}>
                <Select
                  style={compactControlStyle}
                  options={[
                    { value: "none", label: "不分页" },
                    { value: "page", label: "页码分页" },
                    { value: "offset", label: "偏移分页" },
                    { value: "cursor", label: "游标分页" }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="每页条数" name="apiPageSize" style={compactItemStyle}>
                <InputNumber min={1} max={5000} style={compactControlStyle} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="最大页数" name="apiMaxPages" style={compactItemStyle}>
                <InputNumber min={1} max={1000} style={compactControlStyle} />
              </Form.Item>
            </Col>
            {apiPaginationType !== "none" ? (
              <Col xs={24} md={8}>
                <Form.Item label="分页参数位置" name="apiPaginationInjectInto" style={compactItemStyle}>
                  <Select options={[{ value: "query", label: "URL 参数" }, { value: "header", label: "请求头" }, { value: "body", label: "请求体" }]} />
                </Form.Item>
              </Col>
            ) : null}
            {apiPaginationType === "page" ? (
              <>
                <Col xs={24} md={8}>
                  <Form.Item label="页码参数名" name="apiPageParam" style={compactItemStyle}>
                    <Input style={compactControlStyle} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="条数参数名" name="apiPageSizeParam" style={compactItemStyle}>
                    <Input style={compactControlStyle} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="起始页码" name="apiStartPage" style={compactItemStyle}>
                    <InputNumber min={0} style={compactControlStyle} />
                  </Form.Item>
                </Col>
              </>
            ) : null}
            {apiPaginationType === "offset" ? (
              <>
                <Col xs={24} md={8}>
                  <Form.Item label="偏移参数名" name="apiOffsetParam" style={compactItemStyle}>
                    <Input style={compactControlStyle} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="条数参数名" name="apiLimitParam" style={compactItemStyle}>
                    <Input style={compactControlStyle} />
                  </Form.Item>
                </Col>
              </>
            ) : null}
            {apiPaginationType === "cursor" ? (
              <>
                <Col xs={24} md={8}>
                  <Form.Item label="游标参数名" name="apiCursorParam" style={compactItemStyle}>
                    <Input style={compactControlStyle} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="条数参数名" name="apiPageSizeParam" style={compactItemStyle}>
                    <Input style={compactControlStyle} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="下页游标路径" name="apiNextCursorPath" style={compactItemStyle}>
                    <Input placeholder="例如：data.nextCursor" style={compactControlStyle} />
                  </Form.Item>
                </Col>
              </>
            ) : null}
            <Col xs={24}>
              <Divider style={{ margin: "4px 0 12px" }} />
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="同步模式" name="syncMode" rules={[{ required: true, message: "请选择同步模式" }]} style={compactItemStyle}>
                <Select
                  style={compactControlStyle}
                  options={[
                    { value: "full", label: "接口全量同步" },
                    { value: "incremental", label: "接口增量同步" }
                  ]}
                />
              </Form.Item>
            </Col>
            {syncMode === "incremental" ? (
              <>
                <Col xs={24} md={8}>
                  <Form.Item label="位点来源字段" name="apiCursorField" rules={[{ required: true, message: "请输入位点来源字段" }]} style={compactItemStyle}>
                    <Input placeholder="例如：updated_at" style={compactControlStyle} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="首次起始值" name="apiStartValue" style={compactItemStyle}>
                    <Input placeholder="例如：2026-01-01T00:00:00Z" style={compactControlStyle} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="开始参数名" name="apiIncrementalStartParam" style={compactItemStyle}>
                    <Input placeholder="例如：startTime" style={compactControlStyle} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="结束参数名" name="apiIncrementalEndParam" style={compactItemStyle}>
                    <Input placeholder="例如：endTime" style={compactControlStyle} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="增量参数位置" name="apiIncrementalInjectInto" style={compactItemStyle}>
                    <Select options={[{ value: "query", label: "URL 参数" }, { value: "header", label: "请求头" }, { value: "body", label: "请求体" }]} />
                  </Form.Item>
                </Col>
              </>
            ) : null}
            <Col xs={24} md={12}>
              <Form.Item label="成功状态码" name="apiSuccessStatusCodes" style={compactItemStyle}>
                <Input placeholder="例如：200,201" style={compactControlStyle} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="可重试状态码" name="apiRetryStatusCodes" style={compactItemStyle}>
                <Input placeholder="例如：429,500,502,503,504" style={compactControlStyle} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="解析错误处理" name="skipErrorRows" style={compactItemStyle}>
                <Select
                  style={compactControlStyle}
                  options={[
                    { value: true, label: "跳过错误记录继续执行" },
                    { value: false, label: "遇到错误立即终止" }
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Modal>

        <Modal
          open={apiDocumentModalOpen}
          title="AI接口文档解析"
          width={920}
          okText={apiDocumentProposal ? "确认并回填任务" : "开始解析"}
          cancelText={apiDocumentProposal ? "继续调整" : "关闭"}
          confirmLoading={apiDocumentParsing}
          onOk={() => {
            if (apiDocumentProposal) {
              applyApiDocumentProposal();
              return;
            }
            void handleParseApiDocument();
          }}
          onCancel={() => {
            if (!apiDocumentParsing) setApiDocumentModalOpen(false);
          }}
        >
          {!apiDocumentProposal ? (
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                可粘贴 curl、请求方式、参数说明、响应示例或上传接口文档。系统会先生成方案，确认后才回填当前任务，不会自动创建任务。
              </Typography.Paragraph>
              <Input.TextArea
                value={apiDocumentInput}
                rows={8}
                maxLength={12000}
                showCount
                onChange={(event) => setApiDocumentInput(event.target.value)}
                placeholder={"例如：GET /v1/users，Header 中传 X-App-Token，Query 参数 page、pageSize，响应 data.records 为用户列表。"}
              />
              <Upload
                maxCount={1}
                accept=".pdf,.docx,.xlsx,.xls,.json,.yaml,.yml,.md,.txt,.html,.htm"
                beforeUpload={(file) => {
                  setApiDocumentFile(file);
                  return false;
                }}
                onRemove={() => {
                  setApiDocumentFile(null);
                  return true;
                }}
              >
                <Button icon={<UploadOutlined />}>上传接口文档</Button>
              </Upload>
              <Typography.Text type="secondary">
                支持 PDF、Word、Excel、OpenAPI/JSON、YAML、Markdown、文本和 HTML；扫描版 PDF 请上传可复制文本版。
              </Typography.Text>
            </Space>
          ) : (
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <Card size="small" title="解析方案">
                <Typography.Paragraph style={{ marginBottom: 8 }}>{apiDocumentProposal.summary}</Typography.Paragraph>
                <Row gutter={[12, 8]}>
                  <Col xs={24} md={8}>请求方式：<Typography.Text strong>{apiDocumentProposal.sourceConfig?.method || "GET"}</Typography.Text></Col>
                  <Col xs={24} md={8}>接口路径：<Typography.Text strong>{apiDocumentProposal.sourceConfig?.endpointPath || "待确认"}</Typography.Text></Col>
                  <Col xs={24} md={8}>返回记录路径：<Typography.Text strong>{apiDocumentProposal.parseConfig?.recordPath || "根对象"}</Typography.Text></Col>
                  <Col xs={24} md={8}>认证方式：<Typography.Text strong>{apiDocumentProposal.sourceConfig?.auth?.authType === "api_key" ? "API Key" : apiDocumentProposal.sourceConfig?.auth?.authType || "无认证"}</Typography.Text></Col>
                  <Col xs={24} md={8}>请求参数：<Typography.Text strong>{[...(apiDocumentProposal.sourceConfig?.headers || []), ...(apiDocumentProposal.sourceConfig?.queryParams || []), ...(apiDocumentProposal.sourceConfig?.bodyParams || [])].length} 个</Typography.Text></Col>
                  <Col xs={24} md={8}>同步策略：<Typography.Text strong>{apiDocumentProposal.sourceConfig?.incremental?.enabled ? "增量同步" : "全量同步"}</Typography.Text></Col>
                </Row>
              </Card>
              {apiDocumentProposal.reasoning.length ? (
                <Card size="small" title="识别依据">
                  {apiDocumentProposal.reasoning.map((item) => <Typography.Paragraph key={item} style={{ marginBottom: 4 }}>• {item}</Typography.Paragraph>)}
                </Card>
              ) : null}
              {apiDocumentProposal.assumptions.length || apiDocumentProposal.missingItems.length ? (
                <Card size="small" title="人工确认项">
                  {apiDocumentProposal.assumptions.map((item) => <Typography.Paragraph key={`assumption-${item}`} style={{ marginBottom: 4 }}>假设：{item}</Typography.Paragraph>)}
                  {apiDocumentProposal.missingItems.map((item) => <Typography.Paragraph key={`missing-${item}`} type="warning" style={{ marginBottom: 4 }}>待确认：{item}</Typography.Paragraph>)}
                </Card>
              ) : null}
              <Typography.Text type="secondary">确认后可继续在“接口基础配置、请求参数配置、执行策略配置”中逐项调整。</Typography.Text>
            </Space>
          )}
        </Modal>
      </Form>

      <Modal
        forceRender
        destroyOnHidden={false}
        okText="开始AI推荐"
        open={aiModalOpen}
        title="AI配置推荐"
        cancelButtonProps={{ disabled: aiRecommending }}
        confirmLoading={aiRecommending}
        width={760}
        onCancel={closeAiRecommendModal}
        onOk={() => void handleAiRecommend()}
      >
        <Form<AiRecommendFormValues>
          form={aiRecommendForm}
          layout="vertical"
          colon={false}
          initialValues={{
            sourceId: form.getFieldValue("sourceId"),
            sourceTable: form.getFieldValue("sourceTable"),
            targetSourceId: form.getFieldValue("targetSourceId")
          }}
        >
          <Row gutter={[12, 0]}>
            <Col xs={24} md={8}>
              <Form.Item
                label="来源数据源"
                name="sourceId"
                rules={[{ required: true, message: "请选择来源数据源" }]}
                style={compactItemStyle}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择来源数据源"
                  style={compactControlStyle}
                  onChange={(value) => {
                    setAiSourceId(value);
                    aiRecommendForm.setFieldValue("sourceTable", undefined);
                  }}
                  options={dataSources.map((item) => ({
                    value: item.id,
                    label: `${item.sourceName} (${item.connectionConfig?.database || item.sourceCode})`
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="来源表"
                name="sourceTable"
                rules={[{ required: true, message: "请选择来源表" }]}
                style={compactItemStyle}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择来源表"
                  style={compactControlStyle}
                  options={aiSourceTables.map((item) => ({
                    value: item.tableName,
                    label: item.tableComment
                      ? `${item.tableName} (${item.tableComment})`
                      : item.tableName
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="目标数据源"
                name="targetSourceId"
                rules={[{ required: true, message: "请选择目标数据源" }]}
                style={compactItemStyle}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择目标数据源"
                  style={compactControlStyle}
                  options={dataSources.map((item) => ({
                    value: item.id,
                    label: `${item.sourceName} (${item.connectionConfig?.database || item.sourceCode})`
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {aiSourceType === "hive" ? (
            <Card size="small" styles={{ body: { padding: 12 } }} style={{ marginBottom: 12 }}>
              <Typography.Text type="secondary">
                当前来源为 Hive 数据源。AI 推荐会结合 Hive 表结构和样例数据生成任务方案，但不会推断索引/约束类信息。
              </Typography.Text>
            </Card>
          ) : null}

          <Card
            size="small"
            title="运行日志"
            styles={{ body: { padding: 12 } }}
          >
            <div
              style={{
                background: "#0b1220",
                borderRadius: 6,
                color: "#d7e3ff",
                fontFamily: "Consolas, Monaco, monospace",
                fontSize: 12,
                lineHeight: 1.6,
                maxHeight: 240,
                minHeight: 160,
                overflow: "auto",
                padding: 12,
                whiteSpace: "pre-wrap"
              }}
            >
              {aiRecommendLogs.length > 0
                ? aiRecommendLogs.join("\n")
                : "等待开始 AI 配置推荐。"}
            </div>
          </Card>

          {aiRecommendReasoning.length > 0 ? (
            <Card
              size="small"
              title="推荐依据"
              styles={{ body: { padding: 12 } }}
              style={{ marginTop: 12 }}
            >
              <Space direction="vertical" size={8} style={{ display: "flex" }}>
                {aiRecommendReasoning.map((item, index) => (
                  <Typography.Text key={`${index}-${item}`}>{`${index + 1}. ${item}`}</Typography.Text>
                ))}
              </Space>
            </Card>
          ) : null}
        </Form>
      </Modal>
      <Modal
        open={ftpObjectPickerOpen}
        title="FTP 目录/文件浏览"
        width={980}
        footer={null}
        onCancel={() => setFtpObjectPickerOpen(false)}
        destroyOnHidden
      >
        <Space direction="vertical" size={12} style={{ display: "flex" }}>
          <Input
            allowClear
            placeholder="搜索目录或文件路径"
            value={ftpObjectSearch}
            onChange={(event) => setFtpObjectSearch(event.target.value)}
          />
          <Table<DataSourceTable>
            size="small"
            bordered
            rowKey="tableName"
            dataSource={filteredFtpObjects}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ y: 420 }}
            onRow={(record) => ({
              onDoubleClick: () => selectFtpObject(record)
            })}
            columns={[
              {
                title: "路径",
                dataIndex: "tableName",
                key: "tableName",
                render: (value: string, record) => (
                  <Space direction="vertical" size={2} style={{ display: "flex" }}>
                    <Typography.Text
                      strong={record.tableName === sourceTable}
                      style={{ wordBreak: "break-all" }}
                    >
                      {value}
                    </Typography.Text>
                    {record.tableComment ? (
                      <Typography.Text type="secondary">{record.tableComment}</Typography.Text>
                    ) : null}
                  </Space>
                )
              },
              {
                title: "类型",
                dataIndex: "objectType",
                key: "objectType",
                width: 90,
                render: (value: string) => ftpObjectTypeLabel[value] || value || "-"
              },
              {
                title: "大小",
                dataIndex: "fileSize",
                key: "fileSize",
                width: 110,
                render: (value: number | undefined, record) =>
                  record.objectType === "directory" ? "-" : formatFileSize(value)
              },
              {
                title: "修改时间",
                dataIndex: "modifiedAt",
                key: "modifiedAt",
                width: 180,
                render: (value: string | null | undefined) => value || "-"
              },
              {
                title: "操作",
                key: "action",
                width: 100,
                render: (_value: unknown, record) =>
                  record.tableName === sourceTable ? (
                    <Typography.Text type="secondary">当前</Typography.Text>
                  ) : (
                    <Button size="small" onClick={() => selectFtpObject(record)}>
                      选择
                    </Button>
                  )
              }
            ]}
            locale={{ emptyText: "没有匹配的 FTP 目录或文件" }}
          />
        </Space>
      </Modal>
      <Modal
        open={sourcePreviewOpen}
        title={
          sourcePreviewResult
            ? `来源数据预览：${sourcePreviewResult.sourceName} / ${sourcePreviewResult.sourceTable}`
            : "来源数据预览"
        }
        width={1100}
        footer={null}
        onCancel={() => setSourcePreviewOpen(false)}
      >
        <Space direction="vertical" size={12} style={{ display: "flex" }}>
          <Typography.Text type="secondary">
            当前预览基于来源配置和解析配置实时读取，不会保存任务、写入目标表或提交 Kafka 位点。
          </Typography.Text>
          <Table<Record<string, unknown>>
            size="small"
            bordered
            rowKey={(_record, index) => String(index)}
            loading={sourcePreviewLoading}
            columns={sourcePreviewColumns}
            dataSource={sourcePreviewResult?.rows || []}
            pagination={false}
            scroll={{ x: "max-content", y: 420 }}
            locale={{ emptyText: "当前配置未读取到样例数据" }}
          />
        </Space>
      </Modal>
    </Space>
  );
}

function getWriteModeOptions(
  targetSourceType: string,
  connectionConfig?: DataSourceRecord["connectionConfig"]
) {
  const normalizedTargetType = normalizeTargetSourceType(targetSourceType, connectionConfig);

  if (normalizedTargetType === "postgresql") {
    return [
      { value: "append", label: "追加写入" },
      { value: "upsert", label: "主键更新（幂等）" },
      { value: "overwrite", label: "覆盖写入" }
    ];
  }

  if (normalizedTargetType === "hive") {
    return [
      { value: "append", label: "追加写入" },
      { value: "overwrite", label: "覆盖写入" },
      { value: "partition_overwrite", label: "覆盖最新分区" }
    ];
  }

  return [
    { value: "append", label: "追加写入" },
    { value: "replace", label: "主键更新" },
    { value: "overwrite", label: "覆盖写入" }
  ];
}

function buildMappings(
  nextSourceColumns: DataSourceColumn[],
  nextTargetColumns: DataSourceColumn[],
  currentMappings: MappingRow[] = [],
  targetTableMode: TargetTableMode,
  targetSourceType?: string,
  targetConnectionConfig?: DataSourceRecord["connectionConfig"]
) {
  const customMappings = currentMappings.filter((item) => item.isCustom);
  const targetColumnMap = new Map(
    nextTargetColumns.map((column) => [column.columnName, column] as const)
  );
  const currentMappingMap = new Map(
    currentMappings.map((item) => [item.sourceField, item] as const)
  );

  const sourceMappings = nextSourceColumns.map<MappingRow>((column) => {
    const current = currentMappingMap.get(column.columnName);
    const defaultTargetField =
      targetTableMode === "create"
        ? current?.targetField || column.columnName
        : targetColumnMap.has(column.columnName)
          ? column.columnName
          : current?.targetField || "";

    const hasExistingTarget =
      targetTableMode === "create" ||
      !defaultTargetField ||
      targetColumnMap.has(defaultTargetField);

    return {
      enabled: current?.enabled ?? Boolean(defaultTargetField || targetTableMode === "create"),
      sourceField: column.columnName,
      targetField: hasExistingTarget ? defaultTargetField : "",
      dataType:
        current?.dataType && current?.autoInferredType === false
          ? normalizeMappingDataType(current.dataType, targetSourceType, targetConnectionConfig)
          : suggestTargetDataType(column, targetSourceType, targetConnectionConfig),
      defaultValue: current?.defaultValue,
      isPrimaryKey: current?.isPrimaryKey ?? column.isPrimaryKey,
      sourceComment: column.columnComment || "",
      autoInferredType: current?.autoInferredType === false ? false : true,
    };
  });

  return [...sourceMappings, ...customMappings];
}

function resolveScheduleType(scheduleConfig?: IngestionTask["scheduleConfig"]): BusinessScheduleType {
  const type = scheduleConfig?.scheduleType;
  return type && ["manual", "interval", "daily", "weekly", "monthly", "cron"].includes(type)
    ? (type as BusinessScheduleType)
    : "manual";
}

function buildRecommendedTaskCode(taskName?: string, sourceTable?: string) {
  const normalized = String(taskName || sourceTable || "ingestion_task")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  const base = normalized || "ingestion_task";
  return base.length > 64 ? base.slice(0, 64) : base;
}




