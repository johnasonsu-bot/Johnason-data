const { pool } = require("../../config/database");
const AppError = require("../../common/errors/app-error");
const enhancementService = require("./data-lab.enhancement");
const promptRuntime = require("./data-lab.prompt-runtime");
const internetResearch = require("./data-lab.internet-research");
const { getCurrentProjectId } = require("../../common/utils/project-context");

const jobs = new Map();

function getScopedWhere(alias = "") {
  const projectId = getCurrentProjectId();
  if (!projectId) return { sql: "", params: [], projectId: null };
  const prefix = alias ? `${alias}.` : "";
  return { sql: `${prefix}project_id = ?`, params: [projectId], projectId };
}

function safeJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function text(value, max = 240) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > max ? `${normalized.slice(0, max - 3)}...` : normalized;
}

function uniq(values = [], limit = 64) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => text(item, 240)).filter(Boolean))].slice(0, limit);
}

function pickNonEmptyRefs(...values) {
  for (const value of values) {
    const normalized = uniq(value, 32);
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return [];
}

function hasChineseText(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ""));
}

function extractReadableText(value, preferredKeys = [], depth = 0) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 2) {
    return "";
  }
  const entry = value;
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

function extractFieldLabelText(value) {
  return extractReadableText(value, [
    "fieldLabel",
    "fieldComment",
    "fieldName",
    "field_name",
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
  ]);
}

function extractKeyInfoItemText(value) {
  return extractReadableText(value, [
    "fieldLabel",
    "fieldComment",
    "fieldName",
    "field_name",
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

function normalizeCode(value, fallback = "item") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return normalized || `${fallback}_${Date.now().toString().slice(-8)}`;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function mergeByKey(base, extra, keyFn) {
  const map = new Map();
  [...(Array.isArray(base) ? base : []), ...(Array.isArray(extra) ? extra : [])].forEach((item) => {
    const key = keyFn(item);
    if (key) map.set(key, item);
  });
  return Array.from(map.values());
}

function defaultConfig() {
  return {
    languagePolicy: {
      locale: "zh-CN",
      domesticOnly: true,
      requiredChineseLabels: true,
      allowedCurrencies: ["CNY", "RMB"],
      sourceDomainWhitelist: ["gov.cn", "edu.cn", "org.cn", "www.gov.cn"],
      forbiddenForeignTerms: [],
      forbiddenForeignRegions: [],
    },
    autoResearchPolicy: {
      sourceTypes: ["鍥藉鏍囧噯", "琛屼笟鏍囧噯", "娉曡鏀跨瓥", "寤鸿瑙勮寖", "鍏紑鏁版嵁"],
      preferredDomains: ["gov.cn", "edu.cn", "org.cn"],
      requiredKeywords: [],
    },
    modelCommittee: { defaultModelProviderId: null, fallbackModelProviderId: null },
    scenarioPool: { scenarios: [] },
    scenarioCoverage: { sceneFingerprints: [], coveredSubScenarios: [], coveredModules: [] },
    evidenceCatalog: { items: [] },
    standardAssets: { researchCatalog: { summary: "", categoryTree: [], candidateTableSpecs: [] }, dictionaries: [] },
    trainingSettings: {
      targetRoundCount: 3,
      targetCategoryCount: 1,
      runState: {
        mode: "industry",
        status: "idle",
        totalRounds: 0,
        taskCurrentRoundNo: 0,
        targetCategoryCode: null,
        targetCategoryName: null,
        stopRequested: false,
        startedAt: null,
        endedAt: null,
        lastError: null,
      },
    },
  };
}

function normalizeTrainingSettings(value) {
  const defaults = defaultConfig().trainingSettings;
  const source = safeJson(value, {});
  return {
    ...defaults,
    ...source,
    targetRoundCount: clampInt(source.targetRoundCount, 1, 12, defaults.targetRoundCount),
    targetCategoryCount: clampInt(source.targetCategoryCount, 1, 8, defaults.targetCategoryCount),
    runState: {
      ...defaults.runState,
      ...(source.runState && typeof source.runState === "object" ? source.runState : {}),
    },
  };
}

function normalizeEvidenceItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: item.id,
    sourceHash: item.sourceHash,
    sourceUrl: item.sourceUrl,
    title: item.title,
    authority: item.authority,
    publishedAt: item.publishedAt || null,
    summary: item.summary || "",
    sourceType: item.sourceType || "",
    snapshotContent: item.snapshotContent || "",
  }));
}

function sanitizeStoredFieldLabel(value) {
  const raw = text(extractFieldLabelText(value), 64);
  if (!raw) return "";
  if (isPromptPlaceholderField(raw)) return "";
  if (/[()（）]/.test(raw)) return "";
  if (!hasChineseText(raw) && /^[A-Za-z0-9_]+$/.test(raw)) return "";
  return raw;
}

function normalizeFieldList(values = []) {
  return uniq((Array.isArray(values) ? values : []).map((item) => {
    if (typeof item === "string") return sanitizeStoredFieldLabel(item);
    return sanitizeStoredFieldLabel(item?.fieldName || item?.field_name || item?.name || item?.label || "");
  }).filter(Boolean), 32);
}

function normalizeTable(table = {}) {
  const fields = normalizeFieldList(table.fields || table.keyInfoItems || table.key_info_items || []);
  const keyInfoItems = normalizeKeyInfoItemList(table.keyInfoItems || table.key_info_items || []);
  return {
    tableName: normalizeCode(table.tableName || table.table_name || table.tableLabel || table.table_label, "table"),
    tableLabel: text(table.tableLabel || table.table_label || table.tableComment || table.table_comment || table.tableName, 64),
    tableComment: text(table.tableComment || table.table_comment || table.tableLabel || table.table_label || table.tableName, 160),
    keyInfoItems: keyInfoItems.length > 0 ? keyInfoItems : fields.slice(0, 16),
    fields,
    sourceRefs: pickNonEmptyRefs(table.sourceRefs, table.source_refs),
  };
}

function isPromptPlaceholderField(value) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  return /^field[_-]?\d+$/i.test(raw)
    || /^FIELD\d+$/i.test(raw)
    || /^\[object\s+[^\]]+\]$/i.test(raw)
    || /^(object_object|table_object|dict_object|unknown|tbd)$/i.test(raw);
}

function sanitizePromptKeyInfoItem(value) {
  const raw = text(extractKeyInfoItemText(value), 64);
  if (!raw) return "";
  if (isPromptPlaceholderField(raw)) return "";
  if (/[A-Za-z_]/.test(raw)) return "";
  if (/[()（）]/.test(raw)) return "";
  if (/[,:;：；]/.test(raw)) return "";
  if (/作为|用于|关联|对应|分为|说明|唯一标识/.test(raw)) return "";
  if (/^(主键|外键)$/.test(raw)) return "";
  return raw;
}

function sanitizeStoredKeyInfoItem(value) {
  const raw = text(extractKeyInfoItemText(value), 64);
  if (!raw) return "";
  if (isPromptPlaceholderField(raw)) return "";
  if (/[()（）]/.test(raw)) return "";
  if (!hasChineseText(raw) && /^[A-Za-z0-9_]+$/.test(raw)) return "";
  if (/[,:;：；]/.test(raw)) return "";
  if ((/作为|用于|分为|说明|唯一标识|业务规则|取值说明|主键说明|关联说明/.test(raw)) && raw.length > 8) return "";
  return raw;
}

function normalizeKeyInfoItemList(values = [], limit = 16) {
  return uniq((Array.isArray(values) ? values : []).map((item) => sanitizeStoredKeyInfoItem(item)).filter(Boolean), limit);
}

function sanitizePromptFieldLabel(value) {
  const raw = text(extractFieldLabelText(value), 64);
  if (!raw) return "";
  if (isPromptPlaceholderField(raw)) return "";
  if (/[A-Za-z_]/.test(raw)) return "";
  if (/[()（）]/.test(raw)) return "";
  return raw;
}

function buildPromptTableSnapshot(table = {}) {
  const keyInfoItems = uniq((Array.isArray(table.keyInfoItems) ? table.keyInfoItems : []).map(sanitizePromptKeyInfoItem).filter(Boolean), 12);
  const fields = uniq((Array.isArray(table.fields) ? table.fields : []).map(sanitizePromptFieldLabel).filter(Boolean), 16);
  const promptFields = fields.length > 0 ? fields : keyInfoItems;
  return {
    tableName: text(table.tableName, 64),
    tableLabel: text(table.tableLabel, 64),
    tableComment: text(table.tableComment, 160),
    fields: promptFields,
    keyInfoItems,
    sourceRefs: uniq(table.sourceRefs || table.source_refs, 12),
  };
}

function buildGenericGapProfile(targetCategory, dictionaryItems = []) {
  const tableHints = (Array.isArray(targetCategory?.tableDetails) ? targetCategory.tableDetails : []).flatMap((item) => [
    item?.tableName,
    item?.tableLabel,
    item?.tableComment,
  ]);
  const dictHints = (Array.isArray(dictionaryItems) ? dictionaryItems : []).flatMap((item) => [
    item?.dictType,
    item?.dictName,
    item?.itemValue?.dictName,
    item?.itemLabel,
  ]);
  const haystack = [
    targetCategory?.categoryName,
    targetCategory?.description,
    ...(Array.isArray(targetCategory?.tableScopes) ? targetCategory.tableScopes : []),
    ...tableHints,
    ...dictHints,
  ].map((item) => String(item || "").toLowerCase()).join(" ");
  const missingDimensions = [];
  if (!/台账|档案|record|log|ledger|detail|list/.test(haystack)) missingDimensions.push("台账档案");
  if (!/状态|阶段|status|phase/.test(haystack)) missingDimensions.push("状态阶段");
  if (!/审批|流程|audit|workflow|process|flow/.test(haystack)) missingDimensions.push("审批流程");
  if (!/资源|设施|asset|facility|resource/.test(haystack)) missingDimensions.push("资源设施");
  if (!/标准|规则|policy|standard|rule|spec/.test(haystack)) missingDimensions.push("规则标准");
  return {
    missingDimensions,
    gapKeywords: uniq(missingDimensions.map((item) => [targetCategory?.categoryName || "", item].join(" ").trim()), 24),
  };
}

function mergeTable(existing = {}, incoming = {}) {
  const mergedFields = normalizeFieldList([...(Array.isArray(existing.fields) ? existing.fields : []), ...(Array.isArray(incoming.fields) ? incoming.fields : [])]);
  const mergedKeyInfoItems = normalizeKeyInfoItemList([...(Array.isArray(existing.keyInfoItems) ? existing.keyInfoItems : []), ...(Array.isArray(incoming.keyInfoItems) ? incoming.keyInfoItems : [])]);
  return {
    tableName: existing.tableName || incoming.tableName,
    tableLabel: incoming.tableLabel || existing.tableLabel,
    tableComment: incoming.tableComment || existing.tableComment,
    keyInfoItems: mergedKeyInfoItems.length > 0 ? mergedKeyInfoItems : mergedFields.slice(0, 16),
    fields: mergedFields,
    sourceRefs: uniq([...(Array.isArray(existing.sourceRefs) ? existing.sourceRefs : []), ...(Array.isArray(incoming.sourceRefs) ? incoming.sourceRefs : [])], 16),
  };
}

function normalizeCategory(category = {}, fallback = {}) {
  const tableDetails = (Array.isArray(category.tableDetails) ? category.tableDetails : Array.isArray(category.table_details) ? category.table_details : []).map(normalizeTable);
  return {
    categoryCode: normalizeCode(category.categoryCode || category.category_code || fallback.categoryCode || category.categoryName || category.category_name, "category"),
    categoryName: text(category.categoryName || category.category_name || fallback.categoryName || category.categoryCode || category.category_code, 64),
    description: text(category.description || category.desc || fallback.description || "", 240),
    tableDetails,
    tableScopes: tableDetails.map((item) => item.tableName),
    sourceRefs: pickNonEmptyRefs(
      category.sourceRefs,
      category.source_refs,
      category.evidenceRefs,
      category.evidence_refs,
      fallback.sourceRefs,
      fallback.evidenceRefs
    ),
    evidenceRefs: pickNonEmptyRefs(
      category.evidenceRefs,
      category.evidence_refs,
      category.sourceRefs,
      category.source_refs,
      fallback.evidenceRefs,
      fallback.sourceRefs
    ),
    continueIteration: category.continueIteration !== false && category.continue_iteration !== false,
  };
}

function mergeCategory(existing = {}, incoming = {}) {
  const tableMap = new Map();
  (Array.isArray(existing.tableDetails) ? existing.tableDetails : []).forEach((item) => tableMap.set(String(item.tableName || "").trim(), item));
  (Array.isArray(incoming.tableDetails) ? incoming.tableDetails : []).forEach((item) => {
    const key = String(item.tableName || "").trim();
    if (!key) return;
    tableMap.set(key, tableMap.has(key) ? mergeTable(tableMap.get(key), item) : item);
  });
  const mergedTables = Array.from(tableMap.values());
  return {
    categoryCode: existing.categoryCode || incoming.categoryCode,
    categoryName: incoming.categoryName || existing.categoryName,
    description: incoming.description || existing.description,
    tableDetails: mergedTables,
    tableScopes: mergedTables.map((item) => item.tableName),
    sourceRefs: uniq([...(Array.isArray(existing.sourceRefs) ? existing.sourceRefs : []), ...(Array.isArray(incoming.sourceRefs) ? incoming.sourceRefs : [])], 16),
    evidenceRefs: uniq([...(Array.isArray(existing.evidenceRefs) ? existing.evidenceRefs : []), ...(Array.isArray(incoming.evidenceRefs) ? incoming.evidenceRefs : [])], 32),
    continueIteration: incoming.continueIteration !== false && existing.continueIteration !== false,
  };
}

function backfillCategoryEvidenceRefs(categories = [], fallbackRefs = []) {
  const refs = uniq(fallbackRefs, 32);
  if (refs.length === 0) {
    return Array.isArray(categories) ? categories : [];
  }
  return (Array.isArray(categories) ? categories : []).map((category) => {
    const categoryRefs = uniq(Array.isArray(category?.sourceRefs) ? category.sourceRefs : [], 32);
    const tableDetails = (Array.isArray(category?.tableDetails) ? category.tableDetails : []).map((table) => ({
      ...table,
      sourceRefs: uniq(
        Array.isArray(table?.sourceRefs) && table.sourceRefs.length > 0 ? table.sourceRefs : (categoryRefs.length > 0 ? categoryRefs : refs),
        32
      ),
    }));
    return {
      ...category,
      sourceRefs: categoryRefs.length > 0 ? categoryRefs : refs,
      evidenceRefs: uniq(
        Array.isArray(category?.evidenceRefs) && category.evidenceRefs.length > 0 ? category.evidenceRefs : (categoryRefs.length > 0 ? categoryRefs : refs),
        32
      ),
      tableDetails,
      tableScopes: tableDetails.map((item) => item.tableName),
    };
  });
}

function normalizeDictionary(dictionary = {}, index = 0) {
  const rawItems = Array.isArray(dictionary.items)
    ? dictionary.items
    : Array.isArray(dictionary.dictItems)
      ? dictionary.dictItems
      : Array.isArray(dictionary.dict_items)
        ? dictionary.dict_items
        : Array.isArray(dictionary.newItems)
          ? dictionary.newItems
          : Array.isArray(dictionary.new_items)
            ? dictionary.new_items
        : Array.isArray(dictionary.addItems)
          ? dictionary.addItems
          : Array.isArray(dictionary.add_items)
            ? dictionary.add_items
            : [];
  return {
    dictType: normalizeCode(dictionary.dictType || dictionary.dict_type || dictionary.dictCode || dictionary.dict_code || dictionary.dictName || dictionary.dict_name, "dict"),
    dictName: text(dictionary.dictName || dictionary.dict_name || dictionary.name || `dict_${index + 1}`, 64),
    categoryCode: dictionary.categoryCode || dictionary.category_code ? normalizeCode(dictionary.categoryCode || dictionary.category_code, "category") : null,
    sourceRefs: uniq(dictionary.sourceRefs || dictionary.source_refs, 12),
    items: rawItems.map((item, itemIndex) => {
      const rawCode = String(item?.itemCode || item?.item_code || "").trim().toUpperCase();
      return {
        itemCode: /^[A-Z0-9]{2,8}$/.test(rawCode) ? rawCode : String(itemIndex + 1).padStart(2, "0"),
        itemLabel: text(item?.itemLabel || item?.item_label || item?.itemName || item?.item_name || `item_${itemIndex + 1}`, 64),
        valueRange: text(item?.valueRange || item?.value_range || "", 128) || null,
        sourceRefs: uniq(item?.sourceRefs || item?.source_refs, 12),
      };
    }),
  };
}

function summarizeExtractionDiagnostics(root, categories, dictionaries, candidateTableSpecs) {
  const increments = root?.increments && typeof root.increments === "object" ? root.increments : {};
  return {
    rootCategoryCode: root?.categoryCode || root?.category_code || null,
    rootCategoryName: root?.categoryName || root?.category_name || null,
    rootCategoriesCount: Array.isArray(root?.categories) ? root.categories.length : 0,
    rootTableDetailsCount: Array.isArray(root?.tableDetails) ? root.tableDetails.length : Array.isArray(root?.table_details) ? root.table_details.length : 0,
    rootTableDetailsIncrementCount: Array.isArray(root?.tableDetailsIncrement) ? root.tableDetailsIncrement.length : Array.isArray(root?.table_details_increment) ? root.table_details_increment.length : 0,
    rootNewTableDetailsCount: Array.isArray(root?.newTableDetails) ? root.newTableDetails.length : Array.isArray(root?.new_table_details) ? root.new_table_details.length : 0,
    rootCandidateTableSpecsCount: Array.isArray(root?.candidateTableSpecs) ? root.candidateTableSpecs.length : Array.isArray(root?.candidate_table_specs) ? root.candidate_table_specs.length : 0,
    rootDictionariesCount: Array.isArray(root?.dictionaries) ? root.dictionaries.length : 0,
    rootDictionaryIncrementsCount: Array.isArray(root?.dictionaryIncrements) ? root.dictionaryIncrements.length : Array.isArray(root?.dictionary_increments) ? root.dictionary_increments.length : 0,
    rootNewDictionariesCount: Array.isArray(root?.newDictionaries) ? root.newDictionaries.length : Array.isArray(root?.new_dictionaries) ? root.new_dictionaries.length : 0,
    rootDictionaryItemIncrementsCount: Array.isArray(root?.dictionaryItemIncrements) ? root.dictionaryItemIncrements.length : Array.isArray(root?.dictionary_item_increments) ? root.dictionary_item_increments.length : 0,
    incrementsNewTablesCount: Array.isArray(increments?.newTables) ? increments.newTables.length : Array.isArray(increments?.new_tables) ? increments.new_tables.length : 0,
    incrementsNewDictionariesCount: Array.isArray(increments?.newDictionaries) ? increments.newDictionaries.length : Array.isArray(increments?.new_dictionaries) ? increments.new_dictionaries.length : 0,
    incrementsDictionaryItemAdditionsCount: Array.isArray(increments?.dictionaryItemAdditions) ? increments.dictionaryItemAdditions.length : Array.isArray(increments?.dictionary_item_additions) ? increments.dictionary_item_additions.length : 0,
    incrementsDictionaryItemIncrementsCount: Array.isArray(increments?.dictionaryItemIncrements) ? increments.dictionaryItemIncrements.length : Array.isArray(increments?.dictionary_item_increments) ? increments.dictionary_item_increments.length : 0,
    normalizedCategoryCount: Array.isArray(categories) ? categories.length : 0,
    normalizedTableCount: Array.isArray(candidateTableSpecs) ? candidateTableSpecs.length : 0,
    normalizedDictionaryCount: Array.isArray(dictionaries) ? dictionaries.length : 0,
    normalizedDictionaryItemCount: (Array.isArray(dictionaries) ? dictionaries : []).reduce((sum, item) => sum + (Array.isArray(item?.items) ? item.items.length : 0), 0),
  };
}

function buildCategoryOutputSchemaTemplate() {
  return {
    summary: "string",
    categoryCode: "string",
    categoryName: "string",
    newTables: [
      {
        tableName: "string",
        tableLabel: "string",
        tableComment: "string",
        fields: ["string"],
        keyInfoItems: ["string"],
        sourceRefs: ["string"],
      },
    ],
    newDictionaries: [
      {
        dictType: "string",
        dictName: "string",
        items: [
          {
            itemCode: "string",
            itemLabel: "string",
            valueRange: "string",
          },
        ],
        sourceRefs: ["string"],
      },
    ],
    dictionaryItemIncrements: [
      {
        dictType: "string",
        dictName: "string",
        items: [
          {
            itemCode: "string",
            itemLabel: "string",
            valueRange: "string",
          },
        ],
        sourceRefs: ["string"],
      },
    ],
  };
}

function buildIndustryOutputSchemaTemplate() {
  return {
    summary: "string",
    categories: [
      {
        categoryCode: "string",
        categoryName: "string",
        description: "string",
        tableDetails: [
          {
            tableName: "string",
            tableLabel: "string",
            tableComment: "string",
            fields: ["string"],
            keyInfoItems: ["string"],
            sourceRefs: ["string"],
          },
        ],
        sourceRefs: ["string"],
        evidenceRefs: ["string"],
      },
    ],
    dictionaries: [
      {
        dictType: "string",
        dictName: "string",
        categoryCode: "string",
        items: [
          {
            itemCode: "string",
            itemLabel: "string",
            valueRange: "string",
          },
        ],
        sourceRefs: ["string"],
      },
    ],
    candidateTableSpecs: [
      {
        tableName: "string",
        tableLabel: "string",
        tableComment: "string",
        fields: ["string"],
        keyInfoItems: ["string"],
        sourceRefs: ["string"],
      },
    ],
  };
}

function collectCategoryTableCandidates(root = {}) {
  const increments = root?.increments && typeof root.increments === "object" ? root.increments : {};
  const buckets = [
    root?.newTables,
    root?.new_tables,
    root?.tableDetails,
    root?.table_details,
    root?.tableDetailsIncrement,
    root?.table_details_increment,
    root?.newTableDetails,
    root?.new_table_details,
    root?.candidateTableSpecs,
    root?.candidate_table_specs,
    increments?.newTables,
    increments?.new_tables,
  ];
  return buckets.find((item) => Array.isArray(item)) || [];
}

function collectCategoryNewDictionaryCandidates(root = {}) {
  const increments = root?.increments && typeof root.increments === "object" ? root.increments : {};
  const buckets = [
    root?.newDictionaries,
    root?.new_dictionaries,
    root?.dictionaries,
    root?.dictionaryIncrements,
    root?.dictionary_increments,
    increments?.newDictionaries,
    increments?.new_dictionaries,
    increments?.dictionaryIncrements,
    increments?.dictionary_increments,
  ];
  return buckets.find((item) => Array.isArray(item)) || [];
}

function collectCategoryDictionaryIncrementCandidates(root = {}) {
  const increments = root?.increments && typeof root.increments === "object" ? root.increments : {};
  const buckets = [
    root?.dictionaryItemIncrements,
    root?.dictionary_item_increments,
    root?.dictionaryItemAdditions,
    root?.dictionary_item_additions,
    increments?.dictionaryItemIncrements,
    increments?.dictionary_item_increments,
    increments?.dictionaryItemAdditions,
    increments?.dictionary_item_additions,
  ];
  return buckets.find((item) => Array.isArray(item)) || [];
}

function buildCanonicalIndustryOutput(parsed) {
  const root = parsed?.data && typeof parsed.data === "object" ? parsed.data : (parsed && typeof parsed === "object" ? parsed : {});
  const categoryCandidates = Array.isArray(root?.categories)
    ? root.categories
    : Array.isArray(root?.subCategories)
      ? root.subCategories
      : Array.isArray(root?.sub_categories)
        ? root.sub_categories
        : (root?.categoryCode || root?.category_code || root?.categoryName || root?.category_name)
          ? [{
              categoryCode: root?.categoryCode || root?.category_code,
              categoryName: root?.categoryName || root?.category_name,
              description: root?.description || root?.desc || "",
              tableDetails: Array.isArray(root?.tableDetails) ? root.tableDetails : Array.isArray(root?.table_details) ? root.table_details : [],
              sourceRefs: root?.sourceRefs || root?.source_refs || [],
              evidenceRefs: root?.evidenceRefs || root?.evidence_refs || [],
            }]
          : [];
  const categories = categoryCandidates.map((item) => ({
    categoryCode: item?.categoryCode || item?.category_code || "",
    categoryName: item?.categoryName || item?.category_name || "",
    description: item?.description || item?.desc || "",
    tableDetails: Array.isArray(item?.tableDetails) ? item.tableDetails : Array.isArray(item?.table_details) ? item.table_details : [],
    sourceRefs: Array.isArray(item?.sourceRefs) ? item.sourceRefs : Array.isArray(item?.source_refs) ? item.source_refs : [],
    evidenceRefs: Array.isArray(item?.evidenceRefs) ? item.evidenceRefs : Array.isArray(item?.evidence_refs) ? item.evidence_refs : [],
  }));
  const candidateTableSpecs = Array.isArray(root?.candidateTableSpecs)
    ? root.candidateTableSpecs
    : Array.isArray(root?.candidate_table_specs)
      ? root.candidate_table_specs
      : categories.flatMap((item) => (Array.isArray(item?.tableDetails) ? item.tableDetails : []));
  const dictionaries = Array.isArray(root?.dictionaries) ? root.dictionaries : [];
  return {
    summary: text(root?.summary || "", 160),
    categories,
    dictionaries,
    candidateTableSpecs,
  };
}

function buildCanonicalCategoryOutput(parsed, options = {}) {
  const root = parsed?.data && typeof parsed.data === "object" ? parsed.data : (parsed && typeof parsed === "object" ? parsed : {});
  const targetCategoryCode = String(options.targetCategoryCode || "").trim() || null;
  const targetCategoryName = String(options.targetCategoryName || "").trim() || null;
  return {
    summary: text(root?.summary || "", 160),
    categoryCode: text(root?.categoryCode || root?.category_code || targetCategoryCode || "", 64),
    categoryName: text(root?.categoryName || root?.category_name || targetCategoryName || "", 64),
    newTables: collectCategoryTableCandidates(root),
    newDictionaries: collectCategoryNewDictionaryCandidates(root),
    dictionaryItemIncrements: collectCategoryDictionaryIncrementCandidates(root),
  };
}

function validateCanonicalCategoryOutput(output, options = {}) {
  const allowedTopKeys = new Set(["summary", "categoryCode", "categoryName", "newTables", "newDictionaries", "dictionaryItemIncrements"]);
  const errors = [];
  const data = output && typeof output === "object" ? output : {};
  const topKeys = Object.keys(data);
  const illegalTopKeys = topKeys.filter((key) => !allowedTopKeys.has(key));
  if (illegalTopKeys.length > 0) errors.push(`illegal top-level keys: ${illegalTopKeys.join(", ")}`);
  ["summary", "categoryCode", "categoryName"].forEach((key) => {
    if (!String(data?.[key] || "").trim()) errors.push(`missing or empty ${key}`);
  });
  ["newTables", "newDictionaries", "dictionaryItemIncrements"].forEach((key) => {
    if (!Array.isArray(data?.[key])) errors.push(`${key} must be an array`);
  });
  const expectedCode = String(options.targetCategoryCode || "").trim();
  if (expectedCode && String(data?.categoryCode || "").trim() && String(data.categoryCode).trim() !== expectedCode) {
    errors.push(`categoryCode mismatch: expected ${expectedCode}`);
  }
  const totalIncrementCount = (Array.isArray(data?.newTables) ? data.newTables.length : 0)
    + (Array.isArray(data?.newDictionaries) ? data.newDictionaries.length : 0)
    + (Array.isArray(data?.dictionaryItemIncrements) ? data.dictionaryItemIncrements.length : 0);
  if (totalIncrementCount < 1) errors.push("no increments extracted into canonical schema");
  return {
    valid: errors.length === 0,
    errors,
    topKeys,
    counts: {
      newTables: Array.isArray(data?.newTables) ? data.newTables.length : -1,
      newDictionaries: Array.isArray(data?.newDictionaries) ? data.newDictionaries.length : -1,
      dictionaryItemIncrements: Array.isArray(data?.dictionaryItemIncrements) ? data.dictionaryItemIncrements.length : -1,
      totalIncrementCount,
    },
  };
}

function validateCanonicalIndustryOutput(output) {
  const allowedTopKeys = new Set(["summary", "categories", "dictionaries", "candidateTableSpecs"]);
  const errors = [];
  const data = output && typeof output === "object" ? output : {};
  const topKeys = Object.keys(data);
  const illegalTopKeys = topKeys.filter((key) => !allowedTopKeys.has(key));
  if (illegalTopKeys.length > 0) errors.push(`illegal top-level keys: ${illegalTopKeys.join(", ")}`);
  if (!String(data?.summary || "").trim()) errors.push("missing or empty summary");
  if (!Array.isArray(data?.categories)) errors.push("categories must be an array");
  if (!Array.isArray(data?.dictionaries)) errors.push("dictionaries must be an array");
  if (!Array.isArray(data?.candidateTableSpecs)) errors.push("candidateTableSpecs must be an array");
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  if (categories.length < 1) errors.push("categories must contain at least one category");
  if (categories.length > 1) errors.push("categories must contain exactly one category");
  const firstCategory = categories[0] || {};
  if (!String(firstCategory?.categoryCode || "").trim()) errors.push("missing categoryCode in categories[0]");
  if (!String(firstCategory?.categoryName || "").trim()) errors.push("missing categoryName in categories[0]");
  const categoryTableCount = Array.isArray(firstCategory?.tableDetails) ? firstCategory.tableDetails.length : 0;
  const candidateTableCount = Array.isArray(data?.candidateTableSpecs) ? data.candidateTableSpecs.length : 0;
  if (Math.max(categoryTableCount, candidateTableCount) < 1) errors.push("no table increments extracted into canonical schema");
  return {
    valid: errors.length === 0,
    errors,
    topKeys,
    counts: {
      categories: categories.length,
      categoryTableCount,
      candidateTableCount,
      dictionaries: Array.isArray(data?.dictionaries) ? data.dictionaries.length : -1,
    },
  };
}

async function repairCategoryOutputShape(provider, promptInput, rawText, options = {}) {
  const schemaTemplate = JSON.stringify(buildCategoryOutputSchemaTemplate(), null, 2);
  const repairMessages = [
    {
      role: "system",
      content: [
        "You repair one category enhancement JSON into the required canonical schema.",
        "Preserve business meaning and increments.",
        "Return one valid JSON object only.",
        "Top-level keys must be exactly: summary, categoryCode, categoryName, newTables, newDictionaries, dictionaryItemIncrements.",
        "Do not output keys such as increments, tableDetails, tableDetailsIncrement, newTableDetails, candidateTableSpecs, dictionaries, dictionaryIncrements, dictionaryItemAdditions, dictItems, newItems, addItems.",
        "If a section has no content, return an empty array.",
        "Schema template:",
        schemaTemplate,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Target categoryCode: ${promptInput?.targetCategoryCode || ""}`,
        `Target categoryName: ${promptInput?.targetCategoryName || ""}`,
        "Rewrite the following model output into the canonical schema only. Do not change business meaning.",
        rawText,
      ].join("\n\n"),
    },
  ];
  return strictGenerateChatCompletion(provider, repairMessages, {
    temperature: 0,
    maxTokens: Math.min(Number(options.maxTokens || 4000), 4000),
    timeoutMs: Number(options.timeoutMs || 600000),
  });
}

async function repairIndustryOutputShape(provider, promptInput, rawText, options = {}) {
  const schemaTemplate = JSON.stringify(buildIndustryOutputSchemaTemplate(), null, 2);
  const compactRetry = options.compactRetry === true;
  const repairMessages = [
    {
      role: "system",
      content: [
        compactRetry
          ? "Regenerate a complete industry-incubation JSON from the provided business context and any partial model output."
          : "You repair one industry-incubation JSON into the required canonical schema.",
        "Preserve business meaning and proposed increments where present.",
        "Return one valid JSON object only.",
        "Top-level keys must be exactly: summary, categories, dictionaries, candidateTableSpecs.",
        "Do not output keys such as increments, subCategories, sub_categories, newTables, newDictionaries, dictionaryItemIncrements, dictionaryItemAdditions.",
        "The categories array must contain exactly one category with a non-empty categoryCode and categoryName.",
        "The category must contain at least one concrete tableDetails entry, and candidateTableSpecs must contain at least one table.",
        "Never return empty categories or candidateTableSpecs when the business context describes a new subcategory.",
        "Schema template:",
        schemaTemplate,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Industry name: ${promptInput?.incubationName || ""}`,
        `Industry description: ${text(promptInput?.incubationDesc || "", 1200)}`,
        `Structured business context: ${JSON.stringify(promptInput || {}, null, 2)}`,
        compactRetry
          ? "Generate the missing category and at least one operational table from the full context. Keep identifiers in snake_case and labels/comments in Chinese."
          : "Rewrite the following model output into the canonical schema only. Do not change business meaning; if the output is truncated, recover the missing structure from the full context.",
        rawText,
      ].join("\n\n"),
    },
  ];
  return strictGenerateChatCompletion(provider, repairMessages, {
    temperature: 0,
    maxTokens: Math.min(Number(options.maxTokens || 4000), 4000),
    timeoutMs: Number(options.timeoutMs || 600000),
  });
}

function mergeDictionary(existing = {}, incoming = {}) {
  const itemMap = new Map();
  [...(Array.isArray(existing.items) ? existing.items : []), ...(Array.isArray(incoming.items) ? incoming.items : [])].forEach((item) => {
    const key = String(item?.itemCode || item?.itemLabel || "").trim();
    if (!key) return;
    itemMap.set(key, item);
  });
  return {
    dictType: existing.dictType || incoming.dictType,
    dictName: incoming.dictName || existing.dictName,
    categoryCode: incoming.categoryCode || existing.categoryCode,
    sourceRefs: uniq([...(Array.isArray(existing.sourceRefs) ? existing.sourceRefs : []), ...(Array.isArray(incoming.sourceRefs) ? incoming.sourceRefs : [])], 16),
    items: Array.from(itemMap.values()),
  };
}

function parseModelJson(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) return {};
  const candidates = [raw];
  const fencedStart = raw.indexOf("```");
  if (fencedStart >= 0) {
    const fencedEnd = raw.indexOf("```", fencedStart + 3);
    if (fencedEnd > fencedStart) {
      let fenced = raw.slice(fencedStart + 3, fencedEnd).trim();
      if (fenced.toLowerCase().startsWith("json")) fenced = fenced.slice(4).trim();
      if (fenced) candidates.push(fenced);
    }
  }
  const objStart = raw.indexOf("{");
  const objEnd = raw.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) candidates.push(raw.slice(objStart, objEnd + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }
  return {};
}

function extractPartialSummary(rawText) {
  const raw = String(rawText || "");
  const match = raw.match(/"summary"\s*:\s*"((?:\\.|[^"\\])*)/i);
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1].replace(/\\n/g, " ").replace(/\\"/g, '"').trim();
  }
}

function buildIndustryRecoveryOutput(promptInput = {}, parsedOutput = {}, rawText = "") {
  const root = parsedOutput?.data && typeof parsedOutput.data === "object" ? parsedOutput.data : (parsedOutput && typeof parsedOutput === "object" ? parsedOutput : {});
  const summary = text(root?.summary || extractPartialSummary(rawText) || promptInput?.incubationDesc || promptInput?.incubationName || "行业元数据补全", 160);
  const categoryName = text(
    root?.categories?.[0]?.categoryName
      || root?.categoryName
      || root?.category_name
      || (summary.match(/新增子类目[：:]\s*([^。；;，,\n]+)/)?.[1] || "")
      || promptInput?.targetCategoryName
      || `${promptInput?.incubationName || "行业"}业务`,
    64
  );
  const categoryCode = normalizeCode(
    root?.categories?.[0]?.categoryCode || root?.categoryCode || root?.category_code,
    `industry_${normalizeCode(promptInput?.industryCode || promptInput?.incubationName || "category", "category")}`
  );
  const tableName = `${categoryCode}_operations`;
  const table = {
    tableName,
    tableLabel: `${categoryName}作业记录`,
    tableComment: `记录${categoryName}接卸、作业、堆存及疏运等核心业务过程。`,
    fields: ["业务日期", "作业单号", "作业状态", "作业数量", "责任单位"],
    keyInfoItems: ["作业单号", "业务日期"],
    sourceRefs: Array.isArray(promptInput?.evidenceItems) ? promptInput.evidenceItems.map((item) => item?.id).filter(Boolean).slice(0, 8) : [],
  };
  return {
    summary,
    categories: [{
      categoryCode,
      categoryName,
      description: summary,
      tableDetails: [table],
      sourceRefs: table.sourceRefs,
      evidenceRefs: table.sourceRefs,
    }],
    dictionaries: [],
    candidateTableSpecs: [table],
  };
}

function extractCompletionContent(data) {
  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  const content = choice?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((item) => item?.text || item?.output_text || "").join("\n");
  if (typeof choice?.text === "string") return choice.text;
  return "";
}

function buildProviderHeaders(provider) {
  const extraHeaders = provider?.extraConfig?.defaultHeaders && typeof provider.extraConfig.defaultHeaders === "object"
    ? Object.fromEntries(Object.entries(provider.extraConfig.defaultHeaders).map(([key, value]) => [key, String(value)]))
    : {};
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${provider.apiKey}`,
    ...extraHeaders,
  };
  if (provider.organizationId && provider.providerType === "openai") headers["OpenAI-Organization"] = provider.organizationId;
  if (provider.providerType === "azure_openai") {
    delete headers.Authorization;
    headers["api-key"] = provider.apiKey;
  }
  return headers;
}

function buildProviderEndpoint(provider) {
  const baseUrl = String(provider.baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) throw new AppError("industry provider baseUrl is empty", 400);
  if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl;
  if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}

async function strictGenerateChatCompletion(provider, messages, options = {}) {
  const endpoint = buildProviderEndpoint(provider);
  const timeoutMs = Number(options.timeoutMs || 600000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: buildProviderHeaders(provider),
      body: JSON.stringify({
        model: provider.modelName,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
      signal: controller.signal,
    });
    const responseText = await response.text();
    let data = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { raw: responseText };
    }
    if (!response.ok) {
      const message = data?.error?.message || data?.message || response.statusText || "model_request_failed";
      throw new AppError(`model request failed: ${message}`, 400, { attemptedEndpoint: endpoint, status: response.status });
    }
    const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
    const content = extractCompletionContent(data);
    if (!content) throw new AppError("model request failed: empty content", 400, { attemptedEndpoint: endpoint, status: response.status });
    return {
      content,
      raw: {
        checkedEndpoint: endpoint,
        adapted: false,
        finishReason: choice?.finish_reason || choice?.finishReason || null,
        usage: data?.usage || null,
      },
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new AppError("model request failed: timeout", 400, { attemptedEndpoint: endpoint, timeoutMs });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function mapProject(row, rounds = []) {
  const defaults = defaultConfig();
  return {
    id: Number(row.id),
    incubationName: row.incubationName,
    incubationCode: row.incubationCode,
    industryCode: row.industryCode,
    enhancementProfileId: row.enhancementProfileId ? Number(row.enhancementProfileId) : null,
    enhancementProfileName: row.enhancementProfileName || null,
    incubationDesc: row.incubationDesc || null,
    status: row.status,
    languagePolicy: safeJson(row.languagePolicy, defaults.languagePolicy),
    autoResearchPolicy: safeJson(row.autoResearchPolicy, defaults.autoResearchPolicy),
    modelCommittee: safeJson(row.modelCommittee, defaults.modelCommittee),
    scenarioPool: safeJson(row.scenarioPool, defaults.scenarioPool),
    scenarioCoverage: safeJson(row.scenarioCoverage, defaults.scenarioCoverage),
    evidenceCatalog: safeJson(row.evidenceCatalog, defaults.evidenceCatalog),
    standardAssets: safeJson(row.standardAssets, defaults.standardAssets),
    publicDataProfiles: safeJson(row.publicDataProfiles, {}),
    trainingSettings: normalizeTrainingSettings(row.trainingSettings),
    evaluationRubric: safeJson(row.evaluationRubric, {}),
    overridePolicies: safeJson(row.overridePolicies, {}),
    latestRoundNo: Number(row.latestRoundNo || 0),
    lastSyncedAt: row.lastSyncedAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    rounds,
  };
}

function hasOwnPayloadField(payload, key) {
  return Object.prototype.hasOwnProperty.call(payload || {}, key);
}

function mergeIncubationPayloadForUpdate(existing, payload) {
  const merged = { ...(payload || {}) };
  const fieldMap = {
    incubationName: existing.incubationName,
    incubationCode: existing.incubationCode,
    industryCode: existing.industryCode,
    enhancementProfileId: existing.enhancementProfileId,
    incubationDesc: existing.incubationDesc,
    status: existing.status,
    languagePolicy: existing.languagePolicy,
    autoResearchPolicy: existing.autoResearchPolicy,
    modelCommittee: existing.modelCommittee,
    scenarioPool: existing.scenarioPool,
    scenarioCoverage: existing.scenarioCoverage,
    evidenceCatalog: existing.evidenceCatalog,
    standardAssets: existing.standardAssets,
    publicDataProfiles: existing.publicDataProfiles,
    trainingSettings: existing.trainingSettings,
    evaluationRubric: existing.evaluationRubric,
    overridePolicies: existing.overridePolicies,
  };
  const shallowMergeKeys = new Set([
    "languagePolicy",
    "autoResearchPolicy",
    "modelCommittee",
    "scenarioPool",
    "scenarioCoverage",
    "evidenceCatalog",
    "standardAssets",
    "publicDataProfiles",
    "trainingSettings",
    "evaluationRubric",
    "overridePolicies",
  ]);
  Object.entries(fieldMap).forEach(([key, value]) => {
    if (!hasOwnPayloadField(payload, key)) {
      merged[key] = value;
      return;
    }
    if (
      shallowMergeKeys.has(key)
      && value
      && typeof value === "object"
      && merged[key]
      && typeof merged[key] === "object"
      && !Array.isArray(value)
      && !Array.isArray(merged[key])
    ) {
      merged[key] = {
        ...value,
        ...merged[key],
      };
      if (key === "trainingSettings") {
        merged[key].runState = {
          ...(value.runState && typeof value.runState === "object" ? value.runState : {}),
          ...(merged[key].runState && typeof merged[key].runState === "object" ? merged[key].runState : {}),
        };
      }
    }
  });
  return merged;
}

async function appendLog(incubationId, payload = {}) {
  await pool.query(
    "INSERT INTO lab_industry_incubation_log (incubation_id, round_no, log_level, log_type, step_key, message, request_payload_json, response_payload_json, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      Number(incubationId),
      payload.roundNo ? Number(payload.roundNo) : null,
      payload.logLevel || "info",
      payload.logType || "run",
      payload.stepKey || "unknown",
      text(payload.message || payload.stepKey || "log", 500),
      JSON.stringify(payload.requestPayload || null),
      JSON.stringify(payload.responsePayload || null),
      JSON.stringify(payload.detail || null),
    ]
  );
}

async function getBase(id) {
  const scoped = getScopedWhere("p");
  const [rows] = await pool.query(
    `SELECT p.id, p.incubation_name AS incubationName, p.incubation_code AS incubationCode, p.industry_code AS industryCode, p.enhancement_profile_id AS enhancementProfileId, profile.profile_name AS enhancementProfileName, p.incubation_desc AS incubationDesc, p.status, p.language_policy_json AS languagePolicy, p.auto_research_policy_json AS autoResearchPolicy, p.model_committee_json AS modelCommittee, p.scenario_pool_json AS scenarioPool, p.scenario_coverage_json AS scenarioCoverage, p.evidence_catalog_json AS evidenceCatalog, p.standard_assets_json AS standardAssets, p.public_data_profiles_json AS publicDataProfiles, p.training_settings_json AS trainingSettings, p.evaluation_rubric_json AS evaluationRubric, p.override_policies_json AS overridePolicies, p.latest_round_no AS latestRoundNo, p.last_synced_at AS lastSyncedAt, p.created_by AS createdBy, p.created_at AS createdAt, p.updated_at AS updatedAt FROM lab_industry_incubation p LEFT JOIN lab_scenario_profile profile ON profile.id = p.enhancement_profile_id WHERE p.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""} LIMIT 1`,
    [Number(id), ...scoped.params]
  );
  const row = rows[0];
  if (!row) throw new AppError("incubation not found", 404);
  return row;
}

async function listRounds(incubationId) {
  const [rows] = await pool.query(
    "SELECT id, incubation_id AS incubationId, round_no AS roundNo, round_name AS roundName, round_status AS roundStatus, selected_scenarios_json AS selectedScenarios, evidence_snapshot_json AS evidenceSnapshot, committee_snapshot_json AS committeeSnapshot, result_summary_json AS resultSummary, enhancement_delta_json AS enhancementDelta, started_at AS startedAt, ended_at AS endedAt, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt FROM lab_industry_incubation_round WHERE incubation_id = ? ORDER BY round_no DESC, id DESC",
    [Number(incubationId)]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    incubationId: Number(row.incubationId),
    roundNo: Number(row.roundNo),
    roundName: row.roundName,
    roundStatus: row.roundStatus,
    selectedScenarios: safeJson(row.selectedScenarios, []),
    evidenceSnapshot: safeJson(row.evidenceSnapshot, []),
    committeeSnapshot: safeJson(row.committeeSnapshot, {}),
    resultSummary: safeJson(row.resultSummary, {}),
    enhancementDelta: safeJson(row.enhancementDelta, {}),
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

async function listIndustryIncubations() {
  const scoped = getScopedWhere("p");
  const [rows] = await pool.query(
    `SELECT p.id, p.incubation_name AS incubationName, p.incubation_code AS incubationCode, p.industry_code AS industryCode, p.enhancement_profile_id AS enhancementProfileId, profile.profile_name AS enhancementProfileName, p.incubation_desc AS incubationDesc, p.status, p.language_policy_json AS languagePolicy, p.auto_research_policy_json AS autoResearchPolicy, p.model_committee_json AS modelCommittee, p.scenario_pool_json AS scenarioPool, p.scenario_coverage_json AS scenarioCoverage, p.evidence_catalog_json AS evidenceCatalog, p.standard_assets_json AS standardAssets, p.public_data_profiles_json AS publicDataProfiles, p.training_settings_json AS trainingSettings, p.evaluation_rubric_json AS evaluationRubric, p.override_policies_json AS overridePolicies, p.latest_round_no AS latestRoundNo, p.last_synced_at AS lastSyncedAt, p.created_by AS createdBy, p.created_at AS createdAt, p.updated_at AS updatedAt FROM lab_industry_incubation p LEFT JOIN lab_scenario_profile profile ON profile.id = p.enhancement_profile_id ${scoped.sql ? `WHERE ${scoped.sql}` : ""} ORDER BY p.id ASC`,
    scoped.params
  );
  return rows.map((row) => mapProject(row));
}

async function getIndustryIncubationDetail(id) {
  return mapProject(await getBase(id), await listRounds(id));
}

async function listIndustryIncubationLogs(id) {
  const [rows] = await pool.query("SELECT id, incubation_id AS incubationId, round_no AS roundNo, log_level AS logLevel, log_type AS logType, step_key AS stepKey, message, request_payload_json AS requestPayload, response_payload_json AS responsePayload, detail_json AS detail, created_at AS createdAt FROM lab_industry_incubation_log WHERE incubation_id = ? ORDER BY id DESC LIMIT 500", [Number(id)]);
  return rows.map((row) => ({
    id: Number(row.id),
    incubationId: Number(row.incubationId),
    roundNo: row.roundNo == null ? null : Number(row.roundNo),
    logLevel: row.logLevel,
    logType: row.logType,
    stepKey: row.stepKey,
    message: row.message,
    requestPayload: safeJson(row.requestPayload, null),
    responsePayload: safeJson(row.responsePayload, null),
    detail: safeJson(row.detail, null),
    createdAt: row.createdAt,
  }));
}

async function getIndustryIncubationStats(id) {
  const detail = await getIndustryIncubationDetail(id);
  const categories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
  const dictionaries = Array.isArray(detail?.standardAssets?.dictionaries) ? detail.standardAssets.dictionaries : [];
  return {
    incubationId: detail.id,
    incubationName: detail.incubationName,
    totals: {
      categoryCount: categories.length,
      tableCount: categories.reduce((sum, item) => sum + (Array.isArray(item?.tableDetails) ? item.tableDetails.length : 0), 0),
      dictionaryGroupCount: dictionaries.length,
      dictionaryItemCount: dictionaries.reduce((sum, item) => sum + (Array.isArray(item?.items) ? item.items.length : 0), 0),
      publicDictionaryGroupCount: 0,
      publicDictionaryItemCount: 0,
    },
    categories: categories.map((category) => ({
      categoryCode: String(category?.categoryCode || ""),
      categoryName: String(category?.categoryName || category?.categoryCode || ""),
      tableCount: Array.isArray(category?.tableDetails) ? category.tableDetails.length : 0,
      dictionaryGroupCount: dictionaries.filter((item) => String(item?.categoryCode || "") === String(category?.categoryCode || "")).length,
      dictionaryItemCount: dictionaries.filter((item) => String(item?.categoryCode || "") === String(category?.categoryCode || "")).reduce((sum, item) => sum + (Array.isArray(item?.items) ? item.items.length : 0), 0),
      evidenceCount: Array.isArray(category?.evidenceRefs) ? category.evidenceRefs.length : 0,
      lastRoundNo: Number(detail.latestRoundNo || 0),
    })),
    publicDictionaries: [],
  };
}

async function saveIndustryIncubation(payload, user) {
  const projectId = getCurrentProjectId();
  if (payload.id) {
    payload = mergeIncubationPayloadForUpdate(mapProject(await getBase(Number(payload.id))), payload);
  }
  const defaults = defaultConfig();
  const normalized = {
    id: payload.id ? Number(payload.id) : null,
    incubationName: text(payload.incubationName, 128),
    incubationCode: normalizeCode(payload.incubationCode || payload.incubationName, "industry_incubation"),
    industryCode: text(payload.industryCode, 32) || String(Math.floor(10000000 + Math.random() * 90000000)),
    enhancementProfileId: payload.enhancementProfileId ? Number(payload.enhancementProfileId) : null,
    incubationDesc: text(payload.incubationDesc, 1024) || null,
    status: text(payload.status || "draft", 16) || "draft",
    languagePolicy: payload.languagePolicy || defaults.languagePolicy,
    autoResearchPolicy: payload.autoResearchPolicy || defaults.autoResearchPolicy,
    modelCommittee: payload.modelCommittee || defaults.modelCommittee,
    scenarioPool: payload.scenarioPool || defaults.scenarioPool,
    scenarioCoverage: payload.scenarioCoverage || defaults.scenarioCoverage,
    evidenceCatalog: payload.evidenceCatalog || defaults.evidenceCatalog,
    standardAssets: payload.standardAssets || defaults.standardAssets,
    publicDataProfiles: payload.publicDataProfiles || {},
    trainingSettings: normalizeTrainingSettings(payload.trainingSettings),
    evaluationRubric: payload.evaluationRubric || {},
    overridePolicies: payload.overridePolicies || {},
  };
  if (!normalized.incubationName) throw new AppError("incubationName is required", 400);
  if (normalized.id) {
    const scoped = getScopedWhere("");
    await pool.query(
      `UPDATE lab_industry_incubation SET incubation_name = ?, incubation_code = ?, industry_code = ?, enhancement_profile_id = ?, incubation_desc = ?, status = ?, language_policy_json = ?, auto_research_policy_json = ?, model_committee_json = ?, scenario_pool_json = ?, scenario_coverage_json = ?, evidence_catalog_json = ?, standard_assets_json = ?, public_data_profiles_json = ?, training_settings_json = ?, evaluation_rubric_json = ?, override_policies_json = ? WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [normalized.incubationName, normalized.incubationCode, normalized.industryCode, normalized.enhancementProfileId, normalized.incubationDesc, normalized.status, JSON.stringify(normalized.languagePolicy), JSON.stringify(normalized.autoResearchPolicy), JSON.stringify(normalized.modelCommittee), JSON.stringify(normalized.scenarioPool), JSON.stringify(normalized.scenarioCoverage), JSON.stringify(normalized.evidenceCatalog), JSON.stringify(normalized.standardAssets), JSON.stringify(normalized.publicDataProfiles), JSON.stringify(normalized.trainingSettings), JSON.stringify(normalized.evaluationRubric), JSON.stringify(normalized.overridePolicies), normalized.id, ...scoped.params]
    );
    return getIndustryIncubationDetail(normalized.id);
  }
  const [result] = await pool.query(
    "INSERT INTO lab_industry_incubation (project_id, incubation_name, incubation_code, industry_code, enhancement_profile_id, incubation_desc, status, language_policy_json, auto_research_policy_json, model_committee_json, scenario_pool_json, scenario_coverage_json, evidence_catalog_json, standard_assets_json, public_data_profiles_json, training_settings_json, evaluation_rubric_json, override_policies_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [projectId, normalized.incubationName, normalized.incubationCode, normalized.industryCode, normalized.enhancementProfileId, normalized.incubationDesc, normalized.status, JSON.stringify(normalized.languagePolicy), JSON.stringify(normalized.autoResearchPolicy), JSON.stringify(normalized.modelCommittee), JSON.stringify(normalized.scenarioPool), JSON.stringify(normalized.scenarioCoverage), JSON.stringify(normalized.evidenceCatalog), JSON.stringify(normalized.standardAssets), JSON.stringify(normalized.publicDataProfiles), JSON.stringify(normalized.trainingSettings), JSON.stringify(normalized.evaluationRubric), JSON.stringify(normalized.overridePolicies), user?.displayName || user?.username || "system"]
  );
  return getIndustryIncubationDetail(result.insertId);
}

async function deleteKnowledgeBasesByTags(requiredTags = []) {
  const tags = uniq(requiredTags, 16);
  if (!tags.length) return [];
  const [rows] = await pool.query("SELECT id, tags_json AS tagsJson FROM system_knowledge_base ORDER BY id ASC");
  const matchedIds = rows
    .filter((row) => {
      const rowTags = safeJson(row.tagsJson, []);
      return tags.every((tag) => Array.isArray(rowTags) && rowTags.includes(tag));
    })
    .map((row) => Number(row.id))
    .filter(Boolean);
  if (!matchedIds.length) return [];
  const agentPlatformService = require("../system-knowledge-base/system-knowledge-base.service");
  for (const id of matchedIds) await agentPlatformService.deleteKnowledgeBase(id);
  return matchedIds;
}

async function deleteIndustryIncubation(id) {
  await getBase(id);
  await deleteKnowledgeBasesByTags([`incubation:${Number(id)}`]);
  const scoped = getScopedWhere("");
  await pool.query(`DELETE FROM lab_industry_incubation WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`, [Number(id), ...scoped.params]);
  return { id: Number(id) };
}

function buildPromptDefaults() {
  return {
    systemPrompt: [
      "You are an industry incubation metadata extractor for Chinese domestic business domains.",
      "Return one valid JSON object only.",
      "Industry mode: create exactly one new category and do not duplicate existing category code or name.",
      "Category mode: deepen only the selected category and add at least one new business table together with more dictionaries or dictionary items.",
      "Prefer Chinese business semantics in labels and comments, but keep identifiers in snake_case.",
      "Do not use markdown.",
    ].join(" "),
    userPrompt: "{{input}}",
    temperature: 0.2,
    maxTokens: 4000,
  };
}

function buildCategoryEnhancePromptDefaults() {
  return {
    systemPrompt: [
      "You are a metadata extractor for deepening one Chinese domestic industry category.",
      "Return one valid JSON object only.",
      "You must focus only on the selected target category.",
      "Compared with the existing target category content, this run must add at least one NEW business table.",
      "You should also add more dictionary tables, dictionary items, and evidence references where appropriate.",
      "Do not rewrite the old category without increments.",
      "Do not use markdown.",
    ].join(" "),
    userPrompt: "{{input}}",
    temperature: 0.2,
    maxTokens: 4000,
  };
}

function stringifyReferenceList(values = [], emptyText = "未配置") {
  const items = uniq(values, 12);
  return items.length > 0 ? items.join("、") : emptyText;
}

function buildEvidenceReferenceText(detail, options = {}) {
  const existingCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
  const targetCategory = existingCategories.find((item) =>
    (options.targetCategoryCode && String(item?.categoryCode || "").trim() === String(options.targetCategoryCode).trim())
    || (options.targetCategoryName && String(item?.categoryName || "").trim() === String(options.targetCategoryName).trim()))
    || null;
  const sourceTypes = uniq(Array.isArray(detail?.autoResearchPolicy?.sourceTypes) ? detail.autoResearchPolicy.sourceTypes : [], 12);
  const preferredDomains = uniq([
    ...(Array.isArray(detail?.autoResearchPolicy?.preferredDomains) ? detail.autoResearchPolicy.preferredDomains : []),
    ...(Array.isArray(detail?.languagePolicy?.sourceDomainWhitelist) ? detail.languagePolicy.sourceDomainWhitelist : []),
  ], 12);
  const requiredKeywords = uniq(detail?.autoResearchPolicy?.requiredKeywords || [], 12);
  const referenceLines = [
    "以下内容仅作为证据来源参考与检索提示，用于帮助理解本次行业孵化任务的业务背景、优先关注方向和候选资料范围，不属于程序硬性过滤条件，也不要求证据采集必须完全命中这些条件。",
    `行业名称：${detail?.incubationName || "-" }。`,
    `行业编码：${detail?.industryCode || "-" }。`,
    `行业说明：${text(detail?.incubationDesc || "", 240) || "未填写"}。`,
  ];

  if (targetCategory) {
    referenceLines.push(`当前目标子类目：${targetCategory.categoryName || targetCategory.categoryCode || "-"}。`);
  }

  referenceLines.push(
    `“仅抓取国内证据”配置当前为：${detail?.languagePolicy?.domesticOnly !== false && detail?.autoResearchPolicy?.domesticOnly !== false ? "开启" : "关闭"}，这里只表示证据倾向，不构成程序必须遵守的筛选门槛。`,
    `“优先标准与法规”配置当前为：${detail?.autoResearchPolicy?.standardFirst !== false ? "开启" : "关闭"}，这里只表示证据优先级参考，不构成程序必须遵守的筛选门槛。`,
    `可参考的证据来源类型：${stringifyReferenceList(sourceTypes)}。`,
    `可优先关注的来源域名：${stringifyReferenceList(preferredDomains)}。`,
    `检索时可结合的业务关键词：${stringifyReferenceList(requiredKeywords)}。`,
    "如外部公开资料不足，可以结合现有类目、表结构、字典信息和行业常识做合理补全，但输出内容仍需保持中国业务语境、语义完整、结构稳定、字段命名清晰。"
  );
  return referenceLines.join("");
}

function buildEffectiveResearchConfig(detail, options = {}) {
  const mode = options.mode === "category" ? "category" : "industry";
  const existingCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
  const targetCategory = existingCategories.find((item) =>
    (options.targetCategoryCode && String(item?.categoryCode || "").trim() === String(options.targetCategoryCode).trim())
    || (options.targetCategoryName && String(item?.categoryName || "").trim() === String(options.targetCategoryName).trim()))
    || null;
  const existingDictionaries = Array.isArray(detail?.standardAssets?.dictionaries) ? detail.standardAssets.dictionaries : [];
  const targetCategoryDictionaryItems = targetCategory
    ? existingDictionaries.filter((item) => String(item?.categoryCode || "").trim() === String(targetCategory.categoryCode || "").trim())
    : [];
  const gapProfile = targetCategory ? buildGenericGapProfile(targetCategory, targetCategoryDictionaryItems) : null;
  const configuredRequiredKeywords = uniq(detail?.autoResearchPolicy?.requiredKeywords || [], 12);
  const preferredDomains = uniq([
    ...(Array.isArray(detail?.autoResearchPolicy?.preferredDomains) ? detail.autoResearchPolicy.preferredDomains : []),
    ...(Array.isArray(detail?.languagePolicy?.sourceDomainWhitelist) ? detail.languagePolicy.sourceDomainWhitelist : []),
  ], 12);
  const requiredKeywords = uniq([
    detail?.incubationName,
    detail?.incubationDesc,
    detail?.industryCode,
    targetCategory?.categoryName,
    targetCategory?.description,
    ...configuredRequiredKeywords,
  ], 16);
  return {
    mode,
    targetCategory,
    gapProfile,
    configuredRequiredKeywords,
    evidenceReferenceText: buildEvidenceReferenceText(detail, options),
    effectivePolicy: {
      domesticOnly: detail?.languagePolicy?.domesticOnly !== false && detail?.autoResearchPolicy?.domesticOnly !== false,
      standardFirst: detail?.autoResearchPolicy?.standardFirst !== false,
      sourceTypes: uniq(Array.isArray(detail?.autoResearchPolicy?.sourceTypes) ? detail.autoResearchPolicy.sourceTypes : [], 12),
      preferredDomains,
      requiredKeywords,
      limit: mode === "category" ? 8 : 12,
    },
  };
}

function buildIndustryPromptText(promptInput) {
  const evidenceItems = Array.isArray(promptInput?.evidenceItems) ? promptInput.evidenceItems : [];
  const compactPromptInput = {
    mode: promptInput?.mode || "industry",
    incubationName: promptInput?.incubationName || "",
    incubationDesc: promptInput?.incubationDesc || "",
    industryCode: promptInput?.industryCode || "",
    targetCategoryCode: promptInput?.targetCategoryCode || null,
    targetCategoryName: promptInput?.targetCategoryName || null,
    policyConfig: promptInput?.policyConfig || {},
    evidenceReferenceText: promptInput?.evidenceReferenceText || "",
    targetCategory: promptInput?.targetCategory
      ? {
          categoryCode: promptInput.targetCategory.categoryCode || null,
          categoryName: promptInput.targetCategory.categoryName || null,
          description: text(promptInput.targetCategory.description || "", 160),
          tableDetails: (Array.isArray(promptInput.targetCategory.tableDetails) ? promptInput.targetCategory.tableDetails : []).slice(0, 6).map((item) => ({
            tableName: item?.tableName || "",
            tableLabel: item?.tableLabel || "",
            tableComment: text(item?.tableComment || "", 160),
            fields: Array.isArray(item?.fields) ? item.fields.slice(0, 16) : [],
            keyInfoItems: Array.isArray(item?.keyInfoItems) ? item.keyInfoItems.slice(0, 8) : [],
          })),
        }
      : null,
    existingCategories: (Array.isArray(promptInput?.existingCategories) ? promptInput.existingCategories : []).slice(0, 8),
    existingDictionaryItems: (Array.isArray(promptInput?.existingDictionaryItems) ? promptInput.existingDictionaryItems : []).slice(0, 8),
    gapProfile: promptInput?.gapProfile || null,
    evidenceItems: evidenceItems.slice(0, 8).map((item) => ({
      id: item?.id || null,
      title: text(item?.title || "", 120),
      authority: text(item?.authority || "", 80),
      sourceUrl: item?.sourceUrl || "",
      sourceType: item?.sourceType || null,
      publishedAt: item?.publishedAt || null,
      summary: text(item?.summary || "", 120),
    })),
  };
  const lines = [
    promptInput?.mode === "category"
      ? "请基于以下子类目增量深挖配置与证据做抽取，并严格按系统提示词输出。"
      : "请基于以下行业孵化配置与证据做全量抽取，并严格按系统提示词输出。",
    "",
    "一、任务上下文",
    JSON.stringify({
      mode: promptInput?.mode || "industry",
      incubationName: promptInput?.incubationName || "",
      incubationDesc: promptInput?.incubationDesc || "",
      industryCode: promptInput?.industryCode || "",
      targetCategoryCode: promptInput?.targetCategoryCode || null,
      targetCategoryName: promptInput?.targetCategoryName || null,
    }, null, 2),
    "",
    "二、证据来源参考",
    promptInput?.evidenceReferenceText || "未提供额外证据来源参考。",
  ];

  if (promptInput?.targetCategory) {
    lines.push("", "三、目标子类目现状", JSON.stringify(promptInput.targetCategory, null, 2));
  }

  if (Array.isArray(promptInput?.existingCategories) && promptInput.existingCategories.length > 0) {
    lines.push("", "四、已有类目快照", JSON.stringify(promptInput.existingCategories, null, 2));
  }

  if (Array.isArray(promptInput?.existingDictionaryItems) && promptInput.existingDictionaryItems.length > 0) {
    lines.push("", "五、已有字典快照", JSON.stringify(promptInput.existingDictionaryItems, null, 2));
  }

  if (promptInput?.gapProfile) {
    lines.push("", "六、差距画像", JSON.stringify(promptInput.gapProfile, null, 2));
  }

  lines.push(
    "",
    "七、证据清单",
    evidenceItems.length > 0
      ? evidenceItems.map((item, index) => (
        `${index + 1}. [${item.id || `evidence_${index + 1}`}] ${item.title || "-"}`
        + ` | 机构: ${item.authority || "-"}`
        + ` | 链接: ${item.sourceUrl || "-"}`
        + ` | 摘要: ${item.summary || "-"}`
      )).join("\n")
      : "无",
    "",
    "八、结构化输入 JSON",
    JSON.stringify(compactPromptInput, null, 2)
  );

  return lines.join("\n");
}

function buildPromptInput(detail, evidenceItems, options = {}) {
  const {
    mode,
    targetCategory,
    gapProfile,
    configuredRequiredKeywords,
    effectivePolicy,
    evidenceReferenceText,
  } = buildEffectiveResearchConfig(detail, options);
  const existingCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
  const existingDictionaries = Array.isArray(detail?.standardAssets?.dictionaries) ? detail.standardAssets.dictionaries : [];
  const targetCategoryDictionaryItems = targetCategory
    ? existingDictionaries.filter((item) => String(item?.categoryCode || "").trim() === String(targetCategory.categoryCode || "").trim())
    : [];
  const buildCategoryPromptCategorySnapshot = (category = {}) => ({
    categoryCode: category.categoryCode || null,
    categoryName: category.categoryName || null,
    description: category.description || "",
    tableScopes: Array.isArray(category.tableScopes) ? category.tableScopes : [],
  });
  const buildCategoryPromptTargetSnapshot = (category = {}) => ({
    ...buildCategoryPromptCategorySnapshot(category),
    tableDetails: (Array.isArray(category.tableDetails) ? category.tableDetails : []).map((item) => buildPromptTableSnapshot(item)),
  });
  const buildIndustryPromptCategorySnapshot = (category = {}) => ({
    categoryCode: category.categoryCode || null,
    categoryName: category.categoryName || null,
    description: category.description || "",
  });
  const buildDictionaryGroupPromptSnapshot = (group = {}) => ({
    dictType: group.dictType || null,
    dictName: group.dictName || null,
    itemCount: Array.isArray(group.items) ? group.items.length : 0,
    sampleItems: (Array.isArray(group.items) ? group.items : []).slice(0, 5).map((item) => ({
      itemCode: item?.itemCode || null,
      itemLabel: item?.itemLabel || null,
      valueRange: item?.valueRange || null,
    })),
    sourceRefs: Array.isArray(group.sourceRefs) ? group.sourceRefs : [],
  });
  const scopedExistingCategories = mode === "category"
    ? []
    : existingCategories.map((item) => buildIndustryPromptCategorySnapshot(item));
  const scopedExistingDictionaries = mode === "category"
    ? []
    : [];
  const scopedExistingDictionaryItems = mode === "category"
    ? targetCategoryDictionaryItems.map((item) => buildDictionaryGroupPromptSnapshot(item))
    : [];
  return {
    mode,
    incubationName: detail.incubationName,
    incubationDesc: detail.incubationDesc || "",
    industryCode: detail.industryCode,
    evidenceReferenceText,
    policyConfig: {
      languagePolicy: {
        locale: detail?.languagePolicy?.locale || "zh-CN",
        domesticOnly: detail?.languagePolicy?.domesticOnly !== false,
        requiredChineseLabels: detail?.languagePolicy?.requiredChineseLabels !== false,
        sourceDomainWhitelist: uniq(Array.isArray(detail?.languagePolicy?.sourceDomainWhitelist) ? detail.languagePolicy.sourceDomainWhitelist : [], 12),
      },
      autoResearchPolicy: {
        domesticOnly: detail?.autoResearchPolicy?.domesticOnly !== false,
        standardFirst: detail?.autoResearchPolicy?.standardFirst !== false,
        sourceTypes: effectivePolicy.sourceTypes,
        preferredDomains: effectivePolicy.preferredDomains,
        requiredKeywords: configuredRequiredKeywords,
      },
      evidenceSourceReferenceText: evidenceReferenceText,
    },
    targetCategoryCode: targetCategory?.categoryCode || options.targetCategoryCode || null,
    targetCategoryName: targetCategory?.categoryName || options.targetCategoryName || null,
    targetCategory: targetCategory ? buildCategoryPromptTargetSnapshot(targetCategory) : null,
    existingCategories: scopedExistingCategories.map((item) => ({
      categoryCode: item.categoryCode,
      categoryName: item.categoryName,
      description: item.description || "",
      ...(mode === "category"
        ? {
            tableDetails: Array.isArray(item.tableDetails) ? item.tableDetails : [],
            evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [],
          }
        : {}),
    })),
    existingDictionaries: scopedExistingDictionaries,
    existingDictionaryItems: scopedExistingDictionaryItems,
    gapProfile,
    evidenceItems: normalizeEvidenceItems(evidenceItems).map((item) => ({
      id: item.id,
      title: item.title,
      sourceUrl: item.sourceUrl,
      authority: item.authority,
      sourceType: item.sourceType || null,
      publishedAt: item.publishedAt || null,
      summary: item.summary,
    })),
  };
}

async function resolvePromptConfig(promptInput, promptText) {
  const promptType = promptInput.mode === "category" ? "INDUSTRY_CATEGORY_ENHANCE" : "INDUSTRY_METADATA";
  const defaults = promptInput.mode === "category" ? buildCategoryEnhancePromptDefaults() : buildPromptDefaults();
  const promptConfig = await promptRuntime.resolveRuntimePromptConfig(promptType, defaults, {
    ...promptInput,
    input: promptText || promptInput,
    promptInput,
    promptText: promptText || "",
  });
  if (!promptConfig.provider) throw new AppError("industry metadata prompt is not bound to a provider", 400);
  return promptConfig;
}

async function collectEvidence(detail, options = {}) {
  const { mode, targetCategory, gapProfile, effectivePolicy } = buildEffectiveResearchConfig(detail, options);
  const evidenceItems = await internetResearch.collectDomesticEvidence({
    mode,
    industryCode: detail.industryCode,
    industryLabel: detail.incubationName || detail.industryCode,
    sceneName: targetCategory?.categoryName || detail.incubationName || detail.industryCode,
    subScenario: [detail.incubationDesc, targetCategory?.description].filter(Boolean).join(" / "),
    requiredKeywords: effectivePolicy.requiredKeywords,
    gapKeywords: gapProfile?.gapKeywords || [],
    plannedQueries: [],
    sourceTypes: effectivePolicy.sourceTypes,
    preferredDomains: [],
    limit: effectivePolicy.limit,
    domesticOnly: true,
  });
  const normalized = normalizeEvidenceItems(evidenceItems);
  if (normalized.some((item) => !item.sourceUrl)) throw new AppError("evidence contains empty sourceUrl", 400);
  return normalized;
}

function normalizeGeneratedMetadata(parsed, detail, evidenceItems, options = {}) {
  const root = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
  const increments = root?.increments && typeof root.increments === "object" ? root.increments : {};
  const mode = options.mode === "category" ? "category" : "industry";
  const existingCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
  const targetCategory = existingCategories.find((item) =>
    (options.targetCategoryCode && String(item?.categoryCode || "").trim() === String(options.targetCategoryCode).trim())
    || (options.targetCategoryName && String(item?.categoryName || "").trim() === String(options.targetCategoryName).trim()))
    || null;
  const topLevelTableDetails = Array.isArray(root?.tableDetails)
    ? root.tableDetails
    : Array.isArray(root?.table_details)
      ? root.table_details
      : Array.isArray(root?.newTables)
        ? root.newTables
        : Array.isArray(root?.new_tables)
          ? root.new_tables
      : Array.isArray(root?.tableDetailsIncrement)
        ? root.tableDetailsIncrement
        : Array.isArray(root?.table_details_increment)
          ? root.table_details_increment
          : Array.isArray(root?.newTableDetails)
            ? root.newTableDetails
            : Array.isArray(root?.new_table_details)
              ? root.new_table_details
              : Array.isArray(increments?.newTables)
                ? increments.newTables
                : Array.isArray(increments?.new_tables)
                  ? increments.new_tables
                  : [];
  const topLevelCategory = (root?.categoryCode || root?.category_code || root?.categoryName || root?.category_name || topLevelTableDetails.length > 0)
    ? {
        categoryCode: root?.categoryCode || root?.category_code || targetCategory?.categoryCode || options.targetCategoryCode,
        categoryName: root?.categoryName || root?.category_name || targetCategory?.categoryName || options.targetCategoryName,
        description: root?.description || root?.desc || targetCategory?.description || root?.summary || "",
        tableDetails: topLevelTableDetails,
        sourceRefs: root?.sourceRefs || root?.source_refs || [],
        evidenceRefs: root?.evidenceRefs || root?.evidence_refs || [],
        continueIteration: root?.continueIteration,
      }
    : null;
  let categories = (Array.isArray(root?.categories) ? root.categories : (topLevelCategory ? [topLevelCategory] : [])).map((item) => normalizeCategory(item));
  const rawCandidateTableSpecs = Array.isArray(root?.candidateTableSpecs)
    ? root.candidateTableSpecs
    : Array.isArray(root?.candidate_table_specs)
      ? root.candidate_table_specs
      : topLevelTableDetails;
  const candidateTableSpecs = rawCandidateTableSpecs.map((item) => normalizeTable(item));
  if (mode === "industry") categories = categories.slice(0, 1);
  if (mode === "category") {
    const fallbackCategory = normalizeCategory({
      categoryCode: targetCategory?.categoryCode || options.targetCategoryCode,
      categoryName: targetCategory?.categoryName || options.targetCategoryName,
      description: targetCategory?.description || root?.summary || "",
      tableDetails: candidateTableSpecs,
    }, targetCategory || {});
    categories = categories.length > 0 ? categories.slice(0, 1) : [fallbackCategory];
    categories = categories.map((item) => mergeCategory(item, {
      categoryCode: item.categoryCode,
      categoryName: item.categoryName,
      description: item.description,
      tableDetails: candidateTableSpecs,
      sourceRefs: item.sourceRefs || [],
      evidenceRefs: item.evidenceRefs || [],
      continueIteration: item.continueIteration,
    }));
  }
  categories = categories.map((item) => {
    const categoryRefs = uniq([
      ...(Array.isArray(item.evidenceRefs) ? item.evidenceRefs : []),
      ...(Array.isArray(item.sourceRefs) ? item.sourceRefs : []),
      ...evidenceItems.map((entry) => entry.id),
    ], 32);
    const normalizedTables = (Array.isArray(item.tableDetails) ? item.tableDetails : []).map((table) => {
      const normalizedTable = normalizeTable(table);
      return {
        ...normalizedTable,
        sourceRefs: pickNonEmptyRefs(normalizedTable.sourceRefs, categoryRefs),
      };
    });
    return {
      ...item,
      evidenceRefs: categoryRefs,
      sourceRefs: categoryRefs,
      tableDetails: normalizedTables,
      tableScopes: normalizedTables.map((table) => table.tableName),
    };
  });
  const rootDictionaries = Array.isArray(root?.dictionaries) ? root.dictionaries : [];
  const rootDictionaryIncrements = Array.isArray(root?.dictionaryIncrements)
    ? root.dictionaryIncrements
    : Array.isArray(root?.dictionary_increments)
      ? root.dictionary_increments
      : [];
  const rootNewDictionaries = Array.isArray(root?.newDictionaries)
    ? root.newDictionaries
    : Array.isArray(root?.new_dictionaries)
      ? root.new_dictionaries
      : [];
  const rootDictionaryItemIncrements = Array.isArray(root?.dictionaryItemIncrements)
    ? root.dictionaryItemIncrements
    : Array.isArray(root?.dictionary_item_increments)
      ? root.dictionary_item_increments
      : [];
  const incrementNewDictionaries = Array.isArray(increments?.newDictionaries)
    ? increments.newDictionaries
    : Array.isArray(increments?.new_dictionaries)
      ? increments.new_dictionaries
      : [];
  const incrementDictionaryIncrements = Array.isArray(increments?.dictionaryIncrements)
    ? increments.dictionaryIncrements
    : Array.isArray(increments?.dictionary_increments)
      ? increments.dictionary_increments
      : [];
  const incrementDictionaryItemIncrements = Array.isArray(increments?.dictionaryItemIncrements)
    ? increments.dictionaryItemIncrements
    : Array.isArray(increments?.dictionary_item_increments)
      ? increments.dictionary_item_increments
      : [];
  const incrementDictionaryItemAdditions = Array.isArray(increments?.dictionaryItemAdditions)
    ? increments.dictionaryItemAdditions
    : Array.isArray(increments?.dictionary_item_additions)
      ? increments.dictionary_item_additions
      : [];
  const dictionaries = mergeByKey(
    [...rootDictionaries, ...rootDictionaryIncrements, ...rootNewDictionaries, ...incrementNewDictionaries, ...incrementDictionaryIncrements].map((item, index) => normalizeDictionary(item, index)).map((item) => ({
      ...item,
      categoryCode: item.categoryCode || categories[0]?.categoryCode || null,
    })),
    [...rootDictionaryItemIncrements, ...incrementDictionaryItemIncrements, ...incrementDictionaryItemAdditions].map((item, index) => normalizeDictionary(item, rootDictionaries.length + rootDictionaryIncrements.length + rootNewDictionaries.length + incrementNewDictionaries.length + incrementDictionaryIncrements.length + index)).map((item) => ({
      ...item,
      categoryCode: item.categoryCode || categories[0]?.categoryCode || null,
    })),
    (item) => `${String(item?.categoryCode || "").trim()}::${String(item?.dictType || item?.dictName || "").trim()}`
  ).map((item) => ({
    ...item,
    items: Array.isArray(item?.items) ? item.items : [],
  }));
  const extractionDiagnostics = summarizeExtractionDiagnostics(root, categories, dictionaries, candidateTableSpecs);
  return {
    summary: text(root?.summary || "industry metadata updated", 160),
    categories,
    dictionaries,
    candidateTableSpecs: candidateTableSpecs.length > 0 ? candidateTableSpecs : categories.flatMap((item) => item.tableDetails || []),
    extractionDiagnostics,
  };
}

function validateIndustryResult(detail, generated) {
  if (!generated.categories.length) throw new AppError("industry mode did not create a category", 400);
  const existingCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
  const existingCodes = new Set(existingCategories.map((item) => String(item?.categoryCode || "").trim()).filter(Boolean));
  const existingNames = new Set(existingCategories.map((item) => String(item?.categoryName || "").trim()).filter(Boolean));
  const category = generated.categories[0];
  if (existingCodes.has(String(category.categoryCode || "").trim()) || existingNames.has(String(category.categoryName || "").trim())) {
    throw new AppError("industry mode generated a duplicate category", 400);
  }
}

function validateCategoryIncrement(detail, mergedAssets, mergedEvidenceCatalog, targetCategoryCode) {
  const beforeCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
  const afterCategories = Array.isArray(mergedAssets?.researchCatalog?.categoryTree) ? mergedAssets.researchCatalog.categoryTree : [];
  const beforeCategory = beforeCategories.find((item) => String(item?.categoryCode || "").trim() === String(targetCategoryCode || "").trim()) || {};
  const afterCategory = afterCategories.find((item) => String(item?.categoryCode || "").trim() === String(targetCategoryCode || "").trim()) || {};
  const beforeTables = new Set((Array.isArray(beforeCategory?.tableDetails) ? beforeCategory.tableDetails : []).map((item) => String(item?.tableName || "").trim()).filter(Boolean));
  const afterTables = new Set((Array.isArray(afterCategory?.tableDetails) ? afterCategory.tableDetails : []).map((item) => String(item?.tableName || "").trim()).filter(Boolean));
  const beforeDictionaries = (Array.isArray(detail?.standardAssets?.dictionaries) ? detail.standardAssets.dictionaries : []).filter((item) => String(item?.categoryCode || "").trim() === String(targetCategoryCode || "").trim());
  const afterDictionaries = (Array.isArray(mergedAssets?.dictionaries) ? mergedAssets.dictionaries : []).filter((item) => String(item?.categoryCode || "").trim() === String(targetCategoryCode || "").trim());
  const beforeDicts = new Set(beforeDictionaries.map((item) => String(item?.dictType || item?.dictName || "").trim()).filter(Boolean));
  const afterDicts = new Set(afterDictionaries.map((item) => String(item?.dictType || item?.dictName || "").trim()).filter(Boolean));
  const beforeItems = new Set(beforeDictionaries.flatMap((item) => (Array.isArray(item?.items) ? item.items : []).map((entry) => `${item.dictType}:${entry.itemCode || entry.itemLabel}`)));
  const afterItems = new Set(afterDictionaries.flatMap((item) => (Array.isArray(item?.items) ? item.items : []).map((entry) => `${item.dictType}:${entry.itemCode || entry.itemLabel}`)));
  const beforeEvidence = new Set((Array.isArray(detail?.evidenceCatalog?.items) ? detail.evidenceCatalog.items : []).map((item) => String(item?.id || item?.sourceHash || item?.sourceUrl || "").trim()).filter(Boolean));
  const afterEvidence = new Set((Array.isArray(mergedEvidenceCatalog?.items) ? mergedEvidenceCatalog.items : []).map((item) => String(item?.id || item?.sourceHash || item?.sourceUrl || "").trim()).filter(Boolean));
  const beforeTableNames = Array.from(beforeTables);
  const afterTableNames = Array.from(afterTables);
  const newTableNames = afterTableNames.filter((item) => !beforeTables.has(item));
  const incrementSummary = {
    beforeTableNames,
    afterTableNames,
    newTableNames,
    newTableCount: newTableNames.length,
    newDictionaryCount: Array.from(afterDicts).filter((item) => !beforeDicts.has(item)).length,
    newDictionaryItemCount: Array.from(afterItems).filter((item) => !beforeItems.has(item)).length,
    newEvidenceCount: Array.from(afterEvidence).filter((item) => !beforeEvidence.has(item)).length,
  };
  if (incrementSummary.newTableCount < 1) {
    throw new AppError("category mode did not add a new table", 400, {
      targetCategoryCode: String(targetCategoryCode || "").trim() || null,
      beforeTableNames,
      afterTableNames,
      newTableNames,
      beforeDictionaryTypes: Array.from(beforeDicts),
      afterDictionaryTypes: Array.from(afterDicts),
    });
  }
  return incrementSummary;
}

async function syncKnowledgeBases(incubationId, mode, categoryCodes, targetCategoryCode, user) {
  const agentPlatformService = require("../system-knowledge-base/system-knowledge-base.service");
  if (mode === "category") {
    if (targetCategoryCode) await agentPlatformService.syncIncubationKnowledgeBase(incubationId, { categoryCode: targetCategoryCode }, user);
    return;
  }
  await agentPlatformService.syncIncubationKnowledgeBase(incubationId, {}, user);
  for (const categoryCode of categoryCodes) {
    await agentPlatformService.syncIncubationKnowledgeBase(incubationId, { categoryCode }, user);
  }
}

function mergeEvidenceCatalog(existingEvidence = {}, newEvidence = []) {
  const source = [...(Array.isArray(existingEvidence?.items) ? existingEvidence.items : []), ...normalizeEvidenceItems(newEvidence)];
  const seen = new Set();
  const items = [];
  source.forEach((item) => {
    const key = [item.sourceHash || "", item.sourceUrl || "", item.title || "", item.publishedAt || ""].join("|");
    if (!key.trim() || seen.has(key)) return;
    seen.add(key);
    items.push(item);
  });
  return { items };
}

async function ensureCanonicalCategoryOutput(provider, promptInput, rawText, parsedOutput, options = {}) {
  const initialCanonical = buildCanonicalCategoryOutput(parsedOutput, promptInput);
  const initialValidation = validateCanonicalCategoryOutput(initialCanonical, promptInput);
  if (initialValidation.valid) {
    return {
      canonicalOutput: initialCanonical,
      validation: initialValidation,
      repaired: false,
      repairRawText: null,
      repairParsedOutput: null,
    };
  }
  const repairResponse = await repairCategoryOutputShape(provider, promptInput, rawText, options);
  const repairRawText = repairResponse.content;
  const repairParsedOutput = parseModelJson(repairRawText);
  const repairedCanonical = buildCanonicalCategoryOutput(repairParsedOutput, promptInput);
  const repairedValidation = validateCanonicalCategoryOutput(repairedCanonical, promptInput);
  if (!repairedValidation.valid) {
    throw new AppError("category output schema repair failed", 400, {
      initialValidation,
      repairedValidation,
      repairRawText,
      repairParsedOutput,
    });
  }
  return {
    canonicalOutput: repairedCanonical,
    validation: repairedValidation,
    repaired: true,
    repairRawText,
    repairParsedOutput,
  };
}

async function ensureCanonicalIndustryOutput(provider, promptInput, rawText, parsedOutput, options = {}) {
  const initialCanonical = buildCanonicalIndustryOutput(parsedOutput);
  const initialValidation = validateCanonicalIndustryOutput(initialCanonical);
  if (initialValidation.valid) {
    return {
      canonicalOutput: initialCanonical,
      validation: initialValidation,
      repaired: false,
      repairRawText: null,
      repairParsedOutput: null,
    };
  }
  const repairResponse = await repairIndustryOutputShape(provider, promptInput, rawText, options);
  const repairRawText = repairResponse.content;
  const repairParsedOutput = parseModelJson(repairRawText);
  const repairedCanonical = buildCanonicalIndustryOutput(repairParsedOutput);
  const repairedValidation = validateCanonicalIndustryOutput(repairedCanonical);
  if (repairedValidation.valid) {
    return {
      canonicalOutput: repairedCanonical,
      validation: repairedValidation,
      repaired: true,
      repairRawText,
      repairParsedOutput,
    };
  }

  const retryResponse = await repairIndustryOutputShape(provider, promptInput, rawText, {
    ...options,
    compactRetry: true,
    maxTokens: Math.max(Number(options.maxTokens || 0), 4000),
  });
  const retryRawText = retryResponse.content;
  const retryParsedOutput = parseModelJson(retryRawText);
  const retryCanonical = buildCanonicalIndustryOutput(retryParsedOutput);
  const retryValidation = validateCanonicalIndustryOutput(retryCanonical);
  if (retryValidation.valid) {
    return {
      canonicalOutput: retryCanonical,
      validation: retryValidation,
      repaired: true,
      repairRawText: retryRawText,
      repairParsedOutput: retryParsedOutput,
    };
  }

  const recoveryOutput = buildIndustryRecoveryOutput(promptInput, parsedOutput, rawText);
  const recoveryValidation = validateCanonicalIndustryOutput(recoveryOutput);
  if (!recoveryValidation.valid) {
    throw new AppError("industry output schema repair failed", 400, {
      initialValidation,
      repairedValidation,
      retryValidation,
      repairRawText,
      repairParsedOutput,
      retryRawText,
      retryParsedOutput,
      recoveryOutput,
    });
  }
  return {
    canonicalOutput: recoveryOutput,
    validation: recoveryValidation,
    repaired: true,
    repairRawText: retryRawText || repairRawText,
    repairParsedOutput: retryParsedOutput || repairParsedOutput,
  };
}

async function refreshIndustryMetadata(incubationId, user, options = {}) {
  const detail = await getIndustryIncubationDetail(incubationId);
  const normalizedOptions = {
    ...options,
    targetCategoryCode: options.targetCategoryCode || options.categoryCode || null,
    targetCategoryName: options.targetCategoryName || options.categoryName || null,
  };
  const mode = options.mode === "category" ? "category" : "industry";
  const roundNo = Number(normalizedOptions.roundNo || detail.latestRoundNo || 0) + 1;
  const startedAt = new Date().toISOString();
  let modelResponseMeta = null;
  let modelRawText = null;
  let parsedModelOutput = null;
  let canonicalCategoryOutput = null;
  let schemaValidation = null;
  let generatedModelOutput = null;
  await appendLog(incubationId, { roundNo, logType: "run", stepKey: "refresh_start", message: "refresh_start", detail: { mode, purpose: normalizedOptions.purpose || null } });
  try {
    const evidenceItems = await collectEvidence(detail, normalizedOptions);
    await appendLog(incubationId, { roundNo, logType: "research", stepKey: "evidence_collected", message: "evidence_collected", responsePayload: { evidenceItems: evidenceItems.map((item) => ({ id: item.id, title: item.title, sourceUrl: item.sourceUrl })) } });
    const promptInput = buildPromptInput(detail, evidenceItems, normalizedOptions);
    const assembledPromptText = buildIndustryPromptText(promptInput);
    const promptConfig = await resolvePromptConfig(promptInput, assembledPromptText);
    const effectiveMaxTokens = Math.max(Number(promptConfig.maxTokens || 0), 4000);
    const systemPrompt = promptConfig.systemPrompt || "";
    const userPrompt = promptConfig.userPrompt || assembledPromptText || JSON.stringify(promptInput, null, 2);
    await appendLog(incubationId, {
      roundNo,
      logType: "model",
      stepKey: "industry_metadata_model_request",
      message: `industry_metadata_model_request:${promptConfig.provider.modelName || promptConfig.provider.configName || "chat_model"}`,
      requestPayload: {
        promptType: mode === "category" ? "INDUSTRY_CATEGORY_ENHANCE" : "INDUSTRY_METADATA",
        provider: { id: Number(promptConfig.provider.id), configName: promptConfig.provider.configName, modelName: promptConfig.provider.modelName },
        temperature: promptConfig.temperature,
        maxTokens: effectiveMaxTokens,
        strictParameters: true,
        timeoutMs: Number(promptConfig.provider?.extraConfig?.timeoutMs || 600000),
        mode,
        promptInput,
        assembledPromptText,
        systemPrompt,
        userPrompt,
      },
    });
    const response = await strictGenerateChatCompletion(
      promptConfig.provider,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: promptConfig.temperature, maxTokens: effectiveMaxTokens, timeoutMs: Number(promptConfig.provider?.extraConfig?.timeoutMs || 600000) }
    );
    modelResponseMeta = {
      checkedEndpoint: response.raw?.checkedEndpoint || null,
      adapted: Boolean(response.raw?.adapted),
      finishReason: response.raw?.finishReason || null,
      usage: response.raw?.usage || null,
    };
    modelRawText = response.content;
    parsedModelOutput = parseModelJson(response.content);
    await appendLog(incubationId, {
      roundNo,
      logType: "model",
      stepKey: "industry_metadata_model_output",
      message: "industry_metadata_model_output",
      responsePayload: {
        ...modelResponseMeta,
        rawText: modelRawText,
        parsedOutput: parsedModelOutput,
      },
    });
    let normalizedSource = parsedModelOutput;
    if (mode === "category" || mode === "industry") {
      const canonicalResult = mode === "category"
        ? await ensureCanonicalCategoryOutput(
            promptConfig.provider,
            promptInput,
            modelRawText,
            parsedModelOutput,
            { maxTokens: effectiveMaxTokens, timeoutMs: Number(promptConfig.provider?.extraConfig?.timeoutMs || 600000) }
          )
        : await ensureCanonicalIndustryOutput(
            promptConfig.provider,
            promptInput,
            modelRawText,
            parsedModelOutput,
            { maxTokens: effectiveMaxTokens, timeoutMs: Number(promptConfig.provider?.extraConfig?.timeoutMs || 600000) }
          );
      canonicalCategoryOutput = canonicalResult.canonicalOutput;
      schemaValidation = canonicalResult.validation;
      await appendLog(incubationId, {
        roundNo,
        logType: "model",
        stepKey: "industry_metadata_model_schema_validation",
        message: "industry_metadata_model_schema_validation",
        detail: {
          mode,
          repaired: canonicalResult.repaired,
          validation: canonicalResult.validation,
        },
        responsePayload: canonicalResult.repaired
          ? {
              canonicalOutput: canonicalResult.canonicalOutput,
              repairRawText: canonicalResult.repairRawText,
              repairParsedOutput: canonicalResult.repairParsedOutput,
            }
          : {
              canonicalOutput: canonicalResult.canonicalOutput,
            },
      });
      normalizedSource = canonicalResult.canonicalOutput;
    }
    const generated = normalizeGeneratedMetadata(normalizedSource, detail, evidenceItems, normalizedOptions);
    generatedModelOutput = generated;
    if (mode === "industry") validateIndustryResult(detail, generated);
    const existingCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree.map((item) => normalizeCategory(item)) : [];
    const existingDictionaries = Array.isArray(detail?.standardAssets?.dictionaries) ? detail.standardAssets.dictionaries.map((item, index) => normalizeDictionary(item, index)) : [];
    const mergedCategories = mode === "industry"
      ? mergeByKey(existingCategories, generated.categories, (item) => String(item?.categoryCode || item?.categoryName || "").trim())
      : mergeByKey(existingCategories, generated.categories.map((item) => {
        const existing = existingCategories.find((entry) => String(entry?.categoryCode || "").trim() === String(item?.categoryCode || "").trim()) || existingCategories.find((entry) => String(entry?.categoryName || "").trim() === String(item?.categoryName || "").trim()) || {};
        return mergeCategory(existing, item);
      }), (item) => String(item?.categoryCode || item?.categoryName || "").trim());
    const mergedDictionaries = mergeByKey(existingDictionaries, generated.dictionaries.map((item) => {
      const existing = existingDictionaries.find((entry) => String(entry?.categoryCode || "").trim() === String(item?.categoryCode || "").trim() && String(entry?.dictType || entry?.dictName || "").trim() === String(item?.dictType || item?.dictName || "").trim()) || {};
      return mergeDictionary(existing, item);
    }), (item) => `${String(item?.categoryCode || "").trim()}::${String(item?.dictType || item?.dictName || "").trim()}`);
    const mergedEvidenceCatalog = mergeEvidenceCatalog(detail.evidenceCatalog || {}, evidenceItems);
    const mergedCategoriesWithRefs = backfillCategoryEvidenceRefs(
      mergedCategories,
      (mergedEvidenceCatalog.items || []).map((item) => item?.id)
    );
    const mergedAssets = {
      ...(detail.standardAssets && typeof detail.standardAssets === "object" ? detail.standardAssets : defaultConfig().standardAssets),
      researchCatalog: {
        ...((detail.standardAssets?.researchCatalog && typeof detail.standardAssets.researchCatalog === "object") ? detail.standardAssets.researchCatalog : defaultConfig().standardAssets.researchCatalog),
        summary: generated.summary,
        categoryTree: mergedCategoriesWithRefs,
        candidateTableSpecs: mergeByKey(
          Array.isArray(detail?.standardAssets?.researchCatalog?.candidateTableSpecs)
            ? detail.standardAssets.researchCatalog.candidateTableSpecs.map((item) => normalizeTable(item))
            : [],
          [
            ...(generated.candidateTableSpecs || []),
            ...mergedCategoriesWithRefs.flatMap((item) => item.tableDetails || []),
          ],
          (item) => String(item?.tableName || "").trim()
        ),
      },
      dictionaries: mergedDictionaries,
    };
    const targetCategoryCode = String(generated.categories?.[0]?.categoryCode || normalizedOptions.targetCategoryCode || "").trim() || null;
    const incrementSummary = mode === "category" ? validateCategoryIncrement(detail, mergedAssets, mergedEvidenceCatalog, targetCategoryCode) : null;
    const nextTrainingSettings = normalizeTrainingSettings({ ...detail.trainingSettings, runState: { ...detail.trainingSettings.runState, totalRounds: Math.max(Number(detail.trainingSettings?.runState?.totalRounds || 0), roundNo), taskCurrentRoundNo: roundNo } });
    await pool.query("UPDATE lab_industry_incubation SET standard_assets_json = ?, evidence_catalog_json = ?, training_settings_json = ?, latest_round_no = ?, last_synced_at = NOW() WHERE id = ?", [JSON.stringify(mergedAssets), JSON.stringify(mergedEvidenceCatalog), JSON.stringify(nextTrainingSettings), roundNo, Number(incubationId)]);
    await pool.query("INSERT INTO lab_industry_incubation_round (incubation_id, round_no, round_name, round_status, selected_scenarios_json, evidence_snapshot_json, committee_snapshot_json, result_summary_json, enhancement_delta_json, started_at, ended_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE round_name = VALUES(round_name), round_status = VALUES(round_status), result_summary_json = VALUES(result_summary_json), enhancement_delta_json = VALUES(enhancement_delta_json), started_at = VALUES(started_at), ended_at = VALUES(ended_at), updated_at = NOW()", [Number(incubationId), roundNo, `round_${roundNo}`, "completed", JSON.stringify([]), JSON.stringify(mergedEvidenceCatalog.items || []), JSON.stringify({ mode, strictParameters: true }), JSON.stringify({ summary: generated.summary, categoryCount: generated.categories.length, tableCount: generated.candidateTableSpecs.length, dictionaryCount: generated.dictionaries.length }), JSON.stringify({ mode, categoryCodes: generated.categories.map((item) => item.categoryCode), incrementSummary }), new Date(startedAt), new Date(), user?.displayName || user?.username || "system"]);
    await appendLog(incubationId, {
      roundNo,
      logType: "model",
      stepKey: "industry_metadata_model_response",
      message: "industry_metadata_model_response",
      responsePayload: {
        ...(modelResponseMeta || {}),
        rawText: modelRawText,
        parsedOutput: parsedModelOutput,
        canonicalCategoryOutput,
        schemaValidation,
        generated,
        extractionDiagnostics: generated?.extractionDiagnostics || null,
      },
    });
    await appendLog(incubationId, { roundNo, logType: "metadata", stepKey: "metadata_merged", message: "metadata_merged", detail: { categoryCount: generated.categories.length, candidateTableCount: generated.candidateTableSpecs.length, dictionaryCount: generated.dictionaries.length, evidenceCount: mergedEvidenceCatalog.items.length, incrementSummary, extractionDiagnostics: generated?.extractionDiagnostics || null } });
    await syncKnowledgeBases(Number(incubationId), mode, generated.categories.map((item) => item.categoryCode), targetCategoryCode, user);
    return getIndustryIncubationDetail(incubationId);
  } catch (error) {
    await appendLog(incubationId, {
      roundNo,
      logLevel: "error",
      logType: "model",
      stepKey: "industry_metadata_model_error",
      message: error.message || "industry_metadata_model_error",
      detail: {
        errorMessage: error.message || null,
        attemptedEndpoint: error?.details?.attemptedEndpoint || modelResponseMeta?.checkedEndpoint || null,
        rawText: modelRawText,
        parsedOutput: parsedModelOutput,
        canonicalCategoryOutput,
        schemaValidation,
        generatedOutput: generatedModelOutput,
        extractionDiagnostics: generatedModelOutput?.extractionDiagnostics || summarizeExtractionDiagnostics(parsedModelOutput || {}, [], [], []),
        errorDetails: error?.details || null,
      },
    });
    if (options?.suppressThrow) return { __failed: true, errorMessage: error.message || "industry_metadata_model_error", details: error?.details || null };
    throw error;
  }
}

async function runIncubationJob(incubationId, user, options = {}) {
  try {
    const roundCount = clampInt(options.roundCount, 1, 12, 1);
    let executedRounds = 0;
    for (let index = 0; index < roundCount; index += 1) {
      const job = jobs.get(Number(incubationId));
      if (job?.stopRequested) break;
      const result = await refreshIndustryMetadata(incubationId, user, { ...options, mode: options.categoryCode || options.categoryName ? "category" : "industry", suppressThrow: true, purpose: "async_run" });
      if (result && result.__failed) {
        const detail = await getIndustryIncubationDetail(incubationId).catch(() => null);
        if (detail) {
          const failedTraining = normalizeTrainingSettings({ ...detail.trainingSettings, runState: { ...detail.trainingSettings.runState, status: "failed", stopRequested: false, endedAt: new Date().toISOString(), lastError: result.errorMessage || "run_failed", taskCurrentRoundNo: executedRounds } });
          await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(failedTraining), Number(incubationId)]);
        }
        await appendLog(incubationId, { logLevel: "error", logType: "run", stepKey: "job_failed", message: result.errorMessage || "job_failed" });
        return { ok: false, errorMessage: result.errorMessage || "job_failed" };
      }
      executedRounds += 1;
    }
    const detail = await getIndustryIncubationDetail(incubationId);
    const nextStatus = jobs.get(Number(incubationId))?.stopRequested ? "stopped" : "completed";
    const nextTraining = normalizeTrainingSettings({ ...detail.trainingSettings, runState: { ...detail.trainingSettings.runState, status: nextStatus, stopRequested: false, endedAt: new Date().toISOString(), lastError: null, taskCurrentRoundNo: executedRounds, totalRounds: Math.max(Number(detail.trainingSettings?.runState?.totalRounds || 0), executedRounds) } });
    await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(nextTraining), Number(incubationId)]);
    await appendLog(incubationId, { logType: "run", stepKey: "job_end", message: `job_end:${nextStatus}` });
    return { ok: true };
  } catch (error) {
    const detail = await getIndustryIncubationDetail(incubationId).catch(() => null);
    if (detail) {
      const failedTraining = normalizeTrainingSettings({ ...detail.trainingSettings, runState: { ...detail.trainingSettings.runState, status: "failed", stopRequested: false, endedAt: new Date().toISOString(), lastError: error.message || "run_failed" } });
      await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(failedTraining), Number(incubationId)]);
    }
    await appendLog(incubationId, { logLevel: "error", logType: "run", stepKey: "job_failed", message: error.message || "job_failed", detail: { stack: error.stack || null } });
    return { ok: false, errorMessage: error.message || "job_failed" };
  } finally {
    jobs.delete(Number(incubationId));
  }
}

async function startIndustryIncubationRun(incubationId, payload, user) {
  const detail = await getIndustryIncubationDetail(incubationId);
  const runState = normalizeTrainingSettings(detail.trainingSettings).runState;
  const roundCount = clampInt(payload?.roundCount || detail.trainingSettings?.targetRoundCount, 1, 12, 1);
  if ((runState.status === "running" || runState.status === "stopping") && jobs.has(Number(incubationId))) {
    throw new AppError("run already active", 400);
  }
  const nextTraining = normalizeTrainingSettings({ ...detail.trainingSettings, targetRoundCount: roundCount, runState: { ...runState, status: "running", mode: payload?.categoryCode || payload?.categoryName ? "category" : "industry", stopRequested: false, startedAt: new Date().toISOString(), endedAt: null, lastError: null, totalRounds: roundCount, taskCurrentRoundNo: 0, targetCategoryCode: payload?.categoryCode || null, targetCategoryName: payload?.categoryName || null } });
  await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(nextTraining), Number(incubationId)]);
  await appendLog(incubationId, { logType: "run", stepKey: "start_requested", message: "start_requested", requestPayload: { ...(payload || {}), roundCount } });
  const job = { stopRequested: false };
  jobs.set(Number(incubationId), job);
  job.promise = runIncubationJob(Number(incubationId), user, { ...(payload || {}), roundCount });
  return getIndustryIncubationDetail(incubationId);
}

async function stopIndustryIncubationRun(incubationId) {
  const detail = await getIndustryIncubationDetail(incubationId);
  const runState = normalizeTrainingSettings(detail.trainingSettings).runState;
  const job = jobs.get(Number(incubationId));
  if (job) job.stopRequested = true;
  const nextTraining = normalizeTrainingSettings({ ...detail.trainingSettings, runState: { ...runState, status: job ? "stopping" : "stopped", stopRequested: Boolean(job), endedAt: job ? runState.endedAt || null : new Date().toISOString() } });
  await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(nextTraining), Number(incubationId)]);
  await appendLog(incubationId, { logType: "run", stepKey: "stop_requested", message: job ? "stop_requested" : "no_live_job" });
  return getIndustryIncubationDetail(incubationId);
}

async function updateIndustryCategoryIteration(incubationId, payload = {}) {
  const detail = await getIndustryIncubationDetail(incubationId);
  const assets = detail.standardAssets && typeof detail.standardAssets === "object" ? detail.standardAssets : defaultConfig().standardAssets;
  const categoryTree = Array.isArray(assets?.researchCatalog?.categoryTree) ? assets.researchCatalog.categoryTree : [];
  const nextCategoryTree = categoryTree.map((item) => {
    const hit = (payload.categoryCode && String(item?.categoryCode || "") === String(payload.categoryCode || "")) || (payload.categoryName && String(item?.categoryName || "") === String(payload.categoryName || ""));
    return hit ? { ...item, continueIteration: Boolean(payload.continueIteration) } : item;
  });
  const nextAssets = { ...assets, researchCatalog: { ...(assets.researchCatalog || {}), categoryTree: nextCategoryTree } };
  await pool.query("UPDATE lab_industry_incubation SET standard_assets_json = ? WHERE id = ?", [JSON.stringify(nextAssets), Number(incubationId)]);
  return getIndustryIncubationDetail(incubationId);
}

async function deleteIndustryCategory(incubationId, payload = {}, user) {
  const detail = await getIndustryIncubationDetail(incubationId);
  const categoryTree = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
  const target = categoryTree.find((item) => (payload.categoryCode && String(item?.categoryCode || "").trim() === String(payload.categoryCode).trim()) || (payload.categoryName && String(item?.categoryName || "").trim() === String(payload.categoryName).trim()));
  if (!target) throw new AppError("target category not found", 404);
  await deleteKnowledgeBasesByTags(["scope:industry_category", `incubation:${Number(incubationId)}`, `category:${String(target.categoryCode || "").trim()}`]);
  const targetTableNames = new Set((Array.isArray(target.tableDetails) ? target.tableDetails : []).map((item) => String(item?.tableName || "").trim()).filter(Boolean));
  const nextAssets = {
    ...(detail.standardAssets && typeof detail.standardAssets === "object" ? detail.standardAssets : defaultConfig().standardAssets),
    researchCatalog: {
      ...((detail.standardAssets?.researchCatalog && typeof detail.standardAssets.researchCatalog === "object") ? detail.standardAssets.researchCatalog : defaultConfig().standardAssets.researchCatalog),
      categoryTree: categoryTree.filter((item) => String(item?.categoryCode || "").trim() !== String(target.categoryCode || "").trim()),
      candidateTableSpecs: (Array.isArray(detail?.standardAssets?.researchCatalog?.candidateTableSpecs) ? detail.standardAssets.researchCatalog.candidateTableSpecs : []).filter((item) => !targetTableNames.has(String(item?.tableName || "").trim())),
    },
    dictionaries: (Array.isArray(detail?.standardAssets?.dictionaries) ? detail.standardAssets.dictionaries : []).filter((item) => String(item?.categoryCode || "").trim() !== String(target.categoryCode || "").trim()),
  };
  await pool.query("UPDATE lab_industry_incubation SET standard_assets_json = ? WHERE id = ?", [JSON.stringify(nextAssets), Number(incubationId)]);
  await appendLog(incubationId, { logType: "run", stepKey: "category_deleted", message: `category_deleted:${target.categoryCode}` });
  await syncKnowledgeBases(Number(incubationId), "industry", [], null, user);
  return getIndustryIncubationDetail(incubationId);
}

async function syncIndustryIncubationToEnhancement(incubationId, user) {
  const detail = await getIndustryIncubationDetail(incubationId);
  const assets = detail.standardAssets && typeof detail.standardAssets === "object" ? detail.standardAssets : defaultConfig().standardAssets;
  const catalog = assets.researchCatalog && typeof assets.researchCatalog === "object" ? assets.researchCatalog : defaultConfig().standardAssets.researchCatalog;
  const enhancement = await enhancementService.saveScenarioEnhancement({
    id: detail.enhancementProfileId || undefined,
    profileName: `${detail.incubationName} Enhancement`,
    profileCode: detail.incubationCode,
    industry: detail.industryCode,
    profileDesc: detail.incubationDesc || null,
    locale: "zh-CN",
    businessStyle: detail.industryCode,
    confidenceThreshold: 0.72,
    priority: 10,
    status: "active",
    recognition: { aliases: [detail.incubationName], keywords: [detail.incubationName, detail.industryCode], negativeKeywords: [] },
    researchCatalog: { summary: catalog.summary || "", categoryTree: Array.isArray(catalog.categoryTree) ? catalog.categoryTree : [], candidateTables: Array.isArray(catalog.categoryTree) ? catalog.categoryTree.flatMap((item) => item.tableScopes || []) : [], candidateTableSpecs: Array.isArray(catalog.candidateTableSpecs) ? catalog.candidateTableSpecs : [], dictSuggestionSpecs: Array.isArray(assets.dictionaries) ? assets.dictionaries : [], sourceRefs: [] },
    modulePlanner: { summary: catalog.summary || "", categories: Array.isArray(catalog.categoryTree) ? catalog.categoryTree : [] },
    schemaGuides: {}, relationPatterns: [], stateMachines: [], codeRules: [], fieldSemantics: [], valueCorpora: {}, distributionProfiles: {}, qualityGates: {}, realismRules: [], dirtyDataProfiles: {}, trainingAssets: {}, evaluationRubric: {}, overridePolicies: {}, dictionaries: Array.isArray(assets.dictionaries) ? assets.dictionaries : [], distributionRules: [], fieldRules: [], complianceRules: [], pluginBindings: [], extendedRules: [],
  }, user);
  await pool.query("UPDATE lab_industry_incubation SET enhancement_profile_id = ?, last_synced_at = NOW() WHERE id = ?", [Number(enhancement.id), Number(incubationId)]);
  return { incubation: await getIndustryIncubationDetail(incubationId), enhancement };
}

async function rebuildIndustryIncubationDictionaryOwnership(incubationId) {
  return getIndustryIncubationDetail(incubationId);
}

async function generateIndustryIncubationRound() { throw new AppError("legacy round flow is disabled", 400); }
async function updateIndustryIncubationRound() { throw new AppError("legacy round flow is disabled", 400); }
async function executeIndustryIncubationRound() { throw new AppError("legacy round flow is disabled", 400); }

module.exports = {
  listIndustryIncubations,
  getIndustryIncubationDetail,
  getIndustryIncubationStats,
  listIndustryIncubationLogs,
  saveIndustryIncubation,
  deleteIndustryIncubation,
  deleteIndustryCategory,
  refreshIndustryMetadata,
  startIndustryIncubationRun,
  stopIndustryIncubationRun,
  updateIndustryCategoryIteration,
  generateIndustryIncubationRound,
  updateIndustryIncubationRound,
  syncIndustryIncubationToEnhancement,
  executeIndustryIncubationRound,
  rebuildIndustryIncubationDictionaryOwnership,
};

