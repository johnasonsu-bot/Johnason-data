const createTableStatements = [
  `CREATE TABLE IF NOT EXISTS std_catalogs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    parent_id BIGINT NULL,
    catalog_name VARCHAR(128) NOT NULL,
    catalog_code VARCHAR(64) NOT NULL UNIQUE,
    catalog_type VARCHAR(32) NOT NULL DEFAULT 'business_domain',
    owner_name VARCHAR(64) NULL,
    description TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_std_catalog_parent (parent_id),
    KEY idx_std_catalog_status (status),
    CONSTRAINT fk_std_catalog_parent FOREIGN KEY (parent_id) REFERENCES std_catalogs(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS std_reference_standards (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    standard_code VARCHAR(64) NOT NULL UNIQUE,
    standard_name VARCHAR(255) NOT NULL,
    standard_type VARCHAR(32) NOT NULL DEFAULT 'enterprise',
    standard_no VARCHAR(128) NULL,
    publisher VARCHAR(128) NULL,
    effective_date DATE NULL,
    standard_url VARCHAR(512) NULL,
    description TEXT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_std_reference_standard_type (standard_type),
    KEY idx_std_reference_standard_status (status)
  )`,
  `CREATE TABLE IF NOT EXISTS std_value_domains (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    domain_code VARCHAR(64) NOT NULL UNIQUE,
    domain_name VARCHAR(128) NOT NULL,
    domain_type VARCHAR(32) NOT NULL DEFAULT 'enumeration',
    value_type VARCHAR(32) NOT NULL DEFAULT 'string',
    data_type VARCHAR(64) NULL,
    min_value DECIMAL(30,10) NULL,
    max_value DECIMAL(30,10) NULL,
    regex_pattern VARCHAR(1024) NULL,
    format_pattern VARCHAR(255) NULL,
    unit VARCHAR(64) NULL,
    reference_standard_id BIGINT NULL,
    reference_clause VARCHAR(255) NULL,
    description TEXT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_std_value_domain_type (domain_type),
    KEY idx_std_value_domain_status (status),
    KEY idx_std_value_domain_reference (reference_standard_id),
    CONSTRAINT fk_std_value_domain_reference FOREIGN KEY (reference_standard_id) REFERENCES std_reference_standards(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS std_value_domain_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    domain_id BIGINT NOT NULL,
    item_code VARCHAR(128) NOT NULL,
    item_label VARCHAR(255) NOT NULL,
    item_value VARCHAR(255) NULL,
    item_meaning VARCHAR(512) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_std_value_domain_item (domain_id, item_code),
    KEY idx_std_value_domain_item_domain (domain_id),
    CONSTRAINT fk_std_value_domain_item_domain FOREIGN KEY (domain_id) REFERENCES std_value_domains(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS std_data_elements (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    element_identifier VARCHAR(128) NOT NULL UNIQUE,
    element_code VARCHAR(128) NOT NULL UNIQUE,
    element_name_cn VARCHAR(128) NOT NULL,
    element_name_en VARCHAR(128) NULL,
    catalog_id BIGINT NULL,
    object_class VARCHAR(128) NULL,
    property_name VARCHAR(128) NULL,
    representation_term VARCHAR(64) NULL,
    qualifiers_json JSON NULL,
    definition TEXT NULL,
    data_type VARCHAR(64) NOT NULL DEFAULT 'string',
    max_length INT NULL,
    numeric_precision_value INT NULL,
    numeric_scale_value INT NULL,
    datetime_precision VARCHAR(32) NULL,
    format_pattern VARCHAR(255) NULL,
    unit VARCHAR(64) NULL,
    value_domain_id BIGINT NULL,
    reference_standard_id BIGINT NULL,
    reference_clause VARCHAR(255) NULL,
    aliases_json JSON NULL,
    tags_json JSON NULL,
    owner_name VARCHAR(64) NULL,
    steward_name VARCHAR(64) NULL,
    lifecycle_status VARCHAR(16) NOT NULL DEFAULT 'draft',
    current_version_no INT NOT NULL DEFAULT 1,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    published_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_std_data_element_catalog (catalog_id),
    KEY idx_std_data_element_lifecycle (lifecycle_status),
    KEY idx_std_data_element_status (status),
    KEY idx_std_data_element_value_domain (value_domain_id),
    KEY idx_std_data_element_reference (reference_standard_id),
    FULLTEXT KEY ft_std_data_element_search (element_code, element_name_cn, element_name_en, object_class, property_name, representation_term),
    CONSTRAINT fk_std_data_element_catalog FOREIGN KEY (catalog_id) REFERENCES std_catalogs(id) ON DELETE SET NULL,
    CONSTRAINT fk_std_data_element_value_domain FOREIGN KEY (value_domain_id) REFERENCES std_value_domains(id) ON DELETE SET NULL,
    CONSTRAINT fk_std_data_element_reference FOREIGN KEY (reference_standard_id) REFERENCES std_reference_standards(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS std_data_element_versions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    element_id BIGINT NOT NULL,
    version_no INT NOT NULL,
    version_status VARCHAR(16) NOT NULL DEFAULT 'draft',
    snapshot_json JSON NOT NULL,
    change_summary VARCHAR(512) NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    published_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_std_data_element_version (element_id, version_no),
    KEY idx_std_data_element_version_status (version_status),
    CONSTRAINT fk_std_data_element_version_element FOREIGN KEY (element_id) REFERENCES std_data_elements(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS std_field_mappings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    element_id BIGINT NOT NULL,
    source_module VARCHAR(32) NOT NULL DEFAULT 'data_map',
    resource_id BIGINT NULL,
    resource_code VARCHAR(255) NULL,
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255) NOT NULL,
    field_snapshot_json JSON NULL,
    mapping_status VARCHAR(16) NOT NULL DEFAULT 'suggested',
    confidence DECIMAL(6,4) NULL,
    evidence_json JSON NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    reviewed_by VARCHAR(64) NULL,
    reviewed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_std_field_mapping_element (element_id),
    KEY idx_std_field_mapping_resource (resource_id),
    KEY idx_std_field_mapping_field (source_module, table_name, column_name),
    KEY idx_std_field_mapping_status (mapping_status),
    CONSTRAINT fk_std_field_mapping_element FOREIGN KEY (element_id) REFERENCES std_data_elements(id) ON DELETE CASCADE,
    CONSTRAINT fk_std_field_mapping_resource FOREIGN KEY (resource_id) REFERENCES dm_resources(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS std_compliance_runs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_name VARCHAR(128) NOT NULL,
    scope_type VARCHAR(32) NOT NULL DEFAULT 'data_map',
    scope_config_json JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    total_fields INT NOT NULL DEFAULT 0,
    checked_fields INT NOT NULL DEFAULT 0,
    finding_count INT NOT NULL DEFAULT 0,
    summary_json JSON NULL,
    error_message TEXT NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_std_compliance_run_status (status)
  )`,
  `CREATE TABLE IF NOT EXISTS std_compliance_findings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_id BIGINT NOT NULL,
    element_id BIGINT NULL,
    mapping_id BIGINT NULL,
    resource_id BIGINT NULL,
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255) NOT NULL,
    finding_type VARCHAR(32) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'medium',
    finding_message VARCHAR(1024) NOT NULL,
    expected_json JSON NULL,
    actual_json JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_std_compliance_finding_run (run_id),
    KEY idx_std_compliance_finding_element (element_id),
    KEY idx_std_compliance_finding_status (status),
    CONSTRAINT fk_std_compliance_finding_run FOREIGN KEY (run_id) REFERENCES std_compliance_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_std_compliance_finding_element FOREIGN KEY (element_id) REFERENCES std_data_elements(id) ON DELETE SET NULL,
    CONSTRAINT fk_std_compliance_finding_mapping FOREIGN KEY (mapping_id) REFERENCES std_field_mappings(id) ON DELETE SET NULL,
    CONSTRAINT fk_std_compliance_finding_resource FOREIGN KEY (resource_id) REFERENCES dm_resources(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS std_ai_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    scene_name VARCHAR(128) NOT NULL,
    scene_code VARCHAR(64) NOT NULL UNIQUE,
    default_model_provider_id BIGINT NULL,
    default_model_name VARCHAR(128) NULL,
    default_model_version VARCHAR(128) NULL,
    temperature DECIMAL(4,2) NULL,
    max_tokens INT NULL,
    timeout_ms INT NULL,
    system_prompt LONGTEXT NULL,
    user_prompt_template LONGTEXT NULL,
    output_schema_json JSON NULL,
    description VARCHAR(512) NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_std_ai_config_provider (default_model_provider_id),
    CONSTRAINT fk_std_ai_config_provider FOREIGN KEY (default_model_provider_id) REFERENCES model_providers(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS std_ai_runs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    scene_code VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NULL,
    target_id BIGINT NULL,
    model_provider_id BIGINT NULL,
    model_name VARCHAR(128) NULL,
    model_version VARCHAR(128) NULL,
    request_json JSON NULL,
    response_json JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'success',
    duration_ms INT NULL,
    error_message VARCHAR(1024) NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_std_ai_run_scene (scene_code),
    KEY idx_std_ai_run_target (target_type, target_id),
    KEY idx_std_ai_run_provider (model_provider_id),
    CONSTRAINT fk_std_ai_run_provider FOREIGN KEY (model_provider_id) REFERENCES model_providers(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS std_import_batches (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    import_type VARCHAR(32) NOT NULL DEFAULT 'bundle',
    import_strategy VARCHAR(32) NOT NULL DEFAULT 'merge',
    template_version VARCHAR(32) NOT NULL DEFAULT 'v1',
    source_file_name VARCHAR(255) NOT NULL,
    source_file_size BIGINT NOT NULL DEFAULT 0,
    source_file_hash VARCHAR(64) NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'processing',
    total_rows INT NOT NULL DEFAULT 0,
    created_rows INT NOT NULL DEFAULT 0,
    updated_rows INT NOT NULL DEFAULT 0,
    skipped_rows INT NOT NULL DEFAULT 0,
    error_rows INT NOT NULL DEFAULT 0,
    summary_json JSON NULL,
    error_message TEXT NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_std_import_batch_project_created (project_id, created_at, id),
    KEY idx_std_import_batch_status (status)
  )`,
  `CREATE TABLE IF NOT EXISTS std_import_errors (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    batch_id BIGINT NOT NULL,
    sheet_name VARCHAR(128) NOT NULL,
    excel_row_number INT NOT NULL,
    business_code VARCHAR(255) NULL,
    field_name VARCHAR(128) NULL,
    raw_value TEXT NULL,
    error_type VARCHAR(64) NOT NULL DEFAULT 'validation',
    error_message VARCHAR(1024) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_std_import_error_batch (batch_id, excel_row_number),
    CONSTRAINT fk_std_import_error_batch FOREIGN KEY (batch_id) REFERENCES std_import_batches(id) ON DELETE CASCADE
  )`,
];

const projectScopedStandardTables = [
  "std_catalogs",
  "std_reference_standards",
  "std_value_domains",
  "std_value_domain_items",
  "std_data_elements",
  "std_data_element_versions",
  "std_field_mappings",
  "std_compliance_runs",
  "std_compliance_findings",
  "std_ai_configs",
  "std_ai_runs",
  "std_import_batches",
  "std_import_errors",
];

async function columnExists(pool, tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName],
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function indexExists(pool, tableName, indexName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [tableName, indexName],
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function ensureProjectScope(pool) {
  for (const tableName of projectScopedStandardTables) {
    if (!(await columnExists(pool, tableName, "project_id"))) {
      await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN project_id BIGINT NULL AFTER id`);
    }
    await pool.query(
      `UPDATE \`${tableName}\` t
       SET t.project_id = COALESCE(t.project_id, (
         SELECT p.id FROM project_spaces p ORDER BY p.id ASC LIMIT 1
       ))
       WHERE t.project_id IS NULL`,
    );
    const indexName = `idx_${tableName}_project`;
    if (!(await indexExists(pool, tableName, indexName))) {
      await pool.query(`ALTER TABLE \`${tableName}\` ADD KEY \`${indexName}\` (project_id)`);
    }
  }

  const uniqueMigrations = [
    ["std_catalogs", "catalog_code", "uk_std_catalog_project_code", "project_id, catalog_code"],
    ["std_reference_standards", "standard_code", "uk_std_reference_project_code", "project_id, standard_code"],
    ["std_value_domains", "domain_code", "uk_std_value_domain_project_code", "project_id, domain_code"],
    ["std_value_domain_items", "uk_std_value_domain_item", "uk_std_value_domain_item_project", "project_id, domain_id, item_code"],
    ["std_data_elements", "element_identifier", "uk_std_data_element_project_identifier", "project_id, element_identifier"],
    ["std_data_elements", "element_code", "uk_std_data_element_project_code", "project_id, element_code"],
    ["std_data_element_versions", "uk_std_data_element_version", "uk_std_data_element_version_project", "project_id, element_id, version_no"],
    ["std_ai_configs", "scene_code", "uk_std_ai_config_project_scene", "project_id, scene_code"],
  ];
  if (!(await indexExists(pool, "std_data_element_versions", "idx_std_data_element_version_element"))) {
    await pool.query("ALTER TABLE std_data_element_versions ADD KEY idx_std_data_element_version_element (element_id)");
  }
  for (const [tableName, oldIndex, newIndex, columns] of uniqueMigrations) {
    if (await indexExists(pool, tableName, oldIndex)) {
      await pool.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${oldIndex}\``);
    }
    if (!(await indexExists(pool, tableName, newIndex))) {
      await pool.query(`ALTER TABLE \`${tableName}\` ADD UNIQUE KEY \`${newIndex}\` (${columns})`);
    }
  }

  await cloneLegacyStandardsToProjects(pool);
}

async function cloneLegacyStandardsToProjects(pool) {
  const [projects] = await pool.query("SELECT id FROM project_spaces WHERE status <> 'deleted' ORDER BY id ASC");
  if (projects.length < 2) return;
  const sourceProjectId = Number(projects[0].id);
  const [[sourceCount]] = await pool.query("SELECT COUNT(*) AS total FROM std_data_elements WHERE project_id = ?", [sourceProjectId]);
  if (!Number(sourceCount.total || 0)) return;

  for (const project of projects.slice(1)) {
    const projectId = Number(project.id);
    const [[targetCount]] = await pool.query("SELECT COUNT(*) AS total FROM std_data_elements WHERE project_id = ?", [projectId]);
    if (Number(targetCount.total || 0)) continue;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const referenceMap = await cloneRows(connection, "std_reference_standards", sourceProjectId, projectId, []);
      const catalogMap = await cloneRows(connection, "std_catalogs", sourceProjectId, projectId, ["parent_id"]);
      await remapColumn(connection, "std_catalogs", projectId, "parent_id", catalogMap);
      const domainMap = await cloneRows(connection, "std_value_domains", sourceProjectId, projectId, ["reference_standard_id"]);
      await remapColumn(connection, "std_value_domains", projectId, "reference_standard_id", referenceMap);
      await cloneChildRows(connection, "std_value_domain_items", "domain_id", domainMap, projectId);
      const elementMap = await cloneRows(connection, "std_data_elements", sourceProjectId, projectId, ["catalog_id", "value_domain_id", "reference_standard_id"]);
      await remapColumn(connection, "std_data_elements", projectId, "catalog_id", catalogMap);
      await remapColumn(connection, "std_data_elements", projectId, "value_domain_id", domainMap);
      await remapColumn(connection, "std_data_elements", projectId, "reference_standard_id", referenceMap);
      await cloneChildRows(connection, "std_data_element_versions", "element_id", elementMap, projectId);
      await cloneRows(connection, "std_ai_configs", sourceProjectId, projectId, []);
      for (const [oldId, newId] of elementMap) {
        await connection.query("UPDATE std_field_mappings SET element_id = ? WHERE project_id = ? AND element_id = ?", [newId, projectId, oldId]);
        await connection.query("UPDATE std_compliance_findings SET element_id = ? WHERE project_id = ? AND element_id = ?", [newId, projectId, oldId]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

async function tableColumns(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME AS columnName, EXTRA AS extraInfo
     FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ORDINAL_POSITION`,
    [tableName],
  );
  return rows.filter((row) => !String(row.extraInfo || "").includes("auto_increment")).map((row) => row.columnName);
}

function cloneValue(value) {
  if (value === undefined) return null;
  if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return JSON.stringify(value);
  }
  return value;
}

async function cloneRows(connection, tableName, sourceProjectId, targetProjectId) {
  const columns = await tableColumns(connection, tableName);
  const insertColumns = columns.filter((column) => column !== "id");
  const [rows] = await connection.query(`SELECT * FROM \`${tableName}\` WHERE project_id = ? ORDER BY id ASC`, [sourceProjectId]);
  const idMap = new Map();
  for (const row of rows) {
    const values = insertColumns.map((column) => column === "project_id" ? targetProjectId : cloneValue(row[column]));
    const [result] = await connection.query(
      `INSERT INTO \`${tableName}\` (${insertColumns.map((column) => `\`${column}\``).join(",")}) VALUES (${insertColumns.map(() => "?").join(",")})`,
      values,
    );
    idMap.set(Number(row.id), Number(result.insertId));
  }
  return idMap;
}

async function remapColumn(connection, tableName, projectId, columnName, idMap) {
  for (const [oldId, newId] of idMap) {
    await connection.query(`UPDATE \`${tableName}\` SET \`${columnName}\` = ? WHERE project_id = ? AND \`${columnName}\` = ?`, [newId, projectId, oldId]);
  }
}

async function cloneChildRows(connection, tableName, parentColumn, parentMap, targetProjectId) {
  const columns = await tableColumns(connection, tableName);
  const insertColumns = columns.filter((column) => column !== "id");
  for (const [sourceParentId, targetParentId] of parentMap) {
    const [rows] = await connection.query(`SELECT * FROM \`${tableName}\` WHERE \`${parentColumn}\` = ? ORDER BY id ASC`, [sourceParentId]);
    for (const row of rows) {
      const values = insertColumns.map((column) => column === "project_id" ? targetProjectId : column === parentColumn ? targetParentId : cloneValue(row[column]));
      await connection.query(
        `INSERT INTO \`${tableName}\` (${insertColumns.map((column) => `\`${column}\``).join(",")}) VALUES (${insertColumns.map(() => "?").join(",")})`,
        values,
      );
    }
  }
}

module.exports = {
  createTableStatements,
  postMigrations: [ensureProjectScope],
};
