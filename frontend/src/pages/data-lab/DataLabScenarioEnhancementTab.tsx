import { Button, Card, Descriptions, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Upload, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  deleteScenarioEnhancement,
  exportScenarioEnhancementPackage,
  fetchScenarioEnhancementDetail,
  fetchScenarioEnhancements,
  importScenarioEnhancementPackage,
  previewScenarioRecognition,
  saveScenarioEnhancement,
} from "../../services/dataLab";
import type { LabScenarioEnhancementRecord, LabScenarioRecognitionPreview } from "../../types/api";

type CategoryRow = {
  categoryCode?: string;
  categoryName?: string;
  description?: string;
  tableScopes?: string[];
  tableDetails?: Array<{
    tableName?: string;
    tableLabel?: string;
    tableComment?: string;
    sourceRefs?: string[];
  }>;
  sourceRefs?: string[];
};

type DictionaryItemRow = {
  itemCode?: string;
  itemLabel?: string;
  valueRange?: string;
  sourceRefs?: string[];
};

type DictionaryGroupRow = {
  dictType?: string;
  dictName?: string;
  sourceRefs?: string[];
  items?: DictionaryItemRow[];
};

type EnhancementFormValues = {
  id?: number;
  profileName?: string;
  profileCode?: string;
  industry?: string;
  subScenario?: string;
  profileDesc?: string;
  confidenceThreshold?: number;
  priority?: number;
  categories?: CategoryRow[];
  dictionaryGroups?: DictionaryGroupRow[];
};

type PreviewFormValues = {
  sceneName: string;
  sceneDesc?: string;
  knowledgeText?: string;
};

const INDUSTRY_OPTIONS = [
  { value: "ecommerce", label: "电商零售" },
  { value: "traffic", label: "交通运输" },
  { value: "bank_regulatory", label: "银行监管" },
  { value: "education", label: "教育治理" },
  { value: "finance_fund", label: "基金金融" },
  { value: "logistics_express", label: "物流快递" },
  { value: "crm", label: "客户经营" },
  { value: "marriage", label: "婚登治理" },
  { value: "generic", label: "通用行业" },
];

function safeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeArray<T = Record<string, unknown>>(value: unknown) {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeStringArray(value: unknown) {
  return Array.from(new Set(
    safeArray(value).map((item) => String(item || "").trim()).filter(Boolean)
  ));
}

function buildCompactItemCode(rawCode: unknown, itemLabel: unknown, index: number) {
  const explicit = String(rawCode || "").trim().replace(/[^A-Za-z0-9]/g, "");
  if (explicit) {
    if (/^\d+$/.test(explicit)) {
      return explicit.padStart(2, "0").slice(-2);
    }
    return explicit.toUpperCase().slice(0, 2).padEnd(2, "0");
  }
  const ascii = (String(itemLabel || "").match(/[A-Za-z0-9]+/g) || []).join("").toUpperCase();
  if (ascii) {
    return ascii.slice(0, 2).padEnd(2, "0");
  }
  return String(index + 1).padStart(2, "0").slice(-2);
}

function industryLabel(value?: string | null) {
  return INDUSTRY_OPTIONS.find((item) => item.value === value)?.label || value || "-";
}

function statusTag(value?: string) {
  const mapping: Record<string, { color: string; label: string }> = {
    active: { color: "green", label: "有效" },
    draft: { color: "gold", label: "草稿" },
    inactive: { color: "default", label: "停用" },
  };
  const item = mapping[value || ""] || { color: "default", label: value || "-" };
  return <Tag color={item.color}>{item.label}</Tag>;
}

function buildCategories(record: LabScenarioEnhancementRecord | null | undefined): CategoryRow[] {
  const researchCatalog = safeObject(record?.researchCatalog);
  const modulePlanner = safeObject(record?.modulePlanner);
  const candidateTableSpecs = safeArray(researchCatalog.candidateTableSpecs);
  const tableSpecMap = new Map(
    candidateTableSpecs
      .map((item) => ({
        tableName: String(item.tableName || "").trim(),
        tableLabel: String(item.tableLabel || item.tableNameZh || "").trim() || "",
        tableComment: String(item.tableComment || item.description || "").trim() || "",
        sourceRefs: normalizeStringArray(item.sourceRefs),
      }))
      .filter((item) => item.tableName)
      .map((item) => [item.tableName, item] as const)
  );
  const categoryTree = safeArray(researchCatalog.categoryTree);
  if (categoryTree.length > 0) {
    return categoryTree.map((item) => ({
      categoryCode: String(item.categoryCode || "").trim(),
      categoryName: String(item.categoryName || "").trim(),
      description: String(item.description || "").trim(),
      tableScopes: normalizeStringArray(item.tableScopes),
      tableDetails: normalizeStringArray(item.tableScopes).map((tableName) => {
        const current = safeArray(item.tableDetails).find((entry) => String(entry?.tableName || "").trim() === tableName);
        const tableSpec = tableSpecMap.get(tableName);
        return {
          tableName,
          tableLabel: String(current?.tableLabel || tableSpec?.tableLabel || "").trim() || undefined,
          tableComment: String(current?.tableComment || tableSpec?.tableComment || "").trim() || undefined,
          sourceRefs: normalizeStringArray(current?.sourceRefs || tableSpec?.sourceRefs),
        };
      }),
      sourceRefs: normalizeStringArray(item.sourceRefs),
    }));
  }
  return safeArray(modulePlanner.categories).map((item) => ({
    categoryCode: String(item.categoryCode || "").trim(),
    categoryName: String(item.categoryName || item.moduleLabel || "").trim(),
    description: String(item.description || item.summary || "").trim(),
    tableScopes: normalizeStringArray(item.focusTables || item.expectedTables),
    tableDetails: normalizeStringArray(item.focusTables || item.expectedTables).map((tableName) => {
      const current = safeArray(item.focusTableDetails).find((entry) => String(entry?.tableName || "").trim() === tableName);
      const tableSpec = tableSpecMap.get(tableName);
      return {
        tableName,
        tableLabel: String(current?.tableLabel || tableSpec?.tableLabel || "").trim() || undefined,
        tableComment: String(current?.tableComment || tableSpec?.tableComment || "").trim() || undefined,
        sourceRefs: normalizeStringArray(current?.sourceRefs || tableSpec?.sourceRefs),
      };
    }),
    sourceRefs: normalizeStringArray(item.sourceRefs),
  }));
}

function buildDictionaryGroups(record: LabScenarioEnhancementRecord | null | undefined): DictionaryGroupRow[] {
  const groups = new Map<string, DictionaryGroupRow>();
  (record?.dictionaries || []).forEach((item) => {
    const dictType = String(item.dictType || "").trim();
    if (!dictType) return;
    const itemValue = safeObject(item.itemValue);
    const itemSourceRefs = normalizeStringArray((item as any).sourceRefs || itemValue.sourceRefs);
    if (!groups.has(dictType)) {
      groups.set(dictType, {
        dictType,
        dictName: String(itemValue.dictName || dictType).trim(),
        sourceRefs: [],
        items: [],
      });
    }
    const current = groups.get(dictType)!;
    current.sourceRefs = Array.from(new Set([...(current.sourceRefs || []), ...itemSourceRefs]));
    current.items = [
      ...(current.items || []),
      {
        itemCode: item.itemCode,
        itemLabel: item.itemLabel,
        valueRange: String(itemValue.valueRange || "").trim(),
        sourceRefs: itemSourceRefs,
      },
    ];
  });
  return Array.from(groups.values());
}

function initialFormValues(): EnhancementFormValues {
  return {
    confidenceThreshold: 0.6,
    priority: 100,
    categories: [],
    dictionaryGroups: [],
  };
}

function flattenDictionaries(groups: DictionaryGroupRow[] = []) {
  return groups.flatMap((group) =>
    (group.items || [])
      .filter((item) => String(item.itemLabel || "").trim())
      .map((item, index) => ({
        dictType: String(group.dictType || "").trim(),
        itemCode: buildCompactItemCode(item.itemCode, item.itemLabel, index),
        itemLabel: String(item.itemLabel || "").trim(),
        itemValue: {
          dictName: String(group.dictName || group.dictType || "").trim() || null,
          valueRange: String(item.valueRange || "").trim() || null,
          sourceRefs: normalizeStringArray(item.sourceRefs),
        },
        sourceRefs: normalizeStringArray(item.sourceRefs),
        weight: 1,
        sortOrder: index + 1,
        status: "active",
      }))
  );
}

function buildLightweightPayload(values: EnhancementFormValues) {
  const categories = safeArray(values.categories)
    .map((item) => ({
      categoryCode: String(item.categoryCode || "").trim(),
      categoryName: String(item.categoryName || "").trim(),
      description: String(item.description || "").trim() || null,
      tableScopes: normalizeStringArray(item.tableScopes),
      tableDetails: normalizeStringArray(item.tableScopes).map((tableName) => {
        const detailItem = safeArray(item.tableDetails).find((entry) => String(entry?.tableName || "").trim() === tableName);
        return {
          tableName,
          tableLabel: String(detailItem?.tableLabel || "").trim() || null,
          tableComment: String(detailItem?.tableComment || "").trim() || null,
          sourceRefs: normalizeStringArray(detailItem?.sourceRefs),
        };
      }),
      sourceRefs: normalizeStringArray(item.sourceRefs),
    }))
    .filter((item) => item.categoryName);

  const dictionaries = flattenDictionaries(safeArray(values.dictionaryGroups));
  const candidateTableSpecs = categories.flatMap((item) => item.tableDetails || []).filter((item) => item.tableName);
  const candidateTables = Array.from(new Set(categories.flatMap((item) => item.tableScopes || [])));
  const dictSuggestions = Array.from(new Set(dictionaries.map((item) => item.dictType).filter(Boolean)));
  const dictSuggestionSpecs = safeArray(values.dictionaryGroups)
    .map((group) => ({
      dictType: String(group.dictType || "").trim(),
      dictName: String(group.dictName || group.dictType || "").trim(),
      tableName: `${String(group.dictType || "").trim()}_dict`,
      tableComment: `${String(group.dictName || group.dictType || "").trim()}字典表`,
      values: safeArray(group.items).map((item) => ({
        itemCode: String(item.itemCode || "").trim(),
        itemLabel: String(item.itemLabel || "").trim(),
        valueRange: String(item.valueRange || "").trim() || null,
      })).filter((item) => item.itemCode && item.itemLabel),
      sourceRefs: normalizeStringArray(group.sourceRefs),
    }))
    .filter((item) => item.dictType && item.values.length > 0);
  const sourceRefs = Array.from(new Set([
    ...categories.flatMap((item) => item.sourceRefs || []),
    ...dictionaries.flatMap((item) => item.sourceRefs || []),
  ]));

  return {
    id: values.id,
    profileName: values.profileName,
    profileCode: values.profileCode,
    industry: values.industry,
    subScenario: values.subScenario || undefined,
    profileDesc: values.profileDesc || undefined,
    confidenceThreshold: values.confidenceThreshold ?? 0.6,
    priority: values.priority ?? 100,
    status: "active",
    recognition: {
      aliases: [values.profileName, values.subScenario].filter(Boolean),
      keywords: [values.profileName, values.industry, values.subScenario].filter(Boolean),
      negativeKeywords: [],
    },
    researchCatalog: {
      industryLabel: values.profileName,
      categoryTree: categories,
      candidateTables,
      candidateTableSpecs,
      dictSuggestions,
      dictSuggestionSpecs,
      sourceRefs,
      summary: values.profileDesc || "",
    },
    modulePlanner: {
      summary: values.profileDesc || "",
      categories: categories.map((item) => ({
        categoryCode: item.categoryCode,
        categoryName: item.categoryName,
        focusTables: item.tableScopes,
        focusTableDetails: item.tableDetails,
        description: item.description,
        sourceRefs: item.sourceRefs,
      })),
    },
    schemaGuides: {},
    relationPatterns: [],
    stateMachines: [],
    codeRules: [],
    fieldSemantics: [],
    valueCorpora: {},
    distributionProfiles: {},
    qualityGates: {},
    realismRules: [],
    dirtyDataProfiles: {},
    trainingAssets: {},
    evaluationRubric: {},
    overridePolicies: {},
    dictionaries,
    distributionRules: [],
    fieldRules: [],
    complianceRules: [],
    pluginBindings: [],
    extendedRules: [],
  };
}

export function DataLabScenarioEnhancementTab() {
  const { token } = useAuth();
  const [records, setRecords] = useState<LabScenarioEnhancementRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detail, setDetail] = useState<LabScenarioEnhancementRecord | null>(null);
  const [previewResult, setPreviewResult] = useState<LabScenarioRecognitionPreview | null>(null);
  const [form] = Form.useForm<EnhancementFormValues>();
  const [previewForm] = Form.useForm<PreviewFormValues>();

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetchScenarioEnhancements(token);
      setRecords(response.data);
    } catch (error) {
      setRecords([]);
      message.error(error instanceof Error ? error.message : "增强包列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  function openCreate() {
    form.resetFields();
    form.setFieldsValue(initialFormValues());
    setEditorOpen(true);
  }

  async function openEdit(id: number) {
    if (!token) return;
    const response = await fetchScenarioEnhancementDetail(token, id);
    const record = response.data;
    form.resetFields();
    form.setFieldsValue({
      id: record.id,
      profileName: record.profileName,
      profileCode: record.profileCode,
      industry: record.industry,
      subScenario: record.subScenario || undefined,
      profileDesc: record.profileDesc || undefined,
      confidenceThreshold: record.confidenceThreshold,
      priority: record.priority,
      categories: buildCategories(record),
      dictionaryGroups: buildDictionaryGroups(record),
    });
    setEditorOpen(true);
  }

  async function openDetail(id: number) {
    if (!token) return;
    const response = await fetchScenarioEnhancementDetail(token, id);
    setDetail(response.data);
    setDetailOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    await form.validateFields(["profileName", "industry"]);
    const values = form.getFieldsValue(true) as EnhancementFormValues;
    try {
      setSaving(true);
      await saveScenarioEnhancement(token, buildLightweightPayload(values) as any);
      message.success(values.id ? "增强包已更新" : "增强包已创建");
      setEditorOpen(false);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存增强包失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record: LabScenarioEnhancementRecord) {
    if (!token) return;
    try {
      await deleteScenarioEnhancement(token, record.id);
      message.success("增强包已删除");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除增强包失败");
    }
  }

  async function handlePreview() {
    if (!token) return;
    const values = await previewForm.validateFields();
    try {
      const response = await previewScenarioRecognition(token, values);
      setPreviewResult(response.data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "识别预览失败");
    }
  }

  const detailCategories = useMemo(() => buildCategories(detail), [detail?.id, detail?.updatedAt]);
  const detailDictionaryGroups = useMemo(() => buildDictionaryGroups(detail), [detail?.id, detail?.updatedAt]);
  const tableScopeCount = detailCategories.reduce((sum, item) => sum + (item.tableScopes?.length || 0), 0);
  const dictionaryItemCount = detailDictionaryGroups.reduce((sum, item) => sum + (item.items?.length || 0), 0);

  return (
    <Space direction="vertical" size={12} style={{ display: "flex" }}>
      <Card bordered={false}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Space>
            <Upload
              showUploadList={false}
              beforeUpload={async (file) => {
                if (!token) return false;
                try {
                  await importScenarioEnhancementPackage(token, file);
                  message.success(`已导入增强包：${file.name}`);
                  await loadData();
                } catch (error) {
                  message.error(error instanceof Error ? error.message : "导入失败");
                }
                return false;
              }}
            >
              <Button>导入增强包</Button>
            </Upload>
            <Button onClick={() => { previewForm.resetFields(); setPreviewResult(null); setPreviewOpen(true); }}>
              识别预览
            </Button>
          </Space>
          <Button type="primary" onClick={openCreate}>新建增强包</Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={records}
        pagination={{ pageSize: 8 }}
        columns={[
          {
            title: "增强包名称",
            dataIndex: "profileName",
            render: (value: string, record) => (
              <Button type="link" style={{ paddingInline: 0 }} onClick={() => void openDetail(record.id)}>
                {value}
              </Button>
            ),
          },
          { title: "编码", dataIndex: "profileCode", width: 180 },
          { title: "行业", dataIndex: "industry", width: 140, render: (value: string) => industryLabel(value) },
          { title: "子类目", dataIndex: "subScenario", width: 180, render: (value: string) => value || "-" },
          {
            title: "元数据摘要",
            render: (_: unknown, record) => {
              const categories = buildCategories(record);
              const groups = buildDictionaryGroups(record);
              const tableCount = categories.reduce((sum, item) => sum + (item.tableScopes?.length || 0), 0);
              const dictCount = groups.reduce((sum, item) => sum + (item.items?.length || 0), 0);
              return `${categories.length} 个子类目 / ${tableCount} 张表 / ${dictCount} 个字典值`;
            },
          },
          { title: "状态", dataIndex: "status", width: 90, render: (value: string) => statusTag(value) },
          {
            title: "操作",
            width: 220,
            render: (_: unknown, record) => (
              <Space>
                <Button type="link" onClick={() => void openEdit(record.id)}>编辑</Button>
                <Button type="link" onClick={() => { if (token) void exportScenarioEnhancementPackage(token, record.id, `${record.profileCode}.json`); }}>导出</Button>
                <Popconfirm
                  title={record.isSystem ? "系统增强包不允许删除" : "确认删除当前增强包？"}
                  disabled={record.isSystem}
                  onConfirm={() => void handleDelete(record)}
                >
                  <Button type="link" danger disabled={record.isSystem}>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={editorOpen}
        title="行业增强包编辑器"
        onCancel={() => setEditorOpen(false)}
        onOk={() => void handleSave()}
        confirmLoading={saving}
        width={1100}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Tabs
            items={[
              {
                key: "basic",
                label: "基本信息",
                children: (
                  <Space direction="vertical" size={12} style={{ display: "flex" }}>
                    <Space style={{ width: "100%" }} size={16} align="start">
                      <Form.Item name="profileName" label="增强包名称" rules={[{ required: true, message: "请填写增强包名称" }]} style={{ flex: 1 }}>
                        <Input placeholder="如：交通运输行业增强包" />
                      </Form.Item>
                      <Form.Item name="profileCode" label="增强包编码" style={{ flex: 1 }}>
                        <Input placeholder="为空时自动生成" />
                      </Form.Item>
                    </Space>
                    <Space style={{ width: "100%" }} size={16} align="start">
                      <Form.Item name="industry" label="行业编码" rules={[{ required: true, message: "请选择行业编码" }]} style={{ flex: 1 }}>
                        <Select options={INDUSTRY_OPTIONS.map((item) => ({ label: `${item.label} / ${item.value}`, value: item.value }))} />
                      </Form.Item>
                      <Form.Item name="subScenario" label="默认子类目" style={{ flex: 1 }}>
                        <Input placeholder="如：公交运营 / 风险订单 / 监管报送" />
                      </Form.Item>
                    </Space>
                    <Space style={{ width: "100%" }} size={16} align="start">
                      <Form.Item name="confidenceThreshold" label="识别阈值" style={{ flex: 1 }}>
                        <InputNumber style={{ width: "100%" }} min={0} max={1} step={0.05} />
                      </Form.Item>
                      <Form.Item name="priority" label="优先级" style={{ flex: 1 }}>
                        <InputNumber style={{ width: "100%" }} min={0} max={9999} />
                      </Form.Item>
                    </Space>
                    <Form.Item name="profileDesc" label="增强包说明">
                      <Input.TextArea rows={4} placeholder="描述该增强包覆盖的行业、子类目、重点表范围和适用边界" />
                    </Form.Item>
                  </Space>
                ),
              },
              {
                key: "categories",
                label: "子类目与表范围",
                children: (
                  <Form.List name="categories">
                    {(fields, { add, remove }) => (
                      <Space direction="vertical" size={12} style={{ display: "flex" }}>
                        <Button type="primary" onClick={() => add({ tableScopes: [], sourceRefs: [] })}>新增子类目</Button>
                        {fields.map((field) => (
                          <Card
                            key={field.key}
                            size="small"
                            title={`子类目 ${field.name + 1}`}
                            extra={<Button type="link" danger onClick={() => remove(field.name)}>删除</Button>}
                          >
                            <Space direction="vertical" size={12} style={{ display: "flex" }}>
                              <Space style={{ width: "100%" }} size={16} align="start">
                                <Form.Item name={[field.name, "categoryCode"]} label="子类目编码" style={{ flex: 1 }}>
                                  <Input placeholder="如：bus_operation" />
                                </Form.Item>
                                <Form.Item name={[field.name, "categoryName"]} label="子类目名称" rules={[{ required: true, message: "请填写子类目名称" }]} style={{ flex: 1 }}>
                                  <Input placeholder="如：公交运营" />
                                </Form.Item>
                              </Space>
                              <Form.Item name={[field.name, "description"]} label="说明">
                                <Input.TextArea rows={2} />
                              </Form.Item>
                              <Form.Item name={[field.name, "tableScopes"]} label="重点表范围">
                                <Select mode="tags" tokenSeparators={[",", " "]} placeholder="如：bus_route, bus_station, fare_transaction" />
                              </Form.Item>
                              <Form.List name={[field.name, "tableDetails"]}>
                                {(tableFields, tableOps) => (
                                  <Space direction="vertical" size={12} style={{ display: "flex" }}>
                                    <Button onClick={() => tableOps.add({ sourceRefs: [] })}>新增表详情</Button>
                                    {tableFields.map((tableField) => (
                                      <Card
                                        key={tableField.key}
                                        size="small"
                                        title={`表详情 ${tableField.name + 1}`}
                                        extra={<Button type="link" danger onClick={() => tableOps.remove(tableField.name)}>删除</Button>}
                                      >
                                        <Space direction="vertical" size={12} style={{ display: "flex" }}>
                                          <Space style={{ width: "100%" }} size={16} align="start">
                                            <Form.Item name={[tableField.name, "tableName"]} label="英文表名" rules={[{ required: true, message: "请填写英文表名" }]} style={{ flex: 1 }}>
                                              <Input placeholder="如：bus_route" />
                                            </Form.Item>
                                            <Form.Item name={[tableField.name, "tableLabel"]} label="中文表名称" style={{ flex: 1 }}>
                                              <Input placeholder="如：公交线路" />
                                            </Form.Item>
                                          </Space>
                                          <Form.Item name={[tableField.name, "tableComment"]} label="中文表描述">
                                            <Input placeholder="如：公交线路基础信息表" />
                                          </Form.Item>
                                          <Form.Item name={[tableField.name, "sourceRefs"]} label="来源证据">
                                            <Select mode="tags" tokenSeparators={[",", " "]} placeholder="如：evd_xxx, evd_yyy" />
                                          </Form.Item>
                                        </Space>
                                      </Card>
                                    ))}
                                  </Space>
                                )}
                              </Form.List>
                              <Form.Item name={[field.name, "sourceRefs"]} label="来源证据">
                                <Select mode="tags" tokenSeparators={[",", " "]} placeholder="如：evd_xxx, evd_yyy" />
                              </Form.Item>
                            </Space>
                          </Card>
                        ))}
                      </Space>
                    )}
                  </Form.List>
                ),
              },
              {
                key: "dict",
                label: "行业字典和值域",
                children: (
                  <Form.List name="dictionaryGroups">
                    {(fields, { add, remove }) => (
                      <Space direction="vertical" size={12} style={{ display: "flex" }}>
                        <Button type="primary" onClick={() => add({ items: [], sourceRefs: [] })}>新增字典组</Button>
                        {fields.map((field) => (
                          <Card
                            key={field.key}
                            size="small"
                            title={`字典组 ${field.name + 1}`}
                            extra={<Button type="link" danger onClick={() => remove(field.name)}>删除</Button>}
                          >
                            <Space direction="vertical" size={12} style={{ display: "flex" }}>
                              <Space style={{ width: "100%" }} size={16} align="start">
                                <Form.Item name={[field.name, "dictType"]} label="字典类型" rules={[{ required: true, message: "请填写字典类型" }]} style={{ flex: 1 }}>
                                  <Input placeholder="如：vehicle_type" />
                                </Form.Item>
                                <Form.Item name={[field.name, "dictName"]} label="字典名称" style={{ flex: 1 }}>
                                  <Input placeholder="如：车辆类型" />
                                </Form.Item>
                              </Space>
                              <Form.Item name={[field.name, "sourceRefs"]} label="来源证据">
                                <Select mode="tags" tokenSeparators={[",", " "]} placeholder="如：evd_xxx, evd_yyy" />
                              </Form.Item>

                              <Form.List name={[field.name, "items"]}>
                                {(itemFields, itemOps) => (
                                  <Space direction="vertical" size={12} style={{ display: "flex" }}>
                                    <Button onClick={() => itemOps.add({ sourceRefs: [] })}>新增字典值</Button>
                                    {itemFields.map((itemField) => (
                                      <Card
                                        key={itemField.key}
                                        size="small"
                                        title={`字典值 ${itemField.name + 1}`}
                                        extra={<Button type="link" danger onClick={() => itemOps.remove(itemField.name)}>删除</Button>}
                                      >
                                        <Space direction="vertical" size={12} style={{ display: "flex" }}>
                                          <Space style={{ width: "100%" }} size={16} align="start">
                                            <Form.Item name={[itemField.name, "itemCode"]} label="编码" style={{ flex: 1 }}>
                                              <Input placeholder="留空时自动压成 2 位数字或字母码" />
                                            </Form.Item>
                                            <Form.Item name={[itemField.name, "itemLabel"]} label="标签" rules={[{ required: true, message: "请填写标签" }]} style={{ flex: 1 }}>
                                              <Input />
                                            </Form.Item>
                                          </Space>
                                          <Form.Item name={[itemField.name, "valueRange"]} label="值域/范围">
                                            <Input placeholder="如：01-09 / 枚举值 / 数值区间" />
                                          </Form.Item>
                                          <Form.Item name={[itemField.name, "sourceRefs"]} label="来源证据">
                                            <Select mode="tags" tokenSeparators={[",", " "]} />
                                          </Form.Item>
                                        </Space>
                                      </Card>
                                    ))}
                                  </Space>
                                )}
                              </Form.List>
                            </Space>
                          </Card>
                        ))}
                      </Space>
                    )}
                  </Form.List>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      <Modal open={detailOpen} title={detail?.profileName || "增强包详情"} onCancel={() => setDetailOpen(false)} footer={null} width={980} destroyOnHidden>
        {detail ? (
          <Space direction="vertical" size={16} style={{ display: "flex" }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="编码">{detail.profileCode}</Descriptions.Item>
              <Descriptions.Item label="行业">{industryLabel(detail.industry)}</Descriptions.Item>
              <Descriptions.Item label="默认子类目">{detail.subScenario || "-"}</Descriptions.Item>
              <Descriptions.Item label="识别阈值">{detail.confidenceThreshold}</Descriptions.Item>
              <Descriptions.Item label="优先级">{detail.priority}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(detail.status)}</Descriptions.Item>
              <Descriptions.Item label="最新版本">{detail.latestVersionNo ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="系统增强包">{detail.isSystem ? "是" : "否"}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="元数据摘要">
              <Descriptions bordered column={3} size="small">
                <Descriptions.Item label="子类目数量">{detailCategories.length}</Descriptions.Item>
                <Descriptions.Item label="重点表范围">{tableScopeCount}</Descriptions.Item>
                <Descriptions.Item label="字典值数量">{dictionaryItemCount}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="子类目与表范围">
              <Table
                rowKey={(record) => `${record.categoryCode}.${record.categoryName}`}
                dataSource={detailCategories}
                pagination={false}
                columns={[
                  { title: "子类目编码", dataIndex: "categoryCode", width: 180 },
                  { title: "子类目名称", dataIndex: "categoryName", width: 180 },
                  { title: "说明", dataIndex: "description" },
                  {
                    title: "重点表范围",
                    render: (_: unknown, record) => (
                      <Space wrap>
                        {safeArray(record.tableDetails).map((item) => (
                          <Tag key={String(item.tableName || "")}>
                            {String(item.tableName || "")}
                            {String(item.tableLabel || item.tableComment || "").trim()
                              ? ` / ${String(item.tableLabel || item.tableComment || "").trim()}`
                              : ""}
                          </Tag>
                        ))}
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>

            <Card size="small" title="行业字典和值域">
              <Table
                rowKey={(record) => record.dictType || ""}
                dataSource={detailDictionaryGroups}
                pagination={false}
                expandable={{
                  expandedRowRender: (record) => (
                    <Table
                      rowKey={(item) => `${record.dictType}.${item.itemCode}`}
                      dataSource={record.items || []}
                      pagination={false}
                      columns={[
                        { title: "编码", dataIndex: "itemCode", width: 160 },
                        { title: "标签", dataIndex: "itemLabel", width: 180 },
                        { title: "值域/范围", dataIndex: "valueRange" },
                        { title: "来源", render: (_: unknown, item) => (item.sourceRefs || []).join(", ") || "-" },
                      ]}
                    />
                  ),
                }}
                columns={[
                  { title: "字典类型", dataIndex: "dictType", width: 180 },
                  { title: "字典名称", dataIndex: "dictName", width: 180 },
                  { title: "字典值数量", render: (_: unknown, record) => record.items?.length || 0, width: 120 },
                  { title: "来源", render: (_: unknown, record) => (record.sourceRefs || []).join(", ") || "-" },
                ]}
              />
            </Card>
          </Space>
        ) : null}
      </Modal>

      <Modal open={previewOpen} title="识别预览" onCancel={() => setPreviewOpen(false)} onOk={() => void handlePreview()} width={900} destroyOnHidden>
        <Form form={previewForm} layout="vertical">
          <Form.Item name="sceneName" label="场景名称" rules={[{ required: true, message: "请填写场景名称" }]}>
            <Input placeholder="如：城市公交运营、企业采购审批、电商退款审核" />
          </Form.Item>
          <Form.Item name="sceneDesc" label="场景描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="knowledgeText" label="补充知识文本">
            <Input.TextArea rows={6} />
          </Form.Item>
        </Form>

        {previewResult ? (
          <Card size="small" title="预览结果">
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="识别行业">{industryLabel(previewResult.industry)}</Descriptions.Item>
              <Descriptions.Item label="子类目">{previewResult.subScenario || "-"}</Descriptions.Item>
              <Descriptions.Item label="置信度">{previewResult.confidence}</Descriptions.Item>
              <Descriptions.Item label="命中增强包">{previewResult.managedProfileCode || "-"}</Descriptions.Item>
              <Descriptions.Item label="命中信号" span={2}>
                <Space wrap>{(previewResult.signals || []).map((item) => <Tag key={item}>{item}</Tag>)}</Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        ) : null}
      </Modal>
    </Space>
  );
}
