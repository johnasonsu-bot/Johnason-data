import {
  ArrowLeftOutlined,
  CalendarOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  PauseOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CopyOutlined,
  EditOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Menu,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { PageToolbar } from "../../components/ui/PageToolbar";
import {
  createDevProcessingJob,
  createDevWorkflowFromTask,
  deleteDevProcessingJob,
  fetchDevColumns,
  fetchDevDatabases,
  fetchDevDatasources,
  fetchDevProcessingJob,
  fetchDevProcessingJobs,
  fetchDevProcessingJobRuns,
  fetchDevTables,
  previewDevProcessingDraft,
  runDevProcessingJob,
  updateDevProcessingJob,
} from "../../services/dataDevelopment";
import type {
  DevColumnEntry,
  DevDatasourceRecord,
  DevDatabaseEntry,
  DevProcessingJobRecord,
  DevProcessingPreviewResult,
  DevProcessingRunRecord,
  DevProcessingStepRecord,
  DevTableEntry,
  DevProcessingTargetFieldMapping,
} from "../../types/api";

type ProcessingFormValues = {
  name: string;
  description?: string;
  datasourceId: number;
  databaseName?: string;
  tableName?: string;
  ownerName?: string;
  sampleLimit: number;
  scopeMode?: "all" | "system_time_range";
  scopeFieldName?: string;
  scopeTimeVariable?: "current_date" | "current_time" | "current_timestamp";
  scopeTimeFormat?: string;
  scopeStartOffset?: number;
  scopeEndOffset?: number;
  scopeOffsetUnit?: "day" | "hour" | "minute" | "month";
  scheduleEnabled?: boolean;
  scheduleType?: "manual" | "daily" | "weekly" | "cron";
  scheduleTime?: string;
  scheduleDay?: number;
  scheduleCronExpr?: string;
  targetMode?: "create" | "existing" | "source";
  targetWriteMode?: "overwrite" | "append";
  targetConfigDatabaseName?: string;
  targetConfigTableName?: string;
};

type CreateProcessingTaskValues = {
  name: string;
  datasourceId: number;
  description?: string;
};

type FieldConfigValues = {
  transform?: "" | "trim" | "remove_spaces" | "upper" | "lower" | "full_to_half" | "half_to_full" | "date_format" | "regex_replace" | "substring" | "blank_to_null" | "null_to_default" | "desensitize_mask" | "desensitize_replace" | "desensitize_encrypt" | "desensitize_generalize" | "number_round";
  format?: string;
  pattern?: string;
  replacement?: string;
  start?: string;
  length?: string;
  defaultValue?: string;
  precision?: string;
  maskChar?: string;
  prefixLength?: string;
  suffixLength?: string;
  replacePattern?: string;
  replaceValue?: string;
  encryptAlgorithm?: "md5" | "sha1" | "sha256";
  salt?: string;
  generalizeLength?: string;
  validationType?: "" | "required" | "regex" | "enum" | "range" | "length" | "custom";
  mode?: "keep_valid" | "drop_invalid";
  tagFieldName?: string;
  validationPattern?: string;
  enumValues?: string;
  minValue?: string;
  maxValue?: string;
  minLength?: string;
  maxLength?: string;
  customExpression?: string;
};

type JointRuleValues = {
  stepKey?: string;
  stepType: "filter" | "deduplicate" | "validate";
  stepName?: string;
  expression?: string;
  keyFields?: string[];
  orderBy?: string;
  mode?: "keep_valid" | "drop_invalid";
};

type LookupRuleValues = {
  stepKey?: string;
  stepName?: string;
  lookupTable: string;
  lookupSqlFilter?: string;
  sourceField: string;
  lookupKeyField: string;
  lookupValueField: string;
  targetFieldMode?: "existing" | "custom";
  targetField: string;
  targetFieldCustom?: string;
  targetFieldDataType?: string;
  targetFieldComment?: string;
};

type TargetMappingRow = DevProcessingTargetFieldMapping & { key: string };

type FieldRuleCategory = "format" | "validate";

type FieldRuleCatalogGroup = {
  key: string;
  title: string;
  description: string;
  items: FieldRuleCatalogItem[];
};

type FieldRuleCatalogItem = {
  key: string;
  title: string;
  description: string;
  category: FieldRuleCategory;
  type: string;
  quick?: boolean;
  stringOnly?: boolean;
};

const transformOptions = [
  { value: "trim", label: "去除首尾空格" },
  { value: "remove_spaces", label: "全部去空格" },
  { value: "upper", label: "转大写" },
  { value: "lower", label: "转小写" },
  { value: "full_to_half", label: "全角转半角" },
  { value: "half_to_full", label: "半角转全角" },
  { value: "date_format", label: "日期格式化" },
  { value: "regex_replace", label: "正则替换" },
  { value: "substring", label: "字符截取" },
  { value: "blank_to_null", label: "空白转 NULL" },
  { value: "null_to_default", label: "空值填充" },
  { value: "desensitize_mask", label: "掩码" },
  { value: "desensitize_replace", label: "替换" },
  { value: "desensitize_encrypt", label: "加密" },
  { value: "desensitize_generalize", label: "泛化" },
  { value: "number_round", label: "数值保留小数" },
];

const validationTypeOptions = [
  { value: "required", label: "非空校验" },
  { value: "regex", label: "正则校验" },
  { value: "enum", label: "值域枚举" },
  { value: "range", label: "数值范围" },
  { value: "length", label: "长度范围" },
  { value: "custom", label: "自定义表达式" },
];

const fieldRuleCatalog: FieldRuleCatalogGroup[] = [
  {
    key: "quick",
    title: "快捷清洗",
    description: "常用字段清洗动作",
    items: [
      { key: "trim", title: "去首尾空白", description: "清理字段前后空白字符", category: "format", type: "trim", quick: true, stringOnly: true },
      { key: "remove_spaces", title: "去除全部空格", description: "移除字段中的全部空格", category: "format", type: "remove_spaces", quick: true, stringOnly: true },
      { key: "blank_to_null", title: "空白转空值", description: "将空字符串或纯空白转为 NULL", category: "format", type: "blank_to_null", quick: true },
      { key: "null_to_default", title: "空值填充", description: "为空值写入默认内容", category: "format", type: "null_to_default", quick: true },
      { key: "required_filter", title: "空值过滤", description: "过滤空值记录", category: "validate", type: "required", quick: true },
    ],
  },
  {
    key: "string",
    title: "字符处理",
    description: "替换、截取、大小写与全半角转换",
    items: [
      { key: "upper", title: "转大写", description: "统一英文字母大写", category: "format", type: "upper", stringOnly: true },
      { key: "lower", title: "转小写", description: "统一英文字母小写", category: "format", type: "lower", stringOnly: true },
      { key: "full_to_half", title: "全角转半角", description: "标准化全角字符", category: "format", type: "full_to_half", stringOnly: true },
      { key: "half_to_full", title: "半角转全角", description: "转换为全角字符", category: "format", type: "half_to_full", stringOnly: true },
      { key: "regex_replace", title: "正则替换", description: "按正则匹配并替换字段内容", category: "format", type: "regex_replace", stringOnly: true },
      { key: "substring", title: "字符截取", description: "按起始位置和长度截取", category: "format", type: "substring", stringOnly: true },
    ],
  },
  {
    key: "format",
    title: "类型与格式",
    description: "日期、数值和空值格式化",
    items: [
      { key: "date_format", title: "日期格式化", description: "输出统一日期时间格式", category: "format", type: "date_format" },
      { key: "number_round", title: "数值保留小数", description: "按指定精度四舍五入", category: "format", type: "number_round" },
      { key: "blank_to_null", title: "空白转空值", description: "把空字符串或纯空白内容转为 NULL", category: "format", type: "blank_to_null" },
      { key: "null_to_default", title: "空值填充", description: "为空值写入默认值", category: "format", type: "null_to_default" },
    ],
  },
  {
    key: "validate",
    title: "校验规则",
    description: "控制无效数据保留、打标或过滤",
    items: [
      { key: "required", title: "非空校验", description: "识别字段为空的记录", category: "validate", type: "required" },
      { key: "regex", title: "正则校验", description: "按正则表达式校验格式", category: "validate", type: "regex" },
      { key: "enum", title: "值域枚举", description: "限定字段只能来自枚举清单", category: "validate", type: "enum" },
      { key: "range", title: "数值范围", description: "校验数值上下限", category: "validate", type: "range" },
      { key: "length", title: "长度范围", description: "校验文本长度上下限", category: "validate", type: "length" },
      { key: "custom", title: "自定义表达式", description: "使用 SQL 条件表达式校验", category: "validate", type: "custom" },
    ],
  },
  {
    key: "security",
    title: "脱敏处理",
    description: "掩码、替换、加密与泛化",
    items: [
      { key: "desensitize_mask", title: "掩码", description: "保留前后缀，中间用指定字符遮蔽", category: "format", type: "desensitize_mask", stringOnly: true },
      { key: "desensitize_replace", title: "替换", description: "按固定值或规则表达式替换内容", category: "format", type: "desensitize_replace", stringOnly: true },
      { key: "desensitize_encrypt", title: "加密", description: "对字段做哈希处理并支持加盐", category: "format", type: "desensitize_encrypt", stringOnly: true },
      { key: "desensitize_generalize", title: "泛化", description: "通过截断保留或简化内容", category: "format", type: "desensitize_generalize", stringOnly: true },
    ],
  },
];

const desensitizeTransformLabels: Record<string, string> = {
  "": "未设置",
  trim: "去除首尾空格",
  remove_spaces: "全部去空格",
  upper: "转大写",
  lower: "转小写",
  full_to_half: "全角转半角",
  half_to_full: "半角转全角",
  date_format: "日期格式化",
  regex_replace: "正则替换",
  substring: "字符截取",
  blank_to_null: "空白转 NULL",
  null_to_default: "空值填充",
  desensitize_mask: "掩码",
  desensitize_replace: "替换",
  desensitize_encrypt: "加密",
  desensitize_generalize: "泛化",
  number_round: "数值保留小数",
};

const legacyDesensitizeTransformMap: Record<string, NonNullable<FieldConfigValues["transform"]>> = {
  mask_mobile: "desensitize_mask",
  mask_id_card: "desensitize_mask",
  mask_email: "desensitize_mask",
};

const scopeModeOptions = [
  { value: "all", label: "全量处理" },
  { value: "system_time_range", label: "系统时间变量" },
];

const scopeTimeVariableOptions = [
  { value: "current_date", label: "当前日期" },
  { value: "current_time", label: "当前时间" },
  { value: "current_timestamp", label: "当前时间戳" },
];

const scopeOffsetUnitOptions = [
  { value: "day", label: "天" },
  { value: "hour", label: "小时" },
  { value: "minute", label: "分钟" },
  { value: "month", label: "月" },
];

const scheduleTypeOptions = [
  { value: "manual", label: "手动执行" },
  { value: "daily", label: "按天调度" },
  { value: "weekly", label: "按周调度" },
  { value: "cron", label: "Cron 表达式" },
];

const targetModeOptions = [
  { value: "create", label: "创建新表" },
  { value: "existing", label: "写入已有表" },
  { value: "source", label: "写回原表" },
];

const targetWriteModeOptions = [
  { value: "overwrite", label: "覆盖写入" },
  { value: "append", label: "追加写入" },
];

const PENDING_SOURCE_TABLE = "__pending_source_table__";

function compactToken(value?: string | number | null, maxLength = 12) {
  const text = String(value ?? "").trim().replace(/[^a-zA-Z0-9_]/g, "_");
  return text.slice(0, maxLength) || "x";
}

function buildCompactStepKey(parts: Array<string | number | null | undefined>) {
  const timestamp = Date.now().toString(36);
  const body = parts.map((part, index) => compactToken(part, index === 0 ? 8 : 12)).filter(Boolean).join("_");
  return `${body}_${timestamp}`.slice(0, 64);
}

function createStep(stepType: DevProcessingStepRecord["stepType"], index: number, config?: Record<string, unknown>): DevProcessingStepRecord {
  const nameMap: Record<DevProcessingStepRecord["stepType"], string> = {
    filter: "数据过滤",
    deduplicate: "联合去重",
    format: "格式转换",
    validate: "内容校验",
    lookup_fill: "关联回填",
  };
  return {
    stepKey: `step_${Date.now()}_${index}`,
    stepName: `${nameMap[stepType]}${index + 1}`,
    stepType,
    enabled: true,
    config: config || {},
  };
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function renderRunStatus(status?: string | null) {
  const normalized = String(status || "draft");
  const color =
    normalized === "completed" || normalized === "active" ? "green"
      : normalized === "running" ? "blue"
        : normalized === "failed" ? "red"
          : "default";
  return <Tag color={color}>{normalized}</Tag>;
}

function isPostgresFamily(datasourceType?: string | null) {
  return /postgres|gauss/i.test(String(datasourceType || ""));
}

function escapeSqlText(value: string) {
  return String(value || "").replace(/'/g, "''");
}

function normalizeCsvValues(value?: string) {
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isStringLikeColumn(column?: Pick<DevColumnEntry, "dataType" | "columnType"> | null) {
  const type = String(column?.columnType || column?.dataType || "").toLowerCase();
  return /(char|text|string|json|xml|uuid|enum)/.test(type);
}

function isNumberLikeColumn(column?: Pick<DevColumnEntry, "dataType" | "columnType"> | null) {
  const type = String(column?.columnType || column?.dataType || "").toLowerCase();
  return /(int|decimal|numeric|number|float|double|real|money)/.test(type);
}

function isDateLikeColumn(column?: Pick<DevColumnEntry, "dataType" | "columnType"> | null) {
  const type = String(column?.columnType || column?.dataType || "").toLowerCase();
  return /(date|time|timestamp|datetime)/.test(type);
}

function buildFieldValidationExpression(fieldName: string, values: FieldConfigValues, datasourceType?: string | null) {
  const validationType = values.validationType || "";
  if (!validationType) return "";

  if (validationType === "required") return `${fieldName} IS NOT NULL`;

  if (validationType === "regex") {
    const pattern = String(values.validationPattern || "").trim();
    if (!pattern) return "";
    return isPostgresFamily(datasourceType)
      ? `${fieldName} ~ '${escapeSqlText(pattern)}'`
      : `${fieldName} REGEXP '${escapeSqlText(pattern)}'`;
  }

  if (validationType === "enum") {
    const enumValues = normalizeCsvValues(values.enumValues);
    if (!enumValues.length) return "";
    return `${fieldName} IN (${enumValues.map((item) => `'${escapeSqlText(item)}'`).join(", ")})`;
  }

  if (validationType === "range") {
    const minValue = String(values.minValue || "").trim();
    const maxValue = String(values.maxValue || "").trim();
    if (minValue && maxValue) return `${fieldName} >= ${minValue} AND ${fieldName} <= ${maxValue}`;
    if (minValue) return `${fieldName} >= ${minValue}`;
    if (maxValue) return `${fieldName} <= ${maxValue}`;
    return "";
  }

  if (validationType === "length") {
    const minLength = String(values.minLength || "").trim();
    const maxLength = String(values.maxLength || "").trim();
    if (minLength && maxLength) return `CHAR_LENGTH(${fieldName}) >= ${minLength} AND CHAR_LENGTH(${fieldName}) <= ${maxLength}`;
    if (minLength) return `CHAR_LENGTH(${fieldName}) >= ${minLength}`;
    if (maxLength) return `CHAR_LENGTH(${fieldName}) <= ${maxLength}`;
    return "";
  }

  if (validationType === "custom") return String(values.customExpression || "").trim();
  return "";
}

function buildValidationTagFieldName(fieldName: string, validationType?: string) {
  const suffixMap: Record<string, string> = {
    required: "required_flag",
    regex: "regex_flag",
    enum: "enum_flag",
    range: "range_flag",
    length: "length_flag",
    custom: "custom_flag",
  };
  const suffix = suffixMap[String(validationType || "")] || "validation_flag";
  return `${fieldName}_${suffix}`;
}

function buildProcessingPipelinePayload(values: ProcessingFormValues, steps: DevProcessingStepRecord[], targetMappings: TargetMappingRow[]) {
  const normalizedMappings = targetMappings
    .map((item) => ({
      sourceField: String(item.sourceField || "").trim(),
      targetField: String(item.targetField || "").trim(),
    }))
    .filter((item) => item.sourceField && item.targetField);

  const scopeMode = values.scopeMode || "all";
  const scheduleType = values.scheduleType || "manual";
  const scheduleEnabled = scheduleType !== "manual";
  const normalizedScope = scopeMode === "system_time_range"
    ? {
      mode: "system_time_range",
      fieldName: values.scopeFieldName || null,
      timeVariable: values.scopeTimeVariable || "current_date",
      timeFormat: String(values.scopeTimeFormat || "").trim() || "%Y-%m-%d %H:%i:%s",
      startOffset: values.scopeStartOffset ?? -7,
      endOffset: values.scopeEndOffset ?? -1,
      offsetUnit: values.scopeOffsetUnit || "day",
    }
    : {
      mode: "all",
      fieldName: null,
      timeVariable: null,
      timeFormat: null,
      startOffset: null,
      endOffset: null,
      offsetUnit: null,
    };

  return {
    sampleLimit: values.sampleLimit || 50,
    scope: normalizedScope,
    schedule: scheduleEnabled ? {
      enabled: true,
      scheduleType,
      executeTime: ["daily", "weekly"].includes(scheduleType) ? (String(values.scheduleTime || "").trim() || "02:00") : null,
      executeDay: scheduleType === "weekly" ? (values.scheduleDay ?? 1) : null,
      cronExpr: scheduleType === "cron" ? (String(values.scheduleCronExpr || "").trim() || null) : null,
    } : {
      enabled: false,
      scheduleType: "manual",
      executeTime: null,
      executeDay: null,
      cronExpr: null,
    },
    targetConfig: {
      targetMode: values.targetMode || "create",
      writeMode: values.targetWriteMode || "overwrite",
      targetDatabaseName: values.targetConfigDatabaseName || values.databaseName || null,
      targetTableName: values.targetConfigTableName || null,
      fieldMappings: normalizedMappings,
    },
    steps,
  };
}

function getStepTypeLabel(stepType: DevProcessingStepRecord["stepType"]) {
  const labelMap: Record<DevProcessingStepRecord["stepType"], string> = {
    filter: "数据过滤",
    deduplicate: "联合去重",
    format: "格式转换",
    validate: "内容校验",
    lookup_fill: "关联回填",
  };
  return labelMap[stepType] || stepType;
}

function describeFormatStep(step: DevProcessingStepRecord) {
  const transform = String(step.config?.transform || "");
  const normalizedTransform = legacyDesensitizeTransformMap[transform] || transform;
  const transformLabel = desensitizeTransformLabels[normalizedTransform as keyof typeof desensitizeTransformLabels] || transformOptions.find((item) => item.value === normalizedTransform)?.label || transform || "未设置";
  const fieldName = String(step.config?.fieldName || "");
  if (transform === "date_format") return `${fieldName} -> ${transformLabel} (${step.config?.format || "-"})`;
  if (transform === "regex_replace") return `${fieldName} -> ${transformLabel} (${step.config?.pattern || "-"} => ${step.config?.replacement || ""})`;
  if (transform === "substring") return `${fieldName} -> ${transformLabel} (${step.config?.start || 0}, ${step.config?.length || "-"})`;
  if (transform === "null_to_default") return `${fieldName} -> ${transformLabel} (${step.config?.defaultValue ?? ""})`;
  if (transform === "number_round") return `${fieldName} -> ${transformLabel} (${step.config?.precision ?? 0} 位)`;
  if (normalizedTransform === "desensitize_mask") {
    return `${fieldName} -> ${transformLabel} (${step.config?.prefixLength || 0}, ${step.config?.suffixLength || 0}, ${step.config?.maskChar || "*"})`;
  }
  if (normalizedTransform === "desensitize_replace") {
    return `${fieldName} -> ${transformLabel} (${step.config?.replacePattern || "-"} => ${step.config?.replaceValue || ""})`;
  }
  if (normalizedTransform === "desensitize_encrypt") {
    return `${fieldName} -> ${transformLabel} (${step.config?.encryptAlgorithm || "md5"}${step.config?.salt ? ` / ${step.config.salt}` : ""})`;
  }
  if (normalizedTransform === "desensitize_generalize") {
    return `${fieldName} -> ${transformLabel} (${step.config?.generalizeLength || 0})`;
  }
  return `${fieldName} -> ${transformLabel}`;
}

function describeValidateStep(step: DevProcessingStepRecord) {
  const validationType = String(step.config?.validationType || "");
  const fieldName = String(step.config?.fieldName || "");
  const mode = step.config?.mode === "drop_invalid" ? "过滤无效记录" : "保留并打标";
  if (validationType === "required" && step.config?.mode === "drop_invalid") {
    return `${fieldName ? `${fieldName} / ` : ""}空值过滤`;
  }
  if (validationType) {
    const label = validationTypeOptions.find((item) => item.value === validationType)?.label || validationType;
    const tagFieldSuffix = step.config?.mode === "drop_invalid" ? "" : ` / 标记字段: ${step.config?.tagFieldName || "-"}`;
    return `${fieldName ? `${fieldName} / ` : ""}${label} / ${mode}${tagFieldSuffix}`;
  }
  return `${step.config?.expression || "-"} / ${mode}`;
}

function describeJointStep(step: DevProcessingStepRecord) {
  if (step.stepType === "filter") return String(step.config?.expression || "-");
  if (step.stepType === "deduplicate") {
    const keys = Array.isArray(step.config?.keyFields) ? (step.config?.keyFields as string[]).join(" + ") : "-";
    return `去重键: ${keys}${step.config?.orderBy ? ` / 排序: ${step.config?.orderBy}` : ""}`;
  }
  return describeValidateStep(step);
}

function describeLookupStep(step: DevProcessingStepRecord) {
  const sqlFilter = String(step.config?.lookupSqlFilter || "").trim();
  return `${step.config?.sourceField || "-"} -> ${step.config?.lookupTable || "-"} (${step.config?.lookupKeyField || "-"} => ${step.config?.lookupValueField || "-"}) -> ${step.config?.targetField || "-"}${sqlFilter ? ` / 条件: ${sqlFilter}` : ""}`;
}

function describeFieldStep(step: DevProcessingStepRecord) {
  return step.stepType === "format" ? describeFormatStep(step) : describeValidateStep(step);
}

function getFieldRuleName(step: DevProcessingStepRecord) {
  if (step.stepType === "format") {
    const transform = String(step.config?.transform || "");
    const normalizedTransform = legacyDesensitizeTransformMap[transform] || transform;
    return desensitizeTransformLabels[normalizedTransform as keyof typeof desensitizeTransformLabels] || transformOptions.find((item) => item.value === normalizedTransform)?.label || transform || "未设置";
  }
  if (step.stepType === "validate") {
    const validationType = String(step.config?.validationType || "");
    return validationTypeOptions.find((item) => item.value === validationType)?.label || validationType || "未设置";
  }
  return getStepTypeLabel(step.stepType);
}

function firstMeaningfulValue(rows: Record<string, unknown>[], fieldName: string) {
  for (const row of rows) {
    const value = row[fieldName];
    if (value !== null && value !== undefined && String(value) !== "") return String(value);
  }
  return "-";
}

function firstMeaningfulRawValue(rows: Record<string, unknown>[], fieldName: string) {
  return firstMeaningfulValue(rows, fieldName);
}

function firstMeaningfulPreviewValue(previewRowsData: Record<string, unknown>[], rawRowsData: Record<string, unknown>[], fieldName: string) {
  if (Array.isArray(previewRowsData) && previewRowsData.length > 0) {
    return firstMeaningfulValue(previewRowsData, fieldName);
  }
  return firstMeaningfulValue(rawRowsData, fieldName);
}

function isPendingSourceTable(tableName?: string | null) {
  return String(tableName || "").startsWith(PENDING_SOURCE_TABLE);
}

function displayTableName(tableName?: string | null) {
  return isPendingSourceTable(tableName) ? "-" : (tableName || "-");
}

function buildFieldDraftFromStep(step?: DevProcessingStepRecord | null): FieldConfigValues {
  const draft: FieldConfigValues = {};
  if (!step) return draft;

  if (step.stepType === "format") {
    const transform = String(step.config?.transform || "");
    const normalizedTransform = legacyDesensitizeTransformMap[transform] || transform;
    if (normalizedTransform) draft.transform = normalizedTransform as FieldConfigValues["transform"];
    if (step.config?.format !== undefined && step.config?.format !== null) draft.format = String(step.config.format);
    if (step.config?.pattern !== undefined && step.config?.pattern !== null) draft.pattern = String(step.config.pattern);
    if (step.config?.replacement !== undefined && step.config?.replacement !== null) draft.replacement = String(step.config.replacement);
    if (step.config?.start !== undefined && step.config?.start !== null) draft.start = String(step.config.start);
    if (step.config?.length !== undefined && step.config?.length !== null) draft.length = String(step.config.length);
    if (step.config?.defaultValue !== undefined && step.config?.defaultValue !== null) draft.defaultValue = String(step.config.defaultValue);
    if (step.config?.precision !== undefined && step.config?.precision !== null) draft.precision = String(step.config.precision);
    if (step.config?.maskChar !== undefined && step.config?.maskChar !== null) draft.maskChar = String(step.config.maskChar);
    if (step.config?.prefixLength !== undefined && step.config?.prefixLength !== null) draft.prefixLength = String(step.config.prefixLength);
    if (step.config?.suffixLength !== undefined && step.config?.suffixLength !== null) draft.suffixLength = String(step.config.suffixLength);
    if (step.config?.replacePattern !== undefined && step.config?.replacePattern !== null) draft.replacePattern = String(step.config.replacePattern);
    if (step.config?.replaceValue !== undefined && step.config?.replaceValue !== null) draft.replaceValue = String(step.config.replaceValue);
    if (step.config?.encryptAlgorithm !== undefined && step.config?.encryptAlgorithm !== null) draft.encryptAlgorithm = step.config.encryptAlgorithm as FieldConfigValues["encryptAlgorithm"];
    if (step.config?.salt !== undefined && step.config?.salt !== null) draft.salt = String(step.config.salt);
    if (step.config?.generalizeLength !== undefined && step.config?.generalizeLength !== null) draft.generalizeLength = String(step.config.generalizeLength);
  }

  if (step.stepType === "validate") {
    if (step.config?.validationType) draft.validationType = step.config.validationType as FieldConfigValues["validationType"];
    if (step.config?.mode) draft.mode = step.config.mode as FieldConfigValues["mode"];
    if (step.config?.tagFieldName !== undefined && step.config?.tagFieldName !== null) draft.tagFieldName = String(step.config.tagFieldName);
    if (step.config?.validationPattern !== undefined && step.config?.validationPattern !== null) draft.validationPattern = String(step.config.validationPattern);
    if (Array.isArray(step.config?.allowedValues)) draft.enumValues = (step.config.allowedValues as string[]).join(", ");
    if (step.config?.minValue !== undefined && step.config?.minValue !== null) draft.minValue = String(step.config.minValue);
    if (step.config?.maxValue !== undefined && step.config?.maxValue !== null) draft.maxValue = String(step.config.maxValue);
    if (step.config?.minLength !== undefined && step.config?.minLength !== null) draft.minLength = String(step.config.minLength);
    if (step.config?.maxLength !== undefined && step.config?.maxLength !== null) draft.maxLength = String(step.config.maxLength);
    if (step.config?.expression !== undefined && step.config?.expression !== null) draft.customExpression = String(step.config.expression);
  }

  return draft;
}

function ProcessingEditor({ jobId }: { jobId: number }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm<ProcessingFormValues>();
  const [jointForm] = Form.useForm<JointRuleValues>();
  const [lookupForm] = Form.useForm<LookupRuleValues>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [jointModalOpen, setJointModalOpen] = useState(false);
  const [lookupModalOpen, setLookupModalOpen] = useState(false);
  const [editingJointStepKey, setEditingJointStepKey] = useState<string | null>(null);
  const [editingLookupStepKey, setEditingLookupStepKey] = useState<string | null>(null);
  const [datasources, setDatasources] = useState<DevDatasourceRecord[]>([]);
  const [databases, setDatabases] = useState<DevDatabaseEntry[]>([]);
  const [tables, setTables] = useState<DevTableEntry[]>([]);
  const [columns, setColumns] = useState<DevColumnEntry[]>([]);
  const [job, setJob] = useState<DevProcessingJobRecord | null>(null);
  const [steps, setSteps] = useState<DevProcessingStepRecord[]>([]);
  const [activeField, setActiveField] = useState<DevColumnEntry | null>(null);
  const [fieldRuleDrawerOpen, setFieldRuleDrawerOpen] = useState(false);
  const [activeFormatRuleKey, setActiveFormatRuleKey] = useState<string | null>(null);
  const [activeValidateRuleKey, setActiveValidateRuleKey] = useState<string | null>(null);
  const [activeRuleEditorTab, setActiveRuleEditorTab] = useState<"format" | "validate">("format");
  const [activeRuleCategoryKey, setActiveRuleCategoryKey] = useState(fieldRuleCatalog[0]?.key || "quick");
  const [rawPreview, setRawPreview] = useState<DevProcessingPreviewResult | null>(null);
  const [preview, setPreview] = useState<DevProcessingPreviewResult | null>(null);
  const [runs, setRuns] = useState<DevProcessingRunRecord[]>([]);
  const [targetMappings, setTargetMappings] = useState<TargetMappingRow[]>([]);
  const [targetTableColumns, setTargetTableColumns] = useState<DevColumnEntry[]>([]);
  const [lookupTableColumns, setLookupTableColumns] = useState<DevColumnEntry[]>([]);
  const selectedDatasourceId = Form.useWatch("datasourceId", form);
  const selectedDatabaseName = Form.useWatch("databaseName", form);
  const selectedTableName = Form.useWatch("tableName", form);
  const selectedScopeMode = Form.useWatch("scopeMode", form);
  const selectedScheduleType = Form.useWatch("scheduleType", form);
  const selectedTargetMode = Form.useWatch("targetMode", form);
  const selectedTargetDatabaseName = Form.useWatch("targetConfigDatabaseName", form);
  const selectedTargetTableName = Form.useWatch("targetConfigTableName", form);
  const currentJointType = Form.useWatch("stepType", jointForm);
  const selectedLookupTableName = Form.useWatch("lookupTable", lookupForm);

  const compactLabelStyle: React.CSSProperties = {
    width: 84,
    flex: "0 0 84px",
    color: "#44506a",
    fontSize: 13,
    lineHeight: "32px",
  };

  const renderInlineField = (
    label: string,
    name: keyof ProcessingFormValues,
    node: React.ReactNode,
    options?: { required?: boolean; style?: React.CSSProperties }
  ) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, ...options?.style }}>
      <div style={compactLabelStyle}>
        {options?.required ? <span style={{ color: "#ff4d4f", marginRight: 4 }}>*</span> : null}
        {label}
      </div>
      <Form.Item name={name} rules={options?.required ? [{ required: true }] : undefined} style={{ marginBottom: 0, flex: 1 }}>
        {node}
      </Form.Item>
    </div>
  );

  async function loadDetail() {
    if (!token) return;
    setLoading(true);
    try {
      const [datasourceRes, jobRes, runRes] = await Promise.all([
        fetchDevDatasources(token),
        fetchDevProcessingJob(token, jobId),
        fetchDevProcessingJobRuns(token, jobId),
      ]);
      const detail = jobRes.data;
      setDatasources(datasourceRes.data || []);
      setJob(detail);
      setRuns(runRes.data || []);
      form.setFieldsValue({
        name: detail.name,
        description: detail.description || undefined,
        datasourceId: detail.datasourceId,
        databaseName: detail.databaseName || undefined,
        tableName: isPendingSourceTable(detail.tableName) ? undefined : detail.tableName,
        sampleLimit: detail.version?.pipeline?.sampleLimit || 50,
        scopeMode: detail.version?.pipeline?.scope?.mode || "all",
        scopeFieldName: detail.version?.pipeline?.scope?.fieldName || undefined,
        scopeTimeVariable: detail.version?.pipeline?.scope?.timeVariable || "current_date",
        scopeTimeFormat: detail.version?.pipeline?.scope?.timeFormat || "%Y-%m-%d %H:%i:%s",
        scopeStartOffset: detail.version?.pipeline?.scope?.startOffset ?? undefined,
        scopeEndOffset: detail.version?.pipeline?.scope?.endOffset ?? undefined,
        scopeOffsetUnit: detail.version?.pipeline?.scope?.offsetUnit || "day",
        scheduleType: detail.version?.pipeline?.schedule?.scheduleType || "manual",
        scheduleTime: detail.version?.pipeline?.schedule?.executeTime || "02:00",
        scheduleDay: detail.version?.pipeline?.schedule?.executeDay ?? 1,
        scheduleCronExpr: detail.version?.pipeline?.schedule?.cronExpr || undefined,
        targetMode: detail.version?.pipeline?.targetConfig?.targetMode || "create",
        targetWriteMode: detail.version?.pipeline?.targetConfig?.writeMode || "overwrite",
        targetConfigDatabaseName: detail.version?.pipeline?.targetConfig?.targetDatabaseName || detail.databaseName || undefined,
        targetConfigTableName: detail.version?.pipeline?.targetConfig?.targetTableName || detail.targetTableName || undefined,
      });
      setSteps(detail.version?.pipeline?.steps || []);
      setTargetMappings(
        (detail.version?.pipeline?.targetConfig?.fieldMappings || []).map((item, index) => ({
          key: `${item.sourceField}_${item.targetField}_${index}`,
          sourceField: item.sourceField,
          targetField: item.targetField,
        }))
      );
    } catch (error: any) {
      message.error(error.message || "加载数据处理任务失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadDatabases(datasourceId: number) {
    if (!token || !datasourceId) return;
    const response = await fetchDevDatabases(token, datasourceId);
    setDatabases(response.data || []);
  }

  async function loadTables(datasourceId: number, databaseName?: string) {
    if (!token || !datasourceId) return;
    const response = await fetchDevTables(token, datasourceId, databaseName);
    setTables(response.data || []);
  }

  async function loadColumns(datasourceId: number, databaseName: string | undefined, tableName: string) {
    if (!token || !datasourceId || !tableName) return;
    const response = await fetchDevColumns(token, datasourceId, databaseName, tableName);
    setColumns(response.data || []);
  }

  async function loadLookupTableColumns(datasourceId: number, databaseName: string | undefined, tableName: string) {
    if (!token || !datasourceId || !tableName) return;
    const response = await fetchDevColumns(token, datasourceId, databaseName, tableName);
    setLookupTableColumns(response.data || []);
  }

  async function loadTargetTableColumns(datasourceId: number, databaseName: string | undefined, tableName: string) {
    if (!token || !datasourceId || !tableName) return;
    const response = await fetchDevColumns(token, datasourceId, databaseName, tableName);
    setTargetTableColumns(response.data || []);
  }

  useEffect(() => {
    void loadDetail();
  }, [token, jobId]);

  useEffect(() => {
    if (selectedDatasourceId) {
      void loadDatabases(Number(selectedDatasourceId));
      void loadTables(Number(selectedDatasourceId), selectedDatabaseName);
    }
  }, [selectedDatasourceId]);

  useEffect(() => {
    if (selectedDatasourceId) {
      void loadTables(Number(selectedDatasourceId), selectedDatabaseName);
    }
  }, [selectedDatasourceId, selectedDatabaseName]);

  useEffect(() => {
    if (selectedDatasourceId && selectedTableName) {
      void loadColumns(Number(selectedDatasourceId), selectedDatabaseName, selectedTableName);
      if (token) {
        void previewDevProcessingDraft(token, {
          datasourceId: Number(selectedDatasourceId),
          databaseName: selectedDatabaseName,
          tableName: selectedTableName,
          pipeline: buildProcessingPipelinePayload({
            ...form.getFieldsValue(),
            sampleLimit: Number(form.getFieldValue("sampleLimit") || 50),
          }, [], targetMappings),
        }).then((response) => {
          setRawPreview(response.data);
        }).catch(() => {
          setRawPreview(null);
        });
      }
    } else {
      setColumns([]);
      setRawPreview(null);
    }
  }, [token, form, selectedDatasourceId, selectedDatabaseName, selectedTableName]);

  useEffect(() => {
    if (!selectedDatasourceId) {
      setTargetTableColumns([]);
      return;
    }
    if (selectedTargetMode === "source" && selectedTableName) {
      setTargetTableColumns(columns);
      return;
    }
    if (selectedTargetMode === "existing" && selectedTargetTableName) {
      void loadTargetTableColumns(Number(selectedDatasourceId), selectedTargetDatabaseName || selectedDatabaseName, selectedTargetTableName);
      return;
    }
    setTargetTableColumns([]);
  }, [
    token,
    selectedDatasourceId,
    selectedTargetMode,
    selectedTargetDatabaseName,
    selectedTargetTableName,
    selectedDatabaseName,
    selectedTableName,
    columns,
  ]);

  useEffect(() => {
    if (!selectedDatasourceId || !selectedLookupTableName) {
      setLookupTableColumns([]);
      return;
    }
    void loadLookupTableColumns(Number(selectedDatasourceId), selectedDatabaseName, selectedLookupTableName);
  }, [selectedDatasourceId, selectedDatabaseName, selectedLookupTableName]);

  const jointSteps = useMemo(
    () => steps.filter((step) => step.stepType === "filter" || step.stepType === "deduplicate" || (step.stepType === "validate" && step.config?.scope === "multi")),
    [steps]
  );
  const lookupSteps = useMemo(
    () => steps.filter((step) => step.stepType === "lookup_fill"),
    [steps]
  );

  const processedSourceFields = useMemo(() => {
    const fieldMap = new Map<string, { name: string; comment?: string; dataType?: string }>();
    columns.forEach((column) => {
      fieldMap.set(column.name, {
        name: column.name,
        comment: column.comment,
        dataType: column.columnType || column.dataType,
      });
    });
    steps.forEach((step) => {
      if (step.stepType === "validate" && String(step.config?.mode || "") !== "drop_invalid") {
        const tagFieldName = String(step.config?.tagFieldName || "").trim();
        if (tagFieldName && !fieldMap.has(tagFieldName)) {
          fieldMap.set(tagFieldName, { name: tagFieldName, comment: "校验结果标记", dataType: "text" });
        }
      }
      if (step.stepType === "lookup_fill") {
        const targetField = String(step.config?.targetField || "").trim();
        if (targetField && !fieldMap.has(targetField)) {
          fieldMap.set(targetField, {
            name: targetField,
            comment: String(step.config?.targetFieldComment || "").trim() || "关联回填新增字段",
            dataType: String(step.config?.targetFieldDataType || "").trim() || "text",
          });
        }
      }
    });
    if (preview?.fields?.length) {
      preview.fields.forEach((field) => {
        if (!fieldMap.has(field)) {
          fieldMap.set(field, { name: field, comment: "预览输出字段", dataType: "text" });
        }
      });
    }
    return Array.from(fieldMap.values());
  }, [columns, steps, preview]);

  const targetFieldOptions = useMemo(() => {
    if (selectedTargetMode === "source") {
      return columns.map((item) => ({ value: item.name, label: item.name }));
    }
    return targetTableColumns.map((item) => ({ value: item.name, label: item.name }));
  }, [selectedTargetMode, columns, targetTableColumns]);

  const lookupTableFieldOptions = useMemo(
    () => lookupTableColumns.map((item) => ({
      value: item.name,
      label: item.comment ? `${item.name} / ${item.comment}` : item.name,
    })),
    [lookupTableColumns]
  );

  useEffect(() => {
    if (!processedSourceFields.length) {
      setTargetMappings([]);
      return;
    }
    setTargetMappings((current) => {
      const validCurrent = current.filter((item) => item.sourceField || item.targetField);
      if (validCurrent.length) {
        return validCurrent.map((item) => ({
          ...item,
          sourceField: processedSourceFields.some((field) => field.name === item.sourceField)
            ? item.sourceField
            : (processedSourceFields[0]?.name || ""),
        }));
      }
      const targetFieldSet = new Set(targetFieldOptions.map((item) => item.value));
      return processedSourceFields
        .filter((field) => !targetFieldSet.size || targetFieldSet.has(field.name))
        .slice(0, 12)
        .map((field, index) => ({
          key: `auto_${field.name}_${index}`,
          sourceField: field.name,
          targetField: targetFieldSet.has(field.name) ? field.name : "",
        }));
    });
  }, [processedSourceFields, targetFieldOptions]);

  function updateOrInsertStep(nextStep: DevProcessingStepRecord) {
    setSteps((current) => {
      const existed = current.some((item) => item.stepKey === nextStep.stepKey);
      return existed ? current.map((item) => (item.stepKey === nextStep.stepKey ? nextStep : item)) : [...current, nextStep];
    });
  }

  function removeStep(stepKey: string) {
    setSteps((current) => current.filter((item) => item.stepKey !== stepKey));
  }

  function getStepByKey(stepKey?: string | null) {
    if (!stepKey) return null;
    return steps.find((step) => step.stepKey === stepKey) || null;
  }

  function getAdvancedFormatSteps(fieldName: string) {
    return getFieldSteps(fieldName).filter((step) => step.stepType === "format");
  }

  function getValidateSteps(fieldName: string) {
    return getFieldSteps(fieldName).filter((step) => step.stepType === "validate");
  }

  function getFieldSteps(fieldName: string) {
    return steps
      .filter((step) => step.config?.scope !== "multi" && String(step.config?.fieldName || "") === fieldName)
      .sort((a, b) => Number(a.config?.orderNo || 0) - Number(b.config?.orderNo || 0));
  }

  function normalizeFieldStepOrders(fieldName: string, sourceSteps: DevProcessingStepRecord[]) {
    let orderNo = 1;
    return sourceSteps.map((step) => {
      if (step.config?.scope === "multi" || String(step.config?.fieldName || "") !== fieldName) return step;
      const next = {
        ...step,
        config: {
          ...(step.config || {}),
          orderNo,
        },
      };
      orderNo += 1;
      return next;
    });
  }

  function toggleQuickTransform(fieldName: string, transform: FieldConfigValues["transform"]) {
    if (!transform) return;
    const column = columns.find((item) => item.name === fieldName) || null;
    if (!isStringLikeColumn(column)) return;
    setSteps((current) => {
      const existing = current.find((step) => step.stepType === "format" && String(step.config?.fieldName || "") === fieldName && String(step.config?.transform || "") === transform) || null;
      const nextSteps = existing
        ? current.filter((step) => step.stepKey !== existing.stepKey)
        : [
            ...current,
            {
              stepKey: buildCompactStepKey(["ff", fieldName, transform]),
              stepName: `${fieldName} ${transformOptions.find((item) => item.value === transform)?.label || transform}`,
              stepType: "format" as DevProcessingStepRecord["stepType"],
              enabled: true,
              config: {
                scope: "field",
                fieldName,
                transform,
                orderNo: getFieldSteps(fieldName).length + 1,
              },
            },
          ];
      return normalizeFieldStepOrders(fieldName, nextSteps);
    });
  }

  function toggleQuickRequiredFilter(fieldName: string) {
    setSteps((current) => {
      const existing = current.find(
        (step) =>
          step.stepType === "validate"
          && step.config?.scope !== "multi"
          && String(step.config?.fieldName || "") === fieldName
          && String(step.config?.validationType || "") === "required"
          && String(step.config?.mode || "") === "drop_invalid"
      ) || null;
      const nextSteps = existing
        ? current.filter((step) => step.stepKey !== existing.stepKey)
        : [
            ...current,
            {
              stepKey: buildCompactStepKey(["fv", fieldName, "required_filter"]),
              stepName: `${fieldName} 空值过滤`,
              stepType: "validate" as DevProcessingStepRecord["stepType"],
              enabled: true,
              config: {
                scope: "field",
                fieldName,
                validationType: "required",
                mode: "drop_invalid",
                expression: buildFieldValidationExpression(fieldName, { validationType: "required" }, job?.datasourceType),
                orderNo: getFieldSteps(fieldName).length + 1,
              },
            },
          ];
      return normalizeFieldStepOrders(fieldName, nextSteps);
    });
  }

  function toggleQuickRuleForAll(rule: "trim" | "required_filter") {
    setSteps((current) => {
      const targetColumns = columns.filter((column) => !column.primaryKey && (rule !== "trim" || isStringLikeColumn(column)));
      const hasAll = targetColumns.length > 0 && targetColumns.every((column) => {
        if (rule === "trim") {
          return current.some(
            (step) =>
              step.stepType === "format"
              && String(step.config?.fieldName || "") === column.name
              && String(step.config?.transform || "") === "trim"
          );
        }
        return current.some(
          (step) =>
            step.stepType === "validate"
            && step.config?.scope !== "multi"
            && String(step.config?.fieldName || "") === column.name
            && String(step.config?.validationType || "") === "required"
            && String(step.config?.mode || "") === "drop_invalid"
        );
      });

      let next = [...current];
      for (const column of targetColumns) {
        if (rule === "trim") {
          const existing = next.find(
            (step) =>
              step.stepType === "format"
              && String(step.config?.fieldName || "") === column.name
              && String(step.config?.transform || "") === "trim"
          ) || null;
          if (hasAll) {
            next = existing ? next.filter((step) => step.stepKey !== existing.stepKey) : next;
          } else if (!existing) {
            next.push({
              stepKey: buildCompactStepKey(["ff", column.name, "trim", column.position]),
              stepName: `${column.name} 去除首尾空格`,
              stepType: "format",
              enabled: true,
              config: {
                scope: "field",
                fieldName: column.name,
                transform: "trim",
                orderNo: getFieldSteps(column.name).length + 1,
              },
            });
          }
        } else {
          const existing = next.find(
            (step) =>
              step.stepType === "validate"
              && step.config?.scope !== "multi"
              && String(step.config?.fieldName || "") === column.name
              && String(step.config?.validationType || "") === "required"
              && String(step.config?.mode || "") === "drop_invalid"
          ) || null;
          if (hasAll) {
            next = existing ? next.filter((step) => step.stepKey !== existing.stepKey) : next;
          } else if (!existing) {
            next.push({
              stepKey: buildCompactStepKey(["fv", column.name, "required_filter", column.position]),
              stepName: `${column.name} 空值过滤`,
              stepType: "validate",
              enabled: true,
              config: {
                scope: "field",
                fieldName: column.name,
                validationType: "required",
                mode: "drop_invalid",
                expression: buildFieldValidationExpression(column.name, { validationType: "required" }, job?.datasourceType),
                orderNo: getFieldSteps(column.name).length + 1,
              },
            });
          }
        }
      }

      return columns.reduce((result, column) => normalizeFieldStepOrders(column.name, result), next);
    });
  }

  function openFieldRuleDrawer(column: DevColumnEntry) {
    setActiveField(column);
    const latestAdvancedFormatStep = getAdvancedFormatSteps(column.name).at(-1) || null;
    const latestValidateStep = getValidateSteps(column.name).at(-1) || null;
    setActiveFormatRuleKey(latestAdvancedFormatStep?.stepKey || null);
    setActiveValidateRuleKey(latestValidateStep?.stepKey || null);
    setActiveRuleEditorTab(latestValidateStep ? "validate" : "format");
    const activeType = latestValidateStep?.stepType === "validate" ? String(latestValidateStep.config?.validationType || "") : String(latestAdvancedFormatStep?.config?.transform || "");
    const matchedGroup = fieldRuleCatalog.find((group) => group.items.some((item) => item.type === activeType));
    setActiveRuleCategoryKey(matchedGroup?.key || fieldRuleCatalog[0]?.key || "quick");
    setFieldRuleDrawerOpen(true);
  }

  function toggleFieldRule(fieldName: string, category: FieldRuleCategory, type: string) {
    const nextStepKey = buildCompactStepKey(["field", category, fieldName, type]);
    const existingBeforeToggle = getFieldSteps(fieldName).find((step) => (
      step.config?.scope !== "multi"
      && String(step.config?.fieldName || "") === fieldName
      && (category === "format"
        ? step.stepType === "format" && String(step.config?.transform || "") === type
        : step.stepType === "validate" && String(step.config?.validationType || "") === type)
    )) || null;
    setSteps((current) => {
      const existing = current.find((step) => (
        step.config?.scope !== "multi"
        && String(step.config?.fieldName || "") === fieldName
        && (category === "format"
          ? step.stepType === "format" && String(step.config?.transform || "") === type
          : step.stepType === "validate" && String(step.config?.validationType || "") === type)
      )) || null;
      if (existing) {
        const nextSteps = current.filter((step) => step.stepKey !== existing.stepKey);
        return normalizeFieldStepOrders(fieldName, nextSteps);
      }
      const fieldSteps = current.filter((step) => step.config?.scope !== "multi" && String(step.config?.fieldName || "") === fieldName);
      const nextStep: DevProcessingStepRecord = {
        stepKey: nextStepKey,
        stepName: `${fieldName} ${category === "format" ? "处理" : "校验"}`,
        stepType: category as DevProcessingStepRecord["stepType"],
        enabled: true,
        config: {
          scope: "field",
          fieldName,
          orderNo: fieldSteps.length + 1,
          ...(category === "format"
            ? { transform: type }
            : {
              validationType: type,
              mode: "keep_valid",
              expression: type === "required" ? buildFieldValidationExpression(fieldName, { validationType: "required" }, job?.datasourceType) : undefined,
              tagFieldName: type === "required" ? buildValidationTagFieldName(fieldName, "required") : undefined,
            }),
        },
      };
      return normalizeFieldStepOrders(fieldName, [...current, nextStep]);
    });
    const selectedGroup = fieldRuleCatalog.find((group) => group.items.some((item) => item.type === type));
    setActiveRuleCategoryKey(selectedGroup?.key || activeRuleCategoryKey);
    if (existingBeforeToggle) {
      if (category === "format") setActiveFormatRuleKey(null);
      if (category === "validate") setActiveValidateRuleKey(null);
      return;
    }
    if (category === "format") {
      setActiveFormatRuleKey(nextStepKey);
      setActiveValidateRuleKey(null);
      setActiveRuleEditorTab("format");
    } else {
      setActiveValidateRuleKey(nextStepKey);
      setActiveFormatRuleKey(null);
      setActiveRuleEditorTab("validate");
    }
  }

  function removeFieldRule(stepKey: string, fieldName: string) {
    setSteps((current) => normalizeFieldStepOrders(fieldName, current.filter((step) => step.stepKey !== stepKey)));
    if (activeFormatRuleKey === stepKey) setActiveFormatRuleKey(null);
    if (activeValidateRuleKey === stepKey) setActiveValidateRuleKey(null);
  }

  function toggleFieldRuleEnabled(stepKey: string) {
    setSteps((current) => current.map((step) => (
      step.stepKey === stepKey ? { ...step, enabled: step.enabled === false } : step
    )));
  }

  function duplicateFieldRule(step: DevProcessingStepRecord, fieldName: string) {
    const nextStep: DevProcessingStepRecord = {
      ...step,
      stepKey: buildCompactStepKey(["copy", fieldName, step.stepType]),
      stepName: `${step.stepName} 副本`,
      enabled: true,
      config: {
        ...(step.config || {}),
        orderNo: getFieldSteps(fieldName).length + 1,
      },
    };
    setSteps((current) => normalizeFieldStepOrders(fieldName, [...current, nextStep]));
    if (nextStep.stepType === "format") {
      setActiveFormatRuleKey(nextStep.stepKey);
      setActiveRuleEditorTab("format");
    }
    if (nextStep.stepType === "validate") {
      setActiveValidateRuleKey(nextStep.stepKey);
      setActiveRuleEditorTab("validate");
    }
  }

  function moveFieldRule(stepKey: string, fieldName: string, direction: "up" | "down") {
    setSteps((current) => {
      const fieldStepKeys = getFieldSteps(fieldName).map((step) => step.stepKey);
      const fromIndex = fieldStepKeys.indexOf(stepKey);
      const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
      if (fromIndex < 0 || toIndex < 0 || toIndex >= fieldStepKeys.length) return current;
      const reordered = [...fieldStepKeys];
      [reordered[fromIndex], reordered[toIndex]] = [reordered[toIndex], reordered[fromIndex]];
      const orderMap = new Map(reordered.map((key, index) => [key, index + 1]));
      return current.map((step) => {
        const nextOrder = orderMap.get(step.stepKey);
        if (!nextOrder) return step;
        return {
          ...step,
          config: {
            ...(step.config || {}),
            orderNo: nextOrder,
          },
        };
      });
    });
  }

  function focusFieldRule(step: DevProcessingStepRecord) {
    if (step.stepType === "format") {
      setActiveFormatRuleKey(step.stepKey);
      setActiveRuleEditorTab("format");
      return;
    }
    if (step.stepType === "validate") {
      setActiveValidateRuleKey(step.stepKey);
      setActiveRuleEditorTab("validate");
    }
  }

  function updateFieldFormatConfig(stepKey: string, fieldName: string, patch: Partial<FieldConfigValues>) {
    setSteps((current) => {
      const existing = current.find((step) => step.stepKey === stepKey) || null;
      if (!existing) return current;
      const existingTransform = String(existing.config?.transform ?? "");
      const normalizedExistingTransform = legacyDesensitizeTransformMap[existingTransform] || existingTransform;
      const nextConfig = {
        transform: normalizedExistingTransform,
        format: String(existing.config?.format ?? ""),
        pattern: String(existing.config?.pattern ?? ""),
        replacement: String(existing.config?.replacement ?? ""),
        start: String(existing.config?.start ?? ""),
        length: String(existing.config?.length ?? ""),
        defaultValue: String(existing.config?.defaultValue ?? ""),
        precision: String(existing.config?.precision ?? ""),
        maskChar: String(existing.config?.maskChar ?? "*"),
        prefixLength: String(existing.config?.prefixLength ?? ""),
        suffixLength: String(existing.config?.suffixLength ?? ""),
        replacePattern: String(existing.config?.replacePattern ?? ""),
        replaceValue: String(existing.config?.replaceValue ?? ""),
        encryptAlgorithm: (existing.config?.encryptAlgorithm as FieldConfigValues["encryptAlgorithm"]) || "md5",
        salt: String(existing.config?.salt ?? ""),
        generalizeLength: String(existing.config?.generalizeLength ?? ""),
        ...patch,
      };

      if (!nextConfig.transform) {
        return current.filter((step) => step.stepKey !== existing.stepKey);
      }

      const nextStep: DevProcessingStepRecord = {
        ...existing,
        stepKey: existing.stepKey,
        stepName: `${fieldName} ${desensitizeTransformLabels[nextConfig.transform as keyof typeof desensitizeTransformLabels] || transformOptions.find((item) => item.value === nextConfig.transform)?.label || "格式处理"}`,
        stepType: "format",
        enabled: true,
        config: {
          ...(existing.config || {}),
          scope: "field",
          fieldName,
          transform: nextConfig.transform,
          format: nextConfig.transform === "date_format" ? String(nextConfig.format || "") : undefined,
          pattern: nextConfig.transform === "regex_replace" ? String(nextConfig.pattern || "") : undefined,
          replacement: nextConfig.transform === "regex_replace" ? String(nextConfig.replacement || "") : undefined,
          start: nextConfig.transform === "substring" ? String(nextConfig.start || "") : undefined,
          length: nextConfig.transform === "substring" ? String(nextConfig.length || "") : undefined,
          defaultValue: nextConfig.transform === "null_to_default" ? String(nextConfig.defaultValue || "") : undefined,
          precision: nextConfig.transform === "number_round" ? String(nextConfig.precision || "0") : undefined,
          maskType: nextConfig.transform === "desensitize_encrypt"
            ? (nextConfig.encryptAlgorithm || "md5")
            : nextConfig.transform === "desensitize_generalize"
              ? "truncate"
              : nextConfig.transform === "desensitize_replace"
                ? "replace"
                : "mask",
          maskChar: nextConfig.transform === "desensitize_mask" ? String(nextConfig.maskChar || "*") : undefined,
          prefixLength: nextConfig.transform === "desensitize_mask" ? String(nextConfig.prefixLength || "0") : undefined,
          suffixLength: nextConfig.transform === "desensitize_mask" ? String(nextConfig.suffixLength || "0") : undefined,
          replacePattern: nextConfig.transform === "desensitize_replace" ? String(nextConfig.replacePattern || "") : undefined,
          replaceValue: nextConfig.transform === "desensitize_replace" ? String(nextConfig.replaceValue || "") : undefined,
          truncateLength: nextConfig.transform === "desensitize_generalize" ? String(nextConfig.generalizeLength || "0") : undefined,
          salt: nextConfig.transform === "desensitize_encrypt" ? String(nextConfig.salt || "") : undefined,
          encryptAlgorithm: nextConfig.transform === "desensitize_encrypt" ? String(nextConfig.encryptAlgorithm || "md5") : undefined,
        },
      };

      return current.map((step) => (step.stepKey === existing.stepKey ? nextStep : step));
    });
  }

  function updateFieldValidateConfig(stepKey: string, fieldName: string, patch: Partial<FieldConfigValues>) {
    setSteps((current) => {
      const existing = current.find((step) => step.stepKey === stepKey) || null;
      if (!existing) return current;
      const nextValues: FieldConfigValues = {
        validationType: (existing.config?.validationType as FieldConfigValues["validationType"]) || "",
        mode: (existing.config?.mode as FieldConfigValues["mode"]) || "keep_valid",
        tagFieldName: String(existing.config?.tagFieldName ?? ""),
        validationPattern: String(existing.config?.validationPattern ?? ""),
        enumValues: String(
          Array.isArray(existing.config?.allowedValues) ? (existing.config.allowedValues as string[]).join(", ") : ""
        ),
        minValue: String(existing.config?.minValue ?? ""),
        maxValue: String(existing.config?.maxValue ?? ""),
        minLength: String(existing.config?.minLength ?? ""),
        maxLength: String(existing.config?.maxLength ?? ""),
        customExpression: String(existing.config?.expression ?? ""),
        ...patch,
      };
      const expression = buildFieldValidationExpression(fieldName, nextValues, job?.datasourceType);

      if (!nextValues.validationType || !expression) {
        return current.filter((step) => step.stepKey !== existing.stepKey);
      }

      const nextStep: DevProcessingStepRecord = {
        ...existing,
        stepKey: existing.stepKey,
        stepName: `${fieldName} ${validationTypeOptions.find((item) => item.value === nextValues.validationType)?.label || "校验"}`,
        stepType: "validate",
        enabled: true,
        config: {
          ...(existing.config || {}),
          scope: "field",
          fieldName,
          validationType: nextValues.validationType,
          mode: nextValues.mode || "keep_valid",
          validationPattern: nextValues.validationType === "regex" ? nextValues.validationPattern : undefined,
          allowedValues: nextValues.validationType === "enum" ? normalizeCsvValues(nextValues.enumValues) : undefined,
          minValue: nextValues.validationType === "range" ? nextValues.minValue : undefined,
          maxValue: nextValues.validationType === "range" ? nextValues.maxValue : undefined,
          minLength: nextValues.validationType === "length" ? nextValues.minLength : undefined,
          maxLength: nextValues.validationType === "length" ? nextValues.maxLength : undefined,
          tagFieldName: (nextValues.mode || "keep_valid") === "keep_valid"
            ? String(nextValues.tagFieldName || existing.config?.tagFieldName || buildValidationTagFieldName(fieldName, nextValues.validationType))
            : undefined,
          expression,
        },
      };

      return current.map((step) => (step.stepKey === existing.stepKey ? nextStep : step));
    });
  }

  function openJointRuleModal(step?: DevProcessingStepRecord) {
    setEditingJointStepKey(step?.stepKey || null);
    jointForm.setFieldsValue({
      stepKey: step?.stepKey,
      stepType: step?.stepType === "deduplicate" ? "deduplicate" : step?.stepType === "validate" ? "validate" : "filter",
      stepName: step?.stepName,
      expression: String(step?.config?.expression || ""),
      keyFields: Array.isArray(step?.config?.keyFields) ? (step?.config?.keyFields as string[]) : [],
      orderBy: String(step?.config?.orderBy || ""),
      mode: (step?.config?.mode as JointRuleValues["mode"]) || "keep_valid",
    });
    setJointModalOpen(true);
  }

  async function handleSaveJointRule() {
    const values = await jointForm.validateFields();
    const stepType = values.stepType;
    const stepKey = editingJointStepKey || `joint_${stepType}_${Date.now()}`;
    const nextStep: DevProcessingStepRecord = {
      stepKey,
      stepName: String(values.stepName || "").trim() || `${getStepTypeLabel(stepType)}规则`,
      stepType,
      enabled: true,
      config: {},
    };

    if (stepType === "filter") {
      nextStep.config = { expression: String(values.expression || "").trim() };
    } else if (stepType === "deduplicate") {
      nextStep.config = { keyFields: values.keyFields || [], orderBy: values.orderBy };
    } else {
      nextStep.config = {
        scope: "multi",
        expression: String(values.expression || "").trim(),
        mode: values.mode || "keep_valid",
      };
    }

    updateOrInsertStep(nextStep);
    setJointModalOpen(false);
    setEditingJointStepKey(null);
    message.success("联合处理规则已更新");
  }

  function openLookupRuleModal(step?: DevProcessingStepRecord) {
    setEditingLookupStepKey(step?.stepKey || null);
    const targetField = String(step?.config?.targetField || "");
    const targetFieldExists = columns.some((item) => item.name === targetField);
    lookupForm.setFieldsValue({
      stepKey: step?.stepKey,
      stepName: step?.stepName,
      lookupTable: String(step?.config?.lookupTable || ""),
      lookupSqlFilter: String(step?.config?.lookupSqlFilter || ""),
      sourceField: String(step?.config?.sourceField || ""),
      lookupKeyField: String(step?.config?.lookupKeyField || ""),
      lookupValueField: String(step?.config?.lookupValueField || ""),
      targetFieldMode: targetField && !targetFieldExists ? "custom" : "existing",
      targetField: targetFieldExists ? targetField : "",
      targetFieldCustom: targetFieldExists ? "" : targetField,
      targetFieldDataType: String(step?.config?.targetFieldDataType || "text"),
      targetFieldComment: String(step?.config?.targetFieldComment || ""),
    });
    setLookupModalOpen(true);
  }

  async function handleSaveLookupRule() {
    const values = await lookupForm.validateFields();
    updateOrInsertStep({
      stepKey: editingLookupStepKey || `lookup_${Date.now()}`,
      stepName: String(values.stepName || "").trim() || `${values.sourceField} 关联回填`,
      stepType: "lookup_fill",
      enabled: true,
      config: {
        lookupTable: values.lookupTable,
        lookupSqlFilter: String(values.lookupSqlFilter || "").trim() || null,
        sourceField: values.sourceField,
        lookupKeyField: values.lookupKeyField,
        lookupValueField: values.lookupValueField,
        targetField: values.targetFieldMode === "custom" ? values.targetFieldCustom : values.targetField,
        targetFieldDataType: values.targetFieldMode === "custom" ? (values.targetFieldDataType || "text") : null,
        targetFieldComment: values.targetFieldMode === "custom" ? (String(values.targetFieldComment || "").trim() || null) : null,
      },
    });
    setLookupModalOpen(false);
    setEditingLookupStepKey(null);
    message.success("关联回填规则已更新");
  }

  async function handlePreview() {
    if (!token) return;
    const values = await form.validateFields();
    try {
      const basePayload = {
        datasourceId: values.datasourceId,
        databaseName: values.databaseName,
        tableName: values.tableName,
      };
      const [rawResponse, processedResponse] = await Promise.all([
        previewDevProcessingDraft(token, {
          ...basePayload,
          pipeline: buildProcessingPipelinePayload(values, [], targetMappings),
        }),
        previewDevProcessingDraft(token, {
          ...basePayload,
          pipeline: buildProcessingPipelinePayload(values, steps, targetMappings),
        }),
      ]);
      setRawPreview(rawResponse.data);
      setPreview(processedResponse.data);
      message.success("预览已刷新");
    } catch (error: any) {
      message.error(error.message || "预览失败");
    }
  }

  async function handleSave() {
    if (!token) return false;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await updateDevProcessingJob(token, jobId, {
        ...values,
        tags: job?.tags || [],
        targetTableName: values.targetConfigTableName || null,
        pipeline: buildProcessingPipelinePayload(values, steps, targetMappings),
      });
      await loadDetail();
      message.success("草稿已保存");
      return true;
    } catch (error: any) {
      message.error(error.message || "保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    if (!token) return;
    const values = await form.validateFields();
    setRunning(true);
    try {
      const saved = await handleSave();
      if (!saved) return;
      await runDevProcessingJob(token, jobId, {
        targetTableName: values.targetConfigTableName || null,
      });
      await loadDetail();
      await handlePreview();
      message.success("处理任务执行完成");
    } catch (error: any) {
      message.error(error.message || "执行失败");
    } finally {
      setRunning(false);
    }
  }

  async function handleCreateSchedule() {
    if (!token) return;
    setCreatingSchedule(true);
    try {
      const saved = await handleSave();
      if (!saved) return;
      const response = await createDevWorkflowFromTask(token, { taskType: "processing", taskId: jobId });
      message.success("调度工作流已创建");
      navigate(`/dashboard/data-development/scheduling/${response.data.id}/edit`);
    } catch (error: any) {
      message.error(error.message || "创建调度工作流失败");
    } finally {
      setCreatingSchedule(false);
    }
  }

  const compactStats = [
    { key: "columns", title: "字段总数", value: columns.length },
    { key: "configured_fields", title: "已配置字段", value: columns.filter((column) => getFieldSteps(column.name).length > 0).length },
    { key: "single_rules", title: "单字段处理", value: steps.filter((step) => step.config?.scope !== "multi" && step.stepType !== "lookup_fill").length },
    { key: "joint_rules", title: "联合处理", value: jointSteps.length },
    { key: "lookup_rules", title: "关联回填", value: lookupSteps.length },
    { key: "enabled_steps", title: "已应用步骤", value: steps.filter((item) => item.enabled !== false).length },
  ];

  const fieldColumns: ColumnsType<DevColumnEntry> = [
    {
      title: "字段",
      key: "field",
      width: 180,
      fixed: "left",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Space size={6} wrap>
            <Typography.Text strong>{record.name}</Typography.Text>
            {record.primaryKey ? <Tag color="blue">主键</Tag> : null}
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.comment || `第 ${record.position} 列`}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "类型",
      dataIndex: "dataType",
      width: 120,
      render: (_, record) => record.columnType || record.dataType || "-",
    },
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Button size="small" onClick={() => openFieldRuleDrawer(record)}>
          规则编排
        </Button>
      ),
    },
    {
      title: "原始值",
      key: "rawSample",
      width: 220,
      render: (_, record) => (
        <Typography.Text ellipsis={{ tooltip: firstMeaningfulRawValue(rawPreview?.rows || [], record.name) }} style={{ display: "block", width: "100%" }}>
          {firstMeaningfulRawValue(rawPreview?.rows || [], record.name)}
        </Typography.Text>
      ),
    },
    {
      title: "处理后值",
      key: "processedSample",
      width: 220,
      render: (_, record) => (
        <Typography.Text ellipsis={{ tooltip: firstMeaningfulPreviewValue(preview?.rows || [], rawPreview?.rows || [], record.name) }} style={{ display: "block", width: "100%" }}>
          {firstMeaningfulPreviewValue(preview?.rows || [], rawPreview?.rows || [], record.name)}
        </Typography.Text>
      ),
    },
    {
      title: (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%" }}>
          <Typography.Text strong>快捷处理</Typography.Text>
          {(() => {
            const nonPrimaryColumns = columns.filter((column) => !column.primaryKey);
            const trimAllChecked = nonPrimaryColumns.length > 0 && nonPrimaryColumns.every((column) =>
              getFieldSteps(column.name).some((step) => step.stepType === "format" && String(step.config?.transform || "") === "trim")
            );
            const requiredAllChecked = nonPrimaryColumns.length > 0 && nonPrimaryColumns.every((column) =>
              getFieldSteps(column.name).some(
                (step) =>
                  step.stepType === "validate"
                  && String(step.config?.validationType || "") === "required"
                  && String(step.config?.mode || "") === "drop_invalid"
              )
            );
            return (
              <Space size={6}>
                <Tag.CheckableTag
                  checked={trimAllChecked}
                  onChange={() => toggleQuickRuleForAll("trim")}
                >
                  去空格
                </Tag.CheckableTag>
                <Tag.CheckableTag
                  checked={requiredAllChecked}
                  onChange={() => toggleQuickRuleForAll("required_filter")}
                >
                  空值过滤
                </Tag.CheckableTag>
              </Space>
            );
          })()}
        </div>
      ),
      key: "quick",
      width: 220,
      render: (_, record) => {
        const fieldSteps = getFieldSteps(record.name);
        const activeTransforms = new Set(
          fieldSteps
            .filter((step) => step.stepType === "format")
            .map((step) => String(step.config?.transform || ""))
        );
        const requiredFilterActive = fieldSteps.some(
          (step) =>
            step.stepType === "validate"
            && String(step.config?.validationType || "") === "required"
            && String(step.config?.mode || "") === "drop_invalid"
        );
        return (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 4, borderRadius: 999, background: "#f6f8fc", border: "1px solid #eef2f7" }}>
            <Tag.CheckableTag
              checked={activeTransforms.has("trim")}
              onChange={() => {
                if (!isStringLikeColumn(record)) return;
                toggleQuickTransform(record.name, "trim");
              }}
              style={{
                marginInlineEnd: 0,
                borderRadius: 999,
                paddingInline: 8,
                lineHeight: "22px",
                opacity: isStringLikeColumn(record) ? 1 : 0.45,
                cursor: isStringLikeColumn(record) ? "pointer" : "not-allowed",
              }}
            >
              去空格
            </Tag.CheckableTag>
            <Tag.CheckableTag
              checked={requiredFilterActive}
              onChange={() => toggleQuickRequiredFilter(record.name)}
              style={{ marginInlineEnd: 0, borderRadius: 999, paddingInline: 8, lineHeight: "22px" }}
            >
              空值过滤
            </Tag.CheckableTag>
          </div>
        );
      },
    },
    {
      title: "规则摘要",
      key: "summary",
      width: 420,
      render: (_, record) => {
        const nonPrimaryColumns = columns.filter((column) => !column.primaryKey);
        const fieldSteps = getFieldSteps(record.name);
        return (
          <Space direction="vertical" size={8} style={{ display: "flex" }}>
            <Space wrap size={[6, 6]}>
              {fieldSteps.length
                ? fieldSteps.map((step) => (
                    <Tag key={step.stepKey} color={step.stepType === "format" ? "processing" : "gold"}>
                      {describeFieldStep(step)}
                    </Tag>
                  ))
                : <Typography.Text type="secondary">未配置规则</Typography.Text>}
            </Space>
            {fieldSteps.length ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {`已配置 ${fieldSteps.length} 条`}
              </Typography.Text>
            ) : null}
          </Space>
        );
      },
    },
  ];

  const activeFieldSteps = activeField ? getFieldSteps(activeField.name) : [];

  function isFieldRuleInvalid(step: DevProcessingStepRecord, field?: DevColumnEntry | null) {
    if (!field || step.stepType !== "format") return false;
    const transform = String(step.config?.transform || "");
    if (transform === "number_round") return !isNumberLikeColumn(field);
    if (transform === "date_format") return !isDateLikeColumn(field);
    return false;
  }

  function renderFieldRuleList() {
    if (!activeField || !activeFieldSteps.length) {
      return (
                <div className="field-rule-chain-empty">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="从上方规则分类中选择规则添加到当前字段" />
        </div>
      );
    }
    return (
      <div className="field-rule-chain-list">
        {activeFieldSteps.map((record, index) => {
          const invalid = isFieldRuleInvalid(record, activeField);
          const ruleTypeLabel = getStepTypeLabel(record.stepType);
          const ruleNameLabel = getFieldRuleName(record);
          const row = (
            <div
              key={record.stepKey}
              className={[
                "field-rule-chain-row",
                record.enabled === false ? "field-rule-chain-row--disabled" : "",
                invalid ? "field-rule-chain-row--invalid" : "",
              ].filter(Boolean).join(" ")}
            >
              <div className="field-rule-chain-row__main">
                <span className="field-rule-chain-index">{String(record.config?.orderNo || index + 1)}</span>
                <div className="field-rule-chain-meta">
                  <Tag color={record.stepType === "format" ? "processing" : "gold"} className="field-rule-chain-type">
                    {ruleTypeLabel}
                  </Tag>
                  <Typography.Text className="field-rule-chain-name">{ruleNameLabel}</Typography.Text>
                </div>
                {invalid ? (
                  <Tag color="error" icon={<ExclamationCircleOutlined />} className="field-rule-chain-warning">
                    规则无效
                  </Tag>
                ) : null}
                <Typography.Text className="field-rule-chain-desc" type={record.enabled === false ? "secondary" : undefined} ellipsis={{ tooltip: describeFieldStep(record) }}>
                  {describeFieldStep(record)}
                </Typography.Text>
              </div>
              <Space size={4} className="field-rule-chain-actions">
                <Tooltip title="编辑">
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => focusFieldRule(record)} />
                </Tooltip>
                <Tooltip title={record.enabled === false ? "启用规则" : "停用规则"}>
                  <Button
                    size="small"
                    type="text"
                    icon={record.enabled === false ? <PlayCircleOutlined /> : <PauseOutlined />}
                    onClick={() => toggleFieldRuleEnabled(record.stepKey)}
                  />
                </Tooltip>
                <Tooltip title="上移">
                  <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => moveFieldRule(record.stepKey, activeField.name, "up")} />
                </Tooltip>
                <Tooltip title="下移">
                  <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={index === activeFieldSteps.length - 1} onClick={() => moveFieldRule(record.stepKey, activeField.name, "down")} />
                </Tooltip>
                <Tooltip title="复制规则">
                  <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => duplicateFieldRule(record, activeField.name)} />
                </Tooltip>
                <Tooltip title="删除">
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeFieldRule(record.stepKey, activeField.name)} />
                </Tooltip>
              </Space>
            </div>
          );
          return invalid ? (
            <Tooltip key={record.stepKey} title="当前字段类型不匹配该转换规则，执行会报错">
              {row}
            </Tooltip>
          ) : row;
        })}
      </div>
    );
  }

  const selectedFormatStep = getStepByKey(activeFormatRuleKey);
  const selectedTransform = selectedFormatStep?.config?.transform as FieldConfigValues["transform"] | undefined;
  const selectedFormatValues = buildFieldDraftFromStep(selectedFormatStep);

  const selectedValidateStep = getStepByKey(activeValidateRuleKey);
  const selectedValidationType = selectedValidateStep?.config?.validationType as FieldConfigValues["validationType"] | undefined;
  const selectedValidateValues = buildFieldDraftFromStep(selectedValidateStep);

  const selectedRuleItem = fieldRuleCatalog
    .flatMap((group) => group.items)
    .find((item) => item.category === "format" ? item.type === selectedTransform : item.type === selectedValidationType);
  const activeRuleGroup = fieldRuleCatalog.find((group) => group.key === activeRuleCategoryKey) || fieldRuleCatalog[0];

  function renderRuleCatalogItem(item: FieldRuleCatalogItem) {
    if (!activeField) return null;
    const disabled = Boolean(item.stringOnly && !isStringLikeColumn(activeField));
    const active = activeFieldSteps.some((step) => {
      if (item.category === "format") {
        const transform = String(step.config?.transform || "");
        return step.stepType === "format" && (transform === item.type || legacyDesensitizeTransformMap[transform] === item.type);
      }
      return step.stepType === "validate" && String(step.config?.validationType || "") === item.type;
    });
    return (
      <Button
        key={item.key}
        block
        disabled={disabled}
        type="default"
        onClick={() => {
          if (item.category === "validate" && item.type === "required" && item.quick) {
            toggleQuickRequiredFilter(activeField.name);
            return;
          }
          toggleFieldRule(activeField.name, item.category, item.type);
        }}
        className={active ? "field-rule-option field-rule-option--active" : "field-rule-option"}
      >
        <span className="field-rule-option__content">
          <span className="field-rule-option__title">{item.title}</span>
          <span className="field-rule-option__desc">{disabled ? "当前字段类型不适用" : item.description}</span>
        </span>
      </Button>
    );
  }

  function renderFormatRuleEditor() {
    if (!activeField || !selectedFormatStep || !selectedTransform) {
      return (
        <div className="field-rule-param-empty">
          <Typography.Text type="secondary">从左侧选择格式规则后配置参数</Typography.Text>
        </div>
      );
    }
    return (
      <Space direction="vertical" size={12} className="field-rule-param-form">
        <div className="field-rule-param-current">{getFieldRuleName(selectedFormatStep)}</div>
        {selectedTransform === "desensitize_mask" ? (
          <>
            <Space.Compact block>
              <Input
                addonBefore="前缀保留"
                placeholder="3"
                value={String(selectedFormatValues.prefixLength ?? "")}
                onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "desensitize_mask", prefixLength: event.target.value })}
              />
              <Input
                addonBefore="后缀保留"
                placeholder="4"
                value={String(selectedFormatValues.suffixLength ?? "")}
                onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "desensitize_mask", suffixLength: event.target.value })}
              />
            </Space.Compact>
            <Input
              addonBefore="掩码字符"
              placeholder="*"
              value={String(selectedFormatValues.maskChar ?? "")}
              onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "desensitize_mask", maskChar: event.target.value })}
            />
          </>
        ) : null}
        {selectedTransform === "desensitize_replace" ? (
          <>
            <Input
              addonBefore="匹配内容"
              placeholder="^1(\\d{7})(\\d{4})$"
              value={String(selectedFormatValues.replacePattern ?? "")}
              onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "desensitize_replace", replacePattern: event.target.value })}
            />
            <Input
              addonBefore="替换为"
              placeholder="匿名用户"
              value={String(selectedFormatValues.replaceValue ?? "")}
              onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "desensitize_replace", replaceValue: event.target.value })}
            />
          </>
        ) : null}
        {selectedTransform === "desensitize_encrypt" ? (
          <>
            <Select
              value={selectedFormatValues.encryptAlgorithm || "md5"}
              options={[
                { value: "md5", label: "MD5" },
                { value: "sha1", label: "SHA1" },
                { value: "sha256", label: "SHA256" },
              ]}
              onChange={(value) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "desensitize_encrypt", encryptAlgorithm: value })}
            />
            <Input
              addonBefore="加盐"
              placeholder="可选"
              value={String(selectedFormatValues.salt ?? "")}
              onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "desensitize_encrypt", salt: event.target.value })}
            />
          </>
        ) : null}
        {selectedTransform === "desensitize_generalize" ? (
          <Input
            addonBefore="保留长度"
            placeholder="6"
            value={String(selectedFormatValues.generalizeLength ?? "")}
            onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "desensitize_generalize", generalizeLength: event.target.value })}
          />
        ) : null}
        {selectedTransform === "date_format" ? (
          <Input
            addonBefore="输出格式"
            placeholder="%Y-%m-%d"
            value={String(selectedFormatValues.format ?? "")}
            onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "date_format", format: event.target.value })}
          />
        ) : null}
        {selectedTransform === "regex_replace" ? (
          <Space direction="vertical" size={8} style={{ display: "flex" }}>
            <Input
              addonBefore="匹配正则"
              placeholder="^\\+86"
              value={String(selectedFormatValues.pattern ?? "")}
              onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "regex_replace", pattern: event.target.value })}
            />
            <Input
              addonBefore="替换值"
              placeholder=""
              value={String(selectedFormatValues.replacement ?? "")}
              onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "regex_replace", replacement: event.target.value })}
            />
          </Space>
        ) : null}
        {selectedTransform === "substring" ? (
          <Space.Compact block>
            <Input
              addonBefore="起始"
              placeholder="0"
              value={String(selectedFormatValues.start ?? "")}
              onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "substring", start: event.target.value })}
            />
            <Input
              addonBefore="长度"
              placeholder="8"
              value={String(selectedFormatValues.length ?? "")}
              onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "substring", length: event.target.value })}
            />
          </Space.Compact>
        ) : null}
        {selectedTransform === "null_to_default" ? (
          <Input
            addonBefore="默认值"
            placeholder="未知"
            value={String(selectedFormatValues.defaultValue ?? "")}
            onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "null_to_default", defaultValue: event.target.value })}
          />
        ) : null}
        {selectedTransform === "number_round" ? (
          <Input
            addonBefore="小数位"
            placeholder="2"
            value={String(selectedFormatValues.precision ?? "")}
            onChange={(event) => updateFieldFormatConfig(selectedFormatStep.stepKey, activeField.name, { transform: "number_round", precision: event.target.value })}
          />
        ) : null}
        {["trim", "remove_spaces", "upper", "lower", "full_to_half", "half_to_full", "blank_to_null"].includes(String(selectedTransform)) ? (
          <Typography.Text className="field-rule-help">该规则无需额外参数，保存或预览时会按规则链顺序执行。</Typography.Text>
        ) : null}
      </Space>
    );
  }

  function renderValidateRuleEditor() {
    if (!activeField || !selectedValidateStep || !selectedValidationType) {
      return (
        <div className="field-rule-param-empty">
          <Typography.Text type="secondary">从左侧选择校验规则后配置参数</Typography.Text>
        </div>
      );
    }
    return (
      <Space direction="vertical" size={12} className="field-rule-param-form">
        <div className="field-rule-param-current">{getFieldRuleName(selectedValidateStep)}</div>
        <Select
          value={(selectedValidateValues.mode as FieldConfigValues["mode"]) || "keep_valid"}
          options={[
            { value: "keep_valid", label: "保留并打标" },
            { value: "drop_invalid", label: "过滤无效记录" },
          ]}
          onChange={(value) => updateFieldValidateConfig(selectedValidateStep.stepKey, activeField.name, {
            validationType: selectedValidationType,
            mode: value as FieldConfigValues["mode"],
          })}
        />
        {(selectedValidateValues.mode as FieldConfigValues["mode"]) !== "drop_invalid" ? (
          <Input
            addonBefore="打标字段"
            value={String(selectedValidateValues.tagFieldName ?? selectedValidateStep.config?.tagFieldName ?? buildValidationTagFieldName(activeField.name, selectedValidationType))}
            onChange={(event) => updateFieldValidateConfig(selectedValidateStep.stepKey, activeField.name, {
              validationType: selectedValidationType,
              mode: "keep_valid",
              tagFieldName: event.target.value,
            })}
          />
        ) : null}
        {selectedValidationType === "regex" ? (
          <Input
            addonBefore="正则"
            placeholder="^1[0-9]{10}$"
            value={String(selectedValidateValues.validationPattern ?? "")}
            onChange={(event) => updateFieldValidateConfig(selectedValidateStep.stepKey, activeField.name, { validationType: "regex", validationPattern: event.target.value })}
          />
        ) : null}
        {selectedValidationType === "enum" ? (
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder="A, B, C"
            value={String(selectedValidateValues.enumValues ?? "")}
            onChange={(event) => updateFieldValidateConfig(selectedValidateStep.stepKey, activeField.name, { validationType: "enum", enumValues: event.target.value })}
          />
        ) : null}
        {selectedValidationType === "range" ? (
          <Space.Compact block>
            <Input
              addonBefore="最小值"
              value={String(selectedValidateValues.minValue ?? "")}
              onChange={(event) => updateFieldValidateConfig(selectedValidateStep.stepKey, activeField.name, { validationType: "range", minValue: event.target.value })}
            />
            <Input
              addonBefore="最大值"
              value={String(selectedValidateValues.maxValue ?? "")}
              onChange={(event) => updateFieldValidateConfig(selectedValidateStep.stepKey, activeField.name, { validationType: "range", maxValue: event.target.value })}
            />
          </Space.Compact>
        ) : null}
        {selectedValidationType === "length" ? (
          <Space.Compact block>
            <Input
              addonBefore="最小长度"
              value={String(selectedValidateValues.minLength ?? "")}
              onChange={(event) => updateFieldValidateConfig(selectedValidateStep.stepKey, activeField.name, { validationType: "length", minLength: event.target.value })}
            />
            <Input
              addonBefore="最大长度"
              value={String(selectedValidateValues.maxLength ?? "")}
              onChange={(event) => updateFieldValidateConfig(selectedValidateStep.stepKey, activeField.name, { validationType: "length", maxLength: event.target.value })}
            />
          </Space.Compact>
        ) : null}
        {selectedValidationType === "custom" ? (
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 5 }}
            placeholder={`${activeField.name} IS NOT NULL AND ${activeField.name} <> ''`}
            value={String(selectedValidateValues.customExpression ?? "")}
            onChange={(event) => updateFieldValidateConfig(selectedValidateStep.stepKey, activeField.name, { validationType: "custom", customExpression: event.target.value })}
          />
        ) : null}
      </Space>
    );
  }

  const jointColumns: ColumnsType<DevProcessingStepRecord> = [
    { title: "规则名称", dataIndex: "stepName", width: 180 },
    { title: "类型", dataIndex: "stepType", width: 120, render: (value) => getStepTypeLabel(value) },
    { title: "规则说明", key: "summary", render: (_, record) => describeJointStep(record) },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" onClick={() => openJointRuleModal(record)}>编辑</Button>
          <Button type="link" danger onClick={() => removeStep(record.stepKey)}>删除</Button>
        </Space>
      ),
    },
  ];

  const lookupColumns: ColumnsType<DevProcessingStepRecord> = [
    { title: "规则名称", dataIndex: "stepName", width: 180 },
    { title: "关联说明", key: "summary", render: (_, record) => describeLookupStep(record) },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" onClick={() => openLookupRuleModal(record)}>编辑</Button>
          <Button type="link" danger onClick={() => removeStep(record.stepKey)}>删除</Button>
        </Space>
      ),
    },
  ];

  const appliedStepColumns: ColumnsType<DevProcessingStepRecord> = [
    { title: "顺序", key: "order", width: 70, render: (_, __, index) => index + 1 },
    { title: "步骤名称", dataIndex: "stepName", width: 180 },
    { title: "步骤类型", dataIndex: "stepType", width: 120, render: (value) => getStepTypeLabel(value) },
    {
      title: "说明",
      key: "summary",
      render: (_, record) => {
        if (record.stepType === "format") return describeFormatStep(record);
        if (record.stepType === "validate") return describeValidateStep(record);
        if (record.stepType === "lookup_fill") return describeLookupStep(record);
        return describeJointStep(record);
      },
    },
  ];

  const previewColumns: ColumnsType<Record<string, unknown>> = useMemo(
    () => (preview?.fields || []).map((field) => ({
      title: field,
      dataIndex: field,
      key: field,
      width: 180,
      render: (value) => String(value ?? "-"),
    })),
    [preview]
  );

  return (
    <div className="app-page">
      <PageToolbar
        left={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dashboard/data-development/processing")}>返回清单</Button>}
        right={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void loadDetail()} loading={loading}>刷新</Button>
            <Button icon={<SearchOutlined />} onClick={() => void handlePreview()}>预览</Button>
            <Button icon={<SaveOutlined />} onClick={() => void handleSave()} loading={saving}>保存草稿</Button>
            <Button icon={<CalendarOutlined />} onClick={() => void handleCreateSchedule()} loading={creatingSchedule}>创建调度</Button>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => void handleRun()} loading={running}>立即执行</Button>
          </Space>
        )}
      />

      <div className="app-page-body">
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Card variant="borderless" loading={loading}>
            <Card
              size="small"
              title="基础配置"
              styles={{ body: { padding: 10 } }}
              extra={(
                <Space size={8} wrap>
                  <Tag color="blue">{job?.version ? `当前版本：V${job.version.versionNo}` : "当前版本：未保存"}</Tag>
                  <Tag>{`最近运行：${formatDateTime(job?.lastRunAt)}`}</Tag>
                </Space>
              )}
            >
              <Form form={form} layout="vertical">
                <div style={{ height: 204, overflowY: "auto", overflowX: "hidden", paddingRight: 4 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "0.92fr 1.7fr", gap: 10, alignItems: "stretch" }}>
                    <div style={{ border: "1px solid #edf1f7", borderRadius: 12, background: "#fff", minHeight: 0 }}>
                      <div style={{ padding: 10 }}>
                        <Typography.Text strong style={{ display: "block", marginBottom: 10 }}>任务调度</Typography.Text>
                        <div style={{ display: "grid", gap: 10 }}>
                          {renderInlineField("任务名称", "name", <Input size="small" />, { required: true })}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <div style={{ ...compactLabelStyle, lineHeight: "32px" }}>任务说明</div>
                            <Form.Item name="description" style={{ marginBottom: 0, flex: 1 }}>
                              <Input size="small" />
                            </Form.Item>
                          </div>
                          {renderInlineField("调度方式", "scheduleType", <Select size="small" options={scheduleTypeOptions} />)}
                          {selectedScheduleType === "daily" ? renderInlineField("执行时间", "scheduleTime", <Input size="small" placeholder="02:00" />) : null}
                          {selectedScheduleType === "weekly" ? (
                            <>
                              {renderInlineField(
                                "执行星期",
                                "scheduleDay",
                                <Select
                                  size="small"
                                  options={[
                                    { value: 1, label: "周一" },
                                    { value: 2, label: "周二" },
                                    { value: 3, label: "周三" },
                                    { value: 4, label: "周四" },
                                    { value: 5, label: "周五" },
                                    { value: 6, label: "周六" },
                                    { value: 7, label: "周日" },
                                  ]}
                                />
                              )}
                              {renderInlineField("执行时间", "scheduleTime", <Input size="small" placeholder="02:00" />)}
                            </>
                          ) : null}
                          {selectedScheduleType === "cron" ? renderInlineField("Cron", "scheduleCronExpr", <Input size="small" placeholder="0 0 2 * * *" />) : null}
                        </div>
                      </div>
                    </div>

                    <div style={{ border: "1px solid #edf1f7", borderRadius: 12, padding: 10, background: "#fff", minHeight: 0 }}>
                      <Typography.Text strong style={{ display: "block", marginBottom: 10 }}>来源配置</Typography.Text>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 16, rowGap: 10 }}>
                        {renderInlineField("数据源", "datasourceId", <Select size="small" options={datasources.map((item) => ({ value: item.id, label: item.name }))} />, { required: true })}
                        {renderInlineField("处理范围", "scopeMode", <Select size="small" options={scopeModeOptions} />)}
                        {renderInlineField("数据库", "databaseName", <Select size="small" allowClear options={databases.map((item) => ({ value: item.name, label: item.name }))} />)}
                        {renderInlineField(
                          "范围字段",
                          "scopeFieldName",
                          <Select
                            size="small"
                            allowClear
                            disabled={selectedScopeMode === "all"}
                            options={columns.map((item) => ({ value: item.name, label: item.name }))}
                          />
                        )}
                        {renderInlineField("源表", "tableName", <Select size="small" showSearch optionFilterProp="label" options={tables.map((item) => ({ value: item.name, label: item.name }))} />, { required: true })}
                        {selectedScopeMode === "system_time_range"
                          ? renderInlineField("系统变量", "scopeTimeVariable", <Select size="small" options={scopeTimeVariableOptions} />)
                          : renderInlineField("预览条数", "sampleLimit", <InputNumber size="small" min={1} max={200} style={{ width: "100%" }} />)}
                        {selectedScopeMode === "system_time_range"
                          ? renderInlineField("时间格式", "scopeTimeFormat", <Input size="small" placeholder="%Y-%m-%d %H:%i:%s" />)
                          : <div />}
                        {selectedScopeMode === "system_time_range" ? (
                          <div style={{ gridColumn: "2 / 3", display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <div style={{ ...compactLabelStyle, lineHeight: "32px" }}>偏移配置</div>
                            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 92px", gap: 8 }}>
                              <Form.Item name="scopeStartOffset" style={{ marginBottom: 0 }}>
                                <InputNumber size="small" style={{ width: "100%" }} placeholder="开始偏移" />
                              </Form.Item>
                              <Form.Item name="scopeEndOffset" style={{ marginBottom: 0 }}>
                                <InputNumber size="small" style={{ width: "100%" }} placeholder="结束偏移" />
                              </Form.Item>
                              <Form.Item name="scopeOffsetUnit" style={{ marginBottom: 0 }}>
                                <Select size="small" options={scopeOffsetUnitOptions} />
                              </Form.Item>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </Form>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
                {compactStats.map((item) => (
                  <div key={item.key} style={{ border: "1px solid #edf1f7", borderRadius: 10, padding: "6px 10px", background: "#fff" }}>
                    <Typography.Text type="secondary" style={{ display: "block", fontSize: 12, lineHeight: 1.3 }}>{item.title}</Typography.Text>
                    <Typography.Text strong style={{ display: "block", marginTop: 3, fontSize: 17, lineHeight: 1 }}>{item.value}</Typography.Text>
                  </div>
                ))}
              </div>
            </Card>
          </Card>

          <Card variant="borderless" styles={{ body: { paddingTop: 0 } }}>
            <Tabs
              items={[
                {
                  key: "field",
                  label: "字段处理",
                  children: (
                    <Table<DevColumnEntry>
                      rowKey="name"
                      size="small"
                      tableLayout="fixed"
                      columns={fieldColumns}
                      dataSource={columns}
                      pagination={false}
                      scroll={{ x: 1540, y: 620 }}
                      locale={{ emptyText: <Empty description="请选择数据源和源表后查看字段结构" /> }}
                    />
                  ),
                },
                {
                  key: "joint",
                  label: "联合处理",
                  children: (
                    <Card size="small" variant="borderless" data-readonly-allow-action="true" extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openJointRuleModal()}>新建联合规则</Button>}>
                      <Table<DevProcessingStepRecord>
                        rowKey="stepKey"
                        size="small"
                        columns={jointColumns}
                        dataSource={jointSteps}
                        pagination={false}
                        scroll={{ x: 980 }}
                        locale={{ emptyText: <Empty description="暂无联合处理规则" /> }}
                      />
                    </Card>
                  ),
                },
                {
                  key: "lookup",
                  label: "关联回填",
                  children: (
                    <Card size="small" variant="borderless" data-readonly-allow-action="true" extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openLookupRuleModal()}>新建回填规则</Button>}>
                      <Table<DevProcessingStepRecord>
                        rowKey="stepKey"
                        size="small"
                        columns={lookupColumns}
                        dataSource={lookupSteps}
                        pagination={false}
                        scroll={{ x: 980 }}
                        locale={{ emptyText: <Empty description="暂无关联回填规则" /> }}
                      />
                    </Card>
                  ),
                },
                {
                  key: "target",
                  label: "目标表配置",
                  children: (
                    <Card size="small" variant="borderless">
                      <Space direction="vertical" size={16} style={{ display: "flex" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
                          <Form form={form} layout="vertical" component={false}>
                            <Form.Item name="targetMode" label="写入策略" style={{ marginBottom: 0 }}>
                              <Select size="small" options={targetModeOptions} />
                            </Form.Item>
                            <Form.Item name="targetWriteMode" label="写入方式" style={{ marginBottom: 0 }}>
                              <Select size="small" options={targetWriteModeOptions} />
                            </Form.Item>
                            <Form.Item name="targetConfigDatabaseName" label="目标库" style={{ marginBottom: 0 }}>
                              <Select size="small" allowClear options={databases.map((item) => ({ value: item.name, label: item.name }))} />
                            </Form.Item>
                            <Form.Item name="targetConfigTableName" label="目标表" style={{ marginBottom: 0 }}>
                              <Select
                                size="small"
                                showSearch
                                allowClear
                                optionFilterProp="label"
                                disabled={selectedTargetMode === "source"}
                                options={selectedTargetMode === "existing"
                                  ? tables.map((item) => ({ value: item.name, label: item.name }))
                                  : []}
                              />
                            </Form.Item>
                          </Form>
                        </div>

                        <Card
                          size="small"
                          title="字段映射"
                          extra={(
                            <Button
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={() => setTargetMappings((current) => [
                                ...current,
                                { key: `mapping_${Date.now()}`, sourceField: columns[0]?.name || "", targetField: "" },
                              ])}
                            >
                              新增映射
                            </Button>
                          )}
                        >
                          <Table<TargetMappingRow>
                            rowKey="key"
                            size="small"
                            pagination={false}
                            dataSource={targetMappings}
                            locale={{ emptyText: <Empty description="可按需定义输出字段映射" /> }}
                            columns={[
                              {
                                title: "源字段",
                                dataIndex: "sourceField",
                                width: 220,
                                render: (value, record) => (
                                  <Select
                                    size="small"
                                    showSearch
                                    optionFilterProp="label"
                                    value={value}
                                    options={processedSourceFields.map((item) => ({ value: item.name, label: item.comment ? `${item.name} / ${item.comment}` : item.name }))}
                                    onChange={(next) => setTargetMappings((current) => current.map((item) => item.key === record.key ? { ...item, sourceField: String(next) } : item))}
                                  />
                                ),
                              },
                              {
                                title: "目标字段",
                                dataIndex: "targetField",
                                width: 240,
                                render: (value, record) => (
                                  selectedTargetMode === "create" ? (
                                    <Input
                                      size="small"
                                      value={value}
                                      placeholder="输入目标字段名"
                                      onChange={(event) => setTargetMappings((current) => current.map((item) => item.key === record.key ? { ...item, targetField: event.target.value } : item))}
                                    />
                                  ) : (
                                    <Select
                                      size="small"
                                      showSearch
                                      optionFilterProp="label"
                                      value={value || undefined}
                                      placeholder={selectedTargetMode === "source" ? "选择原表字段" : "选择目标表字段"}
                                      options={targetFieldOptions}
                                      onChange={(next) => setTargetMappings((current) => current.map((item) => item.key === record.key ? { ...item, targetField: String(next) } : item))}
                                    />
                                  )
                                ),
                              },
                              {
                                title: "操作",
                                key: "actions",
                                width: 100,
                                render: (_, record) => (
                                  <Button size="small" type="link" danger onClick={() => setTargetMappings((current) => current.filter((item) => item.key !== record.key))}>
                                    删除
                                  </Button>
                                ),
                              },
                            ]}
                          />
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            源字段会自动跟随处理链刷新，包含格式转换、校验打标、关联回填新增字段；选择已有目标表后会自动加载目标字段供映射。
                          </Typography.Text>
                        </Card>
                      </Space>
                    </Card>
                  ),
                },
                {
                  key: "preview",
                  label: "预览与发布",
                  children: (
                    <Space direction="vertical" size={16} style={{ display: "flex" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "360px minmax(0, 1fr)", gap: 16 }}>
                        <Card size="small" title="已应用步骤" styles={{ body: { padding: 0 } }}>
                          <Table<DevProcessingStepRecord>
                            rowKey="stepKey"
                            size="small"
                            columns={appliedStepColumns}
                            dataSource={steps}
                            pagination={false}
                            scroll={{ y: 420 }}
                            locale={{ emptyText: <Empty description="尚未配置任何处理步骤" /> }}
                          />
                        </Card>

                        <Space direction="vertical" size={16} style={{ display: "flex" }}>
                          <Card size="small" title="样本预览" extra={preview ? <Tag color="blue">{preview.rowCount} 行</Tag> : null}>
                            {preview ? (
                              <Table
                                rowKey={(_, index) => String(index)}
                                size="small"
                                columns={previewColumns}
                                dataSource={preview.rows || []}
                                pagination={false}
                                scroll={{ x: 1200, y: 320 }}
                              />
                            ) : (
                              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="先点击预览查看处理结果" />
                            )}
                          </Card>

                          <Card size="small" title="生成 SQL">
                            <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                              {preview?.previewSql || "暂无 SQL 预览"}
                            </Typography.Paragraph>
                          </Card>

                          <DataTableCard<DevProcessingRunRecord>
                            title="运行记录"
                            tableProps={{
                              rowKey: "id",
                              size: "small",
                              dataSource: runs,
                              pagination: { pageSize: 5 },
                              columns: [
                                { title: "版本", dataIndex: "versionNo", width: 80 },
                                { title: "状态", dataIndex: "runStatus", width: 100, render: (value) => renderRunStatus(value) },
                                { title: "目标表", dataIndex: "targetTableName", width: 200, render: (value) => value || "-" },
                                { title: "输出行数", dataIndex: "outputRowCount", width: 100, render: (value) => value ?? "-" },
                                { title: "耗时", dataIndex: "durationMs", width: 100, render: (value) => value ? `${value}ms` : "-" },
                                { title: "执行时间", dataIndex: "createdAt", width: 180, render: (value) => formatDateTime(value) },
                              ],
                            }}
                          />
                        </Space>
                      </div>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Space>
      </div>

      <Modal
        open={jointModalOpen}
        title={editingJointStepKey ? "编辑联合处理规则" : "新建联合处理规则"}
        onCancel={() => {
          setJointModalOpen(false);
          setEditingJointStepKey(null);
          jointForm.resetFields();
        }}
        onOk={() => void handleSaveJointRule()}
        destroyOnHidden
        width={720}
      >
        <Form form={jointForm} layout="vertical" initialValues={{ stepType: "filter", mode: "keep_valid" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Item name="stepName" label="规则名称"><Input placeholder="例如：按业务主键联合去重" /></Form.Item>
            <Form.Item name="stepType" label="规则类型" rules={[{ required: true }]}>
              <Select options={[{ value: "filter", label: "条件过滤" }, { value: "deduplicate", label: "联合去重" }, { value: "validate", label: "多字段校验" }]} />
            </Form.Item>
          </div>

          {currentJointType === "filter" ? (
            <Form.Item name="expression" label="过滤表达式" rules={[{ required: true, message: "请输入过滤表达式" }]}>
              <Input.TextArea rows={5} placeholder="status = 'active' AND amount > 0" />
            </Form.Item>
          ) : null}

          {currentJointType === "deduplicate" ? (
            <>
              <Form.Item name="keyFields" label="去重字段" rules={[{ required: true, message: "请选择至少一个去重字段" }]}>
                <Select mode="multiple" options={columns.map((item) => ({ value: item.name, label: item.name }))} />
              </Form.Item>
              <Form.Item name="orderBy" label="保留优先级排序"><Input placeholder="例如：updated_at DESC, created_at DESC" /></Form.Item>
            </>
          ) : null}

          {currentJointType === "validate" ? (
            <>
              <Form.Item name="expression" label="校验表达式" rules={[{ required: true, message: "请输入多字段校验表达式" }]}>
                <Input.TextArea rows={5} placeholder="start_date <= end_date AND status_code IN ('A','B')" />
              </Form.Item>
              <Form.Item name="mode" label="无效数据处理">
                <Select options={[{ value: "keep_valid", label: "保留并打标" }, { value: "drop_invalid", label: "过滤无效记录" }]} />
              </Form.Item>
            </>
          ) : null}
        </Form>
      </Modal>

      <Modal
        open={fieldRuleDrawerOpen}
        title={activeField ? `字段规则链：${activeField.name}` : "字段规则链"}
        width="min(1280px, calc(100vw - 96px))"
        footer={null}
        centered
        onCancel={() => {
          setFieldRuleDrawerOpen(false);
          setActiveField(null);
          setActiveFormatRuleKey(null);
          setActiveValidateRuleKey(null);
          setActiveRuleEditorTab("format");
        }}
        destroyOnHidden
        className="field-rule-chain-modal"
      >
        {activeField ? (
          <div className="field-rule-chain-shell">
            <Card className="field-rule-info-card" bordered>
              <div className="field-rule-info-grid">
                {[
                  ["字段类型", activeField.columnType || activeField.dataType || "-", false],
                  ["主键", activeField.primaryKey ? "是" : "否", false],
                  ["可空", activeField.nullable ? "是" : "否", false],
                  ["原始值", firstMeaningfulRawValue(rawPreview?.rows || [], activeField.name), true],
                  ["结果值", firstMeaningfulPreviewValue(preview?.rows || [], rawPreview?.rows || [], activeField.name), "result"],
                ].map(([label, value, highlight]) => (
                  <div key={String(label)} className="field-rule-info-item">
                    <Typography.Text className="field-rule-info-label">{label}</Typography.Text>
                    <Typography.Text className={highlight === true ? "field-rule-info-value field-rule-info-value--sample" : highlight === "result" ? "field-rule-info-value field-rule-info-value--result" : "field-rule-info-value"} ellipsis={{ tooltip: String(value) }}>
                      {String(value)}
                    </Typography.Text>
                  </div>
                ))}
              </div>
            </Card>

            <Divider />

            <div className="field-rule-config-grid" data-readonly-allow-action="true">
              <Card className="field-rule-category-card" title="规则分类" bordered>
                <Menu
                  className="field-rule-category-menu"
                  mode="inline"
                  selectedKeys={[activeRuleGroup.key]}
                  onClick={({ key }) => setActiveRuleCategoryKey(String(key))}
                  items={fieldRuleCatalog.map((group) => ({
                    key: group.key,
                    label: (
                      <div className="field-rule-category-menu__label">
                        <span>{group.title}</span>
                        <small>{group.description}</small>
                      </div>
                    ),
                  }))}
                />
              </Card>

              <Card className="field-rule-picker-card" title={activeRuleGroup.title} extra={<Typography.Text type="secondary">{activeRuleGroup.description}</Typography.Text>} bordered>
                <div key={activeRuleGroup.key} className="field-rule-option-grid">
                  {activeRuleGroup.items.map(renderRuleCatalogItem)}
                </div>
              </Card>

              <Card
                className="field-rule-param-card"
                title="规则参数"
                extra={selectedRuleItem ? <Tag color={selectedRuleItem.category === "format" ? "blue" : "gold"}>{selectedRuleItem.title}</Tag> : null}
                bordered
              >
                <Tabs
                  size="small"
                  activeKey={activeRuleEditorTab}
                  items={[
                    { key: "format", label: "格式处理", children: <div className="field-rule-param-panel">{renderFormatRuleEditor()}</div> },
                    { key: "validate", label: "校验规则", children: <div className="field-rule-param-panel">{renderValidateRuleEditor()}</div> },
                  ]}
                  onChange={(key) => setActiveRuleEditorTab(key as "format" | "validate")}
                />
              </Card>
            </div>

            <Divider />

            <section className="field-rule-chain-section" data-readonly-allow-action="true">
              <div className="field-rule-chain-header">
                <div>
                  <Typography.Text className="field-rule-section-title">当前字段规则链</Typography.Text>
                  <Typography.Text className="field-rule-section-help">按顺序执行，可停用、复制或调整顺序后再预览</Typography.Text>
                </div>
                <Tag color="blue" className="field-rule-enabled-count">
                  {`${activeFieldSteps.filter((step) => step.enabled !== false).length}/${activeFieldSteps.length} 启用`}
                </Tag>
              </div>
              {renderFieldRuleList()}
            </section>

            <Divider />

            <div className="field-rule-footer">
              <Button className="field-rule-footer-button" icon={<SearchOutlined />} onClick={() => void handlePreview()}>预览结果</Button>
              <Button className="field-rule-footer-button" type="primary" icon={<SaveOutlined />} onClick={() => void handleSave()} loading={saving}>保存规则链</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={lookupModalOpen}
        title={editingLookupStepKey ? "编辑关联回填规则" : "新建关联回填规则"}
        onCancel={() => {
          setLookupModalOpen(false);
          setEditingLookupStepKey(null);
          lookupForm.resetFields();
        }}
        onOk={() => void handleSaveLookupRule()}
        destroyOnHidden
        width={760}
      >
        <Form form={lookupForm} layout="vertical">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Item name="stepName" label="规则名称"><Input placeholder="例如：按法人ID回填法人名称" /></Form.Item>
            <Form.Item name="lookupTable" label="关联表" rules={[{ required: true, message: "请选择关联表" }]}>
              <Select showSearch optionFilterProp="label" options={tables.map((item) => ({ value: item.name, label: item.name }))} />
            </Form.Item>
            <Form.Item name="sourceField" label="源表关联字段" rules={[{ required: true, message: "请选择源表关联字段" }]}><Select showSearch optionFilterProp="label" options={columns.map((item) => ({ value: item.name, label: item.name }))} /></Form.Item>
            <Form.Item name="lookupKeyField" label="关联表键字段" rules={[{ required: true, message: "请选择关联表键字段" }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="选择关联键字段"
                options={lookupTableFieldOptions}
              />
            </Form.Item>
            <Form.Item name="lookupValueField" label="关联表值字段" rules={[{ required: true, message: "请选择回填值字段" }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="选择回填值字段"
                options={lookupTableFieldOptions}
              />
            </Form.Item>
            <Form.Item name="targetFieldMode" label="目标字段模式" initialValue="existing">
              <Select options={[{ value: "existing", label: "选择现有字段" }, { value: "custom", label: "新增自定义字段" }]} />
            </Form.Item>
            <Form.Item name="lookupSqlFilter" label="关联筛选 SQL">
              <Input placeholder="例如：status = '1' AND type_code = 'A'" />
            </Form.Item>
            <Form.Item shouldUpdate noStyle>
              {() => {
                const targetFieldMode = lookupForm.getFieldValue("targetFieldMode") || "existing";
                return targetFieldMode === "custom" ? (
                  <>
                    <Form.Item name="targetFieldCustom" label="新增目标字段" rules={[{ required: true, message: "请输入目标字段名" }]}>
                      <Input placeholder="例如：entity_name_filled" />
                    </Form.Item>
                    <Form.Item name="targetFieldDataType" label="字段类型" initialValue="text">
                      <Select
                        options={[
                          { value: "text", label: "text" },
                          { value: "varchar", label: "varchar" },
                          { value: "int", label: "int" },
                          { value: "bigint", label: "bigint" },
                          { value: "decimal", label: "decimal" },
                          { value: "date", label: "date" },
                          { value: "timestamp", label: "timestamp" },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item name="targetFieldComment" label="字段注释">
                      <Input placeholder="例如：按关联表回填的法人名称" />
                    </Form.Item>
                  </>
                ) : (
                  <Form.Item name="targetField" label="回填目标字段" rules={[{ required: true, message: "请选择目标字段" }]}>
                    <Select showSearch optionFilterProp="label" options={columns.map((item) => ({ value: item.name, label: item.name }))} />
                  </Form.Item>
                );
              }}
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export function DataDevelopmentProcessingPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [datasourceFilter, setDatasourceFilter] = useState<number | undefined>();
  const [datasources, setDatasources] = useState<DevDatasourceRecord[]>([]);
  const [jobs, setJobs] = useState<DevProcessingJobRecord[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingScheduleId, setCreatingScheduleId] = useState<number | null>(null);
  const [createForm] = Form.useForm<CreateProcessingTaskValues>();

  async function loadList() {
    if (!token) return;
    setLoading(true);
    try {
      const [datasourceRes, jobRes] = await Promise.all([
        fetchDevDatasources(token),
        fetchDevProcessingJobs(token, {
          keyword: keyword || undefined,
          datasourceId: datasourceFilter,
        }),
      ]);
      setDatasources(datasourceRes.data || []);
      setJobs(jobRes.data || []);
    } catch (error: any) {
      message.error(error.message || "加载数据处理列表失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!jobId) void loadList();
  }, [token, keyword, datasourceFilter, jobId]);

  async function handleCreate() {
    if (!token) return;
    const values = await createForm.validateFields();
    setCreating(true);
    try {
      const response = await createDevProcessingJob(token, {
        name: values.name,
        description: values.description,
        datasourceId: values.datasourceId,
        databaseName: null,
        tableName: `${PENDING_SOURCE_TABLE}${Date.now()}`,
        targetTableName: null,
        outputMode: "preview_only",
        ownerName: null,
        pipeline: {
          sampleLimit: 50,
          scope: null,
          targetConfig: null,
          steps: [],
        },
        tags: [],
      });
      setCreateOpen(false);
      createForm.resetFields();
      navigate(`/dashboard/data-development/processing/${response.data.id}`);
    } catch (error: any) {
      message.error(error.message || "创建处理任务失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(record: DevProcessingJobRecord) {
    if (!token) return;
    try {
      await deleteDevProcessingJob(token, record.id);
      message.success("处理任务已删除");
      await loadList();
    } catch (error: any) {
      message.error(error.message || "删除失败");
    }
  }

  async function handleCreateSchedule(record: DevProcessingJobRecord) {
    if (!token) return;
    setCreatingScheduleId(record.id);
    try {
      const response = await createDevWorkflowFromTask(token, { taskType: "processing", taskId: record.id });
      message.success("调度工作流已创建");
      navigate(`/dashboard/data-development/scheduling/${response.data.id}/edit`);
    } catch (error: any) {
      message.error(error.message || "创建调度工作流失败");
    } finally {
      setCreatingScheduleId(null);
    }
  }

  if (jobId) return <ProcessingEditor jobId={Number(jobId)} />;

  const columns: ColumnsType<DevProcessingJobRecord> = [
    { title: "任务名称", dataIndex: "name", width: 180 },
    { title: "源表", dataIndex: "tableName", width: 240, render: (value) => displayTableName(value) },
    { title: "目标表", dataIndex: "targetTableName", width: 220, render: (value) => value || "-" },
    { title: "数据源", dataIndex: "datasourceName", width: 180 },
    { title: "已应用步骤", key: "stepCount", width: 100, render: (_, record) => record.version?.pipeline?.steps?.length || 0 },
    { title: "状态", dataIndex: "status", width: 100, render: (value) => renderRunStatus(value) },
    { title: "最近运行", dataIndex: "lastRunAt", width: 180, render: (value) => formatDateTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 300,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/dashboard/data-development/processing/${record.id}`)}>配置</Button>
          <Button
            type="link"
            onClick={async () => {
              if (!token) return;
              try {
                await runDevProcessingJob(token, record.id, {});
                message.success("任务已执行");
                await loadList();
              } catch (error: any) {
                message.error(error.message || "执行失败");
              }
            }}
          >
            运行
          </Button>
          <Button
            type="link"
            icon={<CalendarOutlined />}
            loading={creatingScheduleId === record.id}
            onClick={() => void handleCreateSchedule(record)}
          >
            创建调度
          </Button>
          <Button danger type="link" icon={<DeleteOutlined />} onClick={() => void handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="app-page">
      <PageToolbar
        left={(
          <>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索任务名称/源表/目标表"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              style={{ width: 320 }}
            />
            <Select
              allowClear
              placeholder="筛选数据源"
              style={{ width: 220 }}
              options={datasources.map((item) => ({ value: item.id, label: item.name }))}
              value={datasourceFilter}
              onChange={(value) => setDatasourceFilter(value)}
            />
          </>
        )}
        right={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadList()} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建处理任务</Button>
          </Space>
        )}
      />

      <div className="app-page-body">
        <DataTableCard<DevProcessingJobRecord>
          title="数据处理任务"
          tableProps={{
            rowKey: "id",
            loading,
            columns,
            dataSource: jobs,
            pagination: { pageSize: 10, showSizeChanger: true },
            scroll: { x: 1480 },
          }}
        />
      </div>

      <Modal
        open={createOpen}
        title="新建数据处理任务"
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreate()}
        confirmLoading={creating}
        destroyOnHidden
        width={680}
      >
        <Form form={createForm} layout="vertical">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
            <Form.Item name="name" label="任务名称" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="datasourceId" label="数据源" rules={[{ required: true }]}><Select options={datasources.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          </div>
          <Form.Item name="description" label="任务说明"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
