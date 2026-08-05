const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");

function getScopedWhere(alias = "") {
  const projectId = getCurrentProjectId();
  if (!projectId) return { sql: "", params: [], projectId: null };
  const prefix = alias ? `${alias}.` : "";
  return { sql: `${prefix}project_id = ?`, params: [projectId], projectId };
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") {
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

function mapMonitorSource(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id === null || row.id === undefined ? null : Number(row.id),
    sourceId: Number(row.sourceId),
    sourceDomain: row.sourceDomain || "integration",
    selectedTables: parseJson(row.selectedTablesJson, []),
    databaseTableCount: row.databaseTableCount === null || row.databaseTableCount === undefined ? null : Number(row.databaseTableCount),
    syncedTableCount: Number(row.syncedTableCount || 0),
    submittedStrategyCount: Number(row.submittedStrategyCount || 0),
  };
}

function mapMonitorTable(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    monitorSourceId: Number(row.monitorSourceId),
    sourceId: Number(row.sourceId),
    enabled: Boolean(row.enabled),
    columnSnapshot: parseJson(row.columnSnapshotJson, []),
    lastProfile: parseJson(row.lastProfileJson, null),
    strategyId: row.strategyId ? Number(row.strategyId) : null,
    currentVersionNo: row.currentVersionNo === null || row.currentVersionNo === undefined ? null : Number(row.currentVersionNo),
    currentVersionId: row.currentVersionId === null || row.currentVersionId === undefined ? null : Number(row.currentVersionId),
    configuredRuleCount: row.configuredRuleCount === null || row.configuredRuleCount === undefined ? 0 : Number(row.configuredRuleCount),
  };
}

function normalizeFieldRuleMode(field) {
  const valueRangeConfig = field?.valueRangeConfig && typeof field.valueRangeConfig === "object" ? field.valueRangeConfig : {};
  const valueRangeSnapshot = field?.valueRangeSnapshot && typeof field.valueRangeSnapshot === "object" ? field.valueRangeSnapshot : {};
  return String(valueRangeConfig.mode || valueRangeSnapshot.mode || "none").toLowerCase();
}

function countConfiguredRules(fieldStrategies, advancedRules = []) {
  const fields = Array.isArray(fieldStrategies) ? fieldStrategies : [];
  const fieldRuleCount = fields.filter((field) => Boolean(
    field?.isPrimaryKey
    || field?.nonNullCheck
    || field?.duplicateCheck
    || (Array.isArray(field?.complianceRuleCodes) && field.complianceRuleCodes.length > 0)
    || normalizeFieldRuleMode(field) !== "none"
  )).length;
  const advancedRuleCount = (Array.isArray(advancedRules) ? advancedRules : []).filter((rule) => rule?.enabled !== false).length;
  return fieldRuleCount + advancedRuleCount;
}

function mapRegexRule(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    matchExamples: parseJson(row.matchExamplesJson, []),
    mismatchExamples: parseJson(row.mismatchExamplesJson, []),
    isBuiltin: Boolean(row.isBuiltin),
  };
}

function mapDictionary(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    projectId: row.projectId === null || row.projectId === undefined ? null : Number(row.projectId),
    sourceSystemId: row.sourceSystemId === null || row.sourceSystemId === undefined ? null : Number(row.sourceSystemId),
    sourceId: row.sourceId === null || row.sourceId === undefined ? null : Number(row.sourceId),
    filterConfig: parseJson(row.filterConfigJson, []),
    itemCount: Number(row.itemCount || 0),
  };
}

function mapDictionaryItem(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    dictId: Number(row.dictId),
    minValue: row.minValue === null || row.minValue === undefined ? null : Number(row.minValue),
    maxValue: row.maxValue === null || row.maxValue === undefined ? null : Number(row.maxValue),
    sortOrder: Number(row.sortOrder || 0),
  };
}

function mapStrategy(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    monitorTableId: Number(row.monitorTableId),
    sourceId: Number(row.sourceId),
    currentVersionNo: row.currentVersionNo === null || row.currentVersionNo === undefined ? null : Number(row.currentVersionNo),
    currentVersionId: row.currentVersionId === null || row.currentVersionId === undefined ? null : Number(row.currentVersionId),
  };
}

function mapStrategyVersion(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    strategyId: Number(row.strategyId),
    versionNo: Number(row.versionNo || 1),
    profileSnapshot: parseJson(row.profileSnapshotJson, null),
    recommendationContext: parseJson(row.recommendationContextJson, null),
    fieldStrategies: parseJson(row.fieldStrategyJson, []),
    advancedRules: parseJson(row.advancedRuleJson, []),
    sqlBundle: parseJson(row.sqlBundleJson, null),
    aiProviderId: row.aiProviderId === null || row.aiProviderId === undefined ? null : Number(row.aiProviderId),
  };
}

function mapRecommendationRun(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    projectId: Number(row.projectId),
    monitorTableId: Number(row.monitorTableId),
    sourceId: Number(row.sourceId),
    samplingConfig: parseJson(row.samplingConfigJson, {}),
    profileSnapshot: parseJson(row.profileSnapshotJson, null),
    fieldStrategies: parseJson(row.candidateFieldJson, []),
    advancedRules: parseJson(row.candidateRuleJson, []),
    recommendationContext: parseJson(row.recommendationContextJson, null),
    modelUsed: Boolean(row.modelUsed),
    aiProviderId: row.aiProviderId === null || row.aiProviderId === undefined ? null : Number(row.aiProviderId),
  };
}

function mapAiConfig(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    defaultModelProviderId: row.defaultModelProviderId === null || row.defaultModelProviderId === undefined ? null : Number(row.defaultModelProviderId),
    temperature: row.temperature === null || row.temperature === undefined ? null : Number(row.temperature),
    maxTokens: row.maxTokens === null || row.maxTokens === undefined ? null : Number(row.maxTokens),
    timeoutMs: row.timeoutMs === null || row.timeoutMs === undefined ? null : Number(row.timeoutMs),
    thinkingEnabled: Boolean(row.thinkingEnabled),
    reasoningEffort: row.reasoningEffort || null,
    thinkingBudget: row.thinkingBudget === null || row.thinkingBudget === undefined ? null : Number(row.thinkingBudget),
  };
}

function mapAiConfigVersion(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    aiConfigId: Number(row.aiConfigId),
    versionNo: Number(row.versionNo || 0),
    defaultModelProviderId: row.defaultModelProviderId === null || row.defaultModelProviderId === undefined ? null : Number(row.defaultModelProviderId),
    temperature: row.temperature === null || row.temperature === undefined ? null : Number(row.temperature),
    maxTokens: row.maxTokens === null || row.maxTokens === undefined ? null : Number(row.maxTokens),
    timeoutMs: row.timeoutMs === null || row.timeoutMs === undefined ? null : Number(row.timeoutMs),
    thinkingEnabled: Boolean(row.thinkingEnabled),
    reasoningEffort: row.reasoningEffort || null,
    thinkingBudget: row.thinkingBudget === null || row.thinkingBudget === undefined ? null : Number(row.thinkingBudget),
  };
}

function mapTask(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    projectId: row.projectId === null || row.projectId === undefined ? null : Number(row.projectId),
    monitorTableId: Number(row.monitorTableId),
    sourceId: Number(row.sourceId),
    strategyId: Number(row.strategyId),
    strategyVersionId: Number(row.strategyVersionId),
    taskVersionNo: row.taskVersionNo === null || row.taskVersionNo === undefined ? null : Number(row.taskVersionNo),
    latestVersionNo: row.latestVersionNo === null || row.latestVersionNo === undefined ? null : Number(row.latestVersionNo),
    latestStrategyVersionId: row.latestStrategyVersionId === null || row.latestStrategyVersionId === undefined ? null : Number(row.latestStrategyVersionId),
    scheduleEnabled: Boolean(row.scheduleEnabled),
    fetchConfig: parseJson(row.fetchConfigJson, {}),
    scheduleConfig: parseJson(row.scheduleConfigJson, null),
    latestExecutionInfo: parseJson(row.latestExecutionInfoJson, null),
    connectionConfig: parseJson(row.connectionConfig, {}),
  };
}

function mapTaskRun(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    projectId: row.projectId === null || row.projectId === undefined ? null : Number(row.projectId),
    taskId: Number(row.taskId),
    issueCount: Number(row.issueCount || 0),
    statsCount: Number(row.statsCount || 0),
    executionInfo: parseJson(row.executionInfoJson, null),
  };
}

function mapQualityDataSource(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    sourceName: row.sourceName,
    sourceCode: row.sourceCode,
    sourceDomain: "quality",
    sourceType: row.sourceType,
    connectionConfig: parseJson(row.connectionConfig, {}),
    ownerName: row.ownerName || "system",
    status: row.status || "active",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function stripQualityShadowPrefix(code) {
  return String(code || "").trim().replace(/^(qc__)+/, "");
}

async function listMonitorSources() {
  const scoped = getScopedWhere("ds");
  const [rows] = await pool.query(
    `SELECT ds.id AS sourceId,
            ds.source_name AS sourceName,
            ds.source_code AS sourceCode,
            'quality' AS sourceDomain,
            ds.source_type AS sourceType,
            ds.connection_config AS connectionConfig,
            ds.owner_name AS ownerName,
            ds.status AS sourceStatus,
            ds.updated_at AS sourceUpdatedAt,
            ms.id,
            ms.scope_mode AS scopeMode,
            ms.selected_tables_json AS selectedTablesJson,
            ms.detail_table_name AS detailTableName,
            ms.stats_table_name AS statsTableName,
            ms.status,
            ms.created_by AS createdBy,
            ms.created_at AS createdAt,
            ms.updated_at AS updatedAt,
            COUNT(DISTINCT CASE WHEN mt.enabled = 1 THEN mt.id END) AS syncedTableCount,
            COUNT(DISTINCT CASE WHEN s.strategy_status = 'submitted' THEN s.id END) AS submittedStrategyCount
     FROM qc_data_sources ds
     LEFT JOIN qc_monitor_source ms ON ms.source_id = ds.id
     LEFT JOIN qc_monitor_table mt ON mt.monitor_source_id = ms.id
     LEFT JOIN qc_strategy s ON s.monitor_table_id = mt.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     GROUP BY ds.id, ds.source_name, ds.source_code, ds.source_type, ds.connection_config, ds.owner_name, ds.status, ds.updated_at,
              ms.id, ms.scope_mode, ms.selected_tables_json, ms.detail_table_name, ms.stats_table_name, ms.status, ms.created_by, ms.created_at, ms.updated_at
     ORDER BY ds.id DESC`,
    scoped.params
  );

  return rows.map((row) => ({
    ...mapMonitorSource(row),
    connectionConfig: parseJson(row.connectionConfig, {}),
  }));
}

async function getMonitorSourceById(id) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, source_id AS sourceId, scope_mode AS scopeMode, selected_tables_json AS selectedTablesJson,
            detail_table_name AS detailTableName, stats_table_name AS statsTableName, status, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM qc_monitor_source
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );

  return rows[0] ? mapMonitorSource(rows[0]) : null;
}

async function getMonitorSourceBySourceId(sourceId) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, source_id AS sourceId, scope_mode AS scopeMode, selected_tables_json AS selectedTablesJson,
            detail_table_name AS detailTableName, stats_table_name AS statsTableName, status, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM qc_monitor_source
     WHERE source_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [sourceId, ...scoped.params]
  );

  return rows[0] ? mapMonitorSource(rows[0]) : null;
}

async function createMonitorSource(payload, db = pool) {
  const projectId = getCurrentProjectId();
  const [result] = await db.query(
    `INSERT INTO qc_monitor_source
      (project_id, source_id, scope_mode, selected_tables_json, detail_table_name, stats_table_name, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.sourceId,
      payload.scopeMode,
      JSON.stringify(payload.selectedTables || []),
      payload.detailTableName,
      payload.statsTableName,
      payload.status || "active",
      payload.createdBy || "system",
    ]
  );

  return result.insertId;
}

async function updateMonitorSource(id, payload, db = pool) {
  const scoped = getScopedWhere("");
  await db.query(
    `UPDATE qc_monitor_source
     SET scope_mode = ?, selected_tables_json = ?, detail_table_name = ?, stats_table_name = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.scopeMode,
      JSON.stringify(payload.selectedTables || []),
      payload.detailTableName,
      payload.statsTableName,
      payload.status || "active",
      id,
      ...scoped.params,
    ]
  );
}

async function listMonitorTablesByMonitorSourceId(monitorSourceId) {
  const scoped = getScopedWhere("mt");
  const [rows] = await pool.query(
    `SELECT mt.id, mt.monitor_source_id AS monitorSourceId, mt.source_id AS sourceId, mt.table_name AS tableName,
            mt.full_table_name AS fullTableName, mt.table_comment AS tableComment, mt.enabled, mt.strategy_status AS strategyStatus,
            mt.column_snapshot_json AS columnSnapshotJson, mt.last_profile_json AS lastProfileJson,
            mt.last_sync_at AS lastSyncAt, mt.last_recommended_at AS lastRecommendedAt, mt.last_submitted_at AS lastSubmittedAt,
            mt.created_at AS createdAt, mt.updated_at AS updatedAt
     FROM qc_monitor_table mt
     WHERE mt.monitor_source_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     ORDER BY mt.table_name ASC`,
    [monitorSourceId, ...scoped.params]
  );

  return rows.map(mapMonitorTable);
}

async function listMonitorTablesBySourceId(sourceId) {
  const scoped = getScopedWhere("mt");
  const [rows] = await pool.query(
    `SELECT mt.id, mt.monitor_source_id AS monitorSourceId, mt.source_id AS sourceId, mt.table_name AS tableName,
            mt.full_table_name AS fullTableName, mt.table_comment AS tableComment, mt.enabled, mt.strategy_status AS strategyStatus,
            mt.column_snapshot_json AS columnSnapshotJson, mt.last_profile_json AS lastProfileJson,
            mt.last_sync_at AS lastSyncAt, mt.last_recommended_at AS lastRecommendedAt, mt.last_submitted_at AS lastSubmittedAt,
            mt.created_at AS createdAt, mt.updated_at AS updatedAt
     FROM qc_monitor_table mt
     WHERE mt.source_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     ORDER BY mt.table_name ASC`,
    [sourceId, ...scoped.params]
  );

  return rows.map(mapMonitorTable);
}

async function getMonitorTableById(id) {
  const scoped = getScopedWhere("mt");
  const [rows] = await pool.query(
    `SELECT mt.id, mt.monitor_source_id AS monitorSourceId, mt.source_id AS sourceId, mt.table_name AS tableName,
            mt.full_table_name AS fullTableName, mt.table_comment AS tableComment, mt.enabled, mt.strategy_status AS strategyStatus,
            mt.column_snapshot_json AS columnSnapshotJson, mt.last_profile_json AS lastProfileJson,
            mt.last_sync_at AS lastSyncAt, mt.last_recommended_at AS lastRecommendedAt, mt.last_submitted_at AS lastSubmittedAt,
            mt.created_at AS createdAt, mt.updated_at AS updatedAt,
            ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType,
            ds.connection_config AS connectionConfig,
            ms.detail_table_name AS detailTableName, ms.stats_table_name AS statsTableName
     FROM qc_monitor_table mt
     JOIN qc_data_sources ds ON ds.id = mt.source_id
     JOIN qc_monitor_source ms ON ms.id = mt.monitor_source_id
     WHERE mt.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );

  return rows[0]
    ? {
      ...mapMonitorTable(rows[0]),
      sourceName: rows[0].sourceName,
      sourceCode: rows[0].sourceCode,
      sourceType: rows[0].sourceType,
      connectionConfig: parseJson(rows[0].connectionConfig, {}),
      detailTableName: rows[0].detailTableName,
      statsTableName: rows[0].statsTableName,
    }
    : null;
}

async function createMonitorTable(payload, db = pool) {
  const projectId = getCurrentProjectId();
  const [result] = await db.query(
    `INSERT INTO qc_monitor_table
      (project_id, monitor_source_id, source_id, table_name, full_table_name, table_comment, enabled, strategy_status, column_snapshot_json, last_sync_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.monitorSourceId,
      payload.sourceId,
      payload.tableName,
      payload.fullTableName || payload.tableName,
      payload.tableComment || null,
      payload.enabled ? 1 : 0,
      payload.strategyStatus || "pending",
      JSON.stringify(payload.columnSnapshot || []),
      payload.lastSyncAt || new Date(),
    ]
  );

  return result.insertId;
}

async function updateMonitorTable(id, payload, db = pool) {
  const fields = [];
  const params = [];
  const mapping = {
    tableName: "table_name",
    fullTableName: "full_table_name",
    tableComment: "table_comment",
    strategyStatus: "strategy_status",
    lastSyncAt: "last_sync_at",
    lastRecommendedAt: "last_recommended_at",
    lastSubmittedAt: "last_submitted_at",
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      fields.push(`${column} = ?`);
      params.push(payload[key]);
    }
  });

  if (Object.prototype.hasOwnProperty.call(payload, "enabled")) {
    fields.push("enabled = ?");
    params.push(payload.enabled ? 1 : 0);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "columnSnapshot")) {
    fields.push("column_snapshot_json = ?");
    params.push(JSON.stringify(payload.columnSnapshot || []));
  }

  if (Object.prototype.hasOwnProperty.call(payload, "lastProfile")) {
    fields.push("last_profile_json = ?");
    params.push(payload.lastProfile ? JSON.stringify(payload.lastProfile) : null);
  }

  if (!fields.length) {
    return;
  }

  const scoped = getScopedWhere("");
  params.push(id, ...scoped.params);
  await db.query(`UPDATE qc_monitor_table SET ${fields.join(", ")} WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`, params);
}

async function deleteMonitorTable(id, db = pool) {
  const scoped = getScopedWhere("");
  const [result] = await db.query(
    `DELETE FROM qc_monitor_table WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function listRegexRules() {
  const [rows] = await pool.query(
    `SELECT id, rule_code AS ruleCode, rule_name AS ruleName, rule_scene AS ruleScene,
            regex_pattern AS regexPattern, match_example_json AS matchExamplesJson,
            mismatch_example_json AS mismatchExamplesJson, severity, status, is_builtin AS isBuiltin,
            created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM qc_regex_rule
     WHERE status <> 'deleted'
     ORDER BY is_builtin DESC, updated_at DESC, id DESC`
  );

  return rows.map(mapRegexRule);
}

async function listRegexRuleCodes() {
  const [rows] = await pool.query("SELECT rule_code AS ruleCode FROM qc_regex_rule");
  return rows.map((row) => String(row.ruleCode || "").trim()).filter(Boolean);
}

async function getRegexRuleById(id) {
  const [rows] = await pool.query(
    `SELECT id, rule_code AS ruleCode, rule_name AS ruleName, rule_scene AS ruleScene,
            regex_pattern AS regexPattern, match_example_json AS matchExamplesJson,
            mismatch_example_json AS mismatchExamplesJson, severity, status, is_builtin AS isBuiltin,
            created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM qc_regex_rule
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] ? mapRegexRule(rows[0]) : null;
}

async function createRegexRule(payload, db = pool) {
  const [result] = await db.query(
    `INSERT INTO qc_regex_rule
      (rule_code, rule_name, rule_scene, regex_pattern, match_example_json, mismatch_example_json, severity, status, is_builtin, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.ruleCode,
      payload.ruleName,
      payload.ruleScene || "compliance",
      payload.regexPattern,
      JSON.stringify(payload.matchExamples || []),
      JSON.stringify(payload.mismatchExamples || []),
      payload.severity || "medium",
      payload.status || "active",
      payload.isBuiltin ? 1 : 0,
      payload.createdBy || "system",
    ]
  );

  return result.insertId;
}

async function updateRegexRule(id, payload, db = pool) {
  await db.query(
    `UPDATE qc_regex_rule
     SET rule_code = ?, rule_name = ?, rule_scene = ?, regex_pattern = ?, match_example_json = ?,
         mismatch_example_json = ?, severity = ?, status = ?, is_builtin = ?
     WHERE id = ?`,
    [
      payload.ruleCode,
      payload.ruleName,
      payload.ruleScene || "compliance",
      payload.regexPattern,
      JSON.stringify(payload.matchExamples || []),
      JSON.stringify(payload.mismatchExamples || []),
      payload.severity || "medium",
      payload.status || "active",
      payload.isBuiltin ? 1 : 0,
      id,
    ]
  );
}

async function deleteRegexRule(id) {
  const [result] = await pool.query("UPDATE qc_regex_rule SET status = 'deleted' WHERE id = ?", [id]);
  return Number(result.affectedRows || 0) > 0;
}

async function listDictionaries() {
  const scoped = getScopedWhere("d");
  const [rows] = await pool.query(
    `SELECT d.id, d.project_id AS projectId, d.dict_code AS dictCode, d.dict_name AS dictName, d.dict_category AS dictCategory,
            d.value_type AS valueType, d.dict_desc AS dictDesc, d.registration_mode AS registrationMode,
            d.source_system_id AS sourceSystemId, d.source_system_code AS sourceSystemCode,
            d.source_system_name AS sourceSystemName, d.source_id AS sourceId, d.source_code AS sourceCode,
            d.source_name AS sourceName, d.source_table AS sourceTable, d.code_field AS codeField,
            d.value_field AS valueField, d.label_field AS labelField, d.filter_config_json AS filterConfigJson,
            d.last_registered_at AS lastRegisteredAt, d.status, d.created_by AS createdBy,
            d.created_at AS createdAt, d.updated_at AS updatedAt, COUNT(i.id) AS itemCount
     FROM qc_standard_dictionary d
     LEFT JOIN qc_standard_dictionary_item i ON i.dict_id = d.id
     WHERE d.status <> 'deleted'${scoped.sql ? ` AND ${scoped.sql}` : ""}
     GROUP BY d.id, d.project_id, d.dict_code, d.dict_name, d.dict_category, d.value_type, d.dict_desc,
              d.registration_mode, d.source_system_id, d.source_system_code, d.source_system_name,
              d.source_id, d.source_code, d.source_name, d.source_table, d.code_field, d.value_field,
              d.label_field, d.filter_config_json, d.last_registered_at, d.status, d.created_by,
              d.created_at, d.updated_at
     ORDER BY d.updated_at DESC, d.id DESC`
    , scoped.params
  );

  return rows.map(mapDictionary);
}

async function listDictionariesByBusinessSystem(sourceSystem = {}) {
  const systemId = Number(sourceSystem.id || sourceSystem.businessSystemId || 0) || null;
  const systemCode = String(sourceSystem.systemCode || sourceSystem.sourceSystemCode || "").trim().toLowerCase();
  if (!systemId && !systemCode) return [];
  const scoped = getScopedWhere("d");
  const systemConditions = [];
  const params = [];
  if (systemId) {
    systemConditions.push("d.source_system_id = ?");
    params.push(systemId);
  }
  if (systemCode) {
    systemConditions.push("LOWER(COALESCE(d.source_system_code, '')) = ?");
    params.push(systemCode);
  }
  params.push(...scoped.params);
  const [rows] = await pool.query(
    `SELECT d.id, d.project_id AS projectId, d.dict_code AS dictCode, d.dict_name AS dictName, d.dict_category AS dictCategory,
            d.value_type AS valueType, d.dict_desc AS dictDesc, d.registration_mode AS registrationMode,
            d.source_system_id AS sourceSystemId, d.source_system_code AS sourceSystemCode,
            d.source_system_name AS sourceSystemName, d.source_id AS sourceId, d.source_code AS sourceCode,
            d.source_name AS sourceName, d.source_table AS sourceTable, d.code_field AS codeField,
            d.value_field AS valueField, d.label_field AS labelField, d.filter_config_json AS filterConfigJson,
            d.last_registered_at AS lastRegisteredAt, d.status, d.created_by AS createdBy,
            d.created_at AS createdAt, d.updated_at AS updatedAt
     FROM qc_standard_dictionary d
     WHERE d.status = 'active'
       AND (${systemConditions.join(" OR ")})${scoped.sql ? ` AND ${scoped.sql}` : ""}
     ORDER BY d.updated_at DESC, d.id DESC`,
    params
  );
  return rows.map(mapDictionary);
}

async function getDictionaryById(id) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, project_id AS projectId, dict_code AS dictCode, dict_name AS dictName, dict_category AS dictCategory,
            value_type AS valueType, dict_desc AS dictDesc, registration_mode AS registrationMode,
            source_system_id AS sourceSystemId, source_system_code AS sourceSystemCode,
            source_system_name AS sourceSystemName, source_id AS sourceId, source_code AS sourceCode,
            source_name AS sourceName, source_table AS sourceTable, code_field AS codeField,
            value_field AS valueField, label_field AS labelField, filter_config_json AS filterConfigJson,
            last_registered_at AS lastRegisteredAt, status, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM qc_standard_dictionary
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );

  return rows[0] ? mapDictionary(rows[0]) : null;
}

async function getDictionaryByCode(dictCode, excludeId = null, includeDeleted = false) {
  const scoped = getScopedWhere("");
  const params = [String(dictCode || "").trim()];
  const excludeSql = excludeId ? " AND id <> ?" : "";
  const statusSql = includeDeleted ? "" : " AND status <> 'deleted'";
  if (excludeId) params.push(Number(excludeId));
  params.push(...scoped.params);
  const [rows] = await pool.query(
    `SELECT id, project_id AS projectId, dict_code AS dictCode, dict_name AS dictName, status
     FROM qc_standard_dictionary
     WHERE dict_code = ?${statusSql}${excludeSql}${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    params
  );
  return rows[0] ? { ...rows[0], id: Number(rows[0].id) } : null;
}

async function listDictionaryItems(dictId) {
  const [rows] = await pool.query(
    `SELECT id, dict_id AS dictId, item_code AS itemCode, item_label AS itemLabel, item_value AS itemValue,
            min_value AS \`minValue\`, max_value AS \`maxValue\`, sort_order AS sortOrder, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM qc_standard_dictionary_item
     WHERE dict_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [dictId]
  );

  return rows.map(mapDictionaryItem);
}

async function createDictionary(payload, db = pool) {
  const scoped = getScopedWhere("");
  const [result] = await db.query(
    `INSERT INTO qc_standard_dictionary
      (project_id, dict_code, dict_name, dict_category, value_type, dict_desc, registration_mode,
       source_system_id, source_system_code, source_system_name, source_id, source_code, source_name,
       source_table, code_field, value_field, label_field, filter_config_json, last_registered_at,
       status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      scoped.projectId,
      payload.dictCode,
      payload.dictName,
      payload.dictCategory || "general",
      payload.valueType || "string",
      payload.dictDesc || null,
      payload.registrationMode || "manual",
      payload.sourceSystemId || null,
      payload.sourceSystemCode || null,
      payload.sourceSystemName || null,
      payload.sourceId || null,
      payload.sourceCode || null,
      payload.sourceName || null,
      payload.sourceTable || null,
      payload.codeField || null,
      payload.valueField || null,
      payload.labelField || null,
      JSON.stringify(payload.filterConfig || []),
      payload.registrationMode === "table" ? new Date() : null,
      payload.status || "active",
      payload.createdBy || "system",
    ]
  );

  return result.insertId;
}

async function updateDictionary(id, payload, db = pool) {
  const scoped = getScopedWhere("");
  await db.query(
    `UPDATE qc_standard_dictionary
     SET dict_code = ?, dict_name = ?, dict_category = ?, value_type = ?, dict_desc = ?, registration_mode = ?,
         source_system_id = ?, source_system_code = ?, source_system_name = ?, source_id = ?, source_code = ?,
         source_name = ?, source_table = ?, code_field = ?, value_field = ?, label_field = ?,
         filter_config_json = ?, last_registered_at = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.dictCode,
      payload.dictName,
      payload.dictCategory || "general",
      payload.valueType || "string",
      payload.dictDesc || null,
      payload.registrationMode || "manual",
      payload.sourceSystemId || null,
      payload.sourceSystemCode || null,
      payload.sourceSystemName || null,
      payload.sourceId || null,
      payload.sourceCode || null,
      payload.sourceName || null,
      payload.sourceTable || null,
      payload.codeField || null,
      payload.valueField || null,
      payload.labelField || null,
      JSON.stringify(payload.filterConfig || []),
      payload.registrationMode === "table" ? new Date() : null,
      payload.status || "active",
      id,
      ...scoped.params,
    ]
  );
}

async function replaceDictionaryItems(dictId, items, db = pool) {
  await db.query("DELETE FROM qc_standard_dictionary_item WHERE dict_id = ?", [dictId]);
  for (const item of items || []) {
    await db.query(
      `INSERT INTO qc_standard_dictionary_item
        (dict_id, item_code, item_label, item_value, min_value, max_value, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dictId,
        item.itemCode,
        item.itemLabel,
        item.itemValue || null,
        item.minValue ?? null,
        item.maxValue ?? null,
        Number(item.sortOrder || 0),
        item.status || "active",
      ]
    );
  }
}

async function deleteDictionary(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE qc_standard_dictionary SET status = 'deleted' WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function batchDeleteDictionaries(ids) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE qc_standard_dictionary SET status = 'deleted' WHERE id IN (?) AND status <> 'deleted'${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [ids, ...scoped.params]
  );
  return Number(result.affectedRows || 0);
}

async function listDictionaryBusinessSystems() {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, system_name AS systemName, system_code AS systemCode, system_short_name AS systemShortName,
            description, status
     FROM dm_business_systems
     WHERE status = 'active'${scoped.sql ? ` AND ${scoped.sql}` : ""}
     ORDER BY system_name ASC, id ASC`,
    scoped.params
  );
  return rows.map((row) => ({ ...row, id: Number(row.id) }));
}

async function getDictionaryBusinessSystemById(id) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, system_name AS systemName, system_code AS systemCode, system_short_name AS systemShortName,
            description, status
     FROM dm_business_systems
     WHERE id = ? AND status = 'active'${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );
  return rows[0] ? { ...rows[0], id: Number(rows[0].id) } : null;
}

async function resolveBusinessSystemForTable(tableName) {
  const scoped = getScopedWhere("r");
  const simpleTableName = String(tableName || "").split(".").filter(Boolean).pop();
  const [rows] = await pool.query(
    `SELECT r.business_system_id AS businessSystemId, r.source_snapshot_json AS sourceSnapshotJson,
            bs.system_name AS systemName, bs.system_code AS systemCode, bs.system_short_name AS systemShortName
     FROM dm_resources r
     JOIN dm_business_systems bs ON bs.id = r.business_system_id
     WHERE r.table_name = ? AND r.status = 'active'${scoped.sql ? ` AND ${scoped.sql}` : ""}
     ORDER BY r.updated_at DESC, r.id DESC
     LIMIT 1`,
    [simpleTableName, ...scoped.params]
  );
  if (!rows[0]) return null;
  const row = rows[0];
  const tableTokens = new Set(String(simpleTableName || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  if (tableTokens.size > 0) {
    const projectScoped = getScopedWhere("");
    const [systemRows] = await pool.query(
      `SELECT id, system_name AS systemName, system_code AS systemCode, system_short_name AS systemShortName
       FROM dm_business_systems
       WHERE status = 'active'
         AND LOWER(COALESCE(system_short_name, '')) IN (${Array.from(tableTokens).map(() => "?").join(", ")})
         ${projectScoped.sql ? `AND ${projectScoped.sql}` : ""}
       ORDER BY id ASC`,
      [...tableTokens, ...projectScoped.params]
    );
    if (systemRows.length === 1) return { ...systemRows[0], id: Number(systemRows[0].id) };
  }
  const snapshot = parseJson(row.sourceSnapshotJson, {});
  const sourceSystemToken = String(snapshot.sourceSystem || snapshot.systemCode || "").trim().toLowerCase();
  if (sourceSystemToken) {
    const projectScoped = getScopedWhere("");
    const [matchedRows] = await pool.query(
      `SELECT id, system_name AS systemName, system_code AS systemCode, system_short_name AS systemShortName
       FROM dm_business_systems
       WHERE status = 'active'
         AND (LOWER(system_code) = ? OR LOWER(COALESCE(system_short_name, '')) = ?)
         ${projectScoped.sql ? `AND ${projectScoped.sql}` : ""}
       LIMIT 1`,
      [sourceSystemToken, sourceSystemToken, ...projectScoped.params]
    );
    if (matchedRows[0]) return { ...matchedRows[0], id: Number(matchedRows[0].id) };
  }
  return {
    id: Number(row.businessSystemId),
    systemName: row.systemName,
    systemCode: row.systemCode,
    systemShortName: row.systemShortName,
  };
}

async function listStrategyTables(filters = {}) {
  const where = ["mt.enabled = 1"];
  const params = [];
  const scoped = getScopedWhere("mt");
  if (scoped.sql) {
    where.push(scoped.sql);
    params.push(...scoped.params);
  }

  if (filters.sourceId) {
    where.push("mt.source_id = ?");
    params.push(Number(filters.sourceId));
  }

  if (filters.strategyStatus) {
    where.push("COALESCE(s.strategy_status, mt.strategy_status) = ?");
    params.push(String(filters.strategyStatus));
  }

  if (filters.businessSystemId) {
    where.push("mt.business_system_id = ?");
    params.push(Number(filters.businessSystemId));
  }

  if (filters.keyword) {
    where.push("(mt.table_name LIKE ? OR ds.source_name LIKE ? OR ds.source_code LIKE ?)");
    const keyword = `%${String(filters.keyword).trim()}%`;
    params.push(keyword, keyword, keyword);
  }

  const [rows] = await pool.query(
    `SELECT mt.id, mt.monitor_source_id AS monitorSourceId, mt.source_id AS sourceId, mt.table_name AS tableName,
            mt.full_table_name AS fullTableName, mt.table_comment AS tableComment, mt.enabled,
            mt.business_system_id AS businessSystemId, bs.system_name AS businessSystemName, mt.importance_level AS importanceLevel,
            (SELECT GROUP_CONCAT(t.tag_name ORDER BY t.tag_name SEPARATOR '、') FROM qc_monitor_table_tag_relation rel JOIN qc_quality_tag t ON t.id=rel.tag_id WHERE rel.monitor_table_id=mt.id AND rel.project_id=mt.project_id) AS qualityTagNames,
            (SELECT GROUP_CONCAT(t.id ORDER BY t.id SEPARATOR ',') FROM qc_monitor_table_tag_relation rel JOIN qc_quality_tag t ON t.id=rel.tag_id WHERE rel.monitor_table_id=mt.id AND rel.project_id=mt.project_id) AS qualityTagIds,
            mt.strategy_status AS strategyStatus, mt.column_snapshot_json AS columnSnapshotJson,
            mt.last_profile_json AS lastProfileJson, mt.last_sync_at AS lastSyncAt,
            mt.last_recommended_at AS lastRecommendedAt, mt.last_submitted_at AS lastSubmittedAt,
            mt.created_at AS createdAt, mt.updated_at AS updatedAt,
            ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType,
            ms.detail_table_name AS detailTableName, ms.stats_table_name AS statsTableName,
            s.id AS strategyId, s.current_version_no AS currentVersionNo, s.current_version_id AS currentVersionId,
            s.strategy_status AS strategyWorkflowStatus, s.current_summary AS currentSummary,
            sv.field_strategy_json AS fieldStrategyJson, sv.advanced_rule_json AS advancedRuleJson
     FROM qc_monitor_table mt
     JOIN qc_data_sources ds ON ds.id = mt.source_id
     JOIN qc_monitor_source ms ON ms.id = mt.monitor_source_id
     LEFT JOIN qc_strategy s ON s.monitor_table_id = mt.id
     LEFT JOIN qc_strategy_version sv ON sv.id = s.current_version_id
     LEFT JOIN dm_business_systems bs ON bs.id=mt.business_system_id AND bs.project_id=mt.project_id
     WHERE ${where.join(" AND ")}
     ORDER BY mt.last_recommended_at DESC, mt.last_submitted_at DESC, mt.updated_at DESC, mt.id DESC`,
    params
  );

  return rows.map((row) => ({
    ...mapMonitorTable(row),
    sourceName: row.sourceName,
    sourceCode: row.sourceCode,
    sourceType: row.sourceType,
    detailTableName: row.detailTableName,
    statsTableName: row.statsTableName,
    strategyStatus: row.strategyWorkflowStatus || row.strategyStatus,
    currentSummary: row.currentSummary || "",
    configuredRuleCount: countConfiguredRules(parseJson(row.fieldStrategyJson, []), parseJson(row.advancedRuleJson, [])),
    businessSystemId: row.businessSystemId ? Number(row.businessSystemId) : null,
    businessSystemName: row.businessSystemName || null,
    importanceLevel: row.importanceLevel || "normal",
    qualityTags: row.qualityTagNames ? String(row.qualityTagNames).split("、") : [],
    qualityTagIds: row.qualityTagIds ? String(row.qualityTagIds).split(",").map(Number) : [],
  }));
}

async function getStrategyByMonitorTableId(monitorTableId) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, monitor_table_id AS monitorTableId, source_id AS sourceId, table_name AS tableName,
            current_version_no AS currentVersionNo, current_version_id AS currentVersionId,
            strategy_status AS strategyStatus, current_summary AS currentSummary,
            last_recommended_at AS lastRecommendedAt, last_submitted_at AS lastSubmittedAt,
            submitted_by AS submittedBy, created_at AS createdAt, updated_at AS updatedAt
     FROM qc_strategy
     WHERE monitor_table_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [monitorTableId, ...scoped.params]
  );

  return rows[0] ? mapStrategy(rows[0]) : null;
}

async function createRecommendationRun(payload, db = pool) {
  const projectId = getCurrentProjectId();
  const [result] = await db.query(
    `INSERT INTO qc_recommendation_run
      (project_id, monitor_table_id, source_id, table_name, run_status, sampling_config_json, profile_snapshot_json,
       candidate_field_json, candidate_rule_json, summary_text, model_used, ai_provider_id, ai_model_name, ai_model_version,
       recommendation_context_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.monitorTableId,
      payload.sourceId,
      payload.tableName,
      payload.runStatus || "pending_review",
      JSON.stringify(payload.samplingConfig || {}),
      JSON.stringify(payload.profileSnapshot || {}),
      JSON.stringify(payload.fieldStrategies || []),
      JSON.stringify(payload.advancedRules || []),
      payload.summaryText || "",
      payload.modelUsed ? 1 : 0,
      payload.aiProviderId ?? null,
      payload.aiModelName || null,
      payload.aiModelVersion || null,
      JSON.stringify(payload.recommendationContext || {}),
    ]
  );
  return getRecommendationRunById(Number(result.insertId), db);
}

async function getRecommendationRunById(id, db = pool) {
  const scoped = getScopedWhere("rr");
  const [rows] = await db.query(
    `SELECT rr.id, rr.project_id AS projectId, rr.monitor_table_id AS monitorTableId, rr.source_id AS sourceId,
            rr.table_name AS tableName, rr.run_status AS runStatus, rr.sampling_config_json AS samplingConfigJson,
            rr.profile_snapshot_json AS profileSnapshotJson, rr.candidate_field_json AS candidateFieldJson,
            rr.candidate_rule_json AS candidateRuleJson, rr.summary_text AS summaryText, rr.model_used AS modelUsed,
            rr.ai_provider_id AS aiProviderId, rr.ai_model_name AS aiModelName, rr.ai_model_version AS aiModelVersion,
            rr.recommendation_context_json AS recommendationContextJson, rr.reviewed_by AS reviewedBy,
            rr.reviewed_at AS reviewedAt, rr.created_at AS createdAt, rr.updated_at AS updatedAt
     FROM qc_recommendation_run rr
     WHERE rr.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );
  return rows[0] ? mapRecommendationRun(rows[0]) : null;
}

async function updateRecommendationRun(id, payload, db = pool) {
  const fields = [];
  const params = [];
  const mapping = {
    runStatus: "run_status",
    summaryText: "summary_text",
    modelUsed: "model_used",
    aiProviderId: "ai_provider_id",
    aiModelName: "ai_model_name",
    aiModelVersion: "ai_model_version",
    reviewedBy: "reviewed_by",
    reviewedAt: "reviewed_at",
  };
  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      fields.push(`${column} = ?`);
      params.push(payload[key]);
    }
  });
  const jsonMapping = {
    samplingConfig: "sampling_config_json",
    profileSnapshot: "profile_snapshot_json",
    fieldStrategies: "candidate_field_json",
    advancedRules: "candidate_rule_json",
    recommendationContext: "recommendation_context_json",
  };
  Object.entries(jsonMapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      fields.push(`${column} = ?`);
      params.push(JSON.stringify(payload[key] ?? (key === "fieldStrategies" || key === "advancedRules" ? [] : {})));
    }
  });
  if (!fields.length) return;
  const scoped = getScopedWhere("");
  params.push(id, ...scoped.params);
  await db.query(`UPDATE qc_recommendation_run SET ${fields.join(", ")} WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`, params);
}

async function createStrategy(payload, db = pool) {
  const projectId = getCurrentProjectId();
  const [result] = await db.query(
    `INSERT INTO qc_strategy
      (project_id, monitor_table_id, source_id, table_name, current_version_no, current_version_id, strategy_status, current_summary,
       last_recommended_at, last_submitted_at, submitted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.monitorTableId,
      payload.sourceId,
      payload.tableName,
      payload.currentVersionNo ?? null,
      payload.currentVersionId ?? null,
      payload.strategyStatus || "draft",
      payload.currentSummary || null,
      payload.lastRecommendedAt || null,
      payload.lastSubmittedAt || null,
      payload.submittedBy || null,
    ]
  );

  return result.insertId;
}

async function updateStrategy(id, payload, db = pool) {
  const fields = [];
  const params = [];
  const mapping = {
    currentVersionNo: "current_version_no",
    currentVersionId: "current_version_id",
    strategyStatus: "strategy_status",
    currentSummary: "current_summary",
    lastRecommendedAt: "last_recommended_at",
    lastSubmittedAt: "last_submitted_at",
    submittedBy: "submitted_by",
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      fields.push(`${column} = ?`);
      params.push(payload[key]);
    }
  });

  if (!fields.length) {
    return;
  }

  const scoped = getScopedWhere("");
  params.push(id, ...scoped.params);
  await db.query(`UPDATE qc_strategy SET ${fields.join(", ")} WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`, params);
}

async function createStrategyVersion(payload, db = pool) {
  const projectId = getCurrentProjectId();
  const [result] = await db.query(
    `INSERT INTO qc_strategy_version
      (project_id, strategy_id, version_no, version_status, profile_snapshot_json, recommendation_context_json, field_strategy_json, advanced_rule_json,
       ai_summary_text, ai_provider_id, ai_model_name, ai_model_version, sql_bundle_json, sql_content, reviewed_by, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.strategyId,
      payload.versionNo,
      payload.versionStatus || "draft",
      payload.profileSnapshot ? JSON.stringify(payload.profileSnapshot) : null,
      payload.recommendationContext ? JSON.stringify(payload.recommendationContext) : null,
      JSON.stringify(payload.fieldStrategies || []),
      JSON.stringify(payload.advancedRules || []),
      payload.aiSummaryText || null,
      payload.aiProviderId ?? null,
      payload.aiModelName || null,
      payload.aiModelVersion || null,
      payload.sqlBundle ? JSON.stringify(payload.sqlBundle) : null,
      payload.sqlContent || null,
      payload.reviewedBy || null,
      payload.reviewedAt || null,
    ]
  );

  return result.insertId;
}

async function updateStrategyVersion(id, payload, db = pool) {
  const fields = [];
  const params = [];
  const mapping = {
    versionNo: "version_no",
    versionStatus: "version_status",
    aiSummaryText: "ai_summary_text",
    aiProviderId: "ai_provider_id",
    aiModelName: "ai_model_name",
    aiModelVersion: "ai_model_version",
    sqlContent: "sql_content",
    reviewedBy: "reviewed_by",
    reviewedAt: "reviewed_at",
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      fields.push(`${column} = ?`);
      params.push(payload[key]);
    }
  });

  if (Object.prototype.hasOwnProperty.call(payload, "profileSnapshot")) {
    fields.push("profile_snapshot_json = ?");
    params.push(payload.profileSnapshot ? JSON.stringify(payload.profileSnapshot) : null);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "recommendationContext")) {
    fields.push("recommendation_context_json = ?");
    params.push(payload.recommendationContext ? JSON.stringify(payload.recommendationContext) : null);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "fieldStrategies")) {
    fields.push("field_strategy_json = ?");
    params.push(JSON.stringify(payload.fieldStrategies || []));
  }

  if (Object.prototype.hasOwnProperty.call(payload, "advancedRules")) {
    fields.push("advanced_rule_json = ?");
    params.push(JSON.stringify(payload.advancedRules || []));
  }

  if (Object.prototype.hasOwnProperty.call(payload, "sqlBundle")) {
    fields.push("sql_bundle_json = ?");
    params.push(payload.sqlBundle ? JSON.stringify(payload.sqlBundle) : null);
  }

  if (!fields.length) {
    return;
  }

  const scoped = getScopedWhere("");
  params.push(id, ...scoped.params);
  await db.query(`UPDATE qc_strategy_version SET ${fields.join(", ")} WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`, params);
}

async function listStrategyVersions(strategyId, db = pool) {
  const scoped = getScopedWhere("v");
  const [rows] = await db.query(
    `SELECT v.id, v.strategy_id AS strategyId, v.version_no AS versionNo, v.version_status AS versionStatus,
            profile_snapshot_json AS profileSnapshotJson, recommendation_context_json AS recommendationContextJson,
            field_strategy_json AS fieldStrategyJson, advanced_rule_json AS advancedRuleJson, ai_summary_text AS aiSummaryText,
            ai_provider_id AS aiProviderId, ai_model_name AS aiModelName, ai_model_version AS aiModelVersion,
            sql_bundle_json AS sqlBundleJson, sql_content AS sqlContent,
            reviewed_by AS reviewedBy, reviewed_at AS reviewedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM qc_strategy_version v
     WHERE v.strategy_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     ORDER BY v.version_no DESC, v.id DESC`,
    [strategyId, ...scoped.params]
  );

  return rows.map(mapStrategyVersion);
}

async function getStrategyVersionById(id, db = pool) {
  const scoped = getScopedWhere("v");
  const [rows] = await db.query(
    `SELECT v.id, v.strategy_id AS strategyId, v.version_no AS versionNo, v.version_status AS versionStatus,
            v.profile_snapshot_json AS profileSnapshotJson, v.recommendation_context_json AS recommendationContextJson,
            v.field_strategy_json AS fieldStrategyJson, v.advanced_rule_json AS advancedRuleJson, v.ai_summary_text AS aiSummaryText,
            v.ai_provider_id AS aiProviderId, v.ai_model_name AS aiModelName, v.ai_model_version AS aiModelVersion,
            v.sql_bundle_json AS sqlBundleJson, v.sql_content AS sqlContent,
            v.reviewed_by AS reviewedBy, v.reviewed_at AS reviewedAt, v.created_at AS createdAt, v.updated_at AS updatedAt
     FROM qc_strategy_version v
     JOIN qc_strategy s ON s.id = v.strategy_id
     WHERE v.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );

  return rows[0] ? mapStrategyVersion(rows[0]) : null;
}

async function deleteStrategyVersion(id, db = pool) {
  const scoped = getScopedWhere("");
  const [result] = await db.query(
    `DELETE FROM qc_strategy_version WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function deleteStrategy(id, db = pool) {
  const scoped = getScopedWhere("");
  const [result] = await db.query(
    `DELETE FROM qc_strategy WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function countTasksByStrategyVersion(versionId, db = pool) {
  const scoped = getScopedWhere("");
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM qc_task
     WHERE strategy_version_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [versionId, ...scoped.params]
  );
  return Number(rows[0]?.total || 0);
}

async function listAiConfigs() {
  const [rows] = await pool.query(
    `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.thinking_enabled AS thinkingEnabled, c.reasoning_effort AS reasoningEffort, c.thinking_budget AS thinkingBudget,
            c.system_prompt AS systemPrompt, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM quality_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     ORDER BY c.id DESC`
  );
  return rows.map(mapAiConfig);
}

async function getAiConfigById(id, db = pool) {
  const [rows] = await db.query(
    `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.thinking_enabled AS thinkingEnabled, c.reasoning_effort AS reasoningEffort, c.thinking_budget AS thinkingBudget,
            c.system_prompt AS systemPrompt, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM quality_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     WHERE c.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ? mapAiConfig(rows[0]) : null;
}

async function getNextAiConfigVersionNo(aiConfigId, db = pool) {
  const [rows] = await db.query(
    "SELECT COALESCE(MAX(version_no), 0) + 1 AS nextVersion FROM quality_ai_config_versions WHERE ai_config_id = ?",
    [aiConfigId]
  );
  return Number(rows[0]?.nextVersion || 1);
}

async function createAiConfigVersion(payload, db = pool) {
  const versionNo = payload.versionNo || await getNextAiConfigVersionNo(payload.aiConfigId, db);
  const [result] = await db.query(
    `INSERT INTO quality_ai_config_versions
      (ai_config_id, version_no, version_status, scene_name, scene_code,
       default_model_provider_id, default_model_name, default_model_version,
       temperature, max_tokens, timeout_ms, thinking_enabled, reasoning_effort, thinking_budget, system_prompt, description,
       owner_name, created_by, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.aiConfigId,
      versionNo,
      payload.versionStatus || "published",
      payload.sceneName,
      payload.sceneCode,
      payload.defaultModelProviderId || null,
      payload.defaultModelName || null,
      payload.defaultModelVersion || null,
      payload.temperature ?? null,
      payload.maxTokens ?? null,
      payload.timeoutMs ?? null,
      payload.thinkingEnabled ? 1 : 0,
      payload.reasoningEffort || null,
      payload.thinkingBudget ?? null,
      payload.systemPrompt || null,
      payload.description || null,
      payload.ownerName || "system",
      payload.createdBy || "system",
      payload.versionStatus === "published" ? new Date() : null,
    ]
  );
  return { id: Number(result.insertId), versionNo };
}

async function listAiConfigVersions(aiConfigId) {
  const [rows] = await pool.query(
    `SELECT v.id, v.ai_config_id AS aiConfigId, v.version_no AS versionNo, v.version_status AS versionStatus,
            v.scene_name AS sceneName, v.scene_code AS sceneCode,
            v.default_model_provider_id AS defaultModelProviderId,
            provider.config_name AS defaultModelProviderName,
            v.default_model_name AS defaultModelName, v.default_model_version AS defaultModelVersion,
            v.temperature, v.max_tokens AS maxTokens, v.timeout_ms AS timeoutMs,
            v.thinking_enabled AS thinkingEnabled, v.reasoning_effort AS reasoningEffort, v.thinking_budget AS thinkingBudget,
            v.system_prompt AS systemPrompt, v.description, v.owner_name AS ownerName,
            v.created_by AS createdBy, v.published_at AS publishedAt, v.created_at AS createdAt
     FROM quality_ai_config_versions v
     LEFT JOIN model_providers provider ON provider.id = v.default_model_provider_id
     WHERE v.ai_config_id = ?
     ORDER BY v.version_no DESC, v.id DESC`,
    [aiConfigId]
  );
  return rows.map(mapAiConfigVersion);
}

async function getAiConfigByCode(sceneCode) {
  const [rows] = await pool.query(
    `SELECT id, scene_name AS sceneName, scene_code AS sceneCode,
            default_model_provider_id AS defaultModelProviderId,
            default_model_name AS defaultModelName, default_model_version AS defaultModelVersion,
            temperature, max_tokens AS maxTokens, timeout_ms AS timeoutMs,
            thinking_enabled AS thinkingEnabled, reasoning_effort AS reasoningEffort, thinking_budget AS thinkingBudget,
            system_prompt AS systemPrompt, description, owner_name AS ownerName,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM quality_ai_configs
     WHERE scene_code = ?
     LIMIT 1`,
    [sceneCode]
  );
  return rows[0] ? mapAiConfig(rows[0]) : null;
}

async function updateAiConfig(id, payload, db = pool) {
  const [result] = await db.query(
    `UPDATE quality_ai_configs
     SET scene_name = ?, scene_code = ?, default_model_provider_id = ?, default_model_name = ?, default_model_version = ?,
         temperature = ?, max_tokens = ?, timeout_ms = ?, thinking_enabled = ?, reasoning_effort = ?, thinking_budget = ?,
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
      payload.thinkingEnabled ? 1 : 0,
      payload.reasoningEffort || null,
      payload.thinkingBudget ?? null,
      payload.systemPrompt || null,
      payload.description || null,
      payload.ownerName,
      payload.status,
      id,
    ]
  );
  if (Number(result.affectedRows || 0) === 0) {
    return null;
  }
  return getAiConfigById(id, db);
}

async function listSubmittedStrategyOptions() {
  const scoped = getScopedWhere("mt");
  const [rows] = await pool.query(
    `SELECT mt.id AS monitorTableId, mt.source_id AS sourceId, mt.table_name AS tableName, mt.table_comment AS tableComment,
            ds.source_name AS sourceName, ds.source_code AS sourceCode,
            s.id AS strategyId, v.id AS strategyVersionId, v.version_no AS currentVersionNo,
            latest.latestVersionNo AS latestVersionNo,
            v.ai_summary_text AS aiSummaryText,
            EXISTS (
              SELECT 1
              FROM qc_task task_status
              WHERE task_status.strategy_id = s.id
                AND task_status.project_id = mt.project_id
            ) AS hasTask
     FROM qc_strategy_version v
     JOIN (
       SELECT strategy_id, MAX(version_no) AS latestVersionNo
       FROM qc_strategy_version
       WHERE version_status = 'submitted'
       GROUP BY strategy_id
     ) latest ON latest.strategy_id = v.strategy_id AND latest.latestVersionNo = v.version_no
     JOIN qc_strategy s ON s.id = v.strategy_id
     JOIN qc_monitor_table mt ON mt.id = s.monitor_table_id
     JOIN qc_data_sources ds ON ds.id = mt.source_id
     WHERE mt.enabled = 1
       AND v.version_status = 'submitted'
       ${scoped.sql ? `AND ${scoped.sql}` : ""}
     ORDER BY ds.source_name ASC, mt.table_name ASC, v.version_no DESC, v.id DESC`,
    scoped.params,
  );
  return rows.map((row) => ({
    monitorTableId: Number(row.monitorTableId),
    sourceId: Number(row.sourceId),
    tableName: row.tableName,
    tableComment: row.tableComment || "",
    sourceName: row.sourceName,
    sourceCode: row.sourceCode,
    strategyId: Number(row.strategyId),
    strategyVersionId: Number(row.strategyVersionId),
    currentVersionNo: Number(row.currentVersionNo || 0),
    latestVersionNo: Number(row.latestVersionNo || row.currentVersionNo || 0),
    aiSummaryText: row.aiSummaryText || "",
    hasTask: Boolean(Number(row.hasTask || 0)),
  }));
}

async function listTasks(filters = {}) {
  const where = ["1=1"];
  const params = [];
  const scoped = getScopedWhere("t");
  if (scoped.sql) {
    where.push(scoped.sql);
    params.push(...scoped.params);
  }
  if (filters.status) {
    where.push("t.status = ?");
    params.push(String(filters.status));
  }
  if (filters.sourceId) {
    where.push("t.source_id = ?");
    params.push(Number(filters.sourceId));
  }
  if (filters.monitorTableId) {
    where.push("t.monitor_table_id = ?");
    params.push(Number(filters.monitorTableId));
  }
  if (filters.keyword) {
    const keyword = `%${String(filters.keyword).trim()}%`;
    where.push("(t.task_name LIKE ? OR t.task_code LIKE ? OR t.table_name LIKE ?)");
    params.push(keyword, keyword, keyword);
  }

  const [rows] = await pool.query(
    `SELECT t.id, t.project_id AS projectId, t.task_name AS taskName, t.task_code AS taskCode, t.monitor_table_id AS monitorTableId,
            t.source_id AS sourceId, t.table_name AS tableName, t.strategy_id AS strategyId,
            t.strategy_version_id AS strategyVersionId, t.detail_table_name AS detailTableName, t.stats_table_name AS statsTableName,
            t.fetch_mode AS fetchMode, t.fetch_config_json AS fetchConfigJson, t.schedule_enabled AS scheduleEnabled,
            t.schedule_config_json AS scheduleConfigJson, t.status, t.owner_name AS ownerName,
            t.last_run_time AS lastRunTime, t.last_batch_id AS lastBatchId, t.last_run_status AS lastRunStatus,
            t.latest_execution_info_json AS latestExecutionInfoJson, t.created_at AS createdAt, t.updated_at AS updatedAt,
            ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.connection_config AS connectionConfig,
            mt.table_comment AS tableComment,
            sv_task.version_no AS taskVersionNo,
            sv_latest.id AS latestStrategyVersionId,
            sv_latest.version_no AS latestVersionNo
     FROM qc_task t
     JOIN qc_data_sources ds ON ds.id = t.source_id
     LEFT JOIN qc_monitor_table mt ON mt.id = t.monitor_table_id
     LEFT JOIN qc_strategy_version sv_task ON sv_task.id = t.strategy_version_id
     LEFT JOIN (
       SELECT strategy_id, MAX(version_no) AS latestVersionNo
       FROM qc_strategy_version
       WHERE version_status = 'submitted'
       GROUP BY strategy_id
     ) latest ON latest.strategy_id = t.strategy_id
     LEFT JOIN qc_strategy_version sv_latest
       ON sv_latest.strategy_id = t.strategy_id
      AND sv_latest.version_no = latest.latestVersionNo
     WHERE ${where.join(" AND ")}
     ORDER BY t.updated_at DESC, t.id DESC`,
    params
  );
  return rows.map(mapTask);
}

async function getTaskById(id) {
  const scoped = getScopedWhere("t");
  const [rows] = await pool.query(
    `SELECT t.id, t.project_id AS projectId, t.task_name AS taskName, t.task_code AS taskCode, t.monitor_table_id AS monitorTableId,
            t.source_id AS sourceId, t.table_name AS tableName, t.strategy_id AS strategyId,
            t.strategy_version_id AS strategyVersionId, t.detail_table_name AS detailTableName, t.stats_table_name AS statsTableName,
            t.fetch_mode AS fetchMode, t.fetch_config_json AS fetchConfigJson, t.schedule_enabled AS scheduleEnabled,
            t.schedule_config_json AS scheduleConfigJson, t.status, t.owner_name AS ownerName,
            t.last_run_time AS lastRunTime, t.last_batch_id AS lastBatchId, t.last_run_status AS lastRunStatus,
            t.latest_execution_info_json AS latestExecutionInfoJson, t.created_at AS createdAt, t.updated_at AS updatedAt,
            ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType, ds.connection_config AS connectionConfig,
            mt.table_comment AS tableComment,
            sv_task.version_no AS taskVersionNo,
            sv_latest.id AS latestStrategyVersionId,
            sv_latest.version_no AS latestVersionNo
     FROM qc_task t
     JOIN qc_data_sources ds ON ds.id = t.source_id
     LEFT JOIN qc_monitor_table mt ON mt.id = t.monitor_table_id
     LEFT JOIN qc_strategy_version sv_task ON sv_task.id = t.strategy_version_id
     LEFT JOIN (
       SELECT strategy_id, MAX(version_no) AS latestVersionNo
       FROM qc_strategy_version
       WHERE version_status = 'submitted'
       GROUP BY strategy_id
     ) latest ON latest.strategy_id = t.strategy_id
     LEFT JOIN qc_strategy_version sv_latest
       ON sv_latest.strategy_id = t.strategy_id
      AND sv_latest.version_no = latest.latestVersionNo
     WHERE t.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );
  return rows[0] ? mapTask(rows[0]) : null;
}

async function getTaskByCode(taskCode) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, task_code AS taskCode
     FROM qc_task
     WHERE task_code = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [taskCode, ...scoped.params]
  );
  return rows[0] ? { id: Number(rows[0].id), taskCode: rows[0].taskCode } : null;
}

async function createTask(payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO qc_task
      (project_id, task_name, task_code, monitor_table_id, source_id, table_name, strategy_id, strategy_version_id, detail_table_name, stats_table_name,
       fetch_mode, fetch_config_json, schedule_enabled, schedule_config_json, status, owner_name, last_run_time, last_batch_id, last_run_status, latest_execution_info_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.taskName,
      payload.taskCode,
      payload.monitorTableId,
      payload.sourceId,
      payload.tableName,
      payload.strategyId,
      payload.strategyVersionId,
      payload.detailTableName,
      payload.statsTableName,
      payload.fetchMode || "full",
      JSON.stringify(payload.fetchConfig || {}),
      payload.scheduleEnabled ? 1 : 0,
      payload.scheduleConfig ? JSON.stringify(payload.scheduleConfig) : null,
      payload.status || "draft",
      payload.ownerName || "system",
      payload.lastRunTime || null,
      payload.lastBatchId || null,
      payload.lastRunStatus || null,
      payload.latestExecutionInfo ? JSON.stringify(payload.latestExecutionInfo) : null,
    ]
  );
  return getTaskById(result.insertId);
}

async function updateTask(id, payload) {
  const fields = [];
  const params = [];
  const mapping = {
    taskName: "task_name",
    taskCode: "task_code",
    strategyVersionId: "strategy_version_id",
    detailTableName: "detail_table_name",
    statsTableName: "stats_table_name",
    fetchMode: "fetch_mode",
    status: "status",
    ownerName: "owner_name",
    lastRunTime: "last_run_time",
    lastBatchId: "last_batch_id",
    lastRunStatus: "last_run_status",
  };
  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      fields.push(`${column} = ?`);
      params.push(payload[key]);
    }
  });
  if (Object.prototype.hasOwnProperty.call(payload, "fetchConfig")) {
    fields.push("fetch_config_json = ?");
    params.push(JSON.stringify(payload.fetchConfig || {}));
  }
  if (Object.prototype.hasOwnProperty.call(payload, "scheduleEnabled")) {
    fields.push("schedule_enabled = ?");
    params.push(payload.scheduleEnabled ? 1 : 0);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "scheduleConfig")) {
    fields.push("schedule_config_json = ?");
    params.push(payload.scheduleConfig ? JSON.stringify(payload.scheduleConfig) : null);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "latestExecutionInfo")) {
    fields.push("latest_execution_info_json = ?");
    params.push(payload.latestExecutionInfo ? JSON.stringify(payload.latestExecutionInfo) : null);
  }
  if (!fields.length) {
    return getTaskById(id);
  }
  const scoped = getScopedWhere("");
  params.push(id, ...scoped.params);
  await pool.query(`UPDATE qc_task SET ${fields.join(", ")} WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`, params);
  return getTaskById(id);
}

async function deleteTask(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM qc_task WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function getScheduledTasks() {
  const [rows] = await pool.query(
    `SELECT t.id, t.project_id AS projectId, t.task_name AS taskName, t.task_code AS taskCode, t.monitor_table_id AS monitorTableId,
            t.source_id AS sourceId, t.table_name AS tableName, t.strategy_id AS strategyId,
            t.strategy_version_id AS strategyVersionId, t.detail_table_name AS detailTableName, t.stats_table_name AS statsTableName,
            t.fetch_mode AS fetchMode, t.fetch_config_json AS fetchConfigJson, t.schedule_enabled AS scheduleEnabled,
            t.schedule_config_json AS scheduleConfigJson, t.status, t.owner_name AS ownerName,
            t.last_run_time AS lastRunTime, t.last_batch_id AS lastBatchId, t.last_run_status AS lastRunStatus,
            t.latest_execution_info_json AS latestExecutionInfoJson, t.created_at AS createdAt, t.updated_at AS updatedAt,
            ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType, ds.connection_config AS connectionConfig,
            mt.table_comment AS tableComment,
            sv_task.version_no AS taskVersionNo,
            sv_latest.id AS latestStrategyVersionId,
            sv_latest.version_no AS latestVersionNo
     FROM qc_task t
     JOIN qc_data_sources ds ON ds.id = t.source_id
     LEFT JOIN qc_monitor_table mt ON mt.id = t.monitor_table_id
     LEFT JOIN qc_strategy_version sv_task ON sv_task.id = t.strategy_version_id
     LEFT JOIN (
       SELECT strategy_id, MAX(version_no) AS latestVersionNo
       FROM qc_strategy_version
       WHERE version_status = 'submitted'
       GROUP BY strategy_id
     ) latest ON latest.strategy_id = t.strategy_id
     LEFT JOIN qc_strategy_version sv_latest
       ON sv_latest.strategy_id = t.strategy_id
      AND sv_latest.version_no = latest.latestVersionNo
     WHERE t.schedule_enabled = 1
       AND t.status = 'active'`
  );
  return rows.map(mapTask);
}

async function getQualityDataSourceById(id) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, source_name AS sourceName, source_code AS sourceCode, source_type AS sourceType,
            connection_config AS connectionConfig, owner_name AS ownerName, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM qc_data_sources
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );
  return rows[0] ? mapQualityDataSource(rows[0]) : null;
}

async function getQualityDataSourceByCode(sourceCode) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, source_name AS sourceName, source_code AS sourceCode, source_type AS sourceType,
            connection_config AS connectionConfig, owner_name AS ownerName, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM qc_data_sources
     WHERE source_code = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [sourceCode, ...scoped.params]
  );
  return rows[0] ? mapQualityDataSource(rows[0]) : null;
}

async function createQualityDataSource(payload) {
  const projectId = getCurrentProjectId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const baseCode = stripQualityShadowPrefix(payload.sourceCode);
    const shadowCode = `qc__${baseCode}`;
    const [shadowResult] = await connection.query(
      `INSERT INTO data_sources
        (project_id, source_name, source_code, source_domain, source_type, connection_config, owner_name, status)
       VALUES (?, ?, ?, 'quality_shadow', ?, ?, ?, ?)`,
      [
        projectId,
        payload.sourceName,
        shadowCode,
        payload.sourceType,
        JSON.stringify(payload.connectionConfig || {}),
        payload.ownerName,
        payload.status,
      ]
    );
    const sourceId = Number(shadowResult.insertId);
    await connection.query(
      `INSERT INTO qc_data_sources
        (id, project_id, source_name, source_code, source_type, connection_config, owner_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sourceId,
        projectId,
        payload.sourceName,
        baseCode,
        payload.sourceType,
        JSON.stringify(payload.connectionConfig || {}),
        payload.ownerName,
        payload.status,
      ]
    );
    await connection.commit();
    return getQualityDataSourceById(sourceId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateQualityDataSource(id, payload) {
  const scoped = getScopedWhere("");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const baseCode = stripQualityShadowPrefix(payload.sourceCode);
    const shadowCode = `qc__${baseCode}`;
    const [result] = await connection.query(
      `UPDATE qc_data_sources
       SET source_name = ?, source_code = ?, source_type = ?, connection_config = ?, owner_name = ?, status = ?
       WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [
        payload.sourceName,
        baseCode,
        payload.sourceType,
        JSON.stringify(payload.connectionConfig || {}),
        payload.ownerName,
        payload.status,
        id,
        ...scoped.params,
      ]
    );
    if (Number(result.affectedRows || 0) === 0) {
      await connection.rollback();
      return null;
    }
    await connection.query(
      `UPDATE data_sources
       SET source_name = ?, source_code = ?, source_type = ?, connection_config = ?, owner_name = ?, status = ?
       WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [
        payload.sourceName,
        shadowCode,
        payload.sourceType,
        JSON.stringify(payload.connectionConfig || {}),
        payload.ownerName,
        payload.status,
        id,
        ...scoped.params,
      ]
    );
    await connection.commit();
    return getQualityDataSourceById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteQualityDataSource(id) {
  const scoped = getScopedWhere("");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM qc_monitor_table WHERE source_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [id, ...scoped.params]
    );
    await connection.query(
      `DELETE FROM qc_monitor_source WHERE source_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [id, ...scoped.params]
    );
    const [result] = await connection.query(
      `DELETE FROM qc_data_sources WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [id, ...scoped.params]
    );
    await connection.query(
      `DELETE FROM data_sources WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [id, ...scoped.params]
    );
    await connection.commit();
    return Number(result.affectedRows || 0) > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createTaskRun(payload) {
  const [result] = await pool.query(
    `INSERT INTO qc_task_run
      (project_id, task_id, run_status, batch_id, start_time, end_time, issue_count, stats_count, error_message, execution_info_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.projectId || getCurrentProjectId(),
      payload.taskId,
      payload.runStatus || "pending",
      payload.batchId || null,
      payload.startTime || null,
      payload.endTime || null,
      Number(payload.issueCount || 0),
      Number(payload.statsCount || 0),
      payload.errorMessage || null,
      payload.executionInfo ? JSON.stringify(payload.executionInfo) : null,
    ]
  );
  return getTaskRunById(result.insertId);
}

async function acquireTaskExecution(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE qc_task SET status = 'running', last_run_status = 'running'
     WHERE id = ? AND status <> 'running'${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return Number(result.affectedRows || 0) === 1;
}

async function updateTaskRun(id, payload) {
  const fields = [];
  const params = [];
  const mapping = {
    runStatus: "run_status",
    batchId: "batch_id",
    startTime: "start_time",
    endTime: "end_time",
    issueCount: "issue_count",
    statsCount: "stats_count",
    errorMessage: "error_message",
  };
  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      fields.push(`${column} = ?`);
      params.push(payload[key]);
    }
  });
  if (Object.prototype.hasOwnProperty.call(payload, "executionInfo")) {
    fields.push("execution_info_json = ?");
    params.push(payload.executionInfo ? JSON.stringify(payload.executionInfo) : null);
  }
  if (!fields.length) {
    return getTaskRunById(id);
  }
  params.push(id);
  await pool.query(`UPDATE qc_task_run SET ${fields.join(", ")} WHERE id = ?`, params);
  return getTaskRunById(id);
}

async function getTaskRunById(id) {
  const [rows] = await pool.query(
    `SELECT id, project_id AS projectId, task_id AS taskId, run_status AS runStatus, batch_id AS batchId,
            start_time AS startTime, end_time AS endTime, issue_count AS issueCount,
            stats_count AS statsCount, error_message AS errorMessage,
            execution_info_json AS executionInfoJson, created_at AS createdAt
     FROM qc_task_run
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ? mapTaskRun(rows[0]) : null;
}

async function listTaskRuns(taskId, limit = 50) {
  const [rows] = await pool.query(
    `SELECT id, project_id AS projectId, task_id AS taskId, run_status AS runStatus, batch_id AS batchId,
            start_time AS startTime, end_time AS endTime, issue_count AS issueCount,
            stats_count AS statsCount, error_message AS errorMessage,
            execution_info_json AS executionInfoJson, created_at AS createdAt
     FROM qc_task_run
     WHERE task_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [taskId, limit]
  );
  return rows.map(mapTaskRun);
}

module.exports = {
  listMonitorSources,
  getMonitorSourceById,
  getMonitorSourceBySourceId,
  createMonitorSource,
  updateMonitorSource,
  listMonitorTablesByMonitorSourceId,
  listMonitorTablesBySourceId,
  getMonitorTableById,
  createMonitorTable,
  updateMonitorTable,
  deleteMonitorTable,
  listRegexRules,
  listRegexRuleCodes,
  getRegexRuleById,
  createRegexRule,
  updateRegexRule,
  deleteRegexRule,
  listDictionaries,
  listDictionariesByBusinessSystem,
  getDictionaryById,
  getDictionaryByCode,
  listDictionaryItems,
  createDictionary,
  updateDictionary,
  replaceDictionaryItems,
  deleteDictionary,
  batchDeleteDictionaries,
  listDictionaryBusinessSystems,
  getDictionaryBusinessSystemById,
  resolveBusinessSystemForTable,
  listStrategyTables,
  getStrategyByMonitorTableId,
  createRecommendationRun,
  getRecommendationRunById,
  updateRecommendationRun,
  createStrategy,
  updateStrategy,
  createStrategyVersion,
  updateStrategyVersion,
  listStrategyVersions,
  getStrategyVersionById,
  deleteStrategyVersion,
  deleteStrategy,
  countTasksByStrategyVersion,
  listAiConfigs,
  getAiConfigById,
  getAiConfigByCode,
  getNextAiConfigVersionNo,
  createAiConfigVersion,
  listAiConfigVersions,
  updateAiConfig,
  getQualityDataSourceById,
  getQualityDataSourceByCode,
  createQualityDataSource,
  updateQualityDataSource,
  deleteQualityDataSource,
  listSubmittedStrategyOptions,
  listTasks,
  getTaskById,
  getTaskByCode,
  createTask,
  updateTask,
  deleteTask,
  getScheduledTasks,
  createTaskRun,
  acquireTaskExecution,
  updateTaskRun,
  getTaskRunById,
  listTaskRuns,
};
