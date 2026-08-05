const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");

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

const SOURCE_MODULE_LABELS = {
  data_map: "数据地图",
  ingestion: "数据接入",
  quality: "质量管控",
  services: "数据服务",
};

const ASSET_TYPE_LABELS = {
  table: "表资源",
  field: "字段",
  datasource: "数据源",
  ingestion_task: "接入任务",
  quality_rule: "质量规则",
  quality_strategy: "质量策略",
  quality_result: "质量结果",
  service_api: "服务API",
  service_app: "服务应用",
};

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function json(value, fallback = null) {
  try {
    return JSON.stringify(value === undefined ? fallback : value);
  } catch {
    return JSON.stringify(fallback);
  }
}

function mapAiConfig(row) {
  const output = {
    ...row,
    defaultModelProviderId: row.defaultModelProviderId ? Number(row.defaultModelProviderId) : null,
    defaultModelName: row.defaultModelName || null,
    defaultModelVersion: row.defaultModelVersion || null,
    temperature: row.temperature === null || row.temperature === undefined ? null : Number(row.temperature),
    maxTokens: row.maxTokens === null || row.maxTokens === undefined ? null : Number(row.maxTokens),
    timeoutMs: row.timeoutMs === null || row.timeoutMs === undefined ? null : Number(row.timeoutMs),
  };
  return output;
}

function truncate(value, maxLength = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function uniqueStrings(values = []) {
  const result = [];
  const seen = new Set();
  for (const item of values) {
    const text = String(item || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function normalizeKeywordTerms(keyword) {
  const text = String(keyword || "").trim();
  if (!text) return [];

  const splitPattern = /[\s,，。；;、?？!！:：()（）[\]【】"'“”‘’]+|在哪些|在哪个|哪些|哪个|哪里|是否|有没有|查找|查询|检索|搜索|字段|表资源|资源|接口|服务|规则|策略|质量|数据源|任务|结果|里面|里|中|的|和|及|以及|相关/g;
  const chunks = text.split(splitPattern).map((item) => item.trim()).filter((item) => item.length >= 2);
  const latinTokens = text.match(/[A-Za-z][A-Za-z0-9_.$-]{1,}/g) || [];
  const compact = text
    .replace(splitPattern, "")
    .trim();

  return uniqueStrings([text, ...chunks, ...latinTokens, compact])
    .filter((item) => item.length >= 2)
    .slice(0, 10);
}

function normalizePriorityTerms(keyword) {
  const text = String(keyword || "").trim();
  if (!text || !text.includes("字段")) return [];
  const prefix = text.slice(0, text.indexOf("字段"));
  const chunks = prefix
    .split(/[\s,，。；;、?？!！:：()（）[\]【】"'“”‘’]+|在哪些|在哪个|哪些|哪个|哪里|是否|有没有|查找|查询|检索|搜索|里面|里|中|的|和|及|以及|相关/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  return chunks.length ? [chunks[chunks.length - 1]] : [];
}

function clampLimit(value, fallback = 100) {
  const limit = Number(value || fallback);
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(Math.trunc(limit), 1), 500);
}

function candidateLimit(criteria) {
  const limit = clampLimit(criteria.limit);
  return Array.isArray(criteria.keywordTerms) && criteria.keywordTerms.length > 0
    ? Math.min(limit * 5, 500)
    : limit;
}

function hasScope(criteria, assetType) {
  const scopes = Array.isArray(criteria.scopes) ? criteria.scopes : [];
  return scopes.length === 0 || scopes.includes(assetType);
}

function buildKeywordWhere(columns, terms, params) {
  const normalizedTerms = Array.isArray(terms) ? terms.filter(Boolean) : [];
  if (normalizedTerms.length === 0) return "";
  const groups = normalizedTerms.map((term) => {
    const like = `%${term}%`;
    params.push(...columns.map(() => like));
    return `(${columns.map((column) => `${column} LIKE ?`).join(" OR ")})`;
  });
  return `(${groups.join(" OR ")})`;
}

function addCommonFilter(where, params, column, value) {
  if (value === undefined || value === null || String(value).trim() === "") return;
  where.push(`${column} = ?`);
  params.push(value);
}

function addNumberFilter(where, params, column, value) {
  if (value === undefined || value === null || String(value).trim() === "") return;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return;
  where.push(`${column} = ?`);
  params.push(numberValue);
}

function addProjectFilter(where, params, alias) {
  const projectId = getCurrentProjectId();
  if (!projectId) return null;
  const prefix = alias ? `${alias}.` : "";
  where.push(`${prefix}project_id = ?`);
  params.push(projectId);
  return projectId;
}

function readJsonArray(value) {
  const parsed = parseJson(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function statusScore(status) {
  const normalized = String(status || "").toLowerCase();
  if (["active", "published", "online", "submitted", "succeeded", "success", "enabled"].includes(normalized)) return 8;
  if (["inactive", "offline", "failed", "deleted"].includes(normalized)) return -8;
  return 0;
}

function computeMatch(fields, criteria, baseScore = 0) {
  const terms = Array.isArray(criteria.keywordTerms) ? criteria.keywordTerms : [];
  const bestMatches = new Map();

  if (terms.length === 0) {
    return { score: baseScore, matchedFields: [], highlights: [] };
  }

  for (const field of fields) {
    const values = Array.isArray(field.value) ? field.value : [field.value];
    for (const value of values) {
      const raw = String(value || "").trim();
      if (!raw) continue;
      const lower = raw.toLowerCase();
      for (const term of terms) {
        const normalizedTerm = String(term || "").trim();
        if (!normalizedTerm) continue;
        const termLower = normalizedTerm.toLowerCase();
        const hitKey = `${field.field}:${termLower}`;
        if (lower === termLower) {
          const priorityBoost = field.priority && (criteria.priorityTerms || []).includes(normalizedTerm) ? (field.priorityBoost || 36) : 0;
          const hitScore = (field.exactWeight || 18) + priorityBoost;
          const existing = bestMatches.get(hitKey);
          if (!existing || hitScore > existing.score) {
            bestMatches.set(hitKey, {
              field: field.field,
              score: hitScore,
              text: `${field.label}精确命中 ${normalizedTerm}：${truncate(raw)}`,
            });
          }
          continue;
        }
        if (lower.includes(termLower)) {
          const priorityBoost = field.priority && (criteria.priorityTerms || []).includes(normalizedTerm) ? (field.priorityBoost || 36) : 0;
          const hitScore = (field.weight || 8) + priorityBoost;
          const existing = bestMatches.get(hitKey);
          if (!existing || hitScore > existing.score) {
            bestMatches.set(hitKey, {
              field: field.field,
              score: hitScore,
              text: `${field.label}命中 ${normalizedTerm}：${truncate(raw)}`,
            });
          }
        }
      }
    }
  }

  const matches = Array.from(bestMatches.values()).sort((left, right) => right.score - left.score);
  return {
    score: baseScore + matches.reduce((sum, item) => sum + item.score, 0),
    matchedFields: uniqueStrings(matches.map((item) => item.field)),
    highlights: matches.slice(0, 6).map((item) => ({ field: item.field, text: item.text })),
  };
}

function makeResult(base, matchFields, criteria, context, actions = []) {
  const match = computeMatch(matchFields, criteria, Number(base.score || 0) + statusScore(base.status));
  return {
    id: base.id,
    assetType: base.assetType,
    sourceModule: base.sourceModule,
    sourceId: base.sourceId,
    title: base.title,
    subtitle: base.subtitle || "",
    description: base.description || "",
    status: base.status || "",
    owner: base.owner || "",
    tags: uniqueStrings(base.tags || []),
    score: match.score,
    matchedFields: match.matchedFields,
    highlights: match.highlights,
    context: context || {},
    actions,
  };
}

function buildTableContext(row) {
  return {
    resourceId: Number(row.id),
    resourceCode: row.resourceCode,
    tableName: row.tableName,
    tableComment: row.tableComment || "",
    businessName: row.businessName || "",
    businessDefinition: row.businessDefinition || "",
    departmentName: row.departmentName || "",
    departmentCode: row.departmentCode || "",
    businessSystemName: row.systemName || "",
    businessSystemCode: row.systemCode || "",
    dataSourceName: row.sourceName || "",
    dataSourceCode: row.sourceCode || "",
    dataSourceType: row.sourceType || "",
    catalogName: row.catalogName || "",
    catalogShortCode: row.catalogShortCode || "",
    resourceCategory: row.resourceCategory || "",
    businessTags: parseJson(row.businessTags, []),
    profileStatus: row.profileStatus || "pending",
    aiSummary: row.aiSummary || "",
    fieldNames: String(row.fieldNames || "").split(",").map((item) => item.trim()).filter(Boolean),
    rowCount: row.rowCount === null || row.rowCount === undefined ? null : Number(row.rowCount),
    columnCount: Number(row.columnCount || 0),
    updatedAt: row.updatedAt,
  };
}

async function searchDataMapTables(criteria) {
  if (!hasScope(criteria, "table")) return [];
  const params = [];
  const where = [];
  addProjectFilter(where, params, "r");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere([
    "r.resource_code",
    "r.table_name",
    "r.table_comment",
    "rc.business_name",
    "rc.business_definition",
    "r.business_tags_json",
    "c.catalog_name",
    "c.catalog_short_code",
    "d.department_name",
    "d.department_code",
    "bs.system_name",
    "bs.system_code",
    "ds.source_name",
    "ds.source_code",
    "rp.ai_summary",
  ], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addNumberFilter(where, params, "r.department_id", filters.departmentId);
  addNumberFilter(where, params, "r.business_system_id", filters.businessSystemId);
  addNumberFilter(where, params, "r.data_source_id", filters.dataSourceId);
  addNumberFilter(where, params, "r.catalog_id", filters.catalogId || filters.organizationCatalogId);
  addCommonFilter(where, params, "r.resource_category", filters.resourceCategory || filters.assetCategory);
  addCommonFilter(where, params, "r.status", filters.status);
  if (filters.profileStatus) {
    where.push("COALESCE(rp.profile_status, 'pending') = ?");
    params.push(filters.profileStatus);
  }
  if (filters.owner) {
    where.push("(rc.data_owner LIKE ? OR rc.tech_owner LIKE ? OR r.created_by LIKE ?)");
    params.push(`%${filters.owner}%`, `%${filters.owner}%`, `%${filters.owner}%`);
  }

  const [rows] = await pool.query(
    `SELECT r.id, r.resource_code AS resourceCode, r.table_name AS tableName, r.table_comment AS tableComment,
            r.row_count AS rowCount, r.column_count AS columnCount, r.resource_category AS resourceCategory,
            r.business_tags_json AS businessTags, r.status, r.updated_at AS updatedAt,
            c.catalog_name AS catalogName, c.catalog_short_code AS catalogShortCode,
            d.department_name AS departmentName, d.department_code AS departmentCode,
            bs.system_name AS systemName, bs.system_code AS systemCode,
            ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType,
            rc.business_name AS businessName, rc.business_definition AS businessDefinition,
            rc.data_owner AS dataOwner, rc.tech_owner AS techOwner,
            COALESCE(rp.profile_status, 'pending') AS profileStatus, rp.ai_summary AS aiSummary,
            fieldAgg.field_names AS fieldNames
     FROM dm_resources r
     JOIN dm_catalogs c ON c.id = r.catalog_id
     JOIN dm_departments d ON d.id = r.department_id
     JOIN dm_business_systems bs ON bs.id = r.business_system_id
     JOIN dm_data_sources ds ON ds.id = r.data_source_id
     LEFT JOIN dm_resource_contents rc ON rc.resource_id = r.id
     LEFT JOIN dm_resource_profiles rp ON rp.resource_id = r.id
     LEFT JOIN (
       SELECT resource_id, GROUP_CONCAT(column_name ORDER BY ordinal_position ASC SEPARATOR ',') AS field_names
       FROM dm_resource_fields
       GROUP BY resource_id
     ) fieldAgg ON fieldAgg.resource_id = r.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY r.updated_at DESC, r.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => {
    const context = buildTableContext(row);
    return makeResult({
      id: `data_map:table:${row.id}`,
      assetType: "table",
      sourceModule: "data_map",
      sourceId: Number(row.id),
      title: row.tableName,
      subtitle: `${row.resourceCode} / ${row.sourceName || "-"}`,
      description: row.businessName || row.tableComment || row.businessDefinition || "",
      status: row.status,
      owner: row.dataOwner || row.techOwner || "",
      tags: [SOURCE_MODULE_LABELS.data_map, ASSET_TYPE_LABELS.table, row.resourceCategory, ...parseJson(row.businessTags, [])],
      score: 10,
    }, [
      { field: "resourceCode", label: "资源编码", value: row.resourceCode, exactWeight: 35, weight: 16 },
      { field: "title", label: "表名", value: row.tableName, exactWeight: 35, weight: 16 },
      { field: "description", label: "表描述", value: [row.tableComment, row.businessName, row.businessDefinition], weight: 9 },
      { field: "source", label: "来源信息", value: [row.departmentName, row.systemName, row.sourceName, row.catalogName], weight: 7 },
      { field: "tags", label: "业务标签", value: parseJson(row.businessTags, []), weight: 6 },
      { field: "profile", label: "画像总结", value: row.aiSummary, weight: 5 },
    ], criteria, context, [
      { label: "查看资源详情", path: `/dashboard/data-map/resources/${row.id}` },
    ]);
  });
}

async function searchDataMapFields(criteria) {
  if (!hasScope(criteria, "field")) return [];
  const params = [];
  const where = [];
  addProjectFilter(where, params, "r");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere([
    "rf.column_name",
    "rf.column_comment",
    "rf.business_name",
    "rf.semantic_tags_json",
    "rfp.semantic_tags_json",
    "rfp.feature_tags_json",
    "rfp.ai_business_name",
    "rfp.ai_business_meaning",
    "rfp.sample_values_json",
    "r.resource_code",
    "r.table_name",
    "r.table_comment",
    "rc.business_name",
    "d.department_name",
    "bs.system_name",
    "ds.source_name",
  ], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addNumberFilter(where, params, "r.department_id", filters.departmentId);
  addNumberFilter(where, params, "r.business_system_id", filters.businessSystemId);
  addNumberFilter(where, params, "r.data_source_id", filters.dataSourceId);
  addNumberFilter(where, params, "r.catalog_id", filters.catalogId || filters.organizationCatalogId);
  addCommonFilter(where, params, "r.resource_category", filters.resourceCategory || filters.assetCategory);
  addCommonFilter(where, params, "rf.status", filters.fieldStatus);
  addCommonFilter(where, params, "r.status", filters.status);
  if (filters.profileStatus) {
    where.push("COALESCE(rp.profile_status, 'pending') = ?");
    params.push(filters.profileStatus);
  }

  const [rows] = await pool.query(
    `SELECT rf.id AS fieldId, rf.resource_id AS resourceId, rf.column_name AS columnName,
            rf.data_type AS dataType, rf.column_type AS columnType, rf.column_comment AS columnComment,
            rf.business_name AS fieldBusinessName, rf.semantic_tags_json AS fieldSemanticTags,
            rf.status AS fieldStatus, rf.updated_at AS fieldUpdatedAt,
            r.id, r.resource_code AS resourceCode, r.table_name AS tableName, r.table_comment AS tableComment,
            r.resource_category AS resourceCategory, r.business_tags_json AS businessTags, r.status,
            c.catalog_name AS catalogName, c.catalog_short_code AS catalogShortCode,
            d.department_name AS departmentName, d.department_code AS departmentCode,
            bs.system_name AS systemName, bs.system_code AS systemCode,
            ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType,
            rc.business_name AS businessName, rc.business_definition AS businessDefinition,
            COALESCE(rp.profile_status, 'pending') AS profileStatus, rp.ai_summary AS aiSummary,
            rfp.sample_values_json AS sampleValues, rfp.semantic_tags_json AS profileSemanticTags,
            rfp.feature_tags_json AS featureTags, rfp.ai_business_name AS aiBusinessName,
            rfp.ai_business_meaning AS aiBusinessMeaning
     FROM dm_resource_fields rf
     JOIN dm_resources r ON r.id = rf.resource_id
     JOIN dm_catalogs c ON c.id = r.catalog_id
     JOIN dm_departments d ON d.id = r.department_id
     JOIN dm_business_systems bs ON bs.id = r.business_system_id
     JOIN dm_data_sources ds ON ds.id = r.data_source_id
     LEFT JOIN dm_resource_contents rc ON rc.resource_id = r.id
     LEFT JOIN dm_resource_profiles rp ON rp.resource_id = r.id
     LEFT JOIN dm_resource_field_profiles rfp ON rfp.resource_id = rf.resource_id AND rfp.column_name = rf.column_name
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY rf.updated_at DESC, rf.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => {
    const sampleValues = parseJson(row.sampleValues, []);
    const semanticTags = uniqueStrings([
      ...parseJson(row.fieldSemanticTags, []),
      ...parseJson(row.profileSemanticTags, []),
    ]);
    const featureTags = parseJson(row.featureTags, []);
    const context = {
      fieldId: Number(row.fieldId),
      fieldName: row.columnName,
      fieldComment: row.columnComment || "",
      fieldType: row.columnType || row.dataType || "",
      businessName: row.fieldBusinessName || row.aiBusinessName || "",
      aiBusinessMeaning: row.aiBusinessMeaning || "",
      tableName: row.tableName,
      resourceId: Number(row.resourceId),
      resourceCode: row.resourceCode,
      tableDescription: row.tableComment || row.businessName || "",
      departmentName: row.departmentName || "",
      departmentCode: row.departmentCode || "",
      businessSystemName: row.systemName || "",
      businessSystemCode: row.systemCode || "",
      dataSourceName: row.sourceName || "",
      dataSourceCode: row.sourceCode || "",
      dataSourceType: row.sourceType || "",
      catalogName: row.catalogName || "",
      organizationCatalog: row.catalogName || "",
      resourceCategory: row.resourceCategory || "",
      profileStatus: row.profileStatus || "pending",
      sampleValues,
      semanticTags,
      featureTags,
      aiSummary: row.aiSummary || "",
    };
    return makeResult({
      id: `data_map:field:${row.resourceId}:${row.columnName}`,
      assetType: "field",
      sourceModule: "data_map",
      sourceId: `${row.resourceId}:${row.columnName}`,
      title: row.columnName,
      subtitle: `${row.tableName} / ${row.resourceCode}`,
      description: row.columnComment || row.fieldBusinessName || row.aiBusinessMeaning || "",
      status: row.status,
      owner: "",
      tags: [SOURCE_MODULE_LABELS.data_map, ASSET_TYPE_LABELS.field, row.dataType, ...semanticTags, ...featureTags],
      score: 18,
    }, [
      { field: "fieldName", label: "字段名", value: row.columnName, exactWeight: 45, weight: 24, priority: true, priorityBoost: 42 },
      { field: "fieldComment", label: "字段注释", value: row.columnComment, exactWeight: 38, weight: 22, priority: true, priorityBoost: 42 },
      { field: "fieldBusinessName", label: "字段业务名", value: [row.fieldBusinessName, row.aiBusinessName, row.aiBusinessMeaning], weight: 16, priority: true, priorityBoost: 32 },
      { field: "sampleValues", label: "样例值", value: sampleValues, weight: 8 },
      { field: "fieldTags", label: "字段标签", value: [...semanticTags, ...featureTags], weight: 10 },
      { field: "table", label: "所属表", value: [row.tableName, row.resourceCode, row.tableComment, row.businessName], weight: 9 },
      { field: "source", label: "来源信息", value: [row.departmentName, row.systemName, row.sourceName, row.catalogName], weight: 6 },
    ], criteria, context, [
      { label: "查看字段所在资源", path: `/dashboard/data-map/resources/${row.resourceId}?tab=fields&field=${encodeURIComponent(row.columnName)}` },
    ]);
  });
}

async function searchDataMapDataSources(criteria) {
  if (!hasScope(criteria, "datasource")) return [];
  const params = [];
  const where = [];
  addProjectFilter(where, params, "ds");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere([
    "ds.source_name",
    "ds.source_code",
    "ds.source_type",
    "ds.purpose",
    "ds.owner_name",
    "d.department_name",
    "d.department_code",
    "bs.system_name",
    "bs.system_code",
  ], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addNumberFilter(where, params, "ds.department_id", filters.departmentId);
  addNumberFilter(where, params, "ds.business_system_id", filters.businessSystemId);
  addNumberFilter(where, params, "ds.id", filters.dataSourceId);
  addCommonFilter(where, params, "ds.status", filters.status);
  if (filters.owner) {
    where.push("ds.owner_name LIKE ?");
    params.push(`%${filters.owner}%`);
  }

  const [rows] = await pool.query(
    `SELECT ds.id, ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType,
            ds.owner_name AS ownerName, ds.environment, ds.purpose, ds.status, ds.updated_at AS updatedAt,
            d.department_name AS departmentName, d.department_code AS departmentCode,
            bs.system_name AS systemName, bs.system_code AS systemCode,
            COUNT(DISTINCT r.id) AS resourceCount
     FROM dm_data_sources ds
     JOIN dm_departments d ON d.id = ds.department_id
     JOIN dm_business_systems bs ON bs.id = ds.business_system_id
     LEFT JOIN dm_resources r ON r.data_source_id = ds.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY ds.id, d.department_name, d.department_code, bs.system_name, bs.system_code
     ORDER BY ds.updated_at DESC, ds.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => makeResult({
    id: `data_map:datasource:${row.id}`,
    assetType: "datasource",
    sourceModule: "data_map",
    sourceId: Number(row.id),
    title: row.sourceName,
    subtitle: `${row.sourceCode} / ${row.sourceType}`,
    description: row.purpose || `${row.departmentName || ""} ${row.systemName || ""}`.trim(),
    status: row.status,
    owner: row.ownerName,
    tags: [SOURCE_MODULE_LABELS.data_map, ASSET_TYPE_LABELS.datasource, row.sourceType, row.environment],
    score: 8,
  }, [
    { field: "sourceName", label: "数据源名称", value: row.sourceName, exactWeight: 35, weight: 16 },
    { field: "sourceCode", label: "数据源编码", value: row.sourceCode, exactWeight: 35, weight: 16 },
    { field: "sourceType", label: "数据源类型", value: row.sourceType, weight: 8 },
    { field: "source", label: "来源信息", value: [row.departmentName, row.systemName, row.purpose], weight: 7 },
  ], criteria, {
    sourceId: Number(row.id),
    sourceName: row.sourceName,
    sourceCode: row.sourceCode,
    sourceType: row.sourceType,
    departmentName: row.departmentName || "",
    businessSystemName: row.systemName || "",
    resourceCount: Number(row.resourceCount || 0),
    ownerName: row.ownerName || "",
  }, [
    { label: "查看数据地图数据源", path: "/dashboard/data-map/sources" },
  ]));
}

async function findBusinessDataSearchTargets(elementIds = [], filters = {}) {
  const normalizedElementIds = [...new Set((Array.isArray(elementIds) ? elementIds : [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0))];
  if (!normalizedElementIds.length) return [];

  const params = [normalizedElementIds];
  const where = ["fm.element_id IN (?)"];
  addNumberFilter(where, params, "r.department_id", filters.departmentId);
  addNumberFilter(where, params, "r.business_system_id", filters.businessSystemId);
  addNumberFilter(where, params, "r.data_source_id", filters.dataSourceId);
  addNumberFilter(where, params, "r.catalog_id", filters.catalogId || filters.organizationCatalogId);
  addCommonFilter(where, params, "r.resource_category", filters.resourceCategory || filters.assetCategory);
  addCommonFilter(where, params, "r.status", filters.status);
  addCommonFilter(where, params, "f.status", filters.fieldStatus);

  const [rows] = await pool.query(
    `SELECT e.id AS elementId, e.element_code AS elementCode, e.element_name_cn AS elementNameCn,
            r.id AS resourceId, r.resource_code AS resourceCode, r.table_name AS tableName,
            r.table_comment AS tableComment, r.resource_category AS resourceCategory, r.status AS resourceStatus,
            c.id AS catalogId, c.catalog_name AS catalogName, c.catalog_short_code AS catalogShortCode,
            d.id AS departmentId, d.department_name AS departmentName, d.department_code AS departmentCode,
            bs.id AS businessSystemId, bs.system_name AS systemName, bs.system_code AS systemCode,
            ds.id AS dataSourceId, ds.source_name AS sourceName, ds.source_code AS sourceCode,
            ds.source_type AS sourceType, ds.connection_config AS connectionConfig, ds.status AS sourceStatus,
            f.id AS fieldId, f.column_name AS columnName, f.column_comment AS columnComment,
            f.data_type AS dataType, f.column_type AS columnType, f.ordinal_position AS ordinalPosition,
            fm.mapping_status AS mappingStatus, fm.confidence AS confidence
     FROM dm_resource_fields f
     JOIN dm_resources r ON r.id = f.resource_id
     JOIN dm_catalogs c ON c.id = r.catalog_id
     JOIN dm_departments d ON d.id = r.department_id
     JOIN dm_business_systems bs ON bs.id = r.business_system_id
     JOIN dm_data_sources ds ON ds.id = r.data_source_id
     JOIN std_field_mappings fm ON fm.id = (
       SELECT fm2.id
       FROM std_field_mappings fm2
       WHERE fm2.source_module = 'data_map'
         AND fm2.mapping_status <> 'deleted'
         AND fm2.resource_id = f.resource_id
         AND fm2.table_name = r.table_name
         AND fm2.column_name = f.column_name
       ORDER BY CASE fm2.mapping_status WHEN 'approved' THEN 0 WHEN 'suggested' THEN 1 ELSE 2 END, fm2.id DESC
       LIMIT 1
     )
     JOIN std_data_elements e ON e.id = fm.element_id AND e.status <> 'deleted'
     WHERE ${where.join(" AND ")}
     ORDER BY r.id ASC, e.element_code ASC, f.ordinal_position ASC, f.id ASC`,
    params
  );

  return rows.map((row) => ({
    elementId: Number(row.elementId),
    elementCode: row.elementCode,
    elementNameCn: row.elementNameCn,
    resourceId: Number(row.resourceId),
    resourceCode: row.resourceCode,
    tableName: row.tableName,
    tableComment: row.tableComment || "",
    resourceCategory: row.resourceCategory || "",
    resourceStatus: row.resourceStatus || "",
    catalogId: Number(row.catalogId),
    catalogName: row.catalogName || "",
    catalogShortCode: row.catalogShortCode || "",
    departmentId: Number(row.departmentId),
    departmentName: row.departmentName || "",
    departmentCode: row.departmentCode || "",
    businessSystemId: Number(row.businessSystemId),
    businessSystemName: row.systemName || "",
    businessSystemCode: row.systemCode || "",
    dataSourceId: Number(row.dataSourceId),
    dataSourceName: row.sourceName || "",
    dataSourceCode: row.sourceCode || "",
    dataSource: {
      id: Number(row.dataSourceId),
      sourceName: row.sourceName || "",
      sourceCode: row.sourceCode || "",
      sourceType: row.sourceType || "",
      connectionConfig: parseJson(row.connectionConfig, {}),
      status: row.sourceStatus || "",
    },
    fieldId: Number(row.fieldId),
    columnName: row.columnName,
    columnComment: row.columnComment || "",
    dataType: row.dataType || "",
    columnType: row.columnType || "",
    mappingStatus: row.mappingStatus || "",
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
  }));
}

async function searchIngestionDataSources(criteria) {
  if (!hasScope(criteria, "datasource")) return [];
  const params = [];
  const where = [];
  addProjectFilter(where, params, "ds");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere(["ds.source_name", "ds.source_code", "ds.source_type", "ds.owner_name"], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addNumberFilter(where, params, "ds.id", filters.dataSourceId);
  addCommonFilter(where, params, "ds.status", filters.status);
  if (filters.owner) {
    where.push("ds.owner_name LIKE ?");
    params.push(`%${filters.owner}%`);
  }

  const [rows] = await pool.query(
    `SELECT ds.id, ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType,
            ds.owner_name AS ownerName, ds.status, ds.updated_at AS updatedAt,
            COUNT(DISTINCT t.id) AS taskCount
     FROM ingestion_data_sources ds
     LEFT JOIN ingestion_tasks t ON t.source_id = ds.id OR t.target_source_id = ds.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY ds.id
     ORDER BY ds.updated_at DESC, ds.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => makeResult({
    id: `ingestion:datasource:${row.id}`,
    assetType: "datasource",
    sourceModule: "ingestion",
    sourceId: Number(row.id),
    title: row.sourceName,
    subtitle: `${row.sourceCode} / ${row.sourceType}`,
    description: `已关联 ${Number(row.taskCount || 0)} 个接入任务`,
    status: row.status,
    owner: row.ownerName,
    tags: [SOURCE_MODULE_LABELS.ingestion, ASSET_TYPE_LABELS.datasource, row.sourceType],
    score: 7,
  }, [
    { field: "sourceName", label: "数据源名称", value: row.sourceName, exactWeight: 35, weight: 16 },
    { field: "sourceCode", label: "数据源编码", value: row.sourceCode, exactWeight: 35, weight: 16 },
    { field: "sourceType", label: "数据源类型", value: row.sourceType, weight: 8 },
  ], criteria, {
    sourceId: Number(row.id),
    sourceName: row.sourceName,
    sourceCode: row.sourceCode,
    sourceType: row.sourceType,
    taskCount: Number(row.taskCount || 0),
    ownerName: row.ownerName || "",
  }, [
    { label: "查看接入数据源", path: "/dashboard/data-sources" },
  ]));
}

async function searchIngestionTasks(criteria) {
  if (!hasScope(criteria, "ingestion_task")) return [];
  const params = [];
  const where = [];
  addProjectFilter(where, params, "t");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere([
    "t.task_name",
    "t.task_code",
    "t.source_table",
    "t.target_table",
    "t.description",
    "s.source_name",
    "s.source_code",
    "ts.source_name",
    "ts.source_code",
  ], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  if (filters.dataSourceId) {
    where.push("(t.source_id = ? OR t.target_source_id = ?)");
    params.push(Number(filters.dataSourceId), Number(filters.dataSourceId));
  }
  addCommonFilter(where, params, "t.status", filters.status);
  if (filters.owner) {
    where.push("t.owner_name LIKE ?");
    params.push(`%${filters.owner}%`);
  }

  const [rows] = await pool.query(
    `SELECT t.id, t.task_name AS taskName, t.task_code AS taskCode, t.source_id AS sourceId,
            t.source_table AS sourceTable, t.target_source_id AS targetSourceId, t.target_type AS targetType,
            t.target_table AS targetTable, t.sync_mode AS syncMode, t.status, t.description,
            t.owner_name AS ownerName, t.schedule_enabled AS scheduleEnabled, t.updated_at AS updatedAt,
            s.source_name AS sourceName, s.source_code AS sourceCode,
            ts.source_name AS targetSourceName, ts.source_code AS targetSourceCode,
            jr.start_time AS lastRunTime, jr.run_status AS lastRunStatus
     FROM ingestion_tasks t
     LEFT JOIN ingestion_data_sources s ON s.id = t.source_id
     LEFT JOIN ingestion_data_sources ts ON ts.id = t.target_source_id
     LEFT JOIN (
       SELECT r1.task_id, r1.start_time, r1.run_status
       FROM ingestion_job_runs r1
       INNER JOIN (
         SELECT task_id, MAX(created_at) AS maxCreatedAt
         FROM ingestion_job_runs
         GROUP BY task_id
       ) latest ON latest.task_id = r1.task_id AND latest.maxCreatedAt = r1.created_at
     ) jr ON jr.task_id = t.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY t.updated_at DESC, t.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => makeResult({
    id: `ingestion:ingestion_task:${row.id}`,
    assetType: "ingestion_task",
    sourceModule: "ingestion",
    sourceId: Number(row.id),
    title: row.taskName,
    subtitle: `${row.taskCode} / ${row.sourceTable || "-"} -> ${row.targetTable || "-"}`,
    description: row.description || `${row.sourceName || "-"} 到 ${row.targetSourceName || row.targetType || "-"}`,
    status: row.status,
    owner: row.ownerName,
    tags: [SOURCE_MODULE_LABELS.ingestion, ASSET_TYPE_LABELS.ingestion_task, row.syncMode, row.scheduleEnabled ? "已调度" : "手动"],
    score: 9,
  }, [
    { field: "taskName", label: "任务名称", value: row.taskName, exactWeight: 35, weight: 16 },
    { field: "taskCode", label: "任务编码", value: row.taskCode, exactWeight: 35, weight: 16 },
    { field: "sourceTable", label: "来源表", value: row.sourceTable, exactWeight: 30, weight: 14 },
    { field: "targetTable", label: "目标表", value: row.targetTable, exactWeight: 30, weight: 14 },
    { field: "source", label: "数据源", value: [row.sourceName, row.sourceCode, row.targetSourceName, row.targetSourceCode], weight: 8 },
    { field: "description", label: "任务描述", value: row.description, weight: 6 },
  ], criteria, {
    taskId: Number(row.id),
    taskName: row.taskName,
    taskCode: row.taskCode,
    sourceName: row.sourceName || "",
    sourceTable: row.sourceTable || "",
    targetSourceName: row.targetSourceName || "",
    targetTable: row.targetTable || "",
    syncMode: row.syncMode,
    scheduleEnabled: Boolean(row.scheduleEnabled),
    lastRunTime: row.lastRunTime || null,
    lastRunStatus: row.lastRunStatus || "",
  }, [
    { label: "编辑接入任务", path: `/dashboard/data-ingestion-jobs/${row.id}/edit` },
    { label: "查看任务列表", path: "/dashboard/data-ingestion-jobs" },
  ]));
}

async function searchIngestionResearchTables(criteria) {
  if (!hasScope(criteria, "table")) return [];
  const params = [];
  const where = [];
  addProjectFilter(where, params, "r");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere([
    "p.table_name",
    "p.table_comment",
    "p.category",
    "p.priority",
    "p.suggested_mode",
    "p.incremental_column",
    "p.metadata_issues_json",
    "p.evidence_json",
    "p.risks_json",
    "p.field_summary_json",
    "r.run_name",
    "r.source_name",
    "r.source_type",
    "r.database_name",
    "r.schema_name",
    "r.summary_text",
  ], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addNumberFilter(where, params, "r.source_id", filters.dataSourceId);
  addCommonFilter(where, params, "r.status", filters.status);
  if (filters.owner) {
    where.push("r.created_by LIKE ?");
    params.push(`%${filters.owner}%`);
  }

  const [rows] = await pool.query(
    `SELECT p.id AS profileId, p.run_id AS runId, p.table_name AS tableName,
            p.table_comment AS tableComment, p.row_count_mode AS rowCountMode,
            p.row_count AS rowCount, p.column_count AS columnCount, p.sample_count AS sampleCount,
            p.category, p.priority, p.confidence, p.suggested_mode AS suggestedMode,
            p.incremental_column AS incrementalColumn, p.metadata_issues_json AS metadataIssues,
            p.evidence_json AS evidence, p.risks_json AS risks, p.quality_json AS quality,
            p.field_summary_json AS fieldSummary, p.updated_at AS updatedAt,
            r.source_id AS sourceId, r.run_name AS runName, r.source_name AS sourceName,
            r.source_type AS sourceType, r.database_name AS databaseName, r.schema_name AS schemaName,
            r.status, r.summary_text AS summaryText, r.created_by AS createdBy, r.finished_at AS finishedAt
     FROM data_source_research_table_profiles p
     JOIN data_source_research_runs r ON r.id = p.run_id
     JOIN (
       SELECT r2.source_id, p2.table_name, MAX(p2.id) AS latestProfileId
       FROM data_source_research_table_profiles p2
       JOIN data_source_research_runs r2 ON r2.id = p2.run_id
       GROUP BY r2.source_id, p2.table_name
     ) latest ON latest.latestProfileId = p.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY p.updated_at DESC, p.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => {
    const evidence = readJsonArray(row.evidence);
    const risks = readJsonArray(row.risks);
    const metadataIssues = readJsonArray(row.metadataIssues);
    const context = {
      runId: Number(row.runId),
      sourceId: Number(row.sourceId),
      sourceName: row.sourceName || "",
      sourceType: row.sourceType || "",
      databaseName: row.databaseName || "",
      schemaName: row.schemaName || "",
      tableName: row.tableName,
      tableComment: row.tableComment || "",
      rowCountMode: row.rowCountMode,
      rowCount: row.rowCount === null || row.rowCount === undefined ? null : Number(row.rowCount),
      columnCount: Number(row.columnCount || 0),
      sampleCount: Number(row.sampleCount || 0),
      category: row.category || "",
      priority: row.priority || "",
      confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
      suggestedMode: row.suggestedMode || "",
      incrementalColumn: row.incrementalColumn || "",
      metadataIssues,
      evidence,
      risks,
      quality: parseJson(row.quality, {}),
      fieldSummary: parseJson(row.fieldSummary, {}),
      summaryText: row.summaryText || "",
      finishedAt: row.finishedAt || null,
    };

    return makeResult({
      id: `ingestion:research_table:${row.sourceId}:${row.tableName}`,
      assetType: "table",
      sourceModule: "ingestion",
      sourceId: `${row.runId}:${row.tableName}`,
      title: row.tableName,
      subtitle: `${row.sourceName || "-"} / 数据调研 / ${row.category || "-"}`,
      description: row.tableComment || row.summaryText || evidence.join("；"),
      status: row.status,
      owner: row.createdBy,
      tags: [SOURCE_MODULE_LABELS.ingestion, "数据调研", row.category, row.priority, row.suggestedMode],
      score: 8,
    }, [
      { field: "tableName", label: "调研表", value: row.tableName, exactWeight: 32, weight: 15 },
      { field: "tableComment", label: "表注释", value: row.tableComment, weight: 10 },
      { field: "classification", label: "分类建议", value: [row.category, row.priority, row.suggestedMode, row.incrementalColumn], weight: 9 },
      { field: "source", label: "来源数据源", value: [row.sourceName, row.sourceType, row.databaseName, row.schemaName], weight: 8 },
      { field: "summary", label: "AI 调研结论", value: [row.summaryText, evidence, risks, metadataIssues], weight: 7 },
      { field: "fields", label: "字段画像", value: row.fieldSummary, weight: 5 },
    ], criteria, context, [
      { label: "查看数据源调研", path: "/dashboard/data-sources" },
    ]);
  });
}

async function searchIngestionResearchFields(criteria) {
  if (!hasScope(criteria, "field")) return [];
  const params = [];
  const where = [];
  addProjectFilter(where, params, "r");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere([
    "fp.column_name",
    "fp.column_comment",
    "fp.data_type",
    "fp.column_type",
    "fp.sample_values_json",
    "fp.issue_tags_json",
    "fp.table_name",
    "tp.table_comment",
    "tp.category",
    "tp.priority",
    "r.run_name",
    "r.source_name",
    "r.source_type",
    "r.database_name",
    "r.summary_text",
  ], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addNumberFilter(where, params, "r.source_id", filters.dataSourceId);
  addCommonFilter(where, params, "r.status", filters.status);
  if (filters.owner) {
    where.push("r.created_by LIKE ?");
    params.push(`%${filters.owner}%`);
  }

  const [rows] = await pool.query(
    `SELECT fp.id AS fieldProfileId, fp.run_id AS runId, fp.table_name AS tableName,
            fp.column_name AS columnName, fp.ordinal_position AS ordinalPosition,
            fp.data_type AS dataType, fp.column_type AS columnType, fp.is_nullable AS isNullable,
            fp.is_primary_key AS isPrimaryKey, fp.column_comment AS columnComment,
            fp.null_rate AS nullRate, fp.distinct_ratio AS distinctRatio,
            fp.sample_values_json AS sampleValues, fp.issue_tags_json AS issueTags,
            tp.table_comment AS tableComment, tp.category, tp.priority, tp.suggested_mode AS suggestedMode,
            tp.evidence_json AS evidence, tp.risks_json AS risks,
            r.source_id AS sourceId, r.source_name AS sourceName, r.source_type AS sourceType,
            r.database_name AS databaseName, r.schema_name AS schemaName, r.status,
            r.summary_text AS summaryText, r.created_by AS createdBy, r.finished_at AS finishedAt
     FROM data_source_research_field_profiles fp
     JOIN data_source_research_runs r ON r.id = fp.run_id
     LEFT JOIN data_source_research_table_profiles tp ON tp.run_id = fp.run_id AND tp.table_name = fp.table_name
     JOIN (
       SELECT r2.source_id, fp2.table_name, fp2.column_name, MAX(fp2.id) AS latestFieldProfileId
       FROM data_source_research_field_profiles fp2
       JOIN data_source_research_runs r2 ON r2.id = fp2.run_id
       GROUP BY r2.source_id, fp2.table_name, fp2.column_name
     ) latest ON latest.latestFieldProfileId = fp.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY fp.updated_at DESC, fp.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => {
    const sampleValues = readJsonArray(row.sampleValues);
    const issueTags = readJsonArray(row.issueTags);
    const context = {
      runId: Number(row.runId),
      fieldProfileId: Number(row.fieldProfileId),
      fieldName: row.columnName,
      fieldComment: row.columnComment || "",
      fieldType: row.columnType || row.dataType || "",
      tableName: row.tableName,
      tableDescription: row.tableComment || "",
      sourceId: Number(row.sourceId),
      dataSourceName: row.sourceName || "",
      dataSourceType: row.sourceType || "",
      databaseName: row.databaseName || "",
      schemaName: row.schemaName || "",
      organizationCatalog: "数据接入调研",
      sampleValues,
      semanticTags: [row.category, row.priority].filter(Boolean),
      featureTags: issueTags,
      nullRate: row.nullRate === null || row.nullRate === undefined ? null : Number(row.nullRate),
      distinctRatio: row.distinctRatio === null || row.distinctRatio === undefined ? null : Number(row.distinctRatio),
      isNullable: Boolean(row.isNullable),
      isPrimaryKey: Boolean(row.isPrimaryKey),
      suggestedMode: row.suggestedMode || "",
      evidence: readJsonArray(row.evidence),
      risks: readJsonArray(row.risks),
      aiSummary: row.summaryText || "",
      finishedAt: row.finishedAt || null,
    };

    return makeResult({
      id: `ingestion:research_field:${row.sourceId}:${row.tableName}:${row.columnName}`,
      assetType: "field",
      sourceModule: "ingestion",
      sourceId: `${row.runId}:${row.tableName}:${row.columnName}`,
      title: row.columnName,
      subtitle: `${row.tableName} / ${row.sourceName || "-"}`,
      description: row.columnComment || row.tableComment || row.summaryText || "",
      status: row.status,
      owner: row.createdBy,
      tags: [SOURCE_MODULE_LABELS.ingestion, "数据调研字段", row.dataType, row.category, ...issueTags],
      score: 12,
    }, [
      { field: "fieldName", label: "字段名", value: row.columnName, exactWeight: 42, weight: 22, priority: true, priorityBoost: 36 },
      { field: "fieldComment", label: "字段注释", value: row.columnComment, exactWeight: 36, weight: 20, priority: true, priorityBoost: 36 },
      { field: "fieldType", label: "字段类型", value: [row.dataType, row.columnType], weight: 8 },
      { field: "sampleValues", label: "样例值", value: sampleValues, weight: 8 },
      { field: "fieldTags", label: "字段画像", value: issueTags, weight: 8 },
      { field: "table", label: "所属表", value: [row.tableName, row.tableComment, row.category], weight: 9 },
      { field: "source", label: "来源数据源", value: [row.sourceName, row.sourceType, row.databaseName, row.schemaName], weight: 7 },
    ], criteria, context, [
      { label: "查看数据源调研", path: "/dashboard/data-sources" },
    ]);
  });
}

async function searchQualityDataSources(criteria) {
  if (!hasScope(criteria, "datasource")) return [];
  const params = [];
  const where = [];
  addProjectFilter(where, params, "ds");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere(["ds.source_name", "ds.source_code", "ds.source_type", "ds.owner_name"], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addNumberFilter(where, params, "ds.id", filters.dataSourceId);
  addCommonFilter(where, params, "ds.status", filters.status);
  if (filters.owner) {
    where.push("ds.owner_name LIKE ?");
    params.push(`%${filters.owner}%`);
  }

  const [rows] = await pool.query(
    `SELECT ds.id, ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType,
            ds.owner_name AS ownerName, ds.status, ds.updated_at AS updatedAt,
            COUNT(DISTINCT mt.id) AS monitorTableCount
     FROM qc_data_sources ds
     LEFT JOIN qc_monitor_table mt ON mt.source_id = ds.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY ds.id
     ORDER BY ds.updated_at DESC, ds.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => makeResult({
    id: `quality:datasource:${row.id}`,
    assetType: "datasource",
    sourceModule: "quality",
    sourceId: Number(row.id),
    title: row.sourceName,
    subtitle: `${row.sourceCode} / ${row.sourceType}`,
    description: `已监控 ${Number(row.monitorTableCount || 0)} 张表`,
    status: row.status,
    owner: row.ownerName,
    tags: [SOURCE_MODULE_LABELS.quality, ASSET_TYPE_LABELS.datasource, row.sourceType],
    score: 7,
  }, [
    { field: "sourceName", label: "数据源名称", value: row.sourceName, exactWeight: 35, weight: 16 },
    { field: "sourceCode", label: "数据源编码", value: row.sourceCode, exactWeight: 35, weight: 16 },
    { field: "sourceType", label: "数据源类型", value: row.sourceType, weight: 8 },
  ], criteria, {
    sourceId: Number(row.id),
    sourceName: row.sourceName,
    sourceCode: row.sourceCode,
    sourceType: row.sourceType,
    monitorTableCount: Number(row.monitorTableCount || 0),
    ownerName: row.ownerName || "",
  }, [
    { label: "查看质量数据源", path: "/dashboard/quality-control/data-sources" },
  ]));
}

async function searchQualityMonitorTables(criteria) {
  if (!hasScope(criteria, "table")) return [];
  const params = [];
  const where = ["mt.enabled = 1"];
  addProjectFilter(where, params, "mt");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere([
    "mt.table_name",
    "mt.full_table_name",
    "mt.table_comment",
    "mt.column_snapshot_json",
    "mt.last_profile_json",
    "ds.source_name",
    "ds.source_code",
  ], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addNumberFilter(where, params, "mt.source_id", filters.dataSourceId);
  addCommonFilter(where, params, "mt.strategy_status", filters.status);

  const [rows] = await pool.query(
    `SELECT mt.id, mt.source_id AS sourceId, mt.table_name AS tableName, mt.full_table_name AS fullTableName,
            mt.table_comment AS tableComment, mt.enabled, mt.strategy_status AS strategyStatus,
            mt.column_snapshot_json AS columnSnapshot, mt.last_sync_at AS lastSyncAt, mt.updated_at AS updatedAt,
            ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType
     FROM qc_monitor_table mt
     JOIN qc_data_sources ds ON ds.id = mt.source_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY mt.updated_at DESC, mt.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => makeResult({
    id: `quality:table:${row.id}`,
    assetType: "table",
    sourceModule: "quality",
    sourceId: Number(row.id),
    title: row.tableName,
    subtitle: `${row.sourceName || "-"} / ${row.strategyStatus}`,
    description: row.tableComment || row.fullTableName || "",
    status: row.enabled ? row.strategyStatus : "inactive",
    owner: "",
    tags: [SOURCE_MODULE_LABELS.quality, "监控表", row.sourceType],
    score: 8,
  }, [
    { field: "tableName", label: "监控表", value: [row.tableName, row.fullTableName], exactWeight: 32, weight: 15 },
    { field: "tableComment", label: "表描述", value: row.tableComment, weight: 9 },
    { field: "source", label: "质量数据源", value: [row.sourceName, row.sourceCode], weight: 8 },
    { field: "columns", label: "字段范围", value: row.columnSnapshot, weight: 5 },
  ], criteria, {
    monitorTableId: Number(row.id),
    tableName: row.tableName,
    fullTableName: row.fullTableName || "",
    tableComment: row.tableComment || "",
    sourceName: row.sourceName || "",
    sourceCode: row.sourceCode || "",
    sourceType: row.sourceType || "",
    enabled: Boolean(row.enabled),
    strategyStatus: row.strategyStatus,
    lastSyncAt: row.lastSyncAt || null,
  }, [
    { label: "查看质量策略", path: `/dashboard/quality-control/strategies/${row.id}` },
  ]));
}

async function searchQualityRules(criteria) {
  if (!hasScope(criteria, "quality_rule")) return [];
  const params = [];
  const where = ["r.status <> 'deleted'"];
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere([
    "r.rule_name",
    "r.rule_code",
    "r.rule_scene",
    "r.regex_pattern",
    "r.match_example_json",
    "r.mismatch_example_json",
    "r.severity",
  ], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addCommonFilter(where, params, "r.status", filters.status);
  if (filters.owner) {
    where.push("r.created_by LIKE ?");
    params.push(`%${filters.owner}%`);
  }

  const [rows] = await pool.query(
    `SELECT r.id, r.rule_code AS ruleCode, r.rule_name AS ruleName, r.rule_scene AS ruleScene,
            r.regex_pattern AS regexPattern, r.match_example_json AS matchExamples,
            r.mismatch_example_json AS mismatchExamples, r.severity, r.status,
            r.created_by AS createdBy, r.updated_at AS updatedAt
     FROM qc_regex_rule r
     WHERE ${where.join(" AND ")}
     ORDER BY r.updated_at DESC, r.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => makeResult({
    id: `quality:quality_rule:${row.id}`,
    assetType: "quality_rule",
    sourceModule: "quality",
    sourceId: Number(row.id),
    title: row.ruleName,
    subtitle: `${row.ruleCode} / ${row.ruleScene}`,
    description: row.regexPattern,
    status: row.status,
    owner: row.createdBy,
    tags: [SOURCE_MODULE_LABELS.quality, ASSET_TYPE_LABELS.quality_rule, row.ruleScene, row.severity],
    score: 10,
  }, [
    { field: "ruleName", label: "规则名称", value: row.ruleName, exactWeight: 35, weight: 16 },
    { field: "ruleCode", label: "规则编码", value: row.ruleCode, exactWeight: 35, weight: 16 },
    { field: "ruleType", label: "规则类型", value: row.ruleScene, weight: 9 },
    { field: "regex", label: "规则表达式", value: row.regexPattern, weight: 8 },
    { field: "examples", label: "样例", value: [row.matchExamples, row.mismatchExamples], weight: 5 },
  ], criteria, {
    ruleId: Number(row.id),
    ruleName: row.ruleName,
    ruleCode: row.ruleCode,
    ruleType: row.ruleScene,
    regexPattern: row.regexPattern,
    severity: row.severity,
    matchExamples: parseJson(row.matchExamples, []),
    mismatchExamples: parseJson(row.mismatchExamples, []),
  }, [
    { label: "查看规则管理", path: "/dashboard/quality-control/rules" },
  ]));
}

async function searchQualityStrategies(criteria) {
  if (!hasScope(criteria, "quality_strategy")) return [];
  const params = [];
  const where = ["mt.enabled = 1"];
  addProjectFilter(where, params, "s");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere([
    "s.table_name",
    "s.current_summary",
    "s.strategy_status",
    "mt.table_comment",
    "ds.source_name",
    "ds.source_code",
    "sv.field_strategy_json",
    "sv.advanced_rule_json",
    "sv.ai_summary_text",
  ], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addNumberFilter(where, params, "s.source_id", filters.dataSourceId);
  addCommonFilter(where, params, "s.strategy_status", filters.status);
  if (filters.owner) {
    where.push("s.submitted_by LIKE ?");
    params.push(`%${filters.owner}%`);
  }

  const [rows] = await pool.query(
    `SELECT s.id, s.monitor_table_id AS monitorTableId, s.source_id AS sourceId, s.table_name AS tableName,
            s.current_version_no AS currentVersionNo, s.strategy_status AS strategyStatus,
            s.current_summary AS currentSummary, s.submitted_by AS submittedBy,
            s.last_recommended_at AS lastRecommendedAt, s.last_submitted_at AS lastSubmittedAt,
            s.updated_at AS updatedAt,
            mt.table_comment AS tableComment,
            ds.source_name AS sourceName, ds.source_code AS sourceCode,
            sv.field_strategy_json AS fieldStrategies, sv.advanced_rule_json AS advancedRules,
            sv.ai_summary_text AS aiSummaryText
     FROM qc_strategy s
     JOIN qc_monitor_table mt ON mt.id = s.monitor_table_id
     JOIN qc_data_sources ds ON ds.id = s.source_id
     LEFT JOIN qc_strategy_version sv ON sv.id = s.current_version_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY s.updated_at DESC, s.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => makeResult({
    id: `quality:quality_strategy:${row.id}`,
    assetType: "quality_strategy",
    sourceModule: "quality",
    sourceId: Number(row.id),
    title: `${row.tableName} 质量策略`,
    subtitle: `${row.sourceName || "-"} / v${row.currentVersionNo || "-"}`,
    description: row.currentSummary || row.aiSummaryText || row.tableComment || "",
    status: row.strategyStatus,
    owner: row.submittedBy,
    tags: [SOURCE_MODULE_LABELS.quality, ASSET_TYPE_LABELS.quality_strategy, row.strategyStatus],
    score: 9,
  }, [
    { field: "strategyName", label: "策略表", value: row.tableName, exactWeight: 32, weight: 15 },
    { field: "summary", label: "策略摘要", value: [row.currentSummary, row.aiSummaryText], weight: 10 },
    { field: "source", label: "绑定数据源", value: [row.sourceName, row.sourceCode], weight: 8 },
    { field: "rules", label: "规则清单", value: [row.fieldStrategies, row.advancedRules], weight: 6 },
  ], criteria, {
    strategyId: Number(row.id),
    monitorTableId: Number(row.monitorTableId),
    tableName: row.tableName,
    tableComment: row.tableComment || "",
    sourceName: row.sourceName || "",
    sourceCode: row.sourceCode || "",
    currentVersionNo: row.currentVersionNo ? Number(row.currentVersionNo) : null,
    currentSummary: row.currentSummary || "",
    aiSummaryText: row.aiSummaryText || "",
    lastRecommendedAt: row.lastRecommendedAt || null,
    lastSubmittedAt: row.lastSubmittedAt || null,
  }, [
    { label: "查看策略详情", path: `/dashboard/quality-control/strategies/${row.monitorTableId}` },
  ]));
}

async function searchQualityResults(criteria) {
  if (!hasScope(criteria, "quality_result")) return [];
  const params = [];
  const where = [];
  addProjectFilter(where, params, "t");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere([
    "t.task_name",
    "t.task_code",
    "t.table_name",
    "t.last_run_status",
    "r.batch_id",
    "r.error_message",
    "ds.source_name",
    "ds.source_code",
  ], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addNumberFilter(where, params, "t.source_id", filters.dataSourceId);
  addCommonFilter(where, params, "t.last_run_status", filters.status);
  if (filters.owner) {
    where.push("t.owner_name LIKE ?");
    params.push(`%${filters.owner}%`);
  }

  const [rows] = await pool.query(
    `SELECT t.id AS taskId, t.task_name AS taskName, t.task_code AS taskCode, t.table_name AS tableName,
            t.status AS taskStatus, t.owner_name AS ownerName, t.last_run_time AS lastRunTime,
            t.last_batch_id AS lastBatchId, t.last_run_status AS lastRunStatus,
            ds.source_name AS sourceName, ds.source_code AS sourceCode,
            r.id AS runId, r.run_status AS runStatus, r.batch_id AS batchId,
            r.issue_count AS issueCount, r.stats_count AS statsCount, r.error_message AS errorMessage,
            r.start_time AS startTime, r.end_time AS endTime, r.created_at AS createdAt
     FROM qc_task t
     JOIN qc_data_sources ds ON ds.id = t.source_id
     LEFT JOIN (
       SELECT r1.*
       FROM qc_task_run r1
       INNER JOIN (
         SELECT task_id, MAX(created_at) AS maxCreatedAt
         FROM qc_task_run
         GROUP BY task_id
       ) latest ON latest.task_id = r1.task_id AND latest.maxCreatedAt = r1.created_at
     ) r ON r.task_id = t.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY COALESCE(r.created_at, t.updated_at) DESC, t.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => makeResult({
    id: `quality:quality_result:${row.taskId}:${row.runId || "latest"}`,
    assetType: "quality_result",
    sourceModule: "quality",
    sourceId: row.runId ? Number(row.runId) : Number(row.taskId),
    title: `${row.taskName} 最近执行结果`,
    subtitle: `${row.tableName} / ${row.runStatus || row.lastRunStatus || "未执行"}`,
    description: row.errorMessage || `异常 ${Number(row.issueCount || 0)} 条，统计 ${Number(row.statsCount || 0)} 条`,
    status: row.runStatus || row.lastRunStatus || row.taskStatus,
    owner: row.ownerName,
    tags: [SOURCE_MODULE_LABELS.quality, ASSET_TYPE_LABELS.quality_result, row.runStatus || row.lastRunStatus],
    score: 7,
  }, [
    { field: "taskName", label: "任务名称", value: row.taskName, exactWeight: 30, weight: 14 },
    { field: "taskCode", label: "任务编码", value: row.taskCode, exactWeight: 30, weight: 14 },
    { field: "tableName", label: "监控表", value: row.tableName, exactWeight: 28, weight: 12 },
    { field: "status", label: "执行状态", value: [row.runStatus, row.lastRunStatus], weight: 8 },
    { field: "error", label: "错误信息", value: row.errorMessage, weight: 8 },
    { field: "source", label: "质量数据源", value: [row.sourceName, row.sourceCode], weight: 8 },
  ], criteria, {
    taskId: Number(row.taskId),
    runId: row.runId ? Number(row.runId) : null,
    taskName: row.taskName,
    taskCode: row.taskCode,
    tableName: row.tableName,
    sourceName: row.sourceName || "",
    sourceCode: row.sourceCode || "",
    issueCount: Number(row.issueCount || 0),
    statsCount: Number(row.statsCount || 0),
    lastRunTime: row.lastRunTime || row.startTime || null,
    errorMessage: row.errorMessage || "",
  }, [
    { label: "查看结果分析", path: "/dashboard/quality-control/analysis" },
  ]));
}

async function searchServiceDataSources(criteria) {
  if (!hasScope(criteria, "datasource")) return [];
  const params = [];
  const where = [];
  addProjectFilter(where, params, "ds");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere(["ds.source_name", "ds.source_code", "ds.source_type", "ds.owner_name"], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addNumberFilter(where, params, "ds.id", filters.dataSourceId);
  addCommonFilter(where, params, "ds.status", filters.status);
  if (filters.owner) {
    where.push("ds.owner_name LIKE ?");
    params.push(`%${filters.owner}%`);
  }

  const [rows] = await pool.query(
    `SELECT ds.id, ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType,
            ds.owner_name AS ownerName, ds.status, ds.updated_at AS updatedAt,
            COUNT(DISTINCT sa.id) AS serviceCount
     FROM service_data_sources ds
     LEFT JOIN service_apis sa ON sa.source_id = ds.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY ds.id
     ORDER BY ds.updated_at DESC, ds.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => makeResult({
    id: `services:datasource:${row.id}`,
    assetType: "datasource",
    sourceModule: "services",
    sourceId: Number(row.id),
    title: row.sourceName,
    subtitle: `${row.sourceCode} / ${row.sourceType}`,
    description: `已发布 ${Number(row.serviceCount || 0)} 个服务`,
    status: row.status,
    owner: row.ownerName,
    tags: [SOURCE_MODULE_LABELS.services, ASSET_TYPE_LABELS.datasource, row.sourceType],
    score: 7,
  }, [
    { field: "sourceName", label: "数据源名称", value: row.sourceName, exactWeight: 35, weight: 16 },
    { field: "sourceCode", label: "数据源编码", value: row.sourceCode, exactWeight: 35, weight: 16 },
    { field: "sourceType", label: "数据源类型", value: row.sourceType, weight: 8 },
  ], criteria, {
    sourceId: Number(row.id),
    sourceName: row.sourceName,
    sourceCode: row.sourceCode,
    sourceType: row.sourceType,
    serviceCount: Number(row.serviceCount || 0),
    ownerName: row.ownerName || "",
  }, [
    { label: "查看服务数据源", path: "/dashboard/service-data-sources" },
  ]));
}

async function searchServiceApis(criteria) {
  if (!hasScope(criteria, "service_api")) return [];
  const params = [];
  const where = [];
  addProjectFilter(where, params, "sa");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere([
    "sa.service_name",
    "sa.service_code",
    "sa.service_path",
    "sa.request_method",
    "sa.description",
    "sa.data_domain",
    "sa.source_table",
    "sa.source_sql",
    "sa.query_config_json",
    "sa.response_config_json",
    "ds.source_name",
    "ds.source_code",
  ], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addNumberFilter(where, params, "sa.source_id", filters.dataSourceId);
  addCommonFilter(where, params, "sa.status", filters.status);
  if (filters.owner) {
    where.push("sa.owner_name LIKE ?");
    params.push(`%${filters.owner}%`);
  }

  const [rows] = await pool.query(
    `SELECT sa.id, sa.service_name AS serviceName, sa.service_code AS serviceCode,
            sa.service_path AS servicePath, sa.request_method AS requestMethod, sa.data_domain AS dataDomain,
            sa.service_mode AS serviceMode, sa.source_id AS sourceId, sa.source_table AS sourceTable,
            sa.source_sql AS sourceSql, sa.service_type AS serviceType, sa.auth_type AS authType,
            sa.status, sa.description, sa.query_config_json AS queryConfig,
            sa.response_config_json AS responseConfig, sa.owner_name AS ownerName,
            sa.published_at AS publishedAt, sa.last_called_at AS lastCalledAt,
            sa.total_calls AS totalCalls, sa.failed_calls AS failedCalls, sa.avg_latency_ms AS avgLatencyMs,
            sa.updated_at AS updatedAt, ds.source_name AS sourceName, ds.source_code AS sourceCode,
            COUNT(DISTINCT auth.id) AS authorizationCount
     FROM service_apis sa
     LEFT JOIN service_data_sources ds ON ds.id = sa.source_id
     LEFT JOIN service_api_authorizations auth ON auth.service_id = sa.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY sa.id, ds.source_name, ds.source_code
     ORDER BY sa.updated_at DESC, sa.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => makeResult({
    id: `services:service_api:${row.id}`,
    assetType: "service_api",
    sourceModule: "services",
    sourceId: Number(row.id),
    title: row.serviceName,
    subtitle: `${row.requestMethod} ${row.servicePath}`,
    description: row.description || `${row.sourceName || "-"} / ${row.sourceTable || row.serviceMode}`,
    status: row.status,
    owner: row.ownerName,
    tags: [SOURCE_MODULE_LABELS.services, ASSET_TYPE_LABELS.service_api, row.requestMethod, row.serviceType, row.dataDomain],
    score: 11,
  }, [
    { field: "servicePath", label: "服务路径", value: row.servicePath, exactWeight: 45, weight: 24 },
    { field: "serviceCode", label: "服务编码", value: row.serviceCode, exactWeight: 38, weight: 18 },
    { field: "serviceName", label: "服务名称", value: row.serviceName, exactWeight: 35, weight: 16 },
    { field: "description", label: "服务描述", value: row.description, weight: 8 },
    { field: "source", label: "服务来源", value: [row.sourceName, row.sourceCode, row.sourceTable, truncate(row.sourceSql, 500)], weight: 9 },
    { field: "fields", label: "字段映射", value: [row.queryConfig, row.responseConfig], weight: 6 },
  ], criteria, {
    serviceId: Number(row.id),
    serviceName: row.serviceName,
    serviceCode: row.serviceCode,
    servicePath: row.servicePath,
    requestMethod: row.requestMethod,
    dataDomain: row.dataDomain,
    sourceName: row.sourceName || "",
    sourceCode: row.sourceCode || "",
    sourceTable: row.sourceTable || "",
    sourceSql: truncate(row.sourceSql, 1000),
    serviceMode: row.serviceMode,
    serviceType: row.serviceType,
    authorizationCount: Number(row.authorizationCount || 0),
    totalCalls: Number(row.totalCalls || 0),
    failedCalls: Number(row.failedCalls || 0),
    lastCalledAt: row.lastCalledAt || null,
  }, [
    { label: "编辑服务", path: `/dashboard/services/${row.id}/edit` },
    { label: "查看服务目录", path: "/dashboard/services" },
  ]));
}

async function searchServiceApps(criteria) {
  if (!hasScope(criteria, "service_app")) return [];
  const params = [];
  const where = [];
  addProjectFilter(where, params, "app");
  const filters = criteria.filters || {};
  const keywordWhere = buildKeywordWhere([
    "app.app_name",
    "app.app_code",
    "app.department_name",
    "app.contact_phone",
    "app.app_description",
    "app.owner_name",
  ], criteria.keywordTerms, params);
  if (keywordWhere) where.push(keywordWhere);
  addCommonFilter(where, params, "app.status", filters.status);
  if (filters.owner) {
    where.push("app.owner_name LIKE ?");
    params.push(`%${filters.owner}%`);
  }

  const [rows] = await pool.query(
    `SELECT app.id, app.department_name AS departmentName, app.app_name AS appName,
            app.app_code AS appCode, app.contact_phone AS contactPhone,
            app.app_description AS appDescription, app.owner_name AS ownerName,
            app.status, app.updated_at AS updatedAt,
            COUNT(DISTINCT auth.id) AS authorizationCount
     FROM service_apps app
     LEFT JOIN service_api_authorizations auth ON auth.app_id = app.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY app.id
     ORDER BY app.updated_at DESC, app.id DESC
     LIMIT ?`,
    [...params, candidateLimit(criteria)]
  );

  return rows.map((row) => makeResult({
    id: `services:service_app:${row.id}`,
    assetType: "service_app",
    sourceModule: "services",
    sourceId: Number(row.id),
    title: row.appName,
    subtitle: `${row.appCode} / ${row.departmentName || "-"}`,
    description: row.appDescription || `授权 ${Number(row.authorizationCount || 0)} 个服务`,
    status: row.status,
    owner: row.ownerName,
    tags: [SOURCE_MODULE_LABELS.services, ASSET_TYPE_LABELS.service_app, row.departmentName],
    score: 8,
  }, [
    { field: "appName", label: "应用名称", value: row.appName, exactWeight: 35, weight: 16 },
    { field: "appCode", label: "应用编码", value: row.appCode, exactWeight: 35, weight: 16 },
    { field: "department", label: "应用部门", value: row.departmentName, weight: 8 },
    { field: "description", label: "应用描述", value: row.appDescription, weight: 8 },
  ], criteria, {
    appId: Number(row.id),
    appName: row.appName,
    appCode: row.appCode,
    departmentName: row.departmentName || "",
    authorizationCount: Number(row.authorizationCount || 0),
    contactPhone: row.contactPhone || "",
  }, [
    { label: "查看应用管理", path: "/dashboard/service-apps" },
  ]));
}

async function listAiConfigs() {
  const [rows] = await pool.query(
    `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM asset_search_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     ORDER BY c.id ASC`
  );
  return rows.map(mapAiConfig);
}

async function getAiConfigById(id) {
  const [rows] = await pool.query(
    `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM asset_search_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     WHERE c.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ? mapAiConfig(rows[0]) : null;
}

async function getAiConfigByCode(sceneCode) {
  const [rows] = await pool.query(
    `SELECT id, scene_name AS sceneName, scene_code AS sceneCode,
            default_model_provider_id AS defaultModelProviderId,
            default_model_name AS defaultModelName, default_model_version AS defaultModelVersion,
            temperature, max_tokens AS maxTokens, timeout_ms AS timeoutMs,
            system_prompt AS systemPrompt, description, owner_name AS ownerName,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM asset_search_ai_configs
     WHERE scene_code = ?
     LIMIT 1`,
    [sceneCode]
  );
  return rows[0] ? mapAiConfig(rows[0]) : null;
}

async function listActiveAiConfigs() {
  const configs = await listAiConfigs();
  return configs.filter((item) => item.status === "active");
}

async function updateAiConfig(id, payload) {
  const [result] = await pool.query(
    `UPDATE asset_search_ai_configs
     SET scene_name = ?, scene_code = ?, default_model_provider_id = ?, default_model_name = ?,
         default_model_version = ?, temperature = ?, max_tokens = ?, timeout_ms = ?,
         system_prompt = ?, description = ?, owner_name = ?, status = ?
     WHERE id = ?`,
    [
      payload.sceneName,
      payload.sceneCode,
      payload.defaultModelProviderId || null,
      payload.defaultModelName || null,
      payload.defaultModelVersion || null,
      payload.temperature ?? null,
      payload.maxTokens ?? null,
      payload.timeoutMs ?? null,
      payload.systemPrompt || null,
      payload.description || null,
      payload.ownerName || "System Administrator",
      payload.status,
      id,
    ]
  );
  return Number(result.affectedRows || 0) > 0 ? getAiConfigById(id) : null;
}

async function saveFeedback(payload, user) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO asset_search_feedback
      (project_id, keyword, ai_enabled, mode, result_id, feedback, comment, submitted_by, submitted_user_id, result_snapshot_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.keyword || null,
      payload.aiEnabled ? 1 : 0,
      payload.mode || null,
      payload.resultId,
      payload.feedback,
      payload.comment || null,
      user?.username || "system",
      user?.sub || user?.id || null,
      json(payload.resultSnapshot || null, null),
    ]
  );
  return { id: Number(result.insertId) };
}

function mapAiRun(row) {
  return {
    ...row,
    id: Number(row.id),
    sourceModules: parseJson(row.sourceModules, []),
    scopes: parseJson(row.scopes, []),
    expandedKeywords: parseJson(row.expandedKeywords, []),
    configuredStages: parseJson(row.configuredStages, []),
    usedStages: parseJson(row.usedStages, []),
    candidateCount: Number(row.candidateCount || 0),
    resultCount: Number(row.resultCount || 0),
    durationMs: Number(row.durationMs || 0),
    submittedUserId: row.submittedUserId ? Number(row.submittedUserId) : null,
  };
}

async function saveAiRun(payload, user) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO asset_search_ai_runs
      (project_id, keyword, mode, status, fallback_reason, source_modules_json, scopes_json,
       expanded_keywords_json, configured_stages_json, used_stages_json, candidate_count,
       result_count, duration_ms, error_message, submitted_by, submitted_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.keyword || null,
      payload.mode || "ai",
      payload.status || "success",
      payload.fallbackReason || null,
      json(payload.sourceModules || [], []),
      json(payload.scopes || [], []),
      json(payload.expandedKeywords || [], []),
      json(payload.configuredStages || [], []),
      json(payload.usedStages || [], []),
      Number(payload.candidateCount || 0),
      Number(payload.resultCount || 0),
      Number(payload.durationMs || 0),
      payload.errorMessage ? String(payload.errorMessage).slice(0, 512) : null,
      user?.username || "system",
      user?.sub || user?.id || null,
    ]
  );
  return { id: Number(result.insertId) };
}

async function listAiRuns(options = {}) {
  const limit = clampLimit(options.limit || 20, 20);
  const where = [];
  const params = [];
  addProjectFilter(where, params, "");

  if (options.submittedUserId) {
    where.push("submitted_user_id = ?");
    params.push(Number(options.submittedUserId));
  }

  if (options.status) {
    where.push("status = ?");
    params.push(options.status);
  }

  const [rows] = await pool.query(
    `SELECT id, keyword, mode, status, fallback_reason AS fallbackReason,
            source_modules_json AS sourceModules, scopes_json AS scopes,
            expanded_keywords_json AS expandedKeywords,
            configured_stages_json AS configuredStages, used_stages_json AS usedStages,
            candidate_count AS candidateCount, result_count AS resultCount,
            duration_ms AS durationMs, error_message AS errorMessage,
            submitted_by AS submittedBy, submitted_user_id AS submittedUserId,
            created_at AS createdAt
     FROM asset_search_ai_runs
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY id DESC
     LIMIT ?`,
    [...params, limit]
  );

  return rows.map(mapAiRun);
}

async function loadFacetOptions() {
  const projectId = getCurrentProjectId();
  const projectWhere = projectId ? "WHERE project_id = ?" : "";
  const projectParams = projectId ? [projectId] : [];
  const [[departments], [systems], [dataMapSources], [ingestionSources], [qualitySources], [serviceSources]] = await Promise.all([
    pool.query(`SELECT id, department_name AS label, department_code AS code FROM dm_departments ${projectWhere} ORDER BY department_name ASC`, projectParams),
    pool.query(`SELECT id, system_name AS label, system_code AS code, department_id AS departmentId FROM dm_business_systems ${projectWhere} ORDER BY system_name ASC`, projectParams),
    pool.query(`SELECT id, source_name AS label, source_code AS code, 'data_map' AS sourceModule FROM dm_data_sources ${projectWhere} ORDER BY source_name ASC`, projectParams),
    pool.query(`SELECT id, source_name AS label, source_code AS code, 'ingestion' AS sourceModule FROM ingestion_data_sources ${projectWhere} ORDER BY source_name ASC`, projectParams),
    pool.query(`SELECT id, source_name AS label, source_code AS code, 'quality' AS sourceModule FROM qc_data_sources ${projectWhere} ORDER BY source_name ASC`, projectParams),
    pool.query(`SELECT id, source_name AS label, source_code AS code, 'services' AS sourceModule FROM service_data_sources ${projectWhere} ORDER BY source_name ASC`, projectParams),
  ]);
  return {
    sourceModules: SOURCE_MODULES.map((value) => ({ value, label: SOURCE_MODULE_LABELS[value] })),
    assetTypes: ASSET_TYPES.map((value) => ({ value, label: ASSET_TYPE_LABELS[value] })),
    departments,
    businessSystems: systems.map((item) => ({ ...item, departmentId: Number(item.departmentId || 0) })),
    dataSources: [...dataMapSources, ...ingestionSources, ...qualitySources, ...serviceSources].map((item) => ({
      ...item,
      id: Number(item.id),
      label: item.label,
      code: item.code,
      sourceModule: item.sourceModule,
    })),
    statuses: ["active", "inactive", "draft", "published", "offline", "submitted", "succeeded", "failed"].map((value) => ({ value, label: value })),
  };
}

module.exports = {
  ASSET_TYPE_LABELS,
  ASSET_TYPES,
  SOURCE_MODULE_LABELS,
  SOURCE_MODULES,
  clampLimit,
  getAiConfigByCode,
  getAiConfigById,
  findBusinessDataSearchTargets,
  loadFacetOptions,
  listAiRuns,
  listActiveAiConfigs,
  listAiConfigs,
  normalizeKeywordTerms,
  normalizePriorityTerms,
  saveAiRun,
  saveFeedback,
  searchDataMapDataSources,
  searchDataMapFields,
  searchDataMapTables,
  searchIngestionDataSources,
  searchIngestionResearchFields,
  searchIngestionResearchTables,
  searchIngestionTasks,
  searchQualityDataSources,
  searchQualityMonitorTables,
  searchQualityResults,
  searchQualityRules,
  searchQualityStrategies,
  searchServiceApis,
  searchServiceApps,
  searchServiceDataSources,
  updateAiConfig,
};
