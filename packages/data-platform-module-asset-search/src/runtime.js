var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// backend/src/common/utils/response.js
var require_response = __commonJS({
  "backend/src/common/utils/response.js"(exports2, module2) {
    function sendSuccess(res, data, meta, statusCode = 200) {
      return res.status(statusCode).json({ success: true, data, meta });
    }
    module2.exports = {
      sendSuccess
    };
  }
});

// backend/src/common/errors/app-error.js
var require_app_error = __commonJS({
  "backend/src/common/errors/app-error.js"(exports2, module2) {
    var AppError = class extends Error {
      constructor(message, statusCode, details) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.details = details;
      }
    };
    module2.exports = AppError;
  }
});

// runtime-port:database
var require_database = __commonJS({
  "runtime-port:database"(exports2, module2) {
    var { createDatabasePoolProxy } = require("@johnason/data-platform-core-kernel");
    var pool = createDatabasePoolProxy();
    module2.exports = { pool, testConnection: async () => {
      const c = await pool.getConnection();
      c.release();
    } };
  }
});

// runtime-port:project-context
var require_project_context = __commonJS({
  "runtime-port:project-context"(exports2, module2) {
    var k = require("@johnason/data-platform-core-kernel");
    module2.exports = { runWithProjectContext: (_context, callback) => callback(), getProjectContext: k.getProjectContext, getCurrentProjectId: k.getCurrentProjectId, getProjectCondition: k.getProjectCondition, addProjectCondition: k.addProjectCondition };
  }
});

// backend/src/modules/asset-search/asset-search.repository.js
var require_asset_search_repository = __commonJS({
  "backend/src/modules/asset-search/asset-search.repository.js"(exports2, module2) {
    var { pool } = require_database();
    var { getCurrentProjectId } = require_project_context();
    var ASSET_TYPES = [
      "table",
      "field",
      "datasource",
      "ingestion_task",
      "quality_rule",
      "quality_strategy",
      "quality_result",
      "service_api",
      "service_app"
    ];
    var SOURCE_MODULES = ["data_map", "ingestion", "quality", "services"];
    var SOURCE_MODULE_LABELS = {
      data_map: "\u6570\u636E\u5730\u56FE",
      ingestion: "\u6570\u636E\u63A5\u5165",
      quality: "\u8D28\u91CF\u7BA1\u63A7",
      services: "\u6570\u636E\u670D\u52A1"
    };
    var ASSET_TYPE_LABELS = {
      table: "\u8868\u8D44\u6E90",
      field: "\u5B57\u6BB5",
      datasource: "\u6570\u636E\u6E90",
      ingestion_task: "\u63A5\u5165\u4EFB\u52A1",
      quality_rule: "\u8D28\u91CF\u89C4\u5219",
      quality_strategy: "\u8D28\u91CF\u7B56\u7565",
      quality_result: "\u8D28\u91CF\u7ED3\u679C",
      service_api: "\u670D\u52A1API",
      service_app: "\u670D\u52A1\u5E94\u7528"
    };
    function parseJson(value, fallback) {
      if (value === null || value === void 0 || value === "") return fallback;
      if (typeof value === "object") return value;
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    function json(value, fallback = null) {
      try {
        return JSON.stringify(value === void 0 ? fallback : value);
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
        temperature: row.temperature === null || row.temperature === void 0 ? null : Number(row.temperature),
        maxTokens: row.maxTokens === null || row.maxTokens === void 0 ? null : Number(row.maxTokens),
        timeoutMs: row.timeoutMs === null || row.timeoutMs === void 0 ? null : Number(row.timeoutMs)
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
      const seen = /* @__PURE__ */ new Set();
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
      const compact = text.replace(splitPattern, "").trim();
      return uniqueStrings([text, ...chunks, ...latinTokens, compact]).filter((item) => item.length >= 2).slice(0, 10);
    }
    function normalizePriorityTerms(keyword) {
      const text = String(keyword || "").trim();
      if (!text || !text.includes("\u5B57\u6BB5")) return [];
      const prefix = text.slice(0, text.indexOf("\u5B57\u6BB5"));
      const chunks = prefix.split(/[\s,，。；;、?？!！:：()（）[\]【】"'“”‘’]+|在哪些|在哪个|哪些|哪个|哪里|是否|有没有|查找|查询|检索|搜索|里面|里|中|的|和|及|以及|相关/g).map((item) => item.trim()).filter((item) => item.length >= 2);
      return chunks.length ? [chunks[chunks.length - 1]] : [];
    }
    function clampLimit(value, fallback = 100) {
      const limit = Number(value || fallback);
      if (!Number.isFinite(limit)) return fallback;
      return Math.min(Math.max(Math.trunc(limit), 1), 500);
    }
    function candidateLimit(criteria) {
      const limit = clampLimit(criteria.limit);
      return Array.isArray(criteria.keywordTerms) && criteria.keywordTerms.length > 0 ? Math.min(limit * 5, 500) : limit;
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
      if (value === void 0 || value === null || String(value).trim() === "") return;
      where.push(`${column} = ?`);
      params.push(value);
    }
    function addNumberFilter(where, params, column, value) {
      if (value === void 0 || value === null || String(value).trim() === "") return;
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
      const bestMatches = /* @__PURE__ */ new Map();
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
              const priorityBoost = field.priority && (criteria.priorityTerms || []).includes(normalizedTerm) ? field.priorityBoost || 36 : 0;
              const hitScore = (field.exactWeight || 18) + priorityBoost;
              const existing = bestMatches.get(hitKey);
              if (!existing || hitScore > existing.score) {
                bestMatches.set(hitKey, {
                  field: field.field,
                  score: hitScore,
                  text: `${field.label}\u7CBE\u786E\u547D\u4E2D ${normalizedTerm}\uFF1A${truncate(raw)}`
                });
              }
              continue;
            }
            if (lower.includes(termLower)) {
              const priorityBoost = field.priority && (criteria.priorityTerms || []).includes(normalizedTerm) ? field.priorityBoost || 36 : 0;
              const hitScore = (field.weight || 8) + priorityBoost;
              const existing = bestMatches.get(hitKey);
              if (!existing || hitScore > existing.score) {
                bestMatches.set(hitKey, {
                  field: field.field,
                  score: hitScore,
                  text: `${field.label}\u547D\u4E2D ${normalizedTerm}\uFF1A${truncate(raw)}`
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
        highlights: matches.slice(0, 6).map((item) => ({ field: item.field, text: item.text }))
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
        actions
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
        rowCount: row.rowCount === null || row.rowCount === void 0 ? null : Number(row.rowCount),
        columnCount: Number(row.columnCount || 0),
        updatedAt: row.updatedAt
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
        "rp.ai_summary"
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
          score: 10
        }, [
          { field: "resourceCode", label: "\u8D44\u6E90\u7F16\u7801", value: row.resourceCode, exactWeight: 35, weight: 16 },
          { field: "title", label: "\u8868\u540D", value: row.tableName, exactWeight: 35, weight: 16 },
          { field: "description", label: "\u8868\u63CF\u8FF0", value: [row.tableComment, row.businessName, row.businessDefinition], weight: 9 },
          { field: "source", label: "\u6765\u6E90\u4FE1\u606F", value: [row.departmentName, row.systemName, row.sourceName, row.catalogName], weight: 7 },
          { field: "tags", label: "\u4E1A\u52A1\u6807\u7B7E", value: parseJson(row.businessTags, []), weight: 6 },
          { field: "profile", label: "\u753B\u50CF\u603B\u7ED3", value: row.aiSummary, weight: 5 }
        ], criteria, context, [
          { label: "\u67E5\u770B\u8D44\u6E90\u8BE6\u60C5", path: `/dashboard/data-map/resources/${row.id}` }
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
        "ds.source_name"
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
          ...parseJson(row.profileSemanticTags, [])
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
          aiSummary: row.aiSummary || ""
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
          score: 18
        }, [
          { field: "fieldName", label: "\u5B57\u6BB5\u540D", value: row.columnName, exactWeight: 45, weight: 24, priority: true, priorityBoost: 42 },
          { field: "fieldComment", label: "\u5B57\u6BB5\u6CE8\u91CA", value: row.columnComment, exactWeight: 38, weight: 22, priority: true, priorityBoost: 42 },
          { field: "fieldBusinessName", label: "\u5B57\u6BB5\u4E1A\u52A1\u540D", value: [row.fieldBusinessName, row.aiBusinessName, row.aiBusinessMeaning], weight: 16, priority: true, priorityBoost: 32 },
          { field: "sampleValues", label: "\u6837\u4F8B\u503C", value: sampleValues, weight: 8 },
          { field: "fieldTags", label: "\u5B57\u6BB5\u6807\u7B7E", value: [...semanticTags, ...featureTags], weight: 10 },
          { field: "table", label: "\u6240\u5C5E\u8868", value: [row.tableName, row.resourceCode, row.tableComment, row.businessName], weight: 9 },
          { field: "source", label: "\u6765\u6E90\u4FE1\u606F", value: [row.departmentName, row.systemName, row.sourceName, row.catalogName], weight: 6 }
        ], criteria, context, [
          { label: "\u67E5\u770B\u5B57\u6BB5\u6240\u5728\u8D44\u6E90", path: `/dashboard/data-map/resources/${row.resourceId}?tab=fields&field=${encodeURIComponent(row.columnName)}` }
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
        "bs.system_code"
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
        score: 8
      }, [
        { field: "sourceName", label: "\u6570\u636E\u6E90\u540D\u79F0", value: row.sourceName, exactWeight: 35, weight: 16 },
        { field: "sourceCode", label: "\u6570\u636E\u6E90\u7F16\u7801", value: row.sourceCode, exactWeight: 35, weight: 16 },
        { field: "sourceType", label: "\u6570\u636E\u6E90\u7C7B\u578B", value: row.sourceType, weight: 8 },
        { field: "source", label: "\u6765\u6E90\u4FE1\u606F", value: [row.departmentName, row.systemName, row.purpose], weight: 7 }
      ], criteria, {
        sourceId: Number(row.id),
        sourceName: row.sourceName,
        sourceCode: row.sourceCode,
        sourceType: row.sourceType,
        departmentName: row.departmentName || "",
        businessSystemName: row.systemName || "",
        resourceCount: Number(row.resourceCount || 0),
        ownerName: row.ownerName || ""
      }, [
        { label: "\u67E5\u770B\u6570\u636E\u5730\u56FE\u6570\u636E\u6E90", path: "/dashboard/data-map/sources" }
      ]));
    }
    async function findBusinessDataSearchTargets(elementIds = [], filters = {}) {
      const normalizedElementIds = [...new Set((Array.isArray(elementIds) ? elementIds : []).map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0))];
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
          status: row.sourceStatus || ""
        },
        fieldId: Number(row.fieldId),
        columnName: row.columnName,
        columnComment: row.columnComment || "",
        dataType: row.dataType || "",
        columnType: row.columnType || "",
        mappingStatus: row.mappingStatus || "",
        confidence: row.confidence === null || row.confidence === void 0 ? null : Number(row.confidence)
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
        description: `\u5DF2\u5173\u8054 ${Number(row.taskCount || 0)} \u4E2A\u63A5\u5165\u4EFB\u52A1`,
        status: row.status,
        owner: row.ownerName,
        tags: [SOURCE_MODULE_LABELS.ingestion, ASSET_TYPE_LABELS.datasource, row.sourceType],
        score: 7
      }, [
        { field: "sourceName", label: "\u6570\u636E\u6E90\u540D\u79F0", value: row.sourceName, exactWeight: 35, weight: 16 },
        { field: "sourceCode", label: "\u6570\u636E\u6E90\u7F16\u7801", value: row.sourceCode, exactWeight: 35, weight: 16 },
        { field: "sourceType", label: "\u6570\u636E\u6E90\u7C7B\u578B", value: row.sourceType, weight: 8 }
      ], criteria, {
        sourceId: Number(row.id),
        sourceName: row.sourceName,
        sourceCode: row.sourceCode,
        sourceType: row.sourceType,
        taskCount: Number(row.taskCount || 0),
        ownerName: row.ownerName || ""
      }, [
        { label: "\u67E5\u770B\u63A5\u5165\u6570\u636E\u6E90", path: "/dashboard/data-sources" }
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
        "ts.source_code"
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
        description: row.description || `${row.sourceName || "-"} \u5230 ${row.targetSourceName || row.targetType || "-"}`,
        status: row.status,
        owner: row.ownerName,
        tags: [SOURCE_MODULE_LABELS.ingestion, ASSET_TYPE_LABELS.ingestion_task, row.syncMode, row.scheduleEnabled ? "\u5DF2\u8C03\u5EA6" : "\u624B\u52A8"],
        score: 9
      }, [
        { field: "taskName", label: "\u4EFB\u52A1\u540D\u79F0", value: row.taskName, exactWeight: 35, weight: 16 },
        { field: "taskCode", label: "\u4EFB\u52A1\u7F16\u7801", value: row.taskCode, exactWeight: 35, weight: 16 },
        { field: "sourceTable", label: "\u6765\u6E90\u8868", value: row.sourceTable, exactWeight: 30, weight: 14 },
        { field: "targetTable", label: "\u76EE\u6807\u8868", value: row.targetTable, exactWeight: 30, weight: 14 },
        { field: "source", label: "\u6570\u636E\u6E90", value: [row.sourceName, row.sourceCode, row.targetSourceName, row.targetSourceCode], weight: 8 },
        { field: "description", label: "\u4EFB\u52A1\u63CF\u8FF0", value: row.description, weight: 6 }
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
        lastRunStatus: row.lastRunStatus || ""
      }, [
        { label: "\u7F16\u8F91\u63A5\u5165\u4EFB\u52A1", path: `/dashboard/data-ingestion-jobs/${row.id}/edit` },
        { label: "\u67E5\u770B\u4EFB\u52A1\u5217\u8868", path: "/dashboard/data-ingestion-jobs" }
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
        "r.summary_text"
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
          rowCount: row.rowCount === null || row.rowCount === void 0 ? null : Number(row.rowCount),
          columnCount: Number(row.columnCount || 0),
          sampleCount: Number(row.sampleCount || 0),
          category: row.category || "",
          priority: row.priority || "",
          confidence: row.confidence === null || row.confidence === void 0 ? null : Number(row.confidence),
          suggestedMode: row.suggestedMode || "",
          incrementalColumn: row.incrementalColumn || "",
          metadataIssues,
          evidence,
          risks,
          quality: parseJson(row.quality, {}),
          fieldSummary: parseJson(row.fieldSummary, {}),
          summaryText: row.summaryText || "",
          finishedAt: row.finishedAt || null
        };
        return makeResult({
          id: `ingestion:research_table:${row.sourceId}:${row.tableName}`,
          assetType: "table",
          sourceModule: "ingestion",
          sourceId: `${row.runId}:${row.tableName}`,
          title: row.tableName,
          subtitle: `${row.sourceName || "-"} / \u6570\u636E\u8C03\u7814 / ${row.category || "-"}`,
          description: row.tableComment || row.summaryText || evidence.join("\uFF1B"),
          status: row.status,
          owner: row.createdBy,
          tags: [SOURCE_MODULE_LABELS.ingestion, "\u6570\u636E\u8C03\u7814", row.category, row.priority, row.suggestedMode],
          score: 8
        }, [
          { field: "tableName", label: "\u8C03\u7814\u8868", value: row.tableName, exactWeight: 32, weight: 15 },
          { field: "tableComment", label: "\u8868\u6CE8\u91CA", value: row.tableComment, weight: 10 },
          { field: "classification", label: "\u5206\u7C7B\u5EFA\u8BAE", value: [row.category, row.priority, row.suggestedMode, row.incrementalColumn], weight: 9 },
          { field: "source", label: "\u6765\u6E90\u6570\u636E\u6E90", value: [row.sourceName, row.sourceType, row.databaseName, row.schemaName], weight: 8 },
          { field: "summary", label: "AI \u8C03\u7814\u7ED3\u8BBA", value: [row.summaryText, evidence, risks, metadataIssues], weight: 7 },
          { field: "fields", label: "\u5B57\u6BB5\u753B\u50CF", value: row.fieldSummary, weight: 5 }
        ], criteria, context, [
          { label: "\u67E5\u770B\u6570\u636E\u6E90\u8C03\u7814", path: "/dashboard/data-sources" }
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
        "r.summary_text"
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
          organizationCatalog: "\u6570\u636E\u63A5\u5165\u8C03\u7814",
          sampleValues,
          semanticTags: [row.category, row.priority].filter(Boolean),
          featureTags: issueTags,
          nullRate: row.nullRate === null || row.nullRate === void 0 ? null : Number(row.nullRate),
          distinctRatio: row.distinctRatio === null || row.distinctRatio === void 0 ? null : Number(row.distinctRatio),
          isNullable: Boolean(row.isNullable),
          isPrimaryKey: Boolean(row.isPrimaryKey),
          suggestedMode: row.suggestedMode || "",
          evidence: readJsonArray(row.evidence),
          risks: readJsonArray(row.risks),
          aiSummary: row.summaryText || "",
          finishedAt: row.finishedAt || null
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
          tags: [SOURCE_MODULE_LABELS.ingestion, "\u6570\u636E\u8C03\u7814\u5B57\u6BB5", row.dataType, row.category, ...issueTags],
          score: 12
        }, [
          { field: "fieldName", label: "\u5B57\u6BB5\u540D", value: row.columnName, exactWeight: 42, weight: 22, priority: true, priorityBoost: 36 },
          { field: "fieldComment", label: "\u5B57\u6BB5\u6CE8\u91CA", value: row.columnComment, exactWeight: 36, weight: 20, priority: true, priorityBoost: 36 },
          { field: "fieldType", label: "\u5B57\u6BB5\u7C7B\u578B", value: [row.dataType, row.columnType], weight: 8 },
          { field: "sampleValues", label: "\u6837\u4F8B\u503C", value: sampleValues, weight: 8 },
          { field: "fieldTags", label: "\u5B57\u6BB5\u753B\u50CF", value: issueTags, weight: 8 },
          { field: "table", label: "\u6240\u5C5E\u8868", value: [row.tableName, row.tableComment, row.category], weight: 9 },
          { field: "source", label: "\u6765\u6E90\u6570\u636E\u6E90", value: [row.sourceName, row.sourceType, row.databaseName, row.schemaName], weight: 7 }
        ], criteria, context, [
          { label: "\u67E5\u770B\u6570\u636E\u6E90\u8C03\u7814", path: "/dashboard/data-sources" }
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
        description: `\u5DF2\u76D1\u63A7 ${Number(row.monitorTableCount || 0)} \u5F20\u8868`,
        status: row.status,
        owner: row.ownerName,
        tags: [SOURCE_MODULE_LABELS.quality, ASSET_TYPE_LABELS.datasource, row.sourceType],
        score: 7
      }, [
        { field: "sourceName", label: "\u6570\u636E\u6E90\u540D\u79F0", value: row.sourceName, exactWeight: 35, weight: 16 },
        { field: "sourceCode", label: "\u6570\u636E\u6E90\u7F16\u7801", value: row.sourceCode, exactWeight: 35, weight: 16 },
        { field: "sourceType", label: "\u6570\u636E\u6E90\u7C7B\u578B", value: row.sourceType, weight: 8 }
      ], criteria, {
        sourceId: Number(row.id),
        sourceName: row.sourceName,
        sourceCode: row.sourceCode,
        sourceType: row.sourceType,
        monitorTableCount: Number(row.monitorTableCount || 0),
        ownerName: row.ownerName || ""
      }, [
        { label: "\u67E5\u770B\u8D28\u91CF\u6570\u636E\u6E90", path: "/dashboard/quality-control/data-sources" }
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
        "ds.source_code"
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
        tags: [SOURCE_MODULE_LABELS.quality, "\u76D1\u63A7\u8868", row.sourceType],
        score: 8
      }, [
        { field: "tableName", label: "\u76D1\u63A7\u8868", value: [row.tableName, row.fullTableName], exactWeight: 32, weight: 15 },
        { field: "tableComment", label: "\u8868\u63CF\u8FF0", value: row.tableComment, weight: 9 },
        { field: "source", label: "\u8D28\u91CF\u6570\u636E\u6E90", value: [row.sourceName, row.sourceCode], weight: 8 },
        { field: "columns", label: "\u5B57\u6BB5\u8303\u56F4", value: row.columnSnapshot, weight: 5 }
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
        lastSyncAt: row.lastSyncAt || null
      }, [
        { label: "\u67E5\u770B\u8D28\u91CF\u7B56\u7565", path: `/dashboard/quality-control/strategies/${row.id}` }
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
        "r.severity"
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
        score: 10
      }, [
        { field: "ruleName", label: "\u89C4\u5219\u540D\u79F0", value: row.ruleName, exactWeight: 35, weight: 16 },
        { field: "ruleCode", label: "\u89C4\u5219\u7F16\u7801", value: row.ruleCode, exactWeight: 35, weight: 16 },
        { field: "ruleType", label: "\u89C4\u5219\u7C7B\u578B", value: row.ruleScene, weight: 9 },
        { field: "regex", label: "\u89C4\u5219\u8868\u8FBE\u5F0F", value: row.regexPattern, weight: 8 },
        { field: "examples", label: "\u6837\u4F8B", value: [row.matchExamples, row.mismatchExamples], weight: 5 }
      ], criteria, {
        ruleId: Number(row.id),
        ruleName: row.ruleName,
        ruleCode: row.ruleCode,
        ruleType: row.ruleScene,
        regexPattern: row.regexPattern,
        severity: row.severity,
        matchExamples: parseJson(row.matchExamples, []),
        mismatchExamples: parseJson(row.mismatchExamples, [])
      }, [
        { label: "\u67E5\u770B\u89C4\u5219\u7BA1\u7406", path: "/dashboard/quality-control/rules" }
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
        "sv.ai_summary_text"
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
        title: `${row.tableName} \u8D28\u91CF\u7B56\u7565`,
        subtitle: `${row.sourceName || "-"} / v${row.currentVersionNo || "-"}`,
        description: row.currentSummary || row.aiSummaryText || row.tableComment || "",
        status: row.strategyStatus,
        owner: row.submittedBy,
        tags: [SOURCE_MODULE_LABELS.quality, ASSET_TYPE_LABELS.quality_strategy, row.strategyStatus],
        score: 9
      }, [
        { field: "strategyName", label: "\u7B56\u7565\u8868", value: row.tableName, exactWeight: 32, weight: 15 },
        { field: "summary", label: "\u7B56\u7565\u6458\u8981", value: [row.currentSummary, row.aiSummaryText], weight: 10 },
        { field: "source", label: "\u7ED1\u5B9A\u6570\u636E\u6E90", value: [row.sourceName, row.sourceCode], weight: 8 },
        { field: "rules", label: "\u89C4\u5219\u6E05\u5355", value: [row.fieldStrategies, row.advancedRules], weight: 6 }
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
        lastSubmittedAt: row.lastSubmittedAt || null
      }, [
        { label: "\u67E5\u770B\u7B56\u7565\u8BE6\u60C5", path: `/dashboard/quality-control/strategies/${row.monitorTableId}` }
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
        "ds.source_code"
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
        title: `${row.taskName} \u6700\u8FD1\u6267\u884C\u7ED3\u679C`,
        subtitle: `${row.tableName} / ${row.runStatus || row.lastRunStatus || "\u672A\u6267\u884C"}`,
        description: row.errorMessage || `\u5F02\u5E38 ${Number(row.issueCount || 0)} \u6761\uFF0C\u7EDF\u8BA1 ${Number(row.statsCount || 0)} \u6761`,
        status: row.runStatus || row.lastRunStatus || row.taskStatus,
        owner: row.ownerName,
        tags: [SOURCE_MODULE_LABELS.quality, ASSET_TYPE_LABELS.quality_result, row.runStatus || row.lastRunStatus],
        score: 7
      }, [
        { field: "taskName", label: "\u4EFB\u52A1\u540D\u79F0", value: row.taskName, exactWeight: 30, weight: 14 },
        { field: "taskCode", label: "\u4EFB\u52A1\u7F16\u7801", value: row.taskCode, exactWeight: 30, weight: 14 },
        { field: "tableName", label: "\u76D1\u63A7\u8868", value: row.tableName, exactWeight: 28, weight: 12 },
        { field: "status", label: "\u6267\u884C\u72B6\u6001", value: [row.runStatus, row.lastRunStatus], weight: 8 },
        { field: "error", label: "\u9519\u8BEF\u4FE1\u606F", value: row.errorMessage, weight: 8 },
        { field: "source", label: "\u8D28\u91CF\u6570\u636E\u6E90", value: [row.sourceName, row.sourceCode], weight: 8 }
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
        errorMessage: row.errorMessage || ""
      }, [
        { label: "\u67E5\u770B\u7ED3\u679C\u5206\u6790", path: "/dashboard/quality-control/analysis" }
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
        description: `\u5DF2\u53D1\u5E03 ${Number(row.serviceCount || 0)} \u4E2A\u670D\u52A1`,
        status: row.status,
        owner: row.ownerName,
        tags: [SOURCE_MODULE_LABELS.services, ASSET_TYPE_LABELS.datasource, row.sourceType],
        score: 7
      }, [
        { field: "sourceName", label: "\u6570\u636E\u6E90\u540D\u79F0", value: row.sourceName, exactWeight: 35, weight: 16 },
        { field: "sourceCode", label: "\u6570\u636E\u6E90\u7F16\u7801", value: row.sourceCode, exactWeight: 35, weight: 16 },
        { field: "sourceType", label: "\u6570\u636E\u6E90\u7C7B\u578B", value: row.sourceType, weight: 8 }
      ], criteria, {
        sourceId: Number(row.id),
        sourceName: row.sourceName,
        sourceCode: row.sourceCode,
        sourceType: row.sourceType,
        serviceCount: Number(row.serviceCount || 0),
        ownerName: row.ownerName || ""
      }, [
        { label: "\u67E5\u770B\u670D\u52A1\u6570\u636E\u6E90", path: "/dashboard/service-data-sources" }
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
        "ds.source_code"
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
        score: 11
      }, [
        { field: "servicePath", label: "\u670D\u52A1\u8DEF\u5F84", value: row.servicePath, exactWeight: 45, weight: 24 },
        { field: "serviceCode", label: "\u670D\u52A1\u7F16\u7801", value: row.serviceCode, exactWeight: 38, weight: 18 },
        { field: "serviceName", label: "\u670D\u52A1\u540D\u79F0", value: row.serviceName, exactWeight: 35, weight: 16 },
        { field: "description", label: "\u670D\u52A1\u63CF\u8FF0", value: row.description, weight: 8 },
        { field: "source", label: "\u670D\u52A1\u6765\u6E90", value: [row.sourceName, row.sourceCode, row.sourceTable, truncate(row.sourceSql, 500)], weight: 9 },
        { field: "fields", label: "\u5B57\u6BB5\u6620\u5C04", value: [row.queryConfig, row.responseConfig], weight: 6 }
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
        sourceSql: truncate(row.sourceSql, 1e3),
        serviceMode: row.serviceMode,
        serviceType: row.serviceType,
        authorizationCount: Number(row.authorizationCount || 0),
        totalCalls: Number(row.totalCalls || 0),
        failedCalls: Number(row.failedCalls || 0),
        lastCalledAt: row.lastCalledAt || null
      }, [
        { label: "\u7F16\u8F91\u670D\u52A1", path: `/dashboard/services/${row.id}/edit` },
        { label: "\u67E5\u770B\u670D\u52A1\u76EE\u5F55", path: "/dashboard/services" }
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
        "app.owner_name"
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
        description: row.appDescription || `\u6388\u6743 ${Number(row.authorizationCount || 0)} \u4E2A\u670D\u52A1`,
        status: row.status,
        owner: row.ownerName,
        tags: [SOURCE_MODULE_LABELS.services, ASSET_TYPE_LABELS.service_app, row.departmentName],
        score: 8
      }, [
        { field: "appName", label: "\u5E94\u7528\u540D\u79F0", value: row.appName, exactWeight: 35, weight: 16 },
        { field: "appCode", label: "\u5E94\u7528\u7F16\u7801", value: row.appCode, exactWeight: 35, weight: 16 },
        { field: "department", label: "\u5E94\u7528\u90E8\u95E8", value: row.departmentName, weight: 8 },
        { field: "description", label: "\u5E94\u7528\u63CF\u8FF0", value: row.appDescription, weight: 8 }
      ], criteria, {
        appId: Number(row.id),
        appName: row.appName,
        appCode: row.appCode,
        departmentName: row.departmentName || "",
        authorizationCount: Number(row.authorizationCount || 0),
        contactPhone: row.contactPhone || ""
      }, [
        { label: "\u67E5\u770B\u5E94\u7528\u7BA1\u7406", path: "/dashboard/service-apps" }
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
          id
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
          json(payload.resultSnapshot || null, null)
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
        submittedUserId: row.submittedUserId ? Number(row.submittedUserId) : null
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
          user?.sub || user?.id || null
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
        pool.query(`SELECT id, source_name AS label, source_code AS code, 'services' AS sourceModule FROM service_data_sources ${projectWhere} ORDER BY source_name ASC`, projectParams)
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
          sourceModule: item.sourceModule
        })),
        statuses: ["active", "inactive", "draft", "published", "offline", "submitted", "succeeded", "failed"].map((value) => ({ value, label: value }))
      };
    }
    module2.exports = {
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
      updateAiConfig
    };
  }
});

// backend/src/modules/model-providers/model-provider.repository.js
var require_model_provider_repository = __commonJS({
  "backend/src/modules/model-providers/model-provider.repository.js"(exports2, module2) {
    var { pool } = require_database();
    function mapRow(row) {
      let extraConfig = row.extraConfig;
      if (typeof extraConfig === "string") {
        try {
          extraConfig = JSON.parse(extraConfig);
        } catch (error) {
          extraConfig = {};
        }
      }
      return {
        ...row,
        modelVersion: row.modelVersion || null,
        extraConfig: extraConfig || {}
      };
    }
    async function getModelProviderById(id) {
      const [rows] = await pool.query(
        `SELECT id, config_name AS configName, config_code AS configCode, provider_type AS providerType,
            model_category AS modelCategory, model_name AS modelName, base_url AS baseUrl,
            model_version AS modelVersion, api_key AS apiKey, organization_id AS organizationId, owner_name AS ownerName,
            status, description, extra_config AS extraConfig, created_at AS createdAt, updated_at AS updatedAt
     FROM model_providers
     WHERE id = ?`,
        [id]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    }
    async function listModelProviders() {
      const [rows] = await pool.query(
        `SELECT id, config_name AS configName, config_code AS configCode, provider_type AS providerType,
            model_category AS modelCategory, model_name AS modelName, base_url AS baseUrl,
            model_version AS modelVersion, api_key AS apiKey, organization_id AS organizationId, owner_name AS ownerName,
            status, description, extra_config AS extraConfig, created_at AS createdAt, updated_at AS updatedAt
     FROM model_providers
     ORDER BY id DESC`
      );
      return rows.map(mapRow);
    }
    async function createModelProvider(payload) {
      const [result] = await pool.query(
        `INSERT INTO model_providers
      (config_name, config_code, provider_type, model_category, model_name, model_version, base_url, api_key,
       organization_id, owner_name, status, description, extra_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.configName,
          payload.configCode,
          payload.providerType,
          payload.modelCategory,
          payload.modelName,
          payload.modelVersion || null,
          payload.baseUrl || null,
          payload.apiKey,
          payload.organizationId || null,
          payload.ownerName,
          payload.status,
          payload.description || null,
          JSON.stringify(payload.extraConfig || {})
        ]
      );
      return getModelProviderById(result.insertId);
    }
    async function updateModelProvider(id, payload) {
      const [result] = await pool.query(
        `UPDATE model_providers
     SET config_name = ?, config_code = ?, provider_type = ?, model_category = ?, model_name = ?, model_version = ?, base_url = ?,
         api_key = ?, organization_id = ?, owner_name = ?, status = ?, description = ?, extra_config = ?
     WHERE id = ?`,
        [
          payload.configName,
          payload.configCode,
          payload.providerType,
          payload.modelCategory,
          payload.modelName,
          payload.modelVersion || null,
          payload.baseUrl || null,
          payload.apiKey,
          payload.organizationId || null,
          payload.ownerName,
          payload.status,
          payload.description || null,
          JSON.stringify(payload.extraConfig || {}),
          id
        ]
      );
      if (result.affectedRows === 0) {
        return null;
      }
      return getModelProviderById(id);
    }
    async function deleteModelProvider(id) {
      const [result] = await pool.query("DELETE FROM model_providers WHERE id = ?", [id]);
      return result.affectedRows > 0;
    }
    module2.exports = {
      getModelProviderById,
      listModelProviders,
      createModelProvider,
      updateModelProvider,
      deleteModelProvider
    };
  }
});

// runtime-port:config
var require_config = __commonJS({
  "runtime-port:config"(exports2, module2) {
    var { createRuntimeConfigProxy } = require("@johnason/data-platform-core-kernel");
    module2.exports = createRuntimeConfigProxy();
  }
});

// backend/src/common/utils/database-driver-store.js
var require_database_driver_store = __commonJS({
  "backend/src/common/utils/database-driver-store.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var DRIVER_STORE_ROOT = path.resolve(process.cwd(), "runtime/database-drivers");
    var ACTIVE_MANIFEST_PATH = path.join(DRIVER_STORE_ROOT, "active.json");
    var DATAX_TARGETS = {
      mysql: {
        dataxReader: { relativePath: "reader/mysqlreader/libs", pattern: /(?:mysql-connector|mariadb-java-client).*\.jar$/i },
        dataxWriter: { relativePath: "writer/mysqlwriter/libs", pattern: /(?:mysql-connector|mariadb-java-client).*\.jar$/i }
      },
      postgresql: {
        dataxReader: { relativePath: "reader/postgresqlreader/libs", pattern: /(?:postgresql|pgjdbc).*\.jar$/i },
        dataxWriter: { relativePath: "writer/postgresqlwriter/libs", pattern: /(?:postgresql|pgjdbc).*\.jar$/i }
      },
      oracle: {
        dataxReader: { relativePath: "reader/oraclereader/libs", pattern: /ojdbc.*\.jar$/i },
        dataxWriter: { relativePath: "writer/oraclewriter/libs", pattern: /ojdbc.*\.jar$/i }
      },
      dm: {
        dataxReader: { relativePath: "reader/rdbmsreader/libs", pattern: /dm.*jdbcdriver.*\.jar$/i },
        dataxWriter: { relativePath: "writer/rdbmswriter/libs", pattern: /dm.*jdbcdriver.*\.jar$/i }
      }
    };
    function ensureDriverStore() {
      fs.mkdirSync(DRIVER_STORE_ROOT, { recursive: true });
      return DRIVER_STORE_ROOT;
    }
    function emptyManifest() {
      return { version: 1, bindings: {}, updatedAt: null };
    }
    function readActiveManifest() {
      ensureDriverStore();
      try {
        const parsed = JSON.parse(fs.readFileSync(ACTIVE_MANIFEST_PATH, "utf8"));
        return parsed && typeof parsed === "object" && parsed.bindings ? parsed : emptyManifest();
      } catch {
        return emptyManifest();
      }
    }
    function writeActiveManifest(manifest) {
      ensureDriverStore();
      const next = { version: 1, bindings: manifest?.bindings || {}, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      const tempPath = `${ACTIVE_MANIFEST_PATH}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(next, null, 2), "utf8");
      fs.renameSync(tempPath, ACTIVE_MANIFEST_PATH);
      return next;
    }
    function getActiveDriverBinding(databaseType, target = "query") {
      const key = `${String(databaseType || "").toLowerCase()}:${target}`;
      return readActiveManifest().bindings[key] || null;
    }
    function resolveDriverFile(relativePath) {
      const resolved = path.resolve(DRIVER_STORE_ROOT, String(relativePath || ""));
      const relative = path.relative(DRIVER_STORE_ROOT, resolved);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("\u9A71\u52A8\u6587\u4EF6\u8DEF\u5F84\u8D85\u51FA\u6301\u4E45\u5316\u4ED3\u5E93");
      }
      return resolved;
    }
    function restoreBuiltInDrivers(directory) {
      if (!fs.existsSync(directory)) return;
      for (const name of fs.readdirSync(directory)) {
        if (!name.endsWith(".builtin-disabled")) continue;
        const source = path.join(directory, name);
        const target = path.join(directory, name.slice(0, -".builtin-disabled".length));
        if (!fs.existsSync(target)) fs.renameSync(source, target);
        else fs.unlinkSync(source);
      }
    }
    function materializeDataXTarget(dataxHome, databaseType, target, binding) {
      const config = DATAX_TARGETS[databaseType]?.[target];
      if (!config) return;
      const directory = path.join(dataxHome, "plugin", config.relativePath);
      if (!fs.existsSync(directory)) throw new Error(`DataX \u63D2\u4EF6\u76EE\u5F55\u4E0D\u5B58\u5728: ${config.relativePath}`);
      const managedName = `medata-managed-${databaseType}.jar`;
      const managedPath = path.join(directory, managedName);
      if (fs.existsSync(managedPath)) fs.unlinkSync(managedPath);
      restoreBuiltInDrivers(directory);
      if (!binding) return;
      for (const name of fs.readdirSync(directory)) {
        if (name === managedName || !config.pattern.test(name)) continue;
        fs.renameSync(path.join(directory, name), path.join(directory, `${name}.builtin-disabled`));
      }
      const sourcePath = resolveDriverFile(binding.filePath);
      if (!fs.existsSync(sourcePath)) throw new Error(`\u6FC0\u6D3B\u9A71\u52A8\u6587\u4EF6\u4E0D\u5B58\u5728: ${binding.filePath}`);
      fs.copyFileSync(sourcePath, managedPath);
    }
    function materializeActiveDataXDrivers(dataxHome) {
      const manifest = readActiveManifest();
      for (const databaseType of Object.keys(DATAX_TARGETS)) {
        for (const target of ["dataxReader", "dataxWriter"]) {
          materializeDataXTarget(dataxHome, databaseType, target, manifest.bindings[`${databaseType}:${target}`] || null);
        }
      }
      return manifest;
    }
    module2.exports = {
      ACTIVE_MANIFEST_PATH,
      DRIVER_STORE_ROOT,
      ensureDriverStore,
      getActiveDriverBinding,
      materializeDataXTarget,
      materializeActiveDataXDrivers,
      readActiveManifest,
      resolveDriverFile,
      writeActiveManifest
    };
  }
});

// backend/src/common/utils/datasource-capabilities.js
var require_datasource_capabilities = __commonJS({
  "backend/src/common/utils/datasource-capabilities.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { getActiveDriverBinding } = require_database_driver_store();
    var DATABASE_CAPABILITIES = Object.freeze({
      mysql: Object.freeze({
        type: "mysql",
        label: "MySQL",
        aliases: Object.freeze(["mysql", "mariadb"]),
        defaultPort: 3306,
        driverClassName: "com.mysql.cj.jdbc.Driver",
        healthCheckSql: "SELECT 1 AS ok",
        dataxReader: "mysqlreader",
        dataxWriter: "mysqlwriter",
        nodePackage: "mysql2",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      }),
      postgresql: Object.freeze({
        type: "postgresql",
        label: "PostgreSQL",
        aliases: Object.freeze(["postgresql", "postgres", "pg"]),
        defaultPort: 5432,
        driverClassName: "org.postgresql.Driver",
        healthCheckSql: "SELECT 1 AS ok",
        dataxReader: "postgresqlreader",
        dataxWriter: "postgresqlwriter",
        nodePackage: "pg",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      }),
      oracle: Object.freeze({
        type: "oracle",
        label: "Oracle",
        aliases: Object.freeze(["oracle"]),
        defaultPort: 1521,
        driverClassName: "oracle.jdbc.OracleDriver",
        healthCheckSql: "SELECT 1 AS ok FROM DUAL",
        dataxReader: "oraclereader",
        dataxWriter: "oraclewriter",
        nodePackage: "oracledb",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      }),
      dm: Object.freeze({
        type: "dm",
        label: "\u8FBE\u68A6\u6570\u636E\u5E93",
        aliases: Object.freeze(["dm", "dameng", "dmdb"]),
        defaultPort: 5236,
        driverClassName: "dm.jdbc.driver.DmDriver",
        healthCheckSql: "SELECT 1 AS ok FROM DUAL",
        dataxReader: "rdbmsreader",
        dataxWriter: "rdbmswriter",
        nodePackage: "dmdb",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      })
    });
    var DATABASE_ALIAS_MAP = Object.freeze(Object.fromEntries(
      Object.values(DATABASE_CAPABILITIES).flatMap(
        (capability) => capability.aliases.map((alias) => [alias, capability.type])
      )
    ));
    function getRuntimeDatabaseCapabilityStatus() {
      const pluginRoot = path.resolve(__dirname, "../../../datax/plugin");
      const hasPlugin = (kind, name) => fs.existsSync(path.join(pluginRoot, kind, name, "plugin.json"));
      const hasJar = (kind, name, pattern) => {
        const libs = path.join(pluginRoot, kind, name, "libs");
        return fs.existsSync(libs) && fs.readdirSync(libs).some((fileName) => pattern.test(fileName));
      };
      return listDatabaseCapabilities().map((capability) => {
        let driverLoaded = false;
        try {
          require.resolve(capability.nodePackage);
          driverLoaded = true;
        } catch {
          driverLoaded = false;
        }
        const readerJarReady = capability.type === "oracle" ? hasJar("reader", capability.dataxReader, /^ojdbc.*\.jar$/i) : capability.type === "dm" ? hasJar("reader", capability.dataxReader, /^Dm.*JdbcDriver.*\.jar$/i) : true;
        const writerJarReady = capability.type === "oracle" ? hasJar("writer", capability.dataxWriter, /^ojdbc.*\.jar$/i) : capability.type === "dm" ? hasJar("writer", capability.dataxWriter, /^Dm.*JdbcDriver.*\.jar$/i) : true;
        const managedQueryDriver = getActiveDriverBinding(capability.type, "query");
        return {
          ...capability,
          driverLoaded,
          queryReady: driverLoaded || Boolean(managedQueryDriver),
          managedQueryDriver: managedQueryDriver ? {
            packageId: managedQueryDriver.packageId,
            version: managedQueryDriver.version,
            sha256: managedQueryDriver.sha256
          } : null,
          dataxReaderReady: hasPlugin("reader", capability.dataxReader) && readerJarReady,
          dataxWriterReady: hasPlugin("writer", capability.dataxWriter) && writerJarReady
        };
      });
    }
    function normalizeRegisteredDatabaseType(value) {
      const normalized = String(value || "").trim().toLowerCase();
      return DATABASE_ALIAS_MAP[normalized] || normalized;
    }
    function getDatabaseCapability(value) {
      return DATABASE_CAPABILITIES[normalizeRegisteredDatabaseType(value)] || null;
    }
    function listDatabaseCapabilities() {
      return Object.values(DATABASE_CAPABILITIES);
    }
    function isSupportedDatabaseType(value) {
      return Boolean(getDatabaseCapability(value));
    }
    module2.exports = {
      DATABASE_CAPABILITIES,
      getDatabaseCapability,
      isSupportedDatabaseType,
      listDatabaseCapabilities,
      getRuntimeDatabaseCapabilityStatus,
      normalizeRegisteredDatabaseType
    };
  }
});

// backend/src/common/utils/datasource-dialect.js
var require_datasource_dialect = __commonJS({
  "backend/src/common/utils/datasource-dialect.js"(exports2, module2) {
    var POSTGRESQL = "postgresql";
    var UNKNOWN = "unknown";
    var {
      getDatabaseCapability,
      normalizeRegisteredDatabaseType
    } = require_datasource_capabilities();
    var DIALECT_VENDOR_MAP = {
      mysql: "mysql",
      mariadb: "mysql",
      postgresql: POSTGRESQL,
      postgres: POSTGRESQL,
      gaussdb: POSTGRESQL,
      opengauss: POSTGRESQL,
      clickhouse: "clickhouse",
      hive: "hive",
      hive2: "hive",
      oracle: "oracle",
      dm: "dm",
      dameng: "dm",
      dmdb: "dm",
      sqlserver: "sqlserver"
    };
    function normalizeDatasourceType(value) {
      const normalized = String(value || "").trim().toLowerCase();
      if (!normalized) {
        return "";
      }
      const registeredType = normalizeRegisteredDatabaseType(normalized);
      if (registeredType !== normalized || getDatabaseCapability(registeredType)) return registeredType;
      if (normalized === "opengauss") {
        return "gaussdb";
      }
      return normalized;
    }
    function mapJdbcVendorToDialect(vendor) {
      return DIALECT_VENDOR_MAP[String(vendor || "").trim().toLowerCase()] || UNKNOWN;
    }
    function getDefaultPort(type) {
      const normalizedType = normalizeDatasourceType(type);
      const registered = getDatabaseCapability(normalizedType);
      if (registered) return registered.defaultPort;
      switch (normalizedType) {
        case "gaussdb":
          return 5432;
        case "clickhouse":
          return 8123;
        case "hive":
          return 1e4;
        case "kafka":
          return 9092;
        case "ftp":
          return 21;
        case "sftp":
          return 22;
        default:
          return 0;
      }
    }
    function parseJdbcParams(rawParams = "") {
      if (!rawParams) {
        return {};
      }
      const normalized = String(rawParams || "").replace(/^[?;]/, "").replace(/;/g, "&");
      const searchParams = new URLSearchParams(normalized);
      const result = {};
      for (const [key, value] of searchParams.entries()) {
        result[key] = value;
      }
      return result;
    }
    function parseStandardJdbcUrl(jdbcUrl) {
      const normalized = String(jdbcUrl || "").trim();
      const matched = normalized.match(/^jdbc:([a-z0-9_]+)(?::([a-z0-9_]+))?:\/\/([^/?;#]+)(?::(\d+))?(?:\/([^?;#]*))?([?;].*)?$/i);
      if (!matched) {
        return null;
      }
      const vendor = String(matched[1] || "").toLowerCase();
      const subProtocol = String(matched[2] || "").toLowerCase() || null;
      const hostToken = String(matched[3] || "").split(",").map((item) => item.trim()).find(Boolean) || "";
      const pathToken = decodeURIComponent(String(matched[5] || "").trim());
      const params = parseJdbcParams(matched[6] || "");
      const database = pathToken || null;
      const schema = params.currentSchema || params.currentschema || params.schema || params.searchpath || null;
      return {
        jdbcUrl: normalized,
        vendor,
        subProtocol,
        dialect: mapJdbcVendorToDialect(subProtocol || vendor),
        host: hostToken || null,
        port: matched[4] ? Number(matched[4]) : null,
        database,
        schema,
        params
      };
    }
    function parseOracleJdbcUrl(jdbcUrl) {
      const normalized = String(jdbcUrl || "").trim();
      const serviceMatched = normalized.match(/^jdbc:oracle(?::[a-z0-9_]+)*:@\/\/([^:/?#]+):(\d+)\/([^?;#]+)([?;].*)?$/i);
      const sidMatched = normalized.match(/^jdbc:oracle(?::[a-z0-9_]+)*:@([^:/?#]+):(\d+):([^?;#]+)([?;].*)?$/i);
      const matched = serviceMatched || sidMatched;
      if (!matched) {
        return null;
      }
      return {
        jdbcUrl: normalized,
        vendor: "oracle",
        subProtocol: null,
        dialect: "oracle",
        host: String(matched[1] || "").trim() || null,
        port: matched[2] ? Number(matched[2]) : null,
        database: decodeURIComponent(String(matched[3] || "").trim()) || null,
        connectionMode: serviceMatched ? "serviceName" : "sid",
        schema: null,
        params: parseJdbcParams(matched[4] || "")
      };
    }
    function parseJdbcUrl(jdbcUrl) {
      const normalized = String(jdbcUrl || "").trim();
      if (!normalized || !/^jdbc:/i.test(normalized)) {
        return null;
      }
      return parseStandardJdbcUrl(normalized) || parseOracleJdbcUrl(normalized);
    }
    function inferDatasourceDialect(sourceType, connectionConfig = {}) {
      const normalizedType = normalizeDatasourceType(sourceType);
      if (!normalizedType) {
        return UNKNOWN;
      }
      if (getDatabaseCapability(normalizedType) || normalizedType === "clickhouse" || normalizedType === "hive" || normalizedType === "kafka" || normalizedType === "api" || normalizedType === "ftp" || normalizedType === "sftp") {
        return normalizedType;
      }
      if (normalizedType === "gaussdb") {
        return POSTGRESQL;
      }
      if (normalizedType === "jdbc") {
        return parseJdbcUrl(connectionConfig.jdbcUrl || connectionConfig.url || connectionConfig.connectionString)?.dialect || UNKNOWN;
      }
      return normalizedType;
    }
    function normalizeJdbcUrlForDialect(jdbcUrl, dialect) {
      const normalized = String(jdbcUrl || "").trim();
      if (!normalized) {
        return "";
      }
      if (dialect === POSTGRESQL) {
        return normalized.replace(/^jdbc:(?:gaussdb|opengauss|postgres):/i, "jdbc:postgresql:");
      }
      if (dialect === "mysql") {
        return normalized.replace(/^jdbc:mariadb:/i, "jdbc:mysql:");
      }
      if (dialect === "hive") {
        return normalized.replace(/^jdbc:hive:/i, "jdbc:hive2:");
      }
      return normalized;
    }
    function buildJdbcUrl(sourceType, connectionConfig = {}, options = {}) {
      const normalizedType = normalizeDatasourceType(sourceType);
      const dialect = options.dialect || inferDatasourceDialect(normalizedType, connectionConfig);
      const existingJdbcUrl = String(connectionConfig.jdbcUrl || connectionConfig.url || "").trim();
      if (existingJdbcUrl) {
        return options.normalize !== false ? normalizeJdbcUrlForDialect(existingJdbcUrl, dialect) : existingJdbcUrl;
      }
      const host = String(connectionConfig.host || "").trim();
      const port = Number(connectionConfig.port || getDefaultPort(dialect || normalizedType));
      const database = String(connectionConfig.database || connectionConfig.databaseName || "").trim();
      if (!host || !port) {
        return "";
      }
      if (dialect === POSTGRESQL) {
        return `jdbc:postgresql://${host}:${port}/${database}`;
      }
      if (dialect === "mysql") {
        return `jdbc:mysql://${host}:${port}/${database}?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai`;
      }
      if (dialect === "clickhouse") {
        return `jdbc:clickhouse://${host}:${port}/${database}`;
      }
      if (dialect === "hive") {
        return `jdbc:hive2://${host}:${port}/${database || "default"}`;
      }
      if (dialect === "oracle") {
        const connectionMode = String(connectionConfig.connectionMode || "serviceName").trim().toLowerCase();
        return connectionMode === "sid" ? `jdbc:oracle:thin:@${host}:${port}:${database}` : `jdbc:oracle:thin:@//${host}:${port}/${database}`;
      }
      if (dialect === "dm") {
        return `jdbc:dm://${host}:${port}/${database}`;
      }
      return "";
    }
    function resolveDatasourceConnection(sourceType, connectionConfig = {}) {
      const normalizedType = normalizeDatasourceType(sourceType);
      const jdbcMeta = parseJdbcUrl(connectionConfig.jdbcUrl || connectionConfig.url || connectionConfig.connectionString);
      const dialect = inferDatasourceDialect(normalizedType, connectionConfig);
      const database = connectionConfig.database || connectionConfig.databaseName || jdbcMeta?.database || null;
      const schema = connectionConfig.schema || connectionConfig.currentSchema || jdbcMeta?.schema || (dialect === POSTGRESQL ? "public" : null);
      const host = connectionConfig.host || jdbcMeta?.host || null;
      const portValue = connectionConfig.port || jdbcMeta?.port || getDefaultPort(dialect || normalizedType);
      const port = Number(portValue || 0) || 0;
      return {
        sourceType: normalizedType,
        dialect,
        host,
        port,
        database,
        schema,
        username: connectionConfig.username || connectionConfig.user || null,
        password: connectionConfig.password || null,
        jdbcUrl: buildJdbcUrl(normalizedType, { ...connectionConfig, database }, { dialect }),
        driverClassName: connectionConfig.driverClassName || null,
        protocol: connectionConfig.protocol || jdbcMeta?.vendor || null,
        connectionMode: connectionConfig.connectionMode || jdbcMeta?.connectionMode || null,
        jdbcMeta
      };
    }
    module2.exports = {
      POSTGRESQL,
      UNKNOWN,
      buildJdbcUrl,
      getDefaultPort,
      inferDatasourceDialect,
      mapJdbcVendorToDialect,
      normalizeDatasourceType,
      normalizeJdbcUrlForDialect,
      parseJdbcUrl,
      resolveDatasourceConnection
    };
  }
});

// backend/src/modules/data-development/data-development.utils.js
var require_data_development_utils = __commonJS({
  "backend/src/modules/data-development/data-development.utils.js"(exports2, module2) {
    var crypto = require("crypto");
    var env = require_config();
    var {
      inferDatasourceDialect: inferSharedDatasourceDialect,
      normalizeDatasourceType: normalizeSharedDatasourceType,
      resolveDatasourceConnection
    } = require_datasource_dialect();
    var PENDING_PROCESSING_SOURCE_TABLE_PREFIX = "__pending_source_table__";
    function parseJson(value, fallback) {
      if (value === null || value === void 0) {
        return fallback;
      }
      if (typeof value === "object") {
        return value;
      }
      try {
        return JSON.parse(value);
      } catch (error) {
        return fallback;
      }
    }
    function normalizeDatasourceStorageType(type) {
      return normalizeSharedDatasourceType(type || "mysql") || "mysql";
    }
    function normalizeDatasourceType(type) {
      const normalized = normalizeDatasourceStorageType(type);
      if (normalized === "gaussdb") {
        return "postgresql";
      }
      return normalized;
    }
    function isPendingProcessingSourceTable(tableName) {
      return String(tableName || "").startsWith(PENDING_PROCESSING_SOURCE_TABLE_PREFIX);
    }
    function parseDatasourceHostAliases() {
      return String(process.env.DATA_DEV_HOST_ALIASES || "").split(",").map((item) => item.trim()).filter(Boolean).reduce((result, item) => {
        const [from, to] = item.split("=").map((part) => part.trim());
        if (!from || !to) {
          return result;
        }
        result[from.toLowerCase()] = to;
        return result;
      }, {});
    }
    function resolveDatasourceHost(host) {
      const normalizedHost = String(host || "").trim();
      if (!normalizedHost) {
        return normalizedHost;
      }
      const aliases = parseDatasourceHostAliases();
      return aliases[normalizedHost.toLowerCase()] || normalizedHost;
    }
    function buildDatasourceConnectionPayload(input = {}) {
      const extraConfig = parseJson(input.extraConfig, {});
      return {
        host: input.host,
        port: input.port,
        database: input.database || input.databaseName,
        databaseName: input.databaseName || input.database,
        username: input.username,
        password: input.password,
        ...extraConfig
      };
    }
    function inferDatasourceDialect(input, extraConfig = {}) {
      if (input && typeof input === "object") {
        const sourceType2 = input.storageType || input.type || input.sourceType;
        const payload = buildDatasourceConnectionPayload(input);
        const dialect2 = inferSharedDatasourceDialect(sourceType2, payload);
        return dialect2 === "unknown" ? normalizeDatasourceType(sourceType2) : dialect2;
      }
      const sourceType = input;
      const dialect = inferSharedDatasourceDialect(sourceType, extraConfig || {});
      return dialect === "unknown" ? normalizeDatasourceType(sourceType) : dialect;
    }
    function resolveRuntimeDatasourceConfig(input = {}) {
      const storageType = normalizeDatasourceStorageType(input.storageType || input.type || input.sourceType);
      const payload = buildDatasourceConnectionPayload(input);
      const resolved = resolveDatasourceConnection(storageType, payload);
      const dialect = resolved.dialect === "unknown" ? normalizeDatasourceType(storageType) : resolved.dialect;
      return {
        storageType,
        dialect,
        host: resolveDatasourceHost(resolved.host || input.host),
        port: Number(resolved.port || input.port || 0) || 0,
        databaseName: resolved.database || input.databaseName || null,
        username: resolved.username || input.username || null,
        password: resolved.password || input.password || "",
        schema: resolved.schema || payload.schema || null,
        jdbcUrl: resolved.jdbcUrl || payload.jdbcUrl || "",
        driverClassName: payload.driverClassName || resolved.driverClassName || null,
        protocol: payload.protocol || resolved.protocol || null,
        connectionMode: payload.connectionMode || resolved.connectionMode || null,
        extraConfig: {
          ...parseJson(input.extraConfig, {}),
          ...resolved.jdbcUrl ? { jdbcUrl: resolved.jdbcUrl } : {},
          ...resolved.schema ? { schema: resolved.schema } : {},
          ...payload.driverClassName || resolved.driverClassName ? { driverClassName: payload.driverClassName || resolved.driverClassName } : {},
          ...payload.protocol || resolved.protocol ? { protocol: payload.protocol || resolved.protocol } : {},
          ...payload.connectionMode || resolved.connectionMode ? { connectionMode: payload.connectionMode || resolved.connectionMode } : {}
        }
      };
    }
    function buildDatasourceEnvironmentSignature(datasource) {
      if (!datasource) {
        return "";
      }
      const resolved = resolveRuntimeDatasourceConfig(datasource);
      return [
        resolved.dialect,
        resolveDatasourceHost(resolved.host).toLowerCase(),
        Number(resolved.port || 0)
      ].join("::");
    }
    function buildCipherKey() {
      return crypto.createHash("sha256").update(String(env.licenseStorageKey || env.jwtSecret || "medata")).digest();
    }
    function encryptSecret(plainText) {
      if (!plainText) {
        return null;
      }
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv("aes-256-cbc", buildCipherKey(), iv);
      const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]).toString("base64");
      return `${iv.toString("base64")}:${encrypted}`;
    }
    function decryptSecret(cipherText) {
      if (!cipherText) {
        return "";
      }
      const [ivBase64, payload] = String(cipherText).split(":");
      if (!ivBase64 || !payload) {
        return String(cipherText);
      }
      try {
        const decipher = crypto.createDecipheriv("aes-256-cbc", buildCipherKey(), Buffer.from(ivBase64, "base64"));
        return Buffer.concat([decipher.update(Buffer.from(payload, "base64")), decipher.final()]).toString("utf8");
      } catch (error) {
        return String(cipherText);
      }
    }
    function isQuerySql(sql) {
      const normalized = stripLeadingSqlComments(sql).toLowerCase();
      return /^(select|show|describe|desc|with|explain)\b/.test(normalized);
    }
    function hasLimitClause(sql) {
      return /\blimit\s+\d+|\bfetch\s+first\s+\d+\s+rows\s+only|\brownum\b/i.test(String(sql || ""));
    }
    function applyResultLimit(sql, resultLimit, dialect = "mysql") {
      const limit = Number(resultLimit || 0);
      if (!limit || !isQuerySql(sql) || hasLimitClause(sql)) {
        return String(sql || "");
      }
      const trimmed = String(sql || "").trim().replace(/;+\s*$/, "");
      const normalizedDialect = normalizeDatasourceType(dialect);
      if (normalizedDialect === "oracle") {
        return `SELECT * FROM (${trimmed}) WHERE ROWNUM <= ${limit}`;
      }
      if (normalizedDialect === "dm") {
        return `${trimmed}
FETCH FIRST ${limit} ROWS ONLY`;
      }
      if (normalizedDialect === "hive") {
        return `${trimmed}
LIMIT ${limit}`;
      }
      return `${trimmed} LIMIT ${limit}`;
    }
    function stripLeadingSqlComments(sql) {
      let text = String(sql || "").trimStart();
      while (text) {
        if (text.startsWith("--")) {
          const newlineIndex = text.indexOf("\n");
          text = newlineIndex === -1 ? "" : text.slice(newlineIndex + 1).trimStart();
          continue;
        }
        if (text.startsWith("/*")) {
          const blockEndIndex = text.indexOf("*/");
          text = blockEndIndex === -1 ? "" : text.slice(blockEndIndex + 2).trimStart();
          continue;
        }
        break;
      }
      return text.trim();
    }
    function previewRows(rows, maxRows = 20) {
      return Array.isArray(rows) ? rows.slice(0, maxRows) : [];
    }
    function sanitizeNumber(value, fallback = 0) {
      const next = Number(value);
      return Number.isFinite(next) ? next : fallback;
    }
    function buildResultPreview(result) {
      if (!result) {
        return null;
      }
      return {
        fields: Array.isArray(result.fields) ? result.fields.slice(0, 64) : [],
        rows: previewRows(result.rows, 20),
        rowCount: sanitizeNumber(result.rowCount, Array.isArray(result.rows) ? result.rows.length : 0),
        affectedRows: sanitizeNumber(result.affectedRows, 0)
      };
    }
    function formatDateTime(date = /* @__PURE__ */ new Date()) {
      const value = date instanceof Date ? date : new Date(date);
      if (Number.isNaN(value.getTime())) {
        return null;
      }
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      const hour = String(value.getHours()).padStart(2, "0");
      const minute = String(value.getMinutes()).padStart(2, "0");
      const second = String(value.getSeconds()).padStart(2, "0");
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }
    function parseTableName(tableName, defaultScope) {
      const parts = String(tableName || "").split(".").filter(Boolean);
      if (parts.length >= 2) {
        return {
          scope: parts[parts.length - 2].replace(/["`]/g, ""),
          table: parts[parts.length - 1].replace(/["`]/g, "")
        };
      }
      return {
        scope: defaultScope,
        table: String(tableName || "").replace(/["`]/g, "")
      };
    }
    function parseCsvLine(line) {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === '"' && inQuotes && next === '"') {
          current += '"';
          index += 1;
          continue;
        }
        if (char === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if (char === "," && !inQuotes) {
          result.push(current);
          current = "";
          continue;
        }
        current += char;
      }
      result.push(current);
      return result;
    }
    function cleanHiveOutput(text) {
      return String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !line.startsWith("SLF4J:")).filter((line) => !line.startsWith("Connecting to ")).filter((line) => !line.startsWith("Connected to:")).filter((line) => !line.startsWith("Driver:")).filter((line) => !line.startsWith("Transaction isolation:")).filter((line) => !line.startsWith("Beeline version")).filter((line) => !line.startsWith("0: jdbc:hive2://")).filter((line) => !line.startsWith("+")).filter((line) => !line.startsWith("|"));
    }
    function quoteIdentifier(identifier, type = "mysql") {
      const normalized = normalizeDatasourceType(type);
      const quote = ["postgresql", "oracle", "dm"].includes(normalized) ? '"' : "`";
      return String(identifier || "").split(".").filter(Boolean).map((part) => `${quote}${String(part).replace(new RegExp(quote, "g"), quote.repeat(2))}${quote}`).join(".");
    }
    module2.exports = {
      applyResultLimit,
      buildDatasourceEnvironmentSignature,
      buildResultPreview,
      cleanHiveOutput,
      decryptSecret,
      encryptSecret,
      formatDateTime,
      inferDatasourceDialect,
      isPendingProcessingSourceTable,
      isQuerySql,
      normalizeDatasourceStorageType,
      normalizeDatasourceType,
      parseCsvLine,
      resolveDatasourceHost,
      resolveRuntimeDatasourceConfig,
      parseJson,
      parseTableName,
      previewRows,
      quoteIdentifier,
      sanitizeNumber,
      stripLeadingSqlComments
    };
  }
});

// backend/src/modules/model-providers/model-provider.utils.js
var require_model_provider_utils = __commonJS({
  "backend/src/modules/model-providers/model-provider.utils.js"(exports2, module2) {
    var { decryptSecret, encryptSecret } = require_data_development_utils();
    function parseExtraConfig(extraConfig) {
      if (!extraConfig) {
        return {};
      }
      if (typeof extraConfig === "object" && !Array.isArray(extraConfig)) {
        return { ...extraConfig };
      }
      try {
        const parsed = JSON.parse(extraConfig);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (error) {
        return {};
      }
    }
    function sanitizeHeaderValue(key, value) {
      const normalizedKey = String(key || "").toLowerCase();
      if (normalizedKey.includes("authorization") || normalizedKey.includes("api-key") || normalizedKey.includes("apikey") || normalizedKey.includes("token") || normalizedKey.includes("secret")) {
        return maskSecret(String(value || ""));
      }
      return value;
    }
    function isHeaderMapCandidate(headers) {
      if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
        return false;
      }
      return Object.values(headers).every((value) => value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean");
    }
    function sanitizeHeaderMap(headers) {
      if (!isHeaderMapCandidate(headers)) {
        return headers;
      }
      return Object.entries(headers).reduce((result, [key, value]) => {
        result[key] = sanitizeHeaderValue(key, value);
        return result;
      }, {});
    }
    function sanitizeExtraConfig(extraConfig) {
      const next = parseExtraConfig(extraConfig);
      ["defaultHeaders", "inferenceHeaders", "modelListHeaders"].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(next, key)) {
          next[key] = sanitizeHeaderMap(next[key]);
        }
      });
      if (next.headers && typeof next.headers === "object" && !Array.isArray(next.headers)) {
        if (isHeaderMapCandidate(next.headers)) {
          next.headers = sanitizeHeaderMap(next.headers);
        } else {
          ["default", "common", "inference", "modelList", "model_list"].forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(next.headers, key)) {
              next.headers[key] = sanitizeHeaderMap(next.headers[key]);
            }
          });
        }
      }
      return next;
    }
    function maskSecret(value) {
      const text = String(value || "");
      if (!text) {
        return "";
      }
      if (text.length <= 8) {
        return `${text.slice(0, 1)}${"*".repeat(Math.max(2, text.length - 2))}${text.slice(-1)}`;
      }
      return `${text.slice(0, 3)}${"*".repeat(Math.min(16, Math.max(6, text.length - 6)))}${text.slice(-3)}`;
    }
    function normalizeModelCatalog(catalog = [], fallbackModelName = "", fallbackModelVersion = "") {
      const source = Array.isArray(catalog) ? catalog : [];
      const grouped = /* @__PURE__ */ new Map();
      source.forEach((item) => {
        if (!item || typeof item !== "object") {
          return;
        }
        const name = String(item.name || item.modelName || item.label || item.value || "").trim();
        if (!name) {
          return;
        }
        const label = String(item.label || item.modelLabel || name).trim() || name;
        const rawVersions = Array.isArray(item.versions) ? item.versions : [];
        if (!grouped.has(name)) {
          grouped.set(name, {
            name,
            label,
            versions: []
          });
        }
        const bucket = grouped.get(name);
        rawVersions.forEach((versionItem) => {
          const value = String(versionItem?.value || versionItem?.id || versionItem?.modelId || versionItem?.name || "").trim();
          if (!value) {
            return;
          }
          if (!bucket.versions.some((existing) => existing.value === value)) {
            bucket.versions.push({
              value,
              label: String(versionItem?.label || versionItem?.name || value).trim() || value
            });
          }
        });
      });
      const normalized = Array.from(grouped.values()).map((item) => ({
        name: item.name,
        label: item.label,
        versions: item.versions.length ? item.versions : [{ value: item.name, label: item.label }]
      })).sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
      if (normalized.length) {
        return normalized;
      }
      const fallbackName = String(fallbackModelName || "").trim();
      const fallbackVersion = String(fallbackModelVersion || fallbackModelName || "").trim();
      if (!fallbackName && !fallbackVersion) {
        return [];
      }
      return [{
        name: fallbackName || fallbackVersion,
        label: fallbackName || fallbackVersion,
        versions: [{ value: fallbackVersion || fallbackName, label: fallbackVersion || fallbackName }]
      }];
    }
    function findCatalogVersion(catalog = [], modelName, modelVersion) {
      const name = String(modelName || "").trim();
      const version = String(modelVersion || "").trim();
      if (!name || !version) {
        return null;
      }
      const modelEntry = catalog.find((item) => item.name === name);
      if (!modelEntry) {
        return null;
      }
      return modelEntry.versions.find((item) => item.value === version) || null;
    }
    function splitModelIdentity(rawValue, rawLabel) {
      const value = String(rawValue || "").trim();
      const label = String(rawLabel || value).trim() || value;
      const match = value.match(/^(.*?)(?:[-_@:/])((?:20\d{2}[-_]\d{2}[-_]\d{2})|(?:v?\d+(?:\.\d+){0,2}))$/i);
      if (match && match[1]) {
        const modelName = match[1].replace(/[-_@:/]+$/, "").trim();
        const versionToken = match[2].trim();
        if (modelName) {
          return {
            modelName,
            modelLabel: modelName,
            versionValue: value,
            versionLabel: label === value ? versionToken : label
          };
        }
      }
      return {
        modelName: value,
        modelLabel: label,
        versionValue: value,
        versionLabel: label
      };
    }
    function buildModelCatalogFromRemoteModels(models = []) {
      const grouped = /* @__PURE__ */ new Map();
      (Array.isArray(models) ? models : []).forEach((item) => {
        const value = String(item?.value || item?.id || item?.name || "").trim();
        if (!value) {
          return;
        }
        const label = String(item?.label || item?.name || value).trim() || value;
        const parsed = splitModelIdentity(value, label);
        if (!grouped.has(parsed.modelName)) {
          grouped.set(parsed.modelName, {
            name: parsed.modelName,
            label: parsed.modelLabel,
            versions: []
          });
        }
        const bucket = grouped.get(parsed.modelName);
        if (!bucket.versions.some((versionItem) => versionItem.value === parsed.versionValue)) {
          bucket.versions.push({
            value: parsed.versionValue,
            label: parsed.versionLabel
          });
        }
      });
      return normalizeModelCatalog(Array.from(grouped.values()));
    }
    function normalizeRuntimeProvider(provider) {
      if (!provider) {
        return null;
      }
      const extraConfig = parseExtraConfig(provider.extraConfig || provider.extra_config);
      const modelName = String(provider.modelName || provider.model_name || "").trim();
      const modelVersion = String(provider.modelVersion || provider.model_version || "").trim();
      return {
        id: Number(provider.id),
        configName: provider.configName || provider.config_name,
        configCode: provider.configCode || provider.config_code,
        providerType: provider.providerType || provider.provider_type,
        modelCategory: provider.modelCategory || provider.model_category,
        modelName,
        modelVersion: modelVersion || modelName,
        baseUrl: provider.baseUrl || provider.base_url || null,
        apiKey: decryptSecret(provider.apiKey || provider.api_key || ""),
        organizationId: provider.organizationId || provider.organization_id || null,
        ownerName: provider.ownerName || provider.owner_name || null,
        status: provider.status,
        description: provider.description || null,
        extraConfig,
        modelCatalog: normalizeModelCatalog(extraConfig.modelCatalog, modelName, modelVersion || modelName),
        createdAt: provider.createdAt || provider.created_at || null,
        updatedAt: provider.updatedAt || provider.updated_at || null
      };
    }
    function normalizeDisplayProvider(provider) {
      const runtimeProvider = normalizeRuntimeProvider(provider);
      if (!runtimeProvider) {
        return null;
      }
      return {
        ...runtimeProvider,
        apiKey: runtimeProvider.apiKey ? maskSecret(runtimeProvider.apiKey) : "",
        apiKeyMasked: runtimeProvider.apiKey ? maskSecret(runtimeProvider.apiKey) : "",
        hasApiKey: Boolean(runtimeProvider.apiKey),
        extraConfig: sanitizeExtraConfig(runtimeProvider.extraConfig)
      };
    }
    function applyModelSelection(provider, selection = {}) {
      const runtimeProvider = normalizeRuntimeProvider(provider);
      if (!runtimeProvider) {
        return null;
      }
      const requestedModelName = String(selection.modelName || "").trim();
      const requestedModelVersion = String(selection.modelVersion || "").trim();
      const catalog = Array.isArray(runtimeProvider.modelCatalog) ? runtimeProvider.modelCatalog : [];
      const requestedCatalogModel = requestedModelName ? catalog.find((item) => item.name === requestedModelName) : null;
      const requestedCatalogVersion = requestedModelVersion ? catalog.flatMap((item) => item.versions || []).find((item) => item.value === requestedModelVersion) : null;
      const fallbackCatalogModel = catalog.find((item) => item.name === runtimeProvider.modelName) || catalog[0] || null;
      const selectedModelName = requestedCatalogModel?.name || fallbackCatalogModel?.name || requestedModelName || runtimeProvider.modelName;
      const selectedModelVersion = requestedCatalogVersion?.value || requestedCatalogModel?.versions?.[0]?.value || fallbackCatalogModel?.versions?.find((item) => item.value === runtimeProvider.modelVersion)?.value || fallbackCatalogModel?.versions?.[0]?.value || requestedModelVersion || runtimeProvider.modelVersion || runtimeProvider.modelName;
      return {
        ...runtimeProvider,
        modelName: selectedModelVersion,
        modelVersion: selectedModelVersion,
        selectedModelName,
        selectedModelVersion
      };
    }
    function encryptProviderSecret(apiKey) {
      return encryptSecret(String(apiKey || "").trim());
    }
    module2.exports = {
      applyModelSelection,
      buildModelCatalogFromRemoteModels,
      encryptProviderSecret,
      findCatalogVersion,
      maskSecret,
      normalizeDisplayProvider,
      normalizeModelCatalog,
      normalizeRuntimeProvider,
      parseExtraConfig
    };
  }
});

// backend/src/modules/model-providers/model-provider.service.js
var require_model_provider_service = __commonJS({
  "backend/src/modules/model-providers/model-provider.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var repository = require_model_provider_repository();
    var {
      applyModelSelection,
      buildModelCatalogFromRemoteModels,
      encryptProviderSecret,
      normalizeDisplayProvider,
      normalizeModelCatalog,
      normalizeRuntimeProvider,
      parseExtraConfig
    } = require_model_provider_utils();
    async function listModelProviders() {
      const rows = await repository.listModelProviders();
      return rows.map((item) => normalizeDisplayProvider(item));
    }
    async function getModelProviderById(id) {
      const row = await repository.getModelProviderById(id);
      if (!row) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      return normalizeRuntimeProvider(row);
    }
    async function getActiveChatModelProviders() {
      const rows = await repository.listModelProviders();
      return rows.filter((item) => item.status === "active" && item.modelCategory === "chat").map((item) => normalizeRuntimeProvider(item));
    }
    function normalizeProviderPayload(payload, existing = null) {
      const existingRuntime = existing ? normalizeRuntimeProvider(existing) : null;
      const extraConfig = parseExtraConfig(payload.extraConfig);
      const selectedModelName = String(payload.modelName || existingRuntime?.modelName || "").trim();
      const selectedModelVersion = String(payload.modelVersion || existingRuntime?.modelVersion || selectedModelName).trim();
      return {
        ...payload,
        modelName: selectedModelName,
        modelVersion: selectedModelVersion || selectedModelName,
        apiKey: payload.apiKey ? encryptProviderSecret(payload.apiKey) : existing?.apiKey || "",
        extraConfig: {
          ...extraConfig,
          modelCatalog: normalizeModelCatalog(
            extraConfig.modelCatalog,
            selectedModelName,
            selectedModelVersion || selectedModelName
          )
        }
      };
    }
    async function resolveRuntimePayload(payload) {
      const existing = payload.id ? await repository.getModelProviderById(Number(payload.id)) : null;
      if (payload.id && !existing) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      const existingRuntime = existing ? normalizeRuntimeProvider(existing) : null;
      return {
        ...payload,
        providerType: payload.providerType || existingRuntime?.providerType,
        modelCategory: payload.modelCategory || existingRuntime?.modelCategory || "chat",
        baseUrl: payload.baseUrl || existingRuntime?.baseUrl,
        apiKey: payload.apiKey || existingRuntime?.apiKey,
        organizationId: Object.prototype.hasOwnProperty.call(payload, "organizationId") ? payload.organizationId : existingRuntime?.organizationId,
        extraConfig: {
          ...existingRuntime?.extraConfig || {},
          ...parseExtraConfig(payload.extraConfig)
        }
      };
    }
    async function createModelProvider(payload) {
      try {
        if (!payload.apiKey) {
          throw new AppError("API Key \u4E0D\u80FD\u4E3A\u7A7A", 400);
        }
        const row = await repository.createModelProvider(normalizeProviderPayload(payload));
        return normalizeDisplayProvider(row);
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u6A21\u578B\u914D\u7F6E\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function updateModelProvider(id, payload) {
      try {
        const existing = await repository.getModelProviderById(id);
        if (!existing) {
          throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
        }
        const row = await repository.updateModelProvider(id, normalizeProviderPayload(payload, existing));
        if (!row) {
          throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
        }
        return normalizeDisplayProvider(row);
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u6A21\u578B\u914D\u7F6E\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function deleteModelProvider(id) {
      const deleted = await repository.deleteModelProvider(id);
      if (!deleted) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
    }
    async function testModelProvider(payload) {
      const runtimePayload = await resolveRuntimePayload(payload);
      const extraConfig = runtimePayload.extraConfig || {};
      try {
        if (runtimePayload.providerType === "anthropic") {
          return await testAnthropicProvider(runtimePayload, extraConfig);
        }
        return await testOpenAICompatibleProvider(runtimePayload, extraConfig);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(`\u6A21\u578B\u6D4B\u8BD5\u5931\u8D25: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
      }
    }
    async function generateChatCompletion(providerConfig, messages, options = {}) {
      const runtimeProvider = normalizeRuntimeProvider(providerConfig);
      if (!runtimeProvider) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      if (runtimeProvider.status !== "active") {
        throw new AppError("\u5F53\u524D\u6A21\u578B\u914D\u7F6E\u672A\u542F\u7528", 400);
      }
      if (runtimeProvider.modelCategory !== "chat") {
        throw new AppError("\u5F53\u524D\u6A21\u578B\u914D\u7F6E\u4E0D\u662F\u5BF9\u8BDD\u6A21\u578B", 400);
      }
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new AppError("\u6D88\u606F\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      const extraConfig = runtimeProvider.extraConfig || {};
      try {
        if (runtimeProvider.providerType === "anthropic") {
          return await generateAnthropicCompletion(runtimeProvider, messages, options, extraConfig);
        }
        if (resolveInferenceWireApi(extraConfig) === "responses") {
          return await generateResponsesCompletion(runtimeProvider, messages, options, extraConfig);
        }
        return await generateOpenAICompatibleCompletion(runtimeProvider, messages, options, extraConfig);
      } catch (error) {
        if (error?.name === "AbortError") {
          throw error;
        }
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(`\u6A21\u578B\u8C03\u7528\u5931\u8D25: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
      }
    }
    async function generateChatCompletionStream(providerConfig, messages, options = {}, onDelta) {
      const runtimeProvider = normalizeRuntimeProvider(providerConfig);
      if (!runtimeProvider) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      if (runtimeProvider.status !== "active") {
        throw new AppError("\u5F53\u524D\u6A21\u578B\u914D\u7F6E\u672A\u542F\u7528", 400);
      }
      if (runtimeProvider.modelCategory !== "chat") {
        throw new AppError("\u5F53\u524D\u6A21\u578B\u914D\u7F6E\u4E0D\u662F\u5BF9\u8BDD\u6A21\u578B", 400);
      }
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new AppError("\u6D88\u606F\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      const extraConfig = runtimeProvider.extraConfig || {};
      try {
        if (runtimeProvider.providerType === "anthropic") {
          return await generateAnthropicCompletionStream(runtimeProvider, messages, options, extraConfig, onDelta);
        }
        if (resolveInferenceWireApi(extraConfig) === "responses") {
          return await generateResponsesCompletionStream(runtimeProvider, messages, options, extraConfig, onDelta);
        }
        return await generateOpenAICompatibleCompletionStream(runtimeProvider, messages, options, extraConfig, onDelta);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
      }
    }
    async function testOpenAICompatibleProvider(payload, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "model_list");
      const timeoutMs = Number(extraConfig.timeoutMs || 2e4);
      const { models, checkedEndpoint } = await fetchRemoteModelList({
        providerType: payload.providerType,
        baseUrl,
        headers,
        timeoutMs,
        extraConfig
      });
      const modelCatalog = buildModelCatalogFromRemoteModels(models);
      return {
        success: true,
        message: "\u6A21\u578B\u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F\uFF0C\u5DF2\u62C9\u53D6\u6A21\u578B\u5217\u8868",
        providerType: payload.providerType,
        modelName: null,
        modelVersion: null,
        checkedEndpoint,
        models,
        modelCatalog
      };
    }
    async function generateOpenAICompatibleCompletion(payload, messages, options, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const endpointCandidates = buildInferenceEndpoints(baseUrl, "chat/completions", payload.providerType, extraConfig);
      const body = buildChatCompletionsRequestBody(payload, messages, options, extraConfig);
      const { data, checkedEndpoint, adapted } = await requestOpenAICompatibleJson(
        endpointCandidates,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: options.signal
        },
        timeoutMs,
        (parsed) => Boolean(extractOpenAICompatibleContent(parsed)),
        "\u6A21\u578B\u8C03\u7528\u5931\u8D25",
        {
          disableAdaptiveRetry: Boolean(options.disableAdaptiveRetry),
          primaryEndpointOnly: Boolean(options.primaryEndpointOnly)
        }
      );
      const content = extractOpenAICompatibleContent(data);
      if (!content) {
        throw buildModelCallAppError("\u6A21\u578B\u8C03\u7528\u5931\u8D25", checkedEndpoint, endpointCandidates, 200, data, adapted, {
          contentMissing: true
        });
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: {
          ...data,
          checkedEndpoint,
          adapted
        }
      };
    }
    async function generateOpenAICompatibleCompletionStream(payload, messages, options, extraConfig, onDelta) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const endpointCandidates = buildInferenceEndpoints(baseUrl, "chat/completions", payload.providerType, extraConfig);
      const body = buildChatCompletionsRequestBody(payload, messages, options, extraConfig, true);
      const { response, checkedEndpoint } = await requestOpenAICompatibleStreamDetailed(
        endpointCandidates,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: options.signal
        },
        timeoutMs
      );
      const decoder = new TextDecoder("utf-8");
      const reader = response.body.getReader();
      let content = "";
      let buffer = "";
      let streamErrorMessage = "";
      async function consumeFrame(rawFrame) {
        const line = String(rawFrame || "").trim();
        if (!line) return;
        const dataText = line.startsWith("data:") ? line.slice(5).trim() : line;
        if (!dataText || dataText === "[DONE]") return;
        let parsed;
        try {
          parsed = JSON.parse(dataText);
        } catch {
          return;
        }
        const parsedError = extractErrorMessage(parsed);
        if (parsedError) {
          streamErrorMessage = parsedError;
        }
        const choice = Array.isArray(parsed?.choices) ? parsed.choices[0] : null;
        const deltaValue = choice?.delta?.content;
        const deltaText = typeof deltaValue === "string" ? deltaValue : Array.isArray(deltaValue) ? deltaValue.map((item) => typeof item?.text === "string" ? item.text : "").join("") : extractOpenAICompatibleContent(parsed);
        if (deltaText) {
          content += deltaText;
          if (typeof onDelta === "function") {
            await onDelta(deltaText);
          }
        }
      }
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          await consumeFrame(frame);
        }
      }
      buffer += decoder.decode();
      await consumeFrame(buffer);
      if (!content) {
        throw buildModelCallAppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25", checkedEndpoint, buildInferenceEndpoints(baseUrl, "chat/completions", payload.providerType), 200, streamErrorMessage ? { error: streamErrorMessage } : {}, null, {
          contentMissing: true,
          interfaceLabel: "OpenAI chat.completions"
        });
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: null
      };
    }
    async function generateResponsesCompletion(payload, messages, options, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const endpointCandidates = buildInferenceEndpoints(baseUrl, "responses", payload.providerType, extraConfig);
      const body = buildResponsesRequestBody(payload, messages, options, extraConfig);
      const { data, checkedEndpoint, adapted } = await requestOpenAICompatibleJson(
        endpointCandidates,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: options.signal
        },
        timeoutMs,
        (parsed) => Boolean(extractResponsesContent(parsed)),
        "\u6A21\u578B\u8C03\u7528\u5931\u8D25",
        {
          interfaceLabel: "OpenAI Responses API",
          disableAdaptiveRetry: Boolean(options.disableAdaptiveRetry),
          primaryEndpointOnly: Boolean(options.primaryEndpointOnly)
        }
      );
      const content = extractResponsesContent(data);
      if (!content) {
        throw buildModelCallAppError("\u6A21\u578B\u8C03\u7528\u5931\u8D25", checkedEndpoint, endpointCandidates, 200, data, adapted, {
          contentMissing: true,
          interfaceLabel: "OpenAI Responses API"
        });
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: {
          ...data,
          checkedEndpoint,
          adapted
        }
      };
    }
    async function generateResponsesCompletionStream(payload, messages, options, extraConfig, onDelta) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const endpointCandidates = buildInferenceEndpoints(baseUrl, "responses", payload.providerType, extraConfig);
      const body = buildResponsesRequestBody(payload, messages, options, extraConfig, true);
      const { response, checkedEndpoint } = await requestOpenAICompatibleStreamDetailed(
        endpointCandidates,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: options.signal
        },
        timeoutMs
      );
      const { content, finalResponse } = await readResponsesSseStream(response, onDelta);
      if (!content) {
        throw buildModelCallAppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25", checkedEndpoint, endpointCandidates, 200, finalResponse || {}, null, {
          contentMissing: true,
          interfaceLabel: "OpenAI Responses API"
        });
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: finalResponse || null
      };
    }
    async function testAnthropicProvider(payload, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const timeoutMs = Number(extraConfig.timeoutMs || 2e4);
      const headers = mergeExtraHeaders({
        "Content-Type": "application/json",
        "x-api-key": payload.apiKey,
        "anthropic-version": extraConfig.anthropicVersion || "2023-06-01"
      }, extraConfig, "model_list");
      const { models, checkedEndpoint } = await fetchRemoteModelList({
        providerType: payload.providerType,
        baseUrl,
        headers,
        timeoutMs,
        extraConfig
      });
      const modelCatalog = buildModelCatalogFromRemoteModels(models);
      return {
        success: true,
        message: "\u6A21\u578B\u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F\uFF0C\u5DF2\u62C9\u53D6\u6A21\u578B\u5217\u8868",
        providerType: payload.providerType,
        modelName: null,
        modelVersion: null,
        checkedEndpoint,
        models,
        modelCatalog
      };
    }
    async function generateAnthropicCompletion(payload, messages, options, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const systemMessage = messages.find((item) => item.role === "system")?.content || "";
      const userMessages = messages.filter((item) => item.role !== "system").map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content
      }));
      const response = await fetchWithTimeoutRespectAbort(
        `${baseUrl}/v1/messages`,
        {
          method: "POST",
          headers: mergeExtraHeaders({
            "Content-Type": "application/json",
            "x-api-key": payload.apiKey,
            "anthropic-version": extraConfig.anthropicVersion || "2023-06-01"
          }, extraConfig, "inference"),
          body: JSON.stringify({
            model: payload.modelName,
            system: systemMessage || void 0,
            max_tokens: options.maxTokens ?? 1200,
            messages: userMessages
          }),
          signal: options.signal
        },
        timeoutMs
      );
      const data = await parseJsonSafely(response);
      if (!response.ok) {
        throw new AppError(`\u6A21\u578B\u8C03\u7528\u5931\u8D25: ${extractErrorMessage(data) || response.statusText}`, 400);
      }
      const content = extractAnthropicContent(data);
      if (!content) {
        throw new AppError("\u6A21\u578B\u8C03\u7528\u5931\u8D25: \u672A\u8FD4\u56DE\u6709\u6548\u5185\u5BB9", 400);
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: data
      };
    }
    async function generateAnthropicCompletionStream(payload, messages, options, extraConfig, onDelta) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const systemMessage = messages.find((item) => item.role === "system")?.content || "";
      const userMessages = messages.filter((item) => item.role !== "system").map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content
      }));
      const response = await fetchWithTimeout(
        `${baseUrl}/v1/messages`,
        {
          method: "POST",
          headers: mergeExtraHeaders({
            "Content-Type": "application/json",
            "x-api-key": payload.apiKey,
            "anthropic-version": extraConfig.anthropicVersion || "2023-06-01"
          }, extraConfig, "inference"),
          body: JSON.stringify({
            model: payload.modelName,
            system: systemMessage || void 0,
            max_tokens: options.maxTokens ?? 1200,
            messages: userMessages,
            stream: true
          }),
          signal: options.signal
        },
        timeoutMs
      );
      if (!response.ok) {
        const data = await parseJsonSafely(response);
        throw new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${extractErrorMessage(data) || response.statusText}`, 400);
      }
      if (!response.body) {
        throw new AppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: \u672A\u8FD4\u56DE\u6709\u6548\u6D41", 400);
      }
      const decoder = new TextDecoder("utf-8");
      const reader = response.body.getReader();
      let content = "";
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          const dataText = line.slice(5).trim();
          if (!dataText || dataText === "[DONE]") continue;
          let parsed;
          try {
            parsed = JSON.parse(dataText);
          } catch {
            continue;
          }
          const deltaText = parsed?.delta?.text || parsed?.content_block?.text || "";
          if (deltaText) {
            content += deltaText;
            if (typeof onDelta === "function") {
              await onDelta(deltaText);
            }
          }
        }
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: null
      };
    }
    function buildInferenceEndpoints(baseUrl, resourcePath, providerType = "", extraConfig = {}) {
      const defaultEndpoints = buildDefaultInferenceEndpoints(baseUrl, resourcePath, providerType);
      return resolveEndpointCandidates(baseUrl, defaultEndpoints, extraConfig, getInferenceEndpointConfigKeys(resourcePath), "inference");
    }
    function buildDefaultInferenceEndpoints(baseUrl, resourcePath, providerType = "") {
      const normalizedBaseUrl = String(baseUrl).replace(/\/+$/, "");
      if (/\/v1$/i.test(normalizedBaseUrl)) {
        return [`${normalizedBaseUrl}/${resourcePath}`];
      }
      if (String(providerType).toLowerCase() === "custom") {
        return [`${normalizedBaseUrl}/v1/${resourcePath}`, `${normalizedBaseUrl}/${resourcePath}`];
      }
      return [`${normalizedBaseUrl}/${resourcePath}`, `${normalizedBaseUrl}/v1/${resourcePath}`];
    }
    function getInferenceEndpointConfigKeys(resourcePath = "") {
      const keys = [
        "inferencePath",
        "inference_path",
        "endpoints.inference"
      ];
      if (resourcePath === "responses") {
        keys.push("responsesPath", "responses_path", "endpoints.responses");
      }
      if (resourcePath === "chat/completions") {
        keys.push("chatCompletionsPath", "chat_completions_path", "endpoints.chatCompletions", "endpoints.chat_completions");
      }
      return keys;
    }
    function resolveEndpointCandidates(baseUrl, defaultEndpoints, extraConfig, configKeys, scope = "inference") {
      const configuredEndpoints = resolveConfiguredEndpoints(extraConfig, configKeys).map((item) => resolveEndpointUrl(baseUrl, item)).filter(Boolean);
      const disableFallback = resolveDisableFallback(extraConfig, scope);
      if (configuredEndpoints.length) {
        return [...new Set(disableFallback ? configuredEndpoints : [...configuredEndpoints, ...defaultEndpoints])];
      }
      if (disableFallback && defaultEndpoints.length > 1) {
        return [...new Set(defaultEndpoints.slice(0, 1))];
      }
      return [...new Set(defaultEndpoints)];
    }
    function resolveConfiguredEndpoints(extraConfig = {}, configKeys = []) {
      const rawValue = resolveConfigValue(extraConfig, configKeys);
      if (Array.isArray(rawValue)) {
        return rawValue.map((item) => String(item || "").trim()).filter(Boolean);
      }
      if (typeof rawValue === "string") {
        const trimmed = rawValue.trim();
        if (!trimmed) {
          return [];
        }
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              return parsed.map((item) => String(item || "").trim()).filter(Boolean);
            }
          } catch {
            return [trimmed];
          }
        }
        return [trimmed];
      }
      if (isPlainObject(rawValue)) {
        const candidate = rawValue.url || rawValue.path || rawValue.endpoint;
        return candidate ? [String(candidate).trim()].filter(Boolean) : [];
      }
      return [];
    }
    function resolveEndpointUrl(baseUrl, rawEndpoint) {
      const endpoint = String(rawEndpoint || "").trim();
      if (!endpoint) {
        return "";
      }
      if (/^https?:\/\//i.test(endpoint)) {
        return endpoint.replace(/\/+$/, "");
      }
      const normalizedBaseUrl = String(baseUrl || "").replace(/\/+$/, "");
      if (!normalizedBaseUrl) {
        return endpoint;
      }
      try {
        return new URL(endpoint, `${normalizedBaseUrl}/`).toString().replace(/\/+$/, "");
      } catch {
        return `${normalizedBaseUrl}/${endpoint.replace(/^\/+/, "")}`;
      }
    }
    function resolveDisableFallback(extraConfig = {}, scope = "inference") {
      const scopeKeys = scope === "model_list" ? [
        "disableModelListFallback",
        "disable_model_list_fallback",
        "endpoints.disableModelListFallback",
        "endpoints.disable_model_list_fallback"
      ] : [
        "disableInferenceFallback",
        "disable_inference_fallback",
        "endpoints.disableInferenceFallback",
        "endpoints.disable_inference_fallback"
      ];
      const scopedValue = resolveBooleanConfig(extraConfig, scopeKeys);
      if (typeof scopedValue === "boolean") {
        return scopedValue;
      }
      return resolveBooleanConfig(extraConfig, [
        "disableFallbackEndpoints",
        "disable_fallback_endpoints",
        "endpoints.disableFallback",
        "endpoints.disable_fallback"
      ]) === true;
    }
    function resolveBooleanConfig(extraConfig = {}, keys = []) {
      const rawValue = resolveConfigValue(extraConfig, keys);
      if (rawValue === void 0) {
        return void 0;
      }
      if (typeof rawValue === "boolean") {
        return rawValue;
      }
      if (typeof rawValue === "number") {
        return rawValue !== 0;
      }
      if (typeof rawValue === "string") {
        const normalized = rawValue.trim().toLowerCase();
        if (!normalized) {
          return void 0;
        }
        if (["true", "1", "yes", "on"].includes(normalized)) {
          return true;
        }
        if (["false", "0", "no", "off"].includes(normalized)) {
          return false;
        }
      }
      return Boolean(rawValue);
    }
    function resolveConfigValue(source, keyPaths = []) {
      for (const keyPath of keyPaths) {
        const resolved = resolveConfigPathValue(source, keyPath);
        if (resolved !== void 0) {
          return resolved;
        }
      }
      return void 0;
    }
    function resolveConfigPathValue(source, keyPath) {
      const segments = String(keyPath || "").split(".").filter(Boolean);
      let current = source;
      for (const segment of segments) {
        if (!current || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, segment)) {
          return void 0;
        }
        current = current[segment];
      }
      return current;
    }
    async function requestOpenAICompatibleJson(endpointCandidates, init, timeoutMs, validator, errorPrefix, errorOptions = {}) {
      let lastError = null;
      const activeEndpointCandidates = errorOptions.primaryEndpointOnly ? endpointCandidates.slice(0, 1) : endpointCandidates;
      for (const endpoint of activeEndpointCandidates) {
        const adaptiveInit = errorOptions.disableAdaptiveRetry ? null : buildAdaptiveRetryInit(init);
        try {
          const response = await fetchWithTimeoutRespectAbort(endpoint, init, timeoutMs);
          const data = await parseJsonSafely(response);
          if (!response.ok) {
            if (adaptiveInit && shouldRetrySameModel(response.status, data)) {
              const retried = await tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator);
              if (retried) {
                return { ...retried, adapted: true };
              }
            }
            lastError = buildModelCallAppError(errorPrefix, endpoint, activeEndpointCandidates, response.status, data, adaptiveInit, errorOptions);
            continue;
          }
          if (typeof validator === "function" && !validator(data)) {
            if (adaptiveInit) {
              const retried = await tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator);
              if (retried) {
                return { ...retried, adapted: true };
              }
            }
            lastError = buildModelCallAppError(errorPrefix, endpoint, activeEndpointCandidates, response.status, data, adaptiveInit, {
              ...errorOptions,
              contentMissing: true
            });
            continue;
          }
          return {
            data,
            checkedEndpoint: endpoint,
            adapted: false
          };
        } catch (error) {
          if (error?.name === "AbortError") {
            throw error;
          }
          if (adaptiveInit && shouldRetrySameModel(void 0, { error: error?.message || error })) {
            const retried = await tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator);
            if (retried) {
              return { ...retried, adapted: true };
            }
          }
          lastError = buildModelCallAppError(errorPrefix, endpoint, activeEndpointCandidates, void 0, { error: error?.message || error }, adaptiveInit, errorOptions);
        }
      }
      if (lastError instanceof AppError) {
        throw lastError;
      }
      throw new AppError(`${errorPrefix}: ${lastError?.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
    }
    async function tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator) {
      try {
        const response = await fetchWithTimeout(endpoint, adaptiveInit, timeoutMs);
        const data = await parseJsonSafely(response);
        if (!response.ok) {
          return null;
        }
        if (typeof validator === "function" && !validator(data)) {
          return null;
        }
        return {
          data,
          checkedEndpoint: endpoint
        };
      } catch {
        return null;
      }
    }
    function buildAdaptiveRetryInit(init) {
      const bodyText = typeof init?.body === "string" ? init.body : "";
      if (!bodyText) {
        return null;
      }
      try {
        const parsed = JSON.parse(bodyText);
        const nextBody = { ...parsed };
        let changed = false;
        if (typeof nextBody.max_tokens === "number" && nextBody.max_tokens > 512) {
          nextBody.max_tokens = 512;
          changed = true;
        }
        if (typeof nextBody.max_output_tokens === "number" && nextBody.max_output_tokens > 512) {
          nextBody.max_output_tokens = 512;
          changed = true;
        }
        if (typeof nextBody.temperature === "number" && nextBody.temperature > 0.1) {
          nextBody.temperature = 0.1;
          changed = true;
        }
        if (nextBody.response_format) {
          delete nextBody.response_format;
          changed = true;
        }
        if (nextBody.text && typeof nextBody.text === "object" && !Array.isArray(nextBody.text) && nextBody.text.format) {
          nextBody.text = { ...nextBody.text };
          delete nextBody.text.format;
          if (Object.keys(nextBody.text).length === 0) {
            delete nextBody.text;
          }
          changed = true;
        }
        if (!changed) {
          return null;
        }
        return {
          ...init,
          body: JSON.stringify(nextBody)
        };
      } catch {
        return null;
      }
    }
    function shouldRetrySameModel(status, data) {
      const normalizedError = String(extractErrorMessage(data) || data?.raw || data?.error || "").toLowerCase();
      return status === 502 || status === 503 || status === 504 || normalizedError.includes("timeout") || normalizedError.includes("timed out") || normalizedError.includes("\u8D85\u65F6") || normalizedError.includes("terminated") || normalizedError.includes("bad gateway") || normalizedError.includes("<!doctype html>") || normalizedError.includes("<html");
    }
    function buildModelCallAppError(errorPrefix, attemptedEndpoint, endpointCandidates, status, data, adaptiveInit, options = {}) {
      const rawText = typeof data?.raw === "string" ? data.raw : "";
      const extractedMessage = extractErrorMessage(data) || rawText || (status ? `HTTP ${status}` : "unknown error");
      const lowerMessage = String(extractedMessage).toLowerCase();
      const suggestions = [];
      const interfaceLabel = options.interfaceLabel || "OpenAI chat.completions";
      if (lowerMessage.includes("<!doctype html>") || lowerMessage.includes("<html")) {
        suggestions.push("\u63A5\u53E3\u8FD4\u56DE\u4E86 HTML \u9875\u9762\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u5730\u5740\u662F\u5426\u5E94\u5305\u542B /v1\uFF0C\u6216\u786E\u8BA4\u8BE5\u5730\u5740\u786E\u5B9E\u662F OpenAI \u517C\u5BB9 API\u3002");
      }
      if (status === 502 || status === 503 || status === 504 || lowerMessage.includes("terminated") || lowerMessage.includes("bad gateway")) {
        suggestions.push("\u4E0A\u6E38\u7F51\u5173\u4E2D\u65AD\u4E86\u5F53\u524D\u8BF7\u6C42\uFF0C\u5EFA\u8BAE\u7F29\u77ED\u8F93\u5165\u4E0A\u4E0B\u6587\u3001\u51CF\u5C11\u8FD4\u56DE\u957F\u5EA6\uFF0C\u6216\u7A0D\u540E\u91CD\u8BD5\u3002");
      }
      if (options.contentMissing) {
        suggestions.push("\u6A21\u578B\u5DF2\u8FD4\u56DE\u54CD\u5E94\uFF0C\u4F46\u5F53\u524D\u8FD4\u56DE\u7ED3\u6784\u672A\u88AB\u8BC6\u522B\u4E3A\u6709\u6548\u5185\u5BB9\uFF0C\u8BF7\u68C0\u67E5\u7F51\u5173\u8FD4\u56DE\u683C\u5F0F\u662F\u5426\u5B8C\u5168\u517C\u5BB9 OpenAI chat.completions\u3002");
      }
      if (adaptiveInit) {
        suggestions.push("\u7CFB\u7EDF\u5DF2\u5C1D\u8BD5\u4F7F\u7528\u540C\u6A21\u578B\u7684\u4FDD\u5B88\u53C2\u6570\u91CD\u8BD5\u4E00\u6B21\uFF1A\u964D\u4F4E max_tokens\u3001\u964D\u4F4E temperature\uFF0C\u5E76\u79FB\u9664 response_format\u3002");
      }
      return new AppError(`${errorPrefix}: ${extractedMessage}`, 400, {
        attemptedEndpoint,
        endpointCandidates,
        suggestions,
        recommendedMaxTokens: 512
      });
    }
    async function requestOpenAICompatibleStreamDetailed(endpointCandidates, init, timeoutMs) {
      let lastError = null;
      for (const endpoint of endpointCandidates) {
        try {
          const response = await fetchWithTimeout(endpoint, init, timeoutMs);
          if (!response.ok) {
            const data = await parseJsonSafely(response);
            lastError = buildModelCallAppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25", endpoint, endpointCandidates, response.status, data, null, {
              interfaceLabel: "OpenAI chat.completions"
            });
            continue;
          }
          const contentType = String(response.headers.get("content-type") || "").toLowerCase();
          if (contentType.includes("text/html")) {
            const data = await parseJsonSafely(response);
            lastError = new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${extractErrorMessage(data) || "\u63A5\u53E3\u8FD4\u56DE HTML \u9875\u9762"}`, 400);
            continue;
          }
          if (!response.body) {
            lastError = new AppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: \u672A\u8FD4\u56DE\u6709\u6548\u6D41", 400);
            continue;
          }
          return {
            response,
            checkedEndpoint: endpoint
          };
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError instanceof AppError) {
        throw lastError;
      }
      throw new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${lastError?.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
    }
    async function fetchRemoteModelList({ providerType, baseUrl, headers, timeoutMs, extraConfig }) {
      const endpointCandidates = buildModelListEndpoints(providerType, baseUrl, extraConfig);
      let lastError = null;
      for (const endpoint of endpointCandidates) {
        try {
          const response = await fetchWithTimeout(
            endpoint,
            {
              method: "GET",
              headers
            },
            timeoutMs
          );
          const data = await parseJsonSafely(response);
          if (!response.ok) {
            lastError = new AppError(`\u6A21\u578B\u5217\u8868\u83B7\u53D6\u5931\u8D25: ${extractErrorMessage(data) || response.statusText}`, 400);
            continue;
          }
          const models = normalizeRemoteModelList(data);
          if (!models.length) {
            lastError = new AppError("\u6A21\u578B\u5217\u8868\u83B7\u53D6\u5931\u8D25: \u8FDC\u7AEF\u672A\u8FD4\u56DE\u53EF\u7528\u6A21\u578B\u5217\u8868", 400);
            continue;
          }
          return {
            checkedEndpoint: endpoint,
            models
          };
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError instanceof AppError) {
        throw lastError;
      }
      throw new AppError(`\u6A21\u578B\u5217\u8868\u83B7\u53D6\u5931\u8D25: ${lastError?.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
    }
    function buildModelListEndpoints(providerType, baseUrl, extraConfig = {}) {
      const endpoints = [];
      const normalizedProviderType = String(providerType || "").toLowerCase();
      if (normalizedProviderType === "anthropic") {
        endpoints.push(`${baseUrl}/v1/models`);
        return resolveEndpointCandidates(baseUrl, endpoints, extraConfig, [
          "modelListPath",
          "model_list_path",
          "endpoints.modelList",
          "endpoints.model_list"
        ], "model_list");
      }
      if (normalizedProviderType === "azure_openai") {
        const apiVersion = String(extraConfig.apiVersion || "2024-10-21");
        endpoints.push(`${baseUrl}/openai/models?api-version=${encodeURIComponent(apiVersion)}`);
        endpoints.push(`${baseUrl}/openai/deployments?api-version=${encodeURIComponent(apiVersion)}`);
      }
      if (normalizedProviderType === "custom") {
        if (/\/v1$/i.test(baseUrl)) {
          endpoints.push(`${baseUrl}/models`);
        } else {
          endpoints.push(`${baseUrl}/v1/models`);
          endpoints.push(`${baseUrl}/models`);
        }
        return resolveEndpointCandidates(baseUrl, endpoints, extraConfig, [
          "modelListPath",
          "model_list_path",
          "endpoints.modelList",
          "endpoints.model_list"
        ], "model_list");
      }
      endpoints.push(`${baseUrl}/models`);
      if (!/\/v1$/i.test(baseUrl)) {
        endpoints.push(`${baseUrl}/v1/models`);
      }
      return resolveEndpointCandidates(baseUrl, endpoints, extraConfig, [
        "modelListPath",
        "model_list_path",
        "endpoints.modelList",
        "endpoints.model_list"
      ], "model_list");
    }
    function normalizeRemoteModelList(data) {
      const source = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : Array.isArray(data?.result) ? data.result : Array.isArray(data?.items) ? data.items : [];
      const models = source.map((item) => normalizeRemoteModel(item)).filter(Boolean);
      const unique = /* @__PURE__ */ new Map();
      models.forEach((item) => {
        if (!unique.has(item.value)) {
          unique.set(item.value, item);
        }
      });
      return Array.from(unique.values());
    }
    function normalizeRemoteModel(item) {
      if (typeof item === "string") {
        return { value: item, label: item };
      }
      if (!item || typeof item !== "object") {
        return null;
      }
      const value = String(item.id || item.name || item.model || item.model_name || item.deployment_id || item.deploymentId || "").trim();
      if (!value) {
        return null;
      }
      const displayName = String(item.display_name || item.displayName || item.name || item.id || item.model || value).trim();
      return {
        value,
        label: displayName === value ? value : `${displayName} (${value})`
      };
    }
    function buildOpenAICompatibleHeaders(payload, extraConfig, scope = "inference") {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${payload.apiKey}`
      };
      if (payload.organizationId && payload.providerType === "openai") {
        headers["OpenAI-Organization"] = payload.organizationId;
      }
      if (payload.providerType === "azure_openai") {
        delete headers.Authorization;
        headers["api-key"] = payload.apiKey;
      }
      return mergeExtraHeaders(headers, extraConfig, scope);
    }
    function mergeExtraHeaders(baseHeaders, extraConfig, scope = "inference") {
      const commonHeaders = resolveConfiguredHeaders(extraConfig, [
        "defaultHeaders",
        "default_headers",
        "headers.default",
        "headers.common",
        "headers"
      ]);
      const scopedHeaders = scope === "model_list" ? resolveConfiguredHeaders(extraConfig, [
        "modelListHeaders",
        "model_list_headers",
        "headers.modelList",
        "headers.model_list"
      ]) : resolveConfiguredHeaders(extraConfig, [
        "inferenceHeaders",
        "inference_headers",
        "requestHeaders",
        "request_headers",
        "headers.inference"
      ]);
      return mergeHeaderMaps(baseHeaders, commonHeaders, scopedHeaders);
    }
    function resolveConfiguredHeaders(extraConfig, keyPaths = []) {
      const rawValue = resolveConfigValue(extraConfig, keyPaths);
      return isHeaderMapObject(rawValue) ? rawValue : {};
    }
    function isHeaderMapObject(headers) {
      if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
        return false;
      }
      return Object.values(headers).every((value) => value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean");
    }
    function mergeHeaderMaps(...headerMaps) {
      const merged = /* @__PURE__ */ new Map();
      headerMaps.forEach((headers) => {
        if (!isHeaderMapObject(headers)) {
          return;
        }
        Object.entries(headers).forEach(([key, value]) => {
          const headerKey = String(key || "").trim();
          if (!headerKey) {
            return;
          }
          const normalizedHeaderKey = headerKey.toLowerCase();
          if (value == null) {
            merged.delete(normalizedHeaderKey);
            return;
          }
          merged.set(normalizedHeaderKey, {
            key: headerKey,
            value: String(value)
          });
        });
      });
      return Array.from(merged.values()).reduce((result, item) => {
        result[item.key] = item.value;
        return result;
      }, {});
    }
    function isPlainObject(value) {
      return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }
    function parseConfigObject(value) {
      if (isPlainObject(value)) {
        return value;
      }
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        return null;
      }
      try {
        const parsed = JSON.parse(trimmed);
        return isPlainObject(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    function cloneConfigValue(value) {
      if (Array.isArray(value)) {
        return value.map((item) => cloneConfigValue(item));
      }
      if (isPlainObject(value)) {
        return Object.entries(value).reduce((result, [key, itemValue]) => {
          result[key] = cloneConfigValue(itemValue);
          return result;
        }, {});
      }
      return value;
    }
    function mergeConfigObjects(target, override) {
      const base = isPlainObject(target) ? cloneConfigValue(target) : {};
      const nextOverride = parseConfigObject(override);
      if (!nextOverride) {
        return base;
      }
      Object.entries(nextOverride).forEach(([key, value]) => {
        if (value == null) {
          delete base[key];
          return;
        }
        if (isPlainObject(base[key]) && isPlainObject(value)) {
          base[key] = mergeConfigObjects(base[key], value);
          return;
        }
        base[key] = cloneConfigValue(value);
      });
      return base;
    }
    function normalizeBaseUrl(baseUrl) {
      if (!baseUrl) {
        throw new AppError("\u63A5\u53E3\u5730\u5740\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      return String(baseUrl).replace(/\/+$/, "");
    }
    async function fetchWithTimeout(url, init, timeoutMs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } catch (error) {
        if (error.name === "AbortError") {
          throw new AppError("\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u3001\u63A5\u53E3\u5730\u5740\u6216\u9274\u6743\u4FE1\u606F", 400);
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
    async function fetchWithTimeoutRespectAbort(url, init, timeoutMs) {
      const controller = new AbortController();
      const externalSignal = init?.signal;
      let abortedByCaller = false;
      const handleExternalAbort = () => {
        abortedByCaller = true;
        controller.abort();
      };
      if (externalSignal) {
        if (externalSignal.aborted) {
          abortedByCaller = true;
          controller.abort();
        } else {
          externalSignal.addEventListener("abort", handleExternalAbort, { once: true });
        }
      }
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } catch (error) {
        if (error.name === "AbortError") {
          if (abortedByCaller) {
            throw error;
          }
          throw new AppError("\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u3001\u63A5\u53E3\u5730\u5740\u6216\u9274\u6743\u4FE1\u606F", 400);
        }
        throw error;
      } finally {
        clearTimeout(timer);
        if (externalSignal) {
          externalSignal.removeEventListener("abort", handleExternalAbort);
        }
      }
    }
    async function parseJsonSafely(response) {
      const text = await response.text();
      if (!text) {
        return {};
      }
      try {
        return JSON.parse(text);
      } catch (error) {
        return { raw: text };
      }
    }
    function extractErrorMessage(data) {
      if (!data) {
        return "";
      }
      if (typeof data.message === "string") {
        return sanitizeErrorText(data.message);
      }
      if (typeof data.error === "string") {
        return sanitizeErrorText(data.error);
      }
      if (data.error && typeof data.error.message === "string") {
        return sanitizeErrorText(data.error.message);
      }
      const choice = Array.isArray(data.choices) ? data.choices[0] : null;
      const message = choice?.message || {};
      const content = typeof message.content === "string" ? message.content.trim() : "";
      const reasoningContent = typeof message.reasoning_content === "string" ? message.reasoning_content.trim() : "";
      if (!content && reasoningContent) {
        return choice?.finish_reason === "length" ? "\u6A21\u578B\u7684\u601D\u8003\u4EE4\u724C\u5DF2\u8017\u5C3D\uFF0C\u5C1A\u672A\u751F\u6210\u6700\u7EC8\u7B54\u6848\uFF1B\u8BF7\u5173\u95ED\u6DF1\u5EA6\u601D\u8003\u6216\u63D0\u9AD8\u8F93\u51FA Token \u4E0A\u9650" : "\u6A21\u578B\u4EC5\u8FD4\u56DE\u4E86\u601D\u8003\u8FC7\u7A0B\uFF0C\u672A\u751F\u6210\u6700\u7EC8\u7B54\u6848\uFF1B\u8BF7\u68C0\u67E5\u6DF1\u5EA6\u601D\u8003\u53C2\u6570\u4E0E\u8F93\u51FA Token \u4E0A\u9650";
      }
      if (typeof data.raw === "string") {
        return sanitizeErrorText(data.raw);
      }
      return "";
    }
    function sanitizeErrorText(value) {
      const raw = String(value || "");
      if (!raw) return "";
      const lower = raw.toLowerCase();
      if (lower.includes("<!doctype html>") || lower.includes("<html")) {
        return "\u63A5\u53E3\u8FD4\u56DE HTML \u9875\u9762\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u5730\u5740\u662F\u5426\u4E3A OpenAI \u517C\u5BB9 API\uFF08\u901A\u5E38\u9700\u8981 /v1\uFF09\u3002";
      }
      return raw.replace(/\s+/g, " ").trim().slice(0, 300);
    }
    function extractOpenAICompatibleContent(data) {
      const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
      const messageContent = choice?.message?.content;
      if (typeof messageContent === "string") {
        return messageContent;
      }
      if (messageContent && typeof messageContent === "object" && !Array.isArray(messageContent)) {
        return JSON.stringify(messageContent);
      }
      if (Array.isArray(messageContent)) {
        const text = messageContent.map((item) => {
          if (typeof item?.text === "string") return item.text;
          if (typeof item?.output_text === "string") return item.output_text;
          if (item && typeof item === "object" && item?.json && typeof item.json === "object") return JSON.stringify(item.json);
          return "";
        }).filter(Boolean).join("\n");
        if (text) return text;
        const firstJsonLike = messageContent.find((item) => item && typeof item === "object" && !Array.isArray(item));
        if (firstJsonLike) return JSON.stringify(firstJsonLike);
      }
      if (typeof choice?.text === "string") {
        return choice.text;
      }
      return "";
    }
    function extractResponsesContent(data) {
      if (typeof data?.output_text === "string" && data.output_text.trim()) {
        return data.output_text;
      }
      const output = Array.isArray(data?.output) ? data.output : [];
      return output.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        if (Array.isArray(item.content)) return item.content;
        return [item];
      }).map((item) => {
        if (typeof item?.text === "string") return item.text;
        if (typeof item?.output_text === "string") return item.output_text;
        if (typeof item?.refusal === "string") return item.refusal;
        if (item && typeof item === "object" && item?.json && typeof item.json === "object") return JSON.stringify(item.json);
        return "";
      }).filter(Boolean).join("\n");
    }
    function resolveInferenceWireApi(extraConfig = {}) {
      const wireApi = String(extraConfig?.wireApi || extraConfig?.wire_api || "").trim().toLowerCase();
      return wireApi === "responses" ? "responses" : "chat_completions";
    }
    function buildChatCompletionsRequestBody(payload, messages, options, extraConfig, stream = false) {
      const body = {
        model: payload.modelName,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1200
      };
      if (stream) {
        body.stream = true;
      }
      if (options.responseFormat) {
        body.response_format = options.responseFormat;
      }
      return applyReasoningRequestControls(
        applyInferenceRequestBodyOverrides(body, extraConfig, "chat_completions"),
        payload,
        options,
        "chat_completions"
      );
    }
    function buildResponsesRequestBody(payload, messages, options, extraConfig, stream = false) {
      const inputMode = resolveResponsesInputMode(extraConfig);
      const body = {
        model: payload.modelName,
        input: buildResponsesInput(messages, inputMode),
        temperature: options.temperature ?? 0.2,
        max_output_tokens: options.maxTokens ?? 1200
      };
      const instructions = buildResponsesInstructions(messages, inputMode);
      if (instructions) {
        body.instructions = instructions;
      }
      if (stream) {
        body.stream = true;
      }
      const textFormat = normalizeResponsesTextFormat(options.responseFormat);
      if (textFormat) {
        body.text = { format: textFormat };
      }
      if (resolveBooleanConfig(extraConfig, [
        "disableResponseStorage",
        "disable_response_storage",
        "responses.disableResponseStorage",
        "responses.disable_response_storage"
      ]) === true) {
        body.store = false;
      }
      return applyReasoningRequestControls(
        applyInferenceRequestBodyOverrides(body, extraConfig, "responses"),
        payload,
        options,
        "responses"
      );
    }
    function resolveReasoningProviderFamily(payload = {}) {
      const providerType = String(payload.providerType || "").trim().toLowerCase();
      const identity = [payload.baseUrl, payload.modelName, payload.modelVersion, payload.configName, payload.configCode].map((item) => String(item || "").toLowerCase()).join(" ");
      if (providerType === "deepseek" || identity.includes("deepseek")) return "deepseek";
      if (providerType === "qwen" || identity.includes("qwen") || identity.includes("dashscope")) return "qwen";
      if (providerType === "openai" || providerType === "azure_openai") return "openai";
      if (/\b(gpt|o1|o3|o4)[-_a-z0-9.]*/i.test(identity) || identity.includes("openai")) return "openai";
      return null;
    }
    function normalizeReasoningEffort(value, family) {
      const normalized = String(value || "medium").trim().toLowerCase();
      const supported = /* @__PURE__ */ new Set(["low", "medium", "high", "xhigh", "max"]);
      const effort = supported.has(normalized) ? normalized : "medium";
      if (family === "deepseek") {
        if (effort === "low") return "low";
        if (effort === "max" || effort === "xhigh") return "max";
        return "high";
      }
      return effort;
    }
    function applyReasoningRequestControls(body, payload, options = {}, protocol = "chat_completions") {
      if (typeof options.thinkingEnabled !== "boolean") return body;
      const family = resolveReasoningProviderFamily(payload);
      if (!family) return body;
      const enabled = options.thinkingEnabled;
      const effort = normalizeReasoningEffort(options.reasoningEffort, family);
      const thinkingBudget = Number(options.thinkingBudget || 0);
      if (family === "qwen") {
        body.enable_thinking = enabled;
        if (enabled && Number.isInteger(thinkingBudget) && thinkingBudget > 0) {
          body.thinking_budget = thinkingBudget;
        } else {
          delete body.thinking_budget;
        }
        return body;
      }
      if (protocol === "responses") {
        body.reasoning = {
          ...body.reasoning && typeof body.reasoning === "object" ? body.reasoning : {},
          effort: enabled ? effort : "none"
        };
        return body;
      }
      if (family === "deepseek") {
        body.thinking = { type: enabled ? "enabled" : "disabled" };
        if (enabled) body.reasoning_effort = effort;
        else delete body.reasoning_effort;
        return body;
      }
      body.reasoning_effort = enabled ? effort : "none";
      return body;
    }
    function buildReasoningOptions(config = {}) {
      const rawThinkingEnabled = config.thinkingEnabled ?? config.thinking_enabled;
      return {
        thinkingEnabled: rawThinkingEnabled === void 0 || rawThinkingEnabled === null ? void 0 : Boolean(rawThinkingEnabled),
        reasoningEffort: config.reasoningEffort || config.reasoning_effort || "medium",
        thinkingBudget: config.thinkingBudget ?? config.thinking_budget ?? null
      };
    }
    function applyInferenceRequestBodyOverrides(body, extraConfig, protocol) {
      const commonOverride = resolveConfiguredObject(extraConfig, [
        "requestBody",
        "request_body",
        "inferenceBody",
        "inference_body",
        "body.request",
        "body.inference"
      ]);
      const protocolOverride = protocol === "responses" ? resolveConfiguredObject(extraConfig, [
        "responsesBody",
        "responses_body",
        "body.responses"
      ]) : resolveConfiguredObject(extraConfig, [
        "chatCompletionsBody",
        "chat_completions_body",
        "body.chatCompletions",
        "body.chat_completions"
      ]);
      return mergeConfigObjects(mergeConfigObjects(body, commonOverride), protocolOverride);
    }
    function resolveConfiguredObject(extraConfig, keyPaths = []) {
      return parseConfigObject(resolveConfigValue(extraConfig, keyPaths)) || {};
    }
    function resolveResponsesInputMode(extraConfig = {}) {
      const rawValue = resolveConfigValue(extraConfig, [
        "responsesInputMode",
        "responses_input_mode",
        "responses.inputMode",
        "responses.input_mode"
      ]);
      const normalizedValue = String(rawValue || "").trim().toLowerCase();
      if (["string", "text", "instructions"].includes(normalizedValue)) {
        return normalizedValue;
      }
      return "messages";
    }
    function buildResponsesInput(messages, inputMode = "messages") {
      const sourceMessages = Array.isArray(messages) ? messages : [];
      if (inputMode === "string" || inputMode === "text") {
        return serializeMessagesToPrompt(sourceMessages);
      }
      if (inputMode === "instructions") {
        return normalizeResponsesInput(sourceMessages.filter((item) => {
          const normalizedRole = normalizeResponsesRole(item?.role);
          return normalizedRole !== "system" && normalizedRole !== "developer";
        }));
      }
      return normalizeResponsesInput(sourceMessages);
    }
    function buildResponsesInstructions(messages, inputMode = "messages") {
      if (inputMode !== "instructions") {
        return "";
      }
      return (Array.isArray(messages) ? messages : []).filter((item) => {
        const normalizedRole = normalizeResponsesRole(item?.role);
        return normalizedRole === "system" || normalizedRole === "developer";
      }).map((item) => stringifyContentForPrompt(item?.content)).filter(Boolean).join("\n\n");
    }
    function normalizeResponsesInput(messages) {
      return (Array.isArray(messages) ? messages : []).map((item) => ({
        role: normalizeResponsesRole(item?.role),
        content: normalizeResponsesContent(item?.content)
      }));
    }
    function normalizeResponsesRole(role) {
      const normalizedRole = String(role || "user").trim().toLowerCase();
      if (["assistant", "system", "developer"].includes(normalizedRole)) {
        return normalizedRole;
      }
      return "user";
    }
    function normalizeResponsesContent(content) {
      if (typeof content === "string") {
        return content;
      }
      if (Array.isArray(content)) {
        const items = content.map((item) => {
          if (typeof item === "string") {
            return { type: "input_text", text: item };
          }
          if (!item || typeof item !== "object") {
            return null;
          }
          if ((item.type === "text" || item.type === "input_text" || item.type === "output_text") && typeof item.text === "string") {
            return { type: "input_text", text: item.text };
          }
          if (item.type === "image_url" && typeof item?.image_url?.url === "string") {
            return { type: "input_image", image_url: item.image_url.url };
          }
          if (item.type === "input_image" && typeof item.image_url === "string") {
            return { type: "input_image", image_url: item.image_url };
          }
          return null;
        }).filter(Boolean);
        if (items.length) {
          return items;
        }
      }
      if (content && typeof content === "object") {
        return JSON.stringify(content);
      }
      return String(content || "");
    }
    function serializeMessagesToPrompt(messages) {
      return (Array.isArray(messages) ? messages : []).map((item) => {
        const content = stringifyContentForPrompt(item?.content);
        if (!content) {
          return "";
        }
        return `${normalizeResponsesRole(item?.role)}:
${content}`;
      }).filter(Boolean).join("\n\n");
    }
    function stringifyContentForPrompt(content) {
      if (typeof content === "string") {
        return content;
      }
      if (Array.isArray(content)) {
        return content.map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (!item || typeof item !== "object") {
            return "";
          }
          if (typeof item.text === "string") {
            return item.text;
          }
          if (typeof item.output_text === "string") {
            return item.output_text;
          }
          if (typeof item.refusal === "string") {
            return item.refusal;
          }
          if (item.type === "image_url" && typeof item?.image_url?.url === "string") {
            return `[image] ${item.image_url.url}`;
          }
          if (item.type === "input_image" && typeof item.image_url === "string") {
            return `[image] ${item.image_url}`;
          }
          return isPlainObject(item) ? JSON.stringify(item) : "";
        }).filter(Boolean).join("\n");
      }
      if (content && typeof content === "object") {
        return JSON.stringify(content);
      }
      return String(content || "");
    }
    function normalizeResponsesTextFormat(responseFormat) {
      if (!responseFormat || typeof responseFormat !== "object" || Array.isArray(responseFormat)) {
        return null;
      }
      const formatType = String(responseFormat.type || "").trim();
      if (!formatType) {
        return null;
      }
      return { ...responseFormat };
    }
    async function readResponsesSseStream(response, onDelta) {
      if (!response.body) {
        throw new AppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: \u672A\u8FD4\u56DE\u6709\u6548\u6D41", 400);
      }
      const decoder = new TextDecoder("utf-8");
      const reader = response.body.getReader();
      let content = "";
      let buffer = "";
      let eventName = "";
      let dataLines = [];
      let finalResponse = null;
      const flushEvent = async () => {
        const rawData = dataLines.join("\n").trim();
        const currentEventName = eventName.trim();
        eventName = "";
        dataLines = [];
        if (!rawData || rawData === "[DONE]") {
          return;
        }
        let parsed;
        try {
          parsed = JSON.parse(rawData);
        } catch {
          return;
        }
        const eventType = currentEventName || parsed?.type || "";
        if (eventType === "response.error" || parsed?.error) {
          throw new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${extractErrorMessage(parsed) || "\u672A\u77E5\u9519\u8BEF"}`, 400);
        }
        if (eventType === "response.completed") {
          finalResponse = parsed?.response || parsed;
          return;
        }
        const deltaText = extractResponsesStreamDelta(eventType, parsed);
        if (deltaText) {
          content += deltaText;
          if (typeof onDelta === "function") {
            await onDelta(deltaText);
          }
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const rawLine of lines) {
          const line = rawLine.trimEnd();
          if (!line) {
            await flushEvent();
            continue;
          }
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
            continue;
          }
          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }
      }
      await flushEvent();
      if (!content && finalResponse) {
        content = extractResponsesContent(finalResponse);
      }
      return {
        content,
        finalResponse
      };
    }
    function extractResponsesStreamDelta(eventType, payload) {
      if ((eventType === "response.output_text.delta" || payload?.type === "response.output_text.delta") && typeof payload?.delta === "string") {
        return payload.delta;
      }
      if ((eventType === "response.refusal.delta" || payload?.type === "response.refusal.delta") && typeof payload?.delta === "string") {
        return payload.delta;
      }
      return "";
    }
    function extractAnthropicContent(data) {
      if (!Array.isArray(data?.content)) {
        return "";
      }
      return data.content.map((item) => item?.type === "text" && typeof item.text === "string" ? item.text : "").filter(Boolean).join("\n");
    }
    module2.exports = {
      applyModelSelection,
      buildReasoningOptions,
      listModelProviders,
      getModelProviderById,
      getActiveChatModelProviders,
      normalizeRuntimeProvider,
      createModelProvider,
      updateModelProvider,
      deleteModelProvider,
      testModelProvider,
      generateChatCompletion,
      generateChatCompletionStream
    };
  }
});

// backend/src/modules/asset-search/asset-search.ai.js
var require_asset_search_ai = __commonJS({
  "backend/src/modules/asset-search/asset-search.ai.js"(exports2, module2) {
    var modelProviderService = require_model_provider_service();
    var ASSET_TYPES = [
      "table",
      "field",
      "datasource",
      "ingestion_task",
      "quality_rule",
      "quality_strategy",
      "quality_result",
      "service_api",
      "service_app"
    ];
    var SOURCE_MODULES = ["data_map", "ingestion", "quality", "services"];
    var SCENE_CODES = {
      interpretation: "asset_search_query_interpretation",
      expansion: "asset_search_query_expansion",
      rerank: "asset_search_result_rerank",
      summary: "asset_search_result_summary"
    };
    var DEFAULT_PROMPTS = {
      interpretation: [
        "\u4F60\u662F\u4F01\u4E1A\u8D44\u4EA7\u68C0\u7D22\u7684\u67E5\u8BE2\u7406\u89E3\u52A9\u624B\u3002",
        "\u53EA\u80FD\u7406\u89E3\u7528\u6237\u68C0\u7D22\u9700\u6C42\uFF0C\u4E0D\u80FD\u67E5\u8BE2\u6570\u636E\u5E93\uFF0C\u4E0D\u80FD\u751F\u6210 SQL\uFF0C\u4E0D\u80FD\u7F16\u9020\u8D44\u4EA7\u3002",
        "\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown\u3002",
        "\u5B57\u6BB5\u56FA\u5B9A\u4E3A intent\u3001assetTypes\u3001sourceModules\u3001keywords\u3001chineseKeywords\u3001englishKeywords\u3001fieldKeywords\u3002"
      ].join("\n"),
      expansion: [
        "\u4F60\u662F\u4F01\u4E1A\u8D44\u4EA7\u68C0\u7D22\u7684\u5173\u952E\u8BCD\u6269\u5C55\u52A9\u624B\u3002",
        "\u53EA\u80FD\u8F93\u51FA\u68C0\u7D22\u5173\u952E\u8BCD\uFF0C\u4E0D\u80FD\u67E5\u8BE2\u6570\u636E\u5E93\uFF0C\u4E0D\u80FD\u751F\u6210 SQL\uFF0C\u4E0D\u80FD\u7F16\u9020\u8D44\u4EA7\u3002",
        "\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown\u3002",
        "\u5B57\u6BB5\u56FA\u5B9A\u4E3A expandedKeywords\u3001fieldKeywords\u3001tableKeywords\u3001serviceKeywords\u3002"
      ].join("\n"),
      rerank: [
        "\u4F60\u662F\u4F01\u4E1A\u8D44\u4EA7\u68C0\u7D22\u7684\u5019\u9009\u7ED3\u679C\u91CD\u6392\u52A9\u624B\u3002",
        "\u53EA\u80FD\u57FA\u4E8E\u8F93\u5165\u5019\u9009\u8D44\u4EA7\u6392\u5E8F\uFF0C\u4E0D\u80FD\u65B0\u589E\u5019\u9009\u5916\u8D44\u4EA7\uFF0C\u4E0D\u80FD\u751F\u6210 SQL\u3002",
        "\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown\u3002",
        "\u5B57\u6BB5\u56FA\u5B9A\u4E3A rankedResults\uFF0C\u6570\u7EC4\u9879\u5B57\u6BB5\u4E3A id\u3001score\u3001reason\u3001relevant\u3002",
        "relevant \u8868\u793A\u5019\u9009\u662F\u5426\u6EE1\u8DB3\u7528\u6237\u68C0\u7D22\u610F\u56FE\uFF1B\u4E0D\u76F8\u5173\u5019\u9009\u5FC5\u987B relevant=false \u4E14 score<=20\u3002"
      ].join("\n"),
      summary: [
        "\u4F60\u662F\u4F01\u4E1A\u8D44\u4EA7\u68C0\u7D22\u7684\u7ED3\u679C\u603B\u7ED3\u52A9\u624B\u3002",
        "\u53EA\u80FD\u603B\u7ED3\u8F93\u5165\u7ED3\u679C\uFF0C\u4E0D\u80FD\u751F\u6210\u5019\u9009\u4E4B\u5916\u7684\u8D44\u4EA7\uFF0C\u4E0D\u80FD\u751F\u6210 SQL\u3002",
        "\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown\u3002",
        "\u5B57\u6BB5\u56FA\u5B9A\u4E3A summary\u3001suggestions\u3001recommendedResults\u3002"
      ].join("\n")
    };
    var CONTEXT_KEYS = [
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
      "issueCount"
    ];
    var STAGE_RUNTIME_GUARDRAILS = {
      rerank: [
        "\u8FD0\u884C\u65F6\u5F3A\u7EA6\u675F\uFF1ArankedResults \u6BCF\u9879\u5FC5\u987B\u8FD4\u56DE id\u3001score\u3001reason\u3001relevant\u3002",
        "\u5982\u679C\u5019\u9009\u4E0E\u7528\u6237\u9700\u6C42\u65E0\u5173\u3001\u4E0D\u6EE1\u8DB3\u5173\u952E\u6761\u4EF6\u3001\u65E0\u6CD5\u652F\u6491\u95EE\u9898\u6216\u53EA\u662F\u540C\u4E49\u8BCD\u8BEF\u53EC\u56DE\uFF0C\u5FC5\u987B\u8BBE\u7F6E relevant=false\uFF0Cscore \u4E0D\u9AD8\u4E8E 20\u3002",
        "\u4E0D\u76F8\u5173\u5019\u9009\u4E0D\u80FD\u4F5C\u4E3A\u63A8\u8350\u7ED3\u679C\uFF1Breason \u5E94\u7B80\u77ED\u8BF4\u660E\u4E3A\u4EC0\u4E48\u4E0D\u76F8\u5173\u3002"
      ].join("\n")
    };
    function truncate(value, maxLength = 220) {
      const text = String(value || "").replace(/\s+/g, " ").trim();
      if (text.length <= maxLength) return text;
      return `${text.slice(0, maxLength)}...`;
    }
    function uniqueStrings(values = [], limit = 30) {
      const result = [];
      const seen = /* @__PURE__ */ new Set();
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
      const rawItems = Array.isArray(value) ? value : String(value || "").split(/[,，、;\s]+/).map((item) => item.trim()).filter(Boolean);
      return uniqueStrings(rawItems, max).filter((item) => !allowed || allowed.has(item));
    }
    function extractJsonObject(text) {
      const normalized = String(text || "").replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
      const firstBrace = normalized.indexOf("{");
      if (firstBrace < 0) {
        throw new Error("\u6A21\u578B\u54CD\u5E94\u4E2D\u672A\u627E\u5230 JSON \u5BF9\u8C61");
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
        if (char === '"') {
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
      throw new Error("\u6A21\u578B\u54CD\u5E94\u4E2D\u672A\u627E\u5230\u5B8C\u6574 JSON \u5BF9\u8C61");
    }
    function parseJsonObjectWithRecovery(text) {
      try {
        const parsed2 = JSON.parse(String(text || "{}"));
        if (parsed2 && typeof parsed2 === "object" && !Array.isArray(parsed2)) return parsed2;
      } catch {
      }
      const parsed = JSON.parse(extractJsonObject(text));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("\u6A21\u578B\u54CD\u5E94\u4E0D\u662F JSON \u5BF9\u8C61");
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
          modelVersion: config.defaultModelVersion || provider.modelVersion || config.defaultModelName || provider.modelName
        }
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
        maxTokens: Number(config.maxTokens || defaults.maxTokens || 1e3),
        timeoutMs: Number(config.timeoutMs || defaults.timeoutMs || 3e4),
        responseFormat: { type: "json_object" }
      };
    }
    function buildJsonMessages(systemPrompt, payload) {
      return [
        {
          role: "system",
          content: `${systemPrompt}

Return valid JSON only. The response must be a JSON object.`
        },
        {
          role: "user",
          content: JSON.stringify(payload, null, 2)
        }
      ];
    }
    async function callJsonStage(stageRuntime, stage, payload, defaults = {}) {
      if (!stageRuntime) return null;
      const basePrompt = stageRuntime.config.systemPrompt || DEFAULT_PROMPTS[stage] || "\u53EA\u8F93\u51FA JSON \u5BF9\u8C61\u3002";
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
        allowedSourceModules: SOURCE_MODULES
      };
    }
    async function runQueryEnhancement(criteria, runtime) {
      let interpretation = {};
      let expansion = {};
      const usedStages = [];
      if (runtime.interpretation) {
        interpretation = await callJsonStage(runtime.interpretation, "interpretation", buildCriteriaPayload(criteria), {
          maxTokens: 900,
          temperature: 0.1
        });
        usedStages.push(SCENE_CODES.interpretation);
      }
      if (runtime.expansion) {
        expansion = await callJsonStage(runtime.expansion, "expansion", {
          ...buildCriteriaPayload(criteria),
          interpretation
        }, {
          maxTokens: 700,
          temperature: 0.1
        });
        usedStages.push(SCENE_CODES.expansion);
      }
      const expandedKeywords = uniqueStrings([
        ...criteria.keywordTerms || [],
        ...normalizeStringArray(interpretation.keywords, { max: 12 }),
        ...normalizeStringArray(interpretation.chineseKeywords, { max: 12 }),
        ...normalizeStringArray(interpretation.englishKeywords, { max: 12 }),
        ...normalizeStringArray(interpretation.fieldKeywords, { max: 12 }),
        ...normalizeStringArray(expansion.expandedKeywords, { max: 12 }),
        ...normalizeStringArray(expansion.fieldKeywords, { max: 12 }),
        ...normalizeStringArray(expansion.tableKeywords, { max: 12 }),
        ...normalizeStringArray(expansion.serviceKeywords, { max: 12 })
      ], 30);
      return {
        intent: truncate(interpretation.intent || (criteria.keyword ? `\u68C0\u7D22\u4E0E\u201C${criteria.keyword}\u201D\u76F8\u5173\u7684\u8D44\u4EA7` : "\u6309\u7B5B\u9009\u6761\u4EF6\u68C0\u7D22\u8D44\u4EA7"), 300),
        expandedKeywords,
        inferredAssetTypes: normalizeStringArray(interpretation.assetTypes, { allowed: ASSET_TYPES, max: 8 }),
        inferredSourceModules: normalizeStringArray(interpretation.sourceModules, { allowed: SOURCE_MODULES, max: 4 }),
        usedStages
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
          text: truncate(item.text, 180)
        })),
        context: compactContext(result.context || {})
      };
    }
    function normalizeRankedResults(value, whitelist) {
      const rows = Array.isArray(value) ? value : [];
      const seen = /* @__PURE__ */ new Set();
      const output = [];
      for (const item of rows) {
        const id = String(item?.id || "").trim();
        if (!id || seen.has(id) || !whitelist.has(id)) continue;
        seen.add(id);
        output.push({
          id,
          score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
          reason: truncate(item.reason, 240),
          relevant: normalizeRelevanceFlag(item)
        });
      }
      return output;
    }
    function normalizeRelevanceFlag(item = {}) {
      const value = item.relevant ?? item.isRelevant ?? item.related ?? item.isRelated;
      if (typeof value === "boolean") return value;
      const normalized = String(value || "").trim().toLowerCase();
      if (["true", "yes", "y", "1", "\u76F8\u5173", "\u662F", "\u5339\u914D"].includes(normalized)) return true;
      if (["false", "no", "n", "0", "\u4E0D\u76F8\u5173", "\u65E0\u5173", "\u5426", "\u4E0D\u5339\u914D"].includes(normalized)) return false;
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
        candidates
      }, {
        maxTokens: 1400,
        temperature: 0.1
      });
      const ranked = normalizeRankedResults(parsed.rankedResults, whitelist).sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
      if (ranked.length === 0) {
        return { results, usedStages: [SCENE_CODES.rerank] };
      }
      const rankedById = new Map(ranked.map((item) => [item.id, item]));
      const maxBaseScore = Math.max(...results.map((item) => Number(item.score || 0)), 1);
      const ordered = results.filter((result) => whitelist.has(result.id)).map((result) => {
        const item = rankedById.get(result.id);
        const modelScore = clampScore(item?.score);
        const normalizedBaseScore = Number(result.score || 0) / maxBaseScore * 100;
        const aiBlendScore = modelScore === null ? normalizedBaseScore * 0.8 : normalizedBaseScore * 0.8 + modelScore * 0.2;
        return {
          ...result,
          context: {
            ...result.context || {},
            ...item?.reason ? { aiReason: item.reason } : {},
            ...modelScore === null ? {} : { aiScore: modelScore },
            ...item?.relevant === null || item?.relevant === void 0 ? {} : { aiRelevant: item.relevant },
            aiBlendScore: Number(aiBlendScore.toFixed(2))
          }
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
        usedStages: [SCENE_CODES.rerank]
      };
    }
    function normalizeRecommendedResults(value, whitelist) {
      const rows = Array.isArray(value) ? value : [];
      const seen = /* @__PURE__ */ new Set();
      const output = [];
      for (const item of rows) {
        const id = String(item?.id || "").trim();
        if (!id || seen.has(id) || !whitelist.has(id)) continue;
        seen.add(id);
        output.push({
          id,
          reason: truncate(item.reason, 240)
        });
      }
      return output.slice(0, 8);
    }
    function buildDeterministicSummary(criteria, results, queryInsight) {
      const byType = results.reduce((acc, item) => {
        acc[item.assetType] = (acc[item.assetType] || 0) + 1;
        return acc;
      }, {});
      const topTypes = Object.entries(byType).sort((left, right) => right[1] - left[1]).slice(0, 4).map(([type, count]) => `${type} ${count} \u4E2A`);
      return {
        enabled: true,
        intent: queryInsight.intent || (criteria.keyword ? `\u68C0\u7D22\u4E0E\u201C${criteria.keyword}\u201D\u76F8\u5173\u7684\u8D44\u4EA7` : "\u6309\u7B5B\u9009\u6761\u4EF6\u68C0\u7D22\u8D44\u4EA7"),
        expandedKeywords: queryInsight.expandedKeywords || [],
        summary: results.length > 0 ? `\u57FA\u4E8E\u6388\u6743\u5019\u9009\u8D44\u4EA7\u5B8C\u6210\u68C0\u7D22\uFF0C\u5171\u627E\u5230 ${results.length} \u4E2A\u7ED3\u679C${topTypes.length ? `\uFF0C\u4E3B\u8981\u5305\u62EC ${topTypes.join("\u3001")}` : ""}\u3002` : "\u57FA\u4E8E\u6388\u6743\u5019\u9009\u8D44\u4EA7\u5B8C\u6210\u68C0\u7D22\uFF0C\u5F53\u524D\u6761\u4EF6\u6CA1\u6709\u53EC\u56DE\u7ED3\u679C\u3002",
        suggestions: results.length > 0 ? ["\u4F18\u5148\u67E5\u770B\u547D\u4E2D\u539F\u56E0\u6700\u660E\u786E\u7684\u7ED3\u679C\u3002", "\u5982\u7ED3\u679C\u8FC7\u591A\uFF0C\u53EF\u7EE7\u7EED\u9650\u5B9A\u8D44\u4EA7\u7C7B\u578B\u3001\u6765\u6E90\u6A21\u5757\u6216\u6570\u636E\u6E90\u3002"] : ["\u5C1D\u8BD5\u6539\u7528\u66F4\u77ED\u7684\u5B57\u6BB5\u540D\u3001\u4E1A\u52A1\u5173\u952E\u8BCD\u6216\u82F1\u6587\u5217\u540D\u3002"],
        recommendedResults: results.slice(0, 5).map((item) => ({
          id: item.id,
          reason: item.context?.aiReason || item.highlights?.[0]?.text || "\u666E\u901A\u53EC\u56DE\u5F97\u5206\u9760\u524D"
        }))
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
        results: candidates
      }, {
        maxTokens: 1200,
        temperature: 0.2
      });
      return {
        ai: {
          ...base,
          summary: truncate(parsed.summary || base.summary, 1200),
          suggestions: normalizeStringArray(parsed.suggestions, { max: 8 }).length ? normalizeStringArray(parsed.suggestions, { max: 8 }) : base.suggestions,
          recommendedResults: normalizeRecommendedResults(parsed.recommendedResults, whitelist).length ? normalizeRecommendedResults(parsed.recommendedResults, whitelist) : base.recommendedResults
        },
        usedStages: [SCENE_CODES.summary]
      };
    }
    module2.exports = {
      SCENE_CODES,
      hasConfiguredStage,
      rerankResults,
      resolveRuntime,
      runQueryEnhancement,
      summarizeResults
    };
  }
});

// backend/src/modules/asset-search/adapters/data-map.adapter.js
var require_data_map_adapter = __commonJS({
  "backend/src/modules/asset-search/adapters/data-map.adapter.js"(exports2, module2) {
    var repository = require_asset_search_repository();
    async function search(criteria) {
      const [tables, fields, dataSources] = await Promise.all([
        repository.searchDataMapTables(criteria),
        repository.searchDataMapFields(criteria),
        repository.searchDataMapDataSources(criteria)
      ]);
      return [...tables, ...fields, ...dataSources];
    }
    module2.exports = {
      search
    };
  }
});

// backend/src/modules/asset-search/adapters/ingestion.adapter.js
var require_ingestion_adapter = __commonJS({
  "backend/src/modules/asset-search/adapters/ingestion.adapter.js"(exports2, module2) {
    var repository = require_asset_search_repository();
    async function search(criteria) {
      const [dataSources, tasks, researchTables, researchFields] = await Promise.all([
        repository.searchIngestionDataSources(criteria),
        repository.searchIngestionTasks(criteria),
        repository.searchIngestionResearchTables(criteria),
        repository.searchIngestionResearchFields(criteria)
      ]);
      return [...dataSources, ...tasks, ...researchTables, ...researchFields];
    }
    module2.exports = {
      search
    };
  }
});

// backend/src/modules/asset-search/adapters/quality.adapter.js
var require_quality_adapter = __commonJS({
  "backend/src/modules/asset-search/adapters/quality.adapter.js"(exports2, module2) {
    var repository = require_asset_search_repository();
    async function search(criteria) {
      const [dataSources, tables, rules, strategies, results] = await Promise.all([
        repository.searchQualityDataSources(criteria),
        repository.searchQualityMonitorTables(criteria),
        repository.searchQualityRules(criteria),
        repository.searchQualityStrategies(criteria),
        repository.searchQualityResults(criteria)
      ]);
      return [...dataSources, ...tables, ...rules, ...strategies, ...results];
    }
    module2.exports = {
      search
    };
  }
});

// backend/src/modules/asset-search/adapters/services.adapter.js
var require_services_adapter = __commonJS({
  "backend/src/modules/asset-search/adapters/services.adapter.js"(exports2, module2) {
    var repository = require_asset_search_repository();
    async function search(criteria) {
      const [dataSources, apis, apps] = await Promise.all([
        repository.searchServiceDataSources(criteria),
        repository.searchServiceApis(criteria),
        repository.searchServiceApps(criteria)
      ]);
      return [...dataSources, ...apis, ...apps];
    }
    module2.exports = {
      search
    };
  }
});

// backend/src/services/hiveService.js
var require_hiveService = __commonJS({
  "backend/src/services/hiveService.js"(exports2, module2) {
    var hive = require("hive-driver");
    var { resolveDatasourceConnection } = require_datasource_dialect();
    var DEFAULT_HIVE_HOST = process.env.HIVE_HOST || "hive";
    var DEFAULT_HIVE_PORT = Number(process.env.HIVE_PORT || 1e4);
    var DEFAULT_HIVE_TIMEOUT_MS = Number(process.env.HIVE_TIMEOUT_MS || 3e5);
    function normalizeConnectionConfig(config = {}) {
      const source = config.connectionConfig || config;
      const resolved = resolveDatasourceConnection(source.sourceType || "hive", source);
      return {
        host: resolved.host || source.host || DEFAULT_HIVE_HOST,
        port: Number(resolved.port || source.port || DEFAULT_HIVE_PORT),
        database: resolved.database || source.database || "default",
        username: resolved.username || source.username || "hive",
        password: resolved.password || source.password || "hive",
        authType: String(source.authType || source.auth || source.authentication || "plain").toLowerCase()
      };
    }
    function escapeHiveIdentifier(identifier) {
      return String(identifier || "").split(".").filter(Boolean).map((part) => `\`${String(part).replace(/`/g, "``")}\``).join(".");
    }
    function normalizeHiveType(value) {
      const normalized = String(value || "string").trim().toLowerCase();
      if (!normalized) {
        return "STRING";
      }
      if (normalized.includes("bigint")) {
        return "BIGINT";
      }
      if (normalized.includes("smallint") || normalized.includes("tinyint") || normalized === "int" || normalized.includes("integer")) {
        return "INT";
      }
      if (normalized.includes("double")) {
        return "DOUBLE";
      }
      if (normalized.includes("float")) {
        return "FLOAT";
      }
      if (normalized.includes("boolean")) {
        return "BOOLEAN";
      }
      if (normalized.includes("timestamp")) {
        return "TIMESTAMP";
      }
      if (normalized === "date") {
        return "DATE";
      }
      if (normalized.startsWith("decimal") || normalized.startsWith("numeric")) {
        const match = normalized.match(/\(([^)]+)\)/);
        return match ? `DECIMAL(${match[1]})` : "DECIMAL(18,2)";
      }
      return "STRING";
    }
    function escapeHiveComment(value) {
      return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    }
    function buildCreateTableSql(database, tableName, columns, options = {}) {
      const fileType = typeof options === "string" ? options : options.fileType || "parquet";
      const columnSql = columns.map((column) => {
        const comment = String(column.columnComment || "").trim();
        return `  ${escapeHiveIdentifier(column.columnName)} ${normalizeHiveType(column.dataType || column.columnType)}${comment ? ` COMMENT '${escapeHiveComment(comment)}'` : ""}`;
      });
      const storageSql = String(fileType || "parquet").toLowerCase() === "text" ? "ROW FORMAT DELIMITED FIELDS TERMINATED BY '\\t' STORED AS TEXTFILE" : "STORED AS PARQUET";
      const tableComment = typeof options === "object" && options.tableComment ? `COMMENT '${escapeHiveComment(options.tableComment)}' ` : "";
      return [
        `CREATE DATABASE IF NOT EXISTS ${escapeHiveIdentifier(database)};`,
        `USE ${escapeHiveIdentifier(database)};`,
        `CREATE TABLE IF NOT EXISTS ${escapeHiveIdentifier(tableName)} (`,
        columnSql.join(",\n"),
        `) ${tableComment}${storageSql};`
      ].join("\n");
    }
    function splitHiveStatements(sqlText) {
      const statements = [];
      let current = "";
      let quote = null;
      let escaped = false;
      for (const char of String(sqlText || "")) {
        if (escaped) {
          current += char;
          escaped = false;
          continue;
        }
        if (char === "\\") {
          current += char;
          escaped = true;
          continue;
        }
        if (quote) {
          current += char;
          if (char === quote) {
            quote = null;
          }
          continue;
        }
        if (char === "'" || char === '"' || char === "`") {
          current += char;
          quote = char;
          continue;
        }
        if (char === ";") {
          const statement = current.trim();
          if (statement) {
            statements.push(statement);
          }
          current = "";
          continue;
        }
        current += char;
      }
      const tail = current.trim();
      if (tail) {
        statements.push(tail);
      }
      return statements;
    }
    function withTimeout(promise, timeoutMs, label) {
      if (!timeoutMs || timeoutMs <= 0) {
        return promise;
      }
      return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          reject(new Error(`${label}\u8D85\u65F6`));
        }, timeoutMs);
        promise.then((value) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }).catch((error) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          reject(error);
        });
      });
    }
    function createHiveClient(config) {
      const { TCLIService, TCLIService_types } = hive.thrift;
      const connection = new hive.connections.TcpConnection();
      const authProvider = config.authType === "none" || config.authType === "nosasl" ? new hive.auth.NoSaslAuthentication() : new hive.auth.PlainTcpAuthentication({
        username: config.username,
        password: config.password
      });
      const client = new hive.HiveClient(TCLIService, TCLIService_types);
      return {
        client,
        connect: () => client.connect({
          host: config.host,
          port: Number(config.port),
          options: {
            username: config.username,
            password: config.password,
            connect_timeout: DEFAULT_HIVE_TIMEOUT_MS,
            timeout: DEFAULT_HIVE_TIMEOUT_MS
          }
        }, connection, authProvider)
      };
    }
    async function executeHiveStatement(session, utils, statement) {
      const operation = await session.executeStatement(statement, { runAsync: true });
      try {
        await utils.waitUntilReady(operation, false);
        await utils.fetchAll(operation);
        return utils.getResult(operation).getValue();
      } finally {
        await operation.close().catch(() => {
        });
      }
    }
    async function runHiveSql(sqlText, connectionConfig = {}) {
      const config = normalizeConnectionConfig(connectionConfig);
      const statements = splitHiveStatements(sqlText);
      const { TCLIService_types } = hive.thrift;
      const utils = new hive.HiveUtils(TCLIService_types);
      const hiveClient = createHiveClient(config);
      let connectedClient = null;
      let session = null;
      const rows = [];
      try {
        connectedClient = await withTimeout(hiveClient.connect(), DEFAULT_HIVE_TIMEOUT_MS, "Hive \u5BA2\u6237\u7AEF\u8FDE\u63A5");
        session = await connectedClient.openSession({
          client_protocol: TCLIService_types.TProtocolVersion.HIVE_CLI_SERVICE_PROTOCOL_V10
        });
        for (const statement of statements) {
          const result = await withTimeout(
            executeHiveStatement(session, utils, statement),
            DEFAULT_HIVE_TIMEOUT_MS,
            "Hive SQL \u6267\u884C"
          );
          if (Array.isArray(result) && result.length > 0) {
            rows.push(...result);
          }
        }
        return {
          stdout: rows.map((row) => JSON.stringify(row)).join("\n"),
          stderr: "",
          rows
        };
      } catch (error) {
        throw new Error(`Hive SQL \u6267\u884C\u5931\u8D25\uFF1A${error.message}`);
      } finally {
        if (session) {
          await session.close().catch(() => {
          });
        }
        if (connectedClient) {
          connectedClient.close();
        }
      }
    }
    async function tableExists(connectionConfig, tableName) {
      const config = normalizeConnectionConfig(connectionConfig);
      const sql = [
        `USE ${escapeHiveIdentifier(config.database)};`,
        `SHOW TABLES LIKE '${String(tableName || "").replace(/'/g, "\\'")}';`
      ].join("\n");
      const result = await runHiveSql(sql, config);
      return result.stdout.includes(tableName) || result.rows?.some((row) => Object.values(row).some((value) => String(value) === String(tableName)));
    }
    async function ensureTableExists(connectionConfig, tableName, columns, options = {}) {
      const config = normalizeConnectionConfig(connectionConfig);
      const sql = buildCreateTableSql(config.database, tableName, columns, options);
      await runHiveSql(sql, config);
      return { tableName, database: config.database, created: true };
    }
    function buildHiveValueLiteral(value, dataType) {
      const hiveType = normalizeHiveType(dataType);
      if (value === null || value === void 0 || value === "") {
        return "NULL";
      }
      if (["INT", "BIGINT", "FLOAT", "DOUBLE"].includes(hiveType)) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? String(numeric) : "NULL";
      }
      if (hiveType.startsWith("DECIMAL")) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? String(numeric) : "NULL";
      }
      if (hiveType === "BOOLEAN") {
        return value ? "TRUE" : "FALSE";
      }
      return `'${String(value).replace(/'/g, "''")}'`;
    }
    async function loadRows(connectionConfig, tableName, columns, rows, options = {}) {
      const config = normalizeConnectionConfig(connectionConfig);
      const writeMode = String(options.writeMode || "append").toLowerCase();
      const fileType = String(options.fileType || "parquet").toLowerCase();
      const targetColumns = columns.map((column) => ({
        columnName: column.columnName,
        dataType: column.dataType || column.columnType || "string"
      }));
      await ensureTableExists(config, tableName, targetColumns, { fileType });
      if (!Array.isArray(rows) || rows.length === 0) {
        if (writeMode === "overwrite") {
          await runHiveSql(
            [
              `USE ${escapeHiveIdentifier(config.database)};`,
              `TRUNCATE TABLE ${escapeHiveIdentifier(tableName)};`
            ].join("\n"),
            config
          );
        }
        return {
          rowCount: 0,
          writeMode
        };
      }
      const batchSize = Number(options.batchSize || 200);
      const batches = [];
      for (let index = 0; index < rows.length; index += batchSize) {
        batches.push(rows.slice(index, index + batchSize));
      }
      const statements = [`USE ${escapeHiveIdentifier(config.database)};`];
      batches.forEach((batch, index) => {
        const modeSql = writeMode === "overwrite" && index === 0 ? "INSERT OVERWRITE TABLE" : "INSERT INTO TABLE";
        const valuesSql = batch.map((row) => {
          const values = targetColumns.map((column) => buildHiveValueLiteral(row[column.columnName], column.dataType));
          return `(${values.join(", ")})`;
        }).join(",\n");
        statements.push(`${modeSql} ${escapeHiveIdentifier(tableName)} VALUES
${valuesSql};`);
      });
      await runHiveSql(statements.join("\n"), config);
      return {
        rowCount: rows.length,
        writeMode
      };
    }
    module2.exports = {
      normalizeConnectionConfig,
      tableExists,
      ensureTableExists,
      loadRows,
      runHiveSql
    };
  }
});

// backend/src/common/utils/db-client.js
var require_db_client = __commonJS({
  "backend/src/common/utils/db-client.js"(exports2, module2) {
    var { Client: PgClient } = require("pg");
    var OpenGaussClient = require("node-opengauss/lib/core/client");
    function isGaussDbType(value) {
      return String(value || "").trim().toLowerCase() === "gaussdb";
    }
    function createPostgresLikeClient(config = {}, options = {}) {
      const normalized = {
        host: config.host,
        port: Number(config.port || 5432),
        database: config.database,
        user: config.user || config.username,
        username: config.username || config.user,
        password: config.password,
        connectionTimeoutMillis: Number(config.connectionTimeoutMillis || 0) || void 0,
        ssl: config.ssl,
        application_name: config.application_name
      };
      if (isGaussDbType(options.sourceType || options.storageType || options.protocol)) {
        return new OpenGaussClient({
          host: normalized.host,
          port: normalized.port,
          database: normalized.database,
          user: normalized.user,
          password: normalized.password,
          connectionTimeoutMillis: normalized.connectionTimeoutMillis,
          ssl: normalized.ssl,
          application_name: normalized.application_name
        });
      }
      return new PgClient({
        host: normalized.host,
        port: normalized.port,
        database: normalized.database,
        user: normalized.user,
        password: normalized.password,
        connectionTimeoutMillis: normalized.connectionTimeoutMillis,
        ssl: normalized.ssl,
        application_name: normalized.application_name
      });
    }
    module2.exports = {
      createPostgresLikeClient,
      isGaussDbType
    };
  }
});

// backend/src/modules/data-development/adapters/mysql.adapter.js
var require_mysql_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/mysql.adapter.js"(exports2, module2) {
    var mysql = require("mysql2/promise");
    var { applyResultLimit, parseTableName, quoteIdentifier, resolveRuntimeDatasourceConfig } = require_data_development_utils();
    function resolveConnectionConfig(config, databaseName) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      return {
        host: resolved.host,
        port: Number(resolved.port || 3306),
        user: resolved.username,
        password: resolved.password,
        database: databaseName || resolved.databaseName || void 0,
        multipleStatements: false,
        connectTimeout: 1e4
      };
    }
    async function withConnection(config, databaseName, handler) {
      const connection = await mysql.createConnection(resolveConnectionConfig(config, databaseName));
      try {
        return await handler(connection);
      } finally {
        await connection.end();
      }
    }
    module2.exports = {
      async testConnection(config) {
        return withConnection(config, config.databaseName, async (connection) => {
          await connection.query("SELECT 1 AS ok");
          return { success: true, message: "MySQL connection succeeded" };
        });
      },
      async getDatabases(config) {
        return withConnection(config, void 0, async (connection) => {
          const [rows] = await connection.query("SHOW DATABASES");
          return rows.map((row) => ({ name: row.Database }));
        });
      },
      async getTables(config, databaseName) {
        return withConnection(config, databaseName, async (connection) => {
          const scope = databaseName || config.databaseName;
          const [rows] = await connection.query(`
        SELECT table_name AS name,
               table_type AS type,
               table_comment AS comment
        FROM information_schema.tables
        WHERE table_schema = ?
        ORDER BY table_name
      `, [scope]);
          return rows.map((row) => ({
            name: row.name,
            type: row.type || "BASE TABLE",
            comment: row.comment || null
          }));
        });
      },
      async getColumns(config, databaseName, tableName) {
        return withConnection(config, databaseName, async (connection) => {
          const parsed = parseTableName(tableName, databaseName || config.databaseName);
          const [rows] = await connection.query(`SHOW FULL COLUMNS FROM ${quoteIdentifier(parsed.scope ? `${parsed.scope}.${parsed.table}` : parsed.table, "mysql")}`);
          return rows.map((row, index) => ({
            name: row.Field,
            position: index + 1,
            dataType: row.Type,
            columnType: row.Type,
            nullable: row.Null === "YES",
            primaryKey: row.Key === "PRI",
            defaultValue: row.Default,
            comment: row.Comment
          }));
        });
      },
      async getFunctions(config, databaseName) {
        return withConnection(config, databaseName, async (connection) => {
          const scope = databaseName || config.databaseName;
          const [rows] = await connection.query(`
        SELECT routine_name AS name, routine_type AS type, routine_schema AS schemaName
        FROM information_schema.routines
        WHERE routine_schema = ?
        ORDER BY routine_type, routine_name
      `, [scope]);
          return rows.map((row) => ({
            name: row.name,
            type: row.type,
            schema: row.schemaName
          }));
        });
      },
      async executeQuery(config, sql, options = {}) {
        return withConnection(config, options.databaseName || config.databaseName, async (connection) => {
          const normalizedSql = applyResultLimit(sql, options.resultLimit, "mysql");
          const [rows, fields] = await connection.query(normalizedSql);
          return {
            fields: Array.isArray(fields) ? fields.map((field) => field.name) : [],
            rows: Array.isArray(rows) ? rows : [],
            rowCount: Array.isArray(rows) ? rows.length : 0,
            executedSql: normalizedSql
          };
        });
      },
      async executeStatement(config, sql, options = {}) {
        return withConnection(config, options.databaseName || config.databaseName, async (connection) => {
          const normalizedSql = String(sql || "").trim().replace(/;+\s*$/, "");
          const [result] = await connection.query(normalizedSql);
          return {
            affectedRows: Number(result?.affectedRows || 0),
            insertId: Number(result?.insertId || 0),
            warningStatus: Number(result?.warningStatus || 0),
            executedSql: normalizedSql
          };
        });
      }
    };
  }
});

// backend/src/modules/data-development/adapters/postgres.adapter.js
var require_postgres_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/postgres.adapter.js"(exports2, module2) {
    var { applyResultLimit, parseTableName, resolveRuntimeDatasourceConfig } = require_data_development_utils();
    var { createPostgresLikeClient } = require_db_client();
    function escapeSqlString(value) {
      return `'${String(value || "").replace(/'/g, "''")}'`;
    }
    function resolveConnectionConfig(config, databaseName) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      return {
        storageType: resolved.storageType,
        host: resolved.host,
        port: Number(resolved.port || 5432),
        user: resolved.username,
        username: resolved.username,
        password: resolved.password,
        database: databaseName || resolved.databaseName || void 0,
        schema: resolved.schema || "public",
        connectionTimeoutMillis: 1e4
      };
    }
    async function withClient(config, databaseName, handler) {
      const connectionConfig = resolveConnectionConfig(config, databaseName);
      const client = createPostgresLikeClient(connectionConfig, {
        sourceType: connectionConfig.storageType
      });
      await client.connect();
      try {
        return await handler(client);
      } finally {
        await client.end();
      }
    }
    module2.exports = {
      async testConnection(config) {
        return withClient(config, config.databaseName, async (client) => {
          await client.query("SELECT 1 AS ok");
          return { success: true, message: "PostgreSQL connection succeeded" };
        });
      },
      async getDatabases(config) {
        return withClient(config, config.databaseName || "postgres", async (client) => {
          const result = await client.query(`
        SELECT datname
        FROM pg_database
        WHERE datistemplate = false
        ORDER BY datname
      `);
          return result.rows.map((row) => ({ name: row.datname }));
        });
      },
      async getTables(config, databaseName) {
        return withClient(config, databaseName || config.databaseName, async (client) => {
          const connectionConfig = resolveConnectionConfig(config, databaseName || config.databaseName);
          const schemaName = connectionConfig.schema || "public";
          const result = await client.query(`
        SELECT t.table_schema,
               t.table_name,
               t.table_type,
               obj_description((quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass, 'pg_class') AS comment
        FROM information_schema.tables t
        WHERE t.table_schema = ${escapeSqlString(schemaName)}
        ORDER BY table_schema, table_name
      `);
          return result.rows.map((row) => ({
            name: `${row.table_schema}.${row.table_name}`,
            type: row.table_type,
            comment: row.comment || null
          }));
        });
      },
      async getColumns(config, databaseName, tableName) {
        return withClient(config, databaseName || config.databaseName, async (client) => {
          const parsed = parseTableName(tableName, "public");
          const result = await client.query(`
        SELECT column_name, ordinal_position, data_type, udt_name, is_nullable, column_default,
               col_description((quote_ident(table_schema) || '.' || quote_ident(table_name))::regclass::oid, ordinal_position) AS comment
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, [parsed.scope || "public", parsed.table]);
          const pkResult = await client.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      `, [parsed.scope || "public", parsed.table]);
          const primaryKeys = new Set(pkResult.rows.map((row) => row.column_name));
          return result.rows.map((row) => ({
            name: row.column_name,
            position: Number(row.ordinal_position),
            dataType: row.data_type,
            columnType: row.udt_name || row.data_type,
            nullable: row.is_nullable === "YES",
            primaryKey: primaryKeys.has(row.column_name),
            defaultValue: row.column_default,
            comment: row.comment || null
          }));
        });
      },
      async getFunctions(config, databaseName) {
        return withClient(config, databaseName || config.databaseName, async (client) => {
          const connectionConfig = resolveConnectionConfig(config, databaseName || config.databaseName);
          const schemaName = connectionConfig.schema || "public";
          const result = await client.query(`
        SELECT n.nspname AS schema_name,
               p.proname AS routine_name,
               CASE p.prokind
                 WHEN 'p' THEN 'PROCEDURE'
                 ELSE 'FUNCTION'
               END AS routine_type
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = ${escapeSqlString(schemaName)}
        ORDER BY n.nspname, p.proname
      `);
          return result.rows.map((row) => ({
            name: row.routine_name,
            type: row.routine_type,
            schema: row.schema_name
          }));
        });
      },
      async executeQuery(config, sql, options = {}) {
        return withClient(config, options.databaseName || config.databaseName, async (client) => {
          const normalizedSql = applyResultLimit(sql, options.resultLimit, "postgresql");
          const result = await client.query(normalizedSql);
          return {
            fields: result.fields?.map((field) => field.name) || [],
            rows: result.rows || [],
            rowCount: Number(result.rowCount || 0),
            executedSql: normalizedSql
          };
        });
      },
      async executeStatement(config, sql, options = {}) {
        return withClient(config, options.databaseName || config.databaseName, async (client) => {
          const normalizedSql = String(sql || "").trim().replace(/;+\s*$/, "");
          const result = await client.query(normalizedSql);
          return {
            affectedRows: Number(result.rowCount || 0),
            executedSql: normalizedSql
          };
        });
      }
    };
  }
});

// backend/src/modules/data-development/adapters/oracle.adapter.js
var require_oracle_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/oracle.adapter.js"(exports2, module2) {
    var oracledb = require("oracledb");
    var {
      applyResultLimit,
      parseTableName,
      quoteIdentifier,
      resolveRuntimeDatasourceConfig
    } = require_data_development_utils();
    function resolveConnectionConfig(config = {}) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      const mode = String(resolved.connectionMode || config.connectionMode || config.extraConfig?.connectionMode || "serviceName").toLowerCase();
      const service = resolved.databaseName || "";
      const connectString = mode === "sid" ? `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${resolved.host})(PORT=${resolved.port || 1521}))(CONNECT_DATA=(SID=${service})))` : `${resolved.host}:${resolved.port || 1521}/${service}`;
      return {
        user: resolved.username,
        password: resolved.password,
        connectString,
        connectTimeout: 10
      };
    }
    async function withConnection(config, handler) {
      const connection = await oracledb.getConnection(resolveConnectionConfig(config));
      try {
        return await handler(connection);
      } finally {
        await connection.close();
      }
    }
    function normalizeResult(result, executedSql) {
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      return {
        fields: Array.isArray(result?.metaData) ? result.metaData.map((item) => item.name) : Object.keys(rows[0] || {}),
        rows,
        rowCount: rows.length,
        affectedRows: Number(result?.rowsAffected || 0),
        executedSql
      };
    }
    function normalizeOracleSql(sql) {
      const normalized = String(sql || "").trim().replace(/;+\s*$/, "").replace(/\bRAND\(\)/gi, "DBMS_RANDOM.VALUE");
      const offsetMatch = normalized.match(/^(.*)\s+LIMIT\s+(\d+)\s+OFFSET\s+(\d+)\s*$/is);
      if (offsetMatch) return `${offsetMatch[1]} OFFSET ${offsetMatch[3]} ROWS FETCH NEXT ${offsetMatch[2]} ROWS ONLY`;
      const limitMatch = normalized.match(/^(.*)\s+LIMIT\s+(\d+)\s*$/is);
      if (limitMatch) return `SELECT * FROM (${limitMatch[1]}) WHERE ROWNUM <= ${limitMatch[2]}`;
      return normalized;
    }
    function schemaName(config) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      return String(resolved.schema || resolved.username || "").toUpperCase();
    }
    function resolveSchemaName(config, candidate) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      const normalizedCandidate = String(candidate || "").trim();
      if (!normalizedCandidate || normalizedCandidate.toUpperCase() === String(resolved.databaseName || "").toUpperCase()) {
        return schemaName(config);
      }
      return normalizedCandidate.toUpperCase();
    }
    module2.exports = {
      async testConnection(config) {
        return withConnection(config, async (connection) => {
          await connection.execute("SELECT 1 AS ok FROM DUAL");
          return { success: true, message: "Oracle \u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F" };
        });
      },
      async getDatabases(config) {
        return module2.exports.getSchemas(config);
      },
      async getSchemas(config) {
        return withConnection(config, async (connection) => {
          const result = await connection.execute("SELECT username AS name FROM all_users ORDER BY username", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
          return (result.rows || []).map((row) => ({ name: row.NAME || row.name }));
        });
      },
      async getTables(config, schema) {
        const owner = resolveSchemaName(config, schema);
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT owner, object_name AS name, object_type AS type FROM all_objects WHERE owner = :owner AND object_type IN ('TABLE', 'VIEW') ORDER BY object_name`,
            { owner },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          return (result.rows || []).map((row) => ({
            name: `${row.OWNER || owner}.${row.NAME || row.name}`,
            type: row.TYPE || row.type,
            comment: null
          }));
        });
      },
      async getColumns(config, schema, tableName) {
        const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
        const owner = String(parsed.scope || schemaName(config)).toUpperCase();
        const table = String(parsed.table || "").toUpperCase();
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT c.column_name, c.column_id, c.data_type, c.data_length, c.data_precision, c.data_scale, c.nullable, c.data_default,
                CASE WHEN EXISTS (SELECT 1 FROM all_constraints ac JOIN all_cons_columns acc ON acc.constraint_name = ac.constraint_name AND acc.owner = ac.owner WHERE ac.constraint_type = 'P' AND ac.owner = c.owner AND acc.table_name = c.table_name AND acc.column_name = c.column_name) THEN 'Y' ELSE 'N' END AS primary_key
           FROM all_tab_columns c WHERE c.owner = :owner AND c.table_name = :tableName ORDER BY c.column_id`,
            { owner, tableName: table },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          return (result.rows || []).map((row) => ({
            name: row.COLUMN_NAME,
            position: Number(row.COLUMN_ID),
            dataType: row.DATA_TYPE,
            columnType: row.DATA_TYPE,
            length: row.DATA_LENGTH,
            precision: row.DATA_PRECISION,
            scale: row.DATA_SCALE,
            nullable: row.NULLABLE === "Y",
            primaryKey: row.PRIMARY_KEY === "Y",
            defaultValue: row.DATA_DEFAULT,
            comment: null
          }));
        });
      },
      async getFunctions(config, schema) {
        const owner = resolveSchemaName(config, schema);
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT owner, object_name AS name, object_type AS type FROM all_objects WHERE owner = :owner AND object_type IN ('FUNCTION', 'PROCEDURE', 'PACKAGE') ORDER BY object_name`,
            { owner },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          return (result.rows || []).map((row) => ({ name: row.NAME, type: row.TYPE, schema: row.OWNER }));
        });
      },
      async getIndexes(config, schema, tableName) {
        const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
        const owner = String(parsed.scope || schemaName(config)).toUpperCase();
        const table = String(parsed.table || "").toUpperCase();
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT i.index_name, i.uniqueness, i.index_type, c.column_name, c.column_position FROM all_indexes i JOIN all_ind_columns c ON c.index_owner = i.owner AND c.index_name = i.index_name WHERE i.table_owner = :owner AND i.table_name = :tableName ORDER BY i.index_name, c.column_position`,
            { owner, tableName: table },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          const grouped = /* @__PURE__ */ new Map();
          for (const row of result.rows || []) {
            if (!grouped.has(row.INDEX_NAME)) grouped.set(row.INDEX_NAME, { indexName: row.INDEX_NAME, unique: row.UNIQUENESS === "UNIQUE", indexType: row.INDEX_TYPE, cardinality: null, columns: [] });
            grouped.get(row.INDEX_NAME).columns.push(row.COLUMN_NAME);
          }
          return [...grouped.values()];
        });
      },
      async getConstraints(config, schema, tableName) {
        const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
        const owner = String(parsed.scope || schemaName(config)).toUpperCase();
        const table = String(parsed.table || "").toUpperCase();
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT c.constraint_name, c.constraint_type, cc.column_name, rc.table_name AS referenced_table_name, rcc.column_name AS referenced_column_name
           FROM all_constraints c LEFT JOIN all_cons_columns cc ON cc.owner = c.owner AND cc.constraint_name = c.constraint_name
           LEFT JOIN all_constraints rc ON rc.owner = c.r_owner AND rc.constraint_name = c.r_constraint_name
           LEFT JOIN all_cons_columns rcc ON rcc.owner = rc.owner AND rcc.constraint_name = rc.constraint_name AND rcc.position = cc.position
          WHERE c.owner = :owner AND c.table_name = :tableName ORDER BY c.constraint_name, cc.position`,
            { owner, tableName: table },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          const typeMap = { P: "PRIMARY KEY", R: "FOREIGN KEY", U: "UNIQUE", C: "CHECK" };
          const grouped = /* @__PURE__ */ new Map();
          for (const row of result.rows || []) {
            if (!grouped.has(row.CONSTRAINT_NAME)) grouped.set(row.CONSTRAINT_NAME, { constraintName: row.CONSTRAINT_NAME, constraintType: typeMap[row.CONSTRAINT_TYPE] || row.CONSTRAINT_TYPE, columns: [], references: [] });
            const item = grouped.get(row.CONSTRAINT_NAME);
            if (row.COLUMN_NAME) item.columns.push(row.COLUMN_NAME);
            if (row.REFERENCED_TABLE_NAME && row.REFERENCED_COLUMN_NAME) item.references.push({ tableName: row.REFERENCED_TABLE_NAME, columnName: row.REFERENCED_COLUMN_NAME });
          }
          return [...grouped.values()];
        });
      },
      async executeQuery(config, sql, options = {}) {
        return withConnection(config, async (connection) => {
          const normalizedSql = applyResultLimit(normalizeOracleSql(sql), options.resultLimit, "oracle");
          const result = await connection.execute(normalizedSql, options.binds || [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
          return normalizeResult(result, normalizedSql);
        });
      },
      async executeStatement(config, sql) {
        return withConnection(config, async (connection) => {
          const originalSql = String(sql || "").trim();
          const normalizedSql = /^BEGIN\b/i.test(originalSql) ? originalSql : originalSql.replace(/;+\s*$/, "");
          const result = await connection.execute(normalizedSql, [], { autoCommit: true });
          return { affectedRows: Number(result?.rowsAffected || 0), executedSql: normalizedSql };
        });
      },
      quoteIdentifier
    };
  }
});

// backend/src/modules/data-development/adapters/dm.adapter.js
var require_dm_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/dm.adapter.js"(exports2, module2) {
    var dmdb = require("dmdb");
    var {
      applyResultLimit,
      parseTableName,
      resolveRuntimeDatasourceConfig
    } = require_data_development_utils();
    function resolveConnectionConfig(config = {}) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      return {
        connectString: `${resolved.host}:${resolved.port || 5236}`,
        user: resolved.username,
        password: resolved.password,
        schema: resolved.schema || void 0,
        connectTimeout: 1e4,
        autoCommit: true
      };
    }
    async function withConnection(config, handler) {
      const connection = await dmdb.getConnection(resolveConnectionConfig(config));
      try {
        return await handler(connection);
      } finally {
        await connection.close();
      }
    }
    function toObjectRows(result) {
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      if (!rows.length || !Array.isArray(rows[0])) return rows;
      const fields = (result.metaData || []).map((item) => item.name);
      return rows.map((row) => Object.fromEntries(fields.map((field, index) => [field, row[index]])));
    }
    function normalizeResult(result, executedSql) {
      const rows = toObjectRows(result);
      return {
        fields: Array.isArray(result?.metaData) ? result.metaData.map((item) => item.name) : Object.keys(rows[0] || {}),
        rows,
        rowCount: rows.length,
        affectedRows: Number(result?.rowsAffected || 0),
        executedSql
      };
    }
    function normalizeDmSql(sql) {
      const normalized = String(sql || "").trim().replace(/;+\s*$/, "");
      const offsetMatch = normalized.match(/^(.*)\s+LIMIT\s+(\d+)\s+OFFSET\s+(\d+)\s*$/is);
      if (offsetMatch) return `${offsetMatch[1]} OFFSET ${offsetMatch[3]} ROWS FETCH NEXT ${offsetMatch[2]} ROWS ONLY`;
      const limitMatch = normalized.match(/^(.*)\s+LIMIT\s+(\d+)\s*$/is);
      if (limitMatch) return `${limitMatch[1]} FETCH FIRST ${limitMatch[2]} ROWS ONLY`;
      return normalized;
    }
    function schemaName(config) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      return String(resolved.schema || resolved.username || "").toUpperCase();
    }
    function resolveSchemaName(config, candidate) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      const normalizedCandidate = String(candidate || "").trim();
      if (!normalizedCandidate || normalizedCandidate.toUpperCase() === String(resolved.databaseName || "").toUpperCase()) {
        return schemaName(config);
      }
      return normalizedCandidate.toUpperCase();
    }
    module2.exports = {
      async testConnection(config) {
        return withConnection(config, async (connection) => {
          await connection.execute("SELECT 1 AS ok FROM DUAL");
          return { success: true, message: "\u8FBE\u68A6\u6570\u636E\u5E93\u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F" };
        });
      },
      async getDatabases(config) {
        return module2.exports.getSchemas(config);
      },
      async getSchemas(config) {
        return withConnection(config, async (connection) => {
          const result = await connection.execute("SELECT username AS name FROM all_users ORDER BY username");
          return toObjectRows(result).map((row) => ({ name: row.NAME || row.name }));
        });
      },
      async getTables(config, schema) {
        const owner = resolveSchemaName(config, schema);
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT owner, object_name AS name, object_type AS type FROM all_objects WHERE owner = ? AND object_type IN ('TABLE', 'VIEW') ORDER BY object_name`,
            [owner]
          );
          return toObjectRows(result).map((row) => ({
            name: `${row.OWNER || owner}.${row.NAME || row.name}`,
            type: row.TYPE || row.type,
            comment: null
          }));
        });
      },
      async getColumns(config, schema, tableName) {
        const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
        const owner = String(parsed.scope || schemaName(config)).toUpperCase();
        const table = String(parsed.table || "").toUpperCase();
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT c.column_name, c.column_id, c.data_type, c.data_length, c.data_precision, c.data_scale, c.nullable, c.data_default,
                CASE WHEN EXISTS (SELECT 1 FROM all_constraints ac JOIN all_cons_columns acc ON acc.constraint_name = ac.constraint_name AND acc.owner = ac.owner WHERE ac.constraint_type = 'P' AND ac.owner = c.owner AND acc.table_name = c.table_name AND acc.column_name = c.column_name) THEN 'Y' ELSE 'N' END AS primary_key
           FROM all_tab_columns c WHERE c.owner = ? AND c.table_name = ? ORDER BY c.column_id`,
            [owner, table]
          );
          return toObjectRows(result).map((row) => ({
            name: row.COLUMN_NAME,
            position: Number(row.COLUMN_ID),
            dataType: row.DATA_TYPE,
            columnType: row.DATA_TYPE,
            length: row.DATA_LENGTH,
            precision: row.DATA_PRECISION,
            scale: row.DATA_SCALE,
            nullable: row.NULLABLE === "Y",
            primaryKey: row.PRIMARY_KEY === "Y",
            defaultValue: row.DATA_DEFAULT,
            comment: null
          }));
        });
      },
      async getFunctions(config, schema) {
        const owner = resolveSchemaName(config, schema);
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT owner, object_name AS name, object_type AS type FROM all_objects WHERE owner = ? AND object_type IN ('FUNCTION', 'PROCEDURE', 'PACKAGE') ORDER BY object_name`,
            [owner]
          );
          return toObjectRows(result).map((row) => ({ name: row.NAME, type: row.TYPE, schema: row.OWNER }));
        });
      },
      async getIndexes(config, schema, tableName) {
        const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
        const owner = String(parsed.scope || schemaName(config)).toUpperCase();
        const table = String(parsed.table || "").toUpperCase();
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT i.index_name, i.uniqueness, i.index_type, c.column_name, c.column_position FROM all_indexes i JOIN all_ind_columns c ON c.index_owner = i.owner AND c.index_name = i.index_name WHERE i.table_owner = ? AND i.table_name = ? ORDER BY i.index_name, c.column_position`,
            [owner, table]
          );
          const grouped = /* @__PURE__ */ new Map();
          for (const row of toObjectRows(result)) {
            if (!grouped.has(row.INDEX_NAME)) grouped.set(row.INDEX_NAME, { indexName: row.INDEX_NAME, unique: row.UNIQUENESS === "UNIQUE", indexType: row.INDEX_TYPE, cardinality: null, columns: [] });
            grouped.get(row.INDEX_NAME).columns.push(row.COLUMN_NAME);
          }
          return [...grouped.values()];
        });
      },
      async getConstraints(config, schema, tableName) {
        const parsed = parseTableName(tableName, resolveSchemaName(config, schema));
        const owner = String(parsed.scope || schemaName(config)).toUpperCase();
        const table = String(parsed.table || "").toUpperCase();
        return withConnection(config, async (connection) => {
          const result = await connection.execute(
            `SELECT c.constraint_name, c.constraint_type, cc.column_name, rc.table_name AS referenced_table_name, rcc.column_name AS referenced_column_name
           FROM all_constraints c LEFT JOIN all_cons_columns cc ON cc.owner = c.owner AND cc.constraint_name = c.constraint_name
           LEFT JOIN all_constraints rc ON rc.owner = c.r_owner AND rc.constraint_name = c.r_constraint_name
           LEFT JOIN all_cons_columns rcc ON rcc.owner = rc.owner AND rcc.constraint_name = rc.constraint_name AND rcc.position = cc.position
          WHERE c.owner = ? AND c.table_name = ? ORDER BY c.constraint_name, cc.position`,
            [owner, table]
          );
          const typeMap = { P: "PRIMARY KEY", R: "FOREIGN KEY", U: "UNIQUE", C: "CHECK" };
          const grouped = /* @__PURE__ */ new Map();
          for (const row of toObjectRows(result)) {
            if (!grouped.has(row.CONSTRAINT_NAME)) grouped.set(row.CONSTRAINT_NAME, { constraintName: row.CONSTRAINT_NAME, constraintType: typeMap[row.CONSTRAINT_TYPE] || row.CONSTRAINT_TYPE, columns: [], references: [] });
            const item = grouped.get(row.CONSTRAINT_NAME);
            if (row.COLUMN_NAME) item.columns.push(row.COLUMN_NAME);
            if (row.REFERENCED_TABLE_NAME && row.REFERENCED_COLUMN_NAME) item.references.push({ tableName: row.REFERENCED_TABLE_NAME, columnName: row.REFERENCED_COLUMN_NAME });
          }
          return [...grouped.values()];
        });
      },
      async executeQuery(config, sql, options = {}) {
        return withConnection(config, async (connection) => {
          const normalizedSql = applyResultLimit(normalizeDmSql(sql), options.resultLimit, "dm");
          const result = await connection.execute(normalizedSql, options.binds || []);
          return normalizeResult(result, normalizedSql);
        });
      },
      async executeStatement(config, sql) {
        return withConnection(config, async (connection) => {
          const normalizedSql = String(sql || "").trim().replace(/;+\s*$/, "");
          const result = await connection.execute(normalizedSql);
          return { affectedRows: Number(result?.rowsAffected || 0), executedSql: normalizedSql };
        });
      }
    };
  }
});

// backend/src/modules/data-development/adapters/clickhouse.adapter.js
var require_clickhouse_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/clickhouse.adapter.js"(exports2, module2) {
    var { applyResultLimit, parseTableName, resolveDatasourceHost, resolveRuntimeDatasourceConfig } = require_data_development_utils();
    function buildBaseUrl(config) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      const protocol = resolved.protocol || "http";
      return `${protocol}://${resolveDatasourceHost(resolved.host)}:${Number(resolved.port || 8123)}`;
    }
    async function request(config, sql, databaseName, format = "json") {
      const searchParams = new URLSearchParams();
      const resolved = resolveRuntimeDatasourceConfig(config);
      if (databaseName || resolved.databaseName) {
        searchParams.set("database", databaseName || resolved.databaseName);
      }
      if (resolved.username) {
        searchParams.set("user", resolved.username);
      }
      if (resolved.password) {
        searchParams.set("password", resolved.password);
      }
      let normalizedSql = String(sql || "").trim().replace(/;+\s*$/, "");
      if (format === "json" && !/\bformat\s+json\b/i.test(normalizedSql)) {
        normalizedSql = `${normalizedSql} FORMAT JSON`;
      }
      const response = await fetch(`${buildBaseUrl(config)}/?${searchParams.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: normalizedSql
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `ClickHouse request failed with status ${response.status}`);
      }
      if (format === "json") {
        return { text, json: JSON.parse(text), executedSql: normalizedSql };
      }
      return { text, executedSql: normalizedSql };
    }
    module2.exports = {
      async testConnection(config) {
        await request(config, "SELECT 1 AS ok", config.databaseName, "json");
        return { success: true, message: "ClickHouse connection succeeded" };
      },
      async getDatabases(config) {
        const result = await request(config, "SHOW DATABASES", void 0, "json");
        return (result.json.data || []).map((row) => ({ name: row.name || Object.values(row)[0] }));
      },
      async getTables(config, databaseName) {
        const scope = databaseName || config.databaseName;
        const result = await request(
          config,
          `SELECT name, engine AS type, comment FROM system.tables WHERE database = ${JSON.stringify(scope)} ORDER BY name`,
          databaseName,
          "json"
        );
        return (result.json.data || []).map((row) => ({
          name: row.name || Object.values(row)[0],
          type: row.type || "BASE TABLE",
          comment: row.comment || null
        }));
      },
      async getColumns(config, databaseName, tableName) {
        const parsed = parseTableName(tableName, databaseName || config.databaseName);
        const result = await request(config, `DESCRIBE TABLE ${parsed.scope}.${parsed.table}`, parsed.scope, "json");
        return (result.json.data || []).map((row, index) => ({
          name: row.name,
          position: index + 1,
          dataType: row.type,
          columnType: row.type,
          nullable: /nullable/i.test(String(row.type || "")),
          primaryKey: false,
          defaultValue: row.default_expression || null,
          comment: row.comment || null
        }));
      },
      async getFunctions() {
        return [];
      },
      async executeQuery(config, sql, options = {}) {
        const normalizedSql = applyResultLimit(sql, options.resultLimit, "clickhouse");
        const result = await request(config, normalizedSql, options.databaseName || config.databaseName, "json");
        const rows = result.json.data || [];
        const fields = result.json.meta?.map((item) => item.name) || Object.keys(rows[0] || {});
        return {
          fields,
          rows,
          rowCount: rows.length,
          executedSql: result.executedSql
        };
      },
      async executeStatement(config, sql, options = {}) {
        const result = await request(config, sql, options.databaseName || config.databaseName, "text");
        return {
          affectedRows: 0,
          message: result.text || "Statement executed",
          executedSql: result.executedSql
        };
      }
    };
  }
});

// backend/src/modules/data-development/adapters/hive.adapter.js
var require_hive_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/hive.adapter.js"(exports2, module2) {
    var hiveService = require_hiveService();
    var { applyResultLimit, cleanHiveOutput, parseCsvLine, parseTableName, quoteIdentifier, resolveDatasourceHost, resolveRuntimeDatasourceConfig } = require_data_development_utils();
    function resolveConfig(config, databaseName) {
      const resolved = resolveRuntimeDatasourceConfig(config);
      return {
        host: resolveDatasourceHost(resolved.host),
        port: Number(resolved.port || 1e4),
        database: databaseName || resolved.databaseName || "default",
        username: resolved.username || "hive",
        password: resolved.password || "hive"
      };
    }
    async function runHiveSql(config, sql, databaseName, showHeader = false) {
      const resolved = resolveConfig(config, databaseName);
      const payload = [
        "!set silent true",
        `!set showHeader ${showHeader ? "true" : "false"}`,
        "!set outputformat csv2",
        `USE ${quoteIdentifier(resolved.database, "hive")};`,
        String(sql || "").trim().replace(/;+\s*$/, "") + ";"
      ].join("\n");
      const result = await hiveService.runHiveSql(payload, resolved);
      return {
        lines: cleanHiveOutput(result.stdout),
        executedSql: payload
      };
    }
    module2.exports = {
      async testConnection(config) {
        await runHiveSql(config, "SHOW DATABASES", config.databaseName, false);
        return { success: true, message: "Hive connection succeeded" };
      },
      async getDatabases(config) {
        const result = await runHiveSql(config, "SHOW DATABASES", config.databaseName, false);
        return result.lines.map((name) => ({ name }));
      },
      async getTables(config, databaseName) {
        const result = await runHiveSql(config, "SHOW TABLES", databaseName, false);
        return result.lines.map((name) => ({ name, type: "BASE TABLE", comment: null }));
      },
      async getColumns(config, databaseName, tableName) {
        const parsed = parseTableName(tableName, databaseName || config.databaseName || "default");
        const result = await runHiveSql(config, `DESCRIBE ${quoteIdentifier(parsed.table, "hive")}`, parsed.scope, false);
        return result.lines.filter((line) => line.includes(",")).map((line, index) => {
          const [name, type] = line.split(",");
          return {
            name: String(name || "").trim(),
            position: index + 1,
            dataType: String(type || "").trim(),
            columnType: String(type || "").trim(),
            nullable: true,
            primaryKey: false,
            defaultValue: null
          };
        }).filter((item) => item.name && !item.name.startsWith("#"));
      },
      async getFunctions() {
        return [];
      },
      async executeQuery(config, sql, options = {}) {
        const resolvedSql = applyResultLimit(sql, options.resultLimit, "hive");
        const result = await runHiveSql(config, resolvedSql, options.databaseName || config.databaseName, true);
        const [headerLine, ...dataLines] = result.lines.filter((line) => line.includes(","));
        const fields = headerLine ? parseCsvLine(headerLine) : [];
        const rows = dataLines.map((line) => {
          const values = parseCsvLine(line);
          return Object.fromEntries(fields.map((field, index) => [field, values[index] ?? null]));
        });
        return {
          fields,
          rows,
          rowCount: rows.length,
          executedSql: result.executedSql
        };
      },
      async executeStatement(config, sql, options = {}) {
        const result = await runHiveSql(config, sql, options.databaseName || config.databaseName, false);
        return {
          affectedRows: 0,
          message: result.lines.join("\n") || "Statement executed",
          executedSql: result.executedSql
        };
      }
    };
  }
});

// backend/src/common/utils/managed-jdbc-runtime.js
var require_managed_jdbc_runtime = __commonJS({
  "backend/src/common/utils/managed-jdbc-runtime.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { spawn, spawnSync } = require("child_process");
    var { getActiveDriverBinding, resolveDriverFile } = require_database_driver_store();
    var JAVA_SOURCE = path.resolve(__dirname, "../../runtime/jdbc/JdbcDriverRunner.java");
    var JAVA_CLASSES = path.resolve(process.cwd(), "runtime/database-drivers/java-runtime/classes");
    var JAVA_CLASS = "medata.jdbc.JdbcDriverRunner";
    function ensureJdbcRunnerCompiled() {
      const classFile = path.join(JAVA_CLASSES, "medata/jdbc/JdbcDriverRunner.class");
      const needsCompile = !fs.existsSync(classFile) || fs.statSync(classFile).mtimeMs < fs.statSync(JAVA_SOURCE).mtimeMs;
      if (!needsCompile) return JAVA_CLASSES;
      fs.mkdirSync(JAVA_CLASSES, { recursive: true });
      const result = spawnSync(process.env.JAVAC_BIN || "javac", ["-encoding", "UTF-8", "-d", JAVA_CLASSES, JAVA_SOURCE], {
        encoding: "utf8",
        windowsHide: true
      });
      if (result.status !== 0) {
        throw new Error(`JDBC \u8FD0\u884C\u5668\u7F16\u8BD1\u5931\u8D25: ${String(result.stderr || result.stdout || "javac \u4E0D\u53EF\u7528").trim()}`);
      }
      return JAVA_CLASSES;
    }
    function encode(value) {
      return Buffer.from(String(value ?? ""), "utf8").toString("base64");
    }
    function serializeParams(params = []) {
      const env = { JDBC_PARAM_COUNT: String(params.length) };
      params.forEach((value, index) => {
        const type = value === null || value === void 0 ? "null" : typeof value === "number" || typeof value === "bigint" ? "number" : typeof value === "boolean" ? "boolean" : "string";
        env[`JDBC_PARAM_${index}_TYPE`] = type;
        env[`JDBC_PARAM_${index}_VALUE_B64`] = encode(value ?? "");
      });
      return env;
    }
    function runJdbcAction(binding, action, payload = {}) {
      const classes = ensureJdbcRunnerCompiled();
      const driverFile = resolveDriverFile(binding.filePath);
      if (!fs.existsSync(driverFile)) throw new Error(`\u9A71\u52A8\u6587\u4EF6\u4E0D\u5B58\u5728: ${binding.filePath}`);
      const javaEnv = {
        PATH: process.env.PATH || "",
        Path: process.env.Path || "",
        SystemRoot: process.env.SystemRoot || "",
        JAVA_HOME: process.env.JAVA_HOME || "",
        TEMP: process.env.TEMP || "",
        TMP: process.env.TMP || "",
        LANG: process.env.LANG || "",
        LC_ALL: process.env.LC_ALL || "",
        JDBC_DRIVER_CLASS: binding.driverClass,
        JDBC_URL: payload.jdbcUrl || "",
        JDBC_USER: payload.username || "",
        JDBC_PASSWORD: payload.password || "",
        JDBC_SQL_BASE64: encode(payload.sql || ""),
        JDBC_MAX_ROWS: String(payload.maxRows || 1e3),
        JDBC_CATALOG: payload.catalog || "",
        JDBC_SCHEMA: payload.schema || "",
        JDBC_TABLE: payload.table || "",
        ...serializeParams(payload.params || [])
      };
      const classPath = `${classes}${path.delimiter}${driverFile}`;
      return new Promise((resolve, reject) => {
        const restrictedIdentity = process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() === 0 ? {
          uid: Number(process.env.JDBC_RUNNER_UID || 65534),
          gid: Number(process.env.JDBC_RUNNER_GID || 65534)
        } : {};
        const child = spawn(process.env.JAVA_BIN || "java", ["-cp", classPath, JAVA_CLASS, action], {
          env: javaEnv,
          windowsHide: true,
          shell: false,
          ...restrictedIdentity
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill();
        }, Number(payload.timeoutMs || 9e4));
        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });
        child.on("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          if (timedOut) {
            reject(new Error(`JDBC \u64CD\u4F5C\u8D85\u8FC7 ${Number(payload.timeoutMs || 9e4)} \u6BEB\u79D2\uFF0C\u5DF2\u7EC8\u6B62`));
            return;
          }
          const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
          let result;
          try {
            result = JSON.parse(line || "{}");
          } catch {
            result = null;
          }
          if (code !== 0 || !result || result.success === false) {
            reject(new Error(result?.error || stderr.trim() || stdout.trim() || `JDBC \u8FD0\u884C\u5668\u9000\u51FA\u7801 ${code}`));
            return;
          }
          resolve(result);
        });
      });
    }
    function getManagedBinding(databaseType) {
      const binding = getActiveDriverBinding(databaseType, "query");
      return binding?.filePath && binding?.driverClass ? binding : null;
    }
    module2.exports = {
      ensureJdbcRunnerCompiled,
      getManagedBinding,
      runJdbcAction
    };
  }
});

// backend/src/modules/data-development/adapters/managed-jdbc.adapter.js
var require_managed_jdbc_adapter = __commonJS({
  "backend/src/modules/data-development/adapters/managed-jdbc.adapter.js"(exports2, module2) {
    var { getDatabaseCapability } = require_datasource_capabilities();
    var { buildJdbcUrl } = require_datasource_dialect();
    var { getManagedBinding, runJdbcAction } = require_managed_jdbc_runtime();
    var {
      applyResultLimit,
      parseTableName,
      resolveRuntimeDatasourceConfig
    } = require_data_development_utils();
    function readValue(row, ...names) {
      for (const name of names) {
        if (Object.prototype.hasOwnProperty.call(row || {}, name)) return row[name];
        const key = Object.keys(row || {}).find((candidate) => candidate.toLowerCase() === String(name).toLowerCase());
        if (key) return row[key];
      }
      return null;
    }
    function prepareSql(sql, binds) {
      let normalizedSql = String(sql || "").trim();
      if (!binds) return { sql: normalizedSql, params: [] };
      if (Array.isArray(binds)) {
        if (/\$\d+/.test(normalizedSql)) {
          const params2 = [];
          normalizedSql = normalizedSql.replace(/\$(\d+)/g, (token, index) => {
            params2.push(binds[Number(index) - 1]);
            return "?";
          });
          return { sql: normalizedSql, params: params2 };
        }
        return { sql: normalizedSql, params: binds };
      }
      const params = [];
      normalizedSql = normalizedSql.replace(/:([a-zA-Z][a-zA-Z0-9_]*)/g, (token, name) => {
        if (!Object.prototype.hasOwnProperty.call(binds, name)) return token;
        params.push(binds[name]);
        return "?";
      });
      return { sql: normalizedSql, params };
    }
    function connectionPayload(databaseType, config, databaseName, extras = {}) {
      const resolved = resolveRuntimeDatasourceConfig({ ...config, ...databaseName ? { databaseName } : {} });
      const jdbcUrl = buildJdbcUrl(databaseType, {
        host: resolved.host,
        port: resolved.port,
        database: databaseName || resolved.databaseName,
        databaseName: databaseName || resolved.databaseName,
        jdbcUrl: databaseName ? "" : resolved.jdbcUrl,
        connectionMode: resolved.connectionMode
      });
      const schema = extras.schema || resolved.schema || (["oracle", "dm"].includes(databaseType) ? resolved.username : databaseType === "postgresql" ? "public" : "");
      return {
        jdbcUrl,
        username: resolved.username,
        password: resolved.password,
        catalog: databaseType === "mysql" ? databaseName || resolved.databaseName || "" : databaseType === "postgresql" ? databaseName || resolved.databaseName || "" : "",
        ...extras,
        schema: databaseType === "mysql" ? "" : schema
      };
    }
    function groupBy(rows, keyResolver, initializer, append) {
      const grouped = /* @__PURE__ */ new Map();
      for (const row of rows || []) {
        const key = keyResolver(row);
        if (!key) continue;
        if (!grouped.has(key)) grouped.set(key, initializer(row, key));
        append(grouped.get(key), row);
      }
      return [...grouped.values()];
    }
    function createManagedJdbcAdapter(databaseType, nativeAdapter) {
      const withBinding = async (handler, fallback) => {
        const binding = getManagedBinding(databaseType);
        return binding ? handler(binding) : fallback();
      };
      return {
        ...nativeAdapter,
        async testConnection(config) {
          return withBinding(async (binding) => {
            const capability = getDatabaseCapability(databaseType);
            await runJdbcAction(binding, "test", { ...connectionPayload(databaseType, config), sql: capability.healthCheckSql });
            return { success: true, message: `${capability.label} JDBC \u9A71\u52A8\u8FDE\u63A5\u6210\u529F` };
          }, () => nativeAdapter.testConnection(config));
        },
        async getDatabases(config) {
          return withBinding(async (binding) => {
            const action = ["oracle", "dm"].includes(databaseType) ? "schemas" : "catalogs";
            const rows = await runJdbcAction(binding, action, connectionPayload(databaseType, config));
            return rows.map((row) => ({ name: readValue(row, "TABLE_CAT", "TABLE_SCHEM", "name") })).filter((row) => row.name);
          }, () => nativeAdapter.getDatabases(config));
        },
        async getSchemas(config) {
          return withBinding(async (binding) => {
            const rows = await runJdbcAction(binding, "schemas", connectionPayload(databaseType, config));
            return rows.map((row) => ({ name: readValue(row, "TABLE_SCHEM", "name") })).filter((row) => row.name);
          }, () => nativeAdapter.getSchemas ? nativeAdapter.getSchemas(config) : nativeAdapter.getDatabases(config));
        },
        async getTables(config, databaseName) {
          return withBinding(async (binding) => {
            const payload = connectionPayload(databaseType, config, databaseType === "mysql" || databaseType === "postgresql" ? databaseName : void 0, {
              schema: ["oracle", "dm"].includes(databaseType) ? databaseName : void 0
            });
            const rows = await runJdbcAction(binding, "tables", payload);
            return rows.map((row) => {
              const table = readValue(row, "TABLE_NAME");
              const schema = readValue(row, "TABLE_SCHEM");
              return {
                name: databaseType === "mysql" || !schema ? table : `${schema}.${table}`,
                type: readValue(row, "TABLE_TYPE") || "TABLE",
                comment: readValue(row, "REMARKS")
              };
            });
          }, () => nativeAdapter.getTables(config, databaseName));
        },
        async getColumns(config, databaseName, tableName) {
          return withBinding(async (binding) => {
            const parsed = parseTableName(tableName, databaseType === "postgresql" ? "public" : databaseName);
            const payload = connectionPayload(databaseType, config, databaseType === "mysql" || databaseType === "postgresql" ? databaseName : void 0, {
              schema: databaseType === "mysql" ? "" : parsed.scope,
              table: parsed.table
            });
            const rows = await runJdbcAction(binding, "columns", payload);
            return rows.map((row, index) => ({
              name: readValue(row, "COLUMN_NAME"),
              position: Number(readValue(row, "ORDINAL_POSITION") || index + 1),
              dataType: readValue(row, "TYPE_NAME") || String(readValue(row, "DATA_TYPE") || ""),
              columnType: readValue(row, "TYPE_NAME") || String(readValue(row, "DATA_TYPE") || ""),
              length: Number(readValue(row, "COLUMN_SIZE") || 0) || null,
              precision: Number(readValue(row, "COLUMN_SIZE") || 0) || null,
              scale: Number(readValue(row, "DECIMAL_DIGITS") || 0) || null,
              nullable: Number(readValue(row, "NULLABLE")) !== 0,
              primaryKey: Boolean(readValue(row, "PRIMARY_KEY")),
              defaultValue: readValue(row, "COLUMN_DEF"),
              comment: readValue(row, "REMARKS")
            }));
          }, () => nativeAdapter.getColumns(config, databaseName, tableName));
        },
        async getFunctions(config, databaseName) {
          return withBinding(async (binding) => {
            const payload = connectionPayload(databaseType, config, databaseType === "mysql" || databaseType === "postgresql" ? databaseName : void 0, {
              schema: ["oracle", "dm"].includes(databaseType) ? databaseName : void 0
            });
            const rows = await runJdbcAction(binding, "functions", payload);
            return rows.map((row) => ({
              name: readValue(row, "FUNCTION_NAME", "PROCEDURE_NAME"),
              type: readValue(row, "ROUTINE_KIND") || "FUNCTION",
              schema: readValue(row, "FUNCTION_SCHEM", "PROCEDURE_SCHEM")
            })).filter((row) => row.name);
          }, () => nativeAdapter.getFunctions(config, databaseName));
        },
        async getIndexes(config, databaseName, tableName) {
          return withBinding(async (binding) => {
            const parsed = parseTableName(tableName, databaseName);
            const scopedDatabase = ["mysql", "postgresql"].includes(databaseType) ? databaseName : void 0;
            const rows = await runJdbcAction(binding, "indexes", connectionPayload(databaseType, config, scopedDatabase, { schema: parsed.scope, table: parsed.table }));
            return groupBy(rows, (row) => readValue(row, "INDEX_NAME"), (row, key) => ({
              indexName: key,
              unique: !Boolean(readValue(row, "NON_UNIQUE")),
              indexType: readValue(row, "TYPE"),
              cardinality: readValue(row, "CARDINALITY"),
              columns: []
            }), (item, row) => {
              const column = readValue(row, "COLUMN_NAME");
              if (column) item.columns.push(column);
            });
          }, () => nativeAdapter.getIndexes ? nativeAdapter.getIndexes(config, databaseName, tableName) : []);
        },
        async getConstraints(config, databaseName, tableName) {
          return withBinding(async (binding) => {
            const parsed = parseTableName(tableName, databaseName);
            const scopedDatabase = ["mysql", "postgresql"].includes(databaseType) ? databaseName : void 0;
            const rows = await runJdbcAction(binding, "constraints", connectionPayload(databaseType, config, scopedDatabase, { schema: parsed.scope, table: parsed.table }));
            return groupBy(rows, (row) => readValue(row, "FK_NAME", "PK_NAME") || readValue(row, "CONSTRAINT_KIND"), (row, key) => ({
              constraintName: key,
              constraintType: readValue(row, "CONSTRAINT_KIND"),
              columns: [],
              references: []
            }), (item, row) => {
              const column = readValue(row, "FKCOLUMN_NAME", "COLUMN_NAME");
              if (column) item.columns.push(column);
              const referenceTable = readValue(row, "PKTABLE_NAME");
              const referenceColumn = readValue(row, "PKCOLUMN_NAME");
              if (referenceTable && referenceColumn) item.references.push({ tableName: referenceTable, columnName: referenceColumn });
            });
          }, () => nativeAdapter.getConstraints ? nativeAdapter.getConstraints(config, databaseName, tableName) : []);
        },
        async executeQuery(config, sql, options = {}) {
          return withBinding(async (binding) => {
            const limitedSql = applyResultLimit(sql, options.resultLimit, databaseType);
            const prepared = prepareSql(limitedSql, options.binds);
            const result = await runJdbcAction(binding, "query", {
              ...connectionPayload(databaseType, config, options.databaseName),
              sql: prepared.sql,
              params: prepared.params,
              maxRows: options.resultLimit || 1e3
            });
            return { ...result, executedSql: prepared.sql };
          }, () => nativeAdapter.executeQuery(config, sql, options));
        },
        async executeStatement(config, sql, options = {}) {
          return withBinding(async (binding) => {
            const prepared = prepareSql(String(sql || "").trim().replace(/;+\s*$/, ""), options.binds);
            const result = await runJdbcAction(binding, "statement", {
              ...connectionPayload(databaseType, config, options.databaseName),
              sql: prepared.sql,
              params: prepared.params
            });
            return { ...result, executedSql: prepared.sql };
          }, () => nativeAdapter.executeStatement(config, sql, options));
        }
      };
    }
    module2.exports = { createManagedJdbcAdapter, prepareSql };
  }
});

// backend/src/modules/data-development/adapters/index.js
var require_adapters = __commonJS({
  "backend/src/modules/data-development/adapters/index.js"(exports2, module2) {
    var mysqlAdapter = require_mysql_adapter();
    var postgresAdapter = require_postgres_adapter();
    var oracleAdapter = require_oracle_adapter();
    var dmAdapter = require_dm_adapter();
    var clickhouseAdapter = require_clickhouse_adapter();
    var hiveAdapter = require_hive_adapter();
    var { inferDatasourceDialect, normalizeDatasourceType } = require_data_development_utils();
    var { createManagedJdbcAdapter } = require_managed_jdbc_adapter();
    var managedAdapters = {
      mysql: createManagedJdbcAdapter("mysql", mysqlAdapter),
      postgresql: createManagedJdbcAdapter("postgresql", postgresAdapter),
      oracle: createManagedJdbcAdapter("oracle", oracleAdapter),
      dm: createManagedJdbcAdapter("dm", dmAdapter)
    };
    function getAdapter(input) {
      const normalized = input && typeof input === "object" ? inferDatasourceDialect(input) : normalizeDatasourceType(input);
      switch (normalized) {
        case "mysql":
          return managedAdapters.mysql;
        case "postgresql":
          return managedAdapters.postgresql;
        case "oracle":
          return managedAdapters.oracle;
        case "dm":
          return managedAdapters.dm;
        case "clickhouse":
          return clickhouseAdapter;
        case "hive":
          return hiveAdapter;
        default:
          throw new Error(`Unsupported datasource type: ${normalized || input}`);
      }
    }
    module2.exports = {
      getAdapter
    };
  }
});

// backend/src/modules/data-sources/data-source.metadata.js
var require_data_source_metadata = __commonJS({
  "backend/src/modules/data-sources/data-source.metadata.js"(exports2, module2) {
    var mysql = require("mysql2/promise");
    var AppError = require_app_error();
    var hiveService = require_hiveService();
    var {
      inferDatasourceDialect,
      normalizeDatasourceType,
      resolveDatasourceConnection
    } = require_datasource_dialect();
    var { createPostgresLikeClient } = require_db_client();
    var { getAdapter } = require_adapters();
    var { getManagedBinding } = require_managed_jdbc_runtime();
    var POSTGRESQL = "postgresql";
    function usesAdapterRuntime(sourceType) {
      return ["oracle", "dm"].includes(sourceType) || Boolean(getManagedBinding(sourceType));
    }
    function resolveAdapterScope(dataSource, sourceType) {
      const config = normalizeConnectionConfig(dataSource);
      return ["oracle", "dm"].includes(sourceType) ? dataSource?.connectionConfig?.schema || config.user : config.database;
    }
    function normalizeSourceType(sourceType, connectionConfig = {}) {
      const normalized = normalizeDatasourceType(sourceType || "mysql");
      if (normalized === "gaussdb") {
        return POSTGRESQL;
      }
      const dialect = inferDatasourceDialect(normalized, connectionConfig);
      return dialect === "unknown" ? normalized || "mysql" : dialect;
    }
    function isPostgreSqlSource(sourceType, connectionConfig = {}) {
      return normalizeSourceType(sourceType, connectionConfig) === POSTGRESQL;
    }
    function isHiveSource(sourceType, connectionConfig = {}) {
      return normalizeSourceType(sourceType, connectionConfig) === "hive";
    }
    function escapeIdentifier(identifier, sourceType = "mysql") {
      const normalized = normalizeSourceType(sourceType);
      const quote = [POSTGRESQL, "oracle", "dm"].includes(normalized) ? '"' : "`";
      return String(identifier || "").split(".").filter(Boolean).map((part) => `${quote}${String(part).replace(new RegExp(quote, "g"), quote.repeat(2))}${quote}`).join(".");
    }
    function escapeValue(value) {
      if (value === null || value === void 0) {
        return "NULL";
      }
      if (value instanceof Date) {
        return `'${formatDateTimeForSql(value)}'`;
      }
      if (typeof value === "number") {
        if (!Number.isFinite(value)) {
          throw new AppError("\u4E0D\u652F\u6301\u5199\u5165\u975E\u6709\u9650\u6570\u503C", 400);
        }
        return String(value);
      }
      if (typeof value === "boolean") {
        return value ? "TRUE" : "FALSE";
      }
      if (Buffer.isBuffer(value)) {
        return `'\\x${value.toString("hex")}'`;
      }
      return `'${String(value).replace(/'/g, "''")}'`;
    }
    function formatDateTimeForSql(value) {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) {
        return String(value);
      }
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      const second = String(date.getSeconds()).padStart(2, "0");
      const millisecond = String(date.getMilliseconds()).padStart(3, "0");
      return `${year}-${month}-${day} ${hour}:${minute}:${second}.${millisecond}`;
    }
    function normalizeConnectionConfig(dataSource) {
      const connectionConfig = dataSource?.connectionConfig || {};
      const resolved = resolveDatasourceConnection(dataSource?.sourceType, connectionConfig);
      return {
        sourceType: resolved.dialect,
        host: resolved.host,
        port: Number(resolved.port || 0),
        database: resolved.database,
        schema: resolved.schema || "public",
        user: resolved.username,
        password: resolved.password,
        jdbcUrl: resolved.jdbcUrl,
        driverClassName: resolved.driverClassName || null
      };
    }
    function cleanHiveCliOutput(text) {
      return String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => line !== "No such file or directory").filter((line) => !line.startsWith("SLF4J:")).filter((line) => !line.startsWith("[WARN]")).filter((line) => !line.startsWith("Connecting to ")).filter((line) => !line.startsWith("Connected to:")).filter((line) => !line.startsWith("Driver:")).filter((line) => !line.startsWith("Transaction isolation:")).filter((line) => !line.startsWith("Closing:")).filter((line) => !line.startsWith("Beeline version")).filter((line) => !line.startsWith("0: jdbc:hive2://"));
    }
    function parseCsvLine(line) {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === '"' && inQuotes && next === '"') {
          current += '"';
          index += 1;
          continue;
        }
        if (char === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if (char === "," && !inQuotes) {
          result.push(current);
          current = "";
          continue;
        }
        current += char;
      }
      result.push(current);
      return result;
    }
    async function listHiveTables(dataSource) {
      const config = normalizeConnectionConfig(dataSource);
      const sql = [
        "!set silent true",
        "!set showHeader false",
        "!set outputformat csv2",
        `USE ${escapeIdentifier(config.database || "default", "hive")};`,
        "SHOW TABLES;"
      ].join("\n");
      const result = await hiveService.runHiveSql(sql, {
        host: config.host,
        port: config.port,
        database: config.database || "default",
        username: config.user || "hive",
        password: config.password || "hive"
      });
      return cleanHiveCliOutput(result.stdout).filter((tableName) => !tableName.startsWith("__medata_stage_")).filter((tableName) => !tableName.startsWith("+")).filter((tableName) => !tableName.startsWith("|")).map((tableName) => ({
        tableName,
        tableType: "BASE TABLE",
        tableComment: ""
      }));
    }
    async function listHiveColumns(dataSource, tableName) {
      const config = normalizeConnectionConfig(dataSource);
      const sql = [
        "!set silent true",
        "!set showHeader false",
        "!set outputformat csv2",
        `USE ${escapeIdentifier(config.database || "default", "hive")};`,
        `DESCRIBE ${escapeIdentifier(tableName, "hive")};`
      ].join("\n");
      const result = await hiveService.runHiveSql(sql, {
        host: config.host,
        port: config.port,
        database: config.database || "default",
        username: config.user || "hive",
        password: config.password || "hive"
      });
      return cleanHiveCliOutput(result.stdout).filter((line) => line.includes(",")).map((line, index) => {
        const [columnName, columnType] = line.split(",");
        return {
          columnName: String(columnName || "").trim(),
          ordinalPosition: index + 1,
          dataType: String(columnType || "").trim(),
          columnType: String(columnType || "").trim(),
          isNullable: true,
          isPrimaryKey: false,
          columnDefault: null,
          extra: "",
          columnComment: ""
        };
      }).filter((column) => column.columnName && !column.columnName.startsWith("#"));
    }
    async function sampleHiveRows(dataSource, tableName, limit = 100) {
      const config = normalizeConnectionConfig(dataSource);
      const safeLimit = Math.max(1, Math.min(100, Number(limit || 100)));
      const sql = [
        "!set silent true",
        "!set showHeader false",
        "!set outputformat csv2",
        `USE ${escapeIdentifier(config.database || "default", "hive")};`,
        `SELECT * FROM ${escapeIdentifier(tableName, "hive")} LIMIT ${safeLimit};`
      ].join("\n");
      const columns = await listHiveColumns(dataSource, tableName);
      const result = await hiveService.runHiveSql(sql, {
        host: config.host,
        port: config.port,
        database: config.database || "default",
        username: config.user || "hive",
        password: config.password || "hive"
      });
      const lines = cleanHiveCliOutput(result.stdout).filter((line) => line.includes(","));
      return lines.map((line) => {
        const values = parseCsvLine(line);
        return Object.fromEntries(
          columns.map((column, index) => [
            column.columnName,
            sanitizeSampleRow({ value: values[index] ?? null }).value
          ])
        );
      });
    }
    function parseQualifiedTableName(dataSource, tableName = "") {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const normalized = String(tableName || "").trim();
      const parts = normalized.split(".").filter(Boolean);
      if (isPostgreSqlSource(sourceType) || ["oracle", "dm"].includes(sourceType)) {
        if (parts.length >= 2) {
          return {
            schema: parts[parts.length - 2].replace(/"/g, ""),
            tableName: parts[parts.length - 1].replace(/"/g, "")
          };
        }
        return {
          schema: normalizeConnectionConfig(dataSource).schema,
          tableName: normalized.replace(/"/g, "")
        };
      }
      if (parts.length >= 2) {
        return {
          database: parts[parts.length - 2].replace(/`/g, ""),
          tableName: parts[parts.length - 1].replace(/`/g, "")
        };
      }
      return {
        database: normalizeConnectionConfig(dataSource).database,
        tableName: normalized.replace(/`/g, "")
      };
    }
    function buildQualifiedTableName(dataSource, tableName) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const parsed = parseQualifiedTableName(dataSource, tableName);
      if (isPostgreSqlSource(sourceType) || ["oracle", "dm"].includes(sourceType)) {
        return `${parsed.schema}.${parsed.tableName}`;
      }
      return parsed.database ? `${parsed.database}.${parsed.tableName}` : parsed.tableName;
    }
    function formatDefaultValue(sourceType, columnDefault) {
      if (columnDefault === null || columnDefault === void 0) {
        return null;
      }
      const normalized = String(columnDefault).trim();
      if (!normalized) {
        return null;
      }
      if (/^current_timestamp(?:\(\))?$/i.test(normalized) || /^now\(\)$/i.test(normalized)) {
        return "CURRENT_TIMESTAMP";
      }
      if (/^null(?:::.*)?$/i.test(normalized) || isPostgreSqlSource(sourceType) && /^nextval\(/i.test(normalized)) {
        return null;
      }
      return escapeValue(columnDefault);
    }
    function normalizeExtra(extra, sourceType = "mysql") {
      if (!extra) {
        return "";
      }
      const normalized = String(extra).split(" ").filter(Boolean).filter((part) => part.toUpperCase() !== "DEFAULT_GENERATED").join(" ");
      return isPostgreSqlSource(sourceType) ? normalized.toUpperCase() : normalized;
    }
    function normalizeDefaultValueForCompare(columnDefault) {
      if (columnDefault === null || columnDefault === void 0 || columnDefault === "") {
        return null;
      }
      const normalized = String(columnDefault).trim();
      if (!normalized || /^null(?:::.*)?$/i.test(normalized) || /^nextval\(/i.test(normalized)) {
        return null;
      }
      if (/^current_timestamp(?:\(\))?$/i.test(normalized) || /^now\(\)$/i.test(normalized)) {
        return "CURRENT_TIMESTAMP";
      }
      return normalized;
    }
    function normalizePostgreSqlColumnDefault(columnDefault) {
      if (columnDefault === null || columnDefault === void 0) {
        return null;
      }
      const normalized = String(columnDefault).trim();
      if (!normalized || /^null(?:::.*)?$/i.test(normalized) || /^nextval\(/i.test(normalized)) {
        return null;
      }
      if (/^current_timestamp(?:\(\))?$/i.test(normalized) || /^now\(\)$/i.test(normalized)) {
        return "CURRENT_TIMESTAMP";
      }
      const typedStringMatch = normalized.match(/^'(.*)'::/s);
      if (typedStringMatch) {
        return typedStringMatch[1].replace(/''/g, "'");
      }
      const typedNumberMatch = normalized.match(/^(-?\d+(?:\.\d+)?)::/);
      if (typedNumberMatch) {
        return typedNumberMatch[1];
      }
      return normalized;
    }
    function parseColumnTypeDefinition(columnType) {
      const normalized = String(columnType || "").trim().toLowerCase();
      const match = normalized.match(/^([a-z ]+?)(?:\(([^)]+)\))?$/);
      if (!match) {
        return { baseType: normalized, args: [] };
      }
      return {
        baseType: match[1].trim(),
        args: match[2] ? match[2].split(",").map((item) => item.trim()) : []
      };
    }
    function normalizePostgreSqlColumnType(columnType) {
      const rawType = String(columnType || "").trim().toLowerCase().replace(/\s+/g, " ");
      const temporalMatch = rawType.match(/^(timestamp|time)\((\d+)\) (with|without) time zone$/);
      const parsed = temporalMatch ? {
        baseType: `${temporalMatch[1]} ${temporalMatch[3]} time zone`,
        args: [temporalMatch[2]]
      } : parseColumnTypeDefinition(rawType);
      const { baseType, args } = parsed;
      const aliases = {
        varchar: "character varying",
        char: "character",
        int: "integer",
        int4: "integer",
        int8: "bigint",
        int2: "smallint",
        float8: "double precision",
        float4: "real",
        bool: "boolean",
        timestamptz: "timestamp with time zone",
        timestamp: "timestamp without time zone",
        timetz: "time with time zone",
        time: "time without time zone",
        decimal: "numeric"
      };
      const normalizedBaseType = aliases[baseType] || baseType;
      const isTemporalType = normalizedBaseType.startsWith("timestamp ") || normalizedBaseType.startsWith("time ");
      const normalizedArgs = isTemporalType && args.length === 1 && args[0] === "6" ? [] : args;
      return `${normalizedBaseType}${normalizedArgs.length ? `(${normalizedArgs.join(",")})` : ""}`;
    }
    function arePostgreSqlColumnTypesEquivalent(left, right) {
      return normalizePostgreSqlColumnType(left) === normalizePostgreSqlColumnType(right);
    }
    function areColumnTypesEquivalent(left, right, sourceType = "mysql") {
      if (isPostgreSqlSource(sourceType)) {
        return arePostgreSqlColumnTypesEquivalent(left, right);
      }
      return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
    }
    function buildColumnDefinitionSql(sourceType, column) {
      let definition = `${escapeIdentifier(column.columnName, sourceType)} ${column.columnType}`;
      if (!column.isNullable) {
        definition += " NOT NULL";
      }
      const formattedDefault = formatDefaultValue(sourceType, column.columnDefault);
      if (formattedDefault !== null) {
        definition += ` DEFAULT ${formattedDefault}`;
      }
      const extra = normalizeExtra(column.extra, sourceType);
      if (extra) {
        definition += ` ${extra}`;
      }
      if (sourceType === "mysql" && column.columnComment) {
        definition += ` COMMENT ${escapeValue(String(column.columnComment || ""))}`;
      }
      return definition;
    }
    function buildCreateTableSql(dataSource, tableName, columns, options = {}) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
      const columnSql = columns.map((column) => buildColumnDefinitionSql(sourceType, column));
      const primaryKeys = columns.filter((column) => column.isPrimaryKey).map((column) => escapeIdentifier(column.columnName, sourceType));
      if (primaryKeys.length > 0) {
        columnSql.push(`PRIMARY KEY (${primaryKeys.join(", ")})`);
      }
      let sql = `CREATE TABLE ${qualifiedTable} (
${columnSql.join(",\n")}
)`;
      if (sourceType === "mysql" && options.tableComment) {
        sql += ` COMMENT=${escapeValue(String(options.tableComment || ""))}`;
      }
      return sql;
    }
    async function applyTableAndColumnComments(connection, dataSource, tableName, columns, options = {}) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
      const tableComment = String(options.tableComment || "").trim();
      if (sourceType === "mysql") {
        if (tableComment) {
          await executeQuery(connection, sourceType, `ALTER TABLE ${qualifiedTable} COMMENT = ${escapeValue(tableComment)}`);
        }
        return;
      }
      if (sourceType === POSTGRESQL) {
        if (tableComment) {
          await executeQuery(connection, sourceType, `COMMENT ON TABLE ${qualifiedTable} IS ${escapeValue(tableComment)}`);
        }
        for (const column of Array.isArray(columns) ? columns : []) {
          if (!column?.columnName) continue;
          const qualifiedColumn = escapeIdentifier(column.columnName, sourceType);
          const comment = String(column.columnComment || "").trim();
          await executeQuery(
            connection,
            sourceType,
            `COMMENT ON COLUMN ${qualifiedTable}.${qualifiedColumn} IS ${comment ? escapeValue(comment) : "NULL"}`
          );
        }
      }
    }
    function isColumnEquivalent(existingColumn, expectedColumn, sourceType = "mysql") {
      return String(existingColumn.columnName) === String(expectedColumn.columnName) && areColumnTypesEquivalent(existingColumn.columnType, expectedColumn.columnType, sourceType) && Boolean(existingColumn.isNullable) === Boolean(expectedColumn.isNullable) && Boolean(existingColumn.isPrimaryKey) === Boolean(expectedColumn.isPrimaryKey) && normalizeDefaultValueForCompare(existingColumn.columnDefault) === normalizeDefaultValueForCompare(expectedColumn.columnDefault) && normalizeExtra(existingColumn.extra, sourceType).toLowerCase() === normalizeExtra(expectedColumn.extra, sourceType).toLowerCase();
    }
    function getPrimaryKeyColumns(columns) {
      return columns.filter((column) => column.isPrimaryKey).map((column) => column.columnName);
    }
    function arePrimaryKeysEquivalent(existingColumns, expectedColumns) {
      const existingPrimaryKeys = getPrimaryKeyColumns(existingColumns);
      const expectedPrimaryKeys = getPrimaryKeyColumns(expectedColumns);
      return existingPrimaryKeys.length === expectedPrimaryKeys.length && existingPrimaryKeys.every((columnName, index) => columnName === expectedPrimaryKeys[index]);
    }
    function getColumnSyncPlan(existingColumns, expectedColumns, sourceType = "mysql") {
      const existingColumnMap = new Map(existingColumns.map((column) => [column.columnName, column]));
      const additions = [];
      const modifications = [];
      for (const expectedColumn of expectedColumns) {
        const existingColumn = existingColumnMap.get(expectedColumn.columnName);
        if (!existingColumn) {
          additions.push(expectedColumn);
          continue;
        }
        if (!isColumnEquivalent(existingColumn, expectedColumn, sourceType)) {
          modifications.push(expectedColumn);
        }
      }
      return {
        additions,
        modifications,
        primaryKeyChanged: !arePrimaryKeysEquivalent(existingColumns, expectedColumns)
      };
    }
    function buildFriendlyAlterError(error, tableName) {
      if (error instanceof AppError) {
        return error;
      }
      if (error?.code === "ER_INVALID_USE_OF_NULL" || error?.code === "23502") {
        return new AppError(`\u76EE\u6807\u8868 ${tableName} \u5B58\u5728\u7A7A\u503C\u6570\u636E\uFF0C\u65E0\u6CD5\u6536\u7D27\u4E3A NOT NULL\uFF0C\u8BF7\u5148\u6E05\u6D17\u6570\u636E\u540E\u518D\u4FDD\u5B58`, 400);
      }
      if (error?.code === "ER_DUP_ENTRY" || error?.code === "23505") {
        return new AppError(`\u76EE\u6807\u8868 ${tableName} \u5B58\u5728\u91CD\u590D\u6570\u636E\uFF0C\u65E0\u6CD5\u8C03\u6574\u4E3A\u65B0\u7684\u4E3B\u952E\u7EA6\u675F\uFF0C\u8BF7\u5148\u6E05\u6D17\u91CD\u590D\u6570\u636E\u540E\u518D\u4FDD\u5B58`, 400);
      }
      if (error?.code === "ER_DATA_TOO_LONG" || error?.code === "22001") {
        return new AppError(`\u76EE\u6807\u8868 ${tableName} \u5B58\u5728\u8D85\u957F\u6570\u636E\uFF0C\u65E0\u6CD5\u6536\u7F29\u5B57\u6BB5\u957F\u5EA6\uFF0C\u8BF7\u5148\u5904\u7406\u5386\u53F2\u6570\u636E\u540E\u518D\u4FDD\u5B58`, 400);
      }
      if (error?.code === "WARN_DATA_TRUNCATED" || error?.code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD" || error?.code === "22P02") {
        return new AppError(`\u76EE\u6807\u8868 ${tableName} \u4E2D\u5DF2\u6709\u6570\u636E\u4E0E\u65B0\u5B57\u6BB5\u7C7B\u578B\u4E0D\u517C\u5BB9\uFF0C\u8BF7\u5148\u6E05\u6D17\u6570\u636E\u540E\u518D\u4FDD\u5B58`, 400);
      }
      return new AppError(`\u76EE\u6807\u8868 ${tableName} \u7ED3\u6784\u540C\u6B65\u5931\u8D25\uFF1A${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
    }
    function buildPostgreSqlUsingExpression(columnName, existingColumnType, expectedColumnType) {
      const qualifiedColumn = escapeIdentifier(columnName, POSTGRESQL);
      const existingType = parseColumnTypeDefinition(existingColumnType);
      const expectedType = parseColumnTypeDefinition(expectedColumnType);
      const targetBaseType = expectedType.baseType;
      const targetTypeSql = String(expectedColumnType || "").trim();
      const asTrimmedText = `NULLIF(BTRIM(${qualifiedColumn}::text), '')`;
      if (["timestamp", "timestamp without time zone", "timestamp with time zone"].includes(targetBaseType)) {
        return `${asTrimmedText}::${targetTypeSql}`;
      }
      if (targetBaseType === "date") {
        return `${asTrimmedText}::date`;
      }
      if (["time", "time without time zone", "time with time zone"].includes(targetBaseType)) {
        return `${asTrimmedText}::${targetTypeSql}`;
      }
      if (["integer", "bigint", "smallint", "numeric", "real", "double precision"].includes(targetBaseType)) {
        return `NULLIF(REPLACE(BTRIM(${qualifiedColumn}::text), ',', ''), '')::${targetTypeSql}`;
      }
      if (targetBaseType === "boolean") {
        return `CASE
      WHEN ${asTrimmedText} IS NULL THEN NULL
      WHEN LOWER(BTRIM(${qualifiedColumn}::text)) IN ('true', 't', '1', 'yes', 'y') THEN TRUE
      WHEN LOWER(BTRIM(${qualifiedColumn}::text)) IN ('false', 'f', '0', 'no', 'n') THEN FALSE
      ELSE NULL
    END`;
      }
      if (["json", "jsonb", "uuid"].includes(targetBaseType)) {
        return `${asTrimmedText}::${targetTypeSql}`;
      }
      if (["text", "character varying", "varchar"].includes(targetBaseType)) {
        return `${qualifiedColumn}::${targetTypeSql}`;
      }
      return null;
    }
    async function createPostgreSqlClient(dataSource) {
      const config = normalizeConnectionConfig(dataSource);
      const client = createPostgresLikeClient({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        username: config.user,
        password: config.password,
        connectionTimeoutMillis: 5e3
      }, {
        sourceType: dataSource?.sourceType
      });
      await client.connect();
      return client;
    }
    async function withConnection(dataSource, handler) {
      if (!dataSource) {
        throw new AppError("\u6570\u636E\u6E90\u4E0D\u5B58\u5728", 404);
      }
      const sourceType = normalizeSourceType(dataSource.sourceType, dataSource.connectionConfig);
      const config = normalizeConnectionConfig(dataSource);
      if (sourceType === "mysql") {
        const connection = await mysql.createConnection({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          connectTimeout: 5e3
        });
        try {
          return await handler(connection, sourceType);
        } finally {
          await connection.end();
        }
      }
      if (sourceType === POSTGRESQL) {
        const client = await createPostgreSqlClient(dataSource);
        try {
          return await handler(client, sourceType);
        } finally {
          await client.end();
        }
      }
      throw new AppError("\u5F53\u524D\u4EC5\u652F\u6301 MySQL / PostgreSQL \u6570\u636E\u6E90\u7684\u5143\u6570\u636E\u63A2\u67E5", 400);
    }
    async function executeQuery(connection, sourceType, sql, params = []) {
      if (sourceType === "mysql") {
        const [rows] = await connection.query(sql, params);
        return rows;
      }
      const result = await connection.query(sql, params);
      return result.rows;
    }
    async function listTables(dataSource) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return listHiveTables(dataSource);
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const adapter = getAdapter(sourceType);
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        const rows = await adapter.getTables(config, resolveAdapterScope(dataSource, sourceType));
        return rows.map((row) => ({ tableName: row.name, tableType: row.type, tableComment: row.comment || "" }));
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        if (sourceType2 === "mysql") {
          const databaseName = normalizeConnectionConfig(dataSource).database;
          return executeQuery(
            connection,
            sourceType2,
            `SELECT table_name AS tableName, table_type AS tableType, table_comment AS tableComment
         FROM information_schema.tables
         WHERE table_schema = ?
         ORDER BY table_name ASC`,
            [databaseName]
          );
        }
        const { database, schema } = normalizeConnectionConfig(dataSource);
        return executeQuery(
          connection,
          sourceType2,
          `SELECT table_name AS "tableName",
              table_type AS "tableType",
              COALESCE(obj_description(format('%I.%I', table_schema, table_name)::regclass, 'pg_class'), '') AS "tableComment"
       FROM information_schema.tables
       WHERE table_catalog = $1
         AND table_schema = $2
         AND table_type IN ('BASE TABLE', 'VIEW')
       ORDER BY table_name ASC`,
          [database, schema]
        );
      });
    }
    async function listColumns(dataSource, tableName) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return listHiveColumns(dataSource, tableName);
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const adapter = getAdapter(sourceType);
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        const rows = await adapter.getColumns(config, resolveAdapterScope(dataSource, sourceType), tableName);
        return rows.map((row) => ({
          columnName: row.name,
          ordinalPosition: row.position,
          dataType: row.dataType,
          columnType: row.columnType,
          isNullable: row.nullable,
          isPrimaryKey: row.primaryKey,
          columnDefault: row.defaultValue,
          columnComment: row.comment || ""
        }));
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        const parsed = parseQualifiedTableName(dataSource, tableName);
        if (sourceType2 === "mysql") {
          const rows2 = await executeQuery(
            connection,
            sourceType2,
            `SELECT column_name AS columnName,
                ordinal_position AS ordinalPosition,
                data_type AS dataType,
                column_type AS columnType,
                is_nullable AS isNullable,
                column_default AS columnDefault,
                column_key AS columnKey,
                extra AS extra,
                column_comment AS columnComment
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ordinal_position ASC`,
            [parsed.database, parsed.tableName]
          );
          return rows2.map((row) => ({
            ...row,
            isNullable: row.isNullable === "YES",
            isPrimaryKey: row.columnKey === "PRI"
          }));
        }
        const { database } = normalizeConnectionConfig(dataSource);
        const rows = await executeQuery(
          connection,
          sourceType2,
          `SELECT c.column_name AS "columnName",
              c.ordinal_position AS "ordinalPosition",
              c.data_type AS "dataType",
              pg_catalog.format_type(a.atttypid, a.atttypmod) AS "columnType",
              c.is_nullable AS "isNullable",
              c.column_default AS "columnDefault",
              CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS "isPrimaryKey",
              COALESCE(pg_catalog.col_description(cls.oid, a.attnum), '') AS "columnComment"
       FROM information_schema.columns c
       JOIN pg_catalog.pg_class cls ON cls.relname = c.table_name
       JOIN pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace AND ns.nspname = c.table_schema
       JOIN pg_catalog.pg_attribute a ON a.attrelid = cls.oid AND a.attname = c.column_name
       LEFT JOIN (
         SELECT kcu.table_schema, kcu.table_name, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
          AND tc.table_name = kcu.table_name
         WHERE tc.constraint_type = 'PRIMARY KEY'
       ) pk
         ON pk.table_schema = c.table_schema
        AND pk.table_name = c.table_name
        AND pk.column_name = c.column_name
       WHERE c.table_catalog = $1
         AND c.table_schema = $2
         AND c.table_name = $3
       ORDER BY c.ordinal_position ASC`,
          [database, parsed.schema, parsed.tableName]
        );
        return rows.map((row) => ({
          ...row,
          isNullable: row.isNullable === "YES",
          isPrimaryKey: Boolean(row.isPrimaryKey),
          columnDefault: normalizePostgreSqlColumnDefault(row.columnDefault),
          extra: ""
        }));
      });
    }
    function groupIndexes(rows) {
      const grouped = /* @__PURE__ */ new Map();
      for (const row of rows) {
        if (!grouped.has(row.indexName)) {
          grouped.set(row.indexName, {
            indexName: row.indexName,
            unique: row.nonUnique === 0 || row.nonUnique === false,
            indexType: row.indexType,
            cardinality: row.cardinality,
            columns: []
          });
        }
        if (row.columnName) {
          grouped.get(row.indexName).columns.push(row.columnName);
        }
      }
      return Array.from(grouped.values());
    }
    async function listIndexes(dataSource, tableName) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return [];
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        return getAdapter(sourceType).getIndexes(config, resolveAdapterScope(dataSource, sourceType), tableName);
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        const parsed = parseQualifiedTableName(dataSource, tableName);
        if (sourceType2 === "mysql") {
          const rows2 = await executeQuery(
            connection,
            sourceType2,
            `SELECT index_name AS indexName,
                non_unique AS nonUnique,
                seq_in_index AS seqInIndex,
                column_name AS columnName,
                index_type AS indexType,
                cardinality AS cardinality
         FROM information_schema.statistics
         WHERE table_schema = ? AND table_name = ?
         ORDER BY index_name ASC, seq_in_index ASC`,
            [parsed.database, parsed.tableName]
          );
          return groupIndexes(rows2);
        }
        const rows = await executeQuery(
          connection,
          sourceType2,
          `SELECT idx.relname AS "indexName",
              NOT ix.indisunique AS "nonUnique",
              ord."seqInIndex" AS "seqInIndex",
              pg_get_indexdef(idx.oid, ord."seqInIndex", TRUE) AS "columnName",
              am.amname AS "indexType"
       FROM pg_class tbl
       JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
       JOIN pg_index ix ON ix.indrelid = tbl.oid
       JOIN pg_class idx ON idx.oid = ix.indexrelid
       JOIN pg_am am ON am.oid = idx.relam
       LEFT JOIN (
         SELECT generate_series(1, 64) AS "seqInIndex"
       ) ord
         ON ord."seqInIndex" <= COALESCE(array_length(string_to_array(ix.indkey::text, ' '), 1), 0)
       WHERE ns.nspname = $1
         AND tbl.relname = $2
       ORDER BY idx.relname ASC, ord."seqInIndex" ASC`,
          [parsed.schema, parsed.tableName]
        );
        return groupIndexes(rows);
      });
    }
    function groupConstraints(rows) {
      const grouped = /* @__PURE__ */ new Map();
      for (const row of rows) {
        if (!grouped.has(row.constraintName)) {
          grouped.set(row.constraintName, {
            constraintName: row.constraintName,
            constraintType: row.constraintType,
            columns: [],
            references: []
          });
        }
        const item = grouped.get(row.constraintName);
        if (row.columnName) {
          item.columns.push(row.columnName);
        }
        if (row.referencedTableName && row.referencedColumnName) {
          item.references.push({
            tableName: row.referencedTableName,
            columnName: row.referencedColumnName
          });
        }
      }
      return Array.from(grouped.values());
    }
    async function listConstraints(dataSource, tableName) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return [];
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        return getAdapter(sourceType).getConstraints(config, resolveAdapterScope(dataSource, sourceType), tableName);
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        const parsed = parseQualifiedTableName(dataSource, tableName);
        if (sourceType2 === "mysql") {
          const rows2 = await executeQuery(
            connection,
            sourceType2,
            `SELECT tc.constraint_name AS constraintName,
                tc.constraint_type AS constraintType,
                kcu.column_name AS columnName,
                kcu.referenced_table_name AS referencedTableName,
                kcu.referenced_column_name AS referencedColumnName,
                kcu.ordinal_position AS ordinalPosition
         FROM information_schema.table_constraints tc
         LEFT JOIN information_schema.key_column_usage kcu
           ON tc.constraint_schema = kcu.constraint_schema
          AND tc.table_name = kcu.table_name
          AND tc.constraint_name = kcu.constraint_name
         WHERE tc.table_schema = ? AND tc.table_name = ?
         ORDER BY tc.constraint_name ASC, kcu.ordinal_position ASC`,
            [parsed.database, parsed.tableName]
          );
          return groupConstraints(rows2);
        }
        const { database } = normalizeConnectionConfig(dataSource);
        const rows = await executeQuery(
          connection,
          sourceType2,
          `SELECT tc.constraint_name AS "constraintName",
              tc.constraint_type AS "constraintType",
              kcu.column_name AS "columnName",
              ccu.table_name AS "referencedTableName",
              ccu.column_name AS "referencedColumnName",
              kcu.ordinal_position AS "ordinalPosition"
       FROM information_schema.table_constraints tc
       LEFT JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
       LEFT JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
       WHERE tc.table_catalog = $1
         AND tc.table_schema = $2
         AND tc.table_name = $3
       ORDER BY tc.constraint_name ASC, kcu.ordinal_position ASC`,
          [database, parsed.schema, parsed.tableName]
        );
        return groupConstraints(rows);
      });
    }
    function sanitizeSampleRow(row) {
      return Object.fromEntries(
        Object.entries(row).map(([key, value]) => {
          if (value instanceof Date) {
            return [key, value.toISOString()];
          }
          if (Buffer.isBuffer(value)) {
            return [key, `[binary:${value.length}]`];
          }
          if (typeof value === "string") {
            return [key, value.length > 200 ? `${value.slice(0, 200)}...` : value];
          }
          return [key, value];
        })
      );
    }
    async function sampleRows(dataSource, tableName, limit = 100) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return sampleHiveRows(dataSource, tableName, limit);
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const adapter = getAdapter(sourceType);
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        const qualified = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
        const result = await adapter.executeQuery(config, `SELECT * FROM ${qualified}`, { resultLimit: limit });
        return (result.rows || []).map((row) => sanitizeSampleRow(row));
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        const safeLimit = Math.max(1, Math.min(100, Number(limit || 100)));
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType2);
        const rows = await executeQuery(connection, sourceType2, `SELECT * FROM ${qualifiedTable} LIMIT ${safeLimit}`);
        return rows.map((row) => sanitizeSampleRow(row));
      });
    }
    function addQueryParam(params, value, sourceType) {
      params.push(value);
      if (isPostgreSqlSource(sourceType)) return `$${params.length}`;
      if (normalizeSourceType(sourceType) === "oracle") return `:${params.length}`;
      return "?";
    }
    function buildSearchWhere(conditionGroups = [], sourceType, params, matchMode = "all") {
      const clauses = [];
      for (const group of conditionGroups) {
        const columns = Array.isArray(group.columns) ? group.columns.map((item) => String(item || "").trim()).filter(Boolean) : [];
        const values = Array.isArray(group.values) ? group.values.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
        if (!columns.length || !values.length) continue;
        const placeholdersByColumn = columns.map((columnName) => {
          const columnSql = escapeIdentifier(columnName, sourceType);
          const placeholders = values.map((value) => addQueryParam(params, value, sourceType)).join(", ");
          return `${columnSql} IN (${placeholders})`;
        });
        clauses.push(`(${placeholdersByColumn.join(" OR ")})`);
      }
      return clauses.join(matchMode === "any" ? " OR " : " AND ");
    }
    async function searchRows(dataSource, tableName, conditionGroups = [], options = {}) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        throw new AppError("\u5F53\u524D\u4E1A\u52A1\u6570\u636E\u68C0\u7D22\u6682\u4E0D\u652F\u6301 Hive \u6570\u636E\u6E90", 400);
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
        const countParams = [];
        const countWhere = buildSearchWhere(conditionGroups, sourceType, countParams, options.matchMode || "all");
        if (!countWhere) throw new AppError("\u4E1A\u52A1\u6570\u636E\u68C0\u7D22\u7F3A\u5C11\u6709\u6548\u5B57\u6BB5\u6761\u4EF6", 400);
        const adapter = getAdapter(sourceType);
        const countResult = await adapter.executeQuery(config, `SELECT COUNT(*) AS total FROM ${qualifiedTable} WHERE ${countWhere}`, { binds: countParams });
        const hitCount = Number(countResult.rows?.[0]?.total || countResult.rows?.[0]?.TOTAL || 0);
        if (!hitCount) return { hitCount: 0, rows: [] };
        const rowParams = [];
        const rowWhere = buildSearchWhere(conditionGroups, sourceType, rowParams, options.matchMode || "all");
        const rowResult = await adapter.executeQuery(config, `SELECT * FROM ${qualifiedTable} WHERE ${rowWhere}`, { binds: rowParams, resultLimit: options.limit || 20 });
        return { hitCount, rows: (rowResult.rows || []).map((row) => sanitizeSampleRow(row)) };
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        const safeLimit = Math.max(1, Math.min(100, Number(options.limit || 20)));
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType2);
        const countParams = [];
        const countWhere = buildSearchWhere(conditionGroups, sourceType2, countParams, options.matchMode || "all");
        if (!countWhere) {
          throw new AppError("\u4E1A\u52A1\u6570\u636E\u68C0\u7D22\u7F3A\u5C11\u6709\u6548\u5B57\u6BB5\u6761\u4EF6", 400);
        }
        const countRows2 = await executeQuery(
          connection,
          sourceType2,
          `SELECT COUNT(*) AS total FROM ${qualifiedTable} WHERE ${countWhere}`,
          countParams
        );
        const hitCount = Number(countRows2[0]?.total || countRows2[0]?.TOTAL || 0);
        if (hitCount === 0) {
          return { hitCount: 0, rows: [] };
        }
        const rowParams = [];
        const rowWhere = buildSearchWhere(conditionGroups, sourceType2, rowParams, options.matchMode || "all");
        const rows = await executeQuery(
          connection,
          sourceType2,
          `SELECT * FROM ${qualifiedTable} WHERE ${rowWhere} LIMIT ${safeLimit}`,
          rowParams
        );
        return {
          hitCount,
          rows: rows.map((row) => sanitizeSampleRow(row))
        };
      });
    }
    function findTableInfo(tables = [], dataSource, tableName) {
      const parsed = parseQualifiedTableName(dataSource, tableName);
      return tables.find((item) => item.tableName === parsed.tableName) || null;
    }
    async function inspectTableProfile(dataSource, tableName, options = {}) {
      const [columns, indexes, constraints, samples] = await Promise.all([
        listColumns(dataSource, tableName),
        listIndexes(dataSource, tableName),
        listConstraints(dataSource, tableName),
        sampleRows(dataSource, tableName, options.sampleSize || 100)
      ]);
      const table = options.tableInfo || null;
      return {
        tableName,
        tableComment: table?.tableComment || "",
        columns,
        indexes,
        constraints,
        sampleRows: samples
      };
    }
    async function inspectTableForRecommendation(dataSource, tableName) {
      const tables = await listTables(dataSource);
      return inspectTableProfile(dataSource, tableName, {
        sampleSize: 100,
        tableInfo: findTableInfo(tables, dataSource, tableName)
      });
    }
    async function countTableRows(connection, dataSource, tableName) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
      const rows = await executeQuery(connection, sourceType, `SELECT COUNT(*) AS total FROM ${qualifiedTable}`);
      return Number(rows[0]?.total || rows[0]?.TOTAL || 0);
    }
    async function countRows(dataSource, tableName) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return null;
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
        const result = await getAdapter(sourceType).executeQuery(config, `SELECT COUNT(*) AS total FROM ${qualifiedTable}`);
        return Number(result.rows?.[0]?.total || result.rows?.[0]?.TOTAL || 0);
      }
      return withConnection(dataSource, async (connection) => countTableRows(connection, dataSource, tableName));
    }
    function buildAdapterEstimateQuery(sourceType, config, parsed) {
      if (sourceType === "mysql") {
        return {
          sql: "SELECT table_rows AS estimatedRows FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1",
          binds: [parsed.database, parsed.tableName]
        };
      }
      if (sourceType === "postgresql") {
        return {
          sql: `SELECT CASE WHEN cls.reltuples < 0 THEN NULL ELSE cls.reltuples END AS "estimatedRows"
               FROM pg_class cls
               JOIN pg_namespace ns ON ns.oid = cls.relnamespace
              WHERE ns.nspname = $1 AND cls.relname = $2
              LIMIT 1`,
          binds: [parsed.schema, parsed.tableName]
        };
      }
      const owner = String(parsed.schema || config.schema || config.username || "").toUpperCase();
      const table = String(parsed.tableName || "").toUpperCase();
      const placeholders = sourceType === "oracle" ? [":1", ":2"] : ["?", "?"];
      return {
        sql: `SELECT num_rows AS estimatedRows FROM all_tables WHERE owner = ${placeholders[0]} AND table_name = ${placeholders[1]}`,
        binds: [owner, table]
      };
    }
    async function estimateRows(dataSource, tableName) {
      if (isHiveSource(dataSource?.sourceType, dataSource?.connectionConfig)) {
        return null;
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (usesAdapterRuntime(sourceType)) {
        const config = { ...dataSource?.connectionConfig || {}, sourceType };
        const parsed = parseQualifiedTableName(dataSource, tableName);
        const { sql, binds } = buildAdapterEstimateQuery(sourceType, config, parsed);
        const result = await getAdapter(sourceType).executeQuery(config, sql, { binds });
        const value = result.rows?.[0]?.estimatedRows ?? result.rows?.[0]?.ESTIMATEDROWS ?? result.rows?.[0]?.ESTIMATED_ROWS;
        return value === null || value === void 0 ? null : Math.round(Number(value));
      }
      return withConnection(dataSource, async (connection, sourceType2) => {
        const parsed = parseQualifiedTableName(dataSource, tableName);
        if (sourceType2 === "mysql") {
          const rows2 = await executeQuery(
            connection,
            sourceType2,
            `SELECT table_rows AS estimatedRows
         FROM information_schema.tables
         WHERE table_schema = ? AND table_name = ?
         LIMIT 1`,
            [parsed.database, parsed.tableName]
          );
          return rows2[0]?.estimatedRows === null || rows2[0]?.estimatedRows === void 0 ? null : Number(rows2[0].estimatedRows);
        }
        const rows = await executeQuery(
          connection,
          sourceType2,
          `SELECT CASE WHEN cls.reltuples < 0 THEN NULL ELSE cls.reltuples END AS "estimatedRows"
       FROM pg_class cls
       JOIN pg_namespace ns ON ns.oid = cls.relnamespace
       WHERE ns.nspname = $1 AND cls.relname = $2
       LIMIT 1`,
          [parsed.schema, parsed.tableName]
        );
        return rows[0]?.estimatedRows === null || rows[0]?.estimatedRows === void 0 ? null : Math.round(Number(rows[0].estimatedRows));
      });
    }
    async function countNullRows(connection, dataSource, tableName, columnName) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
      const qualifiedColumn = escapeIdentifier(columnName, sourceType);
      const rows = await executeQuery(
        connection,
        sourceType,
        `SELECT COUNT(*) AS total
     FROM ${qualifiedTable}
     WHERE ${qualifiedColumn} IS NULL`
      );
      return Number(rows[0]?.total || rows[0]?.TOTAL || 0);
    }
    async function countLengthOverflowRows(connection, dataSource, tableName, columnName, maxLength) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
      const qualifiedColumn = escapeIdentifier(columnName, sourceType);
      const rows = await executeQuery(
        connection,
        sourceType,
        `SELECT COUNT(*) AS total
     FROM ${qualifiedTable}
     WHERE ${qualifiedColumn} IS NOT NULL
       AND CHAR_LENGTH(${qualifiedColumn}) > ${Number(maxLength)}`
      );
      return Number(rows[0]?.total || rows[0]?.TOTAL || 0);
    }
    async function findDuplicatePrimaryKeyGroups(connection, dataSource, tableName, primaryKeyColumns) {
      if (!primaryKeyColumns.length) {
        return 0;
      }
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
      const keySql = primaryKeyColumns.map((columnName) => escapeIdentifier(columnName, sourceType)).join(", ");
      const whereSql = primaryKeyColumns.map((columnName) => `${escapeIdentifier(columnName, sourceType)} IS NOT NULL`).join(" AND ");
      const rows = await executeQuery(
        connection,
        sourceType,
        `SELECT COUNT(*) AS total
     FROM (
       SELECT ${keySql}
       FROM ${qualifiedTable}
       WHERE ${whereSql}
       GROUP BY ${keySql}
       HAVING COUNT(*) > 1
     ) duplicates`
      );
      return Number(rows[0]?.total || rows[0]?.TOTAL || 0);
    }
    async function precheckSyncPlan(connection, dataSource, tableName, existingColumns, expectedColumns, plan) {
      const tableRowCount = await countTableRows(connection, dataSource, tableName);
      const existingColumnMap = new Map(existingColumns.map((column) => [column.columnName, column]));
      const lengthSensitiveTypes = ["varchar", "char", "character varying", "character"];
      for (const column of plan.additions) {
        const hasDefaultValue = normalizeDefaultValueForCompare(column.columnDefault) !== null;
        if (!column.isNullable && !hasDefaultValue && tableRowCount > 0) {
          throw new AppError(
            `\u76EE\u6807\u8868 ${tableName} \u5DF2\u6709 ${tableRowCount} \u6761\u6570\u636E\uFF0C\u65B0\u589E\u5FC5\u586B\u5B57\u6BB5 ${column.columnName} \u65F6\u5FC5\u987B\u5148\u63D0\u4F9B\u9ED8\u8BA4\u503C\u6216\u5141\u8BB8\u4E3A\u7A7A`,
            400,
            { field: column.columnName, reason: "required_column_without_default" }
          );
        }
      }
      for (const column of plan.modifications) {
        const existingColumn = existingColumnMap.get(column.columnName);
        if (!existingColumn) {
          continue;
        }
        if (existingColumn.isNullable && !column.isNullable) {
          const nullCount = await countNullRows(connection, dataSource, tableName, column.columnName);
          if (nullCount > 0) {
            throw new AppError(
              `\u76EE\u6807\u5B57\u6BB5 ${column.columnName} \u73B0\u6709 ${nullCount} \u6761\u7A7A\u503C\u6570\u636E\uFF0C\u65E0\u6CD5\u6539\u4E3A NOT NULL\uFF0C\u8BF7\u5148\u6E05\u6D17\u6570\u636E`,
              400,
              { field: column.columnName, reason: "null_values_exist", count: nullCount }
            );
          }
        }
        const existingType = parseColumnTypeDefinition(existingColumn.columnType);
        const expectedType = parseColumnTypeDefinition(column.columnType);
        if (lengthSensitiveTypes.includes(existingType.baseType) && lengthSensitiveTypes.includes(expectedType.baseType)) {
          const existingLength = Number(existingType.args[0] || 0);
          const expectedLength = Number(expectedType.args[0] || 0);
          if (existingLength > 0 && expectedLength > 0 && expectedLength < existingLength) {
            const overflowCount = await countLengthOverflowRows(connection, dataSource, tableName, column.columnName, expectedLength);
            if (overflowCount > 0) {
              throw new AppError(
                `\u76EE\u6807\u5B57\u6BB5 ${column.columnName} \u6709 ${overflowCount} \u6761\u6570\u636E\u957F\u5EA6\u8D85\u8FC7 ${expectedLength}\uFF0C\u65E0\u6CD5\u6536\u7F29\u5B57\u6BB5\u957F\u5EA6`,
                400,
                { field: column.columnName, reason: "value_too_long", count: overflowCount, maxLength: expectedLength }
              );
            }
          }
        }
      }
      if (plan.primaryKeyChanged) {
        const expectedPrimaryKeys = getPrimaryKeyColumns(expectedColumns);
        for (const columnName of expectedPrimaryKeys) {
          const nullCount = await countNullRows(connection, dataSource, tableName, columnName);
          if (nullCount > 0) {
            throw new AppError(
              `\u76EE\u6807\u4E3B\u952E\u5B57\u6BB5 ${columnName} \u5B58\u5728 ${nullCount} \u6761\u7A7A\u503C\u6570\u636E\uFF0C\u65E0\u6CD5\u8BBE\u7F6E\u4E3B\u952E`,
              400,
              { field: columnName, reason: "primary_key_null_values", count: nullCount }
            );
          }
        }
        const duplicateGroups = await findDuplicatePrimaryKeyGroups(connection, dataSource, tableName, expectedPrimaryKeys);
        if (duplicateGroups > 0) {
          throw new AppError(
            `\u76EE\u6807\u8868 ${tableName} \u5728\u65B0\u4E3B\u952E\u7EC4\u5408\u4E0A\u5B58\u5728 ${duplicateGroups} \u7EC4\u91CD\u590D\u6570\u636E\uFF0C\u65E0\u6CD5\u8BBE\u7F6E\u4E3B\u952E`,
            400,
            { fields: expectedPrimaryKeys, reason: "primary_key_duplicates", count: duplicateGroups }
          );
        }
      }
    }
    async function createTableFromColumns(dataSource, tableName, columns, options = {}) {
      if (!Array.isArray(columns) || columns.length === 0) {
        throw new AppError("\u65E0\u6CD5\u521B\u5EFA\u76EE\u6807\u8868\uFF0C\u6765\u6E90\u8868\u7F3A\u5C11\u5B57\u6BB5\u5B9A\u4E49", 400);
      }
      return withConnection(dataSource, async (connection, sourceType) => {
        await executeQuery(connection, sourceType, buildCreateTableSql(dataSource, tableName, columns, options));
        await applyTableAndColumnComments(connection, dataSource, tableName, columns, options);
        return { tableName, created: true };
      });
    }
    async function getExistingColumns(connection, dataSource, tableName) {
      const sourceType = normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig);
      if (sourceType === "mysql") {
        const parsed = parseQualifiedTableName(dataSource, tableName);
        const rows = await executeQuery(
          connection,
          sourceType,
          `SELECT column_name AS columnName,
              ordinal_position AS ordinalPosition,
              data_type AS dataType,
              column_type AS columnType,
              is_nullable AS isNullable,
              column_default AS columnDefault,
              column_key AS columnKey,
              extra AS extra,
              column_comment AS columnComment
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ?
       ORDER BY ordinal_position ASC`,
          [parsed.database, parsed.tableName]
        );
        return rows.map((row) => ({
          ...row,
          isNullable: row.isNullable === "YES",
          isPrimaryKey: row.columnKey === "PRI"
        }));
      }
      return listColumns(dataSource, tableName);
    }
    async function syncTableColumnsMySql(connection, dataSource, tableName, columns, options = {}) {
      const existingColumns = await getExistingColumns(connection, dataSource, tableName);
      const plan = getColumnSyncPlan(existingColumns, columns, "mysql");
      const changes = [];
      await precheckSyncPlan(connection, dataSource, tableName, existingColumns, columns, plan);
      try {
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), "mysql");
        for (const column of plan.additions) {
          await executeQuery(connection, "mysql", `ALTER TABLE ${qualifiedTable} ADD COLUMN ${buildColumnDefinitionSql("mysql", column)}`);
          changes.push(`add:${column.columnName}`);
        }
        for (const column of plan.modifications) {
          await executeQuery(connection, "mysql", `ALTER TABLE ${qualifiedTable} MODIFY COLUMN ${buildColumnDefinitionSql("mysql", column)}`);
          changes.push(`modify:${column.columnName}`);
        }
        if (plan.primaryKeyChanged) {
          const existingPrimaryKeys = getPrimaryKeyColumns(existingColumns);
          const expectedPrimaryKeys = getPrimaryKeyColumns(columns);
          if (existingPrimaryKeys.length > 0) {
            await executeQuery(connection, "mysql", `ALTER TABLE ${qualifiedTable} DROP PRIMARY KEY`);
            changes.push("drop_primary_key");
          }
          if (expectedPrimaryKeys.length > 0) {
            await executeQuery(
              connection,
              "mysql",
              `ALTER TABLE ${qualifiedTable} ADD PRIMARY KEY (${expectedPrimaryKeys.map((columnName) => escapeIdentifier(columnName, "mysql")).join(", ")})`
            );
            changes.push(`add_primary_key:${expectedPrimaryKeys.join(",")}`);
          }
        }
      } catch (error) {
        throw buildFriendlyAlterError(error, tableName);
      }
      await applyTableAndColumnComments(connection, dataSource, tableName, columns, options);
      return { tableName, synced: changes.length > 0, changes };
    }
    async function getPostgreSqlPrimaryKeyConstraintName(connection, dataSource, tableName) {
      const parsed = parseQualifiedTableName(dataSource, tableName);
      const rows = await executeQuery(
        connection,
        POSTGRESQL,
        `SELECT tc.constraint_name AS "constraintName"
     FROM information_schema.table_constraints tc
     WHERE tc.table_schema = $1
       AND tc.table_name = $2
       AND tc.constraint_type = 'PRIMARY KEY'
     LIMIT 1`,
        [parsed.schema, parsed.tableName]
      );
      return rows[0]?.constraintName || null;
    }
    function buildPostgreSqlColumnAlterationStatements(tableName, existingColumn, expectedColumn) {
      const qualifiedTable = escapeIdentifier(tableName, POSTGRESQL);
      const qualifiedColumn = escapeIdentifier(expectedColumn.columnName, POSTGRESQL);
      const statements = [];
      if (!arePostgreSqlColumnTypesEquivalent(existingColumn.columnType, expectedColumn.columnType)) {
        const usingExpression = buildPostgreSqlUsingExpression(
          expectedColumn.columnName,
          existingColumn.columnType,
          expectedColumn.columnType
        );
        statements.push(
          `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} TYPE ${expectedColumn.columnType}${usingExpression ? ` USING ${usingExpression}` : ""}`
        );
      }
      if (Boolean(existingColumn.isNullable) !== Boolean(expectedColumn.isNullable)) {
        statements.push(
          expectedColumn.isNullable ? `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} DROP NOT NULL` : `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} SET NOT NULL`
        );
      }
      if (normalizeDefaultValueForCompare(existingColumn.columnDefault) !== normalizeDefaultValueForCompare(expectedColumn.columnDefault)) {
        const formattedDefault = formatDefaultValue(POSTGRESQL, expectedColumn.columnDefault);
        statements.push(
          formattedDefault === null ? `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} DROP DEFAULT` : `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${qualifiedColumn} SET DEFAULT ${formattedDefault}`
        );
      }
      return statements;
    }
    async function applyPostgreSqlColumnAlterations(connection, dataSource, tableName, existingColumn, column) {
      const statements = buildPostgreSqlColumnAlterationStatements(
        buildQualifiedTableName(dataSource, tableName),
        existingColumn,
        column
      );
      for (const sql of statements) {
        await executeQuery(connection, POSTGRESQL, sql);
      }
    }
    async function syncTableColumnsPostgreSql(connection, dataSource, tableName, columns, options = {}) {
      const existingColumns = await getExistingColumns(connection, dataSource, tableName);
      const plan = getColumnSyncPlan(existingColumns, columns, POSTGRESQL);
      const changes = [];
      await precheckSyncPlan(connection, dataSource, tableName, existingColumns, columns, plan);
      try {
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), POSTGRESQL);
        for (const column of plan.additions) {
          await executeQuery(connection, POSTGRESQL, `ALTER TABLE ${qualifiedTable} ADD COLUMN ${buildColumnDefinitionSql(POSTGRESQL, column)}`);
          changes.push(`add:${column.columnName}`);
        }
        const existingColumnMap = new Map(existingColumns.map((column) => [column.columnName, column]));
        for (const column of plan.modifications) {
          await applyPostgreSqlColumnAlterations(
            connection,
            dataSource,
            tableName,
            existingColumnMap.get(column.columnName),
            column
          );
          changes.push(`modify:${column.columnName}`);
        }
        if (plan.primaryKeyChanged) {
          const existingConstraintName = await getPostgreSqlPrimaryKeyConstraintName(connection, dataSource, tableName);
          const expectedPrimaryKeys = getPrimaryKeyColumns(columns);
          if (existingConstraintName) {
            await executeQuery(
              connection,
              POSTGRESQL,
              `ALTER TABLE ${qualifiedTable} DROP CONSTRAINT ${escapeIdentifier(existingConstraintName, POSTGRESQL)}`
            );
            changes.push("drop_primary_key");
          }
          if (expectedPrimaryKeys.length > 0) {
            await executeQuery(
              connection,
              POSTGRESQL,
              `ALTER TABLE ${qualifiedTable} ADD PRIMARY KEY (${expectedPrimaryKeys.map((columnName) => escapeIdentifier(columnName, POSTGRESQL)).join(", ")})`
            );
            changes.push(`add_primary_key:${expectedPrimaryKeys.join(",")}`);
          }
        }
      } catch (error) {
        throw buildFriendlyAlterError(error, tableName);
      }
      await applyTableAndColumnComments(connection, dataSource, tableName, columns, options);
      return { tableName, synced: changes.length > 0, changes };
    }
    async function syncTableColumns(dataSource, tableName, columns, options = {}) {
      if (!Array.isArray(columns) || columns.length === 0) {
        throw new AppError("\u65E0\u6CD5\u540C\u6B65\u76EE\u6807\u8868\uFF0C\u5B57\u6BB5\u5B9A\u4E49\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      return withConnection(dataSource, async (connection, sourceType) => {
        if (sourceType === "mysql") {
          return syncTableColumnsMySql(connection, dataSource, tableName, columns, options);
        }
        return syncTableColumnsPostgreSql(connection, dataSource, tableName, columns, options);
      });
    }
    async function ensureTableMatchesColumns(dataSource, tableName, columns, options = {}) {
      if (!Array.isArray(columns) || columns.length === 0) {
        throw new AppError("\u65E0\u6CD5\u6821\u9A8C\u76EE\u6807\u8868\uFF0C\u5B57\u6BB5\u5B9A\u4E49\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      const tables = await listTables(dataSource);
      const parsed = parseQualifiedTableName(dataSource, tableName);
      const tableExists = tables.some((table) => table.tableName === parsed.tableName);
      if (!tableExists) {
        await createTableFromColumns(dataSource, tableName, columns, options);
        return { tableName, action: "created", reason: "table_not_exists" };
      }
      const existingColumns = await listColumns(dataSource, tableName);
      const plan = getColumnSyncPlan(existingColumns, columns, normalizeSourceType(dataSource?.sourceType, dataSource?.connectionConfig));
      if (plan.additions.length === 0 && plan.modifications.length === 0 && !plan.primaryKeyChanged) {
        await withConnection(dataSource, async (connection, sourceType) => {
          await applyTableAndColumnComments(connection, dataSource, tableName, columns, options);
        });
        return { tableName, action: "unchanged", reason: null };
      }
      const result = await syncTableColumns(dataSource, tableName, columns, options);
      return {
        tableName,
        action: "synced",
        reason: "schema_mismatch",
        changes: result.changes
      };
    }
    async function getColumnMaximum(dataSource, tableName, columnName) {
      return withConnection(dataSource, async (connection, sourceType) => {
        const qualifiedTable = escapeIdentifier(buildQualifiedTableName(dataSource, tableName), sourceType);
        const qualifiedColumn = escapeIdentifier(columnName, sourceType);
        const rows = await executeQuery(
          connection,
          sourceType,
          `SELECT MAX(${qualifiedColumn}) AS max_value FROM ${qualifiedTable}`
        );
        return rows[0] ? rows[0].max_value : null;
      });
    }
    module2.exports = {
      listTables,
      listColumns,
      listIndexes,
      listConstraints,
      sampleRows,
      searchRows,
      countRows,
      estimateRows,
      inspectTableProfile,
      inspectTableForRecommendation,
      createTableFromColumns,
      syncTableColumns,
      ensureTableMatchesColumns,
      getColumnMaximum,
      escapeValue,
      escapeIdentifier,
      __test: {
        buildAdapterEstimateQuery,
        buildColumnDefinitionSql,
        formatDefaultValue,
        normalizePostgreSqlColumnDefault,
        normalizeDefaultValueForCompare,
        arePostgreSqlColumnTypesEquivalent,
        buildPostgreSqlColumnAlterationStatements
      }
    };
  }
});

// backend/src/modules/asset-search/asset-search.service.js
var require_asset_search_service = __commonJS({
  "backend/src/modules/asset-search/asset-search.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var repository = require_asset_search_repository();
    var aiAssistant = require_asset_search_ai();
    var dataMapAdapter = require_data_map_adapter();
    var ingestionAdapter = require_ingestion_adapter();
    var qualityAdapter = require_quality_adapter();
    var servicesAdapter = require_services_adapter();
    var modelProviderService = require_model_provider_service();
    var metadataService = require_data_source_metadata();
    var MODULE_PERMISSION_MAP = {
      data_map: "data_map",
      ingestion: "ingestion",
      quality: "quality",
      services: "services"
    };
    var ADAPTERS = {
      data_map: dataMapAdapter,
      ingestion: ingestionAdapter,
      quality: qualityAdapter,
      services: servicesAdapter
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
      const filters = { ...payload.filters || {} };
      const dataSourceRef = String(filters.dataSourceRef || "").trim();
      let requestedModules = payload.sourceModules || [];
      if (dataSourceRef.includes(":")) {
        const [sourceModule, rawId] = dataSourceRef.split(":");
        if (repository.SOURCE_MODULES.includes(sourceModule)) {
          filters.dataSourceModule = sourceModule;
          filters.dataSourceId = rawId;
          requestedModules = requestedModules.length > 0 ? requestedModules.filter((moduleName) => moduleName === sourceModule) : [sourceModule];
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
        limit: repository.clampLimit(payload.limit)
      };
    }
    function uniqueStrings(values = [], limit = 30) {
      const result = [];
      const seen = /* @__PURE__ */ new Set();
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
          ...criteria.keywordTerms || [],
          ...expandedKeywords,
          ...extraTerms
        ], 30)
      };
    }
    function expandAiRecallCriteria(criteria) {
      return {
        ...criteria,
        limit: Math.min(Math.max(Number(criteria.limit || 100), 50), 500)
      };
    }
    function dedupeResults(results = []) {
      const seen = /* @__PURE__ */ new Map();
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
      const results = dedupeResults(settled.flatMap((item) => item.status === "fulfilled" ? item.value : [])).sort((left, right) => Number(right.score || 0) - Number(left.score || 0)).slice(0, criteria.limit);
      return {
        results,
        errors: settled.map((item, index) => item.status === "rejected" ? { sourceModule: adapterEntries[index]?.[0] || "unknown", message: item.reason?.message || "\u68C0\u7D22\u5931\u8D25" } : null).filter(Boolean)
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
        byStatus
      };
    }
    function buildFacets(results = []) {
      const stats = buildStats(results);
      const toFacet = (values) => Object.entries(values).map(([value, count]) => ({ value, count })).sort((left, right) => Number(right.count) - Number(left.count));
      return {
        assetTypes: toFacet(stats.byAssetType),
        sourceModules: toFacet(stats.bySourceModule),
        statuses: toFacet(stats.byStatus)
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
          fallbackReason: ""
        };
      }
      const topTypes = Object.entries(buildStats(results).byAssetType).sort((left, right) => right[1] - left[1]).slice(0, 3).map(([type, count]) => `${repository.ASSET_TYPE_LABELS[type] || type} ${count} \u4E2A`);
      return {
        enabled: false,
        intent: criteria.keyword ? `\u5DF2\u6309\u5173\u952E\u8BCD\u53EC\u56DE\u5019\u9009\u8D44\u4EA7\uFF1A${criteria.keyword}` : "\u5DF2\u6309\u7B5B\u9009\u6761\u4EF6\u53EC\u56DE\u5019\u9009\u8D44\u4EA7",
        expandedKeywords: criteria.keywordTerms,
        summary: topTypes.length > 0 ? `AI \u8F85\u52A9\u5F53\u524D\u4E0D\u53EF\u7528\uFF0C\u5DF2\u964D\u7EA7\u4E3A\u666E\u901A\u68C0\u7D22\u3002\u672C\u6B21\u7ED3\u6784\u5316\u53EC\u56DE\u5305\u542B ${topTypes.join("\u3001")}\u3002` : "AI \u8F85\u52A9\u5F53\u524D\u4E0D\u53EF\u7528\uFF0C\u5DF2\u964D\u7EA7\u4E3A\u666E\u901A\u68C0\u7D22\uFF0C\u5F53\u524D\u6761\u4EF6\u6CA1\u6709\u53EC\u56DE\u5019\u9009\u8D44\u4EA7\u3002",
        suggestions: [
          "\u5982\u9700\u5B57\u6BB5\u5B9A\u4F4D\uFF0C\u53EF\u76F4\u63A5\u8F93\u5165\u5B57\u6BB5\u540D\u3001\u5B57\u6BB5\u6CE8\u91CA\u6216\u82F1\u6587\u5217\u540D\u3002",
          "\u5982\u9700\u8DE8\u6A21\u5757\u6536\u655B\uFF0C\u53EF\u9650\u5236\u6765\u6E90\u6A21\u5757\u6216\u8D44\u4EA7\u7C7B\u578B\u540E\u518D\u6B21\u68C0\u7D22\u3002"
        ],
        recommendedResults: [],
        fallbackReason
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
        errors: searchOutput.errors || []
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
      return Object.entries(runtime).filter(([, stageRuntime]) => Boolean(stageRuntime)).map(([stage]) => aiAssistant.SCENE_CODES[stage] || stage);
    }
    async function saveAiRunSafely(payload, user) {
      try {
        await repository.saveAiRun(payload, user);
      } catch {
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
          durationMs: Date.now() - startedAt
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
          ...queryInsight.usedStages || [],
          ...rerankOutput.usedStages || [],
          ...summaryOutput.usedStages || []
        ], 10);
        const response = buildSearchResponse(criteria, "ai", {
          ...summaryOutput.ai,
          enabled: true,
          fallbackReason: "",
          usedStages
        }, {
          results: limitedResults,
          errors: output.errors
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
          durationMs: Date.now() - startedAt
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
          errorMessage: error?.message || "AI \u68C0\u7D22\u5931\u8D25"
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
      return conditions.map((condition) => ({
        elementId: Number(condition.elementId),
        values: uniqueStrings(condition.values || [], 20)
      })).filter((condition) => condition.elementId > 0 && condition.values.length > 0);
    }
    function groupTargetsByResource(targets = []) {
      const grouped = /* @__PURE__ */ new Map();
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
            fields: []
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
          values: condition.values
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
            values: condition.values
          });
        }
      }
      return { groups, matchedFields };
    }
    async function businessDataSearch(payload, user) {
      const permissions = userModulePermissions(user);
      if (!permissions.has("data_map")) {
        throw new AppError("\u65E0\u6570\u636E\u5730\u56FE\u6743\u9650\uFF0C\u65E0\u6CD5\u6267\u884C\u4E1A\u52A1\u6570\u636E\u68C0\u7D22", 403);
      }
      const conditions = normalizeBusinessDataConditions(payload.conditions || []);
      if (!conditions.length) {
        throw new AppError("\u4E1A\u52A1\u6570\u636E\u68C0\u7D22\u81F3\u5C11\u9700\u8981\u4E00\u4E2A\u6709\u6548\u6570\u636E\u5143\u6761\u4EF6", 400);
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
            limit: perResourceLimit
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
              { label: "\u67E5\u770B\u8D44\u6E90\u8BE6\u60C5", path: `/dashboard/data-map/resources/${resourceGroup.resourceId}` }
            ]
          });
        } catch (error) {
          errors.push({
            resourceId: resourceGroup.resourceId,
            resourceCode: resourceGroup.resourceCode,
            tableName: resourceGroup.tableName,
            message: error?.message || "\u4E1A\u52A1\u6570\u636E\u68C0\u7D22\u5931\u8D25"
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
          totalRows: results.reduce((sum, item) => sum + Number(item.hitCount || 0), 0)
        },
        results,
        errors
      };
    }
    async function suggest(query, user) {
      const payload = {
        keyword: String(query.q || query.keyword || "").trim(),
        aiEnabled: false,
        scopes: [],
        sourceModules: String(query.sourceModule || "").trim() ? [String(query.sourceModule).trim()] : [],
        filters: {},
        limit: Math.min(Number(query.limit || 10), 20)
      };
      const response = await search(payload, user);
      return response.results.slice(0, payload.limit).map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        assetType: item.assetType,
        sourceModule: item.sourceModule
      }));
    }
    async function facets(query = {}, user) {
      const requestedModules = String(query.sourceModules || query.sourceModule || "").split(",").map((item) => item.trim()).filter(Boolean);
      const authorizedModules = resolveAuthorizedModules(user, requestedModules);
      const authorizedModuleSet = new Set(authorizedModules);
      const options = await repository.loadFacetOptions();
      return {
        ...options,
        sourceModules: options.sourceModules.filter((item) => authorizedModuleSet.has(item.value)),
        departments: authorizedModuleSet.has("data_map") ? options.departments : [],
        businessSystems: authorizedModuleSet.has("data_map") ? options.businessSystems : [],
        dataSources: options.dataSources.filter((item) => authorizedModuleSet.has(item.sourceModule))
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
          defaultModelVersion: null
        };
      }
      const provider = await modelProviderService.getModelProviderById(defaultModelProviderId);
      if (!provider) {
        throw new AppError("\u9ED8\u8BA4\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 400);
      }
      if (provider.modelCategory !== "chat") {
        throw new AppError("\u9ED8\u8BA4\u6A21\u578B\u5FC5\u987B\u9009\u62E9\u5BF9\u8BDD\u6A21\u578B", 400);
      }
      return {
        defaultModelProviderId: Number(defaultModelProviderId),
        defaultModelName: String(defaultModelName || provider.modelName || "").trim() || provider.modelName,
        defaultModelVersion: String(defaultModelVersion || provider.modelVersion || provider.modelName || "").trim() || provider.modelVersion || provider.modelName
      };
    }
    async function updateAiConfig(id, payload) {
      const existing = await repository.getAiConfigById(id);
      if (!existing) {
        throw new AppError("\u8D44\u4EA7\u68C0\u7D22\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
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
        status: payload.status || existing.status
      });
      if (!row) {
        throw new AppError("\u8D44\u4EA7\u68C0\u7D22\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
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
        status: status || void 0
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
        submittedBy: user?.username || "system"
      };
    }
    module2.exports = {
      businessDataSearch,
      facets,
      feedback,
      listAiConfigs,
      listAiRuns,
      search,
      suggest,
      updateAiConfig
    };
  }
});

// backend/src/modules/asset-search/asset-search.controller.js
var require_asset_search_controller = __commonJS({
  "backend/src/modules/asset-search/asset-search.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var service = require_asset_search_service();
    async function search(req, res) {
      return sendSuccess(res, await service.search(req.validatedBody, req.user));
    }
    async function businessDataSearch(req, res) {
      return sendSuccess(res, await service.businessDataSearch(req.validatedBody, req.user));
    }
    async function suggest(req, res) {
      const rows = await service.suggest(req.query || {}, req.user);
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function facets(req, res) {
      return sendSuccess(res, await service.facets(req.query || {}, req.user));
    }
    async function feedback(req, res) {
      return sendSuccess(res, await service.feedback(req.validatedBody, req.user), null, 201);
    }
    async function listAiConfigs(req, res) {
      const rows = await service.listAiConfigs();
      return sendSuccess(res, rows, { total: rows.length });
    }
    async function updateAiConfig(req, res) {
      return sendSuccess(res, await service.updateAiConfig(Number(req.params.id), req.validatedBody));
    }
    async function listAiRuns(req, res) {
      const rows = await service.listAiRuns(req.query || {}, req.user);
      return sendSuccess(res, rows, { total: rows.length });
    }
    module2.exports = {
      businessDataSearch,
      facets,
      feedback,
      listAiConfigs,
      listAiRuns,
      search,
      suggest,
      updateAiConfig
    };
  }
});

// packages/data-platform-module-asset-search/src/.runtime-entry.js
var controller0 = require_asset_search_controller();
var { Writable } = require("node:stream");
var handlers = {
  "POST /api/v1/asset-search/search": controller0["search"],
  "POST /api/v1/asset-search/business-data/search": controller0["businessDataSearch"],
  "GET /api/v1/asset-search/suggest": controller0["suggest"],
  "GET /api/v1/asset-search/facets": controller0["facets"],
  "GET /api/v1/asset-search/ai-configs": controller0["listAiConfigs"],
  "PUT /api/v1/asset-search/ai-configs/:id": controller0["updateAiConfig"],
  "GET /api/v1/asset-search/ai-runs": controller0["listAiRuns"],
  "POST /api/v1/asset-search/feedback": controller0["feedback"]
};
function routeParams(apiKey, input) {
  const pathTemplate = apiKey.slice(apiKey.indexOf(" ") + 1);
  const params = { ...input && input.params || {} };
  for (const match of pathTemplate.matchAll(/:([A-Za-z0-9_]+)/g)) {
    const name = match[1];
    if (params[name] === void 0) params[name] = input?.[name] ?? (name === "id" ? input?.id : void 0);
  }
  if (pathTemplate.includes("*") && params[0] === void 0) params[0] = input?.path || "/";
  return params;
}
function createResponse() {
  const response = new Writable({
    write(chunk, _encoding, callback) {
      this.chunks.push(Buffer.from(chunk));
      callback();
    },
    final(callback) {
      this.payload ??= Buffer.concat(this.chunks);
      callback();
    }
  });
  response.statusCode = 200;
  response.headers = {};
  response.payload = void 0;
  response.chunks = [];
  response.status = function status(code) {
    this.statusCode = code;
    return this;
  };
  response.setHeader = function setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value;
    return this;
  };
  response.json = function json(value) {
    this.payload = value;
    this.end();
    return value;
  };
  response.send = function send(value) {
    this.payload = value;
    this.end();
    return value;
  };
  response.download = function download(file, name) {
    this.payload = { path: file, filename: name };
    this.end();
    return this.payload;
  };
  return response;
}
async function executeCapability(definition, input = {}, context = {}) {
  const apiKey = definition.sourceApiKeys[0];
  const handler = handlers[apiKey];
  if (typeof handler !== "function") {
    const error = new Error("No bundled handler for " + apiKey);
    error.code = "CAPABILITY_HANDLER_MISSING";
    throw error;
  }
  const method = apiKey.slice(0, apiKey.indexOf(" "));
  const body = input.body && typeof input.body === "object" ? input.body : input;
  const req = context.request || {
    method,
    params: routeParams(apiKey, input),
    query: input.query || (method === "GET" ? input : {}),
    body,
    validatedBody: body,
    headers: input.headers || {},
    user: context.actor || input.actor || null,
    projectId: context.projectId || input.projectId || null,
    file: input.file || null,
    files: input.files || null,
    ip: null,
    protocol: "cli",
    socket: {},
    get(name) {
      return this.headers[String(name).toLowerCase()] || this.headers[name] || "";
    }
  };
  const res = context.response || createResponse();
  const returned = await handler(req, res);
  if (!context.response && returned === res && !res.writableFinished) {
    await new Promise((resolve, reject) => {
      res.once("finish", resolve);
      res.once("error", reject);
    });
  }
  const payload = res.payload === void 0 ? returned : res.payload;
  if (context.response) {
    return { data: payload, meta: null, statusCode: res.statusCode, headers: res.headers || {} };
  }
  if (payload && payload.success === true && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return { data: payload.data, meta: payload.meta ?? null, statusCode: res.statusCode, headers: res.headers };
  }
  return { data: payload, meta: null, statusCode: res.statusCode, headers: res.headers };
}
module.exports = { executeCapability, createResponse, handlerApiKeys: Object.freeze(Object.keys(handlers)) };
