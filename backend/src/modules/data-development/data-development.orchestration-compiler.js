const AppError = require("../../common/errors/app-error");
const scheduler = require("./data-development.scheduler");
const sqlParser = require("./data-development.sql-parser");
const { normalizeDatasourceType, quoteIdentifier } = require("./data-development.utils");

function trimText(value) {
  return String(value ?? "").trim();
}

function stripTrailingSemicolon(sqlText) {
  return trimText(sqlText).replace(/;+\s*$/, "");
}

function prependInlineAliases(sqlText, inlineAliases) {
  if (!inlineAliases.length) {
    return sqlText;
  }

  const recursiveWithMatch = String(sqlText).match(/^with\s+recursive\b/i);
  if (recursiveWithMatch) {
    return `WITH RECURSIVE\n${inlineAliases.join(",\n")},\n${String(sqlText).replace(/^with\s+recursive\b/i, "").trimStart()}`;
  }

  if (/^with\b/i.test(String(sqlText))) {
    return `WITH\n${inlineAliases.join(",\n")},\n${String(sqlText).replace(/^with\b/i, "").trimStart()}`;
  }

  return `WITH\n${inlineAliases.join(",\n")}\n${sqlText}`;
}

function normalizeSqlName(value, fallback = "node") {
  const normalized = String(value || fallback)
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return normalized || fallback;
}

function indentSql(sqlText, spaces = 2) {
  const padding = " ".repeat(spaces);
  return String(sqlText || "")
    .split("\n")
    .map((line) => (line ? `${padding}${line}` : line))
    .join("\n");
}

function escapeSqlLiteral(value) {
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

function parseStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseObjectArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === "object");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
    } catch (error) {
      return [];
    }
  }
  return [];
}

function uniqueValues(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

const VALIDATION_PATTERN_MAP = {
  id_card: "^(\\d{15}|\\d{17}[0-9Xx])$",
  phone: "^1[3-9][0-9]{9}$",
  email: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$",
  credit_code: "^[0-9A-Z]{18}$",
  url: "^(https?:\\/\\/).+",
  ipv4: "^(25[0-5]|2[0-4]\\d|1?\\d?\\d)(\\.(25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}$",
  postal_code: "^\\d{6}$",
};

function getValidationPattern(checkType) {
  return VALIDATION_PATTERN_MAP[trimText(checkType)] || null;
}

const AI_OPERATOR_CODES = new Set(["llm", "llm_row", "llm_batch"]);

function normalizeAiOperatorCode(value) {
  const operatorCode = trimText(value);
  return operatorCode === "llm" ? "llm_row" : operatorCode;
}

function getAiFallbackFieldName(operatorCode) {
  return normalizeAiOperatorCode(operatorCode) === "llm_batch" ? "batch_result" : "llm_reply";
}

function normalizeAiOutputFields(nodeConfig, fallbackFieldName = "llm_reply") {
  const parsedFields = parseObjectArray(nodeConfig?.outputFields)
    .map((item) => ({
      fieldName: trimText(item.fieldName || item.name || item.outputFieldName),
      description: trimText(item.description || item.fieldDesc || item.label),
    }))
    .filter((item) => item.fieldName);

  if (parsedFields.length) {
    return parsedFields;
  }

  const legacyFieldName = trimText(nodeConfig?.outputFieldName) || fallbackFieldName;
  return legacyFieldName ? [{ fieldName: legacyFieldName, description: "" }] : [];
}

function sanitizePreviewLimit(value, fallback = 20) {
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) {
    return fallback;
  }
  return Math.max(1, Math.min(Math.floor(next), 200));
}

function buildEdgeMaps(edges) {
  const incoming = new Map();
  const outgoing = new Map();

  for (const edge of edges) {
    if (!incoming.has(edge.targetNodeKey)) {
      incoming.set(edge.targetNodeKey, []);
    }
    incoming.get(edge.targetNodeKey).push(edge);

    if (!outgoing.has(edge.sourceNodeKey)) {
      outgoing.set(edge.sourceNodeKey, []);
    }
    outgoing.get(edge.sourceNodeKey).push(edge);
  }

  return { incoming, outgoing };
}

function normalizeOrchestrationEdgeStatus(value) {
  return trimText(value).toLowerCase() === "paused" ? "paused" : "active";
}

function filterActiveEdges(edges) {
  return (Array.isArray(edges) ? edges : []).filter((edge) => normalizeOrchestrationEdgeStatus(edge?.edgeStatus) === "active");
}

function buildCteReference(cteName, dialect) {
  return quoteIdentifier(cteName, dialect);
}

function buildAliasReference(alias, columnName, dialect) {
  return quoteIdentifier(`${alias}.${columnName}`, dialect);
}

function buildWithClause(plans, dialect) {
  return `WITH\n${plans
    .map((item) => `${quoteIdentifier(item.cteName, dialect)} AS (\n${indentSql(item.sql, 2)}\n)`)
    .join(",\n")}`;
}

function buildNodeSelectSql(cteName, dialect, previewLimit) {
  const normalizedLimit = sanitizePreviewLimit(previewLimit, 20);
  const baseSql = `SELECT *\nFROM ${buildCteReference(cteName, dialect)}`;
  const normalizedDialect = normalizeDatasourceType(dialect);
  if (normalizedDialect === "oracle") return `SELECT * FROM (\n${indentSql(baseSql, 2)}\n) WHERE ROWNUM <= ${normalizedLimit}`;
  if (normalizedDialect === "dm") return `${baseSql}\nFETCH FIRST ${normalizedLimit} ROWS ONLY`;
  return `${baseSql}\nLIMIT ${normalizedLimit}`;
}

function buildPlanSelectSql(plan, dialect) {
  return trimText(plan?.inputSql) || `SELECT *\nFROM ${buildCteReference(plan.cteName, dialect)}`;
}

function buildPlanFromClause(plan, dialect, alias) {
  const aliasSql = alias ? ` AS ${quoteIdentifier(alias, dialect)}` : "";
  if (trimText(plan?.inputSql)) {
    return `(\n${indentSql(plan.inputSql, 2)}\n)${aliasSql}`;
  }
  return `${buildCteReference(plan.cteName, dialect)}${aliasSql}`;
}

function buildHashExpression(fieldExpression, algorithm, dialect) {
  const normalizedDialect = normalizeDatasourceType(dialect);
  const safeAlgorithm = trimText(algorithm || "md5").toLowerCase();
  if (normalizedDialect === "oracle") {
    const oracleAlgorithm = safeAlgorithm === "sha1" ? "SHA1" : safeAlgorithm === "sha256" ? "SHA256" : "MD5";
    return `STANDARD_HASH(${fieldExpression}, '${oracleAlgorithm}')`;
  }
  if (safeAlgorithm === "sha1") {
    return `SHA1(${fieldExpression})`;
  }
  if (safeAlgorithm === "sha256") {
    return `SHA2(${fieldExpression}, 256)`;
  }
  return `MD5(${fieldExpression})`;
}

function resolveBranchCondition(nodeConfig, sourceAlias, dialect) {
  return resolveRuleGroupCondition(
    nodeConfig,
    "branchRules",
    "branchLogic",
    ["branchCondition", "filterCondition", "configText"],
    sourceAlias,
    dialect
  );
}

function decorateIncomingPlans(incomingEdges, compiledPlanMap, nodeMap, dialect) {
  return incomingEdges
    .map((edge) => {
      const plan = compiledPlanMap.get(edge.sourceNodeKey);
      if (!plan) {
        return null;
      }

      const sourceNode = nodeMap.get(edge.sourceNodeKey);
      if (sourceNode?.nodeType === "operator" && trimText(sourceNode.operatorCode) === "branch") {
        const branchCondition = resolveBranchCondition(sourceNode.nodeConfig || {}, "source_data", dialect);
        if (!branchCondition) {
          throw new AppError(`Branch node ${sourceNode.nodeName} must configure a branch condition`, 400);
        }

        const branchRoute = trimText(edge.sourcePort) === "branch_false" ? "branch_false" : "branch_true";
        return {
          ...plan,
          inputSql: `SELECT *\nFROM ${buildPlanFromClause(plan, dialect, "source_data")}\nWHERE ${branchRoute === "branch_false" ? `NOT (${branchCondition})` : branchCondition}`,
          branchRoute,
        };
      }

      return plan;
    })
    .filter(Boolean);
}

function buildNamedSelectList(alias, targetColumns, sourceColumns, dialect) {
  const sourceSet = new Set(sourceColumns);
  return targetColumns
    .map((columnName) => (
      sourceSet.has(columnName)
        ? `${buildAliasReference(alias, columnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}`
        : `NULL AS ${quoteIdentifier(columnName, dialect)}`
    ))
    .join(",\n");
}

function buildProjectionSelectList(alias, selectedColumns, dialect) {
  return selectedColumns
    .map((columnName) => `${buildAliasReference(alias, columnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}`)
    .join(",\n");
}

function buildPositionalSelectList(alias, targetColumns, sourceColumns, dialect) {
  return targetColumns
    .map((columnName, index) => {
      const sourceColumnName = sourceColumns[index];
      return sourceColumnName
        ? `${buildAliasReference(alias, sourceColumnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}`
        : `NULL AS ${quoteIdentifier(columnName, dialect)}`;
    })
    .join(",\n");
}

function buildReplaceSelectListLegacy(columns, fieldName, matchValue, replaceValue, dialect) {
  const sourceAlias = "source_data";
  const fieldExpression = buildAliasReference(sourceAlias, fieldName, dialect);
  const normalizedReplaceValue = replaceValue === undefined || replaceValue === null ? "" : replaceValue;
  const condition = trimText(matchValue)
    ? `${fieldExpression} = ${escapeSqlLiteral(matchValue)}`
    : `${fieldExpression} IS NULL OR ${fieldExpression} = ''`;

  return columns
    .map((columnName) => {
      if (columnName !== fieldName) {
        return `${buildAliasReference(sourceAlias, columnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}`;
      }

      return `CASE WHEN ${condition} THEN ${escapeSqlLiteral(normalizedReplaceValue)} ELSE ${fieldExpression} END AS ${quoteIdentifier(columnName, dialect)}`;
    })
    .join(",\n");
}

function buildRenameSelectList(columns, renameMappings, dialect) {
  const sourceAlias = "source_data";
  const renameMap = new Map(renameMappings.map((item) => [item.sourceField, item.targetField]));
  const outputColumns = columns.map((columnName) => renameMap.get(columnName) || columnName);
  return {
    outputColumns,
    selectSql: columns
      .map((columnName) => `${buildAliasReference(sourceAlias, columnName, dialect)} AS ${quoteIdentifier(renameMap.get(columnName) || columnName, dialect)}`)
      .join(",\n"),
  };
}

function buildOutputStatements(compiledPlans, incoming, outputPlans, dialect) {
  return outputPlans
    .filter((item) => item.relationName)
    .map((item) => {
      const lineageNodeKeys = collectLineageNodeKeys(item.nodeKey, incoming);
      const withClause = buildWithClause(
        compiledPlans.filter((plan) => lineageNodeKeys.has(plan.nodeKey)),
        dialect
      );
      const outputColumns = (item.columns || []).filter(Boolean);
      const columnSql = outputColumns.length ? ` (${outputColumns.map((columnName) => quoteIdentifier(columnName, dialect)).join(", ")})` : "";
      return {
        nodeKey: item.nodeKey,
        nodeName: item.nodeName,
        targetTable: item.relationName,
        sql: `${withClause}\nINSERT INTO ${quoteIdentifier(item.relationName, dialect)}${columnSql}\nSELECT *\nFROM ${buildCteReference(item.cteName, dialect)};`,
      };
    });
}

function mergeColumns(columnGroups) {
  const merged = [];
  const seen = new Set();

  for (const columns of columnGroups) {
    for (const columnName of columns || []) {
      if (!seen.has(columnName)) {
        seen.add(columnName);
        merged.push(columnName);
      }
    }
  }

  return merged;
}

function validateKnownColumns(columns, requiredColumns, nodeName, label) {
  if (!columns.length) {
    throw new AppError(`${label}节点 ${nodeName} 需要上游字段结构才能生成 SQL`, 400);
  }

  const missingColumns = requiredColumns.filter((item) => !columns.includes(item));
  if (missingColumns.length) {
    throw new AppError(`${label}节点 ${nodeName} 引用了不存在的字段: ${missingColumns.join(", ")}`, 400);
  }
}

function validateUniqueColumns(columns, nodeName, label) {
  const duplicated = columns.filter((item, index) => columns.indexOf(item) !== index);
  if (duplicated.length) {
    throw new AppError(`${label}节点 ${nodeName} 存在重复字段: ${uniqueValues(duplicated).join(", ")}`, 400);
  }
}

function normalizeRenameMappings(value) {
  return parseObjectArray(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
    }))
    .filter((item) => item.sourceField && item.targetField);
}

function normalizeSortRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      fieldName: trimText(item.fieldName),
      direction: trimText(item.direction).toUpperCase() === "DESC" ? "DESC" : "ASC",
    }))
    .filter((item) => item.fieldName);
}

function normalizeSourceTimeFilter(value) {
  if (!value || typeof value !== "object") {
    return {
      fieldName: "",
      formatType: "date",
      startValue: "",
      endValue: "",
    };
  }

  return {
    fieldName: trimText(value.fieldName),
    formatType: trimText(value.formatType) || "date",
    startValue: value.startValue === undefined || value.startValue === null ? "" : String(value.startValue),
    endValue: value.endValue === undefined || value.endValue === null ? "" : String(value.endValue),
  };
}

function normalizeColumnAlignmentRows(value) {
  return parseObjectArray(value)
    .map((row) => ({
      outputField: trimText(row.outputField),
      bindings: parseObjectArray(row.bindings)
        .map((binding) => ({
          sourceNodeKey: trimText(binding.sourceNodeKey),
          fieldName: trimText(binding.fieldName),
        }))
        .filter((binding) => binding.sourceNodeKey || binding.fieldName),
    }))
    .filter((row) => row.outputField || row.bindings.length);
}

function normalizeReplaceRules(value, legacyMatchValue, legacyReplaceValue) {
  const parsed = parseObjectArray(value)
    .map((item) => ({
      matchValue: item.matchValue === undefined || item.matchValue === null ? "" : String(item.matchValue),
      replaceValue: item.replaceValue === undefined || item.replaceValue === null ? "" : String(item.replaceValue),
    }))
    .filter((item) => item.matchValue !== "" || item.replaceValue !== "");
  if (parsed.length) {
    return parsed;
  }

  const matchValue = legacyMatchValue === undefined || legacyMatchValue === null ? "" : String(legacyMatchValue);
  const replaceValue = legacyReplaceValue === undefined || legacyReplaceValue === null ? "" : String(legacyReplaceValue);
  return matchValue !== "" || replaceValue !== "" ? [{ matchValue, replaceValue }] : [];
}

function normalizeJoinKeyRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      leftField: trimText(item.leftField),
      rightField: trimText(item.rightField),
    }))
    .filter((item) => item.leftField && item.rightField);
}

function normalizeConditionRules(value) {
  return parseObjectArray(value)
    .map((item) => {
      const referenceFieldRef = trimText(item.referenceFieldRef);
      const separatorIndex = referenceFieldRef.indexOf("::");
      const referenceNodeKey = trimText(item.referenceNodeKey)
        || (separatorIndex > 0 ? referenceFieldRef.slice(0, separatorIndex) : "");
      const referenceField = trimText(item.referenceField)
        || (separatorIndex > 0 ? referenceFieldRef.slice(separatorIndex + 2) : "");
      return {
        ruleType: trimText(item.ruleType)
          || (trimText(item.checkType) ? "builtin" : String(item.domainValues ?? "").trim() ? "domain" : "condition"),
        fieldName: trimText(item.fieldName),
        operator: trimText(item.operator) || "eq",
        value: item.value === undefined || item.value === null ? "" : String(item.value),
        valueSource: trimText(item.valueSource)
          || (referenceField ? "upstream_field" : trimText(item.customSql) ? "custom_sql" : "literal"),
        referenceNodeKey,
        referenceField,
        customSql: item.customSql === undefined || item.customSql === null ? "" : String(item.customSql),
        checkType: trimText(item.checkType) || "phone",
        matchMode: trimText(item.matchMode) || "valid",
        domainValues: item.domainValues === undefined || item.domainValues === null ? "" : String(item.domainValues),
      };
    })
    .filter((item) => item.fieldName);
}

function normalizeFormatRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
      transformType: trimText(item.transformType) || "date_to_string",
      formatPattern: item.formatPattern === undefined || item.formatPattern === null ? "" : String(item.formatPattern),
      targetType: trimText(item.targetType) || "decimal",
    }))
    .filter((item) => item.sourceField && item.targetField);
}

function normalizeComplianceRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      validationType: trimText(item.validationType)
        || (String(item.customPattern ?? "").trim() ? "regex" : String(item.fixedValue ?? "").trim() ? "fixed_value" : String(item.domainValues ?? "").trim() ? "domain" : "builtin"),
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
      checkType: trimText(item.checkType) || "phone",
      customPattern: item.customPattern === undefined || item.customPattern === null ? "" : String(item.customPattern),
      fixedValue: item.fixedValue === undefined || item.fixedValue === null ? "" : String(item.fixedValue),
      domainValues: item.domainValues === undefined || item.domainValues === null ? "" : String(item.domainValues),
      resultMode: trimText(item.resultMode) || "flag",
      defaultValue: item.defaultValue === undefined || item.defaultValue === null ? "" : String(item.defaultValue),
    }))
    .filter((item) => item.sourceField && item.targetField);
}

function normalizeStringRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
      transformType: trimText(item.transformType) || "trim",
      argument1: item.argument1 === undefined || item.argument1 === null ? "" : String(item.argument1),
      argument2: item.argument2 === undefined || item.argument2 === null ? "" : String(item.argument2),
    }))
    .filter((item) => item.sourceField && item.targetField);
}

function normalizeDesensitizeRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
      maskType: trimText(item.maskType) || trimText(item.transform) || "mask",
      transform: trimText(item.transform) || trimText(item.maskType) || "mask",
      maskChar: trimText(item.maskChar) || "*",
      prefixLength: Math.max(0, Number(item.prefixLength || 0)),
      suffixLength: Math.max(0, Number(item.suffixLength || 0)),
      truncateLength: Math.max(0, Number(item.truncateLength || 0)),
      replacePattern: trimText(item.replacePattern) || trimText(item.pattern) || "",
      replaceValue: item.replaceValue === undefined || item.replaceValue === null ? "" : String(item.replaceValue),
      encryptAlgorithm: trimText(item.encryptAlgorithm) || trimText(item.hashAlgorithm) || "md5",
      salt: trimText(item.salt) || "",
      generalizeLength: Math.max(0, Number(item.generalizeLength || item.truncateLength || 0)),
    }))
    .filter((item) => item.sourceField && item.targetField);
}

function normalizeOutputFieldMappings(value) {
  return parseObjectArray(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      targetField: trimText(item.targetField),
    }))
    .filter((item) => item.sourceField && item.targetField);
}

function parseBooleanFlag(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = trimText(value).toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeStringAggregateRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      sourceField: trimText(item.sourceField),
      outputField: trimText(item.outputField),
      separator: item.separator === undefined || item.separator === null ? "," : String(item.separator),
      distinct: parseBooleanFlag(item.distinct, false),
    }))
    .filter((item) => item.sourceField && item.outputField);
}

function normalizeStringSplitConfig(value) {
  if (!value || typeof value !== "object") {
    return {
      sourceField: "",
      outputField: "",
      separator: ",",
      trimItems: true,
      keepEmptyItems: false,
      indexField: "",
    };
  }

  return {
    sourceField: trimText(value.sourceField),
    outputField: trimText(value.outputField),
    separator: value.separator === undefined || value.separator === null ? "," : String(value.separator),
    trimItems: parseBooleanFlag(value.trimItems, true),
    keepEmptyItems: parseBooleanFlag(value.keepEmptyItems, false),
    indexField: trimText(value.indexField),
  };
}

function buildSourceTimeLiteral(value, formatType) {
  const normalizedValue = value === undefined || value === null ? "" : String(value);
  if (!normalizedValue) {
    return "";
  }
  if (["epoch_seconds", "epoch_millis"].includes(trimText(formatType))) {
    const numericValue = Number(normalizedValue);
    return Number.isFinite(numericValue) ? String(Math.trunc(numericValue)) : escapeSqlLiteral(normalizedValue);
  }
  return escapeSqlLiteral(normalizedValue);
}

function buildSourceTimeFilterClauses(sourceAlias, filter, dialect) {
  const normalizedFilter = normalizeSourceTimeFilter(filter);
  if (!normalizedFilter.fieldName) {
    return [];
  }

  const fieldExpression = buildAliasReference(sourceAlias, normalizedFilter.fieldName, dialect);
  const clauses = [];
  if (normalizedFilter.startValue) {
    clauses.push(`${fieldExpression} >= ${buildSourceTimeLiteral(normalizedFilter.startValue, normalizedFilter.formatType)}`);
  }
  if (normalizedFilter.endValue) {
    clauses.push(`${fieldExpression} <= ${buildSourceTimeLiteral(normalizedFilter.endValue, normalizedFilter.formatType)}`);
  }
  return clauses;
}

function buildSequentialReplaceExpression(fieldExpression, replaceRules) {
  return replaceRules.reduce((currentExpression, rule) => {
    const matchValue = rule.matchValue === undefined || rule.matchValue === null ? "" : String(rule.matchValue);
    const replaceValue = rule.replaceValue === undefined || rule.replaceValue === null ? "" : String(rule.replaceValue);
    const condition = trimText(matchValue)
      ? `${currentExpression} = ${escapeSqlLiteral(matchValue)}`
      : `${currentExpression} IS NULL OR ${currentExpression} = ''`;
    return `CASE WHEN ${condition} THEN ${escapeSqlLiteral(replaceValue)} ELSE ${currentExpression} END`;
  }, fieldExpression);
}

function buildReplaceSelectList(columns, fieldName, replaceRules, dialect) {
  const sourceAlias = "source_data";
  const fieldExpression = buildAliasReference(sourceAlias, fieldName, dialect);
  const replacedExpression = buildSequentialReplaceExpression(fieldExpression, replaceRules);

  return columns
    .map((columnName) => {
      if (columnName !== fieldName) {
        return `${buildAliasReference(sourceAlias, columnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}`;
      }
      return `${replacedExpression} AS ${quoteIdentifier(columnName, dialect)}`;
    })
    .join(",\n");
}

function buildDerivedSelectPlan(inputColumns, rules, dialect, buildExpression) {
  const sourceAlias = "source_data";
  const derivedEntries = [];
  const targetColumns = [];

  rules.forEach((rule, index) => {
    const targetField = trimText(rule.targetField || rule.outputField || `field_${index + 1}`);
    if (!targetField) {
      return;
    }
    derivedEntries.push({
      targetField,
      expression: buildExpression(rule, sourceAlias),
    });
    targetColumns.push(targetField);
  });

  validateUniqueColumns(targetColumns, "transform", "字段加工");

  const entryMap = new Map(derivedEntries.map((item) => [item.targetField, item.expression]));
  const outputColumns = [];
  const selectSegments = [];

  inputColumns.forEach((columnName) => {
    const derivedExpression = entryMap.get(columnName);
    outputColumns.push(columnName);
    if (derivedExpression) {
      selectSegments.push(`${derivedExpression} AS ${quoteIdentifier(columnName, dialect)}`);
    } else {
      selectSegments.push(`${buildAliasReference(sourceAlias, columnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}`);
    }
  });

  derivedEntries.forEach((item) => {
    if (outputColumns.includes(item.targetField)) {
      return;
    }
    outputColumns.push(item.targetField);
    selectSegments.push(`${item.expression} AS ${quoteIdentifier(item.targetField, dialect)}`);
  });

  return {
    outputColumns,
    selectSql: selectSegments.join(",\n"),
  };
}

function toMysqlDatePattern(pattern) {
  const source = trimText(pattern) || "yyyy-MM-dd HH:mm:ss";
  return source
    .replace(/YYYY/g, "%Y")
    .replace(/yyyy/g, "%Y")
    .replace(/MM/g, "%m")
    .replace(/DD/g, "%d")
    .replace(/dd/g, "%d")
    .replace(/HH24/g, "%H")
    .replace(/HH/g, "%H")
    .replace(/hh/g, "%H")
    .replace(/MI/g, "%i")
    .replace(/mm/g, "%i")
    .replace(/SS/g, "%s")
    .replace(/ss/g, "%s");
}

function toPostgresDatePattern(pattern) {
  const source = trimText(pattern) || "YYYY-MM-DD HH24:MI:SS";
  return source
    .replace(/yyyy/g, "YYYY")
    .replace(/dd/g, "DD")
    .replace(/hh/g, "HH24")
    .replace(/mm/g, "MI")
    .replace(/ss/g, "SS");
}

function buildCastExpression(fieldExpression, targetType, dialect) {
  const normalizedDialect = normalizeDatasourceType(dialect);
  const normalizedType = trimText(targetType).toLowerCase();
  if (normalizedType === "integer") {
    const type = normalizedDialect === "oracle" ? "NUMBER(38)" : ["postgresql", "dm"].includes(normalizedDialect) ? "INTEGER" : "SIGNED";
    return `CAST(${fieldExpression} AS ${type})`;
  }
  if (normalizedType === "double") {
    const type = normalizedDialect === "oracle" ? "BINARY_DOUBLE" : normalizedDialect === "postgresql" ? "DOUBLE PRECISION" : "DOUBLE";
    return `CAST(${fieldExpression} AS ${type})`;
  }
  return `CAST(${fieldExpression} AS ${normalizedDialect === "oracle" ? "NUMBER(18,6)" : normalizedDialect === "postgresql" ? "NUMERIC(18,6)" : "DECIMAL(18,6)"})`;
}

function buildStringCastExpression(fieldExpression, dialect) {
  const normalizedDialect = normalizeDatasourceType(dialect);
  const targetType = normalizedDialect === "postgresql" ? "TEXT" : normalizedDialect === "oracle" ? "VARCHAR2(4000)" : normalizedDialect === "dm" ? "VARCHAR(4000)" : "CHAR";
  return `CAST(${fieldExpression} AS ${targetType})`;
}

function buildDateFormatExpression(fieldExpression, formatPattern, dialect) {
  const normalizedDialect = normalizeDatasourceType(dialect);
  if (["postgresql", "oracle", "dm"].includes(normalizedDialect)) {
    return `TO_CHAR(${fieldExpression}, ${escapeSqlLiteral(toPostgresDatePattern(formatPattern))})`;
  }
  if (normalizedDialect === "clickhouse") {
    return `formatDateTime(${fieldExpression}, ${escapeSqlLiteral(toMysqlDatePattern(formatPattern))})`;
  }
  return `DATE_FORMAT(${fieldExpression}, ${escapeSqlLiteral(toMysqlDatePattern(formatPattern))})`;
}

function buildStringToDateExpression(fieldExpression, formatPattern, dialect, withTime) {
  const normalizedDialect = normalizeDatasourceType(dialect);
  if (["postgresql", "oracle", "dm"].includes(normalizedDialect)) {
    const parsed = withTime
      ? `TO_TIMESTAMP(${fieldExpression}, ${escapeSqlLiteral(toPostgresDatePattern(formatPattern))})`
      : `TO_DATE(${fieldExpression}, ${escapeSqlLiteral(toPostgresDatePattern(formatPattern || "YYYY-MM-DD"))})`;
    return withTime ? parsed : `CAST(${parsed} AS DATE)`;
  }

  const parsePattern = escapeSqlLiteral(toMysqlDatePattern(formatPattern));
  if (normalizedDialect === "clickhouse") {
    return withTime
      ? `parseDateTimeBestEffort(${fieldExpression})`
      : `toDate(parseDateTimeBestEffort(${fieldExpression}))`;
  }
  const parsed = `STR_TO_DATE(${fieldExpression}, ${parsePattern})`;
  return withTime ? parsed : `CAST(${parsed} AS DATE)`;
}

function buildRegexMatchExpression(fieldExpression, pattern, dialect) {
  const normalizedDialect = normalizeDatasourceType(dialect);
  if (["postgresql", "oracle", "dm"].includes(normalizedDialect)) {
    return normalizedDialect === "postgresql"
      ? `${fieldExpression} ~ ${escapeSqlLiteral(pattern)}`
      : `REGEXP_LIKE(${fieldExpression}, ${escapeSqlLiteral(pattern)})`;
  }
  return `${fieldExpression} REGEXP ${escapeSqlLiteral(pattern)}`;
}

function isNumericLiteral(value) {
  return /^-?\d+(\.\d+)?$/.test(trimText(value));
}

function normalizeFilterSubquerySql(value, dialect) {
  let sqlText = stripTrailingSemicolon(value);
  const wrappedMatch = sqlText.match(/^(?:not\s+)?in\s*\(([\s\S]*)\)$/i);
  if (wrappedMatch) {
    sqlText = stripTrailingSemicolon(wrappedMatch[1]);
  } else if (/^\([\s\S]*\)$/.test(sqlText)) {
    const innerSql = stripTrailingSemicolon(sqlText.slice(1, -1));
    if (/^(select|with)\b/i.test(innerSql)) {
      sqlText = innerSql;
    }
  }
  if (!sqlText || !/^(select|with)\b/i.test(sqlText)) {
    throw new AppError("IN / NOT IN 自定义 SQL 必须是返回单列结果的 SELECT 查询", 400);
  }

  const parsed = sqlParser.parseSql(sqlText, dialect);
  const statements = Array.isArray(parsed) ? parsed : [parsed];
  if (statements.length !== 1 || statements[0]?.type !== "select") {
    throw new AppError("IN / NOT IN 自定义 SQL 仅支持单条 SELECT 查询", 400);
  }
  const outputColumns = Array.isArray(statements[0]?.columns) ? statements[0].columns : [];
  const selectsWildcard = outputColumns.some((item) => item?.expr?.type === "column_ref" && item.expr.column === "*");
  if (outputColumns.length !== 1 || selectsWildcard) {
    throw new AppError("IN / NOT IN 自定义 SQL 必须明确返回一个字段", 400);
  }
  return sqlText;
}

function buildConditionRuleSqlExpression(rule, sourceAlias, dialect, options = {}) {
  const fieldExpression = buildAliasReference(sourceAlias, rule.fieldName, dialect);
  const textExpression = `COALESCE(${buildStringCastExpression(fieldExpression, dialect)}, '')`;
  const ruleType = trimText(rule.ruleType) || "condition";

  if (ruleType === "builtin") {
    const pattern = getValidationPattern(rule.checkType) || VALIDATION_PATTERN_MAP.phone;
    const matchExpression = buildRegexMatchExpression(textExpression, pattern, dialect);
    return trimText(rule.matchMode) === "invalid" ? `NOT (${matchExpression})` : matchExpression;
  }

  if (ruleType === "domain") {
    const domainValues = parseStringArray(rule.domainValues);
    if (!domainValues.length) {
      return "";
    }
    const inExpression = `${textExpression} IN (${domainValues.map((item) => escapeSqlLiteral(item)).join(", ")})`;
    return trimText(rule.matchMode) === "not_in" ? `NOT (${inExpression})` : inExpression;
  }

  const operator = trimText(rule.operator) || "eq";
  const valueText = trimText(rule.value);
  switch (operator) {
    case "ne":
      return `${textExpression} <> ${escapeSqlLiteral(valueText)}`;
    case "gt":
      return isNumericLiteral(valueText) ? `${fieldExpression} > ${Number(valueText)}` : `${textExpression} > ${escapeSqlLiteral(valueText)}`;
    case "gte":
      return isNumericLiteral(valueText) ? `${fieldExpression} >= ${Number(valueText)}` : `${textExpression} >= ${escapeSqlLiteral(valueText)}`;
    case "lt":
      return isNumericLiteral(valueText) ? `${fieldExpression} < ${Number(valueText)}` : `${textExpression} < ${escapeSqlLiteral(valueText)}`;
    case "lte":
      return isNumericLiteral(valueText) ? `${fieldExpression} <= ${Number(valueText)}` : `${textExpression} <= ${escapeSqlLiteral(valueText)}`;
    case "contains":
      return `${textExpression} LIKE ${escapeSqlLiteral(`%${valueText}%`)}`;
    case "starts_with":
      return `${textExpression} LIKE ${escapeSqlLiteral(`${valueText}%`)}`;
    case "ends_with":
      return `${textExpression} LIKE ${escapeSqlLiteral(`%${valueText}`)}`;
    case "in":
    case "not_in": {
      const operatorSql = operator === "not_in" ? "NOT IN" : "IN";
      const valueSource = trimText(rule.valueSource) || "literal";
      if (valueSource === "upstream_field") {
        const referenceField = trimText(rule.referenceField);
        const referenceNodeKey = trimText(rule.referenceNodeKey);
        const referencePlan = referenceNodeKey
          ? options.inputPlanMap?.get(referenceNodeKey)
          : options.primaryInputPlan;
        if (!referenceField || !referencePlan) {
          return "";
        }
        const referenceExpression = buildAliasReference("reference_data", referenceField, dialect);
        const comparableFieldExpression = buildStringCastExpression(fieldExpression, dialect);
        const comparableReferenceExpression = buildStringCastExpression(referenceExpression, dialect);
        const referenceSql = `SELECT ${comparableReferenceExpression}\nFROM ${buildPlanFromClause(referencePlan, dialect, "reference_data")}`;
        return `${comparableFieldExpression} ${operatorSql} (\n${indentSql(referenceSql, 2)}\n)`;
      }
      if (valueSource === "custom_sql") {
        const customSql = normalizeFilterSubquerySql(rule.customSql, dialect);
        return `${fieldExpression} ${operatorSql} (\n${indentSql(customSql, 2)}\n)`;
      }
      const values = parseStringArray(valueText);
      if (!values.length) {
        return "";
      }
      const inExpression = `${textExpression} IN (${values.map((item) => escapeSqlLiteral(item)).join(", ")})`;
      return operator === "not_in" ? `NOT (${inExpression})` : inExpression;
    }
    case "is_null":
      return `(${fieldExpression} IS NULL OR ${textExpression} = '')`;
    case "is_not_null":
      return `(${fieldExpression} IS NOT NULL AND ${textExpression} <> '')`;
    case "eq":
    default:
      return `${textExpression} = ${escapeSqlLiteral(valueText)}`;
  }
}

function buildRuleGroupConditionExpression(rules, logic, sourceAlias, dialect, options = {}) {
  const expressions = normalizeConditionRules(rules)
    .map((rule) => buildConditionRuleSqlExpression(rule, sourceAlias, dialect, options))
    .filter(Boolean);
  if (!expressions.length) {
    return "";
  }
  const connector = trimText(logic) === "any" ? " OR " : " AND ";
  return expressions.length === 1 ? expressions[0] : `(${expressions.join(connector)})`;
}

function resolveRuleGroupCondition(nodeConfig, rulesKey, logicKey, fallbackKeys, sourceAlias, dialect, options = {}) {
  const derivedExpression = buildRuleGroupConditionExpression(nodeConfig?.[rulesKey], nodeConfig?.[logicKey], sourceAlias, dialect, options);
  if (derivedExpression) {
    return derivedExpression;
  }
  const keys = Array.isArray(fallbackKeys) ? fallbackKeys : [fallbackKeys];
  for (const key of keys) {
    const value = trimText(nodeConfig?.[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

function buildFormatRuleExpression(rule, sourceAlias, dialect) {
  const fieldExpression = buildAliasReference(sourceAlias, rule.sourceField, dialect);
  switch (trimText(rule.transformType)) {
    case "datetime_to_string":
    case "date_to_string":
      return buildDateFormatExpression(fieldExpression, rule.formatPattern, dialect);
    case "string_to_number":
      return buildCastExpression(fieldExpression, rule.targetType, dialect);
    case "number_to_string":
      return buildStringCastExpression(fieldExpression, dialect);
    case "string_to_date":
      return buildStringToDateExpression(fieldExpression, rule.formatPattern, dialect, false);
    case "string_to_datetime":
      return buildStringToDateExpression(fieldExpression, rule.formatPattern, dialect, true);
    case "datetime_to_date":
      return `CAST(${fieldExpression} AS DATE)`;
    default:
      return fieldExpression;
  }
}

function buildValidationPredicateExpression(rule, sourceAlias, dialect) {
  const fieldExpression = buildAliasReference(sourceAlias, rule.sourceField, dialect);
  const textExpression = `COALESCE(${buildStringCastExpression(fieldExpression, dialect)}, '')`;
  const validationType = trimText(rule.validationType) || "builtin";

  if (validationType === "domain") {
    const values = parseStringArray(rule.domainValues);
    if (!values.length) {
      return "FALSE";
    }
    return `${textExpression} IN (${values.map((item) => escapeSqlLiteral(item)).join(", ")})`;
  }

  if (validationType === "regex") {
    const pattern = trimText(rule.customPattern);
    return pattern ? buildRegexMatchExpression(textExpression, pattern, dialect) : "FALSE";
  }

  if (validationType === "fixed_value") {
    return `${textExpression} = ${escapeSqlLiteral(trimText(rule.fixedValue))}`;
  }

  const pattern = getValidationPattern(rule.checkType) || VALIDATION_PATTERN_MAP.phone;
  return buildRegexMatchExpression(textExpression, pattern, dialect);
}

function buildComplianceRuleExpression(rule, sourceAlias, dialect) {
  const fieldExpression = buildAliasReference(sourceAlias, rule.sourceField, dialect);
  const matchedExpression = buildValidationPredicateExpression(rule, sourceAlias, dialect);
  const defaultValue = trimText(rule.defaultValue);
  if (trimText(rule.resultMode) === "value") {
    return `CASE WHEN ${matchedExpression} THEN ${fieldExpression} ELSE ${defaultValue ? escapeSqlLiteral(defaultValue) : "''"} END`;
  }
  if (defaultValue) {
    return `CASE WHEN ${matchedExpression} THEN 1 ELSE ${escapeSqlLiteral(defaultValue)} END`;
  }
  return `CASE WHEN ${matchedExpression} THEN 1 ELSE 0 END`;
}

function buildStringRuleExpression(rule, sourceAlias, dialect) {
  const fieldExpression = buildStringCastExpression(buildAliasReference(sourceAlias, rule.sourceField, dialect), dialect);
  const argument1 = trimText(rule.argument1);
  const argument2 = trimText(rule.argument2);
  switch (trimText(rule.transformType)) {
    case "trim":
      return `TRIM(${fieldExpression})`;
    case "remove_prefix":
      return `SUBSTRING(${fieldExpression}, ${Math.max(1, Number(argument1 || 0) + 1)})`;
    case "remove_suffix":
      return `SUBSTRING(${fieldExpression}, 1, GREATEST(CHAR_LENGTH(${fieldExpression}) - ${Math.max(0, Number(argument1 || 0))}, 0))`;
    case "substring":
      return argument2
        ? `SUBSTRING(${fieldExpression}, ${Math.max(1, Number(argument1 || 1))}, ${Math.max(0, Number(argument2 || 0))})`
        : `SUBSTRING(${fieldExpression}, ${Math.max(1, Number(argument1 || 1))})`;
    case "replace_text":
      return `REPLACE(${fieldExpression}, ${escapeSqlLiteral(argument1)}, ${escapeSqlLiteral(argument2)})`;
    case "upper":
      return `UPPER(${fieldExpression})`;
    case "lower":
      return `LOWER(${fieldExpression})`;
    default:
      return fieldExpression;
  }
}

function buildRepeatExpression(textExpression, countExpression, dialect) {
  return normalizeDatasourceType(dialect) === "oracle"
    ? `RPAD(${textExpression}, ${countExpression}, ${textExpression})`
    : `REPEAT(${textExpression}, ${countExpression})`;
}

function buildCharLengthExpression(fieldExpression, dialect) {
  return ["oracle", "dm"].includes(normalizeDatasourceType(dialect))
    ? `LENGTH(${fieldExpression})`
    : `CHAR_LENGTH(${fieldExpression})`;
}

function buildSubstringExpression(fieldExpression, start, length, dialect) {
  if (["oracle", "dm"].includes(normalizeDatasourceType(dialect))) {
    return length === undefined ? `SUBSTR(${fieldExpression}, ${start})` : `SUBSTR(${fieldExpression}, ${start}, ${length})`;
  }
  return length === undefined
    ? `SUBSTRING(${fieldExpression}, ${start})`
    : `SUBSTRING(${fieldExpression}, ${start}, ${length})`;
}

function buildDesensitizeRuleExpression(rule, sourceAlias, dialect) {
  const normalizedDialect = normalizeDatasourceType(dialect);
  const sourceExpression = buildStringCastExpression(buildAliasReference(sourceAlias, rule.sourceField, dialect), dialect);
  const maskType = trimText(rule.transform || rule.maskType) || "mask";
  if (maskType === "encrypt" || maskType === "hash") {
    const algorithm = trimText(rule.encryptAlgorithm || rule.hashAlgorithm) || "md5";
    const salt = trimText(rule.salt);
    const source = salt ? `CONCAT(COALESCE(${sourceExpression}, ''), '${salt.replace(/'/g, "''")}')` : `COALESCE(${sourceExpression}, '')`;
    return buildHashExpression(source, algorithm, dialect);
  }
  if (maskType === "replace") {
    const pattern = trimText(rule.replacePattern || rule.pattern);
    const replacement = String(rule.replaceValue ?? rule.replacement ?? "");
    if (!pattern) {
      throw new AppError(`步骤【${rule.stepName || rule.targetField}】缺少替换规则`, 400);
    }
    return buildRegexReplaceExpression(sourceExpression, pattern, replacement, dialect);
  }
  if (maskType === "generalize" || maskType === "truncate") {
    const length = Math.max(0, Number(rule.generalizeLength || rule.truncateLength || 0));
    return normalizedDialect === "postgresql"
      ? `SUBSTRING(COALESCE(${sourceExpression}, '') FROM 1 FOR ${length})`
      : `SUBSTR(COALESCE(${sourceExpression}, ''), 1, ${length})`;
  }

  const prefixLength = Math.max(0, Number(rule.prefixLength || 0));
  const suffixLength = Math.max(0, Number(rule.suffixLength || 0));
  const maskChar = escapeSqlLiteral(trimText(rule.maskChar) || "*");
  const fieldLength = buildCharLengthExpression(`COALESCE(${sourceExpression}, '')`, dialect);
  const visiblePrefix = prefixLength > 0 ? buildSubstringExpression(`COALESCE(${sourceExpression}, '')`, 1, prefixLength, dialect) : "''";
  const visibleSuffix = suffixLength > 0
    ? buildSubstringExpression(
      `COALESCE(${sourceExpression}, '')`,
      `GREATEST(${fieldLength} - ${suffixLength} + 1, 1)`,
      suffixLength,
      dialect
    )
    : "''";
  const maskLength = `GREATEST(${fieldLength} - ${prefixLength} - ${suffixLength}, 0)`;
  const repeatExpression = normalizedDialect === "oracle"
    ? `RPAD('${maskChar.replace(/'/g, "''")}', ${maskLength}, '${maskChar.replace(/'/g, "''")}')`
    : `REPEAT(${maskChar}, ${maskLength})`;
  return `CASE
    WHEN ${fieldLength} <= ${prefixLength + suffixLength} THEN COALESCE(${sourceExpression}, '')
    ELSE ${buildStringConcatExpression([visiblePrefix, repeatExpression, visibleSuffix], dialect)}
  END`;
}

function buildAggregateCaseExpression(aggregateFunction, conditionSql, valueExpression) {
  switch (trimText(aggregateFunction).toLowerCase()) {
    case "count":
      return `SUM(CASE WHEN ${conditionSql} THEN 1 ELSE 0 END)`;
    case "sum":
      return `SUM(CASE WHEN ${conditionSql} THEN ${valueExpression} ELSE NULL END)`;
    case "avg":
      return `AVG(CASE WHEN ${conditionSql} THEN ${valueExpression} ELSE NULL END)`;
    case "min":
      return `MIN(CASE WHEN ${conditionSql} THEN ${valueExpression} ELSE NULL END)`;
    case "max":
    default:
      return `MAX(CASE WHEN ${conditionSql} THEN ${valueExpression} ELSE NULL END)`;
  }
}

function normalizeSqlInputBindings(value, inputPlans, nodeName) {
  const bindingMap = new Map(
    parseObjectArray(value)
      .map((item) => ({
        sourceNodeKey: trimText(item.sourceNodeKey),
        alias: trimText(item.alias),
      }))
      .filter((item) => item.sourceNodeKey || item.alias)
      .map((item) => [item.sourceNodeKey, item.alias])
  );

  const aliasSet = new Set();
  return inputPlans.map((plan, index) => {
    const defaultAlias = `temp${index + 1}`;
    const fallbackAlias = `input_${index + 1}`;
    const alias = trimText(bindingMap.get(plan.nodeKey) || defaultAlias);
    if (!alias) {
      throw new AppError(`Custom SQL node ${nodeName} has an empty upstream alias`, 400);
    }
    if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(alias)) {
      throw new AppError(
        `Custom SQL node ${nodeName} alias ${alias} must start with a letter or underscore and contain only letters, digits, or underscores`,
        400
      );
    }
    if (aliasSet.has(alias)) {
      throw new AppError(`Custom SQL node ${nodeName} contains duplicate upstream alias ${alias}`, 400);
    }
    aliasSet.add(alias);
    return {
      sourceNodeKey: plan.nodeKey,
      alias,
      fallbackAlias,
    };
  });
}

function normalizeAggregationRules(value) {
  return parseObjectArray(value)
    .map((item) => ({
      aggregateFunction: normalizeSqlName(item.aggregateFunction || item.func || "count", "count"),
      fieldName: trimText(item.fieldName),
      alias: trimText(item.alias),
    }))
    .filter((item) => item.aggregateFunction);
}

function buildDefaultAggregateAlias(rule) {
  const fieldPart = rule.fieldName && rule.fieldName !== "__all__" ? rule.fieldName : "rows";
  return `${rule.aggregateFunction}_${fieldPart}`;
}

function buildAggregateExpression(rule, sourceAlias, dialect) {
  const normalizedFunction = trimText(rule.aggregateFunction).toLowerCase();
  const fieldName = trimText(rule.fieldName);
  const targetField = fieldName && fieldName !== "__all__" ? buildAliasReference(sourceAlias, fieldName, dialect) : "*";
  switch (normalizedFunction) {
    case "count":
      return fieldName && fieldName !== "__all__" ? `COUNT(${targetField})` : "COUNT(*)";
    case "count_distinct":
      if (!fieldName || fieldName === "__all__") {
        throw new AppError("聚合统计节点的 COUNT DISTINCT 必须选择目标字段", 400);
      }
      return `COUNT(DISTINCT ${targetField})`;
    case "sum":
      if (!fieldName || fieldName === "__all__") {
        throw new AppError("聚合统计节点的 SUM 必须选择目标字段", 400);
      }
      return `SUM(${targetField})`;
    case "avg":
      if (!fieldName || fieldName === "__all__") {
        throw new AppError("聚合统计节点的 AVG 必须选择目标字段", 400);
      }
      return `AVG(${targetField})`;
    case "max":
      if (!fieldName || fieldName === "__all__") {
        throw new AppError("聚合统计节点的 MAX 必须选择目标字段", 400);
      }
      return `MAX(${targetField})`;
    case "min":
      if (!fieldName || fieldName === "__all__") {
        throw new AppError("聚合统计节点的 MIN 必须选择目标字段", 400);
      }
      return `MIN(${targetField})`;
    default:
      throw new AppError(`聚合统计节点暂不支持函数: ${rule.aggregateFunction}`, 400);
  }
}

function buildSqlStringExpression(fieldExpression, dialect) {
  const normalizedDialect = normalizeDatasourceType(dialect);
  if (normalizedDialect === "postgresql") {
    return `CAST(${fieldExpression} AS TEXT)`;
  }
  if (normalizedDialect === "oracle") return `CAST(${fieldExpression} AS VARCHAR2(4000))`;
  if (normalizedDialect === "dm") return `CAST(${fieldExpression} AS VARCHAR(4000))`;
  if (normalizedDialect === "clickhouse") {
    return `toString(${fieldExpression})`;
  }
  if (normalizedDialect === "hive") {
    return `CAST(${fieldExpression} AS STRING)`;
  }
  return `CAST(${fieldExpression} AS CHAR)`;
}

function buildStringAggregateExpression(rule, sourceAlias, dialect) {
  const normalizedDialect = normalizeDatasourceType(dialect);
  const fieldExpression = buildSqlStringExpression(buildAliasReference(sourceAlias, rule.sourceField, dialect), dialect);
  const separator = escapeSqlLiteral(rule.separator === undefined || rule.separator === null ? "," : String(rule.separator));
  const distinctSql = rule.distinct ? "DISTINCT " : "";

  if (normalizedDialect === "postgresql") {
    return `STRING_AGG(${distinctSql}${fieldExpression}, ${separator})`;
  }
  if (["oracle", "dm"].includes(normalizedDialect)) {
    return `LISTAGG(${distinctSql}${fieldExpression}, ${separator}) WITHIN GROUP (ORDER BY ${fieldExpression})`;
  }
  if (normalizedDialect === "clickhouse") {
    return `arrayStringConcat(${rule.distinct ? "groupUniqArray" : "groupArray"}(${fieldExpression}), ${separator})`;
  }
  if (normalizedDialect === "hive") {
    return `concat_ws(${separator}, ${rule.distinct ? "collect_set" : "collect_list"}(${fieldExpression}))`;
  }
  return `GROUP_CONCAT(${distinctSql}${fieldExpression} SEPARATOR ${separator})`;
}

function buildStringSplitOutputColumns(inputColumns, sourceField, outputField, indexField) {
  const columns = inputColumns.map((columnName) => (
    columnName === sourceField
      ? outputField
      : columnName
  ));
  if (!columns.includes(outputField)) {
    columns.push(outputField);
  }
  if (indexField) {
    columns.push(indexField);
  }
  return columns;
}

function buildStringSplitSelectSegments(inputColumns, sourceField, outputField, indexField, splitValueExpression, splitIndexExpression, dialect) {
  const selectSegments = [];
  const emitted = new Set();

  inputColumns.forEach((columnName) => {
    if (columnName === sourceField) {
      if (!emitted.has(outputField)) {
        selectSegments.push(`${splitValueExpression} AS ${quoteIdentifier(outputField, dialect)}`);
        emitted.add(outputField);
      }
      return;
    }
    selectSegments.push(`${buildAliasReference("source_data", columnName, dialect)} AS ${quoteIdentifier(columnName, dialect)}`);
    emitted.add(columnName);
  });

  if (!emitted.has(outputField)) {
    selectSegments.push(`${splitValueExpression} AS ${quoteIdentifier(outputField, dialect)}`);
    emitted.add(outputField);
  }

  if (indexField) {
    selectSegments.push(`${splitIndexExpression} AS ${quoteIdentifier(indexField, dialect)}`);
  }

  return selectSegments;
}

function buildStringSplitSql(plan, inputColumns, splitConfig, dialect) {
  const normalizedDialect = normalizeDatasourceType(dialect);
  if (["oracle", "dm"].includes(normalizedDialect)) {
    throw new AppError(`当前 ${normalizedDialect === "oracle" ? "Oracle" : "达梦数据库"} 暂不支持字符串拆分算子`, 400);
  }
  const { sourceField, outputField, separator, trimItems, keepEmptyItems, indexField } = splitConfig;
  const sourceExpression = `COALESCE(${buildSqlStringExpression(buildAliasReference("source_data", sourceField, dialect), dialect)}, '')`;
  const postgresSplitArrayExpression = `string_to_array(${sourceExpression}, ${escapeSqlLiteral(separator)})`;
  const splitValueExpression = normalizedDialect === "postgresql"
    ? (trimItems ? `BTRIM(${postgresSplitArrayExpression}[split_data.generate_series])` : `${postgresSplitArrayExpression}[split_data.generate_series]`)
    : normalizedDialect === "clickhouse"
      ? (trimItems ? "trim(tupleElement(split_data, 2))" : "tupleElement(split_data, 2)")
      : (trimItems ? "TRIM(split_data.item)" : "split_data.item");
  const splitIndexExpression = normalizedDialect === "clickhouse"
    ? "tupleElement(split_data, 1)"
    : normalizedDialect === "hive"
      ? "(split_data.item_index + 1)"
      : "split_data.generate_series";
  const selectSegments = buildStringSplitSelectSegments(
    inputColumns,
    sourceField,
    outputField,
    indexField,
    splitValueExpression,
    splitIndexExpression,
    dialect
  );
  const whereClause = keepEmptyItems ? "" : `\nWHERE ${splitValueExpression} <> ''`;

  if (normalizedDialect === "postgresql") {
    return `SELECT\n${indentSql(selectSegments.join(",\n"), 2)}\nFROM ${buildPlanFromClause(plan, dialect, "source_data")}\nCROSS JOIN generate_series(1, COALESCE(array_length(${postgresSplitArrayExpression}, 1), 0)) AS split_data${whereClause}`;
  }

  if (normalizedDialect === "clickhouse") {
    const splitArrayExpression = `splitByString(${escapeSqlLiteral(separator)}, ${sourceExpression})`;
    return `SELECT\n${indentSql(selectSegments.join(",\n"), 2)}\nFROM ${buildPlanFromClause(plan, dialect, "source_data")}\nARRAY JOIN arrayZip(arrayEnumerate(${splitArrayExpression}), ${splitArrayExpression}) AS split_data${whereClause}`;
  }

  if (normalizedDialect === "hive") {
    return `SELECT\n${indentSql(selectSegments.join(",\n"), 2)}\nFROM ${buildPlanFromClause(plan, dialect, "source_data")}\nLATERAL VIEW posexplode(split(${sourceExpression}, ${escapeSqlLiteral(separator)})) split_data AS item_index, item${whereClause}`;
  }

  const jsonArrayExpression = `CONCAT('["', REPLACE(REPLACE(REPLACE(${sourceExpression}, '\\\\', '\\\\\\\\'), '"', '\\\\"'), ${escapeSqlLiteral(separator)}, '","'), '"]')`;
  return `SELECT\n${indentSql(selectSegments.join(",\n"), 2)}\nFROM ${buildPlanFromClause(plan, dialect, "source_data")}\nJOIN JSON_TABLE(\n${indentSql(`${jsonArrayExpression},\n'$[*]' COLUMNS (\n  item_index FOR ORDINALITY,\n  item VARCHAR(2048) PATH '$'\n)`, 2)}\n) AS ${quoteIdentifier("split_data", dialect)}${whereClause}`;
}

function resolveSourceRelation(node, dialect, fallbackDatabaseName) {
  const tableName = trimText(node.nodeConfig?.tableName);
  if (!tableName) {
    throw new AppError(`Source node ${node.nodeName} must configure a table name`, 400);
  }

  if (tableName.includes(".")) {
    return quoteIdentifier(tableName, dialect);
  }

  const databaseName = trimText(node.nodeConfig?.databaseName || fallbackDatabaseName);
  const normalizedDialect = normalizeDatasourceType(dialect);
  if (databaseName && ["mysql", "oracle", "dm", "clickhouse", "hive"].includes(normalizedDialect)) {
    return quoteIdentifier(`${databaseName}.${tableName}`, dialect);
  }

  return quoteIdentifier(tableName, dialect);
}

function resolveFinalPlan(compiledPlans, compiledPlanMap, outgoing, warnings, targetNodeKey) {
  if (targetNodeKey) {
    const targetPlan = compiledPlanMap.get(targetNodeKey);
    if (!targetPlan) {
      throw new AppError(`编排任务中不存在节点 ${targetNodeKey}`, 404);
    }
    return targetPlan;
  }

  const outputPlans = compiledPlans.filter((item) => item.nodeType === "output");
  if (outputPlans.length) {
    if (outputPlans.length > 1) {
      warnings.push("当前画布存在多个输出节点，SQL 预览默认展示最后一个输出节点。");
    }
    return outputPlans[outputPlans.length - 1];
  }

  const leafPlans = compiledPlans.filter((item) => !(outgoing.get(item.nodeKey) || []).length);
  if (leafPlans.length > 1) {
    warnings.push("当前画布存在多个末端节点，SQL 预览默认展示最后一个末端节点。");
  }

  return leafPlans[leafPlans.length - 1] || compiledPlans[compiledPlans.length - 1] || null;
}

function collectLineageNodeKeys(targetNodeKey, incoming) {
  const visited = new Set();
  const stack = [targetNodeKey];

  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const edge of incoming.get(current) || []) {
      stack.push(edge.sourceNodeKey);
    }
  }

  return visited;
}

async function compilePlans(task, options = {}) {
  const allNodes = Array.isArray(task?.nodes) ? task.nodes : [];
  const rawEdges = Array.isArray(task?.edges) ? task.edges : [];
  const activeEdges = filterActiveEdges(rawEdges);
  if (!allNodes.length) {
    throw new AppError("数据编排任务暂无节点，无法生成 SQL 预览", 400);
  }

  const allNodeMap = new Map(allNodes.map((node) => [node.nodeKey, node]));
  const { incoming: fullIncoming } = buildEdgeMaps(activeEdges);
  if (options.targetNodeKey && !allNodeMap.has(options.targetNodeKey)) {
    throw new AppError(`编排任务中不存在节点 ${options.targetNodeKey}`, 404);
  }

  const scopedNodeKeys = options.targetNodeKey ? collectLineageNodeKeys(options.targetNodeKey, fullIncoming) : null;
  const nodes = scopedNodeKeys ? allNodes.filter((node) => scopedNodeKeys.has(node.nodeKey)) : allNodes;
  const edges = scopedNodeKeys
    ? activeEdges.filter((edge) => scopedNodeKeys.has(edge.sourceNodeKey) && scopedNodeKeys.has(edge.targetNodeKey))
    : activeEdges;
  const executionOrder = scheduler.buildTopologicalOrder(nodes, edges);
  const nodeMap = new Map(nodes.map((node) => [node.nodeKey, node]));
  const { incoming, outgoing } = buildEdgeMaps(edges);
  const warnings = [];
  const dialect = normalizeDatasourceType(options.dialect || task.datasourceType || "mysql");
  const pausedEdgesInScope = rawEdges.filter(
    (edge) =>
      normalizeOrchestrationEdgeStatus(edge?.edgeStatus) !== "active" &&
      (!scopedNodeKeys || scopedNodeKeys.has(edge.sourceNodeKey) || scopedNodeKeys.has(edge.targetNodeKey))
  );
  if (pausedEdgesInScope.length) {
    warnings.push("当前画布包含已暂停的连线，SQL 预览和节点预览将自动忽略这些路径。");
  }
  const sourceDatasourceIds = uniqueValues(
    nodes
      .filter((node) => node.nodeType === "source")
      .map((node) => Number(node.nodeConfig?.datasourceId || task.datasourceId || options.datasourceId || 0))
      .filter((value) => Number.isFinite(value) && value > 0)
  );

  if (sourceDatasourceIds.length > 1) {
    throw new AppError("当前阶段 SQL 预览仅支持单数据源编排。", 400);
  }

  const sourceColumnCache = new Map();
  const compiledPlans = [];
  const compiledPlanMap = new Map();

  async function loadSourceColumns(node) {
    const datasourceId = Number(node.nodeConfig?.datasourceId || task.datasourceId || options.datasourceId || 0);
    const databaseName = trimText(node.nodeConfig?.databaseName || task.databaseName || options.databaseName);
    const tableName = trimText(node.nodeConfig?.tableName);
    if (!datasourceId || !tableName || typeof options.loadSourceColumns !== "function") {
      return [];
    }

    const cacheKey = [datasourceId, databaseName, tableName].join("::");
    if (!sourceColumnCache.has(cacheKey)) {
      const columns = await options.loadSourceColumns({
        datasourceId,
        databaseName,
        tableName,
      });
      sourceColumnCache.set(
        cacheKey,
        Array.isArray(columns)
          ? columns.map((item) => String(item.name || "").trim()).filter(Boolean)
          : []
      );
    }
    return sourceColumnCache.get(cacheKey) || [];
  }

  for (let index = 0; index < executionOrder.length; index += 1) {
    const nodeKey = executionOrder[index];
    const node = nodeMap.get(nodeKey);
    if (!node) continue;

    const inputPlans = decorateIncomingPlans(incoming.get(nodeKey) || [], compiledPlanMap, nodeMap, dialect);
    const nodeConfig = node.nodeConfig || {};
    const cteName = `cte_${String(index + 1).padStart(2, "0")}_${normalizeSqlName(node.nodeKey, node.nodeType)}`;
    let sql = "";
    let columns = [];
    let relationName = null;

    if (node.nodeType === "source") {
      relationName = resolveSourceRelation(node, dialect, task.databaseName || options.databaseName);
      const sourceColumns = await loadSourceColumns(node);
      const selectedColumns = parseStringArray(nodeConfig.selectedColumns);
      const sourceTimeFilter = normalizeSourceTimeFilter(nodeConfig.sourceTimeFilter);
      if (sourceColumns.length && selectedColumns.length) {
        validateKnownColumns(sourceColumns, selectedColumns, node.nodeName, "数据输入");
        validateUniqueColumns(selectedColumns, node.nodeName, "数据输入");
      } else if (selectedColumns.length) {
        validateUniqueColumns(selectedColumns, node.nodeName, "数据输入");
      }
      if (sourceColumns.length && sourceTimeFilter.fieldName) {
        validateKnownColumns(sourceColumns, [sourceTimeFilter.fieldName], node.nodeName, "数据范围");
      }

      columns = selectedColumns.length ? selectedColumns.slice() : sourceColumns.slice();
      const fromClause = `${relationName} AS ${quoteIdentifier("source_data", dialect)}`;
      sql = columns.length
        ? `SELECT\n${indentSql(buildProjectionSelectList("source_data", columns, dialect), 2)}\nFROM ${fromClause}`
        : `SELECT *\nFROM ${fromClause}`;

      const timeFilterClauses = buildSourceTimeFilterClauses("source_data", sourceTimeFilter, dialect);
      if (timeFilterClauses.length) {
        sql = `${sql}\nWHERE ${timeFilterClauses.join("\n  AND ")}`;
      }
    } else if (node.nodeType === "output") {
      if (inputPlans.length !== 1) {
        throw new AppError(`Output node ${node.nodeName} must have exactly one upstream node`, 400);
      }
      relationName = trimText(nodeConfig.targetTable) || null;
      const outputFieldMappings = normalizeOutputFieldMappings(nodeConfig.outputFieldMappings);
      const inputColumns = inputPlans[0].columns.slice();
      if (outputFieldMappings.length) {
        validateKnownColumns(inputColumns, outputFieldMappings.map((item) => item.sourceField), node.nodeName, "输出字段映射");
        validateUniqueColumns(outputFieldMappings.map((item) => item.targetField), node.nodeName, "输出字段映射");
        columns = outputFieldMappings.map((item) => item.targetField);
        sql = `SELECT\n${indentSql(
          outputFieldMappings
            .map((item) => `${buildAliasReference("source_data", item.sourceField, dialect)} AS ${quoteIdentifier(item.targetField, dialect)}`)
            .join(",\n"),
          2
        )}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
      } else {
        columns = inputColumns;
        sql = `SELECT *\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
      }
      if (!relationName) {
        warnings.push(`输出节点 ${node.nodeName} 尚未配置目标表，本次仅生成预览 SQL。`);
      }
    } else if (node.nodeType === "operator") {
      switch (node.operatorCode) {
        case "filter": {
          if (!inputPlans.length) {
            throw new AppError(`Filter node ${node.nodeName} must have at least one upstream node`, 400);
          }
          const primaryInputPlan = inputPlans.find((plan) => plan.nodeKey === trimText(nodeConfig.schemaSourceNodeKey)) || inputPlans[0];
          const inputPlanMap = new Map(inputPlans.map((plan) => [plan.nodeKey, plan]));
          const conditionRules = normalizeConditionRules(nodeConfig.filterRules);
          if (conditionRules.length) {
            validateKnownColumns(primaryInputPlan.columns.slice(), conditionRules.map((item) => item.fieldName), node.nodeName, "数据过滤");
            const upstreamFieldRules = conditionRules
              .filter((item) => ["in", "not_in"].includes(item.operator) && item.valueSource === "upstream_field");
            for (const rule of upstreamFieldRules) {
              if (!rule.referenceField) {
                throw new AppError(`数据过滤节点 ${node.nodeName} 的上游字段取值方式必须选择字段`, 400);
              }
              const referencePlan = rule.referenceNodeKey
                ? inputPlanMap.get(rule.referenceNodeKey)
                : primaryInputPlan;
              if (!referencePlan) {
                throw new AppError(`数据过滤节点 ${node.nodeName} 引用的上游节点 ${rule.referenceNodeKey} 未连接`, 400);
              }
              validateKnownColumns(referencePlan.columns.slice(), [rule.referenceField], node.nodeName, "数据过滤上游字段");
            }
            const missingCustomSql = conditionRules.some(
              (item) => ["in", "not_in"].includes(item.operator) && item.valueSource === "custom_sql" && !trimText(item.customSql)
            );
            if (missingCustomSql) {
              throw new AppError(`数据过滤节点 ${node.nodeName} 的自定义 SQL 不能为空`, 400);
            }
          }
          const condition = resolveRuleGroupCondition(
            nodeConfig,
            "filterRules",
            "filterLogic",
            ["filterCondition", "configText"],
            "source_data",
            dialect,
            { primaryInputPlan, inputPlanMap }
          );
          if (!condition) {
            throw new AppError(`Filter node ${node.nodeName} must configure a filter condition`, 400);
          }
          columns = primaryInputPlan.columns.slice();
          sql = `SELECT *\nFROM ${buildPlanFromClause(primaryInputPlan, dialect, "source_data")}\nWHERE ${condition}`;
          break;
        }
        case "deduplicate": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Deduplicate node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const keys = parseStringArray(nodeConfig.dedupeKeys || nodeConfig.configText);
          if (!keys.length) {
            throw new AppError(`Deduplicate node ${node.nodeName} must configure at least one dedupe key`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          const sortRules = normalizeSortRules(nodeConfig.dedupeSortFields);
          if (!sortRules.length) {
            throw new AppError(`Deduplicate node ${node.nodeName} must configure at least one sort field`, 400);
          }
          validateKnownColumns(inputColumns, keys, node.nodeName, "数据去重");

          const partitionBy = keys.map((item) => buildAliasReference("source_data", item, dialect)).join(", ");
          validateKnownColumns(inputColumns, sortRules.map((item) => item.fieldName), node.nodeName, "sort");
          const keepStrategy = trimText(nodeConfig.keepStrategy) || "first";
          const orderBy = sortRules
            .map((item) => {
              const direction = keepStrategy === "last"
                ? (item.direction === "DESC" ? "ASC" : "DESC")
                : item.direction;
              return `${buildAliasReference("source_data", item.fieldName, dialect)} ${direction}`;
            })
            .join(", ");
          if (false) {
            warnings.push(`去重节点 ${node.nodeName} 暂未配置排序字段，SQL 预览按去重键排序生成。`);
          }

          columns = inputColumns;
          sql = `SELECT *\nFROM (\n  SELECT\n    source_data.*,\n    ROW_NUMBER() OVER (\n      PARTITION BY ${partitionBy}\n      ORDER BY ${orderBy}\n    ) AS ${quoteIdentifier("__medata_rn", dialect)}\n  FROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}\n) AS ${quoteIdentifier("dedupe_data", dialect)}\nWHERE ${quoteIdentifier("__medata_rn", dialect)} = 1`;
          break;
        }
        case "select_columns": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Select Columns node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const selectedColumns = parseStringArray(nodeConfig.selectedColumns || nodeConfig.configText);
          if (!selectedColumns.length) {
            throw new AppError(`字段选择节点 ${node.nodeName} 至少要选择一个字段`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          validateKnownColumns(inputColumns, selectedColumns, node.nodeName, "字段选择");
          validateUniqueColumns(selectedColumns, node.nodeName, "字段选择");

          columns = selectedColumns.slice();
          sql = `SELECT\n${indentSql(buildProjectionSelectList("source_data", selectedColumns, dialect), 2)}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
          break;
        }
        case "rename_fields": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Rename Fields node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const renameMappings = normalizeRenameMappings(nodeConfig.renameMappings);
          if (!renameMappings.length) {
            throw new AppError(`字段重命名节点 ${node.nodeName} 至少要配置一条映射`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          validateKnownColumns(inputColumns, renameMappings.map((item) => item.sourceField), node.nodeName, "字段重命名");
          validateUniqueColumns(renameMappings.map((item) => item.sourceField), node.nodeName, "字段重命名");
          validateUniqueColumns(renameMappings.map((item) => item.targetField), node.nodeName, "字段重命名");

          const { outputColumns, selectSql } = buildRenameSelectList(inputColumns, renameMappings, dialect);
          validateUniqueColumns(outputColumns, node.nodeName, "字段重命名");
          columns = outputColumns;
          sql = `SELECT\n${indentSql(selectSql, 2)}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
          break;
        }
        case "sort": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Sort node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const sortRules = normalizeSortRules(nodeConfig.sortFields);
          if (!sortRules.length) {
            throw new AppError(`排序节点 ${node.nodeName} 至少要配置一个排序字段`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          validateKnownColumns(inputColumns, sortRules.map((item) => item.fieldName), node.nodeName, "排序");

          columns = inputColumns;
          sql = `SELECT *\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}\nORDER BY ${sortRules.map((item) => `${quoteIdentifier(item.fieldName, dialect)} ${item.direction}`).join(", ")}`;
          break;
        }
        case "limit_rows": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Limit Rows node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const limitCount = sanitizePreviewLimit(nodeConfig.limitCount, 100);
          columns = inputPlans[0].columns.slice();
          const baseSql = `SELECT *\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
          sql = normalizedDialect === "oracle"
            ? `SELECT * FROM (\n${indentSql(baseSql, 2)}\n) WHERE ROWNUM <= ${limitCount}`
            : normalizedDialect === "dm"
              ? `${baseSql}\nFETCH FIRST ${limitCount} ROWS ONLY`
              : `${baseSql}\nLIMIT ${limitCount}`;
          break;
        }
        case "branch": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Branch node ${node.nodeName} must have exactly one upstream node`, 400);
          }
          const branchRules = normalizeConditionRules(nodeConfig.branchRules);
          if (branchRules.length) {
            validateKnownColumns(inputPlans[0].columns.slice(), branchRules.map((item) => item.fieldName), node.nodeName, "分支判断");
          }

          const branchCondition = resolveBranchCondition(nodeConfig, "source_data", dialect);
          if (!branchCondition) {
            throw new AppError(`Branch node ${node.nodeName} must configure a branch condition`, 400);
          }

          columns = inputPlans[0].columns.slice();
          sql = `SELECT *\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
          break;
        }
        case "union": {
          if (inputPlans.length < 2) {
            throw new AppError(`Union node ${node.nodeName} must have at least two upstream nodes`, 400);
          }

          const unionKeyword = trimText(nodeConfig.unionMode) === "distinct" ? "UNION" : "UNION ALL";
          const columnMappings = normalizeColumnAlignmentRows(nodeConfig.columnMappings);
          if (columnMappings.length) {
            columns = columnMappings.map((row, index) => trimText(row.outputField) || `field_${index + 1}`);
            validateUniqueColumns(columns, node.nodeName, "并集");
            sql = inputPlans
              .map((item) => {
                if (item.columns.length) {
                  const referencedFields = columnMappings
                    .map((row) => trimText((row.bindings || []).find((binding) => binding.sourceNodeKey === item.nodeKey)?.fieldName))
                    .filter(Boolean);
                  if (referencedFields.length) {
                    validateKnownColumns(item.columns, referencedFields, `${node.nodeName} / ${item.nodeName}`, "并集");
                  }
                }

                const selectSegments = columnMappings.map((row, rowIndex) => {
                  const outputField = columns[rowIndex];
                  const binding = (row.bindings || []).find((current) => current.sourceNodeKey === item.nodeKey);
                  const fieldName = trimText(binding?.fieldName);
                  return fieldName
                    ? `${buildAliasReference("source_data", fieldName, dialect)} AS ${quoteIdentifier(outputField, dialect)}`
                    : `NULL AS ${quoteIdentifier(outputField, dialect)}`;
                });
                return `SELECT\n${indentSql(selectSegments.join(",\n"), 2)}\nFROM ${buildPlanFromClause(item, dialect, "source_data")}`;
              })
              .join(`\n${unionKeyword}\n`);
          } else {
            const alignMode = trimText(nodeConfig.alignMode) || "by_name";
            const mergedColumns = mergeColumns(inputPlans.map((item) => item.columns || []));
            if (alignMode === "by_name" && mergedColumns.length) {
              columns = mergedColumns;
              sql = inputPlans
                .map((item) => `SELECT\n${indentSql(buildNamedSelectList("source_data", columns, item.columns, dialect), 2)}\nFROM ${buildPlanFromClause(item, dialect, "source_data")}`)
                .join(`\n${unionKeyword}\n`);
              if (inputPlans.some((item) => !item.columns.length)) {
                warnings.push(`并集节点 ${node.nodeName} 存在未识别字段结构的输入，系统已按可识别字段自动补空列。`);
              }
            } else {
              const positionalColumns = (inputPlans.find((item) => item.columns.length)?.columns || []).slice();
              if (positionalColumns.length) {
                columns = positionalColumns;
                sql = inputPlans
                  .map((item) => `SELECT\n${indentSql(buildPositionalSelectList("source_data", columns, item.columns || [], dialect), 2)}\nFROM ${buildPlanFromClause(item, dialect, "source_data")}`)
                  .join(`\n${unionKeyword}\n`);
                if (inputPlans.some((item) => item.columns.length !== columns.length)) {
                  warnings.push(`并集节点 ${node.nodeName} 已按字段顺序自动补齐空列。`);
                }
              } else {
                columns = inputPlans[0].columns.slice();
                sql = inputPlans
                  .map((item) => `SELECT *\nFROM ${buildPlanFromClause(item, dialect, "source_data")}`)
                  .join(`\n${unionKeyword}\n`);
                warnings.push(`并集节点 ${node.nodeName} 未拿到完整字段结构，已回退为原始 ${unionKeyword} 预览。`);
              }
            }
          }

          break;
        }
        case "intersect": {
          if (inputPlans.length < 2) {
            throw new AppError(`Intersect node ${node.nodeName} must have at least two upstream nodes`, 400);
          }

          const alignMode = trimText(nodeConfig.alignMode) || "by_name";
          const mergedColumns = mergeColumns(inputPlans.map((item) => item.columns || []));
          if (alignMode === "by_name" && mergedColumns.length) {
            columns = mergedColumns;
            sql = inputPlans
              .map((item) => `SELECT\n${indentSql(buildNamedSelectList("source_data", columns, item.columns, dialect), 2)}\nFROM ${buildPlanFromClause(item, dialect, "source_data")}`)
              .join("\nINTERSECT\n");
            if (inputPlans.some((item) => !item.columns.length)) {
              warnings.push(`交集节点 ${node.nodeName} 存在未识别字段结构的输入，系统已按可识别字段自动补空列。`);
            }
          } else {
            const positionalColumns = (inputPlans.find((item) => item.columns.length)?.columns || []).slice();
            if (positionalColumns.length) {
              columns = positionalColumns;
              sql = inputPlans
                .map((item) => `SELECT\n${indentSql(buildPositionalSelectList("source_data", columns, item.columns || [], dialect), 2)}\nFROM ${buildPlanFromClause(item, dialect, "source_data")}`)
                .join("\nINTERSECT\n");
              if (inputPlans.some((item) => item.columns.length !== columns.length)) {
                warnings.push(`交集节点 ${node.nodeName} 已按字段顺序自动补齐空列。`);
              }
            } else {
              columns = inputPlans[0].columns.slice();
              sql = inputPlans
                .map((item) => `SELECT *\nFROM ${buildPlanFromClause(item, dialect, "source_data")}`)
                .join("\nINTERSECT\n");
              warnings.push(`交集节点 ${node.nodeName} 未拿到完整字段结构，已回退为原始 INTERSECT 预览。`);
            }
          }
          break;
        }
        case "replace": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Replace node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const fieldName = trimText(nodeConfig.fieldName);
          if (!fieldName) {
            throw new AppError(`Replace node ${node.nodeName} must configure a target field`, 400);
          }
          const replaceRules = normalizeReplaceRules(nodeConfig.replaceRules, nodeConfig.matchValue, nodeConfig.replaceValue);
          if (!replaceRules.length) {
            throw new AppError(`Replace node ${node.nodeName} must configure at least one replace rule`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          validateKnownColumns(inputColumns, [fieldName], node.nodeName, "字段值替换");

          columns = inputColumns;
          sql = `SELECT\n${indentSql(buildReplaceSelectList(inputColumns, fieldName, replaceRules, dialect), 2)}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
          break;
        }
        case "join": {
          if (inputPlans.length !== 2) {
            throw new AppError(`Join node ${node.nodeName} must have exactly two upstream nodes`, 400);
          }

          const leftPlan = inputPlans[0];
          const rightPlan = inputPlans[1];
          const joinType = trimText(nodeConfig.joinType) || "left";
          const joinKeys = normalizeJoinKeyRules(nodeConfig.joinKeys);
          const leftOutputFields = parseStringArray(nodeConfig.leftOutputFields);
          const rightOutputFields = parseStringArray(nodeConfig.rightOutputFields);
          const leftColumns = leftPlan.columns.slice();
          const rightColumns = rightPlan.columns.slice();
          const effectiveLeftFields = leftOutputFields.length ? leftOutputFields : leftColumns.slice();
          const effectiveRightFields = rightOutputFields.length ? rightOutputFields : rightColumns.slice();

          validateKnownColumns(leftColumns, effectiveLeftFields, node.nodeName, "关联");
          validateKnownColumns(rightColumns, effectiveRightFields, node.nodeName, "关联");
          if (joinType !== "cross") {
            if (!joinKeys.length) {
              throw new AppError(`Join node ${node.nodeName} must configure at least one join key`, 400);
            }
            validateKnownColumns(leftColumns, joinKeys.map((item) => item.leftField), node.nodeName, "关联");
            validateKnownColumns(rightColumns, joinKeys.map((item) => item.rightField), node.nodeName, "关联");
          }

          const selectSegments = [];
          const outputColumns = [];
          const seenColumns = new Set();

          effectiveLeftFields.forEach((fieldName) => {
            outputColumns.push(fieldName);
            seenColumns.add(fieldName);
            selectSegments.push(`${buildAliasReference("left_data", fieldName, dialect)} AS ${quoteIdentifier(fieldName, dialect)}`);
          });

          effectiveRightFields.forEach((fieldName) => {
            const outputField = seenColumns.has(fieldName) ? `right_${fieldName}` : fieldName;
            outputColumns.push(outputField);
            seenColumns.add(outputField);
            selectSegments.push(`${buildAliasReference("right_data", fieldName, dialect)} AS ${quoteIdentifier(outputField, dialect)}`);
          });

          const joinCondition = joinKeys.length
            ? joinKeys
              .map((item) => `${buildAliasReference("left_data", item.leftField, dialect)} = ${buildAliasReference("right_data", item.rightField, dialect)}`)
              .join(" AND ")
            : "1 = 1";

          const leftFromClause = buildPlanFromClause(leftPlan, dialect, "left_data");
          const rightFromClause = buildPlanFromClause(rightPlan, dialect, "right_data");
          const selectSql = indentSql(selectSegments.join(",\n"), 2);
          const normalizedDialect = normalizeDatasourceType(dialect);

          columns = outputColumns;
          if (joinType === "cross") {
            sql = `SELECT\n${selectSql}\nFROM ${leftFromClause}\nCROSS JOIN ${rightFromClause}`;
            break;
          }

          const joinKeywordMap = {
            left: "LEFT JOIN",
            right: "RIGHT JOIN",
            inner: "INNER JOIN",
            full: "FULL OUTER JOIN",
          };

          if (joinType === "full" && ["mysql", "clickhouse"].includes(normalizedDialect)) {
            const antiCondition = joinKeys
              .map((item) => `${buildAliasReference("left_data", item.leftField, dialect)} IS NULL`)
              .join(" AND ");
            const leftJoinSql = `SELECT\n${selectSql}\nFROM ${leftFromClause}\nLEFT JOIN ${rightFromClause}\n  ON ${joinCondition}`;
            const rightOnlySql = `SELECT\n${selectSql}\nFROM ${rightFromClause}\nLEFT JOIN ${leftFromClause}\n  ON ${joinCondition}\nWHERE ${antiCondition}`;
            sql = `${leftJoinSql}\nUNION ALL\n${rightOnlySql}`;
            warnings.push(`关联节点 ${node.nodeName} 在当前数据源上按 UNION ALL 模拟 FULL OUTER JOIN。`);
            break;
          }

          const joinKeyword = joinKeywordMap[joinType] || "LEFT JOIN";
          sql = `SELECT\n${selectSql}\nFROM ${leftFromClause}\n${joinKeyword} ${rightFromClause}\n  ON ${joinCondition}`;
          break;
        }
        case "format_convert": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Format Convert node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          const formatRules = normalizeFormatRules(nodeConfig.formatRules);
          if (!formatRules.length) {
            throw new AppError(`Format Convert node ${node.nodeName} must configure at least one rule`, 400);
          }
          validateKnownColumns(inputColumns, formatRules.map((item) => item.sourceField), node.nodeName, "格式转换");
          validateUniqueColumns(formatRules.map((item) => item.targetField), node.nodeName, "格式转换");
          const { outputColumns, selectSql } = buildDerivedSelectPlan(inputColumns, formatRules, dialect, (rule, sourceAlias) =>
            buildFormatRuleExpression(rule, sourceAlias, dialect)
          );
          columns = outputColumns;
          sql = `SELECT\n${indentSql(selectSql, 2)}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
          break;
        }
        case "compliance_check": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Compliance Check node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          const complianceRules = normalizeComplianceRules(nodeConfig.complianceRules);
          if (!complianceRules.length) {
            throw new AppError(`Compliance Check node ${node.nodeName} must configure at least one rule`, 400);
          }
          validateKnownColumns(inputColumns, complianceRules.map((item) => item.sourceField), node.nodeName, "数据校验");
          validateUniqueColumns(complianceRules.map((item) => item.targetField), node.nodeName, "数据校验");
          const { outputColumns, selectSql } = buildDerivedSelectPlan(inputColumns, complianceRules, dialect, (rule, sourceAlias) =>
            buildComplianceRuleExpression(rule, sourceAlias, dialect)
          );
          columns = outputColumns;
          sql = `SELECT\n${indentSql(selectSql, 2)}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
          break;
        }
        case "string_transform": {
          if (inputPlans.length !== 1) {
            throw new AppError(`String Transform node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          const stringRules = normalizeStringRules(nodeConfig.stringRules);
          if (!stringRules.length) {
            throw new AppError(`String Transform node ${node.nodeName} must configure at least one rule`, 400);
          }
          validateKnownColumns(inputColumns, stringRules.map((item) => item.sourceField), node.nodeName, "字符处理");
          validateUniqueColumns(stringRules.map((item) => item.targetField), node.nodeName, "字符处理");
          const { outputColumns, selectSql } = buildDerivedSelectPlan(inputColumns, stringRules, dialect, (rule, sourceAlias) =>
            buildStringRuleExpression(rule, sourceAlias, dialect)
          );
          columns = outputColumns;
          sql = `SELECT\n${indentSql(selectSql, 2)}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
          break;
        }
        case "desensitize": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Desensitize node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          const desensitizeRules = normalizeDesensitizeRules(nodeConfig.desensitizeRules);
          if (!desensitizeRules.length) {
            throw new AppError(`Desensitize node ${node.nodeName} must configure at least one rule`, 400);
          }
          validateKnownColumns(inputColumns, desensitizeRules.map((item) => item.sourceField), node.nodeName, "数据脱敏");
          validateUniqueColumns(desensitizeRules.map((item) => item.targetField), node.nodeName, "数据脱敏");
          const { outputColumns, selectSql } = buildDerivedSelectPlan(inputColumns, desensitizeRules, dialect, (rule, sourceAlias) =>
            buildDesensitizeRuleExpression(rule, sourceAlias, dialect)
          );
          columns = outputColumns;
          sql = `SELECT\n${indentSql(selectSql, 2)}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
          break;
        }
        case "string_aggregate": {
          if (inputPlans.length !== 1) {
            throw new AppError(`String aggregate node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          const groupByFields = parseStringArray(nodeConfig.groupByFields);
          const aggregateRules = normalizeStringAggregateRules(nodeConfig.stringAggregateRules);
          if (!aggregateRules.length) {
            throw new AppError(`String aggregate node ${node.nodeName} must configure at least one rule`, 400);
          }
          validateKnownColumns(inputColumns, groupByFields.concat(aggregateRules.map((item) => item.sourceField)), node.nodeName, "字符串聚合");
          validateUniqueColumns(groupByFields, node.nodeName, "字符串聚合");
          validateUniqueColumns(aggregateRules.map((item) => item.outputField), node.nodeName, "字符串聚合");

          columns = groupByFields.concat(aggregateRules.map((item) => item.outputField));
          const selectSegments = groupByFields.map((fieldName) => `${buildAliasReference("source_data", fieldName, dialect)} AS ${quoteIdentifier(fieldName, dialect)}`);
          aggregateRules.forEach((rule) => {
            selectSegments.push(`${buildStringAggregateExpression(rule, "source_data", dialect)} AS ${quoteIdentifier(rule.outputField, dialect)}`);
          });
          sql = `SELECT\n${indentSql(selectSegments.join(",\n"), 2)}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}${groupByFields.length ? `\nGROUP BY ${groupByFields.map((fieldName) => buildAliasReference("source_data", fieldName, dialect)).join(", ")}` : ""}`;
          break;
        }
        case "string_split": {
          if (inputPlans.length !== 1) {
            throw new AppError(`String split node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          const splitConfig = normalizeStringSplitConfig(nodeConfig);
          if (!splitConfig.sourceField || !splitConfig.outputField) {
            throw new AppError(`String split node ${node.nodeName} must configure source and output fields`, 400);
          }
          if (!splitConfig.separator) {
            throw new AppError(`String split node ${node.nodeName} must configure a non-empty separator`, 400);
          }
          validateKnownColumns(inputColumns, [splitConfig.sourceField], node.nodeName, "字符串拆分");

          columns = buildStringSplitOutputColumns(inputColumns, splitConfig.sourceField, splitConfig.outputField, splitConfig.indexField);
          validateUniqueColumns(columns, node.nodeName, "字符串拆分");
          sql = `SELECT *\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
          break;
        }
        case "pivot": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Pivot node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          const groupByFields = parseStringArray(nodeConfig.groupByFields);
          const pivotField = trimText(nodeConfig.pivotField);
          const valueField = trimText(nodeConfig.valueField);
          const aggregateFunction = trimText(nodeConfig.aggregateFunction) || "max";
          const pivotMappings = normalizePivotMappings(nodeConfig.pivotMappings);
          if (!pivotField || !valueField || !pivotMappings.length) {
            throw new AppError(`Pivot node ${node.nodeName} must configure pivot field, value field, and mappings`, 400);
          }
          validateKnownColumns(inputColumns, groupByFields.concat([pivotField, valueField]), node.nodeName, "行转列");
          validateUniqueColumns(groupByFields, node.nodeName, "行转列");
          validateUniqueColumns(pivotMappings.map((item) => item.outputField), node.nodeName, "行转列");

          columns = groupByFields.concat(pivotMappings.map((item) => item.outputField));
          const selectSegments = groupByFields.map((fieldName) => `${buildAliasReference("source_data", fieldName, dialect)} AS ${quoteIdentifier(fieldName, dialect)}`);
          pivotMappings.forEach((item) => {
            const conditionSql = `${buildAliasReference("source_data", pivotField, dialect)} = ${escapeSqlLiteral(item.sourceValue)}`;
            const valueExpression = buildAliasReference("source_data", valueField, dialect);
            selectSegments.push(`${buildAggregateCaseExpression(aggregateFunction, conditionSql, valueExpression)} AS ${quoteIdentifier(item.outputField, dialect)}`);
          });
          sql = `SELECT\n${indentSql(selectSegments.join(",\n"), 2)}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}${groupByFields.length ? `\nGROUP BY ${groupByFields.map((fieldName) => buildAliasReference("source_data", fieldName, dialect)).join(", ")}` : ""}`;
          break;
        }
        case "unpivot": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Unpivot node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          const groupByFields = parseStringArray(nodeConfig.groupByFields);
          const sourceFields = parseStringArray(nodeConfig.sourceFields);
          const nameField = trimText(nodeConfig.nameField) || "metric_name";
          const valueField = trimText(nodeConfig.valueField) || "metric_value";
          if (!sourceFields.length) {
            throw new AppError(`Unpivot node ${node.nodeName} must configure at least one source field`, 400);
          }
          validateKnownColumns(inputColumns, groupByFields.concat(sourceFields), node.nodeName, "列转行");

          columns = groupByFields.concat([nameField, valueField]);
          sql = sourceFields
            .map((fieldName) => {
              const selectSegments = groupByFields.map((groupField) => `${buildAliasReference("source_data", groupField, dialect)} AS ${quoteIdentifier(groupField, dialect)}`);
              selectSegments.push(`${escapeSqlLiteral(fieldName)} AS ${quoteIdentifier(nameField, dialect)}`);
              selectSegments.push(`${buildAliasReference("source_data", fieldName, dialect)} AS ${quoteIdentifier(valueField, dialect)}`);
              return `SELECT\n${indentSql(selectSegments.join(",\n"), 2)}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
            })
            .join("\nUNION ALL\n");
          break;
        }
        case "window_compute": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Window Compute node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          const functionType = trimText(nodeConfig.functionType) || "row_number";
          const outputField = trimText(nodeConfig.outputField) || "window_value";
          const sourceField = trimText(nodeConfig.sourceField);
          const partitionByFields = parseStringArray(nodeConfig.partitionByFields);
          const orderByFields = normalizeSortRules(nodeConfig.orderByFields);
          validateKnownColumns(inputColumns, partitionByFields, node.nodeName, "窗口计算");
          validateKnownColumns(inputColumns, orderByFields.map((item) => item.fieldName), node.nodeName, "窗口计算");
          if (["lag", "lead", "sum", "avg"].includes(functionType)) {
            validateKnownColumns(inputColumns, [sourceField], node.nodeName, "窗口计算");
          }
          if (["row_number", "rank", "dense_rank", "lag", "lead"].includes(functionType) && !orderByFields.length) {
            throw new AppError(`Window Compute node ${node.nodeName} must configure ORDER BY fields`, 400);
          }

          const partitionSql = partitionByFields.length
            ? `PARTITION BY ${partitionByFields.map((fieldName) => buildAliasReference("source_data", fieldName, dialect)).join(", ")} `
            : "";
          const orderSql = orderByFields.length
            ? `ORDER BY ${orderByFields.map((item) => `${buildAliasReference("source_data", item.fieldName, dialect)} ${item.direction}`).join(", ")}`
            : "";
          const overSql = `${partitionSql}${orderSql}`.trim();
          let expression = "";
          if (functionType === "row_number") {
            expression = `ROW_NUMBER() OVER (${overSql})`;
          } else if (functionType === "rank") {
            expression = `RANK() OVER (${overSql})`;
          } else if (functionType === "dense_rank") {
            expression = `DENSE_RANK() OVER (${overSql})`;
          } else if (functionType === "sum") {
            expression = `SUM(${buildAliasReference("source_data", sourceField, dialect)}) OVER (${overSql || partitionSql.trim()})`;
          } else if (functionType === "avg") {
            expression = `AVG(${buildAliasReference("source_data", sourceField, dialect)}) OVER (${overSql || partitionSql.trim()})`;
          } else if (functionType === "lag") {
            const offset = Math.max(1, Number(nodeConfig.offset || 1));
            const defaultValue = nodeConfig.defaultValue === undefined || nodeConfig.defaultValue === null ? "" : String(nodeConfig.defaultValue);
            expression = `LAG(${buildAliasReference("source_data", sourceField, dialect)}, ${offset}, ${escapeSqlLiteral(defaultValue)}) OVER (${overSql})`;
          } else if (functionType === "lead") {
            const offset = Math.max(1, Number(nodeConfig.offset || 1));
            const defaultValue = nodeConfig.defaultValue === undefined || nodeConfig.defaultValue === null ? "" : String(nodeConfig.defaultValue);
            expression = `LEAD(${buildAliasReference("source_data", sourceField, dialect)}, ${offset}, ${escapeSqlLiteral(defaultValue)}) OVER (${overSql})`;
          } else {
            throw new AppError(`Unsupported window function ${functionType}`, 400);
          }

          const { outputColumns, selectSql } = buildDerivedSelectPlan(
            inputColumns,
            [{ targetField: outputField, outputField }],
            dialect,
            () => expression
          );
          columns = outputColumns;
          sql = `SELECT\n${indentSql(selectSql, 2)}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
          break;
        }
        case "aggregate": {
          if (inputPlans.length !== 1) {
            throw new AppError(`Aggregate node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const inputColumns = inputPlans[0].columns.slice();
          const groupByFields = parseStringArray(nodeConfig.groupByFields);
          const aggregationRules = normalizeAggregationRules(nodeConfig.aggregations);
          if (!aggregationRules.length) {
            throw new AppError(`聚合统计节点 ${node.nodeName} 至少要配置一个聚合指标`, 400);
          }

          validateKnownColumns(inputColumns, groupByFields, node.nodeName, "聚合统计");
          validateUniqueColumns(groupByFields, node.nodeName, "聚合统计");
          const requiredAggregationFields = aggregationRules
            .map((item) => item.fieldName)
            .filter((item) => item && item !== "__all__");
          validateKnownColumns(inputColumns, requiredAggregationFields, node.nodeName, "聚合统计");

          const outputColumns = groupByFields.slice();
          const selectSegments = groupByFields.map((fieldName) => `${buildAliasReference("source_data", fieldName, dialect)} AS ${quoteIdentifier(fieldName, dialect)}`);
          for (const rule of aggregationRules) {
            const alias = trimText(rule.alias) || buildDefaultAggregateAlias(rule);
            outputColumns.push(alias);
            selectSegments.push(`${buildAggregateExpression(rule, "source_data", dialect)} AS ${quoteIdentifier(alias, dialect)}`);
          }
          validateUniqueColumns(outputColumns, node.nodeName, "聚合统计");

          columns = outputColumns;
          sql = `SELECT\n${indentSql(selectSegments.join(",\n"), 2)}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}${groupByFields.length ? `\nGROUP BY ${groupByFields.map((fieldName) => buildAliasReference("source_data", fieldName, dialect)).join(", ")}` : ""}`;
          break;
        }
        case "custom_sql": {
          const sqlText = stripTrailingSemicolon(nodeConfig.sqlText || nodeConfig.configText);
          if (!sqlText) {
            throw new AppError(`Custom SQL node ${node.nodeName} must configure SQL text`, 400);
          }

          const sqlInputBindings = normalizeSqlInputBindings(nodeConfig.sqlInputs, inputPlans, node.nodeName);
          const inlineAliases = [];
          const emittedAliases = new Set();
          sqlInputBindings.forEach((binding, inputIndex) => {
            const inputPlan = inputPlans[inputIndex];
            inlineAliases.push(`${quoteIdentifier(binding.alias, dialect)} AS (\n${indentSql(buildPlanSelectSql(inputPlan, dialect), 2)}\n)`);
            emittedAliases.add(binding.alias);

            if (!emittedAliases.has(binding.fallbackAlias)) {
              inlineAliases.push(
                `${quoteIdentifier(binding.fallbackAlias, dialect)} AS (\n${indentSql(`SELECT *\nFROM ${quoteIdentifier(binding.alias, dialect)}`, 2)}\n)`
              );
              emittedAliases.add(binding.fallbackAlias);
            }
          });
          if (inputPlans.length) {
            const primaryAlias = sqlInputBindings[0]?.alias || "input_1";
            if (!emittedAliases.has("input_data")) {
              inlineAliases.push(`${quoteIdentifier("input_data", dialect)} AS (\n${indentSql(`SELECT *\nFROM ${quoteIdentifier(primaryAlias, dialect)}`, 2)}\n)`);
            }
          }

          const sourceColumnsByAlias = {};
          sqlInputBindings.forEach((binding, inputIndex) => {
            sourceColumnsByAlias[binding.alias] = inputPlans[inputIndex]?.columns || [];
            sourceColumnsByAlias[binding.fallbackAlias] = inputPlans[inputIndex]?.columns || [];
          });
          if (inputPlans.length) {
            sourceColumnsByAlias.input_data = inputPlans[0]?.columns || [];
          }

          const inferredSqlColumns = sqlParser.inferSelectOutputColumns(sqlText, dialect, sourceColumnsByAlias);
          columns = inferredSqlColumns.columns.length
            ? inferredSqlColumns.columns
            : mergeColumns(inputPlans.map((item) => item.columns || []));
          if (!inferredSqlColumns.columns.length) {
            warnings.push(`自定义 SQL 节点 ${node.nodeName} 的输出字段暂未能从 SQL 中识别，当前回退为上游字段结构，请以节点预览结果为准。`);
          } else if (!inferredSqlColumns.complete) {
            warnings.push(`自定义 SQL 节点 ${node.nodeName} 的部分输出字段为近似推断，建议为计算列显式设置别名。`);
          }
          sql = prependInlineAliases(sqlText, inlineAliases);
          break;
        }
        case "llm":
        case "llm_row":
        case "llm_batch": {
          if (inputPlans.length !== 1) {
            throw new AppError(`AI node ${node.nodeName} must have exactly one upstream node`, 400);
          }

          const normalizedAiOperatorCode = normalizeAiOperatorCode(node.operatorCode);
          const outputFields = normalizeAiOutputFields(
            nodeConfig,
            getAiFallbackFieldName(normalizedAiOperatorCode)
          );
          const outputFieldNames = outputFields.map((item) => item.fieldName);
          const inputColumns = inputPlans[0].columns.slice();

          if (!outputFieldNames.length) {
            throw new AppError(`AI node ${node.nodeName} must configure at least one output field`, 400);
          }

          if (new Set(outputFieldNames).size !== outputFieldNames.length) {
            throw new AppError(`AI node ${node.nodeName} has duplicate output fields`, 400);
          }

          if (normalizedAiOperatorCode === "llm_batch") {
            columns = outputFieldNames.slice();
            sql = `SELECT\n  ${outputFieldNames.map((fieldName) => `NULL AS ${quoteIdentifier(fieldName, dialect)}`).join(",\n  ")}`;
            warnings.push(`AI batch node ${node.nodeName} cannot be translated to pure SQL. SQL preview uses a single NULL row as placeholders for ${outputFieldNames.join(", ")}.`);
          } else {
            const duplicatedInputField = outputFieldNames.find((fieldName) => inputColumns.includes(fieldName));
            if (duplicatedInputField) {
              throw new AppError(`AI node ${node.nodeName} output field ${duplicatedInputField} already exists in upstream schema`, 400);
            }

            columns = inputColumns.concat(outputFieldNames);
            sql = `SELECT\n  source_data.*,\n  ${outputFieldNames.map((fieldName) => `NULL AS ${quoteIdentifier(fieldName, dialect)}`).join(",\n  ")}\nFROM ${buildPlanFromClause(inputPlans[0], dialect, "source_data")}`;
            warnings.push(`AI row node ${node.nodeName} cannot be translated to pure SQL. SQL preview uses NULL as placeholders for ${outputFieldNames.join(", ")}.`);
          }
          break;
        }
        default:
          throw new AppError(`Unsupported orchestration operator: ${node.operatorCode}`, 400);
      }
    } else {
      throw new AppError(`Unsupported orchestration node type: ${node.nodeType}`, 400);
    }

    const plan = {
      nodeKey: node.nodeKey,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      operatorCode: node.operatorCode,
      cteName,
      sql,
      columns,
      relationName,
      sqlCompatible: !(node.nodeType === "operator" && (AI_OPERATOR_CODES.has(node.operatorCode) || node.operatorCode === "string_split")),
    };
    compiledPlanMap.set(node.nodeKey, plan);
    compiledPlans.push(plan);
  }

  const finalPlan = resolveFinalPlan(compiledPlans, compiledPlanMap, outgoing, warnings, options.targetNodeKey);
  if (!finalPlan) {
    throw new AppError("当前数据编排图无法确定最终输出节点", 400);
  }

  const finalLineageNodeKeys = collectLineageNodeKeys(finalPlan.nodeKey, incoming);
  const hasRuntimeOperators = compiledPlans.some((item) => finalLineageNodeKeys.has(item.nodeKey) && item.sqlCompatible === false);

  return {
    taskId: Number(task.id),
    taskName: task.name,
    datasourceId: sourceDatasourceIds[0] || task.datasourceId || options.datasourceId || null,
    datasourceType: options.datasourceType || task.datasourceType || dialect,
    databaseName: task.databaseName || options.databaseName || null,
    dialect,
    executionOrder,
    warnings: uniqueValues(warnings),
    compiledPlans,
    compiledPlanMap,
    incoming,
    outputPlans: compiledPlans.filter((item) => item.nodeType === "output"),
    finalPlan,
    finalLineageNodeKeys,
    hasRuntimeOperators,
  };
}

async function compileOrchestrationTask(task, options = {}) {
  const compiled = await compilePlans(task, options);
  const finalLineagePlans = compiled.compiledPlans.filter((item) => compiled.finalLineageNodeKeys.has(item.nodeKey));
  const withClause = buildWithClause(finalLineagePlans, compiled.dialect);
  const previewSql = `${withClause}\n${buildNodeSelectSql(compiled.finalPlan.cteName, compiled.dialect, options.previewLimit)};`;
  const warnings = compiled.warnings.slice();
  const finalInsertColumns = (compiled.finalPlan.columns || []).filter(Boolean);
  const finalInsertColumnSql = finalInsertColumns.length
    ? ` (${finalInsertColumns.map((columnName) => quoteIdentifier(columnName, compiled.dialect)).join(", ")})`
    : "";
  const executeSql = !compiled.hasRuntimeOperators && compiled.finalPlan.nodeType === "output" && compiled.finalPlan.relationName
    ? `${withClause}\nINSERT INTO ${quoteIdentifier(compiled.finalPlan.relationName, compiled.dialect)}${finalInsertColumnSql}\nSELECT *\nFROM ${buildCteReference(compiled.finalPlan.cteName, compiled.dialect)};`
    : null;
  const outputStatements = compiled.hasRuntimeOperators
    ? []
    : buildOutputStatements(compiled.compiledPlans, compiled.incoming, compiled.outputPlans, compiled.dialect);

  if (compiled.hasRuntimeOperators) {
    warnings.push("Current graph includes at least one AI node in the result path. SQL preview is for structure inspection only and is not executable as the real runtime plan.");
  }

  return {
    taskId: compiled.taskId,
    taskName: compiled.taskName,
    datasourceId: compiled.datasourceId,
    datasourceType: compiled.datasourceType,
    databaseName: compiled.databaseName,
    dialect: compiled.dialect,
    executionOrder: compiled.executionOrder,
    finalNodeKey: compiled.finalPlan.nodeKey,
    finalNodeName: compiled.finalPlan.nodeName,
    previewSql,
    executeSql,
    finalColumns: compiled.finalPlan.columns || [],
    hasRuntimeOperators: compiled.hasRuntimeOperators,
    warnings: uniqueValues(warnings),
    nodeSqls: compiled.compiledPlans.map((item) => ({
      nodeKey: item.nodeKey,
      nodeName: item.nodeName,
      nodeType: item.nodeType,
      operatorCode: item.operatorCode,
      cteName: item.cteName,
      relationName: item.relationName,
      sql: item.sql,
      columns: item.columns || [],
    })),
    outputStatements,
  };
}

module.exports = {
  compileOrchestrationTask,
};
