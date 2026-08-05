const { pool } = require("../../config/database");
const AppError = require("../../common/errors/app-error");
const enhancementService = require("./data-lab.enhancement");
const modelProviderService = require("../model-providers/model-provider.service");

const jobs = new Map();

const j = (v, d) => {
  if (v === null || v === undefined || v === "") return d;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return d; }
};

function extractTextValue(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v.map((item) => extractTextValue(item)).filter(Boolean).join(" ");
  }
  if (typeof v === "object") {
    const candidates = [
      v.name,
      v.label,
      v.title,
      v.summary,
      v.description,
      v.comment,
      v.tableName,
      v.tableLabel,
      v.tableComment,
      v.categoryName,
      v.categoryCode,
      v.dictName,
      v.itemLabel,
      v.itemName,
      v.value,
      v.code,
    ];
    const hit = candidates.map((item) => extractTextValue(item)).find(Boolean);
    if (hit) return hit;
    const fallback = Object.values(v).map((item) => extractTextValue(item)).filter(Boolean).slice(0, 3).join(" ");
    return fallback;
  }
  return "";
}

const code = (v, p) =>
  String(extractTextValue(v) || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_") || (p + "_" + Date.now().toString().slice(-8));

const text = (v, n = 200) => {
  const s = extractTextValue(v).replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 3).trim() + "..." : s;
};

const first = (rows) => (Array.isArray(rows) && rows.length ? rows[0] : null);

function langPolicy() {
  return {
    locale: "zh-CN",
    domesticOnly: true,
    requiredChineseLabels: true,
    allowedCurrencies: ["CNY", "RMB"],
    sourceDomainWhitelist: ["gov.cn", "edu.cn", "org.cn", "www.gov.cn"],
    forbiddenForeignTerms: [],
    forbiddenForeignRegions: [],
  };
}

function autoPolicy() {
  return {
    sourceTypes: ["policy", "standard", "guide", "report"],
    preferredDomains: ["gov.cn", "edu.cn", "org.cn", "www.gov.cn"],
    requiredKeywords: [],
  };
}

function modelCommittee() {
  return { defaultModelProviderId: null, fallbackModelProviderId: null };
}

function scenarioPool() { return { scenarios: [] }; }
function scenarioCoverage() { return { sceneFingerprints: [], coveredSubScenarios: [], coveredModules: [] }; }
function evidenceCatalog() { return { items: [] }; }
function standardAssets() { return { researchCatalog: { summary: "", categoryTree: [], candidateTableSpecs: [] }, dictionaries: [] }; }

function trainingSettings(v) {
  const x = j(v, {});
  const normalizedTargetRoundCount = clampInt(x.targetRoundCount, 1, 12, 3);
  const normalizedTargetCategoryCount = clampInt(x.targetCategoryCount, 1, 8, 1);
  return {
    targetRoundCount: normalizedTargetRoundCount,
    targetCategoryCount: normalizedTargetCategoryCount,
    ...x,
    targetRoundCount: normalizedTargetRoundCount,
    targetCategoryCount: normalizedTargetCategoryCount,
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
      ...(x.runState && typeof x.runState === "object" ? x.runState : {}),
    },
  };
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function resolveTargetCategoryCount(detail, options = {}) {
  if (options.mode === "category" && (options.targetCategoryCode || options.targetCategoryName)) return 1;
  const training = detail?.trainingSettings && typeof detail.trainingSettings === "object" ? detail.trainingSettings : {};
  return clampInt(options.targetCategoryCount ?? training.targetCategoryCount, 1, 8, 1);
}

function randomIndustryCode8() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

async function generateIndustryCode8() {
  for (let i = 0; i < 12; i += 1) {
    const candidate = randomIndustryCode8();
    const [rows] = await pool.query("SELECT id FROM lab_industry_incubation WHERE industry_code = ? LIMIT 1", [candidate]);
    if (!Array.isArray(rows) || rows.length === 0) return candidate;
  }
  return String(Date.now()).slice(-8);
}

function mapRound(r) {
  return {
    id: Number(r.id),
    incubationId: Number(r.incubationId),
    roundNo: Number(r.roundNo),
    roundName: r.roundName,
    roundStatus: r.roundStatus,
    selectedScenarios: j(r.selectedScenarios, []),
    evidenceSnapshot: j(r.evidenceSnapshot, []),
    committeeSnapshot: j(r.committeeSnapshot, {}),
    resultSummary: j(r.resultSummary, {}),
    enhancementDelta: j(r.enhancementDelta, {}),
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapLog(r) {
  return {
    id: Number(r.id),
    incubationId: Number(r.incubationId),
    roundNo: r.roundNo == null ? null : Number(r.roundNo),
    logLevel: r.logLevel,
    logType: r.logType,
    stepKey: r.stepKey,
    message: r.message,
    requestPayload: j(r.requestPayload, null),
    responsePayload: j(r.responsePayload, null),
    detail: j(r.detail, null),
    createdAt: r.createdAt,
  };
}

function mapProject(r, rounds = []) {
  return {
    id: Number(r.id),
    incubationName: r.incubationName,
    incubationCode: r.incubationCode,
    industryCode: r.industryCode,
    enhancementProfileId: r.enhancementProfileId ? Number(r.enhancementProfileId) : null,
    enhancementProfileName: r.enhancementProfileName || null,
    incubationDesc: r.incubationDesc || null,
    status: r.status,
    languagePolicy: j(r.languagePolicy, langPolicy()),
    autoResearchPolicy: j(r.autoResearchPolicy, autoPolicy()),
    modelCommittee: j(r.modelCommittee, modelCommittee()),
    scenarioPool: j(r.scenarioPool, scenarioPool()),
    scenarioCoverage: j(r.scenarioCoverage, scenarioCoverage()),
    evidenceCatalog: j(r.evidenceCatalog, evidenceCatalog()),
    standardAssets: j(r.standardAssets, standardAssets()),
    publicDataProfiles: j(r.publicDataProfiles, {}),
    trainingSettings: trainingSettings(r.trainingSettings),
    evaluationRubric: j(r.evaluationRubric, {}),
    overridePolicies: j(r.overridePolicies, {}),
    latestRoundNo: Number(r.latestRoundNo || 0),
    lastSyncedAt: r.lastSyncedAt,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    rounds,
  };
}

async function log(incubationId, p) {
  await pool.query(
    "INSERT INTO lab_industry_incubation_log (incubation_id, round_no, log_level, log_type, step_key, message, request_payload_json, response_payload_json, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      Number(incubationId),
      p.roundNo || null,
      p.logLevel || "info",
      p.logType || "run",
      p.stepKey || "unknown",
      text(p.message || "", 500),
      JSON.stringify(p.requestPayload || null),
      JSON.stringify(p.responsePayload || null),
      JSON.stringify(p.detail || null),
    ]
  );
}

async function listIndustryIncubationLogs(id) {
  const [rows] = await pool.query(
    "SELECT id, incubation_id AS incubationId, round_no AS roundNo, log_level AS logLevel, log_type AS logType, step_key AS stepKey, message, request_payload_json AS requestPayload, response_payload_json AS responsePayload, detail_json AS detail, created_at AS createdAt FROM lab_industry_incubation_log WHERE incubation_id = ? ORDER BY id DESC LIMIT 500",
    [Number(id)]
  );
  return rows.map(mapLog);
}

async function listRounds(id) {
  const [rows] = await pool.query(
    "SELECT id, incubation_id AS incubationId, round_no AS roundNo, round_name AS roundName, round_status AS roundStatus, selected_scenarios_json AS selectedScenarios, evidence_snapshot_json AS evidenceSnapshot, committee_snapshot_json AS committeeSnapshot, result_summary_json AS resultSummary, enhancement_delta_json AS enhancementDelta, started_at AS startedAt, ended_at AS endedAt, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt FROM lab_industry_incubation_round WHERE incubation_id = ? ORDER BY round_no DESC, id DESC",
    [Number(id)]
  );
  return rows.map(mapRound);
}

async function getBase(id) {
  const [rows] = await pool.query(
    "SELECT p.id, p.incubation_name AS incubationName, p.incubation_code AS incubationCode, p.industry_code AS industryCode, p.enhancement_profile_id AS enhancementProfileId, profile.profile_name AS enhancementProfileName, p.incubation_desc AS incubationDesc, p.status, p.language_policy_json AS languagePolicy, p.auto_research_policy_json AS autoResearchPolicy, p.model_committee_json AS modelCommittee, p.scenario_pool_json AS scenarioPool, p.scenario_coverage_json AS scenarioCoverage, p.evidence_catalog_json AS evidenceCatalog, p.standard_assets_json AS standardAssets, p.public_data_profiles_json AS publicDataProfiles, p.training_settings_json AS trainingSettings, p.evaluation_rubric_json AS evaluationRubric, p.override_policies_json AS overridePolicies, p.latest_round_no AS latestRoundNo, p.last_synced_at AS lastSyncedAt, p.created_by AS createdBy, p.created_at AS createdAt, p.updated_at AS updatedAt FROM lab_industry_incubation p LEFT JOIN lab_scenario_profile profile ON profile.id = p.enhancement_profile_id WHERE p.id = ? LIMIT 1",
    [Number(id)]
  );
  const row = first(rows);
  if (!row) throw new AppError("行业孵化项目不存在", 404);
  return row;
}

async function listIndustryIncubations() {
  const [rows] = await pool.query(
    "SELECT p.id, p.incubation_name AS incubationName, p.incubation_code AS incubationCode, p.industry_code AS industryCode, p.enhancement_profile_id AS enhancementProfileId, profile.profile_name AS enhancementProfileName, p.incubation_desc AS incubationDesc, p.status, p.language_policy_json AS languagePolicy, p.auto_research_policy_json AS autoResearchPolicy, p.model_committee_json AS modelCommittee, p.scenario_pool_json AS scenarioPool, p.scenario_coverage_json AS scenarioCoverage, p.evidence_catalog_json AS evidenceCatalog, p.standard_assets_json AS standardAssets, p.public_data_profiles_json AS publicDataProfiles, p.training_settings_json AS trainingSettings, p.evaluation_rubric_json AS evaluationRubric, p.override_policies_json AS overridePolicies, p.latest_round_no AS latestRoundNo, p.last_synced_at AS lastSyncedAt, p.created_by AS createdBy, p.created_at AS createdAt, p.updated_at AS updatedAt FROM lab_industry_incubation p LEFT JOIN lab_scenario_profile profile ON profile.id = p.enhancement_profile_id ORDER BY p.id ASC"
  );
  return rows.map((r) => mapProject(r));
}

async function getIndustryIncubationDetail(id) {
  return mapProject(await getBase(id), await listRounds(id));
}

function cats(rec) {
  const a = rec?.standardAssets && typeof rec.standardAssets === "object" ? rec.standardAssets : {};
  const c = a.researchCatalog && typeof a.researchCatalog === "object" ? a.researchCatalog : {};
  return Array.isArray(c.categoryTree) ? c.categoryTree : [];
}

function dicts(rec) {
  const a = rec?.standardAssets && typeof rec.standardAssets === "object" ? rec.standardAssets : {};
  return Array.isArray(a.dictionaries) ? a.dictionaries : [];
}

async function getIndustryIncubationStats(id) {
  const detail = await getIndustryIncubationDetail(id);
  const categories = cats(detail);
  const dictionaries = dicts(detail);
  const logs = await listIndustryIncubationLogs(id);

  return {
    incubationId: detail.id,
    incubationName: detail.incubationName,
    totals: {
      categoryCount: categories.length,
      tableCount: categories.reduce((s, x) => s + (Array.isArray(x.tableDetails) ? x.tableDetails.length : Array.isArray(x.tableScopes) ? x.tableScopes.length : 0), 0),
      dictionaryGroupCount: dictionaries.length,
      dictionaryItemCount: dictionaries.reduce((s, x) => s + (Array.isArray(x.items) ? x.items.length : 0), 0),
      publicDictionaryGroupCount: 0,
      publicDictionaryItemCount: 0,
    },
    categories: categories.map((c) => ({
      categoryCode: String(c.categoryCode || ""),
      categoryName: String(c.categoryName || c.categoryCode || ""),
      tableCount: Array.isArray(c.tableDetails) ? c.tableDetails.length : Array.isArray(c.tableScopes) ? c.tableScopes.length : 0,
      dictionaryGroupCount: dictionaries.filter((d) => String(d.categoryCode || "") === String(c.categoryCode || "")).length,
      dictionaryItemCount: dictionaries.filter((d) => String(d.categoryCode || "") === String(c.categoryCode || "")).reduce((s, d) => s + (Array.isArray(d.items) ? d.items.length : 0), 0),
      evidenceCount: logs.filter((x) => x.stepKey === "evidence_collected").length,
      lastRoundNo: Number(detail.latestRoundNo || 0),
    })),
    publicDictionaries: [],
  };
}

async function saveIndustryIncubation(payload, user) {
  const rawIndustryCode = String(payload.industryCode || "").trim();
  const n = {
    id: payload.id ? Number(payload.id) : null,
    incubationName: String(payload.incubationName || "").trim(),
    incubationCode: code(payload.incubationCode || payload.incubationName, "industry_incubation"),
    industryCode: rawIndustryCode,
    enhancementProfileId: payload.enhancementProfileId ? Number(payload.enhancementProfileId) : null,
    incubationDesc: payload.incubationDesc ? String(payload.incubationDesc).trim() : null,
    status: String(payload.status || "draft"),
    languagePolicy: payload.languagePolicy || langPolicy(),
    autoResearchPolicy: payload.autoResearchPolicy || autoPolicy(),
    modelCommittee: payload.modelCommittee || modelCommittee(),
    scenarioPool: payload.scenarioPool || scenarioPool(),
    scenarioCoverage: payload.scenarioCoverage || scenarioCoverage(),
    evidenceCatalog: payload.evidenceCatalog || evidenceCatalog(),
    standardAssets: payload.standardAssets || standardAssets(),
    publicDataProfiles: payload.publicDataProfiles || {},
    trainingSettings: trainingSettings(payload.trainingSettings),
    evaluationRubric: payload.evaluationRubric || {},
    overridePolicies: payload.overridePolicies || {},
  };
  if (!n.incubationName) throw new AppError("行业名称不能为空", 400);
  if (n.id && !n.industryCode) {
    const base = await getBase(n.id);
    n.industryCode = String(base.industryCode || "").trim();
  }
  if (!n.industryCode) {
    n.industryCode = await generateIndustryCode8();
  }

  if (n.id) {
    await pool.query(
      "UPDATE lab_industry_incubation SET incubation_name = ?, incubation_code = ?, industry_code = ?, enhancement_profile_id = ?, incubation_desc = ?, status = ?, language_policy_json = ?, auto_research_policy_json = ?, model_committee_json = ?, scenario_pool_json = ?, scenario_coverage_json = ?, evidence_catalog_json = ?, standard_assets_json = ?, public_data_profiles_json = ?, training_settings_json = ?, evaluation_rubric_json = ?, override_policies_json = ? WHERE id = ?",
      [n.incubationName, n.incubationCode, n.industryCode, n.enhancementProfileId, n.incubationDesc, n.status, JSON.stringify(n.languagePolicy), JSON.stringify(n.autoResearchPolicy), JSON.stringify(n.modelCommittee), JSON.stringify(n.scenarioPool), JSON.stringify(n.scenarioCoverage), JSON.stringify(n.evidenceCatalog), JSON.stringify(n.standardAssets), JSON.stringify(n.publicDataProfiles), JSON.stringify(n.trainingSettings), JSON.stringify(n.evaluationRubric), JSON.stringify(n.overridePolicies), n.id]
    );
    return getIndustryIncubationDetail(n.id);
  }

  const [r] = await pool.query(
    "INSERT INTO lab_industry_incubation (incubation_name, incubation_code, industry_code, enhancement_profile_id, incubation_desc, status, language_policy_json, auto_research_policy_json, model_committee_json, scenario_pool_json, scenario_coverage_json, evidence_catalog_json, standard_assets_json, public_data_profiles_json, training_settings_json, evaluation_rubric_json, override_policies_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [n.incubationName, n.incubationCode, n.industryCode, n.enhancementProfileId, n.incubationDesc, n.status, JSON.stringify(n.languagePolicy), JSON.stringify(n.autoResearchPolicy), JSON.stringify(n.modelCommittee), JSON.stringify(n.scenarioPool), JSON.stringify(n.scenarioCoverage), JSON.stringify(n.evidenceCatalog), JSON.stringify(n.standardAssets), JSON.stringify(n.publicDataProfiles), JSON.stringify(n.trainingSettings), JSON.stringify(n.evaluationRubric), JSON.stringify(n.overridePolicies), user?.displayName || user?.username || "system"]
  );
  return getIndustryIncubationDetail(r.insertId);
}

async function deleteIndustryIncubation(id) {
  await getBase(id);
  await pool.query("DELETE FROM lab_industry_incubation WHERE id = ?", [Number(id)]);
  return { id: Number(id) };
}

async function resolveIndustryMetadataPromptConfig() {
  const [rows] = await pool.query(
    "SELECT default_model_provider_id AS defaultModelProviderId, temperature, max_tokens AS maxTokens FROM lab_prompt_template WHERE prompt_type='INDUSTRY_METADATA' AND status='active' ORDER BY updated_at DESC LIMIT 1"
  );
  const row = first(rows);
  let provider = null;
  if (row?.defaultModelProviderId) provider = await modelProviderService.getModelProviderById(Number(row.defaultModelProviderId));
  if (!provider) {
    const providers = await modelProviderService.getActiveChatModelProviders();
    provider = providers[0] || null;
  }
  if (!provider) throw new AppError("未找到可用的对话模型", 400);
  return {
    provider,
    temperature: Math.min(Number(row?.temperature || 0.1), 0.1),
    maxTokens: clampInt(row?.maxTokens, 256, 512, 512),
  };
}

function buildIndustryMetadataPrompt(detail, options = {}) {
  const targetCategoryCount = resolveTargetCategoryCount(detail, options);
  const dictionaryLimit = Math.max(4, targetCategoryCount * 4);
  const categories = cats(detail).slice(0, 20).map((x) => ({
    categoryCode: x.categoryCode,
    categoryName: x.categoryName,
    tableScopes: Array.isArray(x.tableScopes) ? x.tableScopes.slice(0, 3) : [],
  }));
  const dictionaries = dicts(detail).slice(0, dictionaryLimit).map((x) => ({
    dictType: x.dictType,
    dictName: x.dictName,
    categoryCode: x.categoryCode || null,
    itemCount: Array.isArray(x.items) ? x.items.length : 0,
  }));

  return [
    {
      role: "system",
      content: "Return one compact JSON object only. Use snake_case. categories must have exact categoryLimit entries. Each category must include category_code, category_name, description, source_refs, and at least 2 table_scopes or 2 table_details. Each table_detail must include table_name, table_label, table_comment, key_info_items, source_refs. Each dictionary must include category_code, dict_type or dict_name, items, source_refs, and it must reference one category_code from categories. Each dictionary item should include item_code, item_label, source_refs. Never output object placeholders such as [object Object], object_object, table_object, dict_object. In industry mode, do not repeat any existing category_code or category_name.",
    },
    {
      role: "user",
      content: JSON.stringify({
        mode: options.mode === "category" ? "category" : "industry",
        industryCode: detail.industryCode,
        incubationName: detail.incubationName,
        existingCategories: categories,
        existingDictionaries: dictionaries,
        targetCategoryCode: options.targetCategoryCode || null,
        targetCategoryName: options.targetCategoryName || null,
        outputRules: {
          categoryLimit: targetCategoryCount,
          categoryExactCount: true,
          tablePerCategoryLimit: 2,
          tablePerCategoryMin: 2,
          dictionaryLimit,
          itemPerDictionaryLimit: 8,
          dictionaryMustBindCategory: true,
          avoidExistingCategories: options.mode !== "category",
          requireSourceRefs: true,
        },
      }, null, 2),
    },
  ];
}

function buildEvidenceItems(metadata = {}, existingEvidence = {}) {
  const candidates = [
    ...(Array.isArray(metadata.categories) ? metadata.categories.flatMap((item) => item.sourceRefs || []) : []),
    ...(Array.isArray(metadata.categories) ? metadata.categories.flatMap((item) => (item.tableDetails || []).flatMap((entry) => entry.sourceRefs || [])) : []),
    ...(Array.isArray(metadata.dictionaries) ? metadata.dictionaries.flatMap((item) => item.sourceRefs || []) : []),
    ...(Array.isArray(metadata.dictionaries) ? metadata.dictionaries.flatMap((item) => (item.items || []).flatMap((entry) => entry.sourceRefs || [])) : []),
  ]
    .map((item) => text(item, 240))
    .filter(Boolean);
  const existingItems = Array.isArray(existingEvidence?.items) ? existingEvidence.items : [];
  const seen = new Set();
  const nextItems = [];
  for (const item of [...existingItems, ...candidates.map((ref, index) => ({
    id: `evidence_${Date.now()}_${index + 1}`,
    title: ref.length > 64 ? ref.slice(0, 64) : ref,
    authority: "模型抽取",
    sourceUrl: /^https?:\/\//i.test(ref) ? ref : "",
    sourceType: "model_reference",
    publishedAt: null,
    summary: ref,
  }))]) {
    const key = `${item.sourceUrl || ""}|${item.title || ""}|${item.summary || ""}`;
    if (!key.trim() || seen.has(key)) continue;
    seen.add(key);
    nextItems.push(item);
  }
  return { items: nextItems.slice(0, 50) };
}

function normTableDetail(d = {}) {
  const rawTableName = typeof d === "string"
    ? d
    : d.tableName || d.table_name || d.tableCode || d.table_code || d.tableLabel || d.table_label || d.tableScope || d.table_scope || d.name;
  const tableName = code(
    rawTableName,
    "table"
  );
  const rawTableLabel = typeof d === "string"
    ? d
    : d.tableLabel || d.table_label || d.tableComment || d.table_comment || rawTableName || tableName;
  const rawTableComment = typeof d === "string"
    ? d
    : d.tableComment || d.table_comment || d.tableLabel || d.table_label || rawTableName || tableName;
  return {
    tableName,
    tableLabel: text(rawTableLabel || "未命名表", 64),
    tableComment: text(rawTableComment || "", 160),
    keyInfoItems: Array.isArray(d.keyInfoItems || d.key_info_items)
      ? (d.keyInfoItems || d.key_info_items).map(String).filter(Boolean).slice(0, 8)
      : [],
    sourceRefs: Array.isArray(d.sourceRefs || d.source_refs)
      ? (d.sourceRefs || d.source_refs).map(String).filter(Boolean).slice(0, 8)
      : [],
  };
}

function normCategory(x = {}) {
  const tableDetailsRaw = Array.isArray(x.tableDetails)
    ? x.tableDetails
    : Array.isArray(x.table_details)
      ? x.table_details
      : Array.isArray(x.tables)
        ? x.tables
        : [];
  const tableScopesRaw = Array.isArray(x.tableScopes)
    ? x.tableScopes
    : Array.isArray(x.table_scopes)
      ? x.table_scopes
      : [];
  let tableDetails = tableDetailsRaw.slice(0, 8).map((d, idx) => {
    const normalized = normTableDetail(d);
    const scope = tableScopesRaw[idx];
    if (scope && /^table_\d+$/.test(normalized.tableName)) {
      return normTableDetail({
        ...normalized,
        tableName: scope,
        tableLabel: normalized.tableLabel === "未命名表" ? scope : normalized.tableLabel,
      });
    }
    return normalized;
  });
  if (!tableDetails.length && tableScopesRaw.length) {
    tableDetails = tableScopesRaw.slice(0, 8).map((s) => normTableDetail({ tableName: s, tableLabel: s, tableComment: s }));
  }

  return {
    categoryCode: code(x.categoryCode || x.category_code || x.code || x.categoryName || x.category_name, "category"),
    categoryName: text(x.categoryName || x.category_name || x.name || x.categoryCode || x.category_code || "未命名类目", 64),
    description: text(x.description || x.desc || "", 160),
    tableScopes: (tableScopesRaw.length ? tableScopesRaw : tableDetails.map((d) => d.tableName))
      .map(String)
      .filter(Boolean)
      .slice(0, 12),
    tableDetails,
    sourceRefs: Array.isArray(x.sourceRefs || x.source_refs)
      ? (x.sourceRefs || x.source_refs).map(String).filter(Boolean).slice(0, 8)
      : [],
    continueIteration: (x.continueIteration ?? x.continue_iteration) !== false,
  };
}

function buildFallbackTableDetails(category = {}) {
  const categoryCode = code(category.categoryCode || category.categoryName, "category");
  const categoryName = text(category.categoryName || category.categoryCode || "未命名类目", 64);
  return [
    normTableDetail({
      tableName: `${categoryCode}_ledger`,
      tableLabel: `${categoryName}台账`,
      tableComment: `${categoryName}业务台账`,
    }),
    normTableDetail({
      tableName: `${categoryCode}_record`,
      tableLabel: `${categoryName}记录`,
      tableComment: `${categoryName}处置记录`,
    }),
  ];
}

function ensureCategoryTables(category = {}) {
  const normalized = normCategory(category);
  const nextDetails = Array.isArray(normalized.tableDetails) ? normalized.tableDetails.map((item) => normTableDetail(item)) : [];
  const usedNames = new Set(nextDetails.map((item) => item.tableName));
  const fallbackDetails = buildFallbackTableDetails(normalized);
  for (const item of fallbackDetails) {
    if (nextDetails.length >= 2) break;
    if (usedNames.has(item.tableName)) continue;
    nextDetails.push(item);
    usedNames.add(item.tableName);
  }
  return {
    ...normalized,
    tableDetails: nextDetails,
    tableScopes: nextDetails.map((item) => item.tableName),
  };
}

function normDict(x = {}) {
  const itemsRaw = Array.isArray(x.items) ? x.items : [];
  return {
    dictType: code(x.dictType || x.dict_type || x.dictCode || x.dict_code || x.dictName || x.dict_name, "dict"),
    dictName: text(x.dictName || x.dict_name || x.name || x.dictType || x.dict_type || "未命名字典", 64),
    categoryCode: x.categoryCode || x.category_code ? code(x.categoryCode || x.category_code, "category") : null,
    sourceRefs: Array.isArray(x.sourceRefs || x.source_refs)
      ? (x.sourceRefs || x.source_refs).map(String).filter(Boolean).slice(0, 8)
      : [],
    items: itemsRaw.slice(0, 30).map((e, i) => {
      if (typeof e === "string") {
        return {
          itemCode: String(i + 1).padStart(2, "0"),
          itemLabel: text(e || "未命名项", 64),
          valueRange: null,
          sourceRefs: [],
        };
      }
      return {
        itemCode: String(e.itemCode || e.item_code || String(i + 1).padStart(2, "0")).trim(),
        itemLabel: text(e.itemLabel || e.item_label || e.itemName || e.item_name || e.itemCode || e.item_code || "未命名项", 64),
        valueRange: text(e.valueRange || e.value_range || "", 64) || null,
        sourceRefs: Array.isArray(e.sourceRefs || e.source_refs)
          ? (e.sourceRefs || e.source_refs).map(String).filter(Boolean).slice(0, 8)
          : [],
      };
    }),
  };
}

function bindDictionaryCategoryCodes(dictionaries = [], categories = []) {
  const categoryCodes = categories.map((c) => String(c.categoryCode || "").trim()).filter(Boolean);
  if (!categoryCodes.length) return dictionaries;
  let assignIndex = 0;
  return dictionaries.map((item) => {
    const current = String(item.categoryCode || "").trim();
    if (current && categoryCodes.includes(current)) return item;
    const nextCode = categoryCodes[assignIndex % categoryCodes.length];
    assignIndex += 1;
    return { ...item, categoryCode: nextCode };
  });
}

function getExistingCategories(existingAssets = {}) {
  const categoryTree = existingAssets?.researchCatalog && typeof existingAssets.researchCatalog === "object"
    ? existingAssets.researchCatalog.categoryTree
    : [];
  return Array.isArray(categoryTree) ? categoryTree.map(normCategory) : [];
}

function getExistingDictionaries(existingAssets = {}) {
  return Array.isArray(existingAssets?.dictionaries) ? existingAssets.dictionaries.map(normDict) : [];
}

function parseModelJson(textValue) {
  const raw = String(textValue || "").trim();
  if (!raw) return {};

  const candidates = [raw];
  const fence = "```";
  const fenceStart = raw.indexOf(fence);
  if (fenceStart >= 0) {
    const fenceEnd = raw.indexOf(fence, fenceStart + 3);
    if (fenceEnd > fenceStart) {
      let fenced = raw.slice(fenceStart + 3, fenceEnd).trim();
      if (fenced.toLowerCase().startsWith("json")) {
        fenced = fenced.slice(4).trim();
      }
      if (fenced) candidates.push(fenced);
    }
  }

  const objStart = raw.indexOf("{");
  const objEnd = raw.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) {
    candidates.push(raw.slice(objStart, objEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_error) {
      continue;
    }
  }

  return {};
}

function normalizeMetadataResult(parsed, existingAssets = {}, options = {}) {
  const root = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
  const maxCategoryCount = clampInt(options.maxCategoryCount, 1, 8, 2);
  const categories = (Array.isArray(root?.categories) ? root.categories.map(ensureCategoryTables) : []).slice(0, maxCategoryCount);
  const existingCategories = getExistingCategories(existingAssets);
  for (const item of existingCategories) {
    if (categories.length >= maxCategoryCount) break;
    const exists = categories.some((x) => String(x.categoryCode || "") === String(item.categoryCode || ""));
    if (!exists) categories.push(item);
  }
  const candidateTableRaw = Array.isArray(root?.candidateTableSpecs)
    ? root.candidateTableSpecs
    : Array.isArray(root?.candidate_table_specs)
      ? root.candidate_table_specs
      : [];
  const fallbackCategoryTables = categories.flatMap((x) => (Array.isArray(x.tableDetails) ? x.tableDetails : []));
  const candidateTableSource = candidateTableRaw.length ? candidateTableRaw : fallbackCategoryTables;
  const candidateTableSpecs = mergeByKey(
    [],
    candidateTableSource.slice(0, 20).map((d) => normTableDetail(d)),
    (x) => String(x.tableName || "")
  );
  const maxDictionaryCount = Math.max(4, maxCategoryCount * 4);
  const dictionaries = bindDictionaryCategoryCodes(
    (Array.isArray(root?.dictionaries) ? root.dictionaries.map(normDict) : []).slice(0, maxDictionaryCount),
    categories
  );
  const existingDictionaries = getExistingDictionaries(existingAssets);
  for (const item of existingDictionaries) {
    if (dictionaries.length >= maxDictionaryCount) break;
    const hit = dictionaries.some((x) => String(x.dictType || x.dictName || "") === String(item.dictType || item.dictName || ""));
    if (!hit) dictionaries.push(item);
  }
  const allowedCategoryCodes = new Set(categories.map((x) => String(x.categoryCode || "")).filter(Boolean));
  const normalizedDictionaries = bindDictionaryCategoryCodes(
    dictionaries.filter((x) => {
      const cc = String(x.categoryCode || "").trim();
      return !cc || allowedCategoryCodes.has(cc);
    }).slice(0, maxDictionaryCount),
    categories
  );
  return {
    summary: text(root?.summary || root?.industry_name || existingAssets?.researchCatalog?.summary || "行业元数据已更新", 160),
    categories,
    candidateTableSpecs,
    dictionaries: normalizedDictionaries,
  };
}

function mergeByKey(base, extra, keyFn) {
  const map = new Map();
  [...(Array.isArray(base) ? base : []), ...(Array.isArray(extra) ? extra : [])].forEach((x) => map.set(keyFn(x), x));
  return Array.from(map.values());
}

function mergeMetadataAssets(sa, m, options = {}) {
  const a = sa && typeof sa === "object" ? sa : standardAssets();
  const c = a.researchCatalog && typeof a.researchCatalog === "object" ? a.researchCatalog : standardAssets().researchCatalog;
  if (options.mode !== "category") {
    return {
      ...a,
      researchCatalog: {
        ...c,
        summary: m.summary,
        categoryTree: mergeByKey(c.categoryTree || [], m.categories, (x) => String(x.categoryCode || x.categoryName || "")),
        candidateTableSpecs: mergeByKey(c.candidateTableSpecs || [], m.candidateTableSpecs, (x) => String(x.tableName || "")),
      },
      dictionaries: mergeByKey(a.dictionaries || [], m.dictionaries, (x) => String(x.dictType || x.dictName || "")),
    };
  }
  return {
    ...a,
    researchCatalog: {
      ...c,
      summary: m.summary,
      categoryTree: mergeByKey(c.categoryTree || [], m.categories, (x) => String(x.categoryCode || x.categoryName || "")),
      candidateTableSpecs: mergeByKey(c.candidateTableSpecs || [], m.candidateTableSpecs, (x) => String(x.tableName || "")),
    },
    dictionaries: mergeByKey(a.dictionaries || [], m.dictionaries, (x) => String(x.dictType || x.dictName || "")),
  };
}

async function refreshIndustryMetadata(incubationId, user, options = {}) {
  const detail = await getIndustryIncubationDetail(incubationId);
  const targetCategoryCount = resolveTargetCategoryCount(detail, options);
  const roundNo = Number(options.roundNo || detail.latestRoundNo || 0) + 1;
  const startedAt = new Date().toISOString();
  await log(incubationId, { roundNo, logType: "run", stepKey: "refresh_start", message: "开始刷新行业元数据", detail: { mode: options.mode || "industry", purpose: options.purpose || null } });
  const promptConfig = await resolveIndustryMetadataPromptConfig();
  const messages = buildIndustryMetadataPrompt(detail, { ...options, targetCategoryCount });
  await log(incubationId, {
    roundNo,
    logType: "model",
    stepKey: "industry_metadata_model_request",
    message: "行业元数据抽取模型请求已发送：" + (promptConfig.provider.modelName || promptConfig.provider.configName || "chat_model"),
    requestPayload: { provider: { id: Number(promptConfig.provider.id), configName: promptConfig.provider.configName, modelName: promptConfig.provider.modelName }, temperature: promptConfig.temperature, maxTokens: promptConfig.maxTokens },
  });
  try {
    const response = await modelProviderService.generateChatCompletion(
      promptConfig.provider,
      messages,
      {
        temperature: promptConfig.temperature,
        maxTokens: promptConfig.maxTokens,
        timeoutMs: 120000,
        responseFormat: { type: "json_object" },
      }
    );
    const parsed = parseModelJson(response.content);
    const metadata = normalizeMetadataResult(parsed, detail.standardAssets || {}, { maxCategoryCount: targetCategoryCount });
    metadata.categories = (Array.isArray(metadata.categories) ? metadata.categories : []).map((item) => ({
      ...ensureCategoryTables(item),
      lastRoundNo: roundNo,
    }));
    const nextStandardAssets = mergeMetadataAssets(detail.standardAssets, metadata, { mode: options.mode || "industry" });
    const nextCategoryTree = Array.isArray(nextStandardAssets?.researchCatalog?.categoryTree)
      ? nextStandardAssets.researchCatalog.categoryTree.map((item) => ensureCategoryTables(item))
      : [];
    const nextCandidateTableSpecs = mergeByKey(
      Array.isArray(nextStandardAssets?.researchCatalog?.candidateTableSpecs) ? nextStandardAssets.researchCatalog.candidateTableSpecs : [],
      nextCategoryTree.flatMap((item) => item.tableDetails || []),
      (x) => String(x.tableName || "")
    );
    nextStandardAssets.researchCatalog = {
      ...(nextStandardAssets.researchCatalog || {}),
      categoryTree: nextCategoryTree,
      candidateTableSpecs: nextCandidateTableSpecs,
    };
    const nextEvidenceCatalog = buildEvidenceItems({ ...metadata, categories: nextCategoryTree, dictionaries: nextStandardAssets.dictionaries || [] }, detail.evidenceCatalog || {});
    const nextTraining = trainingSettings({
      ...detail.trainingSettings,
      runState: {
        ...detail.trainingSettings.runState,
        totalRounds: Math.max(Number(detail.trainingSettings?.runState?.totalRounds || 0), roundNo),
        taskCurrentRoundNo: roundNo,
      },
    });
    await pool.query(
      "UPDATE lab_industry_incubation SET standard_assets_json = ?, evidence_catalog_json = ?, training_settings_json = ?, latest_round_no = ?, last_synced_at = NOW() WHERE id = ?",
      [JSON.stringify(nextStandardAssets), JSON.stringify(nextEvidenceCatalog), JSON.stringify(nextTraining), roundNo, Number(incubationId)]
    );
    await pool.query(
      "INSERT INTO lab_industry_incubation_round (incubation_id, round_no, round_name, round_status, selected_scenarios_json, evidence_snapshot_json, committee_snapshot_json, result_summary_json, enhancement_delta_json, started_at, ended_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE round_name = VALUES(round_name), round_status = VALUES(round_status), result_summary_json = VALUES(result_summary_json), enhancement_delta_json = VALUES(enhancement_delta_json), started_at = VALUES(started_at), ended_at = VALUES(ended_at), updated_at = NOW()",
      [
        Number(incubationId),
        roundNo,
        `round_${roundNo}`,
        "completed",
        JSON.stringify([]),
        JSON.stringify(nextEvidenceCatalog.items || []),
        JSON.stringify({ mode: "lightweight_metadata", targetCategoryCount }),
        JSON.stringify({
          summary: metadata.summary,
          categoryCount: nextCategoryTree.length,
          tableCount: nextCandidateTableSpecs.length,
          dictionaryCount: Array.isArray(nextStandardAssets.dictionaries) ? nextStandardAssets.dictionaries.length : 0,
        }),
        JSON.stringify({
          mode: options.mode || "industry",
          targetCategoryCount,
          categoryCodes: metadata.categories.map((item) => item.categoryCode),
        }),
        new Date(startedAt),
        new Date(),
        user?.displayName || user?.username || "system",
      ]
    );
    await log(incubationId, { roundNo, logType: "model", stepKey: "industry_metadata_model_response", message: "行业元数据抽取模型已返回结果", responsePayload: { parsed, checkedEndpoint: response.raw?.checkedEndpoint || null, adapted: Boolean(response.raw?.adapted) } });
    await log(incubationId, { roundNo, logType: "metadata", stepKey: "metadata_merged", message: "行业元数据已合并", detail: { categoryCount: nextCategoryTree.length, candidateTableCount: nextCandidateTableSpecs.length, dictionaryCount: Array.isArray(nextStandardAssets.dictionaries) ? nextStandardAssets.dictionaries.length : 0, evidenceCount: Array.isArray(nextEvidenceCatalog.items) ? nextEvidenceCatalog.items.length : 0 } });
    return getIndustryIncubationDetail(incubationId);
  } catch (error) {
    await log(incubationId, { roundNo, logLevel: "error", logType: "model", stepKey: "industry_metadata_model_error", message: error.message || "行业元数据抽取模型调用失败", detail: { errorMessage: error.message || null, suggestions: Array.isArray(error?.details?.suggestions) ? error.details.suggestions : [], endpointCandidates: Array.isArray(error?.details?.endpointCandidates) ? error.details.endpointCandidates : [], attemptedEndpoint: error?.details?.attemptedEndpoint || null, recommendedMaxTokens: error?.details?.recommendedMaxTokens || null } });
    if (options?.suppressThrow) {
      return {
        __failed: true,
        errorMessage: error.message || "行业元数据抽取模型调用失败",
        details: error?.details || null,
      };
    }
    throw error;
  }
}

async function runIncubationJob(incubationId, user, options = {}) {
  try {
    const refreshResult = await refreshIndustryMetadata(incubationId, user, { ...options, mode: options.mode || "industry", purpose: "async_run", suppressThrow: true });
    if (refreshResult && refreshResult.__failed) {
      const detail = await getIndustryIncubationDetail(incubationId).catch(() => null);
      if (detail) {
        const nextTraining = trainingSettings({
          ...detail.trainingSettings,
          runState: {
            ...detail.trainingSettings.runState,
            status: "failed",
            stopRequested: false,
            endedAt: new Date().toISOString(),
            lastError: refreshResult.errorMessage || "行业孵化运行失败",
          },
        });
        await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(nextTraining), Number(incubationId)]);
      }
      await log(incubationId, {
        logLevel: "error",
        logType: "run",
        stepKey: "job_failed",
        message: refreshResult.errorMessage || "行业孵化运行失败",
        detail: {
          attemptedEndpoint: refreshResult?.details?.attemptedEndpoint || null,
          endpointCandidates: Array.isArray(refreshResult?.details?.endpointCandidates) ? refreshResult.details.endpointCandidates : [],
          suggestions: Array.isArray(refreshResult?.details?.suggestions) ? refreshResult.details.suggestions : [],
          recommendedMaxTokens: refreshResult?.details?.recommendedMaxTokens || null,
        },
      });
      return { ok: false, errorMessage: refreshResult.errorMessage || "行业孵化运行失败" };
    }
    const detail = await getIndustryIncubationDetail(incubationId);
    const nextTraining = trainingSettings({ ...detail.trainingSettings, runState: { ...detail.trainingSettings.runState, status: "completed", stopRequested: false, endedAt: new Date().toISOString(), lastError: null } });
    await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(nextTraining), Number(incubationId)]);
    await log(incubationId, { logType: "run", stepKey: "job_end", message: "行业孵化任务已结束，状态为 completed" });
  } catch (error) {
    const detail = await getIndustryIncubationDetail(incubationId).catch(() => null);
    if (detail) {
      const nextTraining = trainingSettings({ ...detail.trainingSettings, runState: { ...detail.trainingSettings.runState, status: "failed", stopRequested: false, endedAt: new Date().toISOString(), lastError: error.message || "行业孵化运行失败" } });
      await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(nextTraining), Number(incubationId)]);
    }
    await log(incubationId, { logLevel: "error", logType: "run", stepKey: "job_failed", message: error.message || "行业孵化运行失败", detail: { stack: error.stack || null } });
    return { ok: false, errorMessage: error.message || "行业孵化运行失败" };
  } finally {
    jobs.delete(Number(incubationId));
  }
}

async function startIndustryIncubationRun(incubationId, payload, user) {
  const detail = await getIndustryIncubationDetail(incubationId);
  const runState = trainingSettings(detail.trainingSettings).runState;
  const job = jobs.get(Number(incubationId));
  if (runState.status === "running" || runState.status === "stopping") {
    if (!job) {
      const recoveredTraining = trainingSettings({
        ...detail.trainingSettings,
        runState: {
          ...runState,
          status: "failed",
          stopRequested: false,
          endedAt: new Date().toISOString(),
          lastError: runState.lastError || "检测到历史运行状态残留，已自动恢复为失败，请重新发起运行。",
        },
      });
      await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(recoveredTraining), Number(incubationId)]);
      await log(incubationId, { logLevel: "warn", logType: "run", stepKey: "stale_run_state_recovered", message: "检测到历史运行状态残留，已自动恢复为 failed，请重新发起运行" });
    } else {
      throw new AppError("当前行业孵化任务正在运行", 400);
    }
  }
  const nextTraining = trainingSettings({ ...detail.trainingSettings, runState: { ...runState, status: "running", mode: payload?.categoryCode || payload?.categoryName ? "category" : "industry", stopRequested: false, startedAt: new Date().toISOString(), endedAt: null, lastError: null, targetCategoryCode: payload?.categoryCode || null, targetCategoryName: payload?.categoryName || null } });
  await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(nextTraining), Number(incubationId)]);
  await log(incubationId, { logType: "run", stepKey: "start_requested", message: "用户已发起行业孵化任务", requestPayload: payload || {} });
  const nextJob = { stopRequested: false };
  jobs.set(Number(incubationId), nextJob);
  nextJob.promise = runIncubationJob(incubationId, user, payload || {}).catch(async (error) => {
    await log(incubationId, {
      logLevel: "error",
      logType: "run",
      stepKey: "job_unhandled_error",
      message: error?.message || "行业孵化后台任务出现未处理异常",
      detail: { stack: error?.stack || null },
    }).catch(() => null);
    return { ok: false, errorMessage: error?.message || "行业孵化后台任务出现未处理异常" };
  });
  return getIndustryIncubationDetail(incubationId);
}

async function stopIndustryIncubationRun(incubationId) {
  const detail = await getIndustryIncubationDetail(incubationId);
  const runState = trainingSettings(detail.trainingSettings).runState;
  const job = jobs.get(Number(incubationId));
  const hasLiveJob = Boolean(job);
  const nextTraining = trainingSettings({
    ...detail.trainingSettings,
    runState: {
      ...runState,
      status: hasLiveJob ? (runState.status === "running" ? "stopping" : "stopped") : "stopped",
      stopRequested: hasLiveJob,
      endedAt: hasLiveJob ? runState.endedAt || null : new Date().toISOString(),
    },
  });
  if (job) job.stopRequested = true;
  await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(nextTraining), Number(incubationId)]);
  await log(incubationId, { logType: "run", stepKey: "stop_requested", message: hasLiveJob ? "用户已请求停止行业孵化任务" : "未发现运行中的后台任务，状态已更新为 stopped" });
  return getIndustryIncubationDetail(incubationId);
}

async function updateIndustryCategoryIteration(incubationId, payload = {}) {
  const detail = await getIndustryIncubationDetail(incubationId);
  const assets = detail.standardAssets && typeof detail.standardAssets === "object" ? detail.standardAssets : standardAssets();
  const catalog = assets.researchCatalog && typeof assets.researchCatalog === "object" ? assets.researchCatalog : standardAssets().researchCatalog;
  const categories = Array.isArray(catalog.categoryTree) ? catalog.categoryTree : [];
  const nextCategories = categories.map((item) => {
    const hit = (payload.categoryCode && String(item.categoryCode || "") === String(payload.categoryCode || "")) || (payload.categoryName && String(item.categoryName || "") === String(payload.categoryName || ""));
    return hit ? { ...item, continueIteration: Boolean(payload.continueIteration) } : item;
  });
  const nextAssets = { ...assets, researchCatalog: { ...catalog, categoryTree: nextCategories } };
  await pool.query("UPDATE lab_industry_incubation SET standard_assets_json = ? WHERE id = ?", [JSON.stringify(nextAssets), Number(incubationId)]);
  return getIndustryIncubationDetail(incubationId);
}

async function syncIndustryIncubationToEnhancement(incubationId, user) {
  const detail = await getIndustryIncubationDetail(incubationId);
  const assets = detail.standardAssets && typeof detail.standardAssets === "object" ? detail.standardAssets : standardAssets();
  const catalog = assets.researchCatalog && typeof assets.researchCatalog === "object" ? assets.researchCatalog : standardAssets().researchCatalog;
  const enhancement = await enhancementService.saveScenarioEnhancement({ id: detail.enhancementProfileId || undefined, profileName: detail.incubationName + "增强包", profileCode: detail.incubationCode, industry: detail.industryCode, profileDesc: detail.incubationDesc || null, locale: "zh-CN", businessStyle: detail.industryCode, confidenceThreshold: 0.72, priority: 10, status: "active", recognition: { aliases: [detail.incubationName], keywords: [detail.incubationName, detail.industryCode], negativeKeywords: [] }, researchCatalog: { summary: catalog.summary || "", categoryTree: Array.isArray(catalog.categoryTree) ? catalog.categoryTree : [], candidateTables: Array.isArray(catalog.categoryTree) ? catalog.categoryTree.flatMap((item) => item.tableScopes || []) : [], candidateTableSpecs: Array.isArray(catalog.candidateTableSpecs) ? catalog.candidateTableSpecs : [], dictSuggestionSpecs: Array.isArray(assets.dictionaries) ? assets.dictionaries : [], sourceRefs: [] }, modulePlanner: { summary: catalog.summary || "", categories: Array.isArray(catalog.categoryTree) ? catalog.categoryTree : [] }, schemaGuides: {}, relationPatterns: [], stateMachines: [], codeRules: [], fieldSemantics: [], valueCorpora: {}, distributionProfiles: {}, qualityGates: {}, realismRules: [], dirtyDataProfiles: {}, trainingAssets: {}, evaluationRubric: {}, overridePolicies: {}, dictionaries: Array.isArray(assets.dictionaries) ? assets.dictionaries : [], distributionRules: [], fieldRules: [], complianceRules: [], pluginBindings: [], extendedRules: [] }, user);
  await pool.query("UPDATE lab_industry_incubation SET enhancement_profile_id = ?, last_synced_at = NOW() WHERE id = ?", [Number(enhancement.id), Number(incubationId)]);
  return { incubation: await getIndustryIncubationDetail(incubationId), enhancement };
}

async function rebuildIndustryIncubationDictionaryOwnership(incubationId) { return getIndustryIncubationDetail(incubationId); }
async function generateIndustryIncubationRound() { throw new AppError("当前行业孵化已切换为轻量元数据刷新模式，round 训练流程已停用", 400); }
async function updateIndustryIncubationRound() { throw new AppError("当前行业孵化已切换为轻量元数据刷新模式，round 更新流程已停用", 400); }
async function executeIndustryIncubationRound() { throw new AppError("当前行业孵化已切换为轻量元数据刷新模式，round 执行流程已停用", 400); }

module.exports = {
  listIndustryIncubations,
  getIndustryIncubationDetail,
  getIndustryIncubationStats,
  listIndustryIncubationLogs,
  saveIndustryIncubation,
  deleteIndustryIncubation,
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
