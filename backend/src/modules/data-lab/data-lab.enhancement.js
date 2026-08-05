const { pool } = require("../../config/database");
const AppError = require("../../common/errors/app-error");
const scenarioEngine = require("./data-lab.scenario-engine");
const capabilityNormalizer = require("./data-lab.capability-normalizer");

function safeJsonParse(value, fallback) {
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

function normalizeCode(value, prefix) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return normalized || `${prefix}_${Date.now().toString().slice(-8)}`;
}

function safeObjectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeStringArray(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  ));
}

function normalizeLightweightModulePlanner(modulePlanner = {}, researchCatalog = {}) {
  const planner = safeObjectValue(modulePlanner);
  const categories = Array.isArray(planner.categories)
    ? planner.categories
    : (Array.isArray(researchCatalog.categoryTree) ? researchCatalog.categoryTree : []);
  const modules = categories.map((item) => ({
    moduleKey: String(item.categoryCode || item.categoryName || "").trim(),
    moduleLabel: String(item.categoryName || item.categoryCode || "").trim(),
    summary: String(item.description || planner.summary || "").trim(),
    focusTables: normalizeStringArray(item.focusTables || item.tableScopes),
    focusTableDetails: Array.isArray(item.focusTableDetails) ? item.focusTableDetails : (Array.isArray(item.tableDetails) ? item.tableDetails : []),
    expectedTables: normalizeStringArray(item.expectedTables || item.tableScopes || item.focusTables),
    hints: normalizeStringArray(item.sourceRefs),
  })).filter((item) => item.moduleKey);
  return {
    summary: String(planner.summary || researchCatalog.summary || "").trim(),
    categories,
    modules,
  };
}

function extractSourceRefs(config) {
  return capabilityNormalizer.normalizeSourceRefs(config?.sourceRefs);
}

function mapProfileRow(row) {
  return capabilityNormalizer.normalizeScenarioEnhancementPayload({
    id: Number(row.id),
    profileName: row.profileName,
    profileCode: row.profileCode,
    industry: row.industry,
    subScenario: row.subScenario,
    profileDesc: row.profileDesc,
    locale: row.locale,
    businessStyle: row.businessStyle,
    confidenceThreshold: Number(row.confidenceThreshold || 0),
    priority: Number(row.priority || 0),
    status: row.status,
    recognition: safeJsonParse(row.recognition, {}),
    researchCatalog: safeJsonParse(row.researchCatalog, {}),
    modulePlanner: safeJsonParse(row.modulePlanner, {}),
    schemaGuides: safeJsonParse(row.schemaGuides, {}),
    relationPatterns: safeJsonParse(row.relationPatterns, []),
    stateMachines: safeJsonParse(row.stateMachines, []),
    codeRules: safeJsonParse(row.codeRules, []),
    fieldSemantics: safeJsonParse(row.fieldSemantics, []),
    valueCorpora: safeJsonParse(row.valueCorpora, {}),
    distributionProfiles: safeJsonParse(row.distributionProfiles, {}),
    qualityGates: safeJsonParse(row.qualityGates, {}),
    realismRules: safeJsonParse(row.realismRules, []),
    dirtyDataProfiles: safeJsonParse(row.dirtyDataProfiles, {}),
    trainingAssets: safeJsonParse(row.trainingAssets, {}),
    evaluationRubric: safeJsonParse(row.evaluationRubric, {}),
    overridePolicies: safeJsonParse(row.overridePolicies, {}),
    isSystem: Boolean(row.isSystem),
    createdBy: row.createdBy,
    dictionaryCount: row.dictionaryCount !== undefined ? Number(row.dictionaryCount || 0) : undefined,
    distributionRuleCount: row.distributionRuleCount !== undefined ? Number(row.distributionRuleCount || 0) : undefined,
    fieldRuleCount: row.fieldRuleCount !== undefined ? Number(row.fieldRuleCount || 0) : undefined,
    complianceRuleCount: row.complianceRuleCount !== undefined ? Number(row.complianceRuleCount || 0) : undefined,
    pluginBindingCount: row.pluginBindingCount !== undefined ? Number(row.pluginBindingCount || 0) : undefined,
    extendedRuleCount: row.extendedRuleCount !== undefined ? Number(row.extendedRuleCount || 0) : undefined,
    latestVersionNo: row.latestVersionNo !== undefined && row.latestVersionNo !== null ? Number(row.latestVersionNo) : null,
    latestVersionStatus: row.latestVersionStatus || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

async function getProfileBase(id) {
  const [rows] = await pool.query(
    `SELECT id, profile_name AS profileName, profile_code AS profileCode, industry, sub_scenario AS subScenario,
            profile_desc AS profileDesc, locale, business_style AS businessStyle,
            confidence_threshold AS confidenceThreshold, priority, status,
            recognition_json AS recognition, research_catalog_json AS researchCatalog, module_planner_json AS modulePlanner,
            schema_guides_json AS schemaGuides, relation_patterns_json AS relationPatterns, state_machines_json AS stateMachines,
            code_rules_json AS codeRules, field_semantics_json AS fieldSemantics, value_corpora_json AS valueCorpora,
            distribution_profiles_json AS distributionProfiles, quality_gates_json AS qualityGates, realism_rules_json AS realismRules,
            dirty_data_profiles_json AS dirtyDataProfiles, training_assets_json AS trainingAssets,
            evaluation_rubric_json AS evaluationRubric, override_policies_json AS overridePolicies,
            is_system AS isSystem,
            created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_profile
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row) {
    throw new AppError("场景增强配置不存在", 404);
  }
  return mapProfileRow(row);
}

async function listScenarioEnhancements() {
  const [orderedRows] = await pool.query(
    `SELECT id
     FROM lab_scenario_profile
     ORDER BY priority ASC, updated_at DESC, id DESC`
  );
  const orderedIds = orderedRows.map((row) => Number(row.id)).filter(Boolean);
  if (orderedIds.length === 0) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT p.id, p.profile_name AS profileName, p.profile_code AS profileCode, p.industry,
            p.sub_scenario AS subScenario, p.profile_desc AS profileDesc, p.locale,
            p.business_style AS businessStyle, p.confidence_threshold AS confidenceThreshold,
            p.priority, p.status,
            p.recognition_json AS recognition, p.research_catalog_json AS researchCatalog,
            p.module_planner_json AS modulePlanner, p.training_assets_json AS trainingAssets,
            p.is_system AS isSystem, p.created_by AS createdBy,
            p.created_at AS createdAt, p.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM lab_scenario_dictionary d WHERE d.profile_id = p.id) AS dictionaryCount,
            (SELECT COUNT(*) FROM lab_scenario_distribution_rule r WHERE r.profile_id = p.id) AS distributionRuleCount,
            (SELECT COUNT(*) FROM lab_scenario_field_rule f WHERE f.profile_id = p.id) AS fieldRuleCount,
            (SELECT COUNT(*) FROM lab_scenario_compliance_rule c WHERE c.profile_id = p.id) AS complianceRuleCount,
            (SELECT COUNT(*) FROM lab_scenario_plugin_binding b WHERE b.profile_id = p.id) AS pluginBindingCount,
            (SELECT COUNT(*) FROM lab_scenario_extended_rule e WHERE e.profile_id = p.id) AS extendedRuleCount,
            (SELECT MAX(version_no) FROM lab_scenario_profile_version v WHERE v.profile_id = p.id) AS latestVersionNo,
            (SELECT version_status FROM lab_scenario_profile_version v WHERE v.profile_id = p.id ORDER BY version_no DESC LIMIT 1) AS latestVersionStatus
     FROM lab_scenario_profile p
     WHERE p.id IN (?)`,
    [orderedIds]
  );

  const rowMap = new Map(rows.map((row) => [Number(row.id), mapProfileRow(row)]));
  return orderedIds.map((id) => rowMap.get(id)).filter(Boolean);
}

async function listProfileDictionaries(profileId) {
  const [rows] = await pool.query(
    `SELECT id, profile_id AS profileId, dict_type AS dictType, item_code AS itemCode, item_label AS itemLabel,
            item_value_json AS itemValue, weight, sort_order AS sortOrder, status, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_dictionary
     WHERE profile_id = ?
     ORDER BY dict_type ASC, sort_order ASC, id ASC`,
    [profileId]
  );
  return rows.map((row) => {
    const normalized = capabilityNormalizer.normalizeDictionaries([{
      dictType: row.dictType,
      itemCode: row.itemCode,
      itemLabel: row.itemLabel,
      itemValue: safeJsonParse(row.itemValue, {}),
      weight: Number(row.weight || 0),
      sortOrder: Number(row.sortOrder || 0),
      status: row.status,
    }])[0] || {};
    return {
      id: Number(row.id),
      profileId: Number(row.profileId),
      ...normalized,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

async function listDistributionRules(profileId) {
  const [rows] = await pool.query(
    `SELECT id, profile_id AS profileId, rule_type AS ruleType, rule_name AS ruleName, rule_code AS ruleCode,
            rule_config_json AS ruleConfig, status, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_distribution_rule
     WHERE profile_id = ?
     ORDER BY rule_type ASC, rule_name ASC, id ASC`,
    [profileId]
  );
  return rows.map((row) => {
    const normalized = capabilityNormalizer.normalizeDistributionRules([{
      ruleType: row.ruleType,
      ruleName: row.ruleName,
      ruleCode: row.ruleCode,
      ruleConfig: safeJsonParse(row.ruleConfig, {}),
      status: row.status,
    }])[0] || {};
    return {
      id: Number(row.id),
      profileId: Number(row.profileId),
      ...normalized,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

async function listFieldRules(profileId) {
  const [rows] = await pool.query(
    `SELECT id, profile_id AS profileId, table_name AS tableName, field_name AS fieldName, generator_type AS generatorType,
            rule_config_json AS ruleConfig, status, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_field_rule
     WHERE profile_id = ?
     ORDER BY table_name ASC, field_name ASC, id ASC`,
    [profileId]
  );
  return rows.map((row) => {
    const normalized = capabilityNormalizer.normalizeFieldRules("", [{
      tableName: row.tableName,
      fieldName: row.fieldName,
      generatorType: row.generatorType,
      ruleConfig: safeJsonParse(row.ruleConfig, {}),
      status: row.status,
    }])[0] || {};
    return {
      id: Number(row.id),
      profileId: Number(row.profileId),
      ...normalized,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

async function listComplianceRules(profileId) {
  const [rows] = await pool.query(
    `SELECT id, profile_id AS profileId, rule_code AS ruleCode, rule_name AS ruleName,
            table_name AS tableName, field_name AS fieldName, rule_type AS ruleType,
            rule_config_json AS ruleConfig, issue_category AS issueCategory, severity, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_compliance_rule
     WHERE profile_id = ?
     ORDER BY table_name ASC, field_name ASC, rule_name ASC, id ASC`,
    [profileId]
  );
  return rows.map((row) => {
    const normalized = capabilityNormalizer.normalizeComplianceRules("", [{
      ruleCode: row.ruleCode,
      ruleName: row.ruleName,
      tableName: row.tableName,
      fieldName: row.fieldName,
      ruleType: row.ruleType,
      ruleConfig: safeJsonParse(row.ruleConfig, {}),
      issueCategory: row.issueCategory,
      severity: row.severity,
      status: row.status,
    }])[0] || {};
    return {
      id: Number(row.id),
      profileId: Number(row.profileId),
      ...normalized,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

async function listPluginBindings(profileId) {
  const [rows] = await pool.query(
    `SELECT id, profile_id AS profileId, plugin_key AS pluginKey, plugin_name AS pluginName,
            binding_scope AS bindingScope, binding_config_json AS bindingConfig, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_plugin_binding
     WHERE profile_id = ?
     ORDER BY plugin_key ASC, id ASC`,
    [profileId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    profileId: Number(row.profileId),
    pluginKey: row.pluginKey,
    pluginName: row.pluginName,
    bindingScope: row.bindingScope,
    bindingConfig: safeJsonParse(row.bindingConfig, {}),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

async function listExtendedRules(profileId) {
  const [rows] = await pool.query(
    `SELECT id, profile_id AS profileId, rule_category AS ruleCategory, module_key AS moduleKey,
            rule_code AS ruleCode, rule_name AS ruleName, industry_scope AS industryScope,
            scene_scope AS sceneScope, table_name AS tableName, field_name AS fieldName,
            rule_config_json AS ruleConfig, sort_order AS sortOrder, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_extended_rule
     WHERE profile_id = ?
     ORDER BY rule_category ASC, module_key ASC, sort_order ASC, id ASC`,
    [profileId]
  );
  return rows.map((row) => {
    const normalized = capabilityNormalizer.normalizeExtendedRules([{
      ruleCategory: row.ruleCategory,
      moduleKey: row.moduleKey,
      ruleCode: row.ruleCode,
      ruleName: row.ruleName,
      industryScope: row.industryScope || null,
      sceneScope: row.sceneScope || null,
      tableName: row.tableName || null,
      fieldName: row.fieldName || null,
      ruleConfig: safeJsonParse(row.ruleConfig, {}),
      sortOrder: Number(row.sortOrder || 0),
      status: row.status,
    }])[0] || {};
    return {
      id: Number(row.id),
      profileId: Number(row.profileId),
      ...normalized,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

async function listProfileVersions(profileId) {
  const [rows] = await pool.query(
    `SELECT id, profile_id AS profileId, version_no AS versionNo, version_status AS versionStatus,
            snapshot_json AS snapshot, created_by AS createdBy, created_at AS createdAt
     FROM lab_scenario_profile_version
     WHERE profile_id = ?
     ORDER BY version_no DESC, id DESC`,
    [profileId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    profileId: Number(row.profileId),
    versionNo: Number(row.versionNo || 0),
    versionStatus: row.versionStatus,
    snapshot: safeJsonParse(row.snapshot, {}),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  }));
}

async function getScenarioEnhancementDetail(id) {
  const profile = await getProfileBase(id);
  const [dictionaries, distributionRules, fieldRules, complianceRules, pluginBindings, extendedRules, versions] = await Promise.all([
    listProfileDictionaries(id),
    listDistributionRules(id),
    listFieldRules(id),
    listComplianceRules(id),
    listPluginBindings(id),
    listExtendedRules(id),
    listProfileVersions(id),
  ]);

  return {
    ...profile,
    dictionaries,
    distributionRules,
    fieldRules,
    complianceRules,
    pluginBindings,
    extendedRules,
    versions,
  };
}

function buildVersionSnapshot(profile, payload) {
  return {
    profile: {
      id: profile.id,
      profileName: payload.profileName,
      profileCode: profile.profileCode,
      industry: payload.industry,
      subScenario: payload.subScenario || null,
      profileDesc: payload.profileDesc || null,
      locale: payload.locale || "zh-CN",
      businessStyle: payload.businessStyle || payload.industry || "generic",
      confidenceThreshold: payload.confidenceThreshold ?? 0.6,
      priority: payload.priority ?? 100,
      status: payload.status || "draft",
      isSystem: Boolean(payload.isSystem),
    },
    recognition: payload.recognition || {},
    researchCatalog: payload.researchCatalog || {},
    modulePlanner: payload.modulePlanner || {},
    schemaGuides: payload.schemaGuides || {},
    relationPatterns: payload.relationPatterns || [],
    stateMachines: payload.stateMachines || [],
    codeRules: payload.codeRules || [],
    fieldSemantics: payload.fieldSemantics || [],
    valueCorpora: payload.valueCorpora || {},
    distributionProfiles: payload.distributionProfiles || {},
    qualityGates: payload.qualityGates || {},
    realismRules: payload.realismRules || [],
    dirtyDataProfiles: payload.dirtyDataProfiles || {},
    trainingAssets: payload.trainingAssets || {},
    evaluationRubric: payload.evaluationRubric || {},
    overridePolicies: payload.overridePolicies || {},
    dictionaries: payload.dictionaries || [],
    distributionRules: payload.distributionRules || [],
    fieldRules: payload.fieldRules || [],
    complianceRules: payload.complianceRules || [],
    pluginBindings: payload.pluginBindings || [],
    extendedRules: payload.extendedRules || [],
  };
}

async function replaceProfileChildren(connection, tableName, profileId, rows, mapper) {
  await connection.query(`DELETE FROM ${tableName} WHERE profile_id = ?`, [profileId]);
  for (const row of rows || []) {
    const { sql, values } = mapper(row, profileId);
    await connection.query(sql, values);
  }
}

async function saveScenarioEnhancement(payload, user) {
  const normalizedPayload = capabilityNormalizer.normalizeScenarioEnhancementPayload(payload);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let profileId = normalizedPayload.id ? Number(normalizedPayload.id) : null;
    const profileCode = normalizeCode(normalizedPayload.profileCode || normalizedPayload.profileName, "scenario_profile");

    if (profileId) {
      await getProfileBase(profileId);
      await connection.query(
        `UPDATE lab_scenario_profile
         SET profile_name = ?, profile_code = ?, industry = ?, sub_scenario = ?, profile_desc = ?,
             locale = ?, business_style = ?, confidence_threshold = ?, priority = ?, status = ?,
             recognition_json = ?, research_catalog_json = ?, module_planner_json = ?, schema_guides_json = ?,
             relation_patterns_json = ?, state_machines_json = ?, code_rules_json = ?, field_semantics_json = ?,
             value_corpora_json = ?, distribution_profiles_json = ?, quality_gates_json = ?, realism_rules_json = ?,
             dirty_data_profiles_json = ?, training_assets_json = ?, evaluation_rubric_json = ?, override_policies_json = ?,
             is_system = ?
         WHERE id = ?`,
        [
          normalizedPayload.profileName,
          profileCode,
          normalizedPayload.industry,
          normalizedPayload.subScenario || null,
          normalizedPayload.profileDesc || null,
          normalizedPayload.locale || "zh-CN",
          normalizedPayload.businessStyle || normalizedPayload.industry || "generic",
          normalizedPayload.confidenceThreshold ?? 0.6,
          normalizedPayload.priority ?? 100,
          normalizedPayload.status || "draft",
          JSON.stringify(normalizedPayload.recognition || {}),
          JSON.stringify(normalizedPayload.researchCatalog || {}),
          JSON.stringify(normalizedPayload.modulePlanner || {}),
          JSON.stringify(normalizedPayload.schemaGuides || {}),
          JSON.stringify(normalizedPayload.relationPatterns || []),
          JSON.stringify(normalizedPayload.stateMachines || []),
          JSON.stringify(normalizedPayload.codeRules || []),
          JSON.stringify(normalizedPayload.fieldSemantics || []),
          JSON.stringify(normalizedPayload.valueCorpora || {}),
          JSON.stringify(normalizedPayload.distributionProfiles || {}),
          JSON.stringify(normalizedPayload.qualityGates || {}),
          JSON.stringify(normalizedPayload.realismRules || []),
          JSON.stringify(normalizedPayload.dirtyDataProfiles || {}),
          JSON.stringify(normalizedPayload.trainingAssets || {}),
          JSON.stringify(normalizedPayload.evaluationRubric || {}),
          JSON.stringify(normalizedPayload.overridePolicies || {}),
          normalizedPayload.isSystem ? 1 : 0,
          profileId,
        ]
      );
    } else {
      const [result] = await connection.query(
        `INSERT INTO lab_scenario_profile
          (profile_name, profile_code, industry, sub_scenario, profile_desc, locale, business_style,
           confidence_threshold, priority, status, recognition_json, research_catalog_json, module_planner_json, schema_guides_json,
           relation_patterns_json, state_machines_json, code_rules_json, field_semantics_json, value_corpora_json,
           distribution_profiles_json, quality_gates_json, realism_rules_json, dirty_data_profiles_json, training_assets_json,
           evaluation_rubric_json, override_policies_json, is_system, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalizedPayload.profileName,
          profileCode,
          normalizedPayload.industry,
          normalizedPayload.subScenario || null,
          normalizedPayload.profileDesc || null,
          normalizedPayload.locale || "zh-CN",
          normalizedPayload.businessStyle || normalizedPayload.industry || "generic",
          normalizedPayload.confidenceThreshold ?? 0.6,
          normalizedPayload.priority ?? 100,
          normalizedPayload.status || "draft",
          JSON.stringify(normalizedPayload.recognition || {}),
          JSON.stringify(normalizedPayload.researchCatalog || {}),
          JSON.stringify(normalizedPayload.modulePlanner || {}),
          JSON.stringify(normalizedPayload.schemaGuides || {}),
          JSON.stringify(normalizedPayload.relationPatterns || []),
          JSON.stringify(normalizedPayload.stateMachines || []),
          JSON.stringify(normalizedPayload.codeRules || []),
          JSON.stringify(normalizedPayload.fieldSemantics || []),
          JSON.stringify(normalizedPayload.valueCorpora || {}),
          JSON.stringify(normalizedPayload.distributionProfiles || {}),
          JSON.stringify(normalizedPayload.qualityGates || {}),
          JSON.stringify(normalizedPayload.realismRules || []),
          JSON.stringify(normalizedPayload.dirtyDataProfiles || {}),
          JSON.stringify(normalizedPayload.trainingAssets || {}),
          JSON.stringify(normalizedPayload.evaluationRubric || {}),
          JSON.stringify(normalizedPayload.overridePolicies || {}),
          normalizedPayload.isSystem ? 1 : 0,
          user?.displayName || user?.username || "system",
        ]
      );
      profileId = Number(result.insertId);
    }

    await replaceProfileChildren(connection, "lab_scenario_dictionary", profileId, normalizedPayload.dictionaries, (item, currentProfileId) => ({
      sql: `INSERT INTO lab_scenario_dictionary
        (profile_id, dict_type, item_code, item_label, item_value_json, weight, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        currentProfileId,
        item.dictType,
        item.itemCode,
        item.itemLabel,
        JSON.stringify(item.itemValue || {}),
        item.weight ?? 1,
        item.sortOrder ?? 0,
        item.status || "active",
      ],
    }));

    await replaceProfileChildren(connection, "lab_scenario_distribution_rule", profileId, normalizedPayload.distributionRules, (item, currentProfileId) => ({
      sql: `INSERT INTO lab_scenario_distribution_rule
        (profile_id, rule_type, rule_name, rule_code, rule_config_json, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      values: [
        currentProfileId,
        item.ruleType,
        item.ruleName,
        item.ruleCode,
        JSON.stringify(item.ruleConfig || {}),
        item.status || "active",
      ],
    }));

    await replaceProfileChildren(connection, "lab_scenario_field_rule", profileId, normalizedPayload.fieldRules, (item, currentProfileId) => ({
      sql: `INSERT INTO lab_scenario_field_rule
        (profile_id, table_name, field_name, generator_type, rule_config_json, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      values: [
        currentProfileId,
        item.tableName || "",
        item.fieldName,
        item.generatorType,
        JSON.stringify(item.ruleConfig || {}),
        item.status || "active",
      ],
    }));

    await replaceProfileChildren(connection, "lab_scenario_compliance_rule", profileId, normalizedPayload.complianceRules, (item, currentProfileId) => ({
      sql: `INSERT INTO lab_scenario_compliance_rule
        (profile_id, rule_code, rule_name, table_name, field_name, rule_type, rule_config_json, issue_category, severity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        currentProfileId,
        item.ruleCode,
        item.ruleName,
        item.tableName || "",
        item.fieldName,
        item.ruleType,
        JSON.stringify(item.ruleConfig || {}),
        item.issueCategory || "合规性",
        item.severity || "medium",
        item.status || "active",
      ],
    }));

    await replaceProfileChildren(connection, "lab_scenario_plugin_binding", profileId, normalizedPayload.pluginBindings, (item, currentProfileId) => ({
      sql: `INSERT INTO lab_scenario_plugin_binding
        (profile_id, plugin_key, plugin_name, binding_scope, binding_config_json, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      values: [
        currentProfileId,
        item.pluginKey,
        item.pluginName,
        item.bindingScope || "industry",
        JSON.stringify(item.bindingConfig || {}),
        item.status || "active",
      ],
    }));

    await replaceProfileChildren(connection, "lab_scenario_extended_rule", profileId, normalizedPayload.extendedRules, (item, currentProfileId) => ({
      sql: `INSERT INTO lab_scenario_extended_rule
        (profile_id, rule_category, module_key, rule_code, rule_name, industry_scope, scene_scope, table_name, field_name, rule_config_json, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        currentProfileId,
        item.ruleCategory,
        item.moduleKey,
        item.ruleCode,
        item.ruleName,
        item.industryScope || null,
        item.sceneScope || null,
        item.tableName || null,
        item.fieldName || null,
        JSON.stringify(item.ruleConfig || {}),
        item.sortOrder ?? 0,
        item.status || "active",
      ],
    }));

    const [versionRows] = await connection.query(
      "SELECT COALESCE(MAX(version_no), 0) + 1 AS nextVersion FROM lab_scenario_profile_version WHERE profile_id = ?",
      [profileId]
    );
    const nextVersion = Number(versionRows[0]?.nextVersion || 1);
    const snapshot = buildVersionSnapshot({
      id: profileId,
      profileCode,
    }, { ...normalizedPayload, profileCode });

    await connection.query(
      `INSERT INTO lab_scenario_profile_version (profile_id, version_no, version_status, snapshot_json, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        profileId,
        nextVersion,
        normalizedPayload.status === "active" ? "published" : "draft",
        JSON.stringify(snapshot),
        user?.displayName || user?.username || "system",
      ]
    );

    await connection.commit();
    return getScenarioEnhancementDetail(profileId);
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("增强包编码已存在", 409);
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteScenarioEnhancement(id) {
  const profile = await getProfileBase(id);
  if (profile.isSystem) {
    throw new AppError("系统增强包不允许删除", 400);
  }
  await pool.query("DELETE FROM lab_scenario_profile WHERE id = ?", [id]);
  return { id };
}

function mapManagedProfile(detail) {
  const lightweightResearchCatalog = safeObjectValue(detail.researchCatalog);
  const lightweightModulePlanner = normalizeLightweightModulePlanner(detail.modulePlanner, lightweightResearchCatalog);
  return {
    id: detail.id,
    profileCode: detail.profileCode,
    profileName: detail.profileName,
    industry: detail.industry,
    subScenario: detail.subScenario,
    locale: detail.locale,
    businessStyle: detail.businessStyle,
    confidenceThreshold: detail.confidenceThreshold,
    priority: detail.priority,
    status: detail.status,
    recognition: detail.recognition || {},
    researchCatalog: {
      industryLabel: lightweightResearchCatalog.industryLabel || detail.profileName,
      categoryTree: Array.isArray(lightweightResearchCatalog.categoryTree) ? lightweightResearchCatalog.categoryTree : [],
      candidateTables: normalizeStringArray(lightweightResearchCatalog.candidateTables),
      candidateTableSpecs: Array.isArray(lightweightResearchCatalog.candidateTableSpecs) ? lightweightResearchCatalog.candidateTableSpecs : [],
      dictSuggestions: normalizeStringArray(lightweightResearchCatalog.dictSuggestions),
      dictSuggestionSpecs: Array.isArray(lightweightResearchCatalog.dictSuggestionSpecs) ? lightweightResearchCatalog.dictSuggestionSpecs : [],
      summary: String(lightweightResearchCatalog.summary || "").trim(),
      sourceRefs: normalizeStringArray(lightweightResearchCatalog.sourceRefs),
    },
    modulePlanner: lightweightModulePlanner,
    schemaGuides: {},
    relationPatterns: [],
    stateMachines: [],
    codeRules: [],
    fieldSemantics: [],
    valueCorpora: {},
    distributionProfiles: {},
    qualityGates: {},
    realismRules: [],
    dirtyDataProfiles: {},
    trainingAssets: {},
    evaluationRubric: {},
    overridePolicies: {},
    dictionaries: detail.dictionaries || [],
    distributionRules: [],
    fieldRules: [],
    complianceRules: [],
    pluginBindings: [],
    extendedRules: [],
  };
}

async function listActiveScenarioProfiles() {
  const profiles = await listScenarioEnhancements();
  const activeProfiles = profiles.filter((item) => item.status === "active");
  const details = [];
  for (const profile of activeProfiles) {
    details.push(mapManagedProfile(await getScenarioEnhancementDetail(profile.id)));
  }
  return details;
}

async function previewScenarioRecognition(payload) {
  const managedProfiles = await listActiveScenarioProfiles();
  return scenarioEngine.buildScenarioProfile({
    sceneName: payload.sceneName,
    sceneDesc: payload.sceneDesc,
    knowledgeText: payload.knowledgeText,
    managedProfiles,
  });
}

async function getManagedScenarioProfileById(id) {
  if (!id) {
    return null;
  }
  const detail = await getScenarioEnhancementDetail(id);
  return mapManagedProfile(detail);
}

async function exportScenarioEnhancementPackage(id) {
  const detail = await getScenarioEnhancementDetail(id);
  const managed = mapManagedProfile(detail);
  return {
    packageType: "data_lab_lightweight_enhancement",
    packageVersion: 1,
    exportedAt: new Date().toISOString(),
    profile: {
      profileName: detail.profileName,
      profileCode: detail.profileCode,
      industry: detail.industry,
      subScenario: detail.subScenario,
      profileDesc: detail.profileDesc,
      locale: detail.locale,
      businessStyle: detail.businessStyle,
      confidenceThreshold: detail.confidenceThreshold,
      priority: detail.priority,
      status: detail.status,
      isSystem: false,
    },
    recognition: managed.recognition || {},
    researchCatalog: managed.researchCatalog || {},
    modulePlanner: managed.modulePlanner || {},
    dictionaries: managed.dictionaries || [],
  };
}

async function importScenarioEnhancementPackage(payload, user) {
  if (!payload || typeof payload !== "object") {
    throw new AppError("增强包内容不能为空", 400);
  }

  const profile = payload.profile || {};
  if (!profile.profileName || !profile.industry) {
    throw new AppError("增强包缺少 profileName 或 industry", 400);
  }

  const importCodeBase = normalizeCode(profile.profileCode || profile.profileName, "scenario_profile");
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM lab_scenario_profile WHERE profile_code = ?", [importCodeBase]);
  const profileCode = Number(rows[0]?.total || 0) > 0 ? `${importCodeBase}_${Date.now().toString().slice(-6)}` : importCodeBase;

  return saveScenarioEnhancement({
    profileName: profile.profileName,
    profileCode,
    industry: profile.industry,
    subScenario: profile.subScenario || null,
    profileDesc: profile.profileDesc || null,
    locale: profile.locale || "zh-CN",
    businessStyle: profile.businessStyle || profile.industry || "generic",
    confidenceThreshold: profile.confidenceThreshold ?? 0.6,
    priority: profile.priority ?? 100,
    status: profile.status || "draft",
    isSystem: false,
    recognition: payload.recognition || {},
    researchCatalog: payload.researchCatalog || {},
    modulePlanner: payload.modulePlanner || {},
    schemaGuides: {},
    relationPatterns: [],
    stateMachines: [],
    codeRules: [],
    fieldSemantics: [],
    valueCorpora: {},
    distributionProfiles: {},
    qualityGates: {},
    realismRules: [],
    dirtyDataProfiles: {},
    trainingAssets: {},
    evaluationRubric: {},
    overridePolicies: {},
    dictionaries: payload.dictionaries || [],
    distributionRules: [],
    fieldRules: [],
    complianceRules: [],
    pluginBindings: [],
    extendedRules: [],
  }, user);
}

module.exports = {
  listScenarioEnhancements,
  getScenarioEnhancementDetail,
  saveScenarioEnhancement,
  deleteScenarioEnhancement,
  listActiveScenarioProfiles,
  previewScenarioRecognition,
  getManagedScenarioProfileById,
  exportScenarioEnhancementPackage,
  importScenarioEnhancementPackage,
};
