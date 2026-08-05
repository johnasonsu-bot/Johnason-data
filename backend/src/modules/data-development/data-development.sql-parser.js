const { Parser } = require("node-sql-parser");
const AppError = require("../../common/errors/app-error");
const { normalizeDatasourceType } = require("./data-development.utils");

const parser = new Parser();

const DIALECT_MAP = {
  mysql: "MySQL",
  postgresql: "Postgresql",
  dm: "Postgresql",
  oracle: "MySQL",
  clickhouse: "MySQL",
  hive: "Hive",
};

function resolveParserDialect(type) {
  const normalized = normalizeDatasourceType(type);
  return DIALECT_MAP[normalized] || "MySQL";
}

function parseSql(sqlText, type) {
  const dialect = resolveParserDialect(type);
  try {
    return parser.astify(String(sqlText || ""), { database: dialect });
  } catch (error) {
    throw new AppError(`SQL 语法校验失败: ${error.message || "未知错误"}`, 400);
  }
}

function splitStatements(sqlText, type) {
  const ast = parseSql(sqlText, type);
  return (Array.isArray(ast) ? ast : [ast])
    .map((item) => parser.sqlify(item, { database: resolveParserDialect(type) }).trim())
    .filter(Boolean);
}

function extractTables(sqlText, type) {
  const dialect = resolveParserDialect(type);
  try {
    const tableList = parser.tableList(String(sqlText || ""), { database: dialect });
    return tableList.map((item) => {
      const [, schemaName, tableName] = String(item || "").split("::");
      return schemaName && schemaName !== "null" ? `${schemaName}.${tableName}` : tableName;
    });
  } catch {
    return [];
  }
}

function safeAstify(sqlText, type) {
  const dialect = resolveParserDialect(type);
  try {
    return parser.astify(String(sqlText || ""), { database: dialect });
  } catch {
    return null;
  }
}

function normalizeIdentifier(value) {
  if (value && typeof value === "object") {
    if (typeof value.value === "string") {
      return normalizeIdentifier(value.value);
    }
    if (typeof value.column === "string") {
      return normalizeIdentifier(value.column);
    }
    if (value.expr) {
      return normalizeIdentifier(value.expr.value || value.expr.column || value.expr);
    }
  }
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (
    (text.startsWith("`") && text.endsWith("`"))
    || (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith("[") && text.endsWith("]"))
  ) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function normalizeSourceColumnMap(sourceColumnsByTable) {
  const result = new Map();
  Object.entries(sourceColumnsByTable || {}).forEach(([key, columns]) => {
    const normalizedKey = normalizeIdentifier(key);
    if (!normalizedKey) {
      return;
    }
    result.set(
      normalizedKey,
      (Array.isArray(columns) ? columns : [])
        .map((item) => normalizeIdentifier(item))
        .filter(Boolean)
    );
  });
  return result;
}

function uniqueColumns(columns) {
  const output = [];
  const seen = new Set();
  (Array.isArray(columns) ? columns : []).forEach((item) => {
    const normalized = normalizeIdentifier(item);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      output.push(normalized);
    }
  });
  return output;
}

function inferExpressionOutputName(expr, index) {
  if (!expr || typeof expr !== "object") {
    return `expr_${index + 1}`;
  }

  if (expr.type === "column_ref" && expr.column && expr.column !== "*") {
    return normalizeIdentifier(expr.column);
  }

  if (expr.type === "aggr_func") {
    return normalizeIdentifier(String(expr.name || "").toLowerCase()) || `expr_${index + 1}`;
  }

  if (expr.type === "function") {
    const functionName = Array.isArray(expr.name?.name)
      ? expr.name.name.map((item) => normalizeIdentifier(item?.value)).filter(Boolean).join("_")
      : normalizeIdentifier(expr.name?.name || expr.name?.value || expr.name);
    return functionName || `expr_${index + 1}`;
  }

  if (expr.type === "case") {
    return `case_${index + 1}`;
  }

  if (expr.type === "number" || expr.type === "string" || expr.type === "single_quote_string") {
    return `expr_${index + 1}`;
  }

  return `expr_${index + 1}`;
}

function inferColumnsFromStatement(statement, context) {
  if (!statement || typeof statement !== "object") {
    return { columns: [], complete: false };
  }

  if (statement.ast) {
    return inferColumnsFromStatement(statement.ast, context);
  }

  if (Array.isArray(statement)) {
    const lastStatement = statement[statement.length - 1];
    return inferColumnsFromStatement(lastStatement, context);
  }

  if (statement.type !== "select") {
    return { columns: [], complete: false };
  }

  const sourceColumns = context?.sourceColumns || new Map();
  const cteCache = context?.cteCache || new Map();
  const localSourceColumns = new Map(sourceColumns);

  const withList = Array.isArray(statement.with) ? statement.with : [];
  withList.forEach((cte) => {
    const cteName = normalizeIdentifier(cte?.name?.value || cte?.name);
    if (!cteName) {
      return;
    }

    if (Array.isArray(cte.columns) && cte.columns.length) {
      const explicitColumns = uniqueColumns(cte.columns.map((item) => item?.column || item?.value || item));
      cteCache.set(cteName, explicitColumns);
      localSourceColumns.set(cteName, explicitColumns);
      return;
    }

    const cteResult = inferColumnsFromStatement(cte?.stmt?.ast || cte?.stmt, {
      sourceColumns: localSourceColumns,
      cteCache,
    });
    const cteColumns = uniqueColumns(cteResult.columns);
    cteCache.set(cteName, cteColumns);
    localSourceColumns.set(cteName, cteColumns);
  });

  const tableSchemaMap = new Map();
  (Array.isArray(statement.from) ? statement.from : []).forEach((item) => {
    const alias = normalizeIdentifier(item?.as);

    if (item?.expr?.ast) {
      const subqueryResult = inferColumnsFromStatement(item.expr.ast, {
        sourceColumns: localSourceColumns,
        cteCache,
      });
      const subqueryColumns = uniqueColumns(subqueryResult.columns);
      if (alias) {
        tableSchemaMap.set(alias, subqueryColumns);
      }
      return;
    }

    const tableName = normalizeIdentifier(item?.table);
    const resolvedColumns = uniqueColumns(
      tableSchemaMap.get(tableName)
      || localSourceColumns.get(tableName)
      || cteCache.get(tableName)
      || []
    );
    if (tableName) {
      tableSchemaMap.set(tableName, resolvedColumns);
    }
    if (alias) {
      tableSchemaMap.set(alias, resolvedColumns);
    }
  });

  const outputColumns = [];
  let complete = true;

  (Array.isArray(statement.columns) ? statement.columns : []).forEach((column, index) => {
    const alias = normalizeIdentifier(column?.as);
    if (alias) {
      outputColumns.push(alias);
      return;
    }

    const expr = column?.expr || {};
    if (expr.type === "column_ref" && expr.column === "*") {
      if (expr.table) {
        const scopedColumns = uniqueColumns(tableSchemaMap.get(normalizeIdentifier(expr.table)) || []);
        if (scopedColumns.length) {
          outputColumns.push(...scopedColumns);
        } else {
          complete = false;
        }
        return;
      }

      const mergedColumns = uniqueColumns(
        Array.from(tableSchemaMap.values()).flat()
      );
      if (mergedColumns.length) {
        outputColumns.push(...mergedColumns);
      } else {
        complete = false;
      }
      return;
    }

    const inferredName = inferExpressionOutputName(expr, index);
    if (inferredName) {
      outputColumns.push(inferredName);
      if (!["column_ref"].includes(expr.type || "")) {
        complete = false;
      }
    }
  });

  return {
    columns: uniqueColumns(outputColumns),
    complete,
  };
}

function inferSelectOutputColumns(sqlText, type, sourceColumnsByTable = {}) {
  const ast = safeAstify(sqlText, type);
  if (!ast) {
    return {
      columns: [],
      complete: false,
    };
  }

  return inferColumnsFromStatement(ast, {
    sourceColumns: normalizeSourceColumnMap(sourceColumnsByTable),
    cteCache: new Map(),
  });
}

module.exports = {
  parseSql,
  splitStatements,
  extractTables,
  inferSelectOutputColumns,
};
