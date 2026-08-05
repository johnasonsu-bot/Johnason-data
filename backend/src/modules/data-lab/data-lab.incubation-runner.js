const { pool } = require("../../config/database");
const AppError = require("../../common/errors/app-error");
const modelProviderService = require("../model-providers/model-provider.service");
const internetResearch = require("./data-lab.internet-research");
const capabilityNormalizer = require("./data-lab.capability-normalizer");
const { COMMITTEE_MEMBER_ROLE_SPECS } = require("./data-lab.model-profile-defaults");
const ruleAssetSeeds = require("./data-lab.rule-asset-seeds");

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeProvider(provider) {
  if (!provider) return null;
  return modelProviderService.normalizeRuntimeProvider({
    ...provider,
    extraConfig: safeJsonParse(provider.extra_config || provider.extraConfig, {}),
  });
}

async function findProviderByProfileId(profileId) {
  if (!profileId) return null;
  const [rows] = await pool.query(
    `SELECT profile.id AS profileId, profile.profile_name AS profileName, provider.*
     FROM lab_model_profile profile
     LEFT JOIN model_providers provider ON provider.id = profile.provider_id
     WHERE profile.id = ?
       AND profile.status = 'active'
       AND provider.id IS NOT NULL
       AND provider.status = 'active'
     LIMIT 1`,
    [profileId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    profileId: Number(row.profileId),
    profileName: row.profileName,
    provider: normalizeProvider(row),
  };
}

async function findDefaultRoleProfiles(stageTypes = []) {
  if (!Array.isArray(stageTypes) || stageTypes.length === 0) {
    return [];
  }
  const placeholders = stageTypes.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT profile.id AS profileId, profile.profile_name AS profileName, profile.stage_type AS stageType, provider.*
     FROM lab_model_profile profile
     LEFT JOIN model_providers provider ON provider.id = profile.provider_id
     WHERE profile.stage_type IN (${placeholders})
       AND profile.is_default = 1
       AND profile.status = 'active'
       AND provider.id IS NOT NULL
       AND provider.status = 'active'
       AND provider.model_category = 'chat'
     ORDER BY profile.stage_type ASC, profile.updated_at DESC, profile.id DESC`,
    stageTypes
  );
  return rows.map((row) => ({
    profileId: Number(row.profileId),
    profileName: row.profileName,
    stageType: row.stageType,
    provider: normalizeProvider(row),
  }));
}

async function findFallbackChatProvider() {
  const [rows] = await pool.query(
    `SELECT *
     FROM model_providers
     WHERE model_category = 'chat'
       AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1`
  );
  const provider = normalizeProvider(rows[0]);
  if (!provider) {
    throw new AppError("No active chat model provider found.", 400);
  }
  return provider;
}

async function findCommitteeProviders(modelCommittee = {}) {
  const members = Array.isArray(modelCommittee.members) ? modelCommittee.members : [];
  const configuredProviders = [];
  for (const member of members) {
    const profileId = Number(member.modelProfileId || 0);
    if (!profileId) continue;
    const resolved = await findProviderByProfileId(profileId);
    if (!resolved?.provider) continue;
    configuredProviders.push({
      role: member.role || "researcher",
      weight: Number(member.weight || 1),
      profileId: resolved.profileId,
      profileName: resolved.profileName,
      provider: resolved.provider,
    });
  }
  const configuredMap = new Map(configuredProviders.map((item) => [item.role, item]));
  const defaultProfiles = await findDefaultRoleProfiles(COMMITTEE_MEMBER_ROLE_SPECS.map((item) => item.stageType));
  const defaultMap = new Map(defaultProfiles.map((item) => [item.stageType, item]));
  let fallback = null;
  return Promise.all(
    COMMITTEE_MEMBER_ROLE_SPECS.map(async (spec) => {
      const configured = configuredMap.get(spec.stageType);
      if (configured?.provider) {
        return configured;
      }
      const matched = defaultMap.get(spec.stageType);
      if (matched?.provider) {
        return {
          role: spec.stageType,
          weight: Number(spec.defaultWeight || 1),
          profileId: matched.profileId,
          profileName: matched.profileName,
          provider: matched.provider,
        };
      }
      if (!fallback) {
        fallback = await findFallbackChatProvider();
      }
      return {
        role: spec.stageType,
        weight: Number(spec.defaultWeight || 1),
        profileId: null,
        profileName: `Fallback ${spec.stageType}`,
        provider: fallback,
      };
    })
  );
}

async function findArbiterProvider(modelCommittee = {}) {
  const arbiterProfileId = Number(modelCommittee.arbiterModelId || 0);
  if (arbiterProfileId) {
    const resolved = await findProviderByProfileId(arbiterProfileId);
    if (resolved?.provider) {
      return {
        profileId: resolved.profileId,
        profileName: resolved.profileName,
        provider: resolved.provider,
        source: "configured",
      };
    }
  }

  const [defaultArbiter] = await findDefaultRoleProfiles(["arbiter"]);
  if (defaultArbiter?.provider) {
    return {
      profileId: defaultArbiter.profileId,
      profileName: defaultArbiter.profileName,
      provider: defaultArbiter.provider,
      source: "default_profile",
    };
  }

  const fallback = await findFallbackChatProvider();
  return {
    profileId: null,
    profileName: "Fallback Arbiter",
    provider: fallback,
    source: "fallback",
  };
}

function tryParseJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return {};
  const candidates = uniqueValues([
    raw,
    decodeEscapedBlock(raw),
    unwrapMarkdownFence(raw),
    unwrapMarkdownFence(decodeEscapedBlock(raw)),
    extractBalancedJson(raw),
    extractBalancedJson(decodeEscapedBlock(raw)),
  ]);
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }
  return {};
}

function uniqueValues(values = []) {
  return Array.from(new Set(asArray(values).map((item) => String(item || "").trim()).filter(Boolean)));
}

function decodeEscapedBlock(text) {
  const raw = String(text || "");
  if (!/\\[nrt"\\]/.test(raw)) {
    return raw;
  }
  return raw
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\");
}

function unwrapMarkdownFence(text) {
  const raw = String(text || "").trim();
  if (!raw.startsWith("```")) {
    return raw;
  }
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractBalancedJson(text) {
  const raw = String(text || "");
  const start = raw.search(/[\{\[]/);
  if (start < 0) return "";
  const opener = raw[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
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
    if (char === opener) {
      depth += 1;
      continue;
    }
    if (char === closer) {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, index + 1).trim();
      }
    }
  }
  return raw.slice(start).trim();
}

function trimText(value, maxLength = 160) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function extractArray(value, aliases = []) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const alias of aliases) {
    if (Array.isArray(value[alias])) {
      return value[alias];
    }
  }
  return [];
}

function stringifyListItems(value, preferredKeys = []) {
  return capabilityNormalizer.mergeStringArrayUnique(
    [],
    extractArray(value, ["items", "fields", "elements", "tables", "titles", "sets", "sources", "features"]).map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (!item || typeof item !== "object") {
        return "";
      }
      for (const key of preferredKeys) {
        const matched = trimText(item[key], 120);
        if (matched) {
          return matched;
        }
      }
      return trimText(item.name || item.title || item.description || item.field || item.fieldPath, 120);
    })
  );
}

function withSourceRefs(item) {
  if (!item || typeof item !== "object") return item;
  const sourceRefs = capabilityNormalizer.normalizeSourceRefs(
    item.sourceRefs || item.evidenceRefs || item.references || item.referenceStandards || item.sampleSources
  );
  const nextRuleConfig = asObject(item.ruleConfig, {});
  return {
    ...item,
    sourceRefs,
    ruleConfig: Object.keys(nextRuleConfig).length > 0 || sourceRefs.length > 0
      ? {
        ...nextRuleConfig,
        sourceRefs: sourceRefs.length > 0 ? sourceRefs : capabilityNormalizer.normalizeSourceRefs(nextRuleConfig.sourceRefs),
      }
      : nextRuleConfig,
  };
}

function normalizeValueCorporaPayload(value) {
  const entries = extractArray(value, ["entries", "items", "samples"]).map((item) => {
    if (!item || typeof item !== "object") return null;
    const tableName = item.tableName || item.table || item.tableLabel || "";
    const fieldName = item.fieldName || item.field || item.fieldPath || "";
    const values = Array.isArray(item.values)
      ? item.values
      : (Array.isArray(item.sampleValues) ? item.sampleValues : (Array.isArray(item.examples) ? item.examples : []));
    return {
      tableName,
      fieldName,
      values,
      sourceRefs: capabilityNormalizer.normalizeSourceRefs(
        item.sourceRefs || item.evidenceRefs || item.references || item.sampleSources
      ),
    };
  }).filter(Boolean);
  return entries.length > 0 ? { entries } : {};
}

function normalizeRoleOutput(role, output = {}) {
  const parsed = Array.isArray(output) ? output : asObject(output, {});
  if (role === "standard_extractor") {
    if (Array.isArray(parsed)) {
      const [researchCatalog, schemaGuides, fieldSemantics, dataElements, standardTables, mandatoryFields, codeSets, regulationTitles, dictionaries, complianceRules] = parsed;
      return normalizeRoleOutput(role, {
        researchCatalog: {
          businessObjects: capabilityNormalizer.mergeStringArrayUnique([], [researchCatalog]),
        },
        schemaGuides: {
          guidingPrinciples: capabilityNormalizer.mergeStringArrayUnique([], [schemaGuides]),
        },
        fieldSemantics,
        dataElements,
        standardTables,
        mandatoryFields,
        codeSets,
        regulationTitles,
        dictionaries,
        complianceRules,
      });
    }
    return {
      ...parsed,
      fieldSemantics: extractArray(parsed.fieldSemantics, ["fields", "items"]).map((item) => ({
        ...asObject(item, {}),
        fieldComment: item?.fieldComment || item?.description,
        businessSemantic: item?.businessSemantic || item?.semanticRules,
        sourceRefs: capabilityNormalizer.normalizeSourceRefs(item?.sourceRefs || item?.referenceStandards || item?.evidenceRefs),
      })),
      dataElements: stringifyListItems(parsed.dataElements, ["elementName", "name", "definition"]),
      standardTables: stringifyListItems(parsed.standardTables, ["tableName", "name", "purpose"]),
      mandatoryFields: stringifyListItems(parsed.mandatoryFields, ["fieldPath", "fieldName", "name"]),
      codeSets: stringifyListItems(parsed.codeSets, ["setName", "name", "standardSource"]),
      regulationTitles: stringifyListItems(parsed.regulationTitles, ["title", "name"]),
      dictionaries: extractArray(parsed.dictionaries, ["items", "entries", "dictionaries"]).map((item) => withSourceRefs(item)),
      complianceRules: extractArray(parsed.complianceRules, ["rules", "items", "entries"]).map((item) => withSourceRefs(item)),
    };
  }
  if (role === "distribution_analyst") {
    return {
      ...parsed,
      sampleSources: stringifyListItems(parsed.sampleSources, ["sourceName", "domain", "description"]),
      distributionFeatures: stringifyListItems(parsed.distributionFeatures, ["featureName", "name", "description"]),
      valueCorpora: normalizeValueCorporaPayload(parsed.valueCorpora),
      fieldRules: extractArray(parsed.fieldRules, ["rules", "items", "entries"]).map((item) => withSourceRefs(item)),
      distributionRules: extractArray(parsed.distributionRules, ["rules", "items", "entries"]).map((item) => withSourceRefs(item)),
    };
  }
  if (role === "schema_reviewer") {
    return {
      ...parsed,
      relationPatterns: extractArray(parsed.relationPatterns, ["patterns", "items", "entries"]).map((item) => withSourceRefs(item)),
      codeRules: extractArray(parsed.codeRules, ["rules", "items", "entries"]).map((item) => withSourceRefs(item)),
      extendedRules: extractArray(parsed.extendedRules, ["rules", "items", "entries"]).map((item) => withSourceRefs(item)),
      qualityGates: asObject(parsed.qualityGates, {}),
    };
  }
  if (role === "realism_reviewer") {
    return {
      ...parsed,
      qualityGates: asObject(parsed.qualityGates, {}),
    };
  }
  return parsed;
}

function deriveStandardExtractorFallback(outputs = {}, evidenceItems = []) {
  const current = asObject(outputs.standard_extractor, {});
  const distribution = asObject(outputs.distribution_analyst, {});
  const schemaReview = asObject(outputs.schema_reviewer, {});
  const valueEntries = asArray(distribution.valueCorpora?.entries);
  const fieldRules = asArray(distribution.fieldRules);
  const codeRules = asArray(schemaReview.codeRules);
  const evidenceTitles = asArray(evidenceItems).map((item) => trimText(item.title, 40)).filter(Boolean);

  const derivedTables = capabilityNormalizer.mergeStringArrayUnique(
    current.standardTables,
    uniqueValues([
      ...valueEntries.map((item) => item?.tableName),
      ...fieldRules.map((item) => item?.tableName),
      ...codeRules.map((item) => item?.tableName),
    ])
  );

  const derivedDataElements = capabilityNormalizer.mergeStringArrayUnique(
    current.dataElements,
    uniqueValues([
      ...valueEntries.map((item) => item?.fieldName),
      ...fieldRules.map((item) => item?.fieldName),
      ...codeRules.map((item) => item?.fieldName),
    ])
  );

  const derivedMandatoryFields = capabilityNormalizer.mergeStringArrayUnique(
    current.mandatoryFields,
    uniqueValues([
      ...fieldRules.map((item) => item?.tableName && item?.fieldName ? `${item.tableName}.${item.fieldName}` : ""),
      ...codeRules.map((item) => item?.tableName && item?.fieldName ? `${item.tableName}.${item.fieldName}` : ""),
    ])
  );

  const derivedCodeSets = capabilityNormalizer.mergeStringArrayUnique(
    current.codeSets,
    uniqueValues([
      ...fieldRules
        .filter((item) => ["enum", "weighted_enum", "reference"].includes(String(item?.generatorType || "")))
        .map((item) => item?.fieldName),
    ])
  );

  const derivedFieldSemantics = capabilityNormalizer.uniqueBy(
    [
      ...asArray(current.fieldSemantics),
      ...valueEntries.slice(0, 6).map((item) => ({
        tableName: item?.tableName || "",
        fieldName: item?.fieldName || "",
        fieldType: "VARCHAR",
        fieldComment: item?.fieldName || "",
        businessSemantic: `${item?.tableName || ""}.${item?.fieldName || ""}`,
        sourceRefs: capabilityNormalizer.normalizeSourceRefs(item?.sourceRefs),
      })),
    ],
    (item) => `${String(item?.tableName || "").trim()}::${String(item?.fieldName || "").trim()}`
  );

  const derivedComplianceRules = capabilityNormalizer.uniqueBy(
    [
      ...asArray(current.complianceRules),
      ...codeRules.slice(0, 6).map((item, index) => ({
        ruleName: trimText(item?.ruleName || item?.description || `结构审阅规则${index + 1}`, 40),
        tableName: item?.tableName || "",
        fieldName: item?.fieldName || "",
        ruleType: "custom",
        issueCategory: "COMPLIANCE",
        severity: "medium",
        ruleConfig: asObject(item?.ruleConfig, {}),
        sourceRefs: capabilityNormalizer.normalizeSourceRefs(item?.sourceRefs),
      })),
    ],
    (item) => `${String(item?.tableName || "").trim()}::${String(item?.fieldName || "").trim()}::${String(item?.ruleName || "").trim()}`
  );

  return {
    ...current,
    researchCatalog: asObject(current.researchCatalog, {
      candidateTables: derivedTables.slice(0, 6),
      dictSuggestions: derivedCodeSets.slice(0, 6),
    }),
    schemaGuides: asObject(current.schemaGuides, {
      guidingPrinciples: evidenceTitles.slice(0, 2),
    }),
    fieldSemantics: derivedFieldSemantics,
    dataElements: derivedDataElements,
    standardTables: derivedTables,
    mandatoryFields: derivedMandatoryFields,
    codeSets: derivedCodeSets,
    regulationTitles: capabilityNormalizer.mergeStringArrayUnique(current.regulationTitles, evidenceTitles.slice(0, 4)),
    complianceRules: derivedComplianceRules,
  };
}

function buildCompactRolePayload(role, payload = {}) {
  const project = asObject(payload.project, {});
  const round = asObject(payload.round, {});
  const scenes = asArray(round.scenes).slice(0, 3).map((scene) => ({
    sceneName: trimText(scene.sceneName, 32),
    subScenario: trimText(scene.subScenario, 32),
    sceneDesc: trimText(scene.sceneDesc, 80),
    moduleTags: asArray(scene.moduleTags).slice(0, 5),
  }));
  const evidenceLimit = role === "researcher" ? 6 : (role === "standard_extractor" ? 3 : 4);
  const evidenceSummaryLength = role === "standard_extractor" ? 80 : (role === "researcher" ? 180 : 120);
  const evidenceItems = asArray(payload.evidenceItems).slice(0, evidenceLimit).map((item) => ({
    id: item.id,
    sourceType: trimText(item.sourceType, 16),
    authority: trimText(item.authority, 20),
    title: trimText(item.title, 48),
    publishedAt: item.publishedAt || null,
    summary: trimText(item.summary || item.snapshotContent, evidenceSummaryLength),
  }));
  return {
    project: {
      incubationName: trimText(project.incubationName, 24),
      industryCode: trimText(project.industryCode, 16),
      sourceTypes: asArray(project.autoResearchPolicy?.sourceTypes).slice(0, 5),
      requiredKeywords: asArray(project.autoResearchPolicy?.requiredKeywords).slice(0, 8),
    },
    round: {
      roundNo: round.roundNo,
      roundName: trimText(round.roundName, 32),
      scenes,
    },
    evidenceItems,
  };
}

async function askRole(provider, systemPrompt, payload) {
  const compactPayload = buildCompactRolePayload(systemPrompt.role, payload);
  const response = await modelProviderService.generateChatCompletion(
    provider,
    [
      { role: "system", content: systemPrompt.content },
      { role: "user", content: JSON.stringify(compactPayload, null, 2) },
    ],
    { temperature: 0.2, maxTokens: 1400 }
  );
  return {
    rawText: response.content,
    parsedOutput: tryParseJson(response.content),
  };
}

function stableNormalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableNormalize(item));
  }
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableNormalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function stableStringify(value) {
  try {
    return JSON.stringify(stableNormalize(value));
  } catch {
    return JSON.stringify(String(value || ""));
  }
}

function mergeDeep(base, extra) {
  if (Array.isArray(extra)) return extra.slice();
  if (!extra || typeof extra !== "object") return extra === undefined ? base : extra;
  const result = { ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}) };
  Object.entries(extra).forEach(([key, value]) => {
    result[key] = mergeDeep(result[key], value);
  });
  return result;
}

function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeEvidenceItems(evidenceItems) {
  return capabilityNormalizer.uniqueBy(
    asArray(evidenceItems)
      .filter((item) => item && typeof item === "object")
      .map((item, index) => ({
        id: item.id || item.evidenceId || `EVD_${index + 1}`,
        sourceType: String(item.sourceType || "行业公开资料").trim() || "行业公开资料",
        title: String(item.title || "").trim(),
        authority: String(item.authority || "").trim() || "unknown",
        sourceUrl: String(item.sourceUrl || "").trim(),
        summary: String(item.summary || "").trim(),
        snapshotContent: String(item.snapshotContent || "").trim(),
        sourceHash: String(item.sourceHash || "").trim(),
        publishedAt: item.publishedAt || null,
        confidence: Number(item.confidence || 0),
        contentType: String(item.contentType || "").trim(),
        fetchedAt: item.fetchedAt || new Date().toISOString(),
        searchQuery: String(item.searchQuery || "").trim(),
        domesticContextOnly: item.domesticContextOnly !== false,
        foreignTermHitCount: Number(item.foreignTermHitCount || 0),
        foreignRegionHitCount: Number(item.foreignRegionHitCount || 0),
        nonCnyCurrencyHitCount: Number(item.nonCnyCurrencyHitCount || 0),
      }))
      .filter((item) => item.title && item.snapshotContent),
    (item) => item.sourceHash || `${item.sourceUrl || ""}::${item.title}`
  );
}

function buildSceneSummary(scene) {
  return {
    sceneName: scene.sceneName,
    subScenario: scene.subScenario || "",
    sceneDesc: scene.sceneDesc || "",
    moduleTags: Array.isArray(scene.moduleTags) ? scene.moduleTags : [],
    evidenceRefs: Array.isArray(scene.evidenceRefs) ? scene.evidenceRefs : [],
    fingerprint: scene.fingerprint,
  };
}

function buildSourceTypeResolver(sourceTypes = []) {
  const normalized = Array.isArray(sourceTypes) ? sourceTypes : [];
  return (query) => {
    if (query.includes("国家标准") && normalized.includes("国家标准")) return "国家标准";
    if (query.includes("行业标准") && normalized.includes("行业标准")) return "行业标准";
    if (query.includes("法规") && normalized.includes("法规政策")) return "法规政策";
    if (query.includes("规范") && normalized.includes("建设规范")) return "建设规范";
    if (query.includes("公开 数据") && normalized.includes("公开数据")) return "公开数据";
    return "行业公开资料";
  };
}

function getRolePrompt(role) {
  const promptMap = {
    researcher: {
      role: "researcher",
      content: "你是中国境内行业研究委员。只返回一个 JSON 对象，不要 markdown，不要代码块，不要解释。字段固定为 evidenceSummary、candidateSubScenarios、candidateModules、domesticRiskChecks、nextRoundTargets。所有文本使用中文。"
    },
    standard_extractor: {
      role: "standard_extractor",
      content: "你是中国境内标准抽取委员。目标是最短 JSON，优先保证完整闭合，不要 markdown，不要代码块，不要解释。字段固定为 researchCatalog、schemaGuides、fieldSemantics、dataElements、standardTables、mandatoryFields、codeSets、regulationTitles、dictionaries、complianceRules。请严格控制体积：researchCatalog 只保留 candidateTables 和 dictSuggestions 两个数组；schemaGuides 只保留 guidingPrinciples，最多 2 条短句；fieldSemantics 最多 3 条，每条只保留 tableName、fieldName、fieldType、fieldComment、sourceRefs；dataElements 输出 4 个短字符串；standardTables 输出 3 个短字符串；mandatoryFields 输出 4 个字符串，格式 table.field；codeSets 输出 3 个短字符串；regulationTitles 输出 2 个短字符串；dictionaries 输出 4 条，每条只保留 dictType、itemCode、itemLabel、sourceRefs；complianceRules 输出 3 条，每条只保留 ruleName、tableName、fieldName、ruleType、severity、ruleConfig、sourceRefs。绝对不要返回证据摘要对象、长描述、长文本、嵌套说明。"
    },
    distribution_analyst: {
      role: "distribution_analyst",
      content: "你是中国境内公开数据分布分析委员。只返回一个 JSON 对象，不要 markdown，不要代码块，不要复制整段证据元数据。字段固定为 sampleSources、distributionFeatures、valueCorpora、distributionProfiles、realismRules、dirtyDataProfiles、fieldRules、distributionRules。sampleSources 直接输出 3-4 个短字符串。distributionFeatures 直接输出 4-6 个短字符串。valueCorpora 必须是对象，且只保留 entries 数组，输出 4-6 条，每条 values 最多 8 个值，元素示例 {\"tableName\":\"vehicle_archive\",\"fieldName\":\"plate_color_code\",\"values\":[\"01\",\"02\"],\"sourceRefs\":[\"E1\"]}。distributionProfiles 必须是简短对象，最多 2 个一级键。realismRules 最多 4 条短句。fieldRules 输出 4-6 条，每条只保留 tableName、fieldName、generatorType、ruleConfig、sourceRefs。distributionRules 输出 3-4 条，每条只保留 ruleType、ruleName、ruleConfig、sourceRefs。不要输出包装对象如 {rules:[...]} 或 {samples:[...]}。"
    },
    schema_reviewer: {
      role: "schema_reviewer",
      content: "你是中国境内业务结构审阅委员。只返回一个 JSON 对象，不要 markdown，不要代码块。字段固定为 relationPatterns、codeRules、extendedRules、qualityGates、reviewNotes。relationPatterns、codeRules、extendedRules 必须直接输出数组。relationPatterns 输出 2-4 条。codeRules 输出 2-4 条，每条只保留 ruleCode、ruleName、tableName、fieldName、description、ruleConfig、sourceRefs。extendedRules 输出 2-4 条，每条必须包含 ruleCategory、moduleKey、ruleName、tableName、fieldName、ruleConfig、sourceRefs，优先给 temporal、linkage、state_flow、cardinality。qualityGates 必须是对象且最多 4 个一级键。reviewNotes 不超过 80 字。除非输入证据完全不足，否则不要返回空数组。"
    },
    realism_reviewer: {
      role: "realism_reviewer",
      content: "你是中国境内业务真实性审阅委员。只返回一个 JSON 对象，不要 markdown，不要代码块。字段固定为 realismRules、qualityGates、reviewNotes。qualityGates 必须是对象。所有结论只基于输入证据。"
    },
  };
  return promptMap[role] || null;
}

function buildCommitteeCandidates(executions) {
  const grouped = new Map();
  executions.forEach((execution, index) => {
    const key = execution.outputKey || `candidate_${index + 1}`;
    const current = grouped.get(key) || {
      key,
      output: execution.output,
      executions: [],
      count: 0,
      totalWeight: 0,
    };
    current.executions.push(execution);
    current.count += 1;
    current.totalWeight += Number(execution.weight || 0);
    grouped.set(key, current);
  });
  return Array.from(grouped.values());
}

function pickCommitteeWinner(candidates, votePolicy = "weighted_vote") {
  const sorted = [...candidates].sort((left, right) => {
    if (votePolicy === "majority_vote") {
      if (right.count !== left.count) return right.count - left.count;
      if (right.totalWeight !== left.totalWeight) return right.totalWeight - left.totalWeight;
      return 0;
    }
    if (right.totalWeight !== left.totalWeight) return right.totalWeight - left.totalWeight;
    if (right.count !== left.count) return right.count - left.count;
    return 0;
  });
  return sorted[0] || null;
}

async function arbitrateCommitteeRole(arbiterProvider, role, candidates, payload, project, round) {
  if (!arbiterProvider?.provider || candidates.length <= 1) {
    return null;
  }
  const arbiterPrompt = "You are the neutral arbiter of a model committee. Return valid JSON only using the shape {\"selectedKey\":\"...\",\"reason\":\"...\"}. selectedKey must be one of candidateOutputs[*].key.";
  const response = await askRole(arbiterProvider.provider, arbiterPrompt, {
    project: {
      incubationName: project.incubationName,
      industryCode: project.industryCode,
    },
    round: {
      roundNo: round.roundNo,
      roundName: round.roundName,
    },
    role,
    candidateOutputs: candidates.map((candidate) => ({
      key: candidate.key,
      count: candidate.count,
      totalWeight: candidate.totalWeight,
      output: candidate.output,
      voters: candidate.executions.map((item) => ({
        profileId: item.profileId,
        profileName: item.profileName,
        modelName: item.modelName,
        providerType: item.providerType,
        weight: item.weight,
      })),
    })),
    context: payload,
  });
  const selectedKey = String(response?.parsedOutput?.selectedKey || "").trim();
  if (!selectedKey) return null;
  const matched = candidates.find((candidate) => candidate.key === selectedKey);
  if (!matched) return null;
  return {
    winner: matched,
    reason: String(response?.parsedOutput?.reason || "").trim() || null,
    rawText: response?.rawText || "",
  };
}

async function resolveCommitteeOutputs(roleExecutions, modelCommittee, payload, project, round) {
  const votePolicy = String(modelCommittee?.votePolicy || "weighted_vote").trim() || "weighted_vote";
  const agreementThreshold = Number(modelCommittee?.agreementThreshold || 0.67);
  const arbiter = votePolicy === "arbiter_final" ? await findArbiterProvider(modelCommittee) : null;
  const decisions = {};
  const selectedOutputs = {};

  for (const [role, executions] of Object.entries(roleExecutions)) {
    const candidates = buildCommitteeCandidates(executions);
    const totalCount = executions.length;
    const totalWeight = executions.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    let winner = pickCommitteeWinner(candidates, votePolicy === "majority_vote" ? "majority_vote" : "weighted_vote");
    let decisionMode = votePolicy;
    let arbiterDecision = null;

    if (votePolicy === "arbiter_final" && candidates.length > 1) {
      arbiterDecision = await arbitrateCommitteeRole(arbiter, role, candidates, payload, project, round);
      if (arbiterDecision?.winner) {
        winner = arbiterDecision.winner;
      } else {
        decisionMode = "weighted_vote_fallback";
      }
    }

    const agreementScore = votePolicy === "majority_vote"
      ? Number((winner?.count || 0) / Math.max(1, totalCount))
      : Number((winner?.totalWeight || 0) / Math.max(1, totalWeight || totalCount));

    selectedOutputs[role] = winner?.output || {};
    decisions[role] = {
      role,
      votePolicy,
      decisionMode,
      agreementThreshold,
      agreementScore: Number(agreementScore.toFixed(4)),
      thresholdMet: agreementScore >= agreementThreshold,
      selectedKey: winner?.key || null,
      candidateCount: candidates.length,
      candidates: candidates.map((candidate) => ({
        key: candidate.key,
        count: candidate.count,
        totalWeight: candidate.totalWeight,
        output: candidate.output,
        voters: candidate.executions.map((item) => ({
          profileId: item.profileId,
          profileName: item.profileName,
          modelName: item.modelName,
          providerType: item.providerType,
          weight: item.weight,
        })),
      })),
      arbiter: arbiter
        ? {
          profileId: arbiter.profileId,
          profileName: arbiter.profileName,
          modelName: arbiter.provider.modelName,
          providerType: arbiter.provider.providerType,
          source: arbiter.source,
        }
        : null,
      arbiterDecision: arbiterDecision
        ? {
          selectedKey: arbiterDecision.winner?.key || null,
          reason: arbiterDecision.reason || null,
          rawText: arbiterDecision.rawText || "",
        }
        : null,
    };
  }

  return {
    selectedOutputs,
    decisions,
    arbiter: arbiter
      ? {
        profileId: arbiter.profileId,
        profileName: arbiter.profileName,
        modelName: arbiter.provider.modelName,
        providerType: arbiter.provider.providerType,
        source: arbiter.source,
      }
      : null,
  };
}

function buildCommitteeSummary(decisions = {}) {
  const entries = Object.values(decisions);
  const criticalRoles = ["standard_extractor", "distribution_analyst", "schema_reviewer", "realism_reviewer"];
  const criticalDecisions = entries.filter((item) => criticalRoles.includes(String(item?.role || "")));
  const belowThreshold = criticalDecisions.filter((item) => item && item.thresholdMet === false);
  return {
    roleCount: entries.length,
    criticalRoleCount: criticalDecisions.length,
    belowThresholdCount: belowThreshold.length,
    belowThresholdRoles: belowThreshold.map((item) => item.role),
    minAgreementScore: criticalDecisions.length > 0 ? Math.min(...criticalDecisions.map((item) => Number(item.agreementScore || 0))) : null,
    avgAgreementScore: criticalDecisions.length > 0
      ? Number((criticalDecisions.reduce((sum, item) => sum + Number(item.agreementScore || 0), 0) / criticalDecisions.length).toFixed(4))
      : null,
    needsReview: belowThreshold.length > 0,
  };
}

const RULE_ASSET_THRESHOLDS = {
  dictTypeCount: 2,
  distributionRules: 2,
  fieldRules: 5,
  complianceRules: 5,
  extendedRules: 3,
  valueCorporaEntries: 10,
};

function countValueCorporaEntries(valueCorpora) {
  return Array.isArray(valueCorpora?.entries) ? valueCorpora.entries.length : 0;
}

function buildRuleAssetGateSummary(standardAssets = {}, publicDataProfiles = {}) {
  const dictionaries = asArray(standardAssets.dictionaries).filter((item) => item && item.status !== "inactive");
  const distributionRules = asArray(standardAssets.distributionRules).filter((item) => item && item.status !== "inactive");
  const fieldRules = asArray(publicDataProfiles.fieldRules).filter((item) => item && item.status !== "inactive");
  const complianceRules = asArray(standardAssets.complianceRules).filter((item) => item && item.status !== "inactive");
  const extendedRules = asArray(standardAssets.extendedRules).filter((item) => item && item.status !== "inactive");
  const valueCorporaEntries = countValueCorporaEntries(publicDataProfiles.valueCorpora);
  const dictTypeCount = new Set(dictionaries.map((item) => String(item?.dictType || "").trim()).filter(Boolean)).size;

  const counts = {
    dictionaries: dictionaries.length,
    dictTypeCount,
    distributionRules: distributionRules.length,
    fieldRules: fieldRules.length,
    complianceRules: complianceRules.length,
    extendedRules: extendedRules.length,
    valueCorporaEntries,
  };
  const belowThresholdMetrics = Object.entries(RULE_ASSET_THRESHOLDS)
    .filter(([key, threshold]) => Number(counts[key] || 0) < Number(threshold))
    .map(([key, threshold]) => ({
      metric: key,
      actual: Number(counts[key] || 0),
      threshold: Number(threshold),
    }));

  return {
    thresholds: { ...RULE_ASSET_THRESHOLDS },
    counts,
    belowThresholdMetrics,
    thresholdMet: belowThresholdMetrics.length === 0,
    needsReview: belowThresholdMetrics.length > 0,
  };
}

async function executeRound(project, round) {
  const selectedScenarios = Array.isArray(round.selectedScenarios) ? round.selectedScenarios : [];
  if (selectedScenarios.length === 0) {
    throw new AppError("Current round has no scenarios to execute.", 400);
  }

  const committeeProviders = await findCommitteeProviders(project.modelCommittee || {});
  const evidenceItems = await internetResearch.collectDomesticEvidence({
    industryCode: project.industryCode,
    industryLabel: project.incubationName || project.industryCode,
    sceneName: selectedScenarios.map((item) => item.sceneName).join(" / "),
    subScenario: selectedScenarios.map((item) => item.subScenario).filter(Boolean).join(" / "),
    requiredKeywords: project.autoResearchPolicy?.requiredKeywords || [],
    sourceTypes: project.autoResearchPolicy?.sourceTypes || [],
    preferredDomains: project.languagePolicy?.sourceDomainWhitelist || project.autoResearchPolicy?.preferredDomains || [],
    limit: 12,
    sourceTypeResolver: buildSourceTypeResolver(project.autoResearchPolicy?.sourceTypes || []),
  });

  if (evidenceItems.length === 0) {
    selectedScenarios.forEach((scene, index) => {
      evidenceItems.push({
        id: `EVD_FALLBACK_${index + 1}`,
        sourceType: "行业公开资料",
        title: `${project.incubationName || "行业孵化"} ${scene.sceneName} 中文业务调研占位证据`,
        authority: "fallback.local",
        sourceUrl: "",
        summary: `${scene.sceneName} ${scene.sceneDesc || ""}`.trim(),
        snapshotContent: `${scene.sceneName} ${scene.sceneDesc || ""}`.trim(),
        publishedAt: null,
        confidence: 0.18,
        contentType: "text/plain",
        fetchedAt: new Date().toISOString(),
        searchQuery: scene.sceneName,
        domesticContextOnly: true,
        foreignTermHitCount: 0,
        foreignRegionHitCount: 0,
        nonCnyCurrencyHitCount: 0,
      });
    });
  }

  const normalizedEvidenceItems = normalizeEvidenceItems(evidenceItems);
  const fallbackEvidenceCount = normalizedEvidenceItems.filter((item) => item.authority === "fallback.local").length;
  const fallbackEvidenceRatio = normalizedEvidenceItems.length > 0
    ? Number((fallbackEvidenceCount / normalizedEvidenceItems.length).toFixed(4))
    : 0;
  const payload = {
    project: {
      incubationName: project.incubationName,
      industryCode: project.industryCode,
      languagePolicy: project.languagePolicy,
      autoResearchPolicy: project.autoResearchPolicy,
    },
    round: {
      roundNo: round.roundNo,
      roundName: round.roundName,
      scenes: selectedScenarios.map(buildSceneSummary),
    },
    evidenceItems: normalizedEvidenceItems.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      title: item.title,
      authority: item.authority,
      sourceUrl: item.sourceUrl,
      publishedAt: item.publishedAt,
      confidence: item.confidence,
      summary: item.summary,
      snapshotContent: String(item.snapshotContent || "").slice(0, 4000),
      domesticContextOnly: item.domesticContextOnly !== false,
      foreignTermHitCount: Number(item.foreignTermHitCount || 0),
      foreignRegionHitCount: Number(item.foreignRegionHitCount || 0),
      nonCnyCurrencyHitCount: Number(item.nonCnyCurrencyHitCount || 0),
    })),
  };

  const roleExecutions = {};
  for (const member of committeeProviders) {
    const prompt = getRolePrompt(member.role);
    if (!prompt) continue;
    const response = await askRole(member.provider, prompt, payload);
    const normalizedOutput = normalizeRoleOutput(member.role, response.parsedOutput);
    if (!roleExecutions[member.role]) {
      roleExecutions[member.role] = [];
    }
    roleExecutions[member.role].push({
      role: member.role,
      weight: Number(member.weight || 1),
      profileId: member.profileId || null,
      profileName: member.profileName || null,
      providerType: member.provider.providerType,
      modelName: member.provider.modelName,
      rawText: response.rawText,
      output: normalizedOutput,
      outputKey: stableStringify(normalizedOutput),
    });
  }

  const committeeResolution = await resolveCommitteeOutputs(roleExecutions, project.modelCommittee || {}, payload, project, round);
  const outputs = {
    ...committeeResolution.selectedOutputs,
    standard_extractor: deriveStandardExtractorFallback(committeeResolution.selectedOutputs, normalizedEvidenceItems),
  };
  const committeeSummary = buildCommitteeSummary(committeeResolution.decisions);
  const seedAssets = ruleAssetSeeds.getIndustryRuleAssetSeed(project.industryCode, round.roundNo);

  const normalizedStandard = capabilityNormalizer.normalizeScenarioEnhancementPayload({
    industry: project.industryCode,
    researchCatalog: outputs.standard_extractor?.researchCatalog,
    schemaGuides: outputs.standard_extractor?.schemaGuides,
    relationPatterns: outputs.schema_reviewer?.relationPatterns,
    codeRules: outputs.schema_reviewer?.codeRules,
    fieldSemantics: outputs.standard_extractor?.fieldSemantics,
    qualityGates: mergeDeep(asObject(outputs.schema_reviewer?.qualityGates), asObject(outputs.realism_reviewer?.qualityGates)),
    realismRules: capabilityNormalizer.mergeStringArrayUnique(outputs.distribution_analyst?.realismRules, outputs.realism_reviewer?.realismRules),
    dictionaries: [...asArray(seedAssets.dictionaries), ...asArray(outputs.standard_extractor?.dictionaries)],
    distributionRules: [...asArray(seedAssets.distributionRules), ...asArray(outputs.distribution_analyst?.distributionRules)],
    fieldRules: [...asArray(seedAssets.fieldRules), ...asArray(outputs.distribution_analyst?.fieldRules)],
    complianceRules: [...asArray(seedAssets.complianceRules), ...asArray(outputs.standard_extractor?.complianceRules)],
    pluginBindings: [...asArray(seedAssets.pluginBindings), ...asArray(outputs.standard_extractor?.pluginBindings)],
    extendedRules: [...asArray(seedAssets.extendedRules), ...asArray(outputs.schema_reviewer?.extendedRules)],
    valueCorpora: mergeDeep(seedAssets.valueCorpora || {}, capabilityNormalizer.asObject(outputs.distribution_analyst?.valueCorpora, {})),
  });

  const normalizedResearchCatalog = capabilityNormalizer.normalizeResearchCatalog(project.industryCode, outputs.standard_extractor?.researchCatalog);
  const normalizedFieldSemantics = capabilityNormalizer.normalizeFieldSemantics(project.industryCode, outputs.standard_extractor?.fieldSemantics);
  const normalizedRelationPatterns = capabilityNormalizer.normalizeRelationPatterns(project.industryCode, outputs.schema_reviewer?.relationPatterns);
  const normalizedCodeRules = capabilityNormalizer.normalizeCodeRules(outputs.schema_reviewer?.codeRules);
  const normalizedRealismRules = capabilityNormalizer.normalizeRealismRules([
    ...asArray(outputs.distribution_analyst?.realismRules),
    ...asArray(outputs.realism_reviewer?.realismRules),
  ]);

  const standardAssets = {
    dataElements: capabilityNormalizer.mergeStringArrayUnique([], outputs.standard_extractor?.dataElements),
    standardTables: capabilityNormalizer.mergeStringArrayUnique([], outputs.standard_extractor?.standardTables),
    mandatoryFields: capabilityNormalizer.mergeStringArrayUnique([], outputs.standard_extractor?.mandatoryFields),
    codeSets: capabilityNormalizer.mergeStringArrayUnique([], outputs.standard_extractor?.codeSets),
    regulationTitles: capabilityNormalizer.mergeStringArrayUnique([], outputs.standard_extractor?.regulationTitles),
    researchCatalog: normalizedResearchCatalog,
    schemaGuides: capabilityNormalizer.asObject(outputs.standard_extractor?.schemaGuides, {}),
    fieldSemantics: normalizedFieldSemantics,
    dictionaries: capabilityNormalizer.uniqueBy(
      normalizedStandard.dictionaries,
      (item) => `${String(item?.dictType || "").trim()}::${String(item?.itemCode || "").trim()}`
    ),
    distributionRules: capabilityNormalizer.uniqueBy(
      normalizedStandard.distributionRules,
      (item) => `${String(item?.ruleType || "").trim()}::${String(item?.ruleCode || "").trim()}`
    ),
    complianceRules: normalizedStandard.complianceRules,
    relationPatterns: normalizedRelationPatterns,
    codeRules: normalizedCodeRules,
    pluginBindings: capabilityNormalizer.uniqueBy(
      normalizedStandard.pluginBindings,
      (item) => `${String(item?.pluginKey || "").trim()}::${String(item?.bindingScope || "").trim()}`
    ),
    extendedRules: capabilityNormalizer.uniqueBy(
      normalizedStandard.extendedRules,
      (item) => `${String(item?.ruleCode || "").trim()}::${String(item?.moduleKey || "").trim()}`
    ),
    qualityGates: normalizedStandard.qualityGates,
  };

  const publicDataProfiles = {
    sampleSources: asArray(outputs.distribution_analyst?.sampleSources).length > 0
      ? capabilityNormalizer.mergeStringArrayUnique([], outputs.distribution_analyst?.sampleSources)
      : normalizedEvidenceItems.map((item) => item.title),
    distributionFeatures: capabilityNormalizer.mergeStringArrayUnique([], outputs.distribution_analyst?.distributionFeatures),
    valueCorpora: normalizedStandard.valueCorpora,
    distributionProfiles: capabilityNormalizer.asObject(outputs.distribution_analyst?.distributionProfiles, {}),
    realismRules: normalizedRealismRules,
    dirtyDataProfiles: capabilityNormalizer.asObject(outputs.distribution_analyst?.dirtyDataProfiles, {}),
    fieldRules: normalizedStandard.fieldRules,
  };
  const ruleAssetGate = buildRuleAssetGateSummary(standardAssets, publicDataProfiles);
  const overallNeedsReview = committeeSummary.needsReview || ruleAssetGate.needsReview;

  const resultSummary = {
    completedAt: new Date().toISOString(),
    evidenceCount: normalizedEvidenceItems.length,
    fallbackEvidenceCount,
    realEvidenceCount: Math.max(0, normalizedEvidenceItems.length - fallbackEvidenceCount),
    fallbackEvidenceRatio,
    standardTableCount: Array.isArray(standardAssets.standardTables) ? standardAssets.standardTables.length : 0,
    dataElementCount: Array.isArray(standardAssets.dataElements) ? standardAssets.dataElements.length : 0,
    fieldSemanticCount: Array.isArray(standardAssets.fieldSemantics) ? standardAssets.fieldSemantics.length : 0,
    distributionFeatureCount: Array.isArray(publicDataProfiles.distributionFeatures) ? publicDataProfiles.distributionFeatures.length : 0,
    candidateSubScenarios: outputs.researcher?.candidateSubScenarios || [],
    candidateModules: outputs.researcher?.candidateModules || [],
    domesticRiskChecks: outputs.researcher?.domesticRiskChecks || [],
    committeeSummary,
    ruleAssetGate,
    needsReview: overallNeedsReview,
  };

  const enhancementDelta = {
    roundNo: round.roundNo,
    evidenceCount: normalizedEvidenceItems.length,
    fallbackEvidenceCount,
    fallbackEvidenceRatio,
    addedDataElements: Array.isArray(standardAssets.dataElements) ? standardAssets.dataElements.length : 0,
    addedStandardTables: Array.isArray(standardAssets.standardTables) ? standardAssets.standardTables.length : 0,
    addedFieldSemantics: Array.isArray(standardAssets.fieldSemantics) ? standardAssets.fieldSemantics.length : 0,
    addedDistributionFeatures: Array.isArray(publicDataProfiles.distributionFeatures) ? publicDataProfiles.distributionFeatures.length : 0,
    candidateSubScenarios: outputs.researcher?.candidateSubScenarios || [],
    candidateModules: outputs.researcher?.candidateModules || [],
    committeeSummary,
    ruleAssetGate,
    needsReview: overallNeedsReview,
  };

  return {
    evidenceItems: normalizedEvidenceItems,
    committeeSnapshot: {
      votePolicy: String(project?.modelCommittee?.votePolicy || "weighted_vote"),
      agreementThreshold: Number(project?.modelCommittee?.agreementThreshold || 0.67),
      arbiterModelId: project?.modelCommittee?.arbiterModelId || null,
      members: committeeProviders.map((item) => ({
        role: item.role,
        weight: item.weight,
        profileId: item.profileId || null,
        profileName: item.profileName || null,
        providerType: item.provider.providerType,
        modelName: item.provider.modelName,
      })),
      arbiter: committeeResolution.arbiter,
      roleExecutions,
      roleDecisions: committeeResolution.decisions,
      outputs,
    },
    standardAssets,
    publicDataProfiles,
    resultSummary,
    enhancementDelta,
    nextRoundTargets: outputs.researcher?.nextRoundTargets || [],
  };
}

module.exports = {
  executeRound,
};
