import "reactflow/dist/style.css";

import { ArrowLeftOutlined, CodeOutlined, DeleteOutlined, EyeOutlined, FullscreenExitOutlined, FullscreenOutlined, LinkOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MinusCircleOutlined, PartitionOutlined, PauseCircleOutlined, PlayCircleOutlined, PlusOutlined, RobotOutlined, SaveOutlined, TableOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Checkbox, Col, Collapse, Drawer, Empty, Form, Input, InputNumber, List, Modal, Row, Select as AntSelect, Space, Table, Tabs, Tag, Tree, Typography, message } from "antd";
import type { DataNode } from "antd/es/tree";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import ReactFlow, {
  BaseEdge,
  Background,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  applyEdgeChanges,
  applyNodeChanges,
  getSmoothStepPath,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from "reactflow";
import { PageToolbar } from "../../../components/ui/PageToolbar";
import {
  fetchDevColumns,
  fetchDevDatabases,
  fetchDevFunctions,
  fetchDevOrchestrationNodePreview,
  fetchDevOrchestrationSqlPreview,
  fetchDevTables,
  runDevOrchestration,
  saveDevOrchestrationGraph,
  updateDevOrchestration,
} from "../../../services/dataDevelopment";
import { fetchModelProviders } from "../../../services/modelProvider";
import type {
  DevColumnEntry,
  DevDatabaseEntry,
  DevDatasourceRecord,
  DevOrchestrationNodePreview,
  DevOrchestrationRunResult,
  DevOrchestrationSqlPreview,
  DevOrchestrationTaskRecord,
  DevRoutineEntry,
  DevTableEntry,
  ModelProviderRecord,
} from "../../../types/api";
import { detectSqlLanguage } from "../helpers";
import { format as formatSql } from "sql-formatter";

type CanvasNodeType = "source" | "operator" | "output";

type OperatorTemplate = {
  category?: string;
  operatorCode: string;
  nodeType: CanvasNodeType;
  badge?: string;
  label: string;
  description: string;
  color: string;
};

type OperatorCategory = {
  key: string;
  label: string;
  description: string;
};

type SourceDescriptor = {
  datasourceId: number;
  databaseName: string;
  tableName: string;
  nodeKey: string;
  label: string;
};

type SqlPreviewTabItem = {
  key: string;
  label: string;
  children: ReactNode;
};

type RenameMapping = {
  sourceField?: string;
  targetField?: string;
};

type ReplaceRule = {
  matchValue?: string;
  replaceValue?: string;
};

type SortFieldRule = {
  fieldName?: string;
  direction?: string;
};

type ConditionRule = {
  ruleType?: string;
  fieldName?: string;
  operator?: string;
  value?: string;
  valueSource?: string;
  referenceFieldRef?: string;
  referenceNodeKey?: string;
  referenceNodeName?: string;
  referenceField?: string;
  customSql?: string;
  checkType?: string;
  matchMode?: string;
  domainValues?: string;
};

type SqlInputBinding = {
  sourceNodeKey?: string;
  alias?: string;
};

type AggregationRule = {
  aggregateFunction?: string;
  fieldName?: string;
  alias?: string;
};

type PromptVariableMapping = {
  variableName?: string;
  sourceMode?: string;
  sourceField?: string;
  sourceFields?: string[];
  defaultValue?: string;
};

type AiOutputFieldMapping = {
  fieldName?: string;
  description?: string;
};

type JoinKeyRule = {
  leftField?: string;
  rightField?: string;
};

type FormatConvertRule = {
  sourceField?: string;
  targetField?: string;
  transformType?: string;
  formatPattern?: string;
  targetType?: string;
};

type ComplianceRule = {
  validationType?: string;
  sourceField?: string;
  targetField?: string;
  checkType?: string;
  customPattern?: string;
  fixedValue?: string;
  domainValues?: string;
  resultMode?: string;
  defaultValue?: string;
};

type StringProcessRule = {
  sourceField?: string;
  targetField?: string;
  transformType?: string;
  argument1?: string;
  argument2?: string;
};

type DesensitizeRule = {
  sourceField?: string;
  targetField?: string;
  maskType?: string;
  maskChar?: string;
  prefixLength?: number;
  suffixLength?: number;
  truncateLength?: number;
};

type StringAggregateRule = {
  sourceField?: string;
  outputField?: string;
  separator?: string;
  distinct?: boolean;
};

type OutputFieldMapping = {
  sourceField?: string;
  targetField?: string;
};

type SourceRangeFormatType =
  | "date"
  | "datetime"
  | "compact_date"
  | "compact_datetime"
  | "month"
  | "epoch_seconds"
  | "epoch_millis";

type SourceTimeBoundMode = "literal" | "system";
type SourceSystemTimeVariable = "current_date" | "current_datetime";
type SourceTimeOffsetUnit = "second" | "minute" | "hour" | "day" | "month" | "year";

type SourceTimeFilterConfig = {
  fieldName?: string;
  formatType?: SourceRangeFormatType;
  startMode?: SourceTimeBoundMode;
  startValue?: string;
  startSystemVariable?: SourceSystemTimeVariable;
  startOffset?: number;
  startOffsetUnit?: SourceTimeOffsetUnit;
  endMode?: SourceTimeBoundMode;
  endValue?: string;
  endSystemVariable?: SourceSystemTimeVariable;
  endOffset?: number;
  endOffsetUnit?: SourceTimeOffsetUnit;
};

type ColumnAlignmentBinding = {
  sourceNodeKey?: string;
  fieldName?: string;
};

type ColumnAlignmentRow = {
  outputField?: string;
  bindings?: ColumnAlignmentBinding[];
};

type OrchestrationEdgeStatus = "active" | "paused";
type CanvasLayoutDirection = "horizontal" | "vertical";
type CanvasMarqueeState = {
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
};

type PromptVariableHint = {
  name: string;
  label: string;
  summary: string;
};

type PromptVariableMenuState = {
  targetField: "systemPrompt" | "userPrompt";
  start: number;
  end: number;
  query: string;
  activeIndex: number;
  options: PromptVariableHint[];
};

type OrchestrationNodeData = {
  nodeType: CanvasNodeType;
  operatorCode: string;
  nodeName: string;
  subtitle?: string;
  nodeConfig?: Record<string, unknown>;
  label?: ReactNode;
};

type OrchestrationCanvasEdgeData = {
  sourcePort?: string | null;
  targetPort?: string | null;
  edgeStatus?: OrchestrationEdgeStatus;
};

type OrchestrationScheduleType = "manual" | "interval" | "daily" | "weekly" | "monthly" | "custom";

type OrchestrationScheduleFormValues = {
  scheduleType?: OrchestrationScheduleType;
  intervalMinutes?: number;
  runTime?: string;
  weekDays?: number[];
  monthDay?: number;
  cronExpr?: string;
  isPaused?: boolean;
  retryTimes?: number;
  timeoutSec?: number;
};

const ORCHESTRATION_NODE_WIDTH = 182;
const ORCHESTRATION_NODE_MIN_HEIGHT = 68;
const ORCHESTRATION_BRANCH_NODE_MIN_HEIGHT = 80;
const ORCHESTRATION_DRAWER_DEFAULT_WIDTH = 760;
const ORCHESTRATION_DRAWER_MIN_WIDTH = 520;
const ORCHESTRATION_DRAWER_MAX_WIDTH = 1320;
const ORCHESTRATION_PAN_ON_DRAG: [number] = [0];
const ORCHESTRATION_CONNECTION_LINE_STYLE = { stroke: "#9ab3ff", strokeWidth: 2.5 };
const ORCHESTRATION_LAYOUT_HORIZONTAL_GAP = 280;
const ORCHESTRATION_LAYOUT_VERTICAL_GAP = 124;
const ORCHESTRATION_LAYOUT_START_X = 72;
const ORCHESTRATION_LAYOUT_START_Y = 72;
const ORCHESTRATION_LAYOUT_WRAP_LIMIT = 7;

const CONDITION_OPERATOR_OPTIONS = [
  { value: "eq", label: "等于" },
  { value: "ne", label: "不等于" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
  { value: "contains", label: "包含" },
  { value: "starts_with", label: "开始于" },
  { value: "ends_with", label: "结束于" },
  { value: "in", label: "属于（IN）" },
  { value: "not_in", label: "不属于（NOT IN）" },
  { value: "is_null", label: "为空" },
  { value: "is_not_null", label: "不为空" },
];

const CONDITION_LOGIC_OPTIONS = [
  { value: "all", label: "满足全部条件" },
  { value: "any", label: "满足任一条件" },
];

const CONDITION_OPERATORS_WITHOUT_VALUE = new Set(["is_null", "is_not_null"]);
const CONDITION_SET_OPERATORS = new Set(["in", "not_in"]);
const FILTER_VALUE_SOURCE_OPTIONS = [
  { value: "literal", label: "固定值列表" },
  { value: "upstream_field", label: "上游字段结果" },
  { value: "custom_sql", label: "自定义 SQL" },
];
const FILTER_RULE_TYPE_OPTIONS = [
  { value: "condition", label: "条件过滤" },
  { value: "builtin", label: "规则过滤" },
  { value: "domain", label: "值域过滤" },
];
const FILTER_MATCH_MODE_OPTIONS = [
  { value: "valid", label: "保留命中记录" },
  { value: "invalid", label: "保留未命中记录" },
];
const DOMAIN_MATCH_MODE_OPTIONS = [
  { value: "in", label: "保留值域内数据" },
  { value: "not_in", label: "排除值域内数据" },
];

const WEEK_DAY_OPTIONS = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 0, label: "周日" },
];

function SqlCodeBlock({ value }: { value: string }) {
  return (
    <div className="orchestration-sql-editor">
      <pre className="orchestration-sql-code">{value}</pre>
    </div>
  );
}

type FieldOptionTone = "string" | "number" | "time" | "boolean" | "object" | "array" | "other";

type FieldSelectOption = {
  value: string;
  label: string;
  searchText: string;
  sourceNodeName?: string;
  fieldName?: string;
  fullType?: string;
  typeCode?: string;
  tone?: FieldOptionTone;
  comment?: string;
  primaryKey?: boolean;
  nullable?: boolean;
  isSynthetic?: boolean;
};

function getFieldTypeMeta(column?: Partial<DevColumnEntry>) {
  const fullType = trimText(column?.columnType || column?.dataType) || "unknown";
  const normalized = fullType.toLowerCase();

  if (/(bool|bit)/.test(normalized)) {
    return { fullType, typeCode: "BOOL", tone: "boolean" as FieldOptionTone };
  }
  if (/(date|time|timestamp)/.test(normalized)) {
    return { fullType, typeCode: "DT", tone: "time" as FieldOptionTone };
  }
  if (/(int|decimal|numeric|number|float|double|real|serial|money)/.test(normalized)) {
    return { fullType, typeCode: "NUM", tone: "number" as FieldOptionTone };
  }
  if (/(json|object|struct|map|record)/.test(normalized)) {
    return { fullType, typeCode: "OBJ", tone: "object" as FieldOptionTone };
  }
  if (/(array|list|set)/.test(normalized)) {
    return { fullType, typeCode: "ARR", tone: "array" as FieldOptionTone };
  }
  if (/(char|text|string|uuid|enum)/.test(normalized)) {
    return { fullType, typeCode: "STR", tone: "string" as FieldOptionTone };
  }

  return {
    fullType,
    typeCode: fullType.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "COL",
    tone: "other" as FieldOptionTone,
  };
}

function buildFieldSelectOption(column: DevColumnEntry): FieldSelectOption {
  const typeMeta = getFieldTypeMeta(column);
  return {
    value: column.name,
    label: column.name,
    searchText: [column.name, typeMeta.fullType, column.comment].filter(Boolean).join(" "),
    fieldName: column.name,
    fullType: typeMeta.fullType,
    typeCode: typeMeta.typeCode,
    tone: typeMeta.tone,
    comment: trimText(column.comment),
    primaryKey: Boolean(column.primaryKey),
    nullable: column.nullable,
  };
}

function buildFieldSelectOptions(columns: DevColumnEntry[]) {
  return columns.map((column) => buildFieldSelectOption(column));
}

function buildSyntheticFieldOption(value: string, label: string): FieldSelectOption {
  return {
    value,
    label,
    searchText: label,
    isSynthetic: true,
  };
}

function FieldOptionCard({ option, dense = false }: { option: FieldSelectOption; dense?: boolean }) {
  if (option.isSynthetic || !option.fieldName) {
    return (
      <div className={`orchestration-field-option${dense ? " is-dense" : ""} is-plain`}>
        <span className="orchestration-field-option__name">{option.label}</span>
      </div>
    );
  }

  return (
    <div className={`orchestration-field-option${dense ? " is-dense" : ""}`}>
      <div className="orchestration-field-option__main">
        <span
          className={`orchestration-field-option__type orchestration-field-option__type--${option.tone || "other"}`}
          title={option.fullType}
        >
          {option.typeCode}
        </span>
        <div className="orchestration-field-option__content">
          <span className="orchestration-field-option__name" title={option.label}>
            {option.sourceNodeName ? `${option.sourceNodeName} / ` : ""}{option.fieldName}
          </span>
          {option.comment ? <span className="orchestration-field-option__comment" title={option.comment}>{option.comment}</span> : null}
        </div>
      </div>
      {option.primaryKey || option.nullable === false ? (
        <div className="orchestration-field-option__flags">
          {option.primaryKey ? <span className="orchestration-field-option__flag">PK</span> : null}
          {option.nullable === false ? <span className="orchestration-field-option__flag">NN</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function renderFieldSelectOption(option: any) {
  const data = option?.data as FieldSelectOption | undefined;
  if (!data) {
    return <span>{option?.label}</span>;
  }
  return <FieldOptionCard option={data} dense />;
}

function Select(props: any) {
  const options = Array.isArray(props.options) ? props.options : [];
  const isFieldOptions = options.some((item: FieldSelectOption) => item && typeof item === "object" && "searchText" in item && ("fieldName" in item || "isSynthetic" in item));

  return (
    <AntSelect
      {...props}
      optionFilterProp={isFieldOptions && props.showSearch !== false ? "searchText" : props.optionFilterProp}
      optionRender={isFieldOptions ? renderFieldSelectOption : props.optionRender}
    />
  );
}

function ColumnChecklist({
  columns,
  value,
  onChange,
  emptyText,
}: {
  columns: DevColumnEntry[];
  value?: string[];
  onChange?: (nextValue: string[]) => void;
  emptyText: string;
}) {
  const selectedValues = value || [];
  const selectedSet = new Set(selectedValues);
  const allChecked = columns.length > 0 && selectedValues.length === columns.length;
  const indeterminate = selectedValues.length > 0 && selectedValues.length < columns.length;

  return (
    <div className="orchestration-column-checklist">
      <div className="orchestration-column-checklist__toolbar">
        <Checkbox
          indeterminate={indeterminate}
          checked={allChecked}
          onChange={(event) => onChange?.(event.target.checked ? columns.map((column) => column.name) : [])}
        >
          全选
        </Checkbox>
        <Typography.Text type="secondary">{`${selectedValues.length}/${columns.length} 列`}</Typography.Text>
      </div>
      {columns.length ? (
        <div className="orchestration-column-checklist__list">
          {columns.map((column) => (
            <label key={column.name} className={`orchestration-column-checklist__item${selectedSet.has(column.name) ? " is-active" : ""}`}>
              <Checkbox
                checked={selectedSet.has(column.name)}
                onChange={(event) => {
                  const nextValues = event.target.checked
                    ? selectedValues.concat(column.name)
                    : selectedValues.filter((item) => item !== column.name);
                  onChange?.(nextValues);
                }}
              />
              <FieldOptionCard option={buildFieldSelectOption(column)} />
            </label>
          ))}
        </div>
      ) : (
        <div className="orchestration-config-empty">{emptyText}</div>
      )}
    </div>
  );
}

const OPERATOR_LIBRARY: OperatorTemplate[] = [
  { operatorCode: "filter", nodeType: "operator", label: "数据过滤", description: "按条件筛选记录。", color: "#1677ff" },
  { operatorCode: "deduplicate", nodeType: "operator", label: "数据去重", description: "按业务键去重。", color: "#13a8a8" },
  { operatorCode: "union", nodeType: "operator", label: "并集", description: "合并多路数据。", color: "#722ed1" },
  { operatorCode: "join", nodeType: "operator", label: "关联", description: "按关联键拼接两路数据。", color: "#d46b08" },
  { operatorCode: "replace", nodeType: "operator", label: "字段值替换", description: "替换字段值。", color: "#eb2f96" },
  { operatorCode: "format_convert", nodeType: "operator", label: "格式转换", description: "常见类型与日期格式转换。", color: "#0f766e" },
  { operatorCode: "compliance_check", nodeType: "operator", label: "数据校验", description: "格式、值域与固定值校验。", color: "#ca8a04" },
  { operatorCode: "string_transform", nodeType: "operator", label: "字符处理", description: "去空格、截取、大小写等。", color: "#7c3aed" },
  { operatorCode: "string_aggregate", nodeType: "operator", label: "字符串聚合", description: "按分组将多行值拼接成字符串。", color: "#9333ea" },
  { operatorCode: "string_split", nodeType: "operator", label: "字符串拆分", description: "按分隔符拆成多行明细。", color: "#a855f7" },
  { operatorCode: "window_compute", nodeType: "operator", label: "窗口计算", description: "封装常见窗口函数。", color: "#c2410c" },
  { operatorCode: "custom_sql", nodeType: "operator", label: "自定义 SQL", description: "编写节点 SQL。", color: "#2f54eb" },
  { operatorCode: "output_table", nodeType: "output", label: "数据输出", description: "写入目标表。", color: "#389e0d" },
];

const OPERATOR_CATEGORIES: OperatorCategory[] = [
  { key: "prepare", label: "数据准备", description: "过滤、去重、排序、限制" },
  { key: "field", label: "字段处理", description: "选择、重命名、替换、转换与校验" },
  { key: "set", label: "集合处理", description: "并集、关联、行列互转等多路处理" },
  { key: "logic", label: "逻辑控制", description: "条件分支和多路流转控制" },
  { key: "aggregate", label: "聚合计算", description: "分组汇总、窗口函数与指标计算" },
  { key: "output", label: "输出控制", description: "自定义 SQL 与结果落表" },
];

const OPERATOR_LIBRARY_ITEMS: OperatorTemplate[] = [
  { category: "prepare", operatorCode: "filter", nodeType: "operator", badge: "筛", label: "数据过滤", description: "按条件筛选上游记录", color: "#1677ff" },
  { category: "prepare", operatorCode: "deduplicate", nodeType: "operator", badge: "重", label: "数据去重", description: "按业务键保留唯一记录", color: "#13a8a8" },
  { category: "prepare", operatorCode: "sort", nodeType: "operator", badge: "序", label: "排序", description: "按字段升降序排序", color: "#1d39c4" },
  { category: "prepare", operatorCode: "limit_rows", nodeType: "operator", badge: "限", label: "限制行数", description: "截取前 N 条结果", color: "#0958d9" },
  { category: "field", operatorCode: "select_columns", nodeType: "operator", badge: "列", label: "字段选择", description: "保留需要的字段列", color: "#7c3aed" },
  { category: "field", operatorCode: "rename_fields", nodeType: "operator", badge: "名", label: "字段重命名", description: "批量修改输出字段名", color: "#8b5cf6" },
  { category: "field", operatorCode: "replace", nodeType: "operator", badge: "替", label: "字段值替换", description: "替换指定字段值", color: "#eb2f96" },
  { category: "field", operatorCode: "format_convert", nodeType: "operator", badge: "转", label: "格式转换", description: "日期、数字、字符串互转", color: "#0f766e" },
  { category: "field", operatorCode: "compliance_check", nodeType: "operator", badge: "检", label: "数据校验", description: "格式、值域、固定值校验", color: "#ca8a04" },
  { category: "field", operatorCode: "string_transform", nodeType: "operator", badge: "字", label: "字符处理", description: "去空格、截取、大小写转换", color: "#7c3aed" },
  { category: "field", operatorCode: "desensitize", nodeType: "operator", badge: "脱", label: "数据脱敏", description: "掩码、哈希、截断、随机化处理", color: "#c026d3" },
  { category: "set", operatorCode: "union", nodeType: "operator", badge: "并", label: "并集", description: "合并多路同类数据", color: "#722ed1" },
  { category: "set", operatorCode: "join", nodeType: "operator", badge: "联", label: "关联", description: "按关联键拼接左右数据源", color: "#d46b08" },
  { category: "set", operatorCode: "string_aggregate", nodeType: "operator", badge: "聚", label: "字符串聚合", description: "按分组拼接多行文本", color: "#9333ea" },
  { category: "set", operatorCode: "string_split", nodeType: "operator", badge: "拆", label: "字符串拆分", description: "按分隔符拆成多行明细", color: "#a855f7" },
  { category: "logic", operatorCode: "branch", nodeType: "operator", badge: "支", label: "分支判断", description: "根据条件将数据分发到不同路径", color: "#2563eb" },
  { category: "aggregate", operatorCode: "aggregate", nodeType: "operator", badge: "聚", label: "聚合统计", description: "分组汇总指标结果", color: "#c2410c" },
  { category: "aggregate", operatorCode: "window_compute", nodeType: "operator", badge: "窗", label: "窗口计算", description: "封装 row_number、rank、lag 等", color: "#c2410c" },
  { category: "output", operatorCode: "custom_sql", nodeType: "operator", badge: "SQL", label: "自定义 SQL", description: "编写节点 SQL 逻辑", color: "#2f54eb" },
  { category: "output", operatorCode: "output_table", nodeType: "output", badge: "出", label: "数据输出", description: "写入目标结果表", color: "#389e0d" },
];

const ORCHESTRATION_OPERATOR_CATEGORIES: OperatorCategory[] = OPERATOR_CATEGORIES.concat([
  { key: "ai", label: "AI 算子", description: "提示词变量、结果解析与模型生成" },
]);

const ORCHESTRATION_OPERATOR_LIBRARY_ITEMS: OperatorTemplate[] = OPERATOR_LIBRARY_ITEMS.concat([
  {
    category: "ai",
    operatorCode: "llm_row",
    nodeType: "operator",
    badge: "单",
    label: "AI单条处理",
    description: "多条输入，逐条提取多个结构化字段",
    color: "#0f766e",
  },
  {
    category: "ai",
    operatorCode: "llm_batch",
    nodeType: "operator",
    badge: "批",
    label: "AI批处理",
    description: "多条输入，汇总生成一条数据分析结果",
    color: "#0f766e",
  },
]);

const OPERATOR_META = new Map(ORCHESTRATION_OPERATOR_LIBRARY_ITEMS.map((item) => [item.operatorCode, item]));
const KEEP_STRATEGY_OPTIONS = [
  { value: "first", label: "保留首条" },
  { value: "last", label: "保留末条" },
  { value: "custom", label: "按排序字段" },
];
const ALIGN_MODE_OPTIONS = [
  { value: "by_name", label: "按字段名对齐" },
  { value: "by_position", label: "按字段顺序对齐" },
];
const WRITE_MODE_OPTIONS = [
  { value: "overwrite", label: "覆盖写入" },
  { value: "append", label: "追加写入" },
  { value: "upsert", label: "主键更新" },
];

const SORT_DIRECTION_OPTIONS = [
  { value: "ASC", label: "升序" },
  { value: "DESC", label: "降序" },
];
const AGGREGATE_FUNCTION_OPTIONS = [
  { value: "count", label: "COUNT" },
  { value: "count_distinct", label: "COUNT DISTINCT" },
  { value: "sum", label: "SUM" },
  { value: "avg", label: "AVG" },
  { value: "max", label: "MAX" },
  { value: "min", label: "MIN" },
];

const UNION_MODE_OPTIONS = [
  { value: "all", label: "保留重复值（UNION ALL）" },
  { value: "distinct", label: "自动去重（UNION）" },
];

const JOIN_TYPE_OPTIONS = [
  { value: "left", label: "左连接" },
  { value: "right", label: "右连接" },
  { value: "inner", label: "内连接" },
  { value: "full", label: "外连接" },
  { value: "cross", label: "笛卡尔积" },
];

const VARIABLE_SOURCE_MODE_OPTIONS = [
  { value: "single_field", label: "单字段" },
  { value: "selected_fields", label: "指定字段组合" },
  { value: "all_fields", label: "全部字段" },
];

const FORMAT_CONVERT_OPTIONS = [
  { value: "date_to_string", label: "日期转字符串" },
  { value: "datetime_to_string", label: "日期时间转字符串" },
  { value: "string_to_number", label: "字符串转数字" },
  { value: "number_to_string", label: "数字转字符串" },
  { value: "string_to_date", label: "字符串转日期" },
  { value: "string_to_datetime", label: "字符串转日期时间" },
  { value: "datetime_to_date", label: "日期时间转日期" },
];

const FORMAT_TARGET_TYPE_OPTIONS = [
  { value: "integer", label: "整数" },
  { value: "decimal", label: "小数" },
  { value: "double", label: "浮点" },
];

const COMPLIANCE_CHECK_OPTIONS = [
  { value: "id_card", label: "身份证" },
  { value: "phone", label: "手机号" },
  { value: "email", label: "邮箱" },
  { value: "credit_code", label: "统一社会信用代码" },
  { value: "url", label: "URL" },
  { value: "ipv4", label: "IPv4" },
  { value: "postal_code", label: "邮编" },
];

const VALIDATION_RULE_TYPE_OPTIONS = [
  { value: "builtin", label: "内置规则" },
  { value: "domain", label: "值域校验" },
  { value: "regex", label: "自定义正则" },
  { value: "fixed_value", label: "固定值校验" },
];

const VALIDATION_RESULT_MODE_OPTIONS = [
  { value: "flag", label: "输出校验标记" },
  { value: "value", label: "输出校验后字段" },
];

const STRING_TRANSFORM_OPTIONS = [
  { value: "trim", label: "去首尾空格" },
  { value: "remove_prefix", label: "去前几位" },
  { value: "remove_suffix", label: "去后几位" },
  { value: "substring", label: "截取子串" },
  { value: "replace_text", label: "字符替换" },
  { value: "upper", label: "转大写" },
  { value: "lower", label: "转小写" },
];

const DESENSITIZE_TYPE_OPTIONS = [
  { value: "mask", label: "掩码脱敏" },
  { value: "hash", label: "哈希脱敏" },
  { value: "truncate", label: "截断处理" },
  { value: "randomize", label: "随机化" },
];

const WINDOW_FUNCTION_OPTIONS = [
  { value: "row_number", label: "ROW_NUMBER" },
  { value: "rank", label: "RANK" },
  { value: "dense_rank", label: "DENSE_RANK" },
  { value: "sum", label: "SUM OVER" },
  { value: "avg", label: "AVG OVER" },
  { value: "lag", label: "LAG" },
  { value: "lead", label: "LEAD" },
];

const SOURCE_TIME_FORMAT_OPTIONS: Array<{ value: SourceRangeFormatType; label: string; placeholder: string }> = [
  { value: "date", label: "yyyy-MM-dd", placeholder: "例如：2026-04-17" },
  { value: "datetime", label: "yyyy-MM-dd HH:mm:ss", placeholder: "例如：2026-04-17 09:30:00" },
  { value: "compact_date", label: "yyyyMMdd", placeholder: "例如：20260417" },
  { value: "compact_datetime", label: "yyyyMMddHHmmss", placeholder: "例如：20260417093000" },
  { value: "month", label: "yyyyMM", placeholder: "例如：202604" },
  { value: "epoch_seconds", label: "Unix 秒", placeholder: "例如：1713317400" },
  { value: "epoch_millis", label: "Unix 毫秒", placeholder: "例如：1713317400000" },
];

const SOURCE_TIME_BOUND_MODE_OPTIONS: Array<{ value: SourceTimeBoundMode; label: string }> = [
  { value: "literal", label: "固定值" },
  { value: "system", label: "系统时间" },
];

const SOURCE_TIME_SYSTEM_VARIABLE_OPTIONS: Array<{ value: SourceSystemTimeVariable; label: string }> = [
  { value: "current_date", label: "当前日期" },
  { value: "current_datetime", label: "当前时间" },
];

const SOURCE_TIME_OFFSET_UNIT_OPTIONS: Array<{ value: SourceTimeOffsetUnit; label: string }> = [
  { value: "second", label: "秒" },
  { value: "minute", label: "分钟" },
  { value: "hour", label: "小时" },
  { value: "day", label: "天" },
  { value: "month", label: "月" },
  { value: "year", label: "年" },
];

function trimText(value: unknown) {
  return String(value || "").trim();
}

function readRawText(value: unknown) {
  return typeof value === "string" ? value : String(value || "");
}

function truncateText(value: unknown, maxLength = 40) {
  const text = trimText(value);
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseObjectArray<T extends Record<string, unknown>>(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is T => Boolean(item) && typeof item === "object");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is T => Boolean(item) && typeof item === "object") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeRenameMappings(value: unknown) {
  return parseObjectArray<RenameMapping>(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
    }));
}

function parseRenameMappings(value: unknown) {
  return normalizeRenameMappings(value)
    .filter((item) => item.sourceField || item.targetField);
}

function normalizeReplaceRules(value: unknown) {
  return parseObjectArray<ReplaceRule>(value)
    .map((item) => ({
      matchValue: readRawText(item.matchValue),
      replaceValue: readRawText(item.replaceValue),
    }));
}

function parseReplaceRules(value: unknown) {
  return normalizeReplaceRules(value)
    .filter((item) => item.matchValue || item.replaceValue);
}

function parseSortRules(value: unknown) {
  return parseObjectArray<SortFieldRule>(value)
    .map((item) => ({
      fieldName: trimText(item.fieldName),
      direction: trimText(item.direction).toUpperCase() || "ASC",
    }))
    .filter((item) => item.fieldName || item.direction);
}

function parseConditionRules(value: unknown) {
  return parseObjectArray<ConditionRule>(value)
    .map((item) => {
      const referenceFieldRef = trimText(item.referenceFieldRef);
      const separatorIndex = referenceFieldRef.indexOf("::");
      const referenceNodeKey = separatorIndex > 0
        ? referenceFieldRef.slice(0, separatorIndex)
        : trimText(item.referenceNodeKey);
      const referenceField = separatorIndex > 0
        ? referenceFieldRef.slice(separatorIndex + 2)
        : trimText(item.referenceField);
      return {
        ruleType: trimText(item.ruleType)
          || (trimText(item.checkType) ? "builtin" : readRawText(item.domainValues) ? "domain" : "condition"),
        fieldName: trimText(item.fieldName),
        operator: trimText(item.operator) || "eq",
        value: trimText(item.value),
        valueSource: trimText(item.valueSource)
          || (referenceField ? "upstream_field" : readRawText(item.customSql) ? "custom_sql" : "literal"),
        referenceFieldRef: referenceNodeKey && referenceField ? `${referenceNodeKey}::${referenceField}` : "",
        referenceNodeKey,
        referenceNodeName: trimText(item.referenceNodeName),
        referenceField,
        customSql: readRawText(item.customSql),
        checkType: trimText(item.checkType) || "phone",
        matchMode: trimText(item.matchMode) || "valid",
        domainValues: readRawText(item.domainValues),
      };
    })
    .filter((item) => item.fieldName || item.operator || item.value || item.referenceField || item.customSql || item.checkType || item.domainValues);
}

function parseSqlInputBindings(value: unknown) {
  return parseObjectArray<SqlInputBinding>(value)
    .map((item) => ({
      sourceNodeKey: trimText(item.sourceNodeKey),
      alias: trimText(item.alias),
    }))
    .filter((item) => item.sourceNodeKey || item.alias);
}

function parseAggregationRules(value: unknown) {
  return parseObjectArray<AggregationRule>(value)
    .map((item) => ({
      aggregateFunction: trimText(item.aggregateFunction) || "count",
      fieldName: trimText(item.fieldName),
      alias: trimText(item.alias),
    }))
    .filter((item) => item.aggregateFunction || item.fieldName || item.alias);
}

function normalizePromptVariableFormRows(value: unknown) {
  return parseObjectArray<PromptVariableMapping>(value)
    .map((item) => {
      const sourceFields = parseStringArray(item.sourceFields);
      const sourceField = trimText(item.sourceField) || sourceFields[0] || "";
      return {
        variableName: trimText(item.variableName),
        sourceMode: trimText(item.sourceMode) || (sourceFields.length > 1 ? "selected_fields" : sourceField ? "single_field" : "all_fields"),
        sourceField,
        sourceFields: sourceFields.length ? sourceFields : (sourceField ? [sourceField] : []),
        defaultValue: readRawText(item.defaultValue),
      };
    });
}

function parsePromptVariableMappings(value: unknown) {
  return normalizePromptVariableFormRows(value)
    .filter((item) => item.variableName || item.sourceField || item.sourceFields.length || item.defaultValue);
}

function normalizeJoinKeyRules(value: unknown) {
  return parseObjectArray<JoinKeyRule>(value)
    .map((item) => ({
      leftField: trimText(item.leftField),
      rightField: trimText(item.rightField),
    }));
}

function parseJoinKeyRules(value: unknown) {
  return normalizeJoinKeyRules(value)
    .filter((item) => item.leftField || item.rightField);
}

function normalizeFormatConvertRules(value: unknown) {
  return parseObjectArray<FormatConvertRule>(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
      transformType: trimText(item.transformType) || "date_to_string",
      formatPattern: readRawText(item.formatPattern),
      targetType: trimText(item.targetType) || "decimal",
    }));
}

function parseFormatConvertRules(value: unknown) {
  return normalizeFormatConvertRules(value)
    .filter((item) => item.sourceField || item.targetField);
}

function normalizeComplianceRules(value: unknown) {
  return parseObjectArray<ComplianceRule>(value)
    .map((item) => ({
      validationType: trimText(item.validationType)
        || (readRawText(item.customPattern) ? "regex" : readRawText(item.fixedValue) ? "fixed_value" : readRawText(item.domainValues) ? "domain" : "builtin"),
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
      checkType: trimText(item.checkType) || "phone",
      customPattern: readRawText(item.customPattern),
      fixedValue: readRawText(item.fixedValue),
      domainValues: readRawText(item.domainValues),
      resultMode: trimText(item.resultMode) || "flag",
      defaultValue: readRawText(item.defaultValue),
    }));
}

function parseComplianceRules(value: unknown) {
  return normalizeComplianceRules(value)
    .filter((item) => item.sourceField || item.targetField || item.customPattern || item.fixedValue || item.domainValues);
}

function normalizeStringProcessRules(value: unknown) {
  return parseObjectArray<StringProcessRule>(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
      transformType: trimText(item.transformType) || "trim",
      argument1: readRawText(item.argument1),
      argument2: readRawText(item.argument2),
    }));
}

function parseStringProcessRules(value: unknown) {
  return normalizeStringProcessRules(value)
    .filter((item) => item.sourceField || item.targetField);
}

function normalizeDesensitizeRules(value: unknown) {
  return parseObjectArray<DesensitizeRule>(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
      maskType: trimText(item.maskType) || "mask",
      maskChar: trimText(item.maskChar) || "*",
      prefixLength: Number(item.prefixLength ?? 3),
      suffixLength: Number(item.suffixLength ?? 4),
      truncateLength: Number(item.truncateLength ?? 8),
    }));
}

function parseDesensitizeRules(value: unknown) {
  return normalizeDesensitizeRules(value)
    .filter((item) => item.sourceField || item.targetField);
}

function parseBooleanFlag(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = trimText(value).toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseStringAggregateRules(value: unknown) {
  return parseObjectArray<StringAggregateRule>(value)
    .map((item) => {
      const rawSeparator = readRawText(item.separator);
      return {
        sourceField: trimText(item.sourceField),
        outputField: trimText(item.outputField),
        separator: rawSeparator || ",",
        distinct: parseBooleanFlag(item.distinct, false),
        _rawSeparator: rawSeparator,
      };
    })
    .filter((item) => item.sourceField || item.outputField || item._rawSeparator || item.distinct)
    .map(({ _rawSeparator, ...item }) => item);
}

function parseSourceTimeFilter(value: unknown): SourceTimeFilterConfig {
  if (!value || typeof value !== "object") {
    return {
      fieldName: "",
      formatType: "date",
      startValue: "",
      endValue: "",
    };
  }
  const filter = value as SourceTimeFilterConfig;
  return {
    fieldName: trimText(filter.fieldName),
    formatType: (trimText(filter.formatType) || "date") as SourceRangeFormatType,
    startValue: readRawText(filter.startValue),
    endValue: readRawText(filter.endValue),
  };
}

function parseOutputFieldMappings(value: unknown) {
  return parseObjectArray<OutputFieldMapping>(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
    }))
    .filter((item) => item.sourceField || item.targetField);
}

function normalizeColumnAlignmentRows(value: unknown) {
  return parseObjectArray<ColumnAlignmentRow>(value)
    .map((row) => ({
      outputField: trimText(row.outputField),
      bindings: parseObjectArray<ColumnAlignmentBinding>(row.bindings).map((binding) => ({
        sourceNodeKey: trimText(binding.sourceNodeKey),
        fieldName: trimText(binding.fieldName),
      })),
    }));
}

function parseColumnAlignmentRows(value: unknown) {
  return normalizeColumnAlignmentRows(value)
    .filter((row) => row.outputField || row.bindings.some((binding) => binding.sourceNodeKey || binding.fieldName));
}

function createVirtualColumn(name: string, index: number, fallback?: Partial<DevColumnEntry>): DevColumnEntry {
  return {
    name,
    position: fallback?.position ?? index + 1,
    dataType: fallback?.dataType || "string",
    columnType: fallback?.columnType || fallback?.dataType || "string",
    nullable: fallback?.nullable ?? true,
    primaryKey: fallback?.primaryKey ?? false,
    defaultValue: fallback?.defaultValue,
    comment: fallback?.comment,
  };
}

function getColumnMap(columns: DevColumnEntry[]) {
  return new Map(columns.map((item) => [item.name, item]));
}

function buildSourceTimeFormatPlaceholder(formatType?: SourceRangeFormatType) {
  return SOURCE_TIME_FORMAT_OPTIONS.find((item) => item.value === formatType)?.placeholder || SOURCE_TIME_FORMAT_OPTIONS[0].placeholder;
}

function mergeSchemaWithDerivedFields(
  primaryInput: DevColumnEntry[],
  derivedFields: Array<{ sourceField?: string; targetField?: string }>
) {
  const output = primaryInput.map((column, index) => createVirtualColumn(column.name, index, column));
  const outputIndexMap = new Map(output.map((column, index) => [column.name, index]));
  const inputMap = getColumnMap(primaryInput);

  derivedFields.forEach((rule, index) => {
    const targetField = trimText(rule.targetField || rule.sourceField);
    if (!targetField) {
      return;
    }
    const fallback = inputMap.get(trimText(rule.sourceField));
    const nextColumn = createVirtualColumn(targetField, output.length + index, fallback ? { ...fallback, name: targetField } : undefined);
    if (outputIndexMap.has(targetField)) {
      output[outputIndexMap.get(targetField)!] = nextColumn;
      return;
    }
    outputIndexMap.set(targetField, output.length);
    output.push(nextColumn);
  });

  return output;
}

function buildJoinSchemaColumns(
  leftColumns: DevColumnEntry[],
  rightColumns: DevColumnEntry[],
  leftOutputFields: string[],
  rightOutputFields: string[]
) {
  const normalizedLeftFields = leftOutputFields.length ? leftOutputFields : leftColumns.map((column) => column.name);
  const normalizedRightFields = rightOutputFields.length ? rightOutputFields : rightColumns.map((column) => column.name);
  const leftMap = getColumnMap(leftColumns);
  const rightMap = getColumnMap(rightColumns);
  const output: DevColumnEntry[] = [];
  const seen = new Set<string>();

  normalizedLeftFields.forEach((fieldName, index) => {
    const targetField = trimText(fieldName);
    if (!targetField) return;
    seen.add(targetField);
    output.push(createVirtualColumn(targetField, index, leftMap.get(fieldName)));
  });

  normalizedRightFields.forEach((fieldName, index) => {
    const baseField = trimText(fieldName);
    if (!baseField) return;
    const targetField = seen.has(baseField) ? `right_${baseField}` : baseField;
    seen.add(targetField);
    output.push(createVirtualColumn(targetField, output.length + index, rightMap.get(fieldName) ? { ...rightMap.get(fieldName), name: targetField } : undefined));
  });

  return output;
}

function buildDefaultOutputFieldMappings(sourceColumns: DevColumnEntry[], targetColumns: DevColumnEntry[] = []) {
  if (targetColumns.length) {
    const targetFieldSet = new Set(targetColumns.map((column) => trimText(column.name)).filter(Boolean));
    return sourceColumns.map((column) => ({
      sourceField: column.name,
      targetField: targetFieldSet.has(column.name) ? column.name : "",
    }));
  }

  return sourceColumns.map((column) => ({
    sourceField: column.name,
    targetField: column.name,
  }));
}

function mergeOutputFieldMappings(
  mappings: OutputFieldMapping[],
  sourceColumns: DevColumnEntry[],
  targetColumns: DevColumnEntry[] = []
) {
  const normalizedMappings = mappings.map((item) => ({
    sourceField: trimText(item.sourceField),
    targetField: trimText(item.targetField),
  }));

  if (targetColumns.length) {
    const sourceFields = sourceColumns.map((column) => trimText(column.name)).filter(Boolean);
    const targetFieldSet = new Set(targetColumns.map((column) => trimText(column.name)).filter(Boolean));
    const existingBySource = new Map(
      normalizedMappings
        .filter((item) => item.sourceField)
        .map((item) => [item.sourceField, item.targetField])
    );
    const usedTargets = new Set<string>();

    return sourceFields.map((sourceField) => {
      const existingTargetField = trimText(existingBySource.get(sourceField));
      if (existingTargetField && targetFieldSet.has(existingTargetField) && !usedTargets.has(existingTargetField)) {
        usedTargets.add(existingTargetField);
        return { sourceField, targetField: existingTargetField };
      }
      if (targetFieldSet.has(sourceField) && !usedTargets.has(sourceField)) {
        usedTargets.add(sourceField);
        return { sourceField, targetField: sourceField };
      }
      return { sourceField, targetField: "" };
    });
  }

  if (normalizedMappings.length) {
    return normalizedMappings;
  }
  return buildDefaultOutputFieldMappings(sourceColumns, targetColumns);
}

function getPromptVariableRuleSourceMode(rule: PromptVariableMapping) {
  const sourceFields = parseStringArray(rule.sourceFields);
  if (sourceFields.length > 1) {
    return "selected_fields";
  }
  return trimText(rule.sourceMode) || (trimText(rule.sourceField) ? "single_field" : "all_fields");
}

function buildPromptVariableRuleSummary(rule: PromptVariableMapping, operatorCode: string) {
  const sourceMode = getPromptVariableRuleSourceMode(rule);
  const sourceFields = parseStringArray(rule.sourceFields);
  if (sourceMode === "single_field") {
    return trimText(rule.sourceField) ? `单字段 / ${trimText(rule.sourceField)}` : "单字段";
  }
  if (sourceMode === "selected_fields") {
    return sourceFields.length ? `字段范围 / ${sourceFields.length} 个字段` : "字段范围";
  }
  return normalizeAiOperatorCode(operatorCode) === "llm_batch" ? "整批记录对象" : "当前记录对象";
}

function resolvePromptTokenCompletion(text: string, cursorPosition: number, variableNames: string[]) {
  const prefix = String(text || "").slice(0, Math.max(0, cursorPosition));
  const openIndex = prefix.lastIndexOf("{{");
  const closeIndex = prefix.lastIndexOf("}}");
  if (openIndex < 0 || closeIndex > openIndex) {
    return null;
  }

  const rawQuery = prefix.slice(openIndex + 2).trim();
  if (!rawQuery || /[\s{}]/.test(rawQuery)) {
    return null;
  }

  const match = variableNames.find((item) => item.toLowerCase().startsWith(rawQuery.toLowerCase()) && item !== rawQuery);
  if (!match) {
    return null;
  }

  return {
    start: openIndex,
    end: cursorPosition,
    token: `{{${match}}}`,
  };
}

function resolvePromptVariableMenu(
  text: string,
  cursorPosition: number,
  targetField: "systemPrompt" | "userPrompt",
  hints: PromptVariableHint[]
): PromptVariableMenuState | null {
  if (!hints.length) {
    return null;
  }

  const safeCursorPosition = Math.max(0, cursorPosition);
  const prefix = String(text || "").slice(0, safeCursorPosition);
  const triggerMatch = prefix.match(/(?:^|[\s(（,，。:：;；])\/([A-Za-z0-9_\u4e00-\u9fa5-]*)$/);
  if (!triggerMatch) {
    return null;
  }

  const query = trimText(triggerMatch[1]);
  const slashOffset = triggerMatch[0].lastIndexOf("/");
  if (slashOffset < 0) {
    return null;
  }

  const start = prefix.length - triggerMatch[0].length + slashOffset;
  const options = hints.filter((item) => {
    if (!query) {
      return true;
    }
    const normalizedQuery = query.toLowerCase();
    return item.name.toLowerCase().includes(normalizedQuery) || item.summary.toLowerCase().includes(normalizedQuery);
  });
  if (!options.length) {
    return null;
  }

  return {
    targetField,
    start,
    end: safeCursorPosition,
    query,
    activeIndex: 0,
    options,
  };
}

function normalizeAiOperatorCode(operatorCode: string) {
  const normalized = trimText(operatorCode);
  return normalized === "llm" ? "llm_row" : normalized;
}

function getBuiltinValidationLabel(checkType: unknown) {
  return COMPLIANCE_CHECK_OPTIONS.find((item) => item.value === trimText(checkType))?.label || trimText(checkType) || "规则校验";
}

function escapeConditionValue(value: string) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function normalizeFilterSubqueryPreview(value: unknown) {
  let sqlText = readRawText(value).trim().replace(/;+\s*$/, "");
  const wrappedMatch = sqlText.match(/^(?:not\s+)?in\s*\(([\s\S]*)\)$/i);
  if (wrappedMatch) {
    sqlText = wrappedMatch[1].trim();
  } else if (/^\([\s\S]*\)$/.test(sqlText)) {
    const innerSql = sqlText.slice(1, -1).trim();
    if (/^(select|with)\b/i.test(innerSql)) {
      sqlText = innerSql;
    }
  }
  return sqlText;
}

function buildConditionSqlSegment(rule: ConditionRule) {
  const ruleType = trimText(rule.ruleType) || "condition";
  const fieldName = trimText(rule.fieldName);
  const operator = trimText(rule.operator) || "eq";
  const value = trimText(rule.value);
  if (!fieldName) return "";

  if (ruleType === "builtin") {
    const checkType = trimText(rule.checkType) || "phone";
    const patternMap: Record<string, string> = {
      id_card: "^(\\\\d{15}|\\\\d{17}[0-9Xx])$",
      phone: "^1[3-9][0-9]{9}$",
      email: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,}$",
      credit_code: "^[0-9A-Z]{18}$",
      url: "^(https?:\\\\/\\\\/).+",
      ipv4: "^(25[0-5]|2[0-4]\\\\d|1?\\\\d?\\\\d)(\\\\.(25[0-5]|2[0-4]\\\\d|1?\\\\d?\\\\d)){3}$",
      postal_code: "^\\\\d{6}$",
    };
    const pattern = patternMap[checkType] || patternMap.phone;
    const matchExpression = `REGEXP_LIKE(COALESCE(${fieldName}, ''), ${escapeConditionValue(pattern)})`;
    return trimText(rule.matchMode) === "invalid" ? `NOT (${matchExpression})` : matchExpression;
  }

  if (ruleType === "domain") {
    const values = parseStringArray(rule.domainValues);
    if (!values.length) return "";
    const expression = `${fieldName} IN (${values.map((item) => escapeConditionValue(item)).join(", ")})`;
    return trimText(rule.matchMode) === "not_in" ? `NOT (${expression})` : expression;
  }

  switch (operator) {
    case "eq":
      return `${fieldName} = ${escapeConditionValue(value)}`;
    case "ne":
      return `${fieldName} <> ${escapeConditionValue(value)}`;
    case "gt":
      return `${fieldName} > ${escapeConditionValue(value)}`;
    case "gte":
      return `${fieldName} >= ${escapeConditionValue(value)}`;
    case "lt":
      return `${fieldName} < ${escapeConditionValue(value)}`;
    case "lte":
      return `${fieldName} <= ${escapeConditionValue(value)}`;
    case "contains":
      return `${fieldName} LIKE ${escapeConditionValue(`%${value}%`)}`;
    case "starts_with":
      return `${fieldName} LIKE ${escapeConditionValue(`${value}%`)}`;
    case "ends_with":
      return `${fieldName} LIKE ${escapeConditionValue(`%${value}`)}`;
    case "in":
    case "not_in": {
      const valueSource = trimText(rule.valueSource) || "literal";
      const operatorSql = operator === "not_in" ? "NOT IN" : "IN";
      if (valueSource === "upstream_field") {
        const referenceField = trimText(rule.referenceField);
        const referenceNode = trimText(rule.referenceNodeName) || trimText(rule.referenceNodeKey) || "上游结果";
        return referenceField ? `${fieldName} ${operatorSql} (SELECT ${referenceField} FROM ${referenceNode})` : "";
      }
      if (valueSource === "custom_sql") {
        const customSql = normalizeFilterSubqueryPreview(rule.customSql);
        return customSql ? `${fieldName} ${operatorSql} (${customSql})` : "";
      }
      const values = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (!values.length) return "";
      return `${fieldName} ${operatorSql} (${values.map(escapeConditionValue).join(", ")})`;
    }
    case "is_null":
      return `${fieldName} IS NULL`;
    case "is_not_null":
      return `${fieldName} IS NOT NULL`;
    default:
      return `${fieldName} = ${escapeConditionValue(value)}`;
  }
}

function buildConditionExpression(rules: ConditionRule[], logic: unknown) {
  const ruleSqlList = rules
    .map((rule) => buildConditionSqlSegment(rule))
    .filter(Boolean);
  if (!ruleSqlList.length) return "";
  const connector = String(logic || "all") === "any" ? " OR " : " AND ";
  return ruleSqlList.length === 1 ? ruleSqlList[0] : `(${ruleSqlList.join(connector)})`;
}

function buildConditionSummary(rules: ConditionRule[], logic: unknown) {
  const operatorLabelMap = new Map(CONDITION_OPERATOR_OPTIONS.map((item) => [item.value, item.label]));
  const segments = rules
    .map((rule) => {
      const ruleType = trimText(rule.ruleType) || "condition";
      const fieldName = trimText(rule.fieldName);
      const operator = trimText(rule.operator) || "eq";
      const operatorLabel = operatorLabelMap.get(operator) || operator;
      if (!fieldName) return "";
      if (ruleType === "builtin") {
        return `${fieldName} ${trimText(rule.matchMode) === "invalid" ? "不符合" : "符合"} ${getBuiltinValidationLabel(rule.checkType)}`;
      }
      if (ruleType === "domain") {
        return `${fieldName} ${trimText(rule.matchMode) === "not_in" ? "排除" : "命中"}值域 ${trimText(rule.domainValues)}`;
      }
      if (CONDITION_OPERATORS_WITHOUT_VALUE.has(operator)) {
        return `${fieldName} ${operatorLabel}`;
      }
      if (CONDITION_SET_OPERATORS.has(operator)) {
        const valueSource = trimText(rule.valueSource) || "literal";
        if (valueSource === "upstream_field") {
          const referenceNode = trimText(rule.referenceNodeName) || trimText(rule.referenceNodeKey) || "上游节点";
          return `${fieldName} ${operatorLabel} ${referenceNode} / ${trimText(rule.referenceField)}`;
        }
        if (valueSource === "custom_sql") {
          return `${fieldName} ${operatorLabel} 自定义 SQL`;
        }
      }
      return `${fieldName} ${operatorLabel} ${trimText(rule.value)}`;
    })
    .filter(Boolean);
  if (!segments.length) return "";
  return segments.join(String(logic || "all") === "any" ? " / 或 " : " / 且 ");
}

function buildDefaultSqlInputAlias(nodeName: string, index: number) {
  return `temp${index + 1}`;
}

function syncSqlInputBindings(
  bindings: unknown,
  upstreamNodes: Array<Node<OrchestrationNodeData>>
) {
  const bindingMap = new Map(parseSqlInputBindings(bindings).map((item) => [item.sourceNodeKey, item.alias]));
  return upstreamNodes.map((node, index) => ({
    sourceNodeKey: node.id,
    alias: bindingMap.get(node.id) || buildDefaultSqlInputAlias(trimText(node.data?.nodeName) || node.id, index),
  }));
}

function stripTrailingSqlSemicolon(sqlText: unknown) {
  return readRawText(sqlText).trim().replace(/;+\s*$/, "");
}

function normalizeSqlIdentifierToken(token: string) {
  const text = trimText(token);
  if (!text) {
    return "";
  }
  if (
    (text.startsWith("`") && text.endsWith("`"))
    || (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith("[") && text.endsWith("]"))
  ) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function isSqlIdentifierToken(token: string) {
  const text = trimText(token);
  if (!text) {
    return false;
  }
  if (
    (text.startsWith("`") && text.endsWith("`"))
    || (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith("[") && text.endsWith("]"))
  ) {
    return true;
  }
  return /^[A-Za-z_\u0080-\uFFFF$][A-Za-z0-9_\u0080-\uFFFF$]*$/.test(text);
}

function findMatchingSqlParen(sqlText: string, openIndex: number) {
  if (sqlText[openIndex] !== "(") {
    return -1;
  }

  let depth = 0;
  let singleQuote = false;
  let doubleQuote = false;
  let backtickQuote = false;
  let bracketQuote = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openIndex; index < sqlText.length; index += 1) {
    const char = sqlText[index];
    const next = sqlText[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (singleQuote) {
      if (char === "'" && next === "'") {
        index += 1;
        continue;
      }
      if (char === "'") {
        singleQuote = false;
      }
      continue;
    }
    if (doubleQuote) {
      if (char === '"') {
        doubleQuote = false;
      }
      continue;
    }
    if (backtickQuote) {
      if (char === "`") {
        backtickQuote = false;
      }
      continue;
    }
    if (bracketQuote) {
      if (char === "]") {
        bracketQuote = false;
      }
      continue;
    }

    if (char === "-" && next === "-") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'") {
      singleQuote = true;
      continue;
    }
    if (char === '"') {
      doubleQuote = true;
      continue;
    }
    if (char === "`") {
      backtickQuote = true;
      continue;
    }
    if (char === "[") {
      bracketQuote = true;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function findTopLevelSqlKeyword(sqlText: string, keyword: string, startIndex = 0) {
  const lowered = sqlText.toLowerCase();
  const target = keyword.toLowerCase();
  let depth = 0;
  let singleQuote = false;
  let doubleQuote = false;
  let backtickQuote = false;
  let bracketQuote = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = Math.max(0, startIndex); index < sqlText.length; index += 1) {
    const char = sqlText[index];
    const next = sqlText[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (singleQuote) {
      if (char === "'" && next === "'") {
        index += 1;
        continue;
      }
      if (char === "'") {
        singleQuote = false;
      }
      continue;
    }
    if (doubleQuote) {
      if (char === '"') {
        doubleQuote = false;
      }
      continue;
    }
    if (backtickQuote) {
      if (char === "`") {
        backtickQuote = false;
      }
      continue;
    }
    if (bracketQuote) {
      if (char === "]") {
        bracketQuote = false;
      }
      continue;
    }

    if (char === "-" && next === "-") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'") {
      singleQuote = true;
      continue;
    }
    if (char === '"') {
      doubleQuote = true;
      continue;
    }
    if (char === "`") {
      backtickQuote = true;
      continue;
    }
    if (char === "[") {
      bracketQuote = true;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth !== 0) {
      continue;
    }

    if (lowered.slice(index, index + target.length) !== target) {
      continue;
    }

    const previousChar = lowered[index - 1] || "";
    const nextChar = lowered[index + target.length] || "";
    if (/[a-z0-9_$\u0080-\uFFFF]/i.test(previousChar) || /[a-z0-9_$\u0080-\uFFFF]/i.test(nextChar)) {
      continue;
    }
    return index;
  }

  return -1;
}

function splitTopLevelSqlList(segment: string) {
  const items: string[] = [];
  let depth = 0;
  let singleQuote = false;
  let doubleQuote = false;
  let backtickQuote = false;
  let bracketQuote = false;
  let lineComment = false;
  let blockComment = false;
  let current = "";

  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    const next = segment[index + 1];

    if (lineComment) {
      current += char;
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }
    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += "/";
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (singleQuote) {
      current += char;
      if (char === "'" && next === "'") {
        current += "'";
        index += 1;
        continue;
      }
      if (char === "'") {
        singleQuote = false;
      }
      continue;
    }
    if (doubleQuote) {
      current += char;
      if (char === '"') {
        doubleQuote = false;
      }
      continue;
    }
    if (backtickQuote) {
      current += char;
      if (char === "`") {
        backtickQuote = false;
      }
      continue;
    }
    if (bracketQuote) {
      current += char;
      if (char === "]") {
        bracketQuote = false;
      }
      continue;
    }

    if (char === "-" && next === "-") {
      current += char;
      current += next;
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      current += char;
      current += next;
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'") {
      current += char;
      singleQuote = true;
      continue;
    }
    if (char === '"') {
      current += char;
      doubleQuote = true;
      continue;
    }
    if (char === "`") {
      current += char;
      backtickQuote = true;
      continue;
    }
    if (char === "[") {
      current += char;
      bracketQuote = true;
      continue;
    }
    if (char === "(") {
      current += char;
      depth += 1;
      continue;
    }
    if (char === ")") {
      current += char;
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (char === "," && depth === 0) {
      if (trimText(current)) {
        items.push(current.trim());
      }
      current = "";
      continue;
    }
    current += char;
  }

  if (trimText(current)) {
    items.push(current.trim());
  }
  return items;
}

function splitTopLevelSqlTokens(segment: string) {
  const tokens: string[] = [];
  let depth = 0;
  let singleQuote = false;
  let doubleQuote = false;
  let backtickQuote = false;
  let bracketQuote = false;
  let current = "";

  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    const next = segment[index + 1];

    if (singleQuote) {
      current += char;
      if (char === "'" && next === "'") {
        current += "'";
        index += 1;
        continue;
      }
      if (char === "'") {
        singleQuote = false;
      }
      continue;
    }
    if (doubleQuote) {
      current += char;
      if (char === '"') {
        doubleQuote = false;
      }
      continue;
    }
    if (backtickQuote) {
      current += char;
      if (char === "`") {
        backtickQuote = false;
      }
      continue;
    }
    if (bracketQuote) {
      current += char;
      if (char === "]") {
        bracketQuote = false;
      }
      continue;
    }

    if (char === "'") {
      current += char;
      singleQuote = true;
      continue;
    }
    if (char === '"') {
      current += char;
      doubleQuote = true;
      continue;
    }
    if (char === "`") {
      current += char;
      backtickQuote = true;
      continue;
    }
    if (char === "[") {
      current += char;
      bracketQuote = true;
      continue;
    }
    if (char === "(") {
      current += char;
      depth += 1;
      continue;
    }
    if (char === ")") {
      current += char;
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (/\s/.test(char) && depth === 0) {
      if (trimText(current)) {
        tokens.push(current.trim());
      }
      current = "";
      continue;
    }
    current += char;
  }

  if (trimText(current)) {
    tokens.push(current.trim());
  }
  return tokens;
}

function extractSqlSelectList(sqlText: string) {
  const selectIndex = findTopLevelSqlKeyword(sqlText, "select");
  if (selectIndex < 0) {
    return "";
  }

  let start = selectIndex + "select".length;
  const leadingSegment = sqlText.slice(start);
  const distinctMatch = leadingSegment.match(/^\s*(distinct|all)\b/i);
  if (distinctMatch) {
    start += distinctMatch[0].length;
  }

  const endKeywords = ["from", "union", "except", "intersect", "where", "group", "having", "order", "limit", "qualify"];
  const endIndex = endKeywords
    .map((keyword) => findTopLevelSqlKeyword(sqlText, keyword, start))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  return sqlText.slice(start, endIndex === undefined ? sqlText.length : endIndex).trim();
}

function parseSimpleSqlReference(expression: string) {
  const normalized = trimText(expression);
  if (!normalized) {
    return null;
  }
  if (normalized === "*") {
    return { type: "all" as const };
  }
  if (/[+\-/%<>=]|::/u.test(normalized) || normalized.includes("(") || normalized.includes(")") || normalized.includes(" ")) {
    return null;
  }
  const parts = normalized.split(".").map((item) => trimText(item)).filter(Boolean);
  if (!parts.length) {
    return null;
  }
  const normalizedParts = parts.map((item) => normalizeSqlIdentifierToken(item));
  if (normalizedParts[normalizedParts.length - 1] === "*") {
    return {
      type: "table_all" as const,
      table: normalizedParts[normalizedParts.length - 2] || "",
    };
  }
  if (!normalizedParts.every((item) => item === "*" || isSqlIdentifierToken(item) || Boolean(item))) {
    return null;
  }
  return {
    type: "column" as const,
    table: normalizedParts.length > 1 ? normalizedParts[normalizedParts.length - 2] : "",
    column: normalizedParts[normalizedParts.length - 1],
  };
}

function splitSqlSelectItemAlias(selectItem: string) {
  const normalized = trimText(selectItem);
  if (!normalized) {
    return { expression: "", alias: "" };
  }

  const asMatch = normalized.match(/^(.*?)(?:\s+as\s+)((?:`[^`]+`)|(?:"[^"]+")|(?:\[[^\]]+\])|(?:[A-Za-z_\u0080-\uFFFF$][A-Za-z0-9_\u0080-\uFFFF$]*))\s*$/i);
  if (asMatch) {
    return {
      expression: trimText(asMatch[1]),
      alias: normalizeSqlIdentifierToken(asMatch[2]),
    };
  }

  const tokens = splitTopLevelSqlTokens(normalized);
  if (tokens.length >= 2) {
    const candidate = tokens[tokens.length - 1];
    const blacklist = new Set(["end", "desc", "asc", "null", "true", "false", "then", "else"]);
    if (isSqlIdentifierToken(candidate) && !blacklist.has(candidate.toLowerCase())) {
      const aliasIndex = normalized.lastIndexOf(candidate);
      if (aliasIndex > 0) {
        return {
          expression: trimText(normalized.slice(0, aliasIndex)),
          alias: normalizeSqlIdentifierToken(candidate),
        };
      }
    }
  }

  return {
    expression: normalized,
    alias: "",
  };
}

function mergeUniqueSqlSchemaColumns(columnGroups: Array<DevColumnEntry[]>) {
  const output: DevColumnEntry[] = [];
  const seen = new Set<string>();
  columnGroups.forEach((columns) => {
    (columns || []).forEach((column) => {
      const fieldName = trimText(column?.name);
      if (fieldName && !seen.has(fieldName)) {
        seen.add(fieldName);
        output.push(createVirtualColumn(fieldName, output.length, column));
      }
    });
  });
  return output;
}

function resolveSqlReferenceColumn(reference: ReturnType<typeof parseSimpleSqlReference>, sourceSchemaByAlias: Record<string, DevColumnEntry[]>) {
  if (!reference || reference.type !== "column") {
    return undefined;
  }
  if (reference.table) {
    return (sourceSchemaByAlias[reference.table] || []).find((column) => trimText(column.name) === reference.column);
  }
  const matchedSchema = Object.values(sourceSchemaByAlias).find((columns) =>
    (columns || []).some((column) => trimText(column.name) === reference.column)
  );
  return matchedSchema?.find((column) => trimText(column.name) === reference.column);
}

function inferCustomSqlCteSchemas(sqlText: string, sourceSchemaByAlias: Record<string, DevColumnEntry[]>) {
  const normalizedSql = stripTrailingSqlSemicolon(sqlText);
  const cteSchemas: Record<string, DevColumnEntry[]> = {};
  if (!/^with\b/i.test(normalizedSql)) {
    return cteSchemas;
  }

  let cursor = findTopLevelSqlKeyword(normalizedSql, "with");
  if (cursor < 0) {
    return cteSchemas;
  }
  cursor += 4;
  const recursiveMatch = normalizedSql.slice(cursor).match(/^\s*recursive\b/i);
  if (recursiveMatch) {
    cursor += recursiveMatch[0].length;
  }

  while (cursor < normalizedSql.length) {
    while (/\s/.test(normalizedSql[cursor] || "")) {
      cursor += 1;
    }
    const nameMatch = normalizedSql.slice(cursor).match(/^((?:`[^`]+`)|(?:"[^"]+")|(?:\[[^\]]+\])|(?:[A-Za-z_\u0080-\uFFFF$][A-Za-z0-9_\u0080-\uFFFF$]*))/);
    if (!nameMatch) {
      break;
    }

    const cteName = normalizeSqlIdentifierToken(nameMatch[1]);
    cursor += nameMatch[0].length;

    let explicitColumns: string[] = [];
    while (/\s/.test(normalizedSql[cursor] || "")) {
      cursor += 1;
    }
    if (normalizedSql[cursor] === "(") {
      const listEnd = findMatchingSqlParen(normalizedSql, cursor);
      if (listEnd > cursor) {
        explicitColumns = splitTopLevelSqlList(normalizedSql.slice(cursor + 1, listEnd)).map((item) => normalizeSqlIdentifierToken(item)).filter(Boolean);
        cursor = listEnd + 1;
      }
    }

    const asMatch = normalizedSql.slice(cursor).match(/^\s*as\s*\(/i);
    if (!asMatch) {
      break;
    }
    cursor += asMatch[0].length - 1;
    const subqueryStart = cursor;
    const subqueryEnd = findMatchingSqlParen(normalizedSql, subqueryStart);
    if (subqueryEnd < 0) {
      break;
    }
    const subquerySql = normalizedSql.slice(subqueryStart + 1, subqueryEnd);
    const availableSchemas = {
      ...sourceSchemaByAlias,
      ...cteSchemas,
    };
    const inferredColumns = explicitColumns.length
      ? explicitColumns.map((fieldName, index) => createVirtualColumn(fieldName, index))
      : inferCustomSqlSchemaColumns(subquerySql, availableSchemas);
    cteSchemas[cteName] = inferredColumns.map((column, index) => createVirtualColumn(column.name, index, column));
    cursor = subqueryEnd + 1;

    while (/\s/.test(normalizedSql[cursor] || "")) {
      cursor += 1;
    }
    if (normalizedSql[cursor] !== ",") {
      break;
    }
    cursor += 1;
  }

  return cteSchemas;
}

function inferCustomSqlSchemaColumns(sqlText: string, sourceSchemaByAlias: Record<string, DevColumnEntry[]>) {
  const normalizedSql = stripTrailingSqlSemicolon(sqlText);
  if (!normalizedSql) {
    return [] as DevColumnEntry[];
  }

  const availableSchemas = {
    ...sourceSchemaByAlias,
    ...inferCustomSqlCteSchemas(normalizedSql, sourceSchemaByAlias),
  };
  const selectList = extractSqlSelectList(normalizedSql);
  if (!selectList) {
    return [] as DevColumnEntry[];
  }

  const output: DevColumnEntry[] = [];
  splitTopLevelSqlList(selectList).forEach((selectItem, index) => {
    const { expression, alias } = splitSqlSelectItemAlias(selectItem);
    const reference = parseSimpleSqlReference(expression);

    if (reference?.type === "table_all") {
      const scopedColumns = availableSchemas[reference.table] || [];
      scopedColumns.forEach((column) => {
        output.push(createVirtualColumn(column.name, output.length, column));
      });
      return;
    }

    if (reference?.type === "all") {
      mergeUniqueSqlSchemaColumns(Object.values(availableSchemas)).forEach((column) => {
        output.push(createVirtualColumn(column.name, output.length, column));
      });
      return;
    }

    if (alias) {
      output.push(createVirtualColumn(alias, output.length, reference ? { ...resolveSqlReferenceColumn(reference, availableSchemas), name: alias } : { name: alias }));
      return;
    }

    if (reference?.type === "column") {
      output.push(createVirtualColumn(reference.column, output.length, resolveSqlReferenceColumn(reference, availableSchemas)));
      return;
    }

    output.push(createVirtualColumn(`expr_${index + 1}`, output.length));
  });

  return mergeUniqueSqlSchemaColumns([output]);
}

function syncColumnAlignmentRows(
  mappings: unknown,
  upstreamNodes: Array<Node<OrchestrationNodeData>>,
  upstreamColumnMap: Record<string, DevColumnEntry[]>
) {
  const parsed = normalizeColumnAlignmentRows(mappings);
  if (parsed.length) {
    return parsed.map((row, rowIndex) => {
      const bindingMap = new Map((row.bindings || []).map((binding) => [binding.sourceNodeKey, binding.fieldName]));
      const nextBindings = upstreamNodes.map((node) => ({
        sourceNodeKey: node.id,
        fieldName: bindingMap.get(node.id) || "",
      }));
      const fallbackOutputField = trimText(row.outputField) || nextBindings.find((binding) => binding.fieldName)?.fieldName || `field_${rowIndex + 1}`;
      return {
        outputField: fallbackOutputField,
        bindings: nextBindings,
      };
    });
  }

  const orderedFields: string[] = [];
  const seen = new Set<string>();
  upstreamNodes.forEach((node) => {
    (upstreamColumnMap[node.id] || []).forEach((column) => {
      if (column.name && !seen.has(column.name)) {
        seen.add(column.name);
        orderedFields.push(column.name);
      }
    });
  });

  return orderedFields.map((fieldName) => ({
    outputField: fieldName,
    bindings: upstreamNodes.map((node) => ({
      sourceNodeKey: node.id,
      fieldName: (upstreamColumnMap[node.id] || []).some((column) => column.name === fieldName) ? fieldName : "",
    })),
  }));
}

function areColumnAlignmentRowsEqual(left: ColumnAlignmentRow[], right: ColumnAlignmentRow[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftRow, rowIndex) => {
    const rightRow = right[rowIndex];
    if (!rightRow || trimText(leftRow.outputField) !== trimText(rightRow.outputField)) {
      return false;
    }
    const leftBindings = Array.isArray(leftRow.bindings) ? leftRow.bindings : [];
    const rightBindings = Array.isArray(rightRow.bindings) ? rightRow.bindings : [];
    if (leftBindings.length !== rightBindings.length) {
      return false;
    }
    return leftBindings.every((leftBinding, bindingIndex) => {
      const rightBinding = rightBindings[bindingIndex];
      return Boolean(rightBinding)
        && trimText(leftBinding.sourceNodeKey) === trimText(rightBinding.sourceNodeKey)
        && trimText(leftBinding.fieldName) === trimText(rightBinding.fieldName);
    });
  });
}

function isAiOperatorCode(operatorCode: string) {
  return ["llm", "llm_row", "llm_batch"].includes(normalizeAiOperatorCode(operatorCode));
}

function isBatchAiOperatorCode(operatorCode: string) {
  return normalizeAiOperatorCode(operatorCode) === "llm_batch";
}

function getAiFallbackFieldName(operatorCode: string) {
  return isBatchAiOperatorCode(operatorCode) ? "batch_result" : "llm_reply";
}

function getAiModeSummaryLabel(operatorCode: string) {
  return isBatchAiOperatorCode(operatorCode) ? "多进一出" : "多进多出";
}

function getAiPromptTemplateHint(operatorCode: string) {
  return isBatchAiOperatorCode(operatorCode)
    ? "提示词支持 {{字段名}}(整批字段数组)、{{rows_json}}、{{row_count}}、{{columns}}"
    : "提示词支持 {{字段名}}、{{row_json}}、{{row_index}}";
}

function getAiExecutionHint(operatorCode: string) {
  return isBatchAiOperatorCode(operatorCode)
    ? "批处理会把上游多条记录作为一批输入，只调用一次模型，输出一条汇总结果。适合统计分析、整批研判、生成完整报告。"
    : "单条处理会对上游每一条记录分别调用模型，输出与输入同样条数的结果。适合逐条抽取、分类、标准化，并可提取多个字段。";
}

function getAiOutputFieldWritebackHint(operatorCode: string) {
  return isBatchAiOperatorCode(operatorCode)
    ? "模型按 JSON 对象返回后，会生成当前节点唯一的一条结果记录。"
    : "模型按 JSON 对象返回后，会把输出字段追加到每一条输入记录后面。";
}

function getAiOutputFieldPlaceholder(operatorCode: string) {
  return isBatchAiOperatorCode(operatorCode) ? "例如：analysis_report" : "例如：report_time";
}

function getPreferredNodeDrawerWidth(node?: Node<OrchestrationNodeData>, upstreamCount = 0) {
  if (!node) {
    return ORCHESTRATION_DRAWER_DEFAULT_WIDTH;
  }

  const operatorCode = trimText(node.data?.operatorCode);
  if (operatorCode === "union" || operatorCode === "join") {
    return Math.min(ORCHESTRATION_DRAWER_MAX_WIDTH, Math.max(960, 560 + Math.max(upstreamCount, 2) * 220));
  }
  if (operatorCode === "custom_sql") {
    return 1120;
  }
  if (node.data?.nodeType === "source") {
    return 820;
  }
  if (isAiOperatorCode(operatorCode)) {
    return 920;
  }
  if (["string_aggregate", "string_split", "window_compute", "format_convert", "string_transform"].includes(operatorCode)) {
    return 900;
  }
  if (operatorCode === "output_table") {
    return 920;
  }
  return ORCHESTRATION_DRAWER_DEFAULT_WIDTH;
}

function getAiDefaultOutputFields(operatorCode: string): AiOutputFieldMapping[] {
  return [{
    fieldName: getAiFallbackFieldName(operatorCode),
    description: "",
  }];
}

function parseAiOutputFieldMappings(value: unknown, fallbackFieldName = "llm_reply", legacyFieldName?: unknown) {
  const parsed = parseObjectArray<AiOutputFieldMapping>(value)
    .map((item) => ({
      fieldName: trimText(item.fieldName),
      description: trimText(item.description),
    }))
    .filter((item) => item.fieldName || item.description);

  if (parsed.length) {
    return parsed;
  }

  const nextFieldName = trimText(legacyFieldName) || fallbackFieldName;
  return nextFieldName ? [{ fieldName: nextFieldName, description: "" }] : [];
}

function buildAiOutputFieldSummary(nodeConfig: Record<string, unknown>, operatorCode: string) {
  const outputFields = parseAiOutputFieldMappings(
    nodeConfig.outputFields,
    getAiFallbackFieldName(operatorCode),
    nodeConfig.outputFieldName
  );
  return outputFields.length ? `输出 ${outputFields.length} 字段` : "待配置输出字段";
}

type ModelCatalogItem = NonNullable<ModelProviderRecord["modelCatalog"]>[number];

function buildFallbackCatalog(record?: Partial<ModelProviderRecord> | null): ModelCatalogItem[] {
  if (record?.modelCatalog?.length) {
    return record.modelCatalog;
  }

  const modelName = trimText(record?.modelName);
  const modelVersion = trimText(record?.modelVersion || record?.modelName);
  if (!modelName && !modelVersion) {
    return [];
  }

  return [{
    name: modelName || modelVersion,
    label: modelName || modelVersion,
    versions: [{ value: modelVersion || modelName, label: modelVersion || modelName }],
  }];
}

function getModelNameOptions(catalog: ModelCatalogItem[]) {
  return catalog.map((item) => ({ value: item.name, label: item.label }));
}

function getModelVersionOptions(catalog: ModelCatalogItem[], modelName?: string) {
  const current = catalog.find((item) => item.name === modelName) || catalog[0];
  return (current?.versions || []).map((item) => ({ value: item.value, label: item.label }));
}

function isVersionSelectionRedundant(modelName?: string, versionOptions?: Array<{ value: string; label: string }>) {
  if (!modelName || !versionOptions?.length) {
    return false;
  }
  return versionOptions.length === 1 && versionOptions[0].value === modelName;
}

function getOperatorMeta(operatorCode: string, nodeType: CanvasNodeType) {
  if (nodeType === "source") return { label: "数据输入", color: "#1677ff" };
  if (nodeType === "output") return { label: "数据输出", color: "#389e0d" };
  const normalizedOperatorCode = normalizeAiOperatorCode(operatorCode);
  return OPERATOR_META.get(normalizedOperatorCode) || OPERATOR_META.get(operatorCode) || { label: normalizedOperatorCode || operatorCode, color: "#64748b" };
}

function normalizeEdgeStatus(value: unknown): OrchestrationEdgeStatus {
  return String(value || "").toLowerCase() === "paused" ? "paused" : "active";
}

function isActiveCanvasEdge(edge: Edge<OrchestrationCanvasEdgeData>) {
  return normalizeEdgeStatus(edge.data?.edgeStatus) === "active";
}

function isBranchOperator(operatorCode: string) {
  return trimText(operatorCode) === "branch";
}

function buildCanvasNodeAnchors(direction: CanvasLayoutDirection, nodeType: CanvasNodeType, operatorCode: string) {
  const isBranchNode = isBranchOperator(operatorCode);
  if (direction === "vertical") {
    return {
      sourcePosition: isBranchNode ? Position.Bottom : nodeType !== "output" ? Position.Bottom : Position.Top,
      targetPosition: nodeType !== "source" ? Position.Top : Position.Bottom,
    };
  }
  return {
    sourcePosition: isBranchNode ? Position.Right : nodeType !== "output" ? Position.Right : Position.Left,
    targetPosition: nodeType !== "source" ? Position.Left : Position.Right,
  };
}

function getCanvasNodeBounds(node: Node<OrchestrationNodeData>) {
  const width = Number(node.width || node.style?.width || ORCHESTRATION_NODE_WIDTH);
  const height = Number(
    node.height ||
      node.style?.height ||
      node.style?.minHeight ||
      (isBranchOperator(String(node.data?.operatorCode || "")) ? ORCHESTRATION_BRANCH_NODE_MIN_HEIGHT : ORCHESTRATION_NODE_MIN_HEIGHT)
  );
  return {
    left: Number(node.position.x || 0),
    top: Number(node.position.y || 0),
    right: Number(node.position.x || 0) + width,
    bottom: Number(node.position.y || 0) + height,
  };
}

function isNodeIntersectingRect(node: Node<OrchestrationNodeData>, rect: { left: number; right: number; top: number; bottom: number }) {
  const bounds = getCanvasNodeBounds(node);
  return !(bounds.right < rect.left || bounds.left > rect.right || bounds.bottom < rect.top || bounds.top > rect.bottom);
}

function buildBranchRouteLabel(sourcePort?: string | null) {
  if (sourcePort === "branch_true") return "满足";
  if (sourcePort === "branch_false") return "不满足";
  return "";
}

function buildCanvasNodeStyle(operatorCode: string): CSSProperties {
  const isBranchNode = isBranchOperator(operatorCode);
  return {
    width: ORCHESTRATION_NODE_WIDTH,
    minHeight: isBranchNode ? ORCHESTRATION_BRANCH_NODE_MIN_HEIGHT : ORCHESTRATION_NODE_MIN_HEIGHT,
    border: "none",
    borderRadius: isBranchNode ? 22 : 18,
    background: "transparent",
    boxShadow: "none",
  };
}

function OrchestrationNodeView({
  data,
  selected,
  layoutDirection = "horizontal",
}: NodeProps<OrchestrationNodeData> & {
  layoutDirection?: CanvasLayoutDirection;
}) {
  const nodeType = data.nodeType || "operator";
  const operatorCode = String(data.operatorCode || "");
  const meta = getOperatorMeta(operatorCode, nodeType);
  const isBranchNode = isBranchOperator(operatorCode);
  const targetHandlePosition = layoutDirection === "vertical" ? Position.Top : Position.Left;
  const sourceHandlePosition = layoutDirection === "vertical" ? Position.Bottom : Position.Right;
  const nodeStyle = {
    "--orchestration-node-accent": meta.color,
  } as CSSProperties;

  return (
    <div
      className={`orchestration-node orchestration-node--canvas${selected ? " is-selected" : ""}${isBranchNode ? " orchestration-node--branch" : ""}${layoutDirection === "vertical" ? " orchestration-node--vertical" : ""}`}
      style={nodeStyle}
    >
      {nodeType !== "source" ? (
        <Handle type="target" position={targetHandlePosition} className="orchestration-node__handle orchestration-node__handle--target" />
      ) : null}
      {nodeType !== "output" && !isBranchNode ? (
        <Handle type="source" position={sourceHandlePosition} className="orchestration-node__handle orchestration-node__handle--source" />
      ) : null}
      {isBranchNode ? (
        <>
          <Handle
            id="branch_true"
            type="source"
            position={layoutDirection === "vertical" ? Position.Bottom : Position.Right}
            className="orchestration-node__handle orchestration-node__handle--source orchestration-node__handle--source-top"
          />
          <Handle
            id="branch_false"
            type="source"
            position={layoutDirection === "vertical" ? Position.Bottom : Position.Right}
            className="orchestration-node__handle orchestration-node__handle--source orchestration-node__handle--source-bottom orchestration-node__handle--source-false"
          />
          <span className="orchestration-node__port-label orchestration-node__port-label--top">满足</span>
          <span className="orchestration-node__port-label orchestration-node__port-label--bottom">不满足</span>
        </>
      ) : null}
      <div className="orchestration-node__badge" style={{ color: meta.color, background: `${meta.color}12` }}>
        {meta.label}
      </div>
      <div className="orchestration-node__content">
        <div className="orchestration-node__title" title={data.nodeName}>
          {data.nodeName}
        </div>
        <div className="orchestration-node__meta" title={data.subtitle || "待配置"}>
          {data.subtitle || "待配置"}
        </div>
      </div>
    </div>
  );
}

function OrchestrationEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
  data,
  onTogglePause,
}: EdgeProps<OrchestrationCanvasEdgeData> & {
  onTogglePause: (edgeId: string) => void;
}) {
  const paused = normalizeEdgeStatus(data?.edgeStatus) === "paused";
  const routeLabel = buildBranchRouteLabel(data?.sourcePort);
  const showLabel = Boolean(routeLabel) || selected;
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 22,
    offset: 26,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: paused ? "#b8c3d8" : "#6b8cff",
          strokeWidth: selected ? 3 : 2.5,
          strokeDasharray: paused ? "7 5" : undefined,
          strokeLinecap: "round",
          filter: paused ? undefined : "drop-shadow(0 3px 10px rgba(37, 99, 235, 0.18))",
        }}
      />
      {showLabel ? (
        <EdgeLabelRenderer>
          <div
            className={`orchestration-edge-pill${selected ? " is-selected" : ""}${paused ? " is-paused" : ""}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {routeLabel ? <span className="orchestration-edge-pill__route">{routeLabel}</span> : null}
            {selected ? (
              <button
                type="button"
                className="orchestration-edge-pill__action"
                title={paused ? "恢复连线" : "暂停连线"}
                aria-label={paused ? "恢复连线" : "暂停连线"}
                onClick={() => onTogglePause(id)}
              >
                {paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
              </button>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const ORCHESTRATION_NODE_TYPES = {
  orchestration: OrchestrationNodeView,
};

function getAlignModeLabel(value: unknown) {
  return ALIGN_MODE_OPTIONS.find((item) => item.value === value)?.label || "按字段名对齐";
}

function getKeepStrategyLabel(value: unknown) {
  return KEEP_STRATEGY_OPTIONS.find((item) => item.value === value)?.label || "保留首条";
}

function getWriteModeLabel(value: unknown) {
  return WRITE_MODE_OPTIONS.find((item) => item.value === value)?.label || "覆盖写入";
}

function getAggregateFunctionLabel(value: unknown) {
  return AGGREGATE_FUNCTION_OPTIONS.find((item) => item.value === value)?.label || "COUNT";
}

function toTwoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function parseRunTime(runTime?: string) {
  const [hourText, minuteText] = String(runTime || "").split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return {
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 2,
    minute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : 0,
  };
}

function buildRunTime(hour: string, minute: string) {
  return `${toTwoDigits(Number(hour))}:${toTwoDigits(Number(minute))}`;
}

function parseCronToOrchestrationSchedule(cronExpr?: string | null): Partial<OrchestrationScheduleFormValues> {
  const text = String(cronExpr || "").trim();
  if (!text) {
    return { scheduleType: "manual" };
  }

  const fields = text.split(/\s+/);
  const normalized = fields.length === 6 ? fields.slice(1) : fields;
  if (normalized.length !== 5) {
    return { scheduleType: "custom", cronExpr: text };
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = normalized;
  const minuteAsNumber = Number(minute);
  const hourAsNumber = Number(hour);
  const isMinuteNumber = Number.isInteger(minuteAsNumber) && minuteAsNumber >= 0 && minuteAsNumber <= 59;
  const isHourNumber = Number.isInteger(hourAsNumber) && hourAsNumber >= 0 && hourAsNumber <= 23;

  if (hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const intervalMatch = minute.match(/^\*\/(\d{1,3})$/);
    if (intervalMatch) {
      return {
        scheduleType: "interval",
        intervalMinutes: Number(intervalMatch[1]),
      };
    }
  }

  if (isMinuteNumber && isHourNumber && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return {
      scheduleType: "daily",
      runTime: buildRunTime(hour, minute),
    };
  }

  if (isMinuteNumber && isHourNumber && dayOfMonth === "*" && month === "*" && /^[0-7](,[0-7])*$/.test(dayOfWeek)) {
    const weekDays = dayOfWeek
      .split(",")
      .map((item) => Number(item))
      .map((item) => (item === 7 ? 0 : item))
      .filter((item, index, array) => item >= 0 && item <= 6 && array.indexOf(item) === index)
      .sort((left, right) => left - right);
    if (weekDays.length > 0) {
      return {
        scheduleType: "weekly",
        runTime: buildRunTime(hour, minute),
        weekDays,
      };
    }
  }

  const monthDayAsNumber = Number(dayOfMonth);
  if (
    isMinuteNumber &&
    isHourNumber &&
    Number.isInteger(monthDayAsNumber) &&
    monthDayAsNumber >= 1 &&
    monthDayAsNumber <= 31 &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return {
      scheduleType: "monthly",
      runTime: buildRunTime(hour, minute),
      monthDay: monthDayAsNumber,
    };
  }

  return { scheduleType: "custom", cronExpr: text };
}

function buildCronFromOrchestrationSchedule(values: OrchestrationScheduleFormValues) {
  switch (values.scheduleType) {
    case "manual":
      return null;
    case "interval": {
      const intervalMinutes = Math.min(720, Math.max(1, Number(values.intervalMinutes || 5)));
      return `*/${intervalMinutes} * * * *`;
    }
    case "daily": {
      const { hour, minute } = parseRunTime(values.runTime);
      return `${minute} ${hour} * * *`;
    }
    case "weekly": {
      const weekDays = Array.from(new Set((values.weekDays || []).map(Number)))
        .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
        .sort((left, right) => left - right);
      if (!weekDays.length) return null;
      const { hour, minute } = parseRunTime(values.runTime);
      return `${minute} ${hour} * * ${weekDays.join(",")}`;
    }
    case "monthly": {
      const { hour, minute } = parseRunTime(values.runTime);
      const monthDay = Math.min(31, Math.max(1, Number(values.monthDay || 1)));
      return `${minute} ${hour} ${monthDay} * *`;
    }
    case "custom": {
      const customCron = String(values.cronExpr || "").trim();
      return customCron || null;
    }
    default:
      return null;
  }
}

function formatPreviewSql(sqlText: string, datasourceType?: string | null) {
  if (!trimText(sqlText)) return "";
  try {
    return formatSql(sqlText, { language: detectSqlLanguage(datasourceType || undefined) as never });
  } catch {
    return sqlText;
  }
}

function buildSqlCommentBlock(lines: Array<string | null | undefined>) {
  const normalizedLines = lines.map((item) => trimText(item)).filter(Boolean);
  if (!normalizedLines.length) {
    return "";
  }
  return ["/*", ...normalizedLines.map((line) => ` * ${line}`), " */"].join("\n");
}

function annotateSqlText(sqlText: string, lines: Array<string | null | undefined>) {
  const normalizedSql = trimText(sqlText);
  if (!normalizedSql) {
    return "";
  }
  const commentBlock = buildSqlCommentBlock(lines);
  return commentBlock ? `${commentBlock}\n${normalizedSql}` : normalizedSql;
}

function normalizeSqlPreview(preview: DevOrchestrationSqlPreview): DevOrchestrationSqlPreview {
  return {
    ...preview,
    previewSql: annotateSqlText(
      formatPreviewSql(preview.previewSql, preview.datasourceType),
      [
        `任务: ${preview.taskName}`,
        `最终节点: ${preview.finalNodeName}`,
        `方言: ${preview.datasourceType || preview.dialect}`,
        `输出字段数: ${preview.finalColumns.length}`,
      ]
    ),
    executeSql: preview.executeSql
      ? annotateSqlText(
          formatPreviewSql(preview.executeSql, preview.datasourceType),
          [
            `任务: ${preview.taskName}`,
            `执行入口: ${preview.finalNodeName}`,
            `执行模式: 调度执行 SQL`,
          ]
        )
      : null,
    nodeSqls: preview.nodeSqls.map((item) => ({
      ...item,
      sql: annotateSqlText(
        formatPreviewSql(item.sql, preview.datasourceType),
        [
          `节点: ${item.nodeName}`,
          `节点类型: ${item.nodeType}`,
          `算子编码: ${item.operatorCode}`,
          `CTE: ${item.cteName}`,
          item.relationName ? `关系对象: ${item.relationName}` : null,
          `字段数: ${item.columns.length}`,
        ]
      ),
    })),
    outputStatements: preview.outputStatements.map((item) => ({
      ...item,
      sql: annotateSqlText(
        formatPreviewSql(item.sql, preview.datasourceType),
        [
          `输出节点: ${item.nodeName}`,
          `目标表: ${item.targetTable}`,
        ]
      ),
    })),
  };
}

function normalizeNodePreview(preview: DevOrchestrationNodePreview): DevOrchestrationNodePreview {
  return {
    ...preview,
    previewSql: annotateSqlText(
      formatPreviewSql(preview.previewSql, preview.datasourceType),
      [
        `预览节点: ${preview.nodeName}`,
        `节点类型: ${preview.nodeType}`,
        `算子编码: ${preview.operatorCode}`,
      ]
    ),
    nodeSql: annotateSqlText(
      formatPreviewSql(preview.nodeSql, preview.datasourceType),
      [
        `节点: ${preview.nodeName}`,
        `CTE: ${preview.cteName || preview.nodeKey}`,
      ]
    ),
  };
}

function formatPreviewCellValue(value: unknown, columnMeta?: DevColumnEntry) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const columnType = trimText(columnMeta?.dataType || columnMeta?.columnType).toLowerCase();
  if (value instanceof Date) {
    return value.toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-");
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    const looksLikeDate = /(date|time|timestamp)/.test(columnType) || /^\d{4}-\d{2}-\d{2}([ tT]\d{2}:\d{2}:\d{2}(\.\d+)?)?([zZ]|[+-]\d{2}:\d{2})?$/.test(normalized);
    if (looksLikeDate) {
      const timestamp = Date.parse(normalized.replace(" ", "T"));
      if (!Number.isNaN(timestamp)) {
        return new Date(timestamp).toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-");
      }
    }
    return normalized;
  }

  if (typeof value === "number" && /(date|time|timestamp)/.test(columnType) && value > 1_000_000_000) {
    const milliseconds = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(milliseconds).toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-");
  }

  return String(value);
}

function buildPreviewResultColumns(fields: string[], metadataMap: Record<string, DevColumnEntry> = {}) {
  return fields.map((fieldName) => ({
    title: (
      <div className="orchestration-preview-column__title">
        <FieldOptionCard option={buildFieldSelectOption(metadataMap[fieldName] || createVirtualColumn(fieldName, 0))} dense />
      </div>
    ),
    dataIndex: fieldName,
    key: fieldName,
    width: 160,
    ellipsis: true,
    render: (value: unknown) => {
      if (value === null || value === undefined || value === "") {
        return <Typography.Text type="secondary">-</Typography.Text>;
      }
      return <span>{formatPreviewCellValue(value, metadataMap[fieldName])}</span>;
    },
  }));
}

function buildSqlPreviewTabItems(preview: DevOrchestrationSqlPreview): SqlPreviewTabItem[] {
  const items: SqlPreviewTabItem[] = [
    {
      key: "preview",
      label: "预览 SQL",
      children: <SqlCodeBlock value={preview.previewSql} />,
    },
    {
      key: "nodes",
      label: `节点拆解 (${preview.nodeSqls.length})`,
      children: (
        <Collapse
          items={preview.nodeSqls.map((item) => ({
            key: item.nodeKey,
            label: `${item.nodeName} / ${item.cteName}`,
            extra: <Tag color={item.nodeType === "output" ? "green" : item.nodeType === "source" ? "blue" : "purple"}>{item.nodeType}</Tag>,
            children: (
              <Space direction="vertical" size={12} style={{ display: "flex" }}>
                <div className="orchestration-sql-preview__meta">
                  <Tag>{item.operatorCode}</Tag>
                  {item.relationName ? <Tag color="gold">{item.relationName}</Tag> : null}
                  <Tag color="cyan">字段 {item.columns.length}</Tag>
                </div>
                <SqlCodeBlock value={item.sql} />
              </Space>
            ),
          }))}
        />
      ),
    },
  ];

  if (preview.executeSql) {
    items.splice(1, 0, {
      key: "execute",
      label: "执行 SQL",
      children: <SqlCodeBlock value={preview.executeSql} />,
    });
  }

  if (preview.outputStatements.length) {
    items.splice(preview.executeSql ? 2 : 1, 0, {
      key: "outputs",
      label: `输出语句 (${preview.outputStatements.length})`,
      children: (
        <Collapse
          items={preview.outputStatements.map((item) => ({
            key: item.nodeKey,
            label: `${item.nodeName} / ${item.targetTable}`,
            children: <SqlCodeBlock value={item.sql} />,
          }))}
        />
      ),
    });
  }

  return items;
}

function buildNodeSubtitle(nodeType: CanvasNodeType, operatorCode: string, nodeConfig: Record<string, unknown>, fallbackSubtitle?: string) {
  if (nodeType === "source") {
    const databaseName = trimText(nodeConfig.databaseName);
    const tableName = trimText(nodeConfig.tableName);
    return databaseName && tableName ? `${databaseName} / ${tableName}` : fallbackSubtitle || "选择输入表";
  }

  if (nodeType === "output") {
    const targetTable = trimText(nodeConfig.targetTable);
    const mappingCount = parseOutputFieldMappings(nodeConfig.outputFieldMappings).length;
    if (targetTable) {
      return [Boolean(nodeConfig.createTargetTable) ? "建表" : getWriteModeLabel(nodeConfig.writeMode), targetTable, mappingCount ? `映射 ${mappingCount}` : ""]
        .filter(Boolean)
        .join(" / ");
    }
    return fallbackSubtitle || "配置输出目标表";
  }

  switch (operatorCode) {
    case "filter":
      return truncateText(
        buildConditionSummary(parseConditionRules(nodeConfig.filterRules), nodeConfig.filterLogic) ||
          trimText(nodeConfig.filterCondition || nodeConfig.configText),
        46
      ) || "配置筛选条件";
    case "deduplicate": {
      const dedupeKeys = parseStringArray(nodeConfig.dedupeKeys);
      const dedupeSortFields = parseSortRules(nodeConfig.dedupeSortFields);
      return dedupeKeys.length
        ? truncateText(`${dedupeKeys.join(", ")} / sort ${dedupeSortFields.length} / ${getKeepStrategyLabel(nodeConfig.keepStrategy)}`, 46)
        : "选择去重键";
    }
    case "union":
      return parseColumnAlignmentRows(nodeConfig.columnMappings).length
        ? `对齐 ${parseColumnAlignmentRows(nodeConfig.columnMappings).length} 列`
        : getAlignModeLabel(nodeConfig.alignMode);
    case "intersect":
      return getAlignModeLabel(nodeConfig.alignMode);
    case "replace": {
      const fieldName = trimText(nodeConfig.fieldName);
      const matchValue = trimText(nodeConfig.matchValue);
      const replaceValue = trimText(nodeConfig.replaceValue);
      return fieldName
        ? truncateText(`${fieldName}: ${matchValue || "空值"} -> ${replaceValue || "空值"}`, 46)
        : "配置字段替换规则";
    }
    case "llm":
    case "llm_row":
    case "llm_batch": {
      const normalizedOperatorCode = normalizeAiOperatorCode(operatorCode);
      const summary = [
        getAiModeSummaryLabel(normalizedOperatorCode),
        trimText(nodeConfig.modelVersion || nodeConfig.modelName),
        buildAiOutputFieldSummary(nodeConfig, normalizedOperatorCode),
      ]
        .filter(Boolean)
        .join(" / ");
      return truncateText(summary, 46) || "配置 AI 算子";
    }
    case "custom_sql":
      return truncateText(
        parseSqlInputBindings(nodeConfig.sqlInputs)
          .map((item) => trimText(item.alias))
          .filter(Boolean)
          .join(", ") || trimText(nodeConfig.sqlText || nodeConfig.configText),
        46
      ) || "编写节点 SQL";
    default:
      return truncateText(nodeConfig.configText, 46) || fallbackSubtitle || "配置待完善";
  }
}

function buildDesignerNodeSubtitle(nodeType: CanvasNodeType, operatorCode: string, nodeConfig: Record<string, unknown>, fallbackSubtitle?: string) {
  if (nodeType === "source") {
    const databaseName = trimText(nodeConfig.databaseName);
    const tableName = trimText(nodeConfig.tableName);
    return databaseName && tableName ? `${databaseName} / ${tableName}` : fallbackSubtitle || "选择输入表";
  }

  if (nodeType === "output") {
    const targetTable = trimText(nodeConfig.targetTable);
    const mappingCount = parseOutputFieldMappings(nodeConfig.outputFieldMappings).length;
    if (targetTable) {
      return [Boolean(nodeConfig.createTargetTable) ? "建表" : getWriteModeLabel(nodeConfig.writeMode), targetTable, mappingCount ? `映射 ${mappingCount}` : ""]
        .filter(Boolean)
        .join(" / ");
    }
    return fallbackSubtitle || "配置输出目标表";
  }

  switch (operatorCode) {
    case "filter":
      return truncateText(
        buildConditionSummary(parseConditionRules(nodeConfig.filterRules), nodeConfig.filterLogic) ||
          trimText(nodeConfig.filterCondition || nodeConfig.configText),
        46
      ) || "配置筛选条件";
    case "deduplicate": {
      const dedupeKeys = parseStringArray(nodeConfig.dedupeKeys);
      const dedupeSortFields = parseSortRules(nodeConfig.dedupeSortFields);
      return dedupeKeys.length
        ? truncateText(`${dedupeKeys.join(", ")} / sort ${dedupeSortFields.length} / ${getKeepStrategyLabel(nodeConfig.keepStrategy)}`, 46)
        : "选择去重键";
    }
    case "select_columns": {
      const selectedColumns = parseStringArray(nodeConfig.selectedColumns);
      return selectedColumns.length ? truncateText(selectedColumns.join(", "), 46) : "选择输出字段";
    }
    case "rename_fields": {
      const renameMappings = parseRenameMappings(nodeConfig.renameMappings);
      const firstRule = renameMappings.find((item) => item.sourceField && item.targetField);
      return firstRule?.sourceField && firstRule.targetField
        ? truncateText(`${firstRule.sourceField} -> ${firstRule.targetField}${renameMappings.length > 1 ? ` 等 ${renameMappings.length} 项` : ""}`, 46)
        : "配置字段重命名";
    }
    case "sort": {
      const sortRules = parseSortRules(nodeConfig.sortFields);
      return sortRules.length
        ? truncateText(sortRules.map((item) => `${item.fieldName} ${item.direction === "DESC" ? "DESC" : "ASC"}`).join(", "), 46)
        : "配置排序规则";
    }
    case "limit_rows": {
      const limitCount = Number(nodeConfig.limitCount || 0);
      return limitCount > 0 ? `保留前 ${limitCount} 条` : "配置限制行数";
    }
    case "union":
      return [
        trimText(nodeConfig.unionMode) === "distinct" ? "自动去重" : "保留重复",
        parseColumnAlignmentRows(nodeConfig.columnMappings).length ? `对齐 ${parseColumnAlignmentRows(nodeConfig.columnMappings).length} 列` : "",
      ]
        .filter(Boolean)
        .join(" / ") || "配置并集字段映射";
    case "join": {
      const joinType = trimText(nodeConfig.joinType) || "left";
      const joinKeys = parseJoinKeyRules(nodeConfig.joinKeys);
      return truncateText(
        `${JOIN_TYPE_OPTIONS.find((item) => item.value === joinType)?.label || joinType}${joinKeys.length ? ` / 关联键 ${joinKeys.length}` : ""}`,
        46
      ) || "配置左右表关联规则";
    }
    case "replace": {
      const fieldName = trimText(nodeConfig.fieldName);
      const replaceRules = parseReplaceRules(nodeConfig.replaceRules);
      return fieldName
        ? truncateText(`${fieldName} / ${replaceRules.length || 0} 组替换`, 46)
        : "配置字段替换规则";
    }
    case "format_convert": {
      const rules = parseFormatConvertRules(nodeConfig.formatRules);
      return rules.length ? truncateText(`转换 ${rules.length} 列`, 46) : "配置格式转换规则";
    }
    case "compliance_check": {
      const rules = parseComplianceRules(nodeConfig.complianceRules);
      return rules.length ? truncateText(`校验 ${rules.length} 列`, 46) : "配置数据校验规则";
    }
    case "string_transform": {
      const rules = parseStringProcessRules(nodeConfig.stringRules);
      return rules.length ? truncateText(`处理 ${rules.length} 列`, 46) : "配置字符处理规则";
    }
    case "desensitize": {
      const rules = parseDesensitizeRules(nodeConfig.desensitizeRules);
      return rules.length ? truncateText(`脱敏 ${rules.length} 列`, 46) : "配置数据脱敏规则";
    }
    case "aggregate": {
      const groupByFields = parseStringArray(nodeConfig.groupByFields);
      const aggregationRules = parseAggregationRules(nodeConfig.aggregations);
      if (groupByFields.length || aggregationRules.length) {
        const summary = [
          groupByFields.length ? `分组 ${groupByFields.join(", ")}` : "",
          aggregationRules.length ? `指标 ${aggregationRules.length} 个` : "",
        ]
          .filter(Boolean)
          .join(" / ");
        return truncateText(summary, 46);
      }
      return "配置聚合逻辑";
    }
    case "branch":
      return truncateText(
        buildConditionSummary(parseConditionRules(nodeConfig.branchRules), nodeConfig.branchLogic) ||
          trimText(nodeConfig.branchCondition || nodeConfig.configText),
        46
      ) || "配置分支条件";
    case "string_aggregate": {
      const aggregateRules = parseStringAggregateRules(nodeConfig.stringAggregateRules);
      return aggregateRules.length ? truncateText(`聚合 ${aggregateRules.length} 列`, 46) : "配置字符串聚合规则";
    }
    case "string_split": {
      const sourceField = trimText(nodeConfig.sourceField);
      const outputField = trimText(nodeConfig.outputField);
      return truncateText(
        sourceField && outputField ? `${sourceField} -> ${outputField}` : "",
        46
      ) || "配置字符串拆分规则";
    }
    case "window_compute": {
      const functionType = trimText(nodeConfig.functionType) || "row_number";
      const outputField = trimText(nodeConfig.outputField);
      return truncateText(`${functionType}${outputField ? ` -> ${outputField}` : ""}`, 46) || "配置窗口函数";
    }
    case "custom_sql":
      return truncateText(
        parseSqlInputBindings(nodeConfig.sqlInputs)
          .map((item) => trimText(item.alias))
          .filter(Boolean)
          .join(", ") || trimText(nodeConfig.sqlText || nodeConfig.configText),
        46
      ) || "编写节点 SQL";
    default:
      return truncateText(nodeConfig.configText, 46) || fallbackSubtitle || "配置待完善";
  }
}

function buildNodeLabel(nodeName: string, operatorCode: string, nodeType: CanvasNodeType, subtitle?: string) {
  const meta = getOperatorMeta(operatorCode, nodeType);
  return (
    <div className="orchestration-node">
      <div className="orchestration-node__badge" style={{ color: meta.color, background: `${meta.color}12` }}>
        {meta.label}
      </div>
      <div className="orchestration-node__content">
        <div className="orchestration-node__title">{nodeName}</div>
        <div className="orchestration-node__meta">{subtitle || "配置待完善"}</div>
      </div>
    </div>
  );
}

function createCanvasNode(payload: {
  nodeType: CanvasNodeType;
  operatorCode: string;
  nodeName: string;
  subtitle?: string;
  nodeConfig?: Record<string, unknown>;
  position: { x: number; y: number };
  layoutDirection?: CanvasLayoutDirection;
  id?: string;
}): Node<OrchestrationNodeData> {
  const nextConfig = payload.nodeConfig || {};
  const subtitle = payload.subtitle || buildDesignerNodeSubtitle(payload.nodeType, payload.operatorCode, nextConfig, payload.subtitle);
  const anchors = buildCanvasNodeAnchors(payload.layoutDirection || "horizontal", payload.nodeType, payload.operatorCode);

  return {
    id: payload.id || `${payload.operatorCode}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: "orchestration",
    position: payload.position,
    data: {
      nodeType: payload.nodeType,
      operatorCode: payload.operatorCode,
      nodeName: payload.nodeName,
      subtitle,
      nodeConfig: nextConfig,
      label: buildNodeLabel(payload.nodeName, payload.operatorCode, payload.nodeType, subtitle),
    },
    style: buildCanvasNodeStyle(payload.operatorCode),
    sourcePosition: anchors.sourcePosition,
    targetPosition: anchors.targetPosition,
  };
}

function createCanvasEdge(payload: {
  source: string;
  target: string;
  sourcePort?: string | null;
  targetPort?: string | null;
  edgeStatus?: OrchestrationEdgeStatus;
  id?: string;
}): Edge<OrchestrationCanvasEdgeData> {
  const edgeStatus = normalizeEdgeStatus(payload.edgeStatus);
  return {
    id: payload.id || `edge_${payload.source}_${payload.sourcePort || "default"}_${payload.target}_${payload.targetPort || "default"}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    source: payload.source,
    target: payload.target,
    sourceHandle: trimText(payload.sourcePort) || undefined,
    targetHandle: trimText(payload.targetPort) || undefined,
    type: "orchestration",
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeStatus === "paused" ? "#b8c3d8" : "#6b8cff" },
    data: {
      sourcePort: trimText(payload.sourcePort) || null,
      targetPort: trimText(payload.targetPort) || null,
      edgeStatus,
    },
  };
}

function createOperatorDefaultConfig(operatorCode: string) {
  switch (operatorCode) {
    case "deduplicate":
      return { dedupeKeys: [], dedupeSortFields: [{ fieldName: "", direction: "DESC" }], keepStrategy: "first" };
    case "select_columns":
      return { selectedColumns: [] };
    case "rename_fields":
      return { renameMappings: [{ sourceField: "", targetField: "" }] };
    case "sort":
      return { sortFields: [{ fieldName: "", direction: "ASC" }] };
    case "limit_rows":
      return { limitCount: 100 };
    case "replace":
      return { fieldName: "", replaceRules: [{ matchValue: "", replaceValue: "" }] };
    case "format_convert":
      return { formatRules: [{ sourceField: "", targetField: "", transformType: "date_to_string", formatPattern: "", targetType: "decimal" }] };
    case "compliance_check":
      return {
        complianceRules: [{
          validationType: "builtin",
          sourceField: "",
          targetField: "",
          checkType: "phone",
          customPattern: "",
          fixedValue: "",
          domainValues: "",
          resultMode: "flag",
          defaultValue: "",
        }],
      };
    case "string_transform":
      return { stringRules: [{ sourceField: "", targetField: "", transformType: "trim", argument1: "", argument2: "" }] };
    case "desensitize":
      return { desensitizeRules: [{ sourceField: "", targetField: "", maskType: "mask", maskChar: "*", prefixLength: 3, suffixLength: 4, truncateLength: 8 }] };
    case "branch":
      return { branchRules: [{ fieldName: "", operator: "eq", value: "" }], branchLogic: "all", branchCondition: "", configText: "" };
    case "join":
      return {
        joinType: "left",
        joinKeys: [{ leftField: "", rightField: "" }],
        leftOutputFields: [],
        rightOutputFields: [],
      };
    case "string_aggregate":
      return {
        groupByFields: [],
        stringAggregateRules: [{ sourceField: "", outputField: "agg_text", separator: ",", distinct: false }],
      };
    case "string_split":
      return {
        sourceField: "",
        outputField: "split_item",
        separator: ",",
        trimItems: true,
        keepEmptyItems: false,
        indexField: "",
      };
    case "aggregate":
      return {
        groupByFields: [],
        aggregations: [{ aggregateFunction: "count", fieldName: "__all__", alias: "count_rows" }],
      };
    case "window_compute":
      return {
        functionType: "row_number",
        sourceField: "",
        outputField: "window_value",
        partitionByFields: [],
        orderByFields: [{ fieldName: "", direction: "ASC" }],
        offset: 1,
        defaultValue: "",
      };
    case "llm":
    case "llm_row":
    case "llm_batch":
      return {
        modelProviderId: undefined,
        modelName: "",
        modelVersion: "",
        systemPrompt: "",
        userPrompt: "",
        promptVariables: [],
        outputFields: getAiDefaultOutputFields(operatorCode),
        outputFieldName: getAiDefaultOutputFields(operatorCode)[0]?.fieldName || getAiFallbackFieldName(operatorCode),
      };
    case "custom_sql":
      return { sqlText: "", sqlInputs: [] };
    case "output_table":
      return { createTargetTable: false, targetTable: "", writeMode: "overwrite", outputFieldMappings: [] };
    case "union":
      return { alignMode: "by_name", unionMode: "all" };
    default:
      return {
        filterRules: [{ ruleType: "condition", fieldName: "", operator: "eq", value: "", valueSource: "literal", referenceFieldRef: "", referenceNodeKey: "", referenceNodeName: "", referenceField: "", customSql: "", checkType: "phone", matchMode: "valid", domainValues: "" }],
        filterLogic: "all",
        filterCondition: "",
      };
  }
}

function buildObjectTree(selectedDatabase: string, tables: DevTableEntry[], functions: DevRoutineEntry[], keyword: string): DataNode[] {
  if (!selectedDatabase) return [];

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredTables = normalizedKeyword
    ? tables.filter((item) => item.name.toLowerCase().includes(normalizedKeyword))
    : tables;
  const filteredFunctions = normalizedKeyword
    ? functions.filter((item) => item.name.toLowerCase().includes(normalizedKeyword))
    : functions;

  const tableTitle = normalizedKeyword ? `表 (${filteredTables.length}/${tables.length})` : `表 (${tables.length})`;
  const functionTitle = normalizedKeyword ? `函数 (${filteredFunctions.length}/${functions.length})` : `函数 (${functions.length})`;

  return [
    {
      key: `group:${selectedDatabase}:tables`,
      title: tableTitle,
      selectable: false,
      children: filteredTables.map((item) => ({ key: `table:${selectedDatabase}:${item.name}`, title: item.name, isLeaf: true })),
    },
    {
      key: `group:${selectedDatabase}:functions`,
      title: functionTitle,
      selectable: false,
      children: filteredFunctions.map((item) => ({ key: `function:${selectedDatabase}:${item.name}`, title: item.name, isLeaf: true })),
    },
  ];
}

function buildColumnCacheKey(datasourceId: number, databaseName: string, tableName: string) {
  return [datasourceId, databaseName, tableName].join("::");
}

function buildDatasourceEnvironmentKey(datasource?: Partial<DevDatasourceRecord> | null) {
  if (!datasource) {
    return "";
  }
  return [
    trimText(datasource.type).toLowerCase(),
    trimText(datasource.host).toLowerCase(),
    Number(datasource.port || 0),
  ].join("::");
}

function getSourceDescriptorFromNode(node: Node<OrchestrationNodeData> | undefined): SourceDescriptor | null {
  if (!node || node.data?.nodeType !== "source") return null;
  const nodeConfig = (node.data?.nodeConfig || {}) as Record<string, unknown>;
  const datasourceId = Number(nodeConfig.datasourceId || 0);
  const databaseName = trimText(nodeConfig.databaseName);
  const tableName = trimText(nodeConfig.tableName);
  if (!datasourceId || !databaseName || !tableName) return null;
  return {
    datasourceId,
    databaseName,
    tableName,
    nodeKey: node.id,
    label: trimText(node.data?.nodeName) || tableName,
  };
}

function collectSourceDescriptors(
  targetNodeId: string,
  nodes: Array<Node<OrchestrationNodeData>>,
  edges: Array<Edge<OrchestrationCanvasEdgeData>>,
  trail = new Set<string>()
): SourceDescriptor[] {
  if (!targetNodeId || trail.has(targetNodeId)) return [] as SourceDescriptor[];
  trail.add(targetNodeId);

  const node = nodes.find((item) => item.id === targetNodeId);
  const sourceDescriptor = getSourceDescriptorFromNode(node);
  if (sourceDescriptor) return [sourceDescriptor];

  return edges
    .filter((item) => item.target === targetNodeId)
    .flatMap((item) => collectSourceDescriptors(item.source, nodes, edges, trail));
}

function mergePreviewColumns(sourceDescriptors: SourceDescriptor[], columnCache: Record<string, DevColumnEntry[]>) {
  const columnMap = new Map<string, DevColumnEntry>();

  for (const item of sourceDescriptors) {
    const cacheKey = buildColumnCacheKey(item.datasourceId, item.databaseName, item.tableName);
    const columns = columnCache[cacheKey] || [];
    for (const column of columns) {
      if (!columnMap.has(column.name)) {
        columnMap.set(column.name, column);
      }
    }
  }

  return Array.from(columnMap.values());
}

function buildFrontendTopologicalOrder(
  nodes: Array<Node<OrchestrationNodeData>>,
  edges: Array<Edge<OrchestrationCanvasEdgeData>>
) {
  const indegree = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();

  edges.forEach((edge) => {
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge.target]);
  });

  const queue = nodes
    .filter((node) => (indegree.get(node.id) || 0) === 0)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .map((node) => node.id);
  const order: string[] = [];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    order.push(current);
    (outgoing.get(current) || []).forEach((targetId) => {
      const nextDegree = (indegree.get(targetId) || 0) - 1;
      indegree.set(targetId, nextDegree);
      if (nextDegree === 0) {
        queue.push(targetId);
      }
    });
  }

  return order.length === nodes.length ? order : nodes.map((node) => node.id);
}

function inferOrchestrationNodeSchemas(
  nodes: Array<Node<OrchestrationNodeData>>,
  edges: Array<Edge<OrchestrationCanvasEdgeData>>,
  columnCache: Record<string, DevColumnEntry[]>
) {
  const activeEdges = edges.filter((edge) => isActiveCanvasEdge(edge));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, Array<Edge<OrchestrationCanvasEdgeData>>>();
  activeEdges.forEach((edge) => {
    incoming.set(edge.target, [...(incoming.get(edge.target) || []), edge]);
  });

  const schemaMap = new Map<string, DevColumnEntry[]>();
  const executionOrder = buildFrontendTopologicalOrder(nodes, activeEdges);

  executionOrder.forEach((nodeId) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const nodeType = node.data.nodeType;
    const operatorCode = trimText(node.data.operatorCode);
    const nodeConfig = (node.data.nodeConfig || {}) as Record<string, unknown>;
    const upstreamSchemaEntries = (incoming.get(nodeId) || [])
      .map((edge) => ({
        nodeKey: edge.source,
        columns: schemaMap.get(edge.source) || [],
      }))
      .filter((item) => item.columns.length);
    const upstreamSchemas = upstreamSchemaEntries
      .map((item) => item.columns)
      .filter((columns) => columns.length);

    if (nodeType === "source") {
      const datasourceId = Number(nodeConfig.datasourceId || 0);
      const databaseName = trimText(nodeConfig.databaseName);
      const tableName = trimText(nodeConfig.tableName);
      const cacheKey = buildColumnCacheKey(datasourceId, databaseName, tableName);
      const rawColumns = (columnCache[cacheKey] || []).map((column, index) => createVirtualColumn(column.name, index, column));
      const selectedColumns = parseStringArray(nodeConfig.selectedColumns);
      if (selectedColumns.length) {
        const columnMap = getColumnMap(rawColumns);
        schemaMap.set(
          nodeId,
          selectedColumns.map((fieldName, index) => createVirtualColumn(fieldName, index, columnMap.get(fieldName)))
        );
      } else {
        schemaMap.set(nodeId, rawColumns);
      }
      return;
    }

    const primaryInput = upstreamSchemaEntries.find((item) => item.nodeKey === trimText(nodeConfig.schemaSourceNodeKey))?.columns
      || upstreamSchemas[0]
      || [];
    if (!primaryInput.length && !["union", "join"].includes(operatorCode)) {
      schemaMap.set(nodeId, []);
      return;
    }

    switch (operatorCode) {
      case "filter":
      case "deduplicate":
      case "sort":
      case "limit_rows":
      case "branch":
        schemaMap.set(nodeId, primaryInput.map((column, index) => createVirtualColumn(column.name, index, column)));
        return;
      case "output_table": {
        const mappings = mergeOutputFieldMappings(parseOutputFieldMappings(nodeConfig.outputFieldMappings), primaryInput);
        if (mappings.length) {
          const inputMap = getColumnMap(primaryInput);
          schemaMap.set(
            nodeId,
            mappings.map((item, index) =>
              createVirtualColumn(
                trimText(item.targetField) || trimText(item.sourceField) || `field_${index + 1}`,
                index,
                inputMap.get(trimText(item.sourceField))
                  ? {
                      ...inputMap.get(trimText(item.sourceField)),
                      name: trimText(item.targetField) || trimText(item.sourceField) || `field_${index + 1}`,
                    }
                  : undefined
              )
            )
          );
          return;
        }
        schemaMap.set(nodeId, primaryInput.map((column, index) => createVirtualColumn(column.name, index, column)));
        return;
      }
      case "select_columns": {
        const inputMap = getColumnMap(primaryInput);
        const selectedColumns = parseStringArray(nodeConfig.selectedColumns);
        schemaMap.set(
          nodeId,
          (selectedColumns.length ? selectedColumns : primaryInput.map((column) => column.name)).map((fieldName, index) =>
            createVirtualColumn(fieldName, index, inputMap.get(fieldName))
          )
        );
        return;
      }
      case "rename_fields": {
        const renameMap = new Map(parseRenameMappings(nodeConfig.renameMappings).map((item) => [item.sourceField, item.targetField]));
        schemaMap.set(
          nodeId,
          primaryInput.map((column, index) =>
            createVirtualColumn(renameMap.get(column.name) || column.name, index, {
              ...column,
              name: renameMap.get(column.name) || column.name,
            })
          )
        );
        return;
      }
      case "aggregate": {
        const groupByFields = parseStringArray(nodeConfig.groupByFields);
        const inputMap = getColumnMap(primaryInput);
        const aggregated = groupByFields.map((fieldName, index) => createVirtualColumn(fieldName, index, inputMap.get(fieldName)));
        const rules = parseAggregationRules(nodeConfig.aggregations);
        rules.forEach((rule, index) => {
          const alias = trimText(rule.alias) || `${trimText(rule.aggregateFunction || "count")}_${trimText(rule.fieldName || "rows")}`;
          aggregated.push(createVirtualColumn(alias, groupByFields.length + index));
        });
        schemaMap.set(nodeId, aggregated);
        return;
      }
      case "union": {
        const mappings = parseColumnAlignmentRows(nodeConfig.columnMappings);
        if (mappings.length) {
          schemaMap.set(
            nodeId,
            mappings.map((row, index) => createVirtualColumn(trimText(row.outputField) || `field_${index + 1}`, index))
          );
          return;
        }
        const mergedNames: string[] = [];
        const seen = new Set<string>();
        upstreamSchemas.forEach((columns) => {
          columns.forEach((column) => {
            if (column.name && !seen.has(column.name)) {
              seen.add(column.name);
              mergedNames.push(column.name);
            }
          });
        });
        const fallbackMap = getColumnMap(primaryInput);
        schemaMap.set(
          nodeId,
          mergedNames.map((fieldName, index) => createVirtualColumn(fieldName, index, fallbackMap.get(fieldName)))
        );
        return;
      }
      case "join": {
        const leftColumns = upstreamSchemas[0] || [];
        const rightColumns = upstreamSchemas[1] || [];
        schemaMap.set(
          nodeId,
          buildJoinSchemaColumns(
            leftColumns,
            rightColumns,
            parseStringArray(nodeConfig.leftOutputFields),
            parseStringArray(nodeConfig.rightOutputFields)
          )
        );
        return;
      }
      case "format_convert": {
        schemaMap.set(nodeId, mergeSchemaWithDerivedFields(primaryInput, parseFormatConvertRules(nodeConfig.formatRules)));
        return;
      }
      case "compliance_check": {
        schemaMap.set(nodeId, mergeSchemaWithDerivedFields(primaryInput, parseComplianceRules(nodeConfig.complianceRules)));
        return;
      }
      case "string_transform": {
        schemaMap.set(nodeId, mergeSchemaWithDerivedFields(primaryInput, parseStringProcessRules(nodeConfig.stringRules)));
        return;
      }
      case "desensitize": {
        schemaMap.set(nodeId, mergeSchemaWithDerivedFields(primaryInput, parseDesensitizeRules(nodeConfig.desensitizeRules)));
        return;
      }
      case "string_aggregate": {
        const groupByFields = parseStringArray(nodeConfig.groupByFields);
        const inputMap = getColumnMap(primaryInput);
        const aggregateColumns = groupByFields.map((fieldName, index) => createVirtualColumn(fieldName, index, inputMap.get(fieldName)));
        parseStringAggregateRules(nodeConfig.stringAggregateRules).forEach((item, index) => {
          const outputField = trimText(item.outputField) || `agg_text_${index + 1}`;
          aggregateColumns.push(createVirtualColumn(outputField, aggregateColumns.length, { name: outputField, dataType: "string", columnType: "string" }));
        });
        schemaMap.set(nodeId, aggregateColumns);
        return;
      }
      case "string_split": {
        const sourceField = trimText(nodeConfig.sourceField);
        const outputField = trimText(nodeConfig.outputField) || "split_item";
        const indexField = trimText(nodeConfig.indexField);
        const splitColumns: DevColumnEntry[] = [];
        primaryInput.forEach((column, index) => {
          if (column.name === sourceField) {
            splitColumns.push(createVirtualColumn(outputField, index, { ...column, name: outputField, dataType: "string", columnType: "string" }));
            return;
          }
          splitColumns.push(createVirtualColumn(column.name, splitColumns.length, column));
        });
        if (!splitColumns.some((column) => column.name === outputField)) {
          splitColumns.push(createVirtualColumn(outputField, splitColumns.length, { name: outputField, dataType: "string", columnType: "string" }));
        }
        if (indexField) {
          splitColumns.push(createVirtualColumn(indexField, splitColumns.length, { name: indexField, dataType: "integer", columnType: "integer" }));
        }
        schemaMap.set(nodeId, splitColumns);
        return;
      }
      case "window_compute": {
        schemaMap.set(
          nodeId,
          mergeSchemaWithDerivedFields(primaryInput, [{
            sourceField: trimText(nodeConfig.sourceField),
            targetField: trimText(nodeConfig.outputField) || "window_value",
          }])
        );
        return;
      }
      case "llm":
      case "llm_row":
      case "llm_batch": {
        const normalizedAiOperatorCode = normalizeAiOperatorCode(operatorCode);
        const outputFields = parseAiOutputFieldMappings(
          nodeConfig.outputFields,
          getAiFallbackFieldName(normalizedAiOperatorCode),
          nodeConfig.outputFieldName
        );
        const outputColumns = outputFields.map((field, index) =>
          createVirtualColumn(
            trimText(field.fieldName) || `field_${index + 1}`,
            (normalizedAiOperatorCode === "llm_batch" ? 0 : primaryInput.length) + index
          )
        );
        schemaMap.set(
          nodeId,
          normalizedAiOperatorCode === "llm_batch"
            ? outputColumns
            : primaryInput
              .map((column, index) => createVirtualColumn(column.name, index, column))
              .concat(outputColumns)
        );
        return;
      }
      case "custom_sql": {
        const sqlBindings = parseSqlInputBindings(nodeConfig.sqlInputs);
        const sourceSchemaByAlias = upstreamSchemaEntries.reduce<Record<string, DevColumnEntry[]>>((result, entry, index) => {
          const binding = sqlBindings.find((item) => item.sourceNodeKey === entry.nodeKey);
          const alias = trimText(binding?.alias) || buildDefaultSqlInputAlias(entry.nodeKey, index);
          result[alias] = entry.columns;
          result[`input_${index + 1}`] = entry.columns;
          if (index === 0) {
            result.input_data = entry.columns;
          }
          return result;
        }, {});
        const inferredColumns = inferCustomSqlSchemaColumns(
          readRawText(nodeConfig.sqlText || nodeConfig.configText),
          sourceSchemaByAlias
        );
        if (inferredColumns.length) {
          schemaMap.set(nodeId, inferredColumns);
          return;
        }

        const mergedNames: string[] = [];
        const seen = new Set<string>();
        upstreamSchemaEntries.forEach((entry) => {
          entry.columns.forEach((column) => {
            if (column.name && !seen.has(column.name)) {
              seen.add(column.name);
              mergedNames.push(column.name);
            }
          });
        });
        schemaMap.set(
          nodeId,
          mergedNames.map((fieldName, index) => createVirtualColumn(fieldName, index))
        );
        return;
      }
      default:
        schemaMap.set(nodeId, primaryInput.map((column, index) => createVirtualColumn(column.name, index, column)));
    }
  });

  return Object.fromEntries(Array.from(schemaMap.entries()));
}

function buildAutoLayoutPositions(
  nodes: Array<Node<OrchestrationNodeData>>,
  edges: Array<Edge<OrchestrationCanvasEdgeData>>,
  direction: "horizontal" | "vertical"
) {
  const activeEdges = edges.filter((edge) => isActiveCanvasEdge(edge));
  const order = buildFrontendTopologicalOrder(nodes, activeEdges);
  const incoming = new Map<string, string[]>();
  activeEdges.forEach((edge) => {
    incoming.set(edge.target, [...(incoming.get(edge.target) || []), edge.source]);
  });

  const layerMap = new Map<string, number>();
  order.forEach((nodeId) => {
    const parentLayers = (incoming.get(nodeId) || []).map((sourceId) => layerMap.get(sourceId) || 0);
    layerMap.set(nodeId, parentLayers.length ? Math.max(...parentLayers) + 1 : 0);
  });

  const groups = new Map<number, Array<Node<OrchestrationNodeData>>>();
  nodes.forEach((node) => {
    const layer = layerMap.get(node.id) || 0;
    groups.set(layer, [...(groups.get(layer) || []), node]);
  });

  const positions = new Map<string, { x: number; y: number }>();
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  const blockMetrics = new Map<number, number>();
  sortedGroups.forEach(([, layerNodes], layerIndex) => {
    const blockIndex = Math.floor(layerIndex / ORCHESTRATION_LAYOUT_WRAP_LIMIT);
    blockMetrics.set(blockIndex, Math.max(blockMetrics.get(blockIndex) || 0, layerNodes.length));
  });

  sortedGroups.forEach(([layer, layerNodes], layerIndex) => {
      const blockIndex = Math.floor(layerIndex / ORCHESTRATION_LAYOUT_WRAP_LIMIT);
      const localLayerIndex = layerIndex % ORCHESTRATION_LAYOUT_WRAP_LIMIT;
      const previousBlockOffset = Array.from(blockMetrics.entries())
        .filter(([index]) => index < blockIndex)
        .reduce((sum, [, size]) => sum + size, 0);
      const sortedNodes = layerNodes.sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
      sortedNodes.forEach((node, index) => {
        const x = direction === "horizontal"
          ? ORCHESTRATION_LAYOUT_START_X + localLayerIndex * ORCHESTRATION_LAYOUT_HORIZONTAL_GAP
          : ORCHESTRATION_LAYOUT_START_X + (index + previousBlockOffset) * ORCHESTRATION_LAYOUT_HORIZONTAL_GAP;
        const y = direction === "horizontal"
          ? ORCHESTRATION_LAYOUT_START_Y + (index + previousBlockOffset) * ORCHESTRATION_LAYOUT_VERTICAL_GAP
          : ORCHESTRATION_LAYOUT_START_Y + localLayerIndex * ORCHESTRATION_LAYOUT_VERTICAL_GAP;
        positions.set(node.id, { x, y });
      });
    });

  return positions;
}

interface OrchestrationDesignerProps {
  token: string;
  datasources: DevDatasourceRecord[];
  task: DevOrchestrationTaskRecord;
  onRefresh: () => Promise<void>;
  onBackToList: () => void;
}

export function OrchestrationDesigner({ token, datasources, task, onRefresh, onBackToList }: OrchestrationDesignerProps) {
  const [nodes, setNodes] = useState<Array<Node<OrchestrationNodeData>>>([]);
  const [edges, setEdges] = useState<Array<Edge<OrchestrationCanvasEdgeData>>>([]);
  const [canvasLayoutDirection, setCanvasLayoutDirection] = useState<CanvasLayoutDirection>("horizontal");
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedDatasourceId, setSelectedDatasourceId] = useState<number | undefined>(task.datasourceId || undefined);
  const [selectedDatabase, setSelectedDatabase] = useState(task.databaseName || "");
  const [objectKeyword, setObjectKeyword] = useState("");
  const [databases, setDatabases] = useState<DevDatabaseEntry[]>([]);
  const [tables, setTables] = useState<DevTableEntry[]>([]);
  const [functions, setFunctions] = useState<DevRoutineEntry[]>([]);
  const [columnCache, setColumnCache] = useState<Record<string, DevColumnEntry[]>>({});
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [canvasMarquee, setCanvasMarquee] = useState<CanvasMarqueeState | null>(null);
  const [canvasExpanded, setCanvasExpanded] = useState(false);
  const [nodeDrawerOpen, setNodeDrawerOpen] = useState(false);
  const [nodeDrawerWidth, setNodeDrawerWidth] = useState(ORCHESTRATION_DRAWER_DEFAULT_WIDTH);
  const [drawerResizing, setDrawerResizing] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [sqlPreviewOpen, setSqlPreviewOpen] = useState(false);
  const [sqlPreviewLoading, setSqlPreviewLoading] = useState(false);
  const [orchestrationRunning, setOrchestrationRunning] = useState(false);
  const [sqlPreview, setSqlPreview] = useState<DevOrchestrationSqlPreview | null>(null);
  const [nodePreviewLoading, setNodePreviewLoading] = useState(false);
  const [nodePreview, setNodePreview] = useState<DevOrchestrationNodePreview | null>(null);
  const [upstreamReferenceLoading, setUpstreamReferenceLoading] = useState(false);
  const [upstreamReferencePreview, setUpstreamReferencePreview] = useState<DevOrchestrationNodePreview | null>(null);
  const [upstreamReferenceOpen, setUpstreamReferenceOpen] = useState<string[]>([]);
  const [outputTargetColumns, setOutputTargetColumns] = useState<DevColumnEntry[]>([]);
  const [outputTargetColumnsLoading, setOutputTargetColumnsLoading] = useState(false);
  const [modelProviders, setModelProviders] = useState<ModelProviderRecord[]>([]);
  const [modelProvidersLoading, setModelProvidersLoading] = useState(false);
  const [activePromptField, setActivePromptField] = useState<"systemPrompt" | "userPrompt">("userPrompt");
  const [promptVariableMenu, setPromptVariableMenu] = useState<PromptVariableMenuState | null>(null);
  const [nodeForm] = Form.useForm();
  const [scheduleForm] = Form.useForm();
  const sidebarResizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const drawerResizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const canvasMarqueeStateRef = useRef<CanvasMarqueeState | null>(null);
  const outputMappingSeedRef = useRef("");
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const nodesRef = useRef(nodes);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const promptInputRef = useRef<Record<"systemPrompt" | "userPrompt", HTMLTextAreaElement | null>>({
    systemPrompt: null,
    userPrompt: null,
  });
  const watchedSchemaSourceNodeKey = Form.useWatch("schemaSourceNodeKey", nodeForm);
  const scheduleType = Form.useWatch("scheduleType", scheduleForm) || "manual";
  const watchedModelProviderId = Form.useWatch("modelProviderId", nodeForm);
  const watchedModelName = Form.useWatch("modelName", nodeForm);
  const watchedPromptVariables = Form.useWatch("promptVariables", nodeForm);
  const watchedCreateTargetTable = Boolean(Form.useWatch("createTargetTable", nodeForm));
  const watchedOutputTargetTable = trimText(Form.useWatch("targetTable", nodeForm));

  nodesRef.current = nodes;

  const selectedNode = useMemo(() => nodes.find((item) => item.id === selectedNodeId), [nodes, selectedNodeId]);
  const sourceDatasourceEnvironmentKey = useMemo(() => {
    const signatures = new Set(
      nodes
        .filter((item) => item.data?.nodeType === "source")
        .map((item) => {
          const datasourceId = Number(item.data?.nodeConfig?.datasourceId || 0);
          return buildDatasourceEnvironmentKey(datasources.find((datasource) => datasource.id === datasourceId));
        })
        .filter(Boolean)
    );
    return signatures.size === 1 ? Array.from(signatures)[0] : "";
  }, [datasources, nodes]);
  const activeEdges = useMemo(() => edges.filter((item) => isActiveCanvasEdge(item)), [edges]);
  const showSidebar = sidebarVisible;
  const selectedEdgeIds = useMemo(() => edges.filter((item) => Boolean((item as Edge).selected)).map((item) => item.id), [edges]);
  const objectTreeData = useMemo(
    () => buildObjectTree(selectedDatabase, tables, functions, objectKeyword),
    [functions, objectKeyword, selectedDatabase, tables]
  );
  const incomingEdges = useMemo(
    () => (selectedNode ? activeEdges.filter((item) => item.target === selectedNode.id) : []),
    [activeEdges, selectedNode]
  );
  const upstreamNodes = useMemo(
    () => incomingEdges.map((item) => nodes.find((node) => node.id === item.source)).filter(Boolean) as Array<Node<OrchestrationNodeData>>,
    [incomingEdges, nodes]
  );
  const schemaSourceOptions = useMemo(
    () =>
      upstreamNodes.map((item) => ({
        value: item.id,
        label: `${trimText(item.data?.nodeName) || item.id} / ${getOperatorMeta(String(item.data?.operatorCode || ""), item.data?.nodeType as CanvasNodeType).label}`,
      })),
    [upstreamNodes]
  );
  const previewTargetNodeId = selectedNode?.data?.nodeType === "source"
    ? selectedNode.id
    : ["custom_sql", "union", "join"].includes(trimText(selectedNode?.data?.operatorCode))
      ? String(selectedNode?.id || "")
      : String(watchedSchemaSourceNodeKey || selectedNode?.data?.nodeConfig?.schemaSourceNodeKey || upstreamNodes[0]?.id || "");
  const previewSourceDescriptors = useMemo(
    () => (previewTargetNodeId ? collectSourceDescriptors(previewTargetNodeId, nodes, activeEdges) : []),
    [activeEdges, nodes, previewTargetNodeId]
  );
  const selectedSourceDescriptor = useMemo(() => getSourceDescriptorFromNode(selectedNode), [selectedNode]);
  const nodeSchemaMap = useMemo(
    () => inferOrchestrationNodeSchemas(nodes, edges, columnCache),
    [columnCache, edges, nodes]
  );
  const previewColumns = useMemo(() => {
    if (previewTargetNodeId && nodeSchemaMap[previewTargetNodeId]?.length) {
      return nodeSchemaMap[previewTargetNodeId];
    }
    return mergePreviewColumns(previewSourceDescriptors, columnCache);
  }, [columnCache, nodeSchemaMap, previewSourceDescriptors, previewTargetNodeId]);
  const sourceAvailableColumns = useMemo(() => {
    if (!selectedSourceDescriptor) {
      return [] as DevColumnEntry[];
    }
    const cacheKey = buildColumnCacheKey(
      selectedSourceDescriptor.datasourceId,
      selectedSourceDescriptor.databaseName,
      selectedSourceDescriptor.tableName
    );
    return columnCache[cacheKey] || [];
  }, [columnCache, selectedSourceDescriptor]);
  const selectedSourceTable = useMemo(() => {
    const tableName = trimText(selectedNode?.data?.nodeConfig?.tableName);
    return tables.find((item) => item.name === tableName) || null;
  }, [selectedNode?.data?.nodeConfig?.tableName, tables]);
  const sourceAvailableColumnOptions = useMemo(
    () => buildFieldSelectOptions(sourceAvailableColumns),
    [sourceAvailableColumns]
  );
  const previewColumnOptions = useMemo(
    () => buildFieldSelectOptions(previewColumns),
    [previewColumns]
  );
  const outputTargetColumnOptions = useMemo(
    () => buildFieldSelectOptions(outputTargetColumns),
    [outputTargetColumns]
  );
  const outputFieldMappingDefaults = useMemo(
    () => mergeOutputFieldMappings(parseOutputFieldMappings(selectedNode?.data?.nodeConfig?.outputFieldMappings), previewColumns, outputTargetColumns),
    [outputTargetColumns, previewColumns, selectedNode?.data?.nodeConfig?.outputFieldMappings]
  );
  const aggregateFieldOptions = useMemo(
    () => [buildSyntheticFieldOption("__all__", "全部行(*)"), ...previewColumnOptions],
    [previewColumnOptions]
  );
  const activeChatModelProviders = useMemo(
    () => modelProviders.filter((item) => item.status === "active" && item.modelCategory === "chat"),
    [modelProviders]
  );
  const selectedModelProvider = useMemo(
    () => activeChatModelProviders.find((item) => item.id === Number(watchedModelProviderId || selectedNode?.data?.nodeConfig?.modelProviderId || 0)) || null,
    [activeChatModelProviders, selectedNode?.data?.nodeConfig?.modelProviderId, watchedModelProviderId]
  );
  const llmModelCatalog = useMemo(
    () => buildFallbackCatalog(selectedModelProvider),
    [selectedModelProvider]
  );
  const llmModelNameOptions = useMemo(
    () => getModelNameOptions(llmModelCatalog),
    [llmModelCatalog]
  );
  const llmModelVersionOptions = useMemo(
    () => getModelVersionOptions(llmModelCatalog, trimText(watchedModelName) || trimText(selectedModelProvider?.modelName)),
    [llmModelCatalog, selectedModelProvider?.modelName, watchedModelName]
  );
  const llmVersionSelectionRedundant = useMemo(
    () => isVersionSelectionRedundant(trimText(watchedModelName) || trimText(selectedModelProvider?.modelName), llmModelVersionOptions),
    [llmModelVersionOptions, selectedModelProvider?.modelName, watchedModelName]
  );
  const aiPromptVariableRules = useMemo(
    () => parsePromptVariableMappings(watchedPromptVariables),
    [watchedPromptVariables]
  );
  const aiPromptVariableHints = useMemo(() => {
    const items: PromptVariableHint[] = [];
    const seen = new Set<string>();
    const selectedAiOperatorCode = selectedNode && isAiOperatorCode(String(selectedNode.data?.operatorCode || ""))
      ? normalizeAiOperatorCode(String(selectedNode.data?.operatorCode || ""))
      : "";
    const pushItem = (rule: PromptVariableMapping) => {
      const name = trimText(rule.variableName);
      const summary = buildPromptVariableRuleSummary(rule, selectedAiOperatorCode);
      const normalized = trimText(name);
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      items.push({
        name: normalized,
        label: normalized,
        summary,
      });
    };

    aiPromptVariableRules.forEach((item) => pushItem(item));
    return items;
  }, [aiPromptVariableRules, selectedNode]);
  const aiPromptVariableNames = useMemo(
    () => aiPromptVariableHints.map((item) => item.name),
    [aiPromptVariableHints]
  );
  const operatorLibraryGroups = useMemo(
    () =>
      ORCHESTRATION_OPERATOR_CATEGORIES.map((category) => ({
        ...category,
        items: ORCHESTRATION_OPERATOR_LIBRARY_ITEMS.filter((item) => item.category === category.key),
      })).filter((category) => category.items.length),
    []
  );
  const canvasMarqueeStyle = useMemo(() => {
    if (!canvasMarquee || !canvasRef.current) {
      return undefined;
    }
    const bounds = canvasRef.current.getBoundingClientRect();
    const left = Math.min(canvasMarquee.startClientX, canvasMarquee.currentClientX) - bounds.left;
    const top = Math.min(canvasMarquee.startClientY, canvasMarquee.currentClientY) - bounds.top;
    return {
      left,
      top,
      width: Math.abs(canvasMarquee.currentClientX - canvasMarquee.startClientX),
      height: Math.abs(canvasMarquee.currentClientY - canvasMarquee.startClientY),
    } satisfies CSSProperties;
  }, [canvasMarquee]);
  const applyCanvasMarqueeSelection = useCallback((marquee: CanvasMarqueeState) => {
    const flow = reactFlowInstanceRef.current;
    if (!flow) {
      return;
    }
    const start = flow.screenToFlowPosition({ x: marquee.startClientX, y: marquee.startClientY });
    const end = flow.screenToFlowPosition({ x: marquee.currentClientX, y: marquee.currentClientY });
    const rect = {
      left: Math.min(start.x, end.x),
      right: Math.max(start.x, end.x),
      top: Math.min(start.y, end.y),
      bottom: Math.max(start.y, end.y),
    };
    const nextSelectedNodeIds = nodes.filter((node) => isNodeIntersectingRect(node, rect)).map((node) => node.id);
    if (nextSelectedNodeIds.length === 1) {
      setSelectedNodeId(nextSelectedNodeIds[0]);
    } else {
      setSelectedNodeId(undefined);
      setNodeDrawerOpen(false);
    }
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: isNodeIntersectingRect(node, rect),
      }))
    );
    setEdges((current) =>
      current.map((edge) => ({
        ...edge,
        selected: false,
      }))
    );
  }, [nodes]);
  const stopCanvasMarqueeSelection = useCallback((event?: MouseEvent) => {
    const marquee = canvasMarqueeStateRef.current;
    if (!marquee) {
      return;
    }
    const finished = event
      ? {
          ...marquee,
          currentClientX: event.clientX,
          currentClientY: event.clientY,
        }
      : marquee;
    const deltaX = Math.abs(finished.currentClientX - finished.startClientX);
    const deltaY = Math.abs(finished.currentClientY - finished.startClientY);
    if (deltaX >= 6 || deltaY >= 6) {
      applyCanvasMarqueeSelection(finished);
    }
    canvasMarqueeStateRef.current = null;
    setCanvasMarquee(null);
  }, [applyCanvasMarqueeSelection]);
  const handleCanvasMarqueeMouseMove = useCallback((event: MouseEvent) => {
    const marquee = canvasMarqueeStateRef.current;
    if (!marquee) {
      return;
    }
    const next = {
      ...marquee,
      currentClientX: event.clientX,
      currentClientY: event.clientY,
    };
    canvasMarqueeStateRef.current = next;
    setCanvasMarquee(next);
  }, []);
  const handleCanvasMarqueeMouseUp = useCallback((event: MouseEvent) => {
    if (event.button !== 2 && canvasMarqueeStateRef.current) {
      stopCanvasMarqueeSelection(event);
      return;
    }
    if (event.button === 2) {
      stopCanvasMarqueeSelection(event);
    }
  }, [stopCanvasMarqueeSelection]);
  const handleCanvasMouseDownCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 2) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target?.closest(".react-flow__pane")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const next = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      currentClientX: event.clientX,
      currentClientY: event.clientY,
    };
    canvasMarqueeStateRef.current = next;
    setCanvasMarquee(next);
  }, []);
  const handleSelectionChange = useCallback(({ nodes: currentNodes, edges: currentEdges }: { nodes: Array<Node<OrchestrationNodeData>>; edges: Array<Edge<OrchestrationCanvasEdgeData>> }) => {
    const currentSelectedNodeIds = currentNodes.map((item) => item.id);
    setSelectedNodeIds(currentSelectedNodeIds);
    if (currentSelectedNodeIds.length === 1) {
      setSelectedNodeId(currentSelectedNodeIds[0]);
    } else if (currentSelectedNodeIds.length > 1) {
      setSelectedNodeId(undefined);
      setNodeDrawerOpen(false);
    } else if (!currentEdges.length) {
      setSelectedNodeId(undefined);
    }
  }, []);
  const handleReactFlowInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstanceRef.current = instance;
  }, []);
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);
  const handleConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;
    const sourceId = String(params.source);
    const targetId = String(params.target);
    if (sourceId === targetId) {
      message.warning("节点不能连接自身");
      return;
    }

    const currentNodes = nodesRef.current;
    const sourceNode = currentNodes.find((item) => item.id === sourceId);
    const targetNode = currentNodes.find((item) => item.id === targetId);
    if (sourceNode?.data?.nodeType === "output") {
      message.warning("数据输出节点不能继续作为上游节点");
      return;
    }
    if (targetNode?.data?.nodeType === "source") {
      message.warning("数据输入节点不能作为下游目标");
      return;
    }

    const sourcePort = trimText(params.sourceHandle);
    const targetPort = trimText(params.targetHandle);
    setEdges((current) => {
      if (
        current.some(
          (item) =>
            item.source === sourceId &&
            item.target === targetId &&
            trimText(item.data?.sourcePort || item.sourceHandle) === sourcePort &&
            trimText(item.data?.targetPort || item.targetHandle) === targetPort
        )
      ) {
        message.warning("相同连线已存在");
        return current;
      }
      return current.concat(
        createCanvasEdge({
          source: sourceId,
          target: targetId,
          sourcePort: params.sourceHandle || null,
          targetPort: params.targetHandle || null,
          edgeStatus: "active",
        })
      );
    });
  }, []);
  const handleNodeClick = useCallback((_: ReactMouseEvent, node: Node<OrchestrationNodeData>) => {
    setSelectedNodeId(node.id);
    setNodeDrawerOpen(true);
  }, []);
  useEffect(() => {
    if (!canvasMarquee) {
      return;
    }
    const preventWindowContextMenu = (event: MouseEvent) => {
      if (canvasMarqueeStateRef.current) {
        event.preventDefault();
      }
    };
    window.addEventListener("mousemove", handleCanvasMarqueeMouseMove);
    window.addEventListener("mouseup", handleCanvasMarqueeMouseUp);
    window.addEventListener("contextmenu", preventWindowContextMenu);
    return () => {
      window.removeEventListener("mousemove", handleCanvasMarqueeMouseMove);
      window.removeEventListener("mouseup", handleCanvasMarqueeMouseUp);
      window.removeEventListener("contextmenu", preventWindowContextMenu);
    };
  }, [canvasMarquee, handleCanvasMarqueeMouseMove, handleCanvasMarqueeMouseUp]);
  useEffect(() => {
    setPromptVariableMenu(null);
  }, [selectedNodeId]);
  const nodeTypes = useMemo(
    () => ({
      orchestration: (props: NodeProps<OrchestrationNodeData>) => (
        <OrchestrationNodeView {...props} layoutDirection={canvasLayoutDirection} />
      ),
    }),
    [canvasLayoutDirection]
  );
  const edgeTypes = useMemo(
    () => ({
      orchestration: (props: EdgeProps<OrchestrationCanvasEdgeData>) => (
        <OrchestrationEdgeView {...props} onTogglePause={toggleEdgePaused} />
      ),
    }),
    []
  );
  const upstreamNodeColumnsMap = useMemo(
    () =>
      Object.fromEntries(
        upstreamNodes.map((node) => [node.id, nodeSchemaMap[node.id] || []])
      ),
    [nodeSchemaMap, upstreamNodes]
  );
  const upstreamNodeColumnOptionsMap = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(upstreamNodeColumnsMap).map(([nodeId, columns]) => [nodeId, buildFieldSelectOptions(columns)])
      ),
    [upstreamNodeColumnsMap]
  );
  const upstreamReferenceFieldOptions = useMemo(
    () => upstreamNodes.flatMap((node) => {
      const nodeName = trimText(node.data?.nodeName) || node.id;
      return (upstreamNodeColumnOptionsMap[node.id] || []).map((option) => ({
        ...option,
        value: `${node.id}::${option.value}`,
        label: `${nodeName} / ${option.label}`,
        searchText: `${nodeName} ${option.searchText}`,
        sourceNodeName: nodeName,
      }));
    }),
    [upstreamNodeColumnOptionsMap, upstreamNodes]
  );
  const previewColumnMetaMap = useMemo(
    () =>
      Object.fromEntries(
        previewColumns.map((column) => [column.name, column])
      ) as Record<string, DevColumnEntry>,
    [previewColumns]
  );
  const upstreamFieldSampleMap = useMemo(
    () =>
      Object.fromEntries(
        previewColumns.map((column) => {
          const samples = (upstreamReferencePreview?.rows || [])
            .slice(0, 3)
            .map((row) => formatPreviewCellValue(row?.[column.name], previewColumnMetaMap[column.name]))
            .filter((value) => value && value !== "-");
          return [column.name, samples];
        })
      ) as Record<string, string[]>,
    [previewColumnMetaMap, previewColumns, upstreamReferencePreview?.rows]
  );
  const nodePreviewTableColumns = useMemo(
    () => buildPreviewResultColumns(nodePreview?.fields || [], previewColumnMetaMap),
    [nodePreview?.fields, previewColumnMetaMap]
  );
  const datasourceSelectOptions = useMemo(
    () =>
      datasources.map((item) => {
        const signature = buildDatasourceEnvironmentKey(item);
        const disabled = Boolean(sourceDatasourceEnvironmentKey && signature && signature !== sourceDatasourceEnvironmentKey);
        return {
          value: item.id,
          label: `${item.name} (${item.type})`,
          disabled,
        };
      }),
    [datasources, sourceDatasourceEnvironmentKey]
  );

  useEffect(() => {
    setNodes(
      (task.nodes || []).map((item) =>
        createCanvasNode({
          id: item.nodeKey,
          nodeType: item.nodeType,
          operatorCode: item.operatorCode,
          nodeName: item.nodeName,
          nodeConfig: item.nodeConfig || {},
          position: { x: item.positionX, y: item.positionY },
        })
      )
    );
    setEdges(
      (task.edges || []).map((item, index) => ({
        ...createCanvasEdge({
          id: `edge_${index}_${item.sourceNodeKey}_${item.targetNodeKey}_${item.sourcePort || "default"}_${item.targetPort || "default"}`,
          source: item.sourceNodeKey,
          target: item.targetNodeKey,
          sourcePort: item.sourcePort,
          targetPort: item.targetPort,
          edgeStatus: item.edgeStatus,
        }),
      }))
    );
    setSelectedDatasourceId(task.datasourceId || undefined);
    setSelectedDatabase(task.databaseName || "");
    const parsedSchedule = parseCronToOrchestrationSchedule(task.cronExpr);
    scheduleForm.setFieldsValue({
      scheduleType: parsedSchedule.scheduleType || "manual",
      intervalMinutes: parsedSchedule.intervalMinutes || 5,
      runTime: parsedSchedule.runTime || "02:00",
      weekDays: parsedSchedule.weekDays,
      monthDay: parsedSchedule.monthDay,
      cronExpr: parsedSchedule.cronExpr || task.cronExpr || "",
      isPaused: parsedSchedule.scheduleType === "manual" ? true : task.isPaused,
      retryTimes: task.retryTimes,
      timeoutSec: task.timeoutSec,
    });
  }, [scheduleForm, task]);

  useEffect(() => {
    async function loadObjects() {
      if (!selectedDatasourceId) {
        setDatabases([]);
        setTables([]);
        setFunctions([]);
        return;
      }

      const databaseRes = await fetchDevDatabases(token, selectedDatasourceId);
      setDatabases(databaseRes.data);
      const nextDatabase = selectedDatabase || databaseRes.data[0]?.name || "";
      if (!selectedDatabase && nextDatabase) {
        setSelectedDatabase(nextDatabase);
        return;
      }

      if (!nextDatabase) {
        setTables([]);
        setFunctions([]);
        return;
      }

      const [tableRes, functionRes] = await Promise.all([
        fetchDevTables(token, selectedDatasourceId, nextDatabase),
        fetchDevFunctions(token, selectedDatasourceId, nextDatabase),
      ]);
      setTables(tableRes.data);
      setFunctions(functionRes.data);
    }

    void loadObjects().catch((error: any) => message.error(error.message || "加载对象树失败"));
  }, [selectedDatasourceId, selectedDatabase, token]);

  useEffect(() => {
    async function loadModelProviderOptions() {
      if (!token) return;
      setModelProvidersLoading(true);
      try {
        const response = await fetchModelProviders(token);
        setModelProviders(response.data);
      } catch (error: any) {
        message.error(error.message || "加载模型配置失败");
      } finally {
        setModelProvidersLoading(false);
      }
    }

    void loadModelProviderOptions();
  }, [token]);

  useEffect(() => {
    if (!selectedNode) return;
    const nodeConfig = (selectedNode.data?.nodeConfig || {}) as Record<string, unknown>;
    const normalizedOperatorCode = normalizeAiOperatorCode(String(selectedNode.data?.operatorCode || ""));
    const replaceRuleDrafts = normalizeReplaceRules(nodeConfig.replaceRuleDrafts ?? nodeConfig.replaceRules);
    const legacyReplaceRules = trimText(nodeConfig.matchValue) || readRawText(nodeConfig.replaceValue)
      ? [{ matchValue: readRawText(nodeConfig.matchValue), replaceValue: readRawText(nodeConfig.replaceValue) }]
      : [];
    nodeForm.setFieldsValue({
      nodeName: trimText(selectedNode.data?.nodeName),
      filterCondition: trimText(nodeConfig.filterCondition || nodeConfig.configText),
      filterRules: parseConditionRules(nodeConfig.filterRules).length
        ? parseConditionRules(nodeConfig.filterRules)
        : [{ ruleType: "condition", fieldName: "", operator: "eq", value: "", valueSource: "literal", referenceFieldRef: "", referenceNodeKey: "", referenceNodeName: "", referenceField: "", customSql: "", checkType: "phone", matchMode: "valid", domainValues: "" }],
      filterLogic: trimText(nodeConfig.filterLogic) || "all",
      branchCondition: trimText(nodeConfig.branchCondition || nodeConfig.configText),
      branchRules: parseConditionRules(nodeConfig.branchRules).length
        ? parseConditionRules(nodeConfig.branchRules)
        : [{ ruleType: "condition", fieldName: "", operator: "eq", value: "" }],
      branchLogic: trimText(nodeConfig.branchLogic) || "all",
      schemaSourceNodeKey: trimText(nodeConfig.schemaSourceNodeKey) || upstreamNodes[0]?.id,
      selectedColumns: parseStringArray(nodeConfig.selectedColumns),
      sourceTimeFilter: parseSourceTimeFilter(nodeConfig.sourceTimeFilter),
      dedupeKeys: parseStringArray(nodeConfig.dedupeKeys || nodeConfig.configText),
      dedupeSortFields: parseSortRules(nodeConfig.dedupeSortFields).length
        ? parseSortRules(nodeConfig.dedupeSortFields)
        : [{ fieldName: "", direction: "DESC" }],
      keepStrategy: trimText(nodeConfig.keepStrategy) || "first",
      renameMappings: normalizeRenameMappings(nodeConfig.renameMappingDrafts ?? nodeConfig.renameMappings).length
        ? normalizeRenameMappings(nodeConfig.renameMappingDrafts ?? nodeConfig.renameMappings)
        : [{ sourceField: "", targetField: "" }],
      sortFields: parseSortRules(nodeConfig.sortFields).length
        ? parseSortRules(nodeConfig.sortFields)
        : [{ fieldName: "", direction: "ASC" }],
      limitCount: Number(nodeConfig.limitCount || 100),
      alignMode: trimText(nodeConfig.alignMode) || "by_name",
      unionMode: trimText(nodeConfig.unionMode) || "all",
      columnMappings: syncColumnAlignmentRows(nodeConfig.columnMappingDrafts ?? nodeConfig.columnMappings, upstreamNodes, upstreamNodeColumnsMap),
      joinType: trimText(nodeConfig.joinType) || "left",
      joinKeys: normalizeJoinKeyRules(nodeConfig.joinKeyDrafts ?? nodeConfig.joinKeys).length
        ? normalizeJoinKeyRules(nodeConfig.joinKeyDrafts ?? nodeConfig.joinKeys)
        : [{ leftField: "", rightField: "" }],
      leftOutputFields: parseStringArray(nodeConfig.leftOutputFields),
      rightOutputFields: parseStringArray(nodeConfig.rightOutputFields),
      fieldName: trimText(nodeConfig.fieldName),
      replaceRules: replaceRuleDrafts.length
        ? replaceRuleDrafts
        : legacyReplaceRules.length
          ? legacyReplaceRules
          : [{ matchValue: "", replaceValue: "" }],
      formatRules: normalizeFormatConvertRules(nodeConfig.formatRuleDrafts ?? nodeConfig.formatRules).length
        ? normalizeFormatConvertRules(nodeConfig.formatRuleDrafts ?? nodeConfig.formatRules)
        : [{ sourceField: "", targetField: "", transformType: "date_to_string", formatPattern: "", targetType: "decimal" }],
      complianceRules: normalizeComplianceRules(nodeConfig.complianceRuleDrafts ?? nodeConfig.complianceRules).length
        ? normalizeComplianceRules(nodeConfig.complianceRuleDrafts ?? nodeConfig.complianceRules)
        : [{
          validationType: "builtin",
          sourceField: "",
          targetField: "",
          checkType: "phone",
          customPattern: "",
          fixedValue: "",
          domainValues: "",
          resultMode: "flag",
          defaultValue: "",
        }],
      stringRules: normalizeStringProcessRules(nodeConfig.stringRuleDrafts ?? nodeConfig.stringRules).length
        ? normalizeStringProcessRules(nodeConfig.stringRuleDrafts ?? nodeConfig.stringRules)
        : [{ sourceField: "", targetField: "", transformType: "trim", argument1: "", argument2: "" }],
      desensitizeRules: normalizeDesensitizeRules(nodeConfig.desensitizeRuleDrafts ?? nodeConfig.desensitizeRules).length
        ? normalizeDesensitizeRules(nodeConfig.desensitizeRuleDrafts ?? nodeConfig.desensitizeRules)
        : [{ sourceField: "", targetField: "", maskType: "mask", maskChar: "*", prefixLength: 3, suffixLength: 4, truncateLength: 8 }],
      groupByFields: parseStringArray(nodeConfig.groupByFields),
      aggregations: parseAggregationRules(nodeConfig.aggregations).length
        ? parseAggregationRules(nodeConfig.aggregations)
        : [{ aggregateFunction: "count", fieldName: "__all__", alias: "count_rows" }],
      stringAggregateRules: parseStringAggregateRules(nodeConfig.stringAggregateRules).length
        ? parseStringAggregateRules(nodeConfig.stringAggregateRules)
        : [{ sourceField: "", outputField: "agg_text", separator: ",", distinct: false }],
      separator: readRawText(nodeConfig.separator) || ",",
      trimItems: typeof nodeConfig.trimItems === "boolean" ? nodeConfig.trimItems : true,
      keepEmptyItems: Boolean(nodeConfig.keepEmptyItems),
      indexField: trimText(nodeConfig.indexField),
      functionType: trimText(nodeConfig.functionType) || "row_number",
      sourceField: trimText(nodeConfig.sourceField),
      outputField: trimText(nodeConfig.outputField) || (trimText(selectedNode.data?.operatorCode) === "string_split" ? "split_item" : "window_value"),
      partitionByFields: parseStringArray(nodeConfig.partitionByFields),
      orderByFields: parseSortRules(nodeConfig.orderByFields).length
        ? parseSortRules(nodeConfig.orderByFields)
        : [{ fieldName: "", direction: "ASC" }],
      offset: Number(nodeConfig.offset || 1),
      defaultValue: readRawText(nodeConfig.defaultValue),
      modelProviderId: nodeConfig.modelProviderId ? Number(nodeConfig.modelProviderId) : undefined,
      modelName: trimText(nodeConfig.modelName),
      modelVersion: trimText(nodeConfig.modelVersion),
      systemPrompt: readRawText(nodeConfig.systemPrompt),
      userPrompt: readRawText(nodeConfig.userPrompt),
      promptVariables: normalizePromptVariableFormRows(nodeConfig.promptVariableDrafts ?? nodeConfig.promptVariables),
      outputFields: parseAiOutputFieldMappings(
        nodeConfig.outputFields,
        getAiFallbackFieldName(normalizedOperatorCode),
        nodeConfig.outputFieldName
      ),
      outputFieldName: trimText(nodeConfig.outputFieldName) || getAiFallbackFieldName(normalizedOperatorCode),
      sqlText: readRawText(nodeConfig.sqlText),
      sqlInputs: syncSqlInputBindings(nodeConfig.sqlInputs, upstreamNodes),
      createTargetTable: Boolean(nodeConfig.createTargetTable),
      targetTable: trimText(nodeConfig.targetTable),
      writeMode: trimText(nodeConfig.writeMode) || "overwrite",
      outputFieldMappings: mergeOutputFieldMappings(parseOutputFieldMappings(nodeConfig.outputFieldMappings), previewColumns, outputTargetColumns),
    });
  }, [nodeForm, selectedNode, upstreamNodeColumnsMap, upstreamNodes]);

  useEffect(() => {
    async function loadOutputTargetColumns() {
      if (
        !selectedNode ||
        selectedNode.data?.nodeType !== "output" ||
        watchedCreateTargetTable ||
        !selectedDatasourceId ||
        !selectedDatabase ||
        !watchedOutputTargetTable
      ) {
        setOutputTargetColumns([]);
        return;
      }

      const cacheKey = buildColumnCacheKey(selectedDatasourceId, selectedDatabase, watchedOutputTargetTable);
      if (columnCache[cacheKey]) {
        setOutputTargetColumns(columnCache[cacheKey]);
        return;
      }

      setOutputTargetColumnsLoading(true);
      try {
        const response = await fetchDevColumns(token, selectedDatasourceId, selectedDatabase, watchedOutputTargetTable);
        setColumnCache((current) => ({
          ...current,
          [cacheKey]: response.data,
        }));
        setOutputTargetColumns(response.data);
      } catch (error: any) {
        message.error(error.message || "加载输出目标表字段失败");
        setOutputTargetColumns([]);
      } finally {
        setOutputTargetColumnsLoading(false);
      }
    }

    void loadOutputTargetColumns();
  }, [columnCache, selectedDatabase, selectedDatasourceId, selectedNode, token, watchedCreateTargetTable, watchedOutputTargetTable]);

  useEffect(() => {
    if (!selectedNode || selectedNode.data?.nodeType !== "output") {
      return;
    }
    const targetFieldSeed = watchedCreateTargetTable
      ? "create"
      : `${watchedOutputTargetTable || "default"}::${outputTargetColumns.map((item) => item.name).join("|")}`;
    const seedKey = `${selectedNode.id}::${targetFieldSeed}`;
    if (outputMappingSeedRef.current === seedKey) {
      return;
    }
    nodeForm.setFieldsValue({
      outputFieldMappings: outputFieldMappingDefaults,
    });
    outputMappingSeedRef.current = seedKey;
  }, [nodeForm, outputFieldMappingDefaults, selectedNode, watchedCreateTargetTable, watchedOutputTargetTable]);

  useEffect(() => {
    if (!nodeDrawerOpen || !selectedNode) {
      return;
    }
    setNodeDrawerWidth(getPreferredNodeDrawerWidth(selectedNode, upstreamNodes.length));
  }, [nodeDrawerOpen, selectedNodeId, selectedNode?.data?.nodeType, selectedNode?.data?.operatorCode, upstreamNodes.length]);

  useEffect(() => {
    if (!selectedNode || !isAiOperatorCode(String(selectedNode.data?.operatorCode || "")) || !activeChatModelProviders.length) {
      return;
    }

    const normalizedOperatorCode = normalizeAiOperatorCode(String(selectedNode.data?.operatorCode || ""));
    const currentProviderId = Number(nodeForm.getFieldValue("modelProviderId") || selectedNode.data?.nodeConfig?.modelProviderId || 0);
    const provider = activeChatModelProviders.find((item) => item.id === currentProviderId) || activeChatModelProviders[0];
    if (!provider) {
      return;
    }

    const catalog = buildFallbackCatalog(provider);
    const currentModelName = trimText(nodeForm.getFieldValue("modelName")) || trimText(selectedNode.data?.nodeConfig?.modelName);
    const nextModelName = currentModelName || catalog[0]?.name || trimText(provider.modelName);
    const versionOptions = getModelVersionOptions(catalog, nextModelName);
    const currentModelVersion = trimText(nodeForm.getFieldValue("modelVersion")) || trimText(selectedNode.data?.nodeConfig?.modelVersion);
    const nextModelVersion = currentModelVersion || versionOptions[0]?.value || trimText(provider.modelVersion || provider.modelName);
    const outputFields = parseAiOutputFieldMappings(
      nodeForm.getFieldValue("outputFields"),
      getAiFallbackFieldName(normalizedOperatorCode),
      selectedNode.data?.nodeConfig?.outputFieldName
    );

    nodeForm.setFieldsValue({
      modelProviderId: provider.id,
      modelName: nextModelName,
      modelVersion: nextModelVersion,
      outputFields,
      outputFieldName: outputFields[0]?.fieldName || getAiFallbackFieldName(normalizedOperatorCode),
    });
  }, [activeChatModelProviders, nodeForm, selectedNode]);

  useEffect(() => {
    setNodePreview(null);
  }, [selectedNodeId]);

  useEffect(() => {
    if (!drawerResizing) {
      return undefined;
    }

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    function handleMouseMove(event: MouseEvent) {
      const state = drawerResizeStateRef.current;
      if (!state) return;
      const nextWidth = Math.min(
        ORCHESTRATION_DRAWER_MAX_WIDTH,
        Math.max(ORCHESTRATION_DRAWER_MIN_WIDTH, state.startWidth + (state.startX - event.clientX))
      );
      setNodeDrawerWidth(nextWidth);
    }

    function handleMouseUp() {
      drawerResizeStateRef.current = null;
      setDrawerResizing(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [drawerResizing]);

  useEffect(() => {
    if (!sidebarResizing) {
      return undefined;
    }

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    function handleMouseMove(event: MouseEvent) {
      const state = sidebarResizeStateRef.current;
      if (!state) return;
      const nextWidth = Math.min(520, Math.max(260, state.startWidth + (event.clientX - state.startX)));
      setSidebarWidth(nextWidth);
    }

    function handleMouseUp() {
      sidebarResizeStateRef.current = null;
      setSidebarResizing(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [sidebarResizing]);

  useEffect(() => {
    document.body.classList.toggle("orchestration-workspace-expanded", canvasExpanded);
    return () => {
      document.body.classList.remove("orchestration-workspace-expanded");
    };
  }, [canvasExpanded]);

  useEffect(() => {
    async function loadPreviewColumns() {
      if (!selectedNode || !previewSourceDescriptors.length) return;

      const pending = previewSourceDescriptors.filter((item: SourceDescriptor) => {
        const cacheKey = buildColumnCacheKey(item.datasourceId, item.databaseName, item.tableName);
        return !columnCache[cacheKey];
      });

      if (!pending.length) return;

      setPreviewLoading(true);
      try {
        const responses = await Promise.all(
          pending.map(async (item: SourceDescriptor) => {
            const response = await fetchDevColumns(token, item.datasourceId, item.databaseName, item.tableName);
            return { key: buildColumnCacheKey(item.datasourceId, item.databaseName, item.tableName), columns: response.data };
          })
        );
        setColumnCache((current) => {
          const next = { ...current };
          for (const item of responses) {
            next[item.key] = item.columns;
          }
          return next;
        });
      } catch (error: any) {
        message.error(error.message || "加载字段结构失败");
      } finally {
        setPreviewLoading(false);
      }
    }

    void loadPreviewColumns();
  }, [columnCache, previewSourceDescriptors, selectedNode, token]);

  useEffect(() => {
    const selectedIds = nodes.filter((item) => Boolean((item as Node).selected)).map((item) => item.id);
    setSelectedNodeIds(selectedIds);
    if (!selectedIds.length) {
      if (selectedNodeId && !selectedEdgeIds.length) {
        setSelectedNodeId(undefined);
      }
      return;
    }
    if (selectedIds.length === 1) {
      setSelectedNodeId(selectedIds[0]);
    } else if (selectedNodeId && !selectedIds.includes(selectedNodeId)) {
      setSelectedNodeId(undefined);
      setNodeDrawerOpen(false);
    }
  }, [nodes, selectedEdgeIds, selectedNodeId]);

  useEffect(() => {
    setUpstreamReferencePreview(null);
    setUpstreamReferenceOpen([]);
  }, [previewTargetNodeId, selectedNode?.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete") {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditing = Boolean(
        target?.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        target?.closest(".monaco-editor")
      );
      if (isEditing || (!selectedEdgeIds.length && !selectedNodeIds.length)) {
        return;
      }
      event.preventDefault();
      const nodeIdSet = new Set(selectedNodeIds);
      const edgeIdSet = new Set(selectedEdgeIds);
      setNodes((current) => current.filter((node) => !nodeIdSet.has(node.id)));
      setEdges((current) =>
        current.filter((edge) => !edgeIdSet.has(edge.id) && !nodeIdSet.has(edge.source) && !nodeIdSet.has(edge.target))
      );
      if (selectedNodeId && nodeIdSet.has(selectedNodeId)) {
        setSelectedNodeId(undefined);
        setNodeDrawerOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEdgeIds, selectedNodeId, selectedNodeIds]);

  useEffect(() => {
    if (!selectedNode || !previewColumns.length) {
      return;
    }
    const operatorCode = trimText(selectedNode.data.operatorCode);
    if (!["source_table", "select_columns"].includes(operatorCode)) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(selectedNode.data.nodeConfig || {}, "selectedColumns")) {
      return;
    }
    const savedColumns = parseStringArray(selectedNode.data.nodeConfig?.selectedColumns);
    const formColumns = parseStringArray(nodeForm.getFieldValue("selectedColumns"));
    if (savedColumns.length || formColumns.length) {
      return;
    }
    const nextColumns = previewColumns.map((column) => column.name);
    nodeForm.setFieldValue("selectedColumns", nextColumns);
    updateSelectedNode({
      ...nodeForm.getFieldsValue(),
      selectedColumns: nextColumns,
    });
  }, [nodeForm, previewColumns, selectedNode]);

  useEffect(() => {
    if (!selectedNode || trimText(selectedNode.data.operatorCode) !== "join" || upstreamNodes.length < 2) {
      return;
    }
    const currentConfig = (selectedNode.data.nodeConfig || {}) as Record<string, unknown>;
    const nextLeftFields = parseStringArray(nodeForm.getFieldValue("leftOutputFields") || currentConfig.leftOutputFields);
    const nextRightFields = parseStringArray(nodeForm.getFieldValue("rightOutputFields") || currentConfig.rightOutputFields);
    const leftColumns = upstreamNodeColumnsMap[upstreamNodes[0].id] || [];
    const rightColumns = upstreamNodeColumnsMap[upstreamNodes[1].id] || [];
    const shouldInitLeft = !Object.prototype.hasOwnProperty.call(currentConfig, "leftOutputFields") && !nextLeftFields.length && leftColumns.length;
    const shouldInitRight = !Object.prototype.hasOwnProperty.call(currentConfig, "rightOutputFields") && !nextRightFields.length && rightColumns.length;
    if (!shouldInitLeft && !shouldInitRight) {
      return;
    }
    const payload = {
      ...nodeForm.getFieldsValue(),
      leftOutputFields: shouldInitLeft ? leftColumns.map((item) => item.name) : nextLeftFields,
      rightOutputFields: shouldInitRight ? rightColumns.map((item) => item.name) : nextRightFields,
    };
    nodeForm.setFieldsValue(payload);
    updateSelectedNode(payload);
  }, [nodeForm, selectedNode, upstreamNodeColumnsMap, upstreamNodes]);

  useEffect(() => {
    if (!selectedNode || trimText(selectedNode.data.operatorCode) !== "union") {
      return;
    }
    const currentMappings = normalizeColumnAlignmentRows(nodeForm.getFieldValue("columnMappings"));
    const savedMappings = normalizeColumnAlignmentRows(selectedNode.data.nodeConfig?.columnMappingDrafts ?? selectedNode.data.nodeConfig?.columnMappings);
    const nextMappings = syncColumnAlignmentRows(
      currentMappings.length ? currentMappings : savedMappings,
      upstreamNodes,
      upstreamNodeColumnsMap
    );
    const shouldSyncForm = !areColumnAlignmentRowsEqual(currentMappings, nextMappings);
    const shouldSyncNode = !areColumnAlignmentRowsEqual(savedMappings, nextMappings);
    if (!shouldSyncForm && !shouldSyncNode) {
      return;
    }
    if (shouldSyncForm) {
      nodeForm.setFieldValue("columnMappings", nextMappings);
    }
    if (shouldSyncNode) {
      updateSelectedNode({
        ...nodeForm.getFieldsValue(),
        columnMappings: nextMappings,
      });
    }
  }, [nodeForm, selectedNode, upstreamNodeColumnsMap, upstreamNodes]);

  function updateSelectedNode(values: Record<string, unknown>) {
    if (!selectedNodeId) return;

    setNodes((current) =>
      current.map((item) => {
        if (item.id !== selectedNodeId) return item;

        const nodeType = item.data.nodeType as CanvasNodeType;
        const operatorCode = String(item.data.operatorCode || "operator");
        const nodeName = trimText(values.nodeName) || trimText(item.data.nodeName) || getOperatorMeta(operatorCode, nodeType).label;
        const currentConfig = (item.data.nodeConfig || {}) as Record<string, unknown>;
        const nextConfig: Record<string, unknown> = {
          ...currentConfig,
          schemaSourceNodeKey: trimText(values.schemaSourceNodeKey) || currentConfig.schemaSourceNodeKey || null,
        };

        if (nodeType === "source") {
          const sourceTimeFilter = parseSourceTimeFilter(values.sourceTimeFilter);
          const selectedColumns = parseStringArray(values.selectedColumns);
          nextConfig.selectedColumns = selectedColumns;
          nextConfig.sourceTimeFilter = sourceTimeFilter;
          nextConfig.configText = selectedColumns.length
            ? `字段 ${selectedColumns.length}`
            : "";
        }

        if (operatorCode === "filter") {
          const upstreamNodeNameMap = new Map(
            upstreamNodes.map((node) => [node.id, trimText(node.data?.nodeName) || node.id])
          );
          const filterRules = parseConditionRules(values.filterRules).map((rule) => ({
            ...rule,
            referenceNodeName: upstreamNodeNameMap.get(trimText(rule.referenceNodeKey))
              || trimText(rule.referenceNodeName)
              || "",
          }));
          nextConfig.filterRules = filterRules;
          nextConfig.filterLogic = trimText(values.filterLogic) || "all";
          nextConfig.filterCondition = buildConditionExpression(filterRules, values.filterLogic);
          nextConfig.configText = nextConfig.filterCondition;
        }

        if (operatorCode === "branch") {
          nextConfig.branchRules = parseConditionRules(values.branchRules);
          nextConfig.branchLogic = trimText(values.branchLogic) || "all";
          nextConfig.branchCondition = buildConditionExpression(parseConditionRules(values.branchRules), values.branchLogic);
          nextConfig.configText = nextConfig.branchCondition;
        }

        if (operatorCode === "deduplicate") {
          nextConfig.dedupeKeys = parseStringArray(values.dedupeKeys);
          nextConfig.dedupeSortFields = parseSortRules(values.dedupeSortFields);
          nextConfig.keepStrategy = trimText(values.keepStrategy) || "first";
          nextConfig.configText = [
            parseStringArray(values.dedupeKeys).join(", "),
            parseSortRules(values.dedupeSortFields).length ? `sort ${parseSortRules(values.dedupeSortFields).length}` : "",
          ]
            .filter(Boolean)
            .join(" / ");
        }

        if (operatorCode === "select_columns") {
          nextConfig.selectedColumns = parseStringArray(values.selectedColumns);
          nextConfig.configText = parseStringArray(values.selectedColumns).length
            ? `保留 ${parseStringArray(values.selectedColumns).length} 列`
            : "";
        }

        if (operatorCode === "rename_fields") {
          const renameMappingDrafts = normalizeRenameMappings(values.renameMappings);
          const renameMappings = parseRenameMappings(values.renameMappings);
          nextConfig.renameMappingDrafts = renameMappingDrafts;
          nextConfig.renameMappings = renameMappings;
          nextConfig.configText = renameMappings
            .map((rule) => `${rule.sourceField || ""} -> ${rule.targetField || ""}`)
            .filter(Boolean)
            .join(", ");
        }

        if (operatorCode === "sort") {
          nextConfig.sortFields = parseSortRules(values.sortFields);
          nextConfig.configText = parseSortRules(values.sortFields)
            .map((rule) => `${rule.fieldName || ""} ${trimText(rule.direction || "ASC")}`)
            .filter(Boolean)
            .join(", ");
        }

        if (operatorCode === "limit_rows") {
          nextConfig.limitCount = Number(values.limitCount || 100);
          nextConfig.configText = nextConfig.limitCount ? `LIMIT ${nextConfig.limitCount}` : "";
        }

        if (operatorCode === "union") {
          nextConfig.alignMode = "by_name";
          nextConfig.unionMode = trimText(values.unionMode) || "all";
          nextConfig.columnMappingDrafts = normalizeColumnAlignmentRows(values.columnMappings);
          nextConfig.columnMappings = syncColumnAlignmentRows(values.columnMappings, upstreamNodes, upstreamNodeColumnsMap);
          nextConfig.configText = [
            nextConfig.unionMode === "distinct" ? "UNION" : "UNION ALL",
            parseColumnAlignmentRows(nextConfig.columnMappings).length ? `对齐 ${parseColumnAlignmentRows(nextConfig.columnMappings).length} 列` : "",
          ]
            .filter(Boolean)
            .join(" / ");
        }

        if (operatorCode === "join") {
          nextConfig.joinType = trimText(values.joinType) || "left";
          nextConfig.joinKeyDrafts = normalizeJoinKeyRules(values.joinKeys);
          const joinKeys = parseJoinKeyRules(values.joinKeys);
          nextConfig.joinKeys = joinKeys;
          nextConfig.leftOutputFields = parseStringArray(values.leftOutputFields);
          nextConfig.rightOutputFields = parseStringArray(values.rightOutputFields);
          nextConfig.configText = [
            JOIN_TYPE_OPTIONS.find((item) => item.value === nextConfig.joinType)?.label || nextConfig.joinType,
            nextConfig.joinType === "cross" ? "" : joinKeys.length ? `关联键 ${joinKeys.length}` : "",
          ]
            .filter(Boolean)
            .join(" / ");
        }

        if (operatorCode === "replace") {
          nextConfig.fieldName = trimText(values.fieldName);
          nextConfig.replaceRuleDrafts = normalizeReplaceRules(values.replaceRules);
          const replaceRules = parseReplaceRules(values.replaceRules);
          nextConfig.replaceRules = replaceRules;
          nextConfig.configText = nextConfig.fieldName
            ? `${nextConfig.fieldName} / ${replaceRules.length || 0} 组替换`
            : "";
        }

        if (operatorCode === "format_convert") {
          nextConfig.formatRuleDrafts = normalizeFormatConvertRules(values.formatRules);
          const formatRules = parseFormatConvertRules(values.formatRules);
          nextConfig.formatRules = formatRules;
          nextConfig.configText = formatRules.length
            ? `转换 ${formatRules.length} 列`
            : "";
        }

        if (operatorCode === "compliance_check") {
          nextConfig.complianceRuleDrafts = normalizeComplianceRules(values.complianceRules);
          const complianceRules = parseComplianceRules(values.complianceRules);
          nextConfig.complianceRules = complianceRules;
          nextConfig.configText = complianceRules.length
            ? `校验 ${complianceRules.length} 列`
            : "";
        }

        if (operatorCode === "string_transform") {
          nextConfig.stringRuleDrafts = normalizeStringProcessRules(values.stringRules);
          const stringRules = parseStringProcessRules(values.stringRules);
          nextConfig.stringRules = stringRules;
          nextConfig.configText = stringRules.length
            ? `处理 ${stringRules.length} 列`
            : "";
        }

        if (operatorCode === "desensitize") {
          nextConfig.desensitizeRuleDrafts = normalizeDesensitizeRules(values.desensitizeRules);
          const desensitizeRules = parseDesensitizeRules(values.desensitizeRules);
          nextConfig.desensitizeRules = desensitizeRules;
          nextConfig.configText = desensitizeRules.length
            ? `脱敏 ${desensitizeRules.length} 列`
            : "";
        }

        if (operatorCode === "custom_sql") {
          nextConfig.sqlText = readRawText(values.sqlText);
          nextConfig.sqlInputs = syncSqlInputBindings(values.sqlInputs, upstreamNodes);
          nextConfig.configText = nextConfig.sqlText;
        }

        if (operatorCode === "aggregate") {
          nextConfig.groupByFields = parseStringArray(values.groupByFields);
          nextConfig.aggregations = parseAggregationRules(values.aggregations);
          nextConfig.configText = [
            parseStringArray(values.groupByFields).length ? `GROUP ${parseStringArray(values.groupByFields).join(", ")}` : "",
            parseAggregationRules(values.aggregations).length ? `AGG ${parseAggregationRules(values.aggregations).length}` : "",
          ]
            .filter(Boolean)
            .join(" / ");
        }

        if (operatorCode === "string_aggregate") {
          nextConfig.groupByFields = parseStringArray(values.groupByFields);
          nextConfig.stringAggregateRules = parseStringAggregateRules(values.stringAggregateRules);
          nextConfig.configText = parseStringAggregateRules(values.stringAggregateRules).length
            ? `聚合 ${parseStringAggregateRules(values.stringAggregateRules).length} 列`
            : "";
        }

        if (operatorCode === "string_split") {
          const sourceField = trimText(values.sourceField);
          const outputField = trimText(values.outputField) || "split_item";
          nextConfig.sourceField = trimText(values.sourceField);
          nextConfig.outputField = outputField;
          nextConfig.separator = readRawText(values.separator) || ",";
          nextConfig.trimItems = values.trimItems !== false;
          nextConfig.keepEmptyItems = Boolean(values.keepEmptyItems);
          nextConfig.indexField = trimText(values.indexField);
          nextConfig.configText = sourceField && outputField
            ? `${sourceField} -> ${outputField}`
            : "";
        }

        if (operatorCode === "window_compute") {
          nextConfig.functionType = trimText(values.functionType) || "row_number";
          nextConfig.sourceField = trimText(values.sourceField);
          nextConfig.outputField = trimText(values.outputField) || "window_value";
          nextConfig.partitionByFields = parseStringArray(values.partitionByFields);
          nextConfig.orderByFields = parseSortRules(values.orderByFields);
          nextConfig.offset = Number(values.offset || 1);
          nextConfig.defaultValue = readRawText(values.defaultValue);
          nextConfig.configText = `${nextConfig.functionType} -> ${nextConfig.outputField}`;
        }

        if (isAiOperatorCode(operatorCode)) {
          const normalizedOperatorCode = normalizeAiOperatorCode(operatorCode);
          const promptVariableDrafts = normalizePromptVariableFormRows(values.promptVariables);
          const promptVariables = parsePromptVariableMappings(values.promptVariables);
          const outputFields = parseAiOutputFieldMappings(
            values.outputFields,
            getAiFallbackFieldName(normalizedOperatorCode)
          );
          nextConfig.modelProviderId = values.modelProviderId ? Number(values.modelProviderId) : null;
          nextConfig.modelName = trimText(values.modelName);
          nextConfig.modelVersion = trimText(values.modelVersion || values.modelName);
          nextConfig.systemPrompt = readRawText(values.systemPrompt);
          nextConfig.userPrompt = readRawText(values.userPrompt);
          nextConfig.promptVariableDrafts = promptVariableDrafts;
          nextConfig.promptVariables = promptVariables;
          nextConfig.outputFields = outputFields;
          nextConfig.outputFieldName = outputFields[0]?.fieldName || getAiFallbackFieldName(normalizedOperatorCode);
          nextConfig.configText = [
            getAiModeSummaryLabel(normalizedOperatorCode),
            trimText(nextConfig.modelVersion || nextConfig.modelName),
            nextConfig.outputFieldName ? `输出 ${nextConfig.outputFieldName}` : "",
            promptVariables.length ? `变量 ${promptVariables.length}` : "",
          ]
            .filter(Boolean)
            .join(" / ");
        }

        if (nodeType === "output") {
          nextConfig.createTargetTable = Boolean(values.createTargetTable);
          nextConfig.targetTable = trimText(values.targetTable);
          nextConfig.writeMode = trimText(values.writeMode) || "overwrite";
          nextConfig.outputFieldMappings = parseOutputFieldMappings(values.outputFieldMappings);
          nextConfig.configText = nextConfig.targetTable;
        }

        const subtitle = buildDesignerNodeSubtitle(nodeType, operatorCode, nextConfig, trimText(item.data.subtitle));

        return {
          ...item,
          data: {
            ...item.data,
            nodeName,
            subtitle,
            nodeConfig: nextConfig,
            label: buildNodeLabel(nodeName, operatorCode, nodeType, subtitle),
          },
        };
      })
    );
  }

  function removeSelectedNode(nodeId: string) {
    setNodes((current) => current.filter((item) => item.id !== nodeId));
    setEdges((current) => current.filter((item) => item.source !== nodeId && item.target !== nodeId));
    setNodeDrawerOpen(false);
    setSelectedNodeId(undefined);
  }

  function toggleEdgePaused(edgeId: string) {
    setEdges((current) =>
      current.map((item) => {
        if (item.id !== edgeId) return item;
        const nextStatus = normalizeEdgeStatus(item.data?.edgeStatus) === "paused" ? "active" : "paused";
        return createCanvasEdge({
          id: item.id,
          source: item.source,
          target: item.target,
          sourcePort: item.data?.sourcePort || item.sourceHandle || null,
          targetPort: item.data?.targetPort || item.targetHandle || null,
          edgeStatus: nextStatus,
        });
      })
    );
  }

  function startDrawerResize(clientX: number) {
    drawerResizeStateRef.current = {
      startX: clientX,
      startWidth: nodeDrawerWidth,
    };
    setDrawerResizing(true);
  }

  function startSidebarResize(clientX: number) {
    sidebarResizeStateRef.current = {
      startX: clientX,
      startWidth: sidebarWidth,
    };
    setSidebarResizing(true);
  }

  function createOperatorNode(template: OperatorTemplate, position: { x: number; y: number }) {
    return createCanvasNode({
      nodeType: template.nodeType,
      operatorCode: template.operatorCode,
      nodeName: template.label,
      nodeConfig: createOperatorDefaultConfig(template.operatorCode),
      position,
      layoutDirection: canvasLayoutDirection,
    });
  }

  function applyAutoLayout(direction: "horizontal" | "vertical") {
    const nextPositions = buildAutoLayoutPositions(nodes, edges, direction);
    setCanvasLayoutDirection(direction);
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        position: nextPositions.get(node.id) || node.position,
        ...buildCanvasNodeAnchors(direction, node.data.nodeType, String(node.data.operatorCode || "")),
      }))
    );
    window.setTimeout(() => {
      reactFlowInstanceRef.current?.fitView({ padding: 0.16 });
    }, 80);
  }

  async function persistCurrentTask(options?: { showSuccessMessage?: boolean; refreshAfterSave?: boolean; showErrorMessage?: boolean }) {
    setSaving(true);
    try {
      await updateDevOrchestration(token, task.id, {
        name: task.name,
        description: task.description || null,
        datasourceId: selectedDatasourceId || null,
        databaseName: selectedDatabase || null,
        cronExpr: null,
        isPaused: true,
        retryTimes: task.retryTimes,
        timeoutSec: task.timeoutSec,
        runtimeConfig: task.runtimeConfig || {},
      });

      await saveDevOrchestrationGraph(token, task.id, {
        nodes: nodes.map((item) => ({
          nodeType: item.data.nodeType,
          operatorCode: item.data.operatorCode,
          nodeKey: item.id,
          nodeName: item.data.nodeName,
          positionX: item.position.x,
          positionY: item.position.y,
          width: Number(item.style?.width || ORCHESTRATION_NODE_WIDTH),
          height: Number(
            item.style?.minHeight ||
              (isBranchOperator(String(item.data.operatorCode || "")) ? ORCHESTRATION_BRANCH_NODE_MIN_HEIGHT : ORCHESTRATION_NODE_MIN_HEIGHT)
          ),
          nodeConfig: item.data.nodeConfig || {},
        })),
        edges: edges.map((item) => ({
          sourceNodeKey: item.source,
          sourcePort: trimText(item.data?.sourcePort) || null,
          targetNodeKey: item.target,
          targetPort: trimText(item.data?.targetPort) || null,
          edgeType: "orchestration",
          edgeStatus: normalizeEdgeStatus(item.data?.edgeStatus),
        })),
      });
      if (options?.showSuccessMessage) {
        message.success("算子任务画布已保存");
      }
      if (options?.refreshAfterSave) {
        await onRefresh();
      }
    } catch (error: any) {
      if (options?.showErrorMessage !== false) {
        message.error(error.message || "保存算子任务画布失败");
      }
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await persistCurrentTask({ showSuccessMessage: true, refreshAfterSave: true, showErrorMessage: true });
  }

  async function handlePreviewSql() {
    setSqlPreviewLoading(true);
    try {
      await persistCurrentTask({ showErrorMessage: false });
      const response = await fetchDevOrchestrationSqlPreview(token, task.id);
      setSqlPreview(normalizeSqlPreview(response.data));
      setSqlPreviewOpen(true);
    } catch (error: any) {
      message.error(error.message || "生成 SQL 预览失败");
    } finally {
      setSqlPreviewLoading(false);
    }
  }

  async function handlePreviewNode() {
    if (!selectedNode) return;

    setNodePreviewLoading(true);
    try {
      await persistCurrentTask({ showErrorMessage: false });
      const response = await fetchDevOrchestrationNodePreview(token, task.id, selectedNode.id, 20);
      setNodePreview(normalizeNodePreview(response.data));
    } catch (error: any) {
      message.error(error.message || "算子预览失败");
    } finally {
      setNodePreviewLoading(false);
    }
  }

  async function handleLoadUpstreamReferencePreview() {
    if (!selectedNode || selectedNode.data.nodeType === "source" || !previewTargetNodeId) {
      return;
    }

    setUpstreamReferenceLoading(true);
    try {
      await persistCurrentTask({ showErrorMessage: false });
      const response = await fetchDevOrchestrationNodePreview(token, task.id, previewTargetNodeId, 3);
      setUpstreamReferencePreview(normalizeNodePreview(response.data));
    } catch (error: any) {
      message.error(error.message || "加载上游字段参考失败");
    } finally {
      setUpstreamReferenceLoading(false);
    }
  }

  async function persistScheduleConfig(values: OrchestrationScheduleFormValues, options?: { closeAfterSave?: boolean; showSuccessMessage?: boolean }) {
    const cronExpr = buildCronFromOrchestrationSchedule(values);
    await updateDevOrchestration(token, task.id, {
      name: task.name,
      description: task.description || null,
      datasourceId: selectedDatasourceId || null,
      databaseName: selectedDatabase || null,
      cronExpr,
      isPaused: values.scheduleType === "manual" ? true : Boolean(values.isPaused),
      retryTimes: Number(values.retryTimes || 0),
      timeoutSec: Number(values.timeoutSec || 300),
      runtimeConfig: task.runtimeConfig || {},
    });

    if (options?.showSuccessMessage) {
      message.success("调度配置已保存");
    }
    if (options?.closeAfterSave) {
      setScheduleModalOpen(false);
    }
    await onRefresh();
  }

  async function handleSaveSchedule() {
    const values = await scheduleForm.validateFields();
    setSaving(true);
    try {
      await persistScheduleConfig(values, { closeAfterSave: true, showSuccessMessage: true });
      return;
      message.success("调度配置已保存");
      setScheduleModalOpen(false);
      await onRefresh();
    } catch (error: any) {
      message.error(error.message || "保存调度配置失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleRunCurrentOrchestration() {
    setOrchestrationRunning(true);
    try {
      await persistCurrentTask({ showErrorMessage: false });
      const response = await runDevOrchestration(token, task.id);
      const result: DevOrchestrationRunResult = response.data;
      message.success(`已触发运行，执行 ${result.statementCount} 条输出语句`);
      if (result.warnings.length) {
        message.warning(result.warnings[0]);
      }
    } catch (error: any) {
      message.error(error.message || "触发算子任务运行失败");
    } finally {
      setOrchestrationRunning(false);
    }
  }

  function updatePromptFieldValue(targetField: "systemPrompt" | "userPrompt", nextValue: string, selectionStart?: number, selectionEnd?: number) {
    nodeForm.setFieldValue(targetField, nextValue);
    updateSelectedNode({
      ...nodeForm.getFieldsValue(),
      [targetField]: nextValue,
    });

    window.requestAnimationFrame(() => {
      const target = promptInputRef.current[targetField];
      if (!target) {
        return;
      }
      target.focus();
      const nextCursorPosition = typeof selectionEnd === "number" ? selectionEnd : selectionStart;
      if (typeof selectionStart === "number" && typeof nextCursorPosition === "number") {
        target.setSelectionRange(selectionStart, nextCursorPosition);
      }
    });
  }

  function refreshPromptVariableMenu(targetField: "systemPrompt" | "userPrompt", text: string, cursorPosition: number) {
    setPromptVariableMenu(resolvePromptVariableMenu(text, cursorPosition, targetField, aiPromptVariableHints));
  }

  function handlePromptFieldChange(targetField: "systemPrompt" | "userPrompt", event: React.ChangeEvent<HTMLTextAreaElement>) {
    setActivePromptField(targetField);
    promptInputRef.current[targetField] = event.target;
    refreshPromptVariableMenu(targetField, event.target.value, event.target.selectionStart ?? event.target.value.length);
  }

  function handlePromptFieldCursorChange(targetField: "systemPrompt" | "userPrompt", event: React.SyntheticEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    setActivePromptField(targetField);
    promptInputRef.current[targetField] = target;
    refreshPromptVariableMenu(targetField, target.value, target.selectionStart ?? target.value.length);
  }

  function handlePromptFieldBlur(targetField: "systemPrompt" | "userPrompt") {
    window.setTimeout(() => {
      setPromptVariableMenu((current) => (current?.targetField === targetField ? null : current));
    }, 120);
  }

  function insertPromptVariable(
    variableName: string,
    targetField = activePromptField,
    replaceRange?: { start: number; end: number }
  ) {
    const token = `{{${variableName}}}`;
    const currentValue = readRawText(nodeForm.getFieldValue(targetField));
    const target = promptInputRef.current[targetField];
    const selectionStart = replaceRange?.start ?? target?.selectionStart ?? currentValue.length;
    const selectionEnd = replaceRange?.end ?? target?.selectionEnd ?? currentValue.length;
    const nextValue = `${currentValue.slice(0, selectionStart)}${token}${currentValue.slice(selectionEnd)}`;
    const nextCursor = selectionStart + token.length;
    setPromptVariableMenu(null);
    updatePromptFieldValue(targetField, nextValue, nextCursor, nextCursor);
  }

  function applyPromptVariableMenuSelection(optionIndex = promptVariableMenu?.activeIndex || 0) {
    if (!promptVariableMenu) {
      return;
    }
    const nextOption = promptVariableMenu.options[optionIndex];
    if (!nextOption) {
      return;
    }
    insertPromptVariable(nextOption.name, promptVariableMenu.targetField, {
      start: promptVariableMenu.start,
      end: promptVariableMenu.end,
    });
  }

  function renderPromptVariableMenu(targetField: "systemPrompt" | "userPrompt") {
    if (!promptVariableMenu || promptVariableMenu.targetField !== targetField) {
      return null;
    }

    return (
      <div className="orchestration-prompt-menu" onMouseDown={(event) => event.preventDefault()}>
        <div className="orchestration-prompt-menu__header">
          输入 <code>/</code> 选择参数，插入格式 <code>{"{{参数名}}"}</code>
        </div>
        <div className="orchestration-prompt-menu__list">
          {promptVariableMenu.options.map((item, index) => (
            <button
              key={item.name}
              type="button"
              className={`orchestration-prompt-menu__item${promptVariableMenu.activeIndex === index ? " is-active" : ""}`}
              onMouseDown={(event) => {
                event.preventDefault();
                applyPromptVariableMenuSelection(index);
              }}
            >
              <span className="orchestration-prompt-menu__name">{item.name}</span>
              <span className="orchestration-prompt-menu__summary">{item.summary}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function handlePromptInputKeyDown(targetField: "systemPrompt" | "userPrompt", event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (promptVariableMenu?.targetField === targetField) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setPromptVariableMenu((current) => {
          if (!current || !current.options.length) {
            return current;
          }
          const nextIndex = (current.activeIndex + delta + current.options.length) % current.options.length;
          return {
            ...current,
            activeIndex: nextIndex,
          };
        });
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applyPromptVariableMenuSelection();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setPromptVariableMenu(null);
        return;
      }
    }

    if (event.key !== "Tab") {
      return;
    }
    const completion = resolvePromptTokenCompletion(event.currentTarget.value, event.currentTarget.selectionStart ?? 0, aiPromptVariableNames);
    if (!completion) {
      return;
    }
    event.preventDefault();
    const nextValue = `${event.currentTarget.value.slice(0, completion.start)}${completion.token}${event.currentTarget.value.slice(completion.end)}`;
    const nextCursor = completion.start + completion.token.length;
    updatePromptFieldValue(targetField, nextValue, nextCursor, nextCursor);
  }

  // Active node drawer renderer. Keep new operator UX changes here.
  function renderDesignerNodeConfig() {
    if (!selectedNode) {
      return <Empty description="点击节点后进行配置" />;
    }

    const operatorCode = String(selectedNode.data.operatorCode || "");
    const nodeType = selectedNode.data.nodeType as CanvasNodeType;
    const sourceMeta = previewSourceDescriptors.map((item: SourceDescriptor) => `${item.databaseName}.${item.tableName}`);
    const normalizedAiOperatorCode = normalizeAiOperatorCode(operatorCode);
    const isAiOperator = isAiOperatorCode(operatorCode);
    const sourceTimeFormatType = (nodeForm.getFieldValue(["sourceTimeFilter", "formatType"]) || "date") as SourceRangeFormatType;
    const unionMappingGridStyle = {
      gridTemplateColumns: `minmax(180px, 1.2fr) repeat(${Math.max(upstreamNodes.length, 1)}, minmax(180px, 1fr)) 64px`,
    } as CSSProperties;

    return (
      <Form key={selectedNode.id} layout="vertical" form={nodeForm} onValuesChange={(_, values) => updateSelectedNode(values)}>
        {nodeType !== "source" ? (
          <div className="orchestration-config-section">
            <Collapse
              activeKey={upstreamReferenceOpen}
              onChange={(keys) => {
                const nextKeys = Array.isArray(keys) ? keys.map((item) => String(item)) : [String(keys)];
                setUpstreamReferenceOpen(nextKeys);
                if (nextKeys.includes("upstream-reference") && !upstreamReferencePreview && !upstreamReferenceLoading) {
                  void handleLoadUpstreamReferencePreview();
                }
              }}
              items={[
                {
                  key: "upstream-reference",
                  label: (
                    <div className="orchestration-schema-summary">
                      <Typography.Title level={5} style={{ margin: 0 }}>
                        上游字段参考
                      </Typography.Title>
                      <Typography.Text type="secondary">
                        {previewColumns.length ? `${previewColumns.length} 个字段，默认折叠` : "暂无可用结构"}
                      </Typography.Text>
                    </div>
                  ),
                  children: (
                    <Space direction="vertical" size={12} style={{ display: "flex" }}>
                      {previewColumns.length ? (
                        <Table
                          size="small"
                          pagination={false}
                          rowKey="name"
                          loading={previewLoading || upstreamReferenceLoading}
                          className="orchestration-schema-table"
                          dataSource={previewColumns}
                          columns={[
                            {
                              title: "字段",
                              dataIndex: "name",
                              width: 320,
                              render: (_, record: DevColumnEntry) => (
                                <div className="orchestration-schema-table__field">
                                  <FieldOptionCard option={buildFieldSelectOption(record)} />
                                </div>
                              ),
                            },
                            {
                              title: "样例值",
                              dataIndex: "name",
                              width: 340,
                              render: (_, record: DevColumnEntry) => {
                                const samples = upstreamFieldSampleMap[record.name] || [];
                                if (!samples.length) {
                                  return <Typography.Text type="secondary">-</Typography.Text>;
                                }
                                return (
                                  <div className="orchestration-schema-table__samples">
                                    {samples.map((item, index) => (
                                      <div key={`${record.name}-sample-${index}`} className="orchestration-schema-table__sample" title={item}>
                                        {item}
                                      </div>
                                    ))}
                                  </div>
                                );
                              },
                            },
                            {
                              title: "约束",
                              width: 120,
                              render: (_, record: DevColumnEntry) => (
                                <Space wrap size={4}>
                                  {record.primaryKey ? <Tag color="gold">PK</Tag> : null}
                                  {!record.nullable ? <Tag color="blue">NN</Tag> : null}
                                </Space>
                              ),
                            },
                          ]}
                        />
                      ) : (
                        <div className="orchestration-config-empty">
                          {schemaSourceOptions.length ? "当前上游节点还没有可用的字段结构。" : "请先连接上游节点后再查看字段参考。"}
                        </div>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </div>
        ) : null}

        <div className="orchestration-config-section">
          <Form.Item name="nodeName" label="节点名称" rules={[{ required: true, message: "请输入节点名称" }]}>
            <Input />
          </Form.Item>
          {nodeType !== "source" && !["custom_sql", "union", "join"].includes(operatorCode) ? (
            <Form.Item
              label="字段结构来源"
              name="schemaSourceNodeKey"
              extra={schemaSourceOptions.length > 1 ? "多路输入时可选择一个上游节点作为当前配置参考。" : "当前节点将继承唯一上游节点的字段结构。"}
            >
              <Select
                allowClear
                disabled={!schemaSourceOptions.length}
                placeholder={schemaSourceOptions.length ? "选择上游节点" : "请先连接上游节点"}
                options={schemaSourceOptions}
              />
            </Form.Item>
          ) : null}
          <div className="orchestration-config-meta">
            {sourceMeta.length ? <Tag color="blue">来源 {sourceMeta.join("、")}</Tag> : null}
            {previewColumns.length ? <Tag color="green">字段 {previewColumns.length}</Tag> : null}
            {selectedSourceTable?.comment ? <Tag color="gold">{selectedSourceTable?.comment || ""}</Tag> : null}
          </div>
        </div>

        {nodeType === "source" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                输入配置
              </Typography.Title>
              <Typography.Text type="secondary">支持字段范围与时间范围过滤，预览和运行会按这里的配置读取源表。</Typography.Text>
            </div>
            <Space direction="vertical" size={8} style={{ display: "flex" }}>
              <Input
                value={
                  trimText(selectedNode.data.nodeConfig?.datasourceId)
                    ? datasources.find((item) => item.id === Number(selectedNode.data.nodeConfig?.datasourceId))?.name || `数据源 ${selectedNode.data.nodeConfig?.datasourceId}`
                    : "未绑定"
                }
                readOnly
                addonBefore="数据源"
              />
              <Input value={trimText(selectedNode.data.nodeConfig?.databaseName) || "-"} readOnly addonBefore="数据库" />
              <Input value={trimText(selectedNode.data.nodeConfig?.tableName) || "-"} readOnly addonBefore="表对象" />
            </Space>
            <Form.Item
              name="selectedColumns"
              label="字段范围"
              style={{ marginTop: 16 }}
            >
              <ColumnChecklist columns={sourceAvailableColumns} emptyText="当前数据源表还没有拿到字段结构。" />
            </Form.Item>
            <div className="orchestration-source-range">
              <Typography.Text strong>数据范围</Typography.Text>
              <Typography.Text type="secondary">选择一个时间字段后，可配置起止范围；不填则默认读取全部数据。</Typography.Text>
              <div className="orchestration-source-range__grid">
                <Form.Item name={["sourceTimeFilter", "fieldName"]} label="时间字段">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="不筛选时间范围"
                    options={sourceAvailableColumnOptions}
                  />
                </Form.Item>
                <Form.Item name={["sourceTimeFilter", "formatType"]} label="时间格式">
                  <Select options={SOURCE_TIME_FORMAT_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} />
                </Form.Item>
                <Form.Item name={["sourceTimeFilter", "startValue"]} label="开始值">
                  <Input placeholder={buildSourceTimeFormatPlaceholder(sourceTimeFormatType)} />
                </Form.Item>
                <Form.Item name={["sourceTimeFilter", "endValue"]} label="结束值">
                  <Input placeholder={buildSourceTimeFormatPlaceholder(sourceTimeFormatType)} />
                </Form.Item>
              </div>
            </div>
          </div>
        ) : null}

        {false && operatorCode === "filter" ? (
          <div className="orchestration-config-section">
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              过滤配置
            </Typography.Title>
            <Form.Item
              name="filterCondition"
              label="筛选条件"
              rules={[{ required: true, message: "请输入筛选条件" }]}
              extra="当前先按 SQL 条件表达式配置，后续可继续补可视化条件组。"
            >
              <Input.TextArea rows={5} placeholder="例如：status = '有效' AND reg_date >= '2026-01-01'" />
            </Form.Item>
          </div>
        ) : null}

        {false && operatorCode === "deduplicate" ? (
          <div className="orchestration-config-section">
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              去重配置
            </Typography.Title>
            <Form.Item
              name="dedupeKeys"
              label="去重键"
              rules={[{ required: true, type: "array", min: 1, message: "至少选择一个去重键" }]}
            >
              <Select mode="multiple" placeholder="选择参与去重的字段" options={previewColumnOptions} />
            </Form.Item>
            <Form.Item name="keepStrategy" label="保留策略">
              <Select options={KEEP_STRATEGY_OPTIONS} />
            </Form.Item>
          </div>
        ) : null}

        {operatorCode === "filter" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                条件过滤
              </Typography.Title>
              <Typography.Text type="secondary">选择“属于（IN）”或“不属于（NOT IN）”后，可选固定值、上游字段结果或自定义 SQL。</Typography.Text>
            </div>
            <Form.Item name="filterLogic" label="条件生效方式" initialValue="all">
              <Select options={CONDITION_LOGIC_OPTIONS} />
            </Form.Item>
            <Form.List name="filterRules">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => {
                    const { key: fieldKey, ...fieldItemProps } = field;
                    return (
                    <div key={fieldKey} className="orchestration-inline-rule orchestration-inline-rule--aggregate">
                      <Form.Item
                        {...fieldItemProps}
                        name={[field.name, "ruleType"]}
                        label="规则类型"
                        rules={[{ required: true, message: "请选择规则类型" }]}
                        style={{ flex: "0 0 160px", minWidth: 160 }}
                      >
                        <Select options={FILTER_RULE_TYPE_OPTIONS} />
                      </Form.Item>
                      <Form.Item
                        {...fieldItemProps}
                        name={[field.name, "fieldName"]}
                        label="字段"
                        rules={[{ required: true, message: "请选择字段" }]}
                        style={{ flex: "1 1 220px", minWidth: 220 }}
                      >
                        <Select showSearch optionFilterProp="label" placeholder="选择字段" options={previewColumnOptions} />
                      </Form.Item>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) =>
                          prevValues?.filterRules?.[field.name]?.ruleType !== currentValues?.filterRules?.[field.name]?.ruleType
                          || prevValues?.filterRules?.[field.name]?.operator !== currentValues?.filterRules?.[field.name]?.operator
                          || prevValues?.filterRules?.[field.name]?.valueSource !== currentValues?.filterRules?.[field.name]?.valueSource
                        }
                      >
                        {() => {
                          const currentRuleType = trimText(nodeForm.getFieldValue(["filterRules", field.name, "ruleType"])) || "condition";
                          const currentOperator = trimText(nodeForm.getFieldValue(["filterRules", field.name, "operator"])) || "eq";
                          const currentValueSource = trimText(nodeForm.getFieldValue(["filterRules", field.name, "valueSource"])) || "literal";

                          if (currentRuleType === "builtin") {
                            return (
                              <>
                                <Form.Item
                                  {...fieldItemProps}
                                  name={[field.name, "checkType"]}
                                  label="校验规则"
                                  rules={[{ required: true, message: "请选择校验规则" }]}
                                  style={{ flex: "0 0 200px", minWidth: 200 }}
                                >
                                  <Select options={COMPLIANCE_CHECK_OPTIONS} />
                                </Form.Item>
                                <Form.Item
                                  {...fieldItemProps}
                                  name={[field.name, "matchMode"]}
                                  label="筛选方式"
                                  rules={[{ required: true, message: "请选择筛选方式" }]}
                                  style={{ flex: "0 0 180px", minWidth: 180 }}
                                >
                                  <Select options={FILTER_MATCH_MODE_OPTIONS} />
                                </Form.Item>
                              </>
                            );
                          }

                          if (currentRuleType === "domain") {
                            return (
                              <>
                                <Form.Item
                                  {...fieldItemProps}
                                  name={[field.name, "domainValues"]}
                                  label="值域"
                                  rules={[{ required: true, message: "请输入值域" }]}
                                  style={{ flex: "1 1 240px", minWidth: 240 }}
                                >
                                  <Input placeholder="多个值请用逗号分隔" />
                                </Form.Item>
                                <Form.Item
                                  {...fieldItemProps}
                                  name={[field.name, "matchMode"]}
                                  label="筛选方式"
                                  rules={[{ required: true, message: "请选择筛选方式" }]}
                                  style={{ flex: "0 0 180px", minWidth: 180 }}
                                >
                                  <Select options={DOMAIN_MATCH_MODE_OPTIONS} />
                                </Form.Item>
                              </>
                            );
                          }

                          return (
                            <>
                              <Form.Item
                                {...fieldItemProps}
                                name={[field.name, "operator"]}
                                label="条件"
                                rules={[{ required: true, message: "请选择条件" }]}
                                style={{ flex: "0 0 160px", minWidth: 160 }}
                              >
                                <Select options={CONDITION_OPERATOR_OPTIONS} />
                              </Form.Item>
                              {CONDITION_OPERATORS_WITHOUT_VALUE.has(currentOperator) ? (
                                <div className="orchestration-inline-rule__placeholder">
                                  <Tag color="default">无需填写值</Tag>
                                </div>
                              ) : CONDITION_SET_OPERATORS.has(currentOperator) ? (
                                <>
                                  <Form.Item
                                    {...fieldItemProps}
                                    name={[field.name, "valueSource"]}
                                    label="取值方式"
                                    rules={[{ required: true, message: "请选择取值方式" }]}
                                    style={{ flex: "0 0 180px", minWidth: 180 }}
                                  >
                                    <Select options={FILTER_VALUE_SOURCE_OPTIONS} />
                                  </Form.Item>
                                  {currentValueSource === "upstream_field" ? (
                                    <Form.Item
                                      {...fieldItemProps}
                                      name={[field.name, "referenceFieldRef"]}
                                      label="取值上游节点 / 字段"
                                      rules={[{ required: true, message: "请选择取值上游节点和字段" }]}
                                      style={{ flex: "1 1 360px", minWidth: 320 }}
                                      extra="可从任意已连接上游节点选择，选项和已选值都会标明节点名称。"
                                    >
                                      <Select
                                        showSearch
                                        placeholder="选择上游节点 / 字段"
                                        options={upstreamReferenceFieldOptions}
                                      />
                                    </Form.Item>
                                  ) : currentValueSource === "custom_sql" ? (
                                    <Form.Item
                                      {...fieldItemProps}
                                      name={[field.name, "customSql"]}
                                      label="自定义 SQL"
                                      rules={[{ required: true, message: "请输入返回单列结果的查询 SQL" }]}
                                      style={{ flex: "1 1 360px", minWidth: 320 }}
                                      extra="仅支持单条查询；可填写 SELECT col1 FROM tab1，也兼容 IN (SELECT col1 FROM tab1)。"
                                    >
                                      <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} placeholder="例如：SELECT col1 FROM tab1" />
                                    </Form.Item>
                                  ) : (
                                    <Form.Item
                                      {...fieldItemProps}
                                      name={[field.name, "value"]}
                                      label="值"
                                      rules={[{ required: true, message: "请输入条件值" }]}
                                      style={{ flex: "1 1 240px", minWidth: 240 }}
                                    >
                                      <Input placeholder="多个值请用逗号分隔" />
                                    </Form.Item>
                                  )}
                                </>
                              ) : (
                                <Form.Item
                                  {...fieldItemProps}
                                  name={[field.name, "value"]}
                                  label="值"
                                  rules={[{ required: true, message: "请输入条件值" }]}
                                  style={{ flex: "1 1 240px", minWidth: 240 }}
                                >
                                  <Input placeholder="输入条件值" />
                                </Form.Item>
                              )}
                            </>
                          );
                        }}
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                    );
                  })}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ ruleType: "condition", fieldName: "", operator: "eq", value: "", valueSource: "literal", referenceFieldRef: "", referenceNodeKey: "", referenceNodeName: "", referenceField: "", customSql: "", checkType: "phone", matchMode: "valid", domainValues: "" })}
                  >
                    新增筛选规则
                  </Button>
                </div>
              )}
            </Form.List>
            <Form.Item hidden name="filterCondition">
              <Input />
            </Form.Item>
          </div>
        ) : null}

        {operatorCode === "deduplicate" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                去重配置
              </Typography.Title>
              <Typography.Text type="secondary">先指定去重键，再指定排序字段，系统按排序结果保留首条或末条。</Typography.Text>
            </div>
            <Form.Item
              name="dedupeKeys"
              label="去重键"
              rules={[{ required: true, type: "array", min: 1, message: "至少选择一个去重键" }]}
            >
              <Select mode="multiple" placeholder="选择参与去重的字段" options={previewColumnOptions} />
            </Form.Item>
            <Form.Item name="keepStrategy" label="保留策略">
              <Select options={KEEP_STRATEGY_OPTIONS} />
            </Form.Item>
            <Form.List name="dedupeSortFields">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule">
                      <Form.Item
                        {...field}
                        name={[field.name, "fieldName"]}
                        label="排序字段"
                        rules={[{ required: true, message: "请选择排序字段" }]}
                        style={{ flex: 1 }}
                      >
                        <Select showSearch optionFilterProp="label" placeholder="选择字段" options={previewColumnOptions} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "direction"]}
                        label="排序方向"
                        rules={[{ required: true, message: "请选择排序方向" }]}
                        style={{ width: 160 }}
                      >
                        <Select options={SORT_DIRECTION_OPTIONS} />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ fieldName: "", direction: "DESC" })}>
                    新增排序字段
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
        ) : null}

        {operatorCode === "branch" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                分支判断
              </Typography.Title>
              <Typography.Text type="secondary">命中条件走“满足”分支，否则走“不满足”分支。</Typography.Text>
            </div>
            <Form.Item name="branchLogic" label="条件生效方式" initialValue="all">
              <Select options={CONDITION_LOGIC_OPTIONS} />
            </Form.Item>
            <Form.List name="branchRules">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule">
                      <Form.Item
                        {...field}
                        name={[field.name, "fieldName"]}
                        label="字段"
                        rules={[{ required: true, message: "请选择字段" }]}
                        style={{ flex: 1 }}
                      >
                        <Select showSearch optionFilterProp="label" placeholder="选择字段" options={previewColumnOptions} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "operator"]}
                        label="条件"
                        rules={[{ required: true, message: "请选择条件" }]}
                        style={{ width: 160 }}
                      >
                        <Select options={CONDITION_OPERATOR_OPTIONS} />
                      </Form.Item>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) =>
                          prevValues?.branchRules?.[field.name]?.operator !== currentValues?.branchRules?.[field.name]?.operator
                        }
                      >
                        {() => {
                          const currentOperator = trimText(nodeForm.getFieldValue(["branchRules", field.name, "operator"])) || "eq";
                          if (CONDITION_OPERATORS_WITHOUT_VALUE.has(currentOperator)) {
                            return (
                              <div className="orchestration-inline-rule__placeholder">
                                <Tag color="default">无需填写值</Tag>
                              </div>
                            );
                          }
                          return (
                            <Form.Item
                              {...field}
                              name={[field.name, "value"]}
                              label="值"
                              rules={[{ required: true, message: "请输入条件值" }]}
                              style={{ flex: 1 }}
                            >
                              <Input placeholder={currentOperator === "in" || currentOperator === "not_in" ? "多个值请用逗号分隔" : "输入条件值"} />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ fieldName: "", operator: "eq", value: "" })}>
                    新增分支条件
                  </Button>
                </div>
              )}
            </Form.List>
            <Form.Item hidden name="branchCondition">
              <Input />
            </Form.Item>
            <div className="orchestration-config-meta">
              <Tag color="success">右上连线：满足</Tag>
              <Tag color="warning">右下连线：不满足</Tag>
            </div>
          </div>
        ) : null}

        {operatorCode === "select_columns" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                字段选择
              </Typography.Title>
              <Typography.Text type="secondary">先看上游字段清单，再勾选保留字段，默认全选。</Typography.Text>
            </div>
            <Form.Item
              name="selectedColumns"
              label="保留字段"
            >
              <ColumnChecklist columns={previewColumns} emptyText="请先连线上游节点，拿到字段结构后再勾选。" />
            </Form.Item>
          </div>
        ) : null}

        {operatorCode === "rename_fields" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                字段重命名
              </Typography.Title>
              <Typography.Text type="secondary">支持批量映射输出字段名</Typography.Text>
            </div>
            <Form.List name="renameMappings">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule">
                      <Form.Item
                        {...field}
                        name={[field.name, "sourceField"]}
                        label="原字段"
                        rules={[{ required: true, message: "选择原字段" }]}
                        style={{ flex: 1 }}
                      >
                        <Select showSearch optionFilterProp="label" placeholder="选择字段" options={previewColumnOptions} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "targetField"]}
                        label="新字段名"
                        rules={[{ required: true, message: "输入新字段名" }]}
                        style={{ flex: 1 }}
                      >
                        <Input placeholder="例如：person_name" />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ sourceField: "", targetField: "" })}>
                    新增映射
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
        ) : null}

        {operatorCode === "sort" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                排序配置
              </Typography.Title>
              <Typography.Text type="secondary">按顺序应用排序字段</Typography.Text>
            </div>
            <Form.List name="sortFields">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule">
                      <Form.Item
                        {...field}
                        name={[field.name, "fieldName"]}
                        label="字段"
                        rules={[{ required: true, message: "选择字段" }]}
                        style={{ flex: 1 }}
                      >
                        <Select showSearch optionFilterProp="label" placeholder="选择字段" options={previewColumnOptions} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "direction"]}
                        label="方向"
                        rules={[{ required: true, message: "选择方向" }]}
                        style={{ width: 140 }}
                      >
                        <Select options={SORT_DIRECTION_OPTIONS} />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ fieldName: "", direction: "ASC" })}>
                    新增排序字段
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
        ) : null}

        {operatorCode === "limit_rows" ? (
          <div className="orchestration-config-section">
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              限制行数
            </Typography.Title>
            <Form.Item name="limitCount" label="保留条数" rules={[{ required: true, message: "请输入保留条数" }]}>
              <InputNumber min={1} max={1000000} style={{ width: "100%" }} />
            </Form.Item>
          </div>
        ) : null}

        {operatorCode === "union" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                并集映射
              </Typography.Title>
              <Typography.Text type="secondary">输入多少路就展示多少列，默认按字段同名自动匹配，匹配不到的字段留空。</Typography.Text>
            </div>
            <Form.Item name="unionMode" label="并集去重方式">
              <Select options={UNION_MODE_OPTIONS} />
            </Form.Item>
            {upstreamNodes.length ? (
              <Form.List name="columnMappings">
                {(fields, { add, remove }) => (
                  <div className="orchestration-union-mapping">
                    <div className="orchestration-union-mapping__header" style={unionMappingGridStyle}>
                      <div className="orchestration-union-mapping__cell orchestration-union-mapping__cell--output">输出字段</div>
                      {upstreamNodes.map((node, index) => (
                        <div key={node.id} className="orchestration-union-mapping__cell">
                          <Typography.Text strong>{`第${index + 1}列`}</Typography.Text>
                          <Typography.Text type="secondary">{trimText(node.data.nodeName) || node.id}</Typography.Text>
                        </div>
                      ))}
                      <div className="orchestration-union-mapping__cell orchestration-union-mapping__cell--action">操作</div>
                    </div>
                    {fields.map((field, rowIndex) => (
                      <div key={field.key} className="orchestration-union-mapping__row" style={unionMappingGridStyle}>
                        <div className="orchestration-union-mapping__cell orchestration-union-mapping__cell--output">
                          <Form.Item
                            {...field}
                            name={[field.name, "outputField"]}
                            rules={[{ required: true, message: "请输入输出字段名" }]}
                          >
                            <Input placeholder={`field_${rowIndex + 1}`} />
                          </Form.Item>
                        </div>
                        {upstreamNodes.map((node, sourceIndex) => (
                          <div key={`${field.key}_${node.id}`} className="orchestration-union-mapping__cell">
                            <Form.Item {...field} name={[field.name, "bindings", sourceIndex, "fieldName"]}>
                              <Select
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                placeholder="未匹配"
                                options={upstreamNodeColumnOptionsMap[node.id] || []}
                              />
                            </Form.Item>
                            <Form.Item {...field} name={[field.name, "bindings", sourceIndex, "sourceNodeKey"]} hidden>
                              <Input />
                            </Form.Item>
                          </div>
                        ))}
                        <div className="orchestration-union-mapping__cell orchestration-union-mapping__cell--action">
                          <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                        </div>
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      block
                      icon={<PlusOutlined />}
                      onClick={() =>
                        add({
                          outputField: "",
                          bindings: upstreamNodes.map((node) => ({
                            sourceNodeKey: node.id,
                            fieldName: "",
                          })),
                        })
                      }
                    >
                      新增输出字段
                    </Button>
                  </div>
                )}
              </Form.List>
            ) : (
              <div className="orchestration-config-empty">请至少连接两路上游输入后，再配置并集字段映射。</div>
            )}
          </div>
        ) : null}

        {false && operatorCode === "intersect" ? (
          <div className="orchestration-config-section">
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              集合算子配置
            </Typography.Title>
            <Form.Item name="alignMode" label="字段对齐方式">
              <Select options={ALIGN_MODE_OPTIONS} />
            </Form.Item>
            <Typography.Text type="secondary">
              交集结果会按当前参考字段结构对齐。
            </Typography.Text>
          </div>
        ) : null}

        {false && operatorCode === "replace" ? (
          <div className="orchestration-config-section">
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              字段替换配置
            </Typography.Title>
            <Form.Item name="fieldName" label="目标字段" rules={[{ required: true, message: "请选择目标字段" }]}>
              <Select showSearch optionFilterProp="label" placeholder="选择字段" options={previewColumnOptions} />
            </Form.Item>
            <Space size={12} style={{ width: "100%" }}>
              <Form.Item name="matchValue" label="原值" style={{ flex: 1 }}>
                <Input placeholder="为空时表示匹配空值" />
              </Form.Item>
              <Form.Item name="replaceValue" label="替换值" style={{ flex: 1 }}>
                <Input placeholder="输入替换后的值" />
              </Form.Item>
            </Space>
          </div>
        ) : null}

        {operatorCode === "join" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                关联配置
              </Typography.Title>
              <Typography.Text type="secondary">支持左连接、右连接、内连接、外连接和笛卡尔积，并分别控制左右表输出字段。</Typography.Text>
            </div>
            <Form.Item name="joinType" label="关联类型">
              <Select options={JOIN_TYPE_OPTIONS} />
            </Form.Item>
            {trimText(nodeForm.getFieldValue("joinType") || "left") !== "cross" ? (
              <Form.List name="joinKeys">
                {(fields, { add, remove }) => (
                  <div className="orchestration-list-block">
                    {fields.map((field) => (
                      <div key={field.key} className="orchestration-inline-rule">
                        <Form.Item
                          {...field}
                          name={[field.name, "leftField"]}
                          label={trimText(upstreamNodes[0]?.data?.nodeName) || "左表字段"}
                          rules={[{ required: true, message: "请选择左表关联字段" }]}
                          style={{ flex: 1 }}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            placeholder="选择左表字段"
                            options={upstreamNodeColumnOptionsMap[upstreamNodes[0]?.id || ""] || []}
                          />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, "rightField"]}
                          label={trimText(upstreamNodes[1]?.data?.nodeName) || "右表字段"}
                          rules={[{ required: true, message: "请选择右表关联字段" }]}
                          style={{ flex: 1 }}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            placeholder="选择右表字段"
                            options={upstreamNodeColumnOptionsMap[upstreamNodes[1]?.id || ""] || []}
                          />
                        </Form.Item>
                        <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                      </div>
                    ))}
                    <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ leftField: "", rightField: "" })}>
                      新增关联键
                    </Button>
                  </div>
                )}
              </Form.List>
            ) : null}
            <Collapse
              ghost
              defaultActiveKey={["left", "right"]}
              items={[
                {
                  key: "left",
                  label: `左表输出 / ${trimText(upstreamNodes[0]?.data?.nodeName) || "source_1"}`,
                  children: (
                    <Form.Item name="leftOutputFields" noStyle>
                      <ColumnChecklist
                        columns={upstreamNodeColumnsMap[upstreamNodes[0]?.id || ""] || []}
                        emptyText="左表还没有可用字段结构。"
                      />
                    </Form.Item>
                  ),
                },
                {
                  key: "right",
                  label: `右表输出 / ${trimText(upstreamNodes[1]?.data?.nodeName) || "source_2"}`,
                  children: (
                    <Form.Item name="rightOutputFields" noStyle>
                      <ColumnChecklist
                        columns={upstreamNodeColumnsMap[upstreamNodes[1]?.id || ""] || []}
                        emptyText="右表还没有可用字段结构。"
                      />
                    </Form.Item>
                  ),
                },
              ]}
            />
          </div>
        ) : null}

        {operatorCode === "replace" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                字段值替换
              </Typography.Title>
              <Typography.Text type="secondary">在同一个目标字段下支持配置多组替换规则，按顺序依次生效。</Typography.Text>
            </div>
            <Form.Item name="fieldName" label="目标字段" rules={[{ required: true, message: "请选择目标字段" }]}>
              <Select showSearch optionFilterProp="label" placeholder="选择字段" options={previewColumnOptions} />
            </Form.Item>
            <Form.List name="replaceRules">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule">
                      <Form.Item {...field} name={[field.name, "matchValue"]} label="原值" style={{ flex: 1 }}>
                        <Input placeholder="留空时匹配空值" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "replaceValue"]}
                        label="替换值"
                        rules={[{ required: true, message: "请输入替换值" }]}
                        style={{ flex: 1 }}
                      >
                        <Input placeholder="输入替换后的值" />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ matchValue: "", replaceValue: "" })}>
                    新增替换规则
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
        ) : null}

        {operatorCode === "format_convert" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                格式转换
              </Typography.Title>
              <Typography.Text type="secondary">封装日期、时间、字符串和数字之间的常用转换逻辑。</Typography.Text>
            </div>
            <Form.List name="formatRules">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule orchestration-inline-rule--aggregate">
                      <Form.Item
                        {...field}
                        name={[field.name, "sourceField"]}
                        label="源字段"
                        rules={[{ required: true, message: "请选择源字段" }]}
                        style={{ flex: "1 1 220px", minWidth: 220 }}
                      >
                        <Select showSearch optionFilterProp="label" placeholder="选择源字段" options={previewColumnOptions} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "targetField"]}
                        label="输出字段"
                        rules={[{ required: true, message: "请输入输出字段" }]}
                        style={{ flex: "1 1 220px", minWidth: 220 }}
                      >
                        <Input placeholder="例如 trade_time_text" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "transformType"]}
                        label="转换动作"
                        rules={[{ required: true, message: "请选择转换动作" }]}
                        style={{ flex: "0 0 220px", minWidth: 220 }}
                      >
                        <Select options={FORMAT_CONVERT_OPTIONS} />
                      </Form.Item>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) =>
                          prevValues?.formatRules?.[field.name]?.transformType !== currentValues?.formatRules?.[field.name]?.transformType
                        }
                      >
                        {() => {
                          const transformType = trimText(nodeForm.getFieldValue(["formatRules", field.name, "transformType"])) || "date_to_string";
                          return (
                            <>
                              {["date_to_string", "datetime_to_string", "string_to_date", "string_to_datetime"].includes(transformType) ? (
                                <Form.Item
                                  {...field}
                                  name={[field.name, "formatPattern"]}
                                  label="格式模板"
                                  style={{ flex: "1 1 220px", minWidth: 220 }}
                                >
                                  <Input placeholder="例如 YYYY-MM-DD HH24:MI:SS" />
                                </Form.Item>
                              ) : null}
                              {transformType === "string_to_number" ? (
                                <Form.Item
                                  {...field}
                                  name={[field.name, "targetType"]}
                                  label="目标数值类型"
                                  style={{ flex: "0 0 180px", minWidth: 180 }}
                                >
                                  <Select options={FORMAT_TARGET_TYPE_OPTIONS} />
                                </Form.Item>
                              ) : null}
                            </>
                          );
                        }}
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ sourceField: "", targetField: "", transformType: "date_to_string", formatPattern: "", targetType: "decimal" })}
                  >
                    新增转换规则
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
        ) : null}

        {operatorCode === "compliance_check" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                数据校验
              </Typography.Title>
              <Typography.Text type="secondary">支持内置规则、值域、自定义正则和固定值校验，可输出标记或校验后的字段值。</Typography.Text>
            </div>
            <Form.List name="complianceRules">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule orchestration-inline-rule--aggregate">
                      <Form.Item
                        {...field}
                        name={[field.name, "validationType"]}
                        label="校验类型"
                        rules={[{ required: true, message: "请选择校验类型" }]}
                        style={{ flex: "0 0 160px", minWidth: 160 }}
                      >
                        <Select options={VALIDATION_RULE_TYPE_OPTIONS} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "sourceField"]}
                        label="源字段"
                        rules={[{ required: true, message: "请选择源字段" }]}
                        style={{ flex: "1 1 220px", minWidth: 220 }}
                      >
                        <Select showSearch optionFilterProp="label" placeholder="选择源字段" options={previewColumnOptions} />
                      </Form.Item>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) =>
                          prevValues?.complianceRules?.[field.name]?.validationType !== currentValues?.complianceRules?.[field.name]?.validationType
                        }
                      >
                        {() => {
                          const validationType = trimText(nodeForm.getFieldValue(["complianceRules", field.name, "validationType"])) || "builtin";
                          if (validationType === "domain") {
                            return (
                              <Form.Item
                                {...field}
                                name={[field.name, "domainValues"]}
                                label="值域"
                                rules={[{ required: true, message: "请输入值域" }]}
                                style={{ flex: "1 1 240px", minWidth: 240 }}
                              >
                                <Input placeholder="多个值请用逗号分隔" />
                              </Form.Item>
                            );
                          }
                          if (validationType === "regex") {
                            return (
                              <Form.Item
                                {...field}
                                name={[field.name, "customPattern"]}
                                label="正则表达式"
                                rules={[{ required: true, message: "请输入正则表达式" }]}
                                style={{ flex: "1 1 240px", minWidth: 240 }}
                              >
                                <Input placeholder="例如 ^\\d{6}$" />
                              </Form.Item>
                            );
                          }
                          if (validationType === "fixed_value") {
                            return (
                              <Form.Item
                                {...field}
                                name={[field.name, "fixedValue"]}
                                label="固定值"
                                rules={[{ required: true, message: "请输入固定值" }]}
                                style={{ flex: "1 1 220px", minWidth: 220 }}
                              >
                                <Input placeholder="输入固定值" />
                              </Form.Item>
                            );
                          }
                          return (
                            <Form.Item
                              {...field}
                              name={[field.name, "checkType"]}
                              label="校验规则"
                              rules={[{ required: true, message: "请选择校验规则" }]}
                              style={{ flex: "0 0 200px", minWidth: 200 }}
                            >
                              <Select options={COMPLIANCE_CHECK_OPTIONS} />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "resultMode"]}
                        label="输出方式"
                        rules={[{ required: true, message: "请选择输出方式" }]}
                        style={{ flex: "0 0 180px", minWidth: 180 }}
                      >
                        <Select options={VALIDATION_RESULT_MODE_OPTIONS} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "targetField"]}
                        label="输出字段"
                        rules={[{ required: true, message: "请输入输出字段" }]}
                        style={{ flex: "1 1 220px", minWidth: 220 }}
                      >
                        <Input placeholder="例如 phone_check_result" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "defaultValue"]}
                        label="不通过默认值"
                        style={{ flex: "1 1 200px", minWidth: 200 }}
                      >
                        <Input placeholder="留空则使用 0 或空值" />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ validationType: "builtin", sourceField: "", targetField: "", checkType: "phone", customPattern: "", fixedValue: "", domainValues: "", resultMode: "flag", defaultValue: "" })}
                  >
                    新增校验规则
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
        ) : null}

        {operatorCode === "string_transform" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                字符处理
              </Typography.Title>
              <Typography.Text type="secondary">去空格、去前后缀、子串截取、字符替换、大小写转换等常用文本处理能力。</Typography.Text>
            </div>
            <Form.List name="stringRules">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule orchestration-inline-rule--aggregate">
                      <Form.Item
                        {...field}
                        name={[field.name, "sourceField"]}
                        label="源字段"
                        rules={[{ required: true, message: "请选择源字段" }]}
                        style={{ flex: "1 1 220px", minWidth: 220 }}
                      >
                        <Select showSearch optionFilterProp="label" placeholder="选择源字段" options={previewColumnOptions} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "targetField"]}
                        label="输出字段"
                        rules={[{ required: true, message: "请输入输出字段" }]}
                        style={{ flex: "1 1 220px", minWidth: 220 }}
                      >
                        <Input placeholder="例如 normalized_name" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "transformType"]}
                        label="处理动作"
                        rules={[{ required: true, message: "请选择处理动作" }]}
                        style={{ flex: "0 0 220px", minWidth: 220 }}
                      >
                        <Select options={STRING_TRANSFORM_OPTIONS} />
                      </Form.Item>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) =>
                          prevValues?.stringRules?.[field.name]?.transformType !== currentValues?.stringRules?.[field.name]?.transformType
                        }
                      >
                        {() => {
                          const transformType = trimText(nodeForm.getFieldValue(["stringRules", field.name, "transformType"])) || "trim";
                          if (["trim", "upper", "lower"].includes(transformType)) {
                            return null;
                          }
                          return (
                            <>
                              <Form.Item
                                {...field}
                                name={[field.name, "argument1"]}
                                label={transformType === "replace_text" ? "参数 1 / 原值" : "参数 1"}
                                style={{ flex: "1 1 180px", minWidth: 180 }}
                              >
                                <Input
                                  placeholder={
                                    transformType === "remove_prefix" || transformType === "remove_suffix"
                                      ? "输入去除的位数"
                                      : transformType === "substring"
                                        ? "起始位置"
                                        : transformType === "replace_text"
                                          ? "被替换的内容"
                                          : "参数 1"
                                  }
                                />
                              </Form.Item>
                              {["substring", "replace_text"].includes(transformType) ? (
                                <Form.Item
                                  {...field}
                                  name={[field.name, "argument2"]}
                                  label={transformType === "replace_text" ? "参数 2 / 替换值" : "参数 2"}
                                  style={{ flex: "1 1 180px", minWidth: 180 }}
                                >
                                  <Input placeholder={transformType === "substring" ? "长度，不填则取到最后" : "替换后的内容"} />
                                </Form.Item>
                              ) : null}
                            </>
                          );
                        }}
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ sourceField: "", targetField: "", transformType: "trim", argument1: "", argument2: "" })}
                  >
                    新增处理规则
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
        ) : null}

        {operatorCode === "desensitize" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                数据脱敏
              </Typography.Title>
              <Typography.Text type="secondary">支持掩码脱敏、哈希脱敏、截断和随机化，默认基于上游字段生成同名输出字段。</Typography.Text>
            </div>
            <Form.List name="desensitizeRules">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule orchestration-inline-rule--aggregate">
                      <Form.Item
                        {...field}
                        name={[field.name, "sourceField"]}
                        label="源字段"
                        rules={[{ required: true, message: "请选择源字段" }]}
                        style={{ flex: "1 1 220px", minWidth: 220 }}
                      >
                        <Select showSearch optionFilterProp="label" placeholder="选择源字段" options={previewColumnOptions} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "targetField"]}
                        label="输出字段"
                        rules={[{ required: true, message: "请输入输出字段" }]}
                        style={{ flex: "1 1 220px", minWidth: 220 }}
                      >
                        <Input placeholder="例如 mobile_masked" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "maskType"]}
                        label="脱敏方式"
                        rules={[{ required: true, message: "请选择脱敏方式" }]}
                        style={{ flex: "0 0 180px", minWidth: 180 }}
                      >
                        <Select options={DESENSITIZE_TYPE_OPTIONS} />
                      </Form.Item>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) =>
                          prevValues?.desensitizeRules?.[field.name]?.maskType !== currentValues?.desensitizeRules?.[field.name]?.maskType
                        }
                      >
                        {() => {
                          const maskType = trimText(nodeForm.getFieldValue(["desensitizeRules", field.name, "maskType"])) || "mask";
                          if (maskType === "mask") {
                            return (
                              <>
                                <Form.Item {...field} name={[field.name, "prefixLength"]} label="前缀保留" style={{ width: 120 }}>
                                  <InputNumber min={0} max={64} style={{ width: "100%" }} />
                                </Form.Item>
                                <Form.Item {...field} name={[field.name, "suffixLength"]} label="后缀保留" style={{ width: 120 }}>
                                  <InputNumber min={0} max={64} style={{ width: "100%" }} />
                                </Form.Item>
                                <Form.Item {...field} name={[field.name, "maskChar"]} label="掩码字符" style={{ width: 120 }}>
                                  <Input maxLength={1} placeholder="*" />
                                </Form.Item>
                              </>
                            );
                          }
                          if (maskType === "truncate") {
                            return (
                              <Form.Item {...field} name={[field.name, "truncateLength"]} label="保留长度" style={{ width: 140 }}>
                                <InputNumber min={0} max={256} style={{ width: "100%" }} />
                              </Form.Item>
                            );
                          }
                          return null;
                        }}
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ sourceField: "", targetField: "", maskType: "mask", maskChar: "*", prefixLength: 3, suffixLength: 4, truncateLength: 8 })}
                  >
                    新增脱敏规则
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
        ) : null}

        {operatorCode === "string_aggregate" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                字符串聚合配置
              </Typography.Title>
              <Typography.Text type="secondary">适合替代 group_concat 等场景，先按分组字段聚合，再把指定字段拼接成字符串。</Typography.Text>
            </div>
            <Form.Item name="groupByFields" label="分组字段">
              <Select mode="multiple" placeholder="不选则按全量数据聚合" options={previewColumnOptions} />
            </Form.Item>
            <Form.List name="stringAggregateRules">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule">
                      <Form.Item
                        {...field}
                        name={[field.name, "sourceField"]}
                        label="来源字段"
                        rules={[{ required: true, message: "请选择来源字段" }]}
                        style={{ flex: 1 }}
                      >
                        <Select showSearch optionFilterProp="label" placeholder="选择待聚合字段" options={previewColumnOptions} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "outputField"]}
                        label="输出字段"
                        rules={[{ required: true, message: "请输入输出字段" }]}
                        style={{ flex: 1 }}
                      >
                        <Input placeholder="例如 tags_text" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "separator"]}
                        label="分隔符"
                        style={{ flex: "0 0 140px", minWidth: 140 }}
                      >
                        <Input placeholder="," />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "distinct"]} valuePropName="checked" style={{ marginBottom: 0 }}>
                        <Checkbox>去重拼接</Checkbox>
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ sourceField: "", outputField: `agg_text_${fields.length + 1}`, separator: ",", distinct: false })}
                  >
                    新增聚合字段
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
        ) : null}

        {operatorCode === "string_split" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                字符串拆分配置
              </Typography.Title>
              <Typography.Text type="secondary">适合把 group_concat 结果或逗号分隔字段拆成多行，输出更贴近日常明细表。</Typography.Text>
            </div>
            <Space size={12} style={{ width: "100%" }}>
              <Form.Item name="sourceField" label="来源字段" rules={[{ required: true, message: "请选择来源字段" }]} style={{ flex: 1 }}>
                <Select showSearch optionFilterProp="label" placeholder="选择待拆分字段" options={previewColumnOptions} />
              </Form.Item>
              <Form.Item name="outputField" label="输出字段" rules={[{ required: true, message: "请输入输出字段" }]} style={{ flex: 1 }}>
                <Input placeholder="例如 tag" />
              </Form.Item>
            </Space>
            <Space size={12} style={{ width: "100%" }}>
              <Form.Item name="separator" label="分隔符" rules={[{ required: true, message: "请输入分隔符" }]} style={{ flex: 1 }}>
                <Input placeholder="," />
              </Form.Item>
              <Form.Item name="indexField" label="序号字段" style={{ flex: 1 }}>
                <Input placeholder="例如 tag_index，可留空" />
              </Form.Item>
            </Space>
            <Space size={16} wrap>
              <Form.Item name="trimItems" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Checkbox>去除拆分项首尾空格</Checkbox>
              </Form.Item>
              <Form.Item name="keepEmptyItems" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Checkbox>保留空拆分项</Checkbox>
              </Form.Item>
            </Space>
          </div>
        ) : null}

        {operatorCode === "pivot" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                行转列配置
              </Typography.Title>
              <Typography.Text type="secondary">先配置分组字段、透视字段和值字段，再指定透视值与输出列名的映射。</Typography.Text>
            </div>
            <Form.Item name="groupByFields" label="分组字段">
              <Select mode="multiple" placeholder="不选则按全量透视" options={previewColumnOptions} />
            </Form.Item>
            <Space size={12} style={{ width: "100%" }}>
              <Form.Item name="pivotField" label="透视字段" rules={[{ required: true, message: "请选择透视字段" }]} style={{ flex: 1 }}>
                <Select showSearch optionFilterProp="label" placeholder="选择透视字段" options={previewColumnOptions} />
              </Form.Item>
              <Form.Item name="valueField" label="值字段" rules={[{ required: true, message: "请选择值字段" }]} style={{ flex: 1 }}>
                <Select showSearch optionFilterProp="label" placeholder="选择值字段" options={previewColumnOptions} />
              </Form.Item>
              <Form.Item name="aggregateFunction" label="聚合方式" style={{ width: 180 }}>
                <Select options={AGGREGATE_FUNCTION_OPTIONS.filter((item) => item.value !== "count_distinct")} />
              </Form.Item>
            </Space>
            <Form.List name="pivotMappings">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule">
                      <Form.Item
                        {...field}
                        name={[field.name, "sourceValue"]}
                        label="透视值"
                        rules={[{ required: true, message: "请输入透视值" }]}
                        style={{ flex: 1 }}
                      >
                        <Input placeholder="例如 男 / 女" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "outputField"]}
                        label="输出列"
                        rules={[{ required: true, message: "请输入输出列名" }]}
                        style={{ flex: 1 }}
                      >
                        <Input placeholder="例如 male_count" />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ sourceValue: "", outputField: "" })}>
                    新增透视列
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
        ) : null}

        {operatorCode === "unpivot" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                列转行配置
              </Typography.Title>
              <Typography.Text type="secondary">将多列展开为属性名和属性值两列，方便后续聚合、过滤和装载。</Typography.Text>
            </div>
            <Form.Item name="groupByFields" label="保留字段">
              <Select mode="multiple" placeholder="这些字段会原样保留" options={previewColumnOptions} />
            </Form.Item>
            <Form.Item name="sourceFields" label="转行字段">
              <ColumnChecklist columns={previewColumns} emptyText="请先准备上游字段结构。" />
            </Form.Item>
            <Space size={12} style={{ width: "100%" }}>
              <Form.Item name="nameField" label="属性名字段" rules={[{ required: true, message: "请输入属性名字段" }]} style={{ flex: 1 }}>
                <Input placeholder="例如 metric_name" />
              </Form.Item>
              <Form.Item name="valueFieldName" label="属性值字段" rules={[{ required: true, message: "请输入属性值字段" }]} style={{ flex: 1 }}>
                <Input placeholder="例如 metric_value" />
              </Form.Item>
            </Space>
          </div>
        ) : null}

        {operatorCode === "window_compute" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                窗口计算
              </Typography.Title>
              <Typography.Text type="secondary">对常见窗口函数进行可视化封装，适合排名、累计、前后行取值等场景。</Typography.Text>
            </div>
            <Space size={12} style={{ width: "100%" }}>
              <Form.Item name="functionType" label="窗口函数" rules={[{ required: true, message: "请选择窗口函数" }]} style={{ flex: 1 }}>
                <Select options={WINDOW_FUNCTION_OPTIONS} />
              </Form.Item>
              <Form.Item name="outputField" label="输出字段" rules={[{ required: true, message: "请输入输出字段" }]} style={{ flex: 1 }}>
                <Input placeholder="例如 row_num" />
              </Form.Item>
            </Space>
            <Form.Item name="partitionByFields" label="PARTITION BY">
              <Select mode="multiple" placeholder="不选则按全量记录计算" options={previewColumnOptions} />
            </Form.Item>
            <Form.List name="orderByFields">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule">
                      <Form.Item
                        {...field}
                        name={[field.name, "fieldName"]}
                        label="ORDER BY 字段"
                        rules={[{ required: true, message: "请选择排序字段" }]}
                        style={{ flex: 1 }}
                      >
                        <Select showSearch optionFilterProp="label" placeholder="选择字段" options={previewColumnOptions} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "direction"]}
                        label="方向"
                        rules={[{ required: true, message: "请选择方向" }]}
                        style={{ width: 160 }}
                      >
                        <Select options={SORT_DIRECTION_OPTIONS} />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ fieldName: "", direction: "ASC" })}>
                    新增排序字段
                  </Button>
                </div>
              )}
            </Form.List>
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues?.functionType !== currentValues?.functionType}
            >
              {() => {
                const functionType = trimText(nodeForm.getFieldValue("functionType")) || "row_number";
                if (!["lag", "lead", "sum", "avg"].includes(functionType)) {
                  return null;
                }
                return (
                  <Space size={12} style={{ width: "100%" }}>
                    <Form.Item
                      name="sourceField"
                      label="目标字段"
                      rules={[{ required: true, message: "请选择目标字段" }]}
                      style={{ flex: 1 }}
                    >
                      <Select showSearch optionFilterProp="label" placeholder="选择字段" options={previewColumnOptions} />
                    </Form.Item>
                    {["lag", "lead"].includes(functionType) ? (
                      <>
                        <Form.Item name="offset" label="偏移量" style={{ width: 180 }}>
                          <InputNumber min={1} max={9999} style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item name="defaultValue" label="默认值" style={{ flex: 1 }}>
                          <Input placeholder="上一行或下一行不存在时使用" />
                        </Form.Item>
                      </>
                    ) : null}
                  </Space>
                );
              }}
            </Form.Item>
          </div>
        ) : null}

        {operatorCode === "aggregate" ? (
          <div className="orchestration-config-section">
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              聚合统计
            </Typography.Title>
            <Form.Item name="groupByFields" label="分组字段">
              <Select mode="multiple" placeholder="不选则按全量汇总" options={previewColumnOptions} />
            </Form.Item>
            <Form.List name="aggregations">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule orchestration-inline-rule--aggregate">
                      <Form.Item
                        {...field}
                        name={[field.name, "aggregateFunction"]}
                        label="函数"
                        rules={[{ required: true, message: "选择函数" }]}
                        style={{ flex: "0 0 160px", minWidth: 160 }}
                      >
                        <Select options={AGGREGATE_FUNCTION_OPTIONS} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "fieldName"]}
                        label="目标字段"
                        rules={[{ required: true, message: "选择字段" }]}
                        style={{ flex: "1 1 220px", minWidth: 220 }}
                      >
                        <Select showSearch optionFilterProp="label" options={aggregateFieldOptions} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "alias"]}
                        label="输出别名"
                        rules={[{ required: true, message: "输入别名" }]}
                        style={{ flex: "1 1 220px", minWidth: 220 }}
                      >
                        <Input placeholder="例如：valid_count" />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ aggregateFunction: "count", fieldName: "__all__", alias: `metric_${fields.length + 1}` })}
                  >
                    新增聚合指标
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
        ) : null}

        {isAiOperator ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                <Space size={8}>
                  <RobotOutlined />
                  大模型配置
                </Space>
              </Typography.Title>
              <Typography.Text type="secondary">
                {getAiPromptTemplateHint(normalizedAiOperatorCode)}
              </Typography.Text>
            </div>

            {!activeChatModelProviders.length ? (
              <Alert
                type="warning"
                showIcon
                message="暂无可用模型"
                description="请先在系统管理的模型管理中启用至少一个对话模型，再配置当前算子。"
              />
            ) : null}

            <Form.Item
              name="modelProviderId"
              label="模型配置"
              rules={[{ required: true, message: "请选择模型配置" }]}
              extra="来源于系统管理-模型管理，仅展示启用中的对话模型配置。"
            >
              <Select
                loading={modelProvidersLoading}
                placeholder="选择模型配置"
                options={activeChatModelProviders.map((item) => ({
                  value: item.id,
                  label: `${item.configName} / ${item.providerType}`,
                }))}
                onChange={(value: string | number) => {
                  const provider = activeChatModelProviders.find((item) => item.id === Number(value));
                  const catalog = buildFallbackCatalog(provider);
                  const nextModelName = catalog[0]?.name || trimText(provider?.modelName);
                  const nextVersion = getModelVersionOptions(catalog, nextModelName)[0]?.value || trimText(provider?.modelVersion || provider?.modelName);
                  nodeForm.setFieldsValue({
                    modelName: nextModelName,
                    modelVersion: nextVersion,
                  });
                }}
              />
            </Form.Item>

            <Space size={12} style={{ width: "100%" }}>
              <Form.Item
                name="modelName"
                label="模型名称"
                rules={[{ required: true, message: "请选择模型名称" }]}
                style={{ flex: 1 }}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择模型名称"
                  options={llmModelNameOptions}
                  disabled={!selectedModelProvider}
                  onChange={(value: string | number) => {
                    const nextVersion = getModelVersionOptions(llmModelCatalog, String(value || ""))[0]?.value || "";
                    nodeForm.setFieldsValue({ modelVersion: nextVersion });
                  }}
                />
              </Form.Item>
              {!llmVersionSelectionRedundant ? (
                <Form.Item
                  name="modelVersion"
                  label="模型版本"
                  rules={[{ required: true, message: "请选择模型版本" }]}
                  style={{ flex: 1 }}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="选择模型版本"
                    options={llmModelVersionOptions}
                    disabled={!selectedModelProvider}
                  />
                </Form.Item>
              ) : null}
            </Space>

            <Form.Item hidden
              name="outputFieldName"
              label="输出字段"
              rules={[{ required: true, message: "请输入输出字段" }]}
              extra={getAiOutputFieldWritebackHint(normalizedAiOperatorCode)}
            >
              <Input placeholder={getAiOutputFieldPlaceholder(normalizedAiOperatorCode)} />
            </Form.Item>

            <div className="orchestration-section-header" style={{ marginTop: 12 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                参数定义
              </Typography.Title>
              <Typography.Text type="secondary">先定义业务参数，再在提示词里输入 / 选择变量插入。</Typography.Text>
            </div>
            <Form.List name="promptVariables">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule orchestration-inline-rule--llm">
                      <Form.Item
                        {...field}
                        name={[field.name, "variableName"]}
                        label="参数名"
                        rules={[{ required: true, message: "请输入参数名" }]}
                        style={{ flex: "1 1 180px", minWidth: 180 }}
                      >
                        <Input placeholder="例如：customer_profile" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "sourceMode"]}
                        label="取值方式"
                        rules={[{ required: true, message: "请选择取值方式" }]}
                        style={{ flex: "0 0 180px", minWidth: 180 }}
                      >
                        <Select options={VARIABLE_SOURCE_MODE_OPTIONS} />
                      </Form.Item>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) =>
                          getPromptVariableRuleSourceMode(prevValues?.promptVariables?.[field.name] || {}) !==
                          getPromptVariableRuleSourceMode(currentValues?.promptVariables?.[field.name] || {})
                        }
                      >
                        {() => {
                          const currentRule = normalizePromptVariableFormRows([nodeForm.getFieldValue(["promptVariables", field.name])])[0] || {};
                          const sourceMode = getPromptVariableRuleSourceMode(currentRule);
                          if (sourceMode === "single_field") {
                            return (
                              <Form.Item
                                {...field}
                                name={[field.name, "sourceField"]}
                                label="来源字段"
                                rules={[{ required: true, message: "请选择来源字段" }]}
                                style={{ flex: "1 1 220px", minWidth: 220 }}
                              >
                                <Select showSearch optionFilterProp="label" placeholder="选择字段" options={previewColumnOptions} />
                              </Form.Item>
                            );
                          }
                          if (sourceMode === "selected_fields") {
                            return (
                              <Form.Item
                                {...field}
                                name={[field.name, "sourceFields"]}
                                label="字段范围"
                                rules={[{ required: true, type: "array", min: 1, message: "至少选择一个字段" }]}
                                style={{ flex: "1 1 320px", minWidth: 320 }}
                              >
                                <ColumnChecklist columns={previewColumns} emptyText="暂无可选字段，请先完成上游字段推导。" />
                              </Form.Item>
                            );
                          }
                          return (
                            <div className="orchestration-inline-rule__placeholder">
                              <Tag color="processing">{normalizedAiOperatorCode === "llm_batch" ? "整批数据对象" : "当前记录对象"}</Tag>
                            </div>
                          );
                        }}
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "defaultValue"]}
                        label="默认值"
                        style={{ flex: "1 1 180px", minWidth: 180 }}
                      >
                        <Input placeholder="字段为空时使用" />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ variableName: "", sourceMode: "single_field", sourceField: "", sourceFields: [], defaultValue: "" })}
                  >
                    新增参数规则
                  </Button>
                </div>
              )}
            </Form.List>

            <Form.Item
              label="系统提示词"
              extra="输入 / 可选择已定义参数，插入后自动写成 {{参数名}}。"
            >
              <div className="orchestration-prompt-editor">
                <Form.Item name="systemPrompt" noStyle>
                  <Input.TextArea
                    rows={4}
                    placeholder="例如：你是一名数据处理助手，请严格按要求输出。"
                    onFocus={(event) => {
                      setActivePromptField("systemPrompt");
                      promptInputRef.current.systemPrompt = event.target;
                    }}
                    onChange={(event) => handlePromptFieldChange("systemPrompt", event)}
                    onClick={(event) => handlePromptFieldCursorChange("systemPrompt", event)}
                    onKeyUp={(event) => handlePromptFieldCursorChange("systemPrompt", event)}
                    onBlur={() => handlePromptFieldBlur("systemPrompt")}
                    onKeyDown={(event) => handlePromptInputKeyDown("systemPrompt", event)}
                  />
                </Form.Item>
                {renderPromptVariableMenu("systemPrompt")}
              </div>
            </Form.Item>

            <Form.Item
              label="用户提示词"
              extra="只展示你自定义的参数，不再默认枚举所有上游字段。"
            >
              <div className="orchestration-prompt-editor">
                <Form.Item name="userPrompt" noStyle rules={[{ required: true, message: "请输入用户提示词" }]}>
                  <Input.TextArea
                    rows={6}
                    placeholder="例如：请基于 /customer_profile 提取关键信息，并输出结构化结果。"
                    onFocus={(event) => {
                      setActivePromptField("userPrompt");
                      promptInputRef.current.userPrompt = event.target;
                    }}
                    onChange={(event) => handlePromptFieldChange("userPrompt", event)}
                    onClick={(event) => handlePromptFieldCursorChange("userPrompt", event)}
                    onKeyUp={(event) => handlePromptFieldCursorChange("userPrompt", event)}
                    onBlur={() => handlePromptFieldBlur("userPrompt")}
                    onKeyDown={(event) => handlePromptInputKeyDown("userPrompt", event)}
                  />
                </Form.Item>
                {renderPromptVariableMenu("userPrompt")}
              </div>
            </Form.Item>

            <div className="orchestration-section-header" style={{ marginTop: 12 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                输出字段
              </Typography.Title>
              <Typography.Text type="secondary">
                {getAiOutputFieldWritebackHint(normalizedAiOperatorCode)}
              </Typography.Text>
            </div>
            <Form.List name="outputFields">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule orchestration-inline-rule--llm">
                      <Form.Item
                        {...field}
                        name={[field.name, "fieldName"]}
                        label="字段名"
                        rules={[{ required: true, message: "请输入字段名" }]}
                        style={{ flex: 1 }}
                      >
                        <Input placeholder={getAiOutputFieldPlaceholder(normalizedAiOperatorCode)} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "description"]}
                        label="字段说明"
                        style={{ flex: 2 }}
                      >
                        <Input placeholder="例如：姓名、联系电话、风险等级、摘要结论" />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ fieldName: `field_${fields.length + 1}`, description: "" })}
                  >
                    新增输出字段
                  </Button>
                </div>
              )}
            </Form.List>

            <Typography.Text type="secondary">
              {getAiExecutionHint(normalizedAiOperatorCode)}
            </Typography.Text>

          </div>
        ) : null}

        {operatorCode === "custom_sql" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                SQL 配置
              </Typography.Title>
              <Typography.Text type="secondary">多条上游连线会自动成为多个数据源，别名可直接作为临时表写入 SQL。</Typography.Text>
            </div>
            {upstreamNodes.length ? (
              <Form.List name="sqlInputs">
                {(fields) => (
                  <div className="orchestration-list-block">
                    {fields.map((field, index) => (
                      <div key={field.key} className="orchestration-inline-rule">
                        <Form.Item label="上游节点" style={{ flex: 1 }}>
                          <Input
                            value={trimText(upstreamNodes[index]?.data?.nodeName) || trimText(upstreamNodes[index]?.id) || "-"}
                            readOnly
                          />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, "alias"]}
                          label="临时表别名"
                          rules={[
                            { required: true, message: "请输入临时表别名" },
                            { pattern: /^[\p{L}_][\p{L}\p{N}_]*$/u, message: "仅支持字母、数字、下划线，且不能以数字开头" },
                          ]}
                          style={{ flex: 1 }}
                        >
                          <Input placeholder={`temp${index + 1}`} />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, "sourceNodeKey"]} hidden>
                          <Input />
                        </Form.Item>
                      </div>
                    ))}
                  </div>
                )}
              </Form.List>
            ) : (
              <div className="orchestration-config-empty">请先连接上游节点，SQL 节点会自动收集所有输入数据源。</div>
            )}
            <Form.Item
              name="sqlText"
              label="节点 SQL"
              rules={[{ required: true, message: "请输入节点 SQL" }]}
              extra="默认临时表名会自动按 temp1、temp2 生成，系统同时保留 input_1、input_2、input_data 兼容别名。"
            >
              <Input.TextArea rows={10} placeholder="SELECT * FROM input_data WHERE ..." />
            </Form.Item>
          </div>
        ) : null}

        {false && operatorCode === "custom_sql" ? (
          <div className="orchestration-config-section">
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              SQL 配置
            </Typography.Title>
            <Form.Item
              name="sqlText"
              label="节点 SQL"
              rules={[{ required: true, message: "请输入节点 SQL" }]}
              extra="系统会将上游节点注入为 input_1 / input_2 / input_data 供当前节点引用。"
            >
              <Input.TextArea rows={10} placeholder="SELECT * FROM input_data WHERE ..." />
            </Form.Item>
          </div>
        ) : null}

        {nodeType === "output" ? (
          <div className="orchestration-config-section">
            <div className="orchestration-section-header">
              <Typography.Title level={5} style={{ margin: 0 }}>
                输出配置
              </Typography.Title>
              <Typography.Text type="secondary">支持直接写入现有目标表，或者基于当前输出结构创建目标表后再装载。</Typography.Text>
            </div>
            <Form.Item name="createTargetTable" valuePropName="checked">
              <Checkbox>自动创建目标表</Checkbox>
            </Form.Item>
            <Form.Item
              name="targetTable"
              label="目标表"
              rules={[{ required: true, message: "请选择或输入目标表" }]}
              extra={watchedCreateTargetTable ? "建表模式下可直接输入新表名。" : "选择现有目标表后，可按目标字段完成来源映射。"}
            >
              {watchedCreateTargetTable ? (
                <Input placeholder="例如 dwd_user_profile_ai" />
              ) : (
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择目标表"
                  options={tables.map((item) => ({
                    value: item.name,
                    label: item.comment ? `${item.name} / ${item.comment}` : item.name,
                  }))}
                />
              )}
            </Form.Item>
            <Form.Item name="writeMode" label="写入方式">
              <Select options={WRITE_MODE_OPTIONS} />
            </Form.Item>
            <div className="orchestration-section-header" style={{ marginTop: 8 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                字段映射
              </Typography.Title>
              <Typography.Text type="secondary">
                {watchedCreateTargetTable
                  ? "建表模式下可直接定义新表字段名。"
                  : outputTargetColumns.length
                    ? `已加载目标表字段 ${outputTargetColumns.length} 个`
                    : "选择目标表后自动加载目标字段；如暂未读取到字段，也可先手工补齐映射。"}
              </Typography.Text>
            </div>
            <Form.List name="outputFieldMappings">
              {(fields, { add, remove }) => (
                <div className="orchestration-list-block">
                  {fields.map((field) => (
                    <div key={field.key} className="orchestration-inline-rule">
                      <Form.Item
                        {...field}
                        name={[field.name, "sourceField"]}
                        label="来源字段"
                        rules={[{ required: true, message: "请选择来源字段" }]}
                        style={{ flex: 1 }}
                      >
                        <Select showSearch optionFilterProp="label" placeholder="选择来源字段" options={previewColumnOptions} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "targetField"]}
                        label="目标字段"
                        rules={[{ required: true, message: "请选择或输入目标字段" }]}
                        style={{ flex: 1 }}
                      >
                        {watchedCreateTargetTable || !outputTargetColumns.length ? (
                          <Input placeholder="例如 report_time" />
                        ) : (
                          <Select
                            loading={outputTargetColumnsLoading}
                            showSearch
                            optionFilterProp="label"
                            placeholder="选择目标字段"
                            options={outputTargetColumnOptions}
                          />
                        )}
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add({
                        sourceField: previewColumns[fields.length]?.name || "",
                        targetField: watchedCreateTargetTable
                          ? previewColumns[fields.length]?.name || ""
                          : outputTargetColumns[fields.length]?.name || "",
                      })
                    }
                  >
                    新增字段映射
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
        ) : null}

        {false ? <div className="orchestration-config-section">
          <div className="orchestration-schema-summary">
            <Typography.Title level={5} style={{ margin: 0 }}>
              上游字段参考
            </Typography.Title>
            <Typography.Text type="secondary">
              {previewColumns.length ? `${previewColumns.length} 个字段` : "无可用结构"}
            </Typography.Text>
          </div>
          {previewColumns.length ? (
            <Table
              size="small"
              pagination={false}
              rowKey="name"
              loading={previewLoading}
              className="orchestration-schema-table"
              dataSource={previewColumns}
              columns={[
                {
                  title: "字段",
                  dataIndex: "name",
                  width: 320,
                  render: (_, record: DevColumnEntry) => (
                    <div className="orchestration-schema-table__field">
                      <FieldOptionCard option={buildFieldSelectOption(record)} />
                    </div>
                  ),
                },
                {
                  title: "约束",
                  width: 90,
                  render: (_, record: DevColumnEntry) => (
                    <Space wrap size={4}>
                      {record.primaryKey ? <Tag color="gold">PK</Tag> : null}
                      {!record.nullable ? <Tag color="blue">非空</Tag> : null}
                    </Space>
                  ),
                },
              ]}
            />
          ) : (
            <div className="orchestration-config-empty">
              {selectedNode?.data?.nodeType === "source"
                ? "当前源节点还没有拿到表字段结构，请确认表对象是否可访问。"
                : schemaSourceOptions.length
                  ? "当前上游节点还没有可用的字段结构。"
                  : "请先将当前节点与上游节点连线，再配置字段相关逻辑。"}
            </div>
          )}
        </div> : null}

        <div className="orchestration-config-section">
          <div className="orchestration-preview-header">
            <div>
              <Typography.Title level={5} style={{ margin: 0 }}>
                算子结果预览
              </Typography.Title>
              <Typography.Text type="secondary">支持查看当前节点 SQL 和样例结果</Typography.Text>
            </div>
            <Button icon={<EyeOutlined />} loading={nodePreviewLoading} onClick={() => void handlePreviewNode()}>
              预览当前算子
            </Button>
          </div>

          {nodePreview ? (
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <div className="orchestration-sql-preview__meta">
                <Tag color="blue">{nodePreview.nodeName}</Tag>
                <Tag color="purple">{getOperatorMeta(nodePreview.operatorCode, nodePreview.nodeType as CanvasNodeType).label}</Tag>
                <Tag color="green">字段 {nodePreview.fields.length || nodePreview.columns.length}</Tag>
                <Tag color="cyan">结果 {nodePreview.rowCount}</Tag>
                <Tag color="gold">耗时 {nodePreview.durationMs} ms</Tag>
              </div>

              {nodePreview.warnings.length ? (
                <Alert
                  type="warning"
                  showIcon
                  message="预览提示"
                  description={
                    <Space direction="vertical" size={4} style={{ display: "flex" }}>
                      {nodePreview.warnings.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </Space>
                  }
                />
              ) : null}

              {nodePreviewTableColumns.length ? (
                <Table
                  size="small"
                  pagination={false}
                  className="orchestration-preview-table"
                  rowKey={(record) => String((record as Record<string, unknown>).__previewKey)}
                  dataSource={nodePreview.rows.map((row, index) => ({ __previewKey: index, ...row }))}
                  columns={nodePreviewTableColumns}
                  scroll={{ x: Math.max(720, nodePreviewTableColumns.length * 160) }}
                />
              ) : (
                <div className="orchestration-config-empty">当前节点暂无可展示的预览结果，通常是因为没有命中数据或节点尚未配置完成。</div>
              )}

              <Collapse
                items={[
                  {
                    key: "preview-sql",
                    label: "预览 SQL",
                    children: <SqlCodeBlock value={nodePreview.previewSql} />,
                  },
                  {
                    key: "node-sql",
                    label: `节点 SQL / ${nodePreview.cteName || selectedNode.id}`,
                    children: <SqlCodeBlock value={nodePreview.nodeSql} />,
                  },
                ]}
              />
            </Space>
          ) : (
            <div className="orchestration-config-empty">点击“预览当前算子”后，可查看当前节点的样例结果和 SQL。</div>
          )}
        </div>

        {false ? <Button danger block icon={<DeleteOutlined />} onClick={() => removeSelectedNode(selectedNode?.id || "")}>
          删除节点
        </Button> : null}
      </Form>
    );
  }

  return (
    <div className={`app-page${canvasExpanded ? " orchestration-page--expanded" : ""}`}>
      <PageToolbar
        left={
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={onBackToList}>
              返回列表
            </Button>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {task.name}
            </Typography.Title>
            <Button type="primary" loading={orchestrationRunning} onClick={() => void handleRunCurrentOrchestration()}>
              立即运行
            </Button>
          </>
        }
        right={
          <>
            <Select
              placeholder="选择数据源"
              allowClear
              style={{ width: 220 }}
              value={selectedDatasourceId}
              options={datasourceSelectOptions}
              onChange={(value: number) => {
                setSelectedDatasourceId(value);
                setSelectedDatabase("");
                setObjectKeyword("");
              }}
            />
            <Select
              placeholder="选择数据库 / Schema"
              allowClear
              style={{ width: 220 }}
              value={selectedDatabase || undefined}
              options={databases.map((item) => ({ value: item.name, label: item.name }))}
              disabled={!selectedDatasourceId}
              onChange={(value: string) => {
                setSelectedDatabase(value || "");
                setObjectKeyword("");
              }}
            />
            <Button onClick={() => applyAutoLayout("horizontal")}>横向排版</Button>
            <Button onClick={() => applyAutoLayout("vertical")}>纵向排版</Button>
            <Button
              icon={canvasExpanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => setCanvasExpanded((current) => !current)}
            >
              {canvasExpanded ? "缩放" : "扩展"}
            </Button>
            <Button icon={<CodeOutlined />} loading={sqlPreviewLoading} onClick={() => void handlePreviewSql()}>
              SQL 预览
            </Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void handleSave()}>
              保存
            </Button>
          </>
        }
      />

      <div className={`app-page-body workspace-page-body${canvasExpanded ? " orchestration-workspace-page-body--expanded" : ""}`}>
        <div
          className="workspace-side-dock"
          style={{ top: showSidebar ? 328 : 308, left: -6 }}
        >
          <Button
            className="workspace-side-dock__button"
            icon={sidebarVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            title={sidebarVisible ? "隐藏左侧功能区" : "显示左侧功能区"}
            onClick={() => setSidebarVisible((value) => !value)}
          />
        </div>
        <div
          className={`workspace-layout workspace-layout--compact orchestration-workspace${canvasExpanded ? " orchestration-workspace--expanded" : ""}`}
          style={{ gridTemplateColumns: showSidebar ? `${sidebarWidth}px 10px minmax(0, 1fr)` : "minmax(0, 1fr)" }}
        >
          {showSidebar ? (
          <aside className="workspace-sidebar">
            <section className="workspace-sidebar__section workspace-sidebar__section--compact">
              <div className="workspace-sidebar__stack">
                <Typography.Title level={4} style={{ margin: 0 }}>
                  数据对象树
                </Typography.Title>
                <Input.Search
                  allowClear
                  placeholder="搜索表或函数"
                  value={objectKeyword}
                  onChange={(event) => setObjectKeyword(event.target.value)}
                />
                <div className="workspace-sidebar__scroll workspace-tree-scroll">
                  {selectedDatasourceId ? (
                    <Tree
                      blockNode
                      className="workspace-object-tree"
                      defaultExpandAll
                      treeData={objectTreeData}
                      titleRender={(node) => {
                        const key = String(node.key || "");
                        if (!key.startsWith("table:")) return <span>{String(node.title)}</span>;
                        return (
                          <div
                            draggable
                            className="orchestration-library-item orchestration-library-item--tree"
                            onDragStart={(event) => {
                              const [, databaseName, tableName] = key.split(":");
                              event.dataTransfer.setData(
                                "application/medata-orchestration-source",
                                JSON.stringify({
                                  nodeType: "source",
                                  operatorCode: "source_table",
                                  nodeName: tableName,
                                  nodeConfig: {
                                    datasourceId: selectedDatasourceId,
                                    databaseName,
                                    tableName,
                                  },
                                })
                              );
                            }}
                          >
                            <Space size={8}>
                              <TableOutlined />
                              <span>{String(node.title)}</span>
                            </Space>
                          </div>
                        );
                      }}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="先选择数据源，再拖拽对象到画布" />
                  )}
                </div>
              </div>
            </section>

            <section className="workspace-sidebar__section workspace-sidebar__section--compact">
              <div className="workspace-sidebar__stack">
                <Typography.Title level={4} style={{ margin: 0 }}>
                  算子库
                </Typography.Title>
                <div className="workspace-sidebar__scroll">
                  <List
                    className="soft-list soft-list--compact"
                    dataSource={operatorLibraryGroups}
                    renderItem={(group) => (
                      <List.Item className="orchestration-operator-group__item">
                        <div className="orchestration-operator-group">
                          <div className="orchestration-operator-group__header">
                            <div>
                              <div className="orchestration-operator-group__title">{group.label}</div>
                              <div className="orchestration-operator-group__desc">{group.description}</div>
                            </div>
                            <Tag color="blue">{group.items.length}</Tag>
                          </div>
                          <div className="orchestration-operator-grid">
                            {group.items.map((item) => (
                              <div
                                key={item.operatorCode}
                                className="orchestration-operator-tile orchestration-library-item"
                                draggable
                                onDragStart={(event) =>
                                  event.dataTransfer.setData("application/medata-orchestration-operator", JSON.stringify(item))
                                }
                              >
                                <div className="orchestration-operator-tile__icon" style={{ color: item.color, background: `${item.color}14` }}>
                                  {item.badge}
                                </div>
                                <div className="orchestration-operator-tile__title">{item.label}</div>
                                <div className="orchestration-operator-tile__desc">{item.description}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>
              </div>
            </section>
          </aside>
          ) : null}

          {showSidebar ? (
          <div
            className={`workspace-splitter${sidebarResizing ? " is-active" : ""}`}
            onMouseDown={(event) => {
              event.preventDefault();
              startSidebarResize(event.clientX);
            }}
          />
          ) : null}

          <section className="workspace-panel workspace-panel--resizable">
            <Card
              className="orchestration-canvas-card"
              styles={{ body: { padding: 0, height: "100%" } }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const fallbackBounds = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                const flowPosition = reactFlowInstanceRef.current?.screenToFlowPosition({
                  x: event.clientX,
                  y: event.clientY,
                });
                const position = flowPosition
                  ? {
                      x: flowPosition.x - ORCHESTRATION_NODE_WIDTH / 2,
                      y: flowPosition.y - ORCHESTRATION_NODE_MIN_HEIGHT / 2,
                    }
                  : {
                      x: event.clientX - fallbackBounds.left - ORCHESTRATION_NODE_WIDTH / 2,
                      y: event.clientY - fallbackBounds.top - ORCHESTRATION_NODE_MIN_HEIGHT / 2,
                    };

                const sourcePayload = event.dataTransfer.getData("application/medata-orchestration-source");
                if (sourcePayload) {
                  const parsed = JSON.parse(sourcePayload) as {
                    nodeType: CanvasNodeType;
                    operatorCode: string;
                    nodeName: string;
                    nodeConfig: Record<string, unknown>;
                  };
                  setNodes((current) => current.concat(createCanvasNode({ ...parsed, position, layoutDirection: canvasLayoutDirection })));
                  return;
                }

                const operatorPayload = event.dataTransfer.getData("application/medata-orchestration-operator");
                if (operatorPayload) {
                  const parsed = JSON.parse(operatorPayload) as OperatorTemplate;
                  setNodes((current) => current.concat(createOperatorNode(parsed, position)));
                }
              }}
            >
              <div
                className="orchestration-canvas"
                ref={canvasRef}
                onMouseDownCapture={handleCanvasMouseDownCapture}
                onContextMenu={(event) => {
                  event.preventDefault();
                }}
              >
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onInit={handleReactFlowInit}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                  onSelectionChange={handleSelectionChange}
                  onConnect={handleConnect}
                  onNodeClick={handleNodeClick}
                  connectionLineStyle={ORCHESTRATION_CONNECTION_LINE_STYLE}
                  selectionOnDrag={false}
                  panOnDrag={ORCHESTRATION_PAN_ON_DRAG}
                  fitView
                >
                  <Background gap={20} size={1} color="#dbeafe" />
                  <MiniMap
                    zoomable
                    pannable
                    nodeColor={(node) => getOperatorMeta(String(node.data?.operatorCode || ""), node.data?.nodeType as CanvasNodeType).color}
                    style={{ background: "#fff", border: "1px solid #d9e0ea" }}
                  />
                  <Controls />
                </ReactFlow>
                {canvasMarqueeStyle ? <div className="orchestration-marquee" style={canvasMarqueeStyle} /> : null}
                {!nodes.length ? (
                  <div className="orchestration-canvas__empty">
                    <PartitionOutlined />
                    <div>从左侧拖拽数据对象或算子到画布，开始搭建算子任务。</div>
                  </div>
                ) : null}
              </div>
            </Card>
          </section>
        </div>
      </div>

      <Drawer
        open={nodeDrawerOpen}
        width={nodeDrawerWidth}
        destroyOnClose
        styles={{ body: { padding: 0, position: "relative", overflow: "visible" } }}
        title={selectedNode ? `节点配置 / ${selectedNode.data.nodeName}` : "节点配置"}
        onClose={() => {
          setNodeDrawerOpen(false);
          setSelectedNodeId(undefined);
        }}
      >
        <div className="orchestration-node-drawer">
          <div
            className={`orchestration-node-drawer__resize-handle${drawerResizing ? " is-active" : ""}`}
            onMouseDown={(event) => {
              event.preventDefault();
              startDrawerResize(event.clientX);
            }}
          />
          <div className="orchestration-node-drawer__body">{renderDesignerNodeConfig()}</div>
        </div>
      </Drawer>

      <Modal
        open={sqlPreviewOpen}
        title={sqlPreview ? `SQL 预览 / ${sqlPreview.taskName}` : "SQL 预览"}
        width={1280}
        footer={[
          <Button key="close" onClick={() => setSqlPreviewOpen(false)}>
            关闭
          </Button>,
        ]}
        onCancel={() => setSqlPreviewOpen(false)}
      >
        {sqlPreview ? (
          <Space direction="vertical" size={16} style={{ display: "flex" }}>
            <div className="orchestration-sql-preview__meta">
              <Tag color="blue">{sqlPreview.datasourceType || sqlPreview.dialect}</Tag>
              <Tag color="cyan">最终节点 {sqlPreview.finalNodeName}</Tag>
              <Tag color="green">字段 {sqlPreview.finalColumns.length}</Tag>
              <Tag color="purple">节点 {sqlPreview.nodeSqls.length}</Tag>
            </div>

            {sqlPreview.warnings.length ? (
              <Alert
                type="warning"
                showIcon
                message="编译提示"
                description={
                  <Space direction="vertical" size={4} style={{ display: "flex" }}>
                    {sqlPreview.warnings.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </Space>
                }
              />
            ) : null}

            <Tabs items={buildSqlPreviewTabItems(sqlPreview)} />
          </Space>
        ) : (
          <Empty description="生成 SQL 预览后可在这里查看" />
        )}
      </Modal>

      <Modal
        open={scheduleModalOpen}
        title="调度配置"
        onCancel={() => setScheduleModalOpen(false)}
        footer={[
          <Button key="run" icon={<PlayCircleOutlined />} loading={orchestrationRunning} onClick={() => void handleRunCurrentOrchestration()}>
            运行一次
          </Button>,
          <Button key="cancel" onClick={() => setScheduleModalOpen(false)}>
            取消
          </Button>,
          <Button key="save" type="primary" loading={saving} onClick={() => void handleSaveSchedule()}>
            保存
          </Button>,
        ]}
        onOk={() => void handleSaveSchedule()}
        confirmLoading={saving}
      >
        <Form layout="vertical" form={scheduleForm}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="调度方式"
            description="参考接入任务开发的配置方式，先选运行模式，再补充时间、重试和超时设置。"
          />
          <Row gutter={[12, 0]}>
            <Col xs={24} md={12} xl={8}>
              <Form.Item name="scheduleType" label="调度方式" rules={[{ required: true, message: "请选择调度方式" }]}>
                <Select
                  options={[
                    { value: "manual", label: "手动执行" },
                    { value: "interval", label: "固定间隔" },
                    { value: "daily", label: "每天执行" },
                    { value: "weekly", label: "每周执行" },
                    { value: "monthly", label: "每月执行" },
                    { value: "custom", label: "Cron 表达式" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={8}>
              {scheduleType === "interval" ? (
                <Form.Item
                  name="intervalMinutes"
                  label="间隔分钟"
                  rules={[{ required: true, message: "请输入间隔分钟" }]}
                >
                  <InputNumber min={1} max={720} style={{ width: "100%" }} />
                </Form.Item>
              ) : null}
              {scheduleType === "daily" || scheduleType === "weekly" || scheduleType === "monthly" ? (
                <Form.Item name="runTime" label="执行时间" rules={[{ required: true, message: "请选择执行时间" }]}>
                  <Input type="time" />
                </Form.Item>
              ) : null}
              {scheduleType === "custom" ? (
                <Form.Item name="cronExpr" label="Cron 表达式" rules={[{ required: true, message: "请输入 Cron 表达式" }]}>
                  <Input placeholder="例如：0 2 * * *" />
                </Form.Item>
              ) : null}
            </Col>
            <Col xs={24} md={12} xl={8}>
              {scheduleType === "weekly" ? (
                <Form.Item name="weekDays" label="执行日" rules={[{ required: true, message: "请选择执行日" }]}>
                  <Select mode="multiple" placeholder="选择每周执行日" options={WEEK_DAY_OPTIONS} />
                </Form.Item>
              ) : null}
              {scheduleType === "monthly" ? (
                <Form.Item name="monthDay" label="每月日期" rules={[{ required: true, message: "请输入每月日期" }]}>
                  <InputNumber min={1} max={31} style={{ width: "100%" }} />
                </Form.Item>
              ) : null}
              {scheduleType !== "manual" ? (
                <Form.Item name="isPaused" label="调度状态">
                  <Select options={[{ value: false, label: "启用调度" }, { value: true, label: "暂停调度" }]} />
                </Form.Item>
              ) : null}
            </Col>
          </Row>
          <Form.Item hidden name="legacyCronExpr" label="Cron 表达式">
            <Input placeholder="留空表示手动执行，例如：0 2 * * *" />
          </Form.Item>
          <Form.Item hidden name="legacyIsPaused" label="是否暂停">
            <Select options={[{ value: false, label: "启用调度" }, { value: true, label: "暂停调度" }]} />
          </Form.Item>
          <Row gutter={[12, 0]}>
            <Col xs={24} md={12}>
              <Form.Item name="retryTimes" label="失败重试次数">
                <InputNumber min={0} max={10} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="timeoutSec" label="运行超时(秒)">
                <InputNumber min={1} max={7200} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
