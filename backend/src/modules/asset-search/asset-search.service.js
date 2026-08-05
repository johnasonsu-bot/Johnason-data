const AppError = require("../../common/errors/app-error");
const repository = require("./asset-search.repository");
const aiAssistant = require("./asset-search.ai");
const dataMapAdapter = require("./adapters/data-map.adapter");
const ingestionAdapter = require("./adapters/ingestion.adapter");
const qualityAdapter = require("./adapters/quality.adapter");
const servicesAdapter = require("./adapters/services.adapter");
const modelProviderService = require("../model-providers/model-provider.service");
const metadataService = require("../data-sources/data-source.metadata");

const MODULE_PERMISSION_MAP = {
  data_map: "data_map",
  ingestion: "ingestion",
  quality: "quality",
  services: "services",
};

const ADAPTERS = {
  data_map: dataMapAdapter,
  ingestion: ingestionAdapter,
  quality: qualityAdapter,
  services: servicesAdapter,
};

function userModulePermissions(user) {
  return new Set(Array.isArray(user?.permissions?.modules) ? user.permissions.modules : []);
}

function resolveAuthorizedModules(user, requestedModules = []) {
  const permissions = userModulePermissions(user);
  const requested = requestedModules.length > 0 ? requestedModules : repository.SOURCE_MODULES;
  return requested.filter((moduleName) => permissions.has(MODULE_PERMISSION_MAP[moduleName]));
}

function normalizeCriteria(payload, user) {
  const filters = { ...(payload.filters || {}) };
  const dataSourceRef = String(filters.dataSourceRef || "").trim();
  let requestedModules = payload.sourceModules || [];

  if (dataSourceRef.includes(":")) {
    const [sourceModule, rawId] = dataSourceRef.split(":");
    if (repository.SOURCE_MODULES.includes(sourceModule)) {
      filters.dataSourceModule = sourceModule;
      filters.dataSourceId = rawId;
      requestedModules = requestedModules.length > 0
        ? requestedModules.filter((moduleName) => moduleName === sourceModule)
        : [sourceModule];
    }
  }

  const authorizedModules = resolveAuthorizedModules(user, requestedModules);
  const keyword = String(payload.keyword || "").trim();
  return {
    keyword,
    keywordTerms: repository.normalizeKeywordTerms(keyword),
    priorityTerms: repository.normalizePriorityTerms(keyword),
    aiEnabled: Boolean(payload.aiEnabled),
    scopes: Array.isArray(payload.scopes) ? payload.scopes : [],
    sourceModules: authorizedModules,
    filters,
    limit: repository.clampLimit(payload.limit),
  };
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

function applyAiExpandedKeywords(criteria, expandedKeywords = []) {
  const extraTerms = repository.normalizeKeywordTerms(uniqueStrings(expandedKeywords, 30).join(" "));
  return {
    ...criteria,
    keywordTerms: uniqueStrings([
      ...(criteria.keywordTerms || []),
      ...expandedKeywords,
      ...extraTerms,
    ], 30),
  };
}

function expandAiRecallCriteria(criteria) {
  return {
    ...criteria,
    limit: Math.min(Math.max(Number(criteria.limit || 100), 50), 500),
  };
}

function dedupeResults(results = []) {
  const seen = new Map();
  for (const result of results) {
    if (!result?.id) continue;
    const existing = seen.get(result.id);
    if (!existing || Number(result.score || 0) > Number(existing.score || 0)) {
      seen.set(result.id, result);
    }
  }
  return Array.from(seen.values());
}

async function runAdapterSearch(criteria) {
  const adapterEntries = criteria.sourceModules.map((moduleName) => [moduleName, ADAPTERS[moduleName]]).filter(([, adapter]) => adapter);
  const settled = await Promise.allSettled(adapterEntries.map(([, adapter]) => adapter.search(criteria)));
  const results = dedupeResults(settled.flatMap((item) => item.status === "fulfilled" ? item.value : []))
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
    .slice(0, criteria.limit);

  return {
    results,
    errors: settled
      .map((item, index) => item.status === "rejected"
        ? { sourceModule: adapterEntries[index]?.[0] || "unknown", message: item.reason?.message || "检索失败" }
        : null)
      .filter(Boolean),
  };
}

function buildStats(results = []) {
  const byAssetType = {};
  const bySourceModule = {};
  const byStatus = {};
  for (const result of results) {
    byAssetType[result.assetType] = (byAssetType[result.assetType] || 0) + 1;
    bySourceModule[result.sourceModule] = (bySourceModule[result.sourceModule] || 0) + 1;
    if (result.status) {
      byStatus[result.status] = (byStatus[result.status] || 0) + 1;
    }
  }
  return {
    total: results.length,
    byAssetType,
    bySourceModule,
    byStatus,
  };
}

function buildFacets(results = []) {
  const stats = buildStats(results);
  const toFacet = (values) => Object.entries(values)
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => Number(right.count) - Number(left.count));

  return {
    assetTypes: toFacet(stats.byAssetType),
    sourceModules: toFacet(stats.bySourceModule),
    statuses: toFacet(stats.byStatus),
  };
}

function buildAiFallback(criteria, results, fallbackReason = "asset_search_ai_not_configured") {
  if (!criteria.aiEnabled) {
    return {
      enabled: false,
      intent: "",
      expandedKeywords: [],
      summary: "",
      suggestions: [],
      fallbackReason: "",
    };
  }

  const topTypes = Object.entries(buildStats(results).byAssetType)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([type, count]) => `${repository.ASSET_TYPE_LABELS[type] || type} ${count} 个`);

  return {
    enabled: false,
    intent: criteria.keyword ? `已按关键词召回候选资产：${criteria.keyword}` : "已按筛选条件召回候选资产",
    expandedKeywords: criteria.keywordTerms,
    summary: topTypes.length > 0
      ? `AI 辅助当前不可用，已降级为普通检索。本次结构化召回包含 ${topTypes.join("、")}。`
      : "AI 辅助当前不可用，已降级为普通检索，当前条件没有召回候选资产。",
    suggestions: [
      "如需字段定位，可直接输入字段名、字段注释或英文列名。",
      "如需跨模块收敛，可限制来源模块或资产类型后再次检索。",
    ],
    recommendedResults: [],
    fallbackReason,
  };
}

function buildSearchResponse(criteria, mode, ai, searchOutput) {
  const results = searchOutput.results || [];
  return {
    mode,
    keyword: criteria.keyword,
    ai,
    results,
    facets: buildFacets(results),
    stats: buildStats(results),
    errors: searchOutput.errors || [],
  };
}

async function searchBasic(criteria, fallbackReason = "") {
  const output = await runAdapterSearch(criteria);
  return buildSearchResponse(
    criteria,
    criteria.aiEnabled ? "basic_fallback" : "basic",
    fallbackReason ? buildAiFallback(criteria, output.results, fallbackReason) : buildAiFallback({ ...criteria, aiEnabled: false }, output.results),
    output
  );
}

function getConfiguredStages(runtime = {}) {
  return Object.entries(runtime)
    .filter(([, stageRuntime]) => Boolean(stageRuntime))
    .map(([stage]) => aiAssistant.SCENE_CODES[stage] || stage);
}

async function saveAiRunSafely(payload, user) {
  try {
    await repository.saveAiRun(payload, user);
  } catch {
    // Search availability must not depend on audit persistence.
  }
}

async function searchWithAi(criteria, user) {
  const startedAt = Date.now();
  const runtime = await aiAssistant.resolveRuntime(await repository.listActiveAiConfigs());
  const configuredStages = getConfiguredStages(runtime);
  if (!aiAssistant.hasConfiguredStage(runtime)) {
    const response = await searchBasic(criteria, "asset_search_ai_not_configured");
    await saveAiRunSafely({
      keyword: criteria.keyword,
      mode: response.mode,
      status: "fallback",
      fallbackReason: response.ai?.fallbackReason || "asset_search_ai_not_configured",
      sourceModules: criteria.sourceModules,
      scopes: criteria.scopes,
      configuredStages,
      usedStages: [],
      candidateCount: response.results.length,
      resultCount: response.results.length,
      durationMs: Date.now() - startedAt,
    }, user);
    return response;
  }

  let queryInsight = null;
  let candidateCount = 0;
  try {
    queryInsight = await aiAssistant.runQueryEnhancement(criteria, runtime);
    const aiCriteria = applyAiExpandedKeywords(criteria, queryInsight.expandedKeywords);
    const output = await runAdapterSearch(expandAiRecallCriteria(aiCriteria));
    candidateCount = output.results.length;
    const rerankOutput = await aiAssistant.rerankResults(aiCriteria, output.results, runtime, queryInsight);
    const limitedResults = rerankOutput.results.slice(0, criteria.limit);
    const summaryOutput = await aiAssistant.summarizeResults(aiCriteria, limitedResults, runtime, queryInsight);
    const usedStages = uniqueStrings([
      ...(queryInsight.usedStages || []),
      ...(rerankOutput.usedStages || []),
      ...(summaryOutput.usedStages || []),
    ], 10);

    const response = buildSearchResponse(criteria, "ai", {
      ...summaryOutput.ai,
      enabled: true,
      fallbackReason: "",
      usedStages,
    }, {
      results: limitedResults,
      errors: output.errors,
    });

    await saveAiRunSafely({
      keyword: criteria.keyword,
      mode: response.mode,
      status: "success",
      fallbackReason: "",
      sourceModules: criteria.sourceModules,
      scopes: criteria.scopes,
      expandedKeywords: queryInsight.expandedKeywords,
      configuredStages,
      usedStages,
      candidateCount,
      resultCount: response.results.length,
      durationMs: Date.now() - startedAt,
    }, user);
    return response;
  } catch (error) {
    const response = await searchBasic(criteria, "asset_search_ai_failed");
    await saveAiRunSafely({
      keyword: criteria.keyword,
      mode: response.mode,
      status: "fallback",
      fallbackReason: response.ai?.fallbackReason || "asset_search_ai_failed",
      sourceModules: criteria.sourceModules,
      scopes: criteria.scopes,
      expandedKeywords: queryInsight?.expandedKeywords || [],
      configuredStages,
      usedStages: queryInsight?.usedStages || [],
      candidateCount,
      resultCount: response.results.length,
      durationMs: Date.now() - startedAt,
      errorMessage: error?.message || "AI 检索失败",
    }, user);
    return response;
  }
}

async function search(payload, user) {
  const criteria = normalizeCriteria(payload, user);
  if (!criteria.aiEnabled) {
    return searchBasic(criteria);
  }
  return searchWithAi(criteria, user);
}

function normalizeBusinessDataConditions(conditions = []) {
  return conditions
    .map((condition) => ({
      elementId: Number(condition.elementId),
      values: uniqueStrings(condition.values || [], 20),
    }))
    .filter((condition) => condition.elementId > 0 && condition.values.length > 0);
}

function groupTargetsByResource(targets = []) {
  const grouped = new Map();
  for (const target of targets) {
    const key = String(target.resourceId);
    if (!grouped.has(key)) {
      grouped.set(key, {
        resourceId: target.resourceId,
        resourceCode: target.resourceCode,
        tableName: target.tableName,
        tableComment: target.tableComment,
        resourceCategory: target.resourceCategory,
        resourceStatus: target.resourceStatus,
        catalogId: target.catalogId,
        catalogName: target.catalogName,
        catalogShortCode: target.catalogShortCode,
        departmentId: target.departmentId,
        departmentName: target.departmentName,
        departmentCode: target.departmentCode,
        businessSystemId: target.businessSystemId,
        businessSystemName: target.businessSystemName,
        businessSystemCode: target.businessSystemCode,
        dataSourceId: target.dataSourceId,
        dataSourceName: target.dataSourceName,
        dataSourceCode: target.dataSourceCode,
        dataSource: target.dataSource,
        fields: [],
      });
    }
    grouped.get(key).fields.push(target);
  }
  return Array.from(grouped.values());
}

function buildResourceConditionGroups(resourceGroup, conditions, matchMode) {
  const groups = [];
  const matchedFields = [];
  for (const condition of conditions) {
    const fields = resourceGroup.fields.filter((field) => field.elementId === condition.elementId);
    if (!fields.length) {
      if (matchMode === "all") return { groups: [], matchedFields: [] };
      continue;
    }
    groups.push({
      columns: uniqueStrings(fields.map((field) => field.columnName)),
      values: condition.values,
    });
    for (const field of fields) {
      matchedFields.push({
        elementId: field.elementId,
        elementCode: field.elementCode,
        elementNameCn: field.elementNameCn,
        columnName: field.columnName,
        columnComment: field.columnComment,
        dataType: field.dataType,
        columnType: field.columnType,
        mappingStatus: field.mappingStatus,
        confidence: field.confidence,
        values: condition.values,
      });
    }
  }
  return { groups, matchedFields };
}

async function businessDataSearch(payload, user) {
  const permissions = userModulePermissions(user);
  if (!permissions.has("data_map")) {
    throw new AppError("无数据地图权限，无法执行业务数据检索", 403);
  }

  const conditions = normalizeBusinessDataConditions(payload.conditions || []);
  if (!conditions.length) {
    throw new AppError("业务数据检索至少需要一个有效数据元条件", 400);
  }

  const targets = await repository.findBusinessDataSearchTargets(
    conditions.map((condition) => condition.elementId),
    payload.filters || {}
  );
  const resourceGroups = groupTargetsByResource(targets);
  const matchMode = payload.matchMode || "all";
  const perResourceLimit = repository.clampLimit(payload.perResourceLimit || 20, 20);
  const maxResultTables = repository.clampLimit(payload.limit || 100, 100);
  const results = [];
  const errors = [];

  for (const resourceGroup of resourceGroups) {
    if (results.length >= maxResultTables) break;
    const { groups, matchedFields } = buildResourceConditionGroups(resourceGroup, conditions, matchMode);
    if (!groups.length) continue;

    try {
      const output = await metadataService.searchRows(resourceGroup.dataSource, resourceGroup.tableName, groups, {
        matchMode,
        limit: perResourceLimit,
      });
      if (Number(output.hitCount || 0) <= 0) continue;
      results.push({
        resourceId: resourceGroup.resourceId,
        resourceCode: resourceGroup.resourceCode,
        tableName: resourceGroup.tableName,
        tableComment: resourceGroup.tableComment,
        resourceCategory: resourceGroup.resourceCategory,
        resourceStatus: resourceGroup.resourceStatus,
        catalogId: resourceGroup.catalogId,
        catalogName: resourceGroup.catalogName,
        catalogShortCode: resourceGroup.catalogShortCode,
        departmentId: resourceGroup.departmentId,
        departmentName: resourceGroup.departmentName,
        departmentCode: resourceGroup.departmentCode,
        businessSystemId: resourceGroup.businessSystemId,
        businessSystemName: resourceGroup.businessSystemName,
        businessSystemCode: resourceGroup.businessSystemCode,
        dataSourceId: resourceGroup.dataSourceId,
        dataSourceName: resourceGroup.dataSourceName,
        dataSourceCode: resourceGroup.dataSourceCode,
        hitCount: Number(output.hitCount || 0),
        returnedCount: Array.isArray(output.rows) ? output.rows.length : 0,
        matchedFields,
        rows: output.rows || [],
        actions: [
          { label: "查看资源详情", path: `/dashboard/data-map/resources/${resourceGroup.resourceId}` },
        ],
      });
    } catch (error) {
      errors.push({
        resourceId: resourceGroup.resourceId,
        resourceCode: resourceGroup.resourceCode,
        tableName: resourceGroup.tableName,
        message: error?.message || "业务数据检索失败",
      });
    }
  }

  results.sort((left, right) => Number(right.hitCount || 0) - Number(left.hitCount || 0));
  return {
    matchMode,
    conditions,
    stats: {
      targetFieldCount: targets.length,
      targetResourceCount: resourceGroups.length,
      totalTables: results.length,
      totalRows: results.reduce((sum, item) => sum + Number(item.hitCount || 0), 0),
    },
    results,
    errors,
  };
}

async function suggest(query, user) {
  const payload = {
    keyword: String(query.q || query.keyword || "").trim(),
    aiEnabled: false,
    scopes: [],
    sourceModules: String(query.sourceModule || "").trim() ? [String(query.sourceModule).trim()] : [],
    filters: {},
    limit: Math.min(Number(query.limit || 10), 20),
  };
  const response = await search(payload, user);
  return response.results.slice(0, payload.limit).map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    assetType: item.assetType,
    sourceModule: item.sourceModule,
  }));
}

async function facets(query = {}, user) {
  const requestedModules = String(query.sourceModules || query.sourceModule || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const authorizedModules = resolveAuthorizedModules(user, requestedModules);
  const authorizedModuleSet = new Set(authorizedModules);
  const options = await repository.loadFacetOptions();

  return {
    ...options,
    sourceModules: options.sourceModules.filter((item) => authorizedModuleSet.has(item.value)),
    departments: authorizedModuleSet.has("data_map") ? options.departments : [],
    businessSystems: authorizedModuleSet.has("data_map") ? options.businessSystems : [],
    dataSources: options.dataSources.filter((item) => authorizedModuleSet.has(item.sourceModule)),
  };
}

async function listAiConfigs() {
  return repository.listAiConfigs();
}

async function validateDefaultProvider(defaultModelProviderId, defaultModelName, defaultModelVersion) {
  if (!defaultModelProviderId) {
    return {
      defaultModelProviderId: null,
      defaultModelName: null,
      defaultModelVersion: null,
    };
  }

  const provider = await modelProviderService.getModelProviderById(defaultModelProviderId);
  if (!provider) {
    throw new AppError("默认模型配置不存在", 400);
  }
  if (provider.modelCategory !== "chat") {
    throw new AppError("默认模型必须选择对话模型", 400);
  }
  return {
    defaultModelProviderId: Number(defaultModelProviderId),
    defaultModelName: String(defaultModelName || provider.modelName || "").trim() || provider.modelName,
    defaultModelVersion: String(defaultModelVersion || provider.modelVersion || provider.modelName || "").trim()
      || provider.modelVersion
      || provider.modelName,
  };
}

async function updateAiConfig(id, payload) {
  const existing = await repository.getAiConfigById(id);
  if (!existing) {
    throw new AppError("资产检索模型配置不存在", 404);
  }

  const normalizedModel = await validateDefaultProvider(
    payload.defaultModelProviderId ?? existing.defaultModelProviderId,
    payload.defaultModelName ?? existing.defaultModelName,
    payload.defaultModelVersion ?? existing.defaultModelVersion
  );

  const row = await repository.updateAiConfig(id, {
    ...existing,
    ...payload,
    sceneName: existing.sceneName,
    sceneCode: existing.sceneCode,
    defaultModelProviderId: normalizedModel.defaultModelProviderId,
    defaultModelName: normalizedModel.defaultModelName,
    defaultModelVersion: normalizedModel.defaultModelVersion,
    temperature: payload.temperature ?? existing.temperature ?? null,
    maxTokens: payload.maxTokens ?? existing.maxTokens ?? null,
    timeoutMs: payload.timeoutMs ?? existing.timeoutMs ?? null,
    systemPrompt: payload.systemPrompt || existing.systemPrompt || null,
    description: payload.description || existing.description || "",
    ownerName: payload.ownerName || existing.ownerName,
    status: payload.status || existing.status,
  });

  if (!row) {
    throw new AppError("资产检索模型配置不存在", 404);
  }
  return row;
}

function canViewAllAiRuns(user) {
  const permissions = userModulePermissions(user);
  return permissions.has("system_models") || permissions.has("system_roles") || permissions.has("system_users");
}

async function listAiRuns(query = {}, user) {
  const limit = repository.clampLimit(query.limit || 20, 20);
  const status = String(query.status || "").trim();
  const options = {
    limit,
    status: status || undefined,
  };

  if (!canViewAllAiRuns(user)) {
    options.submittedUserId = user?.sub || user?.id || 0;
  }

  return repository.listAiRuns(options);
}

async function feedback(payload, user) {
  const stored = await repository.saveFeedback(payload, user);
  return {
    accepted: true,
    stored: true,
    id: stored.id,
    resultId: payload.resultId,
    feedback: payload.feedback,
    submittedBy: user?.username || "system",
  };
}

module.exports = {
  businessDataSearch,
  facets,
  feedback,
  listAiConfigs,
  listAiRuns,
  search,
  suggest,
  updateAiConfig,
};
