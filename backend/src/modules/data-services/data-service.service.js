const crypto = require("crypto");
const mysql = require("mysql2/promise");
const {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} = require("docx");
const AppError = require("../../common/errors/app-error");
const metadataService = require("../data-sources/data-source.metadata");
const { testDatabaseConnection } = require("../data-sources/data-source.test-connection");
const repository = require("./data-service.repository");
const { createPostgresLikeClient } = require("../../common/utils/db-client");
const { resolveDatasourceConnection } = require("../../common/utils/datasource-dialect");
const { getAdapter } = require("../data-development/adapters");
const { getManagedBinding } = require("../../common/utils/managed-jdbc-runtime");
const modelProviderService = require("../model-providers/model-provider.service");
const {
  buildServiceSql,
  isIpAllowed,
  normalizeAuthType,
  normalizeIpList,
  normalizeRequestMethod,
  normalizeServiceMode,
  normalizeServicePath,
  normalizeServiceStatus,
  normalizeServiceType,
  normalizeSourceSql,
  sanitizeRequestParams,
} = require("./data-service.runtime");

function buildDuplicateErrorMessage(error, defaultMessage) {
  if (error?.code === "ER_DUP_ENTRY") {
    return "编码或路径已存在，请调整后重试";
  }
  return defaultMessage;
}

function buildAppDuplicateErrorMessage(error, defaultMessage) {
  if (error?.code === "ER_DUP_ENTRY") {
    return "应用编码或令牌已存在，请调整后重试";
  }
  return defaultMessage;
}

function buildDataSourceDuplicateErrorMessage(error, defaultMessage) {
  if (error?.code === "ER_DUP_ENTRY") {
    return "数据源编码已存在，请调整后重试";
  }
  return defaultMessage;
}

const DEFAULT_SERVICE_CONFIG_SYSTEM_PROMPT = [
  "你是资深数据服务架构师，负责为“数据服务 / 表转 API 或 SQL 转 API”生成可直接落地的推荐配置。",
  "你必须综合数据源类型、表结构或 SQL 结果字段、样例数据与当前表单上下文，给出服务名称、服务编码、接口路径、请求方式、查询参数和返回字段建议。",
  "对于列表服务，优先推荐更新时间类字段作为默认排序字段，排序方向优先倒序(desc)。",
  "服务编码只允许小写字母、数字、下划线；如果允许留空，也要同时给出一个可直接落地的建议值。",
  "输出必须是 JSON，不要输出 Markdown，不要解释。",
  "字段固定为：serviceName、serviceCode、servicePath、requestMethod、serviceType、description、defaultSortField、defaultSortOrder、queryFields、responseFieldNames、reasoning。",
  "queryFields 中可包含 requirementMode(required|optional|one_of_group) 与 requiredGroup。",
  "如果信息不足，优先返回保守且可执行的建议。",
].join("\n");

function normalizeText(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function sanitizeSqlText(sql = "") {
  return String(sql || "")
    .replace(/;\s*$/g, "")
    .trim();
}

function slugifyIdentifier(value, fallback = "service") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function guessFieldDataTypeFromValue(value) {
  if (value === null || value === undefined || value === "") return "string";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "boolean") return "boolean";
  const text = String(value).trim();
  if (!text) return "string";
  if (/^-?\d+$/.test(text)) return "integer";
  if (/^-?\d+\.\d+$/.test(text)) return "number";
  if (/^(true|false)$/i.test(text)) return "boolean";
  if (/^\d{4}-\d{2}-\d{2}(?:[ tT]\d{2}:\d{2}:\d{2})?/.test(text)) return "datetime";
  return "string";
}

function guessExampleValueByDataType(dataType = "string", fieldName = "field") {
  const normalized = String(dataType || "string").trim().toLowerCase();
  if (normalized.includes("int")) return 1;
  if (normalized.includes("decimal") || normalized.includes("numeric") || normalized.includes("double") || normalized.includes("float") || normalized === "number") return 99.98;
  if (normalized.includes("bool")) return true;
  if (normalized.includes("date") || normalized.includes("time")) return "2026-05-01 10:00:00";
  const lowerName = String(fieldName || "").trim().toLowerCase();
  if (lowerName.includes("phone")) return "13812345678";
  if (lowerName.includes("mobile")) return "13812345678";
  if (lowerName.includes("id_card")) return "110101199001011234";
  if (lowerName.includes("email")) return "demo@example.com";
  if (lowerName.includes("name")) return "示例值";
  return "示例值";
}

function buildServiceCodeSuggestion(payload = {}, existingRecord = null) {
  if (existingRecord?.serviceCode) {
    return existingRecord.serviceCode;
  }
  const base = slugifyIdentifier(
    payload.serviceCode
      || payload.serviceName
      || payload.servicePath
      || payload.sourceTable
      || "service_api"
  );
  return `${base}_${String(Date.now()).slice(-6)}`;
}

function normalizeRequirementMode(value, requiredFlag) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "one_of_group") return "one_of_group";
  if (normalized === "required") return "required";
  if (requiredFlag === true) return "required";
  return "optional";
}

function stripMarkdownFence(text = "") {
  const normalized = String(text || "").trim();
  const matched = normalized.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  return matched ? matched[1].trim() : normalized;
}

function ensureJsonObjectPrompt(messages = [], provider = null) {
  if (!Array.isArray(messages)) return [];
  const extraInstruction = "只输出一个 JSON 对象，不要输出 Markdown，不要补充解释。";
  return messages.map((message, index) => {
    if (index !== 0 || message?.role !== "system") {
      return message;
    }
    return {
      ...message,
      content: `${String(message.content || "")}\n${extraInstruction}`.trim(),
    };
  });
}

function pickRecommendedSortField(columns = []) {
  const normalized = Array.isArray(columns) ? columns : [];
  const candidates = [
    "update_time",
    "updated_at",
    "last_update_time",
    "modify_time",
    "modified_at",
    "reg_time",
    "create_time",
    "created_at",
    "event_time",
  ];
  const availableNames = normalized.map((item) => String(item?.columnName || "").trim());
  for (const candidate of candidates) {
    if (availableNames.includes(candidate)) {
      return candidate;
    }
  }
  return availableNames[0] || null;
}

function normalizeServiceDataSourcePayload(payload, existingRecord = null) {
  return {
    sourceName: String(payload.sourceName || "").trim(),
    sourceCode: String(payload.sourceCode || "").trim(),
    sourceType: String(payload.sourceType || "mysql").trim().toLowerCase(),
    connectionConfig: payload.connectionConfig || {},
    ownerName: String(payload.ownerName || existingRecord?.ownerName || "system").trim() || "system",
    status: String(payload.status || existingRecord?.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active",
  };
}

async function ensureActiveDataSource(sourceId) {
  const dataSource = await repository.getServiceDataSourceById(sourceId);
  if (!dataSource) {
    throw new AppError("数据源不存在", 404);
  }
  if (dataSource.status !== "active") {
    throw new AppError("数据源未启用，无法发布服务", 400);
  }
  return dataSource;
}

async function describeServiceColumns(dataSource, payload = {}) {
  const serviceMode = normalizeServiceMode(payload.serviceMode || payload.mode || "table");
  if (serviceMode === "table") {
    const sourceTable = String(payload.sourceTable || "").trim();
    if (!sourceTable) {
      throw new AppError("请先选择数据表", 400);
    }

    const tables = await metadataService.listTables(dataSource);
    const tableExists = tables.some((item) => item.tableName === sourceTable);
    if (!tableExists) {
      throw new AppError("所选数据表不存在", 400);
    }

    const columns = await metadataService.listColumns(dataSource, sourceTable);
    const sampleRows = await metadataService.sampleRows(dataSource, sourceTable, 10).catch(() => []);
    return {
      serviceMode,
      columns: columns.map((column) => ({
        columnName: column.columnName,
        label: column.columnComment || column.columnName,
        dataType: String(column.dataType || "string").trim().toLowerCase(),
      })),
      sampleRows,
      sourceTable,
      sourceSql: null,
    };
  }

  const sourceSql = normalizeSourceSql(payload.sourceSql);
  if (!sourceSql) {
    throw new AppError("SQL 模式下必须填写查询 SQL", 400);
  }

  const preview = await previewServiceSql(dataSource.id, sourceSql);
  return {
    serviceMode,
    columns: preview.columns,
    sampleRows: preview.sampleRows,
    sourceTable: null,
    sourceSql,
  };
}

async function validateServiceSchema(dataSource, payload = {}) {
  const serviceStructure = await describeServiceColumns(dataSource, payload);
  const columnMap = new Map(serviceStructure.columns.map((column) => [column.columnName, column]));
  const queryConfig = payload.queryConfig || {};
  const responseConfig = payload.responseConfig || {};

  const normalizedFilters = (queryConfig.filters || []).map((filter, index) => {
    const columnName = String(filter.columnName || "").trim();
    const column = columnMap.get(columnName);
    if (!column) {
      throw new AppError(`查询字段 ${columnName} 不存在`, 400);
    }

    const operator = String(filter.operator || "eq").trim().toLowerCase();
    if (!["eq", "like", "between"].includes(operator)) {
      throw new AppError(`字段 ${columnName} 的查询方式不支持`, 400);
    }

    const requirementMode = normalizeRequirementMode(filter.requirementMode, filter.required);
    const requiredGroup = requirementMode === "one_of_group"
      ? normalizeText(filter.requiredGroup, `group_${index + 1}`)
      : null;

    return {
      columnName,
      label: String(filter.label || column.label || columnName).trim(),
      paramName: operator === "between" ? null : String(filter.paramName || columnName).trim(),
      startParamName: operator === "between" ? String(filter.startParamName || `${columnName}Start`).trim() : null,
      endParamName: operator === "between" ? String(filter.endParamName || `${columnName}End`).trim() : null,
      operator,
      required: requirementMode === "required",
      requirementMode,
      requiredGroup,
      dataType: String(filter.dataType || column.dataType || "string").trim().toLowerCase(),
    };
  });

  const normalizedResponseFields = (responseConfig.fields || []).map((field) => {
    const columnName = String(field.columnName || "").trim();
    const column = columnMap.get(columnName);
    if (!column) {
      throw new AppError(`返回字段 ${columnName} 不存在`, 400);
    }

    return {
      columnName,
      fieldName: String(field.fieldName || columnName).trim(),
      label: String(field.label || column.label || columnName).trim(),
      dataType: String(field.dataType || column.dataType || "string").trim().toLowerCase(),
    };
  });

  if (normalizedResponseFields.length === 0) {
    throw new AppError("请至少勾选一个返回字段", 400);
  }

  const defaultSortField = queryConfig?.defaultSortField ? String(queryConfig.defaultSortField).trim() : null;
  if (defaultSortField && !columnMap.has(defaultSortField)) {
    throw new AppError(`默认排序字段 ${defaultSortField} 不存在`, 400);
  }

  return {
    queryConfig: {
      filters: normalizedFilters,
      pagination: queryConfig?.pagination !== false,
      defaultPageSize: Number(queryConfig?.defaultPageSize || 20) || 20,
      maxPageSize: Number(queryConfig?.maxPageSize || 100) || 100,
      defaultSortField,
      defaultSortOrder: String(queryConfig?.defaultSortOrder || "desc").trim().toLowerCase() === "asc" ? "asc" : "desc",
    },
    responseConfig: {
      fields: normalizedResponseFields,
    },
    structure: serviceStructure,
  };
}

async function prepareServicePayload(payload, existingRecord = null) {
  const dataSource = await ensureActiveDataSource(Number(payload.sourceId));
  const serviceStatus = normalizeServiceStatus(payload.status);
  const serviceType = normalizeServiceType(payload.serviceType);
  const serviceMode = normalizeServiceMode(payload.serviceMode || existingRecord?.serviceMode || "table");
  const { queryConfig, responseConfig, structure } = await validateServiceSchema(dataSource, {
    ...payload,
    serviceMode,
  });

  return {
    serviceName: String(payload.serviceName || "").trim(),
    serviceCode: normalizeText(payload.serviceCode, buildServiceCodeSuggestion(payload, existingRecord)),
    servicePath: normalizeServicePath(payload.servicePath),
    requestMethod: normalizeRequestMethod(payload.requestMethod),
    dataDomain: String(payload.dataDomain || "api-service").trim() || "api-service",
    sourceId: dataSource.id,
    serviceMode,
    sourceTable: structure.sourceTable,
    sourceSql: structure.sourceSql,
    serviceType,
    authType: normalizeAuthType(payload.authType),
    status: serviceStatus,
    description: String(payload.description || "").trim() || null,
    queryConfig,
    responseConfig,
    ownerName: String(payload.ownerName || existingRecord?.ownerName || "system").trim() || "system",
    publishedAt: serviceStatus === "published"
      ? (existingRecord?.publishedAt || new Date())
      : null,
  };
}

async function listServices() {
  return repository.listServices();
}

async function listServiceDataSources() {
  return repository.listServiceDataSources();
}

async function getOverview() {
  return repository.getOverview();
}

async function getOpsDashboard() {
  return repository.getOpsDashboard();
}

async function listServiceApps() {
  return repository.listServiceApps();
}

async function listAuthorizations() {
  return repository.listAuthorizations();
}

async function listServiceLogs(options = {}) {
  return repository.listServiceLogs(options);
}

async function createService(payload) {
  try {
    const normalized = await prepareServicePayload(payload);
    return await repository.createService(normalized);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(buildDuplicateErrorMessage(error, "创建服务失败"), error.statusCode || 400);
  }
}

async function updateService(id, payload) {
  const existing = await repository.getServiceById(id);
  if (!existing) {
    throw new AppError("服务不存在", 404);
  }

  try {
    const normalized = await prepareServicePayload(payload, existing);
    const updated = await repository.updateService(id, normalized);
    if (!updated) {
      throw new AppError("服务不存在", 404);
    }
    return updated;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(buildDuplicateErrorMessage(error, "更新服务失败"), error.statusCode || 400);
  }
}

async function updateServiceStatus(id, status) {
  const existing = await repository.getServiceById(id);
  if (!existing) {
    throw new AppError("服务不存在", 404);
  }

  const updated = await repository.updateService(id, {
    ...existing,
    status: normalizeServiceStatus(status),
  });
  if (!updated) {
    throw new AppError("服务不存在", 404);
  }
  return updated;
}

async function deleteService(id) {
  const existing = await repository.getServiceById(id);
  if (!existing) {
    throw new AppError("服务不存在", 404);
  }

  const deleted = await repository.deleteService(id);
  if (!deleted) {
    throw new AppError("服务不存在", 404);
  }

  return { id, deleted: true };
}

async function createServiceDataSource(payload) {
  try {
    const normalized = normalizeServiceDataSourcePayload(payload);
    return await repository.createServiceDataSource(normalized);
  } catch (error) {
    throw new AppError(buildDataSourceDuplicateErrorMessage(error, "创建数据源失败"), error.statusCode || 400);
  }
}

async function updateServiceDataSource(id, payload) {
  const existing = await repository.getServiceDataSourceById(id);
  if (!existing) {
    throw new AppError("数据源不存在", 404);
  }

  try {
    const normalized = normalizeServiceDataSourcePayload(payload, existing);
    return await repository.updateServiceDataSource(id, normalized);
  } catch (error) {
    throw new AppError(buildDataSourceDuplicateErrorMessage(error, "更新数据源失败"), error.statusCode || 400);
  }
}

async function deleteServiceDataSource(id) {
  const existing = await repository.getServiceDataSourceById(id);
  if (!existing) {
    throw new AppError("数据源不存在", 404);
  }

  const referenceCount = await repository.countServiceReferencesByDataSourceId(id);
  if (referenceCount > 0) {
    throw new AppError("当前数据源仍有关联服务，无法删除", 409, { referenceCount });
  }

  const deleted = await repository.deleteServiceDataSource(id);
  if (!deleted) {
    throw new AppError("数据源不存在", 404);
  }

  return { id, deleted: true };
}

async function testServiceDataSourceConnection(payload) {
  const normalized = normalizeServiceDataSourcePayload(payload);
  return testDatabaseConnection(normalized.connectionConfig, normalized.sourceType);
}

async function ensureServiceDataSource(sourceId) {
  const dataSource = await repository.getServiceDataSourceById(sourceId);
  if (!dataSource) {
    throw new AppError("数据源不存在", 404);
  }
  return dataSource;
}

async function listServiceDataSourceTables(sourceId) {
  const dataSource = await ensureActiveDataSource(sourceId);
  return metadataService.listTables(dataSource);
}

async function listServiceDataSourceColumns(sourceId, tableName) {
  const dataSource = await ensureActiveDataSource(sourceId);
  return metadataService.listColumns(dataSource, tableName);
}

async function sampleServiceDataSourceRows(sourceId, tableName, limit) {
  const dataSource = await ensureServiceDataSource(sourceId);
  return metadataService.sampleRows(dataSource, tableName, limit);
}

function buildPreviewSql(sql = "", limit = 20, dialect = "mysql") {
  const normalized = sanitizeSqlText(sql);
  if (!normalized) {
    throw new AppError("SQL 不能为空", 400);
  }
  if (!/^\s*(select|with)\b/i.test(normalized)) {
    throw new AppError("仅支持查询类 SQL 预览", 400);
  }
  if (/\blimit\s+\d+\s*$/i.test(normalized) || /\bfetch\s+first\s+\d+\s+rows\s+only\s*$/i.test(normalized) || /\brownum\b/i.test(normalized)) {
    return normalized;
  }
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 20) || 20));
  if (dialect === "oracle") return `SELECT * FROM (${normalized}) WHERE ROWNUM <= ${safeLimit}`;
  if (dialect === "dm") return `${normalized} FETCH FIRST ${safeLimit} ROWS ONLY`;
  return `${normalized} LIMIT ${safeLimit}`;
}

function inferPreviewColumns(fieldNames = [], sampleRows = []) {
  return fieldNames.map((name) => {
    const sampleValue = sampleRows.find((row) => row && Object.prototype.hasOwnProperty.call(row, name) && row[name] !== null && row[name] !== undefined)?.[name];
    return {
      columnName: name,
      label: name,
      dataType: guessFieldDataTypeFromValue(sampleValue),
    };
  });
}

async function previewServiceSql(sourceId, sql, limit = 20) {
  const dataSource = await ensureActiveDataSource(Number(sourceId));

  return withServiceConnection(dataSource, async (connection, dialect) => {
    const previewSql = buildPreviewSql(sql, limit, dialect);
    if (dialect === "mysql") {
      const [rows, fields] = await connection.query(previewSql);
      const sampleRows = Array.isArray(rows) ? rows : [];
      const columns = inferPreviewColumns((fields || []).map((field) => field.name), sampleRows);
      return {
        columns,
        sampleRows,
        rowCount: sampleRows.length,
      };
    }

    const result = await connection.query(previewSql);
    const sampleRows = Array.isArray(result.rows) ? result.rows : [];
    const columns = inferPreviewColumns((result.fields || []).map((field) => field.name), sampleRows);
    return {
      columns,
      sampleRows,
      rowCount: sampleRows.length,
    };
  });
}

async function listServiceAiConfigs() {
  return repository.listServiceAiConfigs();
}

async function validateServiceDefaultProvider(defaultModelProviderId, defaultModelName, defaultModelVersion) {
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

async function updateServiceAiConfig(id, payload) {
  const existing = await repository.getServiceAiConfigById(id);
  if (!existing) {
    throw new AppError("数据服务 AI 场景配置不存在", 404);
  }

  const normalizedModel = await validateServiceDefaultProvider(
    payload.defaultModelProviderId ?? existing.defaultModelProviderId,
    payload.defaultModelName ?? existing.defaultModelName,
    payload.defaultModelVersion ?? existing.defaultModelVersion
  );

  const row = await repository.updateServiceAiConfig(id, {
    ...existing,
    defaultModelProviderId: normalizedModel.defaultModelProviderId,
    defaultModelName: normalizedModel.defaultModelName,
    defaultModelVersion: normalizedModel.defaultModelVersion,
    temperature: payload.temperature ?? existing.temperature ?? null,
    maxTokens: payload.maxTokens ?? existing.maxTokens ?? null,
    timeoutMs: payload.timeoutMs ?? existing.timeoutMs ?? null,
    systemPrompt: payload.systemPrompt || null,
  });

  if (!row) {
    throw new AppError("数据服务 AI 场景配置不存在", 404);
  }
  return row;
}

async function getActiveServiceAiConfigByCode(sceneCode) {
  const row = await repository.getServiceAiConfigByCode(sceneCode);
  if (!row || row.status !== "active") {
    return null;
  }
  return row;
}

async function resolveServiceRecommendationProvider(aiConfig) {
  if (aiConfig?.defaultModelProviderId) {
    const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
    return modelProviderService.applyModelSelection(provider, {
      modelName: aiConfig.defaultModelName,
      modelVersion: aiConfig.defaultModelVersion,
    });
  }

  const providers = await modelProviderService.getActiveChatModelProviders();
  if (!providers.length) {
    throw new AppError("未找到可用的对话模型，请先在模型管理中维护服务开发推荐场景默认模型", 400);
  }
  return providers[0];
}

function buildServiceRecommendationPrompt(payload, dataSource, structure, aiConfig) {
  const columns = (structure.columns || []).map((column) => ({
    columnName: column.columnName,
    label: column.label || column.columnName,
    dataType: column.dataType || "string",
  }));
  const sampleRows = Array.isArray(structure.sampleRows) ? structure.sampleRows.slice(0, 5) : [];
  return [
    {
      role: "system",
      content: aiConfig?.systemPrompt || DEFAULT_SERVICE_CONFIG_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: JSON.stringify({
        currentForm: {
          serviceName: payload.serviceName || "",
          serviceCode: payload.serviceCode || "",
          servicePath: payload.servicePath || "",
          requestMethod: payload.requestMethod || "GET",
          serviceType: payload.serviceType || "list",
          ownerName: payload.ownerName || "system",
          description: payload.description || "",
          serviceMode: structure.serviceMode,
          sourceTable: structure.sourceTable || null,
        },
        dataSource: {
          id: dataSource.id,
          sourceName: dataSource.sourceName,
          sourceCode: dataSource.sourceCode,
          sourceType: dataSource.sourceType,
          database: dataSource.connectionConfig?.database || null,
        },
        sourceSql: structure.serviceMode === "sql" ? structure.sourceSql : null,
        resultColumns: columns,
        sampleRows,
        outputSchema: {
          serviceName: "推荐的服务名称",
          serviceCode: "推荐的服务编码，可为空，但最好给出建议值",
          servicePath: "推荐的接口路径，形如 /demo/query_user",
          requestMethod: "GET 或 POST",
          serviceType: "list 或 detail",
          description: "1~3 句服务说明",
          defaultSortField: "默认排序字段，优先推荐更新时间类字段",
          defaultSortOrder: "asc 或 desc，优先 desc",
          queryFields: [
            {
              columnName: "字段名",
              operator: "eq | like | between",
              required: false,
              requirementMode: "optional | required | one_of_group",
              requiredGroup: "phone_or_id",
            },
          ],
          responseFieldNames: ["返回字段数组"],
          reasoning: ["推荐依据数组"],
        },
      }),
    },
  ];
}

function parseServiceRecommendation(rawText = "", structure = {}) {
  const normalized = stripMarkdownFence(rawText);
  let parsed = {};
  try {
    parsed = JSON.parse(normalized);
  } catch (error) {
    throw new AppError(`AI 服务配置推荐结果解析失败: ${error.message || "未知错误"}`, 400);
  }

  const availableColumns = new Set((structure.columns || []).map((item) => item.columnName));
  const responseFieldNames = Array.isArray(parsed.responseFieldNames)
    ? parsed.responseFieldNames.filter((item) => availableColumns.has(String(item || "").trim())).map((item) => String(item).trim())
    : [];

  const queryFields = Array.isArray(parsed.queryFields)
    ? parsed.queryFields
      .map((item, index) => {
        const columnName = String(item?.columnName || "").trim();
        if (!availableColumns.has(columnName)) return null;
        return {
          columnName,
          operator: ["eq", "like", "between"].includes(String(item?.operator || "").trim().toLowerCase())
            ? String(item.operator).trim().toLowerCase()
            : "eq",
          required: Boolean(item?.required),
          requirementMode: normalizeRequirementMode(item?.requirementMode, item?.required),
          requiredGroup: normalizeRequirementMode(item?.requirementMode, item?.required) === "one_of_group"
            ? normalizeText(item?.requiredGroup, `group_${index + 1}`)
            : null,
        };
      })
      .filter(Boolean)
    : [];

  const fallbackResponseFieldNames = responseFieldNames.length
    ? responseFieldNames
    : (structure.columns || []).slice(0, 8).map((item) => item.columnName);

  const normalizedSortField = availableColumns.has(String(parsed.defaultSortField || "").trim())
    ? String(parsed.defaultSortField || "").trim()
    : pickRecommendedSortField(structure.columns || []);
  const normalizedSortOrder = String(parsed.defaultSortOrder || "desc").trim().toLowerCase() === "asc" ? "asc" : "desc";

  return {
    serviceName: normalizeText(parsed.serviceName, ""),
    serviceCode: normalizeText(parsed.serviceCode, ""),
    servicePath: normalizeText(parsed.servicePath, ""),
    requestMethod: normalizeRequestMethod(parsed.requestMethod || "GET"),
    serviceType: normalizeServiceType(parsed.serviceType || "list"),
    description: normalizeText(parsed.description, ""),
    defaultSortField: normalizedSortField,
    defaultSortOrder: normalizedSortOrder,
    queryFields,
    responseFieldNames: fallbackResponseFieldNames,
    reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.map((item) => String(item || "").trim()).filter(Boolean) : [],
  };
}

async function recommendServiceConfig(payload) {
  const dataSource = await ensureActiveDataSource(Number(payload.sourceId));
  const structure = await describeServiceColumns(dataSource, payload);
  const aiConfig = await getActiveServiceAiConfigByCode("service_config_recommendation");
  const provider = await resolveServiceRecommendationProvider(aiConfig);
  const completion = await modelProviderService.generateChatCompletion(
    provider,
    ensureJsonObjectPrompt(buildServiceRecommendationPrompt(payload, dataSource, structure, aiConfig), provider),
    {
      temperature: aiConfig?.temperature ?? 0.1,
      maxTokens: Number(aiConfig?.maxTokens || 1200),
      timeoutMs: Number(aiConfig?.timeoutMs || 120000),
      responseFormat: { type: "json_object" },
    }
  );

  return {
    modelProviderId: provider.id,
    modelProviderName: provider.configName,
    modelName: provider.modelName,
    recommendation: parseServiceRecommendation(completion.content, structure),
  };
}

function generateAppToken() {
  return `svc_${crypto.randomBytes(18).toString("hex")}`;
}

function generateAppCode() {
  return `app_${crypto.randomBytes(6).toString("hex")}`;
}

async function createServiceApp(payload) {
  try {
    const normalizedAppCode = String(payload.appCode || "").trim() || generateAppCode();
    return await repository.createServiceApp({
      departmentName: String(payload.departmentName || "").trim() || null,
      appName: String(payload.appName || "").trim(),
      appCode: normalizedAppCode,
      appToken: String(payload.appToken || generateAppToken()).trim(),
      contactPhone: String(payload.contactPhone || "").trim() || null,
      appDescription: String(payload.appDescription || "").trim() || null,
      ownerName: String(payload.ownerName || "system").trim() || "system",
      status: String(payload.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active",
    });
  } catch (error) {
    throw new AppError(buildAppDuplicateErrorMessage(error, "创建应用失败"), error.statusCode || 400);
  }
}

async function updateServiceApp(id, payload) {
  const existing = await repository.getServiceAppById(id);
  if (!existing) {
    throw new AppError("应用不存在", 404);
  }

  try {
    const normalizedAppCode = String(payload.appCode || "").trim() || existing.appCode || generateAppCode();
    return await repository.updateServiceApp(id, {
      departmentName: String(payload.departmentName || existing.departmentName || "").trim() || null,
      appName: String(payload.appName || "").trim(),
      appCode: normalizedAppCode,
      appToken: String(payload.appToken || existing.appToken || generateAppToken()).trim(),
      contactPhone: String(payload.contactPhone || existing.contactPhone || "").trim() || null,
      appDescription: String(payload.appDescription || existing.appDescription || "").trim() || null,
      ownerName: String(payload.ownerName || existing.ownerName || "system").trim() || "system",
      status: String(payload.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active",
    });
  } catch (error) {
    throw new AppError(buildAppDuplicateErrorMessage(error, "更新应用失败"), error.statusCode || 400);
  }
}

async function deleteServiceApp(id) {
  const existing = await repository.getServiceAppById(id);
  if (!existing) {
    throw new AppError("应用不存在", 404);
  }

  const deleted = await repository.deleteServiceApp(id);
  if (!deleted) {
    throw new AppError("应用不存在", 404);
  }

  return { id, deleted: true };
}

async function createAuthorization(payload) {
  const service = await repository.getServiceById(Number(payload.serviceId));
  if (!service) {
    throw new AppError("服务不存在", 404);
  }

  const app = await repository.getServiceAppById(Number(payload.appId));
  if (!app) {
    throw new AppError("应用不存在", 404);
  }

  try {
    return await repository.createAuthorization({
      serviceId: service.id,
      appId: app.id,
      status: String(payload.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active",
      rateLimitPerMinute: Math.max(0, Number(payload.rateLimitPerMinute || 0) || 0),
      dailyLimit: Math.max(0, Number(payload.dailyLimit || 0) || 0),
      ipWhitelist: normalizeIpList(payload.ipWhitelist),
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      throw new AppError("该应用已授权当前服务", 409);
    }
    throw new AppError("创建授权失败", error.statusCode || 400);
  }
}

async function updateAuthorization(id, payload) {
  const existing = await repository.getAuthorizationById(id);
  if (!existing) {
    throw new AppError("授权不存在", 404);
  }

  const service = await repository.getServiceById(Number(payload.serviceId));
  if (!service) {
    throw new AppError("服务不存在", 404);
  }

  const app = await repository.getServiceAppById(Number(payload.appId));
  if (!app) {
    throw new AppError("应用不存在", 404);
  }

  try {
    return await repository.updateAuthorization(id, {
      serviceId: service.id,
      appId: app.id,
      status: String(payload.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active",
      rateLimitPerMinute: Math.max(0, Number(payload.rateLimitPerMinute || 0) || 0),
      dailyLimit: Math.max(0, Number(payload.dailyLimit || 0) || 0),
      ipWhitelist: normalizeIpList(payload.ipWhitelist),
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      throw new AppError("该应用已授权当前服务", 409);
    }
    throw new AppError("更新授权失败", error.statusCode || 400);
  }
}

async function deleteAuthorization(id) {
  const existing = await repository.getAuthorizationById(id);
  if (!existing) {
    throw new AppError("授权不存在", 404);
  }

  const deleted = await repository.deleteAuthorization(id);
  if (!deleted) {
    throw new AppError("授权不存在", 404);
  }

  return { id, deleted: true };
}

function normalizeInterfaceBaseUrl(baseUrl = "") {
  const text = String(baseUrl || "").trim().replace(/\/+$/, "");
  return text || "";
}

function buildInterfaceRequestUrl(serviceApi, baseUrl = "") {
  const servicePath = String(serviceApi?.servicePath || "").trim();
  const prefix = normalizeInterfaceBaseUrl(baseUrl);
  return `${prefix || ""}/api/service${servicePath}`.replace(/([^:]\/)\/+/g, "$1");
}

function createDocParagraph(text, options = {}) {
  return new Paragraph({
    heading: options.heading,
    spacing: { before: options.before || 0, after: options.after || 80 },
    children: [
      new TextRun({
        text: String(text || ""),
        bold: Boolean(options.bold),
        size: options.size || 24,
      }),
    ],
  });
}

function createDocTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header) => new TableCell({
          children: [createDocParagraph(header, { bold: true, size: 22, after: 40 })],
        })),
      }),
      ...rows.map((row) => new TableRow({
        children: row.map((cell) => new TableCell({
          children: [createDocParagraph(cell, { size: 22, after: 40 })],
        })),
      })),
    ],
  });
}

function createDocCodeBlock(text) {
  return new Paragraph({
    spacing: { before: 40, after: 120 },
    children: [
      new TextRun({
        text: String(text || ""),
        size: 20,
        font: "Consolas",
      }),
    ],
  });
}

function buildAuthDocInfo(serviceApi) {
  const authType = normalizeAuthType(serviceApi?.authType || "token");
  if (authType === "anonymous") {
    return {
      authType: "免认证",
      authDescription: "当前接口为免认证模式，调用时不需要携带应用访问 Token。",
      headerExamples: [
        ["Authorization", "无"],
        ["X-App-Token", "无"],
      ],
      callNotes: [
        "可直接按 URL 与参数调用接口。",
        "如后续切换为 Token 认证，需要在请求头中补充应用访问 Token。",
      ],
    };
  }

  return {
    authType: "Token 认证",
    authDescription: "当前接口要求携带应用访问 Token。推荐优先使用 X-App-Token，也兼容 Authorization: Bearer <token>。",
    headerExamples: [
      ["X-App-Token", "svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"],
      ["Authorization", "Bearer svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"],
    ],
    callNotes: [
      "不要把 token 放在 query 参数里，例如 ?token=... 或 ?Bearer=... 均不会被识别。",
      "Token 请使用“应用管理”里分配给调用方应用的访问 Token。",
      "如果接口返回 401/403，请优先检查 Token 是否正确、应用是否已授权、服务状态是否已发布。",
    ],
  };
}

function sanitizeDocFileName(fileName = "") {
  return String(fileName || "service_interface_document")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildRequestExample(serviceApi, requestUrl) {
  const authInfo = buildAuthDocInfo(serviceApi);
  const filters = Array.isArray(serviceApi?.queryConfig?.filters) ? serviceApi.queryConfig.filters : [];
  const sampleParams = {};
  for (const filter of filters) {
    const dataType = String(filter?.dataType || "string").trim().toLowerCase();
    if (filter?.operator === "between") {
      sampleParams[filter.startParamName || `${filter.columnName}Start`] = guessExampleValueByDataType(dataType, filter.columnName);
      sampleParams[filter.endParamName || `${filter.columnName}End`] = guessExampleValueByDataType(dataType, filter.columnName);
      continue;
    }
    sampleParams[filter.paramName || filter.columnName] = guessExampleValueByDataType(dataType, filter.columnName);
  }

  const method = normalizeRequestMethod(serviceApi?.requestMethod || "GET");
  if (method === "GET") {
    const searchParams = new URLSearchParams();
    Object.entries(sampleParams).forEach(([key, value]) => searchParams.set(key, String(value)));
    const headerLines = authInfo.authType === "Token 认证"
      ? [
          `  -H "X-App-Token: svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\`,
        ]
      : [];
    return {
      method,
      url: `${requestUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
      body: null,
      headers: authInfo.authType === "Token 认证"
        ? { "X-App-Token": "svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
        : {},
      curl: [
        `curl -X GET "${requestUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ""}" \\`,
        ...headerLines,
        `  -H "Accept: application/json"`,
      ].join("\n"),
    };
  }

  return {
    method,
    url: requestUrl,
    body: sampleParams,
    headers: authInfo.authType === "Token 认证"
      ? {
          "Content-Type": "application/json",
          "X-App-Token": "svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        }
      : {
          "Content-Type": "application/json",
        },
    curl: [
      `curl -X POST "${requestUrl}" \\`,
      ...(authInfo.authType === "Token 认证" ? [`  -H "X-App-Token: svc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\`] : []),
      `  -H "Content-Type: application/json" \\`,
      `  -d '${JSON.stringify(sampleParams, null, 2)}'`,
    ].join("\n"),
  };
}

function buildResponseExample(serviceApi) {
  const fields = Array.isArray(serviceApi?.responseConfig?.fields) ? serviceApi.responseConfig.fields : [];
  const row = {};
  for (const field of fields) {
    row[field.fieldName || field.columnName] = guessExampleValueByDataType(field.dataType, field.fieldName || field.columnName);
  }

  if ((serviceApi?.serviceType || "list") === "detail") {
    return {
      code: 0,
      message: "success",
      data: row,
      meta: {
        serviceCode: serviceApi?.serviceCode || "",
        returned: Object.keys(row).length ? 1 : 0,
      },
    };
  }

  return {
    code: 0,
    message: "success",
    data: [row],
    meta: {
      serviceCode: serviceApi?.serviceCode || "",
      page: 1,
      pageSize: Number(serviceApi?.queryConfig?.defaultPageSize || 20),
      total: Object.keys(row).length ? 1 : 0,
      returned: Object.keys(row).length ? 1 : 0,
    },
  };
}

async function exportServiceInterfaceDoc(id, options = {}) {
  const serviceApi = await repository.getServiceById(id);
  if (!serviceApi) {
    throw new AppError("服务不存在", 404);
  }

  const requestUrl = buildInterfaceRequestUrl(serviceApi, options.baseUrl || "");
  const authInfo = buildAuthDocInfo(serviceApi);
  const requestExample = buildRequestExample(serviceApi, requestUrl);
  const responseExample = buildResponseExample(serviceApi);
  const requestParams = (serviceApi.queryConfig?.filters || []).map((item) => [
    String(item.label || item.columnName || "-"),
    String(item.paramName || item.startParamName || item.columnName || "-"),
    String(item.operator || "-"),
    item.requirementMode === "one_of_group"
      ? `组内至少一项${item.requiredGroup ? ` (${item.requiredGroup})` : ""}`
      : (item.required ? "是" : "否"),
    String(item.dataType || "-"),
  ]);
  const responseParams = (serviceApi.responseConfig?.fields || []).map((item) => [
    String(item.label || item.columnName || "-"),
    String(item.fieldName || item.columnName || "-"),
    String(item.dataType || "-"),
  ]);

  const document = new Document({
    sections: [
      {
        children: [
          createDocParagraph(`${serviceApi.serviceName} 接口说明`, { heading: HeadingLevel.HEADING_1, bold: true, size: 32, after: 120 }),
          createDocParagraph("一、基础信息", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 80 }),
          createDocTable(
            ["字段", "内容"],
            [
              ["服务名称", serviceApi.serviceName],
              ["服务编码", serviceApi.serviceCode],
              ["调用方式", serviceApi.requestMethod],
              ["请求地址", requestUrl],
              ["认证方式", authInfo.authType],
              ["数据源 / 来源", serviceApi.serviceMode === "sql"
                ? `${serviceApi.sourceName || "-"} / SQL 模式`
                : `${serviceApi.sourceName || "-"} / ${serviceApi.sourceTable || "-"}`],
              ["服务说明", serviceApi.description || "-"],
            ]
          ),
          createDocParagraph("二、认证说明", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 }),
          createDocTable(
            ["字段", "内容"],
            [
              ["认证模式", authInfo.authType],
              ["认证说明", authInfo.authDescription],
            ]
          ),
          createDocParagraph("请求头示例", { bold: true, size: 22, before: 80 }),
          createDocTable(["Header", "示例值"], authInfo.headerExamples),
          createDocParagraph("调用注意事项", { bold: true, size: 22, before: 80 }),
          ...authInfo.callNotes.map((item) => createDocParagraph(`- ${item}`, { size: 22, after: 30 })),
          createDocParagraph("三、请求参数", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 }),
          requestParams.length > 0
            ? createDocTable(["参数说明", "参数名", "查询方式", "必填", "类型"], requestParams)
            : createDocParagraph("当前接口无入参。", { size: 22 }),
          createDocParagraph("四、请求示例", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 }),
          createDocTable(
            ["字段", "内容"],
            [
              ["请求方式", requestExample.method],
              ["请求地址", requestExample.url],
              ["请求头", requestExample.headers && Object.keys(requestExample.headers).length
                ? JSON.stringify(requestExample.headers, null, 2)
                : "无"],
              ["请求体", requestExample.body ? JSON.stringify(requestExample.body, null, 2) : "无"],
            ]
          ),
          createDocParagraph("curl 示例", { bold: true, size: 22, before: 80 }),
          createDocCodeBlock(requestExample.curl),
          serviceApi.serviceMode === "sql" && serviceApi.sourceSql
            ? createDocParagraph("五、SQL 来源说明", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 })
            : createDocParagraph("五、响应字段", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 }),
          serviceApi.serviceMode === "sql" && serviceApi.sourceSql
            ? createDocCodeBlock(serviceApi.sourceSql)
            : createDocParagraph(""),
          createDocParagraph(serviceApi.serviceMode === "sql" && serviceApi.sourceSql ? "六、响应字段" : "五、响应字段", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 }),
          responseParams.length > 0
            ? createDocTable(["字段说明", "返回字段", "类型"], responseParams)
            : createDocParagraph("当前接口无出参定义。", { size: 22 }),
          createDocParagraph(serviceApi.serviceMode === "sql" && serviceApi.sourceSql ? "七、返回示例" : "六、返回示例", { heading: HeadingLevel.HEADING_2, bold: true, size: 26, before: 120 }),
          createDocCodeBlock(JSON.stringify(responseExample, null, 2)),
        ],
      },
    ],
  });

  return {
    fileName: `${sanitizeDocFileName(serviceApi.serviceCode || serviceApi.serviceName)}_api_doc.docx`,
    buffer: await Packer.toBuffer(document),
    service: serviceApi,
  };
}

async function withServiceConnection(dataSource, handler) {
  const resolved = resolveDatasourceConnection(dataSource?.sourceType, dataSource?.connectionConfig || {});

  if (["mysql", "postgresql", "oracle", "dm"].includes(resolved.dialect) && getManagedBinding(resolved.dialect)) {
    const adapter = getAdapter(resolved.dialect);
    const runtimeConfig = {
      ...(dataSource.connectionConfig || {}),
      sourceType: resolved.dialect,
      databaseName: resolved.database,
    };
    const managedConnection = {
      async query(sql, params = []) {
        const result = await adapter.executeQuery(runtimeConfig, sql, { binds: params });
        return { rows: result.rows || [], fields: (result.fields || []).map((name) => ({ name })) };
      },
      async execute(sql, params = []) {
        const result = await adapter.executeQuery(runtimeConfig, sql, { binds: params });
        return [result.rows || [], (result.fields || []).map((name) => ({ name }))];
      },
    };
    return handler(managedConnection, resolved.dialect);
  }

  if (resolved.dialect === "mysql") {
    const connection = await mysql.createConnection({
      host: resolved.host,
      port: resolved.port,
      database: resolved.database,
      user: resolved.username,
      password: resolved.password,
      connectTimeout: 5000,
    });

    try {
      return await handler(connection, "mysql");
    } finally {
      await connection.end();
    }
  }

  if (resolved.dialect === "postgresql") {
    const client = createPostgresLikeClient({
      host: resolved.host,
      port: resolved.port,
      database: resolved.database,
      user: resolved.username,
      username: resolved.username,
      password: resolved.password,
      connectionTimeoutMillis: 5000,
    }, {
      sourceType: dataSource?.sourceType,
    });

    await client.connect();
    try {
      return await handler(client, "postgresql");
    } finally {
      await client.end();
    }
  }

  if (["oracle", "dm"].includes(resolved.dialect)) {
    const adapter = getAdapter(resolved.dialect);
    const runtimeConfig = {
      ...(dataSource.connectionConfig || {}),
      sourceType: resolved.dialect,
      databaseName: resolved.database,
    };
    return handler({
      async query(sql, params = []) {
        const result = await adapter.executeQuery(runtimeConfig, sql, { binds: params });
        return { rows: result.rows || [], fields: (result.fields || []).map((name) => ({ name })) };
      },
    }, resolved.dialect);
  }

  throw new AppError("当前数据源类型不支持运行服务", 400);
}

async function executeQuery(connection, dialect, sql, params = []) {
  if (dialect === "mysql") {
    const [rows] = await connection.execute(sql, params);
    return rows;
  }

  const result = await connection.query(sql, params);
  return result.rows;
}

async function executeServiceQuery(serviceApi, dataSource, runtimeInput) {
  const sqlBundle = buildServiceSql(serviceApi, dataSource, runtimeInput);

  return withServiceConnection(dataSource, async (connection, dialect) => {
    const rows = await executeQuery(connection, dialect, sqlBundle.dataSql, sqlBundle.dataParams);
    let total = Array.isArray(rows) ? rows.length : 0;

    if (sqlBundle.countSql) {
      const countRows = await executeQuery(connection, dialect, sqlBundle.countSql, sqlBundle.countParams);
      total = Number(countRows[0]?.total || countRows[0]?.TOTAL || 0);
    }

    if (sqlBundle.meta.serviceType === "detail") {
      return {
        data: rows[0] || null,
        meta: {
          ...sqlBundle.meta,
          total: rows[0] ? 1 : 0,
          returned: rows[0] ? 1 : 0,
        },
      };
    }

    return {
      data: rows,
      meta: {
        ...sqlBundle.meta,
        total,
        returned: rows.length,
      },
    };
  });
}

async function debugService(id, runtimeInput = {}) {
  const serviceApi = await repository.getServiceById(id);
  if (!serviceApi) {
    throw new AppError("服务不存在", 404);
  }

  const dataSource = await ensureActiveDataSource(serviceApi.sourceId);
  return executeServiceQuery(serviceApi, dataSource, runtimeInput);
}

async function inspectServiceJob(id, context = {}) {
  const serviceApi = await repository.getServiceById(id);
  if (!serviceApi || serviceApi.status !== "published") {
    throw new AppError("服务不存在或未发布", 404);
  }

  await validateAuthorization(serviceApi, context, { forceToken: true });
  const recentLogs = await repository.listServiceLogs({ serviceId: serviceApi.id, limit: 20 });
  return {
    id: String(serviceApi.id),
    job_id: String(serviceApi.id),
    status: serviceApi.status,
    logs: recentLogs.map((item) =>
      `${item.calledAt || item.createdAt || ""} ${item.responseStatus || "unknown"}`.trim()
    ),
  };
}

function extractAppToken(headers = {}) {
  const authorization = String(headers.authorization || headers.Authorization || "").trim();
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return String(headers["x-app-token"] || headers["X-App-Token"] || headers["app-token"] || "").trim();
}

function extractClientIp(context = {}) {
  const requestIp = String(context.req?.ip || context.ip || "").trim();
  if (requestIp) {
    return requestIp;
  }

  const forwarded = String(context.headers?.["x-forwarded-for"] || "").trim();
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

async function validateAuthorization(serviceApi, context, options = {}) {
  if (serviceApi.authType === "anonymous" && options.forceToken !== true) {
    return { app: null, authorization: null };
  }

  function buildAppBoundError(message, statusCode, app) {
    const error = new AppError(message, statusCode);
    error.app = app || null;
    return error;
  }

  const appToken = extractAppToken(context.headers || {});
  if (!appToken) {
    throw new AppError("缺少应用访问 Token", 401);
  }

  const app = await repository.findServiceAppByToken(appToken);
  if (!app || app.status !== "active") {
    throw new AppError("服务访问 Token 无效", 401);
  }

  const authorization = await repository.findAuthorization(serviceApi.id, app.id);
  if (!authorization || authorization.status !== "active") {
    throw buildAppBoundError("当前应用未授权访问该服务", 403, app);
  }

  const clientIp = extractClientIp(context);
  if (!isIpAllowed(clientIp, authorization.ipWhitelist)) {
    throw buildAppBoundError("当前 IP 不在服务白名单内", 403, app);
  }

  const now = new Date();
  if (authorization.rateLimitPerMinute > 0) {
    const minuteStart = new Date(now.getTime() - 60 * 1000);
    const minuteCalls = await repository.countCallsSince(serviceApi.id, app.id, minuteStart);
    if (minuteCalls >= authorization.rateLimitPerMinute) {
      throw buildAppBoundError("服务调用已达到分钟限流阈值", 429, app);
    }
  }

  if (authorization.dailyLimit > 0) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayCalls = await repository.countCallsSince(serviceApi.id, app.id, dayStart);
    if (dayCalls >= authorization.dailyLimit) {
      throw buildAppBoundError("服务调用已达到日调用上限", 429, app);
    }
  }

  return { app, authorization };
}

async function safeRecordServiceCall(payload) {
  try {
    await repository.recordServiceCall(payload);
  } catch (error) {
    console.error("[data-services] recordServiceCall failed:", error.message);
  }
}

async function invokeService(method, servicePath, runtimeInput = {}, context = {}) {
  const normalizedMethod = normalizeRequestMethod(method);
  const normalizedPath = normalizeServicePath(servicePath);
  const serviceApi = await repository.findPublishedServiceByPath(normalizedMethod, normalizedPath);

  if (!serviceApi) {
    throw new AppError("服务不存在或未发布", 404);
  }

  const startedAt = Date.now();
  const clientIp = extractClientIp(context);
  let app = null;

  try {
    const authContext = await validateAuthorization(serviceApi, context);
    app = authContext.app;
    const dataSource = await ensureActiveDataSource(serviceApi.sourceId);
    const result = await executeServiceQuery(serviceApi, dataSource, runtimeInput);

    await safeRecordServiceCall({
      projectId: serviceApi.projectId || null,
      serviceId: serviceApi.id,
      appId: app?.id || null,
      serviceCode: serviceApi.serviceCode,
      servicePath: serviceApi.servicePath,
      requestMethod: serviceApi.requestMethod,
      authType: serviceApi.authType,
      requestParams: sanitizeRequestParams(runtimeInput),
      responseStatus: "success",
      success: true,
      httpStatus: 200,
      latencyMs: Date.now() - startedAt,
      clientIp,
      errorMessage: null,
    });

    return {
      service: {
        id: serviceApi.id,
        serviceName: serviceApi.serviceName,
        serviceCode: serviceApi.serviceCode,
      },
      app: app ? { id: app.id, appName: app.appName, appCode: app.appCode } : null,
      ...result,
    };
  } catch (error) {
    app = error?.app || app;
    await safeRecordServiceCall({
      projectId: serviceApi.projectId || null,
      serviceId: serviceApi.id,
      appId: app?.id || null,
      serviceCode: serviceApi.serviceCode,
      servicePath: serviceApi.servicePath,
      requestMethod: serviceApi.requestMethod,
      authType: serviceApi.authType,
      requestParams: sanitizeRequestParams(runtimeInput),
      responseStatus: "failed",
      success: false,
      httpStatus: error.statusCode || 500,
      latencyMs: Date.now() - startedAt,
      clientIp,
      errorMessage: error.message,
    });
    throw error;
  }
}

module.exports = {
  createAuthorization,
  createService,
  createServiceApp,
  createServiceDataSource,
  deleteAuthorization,
  deleteService,
  deleteServiceDataSource,
  deleteServiceApp,
  debugService,
  exportServiceInterfaceDoc,
  getOverview,
  getOpsDashboard,
  getActiveServiceAiConfigByCode,
  invokeService,
  inspectServiceJob,
  listAuthorizations,
  listServiceAiConfigs,
  listServiceDataSourceColumns,
  listServiceDataSources,
  listServiceDataSourceTables,
  listServiceApps,
  listServiceLogs,
  listServices,
  previewServiceSql,
  recommendServiceConfig,
  sampleServiceDataSourceRows,
  testServiceDataSourceConnection,
  updateAuthorization,
  updateServiceAiConfig,
  updateServiceStatus,
  updateService,
  updateServiceApp,
  updateServiceDataSource,
};
