const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const packageRoot = path.resolve(__dirname, "..");
const snapshotDir = path.join(packageRoot, "seed-data", "project-assets");
const manifestPath = path.join(snapshotDir, "manifest.json");
const seedMarkerPath = path.join(packageRoot, "runtime", "local-dev", "seed-assets.sha256");
const sharedStandardTables = new Set([
  "std_catalogs",
  "std_value_domains",
  "std_value_domain_items",
  "std_reference_standards",
  "std_data_elements",
]);
const modelSystemPromptTableSpecs = new Map([
  ["asset_search_ai_configs", { keyColumns: ["scene_code"], columns: ["scene_name", "scene_code", "temperature", "max_tokens", "timeout_ms", "system_prompt", "description", "owner_name", "status"] }],
  ["dev_ai_configs", { keyColumns: ["scene_code"], columns: ["scene_name", "scene_code", "temperature", "max_tokens", "timeout_ms", "system_prompt", "description", "owner_name", "status"] }],
  ["dm_ai_configs", { keyColumns: ["scene_code"], columns: ["scene_name", "scene_code", "temperature", "max_tokens", "timeout_ms", "system_prompt", "user_prompt_template", "output_schema_json", "description", "owner_name", "status"] }],
  ["ingestion_ai_configs", { keyColumns: ["scene_code"], columns: ["scene_name", "scene_code", "temperature", "max_tokens", "timeout_ms", "system_prompt", "description", "owner_name", "status"] }],
  ["quality_ai_configs", { keyColumns: ["scene_code"], columns: ["scene_name", "scene_code", "temperature", "max_tokens", "timeout_ms", "system_prompt", "description", "owner_name", "status"] }],
  ["reporting_ai_configs", { keyColumns: ["scene_code"], columns: ["scene_name", "scene_code", "temperature", "max_tokens", "timeout_ms", "input_schema_json", "system_prompt", "description", "owner_name", "status"] }],
  ["service_ai_configs", { keyColumns: ["scene_code"], columns: ["scene_name", "scene_code", "temperature", "max_tokens", "timeout_ms", "system_prompt", "description", "owner_name", "status"] }],
  ["std_ai_configs", { keyColumns: ["scene_code"], columns: ["scene_name", "scene_code", "temperature", "max_tokens", "timeout_ms", "system_prompt", "user_prompt_template", "output_schema_json", "description", "owner_name", "status"] }],
  ["lab_model_profile", { keyColumns: ["model_code"], columns: ["profile_name", "stage_type", "model_name", "model_version", "model_code", "auth_mode", "temperature", "max_context_length", "system_prompt", "is_default", "status"] }],
  ["lab_prompt_template", { keyColumns: ["template_code"], columns: ["prompt_type", "template_name", "template_code", "content", "user_content", "temperature", "max_tokens", "is_default", "status"] }],
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

function calculateSha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function calculateSeedFingerprint(manifest) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(manifestPath));
  for (const project of manifest.projects || []) {
    hash.update(fs.readFileSync(path.join(snapshotDir, project.fileName)));
  }
  if (manifest.qualityRegexRules?.fileName) {
    hash.update(fs.readFileSync(path.join(snapshotDir, path.basename(manifest.qualityRegexRules.fileName))));
  }
  if (manifest.modelSystemPrompts?.fileName) {
    hash.update(fs.readFileSync(path.join(snapshotDir, path.basename(manifest.modelSystemPrompts.fileName))));
  }
  return hash.digest("hex");
}

async function synchronizeIntegrationDataSources(pool, projectId, sourceCodes) {
  const normalizedSourceCodes = Array.from(new Set((sourceCodes || []).map((value) => String(value || "").trim()).filter(Boolean)));
  if (!normalizedSourceCodes.length) return;
  await pool.query(
    `INSERT IGNORE INTO data_sources
      (id, project_id, source_name, source_code, source_domain, source_type, connection_config, owner_name, status, created_at, updated_at)
     SELECT ids.id, ?, ids.source_name, ids.source_code, 'integration_shadow', ids.source_type,
            ids.connection_config, ids.owner_name, ids.status, ids.created_at, ids.updated_at
     FROM ingestion_data_sources ids
     LEFT JOIN data_sources ds ON ds.id = ids.id
     WHERE ds.id IS NULL
       AND ids.source_code IN (${normalizedSourceCodes.map(() => "?").join(", ")})`,
    [projectId, ...normalizedSourceCodes]
  );
}

function rebuildIntegrity(payload) {
  const packageWithoutIntegrity = { ...payload, manifest: { ...payload.manifest } };
  delete packageWithoutIntegrity.manifest.integrity;
  payload.manifest.integrity = {
    algorithm: "sha256",
    payloadSha256: calculateSha256(packageWithoutIntegrity),
    tables: payload.tables.map((table) => ({
      tableName: table.tableName,
      rowCount: table.rows.length,
      sha256: calculateSha256({ tableName: table.tableName, columns: table.columns, rows: table.rows }),
    })),
  };
}

function remapStandardFieldMappings(payload, sourceElementCodes, targetElementIds) {
  const mappings = payload.tables.find((table) => table.tableName === "std_field_mappings");
  if (!mappings) return;
  for (const row of mappings.rows) {
    const elementCode = sourceElementCodes[String(row.element_id)];
    const targetElementId = elementCode ? targetElementIds.get(elementCode) : null;
    if (targetElementId) row.element_id = targetElementId;
  }
}

function removeSharedStandardAssets(payload) {
  payload.tables = payload.tables.filter((table) => !sharedStandardTables.has(table.tableName));
  const allowedTableNames = new Set(payload.tables.map((table) => table.tableName));
  payload.schema.importOrder = (payload.schema.importOrder || []).filter((tableName) => allowedTableNames.has(tableName));
  payload.schema.foreignKeys = (payload.schema.foreignKeys || []).filter((foreignKey) =>
    allowedTableNames.has(foreignKey.childTable) && allowedTableNames.has(foreignKey.parentTable)
  );
  payload.manifest.modules = (payload.manifest.modules || []).map((module) => {
    const tables = payload.tables.filter((table) => table.moduleKey === module.moduleKey);
    return {
      ...module,
      tableCount: tables.length,
      rowCount: tables.reduce((total, table) => total + table.rows.length, 0),
    };
  }).filter((module) => module.tableCount > 0);
  rebuildIntegrity(payload);
}

async function seedQualityRegexRules(pool, manifest) {
  const seed = manifest.qualityRegexRules;
  if (!seed?.fileName) return;
  const filePath = path.join(snapshotDir, path.basename(seed.fileName));
  if (!fs.existsSync(filePath)) throw new Error(`[seed-assets] missing quality regex rule seed: ${seed.fileName}`);
  const records = JSON.parse(fs.readFileSync(filePath, "utf8"));
  for (const record of records) {
    const matchExamples = typeof record.match_example_json === "string" ? record.match_example_json : JSON.stringify(record.match_example_json || []);
    const mismatchExamples = typeof record.mismatch_example_json === "string" ? record.mismatch_example_json : JSON.stringify(record.mismatch_example_json || []);
    await pool.query(
      `INSERT INTO qc_regex_rule
        (rule_code, rule_name, rule_scene, regex_pattern, match_example_json, mismatch_example_json, severity, status, is_builtin, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         rule_name=VALUES(rule_name), rule_scene=VALUES(rule_scene), regex_pattern=VALUES(regex_pattern),
         match_example_json=VALUES(match_example_json), mismatch_example_json=VALUES(mismatch_example_json),
         severity=VALUES(severity), status=VALUES(status), is_builtin=VALUES(is_builtin), created_by=VALUES(created_by)`,
      [record.rule_code, record.rule_name, record.rule_scene || "compliance", record.regex_pattern,
        matchExamples, mismatchExamples, record.severity || "medium", record.status || "active",
        record.is_builtin ? 1 : 0, record.created_by || "system"]
    );
  }
  console.log(`[seed-assets] synced ${records.length} quality regex rules`);
}

function normalizeSeedValue(value) {
  if (value && typeof value === "object" && !Buffer.isBuffer(value) && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
}

async function seedModelSystemPrompts(pool, manifest) {
  const seed = manifest.modelSystemPrompts;
  if (!seed?.fileName) return;
  const filePath = path.join(snapshotDir, path.basename(seed.fileName));
  if (!fs.existsSync(filePath)) throw new Error(`[seed-assets] missing model system prompt seed: ${seed.fileName}`);
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let syncedRows = 0;

  for (const table of payload.tables || []) {
    const spec = modelSystemPromptTableSpecs.get(String(table.tableName || ""));
    if (!spec) continue;
    const [columnRows] = await pool.query(
      `SELECT COLUMN_NAME AS columnName
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table.tableName]
    );
    const existingColumns = new Set(columnRows.map((row) => String(row.columnName)));
    const columns = spec.columns.filter((columnName) => existingColumns.has(columnName));
    const keyColumns = spec.keyColumns.filter((columnName) => columns.includes(columnName));
    if (keyColumns.length !== spec.keyColumns.length) {
      throw new Error(`[seed-assets] model system prompt table ${table.tableName} is missing key columns`);
    }

    for (const record of table.rows || []) {
      const keyValues = keyColumns.map((columnName) => normalizeSeedValue(record[columnName]));
      if (keyValues.some((value) => value === null || value === undefined || value === "")) continue;
      const whereClause = keyColumns.map((columnName) => `\`${columnName}\` = ?`).join(" AND ");
      const [existingRows] = await pool.query(
        `SELECT 1 FROM \`${table.tableName}\` WHERE ${whereClause} LIMIT 1`,
        keyValues
      );
      const writableColumns = columns.filter((columnName) => Object.prototype.hasOwnProperty.call(record, columnName));
      if (existingRows.length) {
        const updateColumns = writableColumns.filter((columnName) => !keyColumns.includes(columnName));
        if (updateColumns.length) {
          await pool.query(
            `UPDATE \`${table.tableName}\`
             SET ${updateColumns.map((columnName) => `\`${columnName}\` = ?`).join(", ")}
             WHERE ${whereClause}`,
            [...updateColumns.map((columnName) => normalizeSeedValue(record[columnName])), ...keyValues]
          );
        }
      } else {
        await pool.query(
          `INSERT INTO \`${table.tableName}\`
            (${writableColumns.map((columnName) => `\`${columnName}\``).join(", ")})
           VALUES (${writableColumns.map(() => "?").join(", ")})`,
          writableColumns.map((columnName) => normalizeSeedValue(record[columnName]))
        );
      }
      syncedRows += 1;
    }
  }

  console.log(`[seed-assets] synced ${syncedRows} model system prompt records`);
}

async function seedSystemKnowledgeBases(pool, projectId) {
  if (!projectId) return;
  const records = [
    { name: "行业知识库示例", description: "用于数据建模行业场景选择和二次开发验证。", tags: ["scope:industry", "seed:third-party-source"] },
    { name: "平台知识库示例", description: "用于沉淀平台规范、实施方法和公共知识。", tags: ["scope:platform", "seed:third-party-source"] },
    { name: "个人知识库示例", description: "用于验证项目内个人知识维护流程。", tags: ["scope:personal", "seed:third-party-source"] },
  ];
  for (const record of records) {
    const [[existing]] = await pool.query(
      "SELECT id FROM system_knowledge_base WHERE project_id = ? AND kb_name = ? LIMIT 1",
      [projectId, record.name]
    );
    if (existing) continue;
    await pool.query(
      `INSERT INTO system_knowledge_base (project_id, kb_name, kb_desc, tags_json, status, created_by)
       VALUES (?, ?, ?, ?, 'active', 'System Administrator')`,
      [projectId, record.name, record.description, JSON.stringify(record.tags)]
    );
  }
}

async function ensureLocalDevelopmentDatasource(pool, projectId) {
  if (!projectId) return;
  const { encryptSecret } = require(path.join(packageRoot, "backend", "src", "modules", "data-development", "data-development.utils"));
  const name = "源码包本地 MySQL";
  const host = String(process.env.DB_HOST || "127.0.0.1").trim() || "127.0.0.1";
  const port = Number(process.env.DB_PORT || 46122);
  const databaseName = String(process.env.DB_NAME || "data_platform_source").trim() || "data_platform_source";
  const username = String(process.env.DB_USER || "root").trim() || "root";
  const passwordEncrypted = encryptSecret(String(process.env.DB_PASSWORD || "change-me"));
  const extraConfig = JSON.stringify({
    purpose: "第三方源码包独立开发数据库",
    sourceEditionLocal: true,
  });
  const [[existing]] = await pool.query(
    "SELECT id FROM dev_datasources WHERE project_id = ? AND name = ? LIMIT 1",
    [projectId, name]
  );
  if (existing) {
    await pool.query(
      `UPDATE dev_datasources
       SET type = 'mysql', host = ?, port = ?, database_name = ?, username = ?,
           password_encrypted = ?, extra_config_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [host, port, databaseName, username, passwordEncrypted, extraConfig, Number(existing.id)]
    );
    return;
  }
  await pool.query(
    `INSERT INTO dev_datasources
      (project_id, name, type, host, port, database_name, username, password_encrypted, extra_config_json)
     VALUES (?, ?, 'mysql', ?, ?, ?, ?, ?, ?)`,
    [projectId, name, host, port, databaseName, username, passwordEncrypted, extraConfig]
  );
}

async function main() {
  if (!fs.existsSync(manifestPath)) {
    console.log("[seed-assets] no project asset snapshots found; skipping import");
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const seedFingerprint = calculateSeedFingerprint(manifest);
  const seedAlreadyApplied = fs.existsSync(seedMarkerPath)
    && fs.readFileSync(seedMarkerPath, "utf8").trim() === seedFingerprint;
  const assets = require(path.join(packageRoot, "backend", "src", "modules", "project-spaces", "project-asset.service"));
  const { pool } = require(path.join(packageRoot, "backend", "src", "config", "database"));
  const { runMigrations } = require(path.join(packageRoot, "backend", "src", "database", "migrate"));
  const {
    seedSystemRoles,
    seedAdminUser,
    seedDemoDataSources,
    seedDemoLabDataSources,
    seedBuiltinAiConfigs,
    seedPlatformAssets,
    seedScenarioEnhancementProfiles,
  } = require(path.join(packageRoot, "backend", "src", "database", "seed"));
  await runMigrations();
  await seedSystemRoles();
  await seedAdminUser();
  await seedBuiltinAiConfigs();
  if (String(process.env.SEED_DEMO_DATA).toLowerCase() !== "false") {
    await seedDemoDataSources();
    await seedDemoLabDataSources();
    await seedPlatformAssets();
  }
  await seedScenarioEnhancementProfiles();
  await seedModelSystemPrompts(pool, manifest);
  await seedQualityRegexRules(pool, manifest);
  let [elementRows] = await pool.query("SELECT id, element_code AS elementCode FROM std_data_elements");
  let targetElementIds = new Map(elementRows.map((row) => [String(row.elementCode), Number(row.id)]));
  const operator = { sub: 1, username: "admin", displayName: "System Administrator" };
  let defaultProjectId = null;

  for (const project of manifest.projects || []) {
    const [[existing]] = await pool.query("SELECT id FROM project_spaces WHERE project_code = ? LIMIT 1", [project.targetProjectCode]);
    if (existing && seedAlreadyApplied) {
      console.log(`[seed-assets] ${project.targetProjectCode} already exists; skipping import`);
      if (project.sourceProjectCode === "default") defaultProjectId = Number(existing.id);
      await ensureLocalDevelopmentDatasource(pool, Number(existing.id));
      continue;
    }
    const payload = JSON.parse(fs.readFileSync(path.join(snapshotDir, project.fileName), "utf8"));
    if (existing || project.sourceProjectCode !== "default") {
      [elementRows] = await pool.query("SELECT id, element_code AS elementCode FROM std_data_elements");
      targetElementIds = new Map(elementRows.map((row) => [String(row.elementCode), Number(row.id)]));
      remapStandardFieldMappings(payload, manifest.sourceElementCodes || {}, targetElementIds);
      rebuildIntegrity(payload);
    }
    if (existing) removeSharedStandardAssets(payload);
    const result = await assets.importProject(payload, {
      mode: existing ? "overwrite" : "new",
      targetProjectId: existing ? Number(existing.id) : null,
      targetProjectCode: project.targetProjectCode,
      targetProjectName: payload.project.projectName,
      skipAutomaticBackup: true,
    }, operator);
    if (project.sourceProjectCode === "default") defaultProjectId = result.projectId;
    const ingestionSources = payload.tables.find((table) => table.tableName === "ingestion_data_sources");
    await synchronizeIntegrationDataSources(pool, result.projectId, (ingestionSources?.rows || []).map((row) => row.source_code));
    await ensureLocalDevelopmentDatasource(pool, result.projectId);
    console.log(`[seed-assets] imported ${project.targetProjectCode}: ${result.summary.rowCount} rows`);
  }

  if (defaultProjectId) {
    await pool.query("UPDATE users SET default_project_id = ? WHERE username = 'admin'", [defaultProjectId]);
  }
  if (!defaultProjectId) {
    const [[fallbackProject]] = await pool.query("SELECT id FROM project_spaces ORDER BY is_default DESC, id ASC LIMIT 1");
    defaultProjectId = fallbackProject ? Number(fallbackProject.id) : null;
  }
  await seedSystemKnowledgeBases(pool, defaultProjectId);
  fs.mkdirSync(path.dirname(seedMarkerPath), { recursive: true });
  fs.writeFileSync(seedMarkerPath, `${seedFingerprint}\n`, "utf8");
  await pool.end();
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  if (error.details) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
});
