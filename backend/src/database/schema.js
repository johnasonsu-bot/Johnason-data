const crypto = require("crypto");

const createTableStatements = [
  `CREATE TABLE IF NOT EXISTS system_roles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(64) NOT NULL,
    role_code VARCHAR(32) NOT NULL UNIQUE,
    role_type VARCHAR(32) NOT NULL DEFAULT 'custom',
    permissions_json JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    is_system TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    role_id BIGINT NULL,
    role_code VARCHAR(32) NOT NULL DEFAULT 'admin',
    default_project_id BIGINT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    username VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    issued_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    user_agent VARCHAR(512) NULL,
    ip_address VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_auth_sessions_user_status (user_id, status),
    KEY idx_auth_sessions_status_expiry (status, expires_at),
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS project_spaces (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_name VARCHAR(128) NOT NULL,
    project_code VARCHAR(64) NOT NULL UNIQUE,
    project_type VARCHAR(32) NOT NULL DEFAULT 'standard',
    description VARCHAR(1024) NULL,
    owner_user_id BIGINT NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    resource_config_json JSON NULL,
    settings_json JSON NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_project_spaces_status (status),
    KEY idx_project_spaces_owner (owner_user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS project_members (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    project_role VARCHAR(32) NOT NULL DEFAULT 'developer',
    permissions_json JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_project_members_user (project_id, user_id),
    KEY idx_project_members_user (user_id, status),
    CONSTRAINT fk_project_members_project FOREIGN KEY (project_id) REFERENCES project_spaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS project_audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NULL,
    action_type VARCHAR(64) NOT NULL,
    operator_user_id BIGINT NULL,
    operator_name VARCHAR(128) NOT NULL DEFAULT 'system',
    detail_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_project_audit_project_created (project_id, created_at, id),
    KEY idx_project_audit_action_created (action_type, created_at, id)
  )`,
  `CREATE TABLE IF NOT EXISTS data_sources (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_name VARCHAR(128) NOT NULL,
    source_code VARCHAR(64) NOT NULL UNIQUE,
    source_domain VARCHAR(32) NOT NULL DEFAULT 'integration',
    source_type VARCHAR(32) NOT NULL,
    connection_config JSON NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ingestion_data_sources (
    id BIGINT PRIMARY KEY,
    source_name VARCHAR(128) NOT NULL,
    source_code VARCHAR(64) NOT NULL UNIQUE,
    source_type VARCHAR(32) NOT NULL,
    connection_config JSON NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS qc_data_sources (
    id BIGINT PRIMARY KEY,
    source_name VARCHAR(128) NOT NULL,
    source_code VARCHAR(64) NOT NULL UNIQUE,
    source_type VARCHAR(32) NOT NULL,
    connection_config JSON NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS data_source_research_tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_name VARCHAR(128) NOT NULL,
    source_id BIGINT NOT NULL,
    source_name VARCHAR(128) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    database_name VARCHAR(128) NULL,
    schema_name VARCHAR(128) NULL,
    table_scope VARCHAR(16) NOT NULL DEFAULT 'all',
    config_json JSON NULL,
    selected_tables_json JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    last_run_id BIGINT NULL,
    last_run_status VARCHAR(16) NULL,
    last_run_at DATETIME NULL,
    description TEXT NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_data_source_research_tasks_source (source_id),
    KEY idx_data_source_research_tasks_status (status),
    KEY idx_data_source_research_tasks_updated (updated_at),
    CONSTRAINT fk_data_source_research_task_source FOREIGN KEY (source_id) REFERENCES data_sources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS data_source_research_runs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NULL,
    run_no INT NULL,
    source_id BIGINT NOT NULL,
    run_name VARCHAR(128) NOT NULL,
    source_name VARCHAR(128) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    database_name VARCHAR(128) NULL,
    schema_name VARCHAR(128) NULL,
    table_scope VARCHAR(16) NOT NULL DEFAULT 'all',
    config_json JSON NULL,
    selected_tables_json JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    progress_percent INT NOT NULL DEFAULT 0,
    current_stage VARCHAR(64) NULL,
    report_json JSON NULL,
    summary_text TEXT NULL,
    error_message TEXT NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_data_source_research_runs_source_created (source_id, created_at, id),
    KEY idx_data_source_research_runs_task_created (task_id, created_at, id),
    KEY idx_data_source_research_runs_status (status),
    CONSTRAINT fk_data_source_research_run_task FOREIGN KEY (task_id) REFERENCES data_source_research_tasks(id) ON DELETE SET NULL,
    CONSTRAINT fk_data_source_research_source FOREIGN KEY (source_id) REFERENCES data_sources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS data_source_research_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_id BIGINT NOT NULL,
    stage_key VARCHAR(64) NOT NULL,
    log_level VARCHAR(16) NOT NULL DEFAULT 'info',
    message VARCHAR(512) NOT NULL,
    detail_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_data_source_research_logs_run_created (run_id, created_at, id),
    CONSTRAINT fk_data_source_research_log_run FOREIGN KEY (run_id) REFERENCES data_source_research_runs(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS data_source_research_table_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_id BIGINT NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    table_comment VARCHAR(512) NULL,
    row_count_mode VARCHAR(16) NOT NULL DEFAULT 'estimated',
    row_count BIGINT NULL,
    column_count INT NOT NULL DEFAULT 0,
    sample_count INT NOT NULL DEFAULT 0,
    category VARCHAR(32) NULL,
    priority VARCHAR(16) NULL,
    confidence DECIMAL(6,4) NULL,
    suggested_mode VARCHAR(32) NULL,
    incremental_column VARCHAR(255) NULL,
    metadata_issues_json JSON NULL,
    evidence_json JSON NULL,
    risks_json JSON NULL,
    quality_json JSON NULL,
    field_summary_json JSON NULL,
    indexes_count INT NOT NULL DEFAULT 0,
    constraints_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_data_source_research_table_profile_run FOREIGN KEY (run_id) REFERENCES data_source_research_runs(id) ON DELETE CASCADE,
    CONSTRAINT uk_data_source_research_table_profile UNIQUE KEY (run_id, table_name)
  )`,
  `CREATE TABLE IF NOT EXISTS data_source_research_field_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_id BIGINT NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255) NOT NULL,
    ordinal_position INT NOT NULL DEFAULT 0,
    data_type VARCHAR(128) NULL,
    column_type VARCHAR(255) NULL,
    is_nullable TINYINT(1) NOT NULL DEFAULT 1,
    is_primary_key TINYINT(1) NOT NULL DEFAULT 0,
    column_comment VARCHAR(512) NULL,
    null_rate DECIMAL(8,6) NULL,
    distinct_ratio DECIMAL(8,6) NULL,
    sample_values_json JSON NULL,
    issue_tags_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_data_source_research_field_profile_run FOREIGN KEY (run_id) REFERENCES data_source_research_runs(id) ON DELETE CASCADE,
    CONSTRAINT uk_data_source_research_field_profile UNIQUE KEY (run_id, table_name, column_name)
  )`,
  `CREATE TABLE IF NOT EXISTS data_source_research_ai_batches (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_id BIGINT NOT NULL,
    stage_key VARCHAR(64) NOT NULL,
    batch_no INT NOT NULL DEFAULT 1,
    batch_size INT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    input_summary_json JSON NULL,
    output_json JSON NULL,
    error_message TEXT NULL,
    duration_ms BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_data_source_research_ai_batch_run FOREIGN KEY (run_id) REFERENCES data_source_research_runs(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS data_source_research_report_comparisons (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    base_run_id BIGINT NOT NULL,
    target_run_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    diff_json JSON NULL,
    ai_summary_json JSON NULL,
    summary_text TEXT NULL,
    error_message TEXT NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_data_source_research_comparison_task (task_id, created_at, id),
    KEY idx_data_source_research_comparison_runs (base_run_id, target_run_id),
    CONSTRAINT fk_data_source_research_comparison_task FOREIGN KEY (task_id) REFERENCES data_source_research_tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_data_source_research_comparison_base_run FOREIGN KEY (base_run_id) REFERENCES data_source_research_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_data_source_research_comparison_target_run FOREIGN KEY (target_run_id) REFERENCES data_source_research_runs(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dm_departments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    department_name VARCHAR(128) NOT NULL,
    department_code VARCHAR(64) NOT NULL UNIQUE,
    department_short_name VARCHAR(64) NULL,
    parent_id BIGINT NULL,
    contact_name VARCHAR(64) NULL,
    contact_phone VARCHAR(64) NULL,
    contact_email VARCHAR(128) NULL,
    data_owner VARCHAR(64) NULL,
    data_steward VARCHAR(64) NULL,
    description TEXT NULL,
    tags_json JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dm_department_parent (parent_id),
    KEY idx_dm_department_status (status),
    CONSTRAINT fk_dm_department_parent FOREIGN KEY (parent_id) REFERENCES dm_departments(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dm_business_systems (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    department_id BIGINT NOT NULL,
    system_name VARCHAR(128) NOT NULL,
    system_code VARCHAR(64) NOT NULL UNIQUE,
    system_short_name VARCHAR(64) NULL,
    system_type VARCHAR(64) NULL,
    system_level VARCHAR(32) NULL,
    lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'online',
    online_date DATE NULL,
    contact_name VARCHAR(64) NULL,
    contact_phone VARCHAR(64) NULL,
    vendor_name VARCHAR(128) NULL,
    tech_owner VARCHAR(64) NULL,
    description TEXT NULL,
    tags_json JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dm_business_system_department (department_id),
    KEY idx_dm_business_system_status (status),
    CONSTRAINT fk_dm_business_system_department FOREIGN KEY (department_id) REFERENCES dm_departments(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS dm_data_sources (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    department_id BIGINT NOT NULL,
    business_system_id BIGINT NOT NULL,
    source_name VARCHAR(128) NOT NULL,
    source_code VARCHAR(64) NOT NULL UNIQUE,
    source_type VARCHAR(32) NOT NULL,
    connection_config JSON NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    environment VARCHAR(32) NOT NULL DEFAULT 'prod',
    purpose VARCHAR(255) NULL,
    source_ref_module VARCHAR(32) NULL,
    source_ref_id BIGINT NULL,
    source_ref_code VARCHAR(64) NULL,
    source_ref_snapshot_json JSON NULL,
    imported_at DATETIME NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dm_data_source_department (department_id),
    KEY idx_dm_data_source_system (business_system_id),
    KEY idx_dm_data_source_ref (source_ref_module, source_ref_id),
    KEY idx_dm_data_source_status (status),
    CONSTRAINT fk_dm_data_source_department FOREIGN KEY (department_id) REFERENCES dm_departments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_dm_data_source_system FOREIGN KEY (business_system_id) REFERENCES dm_business_systems(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS dm_catalogs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    parent_id BIGINT NULL,
    catalog_name VARCHAR(128) NOT NULL,
    catalog_short_code VARCHAR(32) NOT NULL,
    layer_code VARCHAR(32) NULL,
    department_id BIGINT NOT NULL,
    business_system_id BIGINT NULL,
    owner_name VARCHAR(64) NULL,
    description TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dm_catalog_parent (parent_id),
    KEY idx_dm_catalog_department (department_id),
    KEY idx_dm_catalog_system (business_system_id),
    KEY idx_dm_catalog_status (status),
    CONSTRAINT fk_dm_catalog_parent FOREIGN KEY (parent_id) REFERENCES dm_catalogs(id) ON DELETE SET NULL,
    CONSTRAINT fk_dm_catalog_department FOREIGN KEY (department_id) REFERENCES dm_departments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_dm_catalog_system FOREIGN KEY (business_system_id) REFERENCES dm_business_systems(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS dm_resource_sequences (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    department_code VARCHAR(64) NOT NULL,
    system_code VARCHAR(64) NOT NULL,
    catalog_short_code VARCHAR(32) NOT NULL,
    current_value INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_dm_resource_sequence_scope (department_code, system_code, catalog_short_code)
  )`,
  `CREATE TABLE IF NOT EXISTS dm_resources (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    resource_code VARCHAR(255) NOT NULL UNIQUE,
    catalog_id BIGINT NOT NULL,
    department_id BIGINT NOT NULL,
    business_system_id BIGINT NOT NULL,
    data_source_id BIGINT NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    table_comment VARCHAR(512) NULL,
    row_count BIGINT NULL,
    row_count_mode VARCHAR(16) NOT NULL DEFAULT 'estimated',
    column_count INT NOT NULL DEFAULT 0,
    resource_category VARCHAR(64) NULL,
    business_tags_json JSON NULL,
    source_snapshot_json JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    last_synced_at DATETIME NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_dm_resource_table (catalog_id, data_source_id, table_name),
    KEY idx_dm_resource_catalog (catalog_id),
    KEY idx_dm_resource_department (department_id),
    KEY idx_dm_resource_system (business_system_id),
    KEY idx_dm_resource_source (data_source_id),
    KEY idx_dm_resource_category (resource_category),
    CONSTRAINT fk_dm_resource_catalog FOREIGN KEY (catalog_id) REFERENCES dm_catalogs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_dm_resource_department FOREIGN KEY (department_id) REFERENCES dm_departments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_dm_resource_system FOREIGN KEY (business_system_id) REFERENCES dm_business_systems(id) ON DELETE RESTRICT,
    CONSTRAINT fk_dm_resource_source FOREIGN KEY (data_source_id) REFERENCES dm_data_sources(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS dm_resource_fields (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    resource_id BIGINT NOT NULL,
    column_name VARCHAR(255) NOT NULL,
    ordinal_position INT NOT NULL DEFAULT 0,
    data_type VARCHAR(128) NULL,
    column_type VARCHAR(255) NULL,
    is_nullable TINYINT(1) NOT NULL DEFAULT 1,
    is_primary_key TINYINT(1) NOT NULL DEFAULT 0,
    column_default VARCHAR(512) NULL,
    column_comment VARCHAR(512) NULL,
    business_name VARCHAR(128) NULL,
    semantic_tags_json JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_dm_resource_field (resource_id, column_name),
    KEY idx_dm_resource_field_resource (resource_id),
    CONSTRAINT fk_dm_resource_field_resource FOREIGN KEY (resource_id) REFERENCES dm_resources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dm_resource_lineage_edges (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_resource_id BIGINT NULL,
    target_resource_id BIGINT NULL,
    source_data_source_id BIGINT NULL,
    target_data_source_id BIGINT NULL,
    source_table_name VARCHAR(255) NOT NULL,
    target_table_name VARCHAR(255) NOT NULL,
    lineage_type VARCHAR(32) NOT NULL DEFAULT 'ingestion',
    relation_level VARCHAR(16) NOT NULL DEFAULT 'table',
    relation_source VARCHAR(64) NOT NULL,
    relation_source_id BIGINT NULL,
    confidence VARCHAR(16) NOT NULL DEFAULT 'high',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dm_lineage_source_resource (source_resource_id),
    KEY idx_dm_lineage_target_resource (target_resource_id),
    KEY idx_dm_lineage_source_ds (source_data_source_id),
    KEY idx_dm_lineage_target_ds (target_data_source_id),
    KEY idx_dm_lineage_type (lineage_type),
    CONSTRAINT fk_dm_lineage_source_resource FOREIGN KEY (source_resource_id) REFERENCES dm_resources(id) ON DELETE SET NULL,
    CONSTRAINT fk_dm_lineage_target_resource FOREIGN KEY (target_resource_id) REFERENCES dm_resources(id) ON DELETE SET NULL,
    CONSTRAINT fk_dm_lineage_source_ds FOREIGN KEY (source_data_source_id) REFERENCES dm_data_sources(id) ON DELETE SET NULL,
    CONSTRAINT fk_dm_lineage_target_ds FOREIGN KEY (target_data_source_id) REFERENCES dm_data_sources(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dm_resource_contents (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    resource_id BIGINT NOT NULL UNIQUE,
    business_name VARCHAR(128) NULL,
    business_definition TEXT NULL,
    business_grain VARCHAR(255) NULL,
    update_frequency VARCHAR(64) NULL,
    data_owner VARCHAR(64) NULL,
    tech_owner VARCHAR(64) NULL,
    usage_scenarios_json JSON NULL,
    usage_instruction TEXT NULL,
    quality_note TEXT NULL,
    known_issues TEXT NULL,
    retention_period VARCHAR(64) NULL,
    service_sla VARCHAR(128) NULL,
    extension_json JSON NULL,
    updated_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dm_resource_content_resource (resource_id),
    CONSTRAINT fk_dm_resource_content_resource FOREIGN KEY (resource_id) REFERENCES dm_resources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dm_resource_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    resource_id BIGINT NOT NULL UNIQUE,
    profile_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    sample_count INT NOT NULL DEFAULT 0,
    row_count BIGINT NULL,
    column_count INT NOT NULL DEFAULT 0,
    nullable_field_count INT NOT NULL DEFAULT 0,
    primary_key_fields_json JSON NULL,
    time_range_json JSON NULL,
    quality_summary_json JSON NULL,
    profile_json JSON NULL,
    ai_summary TEXT NULL,
    ai_output_json JSON NULL,
    ai_analyzed_at DATETIME NULL,
    error_message TEXT NULL,
    profiled_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dm_resource_profile_resource (resource_id),
    KEY idx_dm_resource_profile_status (profile_status),
    CONSTRAINT fk_dm_resource_profile_resource FOREIGN KEY (resource_id) REFERENCES dm_resources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dm_resource_field_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    resource_id BIGINT NOT NULL,
    column_name VARCHAR(255) NOT NULL,
    null_rate DECIMAL(10,6) NULL,
    distinct_ratio DECIMAL(10,6) NULL,
    sample_values_json JSON NULL,
    issue_tags_json JSON NULL,
    semantic_tags_json JSON NULL,
    feature_tags_json JSON NULL,
    ai_business_name VARCHAR(128) NULL,
    ai_business_meaning TEXT NULL,
    ai_output_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_dm_resource_field_profile (resource_id, column_name),
    KEY idx_dm_resource_field_profile_resource (resource_id),
    CONSTRAINT fk_dm_resource_field_profile_resource FOREIGN KEY (resource_id) REFERENCES dm_resources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS data_lab_sources (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_name VARCHAR(128) NOT NULL,
    source_code VARCHAR(64) NOT NULL UNIQUE,
    source_type VARCHAR(32) NOT NULL,
    connection_config JSON NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS qc_monitor_source (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_id BIGINT NOT NULL,
    scope_mode VARCHAR(16) NOT NULL DEFAULT 'all',
    selected_tables_json JSON NULL,
    detail_table_name VARCHAR(128) NOT NULL DEFAULT 'medata_quality_issue_detail',
    stats_table_name VARCHAR(128) NOT NULL DEFAULT 'medata_quality_issue_stats',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qc_monitor_source_source (source_id),
    CONSTRAINT fk_qc_monitor_source_source FOREIGN KEY (source_id) REFERENCES data_sources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_monitor_table (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    monitor_source_id BIGINT NOT NULL,
    source_id BIGINT NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    full_table_name VARCHAR(255) NULL,
    table_comment VARCHAR(512) NULL,
    business_system_id BIGINT NULL,
    system_mapping_source VARCHAR(32) NULL,
    system_mapping_confirmed_by VARCHAR(64) NULL,
    system_mapping_confirmed_at DATETIME NULL,
    responsible_department_id BIGINT NULL,
    data_owner_user_id BIGINT NULL,
    quality_owner_user_id BIGINT NULL,
    importance_level VARCHAR(16) NOT NULL DEFAULT 'normal',
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    strategy_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    column_snapshot_json JSON NULL,
    last_profile_json JSON NULL,
    last_sync_at DATETIME NULL,
    last_recommended_at DATETIME NULL,
    last_submitted_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qc_monitor_table_unique (monitor_source_id, table_name),
    KEY idx_qc_monitor_table_source (source_id),
    KEY idx_qc_monitor_table_status (strategy_status),
    CONSTRAINT fk_qc_monitor_table_monitor_source FOREIGN KEY (monitor_source_id) REFERENCES qc_monitor_source(id) ON DELETE CASCADE,
    CONSTRAINT fk_qc_monitor_table_source FOREIGN KEY (source_id) REFERENCES data_sources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_regex_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    rule_code VARCHAR(64) NOT NULL UNIQUE,
    rule_name VARCHAR(128) NOT NULL,
    rule_scene VARCHAR(32) NOT NULL DEFAULT 'compliance',
    regex_pattern VARCHAR(1024) NOT NULL,
    match_example_json JSON NULL,
    mismatch_example_json JSON NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'medium',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    is_builtin TINYINT(1) NOT NULL DEFAULT 0,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS qc_standard_dictionary (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NULL,
    dict_code VARCHAR(64) NOT NULL UNIQUE,
    dict_name VARCHAR(128) NOT NULL,
    dict_category VARCHAR(64) NOT NULL DEFAULT 'general',
    value_type VARCHAR(32) NOT NULL DEFAULT 'string',
    dict_desc VARCHAR(512) NULL,
    registration_mode VARCHAR(24) NOT NULL DEFAULT 'manual',
    source_system_id BIGINT NULL,
    source_system_code VARCHAR(64) NULL,
    source_system_name VARCHAR(128) NULL,
    source_id BIGINT NULL,
    source_code VARCHAR(64) NULL,
    source_name VARCHAR(128) NULL,
    source_table VARCHAR(255) NULL,
    code_field VARCHAR(128) NULL,
    value_field VARCHAR(128) NULL,
    label_field VARCHAR(128) NULL,
    filter_config_json JSON NULL,
    last_registered_at DATETIME NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS qc_standard_dictionary_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    dict_id BIGINT NOT NULL,
    item_code VARCHAR(128) NOT NULL,
    item_label VARCHAR(255) NOT NULL,
    item_value VARCHAR(255) NULL,
    min_value DECIMAL(18,6) NULL,
    max_value DECIMAL(18,6) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_qc_standard_dictionary_item_dict (dict_id),
    CONSTRAINT fk_qc_standard_dictionary_item_dict FOREIGN KEY (dict_id) REFERENCES qc_standard_dictionary(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_dict_mapping_template (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    template_code VARCHAR(64) NOT NULL UNIQUE,
    template_name VARCHAR(128) NOT NULL,
    dict_id BIGINT NOT NULL,
    biz_domain VARCHAR(64) NULL,
    mapping_mode VARCHAR(16) NOT NULL DEFAULT 'exact',
    template_desc VARCHAR(512) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_qc_dict_mapping_template_dict FOREIGN KEY (dict_id) REFERENCES qc_standard_dictionary(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_dict_mapping_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    template_id BIGINT NOT NULL,
    business_value VARCHAR(255) NULL,
    business_value_pattern VARCHAR(255) NULL,
    standard_code VARCHAR(128) NOT NULL,
    standard_label VARCHAR(255) NULL,
    match_priority INT NOT NULL DEFAULT 100,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_qc_dict_mapping_item_template (template_id),
    CONSTRAINT fk_qc_dict_mapping_item_template FOREIGN KEY (template_id) REFERENCES qc_dict_mapping_template(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_strategy (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    monitor_table_id BIGINT NOT NULL,
    source_id BIGINT NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    current_version_no INT NULL,
    current_version_id BIGINT NULL,
    strategy_status VARCHAR(16) NOT NULL DEFAULT 'draft',
    current_summary TEXT NULL,
    last_recommended_at DATETIME NULL,
    last_submitted_at DATETIME NULL,
    submitted_by VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qc_strategy_monitor_table (monitor_table_id),
    KEY idx_qc_strategy_source (source_id),
    KEY idx_qc_strategy_status (strategy_status),
    CONSTRAINT fk_qc_strategy_monitor_table FOREIGN KEY (monitor_table_id) REFERENCES qc_monitor_table(id) ON DELETE CASCADE,
    CONSTRAINT fk_qc_strategy_source FOREIGN KEY (source_id) REFERENCES data_sources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_strategy_version (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    strategy_id BIGINT NOT NULL,
    version_no INT NOT NULL,
    version_status VARCHAR(16) NOT NULL DEFAULT 'draft',
    profile_snapshot_json JSON NULL,
    recommendation_context_json JSON NULL,
    field_strategy_json JSON NOT NULL,
    advanced_rule_json JSON NULL,
    ai_summary_text TEXT NULL,
    ai_provider_id BIGINT NULL,
    ai_model_name VARCHAR(128) NULL,
    ai_model_version VARCHAR(128) NULL,
    sql_bundle_json JSON NULL,
    sql_content LONGTEXT NULL,
    reviewed_by VARCHAR(64) NULL,
    reviewed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qc_strategy_version_unique (strategy_id, version_no),
    KEY idx_qc_strategy_version_project (project_id),
    KEY idx_qc_strategy_version_status (version_status),
    CONSTRAINT fk_qc_strategy_version_strategy FOREIGN KEY (strategy_id) REFERENCES qc_strategy(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_recommendation_run (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    monitor_table_id BIGINT NOT NULL,
    source_id BIGINT NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    run_status VARCHAR(16) NOT NULL DEFAULT 'pending_review',
    sampling_config_json JSON NULL,
    profile_snapshot_json JSON NULL,
    candidate_field_json JSON NOT NULL,
    candidate_rule_json JSON NULL,
    summary_text TEXT NULL,
    model_used TINYINT(1) NOT NULL DEFAULT 0,
    ai_provider_id BIGINT NULL,
    ai_model_name VARCHAR(128) NULL,
    ai_model_version VARCHAR(128) NULL,
    recommendation_context_json JSON NULL,
    reviewed_by VARCHAR(64) NULL,
    reviewed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_qc_recommendation_run_project (project_id, created_at),
    KEY idx_qc_recommendation_run_monitor (monitor_table_id, run_status),
    CONSTRAINT fk_qc_recommendation_run_monitor FOREIGN KEY (monitor_table_id) REFERENCES qc_monitor_table(id) ON DELETE CASCADE,
    CONSTRAINT fk_qc_recommendation_run_source FOREIGN KEY (source_id) REFERENCES data_sources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS quality_ai_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    scene_name VARCHAR(128) NOT NULL,
    scene_code VARCHAR(64) NOT NULL UNIQUE,
    default_model_provider_id BIGINT NULL,
    default_model_name VARCHAR(128) NULL,
    default_model_version VARCHAR(128) NULL,
    temperature DECIMAL(4,2) NULL,
    max_tokens INT NULL,
    timeout_ms INT NULL,
    thinking_enabled TINYINT(1) NOT NULL DEFAULT 0,
    reasoning_effort VARCHAR(16) NULL,
    thinking_budget INT NULL,
    system_prompt TEXT NULL,
    description VARCHAR(512) NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS quality_ai_config_versions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    ai_config_id BIGINT NOT NULL,
    version_no INT NOT NULL,
    version_status VARCHAR(16) NOT NULL DEFAULT 'published',
    scene_name VARCHAR(128) NOT NULL,
    scene_code VARCHAR(64) NOT NULL,
    default_model_provider_id BIGINT NULL,
    default_model_name VARCHAR(128) NULL,
    default_model_version VARCHAR(128) NULL,
    temperature DECIMAL(4,2) NULL,
    max_tokens INT NULL,
    timeout_ms INT NULL,
    thinking_enabled TINYINT(1) NOT NULL DEFAULT 0,
    reasoning_effort VARCHAR(16) NULL,
    thinking_budget INT NULL,
    system_prompt LONGTEXT NULL,
    description VARCHAR(512) NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    published_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_quality_ai_config_versions_unique (ai_config_id, version_no),
    KEY idx_quality_ai_config_versions_status (version_status),
    CONSTRAINT fk_quality_ai_config_versions_ai_config FOREIGN KEY (ai_config_id) REFERENCES quality_ai_configs(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_name VARCHAR(128) NOT NULL,
    task_code VARCHAR(64) NOT NULL UNIQUE,
    monitor_table_id BIGINT NOT NULL,
    source_id BIGINT NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    strategy_id BIGINT NOT NULL,
    strategy_version_id BIGINT NOT NULL,
    detail_table_name VARCHAR(128) NOT NULL,
    stats_table_name VARCHAR(128) NOT NULL,
    fetch_mode VARCHAR(16) NOT NULL DEFAULT 'full',
    fetch_config_json JSON NULL,
    schedule_enabled TINYINT(1) NOT NULL DEFAULT 0,
    schedule_config_json JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'draft',
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    last_run_time DATETIME NULL,
    last_batch_id VARCHAR(64) NULL,
    last_run_status VARCHAR(16) NULL,
    latest_execution_info_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_qc_task_monitor_table (monitor_table_id),
    KEY idx_qc_task_source (source_id),
    KEY idx_qc_task_status (status),
    CONSTRAINT fk_qc_task_monitor_table FOREIGN KEY (monitor_table_id) REFERENCES qc_monitor_table(id) ON DELETE CASCADE,
    CONSTRAINT fk_qc_task_source FOREIGN KEY (source_id) REFERENCES data_sources(id) ON DELETE CASCADE,
    CONSTRAINT fk_qc_task_strategy FOREIGN KEY (strategy_id) REFERENCES qc_strategy(id) ON DELETE CASCADE,
    CONSTRAINT fk_qc_task_strategy_version FOREIGN KEY (strategy_version_id) REFERENCES qc_strategy_version(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_task_run (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NULL,
    task_id BIGINT NOT NULL,
    run_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    batch_id VARCHAR(64) NULL,
    start_time DATETIME NULL,
    end_time DATETIME NULL,
    issue_count BIGINT NOT NULL DEFAULT 0,
    stats_count BIGINT NOT NULL DEFAULT 0,
    error_message TEXT NULL,
    execution_info_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_qc_task_run_task (task_id),
    KEY idx_qc_task_run_status (run_status),
    CONSTRAINT fk_qc_task_run_task FOREIGN KEY (task_id) REFERENCES qc_task(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_quality_tag (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    tag_name VARCHAR(64) NOT NULL,
    tag_color VARCHAR(24) NOT NULL DEFAULT '#1677ff',
    tag_desc VARCHAR(255) NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qc_quality_tag_project_name (project_id, tag_name)
  )`,
  `CREATE TABLE IF NOT EXISTS qc_monitor_table_tag_relation (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    monitor_table_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qc_monitor_table_tag (monitor_table_id, tag_id),
    KEY idx_qc_monitor_table_tag_project (project_id),
    CONSTRAINT fk_qc_monitor_table_tag_monitor FOREIGN KEY (monitor_table_id) REFERENCES qc_monitor_table(id) ON DELETE CASCADE,
    CONSTRAINT fk_qc_monitor_table_tag_tag FOREIGN KEY (tag_id) REFERENCES qc_quality_tag(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_score_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    formula_version VARCHAR(32) NOT NULL DEFAULT 'v1',
    critical_weight DECIMAL(8,4) NOT NULL DEFAULT 1.50,
    high_weight DECIMAL(8,4) NOT NULL DEFAULT 1.20,
    medium_weight DECIMAL(8,4) NOT NULL DEFAULT 1.00,
    low_weight DECIMAL(8,4) NOT NULL DEFAULT 0.70,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qc_score_config_project_version (project_id, formula_version)
  )`,
  `CREATE TABLE IF NOT EXISTS qc_result_batch (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    task_run_id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    monitor_table_id BIGINT NOT NULL,
    source_id BIGINT NOT NULL,
    business_system_id BIGINT NULL,
    batch_id VARCHAR(96) NOT NULL,
    run_status VARCHAR(24) NOT NULL DEFAULT 'completed',
    evaluation_status VARCHAR(24) NOT NULL DEFAULT 'evaluated',
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    total_rule_count INT NOT NULL DEFAULT 0,
    failed_rule_count INT NOT NULL DEFAULT 0,
    issue_rows BIGINT NOT NULL DEFAULT 0,
    score DECIMAL(7,2) NULL,
    score_formula_version VARCHAR(32) NOT NULL DEFAULT 'v1',
    coverage_json JSON NULL,
    source_snapshot_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qc_result_batch_task_run (project_id, task_run_id),
    KEY idx_qc_result_batch_project_completed (project_id, completed_at),
    KEY idx_qc_result_batch_system (project_id, business_system_id, completed_at),
    KEY idx_qc_result_batch_table (project_id, monitor_table_id, completed_at),
    CONSTRAINT fk_qc_result_batch_task_run FOREIGN KEY (task_run_id) REFERENCES qc_task_run(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_result_rule_stat (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    result_batch_id BIGINT NOT NULL,
    monitor_table_id BIGINT NOT NULL,
    business_system_id BIGINT NULL,
    strategy_rule_instance_id VARCHAR(160) NOT NULL,
    metric_scope_key VARCHAR(255) NOT NULL,
    rule_category VARCHAR(64) NOT NULL,
    rule_code VARCHAR(128) NOT NULL,
    rule_name VARCHAR(255) NULL,
    field_name VARCHAR(255) NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'medium',
    evaluation_status VARCHAR(24) NOT NULL DEFAULT 'evaluated',
    total_rows BIGINT NULL,
    issue_rows BIGINT NULL,
    issue_rate DECIMAL(16,8) NULL,
    metric_value DECIMAL(24,8) NULL,
    baseline_value DECIMAL(24,8) NULL,
    threshold_value DECIMAL(24,8) NULL,
    baseline_result_batch_id BIGINT NULL,
    evidence_json JSON NULL,
    detected_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qc_result_rule_stat_natural (project_id, result_batch_id, strategy_rule_instance_id, metric_scope_key),
    KEY idx_qc_result_rule_stat_batch (result_batch_id),
    KEY idx_qc_result_rule_stat_table (project_id, monitor_table_id, detected_at),
    KEY idx_qc_result_rule_stat_system (project_id, business_system_id, detected_at),
    CONSTRAINT fk_qc_result_rule_stat_batch FOREIGN KEY (result_batch_id) REFERENCES qc_result_batch(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_result_sample (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    result_rule_stat_id BIGINT NOT NULL,
    sample_fingerprint CHAR(64) NOT NULL,
    masked_pk_text VARCHAR(1024) NULL,
    masked_value_text VARCHAR(1024) NULL,
    issue_message VARCHAR(1024) NULL,
    sample_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qc_result_sample_fingerprint (project_id, result_rule_stat_id, sample_fingerprint),
    CONSTRAINT fk_qc_result_sample_stat FOREIGN KEY (result_rule_stat_id) REFERENCES qc_result_rule_stat(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_finding (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    fingerprint VARCHAR(96) NOT NULL,
    monitor_table_id BIGINT NULL,
    business_system_id BIGINT NULL,
    result_rule_stat_id BIGINT NULL,
    finding_status VARCHAR(24) NOT NULL DEFAULT 'pending_confirmation',
    severity VARCHAR(16) NOT NULL DEFAULT 'medium',
    first_seen_at DATETIME NULL,
    last_seen_at DATETIME NULL,
    occurrence_count INT NOT NULL DEFAULT 1,
    note TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qc_finding_fingerprint (project_id, fingerprint),
    KEY idx_qc_finding_status (project_id, finding_status, last_seen_at)
  )`,
  `CREATE TABLE IF NOT EXISTS qc_issue (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    finding_id BIGINT NULL,
    issue_title VARCHAR(255) NOT NULL,
    issue_status VARCHAR(24) NOT NULL DEFAULT 'pending',
    severity VARCHAR(16) NOT NULL DEFAULT 'medium',
    owner_user_id BIGINT NULL,
    owner_name VARCHAR(64) NULL,
    due_date DATE NULL,
    description TEXT NULL,
    resolution_note TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_qc_issue_status (project_id, issue_status, updated_at),
    KEY idx_qc_issue_owner (project_id, owner_user_id, updated_at),
    CONSTRAINT fk_qc_issue_finding FOREIGN KEY (finding_id) REFERENCES qc_finding(id) ON DELETE SET NULL,
    CONSTRAINT fk_qc_issue_owner_user FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS qc_issue_occurrence (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    issue_id BIGINT NOT NULL,
    result_rule_stat_id BIGINT NULL,
    occurred_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qc_issue_occurrence (issue_id, result_rule_stat_id),
    CONSTRAINT fk_qc_issue_occurrence_issue FOREIGN KEY (issue_id) REFERENCES qc_issue(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_issue_event (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    issue_id BIGINT NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    event_note TEXT NULL,
    operator_name VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_qc_issue_event_issue (issue_id, created_at),
    CONSTRAINT fk_qc_issue_event_issue FOREIGN KEY (issue_id) REFERENCES qc_issue(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS qc_report (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    report_code VARCHAR(64) NOT NULL,
    report_scope VARCHAR(16) NOT NULL,
    analysis_mode VARCHAR(16) NOT NULL DEFAULT 'snapshot',
    comparison_type VARCHAR(32) NULL,
    object_type VARCHAR(16) NULL,
    object_ref_id BIGINT NULL,
    scope_ref_id BIGINT NULL,
    report_title VARCHAR(255) NOT NULL,
    report_status VARCHAR(16) NOT NULL DEFAULT 'success',
    batch_ids_json JSON NULL,
    baseline_report_id BIGINT NULL,
    current_report_id BIGINT NULL,
    baseline_batch_id BIGINT NULL,
    current_batch_id BIGINT NULL,
    snapshot_at DATETIME NULL,
    governance_snapshot_at DATETIME NULL,
    summary_schema_version VARCHAR(32) NOT NULL DEFAULT 'qc-report-summary-v2',
    score_formula_version VARCHAR(32) NOT NULL DEFAULT 'v1',
    deterministic_summary_json JSON NOT NULL,
    comparison_meta_json JSON NULL,
    ai_summary_json JSON NULL,
    ai_config_version_id BIGINT NULL,
    template_version VARCHAR(32) NOT NULL DEFAULT 'formal-v2',
    dimension_summary_json JSON NULL,
    chart_snapshot_json JSON NULL,
    report_html LONGTEXT NULL,
    report_markdown LONGTEXT NULL,
    word_generated_at DATETIME NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qc_report_project_code (project_id, report_code),
    KEY idx_qc_report_project_created (project_id, created_at),
    KEY idx_qc_report_project_compare (project_id, analysis_mode, comparison_type, created_at)
  )`,
  `CREATE TABLE IF NOT EXISTS qc_ai_analysis_run (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    scene_code VARCHAR(64) NOT NULL,
    scope_type VARCHAR(24) NOT NULL,
    scope_ref_id BIGINT NULL,
    run_status VARCHAR(16) NOT NULL DEFAULT 'success',
    input_summary_json JSON NOT NULL,
    output_json JSON NULL,
    model_name VARCHAR(128) NULL,
    config_version_id BIGINT NULL,
    error_message VARCHAR(1024) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_qc_ai_analysis_project_scene (project_id, scene_code, created_at)
  )`,
  `CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NULL,
    job_name VARCHAR(128) NOT NULL,
    job_code VARCHAR(64) NOT NULL UNIQUE,
    source_id BIGINT NOT NULL,
    schedule_type VARCHAR(32) NOT NULL DEFAULT 'manual',
    cron_expression VARCHAR(64) NULL,
    sync_mode VARCHAR(16) NOT NULL DEFAULT 'full',
    target_table VARCHAR(128) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'draft',
    last_run_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_ingestion_jobs_project (project_id),
    CONSTRAINT fk_ingestion_source FOREIGN KEY (source_id) REFERENCES data_sources(id)
  )`,
  `CREATE TABLE IF NOT EXISTS processing_jobs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    job_name VARCHAR(128) NOT NULL,
    job_code VARCHAR(64) NOT NULL UNIQUE,
    input_source VARCHAR(128) NOT NULL,
    output_target VARCHAR(128) NOT NULL,
    process_type VARCHAR(32) NOT NULL DEFAULT 'etl',
    process_config JSON NULL,
    schedule_type VARCHAR(32) NOT NULL DEFAULT 'manual',
    status VARCHAR(16) NOT NULL DEFAULT 'draft',
    last_run_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS service_apis (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    service_name VARCHAR(128) NOT NULL,
    service_code VARCHAR(64) NOT NULL UNIQUE,
    service_path VARCHAR(255) NOT NULL UNIQUE,
    request_method VARCHAR(16) NOT NULL DEFAULT 'GET',
    data_domain VARCHAR(64) NOT NULL,
    service_mode VARCHAR(16) NOT NULL DEFAULT 'table',
    source_id BIGINT NULL,
    source_table VARCHAR(255) NULL,
    source_sql LONGTEXT NULL,
    service_type VARCHAR(32) NOT NULL DEFAULT 'list',
    auth_type VARCHAR(32) NOT NULL DEFAULT 'token',
    status VARCHAR(16) NOT NULL DEFAULT 'offline',
    description VARCHAR(255) NULL,
    query_config_json JSON NULL,
    response_config_json JSON NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    published_at DATETIME NULL,
    last_called_at DATETIME NULL,
    total_calls BIGINT NOT NULL DEFAULT 0,
    success_calls BIGINT NOT NULL DEFAULT 0,
    failed_calls BIGINT NOT NULL DEFAULT 0,
    avg_latency_ms DECIMAL(18,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS service_data_sources (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_name VARCHAR(128) NOT NULL,
    source_code VARCHAR(64) NOT NULL UNIQUE,
    source_type VARCHAR(32) NOT NULL,
    connection_config JSON NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS service_apps (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    department_name VARCHAR(128) NULL,
    app_name VARCHAR(128) NOT NULL,
    app_code VARCHAR(64) NOT NULL UNIQUE,
    app_token VARCHAR(128) NOT NULL UNIQUE,
    contact_phone VARCHAR(64) NULL,
    app_description TEXT NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS service_api_authorizations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    service_id BIGINT NOT NULL,
    app_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    rate_limit_per_minute INT NOT NULL DEFAULT 0,
    daily_limit INT NOT NULL DEFAULT 0,
    ip_whitelist_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_service_api_auth_unique (service_id, app_id),
    KEY idx_service_api_auth_app (app_id),
    CONSTRAINT fk_service_api_auth_service FOREIGN KEY (service_id) REFERENCES service_apis(id) ON DELETE CASCADE,
    CONSTRAINT fk_service_api_auth_app FOREIGN KEY (app_id) REFERENCES service_apps(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS service_api_call_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    service_id BIGINT NOT NULL,
    app_id BIGINT NULL,
    service_code VARCHAR(64) NOT NULL,
    service_path VARCHAR(255) NOT NULL,
    request_method VARCHAR(16) NOT NULL,
    auth_type VARCHAR(32) NOT NULL,
    request_params_json JSON NULL,
    response_status VARCHAR(16) NOT NULL DEFAULT 'success',
    success TINYINT(1) NOT NULL DEFAULT 1,
    http_status INT NOT NULL DEFAULT 200,
    latency_ms INT NOT NULL DEFAULT 0,
    client_ip VARCHAR(128) NULL,
    error_message VARCHAR(512) NULL,
    called_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_service_api_log_service (service_id, called_at),
    KEY idx_service_api_log_app (app_id, called_at),
    KEY idx_service_api_log_success (success, called_at),
    CONSTRAINT fk_service_api_log_service FOREIGN KEY (service_id) REFERENCES service_apis(id) ON DELETE CASCADE,
    CONSTRAINT fk_service_api_log_app FOREIGN KEY (app_id) REFERENCES service_apps(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS service_ai_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    scene_name VARCHAR(128) NOT NULL,
    scene_code VARCHAR(64) NOT NULL UNIQUE,
    default_model_provider_id BIGINT NULL,
    default_model_name VARCHAR(128) NULL,
    default_model_version VARCHAR(128) NULL,
    temperature DECIMAL(4,2) NULL,
    max_tokens INT NULL,
    timeout_ms INT NULL,
    system_prompt TEXT NULL,
    description VARCHAR(512) NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ingestion_tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_name VARCHAR(128) NOT NULL,
    task_code VARCHAR(64) NOT NULL UNIQUE,
    source_id BIGINT NOT NULL,
    source_table VARCHAR(512) NULL,
    target_source_id BIGINT NULL,
    target_type VARCHAR(32) NOT NULL DEFAULT 'mysql',
    target_table VARCHAR(128) NULL,
    target_config JSON NULL,
    sync_mode VARCHAR(16) NOT NULL DEFAULT 'full',
    status VARCHAR(16) NOT NULL DEFAULT 'draft',
    description VARCHAR(512) NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    schedule_enabled TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ingestion_task_source FOREIGN KEY (source_id) REFERENCES data_sources(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ingestion_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL UNIQUE,
    field_mappings JSON NULL,
    transform_rules JSON NULL,
    incremental_config JSON NULL,
    source_config JSON NULL,
    parse_config JSON NULL,
    error_config JSON NULL,
    schedule_config JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ingestion_config_task FOREIGN KEY (task_id) REFERENCES ingestion_tasks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ingestion_job_runs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    run_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    start_time DATETIME NULL,
    end_time DATETIME NULL,
    records_count BIGINT NULL DEFAULT 0,
    error_message TEXT NULL,
    execution_info JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ingestion_job_runs_task_created_id (task_id, created_at, id),
    KEY idx_ingestion_job_runs_task_status_created (task_id, run_status, created_at, id),
    KEY idx_ingestion_job_runs_created_at (created_at),
    CONSTRAINT fk_ingestion_run_task FOREIGN KEY (task_id) REFERENCES ingestion_tasks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ingestion_kafka_offsets (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    topic_name VARCHAR(255) NOT NULL,
    partition_id INT NOT NULL,
    last_processed_offset BIGINT NULL,
    last_committed_offset BIGINT NULL,
    message_timestamp DATETIME NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ingestion_kafka_offsets_task_partition (task_id, topic_name, partition_id),
    KEY idx_ingestion_kafka_offsets_task (task_id),
    CONSTRAINT fk_ingestion_kafka_offset_task FOREIGN KEY (task_id) REFERENCES ingestion_tasks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ingestion_ftp_file_states (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    remote_path VARCHAR(1024) NOT NULL,
    file_size BIGINT NULL,
    modified_at DATETIME NULL,
    file_hash VARCHAR(128) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'discovered',
    last_run_id BIGINT NULL,
    processed_rows BIGINT NOT NULL DEFAULT 0,
    error_message TEXT NULL,
    processed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ingestion_ftp_file_states_task_path (task_id, remote_path(512)),
    KEY idx_ingestion_ftp_file_states_task_status (task_id, status, updated_at),
    CONSTRAINT fk_ingestion_ftp_file_state_task FOREIGN KEY (task_id) REFERENCES ingestion_tasks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ingestion_api_sync_states (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NULL,
    task_id BIGINT NOT NULL,
    state_key VARCHAR(128) NOT NULL DEFAULT 'default',
    last_cursor_value VARCHAR(512) NULL,
    last_success_time DATETIME NULL,
    last_page BIGINT NULL,
    last_offset BIGINT NULL,
    last_next_cursor VARCHAR(512) NULL,
    last_run_id BIGINT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'completed',
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ingestion_api_sync_states_task_key (task_id, state_key),
    KEY idx_ingestion_api_sync_states_project_task (project_id, task_id),
    CONSTRAINT fk_ingestion_api_sync_state_task FOREIGN KEY (task_id) REFERENCES ingestion_tasks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS file_import_tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_name VARCHAR(128) NOT NULL,
    task_code VARCHAR(64) NOT NULL UNIQUE,
    target_source_id BIGINT NOT NULL,
    target_table VARCHAR(128) NOT NULL,
    target_table_mode VARCHAR(16) NOT NULL DEFAULT 'create',
    write_mode VARCHAR(32) NOT NULL DEFAULT 'append',
    description VARCHAR(512) NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_file_import_target_source (target_source_id),
    KEY idx_file_import_status (status),
    CONSTRAINT fk_file_import_target_source FOREIGN KEY (target_source_id) REFERENCES data_sources(id)
  )`,
  `CREATE TABLE IF NOT EXISTS file_import_task_files (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    stored_file_name VARCHAR(255) NOT NULL,
    file_ext VARCHAR(32) NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    file_hash VARCHAR(64) NULL,
    file_order INT NOT NULL DEFAULT 0,
    sheet_name VARCHAR(255) NULL,
    settings_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_file_import_task_file_task (task_id),
    CONSTRAINT fk_file_import_task_file_task FOREIGN KEY (task_id) REFERENCES file_import_tasks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS file_import_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL UNIQUE,
    parse_options_json JSON NULL,
    field_mappings_json JSON NULL,
    preview_schema_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_file_import_config_task FOREIGN KEY (task_id) REFERENCES file_import_tasks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS file_import_runs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    run_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    start_time DATETIME NULL,
    end_time DATETIME NULL,
    total_rows BIGINT NOT NULL DEFAULT 0,
    success_rows BIGINT NOT NULL DEFAULT 0,
    skipped_rows BIGINT NOT NULL DEFAULT 0,
    error_rows BIGINT NOT NULL DEFAULT 0,
    error_message TEXT NULL,
    execution_info_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_file_import_run_task (task_id),
    KEY idx_file_import_run_status (run_status),
    CONSTRAINT fk_file_import_run_task FOREIGN KEY (task_id) REFERENCES file_import_tasks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS file_import_run_errors (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_id BIGINT NOT NULL,
    file_id BIGINT NULL,
    file_name VARCHAR(255) NULL,
    sheet_name VARCHAR(255) NULL,
    row_no INT NULL,
    column_name VARCHAR(255) NULL,
    error_type VARCHAR(64) NOT NULL DEFAULT 'parse',
    error_message VARCHAR(1024) NOT NULL,
    raw_data_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_file_import_run_error_run (run_id),
    CONSTRAINT fk_file_import_run_error_run FOREIGN KEY (run_id) REFERENCES file_import_runs(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS model_providers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    config_name VARCHAR(128) NOT NULL,
    config_code VARCHAR(64) NOT NULL UNIQUE,
    provider_type VARCHAR(32) NOT NULL,
    model_category VARCHAR(32) NOT NULL DEFAULT 'chat',
    model_name VARCHAR(128) NOT NULL,
    model_version VARCHAR(128) NULL,
    base_url VARCHAR(255) NULL,
    api_key VARCHAR(512) NOT NULL,
    organization_id VARCHAR(128) NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    description VARCHAR(512) NULL,
    extra_config JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS asset_search_ai_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    scene_name VARCHAR(128) NOT NULL,
    scene_code VARCHAR(64) NOT NULL UNIQUE,
    default_model_provider_id BIGINT NULL,
    default_model_name VARCHAR(128) NULL,
    default_model_version VARCHAR(128) NULL,
    temperature DECIMAL(4,2) NULL,
    max_tokens INT NULL,
    timeout_ms INT NULL,
    system_prompt TEXT NULL,
    description VARCHAR(512) NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_asset_search_ai_config_scene (scene_code),
    KEY idx_asset_search_ai_config_provider (default_model_provider_id),
    CONSTRAINT fk_asset_search_ai_config_provider FOREIGN KEY (default_model_provider_id) REFERENCES model_providers(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS asset_search_feedback (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    keyword VARCHAR(500) NULL,
    ai_enabled TINYINT(1) NOT NULL DEFAULT 0,
    mode VARCHAR(32) NULL,
    result_id VARCHAR(255) NOT NULL,
    feedback VARCHAR(32) NOT NULL,
    comment TEXT NULL,
    submitted_by VARCHAR(64) NOT NULL DEFAULT 'system',
    submitted_user_id BIGINT NULL,
    result_snapshot_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_asset_search_feedback_result (result_id),
    KEY idx_asset_search_feedback_created (created_at),
    KEY idx_asset_search_feedback_user (submitted_user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS asset_search_ai_runs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    keyword VARCHAR(500) NULL,
    mode VARCHAR(32) NOT NULL DEFAULT 'ai',
    status VARCHAR(32) NOT NULL DEFAULT 'success',
    fallback_reason VARCHAR(128) NULL,
    source_modules_json JSON NULL,
    scopes_json JSON NULL,
    expanded_keywords_json JSON NULL,
    configured_stages_json JSON NULL,
    used_stages_json JSON NULL,
    candidate_count INT NOT NULL DEFAULT 0,
    result_count INT NOT NULL DEFAULT 0,
    duration_ms BIGINT NOT NULL DEFAULT 0,
    error_message VARCHAR(512) NULL,
    submitted_by VARCHAR(64) NOT NULL DEFAULT 'system',
    submitted_user_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_asset_search_ai_run_created (created_at),
    KEY idx_asset_search_ai_run_status (status),
    KEY idx_asset_search_ai_run_user (submitted_user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS dm_ai_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    scene_name VARCHAR(128) NOT NULL,
    scene_code VARCHAR(64) NOT NULL UNIQUE,
    default_model_provider_id BIGINT NULL,
    default_model_name VARCHAR(128) NULL,
    default_model_version VARCHAR(128) NULL,
    temperature DECIMAL(4,2) NULL,
    max_tokens INT NULL,
    timeout_ms INT NULL,
    system_prompt TEXT NULL,
    user_prompt_template TEXT NULL,
    output_schema_json JSON NULL,
    description VARCHAR(512) NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'System Administrator',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dm_ai_config_scene (scene_code),
    KEY idx_dm_ai_config_provider (default_model_provider_id),
    CONSTRAINT fk_dm_ai_config_provider FOREIGN KEY (default_model_provider_id) REFERENCES model_providers(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ingestion_ai_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    scene_name VARCHAR(128) NOT NULL,
    scene_code VARCHAR(64) NOT NULL UNIQUE,
    default_model_provider_id BIGINT NULL,
    default_model_name VARCHAR(128) NULL,
    default_model_version VARCHAR(128) NULL,
    temperature DECIMAL(4,2) NULL,
    max_tokens INT NULL,
    timeout_ms INT NULL,
    system_prompt TEXT NULL,
    description VARCHAR(512) NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ingestion_ai_config_provider FOREIGN KEY (default_model_provider_id) REFERENCES model_providers(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS system_service_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    service_key VARCHAR(64) NOT NULL UNIQUE,
    service_name VARCHAR(128) NOT NULL,
    service_category VARCHAR(32) NOT NULL DEFAULT 'application',
    service_type VARCHAR(32) NOT NULL DEFAULT 'custom',
    manage_mode VARCHAR(32) NOT NULL DEFAULT 'command',
    host VARCHAR(128) NULL,
    port INT NULL,
    auto_start TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    is_core TINYINT(1) NOT NULL DEFAULT 0,
    notes VARCHAR(512) NULL,
    config_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS system_database_driver_packages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    database_type VARCHAR(32) NOT NULL,
    driver_name VARCHAR(128) NOT NULL,
    version VARCHAR(64) NOT NULL,
    driver_class VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    sha256 CHAR(64) NOT NULL,
    targets_json JSON NOT NULL,
    validation_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    validation_message TEXT NULL,
    java_version VARCHAR(64) NULL,
    uploaded_by BIGINT NULL,
    uploaded_by_name VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_system_driver_type_hash (database_type, sha256),
    KEY idx_system_driver_type_status (database_type, validation_status)
  )`,
  `CREATE TABLE IF NOT EXISTS system_database_driver_bindings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    database_type VARCHAR(32) NOT NULL,
    target VARCHAR(32) NOT NULL,
    package_id BIGINT NOT NULL,
    previous_package_id BIGINT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    activated_by BIGINT NULL,
    activated_by_name VARCHAR(64) NOT NULL DEFAULT 'system',
    activated_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_system_driver_binding (database_type, target),
    KEY idx_system_driver_binding_package (package_id),
    CONSTRAINT fk_system_driver_binding_package FOREIGN KEY (package_id) REFERENCES system_database_driver_packages(id) ON DELETE RESTRICT,
    CONSTRAINT fk_system_driver_binding_previous FOREIGN KEY (previous_package_id) REFERENCES system_database_driver_packages(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS system_database_driver_operation_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    package_id BIGINT NULL,
    database_type VARCHAR(32) NOT NULL,
    action VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    detail_json JSON NULL,
    operator_user_id BIGINT NULL,
    operator_name VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_system_driver_log_package_created (package_id, created_at),
    KEY idx_system_driver_log_type_created (database_type, created_at)
  )`,
  `CREATE TABLE IF NOT EXISTS dev_datasources (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(128) NOT NULL,
    type VARCHAR(32) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL,
    database_name VARCHAR(128) NULL,
    username VARCHAR(128) NULL,
    password_encrypted TEXT NULL,
    extra_config_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS dev_script_folders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(128) NOT NULL,
    parent_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_script_folder_parent FOREIGN KEY (parent_id) REFERENCES dev_script_folders(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dev_sql_scripts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(128) NOT NULL,
    folder_id BIGINT NULL,
    datasource_id BIGINT NOT NULL,
    default_database VARCHAR(128) NULL,
    description VARCHAR(512) NULL,
    tags_json JSON NULL,
    content LONGTEXT NOT NULL,
    current_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_script_folder FOREIGN KEY (folder_id) REFERENCES dev_script_folders(id) ON DELETE SET NULL,
    CONSTRAINT fk_dev_script_datasource FOREIGN KEY (datasource_id) REFERENCES dev_datasources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dev_script_versions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    script_id BIGINT NOT NULL,
    version_no INT NOT NULL,
    content LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_script_version_script FOREIGN KEY (script_id) REFERENCES dev_sql_scripts(id) ON DELETE CASCADE,
    CONSTRAINT uk_dev_script_version UNIQUE KEY (script_id, version_no)
  )`,
  `CREATE TABLE IF NOT EXISTS dev_query_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    datasource_id BIGINT NOT NULL,
    script_id BIGINT NULL,
    sql_text LONGTEXT NOT NULL,
    database_name VARCHAR(128) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'success',
    duration_ms BIGINT NOT NULL DEFAULT 0,
    error_message TEXT NULL,
    result_preview_json JSON NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_query_history_datasource FOREIGN KEY (datasource_id) REFERENCES dev_datasources(id) ON DELETE CASCADE,
    CONSTRAINT fk_dev_query_history_script FOREIGN KEY (script_id) REFERENCES dev_sql_scripts(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dev_sql_copilot_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    datasource_id BIGINT NOT NULL,
    database_name VARCHAR(128) NULL,
    session_title VARCHAR(255) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    last_message_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dev_sql_copilot_session_user (project_id, user_id, last_message_at),
    KEY idx_dev_sql_copilot_session_datasource (project_id, datasource_id),
    CONSTRAINT fk_dev_sql_copilot_session_project FOREIGN KEY (project_id) REFERENCES project_spaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_dev_sql_copilot_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_dev_sql_copilot_session_datasource FOREIGN KEY (datasource_id) REFERENCES dev_datasources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dev_sql_copilot_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id BIGINT NOT NULL,
    role VARCHAR(16) NOT NULL,
    task_type VARCHAR(32) NULL,
    message_text LONGTEXT NOT NULL,
    payload_json JSON NULL,
    context_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_dev_sql_copilot_message_session (session_id, id),
    CONSTRAINT fk_dev_sql_copilot_message_session FOREIGN KEY (session_id) REFERENCES dev_sql_copilot_sessions(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dev_ai_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    scene_name VARCHAR(128) NOT NULL,
    scene_code VARCHAR(64) NOT NULL UNIQUE,
    default_model_provider_id BIGINT NULL,
    default_model_name VARCHAR(128) NULL,
    default_model_version VARCHAR(128) NULL,
    temperature DECIMAL(4,2) NULL,
    max_tokens INT NULL,
    timeout_ms INT NULL,
    system_prompt TEXT NULL,
    description VARCHAR(512) NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_ai_config_provider FOREIGN KEY (default_model_provider_id) REFERENCES model_providers(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dev_workflows (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(128) NOT NULL,
    description VARCHAR(512) NULL,
    cron_expr VARCHAR(128) NULL,
    is_paused TINYINT(1) NOT NULL DEFAULT 1,
    retry_times INT NOT NULL DEFAULT 0,
    timeout_sec INT NOT NULL DEFAULT 300,
    published_version_no INT NULL,
    runtime_config_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS dev_workflow_nodes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    workflow_id BIGINT NOT NULL,
    node_type VARCHAR(32) NOT NULL DEFAULT 'script',
    script_id BIGINT NULL,
    processing_job_id BIGINT NULL,
    orchestration_task_id BIGINT NULL,
    node_key VARCHAR(64) NOT NULL,
    node_name VARCHAR(128) NOT NULL,
    position_x DECIMAL(12,2) NOT NULL DEFAULT 0,
    position_y DECIMAL(12,2) NOT NULL DEFAULT 0,
    width DECIMAL(12,2) NOT NULL DEFAULT 240,
    height DECIMAL(12,2) NOT NULL DEFAULT 88,
    retry_times INT NULL,
    retry_interval_sec INT NOT NULL DEFAULT 5,
    timeout_sec INT NULL,
    trigger_rule VARCHAR(32) NOT NULL DEFAULT 'all_success',
    is_archived TINYINT(1) NOT NULL DEFAULT 0,
    node_config_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_workflow_node_workflow FOREIGN KEY (workflow_id) REFERENCES dev_workflows(id) ON DELETE CASCADE,
    CONSTRAINT fk_dev_workflow_node_script FOREIGN KEY (script_id) REFERENCES dev_sql_scripts(id) ON DELETE CASCADE,
    CONSTRAINT uk_dev_workflow_node_key UNIQUE KEY (workflow_id, node_key)
  )`,
  `CREATE TABLE IF NOT EXISTS dev_workflow_edges (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    workflow_id BIGINT NOT NULL,
    source_node_key VARCHAR(64) NOT NULL,
    target_node_key VARCHAR(64) NOT NULL,
    edge_type VARCHAR(32) NOT NULL DEFAULT 'default',
    edge_label VARCHAR(32) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_workflow_edge_workflow FOREIGN KEY (workflow_id) REFERENCES dev_workflows(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dev_workflow_versions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    workflow_id BIGINT NOT NULL,
    version_no INT NOT NULL,
    graph_snapshot_json JSON NOT NULL,
    validation_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_workflow_version_workflow FOREIGN KEY (workflow_id) REFERENCES dev_workflows(id) ON DELETE CASCADE,
    CONSTRAINT uk_dev_workflow_version UNIQUE KEY (workflow_id, version_no)
  )`,
  `CREATE TABLE IF NOT EXISTS dev_workflow_runs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    workflow_id BIGINT NOT NULL,
    trigger_type VARCHAR(16) NOT NULL DEFAULT 'manual',
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    run_params_json JSON NULL,
    workflow_version_no INT NULL,
    graph_snapshot_json JSON NULL,
    workflow_retry_count INT NOT NULL DEFAULT 0,
    scheduled_at DATETIME NULL,
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    duration_ms BIGINT NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_workflow_run_workflow FOREIGN KEY (workflow_id) REFERENCES dev_workflows(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dev_job_instances (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    workflow_run_id BIGINT NOT NULL,
    workflow_id BIGINT NOT NULL,
    workflow_node_id BIGINT NOT NULL,
    node_type VARCHAR(32) NOT NULL DEFAULT 'script',
    script_id BIGINT NULL,
    processing_job_id BIGINT NULL,
    orchestration_task_id BIGINT NULL,
    trigger_type VARCHAR(16) NOT NULL DEFAULT 'manual',
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    duration_ms BIGINT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    run_attempt INT NOT NULL DEFAULT 1,
    error_message TEXT NULL,
    result_preview_json JSON NULL,
    branch_result_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_job_instance_run FOREIGN KEY (workflow_run_id) REFERENCES dev_workflow_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_dev_job_instance_workflow FOREIGN KEY (workflow_id) REFERENCES dev_workflows(id) ON DELETE CASCADE,
    CONSTRAINT fk_dev_job_instance_node FOREIGN KEY (workflow_node_id) REFERENCES dev_workflow_nodes(id) ON DELETE CASCADE,
    CONSTRAINT fk_dev_job_instance_script FOREIGN KEY (script_id) REFERENCES dev_sql_scripts(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dev_job_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    instance_id BIGINT NOT NULL,
    log_type VARCHAR(32) NOT NULL DEFAULT 'info',
    content LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_job_log_instance FOREIGN KEY (instance_id) REFERENCES dev_job_instances(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dev_orchestration_tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(128) NOT NULL,
    description VARCHAR(512) NULL,
    datasource_id BIGINT NULL,
    database_name VARCHAR(128) NULL,
    cron_expr VARCHAR(128) NULL,
    is_paused TINYINT(1) NOT NULL DEFAULT 1,
    retry_times INT NOT NULL DEFAULT 0,
    timeout_sec INT NOT NULL DEFAULT 300,
    runtime_config_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_orchestration_task_datasource FOREIGN KEY (datasource_id) REFERENCES dev_datasources(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dev_orchestration_nodes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    node_type VARCHAR(32) NOT NULL DEFAULT 'operator',
    operator_code VARCHAR(64) NOT NULL,
    node_key VARCHAR(64) NOT NULL,
    node_name VARCHAR(128) NOT NULL,
    position_x DECIMAL(12,2) NOT NULL DEFAULT 0,
    position_y DECIMAL(12,2) NOT NULL DEFAULT 0,
    width DECIMAL(12,2) NOT NULL DEFAULT 260,
    height DECIMAL(12,2) NOT NULL DEFAULT 108,
    node_config_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_orchestration_node_task FOREIGN KEY (task_id) REFERENCES dev_orchestration_tasks(id) ON DELETE CASCADE,
    CONSTRAINT uk_dev_orchestration_node_key UNIQUE KEY (task_id, node_key)
  )`,
  `CREATE TABLE IF NOT EXISTS dev_orchestration_edges (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    source_node_key VARCHAR(64) NOT NULL,
    source_port VARCHAR(64) NULL,
    target_node_key VARCHAR(64) NOT NULL,
    target_port VARCHAR(64) NULL,
    edge_type VARCHAR(32) NOT NULL DEFAULT 'default',
    edge_status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_orchestration_edge_task FOREIGN KEY (task_id) REFERENCES dev_orchestration_tasks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dev_processing_jobs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(128) NOT NULL,
    description VARCHAR(512) NULL,
    datasource_id BIGINT NOT NULL,
    database_name VARCHAR(128) NULL,
    table_name VARCHAR(255) NOT NULL,
    target_table_name VARCHAR(255) NULL,
    output_mode VARCHAR(24) NOT NULL DEFAULT 'new_table',
    status VARCHAR(16) NOT NULL DEFAULT 'draft',
    owner_name VARCHAR(64) NULL,
    tags_json JSON NULL,
    current_version_no INT NOT NULL DEFAULT 1,
    published_version_no INT NULL,
    last_run_status VARCHAR(16) NULL,
    last_run_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_processing_job_datasource FOREIGN KEY (datasource_id) REFERENCES dev_datasources(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dev_processing_job_versions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    job_id BIGINT NOT NULL,
    version_no INT NOT NULL,
    version_status VARCHAR(16) NOT NULL DEFAULT 'draft',
    pipeline_json JSON NOT NULL,
    compiled_sql LONGTEXT NULL,
    summary_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_processing_version_job FOREIGN KEY (job_id) REFERENCES dev_processing_jobs(id) ON DELETE CASCADE,
    CONSTRAINT uk_dev_processing_version UNIQUE KEY (job_id, version_no)
  )`,
  `CREATE TABLE IF NOT EXISTS dev_processing_runs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    job_id BIGINT NOT NULL,
    version_no INT NOT NULL,
    run_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    trigger_type VARCHAR(16) NOT NULL DEFAULT 'manual',
    preview_mode TINYINT(1) NOT NULL DEFAULT 0,
    source_row_count BIGINT NULL,
    output_row_count BIGINT NULL,
    affected_rows BIGINT NULL,
    target_table_name VARCHAR(255) NULL,
    duration_ms BIGINT NULL,
    error_message TEXT NULL,
    result_preview_json JSON NULL,
    executed_sql LONGTEXT NULL,
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_processing_run_job FOREIGN KEY (job_id) REFERENCES dev_processing_jobs(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dev_processing_run_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_id BIGINT NOT NULL,
    log_type VARCHAR(32) NOT NULL DEFAULT 'info',
    content LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_processing_run_log FOREIGN KEY (run_id) REFERENCES dev_processing_runs(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS project_asset_backups (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_project_id BIGINT NOT NULL,
    package_version VARCHAR(32) NOT NULL,
    package_sha256 CHAR(64) NULL,
    package_json LONGTEXT NOT NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_project_asset_backup_project_created (source_project_id, created_at, id)
  )`
];

const columnMigrations = [
  {
    tableName: "quality_ai_configs",
    columnName: "thinking_enabled",
    definition: "ALTER TABLE quality_ai_configs ADD COLUMN thinking_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER timeout_ms"
  },
  {
    tableName: "quality_ai_configs",
    columnName: "reasoning_effort",
    definition: "ALTER TABLE quality_ai_configs ADD COLUMN reasoning_effort VARCHAR(16) NULL AFTER thinking_enabled"
  },
  {
    tableName: "quality_ai_configs",
    columnName: "thinking_budget",
    definition: "ALTER TABLE quality_ai_configs ADD COLUMN thinking_budget INT NULL AFTER reasoning_effort"
  },
  {
    tableName: "quality_ai_config_versions",
    columnName: "thinking_enabled",
    definition: "ALTER TABLE quality_ai_config_versions ADD COLUMN thinking_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER timeout_ms"
  },
  {
    tableName: "quality_ai_config_versions",
    columnName: "reasoning_effort",
    definition: "ALTER TABLE quality_ai_config_versions ADD COLUMN reasoning_effort VARCHAR(16) NULL AFTER thinking_enabled"
  },
  {
    tableName: "quality_ai_config_versions",
    columnName: "thinking_budget",
    definition: "ALTER TABLE quality_ai_config_versions ADD COLUMN thinking_budget INT NULL AFTER reasoning_effort"
  },
  {
    tableName: "qc_report",
    columnName: "report_code",
    definition: "ALTER TABLE qc_report ADD COLUMN report_code VARCHAR(64) NULL AFTER project_id"
  },
  {
    tableName: "qc_report",
    columnName: "analysis_mode",
    definition: "ALTER TABLE qc_report ADD COLUMN analysis_mode VARCHAR(16) NOT NULL DEFAULT 'snapshot' AFTER report_scope"
  },
  {
    tableName: "qc_report",
    columnName: "comparison_type",
    definition: "ALTER TABLE qc_report ADD COLUMN comparison_type VARCHAR(32) NULL AFTER analysis_mode"
  },
  {
    tableName: "qc_report",
    columnName: "object_type",
    definition: "ALTER TABLE qc_report ADD COLUMN object_type VARCHAR(16) NULL AFTER comparison_type"
  },
  {
    tableName: "qc_report",
    columnName: "object_ref_id",
    definition: "ALTER TABLE qc_report ADD COLUMN object_ref_id BIGINT NULL AFTER object_type"
  },
  {
    tableName: "qc_report",
    columnName: "baseline_report_id",
    definition: "ALTER TABLE qc_report ADD COLUMN baseline_report_id BIGINT NULL AFTER batch_ids_json"
  },
  {
    tableName: "qc_report",
    columnName: "current_report_id",
    definition: "ALTER TABLE qc_report ADD COLUMN current_report_id BIGINT NULL AFTER baseline_report_id"
  },
  {
    tableName: "qc_report",
    columnName: "baseline_batch_id",
    definition: "ALTER TABLE qc_report ADD COLUMN baseline_batch_id BIGINT NULL AFTER current_report_id"
  },
  {
    tableName: "qc_report",
    columnName: "current_batch_id",
    definition: "ALTER TABLE qc_report ADD COLUMN current_batch_id BIGINT NULL AFTER baseline_batch_id"
  },
  {
    tableName: "qc_report",
    columnName: "snapshot_at",
    definition: "ALTER TABLE qc_report ADD COLUMN snapshot_at DATETIME NULL AFTER current_batch_id"
  },
  {
    tableName: "qc_report",
    columnName: "governance_snapshot_at",
    definition: "ALTER TABLE qc_report ADD COLUMN governance_snapshot_at DATETIME NULL AFTER snapshot_at"
  },
  {
    tableName: "qc_report",
    columnName: "summary_schema_version",
    definition: "ALTER TABLE qc_report ADD COLUMN summary_schema_version VARCHAR(32) NOT NULL DEFAULT 'legacy-v1' AFTER governance_snapshot_at"
  },
  {
    tableName: "qc_report",
    columnName: "comparison_meta_json",
    definition: "ALTER TABLE qc_report ADD COLUMN comparison_meta_json JSON NULL AFTER deterministic_summary_json"
  },
  {
    tableName: "qc_report",
    columnName: "template_version",
    definition: "ALTER TABLE qc_report ADD COLUMN template_version VARCHAR(32) NOT NULL DEFAULT 'formal-v2' AFTER ai_config_version_id"
  },
  {
    tableName: "qc_report",
    columnName: "dimension_summary_json",
    definition: "ALTER TABLE qc_report ADD COLUMN dimension_summary_json JSON NULL AFTER template_version"
  },
  {
    tableName: "qc_report",
    columnName: "chart_snapshot_json",
    definition: "ALTER TABLE qc_report ADD COLUMN chart_snapshot_json JSON NULL AFTER dimension_summary_json"
  },
  {
    tableName: "qc_report",
    columnName: "report_markdown",
    definition: "ALTER TABLE qc_report ADD COLUMN report_markdown LONGTEXT NULL AFTER report_html"
  },
  {
    tableName: "qc_report",
    columnName: "word_generated_at",
    definition: "ALTER TABLE qc_report ADD COLUMN word_generated_at DATETIME NULL AFTER report_markdown"
  },
  {
    tableName: "qc_report",
    columnName: "updated_at",
    definition: "ALTER TABLE qc_report ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at"
  },
  {
    tableName: "qc_monitor_table",
    columnName: "business_system_id",
    definition: "ALTER TABLE qc_monitor_table ADD COLUMN business_system_id BIGINT NULL AFTER table_comment"
  },
  {
    tableName: "qc_monitor_table",
    columnName: "system_mapping_source",
    definition: "ALTER TABLE qc_monitor_table ADD COLUMN system_mapping_source VARCHAR(32) NULL AFTER business_system_id"
  },
  {
    tableName: "qc_monitor_table",
    columnName: "system_mapping_confirmed_by",
    definition: "ALTER TABLE qc_monitor_table ADD COLUMN system_mapping_confirmed_by VARCHAR(64) NULL AFTER system_mapping_source"
  },
  {
    tableName: "qc_monitor_table",
    columnName: "system_mapping_confirmed_at",
    definition: "ALTER TABLE qc_monitor_table ADD COLUMN system_mapping_confirmed_at DATETIME NULL AFTER system_mapping_confirmed_by"
  },
  {
    tableName: "qc_monitor_table",
    columnName: "responsible_department_id",
    definition: "ALTER TABLE qc_monitor_table ADD COLUMN responsible_department_id BIGINT NULL AFTER system_mapping_confirmed_at"
  },
  {
    tableName: "qc_monitor_table",
    columnName: "data_owner_user_id",
    definition: "ALTER TABLE qc_monitor_table ADD COLUMN data_owner_user_id BIGINT NULL AFTER responsible_department_id"
  },
  {
    tableName: "qc_monitor_table",
    columnName: "quality_owner_user_id",
    definition: "ALTER TABLE qc_monitor_table ADD COLUMN quality_owner_user_id BIGINT NULL AFTER data_owner_user_id"
  },
  {
    tableName: "qc_monitor_table",
    columnName: "importance_level",
    definition: "ALTER TABLE qc_monitor_table ADD COLUMN importance_level VARCHAR(16) NOT NULL DEFAULT 'normal' AFTER quality_owner_user_id"
  },
  {
    tableName: "qc_task_run",
    columnName: "project_id",
    definition: "ALTER TABLE qc_task_run ADD COLUMN project_id BIGINT NULL AFTER id"
  },
  {
    tableName: "ingestion_tasks",
    columnName: "source_table",
    operation: "always",
    definition: "ALTER TABLE ingestion_tasks MODIFY COLUMN source_table VARCHAR(512) NULL"
  },
  {
    tableName: "dm_catalogs",
    columnName: "business_system_id",
    operation: "always",
    definition: "ALTER TABLE dm_catalogs MODIFY COLUMN business_system_id BIGINT NULL"
  },
  {
    tableName: "dm_resources",
    columnName: "resource_code",
    operation: "always",
    definition: "ALTER TABLE dm_resources MODIFY COLUMN resource_code VARCHAR(255) NOT NULL"
  },
  {
    tableName: "dm_resource_field_profiles",
    columnName: "feature_tags_json",
    definition: "ALTER TABLE dm_resource_field_profiles ADD COLUMN feature_tags_json JSON NULL AFTER semantic_tags_json"
  },
  {
    tableName: "report_dashboards",
    columnName: "theme_template_id",
    definition: "ALTER TABLE report_dashboards ADD COLUMN theme_template_id BIGINT NULL AFTER layout_mode"
  },
  {
    tableName: "report_dashboards",
    columnName: "theme_settings_json",
    definition: "ALTER TABLE report_dashboards ADD COLUMN theme_settings_json JSON NULL AFTER theme_template_id"
  },
  {
    tableName: "qc_strategy_version",
    columnName: "advanced_rule_json",
    definition: "ALTER TABLE qc_strategy_version ADD COLUMN advanced_rule_json JSON NULL AFTER field_strategy_json"
  },
  {
    tableName: "qc_standard_dictionary",
    columnName: "registration_mode",
    definition: "ALTER TABLE qc_standard_dictionary ADD COLUMN registration_mode VARCHAR(24) NOT NULL DEFAULT 'manual' AFTER dict_desc"
  },
  {
    tableName: "qc_standard_dictionary",
    columnName: "source_system_id",
    definition: "ALTER TABLE qc_standard_dictionary ADD COLUMN source_system_id BIGINT NULL AFTER registration_mode"
  },
  {
    tableName: "qc_standard_dictionary",
    columnName: "source_system_code",
    definition: "ALTER TABLE qc_standard_dictionary ADD COLUMN source_system_code VARCHAR(64) NULL AFTER source_system_id"
  },
  {
    tableName: "qc_standard_dictionary",
    columnName: "source_system_name",
    definition: "ALTER TABLE qc_standard_dictionary ADD COLUMN source_system_name VARCHAR(128) NULL AFTER source_system_code"
  },
  {
    tableName: "qc_standard_dictionary",
    columnName: "source_id",
    definition: "ALTER TABLE qc_standard_dictionary ADD COLUMN source_id BIGINT NULL AFTER source_system_name"
  },
  {
    tableName: "qc_standard_dictionary",
    columnName: "source_code",
    definition: "ALTER TABLE qc_standard_dictionary ADD COLUMN source_code VARCHAR(64) NULL AFTER source_id"
  },
  {
    tableName: "qc_standard_dictionary",
    columnName: "source_name",
    definition: "ALTER TABLE qc_standard_dictionary ADD COLUMN source_name VARCHAR(128) NULL AFTER source_code"
  },
  {
    tableName: "qc_standard_dictionary",
    columnName: "source_table",
    definition: "ALTER TABLE qc_standard_dictionary ADD COLUMN source_table VARCHAR(255) NULL AFTER source_name"
  },
  {
    tableName: "qc_standard_dictionary",
    columnName: "code_field",
    definition: "ALTER TABLE qc_standard_dictionary ADD COLUMN code_field VARCHAR(128) NULL AFTER source_table"
  },
  {
    tableName: "qc_standard_dictionary",
    columnName: "value_field",
    definition: "ALTER TABLE qc_standard_dictionary ADD COLUMN value_field VARCHAR(128) NULL AFTER code_field"
  },
  {
    tableName: "qc_standard_dictionary",
    columnName: "label_field",
    definition: "ALTER TABLE qc_standard_dictionary ADD COLUMN label_field VARCHAR(128) NULL AFTER value_field"
  },
  {
    tableName: "qc_standard_dictionary",
    columnName: "filter_config_json",
    definition: "ALTER TABLE qc_standard_dictionary ADD COLUMN filter_config_json JSON NULL AFTER label_field"
  },
  {
    tableName: "qc_standard_dictionary",
    columnName: "last_registered_at",
    definition: "ALTER TABLE qc_standard_dictionary ADD COLUMN last_registered_at DATETIME NULL AFTER filter_config_json"
  },
  {
    tableName: "dev_orchestration_edges",
    columnName: "edge_status",
    definition: "ALTER TABLE dev_orchestration_edges ADD COLUMN edge_status VARCHAR(16) NOT NULL DEFAULT 'active' AFTER edge_type"
  },
  {
    tableName: "users",
    columnName: "role_id",
    definition: "ALTER TABLE users ADD COLUMN role_id BIGINT NULL AFTER display_name"
  },
  {
    tableName: "users",
    columnName: "role_code",
    definition: "ALTER TABLE users ADD COLUMN role_code VARCHAR(32) NOT NULL DEFAULT 'admin'"
  },
  {
    tableName: "users",
    columnName: "status",
    definition: "ALTER TABLE users ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active'"
  },
  {
    tableName: "users",
    columnName: "default_project_id",
    definition: "ALTER TABLE users ADD COLUMN default_project_id BIGINT NULL AFTER role_code"
  },
  {
    tableName: "users",
    columnName: "updated_at",
    definition: "ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
  },
  {
    tableName: "data_sources",
    columnName: "source_domain",
    definition: "ALTER TABLE data_sources ADD COLUMN source_domain VARCHAR(32) NOT NULL DEFAULT 'integration' AFTER source_code"
  },
  {
    tableName: "data_sources",
    columnName: "owner_name",
    definition: "ALTER TABLE data_sources ADD COLUMN owner_name VARCHAR(64) NOT NULL DEFAULT 'system'"
  },
  {
    tableName: "data_sources",
    columnName: "updated_at",
    definition: "ALTER TABLE data_sources ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
  },
  {
    tableName: "ingestion_jobs",
    columnName: "updated_at",
    definition: "ALTER TABLE ingestion_jobs ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
  },
  {
    tableName: "processing_jobs",
    columnName: "updated_at",
    definition: "ALTER TABLE processing_jobs ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
  },
  {
    tableName: "service_apis",
    columnName: "updated_at",
    definition: "ALTER TABLE service_apis ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
  },
  {
    tableName: "service_apis",
    columnName: "source_id",
    definition: "ALTER TABLE service_apis ADD COLUMN source_id BIGINT NULL AFTER data_domain"
  },
  {
    tableName: "service_apis",
    columnName: "source_table",
    definition: "ALTER TABLE service_apis ADD COLUMN source_table VARCHAR(255) NULL AFTER source_id"
  },
  {
    tableName: "service_apis",
    columnName: "service_mode",
    definition: "ALTER TABLE service_apis ADD COLUMN service_mode VARCHAR(16) NOT NULL DEFAULT 'table' AFTER data_domain"
  },
  {
    tableName: "service_apis",
    columnName: "source_sql",
    definition: "ALTER TABLE service_apis ADD COLUMN source_sql LONGTEXT NULL AFTER source_table"
  },
  {
    tableName: "service_apis",
    columnName: "service_type",
    definition: "ALTER TABLE service_apis ADD COLUMN service_type VARCHAR(32) NOT NULL DEFAULT 'list' AFTER source_sql"
  },
  {
    tableName: "service_apis",
    columnName: "query_config_json",
    definition: "ALTER TABLE service_apis ADD COLUMN query_config_json JSON NULL AFTER description"
  },
  {
    tableName: "service_apis",
    columnName: "response_config_json",
    definition: "ALTER TABLE service_apis ADD COLUMN response_config_json JSON NULL AFTER query_config_json"
  },
  {
    tableName: "service_apis",
    columnName: "owner_name",
    definition: "ALTER TABLE service_apis ADD COLUMN owner_name VARCHAR(64) NOT NULL DEFAULT 'system' AFTER response_config_json"
  },
  {
    tableName: "service_apis",
    columnName: "published_at",
    definition: "ALTER TABLE service_apis ADD COLUMN published_at DATETIME NULL AFTER owner_name"
  },
  {
    tableName: "service_apis",
    columnName: "last_called_at",
    definition: "ALTER TABLE service_apis ADD COLUMN last_called_at DATETIME NULL AFTER published_at"
  },
  {
    tableName: "service_apis",
    columnName: "total_calls",
    definition: "ALTER TABLE service_apis ADD COLUMN total_calls BIGINT NOT NULL DEFAULT 0 AFTER last_called_at"
  },
  {
    tableName: "service_apis",
    columnName: "success_calls",
    definition: "ALTER TABLE service_apis ADD COLUMN success_calls BIGINT NOT NULL DEFAULT 0 AFTER total_calls"
  },
  {
    tableName: "service_apis",
    columnName: "failed_calls",
    definition: "ALTER TABLE service_apis ADD COLUMN failed_calls BIGINT NOT NULL DEFAULT 0 AFTER success_calls"
  },
  {
    tableName: "service_apis",
    columnName: "avg_latency_ms",
    definition: "ALTER TABLE service_apis ADD COLUMN avg_latency_ms DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER failed_calls"
  },
  {
    tableName: "service_apps",
    columnName: "department_name",
    definition: "ALTER TABLE service_apps ADD COLUMN department_name VARCHAR(128) NULL AFTER id"
  },
  {
    tableName: "service_apps",
    columnName: "contact_phone",
    definition: "ALTER TABLE service_apps ADD COLUMN contact_phone VARCHAR(64) NULL AFTER app_token"
  },
  {
    tableName: "service_apps",
    columnName: "app_description",
    definition: "ALTER TABLE service_apps ADD COLUMN app_description TEXT NULL AFTER contact_phone"
  },
  {
    tableName: "ingestion_tasks",
    columnName: "source_table",
    definition: "ALTER TABLE ingestion_tasks ADD COLUMN source_table VARCHAR(128) NULL AFTER source_id"
  },
  {
    tableName: "ingestion_tasks",
    columnName: "target_source_id",
    definition: "ALTER TABLE ingestion_tasks ADD COLUMN target_source_id BIGINT NULL AFTER source_table"
  },
  {
    tableName: "ingestion_tasks",
    columnName: "target_table",
    definition: "ALTER TABLE ingestion_tasks ADD COLUMN target_table VARCHAR(128) NULL AFTER target_type"
  },
  {
    tableName: "ingestion_tasks",
    columnName: "description",
    definition: "ALTER TABLE ingestion_tasks ADD COLUMN description VARCHAR(512) NULL AFTER status"
  },
  {
    tableName: "ingestion_tasks",
    columnName: "owner_name",
    definition: "ALTER TABLE ingestion_tasks ADD COLUMN owner_name VARCHAR(64) NOT NULL DEFAULT 'system' AFTER description"
  },
  {
    tableName: "ingestion_tasks",
    columnName: "schedule_enabled",
    definition: "ALTER TABLE ingestion_tasks ADD COLUMN schedule_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER owner_name"
  },
  {
    tableName: "ingestion_tasks",
    columnName: "updated_at",
    definition: "ALTER TABLE ingestion_tasks ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
  },
  {
    tableName: "ingestion_configs",
    columnName: "source_config",
    definition: "ALTER TABLE ingestion_configs ADD COLUMN source_config JSON NULL AFTER incremental_config"
  },
  {
    tableName: "ingestion_configs",
    columnName: "parse_config",
    definition: "ALTER TABLE ingestion_configs ADD COLUMN parse_config JSON NULL AFTER source_config"
  },
  {
    tableName: "ingestion_configs",
    columnName: "error_config",
    definition: "ALTER TABLE ingestion_configs ADD COLUMN error_config JSON NULL AFTER parse_config"
  },
  {
    tableName: "model_providers",
    columnName: "model_version",
    definition: "ALTER TABLE model_providers ADD COLUMN model_version VARCHAR(128) NULL AFTER model_name"
  },
  {
    tableName: "model_providers",
    columnName: "updated_at",
    definition: "ALTER TABLE model_providers ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
  },
  {
    tableName: "ingestion_ai_configs",
    columnName: "default_model_name",
    definition: "ALTER TABLE ingestion_ai_configs ADD COLUMN default_model_name VARCHAR(128) NULL AFTER default_model_provider_id"
  },
  {
    tableName: "ingestion_ai_configs",
    columnName: "default_model_version",
    definition: "ALTER TABLE ingestion_ai_configs ADD COLUMN default_model_version VARCHAR(128) NULL AFTER default_model_name"
  },
  {
    tableName: "ingestion_ai_configs",
    columnName: "temperature",
    definition: "ALTER TABLE ingestion_ai_configs ADD COLUMN temperature DECIMAL(4,2) NULL AFTER default_model_version"
  },
  {
    tableName: "ingestion_ai_configs",
    columnName: "max_tokens",
    definition: "ALTER TABLE ingestion_ai_configs ADD COLUMN max_tokens INT NULL AFTER temperature"
  },
  {
    tableName: "ingestion_ai_configs",
    columnName: "timeout_ms",
    definition: "ALTER TABLE ingestion_ai_configs ADD COLUMN timeout_ms INT NULL AFTER max_tokens"
  },
  {
    tableName: "ingestion_ai_configs",
    columnName: "updated_at",
    definition: "ALTER TABLE ingestion_ai_configs ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
  },
  {
    tableName: "dev_ai_configs",
    columnName: "default_model_name",
    definition: "ALTER TABLE dev_ai_configs ADD COLUMN default_model_name VARCHAR(128) NULL AFTER default_model_provider_id"
  },
  {
    tableName: "dev_ai_configs",
    columnName: "default_model_version",
    definition: "ALTER TABLE dev_ai_configs ADD COLUMN default_model_version VARCHAR(128) NULL AFTER default_model_name"
  },
  {
    tableName: "dev_ai_configs",
    columnName: "temperature",
    definition: "ALTER TABLE dev_ai_configs ADD COLUMN temperature DECIMAL(4,2) NULL AFTER default_model_version"
  },
  {
    tableName: "dev_ai_configs",
    columnName: "max_tokens",
    definition: "ALTER TABLE dev_ai_configs ADD COLUMN max_tokens INT NULL AFTER temperature"
  },
  {
    tableName: "dev_ai_configs",
    columnName: "timeout_ms",
    definition: "ALTER TABLE dev_ai_configs ADD COLUMN timeout_ms INT NULL AFTER max_tokens"
  },
  {
    tableName: "dev_ai_configs",
    columnName: "updated_at",
    definition: "ALTER TABLE dev_ai_configs ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
  },
  {
    tableName: "data_source_research_runs",
    columnName: "task_id",
    definition: "ALTER TABLE data_source_research_runs ADD COLUMN task_id BIGINT NULL AFTER id"
  },
  {
    tableName: "data_source_research_runs",
    columnName: "run_no",
    definition: "ALTER TABLE data_source_research_runs ADD COLUMN run_no INT NULL AFTER task_id"
  },
  {
    tableName: "data_source_research_runs",
    columnName: "summary_text",
    operation: "always",
    definition: "ALTER TABLE data_source_research_runs MODIFY COLUMN summary_text TEXT NULL"
  },
  {
    tableName: "lab_scene",
    columnName: "industry_kb_id",
    definition: "ALTER TABLE lab_scene ADD COLUMN industry_kb_id BIGINT NULL AFTER kb_id"
  },
  {
    tableName: "lab_scene",
    columnName: "industry_kb_ids_json",
    definition: "ALTER TABLE lab_scene ADD COLUMN industry_kb_ids_json JSON NULL AFTER industry_kb_id"
  },
  {
    tableName: "lab_scene",
    columnName: "enhancement_profile_id",
    definition: "ALTER TABLE lab_scene ADD COLUMN enhancement_profile_id BIGINT NULL AFTER industry_kb_ids_json"
  },
  {
    tableName: "lab_scene",
    columnName: "offline_data_source_id",
    definition: "ALTER TABLE lab_scene ADD COLUMN offline_data_source_id BIGINT NULL AFTER enhancement_profile_id"
  },
  {
    tableName: "lab_scene",
    columnName: "realtime_data_source_id",
    definition: "ALTER TABLE lab_scene ADD COLUMN realtime_data_source_id BIGINT NULL AFTER offline_data_source_id"
  },
  {
    tableName: "lab_scene",
    columnName: "last_deployed_at",
    definition: "ALTER TABLE lab_scene ADD COLUMN last_deployed_at DATETIME NULL AFTER last_run_time"
  },
  {
    tableName: "lab_kb",
    columnName: "planning_summary_json",
    definition: "ALTER TABLE lab_kb ADD COLUMN planning_summary_json JSON NULL AFTER tags_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "recognition_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN recognition_json JSON NULL AFTER status"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "research_catalog_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN research_catalog_json JSON NULL AFTER recognition_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "module_planner_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN module_planner_json JSON NULL AFTER research_catalog_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "schema_guides_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN schema_guides_json JSON NULL AFTER module_planner_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "relation_patterns_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN relation_patterns_json JSON NULL AFTER schema_guides_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "state_machines_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN state_machines_json JSON NULL AFTER relation_patterns_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "code_rules_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN code_rules_json JSON NULL AFTER state_machines_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "field_semantics_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN field_semantics_json JSON NULL AFTER code_rules_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "value_corpora_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN value_corpora_json JSON NULL AFTER field_semantics_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "distribution_profiles_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN distribution_profiles_json JSON NULL AFTER value_corpora_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "quality_gates_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN quality_gates_json JSON NULL AFTER distribution_profiles_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "realism_rules_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN realism_rules_json JSON NULL AFTER quality_gates_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "dirty_data_profiles_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN dirty_data_profiles_json JSON NULL AFTER realism_rules_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "training_assets_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN training_assets_json JSON NULL AFTER dirty_data_profiles_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "evaluation_rubric_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN evaluation_rubric_json JSON NULL AFTER training_assets_json"
  },
  {
    tableName: "lab_scenario_profile",
    columnName: "override_policies_json",
    definition: "ALTER TABLE lab_scenario_profile ADD COLUMN override_policies_json JSON NULL AFTER evaluation_rubric_json"
  },
  {
    tableName: "lab_prompt_template",
    columnName: "default_model_provider_id",
    definition: "ALTER TABLE lab_prompt_template ADD COLUMN default_model_provider_id BIGINT NULL AFTER content"
  },
  {
    tableName: "lab_prompt_template",
    columnName: "default_model_name",
    definition: "ALTER TABLE lab_prompt_template ADD COLUMN default_model_name VARCHAR(128) NULL AFTER default_model_provider_id"
  },
  {
    tableName: "lab_prompt_template",
    columnName: "default_model_version",
    definition: "ALTER TABLE lab_prompt_template ADD COLUMN default_model_version VARCHAR(128) NULL AFTER default_model_name"
  },
  {
    tableName: "lab_model_profile",
    columnName: "model_version",
    definition: "ALTER TABLE lab_model_profile ADD COLUMN model_version VARCHAR(128) NULL AFTER model_name"
  },
  {
    tableName: "lab_prompt_template",
    columnName: "user_content",
    definition: "ALTER TABLE lab_prompt_template ADD COLUMN user_content LONGTEXT NULL AFTER content"
  },
  {
    tableName: "lab_prompt_template",
    columnName: "temperature",
    definition: "ALTER TABLE lab_prompt_template ADD COLUMN temperature DECIMAL(4,2) NULL AFTER user_content"
  },
  {
    tableName: "lab_prompt_template",
    columnName: "max_tokens",
    definition: "ALTER TABLE lab_prompt_template ADD COLUMN max_tokens INT NULL AFTER temperature"
  },
  {
    tableName: "lab_prompt_template_version",
    columnName: "user_content",
    definition: "ALTER TABLE lab_prompt_template_version ADD COLUMN user_content LONGTEXT NULL AFTER content"
  },
  {
    tableName: "lab_prompt_template_version",
    columnName: "temperature",
    definition: "ALTER TABLE lab_prompt_template_version ADD COLUMN temperature DECIMAL(4,2) NULL AFTER user_content"
  },
  {
    tableName: "lab_prompt_template_version",
    columnName: "max_tokens",
    definition: "ALTER TABLE lab_prompt_template_version ADD COLUMN max_tokens INT NULL AFTER temperature"
  },
  {
    tableName: "lab_prompt_template_version",
    columnName: "default_model_name",
    definition: "ALTER TABLE lab_prompt_template_version ADD COLUMN default_model_name VARCHAR(128) NULL AFTER default_model_provider_id"
  },
  {
    tableName: "lab_prompt_template_version",
    columnName: "default_model_version",
    definition: "ALTER TABLE lab_prompt_template_version ADD COLUMN default_model_version VARCHAR(128) NULL AFTER default_model_name"
  },
  {
    tableName: "dev_workflow_nodes",
    columnName: "node_type",
    definition: "ALTER TABLE dev_workflow_nodes ADD COLUMN node_type VARCHAR(32) NOT NULL DEFAULT 'script' AFTER workflow_id"
  },
  {
    tableName: "dev_workflows",
    columnName: "published_version_no",
    definition: "ALTER TABLE dev_workflows ADD COLUMN published_version_no INT NULL AFTER timeout_sec"
  },
  {
    tableName: "dev_workflow_nodes",
    columnName: "processing_job_id",
    definition: "ALTER TABLE dev_workflow_nodes ADD COLUMN processing_job_id BIGINT NULL AFTER script_id"
  },
  {
    tableName: "dev_workflow_nodes",
    columnName: "orchestration_task_id",
    definition: "ALTER TABLE dev_workflow_nodes ADD COLUMN orchestration_task_id BIGINT NULL AFTER processing_job_id"
  },
  {
    tableName: "dev_workflow_nodes",
    columnName: "retry_times",
    definition: "ALTER TABLE dev_workflow_nodes ADD COLUMN retry_times INT NULL AFTER height"
  },
  {
    tableName: "dev_workflow_nodes",
    columnName: "retry_interval_sec",
    definition: "ALTER TABLE dev_workflow_nodes ADD COLUMN retry_interval_sec INT NOT NULL DEFAULT 5 AFTER retry_times"
  },
  {
    tableName: "dev_workflow_nodes",
    columnName: "timeout_sec",
    definition: "ALTER TABLE dev_workflow_nodes ADD COLUMN timeout_sec INT NULL AFTER retry_interval_sec"
  },
  {
    tableName: "dev_workflow_nodes",
    columnName: "trigger_rule",
    definition: "ALTER TABLE dev_workflow_nodes ADD COLUMN trigger_rule VARCHAR(32) NOT NULL DEFAULT 'all_success' AFTER timeout_sec"
  },
  {
    tableName: "dev_workflow_nodes",
    columnName: "is_archived",
    definition: "ALTER TABLE dev_workflow_nodes ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER trigger_rule"
  },
  {
    tableName: "dev_workflow_edges",
    columnName: "edge_label",
    definition: "ALTER TABLE dev_workflow_edges ADD COLUMN edge_label VARCHAR(32) NULL AFTER edge_type"
  },
  {
    tableName: "dev_workflow_runs",
    columnName: "run_params_json",
    definition: "ALTER TABLE dev_workflow_runs ADD COLUMN run_params_json JSON NULL AFTER status"
  },
  {
    tableName: "dev_workflow_runs",
    columnName: "workflow_version_no",
    definition: "ALTER TABLE dev_workflow_runs ADD COLUMN workflow_version_no INT NULL AFTER run_params_json"
  },
  {
    tableName: "dev_workflow_runs",
    columnName: "graph_snapshot_json",
    definition: "ALTER TABLE dev_workflow_runs ADD COLUMN graph_snapshot_json JSON NULL AFTER workflow_version_no"
  },
  {
    tableName: "dev_workflow_runs",
    columnName: "workflow_retry_count",
    definition: "ALTER TABLE dev_workflow_runs ADD COLUMN workflow_retry_count INT NOT NULL DEFAULT 0 AFTER graph_snapshot_json"
  },
  {
    tableName: "dev_workflow_runs",
    columnName: "scheduled_at",
    definition: "ALTER TABLE dev_workflow_runs ADD COLUMN scheduled_at DATETIME NULL AFTER workflow_retry_count"
  },
  {
    tableName: "dev_job_instances",
    columnName: "node_type",
    definition: "ALTER TABLE dev_job_instances ADD COLUMN node_type VARCHAR(32) NOT NULL DEFAULT 'script' AFTER workflow_node_id"
  },
  {
    tableName: "dev_job_instances",
    columnName: "branch_result_json",
    definition: "ALTER TABLE dev_job_instances ADD COLUMN branch_result_json JSON NULL AFTER result_preview_json"
  },
  {
    tableName: "dev_job_instances",
    columnName: "processing_job_id",
    definition: "ALTER TABLE dev_job_instances ADD COLUMN processing_job_id BIGINT NULL AFTER script_id"
  },
  {
    tableName: "dev_job_instances",
    columnName: "orchestration_task_id",
    definition: "ALTER TABLE dev_job_instances ADD COLUMN orchestration_task_id BIGINT NULL AFTER processing_job_id"
  },
  {
    tableName: "dev_job_instances",
    columnName: "run_attempt",
    definition: "ALTER TABLE dev_job_instances ADD COLUMN run_attempt INT NOT NULL DEFAULT 1 AFTER retry_count"
  },
  {
    tableName: "dev_workflow_nodes",
    columnName: "script_id",
    operation: "always",
    definition: "ALTER TABLE dev_workflow_nodes MODIFY COLUMN script_id BIGINT NULL"
  },
  {
    tableName: "dev_job_instances",
    columnName: "script_id",
    operation: "always",
    definition: "ALTER TABLE dev_job_instances MODIFY COLUMN script_id BIGINT NULL"
  },
  {
    tableName: "qc_issue",
    columnName: "owner_user_id",
    definition: "ALTER TABLE qc_issue ADD COLUMN owner_user_id BIGINT NULL AFTER severity"
  },
  {
    tableName: "report_datasets",
    columnName: "folder_id",
    definition: "ALTER TABLE report_datasets ADD COLUMN folder_id BIGINT NULL AFTER source_id, ADD KEY idx_report_dataset_folder (folder_id), ADD CONSTRAINT fk_report_dataset_folder FOREIGN KEY (folder_id) REFERENCES report_dataset_folders(id) ON DELETE SET NULL"
  }
];

async function ensureShadowQualitySource(pool, row) {
  const baseCode = String(row.source_code || row.sourceCode || "").trim().replace(/^(qc__)+/, "");
  const shadowCode = `qc__${baseCode}`;
  const [existingRows] = await pool.query("SELECT id FROM data_sources WHERE source_code = ? LIMIT 1", [shadowCode]);
  if (existingRows.length > 0) {
    return Number(existingRows[0].id);
  }
  const [result] = await pool.query(
    `INSERT INTO data_sources
      (source_name, source_code, source_domain, source_type, connection_config, owner_name, status, created_at, updated_at)
     VALUES (?, ?, 'quality_shadow', ?, ?, ?, ?, ?, ?)`,
    [
      row.source_name || row.sourceName,
      shadowCode,
      row.source_type || row.sourceType,
      typeof row.connection_config === "string" ? row.connection_config : JSON.stringify(row.connection_config || row.connectionConfig || {}),
      row.owner_name || row.ownerName || "system",
      row.status || "active",
      row.created_at || row.createdAt || new Date(),
      row.updated_at || row.updatedAt || new Date(),
    ]
  );
  return Number(result.insertId);
}

async function migrateScopedDataSources(pool) {
  await pool.query("DELETE FROM ingestion_data_sources WHERE source_code LIKE 'qc__%'");
  await pool.query(
    `INSERT IGNORE INTO ingestion_data_sources
      (id, source_name, source_code, source_type, connection_config, owner_name, status, created_at, updated_at)
     SELECT DISTINCT ds.id, ds.source_name, ds.source_code, ds.source_type, ds.connection_config, ds.owner_name, ds.status, ds.created_at, ds.updated_at
     FROM data_sources ds
     WHERE (ds.source_domain <> 'quality' AND ds.source_domain <> 'quality_shadow')
        OR EXISTS (SELECT 1 FROM ingestion_tasks it WHERE it.source_id = ds.id OR it.target_source_id = ds.id)
        OR EXISTS (SELECT 1 FROM ingestion_jobs ij WHERE ij.source_id = ds.id)
        OR EXISTS (SELECT 1 FROM data_source_research_runs rr WHERE rr.source_id = ds.id)`
  );

  await pool.query(
    `INSERT IGNORE INTO data_sources
      (id, project_id, source_name, source_code, source_domain, source_type, connection_config, owner_name, status, created_at, updated_at)
     SELECT ids.id,
            COALESCE(
              (SELECT it.project_id FROM ingestion_tasks it WHERE it.source_id = ids.id OR it.target_source_id = ids.id LIMIT 1),
              (SELECT rr.project_id FROM data_source_research_runs rr WHERE rr.source_id = ids.id LIMIT 1),
              (SELECT u.default_project_id FROM users u WHERE u.username = 'admin' LIMIT 1),
              (SELECT ps.id FROM project_spaces ps ORDER BY ps.id ASC LIMIT 1)
            ),
            ids.source_name, ids.source_code, 'integration_shadow', ids.source_type,
            ids.connection_config, ids.owner_name, ids.status, ids.created_at, ids.updated_at
     FROM ingestion_data_sources ids
     LEFT JOIN data_sources ds ON ds.id = ids.id
     WHERE ds.id IS NULL`
  );

  const [qualityRows] = await pool.query(
    `SELECT DISTINCT ds.*,
            EXISTS (SELECT 1 FROM qc_monitor_source ms WHERE ms.source_id = ds.id) AS hasMonitorSourceRef,
            EXISTS (SELECT 1 FROM qc_monitor_table mt WHERE mt.source_id = ds.id) AS hasMonitorTableRef,
            EXISTS (SELECT 1 FROM qc_strategy qs WHERE qs.source_id = ds.id) AS hasStrategyRef,
            EXISTS (SELECT 1 FROM qc_task qt WHERE qt.source_id = ds.id) AS hasTaskRef
     FROM data_sources ds
     WHERE ds.source_domain = 'quality'
        OR EXISTS (SELECT 1 FROM qc_monitor_source ms WHERE ms.source_id = ds.id)
        OR EXISTS (SELECT 1 FROM qc_monitor_table mt WHERE mt.source_id = ds.id)
        OR EXISTS (SELECT 1 FROM qc_strategy qs WHERE qs.source_id = ds.id)
        OR EXISTS (SELECT 1 FROM qc_task qt WHERE qt.source_id = ds.id)`
  );

  for (const row of qualityRows) {
    const hasQualityRefs = Boolean(
      Number(row.hasMonitorSourceRef || 0)
      || Number(row.hasMonitorTableRef || 0)
      || Number(row.hasStrategyRef || 0)
      || Number(row.hasTaskRef || 0)
    );

    // Cleanup legacy quality sources that only remain in the shared source table
    // but are no longer referenced anywhere in the quality module.
    if (String(row.source_domain || "").trim() === "quality" && !hasQualityRefs) {
      await pool.query("DELETE FROM data_sources WHERE id = ?", [row.id]);
      continue;
    }

    const baseCode = String(row.source_code || "").trim().replace(/^(qc__)+/, "");
    const shadowCode = `qc__${baseCode}`;
    const [mappedRows] = await pool.query("SELECT id FROM qc_data_sources WHERE source_code = ? LIMIT 1", [baseCode]);
    let targetId = null;
    if (mappedRows.length > 0) {
      targetId = Number(mappedRows[0].id);
    } else {
      targetId = await ensureShadowQualitySource(pool, row);
      await pool.query(
        `INSERT INTO qc_data_sources
          (id, source_name, source_code, source_type, connection_config, owner_name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          targetId,
          row.source_name,
          baseCode,
          row.source_type,
          typeof row.connection_config === "string" ? row.connection_config : JSON.stringify(row.connection_config || {}),
          row.owner_name,
          row.status,
          row.created_at,
          row.updated_at,
        ]
      );
    }

    if (targetId !== Number(row.id)) {
      const [targetMonitorRows] = await pool.query("SELECT id FROM qc_monitor_source WHERE source_id = ? LIMIT 1", [targetId]);
      const [sourceMonitorRows] = await pool.query("SELECT id FROM qc_monitor_source WHERE source_id = ? LIMIT 1", [row.id]);
      if (targetMonitorRows.length > 0 && sourceMonitorRows.length > 0) {
        const targetMonitorSourceId = Number(targetMonitorRows[0].id);
        const sourceMonitorSourceId = Number(sourceMonitorRows[0].id);
        if (targetMonitorSourceId !== sourceMonitorSourceId) {
          const [duplicateTableRows] = await pool.query(
            `SELECT source_table.id AS sourceTableId, target_table.id AS targetTableId
             FROM qc_monitor_table source_table
             INNER JOIN qc_monitor_table target_table
               ON target_table.monitor_source_id = ?
              AND target_table.table_name = source_table.table_name
             WHERE source_table.monitor_source_id = ?`,
            [targetMonitorSourceId, sourceMonitorSourceId]
          );
          for (const tableRow of duplicateTableRows) {
            const sourceTableId = Number(tableRow.sourceTableId);
            const targetTableId = Number(tableRow.targetTableId);
            const [targetStrategyRows] = await pool.query("SELECT id FROM qc_strategy WHERE monitor_table_id = ? LIMIT 1", [targetTableId]);
            const [sourceStrategyRows] = await pool.query("SELECT id FROM qc_strategy WHERE monitor_table_id = ? LIMIT 1", [sourceTableId]);
            if (targetStrategyRows.length > 0 && sourceStrategyRows.length > 0) {
              const targetStrategyId = Number(targetStrategyRows[0].id);
              const sourceStrategyId = Number(sourceStrategyRows[0].id);
              await pool.query(
                "UPDATE qc_task SET monitor_table_id = ?, strategy_id = ? WHERE strategy_id = ?",
                [targetTableId, targetStrategyId, sourceStrategyId]
              );
              await pool.query("DELETE FROM qc_strategy WHERE id = ?", [sourceStrategyId]);
            } else {
              await pool.query("UPDATE qc_strategy SET monitor_table_id = ? WHERE monitor_table_id = ?", [targetTableId, sourceTableId]);
              await pool.query("UPDATE qc_task SET monitor_table_id = ? WHERE monitor_table_id = ?", [targetTableId, sourceTableId]);
            }
            await pool.query("DELETE FROM qc_monitor_table WHERE id = ?", [sourceTableId]);
          }
          await pool.query(
            "UPDATE qc_monitor_table SET monitor_source_id = ? WHERE monitor_source_id = ?",
            [targetMonitorSourceId, sourceMonitorSourceId]
          );
          await pool.query("DELETE FROM qc_monitor_source WHERE id = ?", [sourceMonitorSourceId]);
        }
      }
      await pool.query("UPDATE qc_monitor_source SET source_id = ? WHERE source_id = ?", [targetId, row.id]);
      await pool.query("UPDATE qc_monitor_table SET source_id = ? WHERE source_id = ?", [targetId, row.id]);
      await pool.query("UPDATE qc_strategy SET source_id = ? WHERE source_id = ?", [targetId, row.id]);
      await pool.query("UPDATE qc_task SET source_id = ? WHERE source_id = ?", [targetId, row.id]);
    }

    await pool.query("UPDATE qc_data_sources SET source_code = ? WHERE id = ?", [baseCode, targetId]);
    await pool.query("UPDATE data_sources SET source_code = ?, source_domain = 'quality_shadow' WHERE id = ?", [shadowCode, targetId]);
  }

  const [shadowRows] = await pool.query("SELECT id, source_code AS sourceCode FROM qc_data_sources WHERE source_code LIKE 'qc__%'");
  for (const shadow of shadowRows) {
    const baseCode = String(shadow.sourceCode || "").replace(/^(qc__)+/, "");
    const [targetRows] = await pool.query("SELECT id FROM qc_data_sources WHERE source_code = ? LIMIT 1", [baseCode]);
    let targetId = null;
    if (targetRows.length === 0) {
      targetId = Number(shadow.id);
      await pool.query(
        `UPDATE qc_data_sources
         SET source_code = ?
         WHERE id = ?`,
        [baseCode, targetId]
      );
      await pool.query("UPDATE data_sources SET source_code = ?, source_domain = 'quality_shadow' WHERE id = ?", [`qc__${baseCode}`, targetId]);
      continue;
    }
    targetId = Number(targetRows[0].id);
    const shadowId = Number(shadow.id);
    await pool.query("UPDATE qc_monitor_source SET source_id = ? WHERE source_id = ?", [targetId, shadowId]);
    await pool.query("UPDATE qc_monitor_table SET source_id = ? WHERE source_id = ?", [targetId, shadowId]);
    await pool.query("UPDATE qc_strategy SET source_id = ? WHERE source_id = ?", [targetId, shadowId]);
    await pool.query("UPDATE qc_task SET source_id = ? WHERE source_id = ?", [targetId, shadowId]);
    await pool.query("DELETE FROM qc_data_sources WHERE id = ?", [shadowId]);
    await pool.query("DELETE FROM data_sources WHERE id = ?", [shadowId]);
  }
}

async function indexExists(pool, tableName, indexName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?`,
    [tableName, indexName]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function tableExists(pool, tableName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function columnExists(pool, tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function ensureIndex(pool, tableName, indexName, definition) {
  if (await indexExists(pool, tableName, indexName)) {
    return;
  }
  await pool.query(`ALTER TABLE ${tableName} ADD INDEX ${indexName} ${definition}`);
}

async function foreignKeyExists(pool, tableName, constraintName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.table_constraints
     WHERE constraint_schema = DATABASE()
       AND table_name = ?
       AND constraint_name = ?
       AND constraint_type = 'FOREIGN KEY'`,
    [tableName, constraintName]
  );
  return Number(rows[0]?.total || 0) > 0;
}

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

async function findUniqueIndexesByColumns(pool, tableName, columns) {
  const expectedColumns = columns.join(",");
  const [rows] = await pool.query(
    `SELECT index_name AS indexName,
            GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS columnNames,
            MAX(non_unique) AS nonUnique
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name <> 'PRIMARY'
     GROUP BY index_name
     HAVING nonUnique = 0`,
    [tableName]
  );
  return rows
    .filter((row) => String(row.columnNames || "") === expectedColumns)
    .map((row) => row.indexName);
}

function buildProjectUniqueIndexName(tableName, columns) {
  const name = `uk_${tableName}_project_${columns.join("_")}`;
  if (name.length <= 64) {
    return name;
  }
  const hash = crypto.createHash("sha1").update(`${tableName}:${columns.join(",")}`).digest("hex").slice(0, 8);
  return `uk_${tableName.slice(0, 42)}_${hash}`;
}

async function ensureDefaultProjectSpace(pool) {
  const [existingRows] = await pool.query("SELECT id FROM project_spaces WHERE project_code = 'default' LIMIT 1");
  if (existingRows.length > 0) {
    return Number(existingRows[0].id);
  }

  const [adminRows] = await pool.query(
    "SELECT id, display_name AS displayName FROM users WHERE role_code = 'admin' ORDER BY id ASC LIMIT 1"
  );
  const owner = adminRows[0] || {};
  const [result] = await pool.query(
    `INSERT INTO project_spaces
      (project_name, project_code, project_type, description, owner_user_id, owner_name, status, resource_config_json, settings_json, created_by)
     VALUES ('默认项目', 'default', 'standard', '历史数据和未指定项目的默认工作空间', ?, ?, 'active', JSON_OBJECT(), JSON_OBJECT(), 'system')`,
    [owner.id || null, owner.displayName || "system"]
  );
  return Number(result.insertId);
}

const projectScopedTables = [
  "data_sources",
  "ingestion_data_sources",
  "qc_data_sources",
  "data_lab_sources",
  "service_data_sources",
  "report_data_sources",
  "dev_datasources",
  "dm_departments",
  "dm_business_systems",
  "dm_data_sources",
  "dm_catalogs",
  "dm_resources",
  "dm_resource_lineage_edges",
  "data_source_research_tasks",
  "data_source_research_runs",
  "data_source_research_report_comparisons",
  "ingestion_tasks",
  "ingestion_jobs",
  "ingestion_job_runs",
  "ingestion_api_sync_states",
  "file_import_tasks",
  "file_import_runs",
  "qc_monitor_source",
  "qc_monitor_table",
  "qc_strategy",
  "qc_strategy_version",
  "qc_recommendation_run",
  "qc_task",
  "qc_task_run",
  "qc_quality_tag",
  "qc_monitor_table_tag_relation",
  "qc_score_config",
  "qc_result_batch",
  "qc_result_rule_stat",
  "qc_result_sample",
  "qc_finding",
  "qc_issue",
  "qc_issue_occurrence",
  "qc_issue_event",
  "qc_report",
  "qc_ai_analysis_run",
  "qc_standard_dictionary",
  "dev_script_folders",
  "dev_sql_scripts",
  "dev_workflows",
  "dev_orchestration_tasks",
  "dev_processing_jobs",
  "service_apis",
  "service_apps",
  "service_api_authorizations",
  "service_api_call_logs",
  "report_dataset_folders",
  "report_datasets",
  "report_chart_assets",
  "report_dashboards",
  "report_theme_templates",
  "lab_kb",
  "lab_scene",
  "lab_industry_incubation",
  "lab_business_system_template",
  "lab_business_system_instance",
  "lab_industry_data_source",
  "lab_ai_business_data_task",
  "asset_search_feedback",
  "asset_search_ai_runs",
  "std_field_mappings",
  "std_compliance_runs",
  "std_compliance_findings",
];

const projectScopedUniqueIndexes = [
  { tableName: "data_sources", columns: ["source_code"] },
  { tableName: "ingestion_data_sources", columns: ["source_code"] },
  { tableName: "qc_data_sources", columns: ["source_code"] },
  { tableName: "data_lab_sources", columns: ["source_code"] },
  { tableName: "service_data_sources", columns: ["source_code"] },
  { tableName: "report_data_sources", columns: ["source_code"] },
  { tableName: "dm_departments", columns: ["department_code"] },
  { tableName: "dm_business_systems", columns: ["system_code"] },
  { tableName: "dm_data_sources", columns: ["source_code"] },
  { tableName: "dm_resources", columns: ["resource_code"] },
  { tableName: "ingestion_tasks", columns: ["task_code"] },
  { tableName: "file_import_tasks", columns: ["task_code"] },
  { tableName: "qc_task", columns: ["task_code"] },
  { tableName: "qc_report", columns: ["report_code"] },
  { tableName: "qc_standard_dictionary", columns: ["dict_code"] },
  { tableName: "service_apis", columns: ["service_code"] },
  { tableName: "service_apps", columns: ["app_code"] },
  { tableName: "report_datasets", columns: ["dataset_code"] },
  { tableName: "report_dashboards", columns: ["dashboard_code"] },
  { tableName: "report_theme_templates", columns: ["theme_code"] },
  { tableName: "report_chart_assets", columns: ["chart_code"] },
  { tableName: "lab_scene", columns: ["scene_code"] },
  { tableName: "lab_industry_incubation", columns: ["incubation_code"] },
  { tableName: "lab_business_system_template", columns: ["template_code"] },
  { tableName: "lab_business_system_instance", columns: ["instance_code"] },
  { tableName: "lab_industry_data_source", columns: ["data_source_code"] },
];

async function ensureProjectScopeColumns(pool) {
  const defaultProjectId = await ensureDefaultProjectSpace(pool);

  await pool.query(
    `INSERT IGNORE INTO project_members
      (project_id, user_id, project_role, permissions_json, status)
     SELECT ?, u.id, CASE WHEN u.role_code = 'admin' THEN 'owner' ELSE 'developer' END, JSON_OBJECT('modules', JSON_ARRAY()), 'active'
     FROM users u`,
    [defaultProjectId]
  );

  for (const tableName of projectScopedTables) {
    if (!(await tableExists(pool, tableName))) {
      continue;
    }
    if (!(await columnExists(pool, tableName, "project_id"))) {
      await pool.query(`ALTER TABLE ${tableName} ADD COLUMN project_id BIGINT NULL AFTER id`);
    }
    await ensureIndex(pool, tableName, buildProjectIndexName(tableName), "(project_id)");
    if (tableName === "qc_strategy_version") {
      await pool.query(
        `UPDATE qc_strategy_version v
         JOIN qc_strategy s ON s.id = v.strategy_id
         SET v.project_id = s.project_id
         WHERE v.project_id IS NULL AND s.project_id IS NOT NULL`
      );
    }
    if (tableName === "qc_task_run") {
      await pool.query(
        `UPDATE qc_task_run r
         JOIN qc_task t ON t.id = r.task_id
         SET r.project_id = t.project_id
         WHERE r.project_id IS NULL AND t.project_id IS NOT NULL`
      );
    }
    await pool.query(`UPDATE ${tableName} SET project_id = ? WHERE project_id IS NULL`, [defaultProjectId]);
  }
}

async function ensureProjectScopedUniqueIndexes(pool) {
  for (const item of projectScopedUniqueIndexes) {
    if (!(await tableExists(pool, item.tableName)) || !(await columnExists(pool, item.tableName, "project_id"))) {
      continue;
    }

    let hasAllColumns = true;
    for (const columnName of item.columns) {
      if (!(await columnExists(pool, item.tableName, columnName))) {
        hasAllColumns = false;
        break;
      }
    }
    if (!hasAllColumns) {
      continue;
    }

    const scopedColumns = ["project_id", ...item.columns];
    const legacyIndexes = await findUniqueIndexesByColumns(pool, item.tableName, item.columns);
    for (const indexName of legacyIndexes) {
      await pool.query(`ALTER TABLE ${quoteIdentifier(item.tableName)} DROP INDEX ${quoteIdentifier(indexName)}`);
    }

    const scopedIndexes = await findUniqueIndexesByColumns(pool, item.tableName, scopedColumns);
    if (scopedIndexes.length === 0) {
      await pool.query(
        `ALTER TABLE ${quoteIdentifier(item.tableName)}
         ADD UNIQUE INDEX ${quoteIdentifier(buildProjectUniqueIndexName(item.tableName, item.columns))}
           (${scopedColumns.map(quoteIdentifier).join(", ")})`
      );
    }
  }
}

function buildProjectIndexName(tableName) {
  const name = `idx_${tableName}_project`;
  if (name.length <= 64) {
    return name;
  }
  const hash = crypto.createHash("sha1").update(tableName).digest("hex").slice(0, 8);
  return `idx_${tableName.slice(0, 45)}_${hash}_project`;
}

async function ensureIngestionJobRunIndexes(pool) {
  await ensureIndex(
    pool,
    "ingestion_job_runs",
    "idx_ingestion_job_runs_task_created_id",
    "(task_id, created_at, id)"
  );
  await ensureIndex(
    pool,
    "ingestion_job_runs",
    "idx_ingestion_job_runs_task_status_created",
    "(task_id, run_status, created_at, id)"
  );
  await ensureIndex(
    pool,
    "ingestion_job_runs",
    "idx_ingestion_job_runs_created_at",
    "(created_at)"
  );
}

async function ensureQualityAiConfigs(pool) {
  const configs = [
    ["质量策略推荐", "quality_strategy_recommendation", "为个人学习和日常治理辅助生成可执行、可解释的质量策略建议。"],
    ["合规规则智能解析", "quality_regex_rule_analysis", "基于用户输入的规则名称推荐规则编码、正则表达式和匹配样例。"],
    ["业务字典表解析", "quality_dictionary_analysis", "识别单一或联合字典表的字段职责，并拆分为可审核注册的业务字典清单。"],
    ["质量分析与报告", "quality_analysis_report", "基于已归集的脱敏质量统计生成摘要、变化说明和核查建议。"],
    ["质量问题研判", "quality_issue_assistant", "仅基于已提供的统计、元数据和有限样例给出可能原因与整改建议。"],
  ];
  for (const [sceneName, sceneCode, description] of configs) {
    await pool.query(
      `INSERT INTO quality_ai_configs (scene_name, scene_code, description, system_prompt, owner_name, status)
       VALUES (?, ?, ?, ?, 'system', 'active')
       ON DUPLICATE KEY UPDATE scene_name=VALUES(scene_name), description=VALUES(description)`,
      [sceneName, sceneCode, description, "请仅使用输入的统计数据和脱敏样例。输出简洁中文 JSON：summary、evidence、possibleCauses、suggestions、limitations。不能编造指标、执行 SQL 或修改配置。"]
    );
  }
}

async function ensureDataSourceResearchIndexes(pool) {
  await ensureIndex(
    pool,
    "data_source_research_tasks",
    "idx_data_source_research_tasks_source",
    "(source_id)"
  );
  await ensureIndex(
    pool,
    "data_source_research_tasks",
    "idx_data_source_research_tasks_status",
    "(status)"
  );
  await ensureIndex(
    pool,
    "data_source_research_runs",
    "idx_data_source_research_runs_source_created",
    "(source_id, created_at, id)"
  );
  await ensureIndex(
    pool,
    "data_source_research_runs",
    "idx_data_source_research_runs_task_created",
    "(task_id, created_at, id)"
  );
  await ensureIndex(
    pool,
    "data_source_research_runs",
    "idx_data_source_research_runs_status",
    "(status)"
  );
  await ensureIndex(
    pool,
    "data_source_research_logs",
    "idx_data_source_research_logs_run_created",
    "(run_id, created_at, id)"
  );
  await ensureIndex(
    pool,
    "data_source_research_report_comparisons",
    "idx_data_source_research_comparison_task",
    "(task_id, created_at, id)"
  );
}

function parseMigrationJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function normalizeLegacyDictionaryCode(value, fallback) {
  const normalized = String(value || fallback || "business_dictionary")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || "business_dictionary";
  return normalized.slice(0, 64);
}

async function ensureDictionaryCloneForProject(pool, sourceDictionaryId, projectId, cache) {
  const cacheKey = `${projectId}:dictionary:${sourceDictionaryId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const [sourceRows] = await pool.query("SELECT * FROM qc_standard_dictionary WHERE id = ? LIMIT 1", [sourceDictionaryId]);
  const source = sourceRows[0];
  if (!source) return null;
  if (Number(source.project_id) === Number(projectId)) {
    cache.set(cacheKey, Number(source.id));
    return Number(source.id);
  }
  const [existingRows] = await pool.query(
    "SELECT id FROM qc_standard_dictionary WHERE project_id = ? AND dict_code = ? LIMIT 1",
    [projectId, source.dict_code]
  );
  let dictionaryId = existingRows[0] ? Number(existingRows[0].id) : null;
  if (!dictionaryId) {
    const [result] = await pool.query(
      `INSERT INTO qc_standard_dictionary
        (project_id, dict_code, dict_name, dict_category, value_type, dict_desc, registration_mode,
         source_system_id, source_system_code, source_system_name, source_id, source_code, source_name,
         source_table, code_field, value_field, label_field, filter_config_json, last_registered_at,
         status, created_by)
       SELECT ?, dict_code, dict_name, dict_category, value_type, dict_desc, registration_mode,
              source_system_id, source_system_code, source_system_name, source_id, source_code, source_name,
              source_table, code_field, value_field, label_field, filter_config_json, last_registered_at,
              status, created_by
       FROM qc_standard_dictionary WHERE id = ?`,
      [projectId, sourceDictionaryId]
    );
    dictionaryId = Number(result.insertId);
    await pool.query(
      `INSERT INTO qc_standard_dictionary_item
        (dict_id, item_code, item_label, item_value, min_value, max_value, sort_order, status)
       SELECT ?, item_code, item_label, item_value, min_value, max_value, sort_order, status
       FROM qc_standard_dictionary_item WHERE dict_id = ?`,
      [dictionaryId, sourceDictionaryId]
    );
  }
  cache.set(cacheKey, dictionaryId);
  return dictionaryId;
}

async function ensureLegacyTemplateDictionary(pool, templateId, projectId, cache) {
  const cacheKey = `${projectId}:template:${templateId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const [templateRows] = await pool.query("SELECT * FROM qc_dict_mapping_template WHERE id = ? LIMIT 1", [templateId]);
  const template = templateRows[0];
  if (!template) return null;
  const dictionaryCode = normalizeLegacyDictionaryCode(`legacy_${template.template_code}`, `legacy_template_${templateId}`);
  const [existingRows] = await pool.query(
    "SELECT id, dict_name AS dictName FROM qc_standard_dictionary WHERE project_id = ? AND dict_code = ? LIMIT 1",
    [projectId, dictionaryCode]
  );
  let dictionaryId = existingRows[0] ? Number(existingRows[0].id) : null;
  if (!dictionaryId) {
    const [result] = await pool.query(
      `INSERT INTO qc_standard_dictionary
        (project_id, dict_code, dict_name, dict_category, value_type, dict_desc, registration_mode, status, created_by)
       VALUES (?, ?, ?, 'business_dictionary', 'string', ?, 'manual', 'active', ?)`,
      [projectId, dictionaryCode, template.template_name, template.template_desc || "由历史映射模板迁移", template.created_by || "system"]
    );
    dictionaryId = Number(result.insertId);
    const [items] = await pool.query(
      `SELECT business_value AS businessValue, standard_code AS standardCode,
              standard_label AS standardLabel, match_priority AS sortOrder, status
       FROM qc_dict_mapping_item WHERE template_id = ? ORDER BY match_priority ASC, id ASC`,
      [templateId]
    );
    for (const item of items) {
      const value = String(item.businessValue || item.standardCode || "").trim();
      if (!value) continue;
      await pool.query(
        `INSERT INTO qc_standard_dictionary_item
          (dict_id, item_code, item_label, item_value, sort_order, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [dictionaryId, value, item.standardLabel || value, value, Number(item.sortOrder || 0), item.status || "active"]
      );
    }
  }
  cache.set(cacheKey, dictionaryId);
  return dictionaryId;
}

async function migrateQualityDictionaryReferences(pool) {
  if (!(await tableExists(pool, "qc_standard_dictionary")) || !(await columnExists(pool, "qc_standard_dictionary", "project_id"))) return;
  const [versions] = await pool.query(
    `SELECT id, project_id AS projectId, field_strategy_json AS fieldStrategyJson
     FROM qc_strategy_version
     WHERE field_strategy_json IS NOT NULL`
  );
  const cache = new Map();
  for (const version of versions) {
    const fields = parseMigrationJson(version.fieldStrategyJson, []);
    if (!Array.isArray(fields)) continue;
    let changed = false;
    for (const field of fields) {
      for (const key of ["valueRangeConfig", "valueRangeSnapshot"]) {
        const range = field?.[key];
        if (!range || typeof range !== "object") continue;
        const sourceType = String(range.sourceType || range.mode || "").toLowerCase();
        const sourceId = Number(range.sourceId || 0);
        if (!sourceId || !["dictionary", "template"].includes(sourceType)) continue;
        const dictionaryId = sourceType === "template"
          ? await ensureLegacyTemplateDictionary(pool, sourceId, Number(version.projectId), cache)
          : await ensureDictionaryCloneForProject(pool, sourceId, Number(version.projectId), cache);
        if (!dictionaryId) continue;
        const [dictionaryRows] = await pool.query("SELECT dict_name AS dictName FROM qc_standard_dictionary WHERE id = ? LIMIT 1", [dictionaryId]);
        range.sourceType = "dictionary";
        range.sourceId = dictionaryId;
        range.sourceLabel = dictionaryRows[0]?.dictName || range.sourceLabel || "业务字典表";
        range.mode = key === "valueRangeSnapshot" ? "list" : "dictionary";
        changed = true;
      }
    }
    if (changed) {
      await pool.query("UPDATE qc_strategy_version SET field_strategy_json = ? WHERE id = ?", [JSON.stringify(fields), version.id]);
    }
  }
  if (await tableExists(pool, "qc_dict_mapping_template")) {
    await pool.query("UPDATE qc_dict_mapping_template SET status = 'deleted' WHERE status <> 'deleted'");
  }
}

async function ensureUnifiedSchedulingDefaults(pool) {
  if (await tableExists(pool, "dev_workflows")) {
    await pool.query("UPDATE dev_workflows SET is_paused = 1 WHERE published_version_no IS NULL");
  }
  if (await tableExists(pool, "dev_orchestration_tasks")) {
    await pool.query("UPDATE dev_orchestration_tasks SET is_paused = 1");
  }
}

async function ensureQualityReportComparisonMetadata(pool) {
  if (!(await tableExists(pool, "qc_report")) || !(await columnExists(pool, "qc_report", "analysis_mode"))) return;
  await pool.query(
    `UPDATE qc_report
     SET report_code = COALESCE(NULLIF(report_code, ''), CONCAT('QCR-', project_id, '-', id)),
         analysis_mode = CASE WHEN report_scope = 'comparison' THEN 'comparison' ELSE 'snapshot' END,
         comparison_type = CASE WHEN report_scope = 'comparison' THEN COALESCE(comparison_type, 'batch') ELSE NULL END,
         object_type = COALESCE(object_type,
           CASE WHEN report_scope = 'table' OR report_scope = 'comparison' THEN 'table'
                WHEN report_scope = 'system' AND scope_ref_id IS NULL THEN 'project'
                WHEN report_scope = 'system' THEN 'system'
                ELSE NULL END),
         object_ref_id = COALESCE(object_ref_id, scope_ref_id),
         current_batch_id = CASE WHEN report_scope = 'comparison'
           THEN COALESCE(current_batch_id, CAST(JSON_UNQUOTE(JSON_EXTRACT(batch_ids_json, '$[0]')) AS UNSIGNED))
           ELSE current_batch_id END,
         baseline_batch_id = CASE WHEN report_scope = 'comparison'
           THEN COALESCE(baseline_batch_id, CAST(JSON_UNQUOTE(JSON_EXTRACT(batch_ids_json, '$[1]')) AS UNSIGNED))
           ELSE baseline_batch_id END,
         snapshot_at = COALESCE(snapshot_at, created_at),
         governance_snapshot_at = COALESCE(governance_snapshot_at, created_at),
         summary_schema_version = COALESCE(NULLIF(summary_schema_version, ''), 'legacy-v1')`
  );
  await ensureIndex(pool, "qc_report", "idx_qc_report_project_compare", "(project_id, analysis_mode, comparison_type, created_at)");
}

async function ensureQualityIssueOwnerLink(pool) {
  if (!(await tableExists(pool, "qc_issue")) || !(await columnExists(pool, "qc_issue", "owner_user_id"))) return;
  await pool.query(
    `UPDATE qc_issue i
     JOIN users u ON u.username = i.owner_name AND u.status = 'active'
     SET i.owner_user_id = u.id,
         i.owner_name = COALESCE(NULLIF(u.display_name, ''), u.username)
     WHERE i.owner_user_id IS NULL AND i.owner_name IS NOT NULL AND i.owner_name <> ''`
  );
  await pool.query(
    `UPDATE qc_issue i
     JOIN (
       SELECT display_name, MIN(id) AS user_id
       FROM users
       WHERE status = 'active' AND display_name IS NOT NULL AND display_name <> ''
       GROUP BY display_name
       HAVING COUNT(*) = 1
     ) matched_user ON matched_user.display_name = i.owner_name
     JOIN users u ON u.id = matched_user.user_id
     SET i.owner_user_id = u.id,
         i.owner_name = COALESCE(NULLIF(u.display_name, ''), u.username)
     WHERE i.owner_user_id IS NULL AND i.owner_name IS NOT NULL AND i.owner_name <> ''`
  );
  await pool.query(
    `UPDATE qc_issue i
     LEFT JOIN users u ON u.id = i.owner_user_id
     SET i.owner_user_id = NULL
     WHERE i.owner_user_id IS NOT NULL AND u.id IS NULL`
  );
  await ensureIndex(pool, "qc_issue", "idx_qc_issue_owner", "(project_id, owner_user_id, updated_at)");
  if (!(await foreignKeyExists(pool, "qc_issue", "fk_qc_issue_owner_user"))) {
    await pool.query(
      "ALTER TABLE qc_issue ADD CONSTRAINT fk_qc_issue_owner_user FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL"
    );
  }
}

const postMigrations = [
  ensureProjectScopeColumns,
  migrateScopedDataSources,
  ensureProjectScopedUniqueIndexes,
  migrateQualityDictionaryReferences,
  ensureIngestionJobRunIndexes,
  ensureDataSourceResearchIndexes,
  ensureQualityAiConfigs,
  ensureQualityReportComparisonMetadata,
  ensureQualityIssueOwnerLink,
  ensureUnifiedSchedulingDefaults,
];

module.exports = {
  createTableStatements,
  columnMigrations,
  postMigrations,
};
