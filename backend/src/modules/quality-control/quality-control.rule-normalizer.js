const crypto = require("crypto");
const AppError = require("../../common/errors/app-error");
const metadataService = require("../data-sources/data-source.metadata");

function uniqueStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean)));
}

function getSimpleTableName(tableName) {
  const parts = String(tableName || "").split(".").filter(Boolean);
  return parts.length ? parts[parts.length - 1].replace(/^["`]+|["`]+$/g, "") : String(tableName || "").trim();
}

function normalizeTableCatalog(tableCatalog, currentTableName) {
  const currentSimpleName = getSimpleTableName(currentTableName);
  return (Array.isArray(tableCatalog) ? tableCatalog : [])
    .map((table) => ({
      tableName: getSimpleTableName(table?.tableName || table?.fullTableName || ""),
      fullTableName: String(table?.fullTableName || table?.tableName || "").trim(),
      tableComment: String(table?.tableComment || table?.comment || "").trim(),
    }))
    .filter((table) => table.tableName && table.tableName !== currentSimpleName);
}

function normalizeColumns(columns, sampleRows = []) {
  return (Array.isArray(columns) ? columns : []).map((column) => {
    const columnName = String(column?.columnName || "").trim();
    const sampleValues = uniqueStrings(
      (Array.isArray(sampleRows) ? sampleRows : [])
        .map((row) => row?.[columnName])
        .filter((value) => value !== null && value !== undefined && value !== "")
    ).slice(0, 10);
    return {
      columnName,
      columnComment: String(column?.columnComment || "").trim(),
      dataType: String(column?.dataType || column?.columnType || "").trim(),
      columnType: String(column?.columnType || column?.dataType || "").trim(),
      isNullable: Boolean(column?.isNullable),
      isPrimaryKey: Boolean(column?.isPrimaryKey),
      sampleValues,
    };
  }).filter((column) => column.columnName);
}

function getFieldTypeFamily(field = {}) {
  const type = `${field.dataType || ""} ${field.columnType || ""}`.toLowerCase();
  if (/int|numeric|decimal|double|float|real|number/.test(type)) return "number";
  if (/date|time|timestamp/.test(type)) return "datetime";
  if (/bool|bit/.test(type)) return "boolean";
  if (/char|text|string|enum|json|uuid/.test(type)) return "text";
  return type.replace(/\([^)]*\)/g, "").trim() || "unknown";
}

function areFieldTypesCompatible(leftField, rightField) {
  const leftFamily = getFieldTypeFamily(leftField);
  const rightFamily = getFieldTypeFamily(rightField);
  return leftFamily === "unknown" || rightFamily === "unknown" || leftFamily === rightFamily;
}

async function loadRelatedTableMetadata(source, currentTableName, fields, tableCatalog, selectedReferenceTables = []) {
  const normalizedCatalog = normalizeTableCatalog(tableCatalog, currentTableName);
  const selectedNames = new Set(uniqueStrings(selectedReferenceTables));
  const selectedSimpleNames = new Set(Array.from(selectedNames).map(getSimpleTableName));
  const candidates = normalizedCatalog.filter((table) =>
    selectedNames.has(table.fullTableName) || selectedNames.has(table.tableName) || selectedSimpleNames.has(table.tableName)
  );
  const relatedTables = await Promise.all(candidates.map(async (table) => {
    try {
      const [rawColumns, sampleRows] = await Promise.all([
        metadataService.listColumns(source, table.fullTableName || table.tableName),
        metadataService.sampleRows(source, table.fullTableName || table.tableName, 10).catch(() => []),
      ]);
      const columns = normalizeColumns(rawColumns, sampleRows);
      if (!columns.length) {
        return null;
      }
      return {
        tableName: table.tableName,
        fullTableName: table.fullTableName || table.tableName,
        tableComment: table.tableComment || "",
        columns,
        sampleRows: (sampleRows || []).slice(0, 10),
      };
    } catch (error) {
      return null;
    }
  }));
  return relatedTables.filter(Boolean);
}

async function getReferenceTableMetadata(profile, source, refTable, cache) {
  const simpleTableName = getSimpleTableName(refTable);
  const normalizedRefTable = String(refTable || "").trim();

  if (cache.has(normalizedRefTable)) {
    return cache.get(normalizedRefTable);
  }
  if (cache.has(simpleTableName)) {
    return cache.get(simpleTableName);
  }

  const preloaded = (Array.isArray(profile?.relatedTableMetadata) ? profile.relatedTableMetadata : []).find((table) =>
    table?.fullTableName === normalizedRefTable || table?.tableName === simpleTableName
  );
  if (preloaded) {
    cache.set(normalizedRefTable, preloaded);
    cache.set(simpleTableName, preloaded);
    return preloaded;
  }

  const tableCatalogEntry = (Array.isArray(profile?.tableCatalog) ? profile.tableCatalog : []).find((table) =>
    String(table?.fullTableName || "").trim() === normalizedRefTable || String(table?.tableName || "").trim() === simpleTableName
  );

  try {
    const columns = normalizeColumns(await metadataService.listColumns(source, normalizedRefTable));
    const metadata = {
      tableName: simpleTableName,
      fullTableName: tableCatalogEntry?.fullTableName || normalizedRefTable,
      tableComment: tableCatalogEntry?.tableComment || "",
      columns,
    };
    cache.set(normalizedRefTable, metadata);
    cache.set(simpleTableName, metadata);
    return metadata;
  } catch (error) {
    const metadata = {
      tableName: simpleTableName,
      fullTableName: tableCatalogEntry?.fullTableName || normalizedRefTable,
      tableComment: tableCatalogEntry?.tableComment || "",
      columns: [],
    };
    cache.set(normalizedRefTable, metadata);
    cache.set(simpleTableName, metadata);
    return metadata;
  }
}

function formatInvalidRuleMessage(ruleId, message) {
  return `规则 ${ruleId || "advanced_rule"} ${message}`;
}

function compactRuleId(value) {
  const normalized = String(value || "advanced_rule")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "advanced_rule";
  const crossRule = normalized.match(/^cross_table_(lookup|consistency)(?:_.+)?$/);
  if (crossRule) {
    const hash = crypto.createHash("sha1").update(normalized).digest("hex").slice(0, 12);
    return `cross_${crossRule[1]}_${hash}`;
  }
  if (normalized.length <= 128) {
    return normalized;
  }
  const hash = crypto.createHash("sha1").update(normalized).digest("hex").slice(0, 12);
  const prefix = normalized.slice(0, 128 - hash.length - 1).replace(/_+$/g, "") || "advanced_rule";
  return `${prefix}_${hash}`;
}

function buildRuleId(category, fields = []) {
  const suffix = uniqueStrings(fields).join("_") || Date.now();
  return compactRuleId(`${category}_${suffix}`);
}

function getDefaultAdvancedRuleScope(category) {
  if (category === "composite_unique") return "table";
  if (category === "freshness" || category === "volume_anomaly" || category === "null_rate_change" || category === "batch_completeness") return "aggregate";
  if (category === "cross_table_lookup" || category === "cross_table_consistency") return "cross_table";
  return "row";
}

async function normalizeAdvancedRules(rawRules, profile, source, options = {}) {
  const strict = Boolean(options.strict);
  const fields = Array.isArray(profile?.fields) ? profile.fields : [];
  const fieldNameSet = new Set(fields.map((field) => String(field?.columnName || "").trim()).filter(Boolean));
  const allowedCategories = new Set([
    "conditional_required",
    "conditional_regex",
    "field_compare",
    "composite_unique",
    "freshness",
    "cross_table_lookup",
    "cross_table_consistency",
    "volume_anomaly",
    "null_rate_change",
    "batch_completeness",
  ]);
  const seen = new Set();
  const normalized = [];
  const invalidMessages = [];
  const refTableCache = new Map();

  const pushInvalid = (ruleId, message) => {
    invalidMessages.push(formatInvalidRuleMessage(ruleId, message));
  };

  for (const raw of rawRules || []) {
    const sourceRule = raw && typeof raw === "object" ? raw : {};
    const category = String(sourceRule.ruleCategory || "").trim();
    if (!allowedCategories.has(category)) continue;
    const config = sourceRule.config && typeof sourceRule.config === "object" ? { ...sourceRule.config } : {};
    const fieldNames = [];
    const candidateRuleId = compactRuleId(sourceRule.ruleId || buildRuleId(category));

    if (category === "conditional_required") {
      const conditionField = String(config.conditionField || "").trim();
      const targetField = String(config.targetField || (Array.isArray(config.targetFields) ? config.targetFields[0] : "") || "").trim();
      if (!fieldNameSet.has(conditionField) || !fieldNameSet.has(targetField)) continue;
      config.conditionField = conditionField;
      config.conditionOperator = ["=", "!=", "in", "not_in", "is_null", "is_not_null"].includes(config.conditionOperator) ? config.conditionOperator : "is_not_null";
      config.targetField = targetField;
      config.targetFields = [targetField];
      config.requirement = config.requirement === "empty" ? "empty" : "required";
      fieldNames.push(conditionField, targetField);
    }

    if (category === "conditional_regex") {
      const conditionField = String(config.conditionField || "").trim();
      const targetField = String(config.targetField || "").trim();
      const regexPattern = String(config.regexPattern || "").trim();
      if (!fieldNameSet.has(conditionField) || !fieldNameSet.has(targetField) || !regexPattern) continue;
      config.conditionField = conditionField;
      config.conditionOperator = ["=", "!=", "in", "not_in", "is_null", "is_not_null"].includes(config.conditionOperator) ? config.conditionOperator : "is_not_null";
      config.targetField = targetField;
      config.regexPattern = regexPattern;
      fieldNames.push(conditionField, targetField);
    }

    if (category === "field_compare") {
      const leftField = String(config.leftField || "").trim();
      const rightField = String(config.rightField || "").trim();
      if (!fieldNameSet.has(leftField) || !fieldNameSet.has(rightField)) continue;
      config.leftField = leftField;
      config.rightField = rightField;
      config.compareOperator = ["<", "<=", "=", ">=", ">", "!="].includes(config.compareOperator) ? config.compareOperator : "<=";
      const valueType = String(config.valueType || "").toLowerCase();
      config.valueType = ["integer", "int", "long", "float", "double", "decimal"].includes(valueType)
        ? "number"
        : ["text", "number", "date", "datetime"].includes(valueType) ? valueType : "datetime";
      fieldNames.push(leftField, rightField);
    }

    if (category === "composite_unique") {
      const compositeFields = uniqueStrings(config.fieldNames || []).filter((fieldName) => fieldNameSet.has(fieldName));
      if (compositeFields.length < 2) continue;
      config.fieldNames = compositeFields;
      config.ignoreBlank = config.ignoreBlank === undefined ? true : Boolean(config.ignoreBlank);
      fieldNames.push(...compositeFields);
    }

    if (category === "freshness") {
      const timeField = String(config.timeField || config.targetField || "").trim();
      if (!fieldNameSet.has(timeField)) continue;
      config.timeField = timeField;
      config.maxDelayValue = Math.max(1, Number(config.maxDelayValue || 1));
      config.maxDelayUnit = ["minute", "hour", "day", "month"].includes(config.maxDelayUnit) ? config.maxDelayUnit : "day";
      config.baseline = config.baseline || "current_time";
      fieldNames.push(timeField);
    }

    if (category === "volume_anomaly") {
      config.baselineMode = ["last_batch", "recent_avg"].includes(config.baselineMode) ? config.baselineMode : "recent_avg";
      config.lookbackBatches = config.baselineMode === "last_batch" ? 1 : Math.max(1, Math.min(30, Number(config.lookbackBatches || 7)));
      config.minHistoryBatches = Math.max(1, Math.min(config.lookbackBatches, Number(config.minHistoryBatches || (config.baselineMode === "last_batch" ? 1 : 3))));
      config.warmupPolicy = ["collect_only", "upper_threshold"].includes(config.warmupPolicy) ? config.warmupPolicy : "collect_only";
      config.warmupThreshold = config.warmupPolicy === "upper_threshold" && config.warmupThreshold !== null && config.warmupThreshold !== "" && Number.isFinite(Number(config.warmupThreshold)) ? Math.max(0, Number(config.warmupThreshold)) : null;
      config.thresholdPercent = Math.max(0, Number(config.thresholdPercent || 30));
      config.direction = ["increase", "decrease", "both"].includes(config.direction) ? config.direction : "both";
    }

    if (category === "null_rate_change") {
      const metricField = String(config.metricField || config.targetField || "").trim();
      if (!fieldNameSet.has(metricField)) continue;
      config.metricField = metricField;
      config.baselineMode = ["last_batch", "recent_avg"].includes(config.baselineMode) ? config.baselineMode : "recent_avg";
      config.lookbackBatches = config.baselineMode === "last_batch" ? 1 : Math.max(1, Math.min(30, Number(config.lookbackBatches || 7)));
      config.minHistoryBatches = Math.max(1, Math.min(config.lookbackBatches, Number(config.minHistoryBatches || (config.baselineMode === "last_batch" ? 1 : 3))));
      config.warmupPolicy = ["collect_only", "upper_threshold"].includes(config.warmupPolicy) ? config.warmupPolicy : "collect_only";
      config.warmupThreshold = config.warmupPolicy === "upper_threshold" && config.warmupThreshold !== null && config.warmupThreshold !== "" && Number.isFinite(Number(config.warmupThreshold)) ? Math.max(0, Number(config.warmupThreshold)) : null;
      config.thresholdPercent = Math.max(0, Number(config.thresholdPercent || 20));
      config.direction = ["increase", "decrease", "both"].includes(config.direction) ? config.direction : "both";
      fieldNames.push(metricField);
    }

    if (category === "batch_completeness") {
      const dimensionField = String(config.dimensionField || config.metricField || "").trim();
      if (!fieldNameSet.has(dimensionField)) continue;
      config.dimensionField = dimensionField;
      config.expectedDistinctCount = Math.max(1, Number(config.expectedDistinctCount || 1));
      fieldNames.push(dimensionField);
    }

    if (category === "cross_table_lookup" || category === "cross_table_consistency") {
      const refTable = String(config.refTable || config.referenceTable || config.rightTable || "").trim();
      const localFields = uniqueStrings(config.localFields || config.sourceFields || [config.localField || config.leftField]).filter((fieldName) => fieldNameSet.has(fieldName));
      const refFields = uniqueStrings(config.refFields || config.referenceFields || [config.refField || config.rightField]);
      if (!refTable || localFields.length === 0 || localFields.length !== refFields.length) {
        pushInvalid(candidateRuleId, "缺少有效的引用表或字段映射");
        continue;
      }

      const refMetadata = await getReferenceTableMetadata(profile, source, refTable, refTableCache);
      const refFieldSet = new Set((refMetadata.columns || []).map((column) => column.columnName));
      if (!refMetadata.columns.length) {
        pushInvalid(candidateRuleId, `引用表 ${refTable} 元数据不存在或无法读取`);
        continue;
      }

      const invalidRefFields = refFields.filter((fieldName) => !refFieldSet.has(fieldName));
      if (invalidRefFields.length > 0) {
        pushInvalid(candidateRuleId, `引用表 ${refTable} 不存在字段 ${invalidRefFields.join(", ")}`);
        continue;
      }
      const incompatibleJoinFields = localFields.filter((fieldName, index) => {
        const localField = fields.find((field) => field.columnName === fieldName);
        const refField = (refMetadata.columns || []).find((column) => column.columnName === refFields[index]);
        return !areFieldTypesCompatible(localField, refField);
      });
      if (incompatibleJoinFields.length > 0) {
        pushInvalid(candidateRuleId, `关联字段类型不兼容: ${incompatibleJoinFields.join(", ")}`);
        continue;
      }

      config.refTable = refMetadata.fullTableName || refTable;
      config.localFields = localFields;
      config.refFields = refFields;
      fieldNames.push(...localFields);

      if (category === "cross_table_consistency") {
        const comparePairs = Array.isArray(config.comparePairs)
          ? config.comparePairs
            .map((item) => ({
              localField: String(item?.localField || "").trim(),
              refField: String(item?.refField || "").trim(),
            }))
            .filter((item) => fieldNameSet.has(item.localField)
              && item.refField
              && !localFields.some((fieldName, index) => fieldName === item.localField && refFields[index] === item.refField))
          : [];
        if (!comparePairs.length) {
          pushInvalid(candidateRuleId, "缺少 comparePairs 配置");
          continue;
        }
        const invalidCompareFields = comparePairs.filter((item) => !refFieldSet.has(item.refField));
        if (invalidCompareFields.length > 0) {
          pushInvalid(candidateRuleId, `引用表 ${refTable} 不存在 comparePairs 字段 ${invalidCompareFields.map((item) => item.refField).join(", ")}`);
          continue;
        }
        const incompatibleCompareFields = comparePairs.filter((item) => {
          const localField = fields.find((field) => field.columnName === item.localField);
          const refField = (refMetadata.columns || []).find((column) => column.columnName === item.refField);
          return !areFieldTypesCompatible(localField, refField);
        });
        if (incompatibleCompareFields.length > 0) {
          pushInvalid(candidateRuleId, `一致性比对字段类型不兼容: ${incompatibleCompareFields.map((item) => item.localField).join(", ")}`);
          continue;
        }
        config.comparePairs = comparePairs;
        fieldNames.push(...comparePairs.map((item) => item.localField));
      }
    }

    const ruleId = compactRuleId(sourceRule.ruleId || buildRuleId(category, fieldNames));
    if (seen.has(ruleId)) continue;
    seen.add(ruleId);
    const ruleName = category === "volume_anomaly"
      ? "数据量波动监测"
      : String(sourceRule.ruleName || sourceRule.description || ruleId).trim();
    const description = category === "volume_anomaly"
      ? "监测当前批次总记录数相对历史基线的异常波动。"
      : String(sourceRule.description || "").trim();
    normalized.push({
      ruleId,
      ruleName,
      ruleScope: String(sourceRule.ruleScope || getDefaultAdvancedRuleScope(category)),
      ruleCategory: category,
      enabled: sourceRule.enabled === undefined ? true : Boolean(sourceRule.enabled),
      severity: ["low", "medium", "high"].includes(String(sourceRule.severity)) ? String(sourceRule.severity) : "medium",
      description,
      config,
      recommendationMeta: sourceRule.recommendationMeta && typeof sourceRule.recommendationMeta === "object"
        ? { ...sourceRule.recommendationMeta }
        : undefined,
    });
  }

  if (strict && invalidMessages.length > 0) {
    throw new AppError(invalidMessages.slice(0, 3).join("；"), 400);
  }

  return normalized;
}

module.exports = {
  getSimpleTableName,
  loadRelatedTableMetadata,
  normalizeAdvancedRules,
  normalizeColumns,
  uniqueStrings,
};
