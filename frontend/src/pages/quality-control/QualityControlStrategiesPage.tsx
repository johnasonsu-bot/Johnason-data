import {
  ArrowLeftOutlined,
  BulbOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { StatCard } from "../../components/ui/StatCard";
import { StatusTag } from "../../components/ui/StatusTag";
import {
  deleteQualityStrategyTable,
  deleteQualityStrategyVersion,
  applyQualityRecommendationRun,
  rejectQualityRecommendationRun,
  fetchQualityDictionaries,
  fetchQualitySourceColumns,
  fetchQualitySourceTables,
  fetchQualityRegexRules,
  fetchQualitySources,
  fetchQualityStrategyDetail,
  fetchQualityStrategyTables,
  fetchQualityInsightBusinessSystems,
  fetchQualityInsightTags,
  fetchQualityRecommendationRun,
  saveQualityInsightTag,
  saveQualityStrategyDraft,
  startQualityRecommendation,
  submitQualityStrategy,
  updateQualityMonitorTableGovernance,
  type QualityStrategyDraftPayload,
} from "../../services/qualityControl";
import { HttpError } from "../../services/http";
import type {
  DataSourceColumn,
  DataSourceTable,
  QualityDictionaryRecord,
  QualityAdvancedRuleRecord,
  QualityMonitorSourceRecord,
  QualityMonitorTableRecord,
  QualityRegexRuleRecord,
  QualityStrategyDetail,
  QualityStrategyFieldRecord,
  QualityStrategyVersionRecord,
  QualityRecommendationRun,
  QualityRecommendationSettings,
} from "../../types/api";

type ValueRangeMode =
  | "none"
  | "dictionary"
  | "custom_list"
  | "number_range"
  | "date_range";

type ValueRangeConfigRecord = NonNullable<QualityStrategyFieldRecord["valueRangeConfig"]>;
type ValueRangeSnapshotRecord = NonNullable<QualityStrategyFieldRecord["valueRangeSnapshot"]>;
type AdvancedRuleGroup = "row" | "stat" | "cross";
type StrategyStatKey =
  | "total"
  | "configuredFields"
  | "unconfiguredFields"
  | "configuredRules"
  | "field"
  | "row"
  | "stat"
  | "cross";
type AdvancedRuleCategory =
  | "conditional_required"
  | "conditional_regex"
  | "field_compare"
  | "composite_unique"
  | "freshness"
  | "volume_anomaly"
  | "null_rate_change"
  | "batch_completeness"
  | "cross_table_lookup"
  | "cross_table_consistency";

const advancedRuleDefinitions: Array<{ value: AdvancedRuleCategory; label: string; group: AdvancedRuleGroup }> = [
  { value: "conditional_required", label: "条件型非空/置空", group: "row" },
  { value: "conditional_regex", label: "条件型格式校验", group: "row" },
  { value: "field_compare", label: "跨字段比较", group: "row" },
  { value: "composite_unique", label: "联合字段唯一", group: "row" },
  { value: "freshness", label: "数据时效性", group: "stat" },
  { value: "volume_anomaly", label: "数据量波动", group: "stat" },
  { value: "null_rate_change", label: "空值率变化", group: "stat" },
  { value: "batch_completeness", label: "批次完整性", group: "stat" },
  { value: "cross_table_lookup", label: "跨表存在性", group: "cross" },
  { value: "cross_table_consistency", label: "跨表一致性", group: "cross" },
];

const advancedRuleSeverityOptions = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

function getAdvancedRuleCategoryLabel(category?: string) {
  return advancedRuleDefinitions.find((item) => item.value === category)?.label || "未识别规则";
}

function getAdvancedRuleActivationHint(rule: QualityAdvancedRuleRecord) {
  if (!['volume_anomaly', 'null_rate_change'].includes(String(rule.ruleCategory || ''))) return '可立即执行';
  const config = rule.config || {};
  const minimum = Math.max(1, Number(config.minHistoryBatches || (config.baselineMode === 'last_batch' ? 1 : 3)));
  if (config.warmupPolicy === 'upper_threshold' && config.warmupThreshold !== null && config.warmupThreshold !== undefined) {
    return `需积累 ${minimum} 批历史；积累期间仅当前指标超过 ${config.warmupThreshold} 时告警`;
  }
  return `需积累 ${minimum} 批历史；积累期间仅记录指标、不告警`;
}

function getValueRangeModeLabel(mode?: ValueRangeMode | string | null) {
  const normalized = String(mode || "").trim().toLowerCase();
  if (normalized === "dictionary") return "业务字典表";
  if (normalized === "custom_list" || normalized === "list") return "自定义值";
  if (normalized === "number_range" || normalized === "range") return "数值区间";
  if (normalized === "date_range") return "日期区间";
  return normalized || "-";
}

function getAdvancedRuleOptions(group?: AdvancedRuleGroup) {
  return advancedRuleDefinitions
    .filter((item) => !group || item.group === group)
    .map(({ value, label }) => ({ value, label }));
}

function getAdvancedRuleScope(category: string) {
  if (category === "composite_unique") return "table";
  const group = getAdvancedRuleGroup(category);
  if (group === "cross") return "cross_table";
  if (group === "stat") return "aggregate";
  if (group === "row") return "row";
  return "table";
}

function getAdvancedRuleGroup(category?: string): AdvancedRuleGroup {
  return advancedRuleDefinitions.find((item) => item.value === category)?.group || "row";
}

function getAdvancedRuleFields(rule: QualityAdvancedRuleRecord) {
  const config = rule.config || {};
  if (Array.isArray(config.fieldNames)) return config.fieldNames.join(" + ");
  if (rule.ruleCategory === "conditional_required") return [config.conditionField, config.targetField].filter(Boolean).join(" -> ");
  if (rule.ruleCategory === "conditional_regex") return [config.conditionField, config.targetField].filter(Boolean).join(" -> ");
  if (rule.ruleCategory === "field_compare") return [config.leftField, config.rightField].filter(Boolean).join(" / ");
  if (rule.ruleCategory === "freshness") return config.timeField || "-";
  if (rule.ruleCategory === "volume_anomaly") return "row_count";
  if (rule.ruleCategory === "null_rate_change") return config.metricField || "-";
  if (rule.ruleCategory === "batch_completeness") return config.dimensionField || "-";
  if (rule.ruleCategory === "cross_table_lookup") return `${(config.localFields || []).join(" + ")} -> ${config.refTable || "-"}`;
  if (rule.ruleCategory === "cross_table_consistency") return `${(config.localFields || []).join(" + ")} -> ${config.refTable || "-"} / ${(config.comparePairs || []).map((item: any) => `${item.localField}=${item.refField}`).join(", ")}`;
  return "-";
}

function formatRuleFieldLabel(fieldName: string, fieldCommentMap: Record<string, string>) {
  const normalized = String(fieldName || "").trim();
  if (!normalized) return "-";
  const comment = String(fieldCommentMap[normalized] || "").trim();
  return comment && comment !== "-" ? `${normalized}（${comment}）` : normalized;
}

function formatRuleTableLabel(tableName: string, tableCommentMap: Record<string, string>) {
  const normalized = String(tableName || "").trim();
  if (!normalized) return "-";
  const comment = String(tableCommentMap[normalized] || "").trim();
  return comment ? `${normalized}（${comment}）` : normalized;
}

function getRecommendationRuleTitle(
  rule: QualityAdvancedRuleRecord,
  fieldCommentMap: Record<string, string>,
  tableCommentMap: Record<string, string>,
) {
  const config = rule.config || {};
  const label = (fieldName: string) => formatRuleFieldLabel(fieldName, fieldCommentMap);

  if (rule.ruleCategory === "conditional_required") {
    return `${label(config.conditionField)} 有值时 ${label(config.targetField)}${config.requirement === "empty" ? "必须为空" : "必须非空"}`;
  }
  if (rule.ruleCategory === "field_compare") {
    return `${label(config.leftField)} ${config.compareOperator || "<="} ${label(config.rightField)}`;
  }
  if (rule.ruleCategory === "freshness") return `${label(config.timeField)} 数据时效性`;
  if (rule.ruleCategory === "null_rate_change") return `${label(config.metricField)} 空值率波动`;
  if (rule.ruleCategory === "batch_completeness") return `${label(config.dimensionField)} 批次完整性`;
  if (rule.ruleCategory === "cross_table_lookup" || rule.ruleCategory === "cross_table_consistency") {
    const localFields = (config.localFields || []).map(label).join("、") || "本表关联字段";
    const refTable = formatRuleTableLabel(config.refTable, tableCommentMap);
    return `${rule.ruleCategory === "cross_table_consistency" ? "跨表一致性" : "跨表存在性"}：${localFields} ↔ ${refTable}`;
  }
  return rule.ruleName || "高级规则";
}

function buildAdvancedRuleName(values: Record<string, any>) {
  const category = String(values.ruleCategory || "").trim();
  if (category === "conditional_required") {
    const requirement = values.requirement === "empty" ? "必须为空" : "必须非空";
    if (values.conditionField && values.targetField) {
      if (values.conditionOperator === "=" && values.conditionValue) {
        return `${values.conditionField}=${values.conditionValue} 时 ${values.targetField}${requirement}`;
      }
      if (values.conditionOperator === "is_null") {
        return `${values.conditionField} 为空时 ${values.targetField}${requirement}`;
      }
      if (values.conditionOperator === "is_not_null") {
        return `${values.conditionField} 非空时 ${values.targetField}${requirement}`;
      }
      return `${values.conditionField} 条件下 ${values.targetField}${requirement}`;
    }
  }
  if (category === "conditional_regex" && values.conditionField && values.targetField) {
    return `${values.conditionField} 条件下 ${values.targetField} 格式校验`;
  }
  if (category === "field_compare" && values.leftField && values.rightField) {
    return `${values.leftField} ${values.compareOperator || "<="} ${values.rightField}`;
  }
  if (category === "composite_unique" && Array.isArray(values.fieldNames) && values.fieldNames.length > 1) {
    return `${values.fieldNames.join("+")} 联合唯一`;
  }
  if (category === "freshness" && values.timeField) {
    return `${values.timeField} 数据时效性`;
  }
  if (category === "volume_anomaly") {
    return "数据量波动监测";
  }
  if (category === "null_rate_change" && values.metricField) {
    return `${values.metricField} 空值率变化`;
  }
  if (category === "batch_completeness" && values.dimensionField) {
    return `${values.dimensionField} 批次完整性`;
  }
  if (category === "cross_table_lookup" && values.refTable && Array.isArray(values.localFields) && values.localFields.length > 0) {
    return `${values.localFields.join("+")} -> ${values.refTable} 存在性`;
  }
  if (category === "cross_table_consistency" && values.refTable && Array.isArray(values.localFields) && values.localFields.length > 0) {
    return `${values.localFields.join("+")} -> ${values.refTable} 一致性`;
  }
  return "";
}

function cloneAdvancedRule(rule: QualityAdvancedRuleRecord): QualityAdvancedRuleRecord {
  return {
    ...rule,
    config: { ...(rule.config || {}) },
  };
}

function formatRate(value?: number) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function hasFieldRuleConfigured(field: QualityStrategyFieldRecord) {
  return Boolean(
    field.isPrimaryKey
    || field.nonNullCheck
    || field.duplicateCheck
    || (field.complianceRuleCodes || []).length > 0
    || normalizeMode(field) !== "none"
  );
}

function selectLabelFilter(input: string, option?: { label?: string | number }) {
  return String(option?.label || "").toLowerCase().includes(String(input || "").trim().toLowerCase());
}

function formatStrategyStatus(status?: string | null) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "submitted") return "已提交";
  if (normalized === "recommended") return "推荐中";
  if (normalized === "draft") return "草稿";
  if (normalized === "disabled") return "已停用";
  return status || "未设置";
}

function getStrategyStatusTone(status?: string | null): "default" | "success" | "processing" | "warning" | "error" {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "submitted") return "success";
  if (normalized === "recommended") return "processing";
  if (normalized === "disabled") return "warning";
  return "default";
}

function getFieldRuleEntries(
  field: QualityStrategyFieldRecord,
  options?: { complianceRuleNameMap?: Record<string, string> },
) {
  const entries: Array<{ ruleType: string; detail: string }> = [];
  if (field.isPrimaryKey) entries.push({ ruleType: "主键", detail: "字段标记为主键" });
  if (field.nonNullCheck) entries.push({ ruleType: "非空检测", detail: "字段开启非空校验" });
  if (field.duplicateCheck) entries.push({ ruleType: "重复检测", detail: "字段开启重复值校验" });
  for (const ruleCode of field.complianceRuleCodes || []) {
    entries.push({ ruleType: "合规规则", detail: options?.complianceRuleNameMap?.[ruleCode] || ruleCode });
  }
  const mode = normalizeMode(field);
  if (mode !== "none") {
    entries.push({
      ruleType: "值域范围",
      detail: field.valueRangeConfig?.sourceLabel || field.valueRangeSnapshot?.sourceLabel || getValueRangeModeLabel(mode),
    });
  }
  return entries;
}

function getValueRangeConfig(field: QualityStrategyFieldRecord): Partial<ValueRangeConfigRecord> {
  return field.valueRangeConfig || {};
}

function getValueRangeSnapshot(field: QualityStrategyFieldRecord): Partial<ValueRangeSnapshotRecord> {
  return field.valueRangeSnapshot || {};
}

function normalizeMode(field: QualityStrategyFieldRecord): ValueRangeMode {
  const config = getValueRangeConfig(field);
  const snapshot = getValueRangeSnapshot(field);
  const mode = String(config.mode || snapshot.mode || "none").toLowerCase();

  if (mode === "dictionary" || config.sourceType === "dictionary") return "dictionary";
  if (mode === "date_range") return "date_range";
  if (mode === "number_range" || mode === "range") return "number_range";
  if (mode === "custom_list" || mode === "list") return "custom_list";
  return "none";
}

function getValueRangePreview(field: QualityStrategyFieldRecord) {
  const mode = normalizeMode(field);
  const config = getValueRangeConfig(field);
  const snapshot = getValueRangeSnapshot(field);

  if (mode === "dictionary") {
    return config.sourceLabel || snapshot.sourceLabel || getValueRangeModeLabel(mode);
  }

  if (mode === "custom_list") {
    const values = config.allowedValues || snapshot.allowedValues || [];
    return values.length ? values.slice(0, 6).join(" / ") : "-";
  }

  if (mode === "number_range") {
    return `${config.minValue ?? snapshot.minValue ?? "-"} ~ ${config.maxValue ?? snapshot.maxValue ?? "-"}`;
  }

  if (mode === "date_range") {
    return `${config.startDate || snapshot.startDate || "-"} ~ ${config.endDate || snapshot.endDate || "-"}`;
  }

  return "-";
}

function isNumberField(field: QualityStrategyFieldRecord) {
  const typeText = `${field.dataType || ""} ${field.columnType || ""}`.toLowerCase();
  return /(int|decimal|numeric|number|float|double|real|bigint|smallint|tinyint)/.test(typeText);
}

function isDateField(field: QualityStrategyFieldRecord) {
  const typeText = `${field.dataType || ""} ${field.columnType || ""} ${field.columnName || ""} ${field.columnComment || ""}`.toLowerCase();
  return /(date|time|timestamp|datetime|created_at|updated_at|日期|时间)/.test(typeText);
}

function createValueRangeConfig(mode: ValueRangeMode, field: QualityStrategyFieldRecord): ValueRangeConfigRecord {
  const current = getValueRangeConfig(field);

  if (mode === "dictionary") {
    return {
      mode,
      sourceType: mode,
      sourceId: current.sourceType === mode ? current.sourceId ?? null : null,
      sourceLabel: current.sourceType === mode ? current.sourceLabel || "" : "",
      allowedValues: [],
      minValue: null,
      maxValue: null,
      startDate: null,
      endDate: null,
    };
  }

  if (mode === "custom_list") {
    return {
      mode,
      sourceType: "inline",
      sourceId: null,
      sourceLabel: "自定义值",
      allowedValues: current.allowedValues || [],
      minValue: null,
      maxValue: null,
      startDate: null,
      endDate: null,
    };
  }

  if (mode === "number_range") {
    return {
      mode,
      sourceType: "inline",
      sourceId: null,
      sourceLabel: "数值区间",
      allowedValues: [],
      minValue: current.minValue ?? null,
      maxValue: current.maxValue ?? null,
      startDate: null,
      endDate: null,
    };
  }

  if (mode === "date_range") {
    return {
      mode,
      sourceType: "inline",
      sourceId: null,
      sourceLabel: "日期区间",
      allowedValues: [],
      minValue: null,
      maxValue: null,
      startDate: current.startDate || null,
      endDate: current.endDate || null,
    };
  }

  return {
    mode: "none",
    sourceType: null,
    sourceId: null,
    sourceLabel: "",
    allowedValues: [],
    minValue: null,
    maxValue: null,
    startDate: null,
    endDate: null,
  };
}

function cloneField(field: QualityStrategyFieldRecord): QualityStrategyFieldRecord {
  return {
    ...field,
    sampleValues: [...(field.sampleValues || [])],
    complianceRuleCodes: [...(field.complianceRuleCodes || [])],
    valueRangeConfig: field.valueRangeConfig
      ? {
        ...field.valueRangeConfig,
        allowedValues: [...(field.valueRangeConfig.allowedValues || [])],
      }
      : undefined,
    valueRangeSnapshot: field.valueRangeSnapshot
      ? {
        ...field.valueRangeSnapshot,
        allowedValues: [...(field.valueRangeSnapshot.allowedValues || [])],
      }
      : undefined,
  };
}

function StrategyListView() {
  const { message } = App.useApp();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<QualityMonitorTableRecord[]>([]);
  const [sources, setSources] = useState<QualityMonitorSourceRecord[]>([]);
  const [sourceFilter, setSourceFilter] = useState<number | undefined>(undefined);
  const [strategyStatusFilter, setStrategyStatusFilter] = useState<string | undefined>(undefined);
  const [businessSystemFilter, setBusinessSystemFilter] = useState<number | undefined>(undefined);
  const [businessSystems, setBusinessSystems] = useState<Array<{ id: number; systemName: string; systemCode: string }>>([]);
  const [qualityTags, setQualityTags] = useState<Array<{ id: number; tagName: string }>>([]);
  const [governanceRecord, setGovernanceRecord] = useState<QualityMonitorTableRecord | null>(null);
  const [governanceSaving, setGovernanceSaving] = useState(false);
  const [governanceForm] = Form.useForm();
  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const [sourceResponse, tableResponse, systemResponse, tagResponse] = await Promise.all([
        fetchQualitySources(token, { includeTableStats: false }),
        fetchQualityStrategyTables(token, {
          sourceId: sourceFilter,
          strategyStatus: strategyStatusFilter,
          businessSystemId: businessSystemFilter,
          keyword: searchKeyword || undefined,
        }),
        fetchQualityInsightBusinessSystems(token),
        fetchQualityInsightTags(token),
      ]);
      setSources(sourceResponse.data.filter((item) => item.supportedQuality));
      setRecords(tableResponse.data);
      setBusinessSystems(systemResponse.data || []);
      setQualityTags(tagResponse.data || []);
    } catch (error: any) {
      message.error(error.message || "加载监控策略表清单失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(record: QualityMonitorTableRecord) {
    if (!token) return;
    try {
      await deleteQualityStrategyTable(token, record.id);
      message.success(`已删除监控表：${record.tableName}`);
      await loadData();
    } catch (error: any) {
      message.error(error.message || "删除监控表失败");
    }
  }

  useEffect(() => {
    void loadData();
  }, [token, sourceFilter, strategyStatusFilter, businessSystemFilter, searchKeyword]);

  function openGovernance(record: QualityMonitorTableRecord) {
    setGovernanceRecord(record);
    governanceForm.setFieldsValue({ businessSystemId: record.businessSystemId || undefined, importanceLevel: record.importanceLevel || "normal", tagIds: record.qualityTagIds || [], newTagName: "" });
  }

  async function saveGovernance() {
    if (!token || !governanceRecord) return;
    const values = await governanceForm.validateFields();
    setGovernanceSaving(true);
    try {
      const newTagName = String(values.newTagName || "").trim();
      if (newTagName) await saveQualityInsightTag(token, { tagName: newTagName });
      const tags = newTagName ? (await fetchQualityInsightTags(token)).data : qualityTags;
      await updateQualityMonitorTableGovernance(token, governanceRecord.id, {
        businessSystemId: values.businessSystemId || null,
        importanceLevel: values.importanceLevel,
        tagIds: [...(values.tagIds || []), ...tags.filter((item) => item.tagName === newTagName).map((item) => item.id)],
      });
      message.success("所属系统、重要级别和质量标签已保存");
      setGovernanceRecord(null);
      await loadData();
    } catch (error: any) {
      message.error(error.message || "保存治理配置失败");
    } finally {
      setGovernanceSaving(false);
    }
  }

  const kpis = useMemo(() => {
    const submitted = records.filter((item) => item.strategyStatus === "submitted").length;
    const recommended = records.filter((item) => item.strategyStatus === "recommended").length;
    const draft = records.filter((item) => item.strategyStatus === "draft").length;
    const pending = records.filter((item) => item.strategyStatus === "pending").length;

    return [
      {
        key: "total",
        title: "监控表总数",
        value: records.length,
        icon: <SettingOutlined />,
        description: "已纳入质量策略生命周期管理的监控表",
      },
      {
        key: "submitted",
        title: "已提交策略",
        value: submitted,
        icon: <FileTextOutlined />,
        description: "已生成 SQL，可供调度任务直接使用",
      },
      {
        key: "recommended",
        title: "待确认推荐",
        value: recommended,
        icon: <BulbOutlined />,
        description: "系统已自动推荐，待人工确认和调整",
      },
      {
        key: "pending",
        title: "待配置策略",
        value: pending + draft,
        icon: <SaveOutlined />,
        description: "尚未最终提交的监控表策略",
      },
    ];
  }, [records]);

  const sourceOptions = useMemo(
    () => sources.map((item) => ({ value: item.sourceId, label: item.sourceName })),
    [sources],
  );

  function renderStrategyActions(record: QualityMonitorTableRecord) {
    return (
      <Space>
        <Button type="link" onClick={() => openGovernance(record)}>
          系统与标签
        </Button>
        <Button type="link" onClick={() => navigate(`/dashboard/quality-control/strategies/${record.id}`)}>
          策略配置
        </Button>
        <Popconfirm
          title={`确认删除监控表 ${record.tableName} 吗？`}
          description="删除后会同步更新数据源管理中的监控范围和统计数量。"
          okText="删除"
          cancelText="取消"
          onConfirm={() => void handleDelete(record)}
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    );
  }

  const columns: ColumnsType<QualityMonitorTableRecord> = [
    {
      title: "监控表",
      key: "tableName",
      width: 280,
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.tableName}</Typography.Text>
          <Typography.Text type="secondary">{record.tableComment || "未配置表说明"}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "数据源",
      key: "sourceName",
      width: 220,
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.sourceName || "-"}</Typography.Text>
          <Typography.Text type="secondary">{record.sourceCode || "-"}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "策略状态",
      dataIndex: "strategyStatus",
      key: "strategyStatus",
      width: 120,
      render: (value) => <StatusTag status={value} />,
    },
    {
      title: "所属系统 / 标签",
      key: "governance",
      width: 230,
      render: (_value, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{record.businessSystemName || "未归属系统"}</Typography.Text>
          <Space size={[2, 2]} wrap>
            {record.qualityTags?.length
              ? record.qualityTags.map((tag) => <Tag color="blue" key={tag}>{tag}</Tag>)
              : <Typography.Text type="secondary">未配置标签</Typography.Text>}
          </Space>
        </Space>
      ),
    },
    {
      title: "当前版本",
      key: "version",
      width: 120,
      render: (_value, record) => (record.currentVersionNo ? `V${record.currentVersionNo}` : "-"),
    },
    {
      title: "配置规则数",
      dataIndex: "configuredRuleCount",
      key: "configuredRuleCount",
      width: 120,
      render: (value) => Number(value || 0),
    },
    {
      title: "最近推荐",
      dataIndex: "lastRecommendedAt",
      key: "lastRecommendedAt",
      width: 180,
      render: (value) => formatDateTime(value),
    },
    {
      title: "最近提交",
      dataIndex: "lastSubmittedAt",
      key: "lastSubmittedAt",
      width: 180,
      render: (value) => formatDateTime(value),
    },
    {
      title: "操作",
      key: "actions",
      width: 300,
      fixed: "right",
      render: (_value, record) => renderStrategyActions(record),
    },
  ];

  return (
    <div className="app-page">
      <PageToolbar
        left={(
          <>
            <Select
              allowClear
              style={{ width: 220 }}
              placeholder="按数据源过滤"
              value={sourceFilter}
              options={sourceOptions}
              onChange={(value) => setSourceFilter(value)}
            />
            <Select
              allowClear
              style={{ width: 180 }}
              placeholder="按策略状态过滤"
              value={strategyStatusFilter}
              options={[
                { value: "pending", label: "待配置" },
                { value: "draft", label: "草稿" },
                { value: "recommended", label: "已推荐" },
                { value: "submitted", label: "已提交" },
                { value: "disabled", label: "已停用" },
              ]}
              onChange={(value) => setStrategyStatusFilter(value)}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 220 }}
              placeholder="按所属系统过滤"
              value={businessSystemFilter}
              options={businessSystems.map((item) => ({ value: item.id, label: item.systemName }))}
              onChange={(value) => setBusinessSystemFilter(value)}
            />
            <Input.Search
              allowClear
              className="toolbar-search"
              placeholder="搜索监控表名、备注或数据源"
              value={keyword}
              onChange={(event) => {
                const nextValue = event.target.value;
                setKeyword(nextValue);
                if (!nextValue.trim()) {
                  setSearchKeyword("");
                }
              }}
              onSearch={(value) => setSearchKeyword(value.trim())}
            />
          </>
        )}
        right={(
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
            刷新
          </Button>
        )}
      />

      <div className="app-page-body">
        <div className="kpi-grid">
          {kpis.map((item) => (
            <StatCard key={item.key} title={item.title} value={item.value} icon={item.icon} description={item.description} />
          ))}
        </div>

        <DataTableCard<QualityMonitorTableRecord>
          title="监控策略表清单"
          extra={<Typography.Text type="secondary">共 {records.length} 张</Typography.Text>}
          tableProps={{
            rowKey: "id",
            loading,
            columns,
            dataSource: records,
            pagination: { pageSize: 10, showSizeChanger: false },
            scroll: { x: 1620 },
          }}
        />
        <Modal
          title={`配置所属系统与质量标签${governanceRecord ? `：${governanceRecord.tableName}` : ""}`}
          open={Boolean(governanceRecord)}
          onCancel={() => setGovernanceRecord(null)}
          onOk={() => void saveGovernance()}
          confirmLoading={governanceSaving}
          okText="保存配置"
          width={620}
          destroyOnHidden
        >
          <Form form={governanceForm} layout="vertical" style={{ marginTop: 18 }}>
            <Form.Item label="所属系统" name="businessSystemId" tooltip="用于系统级质量统计、报告和问题归属">
              <Select allowClear showSearch optionFilterProp="label" placeholder="选择业务系统" options={businessSystems.map((item) => ({ value: item.id, label: `${item.systemName} / ${item.systemCode}` }))} />
            </Form.Item>
            <Form.Item label="数据重要级别" name="importanceLevel">
              <Select options={[{ value: "critical", label: "核心" }, { value: "high", label: "高" }, { value: "normal", label: "普通" }, { value: "low", label: "低" }]} />
            </Form.Item>
            <Form.Item label="质量标签" name="tagIds">
              <Select mode="multiple" placeholder="选择自定义标签" options={qualityTags.map((item) => ({ value: item.id, label: item.tagName }))} />
            </Form.Item>
            <Form.Item label="新增标签" name="newTagName">
              <Input maxLength={64} placeholder="例如：核心指标、监管报送、每日巡检" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}

function StrategyDetailView({ monitorTableId }: { monitorTableId: number }) {
  const { message } = App.useApp();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState(false);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [advancedRuleModalOpen, setAdvancedRuleModalOpen] = useState(false);
  const [recommendationConfigOpen, setRecommendationConfigOpen] = useState(false);
  const [recommendationReviewOpen, setRecommendationReviewOpen] = useState(false);
  const [keyFieldPickerOpen, setKeyFieldPickerOpen] = useState(false);
  const [pendingKeyFields, setPendingKeyFields] = useState<string[]>([]);
  const [recommendationStage, setRecommendationStage] = useState("");
  const [recommendationRun, setRecommendationRun] = useState<QualityRecommendationRun | null>(null);
  const [selectedRecommendationFields, setSelectedRecommendationFields] = useState<string[]>([]);
  const [selectedRecommendationRules, setSelectedRecommendationRules] = useState<string[]>([]);
  const [strategyStatDetailKey, setStrategyStatDetailKey] = useState<StrategyStatKey | null>(null);
  const [ruleSqlPreview, setRuleSqlPreview] = useState<{
    title: string;
    group?: string;
    type?: string;
    fieldComment?: string;
    detail?: string;
    sql?: string;
  } | null>(null);
  const [editingAdvancedRuleId, setEditingAdvancedRuleId] = useState<string | null>(null);
  const [advancedRuleModalGroup, setAdvancedRuleModalGroup] = useState<AdvancedRuleGroup>("row");
  const [autoRuleNameEnabled, setAutoRuleNameEnabled] = useState(true);
  const [lastAutoRuleName, setLastAutoRuleName] = useState("");
  const [advancedRuleForm] = Form.useForm();
  const [recommendationForm] = Form.useForm<QualityRecommendationSettings>();

  const [detail, setDetail] = useState<QualityStrategyDetail | null>(null);
  const [regexRules, setRegexRules] = useState<QualityRegexRuleRecord[]>([]);
  const [dictionaries, setDictionaries] = useState<QualityDictionaryRecord[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | undefined>(undefined);
  const [workingSummary, setWorkingSummary] = useState("");
  const [workingFields, setWorkingFields] = useState<QualityStrategyFieldRecord[]>([]);
  const [workingAdvancedRules, setWorkingAdvancedRules] = useState<QualityAdvancedRuleRecord[]>([]);
  const [sqlPreview, setSqlPreview] = useState("");
  const [referenceTablesLoading, setReferenceTablesLoading] = useState(false);
  const [referenceColumnsLoading, setReferenceColumnsLoading] = useState(false);
  const [referenceTables, setReferenceTables] = useState<DataSourceTable[]>([]);
  const [referenceColumnsMap, setReferenceColumnsMap] = useState<Record<string, DataSourceColumn[]>>({});
  const editingRuleCategory = Form.useWatch("ruleCategory", advancedRuleForm) as AdvancedRuleCategory | undefined;
  const selectedRefTable = Form.useWatch("refTable", advancedRuleForm) as string | undefined;
  const watchedConditionField = Form.useWatch("conditionField", advancedRuleForm) as string | undefined;
  const watchedConditionOperator = Form.useWatch("conditionOperator", advancedRuleForm) as string | undefined;
  const watchedConditionValue = Form.useWatch("conditionValue", advancedRuleForm) as string | undefined;
  const watchedTargetField = Form.useWatch("targetField", advancedRuleForm) as string | undefined;
  const watchedRequirement = Form.useWatch("requirement", advancedRuleForm) as string | undefined;
  const watchedLeftField = Form.useWatch("leftField", advancedRuleForm) as string | undefined;
  const watchedCompareOperator = Form.useWatch("compareOperator", advancedRuleForm) as string | undefined;
  const watchedRightField = Form.useWatch("rightField", advancedRuleForm) as string | undefined;
  const watchedFieldNames = Form.useWatch("fieldNames", advancedRuleForm) as string[] | undefined;
  const watchedTimeField = Form.useWatch("timeField", advancedRuleForm) as string | undefined;
  const watchedMetricField = Form.useWatch("metricField", advancedRuleForm) as string | undefined;
  const watchedDimensionField = Form.useWatch("dimensionField", advancedRuleForm) as string | undefined;
  const watchedLocalFields = Form.useWatch("localFields", advancedRuleForm) as string[] | undefined;
  const watchedBaselineMode = Form.useWatch("baselineMode", advancedRuleForm) as "last_batch" | "recent_avg" | undefined;
  const watchedWarmupPolicy = Form.useWatch("warmupPolicy", advancedRuleForm) as "collect_only" | "upper_threshold" | undefined;
  const recommendationBaselineMode = Form.useWatch("baselineMode", recommendationForm) as "last_batch" | "recent_avg" | undefined;
  const recommendationWarmupPolicy = Form.useWatch("warmupPolicy", recommendationForm) as "collect_only" | "upper_threshold" | undefined;
  const recommendationMonitorDirections = Form.useWatch("monitorDirections", recommendationForm) as string[] | undefined;
  const recommendationSampleMode = Form.useWatch("sampleMode", recommendationForm) as "random" | "latest" | "head" | undefined;
  const recommendationKeyFields = (Form.useWatch("keyFields", recommendationForm) as string[] | undefined) || [];
  const activeRuleCategory = editingRuleCategory || "conditional_required";
  const selectableAdvancedRuleOptions = getAdvancedRuleOptions(advancedRuleModalGroup);

  async function loadAssets() {
    if (!token) return;
    const [regexResponse, dictionaryResponse] = await Promise.all([
      fetchQualityRegexRules(token),
      fetchQualityDictionaries(token),
    ]);
    setRegexRules(regexResponse.data.filter((item) => item.status === "active"));
    setDictionaries(dictionaryResponse.data.filter((item) => item.status === "active"));
  }

  function hydrateWorkingState(data: QualityStrategyDetail, versionId?: number) {
    const version = versionId
      ? data.versions.find((item) => item.id === versionId) || null
      : data.currentVersion;
    const nextFields = (version?.fieldStrategies?.length ? version.fieldStrategies : data.fields).map(cloneField);
    const detailRules = data.advancedRules || [
      ...(data.rowRules || []),
      ...(data.tableRules || []),
      ...(data.statRules || []),
      ...(data.crossTableRules || []),
    ];
    const nextAdvancedRules = (version?.advancedRules || detailRules || []).map(cloneAdvancedRule);

    setSelectedVersionId(version?.id);
    setWorkingSummary(version?.aiSummaryText || data.strategy?.currentSummary || "");
    setWorkingFields(nextFields);
    setWorkingAdvancedRules(nextAdvancedRules);
    setSqlPreview(version?.sqlContent || "");
  }

  function commitCustomListDraft(columnName: string, record: QualityStrategyFieldRecord, rawValue: string) {
    const normalizedText = String(rawValue || "");
    const allowedValues = normalizedText
      .split(/[,\n，]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    updateField(columnName, {
      valueRangeConfig: {
        ...createValueRangeConfig("custom_list", record),
        allowedValues,
      },
    });
  }

  async function loadDetail() {
    if (!token) return;
    setDetailLoading(true);
    try {
      const response = await fetchQualityStrategyDetail(token, monitorTableId);
      setDetail(response.data);
      hydrateWorkingState(response.data);
    } catch (error: any) {
      if (error instanceof HttpError && error.status === 404) {
        message.warning("当前监控表已不存在，已返回策略清单");
        navigate("/dashboard/quality-control/strategies", { replace: true });
        return;
      }
      message.error(error.message || "加载策略详情失败");
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadPage() {
    if (!token) return;
    setLoading(true);
    try {
      await Promise.all([loadAssets(), loadDetail()]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, [token, monitorTableId]);

  useEffect(() => {
    if (!token || !detail?.monitorTable?.sourceId) {
      setReferenceTables([]);
      setReferenceColumnsMap({});
      return;
    }

    let active = true;
    setReferenceTablesLoading(true);
    fetchQualitySourceTables(token, detail.monitorTable.sourceId)
      .then((response) => {
        if (!active) return;
        setReferenceTables(response.data || []);
      })
      .catch(() => {
        if (!active) return;
        setReferenceTables([]);
      })
      .finally(() => {
        if (active) {
          setReferenceTablesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token, detail?.monitorTable?.sourceId]);

  useEffect(() => {
    if (!advancedRuleModalOpen || !token || !detail?.monitorTable?.sourceId || !selectedRefTable) return;
    if (referenceColumnsMap[selectedRefTable]) return;

    let active = true;
    setReferenceColumnsLoading(true);
    fetchQualitySourceColumns(token, detail.monitorTable.sourceId, selectedRefTable)
      .then((response) => {
        if (!active) return;
        setReferenceColumnsMap((current) => ({ ...current, [selectedRefTable]: response.data || [] }));
      })
      .catch(() => {
        if (!active) return;
        setReferenceColumnsMap((current) => ({ ...current, [selectedRefTable]: [] }));
      })
      .finally(() => {
        if (active) {
          setReferenceColumnsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [advancedRuleModalOpen, token, detail?.monitorTable?.sourceId, selectedRefTable, referenceColumnsMap]);

  useEffect(() => {
    if (!advancedRuleModalOpen || !autoRuleNameEnabled) return;
    const values = advancedRuleForm.getFieldsValue();
    const nextName = buildAdvancedRuleName(values);
    if (!nextName || nextName === values.ruleName) return;
    setLastAutoRuleName(nextName);
    advancedRuleForm.setFieldValue("ruleName", nextName);
  }, [
    advancedRuleModalOpen,
    autoRuleNameEnabled,
    advancedRuleForm,
    editingRuleCategory,
    watchedConditionField,
    watchedConditionOperator,
    watchedConditionValue,
    watchedTargetField,
    watchedRequirement,
    watchedLeftField,
    watchedCompareOperator,
    watchedRightField,
    watchedFieldNames,
    watchedTimeField,
    watchedMetricField,
    watchedDimensionField,
    selectedRefTable,
    watchedLocalFields,
  ]);

  function updateField(columnName: string, patch: Partial<QualityStrategyFieldRecord>) {
    setWorkingFields((current) => current.map((item) => {
      if (item.columnName !== columnName) return item;

      const nextValueRangeConfig = patch.valueRangeConfig
        ? {
          ...createValueRangeConfig("none", item),
          ...(item.valueRangeConfig || {}),
          ...patch.valueRangeConfig,
        }
        : item.valueRangeConfig;

      return {
        ...item,
        ...patch,
        valueRangeConfig: nextValueRangeConfig,
      };
    }));
  }

  function updateBooleanColumn<K extends "isPrimaryKey" | "nonNullCheck" | "duplicateCheck">(key: K, checked: boolean) {
    setWorkingFields((current) => current.map((item) => ({
      ...item,
      [key]: checked,
    })));
  }

  function handleSelectVersion(versionId?: number) {
    setSelectedVersionId(versionId);
    if (!detail) return;
    hydrateWorkingState(detail, versionId);
  }

  function openRecommendationConfig() {
    const keyFields = workingFields.filter((item) => item.isPrimaryKey || item.nonNullCheck).slice(0, 5).map((item) => item.columnName);
    const defaults: QualityRecommendationSettings = {
      sampleSize: 100,
      sampleMode: "random",
      tableKind: "general",
      ruleStrength: "balanced",
      monitorDirections: ["completeness", "uniqueness", "validity", "consistency", "timeliness", "stability"],
      keyFields,
      referenceTables: [],
      baselineMode: "recent_avg",
      lookbackBatches: 7,
      minHistoryBatches: 3,
      warmupPolicy: "collect_only",
    };
    setRecommendationStage("");
    setRecommendationConfigOpen(true);
    window.requestAnimationFrame(() => recommendationForm.setFieldsValue(defaults));
  }

  function openKeyFieldPicker() {
    setPendingKeyFields(recommendationForm.getFieldValue("keyFields") || []);
    setKeyFieldPickerOpen(true);
  }

  function confirmKeyFieldPicker() {
    recommendationForm.setFieldValue("keyFields", pendingKeyFields);
    setKeyFieldPickerOpen(false);
  }

  function getRecommendationStageLabel(run: QualityRecommendationRun) {
    if (run.runStatus === "queued") return "等待执行";
    if (run.recommendationContext?.stage === "loading_assets") return "字段画像已完成，正在按同系统和相关度加载规则资产";
    if (run.recommendationContext?.stage === "generating") return "规则资产已筛选完成，正在生成推荐候选";
    if (run.recommendationContext?.stage === "reviewing") return "推荐候选已生成，正在执行证据复核";
    if (run.runStatus === "profiling") return "正在构建字段画像并筛选同系统规则资产";
    if (run.runStatus === "failed") return "推荐失败";
    return "正在生成并复核推荐候选";
  }

  function getRecommendationFailureLabel(run: QualityRecommendationRun) {
    const code = run.recommendationContext?.modelFailure?.code;
    if (code === "MODEL_TIMEOUT") return "模型请求超时，系统已直接使用规则引擎生成基础建议";
    if (code === "MODEL_RATE_LIMITED") return "模型服务当前限流，系统已使用规则引擎生成基础建议";
    if (code === "MODEL_OUTPUT_TRUNCATED") return "模型输出达到 Token 上限，系统已使用规则引擎生成基础建议";
    if (code === "MODEL_INVALID_JSON") return "模型返回格式无效，系统已使用规则引擎生成基础建议";
    if (code) return "模型调用失败，系统已使用规则引擎生成基础建议";
    return "";
  }

  async function waitForRecommendationRun(runId: number) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const response = await fetchQualityRecommendationRun(token!, monitorTableId, runId);
      const run = response.data;
      setRecommendationStage(getRecommendationStageLabel(run));
      if (["pending_review", "applied", "rejected"].includes(run.runStatus)) return run;
      if (run.runStatus === "failed") {
        throw new Error(run.recommendationContext?.failure?.message || run.summaryText || "策略推荐失败");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
    throw new Error("策略推荐仍在执行，请稍后重新进入页面查看结果");
  }

  async function handleRecommend() {
    if (!token) return;
    const settings = await recommendationForm.validateFields();
    setRecommending(true);
    setRecommendationStage("正在提交推荐任务");
    try {
      const response = await startQualityRecommendation(token, monitorTableId, settings);
      const completedRun = await waitForRecommendationRun(response.data.id);
      setRecommendationRun(completedRun);
      setSelectedRecommendationFields(completedRun.fieldStrategies.filter(hasFieldRuleConfigured).map((item) => item.columnName));
      setSelectedRecommendationRules(completedRun.advancedRules.filter((item) => item.enabled !== false).map((item) => item.ruleId));
      setRecommendationConfigOpen(false);
      setRecommendationReviewOpen(true);
      message.success("策略候选已生成，请审核后再回填草稿");
    } catch (error: any) {
      if (error instanceof HttpError && error.status === 404) {
        setRecommendationConfigOpen(false);
        message.warning("当前监控表已不存在，已返回策略清单");
        navigate("/dashboard/quality-control/strategies", { replace: true });
        return;
      }
      message.error(error.message || "策略推荐失败");
    } finally {
      setRecommending(false);
      setRecommendationStage("");
    }
  }

  async function handleApplyRecommendation() {
    if (!token || !recommendationRun) return;
    const fieldStrategies = recommendationRun.fieldStrategies.filter((item) => selectedRecommendationFields.includes(item.columnName));
    const advancedRules = recommendationRun.advancedRules.filter((item) => selectedRecommendationRules.includes(item.ruleId));
    if (!fieldStrategies.length) {
      message.warning("请至少采纳一个字段策略");
      return;
    }
    setSaving(true);
    try {
      const response = await applyQualityRecommendationRun(token, monitorTableId, recommendationRun.id, {
        summary: recommendationRun.summaryText || "已审核采纳智能策略建议",
        fieldStrategies,
        advancedRules,
        reviewedRuleIds: advancedRules.map((item) => item.ruleId),
      });
      setDetail(response.data);
      hydrateWorkingState(response.data);
      setRecommendationReviewOpen(false);
      setRecommendationRun(null);
      message.success("已按审核结果生成策略草稿，可继续调整后提交");
    } catch (error: any) {
      message.error(error.message || "回填审核结果失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleRejectRecommendation() {
    if (!token || !recommendationRun) {
      setRecommendationReviewOpen(false);
      return;
    }
    try {
      await rejectQualityRecommendationRun(token, monitorTableId, recommendationRun.id);
      message.info("已记录本次不采纳结果，当前策略保持不变");
    } catch (error: any) {
      message.error(error.message || "记录审核结果失败");
    } finally {
      setRecommendationReviewOpen(false);
      setRecommendationRun(null);
    }
  }

  async function handleSaveDraft() {
    if (!token) return;
    const payload: QualityStrategyDraftPayload = {
      summary: workingSummary,
      fieldStrategies: workingFields,
      advancedRules: workingAdvancedRules,
      rowRules: workingAdvancedRules.filter((item) => getAdvancedRuleGroup(item.ruleCategory) === "row"),
      tableRules: [],
      statRules: workingAdvancedRules.filter((item) => getAdvancedRuleGroup(item.ruleCategory) === "stat"),
      crossTableRules: workingAdvancedRules.filter((item) => getAdvancedRuleGroup(item.ruleCategory) === "cross"),
    };
    setSaving(true);
    try {
      const response = await saveQualityStrategyDraft(token, monitorTableId, payload);
      setDetail(response.data);
      hydrateWorkingState(response.data);
      message.success("策略草稿已保存");
    } catch (error: any) {
      message.error(error.message || "保存策略草稿失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!token) return;
    const payload: QualityStrategyDraftPayload = {
      summary: workingSummary,
      fieldStrategies: workingFields,
      advancedRules: workingAdvancedRules,
      rowRules: workingAdvancedRules.filter((item) => getAdvancedRuleGroup(item.ruleCategory) === "row"),
      tableRules: [],
      statRules: workingAdvancedRules.filter((item) => getAdvancedRuleGroup(item.ruleCategory) === "stat"),
      crossTableRules: workingAdvancedRules.filter((item) => getAdvancedRuleGroup(item.ruleCategory) === "cross"),
    };
    setSubmitting(true);
    try {
      const response = await submitQualityStrategy(token, monitorTableId, payload);
      setDetail(response.data);
      hydrateWorkingState(response.data);
      setSqlModalOpen(true);
      message.success("策略已提交并生成 SQL");
    } catch (error: any) {
      message.error(error.message || "提交策略失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteVersion() {
    if (!token || !selectedVersionId) return;
    setDeletingVersion(true);
    try {
      const response = await deleteQualityStrategyVersion(token, monitorTableId, selectedVersionId);
      message.success(`已删除策略版本 V${response.data.versionNo}`);
      await loadDetail();
    } catch (error: any) {
      message.error(error.message || "删除策略版本失败");
    } finally {
      setDeletingVersion(false);
    }
  }

  function openAdvancedRuleModal(rule?: QualityAdvancedRuleRecord, defaultCategory: AdvancedRuleCategory = "conditional_required") {
    const config = rule?.config || {};
    const ruleCategory = (rule?.ruleCategory || defaultCategory) as AdvancedRuleCategory;
    const group = getAdvancedRuleGroup(ruleCategory);
    setEditingAdvancedRuleId(rule?.ruleId || null);
    setAdvancedRuleModalGroup(group);
    setAutoRuleNameEnabled(!rule);
    setLastAutoRuleName("");
    advancedRuleForm.setFieldsValue({
      ruleName: rule?.ruleName || "",
      ruleCategory,
      enabled: rule?.enabled ?? true,
      severity: rule?.severity || "medium",
      description: rule?.description || "",
      conditionField: config.conditionField,
      conditionOperator: config.conditionOperator || "is_not_null",
      conditionValue: Array.isArray(config.conditionValues) ? config.conditionValues.join(",") : config.conditionValue,
      targetField: config.targetField,
      regexPattern: config.regexPattern || "",
      requirement: config.requirement || "required",
      leftField: config.leftField,
      compareOperator: config.compareOperator || "<=",
      rightField: config.rightField,
      valueType: config.valueType || "datetime",
      fieldNames: config.fieldNames || [],
      ignoreBlank: config.ignoreBlank ?? true,
      timeField: config.timeField,
      maxDelayValue: config.maxDelayValue || 1,
      maxDelayUnit: config.maxDelayUnit || "day",
      baselineMode: config.baselineMode || "recent_avg",
      lookbackBatches: config.lookbackBatches || 7,
      minHistoryBatches: config.minHistoryBatches || (config.baselineMode === "last_batch" ? 1 : 3),
      warmupPolicy: config.warmupPolicy || "collect_only",
      warmupThreshold: config.warmupThreshold ?? undefined,
      thresholdPercent: config.thresholdPercent || 20,
      direction: config.direction || "both",
      metricField: config.metricField || config.targetField,
      dimensionField: config.dimensionField || "",
      expectedDistinctCount: config.expectedDistinctCount || 1,
      refTable: config.refTable || config.referenceTable || "",
      localFields: config.localFields || config.sourceFields || [],
      refFields: Array.isArray(config.refFields) ? config.refFields : [],
      comparePairs: Array.isArray(config.comparePairs) ? config.comparePairs : [],
    });
    setAdvancedRuleModalOpen(true);
  }

  async function handleSaveAdvancedRule() {
    const values = await advancedRuleForm.validateFields();
    const category = values.ruleCategory as AdvancedRuleCategory;
    const config: Record<string, any> = {};
    if (category === "conditional_required") {
      config.conditionField = values.conditionField;
      config.conditionOperator = values.conditionOperator || "is_not_null";
      if (config.conditionOperator === "in" || config.conditionOperator === "not_in") {
        config.conditionValues = String(values.conditionValue || "")
          .split(/[,\n，]/)
          .map((item) => item.trim())
          .filter(Boolean);
      } else if (!["is_null", "is_not_null"].includes(config.conditionOperator)) {
        config.conditionValue = values.conditionValue;
      }
      config.targetField = values.targetField;
      config.targetFields = [values.targetField];
      config.requirement = values.requirement || "required";
    }
    if (category === "conditional_regex") {
      config.conditionField = values.conditionField;
      config.conditionOperator = values.conditionOperator || "is_not_null";
      if (config.conditionOperator === "in" || config.conditionOperator === "not_in") {
        config.conditionValues = String(values.conditionValue || "")
          .split(/[,\n，]/)
          .map((item) => item.trim())
          .filter(Boolean);
      } else if (!["is_null", "is_not_null"].includes(config.conditionOperator)) {
        config.conditionValue = values.conditionValue;
      }
      config.targetField = values.targetField;
      config.regexPattern = values.regexPattern;
    }
    if (category === "field_compare") {
      config.leftField = values.leftField;
      config.compareOperator = values.compareOperator || "<=";
      config.rightField = values.rightField;
      config.valueType = values.valueType || "datetime";
    }
    if (category === "composite_unique") {
      config.fieldNames = values.fieldNames || [];
      config.ignoreBlank = values.ignoreBlank ?? true;
    }
    if (category === "freshness") {
      config.timeField = values.timeField;
      config.maxDelayValue = Number(values.maxDelayValue || 1);
      config.maxDelayUnit = values.maxDelayUnit || "day";
      config.baseline = "current_time";
    }
    if (category === "volume_anomaly") {
      config.baselineMode = values.baselineMode || "recent_avg";
      config.lookbackBatches = config.baselineMode === "last_batch" ? 1 : Number(values.lookbackBatches || 7);
      config.minHistoryBatches = config.baselineMode === "last_batch" ? 1 : Number(values.minHistoryBatches || 3);
      config.warmupPolicy = values.warmupPolicy || "collect_only";
      config.warmupThreshold = config.warmupPolicy === "upper_threshold" ? Number(values.warmupThreshold) : null;
      config.thresholdPercent = Number(values.thresholdPercent || 30);
      config.direction = values.direction || "both";
    }
    if (category === "null_rate_change") {
      config.metricField = values.metricField;
      config.baselineMode = values.baselineMode || "recent_avg";
      config.lookbackBatches = config.baselineMode === "last_batch" ? 1 : Number(values.lookbackBatches || 7);
      config.minHistoryBatches = config.baselineMode === "last_batch" ? 1 : Number(values.minHistoryBatches || 3);
      config.warmupPolicy = values.warmupPolicy || "collect_only";
      config.warmupThreshold = config.warmupPolicy === "upper_threshold" ? Number(values.warmupThreshold) : null;
      config.thresholdPercent = Number(values.thresholdPercent || 20);
      config.direction = values.direction || "both";
    }
    if (category === "batch_completeness") {
      config.dimensionField = values.dimensionField;
      config.expectedDistinctCount = Number(values.expectedDistinctCount || 1);
    }
    if (category === "cross_table_lookup") {
      config.refTable = values.refTable;
      config.localFields = values.localFields || [];
      config.refFields = values.refFields || [];
    }
    if (category === "cross_table_consistency") {
      config.refTable = values.refTable;
      config.localFields = values.localFields || [];
      config.refFields = values.refFields || [];
      config.comparePairs = Array.isArray(values.comparePairs)
        ? values.comparePairs.filter((item: any) => item?.localField && item?.refField)
        : [];
    }

    const nextRule: QualityAdvancedRuleRecord = {
      ruleId: editingAdvancedRuleId || `${category}_${Date.now()}`,
      ruleName: values.ruleName,
      ruleCategory: category,
      ruleScope: getAdvancedRuleScope(category),
      enabled: values.enabled ?? true,
      severity: values.severity || "medium",
      description: values.description || "",
      config,
    };
    setWorkingAdvancedRules((current) => {
      if (!editingAdvancedRuleId) return [...current, nextRule];
      return current.map((item) => (item.ruleId === editingAdvancedRuleId ? nextRule : item));
    });
    setAdvancedRuleModalOpen(false);
    setEditingAdvancedRuleId(null);
    setAdvancedRuleModalGroup("row");
    setAutoRuleNameEnabled(true);
    setLastAutoRuleName("");
    advancedRuleForm.resetFields();
  }

  function handleDeleteAdvancedRule(ruleId: string) {
    setWorkingAdvancedRules((current) => current.filter((item) => item.ruleId !== ruleId));
  }

  const versionOptions = useMemo(
    () => (detail?.versions || []).map((item: QualityStrategyVersionRecord) => ({
      value: item.id,
      label: `V${item.versionNo} · ${formatStrategyStatus(item.versionStatus)}`,
    })),
    [detail?.versions],
  );

  const selectedVersion = useMemo(() => {
    if (!detail) return null;
    if (selectedVersionId) {
      return detail.versions.find((item) => item.id === selectedVersionId) || null;
    }
    return detail.currentVersion || null;
  }, [detail, selectedVersionId]);

  const dictionaryOptions = useMemo(
    () => dictionaries.map((item) => ({
      value: item.id,
      label: `${item.dictName}${item.sourceSystemName ? ` / ${item.sourceSystemName}` : ""}`,
    })),
    [dictionaries],
  );


  const complianceRuleNameMap = useMemo(
    () => Object.fromEntries(regexRules.map((item, index) => [item.ruleCode, item.ruleName || `合规规则${index + 1}`])),
    [regexRules],
  );

  const fieldOptions = useMemo(
    () => workingFields.map((item) => ({
      value: item.columnName,
      label: item.columnComment ? `${item.columnName} / ${item.columnComment}` : item.columnName,
    })),
    [workingFields],
  );

  const recommendationOrderFieldOptions = useMemo(
    () => workingFields
      .filter((item) => {
        if (Number(item.valueRate || 0) <= 0 || !item.sampleValues?.length) return false;
        const text = `${item.columnName} ${item.columnComment || ""} ${item.dataType || ""} ${item.columnType || ""}`;
        return /date|time|timestamp|year|month|batch|sequence|日期|时间|年月|批次|序号/i.test(text);
      })
      .map((item) => ({
        value: item.columnName,
        label: `${item.columnComment ? `${item.columnName} / ${item.columnComment}` : item.columnName}（有效值率 ${(Number(item.valueRate || 0) * 100).toFixed(1)}%）`,
      })),
    [workingFields],
  );

  const fieldCommentMap = useMemo(
    () => Object.fromEntries(workingFields.map((item) => [item.columnName, item.columnComment || "-"])),
    [workingFields],
  );

  const recommendationFieldCommentMap = useMemo(() => {
    const comments = { ...fieldCommentMap };
    const profile = recommendationRun?.profileSnapshot as any;
    (profile?.fields || []).forEach((field: any) => {
      if (field?.columnName && field.columnComment) comments[field.columnName] = field.columnComment;
    });
    (profile?.relatedTableMetadata || []).forEach((table: any) => {
      (table?.columns || []).forEach((field: any) => {
        if (field?.columnName && field.columnComment && !comments[field.columnName]) comments[field.columnName] = field.columnComment;
      });
    });
    return comments;
  }, [fieldCommentMap, recommendationRun]);

  const recommendationTableCommentMap = useMemo(() => {
    const comments: Record<string, string> = {};
    const profile = recommendationRun?.profileSnapshot as any;
    (profile?.tableCatalog || []).forEach((table: any) => {
      if (table?.tableName && table.tableComment) comments[table.tableName] = table.tableComment;
      if (table?.fullTableName && table.tableComment) comments[table.fullTableName] = table.tableComment;
    });
    (profile?.relatedTableMetadata || []).forEach((table: any) => {
      if (table?.tableName && table.tableComment) comments[table.tableName] = table.tableComment;
      if (table?.fullTableName && table.tableComment) comments[table.fullTableName] = table.tableComment;
    });
    return comments;
  }, [recommendationRun]);

  const recommendationCandidateFields = useMemo(
    () => (recommendationRun?.fieldStrategies || []).filter(hasFieldRuleConfigured),
    [recommendationRun],
  );

  const referenceTableOptions = useMemo(
    () => referenceTables
      .filter((item) => item.tableName !== detail?.monitorTable?.tableName)
      .map((item) => ({
        value: item.tableName,
        label: item.tableComment ? `${item.tableName} / ${item.tableComment}` : item.tableName,
      })),
    [referenceTables, detail?.monitorTable?.tableName],
  );

  const referenceFieldOptions = useMemo(
    () => (selectedRefTable ? (referenceColumnsMap[selectedRefTable] || []) : []).map((item) => ({
      value: item.columnName,
      label: item.columnComment ? `${item.columnName} / ${item.columnComment}` : item.columnName,
    })),
    [referenceColumnsMap, selectedRefTable],
  );

  const strategyStats = useMemo(() => {
    const totalFields = workingFields.length;
    const configuredFields = workingFields.filter(hasFieldRuleConfigured).length;
    const unconfiguredFields = Math.max(totalFields - configuredFields, 0);
    const fieldRuleCount = workingFields.reduce((total, item) => (
      total
      + (item.isPrimaryKey ? 1 : 0)
      + (item.nonNullCheck ? 1 : 0)
      + (item.duplicateCheck ? 1 : 0)
      + (item.complianceRuleCodes || []).length
      + (normalizeMode(item) !== "none" ? 1 : 0)
    ), 0);
    const rowRuleCount = workingAdvancedRules.filter((item) => item.enabled !== false && getAdvancedRuleGroup(item.ruleCategory) === "row").length;
    const statRuleCount = workingAdvancedRules.filter((item) => item.enabled !== false && getAdvancedRuleGroup(item.ruleCategory) === "stat").length;
    const crossRuleCount = workingAdvancedRules.filter((item) => item.enabled !== false && getAdvancedRuleGroup(item.ruleCategory) === "cross").length;
    const configuredRuleCount = fieldRuleCount + rowRuleCount + statRuleCount + crossRuleCount;

    return [
      { key: "total", title: "字段总数", value: totalFields },
      { key: "configuredFields", title: "已配置字段", value: configuredFields },
      { key: "unconfiguredFields", title: "未配置字段", value: unconfiguredFields },
      { key: "configuredRules", title: "已配置规则", value: configuredRuleCount },
      { key: "field", title: "字段级规则", value: fieldRuleCount },
      { key: "row", title: "行级规则", value: rowRuleCount },
      { key: "stat", title: "统计型规则", value: statRuleCount },
      { key: "cross", title: "跨表规则", value: crossRuleCount },
    ];
  }, [workingFields, workingAdvancedRules]);

  const selectedVersionRuleSqlMap = useMemo(() => {
    const version = detail
      ? (selectedVersionId
        ? detail.versions.find((item) => item.id === selectedVersionId) || null
        : detail.currentVersion)
      : null;
    const previewItems = Array.isArray((version?.sqlBundle as any)?.previewItems)
      ? (version?.sqlBundle as any).previewItems
      : [];
    if (previewItems.length > 0) {
      return Object.fromEntries(previewItems.map((item: any) => [item.key, item.sql]));
    }
    return detail?.ruleSqlMap || {};
  }, [detail, selectedVersionId]);

  const fieldRuleDetails = useMemo(
    () => workingFields.flatMap((field) => getFieldRuleEntries(field, { complianceRuleNameMap }).map((entry, index) => ({
      key: `${field.columnName}_${entry.ruleType}_${index}`,
      fieldName: field.columnName,
      fieldComment: field.columnComment || "-",
      ruleType: entry.ruleType,
      detail: entry.detail,
      ddlSql: selectedVersionRuleSqlMap[`field_${field.columnName}`] || "",
    }))),
    [complianceRuleNameMap, selectedVersionRuleSqlMap, workingFields],
  );

  const advancedRuleDetails = useMemo(
    () => workingAdvancedRules.map((rule) => ({
      ...rule,
      key: rule.ruleId,
      fieldsText: getAdvancedRuleFields(rule),
      fieldComments: Array.from(
        new Set(
          [
            ...(Array.isArray(rule.config?.fieldNames) ? rule.config.fieldNames : []),
            ...(Array.isArray(rule.config?.localFields) ? rule.config.localFields : []),
            ...(Array.isArray(rule.config?.targetFields) ? rule.config.targetFields : []),
            ...(Array.isArray(rule.config?.comparePairs) ? rule.config.comparePairs.map((item: any) => item?.localField) : []),
            rule.config?.conditionField,
            rule.config?.targetField,
            rule.config?.leftField,
            rule.config?.rightField,
            rule.config?.timeField,
            rule.config?.metricField,
            rule.config?.dimensionField,
          ]
            .map((item) => String(item || "").trim())
            .filter(Boolean)
            .map((fieldName) => fieldCommentMap[fieldName])
            .filter(Boolean),
        ),
      ).join("、") || "-",
      ddlSql: selectedVersionRuleSqlMap[`advanced_${rule.ruleId}`] || "",
      statusText: rule.enabled !== false ? "启用" : "停用",
    })),
    [fieldCommentMap, selectedVersionRuleSqlMap, workingAdvancedRules],
  );

  const combinedRuleDetails = useMemo(
    () => [
      ...fieldRuleDetails.map((item) => ({
        key: `field_${item.key}`,
        group: "字段级规则",
        name: item.fieldName,
        type: item.ruleType,
        detail: item.detail,
        fieldComment: item.fieldComment,
        ddlSql: item.ddlSql,
        statusText: "启用",
      })),
      ...advancedRuleDetails
        .filter((item) => item.enabled !== false)
        .map((item) => ({
          key: `advanced_${item.ruleId}`,
          group: getAdvancedRuleGroup(item.ruleCategory) === "row"
            ? "行级规则"
            : getAdvancedRuleGroup(item.ruleCategory) === "stat"
              ? "统计型规则"
              : "跨表规则",
          name: item.ruleName,
          type: getAdvancedRuleCategoryLabel(item.ruleCategory),
          detail: item.fieldsText,
          fieldComment: item.fieldComments,
          ddlSql: item.ddlSql,
          statusText: "启用",
        })),
    ],
    [fieldRuleDetails, advancedRuleDetails],
  );

  const primaryKeyChecked = workingFields.length > 0 && workingFields.every((item) => Boolean(item.isPrimaryKey));
  const primaryKeyIndeterminate = workingFields.some((item) => Boolean(item.isPrimaryKey)) && !primaryKeyChecked;
  const nonNullChecked = workingFields.length > 0 && workingFields.every((item) => Boolean(item.nonNullCheck));
  const nonNullIndeterminate = workingFields.some((item) => Boolean(item.nonNullCheck)) && !nonNullChecked;
  const duplicateChecked = workingFields.length > 0 && workingFields.every((item) => Boolean(item.duplicateCheck));
  const duplicateIndeterminate = workingFields.some((item) => Boolean(item.duplicateCheck)) && !duplicateChecked;

  const fieldColumns: ColumnsType<QualityStrategyFieldRecord> = [
    {
      title: "字段",
      key: "columnName",
      width: 190,
      fixed: "left",
      align: "center",
      render: (_value, record) => (
        <div style={{ width: "100%", overflow: "hidden" }}>
          <Typography.Text strong ellipsis={{ tooltip: record.columnName }} style={{ display: "block", width: "100%" }}>
            {record.columnName}
          </Typography.Text>
          <Typography.Text
            type="secondary"
            ellipsis={{ tooltip: record.columnComment || "-" }}
            style={{ display: "block", width: "100%" }}
          >
            {record.columnComment || "-"}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "类型",
      key: "type",
      width: 120,
      align: "center",
      render: (_value, record) => (
        <Typography.Text ellipsis={{ tooltip: record.dataType || record.columnType || "-" }} style={{ display: "block", width: "100%" }}>
          {record.dataType || record.columnType || "-"}
        </Typography.Text>
      ),
    },
    {
      title: "样例值",
      dataIndex: "sampleValues",
      key: "sampleValues",
      width: 180,
      align: "center",
      render: (value: string[]) => {
        const text = value?.length ? value.join(" / ") : "-";
        return (
          <Typography.Text ellipsis={{ tooltip: text }} style={{ display: "block", width: "100%" }}>
            {text}
          </Typography.Text>
        );
      },
    },
    {
      title: "有值率",
      dataIndex: "valueRate",
      key: "valueRate",
      width: 88,
      align: "center",
      render: (value) => formatRate(value),
    },
    {
      title: (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Checkbox
            checked={primaryKeyChecked}
            indeterminate={primaryKeyIndeterminate}
            onChange={(event) => updateBooleanColumn("isPrimaryKey", event.target.checked)}
          />
          <span style={{ marginLeft: 6, whiteSpace: "nowrap" }}>主键</span>
        </div>
      ),
      dataIndex: "isPrimaryKey",
      key: "isPrimaryKey",
      width: 96,
      align: "center",
      render: (_value, record) => (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Checkbox checked={Boolean(record.isPrimaryKey)} onChange={(event) => updateField(record.columnName, { isPrimaryKey: event.target.checked })} />
        </div>
      ),
    },
    {
      title: (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Checkbox
            checked={nonNullChecked}
            indeterminate={nonNullIndeterminate}
            onChange={(event) => updateBooleanColumn("nonNullCheck", event.target.checked)}
          />
          <span style={{ marginLeft: 6, whiteSpace: "nowrap" }}>非空检测</span>
        </div>
      ),
      dataIndex: "nonNullCheck",
      key: "nonNullCheck",
      width: 116,
      align: "center",
      render: (_value, record) => (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Checkbox checked={Boolean(record.nonNullCheck)} onChange={(event) => updateField(record.columnName, { nonNullCheck: event.target.checked })} />
        </div>
      ),
    },
    {
      title: (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Checkbox
            checked={duplicateChecked}
            indeterminate={duplicateIndeterminate}
            onChange={(event) => updateBooleanColumn("duplicateCheck", event.target.checked)}
          />
          <span style={{ marginLeft: 6, whiteSpace: "nowrap" }}>重复检测</span>
        </div>
      ),
      dataIndex: "duplicateCheck",
      key: "duplicateCheck",
      width: 116,
      align: "center",
      render: (_value, record) => (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Checkbox checked={Boolean(record.duplicateCheck)} onChange={(event) => updateField(record.columnName, { duplicateCheck: event.target.checked })} />
        </div>
      ),
    },
    {
      title: "合规规则",
      dataIndex: "complianceRuleCodes",
      key: "complianceRuleCodes",
      width: 220,
      align: "center",
      render: (_value, record) => (
        <Select
          mode="multiple"
          size="small"
          style={{ width: "100%" }}
          maxTagCount="responsive"
          allowClear
          placeholder=""
          value={record.complianceRuleCodes}
          options={regexRules.map((item) => ({ value: item.ruleCode, label: item.ruleName }))}
          onChange={(value) => updateField(record.columnName, { complianceRuleCodes: value })}
        />
      ),
    },
    {
      title: "值域范围",
      key: "valueRangeConfig",
      width: 200,
      align: "left",
      render: (_value, record) => {
        const mode = normalizeMode(record);
        const config = {
          ...createValueRangeConfig(mode, record),
          ...getValueRangeConfig(record),
        };

        const modeOptions = [
          { value: "dictionary", label: "字典表" },
          { value: "custom_list", label: "自定义值" },
          { value: "number_range", label: "数值区间" },
          { value: "date_range", label: "日期区间" },
        ].filter((option) => {
          if (option.value === "number_range") return isNumberField(record) || !isDateField(record);
          if (option.value === "date_range") return isDateField(record);
          return true;
        });

        const detailEditor = (() => {
          if (mode === "dictionary") {
            return (
              <Select
                size="small"
                showSearch
                style={{ width: "100%" }}
                optionFilterProp="label"
                filterOption={selectLabelFilter}
                value={config.sourceId ?? undefined}
                placeholder="选择字典表"
                options={dictionaryOptions}
                onChange={(value) => {
                  const selected = dictionaryOptions.find((item) => item.value === Number(value));
                  updateField(record.columnName, {
                    valueRangeConfig: {
                      ...createValueRangeConfig("dictionary", record),
                      sourceId: Number(value),
                      sourceLabel: selected?.label || "",
                    },
                  });
                }}
              />
            );
          }

          if (mode === "custom_list") {
            return (
              <Input
                key={`${record.columnName}:${mode}:${(config.allowedValues || []).join(",")}`}
                size="small"
                placeholder="多个值逗号分隔"
                defaultValue={(config.allowedValues || []).join(",")}
                onBlur={(event) => commitCustomListDraft(record.columnName, record, event.target.value)}
                onPressEnter={(event) => {
                  const nextValue = (event.target as HTMLInputElement).value;
                  commitCustomListDraft(record.columnName, record, nextValue);
                }}
              />
            );
          }

          if (mode === "number_range") {
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                <InputNumber
                  size="small"
                  style={{ width: "100%" }}
                  placeholder="最小"
                  value={config.minValue ?? undefined}
                  onChange={(value) => updateField(record.columnName, {
                    valueRangeConfig: {
                      ...createValueRangeConfig("number_range", record),
                      minValue: value ?? null,
                      maxValue: config.maxValue ?? null,
                    },
                  })}
                />
                <InputNumber
                  size="small"
                  style={{ width: "100%" }}
                  placeholder="最大"
                  value={config.maxValue ?? undefined}
                  onChange={(value) => updateField(record.columnName, {
                    valueRangeConfig: {
                      ...createValueRangeConfig("number_range", record),
                      minValue: config.minValue ?? null,
                      maxValue: value ?? null,
                    },
                  })}
                />
              </div>
            );
          }

          if (mode === "date_range") {
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                <Input
                  size="small"
                  type="date"
                  value={config.startDate || ""}
                  onChange={(event) => updateField(record.columnName, {
                    valueRangeConfig: {
                      ...createValueRangeConfig("date_range", record),
                      startDate: event.target.value || null,
                      endDate: config.endDate || null,
                    },
                  })}
                />
                <Input
                  size="small"
                  type="date"
                  value={config.endDate || ""}
                  onChange={(event) => updateField(record.columnName, {
                    valueRangeConfig: {
                      ...createValueRangeConfig("date_range", record),
                      startDate: config.startDate || null,
                      endDate: event.target.value || null,
                    },
                  })}
                />
              </div>
            );
          }

          return null;
        })();

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", textAlign: "left" }}>
              <Select
                size="small"
                style={{ width: "100%" }}
                value={mode === "none" ? undefined : mode}
                options={modeOptions}
                allowClear
              placeholder=""
              onChange={(value) => {
                const nextMode = (value as ValueRangeMode) || "none";
                updateField(record.columnName, { valueRangeConfig: createValueRangeConfig(nextMode, record) });
              }}
              />
            <div style={{ width: "100%", minWidth: 0 }}>
              {detailEditor}
            </div>
          </div>
        );
      },
    },
  ];

  const advancedRuleColumns: ColumnsType<QualityAdvancedRuleRecord> = [
    {
      title: "规则名称",
      dataIndex: "ruleName",
      key: "ruleName",
      width: 420,
      render: (value, record) => (
        <div className="quality-strategy-rule-summary">
          <Typography.Text className="quality-strategy-rule-summary__name" strong ellipsis={{ tooltip: value }}>
            {value}
          </Typography.Text>
          <Typography.Paragraph
            className="quality-strategy-rule-summary__description"
            type="secondary"
            ellipsis={{ rows: 2, tooltip: record.description || "-" }}
          >
            {record.description || "-"}
          </Typography.Paragraph>
        </div>
      ),
    },
    {
      title: "类型",
      dataIndex: "ruleCategory",
      key: "ruleCategory",
      width: 140,
      render: (value) => (
        <Typography.Text className="quality-strategy-rule-type">
          {getAdvancedRuleCategoryLabel(value)}
        </Typography.Text>
      ),
    },
    {
      title: "关联字段",
      key: "fields",
      width: 520,
      render: (_value, record) => (
        <Typography.Paragraph
          className="quality-strategy-rule-fields"
          ellipsis={{ rows: 2, tooltip: getAdvancedRuleFields(record) }}
        >
          {getAdvancedRuleFields(record)}
        </Typography.Paragraph>
      ),
    },
    {
      title: "级别",
      dataIndex: "severity",
      key: "severity",
      width: 90,
      render: (value) => <Tag color={value === "high" ? "red" : value === "medium" ? "orange" : "default"}>{advancedRuleSeverityOptions.find((item) => item.value === value)?.label || value}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      width: 90,
      render: (value, record) => (
        <Checkbox
          checked={value !== false}
          onChange={(event) => setWorkingAdvancedRules((current) => current.map((item) => (
            item.ruleId === record.ruleId ? { ...item, enabled: event.target.checked } : item
          )))}
        >
          启用
        </Checkbox>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_value, record) => (
        <Space className="quality-strategy-rule-actions" size={0}>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openAdvancedRuleModal(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该高级规则？" onConfirm={() => handleDeleteAdvancedRule(record.ruleId)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const fieldDetailColumns: ColumnsType<QualityStrategyFieldRecord> = [
    {
      title: "字段名",
      dataIndex: "columnName",
      key: "columnName",
      width: 220,
      render: (value, record) => (
        <Space direction="vertical" size={0} style={{ display: "flex" }}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">{record.columnComment || "-"}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "类型",
      key: "type",
      width: 160,
      render: (_value, record) => record.dataType || record.columnType || "-",
    },
    {
      title: "有值率",
      dataIndex: "valueRate",
      key: "valueRate",
      width: 120,
      render: (value) => formatRate(value),
    },
    {
      title: "已配置规则",
      key: "configured",
      render: (_value, record) => getFieldRuleEntries(record, { complianceRuleNameMap }).map((item) => item.ruleType).join("、") || "-",
    },
  ];

  const fieldRuleDetailColumns: ColumnsType<any> = [
    { title: "字段名", dataIndex: "fieldName", key: "fieldName", width: 180 },
    { title: "字段注释", dataIndex: "fieldComment", key: "fieldComment", width: 220 },
    { title: "规则类型", dataIndex: "ruleType", key: "ruleType", width: 140 },
    { title: "明细", dataIndex: "detail", key: "detail" },
    {
      title: "DDL",
      key: "ddlSql",
      width: 100,
      render: (_value, record) => (
        <Button
          size="small"
          type="link"
          onClick={() => setRuleSqlPreview({
            title: record.fieldName,
            group: "字段级规则",
            type: record.ruleType,
            fieldComment: record.fieldComment,
            detail: record.detail,
            sql: record.ddlSql || "",
          })}
        >
          查看
        </Button>
      ),
    },
  ];

  const combinedRuleDetailColumns: ColumnsType<any> = [
    { title: "规则分组", dataIndex: "group", key: "group", width: 120 },
    { title: "名称", dataIndex: "name", key: "name", width: 220 },
    { title: "类型", dataIndex: "type", key: "type", width: 160 },
    { title: "字段注释", dataIndex: "fieldComment", key: "fieldComment", width: 220 },
    { title: "明细", dataIndex: "detail", key: "detail" },
    {
      title: "DDL",
      key: "ddlSql",
      width: 100,
      render: (_value, record) => (
        <Button
          size="small"
          type="link"
          onClick={() => setRuleSqlPreview({
            title: record.name,
            group: record.group,
            type: record.type,
            fieldComment: record.fieldComment,
            detail: record.detail,
            sql: record.ddlSql || "",
          })}
        >
          查看
        </Button>
      ),
    },
    { title: "状态", dataIndex: "statusText", key: "statusText", width: 100 },
  ];

  const advancedRuleDetailColumns: ColumnsType<any> = [
    { title: "规则名称", dataIndex: "ruleName", key: "ruleName", width: 220 },
    { title: "类型", dataIndex: "ruleCategory", key: "ruleCategory", width: 160, render: (value) => getAdvancedRuleCategoryLabel(value) },
    { title: "关联字段", dataIndex: "fieldsText", key: "fieldsText", width: 220 },
    { title: "字段注释", dataIndex: "fieldComments", key: "fieldComments", width: 220 },
    {
      title: "DDL",
      key: "ddlSql",
      width: 100,
      render: (_value, record) => (
        <Button
          size="small"
          type="link"
          onClick={() => setRuleSqlPreview({
            title: record.ruleName,
            group: getAdvancedRuleGroup(record.ruleCategory) === "row" ? "行级规则" : getAdvancedRuleGroup(record.ruleCategory) === "stat" ? "统计型规则" : "跨表规则",
            type: getAdvancedRuleCategoryLabel(record.ruleCategory),
            fieldComment: record.fieldComments,
            detail: record.fieldsText,
            sql: record.ddlSql || "",
          })}
        >
          查看
        </Button>
      ),
    },
    { title: "状态", dataIndex: "statusText", key: "statusText", width: 100 },
    {
      title: "说明",
      dataIndex: "description",
      key: "description",
      width: 280,
      render: (value) => (
        <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, tooltip: value || "-" }}>
          {value || "-"}
        </Typography.Paragraph>
      ),
    },
  ];

  const strategyStatDetail = useMemo(() => {
    switch (strategyStatDetailKey) {
      case "total":
        return {
          title: "字段总数明细",
          columns: fieldDetailColumns,
          rows: workingFields,
        };
      case "configuredFields":
        return {
          title: "已配置字段明细",
          columns: fieldDetailColumns,
          rows: workingFields.filter(hasFieldRuleConfigured),
        };
      case "unconfiguredFields":
        return {
          title: "未配置字段明细",
          columns: fieldDetailColumns,
          rows: workingFields.filter((item) => !hasFieldRuleConfigured(item)),
        };
      case "configuredRules":
        return {
          title: "已配置规则明细",
          columns: combinedRuleDetailColumns,
          rows: combinedRuleDetails,
        };
      case "field":
        return {
          title: "字段级规则明细",
          columns: fieldRuleDetailColumns,
          rows: fieldRuleDetails,
        };
      case "row":
        return {
          title: "行级规则明细",
          columns: advancedRuleDetailColumns,
          rows: advancedRuleDetails.filter((item) => getAdvancedRuleGroup(item.ruleCategory) === "row"),
        };
      case "stat":
        return {
          title: "统计型规则明细",
          columns: advancedRuleDetailColumns,
          rows: advancedRuleDetails.filter((item) => getAdvancedRuleGroup(item.ruleCategory) === "stat"),
        };
      case "cross":
        return {
          title: "跨表规则明细",
          columns: advancedRuleDetailColumns,
          rows: advancedRuleDetails.filter((item) => getAdvancedRuleGroup(item.ruleCategory) === "cross"),
        };
      default:
        return null;
    }
  }, [
    strategyStatDetailKey,
    workingFields,
    combinedRuleDetails,
    fieldRuleDetails,
    fieldDetailColumns,
    combinedRuleDetailColumns,
    fieldRuleDetailColumns,
    advancedRuleDetailColumns,
    advancedRuleDetails,
  ]);

  return (
    <div className="app-page">
      <PageToolbar
        left={(
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dashboard/quality-control/strategies")}>
            返回清单
          </Button>
        )}
        right={(
          <Space wrap>
            <Space.Compact>
              <Select
                allowClear
                style={{ width: 260 }}
                placeholder="切换版本"
                value={selectedVersionId}
                options={versionOptions}
                onChange={(value) => handleSelectVersion(value)}
              />
              <Popconfirm
                title="确认删除当前策略版本？"
                description={selectedVersion ? `删除 V${selectedVersion.versionNo} 后不可恢复。` : "删除后不可恢复。"}
                onConfirm={() => void handleDeleteVersion()}
                okButtonProps={{ loading: deletingVersion }}
                disabled={!selectedVersionId}
              >
                <Button danger icon={<DeleteOutlined />} loading={deletingVersion} disabled={!selectedVersionId}>
                  删除版本
                </Button>
              </Popconfirm>
            </Space.Compact>
            <Button icon={<BulbOutlined />} type="primary" onClick={openRecommendationConfig} loading={recommending}>
              策略推荐
            </Button>
            <Button icon={<SaveOutlined />} onClick={() => void handleSaveDraft()} loading={saving}>
              保存草稿
            </Button>
            <Button icon={<FileTextOutlined />} onClick={() => void handleSubmit()} loading={submitting}>
              提交策略
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadPage()} loading={loading || detailLoading}>
              刷新
            </Button>
          </Space>
        )}
      />

      <div className="app-page-body">
        {!detail ? (
          <Card variant="borderless" className="surface-card" loading={detailLoading}>
            <Empty description="未找到对应监控表的策略详情" />
          </Card>
        ) : (
          <Card
            variant="borderless"
            className="surface-card"
            loading={detailLoading}
          >
            <Space direction="vertical" size={16} style={{ display: "flex" }}>
              <div
                style={{
                  padding: 14,
                  border: "1px solid #f0f0f0",
                  borderRadius: 12,
                  background: "linear-gradient(180deg, #fafcff 0%, #ffffff 100%)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 0.88fr) minmax(720px, 1.12fr)",
                    gap: 12,
                    alignItems: "start",
                  }}
                >
                  <Space direction="vertical" size={10} style={{ display: "flex" }}>
                    <Space wrap size={[8, 8]}>
                      {selectedVersion ? (
                        <Tag color="blue">{`当前版本：V${selectedVersion.versionNo}`}</Tag>
                      ) : (
                        <Tag>当前版本：未保存</Tag>
                      )}
                      <StatusTag
                        label={`状态：${formatStrategyStatus(selectedVersion?.versionStatus || detail.strategy?.strategyStatus || detail.monitorTable.strategyStatus || "draft")}`}
                        tone={getStrategyStatusTone(selectedVersion?.versionStatus || detail.strategy?.strategyStatus || detail.monitorTable.strategyStatus || "draft")}
                      />
                      <StatusTag label={`数据源：${detail.monitorTable.sourceName || "-"}`} tone="default" />
                    </Space>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #edf1f7",
                          background: "#fff",
                          minWidth: 0,
                        }}
                      >
                        <Space direction="vertical" size={2} style={{ display: "flex", minWidth: 0 }}>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            监控表
                          </Typography.Text>
                          <Typography.Text strong ellipsis={{ tooltip: detail.monitorTable.tableComment || detail.monitorTable.tableName }} style={{ display: "block", width: "100%", fontSize: 14 }}>
                            {detail.monitorTable.tableComment || "-"}
                          </Typography.Text>
                          <Typography.Text type="secondary" ellipsis={{ tooltip: detail.monitorTable.tableName }} style={{ display: "block", width: "100%" }}>
                            {detail.monitorTable.tableName}
                          </Typography.Text>
                        </Space>
                      </div>
                      {[
                        { label: "最近提交", value: formatDateTime(detail.monitorTable.lastSubmittedAt) },
                        { label: "问题统计表", value: detail.monitorTable.statsTableName || "-" },
                        { label: "问题明细表", value: detail.monitorTable.detailTableName || "-" },
                      ].map((item) => (
                        <div
                          key={item.label}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid #edf1f7",
                            background: "#fff",
                            minWidth: 0,
                          }}
                        >
                          <Space direction="vertical" size={2} style={{ display: "flex", minWidth: 0 }}>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {item.label}
                            </Typography.Text>
                            <Typography.Text strong ellipsis={{ tooltip: item.value }} style={{ display: "block", width: "100%", fontSize: 14 }}>
                              {item.value}
                            </Typography.Text>
                          </Space>
                        </div>
                      ))}
                    </div>
                  </Space>

                  <Card
                    size="small"
                    variant="borderless"
                    style={{ background: "#fff", width: "100%" }}
                    title="规则统计"
                    extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>当前版本</Typography.Text>}
                    styles={{ body: { padding: 12 } }}
                  >
                    <div
                      className="kpi-grid"
                      style={{
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: 8,
                        width: "100%",
                      }}
                    >
                      {strategyStats.map((item) => (
                        <div
                          key={item.key}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #edf1f7",
                            background: "#fff",
                            minHeight: 68,
                            cursor: "pointer",
                          }}
                          role="button"
                          tabIndex={0}
                          onClick={() => setStrategyStatDetailKey(item.key as StrategyStatKey)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setStrategyStatDetailKey(item.key as StrategyStatKey);
                            }
                          }}
                        >
                          <Space direction="vertical" size={2} style={{ display: "flex" }}>
                            <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>
                              {item.title}
                            </Typography.Text>
                            <Typography.Text strong style={{ fontSize: 17, lineHeight: 1.1 }}>
                              {item.value}
                            </Typography.Text>
                          </Space>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>

              <Tabs
                items={[
                  {
                    key: "field",
                    label: "字段级规则",
                    children: (
                      <Table<QualityStrategyFieldRecord>
                        rowKey="columnName"
                        size="small"
                        tableLayout="fixed"
                        columns={fieldColumns}
                        dataSource={workingFields}
                        pagination={false}
                        scroll={{ x: 1260 }}
                      />
                    ),
                  },
                  {
                    key: "row",
                    label: "行级规则",
                    children: (
                      <Card
                        size="small"
                        variant="borderless"
                        extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openAdvancedRuleModal(undefined, "conditional_required")}>新建规则</Button>}
                        styles={{ body: { padding: 0 } }}
                      >
                        <Table<QualityAdvancedRuleRecord>
                          className="quality-strategy-rule-table"
                          rowKey="ruleId"
                          size="small"
                          tableLayout="fixed"
                          columns={advancedRuleColumns}
                          dataSource={workingAdvancedRules.filter((item) => getAdvancedRuleGroup(item.ruleCategory) === "row")}
                          pagination={false}
                          locale={{ emptyText: <Empty description="暂无行级规则" /> }}
                          scroll={{ x: 1400 }}
                        />
                      </Card>
                    ),
                  },
                  {
                    key: "stat",
                    label: "统计型规则",
                    children: (
                      <Card
                        size="small"
                        variant="borderless"
                        extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openAdvancedRuleModal(undefined, "volume_anomaly")}>新建规则</Button>}
                        styles={{ body: { padding: 0 } }}
                      >
                        <Table<QualityAdvancedRuleRecord>
                          className="quality-strategy-rule-table"
                          rowKey="ruleId"
                          size="small"
                          tableLayout="fixed"
                          columns={advancedRuleColumns}
                          dataSource={workingAdvancedRules.filter((item) => getAdvancedRuleGroup(item.ruleCategory) === "stat")}
                          pagination={false}
                          locale={{ emptyText: <Empty description="暂无统计型规则" /> }}
                          scroll={{ x: 1400 }}
                        />
                      </Card>
                    ),
                  },
                  {
                    key: "cross",
                    label: "跨表规则",
                    children: (
                      <Card
                        size="small"
                        variant="borderless"
                        extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openAdvancedRuleModal(undefined, "cross_table_lookup")}>新建规则</Button>}
                        styles={{ body: { padding: 0 } }}
                      >
                        <Table<QualityAdvancedRuleRecord>
                          className="quality-strategy-rule-table"
                          rowKey="ruleId"
                          size="small"
                          tableLayout="fixed"
                          columns={advancedRuleColumns}
                          dataSource={workingAdvancedRules.filter((item) => getAdvancedRuleGroup(item.ruleCategory) === "cross")}
                          pagination={false}
                          locale={{ emptyText: <Empty description="暂无跨表规则" /> }}
                          scroll={{ x: 1400 }}
                        />
                      </Card>
                    ),
                  },
                ]}
              />
            </Space>
          </Card>
        )}
      </div>

      <Modal
        open={recommendationConfigOpen}
        title="配置智能策略推荐"
        width={920}
        styles={{ body: { maxHeight: "calc(100vh - 180px)", overflowY: "auto", paddingTop: 10 } }}
        okText="开始生成候选"
        cancelText="取消"
        confirmLoading={recommending}
        onCancel={() => setRecommendationConfigOpen(false)}
        onOk={() => void handleRecommend()}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 10 }}
          message="仅生成待审核候选；系统结合样例、字段画像、规则资产和监控方向生成建议，采纳后才创建策略草稿。"
          description={recommendationStage || undefined}
        />
        <Form
          className="quality-recommendation-config"
          form={recommendationForm}
          layout="vertical"
          size="small"
          onValuesChange={(changedValues) => {
            if (changedValues.baselineMode === "last_batch") recommendationForm.setFieldValue("minHistoryBatches", 1);
          }}
        >
          <Form.Item name="keyFields" hidden>
            <Select mode="multiple" />
          </Form.Item>
          <Typography.Title className="quality-recommendation-config__title" level={5}>采样与业务上下文</Typography.Title>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", columnGap: 10 }}>
            <Form.Item name="sampleSize" label="取样条数（条）" rules={[{ required: true }]}>
              <InputNumber min={10} max={500} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="sampleMode" label="取样方式" rules={[{ required: true }]}>
              <Select options={[{ value: "random", label: "随机抽样" }, { value: "latest", label: "最近数据" }, { value: "head", label: "表头顺序" }]} />
            </Form.Item>
            {recommendationSampleMode === "latest" ? <Form.Item
              name="orderField"
              label="排序字段"
              rules={[{ required: true, message: "请选择有有效值的时间或批次字段" }]}
            >
              <Select showSearch optionFilterProp="label" options={recommendationOrderFieldOptions} placeholder="选择排序字段" />
            </Form.Item> : null}
            <Form.Item name="tableKind" label="数据表类型">
              <Select options={[{ value: "general", label: "通用业务表" }, { value: "master", label: "主数据表" }, { value: "transaction", label: "交易/明细表" }, { value: "event", label: "事件流表" }, { value: "batch", label: "周期批次表" }, { value: "snapshot", label: "快照表" }, { value: "reference", label: "参考/字典表" }]} />
            </Form.Item>
            <Form.Item name="ruleStrength" label="规则强度">
              <Select options={[{ value: "basic", label: "基础" }, { value: "balanced", label: "平衡（推荐）" }, { value: "strict", label: "严格" }]} />
            </Form.Item>
            <Form.Item label="业务关键字段">
              <Space size={8} wrap>
                <Button icon={<SettingOutlined />} onClick={openKeyFieldPicker}>选择字段</Button>
                {recommendationKeyFields.length ? <Tooltip title={recommendationKeyFields.join("、")}><Tag color="blue">已选 {recommendationKeyFields.length} 个</Tag></Tooltip> : <Typography.Text type="secondary">未选择</Typography.Text>}
              </Space>
            </Form.Item>
          </div>
          <Typography.Title className="quality-recommendation-config__title" level={5}>监控方向</Typography.Title>
          <Form.Item name="monitorDirections" rules={[{ required: true, type: "array", min: 1, message: "至少选择一个监控方向" }]}>
            <Checkbox.Group style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", columnGap: 16 }}>
              {[
                { value: "completeness", label: "完整性", description: "关键数据缺失，以及批次或周期数据是否完整到达" },
                { value: "uniqueness", label: "唯一性", description: "主键、业务键或组合键是否重复" },
                { value: "validity", label: "有效性", description: "格式、值域、数值区间和日期区间是否符合已证明的约束" },
                { value: "consistency", label: "一致性", description: "同一行字段关系、关联记录是否存在或关联记录业务属性是否一致" },
                { value: "timeliness", label: "时效性", description: "数据是否在预期时限内到达或更新" },
                { value: "stability", label: "稳定性", description: "数据量和关键字段空值率是否发生异常波动" },
              ].map((item) => <Tooltip key={item.value} title={item.description}><Checkbox value={item.value}>{item.label}</Checkbox></Tooltip>)}
            </Checkbox.Group>
          </Form.Item>
          {recommendationMonitorDirections?.includes("consistency") ? <Form.Item
            name="referenceTables"
            label={<Space size={4}>关联参考表<Tooltip title="仅展示当前数据源下的其他表，并读取字段和样例识别关联键与一致性字段。"><InfoCircleOutlined /></Tooltip></Space>}
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              maxTagCount={1}
              maxTagPlaceholder={(omittedValues) => `已选 ${omittedValues.length + 1} 张`}
              options={referenceTableOptions}
              loading={referenceTablesLoading}
              placeholder="选择同一数据源下的关联表（可多选）"
            />
          </Form.Item> : null}
          {recommendationMonitorDirections?.includes("stability") ? <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", columnGap: 10 }}>
            <Form.Item name="baselineMode" label="动态基线方式">
              <Select options={[{ value: "recent_avg", label: "近N批均值" }, { value: "last_batch", label: "上一批" }]} />
            </Form.Item>
            {recommendationBaselineMode === "recent_avg" ? <Form.Item name="lookbackBatches" label="基线窗口（批次）">
              <InputNumber min={1} max={30} style={{ width: "100%" }} />
            </Form.Item> : <Form.Item name="minHistoryBatches" label="最小有效历史批次">
              <InputNumber min={1} max={1} disabled style={{ width: "100%" }} />
            </Form.Item>}
            {recommendationBaselineMode === "recent_avg" ? <Form.Item name="minHistoryBatches" label="最小有效历史批次">
              <InputNumber min={1} max={30} style={{ width: "100%" }} />
            </Form.Item> : null}
            <Form.Item name="warmupPolicy" label="冷启动处理">
              <Select options={[{ value: "collect_only", label: "仅积累指标，不告警" }, { value: "upper_threshold", label: "超过冷启动上限才告警" }]} />
            </Form.Item>
          </div> : null}
          {recommendationMonitorDirections?.includes("stability") && recommendationWarmupPolicy === "upper_threshold" ? <Form.Item name="warmupThreshold" label={<Space size={4}>冷启动上限<Tooltip title="按统计规则的当前指标判断，生成候选后仍可分别调整。"><InfoCircleOutlined /></Tooltip></Space>} rules={[{ required: true, message: "请输入冷启动上限" }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item> : null}
        </Form>
      </Modal>

      <Modal
        open={keyFieldPickerOpen}
        title="选择业务关键字段"
        width={860}
        okText="确认选择"
        cancelText="取消"
        onOk={confirmKeyFieldPicker}
        onCancel={() => setKeyFieldPickerOpen(false)}
        destroyOnHidden
      >
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="业务关键字段会强化非空、唯一性和关键质量监控的推荐，不会直接修改当前策略。" />
        <Table<QualityStrategyFieldRecord>
          rowKey="columnName"
          size="small"
          pagination={{ pageSize: 8, showSizeChanger: false }}
          rowSelection={{
            selectedRowKeys: pendingKeyFields,
            onChange: (keys) => setPendingKeyFields(keys.map(String)),
          }}
          columns={[
            { title: "字段名", dataIndex: "columnName", width: 220 },
            { title: "字段说明", dataIndex: "columnComment", width: 260, render: (value) => value || "-" },
            { title: "数据类型", key: "dataType", width: 180, render: (_value, record) => record.dataType || record.columnType || "-" },
            { title: "建议", key: "hint", render: (_value, record) => record.isPrimaryKey ? <Tag color="blue">主键</Tag> : record.nonNullCheck ? <Tag color="green">已配置非空</Tag> : "-" },
          ]}
          dataSource={workingFields}
        />
      </Modal>

      <Modal
        open={recommendationReviewOpen}
        title="审核智能策略候选"
        width={1440}
        styles={{ body: { maxHeight: "calc(100vh - 190px)", overflowY: "auto", paddingTop: 12 } }}
        okText="采纳并生成草稿"
        cancelText="暂不采纳"
        confirmLoading={saving}
        onCancel={() => void handleRejectRecommendation()}
        onOk={() => void handleApplyRecommendation()}
        destroyOnHidden
      >
        {recommendationRun ? (
          <Space className="quality-recommendation-review" direction="vertical" size={14} style={{ display: "flex" }}>
            <Alert
              type={recommendationRun.modelUsed ? "success" : "warning"}
              showIcon
              message={recommendationRun.modelUsed ? `模型建议已生成：${recommendationRun.aiModelName || "已配置模型"}` : "本次模型未返回结果，当前展示的是规则引擎基础建议"}
              description={`${recommendationRun.summaryText || ""}；已取样 ${recommendationRun.profileSnapshot?.sampleSize || 0} 条，表总行数 ${recommendationRun.profileSnapshot?.totalRows || 0}${getRecommendationFailureLabel(recommendationRun) ? `；${getRecommendationFailureLabel(recommendationRun)}` : ""}。字段级列表仅展示包含实际校验规则的候选。`}
            />
            <Tabs items={[
              {
                key: "candidate-fields",
                label: `字段级规则（${recommendationCandidateFields.length}）`,
                children: <Table<QualityStrategyFieldRecord>
                  className="quality-recommendation-table"
                  rowKey="columnName"
                  size="small"
                  tableLayout="fixed"
                  scroll={{ x: 1190 }}
                  pagination={{ pageSize: 8, showSizeChanger: false, size: "small" }}
                  rowSelection={{ columnWidth: 44, selectedRowKeys: selectedRecommendationFields, onChange: (keys) => setSelectedRecommendationFields(keys.map(String)) }}
                  columns={[
                    {
                      title: "字段",
                      dataIndex: "columnName",
                      width: 200,
                      render: (value, record) => <Space direction="vertical" size={0} style={{ width: "100%" }}>
                        <Typography.Paragraph className="quality-recommendation-clamp" strong ellipsis={{ rows: 2, tooltip: value }}>{value}</Typography.Paragraph>
                        <Typography.Paragraph className="quality-recommendation-clamp" type="secondary" ellipsis={{ rows: 2, tooltip: record.columnComment || "-" }}>{record.columnComment || "-"}</Typography.Paragraph>
                      </Space>,
                    },
                    {
                      title: "样例值",
                      dataIndex: "sampleValues",
                      width: 230,
                      render: (value: string[]) => <Typography.Paragraph className="quality-recommendation-clamp" ellipsis={{ rows: 2, tooltip: (value || []).join("、") || "-" }}>
                        {(value || []).slice(0, 5).join("、") || "-"}
                      </Typography.Paragraph>,
                    },
                    {
                      title: "规则配置",
                      width: 220,
                      render: (_value, record) => {
                        const labels = [
                          record.nonNullCheck ? "非空" : "",
                          record.duplicateCheck ? "唯一" : "",
                          ...(record.complianceRules || []).map((item) => item.ruleName),
                          record.valueRangeConfig?.mode !== "none" ? "值域校验" : "",
                        ].filter(Boolean);
                        return labels.length ? <Space size={[4, 4]} wrap>{labels.map((label) => <Tag key={label} color="blue">{label}</Tag>)}</Space> : <Typography.Text type="secondary">未配置有效规则</Typography.Text>;
                      },
                    },
                    {
                      title: "业务理解与依据",
                      width: 490,
                      render: (_value, record) => (
                        <Space direction="vertical" size={1} style={{ display: "flex" }}>
                          <Typography.Text strong>{record.businessRole || "待确认"}{record.confidence ? ` · ${record.confidence === "high" ? "高" : record.confidence === "medium" ? "中" : "低"}置信` : ""}</Typography.Text>
                          <Typography.Paragraph className="quality-recommendation-clamp" type="secondary" ellipsis={{ rows: 2, tooltip: record.semanticEvidence || record.recommendationReason || "-" }}>{record.semanticEvidence || record.recommendationReason || "-"}</Typography.Paragraph>
                          {record.assetEvidence ? <Typography.Text type="secondary" ellipsis={{ tooltip: record.assetEvidence }}>匹配资产：{record.assetEvidence}</Typography.Text> : null}
                        </Space>
                      ),
                    },
                  ]}
                  dataSource={recommendationCandidateFields}
                />,
              },
              {
                key: "candidate-advanced",
                label: `行级/统计型/跨表建议（${recommendationRun.advancedRules.length}）`,
                children: <Table<QualityAdvancedRuleRecord>
                  className="quality-recommendation-table"
                  rowKey="ruleId"
                  size="small"
                  tableLayout="fixed"
                  scroll={{ x: 1100 }}
                  pagination={{ pageSize: 8, showSizeChanger: false, size: "small" }}
                  rowSelection={{ columnWidth: 44, selectedRowKeys: selectedRecommendationRules, onChange: (keys) => setSelectedRecommendationRules(keys.map(String)) }}
                  columns={[
                    {
                      title: "规则",
                      dataIndex: "ruleName",
                      width: 420,
                      render: (value, record) => <Space direction="vertical" size={4}>
                        <Typography.Paragraph className="quality-recommendation-clamp" strong ellipsis={{ rows: 2, tooltip: getRecommendationRuleTitle(record, recommendationFieldCommentMap, recommendationTableCommentMap) }}>
                          {getRecommendationRuleTitle(record, recommendationFieldCommentMap, recommendationTableCommentMap)}
                        </Typography.Paragraph>
                        <Space size={6} wrap>
                          <Tag color="blue">{getAdvancedRuleCategoryLabel(record.ruleCategory)}</Tag>
                          <StatusTag label={record.severity === "high" ? "高" : record.severity === "low" ? "低" : "中"} tone={record.severity === "high" ? "error" : record.severity === "low" ? "default" : "warning"} />
                        </Space>
                      </Space>,
                    },
                    {
                      title: "推荐依据",
                      width: 420,
                      render: (_value, record) => (
                        <Typography.Paragraph className="quality-recommendation-clamp" ellipsis={{ rows: 3, tooltip: (record as any).recommendationMeta?.evidence || record.description || "字段画像与监控方向" }}>
                          {(record as any).recommendationMeta?.evidence || record.description || "字段画像与监控方向"}
                        </Typography.Paragraph>
                      ),
                    },
                    {
                      title: "生效方式",
                      width: 180,
                      render: (_value, record) => (
                        <Space direction="vertical" size={4} style={{ display: "flex" }}>
                          <Typography.Text type="secondary">{getAdvancedRuleActivationHint(record)}</Typography.Text>
                        </Space>
                      ),
                    },
                  ]}
                  dataSource={recommendationRun.advancedRules}
                />,
              },
            ]} />
          </Space>
        ) : null}
      </Modal>

      <Modal
        open={advancedRuleModalOpen}
        title={editingAdvancedRuleId ? "编辑规则" : "新建规则"}
        onCancel={() => {
          setAdvancedRuleModalOpen(false);
          setEditingAdvancedRuleId(null);
          setAdvancedRuleModalGroup("row");
          setAutoRuleNameEnabled(true);
          setLastAutoRuleName("");
          advancedRuleForm.resetFields();
        }}
        onOk={() => void handleSaveAdvancedRule()}
        destroyOnHidden
        width={760}
      >
        <Form
          form={advancedRuleForm}
          layout="vertical"
          onValuesChange={(changedValues) => {
            if (changedValues.baselineMode === "last_batch") advancedRuleForm.setFieldValue("minHistoryBatches", 1);
            if (!Object.prototype.hasOwnProperty.call(changedValues, "ruleName")) return;
            const nextName = String(changedValues.ruleName || "").trim();
            if (!nextName || nextName === lastAutoRuleName) {
              setAutoRuleNameEnabled(true);
              return;
            }
            setAutoRuleNameEnabled(false);
          }}
          initialValues={{
            ruleCategory: "conditional_required",
            enabled: true,
            severity: "medium",
            conditionOperator: "is_not_null",
            requirement: "required",
            compareOperator: "<=",
            valueType: "datetime",
            ignoreBlank: true,
            maxDelayValue: 1,
            maxDelayUnit: "day",
            baselineMode: "recent_avg",
            lookbackBatches: 7,
            minHistoryBatches: 3,
            warmupPolicy: "collect_only",
            thresholdPercent: 20,
            direction: "both",
            expectedDistinctCount: 1,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 0.8fr", gap: 12 }}>
            <Form.Item name="ruleName" label="规则名称" rules={[{ required: true, message: "请输入规则名称" }]}>
              <Input placeholder="例如：证件类型+证件号码联合唯一" />
            </Form.Item>
            <Form.Item name="ruleCategory" label="规则类型" rules={[{ required: true, message: "请选择规则类型" }]}>
              <Select options={selectableAdvancedRuleOptions} />
            </Form.Item>
            <Form.Item name="severity" label="严重级别">
              <Select options={advancedRuleSeverityOptions} />
            </Form.Item>
          </div>

          {activeRuleCategory === "conditional_required" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr 1fr", gap: 12 }}>
              <Form.Item name="conditionField" label="条件字段" rules={[{ required: true, message: "请选择条件字段" }]}>
                <Select showSearch optionFilterProp="label" options={fieldOptions} />
              </Form.Item>
              <Form.Item name="conditionOperator" label="条件运算符">
                <Select options={[
                  { value: "is_not_null", label: "非空" },
                  { value: "is_null", label: "为空" },
                  { value: "=", label: "=" },
                  { value: "!=", label: "!=" },
                  { value: "in", label: "in" },
                  { value: "not_in", label: "not in" },
                ]} />
              </Form.Item>
              <Form.Item name="conditionValue" label="条件值">
                <Input placeholder="in/not in 用逗号分隔" />
              </Form.Item>
              <Form.Item name="targetField" label="目标字段" rules={[{ required: true, message: "请选择目标字段" }]}>
                <Select showSearch optionFilterProp="label" options={fieldOptions} />
              </Form.Item>
              <Form.Item name="requirement" label="校验要求">
                <Select options={[
                  { value: "required", label: "必须非空" },
                  { value: "empty", label: "必须为空" },
                ]} />
              </Form.Item>
            </div>
          ) : null}

          {activeRuleCategory === "conditional_regex" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr 1fr", gap: 12 }}>
              <Form.Item name="conditionField" label="条件字段" rules={[{ required: true, message: "请选择条件字段" }]}>
                <Select showSearch optionFilterProp="label" options={fieldOptions} />
              </Form.Item>
              <Form.Item name="conditionOperator" label="条件运算符">
                <Select options={[
                  { value: "is_not_null", label: "非空" },
                  { value: "is_null", label: "为空" },
                  { value: "=", label: "=" },
                  { value: "!=", label: "!=" },
                  { value: "in", label: "in" },
                  { value: "not_in", label: "not in" },
                ]} />
              </Form.Item>
              <Form.Item name="conditionValue" label="条件值">
                <Input placeholder="in/not in 用逗号分隔" />
              </Form.Item>
              <Form.Item name="targetField" label="目标字段" rules={[{ required: true, message: "请选择目标字段" }]}>
                <Select showSearch optionFilterProp="label" options={fieldOptions} />
              </Form.Item>
              <Form.Item name="regexPattern" label="正则表达式" rules={[{ required: true, message: "请输入正则表达式" }]}>
                <Input placeholder="例如：^[0-9]{18}$" />
              </Form.Item>
            </div>
          ) : null}

          {activeRuleCategory === "field_compare" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 1fr 0.8fr", gap: 12 }}>
              <Form.Item name="leftField" label="左字段" rules={[{ required: true, message: "请选择左字段" }]}>
                <Select showSearch optionFilterProp="label" options={fieldOptions} />
              </Form.Item>
              <Form.Item name="compareOperator" label="比较符">
                <Select options={["<=", "<", "=", ">=", ">", "!="].map((item) => ({ value: item, label: item }))} />
              </Form.Item>
              <Form.Item name="rightField" label="右字段" rules={[{ required: true, message: "请选择右字段" }]}>
                <Select showSearch optionFilterProp="label" options={fieldOptions} />
              </Form.Item>
              <Form.Item name="valueType" label="比较类型">
                <Select options={[
                  { value: "datetime", label: "日期时间" },
                  { value: "date", label: "日期" },
                  { value: "number", label: "数值" },
                  { value: "text", label: "文本" },
                ]} />
              </Form.Item>
            </div>
          ) : null}

          {activeRuleCategory === "composite_unique" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12 }}>
              <Form.Item name="fieldNames" label="联合字段" rules={[{ required: true, message: "请选择至少两个字段" }]}>
                <Select mode="multiple" showSearch optionFilterProp="label" options={fieldOptions} />
              </Form.Item>
              <Form.Item name="ignoreBlank" valuePropName="checked" label="空值策略">
                <Checkbox>忽略空值组合</Checkbox>
              </Form.Item>
            </div>
          ) : null}

          {activeRuleCategory === "freshness" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px", gap: 12 }}>
              <Form.Item name="timeField" label="时间字段" rules={[{ required: true, message: "请选择时间字段" }]}>
                <Select showSearch optionFilterProp="label" options={fieldOptions} />
              </Form.Item>
              <Form.Item name="maxDelayValue" label="最大延迟">
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="maxDelayUnit" label="延迟单位">
                <Select options={[
                  { value: "minute", label: "分钟" },
                  { value: "hour", label: "小时" },
                  { value: "day", label: "天" },
                  { value: "month", label: "月" },
                ]} />
              </Form.Item>
            </div>
          ) : null}

          {activeRuleCategory === "volume_anomaly" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px 160px", gap: 12 }}>
              <Form.Item label="监测指标">
                <Input value="批次行数" disabled />
              </Form.Item>
              <Form.Item name="baselineMode" label="比较基准">
                <Select options={[
                  { value: "last_batch", label: "上一批" },
                  { value: "recent_avg", label: "近N批均值" },
                ]} />
              </Form.Item>
              {watchedBaselineMode === "recent_avg" ? <Form.Item name="lookbackBatches" label="基线窗口（批次）">
                <InputNumber min={1} max={30} style={{ width: "100%" }} />
              </Form.Item> : <Form.Item name="minHistoryBatches" label="最小有效历史批次">
                <InputNumber min={1} max={1} disabled style={{ width: "100%" }} />
              </Form.Item>}
              {watchedBaselineMode === "recent_avg" ? <Form.Item name="minHistoryBatches" label="最小有效历史批次">
                <InputNumber min={1} max={30} style={{ width: "100%" }} />
              </Form.Item> : null}
              <Form.Item name="warmupPolicy" label="冷启动处理">
                <Select options={[{ value: "collect_only", label: "仅积累，不告警" }, { value: "upper_threshold", label: "超过上限告警" }]} />
              </Form.Item>
              <Form.Item name="thresholdPercent" label="波动阈值(%)">
                <InputNumber min={0} max={1000} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="direction" label="监测方向">
                <Select options={[
                  { value: "both", label: "上升或下降" },
                  { value: "increase", label: "仅上升" },
                  { value: "decrease", label: "仅下降" },
                ]} />
              </Form.Item>
            </div>
          ) : null}

          {activeRuleCategory === "volume_anomaly" && watchedWarmupPolicy === "upper_threshold" ? <Form.Item name="warmupThreshold" label="冷启动上限（批次行数）" rules={[{ required: true, message: "请输入冷启动上限" }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item> : null}

          {activeRuleCategory === "null_rate_change" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px 160px", gap: 12 }}>
              <Form.Item name="metricField" label="监测字段" rules={[{ required: true, message: "请选择监测字段" }]}>
                <Select showSearch optionFilterProp="label" options={fieldOptions} />
              </Form.Item>
              <Form.Item name="baselineMode" label="比较基准">
                <Select options={[
                  { value: "last_batch", label: "上一批" },
                  { value: "recent_avg", label: "近N批均值" },
                ]} />
              </Form.Item>
              {watchedBaselineMode === "recent_avg" ? <Form.Item name="lookbackBatches" label="基线窗口（批次）">
                <InputNumber min={1} max={30} style={{ width: "100%" }} />
              </Form.Item> : <Form.Item name="minHistoryBatches" label="最小有效历史批次">
                <InputNumber min={1} max={1} disabled style={{ width: "100%" }} />
              </Form.Item>}
              {watchedBaselineMode === "recent_avg" ? <Form.Item name="minHistoryBatches" label="最小有效历史批次">
                <InputNumber min={1} max={30} style={{ width: "100%" }} />
              </Form.Item> : null}
              <Form.Item name="warmupPolicy" label="冷启动处理">
                <Select options={[{ value: "collect_only", label: "仅积累，不告警" }, { value: "upper_threshold", label: "超过上限告警" }]} />
              </Form.Item>
              <Form.Item name="thresholdPercent" label="变化阈值(%)">
                <InputNumber min={0} max={1000} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="direction" label="监测方向">
                <Select options={[
                  { value: "both", label: "上升或下降" },
                  { value: "increase", label: "仅上升" },
                  { value: "decrease", label: "仅下降" },
                ]} />
              </Form.Item>
            </div>
          ) : null}

          {activeRuleCategory === "null_rate_change" && watchedWarmupPolicy === "upper_threshold" ? <Form.Item name="warmupThreshold" label="冷启动上限（空值率）" rules={[{ required: true, message: "请输入冷启动上限" }]}>
            <InputNumber min={0} max={1} step={0.01} style={{ width: "100%" }} />
          </Form.Item> : null}

          {activeRuleCategory === "batch_completeness" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12 }}>
              <Form.Item name="dimensionField" label="批次维度字段" rules={[{ required: true, message: "请选择维度字段" }]}>
                <Select showSearch optionFilterProp="label" options={fieldOptions} />
              </Form.Item>
              <Form.Item name="expectedDistinctCount" label="期望最少去重值数">
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </div>
          ) : null}

          {activeRuleCategory === "cross_table_lookup" || activeRuleCategory === "cross_table_consistency" ? (
            <Space className="quality-cross-rule-form" direction="vertical" size={0} style={{ display: "flex" }}>
              <div className="quality-cross-rule-grid">
                <Form.Item name="refTable" label="关联表" rules={[{ required: true, message: "请选择关联表" }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={referenceTableOptions}
                    loading={referenceTablesLoading}
                    placeholder="选择同一数据源下的其他表"
                    onChange={() => {
                      advancedRuleForm.setFieldsValue({
                        refFields: [],
                        comparePairs: [],
                      });
                    }}
                  />
                </Form.Item>
                <Form.Item name="localFields" label="本表关联字段" rules={[{ required: true, message: "请选择本表关联字段" }]}>
                  <Select mode="multiple" showSearch optionFilterProp="label" options={fieldOptions} />
                </Form.Item>
              </div>
              <Form.Item name="refFields" label="关联表字段" rules={[{ required: true, message: "请选择关联表字段" }]}>
                <Select
                  mode="multiple"
                  showSearch
                  optionFilterProp="label"
                  options={referenceFieldOptions}
                  loading={referenceColumnsLoading}
                  disabled={!selectedRefTable}
                  placeholder={selectedRefTable ? "选择关联表字段，顺序需与本表关联字段一致" : "请先选择关联表"}
                />
              </Form.Item>
              {activeRuleCategory === "cross_table_consistency" ? (
                <Form.List name="comparePairs">
                  {(fields, { add, remove }) => (
                    <Space direction="vertical" size={8} style={{ display: "flex" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography.Text>一致性字段映射</Typography.Text>
                        <Button
                          size="small"
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add({ localField: undefined, refField: undefined })}
                        >
                          添加映射
                        </Button>
                      </div>
                      {fields.length === 0 ? (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无字段映射" />
                      ) : null}
                      {fields.map((field) => (
                        <div
                          key={field.key}
                          className="quality-cross-rule-mapping-row"
                        >
                          <Form.Item
                            {...field}
                            name={[field.name, "localField"]}
                            label={field.name === 0 ? "本表字段" : ""}
                            rules={[{ required: true, message: "请选择本表字段" }]}
                          >
                            <Select showSearch optionFilterProp="label" options={fieldOptions} placeholder="选择本表字段" />
                          </Form.Item>
                          <Form.Item
                            {...field}
                            name={[field.name, "refField"]}
                            label={field.name === 0 ? "关联表字段" : ""}
                            rules={[{ required: true, message: "请选择关联表字段" }]}
                          >
                            <Select
                              showSearch
                              optionFilterProp="label"
                              options={referenceFieldOptions}
                              loading={referenceColumnsLoading}
                              disabled={!selectedRefTable}
                              placeholder={selectedRefTable ? "选择关联表字段" : "请先选择关联表"}
                            />
                          </Form.Item>
                          <div style={{ paddingTop: field.name === 0 ? 30 : 0 }}>
                            <Button danger onClick={() => remove(field.name)}>
                              删除
                            </Button>
                          </div>
                        </div>
                      ))}
                    </Space>
                  )}
                </Form.List>
              ) : null}
            </Space>
          ) : null}

          <Form.Item name="description" label="规则说明">
            <Input.TextArea rows={3} placeholder="用于结果明细中的问题说明" />
          </Form.Item>
          <Form.Item name="enabled" valuePropName="checked">
            <Checkbox>启用规则</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(strategyStatDetail)}
        title={strategyStatDetail?.title || "指标明细"}
        onCancel={() => setStrategyStatDetailKey(null)}
        footer={(
          <Button type="primary" onClick={() => setStrategyStatDetailKey(null)}>
            关闭
          </Button>
        )}
        width={1080}
      >
        <Table
          rowKey={(record: any) => record.key || record.ruleId || record.columnName}
          size="small"
          columns={strategyStatDetail?.columns || []}
          dataSource={strategyStatDetail?.rows || []}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 920 }}
          locale={{ emptyText: <Empty description="暂无明细" /> }}
        />
      </Modal>

      <Modal
        open={Boolean(ruleSqlPreview)}
        title={ruleSqlPreview ? `${ruleSqlPreview.title} / DDL` : "DDL 预览"}
        onCancel={() => setRuleSqlPreview(null)}
        footer={(
          <Button type="primary" onClick={() => setRuleSqlPreview(null)}>
            关闭
          </Button>
        )}
        width={820}
      >
        <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 14 }}>
          <Card size="small" title="规则信息" styles={{ body: { padding: 12 } }}>
            <Space direction="vertical" size={8} style={{ display: "flex" }}>
              <div>
                <Typography.Text type="secondary">规则分组</Typography.Text>
                <Typography.Text style={{ display: "block" }}>{ruleSqlPreview?.group || "-"}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">规则类型</Typography.Text>
                <Typography.Text style={{ display: "block" }}>{ruleSqlPreview?.type || "-"}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">字段注释</Typography.Text>
                <Typography.Text style={{ display: "block" }}>{ruleSqlPreview?.fieldComment || "-"}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">规则说明</Typography.Text>
                <Typography.Text style={{ display: "block" }}>{ruleSqlPreview?.detail || "-"}</Typography.Text>
              </div>
            </Space>
          </Card>
          <Card size="small" title="DDL / SQL 预览" styles={{ body: { padding: 0 } }}>
            <pre
              style={{
                margin: 0,
                padding: 12,
                minHeight: 360,
                maxHeight: 520,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "Consolas, monospace",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              {ruleSqlPreview?.sql || "当前版本尚未生成 SQL"}
            </pre>
          </Card>
        </div>
      </Modal>

      <Modal
        open={sqlModalOpen}
        title="生成 SQL 预览"
        onCancel={() => setSqlModalOpen(false)}
        footer={(
          <Button type="primary" onClick={() => setSqlModalOpen(false)}>
            关闭
          </Button>
        )}
        width={1100}
      >
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="策略提交成功，以下为当前版本生成的 SQL。"
        />
        <Card size="small" variant="borderless" className="surface-card">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", maxHeight: 560, overflow: "auto" }}>
            {sqlPreview || "当前版本尚未生成 SQL。"}
          </pre>
        </Card>
      </Modal>
    </div>
  );
}

export function QualityControlStrategiesPage() {
  const { monitorTableId } = useParams();
  const parsedId = Number(monitorTableId || 0);

  if (parsedId > 0) {
    return <StrategyDetailView monitorTableId={parsedId} />;
  }

  return <StrategyListView />;
}
