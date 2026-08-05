const AppError = require("../../common/errors/app-error");
const { escapeIdentifier } = require("../data-sources/data-source.metadata");
const { resolveDatasourceConnection } = require("../../common/utils/datasource-dialect");

const MAX_PAGE_SIZE = 100;

function normalizeServicePath(value) {
  const normalized = `/${String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")}`;

  if (normalized === "/") {
    throw new AppError("服务路径不能为空", 400);
  }

  return normalized;
}

function normalizeRequestMethod(value) {
  const normalized = String(value || "GET").trim().toUpperCase();
  if (!["GET", "POST"].includes(normalized)) {
    throw new AppError("当前仅支持 GET 和 POST 请求", 400);
  }
  return normalized;
}

function normalizeAuthType(value) {
  const normalized = String(value || "token").trim().toLowerCase();
  if (!["anonymous", "token"].includes(normalized)) {
    throw new AppError("认证方式仅支持 anonymous 或 token", 400);
  }
  return normalized;
}

function normalizeServiceStatus(value) {
  const normalized = String(value || "draft").trim().toLowerCase();
  if (!["draft", "published", "disabled"].includes(normalized)) {
    throw new AppError("服务状态仅支持 draft、published、disabled", 400);
  }
  return normalized;
}

function normalizeServiceType(value) {
  const normalized = String(value || "list").trim().toLowerCase();
  if (!["list", "detail"].includes(normalized)) {
    throw new AppError("服务类型仅支持 list 或 detail", 400);
  }
  return normalized;
}

function normalizeServiceMode(value) {
  const normalized = String(value || "table").trim().toLowerCase();
  if (!["table", "sql"].includes(normalized)) {
    throw new AppError("服务模式仅支持 table 或 sql", 400);
  }
  return normalized;
}

function getPlaceholder(dialect, index) {
  if (dialect === "postgresql") return `$${index}`;
  if (dialect === "oracle") return `:${index}`;
  return "?";
}

function getFlatValue(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue[0];
  }
  return rawValue;
}

function hasValue(value) {
  return !(value === undefined || value === null || String(value).trim() === "");
}

function normalizeNumber(value, fieldLabel) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(`${fieldLabel} 必须为数值`, 400);
  }
  return parsed;
}

function shouldKeepNumericString(value, fieldLabel = "") {
  const text = String(value ?? "").trim();
  if (!/^-?\d+$/.test(text)) return false;
  if (text.length >= 16) return true;
  const normalizedLabel = String(fieldLabel || "").trim().toLowerCase();
  return /(id[_\s-]*no|card|证件|身份证)/i.test(normalizedLabel);
}

function normalizeBoolean(value) {
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  throw new AppError("布尔参数取值无效", 400);
}

function convertValueByType(value, dataType = "string", fieldLabel = "参数") {
  if (value === undefined || value === null || value === "") {
    return value;
  }

  const normalizedType = String(dataType || "string").trim().toLowerCase();
  if (["int", "integer", "bigint", "decimal", "numeric", "float", "double"].includes(normalizedType)) {
    if (shouldKeepNumericString(value, fieldLabel)) {
      return String(value).trim();
    }
    return normalizeNumber(value, fieldLabel);
  }
  if (["boolean", "bool"].includes(normalizedType)) {
    return normalizeBoolean(value);
  }
  return value;
}

function getParamValue(input, key) {
  if (!key) return undefined;
  return getFlatValue(input?.[key]);
}

function buildQualifiedTableName(dataSource, tableName, dialect) {
  const resolved = resolveDatasourceConnection(dataSource?.sourceType, dataSource?.connectionConfig || {});
  if (["postgresql", "oracle", "dm"].includes(dialect)) {
    const schema = String(resolved.schema || (dialect === "postgresql" ? "public" : resolved.username || "")).trim();
    return escapeIdentifier(`${schema}.${tableName}`, dialect);
  }

  const database = String(resolved.database || "").trim();
  if (database) {
    return escapeIdentifier(`${database}.${tableName}`, dialect);
  }

  return escapeIdentifier(tableName, dialect);
}

function normalizeSourceSql(sqlText = "") {
  const normalized = String(sqlText || "").trim().replace(/;+\s*$/g, "");
  if (!normalized) {
    throw new AppError("SQL 内容不能为空", 400);
  }
  if (!/^(select|with)\b/i.test(normalized)) {
    throw new AppError("当前仅支持 SELECT / WITH 查询 SQL", 400);
  }
  return normalized;
}

function stripTrailingLimitOffset(sqlText = "") {
  return String(sqlText || "")
    .trim()
    .replace(/\s+offset\s+\d+\s*$/i, "")
    .replace(/\s+limit\s+\d+\s*$/i, "")
    .trim();
}

function buildSelectFields(responseFields, dialect) {
  if (!Array.isArray(responseFields) || responseFields.length === 0) {
    throw new AppError("至少需要选择一个返回字段", 400);
  }

  return responseFields.map((field) => {
    const columnName = String(field.columnName || "").trim();
    const fieldName = String(field.fieldName || field.columnName || "").trim();
    if (!columnName || !fieldName) {
      throw new AppError("返回字段配置不完整", 400);
    }

    return `${escapeIdentifier(columnName, dialect)} AS ${escapeIdentifier(fieldName, dialect)}`;
  });
}

function buildWhereFragments(filters, input, dialect, params) {
  const clauses = [];
  const parameterMeta = [];
  const oneOfGroups = new Map();

  for (const filter of Array.isArray(filters) ? filters : []) {
    const operator = String(filter.operator || "eq").trim().toLowerCase();
    const columnName = String(filter.columnName || "").trim();
    const label = String(filter.label || filter.paramName || columnName || "参数");
    const dataType = String(filter.dataType || "string").trim();
    const requirementMode = String(filter.requirementMode || (filter.required ? "required" : "optional")).trim().toLowerCase();
    const requiredGroup = String(filter.requiredGroup || "").trim();
    if (!columnName) {
      continue;
    }

    const columnSql = escapeIdentifier(columnName, dialect);

    if (operator === "between") {
      const startValue = getParamValue(input, filter.startParamName);
      const endValue = getParamValue(input, filter.endParamName);
      const hasStart = hasValue(startValue);
      const hasEnd = hasValue(endValue);

      if (requirementMode === "required" && (!hasStart || !hasEnd)) {
        throw new AppError(`${label} 的起止参数不能为空`, 400);
      }

      if (requirementMode === "one_of_group" && requiredGroup) {
        const current = oneOfGroups.get(requiredGroup) || [];
        oneOfGroups.set(requiredGroup, [...current, hasStart && hasEnd]);
      }

      if (hasStart && hasEnd) {
        params.push(convertValueByType(startValue, dataType, `${label}开始值`));
        params.push(convertValueByType(endValue, dataType, `${label}结束值`));
        clauses.push(
          `${columnSql} BETWEEN ${getPlaceholder(dialect, params.length - 1)} AND ${getPlaceholder(dialect, params.length)}`
        );
        parameterMeta.push({
          key: `${filter.startParamName || columnName}~${filter.endParamName || columnName}`,
          value: [startValue, endValue],
        });
      } else if (hasStart || hasEnd) {
        throw new AppError(`${label} 需要同时提供起始值和结束值`, 400);
      }
      continue;
    }

    const rawValue = getParamValue(input, filter.paramName);
    if (!hasValue(rawValue)) {
      if (requirementMode === "required") {
        throw new AppError(`${label} 不能为空`, 400);
      }
      if (requirementMode === "one_of_group" && requiredGroup) {
        const current = oneOfGroups.get(requiredGroup) || [];
        oneOfGroups.set(requiredGroup, [...current, false]);
      }
      continue;
    }

    const value = convertValueByType(rawValue, dataType, label);
    if (operator === "like") {
      params.push(`%${String(value)}%`);
      clauses.push(`${columnSql} LIKE ${getPlaceholder(dialect, params.length)}`);
    } else {
      params.push(value);
      clauses.push(`${columnSql} = ${getPlaceholder(dialect, params.length)}`);
    }

    parameterMeta.push({
      key: filter.paramName || columnName,
      value: rawValue,
    });

    if (requirementMode === "one_of_group" && requiredGroup) {
      const current = oneOfGroups.get(requiredGroup) || [];
      oneOfGroups.set(requiredGroup, [...current, true]);
    }
  }

  Array.from(oneOfGroups.entries()).forEach(([groupKey, values]) => {
    if (!values.some(Boolean)) {
      throw new AppError(`组合参数 ${groupKey} 至少需要填写一个字段`, 400);
    }
  });

  return { clauses, parameterMeta };
}

function buildServiceSql(serviceApi, dataSource, runtimeInput = {}) {
  const resolved = resolveDatasourceConnection(dataSource?.sourceType, dataSource?.connectionConfig || {});
  const dialect = resolved.dialect;
  if (!["mysql", "postgresql", "oracle", "dm"].includes(dialect)) {
    throw new AppError("当前数据源类型不支持发布 API", 400);
  }

  const serviceType = normalizeServiceType(serviceApi.serviceType);
  const serviceMode = normalizeServiceMode(serviceApi.serviceMode);
  const queryConfig = serviceApi.queryConfig || {};
  const responseConfig = serviceApi.responseConfig || {};
  const filters = queryConfig.filters || [];
  const responseFields = responseConfig.fields || [];
  const tableName = String(serviceApi.sourceTable || "").trim();
  const sourceSql = serviceApi.sourceSql ? normalizeSourceSql(serviceApi.sourceSql) : "";
  const executableSourceSql = serviceMode === "sql" ? stripTrailingLimitOffset(sourceSql) : sourceSql;

  if (serviceMode === "table" && !tableName) {
    throw new AppError("服务未绑定数据表", 400);
  }
  if (serviceMode === "sql" && !sourceSql) {
    throw new AppError("服务未配置 SQL", 400);
  }

  const selectFields = buildSelectFields(responseFields, dialect);
  const fromSql = serviceMode === "sql"
    ? `(${executableSourceSql}) ${dialect === "oracle" ? "" : "AS "}${escapeIdentifier("service_sql_result", dialect)}`
    : buildQualifiedTableName(dataSource, tableName, dialect);
  const params = [];
  const { clauses, parameterMeta } = buildWhereFragments(filters, runtimeInput, dialect, params);
  const whereSql = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";

  const normalizedPageNum = Math.max(1, Number(runtimeInput.pageNum || 1) || 1);
  const requestedPageSize = Math.max(1, Number(runtimeInput.pageSize || queryConfig.defaultPageSize || 20) || 20);
  const maxPageSize = Math.max(1, Number(queryConfig.maxPageSize || MAX_PAGE_SIZE) || MAX_PAGE_SIZE);
  const pageSize = Math.min(requestedPageSize, maxPageSize);

  let orderSql = "";
  if (queryConfig.defaultSortField) {
    const direction = String(queryConfig.defaultSortOrder || "desc").trim().toUpperCase() === "ASC" ? "ASC" : "DESC";
    orderSql = ` ORDER BY ${escapeIdentifier(queryConfig.defaultSortField, dialect)} ${direction}`;
  }

  if (serviceType === "detail") {
    return {
      dialect,
      parameterMeta,
      dataSql: dialect === "oracle"
        ? `SELECT * FROM (SELECT ${selectFields.join(", ")} FROM ${fromSql}${whereSql}${orderSql}) WHERE ROWNUM <= 1`
        : dialect === "dm"
          ? `SELECT ${selectFields.join(", ")} FROM ${fromSql}${whereSql}${orderSql} FETCH FIRST 1 ROWS ONLY`
          : `SELECT ${selectFields.join(", ")} FROM ${fromSql}${whereSql}${orderSql} LIMIT 1`,
      dataParams: params,
      countSql: null,
      countParams: [],
      meta: {
        pageNum: 1,
        pageSize: 1,
        serviceType,
        serviceMode,
        paginationEnabled: false,
      },
    };
  }

  const paginationEnabled = queryConfig.pagination !== false;
  const countSql = paginationEnabled ? `SELECT COUNT(*) AS total FROM ${fromSql}${whereSql}` : null;
  let dataSql = `SELECT ${selectFields.join(", ")} FROM ${fromSql}${whereSql}${orderSql}`;
  const dataParams = [...params];

  if (paginationEnabled) {
    if (dialect === "postgresql") {
      dataParams.push(pageSize);
      dataParams.push((normalizedPageNum - 1) * pageSize);
      dataSql += ` LIMIT ${getPlaceholder(dialect, dataParams.length - 1)} OFFSET ${getPlaceholder(dialect, dataParams.length)}`;
    } else if (dialect === "oracle" || dialect === "dm") {
      const offset = (normalizedPageNum - 1) * pageSize;
      dataSql += ` OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
    } else {
      const offset = (normalizedPageNum - 1) * pageSize;
      dataSql += ` LIMIT ${offset}, ${pageSize}`;
    }
  }

  return {
    dialect,
    parameterMeta,
    dataSql,
    dataParams,
    countSql,
    countParams: params,
    meta: {
      pageNum: normalizedPageNum,
      pageSize,
      serviceType,
      serviceMode,
      paginationEnabled,
    },
  };
}

function sanitizeRequestParams(input) {
  const result = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (value === undefined) continue;
    const nextValue = Array.isArray(value)
      ? value.map((item) => String(item)).slice(0, 5)
      : String(value);
    result[key] = typeof nextValue === "string" && nextValue.length > 256
      ? `${nextValue.slice(0, 256)}...`
      : nextValue;
  }
  return result;
}

function normalizeIpList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isIpAllowed(clientIp, whitelist) {
  const rules = normalizeIpList(whitelist);
  if (rules.length === 0) {
    return true;
  }

  return rules.includes(clientIp);
}

module.exports = {
  MAX_PAGE_SIZE,
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
};
