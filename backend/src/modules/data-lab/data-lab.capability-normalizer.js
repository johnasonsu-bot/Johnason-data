const incubationAssetMap = require("./data-lab.incubation-asset-map");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeIdentifier(value, maxLength = 64) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, maxLength);
}

function uniqueBy(items, keyResolver) {
  const map = new Map();
  asArray(items).forEach((item) => {
    const key = keyResolver(item);
    if (!key) return;
    map.set(key, item);
  });
  return Array.from(map.values());
}

function normalizeStringList(value) {
  return uniqueBy(
    asArray(value)
      .map((item) => cleanString(item))
      .filter(Boolean),
    (item) => item
  );
}

function normalizeSourceRefs(value) {
  return uniqueBy(
    asArray(value)
      .map((item) => {
        if (typeof item === "string") {
          return cleanString(item);
        }
        if (item && typeof item === "object") {
          return cleanString(
            item.sourceRef
            || item.sourceUrl
            || item.id
            || item.title
            || item.evidenceRef
            || item.reference
            || item.standardTitle
          );
        }
        return "";
      })
      .filter(Boolean),
    (item) => item
  );
}

function normalizeRuleConfig(value, sourceRefs = []) {
  const config = Array.isArray(value)
    ? { values: value }
    : (value && typeof value === "object"
      ? value
      : (value !== undefined && value !== null && value !== "" ? { value } : {}));
  return {
    ...config,
    sourceRefs: normalizeSourceRefs(sourceRefs.length > 0 ? sourceRefs : config.sourceRefs),
  };
}

function normalizeTableName(industry, value) {
  const raw = cleanString(value);
  if (!raw) return "";
  const mapped = incubationAssetMap.mapChineseResearchTableAlias(industry, raw);
  if (mapped) {
    return mapped;
  }
  return normalizeIdentifier(raw, 48);
}

function normalizeFieldName(value) {
  const raw = cleanString(value);
  if (!raw) return "";
  return normalizeIdentifier(raw, 64) || raw;
}

function toOptionalString(value) {
  const normalized = cleanString(value);
  return normalized || null;
}

function buildTextRuleCode(prefix, text, index) {
  const normalized = normalizeIdentifier(text, 40);
  return `${prefix}_${normalized || index + 1}`;
}

function normalizeRelationPattern(industry, item) {
  if (!item) return null;
  if (typeof item === "string") {
    const text = cleanString(item);
    if (!text) return null;
    const matched = text.match(/(.+?)\s*(?:->|=>|→|鈫?)\s*(.+)/);
    return {
      fromTable: normalizeTableName(industry, matched?.[1] || ""),
      toTable: normalizeTableName(industry, matched?.[2] || ""),
      fromField: null,
      toField: null,
      relationType: "1:N",
      patternText: text,
    };
  }
  if (typeof item !== "object") return null;
  const fromLabel = item.fromTable || item.parentTable || item.sourceTable || item.leftTable || "";
  const toLabel = item.toTable || item.childTable || item.targetTable || item.rightTable || "";
  const fromTable = normalizeTableName(industry, fromLabel);
  const toTable = normalizeTableName(industry, toLabel);
  const patternText = cleanString(
    item.patternText
      || item.description
      || item.ruleName
      || (fromLabel || toLabel ? `${cleanString(fromLabel)} -> ${cleanString(toLabel)}` : "")
  );
  if (!fromTable && !toTable && !patternText) {
    return null;
  }
  return {
    fromTable: fromTable || "",
    toTable: toTable || "",
    fromField: toOptionalString(item.fromField || item.parentKeyField || item.sourceField),
    toField: toOptionalString(item.toField || item.childForeignKeyField || item.targetField),
    relationType: cleanString(item.relationType || item.type || "1:N") || "1:N",
    patternText: patternText || null,
  };
}

function normalizeRelationPatterns(industry, value) {
  return uniqueBy(
    asArray(value)
      .map((item) => normalizeRelationPattern(industry, item))
      .filter(Boolean),
    (item) => [
      item.fromTable,
      item.toTable,
      item.fromField || "",
      item.toField || "",
      item.patternText || "",
    ].join("::")
  );
}

function normalizeFieldSemantic(item, industry) {
  if (!item || typeof item !== "object") return null;
  const fieldName = normalizeFieldName(item.fieldName || item.name);
  if (!fieldName) return null;
  return {
    tableName: normalizeTableName(industry, item.tableName || ""),
    fieldName,
    fieldType: cleanString(item.fieldType || item.dataType || "VARCHAR") || "VARCHAR",
    fieldComment: cleanString(item.fieldComment || item.comment || item.description) || null,
    businessSemantic: cleanString(item.businessSemantic || item.semantic || item.semanticType) || null,
    nullable: item.nullable !== false,
    primaryKey: Boolean(item.primaryKey),
    uniqueKey: Boolean(item.uniqueKey),
    foreignKey: Boolean(item.foreignKey),
    foreignRefTable: normalizeTableName(industry, item.foreignRefTable || item.refTable || ""),
    foreignRefField: toOptionalString(item.foreignRefField || item.refField),
    validationRule: toOptionalString(item.validationRule),
    dirtyRuleCandidates: normalizeStringList(item.dirtyRuleCandidates),
  };
}

function normalizeFieldSemantics(industry, value) {
  const items = Array.isArray(value)
    ? value
    : (value && typeof value === "object" && Array.isArray(value.fields) ? value.fields : []);
  return uniqueBy(
    items
      .map((item) => normalizeFieldSemantic(item, industry))
      .filter(Boolean),
    (item) => `${item.tableName || "*"}::${item.fieldName}`
  );
}

function normalizeCodeRule(item, index) {
  if (!item) return null;
  if (typeof item === "string") {
    const text = cleanString(item);
    if (!text) return null;
    return {
      ruleCode: buildTextRuleCode("code_rule", text, index),
      ruleName: text.slice(0, 120),
      tableName: "",
      fieldName: "",
      description: text,
      ruleConfig: { description: text },
      status: "active",
    };
  }
  if (typeof item !== "object") return null;
  const ruleName = cleanString(item.ruleName || item.name || item.description);
  if (!ruleName) return null;
  const description = cleanString(item.description || item.ruleConfig?.description || ruleName);
  return {
    ruleCode: cleanString(item.ruleCode) || buildTextRuleCode("code_rule", ruleName, index),
    ruleName,
    tableName: cleanString(item.tableName || ""),
    fieldName: cleanString(item.fieldName || item.targetField || item.ruleConfig?.targetField || ""),
    description: description || null,
    ruleConfig: asObject(item.ruleConfig, description ? { description } : {}),
    status: cleanString(item.status || "active") || "active",
  };
}

function normalizeCodeRules(value) {
  return uniqueBy(
    asArray(value)
      .map((item, index) => normalizeCodeRule(item, index))
      .filter(Boolean),
    (item) => [item.ruleCode, item.tableName, item.fieldName, item.ruleName].join("::")
  );
}

function normalizeRealismRules(value) {
  const normalized = asArray(value)
    .map((item) => {
      if (typeof item === "string") return cleanString(item);
      if (item && typeof item === "object") {
        return cleanString(item.ruleName || item.description || item.summary);
      }
      return "";
    })
    .filter(Boolean);
  return uniqueBy(normalized, (item) => item);
}

function normalizeFieldRule(item, industry) {
  if (!item || typeof item !== "object") return null;
  const fieldName = normalizeFieldName(item.fieldName);
  const generatorType = cleanString(item.generatorType);
  if (!fieldName || !generatorType) return null;
  const sourceRefs = normalizeSourceRefs(item.sourceRefs || item.ruleConfig?.sourceRefs);
  return {
    ruleCode: cleanString(item.ruleCode) || null,
    tableName: normalizeTableName(industry, item.tableName || ""),
    fieldName,
    generatorType,
    sourceRefs,
    ruleConfig: normalizeRuleConfig(item.ruleConfig, sourceRefs),
    status: cleanString(item.status || "active") || "active",
  };
}

function normalizeFieldRules(industry, value) {
  return uniqueBy(
    asArray(value)
      .map((item) => normalizeFieldRule(item, industry))
      .filter(Boolean),
    (item) => `${item.tableName || "*"}::${item.fieldName}::${item.generatorType}`
  );
}

function normalizeComplianceRule(item, index, industry) {
  if (!item || typeof item !== "object") return null;
  const ruleName = cleanString(item.ruleName || item.name || item.description);
  const fieldName = normalizeFieldName(item.fieldName);
  if (!ruleName || !fieldName) return null;
  const sourceRefs = normalizeSourceRefs(item.sourceRefs || item.ruleConfig?.sourceRefs);
  return {
    ruleCode: cleanString(item.ruleCode) || buildTextRuleCode("compliance_rule", ruleName, index),
    ruleName,
    tableName: normalizeTableName(industry, item.tableName || ""),
    fieldName,
    ruleType: cleanString(item.ruleType || "CUSTOM") || "CUSTOM",
    issueCategory: cleanString(item.issueCategory || "COMPLIANCE") || "COMPLIANCE",
    severity: cleanString(item.severity || "medium") || "medium",
    sourceRefs,
    ruleConfig: normalizeRuleConfig(item.ruleConfig, sourceRefs),
    status: cleanString(item.status || "active") || "active",
  };
}

function normalizeComplianceRules(industry, value) {
  return uniqueBy(
    asArray(value)
      .map((item, index) => normalizeComplianceRule(item, index, industry))
      .filter(Boolean),
    (item) => `${item.ruleCode}::${item.tableName || "*"}::${item.fieldName}`
  );
}

function normalizeResearchTableSpec(industry, item) {
  if (!item) return null;
  if (typeof item === "string") {
    const tableName = normalizeTableName(industry, item);
    return tableName ? { tableName, tableLabel: null, tableComment: null, sourceRefs: [] } : null;
  }
  if (typeof item !== "object") return null;
  const tableName = normalizeTableName(industry, item.tableName || item.name || "");
  if (!tableName) return null;
  return {
    tableName,
    tableLabel: cleanString(item.tableLabel || item.tableNameZh || item.label || item.nameZh) || null,
    tableComment: cleanString(item.tableComment || item.comment || item.description || item.summary) || null,
    sourceRefs: normalizeSourceRefs(item.sourceRefs || item.evidenceRefs),
  };
}

function normalizeDictSuggestionSpec(item) {
  if (!item) return null;
  if (typeof item === "string") {
    const dictType = cleanString(item);
    return dictType
      ? {
          dictType,
          dictName: dictType,
          tableName: dictType.endsWith("_dict") ? dictType : `${dictType}_dict`,
          tableComment: null,
          values: [],
          sourceRefs: [],
        }
      : null;
  }
  if (typeof item !== "object") return null;
  const dictType = cleanString(item.dictType || item.tableName || item.dictName || item.name);
  if (!dictType) return null;
  return {
    dictType,
    dictName: cleanString(item.dictName || item.name || item.tableComment || item.tableName) || dictType,
    tableName: cleanString(item.tableName) || (dictType.endsWith("_dict") ? dictType : `${dictType}_dict`),
    tableComment: cleanString(item.tableComment || item.description) || null,
    values: asArray(item.values).map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (!entry || typeof entry !== "object") {
        return null;
      }
      return {
        itemCode: cleanString(entry.itemCode || entry.code) || null,
        itemLabel: cleanString(entry.itemLabel || entry.label || entry.name) || null,
        valueRange: cleanString(entry.valueRange || entry.range || entry.scope) || null,
      };
    }).filter(Boolean),
    sourceRefs: normalizeSourceRefs(item.sourceRefs || item.evidenceRefs),
  };
}

function normalizeResearchCatalog(industry, value) {
  const catalog = asObject(value, {});
  return {
    ...catalog,
    industryLabel: toOptionalString(catalog.industryLabel),
    subdomain: toOptionalString(catalog.subdomain),
    businessObjects: normalizeStringList(catalog.businessObjects),
    businessActions: normalizeStringList(catalog.businessActions),
    businessResults: normalizeStringList(catalog.businessResults),
    canonicalModules: normalizeStringList(catalog.canonicalModules),
    candidateTables: uniqueBy(
      asArray(catalog.candidateTables)
        .map((item) => normalizeTableName(industry, item))
        .filter(Boolean),
      (item) => item
    ),
    candidateTableSpecs: uniqueBy(
      asArray(catalog.candidateTableSpecs)
        .map((item) => normalizeResearchTableSpec(industry, item))
        .filter(Boolean),
      (item) => item.tableName
    ),
    relationSuggestions: normalizeStringList(catalog.relationSuggestions),
    dictSuggestions: normalizeStringList(catalog.dictSuggestions),
    dictSuggestionSpecs: uniqueBy(
      asArray(catalog.dictSuggestionSpecs)
        .map((item) => normalizeDictSuggestionSpec(item))
        .filter(Boolean),
      (item) => `${item.dictType}::${item.tableName}`
    ),
  };
}

function normalizeDictionaryItem(item) {
  if (!item || typeof item !== "object") return null;
  const dictType = cleanString(item.dictType);
  const itemCode = cleanString(item.itemCode);
  const itemLabel = cleanString(item.itemLabel);
  if (!dictType || !itemCode || !itemLabel) return null;
  const itemValue = asObject(item.itemValue, {});
  const sourceRefs = normalizeSourceRefs(item.sourceRefs || itemValue.sourceRefs);
  return {
    dictType,
    categoryCode: cleanString(item.categoryCode || "") || null,
    categoryName: cleanString(item.categoryName || "") || null,
    itemCode,
    itemLabel,
    itemValue: {
      ...itemValue,
      sourceRefs,
    },
    sourceRefs,
    weight: Number(item.weight ?? 1),
    sortOrder: Number(item.sortOrder ?? 0),
    status: cleanString(item.status || "active") || "active",
  };
}

function normalizeDictionaries(value) {
  return uniqueBy(
    asArray(value)
      .map((item) => normalizeDictionaryItem(item))
      .filter(Boolean),
    (item) => `${item.dictType}::${item.categoryCode || "*"}::${item.itemCode}`
  );
}

function normalizeDistributionRule(item, index) {
  if (!item || typeof item !== "object") return null;
  const ruleType = cleanString(item.ruleType);
  const ruleName = cleanString(item.ruleName || item.name);
  if (!ruleType || !ruleName) return null;
  const sourceRefs = normalizeSourceRefs(item.sourceRefs || item.ruleConfig?.sourceRefs);
  return {
    ruleType,
    ruleName,
    ruleCode: cleanString(item.ruleCode) || buildTextRuleCode("distribution_rule", `${ruleType}_${ruleName}`, index),
    sourceRefs,
    ruleConfig: normalizeRuleConfig(item.ruleConfig, sourceRefs),
    status: cleanString(item.status || "active") || "active",
  };
}

function normalizeDistributionRules(value) {
  return uniqueBy(
    asArray(value)
      .map((item, index) => normalizeDistributionRule(item, index))
      .filter(Boolean),
    (item) => `${item.ruleType}::${item.ruleCode}`
  );
}

function normalizeExtendedRule(item, index) {
  if (!item || typeof item !== "object") return null;
  const ruleCategory = cleanString(item.ruleCategory);
  const moduleKey = cleanString(item.moduleKey);
  const ruleName = cleanString(item.ruleName || item.name);
  if (!ruleCategory || !moduleKey || !ruleName) return null;
  const sourceRefs = normalizeSourceRefs(item.sourceRefs || item.ruleConfig?.sourceRefs);
  return {
    ruleCategory,
    moduleKey,
    ruleCode: cleanString(item.ruleCode) || buildTextRuleCode("extended_rule", `${moduleKey}_${ruleName}`, index),
    ruleName,
    industryScope: toOptionalString(item.industryScope),
    sceneScope: toOptionalString(item.sceneScope),
    tableName: toOptionalString(item.tableName),
    fieldName: toOptionalString(item.fieldName),
    sourceRefs,
    ruleConfig: normalizeRuleConfig(item.ruleConfig, sourceRefs),
    sortOrder: Number(item.sortOrder ?? 0),
    status: cleanString(item.status || "active") || "active",
  };
}

function normalizeExtendedRules(value) {
  return uniqueBy(
    asArray(value)
      .map((item, index) => normalizeExtendedRule(item, index))
      .filter(Boolean),
    (item) => `${item.ruleCode}::${item.moduleKey}`
  );
}

function normalizeValueCorpora(value, industry) {
  const corpora = Array.isArray(value) ? { entries: value } : asObject(value, {});
  const entries = uniqueBy(
    asArray(corpora.entries)
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const fieldName = normalizeFieldName(item.fieldName || item.field || item.fieldPath);
        if (!fieldName) return null;
        return {
          tableName: normalizeTableName(industry, item.tableName || item.table || ""),
          fieldName,
          values: asArray(Array.isArray(item.values) ? item.values : item.sampleValues)
            .filter((entry) => entry !== null && entry !== undefined && entry !== ""),
          sourceRefs: normalizeSourceRefs(item.sourceRefs || item.evidenceRefs || item.references),
        };
      })
      .filter(Boolean),
    (item) => `${item.tableName || "*"}::${item.fieldName}`
  );
  const fields = asObject(corpora.fields, {});
  const tableFields = asObject(corpora.tableFields, {});
  entries.forEach((entry) => {
    fields[entry.fieldName] = uniqueBy([...(asArray(fields[entry.fieldName])), ...entry.values], (item) => JSON.stringify(item));
    if (entry.tableName) {
      tableFields[entry.tableName] = asObject(tableFields[entry.tableName], {});
      tableFields[entry.tableName][entry.fieldName] = uniqueBy(
        [...asArray(tableFields[entry.tableName][entry.fieldName]), ...entry.values],
        (item) => JSON.stringify(item)
      );
    }
  });
  return {
    ...corpora,
    entries,
    fields,
    tableFields,
  };
}

function dedupeTrainingRounds(value) {
  return uniqueBy(
    asArray(value).filter((item) => item && typeof item === "object"),
    (item) => {
      const roundNo = item.roundNo || "";
      const roundName = item.roundName || "";
      const createdAt = item.createdAt || "";
      if (roundNo || roundName) {
        return `${roundNo}::${roundName}`;
      }
      return `${item.incubationId || ""}::${createdAt}`;
    }
  ).sort((left, right) => Number(left.roundNo || 0) - Number(right.roundNo || 0));
}

function normalizeTrainingAssets(value) {
  const assets = asObject(value, {});
  const incubationProject = asObject(assets.incubationProject, null);
  if (!incubationProject) {
    return assets;
  }
  return {
    ...assets,
    incubationProject: {
      ...incubationProject,
      rounds: dedupeTrainingRounds(incubationProject.rounds),
    },
  };
}

function normalizeScenarioEnhancementPayload(payload) {
  const industry = payload?.industry || "";
  return {
    ...payload,
    recognition: asObject(payload.recognition, {}),
    researchCatalog: normalizeResearchCatalog(industry, payload.researchCatalog),
    modulePlanner: asObject(payload.modulePlanner, {}),
    schemaGuides: asObject(payload.schemaGuides, {}),
    relationPatterns: normalizeRelationPatterns(industry, payload.relationPatterns),
    stateMachines: asArray(payload.stateMachines),
    codeRules: normalizeCodeRules(payload.codeRules),
    fieldSemantics: normalizeFieldSemantics(industry, payload.fieldSemantics),
    valueCorpora: normalizeValueCorpora(payload.valueCorpora, industry),
    distributionProfiles: asObject(payload.distributionProfiles, {}),
    qualityGates: asObject(payload.qualityGates, {}),
    realismRules: normalizeRealismRules(payload.realismRules),
    dirtyDataProfiles: asObject(payload.dirtyDataProfiles, {}),
    trainingAssets: normalizeTrainingAssets(payload.trainingAssets),
    evaluationRubric: asObject(payload.evaluationRubric, {}),
    overridePolicies: asObject(payload.overridePolicies, {}),
    dictionaries: normalizeDictionaries(payload.dictionaries),
    distributionRules: normalizeDistributionRules(payload.distributionRules),
    fieldRules: normalizeFieldRules(industry, payload.fieldRules),
    complianceRules: normalizeComplianceRules(industry, payload.complianceRules),
    pluginBindings: asArray(payload.pluginBindings),
    extendedRules: normalizeExtendedRules(payload.extendedRules),
  };
}

function mergeStringArrayUnique(base, extra) {
  return normalizeStringList([...(asArray(base)), ...(asArray(extra))]);
}

module.exports = {
  asArray,
  asObject,
  cleanString,
  dedupeTrainingRounds,
  mergeStringArrayUnique,
  normalizeCodeRules,
  normalizeComplianceRules,
  normalizeDictionaries,
  normalizeDistributionRules,
  normalizeExtendedRules,
  normalizeFieldRules,
  normalizeFieldSemantics,
  normalizeIdentifier,
  normalizeRealismRules,
  normalizeRelationPatterns,
  normalizeResearchCatalog,
  normalizeScenarioEnhancementPayload,
  normalizeSourceRefs,
  normalizeTableName,
  normalizeTrainingAssets,
  normalizeValueCorpora,
  uniqueBy,
};
