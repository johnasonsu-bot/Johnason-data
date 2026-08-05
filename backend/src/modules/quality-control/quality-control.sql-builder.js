function normalizeDialect(value) {
  const dialect = String(value || "").trim().toLowerCase();
  return dialect === "gaussdb" ? "postgresql" : dialect;
}

function usesAnsiIdentifiers(dialect) {
  return ["postgresql", "oracle", "dm"].includes(normalizeDialect(dialect));
}

function usesConcatOperator(dialect) {
  return ["postgresql", "oracle", "dm"].includes(normalizeDialect(dialect));
}

function quoteIdentifier(identifier, dialect = "mysql") {
  const normalized = normalizeDialect(dialect);
  const quote = usesAnsiIdentifiers(normalized) ? '"' : "`";
  return String(identifier || "")
    .split(".")
    .filter(Boolean)
    .map((part) => `${quote}${String(part).replace(new RegExp(quote, "g"), quote.repeat(2))}${quote}`)
    .join(".");
}

function quoteValue(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function quoteJson(value) {
  return quoteValue(JSON.stringify(value ?? null));
}

function castAsText(expression, dialect) {
  const normalized = normalizeDialect(dialect);
  if (normalized === "postgresql") return `CAST(${expression} AS TEXT)`;
  if (normalized === "oracle") return `CAST(${expression} AS VARCHAR2(4000))`;
  if (normalized === "dm") return `CAST(${expression} AS VARCHAR(4000))`;
  return `CAST(${expression} AS CHAR)`;
}

function trimAsText(expression, dialect) {
  return ["postgresql", "oracle", "dm"].includes(normalizeDialect(dialect))
    ? `BTRIM(${castAsText(expression, dialect)})`
    : `TRIM(${castAsText(expression, dialect)})`;
}

function buildPrimaryKeyTextExpression(primaryKeyColumns, dialect) {
  if (!Array.isArray(primaryKeyColumns) || primaryKeyColumns.length === 0) {
    return "NULL";
  }

  const args = primaryKeyColumns.map((columnName) => {
    const qualified = quoteIdentifier(`t.${columnName}`, dialect);
    const textExpr = castAsText(qualified, dialect);
    if (usesConcatOperator(dialect)) {
      return `'${String(columnName)}=' || COALESCE(${textExpr}, 'NULL')`;
    }
    return `CONCAT(${quoteValue(`${columnName}=`)}, COALESCE(${textExpr}, 'NULL'))`;
  });

  return usesConcatOperator(dialect) ? args.join(" || '|' || ") : `CONCAT_WS('|', ${args.join(", ")})`;
}

function buildFieldValueExpression(columnName, dialect) {
  return castAsText(quoteIdentifier(`t.${columnName}`, dialect), dialect);
}

function buildFromClause(sourceSql, alias) {
  return `${String(sourceSql || "").trim()} ${alias}`.trim();
}

function buildNotBlankCondition(columnName, dialect) {
  const qualified = quoteIdentifier(`t.${columnName}`, dialect);
  return `${qualified} IS NOT NULL AND NULLIF(${trimAsText(qualified, dialect)}, '') IS NOT NULL`;
}

function buildBlankCondition(columnName, dialect) {
  const qualified = quoteIdentifier(`t.${columnName}`, dialect);
  return `${qualified} IS NULL OR NULLIF(${trimAsText(qualified, dialect)}, '') IS NULL`;
}

function buildBlankExpression(expression, dialect) {
  return `${expression} IS NULL OR NULLIF(${trimAsText(expression, dialect)}, '') IS NULL`;
}

function buildNotBlankExpression(expression, dialect) {
  return `${expression} IS NOT NULL AND NULLIF(${trimAsText(expression, dialect)}, '') IS NOT NULL`;
}

function buildRegexMismatchCondition(columnName, pattern, dialect) {
  const qualified = quoteIdentifier(`t.${columnName}`, dialect);
  const notBlank = buildNotBlankCondition(columnName, dialect);
  const normalized = normalizeDialect(dialect);
  const regexExpression = ["postgresql", "oracle", "dm"].includes(normalized) ? castAsText(qualified, dialect) : qualified;
  if (["oracle", "dm"].includes(normalized)) {
    return `(${notBlank} AND NOT REGEXP_LIKE(${regexExpression}, ${quoteValue(pattern)}))`;
  }
  const regexOperator = normalized === "postgresql" ? "!~" : "NOT REGEXP";
  return `(${notBlank} AND ${regexExpression} ${regexOperator} ${quoteValue(pattern)})`;
}

function buildAllowedValuesCondition(columnName, allowedValues, dialect) {
  const safeValues = Array.isArray(allowedValues)
    ? allowedValues.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (!safeValues.length) {
    return "";
  }

  const qualified = quoteIdentifier(`t.${columnName}`, dialect);
  const textExpr = trimAsText(qualified, dialect);
  return `(${buildNotBlankCondition(columnName, dialect)} AND ${textExpr} NOT IN (${safeValues.map((item) => quoteValue(item)).join(", ")}))`;
}

function buildRangeCondition(columnName, minValue, maxValue, dialect) {
  if (minValue === null || minValue === undefined) {
    if (maxValue === null || maxValue === undefined) {
      return "";
    }
  }

  const qualified = quoteIdentifier(`t.${columnName}`, dialect);
  const valueExpr = normalizeDialect(dialect) === "postgresql"
    ? `CAST(${qualified} AS NUMERIC)`
    : `CAST(${qualified} AS DECIMAL(18,6))`;

  const conditions = [];
  if (minValue !== null && minValue !== undefined && minValue !== "") {
    conditions.push(`${valueExpr} < ${quoteValue(Number(minValue))}`);
  }
  if (maxValue !== null && maxValue !== undefined && maxValue !== "") {
    conditions.push(`${valueExpr} > ${quoteValue(Number(maxValue))}`);
  }

  if (!conditions.length) {
    return "";
  }

  return `(${buildNotBlankCondition(columnName, dialect)} AND (${conditions.join(" OR ")}))`;
}

function buildDateRangeCondition(columnName, startDate, endDate, dialect) {
  const normalizedStartDate = String(startDate || "").trim();
  const normalizedEndDate = String(endDate || "").trim();
  if (!normalizedStartDate && !normalizedEndDate) {
    return "";
  }

  const qualified = quoteIdentifier(`t.${columnName}`, dialect);
  const valueExpr = ["postgresql", "oracle", "dm"].includes(normalizeDialect(dialect))
    ? `CAST(${qualified} AS DATE)`
    : `DATE(${qualified})`;

  const conditions = [];
  if (normalizedStartDate) {
    conditions.push(`${valueExpr} < ${quoteValue(normalizedStartDate)}`);
  }
  if (normalizedEndDate) {
    conditions.push(`${valueExpr} > ${quoteValue(normalizedEndDate)}`);
  }

  if (!conditions.length) {
    return "";
  }

  return `(${buildNotBlankCondition(columnName, dialect)} AND (${conditions.join(" OR ")}))`;
}

function buildEnsureTableStatements(dialect, detailTableName, statsTableName) {
  const normalized = normalizeDialect(dialect);
  const detailTable = quoteIdentifier(detailTableName, normalized);
  const statsTable = quoteIdentifier(statsTableName, normalized);

  if (normalized === "oracle") {
    const createIfMissing = (tableName, ddl) => `BEGIN
  EXECUTE IMMEDIATE ${quoteValue(ddl)};
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -955 THEN RAISE; END IF;
END;`;
    return [
      createIfMissing(detailTableName, `CREATE TABLE ${detailTable} (
  issue_id NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  batch_id VARCHAR2(64) NOT NULL,
  table_name VARCHAR2(255) NOT NULL,
  rule_category VARCHAR2(32) NOT NULL,
  rule_code VARCHAR2(128) NOT NULL,
  rule_name VARCHAR2(255) NOT NULL,
  field_name VARCHAR2(255) NOT NULL,
  rule_scope VARCHAR2(32) DEFAULT 'field' NOT NULL,
  pk_text CLOB NULL,
  field_value_text CLOB NULL,
  rule_config_json CLOB NULL,
  field_names_json CLOB NULL,
  composite_key_text CLOB NULL,
  issue_level VARCHAR2(16) NOT NULL,
  issue_message CLOB NULL,
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)`),
      createIfMissing(statsTableName, `CREATE TABLE ${statsTable} (
  stat_id NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  batch_id VARCHAR2(64) NOT NULL,
  table_name VARCHAR2(255) NOT NULL,
  rule_category VARCHAR2(32) NOT NULL,
  rule_code VARCHAR2(128) NOT NULL,
  field_name VARCHAR2(255) NOT NULL,
  rule_scope VARCHAR2(32) DEFAULT 'field' NOT NULL,
  rule_config_json CLOB NULL,
  field_names_json CLOB NULL,
  composite_key_text CLOB NULL,
  metric_value NUMBER(18,6) NULL,
  baseline_value NUMBER(18,6) NULL,
  threshold_value NUMBER(18,6) NULL,
  total_rows NUMBER(19) DEFAULT 0 NOT NULL,
  issue_rows NUMBER(19) DEFAULT 0 NOT NULL,
  issue_rate NUMBER(18,6) DEFAULT 0 NOT NULL,
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)`),
    ];
  }

  if (normalized === "dm") {
    return [
      `CREATE TABLE IF NOT EXISTS ${detailTable} (
  issue_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  rule_category VARCHAR(32) NOT NULL,
  rule_code VARCHAR(128) NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  field_name VARCHAR(255) NOT NULL,
  rule_scope VARCHAR(32) NOT NULL DEFAULT 'field',
  pk_text CLOB NULL,
  field_value_text CLOB NULL,
  rule_config_json CLOB NULL,
  field_names_json CLOB NULL,
  composite_key_text CLOB NULL,
  issue_level VARCHAR(16) NOT NULL,
  issue_message CLOB NULL,
  detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`,
      `CREATE TABLE IF NOT EXISTS ${statsTable} (
  stat_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  rule_category VARCHAR(32) NOT NULL,
  rule_code VARCHAR(128) NOT NULL,
  field_name VARCHAR(255) NOT NULL,
  rule_scope VARCHAR(32) NOT NULL DEFAULT 'field',
  rule_config_json CLOB NULL,
  field_names_json CLOB NULL,
  composite_key_text CLOB NULL,
  metric_value DECIMAL(18,6) NULL,
  baseline_value DECIMAL(18,6) NULL,
  threshold_value DECIMAL(18,6) NULL,
  total_rows BIGINT NOT NULL DEFAULT 0,
  issue_rows BIGINT NOT NULL DEFAULT 0,
  issue_rate DECIMAL(18,6) NOT NULL DEFAULT 0,
  detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`,
    ];
  }

  if (normalized === "postgresql") {
    return [
      `CREATE TABLE IF NOT EXISTS ${detailTable} (
  issue_id BIGSERIAL PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  rule_category VARCHAR(32) NOT NULL,
  rule_code VARCHAR(128) NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  field_name VARCHAR(255) NOT NULL,
  rule_scope VARCHAR(32) NOT NULL DEFAULT 'field',
  pk_text TEXT NULL,
  field_value_text TEXT NULL,
  rule_config_json JSON NULL,
  field_names_json JSON NULL,
  composite_key_text TEXT NULL,
  issue_level VARCHAR(16) NOT NULL,
  issue_message TEXT NULL,
  detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`,
      `CREATE INDEX IF NOT EXISTS idx_mq_issue_detail_batch ON ${detailTable} (batch_id);`,
      `CREATE INDEX IF NOT EXISTS idx_mq_issue_detail_table ON ${detailTable} (table_name);`,
      `CREATE INDEX IF NOT EXISTS idx_mq_issue_detail_detected ON ${detailTable} (detected_at);`,
      `CREATE TABLE IF NOT EXISTS ${statsTable} (
  stat_id BIGSERIAL PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  rule_category VARCHAR(32) NOT NULL,
  rule_code VARCHAR(128) NOT NULL,
  field_name VARCHAR(255) NOT NULL,
  rule_scope VARCHAR(32) NOT NULL DEFAULT 'field',
  rule_config_json JSON NULL,
  field_names_json JSON NULL,
  composite_key_text TEXT NULL,
  metric_value NUMERIC(18,6) NULL,
  baseline_value NUMERIC(18,6) NULL,
  threshold_value NUMERIC(18,6) NULL,
  total_rows BIGINT NOT NULL DEFAULT 0,
  issue_rows BIGINT NOT NULL DEFAULT 0,
  issue_rate NUMERIC(18,6) NOT NULL DEFAULT 0,
  detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`,
      `CREATE INDEX IF NOT EXISTS idx_mq_issue_stats_batch ON ${statsTable} (batch_id);`,
      `CREATE INDEX IF NOT EXISTS idx_mq_issue_stats_table ON ${statsTable} (table_name);`,
      `CREATE INDEX IF NOT EXISTS idx_mq_issue_stats_detected ON ${statsTable} (detected_at);`,
    ];
  }

  return [
    `CREATE TABLE IF NOT EXISTS ${detailTable} (
  issue_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id VARCHAR(64) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  rule_category VARCHAR(32) NOT NULL,
  rule_code VARCHAR(128) NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  field_name VARCHAR(255) NOT NULL,
  rule_scope VARCHAR(32) NOT NULL DEFAULT 'field',
  pk_text TEXT NULL,
  field_value_text TEXT NULL,
  rule_config_json JSON NULL,
  field_names_json JSON NULL,
  composite_key_text TEXT NULL,
  issue_level VARCHAR(16) NOT NULL,
  issue_message TEXT NULL,
  detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_mq_issue_detail_batch (batch_id),
  KEY idx_mq_issue_detail_table (table_name),
  KEY idx_mq_issue_detail_detected (detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质量问题明细';`,
    `CREATE TABLE IF NOT EXISTS ${statsTable} (
  stat_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id VARCHAR(64) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  rule_category VARCHAR(32) NOT NULL,
  rule_code VARCHAR(128) NOT NULL,
  field_name VARCHAR(255) NOT NULL,
  rule_scope VARCHAR(32) NOT NULL DEFAULT 'field',
  rule_config_json JSON NULL,
  field_names_json JSON NULL,
  composite_key_text TEXT NULL,
  metric_value DECIMAL(18,6) NULL,
  baseline_value DECIMAL(18,6) NULL,
  threshold_value DECIMAL(18,6) NULL,
  total_rows BIGINT NOT NULL DEFAULT 0,
  issue_rows BIGINT NOT NULL DEFAULT 0,
  issue_rate DECIMAL(18,6) NOT NULL DEFAULT 0,
  detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_mq_issue_stats_batch (batch_id),
  KEY idx_mq_issue_stats_table (table_name),
  KEY idx_mq_issue_stats_detected (detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质量问题统计';`,
  ];
}

function buildEnsureTablesSql(dialect, detailTableName, statsTableName) {
  return buildEnsureTableStatements(dialect, detailTableName, statsTableName).join("\n\n");
}

function buildStandardDetailInsert(options) {
  const {
    batchId,
    sourceTable,
    detailTable,
    fieldName,
    ruleCategory,
    ruleCode,
    ruleName,
    severity,
    issueMessage,
    conditionSql,
    primaryKeyColumns,
    dialect,
  } = options;
  const ruleScope = options.ruleScope || "field";
  const fieldNames = options.fieldNames || [fieldName].filter(Boolean);
  const ruleConfig = options.ruleConfig || null;
  const fieldValueExpression = options.fieldValueExpression || buildFieldValueExpression(fieldName, dialect);
  const compositeKeyExpression = options.compositeKeyExpression || "NULL";

  return `INSERT INTO ${detailTable}
  (batch_id, table_name, rule_category, rule_code, rule_name, field_name, rule_scope, pk_text, field_value_text, rule_config_json, field_names_json, composite_key_text, issue_level, issue_message, detected_at, created_at)
SELECT ${quoteValue(batchId)}, ${quoteValue(options.tableName)}, ${quoteValue(ruleCategory)}, ${quoteValue(ruleCode)}, ${quoteValue(ruleName)},
       ${quoteValue(fieldName)}, ${quoteValue(ruleScope)}, ${buildPrimaryKeyTextExpression(primaryKeyColumns, dialect)}, ${fieldValueExpression},
       ${quoteJson(ruleConfig)}, ${quoteJson(fieldNames)}, ${compositeKeyExpression},
       ${quoteValue(severity)}, ${quoteValue(issueMessage)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM ${buildFromClause(sourceTable, "t")}
WHERE ${conditionSql};`;
}

function buildStandardStatsInsert(options) {
  const {
    batchId,
    sourceTable,
    statsTable,
    fieldName,
    ruleCategory,
    ruleCode,
    conditionSql,
  } = options;
  const ruleScope = options.ruleScope || "field";
  const fieldNames = options.fieldNames || [fieldName].filter(Boolean);
  const ruleConfig = options.ruleConfig || null;

  return `INSERT INTO ${statsTable}
  (batch_id, table_name, rule_category, rule_code, field_name, rule_scope, rule_config_json, field_names_json, composite_key_text, total_rows, issue_rows, issue_rate, detected_at, created_at)
SELECT ${quoteValue(batchId)}, ${quoteValue(options.tableName)}, ${quoteValue(ruleCategory)}, ${quoteValue(ruleCode)}, ${quoteValue(fieldName)},
       ${quoteValue(ruleScope)}, ${quoteJson(ruleConfig)}, ${quoteJson(fieldNames)}, NULL,
       totals.total_rows, issues.issue_rows,
       CASE WHEN totals.total_rows = 0 THEN 0 ELSE ROUND((issues.issue_rows * 1.0) / totals.total_rows, 6) END,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT COUNT(*) AS total_rows FROM ${buildFromClause(sourceTable, "qc_total")}) totals
CROSS JOIN (SELECT COUNT(*) AS issue_rows FROM ${buildFromClause(sourceTable, "t")} WHERE ${conditionSql}) issues;`;
}

function buildDuplicateDetailInsert(options) {
  const { batchId, sourceTable, detailTable, fieldName, primaryKeyColumns, dialect } = options;
  const fieldIdentifier = quoteIdentifier(`t.${fieldName}`, dialect);
  const dedupFieldIdentifier = quoteIdentifier(`d.${fieldName}`, dialect);
  const innerFieldIdentifier = quoteIdentifier(fieldName, dialect);

  return `INSERT INTO ${detailTable}
  (batch_id, table_name, rule_category, rule_code, rule_name, field_name, rule_scope, pk_text, field_value_text, rule_config_json, field_names_json, composite_key_text, issue_level, issue_message, detected_at, created_at)
SELECT ${quoteValue(batchId)}, ${quoteValue(options.tableName)}, 'duplicate', ${quoteValue(`duplicate_${fieldName}`)}, ${quoteValue(`重复值检查-${fieldName}`)},
       ${quoteValue(fieldName)}, 'field', ${buildPrimaryKeyTextExpression(primaryKeyColumns, dialect)}, ${buildFieldValueExpression(fieldName, dialect)},
       NULL, ${quoteJson([fieldName])}, ${buildFieldValueExpression(fieldName, dialect)},
       'medium', ${quoteValue(`字段 ${fieldName} 存在重复值`)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM ${buildFromClause(sourceTable, "t")}
JOIN (
  SELECT ${innerFieldIdentifier}
  FROM ${buildFromClause(sourceTable, "qc_dup")}
  WHERE ${innerFieldIdentifier} IS NOT NULL
  GROUP BY ${innerFieldIdentifier}
  HAVING COUNT(*) > 1
) d ON ${fieldIdentifier} = ${dedupFieldIdentifier};`;
}

function buildDuplicateStatsInsert(options) {
  const { batchId, sourceTable, statsTable, fieldName, dialect } = options;
  const fieldIdentifier = quoteIdentifier(`t.${fieldName}`, dialect);
  const innerField = quoteIdentifier(fieldName, dialect);
  const joinedFieldIdentifier = quoteIdentifier(`d.${fieldName}`, dialect);

  return `INSERT INTO ${statsTable}
  (batch_id, table_name, rule_category, rule_code, field_name, rule_scope, rule_config_json, field_names_json, composite_key_text, total_rows, issue_rows, issue_rate, detected_at, created_at)
SELECT ${quoteValue(batchId)}, ${quoteValue(options.tableName)}, 'duplicate', ${quoteValue(`duplicate_${fieldName}`)}, ${quoteValue(fieldName)},
       'field', NULL, ${quoteJson([fieldName])}, NULL,
       totals.total_rows, issues.issue_rows,
       CASE WHEN totals.total_rows = 0 THEN 0 ELSE ROUND((issues.issue_rows * 1.0) / totals.total_rows, 6) END,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT COUNT(*) AS total_rows FROM ${buildFromClause(sourceTable, "qc_total")}) totals
CROSS JOIN (
  SELECT COUNT(*) AS issue_rows
  FROM ${buildFromClause(sourceTable, "t")}
  JOIN (
    SELECT ${innerField}
    FROM ${buildFromClause(sourceTable, "qc_dup")}
    WHERE ${innerField} IS NOT NULL
    GROUP BY ${innerField}
    HAVING COUNT(*) > 1
  ) d ON ${fieldIdentifier} = ${joinedFieldIdentifier}
) issues;`;
}

function normalizeRuleId(value, fallback) {
  const normalized = String(value || fallback || "advanced_rule")
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "advanced_rule";
}

function normalizeFieldList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)));
}

function concatTextExpressions(expressions, dialect) {
  const normalized = normalizeDialect(dialect);
  if (!Array.isArray(expressions) || expressions.length === 0) {
    return "NULL";
  }
  if (["postgresql", "oracle", "dm"].includes(normalized)) {
    return expressions.join(" || '|' || ");
  }
  return `CONCAT_WS('|', ${expressions.join(", ")})`;
}

function buildCompositeKeyExpression(fieldNames, alias, dialect) {
  const expressions = normalizeFieldList(fieldNames).map((fieldName) => {
    const qualified = quoteIdentifier(`${alias}.${fieldName}`, dialect);
    const valueExpr = castAsText(qualified, dialect);
    if (usesConcatOperator(dialect)) {
      return `${quoteValue(`${fieldName}=`)} || COALESCE(${valueExpr}, 'NULL')`;
    }
    return `CONCAT(${quoteValue(`${fieldName}=`)}, COALESCE(${valueExpr}, 'NULL'))`;
  });
  return concatTextExpressions(expressions, dialect);
}

function buildConditionExpression(config = {}, dialect) {
  const fieldName = String(config.conditionField || "").trim();
  if (!fieldName) return "";
  const qualified = quoteIdentifier(`t.${fieldName}`, dialect);
  const operator = String(config.conditionOperator || "=").toLowerCase();
  if (operator === "is_null") return buildBlankExpression(qualified, dialect);
  if (operator === "is_not_null") return buildNotBlankExpression(qualified, dialect);

  const values = Array.isArray(config.conditionValues)
    ? config.conditionValues
    : (config.conditionValue === undefined ? [] : [config.conditionValue]);
  if (!values.length) return "";
  const textExpr = trimAsText(qualified, dialect);
  if (operator === "in" || operator === "not_in") {
    const safeValues = values.map((item) => String(item ?? "").trim()).filter(Boolean);
    if (!safeValues.length) return "";
    return `${textExpr} ${operator === "not_in" ? "NOT IN" : "IN"} (${safeValues.map(quoteValue).join(", ")})`;
  }
  if (operator === "!=") {
    return `${textExpr} <> ${quoteValue(values[0])}`;
  }
  return `${textExpr} = ${quoteValue(values[0])}`;
}

function buildComparableExpression(fieldName, valueType, dialect) {
  const qualified = quoteIdentifier(`t.${fieldName}`, dialect);
  const normalizedType = String(valueType || "text").toLowerCase();
  if (normalizedType === "number") {
    const valueAsText = trimAsText(qualified, dialect);
    const numericPattern = "^[+-]?([0-9]+(\\.[0-9]+)?|\\.[0-9]+)$";
    const normalized = normalizeDialect(dialect);
    if (normalized === "postgresql") {
      return `(CASE WHEN ${valueAsText} ~ ${quoteValue(numericPattern)} THEN CAST(${valueAsText} AS NUMERIC) ELSE NULL END)`;
    }
    if (["oracle", "dm"].includes(normalized)) {
      return `(CASE WHEN REGEXP_LIKE(${valueAsText}, ${quoteValue(numericPattern)}) THEN CAST(${valueAsText} AS DECIMAL(18,6)) ELSE NULL END)`;
    }
    return `(CASE WHEN ${valueAsText} REGEXP ${quoteValue(numericPattern)} THEN CAST(${valueAsText} AS DECIMAL(18,6)) ELSE NULL END)`;
  }
  if (normalizedType === "date") {
    const timestampExpression = buildSafeTimestampExpression(qualified, dialect);
    return ["postgresql", "oracle", "dm"].includes(normalizeDialect(dialect))
      ? `CAST(${timestampExpression} AS DATE)`
      : `DATE(${timestampExpression})`;
  }
  if (normalizedType === "datetime") {
    return buildSafeTimestampExpression(qualified, dialect);
  }
  return trimAsText(qualified, dialect);
}

function buildNullSafeEquality(leftExpression, rightExpression, dialect) {
  const normalized = normalizeDialect(dialect);
  if (normalized === "postgresql") return `${leftExpression} IS NOT DISTINCT FROM ${rightExpression}`;
  if (["oracle", "dm"].includes(normalized)) {
    return `((${leftExpression} = ${rightExpression}) OR (${leftExpression} IS NULL AND ${rightExpression} IS NULL))`;
  }
  return `${leftExpression} <=> ${rightExpression}`;
}

function buildNullSafeMismatch(leftExpression, rightExpression, dialect) {
  return `NOT (${buildNullSafeEquality(leftExpression, rightExpression, dialect)})`;
}

function buildSafeTimestampExpression(expression, dialect) {
  const valueAsText = trimAsText(expression, dialect);
  const datePattern = "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$";
  const datetimePattern = "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])([ T]([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\\.[0-9]{1,6})?)?([+-][0-9]{2}:?[0-9]{2}|Z)?)?$";

  const normalized = normalizeDialect(dialect);
  if (normalized === "postgresql") {
    return `(CASE
      WHEN ${valueAsText} ~ ${quoteValue(datePattern)} OR ${valueAsText} ~ ${quoteValue(datetimePattern)}
      THEN CAST(${valueAsText} AS TIMESTAMP WITH TIME ZONE)
      ELSE NULL
    END)`;
  }

  if (["oracle", "dm"].includes(normalized)) {
    return `(CASE
      WHEN REGEXP_LIKE(${valueAsText}, ${quoteValue(datePattern)}) OR REGEXP_LIKE(${valueAsText}, ${quoteValue(datetimePattern)})
      THEN CAST(REPLACE(REPLACE(${valueAsText}, 'T', ' '), 'Z', '') AS TIMESTAMP)
      ELSE NULL
    END)`;
  }

  const normalizedDateTime = `REPLACE(${valueAsText}, 'T', ' ')`;
  return `(CASE
    WHEN ${valueAsText} REGEXP ${quoteValue(datePattern)} THEN STR_TO_DATE(${valueAsText}, '%Y-%m-%d')
    WHEN ${valueAsText} REGEXP ${quoteValue(datetimePattern)} THEN STR_TO_DATE(${normalizedDateTime}, '%Y-%m-%d %H:%i:%s')
    ELSE NULL
  END)`;
}

function buildFreshnessCondition(timeField, maxDelayValue, maxDelayUnit, dialect) {
  const qualified = quoteIdentifier(`t.${timeField}`, dialect);
  const timeExpression = buildSafeTimestampExpression(qualified, dialect);
  const delayValue = Math.max(1, Number(maxDelayValue || 1));
  const unit = String(maxDelayUnit || "day").toLowerCase();
  const mysqlUnitMap = { minute: "MINUTE", hour: "HOUR", day: "DAY", month: "MONTH" };
  const normalized = normalizeDialect(dialect);
  if (normalized === "postgresql") {
    const pgUnitMap = { minute: "minute", hour: "hour", day: "day", month: "month" };
    return `((${buildBlankExpression(qualified, dialect)}) OR ${timeExpression} IS NULL OR ${timeExpression} < (CURRENT_TIMESTAMP - INTERVAL ${quoteValue(`${delayValue} ${pgUnitMap[unit] || "day"}`)}))`;
  }
  if (normalized === "oracle") {
    const oracleUnit = { minute: "MINUTE", hour: "HOUR", day: "DAY" }[unit] || "DAY";
    const cutoff = unit === "month"
      ? `ADD_MONTHS(CURRENT_TIMESTAMP, -${delayValue})`
      : `CURRENT_TIMESTAMP - NUMTODSINTERVAL(${delayValue}, '${oracleUnit}')`;
    return `((${buildBlankExpression(qualified, dialect)}) OR ${timeExpression} IS NULL OR ${timeExpression} < (${cutoff}))`;
  }
  if (normalized === "dm") {
    const dmUnit = { minute: "MINUTE", hour: "HOUR", day: "DAY", month: "MONTH" }[unit] || "DAY";
    return `((${buildBlankExpression(qualified, dialect)}) OR ${timeExpression} IS NULL OR ${timeExpression} < DATEADD(${dmUnit}, -${delayValue}, CURRENT_TIMESTAMP))`;
  }
  return `((${buildBlankExpression(qualified, dialect)}) OR ${timeExpression} IS NULL OR ${timeExpression} < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${delayValue} ${mysqlUnitMap[unit] || "DAY"}))`;
}

function buildFreshnessMetricSql(sourceTable, timeField, maxDelayUnit, dialect) {
  const unit = String(maxDelayUnit || "day").toLowerCase();
  const supportedUnit = ["minute", "hour", "day", "month"].includes(unit) ? unit : "day";
  const timeFieldExpr = quoteIdentifier(`qc_metric.${timeField}`, dialect);
  const timeExpression = buildSafeTimestampExpression(timeFieldExpr, dialect);
  const validWhere = buildNotBlankCondition(timeField, dialect).replaceAll(
    quoteIdentifier(`t.${timeField}`, dialect),
    timeFieldExpr
  );
  const validTimeWhere = `${validWhere} AND ${timeExpression} IS NOT NULL`;

  const normalized = normalizeDialect(dialect);
  if (normalized === "postgresql") {
    const unitDivisorMap = {
      minute: "60.0",
      hour: "3600.0",
      day: "86400.0",
      month: "2592000.0",
    };
    const divisor = unitDivisorMap[supportedUnit] || unitDivisorMap.day;
    return `(SELECT CASE
      WHEN MAX(${timeExpression}) IS NULL THEN NULL
      ELSE ROUND((EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MAX(${timeExpression}))) / ${divisor})::numeric, 6)
    END
    FROM ${buildFromClause(sourceTable, "qc_metric")}
    WHERE ${validTimeWhere})`;
  }

  if (normalized === "oracle") {
    const multiplier = { minute: 1440, hour: 24, day: 1, month: 1 / 30 }[supportedUnit] || 1;
    return `(SELECT CASE
      WHEN MAX(${timeExpression}) IS NULL THEN NULL
      ELSE ROUND((CAST(CURRENT_TIMESTAMP AS DATE) - CAST(MAX(${timeExpression}) AS DATE)) * ${multiplier}, 6)
    END
    FROM ${buildFromClause(sourceTable, "qc_metric")}
    WHERE ${validTimeWhere})`;
  }
  if (normalized === "dm") {
    const dmUnit = { minute: "MINUTE", hour: "HOUR", day: "DAY", month: "MONTH" }[supportedUnit] || "DAY";
    return `(SELECT CASE
      WHEN MAX(${timeExpression}) IS NULL THEN NULL
      ELSE CAST(DATEDIFF(${dmUnit}, MAX(${timeExpression}), CURRENT_TIMESTAMP) AS DECIMAL(18,6))
    END
    FROM ${buildFromClause(sourceTable, "qc_metric")}
    WHERE ${validTimeWhere})`;
  }

  const mysqlUnitMap = {
    minute: "MINUTE",
    hour: "HOUR",
    day: "DAY",
    month: "MONTH",
  };
  return `(SELECT CASE
      WHEN MAX(${timeExpression}) IS NULL THEN NULL
      ELSE CAST(TIMESTAMPDIFF(${mysqlUnitMap[supportedUnit] || "DAY"}, MAX(${timeExpression}), CURRENT_TIMESTAMP) AS DECIMAL(18,6))
    END
    FROM ${buildFromClause(sourceTable, "qc_metric")}
    WHERE ${validTimeWhere})`;
}

function buildRegexMismatchExpression(expression, pattern, dialect) {
  const normalized = normalizeDialect(dialect);
  const regexExpression = ["postgresql", "oracle", "dm"].includes(normalized) ? castAsText(expression, dialect) : expression;
  if (["oracle", "dm"].includes(normalized)) {
    return `(${buildNotBlankExpression(expression, dialect)} AND NOT REGEXP_LIKE(${regexExpression}, ${quoteValue(pattern)}))`;
  }
  const regexOperator = normalized === "postgresql" ? "!~" : "NOT REGEXP";
  return `(${buildNotBlankExpression(expression, dialect)} AND ${regexExpression} ${regexOperator} ${quoteValue(pattern)})`;
}

function buildMetricDisplayExpression(currentExpression, baselineExpression, thresholdExpression, dialect) {
  const expressions = [
    usesConcatOperator(dialect)
      ? `'current=' || COALESCE(${castAsText(currentExpression, dialect)}, 'NULL')`
      : `CONCAT('current=', COALESCE(${castAsText(currentExpression, dialect)}, 'NULL'))`,
    usesConcatOperator(dialect)
      ? `'baseline=' || COALESCE(${castAsText(baselineExpression, dialect)}, 'NULL')`
      : `CONCAT('baseline=', COALESCE(${castAsText(baselineExpression, dialect)}, 'NULL'))`,
    usesConcatOperator(dialect)
      ? `'threshold=' || COALESCE(${castAsText(thresholdExpression, dialect)}, 'NULL')`
      : `CONCAT('threshold=', COALESCE(${castAsText(thresholdExpression, dialect)}, 'NULL'))`,
  ];
  return concatTextExpressions(expressions, dialect);
}

function appendRowLimit(sql, limit, dialect) {
  const safeLimit = Math.max(1, Number(limit || 1));
  const normalized = normalizeDialect(dialect);
  if (["oracle", "dm"].includes(normalized)) {
    return `${sql}\n  FETCH FIRST ${safeLimit} ROWS ONLY`;
  }
  return `${sql}\n  LIMIT ${safeLimit}`;
}

function buildHistoryMetricExpression(options = {}) {
  const {
    statsTable,
    tableName,
    rule,
    fieldName,
    metricColumn = "metric_value",
    baselineMode = "recent_avg",
    lookbackBatches = 7,
    dialect,
  } = options;
  const historyLimit = Math.max(1, Number(lookbackBatches || 7));
  const filters = [
    `table_name = ${quoteValue(tableName)}`,
    `rule_category = ${quoteValue(rule.ruleCategory)}`,
    `rule_code = ${quoteValue(rule.ruleId)}`,
    `field_name = ${quoteValue(fieldName)}`,
    `${metricColumn} IS NOT NULL`,
  ].join(" AND ");
  const baseQuery = appendRowLimit(`SELECT ${metricColumn} AS metric_value
  FROM ${statsTable}
  WHERE ${filters}
  ORDER BY detected_at DESC`, baselineMode === "last_batch" ? 1 : historyLimit, dialect);
  if (baselineMode === "last_batch") {
    const selectLatest = appendRowLimit(`SELECT hist.metric_value FROM (${baseQuery}) hist`, 1, dialect);
    return `(${selectLatest})`;
  }
  return `(SELECT AVG(hist.metric_value * 1.0) FROM (${baseQuery}) hist)`;
}

function buildHistoryMetricCountExpression(options = {}) {
  const {
    statsTable,
    tableName,
    rule,
    fieldName,
    metricColumn = "metric_value",
    baselineMode = "recent_avg",
    lookbackBatches = 7,
    dialect,
  } = options;
  const historyLimit = Math.max(1, Number(lookbackBatches || 7));
  const filters = [
    `table_name = ${quoteValue(tableName)}`,
    `rule_category = ${quoteValue(rule.ruleCategory)}`,
    `rule_code = ${quoteValue(rule.ruleId)}`,
    `field_name = ${quoteValue(fieldName)}`,
    `${metricColumn} IS NOT NULL`,
  ].join(" AND ");
  const baseQuery = appendRowLimit(`SELECT 1
  FROM ${statsTable}
  WHERE ${filters}
  ORDER BY detected_at DESC`, baselineMode === "last_batch" ? 1 : historyLimit, dialect);
  return `(SELECT COUNT(*) FROM (${baseQuery}) hist)`;
}

function buildMetricChangeCondition(currentExpression, baselineExpression, thresholdRatio, direction) {
  const normalizedDirection = String(direction || "both").toLowerCase();
  const threshold = Number(thresholdRatio || 0);
  const increaseCondition = `((${baselineExpression} = 0 AND ${currentExpression} > 0) OR (${baselineExpression} <> 0 AND ((${currentExpression} - ${baselineExpression}) / ABS(${baselineExpression})) >= ${threshold}))`;
  const decreaseCondition = `(${baselineExpression} <> 0 AND ((${baselineExpression} - ${currentExpression}) / ABS(${baselineExpression})) >= ${threshold})`;
  if (normalizedDirection === "increase") {
    return `${baselineExpression} IS NOT NULL AND ${increaseCondition}`;
  }
  if (normalizedDirection === "decrease") {
    return `${baselineExpression} IS NOT NULL AND ${decreaseCondition}`;
  }
  return `${baselineExpression} IS NOT NULL AND (${increaseCondition} OR ${decreaseCondition})`;
}

function buildBaselineActivationCondition(options = {}) {
  const historyCountExpression = options.historyCountExpression;
  const minHistoryBatches = Math.max(1, Number(options.minHistoryBatches || 1));
  const dynamicCondition = options.dynamicCondition || "1 = 0";
  if (options.warmupPolicy === "upper_threshold" && options.warmupThreshold !== null && options.warmupThreshold !== "" && Number.isFinite(Number(options.warmupThreshold))) {
    return `((${historyCountExpression} < ${minHistoryBatches} AND ${options.currentExpression} >= ${Number(options.warmupThreshold)}) OR (${historyCountExpression} >= ${minHistoryBatches} AND ${dynamicCondition}))`;
  }
  return `(${historyCountExpression} >= ${minHistoryBatches} AND ${dynamicCondition})`;
}

function buildAggregateMetricDetailInsert(options) {
  const {
    batchId,
    detailTable,
    rule,
    tableName,
    fieldName,
    fieldNames,
    currentMetricSql,
    totalRowsSql,
    issueRowsSql,
    baselineMetricSql,
    thresholdValue,
    conditionSql,
    dialect,
  } = options;

  return `INSERT INTO ${detailTable}
  (batch_id, table_name, rule_category, rule_code, rule_name, field_name, rule_scope, pk_text, field_value_text, rule_config_json, field_names_json, composite_key_text, issue_level, issue_message, detected_at, created_at)
SELECT ${quoteValue(batchId)}, ${quoteValue(tableName)}, ${quoteValue(rule.ruleCategory)}, ${quoteValue(rule.ruleId)}, ${quoteValue(rule.ruleName)},
       ${quoteValue(fieldName)}, ${quoteValue(rule.ruleScope || "aggregate")}, NULL,
       ${buildMetricDisplayExpression("curr.metric_value", "base.baseline_value", quoteValue(thresholdValue), dialect)},
       ${quoteJson(rule.config || {})}, ${quoteJson(fieldNames || [fieldName].filter(Boolean))}, NULL,
       ${quoteValue(rule.severity || "medium")}, ${quoteValue(rule.description || rule.ruleName)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT ${totalRowsSql} AS total_rows, ${issueRowsSql} AS issue_rows, ${currentMetricSql} AS metric_value
) curr
CROSS JOIN (
  SELECT ${baselineMetricSql} AS baseline_value
) base
WHERE ${conditionSql};`;
}

function buildAggregateMetricStatsInsert(options) {
  const {
    batchId,
    statsTable,
    rule,
    tableName,
    fieldName,
    fieldNames,
    currentMetricSql,
    totalRowsSql,
    issueRowsSql,
    baselineMetricSql,
    thresholdValue,
    conditionSql,
  } = options;
  const issueRowsExpression = options.issueRowsExpression || "curr.issue_rows";

  return `INSERT INTO ${statsTable}
  (batch_id, table_name, rule_category, rule_code, field_name, rule_scope, rule_config_json, field_names_json, composite_key_text, metric_value, baseline_value, threshold_value, total_rows, issue_rows, issue_rate, detected_at, created_at)
SELECT ${quoteValue(batchId)}, ${quoteValue(tableName)}, ${quoteValue(rule.ruleCategory)}, ${quoteValue(rule.ruleId)}, ${quoteValue(fieldName)},
       ${quoteValue(rule.ruleScope || "aggregate")}, ${quoteJson(rule.config || {})}, ${quoteJson(fieldNames || [fieldName].filter(Boolean))}, NULL,
       curr.metric_value, base.baseline_value, ${quoteValue(thresholdValue)},
       curr.total_rows,
       CASE WHEN ${conditionSql} THEN ${issueRowsExpression} ELSE 0 END,
       CASE WHEN ${conditionSql} AND curr.total_rows <> 0 THEN ROUND((${issueRowsExpression} * 1.0) / curr.total_rows, 6) ELSE 0 END,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT ${totalRowsSql} AS total_rows, ${issueRowsSql} AS issue_rows, ${currentMetricSql} AS metric_value
) curr
CROSS JOIN (
  SELECT ${baselineMetricSql} AS baseline_value
) base;`;
}

function buildCrossTableJoinConfig(config = {}) {
  const refTable = String(config.refTable || config.referenceTable || "").trim();
  const localFields = normalizeFieldList(config.localFields || config.sourceFields || [config.localField]);
  const refFields = normalizeFieldList(config.refFields || config.referenceFields || [config.refField]);
  const fieldPairs = localFields
    .map((localField, index) => ({ localField, refField: refFields[index] }))
    .filter((item) => item.localField && item.refField);
  return { refTable, fieldPairs };
}

function buildCrossTableLookupDetailInsert(options) {
  const { batchId, sourceTable, detailTable, rule, primaryKeyColumns, dialect } = options;
  const { refTable, fieldPairs } = buildCrossTableJoinConfig(rule.config || {});
  if (!refTable || fieldPairs.length === 0) return "";
  const refTableSql = quoteIdentifier(refTable, dialect);
  const localFields = fieldPairs.map((item) => item.localField);
  const fieldNameText = localFields.join(",");
  const joinConditions = fieldPairs.map((item) =>
    buildNullSafeEquality(quoteIdentifier(`t.${item.localField}`, dialect), quoteIdentifier(`r.${item.refField}`, dialect), dialect)
  );
  const localNotBlank = fieldPairs.map((item) => buildNotBlankExpression(quoteIdentifier(`t.${item.localField}`, dialect), dialect));
  const missingCondition = `${quoteIdentifier(`r.${fieldPairs[0].refField}`, dialect)} IS NULL`;
  const compositeKeyExpression = buildCompositeKeyExpression(localFields, "t", dialect);

  return `INSERT INTO ${detailTable}
  (batch_id, table_name, rule_category, rule_code, rule_name, field_name, rule_scope, pk_text, field_value_text, rule_config_json, field_names_json, composite_key_text, issue_level, issue_message, detected_at, created_at)
SELECT ${quoteValue(batchId)}, ${quoteValue(options.tableName)}, ${quoteValue(rule.ruleCategory)}, ${quoteValue(rule.ruleId)}, ${quoteValue(rule.ruleName)},
       ${quoteValue(fieldNameText)}, 'cross_table', ${buildPrimaryKeyTextExpression(primaryKeyColumns, dialect)}, ${compositeKeyExpression},
       ${quoteJson(rule.config || {})}, ${quoteJson(localFields)}, ${compositeKeyExpression},
       ${quoteValue(rule.severity || "high")}, ${quoteValue(rule.description || `跨表引用 ${refTable} 不存在匹配记录`)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM ${buildFromClause(sourceTable, "t")}
LEFT JOIN ${refTableSql} r ON ${joinConditions.join(" AND ")}
WHERE ${localNotBlank.join(" AND ")} AND ${missingCondition};`;
}

function buildCrossTableLookupStatsInsert(options) {
  const { batchId, sourceTable, statsTable, rule, dialect } = options;
  const { refTable, fieldPairs } = buildCrossTableJoinConfig(rule.config || {});
  if (!refTable || fieldPairs.length === 0) return "";
  const refTableSql = quoteIdentifier(refTable, dialect);
  const localFields = fieldPairs.map((item) => item.localField);
  const fieldNameText = localFields.join(",");
  const joinConditions = fieldPairs.map((item) =>
    buildNullSafeEquality(quoteIdentifier(`t.${item.localField}`, dialect), quoteIdentifier(`r.${item.refField}`, dialect), dialect)
  );
  const localNotBlank = fieldPairs.map((item) => buildNotBlankExpression(quoteIdentifier(`t.${item.localField}`, dialect), dialect));
  const missingCondition = `${quoteIdentifier(`r.${fieldPairs[0].refField}`, dialect)} IS NULL`;

  return `INSERT INTO ${statsTable}
  (batch_id, table_name, rule_category, rule_code, field_name, rule_scope, rule_config_json, field_names_json, composite_key_text, total_rows, issue_rows, issue_rate, detected_at, created_at)
SELECT ${quoteValue(batchId)}, ${quoteValue(options.tableName)}, ${quoteValue(rule.ruleCategory)}, ${quoteValue(rule.ruleId)}, ${quoteValue(fieldNameText)},
       'cross_table', ${quoteJson(rule.config || {})}, ${quoteJson(localFields)}, NULL,
       totals.total_rows, issues.issue_rows,
       CASE WHEN totals.total_rows = 0 THEN 0 ELSE ROUND((issues.issue_rows * 1.0) / totals.total_rows, 6) END,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT COUNT(*) AS total_rows FROM ${buildFromClause(sourceTable, "qc_total")}) totals
CROSS JOIN (
  SELECT COUNT(*) AS issue_rows
  FROM ${buildFromClause(sourceTable, "t")}
  LEFT JOIN ${refTableSql} r ON ${joinConditions.join(" AND ")}
  WHERE ${localNotBlank.join(" AND ")} AND ${missingCondition}
) issues;`;
}

function buildCrossTableConsistencyDetailInsert(options) {
  const { batchId, sourceTable, detailTable, rule, primaryKeyColumns, dialect } = options;
  const { refTable, fieldPairs } = buildCrossTableJoinConfig(rule.config || {});
  const comparePairs = Array.isArray(rule.config?.comparePairs)
    ? rule.config.comparePairs
      .map((item) => ({
        localField: String(item?.localField || "").trim(),
        refField: String(item?.refField || "").trim(),
      }))
      .filter((item) => item.localField && item.refField)
    : [];
  if (!refTable || fieldPairs.length === 0 || comparePairs.length === 0) return "";
  const refTableSql = quoteIdentifier(refTable, dialect);
  const localKeyFields = fieldPairs.map((item) => item.localField);
  const compareFields = comparePairs.map((item) => item.localField);
  const fieldNameText = compareFields.join(",");
  const joinConditions = fieldPairs.map((item) =>
    buildNullSafeEquality(quoteIdentifier(`t.${item.localField}`, dialect), quoteIdentifier(`r.${item.refField}`, dialect), dialect)
  );
  const mismatchConditions = comparePairs.map((item) =>
    buildNullSafeMismatch(quoteIdentifier(`t.${item.localField}`, dialect), quoteIdentifier(`r.${item.refField}`, dialect), dialect)
  );
  const compositeKeyExpression = buildCompositeKeyExpression(localKeyFields, "t", dialect);

  return `INSERT INTO ${detailTable}
  (batch_id, table_name, rule_category, rule_code, rule_name, field_name, rule_scope, pk_text, field_value_text, rule_config_json, field_names_json, composite_key_text, issue_level, issue_message, detected_at, created_at)
SELECT ${quoteValue(batchId)}, ${quoteValue(options.tableName)}, ${quoteValue(rule.ruleCategory)}, ${quoteValue(rule.ruleId)}, ${quoteValue(rule.ruleName)},
       ${quoteValue(fieldNameText)}, 'cross_table', ${buildPrimaryKeyTextExpression(primaryKeyColumns, dialect)}, ${buildCompositeKeyExpression(compareFields, "t", dialect)},
       ${quoteJson(rule.config || {})}, ${quoteJson(compareFields)}, ${compositeKeyExpression},
       ${quoteValue(rule.severity || "high")}, ${quoteValue(rule.description || `跨表 ${refTable} 字段值不一致`)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM ${buildFromClause(sourceTable, "t")}
JOIN ${refTableSql} r ON ${joinConditions.join(" AND ")}
WHERE ${mismatchConditions.join(" OR ")};`;
}

function buildCrossTableConsistencyStatsInsert(options) {
  const { batchId, sourceTable, statsTable, rule, dialect } = options;
  const { refTable, fieldPairs } = buildCrossTableJoinConfig(rule.config || {});
  const comparePairs = Array.isArray(rule.config?.comparePairs)
    ? rule.config.comparePairs
      .map((item) => ({
        localField: String(item?.localField || "").trim(),
        refField: String(item?.refField || "").trim(),
      }))
      .filter((item) => item.localField && item.refField)
    : [];
  if (!refTable || fieldPairs.length === 0 || comparePairs.length === 0) return "";
  const refTableSql = quoteIdentifier(refTable, dialect);
  const compareFields = comparePairs.map((item) => item.localField);
  const fieldNameText = compareFields.join(",");
  const joinConditions = fieldPairs.map((item) =>
    buildNullSafeEquality(quoteIdentifier(`t.${item.localField}`, dialect), quoteIdentifier(`r.${item.refField}`, dialect), dialect)
  );
  const mismatchConditions = comparePairs.map((item) =>
    buildNullSafeMismatch(quoteIdentifier(`t.${item.localField}`, dialect), quoteIdentifier(`r.${item.refField}`, dialect), dialect)
  );

  return `INSERT INTO ${statsTable}
  (batch_id, table_name, rule_category, rule_code, field_name, rule_scope, rule_config_json, field_names_json, composite_key_text, total_rows, issue_rows, issue_rate, detected_at, created_at)
SELECT ${quoteValue(batchId)}, ${quoteValue(options.tableName)}, ${quoteValue(rule.ruleCategory)}, ${quoteValue(rule.ruleId)}, ${quoteValue(fieldNameText)},
       'cross_table', ${quoteJson(rule.config || {})}, ${quoteJson(compareFields)}, NULL,
       totals.total_rows, issues.issue_rows,
       CASE WHEN totals.total_rows = 0 THEN 0 ELSE ROUND((issues.issue_rows * 1.0) / totals.total_rows, 6) END,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT COUNT(*) AS total_rows FROM ${buildFromClause(sourceTable, "qc_total")}) totals
CROSS JOIN (
  SELECT COUNT(*) AS issue_rows
  FROM ${buildFromClause(sourceTable, "t")}
  JOIN ${refTableSql} r ON ${joinConditions.join(" AND ")}
  WHERE ${mismatchConditions.join(" OR ")}
) issues;`;
}

function buildCompositeUniqueDetailInsert(options) {
  const { batchId, sourceTable, detailTable, rule, fieldNames, primaryKeyColumns, dialect } = options;
  const fieldNameText = fieldNames.join(",");
  const groupFields = fieldNames.map((fieldName) => quoteIdentifier(fieldName, dialect));
  const joinConditions = fieldNames.map((fieldName) =>
    buildNullSafeEquality(quoteIdentifier(`t.${fieldName}`, dialect), quoteIdentifier(`d.${fieldName}`, dialect), dialect)
  );
  const blankFilters = rule.config?.ignoreBlank === false
    ? []
    : fieldNames.map((fieldName) => buildNotBlankCondition(fieldName, dialect).replaceAll(quoteIdentifier(`t.${fieldName}`, dialect), quoteIdentifier(fieldName, dialect)));
  const whereClause = blankFilters.length ? `WHERE ${blankFilters.join(" AND ")}` : "";
  const compositeKeyExpression = buildCompositeKeyExpression(fieldNames, "t", dialect);

  return `INSERT INTO ${detailTable}
  (batch_id, table_name, rule_category, rule_code, rule_name, field_name, rule_scope, pk_text, field_value_text, rule_config_json, field_names_json, composite_key_text, issue_level, issue_message, detected_at, created_at)
SELECT ${quoteValue(batchId)}, ${quoteValue(options.tableName)}, ${quoteValue(rule.ruleCategory)}, ${quoteValue(rule.ruleId)}, ${quoteValue(rule.ruleName)},
       ${quoteValue(fieldNameText)}, ${quoteValue(rule.ruleScope || "table")}, ${buildPrimaryKeyTextExpression(primaryKeyColumns, dialect)}, ${compositeKeyExpression},
       ${quoteJson(rule.config || {})}, ${quoteJson(fieldNames)}, ${compositeKeyExpression},
       ${quoteValue(rule.severity || "medium")}, ${quoteValue(rule.description || `联合字段 ${fieldNameText} 存在重复组合`)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM ${buildFromClause(sourceTable, "t")}
JOIN (
  SELECT ${groupFields.join(", ")}
  FROM ${buildFromClause(sourceTable, "qc_dup")}
  ${whereClause}
  GROUP BY ${groupFields.join(", ")}
  HAVING COUNT(*) > 1
) d ON ${joinConditions.join(" AND ")};`;
}

function buildCompositeUniqueStatsInsert(options) {
  const { batchId, sourceTable, statsTable, rule, fieldNames, dialect } = options;
  const fieldNameText = fieldNames.join(",");
  const groupFields = fieldNames.map((fieldName) => quoteIdentifier(fieldName, dialect));
  const joinConditions = fieldNames.map((fieldName) =>
    buildNullSafeEquality(quoteIdentifier(`t.${fieldName}`, dialect), quoteIdentifier(`d.${fieldName}`, dialect), dialect)
  );
  const blankFilters = rule.config?.ignoreBlank === false
    ? []
    : fieldNames.map((fieldName) => buildNotBlankCondition(fieldName, dialect).replaceAll(quoteIdentifier(`t.${fieldName}`, dialect), quoteIdentifier(fieldName, dialect)));
  const whereClause = blankFilters.length ? `WHERE ${blankFilters.join(" AND ")}` : "";

  return `INSERT INTO ${statsTable}
  (batch_id, table_name, rule_category, rule_code, field_name, rule_scope, rule_config_json, field_names_json, composite_key_text, total_rows, issue_rows, issue_rate, detected_at, created_at)
SELECT ${quoteValue(batchId)}, ${quoteValue(options.tableName)}, ${quoteValue(rule.ruleCategory)}, ${quoteValue(rule.ruleId)}, ${quoteValue(fieldNameText)},
       ${quoteValue(rule.ruleScope || "table")}, ${quoteJson(rule.config || {})}, ${quoteJson(fieldNames)}, NULL,
       totals.total_rows, issues.issue_rows,
       CASE WHEN totals.total_rows = 0 THEN 0 ELSE ROUND((issues.issue_rows * 1.0) / totals.total_rows, 6) END,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT COUNT(*) AS total_rows FROM ${buildFromClause(sourceTable, "qc_total")}) totals
CROSS JOIN (
  SELECT COUNT(*) AS issue_rows
  FROM ${buildFromClause(sourceTable, "t")}
  JOIN (
    SELECT ${groupFields.join(", ")}
    FROM ${buildFromClause(sourceTable, "qc_dup")}
    ${whereClause}
    GROUP BY ${groupFields.join(", ")}
    HAVING COUNT(*) > 1
  ) d ON ${joinConditions.join(" AND ")}
) issues;`;
}

function buildAdvancedRuleStatements(options) {
  const { advancedRule, sourceTable: filteredSourceTable, freshnessSourceTable, detailTable, statsTable, batchId, tableName, primaryKeyColumns, dialect } = options;
  const rawRule = advancedRule && typeof advancedRule === "object" ? advancedRule : {};
  if (rawRule.enabled === false) return [];
  const sourceTable = rawRule.ruleCategory === "freshness" && freshnessSourceTable ? freshnessSourceTable : filteredSourceTable;

  const config = rawRule.config && typeof rawRule.config === "object" ? rawRule.config : {};
  const rule = {
    ruleId: normalizeRuleId(rawRule.ruleId, rawRule.ruleCategory),
    ruleName: rawRule.ruleName || rawRule.ruleId || rawRule.ruleCategory || "高级规则",
    ruleScope: rawRule.ruleScope || "table",
    ruleCategory: String(rawRule.ruleCategory || "").trim(),
    severity: rawRule.severity || "medium",
    description: rawRule.description || "",
    config,
  };
  const statements = [];

  if (rule.ruleCategory === "conditional_required") {
    const conditionExpression = buildConditionExpression(config, dialect);
    const targetFields = normalizeFieldList(config.targetFields || [config.targetField]);
    const targetField = targetFields[0];
    if (!conditionExpression || !targetField) return statements;
    const targetExpression = quoteIdentifier(`t.${targetField}`, dialect);
    const requirement = config.requirement === "empty" ? "empty" : "required";
    const targetCondition = requirement === "empty"
      ? buildNotBlankExpression(targetExpression, dialect)
      : buildBlankExpression(targetExpression, dialect);
    const conditionSql = `(${conditionExpression}) AND (${targetCondition})`;
    statements.push(buildStandardDetailInsert({
      batchId,
      sourceTable,
      detailTable,
      fieldName: targetField,
      fieldNames: targetFields,
      ruleCategory: rule.ruleCategory,
      ruleCode: rule.ruleId,
      ruleName: rule.ruleName,
      ruleScope: rule.ruleScope || "row",
      ruleConfig: config,
      severity: rule.severity,
      issueMessage: rule.description || `条件成立时字段 ${targetField} ${requirement === "empty" ? "必须为空" : "不能为空"}`,
      conditionSql,
      primaryKeyColumns,
      tableName,
      dialect,
    }));
    statements.push(buildStandardStatsInsert({
      batchId,
      sourceTable,
      statsTable,
      fieldName: targetField,
      fieldNames: targetFields,
      ruleCategory: rule.ruleCategory,
      ruleCode: rule.ruleId,
      ruleScope: rule.ruleScope || "row",
      ruleConfig: config,
      conditionSql,
      tableName,
    }));
  }

  if (rule.ruleCategory === "conditional_regex") {
    const conditionExpression = buildConditionExpression(config, dialect);
    const targetField = String(config.targetField || "").trim();
    const regexPattern = String(config.regexPattern || "").trim();
    if (!conditionExpression || !targetField || !regexPattern) return statements;
    const targetExpression = quoteIdentifier(`t.${targetField}`, dialect);
    const conditionSql = `(${conditionExpression}) AND ${buildRegexMismatchExpression(targetExpression, regexPattern, dialect)}`;
    statements.push(buildStandardDetailInsert({
      batchId,
      sourceTable,
      detailTable,
      fieldName: targetField,
      fieldNames: [String(config.conditionField || "").trim(), targetField].filter(Boolean),
      ruleCategory: rule.ruleCategory,
      ruleCode: rule.ruleId,
      ruleName: rule.ruleName,
      ruleScope: rule.ruleScope || "row",
      ruleConfig: config,
      severity: rule.severity,
      issueMessage: rule.description || `条件成立时字段 ${targetField} 格式不符合要求`,
      conditionSql,
      primaryKeyColumns,
      tableName,
      dialect,
    }));
    statements.push(buildStandardStatsInsert({
      batchId,
      sourceTable,
      statsTable,
      fieldName: targetField,
      fieldNames: [String(config.conditionField || "").trim(), targetField].filter(Boolean),
      ruleCategory: rule.ruleCategory,
      ruleCode: rule.ruleId,
      ruleScope: rule.ruleScope || "row",
      ruleConfig: config,
      conditionSql,
      tableName,
    }));
  }

  if (rule.ruleCategory === "field_compare") {
    const leftField = String(config.leftField || "").trim();
    const rightField = String(config.rightField || "").trim();
    const compareOperator = ["<", "<=", "=", ">=", ">", "!="].includes(config.compareOperator) ? config.compareOperator : "<=";
    if (!leftField || !rightField) return statements;
    const leftExpression = buildComparableExpression(leftField, config.valueType, dialect);
    const rightExpression = buildComparableExpression(rightField, config.valueType, dialect);
    const inverseMap = { "<": ">=", "<=": ">", "=": "<>", ">=": "<", ">": "<=", "!=": "=" };
    const conditionSql = `(${buildNotBlankExpression(quoteIdentifier(`t.${leftField}`, dialect), dialect)} AND ${buildNotBlankExpression(quoteIdentifier(`t.${rightField}`, dialect), dialect)} AND ${leftExpression} ${inverseMap[compareOperator]} ${rightExpression})`;
    statements.push(buildStandardDetailInsert({
      batchId,
      sourceTable,
      detailTable,
      fieldName: leftField,
      fieldNames: [leftField, rightField],
      ruleCategory: rule.ruleCategory,
      ruleCode: rule.ruleId,
      ruleName: rule.ruleName,
      ruleScope: rule.ruleScope || "row",
      ruleConfig: config,
      fieldValueExpression: buildCompositeKeyExpression([leftField, rightField], "t", dialect),
      compositeKeyExpression: buildCompositeKeyExpression([leftField, rightField], "t", dialect),
      severity: rule.severity,
      issueMessage: rule.description || `字段 ${leftField} 与 ${rightField} 不满足 ${compareOperator}`,
      conditionSql,
      primaryKeyColumns,
      tableName,
      dialect,
    }));
    statements.push(buildStandardStatsInsert({
      batchId,
      sourceTable,
      statsTable,
      fieldName: `${leftField},${rightField}`,
      fieldNames: [leftField, rightField],
      ruleCategory: rule.ruleCategory,
      ruleCode: rule.ruleId,
      ruleScope: rule.ruleScope || "row",
      ruleConfig: config,
      conditionSql,
      tableName,
    }));
  }

  if (rule.ruleCategory === "composite_unique") {
    const fieldNames = normalizeFieldList(config.fieldNames);
    if (fieldNames.length < 2) return statements;
    statements.push(buildCompositeUniqueDetailInsert({
      batchId,
      sourceTable,
      detailTable,
      rule,
      fieldNames,
      primaryKeyColumns,
      tableName,
      dialect,
    }));
    statements.push(buildCompositeUniqueStatsInsert({
      batchId,
      sourceTable,
      statsTable,
      rule,
      fieldNames,
      tableName,
      dialect,
    }));
  }

  if (rule.ruleCategory === "freshness") {
    const timeField = String(config.timeField || config.targetField || "").trim();
    if (!timeField) return statements;
    const conditionSql = buildFreshnessCondition(timeField, config.maxDelayValue, config.maxDelayUnit, dialect);
    const thresholdValue = Math.max(1, Number(config.maxDelayValue || 1));
    const issueRowsSql = `(SELECT COUNT(*) FROM ${buildFromClause(sourceTable, "qc_issue")} WHERE ${conditionSql.replaceAll(quoteIdentifier(`t.${timeField}`, dialect), quoteIdentifier(`qc_issue.${timeField}`, dialect))})`;
    const totalRowsSql = `(SELECT COUNT(*) FROM ${buildFromClause(sourceTable, "qc_total")})`;
    const currentMetricSql = buildFreshnessMetricSql(sourceTable, timeField, config.maxDelayUnit, dialect);
    const baselineMetricSql = `CAST(${thresholdValue} AS DECIMAL(18,6))`;
    const freshnessFailedCondition = "curr.total_rows > 0 AND (curr.metric_value IS NULL OR curr.metric_value > base.baseline_value OR curr.issue_rows > 0)";
    statements.push(buildAggregateMetricDetailInsert({
      batchId,
      detailTable,
      rule: { ...rule, ruleScope: rule.ruleScope || "aggregate" },
      tableName,
      fieldName: timeField,
      fieldNames: [timeField],
      currentMetricSql,
      totalRowsSql,
      issueRowsSql,
      baselineMetricSql,
      thresholdValue,
      conditionSql: freshnessFailedCondition,
      dialect,
    }));
    statements.push(buildAggregateMetricStatsInsert({
      batchId,
      statsTable,
      rule: { ...rule, ruleScope: rule.ruleScope || "aggregate" },
      tableName,
      fieldName: timeField,
      fieldNames: [timeField],
      currentMetricSql,
      totalRowsSql,
      issueRowsSql,
      baselineMetricSql,
      thresholdValue,
      conditionSql: freshnessFailedCondition,
    }));
  }

  if (rule.ruleCategory === "volume_anomaly") {
    const fieldName = "row_count";
    const thresholdRatio = Math.max(0, Number(config.thresholdPercent || 30)) / 100;
    const baselineMode = String(config.baselineMode || "recent_avg");
    const lookbackBatches = Math.max(1, Number(config.lookbackBatches || (baselineMode === "last_batch" ? 1 : 7)));
    const minHistoryBatches = Math.max(1, Math.min(lookbackBatches, Number(config.minHistoryBatches || (baselineMode === "last_batch" ? 1 : 3))));
    const currentMetricSql = `CAST((SELECT COUNT(*) FROM ${buildFromClause(sourceTable, "qc_current")}) AS DECIMAL(18,6))`;
    const totalRowsSql = `(SELECT COUNT(*) FROM ${buildFromClause(sourceTable, "qc_total")})`;
    const issueRowsSql = "0";
    const baselineMetricSql = buildHistoryMetricExpression({
      statsTable,
      tableName,
      rule,
      fieldName,
      baselineMode,
      lookbackBatches,
      dialect,
    });
    const historyCountSql = buildHistoryMetricCountExpression({
      statsTable,
      tableName,
      rule,
      fieldName,
      baselineMode,
      lookbackBatches,
      dialect,
    });
    const conditionSql = buildBaselineActivationCondition({
      historyCountExpression: historyCountSql,
      minHistoryBatches,
      warmupPolicy: config.warmupPolicy,
      warmupThreshold: config.warmupThreshold,
      currentExpression: "curr.metric_value",
      dynamicCondition: buildMetricChangeCondition("curr.metric_value", "base.baseline_value", thresholdRatio, config.direction),
    });
    statements.push(buildAggregateMetricDetailInsert({
      batchId,
      detailTable,
      rule: { ...rule, ruleScope: rule.ruleScope || "aggregate" },
      tableName,
      fieldName,
      fieldNames: [],
      currentMetricSql,
      totalRowsSql,
      issueRowsSql,
      baselineMetricSql,
      thresholdValue: thresholdRatio,
      conditionSql,
      dialect,
    }));
    statements.push(buildAggregateMetricStatsInsert({
      batchId,
      statsTable,
      rule: { ...rule, ruleScope: rule.ruleScope || "aggregate" },
      tableName,
      fieldName,
      fieldNames: [],
      currentMetricSql,
      totalRowsSql,
      issueRowsSql,
      baselineMetricSql,
      thresholdValue: thresholdRatio,
      conditionSql,
      issueRowsExpression: "ROUND(GREATEST(ABS(curr.metric_value - COALESCE(base.baseline_value, curr.metric_value)), 0), 0)",
    }));
  }

  if (rule.ruleCategory === "null_rate_change") {
    const metricField = String(config.metricField || config.targetField || "").trim();
    if (!metricField) return statements;
    const thresholdRatio = Math.max(0, Number(config.thresholdPercent || 20)) / 100;
    const baselineMode = String(config.baselineMode || "recent_avg");
    const lookbackBatches = Math.max(1, Number(config.lookbackBatches || (baselineMode === "last_batch" ? 1 : 7)));
    const minHistoryBatches = Math.max(1, Math.min(lookbackBatches, Number(config.minHistoryBatches || (baselineMode === "last_batch" ? 1 : 3))));
    const blankCountSql = `(SELECT COUNT(*) FROM ${buildFromClause(sourceTable, "qc_issue")} WHERE ${buildBlankCondition(metricField, dialect).replaceAll(quoteIdentifier(`t.${metricField}`, dialect), quoteIdentifier(`qc_issue.${metricField}`, dialect))})`;
    const totalRowsSql = `(SELECT COUNT(*) FROM ${buildFromClause(sourceTable, "qc_total")})`;
    const currentMetricSql = `CASE WHEN ${totalRowsSql} = 0 THEN 0 ELSE ROUND((${blankCountSql} * 1.0) / ${totalRowsSql}, 6) END`;
    const baselineMetricSql = buildHistoryMetricExpression({
      statsTable,
      tableName,
      rule,
      fieldName: metricField,
      baselineMode,
      lookbackBatches,
      dialect,
    });
    const historyCountSql = buildHistoryMetricCountExpression({
      statsTable,
      tableName,
      rule,
      fieldName: metricField,
      baselineMode,
      lookbackBatches,
      dialect,
    });
    const conditionSql = buildBaselineActivationCondition({
      historyCountExpression: historyCountSql,
      minHistoryBatches,
      warmupPolicy: config.warmupPolicy,
      warmupThreshold: config.warmupThreshold,
      currentExpression: "curr.metric_value",
      dynamicCondition: buildMetricChangeCondition("curr.metric_value", "base.baseline_value", thresholdRatio, config.direction),
    });
    statements.push(buildAggregateMetricDetailInsert({
      batchId,
      detailTable,
      rule: { ...rule, ruleScope: rule.ruleScope || "aggregate" },
      tableName,
      fieldName: metricField,
      fieldNames: [metricField],
      currentMetricSql,
      totalRowsSql,
      issueRowsSql: blankCountSql,
      baselineMetricSql,
      thresholdValue: thresholdRatio,
      conditionSql,
      dialect,
    }));
    statements.push(buildAggregateMetricStatsInsert({
      batchId,
      statsTable,
      rule: { ...rule, ruleScope: rule.ruleScope || "aggregate" },
      tableName,
      fieldName: metricField,
      fieldNames: [metricField],
      currentMetricSql,
      totalRowsSql,
      issueRowsSql: blankCountSql,
      baselineMetricSql,
      thresholdValue: thresholdRatio,
      conditionSql,
    }));
  }

  if (rule.ruleCategory === "batch_completeness") {
    const dimensionField = String(config.dimensionField || config.metricField || "").trim();
    if (!dimensionField) return statements;
    const expectedDistinctCount = Math.max(1, Number(config.expectedDistinctCount || 1));
    const distinctCountSql = `(SELECT COUNT(DISTINCT ${quoteIdentifier(`qc_current.${dimensionField}`, dialect)}) FROM ${buildFromClause(sourceTable, "qc_current")} WHERE ${buildNotBlankCondition(dimensionField, dialect).replaceAll(quoteIdentifier(`t.${dimensionField}`, dialect), quoteIdentifier(`qc_current.${dimensionField}`, dialect))})`;
    const totalRowsSql = `${expectedDistinctCount}`;
    const issueRowsSql = `GREATEST(${expectedDistinctCount} - ${distinctCountSql}, 0)`;
    const currentMetricSql = `CAST(${distinctCountSql} AS DECIMAL(18,6))`;
    const baselineMetricSql = `CAST(${expectedDistinctCount} AS DECIMAL(18,6))`;
    const conditionSql = `curr.metric_value < base.baseline_value`;
    statements.push(buildAggregateMetricDetailInsert({
      batchId,
      detailTable,
      rule: { ...rule, ruleScope: rule.ruleScope || "aggregate" },
      tableName,
      fieldName: dimensionField,
      fieldNames: [dimensionField],
      currentMetricSql,
      totalRowsSql,
      issueRowsSql,
      baselineMetricSql,
      thresholdValue: expectedDistinctCount,
      conditionSql,
      dialect,
    }));
    statements.push(buildAggregateMetricStatsInsert({
      batchId,
      statsTable,
      rule: { ...rule, ruleScope: rule.ruleScope || "aggregate" },
      tableName,
      fieldName: dimensionField,
      fieldNames: [dimensionField],
      currentMetricSql,
      totalRowsSql,
      issueRowsSql,
      baselineMetricSql,
      thresholdValue: expectedDistinctCount,
      conditionSql,
    }));
  }

  if (rule.ruleCategory === "cross_table_lookup") {
    const detailSql = buildCrossTableLookupDetailInsert({
      batchId,
      sourceTable,
      detailTable,
      rule: { ...rule, ruleScope: "cross_table" },
      primaryKeyColumns,
      tableName,
      dialect,
    });
    const statsSql = buildCrossTableLookupStatsInsert({
      batchId,
      sourceTable,
      statsTable,
      rule: { ...rule, ruleScope: "cross_table" },
      tableName,
      dialect,
    });
    if (detailSql && statsSql) statements.push(detailSql, statsSql);
  }

  if (rule.ruleCategory === "cross_table_consistency") {
    const detailSql = buildCrossTableConsistencyDetailInsert({
      batchId,
      sourceTable,
      detailTable,
      rule: { ...rule, ruleScope: "cross_table" },
      primaryKeyColumns,
      tableName,
      dialect,
    });
    const statsSql = buildCrossTableConsistencyStatsInsert({
      batchId,
      sourceTable,
      statsTable,
      rule: { ...rule, ruleScope: "cross_table" },
      tableName,
      dialect,
    });
    if (detailSql && statsSql) statements.push(detailSql, statsSql);
  }

  return statements;
}

function buildFieldStatements(options) {
  const {
    fieldStrategy,
    sourceTable,
    detailTable,
    statsTable,
    batchId,
    tableName,
    primaryKeyColumns,
    dialect,
  } = options;
  const statements = [];
  const fieldName = fieldStrategy.columnName;

  if (fieldStrategy.nonNullCheck) {
    const conditionSql = buildBlankCondition(fieldName, dialect);
    statements.push(buildStandardDetailInsert({
      batchId,
      sourceTable,
      detailTable,
      fieldName,
      ruleCategory: "non_null",
      ruleCode: `non_null_${fieldName}`,
      ruleName: `非空检查-${fieldName}`,
      severity: "medium",
      issueMessage: `字段 ${fieldName} 为空`,
      conditionSql,
      primaryKeyColumns,
      tableName,
      dialect,
    }));
    statements.push(buildStandardStatsInsert({
      batchId,
      sourceTable,
      statsTable,
      fieldName,
      ruleCategory: "non_null",
      ruleCode: `non_null_${fieldName}`,
      conditionSql,
      tableName,
    }));
  }

  if (fieldStrategy.duplicateCheck) {
    statements.push(buildDuplicateDetailInsert({
      batchId,
      sourceTable,
      detailTable,
      fieldName,
      primaryKeyColumns,
      tableName,
      dialect,
    }));
    statements.push(buildDuplicateStatsInsert({
      batchId,
      sourceTable,
      statsTable,
      fieldName,
      tableName,
      dialect,
    }));
  }

  for (const rule of fieldStrategy.complianceRules || []) {
    if (!rule?.regexPattern) continue;
    const conditionSql = buildRegexMismatchCondition(fieldName, rule.regexPattern, dialect);
    statements.push(buildStandardDetailInsert({
      batchId,
      sourceTable,
      detailTable,
      fieldName,
      ruleCategory: "compliance",
      ruleCode: rule.ruleCode || `regex_${fieldName}`,
      ruleName: rule.ruleName || `合规校验-${fieldName}`,
      severity: rule.severity || "medium",
      issueMessage: `字段 ${fieldName} 不符合规则 ${rule.ruleName || rule.ruleCode || ""}`.trim(),
      conditionSql,
      primaryKeyColumns,
      tableName,
      dialect,
    }));
    statements.push(buildStandardStatsInsert({
      batchId,
      sourceTable,
      statsTable,
      fieldName,
      ruleCategory: "compliance",
      ruleCode: rule.ruleCode || `regex_${fieldName}`,
      conditionSql,
      tableName,
    }));
  }

  const valueRange = fieldStrategy.valueRangeSnapshot || {};
  if (valueRange.mode === "list" && Array.isArray(valueRange.allowedValues) && valueRange.allowedValues.length > 0) {
    const conditionSql = buildAllowedValuesCondition(fieldName, valueRange.allowedValues, dialect);
    if (conditionSql) {
      statements.push(buildStandardDetailInsert({
        batchId,
        sourceTable,
        detailTable,
        fieldName,
        ruleCategory: "value_range",
        ruleCode: `value_range_${fieldName}`,
        ruleName: `值域检查-${fieldName}`,
        severity: "medium",
        issueMessage: `字段 ${fieldName} 超出允许值域`,
        conditionSql,
        primaryKeyColumns,
        tableName,
        dialect,
      }));
      statements.push(buildStandardStatsInsert({
        batchId,
        sourceTable,
        statsTable,
        fieldName,
        ruleCategory: "value_range",
        ruleCode: `value_range_${fieldName}`,
        conditionSql,
        tableName,
      }));
    }
  }

  if (valueRange.mode === "range" || valueRange.mode === "number_range") {
    const conditionSql = buildRangeCondition(fieldName, valueRange.minValue, valueRange.maxValue, dialect);
    if (conditionSql) {
      statements.push(buildStandardDetailInsert({
        batchId,
        sourceTable,
        detailTable,
        fieldName,
        ruleCategory: "value_range",
        ruleCode: `value_range_${fieldName}`,
        ruleName: `值域检查-${fieldName}`,
        severity: "medium",
        issueMessage: `字段 ${fieldName} 超出数值范围`,
        conditionSql,
        primaryKeyColumns,
        tableName,
        dialect,
      }));
      statements.push(buildStandardStatsInsert({
        batchId,
        sourceTable,
        statsTable,
        fieldName,
        ruleCategory: "value_range",
        ruleCode: `value_range_${fieldName}`,
        conditionSql,
        tableName,
      }));
    }
  }

  if (valueRange.mode === "date_range") {
    const conditionSql = buildDateRangeCondition(fieldName, valueRange.startDate, valueRange.endDate, dialect);
    if (conditionSql) {
      statements.push(buildStandardDetailInsert({
        batchId,
        sourceTable,
        detailTable,
        fieldName,
        ruleCategory: "value_range",
        ruleCode: `value_range_${fieldName}`,
        ruleName: `日期区间检测-${fieldName}`,
        severity: "medium",
        issueMessage: `字段 ${fieldName} 超出日期区间`,
        conditionSql,
        primaryKeyColumns,
        tableName,
        dialect,
      }));
      statements.push(buildStandardStatsInsert({
        batchId,
        sourceTable,
        statsTable,
        fieldName,
        ruleCategory: "value_range",
        ruleCode: `value_range_${fieldName}`,
        conditionSql,
        tableName,
      }));
    }
  }

  return statements;
}

function normalizeCommentText(value, fallback = "-") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim() || fallback;
}

function buildFieldPreviewComments(fieldStrategy) {
  const lines = [];
  const fieldName = normalizeCommentText(fieldStrategy.columnName);
  const fieldComment = normalizeCommentText(fieldStrategy.columnComment);
  lines.push(`-- 字段: ${fieldName}${fieldComment !== "-" ? ` / ${fieldComment}` : ""}`);
  if (fieldStrategy.recommendationReason) {
    lines.push(`-- 推荐说明: ${normalizeCommentText(fieldStrategy.recommendationReason)}`);
  }
  if (fieldStrategy.nonNullCheck) {
    lines.push("-- 检查项: 非空检测");
  }
  if (fieldStrategy.duplicateCheck) {
    lines.push("-- 检查项: 重复检测");
  }
  for (const rule of fieldStrategy.complianceRules || []) {
    lines.push(`-- 检查项: 合规规则 / ${normalizeCommentText(rule.ruleName || rule.ruleCode)} / 规则编码: ${normalizeCommentText(rule.ruleCode)}`);
  }
  const valueRange = fieldStrategy.valueRangeSnapshot || {};
  if (valueRange.mode === "list" && Array.isArray(valueRange.allowedValues) && valueRange.allowedValues.length > 0) {
    lines.push(`-- 检查项: 值域范围 / 来源: ${normalizeCommentText(valueRange.sourceLabel, "自定义值")} / 值数量: ${valueRange.allowedValues.length}`);
  } else if (valueRange.mode === "range" || valueRange.mode === "number_range") {
    lines.push(`-- 检查项: 值域范围 / 数值区间: ${normalizeCommentText(valueRange.minValue, "-")} ~ ${normalizeCommentText(valueRange.maxValue, "-")}`);
  } else if (valueRange.mode === "date_range") {
    lines.push(`-- 检查项: 值域范围 / 日期区间: ${normalizeCommentText(valueRange.startDate, "-")} ~ ${normalizeCommentText(valueRange.endDate, "-")}`);
  }
  return lines;
}

function buildAdvancedRulePreviewComments(rule) {
  const config = rule?.config && typeof rule.config === "object" ? rule.config : {};
  const fields = normalizeFieldList(config.fieldNames || config.targetFields || [
    config.targetField,
    config.leftField,
    config.rightField,
    config.timeField,
  ]);
  return [
    `-- 高级规则: ${normalizeCommentText(rule?.ruleName || rule?.ruleId || rule?.ruleCategory)}`,
    `-- 规则类型: ${normalizeCommentText(rule?.ruleCategory)} / 作用域: ${normalizeCommentText(rule?.ruleScope || "table")}`,
    fields.length ? `-- 关联字段: ${fields.join(", ")}` : "-- 关联字段: -",
    rule?.description ? `-- 规则说明: ${normalizeCommentText(rule.description)}` : null,
  ].filter(Boolean);
}

function buildQualitySqlBundle(options) {
  const dialect = normalizeDialect(options.dialect || "mysql");
  const sourceTable = String(options.sourceFromSql || "").trim() || quoteIdentifier(options.tableName, dialect);
  const fullSourceTable = String(options.fullSourceFromSql || "").trim() || quoteIdentifier(options.tableName, dialect);
  const detailTable = quoteIdentifier(options.detailTableName, dialect);
  const statsTable = quoteIdentifier(options.statsTableName, dialect);
  const primaryKeyColumns = Array.isArray(options.primaryKeyColumns) ? options.primaryKeyColumns : [];
  const batchId = options.batchId;
  const ensureStatements = buildEnsureTableStatements(dialect, options.detailTableName, options.statsTableName);

  const segments = [
    `-- Quality Control Script for ${options.tableName}`,
    `-- Batch ID: ${batchId}`,
    "",
    ensureStatements.join("\n\n"),
    "",
    `-- Detail and statistic inserts for source table ${options.tableName}`,
  ];

  const statements = [...ensureStatements];
  const previewSegments = [];
  const previewItems = [];
  for (const fieldStrategy of options.fieldStrategies || []) {
    const fieldStatements = buildFieldStatements({
      fieldStrategy,
      sourceTable,
      detailTable,
      statsTable,
      batchId,
      tableName: options.tableName,
      primaryKeyColumns,
      dialect,
    });
    statements.push(...fieldStatements);
    if (fieldStatements.length > 0) {
      const previewSql = [
        buildFieldPreviewComments(fieldStrategy).join("\n"),
        fieldStatements.join("\n\n"),
      ].join("\n\n");
      previewSegments.push(previewSql);
      previewItems.push({
        key: `field_${fieldStrategy.columnName}`,
        category: "field",
        ruleCode: fieldStrategy.columnName,
        title: fieldStrategy.columnName,
        sql: previewSql,
      });
    }
  }

  for (const advancedRule of options.advancedRules || []) {
    const advancedStatements = buildAdvancedRuleStatements({
      advancedRule,
      sourceTable,
      freshnessSourceTable: fullSourceTable,
      detailTable,
      statsTable,
      batchId,
      tableName: options.tableName,
      primaryKeyColumns,
      dialect,
    });
    statements.push(...advancedStatements);
    if (advancedStatements.length > 0) {
      const previewSql = [
        buildAdvancedRulePreviewComments(advancedRule).join("\n"),
        advancedStatements.join("\n\n"),
      ].join("\n\n");
      previewSegments.push(previewSql);
      previewItems.push({
        key: `advanced_${advancedRule.ruleId}`,
        category: "advanced",
        ruleCode: advancedRule.ruleId,
        title: advancedRule.ruleName || advancedRule.ruleId,
        sql: previewSql,
      });
    }
  }

  segments.push(previewSegments.length ? previewSegments.join("\n\n") : "-- No quality rules were enabled for the current strategy.");

  return {
    batchId,
    dialect,
    sourceTableName: options.tableName,
    detailTableName: options.detailTableName,
    statsTableName: options.statsTableName,
    primaryKeyColumns,
    advancedRuleCount: Array.isArray(options.advancedRules) ? options.advancedRules.filter((rule) => rule?.enabled !== false).length : 0,
    statementCount: statements.length,
    ensureStatements,
    ruleStatements: statements.slice(ensureStatements.length),
    previewItems,
    statements,
    sqlContent: segments.join("\n"),
  };
}

module.exports = {
  buildQualitySqlBundle,
};
