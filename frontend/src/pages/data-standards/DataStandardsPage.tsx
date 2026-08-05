import {
  CheckCircleOutlined,
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Col,
  Descriptions,
  Dropdown,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { StatCard } from "../../components/ui/StatCard";
import { StatusTag } from "../../components/ui/StatusTag";
import { fetchModelProviders } from "../../services/modelProvider";
import {
  deleteReferenceStandard,
  deleteStandardCatalog,
  deleteStandardDataElement,
  deleteValueDomain,
  commitStandardImport,
  downloadStandardImportErrors,
  downloadStandardTemplate,
  exportStandardExcel,
  fetchDataStandardsOverview,
  fetchReferenceStandards,
  fetchStandardAiConfigs,
  fetchStandardCatalogs,
  fetchStandardDataElementDetail,
  fetchStandardDataElements,
  fetchStandardFieldMappings,
  fetchValueDomainDetail,
  fetchValueDomains,
  fetchStandardImportBatches,
  publishStandardDataElement,
  saveReferenceStandard,
  saveStandardCatalog,
  saveStandardDataElement,
  saveValueDomain,
  suggestStandardDataElements,
  previewStandardImport,
  updateStandardAiConfig,
  type DataStandardsOverview,
  type ReferenceStandard,
  type StandardAiConfig,
  type StandardCatalog,
  type StandardDataElement,
  type StandardFieldMapping,
  type StandardImportBatch,
  type StandardImportPreview,
  type ValueDomain,
  type ValueDomainItem,
} from "../../services/dataStandards";
import type { ModelProviderRecord } from "../../types/api";

type SectionKey = "overview" | "catalogs" | "elements" | "value-domains" | "references" | "mappings" | "models";

type Props = {
  section: SectionKey;
};

type CatalogCoverageModalState = {
  catalog: StandardCatalog;
  standardType?: string;
};

const sectionTitleMap: Record<SectionKey, string> = {
  overview: "标准总览",
  catalogs: "标准目录",
  elements: "标准数据元",
  "value-domains": "值域与代码集",
  references: "引用标准",
  mappings: "字段采标映射",
  models: "模型管理",
};

const statusOptions = [
  { value: "active", label: "启用" },
  { value: "inactive", label: "停用" },
];

const lifecycleOptions = [
  { value: "draft", label: "草稿" },
  { value: "review", label: "待审核" },
  { value: "published", label: "已发布" },
  { value: "deprecated", label: "已废弃" },
];

const standardTypeOptions = [
  { value: "national", label: "国家标准", prefix: "GB" },
  { value: "industry", label: "行业标准", prefix: "HB" },
  { value: "enterprise", label: "企业标准", prefix: "QB" },
];
const elementCodeSerialDigits = 5;
const elementIdentifierPrefixes = new Set(["STD", "GB", "HB", "QB", "BASE", "DICT", "PERSON", "ORG", "PLACE", "EVENT", "OBJECT", "OPS"]);
const catalogTypeLabels: Record<string, string> = {
  root: "根目录",
  business_domain: "业务主题",
  technical: "技术主题",
};

const dataTypeOptions = ["string", "integer", "decimal", "date", "datetime", "boolean", "text"].map((value) => ({ value, label: value }));
const valueDomainTypeOptions = [
  { value: "enumeration", label: "枚举" },
  { value: "range", label: "范围" },
  { value: "regex", label: "正则" },
  { value: "reference", label: "引用表" },
  { value: "free_text", label: "自由文本" },
];
const valueTypeOptions = ["string", "number", "date", "datetime", "boolean"].map((value) => ({ value, label: value }));

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function renderLifecycle(value?: string) {
  const label = lifecycleOptions.find((item) => item.value === value)?.label || value || "-";
  const tone = value === "published" ? "success" : value === "deprecated" ? "default" : "processing";
  return <StatusTag label={label} tone={tone as "success" | "default" | "processing"} />;
}

function renderStandardType(value?: string) {
  const item = standardTypeOptions.find((option) => option.value === value);
  return <Tag color={value === "national" ? "blue" : value === "industry" ? "purple" : "green"}>{item?.label || value || "-"}</Tag>;
}

function getStandardTypeLabel(value?: string) {
  return standardTypeOptions.find((option) => option.value === value)?.label || value || "全部标准";
}

function inferStandardTypeFromCode(code?: string) {
  const prefix = String(code || "").slice(0, 2).toUpperCase();
  return standardTypeOptions.find((item) => item.prefix === prefix)?.value || "enterprise";
}

function normalizeElementIdentifier(value?: unknown) {
  const raw = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_.-]/g, "_")
    .replace(/[.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const parts = raw.split("_").filter(Boolean);
  while (parts.length > 1 && elementIdentifierPrefixes.has(parts[0].toUpperCase())) {
    parts.shift();
  }
  const normalized = parts.join("_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
  return /^[A-Za-z]/.test(normalized) ? normalized : (normalized ? `DE_${normalized}` : "");
}

function makeUniqueElementIdentifier(value: unknown, existing: StandardDataElement[]) {
  const used = new Set(existing.map((item) => String(item.elementIdentifier || "").trim().toUpperCase()).filter(Boolean));
  const root = normalizeElementIdentifier(value) || "DATA_ELEMENT";
  let candidate = root;
  let counter = 2;
  while (used.has(candidate.toUpperCase())) {
    candidate = `${root}_${counter}`;
    counter += 1;
  }
  return candidate;
}

function getCatalogStandardCount(catalog: StandardCatalog, standardType?: string) {
  if (standardType === "national") return Number(catalog.nationalElementCount || 0);
  if (standardType === "industry") return Number(catalog.industryElementCount || 0);
  if (standardType === "enterprise") return Number(catalog.enterpriseElementCount || 0);
  return Number(catalog.elementCount || 0);
}

function collectCatalogSubtreeIds(catalogs: StandardCatalog[], rootId: number) {
  const ids = new Set<number>([rootId]);
  const childrenByParent = new Map<number, StandardCatalog[]>();
  for (const catalog of catalogs) {
    if (!catalog.parentId) continue;
    const siblings = childrenByParent.get(catalog.parentId) || [];
    siblings.push(catalog);
    childrenByParent.set(catalog.parentId, siblings);
  }

  const stack = [...(childrenByParent.get(rootId) || [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || ids.has(current.id)) continue;
    ids.add(current.id);
    stack.push(...(childrenByParent.get(current.id) || []));
  }
  return ids;
}

function splitTags(value?: string[] | string) {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function includesKeyword(values: Array<unknown>, keyword: string) {
  const text = values
    .filter((item) => item !== undefined && item !== null)
    .join(" ")
    .toLowerCase();
  return text.includes(keyword.toLowerCase());
}

function hasDiscreteValueDomainItems(domainType?: string) {
  return domainType === "enumeration" || domainType === "reference";
}

export function DataStandardsPage({ section }: Props) {
  const { message } = App.useApp();
  const { token } = useAuth();
  const authToken = token || undefined;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [overview, setOverview] = useState<DataStandardsOverview | null>(null);
  const [catalogs, setCatalogs] = useState<StandardCatalog[]>([]);
  const [references, setReferences] = useState<ReferenceStandard[]>([]);
  const [valueDomains, setValueDomains] = useState<ValueDomain[]>([]);
  const [elements, setElements] = useState<StandardDataElement[]>([]);
  const [mappings, setMappings] = useState<StandardFieldMapping[]>([]);
  const [aiConfigs, setAiConfigs] = useState<StandardAiConfig[]>([]);
  const [modelProviders, setModelProviders] = useState<ModelProviderRecord[]>([]);
  const [detailElement, setDetailElement] = useState<StandardDataElement | null>(null);
  const [detailValueDomain, setDetailValueDomain] = useState<ValueDomain | null>(null);
  const [contentKeyword, setContentKeyword] = useState("");
  const [standardTypeFilter, setStandardTypeFilter] = useState<string>();
  const [catalogCoverageModal, setCatalogCoverageModal] = useState<CatalogCoverageModalState | null>(null);
  const [catalogCoveragePage, setCatalogCoveragePage] = useState(1);
  const [catalogCoveragePageSize, setCatalogCoveragePageSize] = useState(8);

  const [catalogForm] = Form.useForm();
  const [referenceForm] = Form.useForm();
  const [domainForm] = Form.useForm();
  const [elementForm] = Form.useForm();
  const [aiConfigForm] = Form.useForm();
  const [suggestForm] = Form.useForm();
  const watchedDomainType = Form.useWatch("domainType", domainForm);

  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [referenceModalOpen, setReferenceModalOpen] = useState(false);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [elementModalOpen, setElementModalOpen] = useState(false);
  const [aiConfigModalOpen, setAiConfigModalOpen] = useState(false);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [editingAiConfig, setEditingAiConfig] = useState<StandardAiConfig | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"bundle" | "elements" | "value-domains">("bundle");
  const [importStrategy, setImportStrategy] = useState<"append" | "update" | "merge" | "overwrite">("merge");
  const [importPreview, setImportPreview] = useState<StandardImportPreview | null>(null);
  const [importBatches, setImportBatches] = useState<StandardImportBatch[]>([]);

  const catalogOptions = useMemo(
    () => catalogs.map((item) => ({ value: item.id, label: item.parentName ? `${item.parentName} / ${item.catalogName}` : item.catalogName })),
    [catalogs],
  );
  const referenceOptions = useMemo(
    () => references.map((item) => ({ value: item.id, label: `${item.standardName}${item.standardNo ? ` (${item.standardNo})` : ""}` })),
    [references],
  );
  const valueDomainOptions = useMemo(
    () => valueDomains.map((item) => ({ value: item.id, label: `${item.domainName} / ${item.domainCode}` })),
    [valueDomains],
  );
  const modelProviderOptions = useMemo(
    () => modelProviders
      .filter((item) => item.status === "active" && item.modelCategory === "chat")
      .map((item) => ({ value: item.id, label: `${item.configName} / ${item.modelName}` })),
    [modelProviders],
  );
  const nextElementCode = (standardType: string) => {
    const prefix = standardTypeOptions.find((item) => item.value === standardType)?.prefix || "QB";
    const maxNo = elements.reduce((max, item) => {
      const match = String(item.elementCode || "").match(new RegExp(`^${prefix}(\\d{4,${elementCodeSerialDigits}})$`, "i"));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}${String(maxNo + 1).padStart(elementCodeSerialDigits, "0")}`;
  };
  const normalizedKeyword = contentKeyword.trim().toLowerCase();
  const filteredCatalogs = useMemo(
    () => catalogs.filter((item) => {
      if (standardTypeFilter && getCatalogStandardCount(item, standardTypeFilter) <= 0) return false;
      return !normalizedKeyword || includesKeyword([item.catalogName, item.catalogCode, item.catalogType, catalogTypeLabels[item.catalogType], item.ownerName, item.description], normalizedKeyword);
    }),
    [catalogs, normalizedKeyword, standardTypeFilter],
  );
  const filteredReferences = useMemo(
    () => references.filter((item) => {
      if (standardTypeFilter && item.standardType !== standardTypeFilter) return false;
      return !normalizedKeyword || includesKeyword([item.standardName, item.standardCode, item.standardNo, item.publisher, item.description], normalizedKeyword);
    }),
    [references, normalizedKeyword, standardTypeFilter],
  );
  const filteredValueDomains = useMemo(
    () => valueDomains.filter((item) => !normalizedKeyword || includesKeyword([item.domainName, item.domainCode, item.domainType, item.valueType, item.referenceStandardName, item.description], normalizedKeyword)),
    [valueDomains, normalizedKeyword],
  );
  const filteredElements = useMemo(
    () => elements.filter((item) => {
      const itemStandardType = item.standardType || inferStandardTypeFromCode(item.elementCode);
      if (standardTypeFilter && itemStandardType !== standardTypeFilter) return false;
      return !normalizedKeyword || includesKeyword([
        item.elementNameCn,
        item.elementNameEn,
        item.elementCode,
        item.elementIdentifier,
        item.catalogName,
        item.objectClass,
        item.propertyName,
        item.representationTerm,
        item.valueDomainName,
        item.referenceStandardName,
        item.definition,
        ...(item.aliases || []),
        ...(item.tags || []),
      ], normalizedKeyword);
    }),
    [elements, normalizedKeyword, standardTypeFilter],
  );
  const filteredMappings = useMemo(
    () => mappings.filter((item) => !normalizedKeyword || includesKeyword([item.tableName, item.columnName, item.elementNameCn, item.elementCode, item.sourceModule, item.createdBy, ...(item.evidence || [])], normalizedKeyword)),
    [mappings, normalizedKeyword],
  );
  const filteredAiConfigs = useMemo(
    () => aiConfigs.filter((item) => !normalizedKeyword || includesKeyword([item.sceneName, item.sceneCode, item.defaultModelProviderName, item.defaultModelName, item.description, item.ownerName], normalizedKeyword)),
    [aiConfigs, normalizedKeyword],
  );
  const catalogCoverageElements = useMemo(
    () => {
      if (!catalogCoverageModal) return [];
      const catalogIds = collectCatalogSubtreeIds(catalogs, catalogCoverageModal.catalog.id);
      return elements.filter((item) => {
        const itemStandardType = item.standardType || inferStandardTypeFromCode(item.elementCode);
        return catalogIds.has(Number(item.catalogId))
          && (!catalogCoverageModal.standardType || itemStandardType === catalogCoverageModal.standardType);
      });
    },
    [catalogCoverageModal, catalogs, elements],
  );

  async function ensureCatalogCoverageElements() {
    if (!authToken) {
      return;
    }
    const response = await fetchStandardDataElements(authToken);
    setElements(response.data);
  }

  function openImportModal() {
    setImportFile(null);
    setImportPreview(null);
    setImportType(section === "elements" ? "elements" : section === "value-domains" ? "value-domains" : "bundle");
    setImportStrategy("merge");
    setImportModalOpen(true);
  }

  async function handlePreviewImport() {
    if (!authToken || !importFile) {
      message.warning("请选择 Excel 文件");
      return;
    }
    setSubmitting(true);
    try {
      const response = await previewStandardImport(authToken, importFile, { importType, strategy: importStrategy });
      setImportPreview(response.data);
    } catch (error: any) {
      message.error(error.message || "导入预校验失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCommitImport() {
    if (!authToken || !importFile || !importPreview || importPreview.summary.errorRows > 0) return;
    setSubmitting(true);
    try {
      const response = await commitStandardImport(authToken, importFile, { importType, strategy: importStrategy });
      if (response.data.status === "success") {
        message.success(`批量注册完成：新增 ${response.data.summary.createRows} 条，更新 ${response.data.summary.updateRows} 条`);
        setImportModalOpen(false);
        await loadData();
      } else {
        setImportPreview(response.data);
        message.error("导入未执行，请处理校验错误");
      }
    } catch (error: any) {
      message.error(error.message || "批量注册失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function openImportHistory() {
    if (!authToken) return;
    setSubmitting(true);
    try {
      const response = await fetchStandardImportBatches(authToken);
      setImportBatches(response.data);
      setImportHistoryOpen(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function loadData(targetSection: SectionKey = section) {
    if (!authToken) return;
    setLoading(true);
    try {
      if (targetSection === "overview") {
        const overviewRes = await fetchDataStandardsOverview(authToken);
        setOverview(overviewRes.data);
        return;
      }

      if (targetSection === "catalogs") {
        const catalogsRes = await fetchStandardCatalogs(authToken);
        setCatalogs(catalogsRes.data);
        return;
      }

      if (targetSection === "references") {
        const referencesRes = await fetchReferenceStandards(authToken);
        setReferences(referencesRes.data);
        return;
      }

      if (targetSection === "value-domains") {
        const [domainsRes, referencesRes] = await Promise.all([
          fetchValueDomains(authToken),
          fetchReferenceStandards(authToken),
        ]);
        setValueDomains(domainsRes.data);
        setReferences(referencesRes.data);
        return;
      }

      if (targetSection === "elements") {
        const [elementsRes, catalogsRes, referencesRes, domainsRes] = await Promise.all([
          fetchStandardDataElements(authToken),
          fetchStandardCatalogs(authToken),
          fetchReferenceStandards(authToken),
          fetchValueDomains(authToken),
        ]);
        setElements(elementsRes.data);
        setCatalogs(catalogsRes.data);
        setReferences(referencesRes.data);
        setValueDomains(domainsRes.data);
        return;
      }

      if (targetSection === "mappings") {
        const mappingsRes = await fetchStandardFieldMappings(authToken);
        setMappings(mappingsRes.data);
        return;
      }

      const [aiConfigsRes, providersRes] = await Promise.all([
        fetchStandardAiConfigs(authToken),
        fetchModelProviders(authToken),
      ]);
      setAiConfigs(aiConfigsRes.data);
      setModelProviders(providersRes.data);
    } catch (error: any) {
      message.error(error.message || "加载数据标准失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [authToken, section]);

  useEffect(() => {
    setContentKeyword("");
    setStandardTypeFilter(undefined);
  }, [section]);

  function openCatalogModal(record?: StandardCatalog) {
    catalogForm.resetFields();
    catalogForm.setFieldsValue(record || { catalogType: "business_domain", status: "active", sortOrder: 0 });
    setCatalogModalOpen(true);
  }

  async function handleSaveCatalog() {
    const values = await catalogForm.validateFields();
    setSubmitting(true);
    try {
      await saveStandardCatalog(authToken, values);
      message.success("标准目录已保存");
      setCatalogModalOpen(false);
      await loadData();
    } catch (error: any) {
      message.error(error.message || "保存标准目录失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function openCatalogCoverage(record: StandardCatalog, standardType?: string) {
    if (getCatalogStandardCount(record, standardType) <= 0) return;
    setLoading(true);
    try {
      await ensureCatalogCoverageElements();
      setCatalogCoveragePage(1);
      setCatalogCoveragePageSize(8);
      setCatalogCoverageModal({ catalog: record, standardType });
    } catch (error: any) {
      message.error(error.message || "加载标准清单失败");
    } finally {
      setLoading(false);
    }
  }

  function openReferenceModal(record?: ReferenceStandard) {
    referenceForm.resetFields();
    referenceForm.setFieldsValue(record || { standardType: "enterprise", status: "active" });
    setReferenceModalOpen(true);
  }

  async function handleSaveReference() {
    const values = await referenceForm.validateFields();
    setSubmitting(true);
    try {
      await saveReferenceStandard(authToken, values);
      message.success("引用标准已保存");
      setReferenceModalOpen(false);
      await loadData();
    } catch (error: any) {
      message.error(error.message || "保存引用标准失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function openDomainModal(record?: ValueDomain) {
    domainForm.resetFields();
    if (record?.id) {
      const response = await fetchValueDomainDetail(authToken, record.id);
      const domainType = response.data.domainType || "enumeration";
      domainForm.setFieldsValue({
        ...response.data,
        items: response.data.items?.length ? response.data.items : (hasDiscreteValueDomainItems(domainType) ? [{ sortOrder: 1, status: "active" }] : []),
      });
    } else {
      domainForm.setFieldsValue({
        domainType: "enumeration",
        valueType: "string",
        status: "active",
        items: [{ sortOrder: 1, status: "active" }],
      });
    }
    setDomainModalOpen(true);
  }

  async function handleSaveDomain() {
    const values = await domainForm.validateFields();
    const items = hasDiscreteValueDomainItems(values.domainType)
      ? (values.items || [])
        .filter((item: { itemCode?: string; itemLabel?: string }) => String(item?.itemCode || "").trim() && String(item?.itemLabel || "").trim())
        .map((item: { itemCode?: string; itemLabel?: string; itemValue?: string; itemMeaning?: string; sortOrder?: number; status?: string }) => ({
          ...item,
          itemCode: String(item.itemCode || "").trim(),
          itemLabel: String(item.itemLabel || "").trim(),
          itemValue: String(item.itemValue || "").trim() || undefined,
          itemMeaning: String(item.itemMeaning || "").trim() || undefined,
        }))
      : [];
    setSubmitting(true);
    try {
      await saveValueDomain(authToken, { ...values, items });
      message.success("值域已保存");
      setDomainModalOpen(false);
      await loadData();
    } catch (error: any) {
      message.error(error.message || "保存值域失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function openElementModal(record?: StandardDataElement) {
    elementForm.resetFields();
    if (record?.id) {
      const response = await fetchStandardDataElementDetail(authToken, record.id);
      elementForm.setFieldsValue({
        ...response.data,
        standardType: response.data.standardType || inferStandardTypeFromCode(response.data.elementCode),
      });
    } else {
      elementForm.setFieldsValue({
        standardType: "enterprise",
        elementCode: nextElementCode("enterprise"),
        dataType: "string",
        lifecycleStatus: "draft",
        status: "active",
        qualifiers: [],
        aliases: [],
        tags: [],
      });
    }
    setElementModalOpen(true);
  }

  function handleElementStandardTypeChange(value: string) {
    const prefix = standardTypeOptions.find((item) => item.value === value)?.prefix || "QB";
    const currentCode = String(elementForm.getFieldValue("elementCode") || "");
    if (!new RegExp(`^${prefix}\\d{${elementCodeSerialDigits}}$`, "i").test(currentCode)) {
      elementForm.setFieldValue("elementCode", nextElementCode(value));
    }
  }

  async function handleSaveElement() {
    const values = await elementForm.validateFields();
    setSubmitting(true);
    try {
      await saveStandardDataElement(authToken, {
        ...values,
        qualifiers: splitTags(values.qualifiers),
        aliases: splitTags(values.aliases),
        tags: splitTags(values.tags),
      });
      message.success("标准数据元已保存");
      setElementModalOpen(false);
      await loadData();
    } catch (error: any) {
      message.error(error.message || "保存标准数据元失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublishElement(record: StandardDataElement) {
    setSubmitting(true);
    try {
      await publishStandardDataElement(authToken, record.id, { changeSummary: "页面发布" });
      message.success("标准数据元已发布");
      await loadData();
    } catch (error: any) {
      message.error(error.message || "发布失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function openElementDetail(record: StandardDataElement) {
    const response = await fetchStandardDataElementDetail(authToken, record.id);
    setDetailElement(response.data);
  }

  async function openValueDomainDetail(valueDomainId?: number | null) {
    if (!valueDomainId) return;
    try {
      const response = await fetchValueDomainDetail(authToken, valueDomainId);
      setDetailValueDomain(response.data);
    } catch (error: any) {
      message.error(error.message || "加载值域明细失败");
    }
  }

  function renderValueDomainLink(record: Pick<StandardDataElement, "valueDomainId" | "valueDomainName">) {
    if (!record.valueDomainName) return "-";
    if (!record.valueDomainId) return record.valueDomainName;
    return (
      <Button type="link" style={{ padding: 0, height: "auto" }} onClick={() => void openValueDomainDetail(record.valueDomainId)}>
        {record.valueDomainName}
      </Button>
    );
  }

  async function handleSuggestElement() {
    const values = await suggestForm.validateFields();
    setSubmitting(true);
    try {
      const response = await suggestStandardDataElements(authToken, values);
      const candidate = response.data.candidates?.[0];
      if (!candidate) {
        message.info("模型未返回可用候选");
        return;
      }
      const candidateStandardType = candidate.standardType || inferStandardTypeFromCode(candidate.elementCode);
      const candidateCodeText = String(candidate.elementCode || "").toUpperCase();
      const candidateElementCode = /^(GB|HB|QB)\d{5}$/i.test(candidateCodeText)
        && !elements.some((item) => String(item.elementCode || "").toUpperCase() === candidateCodeText)
        ? String(candidate.elementCode).toUpperCase()
        : nextElementCode(candidateStandardType);
      const identifierSource = candidate.elementIdentifier || candidate.elementNameEn || candidate.propertyName || candidate.elementNameCn || candidateElementCode;
      elementForm.resetFields();
      elementForm.setFieldsValue({
        ...candidate,
        standardType: candidateStandardType,
        elementCode: candidateElementCode,
        elementIdentifier: makeUniqueElementIdentifier(identifierSource, elements),
        catalogId: candidate.catalogId || values.catalogId,
        referenceStandardId: candidate.referenceStandardId || values.referenceStandardId,
        lifecycleStatus: "draft",
        status: "active",
      });
      setSuggestModalOpen(false);
      setElementModalOpen(true);
      message.success(response.data.mode === "model" ? "已生成候选数据元" : "已按规则生成候选数据元");
    } catch (error: any) {
      message.error(error.message || "生成候选失败");
    } finally {
      setSubmitting(false);
    }
  }

  function openAiConfigModal(record: StandardAiConfig) {
    setEditingAiConfig(record);
    aiConfigForm.resetFields();
    aiConfigForm.setFieldsValue(record);
    setAiConfigModalOpen(true);
  }

  async function handleSaveAiConfig() {
    if (!editingAiConfig) return;
    const values = await aiConfigForm.validateFields();
    setSubmitting(true);
    try {
      await updateStandardAiConfig(authToken, editingAiConfig.id, values);
      message.success("模型配置已保存");
      setAiConfigModalOpen(false);
      setEditingAiConfig(null);
      await loadData();
    } catch (error: any) {
      message.error(error.message || "保存模型配置失败");
    } finally {
      setSubmitting(false);
    }
  }

  const catalogColumns: ColumnsType<StandardCatalog> = [
    { title: "目录名称", dataIndex: "catalogName", key: "catalogName", width: 180 },
    { title: "目录编码", dataIndex: "catalogCode", key: "catalogCode", width: 180 },
    { title: "父级目录", dataIndex: "parentName", key: "parentName", width: 160, render: (value) => value || "-" },
    { title: "类型", dataIndex: "catalogType", key: "catalogType", width: 120, render: (value) => catalogTypeLabels[value] || value || "-" },
    {
      title: "数据元数",
      dataIndex: "elementCount",
      key: "elementCount",
      width: 100,
      render: (value, record) => (
        <Button type="link" size="small" disabled={!Number(value || 0)} onClick={() => void openCatalogCoverage(record)}>
          {Number(value || 0)}
        </Button>
      ),
    },
    {
      title: "标准覆盖",
      key: "coverage",
      width: 260,
      render: (_, record) => (
        <Space size={4} wrap>
          {standardTypeOptions.map((item) => {
            const count = getCatalogStandardCount(record, item.value);
            return (
              <Button key={item.value} type="link" size="small" disabled={!count} onClick={() => void openCatalogCoverage(record, item.value)}>
                {item.label.replace("标准", "")} {count}
              </Button>
            );
          })}
        </Space>
      ),
    },
    { title: "状态", dataIndex: "status", key: "status", width: 100, render: (value) => <StatusTag status={value} /> },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openCatalogModal(record)} />
          <Popconfirm title="确认删除该目录？" onConfirm={() => deleteStandardCatalog(authToken, record.id).then(() => loadData())}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const referenceColumns: ColumnsType<ReferenceStandard> = [
    { title: "标准名称", dataIndex: "standardName", key: "standardName", width: 240 },
    { title: "标准编码", dataIndex: "standardCode", key: "standardCode", width: 160 },
    { title: "标准号", dataIndex: "standardNo", key: "standardNo", width: 160, render: (value) => value || "-" },
    { title: "类型", dataIndex: "standardType", key: "standardType", width: 120 },
    { title: "发布方", dataIndex: "publisher", key: "publisher", width: 160, render: (value) => value || "-" },
    { title: "引用数", key: "count", width: 110, render: (_, record) => Number(record.elementCount || 0) + Number(record.valueDomainCount || 0) },
    { title: "状态", dataIndex: "status", key: "status", width: 100, render: (value) => <StatusTag status={value} /> },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openReferenceModal(record)} />
          <Popconfirm title="确认删除该引用标准？" onConfirm={() => deleteReferenceStandard(authToken, record.id).then(() => loadData())}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const valueDomainColumns: ColumnsType<ValueDomain> = [
    {
      title: "值域名称",
      dataIndex: "domainName",
      key: "domainName",
      width: 180,
      render: (value, record) => (
        <Button type="link" style={{ padding: 0, height: "auto" }} onClick={() => void openValueDomainDetail(record.id)}>
          {value || "-"}
        </Button>
      ),
    },
    { title: "值域编码", dataIndex: "domainCode", key: "domainCode", width: 180 },
    { title: "类型", dataIndex: "domainType", key: "domainType", width: 120 },
    { title: "值类型", dataIndex: "valueType", key: "valueType", width: 100 },
    { title: "值域项", dataIndex: "itemCount", key: "itemCount", width: 100 },
    { title: "引用数据元", dataIndex: "elementCount", key: "elementCount", width: 110 },
    { title: "状态", dataIndex: "status", key: "status", width: 100, render: (value) => <StatusTag status={value} /> },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => void openDomainModal(record)} />
          <Popconfirm title="确认删除该值域？" onConfirm={() => deleteValueDomain(authToken, record.id).then(() => loadData())}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const elementColumns: ColumnsType<StandardDataElement> = [
    {
      title: "数据元",
      key: "element",
      width: 260,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Button type="link" style={{ padding: 0 }} onClick={() => void openElementDetail(record)}>
            {record.elementNameCn}
          </Button>
          <Typography.Text type="secondary">{record.elementCode}</Typography.Text>
        </Space>
      ),
    },
    { title: "标准类型", dataIndex: "standardType", key: "standardType", width: 110, render: (value, record) => renderStandardType(value || inferStandardTypeFromCode(record.elementCode)) },
    { title: "目录", dataIndex: "catalogName", key: "catalogName", width: 160, render: (value) => value || "-" },
    { title: "对象类", dataIndex: "objectClass", key: "objectClass", width: 120, render: (value) => value || "-" },
    { title: "属性", dataIndex: "propertyName", key: "propertyName", width: 120, render: (value) => value || "-" },
    { title: "表示词", dataIndex: "representationTerm", key: "representationTerm", width: 100, render: (value) => value || "-" },
    { title: "类型", dataIndex: "dataType", key: "dataType", width: 100 },
    { title: "值域", dataIndex: "valueDomainName", key: "valueDomainName", width: 160, render: (_, record) => renderValueDomainLink(record) },
    { title: "状态", dataIndex: "lifecycleStatus", key: "lifecycleStatus", width: 110, render: renderLifecycle },
    {
      title: "操作",
      key: "actions",
      width: 190,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => void openElementModal(record)} />
          <Button icon={<CheckCircleOutlined />} disabled={record.lifecycleStatus === "published"} onClick={() => void handlePublishElement(record)} />
          <Popconfirm title="确认删除该标准数据元？" onConfirm={() => deleteStandardDataElement(authToken, record.id).then(() => loadData())}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const mappingColumns: ColumnsType<StandardFieldMapping> = [
    { title: "字段", key: "field", width: 260, render: (_, record) => `${record.tableName}.${record.columnName}` },
    { title: "标准数据元", key: "element", width: 260, render: (_, record) => `${record.elementNameCn} / ${record.elementCode}` },
    { title: "状态", dataIndex: "mappingStatus", key: "mappingStatus", width: 120, render: (value) => <Tag>{value}</Tag> },
    { title: "置信度", dataIndex: "confidence", key: "confidence", width: 100, render: (value) => (value == null ? "-" : `${Math.round(Number(value) * 100)}%`) },
    { title: "创建人", dataIndex: "createdBy", key: "createdBy", width: 120 },
    { title: "更新时间", dataIndex: "updatedAt", key: "updatedAt", width: 180, render: formatDateTime },
  ];

  const aiColumns: ColumnsType<StandardAiConfig> = [
    { title: "场景", dataIndex: "sceneName", key: "sceneName", width: 180 },
    { title: "场景编码", dataIndex: "sceneCode", key: "sceneCode", width: 220 },
    { title: "默认模型", key: "model", width: 240, render: (_, record) => record.defaultModelProviderName ? `${record.defaultModelProviderName} / ${record.defaultModelName || "-"}` : "未配置" },
    { title: "温度", dataIndex: "temperature", key: "temperature", width: 90, render: (value) => value ?? "-" },
    { title: "状态", dataIndex: "status", key: "status", width: 100, render: (value) => <StatusTag status={value} /> },
    { title: "说明", dataIndex: "description", key: "description", render: (value) => value || "-" },
    {
      title: "操作",
      key: "actions",
      width: 100,
      render: (_, record) => <Button icon={<EditOutlined />} onClick={() => openAiConfigModal(record)} />,
    },
  ];

  const stats = overview
    ? [
      { title: "标准数据元", value: overview.elementCount, description: "注册中心当前数据元", icon: <SafetyCertificateOutlined /> },
      { title: "已发布", value: overview.publishedElementCount, description: "可被字段采标引用", icon: <CheckCircleOutlined /> },
      { title: "值域", value: overview.valueDomainCount, description: "枚举、范围和格式规则", icon: <FileSearchOutlined /> },
      { title: "字段采标", value: overview.mappingCount, description: "数据地图字段映射", icon: <ExperimentOutlined /> },
    ]
    : [];

  function renderOverview() {
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Row gutter={[16, 16]}>
          {stats.map((item) => (
            <Col key={item.title} xs={24} sm={12} xl={6}>
              <StatCard {...item} />
            </Col>
          ))}
        </Row>
        <DataTableCard<StandardDataElement>
          title="最近更新的数据元"
          tableProps={{
            rowKey: "id",
            loading,
            dataSource: (overview?.recentElements || []).filter((item) => !normalizedKeyword || includesKeyword([item.elementNameCn, item.elementCode, item.elementIdentifier, item.catalogName, item.definition], normalizedKeyword)),
            columns: elementColumns.filter((item) => item.key !== "actions"),
            pagination: false,
            scroll: { x: 900 },
          }}
        />
      </Space>
    );
  }

  function renderCurrentSection() {
    if (section === "overview") return renderOverview();
    if (section === "catalogs") {
      return (
        <DataTableCard<StandardCatalog>
          title="标准目录"
          tableProps={{ rowKey: "id", loading, dataSource: filteredCatalogs, columns: catalogColumns, pagination: { pageSize: 10 }, scroll: { x: 1120 } }}
        />
      );
    }
    if (section === "references") {
      return (
        <DataTableCard<ReferenceStandard>
          title="引用标准"
          tableProps={{ rowKey: "id", loading, dataSource: filteredReferences, columns: referenceColumns, pagination: { pageSize: 10 }, scroll: { x: 1000 } }}
        />
      );
    }
    if (section === "value-domains") {
      return (
        <DataTableCard<ValueDomain>
          title="值域与代码集"
          tableProps={{ rowKey: "id", loading, dataSource: filteredValueDomains, columns: valueDomainColumns, pagination: { pageSize: 10 }, scroll: { x: 1000 } }}
        />
      );
    }
    if (section === "elements") {
      return (
        <DataTableCard<StandardDataElement>
          title="标准数据元"
          tableProps={{ rowKey: "id", loading, dataSource: filteredElements, columns: elementColumns, pagination: { pageSize: 10 }, scroll: { x: 1400 } }}
        />
      );
    }
    if (section === "mappings") {
      return (
        <DataTableCard<StandardFieldMapping>
          title="字段采标映射"
          tableProps={{ rowKey: "id", loading, dataSource: filteredMappings, columns: mappingColumns, pagination: { pageSize: 10 }, scroll: { x: 1000 } }}
        />
      );
    }
    return (
      <DataTableCard<StandardAiConfig>
        title="数据标准模型配置"
        tableProps={{ rowKey: "id", loading, dataSource: filteredAiConfigs, columns: aiColumns, pagination: false, scroll: { x: 1000 } }}
      />
    );
  }

  const toolbarRight = (
    <Space wrap>
      <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
        刷新
      </Button>
      {section === "elements" || section === "value-domains" ? (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "download-template",
                icon: <DownloadOutlined />,
                label: "下载模板",
                onClick: () => void downloadStandardTemplate(authToken, section === "elements" ? "elements" : "value-domains"),
              },
              { key: "batch-register", icon: <UploadOutlined />, label: "批量注册", onClick: openImportModal },
              {
                key: "export-excel",
                icon: <DownloadOutlined />,
                label: "导出 Excel",
                onClick: () => void exportStandardExcel(authToken, section === "elements" ? "elements" : "value-domains"),
              },
              { key: "import-history", icon: <FileSearchOutlined />, label: "导入记录", onClick: () => void openImportHistory() },
            ],
          }}
        >
          <Button icon={<UploadOutlined />}>批量操作 <DownOutlined /></Button>
        </Dropdown>
      ) : null}
      {section === "catalogs" ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openCatalogModal()}>新建目录</Button> : null}
      {section === "references" ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openReferenceModal()}>新建引用标准</Button> : null}
      {section === "value-domains" ? <Button type="primary" icon={<PlusOutlined />} onClick={() => void openDomainModal()}>新建值域</Button> : null}
      {section === "elements" ? (
        <>
          <Button icon={<ExperimentOutlined />} onClick={() => setSuggestModalOpen(true)}>AI 生成候选</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void openElementModal()}>新建数据元</Button>
        </>
      ) : null}
    </Space>
  );
  const toolbarLeft = (
    <Space wrap>
      <Input.Search
        allowClear
        style={{ width: 280 }}
        placeholder={`搜索${sectionTitleMap[section]}内容`}
        value={contentKeyword}
        onChange={(event) => setContentKeyword(event.target.value)}
      />
      {section === "catalogs" || section === "elements" || section === "references" ? (
        <Select
          allowClear
          style={{ width: 150 }}
          placeholder="标准类型"
          value={standardTypeFilter}
          options={standardTypeOptions}
          onChange={setStandardTypeFilter}
        />
      ) : null}
    </Space>
  );

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <PageHeader
        title={sectionTitleMap[section]}
        description="围绕标准数据元、值域、引用标准和字段采标建立统一注册中心，标准发布后再被数据地图、质量规则和服务出口引用。"
      />
      <PageToolbar left={toolbarLeft} right={toolbarRight} />
      {renderCurrentSection()}

      <Modal
        open={importModalOpen}
        title="数据标准批量注册"
        width={920}
        onCancel={() => setImportModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setImportModalOpen(false)}>取消</Button>,
          <Button key="preview" loading={submitting} disabled={!importFile} onClick={() => void handlePreviewImport()}>预校验</Button>,
          <Button key="commit" type="primary" loading={submitting} disabled={!importPreview || importPreview.summary.errorRows > 0} onClick={() => void handleCommitImport()}>确认导入</Button>,
        ]}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={16}>
            <Col span={12}>
              <Typography.Text strong>导入范围</Typography.Text>
              <Select
                style={{ width: "100%", marginTop: 8 }}
                value={importType}
                onChange={(value) => { setImportType(value); setImportPreview(null); }}
                options={[
                  { value: "bundle", label: "完整数据标准" },
                  { value: "elements", label: "标准数据元" },
                  { value: "value-domains", label: "值域与代码集" },
                ]}
              />
            </Col>
            <Col span={12}>
              <Typography.Text strong>导入策略</Typography.Text>
              <Select
                style={{ width: "100%", marginTop: 8 }}
                value={importStrategy}
                onChange={(value) => { setImportStrategy(value); setImportPreview(null); }}
                options={[
                  { value: "append", label: "追加：只新增，重复即报错" },
                  { value: "update", label: "更新：只更新，不存在即报错" },
                  { value: "merge", label: "合并：存在则更新，不存在则新增" },
                  { value: "overwrite", label: "覆盖：合并资产并完整替换代码项" },
                ]}
              />
            </Col>
          </Row>
          <Upload.Dragger
            accept=".xlsx,.xls"
            maxCount={1}
            beforeUpload={(file) => { setImportFile(file); setImportPreview(null); return false; }}
            onRemove={() => { setImportFile(null); setImportPreview(null); }}
            fileList={importFile ? [importFile as any] : []}
          >
            <UploadOutlined style={{ fontSize: 28 }} />
            <Typography.Paragraph style={{ margin: "8px 0 0" }}>选择系统模板填写后的 Excel 文件</Typography.Paragraph>
          </Upload.Dragger>
          {importPreview ? (
            <>
              <Row gutter={12}>
                <Col span={6}><StatCard title="总行数" value={importPreview.summary.totalRows} /></Col>
                <Col span={6}><StatCard title="预计新增" value={importPreview.summary.createRows} /></Col>
                <Col span={6}><StatCard title="预计更新" value={importPreview.summary.updateRows} /></Col>
                <Col span={6}><StatCard title="错误行" value={importPreview.summary.errorRows} /></Col>
              </Row>
              {importPreview.errors.length ? (
                <Table
                  size="small"
                  rowKey={(record) => `${record.sheetName}-${record.rowNumber}-${record.fieldName}`}
                  dataSource={importPreview.errors}
                  columns={[
                    { title: "工作表", dataIndex: "sheetName", width: 120 },
                    { title: "行号", dataIndex: "rowNumber", width: 70 },
                    { title: "业务编码", dataIndex: "businessCode", width: 160, render: (value) => value || "-" },
                    { title: "字段", dataIndex: "fieldName", width: 130 },
                    { title: "错误原因", dataIndex: "errorMessage" },
                  ]}
                  pagination={{ pageSize: 6 }}
                  scroll={{ x: 760 }}
                />
              ) : <Typography.Text type="success">预校验通过，可以执行批量注册。</Typography.Text>}
            </>
          ) : null}
        </Space>
      </Modal>

      <Modal open={importHistoryOpen} title="数据标准导入记录" width={960} footer={null} onCancel={() => setImportHistoryOpen(false)}>
        <List
          dataSource={importBatches}
          locale={{ emptyText: "暂无导入记录" }}
          renderItem={(item) => (
            <List.Item
              actions={item.errorRows > 0 ? [<Button key="errors" type="link" onClick={() => void downloadStandardImportErrors(authToken, item.id)}>下载错误明细</Button>] : undefined}
            >
              <List.Item.Meta
                title={<Space><Typography.Text>{item.fileName}</Typography.Text><StatusTag status={item.status} /></Space>}
                description={`${formatDateTime(item.createdAt)} · 总计 ${item.totalRows} · 新增 ${item.createdRows} · 更新 ${item.updatedRows} · 错误 ${item.errorRows}`}
              />
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        open={Boolean(catalogCoverageModal)}
        title={catalogCoverageModal ? `${catalogCoverageModal.catalog.catalogName} / ${getStandardTypeLabel(catalogCoverageModal.standardType)}` : "标准清单"}
        onCancel={() => setCatalogCoverageModal(null)}
        footer={null}
        width={980}
      >
        <Table<StandardDataElement>
          rowKey="id"
          size="small"
          dataSource={catalogCoverageElements}
          pagination={{
            current: catalogCoveragePage,
            pageSize: catalogCoveragePageSize,
            pageSizeOptions: ["8", "10", "20", "50", "100"],
            showSizeChanger: true,
            onChange: (page, pageSize) => {
              setCatalogCoveragePage(page);
              setCatalogCoveragePageSize(pageSize || 8);
            },
          }}
          scroll={{ x: 920 }}
          columns={[
            {
              title: "标准数据元",
              key: "element",
              width: 220,
              render: (_, record) => (
                <Space direction="vertical" size={0}>
                  <Button type="link" style={{ padding: 0 }} onClick={() => void openElementDetail(record)}>
                    {record.elementNameCn}
                  </Button>
                  <Typography.Text type="secondary">{record.elementIdentifier}</Typography.Text>
                </Space>
              ),
            },
            { title: "编码", dataIndex: "elementCode", width: 100 },
            { title: "标准类型", dataIndex: "standardType", width: 110, render: (value, record) => renderStandardType(value || inferStandardTypeFromCode(record.elementCode)) },
            { title: "对象类", dataIndex: "objectClass", width: 130, render: (value) => value || "-" },
            { title: "属性", dataIndex: "propertyName", width: 140, render: (value) => value || "-" },
            { title: "值域", dataIndex: "valueDomainName", width: 180, render: (_, record) => renderValueDomainLink(record) },
            { title: "引用标准", dataIndex: "referenceStandardName", width: 220, render: (value) => value || "-" },
          ]}
        />
      </Modal>

      <Modal open={catalogModalOpen} title="标准目录" onCancel={() => setCatalogModalOpen(false)} onOk={() => void handleSaveCatalog()} confirmLoading={submitting} width={720}>
        <Form form={catalogForm} layout="vertical">
          <Form.Item name="id" hidden><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="catalogName" label="目录名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="catalogCode" label="目录编码" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="parentId" label="父级目录"><Select allowClear options={catalogOptions} /></Form.Item></Col>
            <Col span={12}><Form.Item name="catalogType" label="目录类型"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="ownerName" label="责任人"><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="sortOrder" label="排序"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="说明"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal open={referenceModalOpen} title="引用标准" onCancel={() => setReferenceModalOpen(false)} onOk={() => void handleSaveReference()} confirmLoading={submitting} width={820}>
        <Form form={referenceForm} layout="vertical">
          <Form.Item name="id" hidden><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="standardName" label="标准名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="standardCode" label="标准编码" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="standardType" label="标准类型"><Select options={standardTypeOptions} /></Form.Item></Col>
            <Col span={8}><Form.Item name="standardNo" label="标准号"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="effectiveDate" label="生效日期"><Input placeholder="YYYY-MM-DD" /></Form.Item></Col>
            <Col span={12}><Form.Item name="publisher" label="发布方"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="standardUrl" label="标准链接"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="说明"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal open={domainModalOpen} title="值域与代码集" onCancel={() => setDomainModalOpen(false)} onOk={() => void handleSaveDomain()} confirmLoading={submitting} width={980}>
        <Form form={domainForm} layout="vertical">
          <Form.Item name="id" hidden><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="domainName" label="值域名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="domainCode" label="值域编码" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={4}><Form.Item name="domainType" label="值域类型"><Select options={valueDomainTypeOptions} /></Form.Item></Col>
            <Col span={4}><Form.Item name="valueType" label="值类型"><Select options={valueTypeOptions} /></Form.Item></Col>
            <Col span={6}><Form.Item name="dataType" label="数据类型"><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="minValue" label="最小值"><InputNumber style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="maxValue" label="最大值"><InputNumber style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="unit" label="单位"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="regexPattern" label="正则格式"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="formatPattern" label="格式模式"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="referenceStandardId" label="引用标准"><Select allowClear options={referenceOptions} /></Form.Item></Col>
            <Col span={8}><Form.Item name="referenceClause" label="引用条款"><Input /></Form.Item></Col>
            <Col span={4}><Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="说明"><Input.TextArea rows={2} /></Form.Item>
          {hasDiscreteValueDomainItems(watchedDomainType) && (
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Space>
                    <Typography.Text strong>值域项</Typography.Text>
                    <Button size="small" onClick={() => add({ sortOrder: fields.length + 1, status: "active" })}>新增值项</Button>
                  </Space>
                  {fields.map(({ key, ...field }) => (
                    <Row gutter={8} key={key}>
                      <Col span={4}><Form.Item {...field} name={[field.name, "itemCode"]} rules={[{ required: true }]}><Input placeholder="代码" /></Form.Item></Col>
                      <Col span={5}><Form.Item {...field} name={[field.name, "itemLabel"]} rules={[{ required: true }]}><Input placeholder="标签" /></Form.Item></Col>
                      <Col span={4}><Form.Item {...field} name={[field.name, "itemValue"]}><Input placeholder="值" /></Form.Item></Col>
                      <Col span={6}><Form.Item {...field} name={[field.name, "itemMeaning"]}><Input placeholder="含义" /></Form.Item></Col>
                      <Col span={3}><Form.Item {...field} name={[field.name, "sortOrder"]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                      <Col span={2}><Button danger onClick={() => remove(field.name)}>删除</Button></Col>
                    </Row>
                  ))}
                </Space>
              )}
            </Form.List>
          )}
        </Form>
      </Modal>

      <Modal open={elementModalOpen} title="标准数据元" onCancel={() => setElementModalOpen(false)} onOk={() => void handleSaveElement()} confirmLoading={submitting} width={1080}>
        <Form form={elementForm} layout="vertical">
          <Form.Item name="id" hidden><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="elementNameCn" label="中文名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="standardType" label="标准类型" rules={[{ required: true }]}><Select options={standardTypeOptions} onChange={handleElementStandardTypeChange} /></Form.Item></Col>
            <Col span={6}><Form.Item name="elementCode" label="标准编码" rules={[{ required: true }, { pattern: /^(GB|HB|QB)\d{5}$/i, message: "采用 GB/HB/QB+五位流水号" }]}><Input placeholder="如 GB00001" /></Form.Item></Col>
            <Col span={6}><Form.Item name="elementIdentifier" label="标识符" rules={[{ required: true }, { pattern: /^(?!(STD|GB|HB|QB|BASE|DICT|PERSON|ORG|PLACE|EVENT|OBJECT|OPS)[._-])[A-Za-z][A-Za-z0-9_]*$/i, message: "不要带前缀，仅支持字母、数字和下划线" }]}><Input placeholder="如 REGISTERED_ADDRESS" /></Form.Item></Col>
            <Col span={8}><Form.Item name="elementNameEn" label="英文名称"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="catalogId" label="标准目录"><Select allowClear options={catalogOptions} /></Form.Item></Col>
            <Col span={8}><Form.Item name="lifecycleStatus" label="生命周期"><Select options={lifecycleOptions} /></Form.Item></Col>
            <Col span={6}><Form.Item name="objectClass" label="对象类"><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="propertyName" label="属性"><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="representationTerm" label="表示词"><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="qualifiers" label="限定词"><Select mode="tags" /></Form.Item></Col>
            <Col span={6}><Form.Item name="dataType" label="数据类型"><Select options={dataTypeOptions} /></Form.Item></Col>
            <Col span={6}><Form.Item name="maxLength" label="长度"><InputNumber min={1} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="numericPrecision" label="精度"><InputNumber min={1} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="numericScale" label="小数位"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="datetimePrecision" label="时间精度"><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="formatPattern" label="格式/正则"><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="unit" label="单位"><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="valueDomainId" label="值域"><Select allowClear options={valueDomainOptions} /></Form.Item></Col>
            <Col span={8}><Form.Item name="referenceStandardId" label="引用标准"><Select allowClear options={referenceOptions} /></Form.Item></Col>
            <Col span={8}><Form.Item name="referenceClause" label="引用条款"><Input /></Form.Item></Col>
            <Col span={4}><Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item></Col>
            <Col span={4}><Form.Item name="ownerName" label="责任人"><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="stewardName" label="数据管家"><Input /></Form.Item></Col>
            <Col span={9}><Form.Item name="aliases" label="别名"><Select mode="tags" /></Form.Item></Col>
            <Col span={9}><Form.Item name="tags" label="标签"><Select mode="tags" /></Form.Item></Col>
          </Row>
          <Form.Item name="definition" label="业务定义"><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>

      <Modal open={suggestModalOpen} title="AI 生成标准数据元候选" onCancel={() => setSuggestModalOpen(false)} onOk={() => void handleSuggestElement()} confirmLoading={submitting} width={860}>
        <Form form={suggestForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="catalogId" label="目标目录"><Select allowClear options={catalogOptions} /></Form.Item></Col>
            <Col span={12}><Form.Item name="referenceStandardId" label="参考标准"><Select allowClear options={referenceOptions} /></Form.Item></Col>
          </Row>
          <Form.Item name="sourceText" label="字段、表、样例或业务说明" rules={[{ required: true, message: "请输入生成依据" }]}>
            <Input.TextArea rows={10} placeholder="例如：字段 user_phone，注释 用户手机号，样例 13800138000，要求符合中国大陆手机号格式。" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={Boolean(detailElement)} title={detailElement?.elementNameCn || "数据元详情"} onCancel={() => setDetailElement(null)} footer={null} width={900}>
        {detailElement ? (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="编码">{detailElement.elementCode}</Descriptions.Item>
            <Descriptions.Item label="标识符">{detailElement.elementIdentifier}</Descriptions.Item>
            <Descriptions.Item label="标准类型">{renderStandardType(detailElement.standardType || inferStandardTypeFromCode(detailElement.elementCode))}</Descriptions.Item>
            <Descriptions.Item label="目录">{detailElement.catalogName || "-"}</Descriptions.Item>
            <Descriptions.Item label="生命周期">{renderLifecycle(detailElement.lifecycleStatus)}</Descriptions.Item>
            <Descriptions.Item label="对象类">{detailElement.objectClass || "-"}</Descriptions.Item>
            <Descriptions.Item label="属性">{detailElement.propertyName || "-"}</Descriptions.Item>
            <Descriptions.Item label="表示词">{detailElement.representationTerm || "-"}</Descriptions.Item>
            <Descriptions.Item label="数据类型">{detailElement.dataType}</Descriptions.Item>
            <Descriptions.Item label="长度/精度">{[detailElement.maxLength, detailElement.numericPrecision, detailElement.numericScale].filter((item) => item != null).join(" / ") || "-"}</Descriptions.Item>
            <Descriptions.Item label="值域">{renderValueDomainLink(detailElement)}</Descriptions.Item>
            <Descriptions.Item label="引用标准">{detailElement.referenceStandardName || "-"}</Descriptions.Item>
            <Descriptions.Item label="引用条款">{detailElement.referenceClause || "-"}</Descriptions.Item>
            <Descriptions.Item label="定义" span={2}>{detailElement.definition || "-"}</Descriptions.Item>
            <Descriptions.Item label="别名" span={2}>{(detailElement.aliases || []).map((item) => <Tag key={item}>{item}</Tag>)}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

      <Modal open={Boolean(detailValueDomain)} title={detailValueDomain?.domainName || "值域明细"} onCancel={() => setDetailValueDomain(null)} footer={null} width={920}>
        {detailValueDomain ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="值域编码">{detailValueDomain.domainCode}</Descriptions.Item>
              <Descriptions.Item label="值域名称">{detailValueDomain.domainName}</Descriptions.Item>
              <Descriptions.Item label="值域类型">{detailValueDomain.domainType}</Descriptions.Item>
              <Descriptions.Item label="值类型">{detailValueDomain.valueType}</Descriptions.Item>
              <Descriptions.Item label="数据类型">{detailValueDomain.dataType || "-"}</Descriptions.Item>
              <Descriptions.Item label="单位">{detailValueDomain.unit || "-"}</Descriptions.Item>
              <Descriptions.Item label="最小值">{detailValueDomain.minValue ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="最大值">{detailValueDomain.maxValue ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="正则格式">{detailValueDomain.regexPattern || "-"}</Descriptions.Item>
              <Descriptions.Item label="格式模式">{detailValueDomain.formatPattern || "-"}</Descriptions.Item>
              <Descriptions.Item label="引用标准">{detailValueDomain.referenceStandardName || "-"}</Descriptions.Item>
              <Descriptions.Item label="引用条款">{detailValueDomain.referenceClause || "-"}</Descriptions.Item>
              <Descriptions.Item label="说明" span={2}>{detailValueDomain.description || "-"}</Descriptions.Item>
            </Descriptions>
            {hasDiscreteValueDomainItems(detailValueDomain.domainType) ? (
              <Table<ValueDomainItem>
                rowKey={(record) => String(record.id || record.itemCode)}
                size="small"
                pagination={{ pageSize: 10, showSizeChanger: true }}
                dataSource={detailValueDomain.items || []}
                columns={[
                  { title: "代码", dataIndex: "itemCode", width: 130 },
                  { title: "标签", dataIndex: "itemLabel", width: 180 },
                  { title: "值", dataIndex: "itemValue", width: 140, render: (value) => value || "-" },
                  { title: "含义", dataIndex: "itemMeaning", render: (value) => value || "-" },
                  { title: "排序", dataIndex: "sortOrder", width: 90 },
                ]}
              />
            ) : null}
          </Space>
        ) : null}
      </Modal>

      <Modal open={aiConfigModalOpen} title="数据标准模型配置" onCancel={() => setAiConfigModalOpen(false)} onOk={() => void handleSaveAiConfig()} confirmLoading={submitting} width={960}>
        <Form form={aiConfigForm} layout="vertical">
          <Row gutter={16}>
            <Col span={8}><Form.Item name="sceneName" label="场景名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="sceneCode" label="场景编码" rules={[{ required: true }]}><Input disabled /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item></Col>
            <Col span={8}><Form.Item name="defaultModelProviderId" label="默认模型配置"><Select allowClear options={modelProviderOptions} /></Form.Item></Col>
            <Col span={8}><Form.Item name="defaultModelName" label="模型名称"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="defaultModelVersion" label="模型版本"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="temperature" label="温度"><InputNumber min={0} max={2} step={0.1} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="maxTokens" label="最大 Token"><InputNumber min={1} max={32000} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="timeoutMs" label="超时毫秒"><InputNumber min={1000} max={300000} style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
          <Form.Item name="systemPrompt" label="系统提示词"><Input.TextArea rows={6} /></Form.Item>
          <Form.Item name="userPromptTemplate" label="用户提示词模板"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="description" label="说明"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
