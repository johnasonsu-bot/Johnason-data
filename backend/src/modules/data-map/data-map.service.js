const AppError = require("../../common/errors/app-error");
const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");
const metadataService = require("../data-sources/data-source.metadata");
const { testDatabaseConnection } = require("../data-sources/data-source.test-connection");
const { decryptSecret } = require("../data-development/data-development.utils");
const modelProviderService = require("../model-providers/model-provider.service");
const repository = require("./data-map.repository");

const RESOURCE_CONTENT_PROFILE_SCENE_CODE = "resource_content_profile";
const RESOURCE_FIELD_PROFILE_SCENE_CODE = "resource_field_profile";
const FIELD_FEATURE_TAG_CODES = ["primary_key", "foreign_key", "system_time", "business_time", "dictionary_value"];
const FIELD_FEATURE_TAG_CODE_SET = new Set(FIELD_FEATURE_TAG_CODES);
const STANDARD_ELEMENT_CANDIDATE_LIMIT = 8;
const STANDARD_MAPPING_MIN_CONFIDENCE = 0.45;
const STANDARD_MAPPING_RUNTIME_PROMPT = `
数据对标要求：
- 每个 fieldInsights 项都要包含 standardElementCode、standardElementConfidence、standardElementEvidence。
- standardElementCode 必须且只能从该字段的 standardElementCandidates 中选择。
- 只有字段业务含义、字段类型、样例特征与标准数据元定义足够一致时才匹配；候选不合适时返回空字符串。
- 不要编造不存在的标准数据元编码。
`.trim();
const DEFAULT_RESOURCE_CONTENT_PROFILE_PROMPT = `
你是企业数据目录和元数据治理专家。请基于输入证据生成数据资源内容画像。
只输出 JSON 对象，不要输出 Markdown。不要编造不存在的字段、样例或业务事实。
输出字段：summary、businessMeaning、businessGrain、usageSuggestions、qualityFindings、riskNotes、tags。
summary 是面向资源目录的简洁摘要；businessMeaning 说明表承载的业务对象和业务活动；businessGrain 说明每行数据代表的业务粒度。
usageSuggestions、qualityFindings、riskNotes、tags 必须结合资源基础信息、字段结构、样例画像和血缘关系给出，不要泛泛而谈。
本阶段只分析内容画像，不输出字段级 fieldInsights，不输出数据对标结论。
本阶段不输出数据脱敏策略，不做分级分类结论。`.trim();

const DEFAULT_RESOURCE_FIELD_PROFILE_PROMPT = `
你是企业数据目录字段画像和数据标准对标专家。请基于输入证据生成字段信息分析结果。
只输出 JSON 对象，不要输出 Markdown。不要编造不存在的字段、样例或业务事实。
输出字段：fieldInsights。
fieldInsights 必须覆盖输入中的每个字段，数组项包含 columnName、aiBusinessName、aiBusinessMeaning、featureTags、issueTags、standardElementCode、standardElementConfidence、standardElementEvidence。
featureTags 只能使用 primary_key、foreign_key、system_time、business_time、dictionary_value，一个字段可以返回多个特征标签；无法判断时返回空数组。
请综合字段名、字段描述、字段类型、是否必填、是否主键、空值率、样例值等证据判断特征标签，必须优先依据实际样例数据特征，不要只按字段名做机械匹配。
issueTags 重点标注空值率异常、样例值缺失、疑似字典值不规范、字段描述缺失等问题；不要输出语义标签。
标签含义：primary_key=主键或唯一标识；foreign_key=引用其他实体/字典/区域/机构等对象的关联键；system_time=创建/更新/删除/同步/ETL等系统审计时间；business_time=业务事件、生效、登记、出生、到期等业务时间；dictionary_value=代码、枚举、状态、级别、类型、标志等字典值。
standardElementCode 必须且只能从每个字段的 standardElementCandidates 中选择最匹配的标准数据元编码；候选与字段业务含义、数据类型、样例值、标准定义不匹配时返回空字符串，不要强行匹配。
standardElementConfidence 取 0 到 1；standardElementEvidence 用数组简述字段证据与标准定义的匹配点。
本阶段不输出数据脱敏策略，不做分级分类结论。`.trim();

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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

function normalizeProfileValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[Buffer:${value.length}]`;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value).slice(0, 200);
    } catch {
      return String(value).slice(0, 200);
    }
  }
  return String(value).slice(0, 200);
}

function uniqueNormalizedValues(values = [], limit = 8) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = normalizeProfileValue(value);
    if (normalized === null || normalized === "") continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function isLikelyTimeField(field) {
  const text = `${field.columnName || ""} ${field.dataType || ""} ${field.columnType || ""}`.toLowerCase();
  return /(date|time|timestamp|datetime|created_at|updated_at|create_time|update_time)/.test(text);
}

function buildEmptyResourceContent(resourceId) {
  return {
    resourceId,
    businessName: "",
    businessDefinition: "",
    businessGrain: "",
    updateFrequency: "",
    dataOwner: "",
    techOwner: "",
    usageScenarios: [],
    usageInstruction: "",
    qualityNote: "",
    knownIssues: "",
    retentionPeriod: "",
    serviceSla: "",
    extension: {},
  };
}

function buildEmptyProfile(resource) {
  return {
    resourceId: resource.id,
    profileStatus: "pending",
    sampleCount: 0,
    rowCount: resource.rowCount ?? null,
    columnCount: resource.columnCount || 0,
    nullableFieldCount: 0,
    primaryKeyFields: [],
    timeRange: {},
    qualitySummary: {},
    profile: {},
    aiSummary: "",
    aiOutput: null,
    aiAnalyzedAt: null,
    errorMessage: "",
    profiledAt: null,
  };
}

function buildProfileMetrics(resource, fields = [], sampleRows = [], sampleError = "") {
  const sampleCount = sampleRows.length;
  const fieldProfiles = [];
  const primaryKeyFields = fields.filter((field) => field.isPrimaryKey).map((field) => field.columnName);
  let nullableFieldCount = 0;
  let highNullFieldCount = 0;
  let undocumentedFieldCount = 0;
  const timeRange = {};

  for (const field of fields) {
    const values = sampleRows.map((row) => row?.[field.columnName]);
    const nullCount = values.filter((value) => value === null || value === undefined || value === "").length;
    const nullRate = sampleCount > 0 ? Number((nullCount / sampleCount).toFixed(6)) : null;
    const nonNullValues = values.filter((value) => value !== null && value !== undefined && value !== "");
    const issueTags = [];

    if (field.isNullable) nullableFieldCount += 1;
    if (!field.columnComment) {
      undocumentedFieldCount += 1;
      issueTags.push("missing_comment");
    }
    if (nullRate !== null && nullRate >= 0.5) {
      highNullFieldCount += 1;
      issueTags.push("high_null_rate");
    }
    if (sampleCount === 0) {
      issueTags.push("no_sample");
    }

    if (isLikelyTimeField(field)) {
      const dates = nonNullValues
        .map((value) => new Date(value))
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((left, right) => left.getTime() - right.getTime());
      if (dates.length > 0) {
        timeRange[field.columnName] = {
          min: dates[0].toISOString(),
          max: dates[dates.length - 1].toISOString(),
        };
      }
    }

    fieldProfiles.push({
      columnName: field.columnName,
      nullRate,
      sampleValues: uniqueNormalizedValues(values),
      issueTags,
      semanticTags: [],
      featureTags: [],
    });
  }

  const qualitySummary = {
    sampleError,
    highNullFieldCount,
    undocumentedFieldCount,
    nullableFieldCount,
    primaryKeyFieldCount: primaryKeyFields.length,
    noPrimaryKey: primaryKeyFields.length === 0,
  };

  return {
    profile: {
      profileStatus: sampleError ? "partial" : "succeeded",
      sampleCount,
      rowCount: resource.rowCount ?? null,
      columnCount: fields.length,
      nullableFieldCount,
      primaryKeyFields,
      timeRange,
      qualitySummary,
      profile: {
        tableName: resource.tableName,
        tableComment: resource.tableComment || "",
        businessTags: resource.businessTags || [],
        generatedBy: "rule_profile",
      },
      errorMessage: sampleError || "",
    },
    fieldProfiles,
  };
}

function currentUserName(user) {
  return user?.displayName || user?.username || "system";
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeFeatureTags(values = []) {
  return uniqueStrings(values).filter((item) => FIELD_FEATURE_TAG_CODE_SET.has(item));
}

function normalizeMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMatchParts(value) {
  const text = normalizeMatchText(value);
  const words = text.split(/\s+/).filter((item) => item.length >= 2);
  const chinese = [...text.matchAll(/[\u4e00-\u9fa5]{2,}/g)].map((match) => match[0]);
  return uniqueStrings([...words, ...chinese]);
}

function isTypeCompatible(field = {}, element = {}) {
  const fieldType = normalizeMatchText(`${field.dataType || ""} ${field.columnType || ""}`);
  const elementType = normalizeMatchText(element.dataType || "");
  if (!fieldType || !elementType) return true;
  if (/(char|text|string|varchar)/.test(fieldType)) return /(char|text|string|varchar)/.test(elementType);
  if (/(int|number|numeric|decimal|double|float|bigint|smallint)/.test(fieldType)) return /(int|number|numeric|decimal|double|float)/.test(elementType);
  if (/(date|time|timestamp|datetime)/.test(fieldType)) return /(date|time|timestamp|datetime)/.test(elementType);
  return true;
}

function buildStandardElementCandidateText(element = {}) {
  return normalizeMatchText([
    element.elementCode,
    element.elementIdentifier,
    element.elementNameCn,
    element.elementNameEn,
    element.objectClass,
    element.propertyName,
    element.representationTerm,
    element.definition,
    element.dataType,
    element.valueDomainName,
    element.referenceStandardName,
    ...(element.aliases || []),
    ...(element.tags || []),
    ...(element.qualifiers || []),
  ].join(" "));
}

function scoreStandardElementCandidate(field = {}, fieldProfile = {}, element = {}) {
  const fieldText = normalizeMatchText([
    field.columnName,
    field.columnComment,
    field.dataType,
    field.columnType,
    field.businessName,
    ...(field.semanticTags || []),
    ...(fieldProfile.semanticTags || []),
    ...(fieldProfile.featureTags || []),
    ...(fieldProfile.sampleValues || []),
  ].join(" "));
  if (!fieldText) return 0;

  const elementText = buildStandardElementCandidateText(element);
  let score = 0;
  const strongTerms = [element.elementNameCn, element.elementNameEn, element.elementIdentifier, element.propertyName]
    .map((item) => normalizeMatchText(item))
    .filter((item) => item.length >= 2);
  strongTerms.forEach((term) => {
    if (fieldText.includes(term)) score += 8;
  });
  for (const alias of element.aliases || []) {
    const term = normalizeMatchText(alias);
    if (term.length >= 2 && fieldText.includes(term)) score += 5;
  }
  const fieldParts = getMatchParts(fieldText);
  const elementParts = new Set(getMatchParts(elementText));
  fieldParts.forEach((part) => {
    if (elementParts.has(part)) score += 2;
  });
  if (isTypeCompatible(field, element)) {
    score += 2;
  } else {
    score -= 3;
  }
  return score;
}

function formatStandardElementCandidate(element = {}) {
  return {
    elementCode: element.elementCode,
    elementNameCn: element.elementNameCn,
    elementIdentifier: element.elementIdentifier,
    definition: String(element.definition || "").slice(0, 180),
    dataType: element.dataType || "",
    objectClass: element.objectClass || "",
    propertyName: element.propertyName || "",
    representationTerm: element.representationTerm || "",
    aliases: element.aliases || [],
    tags: element.tags || [],
    valueDomainName: element.valueDomainName || "",
    referenceStandardName: element.referenceStandardName || "",
    referenceClause: element.referenceClause || "",
    lifecycleStatus: element.lifecycleStatus || "",
  };
}

async function buildStandardElementCandidates(fields = [], fieldProfiles = []) {
  const elements = await repository.listStandardDataElementsForMatching(500);
  const fieldProfileMap = new Map((fieldProfiles || []).map((item) => [item.columnName, item]));
  const byField = {};
  for (const field of fields || []) {
    const fieldProfile = fieldProfileMap.get(field.columnName) || {};
    const scored = elements
      .map((element) => ({
        element,
        score: scoreStandardElementCandidate(field, fieldProfile, element),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, STANDARD_ELEMENT_CANDIDATE_LIMIT)
      .map((item) => formatStandardElementCandidate(item.element));
    byField[field.columnName] = scored;
  }
  return {
    byField,
    elementByCode: new Map(elements.map((item) => [String(item.elementCode || "").toUpperCase(), item])),
  };
}

function normalizeModelConfidence(value, fallback = 0.7) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number > 1) return Math.max(0, Math.min(1, number / 100));
  return Math.max(0, Math.min(1, number));
}

function normalizeSimpleTableName(tableName) {
  const normalized = String(tableName || "").trim().replace(/`|"/g, "");
  const parts = normalized.split(".").filter(Boolean);
  return parts[parts.length - 1] || normalized;
}

function tableCandidates(tableName) {
  const normalized = String(tableName || "").trim();
  const simple = normalizeSimpleTableName(normalized);
  return uniqueStrings([normalized, simple]);
}

function buildCatalogTree(rows = []) {
  const map = new Map(rows.map((item) => [item.id, { ...item, children: [] }]));
  const roots = [];
  for (const item of map.values()) {
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId).children.push(item);
    } else {
      roots.push(item);
    }
  }
  const sortNodes = (nodes) => nodes
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0) || left.id - right.id)
    .map((node) => ({ ...node, children: sortNodes(node.children || []) }));
  return sortNodes(roots);
}

async function requireDepartment(id) {
  const row = await repository.getDepartmentById(id);
  if (!row) {
    throw new AppError("部门不存在", 404);
  }
  return row;
}

async function requireBusinessSystem(id) {
  const row = await repository.getBusinessSystemById(id);
  if (!row) {
    throw new AppError("业务系统不存在", 404);
  }
  return row;
}

async function requireDataSource(id) {
  const row = await repository.getDataSourceById(id);
  if (!row) {
    throw new AppError("数据地图数据源不存在", 404);
  }
  return row;
}

async function requireCatalog(id) {
  const row = await repository.getCatalogById(id);
  if (!row) {
    throw new AppError("目录不存在", 404);
  }
  return row;
}

async function requireResource(id) {
  const row = await repository.getResourceById(id);
  if (!row) {
    throw new AppError("资源不存在", 404);
  }
  return row;
}

async function runWithDuplicateGuard(operation, duplicateMessage) {
  try {
    return await operation();
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError(duplicateMessage, 409);
    }
    if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
      throw new AppError("当前记录已被其他数据地图对象引用，无法删除", 409);
    }
    throw error;
  }
}

async function createDepartment(payload, user) {
  return runWithDuplicateGuard(
    () => repository.createDepartment(payload, currentUserName(user)),
    "部门编码已存在"
  );
}

async function updateDepartment(id, payload) {
  if (payload.parentId && Number(payload.parentId) === Number(id)) {
    throw new AppError("上级部门不能选择自身", 400);
  }
  await requireDepartment(id);
  if (payload.parentId) {
    await requireDepartment(payload.parentId);
  }
  return runWithDuplicateGuard(async () => {
    const row = await repository.updateDepartment(id, payload);
    if (!row) throw new AppError("部门不存在", 404);
    return row;
  }, "部门编码已存在");
}

async function deleteDepartment(id) {
  await requireDepartment(id);
  await runWithDuplicateGuard(() => repository.deleteDepartment(id), "");
}

async function createBusinessSystem(payload, user) {
  await requireDepartment(payload.departmentId);
  return runWithDuplicateGuard(
    () => repository.createBusinessSystem(payload, currentUserName(user)),
    "系统编码已存在"
  );
}

async function updateBusinessSystem(id, payload) {
  await requireBusinessSystem(id);
  await requireDepartment(payload.departmentId);
  return runWithDuplicateGuard(async () => {
    const row = await repository.updateBusinessSystem(id, payload);
    if (!row) throw new AppError("业务系统不存在", 404);
    return row;
  }, "系统编码已存在");
}

async function deleteBusinessSystem(id) {
  await requireBusinessSystem(id);
  await runWithDuplicateGuard(() => repository.deleteBusinessSystem(id), "");
}

async function createDataSource(payload, user) {
  const system = await requireBusinessSystem(payload.businessSystemId);
  return runWithDuplicateGuard(
    () => repository.createDataSource(payload, system.departmentId, currentUserName(user)),
    "数据源编码已存在"
  );
}

async function updateDataSource(id, payload) {
  await requireDataSource(id);
  const system = await requireBusinessSystem(payload.businessSystemId);
  return runWithDuplicateGuard(async () => {
    const row = await repository.updateDataSource(id, payload, system.departmentId);
    if (!row) throw new AppError("数据地图数据源不存在", 404);
    return row;
  }, "数据源编码已存在");
}

async function deleteDataSource(id) {
  await requireDataSource(id);
  await runWithDuplicateGuard(() => repository.deleteDataSource(id), "");
}

async function createCatalog(payload, user) {
  await requireDepartment(payload.departmentId);
  if (payload.businessSystemId) {
    const system = await requireBusinessSystem(payload.businessSystemId);
    if (system.departmentId !== Number(payload.departmentId)) {
      throw new AppError("目录绑定的业务系统不属于所选部门", 400);
    }
  }
  if (payload.parentId) {
    await requireCatalog(payload.parentId);
  }
  return repository.createCatalog(payload, currentUserName(user));
}

async function updateCatalog(id, payload) {
  if (payload.parentId && Number(payload.parentId) === Number(id)) {
    throw new AppError("上级目录不能选择自身", 400);
  }
  await requireCatalog(id);
  await requireDepartment(payload.departmentId);
  if (payload.businessSystemId) {
    const system = await requireBusinessSystem(payload.businessSystemId);
    if (system.departmentId !== Number(payload.departmentId)) {
      throw new AppError("目录绑定的业务系统不属于所选部门", 400);
    }
  }
  if (payload.parentId) {
    await requireCatalog(payload.parentId);
  }
  const row = await repository.updateCatalog(id, payload);
  if (!row) throw new AppError("目录不存在", 404);
  return row;
}

async function deleteCatalog(id) {
  await requireCatalog(id);
  await runWithDuplicateGuard(() => repository.deleteCatalog(id), "");
}

async function listExternalDataSources(moduleKey = "") {
  const normalized = String(moduleKey || "").trim();
  const modules = normalized ? [normalized] : ["ingestion", "quality", "reporting", "services", "development"];
  const results = [];
  const projectId = getCurrentProjectId();
  const projectWhere = projectId ? "WHERE project_id = ?" : "";
  const projectParams = projectId ? [projectId] : [];

  for (const moduleName of modules) {
    if (moduleName === "ingestion") {
      const [rows] = await pool.query(
        `SELECT id, source_name AS sourceName, source_code AS sourceCode, source_type AS sourceType,
                connection_config AS connectionConfig, owner_name AS ownerName, status
         FROM ingestion_data_sources
         ${projectWhere}
         ORDER BY id DESC`
        ,
        projectParams
      );
      results.push(...rows.map((row) => ({
        module: "ingestion",
        id: Number(row.id),
        sourceName: row.sourceName,
        sourceCode: row.sourceCode,
        sourceType: row.sourceType,
        connectionConfig: parseJson(row.connectionConfig, {}),
        ownerName: row.ownerName || "system",
        status: row.status,
      })));
    }

    if (moduleName === "quality") {
      const [rows] = await pool.query(
        `SELECT id, source_name AS sourceName, source_code AS sourceCode, source_type AS sourceType,
                connection_config AS connectionConfig, owner_name AS ownerName, status
         FROM qc_data_sources
         ${projectWhere}
         ORDER BY id DESC`
        ,
        projectParams
      );
      results.push(...rows.map((row) => ({
        module: "quality",
        id: Number(row.id),
        sourceName: row.sourceName,
        sourceCode: row.sourceCode,
        sourceType: row.sourceType,
        connectionConfig: parseJson(row.connectionConfig, {}),
        ownerName: row.ownerName || "system",
        status: row.status,
      })));
    }

    if (moduleName === "reporting") {
      const [rows] = await pool.query(
        `SELECT id, source_name AS sourceName, source_code AS sourceCode, source_type AS sourceType,
                connection_config AS connectionConfig, owner_name AS ownerName, status
         FROM report_data_sources
         ${projectWhere}
         ORDER BY id DESC`
        ,
        projectParams
      );
      results.push(...rows.map((row) => ({
        module: "reporting",
        id: Number(row.id),
        sourceName: row.sourceName,
        sourceCode: row.sourceCode,
        sourceType: row.sourceType,
        connectionConfig: parseJson(row.connectionConfig, {}),
        ownerName: row.ownerName || "system",
        status: row.status,
      })));
    }

    if (moduleName === "services") {
      const [rows] = await pool.query(
        `SELECT id, source_name AS sourceName, source_code AS sourceCode, source_type AS sourceType,
                connection_config AS connectionConfig, owner_name AS ownerName, status
         FROM service_data_sources
         ${projectWhere}
         ORDER BY id DESC`
        ,
        projectParams
      );
      results.push(...rows.map((row) => ({
        module: "services",
        id: Number(row.id),
        sourceName: row.sourceName,
        sourceCode: row.sourceCode,
        sourceType: row.sourceType,
        connectionConfig: parseJson(row.connectionConfig, {}),
        ownerName: row.ownerName || "system",
        status: row.status,
      })));
    }

    if (moduleName === "development") {
      const [rows] = await pool.query(
        `SELECT id, name AS sourceName, type AS sourceType, host, port, database_name AS databaseName,
                username, password_encrypted AS passwordEncrypted, extra_config_json AS extraConfig,
                created_at AS createdAt, updated_at AS updatedAt
         FROM dev_datasources
         ${projectWhere}
         ORDER BY id DESC`
        ,
        projectParams
      );
      results.push(...rows.map((row) => {
        const extraConfig = parseJson(row.extraConfig, {});
        return {
          module: "development",
          id: Number(row.id),
          sourceName: row.sourceName,
          sourceCode: `dev_${row.id}`,
          sourceType: row.sourceType,
          connectionConfig: {
            ...extraConfig,
            host: row.host,
            port: Number(row.port || 0),
            database: row.databaseName,
            username: row.username,
            password: decryptSecret(row.passwordEncrypted),
          },
          ownerName: "system",
          status: "active",
        };
      }));
    }
  }

  return results.map((item) => ({
    ...item,
    refKey: `${item.module}:${item.id}`,
    sourceRefModule: item.module,
    sourceRefId: item.id,
    sourceRefCode: item.sourceCode,
    sourceRefSnapshot: item,
  }));
}

async function testDataSource(payload) {
  return testDatabaseConnection(payload.connectionConfig || {}, payload.sourceType);
}

async function listDataSourceTables(id) {
  const source = await requireDataSource(id);
  return metadataService.listTables(source);
}

async function listDataSourceColumns(id, tableName) {
  const source = await requireDataSource(id);
  return metadataService.listColumns(source, tableName);
}

async function sampleResourceRows(resourceId, limit) {
  const resource = await requireResource(resourceId);
  const source = await requireDataSource(resource.dataSourceId);
  return metadataService.sampleRows(source, resource.tableName, limit);
}

async function buildResourceProfile(source, tableName, tableInfo, rowCountMode) {
  const columns = await metadataService.listColumns(source, tableName);
  let rowCount = null;
  let resolvedRowCountMode = rowCountMode || "estimated";

  if (resolvedRowCountMode === "exact") {
    rowCount = await metadataService.countRows(source, tableName).catch(() => null);
    if (rowCount === null) {
      resolvedRowCountMode = "estimated";
      rowCount = await metadataService.estimateRows(source, tableName).catch(() => null);
    }
  } else {
    rowCount = await metadataService.estimateRows(source, tableName).catch(() => null);
    if (rowCount === null) {
      resolvedRowCountMode = "exact";
      rowCount = await metadataService.countRows(source, tableName).catch(() => null);
    }
  }

  return {
    columns,
    rowCount,
    rowCountMode: resolvedRowCountMode,
    tableComment: tableInfo?.tableComment || "",
  };
}

async function registerResources(catalogId, payload, user) {
  const catalog = await requireCatalog(catalogId);
  const source = await requireDataSource(payload.dataSourceId);
  const isSameDepartment = source.departmentId === catalog.departmentId;
  const isSameSystem = !catalog.businessSystemId || source.businessSystemId === catalog.businessSystemId;
  if (!isSameDepartment || !isSameSystem) {
    throw new AppError(catalog.businessSystemId ? "资源注册的数据源必须属于目录绑定的部门和业务系统" : "资源注册的数据源必须属于目录绑定的部门", 400);
  }

  const tableNames = uniqueStrings(payload.tableNames);
  const existingTables = await metadataService.listTables(source);
  const tableInfoMap = new Map(existingTables.map((item) => [item.tableName, item]));
  const availableTableNames = new Set(existingTables.map((item) => item.tableName));
  for (const tableName of tableNames) {
    if (!availableTableNames.has(tableName)) {
      throw new AppError(`数据源中不存在表：${tableName}`, 400);
    }
  }

  const scope = {
    departmentCode: normalizeCode(catalog.departmentCode),
    systemCode: normalizeCode(source.systemCode),
    catalogShortCode: normalizeCode(catalog.catalogShortCode),
  };

  const items = [];
  for (const tableName of tableNames) {
    const profile = await buildResourceProfile(source, tableName, tableInfoMap.get(tableName), payload.rowCountMode);
    items.push({
      scope,
      catalogId: catalog.id,
      departmentId: catalog.departmentId,
      businessSystemId: source.businessSystemId,
      dataSourceId: source.id,
      tableName,
      tableComment: profile.tableComment,
      rowCount: profile.rowCount,
      rowCountMode: profile.rowCountMode,
      resourceCategory: payload.resourceCategory || null,
      businessTags: payload.businessTags || [],
      columns: profile.columns,
      sourceSnapshot: {
        sourceId: source.id,
        sourceName: source.sourceName,
        sourceCode: source.sourceCode,
        sourceType: source.sourceType,
        departmentCode: source.departmentCode,
        systemCode: source.systemCode,
      },
      createdBy: currentUserName(user),
    });
  }

  const ids = await runWithDuplicateGuard(() => repository.registerResources(items), "所选目录下已注册相同数据源表");
  await refreshIngestionLineage();
  return Promise.all(ids.map((id) => repository.getResourceById(id)));
}

async function updateResource(id, payload) {
  await requireResource(id);
  const row = await repository.updateResource(id, payload);
  if (!row) throw new AppError("资源不存在", 404);
  return row;
}

async function updateResourceContent(id, payload, user) {
  await requireResource(id);
  return repository.upsertResourceContent(id, payload, currentUserName(user));
}

async function updateResourceFieldMetadata(id, columnName, payload, user) {
  await requireResource(id);
  const decodedColumnName = String(columnName || "").trim();
  let updated = false;
  try {
    updated = await repository.updateResourceFieldMetadata(id, decodedColumnName, {
      columnComment: payload.columnComment || "",
      aiBusinessName: payload.aiBusinessName || "",
      aiBusinessMeaning: payload.aiBusinessMeaning || "",
      semanticTags: uniqueStrings(payload.semanticTags || []),
      featureTags: normalizeFeatureTags(payload.featureTags || []),
      ...(Object.prototype.hasOwnProperty.call(payload, "standardElementId") ? { standardElementId: payload.standardElementId || null } : {}),
      updatedBy: currentUserName(user),
    });
  } catch (error) {
    if (error.code === "STANDARD_ELEMENT_NOT_FOUND") {
      throw new AppError("标准数据元不存在", 404);
    }
    throw error;
  }
  if (!updated) {
    throw new AppError("字段不存在", 404);
  }
  return getResourceDetail(id);
}

function mergeFieldProfileMetrics(metrics, fields = [], existingFieldProfiles = []) {
  const fieldMap = new Map(fields.map((field) => [field.columnName, field]));
  const existingMap = new Map(existingFieldProfiles.map((item) => [item.columnName, item]));
  return (metrics || []).map((item) => {
    const field = fieldMap.get(item.columnName) || {};
    const existing = existingMap.get(item.columnName) || {};
    return {
      ...item,
      semanticTags: uniqueStrings([
        ...(field.semanticTags || []),
        ...(existing.semanticTags || []),
        ...(item.semanticTags || []),
      ]),
      featureTags: normalizeFeatureTags(item.featureTags || []),
      aiBusinessName: existing.aiBusinessName || field.businessName || item.aiBusinessName || "",
      aiBusinessMeaning: existing.aiBusinessMeaning || item.aiBusinessMeaning || "",
      aiOutput: existing.aiOutput || item.aiOutput || null,
    };
  });
}

async function getResourceProfile(id) {
  const resource = await requireResource(id);
  const [profile, fieldProfiles] = await Promise.all([
    repository.getResourceProfile(id),
    repository.listResourceFieldProfiles(id),
  ]);
  return {
    profile: profile || buildEmptyProfile(resource),
    fieldProfiles,
  };
}

async function refreshResourceProfile(id, payload = {}) {
  const resource = await requireResource(id);
  const source = await requireDataSource(resource.dataSourceId);
  const fields = await repository.listResourceFields(id);
  let sampleRows = [];
  let sampleError = "";

  try {
    sampleRows = await metadataService.sampleRows(source, resource.tableName, Number(payload.sampleLimit || 100));
  } catch (error) {
    sampleError = error.message || "样例数据采集失败";
  }

  const metrics = buildProfileMetrics(resource, fields, sampleRows, sampleError);
  const existingFieldProfiles = await repository.listResourceFieldProfiles(id);
  return repository.replaceResourceProfile(id, metrics.profile, mergeFieldProfileMetrics(metrics.fieldProfiles, fields, existingFieldProfiles));
}

async function deleteResource(id) {
  await requireResource(id);
  await runWithDuplicateGuard(() => repository.deleteResource(id), "");
  await refreshIngestionLineage();
}

async function deleteResources(ids = []) {
  const normalizedIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter(Boolean))];
  for (const id of normalizedIds) {
    await requireResource(id);
  }
  const deletedCount = await runWithDuplicateGuard(() => repository.deleteResources(normalizedIds), "");
  await refreshIngestionLineage();
  return { deletedCount };
}

function resolveDmSourceId(dmSources, ingestionSourceId, ingestionSourceCode) {
  const byRefId = dmSources.find((item) => item.sourceRefModule === "ingestion" && Number(item.sourceRefId) === Number(ingestionSourceId));
  if (byRefId) return byRefId.id;
  const byRefCode = dmSources.find((item) => item.sourceRefModule === "ingestion" && item.sourceRefCode && item.sourceRefCode === ingestionSourceCode);
  if (byRefCode) return byRefCode.id;
  const byCode = dmSources.find((item) => item.sourceCode === ingestionSourceCode);
  return byCode?.id || null;
}

function findResourceId(resources, dataSourceId, tableName) {
  if (!dataSourceId) return null;
  const candidates = tableCandidates(tableName);
  const matched = resources.find((item) => item.dataSourceId === Number(dataSourceId) && candidates.includes(item.tableName));
  return matched?.id || null;
}

async function refreshIngestionLineage() {
  const [facts, dmSources, resources] = await Promise.all([
    repository.listIngestionTaskLineageFacts(),
    repository.listDataSourcesForLineage(),
    repository.listResourcesForLineage(),
  ]);

  const edges = [];
  for (const fact of facts) {
    const sourceDataSourceId = resolveDmSourceId(dmSources, fact.sourceId, fact.sourceCode);
    const targetDataSourceId = resolveDmSourceId(dmSources, fact.targetSourceId, fact.targetCode);
    const sourceResourceId = findResourceId(resources, sourceDataSourceId, fact.sourceTable);
    const targetResourceId = findResourceId(resources, targetDataSourceId, fact.targetTable);
    if (!sourceResourceId && !targetResourceId) {
      continue;
    }
    edges.push({
      sourceResourceId,
      targetResourceId,
      sourceDataSourceId,
      targetDataSourceId,
      sourceTableName: fact.sourceTable,
      targetTableName: fact.targetTable,
      relationSource: "ingestion_task",
      relationSourceId: fact.id,
      confidence: sourceDataSourceId && targetDataSourceId ? "high" : "medium",
    });
  }

  await repository.replaceIngestionLineageEdges(edges);
  return { syncedEdges: edges.length };
}

function renderPromptTemplate(template, variables = {}) {
  let content = String(template || "");
  for (const [key, value] of Object.entries(variables)) {
    content = content.replaceAll(`{{${key}}}`, String(value ?? ""));
  }
  return content;
}

async function resolveDataMapProvider(aiConfig) {
  if (!aiConfig?.defaultModelProviderId) {
    throw new AppError("数据地图模型未配置默认模型", 400);
  }
  const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
  return modelProviderService.applyModelSelection(provider, {
    modelName: aiConfig.defaultModelName,
    modelVersion: aiConfig.defaultModelVersion,
  });
}

function ensureJsonObjectPrompt(messages = [], provider = null) {
  const providerText = `${provider?.providerType || ""} ${provider?.configName || ""} ${provider?.modelName || ""}`.toLowerCase();
  if (!providerText.includes("deepseek")) {
    return messages;
  }
  return (Array.isArray(messages) ? messages : []).map((item, index, list) => {
    if (!item || typeof item !== "object") return item;
    if (index === 0 || index === list.length - 1) {
      return {
        ...item,
        content: `${String(item.content || "").trim()}\n\nReturn valid JSON only. The response must be a JSON object.`,
      };
    }
    return item;
  });
}

function buildResourceAiEvidence(resource, content, profile, fieldProfiles, fields, lineage, standardElementCandidatesByField = {}) {
  const fieldProfileMap = new Map((fieldProfiles || []).map((item) => [item.columnName, item]));
  return {
    featureTagAnalysis: {
      output: "featureTags must be an array. Use zero, one, or multiple allowed codes based on field metadata and sample profile evidence.",
      allowedCodes: FIELD_FEATURE_TAG_CODES,
      evidencePolicy: "Use columnName, columnComment, dataType, columnType, isRequired, isPrimaryKey, nullRate and sampleValues together. Prefer conclusions supported by actual sample value patterns over keyword-only guesses.",
    },
    resource: {
      resourceCode: resource.resourceCode,
      tableName: resource.tableName,
      tableComment: resource.tableComment,
      resourceCategory: resource.resourceCategory,
      businessTags: resource.businessTags || [],
      rowCount: resource.rowCount,
      columnCount: resource.columnCount,
      catalogName: resource.catalogName,
      catalogShortCode: resource.catalogShortCode,
    },
    source: {
      departmentName: resource.departmentName,
      departmentCode: resource.departmentCode,
      businessSystemName: resource.systemName,
      businessSystemCode: resource.systemCode,
      dataSourceName: resource.sourceName,
      dataSourceCode: resource.sourceCode,
      dataSourceType: resource.sourceType,
    },
    content: content || buildEmptyResourceContent(resource.id),
    profile: profile || buildEmptyProfile(resource),
    fields: (fields || []).map((field) => {
      const fieldProfile = fieldProfileMap.get(field.columnName) || {};
      return {
        columnName: field.columnName,
        dataType: field.dataType,
        columnType: field.columnType,
        isNullable: field.isNullable,
        isRequired: !field.isNullable,
        isPrimaryKey: field.isPrimaryKey,
        columnComment: field.columnComment,
        sampleProfile: {
          nullRate: fieldProfile.nullRate,
          sampleValues: fieldProfile.sampleValues || [],
          issueTags: fieldProfile.issueTags || [],
        },
        currentStandardMapping: field.standardMapping || null,
        standardElementCandidates: standardElementCandidatesByField[field.columnName] || [],
      };
    }),
    lineage: (lineage || []).map((edge) => ({
      sourceTableName: edge.sourceTableName,
      targetTableName: edge.targetTableName,
      sourceResourceCode: edge.sourceResourceCode,
      targetResourceCode: edge.targetResourceCode,
      relationSource: edge.relationSource,
      relationSourceId: edge.relationSourceId,
      confidence: edge.confidence,
    })),
  };
}

async function getActiveDataMapAiConfig(sceneCode, label) {
  const aiConfig = await repository.getAiConfigByCode(sceneCode);
  if (!aiConfig || aiConfig.status !== "active") {
    throw new AppError(`数据地图${label}模型配置未启用`, 400);
  }
  return aiConfig;
}

async function analyzeResourceContentProfile(id, payload = {}, user) {
  const resource = await requireResource(id);
  const refreshed = await refreshResourceProfile(id, { sampleLimit: payload.sampleLimit || 100 });
  let { profile, fieldProfiles } = refreshed;

  const aiConfig = await getActiveDataMapAiConfig(RESOURCE_CONTENT_PROFILE_SCENE_CODE, "内容画像");
  const provider = await resolveDataMapProvider(aiConfig);
  const [content, fields, lineage] = await Promise.all([
    repository.getResourceContent(id),
    repository.listResourceFields(id),
    repository.listLineageEdges(id),
  ]);
  const evidence = buildResourceAiEvidence(resource, content, profile, fieldProfiles, fields, lineage, {});
  const resourceEvidence = JSON.stringify(evidence, null, 2);
  const userPrompt = renderPromptTemplate(
    aiConfig.userPromptTemplate || "请基于以下 JSON 证据生成资源内容画像：\n{{resourceEvidence}}",
    { resourceEvidence }
  );
  const messages = ensureJsonObjectPrompt([
    { role: "system", content: aiConfig.systemPrompt || DEFAULT_RESOURCE_CONTENT_PROFILE_PROMPT },
    { role: "user", content: userPrompt },
  ], provider);

  try {
    const completion = await modelProviderService.generateChatCompletion(provider, messages, {
      temperature: aiConfig.temperature ?? 0.1,
      maxTokens: Number(aiConfig.maxTokens || 2200),
      timeoutMs: Number(aiConfig.timeoutMs || 30000),
      responseFormat: { type: "json_object" },
    });
    const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
    const normalizedOutput = {
      summary: parsed.summary || parsed.businessMeaning || "",
      businessMeaning: parsed.businessMeaning || "",
      businessGrain: parsed.businessGrain || "",
      usageSuggestions: uniqueStrings(Array.isArray(parsed.usageSuggestions) ? parsed.usageSuggestions : []),
      qualityFindings: uniqueStrings(Array.isArray(parsed.qualityFindings) ? parsed.qualityFindings : []),
      riskNotes: uniqueStrings(Array.isArray(parsed.riskNotes) ? parsed.riskNotes : []),
      tags: uniqueStrings(Array.isArray(parsed.tags) ? parsed.tags : []),
    };
    return await repository.updateResourceProfileAi(id, {
      profileStatus: "succeeded",
      aiSummary: normalizedOutput.summary,
      aiOutput: normalizedOutput,
    }, []);
  } catch (error) {
    await repository.updateResourceProfileAi(id, {
      profileStatus: "failed",
      aiSummary: "",
      aiOutput: null,
      errorMessage: error.message || "模型分析失败",
    }, []);
    throw error;
  }
}

async function analyzeResourceFieldProfile(id, payload = {}, user) {
  const resource = await requireResource(id);
  const refreshed = await refreshResourceProfile(id, { sampleLimit: payload.sampleLimit || 100 });
  let { profile, fieldProfiles } = refreshed;

  const aiConfig = await getActiveDataMapAiConfig(RESOURCE_FIELD_PROFILE_SCENE_CODE, "字段信息");
  const provider = await resolveDataMapProvider(aiConfig);
  const [content, fields, lineage] = await Promise.all([
    repository.getResourceContent(id),
    repository.listResourceFields(id),
    repository.listLineageEdges(id),
  ]);
  const standardCandidates = await buildStandardElementCandidates(fields, fieldProfiles);
  const evidence = buildResourceAiEvidence(resource, content, profile, fieldProfiles, fields, lineage, standardCandidates.byField);
  const resourceEvidence = JSON.stringify(evidence, null, 2);
  const userPrompt = renderPromptTemplate(
    aiConfig.userPromptTemplate || "请基于以下 JSON 证据生成字段信息分析：\n{{resourceEvidence}}",
    { resourceEvidence }
  );
  const messages = ensureJsonObjectPrompt([
    { role: "system", content: `${aiConfig.systemPrompt || DEFAULT_RESOURCE_FIELD_PROFILE_PROMPT}\n\n${STANDARD_MAPPING_RUNTIME_PROMPT}` },
    { role: "user", content: userPrompt },
  ], provider);

  const completion = await modelProviderService.generateChatCompletion(provider, messages, {
    temperature: aiConfig.temperature ?? 0.1,
    maxTokens: Number(aiConfig.maxTokens || 2200),
    timeoutMs: Number(aiConfig.timeoutMs || 30000),
    responseFormat: { type: "json_object" },
  });
  const parsed = parseJsonObjectWithRecovery(completion.content || "{}");
  const existingFieldProfileMap = new Map(fieldProfiles.map((item) => [item.columnName, item]));
  const aiInsightMap = new Map((Array.isArray(parsed.fieldInsights) ? parsed.fieldInsights : [])
    .filter((item) => item?.columnName)
    .map((item) => [String(item.columnName), item]));
  const standardSuggestions = [];
  const aiFieldProfiles = fields.map((field) => {
      const item = aiInsightMap.get(field.columnName) || {};
      const itemOutput = { ...item };
      delete itemOutput.semanticTags;
      const existing = existingFieldProfileMap.get(field.columnName) || {};
      const standardElementCode = String(item.standardElementCode || item.dataElementCode || item.elementCode || "").trim().toUpperCase();
      const standardElement = standardElementCode ? standardCandidates.elementByCode.get(standardElementCode) : null;
      const standardElementConfidence = normalizeModelConfidence(item.standardElementConfidence ?? item.confidence, 0.7);
      if (standardElement && standardElementConfidence >= STANDARD_MAPPING_MIN_CONFIDENCE) {
        standardSuggestions.push({
          columnName: field.columnName,
          elementId: standardElement.id,
          confidence: standardElementConfidence,
          evidence: uniqueStrings(Array.isArray(item.standardElementEvidence) ? item.standardElementEvidence : item.evidence || []),
        });
      }
      return {
        columnName: field.columnName,
        sampleValues: existing.sampleValues || [],
        issueTags: uniqueStrings([...(existing.issueTags || []), ...(Array.isArray(item.issueTags) ? item.issueTags : [])]),
        semanticTags: existing.semanticTags || [],
        featureTags: normalizeFeatureTags(item.featureTags || []),
        aiBusinessName: item.aiBusinessName || item.businessName || existing.aiBusinessName || "",
        aiBusinessMeaning: item.aiBusinessMeaning || item.businessMeaning || existing.aiBusinessMeaning || "",
        aiOutput: Object.keys(itemOutput).length > 0 ? itemOutput : existing.aiOutput || null,
      };
    });

  const result = await repository.updateResourceFieldProfilesAi(id, aiFieldProfiles);
  await repository.replaceAiSuggestedFieldStandardMappings(id, standardSuggestions, currentUserName(user));
  return result;
}

async function analyzeResourceProfile(id, payload = {}, user) {
  await analyzeResourceContentProfile(id, payload, user);
  try {
    return await analyzeResourceFieldProfile(id, payload, user);
  } catch (error) {
    throw error;
  }
}

function makeGraphNode(id, label, type, data = {}) {
  return { id, label, type, data };
}

async function getResourceLineageGraph(id, query = {}) {
  const resource = await requireResource(id);
  const direction = String(query.direction || "both");
  const edges = await repository.listLineageEdges(id);
  const resources = await repository.listResources({});
  const resourceMap = new Map(resources.map((item) => [item.id, item]));
  const nodes = new Map();
  const graphEdges = [];
  const currentNodeId = `resource:${resource.id}`;

  nodes.set(currentNodeId, makeGraphNode(currentNodeId, resource.tableName, "current", {
    resourceId: resource.id,
    resourceCode: resource.resourceCode,
    sourceName: resource.sourceName,
    systemName: resource.systemName,
  }));

  function resolveNode(resourceId, dataSourceId, tableName, resourceCode, sourceName) {
    if (resourceId && resourceMap.has(Number(resourceId))) {
      const matched = resourceMap.get(Number(resourceId));
      return makeGraphNode(`resource:${matched.id}`, matched.tableName, matched.id === resource.id ? "current" : "resource", {
        resourceId: matched.id,
        resourceCode: matched.resourceCode,
        sourceName: matched.sourceName,
        systemName: matched.systemName,
      });
    }
    const externalId = `external:${dataSourceId || "unknown"}:${String(tableName || "").toLowerCase()}`;
    return makeGraphNode(externalId, tableName || "未注册表", "external", {
      resourceCode: resourceCode || "",
      sourceName: sourceName || "",
      dataSourceId: dataSourceId || null,
    });
  }

  for (const edge of edges) {
    const isUpstream = Number(edge.targetResourceId) === Number(id);
    const isDownstream = Number(edge.sourceResourceId) === Number(id);
    if (direction === "upstream" && !isUpstream) continue;
    if (direction === "downstream" && !isDownstream) continue;

    const sourceNode = resolveNode(edge.sourceResourceId, edge.sourceDataSourceId, edge.sourceTableName, edge.sourceResourceCode, edge.sourceName);
    const targetNode = resolveNode(edge.targetResourceId, edge.targetDataSourceId, edge.targetTableName, edge.targetResourceCode, edge.targetName);
    nodes.set(sourceNode.id, sourceNode);
    nodes.set(targetNode.id, targetNode);
    graphEdges.push({
      id: `edge:${edge.id}`,
      source: sourceNode.id,
      target: targetNode.id,
      label: edge.relationSourceId ? `${edge.lineageType} #${edge.relationSourceId}` : edge.lineageType,
      data: edge,
    });
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: graphEdges,
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
    throw new AppError("数据地图模型配置不存在", 404);
  }

  const normalizedModel = await validateDefaultProvider(
    payload.defaultModelProviderId ?? existing.defaultModelProviderId,
    payload.defaultModelName ?? existing.defaultModelName,
    payload.defaultModelVersion ?? existing.defaultModelVersion
  );

  const row = await repository.updateAiConfig(id, {
    ...existing,
    ...payload,
    defaultModelProviderId: normalizedModel.defaultModelProviderId,
    defaultModelName: normalizedModel.defaultModelName,
    defaultModelVersion: normalizedModel.defaultModelVersion,
    temperature: payload.temperature ?? existing.temperature ?? null,
    maxTokens: payload.maxTokens ?? existing.maxTokens ?? null,
    timeoutMs: payload.timeoutMs ?? existing.timeoutMs ?? null,
    systemPrompt: payload.systemPrompt || null,
    userPromptTemplate: payload.userPromptTemplate || null,
    outputSchema: payload.outputSchema || existing.outputSchema || {},
  });
  if (!row) {
    throw new AppError("数据地图模型配置不存在", 404);
  }
  return row;
}

async function getResourceDetail(id) {
  const resource = await requireResource(id);
  const [fields, lineage, content, profile, fieldProfiles] = await Promise.all([
    repository.listResourceFields(id),
    repository.listLineageEdges(id),
    repository.getResourceContent(id),
    repository.getResourceProfile(id),
    repository.listResourceFieldProfiles(id),
  ]);
  return {
    ...resource,
    content: content || buildEmptyResourceContent(id),
    profile: profile || buildEmptyProfile(resource),
    fieldProfiles,
    fields,
    lineage,
  };
}

module.exports = {
  analyzeResourceContentProfile,
  analyzeResourceFieldProfile,
  analyzeResourceProfile,
  createBusinessSystem,
  createCatalog,
  createDataSource,
  createDepartment,
  deleteBusinessSystem,
  deleteCatalog,
  deleteDataSource,
  deleteDepartment,
  deleteResource,
  deleteResources,
  getResourceLineageGraph,
  getOverview: repository.getOverview,
  getResourceProfile,
  getResourceDetail,
  listAiConfigs,
  listBusinessSystems: repository.listBusinessSystems,
  listCatalogs: repository.listCatalogs,
  listCatalogTree: async () => buildCatalogTree(await repository.listCatalogs()),
  listDataSourceColumns,
  listDataSourceTables,
  listDataSources: repository.listDataSources,
  listDepartments: repository.listDepartments,
  listExternalDataSources,
  listResources: repository.listResources,
  refreshIngestionLineage,
  refreshResourceProfile,
  registerResources,
  sampleResourceRows,
  searchResources: repository.searchResources,
  testDataSource,
  updateAiConfig,
  updateBusinessSystem,
  updateCatalog,
  updateDataSource,
  updateDepartment,
  updateResourceContent,
  updateResourceFieldMetadata,
  updateResource,
};
