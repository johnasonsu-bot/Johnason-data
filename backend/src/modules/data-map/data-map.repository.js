const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");

function getScopedWhere(alias) {
  const projectId = getCurrentProjectId();
  if (!projectId) {
    return { sql: "", params: [], projectId: null };
  }
  const prefix = alias ? `${alias}.` : "";
  return { sql: `${prefix}project_id = ?`, params: [projectId], projectId };
}

function appendScopedWhere(where, params, alias) {
  const scoped = getScopedWhere(alias);
  if (scoped.sql) {
    where.push(scoped.sql);
    params.push(...scoped.params);
  }
  return scoped.projectId;
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
  } catch {
    return fallback;
  }
}

function json(value, fallback) {
  return JSON.stringify(value === undefined ? fallback : value);
}

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function mapDepartment(row) {
  return {
    id: Number(row.id),
    departmentName: row.departmentName,
    departmentCode: row.departmentCode,
    departmentShortName: row.departmentShortName || "",
    parentId: toNumber(row.parentId),
    parentName: row.parentName || null,
    contactName: row.contactName || "",
    contactPhone: row.contactPhone || "",
    contactEmail: row.contactEmail || "",
    dataOwner: row.dataOwner || "",
    dataSteward: row.dataSteward || "",
    description: row.description || "",
    tags: parseJson(row.tags, []),
    status: row.status,
    systemCount: Number(row.systemCount || 0),
    sourceCount: Number(row.sourceCount || 0),
    resourceCount: Number(row.resourceCount || 0),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapBusinessSystem(row) {
  return {
    id: Number(row.id),
    departmentId: Number(row.departmentId),
    departmentName: row.departmentName || "",
    departmentCode: row.departmentCode || "",
    systemName: row.systemName,
    systemCode: row.systemCode,
    systemShortName: row.systemShortName || "",
    systemType: row.systemType || "",
    systemLevel: row.systemLevel || "",
    lifecycleStatus: row.lifecycleStatus || "online",
    onlineDate: row.onlineDate || null,
    contactName: row.contactName || "",
    contactPhone: row.contactPhone || "",
    vendorName: row.vendorName || "",
    techOwner: row.techOwner || "",
    description: row.description || "",
    tags: parseJson(row.tags, []),
    status: row.status,
    sourceCount: Number(row.sourceCount || 0),
    resourceCount: Number(row.resourceCount || 0),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapDataSource(row) {
  return {
    id: Number(row.id),
    departmentId: Number(row.departmentId),
    departmentName: row.departmentName || "",
    departmentCode: row.departmentCode || "",
    businessSystemId: toNumber(row.businessSystemId),
    systemName: row.systemName || "",
    systemCode: row.systemCode || "",
    sourceName: row.sourceName,
    sourceCode: row.sourceCode,
    sourceType: row.sourceType,
    connectionConfig: parseJson(row.connectionConfig, {}),
    ownerName: row.ownerName || "system",
    environment: row.environment || "prod",
    purpose: row.purpose || "",
    sourceRefModule: row.sourceRefModule || "",
    sourceRefId: toNumber(row.sourceRefId),
    sourceRefCode: row.sourceRefCode || "",
    sourceRefSnapshot: parseJson(row.sourceRefSnapshot, null),
    importedAt: row.importedAt || null,
    status: row.status,
    resourceCount: Number(row.resourceCount || 0),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCatalog(row) {
  return {
    id: Number(row.id),
    parentId: toNumber(row.parentId),
    catalogName: row.catalogName,
    catalogShortCode: row.catalogShortCode,
    layerCode: row.layerCode || "",
    departmentId: Number(row.departmentId),
    departmentName: row.departmentName || "",
    departmentCode: row.departmentCode || "",
    businessSystemId: toNumber(row.businessSystemId),
    systemName: row.systemName || "",
    systemCode: row.systemCode || "",
    ownerName: row.ownerName || "",
    description: row.description || "",
    sortOrder: Number(row.sortOrder || 0),
    status: row.status,
    resourceCount: Number(row.resourceCount || 0),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapResource(row) {
  return {
    id: Number(row.id),
    resourceCode: row.resourceCode,
    catalogId: Number(row.catalogId),
    catalogName: row.catalogName || "",
    catalogShortCode: row.catalogShortCode || "",
    departmentId: Number(row.departmentId),
    departmentName: row.departmentName || "",
    departmentCode: row.departmentCode || "",
    businessSystemId: Number(row.businessSystemId),
    systemName: row.systemName || "",
    systemCode: row.systemCode || "",
    dataSourceId: Number(row.dataSourceId),
    sourceName: row.sourceName || "",
    sourceCode: row.sourceCode || "",
    sourceType: row.sourceType || "",
    tableName: row.tableName,
    tableComment: row.tableComment || "",
    rowCount: row.rowCount === null || row.rowCount === undefined ? null : Number(row.rowCount),
    rowCountMode: row.rowCountMode || "estimated",
    columnCount: Number(row.columnCount || 0),
    resourceCategory: row.resourceCategory || "",
    businessTags: parseJson(row.businessTags, []),
    sourceSnapshot: parseJson(row.sourceSnapshot, {}),
    status: row.status,
    lastSyncedAt: row.lastSyncedAt || null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapResourceField(row) {
  const standardMapping = row.standardElementId ? {
    id: Number(row.standardMappingId),
    elementId: Number(row.standardElementId),
    elementCode: row.standardElementCode || "",
    elementNameCn: row.standardElementNameCn || "",
    elementNameEn: row.standardElementNameEn || "",
    mappingStatus: row.standardMappingStatus || "",
    confidence: row.standardMappingConfidence === null || row.standardMappingConfidence === undefined
      ? null
      : Number(row.standardMappingConfidence),
    evidence: parseJson(row.standardMappingEvidence, []),
    updatedAt: row.standardMappingUpdatedAt || null,
  } : null;
  return {
    id: Number(row.id),
    resourceId: Number(row.resourceId),
    columnName: row.columnName,
    ordinalPosition: Number(row.ordinalPosition || 0),
    dataType: row.dataType || "",
    columnType: row.columnType || "",
    isNullable: Boolean(row.isNullable),
    isPrimaryKey: Boolean(row.isPrimaryKey),
    columnDefault: row.columnDefault,
    columnComment: row.columnComment || "",
    businessName: row.businessName || "",
    semanticTags: parseJson(row.semanticTags, []),
    standardMapping,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLineageEdge(row) {
  return {
    id: Number(row.id),
    sourceResourceId: toNumber(row.sourceResourceId),
    targetResourceId: toNumber(row.targetResourceId),
    sourceDataSourceId: toNumber(row.sourceDataSourceId),
    targetDataSourceId: toNumber(row.targetDataSourceId),
    sourceTableName: row.sourceTableName,
    targetTableName: row.targetTableName,
    sourceResourceCode: row.sourceResourceCode || "",
    targetResourceCode: row.targetResourceCode || "",
    sourceName: row.sourceName || "",
    targetName: row.targetName || "",
    lineageType: row.lineageType,
    relationLevel: row.relationLevel,
    relationSource: row.relationSource,
    relationSourceId: toNumber(row.relationSourceId),
    confidence: row.confidence,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapResourceContent(row) {
  return {
    id: Number(row.id),
    resourceId: Number(row.resourceId),
    businessName: row.businessName || "",
    businessDefinition: row.businessDefinition || "",
    businessGrain: row.businessGrain || "",
    updateFrequency: row.updateFrequency || "",
    dataOwner: row.dataOwner || "",
    techOwner: row.techOwner || "",
    usageScenarios: parseJson(row.usageScenarios, []),
    usageInstruction: row.usageInstruction || "",
    qualityNote: row.qualityNote || "",
    knownIssues: row.knownIssues || "",
    retentionPeriod: row.retentionPeriod || "",
    serviceSla: row.serviceSla || "",
    extension: parseJson(row.extension, {}),
    updatedBy: row.updatedBy || "system",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapResourceProfile(row) {
  return {
    id: Number(row.id),
    resourceId: Number(row.resourceId),
    profileStatus: row.profileStatus || "pending",
    sampleCount: Number(row.sampleCount || 0),
    rowCount: row.rowCount === null || row.rowCount === undefined ? null : Number(row.rowCount),
    columnCount: Number(row.columnCount || 0),
    nullableFieldCount: Number(row.nullableFieldCount || 0),
    primaryKeyFields: parseJson(row.primaryKeyFields, []),
    timeRange: parseJson(row.timeRange, {}),
    qualitySummary: parseJson(row.qualitySummary, {}),
    profile: parseJson(row.profile, {}),
    aiSummary: row.aiSummary || "",
    aiOutput: parseJson(row.aiOutput, null),
    aiAnalyzedAt: row.aiAnalyzedAt || null,
    errorMessage: row.errorMessage || "",
    profiledAt: row.profiledAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapResourceFieldProfile(row) {
  return {
    id: Number(row.id),
    resourceId: Number(row.resourceId),
    columnName: row.columnName,
    nullRate: row.nullRate === null || row.nullRate === undefined ? null : Number(row.nullRate),
    sampleValues: parseJson(row.sampleValues, []),
    issueTags: parseJson(row.issueTags, []),
    semanticTags: parseJson(row.semanticTags, []),
    featureTags: parseJson(row.featureTags, []),
    aiBusinessName: row.aiBusinessName || "",
    aiBusinessMeaning: row.aiBusinessMeaning || "",
    aiOutput: parseJson(row.aiOutput, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAiConfig(row) {
  return {
    id: Number(row.id),
    sceneName: row.sceneName,
    sceneCode: row.sceneCode,
    defaultModelProviderId: toNumber(row.defaultModelProviderId),
    defaultModelProviderName: row.defaultModelProviderName || null,
    defaultModelName: row.defaultModelName || null,
    defaultModelVersion: row.defaultModelVersion || null,
    temperature: row.temperature === null || row.temperature === undefined ? null : Number(row.temperature),
    maxTokens: row.maxTokens === null || row.maxTokens === undefined ? null : Number(row.maxTokens),
    timeoutMs: row.timeoutMs === null || row.timeoutMs === undefined ? null : Number(row.timeoutMs),
    systemPrompt: row.systemPrompt || "",
    userPromptTemplate: row.userPromptTemplate || "",
    outputSchema: parseJson(row.outputSchema, {}),
    description: row.description || "",
    ownerName: row.ownerName || "System Administrator",
    status: row.status || "active",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listDepartments() {
  const scoped = getScopedWhere("d");
  const [rows] = await pool.query(
    `SELECT d.id, d.department_name AS departmentName, d.department_code AS departmentCode,
            d.department_short_name AS departmentShortName, d.parent_id AS parentId,
            p.department_name AS parentName, d.contact_name AS contactName, d.contact_phone AS contactPhone,
            d.contact_email AS contactEmail, d.data_owner AS dataOwner, d.data_steward AS dataSteward,
            d.description, d.tags_json AS tags, d.status, d.created_by AS createdBy,
            d.created_at AS createdAt, d.updated_at AS updatedAt,
            COUNT(DISTINCT bs.id) AS systemCount,
            COUNT(DISTINCT ds.id) AS sourceCount,
            COUNT(DISTINCT r.id) AS resourceCount
     FROM dm_departments d
     LEFT JOIN dm_departments p ON p.id = d.parent_id
     LEFT JOIN dm_business_systems bs ON bs.department_id = d.id
     LEFT JOIN dm_data_sources ds ON ds.department_id = d.id
     LEFT JOIN dm_resources r ON r.department_id = d.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     GROUP BY d.id, p.department_name
     ORDER BY d.id DESC`,
    scoped.params
  );
  return rows.map(mapDepartment);
}

async function getDepartmentById(id) {
  const rows = await listDepartments();
  return rows.find((row) => row.id === Number(id)) || null;
}

async function createDepartment(payload, userName) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO dm_departments
      (project_id, department_name, department_code, department_short_name, parent_id, contact_name, contact_phone,
       contact_email, data_owner, data_steward, description, tags_json, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.departmentName,
      payload.departmentCode,
      payload.departmentShortName || null,
      payload.parentId || null,
      payload.contactName || null,
      payload.contactPhone || null,
      payload.contactEmail || null,
      payload.dataOwner || null,
      payload.dataSteward || null,
      payload.description || null,
      json(payload.tags, []),
      payload.status,
      userName || "system",
    ]
  );
  return getDepartmentById(result.insertId);
}

async function updateDepartment(id, payload) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE dm_departments
     SET department_name = ?, department_code = ?, department_short_name = ?, parent_id = ?,
         contact_name = ?, contact_phone = ?, contact_email = ?, data_owner = ?, data_steward = ?,
         description = ?, tags_json = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.departmentName,
      payload.departmentCode,
      payload.departmentShortName || null,
      payload.parentId || null,
      payload.contactName || null,
      payload.contactPhone || null,
      payload.contactEmail || null,
      payload.dataOwner || null,
      payload.dataSteward || null,
      payload.description || null,
      json(payload.tags, []),
      payload.status,
      id,
      ...scoped.params,
    ]
  );
  return Number(result.affectedRows || 0) > 0 ? getDepartmentById(id) : null;
}

async function deleteDepartment(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM dm_departments WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function listBusinessSystems() {
  const scoped = getScopedWhere("bs");
  const [rows] = await pool.query(
    `SELECT bs.id, bs.department_id AS departmentId, d.department_name AS departmentName,
            d.department_code AS departmentCode, bs.system_name AS systemName, bs.system_code AS systemCode,
            bs.system_short_name AS systemShortName, bs.system_type AS systemType, bs.system_level AS systemLevel,
            bs.lifecycle_status AS lifecycleStatus, bs.online_date AS onlineDate, bs.contact_name AS contactName,
            bs.contact_phone AS contactPhone, bs.vendor_name AS vendorName, bs.tech_owner AS techOwner,
            bs.description, bs.tags_json AS tags, bs.status, bs.created_by AS createdBy,
            bs.created_at AS createdAt, bs.updated_at AS updatedAt,
            COUNT(DISTINCT ds.id) AS sourceCount,
            COUNT(DISTINCT r.id) AS resourceCount
     FROM dm_business_systems bs
     JOIN dm_departments d ON d.id = bs.department_id
     LEFT JOIN dm_data_sources ds ON ds.business_system_id = bs.id
     LEFT JOIN dm_resources r ON r.business_system_id = bs.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     GROUP BY bs.id, d.department_name, d.department_code
     ORDER BY bs.id DESC`,
    scoped.params
  );
  return rows.map(mapBusinessSystem);
}

async function getBusinessSystemById(id) {
  const rows = await listBusinessSystems();
  return rows.find((row) => row.id === Number(id)) || null;
}

async function createBusinessSystem(payload, userName) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO dm_business_systems
      (project_id, department_id, system_name, system_code, system_short_name, system_type, system_level,
       lifecycle_status, online_date, contact_name, contact_phone, vendor_name, tech_owner,
       description, tags_json, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.departmentId,
      payload.systemName,
      payload.systemCode,
      payload.systemShortName || null,
      payload.systemType || null,
      payload.systemLevel || null,
      payload.lifecycleStatus || "online",
      payload.onlineDate || null,
      payload.contactName || null,
      payload.contactPhone || null,
      payload.vendorName || null,
      payload.techOwner || null,
      payload.description || null,
      json(payload.tags, []),
      payload.status,
      userName || "system",
    ]
  );
  return getBusinessSystemById(result.insertId);
}

async function updateBusinessSystem(id, payload) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE dm_business_systems
     SET department_id = ?, system_name = ?, system_code = ?, system_short_name = ?, system_type = ?,
         system_level = ?, lifecycle_status = ?, online_date = ?, contact_name = ?, contact_phone = ?,
         vendor_name = ?, tech_owner = ?, description = ?, tags_json = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.departmentId,
      payload.systemName,
      payload.systemCode,
      payload.systemShortName || null,
      payload.systemType || null,
      payload.systemLevel || null,
      payload.lifecycleStatus || "online",
      payload.onlineDate || null,
      payload.contactName || null,
      payload.contactPhone || null,
      payload.vendorName || null,
      payload.techOwner || null,
      payload.description || null,
      json(payload.tags, []),
      payload.status,
      id,
      ...scoped.params,
    ]
  );
  return Number(result.affectedRows || 0) > 0 ? getBusinessSystemById(id) : null;
}

async function deleteBusinessSystem(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM dm_business_systems WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function listDataSources() {
  const scoped = getScopedWhere("ds");
  const [rows] = await pool.query(
    `SELECT ds.id, ds.department_id AS departmentId, d.department_name AS departmentName,
            d.department_code AS departmentCode, ds.business_system_id AS businessSystemId,
            bs.system_name AS systemName, bs.system_code AS systemCode,
            ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType,
            ds.connection_config AS connectionConfig, ds.owner_name AS ownerName, ds.environment,
            ds.purpose, ds.source_ref_module AS sourceRefModule, ds.source_ref_id AS sourceRefId,
            ds.source_ref_code AS sourceRefCode, ds.source_ref_snapshot_json AS sourceRefSnapshot,
            ds.imported_at AS importedAt, ds.status, ds.created_by AS createdBy,
            ds.created_at AS createdAt, ds.updated_at AS updatedAt,
            COUNT(DISTINCT r.id) AS resourceCount
     FROM dm_data_sources ds
     JOIN dm_departments d ON d.id = ds.department_id
     JOIN dm_business_systems bs ON bs.id = ds.business_system_id
     LEFT JOIN dm_resources r ON r.data_source_id = ds.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     GROUP BY ds.id, d.department_name, d.department_code, bs.system_name, bs.system_code
     ORDER BY ds.id DESC`,
    scoped.params
  );
  return rows.map(mapDataSource);
}

async function getDataSourceById(id) {
  const scoped = getScopedWhere("ds");
  const [rows] = await pool.query(
    `SELECT ds.id, ds.department_id AS departmentId, d.department_name AS departmentName,
            d.department_code AS departmentCode, ds.business_system_id AS businessSystemId,
            bs.system_name AS systemName, bs.system_code AS systemCode,
            ds.source_name AS sourceName, ds.source_code AS sourceCode, ds.source_type AS sourceType,
            ds.connection_config AS connectionConfig, ds.owner_name AS ownerName, ds.environment,
            ds.purpose, ds.source_ref_module AS sourceRefModule, ds.source_ref_id AS sourceRefId,
            ds.source_ref_code AS sourceRefCode, ds.source_ref_snapshot_json AS sourceRefSnapshot,
            ds.imported_at AS importedAt, ds.status, ds.created_by AS createdBy,
            ds.created_at AS createdAt, ds.updated_at AS updatedAt,
            COUNT(DISTINCT r.id) AS resourceCount
     FROM dm_data_sources ds
     JOIN dm_departments d ON d.id = ds.department_id
     JOIN dm_business_systems bs ON bs.id = ds.business_system_id
     LEFT JOIN dm_resources r ON r.data_source_id = ds.id
     WHERE ds.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     GROUP BY ds.id, d.department_name, d.department_code, bs.system_name, bs.system_code`,
    [id, ...scoped.params]
  );
  return rows[0] ? mapDataSource(rows[0]) : null;
}

async function createDataSource(payload, departmentId, userName) {
  const projectId = getCurrentProjectId();
  const sourceRefSnapshot = payload.sourceRefSnapshot || null;
  const [result] = await pool.query(
    `INSERT INTO dm_data_sources
      (project_id, department_id, business_system_id, source_name, source_code, source_type, connection_config,
       owner_name, environment, purpose, source_ref_module, source_ref_id, source_ref_code,
       source_ref_snapshot_json, imported_at, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      departmentId,
      payload.businessSystemId,
      payload.sourceName,
      payload.sourceCode,
      payload.sourceType,
      json(payload.connectionConfig, {}),
      payload.ownerName || "system",
      payload.environment || "prod",
      payload.purpose || null,
      payload.sourceRefModule || null,
      payload.sourceRefId || null,
      payload.sourceRefCode || null,
      sourceRefSnapshot ? json(sourceRefSnapshot, {}) : null,
      payload.sourceRefModule ? new Date() : null,
      payload.status,
      userName || "system",
    ]
  );
  return getDataSourceById(result.insertId);
}

async function updateDataSource(id, payload, departmentId) {
  const scoped = getScopedWhere("");
  const sourceRefSnapshot = payload.sourceRefSnapshot || null;
  const [result] = await pool.query(
    `UPDATE dm_data_sources
     SET department_id = ?, business_system_id = ?, source_name = ?, source_code = ?, source_type = ?,
         connection_config = ?, owner_name = ?, environment = ?, purpose = ?, source_ref_module = ?,
         source_ref_id = ?, source_ref_code = ?, source_ref_snapshot_json = ?, imported_at = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      departmentId,
      payload.businessSystemId,
      payload.sourceName,
      payload.sourceCode,
      payload.sourceType,
      json(payload.connectionConfig, {}),
      payload.ownerName || "system",
      payload.environment || "prod",
      payload.purpose || null,
      payload.sourceRefModule || null,
      payload.sourceRefId || null,
      payload.sourceRefCode || null,
      sourceRefSnapshot ? json(sourceRefSnapshot, {}) : null,
      payload.sourceRefModule ? new Date() : null,
      payload.status,
      id,
      ...scoped.params,
    ]
  );
  return Number(result.affectedRows || 0) > 0 ? getDataSourceById(id) : null;
}

async function deleteDataSource(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM dm_data_sources WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function listCatalogs() {
  const scoped = getScopedWhere("c");
  const [rows] = await pool.query(
    `SELECT c.id, c.parent_id AS parentId, c.catalog_name AS catalogName, c.catalog_short_code AS catalogShortCode,
            c.layer_code AS layerCode, c.department_id AS departmentId, d.department_name AS departmentName,
            d.department_code AS departmentCode, c.business_system_id AS businessSystemId,
            bs.system_name AS systemName, bs.system_code AS systemCode, c.owner_name AS ownerName,
            c.description, c.sort_order AS sortOrder, c.status, c.created_by AS createdBy,
            c.created_at AS createdAt, c.updated_at AS updatedAt,
            COUNT(DISTINCT r.id) AS resourceCount
     FROM dm_catalogs c
     JOIN dm_departments d ON d.id = c.department_id
     LEFT JOIN dm_business_systems bs ON bs.id = c.business_system_id
     LEFT JOIN dm_resources r ON r.catalog_id = c.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     GROUP BY c.id, d.department_name, d.department_code, bs.system_name, bs.system_code
     ORDER BY c.sort_order ASC, c.id DESC`,
    scoped.params
  );
  return rows.map(mapCatalog);
}

async function getCatalogById(id) {
  const rows = await listCatalogs();
  return rows.find((row) => row.id === Number(id)) || null;
}

async function createCatalog(payload, userName) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO dm_catalogs
      (project_id, parent_id, catalog_name, catalog_short_code, layer_code, department_id, business_system_id,
       owner_name, description, sort_order, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.parentId || null,
      payload.catalogName,
      payload.catalogShortCode,
      payload.layerCode || null,
      payload.departmentId,
      payload.businessSystemId || null,
      payload.ownerName || null,
      payload.description || null,
      Number(payload.sortOrder || 0),
      payload.status,
      userName || "system",
    ]
  );
  return getCatalogById(result.insertId);
}

async function updateCatalog(id, payload) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE dm_catalogs
     SET parent_id = ?, catalog_name = ?, catalog_short_code = ?, layer_code = ?, department_id = ?,
         business_system_id = ?, owner_name = ?, description = ?, sort_order = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.parentId || null,
      payload.catalogName,
      payload.catalogShortCode,
      payload.layerCode || null,
      payload.departmentId,
      payload.businessSystemId || null,
      payload.ownerName || null,
      payload.description || null,
      Number(payload.sortOrder || 0),
      payload.status,
      id,
      ...scoped.params,
    ]
  );
  return Number(result.affectedRows || 0) > 0 ? getCatalogById(id) : null;
}

async function deleteCatalog(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM dm_catalogs WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function listResources(filters = {}) {
  const where = [];
  const params = [];
  appendScopedWhere(where, params, "r");
  if (filters.keyword) {
    where.push("(r.resource_code LIKE ? OR r.table_name LIKE ? OR r.table_comment LIKE ?)");
    const keyword = `%${filters.keyword}%`;
    params.push(keyword, keyword, keyword);
  }
  if (filters.departmentId) {
    where.push("r.department_id = ?");
    params.push(Number(filters.departmentId));
  }
  if (filters.businessSystemId) {
    where.push("r.business_system_id = ?");
    params.push(Number(filters.businessSystemId));
  }
  if (filters.catalogId) {
    where.push("r.catalog_id = ?");
    params.push(Number(filters.catalogId));
  }
  if (filters.dataSourceId) {
    where.push("r.data_source_id = ?");
    params.push(Number(filters.dataSourceId));
  }
  if (filters.resourceCategory) {
    where.push("r.resource_category = ?");
    params.push(filters.resourceCategory);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT r.id, r.resource_code AS resourceCode, r.catalog_id AS catalogId,
            c.catalog_name AS catalogName, c.catalog_short_code AS catalogShortCode,
            r.department_id AS departmentId, d.department_name AS departmentName,
            d.department_code AS departmentCode, r.business_system_id AS businessSystemId,
            bs.system_name AS systemName, bs.system_code AS systemCode,
            r.data_source_id AS dataSourceId, ds.source_name AS sourceName,
            ds.source_code AS sourceCode, ds.source_type AS sourceType,
            r.table_name AS tableName, r.table_comment AS tableComment, r.row_count AS rowCount,
            r.row_count_mode AS rowCountMode, r.column_count AS columnCount,
            r.resource_category AS resourceCategory, r.business_tags_json AS businessTags,
            r.source_snapshot_json AS sourceSnapshot, r.status, r.last_synced_at AS lastSyncedAt,
            r.created_by AS createdBy, r.created_at AS createdAt, r.updated_at AS updatedAt
     FROM dm_resources r
     JOIN dm_catalogs c ON c.id = r.catalog_id
     JOIN dm_departments d ON d.id = r.department_id
     JOIN dm_business_systems bs ON bs.id = r.business_system_id
     JOIN dm_data_sources ds ON ds.id = r.data_source_id
     ${whereSql}
     ORDER BY r.updated_at DESC, r.id DESC`,
    params
  );
  return rows.map(mapResource);
}

async function searchResources(filters = {}) {
  const where = [];
  const params = [];
  appendScopedWhere(where, params, "r");
  const keyword = String(filters.keyword || "").trim();
  const fieldKeyword = String(filters.fieldKeyword || "").trim();
  const tag = String(filters.tag || "").trim();
  const limit = Math.min(Math.max(Number(filters.limit || 100), 1), 500);

  if (keyword) {
    const keywordLike = `%${keyword}%`;
    const rawScopes = String(filters.keywordScopes || "").split(",").map((item) => item.trim()).filter(Boolean);
    const scopes = new Set(rawScopes.length > 0 ? rawScopes : ["resource", "field", "tag", "source"]);
    const keywordWhere = [];

    if (scopes.has("resource")) {
      keywordWhere.push("(r.resource_code LIKE ? OR r.table_name LIKE ? OR r.table_comment LIKE ? OR rc.business_name LIKE ? OR rc.business_definition LIKE ?)");
      params.push(keywordLike, keywordLike, keywordLike, keywordLike, keywordLike);
    }
    if (scopes.has("field")) {
      keywordWhere.push(
        `EXISTS (
          SELECT 1 FROM dm_resource_fields rf
          WHERE rf.resource_id = r.id
            AND (rf.column_name LIKE ? OR rf.column_comment LIKE ? OR rf.business_name LIKE ? OR rf.semantic_tags_json LIKE ?)
        )`
      );
      params.push(keywordLike, keywordLike, keywordLike, keywordLike);
    }
    if (scopes.has("tag")) {
      keywordWhere.push("r.business_tags_json LIKE ?");
      params.push(keywordLike);
    }
    if (scopes.has("source")) {
      keywordWhere.push(
        `(c.catalog_name LIKE ? OR c.catalog_short_code LIKE ?
          OR d.department_name LIKE ? OR d.department_code LIKE ?
          OR bs.system_name LIKE ? OR bs.system_code LIKE ?
          OR ds.source_name LIKE ? OR ds.source_code LIKE ?)`
      );
      params.push(keywordLike, keywordLike, keywordLike, keywordLike, keywordLike, keywordLike, keywordLike, keywordLike);
    }
    if (keywordWhere.length > 0) {
      where.push(`(${keywordWhere.join(" OR ")})`);
    }
  }

  if (fieldKeyword) {
    const fieldKeywordLike = `%${fieldKeyword}%`;
    where.push(
      `EXISTS (
        SELECT 1 FROM dm_resource_fields rf
        WHERE rf.resource_id = r.id
          AND (rf.column_name LIKE ? OR rf.column_comment LIKE ? OR rf.business_name LIKE ? OR rf.semantic_tags_json LIKE ?)
      )`
    );
    params.push(fieldKeywordLike, fieldKeywordLike, fieldKeywordLike, fieldKeywordLike);
  }

  if (filters.departmentId) {
    where.push("r.department_id = ?");
    params.push(Number(filters.departmentId));
  }
  if (filters.businessSystemId) {
    where.push("r.business_system_id = ?");
    params.push(Number(filters.businessSystemId));
  }
  if (filters.catalogId) {
    where.push("r.catalog_id = ?");
    params.push(Number(filters.catalogId));
  }
  if (filters.dataSourceId) {
    where.push("r.data_source_id = ?");
    params.push(Number(filters.dataSourceId));
  }
  if (filters.resourceCategory) {
    where.push("r.resource_category = ?");
    params.push(filters.resourceCategory);
  }
  if (filters.status) {
    where.push("r.status = ?");
    params.push(filters.status);
  }
  if (filters.profileStatus) {
    where.push("COALESCE(rp.profile_status, 'pending') = ?");
    params.push(filters.profileStatus);
  }
  if (tag) {
    where.push("r.business_tags_json LIKE ?");
    params.push(`%${tag}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT r.id, r.resource_code AS resourceCode, r.catalog_id AS catalogId,
            c.catalog_name AS catalogName, c.catalog_short_code AS catalogShortCode,
            r.department_id AS departmentId, d.department_name AS departmentName,
            d.department_code AS departmentCode, r.business_system_id AS businessSystemId,
            bs.system_name AS systemName, bs.system_code AS systemCode,
            r.data_source_id AS dataSourceId, ds.source_name AS sourceName,
            ds.source_code AS sourceCode, ds.source_type AS sourceType,
            r.table_name AS tableName, r.table_comment AS tableComment, r.row_count AS rowCount,
            r.row_count_mode AS rowCountMode, r.column_count AS columnCount,
            r.resource_category AS resourceCategory, r.business_tags_json AS businessTags,
            r.source_snapshot_json AS sourceSnapshot, r.status, r.last_synced_at AS lastSyncedAt,
            r.created_by AS createdBy, r.created_at AS createdAt, r.updated_at AS updatedAt,
            rc.business_name AS businessName, rc.business_definition AS businessDefinition,
            rc.business_grain AS businessGrain, rc.data_owner AS dataOwner, rc.tech_owner AS techOwner,
            COALESCE(rp.profile_status, 'pending') AS profileStatus, rp.sample_count AS sampleCount,
            rp.ai_summary AS aiSummary, rp.profiled_at AS profiledAt, rp.ai_analyzed_at AS aiAnalyzedAt,
            fieldAgg.field_count AS fieldCount, fieldAgg.field_names AS fieldNames
     FROM dm_resources r
     JOIN dm_catalogs c ON c.id = r.catalog_id
     JOIN dm_departments d ON d.id = r.department_id
     JOIN dm_business_systems bs ON bs.id = r.business_system_id
     JOIN dm_data_sources ds ON ds.id = r.data_source_id
     LEFT JOIN dm_resource_contents rc ON rc.resource_id = r.id
     LEFT JOIN dm_resource_profiles rp ON rp.resource_id = r.id
     LEFT JOIN (
       SELECT resource_id, COUNT(*) AS field_count,
              GROUP_CONCAT(column_name ORDER BY ordinal_position ASC SEPARATOR ',') AS field_names
       FROM dm_resource_fields
       GROUP BY resource_id
     ) fieldAgg ON fieldAgg.resource_id = r.id
     ${whereSql}
     ORDER BY r.updated_at DESC, r.id DESC
     LIMIT ?`,
    [...params, limit]
  );

  return rows.map((row) => ({
    ...mapResource(row),
    businessName: row.businessName || "",
    businessDefinition: row.businessDefinition || "",
    businessGrain: row.businessGrain || "",
    dataOwner: row.dataOwner || "",
    techOwner: row.techOwner || "",
    profileStatus: row.profileStatus || "pending",
    sampleCount: Number(row.sampleCount || 0),
    aiSummary: row.aiSummary || "",
    profiledAt: row.profiledAt || null,
    aiAnalyzedAt: row.aiAnalyzedAt || null,
    fieldCount: Number(row.fieldCount || row.columnCount || 0),
    fieldNames: String(row.fieldNames || "").split(",").map((item) => item.trim()).filter(Boolean),
  }));
}

async function getResourceById(id) {
  const rows = await listResources({});
  return rows.find((row) => row.id === Number(id)) || null;
}

async function listResourceFields(resourceId) {
  const [rows] = await pool.query(
    `SELECT f.id, f.resource_id AS resourceId, f.column_name AS columnName, f.ordinal_position AS ordinalPosition,
            f.data_type AS dataType, f.column_type AS columnType, f.is_nullable AS isNullable,
            f.is_primary_key AS isPrimaryKey, f.column_default AS columnDefault, f.column_comment AS columnComment,
            f.business_name AS businessName, f.semantic_tags_json AS semanticTags, f.status,
            f.created_at AS createdAt, f.updated_at AS updatedAt,
            sm.id AS standardMappingId, sm.mapping_status AS standardMappingStatus,
            sm.confidence AS standardMappingConfidence, sm.evidence_json AS standardMappingEvidence,
            sm.updated_at AS standardMappingUpdatedAt,
            e.id AS standardElementId, e.element_code AS standardElementCode,
            e.element_name_cn AS standardElementNameCn, e.element_name_en AS standardElementNameEn
     FROM dm_resource_fields f
     JOIN dm_resources r ON r.id = f.resource_id
     LEFT JOIN std_field_mappings sm ON sm.id = (
       SELECT fm.id
       FROM std_field_mappings fm
       WHERE fm.source_module = 'data_map'
         AND fm.mapping_status <> 'deleted'
         AND fm.resource_id = f.resource_id
         AND fm.table_name = r.table_name
         AND fm.column_name = f.column_name
       ORDER BY CASE fm.mapping_status WHEN 'approved' THEN 0 WHEN 'suggested' THEN 1 ELSE 2 END, fm.id DESC
       LIMIT 1
     )
     LEFT JOIN std_data_elements e ON e.id = sm.element_id AND e.status <> 'deleted'
     WHERE f.resource_id = ?
     ORDER BY f.ordinal_position ASC, f.id ASC`,
    [resourceId]
  );
  return rows.map(mapResourceField);
}

function buildFieldSnapshot(resource, field) {
  return {
    resourceCode: resource.resourceCode,
    tableName: resource.tableName,
    columnName: field.columnName,
    dataType: field.dataType || "",
    columnType: field.columnType || "",
    isNullable: Boolean(field.isNullable),
    isPrimaryKey: Boolean(field.isPrimaryKey),
    columnComment: field.columnComment || "",
    businessName: field.businessName || "",
    semanticTags: parseJson(field.semanticTags, []),
  };
}

async function getStandardDataElementById(id, db = pool) {
  if (!id) return null;
  const [rows] = await db.query(
    `SELECT e.id, e.element_code AS elementCode, e.element_name_cn AS elementNameCn,
            e.element_name_en AS elementNameEn, e.element_identifier AS elementIdentifier,
            e.definition, e.data_type AS dataType, e.object_class AS objectClass,
            e.property_name AS propertyName, e.representation_term AS representationTerm,
            e.qualifiers_json AS qualifiers, e.aliases_json AS aliases, e.tags_json AS tags,
            e.value_domain_id AS valueDomainId, vd.domain_name AS valueDomainName,
            vd.domain_code AS valueDomainCode, e.reference_standard_id AS referenceStandardId,
            rs.standard_name AS referenceStandardName, e.reference_clause AS referenceClause,
            e.lifecycle_status AS lifecycleStatus, e.status
     FROM std_data_elements e
     LEFT JOIN std_value_domains vd ON vd.id = e.value_domain_id
     LEFT JOIN std_reference_standards rs ON rs.id = e.reference_standard_id
     WHERE e.id = ? AND e.status <> 'deleted'
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  return row ? {
    id: Number(row.id),
    elementCode: row.elementCode,
    elementNameCn: row.elementNameCn,
    elementNameEn: row.elementNameEn || "",
    elementIdentifier: row.elementIdentifier,
    definition: row.definition || "",
    dataType: row.dataType || "",
    objectClass: row.objectClass || "",
    propertyName: row.propertyName || "",
    representationTerm: row.representationTerm || "",
    qualifiers: parseJson(row.qualifiers, []),
    aliases: parseJson(row.aliases, []),
    tags: parseJson(row.tags, []),
    valueDomainId: toNumber(row.valueDomainId),
    valueDomainName: row.valueDomainName || "",
    valueDomainCode: row.valueDomainCode || "",
    referenceStandardId: toNumber(row.referenceStandardId),
    referenceStandardName: row.referenceStandardName || "",
    referenceClause: row.referenceClause || "",
    lifecycleStatus: row.lifecycleStatus || "",
    status: row.status || "",
  } : null;
}

async function listStandardDataElementsForMatching(limit = 500) {
  const [rows] = await pool.query(
    `SELECT e.id, e.element_code AS elementCode, e.element_name_cn AS elementNameCn,
            e.element_name_en AS elementNameEn, e.element_identifier AS elementIdentifier,
            e.definition, e.data_type AS dataType, e.object_class AS objectClass,
            e.property_name AS propertyName, e.representation_term AS representationTerm,
            e.qualifiers_json AS qualifiers, e.aliases_json AS aliases, e.tags_json AS tags,
            e.value_domain_id AS valueDomainId, vd.domain_name AS valueDomainName,
            vd.domain_code AS valueDomainCode, e.reference_standard_id AS referenceStandardId,
            rs.standard_name AS referenceStandardName, e.reference_clause AS referenceClause,
            e.lifecycle_status AS lifecycleStatus, e.status
     FROM std_data_elements e
     LEFT JOIN std_value_domains vd ON vd.id = e.value_domain_id
     LEFT JOIN std_reference_standards rs ON rs.id = e.reference_standard_id
     WHERE e.status <> 'deleted' AND e.lifecycle_status <> 'deprecated'
     ORDER BY CASE e.lifecycle_status WHEN 'published' THEN 0 WHEN 'review' THEN 1 ELSE 2 END, e.updated_at DESC, e.id DESC
     LIMIT ?`,
    [Number(limit || 500)]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    elementCode: row.elementCode,
    elementNameCn: row.elementNameCn,
    elementNameEn: row.elementNameEn || "",
    elementIdentifier: row.elementIdentifier,
    definition: row.definition || "",
    dataType: row.dataType || "",
    objectClass: row.objectClass || "",
    propertyName: row.propertyName || "",
    representationTerm: row.representationTerm || "",
    qualifiers: parseJson(row.qualifiers, []),
    aliases: parseJson(row.aliases, []),
    tags: parseJson(row.tags, []),
    valueDomainId: toNumber(row.valueDomainId),
    valueDomainName: row.valueDomainName || "",
    valueDomainCode: row.valueDomainCode || "",
    referenceStandardId: toNumber(row.referenceStandardId),
    referenceStandardName: row.referenceStandardName || "",
    referenceClause: row.referenceClause || "",
    lifecycleStatus: row.lifecycleStatus || "",
    status: row.status || "",
  }));
}

async function replaceFieldStandardMapping(connection, resource, field, mapping) {
  const projectId = getCurrentProjectId();
  await connection.query(
    `UPDATE std_field_mappings
     SET mapping_status = 'deleted'
     WHERE source_module = 'data_map'
       AND resource_id = ?
       AND table_name = ?
       AND column_name = ?
       AND mapping_status <> 'deleted'`,
    [resource.id, resource.tableName, field.columnName]
  );

  if (!mapping?.elementId) {
    return;
  }

  await connection.query(
    `INSERT INTO std_field_mappings
      (project_id, element_id, source_module, resource_id, resource_code, table_name, column_name,
       field_snapshot_json, mapping_status, confidence, evidence_json, created_by, reviewed_by, reviewed_at)
     VALUES (?, ?, 'data_map', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      mapping.elementId,
      resource.id,
      resource.resourceCode,
      resource.tableName,
      field.columnName,
      json(buildFieldSnapshot(resource, field), {}),
      mapping.mappingStatus || "suggested",
      mapping.confidence ?? null,
      json(mapping.evidence, []),
      mapping.createdBy || "system",
      mapping.reviewedBy || null,
      mapping.reviewedAt || null,
    ]
  );
}

async function updateResourceFieldMetadata(resourceId, columnName, payload) {
  const projectId = getCurrentProjectId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [fieldRows] = await connection.query(
      `SELECT r.id AS resourceId, r.resource_code AS resourceCode, r.table_name AS tableName,
              f.column_name AS columnName, f.data_type AS dataType, f.column_type AS columnType,
              f.is_nullable AS isNullable, f.is_primary_key AS isPrimaryKey,
              f.column_comment AS columnComment, f.business_name AS businessName,
              f.semantic_tags_json AS semanticTags
       FROM dm_resource_fields f
       JOIN dm_resources r ON r.id = f.resource_id
       WHERE f.resource_id = ? AND f.column_name = ?${projectId ? " AND r.project_id = ?" : ""}
       LIMIT 1`,
      [resourceId, columnName, ...(projectId ? [projectId] : [])]
    );
    if (!fieldRows.length) {
      await connection.rollback();
      return false;
    }

    const [fieldResult] = await connection.query(
      `UPDATE dm_resource_fields
       SET column_comment = ?, business_name = ?, semantic_tags_json = ?
       WHERE resource_id = ? AND column_name = ?`,
      [
        payload.columnComment || null,
        payload.aiBusinessName || null,
        json(payload.semanticTags, []),
        resourceId,
        columnName,
      ]
    );
    if (Number(fieldResult.affectedRows || 0) === 0) {
      await connection.rollback();
      return false;
    }
    const updatedField = {
      ...fieldRows[0],
      columnComment: payload.columnComment || "",
      businessName: payload.aiBusinessName || "",
      semanticTags: json(payload.semanticTags, []),
    };
    await connection.query(
      `INSERT INTO dm_resource_field_profiles
        (resource_id, column_name, semantic_tags_json, feature_tags_json,
         ai_business_name, ai_business_meaning, ai_output_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         semantic_tags_json = VALUES(semantic_tags_json),
         feature_tags_json = VALUES(feature_tags_json),
         ai_business_name = VALUES(ai_business_name),
         ai_business_meaning = VALUES(ai_business_meaning),
         ai_output_json = VALUES(ai_output_json)`,
      [
        resourceId,
        columnName,
        json(payload.semanticTags, []),
        json(payload.featureTags, []),
        payload.aiBusinessName || null,
        payload.aiBusinessMeaning || null,
        json({
          ...(payload.aiOutput && typeof payload.aiOutput === "object" ? payload.aiOutput : {}),
          businessName: payload.aiBusinessName || "",
          businessMeaning: payload.aiBusinessMeaning || "",
          semanticTags: payload.semanticTags || [],
          featureTags: payload.featureTags || [],
        }, {}),
      ]
    );

    if (Object.prototype.hasOwnProperty.call(payload, "standardElementId")) {
      const elementId = payload.standardElementId ? Number(payload.standardElementId) : null;
      if (elementId) {
        const element = await getStandardDataElementById(elementId, connection);
        if (!element) {
          const error = new Error("标准数据元不存在");
          error.code = "STANDARD_ELEMENT_NOT_FOUND";
          throw error;
        }
      }
      await replaceFieldStandardMapping(connection, {
        id: Number(resourceId),
        resourceCode: fieldRows[0].resourceCode,
        tableName: fieldRows[0].tableName,
      }, updatedField, elementId ? {
        elementId,
        mappingStatus: "approved",
        confidence: 1,
        evidence: ["用户在数据项编辑中维护数据元映射"],
        createdBy: payload.updatedBy || "system",
        reviewedBy: payload.updatedBy || "system",
        reviewedAt: new Date(),
      } : null);
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getResourceBySourceAndTable(dataSourceId, tableName) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id
     FROM dm_resources
     WHERE data_source_id = ? AND table_name = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [dataSourceId, tableName, ...scoped.params]
  );
  return rows[0]?.id ? getResourceById(rows[0].id) : null;
}

async function nextResourceCode(connection, scope) {
  const [rows] = await connection.query(
    `SELECT id, current_value AS currentValue
     FROM dm_resource_sequences
     WHERE department_code = ? AND system_code = ? AND catalog_short_code = ?
     FOR UPDATE`,
    [scope.departmentCode, scope.systemCode, scope.catalogShortCode]
  );

  if (!rows.length) {
    await connection.query(
      `INSERT INTO dm_resource_sequences (department_code, system_code, catalog_short_code, current_value)
       VALUES (?, ?, ?, 0)`,
      [scope.departmentCode, scope.systemCode, scope.catalogShortCode]
    );
    return nextResourceCode(connection, scope);
  }

  const nextValue = Number(rows[0].currentValue || 0) + 1;
  await connection.query("UPDATE dm_resource_sequences SET current_value = ? WHERE id = ?", [nextValue, rows[0].id]);
  return `R_${scope.departmentCode}_${scope.systemCode}_${scope.catalogShortCode}_${String(nextValue).padStart(4, "0")}`;
}

async function createResourceWithFields(connection, payload) {
  const projectId = payload.projectId || getCurrentProjectId();
  const resourceCode = await nextResourceCode(connection, payload.scope);
  const [result] = await connection.query(
    `INSERT INTO dm_resources
      (project_id, resource_code, catalog_id, department_id, business_system_id, data_source_id, table_name,
       table_comment, row_count, row_count_mode, column_count, resource_category, business_tags_json,
       source_snapshot_json, status, last_synced_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), ?)`,
    [
      projectId,
      resourceCode,
      payload.catalogId,
      payload.departmentId,
      payload.businessSystemId,
      payload.dataSourceId,
      payload.tableName,
      payload.tableComment || null,
      payload.rowCount ?? null,
      payload.rowCountMode || "estimated",
      payload.columns.length,
      payload.resourceCategory || null,
      json(payload.businessTags, []),
      json(payload.sourceSnapshot, {}),
      payload.createdBy || "system",
    ]
  );

  const resourceId = Number(result.insertId);
  for (const column of payload.columns) {
    await connection.query(
      `INSERT INTO dm_resource_fields
        (resource_id, column_name, ordinal_position, data_type, column_type, is_nullable,
         is_primary_key, column_default, column_comment, semantic_tags_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resourceId,
        column.columnName,
        Number(column.ordinalPosition || 0),
        column.dataType || null,
        column.columnType || null,
        column.isNullable ? 1 : 0,
        column.isPrimaryKey ? 1 : 0,
        column.columnDefault === null || column.columnDefault === undefined ? null : String(column.columnDefault).slice(0, 512),
        column.columnComment || null,
        json([], []),
      ]
    );
  }

  return resourceId;
}

async function registerResources(items) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const ids = [];
    for (const item of items) {
      ids.push(await createResourceWithFields(connection, item));
    }
    await connection.commit();
    return ids;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateResource(id, payload) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE dm_resources
     SET table_comment = ?, resource_category = ?, business_tags_json = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.tableComment || null,
      payload.resourceCategory || null,
      json(payload.businessTags, []),
      payload.status,
      id,
      ...scoped.params,
    ]
  );
  return Number(result.affectedRows || 0) > 0 ? getResourceById(id) : null;
}

async function getResourceContent(resourceId) {
  const [rows] = await pool.query(
    `SELECT id, resource_id AS resourceId, business_name AS businessName,
            business_definition AS businessDefinition, business_grain AS businessGrain,
            update_frequency AS updateFrequency, data_owner AS dataOwner, tech_owner AS techOwner,
            usage_scenarios_json AS usageScenarios, usage_instruction AS usageInstruction,
            quality_note AS qualityNote, known_issues AS knownIssues, retention_period AS retentionPeriod,
            service_sla AS serviceSla, extension_json AS extension, updated_by AS updatedBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM dm_resource_contents
     WHERE resource_id = ?
     LIMIT 1`,
    [resourceId]
  );
  return rows[0] ? mapResourceContent(rows[0]) : null;
}

async function upsertResourceContent(resourceId, payload, userName) {
  await pool.query(
    `INSERT INTO dm_resource_contents
      (resource_id, business_name, business_definition, business_grain, update_frequency,
       data_owner, tech_owner, usage_scenarios_json, usage_instruction, quality_note,
       known_issues, retention_period, service_sla, extension_json, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       business_name = VALUES(business_name),
       business_definition = VALUES(business_definition),
       business_grain = VALUES(business_grain),
       update_frequency = VALUES(update_frequency),
       data_owner = VALUES(data_owner),
       tech_owner = VALUES(tech_owner),
       usage_scenarios_json = VALUES(usage_scenarios_json),
       usage_instruction = VALUES(usage_instruction),
       quality_note = VALUES(quality_note),
       known_issues = VALUES(known_issues),
       retention_period = VALUES(retention_period),
       service_sla = VALUES(service_sla),
       extension_json = VALUES(extension_json),
       updated_by = VALUES(updated_by)`,
    [
      resourceId,
      payload.businessName || null,
      payload.businessDefinition || null,
      payload.businessGrain || null,
      payload.updateFrequency || null,
      payload.dataOwner || null,
      payload.techOwner || null,
      json(payload.usageScenarios, []),
      payload.usageInstruction || null,
      payload.qualityNote || null,
      payload.knownIssues || null,
      payload.retentionPeriod || null,
      payload.serviceSla || null,
      json(payload.extension, {}),
      userName || "system",
    ]
  );
  return getResourceContent(resourceId);
}

async function getResourceProfile(resourceId) {
  const [rows] = await pool.query(
    `SELECT id, resource_id AS resourceId, profile_status AS profileStatus,
            sample_count AS sampleCount, row_count AS rowCount, column_count AS columnCount,
            nullable_field_count AS nullableFieldCount, primary_key_fields_json AS primaryKeyFields,
            time_range_json AS timeRange, quality_summary_json AS qualitySummary,
            profile_json AS profile, ai_summary AS aiSummary, ai_output_json AS aiOutput,
            ai_analyzed_at AS aiAnalyzedAt, error_message AS errorMessage,
            profiled_at AS profiledAt, created_at AS createdAt, updated_at AS updatedAt
     FROM dm_resource_profiles
     WHERE resource_id = ?
     LIMIT 1`,
    [resourceId]
  );
  return rows[0] ? mapResourceProfile(rows[0]) : null;
}

async function listResourceFieldProfiles(resourceId) {
  const [rows] = await pool.query(
    `SELECT id, resource_id AS resourceId, column_name AS columnName, null_rate AS nullRate,
            sample_values_json AS sampleValues,
            issue_tags_json AS issueTags, semantic_tags_json AS semanticTags,
            feature_tags_json AS featureTags,
            ai_business_name AS aiBusinessName, ai_business_meaning AS aiBusinessMeaning,
            ai_output_json AS aiOutput, created_at AS createdAt, updated_at AS updatedAt
     FROM dm_resource_field_profiles
     WHERE resource_id = ?
     ORDER BY id ASC`,
    [resourceId]
  );
  return rows.map(mapResourceFieldProfile);
}

async function replaceResourceProfile(resourceId, profile, fieldProfiles = []) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO dm_resource_profiles
        (resource_id, profile_status, sample_count, row_count, column_count, nullable_field_count,
         primary_key_fields_json, time_range_json, quality_summary_json, profile_json,
         error_message, profiled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         profile_status = VALUES(profile_status),
         sample_count = VALUES(sample_count),
         row_count = VALUES(row_count),
         column_count = VALUES(column_count),
         nullable_field_count = VALUES(nullable_field_count),
         primary_key_fields_json = VALUES(primary_key_fields_json),
         time_range_json = VALUES(time_range_json),
         quality_summary_json = VALUES(quality_summary_json),
         profile_json = VALUES(profile_json),
         error_message = VALUES(error_message),
         profiled_at = NOW()`,
      [
        resourceId,
        profile.profileStatus || "succeeded",
        Number(profile.sampleCount || 0),
        profile.rowCount ?? null,
        Number(profile.columnCount || 0),
        Number(profile.nullableFieldCount || 0),
        json(profile.primaryKeyFields, []),
        json(profile.timeRange, {}),
        json(profile.qualitySummary, {}),
        json(profile.profile, {}),
        profile.errorMessage || null,
      ]
    );
    await connection.query("DELETE FROM dm_resource_field_profiles WHERE resource_id = ?", [resourceId]);
    for (const item of fieldProfiles) {
      await connection.query(
        `INSERT INTO dm_resource_field_profiles
          (resource_id, column_name, null_rate, sample_values_json,
           issue_tags_json, semantic_tags_json, feature_tags_json, ai_business_name, ai_business_meaning, ai_output_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resourceId,
          item.columnName,
          item.nullRate ?? null,
          json(item.sampleValues, []),
          json(item.issueTags, []),
          json(item.semanticTags, []),
          json(item.featureTags, []),
          item.aiBusinessName || null,
          item.aiBusinessMeaning || null,
          item.aiOutput ? json(item.aiOutput, {}) : null,
        ]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return {
    profile: await getResourceProfile(resourceId),
    fieldProfiles: await listResourceFieldProfiles(resourceId),
  };
}

async function updateResourceProfileAi(resourceId, payload, fieldProfiles = []) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO dm_resource_profiles
        (resource_id, profile_status, ai_summary, ai_output_json, ai_analyzed_at, error_message)
       VALUES (?, ?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE
         profile_status = VALUES(profile_status),
         ai_summary = VALUES(ai_summary),
         ai_output_json = VALUES(ai_output_json),
         ai_analyzed_at = NOW(),
         error_message = VALUES(error_message)`,
      [
        resourceId,
        payload.profileStatus || "succeeded",
        payload.aiSummary || null,
        payload.aiOutput ? json(payload.aiOutput, {}) : null,
        payload.errorMessage || null,
      ]
    );
    for (const item of fieldProfiles) {
      await connection.query(
        `INSERT INTO dm_resource_field_profiles
          (resource_id, column_name, sample_values_json, issue_tags_json, semantic_tags_json,
           feature_tags_json, ai_business_name, ai_business_meaning, ai_output_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           issue_tags_json = VALUES(issue_tags_json),
           semantic_tags_json = VALUES(semantic_tags_json),
           feature_tags_json = VALUES(feature_tags_json),
           ai_business_name = VALUES(ai_business_name),
           ai_business_meaning = VALUES(ai_business_meaning),
           ai_output_json = VALUES(ai_output_json)`,
        [
          resourceId,
          item.columnName,
          json(item.sampleValues, []),
          json(item.issueTags, []),
          json(item.semanticTags, []),
          json(item.featureTags, []),
          item.aiBusinessName || null,
          item.aiBusinessMeaning || null,
          item.aiOutput ? json(item.aiOutput, {}) : null,
        ]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return {
    profile: await getResourceProfile(resourceId),
    fieldProfiles: await listResourceFieldProfiles(resourceId),
  };
}

async function updateResourceFieldProfilesAi(resourceId, fieldProfiles = []) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const item of fieldProfiles) {
      await connection.query(
        `INSERT INTO dm_resource_field_profiles
          (resource_id, column_name, sample_values_json, issue_tags_json, semantic_tags_json,
           feature_tags_json, ai_business_name, ai_business_meaning, ai_output_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           sample_values_json = VALUES(sample_values_json),
           issue_tags_json = VALUES(issue_tags_json),
           semantic_tags_json = VALUES(semantic_tags_json),
           feature_tags_json = VALUES(feature_tags_json),
           ai_business_name = VALUES(ai_business_name),
           ai_business_meaning = VALUES(ai_business_meaning),
           ai_output_json = VALUES(ai_output_json)`,
        [
          resourceId,
          item.columnName,
          json(item.sampleValues, []),
          json(item.issueTags, []),
          json(item.semanticTags, []),
          json(item.featureTags, []),
          item.aiBusinessName || null,
          item.aiBusinessMeaning || null,
          item.aiOutput ? json(item.aiOutput, {}) : null,
        ]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return {
    profile: await getResourceProfile(resourceId),
    fieldProfiles: await listResourceFieldProfiles(resourceId),
  };
}

async function replaceAiSuggestedFieldStandardMappings(resourceId, suggestions = [], createdBy = "system") {
  const projectId = getCurrentProjectId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [resourceRows] = await connection.query(
      `SELECT id, resource_code AS resourceCode, table_name AS tableName
       FROM dm_resources
       WHERE id = ?${projectId ? " AND project_id = ?" : ""}
       LIMIT 1`,
      [resourceId, ...(projectId ? [projectId] : [])]
    );
    const resource = resourceRows[0] ? {
      id: Number(resourceRows[0].id),
      resourceCode: resourceRows[0].resourceCode,
      tableName: resourceRows[0].tableName,
    } : null;
    if (!resource) {
      await connection.rollback();
      return;
    }

    const [fieldRows] = await connection.query(
      `SELECT column_name AS columnName, data_type AS dataType, column_type AS columnType,
              is_nullable AS isNullable, is_primary_key AS isPrimaryKey,
              column_comment AS columnComment, business_name AS businessName,
              semantic_tags_json AS semanticTags
       FROM dm_resource_fields
       WHERE resource_id = ?
       ORDER BY ordinal_position ASC, id ASC`,
      [resourceId]
    );
    const fields = fieldRows.map((row) => ({
      columnName: row.columnName,
      dataType: row.dataType || "",
      columnType: row.columnType || "",
      isNullable: Boolean(row.isNullable),
      isPrimaryKey: Boolean(row.isPrimaryKey),
      columnComment: row.columnComment || "",
      businessName: row.businessName || "",
      semanticTags: row.semanticTags,
    }));

    const [approvedRows] = await connection.query(
      `SELECT column_name AS columnName
       FROM std_field_mappings
       WHERE source_module = 'data_map'
         AND resource_id = ?
         AND table_name = ?
         AND mapping_status = 'approved'`,
      [resource.id, resource.tableName]
    );
    const approvedColumns = new Set(approvedRows.map((row) => row.columnName));
    const suggestionMap = new Map((Array.isArray(suggestions) ? suggestions : [])
      .filter((item) => item?.columnName)
      .map((item) => [String(item.columnName), item]));

    for (const field of fields) {
      if (approvedColumns.has(field.columnName)) {
        continue;
      }
      await connection.query(
        `UPDATE std_field_mappings
         SET mapping_status = 'deleted'
         WHERE source_module = 'data_map'
           AND resource_id = ?
           AND table_name = ?
           AND column_name = ?
           AND mapping_status <> 'deleted'
           AND mapping_status <> 'approved'`,
        [resource.id, resource.tableName, field.columnName]
      );
      const suggestion = suggestionMap.get(field.columnName);
      if (!suggestion?.elementId) {
        continue;
      }
      await connection.query(
        `INSERT INTO std_field_mappings
          (project_id, element_id, source_module, resource_id, resource_code, table_name, column_name,
           field_snapshot_json, mapping_status, confidence, evidence_json, created_by)
         VALUES (?, ?, 'data_map', ?, ?, ?, ?, ?, 'suggested', ?, ?, ?)`,
        [
          projectId,
          Number(suggestion.elementId),
          resource.id,
          resource.resourceCode,
          resource.tableName,
          field.columnName,
          json(buildFieldSnapshot(resource, field), {}),
          suggestion.confidence ?? null,
          json(suggestion.evidence, []),
          createdBy || "system",
        ]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteResource(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM dm_resources WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function deleteResources(ids = []) {
  const normalizedIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter(Boolean))];
  if (normalizedIds.length === 0) {
    return 0;
  }
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM dm_resources WHERE id IN (?)${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [normalizedIds, ...scoped.params]
  );
  return Number(result.affectedRows || 0);
}

async function replaceIngestionLineageEdges(edges) {
  const projectId = getCurrentProjectId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM dm_resource_lineage_edges WHERE lineage_type = 'ingestion'${projectId ? " AND project_id = ?" : ""}`,
      projectId ? [projectId] : []
    );
    for (const edge of edges) {
      await connection.query(
        `INSERT INTO dm_resource_lineage_edges
          (project_id, source_resource_id, target_resource_id, source_data_source_id, target_data_source_id,
           source_table_name, target_table_name, lineage_type, relation_level, relation_source,
           relation_source_id, confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ingestion', 'table', ?, ?, ?)`,
        [
          projectId,
          edge.sourceResourceId || null,
          edge.targetResourceId || null,
          edge.sourceDataSourceId || null,
          edge.targetDataSourceId || null,
          edge.sourceTableName,
          edge.targetTableName,
          edge.relationSource,
          edge.relationSourceId || null,
          edge.confidence || "high",
        ]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listLineageEdges(resourceId) {
  const scoped = getScopedWhere("e");
  const [rows] = await pool.query(
    `SELECT e.id, e.source_resource_id AS sourceResourceId, e.target_resource_id AS targetResourceId,
            e.source_data_source_id AS sourceDataSourceId, e.target_data_source_id AS targetDataSourceId,
            e.source_table_name AS sourceTableName, e.target_table_name AS targetTableName,
            sr.resource_code AS sourceResourceCode, tr.resource_code AS targetResourceCode,
            sds.source_name AS sourceName, tds.source_name AS targetName,
            e.lineage_type AS lineageType, e.relation_level AS relationLevel,
            e.relation_source AS relationSource, e.relation_source_id AS relationSourceId,
            e.confidence, e.created_at AS createdAt, e.updated_at AS updatedAt
     FROM dm_resource_lineage_edges e
     LEFT JOIN dm_resources sr ON sr.id = e.source_resource_id
     LEFT JOIN dm_resources tr ON tr.id = e.target_resource_id
     LEFT JOIN dm_data_sources sds ON sds.id = e.source_data_source_id
     LEFT JOIN dm_data_sources tds ON tds.id = e.target_data_source_id
     WHERE (e.source_resource_id = ? OR e.target_resource_id = ?)${scoped.sql ? ` AND ${scoped.sql}` : ""}
     ORDER BY e.updated_at DESC, e.id DESC`,
    [resourceId, resourceId, ...scoped.params]
  );
  return rows.map(mapLineageEdge);
}

async function listIngestionTaskLineageFacts() {
  const scoped = getScopedWhere("it");
  const [rows] = await pool.query(
    `SELECT it.id, it.source_id AS sourceId, it.source_table AS sourceTable,
            it.target_source_id AS targetSourceId, it.target_table AS targetTable,
            src.source_code AS sourceCode, tgt.source_code AS targetCode
     FROM ingestion_tasks it
     LEFT JOIN ingestion_data_sources src ON src.id = it.source_id
     LEFT JOIN ingestion_data_sources tgt ON tgt.id = it.target_source_id
     WHERE it.source_table IS NOT NULL
       AND it.target_table IS NOT NULL
       AND it.target_source_id IS NOT NULL${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    scoped.params
  );
  return rows.map((row) => ({
    id: Number(row.id),
    sourceId: Number(row.sourceId),
    sourceCode: row.sourceCode || "",
    sourceTable: row.sourceTable,
    targetSourceId: Number(row.targetSourceId),
    targetCode: row.targetCode || "",
    targetTable: row.targetTable,
  }));
}

async function listDataSourcesForLineage() {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, source_code AS sourceCode, source_ref_module AS sourceRefModule,
            source_ref_id AS sourceRefId, source_ref_code AS sourceRefCode
     FROM dm_data_sources${scoped.sql ? ` WHERE ${scoped.sql}` : ""}`,
    scoped.params
  );
  return rows.map((row) => ({
    id: Number(row.id),
    sourceCode: row.sourceCode || "",
    sourceRefModule: row.sourceRefModule || "",
    sourceRefId: toNumber(row.sourceRefId),
    sourceRefCode: row.sourceRefCode || "",
  }));
}

async function listResourcesForLineage() {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id, data_source_id AS dataSourceId, table_name AS tableName
     FROM dm_resources${scoped.sql ? ` WHERE ${scoped.sql}` : ""}`,
    scoped.params
  );
  return rows.map((row) => ({
    id: Number(row.id),
    dataSourceId: Number(row.dataSourceId),
    tableName: row.tableName,
  }));
}

async function getOverview() {
  const projectId = getCurrentProjectId();
  const whereSql = projectId ? "WHERE project_id = ?" : "";
  const params = projectId ? [projectId] : [];
  const [[departmentRows], [systemRows], [sourceRows], [catalogRows], [resourceRows], [lineageRows]] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total FROM dm_departments ${whereSql}`, params),
    pool.query(`SELECT COUNT(*) AS total FROM dm_business_systems ${whereSql}`, params),
    pool.query(`SELECT COUNT(*) AS total FROM dm_data_sources ${whereSql}`, params),
    pool.query(`SELECT COUNT(*) AS total FROM dm_catalogs ${whereSql}`, params),
    pool.query(`SELECT COUNT(*) AS total FROM dm_resources ${whereSql}`, params),
    pool.query(`SELECT COUNT(*) AS total FROM dm_resource_lineage_edges ${whereSql}`, params),
  ]);
  return {
    departments: Number(departmentRows[0]?.total || 0),
    businessSystems: Number(systemRows[0]?.total || 0),
    dataSources: Number(sourceRows[0]?.total || 0),
    catalogs: Number(catalogRows[0]?.total || 0),
    resources: Number(resourceRows[0]?.total || 0),
    lineageEdges: Number(lineageRows[0]?.total || 0),
  };
}

async function listAiConfigs() {
  const [rows] = await pool.query(
    `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.user_prompt_template AS userPromptTemplate,
            c.output_schema_json AS outputSchema, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM dm_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     ORDER BY CASE c.scene_code
       WHEN 'resource_content_profile' THEN 1
       WHEN 'resource_field_profile' THEN 2
       ELSE 99
     END, c.id DESC`
  );
  return rows.map(mapAiConfig);
}

async function getAiConfigById(id) {
  const [rows] = await pool.query(
    `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.user_prompt_template AS userPromptTemplate,
            c.output_schema_json AS outputSchema, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM dm_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     WHERE c.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ? mapAiConfig(rows[0]) : null;
}

async function getAiConfigByCode(sceneCode) {
  const [rows] = await pool.query(
    `SELECT id, scene_name AS sceneName, scene_code AS sceneCode,
            default_model_provider_id AS defaultModelProviderId,
            default_model_name AS defaultModelName, default_model_version AS defaultModelVersion,
            temperature, max_tokens AS maxTokens, timeout_ms AS timeoutMs,
            system_prompt AS systemPrompt, user_prompt_template AS userPromptTemplate,
            output_schema_json AS outputSchema, description, owner_name AS ownerName,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM dm_ai_configs
     WHERE scene_code = ?
     LIMIT 1`,
    [sceneCode]
  );
  return rows[0] ? mapAiConfig(rows[0]) : null;
}

async function updateAiConfig(id, payload) {
  const [result] = await pool.query(
    `UPDATE dm_ai_configs
     SET scene_name = ?, scene_code = ?, default_model_provider_id = ?, default_model_name = ?,
         default_model_version = ?, temperature = ?, max_tokens = ?, timeout_ms = ?,
         system_prompt = ?, user_prompt_template = ?, output_schema_json = ?,
         description = ?, owner_name = ?, status = ?
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
      payload.systemPrompt || null,
      payload.userPromptTemplate || null,
      json(payload.outputSchema, {}),
      payload.description || null,
      payload.ownerName || "System Administrator",
      payload.status,
      id,
    ]
  );
  return Number(result.affectedRows || 0) > 0 ? getAiConfigById(id) : null;
}

module.exports = {
  createBusinessSystem,
  createCatalog,
  createDataSource,
  createDepartment,
  deleteBusinessSystem,
  deleteCatalog,
  deleteDataSource,
  deleteDepartment,
  deleteResource,
  deleteResources,
  getBusinessSystemById,
  getCatalogById,
  getDataSourceById,
  getDepartmentById,
  getAiConfigByCode,
  getAiConfigById,
  getOverview,
  getResourceContent,
  getResourceById,
  getResourceProfile,
  getResourceBySourceAndTable,
  getStandardDataElementById,
  listAiConfigs,
  listBusinessSystems,
  listCatalogs,
  listDataSources,
  listDataSourcesForLineage,
  listDepartments,
  listIngestionTaskLineageFacts,
  listLineageEdges,
  listResourceFieldProfiles,
  listResourceFields,
  listResources,
  listResourcesForLineage,
  listStandardDataElementsForMatching,
  registerResources,
  replaceResourceProfile,
  replaceAiSuggestedFieldStandardMappings,
  replaceIngestionLineageEdges,
  searchResources,
  updateAiConfig,
  updateBusinessSystem,
  updateCatalog,
  updateDataSource,
  updateDepartment,
  updateResourceFieldMetadata,
  updateResourceFieldProfilesAi,
  updateResourceProfileAi,
  upsertResourceContent,
  updateResource,
};
