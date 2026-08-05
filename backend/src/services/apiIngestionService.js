const mysql = require("mysql2/promise");
const AppError = require("../common/errors/app-error");
const { pool } = require("../config/database");
const { createPostgresLikeClient } = require("../common/utils/db-client");
const { inferDatasourceDialect, resolveDatasourceConnection } = require("../common/utils/datasource-dialect");

const SENSITIVE_KEY_PATTERN = /(authorization|token|secret|password|apikey|api_key|x-api-key)/i;

function normalizeApiConnectionConfig(config = {}) {
  const baseUrl = String(config.baseUrl || config.apiBaseUrl || config.url || "").trim().replace(/\/+$/g, "");
  return {
    baseUrl,
    defaultPath: String(config.defaultPath || config.endpointPath || "/").trim() || "/",
    authType: normalizeEnum(config.authType || "none", ["none", "basic", "bearer", "api_key"], "none"),
    bearerToken: String(config.bearerToken || config.token || ""),
    username: String(config.username || config.user || ""),
    password: String(config.password || ""),
    apiKeyName: String(config.apiKeyName || "x-api-key"),
    apiKeyValue: String(config.apiKeyValue || config.apiKey || ""),
    apiKeyIn: normalizeEnum(config.apiKeyIn || "header", ["header", "query", "body"], "header"),
    headers: normalizeKeyValueList(config.headers || config.defaultHeaders),
    timeoutMs: clampNumber(config.timeoutMs, 1000, 120000, 30000),
  };
}

function normalizeApiSourceConfig(rawConfig = {}, sourceObject = "") {
  const endpointPath = String(rawConfig.endpointPath || rawConfig.path || sourceObject || "/").trim() || "/";
  const pagination = rawConfig.pagination || {};
  const incremental = rawConfig.incremental || {};
  return {
    endpointPath,
    method: normalizeHttpMethod(rawConfig.method),
    contentType: normalizeEnum(rawConfig.contentType || "application/json", ["application/json", "application/x-www-form-urlencoded", "text/plain"], "application/json"),
    auth: normalizeApiAuthConfig(rawConfig.auth || rawConfig.authentication || {}),
    headers: normalizeKeyValueList(rawConfig.headers),
    queryParams: normalizeKeyValueList(rawConfig.queryParams),
    bodyParams: normalizeKeyValueList(rawConfig.bodyParams),
    bodyTemplate: rawConfig.bodyTemplate === undefined ? "" : String(rawConfig.bodyTemplate || ""),
    bodyType: normalizeEnum(rawConfig.bodyType || "json", ["json", "form", "text", "none"], "json"),
    includeMetadata: rawConfig.includeMetadata !== false,
    parameterDataSet: normalizeParameterDataSetConfig(rawConfig.parameterDataSet || rawConfig.parameterDataset || {}),
    rateLimit: {
      requestIntervalMs: clampNumber(rawConfig.rateLimit?.requestIntervalMs, 0, 60000, 0),
      maxRequestsPerRun: clampNumber(rawConfig.rateLimit?.maxRequestsPerRun, 1, 10000, 1000),
    },
    pagination: {
      type: normalizeEnum(pagination.type || "none", ["none", "page", "offset", "cursor"], "none"),
      injectInto: normalizeEnum(pagination.injectInto || "query", ["query", "header", "body"], "query"),
      pageParam: String(pagination.pageParam || "page"),
      pageSizeParam: String(pagination.pageSizeParam || "pageSize"),
      offsetParam: String(pagination.offsetParam || "offset"),
      limitParam: String(pagination.limitParam || "limit"),
      cursorParam: String(pagination.cursorParam || "cursor"),
      pageSize: clampNumber(pagination.pageSize, 1, 5000, 100),
      startPage: clampNumber(pagination.startPage, 0, 1000000, 1),
      startOffset: clampNumber(pagination.startOffset, 0, 1000000000, 0),
      maxPages: clampNumber(pagination.maxPages, 1, 1000, 100),
      nextCursorPath: String(pagination.nextCursorPath || ""),
      stopWhenEmpty: pagination.stopWhenEmpty !== false,
    },
    incremental: {
      enabled: Boolean(incremental.enabled),
      cursorField: String(incremental.cursorField || ""),
      startParam: String(incremental.startParam || "startTime"),
      endParam: String(incremental.endParam || "endTime"),
      injectInto: normalizeEnum(incremental.injectInto || "query", ["query", "header", "body"], "query"),
      startValue: incremental.startValue === undefined ? "" : String(incremental.startValue || ""),
    },
  };
}

function normalizeApiParseConfig(rawConfig = {}) {
  const recordPath = rawConfig.recordPath !== undefined
    ? rawConfig.recordPath
    : (rawConfig.jsonRootPath !== undefined ? rawConfig.jsonRootPath : "data");
  return {
    responseFormat: normalizeEnum(rawConfig.responseFormat || "json", ["json", "text"], "json"),
    recordPath: String(recordPath).trim(),
    flattenJson: rawConfig.flattenJson !== false,
    keepRawResponse: Boolean(rawConfig.keepRawResponse),
    skipErrorRows: rawConfig.skipErrorRows !== false,
  };
}

function normalizeApiErrorConfig(rawConfig = {}) {
  return {
    successStatusCodes: normalizeStatusCodes(rawConfig.successStatusCodes, [200]),
    retryStatusCodes: normalizeStatusCodes(rawConfig.retryStatusCodes, [429, 500, 502, 503, 504]),
    maxRetries: clampNumber(rawConfig.maxRetries, 0, 10, 2),
    retryIntervalMs: clampNumber(rawConfig.retryIntervalMs, 500, 60000, 2000),
  };
}

async function testApiConnection(connectionConfig = {}, options = {}) {
  const config = normalizeApiConnectionConfig(connectionConfig);
  if (!config.baseUrl) {
    return { success: false, message: "缺少 API Base URL" };
  }

  const baseReachability = await probeApiReachability(config.baseUrl, config.timeoutMs);
  if (!baseReachability.success) {
    return {
      success: false,
      message: "API Base URL 连通性测试失败",
      error: baseReachability.error,
    };
  }

  return {
    success: true,
    message: `API 地址可访问，状态码 ${baseReachability.statusCode}，耗时 ${baseReachability.durationMs}ms；具体接口请在接入任务中配置并测试。`,
  };
}

async function probeApiReachability(baseUrl, timeoutMs) {
  try {
    const startedAt = Date.now();
    const response = await fetchWithTimeout(baseUrl, {
      method: "HEAD",
      timeoutMs,
    });
    return {
      success: true,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (!isHeadUnsupportedError(error)) {
      return {
        success: false,
        error: error.message,
      };
    }

    try {
      const startedAt = Date.now();
      const response = await fetchWithTimeout(baseUrl, {
        method: "GET",
        timeoutMs,
      });
      return {
        success: true,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
      };
    } catch (fallbackError) {
      return {
        success: false,
        error: fallbackError.message,
      };
    }
  }
}

async function probeApiEndpoint(config, options = {}) {
  const sourceConfig = normalizeApiSourceConfig({
    endpointPath: options.endpointPath || config.defaultPath,
    method: options.method || "GET",
    queryParams: options.queryParams || [],
    headers: options.headers || [],
    bodyType: "none",
  }, config.defaultPath);
  const parseConfig = normalizeApiParseConfig({ recordPath: "" });
  const errorConfig = normalizeApiErrorConfig({ successStatusCodes: [200, 201, 204] });
  try {
    const result = await fetchApiPage({ connectionConfig: config, sourceConfig, parseConfig, errorConfig, context: buildVariableContext({}) });
    return {
      success: true,
      statusCode: result.statusCode,
      durationMs: result.durationMs,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function fetchWithTimeout(url, { method, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function isHeadUnsupportedError(error) {
  const message = String(error?.message || "");
  return /405|method|HEAD/i.test(message);
}

async function sampleApiRows(dataSource, objectName, options = {}) {
  const connectionConfig = normalizeApiConnectionConfig(dataSource?.connectionConfig || {});
  const sourceConfig = normalizeApiSourceConfig(options.sourceConfig || {}, objectName || connectionConfig.defaultPath);
  const parseConfig = normalizeApiParseConfig(options.parseConfig || {});
  const errorConfig = normalizeApiErrorConfig(options.errorConfig || {});
  const limit = clampNumber(options.limit, 1, 100, 20);
  const result = await collectApiRows({
    task: { id: 0, taskCode: "preview", sourceTable: objectName },
    connectionConfig,
    sourceConfig: {
      ...sourceConfig,
      pagination: { ...sourceConfig.pagination, maxPages: 1 },
      rateLimit: { ...sourceConfig.rateLimit, maxRequestsPerRun: 1 },
    },
    parseConfig,
    errorConfig,
    state: null,
    limit,
  });
  return result.rows.slice(0, limit);
}

async function collectApiRows({ task, connectionConfig, sourceConfig, parseConfig, errorConfig, state, limit = null }) {
  const safeConnectionConfig = normalizeApiConnectionConfig(connectionConfig || {});
  const safeSourceConfig = normalizeApiSourceConfig(sourceConfig || {}, task?.sourceTable || "");
  const safeParseConfig = normalizeApiParseConfig(parseConfig || {});
  const safeErrorConfig = normalizeApiErrorConfig(errorConfig || {});
  if (!safeConnectionConfig.baseUrl) {
    throw new AppError("API 数据源缺少 Base URL", 400);
  }
  if (!safeSourceConfig.endpointPath) {
    throw new AppError("API 接入任务缺少接口路径", 400);
  }

  const rows = [];
  const pageResults = [];
  const maxRecords = limit || safeSourceConfig.pagination.pageSize * safeSourceConfig.pagination.maxPages;
  let lastCursorValue = state?.lastCursorValue || safeSourceConfig.incremental.startValue || "";
  let lastPage = safeSourceConfig.pagination.startPage;
  let lastOffset = safeSourceConfig.pagination.startOffset;
  let lastNextCursor = "";
  const parameterRows = await loadParameterDataSetRows(safeSourceConfig.parameterDataSet, task);
  const parameterContexts = buildParameterContexts(parameterRows, safeSourceConfig.parameterDataSet);

  for (const parameterContext of parameterContexts) {
    if (rows.length >= maxRecords) break;
    const paginationState = createInitialPaginationState(safeSourceConfig.pagination, state);
    let nextCursor = paginationState.cursor;

    for (let pageIndex = 0; pageIndex < safeSourceConfig.pagination.maxPages; pageIndex += 1) {
      if (pageIndex >= safeSourceConfig.rateLimit.maxRequestsPerRun || rows.length >= maxRecords) break;
      const context = buildVariableContext({
        task,
        state,
        page: paginationState.page,
        offset: paginationState.offset,
        limit: safeSourceConfig.pagination.pageSize,
        cursor: nextCursor,
        lastCursor: lastCursorValue,
        parameterContext,
      });
      const result = await fetchApiPage({
        connectionConfig: safeConnectionConfig,
        sourceConfig: safeSourceConfig,
        parseConfig: safeParseConfig,
        errorConfig: safeErrorConfig,
        context,
      });
      const parsedRows = parseApiResponseRows(result, safeParseConfig, safeSourceConfig, {
        page: paginationState.page,
        offset: paginationState.offset,
        cursor: nextCursor,
      });
      rows.push(...parsedRows.slice(0, Math.max(0, maxRecords - rows.length)));
      pageResults.push({
        statusCode: result.statusCode,
        durationMs: result.durationMs,
        records: parsedRows.length,
        page: paginationState.page,
        offset: paginationState.offset,
        cursor: nextCursor || null,
        parameterIndex: parameterContext?.datasetIndex ?? null,
      });

      const cursorCandidate = safeSourceConfig.pagination.nextCursorPath
        ? getByPath(result.payload, safeSourceConfig.pagination.nextCursorPath)
        : null;
      nextCursor = cursorCandidate === undefined || cursorCandidate === null ? "" : String(cursorCandidate);
      lastPage = paginationState.page;
      lastOffset = paginationState.offset;
      lastNextCursor = nextCursor || "";
      if (safeSourceConfig.pagination.type === "none") break;
      if (safeSourceConfig.pagination.stopWhenEmpty && parsedRows.length === 0) break;
      if (safeSourceConfig.pagination.type === "cursor" && !nextCursor) break;
      if (parsedRows.length < safeSourceConfig.pagination.pageSize && safeSourceConfig.pagination.type !== "cursor") break;

      paginationState.page += 1;
      paginationState.offset += safeSourceConfig.pagination.pageSize;
      if (safeSourceConfig.rateLimit.requestIntervalMs > 0) {
        await delay(safeSourceConfig.rateLimit.requestIntervalMs);
      }
    }
  }

  if (safeSourceConfig.incremental.enabled && safeSourceConfig.incremental.cursorField) {
    lastCursorValue = resolveMaxCursor(rows, safeSourceConfig.incremental.cursorField) || lastCursorValue;
  }

  return {
    rows,
    state: {
      stateKey: "default",
      lastCursorValue: lastCursorValue || null,
      lastPage,
      lastOffset,
      lastNextCursor: lastNextCursor || null,
      lastSuccessTime: new Date().toISOString(),
    },
    pageResults,
  };
}

function normalizeParameterDataSetConfig(value = {}) {
  return {
    enabled: Boolean(value.enabled),
    sourceId: Number(value.sourceId || value.dataSourceId || 0) || null,
    sql: String(value.sql || value.query || "").trim(),
    limit: clampNumber(value.limit || value.maxRows, 1, 500, 20),
    mode: normalizeEnum(value.mode || "loop", ["loop", "bulk"], "loop"),
    payloadKey: String(value.payloadKey || "items").trim() || "items",
  };
}

async function loadParameterDataSetRows(parameterDataSet, task = {}) {
  if (!parameterDataSet?.enabled) return [];
  if (!parameterDataSet.sourceId) {
    throw new AppError("SQL 参数集缺少参数来源库", 400);
  }
  if (!parameterDataSet.sql) {
    throw new AppError("SQL 参数集缺少查询语句", 400);
  }

  const safeSql = normalizeReadOnlySql(parameterDataSet.sql);
  const projectWhere = task?.projectId ? " AND project_id = ?" : "";
  const [sourceRows] = await pool.query(
    `SELECT id, source_name AS sourceName, source_type AS sourceType, connection_config AS connectionConfig
     FROM ingestion_data_sources
     WHERE id = ?${projectWhere}`,
    task?.projectId ? [parameterDataSet.sourceId, task.projectId] : [parameterDataSet.sourceId]
  );
  const source = sourceRows[0];
  if (!source) {
    throw new AppError("SQL 参数集来源库不存在或不属于当前项目", 404);
  }

  const connectionConfig = parseConnectionConfig(source.connectionConfig);
  const dialect = inferDatasourceDialect(source.sourceType, connectionConfig);
  if (!["mysql", "postgresql"].includes(dialect)) {
    throw new AppError("SQL 参数集当前仅支持 MySQL、PostgreSQL 和 GaussDB 数据源", 400);
  }

  return queryParameterDataSetRows({
    sourceType: source.sourceType,
    dialect,
    connectionConfig,
    sql: safeSql,
    limit: parameterDataSet.limit,
  });
}

function normalizeReadOnlySql(sql) {
  const normalized = String(sql || "").trim().replace(/;+$/g, "").trim();
  if (!/^(select|with)\b/i.test(normalized)) {
    throw new AppError("SQL 参数集只允许执行 SELECT 或 WITH 查询", 400);
  }
  if (normalized.includes(";")) {
    throw new AppError("SQL 参数集不允许包含多条 SQL", 400);
  }
  return normalized;
}

async function queryParameterDataSetRows({ sourceType, dialect, connectionConfig, sql, limit }) {
  const limitedSql = `SELECT * FROM (${sql}) AS medata_api_param_dataset LIMIT ${Number(limit)}`;
  const resolved = resolveDatasourceConnection(sourceType, connectionConfig || {});

  if (dialect === "mysql") {
    const connection = await mysql.createConnection({
      host: resolved.host,
      port: Number(resolved.port || 3306),
      database: resolved.database,
      user: resolved.username,
      password: resolved.password,
      connectTimeout: 8000,
    });
    try {
      const [rows] = await connection.query(limitedSql);
      return normalizeParameterRows(rows);
    } finally {
      await connection.end();
    }
  }

  const client = createPostgresLikeClient({
    host: resolved.host,
    port: Number(resolved.port || 5432),
    database: resolved.database,
    user: resolved.username,
    username: resolved.username,
    password: resolved.password,
    connectionTimeoutMillis: 8000,
  }, {
    sourceType,
  });
  await client.connect();
  try {
    const result = await client.query(limitedSql);
    return normalizeParameterRows(result.rows || []);
  } finally {
    await client.end();
  }
}

function normalizeParameterRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [key, normalizeParameterValue(value)])
  ));
}

function normalizeParameterValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return value;
}

function buildParameterContexts(rows = [], parameterDataSet = {}) {
  const parameterRows = Array.isArray(rows) ? rows : [];
  if (!parameterDataSet?.enabled || parameterRows.length === 0) {
    return [{}];
  }

  const payloadKey = String(parameterDataSet.payloadKey || "items").trim() || "items";
  if (parameterDataSet.mode === "bulk") {
    return [buildParameterContext({
      datasetIndex: 0,
      row: null,
      rows: parameterRows,
      payloadKey,
      mode: "bulk",
    })];
  }

  return parameterRows.map((row, index) => buildParameterContext({
    datasetIndex: index,
    row,
    rows: parameterRows,
    payloadKey,
    mode: "loop",
  }));
}

function buildParameterContext({ datasetIndex, row, rows, payloadKey, mode }) {
  const dataset = {
    mode,
    index: datasetIndex,
    count: rows.length,
    row: row || {},
    rows,
    [payloadKey]: rows,
  };
  const context = {
    dataset,
    datasetIndex,
    "dataset.mode": mode,
    "dataset.index": datasetIndex,
    "dataset.count": rows.length,
    "dataset.row": row || {},
    "dataset.rows": rows,
    [`dataset.${payloadKey}`]: rows,
  };

  if (row && typeof row === "object") {
    Object.entries(row).forEach(([key, value]) => {
      context[`dataset.${key}`] = value;
      context[`dataset.row.${key}`] = value;
    });
  }

  return context;
}

function parseConnectionConfig(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) || {};
    } catch (error) {
      return {};
    }
  }
  return value || {};
}

function inferApiColumns(rows = []) {
  const fields = new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    Object.entries(row).forEach(([key, value]) => {
      const current = fields.get(key) || { values: [], nullable: false };
      if (value === null || value === undefined || value === "") current.nullable = true;
      if (current.values.length < 20) current.values.push(value);
      fields.set(key, current);
    });
  }
  return [...fields.entries()].map(([columnName, meta], index) => ({
    columnName,
    ordinalPosition: index + 1,
    dataType: inferSampleType(meta.values),
    columnType: inferSampleType(meta.values),
    isNullable: meta.nullable,
    isPrimaryKey: false,
    columnComment: "",
  }));
}

function fetchApiPage({ connectionConfig, sourceConfig, parseConfig, errorConfig, context }) {
  return fetchApiPageWithRetry({ connectionConfig, sourceConfig, parseConfig, errorConfig, context });
}

async function fetchApiPageWithRetry({ connectionConfig, sourceConfig, parseConfig, errorConfig, context }) {
  let lastError = null;
  for (let attempt = 0; attempt <= errorConfig.maxRetries; attempt += 1) {
    const startedAt = Date.now();
    try {
      const request = buildRequest(connectionConfig, sourceConfig, context);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), connectionConfig.timeoutMs);
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await response.text();
      const durationMs = Date.now() - startedAt;
      if (!errorConfig.successStatusCodes.includes(response.status)) {
        const message = `API 请求返回异常状态码 ${response.status}`;
        if (errorConfig.retryStatusCodes.includes(response.status) && attempt < errorConfig.maxRetries) {
          await delay(errorConfig.retryIntervalMs);
          continue;
        }
        throw new AppError(message, 400, { statusCode: response.status, responseText: truncateText(text) });
      }
      return {
        statusCode: response.status,
        durationMs,
        payload: parseConfig.responseFormat === "json" && text ? JSON.parse(text) : text,
        responseText: text,
        requestInfo: sanitizeRequestInfo(request),
      };
    } catch (error) {
      lastError = error;
      if (attempt < errorConfig.maxRetries) {
        await delay(errorConfig.retryIntervalMs);
        continue;
      }
    }
  }
  throw lastError;
}

function buildRequest(connectionConfig, sourceConfig, context) {
  const url = new URL(resolveApiUrl(connectionConfig.baseUrl, sourceConfig.endpointPath));
  const headers = {};
  applyKeyValueList(headers, connectionConfig.headers, context);
  applyKeyValueList(headers, sourceConfig.headers, context);
  const bodyValues = {};
  applyParams(url, headers, bodyValues, sourceConfig.queryParams, "query", context);
  applyParams(url, headers, bodyValues, sourceConfig.bodyParams, "body", context);
  applyAuth(url, headers, bodyValues, resolveRequestAuthConfig(connectionConfig, sourceConfig), context);
  applyPaging(url, headers, bodyValues, sourceConfig.pagination, context);

  let body = null;
  if (!["GET"].includes(sourceConfig.method) && sourceConfig.bodyType !== "none") {
    if (sourceConfig.bodyTemplate) {
      body = renderTemplate(sourceConfig.bodyTemplate, context);
    } else if (sourceConfig.bodyType === "form") {
      const form = new URLSearchParams();
      Object.entries(bodyValues).forEach(([key, value]) => form.set(key, value));
      body = form.toString();
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    } else if (sourceConfig.bodyType === "text") {
      body = Object.values(bodyValues).join("\n");
      headers["Content-Type"] = "text/plain";
    } else {
      body = JSON.stringify(bodyValues);
      headers["Content-Type"] = sourceConfig.contentType;
    }
  }

  return { url: url.toString(), method: sourceConfig.method, headers, body };
}

function resolveApiUrl(baseUrl, endpointPath) {
  const path = String(endpointPath || "").trim();
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

function applyAuth(url, headers, bodyValues, connectionConfig, context) {
  if (connectionConfig.authType === "basic") {
    const token = Buffer.from(`${connectionConfig.username}:${connectionConfig.password}`).toString("base64");
    headers.Authorization = `Basic ${token}`;
    return;
  }
  if (connectionConfig.authType === "bearer" && connectionConfig.bearerToken) {
    headers.Authorization = `Bearer ${renderTemplate(connectionConfig.bearerToken, context)}`;
    return;
  }
  if (connectionConfig.authType === "api_key" && connectionConfig.apiKeyName && connectionConfig.apiKeyValue) {
    const value = renderTemplate(connectionConfig.apiKeyValue, context);
    if (connectionConfig.apiKeyIn === "query") url.searchParams.set(connectionConfig.apiKeyName, value);
    else if (connectionConfig.apiKeyIn === "body") bodyValues[connectionConfig.apiKeyName] = value;
    else headers[connectionConfig.apiKeyName] = value;
  }
}

function resolveRequestAuthConfig(connectionConfig, sourceConfig) {
  const taskAuth = normalizeApiAuthConfig(sourceConfig?.auth || {});
  if (taskAuth.authType !== "none") {
    return taskAuth;
  }
  return connectionConfig;
}

function applyPaging(url, headers, bodyValues, pagination, context) {
  if (!pagination || pagination.type === "none") return;
  if (pagination.type === "page") {
    setParamByLocation(url, headers, bodyValues, pagination.injectInto, pagination.pageParam, String(context.page));
    setParamByLocation(url, headers, bodyValues, pagination.injectInto, pagination.pageSizeParam, String(pagination.pageSize));
  } else if (pagination.type === "offset") {
    setParamByLocation(url, headers, bodyValues, pagination.injectInto, pagination.offsetParam, String(context.offset));
    setParamByLocation(url, headers, bodyValues, pagination.injectInto, pagination.limitParam, String(pagination.pageSize));
  } else if (pagination.type === "cursor") {
    if (context.cursor) setParamByLocation(url, headers, bodyValues, pagination.injectInto, pagination.cursorParam, String(context.cursor));
    setParamByLocation(url, headers, bodyValues, pagination.injectInto, pagination.pageSizeParam, String(pagination.pageSize));
  }
}

function applyParams(url, headers, bodyValues, params, defaultLocation, context) {
  for (const item of params || []) {
    if (!item || item.enabled === false) continue;
    const name = String(item.name || item.key || "").trim();
    if (!name) continue;
    const value = resolveParamValue(item, context);
    setParamByLocation(url, headers, bodyValues, item.in || item.location || defaultLocation, name, value);
  }
}

function setParamByLocation(url, headers, bodyValues, location, name, value) {
  const normalized = String(location || "query").toLowerCase();
  const scalarValue = Array.isArray(value) || (value && typeof value === "object") ? JSON.stringify(value) : value;
  if (normalized === "header") headers[name] = scalarValue;
  else if (normalized === "body") bodyValues[name] = value;
  else url.searchParams.set(name, scalarValue);
}

function resolveParamValue(item, context) {
  const mode = normalizeEnum(item?.valueMode || "custom", ["custom", "system", "dataset", "checkpoint"], "custom");
  if (mode === "system") {
    return resolveSystemParamValue(item);
  }
  if (mode === "dataset") {
    const field = String(item?.datasetField || "").trim();
    if (!field) return "";
    return context[`dataset.${field}`] ?? getByPath(context, `dataset.row.${field}`) ?? "";
  }
  if (mode === "checkpoint") {
    return resolveCheckpointParamValue(item, context);
  }
  return renderTemplate(item?.value ?? "", context);
}

function resolveCheckpointParamValue(item, context) {
  const key = String(item?.checkpointKey || "last_cursor");
  if (key === "last_success_time") {
    return context["state.last_success_time"] || context.last_success_time || "";
  }
  return context["state.last_cursor"] || context.last_cursor || "";
}

function resolveSystemParamValue(item) {
  const key = String(item?.systemKey || "now");
  if (key === "value_range") {
    const start = Number(item?.rangeStart ?? 0);
    const end = Number(item?.rangeEnd ?? start);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    return String(Math.floor(min + Math.random() * (max - min + 1)));
  }

  let date = new Date();
  if (key === "today") date = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  if (key === "yesterday") date = new Date(Date.now() - 24 * 60 * 60 * 1000);
  date = applyDateOffset(date, Number(item?.systemOffsetAmount || 0), item?.systemOffsetUnit || "day");
  return formatSystemDateValue(date, item?.systemFormat, key);
}

function applyDateOffset(date, amount, unit) {
  if (!Number.isFinite(amount) || amount === 0) return date;
  const next = new Date(date.getTime());
  const normalized = String(unit || "day");
  if (normalized === "minute") next.setMinutes(next.getMinutes() + amount);
  else if (normalized === "hour") next.setHours(next.getHours() + amount);
  else if (normalized === "month") next.setMonth(next.getMonth() + amount);
  else next.setDate(next.getDate() + amount);
  return next;
}

function formatSystemDateValue(date, format, key) {
  const pad = (value) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  const normalized = String(format || "").trim();
  if (normalized === "timestamp_ms" || key === "timestamp") return String(date.getTime());
  if (normalized === "timestamp_s") return String(Math.floor(date.getTime() / 1000));
  if (normalized === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  if (normalized === "YYYY-MM-DD HH:mm:ss") return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  if (normalized === "YYYYMMDD") return `${year}${month}${day}`;
  return date.toISOString();
}

function parseApiResponseRows(result, parseConfig, sourceConfig, pageState) {
  if (parseConfig.responseFormat === "text") {
    return [{ value: String(result.responseText || ""), ...buildMetadata(sourceConfig, result, pageState) }];
  }
  const resolved = parseConfig.recordPath ? getByPath(result.payload, parseConfig.recordPath) : result.payload;
  const items = Array.isArray(resolved) ? resolved : (resolved ? [resolved] : []);
  return items
    .filter((item) => item !== null && item !== undefined)
    .map((item) => {
      const row = item && typeof item === "object" && !Array.isArray(item)
        ? (parseConfig.flattenJson ? flattenObject(item) : item)
        : { value: item };
      return {
        ...row,
        ...(parseConfig.keepRawResponse ? { _raw_response: result.responseText } : {}),
        ...buildMetadata(sourceConfig, result, pageState),
      };
    });
}

function buildMetadata(sourceConfig, result, pageState) {
  if (sourceConfig.includeMetadata === false) return {};
  return {
    _api_status: result.statusCode,
    _api_page: pageState.page ?? null,
    _api_offset: pageState.offset ?? null,
    _api_cursor: pageState.cursor ?? null,
    _api_request_time: new Date().toISOString(),
  };
}

function createInitialPaginationState(pagination) {
  return {
    page: Number(pagination.startPage || 1),
    offset: Number(pagination.startOffset || 0),
    cursor: "",
  };
}

function buildVariableContext({ task = {}, state = {}, page = 1, offset = 0, limit = 100, cursor = "", lastCursor = "", parameterContext = {} }) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    now: now.toISOString(),
    today,
    yesterday,
    "sys.now": now.toISOString(),
    "sys.today": today,
    "sys.yesterday": yesterday,
    "run.page": page,
    "run.offset": offset,
    "run.limit": limit,
    "run.cursor": cursor || "",
    "state.last_cursor": lastCursor || state?.lastCursorValue || "",
    "state.last_success_time": state?.lastSuccessTime || "",
    "task.code": task?.taskCode || "",
    "task.project_id": task?.projectId || "",
    page,
    offset,
    limit,
    cursor: cursor || "",
    last_cursor: lastCursor || state?.lastCursorValue || "",
    last_success_time: state?.lastSuccessTime || "",
    task_code: task?.taskCode || "",
    project_id: task?.projectId || "",
    ...(parameterContext || {}),
  };
}

function renderTemplate(value, context) {
  return String(value ?? "").replace(/\$\{([a-zA-Z0-9_.]+)\}/g, (_match, key) => {
    const next = context[key] !== undefined ? context[key] : getByPath(context, key);
    if (Array.isArray(next) || (next && typeof next === "object")) return JSON.stringify(next);
    return next === undefined || next === null ? "" : String(next);
  });
}

function getByPath(value, path) {
  const parts = String(path || "").replace(/^\$\./, "").split(".").map((item) => item.trim()).filter(Boolean);
  if (!parts.length) return value;
  return parts.reduce((current, part) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(part)) return current[Number(part)];
    return typeof current === "object" ? current[part] : undefined;
  }, value);
}

function flattenObject(value, prefix = "", result = {}) {
  Object.entries(value || {}).forEach(([key, item]) => {
    const nextKey = prefix ? `${prefix}_${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      flattenObject(item, nextKey, result);
    } else {
      result[nextKey] = Array.isArray(item) ? JSON.stringify(item) : item;
    }
  });
  return result;
}

function resolveMaxCursor(rows, cursorField) {
  const values = rows.map((row) => row?.[cursorField]).filter((value) => value !== undefined && value !== null && value !== "");
  if (!values.length) return null;
  return values.map((value) => String(value)).sort().at(-1);
}

function normalizeKeyValueList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        name: String(item?.name || item?.key || "").trim(),
        value: item?.value === undefined ? "" : String(item.value),
        in: item?.in || item?.location,
        enabled: item?.enabled !== false,
        valueMode: normalizeEnum(item?.valueMode || "custom", ["custom", "system", "dataset", "checkpoint"], "custom"),
        systemKey: String(item?.systemKey || ""),
        checkpointKey: normalizeEnum(item?.checkpointKey || "last_cursor", ["last_cursor", "last_success_time"], "last_cursor"),
        systemFormat: String(item?.systemFormat || ""),
        systemOffsetAmount: Number(item?.systemOffsetAmount || 0) || 0,
        systemOffsetUnit: normalizeEnum(item?.systemOffsetUnit || "day", ["minute", "hour", "day", "month"], "day"),
        rangeStart: item?.rangeStart,
        rangeEnd: item?.rangeEnd,
        datasetField: String(item?.datasetField || ""),
      }))
      .filter((item) => item.name);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).map(([name, itemValue]) => ({ name, value: String(itemValue ?? ""), enabled: true }));
  }
  return [];
}

function normalizeApiAuthConfig(value = {}) {
  const authType = normalizeEnum(value.authType || value.type || "none", ["none", "basic", "bearer", "api_key"], "none");
  return {
    authType,
    bearerToken: String(value.bearerToken || value.token || value.value || ""),
    username: String(value.username || value.user || ""),
    password: String(value.password || ""),
    apiKeyName: String(value.apiKeyName || value.name || "x-api-key"),
    apiKeyValue: String(value.apiKeyValue || value.apiKey || value.value || ""),
    apiKeyIn: normalizeEnum(value.apiKeyIn || value.in || "header", ["header", "query", "body"], "header"),
  };
}

function applyKeyValueList(headers, entries, context) {
  for (const item of entries || []) {
    if (!item || item.enabled === false || !item.name) continue;
    const value = resolveParamValue(item, context);
    headers[item.name] = Array.isArray(value) || (value && typeof value === "object") ? JSON.stringify(value) : value;
  }
}

function normalizeStatusCodes(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const result = value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 100 && item <= 599);
  return result.length ? result : fallback;
}

function normalizeEnum(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeHttpMethod(value) {
  return normalizeEnum(value || "GET", ["get", "post", "put", "patch"], "get").toUpperCase();
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function inferSampleType(values = []) {
  const nonEmpty = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (!nonEmpty.length) return "text";
  if (nonEmpty.every((value) => typeof value === "boolean" || ["true", "false", "0", "1"].includes(String(value).toLowerCase()))) {
    return "boolean";
  }
  if (nonEmpty.every((value) => Number.isInteger(Number(value)))) {
    return "bigint";
  }
  if (nonEmpty.every((value) => Number.isFinite(Number(value)))) {
    return "decimal(18,2)";
  }
  if (nonEmpty.every((value) => !Number.isNaN(new Date(value).getTime())) && nonEmpty.some((value) => String(value).includes("-"))) {
    return "datetime";
  }
  const maxLength = Math.max(...nonEmpty.map((value) => String(value).length));
  return maxLength > 255 ? "text" : "varchar(255)";
}

function sanitizeRequestInfo(request) {
  return {
    url: request.url.replace(/([?&][^=]*(token|secret|password|api[_-]?key)[^=]*=)[^&]*/ig, "$1******"),
    method: request.method,
    headers: Object.fromEntries(Object.entries(request.headers || {}).map(([key, value]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "******" : value,
    ])),
  };
}

function truncateText(value, maxLength = 1000) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  collectApiRows,
  inferApiColumns,
  normalizeApiConnectionConfig,
  normalizeApiErrorConfig,
  normalizeApiParseConfig,
  normalizeApiSourceConfig,
  sampleApiRows,
  testApiConnection,
};
