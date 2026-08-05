const AppError = require("../../common/errors/app-error");
const modelProviderService = require("../model-providers/model-provider.service");
const repository = require("./data-standards.repository");

const STANDARD_ELEMENT_GENERATION_SCENE = "standard_element_generation";
const STANDARD_FIELD_MAPPING_SCENE = "standard_field_mapping";

const ELEMENT_STANDARD_TYPES = {
  national: { prefix: "GB", label: "国家标准" },
  industry: { prefix: "HB", label: "行业标准" },
  enterprise: { prefix: "QB", label: "企业标准" },
};
const ELEMENT_CODE_SERIAL_DIGITS = 5;
const ELEMENT_IDENTIFIER_PREFIXES = new Set(["STD", "GB", "HB", "QB", "BASE", "DICT", "PERSON", "ORG", "PLACE", "EVENT", "OBJECT", "OPS"]);

function buildStandardElementGenerationSystemPrompt() {
  return [
    "你是数据治理标准数据元设计专家。",
    "请基于输入的字段、表、样例、业务说明和引用标准证据，生成保守的标准数据元候选。",
    "standardType 只能取 national、industry、enterprise；elementCode 必须按标准类型采用 GB/HB/QB+五位流水号，例如 GB00001、HB00001、QB00001。",
    "elementIdentifier 只能使用字母、数字和下划线，不要带 STD、GB、HB、QB、BASE、DICT、PERSON、ORG、PLACE、EVENT、OBJECT、OPS 等前缀，也不要使用 PERSON.NAME、ORG.REGISTERED_ADDRESS、DE02.01.030 这类分段前缀式标识符。",
    "生成的 elementCode 和 elementIdentifier 不能与已有标准数据元重复；如果不确定，优先使用输入字段语义生成无前缀标识符。",
    "只输出 JSON 对象，不要输出 Markdown 或代码块。",
    "不要编造输入中没有证据支撑的行业标准编号、值域或业务事实。",
    "输出结构：{\"candidates\":[{\"standardType\":\"enterprise\",\"elementCode\":\"QB00001\",\"elementIdentifier\":\"NAME\",\"elementNameCn\":\"\",\"elementNameEn\":\"\",\"objectClass\":\"\",\"propertyName\":\"\",\"representationTerm\":\"\",\"qualifiers\":[],\"definition\":\"\",\"dataType\":\"string\",\"maxLength\":null,\"numericPrecision\":null,\"numericScale\":null,\"formatPattern\":\"\",\"unit\":\"\",\"aliases\":[],\"tags\":[],\"referenceClause\":\"\",\"confidence\":0.8,\"evidence\":[],\"risks\":[]}]}",
  ].join("\n");
}

const DEFAULT_AI_CONFIGS = [
  {
    sceneName: "标准数据元生成",
    sceneCode: STANDARD_ELEMENT_GENERATION_SCENE,
    temperature: 0.2,
    maxTokens: 3000,
    timeoutMs: 60000,
    systemPrompt: buildStandardElementGenerationSystemPrompt(),
    userPromptTemplate: "输入证据：{{sourceText}}",
    outputSchema: {
      type: "object",
      properties: {
        candidates: { type: "array" },
      },
    },
    description: "从字段元数据、样例和业务说明中生成标准数据元候选。",
    ownerName: "System Administrator",
    status: "active",
  },
  {
    sceneName: "字段采标推荐",
    sceneCode: STANDARD_FIELD_MAPPING_SCENE,
    temperature: 0.1,
    maxTokens: 3000,
    timeoutMs: 60000,
    systemPrompt: [
      "你是数据治理字段采标助手。",
      "请基于字段元数据和候选标准数据元，推荐最匹配的数据元并说明证据。",
      "只输出 JSON 对象，不要输出 Markdown。候选不足时返回空 recommendations。",
      "输出结构：{\"recommendations\":[{\"fieldName\":\"\",\"elementCode\":\"\",\"confidence\":0.85,\"evidence\":[],\"risks\":[]}]}",
    ].join("\n"),
    userPromptTemplate: "输入证据：{{sourceText}}",
    outputSchema: {
      type: "object",
      properties: {
        recommendations: { type: "array" },
      },
    },
    description: "为数据地图字段推荐标准数据元映射。",
    ownerName: "System Administrator",
    status: "active",
  },
];

function currentUserName(user) {
  return user?.displayName || user?.username || "system";
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_.-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeElementIdentifier(value) {
  const text = normalizeCode(value)
    .replace(/[.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const parts = text.split("_").filter(Boolean);
  while (parts.length > 1 && ELEMENT_IDENTIFIER_PREFIXES.has(String(parts[0]).toUpperCase())) {
    parts.shift();
  }
  return parts.join("_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
}

function inferStandardTypeFromElementCode(elementCode) {
  const prefix = String(elementCode || "").trim().slice(0, 2).toUpperCase();
  const match = Object.entries(ELEMENT_STANDARD_TYPES).find(([, item]) => item.prefix === prefix);
  return match?.[0] || "";
}

function normalizeElementStandardType(value, fallback = "enterprise") {
  return ELEMENT_STANDARD_TYPES[String(value || "")] ? String(value) : fallback;
}

function assertElementIdentifier(identifier) {
  const text = String(identifier || "").trim();
  const firstPart = text.split(/[._-]/)[0]?.toUpperCase();
  if (ELEMENT_IDENTIFIER_PREFIXES.has(firstPart)) {
    throw new AppError("数据元标识符不要带前缀", 400);
  }
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(text)) {
    throw new AppError("数据元标识符仅支持字母、数字和下划线，且必须以字母开头", 400);
  }
}

async function prepareDataElementPayload(payload, existing = null) {
  const elementIdentifier = normalizeElementIdentifier(payload.elementIdentifier);
  assertElementIdentifier(elementIdentifier);
  const inferredType = inferStandardTypeFromElementCode(payload.elementCode) || existing?.standardType;
  const standardType = normalizeElementStandardType(payload.standardType, inferredType || "enterprise");
  const prefix = ELEMENT_STANDARD_TYPES[standardType].prefix;
  const elementCode = payload.elementCode
    ? String(payload.elementCode).trim().toUpperCase()
    : await repository.getNextElementCode(standardType);
  if (!new RegExp(`^${prefix}[0-9]{${ELEMENT_CODE_SERIAL_DIGITS}}$`).test(elementCode)) {
    throw new AppError(`${ELEMENT_STANDARD_TYPES[standardType].label}编码必须采用 ${prefix}+五位流水号，例如 ${prefix}00001`, 400);
  }
  return {
    ...payload,
    standardType,
    elementCode,
    elementIdentifier,
  };
}

function extractJsonObject(text = "") {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("模型未返回有效内容");
  }
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }
  throw new Error("模型响应中未找到 JSON 对象");
}

function parseJsonObjectWithRecovery(text = "") {
  try {
    return JSON.parse(String(text || "{}"));
  } catch {
    return JSON.parse(extractJsonObject(text));
  }
}

function createElementIdentityState(keys = []) {
  const usedCodes = new Set();
  const usedIdentifiers = new Set();
  const maxSerialByPrefix = new Map(Object.values(ELEMENT_STANDARD_TYPES).map((item) => [item.prefix, 0]));

  for (const key of keys) {
    const code = String(key.elementCode || "").trim().toUpperCase();
    const identifier = String(key.elementIdentifier || "").trim().toUpperCase();
    if (code) usedCodes.add(code);
    if (identifier) usedIdentifiers.add(identifier);

    const match = code.match(/^(GB|HB|QB)(\d{4,5})$/);
    if (match) {
      maxSerialByPrefix.set(match[1], Math.max(maxSerialByPrefix.get(match[1]) || 0, Number(match[2]) || 0));
    }
  }

  return { usedCodes, usedIdentifiers, maxSerialByPrefix };
}

function reserveNextElementCode(standardType, state) {
  const type = normalizeElementStandardType(standardType, "enterprise");
  const prefix = ELEMENT_STANDARD_TYPES[type].prefix;
  let nextNo = Number(state.maxSerialByPrefix.get(prefix) || 0) + 1;
  let code = `${prefix}${String(nextNo).padStart(ELEMENT_CODE_SERIAL_DIGITS, "0")}`;
  while (state.usedCodes.has(code)) {
    nextNo += 1;
    code = `${prefix}${String(nextNo).padStart(ELEMENT_CODE_SERIAL_DIGITS, "0")}`;
  }
  state.maxSerialByPrefix.set(prefix, nextNo);
  state.usedCodes.add(code);
  return code;
}

function peekNextElementCode(standardType, state) {
  const type = normalizeElementStandardType(standardType, "enterprise");
  const prefix = ELEMENT_STANDARD_TYPES[type].prefix;
  let nextNo = Number(state.maxSerialByPrefix.get(prefix) || 0) + 1;
  let code = `${prefix}${String(nextNo).padStart(ELEMENT_CODE_SERIAL_DIGITS, "0")}`;
  while (state.usedCodes.has(code)) {
    nextNo += 1;
    code = `${prefix}${String(nextNo).padStart(ELEMENT_CODE_SERIAL_DIGITS, "0")}`;
  }
  return code;
}

function normalizeCandidateElementCode(candidateCode, standardType, state) {
  const match = String(candidateCode || "").trim().toUpperCase().match(/^(GB|HB|QB)(\d{4,5})$/);
  const typeFromCode = match ? inferStandardTypeFromElementCode(match[1]) : "";
  const type = normalizeElementStandardType(typeFromCode || standardType, "enterprise");
  const prefix = ELEMENT_STANDARD_TYPES[type].prefix;
  if (match && match[1] === prefix) {
    const serialNo = Number(match[2]) || 0;
    const normalized = `${prefix}${String(serialNo).padStart(ELEMENT_CODE_SERIAL_DIGITS, "0")}`;
    if (serialNo > 0 && new RegExp(`^${prefix}[0-9]{${ELEMENT_CODE_SERIAL_DIGITS}}$`).test(normalized) && !state.usedCodes.has(normalized)) {
      state.usedCodes.add(normalized);
      state.maxSerialByPrefix.set(prefix, Math.max(state.maxSerialByPrefix.get(prefix) || 0, Number(normalized.slice(2)) || 0));
      return normalized;
    }
  }
  return reserveNextElementCode(type, state);
}

function reserveElementIdentifier(value, state) {
  const base = normalizeElementIdentifier(value) || "DATA_ELEMENT";
  const root = /^[A-Za-z]/.test(base) ? base : `DE_${base}`;
  let candidate = root;
  let counter = 2;
  while (state.usedIdentifiers.has(candidate.toUpperCase())) {
    candidate = `${root}_${counter}`;
    counter += 1;
  }
  state.usedIdentifiers.add(candidate.toUpperCase());
  return candidate;
}

function buildAiGenerationRuntimePrompt(state) {
  const nextCodes = Object.keys(ELEMENT_STANDARD_TYPES)
    .map((type) => `${ELEMENT_STANDARD_TYPES[type].label}:${peekNextElementCode(type, state)}`)
    .join("，");
  return [
    "运行时约束：",
    `当前下一可用标准编码参考：${nextCodes}。`,
    "如果输入或模型推断出的编码、标识符与已有数据元重复，必须改用新的五位流水号编码和无前缀唯一标识符。",
    "标识符示例：NAME、REGISTERED_ADDRESS、SOCIAL_CREDIT_CODE；不要输出 PERSON.NAME、ORG.REGISTERED_ADDRESS、DE02.01.030。",
  ].join("\n");
}

function normalizeSuggestedResult(result, state, defaults = {}) {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  return {
    ...result,
    candidates: candidates.map((candidate) => {
      const standardType = normalizeElementStandardType(candidate.standardType || inferStandardTypeFromElementCode(candidate.elementCode), "enterprise");
      const elementCode = normalizeCandidateElementCode(candidate.elementCode, standardType, state);
      const identifierSource = candidate.elementIdentifier
        || candidate.elementNameEn
        || candidate.propertyName
        || candidate.elementNameCn
        || elementCode;
      return {
        ...candidate,
        standardType,
        elementCode,
        elementIdentifier: reserveElementIdentifier(identifierSource, state),
        catalogId: candidate.catalogId || defaults.catalogId || null,
        referenceStandardId: candidate.referenceStandardId || defaults.referenceStandardId || null,
      };
    }),
  };
}

async function ensureDefaultAiConfigs() {
  const configs = await repository.listAiConfigs();
  const existingCodes = new Set(configs.map((item) => item.sceneCode));
  for (const config of DEFAULT_AI_CONFIGS) {
    if (!existingCodes.has(config.sceneCode)) {
      await repository.createAiConfig(config);
    }
  }
}

async function getOverview() {
  return repository.getOverview();
}

async function listCatalogs() {
  return repository.listCatalogs();
}

function buildCatalogTree(catalogs) {
  const nodeMap = new Map();
  catalogs.forEach((item) => {
    nodeMap.set(item.id, { ...item, children: [] });
  });

  const roots = [];
  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

async function listCatalogTree() {
  return buildCatalogTree(await repository.listCatalogs());
}

async function createCatalog(payload, user) {
  try {
    return await repository.createCatalog(payload, currentUserName(user));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("标准目录编码已存在", 409);
    }
    throw error;
  }
}

async function updateCatalog(id, payload) {
  if (payload.parentId && Number(payload.parentId) === Number(id)) {
    throw new AppError("父级目录不能选择自身", 400);
  }
  try {
    const row = await repository.updateCatalog(id, payload);
    if (!row) throw new AppError("标准目录不存在", 404);
    return row;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("标准目录编码已存在", 409);
    }
    throw error;
  }
}

async function deleteCatalog(id) {
  const deleted = await repository.deleteCatalog(id);
  if (!deleted) throw new AppError("标准目录不存在", 404);
}

async function listReferenceStandards(filters) {
  return repository.listReferenceStandards(filters);
}

async function createReferenceStandard(payload, user) {
  try {
    return await repository.createReferenceStandard(payload, currentUserName(user));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("引用标准编码已存在", 409);
    }
    throw error;
  }
}

async function updateReferenceStandard(id, payload) {
  try {
    const row = await repository.updateReferenceStandard(id, payload);
    if (!row) throw new AppError("引用标准不存在", 404);
    return row;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("引用标准编码已存在", 409);
    }
    throw error;
  }
}

async function deleteReferenceStandard(id) {
  const deleted = await repository.deleteReferenceStandard(id);
  if (!deleted) throw new AppError("引用标准不存在", 404);
}

async function listValueDomains(filters) {
  return repository.listValueDomains(filters);
}

async function getValueDomainDetail(id) {
  const row = await repository.getValueDomainById(id);
  if (!row) throw new AppError("值域不存在", 404);
  return row;
}

async function createValueDomain(payload, user) {
  try {
    return await repository.createValueDomain(payload, currentUserName(user));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("值域编码或值域项编码已存在", 409);
    }
    throw error;
  }
}

async function updateValueDomain(id, payload) {
  try {
    const row = await repository.updateValueDomain(id, payload);
    if (!row) throw new AppError("值域不存在", 404);
    return row;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("值域编码或值域项编码已存在", 409);
    }
    throw error;
  }
}

async function deleteValueDomain(id) {
  const deleted = await repository.deleteValueDomain(id);
  if (!deleted) throw new AppError("值域不存在", 404);
}

async function listDataElements(filters) {
  return repository.listDataElements(filters);
}

async function getDataElementDetail(id) {
  const row = await repository.getDataElementDetail(id);
  if (!row) throw new AppError("标准数据元不存在", 404);
  return row;
}

async function createDataElement(payload, user) {
  try {
    return await repository.createDataElement(await prepareDataElementPayload(payload), currentUserName(user));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("标准数据元标识符或编码已存在", 409);
    }
    throw error;
  }
}

async function updateDataElement(id, payload) {
  try {
    const existing = await repository.getDataElementById(id);
    if (!existing) throw new AppError("标准数据元不存在", 404);
    const row = await repository.updateDataElement(id, await prepareDataElementPayload(payload, existing));
    if (!row) throw new AppError("标准数据元不存在", 404);
    return row;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("标准数据元标识符或编码已存在", 409);
    }
    throw error;
  }
}

async function publishDataElement(id, payload, user) {
  const row = await repository.publishDataElement(id, {
    changeSummary: payload.changeSummary || "",
    createdBy: currentUserName(user),
  });
  if (!row) throw new AppError("标准数据元不存在", 404);
  return row;
}

async function deleteDataElement(id) {
  const deleted = await repository.deleteDataElement(id);
  if (!deleted) throw new AppError("标准数据元不存在", 404);
}

async function listFieldMappings(filters) {
  return repository.listFieldMappings(filters);
}

async function validateDefaultProvider(defaultModelProviderId, defaultModelName, defaultModelVersion) {
  if (!defaultModelProviderId) {
    return {
      defaultModelProviderId: null,
      defaultModelName: defaultModelName || null,
      defaultModelVersion: defaultModelVersion || null,
    };
  }
  const provider = await modelProviderService.getModelProviderById(defaultModelProviderId);
  return {
    defaultModelProviderId: Number(defaultModelProviderId),
    defaultModelName: defaultModelName || provider.modelName,
    defaultModelVersion: defaultModelVersion || provider.modelVersion || provider.modelName,
  };
}

async function listAiConfigs() {
  await ensureDefaultAiConfigs();
  return repository.listAiConfigs();
}

async function updateAiConfig(id, payload) {
  const existing = await repository.getAiConfigById(id);
  if (!existing) throw new AppError("数据标准模型配置不存在", 404);
  const normalizedModel = await validateDefaultProvider(
    payload.defaultModelProviderId ?? existing.defaultModelProviderId,
    payload.defaultModelName ?? existing.defaultModelName,
    payload.defaultModelVersion ?? existing.defaultModelVersion
  );
  const row = await repository.updateAiConfig(id, {
    ...payload,
    defaultModelProviderId: normalizedModel.defaultModelProviderId,
    defaultModelName: normalizedModel.defaultModelName,
    defaultModelVersion: normalizedModel.defaultModelVersion,
  });
  if (!row) throw new AppError("数据标准模型配置不存在", 404);
  return row;
}

function ruleBasedElementSuggestion(sourceText, payload = {}, state) {
  const text = String(sourceText || "").trim();
  const firstLine = text.split(/\r?\n/).map((item) => item.trim()).find(Boolean) || text;
  const nameMatch = firstLine.match(/(?:字段|名称|中文名|数据元)[:：]\s*([^,，;；\s]+)/);
  const codeMatch = text.match(/[A-Za-z][A-Za-z0-9_]{1,63}/);
  const nameCn = (nameMatch?.[1] || firstLine.replace(/[:：].*$/, "") || "标准数据元").slice(0, 128);
  const objectClass = /机构|部门|单位/.test(text) ? "机构" : /人员|用户|客户|学生|员工/.test(text) ? "人员" : "";
  const propertyName = /手机号|电话/.test(text) ? "联系电话" : /日期|时间/.test(text) ? "时间" : nameCn;
  const representationTerm = /代码|编码|code/i.test(text) ? "代码" : /日期|date/i.test(text) ? "日期" : /金额|余额|price|amount/i.test(text) ? "金额" : "文本";
  const dataType = /日期|date/i.test(text) ? "date" : /金额|数量|number|int|decimal/i.test(text) ? "decimal" : "string";
  const standardType = "enterprise";

  return normalizeSuggestedResult({
    candidates: [
      {
        standardType,
        elementIdentifier: codeMatch?.[0] || propertyName || nameCn,
        elementCode: "",
        elementNameCn: nameCn,
        elementNameEn: codeMatch?.[0] || "",
        catalogId: payload.catalogId || null,
        objectClass,
        propertyName,
        representationTerm,
        qualifiers: [],
        definition: text.slice(0, 800),
        dataType,
        maxLength: dataType === "string" ? 255 : null,
        numericPrecision: dataType === "decimal" ? 18 : null,
        numericScale: dataType === "decimal" ? 2 : null,
        formatPattern: dataType === "date" ? "YYYY-MM-DD" : "",
        unit: "",
        aliases: [],
        tags: ["rule_fallback"],
        referenceStandardId: payload.referenceStandardId || null,
        referenceClause: "",
        confidence: 0.45,
        evidence: ["当前未配置可用模型，已按字段文本做规则兜底建议"],
        risks: ["规则兜底只适合起草，发布前需要人工补充定义、值域和引用标准"],
      },
    ],
    mode: "rule_fallback",
  }, state, payload);
}

async function suggestDataElements(payload, user) {
  await ensureDefaultAiConfigs();
  const identityState = createElementIdentityState(await repository.listDataElementIdentityKeys());
  const aiConfig = await repository.getAiConfigBySceneCode(STANDARD_ELEMENT_GENERATION_SCENE);
  if (!aiConfig?.defaultModelProviderId || aiConfig.status !== "active") {
    return ruleBasedElementSuggestion(payload.sourceText, payload, identityState);
  }

  const startedAt = Date.now();
  const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
  const runtimeProvider = modelProviderService.applyModelSelection(provider, {
    modelName: aiConfig.defaultModelName,
    modelVersion: aiConfig.defaultModelVersion,
  });
  const sourceText = String(payload.sourceText || "").trim();
  const userPrompt = String(aiConfig.userPromptTemplate || "输入证据：{{sourceText}}").replace("{{sourceText}}", sourceText);
  const systemPrompt = [
    aiConfig.systemPrompt || DEFAULT_AI_CONFIGS[0].systemPrompt,
    buildAiGenerationRuntimePrompt(identityState),
  ].join("\n\n");
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    const completion = await modelProviderService.generateChatCompletion(runtimeProvider, messages, {
      temperature: aiConfig.temperature ?? 0.2,
      maxTokens: aiConfig.maxTokens || 3000,
      timeoutMs: aiConfig.timeoutMs || 60000,
    });
    const parsed = parseJsonObjectWithRecovery(completion.content);
    const result = {
      ...normalizeSuggestedResult(parsed, identityState, payload),
      mode: "model",
      modelProviderId: runtimeProvider.id,
      modelProviderName: runtimeProvider.configName,
      modelName: runtimeProvider.modelName,
      modelVersion: runtimeProvider.modelVersion,
    };
    await repository.createAiRun({
      sceneCode: STANDARD_ELEMENT_GENERATION_SCENE,
      modelProviderId: runtimeProvider.id,
      modelName: runtimeProvider.modelName,
      modelVersion: runtimeProvider.modelVersion,
      request: { sourceText, catalogId: payload.catalogId || null, referenceStandardId: payload.referenceStandardId || null },
      response: result,
      status: "success",
      durationMs: Date.now() - startedAt,
      createdBy: currentUserName(user),
    });
    return result;
  } catch (error) {
    await repository.createAiRun({
      sceneCode: STANDARD_ELEMENT_GENERATION_SCENE,
      modelProviderId: runtimeProvider.id,
      modelName: runtimeProvider.modelName,
      modelVersion: runtimeProvider.modelVersion,
      request: { sourceText },
      response: null,
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorMessage: error.message || "模型调用失败",
      createdBy: currentUserName(user),
    });
    throw error;
  }
}

module.exports = {
  createCatalog,
  createDataElement,
  createReferenceStandard,
  createValueDomain,
  deleteCatalog,
  deleteDataElement,
  deleteReferenceStandard,
  deleteValueDomain,
  getDataElementDetail,
  getOverview,
  getValueDomainDetail,
  listAiConfigs,
  listCatalogTree,
  listCatalogs,
  listDataElements,
  listFieldMappings,
  listReferenceStandards,
  listValueDomains,
  publishDataElement,
  suggestDataElements,
  updateAiConfig,
  updateCatalog,
  updateDataElement,
  updateReferenceStandard,
  updateValueDomain,
};
