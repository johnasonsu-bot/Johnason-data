const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");

function addProjectCondition(where, params, alias = "") {
  const projectId = getCurrentProjectId();
  if (!projectId) return null;
  const prefix = alias ? `${alias}.` : "";
  where.push(`${prefix}project_id = ?`);
  params.push(projectId);
  return projectId;
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

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function nullableDate(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 10) : null;
}

const elementStandardPrefixes = {
  national: "GB",
  industry: "HB",
  enterprise: "QB",
};
const elementCodeSerialDigits = 5;

const elementStandardRegexps = {
  national: "^GB[0-9]{4,5}$",
  industry: "^HB[0-9]{5}$",
  enterprise: "^QB[0-9]{5}$",
};

function inferElementStandardType(elementCode) {
  const prefix = String(elementCode || "").trim().slice(0, 2).toUpperCase();
  if (prefix === "GB") return "national";
  if (prefix === "HB") return "industry";
  if (prefix === "QB") return "enterprise";
  return "enterprise";
}

function mapCatalog(row) {
  return {
    id: Number(row.id),
    parentId: toNumber(row.parentId),
    parentName: row.parentName || null,
    catalogName: row.catalogName,
    catalogCode: row.catalogCode,
    catalogType: row.catalogType,
    ownerName: row.ownerName || "",
    description: row.description || "",
    sortOrder: Number(row.sortOrder || 0),
    status: row.status,
    elementCount: Number(row.elementCount || 0),
    nationalElementCount: Number(row.nationalElementCount || 0),
    industryElementCount: Number(row.industryElementCount || 0),
    enterpriseElementCount: Number(row.enterpriseElementCount || 0),
    createdBy: row.createdBy || "system",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapReferenceStandard(row) {
  return {
    id: Number(row.id),
    standardCode: row.standardCode,
    standardName: row.standardName,
    standardType: row.standardType,
    standardNo: row.standardNo || "",
    publisher: row.publisher || "",
    effectiveDate: row.effectiveDate || null,
    standardUrl: row.standardUrl || "",
    description: row.description || "",
    status: row.status,
    elementCount: Number(row.elementCount || 0),
    valueDomainCount: Number(row.valueDomainCount || 0),
    createdBy: row.createdBy || "system",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapValueDomain(row) {
  return {
    id: Number(row.id),
    domainCode: row.domainCode,
    domainName: row.domainName,
    domainType: row.domainType,
    valueType: row.valueType,
    dataType: row.dataType || "",
    minValue: row.minValue === null || row.minValue === undefined ? null : Number(row.minValue),
    maxValue: row.maxValue === null || row.maxValue === undefined ? null : Number(row.maxValue),
    regexPattern: row.regexPattern || "",
    formatPattern: row.formatPattern || "",
    unit: row.unit || "",
    referenceStandardId: toNumber(row.referenceStandardId),
    referenceStandardName: row.referenceStandardName || "",
    referenceClause: row.referenceClause || "",
    description: row.description || "",
    status: row.status,
    itemCount: Number(row.itemCount || 0),
    elementCount: Number(row.elementCount || 0),
    createdBy: row.createdBy || "system",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapValueDomainItem(row) {
  return {
    id: Number(row.id),
    domainId: Number(row.domainId),
    itemCode: row.itemCode,
    itemLabel: row.itemLabel,
    itemValue: row.itemValue || "",
    itemMeaning: row.itemMeaning || "",
    sortOrder: Number(row.sortOrder || 0),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapElement(row) {
  return {
    id: Number(row.id),
    standardType: inferElementStandardType(row.elementCode),
    elementIdentifier: row.elementIdentifier,
    elementCode: row.elementCode,
    elementNameCn: row.elementNameCn,
    elementNameEn: row.elementNameEn || "",
    catalogId: toNumber(row.catalogId),
    catalogName: row.catalogName || "",
    catalogCode: row.catalogCode || "",
    objectClass: row.objectClass || "",
    propertyName: row.propertyName || "",
    representationTerm: row.representationTerm || "",
    qualifiers: parseJson(row.qualifiers, []),
    definition: row.definition || "",
    dataType: row.dataType || "string",
    maxLength: toNumber(row.maxLength),
    numericPrecision: toNumber(row.numericPrecision),
    numericScale: toNumber(row.numericScale),
    datetimePrecision: row.datetimePrecision || "",
    formatPattern: row.formatPattern || "",
    unit: row.unit || "",
    valueDomainId: toNumber(row.valueDomainId),
    valueDomainName: row.valueDomainName || "",
    valueDomainCode: row.valueDomainCode || "",
    referenceStandardId: toNumber(row.referenceStandardId),
    referenceStandardName: row.referenceStandardName || "",
    referenceClause: row.referenceClause || "",
    aliases: parseJson(row.aliases, []),
    tags: parseJson(row.tags, []),
    ownerName: row.ownerName || "",
    stewardName: row.stewardName || "",
    lifecycleStatus: row.lifecycleStatus || "draft",
    currentVersionNo: Number(row.currentVersionNo || 1),
    status: row.status || "active",
    mappingCount: Number(row.mappingCount || 0),
    createdBy: row.createdBy || "system",
    publishedAt: row.publishedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapElementVersion(row) {
  return {
    id: Number(row.id),
    elementId: Number(row.elementId),
    versionNo: Number(row.versionNo),
    versionStatus: row.versionStatus,
    snapshot: parseJson(row.snapshot, {}),
    changeSummary: row.changeSummary || "",
    createdBy: row.createdBy || "system",
    publishedAt: row.publishedAt || null,
    createdAt: row.createdAt,
  };
}

function mapAiConfig(row) {
  return {
    id: Number(row.id),
    sceneName: row.sceneName,
    sceneCode: row.sceneCode,
    defaultModelProviderId: toNumber(row.defaultModelProviderId),
    defaultModelProviderName: row.defaultModelProviderName || "",
    defaultModelName: row.defaultModelName || "",
    defaultModelVersion: row.defaultModelVersion || "",
    temperature: row.temperature === null || row.temperature === undefined ? null : Number(row.temperature),
    maxTokens: toNumber(row.maxTokens),
    timeoutMs: toNumber(row.timeoutMs),
    systemPrompt: row.systemPrompt || "",
    userPromptTemplate: row.userPromptTemplate || "",
    outputSchema: parseJson(row.outputSchema, {}),
    description: row.description || "",
    ownerName: row.ownerName || "system",
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function withTransaction(handler) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listCatalogs() {
  const projectId = getCurrentProjectId();
  const [rows] = await pool.query(
    `WITH RECURSIVE catalog_descendants AS (
       SELECT id AS ancestor_id, id AS descendant_id
       FROM std_catalogs
       WHERE status <> 'deleted'
       UNION ALL
       SELECT cd.ancestor_id, child.id AS descendant_id
       FROM catalog_descendants cd
       JOIN std_catalogs child ON child.parent_id = cd.descendant_id AND child.status <> 'deleted'
     )
     SELECT c.id, c.parent_id AS parentId, p.catalog_name AS parentName,
            c.catalog_name AS catalogName, c.catalog_code AS catalogCode, c.catalog_type AS catalogType,
            c.owner_name AS ownerName, c.description, c.sort_order AS sortOrder, c.status,
            c.created_by AS createdBy, c.created_at AS createdAt, c.updated_at AS updatedAt,
            COUNT(DISTINCT e.id) AS elementCount,
            COUNT(DISTINCT CASE WHEN e.element_code REGEXP '${elementStandardRegexps.national}' THEN e.id END) AS nationalElementCount,
            COUNT(DISTINCT CASE WHEN e.element_code REGEXP '${elementStandardRegexps.industry}' THEN e.id END) AS industryElementCount,
            COUNT(DISTINCT CASE WHEN e.element_code REGEXP '${elementStandardRegexps.enterprise}' THEN e.id END) AS enterpriseElementCount
     FROM std_catalogs c
     LEFT JOIN std_catalogs p ON p.id = c.parent_id
     LEFT JOIN catalog_descendants cd ON cd.ancestor_id = c.id
     LEFT JOIN std_data_elements e ON e.catalog_id = cd.descendant_id AND e.status <> 'deleted'
     WHERE c.status <> 'deleted'${projectId ? " AND c.project_id = ?" : ""}
     GROUP BY c.id, p.catalog_name
     ORDER BY c.sort_order ASC, c.id ASC`,
    projectId ? [projectId] : [],
  );
  return rows.map(mapCatalog);
}

async function getCatalogById(id) {
  const projectId = getCurrentProjectId();
  const [rows] = await pool.query(
    `WITH RECURSIVE catalog_descendants AS (
       SELECT id AS ancestor_id, id AS descendant_id
       FROM std_catalogs
       WHERE status <> 'deleted'
       UNION ALL
       SELECT cd.ancestor_id, child.id AS descendant_id
       FROM catalog_descendants cd
       JOIN std_catalogs child ON child.parent_id = cd.descendant_id AND child.status <> 'deleted'
     )
     SELECT c.id, c.parent_id AS parentId, p.catalog_name AS parentName,
            c.catalog_name AS catalogName, c.catalog_code AS catalogCode, c.catalog_type AS catalogType,
            c.owner_name AS ownerName, c.description, c.sort_order AS sortOrder, c.status,
            c.created_by AS createdBy, c.created_at AS createdAt, c.updated_at AS updatedAt,
            COUNT(DISTINCT e.id) AS elementCount,
            COUNT(DISTINCT CASE WHEN e.element_code REGEXP '${elementStandardRegexps.national}' THEN e.id END) AS nationalElementCount,
            COUNT(DISTINCT CASE WHEN e.element_code REGEXP '${elementStandardRegexps.industry}' THEN e.id END) AS industryElementCount,
            COUNT(DISTINCT CASE WHEN e.element_code REGEXP '${elementStandardRegexps.enterprise}' THEN e.id END) AS enterpriseElementCount
     FROM std_catalogs c
     LEFT JOIN std_catalogs p ON p.id = c.parent_id
     LEFT JOIN catalog_descendants cd ON cd.ancestor_id = c.id
     LEFT JOIN std_data_elements e ON e.catalog_id = cd.descendant_id AND e.status <> 'deleted'
     WHERE c.id = ? AND c.status <> 'deleted'${projectId ? " AND c.project_id = ?" : ""}
     GROUP BY c.id, p.catalog_name
     LIMIT 1`,
    projectId ? [id, projectId] : [id]
  );
  return rows[0] ? mapCatalog(rows[0]) : null;
}

async function createCatalog(payload, userName) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO std_catalogs
      (project_id, parent_id, catalog_name, catalog_code, catalog_type, owner_name, description, sort_order, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.parentId || null,
      payload.catalogName,
      payload.catalogCode,
      payload.catalogType || "business_domain",
      payload.ownerName || null,
      payload.description || null,
      Number(payload.sortOrder || 0),
      payload.status || "active",
      userName || "system",
    ]
  );
  return getCatalogById(result.insertId);
}

async function updateCatalog(id, payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `UPDATE std_catalogs
     SET parent_id = ?, catalog_name = ?, catalog_code = ?, catalog_type = ?, owner_name = ?,
         description = ?, sort_order = ?, status = ?
     WHERE id = ? AND status <> 'deleted'${projectId ? " AND project_id = ?" : ""}`,
    [
      payload.parentId || null,
      payload.catalogName,
      payload.catalogCode,
      payload.catalogType || "business_domain",
      payload.ownerName || null,
      payload.description || null,
      Number(payload.sortOrder || 0),
      payload.status || "active",
      id,
      ...(projectId ? [projectId] : []),
    ]
  );
  if (!result.affectedRows) return null;
  return getCatalogById(id);
}

async function deleteCatalog(id) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(`UPDATE std_catalogs SET status = 'deleted' WHERE id = ?${projectId ? " AND project_id = ?" : ""}`, projectId ? [id, projectId] : [id]);
  return Number(result.affectedRows || 0) > 0;
}

async function listReferenceStandards(filters = {}) {
  const where = ["s.status <> 'deleted'"];
  const params = [];
  if (filters.keyword) {
    where.push("(s.standard_code LIKE ? OR s.standard_name LIKE ? OR s.standard_no LIKE ?)");
    const keyword = `%${String(filters.keyword).trim()}%`;
    params.push(keyword, keyword, keyword);
  }
  if (filters.standardType) {
    where.push("s.standard_type = ?");
    params.push(String(filters.standardType));
  }
  addProjectCondition(where, params, "s");

  const [rows] = await pool.query(
    `SELECT s.id, s.standard_code AS standardCode, s.standard_name AS standardName,
            s.standard_type AS standardType, s.standard_no AS standardNo, s.publisher,
            s.effective_date AS effectiveDate, s.standard_url AS standardUrl, s.description, s.status,
            s.created_by AS createdBy, s.created_at AS createdAt, s.updated_at AS updatedAt,
            COUNT(DISTINCT e.id) AS elementCount, COUNT(DISTINCT vd.id) AS valueDomainCount
     FROM std_reference_standards s
     LEFT JOIN std_data_elements e ON e.reference_standard_id = s.id AND e.status <> 'deleted'
     LEFT JOIN std_value_domains vd ON vd.reference_standard_id = s.id AND vd.status <> 'deleted'
     WHERE ${where.join(" AND ")}
     GROUP BY s.id
     ORDER BY s.updated_at DESC, s.id DESC`,
    params
  );
  return rows.map(mapReferenceStandard);
}

async function getReferenceStandardById(id) {
  const rows = await listReferenceStandards({});
  return rows.find((item) => item.id === Number(id)) || null;
}

async function createReferenceStandard(payload, userName) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO std_reference_standards
      (project_id, standard_code, standard_name, standard_type, standard_no, publisher, effective_date, standard_url, description, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.standardCode,
      payload.standardName,
      payload.standardType || "enterprise",
      payload.standardNo || null,
      payload.publisher || null,
      nullableDate(payload.effectiveDate),
      payload.standardUrl || null,
      payload.description || null,
      payload.status || "active",
      userName || "system",
    ]
  );
  return getReferenceStandardById(result.insertId);
}

async function updateReferenceStandard(id, payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `UPDATE std_reference_standards
     SET standard_code = ?, standard_name = ?, standard_type = ?, standard_no = ?, publisher = ?,
         effective_date = ?, standard_url = ?, description = ?, status = ?
     WHERE id = ? AND status <> 'deleted'${projectId ? " AND project_id = ?" : ""}`,
    [
      payload.standardCode,
      payload.standardName,
      payload.standardType || "enterprise",
      payload.standardNo || null,
      payload.publisher || null,
      nullableDate(payload.effectiveDate),
      payload.standardUrl || null,
      payload.description || null,
      payload.status || "active",
      id,
      ...(projectId ? [projectId] : []),
    ]
  );
  if (!result.affectedRows) return null;
  return getReferenceStandardById(id);
}

async function deleteReferenceStandard(id) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(`UPDATE std_reference_standards SET status = 'deleted' WHERE id = ?${projectId ? " AND project_id = ?" : ""}`, projectId ? [id, projectId] : [id]);
  return Number(result.affectedRows || 0) > 0;
}

async function listValueDomains(filters = {}) {
  const where = ["vd.status <> 'deleted'"];
  const params = [];
  if (filters.keyword) {
    where.push("(vd.domain_code LIKE ? OR vd.domain_name LIKE ?)");
    const keyword = `%${String(filters.keyword).trim()}%`;
    params.push(keyword, keyword);
  }
  if (filters.domainType) {
    where.push("vd.domain_type = ?");
    params.push(String(filters.domainType));
  }
  addProjectCondition(where, params, "vd");

  const [rows] = await pool.query(
    `SELECT vd.id, vd.domain_code AS domainCode, vd.domain_name AS domainName,
            vd.domain_type AS domainType, vd.value_type AS valueType, vd.data_type AS dataType,
            vd.min_value AS \`minValue\`, vd.max_value AS \`maxValue\`, vd.regex_pattern AS regexPattern,
            vd.format_pattern AS formatPattern, vd.unit, vd.reference_standard_id AS referenceStandardId,
            rs.standard_name AS referenceStandardName, vd.reference_clause AS referenceClause,
            vd.description, vd.status, vd.created_by AS createdBy, vd.created_at AS createdAt, vd.updated_at AS updatedAt,
            COUNT(DISTINCT vi.id) AS itemCount, COUNT(DISTINCT e.id) AS elementCount
     FROM std_value_domains vd
     LEFT JOIN std_reference_standards rs ON rs.id = vd.reference_standard_id
     LEFT JOIN std_value_domain_items vi ON vi.domain_id = vd.id AND vi.status <> 'deleted'
     LEFT JOIN std_data_elements e ON e.value_domain_id = vd.id AND e.status <> 'deleted'
     WHERE ${where.join(" AND ")}
     GROUP BY vd.id, rs.standard_name
     ORDER BY vd.updated_at DESC, vd.id DESC`,
    params
  );
  return rows.map(mapValueDomain);
}

async function getValueDomainById(id) {
  const projectId = getCurrentProjectId();
  const [rows] = await pool.query(
    `SELECT vd.id, vd.domain_code AS domainCode, vd.domain_name AS domainName,
            vd.domain_type AS domainType, vd.value_type AS valueType, vd.data_type AS dataType,
            vd.min_value AS \`minValue\`, vd.max_value AS \`maxValue\`, vd.regex_pattern AS regexPattern,
            vd.format_pattern AS formatPattern, vd.unit, vd.reference_standard_id AS referenceStandardId,
            rs.standard_name AS referenceStandardName, vd.reference_clause AS referenceClause,
            vd.description, vd.status, vd.created_by AS createdBy, vd.created_at AS createdAt, vd.updated_at AS updatedAt,
            COUNT(DISTINCT vi.id) AS itemCount, COUNT(DISTINCT e.id) AS elementCount
     FROM std_value_domains vd
     LEFT JOIN std_reference_standards rs ON rs.id = vd.reference_standard_id
     LEFT JOIN std_value_domain_items vi ON vi.domain_id = vd.id AND vi.status <> 'deleted'
     LEFT JOIN std_data_elements e ON e.value_domain_id = vd.id AND e.status <> 'deleted'
     WHERE vd.id = ? AND vd.status <> 'deleted'${projectId ? " AND vd.project_id = ?" : ""}
     GROUP BY vd.id, rs.standard_name
     LIMIT 1`,
    projectId ? [id, projectId] : [id]
  );
  if (!rows[0]) return null;

  const [itemRows] = await pool.query(
    `SELECT id, domain_id AS domainId, item_code AS itemCode, item_label AS itemLabel,
            item_value AS itemValue, item_meaning AS itemMeaning, sort_order AS sortOrder,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM std_value_domain_items
     WHERE domain_id = ? AND status <> 'deleted'${projectId ? " AND project_id = ?" : ""}
     ORDER BY sort_order ASC, id ASC`,
    projectId ? [id, projectId] : [id]
  );

  return {
    ...mapValueDomain(rows[0]),
    items: itemRows.map(mapValueDomainItem),
  };
}

async function replaceValueDomainItems(domainId, items, db = pool) {
  const projectId = getCurrentProjectId();
  await db.query(`DELETE FROM std_value_domain_items WHERE domain_id = ?${projectId ? " AND project_id = ?" : ""}`, projectId ? [domainId, projectId] : [domainId]);
  for (const item of items || []) {
    await db.query(
      `INSERT INTO std_value_domain_items
        (project_id, domain_id, item_code, item_label, item_value, item_meaning, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        domainId,
        item.itemCode,
        item.itemLabel,
        item.itemValue || null,
        item.itemMeaning || null,
        Number(item.sortOrder || 0),
        item.status || "active",
      ]
    );
  }
}

async function createValueDomain(payload, userName) {
  const projectId = getCurrentProjectId();
  const domainId = await withTransaction(async (db) => {
    const [result] = await db.query(
      `INSERT INTO std_value_domains
        (project_id, domain_code, domain_name, domain_type, value_type, data_type, min_value, max_value, regex_pattern,
         format_pattern, unit, reference_standard_id, reference_clause, description, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        payload.domainCode,
        payload.domainName,
        payload.domainType || "enumeration",
        payload.valueType || "string",
        payload.dataType || null,
        payload.minValue ?? null,
        payload.maxValue ?? null,
        payload.regexPattern || null,
        payload.formatPattern || null,
        payload.unit || null,
        payload.referenceStandardId || null,
        payload.referenceClause || null,
        payload.description || null,
        payload.status || "active",
        userName || "system",
      ]
    );
    await replaceValueDomainItems(result.insertId, payload.items || [], db);
    return result.insertId;
  });
  return getValueDomainById(domainId);
}

async function updateValueDomain(id, payload) {
  const projectId = getCurrentProjectId();
  const updated = await withTransaction(async (db) => {
    const [result] = await db.query(
      `UPDATE std_value_domains
       SET domain_code = ?, domain_name = ?, domain_type = ?, value_type = ?, data_type = ?,
           min_value = ?, max_value = ?, regex_pattern = ?, format_pattern = ?, unit = ?,
           reference_standard_id = ?, reference_clause = ?, description = ?, status = ?
       WHERE id = ? AND status <> 'deleted'${projectId ? " AND project_id = ?" : ""}`,
      [
        payload.domainCode,
        payload.domainName,
        payload.domainType || "enumeration",
        payload.valueType || "string",
        payload.dataType || null,
        payload.minValue ?? null,
        payload.maxValue ?? null,
        payload.regexPattern || null,
        payload.formatPattern || null,
        payload.unit || null,
        payload.referenceStandardId || null,
        payload.referenceClause || null,
        payload.description || null,
        payload.status || "active",
        id,
        ...(projectId ? [projectId] : []),
      ]
    );
    if (!result.affectedRows) return false;
    await replaceValueDomainItems(id, payload.items || [], db);
    return true;
  });
  return updated ? getValueDomainById(id) : null;
}

async function deleteValueDomain(id) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(`UPDATE std_value_domains SET status = 'deleted' WHERE id = ?${projectId ? " AND project_id = ?" : ""}`, projectId ? [id, projectId] : [id]);
  return Number(result.affectedRows || 0) > 0;
}

function buildElementSelect() {
  return `SELECT e.id, e.element_identifier AS elementIdentifier, e.element_code AS elementCode,
            e.element_name_cn AS elementNameCn, e.element_name_en AS elementNameEn,
            e.catalog_id AS catalogId, c.catalog_name AS catalogName, c.catalog_code AS catalogCode,
            e.object_class AS objectClass, e.property_name AS propertyName, e.representation_term AS representationTerm,
            e.qualifiers_json AS qualifiers, e.definition, e.data_type AS dataType, e.max_length AS maxLength,
            e.numeric_precision_value AS numericPrecision, e.numeric_scale_value AS numericScale,
            e.datetime_precision AS datetimePrecision, e.format_pattern AS formatPattern, e.unit,
            e.value_domain_id AS valueDomainId, vd.domain_name AS valueDomainName, vd.domain_code AS valueDomainCode,
            e.reference_standard_id AS referenceStandardId, rs.standard_name AS referenceStandardName,
            e.reference_clause AS referenceClause, e.aliases_json AS aliases, e.tags_json AS tags,
            e.owner_name AS ownerName, e.steward_name AS stewardName, e.lifecycle_status AS lifecycleStatus,
            e.current_version_no AS currentVersionNo, e.status, e.created_by AS createdBy,
            e.published_at AS publishedAt, e.created_at AS createdAt, e.updated_at AS updatedAt,
            COUNT(DISTINCT fm.id) AS mappingCount
     FROM std_data_elements e
     LEFT JOIN std_catalogs c ON c.id = e.catalog_id
     LEFT JOIN std_value_domains vd ON vd.id = e.value_domain_id
     LEFT JOIN std_reference_standards rs ON rs.id = e.reference_standard_id
     LEFT JOIN std_field_mappings fm ON fm.element_id = e.id AND fm.mapping_status <> 'deleted'`;
}

async function listDataElements(filters = {}) {
  const where = ["e.status <> 'deleted'"];
  const params = [];
  if (filters.keyword) {
    where.push("(e.element_code LIKE ? OR e.element_name_cn LIKE ? OR e.element_name_en LIKE ? OR e.element_identifier LIKE ? OR e.definition LIKE ?)");
    const keyword = `%${String(filters.keyword).trim()}%`;
    params.push(keyword, keyword, keyword, keyword, keyword);
  }
  if (filters.catalogId) {
    where.push("e.catalog_id = ?");
    params.push(Number(filters.catalogId));
  }
  if (filters.lifecycleStatus) {
    where.push("e.lifecycle_status = ?");
    params.push(String(filters.lifecycleStatus));
  }
  if (filters.standardType && elementStandardPrefixes[String(filters.standardType)]) {
    const regexp = elementStandardRegexps[String(filters.standardType)];
    where.push("e.element_code REGEXP ?");
    params.push(regexp);
  }
  addProjectCondition(where, params, "e");

  const [rows] = await pool.query(
    `${buildElementSelect()}
     WHERE ${where.join(" AND ")}
     GROUP BY e.id, c.catalog_name, c.catalog_code, vd.domain_name, vd.domain_code, rs.standard_name
     ORDER BY e.updated_at DESC, e.id DESC`,
    params
  );
  return rows.map(mapElement);
}

async function getNextElementCode(standardType = "enterprise") {
  const projectId = getCurrentProjectId();
  const prefix = elementStandardPrefixes[String(standardType)] || elementStandardPrefixes.enterprise;
  const [[row]] = await pool.query(
    `SELECT MAX(CAST(SUBSTRING(element_code, 3) AS UNSIGNED)) AS maxNo
     FROM std_data_elements
     WHERE element_code REGEXP ?${projectId ? " AND project_id = ?" : ""}`,
    projectId ? [`^${prefix}[0-9]{4,${elementCodeSerialDigits}}$`, projectId] : [`^${prefix}[0-9]{4,${elementCodeSerialDigits}}$`]
  );
  const currentNo = Number(row?.maxNo || 0);
  return `${prefix}${String(currentNo + 1).padStart(elementCodeSerialDigits, "0")}`;
}

async function listDataElementIdentityKeys() {
  const projectId = getCurrentProjectId();
  const [rows] = await pool.query(
    `SELECT id, element_code AS elementCode, element_identifier AS elementIdentifier, status
     FROM std_data_elements${projectId ? " WHERE project_id = ?" : ""}`,
    projectId ? [projectId] : [],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    elementCode: row.elementCode,
    elementIdentifier: row.elementIdentifier,
    status: row.status,
  }));
}

async function getDataElementById(id) {
  const projectId = getCurrentProjectId();
  const [rows] = await pool.query(
    `${buildElementSelect()}
     WHERE e.id = ? AND e.status <> 'deleted'${projectId ? " AND e.project_id = ?" : ""}
     GROUP BY e.id, c.catalog_name, c.catalog_code, vd.domain_name, vd.domain_code, rs.standard_name
     LIMIT 1`,
    projectId ? [id, projectId] : [id]
  );
  return rows[0] ? mapElement(rows[0]) : null;
}

function buildElementSnapshot(element) {
  return {
    elementIdentifier: element.elementIdentifier,
    elementCode: element.elementCode,
    elementNameCn: element.elementNameCn,
    elementNameEn: element.elementNameEn,
    catalogId: element.catalogId,
    objectClass: element.objectClass,
    propertyName: element.propertyName,
    representationTerm: element.representationTerm,
    qualifiers: element.qualifiers,
    definition: element.definition,
    dataType: element.dataType,
    maxLength: element.maxLength,
    numericPrecision: element.numericPrecision,
    numericScale: element.numericScale,
    datetimePrecision: element.datetimePrecision,
    formatPattern: element.formatPattern,
    unit: element.unit,
    valueDomainId: element.valueDomainId,
    referenceStandardId: element.referenceStandardId,
    referenceClause: element.referenceClause,
    aliases: element.aliases,
    tags: element.tags,
    ownerName: element.ownerName,
    stewardName: element.stewardName,
    lifecycleStatus: element.lifecycleStatus,
    status: element.status,
  };
}

async function upsertElementVersion(elementId, versionNo, versionStatus, snapshot, options = {}, db = pool) {
  const projectId = getCurrentProjectId();
  await db.query(
    `INSERT INTO std_data_element_versions
      (project_id, element_id, version_no, version_status, snapshot_json, change_summary, created_by, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      version_status = VALUES(version_status),
      snapshot_json = VALUES(snapshot_json),
      change_summary = VALUES(change_summary),
      created_by = VALUES(created_by),
      published_at = VALUES(published_at)`,
    [
      projectId,
      elementId,
      versionNo,
      versionStatus,
      JSON.stringify(snapshot),
      options.changeSummary || null,
      options.createdBy || "system",
      options.publishedAt || null,
    ]
  );
}

async function listElementVersions(elementId) {
  const projectId = getCurrentProjectId();
  const [rows] = await pool.query(
    `SELECT id, element_id AS elementId, version_no AS versionNo, version_status AS versionStatus,
            snapshot_json AS snapshot, change_summary AS changeSummary, created_by AS createdBy,
            published_at AS publishedAt, created_at AS createdAt
     FROM std_data_element_versions
     WHERE element_id = ?${projectId ? " AND project_id = ?" : ""}
     ORDER BY version_no DESC`,
    projectId ? [elementId, projectId] : [elementId]
  );
  return rows.map(mapElementVersion);
}

async function getDataElementDetail(id) {
  const element = await getDataElementById(id);
  if (!element) return null;
  const versions = await listElementVersions(id);
  return { ...element, versions };
}

async function createDataElement(payload, userName) {
  const projectId = getCurrentProjectId();
  const elementId = await withTransaction(async (db) => {
    const [result] = await db.query(
      `INSERT INTO std_data_elements
        (project_id, element_identifier, element_code, element_name_cn, element_name_en, catalog_id,
         object_class, property_name, representation_term, qualifiers_json, definition,
         data_type, max_length, numeric_precision_value, numeric_scale_value, datetime_precision,
         format_pattern, unit, value_domain_id, reference_standard_id, reference_clause,
         aliases_json, tags_json, owner_name, steward_name, lifecycle_status, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        payload.elementIdentifier,
        payload.elementCode,
        payload.elementNameCn,
        payload.elementNameEn || null,
        payload.catalogId || null,
        payload.objectClass || null,
        payload.propertyName || null,
        payload.representationTerm || null,
        JSON.stringify(payload.qualifiers || []),
        payload.definition || null,
        payload.dataType || "string",
        payload.maxLength ?? null,
        payload.numericPrecision ?? null,
        payload.numericScale ?? null,
        payload.datetimePrecision || null,
        payload.formatPattern || null,
        payload.unit || null,
        payload.valueDomainId || null,
        payload.referenceStandardId || null,
        payload.referenceClause || null,
        JSON.stringify(payload.aliases || []),
        JSON.stringify(payload.tags || []),
        payload.ownerName || null,
        payload.stewardName || null,
        payload.lifecycleStatus || "draft",
        payload.status || "active",
        userName || "system",
      ]
    );

    const snapshot = {
      ...payload,
      catalogId: payload.catalogId || null,
      valueDomainId: payload.valueDomainId || null,
      referenceStandardId: payload.referenceStandardId || null,
      lifecycleStatus: payload.lifecycleStatus || "draft",
      status: payload.status || "active",
    };
    await upsertElementVersion(result.insertId, 1, snapshot.lifecycleStatus === "published" ? "published" : "draft", snapshot, {
      createdBy: userName || "system",
      publishedAt: snapshot.lifecycleStatus === "published" ? new Date() : null,
    }, db);
    return result.insertId;
  });
  return getDataElementDetail(elementId);
}

async function updateDataElement(id, payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `UPDATE std_data_elements
     SET element_identifier = ?, element_code = ?, element_name_cn = ?, element_name_en = ?, catalog_id = ?,
         object_class = ?, property_name = ?, representation_term = ?, qualifiers_json = ?, definition = ?,
         data_type = ?, max_length = ?, numeric_precision_value = ?, numeric_scale_value = ?, datetime_precision = ?,
         format_pattern = ?, unit = ?, value_domain_id = ?, reference_standard_id = ?, reference_clause = ?,
         aliases_json = ?, tags_json = ?, owner_name = ?, steward_name = ?, lifecycle_status = ?, status = ?
     WHERE id = ? AND status <> 'deleted'${projectId ? " AND project_id = ?" : ""}`,
    [
      payload.elementIdentifier,
      payload.elementCode,
      payload.elementNameCn,
      payload.elementNameEn || null,
      payload.catalogId || null,
      payload.objectClass || null,
      payload.propertyName || null,
      payload.representationTerm || null,
      JSON.stringify(payload.qualifiers || []),
      payload.definition || null,
      payload.dataType || "string",
      payload.maxLength ?? null,
      payload.numericPrecision ?? null,
      payload.numericScale ?? null,
      payload.datetimePrecision || null,
      payload.formatPattern || null,
      payload.unit || null,
      payload.valueDomainId || null,
      payload.referenceStandardId || null,
      payload.referenceClause || null,
      JSON.stringify(payload.aliases || []),
      JSON.stringify(payload.tags || []),
      payload.ownerName || null,
      payload.stewardName || null,
      payload.lifecycleStatus || "draft",
      payload.status || "active",
      id,
      ...(projectId ? [projectId] : []),
    ]
  );
  if (!result.affectedRows) return null;
  return getDataElementDetail(id);
}

async function publishDataElement(id, options = {}) {
  const projectId = getCurrentProjectId();
  const element = await getDataElementById(id);
  if (!element) return null;
  const versionNo = element.lifecycleStatus === "published"
    ? element.currentVersionNo + 1
    : element.currentVersionNo;

  await withTransaction(async (db) => {
    await db.query(
      `UPDATE std_data_elements
       SET lifecycle_status = 'published', current_version_no = ?, published_at = NOW()
       WHERE id = ? AND status <> 'deleted'${projectId ? " AND project_id = ?" : ""}`,
      projectId ? [versionNo, id, projectId] : [versionNo, id]
    );
    const updated = { ...element, lifecycleStatus: "published", currentVersionNo: versionNo, publishedAt: new Date() };
    await upsertElementVersion(id, versionNo, "published", buildElementSnapshot(updated), {
      changeSummary: options.changeSummary || null,
      createdBy: options.createdBy || "system",
      publishedAt: new Date(),
    }, db);
  });
  return getDataElementDetail(id);
}

async function deleteDataElement(id) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(`UPDATE std_data_elements SET status = 'deleted' WHERE id = ?${projectId ? " AND project_id = ?" : ""}`, projectId ? [id, projectId] : [id]);
  return Number(result.affectedRows || 0) > 0;
}

async function getOverview() {
  const projectId = getCurrentProjectId();
  const projectClause = projectId ? " AND project_id = ?" : "";
  const projectParams = projectId ? [projectId] : [];
  const [[elementRow]] = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(lifecycle_status = 'published' AND status <> 'deleted') AS published,
            SUM(lifecycle_status IN ('draft', 'review') AND status <> 'deleted') AS draft
     FROM std_data_elements
     WHERE status <> 'deleted'${projectClause}`,
    projectParams,
  );
  const [[catalogRow]] = await pool.query(`SELECT COUNT(*) AS total FROM std_catalogs WHERE status <> 'deleted'${projectClause}`, projectParams);
  const [[domainRow]] = await pool.query(`SELECT COUNT(*) AS total FROM std_value_domains WHERE status <> 'deleted'${projectClause}`, projectParams);
  const [[referenceRow]] = await pool.query(`SELECT COUNT(*) AS total FROM std_reference_standards WHERE status <> 'deleted'${projectClause}`, projectParams);
  const [[mappingRow]] = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(mapping_status = 'approved') AS approved,
            SUM(mapping_status = 'suggested') AS suggested
     FROM std_field_mappings
     WHERE mapping_status <> 'deleted'${projectClause}`,
    projectParams,
  );
  const [recentElements] = await pool.query(
    `${buildElementSelect()}
     WHERE e.status <> 'deleted'${projectId ? " AND e.project_id = ?" : ""}
     GROUP BY e.id, c.catalog_name, c.catalog_code, vd.domain_name, vd.domain_code, rs.standard_name
     ORDER BY e.updated_at DESC
     LIMIT 6`,
    projectParams,
  );
  return {
    elementCount: Number(elementRow.total || 0),
    publishedElementCount: Number(elementRow.published || 0),
    draftElementCount: Number(elementRow.draft || 0),
    catalogCount: Number(catalogRow.total || 0),
    valueDomainCount: Number(domainRow.total || 0),
    referenceStandardCount: Number(referenceRow.total || 0),
    mappingCount: Number(mappingRow.total || 0),
    approvedMappingCount: Number(mappingRow.approved || 0),
    suggestedMappingCount: Number(mappingRow.suggested || 0),
    recentElements: recentElements.map(mapElement),
  };
}

async function listAiConfigs() {
  const projectId = getCurrentProjectId();
  const [rows] = await pool.query(
    `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            p.config_name AS defaultModelProviderName,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.user_prompt_template AS userPromptTemplate,
            c.output_schema_json AS outputSchema, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt
     FROM std_ai_configs c
     LEFT JOIN model_providers p ON p.id = c.default_model_provider_id
     ${projectId ? "WHERE c.project_id = ?" : ""}
     ORDER BY c.scene_code ASC`,
    projectId ? [projectId] : [],
  );
  return rows.map(mapAiConfig);
}

async function getAiConfigBySceneCode(sceneCode) {
  const projectId = getCurrentProjectId();
  const [rows] = await pool.query(
    `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            p.config_name AS defaultModelProviderName,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.user_prompt_template AS userPromptTemplate,
            c.output_schema_json AS outputSchema, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt
     FROM std_ai_configs c
     LEFT JOIN model_providers p ON p.id = c.default_model_provider_id
     WHERE c.scene_code = ?${projectId ? " AND c.project_id = ?" : ""}
     LIMIT 1`,
    projectId ? [sceneCode, projectId] : [sceneCode]
  );
  return rows[0] ? mapAiConfig(rows[0]) : null;
}

async function getAiConfigById(id) {
  const configs = await listAiConfigs();
  return configs.find((item) => item.id === Number(id)) || null;
}

async function createAiConfig(payload, db = pool) {
  const projectId = getCurrentProjectId();
  const [result] = await db.query(
    `INSERT INTO std_ai_configs
      (project_id, scene_name, scene_code, default_model_provider_id, default_model_name, default_model_version,
       temperature, max_tokens, timeout_ms, system_prompt, user_prompt_template, output_schema_json,
       description, owner_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
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
      JSON.stringify(payload.outputSchema || {}),
      payload.description || null,
      payload.ownerName || "system",
      payload.status || "active",
    ]
  );
  return getAiConfigById(result.insertId);
}

async function updateAiConfig(id, payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `UPDATE std_ai_configs
     SET scene_name = ?, scene_code = ?, default_model_provider_id = ?, default_model_name = ?,
         default_model_version = ?, temperature = ?, max_tokens = ?, timeout_ms = ?,
         system_prompt = ?, user_prompt_template = ?, output_schema_json = ?,
         description = ?, owner_name = ?, status = ?
     WHERE id = ?${projectId ? " AND project_id = ?" : ""}`,
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
      JSON.stringify(payload.outputSchema || {}),
      payload.description || null,
      payload.ownerName || "system",
      payload.status || "active",
      id,
      ...(projectId ? [projectId] : []),
    ]
  );
  if (!result.affectedRows) return null;
  return getAiConfigById(id);
}

async function createAiRun(payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO std_ai_runs
      (project_id, scene_code, target_type, target_id, model_provider_id, model_name, model_version,
       request_json, response_json, status, duration_ms, error_message, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.sceneCode,
      payload.targetType || null,
      payload.targetId || null,
      payload.modelProviderId || null,
      payload.modelName || null,
      payload.modelVersion || null,
      payload.request ? JSON.stringify(payload.request) : null,
      payload.response ? JSON.stringify(payload.response) : null,
      payload.status || "success",
      payload.durationMs ?? null,
      payload.errorMessage || null,
      payload.createdBy || "system",
    ]
  );
  return result.insertId;
}

async function listFieldMappings(filters = {}) {
  const where = ["fm.mapping_status <> 'deleted'"];
  const params = [];
  addProjectCondition(where, params, "fm");
  if (filters.elementId) {
    where.push("fm.element_id = ?");
    params.push(Number(filters.elementId));
  }
  if (filters.mappingStatus) {
    where.push("fm.mapping_status = ?");
    params.push(String(filters.mappingStatus));
  }
  if (filters.keyword) {
    where.push("(fm.table_name LIKE ? OR fm.column_name LIKE ? OR e.element_name_cn LIKE ? OR e.element_code LIKE ?)");
    const keyword = `%${String(filters.keyword).trim()}%`;
    params.push(keyword, keyword, keyword, keyword);
  }

  const [rows] = await pool.query(
    `SELECT fm.id, fm.element_id AS elementId, e.element_code AS elementCode, e.element_name_cn AS elementNameCn,
            fm.source_module AS sourceModule, fm.resource_id AS resourceId, fm.resource_code AS resourceCode,
            fm.table_name AS tableName, fm.column_name AS columnName, fm.field_snapshot_json AS fieldSnapshot,
            fm.mapping_status AS mappingStatus, fm.confidence, fm.evidence_json AS evidence,
            fm.created_by AS createdBy, fm.reviewed_by AS reviewedBy, fm.reviewed_at AS reviewedAt,
            fm.created_at AS createdAt, fm.updated_at AS updatedAt
     FROM std_field_mappings fm
     JOIN std_data_elements e ON e.id = fm.element_id
     WHERE ${where.join(" AND ")}
     ORDER BY fm.updated_at DESC, fm.id DESC`,
    params
  );

  return rows.map((row) => ({
    id: Number(row.id),
    elementId: Number(row.elementId),
    elementCode: row.elementCode,
    elementNameCn: row.elementNameCn,
    sourceModule: row.sourceModule,
    resourceId: toNumber(row.resourceId),
    resourceCode: row.resourceCode || "",
    tableName: row.tableName,
    columnName: row.columnName,
    fieldSnapshot: parseJson(row.fieldSnapshot, {}),
    mappingStatus: row.mappingStatus,
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    evidence: parseJson(row.evidence, []),
    createdBy: row.createdBy || "system",
    reviewedBy: row.reviewedBy || "",
    reviewedAt: row.reviewedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

module.exports = {
  buildElementSnapshot,
  createAiConfig,
  createAiRun,
  createCatalog,
  createDataElement,
  createReferenceStandard,
  createValueDomain,
  deleteCatalog,
  deleteDataElement,
  deleteReferenceStandard,
  deleteValueDomain,
  getAiConfigById,
  getAiConfigBySceneCode,
  getCatalogById,
  getDataElementById,
  getDataElementDetail,
  getNextElementCode,
  getOverview,
  getReferenceStandardById,
  getValueDomainById,
  listAiConfigs,
  listCatalogs,
  listDataElementIdentityKeys,
  listDataElements,
  listFieldMappings,
  listReferenceStandards,
  listValueDomains,
  publishDataElement,
  updateAiConfig,
  updateCatalog,
  updateDataElement,
  updateReferenceStandard,
  updateValueDomain,
};
