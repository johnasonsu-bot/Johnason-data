import { Alert, Button, Card, Descriptions, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchSystemKnowledgeBases, syncIncubationKnowledgeBase } from "../../services/systemKnowledgeBases";
import {
  deleteIndustryIncubation,
  fetchIndustryIncubationDetail,
  fetchIndustryIncubationLogs,
  fetchIndustryIncubationStats,
  fetchIndustryIncubations,
  saveIndustryIncubation,
  startIndustryIncubationRun,
  stopIndustryIncubationRun,
} from "../../services/dataLab";
import type {
  SystemKnowledgeBaseRecord,
  LabIndustryIncubationLogRecord,
  LabIndustryIncubationRecord,
  LabIndustryIncubationStatsRecord,
} from "../../types/api";

const INDUSTRY_OPTIONS = [
  { value: "ecommerce", label: "电商零售" },
  { value: "traffic", label: "交通运输" },
  { value: "bank_regulatory", label: "银行监管" },
  { value: "education", label: "教育治理" },
  { value: "finance_fund", label: "基金金融" },
  { value: "logistics_express", label: "物流快递" },
  { value: "crm", label: "客户经营" },
  { value: "generic", label: "通用行业" },
];

const EVIDENCE_SOURCE_OPTIONS = ["国家标准", "行业标准", "法规政策", "建设规范", "公开数据"];
const DEFAULT_PREFERRED_DOMAINS = ["gov.cn", "edu.cn", "org.cn"];

type IncubationFormValues = {
  incubationName: string;
  incubationCode?: string;
  industryCode?: string;
  incubationDesc?: string;
  domesticOnly: boolean;
  standardFirst: boolean;
  sourceTypes: string[];
  preferredDomains: string[];
  requiredKeywords: string[];
};

type RunFormValues = {
  roundCount: number;
};

type CategoryEditFormValues = {
  categoryCode: string;
  categoryName: string;
  description?: string;
  tableScopes: string[];
};

type TableEditFormValues = {
  tableName: string;
  tableComment?: string;
  tableSummary?: string;
  keyInfoItems?: string[];
  fieldsText?: string;
};

type DictionaryEditFormValues = {
  dictName?: string;
  valuesText: string;
};

type TableDetailRecord = {
  tableName: string;
  tableLabel?: string | null;
  tableComment?: string | null;
  tableSummary?: string | null;
  fields: string[];
  keyInfoItems: string[];
  sourceRefs: string[];
};

type CategoryRecord = {
  categoryCode: string;
  categoryName: string;
  description?: string | null;
  tableScopes: string[];
  tableDetails: TableDetailRecord[];
  sourceRefs: string[];
  lastRoundNo?: number;
};

type DictionaryItemRecord = {
  dictType: string;
  dictName?: string | null;
  itemCode: string;
  itemLabel: string;
  valueRange?: string | null;
  sourceRefs: string[];
  categoryCode?: string | null;
};

type DictionaryGroupRecord = {
  dictType: string;
  dictName?: string | null;
  items: DictionaryItemRecord[];
  sourceRefs: string[];
};

type EvidenceRecord = {
  id: string;
  title: string;
  authority: string;
  sourceUrl: string;
  sourceType: string;
  publishedAt?: string | null;
  summary: string;
};

type RowRecord = {
  key: string;
  rowType: "industry" | "category";
  parentId: number;
  incubation: LabIndustryIncubationRecord;
  category?: CategoryRecord;
  children?: RowRecord[];
};

type KnowledgeSyncRecord = {
  kbId: number;
  kbName: string;
  updatedAt?: string;
  createdAt?: string;
  documentCount?: number;
  status?: string;
};

type CategoryEditContext = {
  incubationId: number;
  originalCategoryCode: string;
};

function safeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeArray<T = Record<string, unknown>>(value: unknown) {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeStringArray(value: unknown) {
  return Array.from(new Set(safeArray(value).map((item) => String(item || "").trim()).filter(Boolean)));
}

function extractReadableText(value: unknown, preferredKeys: string[], depth = 0): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 2) {
    return "";
  }
  const entry = safeObject(value);
  for (const key of preferredKeys) {
    if (!Object.prototype.hasOwnProperty.call(entry, key)) continue;
    const candidate = extractReadableText(entry[key], preferredKeys, depth + 1);
    if (candidate) return candidate;
  }
  for (const candidateValue of Object.values(entry)) {
    const candidate = extractReadableText(candidateValue, preferredKeys, depth + 1);
    if (candidate) return candidate;
  }
  return "";
}

function extractFieldDisplayText(value: unknown) {
  return extractReadableText(value, [
    "fieldLabel",
    "fieldComment",
    "fieldName",
    "label",
    "name",
    "title",
    "displayName",
    "itemLabel",
    "text",
    "value",
    "comment",
    "description",
  ]);
}

function extractKeyInfoItemText(value: unknown) {
  return extractReadableText(value, [
    "fieldLabel",
    "fieldComment",
    "fieldName",
    "label",
    "name",
    "title",
    "displayName",
    "itemLabel",
    "itemName",
    "text",
    "value",
    "comment",
    "description",
    "summary",
  ]);
}

function hasChineseText(value: unknown) {
  return /[\u4e00-\u9fff]/.test(String(value || ""));
}

function isPlaceholderFieldToken(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  return /^(field[_-]?\d+|FIELD\d+)$/i.test(raw)
    || /^\[object\s+[^\]]+\]$/i.test(raw)
    || /^(object_object|table_object|dict_object|unknown|tbd)$/i.test(raw);
}

function sanitizeVisibleFieldLabel(value: unknown) {
  const raw = extractFieldDisplayText(value);
  if (!raw) return "";
  if (isPlaceholderFieldToken(raw)) return "";
  if (/[()（）]/.test(raw)) return "";
  return raw;
}

function sanitizeVisibleKeyInfoItem(value: unknown) {
  const raw = extractKeyInfoItemText(value);
  if (!raw) return "";
  if (isPlaceholderFieldToken(raw)) return "";
  if (/[()（）]/.test(raw)) return "";
  if (!hasChineseText(raw) && /^[A-Za-z0-9_]+$/.test(raw)) return "";
  return raw;
}

function normalizeVisibleFieldArray(value: unknown) {
  return Array.from(new Set(safeArray(value).map((item) => sanitizeVisibleFieldLabel(item)).filter(Boolean)));
}

function normalizeVisibleKeyInfoArray(value: unknown) {
  return Array.from(new Set(safeArray(value).map((item) => sanitizeVisibleKeyInfoItem(item)).filter(Boolean)));
}

const IDENTIFIER_TOKEN_LABELS: Record<string, string> = {
  id: "主键",
  no: "编号",
  code: "编码",
  name: "名称",
  type: "类型",
  status: "状态",
  state: "状态",
  date: "日期",
  time: "时间",
  amount: "金额",
  value: "数值",
  level: "等级",
  rate: "比率",
  ratio: "比例",
  flag: "标记",
  start: "开始",
  end: "结束",
  currency: "币种",
  account: "账户",
  archive: "归档",
  audit: "审计",
  ledger: "台账",
  business: "业务",
  record: "记录",
  rule: "规则",
  standard: "标准",
  issuing: "发布",
  authority: "机构",
  effective: "生效",
  expiry: "失效",
  applicable: "适用",
  scope: "范围",
  compliance: "合规",
  requirement: "要求",
  version: "版本",
  attachment: "附件",
  url: "链接",
  collateral: "抵押物",
  ownership: "权属",
  certificate: "证书",
  appraisal: "评估",
  agency: "机构",
  pledge: "质押",
  risk: "风险",
  warning: "预警",
  disposal: "处置",
  product: "产品",
  investor: "投资者",
  subscription: "认购",
  confirmed: "确认",
  share: "份额",
  payment: "支付",
  distribution: "分配",
  counterparty: "交易对手",
};

function containsChineseText(value: unknown) {
  return /[\u4e00-\u9fff]/.test(String(value || ""));
}

function normalizeIdentifierTokens(value: unknown) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function translateIdentifierToChinese(value: unknown) {
  const tokens = normalizeIdentifierTokens(value);
  if (tokens.length === 0) return String(value || "").trim();
  const labels: string[] = [];
  tokens.forEach((token) => {
    const label = IDENTIFIER_TOKEN_LABELS[token] || token.toUpperCase();
    if (!label) return;
    if (labels[labels.length - 1] !== label) {
      labels.push(label);
    }
  });
  return labels.join("");
}

function formatKeyInfoDisplay(value: unknown) {
  const raw = extractKeyInfoItemText(value);
  if (!raw) return "";
  if (containsChineseText(raw)) return raw;
  const translated = translateIdentifierToChinese(raw);
  if (!translated || translated === raw) return raw;
  return `${translated} (${raw})`;
}

function hasTag(tags: string[] | undefined, target: string) {
  return (tags || []).includes(target);
}

function getTagValue(tags: string[] | undefined, prefix: string) {
  return (tags || []).find((item) => item.startsWith(`${prefix}:`))?.slice(prefix.length + 1) || "";
}

function normalizeTableDetails(value: unknown): TableDetailRecord[] {
  return safeArray(value).map((item) => {
    if (typeof item === "string") {
      const tableName = String(item).trim();
      return {
        tableName,
        tableLabel: null,
        tableComment: null,
        tableSummary: null,
        fields: [],
        keyInfoItems: [],
        sourceRefs: [],
      };
    }
    const entry = safeObject(item);
    return {
      tableName: String(entry.tableName || "").trim(),
      tableLabel: String(entry.tableLabel || entry.tableNameZh || entry.label || "").trim() || null,
      tableComment: String(entry.tableComment || entry.comment || entry.description || "").trim() || null,
      tableSummary: String(entry.tableSummary || entry.summary || entry.businessSummary || "").trim() || null,
      fields: normalizeVisibleFieldArray(entry.fields),
      keyInfoItems: normalizeVisibleKeyInfoArray(entry.keyInfoItems || entry.keyFields || entry.keyColumns || entry.fields),
      sourceRefs: normalizeStringArray(entry.sourceRefs || entry.evidenceRefs),
    };
  }).filter((item) => item.tableName);
}

function extractFieldSemanticsMap(record?: LabIndustryIncubationRecord | null) {
  const standardAssets = safeObject(record?.standardAssets);
  const fieldSemantics = safeArray(standardAssets.fieldSemantics);
  const map = new Map<string, string[]>();
  fieldSemantics.forEach((item) => {
    const entry = safeObject(item);
    const tableName = String(entry.tableName || "").trim();
    const fieldName = sanitizeVisibleFieldLabel(entry.fieldLabel || entry.fieldComment || entry.fieldName || "");
    if (!tableName || !fieldName) return;
    if (!map.has(tableName)) map.set(tableName, []);
    map.get(tableName)!.push(fieldName);
  });
  return new Map(Array.from(map.entries()).map(([key, values]) => [key, Array.from(new Set(values))]));
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function industryLabel(value?: string | null) {
  return INDUSTRY_OPTIONS.find((item) => item.value === value)?.label || value || "-";
}

function statusTag(value?: string) {
  const color = value === "active" ? "green" : value === "draft" ? "gold" : "default";
  return <Tag color={color}>{value || "-"}</Tag>;
}

function getRunState(record?: LabIndustryIncubationRecord | null) {
  return safeObject(record?.trainingSettings && safeObject(record.trainingSettings).runState);
}

function extractCategories(record?: LabIndustryIncubationRecord | null): CategoryRecord[] {
  const standardAssets = safeObject(record?.standardAssets);
  const researchCatalog = safeObject(standardAssets.researchCatalog);
  const fieldSemanticsMap = extractFieldSemanticsMap(record);
  return safeArray(researchCatalog.categoryTree).map((item) => ({
    categoryCode: String(item.categoryCode || "").trim(),
    categoryName: String(item.categoryName || "").trim(),
    description: String(item.description || "").trim() || null,
    tableScopes: normalizeStringArray(item.tableScopes),
    tableDetails: normalizeTableDetails(item.tableDetails),
    sourceRefs: normalizeStringArray(item.sourceRefs),
    lastRoundNo: Number(item.lastRoundNo || 0) || undefined,
  })).map((item) => ({
    ...item,
    tableScopes: item.tableDetails.length > 0 ? item.tableDetails.map((entry) => entry.tableName) : item.tableScopes,
    tableDetails: item.tableDetails.length > 0
      ? item.tableDetails.map((entry) => ({
        ...entry,
        keyInfoItems: Array.from(new Set([...(entry.keyInfoItems || []), ...(fieldSemanticsMap.get(entry.tableName) || [])])),
      }))
      : item.tableScopes.map((tableName) => ({
        tableName,
        tableLabel: null,
        tableComment: null,
        tableSummary: null,
        fields: [],
        keyInfoItems: fieldSemanticsMap.get(tableName) || [],
        sourceRefs: item.sourceRefs,
      })),
  })).filter((item) => item.categoryCode && item.categoryName);
}

function extractDictionaries(record?: LabIndustryIncubationRecord | null): DictionaryItemRecord[] {
  const standardAssets = safeObject(record?.standardAssets);
  const result: DictionaryItemRecord[] = [];
  safeArray(standardAssets.dictionaries).forEach((entry) => {
    const dictType = String(entry.dictType || entry.dict_type || "").trim();
    const dictName = String(entry.dictName || entry.dict_name || entry.name || dictType || "").trim() || null;
    const entryCategoryCode = entry.categoryCode || entry.category_code ? String(entry.categoryCode || entry.category_code).trim() : null;
    const entrySourceRefs = normalizeStringArray(entry.sourceRefs || entry.source_refs);
    const groupItems = safeArray(entry.items);

    if (groupItems.length > 0) {
      groupItems.forEach((item, index) => {
        if (typeof item === "string") {
          result.push({
            dictType,
            dictName,
            itemCode: String(index + 1).padStart(2, "0"),
            itemLabel: String(item).trim(),
            valueRange: null,
            sourceRefs: entrySourceRefs,
            categoryCode: entryCategoryCode,
          });
          return;
        }
        const itemValue = safeObject(item.itemValue);
        result.push({
          dictType,
          dictName,
          itemCode: String(item.itemCode || item.item_code || index + 1).trim(),
          itemLabel: String(item.itemLabel || item.item_label || item.itemName || item.item_name || "").trim(),
          valueRange: String(itemValue.valueRange || item.valueRange || item.value_range || "").trim() || null,
          sourceRefs: normalizeStringArray(item.sourceRefs || item.source_refs || itemValue.sourceRefs || entrySourceRefs),
          categoryCode: item.categoryCode || item.category_code ? String(item.categoryCode || item.category_code).trim() : entryCategoryCode,
        });
      });
      return;
    }

    const itemValue = safeObject(entry.itemValue);
    result.push({
      dictType,
      dictName: String(itemValue.dictName || dictName || dictType || "").trim() || null,
      itemCode: String(entry.itemCode || entry.item_code || "").trim(),
      itemLabel: String(entry.itemLabel || entry.item_label || "").trim(),
      valueRange: String(itemValue.valueRange || entry.valueRange || entry.value_range || "").trim() || null,
      sourceRefs: normalizeStringArray(entry.sourceRefs || entry.source_refs || itemValue.sourceRefs),
      categoryCode: entryCategoryCode,
    });
  });
  return result.filter((item) => item.dictType && item.itemCode && item.itemLabel);
}

function extractEvidence(record?: LabIndustryIncubationRecord | null): EvidenceRecord[] {
  const evidenceCatalog = safeObject(record?.evidenceCatalog);
  return safeArray(evidenceCatalog.items).map((item, index) => ({
    id: String(item.id || `evidence_${index + 1}`),
    title: String(item.title || "").trim(),
    authority: String(item.authority || "").trim() || "-",
    sourceUrl: String(item.sourceUrl || "").trim(),
    sourceType: String(item.sourceType || "").trim() || "-",
    publishedAt: item.publishedAt ? String(item.publishedAt) : null,
    summary: String(item.summary || "").trim(),
  })).filter((item) => item.title || item.summary);
}

function buildDictionaryGroups(items: DictionaryItemRecord[]) {
  const groups = new Map<string, DictionaryGroupRecord>();
  items.forEach((item) => {
    if (!groups.has(item.dictType)) {
      groups.set(item.dictType, {
        dictType: item.dictType,
        dictName: item.dictName || item.dictType,
        items: [],
        sourceRefs: [],
      });
    }
    const current = groups.get(item.dictType)!;
    current.items.push(item);
    current.sourceRefs = Array.from(new Set([...(current.sourceRefs || []), ...(item.sourceRefs || [])]));
  });
  return Array.from(groups.values()).sort((a, b) => a.dictType.localeCompare(b.dictType));
}

function buildRows(records: LabIndustryIncubationRecord[]) {
  return records.map((record) => ({
    key: `industry-${record.id}`,
    rowType: "industry" as const,
    parentId: record.id,
    incubation: record,
    children: extractCategories(record).map((category) => ({
      key: `industry-${record.id}-${category.categoryCode}`,
      rowType: "category" as const,
      parentId: record.id,
      incubation: record,
      category,
    })),
  }));
}

function dedupeTableDetails(items: TableDetailRecord[]) {
  const map = new Map<string, TableDetailRecord>();
  items.forEach((item) => {
    if (!item.tableName) return;
    const existing = map.get(item.tableName);
    if (!existing) {
      map.set(item.tableName, {
        ...item,
        fields: Array.from(new Set(item.fields || [])),
        keyInfoItems: Array.from(new Set(item.keyInfoItems || [])),
        sourceRefs: Array.from(new Set(item.sourceRefs || [])),
      });
      return;
    }
    map.set(item.tableName, {
      ...existing,
      ...item,
      fields: Array.from(new Set([...(existing.fields || []), ...(item.fields || [])])),
      keyInfoItems: Array.from(new Set([...(existing.keyInfoItems || []), ...(item.keyInfoItems || [])])),
      sourceRefs: Array.from(new Set([...(existing.sourceRefs || []), ...(item.sourceRefs || [])])),
    });
  });
  return Array.from(map.values());
}

function buildStandardAssetsWithCategories(
  standardAssets: Record<string, unknown>,
  nextCategoryTree: Record<string, unknown>[],
  nextDictionaries?: Record<string, unknown>[]
) {
  const researchCatalog = safeObject(standardAssets.researchCatalog);
  const allTableDetails = dedupeTableDetails(
    nextCategoryTree.flatMap((item) => normalizeTableDetails(safeObject(item).tableDetails || safeObject(item).tableScopes || []))
  );
  return {
    ...standardAssets,
    researchCatalog: {
      ...researchCatalog,
      categoryTree: nextCategoryTree,
      candidateTables: allTableDetails.map((item) => item.tableName),
      candidateTableSpecs: allTableDetails,
    },
    standardTables: allTableDetails.map((item) => item.tableName),
    ...(nextDictionaries ? { dictionaries: nextDictionaries } : {}),
  };
}

function inferKeyInfoItems(table: TableDetailRecord) {
  const normalizedKeyInfoItems = normalizeVisibleKeyInfoArray(table.keyInfoItems);
  if (normalizedKeyInfoItems.length > 0) {
    return normalizedKeyInfoItems;
  }
  const normalizedFields = normalizeVisibleFieldArray(table.fields);
  if (normalizedFields.length > 0) {
    return normalizedFields.slice(0, 16);
  }
  const haystack = `${table.tableName} ${table.tableLabel || ""} ${table.tableSummary || ""} ${table.tableComment || ""}`.toLowerCase();
  const result = ["编号", "名称"];
  if (/(status|state|状态|结果)/.test(haystack)) result.push("状态");
  if (/(time|date|时间|日期)/.test(haystack)) result.push("时间");
  if (/(plan|预案|方案)/.test(haystack)) result.push("适用范围", "响应级别");
  if (/(record|log|记录|日志|申诉|处罚)/.test(haystack)) result.push("处理结果", "办理机构");
  if (/(resource|inventory|asset|资源|物资|资产)/.test(haystack)) result.push("资源类型", "数量", "位置");
  if (/(team|队伍|人员)/.test(haystack)) result.push("所属机构", "联系方式");
  if (/(dispatch|调度|指挥)/.test(haystack)) result.push("调度对象", "执行状态");
  if (/(monitor|监测|预警)/.test(haystack)) result.push("监测值", "预警级别");
  if (/(evaluation|assessment|评估|考核)/.test(haystack)) result.push("评分结果", "评估时间");
  return Array.from(new Set(result));
}

function formatFieldListPreview(fields: string[]) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return "-";
  }
  if (fields.length <= 4) {
    return fields.join("、");
  }
  return `${fields.slice(0, 4).join("、")} 等 ${fields.length} 个字段`;
}

function resolveTableFieldList(table?: TableDetailRecord | null) {
  const normalizedFields = normalizeVisibleFieldArray(table?.fields);
  if (normalizedFields.length > 0) {
    return normalizedFields;
  }
  const normalizedKeyInfoItems = normalizeVisibleKeyInfoArray(table?.keyInfoItems);
  if (normalizedKeyInfoItems.length > 0) {
    return normalizedKeyInfoItems;
  }
  return inferKeyInfoItems(table || {
    tableName: "",
    tableLabel: null,
    tableComment: null,
    tableSummary: null,
    fields: [],
    keyInfoItems: [],
    sourceRefs: [],
  });
}

function renderTableTextCell(value?: string | null, rows = 3) {
  const text = String(value || "").trim();
  if (!text) {
    return "-";
  }
  const maxTagCount = Math.max(4, rows * 3);
  return (
    <Typography.Paragraph
      style={{ marginBottom: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      ellipsis={{ rows, expandable: true, symbol: "展开" }}
    >
      {text}
    </Typography.Paragraph>
  );
}

function renderTableListCell(items: string[], color: string, rows = 2) {
  if (!Array.isArray(items) || items.length === 0) {
    return "-";
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Typography.Paragraph
        style={{ marginBottom: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        ellipsis={{ rows, expandable: true, symbol: "展开" }}
      >
        {items.join("、")}
      </Typography.Paragraph>
      <Space size={[4, 4]} wrap>
        {items.slice(0, 6).map((item) => <Tag key={item} color={color} style={{ marginInlineEnd: 0 }}>{item}</Tag>)}
        {items.length > 6 ? <Tag style={{ marginInlineEnd: 0 }}>+{items.length - 6}</Tag> : null}
      </Space>
    </div>
  );
}

function renderTableTagCell(items: string[], color: string, rows = 2) {
  if (!Array.isArray(items) || items.length === 0) {
    return "-";
  }
  const maxTagCount = Math.max(4, rows * 3);
  return (
    <Space size={[4, 4]} wrap>
      {items.slice(0, maxTagCount).map((item) => <Tag key={item} color={color} style={{ marginInlineEnd: 0 }}>{item}</Tag>)}
      {items.length > maxTagCount ? <Tag style={{ marginInlineEnd: 0 }}>+{items.length - maxTagCount}</Tag> : null}
    </Space>
  );
}

function serializeFieldText(fields: string[]) {
  return (Array.isArray(fields) ? fields : []).join("\n");
}

function parseFieldText(value: unknown) {
  return Array.from(new Set(
    String(value || "")
      .split(/[\r\n,，]/)
      .map((item) => sanitizeVisibleFieldLabel(item))
      .filter(Boolean)
  ));
}

function toFormValues(record?: LabIndustryIncubationRecord | null): IncubationFormValues {
  const languagePolicy = safeObject(record?.languagePolicy);
  const autoResearchPolicy = safeObject(record?.autoResearchPolicy);
  const preferredDomains = normalizeStringArray(autoResearchPolicy.preferredDomains).length > 0
    ? normalizeStringArray(autoResearchPolicy.preferredDomains)
    : normalizeStringArray(languagePolicy.sourceDomainWhitelist);
  return {
    incubationName: record?.incubationName || "",
    incubationCode: record?.incubationCode || "",
    industryCode: record?.industryCode || "",
    incubationDesc: record?.incubationDesc || "",
    domesticOnly: languagePolicy.domesticOnly !== false,
    standardFirst: autoResearchPolicy.standardFirst !== false,
    sourceTypes: normalizeStringArray(autoResearchPolicy.sourceTypes).length > 0 ? normalizeStringArray(autoResearchPolicy.sourceTypes) : [...EVIDENCE_SOURCE_OPTIONS],
    preferredDomains: record ? preferredDomains : (preferredDomains.length > 0 ? preferredDomains : [...DEFAULT_PREFERRED_DOMAINS]),
    requiredKeywords: normalizeStringArray(autoResearchPolicy.requiredKeywords),
  };
}

function getCategoryStats(stats: LabIndustryIncubationStatsRecord | null, categoryCode?: string) {
  return stats?.categories?.find((item) => item.categoryCode === categoryCode) || null;
}

function buildKnowledgeSyncMap(records: SystemKnowledgeBaseRecord[]) {
  const result: Record<string, KnowledgeSyncRecord> = {};
  records
    .filter((item) => hasTag(item.tags, "scope:industry_category"))
    .forEach((item) => {
      const incubationId = getTagValue(item.tags, "incubation");
      const categoryCode = getTagValue(item.tags, "category");
      if (!incubationId || !categoryCode) return;
      result[`${incubationId}:${categoryCode}`] = {
        kbId: item.id,
        kbName: item.kbName,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
        documentCount: item.documentCount,
        status: item.status,
      };
    });
  return result;
}

export function DataLabIndustryIncubationPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<LabIndustryIncubationRecord[]>([]);
  const [statsMap, setStatsMap] = useState<Record<number, LabIndustryIncubationStatsRecord>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>();
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runTarget, setRunTarget] = useState<RowRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<LabIndustryIncubationRecord | null>(null);
  const [detailStats, setDetailStats] = useState<LabIndustryIncubationStatsRecord | null>(null);
  const [detailCategoryCode, setDetailCategoryCode] = useState<string | null>(null);
  const [knowledgeSyncMap, setKnowledgeSyncMap] = useState<Record<string, KnowledgeSyncRecord>>({});
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logRows, setLogRows] = useState<LabIndustryIncubationLogRecord[]>([]);
  const [logTarget, setLogTarget] = useState<LabIndustryIncubationRecord | null>(null);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [categoryEditContext, setCategoryEditContext] = useState<CategoryEditContext | null>(null);
  const [tableEditorOpen, setTableEditorOpen] = useState(false);
  const [tableEditing, setTableEditing] = useState<TableDetailRecord | null>(null);
  const [tableFieldViewer, setTableFieldViewer] = useState<TableDetailRecord | null>(null);
  const [dictionaryEditorOpen, setDictionaryEditorOpen] = useState(false);
  const [dictionaryEditing, setDictionaryEditing] = useState<DictionaryGroupRecord | null>(null);
  const loadInFlightRef = useRef(false);
  const [form] = Form.useForm<IncubationFormValues>();
  const [runForm] = Form.useForm<RunFormValues>();
  const [categoryForm] = Form.useForm<CategoryEditFormValues>();
  const [tableForm] = Form.useForm<TableEditFormValues>();
  const [dictionaryForm] = Form.useForm<DictionaryEditFormValues>();

  const treeRows = useMemo(() => buildRows(records), [records]);
  const detailCategories = useMemo(() => extractCategories(detailRecord), [detailRecord]);
  const activeDetailCategory = useMemo(
    () => detailCategoryCode ? detailCategories.find((item) => item.categoryCode === detailCategoryCode) || null : null,
    [detailCategories, detailCategoryCode]
  );
  const detailDictionaries = useMemo(() => {
    const all = extractDictionaries(detailRecord);
    return activeDetailCategory ? all.filter((item) => item.categoryCode === activeDetailCategory.categoryCode) : all;
  }, [detailRecord, activeDetailCategory]);
  const detailDictionaryGroups = useMemo(() => buildDictionaryGroups(detailDictionaries), [detailDictionaries]);
  const detailPublicDictionaryGroups = useMemo(
    () => buildDictionaryGroups(extractDictionaries(detailRecord).filter((item) => !item.categoryCode)),
    [detailRecord]
  );
  const activeDetailTables = useMemo(
    () => activeDetailCategory?.tableDetails || [],
    [activeDetailCategory]
  );
  const activeCategorySync = useMemo(() => {
    if (!detailRecord || !detailCategoryCode) return null;
    return knowledgeSyncMap[`${detailRecord.id}:${detailCategoryCode}`] || null;
  }, [detailRecord, detailCategoryCode, knowledgeSyncMap]);
  const detailEvidence = useMemo(() => {
    const all = extractEvidence(detailRecord);
    if (!activeDetailCategory) return all;
    const refs = new Set([
      ...(activeDetailCategory.sourceRefs || []),
      ...((activeDetailCategory.tableDetails || []).flatMap((item) => item.sourceRefs || [])),
    ]);
    if (refs.size === 0) {
      return all;
    }
    return all.filter((item) => refs.has(item.id));
  }, [detailRecord, activeDetailCategory]);
  const hasActiveRuns = useMemo(
    () => records.some((item) => {
      const status = String(getRunState(item).status || "");
      return status === "running" || status === "stopping";
    }),
    [records]
  );

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!token || loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const [response, knowledgeBaseResponse] = await Promise.all([
        fetchIndustryIncubations(token),
        fetchSystemKnowledgeBases(token).catch(() => null),
      ]);
      setRecords(response.data);
      const statsEntries = await Promise.all(
        response.data.map(async (item) => {
          try {
            const stat = await fetchIndustryIncubationStats(token, item.id);
            return [item.id, stat.data] as const;
          } catch {
            return [item.id, null] as const;
          }
        })
      );
      setStatsMap(Object.fromEntries(statsEntries.filter((entry) => entry[1])) as Record<number, LabIndustryIncubationStatsRecord>);
      setKnowledgeSyncMap(buildKnowledgeSyncMap(knowledgeBaseResponse?.data || []));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "行业孵化列表加载失败");
    } finally {
      loadInFlightRef.current = false;
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!token || !hasActiveRuns) return undefined;
    const timer = window.setInterval(() => {
      void loadData({ silent: true });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hasActiveRuns, loadData, token]);

  function openCreate() {
    setEditingId(undefined);
    form.resetFields();
    form.setFieldsValue(toFormValues(null));
    setEditorOpen(true);
  }

  async function openEdit(id: number) {
    if (!token) return;
    const response = await fetchIndustryIncubationDetail(token, id);
    setEditingId(id);
    form.resetFields();
    form.setFieldsValue(toFormValues(response.data));
    setEditorOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await saveIndustryIncubation(token, {
        id: editingId,
        incubationName: values.incubationName,
        incubationCode: values.incubationCode,
        industryCode: values.industryCode?.trim() || undefined,
        incubationDesc: values.incubationDesc,
        languagePolicy: {
          locale: "zh-CN",
          domesticOnly: values.domesticOnly !== false,
          allowedCurrencies: ["CNY", "人民币"],
          forbiddenForeignTerms: [],
          requiredChineseLabels: true,
          sourceDomainWhitelist: normalizeStringArray(values.preferredDomains),
          forbiddenForeignRegions: [],
        },
        autoResearchPolicy: {
          sourceTypes: normalizeStringArray(values.sourceTypes),
          domesticOnly: values.domesticOnly !== false,
          standardFirst: values.standardFirst !== false,
          preferredDomains: normalizeStringArray(values.preferredDomains),
          requiredKeywords: normalizeStringArray(values.requiredKeywords),
          researchNotes: "",
        },
      });
      message.success(editingId ? "行业配置已更新" : "行业配置已创建");
      setEditorOpen(false);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存行业配置失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record: LabIndustryIncubationRecord) {
    if (!token) return;
    try {
      await deleteIndustryIncubation(token, record.id);
      message.success("行业配置已删除");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除行业配置失败");
    }
  }

  function openRunModal(target: RowRecord) {
    setRunTarget(target);
    runForm.resetFields();
    runForm.setFieldsValue({ roundCount: 1 });
    setRunModalOpen(true);
  }

  async function handleRunSubmit() {
    if (!token || !runTarget) return;
    const values = await runForm.validateFields();
    const key = runTarget.rowType === "industry"
      ? `run-start-${runTarget.parentId}`
      : `run-start-${runTarget.parentId}-${runTarget.category?.categoryCode || "category"}`;
    setActionKey(key);
    setRunSubmitting(true);
    try {
      await startIndustryIncubationRun(token, runTarget.parentId, {
        roundCount: Number(values.roundCount || 1),
        categoryCode: runTarget.rowType === "category" ? runTarget.category?.categoryCode : undefined,
        categoryName: runTarget.rowType === "category" ? runTarget.category?.categoryName : undefined,
      });
      setRunModalOpen(false);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "启动任务失败");
    } finally {
      setRunSubmitting(false);
      setActionKey(null);
    }
  }

  async function handleStop(record: LabIndustryIncubationRecord) {
    if (!token) return;
    const key = `run-stop-${record.id}`;
    setActionKey(key);
    try {
      await stopIndustryIncubationRun(token, record.id);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "停止任务失败");
    } finally {
      setActionKey(null);
    }
  }

  async function handleSyncKnowledgeBase(row: RowRecord) {
    if (!token || row.rowType !== "category" || !row.category) return;
    const key = `sync-kb-${row.parentId}-${row.category.categoryCode}`;
    setActionKey(key);
    try {
      await syncIncubationKnowledgeBase(token, row.parentId, { categoryCode: row.category.categoryCode });
      message.success("子类目知识库已同步");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "同步知识库失败");
    } finally {
      setActionKey(null);
    }
  }

  async function openDetail(row: RowRecord) {
    if (!token) return;
    const [detailResponse, statsResponse] = await Promise.all([
      fetchIndustryIncubationDetail(token, row.parentId),
      fetchIndustryIncubationStats(token, row.parentId).catch(() => null),
    ]);
    setDetailRecord(detailResponse.data);
    setDetailStats(statsResponse?.data || null);
    setDetailCategoryCode(row.rowType === "category" ? row.category?.categoryCode || null : null);
    setDetailOpen(true);
  }

  async function openLogs(record: LabIndustryIncubationRecord) {
    if (!token) return;
    setLogsLoading(true);
    try {
      const response = await fetchIndustryIncubationLogs(token, record.id);
      setLogRows(response.data || []);
      setLogTarget(record);
      setLogsOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "日志加载失败");
    } finally {
      setLogsLoading(false);
    }
  }

  async function persistStandardAssets(standardAssets: Record<string, unknown>) {
    if (!token || !detailRecord) return;
    setSaving(true);
    try {
      await saveIndustryIncubation(token, {
        id: detailRecord.id,
        incubationName: detailRecord.incubationName,
        incubationCode: detailRecord.incubationCode,
        industryCode: detailRecord.industryCode,
        incubationDesc: detailRecord.incubationDesc || undefined,
        standardAssets,
      });
      const [detailResponse, statsResponse] = await Promise.all([
        fetchIndustryIncubationDetail(token, detailRecord.id),
        fetchIndustryIncubationStats(token, detailRecord.id).catch(() => null),
      ]);
      setDetailRecord(detailResponse.data);
      setDetailStats(statsResponse?.data || null);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function openCategoryEditor(target?: { incubationId: number; category: CategoryRecord } | null) {
    const targetCategory = target?.category || activeDetailCategory;
    const targetIncubationId = target?.incubationId || detailRecord?.id;
    if (!token || !targetCategory || !targetIncubationId) return;
    if (!detailRecord || detailRecord.id !== targetIncubationId) {
      const [detailResponse, statsResponse] = await Promise.all([
        fetchIndustryIncubationDetail(token, targetIncubationId),
        fetchIndustryIncubationStats(token, targetIncubationId).catch(() => null),
      ]);
      setDetailRecord(detailResponse.data);
      setDetailStats(statsResponse?.data || null);
      setDetailCategoryCode(targetCategory.categoryCode);
    } else {
      setDetailCategoryCode(targetCategory.categoryCode);
    }
    categoryForm.setFieldsValue({
      categoryCode: targetCategory.categoryCode,
      categoryName: targetCategory.categoryName,
      description: targetCategory.description || "",
      tableScopes: targetCategory.tableScopes,
    });
    setCategoryEditContext({
      incubationId: targetIncubationId,
      originalCategoryCode: targetCategory.categoryCode,
    });
    setCategoryEditorOpen(true);
  }

  async function handleCategorySave() {
    if (!detailRecord || !categoryEditContext) return;
    const values = await categoryForm.validateFields();
    const standardAssets = safeObject(detailRecord.standardAssets);
    const researchCatalog = safeObject(standardAssets.researchCatalog);
    const originalCategoryCode = categoryEditContext.originalCategoryCode;
    const nextCategoryTree = safeArray(researchCatalog.categoryTree).map((item) => {
      if (String(item.categoryCode || "").trim() !== originalCategoryCode) {
        return item;
      }
      const current = safeObject(item);
      const currentDetails = normalizeTableDetails(current.tableDetails);
      const allowedScopes = new Set(values.tableScopes || []);
      const nextTableDetails = currentDetails.filter((entry) => allowedScopes.size === 0 || allowedScopes.has(entry.tableName));
      return {
        ...item,
        categoryCode: values.categoryCode,
        categoryName: values.categoryName,
        description: values.description || null,
        tableScopes: values.tableScopes || [],
        tableDetails: nextTableDetails,
      };
    });
    const nextDictionaries = extractDictionaries(detailRecord).map((item) => {
      if (item.categoryCode !== originalCategoryCode) return item;
      return {
        ...item,
        categoryCode: values.categoryCode,
        categoryName: values.categoryName,
        itemValue: {
          dictName: item.dictName || item.dictType,
          valueRange: item.valueRange || null,
          sourceRefs: item.sourceRefs || [],
        },
      };
    });
    await persistStandardAssets(buildStandardAssetsWithCategories(standardAssets, nextCategoryTree, nextDictionaries));
    setDetailCategoryCode(values.categoryCode);
    setCategoryEditContext(null);
    setCategoryEditorOpen(false);
    message.success("子类目已更新");
  }

  async function handleDeleteCategory(row: RowRecord) {
    if (!token || row.rowType !== "category" || !row.category) return;
    const detailResponse = await fetchIndustryIncubationDetail(token, row.parentId);
    const record = detailResponse.data;
    const standardAssets = safeObject(record.standardAssets);
    const researchCatalog = safeObject(standardAssets.researchCatalog);
    const nextCategoryTree = safeArray(researchCatalog.categoryTree).filter((item) => String(item.categoryCode || "").trim() !== row.category?.categoryCode);
    const nextDictionaries = extractDictionaries(record).filter((item) => item.categoryCode !== row.category?.categoryCode);
    const payload = buildStandardAssetsWithCategories(standardAssets, nextCategoryTree, nextDictionaries);
    setSaving(true);
    try {
      await saveIndustryIncubation(token, {
        id: record.id,
        incubationName: record.incubationName,
        incubationCode: record.incubationCode,
        industryCode: record.industryCode,
        incubationDesc: record.incubationDesc || undefined,
        standardAssets: payload,
      });
      if (detailRecord?.id === record.id && detailCategoryCode === row.category.categoryCode) {
        setDetailOpen(false);
        setDetailRecord(null);
        setDetailStats(null);
        setDetailCategoryCode(null);
      }
      await loadData();
      message.success("子类目已删除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除子类目失败");
    } finally {
      setSaving(false);
    }
  }

  function openTableEditor(table?: TableDetailRecord | null) {
    if (!activeDetailCategory) return;
    const fallbackTable: TableDetailRecord = table || {
      tableName: "",
      tableLabel: null,
      tableComment: null,
      tableSummary: null,
      fields: [],
      keyInfoItems: [],
      sourceRefs: [],
    };
    tableForm.resetFields();
    tableForm.setFieldsValue({
      tableName: fallbackTable.tableName || "",
      tableComment: fallbackTable.tableLabel || "",
      tableSummary: fallbackTable.tableSummary || fallbackTable.tableComment || "",
      fieldsText: serializeFieldText(fallbackTable.fields?.length ? fallbackTable.fields : inferKeyInfoItems(fallbackTable)),
      keyInfoItems: fallbackTable.keyInfoItems?.length ? fallbackTable.keyInfoItems : inferKeyInfoItems(fallbackTable),
    });
    setTableEditing(table || null);
    setTableEditorOpen(true);
  }

  async function handleTableSave() {
    if (!detailRecord || !activeDetailCategory) return;
    const values = await tableForm.validateFields();
    const nextTable: TableDetailRecord = {
      tableName: String(values.tableName || "").trim(),
      tableLabel: String(values.tableComment || "").trim() || null,
      tableComment: String(values.tableSummary || "").trim() || null,
      tableSummary: String(values.tableSummary || "").trim() || null,
      fields: parseFieldText(values.fieldsText),
      keyInfoItems: normalizeVisibleKeyInfoArray(values.keyInfoItems),
      sourceRefs: tableEditing?.sourceRefs || activeDetailCategory.sourceRefs || [],
    };
    const standardAssets = safeObject(detailRecord.standardAssets);
    const researchCatalog = safeObject(standardAssets.researchCatalog);
    const nextCategoryTree = safeArray(researchCatalog.categoryTree).map((item) => {
      if (String(item.categoryCode || "").trim() !== activeDetailCategory.categoryCode) {
        return item;
      }
      const currentCategory = extractCategories({ ...detailRecord, standardAssets: { ...standardAssets, researchCatalog: { ...researchCatalog, categoryTree: [item] } } } as LabIndustryIncubationRecord)[0];
      const currentDetails = currentCategory?.tableDetails || [];
      const filtered = currentDetails.filter((entry) => entry.tableName !== tableEditing?.tableName);
      const nextDetails = dedupeTableDetails([...filtered, nextTable]);
      return {
        ...item,
        tableScopes: nextDetails.map((entry) => entry.tableName),
        tableDetails: nextDetails,
      };
    });
    const nextAllTableDetails = dedupeTableDetails(
      nextCategoryTree.flatMap((item) => normalizeTableDetails(item.tableDetails || item.tableScopes || []))
    );
    await persistStandardAssets({
      ...standardAssets,
      researchCatalog: {
        ...researchCatalog,
        categoryTree: nextCategoryTree,
        candidateTables: nextAllTableDetails.map((item) => item.tableName),
        candidateTableSpecs: nextAllTableDetails,
      },
      standardTables: nextAllTableDetails.map((item) => item.tableName),
    });
    setTableEditorOpen(false);
    setTableEditing(null);
    message.success("表信息已更新");
  }

  async function handleDeleteTable(table: TableDetailRecord) {
    if (!detailRecord || !activeDetailCategory) return;
    const standardAssets = safeObject(detailRecord.standardAssets);
    const researchCatalog = safeObject(standardAssets.researchCatalog);
    const nextCategoryTree = safeArray(researchCatalog.categoryTree).map((item) => {
      if (String(item.categoryCode || "").trim() !== activeDetailCategory.categoryCode) {
        return item;
      }
      const currentCategory = extractCategories({ ...detailRecord, standardAssets: { ...standardAssets, researchCatalog: { ...researchCatalog, categoryTree: [item] } } } as LabIndustryIncubationRecord)[0];
      const currentDetails = currentCategory?.tableDetails || [];
      const nextDetails = currentDetails.filter((entry) => entry.tableName !== table.tableName);
      return {
        ...item,
        tableScopes: nextDetails.map((entry) => entry.tableName),
        tableDetails: nextDetails,
      };
    });
    await persistStandardAssets(buildStandardAssetsWithCategories(standardAssets, nextCategoryTree));
    if (tableEditing?.tableName === table.tableName) {
      setTableEditorOpen(false);
      setTableEditing(null);
    }
    message.success("表信息已删除");
  }

  function openDictionaryEditor(group: DictionaryGroupRecord) {
    dictionaryForm.setFieldsValue({
      dictName: group.dictName || group.dictType,
      valuesText: group.items.map((item) => `${item.itemCode},${item.itemLabel}${item.valueRange ? `,${item.valueRange}` : ""}`).join("\n"),
    });
    setDictionaryEditing(group);
    setDictionaryEditorOpen(true);
  }

  async function handleDictionarySave() {
    if (!detailRecord || !dictionaryEditing || !activeDetailCategory) return;
    const values = await dictionaryForm.validateFields();
    const lines = String(values.valuesText || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const nextItems = lines.map((line, index) => {
      const [itemCode, itemLabel, valueRange] = line.split(",").map((part) => part.trim());
      return {
        dictType: dictionaryEditing.dictType,
        dictName: values.dictName || dictionaryEditing.dictType,
        itemCode: itemCode || `${index + 1}`,
        itemLabel: itemLabel || itemCode || `${index + 1}`,
        valueRange: valueRange || null,
        sourceRefs: dictionaryEditing.sourceRefs || [],
        categoryCode: activeDetailCategory.categoryCode,
        itemValue: {
          dictName: values.dictName || dictionaryEditing.dictType,
          valueRange: valueRange || null,
          sourceRefs: dictionaryEditing.sourceRefs || [],
        },
      };
    });
    const standardAssets = safeObject(detailRecord.standardAssets);
    const existingDictionaries = extractDictionaries(detailRecord).filter((item) => !(item.categoryCode === activeDetailCategory.categoryCode && item.dictType === dictionaryEditing.dictType));
    await persistStandardAssets({
      ...standardAssets,
      dictionaries: [...existingDictionaries, ...nextItems],
    });
    setDictionaryEditorOpen(false);
    setDictionaryEditing(null);
    message.success("字典表已更新");
  }

  const tableFieldViewerModal = (
    <Modal
      open={Boolean(tableFieldViewer)}
      title={tableFieldViewer ? `字段详情 / ${tableFieldViewer.tableName}` : "字段详情"}
      onCancel={() => setTableFieldViewer(null)}
      footer={null}
      destroyOnHidden
    >
      <Table
        rowKey={(record) => `${tableFieldViewer?.tableName || "table"}-${record.index}`}
        size="small"
        pagination={false}
        dataSource={resolveTableFieldList(tableFieldViewer).map((field, index) => ({ index: index + 1, field }))}
        locale={{ emptyText: "暂无字段" }}
        columns={[
          { title: "序号", dataIndex: "index", width: 80 },
          { title: "字段名称", dataIndex: "field" },
        ]}
      />
    </Modal>
  );

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      {tableFieldViewerModal}
      <Card bordered={false}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Title level={3} style={{ margin: 0 }}>行业孵化</Typography.Title>
          <Button type="primary" onClick={openCreate}>新建行业配置</Button>
        </Space>
      </Card>

      <Table
        rowKey="key"
        loading={loading}
        dataSource={treeRows}
        pagination={{ pageSize: 8 }}
        expandable={{ defaultExpandAllRows: false, indentSize: 28 }}
        columns={[
          {
            title: "名称",
            width: 260,
            render: (_: unknown, row: RowRecord) => (
              <div style={{ paddingLeft: row.rowType === "category" ? 20 : 0 }}>
                <Typography.Text strong={row.rowType === "industry"} style={{ whiteSpace: "nowrap", display: "block" }}>
                  {row.rowType === "industry" ? row.incubation.incubationName : row.category?.categoryName}
                </Typography.Text>
              </div>
            ),
          },
          {
            title: "编码",
            width: 220,
            render: (_: unknown, row: RowRecord) => row.rowType === "industry"
              ? `${industryLabel(row.incubation.industryCode)} / ${row.incubation.industryCode}`
              : (row.category?.categoryCode || "-"),
          },
          {
            title: "类型",
            width: 100,
            render: (_: unknown, row: RowRecord) => <Tag color={row.rowType === "industry" ? "blue" : "geekblue"}>{row.rowType === "industry" ? "行业" : "子类目"}</Tag>,
          },
          {
            title: "研究摘要",
            width: 420,
            render: (_: unknown, row: RowRecord) => {
              const stats = statsMap[row.parentId];
              const categoryStats = getCategoryStats(stats || null, row.category?.categoryCode);
              const summary = row.rowType === "industry"
                ? (stats
                  ? `${stats.totals.categoryCount} 个子类目  ${stats.totals.tableCount} 张表  ${stats.totals.dictionaryGroupCount} 个字典表  ${stats.totals.dictionaryItemCount} 个字典项`
                  : "-")
                : (categoryStats
                  ? `${categoryStats.tableCount} 张表  ${categoryStats.dictionaryGroupCount} 个字典表  ${categoryStats.dictionaryItemCount} 个字典项  ${categoryStats.evidenceCount} 条证据`
                  : "-");
              return <Typography.Text style={{ display: "block", lineHeight: 1.8 }}>{summary}</Typography.Text>;
            },
          },
          {
            title: "运行状态",
            width: 260,
            render: (_: unknown, row: RowRecord) => {
              const runState = getRunState(row.incubation);
              const status = String(runState.status || "idle");
              const totalRounds = Number(runState.totalRounds || 0);
              const taskRound = Number(runState.taskCurrentRoundNo || 0);
              const text = row.rowType === "industry"
                ? (status === "running" || status === "stopping" ? `总轮次 ${totalRounds} / 当前轮次 ${taskRound}` : `当前轮次 ${Number(row.incubation.latestRoundNo || 0)}`)
                : ((runState.targetCategoryCode === row.category?.categoryCode && (status === "running" || status === "stopping"))
                  ? `总轮次 ${totalRounds} / 当前轮次 ${taskRound}`
                  : `当前轮次 ${Number(row.category?.lastRoundNo || 0)}`);
              const tag = row.rowType === "category" && runState.targetCategoryCode !== row.category?.categoryCode
                ? (Number(row.category?.lastRoundNo || 0) > 0 ? "completed" : "idle")
                : status;
              return (
                <Space direction="vertical" size={0}>
                  <Typography.Text>{text}</Typography.Text>
                  <Tag color={tag === "running" ? "processing" : tag === "stopping" ? "gold" : "default"}>{tag}</Tag>
                </Space>
              );
            },
          },
          { title: "更新时间", width: 180, render: (_: unknown, row: RowRecord) => formatDateTime(row.incubation.updatedAt) },
          {
            title: "操作",
            width: 480,
            render: (_: unknown, row: RowRecord) => {
              const runState = getRunState(row.incubation);
              const category = row.category;
              const categoryRunning = row.rowType === "category" && runState.targetCategoryCode === row.category?.categoryCode && (String(runState.status || "") === "running" || String(runState.status || "") === "stopping");
              const industryRunning = row.rowType === "industry" && (String(runState.status || "") === "running" || String(runState.status || "") === "stopping");
              const categorySync = row.rowType === "category" && category
                ? knowledgeSyncMap[`${row.parentId}:${category.categoryCode}`]
                : null;
              return (
                <Space direction="vertical" size={4}>
                  <Space wrap>
                    {row.rowType === "industry" ? <Button type="link" onClick={() => void openEdit(row.parentId)}>编辑</Button> : null}
                    {row.rowType === "category" && category ? <Button type="link" onClick={() => void openCategoryEditor({ incubationId: row.parentId, category })}>编辑</Button> : null}
                    {industryRunning || categoryRunning ? (
                      <Button type="link" loading={actionKey === `run-stop-${row.parentId}`} onClick={() => void handleStop(row.incubation)}>停止</Button>
                    ) : (
                      <Button type="link" loading={actionKey === (row.rowType === "industry" ? `run-start-${row.parentId}` : `run-start-${row.parentId}-${row.category?.categoryCode || "category"}`)} onClick={() => openRunModal(row)}>运行</Button>
                    )}
                    <Button type="link" onClick={() => void openDetail(row)}>查看</Button>
                    <Button type="link" onClick={() => void openLogs(row.incubation)}>日志</Button>
                    {row.rowType === "category" && row.category ? (
                      <Button type="link" loading={actionKey === `sync-kb-${row.parentId}-${row.category?.categoryCode || "category"}`} onClick={() => void handleSyncKnowledgeBase(row)}>同步知识库</Button>
                    ) : null}
                    {row.rowType === "industry" ? (
                      <Popconfirm title="确认删除当前行业配置？" onConfirm={() => void handleDelete(row.incubation)}>
                        <Button type="link" danger>删除</Button>
                      </Popconfirm>
                    ) : null}
                    {row.rowType === "category" ? (
                      <Popconfirm title="确认删除当前子类目？" onConfirm={() => void handleDeleteCategory(row)}>
                        <Button type="link" danger>删除</Button>
                      </Popconfirm>
                    ) : null}
                  </Space>
                  {row.rowType === "category" ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {categorySync ? `知识库已同步 · ${formatDateTime(categorySync.updatedAt || null)}` : "知识库未同步"}
                    </Typography.Text>
                  ) : null}
                </Space>
              );
            },
          },
        ]}
      />

      <Modal open={editorOpen} title={editingId ? "编辑行业配置" : "新建行业配置"} onCancel={() => setEditorOpen(false)} onOk={() => void handleSave()} confirmLoading={saving} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="incubationName" label="行业名称" rules={[{ required: true, message: "请输入行业名称" }]}><Input /></Form.Item>
          <Form.Item name="incubationCode" label="配置编码"><Input /></Form.Item>
          <Form.Item name="industryCode" label="行业编码（自动生成）" tooltip="新建行业时会自动生成 8 位数字编码">
            <Input disabled placeholder={editingId ? "" : "保存后自动生成，例如：20391827"} />
          </Form.Item>
          <Form.Item name="incubationDesc" label="行业说明"><Input.TextArea rows={4} /></Form.Item>
          <Space size={16} style={{ display: "flex" }}>
            <Form.Item name="domesticOnly" label="仅抓国内证据" style={{ flex: 1 }} valuePropName="value">
              <Select options={[{ label: "开启", value: true }, { label: "关闭", value: false }]} />
            </Form.Item>
            <Form.Item name="standardFirst" label="优先标准与法规" style={{ flex: 1 }} valuePropName="value">
              <Select options={[{ label: "开启", value: true }, { label: "关闭", value: false }]} />
            </Form.Item>
          </Space>
          <Form.Item name="sourceTypes" label="证据来源类型">
            <Select mode="multiple" options={EVIDENCE_SOURCE_OPTIONS.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item name="preferredDomains" label="优先域名">
            <Select mode="tags" tokenSeparators={[",", " ", "，"]} />
          </Form.Item>
          <Form.Item name="requiredKeywords" label="必带关键词">
            <Select mode="tags" tokenSeparators={[",", " ", "，"]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={runModalOpen} title={runTarget?.rowType === "industry" ? "开始生成子类目" : `深度调研子类目 / ${runTarget?.category?.categoryName || ""}`} onCancel={() => setRunModalOpen(false)} onOk={() => void handleRunSubmit()} confirmLoading={runSubmitting} destroyOnHidden>
        <Form form={runForm} layout="vertical">
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={runTarget?.rowType === "industry" ? "本次将使用“行业孵化元数据抽取”槽位中的模型与参数" : "本次将使用“行业子类目深挖”槽位中的模型与参数"}
            description={runTarget?.rowType === "industry" ? "行业级运行会基于行业名称、行业描述和联网证据生成新的子类目。" : "子类目运行会只围绕当前子类目继续联网调研并做增量完善。"}
          />
          <Form.Item name="roundCount" label="运行轮次" rules={[{ required: true, message: "请输入运行轮次" }]}>
            <InputNumber min={1} max={12} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={categoryEditorOpen} title="编辑子类目配置" onCancel={() => { setCategoryEditorOpen(false); setCategoryEditContext(null); }} onOk={() => void handleCategorySave()} confirmLoading={saving} destroyOnHidden>
        <Form form={categoryForm} layout="vertical">
          <Form.Item name="categoryCode" label="子类目编码" rules={[{ required: true, message: "请输入子类目编码" }]}><Input /></Form.Item>
          <Form.Item name="categoryName" label="子类目名称" rules={[{ required: true, message: "请输入子类目名称" }]}><Input /></Form.Item>
          <Form.Item name="description" label="说明"><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="tableScopes" label="重点表范围"><Select mode="tags" tokenSeparators={[",", " "]} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        open={tableEditorOpen}
        title={tableEditing ? `编辑表信息 / ${tableEditing.tableName}` : "新增表信息"}
        onCancel={() => {
          setTableEditorOpen(false);
          setTableEditing(null);
        }}
        onOk={() => void handleTableSave()}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={tableForm} layout="vertical">
          <Form.Item name="tableName" label="表名称" rules={[{ required: true, message: "请输入表名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="tableComment" label="表描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="tableSummary" label="表摘要">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="keyInfoItems" label="关键信息项">
            <Select mode="tags" tokenSeparators={[",", " ", "，"]} />
          </Form.Item>
          <Form.Item
            name="fieldsText"
            label="字段清单"
            extra="支持按换行、英文逗号或中文逗号分隔，保存到 tableDetails.fields。"
          >
            <Input.TextArea rows={8} placeholder={"示例：\n订单编号\n用户ID\n订单状态"} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={dictionaryEditorOpen} title={`编辑字典 / ${dictionaryEditing?.dictType || ""}`} onCancel={() => setDictionaryEditorOpen(false)} onOk={() => void handleDictionarySave()} confirmLoading={saving} destroyOnHidden>
        <Form form={dictionaryForm} layout="vertical">
          <Form.Item name="dictName" label="字典名称"><Input /></Form.Item>
          <Form.Item name="valuesText" label="字典项" rules={[{ required: true, message: "请输入字典项" }]}>
            <Input.TextArea rows={10} placeholder="每行一个：编码,标签,值域(可选)" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer open={detailOpen} title={activeDetailCategory ? `${activeDetailCategory.categoryName} / ${detailRecord?.incubationName || ""}` : (detailRecord?.incubationName || "行业孵化详情")} onClose={() => { setDetailOpen(false); setDetailRecord(null); setDetailStats(null); setDetailCategoryCode(null); }} width={1080}>
        {detailRecord ? (
          <Space direction="vertical" size={16} style={{ display: "flex" }}>
            {detailStats ? (
              <Card size="small" title="统计对账">
                <Space direction="vertical" size={12} style={{ display: "flex" }}>
                  <Descriptions bordered column={3} size="small">
                    <Descriptions.Item label="行业子类目数">{detailStats.totals.categoryCount}</Descriptions.Item>
                    <Descriptions.Item label="行业表数">{detailStats.totals.tableCount}</Descriptions.Item>
                    <Descriptions.Item label="行业字典表数">{detailStats.totals.dictionaryGroupCount}</Descriptions.Item>
                    <Descriptions.Item label="行业字典项数">{detailStats.totals.dictionaryItemCount}</Descriptions.Item>
                    <Descriptions.Item label="公共字典表数">{detailStats.totals.publicDictionaryGroupCount}</Descriptions.Item>
                    <Descriptions.Item label="公共字典项数">{detailStats.totals.publicDictionaryItemCount}</Descriptions.Item>
                  </Descriptions>
                  <Table
                    rowKey="categoryCode"
                    size="small"
                    pagination={false}
                    dataSource={detailStats.categories}
                    columns={[
                      { title: "子类目编码", dataIndex: "categoryCode", width: 180 },
                      { title: "子类目名称", dataIndex: "categoryName", width: 180 },
                      { title: "表数", dataIndex: "tableCount", width: 80 },
                      { title: "字典表数", dataIndex: "dictionaryGroupCount", width: 100 },
                      { title: "字典项数", dataIndex: "dictionaryItemCount", width: 100 },
                      { title: "证据数", dataIndex: "evidenceCount", width: 80 },
                      { title: "最近轮次", dataIndex: "lastRoundNo", width: 90 },
                    ]}
                  />
                </Space>
              </Card>
            ) : null}

            {activeDetailCategory ? (
              <Card size="small" title="知识库同步">
                <Descriptions bordered column={3} size="small">
                  <Descriptions.Item label="同步状态">
                    <Tag color={activeCategorySync ? "green" : "default"}>{activeCategorySync ? "已同步" : "未同步"}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="最近同步时间">{formatDateTime(activeCategorySync?.updatedAt || null)}</Descriptions.Item>
                  <Descriptions.Item label="知识文档数">{activeCategorySync?.documentCount ?? 0}</Descriptions.Item>
                </Descriptions>
              </Card>
            ) : null}

            <Card size="small" title={activeDetailCategory ? "当前子类目概览" : "子类目详情"}>
              <Space style={{ width: "100%", justifyContent: "flex-end" }}>
                {activeDetailCategory ? <Button onClick={() => void openCategoryEditor()}>编辑子类目</Button> : null}
              </Space>
              <Table
                rowKey="categoryCode"
                pagination={false}
                dataSource={activeDetailCategory ? [activeDetailCategory] : detailCategories}
                columns={[
                  { title: "子类目编码", dataIndex: "categoryCode", width: 180 },
                  { title: "子类目名称", dataIndex: "categoryName", width: 180 },
                  { title: "说明", dataIndex: "description" },
                  { title: "重点表范围", render: (_: unknown, record: CategoryRecord) => record.tableScopes.join(", ") || "-" },
                ]}
              />
            </Card>

            {activeDetailCategory ? (
              <Card
                size="small"
                title="当前子类目表清单"
                extra={<Button onClick={() => openTableEditor(null)}>新增表</Button>}
              >
                <Table
                  rowKey="tableName"
                  pagination={false}
                  scroll={{ x: 1500 }}
                  dataSource={activeDetailTables}
                  columns={[
                    { title: "表名称", dataIndex: "tableName", width: 180 },
                    { title: "表描述", dataIndex: "tableLabel", width: 220, render: (value?: string | null) => value || "-" },
                    { title: "表摘要", width: 320, render: (_: unknown, record: TableDetailRecord) => renderTableTextCell(record.tableSummary || record.tableComment || "-", 4) },
                    { title: "关键信息项", width: 420, render: (_: unknown, record: TableDetailRecord) => renderTableTagCell(inferKeyInfoItems(record).map((item) => formatKeyInfoDisplay(item)).filter(Boolean), "gold", 2) },
                    {
                      title: "操作",
                      width: 220,
                      render: (_: unknown, record: TableDetailRecord) => (
                        <Space size={4}>
                          <Button type="link" onClick={() => openTableEditor(record)}>编辑</Button>
                          <Button type="link" onClick={() => setTableFieldViewer(record)}>字段详情</Button>
                          <Popconfirm title={`确认删除表 / ${record.tableName}？`} onConfirm={() => void handleDeleteTable(record)}>
                            <Button type="link" danger>删除</Button>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ) : null}

            <Card size="small" title={activeDetailCategory ? "当前子类目字典表与字典项" : "行业公共字典"}>
              <Table
                rowKey="dictType"
                pagination={{ pageSize: 12 }}
                dataSource={activeDetailCategory ? detailDictionaryGroups : detailPublicDictionaryGroups}
                columns={[
                  { title: "字典类型", dataIndex: "dictType", width: 180 },
                  { title: "字典名称", dataIndex: "dictName", width: 180 },
                  { title: "字典项内容", render: (_: unknown, record: DictionaryGroupRecord) => record.items.map((item) => `${item.itemCode}:${item.itemLabel}${item.valueRange ? `(${item.valueRange})` : ""}`).join("；") || "-" },
                  { title: "来源", render: (_: unknown, record: DictionaryGroupRecord) => record.sourceRefs.join(", ") || "-" },
                  ...(activeDetailCategory ? [{
                    title: "操作",
                    width: 100,
                    render: (_: unknown, record: DictionaryGroupRecord) => <Button type="link" onClick={() => openDictionaryEditor(record)}>编辑</Button>,
                  }] : []),
                ]}
              />
            </Card>

            {activeDetailCategory && detailPublicDictionaryGroups.length > 0 ? (
              <Card size="small" title="行业公共字典">
                <Table
                  rowKey="dictType"
                  pagination={{ pageSize: 12 }}
                  dataSource={detailPublicDictionaryGroups}
                  columns={[
                    { title: "字典类型", dataIndex: "dictType", width: 180 },
                    { title: "字典名称", dataIndex: "dictName", width: 180 },
                    { title: "字典项数量", render: (_: unknown, record: DictionaryGroupRecord) => record.items.length },
                    { title: "来源", render: (_: unknown, record: DictionaryGroupRecord) => record.sourceRefs.join(", ") || "-" },
                  ]}
                />
              </Card>
            ) : null}

            <Card size="small" title="证据链">
              <Table
                rowKey="id"
                pagination={{ pageSize: 8 }}
                dataSource={detailEvidence}
                columns={[
                  { title: "标题", dataIndex: "title" },
                  { title: "来源机构", dataIndex: "authority", width: 180 },
                  { title: "类型", dataIndex: "sourceType", width: 120 },
                  { title: "发布时间", dataIndex: "publishedAt", width: 180, render: (value: string) => formatDateTime(value) },
                  { title: "摘要", dataIndex: "summary" },
                ]}
              />
            </Card>

            <Button onClick={() => detailRecord && void openLogs(detailRecord)}>查看日志</Button>
          </Space>
        ) : null}
      </Drawer>

      <Drawer open={logsOpen} title={logTarget ? `${logTarget.incubationName} / 孵化日志` : "孵化日志"} onClose={() => setLogsOpen(false)} width={1080}>
        <Table
          rowKey="id"
          loading={logsLoading}
          dataSource={logRows}
          pagination={{ pageSize: 12 }}
          expandable={{
            rowExpandable: (record) => Boolean(record.requestPayload || record.responsePayload || record.detail),
            expandedRowRender: (record) => (
              <Space direction="vertical" size={12} style={{ display: "flex" }}>
                {record.requestPayload ? (
                  <Card size="small" title="请求参数">
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 260, overflow: "auto" }}>
                      {JSON.stringify(record.requestPayload, null, 2)}
                    </pre>
                  </Card>
                ) : null}
                {record.responsePayload ? (
                  <Card size="small" title="模型响应 / 输出结果">
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 320, overflow: "auto" }}>
                      {JSON.stringify(record.responsePayload, null, 2)}
                    </pre>
                  </Card>
                ) : null}
                {record.detail ? (
                  <Card size="small" title="错误详情 / 附加信息">
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 260, overflow: "auto" }}>
                      {JSON.stringify(record.detail, null, 2)}
                    </pre>
                  </Card>
                ) : null}
              </Space>
            ),
          }}
          columns={[
            { title: "时间", dataIndex: "createdAt", width: 180, render: (value: string) => formatDateTime(value) },
            { title: "轮次", dataIndex: "roundNo", width: 80, render: (value: number | null | undefined) => value || "-" },
            { title: "级别", dataIndex: "logLevel", width: 90 },
            { title: "类型", dataIndex: "logType", width: 120 },
            { title: "步骤", dataIndex: "stepKey", width: 220 },
            { title: "消息", dataIndex: "message" },
          ]}
        />
      </Drawer>
    </Space>
  );
}
