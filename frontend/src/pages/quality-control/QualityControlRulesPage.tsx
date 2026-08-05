import { DeleteOutlined, PlusOutlined, ReloadOutlined, RobotOutlined, SearchOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { StatusTag } from "../../components/ui/StatusTag";
import {
  analyzeQualityRegexRule,
  analyzeQualityDictionaryTable,
  batchDeleteQualityDictionaries,
  batchSaveQualityDictionaries,
  deleteQualityDictionary,
  deleteQualityRegexRule,
  fetchQualityDictionaries,
  fetchQualityDictionaryBusinessSystems,
  fetchQualityDictionaryDetail,
  fetchQualityRegexRules,
  fetchQualitySourceColumns,
  fetchQualitySources,
  fetchQualitySourceTables,
  previewQualityDictionary,
  previewQualityDictionarySource,
  saveQualityDictionary,
  saveQualityRegexRule,
} from "../../services/qualityControl";
import type { DataSourceColumn, DataSourceTable, QualityDictionaryItemRecord, QualityDictionaryRecord, QualityMonitorSourceRecord, QualityRegexRuleRecord } from "../../types/api";
import type { QualityDictionaryAnalysisCandidate, QualityDictionaryAnalysisFieldMapping, QualityDictionaryAnalysisResult, QualityDictionaryBusinessSystem } from "../../services/qualityControl";

function splitLines(value?: string) {
  return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function joinLines(values?: string[]) {
  return Array.isArray(values) ? values.join("\n") : "";
}

function renderEllipsis(value?: string | null, fallback = "-") {
  const text = String(value || "").trim() || fallback;
  return <Typography.Text ellipsis={{ tooltip: text }}>{text}</Typography.Text>;
}

type DictionaryItemFormRecord = {
  sortOrder?: number;
  itemValue?: string;
  itemLabel?: string;
  itemCode?: string;
};

const filterOperatorOptions = [
  { label: "等于", value: "eq" },
  { label: "不等于", value: "ne" },
  { label: "属于", value: "in" },
  { label: "不属于", value: "not_in" },
  { label: "包含", value: "contains" },
  { label: "开头是", value: "starts_with" },
  { label: "大于", value: "gt" },
  { label: "大于等于", value: "gte" },
  { label: "小于", value: "lt" },
  { label: "小于等于", value: "lte" },
  { label: "为空", value: "is_null" },
  { label: "不为空", value: "is_not_null" },
];

export function QualityControlRulesPage() {
  const { message } = App.useApp();
  const { token } = useAuth();
  const [regexForm] = Form.useForm();
  const [dictionaryForm] = Form.useForm();
  const [sourcePreviewForm] = Form.useForm();
  const [dictionaryAnalysisForm] = Form.useForm();
  const registrationMode = Form.useWatch("registrationMode", dictionaryForm) || "manual";
  const selectedSourceId = Form.useWatch("sourceId", dictionaryForm);
  const selectedSourceTable = Form.useWatch("sourceTable", dictionaryForm);
  const sourcePreviewFilters = Form.useWatch("filterConfig", sourcePreviewForm) || [];
  const analysisSourceId = Form.useWatch("sourceId", dictionaryAnalysisForm);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [sourceTablesLoading, setSourceTablesLoading] = useState(false);
  const [sourceColumnsLoading, setSourceColumnsLoading] = useState(false);
  const [sourcePreviewLoading, setSourcePreviewLoading] = useState(false);
  const [dictionaryAnalyzing, setDictionaryAnalyzing] = useState(false);
  const [regexAnalyzing, setRegexAnalyzing] = useState(false);
  const [dictionaryBatchSaving, setDictionaryBatchSaving] = useState(false);
  const [dictionaryBatchDeleting, setDictionaryBatchDeleting] = useState(false);
  const [regexRules, setRegexRules] = useState<QualityRegexRuleRecord[]>([]);
  const [dictionaries, setDictionaries] = useState<QualityDictionaryRecord[]>([]);
  const [businessSystems, setBusinessSystems] = useState<QualityDictionaryBusinessSystem[]>([]);
  const [qualitySources, setQualitySources] = useState<QualityMonitorSourceRecord[]>([]);
  const [sourceTables, setSourceTables] = useState<DataSourceTable[]>([]);
  const [sourceColumns, setSourceColumns] = useState<DataSourceColumn[]>([]);
  const [previewItems, setPreviewItems] = useState<QualityDictionaryItemRecord[]>([]);
  const [sourcePreviewRows, setSourcePreviewRows] = useState<Array<Record<string, unknown>>>([]);
  const [sourcePreviewColumns, setSourcePreviewColumns] = useState<DataSourceColumn[]>([]);
  const [analysisSourceTables, setAnalysisSourceTables] = useState<DataSourceTable[]>([]);
  const [analysisSourceTablesLoading, setAnalysisSourceTablesLoading] = useState(false);
  const [dictionaryAnalysisResult, setDictionaryAnalysisResult] = useState<QualityDictionaryAnalysisResult | null>(null);
  const [dictionaryAnalysisCandidates, setDictionaryAnalysisCandidates] = useState<QualityDictionaryAnalysisCandidate[]>([]);
  const [selectedAnalysisCandidates, setSelectedAnalysisCandidates] = useState<string[]>([]);
  const [selectedDictionaryIds, setSelectedDictionaryIds] = useState<number[]>([]);
  const [regexModalOpen, setRegexModalOpen] = useState(false);
  const [dictionaryModalOpen, setDictionaryModalOpen] = useState(false);
  const [sourcePreviewOpen, setSourcePreviewOpen] = useState(false);
  const [dictionaryAnalysisOpen, setDictionaryAnalysisOpen] = useState(false);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const [regexResponse, dictionaryResponse, systemResponse, sourceResponse] = await Promise.all([
        fetchQualityRegexRules(token),
        fetchQualityDictionaries(token),
        fetchQualityDictionaryBusinessSystems(token),
        fetchQualitySources(token, { includeTableStats: false }),
      ]);
      setRegexRules(regexResponse.data);
      setDictionaries(dictionaryResponse.data);
      const dictionaryIds = new Set(dictionaryResponse.data.map((item) => item.id));
      setSelectedDictionaryIds((current) => current.filter((id) => dictionaryIds.has(id)));
      setBusinessSystems(systemResponse.data);
      setQualitySources(sourceResponse.data);
    } catch (error: any) {
      message.error(error.message || "加载规则配置失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, [token]);

  useEffect(() => {
    if (!token || !dictionaryModalOpen || registrationMode !== "table" || !selectedSourceId) {
      setSourceTables([]);
      setSourceTablesLoading(false);
      return;
    }
    let active = true;
    setSourceTablesLoading(true);
    void fetchQualitySourceTables(token, Number(selectedSourceId))
      .then((response) => {
        if (active) setSourceTables(response.data || []);
      })
      .catch((error) => {
        if (active) message.error(error.message || "加载数据表失败");
      })
      .finally(() => {
        if (active) setSourceTablesLoading(false);
      });
    return () => { active = false; };
  }, [token, dictionaryModalOpen, registrationMode, selectedSourceId]);

  useEffect(() => {
    if (!token || !dictionaryModalOpen || registrationMode !== "table" || !selectedSourceId || !selectedSourceTable) {
      setSourceColumns([]);
      setSourceColumnsLoading(false);
      return;
    }
    let active = true;
    setSourceColumnsLoading(true);
    void fetchQualitySourceColumns(token, Number(selectedSourceId), String(selectedSourceTable))
      .then((response) => {
        if (active) setSourceColumns(response.data || []);
      })
      .catch((error) => {
        if (active) message.error(error.message || "加载字段失败");
      })
      .finally(() => {
        if (active) setSourceColumnsLoading(false);
      });
    return () => { active = false; };
  }, [token, dictionaryModalOpen, registrationMode, selectedSourceId, selectedSourceTable]);

  useEffect(() => {
    if (!token || !dictionaryAnalysisOpen || !analysisSourceId) {
      setAnalysisSourceTables([]);
      setAnalysisSourceTablesLoading(false);
      return;
    }
    let active = true;
    setAnalysisSourceTablesLoading(true);
    void fetchQualitySourceTables(token, Number(analysisSourceId))
      .then((response) => {
        if (active) setAnalysisSourceTables(response.data || []);
      })
      .catch((error) => {
        if (active) message.error(error.message || "加载字典来源表失败");
      })
      .finally(() => {
        if (active) setAnalysisSourceTablesLoading(false);
      });
    return () => { active = false; };
  }, [token, dictionaryAnalysisOpen, analysisSourceId]);

  const sourceOptions = useMemo(() => qualitySources.map((item) => ({ value: item.sourceId, label: `${item.sourceName} / ${item.sourceCode}` })), [qualitySources]);
  const systemOptions = useMemo(() => businessSystems.map((item) => ({ value: item.id, label: `${item.systemName} / ${item.systemCode}` })), [businessSystems]);
  const tableOptions = useMemo(() => sourceTables.map((item) => ({ value: item.tableName, label: item.tableComment ? `${item.tableName} / ${item.tableComment}` : item.tableName })), [sourceTables]);
  const columnOptions = useMemo(() => sourceColumns.map((item) => ({ value: item.columnName, label: item.columnComment ? `${item.columnName} / ${item.columnComment}` : item.columnName })), [sourceColumns]);
  const analysisTableOptions = useMemo(() => analysisSourceTables.map((item) => ({ value: item.tableName, label: item.tableComment ? `${item.tableName} / ${item.tableComment}` : item.tableName })), [analysisSourceTables]);
  const analysisColumnOptions = useMemo(() => (dictionaryAnalysisResult?.columns || []).map((item) => ({ value: item.columnName, label: item.columnComment ? `${item.columnName} / ${item.columnComment}` : item.columnName })), [dictionaryAnalysisResult]);
  const sourcePreviewTableColumns = useMemo<ColumnsType<Record<string, unknown>>>(() => sourcePreviewColumns.map((item) => ({
    title: item.columnComment ? `${item.columnName} / ${item.columnComment}` : item.columnName,
    dataIndex: item.columnName,
    key: item.columnName,
    width: 200,
    ellipsis: true,
    render: renderSourcePreviewValue,
  })), [sourcePreviewColumns]);

  function openRegexModal(record?: QualityRegexRuleRecord) {
    regexForm.resetFields();
    regexForm.setFieldsValue(record ? {
      ...record,
      matchExamplesText: joinLines(record.matchExamples),
      mismatchExamplesText: joinLines(record.mismatchExamples),
    } : { ruleScene: "compliance", severity: "medium", status: "active", isBuiltin: false });
    setRegexModalOpen(true);
  }

  async function openDictionaryModal(record?: QualityDictionaryRecord) {
    dictionaryForm.resetFields();
    setPreviewItems([]);
    setSourceTables([]);
    setSourceColumns([]);
    if (record && token) {
      const response = await fetchQualityDictionaryDetail(token, record.id);
      const detail = response.data;
      dictionaryForm.setFieldsValue({
        ...detail,
        registrationMode: detail.registrationMode || "manual",
        codeField: detail.codeField || detail.valueField || undefined,
        valueField: detail.codeField || detail.valueField || undefined,
        labelField: detail.labelField || detail.codeField || detail.valueField || undefined,
        filterConfig: detail.filterConfig || [],
        items: detail.items?.length ? detail.items.map((item) => ({
          sortOrder: item.sortOrder,
          itemCode: item.itemCode,
          itemValue: item.itemValue || item.itemCode,
          itemLabel: item.itemLabel,
        })) : [{ sortOrder: 1 }],
      });
      setPreviewItems(detail.items || []);
    } else {
      dictionaryForm.setFieldsValue({
        registrationMode: "table",
        status: "active",
        filterConfig: [],
        items: [{ sortOrder: 1 }],
      });
    }
    setDictionaryModalOpen(true);
  }

  function openDictionaryAnalysisModal() {
    dictionaryAnalysisForm.resetFields();
    setDictionaryAnalysisResult(null);
    setDictionaryAnalysisCandidates([]);
    setSelectedAnalysisCandidates([]);
    setDictionaryAnalysisOpen(true);
    window.requestAnimationFrame(() => dictionaryAnalysisForm.setFieldsValue({
      sourceSystemId: businessSystems[0]?.id,
      sourceId: qualitySources[0]?.sourceId,
      sampleSize: 100,
      sampleMode: "random",
    }));
  }

  function applyDictionaryAnalysisResult(result: QualityDictionaryAnalysisResult) {
    setDictionaryAnalysisResult(result);
    setDictionaryAnalysisCandidates(result.candidates || []);
    setSelectedAnalysisCandidates((result.candidates || []).map((item) => item.key));
  }

  async function handleAnalyzeDictionaryTable(fieldMapping?: QualityDictionaryAnalysisFieldMapping) {
    if (!token) return;
    try {
      const values = fieldMapping && dictionaryAnalysisResult
        ? {
          sourceSystemId: dictionaryAnalysisResult.sourceSystem.id,
          sourceId: dictionaryAnalysisResult.source.id,
          sourceTable: dictionaryAnalysisResult.sourceTable,
          sampleSize: dictionaryAnalysisResult.sampleSize,
          sampleMode: dictionaryAnalysisResult.sampleMode,
        }
        : await dictionaryAnalysisForm.validateFields();
      setDictionaryAnalyzing(true);
      const response = await analyzeQualityDictionaryTable(token, {
        sourceSystemId: Number(values.sourceSystemId),
        sourceId: Number(values.sourceId),
        sourceTable: values.sourceTable,
        sampleSize: Number(values.sampleSize || 100),
        sampleMode: values.sampleMode || "random",
        fieldMapping,
      });
      applyDictionaryAnalysisResult(response.data);
      message.success(fieldMapping ? "已按当前字段映射重新拆分" : "字典表解析完成，请审核拆分结果");
    } catch (error: any) {
      if (!error?.errorFields) message.error(error.message || "字典表解析失败");
    } finally {
      setDictionaryAnalyzing(false);
    }
  }

  function updateAnalysisFieldMapping(patch: Partial<QualityDictionaryAnalysisFieldMapping>) {
    setDictionaryAnalysisResult((current) => current ? {
      ...current,
      fieldMapping: { ...current.fieldMapping, ...patch },
    } : current);
  }

  function updateAnalysisCandidate(key: string, patch: Partial<QualityDictionaryAnalysisCandidate>) {
    setDictionaryAnalysisCandidates((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  async function handleBatchSaveAnalyzedDictionaries() {
    if (!token || !dictionaryAnalysisResult) return;
    const selected = dictionaryAnalysisCandidates.filter((item) => selectedAnalysisCandidates.includes(item.key));
    if (!selected.length) {
      message.warning("请至少选择一个待创建字典");
      return;
    }
    if (selected.some((item) => !String(item.dictName || "").trim() || !String(item.dictCode || "").trim())) {
      message.warning("请补充所选字典的名称和编码");
      return;
    }
    setDictionaryBatchSaving(true);
    try {
      const mapping = dictionaryAnalysisResult.fieldMapping;
      const response = await batchSaveQualityDictionaries(token, selected.map((candidate) => ({
        dictCode: candidate.dictCode,
        dictName: candidate.dictName,
        dictCategory: "business_dictionary",
        valueType: "string",
        dictDesc: candidate.dictDesc || "",
        registrationMode: "table",
        sourceSystemId: dictionaryAnalysisResult.sourceSystem.id,
        sourceId: dictionaryAnalysisResult.source.id,
        sourceTable: dictionaryAnalysisResult.sourceTable,
        codeField: mapping.itemCodeField,
        valueField: mapping.itemValueField,
        labelField: mapping.itemLabelField,
        filterConfig: candidate.filterConfig,
        status: "active",
        items: candidate.items,
      })));
      message.success(`已创建 ${response.data.length} 个业务字典`);
      setDictionaryAnalysisOpen(false);
      setDictionaryAnalysisResult(null);
      await loadData();
    } catch (error: any) {
      message.error(error.message || "批量创建业务字典失败");
    } finally {
      setDictionaryBatchSaving(false);
    }
  }

  async function handleSaveRegex() {
    if (!token) return;
    try {
      const values = await regexForm.validateFields();
      setSubmitting(true);
      await saveQualityRegexRule(token, {
        ...values,
        matchExamples: splitLines(values.matchExamplesText),
        mismatchExamples: splitLines(values.mismatchExamplesText),
      });
      message.success("规则已保存");
      setRegexModalOpen(false);
      await loadData();
    } catch (error: any) {
      if (!error?.errorFields) message.error(error.message || "保存规则失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAnalyzeRegexRule() {
    if (!token) return;
    try {
      const values = await regexForm.validateFields(["ruleName"]);
      setRegexAnalyzing(true);
      const response = await analyzeQualityRegexRule(token, {
        ruleName: values.ruleName,
        ruleScene: regexForm.getFieldValue("ruleScene") || "compliance",
        currentRuleCode: regexForm.getFieldValue("ruleCode") || "",
      });
      const result = response.data;
      regexForm.setFieldsValue({
        ruleCode: result.ruleCode,
        regexPattern: result.regexPattern,
        matchExamplesText: joinLines(result.matchExamples),
        mismatchExamplesText: joinLines(result.mismatchExamples),
        severity: result.severity,
      });
      message.success(`${result.modelName || "模型"} 已完成规则解析，请审核后保存`);
    } catch (error: any) {
      if (!error?.errorFields) message.error(error.message || "规则智能解析失败");
    } finally {
      setRegexAnalyzing(false);
    }
  }

  function normalizeFilters(filters: any[] = []) {
    return filters.map((filter) => ({
      field: filter.field,
      operator: filter.operator,
      value: ["in", "not_in"].includes(filter.operator)
        ? String(filter.value || "").split(",").map((item) => item.trim()).filter(Boolean)
        : filter.value,
    }));
  }

  async function querySourcePreview() {
    if (!token) return;
    try {
      const sourceValues = await dictionaryForm.validateFields(["sourceId", "sourceTable"]);
      const previewValues = await sourcePreviewForm.validateFields();
      const filters = previewValues.filterConfig || [];
      setSourcePreviewLoading(true);
      const response = await previewQualityDictionarySource(token, {
        sourceId: Number(sourceValues.sourceId),
        sourceTable: sourceValues.sourceTable,
        filterConfig: normalizeFilters(filters),
        limit: 50,
      });
      setSourcePreviewColumns(response.data.columns || []);
      setSourcePreviewRows((response.data.rows || []).map((row, index) => ({ ...row, __previewRowKey: String(index) })));
      dictionaryForm.setFieldValue("filterConfig", filters);
    } catch (error: any) {
      if (!error?.errorFields) message.error(error.message || "预览来源表失败");
    } finally {
      setSourcePreviewLoading(false);
    }
  }

  function openSourcePreview() {
    if (!selectedSourceId || !selectedSourceTable) {
      message.warning("请先选择数据源和来源表");
      return;
    }
    sourcePreviewForm.setFieldsValue({ filterConfig: dictionaryForm.getFieldValue("filterConfig") || [] });
    setSourcePreviewRows([]);
    setSourcePreviewColumns(sourceColumns);
    setSourcePreviewOpen(true);
    window.requestAnimationFrame(() => void querySourcePreview());
  }

  function renderSourcePreviewValue(value: unknown) {
    const text = value === null || value === undefined || value === ""
      ? "-"
      : typeof value === "object" ? JSON.stringify(value) : String(value);
    return <Typography.Text ellipsis={{ tooltip: text }}>{text}</Typography.Text>;
  }

  async function handlePreviewDictionary() {
    if (!token) return;
    try {
      const values = await dictionaryForm.validateFields(["sourceId", "sourceTable", "codeField", "labelField", "filterConfig"]);
      setPreviewing(true);
      const response = await previewQualityDictionary(token, {
        sourceId: Number(values.sourceId),
        sourceTable: values.sourceTable,
        codeField: values.codeField,
        valueField: values.codeField,
        labelField: values.labelField || values.codeField,
        filterConfig: normalizeFilters(values.filterConfig),
        limit: 1000,
      });
      setPreviewItems(response.data.items || []);
      dictionaryForm.setFieldValue("items", response.data.items || []);
      message.success(`已返回 ${response.data.itemCount} 个字典值`);
    } catch (error: any) {
      if (!error?.errorFields) message.error(error.message || "预览字典值失败");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSaveDictionary() {
    if (!token) return;
    try {
      const values = await dictionaryForm.validateFields();
      const items = (values.items || []).map((item: DictionaryItemFormRecord, index: number) => {
        const itemValue = String(item.itemValue || "").trim();
        return {
          itemCode: String(item.itemCode || itemValue).trim() || itemValue,
          itemValue,
          itemLabel: String(item.itemLabel || itemValue).trim() || itemValue,
          sortOrder: Number(item.sortOrder ?? index + 1),
          status: "active" as const,
        };
      }).filter((item: QualityDictionaryItemRecord) => item.itemValue);
      setSubmitting(true);
      await saveQualityDictionary(token, {
        id: values.id,
        dictCode: values.dictCode,
        dictName: values.dictName,
        dictCategory: "business_dictionary",
        valueType: "string",
        dictDesc: values.dictDesc || "",
        registrationMode: values.registrationMode,
        sourceSystemId: values.sourceSystemId || null,
        sourceId: values.registrationMode === "table" ? Number(values.sourceId) : null,
        sourceTable: values.registrationMode === "table" ? values.sourceTable : "",
        codeField: values.registrationMode === "table" ? values.codeField : "",
        valueField: values.registrationMode === "table" ? values.codeField : "",
        labelField: values.registrationMode === "table" ? (values.labelField || values.codeField) : "",
        filterConfig: values.registrationMode === "table" ? normalizeFilters(values.filterConfig) : [],
        status: values.status || "active",
        items,
      });
      message.success("业务字典表已保存");
      setDictionaryModalOpen(false);
      await loadData();
    } catch (error: any) {
      if (!error?.errorFields) message.error(error.message || "保存业务字典表失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteRegex(id: number) {
    if (!token) return;
    await deleteQualityRegexRule(token, id);
    message.success("规则已删除");
    await loadData();
  }

  async function handleDeleteDictionary(id: number) {
    if (!token) return;
    await deleteQualityDictionary(token, id);
    message.success("业务字典表已删除");
    await loadData();
  }

  async function handleBatchDeleteDictionaries() {
    if (!token || selectedDictionaryIds.length === 0) return;
    setDictionaryBatchDeleting(true);
    try {
      const response = await batchDeleteQualityDictionaries(token, selectedDictionaryIds);
      message.success(`已删除 ${response.data.deletedCount} 个业务字典表`);
      setSelectedDictionaryIds([]);
      await loadData();
    } catch (error: any) {
      message.error(error.message || "批量删除业务字典表失败");
    } finally {
      setDictionaryBatchDeleting(false);
    }
  }

  const regexColumns: ColumnsType<QualityRegexRuleRecord> = [
    { title: "规则名称", dataIndex: "ruleName", width: 220, render: (value) => renderEllipsis(value) },
    { title: "规则编码", dataIndex: "ruleCode", width: 180 },
    { title: "场景", dataIndex: "ruleScene", width: 120 },
    { title: "正则表达式", dataIndex: "regexPattern", render: (value) => renderEllipsis(value) },
    { title: "严重级别", dataIndex: "severity", width: 110, render: (value) => <StatusTag label={String(value || "-")} tone={value === "high" ? "error" : value === "medium" ? "warning" : "processing"} /> },
    { title: "状态", dataIndex: "status", width: 100, render: (value) => <StatusTag status={value} /> },
    { title: "操作", width: 160, render: (_value, record) => <Space size={4}><Button type="link" onClick={() => openRegexModal(record)}>编辑</Button><Popconfirm title="确认删除该规则？" onConfirm={() => void handleDeleteRegex(record.id)}><Button type="link" danger>删除</Button></Popconfirm></Space> },
  ];

  const dictionaryColumns: ColumnsType<QualityDictionaryRecord> = [
    { title: "字典表名称", dataIndex: "dictName", width: 220, render: (value) => renderEllipsis(value) },
    { title: "字典编码", dataIndex: "dictCode", width: 170 },
    { title: "来源系统", dataIndex: "sourceSystemName", width: 190, render: (value, record) => renderEllipsis(value ? `${value} / ${record.sourceSystemCode || "-"}` : "-") },
    { title: "注册来源", width: 260, render: (_value, record) => record.registrationMode === "table" ? renderEllipsis(`${record.sourceName || "-"} / ${record.sourceTable || "-"}`) : "手工维护" },
    { title: "编码字段", dataIndex: "codeField", width: 140, render: (value) => value || "-" },
    { title: "字典项数", dataIndex: "itemCount", width: 100, render: (value) => Number(value || 0) },
    { title: "状态", dataIndex: "status", width: 90, render: (value) => <StatusTag status={value} /> },
    { title: "操作", width: 160, render: (_value, record) => <Space size={4}><Button type="link" onClick={() => void openDictionaryModal(record)}>编辑</Button><Popconfirm title="确认删除该业务字典表？" onConfirm={() => void handleDeleteDictionary(record.id)}><Button type="link" danger>删除</Button></Popconfirm></Space> },
  ];

  const previewColumns: ColumnsType<QualityDictionaryItemRecord> = [
    { title: "字典编码", dataIndex: "itemCode", width: 180 },
    { title: "显示名称", dataIndex: "itemLabel" },
  ];

  return (
    <div className="app-page">
      <PageToolbar right={<Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>刷新</Button>} />
      <div className="app-page-body">
        <Tabs items={[
          { key: "regex", label: "合规规则", children: <DataTableCard title="合规规则列表" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openRegexModal()}>新建规则</Button>} tableProps={{ rowKey: "id", loading, size: "small", columns: regexColumns, dataSource: regexRules, pagination: { pageSize: 10, showSizeChanger: false }, scroll: { x: 1300 } }} /> },
          { key: "dictionary", label: "业务字典表", children: <DataTableCard title="业务字典表列表" extra={<Space><Popconfirm title={`确认删除选中的 ${selectedDictionaryIds.length} 个业务字典表？`} description="删除后将不再参与质量规则配置。" okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={() => void handleBatchDeleteDictionaries()} disabled={selectedDictionaryIds.length === 0}><Button danger icon={<DeleteOutlined />} loading={dictionaryBatchDeleting} disabled={selectedDictionaryIds.length === 0}>批量删除{selectedDictionaryIds.length > 0 ? `（${selectedDictionaryIds.length}）` : ""}</Button></Popconfirm><Button icon={<RobotOutlined />} onClick={openDictionaryAnalysisModal}>AI解析字典表</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => void openDictionaryModal()}>注册字典表</Button></Space>} tableProps={{ rowKey: "id", loading, size: "small", columns: dictionaryColumns, dataSource: dictionaries, rowSelection: { selectedRowKeys: selectedDictionaryIds, preserveSelectedRowKeys: true, onChange: (keys) => setSelectedDictionaryIds(keys.map(Number)) }, pagination: { pageSize: 10, showSizeChanger: false }, scroll: { x: 1400 } }} /> },
        ]} />
      </div>

      <Modal open={regexModalOpen} title="合规规则维护" onCancel={() => setRegexModalOpen(false)} onOk={() => void handleSaveRegex()} confirmLoading={submitting} width={920} forceRender destroyOnHidden>
        <Form form={regexForm} layout="vertical">
          <Form.Item name="id" hidden><Input /></Form.Item>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="输入规则名称后，可由模型推荐规则编码、正则表达式、匹配样例和严重级别。"
            action={<Button icon={<RobotOutlined />} loading={regexAnalyzing} onClick={() => void handleAnalyzeRegexRule()}>智能解析</Button>}
          />
          <Row gutter={16}>
            <Col span={8}><Form.Item name="ruleCode" label="规则编码" rules={[{ required: true, message: "请输入规则编码" }, { pattern: /^[a-z0-9_]+$/, message: "仅支持小写字母、数字和下划线" }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="ruleName" label="规则名称" rules={[{ required: true, message: "请输入规则名称" }]}><Input /></Form.Item></Col>
            <Col span={4}><Form.Item name="ruleScene" label="场景"><Select options={[{ label: "合规", value: "compliance" }, { label: "通用", value: "general" }]} /></Form.Item></Col>
            <Col span={4}><Form.Item name="severity" label="严重级别"><Select options={[{ label: "低", value: "low" }, { label: "中", value: "medium" }, { label: "高", value: "high" }]} /></Form.Item></Col>
          </Row>
          <Row gutter={16}><Col span={20}><Form.Item name="regexPattern" label="正则表达式" rules={[{ required: true, message: "请输入正则表达式" }]}><Input /></Form.Item></Col><Col span={4}><Form.Item name="status" label="状态"><Select options={[{ label: "启用", value: "active" }, { label: "停用", value: "inactive" }]} /></Form.Item></Col></Row>
          <Row gutter={16}><Col span={12}><Form.Item name="matchExamplesText" label="匹配样例"><Input.TextArea rows={4} placeholder="每行一个样例" /></Form.Item></Col><Col span={12}><Form.Item name="mismatchExamplesText" label="不匹配样例"><Input.TextArea rows={4} placeholder="每行一个样例" /></Form.Item></Col></Row>
        </Form>
      </Modal>

      <Modal
        open={dictionaryAnalysisOpen}
        title="AI解析字典表"
        width={dictionaryAnalysisResult ? 1440 : 920}
        styles={{ body: { maxHeight: "calc(100vh - 180px)", overflowY: "auto" } }}
        onCancel={() => setDictionaryAnalysisOpen(false)}
        destroyOnHidden
        footer={dictionaryAnalysisResult ? [
          <Button key="back" onClick={() => { setDictionaryAnalysisResult(null); setDictionaryAnalysisCandidates([]); setSelectedAnalysisCandidates([]); }}>返回修改来源</Button>,
          <Button key="cancel" onClick={() => setDictionaryAnalysisOpen(false)}>取消</Button>,
          <Button key="create" type="primary" loading={dictionaryBatchSaving} onClick={() => void handleBatchSaveAnalyzedDictionaries()}>一键创建所选字典</Button>,
        ] : [
          <Button key="cancel" onClick={() => setDictionaryAnalysisOpen(false)}>取消</Button>,
          <Button key="analyze" type="primary" icon={<RobotOutlined />} loading={dictionaryAnalyzing} onClick={() => void handleAnalyzeDictionaryTable()}>开始解析</Button>,
        ]}
      >
        {!dictionaryAnalysisResult ? (
          <>
            <Alert type="info" showIcon style={{ marginBottom: 16 }} message="请选择一张明确的字典来源表。系统将识别单一或联合字典结构，并按真实数据拆分为待审核字典清单。" />
            <Form form={dictionaryAnalysisForm} layout="vertical">
              <Row gutter={16}>
                <Col span={12}><Form.Item name="sourceSystemId" label="来源系统" rules={[{ required: true, message: "请选择来源系统" }]}><Select showSearch optionFilterProp="label" options={systemOptions} /></Form.Item></Col>
                <Col span={12}><Form.Item name="sourceId" label="数据源" rules={[{ required: true, message: "请选择数据源" }]}><Select showSearch optionFilterProp="label" options={sourceOptions} onChange={() => dictionaryAnalysisForm.setFieldValue("sourceTable", undefined)} /></Form.Item></Col>
              </Row>
              <Form.Item name="sourceTable" label="字典来源表" rules={[{ required: true, message: "请选择字典来源表" }]}>
                <Select disabled={!analysisSourceId} loading={analysisSourceTablesLoading} showSearch optionFilterProp="label" options={analysisTableOptions} placeholder={analysisSourceId ? "选择需要解析的字典表" : "请先选择数据源"} />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="sampleSize" label="分析条数" rules={[{ required: true, message: "请输入分析条数" }]}><InputNumber min={10} max={500} style={{ width: "100%" }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="sampleMode" label="取样方式" rules={[{ required: true }]}><Select options={[{ label: "随机抽样", value: "random" }, { label: "表头顺序", value: "head" }]} /></Form.Item></Col>
              </Row>
            </Form>
          </>
        ) : (
          <Space direction="vertical" size={16} style={{ display: "flex" }}>
            <Alert
              type="success"
              showIcon
              message={`${dictionaryAnalysisResult.modelUsed ? `模型 ${dictionaryAnalysisResult.modelName || "已配置模型"} 已完成识别` : "已按人工字段映射重新拆分"}，共生成 ${dictionaryAnalysisCandidates.length} 个待审核字典`}
              description={dictionaryAnalysisResult.fieldMapping.reason || `已分析 ${dictionaryAnalysisResult.sampleSize} 条数据。字段映射可以人工调整后重新拆分。`}
            />
            <Space wrap>
              <Tag color="blue">{dictionaryAnalysisResult.fieldMapping.tableMode === "combined" ? "联合字典表" : "单一字典表"}</Tag>
              <Tag>{dictionaryAnalysisResult.source.sourceName}</Tag>
              <Tag>{dictionaryAnalysisResult.sourceTable}</Tag>
              <Tag>取样 {dictionaryAnalysisResult.sampleSize} 条</Tag>
            </Space>
            <Typography.Title level={5} style={{ margin: 0 }}>字段识别结果</Typography.Title>
            <Row gutter={12}>
              <Col span={4}><Typography.Text type="secondary">表结构类型</Typography.Text><Select style={{ width: "100%", marginTop: 6 }} value={dictionaryAnalysisResult.fieldMapping.tableMode} options={[{ label: "单一字典表", value: "single" }, { label: "联合字典表", value: "combined" }]} onChange={(value) => updateAnalysisFieldMapping({ tableMode: value })} /></Col>
              <Col span={4}><Typography.Text type="secondary">字典类型字段</Typography.Text><Select allowClear disabled={dictionaryAnalysisResult.fieldMapping.tableMode === "single"} style={{ width: "100%", marginTop: 6 }} value={dictionaryAnalysisResult.fieldMapping.dictionaryTypeField || undefined} options={analysisColumnOptions} onChange={(value) => updateAnalysisFieldMapping({ dictionaryTypeField: value || "" })} /></Col>
              <Col span={4}><Typography.Text type="secondary">字典名称字段</Typography.Text><Select allowClear disabled={dictionaryAnalysisResult.fieldMapping.tableMode === "single"} style={{ width: "100%", marginTop: 6 }} value={dictionaryAnalysisResult.fieldMapping.dictionaryNameField || undefined} options={analysisColumnOptions} onChange={(value) => updateAnalysisFieldMapping({ dictionaryNameField: value || "" })} /></Col>
              <Col span={4}><Typography.Text type="secondary">字典项编码字段</Typography.Text><Select style={{ width: "100%", marginTop: 6 }} value={dictionaryAnalysisResult.fieldMapping.itemCodeField} options={analysisColumnOptions} onChange={(value) => updateAnalysisFieldMapping({ itemCodeField: value })} /></Col>
              <Col span={4}><Typography.Text type="secondary">字典项值字段</Typography.Text><Select style={{ width: "100%", marginTop: 6 }} value={dictionaryAnalysisResult.fieldMapping.itemValueField} options={analysisColumnOptions} onChange={(value) => updateAnalysisFieldMapping({ itemValueField: value })} /></Col>
              <Col span={4}><Typography.Text type="secondary">显示名称字段</Typography.Text><Select style={{ width: "100%", marginTop: 6 }} value={dictionaryAnalysisResult.fieldMapping.itemLabelField} options={analysisColumnOptions} onChange={(value) => updateAnalysisFieldMapping({ itemLabelField: value })} /></Col>
            </Row>
            <div><Button icon={<ReloadOutlined />} loading={dictionaryAnalyzing} onClick={() => void handleAnalyzeDictionaryTable(dictionaryAnalysisResult.fieldMapping)}>按当前字段重新拆分</Button></div>
            <Typography.Title level={5} style={{ margin: 0 }}>拆分字典清单</Typography.Title>
            <Space>
              <Typography.Text type="secondary">已选择 {selectedAnalysisCandidates.length} / {dictionaryAnalysisCandidates.length} 个字典</Typography.Text>
              <Button size="small" onClick={() => setSelectedAnalysisCandidates(dictionaryAnalysisCandidates.map((item) => item.key))}>全选全部</Button>
              <Button size="small" onClick={() => setSelectedAnalysisCandidates([])}>清空全部</Button>
            </Space>
            <Table<QualityDictionaryAnalysisCandidate>
              rowKey="key"
              size="small"
              pagination={{ pageSize: 8, showSizeChanger: false }}
              rowSelection={{ selectedRowKeys: selectedAnalysisCandidates, onChange: (keys) => setSelectedAnalysisCandidates(keys.map(String)) }}
              columns={[
                { title: "字典名称", width: 220, render: (_value, record) => <Input value={record.dictName} onChange={(event) => updateAnalysisCandidate(record.key, { dictName: event.target.value })} /> },
                { title: "字典编码", width: 220, render: (_value, record) => <Input value={record.dictCode} onChange={(event) => updateAnalysisCandidate(record.key, { dictCode: event.target.value.trim().toLowerCase() })} /> },
                { title: "分组条件", width: 250, render: (_value, record) => record.filterConfig.length ? record.filterConfig.map((filter) => `${filter.field} = ${String(filter.value ?? "")}`).join("；") : "整张表" },
                { title: "字典项数", dataIndex: "itemCount", width: 100 },
                { title: "业务说明", render: (_value, record) => <Input value={record.dictDesc} onChange={(event) => updateAnalysisCandidate(record.key, { dictDesc: event.target.value })} /> },
              ]}
              dataSource={dictionaryAnalysisCandidates}
              expandable={{
                expandedRowRender: (record) => <Table<QualityDictionaryItemRecord>
                  rowKey={(item) => `${record.key}:${item.itemCode}:${item.itemValue}`}
                  size="small"
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  columns={previewColumns}
                  dataSource={record.items}
                />,
              }}
            />
          </Space>
        )}
      </Modal>

      <Modal open={dictionaryModalOpen} title="业务字典表注册" onCancel={() => { setSourcePreviewOpen(false); setDictionaryModalOpen(false); }} onOk={() => void handleSaveDictionary()} confirmLoading={submitting} width={1180} destroyOnHidden>
        <Form form={dictionaryForm} layout="vertical">
          <Form.Item name="id" hidden><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={7}><Form.Item name="dictName" label="字典表名称" rules={[{ required: true, message: "请输入字典表名称" }]}><Input placeholder="例如：办理状态字典" /></Form.Item></Col>
            <Col span={5}><Form.Item name="dictCode" label="字典编码" rules={[{ required: true, message: "请输入字典编码" }, { pattern: /^[a-z0-9_]+$/, message: "仅支持小写字母、数字和下划线" }]}><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="sourceSystemId" label="来源系统" rules={[{ required: true, message: "请选择来源系统" }]}><Select showSearch optionFilterProp="label" options={systemOptions} placeholder="选择已创建的业务系统" /></Form.Item></Col>
            <Col span={3}><Form.Item name="registrationMode" label="字典来源"><Select options={[{ label: "数据表注册", value: "table" }, { label: "手工维护", value: "manual" }]} /></Form.Item></Col>
            <Col span={3}><Form.Item name="status" label="状态"><Select options={[{ label: "启用", value: "active" }, { label: "停用", value: "inactive" }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="dictDesc" label="业务说明"><Input placeholder="说明字典表的业务含义，便于大模型匹配" /></Form.Item>

          {registrationMode === "table" ? (
            <>
              <Alert type="info" showIcon style={{ marginBottom: 16 }} message="从已定义的数据源表中查询值域，过滤后的结果会注册为字典表快照；策略推荐时会再次查询该来源表样例进行匹配。" />
              <Row gutter={16}>
                <Col span={6}><Form.Item name="sourceId" label="数据源" rules={[{ required: true, message: "请选择数据源" }]}><Select showSearch optionFilterProp="label" options={sourceOptions} onChange={() => { setSourcePreviewRows([]); dictionaryForm.setFieldsValue({ sourceTable: undefined, codeField: undefined, valueField: undefined, labelField: undefined, filterConfig: [] }); }} /></Form.Item></Col>
                <Col span={6}><Form.Item name="sourceTable" label="来源表" rules={[{ required: true, message: "请选择来源表" }]}><Select disabled={!selectedSourceId} loading={sourceTablesLoading} showSearch optionFilterProp="label" options={tableOptions} placeholder={selectedSourceId ? "选择具体数据表" : "请先选择数据源"} onChange={() => { setSourcePreviewRows([]); dictionaryForm.setFieldsValue({ codeField: undefined, valueField: undefined, labelField: undefined, filterConfig: [] }); }} /></Form.Item></Col>
                <Col span={2}><Form.Item label=" " colon={false}><Button block icon={<SearchOutlined />} disabled={!selectedSourceTable} onClick={openSourcePreview}>预览</Button></Form.Item></Col>
                <Col span={5}><Form.Item name="codeField" label="编码字段" rules={[{ required: true, message: "请选择编码字段" }]}><Select disabled={!selectedSourceTable} loading={sourceColumnsLoading} showSearch optionFilterProp="label" options={columnOptions} placeholder="选择字典编码字段" /></Form.Item></Col>
                <Col span={5}><Form.Item name="labelField" label="显示名称字段"><Select allowClear disabled={!selectedSourceTable} loading={sourceColumnsLoading} showSearch optionFilterProp="label" options={columnOptions} placeholder="默认同编码字段" /></Form.Item></Col>
              </Row>
              <Typography.Title level={5}>过滤条件</Typography.Title>
              <Form.List name="filterConfig">
                {(fields, { add, remove }) => <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  {fields.map((field) => {
                    const { key, ...fieldProps } = field;
                    const operator = dictionaryForm.getFieldValue(["filterConfig", field.name, "operator"]);
                    return <Row key={key} gutter={12} align="middle" wrap={false}>
                      <Col flex="300px"><Form.Item {...fieldProps} name={[field.name, "field"]} rules={[{ required: true, message: "请选择字段" }]} style={{ marginBottom: 0 }}><Select placeholder="过滤字段" showSearch optionFilterProp="label" options={columnOptions} /></Form.Item></Col>
                      <Col flex="180px"><Form.Item {...fieldProps} name={[field.name, "operator"]} rules={[{ required: true, message: "请选择条件" }]} style={{ marginBottom: 0 }}><Select placeholder="过滤条件" options={filterOperatorOptions} onChange={() => dictionaryForm.setFieldValue(["filterConfig", field.name, "value"], undefined)} /></Form.Item></Col>
                      <Col flex="auto"><Form.Item {...fieldProps} name={[field.name, "value"]} rules={[{ required: !["is_null", "is_not_null"].includes(operator), message: "请输入条件值" }]} style={{ marginBottom: 0 }}><Input disabled={["is_null", "is_not_null"].includes(operator)} placeholder={["in", "not_in"].includes(operator) ? "多个值使用逗号分隔" : "条件值"} /></Form.Item></Col>
                      <Col flex="48px"><Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} /></Col>
                    </Row>;
                  })}
                  <Space><Button icon={<PlusOutlined />} onClick={() => add({ operator: "eq" })}>增加过滤条件</Button><Button type="primary" icon={<SearchOutlined />} loading={previewing} onClick={() => void handlePreviewDictionary()}>查询并预览值域</Button></Space>
                </Space>}
              </Form.List>
              <Typography.Title level={5} style={{ marginTop: 20 }}>返回值域预览（{previewItems.length}）</Typography.Title>
              <Table rowKey={(record) => `${record.itemCode}:${record.itemValue}`} size="small" columns={previewColumns} dataSource={previewItems} pagination={{ pageSize: 8, showSizeChanger: false }} scroll={{ y: 260 }} />
            </>
          ) : (
            <>
              <Alert type="info" showIcon style={{ marginBottom: 16 }} message="手工维护适用于暂无可查询业务表的少量稳定值域。" />
              <Typography.Title level={5}>字典项</Typography.Title>
              <Form.List name="items">
                {(fields, { add, remove }) => <Space direction="vertical" style={{ width: "100%" }} size={10}>
                  {fields.map((field) => {
                    const { key, ...fieldProps } = field;
                    return <Row key={key} gutter={12} align="middle" wrap={false}>
                      <Col flex="180px"><Form.Item {...fieldProps} name={[field.name, "itemCode"]} label="字典编码" style={{ marginBottom: 0 }}><Input placeholder="默认同字典值" /></Form.Item></Col>
                      <Col flex="240px"><Form.Item {...fieldProps} name={[field.name, "itemValue"]} label="字典值" rules={[{ required: true, message: "请输入字典值" }]} style={{ marginBottom: 0 }}><Input /></Form.Item></Col>
                      <Col flex="auto"><Form.Item {...fieldProps} name={[field.name, "itemLabel"]} label="显示名称" style={{ marginBottom: 0 }}><Input placeholder="默认同字典值" /></Form.Item></Col>
                      <Col flex="100px"><Form.Item {...fieldProps} name={[field.name, "sortOrder"]} label="排序" style={{ marginBottom: 0 }}><InputNumber style={{ width: "100%" }} /></Form.Item></Col>
                      <Col flex="48px"><Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} disabled={fields.length <= 1} style={{ marginTop: 30 }} /></Col>
                    </Row>;
                  })}
                  <Button icon={<PlusOutlined />} onClick={() => add({ sortOrder: fields.length + 1 })}>新增字典项</Button>
                </Space>}
              </Form.List>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        open={sourcePreviewOpen}
        title={`来源表数据预览${selectedSourceTable ? `：${selectedSourceTable}` : ""}`}
        width={1400}
        footer={[
          <Button key="close" onClick={() => setSourcePreviewOpen(false)}>关闭</Button>,
          <Button key="query" type="primary" icon={<SearchOutlined />} loading={sourcePreviewLoading} onClick={() => void querySourcePreview()}>按条件查询</Button>,
        ]}
        onCancel={() => setSourcePreviewOpen(false)}
        destroyOnHidden
      >
        <Form form={sourcePreviewForm} layout="vertical">
          <Typography.Title level={5} style={{ marginTop: 0 }}>条件检索</Typography.Title>
          <Form.List name="filterConfig">
            {(fields, { add, remove }) => <Space direction="vertical" style={{ width: "100%" }} size={8}>
              {fields.map((field) => {
                const { key, ...fieldProps } = field;
                const operator = sourcePreviewFilters[field.name]?.operator;
                return <Row key={key} gutter={12} align="middle" wrap={false}>
                  <Col flex="300px"><Form.Item {...fieldProps} name={[field.name, "field"]} rules={[{ required: true, message: "请选择字段" }]} style={{ marginBottom: 0 }}><Select placeholder="检索字段" showSearch optionFilterProp="label" options={columnOptions} /></Form.Item></Col>
                  <Col flex="180px"><Form.Item {...fieldProps} name={[field.name, "operator"]} rules={[{ required: true, message: "请选择条件" }]} style={{ marginBottom: 0 }}><Select placeholder="检索条件" options={filterOperatorOptions} onChange={() => sourcePreviewForm.setFieldValue(["filterConfig", field.name, "value"], undefined)} /></Form.Item></Col>
                  <Col flex="auto"><Form.Item {...fieldProps} name={[field.name, "value"]} rules={[{ required: !["is_null", "is_not_null"].includes(operator), message: "请输入条件值" }]} style={{ marginBottom: 0 }}><Input disabled={["is_null", "is_not_null"].includes(operator)} placeholder={["in", "not_in"].includes(operator) ? "多个值使用逗号分隔" : "条件值"} /></Form.Item></Col>
                  <Col flex="48px"><Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} /></Col>
                </Row>;
              })}
              <Space>
                <Button icon={<PlusOutlined />} onClick={() => add({ operator: "eq" })}>增加检索条件</Button>
                {fields.length ? <Button onClick={() => sourcePreviewForm.setFieldValue("filterConfig", [])}>清空条件</Button> : null}
              </Space>
            </Space>}
          </Form.List>
        </Form>
        <Typography.Title level={5} style={{ marginTop: 18 }}>全字段预览（返回 {sourcePreviewRows.length} 条）</Typography.Title>
        <Table<Record<string, unknown>>
          rowKey={(record) => String(record.__previewRowKey)}
          size="small"
          loading={sourcePreviewLoading}
          columns={sourcePreviewTableColumns}
          dataSource={sourcePreviewRows}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: Math.max(sourcePreviewTableColumns.length * 200, 1000), y: 420 }}
        />
      </Modal>
    </div>
  );
}
