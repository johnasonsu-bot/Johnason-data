const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");
const mysql = require("mysql2/promise");
const { createPostgresLikeClient } = require("../../common/utils/db-client");
const { pool } = require("../../config/database");
const AppError = require("../../common/errors/app-error");
const { safeJsonParse } = require("./data-lab.repository");
const generator = require("./data-lab.generator");
const runtime = require("./data-lab.runtime");
const kafkaRuntime = require("./data-lab.kafka");
const extendedRuleEngine = require("./data-lab.extended-rule-engine");
const modelProviderService = require("../model-providers/model-provider.service");
const educationSupport = require("./data-lab.education-support");
const scenarioEngine = require("./data-lab.scenario-engine");
const autoResearch = require("./data-lab.auto-research");
const ruleMatching = require("./data-lab.rule-matching");
const modelProfileManager = require("./data-lab.model-profile-manager");
const { ROLE_STAGE_TYPES } = require("./data-lab.model-profile-defaults");
const dataLabSourceRepository = require("../data-lab-sources/data-lab-source.repository");
const dataSourceMetadata = require("../data-sources/data-source.metadata");
const {
  inferDatasourceDialect,
  normalizeDatasourceType,
  resolveDatasourceConnection,
} = require("../../common/utils/datasource-dialect");
const promptDefaults = require("./data-lab.prompt-defaults");
const promptRuntime = require("./data-lab.prompt-runtime");
const { getCurrentProjectId } = require("../../common/utils/project-context");

const MEDATA_LAB_DB = "medata_lab";

function getScopedWhere(alias = "") {
  const projectId = getCurrentProjectId();
  if (!projectId) return { sql: "", params: [], projectId: null };
  const prefix = alias ? `${alias}.` : "";
  return { sql: `${prefix}project_id = ?`, params: [projectId], projectId };
}

function boolFlag(value) {
  return value ? 1 : 0;
}

function queryFirst(rows) {
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function hasIndustryKnowledgeScope(tags) {
  return (Array.isArray(tags) ? tags : []).some((tag) => tag === "scope:industry" || tag === "scope:industry_category");
}

function getIndustryCodeFromKnowledgeTags(tags) {
  const matched = (Array.isArray(tags) ? tags : []).find((tag) => String(tag || "").startsWith("industry:"));
  return matched ? String(matched).slice("industry:".length) : null;
}

function normalizeIndustryKnowledgeBaseIds(industryKbIds, industryKbId) {
  const values = Array.isArray(industryKbIds) ? industryKbIds : [];
  return Array.from(new Set([...values, industryKbId].map((item) => Number(item || 0)).filter((item) => item > 0)));
}

function normalizeMysqlDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeDirtyConfig(dirtyRatio, dirtyEnabled) {
  const ratio = Math.max(0, Number(dirtyRatio || 0));
  return {
    dirtyRatio: ratio,
    dirtyEnabled: ratio > 0,
  };
}

function scoreDecodedText(text) {
  const value = String(text || "");
  const chinese = (value.match(/[\u4e00-\u9fff]/g) || []).length;
  const replacement = (value.match(/�/g) || []).length;
  const mojibake = (value.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/g) || []).length;
  const printable = (value.match(/[A-Za-z0-9\u4e00-\u9fff，。！？；：、“”‘’（）【】《》、\s._\-/:]/g) || []).length;
  return printable + chinese * 2 - replacement * 5 - mojibake * 3;
}

function normalizePossibleMojibakeText(text) {
  const raw = String(text || "");
  if (!/[\u0080-\u00ff]/.test(raw)) {
    return raw;
  }
  try {
    const decoded = Buffer.from(raw, "latin1").toString("utf8");
    return scoreDecodedText(decoded) > scoreDecodedText(raw) ? decoded : raw;
  } catch {
    return raw;
  }
}

function normalizeUploadedFileName(fileName) {
  return path.basename(normalizePossibleMojibakeText(fileName)).trim() || "unnamed";
}

function scoreDecodedText(text) {
  const value = String(text || "");
  const chinese = (value.match(/[\u4e00-\u9fff]/g) || []).length;
  const replacement = (value.match(/[�]/g) || []).length;
  const mojibake = (value.match(/[€锛銆鈥浜娉氳鍨瓒閫椹绫诲瀷璁綍鏁鍒闂鏇绻憳浇]/g) || []).length;
  const printable = (value.match(/[A-Za-z0-9\u4e00-\u9fff，。！？；：“”‘’（）【】《》\s._\-/:]/g) || []).length;
  return printable + chinese * 2 - replacement * 8 - mojibake * 6;
}

function normalizePossibleMojibakeText(text) {
  const raw = String(text || "");
  const candidates = [raw];
  try {
    candidates.push(Buffer.from(raw, "latin1").toString("utf8"));
  } catch {}
  try {
    candidates.push(iconv.decode(iconv.encode(raw, "gbk"), "utf8"));
  } catch {}
  try {
    candidates.push(iconv.decode(iconv.encode(raw, "gb18030"), "utf8"));
  } catch {}
  return candidates
    .map((item) => String(item || ""))
    .sort((left, right) => scoreDecodedText(right) - scoreDecodedText(left))[0] || raw;
}

function hasSuspiciousMojibake(value) {
  return /[€�锛銆鈥浜娉氳鍨瓒閫椹绫诲瀷璁綍鏁鍒闂鏇绻憳浇]/.test(String(value || ""));
}

function humanizeSnakeCaseName(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

function isLikelyDictionaryToken(token) {
  return /(type|status|level|grade|channel|result|mode|form|period|category|kind)$/.test(String(token || ""));
}

const BUSINESS_TABLE_VERB_PREFIX = /^(?:\u8bb0\u5f55|\u7ba1\u7406|\u8ddf\u8e2a|\u5b58\u50a8|\u53cd\u6620|\u652f\u6491|\u7528\u4e8e|\u9488\u5bf9|\u7ef4\u62a4|\u5f00\u5c55|\u5904\u7406|\u7edf\u8ba1|\u76d1\u6d4b)/u;
const CHINESE_TABLE_SUFFIX = /(?:\u8bb0\u5f55|\u660e\u7ec6|\u53f0\u8d26|\u6863\u6848|\u65b9\u6848|\u8bc4\u4f30|\u6307\u6807|\u51b3\u5b9a|\u5b9e\u65bd|\u76d1\u6d4b|\u7ba1\u7406|\u670d\u52a1|\u5de5\u5355|\u5b57\u5178)$/u;
const PLACEHOLDER_DICT_VALUES = new Set([
  "\u5f85\u5904\u7406",
  "\u5904\u7406\u4e2d",
  "\u5df2\u5b8c\u6210",
  "\u7c7b\u578b\u4e00",
  "\u7c7b\u578b\u4e8c",
  "\u7c7b\u578b\u4e09",
  "\u9009\u9879\u4e00",
  "\u9009\u9879\u4e8c",
  "\u5176\u4ed6",
]);
const IDENTIFIER_TOKEN_ZH_MAP_CLEAN = {
  accident: "\u4e8b\u6545",
  action: "\u52a8\u4f5c",
  appeal: "\u7533\u8bc9",
  assessment: "\u8bc4\u4f30",
  business: "\u4e1a\u52a1",
  category: "\u7c7b\u522b",
  channel: "\u6e20\u9053",
  code: "\u7f16\u7801",
  complaint: "\u6295\u8bc9",
  construction: "\u5efa\u8bbe",
  credit: "\u4fe1\u7528",
  customer: "\u5ba2\u6237",
  data: "\u6570\u636e",
  decision: "\u51b3\u5b9a",
  delivery: "\u914d\u9001",
  design: "\u8bbe\u8ba1",
  dispatch: "\u8c03\u5ea6",
  driver: "\u9a7e\u9a76\u4eba",
  education: "\u6559\u80b2",
  emergency: "\u5e94\u6025",
  enterprise: "\u4f01\u4e1a",
  event: "\u4e8b\u4ef6",
  evaluation: "\u8bc4\u4ef7",
  facility: "\u8bbe\u65bd",
  flow: "\u6d41\u91cf",
  fulfillment: "\u5c65\u7ea6",
  grade: "\u7b49\u7ea7",
  implementation: "\u5b9e\u65bd",
  index: "\u6307\u6807",
  infrastructure: "\u57fa\u7840\u8bbe\u65bd",
  inspection: "\u68c0\u67e5",
  installation: "\u5b89\u88c5",
  inventory: "\u5e93\u5b58",
  kind: "\u7c7b\u578b",
  law: "\u6cd5\u89c4",
  level: "\u7b49\u7ea7",
  logistics: "\u7269\u6d41",
  maintenance: "\u7ef4\u62a4",
  management: "\u7ba1\u7406",
  merchant: "\u5546\u5bb6",
  mode: "\u65b9\u5f0f",
  monitoring: "\u76d1\u6d4b",
  node: "\u8282\u70b9",
  operation: "\u8fd0\u8425",
  order: "\u8ba2\u5355",
  organization: "\u7ec4\u7ec7",
  package: "\u5305\u88f9",
  payment: "\u652f\u4ed8",
  penalty: "\u5904\u7f5a",
  plan: "\u65b9\u6848",
  platform: "\u5e73\u53f0",
  product: "\u5546\u54c1",
  record: "\u8bb0\u5f55",
  refund: "\u9000\u6b3e",
  register: "\u53f0\u8d26",
  resource: "\u8d44\u6e90",
  response: "\u54cd\u5e94",
  result: "\u7ed3\u679c",
  return: "\u9000\u8d27",
  road: "\u9053\u8def",
  role: "\u89d2\u8272",
  route: "\u8def\u7ebf",
  safety: "\u5b89\u5168",
  service: "\u670d\u52a1",
  source: "\u6765\u6e90",
  state: "\u72b6\u6001",
  status: "\u72b6\u6001",
  supervision: "\u76d1\u7ba1",
  survey: "\u8c03\u67e5",
  track: "\u8f68\u8ff9",
  tracking: "\u8ddf\u8e2a",
  traffic: "\u4ea4\u901a",
  transport: "\u8fd0\u8f93",
  type: "\u7c7b\u578b",
  vehicle: "\u8f66\u8f86",
  violation: "\u8fdd\u6cd5",
  warehouse: "\u4ed3\u5e93",
  work: "\u5de5\u4f5c",
};
const IDENTIFIER_PHRASE_ZH_MAP = {
  business_status: "\u4e1a\u52a1\u72b6\u6001",
  data_status: "\u6570\u636e\u72b6\u6001",
  delivery_service: "\u914d\u9001\u670d\u52a1",
  delivery_status: "\u914d\u9001\u72b6\u6001",
  facility_maintenance: "\u8bbe\u65bd\u7ef4\u62a4",
  installation_status: "\u5b89\u88c5\u72b6\u6001",
  logistics_transport: "\u7269\u6d41\u8fd0\u8f93",
  order_fulfillment: "\u8ba2\u5355\u5c65\u7ea6",
  order_management: "\u79e9\u5e8f\u7ba1\u7406",
  road_facility: "\u9053\u8def\u8bbe\u65bd",
  survey_result: "\u8c03\u67e5\u7ed3\u679c",
  track_event: "\u8f68\u8ff9\u4e8b\u4ef6",
  traffic_flow: "\u4ea4\u901a\u6d41\u91cf",
  traffic_order: "\u4ea4\u901a\u79e9\u5e8f",
  traffic_organization: "\u4ea4\u901a\u7ec4\u7ec7",
  traffic_violation: "\u4ea4\u901a\u8fdd\u6cd5",
  transport_mode: "\u8fd0\u8f93\u65b9\u5f0f",
  warehouse_management: "\u4ed3\u5e93\u7ba1\u7406",
};

function trimChineseLabel(value) {
  return String(value || "")
    .replace(/^[\s\-*]+/, "")
    .replace(/\s+/g, "")
    .replace(/[。；;，,].*$/, "")
    .trim();
}

function looksLikeChineseLabel(value) {
  const text = trimChineseLabel(value);
  return Boolean(text) && text.length <= 18 && /[\u4e00-\u9fff]/.test(text) && !/[：:]/.test(text);
}

function normalizeKnowledgeLine(line) {
  return normalizePossibleMojibakeText(String(line || "")).replace(/\u00a0/g, " ").trim();
}

function cleanKnowledgeDescription(value) {
  return String(value || "")
    .replace(/^[\s\-*]+/, "")
    .replace(/^(?:\u8868\u63cf\u8ff0|\u8868\u6458\u8981|\u5173\u952e\u4fe1\u606f\u9879)\s*[：:]\s*/u, "")
    .replace(/[。；;]+$/u, "")
    .trim();
}

function buildChineseIdentifierLabel(value) {
  const normalized = String(value || "").trim().replace(/_dict$/i, "").toLowerCase();
  if (!normalized) return "";
  if (IDENTIFIER_PHRASE_ZH_MAP[normalized]) {
    return IDENTIFIER_PHRASE_ZH_MAP[normalized];
  }
  const tokens = normalized.split(/[_-]+/).filter(Boolean);
  const parts = [];
  for (let index = 0; index < tokens.length; index += 1) {
    let matched = "";
    for (let size = Math.min(3, tokens.length - index); size > 1; size -= 1) {
      const phrase = tokens.slice(index, index + size).join("_");
      if (IDENTIFIER_PHRASE_ZH_MAP[phrase]) {
        matched = IDENTIFIER_PHRASE_ZH_MAP[phrase];
        index += size - 1;
        break;
      }
    }
    if (matched) {
      parts.push(matched);
      continue;
    }
    parts.push(IDENTIFIER_TOKEN_ZH_MAP_CLEAN[tokens[index]] || tokens[index]);
  }
  return parts.join("");
}

function buildBusinessTableChineseName(tableName, description = "") {
  const normalizedDescription = cleanKnowledgeDescription(description);
  if (looksLikeChineseLabel(normalizedDescription)) {
    return trimChineseLabel(normalizedDescription);
  }
  const identifierLabel = buildChineseIdentifierLabel(tableName);
  if (identifierLabel) {
    return CHINESE_TABLE_SUFFIX.test(identifierLabel) ? identifierLabel : `${identifierLabel}`;
  }
  const concise = trimChineseLabel(normalizedDescription.replace(BUSINESS_TABLE_VERB_PREFIX, ""));
  return concise || humanizeSnakeCaseName(tableName);
}

function buildDictChineseName(dictName, tableName) {
  const explicit = trimChineseLabel(dictName);
  if (looksLikeChineseLabel(explicit)) {
    return explicit.replace(/\u5b57\u5178$/u, "");
  }
  return buildChineseIdentifierLabel(tableName) || humanizeSnakeCaseName(tableName).replace(/\s+/g, "");
}

function normalizeKnowledgeDictValues(values = []) {
  const ordered = [];
  const seen = new Set();
  for (const item of Array.isArray(values) ? values : []) {
    const dictKey = String(item?.dictKey || "").trim();
    const dictValue = String(item?.dictValue || "").trim();
    if (!dictKey || !dictValue) continue;
    const key = `${dictKey}::${dictValue}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push({
      dictKey,
      dictValue,
      sortOrder: Number(item?.sortOrder || ordered.length + 1),
    });
  }
  return ordered;
}

function usesPlaceholderDictValues(values = []) {
  const normalized = normalizeKnowledgeDictValues(values);
  return normalized.length > 0 && normalized.every((item) => PLACEHOLDER_DICT_VALUES.has(String(item.dictValue || "").trim()));
}

function mergeKnowledgeValues(preferred = [], fallback = []) {
  const primary = normalizeKnowledgeDictValues(preferred);
  const secondary = normalizeKnowledgeDictValues(fallback);
  if (primary.length === 0) return secondary;
  if (secondary.length === 0) return primary;
  return normalizeKnowledgeDictValues([...primary, ...secondary]);
}

function upsertKnowledgeSpec(targetMap, tableName, patch, builder) {
  const key = String(tableName || "").trim();
  if (!key) return null;
  const previous = targetMap.get(key) || builder(key);
  const next = {
    ...previous,
    ...patch,
  };
  if (Object.prototype.hasOwnProperty.call(patch, "values")) {
    next.values = mergeKnowledgeValues(previous.values, patch.values);
  }
  targetMap.set(key, next);
  return next;
}

function looksLikeChineseLabel(value) {
  const text = trimChineseLabel(normalizePossibleMojibakeText(value));
  return Boolean(text)
    && text.length <= 18
    && /[\u4e00-\u9fff]/.test(text)
    && !/[：:]/.test(text)
    && !hasSuspiciousMojibake(text);
}

function cleanKnowledgeDescription(value) {
  return normalizePossibleMojibakeText(String(value || ""))
    .replace(/^[\s\-*]+/, "")
    .replace(/^(?:\u8868\u63cf\u8ff0|\u8868\u6458\u8981|\u5173\u952e\u4fe1\u606f\u9879)\s*[：:]\s*/u, "")
    .replace(/[。；;]+$/u, "")
    .trim();
}

function buildBusinessTableChineseName(tableName, description = "") {
  const normalizedDescription = cleanKnowledgeDescription(description);
  if (looksLikeChineseLabel(normalizedDescription)) {
    return trimChineseLabel(normalizedDescription);
  }
  const identifierLabel = buildChineseIdentifierLabel(tableName);
  if (identifierLabel) {
    return identifierLabel;
  }
  const concise = trimChineseLabel(normalizedDescription.replace(BUSINESS_TABLE_VERB_PREFIX, ""));
  return concise || humanizeSnakeCaseName(tableName);
}

function buildDictChineseName(dictName, tableName) {
  const explicit = trimChineseLabel(normalizePossibleMojibakeText(dictName));
  if (looksLikeChineseLabel(explicit)) {
    return explicit.replace(/\u5b57\u5178$/u, "");
  }
  return buildChineseIdentifierLabel(tableName) || humanizeSnakeCaseName(tableName).replace(/\s+/g, "");
}

function cleanKnowledgeDescription(value) {
  return normalizePossibleMojibakeText(String(value || ""))
    .replace(/^[\s\-*]+/, "")
    .replace(/^(?:\u8868\u63cf\u8ff0|\u8868\u6458\u8981|\u5173\u952e\u4fe1\u606f\u9879)\s*[：:]\s*/u, "")
    .replace(/[�?]+$/g, "")
    .replace(/[。；;]+$/u, "")
    .trim();
}

function repairTruncatedKnowledgeValue(value) {
  const normalized = String(value || "").trim();
  const replacements = new Map([
    ["\u8d85\u901f\u884c", "\u8d85\u901f\u884c\u9a76"],
    ["\u95ef\u7ea2", "\u95ef\u7ea2\u706f"],
    ["\u6548\u679c\u540e\u8bc4", "\u6548\u679c\u540e\u8bc4\u4f30"],
    ["\u4e0d\u5408", "\u4e0d\u5408\u683c"],
    ["\u6682\u6263\u9a7e\u9a76", "\u6682\u6263\u9a7e\u9a76\u8bc1"],
    ["\u540a\u9500\u9a7e\u9a76", "\u540a\u9500\u9a7e\u9a76\u8bc1"],
    ["\u7ef4\u62a4", "\u7ef4\u62a4\u4e2d"],
  ]);
  return replacements.get(normalized) || normalized;
}

function normalizeKnowledgeDictValues(values = []) {
  const ordered = [];
  const seen = new Set();
  for (const item of Array.isArray(values) ? values : []) {
    const dictKey = String(item?.dictKey || "").trim();
    const dictValue = repairTruncatedKnowledgeValue(cleanKnowledgeDescription(item?.dictValue || ""));
    if (!dictKey || !dictValue) continue;
    const key = `${dictKey}::${dictValue}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push({
      dictKey,
      dictValue,
      sortOrder: Number(item?.sortOrder || ordered.length + 1),
    });
  }
  return ordered;
}

function buildHeuristicRelationSuggestions(tableNames) {
  const names = Array.from(new Set((Array.isArray(tableNames) ? tableNames : []).map((item) => String(item || "").trim()).filter(Boolean)));
  const suggestions = new Set();
  const splitMap = new Map(names.map((name) => [name, name.split("_").filter(Boolean)]));

  for (const left of names) {
    for (const right of names) {
      if (left === right) continue;
      const leftTokens = splitMap.get(left) || [];
      const rightTokens = splitMap.get(right) || [];
      let common = 0;
      while (common < leftTokens.length && common < rightTokens.length && leftTokens[common] === rightTokens[common]) {
        common += 1;
      }
      if (common < 2) continue;
      const leftTail = leftTokens.slice(common);
      const rightTail = rightTokens.slice(common);
      if (leftTail.length === 0 || rightTail.length === 0) continue;

      const leftLast = leftTail[leftTail.length - 1];
      const rightLast = rightTail[rightTail.length - 1];
      const leftIsBase = ["record", "plan", "evaluation", "monitoring", "management"].includes(leftLast);
      const rightIsChild = ["decision", "appeal", "implementation", "index", "log", "dispatch", "payment", "assessment", "record"].includes(rightLast);
      const rightIsBase = ["record", "plan", "evaluation", "monitoring", "management"].includes(rightLast);
      const leftIsChild = ["decision", "appeal", "implementation", "index", "log", "dispatch", "payment", "assessment", "record"].includes(leftLast);

      if (leftIsBase && rightIsChild) {
        suggestions.add(`${left}->${right}`);
      } else if (rightIsBase && leftIsChild) {
        suggestions.add(`${right}->${left}`);
      } else if (leftTokens.length < rightTokens.length) {
        suggestions.add(`${left}->${right}`);
      }
    }
  }

  return Array.from(suggestions).slice(0, 20);
}

function extractKnowledgeCatalogHints(knowledgeText) {
  const text = String(knowledgeText || "");
  const headingMatches = Array.from(text.matchAll(/^###\s*([a-z][a-z0-9_]{2,})\s*$/gm))
    .map((item) => ({ tableName: String(item[1] || "").trim(), description: "" }))
    .filter((item) => item.tableName);
  const bulletMatches = Array.from(text.matchAll(/-\s*([a-z][a-z0-9_]{2,})\s*\/\s*([^\r\n]+)/g))
    .map((item) => ({ tableName: String(item[1] || "").trim(), description: String(item[2] || "").trim() }))
    .filter((item) => item.tableName);
  const orderedSpecs = Array.from(new Map(
    [...headingMatches, ...bulletMatches].map((item) => [item.tableName, item])
  ).values());
  const dictSpecs = orderedSpecs.filter((item) => isLikelyDictionaryToken(item.tableName));
  const tableSpecs = orderedSpecs.filter((item) => !isLikelyDictionaryToken(item.tableName) && !/^industry_incubation_/.test(item.tableName));
  return {
    candidateTableSpecs: tableSpecs.slice(0, 20).map((item) => ({
      tableName: item.tableName,
      tableLabel: item.description ? item.description.slice(0, 12).replace(/[，。；、,.].*$/, "").trim() : humanizeSnakeCaseName(item.tableName),
      tableComment: item.description || `${humanizeSnakeCaseName(item.tableName)}业务信息`,
      fields: [],
    })),
    dictSuggestionSpecs: dictSpecs.slice(0, 20).map((item) => ({
      tableName: item.tableName,
      dictType: item.tableName,
      dictName: item.description ? item.description.slice(0, 12).replace(/[，。；、,.].*$/, "").trim() : humanizeSnakeCaseName(item.tableName),
      tableComment: item.description || `${humanizeSnakeCaseName(item.tableName)}字典`,
      values: [],
    })),
    relationSuggestions: buildHeuristicRelationSuggestions(tableSpecs.map((item) => item.tableName)),
  };
}

function extractKnowledgeCatalogHintsV2(knowledgeText) {
  const text = normalizePossibleMojibakeText(String(knowledgeText || ""));
  const lines = text.split(/\r?\n/).map((line) => normalizeKnowledgeLine(line)).filter(Boolean);
  const tableSpecs = new Map();
  const dictSpecs = new Map();
  let currentMode = "table";
  let currentSection = null;

  const ensureTableSpec = (tableName, patch = {}) => upsertKnowledgeSpec(
    tableSpecs,
    tableName,
    patch,
    (key) => {
      const tableLabel = buildBusinessTableChineseName(key);
      return {
        tableName: key,
        tableLabel,
        tableComment: tableLabel,
        description: "",
        fields: [],
      };
    }
  );
  const ensureDictSpec = (tableName, patch = {}) => upsertKnowledgeSpec(
    dictSpecs,
    tableName,
    patch,
    (key) => {
      const dictName = buildDictChineseName("", key);
      return {
        tableName: key,
        dictType: key.replace(/_dict$/i, ""),
        dictName,
        tableComment: `${dictName}\u5b57\u5178`,
        referenceField: key.replace(/_dict$/i, ""),
        values: [],
      };
    }
  );

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      currentMode = /\u5b57\u5178\u8868/u.test(line) ? "dict" : "table";
      currentSection = null;
      continue;
    }

    const dictHeadingMatch = line.match(/^###\s*([a-z][a-z0-9_]{2,})\s*\/\s*(.+)$/i);
    if (dictHeadingMatch) {
      const tableName = String(dictHeadingMatch[1] || "").trim();
      const dictName = buildDictChineseName(dictHeadingMatch[2], tableName);
      ensureDictSpec(tableName, {
        dictType: tableName.replace(/_dict$/i, ""),
        dictName,
        tableComment: `${dictName}\u5b57\u5178`,
        referenceField: tableName.replace(/_dict$/i, ""),
      });
      currentMode = "dict";
      currentSection = { kind: "dict", tableName };
      continue;
    }

    const tableHeadingMatch = line.match(/^###\s*([a-z][a-z0-9_]{2,})\s*$/i);
    if (tableHeadingMatch) {
      const tableName = String(tableHeadingMatch[1] || "").trim();
      const kind = currentMode === "dict" || isLikelyDictionaryToken(tableName) ? "dict" : "table";
      currentSection = { kind, tableName };
      if (kind === "dict") {
        const dictName = buildDictChineseName("", tableName);
        ensureDictSpec(tableName, {
          dictType: tableName.replace(/_dict$/i, ""),
          dictName,
          tableComment: `${dictName}\u5b57\u5178`,
        });
      } else {
        ensureTableSpec(tableName);
      }
      continue;
    }

    const summaryMatch = line.match(/^-\s*([a-z][a-z0-9_]{2,})\s*\/\s*([^/\r\n]+?)(?:\s*\/\s*\d+\s*[\u9879\u4e2a]?)?$/i);
    if (summaryMatch) {
      const tableName = String(summaryMatch[1] || "").trim();
      const summaryText = cleanKnowledgeDescription(summaryMatch[2]);
      if (currentMode === "dict" || isLikelyDictionaryToken(tableName)) {
        const dictName = buildDictChineseName(summaryText, tableName);
        ensureDictSpec(tableName, {
          dictType: tableName.replace(/_dict$/i, ""),
          dictName,
          tableComment: `${dictName}\u5b57\u5178`,
          referenceField: tableName.replace(/_dict$/i, ""),
        });
      } else {
        const tableLabel = buildBusinessTableChineseName(tableName, summaryText);
        ensureTableSpec(tableName, {
          tableLabel,
          tableComment: tableLabel,
          description: summaryText,
        });
      }
      continue;
    }

    const detailMatch = line.match(/^-\s*(?:\u8868\u63cf\u8ff0|\u8868\u6458\u8981)\s*[:：]\s*(.+)$/u);
    if (detailMatch && currentSection?.kind === "table") {
      const description = cleanKnowledgeDescription(detailMatch[1]);
      const tableLabel = buildBusinessTableChineseName(currentSection.tableName, description);
      ensureTableSpec(currentSection.tableName, {
        tableLabel,
        tableComment: tableLabel,
        description,
      });
      continue;
    }

    const dictValueMatch = line.match(/^-\s*([^:：]+)\s*[:：]\s*(.+)$/u);
    if (dictValueMatch && currentSection?.kind === "dict") {
      const dictKey = String(dictValueMatch[1] || "").trim();
      const dictValue = cleanKnowledgeDescription(dictValueMatch[2]);
      if (dictKey && dictValue) {
        ensureDictSpec(currentSection.tableName, {
          values: [{ dictKey, dictValue }],
        });
      }
    }
  }

  const normalizedTableSpecs = Array.from(tableSpecs.values())
    .filter((item) => item.tableName && !/^industry_incubation_/i.test(item.tableName))
    .map((item) => {
      const tableLabel = buildBusinessTableChineseName(item.tableName, item.description || item.tableLabel);
      return {
        tableName: item.tableName,
        tableLabel,
        tableComment: tableLabel,
        description: item.description || "",
        fields: [],
      };
    });
  const normalizedDictSpecs = Array.from(dictSpecs.values()).map((item) => {
    const dictName = buildDictChineseName(item.dictName, item.tableName);
    const tableName = item.tableName.endsWith("_dict") ? item.tableName : `${item.tableName}_dict`;
    return {
      tableName,
      dictType: item.dictType || tableName.replace(/_dict$/i, ""),
      dictName,
      tableComment: `${dictName}\u5b57\u5178`,
      referenceField: item.referenceField || tableName.replace(/_dict$/i, ""),
      values: normalizeKnowledgeDictValues(item.values),
    };
  });
  return {
    candidateTableSpecs: normalizedTableSpecs.slice(0, 40),
    dictSuggestionSpecs: normalizedDictSpecs.slice(0, 60),
    relationSuggestions: buildHeuristicRelationSuggestions(normalizedTableSpecs.map((item) => item.tableName)),
  };
}

function mergeResearchPackWithKnowledgeHints(researchPack, knowledgeHints) {
  const basePack = researchPack && typeof researchPack === "object" ? researchPack : {};
  const candidateTableSpecs = Array.isArray(basePack.candidateTableSpecs) ? basePack.candidateTableSpecs : [];
  const dictSuggestionSpecs = Array.isArray(basePack.dictSuggestionSpecs) ? basePack.dictSuggestionSpecs : [];
  const mergedCandidateTableSpecs = Array.from(new Map(
    [
      ...candidateTableSpecs,
      ...(knowledgeHints.candidateTableSpecs || []),
    ].map((item) => [String(item?.tableName || "").trim(), item])
  ).values()).filter((item) => item?.tableName);
  const mergedDictSuggestionSpecs = Array.from(new Map(
    [
      ...dictSuggestionSpecs,
      ...(knowledgeHints.dictSuggestionSpecs || []),
    ].map((item) => [String(item?.tableName || item?.dictType || "").trim(), item])
  ).values()).filter((item) => item?.tableName || item?.dictType);
  return {
    ...basePack,
    candidateTableSpecs: mergedCandidateTableSpecs,
    candidateTables: Array.from(new Set([
      ...(Array.isArray(basePack.candidateTables) ? basePack.candidateTables : []),
      ...mergedCandidateTableSpecs.map((item) => item.tableName),
    ].filter(Boolean))),
    dictSuggestionSpecs: mergedDictSuggestionSpecs,
    dictSuggestions: Array.from(new Set([
      ...(Array.isArray(basePack.dictSuggestions) ? basePack.dictSuggestions : []),
      ...mergedDictSuggestionSpecs.map((item) => item.dictType || item.tableName),
    ].filter(Boolean))),
    relationSuggestions: Array.from(new Set([
      ...(Array.isArray(basePack.relationSuggestions) ? basePack.relationSuggestions : []),
      ...(knowledgeHints.relationSuggestions || []),
    ].filter(Boolean))),
  };
}

function extractSceneFocusTerms(scene, researchPack) {
  const sceneText = [scene?.sceneName, scene?.sceneDesc].filter(Boolean).join(" ");
  const normalizedSceneText = String(sceneText || "").toLowerCase();
  const zhTerms = Array.from(new Set(
    normalizedSceneText
      .match(/[\u4e00-\u9fff]{2,12}/g) || []
  )).filter((item) => item.length >= 2);
  const enTerms = Array.from(new Set(
    normalizedSceneText
      .match(/[a-z][a-z0-9_]{2,}/g) || []
  ));
  const semanticTerms = Array.from(new Set([
    ...(Array.isArray(researchPack?.businessObjects) ? researchPack.businessObjects : []),
    ...(Array.isArray(researchPack?.businessActions) ? researchPack.businessActions : []),
    ...(Array.isArray(researchPack?.businessResults) ? researchPack.businessResults : []),
  ].map((item) => String(item || "").trim()).filter(Boolean)));
  return { sceneText, normalizedSceneText, zhTerms, enTerms, semanticTerms };
}

function scoreTableSpecForScene(spec, focusTerms) {
  const tableName = String(spec?.tableName || "").trim().toLowerCase();
  const tableLabel = String(spec?.tableLabel || spec?.tableComment || "").trim();
  const tableComment = String(spec?.tableComment || "").trim();
  const identifierLabel = buildChineseIdentifierLabel(tableName);
  const fieldNames = (Array.isArray(spec?.fields) ? spec.fields : []).map((item) => String(item?.fieldName || item || "").trim().toLowerCase());
  let score = 0;
  let hitCount = 0;

  if (!tableName) return -999;
  if (focusTerms.normalizedSceneText.includes(tableName)) {
    score += 16;
    hitCount += 1;
  }
  if (tableLabel && focusTerms.sceneText.includes(tableLabel)) {
    score += 18;
    hitCount += 1;
  }
  if (tableComment && focusTerms.sceneText.includes(tableComment)) {
    score += 12;
    hitCount += 1;
  }
  if (identifierLabel && focusTerms.sceneText.includes(identifierLabel)) {
    score += 14;
    hitCount += 1;
  }

  for (const term of focusTerms.zhTerms) {
    if (!term || term.length < 2) continue;
    if (tableLabel.includes(term)) {
      score += 6;
      hitCount += 1;
    } else if (tableComment.includes(term)) {
      score += 4;
      hitCount += 1;
    } else if (identifierLabel.includes(term)) {
      score += 6;
      hitCount += 1;
    }
  }
  for (const term of focusTerms.semanticTerms) {
    if (!term || term.length < 2) continue;
    if (tableLabel.includes(term)) {
      score += 6;
      hitCount += 1;
    } else if (tableComment.includes(term)) {
      score += 4;
      hitCount += 1;
    } else if (identifierLabel.includes(term)) {
      score += 5;
      hitCount += 1;
    }
  }
  for (const term of focusTerms.enTerms) {
    if (!term) continue;
    if (tableName.includes(term)) {
      score += 4;
      hitCount += 1;
    }
    if (fieldNames.some((fieldName) => fieldName.includes(term))) {
      score += 2;
      hitCount += 1;
    }
  }
  if (hitCount === 0) score -= 6;
  if (fieldNames.some((fieldName) => /status|type|time|date|code|result/.test(fieldName))) score += 1;
  if (/log|temp|demo|sample/.test(tableName)) score -= 6;
  return score;
}

function buildRelationAdjacency(relationSuggestions = []) {
  const graph = new Map();
  for (const relation of Array.isArray(relationSuggestions) ? relationSuggestions : []) {
    const text = String(relation || "").trim();
    const match = text.match(/^([a-z][a-z0-9_]*)\s*->\s*([a-z][a-z0-9_]*)$/i);
    if (!match) continue;
    const left = match[1];
    const right = match[2];
    if (!graph.has(left)) graph.set(left, new Set());
    if (!graph.has(right)) graph.set(right, new Set());
    graph.get(left).add(right);
    graph.get(right).add(left);
  }
  return graph;
}

function curateResearchPackForScene(scene, researchPack) {
  const pack = researchPack && typeof researchPack === "object" ? JSON.parse(JSON.stringify(researchPack)) : {};
  const candidateSpecs = Array.isArray(pack.candidateTableSpecs) ? pack.candidateTableSpecs : [];
  if (candidateSpecs.length === 0) {
    return pack;
  }

  const focusTerms = extractSceneFocusTerms(scene, pack);
  const scored = candidateSpecs
    .map((item, index) => ({ item, index, score: scoreTableSpecForScene(item, focusTerms) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const targetCount = Math.min(15, Math.max(10, Math.min(12, scored.length)));
  const selected = [];
  const selectedNames = new Set();
  for (const entry of scored) {
    if (selected.length >= targetCount) break;
    if (selectedNames.has(entry.item.tableName)) continue;
    if (entry.score < 0 && selected.length >= 10) continue;
    selected.push(entry.item);
    selectedNames.add(entry.item.tableName);
  }
  for (const entry of scored) {
    if (selected.length >= 10) break;
    if (selectedNames.has(entry.item.tableName)) continue;
    selected.push(entry.item);
    selectedNames.add(entry.item.tableName);
  }

  const relationSuggestions = Array.from(new Set((Array.isArray(pack.relationSuggestions) ? pack.relationSuggestions : [])
    .filter((item) => {
      const match = String(item || "").match(/^([a-z][a-z0-9_]*)\s*->\s*([a-z][a-z0-9_]*)$/i);
      return match && selectedNames.has(match[1]) && selectedNames.has(match[2]);
    })));
  const heuristicRelations = buildHeuristicRelationSuggestions(selected.map((item) => item.tableName))
    .filter((item) => {
      const match = String(item || "").match(/^([a-z][a-z0-9_]*)\s*->\s*([a-z][a-z0-9_]*)$/i);
      return match && selectedNames.has(match[1]) && selectedNames.has(match[2]);
    });
  const mergedRelations = Array.from(new Set([...relationSuggestions, ...heuristicRelations]));

  const finalSelected = selected.slice(0, 15);
  const finalNames = new Set(finalSelected.map((item) => item.tableName));
  const selectedFieldNames = new Set(finalSelected.flatMap((item) =>
    (Array.isArray(item.fields) ? item.fields : []).map((field) => String(field?.fieldName || field || "").trim())
  ).filter(Boolean));

  const filteredDictSpecs = (Array.isArray(pack.dictSuggestionSpecs) ? pack.dictSuggestionSpecs : []).filter((item) => {
    const referenceField = String(item?.referenceField || item?.dictType || "").trim();
    const dictName = String(item?.dictName || item?.tableComment || "").trim();
    return selectedFieldNames.has(referenceField)
      || focusTerms.semanticTerms.some((term) => dictName.includes(term))
      || focusTerms.zhTerms.some((term) => dictName.includes(term));
  });

  return {
    ...pack,
    candidateTableSpecs: finalSelected,
    candidateTables: finalSelected.map((item) => item.tableName),
    dictSuggestionSpecs: filteredDictSpecs,
    dictSuggestions: filteredDictSpecs.map((item) => item.dictType || item.tableName),
    relationSuggestions: mergedRelations.filter((item) => {
      const match = String(item || "").match(/^([a-z][a-z0-9_]*)\s*->\s*([a-z][a-z0-9_]*)$/i);
      return match && finalNames.has(match[1]) && finalNames.has(match[2]);
    }),
    summary: String(pack.summary || "").trim(),
  };
}

function decodeTextBuffer(buffer) {
  const candidates = [
    buffer.toString("utf8"),
    iconv.decode(buffer, "gb18030"),
    iconv.decode(buffer, "gbk"),
  ];
  return candidates.sort((left, right) => scoreDecodedText(right) - scoreDecodedText(left))[0];
}

async function logOperation(operationType, operatorName, sceneId, requestPayload, resultSummary) {
  await pool.query(
    `INSERT INTO lab_operation_log (scene_id, operation_type, operator_name, request_payload_json, result_summary)
     VALUES (?, ?, ?, ?, ?)`,
    [sceneId || null, operationType, operatorName || "system", JSON.stringify(requestPayload || null), resultSummary || null]
  );
}

async function ensureLabDatabase() {
  await pool.query(`CREATE DATABASE IF NOT EXISTS \`${MEDATA_LAB_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
}

function normalizeStorageSourceType(sourceType, connectionConfig = {}) {
  const normalized = normalizeDatasourceType(sourceType || "mysql");
  const dialect = inferDatasourceDialect(normalized, connectionConfig || {});
  return dialect === "unknown" ? normalized || "mysql" : dialect;
}

function getDataSourceConnectionConfig(dataSource) {
  const connectionConfig = dataSource?.connectionConfig && typeof dataSource.connectionConfig === "object"
    ? dataSource.connectionConfig
    : {};
  const resolved = resolveDatasourceConnection(dataSource?.sourceType, connectionConfig);
  const sourceType = normalizeStorageSourceType(dataSource?.sourceType, connectionConfig);
  return {
    sourceType,
    host: resolved.host || connectionConfig.host,
    port: Number(resolved.port || connectionConfig.port || 0) || 0,
    database: resolved.database || connectionConfig.database,
    schema: resolved.schema || connectionConfig.schema || "public",
    username: resolved.username || connectionConfig.username,
    password: resolved.password || connectionConfig.password,
    jdbcUrl: resolved.jdbcUrl || connectionConfig.jdbcUrl || connectionConfig.url || "",
    driverClassName: resolved.driverClassName || connectionConfig.driverClassName || null,
  };
}

async function resolveSceneStorageBinding(scene) {
  const offlineDataSourceId = Number(scene?.offlineDataSourceId || 0);
  if (!offlineDataSourceId) {
    return {
      mode: "local",
      sourceType: "mysql",
      database: MEDATA_LAB_DB,
    };
  }
  const dataSource = await dataLabSourceRepository.getDataSourceById(offlineDataSourceId);
  if (!dataSource || dataSource.status !== "active") {
    return {
      mode: "local",
      sourceType: "mysql",
      database: MEDATA_LAB_DB,
    };
  }
  const config = getDataSourceConnectionConfig(dataSource);
  if (!["mysql", "postgresql"].includes(config.sourceType)) {
    return {
      mode: "local",
      sourceType: "mysql",
      database: MEDATA_LAB_DB,
    };
  }
  return {
    mode: "datasource",
    sourceType: config.sourceType,
    dataSource,
    config,
  };
}

function escapeStorageIdentifier(binding, identifier) {
  const text = String(identifier || "");
  if (binding?.sourceType === "postgresql") {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return `\`${text.replace(/`/g, "``")}\``;
}

function buildStorageTableReference(binding, tableName, alias = "") {
  const tableIdentifier = escapeStorageIdentifier(binding, tableName);
  const aliasSql = alias ? ` ${escapeStorageIdentifier(binding, alias)}` : "";
  if (binding?.mode === "local") {
    return `${escapeStorageIdentifier(binding, MEDATA_LAB_DB)}.${tableIdentifier}${aliasSql}`;
  }
  if (binding?.sourceType === "postgresql") {
    return `${escapeStorageIdentifier(binding, binding.config?.schema || "public")}.${tableIdentifier}${aliasSql}`;
  }
  return `${tableIdentifier}${aliasSql}`;
}

async function withStorageBinding(binding, handler) {
  if (binding.mode === "local") {
    return handler({
      ...binding,
      async query(sql, params = []) {
        const [rows] = await pool.query(sql, params);
        return rows;
      },
    });
  }

  if (binding.sourceType === "mysql") {
    const connection = await mysql.createConnection({
      host: binding.config.host,
      port: binding.config.port,
      database: binding.config.database,
      user: binding.config.username,
      password: binding.config.password,
      connectTimeout: 10000,
    });
    try {
      return await handler({
        ...binding,
        async query(sql, params = []) {
          const [rows] = await connection.query(sql, params);
          return rows;
        },
      });
    } finally {
      await connection.end();
    }
  }

  const client = createPostgresLikeClient({
    host: binding.config.host,
    port: binding.config.port,
    database: binding.config.database,
    user: binding.config.username,
    username: binding.config.username,
    password: binding.config.password,
    connectionTimeoutMillis: 10000,
  }, {
    sourceType: binding.config.type || binding.config.sourceType || "postgresql",
  });
  await client.connect();
  try {
    return await handler({
      ...binding,
      async query(sql, params = []) {
        const result = await client.query(sql, params);
        return result.rows;
      },
    });
  } finally {
    await client.end();
  }
}

async function ensureSceneStorageTables(scene, schemaContent) {
  const binding = await resolveSceneStorageBinding(scene);
  if (binding.mode === "local") {
    await ensureLabDatabase();
    const ddlStatements = generator.buildDDLStatements(scene.sceneCode, schemaContent);
    for (const item of ddlStatements) {
      await pool.query(item.ddl);
    }
    return binding;
  }

  for (const table of schemaContent?.tables || []) {
    const physicalTableName = generator.buildPhysicalTableName(scene.sceneCode, table.tableName);
    const columns = (table.fields || []).map((field) => mapSceneFieldToTargetColumn(field, binding.sourceType));
    await dataSourceMetadata.ensureTableMatchesColumns(binding.dataSource, physicalTableName, columns, {
      tableComment: table.tableComment || table.tableLabel || table.tableName,
    });
  }
  return binding;
}

async function storageTableExists(binding, tableName) {
  if (binding.mode === "local" || binding.sourceType === "mysql") {
    const sql = binding.mode === "local"
      ? "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ? AND table_name = ?"
      : "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ? AND table_name = ?";
    const params = binding.mode === "local"
      ? [MEDATA_LAB_DB, tableName]
      : [binding.config.database, tableName];
    const rows = await withStorageBinding(binding, async (runtimeBinding) => runtimeBinding.query(sql, params));
    return Number(rows[0]?.total || 0) > 0;
  }

  const rows = await withStorageBinding(binding, async (runtimeBinding) =>
    runtimeBinding.query(
      `SELECT COUNT(*)::int AS total
       FROM information_schema.tables
       WHERE table_catalog = $1 AND table_schema = $2 AND table_name = $3`,
      [binding.config.database, binding.config.schema || "public", tableName]
    )
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function countRowsInStorage(scene, tableName) {
  const binding = await resolveSceneStorageBinding(scene);
  const exists = await storageTableExists(binding, tableName);
  if (!exists) {
    return 0;
  }
  return withStorageBinding(binding, async (runtimeBinding) => {
    const rows = await runtimeBinding.query(
      `SELECT COUNT(*) AS total FROM ${buildStorageTableReference(runtimeBinding, tableName)}`
    );
    return Number(rows[0]?.total || 0);
  });
}

async function fetchRowsFromStorage(scene, tableName, options = {}) {
  const binding = await resolveSceneStorageBinding(scene);
  const exists = await storageTableExists(binding, tableName);
  if (!exists) {
    return [];
  }
  const pageSize = Math.max(1, Number(options.pageSize || options.limit || 20));
  const offset = Math.max(0, Number(options.offset || 0));
  return withStorageBinding(binding, async (runtimeBinding) => {
    const quotedTable = buildStorageTableReference(runtimeBinding, tableName);
    const sortField = options.sortField ? escapeStorageIdentifier(runtimeBinding, options.sortField) : null;
    const sortDirection = String(options.sortOrder || "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC";
    if (runtimeBinding.sourceType === "postgresql") {
      const sql = `SELECT * FROM ${quotedTable}${sortField ? ` ORDER BY ${sortField} ${sortDirection}` : ""} LIMIT $1 OFFSET $2`;
      return runtimeBinding.query(sql, [pageSize, offset]);
    }
    const sql = `SELECT * FROM ${quotedTable}${sortField ? ` ORDER BY ${sortField} ${sortDirection}` : ""} LIMIT ? OFFSET ?`;
    return runtimeBinding.query(sql, [pageSize, offset]);
  });
}

async function insertRowsToBusinessTable(scene, tableName, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }
  const binding = await resolveSceneStorageBinding(scene);
  await ensureSceneStorageTables(scene, { tables: [] });
  const exists = await storageTableExists(binding, tableName);
  if (!exists) {
    return;
  }
  const fields = Object.keys(rows[0]).filter((key) => !key.startsWith("__"));
  await withStorageBinding(binding, async (runtimeBinding) => {
    const quotedTable = buildStorageTableReference(runtimeBinding, tableName);
    const quotedFields = fields.map((field) => escapeStorageIdentifier(runtimeBinding, field)).join(", ");
    if (runtimeBinding.sourceType === "postgresql") {
      const valuePlaceholders = [];
      const values = [];
      rows.forEach((row, rowIndex) => {
        const tuple = fields.map((field, fieldIndex) => {
          values.push(row[field]);
          return `$${rowIndex * fields.length + fieldIndex + 1}`;
        });
        valuePlaceholders.push(`(${tuple.join(", ")})`);
      });
      await runtimeBinding.query(
        `INSERT INTO ${quotedTable} (${quotedFields}) VALUES ${valuePlaceholders.join(", ")}`,
        values
      );
      return;
    }

    const valuePlaceholders = rows.map(() => `(${fields.map(() => "?").join(", ")})`).join(", ");
    const values = [];
    rows.forEach((row) => fields.forEach((field) => values.push(row[field])));
    await runtimeBinding.query(
      `INSERT INTO ${quotedTable} (${quotedFields}) VALUES ${valuePlaceholders}`,
      values
    );
  });
}

async function deleteAllRowsFromStorage(scene, tableName) {
  const binding = await resolveSceneStorageBinding(scene);
  const exists = await storageTableExists(binding, tableName);
  if (!exists) {
    return;
  }
  await withStorageBinding(binding, async (runtimeBinding) => {
    await runtimeBinding.query(`DELETE FROM ${buildStorageTableReference(runtimeBinding, tableName)}`);
  });
}

async function countNullRowsInStorage(scene, tableName, fieldName) {
  const binding = await resolveSceneStorageBinding(scene);
  const exists = await storageTableExists(binding, tableName);
  if (!exists) {
    return 0;
  }
  return withStorageBinding(binding, async (runtimeBinding) => {
    const rows = await runtimeBinding.query(
      `SELECT COUNT(*) AS total
       FROM ${buildStorageTableReference(runtimeBinding, tableName)}
       WHERE ${escapeStorageIdentifier(runtimeBinding, fieldName)} IS NULL`
    );
    return Number(rows[0]?.total || 0);
  });
}

async function countDuplicateRowsInStorage(scene, tableName, fieldName) {
  const binding = await resolveSceneStorageBinding(scene);
  const exists = await storageTableExists(binding, tableName);
  if (!exists) {
    return 0;
  }
  return withStorageBinding(binding, async (runtimeBinding) => {
    const rows = await runtimeBinding.query(
      `SELECT COUNT(*) AS total FROM (
         SELECT ${escapeStorageIdentifier(runtimeBinding, fieldName)}, COUNT(*) AS cnt
         FROM ${buildStorageTableReference(runtimeBinding, tableName)}
         WHERE ${escapeStorageIdentifier(runtimeBinding, fieldName)} IS NOT NULL
         GROUP BY ${escapeStorageIdentifier(runtimeBinding, fieldName)}
         HAVING COUNT(*) > 1
       ) dup`
    );
    return Number(rows[0]?.total || 0);
  });
}

async function countForeignKeyViolationsInStorage(scene, tableName, fieldName, refTableName, refFieldName) {
  const binding = await resolveSceneStorageBinding(scene);
  const exists = await storageTableExists(binding, tableName);
  const refExists = await storageTableExists(binding, refTableName);
  if (!exists || !refExists) {
    return 0;
  }
  return withStorageBinding(binding, async (runtimeBinding) => {
    const rows = await runtimeBinding.query(
      `SELECT COUNT(*) AS total
       FROM ${buildStorageTableReference(runtimeBinding, tableName, "t")}
       LEFT JOIN ${buildStorageTableReference(runtimeBinding, refTableName, "r")}
         ON ${escapeStorageIdentifier(runtimeBinding, "t")}.${escapeStorageIdentifier(runtimeBinding, fieldName)}
         = ${escapeStorageIdentifier(runtimeBinding, "r")}.${escapeStorageIdentifier(runtimeBinding, refFieldName)}
       WHERE ${escapeStorageIdentifier(runtimeBinding, "t")}.${escapeStorageIdentifier(runtimeBinding, fieldName)} IS NOT NULL
         AND ${escapeStorageIdentifier(runtimeBinding, "r")}.${escapeStorageIdentifier(runtimeBinding, refFieldName)} IS NULL`
    );
    return Number(rows[0]?.total || 0);
  });
}

async function listKnowledgeBases() {
  const scoped = getScopedWhere("kb");
  const [rows] = await pool.query(
    `SELECT kb.id, kb.kb_name AS kbName, kb.kb_desc AS kbDesc, kb.industry_type AS industryType,
            kb.tags_json AS tags, kb.planning_summary_json AS planningSummary,
            kb.status, kb.created_by AS createdBy,
            kb.created_at AS createdAt, kb.updated_at AS updatedAt,
            COUNT(doc.id) AS documentCount
     FROM lab_kb kb
     LEFT JOIN lab_kb_doc doc ON doc.kb_id = kb.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     GROUP BY kb.id
     ORDER BY kb.updated_at DESC`,
    scoped.params
  );

  return rows.map((row) => ({
    id: Number(row.id),
    kbName: row.kbName,
    kbDesc: row.kbDesc,
    industryType: row.industryType,
    tags: safeJsonParse(row.tags, []),
    planningSummary: safeJsonParse(row.planningSummary, null),
    status: row.status,
    createdBy: row.createdBy,
    documentCount: Number(row.documentCount || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function getKnowledgeBaseDetail(id) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, kb_name AS kbName, kb_desc AS kbDesc, industry_type AS industryType,
            tags_json AS tags, planning_summary_json AS planningSummary, status, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM lab_kb WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""} LIMIT 1`,
    [id, ...scoped.params]
  );
  const kb = queryFirst(rows);
  if (!kb) {
    throw new AppError("知识库不存在", 404);
  }
  const [docs] = await pool.query(
    `SELECT id, kb_id AS kbId, file_name AS fileName, file_type AS fileType, file_path AS filePath,
            file_size AS fileSize, parse_status AS parseStatus, parse_summary AS parseSummary,
            vector_status AS vectorStatus, doc_status AS docStatus, chunk_count AS chunkCount,
            last_parsed_at AS lastParsedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_kb_doc WHERE kb_id = ? ORDER BY updated_at DESC`,
    [id]
  );
  let planningSummary = safeJsonParse(kb.planningSummary, null);
  if (!planningSummary && docs.length > 0) {
    planningSummary = await getKnowledgePlanningSummary(id);
  }
  return {
    id: Number(kb.id),
    kbName: kb.kbName,
    kbDesc: kb.kbDesc,
    industryType: kb.industryType,
    tags: safeJsonParse(kb.tags, []),
    planningSummary,
    status: kb.status,
    createdBy: kb.createdBy,
    createdAt: kb.createdAt,
    updatedAt: kb.updatedAt,
    documents: docs.map((doc) => ({
      id: Number(doc.id),
      kbId: Number(doc.kbId),
      fileName: doc.fileName,
      fileType: doc.fileType,
      filePath: doc.filePath,
      fileSize: Number(doc.fileSize || 0),
      parseStatus: doc.parseStatus,
      parseSummary: doc.parseSummary,
      vectorStatus: doc.vectorStatus,
      docStatus: doc.docStatus,
      chunkCount: Number(doc.chunkCount || 0),
      lastParsedAt: doc.lastParsedAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }))
  };
}

async function createKnowledgeBase(payload, user) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO lab_kb (project_id, kb_name, kb_desc, industry_type, tags_json, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.kbName,
      payload.kbDesc || null,
      payload.industryType || null,
      JSON.stringify(payload.tags || []),
      payload.status || "active",
      user?.displayName || user?.username || "system"
    ]
  );
  await logOperation("CREATE_KB", user?.displayName || user?.username || "system", null, payload, `创建知识库 ${payload.kbName}`);
  return getKnowledgeBaseDetail(result.insertId);
}

async function updateKnowledgeBase(id, payload) {
  await getKnowledgeBaseDetail(id);
  const scoped = getScopedWhere("");
  await pool.query(
    `UPDATE lab_kb
     SET kb_name = ?, kb_desc = ?, industry_type = ?, tags_json = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.kbName,
      payload.kbDesc || null,
      payload.industryType || null,
      JSON.stringify(payload.tags || []),
      payload.status || "active",
      id,
      ...scoped.params
    ]
  );
  await logOperation("UPDATE_KB", "system", null, payload, `更新知识库 ${id}`);
  if (payload.industryType !== undefined) {
    await refreshKnowledgePlanningSummary(id);
  }
  return getKnowledgeBaseDetail(id);
}

async function updateKnowledgeBasePlanningSummary(kbId, planningSummary) {
  const scoped = getScopedWhere("");
  await pool.query(
    `UPDATE lab_kb SET planning_summary_json = ? WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [planningSummary ? JSON.stringify(planningSummary) : null, kbId, ...scoped.params]
  );
}

async function deleteKnowledgeBase(id) {
  await getKnowledgeBaseDetail(id);
  const scoped = getScopedWhere("");
  await pool.query(`DELETE FROM lab_kb WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`, [id, ...scoped.params]);
  await logOperation("DELETE_KB", "system", null, { id }, `删除知识库 ${id}`);
}

async function uploadKnowledgeDocument({ kbId, file }) {
  await getKnowledgeBaseDetail(kbId);
  const normalizedFileName = normalizeUploadedFileName(file.originalname);
  const fileType = path.extname(normalizedFileName).replace(/^\./, "").toLowerCase() || "bin";
  const [result] = await pool.query(
    `INSERT INTO lab_kb_doc
      (kb_id, file_name, file_type, file_path, file_size, parse_status, vector_status, doc_status)
     VALUES (?, ?, ?, ?, ?, 'WAIT_PARSE', 'PENDING', 'active')`,
    [kbId, normalizedFileName, fileType, file.path, file.size]
  );
  void reparseKnowledgeDocument(result.insertId).catch((error) => {
    console.error("[data-lab] knowledge parse failed:", error);
  });
  return getKnowledgeBaseDetail(kbId);
}

function splitTextIntoChunks(text, chunkSize = 480) {
  const normalized = String(text || "").replace(/\r/g, "");
  if (!normalized) {
    return ["空文档"];
  }
  const parts = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks = [];
  let buffer = "";
  parts.forEach((part) => {
    if ((buffer + "\n\n" + part).length > chunkSize && buffer) {
      chunks.push(buffer);
      buffer = part;
    } else {
      buffer = buffer ? `${buffer}\n\n${part}` : part;
    }
  });
  if (buffer) {
    chunks.push(buffer);
  }
  return chunks.length > 0 ? chunks : [normalized.slice(0, chunkSize)];
}

function extractKeywords(text) {
  return [...new Set(String(text || "").match(/[A-Za-z0-9_\u4e00-\u9fa5]{2,}/g) || [])].slice(0, 12);
}

function normalizeSummaryLine(line) {
  return String(line || "")
    .replace(/^\s*[#>*\-\d.、]+\s*/g, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDocumentParseSummary(fileName, content, chunks) {
  if (scoreDecodedText(content) < 20) {
    return `已解析 ${fileName}，共 ${chunks.length} 个片段`;
  }
  const lines = String(content || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(normalizeSummaryLine)
    .filter(Boolean)
    .filter((line) => line !== "空文档");
  const excerpt = lines.slice(0, 3).join("；").slice(0, 120) || "文档已完成解析";
  const keywords = extractKeywords(content).slice(0, 6).join("、");
  return `摘要：${excerpt}${excerpt.length >= 120 ? "..." : ""}；关键词：${keywords || "无"}；共 ${chunks.length} 个片段`;
}

async function getExistingDocumentChunkContents(docId) {
  const [rows] = await pool.query(
    `SELECT content
     FROM lab_kb_doc_chunk
     WHERE kb_doc_id = ?
     ORDER BY chunk_index ASC`,
    [docId]
  );
  return rows.map((row) => row.content).filter(Boolean);
}

async function readDocumentTextAdvanced(filePath, fileType) {
  const ext = String(fileType || "").toLowerCase();
  if (["txt", "md", "csv", "json"].includes(ext)) {
    return decodeTextBuffer(fs.readFileSync(filePath));
  }
  if (ext === "pdf") {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text || "";
  }
  if (ext === "docx") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || "";
  }
  if (ext === "doc") {
    const WordExtractor = require("word-extractor");
    const extractor = new WordExtractor();
    const document = await extractor.extract(filePath);
    return document.getBody() || "";
  }
  if (["xlsx", "xls"].includes(ext)) {
    const xlsx = require("xlsx");
    const workbook = xlsx.readFile(filePath);
    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      return `# ${sheetName}\n${xlsx.utils.sheet_to_csv(sheet)}`;
    }).join("\n\n");
  }
  return readDocumentText(filePath, fileType);
}

function readDocumentText(filePath, fileType) {
  const ext = String(fileType || "").toLowerCase();
  if (["txt", "md", "csv", "json"].includes(ext)) {
    return decodeTextBuffer(fs.readFileSync(filePath));
  }
  const stat = fs.statSync(filePath);
  return `文件名：${path.basename(filePath)}\n文件类型：${ext || "unknown"}\n文件大小：${stat.size} bytes\n当前版本已完成文件入库与轻量解析，可作为场景生成时的知识上下文。`;
}

async function reparseKnowledgeDocument(docId) {
  const scoped = getScopedWhere("kb");
  const [rows] = await pool.query(
    `SELECT doc.*
     FROM lab_kb_doc doc
     JOIN lab_kb kb ON kb.id = doc.kb_id
     WHERE doc.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [docId, ...scoped.params]
  );
  const doc = queryFirst(rows);
  if (!doc) {
    throw new AppError("知识库文档不存在", 404);
  }
  await pool.query("UPDATE lab_kb_doc SET parse_status = 'PARSING', parse_summary = '文档解析中' WHERE id = ?", [docId]);
  try {
    let content;
    try {
      content = await readDocumentTextAdvanced(doc.file_path, doc.file_type);
    } catch (readError) {
      if (readError.code === "ENOENT") {
        const cachedChunks = await getExistingDocumentChunkContents(docId);
        if (cachedChunks.length > 0) {
          content = cachedChunks.join("\n");
        } else {
          throw readError;
        }
      } else {
        throw readError;
      }
    }
    const chunks = splitTextIntoChunks(content);
    const normalizedDocName = normalizeUploadedFileName(doc.file_name);
    const parseSummary = buildDocumentParseSummary(normalizedDocName, content, chunks);
    await pool.query("DELETE FROM lab_kb_doc_chunk WHERE kb_doc_id = ?", [docId]);
    for (let index = 0; index < chunks.length; index += 1) {
      await pool.query(
        `INSERT INTO lab_kb_doc_chunk (kb_doc_id, kb_id, chunk_index, content, keywords_json)
         VALUES (?, ?, ?, ?, ?)`,
        [docId, doc.kb_id, index + 1, chunks[index], JSON.stringify(extractKeywords(chunks[index]))]
      );
    }
    await pool.query(
      `UPDATE lab_kb_doc
       SET parse_status = 'PARSE_SUCCESS', parse_summary = ?, vector_status = 'READY', chunk_count = ?, last_parsed_at = NOW()
       WHERE id = ?`,
      [parseSummary, chunks.length, docId]
    );
    await refreshKnowledgePlanningSummary(doc.kb_id, content);
  } catch (error) {
    await pool.query(
      "UPDATE lab_kb_doc SET parse_status = 'PARSE_FAIL', parse_summary = ?, vector_status = 'FAILED', last_parsed_at = NOW() WHERE id = ?",
      [error.message || "文档解析失败", docId]
    );
    throw error;
  }
  return getKnowledgeBaseDetail(doc.kb_id);
}

async function getIndustryKnowledgeBaseBase(id, options = {}) {
  const kbId = Number(id || 0);
  if (!kbId) {
    throw new AppError("行业知识库不能为空", 400);
  }
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, kb_name AS kbName, kb_desc AS kbDesc, tags_json AS tags, status
     FROM system_knowledge_base
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""} LIMIT 1`,
    [kbId, ...scoped.params]
  );
  const row = queryFirst(rows);
  if (!row) {
    throw new AppError("行业知识库不存在", 404);
  }
  const tags = safeJsonParse(row.tags, []);
  if (!hasIndustryKnowledgeScope(tags)) {
    throw new AppError("所选知识库不是行业知识库", 400);
  }
  if (options.requireActive !== false && row.status !== "active") {
    throw new AppError("所选行业知识库未启用", 400);
  }
  return {
    id: Number(row.id),
    kbName: row.kbName,
    kbDesc: row.kbDesc || null,
    tags,
    status: row.status,
    industryCode: getIndustryCodeFromKnowledgeTags(tags),
  };
}

async function getIndustryKnowledgeBasesByIds(industryKbIds, options = {}) {
  const ids = Array.from(new Set((Array.isArray(industryKbIds) ? industryKbIds : []).map((item) => Number(item || 0)).filter((item) => item > 0)));
  if (ids.length === 0) {
    throw new AppError("行业知识库不能为空", 400);
  }
  const knowledgeBases = [];
  for (const id of ids) {
    knowledgeBases.push(await getIndustryKnowledgeBaseBase(id, options));
  }
  return knowledgeBases;
}

async function getIndustryKnowledgeText(industryKbId) {
  if (!industryKbId) {
    return "";
  }
  const [rows] = await pool.query(
    `SELECT content
     FROM system_knowledge_base_chunk
     WHERE kb_id = ?
     ORDER BY kb_doc_id ASC, chunk_index ASC
     LIMIT 40`,
    [industryKbId]
  );
  return normalizePossibleMojibakeText(
    rows
      .map((row) => normalizePossibleMojibakeText(String(row.content || "")).trim())
      .filter(Boolean)
      .join("\n")
  );
}

async function getIndustryKnowledgeTextByIds(industryKbIds) {
  const ids = Array.from(new Set((Array.isArray(industryKbIds) ? industryKbIds : []).map((item) => Number(item || 0)).filter((item) => item > 0)));
  const textParts = [];
  for (const id of ids) {
    const text = await getIndustryKnowledgeText(id);
    if (text) {
      textParts.push(text);
    }
  }
  return textParts.join("\n\n");
}

async function getIndustryKnowledgePlanningSummary(industryKbId, options = {}) {
  if (!industryKbId) {
    return null;
  }
  const knowledgeBase = await getIndustryKnowledgeBaseBase(industryKbId, { requireActive: false });
  const knowledgeText = options.knowledgeText ?? await getIndustryKnowledgeText(industryKbId);
  return scenarioEngine.extractKnowledgePlanningSignals(knowledgeText, knowledgeBase.industryCode || null);
}

async function buildSceneAnalysisContext(scene) {
  const industryKbIds = normalizeIndustryKnowledgeBaseIds(scene?.industryKbIds, scene?.industryKbId);
  if (industryKbIds.length === 0) {
    throw new AppError("场景未绑定行业知识库", 400);
  }
  const knowledgeBases = await getIndustryKnowledgeBasesByIds(industryKbIds, { requireActive: false });
  const knowledgeText = await getIndustryKnowledgeTextByIds(industryKbIds);
  if (!knowledgeText) {
    throw new AppError("所选行业知识库暂无可用内容，请先在系统管理-知识库管理-行业知识库中上传并解析文档", 400);
  }
  const industryCodes = Array.from(new Set(knowledgeBases.map((item) => item.industryCode).filter(Boolean)));
  const knowledgeHeader = knowledgeBases.map((item) => `${item.kbName} / ${item.industryCode || "unknown"}`).join("\n");
  const effectiveKnowledgeText = `industries ${industryCodes.join(",")}\n${knowledgeHeader}\n${knowledgeText}`;
  const knowledgePlanningSummary = await getIndustryKnowledgePlanningSummary(industryKbIds[0], { knowledgeText: effectiveKnowledgeText });
  const scenarioProfile = scenarioEngine.buildScenarioProfile({
    sceneName: scene.sceneName,
    sceneDesc: scene.sceneDesc,
    knowledgeText: effectiveKnowledgeText,
    knowledgePlanningSummary,
  });
  const knowledgeHints = extractKnowledgeCatalogHintsV2(effectiveKnowledgeText);
  const mergedResearchPack = mergeResearchPackWithKnowledgeHints(
    await buildAutoResearchPack(scene, scenarioProfile),
    knowledgeHints
  );
  const researchPack = curateResearchPackForScene(scene, mergedResearchPack);
  return {
    knowledgeText: effectiveKnowledgeText,
    knowledgePlanningSummary,
    scenarioProfile,
    researchPack,
    knowledgeBases,
    modulePlan: scenarioProfile?.modulePlan || null,
    conceptPlan: scenarioProfile?.conceptPlan || scenarioProfile?.modulePlan?.conceptPlan || null,
  };
}

async function listScenes() {
  const scoped = getScopedWhere("s");
  const [rows] = await pool.query(
    `SELECT s.id, s.scene_code AS sceneCode, s.scene_name AS sceneName, s.scene_desc AS sceneDesc,
            s.kb_id AS kbId, kb.kb_name AS kbName, s.industry_kb_ids_json AS industryKbIds, s.enhancement_profile_id AS enhancementProfileId,
            s.industry_kb_id AS industryKbId, industry_kb.kb_name AS industryKbName,
            profile.profile_name AS enhancementProfileName,
            s.offline_data_source_id AS offlineDataSourceId, offline_ds.source_name AS offlineDataSourceName,
            s.realtime_data_source_id AS realtimeDataSourceId, realtime_ds.source_name AS realtimeDataSourceName,
            s.status, s.stage_status AS stageStatus,
            s.init_volume AS initVolume, s.incr_volume AS incrVolume, s.incr_cycle AS incrCycle,
            s.dirty_enabled AS dirtyEnabled, s.dirty_ratio AS dirtyRatio, s.realtime_enabled AS realtimeEnabled,
            s.realtime_status AS realtimeStatus, s.kafka_topic_mode AS kafkaTopicMode, s.kafka_bootstrap_servers AS kafkaBootstrapServers,
            s.strategy_model_id AS strategyModelId, s.generate_model_id AS generateModelId,
            s.current_schema_version AS currentSchemaVersion, s.current_strategy_version AS currentStrategyVersion,
            s.task_enabled AS taskEnabled, s.last_run_time AS lastRunTime, s.last_deployed_at AS lastDeployedAt,
            s.created_by AS createdBy, s.created_at AS createdAt, s.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM lab_scene_table t WHERE t.scene_id = s.id) AS tableCount,
            (SELECT COALESCE(SUM(records_count), 0) FROM lab_scene_run_log log WHERE log.scene_id = s.id) AS totalDataCount
     FROM lab_scene s
     LEFT JOIN lab_kb kb ON kb.id = s.kb_id
     LEFT JOIN system_knowledge_base industry_kb ON industry_kb.id = s.industry_kb_id
     LEFT JOIN lab_scenario_profile profile ON profile.id = s.enhancement_profile_id
     LEFT JOIN data_lab_sources offline_ds ON offline_ds.id = s.offline_data_source_id
     LEFT JOIN data_lab_sources realtime_ds ON realtime_ds.id = s.realtime_data_source_id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY s.updated_at DESC`,
    scoped.params
  );
  return rows.map(mapSceneRow);
}

function mapSceneRow(row) {
  return {
    id: Number(row.id),
    sceneCode: row.sceneCode,
    sceneName: row.sceneName,
    sceneDesc: row.sceneDesc,
    industryKbIds: normalizeIndustryKnowledgeBaseIds(safeJsonParse(row.industryKbIds, []), row.industryKbId),
    industryKbId: row.industryKbId ? Number(row.industryKbId) : null,
    industryKbName: row.industryKbName || null,
    kbId: row.kbId ? Number(row.kbId) : null,
    kbName: row.kbName || null,
    enhancementProfileId: row.enhancementProfileId ? Number(row.enhancementProfileId) : null,
    enhancementProfileName: row.enhancementProfileName || null,
    offlineDataSourceId: row.offlineDataSourceId ? Number(row.offlineDataSourceId) : null,
    offlineDataSourceName: row.offlineDataSourceName || null,
    realtimeDataSourceId: row.realtimeDataSourceId ? Number(row.realtimeDataSourceId) : null,
    realtimeDataSourceName: row.realtimeDataSourceName || null,
    status: row.status,
    stageStatus: row.stageStatus,
    initVolume: Number(row.initVolume || 0),
    incrVolume: Number(row.incrVolume || 0),
    incrCycle: row.incrCycle,
    dirtyEnabled: Boolean(row.dirtyEnabled),
    dirtyRatio: Number(row.dirtyRatio || 0),
    realtimeEnabled: Boolean(row.realtimeEnabled),
    realtimeStatus: row.realtimeStatus,
    kafkaTopicMode: row.kafkaTopicMode,
    kafkaBootstrapServers: row.kafkaBootstrapServers,
    strategyModelId: row.strategyModelId ? Number(row.strategyModelId) : null,
    generateModelId: row.generateModelId ? Number(row.generateModelId) : null,
    currentSchemaVersion: row.currentSchemaVersion ? Number(row.currentSchemaVersion) : null,
    currentStrategyVersion: row.currentStrategyVersion ? Number(row.currentStrategyVersion) : null,
    taskEnabled: Boolean(row.taskEnabled),
    lastRunTime: row.lastRunTime,
    lastDeployedAt: row.lastDeployedAt || null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tableCount: row.tableCount !== undefined ? Number(row.tableCount) : undefined,
    totalDataCount: row.totalDataCount !== undefined ? Number(row.totalDataCount) : undefined
  };
}

async function buildUniqueSceneCode(sceneName, preferredCode) {
  const baseCode = generator.normalizeSceneCode(preferredCode || sceneName || "scene");
  const [exactRows] = await pool.query("SELECT id FROM lab_scene WHERE scene_code = ? LIMIT 1", [baseCode]);
  if (exactRows.length === 0) {
    return baseCode;
  }

  const [rows] = await pool.query(
    "SELECT scene_code AS sceneCode FROM lab_scene WHERE scene_code = ? OR scene_code LIKE ?",
    [baseCode, `${baseCode}_%`]
  );
  const existing = new Set(rows.map((row) => String(row.sceneCode || "").trim()).filter(Boolean));
  let suffix = 2;
  while (suffix < 10000) {
    const candidate = `${baseCode}_${suffix}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
    suffix += 1;
  }
  return `${baseCode}_${Date.now().toString().slice(-6)}`;
}

async function getSceneBase(id) {
  const scoped = getScopedWhere("s");
  const [rows] = await pool.query(
    `SELECT s.id, s.scene_code AS sceneCode, s.scene_name AS sceneName, s.scene_desc AS sceneDesc,
            s.kb_id AS kbId, kb.kb_name AS kbName, s.industry_kb_ids_json AS industryKbIds, s.enhancement_profile_id AS enhancementProfileId,
            s.industry_kb_id AS industryKbId, industry_kb.kb_name AS industryKbName,
            profile.profile_name AS enhancementProfileName,
            s.offline_data_source_id AS offlineDataSourceId, offline_ds.source_name AS offlineDataSourceName,
            s.realtime_data_source_id AS realtimeDataSourceId, realtime_ds.source_name AS realtimeDataSourceName,
            s.status, s.stage_status AS stageStatus,
            s.init_volume AS initVolume, s.incr_volume AS incrVolume, s.incr_cycle AS incrCycle,
            s.dirty_enabled AS dirtyEnabled, s.dirty_ratio AS dirtyRatio, s.realtime_enabled AS realtimeEnabled,
            s.realtime_status AS realtimeStatus, s.kafka_topic_mode AS kafkaTopicMode, s.kafka_bootstrap_servers AS kafkaBootstrapServers,
            s.strategy_model_id AS strategyModelId, s.generate_model_id AS generateModelId,
            s.current_schema_version AS currentSchemaVersion, s.current_strategy_version AS currentStrategyVersion,
            s.task_enabled AS taskEnabled, s.last_run_time AS lastRunTime, s.last_deployed_at AS lastDeployedAt,
            s.created_by AS createdBy, s.created_at AS createdAt, s.updated_at AS updatedAt
     FROM lab_scene s
     LEFT JOIN lab_kb kb ON kb.id = s.kb_id
     LEFT JOIN system_knowledge_base industry_kb ON industry_kb.id = s.industry_kb_id
     LEFT JOIN lab_scenario_profile profile ON profile.id = s.enhancement_profile_id
     LEFT JOIN data_lab_sources offline_ds ON offline_ds.id = s.offline_data_source_id
     LEFT JOIN data_lab_sources realtime_ds ON realtime_ds.id = s.realtime_data_source_id
     WHERE s.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""} LIMIT 1`,
    [id, ...scoped.params]
  );
  const row = queryFirst(rows);
  if (!row) {
    throw new AppError("场景不存在", 404);
  }
  return mapSceneRow(row);
}

async function createScene(payload, user) {
  const projectId = getCurrentProjectId();
  const industryKbIds = normalizeIndustryKnowledgeBaseIds(payload.industryKbIds, payload.industryKbId);
  if (industryKbIds.length === 0) {
    throw new AppError("创建场景时必须选择行业知识库", 400);
  }
  await getIndustryKnowledgeBasesByIds(industryKbIds);
  const sceneCode = await buildUniqueSceneCode(payload.sceneName, payload.sceneCode || undefined);
  const dirtyConfig = normalizeDirtyConfig(payload.dirtyRatio, payload.dirtyEnabled);
  const [result] = await pool.query(
    `INSERT INTO lab_scene
      (project_id, scene_code, scene_name, scene_desc, kb_id, industry_kb_id, industry_kb_ids_json, enhancement_profile_id, offline_data_source_id, realtime_data_source_id, status, stage_status, init_volume, incr_volume, incr_cycle,
       dirty_enabled, dirty_ratio, realtime_enabled, realtime_status, kafka_topic_mode, kafka_bootstrap_servers,
       strategy_model_id, generate_model_id, task_enabled, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'DRAFT', ?, ?, ?, ?, ?, ?, 'STOPPED', ?, ?, ?, ?, 0, ?)`,
    [
      projectId,
      sceneCode,
      payload.sceneName,
      payload.sceneDesc || null,
      payload.kbId || null,
      industryKbIds[0],
      JSON.stringify(industryKbIds),
      payload.enhancementProfileId || null,
      payload.offlineDataSourceId || null,
      payload.realtimeDataSourceId || null,
      payload.initVolume || 1000,
      payload.incrVolume || 100,
      payload.incrCycle || "DAILY",
      boolFlag(dirtyConfig.dirtyEnabled),
      dirtyConfig.dirtyRatio,
      boolFlag(payload.realtimeEnabled),
      payload.kafkaTopicMode || "AUTO",
      payload.kafkaBootstrapServers || null,
      payload.strategyModelId || null,
      payload.generateModelId || null,
      user?.displayName || user?.username || "system"
    ]
  );
  await logOperation("CREATE_SCENE", user?.displayName || user?.username || "system", Number(result.insertId), payload, `创建场景 ${payload.sceneName}`);
  return getSceneBase(result.insertId);
}

async function updateScene(payload) {
  const scene = await getSceneBase(payload.id);
  const scoped = getScopedWhere("");
  const nextIndustryKbIds = payload.industryKbIds === undefined && payload.industryKbId === undefined
    ? normalizeIndustryKnowledgeBaseIds(scene.industryKbIds, scene.industryKbId)
    : normalizeIndustryKnowledgeBaseIds(payload.industryKbIds, payload.industryKbId);
  if (nextIndustryKbIds.length > 0) {
    await getIndustryKnowledgeBasesByIds(nextIndustryKbIds);
  }
  const nextDirtyConfig = payload.dirtyRatio === undefined && payload.dirtyEnabled === undefined
    ? normalizeDirtyConfig(scene.dirtyRatio, scene.dirtyEnabled)
    : normalizeDirtyConfig(payload.dirtyRatio, payload.dirtyEnabled);
  await pool.query(
    `UPDATE lab_scene
     SET scene_name = ?, scene_desc = ?, kb_id = ?, industry_kb_id = ?, industry_kb_ids_json = ?, enhancement_profile_id = ?, offline_data_source_id = ?, realtime_data_source_id = ?, init_volume = ?, incr_volume = ?, incr_cycle = ?,
         dirty_enabled = ?, dirty_ratio = ?, realtime_enabled = ?, kafka_topic_mode = ?, kafka_bootstrap_servers = ?,
         strategy_model_id = ?, generate_model_id = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.sceneName,
      payload.sceneDesc === undefined ? (scene.sceneDesc || null) : (payload.sceneDesc || null),
      payload.kbId === undefined ? (scene.kbId || null) : (payload.kbId || null),
      nextIndustryKbIds[0] || null,
      nextIndustryKbIds.length > 0 ? JSON.stringify(nextIndustryKbIds) : null,
      payload.enhancementProfileId === undefined ? (scene.enhancementProfileId || null) : (payload.enhancementProfileId || null),
      payload.offlineDataSourceId === undefined ? (scene.offlineDataSourceId || null) : (payload.offlineDataSourceId || null),
      payload.realtimeDataSourceId === undefined ? (scene.realtimeDataSourceId || null) : (payload.realtimeDataSourceId || null),
      payload.initVolume ?? scene.initVolume,
      payload.incrVolume ?? scene.incrVolume,
      payload.incrCycle || scene.incrCycle,
      boolFlag(nextDirtyConfig.dirtyEnabled),
      nextDirtyConfig.dirtyRatio,
      boolFlag(payload.realtimeEnabled === undefined ? scene.realtimeEnabled : payload.realtimeEnabled),
      payload.kafkaTopicMode || scene.kafkaTopicMode,
      payload.kafkaBootstrapServers === undefined ? (scene.kafkaBootstrapServers || null) : (payload.kafkaBootstrapServers || null),
      payload.strategyModelId === undefined ? (scene.strategyModelId || null) : (payload.strategyModelId || null),
      payload.generateModelId === undefined ? (scene.generateModelId || null) : (payload.generateModelId || null),
      payload.id,
      ...scoped.params
    ]
  );
  await logOperation("UPDATE_SCENE", "system", payload.id, payload, `更新场景 ${payload.id}`);
  return getSceneBase(payload.id);
}

async function copyScene(id, user) {
  const scene = await getSceneBase(id);
  const projectId = getCurrentProjectId();
  const industryKbIds = normalizeIndustryKnowledgeBaseIds(scene.industryKbIds, scene.industryKbId);
  const dirtyConfig = normalizeDirtyConfig(scene.dirtyRatio, scene.dirtyEnabled);
  const [result] = await pool.query(
    `INSERT INTO lab_scene
      (project_id, scene_code, scene_name, scene_desc, kb_id, industry_kb_id, industry_kb_ids_json, enhancement_profile_id, status, stage_status, init_volume, incr_volume, incr_cycle,
       dirty_enabled, dirty_ratio, realtime_enabled, realtime_status, kafka_topic_mode, kafka_bootstrap_servers,
       strategy_model_id, generate_model_id, task_enabled, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'DRAFT', ?, ?, ?, ?, ?, ?, 'STOPPED', ?, ?, ?, ?, 0, ?)`,
    [
      projectId,
      `${scene.sceneCode}_copy_${Date.now().toString().slice(-4)}`,
      `${scene.sceneName}-副本`,
      scene.sceneDesc,
      scene.kbId,
      industryKbIds[0] || null,
      industryKbIds.length > 0 ? JSON.stringify(industryKbIds) : null,
      scene.enhancementProfileId,
      scene.initVolume,
      scene.incrVolume,
      scene.incrCycle,
      boolFlag(dirtyConfig.dirtyEnabled),
      dirtyConfig.dirtyRatio,
      boolFlag(scene.realtimeEnabled),
      scene.kafkaTopicMode,
      scene.kafkaBootstrapServers,
      scene.strategyModelId,
      scene.generateModelId,
      user?.displayName || user?.username || "system"
    ]
  );
  const newSceneId = Number(result.insertId);
  const currentSchema = await getCurrentSchemaVersion(id);
  if (currentSchema) {
    await pool.query(
      `INSERT INTO lab_scene_schema_version
        (scene_id, version_no, version_status, schema_json, adjustment_history_json, model_summary)
       VALUES (?, 1, 'GENERATED', ?, ?, '复制自原场景')`,
      [newSceneId, JSON.stringify(currentSchema.content), JSON.stringify(currentSchema.adjustmentHistory || [])]
    );
    await pool.query("UPDATE lab_scene SET current_schema_version = 1 WHERE id = ?", [newSceneId]);
  }
  const currentStrategy = await getCurrentStrategyVersion(id);
  if (currentStrategy) {
    await pool.query(
      `INSERT INTO lab_scene_strategy_version
        (scene_id, version_no, version_status, strategy_json, model_summary)
       VALUES (?, 1, 'GENERATED', ?, '复制自原场景')`,
      [newSceneId, JSON.stringify(currentStrategy.content)]
    );
    await pool.query("UPDATE lab_scene SET current_strategy_version = 1 WHERE id = ?", [newSceneId]);
  }
  await logOperation("COPY_SCENE", user?.displayName || user?.username || "system", newSceneId, { sourceSceneId: id }, `复制场景 ${id}`);
  return getSceneDetail(newSceneId);
}

async function listSchemaVersions(sceneId) {
  const [rows] = await pool.query(
    `SELECT id, scene_id AS sceneId, version_no AS versionNo, version_status AS versionStatus,
            schema_json AS schemaJson, adjustment_prompt AS adjustmentPrompt, adjustment_history_json AS adjustmentHistoryJson,
            model_summary AS modelSummary, diff_summary AS diffSummary, confirmed_at AS confirmedAt,
            created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scene_schema_version
     WHERE scene_id = ?
     ORDER BY version_no DESC`,
    [sceneId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    sceneId: Number(row.sceneId),
    versionNo: Number(row.versionNo),
    versionStatus: row.versionStatus,
    content: safeJsonParse(row.schemaJson, {}),
    adjustmentPrompt: row.adjustmentPrompt,
    adjustmentHistory: safeJsonParse(row.adjustmentHistoryJson, []),
    modelSummary: row.modelSummary,
    diffSummary: row.diffSummary,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function listStrategyVersions(sceneId) {
  const [rows] = await pool.query(
    `SELECT id, scene_id AS sceneId, version_no AS versionNo, version_status AS versionStatus,
            strategy_json AS strategyJson, adjustment_prompt AS adjustmentPrompt, model_summary AS modelSummary,
            confirmed_at AS confirmedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scene_strategy_version
     WHERE scene_id = ?
     ORDER BY version_no DESC`,
    [sceneId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    sceneId: Number(row.sceneId),
    versionNo: Number(row.versionNo),
    versionStatus: row.versionStatus,
    content: safeJsonParse(row.strategyJson, {}),
    adjustmentPrompt: row.adjustmentPrompt,
    modelSummary: row.modelSummary,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function getCurrentSchemaVersion(sceneId, preferredVersionId) {
  if (preferredVersionId) {
    const [rows] = await pool.query(
      `SELECT id, scene_id AS sceneId, version_no AS versionNo, version_status AS versionStatus,
              schema_json AS schemaJson, adjustment_prompt AS adjustmentPrompt, adjustment_history_json AS adjustmentHistoryJson,
              model_summary AS modelSummary, diff_summary AS diffSummary, confirmed_at AS confirmedAt,
              created_at AS createdAt, updated_at AS updatedAt
       FROM lab_scene_schema_version WHERE id = ? LIMIT 1`,
      [preferredVersionId]
    );
    const version = queryFirst(rows);
    return version
      ? {
          id: Number(version.id),
          sceneId: Number(version.sceneId),
          versionNo: Number(version.versionNo),
          versionStatus: version.versionStatus,
          content: safeJsonParse(version.schemaJson, {}),
          adjustmentPrompt: version.adjustmentPrompt,
          adjustmentHistory: safeJsonParse(version.adjustmentHistoryJson, []),
          modelSummary: version.modelSummary,
          diffSummary: version.diffSummary
        }
      : null;
  }
  const versions = await listSchemaVersions(sceneId);
  return versions[0] || null;
}

async function getCurrentStrategyVersion(sceneId, preferredVersionId) {
  const scene = await getSceneBase(sceneId);
  if (preferredVersionId) {
    const [rows] = await pool.query(
      `SELECT id, scene_id AS sceneId, version_no AS versionNo, version_status AS versionStatus,
              strategy_json AS strategyJson, adjustment_prompt AS adjustmentPrompt, model_summary AS modelSummary,
              confirmed_at AS confirmedAt, created_at AS createdAt, updated_at AS updatedAt
       FROM lab_scene_strategy_version WHERE id = ? LIMIT 1`,
      [preferredVersionId]
    );
    const version = queryFirst(rows);
      return version
        ? {
            id: Number(version.id),
            sceneId: Number(version.sceneId),
            versionNo: Number(version.versionNo),
            versionStatus: version.versionStatus,
            content: normalizeStrategyDirtyConfig(safeJsonParse(version.strategyJson, {}), scene),
            adjustmentPrompt: version.adjustmentPrompt,
            modelSummary: version.modelSummary
          }
        : null;
  }
  const versions = (await listStrategyVersions(sceneId)).map((item) => ({
    ...item,
    content: normalizeStrategyDirtyConfig(item.content, scene)
  }));
  return versions[0] || null;
}

async function getSceneDetail(id) {
  const scene = await getSceneBase(id);
  const [schemaVersions, strategyVersions, sceneTables, sceneFields, sceneDicts, sceneRelations, topics, tasks, runLogs, qualityReport] = await Promise.all([
    listSchemaVersions(id),
    listStrategyVersions(id),
    listSceneTables(id),
    listSceneFields(id),
    listSceneDicts(id),
    listSceneRelations(id),
    listSceneTopics(id),
    listSceneTasks(id),
    getRunLogs(id),
    getQualityReport(id)
  ]);
  return {
    ...scene,
    schemaVersions,
    strategyVersions: strategyVersions.map((item) => ({
      ...item,
      content: normalizeStrategyDirtyConfig(item.content, scene)
    })),
    sceneTables,
    sceneFields,
    sceneDicts,
    sceneRelations,
    topics,
    tasks,
    runLogs,
    qualityReport
  };
}

async function getKnowledgeText(kbId) {
  if (!kbId) {
    return "";
  }
  const [rows] = await pool.query(
    "SELECT content FROM lab_kb_doc_chunk WHERE kb_id = ? ORDER BY chunk_index ASC LIMIT 20",
    [kbId]
  );
  return rows.map((row) => row.content).join("\n");
}

async function getKnowledgePlanningSummary(kbId, options = {}) {
  if (!kbId) {
    return null;
  }
  const forceRefresh = Boolean(options.forceRefresh);
  const [rows] = await pool.query(
    `SELECT id, industry_type AS industryType, planning_summary_json AS planningSummary
     FROM lab_kb
     WHERE id = ? LIMIT 1`,
    [kbId]
  );
  const kb = queryFirst(rows);
  if (!kb) {
    return null;
  }
  const parsed = safeJsonParse(kb.planningSummary, null);
  if (!forceRefresh && parsed) {
    return parsed;
  }
  const knowledgeText = options.knowledgeText ?? await getKnowledgeText(kbId);
  const summary = scenarioEngine.extractKnowledgePlanningSignals(knowledgeText, kb.industryType || null);
  await updateKnowledgeBasePlanningSummary(kbId, summary);
  return summary;
}

async function refreshKnowledgePlanningSummary(kbId, knowledgeText) {
  return getKnowledgePlanningSummary(kbId, { forceRefresh: true, knowledgeText });
}

async function getDefaultPromptTemplateContent(promptType, fallback) {
  const [rows] = await pool.query(
    `SELECT content
     FROM lab_prompt_template
     WHERE prompt_type = ? AND status = 'active'
     ORDER BY is_default DESC, updated_at DESC
     LIMIT 1`,
    [promptType]
  );
  return queryFirst(rows)?.content || fallback;
}

async function getRuntimePromptConfig(promptType, defaults = {}, variables = {}) {
  const resolved = await promptRuntime.resolveRuntimePromptConfig(promptType, defaults, variables);
  return {
    systemPrompt: resolved.systemPrompt,
    userPrompt: resolved.userPrompt,
    provider: resolved.provider ? normalizeProviderForChat(resolved.provider) : null,
  };
}

async function getSceneGenerateProvider(scene, options = {}) {
  const allowDefault = Boolean(options.allowDefault);
  if (scene?.generateModelId) {
    return modelProviderService.getModelProviderById(scene.generateModelId);
  }
  if (!allowDefault) {
    return null;
  }
  const [rows] = await pool.query(
    `SELECT provider.*
     FROM lab_model_profile profile
     LEFT JOIN model_providers provider ON provider.id = profile.provider_id
     WHERE profile.stage_type = 'SCHEMA'
       AND profile.is_default = 1
       AND profile.status = 'active'
       AND provider.id IS NOT NULL
       AND provider.status = 'active'
     ORDER BY profile.updated_at DESC
     LIMIT 1`
  );
  const profileProvider = queryFirst(rows);
  if (profileProvider) {
    return modelProviderService.getModelProviderById(profileProvider.id);
  }
  const [fallbackRows] = await pool.query(
    `SELECT *
     FROM model_providers
     WHERE model_category = 'chat'
       AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1`
  );
  const fallbackProvider = queryFirst(fallbackRows);
  return fallbackProvider ? modelProviderService.getModelProviderById(fallbackProvider.id) : null;
}

function normalizeProviderForChat(provider) {
  if (!provider) {
    return null;
  }
  return modelProviderService.normalizeRuntimeProvider(provider);
}

async function resolveFieldSemanticMapWithModel(scene, fields) {
  const fieldList = Array.isArray(fields) ? fields : [];
  if (fieldList.length === 0) {
    return {};
  }
  const promptPayload = ruleMatching.buildSemanticClassPrompt(fieldList);
  const promptConfig = await getRuntimePromptConfig(
    "FIELD_SEMANTIC_CLASSIFY",
    {
      systemPrompt: promptDefaults.buildFieldSemanticClassifyDefaultPrompt(),
      userPrompt: promptDefaults.buildFieldSemanticClassifyDefaultUserPrompt(),
    },
    {
      input: promptPayload,
      semanticClasses: promptPayload.semanticClasses,
    }
  );
  const provider = promptConfig.provider || normalizeProviderForChat(await getSceneGenerateProvider(scene, { allowDefault: true }));
  if (!provider) {
    return {};
  }
  try {
    const response = await modelProviderService.generateChatCompletion(
      provider,
      [
        {
          role: "system",
          content: promptConfig.systemPrompt,
        },
        {
          role: "user",
          content: promptConfig.userPrompt,
        },
      ],
      { temperature: promptConfig.temperature, maxTokens: promptConfig.maxTokens }
    );
    const parsed = tryParseJson(response.content);
    const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
    return rows.reduce((result, item) => {
      const key = String(item?.key || "").trim();
      if (!key) return result;
      result[key] = Array.isArray(item?.classes) ? item.classes.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
      return result;
    }, {});
  } catch (error) {
    return {};
  }
}

async function applySemanticFieldRulesToStrategy(scene, schemaContent, strategy) {
  const scenarioProfile = strategy?.scenarioProfile || schemaContent?.scenarioProfile || {};
  const fieldRules = Array.isArray(scenarioProfile.fieldRules) ? scenarioProfile.fieldRules.filter((item) => item.status !== "inactive") : [];
  if (fieldRules.length === 0 || !Array.isArray(strategy?.tables)) {
    return strategy;
  }
  const fields = (schemaContent?.tables || []).flatMap((table) => (table.fields || []).map((field) => ({
    tableName: table.tableName,
    fieldName: field.fieldName,
    fieldComment: field.fieldComment,
    businessSemantic: field.businessSemantic,
    fieldType: field.fieldType,
  })));
  const modelSemanticMap = await resolveFieldSemanticMapWithModel(scene, fields);
  const fieldSemanticMap = ruleMatching.buildFieldSemanticMap(fields, modelSemanticMap);
  const schemaFieldMap = new Map(fields.map((field) => [`${field.tableName}.${field.fieldName}`, field]));
  const next = JSON.parse(JSON.stringify(strategy));
  next.tables = (next.tables || []).map((table) => ({
    ...table,
    fieldGenerators: (table.fieldGenerators || []).map((fieldGenerator) => {
      const field = schemaFieldMap.get(`${table.tableName}.${fieldGenerator.fieldName}`) || {
        tableName: table.tableName,
        fieldName: fieldGenerator.fieldName,
      };
      const matched = ruleMatching.matchFieldRuleForField(fieldRules, field, { fieldSemanticMap, threshold: 0.55 });
      if (!matched?.rule?.generatorType) {
        return fieldGenerator;
      }
      return {
        ...fieldGenerator,
        generatorType: matched.rule.generatorType,
        semanticRuleCode: matched.rule.ruleCode || null,
        semanticRuleScore: matched.score,
      };
    }),
  }));
  return next;
}

async function getLabModelProviderByProfileId(profileId) {
  const [rows] = await pool.query(
    `SELECT provider.*
     FROM lab_model_profile profile
     LEFT JOIN model_providers provider ON provider.id = profile.provider_id
     WHERE profile.id = ?
       AND profile.status = 'active'
       AND provider.id IS NOT NULL
       AND provider.status = 'active'
     LIMIT 1`,
    [profileId]
  );
  return queryFirst(rows) || null;
}

async function buildAutoResearchPack(scene, scenarioProfile) {
  const fallbackPack = autoResearch.buildLocalResearchPack({
    sceneName: scene.sceneName,
    sceneDesc: scene.sceneDesc,
    scenarioProfile,
    modulePlan: scenarioProfile?.modulePlan || null
  });
  const userPayload = {
    sceneName: scene.sceneName,
    sceneDesc: scene.sceneDesc,
    tableCountTarget: { min: 10, max: 15, preferred: 12 },
    inferredIndustry: scenarioProfile?.industry,
    inferredSubdomain: scenarioProfile?.subtype || scenarioProfile?.subScenario || null,
    knowledgeSummary: scenarioProfile?.knowledgeSummary?.summary || scenarioProfile?.knowledgeSummary?.conciseText || null,
    hintCandidateTables: fallbackPack.candidateTables || [],
    hintCandidateTableSpecs: (fallbackPack.candidateTableSpecs || []).map((item) => ({
      tableName: item.tableName,
      tableLabel: item.tableLabel || "",
      tableComment: item.tableComment || item.description || "",
      fields: Array.isArray(item.fields) ? item.fields : [],
    })),
    hintBusinessObjects: fallbackPack.businessObjects || [],
    hintRelationSuggestions: (fallbackPack.relationSuggestions || []).slice(0, 8),
  };
  const promptConfig = await getRuntimePromptConfig(
    "AUTO_RESEARCH",
    {
      systemPrompt: promptDefaults.buildAutoResearchDefaultPrompt(),
      userPrompt: promptDefaults.buildAutoResearchDefaultUserPrompt(),
    },
    {
      ...userPayload,
      input: userPayload,
    }
  );
  const provider = promptConfig.provider || normalizeProviderForChat(await getSceneGenerateProvider(scene, { allowDefault: true }));
  if (!provider) {
    return autoResearch.buildSceneScopedResearchPack(fallbackPack, scenarioProfile, scenarioProfile?.modulePlan || null);
  }
  try {
    const response = await modelProviderService.generateChatCompletion(
      provider,
      [
        { role: "system", content: promptConfig.systemPrompt },
        {
          role: "user",
          content: promptConfig.userPrompt,
        }
      ],
      {
        temperature: Math.min(Number(promptConfig.temperature || 0.1), 0.1),
        maxTokens: Math.min(Number(promptConfig.maxTokens || 800), 800),
        timeoutMs: 60000,
        responseFormat: { type: "json_object" }
      }
    );
    const parsed = tryParseJson(response.content);
    return autoResearch.buildSceneScopedResearchPack(
      autoResearch.normalizeResearchPack(parsed, fallbackPack),
      scenarioProfile,
      scenarioProfile?.modulePlan || null
    );
  } catch (error) {
    return autoResearch.buildSceneScopedResearchPack(fallbackPack, scenarioProfile, scenarioProfile?.modulePlan || null);
  }
}

async function generateSchema(payload) {
  const scene = await getSceneBase(payload.sceneId);
  if (!scene.industryKbId) {
    throw new AppError("当前场景未绑定行业知识库，请先回到场景定义页完成选择", 400);
  }
  const {
    knowledgeText,
    knowledgePlanningSummary,
    scenarioProfile,
    researchPack,
  } = await buildSceneAnalysisContext(scene);
  let baseSchema;
  try {
    baseSchema = generator.generateSchemaPayload({
      sceneName: scene.sceneName,
      sceneDesc: scene.sceneDesc,
      knowledgeText,
      knowledgePlanningSummary,
      researchPack,
      autoResearchMode: true,
      industryKbId: scene.industryKbId || null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_SCENE_SPECIFIC_SCHEMA_TEMPLATE") {
      throw new AppError("当前场景未生成有效候选数据表，已禁止回退为泛化主题表/事件表。请补充更具体的场景描述，或补充行业知识库内容。", 400);
    }
    throw error;
  }
  const schema = enrichGeneratedSchema(
    await tryGenerateSchemaWithModelV2(scene, knowledgeText, baseSchema, { allowDefaultModel: false })
  );
  const [versionRows] = await pool.query(
    "SELECT COALESCE(MAX(version_no), 0) + 1 AS nextVersion FROM lab_scene_schema_version WHERE scene_id = ?",
    [scene.id]
  );
  const versionNo = Number(versionRows[0].nextVersion || 1);
  const [result] = await pool.query(
    `INSERT INTO lab_scene_schema_version
      (scene_id, version_no, version_status, schema_json, adjustment_history_json, model_summary)
     VALUES (?, ?, 'GENERATED', ?, ?, ?)`,
    [scene.id, versionNo, JSON.stringify(schema), JSON.stringify(schema.adjustments || []), "已结合场景描述和知识库生成结构设计"]
  );
  await pool.query(
    "UPDATE lab_scene SET status = 'SCHEMA_PENDING_CONFIRM', stage_status = 'SCHEMA_PENDING_CONFIRM', current_schema_version = ? WHERE id = ?",
    [versionNo, scene.id]
  );
  await logOperation("GENERATE_SCHEMA", "system", scene.id, payload, `生成结构版本 ${versionNo}`);
  return getCurrentSchemaVersion(scene.id, result.insertId);
}

async function analyzeScene(payload) {
  const scene = await getSceneBase(payload.sceneId);
  if (!scene.industryKbId) {
    throw new AppError("当前场景未绑定行业知识库，请先回到场景定义页完成选择", 400);
  }
  const analysis = await buildSceneAnalysisContext(scene);
  return {
    sceneId: scene.id,
    sceneName: scene.sceneName,
    sceneDesc: scene.sceneDesc,
    industryKbIds: scene.industryKbIds || [],
    industryKbNames: (analysis.knowledgeBases || []).map((item) => item.kbName),
    industryKbId: scene.industryKbId,
    industryKbName: scene.industryKbName,
    scenarioProfile: analysis.scenarioProfile,
    researchPack: analysis.researchPack,
    modulePlan: analysis.modulePlan,
    conceptPlan: analysis.conceptPlan,
    summary: analysis.researchPack?.summary || analysis.modulePlan?.summary || analysis.conceptPlan?.summary || null,
  };
}

async function tryGenerateSchemaWithModel(scene, knowledgeText, fallback, options = {}) {
  try {
    const promptConfig = await getRuntimePromptConfig(
      "SCHEMA_DESIGN",
      {
        systemPrompt: promptDefaults.buildSchemaDesignDefaultPrompt(),
        userPrompt: promptDefaults.buildSchemaDesignDefaultUserPrompt(),
      },
      {
        input: {
          sceneName: scene.sceneName,
          sceneDesc: scene.sceneDesc,
          knowledgeText,
          researchPack: fallback.researchPack || null,
        },
      }
    );
    const provider = promptConfig.provider || normalizeProviderForChat(await getSceneGenerateProvider(scene, { allowDefault: Boolean(options.allowDefaultModel) }));
    if (!provider) {
      return fallback;
    }
    const response = await modelProviderService.generateChatCompletion(
      provider,
      [
        { role: "system", content: "你是数据建模助手，请输出合法 JSON，字段包含 sceneName、tables、dictTables、relations、modelExplanation。" },
        { role: "user", content: JSON.stringify({ sceneName: scene.sceneName, sceneDesc: scene.sceneDesc, knowledgeText, researchPack: fallback.researchPack || null }, null, 2) }
      ],
      { temperature: promptConfig.temperature, maxTokens: promptConfig.maxTokens }
    );
    const parsed = tryParseJson(response.content);
    return normalizeGeneratedSchema(parsed, fallback);
  } catch (error) {
    return fallback;
  }
}

async function tryGenerateSchemaWithModelV2(scene, knowledgeText, fallback, options = {}) {
  try {
    const researchPack = fallback.researchPack || null;
    const profile = fallback.scenarioProfile || {};
    const planningContract = researchPack ? {
      sceneObjective: {
        sceneName: scene.sceneName,
        sceneDesc: scene.sceneDesc,
        targetTableCount: 12,
        minTableCount: 10,
        maxTableCount: 15,
      },
      candidateTables: researchPack.candidateTables || [],
      candidateTableSpecs: researchPack.candidateTableSpecs || [],
      relationSuggestions: (researchPack.relationSuggestions || []).slice(0, 12),
      dictSuggestions: (Array.isArray(researchPack.dictSuggestionSpecs) && researchPack.dictSuggestionSpecs.length > 0
        ? researchPack.dictSuggestionSpecs
        : (researchPack.dictSuggestions || []))
        .slice(0, 8)
        .map((item) => (typeof item === "object" && item !== null
          ? {
            tableName: item.tableName,
            dictType: item.dictType,
            dictName: item.dictName,
            tableComment: item.tableComment,
            values: item.values || [],
          }
          : item)),
      fieldSemantics: (Array.isArray(profile.fieldSemantics) ? profile.fieldSemantics : []).slice(0, 20),
      stateMachines: (Array.isArray(profile.stateMachines) ? profile.stateMachines : [])
        .slice(0, 6)
        .map((item) => ({
          tableName: item.tableName,
          stateField: item.stateField,
          allowedStates: item.allowedStates || [],
        })),
      requiredFieldsByTable: profile?.schemaGuides?.requiredFieldsByTable || {},
      industry: researchPack.industry,
      businessObjects: researchPack.businessObjects || [],
    } : null;
    const userPayload = {
      sceneName: scene.sceneName,
      sceneDesc: scene.sceneDesc,
      tableCountTarget: { min: 10, max: 15, preferred: 12 },
      knowledgeText: knowledgeText ? String(knowledgeText).slice(0, 400) : null,
      planningContract,
    };
    const promptConfig = await getRuntimePromptConfig(
      "SCHEMA_DESIGN",
      {
        systemPrompt: promptDefaults.buildSchemaDesignDefaultPrompt(),
        userPrompt: promptDefaults.buildSchemaDesignDefaultUserPrompt(),
      },
      {
        ...userPayload,
        input: userPayload,
      }
    );
    const provider = promptConfig.provider || normalizeProviderForChat(await getSceneGenerateProvider(scene, { allowDefault: Boolean(options.allowDefaultModel) }));
    if (!provider) {
      return fallback;
    }
    const response = await modelProviderService.generateChatCompletion(
      provider,
      [
        { role: "system", content: promptConfig.systemPrompt },
        { role: "user", content: promptConfig.userPrompt }
      ],
      {
        temperature: Math.min(Number(promptConfig.temperature || 0.1), 0.1),
        maxTokens: Math.min(Number(promptConfig.maxTokens || 900), 900),
        timeoutMs: 90000,
        responseFormat: { type: "json_object" }
      }
    );
    const parsed = tryParseJson(response.content);
    return normalizeGeneratedSchema(parsed, fallback);
  } catch (error) {
    return fallback;
  }
}

function tryParseJson(text) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch (error) {
    const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidates = [];
    if (fencedMatch?.[1]) {
      candidates.push(fencedMatch[1].trim());
    }
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) {
      candidates.push(objectMatch[0].trim());
    }
    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch (nestedError) {
        continue;
      }
    }
    return null;
  }
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|[;；]/)
      .map((item) => String(item || "").replace(/^[-*•\d.\s]+/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function extractNumericScoreFromText(text) {
  const raw = String(text || "");
  const scoreMatch = raw.match(/(?:realism\s*score|score|评分|真实度|真实性评分)[^\d]{0,8}(\d+(?:\.\d+)?)/i);
  return scoreMatch ? Number(scoreMatch[1]) : null;
}

function extractBooleanPassFromText(text) {
  const raw = String(text || "");
  if (/(?:pass|passed|通过|符合|整体合理)/i.test(raw) && !/(?:not pass|failed|不通过|不符合|明显不合理)/i.test(raw)) {
    return true;
  }
  if (/(?:not pass|failed|不通过|不符合|明显不合理)/i.test(raw)) {
    return false;
  }
  return null;
}

function extractBulletLinesByKeywords(text, keywords = []) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .filter((line) => /^[-*•]/.test(line) || /^\d+[.)、]/.test(line) || keywords.some((keyword) => line.toLowerCase().includes(String(keyword).toLowerCase())))
    .map((line) => line.replace(/^[-*•\d.)、\s]+/, "").trim())
    .filter(Boolean);
}

function buildHeuristicRealismReview(rawText) {
  const normalized = String(rawText || "").trim();
  if (!normalized) {
    return null;
  }
  const findings = extractBulletLinesByKeywords(normalized, ["问题", "异常", "不合理", "不真实", "fake", "issue", "invalid", "mismatch", "冲突", "失真"]);
  const obviousFakePatterns = extractBulletLinesByKeywords(normalized, ["一眼假", "模板化", "顺序编号", "占位", "假数据", "fake pattern", "pattern"]);
  const recommendations = extractBulletLinesByKeywords(normalized, ["建议", "优化", "改进", "修复", "should", "recommend", "fix", "improve"]);
  const firstSentence = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] || "";
  const realismScore = extractNumericScoreFromText(normalized);
  const pass = extractBooleanPassFromText(normalized);
  if (!firstSentence && findings.length === 0 && recommendations.length === 0 && realismScore === null && pass === null) {
    return null;
  }
  return {
    pass,
    realismScore,
    summary: firstSentence || "Model realism review returned unstructured content.",
    findings,
    obviousFakePatterns,
    recommendations,
  };
}

async function repairRealismReviewOutput(provider, rawText) {
  try {
    const response = await modelProviderService.generateChatCompletion(
      normalizeProviderForChat(provider),
      [
        {
          role: "system",
          content: "你是JSON修复助手。请把输入的真实性评审文本整理为一个合法JSON对象，只输出JSON，不要Markdown，不要解释。字段固定为：pass(boolean|null)、realismScore(number|null)、summary(string)、findings(string[])、obviousFakePatterns(string[])、recommendations(string[])。"
        },
        {
          role: "user",
          content: JSON.stringify({ rawText }, null, 2)
        }
      ],
      { temperature: 0, maxTokens: 900 }
    );
    return tryParseJson(response.content);
  } catch (error) {
    return null;
  }
}

function normalizeRealismResponsePayload(parsed, rawText) {
  const payload = parsed && typeof parsed === "object" && Object.keys(parsed).length > 0
    ? parsed
    : buildHeuristicRealismReview(rawText);
  if (!payload || typeof payload !== "object") {
    return {
      payload: {},
      structured: false,
      parseMode: "raw_text",
    };
  }
  return {
    payload: {
      pass: payload.pass ?? null,
      realismScore: payload.realismScore ?? null,
      summary: typeof payload.summary === "string" ? payload.summary.trim() : "",
      findings: normalizeStringList(payload.findings),
      obviousFakePatterns: normalizeStringList(payload.obviousFakePatterns),
      recommendations: normalizeStringList(payload.recommendations),
    },
    structured: Boolean(parsed && typeof parsed === "object" && Object.keys(parsed).length > 0),
    parseMode: Boolean(parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) ? "json" : "heuristic",
  };
}

function pickText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function normalizeStrategyDirtyConfig(content, scene) {
  const next = content && typeof content === "object" ? JSON.parse(JSON.stringify(content)) : {};
  next.globalConfig = next.globalConfig || {};
  const dirtyConfig = normalizeDirtyConfig(
    next.globalConfig.dirtyRatio ?? scene?.dirtyRatio ?? 0,
    next.globalConfig.dirtyEnabled ?? scene?.dirtyEnabled
  );
  next.globalConfig.dirtyRatio = dirtyConfig.dirtyRatio;
  next.globalConfig.dirtyEnabled = dirtyConfig.dirtyEnabled;
  return next;
}

function humanizeIdentifier(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const IDENTIFIER_TOKEN_ZH_MAP = {
  traffic: "交通",
  order: "秩序",
  road: "道路",
  vehicle: "车辆",
  violation: "违法",
  penalty: "处罚",
  decision: "裁决",
  appeal: "申诉",
  record: "记录",
  monitoring: "监测",
  flow: "流量",
  facility: "设施",
  management: "管理",
  organization: "组织",
  plan: "方案",
  implementation: "实施",
  evaluation: "评估",
  index: "指标",
  emergency: "应急",
  resource: "资源",
  inventory: "库存",
  dispatch: "调度",
  education: "教育",
  supervision: "监管",
  safety: "安全",
  assessment: "评估",
  credit: "信用",
  enterprise: "企业",
  infrastructure: "基础设施",
  construction: "建设",
  maintenance: "养护",
  operation: "运营",
  status: "状态",
  state: "状态",
  type: "类型",
  category: "分类",
  level: "等级",
  grade: "等级",
  channel: "渠道",
  source: "来源",
  mode: "方式",
  result: "结果",
  role: "角色",
  code: "编码",
  business: "业务",
  data: "数据",
};

function buildChineseIdentifier(value) {
  const tokens = String(value || "").trim().split(/[_-]+/).filter(Boolean);
  if (tokens.length === 0) return "";
  return tokens.map((token) => IDENTIFIER_TOKEN_ZH_MAP[token.toLowerCase()] || token).join("");
}

function isGenericTableComment(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  return /^(业务数据表|数据表|表|业务表|信息表|数据信息表)$/i.test(text);
}

function buildSpecificTableComment(tableName, tableLabel) {
  const label = String(tableLabel || "").trim();
  if (label) {
    if (/(字典|枚举|代码表)$/.test(label)) return label;
    if (/(记录|明细|台账|档案|计划|结果|信息|文书|日志|流水|清单|关系)$/.test(label)) return `${label}表`;
    return `${label}信息`;
  }
  const humanized = humanizeIdentifier(tableName);
  return humanized ? `${humanized} information` : "业务信息";
}

function buildDictComment(dictName, tableName) {
  const label = String(dictName || "").trim() || humanizeIdentifier(tableName);
  if (!label) return "字典";
  return /(字典|枚举|代码表)$/.test(label) ? label : `${label}字典`;
}

function buildDefaultDictValues(fieldName) {
  const normalized = String(fieldName || "").toLowerCase();
  if (/(status|state|flag|result)$/.test(normalized)) {
    return [
      { dictKey: "01", dictValue: "待处理", sortOrder: 1 },
      { dictKey: "02", dictValue: "处理中", sortOrder: 2 },
      { dictKey: "03", dictValue: "已完成", sortOrder: 3 },
    ];
  }
  if (/(type|category|kind|mode)$/.test(normalized)) {
    return [
      { dictKey: "01", dictValue: "类型一", sortOrder: 1 },
      { dictKey: "02", dictValue: "类型二", sortOrder: 2 },
      { dictKey: "03", dictValue: "类型三", sortOrder: 3 },
    ];
  }
  if (/(level|grade|rank)$/.test(normalized)) {
    return [
      { dictKey: "01", dictValue: "一级", sortOrder: 1 },
      { dictKey: "02", dictValue: "二级", sortOrder: 2 },
      { dictKey: "03", dictValue: "三级", sortOrder: 3 },
    ];
  }
  if (/(channel|source)$/.test(normalized)) {
    return [
      { dictKey: "01", dictValue: "线上", sortOrder: 1 },
      { dictKey: "02", dictValue: "线下", sortOrder: 2 },
      { dictKey: "03", dictValue: "其他", sortOrder: 3 },
    ];
  }
  return [
    { dictKey: "01", dictValue: "选项一", sortOrder: 1 },
    { dictKey: "02", dictValue: "选项二", sortOrder: 2 },
    { dictKey: "99", dictValue: "其他", sortOrder: 99 },
  ];
}

function resolveProfileDictValues(dictKey, profile) {
  const normalized = String(dictKey || "").toLowerCase();
  if (!profile || typeof profile !== "object") {
    return [];
  }
  const sources = [];
  if (normalized.includes("violation")) sources.push(profile.violationCodes, profile.violationStatuses);
  if (normalized.includes("inspection")) sources.push(profile.inspectionResults);
  if (normalized.includes("vehicle")) sources.push(profile.vehicleTypes);
  if (normalized.includes("status")) sources.push(profile.violationStatuses, profile.inspectionResults);
  const values = [];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      const key = String(item?.code || item?.dictKey || item?.id || "").trim();
      const label = String(item?.label || item?.dictValue || item?.name || "").trim();
      if (!key || !label) continue;
      values.push({ dictKey: key, dictValue: label, sortOrder: values.length + 1 });
    }
  }
  return Array.from(new Map(values.map((item) => [item.dictKey, item])).values());
}

function buildSpecificTableCommentV2(tableName, tableLabel) {
  const label = String(tableLabel || "").trim();
  if (label) {
    return /(记录|明细|台账|档案|计划|结果|信息|文书|日志|流水|清单|关系|指标|方案|实施|监测|评估|管理|字典)$/.test(label)
      ? `${label}表`
      : `${label}信息`;
  }
  const chinese = buildChineseIdentifier(tableName);
  if (chinese) {
    return /(记录|明细|台账|档案|计划|结果|信息|文书|日志|流水|清单|关系|指标|方案|实施|监测|评估|管理|字典)$/.test(chinese)
      ? `${chinese}表`
      : `${chinese}信息`;
  }
  const humanized = humanizeIdentifier(tableName);
  return humanized ? `${humanized} information` : "业务信息";
}

function buildDictCommentV2(dictName, tableName) {
  const label = String(dictName || "").trim() || buildChineseIdentifier(tableName) || humanizeIdentifier(tableName);
  if (!label) return "字典";
  return /(字典|枚举|代码表)$/.test(label) ? label : `${label}字典`;
}

function inferBusinessRelatedDictTables(tables, existingDictTables = [], profile = null) {
  const dictMap = new Map((existingDictTables || []).map((item) => [String(item.tableName || "").trim(), item]));
  const fieldSeen = new Set();
  for (const table of tables || []) {
    for (const field of table.fields || []) {
      const fieldName = String(field.fieldName || "").trim();
      if (!fieldName) continue;
      if (/^scene_[a-z0-9]+$/i.test(fieldName)) continue;
      const semantic = String(field.businessSemantic || "").toUpperCase();
      const shouldBuild = (
        /(status|state|flag|type|category|kind|level|grade|rank|channel|source|mode|result|role)$/.test(fieldName.toLowerCase())
        || semantic.startsWith("DICT_")
      );
      if (!shouldBuild) continue;
      const key = `${table.tableName}.${fieldName}`;
      if (fieldSeen.has(key)) continue;
      fieldSeen.add(key);
      const dictTableName = `${fieldName}_dict`;
      if (dictMap.has(dictTableName)) continue;
      const dictName = `${humanizeIdentifier(fieldName)}字典`;
      const values = resolveProfileDictValues(fieldName, profile);
      dictMap.set(dictTableName, {
        tableName: dictTableName,
        dictName,
        tableComment: buildDictComment(dictName, dictTableName),
        referenceField: fieldName,
        values: values.length > 0 ? values : buildDefaultDictValues(fieldName),
      });
    }
  }
  return Array.from(dictMap.values());
}

function buildSpecificTableCommentV3(tableName, tableLabel, tableComment) {
  const explicitLabel = pickText(
    looksLikeChineseLabel(tableLabel) ? trimChineseLabel(tableLabel) : "",
    looksLikeChineseLabel(tableComment) ? trimChineseLabel(tableComment) : ""
  );
  return explicitLabel || buildBusinessTableChineseName(tableName, tableComment || tableLabel);
}

function buildDictCommentV3(dictName, tableName) {
  const label = buildDictChineseName(dictName, tableName);
  return label ? `${label}\u5b57\u5178` : "\u5b57\u5178";
}

function buildKnowledgeHintMaps(source) {
  const pack = source?.researchPack && typeof source.researchPack === "object" ? source.researchPack : source || {};
  const tableMap = new Map();
  const dictMap = new Map();
  for (const item of Array.isArray(pack.candidateTableSpecs) ? pack.candidateTableSpecs : []) {
    const tableName = String(item?.tableName || "").trim();
    if (!tableName) continue;
    tableMap.set(tableName, item);
  }
  for (const item of Array.isArray(pack.dictSuggestionSpecs) ? pack.dictSuggestionSpecs : []) {
    const tableName = String(item?.tableName || "").trim();
    const dictType = String(item?.dictType || "").trim();
    const referenceField = String(item?.referenceField || "").trim();
    for (const key of Array.from(new Set([
      tableName,
      tableName.replace(/_dict$/i, ""),
      dictType,
      `${dictType}_dict`,
      referenceField,
      `${referenceField}_dict`,
    ].filter(Boolean)))) {
      dictMap.set(key, item);
    }
  }
  return { tableMap, dictMap };
}

function findKnowledgeTableHint(knowledgeHints, tableName) {
  return knowledgeHints?.tableMap?.get(String(tableName || "").trim()) || null;
}

function findKnowledgeDictHint(knowledgeHints, key) {
  const normalized = String(key || "").trim();
  if (!normalized) return null;
  return knowledgeHints?.dictMap?.get(normalized)
    || knowledgeHints?.dictMap?.get(normalized.replace(/_dict$/i, ""))
    || knowledgeHints?.dictMap?.get(`${normalized}_dict`)
    || null;
}

function selectKnowledgeBackedDictValues(fieldName, dictHint, profile, currentValues = []) {
  const hintValues = normalizeKnowledgeDictValues(dictHint?.values);
  if (hintValues.length > 0) {
    return hintValues;
  }
  const normalizedCurrent = normalizeKnowledgeDictValues(currentValues);
  if (normalizedCurrent.length > 0 && !usesPlaceholderDictValues(normalizedCurrent)) {
    return normalizedCurrent;
  }
  const profileValues = normalizeKnowledgeDictValues(resolveProfileDictValues(fieldName, profile));
  if (profileValues.length > 0) {
    return profileValues;
  }
  return normalizeKnowledgeDictValues(buildDefaultDictValues(fieldName));
}

function inferBusinessRelatedDictTablesV2(tables, existingDictTables = [], profile = null, knowledgeHints = null) {
  const dictMap = new Map((existingDictTables || []).map((item) => [String(item.tableName || "").trim(), item]));
  const fieldSeen = new Set();
  for (const table of tables || []) {
    for (const field of table.fields || []) {
      const fieldName = String(field.fieldName || "").trim();
      if (!fieldName || /^scene_[a-z0-9]+$/i.test(fieldName)) continue;
      const semantic = String(field.businessSemantic || "").toUpperCase();
      const shouldBuild = /(status|state|flag|type|category|kind|level|grade|rank|channel|source|mode|result|role)$/.test(fieldName.toLowerCase())
        || semantic.startsWith("DICT_");
      if (!shouldBuild) continue;
      const fieldKey = `${table.tableName}.${fieldName}`;
      if (fieldSeen.has(fieldKey)) continue;
      fieldSeen.add(fieldKey);
      const dictHint = findKnowledgeDictHint(knowledgeHints, fieldName);
      const dictTableName = String(dictHint?.tableName || `${fieldName}_dict`).trim();
      if (dictMap.has(dictTableName)) continue;
      const dictName = buildDictChineseName(dictHint?.dictName, dictTableName);
      dictMap.set(dictTableName, {
        tableName: dictTableName,
        dictName,
        tableComment: buildDictCommentV3(dictName, dictTableName),
        referenceField: fieldName,
        values: selectKnowledgeBackedDictValues(fieldName, dictHint, profile, dictHint?.values),
      });
    }
  }
  return Array.from(dictMap.values());
}

function deriveRelationsFromTables(tables = []) {
  return (tables || []).flatMap((table) =>
    (table.fields || [])
      .filter((field) => field.foreignKey && field.foreignRefTable && field.fieldName)
      .map((field) => ({
        fromTable: field.foreignRefTable,
        fromField: field.foreignRefField || "id",
        toTable: table.tableName,
        toField: field.fieldName,
        relationType: "1:N",
      }))
  );
}

function normalizeSchemaField(field, fallbackField, index) {
  const source = field && typeof field === "object" ? field : {};
  const fallback = fallbackField && typeof fallbackField === "object" ? fallbackField : {};
  const primaryKey = Boolean(source.primaryKey || fallback.primaryKey);
  const foreignKey = Boolean(source.foreignKey || fallback.foreignKey);
  const uniqueKey = Boolean(source.uniqueKey || fallback.uniqueKey || primaryKey);
  const fieldType = primaryKey || foreignKey
    ? (fallback.fieldType || source.fieldType || "BIGINT")
    : (source.fieldType || fallback.fieldType || "VARCHAR");
  const nullable = primaryKey || foreignKey ? false : (source.nullable ?? fallback.nullable ?? true);

  return {
    fieldName: source.fieldName || fallback.fieldName || `field_${index + 1}`,
    fieldType,
    fieldLength: source.fieldLength ?? fallback.fieldLength ?? (String(fieldType).toUpperCase() === "VARCHAR" ? 128 : null),
    nullable,
    primaryKey,
    uniqueKey,
    foreignKey,
    foreignRefTable: source.foreignRefTable || fallback.foreignRefTable || "",
    foreignRefField: source.foreignRefField || fallback.foreignRefField || "",
    defaultValue: source.defaultValue ?? fallback.defaultValue ?? null,
    fieldComment: pickText(source.fieldComment, fallback.fieldComment) || `${humanizeIdentifier(source.fieldName || fallback.fieldName || `field_${index + 1}`)}字段`,
    businessSemantic: source.businessSemantic || fallback.businessSemantic || "",
    validationRule: source.validationRule || fallback.validationRule || "",
    dirtyRuleCandidates: Array.isArray(source.dirtyRuleCandidates) ? source.dirtyRuleCandidates : (fallback.dirtyRuleCandidates || [])
  };
}

function normalizeSchemaTable(table, fallbackTable, index) {
  const source = table && typeof table === "object" ? table : {};
  const fallback = fallbackTable && typeof fallbackTable === "object" ? fallbackTable : {};
  const fallbackFields = Array.isArray(fallback.fields) ? fallback.fields : [];
  const sourceFields = Array.isArray(source.fields)
    ? source.fields.filter((field) => !/^ext_field_\d+$/i.test(String(field?.fieldName || "")))
    : [];

  // AI source fields are primary; fallback supplements missing fields
  const normalizedFields = sourceFields.map((field, fieldIndex) =>
    normalizeSchemaField(
      field,
      fallbackFields.find((item) => item?.fieldName === field.fieldName) || {},
      fieldIndex
    )
  );

  fallbackFields
    .filter((field) => field && !sourceFields.some((item) => item?.fieldName === field.fieldName))
    .forEach((field, fieldIndex) => normalizedFields.push(normalizeSchemaField({}, field, sourceFields.length + fieldIndex)));

  const resolvedTableName = source.tableName || fallback.tableName || `table_${index + 1}`;
  const resolvedTableLabel = pickText(source.tableLabel, source.tableNameZh, fallback.tableLabel) || null;
  const explicitComment = pickText(
    isGenericTableComment(source.tableComment) ? "" : source.tableComment,
    isGenericTableComment(fallback.tableComment) ? "" : fallback.tableComment
  );

  return {
    tableName: resolvedTableName,
    tableLabel: resolvedTableLabel,
    tableComment: buildSpecificTableCommentV2(resolvedTableName, resolvedTableLabel),
    businessRole: source.businessRole || fallback.businessRole || "DETAIL",
    generationPriority: Number(source.generationPriority || fallback.generationPriority || index + 1),
    fields: normalizedFields
  };
}

function normalizeDictTable(dictTable, fallbackDictTable, index) {
  const source = dictTable && typeof dictTable === "object" ? dictTable : {};
  const fallback = fallbackDictTable && typeof fallbackDictTable === "object" ? fallbackDictTable : {};
  const fallbackValues = Array.isArray(fallback.values) ? fallback.values : [];
  const sourceValues = Array.isArray(source.values) ? source.values : fallbackValues;

  const rawDictComment = pickText(source.tableComment, fallback.tableComment) || buildDictCommentV2(pickText(source.dictName, fallback.dictName), source.tableName || fallback.tableName || `dict_${index + 1}`);
  // Remove trailing duplicate "字典" (e.g. "列车状态字典字典" → "列车状态字典")
  const dictComment = rawDictComment.replace(/字典字典$/, "字典");
  return {
    tableName: source.tableName || fallback.tableName || `dict_${index + 1}`,
    dictName: pickText(source.dictName, fallback.dictName) || buildChineseIdentifier(source.tableName || fallback.tableName || `dict_${index + 1}`) || humanizeIdentifier(source.tableName || fallback.tableName || `dict_${index + 1}`) || null,
    tableComment: dictComment,
    values: sourceValues.map((item, itemIndex) => ({
      dictKey: item?.dictKey || `key_${itemIndex + 1}`,
      dictValue: item?.dictValue || "",
      sortOrder: Number(item?.sortOrder || itemIndex + 1)
    }))
  };
}

function isUsefulDictTable(dictTable) {
  const tableName = String(dictTable?.tableName || "").trim().toLowerCase();
  const tableComment = String(dictTable?.tableComment || "").trim();
  if (!tableName) return false;
  if (/^scene_[a-z0-9]+_dict$/.test(tableName)) return false;
  if (/^\d+_dict$/.test(tableName)) return false;
  if (/^(业务数据表|数据表|表)$/i.test(tableComment)) return false;
  return true;
}

function normalizeSchemaRelations(relations, fallbackRelations) {
  const source = Array.isArray(relations) && relations.length > 0 ? relations : fallbackRelations || [];
  return source
    .filter((item) => item?.fromTable && item?.fromField && item?.toTable && item?.toField)
    .map((item) => ({
      fromTable: item.fromTable,
      fromField: item.fromField,
      toTable: item.toTable,
      toField: item.toField,
      relationType: item.relationType || "1:N"
    }));
}

function normalizeGeneratedSchema(parsed, fallback) {
  if (!parsed || !Array.isArray(parsed.tables)) {
    return fallback;
  }

  const fallbackTables = Array.isArray(fallback.tables) ? fallback.tables : [];
  const sourceTables = parsed.tables;

  // AI output is primary: iterate AI tables, supplement with fallback metadata where AI is sparse
  const normalizedTables = sourceTables.map((table, index) =>
    normalizeSchemaTable(
      table,
      fallbackTables.find((item) => item?.tableName === table.tableName) || {},
      index
    )
  );

  // In autoResearchMode, only include fallback tables that AI didn't cover (preserve planning contract coverage)
  const allowOutOfPlanTables = !(fallback?.autoResearchMode === true && sourceTables.length > 0);
  if (allowOutOfPlanTables) {
    fallbackTables
      .filter((table) => table && !sourceTables.some((item) => item?.tableName === table.tableName))
      .forEach((table, index) => normalizedTables.push(normalizeSchemaTable({}, table, sourceTables.length + index)));
  }

  const knowledgeDictTables = Array.from(new Map(
    Array.from(knowledgeHints.dictMap?.values?.() || [])
      .map((item) => [String(item?.tableName || "").trim(), item])
  ).values()).filter((item) => isUsefulDictTable(item));
  const fallbackDictTables = [
    ...(Array.isArray(fallback.dictTables) ? fallback.dictTables : []),
    ...knowledgeDictTables,
  ].filter((item, index, array) =>
    isUsefulDictTable(item) && index === array.findIndex((entry) => entry?.tableName === item?.tableName)
  );
  const sourceDictTables = (Array.isArray(parsed.dictTables) ? parsed.dictTables : []).filter((item) => isUsefulDictTable(item));

  // Dict tables: AI output primary, fallback supplements missing entries
  const normalizedDictTables = sourceDictTables.map((item, index) =>
    normalizeDictTable(
      item,
      fallbackDictTables.find((dict) => dict?.tableName === item?.tableName) || {},
      index
    )
  );
  fallbackDictTables
    .filter((table) => table && !sourceDictTables.some((item) => item?.tableName === table.tableName))
    .forEach((table, index) => normalizedDictTables.push(normalizeDictTable({}, table, sourceDictTables.length + index)));

  const enrichedDictTables = inferBusinessRelatedDictTables(normalizedTables, normalizedDictTables, fallback.scenarioProfile || null).map((item, index) =>
    normalizeDictTable(item, normalizedDictTables.find((dict) => dict?.tableName === item.tableName) || {}, index)
  ).filter((item) => isUsefulDictTable(item));

  return {
    ...fallback,
    ...parsed,
    tables: normalizedTables,
    dictTables: enrichedDictTables,
    relations: normalizeSchemaRelations(parsed.relations, fallback.relations)
  };
}

function enrichGeneratedSchema(schema) {
  const next = schema && typeof schema === "object" ? JSON.parse(JSON.stringify(schema)) : {};
  const normalizedTables = (Array.isArray(next.tables) ? next.tables : []).map((table, index) =>
    normalizeSchemaTable(table, table, index)
  );
  const normalizedDictTables = inferBusinessRelatedDictTables(
    normalizedTables,
    (Array.isArray(next.dictTables) ? next.dictTables : [])
      .filter((dictTable) => isUsefulDictTable(dictTable))
      .map((dictTable, index) => normalizeDictTable(dictTable, dictTable, index)),
    next.scenarioProfile || null
  ).map((dictTable, index) => normalizeDictTable(dictTable, dictTable, index))
    .filter((dictTable) => isUsefulDictTable(dictTable));
  return {
    ...next,
    tables: normalizedTables,
    dictTables: normalizedDictTables,
    relations: normalizeSchemaRelations(next.relations, deriveRelationsFromTables(normalizedTables)),
  };
}

function normalizeSchemaTable(table, fallbackTable, index) {
  const source = table && typeof table === "object" ? table : {};
  const fallback = fallbackTable && typeof fallbackTable === "object" ? fallbackTable : {};
  const fallbackFields = Array.isArray(fallback.fields) ? fallback.fields : [];
  const sourceFields = Array.isArray(source.fields)
    ? source.fields.filter((field) => !/^ext_field_\d+$/i.test(String(field?.fieldName || "")))
    : [];
  const normalizedFields = sourceFields.map((field, fieldIndex) =>
    normalizeSchemaField(
      field,
      fallbackFields.find((item) => item?.fieldName === field.fieldName) || {},
      fieldIndex
    )
  );
  fallbackFields
    .filter((field) => field && !sourceFields.some((item) => item?.fieldName === field.fieldName))
    .forEach((field, fieldIndex) => normalizedFields.push(normalizeSchemaField({}, field, sourceFields.length + fieldIndex)));

  const resolvedTableName = source.tableName || fallback.tableName || `table_${index + 1}`;
  const resolvedTableLabel = pickText(source.tableLabel, source.tableNameZh, fallback.tableLabel) || null;
  const explicitComment = pickText(
    isGenericTableComment(source.tableComment) ? "" : source.tableComment,
    isGenericTableComment(fallback.tableComment) ? "" : fallback.tableComment
  ) || null;

  return {
    tableName: resolvedTableName,
    tableLabel: resolvedTableLabel,
    tableComment: buildSpecificTableCommentV3(resolvedTableName, resolvedTableLabel, explicitComment),
    businessRole: source.businessRole || fallback.businessRole || "DETAIL",
    generationPriority: Number(source.generationPriority || fallback.generationPriority || index + 1),
    fields: normalizedFields,
  };
}

function normalizeDictTable(dictTable, fallbackDictTable, index) {
  const source = dictTable && typeof dictTable === "object" ? dictTable : {};
  const fallback = fallbackDictTable && typeof fallbackDictTable === "object" ? fallbackDictTable : {};
  const fallbackValues = Array.isArray(fallback.values) ? fallback.values : [];
  const sourceValues = Array.isArray(source.values) ? source.values : fallbackValues;
  const resolvedTableName = source.tableName || fallback.tableName || `dict_${index + 1}`;
  const resolvedDictName = buildDictChineseName(pickText(source.dictName, fallback.dictName), resolvedTableName);
  const mergedValues = usesPlaceholderDictValues(sourceValues) && fallbackValues.length > 0
    ? normalizeKnowledgeDictValues(fallbackValues)
    : normalizeKnowledgeDictValues(sourceValues);

  return {
    tableName: resolvedTableName,
    dictName: resolvedDictName || null,
    tableComment: buildDictCommentV3(resolvedDictName, resolvedTableName),
    referenceField: pickText(source.referenceField, fallback.referenceField) || resolvedTableName.replace(/_dict$/i, ""),
    values: mergedValues.map((item, itemIndex) => ({
      dictKey: item?.dictKey || `key_${itemIndex + 1}`,
      dictValue: item?.dictValue || "",
      sortOrder: Number(item?.sortOrder || itemIndex + 1),
    })),
  };
}

function normalizeGeneratedSchema(parsed, fallback) {
  if (!parsed || !Array.isArray(parsed.tables)) {
    return fallback;
  }

  const knowledgeHints = buildKnowledgeHintMaps(fallback);
  const fallbackTables = Array.isArray(fallback.tables) ? fallback.tables : [];
  const plannedTableNames = Array.from(new Set(
    (Array.isArray(fallback?.researchPack?.candidateTables) ? fallback.researchPack.candidateTables : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  ));
  const allowedTableNames = plannedTableNames.length > 0
    ? new Set(plannedTableNames.slice(0, 15))
    : null;
  const sourceTables = parsed.tables;

  const normalizedTables = sourceTables
    .filter((table) => !allowedTableNames || allowedTableNames.has(String(table?.tableName || "").trim()))
    .map((table, index) =>
      normalizeSchemaTable(
        table,
        {
          ...(findKnowledgeTableHint(knowledgeHints, table?.tableName) || {}),
          ...(fallbackTables.find((item) => item?.tableName === table.tableName) || {}),
        },
        index
      )
    );

  const allowOutOfPlanTables = !(fallback?.autoResearchMode === true && sourceTables.length > 0);
  if (allowOutOfPlanTables) {
    fallbackTables
      .filter((table) => table
        && (!allowedTableNames || allowedTableNames.has(String(table?.tableName || "").trim()))
        && !sourceTables.some((item) => item?.tableName === table.tableName))
      .forEach((table, index) => normalizedTables.push(normalizeSchemaTable(
        {},
        {
          ...(findKnowledgeTableHint(knowledgeHints, table?.tableName) || {}),
          ...table,
        },
        sourceTables.length + index
      )));
  }
  if (allowedTableNames && normalizedTables.length < 10) {
    fallbackTables
      .filter((table) => table
        && allowedTableNames.has(String(table?.tableName || "").trim())
        && !normalizedTables.some((item) => item?.tableName === table.tableName))
      .slice(0, 10 - normalizedTables.length)
      .forEach((table, index) => normalizedTables.push(normalizeSchemaTable(
        {},
        {
          ...(findKnowledgeTableHint(knowledgeHints, table?.tableName) || {}),
          ...table,
        },
        normalizedTables.length + index
      )));
  }

  const fallbackDictTables = (Array.isArray(fallback.dictTables) ? fallback.dictTables : []).filter((item) => isUsefulDictTable(item));
  const sourceDictTables = (Array.isArray(parsed.dictTables) ? parsed.dictTables : []).filter((item) => isUsefulDictTable(item));
  const selectedFieldNames = new Set(normalizedTables.flatMap((table) =>
    (Array.isArray(table.fields) ? table.fields : []).map((field) => String(field?.fieldName || "").trim())
  ).filter(Boolean));

  const normalizedDictTables = sourceDictTables.map((item, index) =>
    normalizeDictTable(
      item,
      {
        ...(findKnowledgeDictHint(knowledgeHints, item?.tableName) || {}),
        ...(fallbackDictTables.find((dict) => dict?.tableName === item?.tableName) || {}),
      },
      index
    )
  ).filter((item) => selectedFieldNames.has(String(item.referenceField || "").trim()) || usesPlaceholderDictValues(item.values) === false);
  fallbackDictTables
    .filter((table) => table
      && (selectedFieldNames.has(String(table?.referenceField || "").trim()) || normalizeKnowledgeDictValues(table?.values).length > 0)
      && !sourceDictTables.some((item) => item?.tableName === table.tableName))
    .forEach((table, index) => normalizedDictTables.push(normalizeDictTable(
      {},
      {
        ...(findKnowledgeDictHint(knowledgeHints, table?.tableName) || {}),
        ...table,
      },
      sourceDictTables.length + index
    )));

  const enrichedDictTables = inferBusinessRelatedDictTablesV2(
    normalizedTables,
    normalizedDictTables,
    fallback.scenarioProfile || null,
    knowledgeHints
  ).map((item, index) =>
    normalizeDictTable(
      item,
      {
        ...(findKnowledgeDictHint(knowledgeHints, item?.tableName || item?.referenceField) || {}),
        ...(normalizedDictTables.find((dict) => dict?.tableName === item.tableName) || {}),
      },
      index
    )
  ).filter((item) => isUsefulDictTable(item));

  return {
    ...fallback,
    ...parsed,
    tables: normalizedTables.slice(0, 15),
    dictTables: enrichedDictTables,
    relations: normalizeSchemaRelations(
      parsed.relations,
      Array.isArray(fallback.relations) && fallback.relations.length > 0
        ? fallback.relations
        : deriveRelationsFromTables(normalizedTables.slice(0, 15))
    ),
  };
}

function enrichGeneratedSchema(schema) {
  const next = schema && typeof schema === "object" ? JSON.parse(JSON.stringify(schema)) : {};
  const knowledgeHints = buildKnowledgeHintMaps(next);
  const normalizedTables = (Array.isArray(next.tables) ? next.tables : []).map((table, index) =>
    normalizeSchemaTable(table, { ...(findKnowledgeTableHint(knowledgeHints, table?.tableName) || {}), ...table }, index)
  );
  const normalizedDictTables = inferBusinessRelatedDictTablesV2(
    normalizedTables,
    (Array.isArray(next.dictTables) ? next.dictTables : [])
      .filter((dictTable) => isUsefulDictTable(dictTable))
      .concat(Array.from(new Map(
        Array.from(knowledgeHints.dictMap?.values?.() || [])
          .map((item) => [String(item?.tableName || "").trim(), item])
      ).values()).filter((dictTable) => isUsefulDictTable(dictTable)))
      .map((dictTable, index) => normalizeDictTable(dictTable, { ...(findKnowledgeDictHint(knowledgeHints, dictTable?.tableName) || {}), ...dictTable }, index)),
    next.scenarioProfile || null,
    knowledgeHints
  ).map((dictTable, index) =>
    normalizeDictTable(
      dictTable,
      { ...(findKnowledgeDictHint(knowledgeHints, dictTable?.tableName || dictTable?.referenceField) || {}), ...dictTable },
      index
    )
  ).filter((dictTable) => isUsefulDictTable(dictTable));
  return {
    ...next,
    tables: normalizedTables,
    dictTables: normalizedDictTables,
    relations: normalizeSchemaRelations(next.relations, deriveRelationsFromTables(normalizedTables)),
  };
}

function sanitizeManualSchemaField(field, index) {
  const source = field && typeof field === "object" ? field : {};
  const fieldName = pickText(source.fieldName, source.name) || `field_${index + 1}`;
  const fieldType = pickText(source.fieldType, source.type) || "VARCHAR";
  const primaryKey = Boolean(source.primaryKey);
  const foreignKey = Boolean(source.foreignKey);
  return {
    fieldName,
    fieldType,
    fieldLength: source.fieldLength ?? (String(fieldType).toUpperCase() === "VARCHAR" ? 128 : null),
    nullable: primaryKey || foreignKey ? false : Boolean(source.nullable ?? true),
    primaryKey,
    uniqueKey: Boolean(source.uniqueKey || primaryKey),
    foreignKey,
    foreignRefTable: source.foreignRefTable || "",
    foreignRefField: source.foreignRefField || "",
    defaultValue: source.defaultValue ?? null,
    fieldComment: pickText(source.fieldComment) || `${humanizeIdentifier(fieldName)}字段`,
    businessSemantic: source.businessSemantic || "",
    validationRule: source.validationRule || "",
    dirtyRuleCandidates: Array.isArray(source.dirtyRuleCandidates) ? source.dirtyRuleCandidates : [],
  };
}

function sanitizeManualSchemaTable(table, index) {
  const source = table && typeof table === "object" ? table : {};
  const tableName = pickText(source.tableName, source.logicalTableName, source.name) || `table_${index + 1}`;
  const fields = Array.isArray(source.fields) ? source.fields.map((field, fieldIndex) => sanitizeManualSchemaField(field, fieldIndex)) : [];
  return {
    tableName,
    tableLabel: pickText(source.tableLabel, source.tableNameZh) || null,
    physicalTableName: source.physicalTableName || "",
    tableComment: pickText(source.tableComment) || `${humanizeIdentifier(tableName)}表`,
    businessRole: source.businessRole || "DETAIL",
    generationPriority: Number(source.generationPriority || index + 1),
    fields,
  };
}

function sanitizeManualDictTable(dictTable, index) {
  const source = dictTable && typeof dictTable === "object" ? dictTable : {};
  const tableName = pickText(source.tableName, source.name) || `dict_${index + 1}`;
  return {
    tableName,
    dictName: pickText(source.dictName) || null,
    tableComment: pickText(source.tableComment) || `${humanizeIdentifier(tableName)}字典表`,
    referenceField: pickText(source.referenceField),
    values: (Array.isArray(source.values) ? source.values : []).map((item, itemIndex) => ({
      dictKey: pickText(item?.dictKey, item?.key) || `key_${itemIndex + 1}`,
      dictValue: pickText(item?.dictValue, item?.value),
      sortOrder: Number(item?.sortOrder || itemIndex + 1),
    })),
  };
}

function deriveManualSchemaRelations(tables) {
  const relations = [];
  for (const table of tables || []) {
    for (const field of table.fields || []) {
      if (field.foreignKey && field.foreignRefTable) {
        relations.push({
          fromTable: field.foreignRefTable,
          fromField: field.foreignRefField || "id",
          toTable: table.tableName,
          toField: field.fieldName,
          relationType: "1:N",
        });
      }
    }
  }
  return relations;
}

function sanitizeManualSchema(schema, fallback) {
  const source = schema && typeof schema === "object" ? schema : {};
  const tables = Array.isArray(source.tables) ? source.tables.map((table, index) => sanitizeManualSchemaTable(table, index)) : [];
  if (tables.length === 0) {
    throw new AppError("结构至少需要包含一张表", 400);
  }
  const dictTables = Array.isArray(source.dictTables) ? source.dictTables.map((dictTable, index) => sanitizeManualDictTable(dictTable, index)) : [];
  const relations = Array.isArray(source.relations) && source.relations.length > 0
    ? source.relations
        .filter((item) => item?.fromTable && item?.fromField && item?.toTable && item?.toField)
        .map((item) => ({
          fromTable: item.fromTable,
          fromField: item.fromField,
          toTable: item.toTable,
          toField: item.toField,
          relationType: item.relationType || "1:N",
        }))
    : deriveManualSchemaRelations(tables);
  return {
    ...fallback,
    sceneName: source.sceneName || fallback.sceneName,
    scenarioProfile: source.scenarioProfile || fallback.scenarioProfile,
    tables,
    dictTables,
    relations,
    modelExplanation: source.modelExplanation || fallback.modelExplanation || "",
    adjustments: Array.isArray(source.adjustments) ? source.adjustments : (fallback.adjustments || []),
  };
}

function normalizeStrategyFieldGenerator(fieldGenerator, fallbackFieldGenerator, index) {
  const source = fieldGenerator && typeof fieldGenerator === "object" ? fieldGenerator : {};
  const fallback = fallbackFieldGenerator && typeof fallbackFieldGenerator === "object" ? fallbackFieldGenerator : {};

  return {
    fieldName: source.fieldName || fallback.fieldName || `field_${index + 1}`,
    generatorType: source.generatorType || fallback.generatorType || "TEXT_TEMPLATE",
    nullable: source.nullable ?? fallback.nullable ?? true,
    dirtyRules: Array.isArray(source.dirtyRules) ? source.dirtyRules : (fallback.dirtyRules || [])
  };
}

function normalizeStrategyTable(table, fallbackTable, index, sceneCode) {
  const source = table && typeof table === "object" ? table : {};
  const fallback = fallbackTable && typeof fallbackTable === "object" ? fallbackTable : {};
  const fallbackFieldGenerators = Array.isArray(fallback.fieldGenerators) ? fallback.fieldGenerators : [];
  const sourceFieldGenerators = Array.isArray(source.fieldGenerators) ? source.fieldGenerators : [];
  const normalizedFieldGenerators = fallbackFieldGenerators.map((field, fieldIndex) =>
    normalizeStrategyFieldGenerator(
      sourceFieldGenerators.find((item) => item?.fieldName === field.fieldName),
      field,
      fieldIndex
    )
  );

  sourceFieldGenerators
    .filter((field) => field && !fallbackFieldGenerators.some((item) => item.fieldName === field.fieldName))
    .forEach((field, fieldIndex) =>
      normalizedFieldGenerators.push(normalizeStrategyFieldGenerator(field, {}, fallbackFieldGenerators.length + fieldIndex))
    );

  const tableName = source.tableName || fallback.tableName || `table_${index + 1}`;

  return {
    tableName,
    initRows: Number(source.initRows || fallback.initRows || 1),
    incrRows: Number(source.incrRows || fallback.incrRows || 1),
    dependsOn: Array.isArray(source.dependsOn) ? source.dependsOn : (fallback.dependsOn || []),
    writeMode: source.writeMode || fallback.writeMode || "MYSQL_ONLY",
    topicName: source.topicName || fallback.topicName || `lab.scene.${sceneCode}.${tableName}`,
    fieldGenerators: normalizedFieldGenerators
  };
}

function normalizeGeneratedStrategy(parsed, fallback) {
  if (!parsed || !Array.isArray(parsed.tables)) {
    return fallback;
  }

  const sceneCode = parsed.sceneCode || fallback.sceneCode;
  const fallbackTables = Array.isArray(fallback.tables) ? fallback.tables : [];
  const sourceTables = parsed.tables;
  const normalizedTables = fallbackTables.map((table, index) =>
    normalizeStrategyTable(
      sourceTables.find((item) => item?.tableName === table.tableName),
      table,
      index,
      sceneCode
    )
  );

  sourceTables
    .filter((table) => table && !fallbackTables.some((item) => item.tableName === table.tableName))
    .forEach((table, index) => normalizedTables.push(normalizeStrategyTable(table, {}, fallbackTables.length + index, sceneCode)));

  const normalized = {
    ...fallback,
    ...parsed,
    sceneCode,
    globalConfig: {
      ...(fallback.globalConfig || {}),
      ...(parsed.globalConfig || {})
    },
    tableGenerationOrder: Array.isArray(parsed.tableGenerationOrder) && parsed.tableGenerationOrder.length > 0
      ? parsed.tableGenerationOrder
      : normalizedTables.map((table) => table.tableName),
    tables: normalizedTables,
    strategyExplanation: parsed.strategyExplanation || fallback.strategyExplanation
  };
  return normalizeStrategyDirtyConfig(normalized, {
    dirtyRatio: normalized?.globalConfig?.dirtyRatio,
    dirtyEnabled: normalized?.globalConfig?.dirtyEnabled
  });
}

async function adjustSchema(payload) {
  const scene = await getSceneBase(payload.sceneId);
  const current = await getCurrentSchemaVersion(scene.id, payload.versionId);
  if (!current) {
    throw new AppError("请先生成结构版本", 400);
  }
  const adjusted = generator.applySchemaAdjustment(current.content, payload.adjustmentPrompt);
  const [versionRows] = await pool.query(
    "SELECT COALESCE(MAX(version_no), 0) + 1 AS nextVersion FROM lab_scene_schema_version WHERE scene_id = ?",
    [scene.id]
  );
  const versionNo = Number(versionRows[0].nextVersion || 1);
  const [result] = await pool.query(
    `INSERT INTO lab_scene_schema_version
      (scene_id, version_no, version_status, schema_json, adjustment_prompt, adjustment_history_json, model_summary, diff_summary)
     VALUES (?, ?, 'GENERATED', ?, ?, ?, ?, ?)`,
    [scene.id, versionNo, JSON.stringify(adjusted.schema), payload.adjustmentPrompt, JSON.stringify(adjusted.schema.adjustments || []), adjusted.summary, adjusted.summary]
  );
  await pool.query("UPDATE lab_scene SET current_schema_version = ? WHERE id = ?", [versionNo, scene.id]);
  await logOperation("ADJUST_SCHEMA", "system", scene.id, payload, `调整结构版本 ${versionNo}`);
  return getCurrentSchemaVersion(scene.id, result.insertId);
}

async function saveSchema(payload) {
  const scene = await getSceneBase(payload.sceneId);
  const current = await getCurrentSchemaVersion(scene.id, payload.versionId);
  if (!current) {
    throw new AppError("请先生成结构版本", 400);
  }
  const schema = sanitizeManualSchema(payload.schema, current.content);
  const summary = payload.summary || "手工编辑结构";
  const adjustmentHistory = [
    ...(Array.isArray(current.adjustmentHistory) ? current.adjustmentHistory : []),
    { prompt: summary, at: new Date().toISOString(), summary },
  ];
  const [versionRows] = await pool.query(
    "SELECT COALESCE(MAX(version_no), 0) + 1 AS nextVersion FROM lab_scene_schema_version WHERE scene_id = ?",
    [scene.id]
  );
  const versionNo = Number(versionRows[0].nextVersion || 1);
  const [result] = await pool.query(
    `INSERT INTO lab_scene_schema_version
      (scene_id, version_no, version_status, schema_json, adjustment_prompt, adjustment_history_json, model_summary, diff_summary)
     VALUES (?, ?, 'GENERATED', ?, ?, ?, ?, ?)`,
    [scene.id, versionNo, JSON.stringify(schema), summary, JSON.stringify(adjustmentHistory), summary, summary]
  );
  await pool.query("UPDATE lab_scene SET current_schema_version = ? WHERE id = ?", [versionNo, scene.id]);
  await logOperation("SAVE_SCHEMA", "system", scene.id, payload, `手工保存结构版本 ${versionNo}`);
  return getCurrentSchemaVersion(scene.id, result.insertId);
}

async function confirmSchema(payload) {
  const scene = await getSceneBase(payload.sceneId);
  const version = await getCurrentSchemaVersion(scene.id, payload.versionId);
  if (!version) {
    throw new AppError("结构版本不存在", 404);
  }
  await ensureLabDatabase();
  const ddlStatements = generator.buildDDLStatements(scene.sceneCode, version.content);
  for (const item of ddlStatements) {
    await pool.query(item.ddl);
  }
  await replaceSceneMetadata(scene.id, version.id, scene.sceneCode, version.content, ddlStatements);
  await pool.query(
    "UPDATE lab_scene SET status = 'SCHEMA_CONFIRMED', stage_status = 'SCHEMA_CONFIRMED', current_schema_version = ? WHERE id = ?",
    [version.versionNo, scene.id]
  );
  await logOperation("CONFIRM_SCHEMA", "system", scene.id, payload, `确认结构版本 ${version.versionNo}`);
  return { version, ddlStatements };
}

async function generateStrategy(payload) {
  const scene = await getSceneBase(payload.sceneId);
  const schema = await getCurrentSchemaVersion(scene.id);
  if (!schema) {
    throw new AppError("请先确认结构设计", 400);
  }
  const fallbackStrategy = generator.generateStrategyPayload(scene, schema.content, payload);
  const modelStrategy = await tryGenerateStrategyWithModelV2(scene, schema.content, payload, fallbackStrategy);
  const strategy = await applySemanticFieldRulesToStrategy(scene, schema.content, modelStrategy);
  const [versionRows] = await pool.query(
    "SELECT COALESCE(MAX(version_no), 0) + 1 AS nextVersion FROM lab_scene_strategy_version WHERE scene_id = ?",
    [scene.id]
  );
  const versionNo = Number(versionRows[0].nextVersion || 1);
  const [result] = await pool.query(
    `INSERT INTO lab_scene_strategy_version
      (scene_id, version_no, version_status, strategy_json, model_summary)
     VALUES (?, ?, 'GENERATED', ?, ?)`,
    [scene.id, versionNo, JSON.stringify(strategy), "已根据结构版本自动生成造数策略"]
  );
  await pool.query(
    `UPDATE lab_scene
     SET status = 'STRATEGY_PENDING_CONFIRM', stage_status = 'STRATEGY_PENDING_CONFIRM',
         current_strategy_version = ?, init_volume = ?, incr_volume = ?, incr_cycle = ?, dirty_enabled = ?, dirty_ratio = ?, realtime_enabled = ?
     WHERE id = ?`,
    [versionNo, strategy.globalConfig.initVolume, strategy.globalConfig.incrementVolume, strategy.globalConfig.incrementCycle, boolFlag(strategy.globalConfig.dirtyEnabled), strategy.globalConfig.dirtyRatio, boolFlag(strategy.globalConfig.realtimeEnabled), scene.id]
  );
  await logOperation("GENERATE_STRATEGY", "system", scene.id, payload, `生成策略版本 ${versionNo}`);
  return getCurrentStrategyVersion(scene.id, result.insertId);
}

async function tryGenerateStrategyWithModelV2(scene, schemaContent, payload, fallback) {
  if (!scene.strategyModelId) {
    const promptTemplate = await promptRuntime.getActivePromptTemplate("STRATEGY");
    if (!promptTemplate?.defaultModelProviderId) {
      return fallback;
    }
  }
  try {
    let provider = null;
    const userPayload = { sceneName: scene.sceneName, sceneCode: scene.sceneCode, sceneDesc: scene.sceneDesc, schema: schemaContent, config: payload };
    const promptConfig = await getRuntimePromptConfig(
      "STRATEGY",
      {
        systemPrompt: promptDefaults.buildStrategyDefaultPrompt(),
        userPrompt: promptDefaults.buildStrategyDefaultUserPrompt(),
      },
      {
        ...userPayload,
        input: userPayload,
      }
    );
    if (promptConfig.provider) {
      provider = promptConfig.provider;
    } else if (scene.strategyModelId) {
      provider = await modelProviderService.getModelProviderById(scene.strategyModelId);
    }
    if (!provider) {
      return fallback;
    }
    const response = await modelProviderService.generateChatCompletion(
      provider,
      [
        { role: "system", content: promptConfig.systemPrompt },
        { role: "user", content: promptConfig.userPrompt }
      ],
      {
        temperature: Math.min(Number(promptConfig.temperature || 0.1), 0.1),
        maxTokens: Math.min(Number(promptConfig.maxTokens || 900), 900),
        timeoutMs: 90000,
        responseFormat: { type: "json_object" }
      }
    );
    const parsed = tryParseJson(response.content);
    return normalizeGeneratedStrategy(parsed, fallback);
  } catch (error) {
    return fallback;
  }
}

async function adjustStrategy(payload) {
  const scene = await getSceneBase(payload.sceneId);
  const current = await getCurrentStrategyVersion(scene.id, payload.versionId);
  if (!current) {
    throw new AppError("请先生成策略版本", 400);
  }
  const adjusted = generator.applyStrategyAdjustment(current.content, payload.adjustmentPrompt);
  const [versionRows] = await pool.query(
    "SELECT COALESCE(MAX(version_no), 0) + 1 AS nextVersion FROM lab_scene_strategy_version WHERE scene_id = ?",
    [scene.id]
  );
  const versionNo = Number(versionRows[0].nextVersion || 1);
  const [result] = await pool.query(
    `INSERT INTO lab_scene_strategy_version
      (scene_id, version_no, version_status, strategy_json, adjustment_prompt, model_summary)
     VALUES (?, ?, 'GENERATED', ?, ?, ?)`,
    [scene.id, versionNo, JSON.stringify(adjusted.strategy), payload.adjustmentPrompt, adjusted.summary]
  );
  await pool.query("UPDATE lab_scene SET current_strategy_version = ? WHERE id = ?", [versionNo, scene.id]);
  await logOperation("ADJUST_STRATEGY", "system", scene.id, payload, `调整策略版本 ${versionNo}`);
  return getCurrentStrategyVersion(scene.id, result.insertId);
}

async function confirmStrategy(payload) {
  const scene = await getSceneBase(payload.sceneId);
  const version = await getCurrentStrategyVersion(scene.id, payload.versionId);
  if (!version) {
    throw new AppError("策略版本不存在", 404);
  }
  const topics = generator.buildSceneTopics(scene.sceneCode, version.content);
  for (const topic of topics) {
    runtime.createTopic(scene.sceneCode, topic.topicName);
    try {
      await kafkaRuntime.ensureTopic(topic.topicName);
    } catch (error) {
      console.error("[data-lab] ensureTopic failed:", error.message);
    }
    await upsertTopic(scene.id, topic);
  }
  await pool.query(
    "UPDATE lab_scene SET status = 'READY', stage_status = 'READY', current_strategy_version = ? WHERE id = ?",
    [version.versionNo, scene.id]
  );
  await logOperation("CONFIRM_STRATEGY", "system", scene.id, payload, `确认策略版本 ${version.versionNo}`);
  return {
    version,
    topics: await listSceneTopics(scene.id)
  };
}

function mapSceneFieldToTargetColumn(field, sourceType = "mysql") {
  const rawType = String(field?.fieldType || "VARCHAR").trim().toUpperCase();
  let columnType = rawType;
  if (rawType === "VARCHAR") {
    columnType = `VARCHAR(${Number(field?.fieldLength || 128)})`;
  } else if (rawType.includes("DATETIME")) {
    columnType = sourceType === "postgresql" ? "TIMESTAMP" : "DATETIME";
  } else if (rawType === "INT" && sourceType === "postgresql") {
    columnType = "INTEGER";
  } else if (rawType === "JSON" && sourceType === "hive") {
    columnType = "STRING";
  }
  return {
    columnName: field.fieldName,
    columnType,
    isNullable: Boolean(field.nullable),
    isPrimaryKey: Boolean(field.primaryKey),
    columnDefault: field.defaultValue ?? null,
    columnComment: field.fieldComment || field.businessSemantic || field.fieldName,
    extra: "",
  };
}

async function deploySceneSchema(payload) {
  const scene = await getSceneBase(payload.sceneId);
  const schema = await getCurrentSchemaVersion(scene.id);
  if (!schema) {
    throw new AppError("请先完成结构设计并确认当前结构版本", 400);
  }

  const offlineDataSource = await dataLabSourceRepository.getDataSourceById(Number(payload.offlineDataSourceId));
  if (!offlineDataSource) {
    throw new AppError("离线数据源不存在", 404);
  }
  const offlineType = normalizeStorageSourceType(offlineDataSource.sourceType, offlineDataSource.connectionConfig || {});
  if (!["mysql", "postgresql"].includes(offlineType)) {
    throw new AppError("当前仅支持向 MySQL / PostgreSQL 数据源部署物理表结构", 400);
  }

  let realtimeDataSource = null;
  if (payload.realtimeDataSourceId) {
    realtimeDataSource = await dataLabSourceRepository.getDataSourceById(Number(payload.realtimeDataSourceId));
    if (!realtimeDataSource) {
      throw new AppError("实时数据源不存在", 404);
    }
  }

  const deployResults = [];
  for (const table of schema.content?.tables || []) {
    const physicalTableName = generator.buildPhysicalTableName(scene.sceneCode, table.tableName);
    const columns = (table.fields || []).map((field) => mapSceneFieldToTargetColumn(field, offlineType));
    const result = await dataSourceMetadata.ensureTableMatchesColumns(offlineDataSource, physicalTableName, columns, {
      tableComment: table.tableComment || table.tableLabel || table.tableName,
    });
    deployResults.push({
      logicalTableName: table.tableName,
      physicalTableName,
      action: result.action,
      reason: result.reason || null,
      changes: result.changes || [],
    });
  }

  let topicResults = [];
  if (realtimeDataSource && String(realtimeDataSource.sourceType || "").trim().toLowerCase() === "kafka") {
    const strategy = await getCurrentStrategyVersion(scene.id);
    const topicPlans = generator.buildSceneTopics(scene.sceneCode, strategy?.content || { tables: [] });
    topicResults = await Promise.all(topicPlans.map(async (topic) => {
      await upsertTopic(scene.id, topic);
      return {
        topicName: topic.topicName,
        topicType: topic.topicType,
        writeMode: topic.writeMode,
        action: "registered",
      };
    }));
  }

  await pool.query(
    `UPDATE lab_scene
     SET offline_data_source_id = ?, realtime_data_source_id = ?, last_deployed_at = NOW()
     WHERE id = ?`,
    [Number(payload.offlineDataSourceId), payload.realtimeDataSourceId ? Number(payload.realtimeDataSourceId) : null, scene.id]
  );

  await logOperation("DEPLOY_PHYSICAL_SCHEMA", "system", scene.id, payload, `部署物理表 ${deployResults.length} 张`);
  return {
    scene: await getSceneDetail(scene.id),
    offlineDataSource: offlineDataSource.sourceName,
    realtimeDataSource: realtimeDataSource?.sourceName || null,
    deployedTables: deployResults,
    deployedTopics: topicResults,
  };
}

async function replaceSceneMetadata(sceneId, schemaVersionId, sceneCode, schema, ddlStatements) {
  await pool.query("DELETE FROM lab_scene_field WHERE scene_id = ?", [sceneId]);
  await pool.query("DELETE FROM lab_scene_table WHERE scene_id = ?", [sceneId]);
  await pool.query("DELETE FROM lab_scene_dict WHERE scene_id = ?", [sceneId]);
  await pool.query("DELETE FROM lab_scene_relation WHERE scene_id = ?", [sceneId]);
  for (const table of schema.tables || []) {
    const ddl = ddlStatements.find((item) => item.logicalTableName === table.tableName);
    const [tableResult] = await pool.query(
      `INSERT INTO lab_scene_table
        (scene_id, schema_version_id, physical_table_name, logical_table_name, business_role, generation_priority, table_comment, ddl_sql)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sceneId, schemaVersionId, ddl?.physicalTableName || `${sceneCode}_${table.tableName}`, table.tableName, table.businessRole, table.generationPriority || 1, table.tableComment || null, ddl?.ddl || null]
    );
    const tableId = Number(tableResult.insertId);
    for (const field of table.fields || []) {
      await pool.query(
        `INSERT INTO lab_scene_field
          (scene_id, table_id, schema_version_id, field_name, field_type, field_length, nullable, primary_key, unique_key,
           foreign_key, foreign_ref_table, foreign_ref_field, default_value, field_comment, business_semantic,
           validation_rule, dirty_rule_candidates_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sceneId, tableId, schemaVersionId, field.fieldName, field.fieldType, field.fieldLength || null, boolFlag(field.nullable), boolFlag(field.primaryKey), boolFlag(field.uniqueKey), boolFlag(field.foreignKey), field.foreignRefTable || null, field.foreignRefField || null, field.defaultValue || null, field.fieldComment || null, field.businessSemantic || null, field.validationRule || null, JSON.stringify(field.dirtyRuleCandidates || [])]
      );
    }
  }
  for (const dictTable of schema.dictTables || []) {
    for (const item of dictTable.values || []) {
      await pool.query(
        "INSERT INTO lab_scene_dict (scene_id, schema_version_id, table_name, dict_key, dict_value, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        [sceneId, schemaVersionId, dictTable.tableName, item.dictKey, item.dictValue, item.sortOrder || 0]
      );
    }
  }
  for (const relation of schema.relations || []) {
    await pool.query(
      `INSERT INTO lab_scene_relation (scene_id, schema_version_id, from_table, from_field, to_table, to_field, relation_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sceneId, schemaVersionId, relation.fromTable, relation.fromField, relation.toTable, relation.toField, relation.relationType || "1:N"]
    );
  }
  for (const item of ddlStatements) {
    await pool.query(
      `INSERT INTO lab_scene_ddl_audit_log (scene_id, schema_version_id, action_type, ddl_sql, review_status, executed_at)
       VALUES (?, ?, 'APPLY_SCHEMA', ?, 'APPROVED', NOW())`,
      [sceneId, schemaVersionId, item.ddl]
    );
  }
}

async function listSceneTables(sceneId) {
  const [rows] = await pool.query(
    `SELECT id, scene_id AS sceneId, schema_version_id AS schemaVersionId, physical_table_name AS physicalTableName,
            logical_table_name AS logicalTableName, business_role AS businessRole, generation_priority AS generationPriority,
            table_comment AS tableComment, ddl_sql AS ddlSql, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scene_table WHERE scene_id = ? ORDER BY generation_priority ASC, id ASC`,
    [sceneId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    sceneId: Number(row.sceneId),
    schemaVersionId: Number(row.schemaVersionId),
    physicalTableName: row.physicalTableName,
    logicalTableName: row.logicalTableName,
    businessRole: row.businessRole,
    generationPriority: Number(row.generationPriority || 0),
    tableComment: row.tableComment,
    ddlSql: row.ddlSql,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function listSceneFields(sceneId) {
  const [rows] = await pool.query(
    `SELECT f.id, f.scene_id AS sceneId, f.table_id AS tableId, t.logical_table_name AS tableName,
            f.field_name AS fieldName, f.field_type AS fieldType, f.field_length AS fieldLength, f.nullable,
            f.primary_key AS primaryKey, f.unique_key AS uniqueKey, f.foreign_key AS foreignKey,
            f.foreign_ref_table AS foreignRefTable, f.foreign_ref_field AS foreignRefField,
            f.default_value AS defaultValue, f.field_comment AS fieldComment, f.business_semantic AS businessSemantic,
            f.validation_rule AS validationRule, f.dirty_rule_candidates_json AS dirtyRuleCandidates,
            f.created_at AS createdAt, f.updated_at AS updatedAt
     FROM lab_scene_field f
     JOIN lab_scene_table t ON t.id = f.table_id
     WHERE f.scene_id = ?
     ORDER BY t.generation_priority ASC, f.id ASC`,
    [sceneId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    sceneId: Number(row.sceneId),
    tableId: Number(row.tableId),
    tableName: row.tableName,
    fieldName: row.fieldName,
    fieldType: row.fieldType,
    fieldLength: row.fieldLength ? Number(row.fieldLength) : null,
    nullable: Boolean(row.nullable),
    primaryKey: Boolean(row.primaryKey),
    uniqueKey: Boolean(row.uniqueKey),
    foreignKey: Boolean(row.foreignKey),
    foreignRefTable: row.foreignRefTable,
    foreignRefField: row.foreignRefField,
    defaultValue: row.defaultValue,
    fieldComment: row.fieldComment,
    businessSemantic: row.businessSemantic,
    validationRule: row.validationRule,
    dirtyRuleCandidates: safeJsonParse(row.dirtyRuleCandidates, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function listSceneDicts(sceneId) {
  const [rows] = await pool.query(
    `SELECT id, scene_id AS sceneId, schema_version_id AS schemaVersionId, table_name AS tableName,
            dict_key AS dictKey, dict_value AS dictValue, sort_order AS sortOrder,
            created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scene_dict WHERE scene_id = ? ORDER BY table_name ASC, sort_order ASC, id ASC`,
    [sceneId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    sceneId: Number(row.sceneId),
    schemaVersionId: Number(row.schemaVersionId),
    tableName: row.tableName,
    dictKey: row.dictKey,
    dictValue: row.dictValue,
    sortOrder: Number(row.sortOrder || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function listSceneRelations(sceneId) {
  const [rows] = await pool.query(
    `SELECT id, scene_id AS sceneId, schema_version_id AS schemaVersionId,
            from_table AS fromTable, from_field AS fromField, to_table AS toTable, to_field AS toField,
            relation_type AS relationType, created_at AS createdAt
     FROM lab_scene_relation
     WHERE scene_id = ?
     ORDER BY id ASC`,
    [sceneId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    sceneId: Number(row.sceneId),
    schemaVersionId: Number(row.schemaVersionId),
    fromTable: row.fromTable,
    fromField: row.fromField,
    toTable: row.toTable,
    toField: row.toField,
    relationType: row.relationType,
    createdAt: row.createdAt
  }));
}

async function listSceneTasks(sceneId) {
  const [rows] = await pool.query(
    `SELECT id, scene_id AS sceneId, task_type AS taskType, task_key AS taskKey, cron_expr AS cronExpr,
            schedule_config_json AS scheduleConfig, enabled, status, last_run_time AS lastRunTime,
            last_result_json AS lastResult, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scene_task WHERE scene_id = ? ORDER BY id ASC`,
    [sceneId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    sceneId: Number(row.sceneId),
    taskType: row.taskType,
    taskKey: row.taskKey,
    cronExpr: row.cronExpr,
    scheduleConfig: safeJsonParse(row.scheduleConfig, {}),
    enabled: Boolean(row.enabled),
    status: row.status,
    lastRunTime: row.lastRunTime,
    lastResult: safeJsonParse(row.lastResult, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function upsertSceneTask(sceneId, taskKey, payload) {
  const [rows] = await pool.query("SELECT id FROM lab_scene_task WHERE scene_id = ? AND task_key = ? LIMIT 1", [sceneId, taskKey]);
  if (rows.length > 0) {
    await pool.query(
      `UPDATE lab_scene_task
       SET task_type = ?, cron_expr = ?, schedule_config_json = ?, enabled = ?, status = ?, last_run_time = ?, last_result_json = ?
       WHERE id = ?`,
      [payload.taskType, payload.cronExpr || null, JSON.stringify(payload.scheduleConfig || {}), boolFlag(payload.enabled), payload.status || "STOPPED", payload.lastRunTime || null, JSON.stringify(payload.lastResult || null), rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO lab_scene_task
        (scene_id, task_type, task_key, cron_expr, schedule_config_json, enabled, status, last_run_time, last_result_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sceneId, payload.taskType, taskKey, payload.cronExpr || null, JSON.stringify(payload.scheduleConfig || {}), boolFlag(payload.enabled), payload.status || "STOPPED", payload.lastRunTime || null, JSON.stringify(payload.lastResult || null)]
    );
  }
}

async function createRunLog(payload) {
  const [result] = await pool.query(
    `INSERT INTO lab_scene_run_log
      (scene_id, run_type, run_status, start_time, end_time, duration_ms, records_count, error_message, execution_info_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [payload.sceneId, payload.runType, payload.runStatus || "PENDING", payload.startTime || null, payload.endTime || null, payload.durationMs || null, payload.recordsCount || 0, payload.errorMessage || null, JSON.stringify(payload.executionInfo || {})]
  );
  return Number(result.insertId);
}

async function updateRunLog(id, payload) {
  await pool.query(
    `UPDATE lab_scene_run_log
     SET run_status = COALESCE(?, run_status), end_time = COALESCE(?, end_time), duration_ms = COALESCE(?, duration_ms),
         records_count = COALESCE(?, records_count), error_message = ?, execution_info_json = COALESCE(?, execution_info_json)
     WHERE id = ?`,
    [payload.runStatus ?? null, payload.endTime ?? null, payload.durationMs ?? null, payload.recordsCount ?? null, payload.errorMessage ?? null, payload.executionInfo ? JSON.stringify(payload.executionInfo) : null, id]
  );
}

async function getRunLogs(sceneId) {
  const [rows] = await pool.query(
    `SELECT id, scene_id AS sceneId, run_type AS runType, run_status AS runStatus, start_time AS startTime,
            end_time AS endTime, duration_ms AS durationMs, records_count AS recordsCount, error_message AS errorMessage,
            execution_info_json AS executionInfoJson, created_at AS createdAt
     FROM lab_scene_run_log WHERE scene_id = ? ORDER BY id DESC`,
    [sceneId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    sceneId: Number(row.sceneId),
    runType: row.runType,
    runStatus: row.runStatus,
    startTime: row.startTime,
    endTime: row.endTime,
    durationMs: row.durationMs ? Number(row.durationMs) : null,
    recordsCount: Number(row.recordsCount || 0),
    errorMessage: row.errorMessage,
    executionInfo: safeJsonParse(row.executionInfoJson, {}),
    createdAt: row.createdAt
  }));
}

async function upsertTopic(sceneId, payload) {
  const [rows] = await pool.query("SELECT id FROM lab_scene_topic WHERE scene_id = ? AND topic_name = ? LIMIT 1", [sceneId, payload.topicName]);
  if (rows.length > 0) {
    await pool.query(
      `UPDATE lab_scene_topic
       SET topic_type = ?, write_mode = ?, status = ?, message_count = ?, last_message_at = ?, last_error_message = ?
       WHERE id = ?`,
      [payload.topicType || "TABLE", payload.writeMode || "MYSQL_AND_KAFKA", payload.status || "READY", payload.messageCount || 0, normalizeMysqlDateTime(payload.lastMessageAt) || null, payload.lastErrorMessage || null, rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO lab_scene_topic
        (scene_id, topic_name, topic_type, write_mode, status, message_count, last_message_at, last_error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sceneId, payload.topicName, payload.topicType || "TABLE", payload.writeMode || "MYSQL_AND_KAFKA", payload.status || "READY", payload.messageCount || 0, normalizeMysqlDateTime(payload.lastMessageAt) || null, payload.lastErrorMessage || null]
    );
  }
}

async function listSceneTopics(sceneId) {
  const scene = await getSceneBase(sceneId);
  const [rows] = await pool.query(
    `SELECT id, scene_id AS sceneId, topic_name AS topicName, topic_type AS topicType,
            write_mode AS writeMode, status, message_count AS messageCount, last_message_at AS lastMessageAt,
            last_error_message AS lastErrorMessage, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scene_topic WHERE scene_id = ? ORDER BY topic_name ASC`,
    [sceneId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    sceneId: Number(row.sceneId),
    topicName: row.topicName,
    topicType: row.topicType,
    writeMode: row.writeMode,
    status: row.status,
    messageCount: Number(row.messageCount || 0),
    lastMessageAt: row.lastMessageAt,
    lastErrorMessage: row.lastErrorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    metrics: runtime.getTopicMetrics(scene.sceneCode, row.topicName)
  }));
}

function groupMessagesByTopic(topicMessages) {
  const map = new Map();
  topicMessages.forEach((item) => {
    if (!map.has(item.topicName)) {
      map.set(item.topicName, []);
    }
    map.get(item.topicName).push(item.message);
  });
  return [...map.entries()].map(([topicName, messages]) => ({ topicName, messages }));
}

async function truncateSceneTables(scene, schema) {
  for (const table of [...(schema.tables || [])].reverse()) {
    const physicalTableName = generator.buildPhysicalTableName(scene.sceneCode, table.tableName);
    await deleteAllRowsFromStorage(scene, physicalTableName);
  }
}

async function clearSceneHistoricalData(sceneId) {
  const scene = await getSceneBase(sceneId);
  const [runRows] = await pool.query(
    `SELECT id
     FROM lab_scene_run_log
     WHERE scene_id = ?`,
    [sceneId]
  );
  const runIds = runRows.map((row) => Number(row.id)).filter(Boolean);

  runtime.clearSceneTopics(scene.sceneCode);
  runtime.deleteRunArtifacts(runIds);

  await pool.query("DELETE FROM lab_scene_kafka_error WHERE scene_id = ?", [sceneId]);
  await pool.query("DELETE FROM lab_scene_quality_report WHERE scene_id = ?", [sceneId]);
  await pool.query("DELETE FROM lab_scene_topic WHERE scene_id = ?", [sceneId]);
  await pool.query("DELETE FROM lab_scene_run_log WHERE scene_id = ?", [sceneId]);
  await pool.query("DELETE FROM lab_operation_log WHERE scene_id = ?", [sceneId]);
  await pool.query("UPDATE lab_scene SET last_run_time = NULL WHERE id = ?", [sceneId]);

  return scene;
}

async function getSceneTableBaseOffsets(scene, schema, mode) {
  if (mode === "INIT") {
    return {};
  }
  const baseOffsets = {};
  for (const table of schema.tables || []) {
    const physicalTableName = generator.buildPhysicalTableName(scene.sceneCode, table.tableName);
    baseOffsets[table.tableName] = await countRowsInStorage(scene, physicalTableName);
  }
  return baseOffsets;
}

async function hasSceneBusinessData(scene, schema) {
  const baseOffsets = await getSceneTableBaseOffsets(scene, schema, "INCR");
  return Object.values(baseOffsets).some((value) => Number(value || 0) > 0);
}

async function executeSceneRun(sceneId, runType) {
  const scene = await getSceneBase(sceneId);
  const schema = await getCurrentSchemaVersion(sceneId);
  const strategy = await getCurrentStrategyVersion(sceneId);
  if (!schema || !strategy) {
    throw new AppError("请先完成结构与策略确认", 400);
  }
  await ensureSceneStorageTables(scene, schema.content);
  const startedAt = new Date();
  const runLogId = await createRunLog({
    sceneId,
    runType,
    runStatus: "RUNNING",
    startTime: startedAt,
    executionInfo: {
      schemaVersion: schema.versionNo,
      strategyVersion: strategy.versionNo
    }
  });

  try {
    if (runType === "INIT") {
      await truncateSceneTables(scene, schema.content);
    }
    const baseOffsets = await getSceneTableBaseOffsets(scene, schema.content, runType);
    const generated = generator.generateRowsForScene(scene, schema.content, strategy.content, runType, { baseOffsets });
    let totalRows = 0;
    const strategyTableMap = new Map(((strategy.content.tables || [])).map((table) => [table.tableName, table]));
    for (const item of generated.rowsByTable) {
      const strategyTable = strategyTableMap.get(item.tableName) || {};
      const writeMode = strategyTable.writeMode || "MYSQL_ONLY";
      if (writeMode !== "KAFKA_ONLY") {
        await insertRowsToBusinessTable(scene, item.physicalTableName, item.rows);
      }
      totalRows += item.rows.length;
    }
    for (const group of groupMessagesByTopic(generated.topicMessages)) {
      runtime.appendTopicMessages(scene.sceneCode, group.topicName, group.messages);
      try {
        await kafkaRuntime.sendMessages(group.topicName, group.messages);
      } catch (error) {
        console.error("[data-lab] kafka send failed:", error.message);
        await pool.query(
          `INSERT INTO lab_scene_kafka_error (scene_id, trace_id, error_stage, error_message, payload_json)
           VALUES (?, ?, ?, ?, ?)`,
          [scene.id, group.messages[0]?.traceId || null, "PRODUCE", error.message, JSON.stringify(group.messages.slice(0, 5))]
        );
      }
      const metrics = runtime.getTopicMetrics(scene.sceneCode, group.topicName);
      await upsertTopic(scene.id, {
        topicName: group.topicName,
        topicType: "TABLE",
        writeMode: "MYSQL_AND_KAFKA",
        status: "READY",
        messageCount: metrics.messageCount,
        lastMessageAt: normalizeMysqlDateTime(metrics.lastMessageAt)
      });
    }
    const qualityReport = await rebuildQualityReport(scene.id);
    const finishedAt = new Date();
    await updateRunLog(runLogId, {
      runStatus: "SUCCESS",
      endTime: finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      recordsCount: totalRows,
      executionInfo: {
        totalRows,
        qualityScore: qualityReport?.score || null
      }
    });
    await pool.query(
      "UPDATE lab_scene SET status = ?, stage_status = ?, last_run_time = ? WHERE id = ?",
      [scene.taskEnabled ? "RUNNING" : "READY", scene.taskEnabled ? "RUNNING" : "READY", finishedAt, scene.id]
    );
    runtime.exportSceneArtifact(scene.sceneCode, runLogId, `${scene.sceneCode}_${runLogId}.json`, JSON.stringify({ totalRows }, null, 2));
    return getSceneDetail(scene.id);
  } catch (error) {
    const finishedAt = new Date();
    await updateRunLog(runLogId, {
      runStatus: "FAILED",
      endTime: finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      errorMessage: error.message,
      executionInfo: { error: error.message }
    });
    await pool.query("UPDATE lab_scene SET status = 'ERROR', stage_status = 'ERROR' WHERE id = ?", [scene.id]);
    throw error;
  }
}

async function initializeScene(id) {
  const scene = await clearSceneHistoricalData(id);
  const result = await executeSceneRun(id, "INIT");
  await logOperation("RELOAD_SCENE", "system", id, { sceneId: id }, `清空历史并重载场景 ${scene.sceneName}`);
  return result;
}

async function runSceneOnce(id) {
  return executeSceneRun(id, "INCR");
}

async function startSceneTask(id) {
  const scene = await getSceneBase(id);
  const schema = await getCurrentSchemaVersion(id);
  const strategy = await getCurrentStrategyVersion(id);
  if (!schema || !strategy) {
    throw new AppError("请先完成结构与策略确认", 400);
  }

  const hasData = await hasSceneBusinessData(scene, schema.content);
  await pool.query("UPDATE lab_scene SET status = 'RUNNING', stage_status = 'RUNNING', task_enabled = 1 WHERE id = ?", [id]);
  await upsertSceneTask(id, "INCR_TASK", {
    taskType: "INCR",
    cronExpr: buildSceneCron(scene.incrCycle),
    scheduleConfig: { cycle: scene.incrCycle },
    enabled: true,
    status: "RUNNING"
  });

  if (hasData) {
    await executeSceneRun(id, "INCR");
  } else {
    await executeSceneRun(id, "INIT");
    await executeSceneRun(id, "INCR");
  }

  return getSceneDetail(id);
}

async function stopSceneTask(id) {
  await getSceneBase(id);
  await pool.query("UPDATE lab_scene SET status = 'PAUSED', stage_status = 'PAUSED', task_enabled = 0 WHERE id = ?", [id]);
  await upsertSceneTask(id, "INCR_TASK", {
    taskType: "INCR",
    cronExpr: null,
    scheduleConfig: {},
    enabled: false,
    status: "STOPPED"
  });
  return getSceneDetail(id);
}

async function startRealtime(id) {
  const scene = await getSceneBase(id);
  await pool.query("UPDATE lab_scene SET realtime_enabled = 1, realtime_status = 'RUNNING' WHERE id = ?", [id]);
  await upsertSceneTask(id, "REALTIME_TASK", {
    taskType: "REALTIME",
    cronExpr: "*/10 * * * *",
    scheduleConfig: { intervalMinutes: 10 },
    enabled: true,
    status: "RUNNING"
  });
  const sceneTables = await listSceneTables(id);
  const strategy = await getCurrentStrategyVersion(id);
  const strategyTableMap = new Map(((strategy?.content?.tables || [])).map((table) => [table.tableName, table]));
  for (const table of sceneTables) {
    const strategyTable = strategyTableMap.get(table.logicalTableName) || {};
    if ((strategyTable.writeMode || "MYSQL_ONLY") === "MYSQL_ONLY") {
      continue;
    }
    const topicName = `lab.scene.${scene.sceneCode}.${table.logicalTableName}`;
    try {
      await kafkaRuntime.startConsumer({
        sceneCode: scene.sceneCode,
        topicName,
        groupId: `${scene.sceneCode}-${table.logicalTableName}-consumer`,
        eachMessage: async ({ message }) => {
          try {
            const value = message.value?.toString() || "{}";
            const parsed = JSON.parse(value);
            runtime.appendTopicMessages(scene.sceneCode, topicName, [parsed]);
            if ((strategyTable.writeMode || "MYSQL_ONLY") === "KAFKA_ONLY" && parsed?.tableName === table.physicalTableName && parsed?.data) {
              await insertRowsToBusinessTable(scene, table.physicalTableName, [parsed.data]);
            }
          } catch (error) {
            await pool.query(
              `INSERT INTO lab_scene_kafka_error (scene_id, trace_id, error_stage, error_message, payload_json)
               VALUES (?, ?, ?, ?, ?)`,
              [scene.id, null, "CONSUME", error.message, JSON.stringify({ topicName })]
            );
          }
        }
      });
    } catch (error) {
      console.error("[data-lab] start consumer failed:", error.message);
    }
  }
  return executeSceneRun(id, "REALTIME");
}

async function stopRealtime(id) {
  const scene = await getSceneBase(id);
  await pool.query("UPDATE lab_scene SET realtime_status = 'STOPPED' WHERE id = ?", [id]);
  await upsertSceneTask(id, "REALTIME_TASK", {
    taskType: "REALTIME",
    cronExpr: null,
    scheduleConfig: {},
    enabled: false,
    status: "STOPPED"
  });
  await kafkaRuntime.stopConsumersByScene(scene.sceneCode);
  return getSceneDetail(id);
}

function buildSceneCron(incrCycle) {
  const cycle = String(incrCycle || "DAILY").toUpperCase();
  if (cycle === "MINUTE") return "*/5 * * * *";
  if (cycle === "HOUR") return "0 * * * *";
  return "0 2 * * *";
}

async function deleteScene(id) {
  const scene = await getSceneBase(id);
  const schema = await getCurrentSchemaVersion(id);
  const binding = await resolveSceneStorageBinding(scene);
  if (schema && binding.mode === "local") {
    for (const table of [...(schema.content.tables || [])].reverse()) {
      const physicalTableName = generator.buildPhysicalTableName(scene.sceneCode, table.tableName);
      await pool.query(`DROP TABLE IF EXISTS \`${MEDATA_LAB_DB}\`.\`${physicalTableName}\``);
    }
  }
  const topics = await listSceneTopics(id);
  await kafkaRuntime.stopConsumersByScene(scene.sceneCode);
  for (const topic of topics) {
    runtime.deleteTopic(scene.sceneCode, topic.topicName);
    try {
      await kafkaRuntime.deleteTopic(topic.topicName);
    } catch (error) {
      console.error("[data-lab] delete topic failed:", error.message);
    }
  }
  const scoped = getScopedWhere("");
  await pool.query(`DELETE FROM lab_scene WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`, [id, ...scoped.params]);
  await logOperation("DELETE_SCENE", "system", id, { id }, `删除场景 ${id}`);
  return { id };
}

async function previewTopicMessages(sceneId, topicName, limit = 20) {
  const scene = await getSceneBase(sceneId);
  return {
    topicName,
    messages: runtime.readTopicMessages(scene.sceneCode, topicName, limit),
    metrics: runtime.getTopicMetrics(scene.sceneCode, topicName)
  };
}

async function createSceneTopic(sceneId, payload) {
  const scene = await getSceneBase(sceneId);
  runtime.createTopic(scene.sceneCode, payload.topicName);
  try {
    await kafkaRuntime.ensureTopic(payload.topicName);
  } catch (error) {
    console.error("[data-lab] ensure topic failed:", error.message);
  }
  await upsertTopic(sceneId, payload);
  return listSceneTopics(sceneId);
}

async function deleteSceneTopic(sceneId, topicName) {
  const scene = await getSceneBase(sceneId);
  runtime.deleteTopic(scene.sceneCode, topicName);
  try {
    await kafkaRuntime.deleteTopic(topicName);
  } catch (error) {
    console.error("[data-lab] delete topic failed:", error.message);
  }
  await pool.query("DELETE FROM lab_scene_topic WHERE scene_id = ? AND topic_name = ?", [sceneId, topicName]);
  return { topicName };
}

async function getTopicMetrics(sceneId) {
  const scene = await getSceneBase(sceneId);
  const topics = await listSceneTopics(sceneId);
  return Promise.all(topics.map(async (topic) => {
    let kafkaMetadata = null;
    try {
      kafkaMetadata = await kafkaRuntime.getTopicMetadata(topic.topicName);
    } catch (error) {
      kafkaMetadata = { available: false, error: error.message };
    }
    return {
      topicName: topic.topicName,
      ...runtime.getTopicMetrics(scene.sceneCode, topic.topicName),
      kafkaMetadata
    };
  }));
}

async function listSceneBusinessTables(sceneId) {
  await getSceneBase(sceneId);
  return listSceneTables(sceneId);
}

async function previewSceneTableData({ sceneId, tableName, page = 1, pageSize = 20, sortField, sortOrder }) {
  const scene = await getSceneBase(sceneId);
  const sceneTables = await listSceneTables(sceneId);
  const target = sceneTables.find((item) => item.logicalTableName === tableName || item.physicalTableName === tableName);
  if (!target) {
    throw new AppError("场景表不存在", 404);
  }
  const currentPage = Math.max(1, Number(page));
  const currentPageSize = Math.max(1, Number(pageSize));
  const offset = (currentPage - 1) * currentPageSize;
  const total = await countRowsInStorage(scene, target.physicalTableName);
  const rows = await fetchRowsFromStorage(scene, target.physicalTableName, {
    pageSize: currentPageSize,
    offset,
    sortField,
    sortOrder,
  });
  return {
    table: target,
    total,
    page: currentPage,
    pageSize: currentPageSize,
    rows
  };
}

async function exportSceneTableCsv(sceneId, tableName) {
  const preview = await previewSceneTableData({ sceneId, tableName, page: 1, pageSize: 5000 });
  const fields = Object.keys(preview.rows[0] || {});
  const escapeCsv = (value) => {
    if (value === null || value === undefined) return "";
    const text = String(value).replace(/"/g, '""');
    return /[",\n]/.test(text) ? `"${text}"` : text;
  };
  const lines = [fields.join(",")];
  preview.rows.forEach((row) => {
    lines.push(fields.map((field) => escapeCsv(row[field])).join(","));
  });
  return {
    fileName: `${tableName}.csv`,
    content: lines.join("\n"),
    total: preview.total
  };
}

async function reviewSceneRealism(sceneId, payload = {}) {
  const scene = await getSceneBase(sceneId);
  const schema = await getCurrentSchemaVersion(sceneId);
  if (!schema) {
    throw new AppError("请先生成并确认结构", 400);
  }
  const sampleTables = Math.max(1, Number(payload.sampleTables || 6));
  const sampleRows = Math.max(1, Number(payload.sampleRows || 2));
  const sceneTables = await listSceneBusinessTables(sceneId);
  const sampledTables = [];
  for (const table of sceneTables.slice(0, sampleTables)) {
    const preview = await previewSceneTableData({ sceneId, tableName: table.logicalTableName, page: 1, pageSize: Math.max(sampleRows * 4, sampleRows) });
    const rawRows = preview.rows || [];
    const cleanRawRows = rawRows.filter((row) => !row.__dirtyFlag);
    const selectedSourceRows = (cleanRawRows.length > 0 ? cleanRawRows : rawRows).slice(0, sampleRows);
    const selectedRows = selectedSourceRows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith("__"))));
    sampledTables.push({
      tableName: table.logicalTableName,
      physicalTableName: table.physicalTableName,
      rowCount: preview.total,
      sampleRows: selectedRows,
    });
  }

  const provider = payload.modelProfileId
    ? await getLabModelProviderByProfileId(payload.modelProfileId)
    : await getSceneGenerateProvider(scene, { allowDefault: true });

  const promptPayload = {
    sceneName: scene.sceneName,
    sceneDesc: scene.sceneDesc,
    researchPack: schema.content?.researchPack || null,
    scenarioProfile: schema.content?.scenarioProfile || null,
    tableCount: (schema.content?.tables || []).length,
    dictTableCount: (schema.content?.dictTables || []).length,
    sampledTables,
  };

  if (!provider) {
    return {
      enabled: false,
      usedModel: false,
      reason: "no_active_model_provider",
      summary: "No active model provider available for realism review.",
      promptPayload,
    };
  }

  const promptConfig = await getRuntimePromptConfig(
    "DATA_REALISM_REVIEW",
    {
      systemPrompt: promptDefaults.buildDataRealismReviewDefaultPrompt(),
      userPrompt: promptDefaults.buildDataRealismReviewDefaultUserPrompt(),
    },
    {
      ...promptPayload,
      input: {
        ...promptPayload,
        outputContract: {
          onlyJson: true,
          fields: ["pass", "realismScore", "summary", "findings", "obviousFakePatterns", "recommendations"],
          findingsRules: ["每条只写一个问题", "优先指出一眼假的地方", "可以引用字段名或表名"],
          recommendationRules: ["每条建议都应可落到生成器、字段规则、时间链、地址语料、编号规则或分布规则"],
        },
      },
    }
  );
  const strictSystemPrompt = `${systemPrompt}\n严格要求：1. 只能输出一个JSON对象。2. realismScore统一使用0到100的数字。3. findings、obviousFakePatterns、recommendations都必须是字符串数组。4. 不要输出Markdown代码块，不要补充解释文字。`;
  const systemPrompt = promptConfig.systemPrompt;
  const response = await modelProviderService.generateChatCompletion(
    normalizeProviderForChat(provider),
    [
      { role: "system", content: strictSystemPrompt },
      {
        role: "user",
        content: JSON.stringify({
          ...promptPayload,
          outputContract: {
            onlyJson: true,
            fields: ["pass", "realismScore", "summary", "findings", "obviousFakePatterns", "recommendations"],
            findingsRules: ["每条只写一个问题", "优先指出一眼假的地方", "可以引用字段名或表名"],
            recommendationRules: ["每条建议都应可落到生成器、字段规则、时间链、地址语料、编号规则或分布规则"],
          }
        }, null, 2)
      }
    ],
    { temperature: promptConfig.temperature, maxTokens: promptConfig.maxTokens }
  );
  let parsed = tryParseJson(response.content) || null;
  let parseMode = parsed ? "json" : "raw_text";
  if (!parsed) {
    parsed = await repairRealismReviewOutput(provider, response.content);
    if (parsed) {
      parseMode = "repair_json";
    }
  }
  const normalizedPayload = normalizeRealismResponsePayload(parsed, response.content);
  const parsedPayload = normalizedPayload.payload || {};
  const structured = normalizedPayload.structured;
  if (normalizedPayload.parseMode && normalizedPayload.parseMode !== "json") {
    parseMode = normalizedPayload.parseMode;
  }
  const rawScore = Number(parsedPayload.realismScore || 0);
  const normalizedScore = rawScore <= 1
    ? Number((rawScore * 100).toFixed(2))
    : rawScore <= 5
      ? Number((rawScore * 20).toFixed(2))
      : rawScore <= 10
        ? Number((rawScore * 10).toFixed(2))
      : rawScore;
  const normalizedReview = normalizeRealismReview(parsedPayload);
  return {
    enabled: true,
    usedModel: true,
    structured,
    parseMode,
    summary: parsedPayload.summary || (structured ? "Model realism review completed." : "Model realism review returned unstructured content."),
    pass: parsedPayload.pass === null || parsedPayload.pass === undefined ? null : Boolean(parsedPayload.pass),
    realismScore: normalizedScore > 0 ? normalizedScore : null,
    findings: Array.isArray(parsedPayload.findings) ? parsedPayload.findings : [],
    obviousFakePatterns: Array.isArray(parsedPayload.obviousFakePatterns) ? parsedPayload.obviousFakePatterns : [],
    recommendations: Array.isArray(parsedPayload.recommendations) ? parsedPayload.recommendations : [],
    normalizedIssues: normalizedReview.issues,
    fixPlan: normalizedReview.fixPlan,
    issueStats: normalizedReview.issueStats,
    rawText: response.content,
    promptPayload,
  };
}

function buildDirtyScriptSystemPrompt(dialect) {
  return [
    "你是测试数据脏化脚本设计助手。",
    "目标：基于现有场景结构和样本数据，生成后处理脏数据注入脚本。",
    "只返回合法 JSON，不要 markdown，不要解释。",
    `脚本方言优先使用 ${dialect}。`,
    "返回字段固定为 summary、scriptLanguage、scriptContent、operationChecklist。",
    "operationChecklist 为数组，每项包含 tableName、actionType、fieldName、description。",
    "actionType 只允许 delete_rows、set_null、inject_garbage_text、break_time_order、break_reference、invalid_enum。",
    "脚本只做后处理，不要重新造数。",
    "脚本必须包含安全注释，并限制影响比例，不要整表清空。",
  ].join(" ");
}

function buildDirtyScriptFallback(dialect, sampledTables, dirtyRatio) {
  const ratio = Math.max(0.01, Math.min(0.3, Number(dirtyRatio || 0.05)));
  const quote = dialect === "postgresql" ? "\"" : "`";
  const randFn = dialect === "postgresql" ? "RANDOM()" : "RAND()";
  const stringFields = [];
  const nullableFields = [];
  const datetimeFields = [];

  for (const table of sampledTables) {
    for (const field of table.fields || []) {
      const fieldType = String(field.fieldType || "").toUpperCase();
      if (field.nullable) nullableFields.push({ tableName: table.physicalTableName, fieldName: field.fieldName });
      if (fieldType.includes("CHAR") || fieldType.includes("TEXT")) stringFields.push({ tableName: table.physicalTableName, fieldName: field.fieldName });
      if (fieldType.includes("DATE") || fieldType.includes("TIME")) datetimeFields.push({ tableName: table.physicalTableName, fieldName: field.fieldName });
    }
  }

  const operations = [];
  const lines = [
    `-- dirty ratio target: ${ratio}`,
    "-- apply on a copied / test dataset only",
    "START TRANSACTION;",
  ];

  sampledTables.slice(0, 2).forEach((table) => {
    operations.push({
      tableName: table.physicalTableName,
      actionType: "delete_rows",
      fieldName: null,
      description: "随机删除一小部分记录，制造缺失样本",
    });
    if (dialect === "postgresql") {
      lines.push(`DELETE FROM ${quote}${table.physicalTableName}${quote} WHERE ctid IN (SELECT ctid FROM ${quote}${table.physicalTableName}${quote} WHERE ${randFn} < ${Number((ratio * 0.12).toFixed(4))} LIMIT 5);`);
    } else {
      lines.push(`DELETE FROM ${quote}${table.physicalTableName}${quote} WHERE ${randFn} < ${Number((ratio * 0.12).toFixed(4))} LIMIT 5;`);
    }
  });

  stringFields.slice(0, 2).forEach((item) => {
    operations.push({
      tableName: item.tableName,
      actionType: "inject_garbage_text",
      fieldName: item.fieldName,
      description: "注入垃圾字符串，制造脏文本",
    });
    lines.push(`UPDATE ${quote}${item.tableName}${quote} SET ${quote}${item.fieldName}${quote} = CONCAT('@@脏值@@', ${quote}${item.fieldName}${quote}) WHERE ${randFn} < ${Number((ratio * 0.18).toFixed(4))};`);
  });

  nullableFields.slice(0, 2).forEach((item) => {
    operations.push({
      tableName: item.tableName,
      actionType: "set_null",
      fieldName: item.fieldName,
      description: "随机置空可空字段，制造缺失值",
    });
    lines.push(`UPDATE ${quote}${item.tableName}${quote} SET ${quote}${item.fieldName}${quote} = NULL WHERE ${randFn} < ${Number((ratio * 0.2).toFixed(4))};`);
  });

  datetimeFields.slice(0, 1).forEach((item) => {
    operations.push({
      tableName: item.tableName,
      actionType: "break_time_order",
      fieldName: item.fieldName,
      description: "把部分时间字段回拨，制造时间先后顺序异常",
    });
    lines.push(
      dialect === "postgresql"
        ? `UPDATE ${quote}${item.tableName}${quote} SET ${quote}${item.fieldName}${quote} = ${quote}${item.fieldName}${quote} - interval '7 day' WHERE ${randFn} < ${Number((ratio * 0.1).toFixed(4))};`
        : `UPDATE ${quote}${item.tableName}${quote} SET ${quote}${item.fieldName}${quote} = DATE_SUB(${quote}${item.fieldName}${quote}, INTERVAL 7 DAY) WHERE ${randFn} < ${Number((ratio * 0.1).toFixed(4))};`
    );
  });

  lines.push("COMMIT;");

  return {
    summary: "已生成基于随机删除、随机置空、垃圾文本注入和时间回拨的后处理脏数据脚本。",
    scriptLanguage: "sql",
    scriptContent: lines.join("\n"),
    operationChecklist: operations,
  };
}

async function generateDirtyScript(sceneId, payload = {}) {
  const scene = await getSceneBase(sceneId);
  const schema = await getCurrentSchemaVersion(sceneId);
  if (!schema) {
    throw new AppError("请先完成结构设计并确认结构版本", 400);
  }

  const sampleTables = Math.max(1, Number(payload.sampleTables || 3));
  const sampleRows = Math.max(1, Number(payload.sampleRows || 3));
  const dirtyRatio = Math.max(0, Number(payload.dirtyRatio || scene.dirtyRatio || 0.05));
  const sceneTables = await listSceneTables(sceneId);
  const sampledTables = [];
  for (const table of sceneTables.slice(0, sampleTables)) {
    const preview = await previewSceneTableData({ sceneId, tableName: table.logicalTableName, page: 1, pageSize: Math.max(sampleRows * 3, sampleRows) });
    sampledTables.push({
      logicalTableName: table.logicalTableName,
      physicalTableName: table.physicalTableName,
      fields: (schema.content?.tables || []).find((item) => item.tableName === table.logicalTableName)?.fields || [],
      sampleRows: (preview.rows || []).slice(0, sampleRows).map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith("__")))),
    });
  }

  const offlineSource = scene.offlineDataSourceId ? await dataLabSourceRepository.getDataSourceById(scene.offlineDataSourceId) : null;
  const dialect = normalizeStorageSourceType(offlineSource?.sourceType, offlineSource?.connectionConfig || {});

  const provider = payload.modelProfileId
    ? await getLabModelProviderByProfileId(payload.modelProfileId)
    : await getSceneGenerateProvider(scene, { allowDefault: true });

  const promptPayload = {
    sceneName: scene.sceneName,
    sceneDesc: scene.sceneDesc,
    dirtyRatio,
    dialect,
    sampledTables,
  };

  if (!provider) {
    return {
      enabled: false,
      usedModel: false,
      reason: "no_active_model_provider",
      ...buildDirtyScriptFallback(dialect, sampledTables, dirtyRatio),
      promptPayload,
    };
  }

  try {
    const promptConfig = await getRuntimePromptConfig(
      "DIRTY_SCRIPT",
      {
        systemPrompt: buildDirtyScriptSystemPrompt(dialect),
        userPrompt: promptDefaults.buildDirtyScriptDefaultUserPrompt(),
      },
      {
        ...promptPayload,
        input: promptPayload,
        dialect,
      }
    );
    const response = await modelProviderService.generateChatCompletion(
      promptConfig.provider || normalizeProviderForChat(provider),
      [
        { role: "system", content: promptConfig.systemPrompt },
        { role: "user", content: promptConfig.userPrompt },
      ],
      { temperature: promptConfig.temperature, maxTokens: promptConfig.maxTokens }
    );
    const parsed = tryParseJson(response.content) || {};
    const fallback = buildDirtyScriptFallback(dialect, sampledTables, dirtyRatio);
    return {
      enabled: true,
      usedModel: true,
      promptPayload,
      summary: pickText(parsed.summary, fallback.summary),
      scriptLanguage: pickText(parsed.scriptLanguage, "sql"),
      scriptContent: pickText(parsed.scriptContent, fallback.scriptContent),
      operationChecklist: Array.isArray(parsed.operationChecklist) ? parsed.operationChecklist : fallback.operationChecklist,
      rawText: response.content,
    };
  } catch {
    return {
      enabled: true,
      usedModel: false,
      promptPayload,
      ...buildDirtyScriptFallback(dialect, sampledTables, dirtyRatio),
    };
  }
}

const REALISM_ISSUE_RULES = [
  { issueCode: "EMPTY_BUSINESS_CODE", severity: "high", fixTarget: "field_generator", fixStrategy: "enforce_non_blank_business_code", patterns: [/empty report_code/i, /report_code field contains/i, /empty.*code/i, /missing.*code/i, /编码.*为空/, /编号.*为空/, /业务编码.*缺失/, /批次号.*为空/] },
  { issueCode: "INVALID_ENUM_VALUE", severity: "high", fixTarget: "dictionary_rule", fixStrategy: "force_dictionary_enum_values", patterns: [/invalid enum/i, /__invalid_enum__/i, /enum value/i, /枚举值.*异常/, /字典值.*不匹配/, /状态值.*不在字典/, /占位值/] },
  { issueCode: "NEGATIVE_AMOUNT", severity: "high", fixTarget: "distribution_rule", fixStrategy: "clamp_non_negative_amounts", patterns: [/negative .*capital/i, /negative .*amount/i, /impossible .*negative/i, /金额.*为负/, /资本.*为负/, /余额.*为负/, /负数金额/] },
  { issueCode: "TIME_SEQUENCE_INVALID", severity: "high", fixTarget: "timeline_rule", fixStrategy: "derive_times_from_business_chain", patterns: [/temporal/i, /timeline/i, /before .*confirm/i, /after .*create/i, /sequence/i, /future-dated/i, /时间顺序/, /先后关系/, /早于.*提交/, /早于.*创建/, /未来时间/, /时间链.*异常/] },
  { issueCode: "RATIO_OUT_OF_RANGE", severity: "high", fixTarget: "distribution_rule", fixStrategy: "tighten_industry_metric_ranges", patterns: [/ratio/i, /exceeds 100/i, /implausibly high/i, /regulatory limit/i, /capital adequacy/i, /liquidity coverage/i, /比例.*超范围/, /比率.*异常/, /超过100/, /监管指标.*异常/] },
  { issueCode: "STATUS_FLOW_INCONSISTENT", severity: "high", fixTarget: "workflow_rule", fixStrategy: "enforce_state_transition_graph", patterns: [/status contradiction/i, /workflow/i, /cancelled .* confirm/i, /pending .* settled/i, /state transition/i, /状态流/, /状态.*不一致/, /流程.*不一致/, /状态跳变/] },
  { issueCode: "FK_RELATION_WEAK", severity: "medium", fixTarget: "relation_rule", fixStrategy: "strengthen_parent_child_linkage", patterns: [/foreign key/i, /missing parent/i, /referential integrity/i, /relationships appear broken/i, /主外键/, /关联.*缺失/, /父记录.*缺失/, /引用.*不存在/] },
  { issueCode: "MISSING_CORE_TABLE", severity: "medium", fixTarget: "research_pack", fixStrategy: "expand_core_candidate_tables", patterns: [/missing key tables/i, /table count mismatch/i, /not represented in samples/i, /缺少核心表/, /关键表.*缺失/, /核心业务表.*未覆盖/, /表不全/] },
  { issueCode: "MISSING_DICT_TABLE", severity: "medium", fixTarget: "dictionary_planner", fixStrategy: "increase_dictionary_table_generation", patterns: [/dictionary .* underutilization/i, /only .* dictionary tables/i, /missing dictionary/i, /字典表.*缺失/, /字典覆盖不足/, /枚举字典.*缺失/] },
  { issueCode: "SEQUENTIAL_ID_PATTERN", severity: "medium", fixTarget: "id_generator", fixStrategy: "reduce_visible_sequential_patterns", patterns: [/sequential/i, /incremental pattern/i, /patterned ids/i, /顺序编号/, /连续编号/, /编号.*过于规则/, /id.*过于规律/] },
  { issueCode: "INVALID_CONTACT_FORMAT", severity: "medium", fixTarget: "pii_generator", fixStrategy: "harden_phone_email_format_generation", patterns: [/mobile .* not valid/i, /invalid .* mobile/i, /email .* pattern/i, /contact .* format/i, /手机号.*格式/, /邮箱.*格式/, /联系方式.*异常/, /联系电话.*异常/] },
  { issueCode: "GENERIC_ADDRESS_PATTERN", severity: "medium", fixTarget: "address_generator", fixStrategy: "use_realistic_address_corpus", patterns: [/generic .* address/i, /sender road/i, /receiver road/i, /地址.*泛化/, /地址.*模板化/, /地址.*过于通用/, /寄件地址.*路/, /收件地址.*路/] },
  { issueCode: "POSTAL_REGION_MISMATCH", severity: "medium", fixTarget: "address_generator", fixStrategy: "align_postal_code_and_region_codes", patterns: [/postal/i, /zip code/i, /邮编.*不匹配/, /邮政编码.*不匹配/, /行政区划.*不一致/, /区划编码.*不一致/] },
  { issueCode: "INSTITUTION_NAMING_MISMATCH", severity: "medium", fixTarget: "semantic_planner", fixStrategy: "normalize_cn_institution_naming", patterns: [/institution_name/i, /regulator_name/i, /机构命名/, /机构名称.*不规范/, /监管机构.*不规范/, /机构类型.*不匹配/] },
  { issueCode: "FUND_CODE_GENERIC", severity: "medium", fixTarget: "code_generator", fixStrategy: "upgrade_fund_code_pattern", patterns: [/fund code/i, /fund_code/i, /基金代码.*顺序/, /基金代码.*过于简单/, /编码规则.*基金/] },
  { issueCode: "ROUTE_MODE_MISMATCH", severity: "medium", fixTarget: "route_generator", fixStrategy: "align_route_mode_and_city_scope", patterns: [/same_city/i, /route mode/i, /transport_mode/i, /同城.*跨城/, /运输方式.*不匹配/, /路线.*同城.*跨城/] },
  { issueCode: "STAGE_MISMATCH", severity: "high", fixTarget: "semantic_planner", fixStrategy: "align_stage_grade_and_institution_types", patterns: [/stage mismatch/i, /education_stage/i, /junior high .* undergrad/i, /grade_code/i, /学段.*不匹配/, /年级.*不匹配/, /机构类型.*不匹配/] },
  { issueCode: "UNREALISTIC_SCALE", severity: "medium", fixTarget: "distribution_rule", fixStrategy: "recalibrate_scale_and_volume_ranges", patterns: [/scale mismatch/i, /unrealistic scale/i, /holder count/i, /average holding/i, /规模.*不合理/, /量级.*不合理/, /体量.*不合理/, /人数.*过多/, /人数.*过少/] },
];

function flattenRealismTexts(realism) {
  const values = [];
  const pushText = (value) => {
    if (!value) return;
    if (typeof value === "string") {
      values.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(pushText);
      return;
    }
    if (typeof value === "object") {
      Object.values(value).forEach(pushText);
    }
  };
  pushText(realism?.summary);
  pushText(realism?.findings);
  pushText(realism?.obviousFakePatterns);
  pushText(realism?.recommendations);
  return values.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeRealismReview(realism) {
  const texts = flattenRealismTexts(realism);
  const matched = new Map();
  texts.forEach((text) => {
    REALISM_ISSUE_RULES.forEach((rule) => {
      if (rule.patterns.some((pattern) => pattern.test(text))) {
        if (!matched.has(rule.issueCode)) {
          matched.set(rule.issueCode, {
            issueCode: rule.issueCode,
            severity: rule.severity,
            fixTarget: rule.fixTarget,
            fixStrategy: rule.fixStrategy,
            evidence: [],
          });
        }
        const current = matched.get(rule.issueCode);
        if (current.evidence.length < 5) {
          current.evidence.push(text);
        }
      }
    });
  });
  const issues = [...matched.values()];
  const fixPlan = issues.map((item) => ({
    issueCode: item.issueCode,
    fixTarget: item.fixTarget,
    fixStrategy: item.fixStrategy,
    severity: item.severity,
  }));
  const issueStats = issues.reduce((result, item) => {
    result[item.issueCode] = item.evidence.length;
    return result;
  }, {});
  return { issues, fixPlan, issueStats };
}

const ISSUE_CATEGORY_MAP = {
  COMPLETENESS: "完整性",
  CONSISTENCY: "一致性",
  ACCURACY: "准确性",
  COMPLIANCE: "合规性",
  TIMELINESS: "时效性",
  UNIQUENESS: "唯一性",
};

function normalizeQualityText(value) {
  return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function parseTimeValue(value) {
  const time = new Date(String(value || "")).getTime();
  return Number.isNaN(time) ? null : time;
}

function addQualityIssue(fieldIssues, issueFields, issueCategoryStats, issueTypeStats, tableName, fieldName, issueType, issueCategory, issueCount) {
  if (!issueCount || issueCount <= 0) {
    return 0;
  }
  if (fieldName) {
    issueFields.add(fieldName);
  }
  fieldIssues.push({ tableName, fieldName, issueType, issueCategory, issueCount });
  issueCategoryStats[issueCategory] = Number(issueCategoryStats[issueCategory] || 0) + issueCount;
  issueTypeStats[issueType] = Number(issueTypeStats[issueType] || 0) + issueCount;
  return issueCount;
}

function countNormalizedDuplicates(rows, fieldName) {
  const counter = new Map();
  for (const row of rows) {
    const normalized = normalizeQualityText(row[fieldName]);
    if (!normalized) continue;
    counter.set(normalized, Number(counter.get(normalized) || 0) + 1);
  }
  let duplicateRows = 0;
  for (const count of counter.values()) {
    if (count > 1) duplicateRows += count;
  }
  return duplicateRows;
}

function isNumericFieldLike(field) {
  return /INT|DECIMAL|NUMERIC|NUMBER/.test(String(field?.fieldType || "").toUpperCase());
}

function isDateFieldLike(field) {
  return /DATE|TIME/.test(String(field?.fieldType || "").toUpperCase()) || String(field?.businessSemantic || "").toUpperCase().includes("DATETIME");
}

function isTextFieldLike(field) {
  return !isNumericFieldLike(field) && !isDateFieldLike(field);
}

function getFieldNameTokens(fieldName) {
  return String(fieldName || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function hasFieldNameToken(fieldName, token) {
  return getFieldNameTokens(fieldName).includes(String(token || "").toLowerCase());
}

function isNumericSensitiveField(field) {
  const tokens = getFieldNameTokens(field?.fieldName);
  return ["amount", "price", "balance", "capital", "ratio", "qty", "count", "score", "value"].some((token) => tokens.includes(token));
}

function collectScenarioSpecificQualityIssues(tableName, rows, addIssue) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }
  let dirtyRows = 0;
  const countRows = (predicate) => rows.filter(predicate).length;

  if (tableName === "order_header") {
    dirtyRows += addIssue("pay_time", "ORDER_PAY_BEFORE_ORDER", "CONSISTENCY", countRows((row) => parseTimeValue(row.pay_time) !== null && parseTimeValue(row.order_time) !== null && parseTimeValue(row.pay_time) < parseTimeValue(row.order_time)));
    dirtyRows += addIssue("ship_time", "ORDER_SHIP_BEFORE_PAY", "CONSISTENCY", countRows((row) => parseTimeValue(row.ship_time) !== null && parseTimeValue(row.pay_time) !== null && parseTimeValue(row.ship_time) < parseTimeValue(row.pay_time)));
    dirtyRows += addIssue("complete_time", "ORDER_COMPLETE_BEFORE_SHIP", "TIMELINESS", countRows((row) => parseTimeValue(row.complete_time) !== null && parseTimeValue(row.ship_time) !== null && parseTimeValue(row.complete_time) < parseTimeValue(row.ship_time)));
    dirtyRows += addIssue("payment_status", "ORDER_STATUS_PAYMENT_CONFLICT", "CONSISTENCY", countRows((row) => String(row.order_status) === "已完成" && String(row.payment_status) !== "支付成功"));
  }

  if (tableName === "order_item") {
    dirtyRows += addIssue("item_amount", "ORDER_ITEM_AMOUNT_MISMATCH", "CONSISTENCY", countRows((row) => Number(row.item_amount || 0) !== Number((Number(row.promo_price || 0) * Number(row.quantity || 0)).toFixed(2))));
  }

  if (tableName === "payment_record") {
    dirtyRows += addIssue("settlement_time", "PAYMENT_SETTLEMENT_BEFORE_PAY", "TIMELINESS", countRows((row) => parseTimeValue(row.settlement_time) !== null && parseTimeValue(row.pay_time) !== null && parseTimeValue(row.settlement_time) < parseTimeValue(row.pay_time)));
    dirtyRows += addIssue("pay_amount", "PAYMENT_NEGATIVE_AMOUNT", "ACCURACY", countRows((row) => Number(row.pay_amount || 0) < 0));
  }

  if (tableName === "refund_ticket") {
    dirtyRows += addIssue("refund_amount", "REFUND_AMOUNT_EXCEEDS_LIMIT", "ACCURACY", countRows((row) => Number(row.refund_amount || 0) > 200000 || Number(row.refund_amount || 0) <= 0));
    dirtyRows += addIssue("approve_time", "REFUND_APPROVE_BEFORE_APPLY", "TIMELINESS", countRows((row) => parseTimeValue(row.approve_time) !== null && parseTimeValue(row.apply_time) !== null && parseTimeValue(row.approve_time) < parseTimeValue(row.apply_time)));
  }

  if (tableName === "logistics_delivery") {
    dirtyRows += addIssue("signed_time", "DELIVERY_SIGN_BEFORE_DISPATCH", "TIMELINESS", countRows((row) => parseTimeValue(row.signed_time) !== null && parseTimeValue(row.dispatch_time) !== null && parseTimeValue(row.signed_time) < parseTimeValue(row.dispatch_time)));
  }

  if (tableName === "violation_record") {
    dirtyRows += addIssue("notice_time", "VIOLATION_NOTICE_BEFORE_CAPTURE", "TIMELINESS", countRows((row) => parseTimeValue(row.notice_time) !== null && parseTimeValue(row.capture_time) !== null && parseTimeValue(row.notice_time) < parseTimeValue(row.capture_time)));
    dirtyRows += addIssue("handle_deadline", "VIOLATION_DEADLINE_BEFORE_NOTICE", "TIMELINESS", countRows((row) => parseTimeValue(row.handle_deadline) !== null && parseTimeValue(row.notice_time) !== null && parseTimeValue(row.handle_deadline) < parseTimeValue(row.notice_time)));
  }

  if (tableName === "checkpoint_inspection") {
    dirtyRows += addIssue("release_time", "INSPECTION_RELEASE_BEFORE_START", "TIMELINESS", countRows((row) => parseTimeValue(row.release_time) !== null && parseTimeValue(row.inspection_time) !== null && parseTimeValue(row.release_time) < parseTimeValue(row.inspection_time)));
  }

  if (tableName === "accident_case") {
    dirtyRows += addIssue("close_time", "ACCIDENT_CLOSE_BEFORE_OCCUR", "TIMELINESS", countRows((row) => parseTimeValue(row.close_time) !== null && parseTimeValue(row.occur_time) !== null && parseTimeValue(row.close_time) < parseTimeValue(row.occur_time)));
  }

  if (tableName === "enforcement_document") {
    dirtyRows += addIssue("serve_time", "DOCUMENT_SERVE_BEFORE_ISSUE", "TIMELINESS", countRows((row) => parseTimeValue(row.serve_time) !== null && parseTimeValue(row.issue_time) !== null && parseTimeValue(row.serve_time) < parseTimeValue(row.issue_time)));
  }

  if (tableName === "prudential_report") {
    dirtyRows += addIssue("receive_time", "REPORT_RECEIVE_BEFORE_SUBMIT", "TIMELINESS", countRows((row) => parseTimeValue(row.receive_time) !== null && parseTimeValue(row.submit_time) !== null && parseTimeValue(row.receive_time) < parseTimeValue(row.submit_time)));
    dirtyRows += addIssue("core_tier1_ratio", "BANK_RATIO_HIERARCHY_INVALID", "CONSISTENCY", countRows((row) => Number(row.core_tier1_ratio || 0) > Number(row.tier1_capital_ratio || 0) || Number(row.tier1_capital_ratio || 0) > Number(row.capital_adequacy_ratio || 0)));
  }

  if (tableName === "report_metric_item") {
    dirtyRows += addIssue("metric_value", "BANK_METRIC_OUTLIER", "ACCURACY", countRows((row) => Number(row.metric_value || 0) < 0 || Number(row.metric_value || 0) > 150));
  }

  if (tableName === "risk_exposure_snapshot") {
    dirtyRows += addIssue("concentration_ratio", "RISK_CONCENTRATION_OVERFLOW", "ACCURACY", countRows((row) => Number(row.concentration_ratio || 0) < 0 || Number(row.concentration_ratio || 0) > 100));
    dirtyRows += addIssue("early_warning_level", "RISK_LEVEL_INCONSISTENT", "CONSISTENCY", countRows((row) => Number(row.concentration_ratio || 0) > 80 && String(row.early_warning_level || row.risk_level) === "正常"));
  }

  if (tableName === "anti_money_alert") {
    dirtyRows += addIssue("report_required_status", "AML_REPORT_STATUS_CONFLICT", "CONSISTENCY", countRows((row) => String(row.review_result) === "可疑" && String(row.report_required_status) !== "已上报"));
  }

  if (tableName === "exception_case") {
    dirtyRows += addIssue("due_at", "CASE_DUE_BEFORE_IDENTIFIED", "TIMELINESS", countRows((row) => parseTimeValue(row.due_at) !== null && parseTimeValue(row.identified_at) !== null && parseTimeValue(row.due_at) < parseTimeValue(row.identified_at)));
    dirtyRows += addIssue("disposed_at", "CASE_DISPOSED_BEFORE_IDENTIFIED", "TIMELINESS", countRows((row) => parseTimeValue(row.disposed_at) !== null && parseTimeValue(row.identified_at) !== null && parseTimeValue(row.disposed_at) < parseTimeValue(row.identified_at)));
  }

  if (tableName === "rectification_task") {
    dirtyRows += addIssue("finish_time", "TASK_FINISH_BEFORE_START", "TIMELINESS", countRows((row) => parseTimeValue(row.finish_time) !== null && parseTimeValue(row.start_time) !== null && parseTimeValue(row.finish_time) < parseTimeValue(row.start_time)));
  }

  if (tableName === "submission_log") {
    dirtyRows += addIssue("retry_count", "SUBMISSION_RETRY_STATUS_CONFLICT", "CONSISTENCY", countRows((row) => Number(row.retry_count || 0) > 0 && String(row.log_status) === "已接收"));
  }

  if (tableName === "approval_flow") {
    dirtyRows += addIssue("next_node", "APPROVAL_NEXT_NODE_CONFLICT", "CONSISTENCY", countRows((row) => String(row.approval_result) === "通过" && String(row.next_node) === "机构复核"));
  }

  dirtyRows += educationSupport.collectEducationQualityIssues(tableName, rows, addIssue);
  return dirtyRows;
}

function resolveAllowedValuesForField(field, dicts, scenarioProfile = {}) {
  const fieldName = String(field?.fieldName || "").toLowerCase();
  const byTableKeyword = (keyword) => dicts.filter((item) => String(item.tableName || "").toLowerCase().includes(keyword)).map((item) => String(item.dictKey));
  const fromProfile = (items) => (Array.isArray(items) ? items.map((item) => String(item.code ?? item)).filter(Boolean) : []);
  if (fieldName.includes("category")) return byTableKeyword("category");
  if (fieldName.includes("pay_channel")) return [...fromProfile(scenarioProfile.paymentChannels), ...byTableKeyword("channel")];
  if (fieldName.includes("order_status")) return fromProfile(scenarioProfile.orderStatuses);
  if (fieldName.includes("vehicle_type")) return fromProfile(scenarioProfile.vehicleTypes);
  if (fieldName.includes("violation_code")) return fromProfile(scenarioProfile.violationCodes);
  if (fieldName.includes("violation_status")) return fromProfile(scenarioProfile.violationStatuses);
  if (fieldName.includes("inspection_result")) return fromProfile(scenarioProfile.inspectionResults);
  if (fieldName.includes("branch_type")) return [...fromProfile(scenarioProfile.branchTypes), ...byTableKeyword("branch_type")];
  if (fieldName.includes("report_code")) return [...fromProfile(scenarioProfile.reportCodes), ...byTableKeyword("report_code")];
  if (fieldName.includes("report_status")) return fromProfile(scenarioProfile.reportStatuses);
  if (fieldName.includes("issue_type")) return fromProfile(scenarioProfile.issueTypes);
  if (fieldName.includes("issue_level")) return fromProfile(scenarioProfile.issueLevels);
  if (fieldName === "data_status") return ["正常"];
  if (fieldName.includes("risk_level")) return ["低风险", "中风险", "高风险", "正常", "关注", "预警"];
  if (fieldName.includes("approval_result")) return ["通过", "退回", "补充材料"];
  if (fieldName.includes("review_result")) return ["正常", "可疑", "需补充说明"];
  if (fieldName.includes("task_status")) return ["待执行", "整改中", "已完成", "已延期"];
  if (fieldName.includes("disposal_status")) return ["待整改", "整改中", "已关闭", "升级处理"];
  if (fieldName.includes("delivery_status")) return ["待出库", "已出库", "运输中", "已签收", "配送异常"];
  if (fieldName.includes("payment_status")) return ["待支付", "支付成功", "支付失败", "已关闭", "已退款", "缴款成功", "待缴款", "缴款失败", "已冲正"];
  if (fieldName.includes("shelf_status")) return ["在售", "预售", "暂时缺货", "停售"];
  if (fieldName.includes("insurance_status")) return ["有效", "临近到期", "已过期"];
  if (fieldName.includes("reporting_flag")) return ["纳入报送", "观察名单"];
  const educationAllowed = educationSupport.resolveEducationAllowedValues(fieldName, scenarioProfile);
  if (educationAllowed.length > 0) return educationAllowed;
  return [];
}

function collectComplianceRuleIssues(complianceRules, tableName, rows, addIssue) {
  if (!Array.isArray(complianceRules) || !Array.isArray(rows) || rows.length === 0) {
    return 0;
  }
  let dirtyRows = 0;
  const matchedRules = complianceRules.filter((rule) => rule && rule.status !== "inactive" && rule.tableName === tableName);
  for (const rule of matchedRules) {
    const fieldName = rule.fieldName;
    const config = rule.ruleConfig || {};
    let issueCount = 0;
    if (rule.ruleType === "REGEX" && config.pattern) {
      const regex = new RegExp(String(config.pattern));
      issueCount = rows.filter((row) => row[fieldName] !== null && row[fieldName] !== undefined && !regex.test(String(row[fieldName]))).length;
    }
    if (rule.ruleType === "ENUM_ALLOWED" && Array.isArray(config.allowedValues)) {
      const allowed = new Set(config.allowedValues.map(String));
      issueCount = rows.filter((row) => row[fieldName] !== null && row[fieldName] !== undefined && !allowed.has(String(row[fieldName]))).length;
    }
    if (rule.ruleType === "MASKING_REQUIRED") {
      issueCount = rows.filter((row) => row[fieldName] && !String(row[fieldName]).includes("*")).length;
    }
    if (rule.ruleType === "NOT_NEGATIVE") {
      issueCount = rows.filter((row) => Number(row[fieldName] || 0) < 0).length;
    }
    if (rule.ruleType === "VALUE_RANGE") {
      const min = Number(config.min ?? Number.MIN_SAFE_INTEGER);
      const max = Number(config.max ?? Number.MAX_SAFE_INTEGER);
      issueCount = rows.filter((row) => {
        const value = Number(row[fieldName]);
        return !Number.isNaN(value) && (value < min || value > max);
      }).length;
    }
    if (rule.ruleType === "DATE_NOT_FUTURE") {
      issueCount = rows.filter((row) => {
        const time = parseTimeValue(row[fieldName]);
        return time !== null && time > Date.now();
      }).length;
    }
    dirtyRows += addIssue(fieldName, `COMPLIANCE_${rule.ruleCode}`, rule.issueCategory || "合规性", issueCount);
  }
  return dirtyRows;
}

function collectSemanticComplianceRuleIssues(complianceRules, tableFields, rows, addIssue, options = {}) {
  if (!Array.isArray(complianceRules) || !Array.isArray(tableFields) || !Array.isArray(rows) || rows.length === 0) {
    return 0;
  }
  let dirtyRows = 0;
  const fieldSemanticMap = options.fieldSemanticMap || ruleMatching.buildFieldSemanticMap(tableFields, options.modelSemanticMap || {});
  for (const field of tableFields) {
    const matches = ruleMatching.matchComplianceRulesForField(complianceRules, {
      tableName: field.tableName,
      fieldName: field.fieldName,
      fieldComment: field.fieldComment,
      businessSemantic: field.businessSemantic,
      fieldType: field.fieldType,
    }, { fieldSemanticMap, threshold: 0.55 });
    for (const matched of matches) {
      const rule = matched.rule;
      const fieldName = field.fieldName;
      const config = rule.ruleConfig || {};
      let issueCount = 0;
      if (rule.ruleType === "REGEX" && config.pattern) {
        const regex = new RegExp(String(config.pattern));
        issueCount = rows.filter((row) => row[fieldName] !== null && row[fieldName] !== undefined && !regex.test(String(row[fieldName]))).length;
      }
      if (rule.ruleType === "ENUM_ALLOWED" && Array.isArray(config.allowedValues)) {
        const allowed = new Set(config.allowedValues.map(String));
        issueCount = rows.filter((row) => row[fieldName] !== null && row[fieldName] !== undefined && !allowed.has(String(row[fieldName]))).length;
      }
      if (rule.ruleType === "MASKING_REQUIRED") {
        issueCount = rows.filter((row) => row[fieldName] && !String(row[fieldName]).includes("*")).length;
      }
      if (rule.ruleType === "NOT_NEGATIVE") {
        issueCount = rows.filter((row) => Number(row[fieldName] || 0) < 0).length;
      }
      if (rule.ruleType === "VALUE_RANGE") {
        const min = Number(config.min ?? Number.MIN_SAFE_INTEGER);
        const max = Number(config.max ?? Number.MAX_SAFE_INTEGER);
        issueCount = rows.filter((row) => {
          const value = Number(row[fieldName]);
          return !Number.isNaN(value) && (value < min || value > max);
        }).length;
      }
      if (rule.ruleType === "DATE_NOT_FUTURE") {
        issueCount = rows.filter((row) => {
          const time = parseTimeValue(row[fieldName]);
          return time !== null && time > Date.now();
        }).length;
      }
      dirtyRows += addIssue(fieldName, `COMPLIANCE_${rule.ruleCode}`, rule.issueCategory || "COMPLIANCE", issueCount);
    }
  }
  return dirtyRows;
}

function evaluateScenarioQualityGates({ tables, fields, dicts, relations, tableStats, scenarioProfile }) {
  const qualityGates = scenarioProfile?.qualityGates && typeof scenarioProfile.qualityGates === "object"
    ? scenarioProfile.qualityGates
    : {};
  const results = [];
  let penalty = 0;

  const requiredTables = Array.isArray(qualityGates.requiredTables) ? qualityGates.requiredTables : [];
  if (requiredTables.length > 0) {
    const existing = new Set((tables || []).map((item) => item.logicalTableName));
    const missing = requiredTables.filter((item) => !existing.has(String(item)));
    results.push({ gate: "requiredTables", passed: missing.length === 0, missing });
    if (missing.length > 0) {
      penalty += Math.min(20, missing.length * 4);
    }
  }

  const minFieldCount = Number(qualityGates.minFieldCount || 0);
  if (minFieldCount > 0) {
    const failures = (tables || [])
      .map((table) => ({
        tableName: table.logicalTableName,
        fieldCount: (fields || []).filter((field) => field.tableId === table.id).length,
      }))
      .filter((item) => item.fieldCount < minFieldCount);
    results.push({ gate: "minFieldCount", passed: failures.length === 0, failures, expected: minFieldCount });
    if (failures.length > 0) {
      penalty += Math.min(20, failures.length * 3);
    }
  }

  const minRelations = Number(qualityGates.minRelations || 0);
  if (minRelations > 0) {
    const relationCount = Array.isArray(relations) ? relations.length : 0;
    results.push({ gate: "minRelations", passed: relationCount >= minRelations, actual: relationCount, expected: minRelations });
    if (relationCount < minRelations) {
      penalty += Math.min(12, (minRelations - relationCount) * 2);
    }
  }

  const minDictTables = Number(qualityGates.minDictTables || 0);
  if (minDictTables > 0) {
    const dictTableCount = new Set((dicts || []).map((item) => item.tableName)).size;
    results.push({ gate: "minDictTables", passed: dictTableCount >= minDictTables, actual: dictTableCount, expected: minDictTables });
    if (dictTableCount < minDictTables) {
      penalty += Math.min(10, (minDictTables - dictTableCount) * 2);
    }
  }

  const forbiddenFieldPatterns = Array.isArray(qualityGates.forbiddenFieldPatterns) ? qualityGates.forbiddenFieldPatterns : [];
  if (forbiddenFieldPatterns.length > 0) {
    const hits = [];
    (fields || []).forEach((field) => {
      const fieldName = String(field.fieldName || "");
      const matchedPattern = forbiddenFieldPatterns.find((pattern) => {
        try {
          return new RegExp(String(pattern), "i").test(fieldName);
        } catch {
          return String(pattern).toLowerCase() === fieldName.toLowerCase();
        }
      });
      if (matchedPattern) {
        hits.push({ tableName: field.tableName, fieldName, pattern: matchedPattern });
      }
    });
    results.push({ gate: "forbiddenFieldPatterns", passed: hits.length === 0, hits });
    if (hits.length > 0) {
      penalty += Math.min(25, hits.length * 5);
    }
  }

  const requiredBusinessRoles = qualityGates.requiredBusinessRoles && typeof qualityGates.requiredBusinessRoles === "object"
    ? qualityGates.requiredBusinessRoles
    : null;
  if (requiredBusinessRoles) {
    const roleMap = (tables || []).reduce((result, table) => {
      result[table.businessRole] = Number(result[table.businessRole] || 0) + 1;
      return result;
    }, {});
    const failures = Object.entries(requiredBusinessRoles)
      .map(([role, expected]) => ({ role, expected: Number(expected || 0), actual: Number(roleMap[role] || 0) }))
      .filter((item) => item.actual < item.expected);
    results.push({ gate: "requiredBusinessRoles", passed: failures.length === 0, failures });
    if (failures.length > 0) {
      penalty += Math.min(15, failures.length * 3);
    }
  }

  const dirtyRateLimit = Number(qualityGates.maxDirtyRate || 0);
  if (dirtyRateLimit > 0) {
    const currentDirtyRate = tableStats.reduce((sum, item) => sum + Number(item.dirtyCellCount || 0), 0)
      / Math.max(1, tableStats.reduce((sum, item) => sum + Number(item.totalFieldCells || 0), 0));
    results.push({ gate: "maxDirtyRate", passed: currentDirtyRate <= dirtyRateLimit, actual: Number(currentDirtyRate.toFixed(4)), expected: dirtyRateLimit });
    if (currentDirtyRate > dirtyRateLimit) {
      penalty += Math.min(10, Math.ceil((currentDirtyRate - dirtyRateLimit) * 100));
    }
  }

  return {
    results,
    penalty,
    failedCount: results.filter((item) => item.passed === false).length,
  };
}

async function rebuildQualityReport(sceneId) {
  const scene = await getSceneBase(sceneId);
  const tables = await listSceneTables(sceneId);
  const fields = await listSceneFields(sceneId);
  const dicts = await listSceneDicts(sceneId);
  const relations = await listSceneRelations(sceneId);
  const strategy = await getCurrentStrategyVersion(sceneId);
  const scenarioProfile = strategy?.content?.scenarioProfile || {};
  const complianceRules = Array.isArray(scenarioProfile.complianceRules) ? scenarioProfile.complianceRules : [];
  const modelSemanticMap = await resolveFieldSemanticMapWithModel(scene, fields.map((field) => ({
    tableName: field.tableName,
    fieldName: field.fieldName,
    fieldComment: field.fieldComment,
    businessSemantic: field.businessSemantic,
    fieldType: field.fieldType,
  })));
  const fieldSemanticMap = ruleMatching.buildFieldSemanticMap(fields.map((field) => ({
    tableName: field.tableName,
    fieldName: field.fieldName,
    fieldComment: field.fieldComment,
    businessSemantic: field.businessSemantic,
    fieldType: field.fieldType,
  })), modelSemanticMap);
  const tableStats = [];
  const fieldIssues = [];
  const issueCategoryStats = {};
  const issueTypeStats = {};
  const previewRowsByTable = {};
  const totalRowsByTable = {};
  for (const table of tables) {
    totalRowsByTable[table.logicalTableName] = await countRowsInStorage(scene, table.physicalTableName);
    const previewRows = await fetchRowsFromStorage(scene, table.physicalTableName, { pageSize: 2000, offset: 0 });
    previewRowsByTable[table.logicalTableName] = previewRows;
  }
  for (const table of tables) {
    const tableFields = fields.filter((field) => field.tableId === table.id);
    const previewRows = previewRowsByTable[table.logicalTableName] || [];
    const issueFields = new Set();
    let dirtyRows = 0;
    const addIssue = (fieldName, issueType, issueCategory, issueCount) =>
      addQualityIssue(fieldIssues, issueFields, issueCategoryStats, issueTypeStats, table.logicalTableName, fieldName, issueType, ISSUE_CATEGORY_MAP[issueCategory] || issueCategory, issueCount);
    for (const field of tableFields) {
      if (!field.nullable) {
        const nullCount = await countNullRowsInStorage(scene, table.physicalTableName, field.fieldName);
        dirtyRows += addIssue(field.fieldName, "NOT_NULL", "COMPLETENESS", nullCount);
        if (isTextFieldLike(field)) {
          const blankCount = previewRows.filter((row) => row[field.fieldName] !== null && row[field.fieldName] !== undefined && String(row[field.fieldName]).trim() === "").length;
          dirtyRows += addIssue(field.fieldName, "EMPTY_REQUIRED_TEXT", "COMPLETENESS", blankCount);
        }
      }
      if (field.uniqueKey) {
        const dupCount = await countDuplicateRowsInStorage(scene, table.physicalTableName, field.fieldName);
        dirtyRows += addIssue(field.fieldName, "UNIQUE", "UNIQUENESS", dupCount);
        if (isTextFieldLike(field)) {
          dirtyRows += addIssue(field.fieldName, "SEMANTIC_DUPLICATE", "UNIQUENESS", countNormalizedDuplicates(previewRows, field.fieldName));
        }
      }
      if (field.foreignKey && field.foreignRefTable) {
        const refTable = tables.find((item) => item.logicalTableName === field.foreignRefTable);
        if (refTable) {
          const refField = field.foreignRefField || "id";
          const fkCount = await countForeignKeyViolationsInStorage(
            scene,
            table.physicalTableName,
            field.fieldName,
            refTable.physicalTableName,
            refField
          );
          dirtyRows += addIssue(field.fieldName, "FOREIGN_KEY", "CONSISTENCY", fkCount);
        }
      }
      if ((field.businessSemantic || "").includes("DICT")) {
        const allowedValues = new Set(resolveAllowedValuesForField(field, dicts, scenarioProfile));
        if (allowedValues.size > 0) {
          const invalidCount = previewRows.filter((row) => row[field.fieldName] !== null && row[field.fieldName] !== undefined && !allowedValues.has(String(row[field.fieldName]))).length;
          dirtyRows += addIssue(field.fieldName, "DICT_RANGE", "COMPLIANCE", invalidCount);
        }
      }
      if ((field.businessSemantic || "").includes("DATETIME") || field.fieldType.includes("DATE")) {
        const invalidTimeCount = previewRows.filter((row) => {
          const value = row[field.fieldName];
          if (!value) return false;
          const time = new Date(String(value)).getTime();
          if (Number.isNaN(time)) return true;
          return time < new Date("2000-01-01").getTime();
        }).length;
        dirtyRows += addIssue(field.fieldName, "TIME_VALIDITY", "TIMELINESS", invalidTimeCount);
      }
      if (String(field.fieldName).includes("mobile")) {
        const invalidCount = previewRows.filter((row) => row[field.fieldName] && !/^1[3-9]\d{9}$/.test(String(row[field.fieldName]).trim())).length;
        dirtyRows += addIssue(field.fieldName, "PHONE_FORMAT", "ACCURACY", invalidCount);
      }
      if (String(field.fieldName).includes("email")) {
        const invalidCount = previewRows.filter((row) => row[field.fieldName] && !/^[A-Za-z0-9][A-Za-z0-9._-]{1,30}@(qq\.com|163\.com|126\.com|foxmail\.com|yeah\.net|aliyun\.com|sina\.com|outlook\.com)$/.test(String(row[field.fieldName]).trim())).length;
        dirtyRows += addIssue(field.fieldName, "EMAIL_FORMAT", "ACCURACY", invalidCount);
      }
      if (field.fieldName === "id_card_no") {
        const invalidCount = previewRows.filter((row) => row.id_card_no && !/^\d{17}[\dXx]$/.test(String(row.id_card_no).trim())).length;
        dirtyRows += addIssue(field.fieldName, "ID_CARD_FORMAT", "COMPLIANCE", invalidCount);
      }
      if (field.fieldName === "plate_no") {
        const invalidCount = previewRows.filter((row) => row.plate_no && !/^[\u4e00-\u9fa5][A-Z][A-Z0-9]{5,6}$/.test(String(row.plate_no).trim())).length;
        dirtyRows += addIssue(field.fieldName, "LICENSE_PLATE_FORMAT", "COMPLIANCE", invalidCount);
      }
      if (field.fieldName === "postal_code") {
        const invalidCount = previewRows.filter((row) => row.postal_code && !/^\d{6}$/.test(String(row.postal_code).trim())).length;
        dirtyRows += addIssue(field.fieldName, "POSTAL_CODE_FORMAT", "ACCURACY", invalidCount);
      }
      if (field.fieldName === "barcode") {
        const invalidCount = previewRows.filter((row) => row.barcode && !/^\d{10,14}$/.test(String(row.barcode).trim())).length;
        dirtyRows += addIssue(field.fieldName, "BARCODE_FORMAT", "COMPLIANCE", invalidCount);
      }
      if (field.fieldName === "org_code") {
        const invalidCount = previewRows.filter((row) => row.org_code && String(row.org_code).trim().length < 8).length;
        dirtyRows += addIssue(field.fieldName, "ORG_CODE_FORMAT", "COMPLIANCE", invalidCount);
      }
      if (field.fieldName.includes("mask")) {
        const invalidCount = previewRows.filter((row) => row[field.fieldName] && !String(row[field.fieldName]).includes("*")).length;
        dirtyRows += addIssue(field.fieldName, "MASKING_COMPLIANCE", "COMPLIANCE", invalidCount);
      }
      if (isNumericFieldLike(field) && isNumericSensitiveField(field)) {
        const invalidCount = previewRows.filter((row) => {
          const value = Number(row[field.fieldName]);
          if (Number.isNaN(value)) return false;
          if (hasFieldNameToken(field.fieldName, "ratio")) return value < 0 || value > 100;
          if (hasFieldNameToken(field.fieldName, "qty") || hasFieldNameToken(field.fieldName, "count")) return value < 0;
          return value < 0;
        }).length;
        dirtyRows += addIssue(field.fieldName, "NUMERIC_RANGE", "ACCURACY", invalidCount);
      }
    }
    dirtyRows += collectSemanticComplianceRuleIssues(
      complianceRules,
      tableFields,
      previewRows,
      (fieldName, issueType, issueCategory, issueCount) => addIssue(fieldName, issueType, issueCategory, issueCount),
      { fieldSemanticMap, modelSemanticMap }
    );
    dirtyRows += collectScenarioSpecificQualityIssues(
      table.logicalTableName,
      previewRows,
      (fieldName, issueType, issueCategory, issueCount) => addIssue(fieldName, issueType, issueCategory, issueCount)
    );
    dirtyRows += extendedRuleEngine.collectExtendedRuleIssues({
      tableName: table.logicalTableName,
      rows: previewRows,
      addIssue: (fieldName, issueType, issueCategory, issueCount) => addIssue(fieldName, issueType, issueCategory, issueCount),
      profile: scenarioProfile,
      tableRowsMap: previewRowsByTable,
    });
    tableStats.push({
      tableName: table.logicalTableName,
      rowCount: Number(totalRowsByTable[table.logicalTableName] || 0),
      dirtyRows: Math.min(Number(totalRowsByTable[table.logicalTableName] || 0), dirtyRows),
      issueFields: [...issueFields]
    });
  }
  const kafkaStats = await getTopicMetrics(sceneId);
  const fieldCountByTable = new Map(
    tables.map((table) => [
      table.logicalTableName,
      fields.filter((field) => field.tableId === table.id).length
    ])
  );
  const rowCountByTable = new Map(tableStats.map((item) => [item.tableName, Number(item.rowCount || 0)]));
  const issueCellCountByField = new Map();
  for (const issue of fieldIssues) {
    const key = `${issue.tableName}.${issue.fieldName || "__table__"}`;
    const rowCount = Number(rowCountByTable.get(issue.tableName) || 0);
    const current = Number(issueCellCountByField.get(key) || 0);
    issueCellCountByField.set(key, Math.min(rowCount, current + Number(issue.issueCount || 0)));
  }
  const finalTableStats = tableStats.map((item) => {
    const fieldCount = Number(fieldCountByTable.get(item.tableName) || 0);
    const totalFieldCells = Number(item.rowCount || 0) * fieldCount;
    const dirtyCellCount = [...issueCellCountByField.entries()]
      .filter(([key]) => key.startsWith(`${item.tableName}.`))
      .reduce((sum, [, count]) => sum + Number(count || 0), 0);
    return {
      ...item,
      fieldCount,
      totalFieldCells,
      dirtyCellCount,
      dirtyCellRate: totalFieldCells > 0 ? Number((dirtyCellCount / totalFieldCells).toFixed(4)) : 0
    };
  });
  const totalDirtyRows = finalTableStats.reduce((sum, item) => sum + Number(item.dirtyRows || 0), 0);
  const totalFieldCells = finalTableStats.reduce((sum, item) => sum + Number(item.totalFieldCells || 0), 0);
  const totalIssueCells = finalTableStats.reduce((sum, item) => sum + Number(item.dirtyCellCount || 0), 0);
  const payload = generator.buildQualityReportPayload(scene, finalTableStats, kafkaStats);
  payload.tableStats = finalTableStats;
  payload.fieldIssues = fieldIssues;
  payload.summary.issueCategoryStats = issueCategoryStats;
  payload.summary.issueTypeStats = issueTypeStats;
  payload.summary.totalIssues = totalIssueCells;
  payload.summary.totalFieldCells = totalFieldCells;
  payload.summary.totalIssueCells = totalIssueCells;
  payload.summary.dirtyRateBasis = "FIELD_CELL";
  payload.summary.rowIssueRate = payload.summary.totalRows > 0 ? Number((totalDirtyRows / payload.summary.totalRows).toFixed(4)) : 0;
  payload.summary.dirtyRate = totalFieldCells > 0 ? Number((totalIssueCells / totalFieldCells).toFixed(4)) : 0;
  const gateEvaluation = evaluateScenarioQualityGates({
    tables,
    fields,
    dicts,
    relations,
    tableStats: finalTableStats,
    scenarioProfile,
  });
  payload.summary.qualityGates = gateEvaluation.results;
  payload.summary.failedGateCount = gateEvaluation.failedCount;
  payload.summary.gatePenalty = gateEvaluation.penalty;
  payload.score = Math.max(5, Number((100 - Math.min(85, payload.summary.dirtyRate * 100) - gateEvaluation.penalty).toFixed(2)));
  payload.dirtyDistribution = finalTableStats.map((item) => ({
    tableName: item.tableName,
    dirtyRows: Number(item.dirtyRows || 0),
    dirtyCells: Number(item.dirtyCellCount || 0)
  }));
  payload.kafkaStats = kafkaStats.map((item) => ({
    ...item,
    schemaValid: true,
    envelopeValid: item.messageCount >= 0
  }));
  const [rows] = await pool.query("SELECT id FROM lab_scene_quality_report WHERE scene_id = ? AND report_code = ? LIMIT 1", [sceneId, payload.reportCode]);
  if (rows.length > 0) {
    await pool.query(
      `UPDATE lab_scene_quality_report
       SET score = ?, summary_json = ?, table_stats_json = ?, field_issues_json = ?, dirty_distribution_json = ?, kafka_stats_json = ?
       WHERE id = ?`,
      [payload.score, JSON.stringify(payload.summary || {}), JSON.stringify(payload.tableStats || []), JSON.stringify(payload.fieldIssues || []), JSON.stringify(payload.dirtyDistribution || []), JSON.stringify(payload.kafkaStats || {}), rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO lab_scene_quality_report
        (scene_id, report_code, score, summary_json, table_stats_json, field_issues_json, dirty_distribution_json, kafka_stats_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sceneId, payload.reportCode, payload.score, JSON.stringify(payload.summary || {}), JSON.stringify(payload.tableStats || []), JSON.stringify(payload.fieldIssues || []), JSON.stringify(payload.dirtyDistribution || []), JSON.stringify(payload.kafkaStats || {})]
    );
  }
  return getQualityReport(sceneId);
}

async function getQualityReport(sceneId) {
  const [rows] = await pool.query(
    `SELECT id, scene_id AS sceneId, report_code AS reportCode, score, summary_json AS summary,
            table_stats_json AS tableStats, field_issues_json AS fieldIssues, dirty_distribution_json AS dirtyDistribution,
            kafka_stats_json AS kafkaStats, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scene_quality_report WHERE scene_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [sceneId]
  );
  const row = queryFirst(rows);
  return row
    ? {
        id: Number(row.id),
        sceneId: Number(row.sceneId),
        reportCode: row.reportCode,
        score: Number(row.score || 0),
        summary: safeJsonParse(row.summary, {}),
        tableStats: safeJsonParse(row.tableStats, []),
        fieldIssues: safeJsonParse(row.fieldIssues, []),
        dirtyDistribution: safeJsonParse(row.dirtyDistribution, []),
        kafkaStats: safeJsonParse(row.kafkaStats, {}),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }
    : null;
}

async function getAggregatedRunTrend(granularity) {
  const format = granularity === "hour" ? "%m-%d %H:00" : "%m-%d";
  const limit = granularity === "hour" ? 24 : 14;
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(COALESCE(end_time, start_time, created_at), '${format}') AS label,
            SUM(records_count) AS value,
            MAX(COALESCE(end_time, start_time, created_at)) AS sortTime
     FROM lab_scene_run_log
     WHERE COALESCE(end_time, start_time, created_at) IS NOT NULL
     GROUP BY DATE_FORMAT(COALESCE(end_time, start_time, created_at), '${format}')
     ORDER BY sortTime DESC
     LIMIT ?`,
    [limit]
  );

  return rows
    .map((row) => ({
      label: row.label,
      value: Number(row.value || 0),
      sortTime: row.sortTime,
    }))
    .reverse();
}

async function getOpsDashboard() {
  const scenes = await listScenes();
  const topicSnapshots = await Promise.all(
    scenes.map(async (scene) => ({
      sceneId: scene.id,
      sceneName: scene.sceneName,
      metrics: await getTopicMetrics(scene.id)
    }))
  );
  const topicSummaryByScene = new Map(
    topicSnapshots.map((item) => [
      item.sceneId,
      {
        topicCount: item.metrics.length,
        messageCount: item.metrics.reduce((sum, metric) => sum + Number(metric.messageCount || 0), 0),
        metrics: item.metrics
      }
    ])
  );
  const dailyDataVolume = await getAggregatedRunTrend("day");
  const hourlyDataVolume = await getAggregatedRunTrend("hour");
  return {
    overview: {
      totalScenes: scenes.length,
      runningScenes: scenes.filter((item) => item.status === "RUNNING").length,
      pausedScenes: scenes.filter((item) => item.status === "PAUSED").length,
      errorScenes: scenes.filter((item) => item.status === "ERROR").length,
      totalDataScale: scenes.reduce((sum, item) => sum + Number(item.totalDataCount || 0), 0),
      totalIncrementScale: scenes.reduce((sum, item) => sum + Number(item.incrVolume || 0), 0),
      totalKafkaMessages: topicSnapshots.reduce((sum, item) => sum + item.metrics.reduce((acc, metric) => acc + Number(metric.messageCount || 0), 0), 0),
      todayNewRows: scenes.reduce((sum, item) => sum + Number(item.incrVolume || 0), 0)
    },
    rankings: {
      sceneScaleRanking: [...scenes]
        .sort((a, b) => Number(b.tableCount || 0) - Number(a.tableCount || 0) || Number(b.totalDataCount || 0) - Number(a.totalDataCount || 0))
        .slice(0, 10)
        .map((scene) => ({
          sceneId: scene.id,
          sceneName: scene.sceneName,
          tableCount: Number(scene.tableCount || 0),
          totalDataCount: Number(scene.totalDataCount || 0),
          status: scene.status
        })),
      topicMessageRanking: topicSnapshots
        .map((item) => ({
          sceneId: item.sceneId,
          sceneName: item.sceneName,
          topicCount: item.metrics.length,
          messageCount: item.metrics.reduce((sum, metric) => sum + Number(metric.messageCount || 0), 0)
        }))
        .sort((a, b) => b.messageCount - a.messageCount)
        .slice(0, 10),
      dataVolumeRanking: [...scenes]
        .sort((a, b) => Number(b.totalDataCount || 0) - Number(a.totalDataCount || 0))
        .slice(0, 10)
        .map((scene) => ({
          sceneId: scene.id,
          sceneName: scene.sceneName,
          totalDataCount: Number(scene.totalDataCount || 0),
          tableCount: Number(scene.tableCount || 0),
          status: scene.status
        }))
    },
    trends: {
      dailyDataVolume,
      hourlyDataVolume
    },
    sceneSnapshots: scenes
      .map((scene) => {
        const topicSummary = topicSummaryByScene.get(scene.id) || { topicCount: 0, messageCount: 0, metrics: [] };
        return {
          sceneId: scene.id,
          sceneName: scene.sceneName,
          status: scene.status,
          tableCount: Number(scene.tableCount || 0),
          totalDataCount: Number(scene.totalDataCount || 0),
          topicCount: Number(topicSummary.topicCount || 0),
          messageCount: Number(topicSummary.messageCount || 0),
          lastRunTime: scene.lastRunTime || null
        };
      })
      .sort((a, b) => b.totalDataCount - a.totalDataCount)
  };
}

async function listLabModels() {
  await modelProfileManager.ensureDefaultCommitteeProfiles({ strict: false, syncIncubations: false });
  const [profilesRows] = await pool.query(
    `SELECT p.id, p.profile_name AS profileName, p.stage_type AS stageType, p.provider_id AS providerId,
            provider.config_name AS providerName, p.model_name AS modelName, p.model_version AS modelVersion, p.model_code AS modelCode,
            p.endpoint_url AS endpointUrl, p.auth_mode AS authMode, p.temperature,
            p.max_context_length AS maxContextLength, p.system_prompt AS systemPrompt,
            p.is_default AS isDefault, p.status, p.created_at AS createdAt, p.updated_at AS updatedAt
     FROM lab_model_profile p
     LEFT JOIN model_providers provider ON provider.id = p.provider_id
     ORDER BY p.stage_type ASC, p.updated_at DESC`
  );
  const providersRows = await modelProviderService.listModelProviders();
  return {
    profiles: profilesRows.map((row) => ({
      id: Number(row.id),
      profileName: row.profileName,
      stageType: row.stageType,
      providerId: row.providerId ? Number(row.providerId) : null,
      providerName: row.providerName || null,
      modelName: row.modelName,
      modelVersion: row.modelVersion || null,
      modelCode: row.modelCode,
      endpointUrl: row.endpointUrl,
      authMode: row.authMode,
      temperature: Number(row.temperature || 0),
      maxContextLength: Number(row.maxContextLength || 0),
      systemPrompt: row.systemPrompt,
      isDefault: Boolean(row.isDefault),
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })),
    providers: providersRows.map((row) => ({
      id: Number(row.id),
      configName: row.configName,
      configCode: row.configCode,
      providerType: row.providerType,
      modelCategory: row.modelCategory,
      modelName: row.modelName,
      modelVersion: row.modelVersion,
      modelCatalog: row.modelCatalog || [],
    }))
  };
}

async function saveLabModel(payload) {
  let normalizedProvider = null;
  if (payload.providerId) {
    normalizedProvider = await modelProviderService.getModelProviderById(payload.providerId);
  }
  const modelName = String(payload.modelName || normalizedProvider?.modelName || "").trim() || normalizedProvider?.modelName || "";
  const modelVersion = String(payload.modelVersion || normalizedProvider?.modelVersion || modelName).trim()
    || normalizedProvider?.modelVersion
    || modelName;

  if (payload.isDefault) {
    await pool.query("UPDATE lab_model_profile SET is_default = 0 WHERE stage_type = ?", [payload.stageType]);
  }
  if (payload.id) {
    await pool.query(
      `UPDATE lab_model_profile
       SET profile_name = ?, stage_type = ?, provider_id = ?, model_name = ?, model_version = ?, model_code = ?, endpoint_url = ?,
           auth_mode = ?, temperature = ?, max_context_length = ?, system_prompt = ?, is_default = ?, status = ?
       WHERE id = ?`,
      [payload.profileName, payload.stageType, payload.providerId || null, modelName, modelVersion, payload.modelCode, payload.endpointUrl || null, payload.authMode || "bearer", payload.temperature || 0.2, payload.maxContextLength || 8192, payload.systemPrompt || null, boolFlag(payload.isDefault), payload.status || "active", payload.id]
    );
  } else {
    await pool.query(
      `INSERT INTO lab_model_profile
        (profile_name, stage_type, provider_id, model_name, model_version, model_code, endpoint_url, auth_mode, temperature, max_context_length, system_prompt, is_default, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.profileName, payload.stageType, payload.providerId || null, modelName, modelVersion, payload.modelCode, payload.endpointUrl || null, payload.authMode || "bearer", payload.temperature || 0.2, payload.maxContextLength || 8192, payload.systemPrompt || null, boolFlag(payload.isDefault), payload.status || "active"]
    );
  }
  if (ROLE_STAGE_TYPES.includes(payload.stageType)) {
    await modelProfileManager.syncIndustryIncubationCommittees();
  }
  return listLabModels();
}

async function deleteLabModel(id) {
  const [rows] = await pool.query("SELECT stage_type AS stageType FROM lab_model_profile WHERE id = ? LIMIT 1", [id]);
  const profile = queryFirst(rows);
  const [result] = await pool.query("DELETE FROM lab_model_profile WHERE id = ?", [id]);
  if (result.affectedRows === 0) {
    throw new AppError("模型配置不存在", 404);
  }
  if (ROLE_STAGE_TYPES.includes(String(profile?.stageType || ""))) {
    await modelProfileManager.ensureDefaultCommitteeProfiles({ strict: false, syncIncubations: true });
  }
  return { id };
}

async function setDefaultLabModel(id) {
  const [rows] = await pool.query("SELECT id, stage_type AS stageType FROM lab_model_profile WHERE id = ? LIMIT 1", [id]);
  const row = queryFirst(rows);
  if (!row) {
    throw new AppError("模型配置不存在", 404);
  }
  await pool.query("UPDATE lab_model_profile SET is_default = 0 WHERE stage_type = ?", [row.stageType]);
  await pool.query("UPDATE lab_model_profile SET is_default = 1 WHERE id = ?", [id]);
  if (ROLE_STAGE_TYPES.includes(String(row.stageType || ""))) {
    await modelProfileManager.syncIndustryIncubationCommittees();
  }
  return listLabModels();
}

async function debugLabModel(payload) {
  const [profiles] = await pool.query(
    `SELECT p.id, p.provider_id AS providerId, p.model_name AS modelName, p.model_version AS modelVersion, p.stage_type AS stageType
     FROM lab_model_profile p
     WHERE p.id = ?
     LIMIT 1`,
    [payload.profileId]
  );
  const profile = queryFirst(profiles);
  if (!profile) {
    throw new AppError("模型配置不存在", 404);
  }
  if (!profile.providerId) {
    throw new AppError("当前模型配置未绑定 Provider", 400);
  }
  const provider = await modelProviderService.getModelProviderById(Number(profile.providerId));
  const runtimeProvider = modelProviderService.applyModelSelection(provider, {
    modelName: profile.modelName,
    modelVersion: profile.modelVersion,
  });
  const result = await modelProviderService.generateChatCompletion(
    runtimeProvider,
    [
      { role: "system", content: payload.systemPrompt || "你是数据实验室调试助手，请尽量输出结构化 JSON。" },
      { role: "user", content: payload.prompt }
    ],
    { temperature: payload.temperature ?? 0.2, maxTokens: payload.maxTokens ?? 1500 }
  );
  return {
    rawText: result.content,
    parsedJson: tryParseJson(result.content),
    validJson: Boolean(tryParseJson(result.content))
  };
}

async function listSchedulableScenes() {
  return (await listScenes()).filter((scene) => scene.taskEnabled);
}

async function executeScheduledIncrement(sceneId) {
  try {
    await executeSceneRun(sceneId, "INCR");
  } catch (error) {
    console.error(`[data-lab] scheduled increment failed for scene ${sceneId}:`, error);
  }
}

function diffObjects(previous, current, prefix = "") {
  const changes = [];
  const prevKeys = previous && typeof previous === "object" ? Object.keys(previous) : [];
  const currKeys = current && typeof current === "object" ? Object.keys(current) : [];
  const allKeys = [...new Set([...prevKeys, ...currKeys])];
  allKeys.forEach((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const prevValue = previous?.[key];
    const currValue = current?.[key];
    if (JSON.stringify(prevValue) === JSON.stringify(currValue)) {
      return;
    }
    if (prevValue && currValue && typeof prevValue === "object" && typeof currValue === "object" && !Array.isArray(prevValue) && !Array.isArray(currValue)) {
      changes.push(...diffObjects(prevValue, currValue, path));
      return;
    }
    changes.push({ path, previous: prevValue, current: currValue });
  });
  return changes;
}

async function getSchemaVersionDiff(sceneId, fromVersionId, toVersionId) {
  const fromVersion = await getCurrentSchemaVersion(sceneId, fromVersionId);
  const toVersion = await getCurrentSchemaVersion(sceneId, toVersionId);
  if (!fromVersion || !toVersion) {
    throw new AppError("结构版本不存在", 404);
  }
  return {
    fromVersion: fromVersion.versionNo,
    toVersion: toVersion.versionNo,
    changes: diffObjects(fromVersion.content, toVersion.content)
  };
}

async function getStrategyVersionDiff(sceneId, fromVersionId, toVersionId) {
  const fromVersion = await getCurrentStrategyVersion(sceneId, fromVersionId);
  const toVersion = await getCurrentStrategyVersion(sceneId, toVersionId);
  if (!fromVersion || !toVersion) {
    throw new AppError("策略版本不存在", 404);
  }
  return {
    fromVersion: fromVersion.versionNo,
    toVersion: toVersion.versionNo,
    changes: diffObjects(fromVersion.content, toVersion.content)
  };
}

async function rollbackSchemaVersion(sceneId, versionId) {
  const scene = await getSceneBase(sceneId);
  const version = await getCurrentSchemaVersion(sceneId, versionId);
  if (!version) {
    throw new AppError("结构版本不存在", 404);
  }
  const ddlStatements = generator.buildDDLStatements(scene.sceneCode, version.content);
  await replaceSceneMetadata(scene.id, version.id, scene.sceneCode, version.content, ddlStatements);
  await pool.query(
    "UPDATE lab_scene SET current_schema_version = ?, status = 'SCHEMA_CONFIRMED', stage_status = 'SCHEMA_CONFIRMED' WHERE id = ?",
    [version.versionNo, scene.id]
  );
  await logOperation("ROLLBACK_SCHEMA", "system", scene.id, { versionId }, `回滚到结构版本 ${version.versionNo}`);
  return getSceneDetail(scene.id);
}

async function rollbackStrategyVersion(sceneId, versionId) {
  const scene = await getSceneBase(sceneId);
  const version = await getCurrentStrategyVersion(sceneId, versionId);
  if (!version) {
    throw new AppError("策略版本不存在", 404);
  }
  await pool.query(
    "UPDATE lab_scene SET current_strategy_version = ?, status = 'READY', stage_status = 'READY' WHERE id = ?",
    [version.versionNo, scene.id]
  );
  await logOperation("ROLLBACK_STRATEGY", "system", scene.id, { versionId }, `回滚到策略版本 ${version.versionNo}`);
  return getSceneDetail(scene.id);
}

async function rerunFailedTasks(sceneId) {
  const [rows] = await pool.query(
    `SELECT id FROM lab_scene_run_log
     WHERE scene_id = ? AND run_status = 'FAILED'
     ORDER BY id DESC LIMIT 1`,
    [sceneId]
  );
  const failed = queryFirst(rows);
  if (!failed) {
    throw new AppError("没有失败任务可重跑", 400);
  }
  return executeSceneRun(sceneId, "INCR");
}

async function backfillScene(sceneId, payload) {
  const scene = await getSceneBase(sceneId);
  const schema = await getCurrentSchemaVersion(sceneId);
  const strategy = await getCurrentStrategyVersion(sceneId);
  if (!schema || !strategy) {
    throw new AppError("请先完成结构与策略确认", 400);
  }
  await ensureSceneStorageTables(scene, schema.content);
  const customStrategy = JSON.parse(JSON.stringify(strategy.content));
  const targetRows = Number(payload.rows || scene.incrVolume || 100);
  customStrategy.globalConfig.incrementVolume = targetRows;
  customStrategy.tables = (customStrategy.tables || []).map((table) => ({
    ...table,
    incrRows: Math.max(1, Math.round(targetRows / Math.max(1, customStrategy.tables.length)))
  }));
  const baseOffsets = await getSceneTableBaseOffsets(scene, schema.content, "INCR");
  const generated = generator.generateRowsForScene(scene, schema.content, customStrategy, "INCR", { baseOffsets });
  let totalRows = 0;
  for (const item of generated.rowsByTable) {
    await insertRowsToBusinessTable(scene, item.physicalTableName, item.rows);
    totalRows += item.rows.length;
  }
  await logOperation("BACKFILL", "system", scene.id, payload, `补数 ${totalRows} 行`);
  return { sceneId, totalRows, fromTime: payload.fromTime || null, toTime: payload.toTime || null };
}

async function listPromptTemplates() {
  const [rows] = await pool.query(
    `SELECT p.id, p.prompt_type AS promptType, p.template_name AS templateName, p.template_code AS templateCode,
            p.content, p.user_content AS userContent, p.temperature, p.max_tokens AS maxTokens, p.default_model_provider_id AS defaultModelProviderId,
            p.default_model_name AS defaultModelName, p.default_model_version AS defaultModelVersion,
            provider.config_name AS defaultModelProviderName,
            p.is_default AS isDefault, p.status, p.created_at AS createdAt, p.updated_at AS updatedAt,
            (SELECT MAX(version_no) FROM lab_prompt_template_version v WHERE v.prompt_type = p.prompt_type) AS latestVersionNo,
            (SELECT version_status FROM lab_prompt_template_version v WHERE v.prompt_type = p.prompt_type ORDER BY version_no DESC LIMIT 1) AS latestVersionStatus
     FROM lab_prompt_template p
     LEFT JOIN model_providers provider ON provider.id = p.default_model_provider_id
     ORDER BY p.prompt_type ASC, p.updated_at DESC`
  );
  return rows.map((row) => ({
    id: Number(row.id),
    promptType: row.promptType,
    templateName: row.templateName,
    templateCode: row.templateCode,
    content: row.content,
    userContent: row.userContent || "",
    temperature: row.temperature === null || row.temperature === undefined ? null : Number(row.temperature),
    maxTokens: row.maxTokens === null || row.maxTokens === undefined ? null : Number(row.maxTokens),
    defaultModelProviderId: row.defaultModelProviderId ? Number(row.defaultModelProviderId) : null,
    defaultModelProviderName: row.defaultModelProviderName || null,
    defaultModelName: row.defaultModelName || null,
    defaultModelVersion: row.defaultModelVersion || null,
    isDefault: Boolean(row.isDefault),
    status: row.status,
    latestVersionNo: row.latestVersionNo ? Number(row.latestVersionNo) : null,
    latestVersionStatus: row.latestVersionStatus || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function getNextPromptTemplateVersionNo(promptType) {
  const [rows] = await pool.query(
    "SELECT COALESCE(MAX(version_no), 0) + 1 AS nextVersion FROM lab_prompt_template_version WHERE prompt_type = ?",
    [promptType]
  );
  return Number(rows[0]?.nextVersion || 1);
}

async function recordPromptTemplateVersion(payload, options = {}) {
  const versionNo = await getNextPromptTemplateVersionNo(payload.promptType);
  await pool.query(
    `INSERT INTO lab_prompt_template_version
      (prompt_type, template_id, version_no, version_status, template_name, template_code, content, user_content, temperature, max_tokens, default_model_provider_id, default_model_name, default_model_version, created_by, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.promptType,
      payload.id || null,
      versionNo,
      options.versionStatus || "draft",
      payload.templateName,
      payload.templateCode,
      payload.content,
      payload.userContent || "",
      payload.temperature ?? null,
      payload.maxTokens ?? null,
      payload.defaultModelProviderId || null,
      payload.defaultModelName || null,
      payload.defaultModelVersion || null,
      options.createdBy || "system",
      options.versionStatus === "published" ? new Date() : null,
    ]
  );
  return versionNo;
}

async function listPromptTemplateVersions(promptType) {
  const [rows] = await pool.query(
    `SELECT v.id, v.prompt_type AS promptType, v.template_id AS templateId, v.version_no AS versionNo, v.version_status AS versionStatus,
            v.template_name AS templateName, v.template_code AS templateCode, v.content, v.user_content AS userContent,
            v.temperature, v.max_tokens AS maxTokens,
            v.default_model_provider_id AS defaultModelProviderId,
            v.default_model_name AS defaultModelName, v.default_model_version AS defaultModelVersion,
            provider.config_name AS defaultModelProviderName,
            v.created_by AS createdBy, v.published_at AS publishedAt, v.created_at AS createdAt
     FROM lab_prompt_template_version v
     LEFT JOIN model_providers provider ON provider.id = v.default_model_provider_id
     WHERE v.prompt_type = ?
     ORDER BY v.version_no DESC, v.id DESC`,
    [promptType]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    promptType: row.promptType,
    templateId: row.templateId ? Number(row.templateId) : null,
    versionNo: Number(row.versionNo || 0),
    versionStatus: row.versionStatus,
    templateName: row.templateName,
    templateCode: row.templateCode,
    content: row.content,
    userContent: row.userContent || "",
    temperature: row.temperature === null || row.temperature === undefined ? null : Number(row.temperature),
    maxTokens: row.maxTokens === null || row.maxTokens === undefined ? null : Number(row.maxTokens),
    defaultModelProviderId: row.defaultModelProviderId ? Number(row.defaultModelProviderId) : null,
    defaultModelProviderName: row.defaultModelProviderName || null,
    defaultModelName: row.defaultModelName || null,
    defaultModelVersion: row.defaultModelVersion || null,
    createdBy: row.createdBy,
    publishedAt: row.publishedAt || null,
    createdAt: row.createdAt,
  }));
}

async function validatePromptTemplateProvider(defaultModelProviderId) {
  if (!defaultModelProviderId) {
    return null;
  }
  const provider = await modelProviderService.getModelProviderById(Number(defaultModelProviderId));
  if (provider.modelCategory !== "chat" || provider.status !== "active") {
    throw new AppError("提示词默认模型必须选择启用中的对话模型", 400);
  }
  return provider;
}

function getDefaultPromptTemplateDefinition(promptType) {
  return promptDefaults.listDefaultPromptTemplates().find((item) => item.promptType === promptType) || null;
}

async function getExistingPromptTemplateForEdit(payload) {
  if (payload.id) {
    const [rows] = await pool.query(
      `SELECT id, prompt_type AS promptType, template_name AS templateName, template_code AS templateCode,
              content, user_content AS userContent, temperature, max_tokens AS maxTokens, default_model_provider_id AS defaultModelProviderId,
              default_model_name AS defaultModelName, default_model_version AS defaultModelVersion,
              is_default AS isDefault, status
       FROM lab_prompt_template
       WHERE id = ?
       LIMIT 1`,
      [payload.id]
    );
    return queryFirst(rows) || null;
  }
  const [rows] = await pool.query(
    `SELECT id, prompt_type AS promptType, template_name AS templateName, template_code AS templateCode,
            content, user_content AS userContent, temperature, max_tokens AS maxTokens, default_model_provider_id AS defaultModelProviderId,
            default_model_name AS defaultModelName, default_model_version AS defaultModelVersion,
            is_default AS isDefault, status
     FROM lab_prompt_template
     WHERE prompt_type = ?
     ORDER BY is_default DESC, updated_at DESC
     LIMIT 1`,
    [payload.promptType]
  );
  return queryFirst(rows) || null;
}

async function normalizePromptTemplatePayload(payload) {
  const existing = await getExistingPromptTemplateForEdit(payload);
  const defaults = getDefaultPromptTemplateDefinition(payload.promptType);
  return {
    ...payload,
    id: payload.id || existing?.id || null,
    templateName: payload.templateName || existing?.templateName || defaults?.templateName || payload.promptType,
    templateCode: payload.templateCode || existing?.templateCode || defaults?.templateCode || payload.promptType.toLowerCase(),
    content: payload.content ?? existing?.content ?? defaults?.content ?? "",
    userContent: payload.userContent ?? existing?.userContent ?? defaults?.userContent ?? "{{input}}",
    temperature: payload.temperature !== undefined
      ? promptRuntime.normalizePromptParameterNumber(payload.temperature, defaults?.temperature ?? 0.2, { min: 0, max: 2 })
      : promptRuntime.normalizePromptParameterNumber(existing?.temperature, defaults?.temperature ?? 0.2, { min: 0, max: 2 }),
    maxTokens: payload.maxTokens !== undefined
      ? promptRuntime.normalizePromptParameterNumber(payload.maxTokens, defaults?.maxTokens ?? 1200, { min: 1, max: 8000, integer: true })
      : promptRuntime.normalizePromptParameterNumber(existing?.maxTokens, defaults?.maxTokens ?? 1200, { min: 1, max: 8000, integer: true }),
    defaultModelProviderId: payload.defaultModelProviderId !== undefined
      ? payload.defaultModelProviderId
      : (existing?.defaultModelProviderId ? Number(existing.defaultModelProviderId) : null),
    defaultModelName: payload.defaultModelName !== undefined
      ? payload.defaultModelName
      : (existing?.defaultModelName || null),
    defaultModelVersion: payload.defaultModelVersion !== undefined
      ? payload.defaultModelVersion
      : (existing?.defaultModelVersion || null),
    isDefault: payload.isDefault !== undefined ? payload.isDefault : Boolean(existing?.isDefault),
    status: payload.status || existing?.status || "active",
  };
}

async function savePromptTemplateDraft(payload, user) {
  const normalized = await normalizePromptTemplatePayload(payload);
  const provider = await validatePromptTemplateProvider(normalized.defaultModelProviderId);
  if (provider && !normalized.defaultModelName) {
    normalized.defaultModelName = provider.modelName;
  }
  if (provider && !normalized.defaultModelVersion) {
    normalized.defaultModelVersion = provider.modelVersion || provider.modelName;
  }
  await recordPromptTemplateVersion(normalized, {
    versionStatus: "draft",
    createdBy: user?.displayName || user?.username || "system",
  });
  return {
    versions: await listPromptTemplateVersions(normalized.promptType),
  };
}

async function publishPromptTemplate(payload, user) {
  const normalized = await normalizePromptTemplatePayload(payload);
  const provider = await validatePromptTemplateProvider(normalized.defaultModelProviderId);
  if (provider && !normalized.defaultModelName) {
    normalized.defaultModelName = provider.modelName;
  }
  if (provider && !normalized.defaultModelVersion) {
    normalized.defaultModelVersion = provider.modelVersion || provider.modelName;
  }
  if (normalized.isDefault) {
    await pool.query("UPDATE lab_prompt_template SET is_default = 0 WHERE prompt_type = ?", [normalized.promptType]);
  }
  if (normalized.id) {
    await pool.query(
      `UPDATE lab_prompt_template
       SET prompt_type = ?, template_name = ?, template_code = ?, content = ?, user_content = ?, temperature = ?, max_tokens = ?, default_model_provider_id = ?, default_model_name = ?, default_model_version = ?, is_default = ?, status = ?
       WHERE id = ?`,
      [normalized.promptType, normalized.templateName, normalized.templateCode, normalized.content, normalized.userContent || "", normalized.temperature, normalized.maxTokens, normalized.defaultModelProviderId || null, normalized.defaultModelName || null, normalized.defaultModelVersion || null, boolFlag(normalized.isDefault), normalized.status || "active", normalized.id]
    );
  } else {
    const [result] = await pool.query(
      `INSERT INTO lab_prompt_template (prompt_type, template_name, template_code, content, user_content, temperature, max_tokens, default_model_provider_id, default_model_name, default_model_version, is_default, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [normalized.promptType, normalized.templateName, normalized.templateCode, normalized.content, normalized.userContent || "", normalized.temperature, normalized.maxTokens, normalized.defaultModelProviderId || null, normalized.defaultModelName || null, normalized.defaultModelVersion || null, boolFlag(normalized.isDefault), normalized.status || "active"]
    );
    normalized.id = Number(result.insertId);
  }
  await recordPromptTemplateVersion(normalized, {
    versionStatus: "published",
    createdBy: user?.displayName || user?.username || "system",
  });
  return listPromptTemplates();
}

async function savePromptTemplate(payload, user) {
  return publishPromptTemplate(payload, user);
}

async function deletePromptTemplate(id) {
  const [result] = await pool.query("DELETE FROM lab_prompt_template WHERE id = ?", [id]);
  if (result.affectedRows === 0) {
    throw new AppError("提示词模板不存在", 404);
  }
  return { id };
}

async function debugPromptTemplate(payload) {
  const provider = await validatePromptTemplateProvider(payload.modelProviderId);
  const result = await modelProviderService.generateChatCompletion(
    provider,
    [
      { role: "system", content: payload.systemPrompt },
      { role: "user", content: payload.prompt },
    ],
    {
      temperature: payload.temperature ?? 0.2,
      maxTokens: payload.maxTokens ?? 1200,
    }
  );
  const parsedJson = tryParseJson(result.content);
  return {
    rawText: result.content,
    parsedJson,
    validJson: Boolean(parsedJson),
  };
}

async function syncDefaultPromptTemplates() {
  const definitions = promptDefaults.listDefaultPromptTemplates();
  const synced = [];
  for (const item of definitions) {
    const [rows] = await pool.query(
      `SELECT id, template_name AS templateName, template_code AS templateCode, content, user_content AS userContent, temperature, max_tokens AS maxTokens, is_default AS isDefault
       FROM lab_prompt_template
       WHERE prompt_type = ?
       ORDER BY is_default DESC, updated_at DESC
       LIMIT 1`,
      [item.promptType]
    );
    if (rows.length > 0) {
      const existing = rows[0];
      if (
        existing.templateName !== item.templateName
        || existing.templateCode !== item.templateCode
        || (Number(existing.isDefault) === 1 && existing.content !== item.content)
        || !existing.userContent
        || existing.temperature === null
        || existing.temperature === undefined
        || existing.maxTokens === null
        || existing.maxTokens === undefined
      ) {
        await pool.query(
          `UPDATE lab_prompt_template
           SET template_name = ?, template_code = ?, content = CASE WHEN is_default = 1 THEN ? ELSE content END, user_content = ?, temperature = COALESCE(temperature, ?), max_tokens = COALESCE(max_tokens, ?)
           WHERE id = ?`,
          [item.templateName, item.templateCode, item.content, item.userContent || "{{input}}", item.temperature ?? null, item.maxTokens ?? null, Number(existing.id)]
        );
      }
      const [versionRows] = await pool.query("SELECT id FROM lab_prompt_template_version WHERE prompt_type = ? LIMIT 1", [item.promptType]);
      await pool.query(
        `UPDATE lab_prompt_template_version
         SET template_name = COALESCE(template_name, ?),
             template_code = COALESCE(template_code, ?),
             content = CASE WHEN version_no = 1 THEN ? ELSE content END,
             user_content = COALESCE(user_content, ?),
             temperature = COALESCE(temperature, ?),
             max_tokens = COALESCE(max_tokens, ?)
         WHERE prompt_type = ?`,
        [item.templateName, item.templateCode, item.content, item.userContent || "{{input}}", item.temperature ?? null, item.maxTokens ?? null, item.promptType]
      );
      if (versionRows.length === 0) {
        await recordPromptTemplateVersion({
          ...item,
          id: Number(existing.id),
          defaultModelProviderId: null,
        }, { versionStatus: "published", createdBy: "system" });
      }
      synced.push({ promptType: item.promptType, action: "kept_existing", id: Number(existing.id) });
      continue;
    }
    const [result] = await pool.query(
      `INSERT INTO lab_prompt_template (prompt_type, template_name, template_code, content, user_content, temperature, max_tokens, default_model_provider_id, is_default, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1, 'active')`,
      [item.promptType, item.templateName, item.templateCode, item.content, item.userContent || "{{input}}", item.temperature ?? null, item.maxTokens ?? null]
    );
    await recordPromptTemplateVersion({
      ...item,
      id: Number(result.insertId),
      defaultModelProviderId: null,
    }, { versionStatus: "published", createdBy: "system" });
    synced.push({ promptType: item.promptType, action: "created", id: Number(result.insertId) });
  }
  return {
    synced,
    templates: await listPromptTemplates(),
  };
}

async function listSceneTemplates() {
  const [rows] = await pool.query(
    `SELECT id, template_name AS templateName, template_code AS templateCode, category, scene_desc AS sceneDesc,
            schema_json AS schemaJson, strategy_json AS strategyJson, status, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scene_template
     ORDER BY updated_at DESC`
  );
  return rows.map((row) => ({
    id: Number(row.id),
    templateName: row.templateName,
    templateCode: row.templateCode,
    category: row.category,
    sceneDesc: row.sceneDesc,
    schema: safeJsonParse(row.schemaJson, {}),
    strategy: safeJsonParse(row.strategyJson, {}),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function saveSceneTemplate(payload) {
  if (payload.id) {
    await pool.query(
      `UPDATE lab_scene_template
       SET template_name = ?, template_code = ?, category = ?, scene_desc = ?, schema_json = ?, strategy_json = ?, status = ?
       WHERE id = ?`,
      [payload.templateName, payload.templateCode, payload.category || null, payload.sceneDesc || null, JSON.stringify(payload.schema || {}), JSON.stringify(payload.strategy || {}), payload.status || "active", payload.id]
    );
  } else {
    await pool.query(
      `INSERT INTO lab_scene_template (template_name, template_code, category, scene_desc, schema_json, strategy_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [payload.templateName, payload.templateCode, payload.category || null, payload.sceneDesc || null, JSON.stringify(payload.schema || {}), JSON.stringify(payload.strategy || {}), payload.status || "active"]
    );
  }
  return listSceneTemplates();
}

async function deleteSceneTemplate(id) {
  const [result] = await pool.query("DELETE FROM lab_scene_template WHERE id = ?", [id]);
  if (result.affectedRows === 0) {
    throw new AppError("场景模板不存在", 404);
  }
  return { id };
}

async function listOperationLogs(sceneId) {
  const scoped = getScopedWhere("s");
  const where = ["(? IS NULL OR log.scene_id = ?)"];
  const params = [sceneId || null, sceneId || null];
  if (scoped.sql) {
    where.push(`log.scene_id IS NOT NULL AND ${scoped.sql}`);
    params.push(...scoped.params);
  }
  const [rows] = await pool.query(
    `SELECT log.id, log.scene_id AS sceneId, log.operation_type AS operationType, log.operator_name AS operatorName,
            log.request_payload_json AS requestPayload, log.result_summary AS resultSummary, log.created_at AS createdAt
     FROM lab_operation_log log
     LEFT JOIN lab_scene s ON s.id = log.scene_id
     WHERE ${where.join(" AND ")}
     ORDER BY log.id DESC LIMIT 200`,
    params
  );
  return rows.map((row) => ({
    id: Number(row.id),
    sceneId: row.sceneId ? Number(row.sceneId) : null,
    operationType: row.operationType,
    operatorName: row.operatorName,
    requestPayload: safeJsonParse(row.requestPayload, null),
    resultSummary: row.resultSummary,
    createdAt: row.createdAt
  }));
}

async function reviewSceneRealismManagedPrompts(sceneId, payload = {}) {
  const scene = await getSceneBase(sceneId);
  const schema = await getCurrentSchemaVersion(sceneId);
  if (!schema) {
    throw new AppError("请先生成并确认结构", 400);
  }

  const sampleTables = Math.max(1, Number(payload.sampleTables || 6));
  const sampleRows = Math.max(1, Number(payload.sampleRows || 2));
  const sceneTables = await listSceneBusinessTables(sceneId);
  const sampledTables = [];
  for (const table of sceneTables.slice(0, sampleTables)) {
    const preview = await previewSceneTableData({ sceneId, tableName: table.logicalTableName, page: 1, pageSize: Math.max(sampleRows * 4, sampleRows) });
    const rawRows = preview.rows || [];
    const cleanRawRows = rawRows.filter((row) => !row.__dirtyFlag);
    const selectedSourceRows = (cleanRawRows.length > 0 ? cleanRawRows : rawRows).slice(0, sampleRows);
    const selectedRows = selectedSourceRows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith("__"))));
    sampledTables.push({
      tableName: table.logicalTableName,
      physicalTableName: table.physicalTableName,
      rowCount: preview.total,
      sampleRows: selectedRows,
    });
  }

  const fallbackProvider = payload.modelProfileId
    ? await getLabModelProviderByProfileId(payload.modelProfileId)
    : await getSceneGenerateProvider(scene, { allowDefault: true });

  const promptPayload = {
    sceneName: scene.sceneName,
    sceneDesc: scene.sceneDesc,
    researchPack: schema.content?.researchPack || null,
    scenarioProfile: schema.content?.scenarioProfile || null,
    tableCount: (schema.content?.tables || []).length,
    dictTableCount: (schema.content?.dictTables || []).length,
    sampledTables,
  };

  const promptConfig = await getRuntimePromptConfig(
    "DATA_REALISM_REVIEW",
    {
      systemPrompt: promptDefaults.buildDataRealismReviewDefaultPrompt(),
      userPrompt: promptDefaults.buildDataRealismReviewDefaultUserPrompt(),
    },
    {
      ...promptPayload,
      input: {
        ...promptPayload,
        outputContract: {
          onlyJson: true,
          fields: ["pass", "realismScore", "summary", "findings", "obviousFakePatterns", "recommendations"],
          findingsRules: ["每条只写一个问题", "优先指出一眼假的地方", "可以引用字段名或表名"],
          recommendationRules: ["每条建议都应可落到生成器、字段规则、时间链、地址语料、编号规则或分布规则"],
        },
      },
    }
  );
  const provider = promptConfig.provider || normalizeProviderForChat(fallbackProvider);
  if (!provider) {
    return {
      enabled: false,
      usedModel: false,
      reason: "no_active_model_provider",
      summary: "No active model provider available for realism review.",
      promptPayload,
    };
  }

  const strictSystemPrompt = `${promptConfig.systemPrompt}\n严格要求：1. 只能输出一个 JSON 对象。2. realismScore 统一使用 0 到 100 的数字。3. findings、obviousFakePatterns、recommendations 都必须是字符串数组。4. 不要输出 Markdown 代码块，不要补充解释文字。`;
  const response = await modelProviderService.generateChatCompletion(
    provider,
    [
      { role: "system", content: strictSystemPrompt },
      { role: "user", content: promptConfig.userPrompt },
    ],
    { temperature: promptConfig.temperature, maxTokens: promptConfig.maxTokens }
  );
  let parsed = tryParseJson(response.content) || null;
  let parseMode = parsed ? "json" : "raw_text";
  if (!parsed) {
    parsed = await repairRealismReviewOutput(provider, response.content);
    if (parsed) {
      parseMode = "repair_json";
    }
  }
  const normalizedPayload = normalizeRealismResponsePayload(parsed, response.content);
  const parsedPayload = normalizedPayload.payload || {};
  const structured = normalizedPayload.structured;
  if (normalizedPayload.parseMode && normalizedPayload.parseMode !== "json") {
    parseMode = normalizedPayload.parseMode;
  }
  const rawScore = Number(parsedPayload.realismScore || 0);
  const normalizedScore = rawScore <= 1
    ? Number((rawScore * 100).toFixed(2))
    : rawScore <= 5
      ? Number((rawScore * 20).toFixed(2))
      : rawScore <= 10
        ? Number((rawScore * 10).toFixed(2))
        : rawScore;
  const normalizedReview = normalizeRealismReview(parsedPayload);
  return {
    enabled: true,
    usedModel: true,
    structured,
    parseMode,
    summary: parsedPayload.summary || (structured ? "Model realism review completed." : "Model realism review returned unstructured content."),
    pass: parsedPayload.pass === null || parsedPayload.pass === undefined ? null : Boolean(parsedPayload.pass),
    realismScore: normalizedScore > 0 ? normalizedScore : null,
    findings: Array.isArray(parsedPayload.findings) ? parsedPayload.findings : [],
    obviousFakePatterns: Array.isArray(parsedPayload.obviousFakePatterns) ? parsedPayload.obviousFakePatterns : [],
    recommendations: Array.isArray(parsedPayload.recommendations) ? parsedPayload.recommendations : [],
    normalizedIssues: normalizedReview.issues,
    fixPlan: normalizedReview.fixPlan,
    issueStats: normalizedReview.issueStats,
    rawText: response.content,
    promptPayload,
  };
}

module.exports = {
  listKnowledgeBases,
  getKnowledgeBaseDetail,
  getKnowledgePlanningSummary,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  uploadKnowledgeDocument,
  reparseKnowledgeDocument,
  refreshKnowledgePlanningSummary,
  listScenes,
  getSceneDetail,
  createScene,
  updateScene,
  copyScene,
  analyzeScene,
  generateSchema,
  adjustSchema,
  saveSchema,
  confirmSchema,
  deploySceneSchema,
  generateStrategy,
  adjustStrategy,
  confirmStrategy,
  initializeScene,
  runSceneOnce,
  startSceneTask,
  stopSceneTask,
  startRealtime,
  stopRealtime,
  deleteScene,
  listSchemaVersions,
  listStrategyVersions,
  getSchemaVersionDiff,
  getStrategyVersionDiff,
  rollbackSchemaVersion,
  rollbackStrategyVersion,
  listSceneTopics,
  previewTopicMessages,
  createSceneTopic,
  deleteSceneTopic,
  getTopicMetrics,
  rerunFailedTasks,
  backfillScene,
  listSceneBusinessTables,
  previewSceneTableData,
  exportSceneTableCsv,
  reviewSceneRealism: reviewSceneRealismManagedPrompts,
  generateDirtyScript,
  rebuildQualityReport,
  getQualityReport,
  getRunLogs,
  getOpsDashboard,
  listLabModels,
  saveLabModel,
  deleteLabModel,
  setDefaultLabModel,
  debugLabModel,
  listPromptTemplates,
  savePromptTemplate,
  savePromptTemplateDraft,
  publishPromptTemplate,
  deletePromptTemplate,
  syncDefaultPromptTemplates,
  listPromptTemplateVersions,
  debugPromptTemplate,
  listSceneTemplates,
  saveSceneTemplate,
  deleteSceneTemplate,
  listOperationLogs,
  listSchedulableScenes,
  executeScheduledIncrement
};
