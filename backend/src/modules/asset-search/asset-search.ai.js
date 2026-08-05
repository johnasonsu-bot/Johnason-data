const modelProviderService = require("../model-providers/model-provider.service");

const ASSET_TYPES = [
  "table",
  "field",
  "datasource",
  "ingestion_task",
  "quality_rule",
  "quality_strategy",
  "quality_result",
  "service_api",
  "service_app",
];

const SOURCE_MODULES = ["data_map", "ingestion", "quality", "services"];

const SCENE_CODES = {
  interpretation: "asset_search_query_interpretation",
  expansion: "asset_search_query_expansion",
  rerank: "asset_search_result_rerank",
  summary: "asset_search_result_summary",
};

const DEFAULT_PROMPTS = {
  interpretation: [
    "你是企业资产检索的查询理解助手。",
    "只能理解用户检索需求，不能查询数据库，不能生成 SQL，不能编造资产。",
    "只输出 JSON 对象，不要 Markdown。",
    "字段固定为 intent、assetTypes、sourceModules、keywords、chineseKeywords、englishKeywords、fieldKeywords。",
  ].join("\n"),
  expansion: [
    "你是企业资产检索的关键词扩展助手。",
    "只能输出检索关键词，不能查询数据库，不能生成 SQL，不能编造资产。",
    "只输出 JSON 对象，不要 Markdown。",
    "字段固定为 expandedKeywords、fieldKeywords、tableKeywords、serviceKeywords。",
  ].join("\n"),
  rerank: [
    "你是企业资产检索的候选结果重排助手。",
    "只能基于输入候选资产排序，不能新增候选外资产，不能生成 SQL。",
    "只输出 JSON 对象，不要 Markdown。",
    "字段固定为 rankedResults，数组项字段为 id、score、reason、relevant。",
    "relevant 表示候选是否满足用户检索意图；不相关候选必须 relevant=false 且 score<=20。",
  ].join("\n"),
  summary: [
    "你是企业资产检索的结果总结助手。",
    "只能总结输入结果，不能生成候选之外的资产，不能生成 SQL。",
    "只输出 JSON 对象，不要 Markdown。",
    "字段固定为 summary、suggestions、recommendedResults。",
  ].join("\n"),
};

const CONTEXT_KEYS = [
  "fieldName",
  "fieldComment",
  "fieldType",
  "tableName",
  "resourceCode",
  "tableDescription",
  "departmentName",
  "businessSystemName",
  "dataSourceName",
  "catalogName",
  "organizationCatalog",
  "sampleValues",
  "semanticTags",
  "featureTags",
  "sourceName",
  "sourceCode",
  "sourceType",
  "sourceTable",
  "targetTable",
  "serviceName",
  "serviceCode",
  "servicePath",
  "requestMethod",
  "ruleName",
  "ruleCode",
  "ruleType",
  "strategyId",
  "taskName",
  "taskCode",
  "runStatus",
  "issueCount",
];

const STAGE_RUNTIME_GUARDRAILS = {
  rerank: [
    "运行时强约束：rankedResults 每项必须返回 id、score、reason、relevant。",
    "如果候选与用户需求无关、不满足关键条件、无法支撑问题或只是同义词误召回，必须设置 relevant=false，score 不高于 20。",
    "不相关候选不能作为推荐结果；reason 应简短说明为什么不相关。",
  ].join("\n"),
};

function truncate(value, maxLength = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function uniqueStrings(values = [], limit = 30) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeStringArray(value, options = {}) {
  const allowed = options.allowed ? new Set(options.allowed) : null;
  const max = options.max || 20;
  const rawItems = Array.isArray(value)
    ? value
    : String(value || "")
      .split(/[,，、;\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);

  return uniqueStrings(rawItems, max).filter((item) => !allowed || allowed.has(item));
}

function extractJsonObject(text) {
  const normalized = String(text || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const firstBrace = normalized.indexOf("{");
  if (firstBrace < 0) {
    throw new Error("模型响应中未找到 JSON 对象");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = firstBrace; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return normalized.slice(firstBrace, index + 1);
      }
    }
  }

  throw new Error("模型响应中未找到完整 JSON 对象");
}

function parseJsonObjectWithRecovery(text) {
  try {
    const parsed = JSON.parse(String(text || "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to extracting a JSON object from fenced or prefixed output.
  }

  const parsed = JSON.parse(extractJsonObject(text));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("模型响应不是 JSON 对象");
  }
  return parsed;
}

async function resolveStageRuntime(config) {
  if (!config || config.status !== "active" || !config.defaultModelProviderId) {
    return null;
  }

  let provider;
  try {
    provider = await modelProviderService.getModelProviderById(config.defaultModelProviderId);
  } catch {
    return null;
  }

  if (!provider || provider.status !== "active" || provider.modelCategory !== "chat") {
    return null;
  }

  return {
    config,
    provider: {
      ...provider,
      modelName: config.defaultModelName || provider.modelName,
      modelVersion: config.defaultModelVersion || provider.modelVersion || config.defaultModelName || provider.modelName,
    },
  };
}

async function resolveRuntime(configs = []) {
  const configByScene = new Map((configs || []).map((config) => [config.sceneCode, config]));
  const entries = await Promise.all(
    Object.entries(SCENE_CODES).map(async ([stage, sceneCode]) => [stage, await resolveStageRuntime(configByScene.get(sceneCode))])
  );
  return Object.fromEntries(entries);
}

function hasConfiguredStage(runtime = {}) {
  return Object.values(runtime).some(Boolean);
}

function buildModelOptions(stageRuntime, defaults = {}) {
  const config = stageRuntime.config || {};
  return {
    temperature: config.temperature ?? defaults.temperature ?? 0.1,
    maxTokens: Number(config.maxTokens || defaults.maxTokens || 1000),
    timeoutMs: Number(config.timeoutMs || defaults.timeoutMs || 30000),
    responseFormat: { type: "json_object" },
  };
}

function buildJsonMessages(systemPrompt, payload) {
  return [
    {
      role: "system",
      content: `${systemPrompt}\n\nReturn valid JSON only. The response must be a JSON object.`,
    },
    {
      role: "user",
      content: JSON.stringify(payload, null, 2),
    },
  ];
}

async function callJsonStage(stageRuntime, stage, payload, defaults = {}) {
  if (!stageRuntime) return null;
  const basePrompt = stageRuntime.config.systemPrompt || DEFAULT_PROMPTS[stage] || "只输出 JSON 对象。";
  const systemPrompt = [basePrompt, STAGE_RUNTIME_GUARDRAILS[stage]].filter(Boolean).join("\n\n");
  const completion = await modelProviderService.generateChatCompletion(
    stageRuntime.provider,
    buildJsonMessages(systemPrompt, payload),
    buildModelOptions(stageRuntime, defaults)
  );
  return parseJsonObjectWithRecovery(completion.content || "{}");
}

function buildCriteriaPayload(criteria) {
  return {
    keyword: criteria.keyword,
    scopes: criteria.scopes,
    sourceModules: criteria.sourceModules,
    filters: criteria.filters || {},
    allowedAssetTypes: ASSET_TYPES,
    allowedSourceModules: SOURCE_MODULES,
  };
}

async function runQueryEnhancement(criteria, runtime) {
  let interpretation = {};
  let expansion = {};
  const usedStages = [];

  if (runtime.interpretation) {
    interpretation = await callJsonStage(runtime.interpretation, "interpretation", buildCriteriaPayload(criteria), {
      maxTokens: 900,
      temperature: 0.1,
    });
    usedStages.push(SCENE_CODES.interpretation);
  }

  if (runtime.expansion) {
    expansion = await callJsonStage(runtime.expansion, "expansion", {
      ...buildCriteriaPayload(criteria),
      interpretation,
    }, {
      maxTokens: 700,
      temperature: 0.1,
    });
    usedStages.push(SCENE_CODES.expansion);
  }

  const expandedKeywords = uniqueStrings([
    ...(criteria.keywordTerms || []),
    ...normalizeStringArray(interpretation.keywords, { max: 12 }),
    ...normalizeStringArray(interpretation.chineseKeywords, { max: 12 }),
    ...normalizeStringArray(interpretation.englishKeywords, { max: 12 }),
    ...normalizeStringArray(interpretation.fieldKeywords, { max: 12 }),
    ...normalizeStringArray(expansion.expandedKeywords, { max: 12 }),
    ...normalizeStringArray(expansion.fieldKeywords, { max: 12 }),
    ...normalizeStringArray(expansion.tableKeywords, { max: 12 }),
    ...normalizeStringArray(expansion.serviceKeywords, { max: 12 }),
  ], 30);

  return {
    intent: truncate(interpretation.intent || (criteria.keyword ? `检索与“${criteria.keyword}”相关的资产` : "按筛选条件检索资产"), 300),
    expandedKeywords,
    inferredAssetTypes: normalizeStringArray(interpretation.assetTypes, { allowed: ASSET_TYPES, max: 8 }),
    inferredSourceModules: normalizeStringArray(interpretation.sourceModules, { allowed: SOURCE_MODULES, max: 4 }),
    usedStages,
  };
}

function compactContext(context = {}) {
  const output = {};
  for (const key of CONTEXT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(context, key)) continue;
    const value = context[key];
    if (Array.isArray(value)) {
      output[key] = value.slice(0, 8).map((item) => truncate(item, 80));
      continue;
    }
    if (value && typeof value === "object") {
      output[key] = truncate(JSON.stringify(value), 180);
      continue;
    }
    output[key] = truncate(value, 180);
  }
  return output;
}

function summarizeCandidate(result) {
  return {
    id: result.id,
    assetType: result.assetType,
    sourceModule: result.sourceModule,
    title: truncate(result.title, 160),
    subtitle: truncate(result.subtitle, 160),
    description: truncate(result.description, 260),
    status: result.status || "",
    owner: result.owner || "",
    tags: (result.tags || []).slice(0, 8),
    matchedFields: result.matchedFields || [],
    highlights: (result.highlights || []).slice(0, 4).map((item) => ({
      field: item.field,
      text: truncate(item.text, 180),
    })),
    context: compactContext(result.context || {}),
  };
}

function normalizeRankedResults(value, whitelist) {
  const rows = Array.isArray(value) ? value : [];
  const seen = new Set();
  const output = [];

  for (const item of rows) {
    const id = String(item?.id || "").trim();
    if (!id || seen.has(id) || !whitelist.has(id)) continue;
    seen.add(id);
    output.push({
      id,
      score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
      reason: truncate(item.reason, 240),
      relevant: normalizeRelevanceFlag(item),
    });
  }

  return output;
}

function normalizeRelevanceFlag(item = {}) {
  const value = item.relevant ?? item.isRelevant ?? item.related ?? item.isRelated;
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "yes", "y", "1", "相关", "是", "匹配"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "不相关", "无关", "否", "不匹配"].includes(normalized)) return false;
  return null;
}

function isNegatedQuery(keyword = "") {
  return /(不包含|不含|未包含|不需要|没有|排除|缺少)/.test(String(keyword || ""));
}

function hasIrrelevantReason(reason = "", keyword = "") {
  const text = String(reason || "").replace(/\s+/g, "").trim();
  if (!text) return false;
  if (/(不相关|无关|无直接关联|无直接关系|没有关联|没有关系|与.*关系不大|与.*关联不大)/.test(text)) return true;
  if (/(不符合|不满足|无法满足|无法支撑|无法回答|无法确认|无法判断).*(检索|查询|需求|意图|问题|条件)/.test(text)) return true;
  if (/(无法|不能).*(提取|建立|体现|证明|支撑).*(关系|关联|需求|问题)/.test(text)) return true;
  if (!isNegatedQuery(keyword) && /(不包含|不含|不具备|不存储|不存在|缺少|没有).*(字段|关系|关联|信息|条件|关键词|身份证|手机号|国籍|地址|需求)/.test(text)) return true;
  return false;
}

function isAiIrrelevantRank(item, keyword) {
  const modelScore = clampScore(item?.score);
  if (item?.relevant === false) return true;
  if (hasIrrelevantReason(item?.reason, keyword)) return true;
  if (item?.relevant === true) return false;
  return modelScore !== null && modelScore <= 5;
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.min(Math.max(score, 0), 100);
}

async function rerankResults(criteria, results, runtime, queryInsight) {
  if (!runtime.rerank || results.length <= 1) {
    return { results, usedStages: [] };
  }

  const candidates = results.slice(0, 50).map(summarizeCandidate);
  const whitelist = new Set(candidates.map((item) => item.id));
  const parsed = await callJsonStage(runtime.rerank, "rerank", {
    keyword: criteria.keyword,
    intent: queryInsight.intent,
    expandedKeywords: queryInsight.expandedKeywords,
    candidates,
  }, {
    maxTokens: 1400,
    temperature: 0.1,
  });

  const ranked = normalizeRankedResults(parsed.rankedResults, whitelist)
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
  if (ranked.length === 0) {
    return { results, usedStages: [SCENE_CODES.rerank] };
  }

  const rankedById = new Map(ranked.map((item) => [item.id, item]));
  const maxBaseScore = Math.max(...results.map((item) => Number(item.score || 0)), 1);
  const ordered = results.filter((result) => whitelist.has(result.id)).map((result) => {
    const item = rankedById.get(result.id);
    const modelScore = clampScore(item?.score);
    const normalizedBaseScore = (Number(result.score || 0) / maxBaseScore) * 100;
    const aiBlendScore = modelScore === null
      ? normalizedBaseScore * 0.8
      : (normalizedBaseScore * 0.8) + (modelScore * 0.2);

    return {
      ...result,
      context: {
        ...(result.context || {}),
        ...(item?.reason ? { aiReason: item.reason } : {}),
        ...(modelScore === null ? {} : { aiScore: modelScore }),
        ...(item?.relevant === null || item?.relevant === undefined ? {} : { aiRelevant: item.relevant }),
        aiBlendScore: Number(aiBlendScore.toFixed(2)),
      },
    };
  }).filter((result) => {
    const item = rankedById.get(result.id);
    return !item || !isAiIrrelevantRank(item, criteria.keyword);
  }).sort((left, right) => {
    const leftBlend = Number(left.context?.aiBlendScore || 0);
    const rightBlend = Number(right.context?.aiBlendScore || 0);
    if (rightBlend !== leftBlend) return rightBlend - leftBlend;
    return Number(right.score || 0) - Number(left.score || 0);
  });

  return {
    results: ordered,
    usedStages: [SCENE_CODES.rerank],
  };
}

function normalizeRecommendedResults(value, whitelist) {
  const rows = Array.isArray(value) ? value : [];
  const seen = new Set();
  const output = [];
  for (const item of rows) {
    const id = String(item?.id || "").trim();
    if (!id || seen.has(id) || !whitelist.has(id)) continue;
    seen.add(id);
    output.push({
      id,
      reason: truncate(item.reason, 240),
    });
  }
  return output.slice(0, 8);
}

function buildDeterministicSummary(criteria, results, queryInsight) {
  const byType = results.reduce((acc, item) => {
    acc[item.assetType] = (acc[item.assetType] || 0) + 1;
    return acc;
  }, {});
  const topTypes = Object.entries(byType)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([type, count]) => `${type} ${count} 个`);

  return {
    enabled: true,
    intent: queryInsight.intent || (criteria.keyword ? `检索与“${criteria.keyword}”相关的资产` : "按筛选条件检索资产"),
    expandedKeywords: queryInsight.expandedKeywords || [],
    summary: results.length > 0
      ? `基于授权候选资产完成检索，共找到 ${results.length} 个结果${topTypes.length ? `，主要包括 ${topTypes.join("、")}` : ""}。`
      : "基于授权候选资产完成检索，当前条件没有召回结果。",
    suggestions: results.length > 0
      ? ["优先查看命中原因最明确的结果。", "如结果过多，可继续限定资产类型、来源模块或数据源。"]
      : ["尝试改用更短的字段名、业务关键词或英文列名。"],
    recommendedResults: results.slice(0, 5).map((item) => ({
      id: item.id,
      reason: item.context?.aiReason || item.highlights?.[0]?.text || "普通召回得分靠前",
    })),
  };
}

async function summarizeResults(criteria, results, runtime, queryInsight) {
  const base = buildDeterministicSummary(criteria, results, queryInsight);
  if (!runtime.summary || results.length === 0) {
    return { ai: base, usedStages: [] };
  }

  const candidates = results.slice(0, 20).map(summarizeCandidate);
  const whitelist = new Set(candidates.map((item) => item.id));
  const parsed = await callJsonStage(runtime.summary, "summary", {
    keyword: criteria.keyword,
    intent: queryInsight.intent,
    expandedKeywords: queryInsight.expandedKeywords,
    results: candidates,
  }, {
    maxTokens: 1200,
    temperature: 0.2,
  });

  return {
    ai: {
      ...base,
      summary: truncate(parsed.summary || base.summary, 1200),
      suggestions: normalizeStringArray(parsed.suggestions, { max: 8 }).length
        ? normalizeStringArray(parsed.suggestions, { max: 8 })
        : base.suggestions,
      recommendedResults: normalizeRecommendedResults(parsed.recommendedResults, whitelist).length
        ? normalizeRecommendedResults(parsed.recommendedResults, whitelist)
        : base.recommendedResults,
    },
    usedStages: [SCENE_CODES.summary],
  };
}

module.exports = {
  SCENE_CODES,
  hasConfiguredStage,
  rerankResults,
  resolveRuntime,
  runQueryEnhancement,
  summarizeResults,
};
