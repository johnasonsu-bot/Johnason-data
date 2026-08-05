function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getCategoryRules(profile, category) {
  const mergedRules = [
    ...safeArray(profile?.extendedRules),
    ...safeArray(profile?.[`${category}Rules`]),
  ];
  return mergedRules.filter((item) => {
    if (!item || item.status === "inactive") return false;
    if (item.ruleCategory && item.ruleCategory !== category) return false;
    return true;
  });
}

function findTable(generatedTables, tableName) {
  return safeArray(generatedTables).find((item) => (item.tableName || item.table?.tableName) === tableName);
}

function buildTableRowMap(generatedTables, tableName, keyField) {
  const table = findTable(generatedTables, tableName);
  const map = new Map();
  safeArray(table?.rows).forEach((row) => {
    map.set(String(row[keyField]), row);
  });
  return map;
}

function hasField(row, fieldName) {
  return Object.prototype.hasOwnProperty.call(row || {}, fieldName);
}

function normalizeTableVolumes(tables, fieldName, targetTotal) {
  const positives = safeArray(tables).filter((item) => Number(item[fieldName] || 0) > 0);
  if (positives.length === 0) return;
  if (targetTotal <= 0) {
    positives.forEach((item) => {
      item[fieldName] = 0;
    });
    return;
  }
  const currentTotal = positives.reduce((sum, item) => sum + Number(item[fieldName] || 0), 0);
  if (currentTotal <= 0) return;
  const scaled = positives.map((item) => {
    const ideal = (Number(item[fieldName] || 0) / currentTotal) * targetTotal;
    return { item, base: Math.floor(ideal), fraction: ideal - Math.floor(ideal) };
  });
  let assigned = scaled.reduce((sum, item) => sum + item.base, 0);
  scaled.sort((left, right) => right.fraction - left.fraction);
  for (let index = 0; index < scaled.length && assigned < targetTotal; index += 1, assigned += 1) {
    scaled[index].base += 1;
  }
  scaled.forEach(({ item, base }) => {
    item[fieldName] = base;
  });
}

function applyCardinalityRulesToStrategy(strategy, profile) {
  const next = JSON.parse(JSON.stringify(strategy));
  const rules = getCategoryRules(profile, "cardinality");
  if (rules.length === 0) return next;
  const targetInitVolume = Number(next.globalConfig?.initVolume || safeArray(next.tables).reduce((sum, item) => sum + Number(item.initRows || 0), 0));
  const targetIncrementVolume = Number(next.globalConfig?.incrementVolume || safeArray(next.tables).reduce((sum, item) => sum + Number(item.incrRows || 0), 0));
  const tablesByName = new Map(safeArray(next.tables).map((item) => [item.tableName, item]));

  rules.forEach((rule) => {
    const config = rule.ruleConfig || {};
    const parent = tablesByName.get(config.parentTable);
    const child = tablesByName.get(config.childTable);
    if (!parent || !child) return;

    const avgChildren = Number(config.avgChildren || 0)
      || (() => {
        const distribution = config.distribution || {};
        const entries = Object.entries(distribution);
        if (entries.length === 0) return null;
        const totalWeight = entries.reduce((sum, [, weight]) => sum + Number(weight || 0), 0) || 1;
        return entries.reduce((sum, [count, weight]) => sum + Number(count) * Number(weight || 0), 0) / totalWeight;
      })()
      || ((Number(config.minChildren || 0) + Number(config.maxChildren || 0)) / 2)
      || 1;

    child.initRows = Math.max(child.initRows || 0, Math.round(Number(parent.initRows || 0) * avgChildren));
    child.incrRows = Math.max(child.incrRows || 0, Math.round(Number(parent.incrRows || 0) * Math.max(1, avgChildren * 0.4)));
  });

  normalizeTableVolumes(next.tables, "initRows", targetInitVolume);
  normalizeTableVolumes(next.tables, "incrRows", targetIncrementVolume);
  next.globalConfig.initVolume = targetInitVolume;
  next.globalConfig.incrementVolume = targetIncrementVolume;
  return next;
}

function buildCodeFromRule(rule, row, context = {}) {
  const config = rule.ruleConfig || {};
  const segments = safeArray(config.segments);
  if (segments.length === 0) return row[context.fieldName];
  const parts = segments.map((segment, index) => {
    if (segment.type === "const") return String(segment.value || "");
    if (segment.type === "year") return String(row[segment.sourceField] || context.now.getFullYear()).slice(0, Number(segment.length || 4));
    if (segment.type === "date") {
      const current = context.now;
      const yyyy = String(current.getFullYear());
      const MM = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      const HH = String(current.getHours()).padStart(2, "0");
      const mm = String(current.getMinutes()).padStart(2, "0");
      const ss = String(current.getSeconds()).padStart(2, "0");
      return String(segment.format || "yyyyMMdd")
        .replace("yyyy", yyyy)
        .replace("MM", MM)
        .replace("dd", dd)
        .replace("HH", HH)
        .replace("mm", mm)
        .replace("ss", ss);
    }
    if (segment.type === "region_code" || segment.type === "org_code" || segment.type === "grade_code") {
      const sourceValue = String(row[segment.sourceField] || "").replace(/[^A-Za-z0-9]/g, "");
      return sourceValue.slice(0, Number(segment.length || sourceValue.length || 2));
    }
    if (segment.type === "sequence") {
      const seq = String(context.serial || 1).padStart(Number(segment.length || 4), "0");
      return seq;
    }
    return String(row[segment.sourceField] || segment.value || "");
  });
  const code = parts.join("");
  const minLength = Number(config.minLength || 0);
  if (minLength > 0 && code.length < minLength) {
    return code.padEnd(minLength, "0");
  }
  return code;
}

function applyRowLevelRules(row, table, profile, context = {}) {
  const linkageRules = getCategoryRules(profile, "linkage").filter((item) => item.tableName === table.tableName);
  linkageRules.forEach((rule) => {
    const config = rule.ruleConfig || {};
    if (config.mode === "same_row_equal" && config.sourceField && config.targetField && hasField(row, config.sourceField) && hasField(row, config.targetField)) {
      row[config.targetField] = row[config.sourceField];
    }
    if (config.mode === "same_row_mapping" && config.sourceField && config.targetField && config.mapping && hasField(row, config.sourceField) && hasField(row, config.targetField)) {
      const value = row[config.sourceField];
      if (value !== undefined && value !== null) {
        row[config.targetField] = config.mapping[String(value)] ?? row[config.targetField];
      }
    }
    if (config.mode === "same_row_prefix_mapping" && config.sourceField && config.targetField && config.mapping && hasField(row, config.sourceField) && hasField(row, config.targetField)) {
      const value = String(row[config.sourceField] || "");
      const matchedKey = Object.keys(config.mapping).find((item) => value.startsWith(item));
      if (matchedKey) {
        row[config.targetField] = config.mapping[matchedKey];
      }
    }
  });

  const temporalRules = getCategoryRules(profile, "temporal").filter((item) => item.tableName === table.tableName);
  temporalRules.forEach((rule) => {
    const config = rule.ruleConfig || {};
    const sequence = safeArray(config.sequence);
    if (sequence.length < 2) return;
    const base = new Date(context.startedAt || Date.now()).getTime() + Number(context.serial || 1) * 60000;
    sequence.forEach((fieldName, index) => {
      if (row[fieldName] === undefined) return;
      const nextTime = new Date(base + index * Number(config.stepMinutes || 30) * 60000).toISOString().slice(0, 19).replace("T", " ");
      row[fieldName] = nextTime;
    });
  });

  const stateFlowRules = getCategoryRules(profile, "state_flow").filter((item) => item.tableName === table.tableName);
  stateFlowRules.forEach((rule) => {
    const config = rule.ruleConfig || {};
    const stateField = config.stateField || rule.fieldName;
    if (!stateField || row[stateField] === undefined) return;
    const allowedStates = safeArray(config.allowedStates);
    if (allowedStates.length > 0 && !allowedStates.includes(row[stateField])) {
      row[stateField] = allowedStates[0];
    }
    const stateEffects = config.stateEffects || {};
    const currentState = row[stateField];
    if (stateEffects[currentState] && typeof stateEffects[currentState] === "object") {
      Object.entries(stateEffects[currentState]).forEach(([field, value]) => {
        if (hasField(row, field)) {
          row[field] = value;
        }
      });
    }
  });

  const codeRules = getCategoryRules(profile, "code").filter((item) => item.tableName === table.tableName);
  codeRules.forEach((rule) => {
    const targetField = rule.fieldName || rule.ruleConfig?.targetField;
    if (!targetField || row[targetField] === undefined) return;
    row[targetField] = buildCodeFromRule(rule, row, { ...context, fieldName: targetField, now: new Date(context.startedAt || Date.now()) });
  });

  return row;
}

function applyDatasetRules(generatedTables, profile) {
  const cardinalityRules = getCategoryRules(profile, "cardinality");
  cardinalityRules.forEach((rule) => {
    const config = rule.ruleConfig || {};
    const parentTable = findTable(generatedTables, config.parentTable);
    const childTable = findTable(generatedTables, config.childTable);
    if (!parentTable || !childTable) return;
    const parentKeyField = config.parentKeyField || `${config.parentTable.replace(/.*\./, "").replace(/s$/, "")}_id`;
    const childForeignKeyField = config.childForeignKeyField;
    if (!childForeignKeyField) return;
    const parentIds = safeArray(parentTable.rows).map((row) => row[parentKeyField]).filter((value) => value !== undefined && value !== null);
    if (parentIds.length === 0) return;
    safeArray(childTable.rows).forEach((row, index) => {
      row[childForeignKeyField] = parentIds[index % parentIds.length];
    });
  });

  const linkageRules = getCategoryRules(profile, "linkage");
  linkageRules.forEach((rule) => {
    const config = rule.ruleConfig || {};
    if (config.mode !== "cross_table_copy") return;
    const parentTable = findTable(generatedTables, config.parentTable);
    const childTable = findTable(generatedTables, config.childTable);
    if (!parentTable || !childTable) return;
    const parentMap = buildTableRowMap(generatedTables, config.parentTable, config.parentKeyField);
    safeArray(childTable.rows).forEach((row) => {
      const parent = parentMap.get(String(row[config.childForeignKeyField]));
      if (!parent) return;
      safeArray(config.mappings).forEach((mapping) => {
        if (mapping.sourceField && mapping.targetField && hasField(row, mapping.targetField)) {
          row[mapping.targetField] = parent[mapping.sourceField];
        }
      });
    });
  });
}

function collectExtendedRuleIssues({ tableName, rows, addIssue, profile, tableRowsMap }) {
  let dirtyRows = 0;

  getCategoryRules(profile, "linkage").filter((item) => item.tableName === tableName).forEach((rule) => {
    const config = rule.ruleConfig || {};
    if (config.mode === "same_row_equal" && config.sourceField && config.targetField) {
      const count = rows.filter((row) => row[config.sourceField] !== undefined && row[config.targetField] !== undefined && String(row[config.sourceField]) !== String(row[config.targetField])).length;
      dirtyRows += addIssue(config.targetField, `EXT_LINKAGE_${rule.ruleCode}`, "一致性", count);
    }
    if (config.mode === "same_row_mapping" && config.sourceField && config.targetField && config.mapping) {
      const count = rows.filter((row) => {
        const expected = config.mapping[String(row[config.sourceField])];
        return expected !== undefined && String(row[config.targetField]) !== String(expected);
      }).length;
      dirtyRows += addIssue(config.targetField, `EXT_LINKAGE_${rule.ruleCode}`, "一致性", count);
    }
    if (config.mode === "cross_table_copy" && config.childTable === tableName) {
      const parentRows = tableRowsMap[config.parentTable] || [];
      const parentMap = new Map(parentRows.map((row) => [String(row[config.parentKeyField]), row]));
      const count = rows.filter((row) => {
        const parent = parentMap.get(String(row[config.childForeignKeyField]));
        if (!parent) return false;
        return safeArray(config.mappings).some((mapping) => String(row[mapping.targetField]) !== String(parent[mapping.sourceField]));
      }).length;
      dirtyRows += addIssue(config.childForeignKeyField, `EXT_LINKAGE_${rule.ruleCode}`, "一致性", count);
    }
  });

  getCategoryRules(profile, "temporal").filter((item) => item.tableName === tableName).forEach((rule) => {
    const config = rule.ruleConfig || {};
    const sequence = safeArray(config.sequence);
    if (sequence.length < 2) return;
    const count = rows.filter((row) => {
      for (let index = 1; index < sequence.length; index += 1) {
        const prev = new Date(String(row[sequence[index - 1]] || "")).getTime();
        const current = new Date(String(row[sequence[index]] || "")).getTime();
        if (Number.isNaN(prev) || Number.isNaN(current)) continue;
        if (current < prev) return true;
      }
      return false;
    }).length;
    dirtyRows += addIssue(sequence[1], `EXT_TEMPORAL_${rule.ruleCode}`, "时效性", count);
  });

  getCategoryRules(profile, "state_flow").filter((item) => item.tableName === tableName).forEach((rule) => {
    const config = rule.ruleConfig || {};
    const stateField = config.stateField || rule.fieldName;
    const allowedStates = safeArray(config.allowedStates);
    if (stateField && allowedStates.length > 0) {
      const count = rows.filter((row) => !allowedStates.includes(row[stateField])).length;
      dirtyRows += addIssue(stateField, `EXT_STATE_${rule.ruleCode}`, "合规性", count);
    }
    const stateEffects = config.stateEffects || {};
    if (stateField && stateEffects && typeof stateEffects === "object") {
      const count = rows.filter((row) => {
        const effects = stateEffects[row[stateField]];
        if (!effects || typeof effects !== "object") return false;
        return Object.entries(effects).some(([field, value]) => String(row[field]) !== String(value));
      }).length;
      dirtyRows += addIssue(stateField, `EXT_STATE_EFFECT_${rule.ruleCode}`, "一致性", count);
    }
  });

  getCategoryRules(profile, "code").filter((item) => item.tableName === tableName).forEach((rule) => {
    const config = rule.ruleConfig || {};
    const targetField = rule.fieldName || config.targetField;
    if (!targetField) return;
    const minLength = Number(config.minLength || 0);
    const pattern = config.pattern ? new RegExp(String(config.pattern)) : null;
    const count = rows.filter((row) => {
      const value = String(row[targetField] || "");
      if (minLength > 0 && value.length < minLength) return true;
      if (pattern && !pattern.test(value)) return true;
      return false;
    }).length;
    dirtyRows += addIssue(targetField, `EXT_CODE_${rule.ruleCode}`, "合规性", count);
  });

  getCategoryRules(profile, "cardinality").forEach((rule) => {
    const config = rule.ruleConfig || {};
    if (config.parentTable !== tableName) return;
    const parentRows = tableRowsMap[config.parentTable] || [];
    const childRows = tableRowsMap[config.childTable] || [];
    const parentKeyField = config.parentKeyField;
    const childForeignKeyField = config.childForeignKeyField;
    if (!parentKeyField || !childForeignKeyField) return;
    const childCounts = new Map();
    childRows.forEach((row) => {
      const key = String(row[childForeignKeyField]);
      childCounts.set(key, Number(childCounts.get(key) || 0) + 1);
    });
    const minChildren = Number(config.minChildren || 0);
    const maxChildren = Number(config.maxChildren || Number.MAX_SAFE_INTEGER);
    const count = parentRows.filter((row) => {
      const total = Number(childCounts.get(String(row[parentKeyField])) || 0);
      return total < minChildren || total > maxChildren;
    }).length;
    dirtyRows += addIssue(parentKeyField, `EXT_CARDINALITY_${rule.ruleCode}`, "一致性", count);
  });

  return dirtyRows;
}

module.exports = {
  applyCardinalityRulesToStrategy,
  applyRowLevelRules,
  applyDatasetRules,
  collectExtendedRuleIssues,
};
