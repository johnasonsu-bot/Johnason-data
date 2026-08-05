const { pool } = require("../../config/database");
const { getCurrentProjectId } = require("../../common/utils/project-context");

function getScopedWhere(alias, options = {}) {
  const projectId = getCurrentProjectId();
  if (!projectId) {
    return { sql: "", params: [], projectId: null };
  }
  const prefix = alias ? `${alias}.` : "";
  const sql = options.includeBuiltin
    ? `(${prefix}project_id = ? OR ${prefix}is_builtin = 1)`
    : `${prefix}project_id = ?`;
  return { sql, params: [projectId], projectId };
}

function appendScopedWhere(conditions, params, alias, options = {}) {
  const scoped = getScopedWhere(alias, options);
  if (scoped.sql) {
    conditions.push(scoped.sql);
    params.push(...scoped.params);
  }
  return scoped.projectId;
}

function parseJsonField(value, fallback) {
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

function mapDataSourceRow(row) {
  return {
    id: Number(row.id),
    sourceName: row.sourceName,
    sourceCode: row.sourceCode,
    sourceType: row.sourceType,
    connectionConfig: parseJsonField(row.connectionConfig, {}),
    ownerName: row.ownerName || "system",
    status: row.status || "active",
    datasetCount: Number(row.datasetCount || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapDatasetFolderRow(row) {
  return {
    id: Number(row.id),
    folderName: row.folderName,
    parentId: row.parentId === null ? null : Number(row.parentId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapDatasetRow(row) {
  return {
    id: Number(row.id),
    datasetName: row.datasetName,
    datasetCode: row.datasetCode,
    sourceId: Number(row.sourceId),
    folderId: row.folderId === null ? null : Number(row.folderId),
    sourceName: row.sourceName || null,
    sourceType: row.sourceType || null,
    folderName: row.folderName || null,
    datasetType: row.datasetType || "table",
    sourceTable: row.sourceTable || null,
    sourceSql: row.sourceSql || null,
    fields: parseJsonField(row.fields, []),
    queryConfig: parseJsonField(row.queryConfig, {}),
    cacheConfig: parseJsonField(row.cacheConfig, {}),
    ownerName: row.ownerName || "system",
    status: row.status || "draft",
    description: row.description || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapChartAssetRow(row) {
  return {
    id: Number(row.id),
    chartName: row.chartName,
    chartCode: row.chartCode,
    chartType: row.chartType || "echarts",
    category: row.category || "custom",
    chartFamily: row.chartFamily || row.category || "custom",
    variantName: row.variantName || row.chartName,
    renderMode: row.renderMode || "dataset",
    coverImageUrl: row.coverImageUrl || null,
    description: row.description || null,
    tags: parseJsonField(row.tags, []),
    config: parseJsonField(row.config, {}),
    optionTemplate: parseJsonField(row.optionTemplate, {}),
    mappingSchema: parseJsonField(row.mappingSchema, {}),
    ownerName: row.ownerName || "system",
    status: row.status || "draft",
    isBuiltin: Boolean(row.isBuiltin),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapWidgetRow(row) {
  return {
    id: Number(row.id),
    widgetKey: row.widgetKey,
    widgetName: row.widgetName,
    widgetType: row.widgetType,
    datasetId: row.datasetId == null ? null : Number(row.datasetId),
    chartAssetId: row.chartAssetId == null ? null : Number(row.chartAssetId),
    position: parseJsonField(row.position, {}),
    props: parseJsonField(row.props, {}),
    queryParams: parseJsonField(row.queryParams, {}),
  };
}

function mapDashboardRow(row, widgets = []) {
  return {
    id: Number(row.id),
    dashboardName: row.dashboardName,
    dashboardCode: row.dashboardCode,
    layoutMode: row.layoutMode || "grid",
    themeTemplateId: row.themeTemplateId == null ? null : Number(row.themeTemplateId),
    themeSettings: parseJsonField(row.themeSettings, {}),
    themeConfig: parseJsonField(row.themeConfig, {}),
    filterConfig: parseJsonField(row.filterConfig, {}),
    canvasConfig: parseJsonField(row.canvasConfig, {}),
    ownerName: row.ownerName || "system",
    status: row.status || "draft",
    description: row.description || null,
    widgetCount: Number(row.widgetCount || widgets.length || 0),
    widgets,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapThemeTemplateRow(row) {
  return {
    id: Number(row.id),
    themeName: row.themeName,
    themeCode: row.themeCode,
    category: row.category || "general",
    description: row.description || null,
    isBuiltin: Boolean(row.isBuiltin),
    status: row.status || "active",
    previewImage: row.previewImage || null,
    createdBy: row.createdBy || "system",
    canvas: parseJsonField(row.canvas, {}),
    chrome: parseJsonField(row.chrome, {}),
    semantic: parseJsonField(row.semantic, {}),
    chartCommon: parseJsonField(row.chartCommon, {}),
    chartVariants: parseJsonField(row.chartVariants, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildAiRunInsertParams(payload = {}) {
  const provider = payload.provider || {};
  return [
    payload.sceneCode,
    payload.sourceId || null,
    payload.promptText || null,
    payload.generatedSql || null,
    payload.finalSql || null,
    provider.id || payload.modelProviderId || null,
    provider.modelName || payload.modelName || null,
    provider.modelVersion || payload.modelVersion || null,
    payload.chartFamily || null,
    payload.chartAssetId || null,
    JSON.stringify(payload.fieldMap || {}),
    JSON.stringify(payload.request || {}),
    JSON.stringify(payload.response || {}),
    payload.status || "success",
    payload.durationMs == null ? null : Number(payload.durationMs),
    payload.errorMessage || null,
    payload.createdBy || "system",
  ];
}

async function createReportingAiRun(payload) {
  const [result] = await pool.query(
    `INSERT INTO reporting_ai_runs
      (scene_code, source_id, prompt_text, generated_sql, final_sql, model_provider_id, model_name, model_version,
       chart_family, chart_asset_id, field_map_json, request_json, response_json, status, duration_ms, error_message, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    buildAiRunInsertParams(payload)
  );
  return {
    id: Number(result.insertId),
    sceneCode: payload.sceneCode,
    status: payload.status || "success",
  };
}

async function listReportDataSources() {
  const scoped = getScopedWhere("s");
  const datasetScoped = getScopedWhere("");
  const params = [
    ...datasetScoped.params,
    ...scoped.params,
  ];
  const [rows] = await pool.query(
    `SELECT s.id,
            s.source_name AS sourceName,
            s.source_code AS sourceCode,
            s.source_type AS sourceType,
            s.connection_config AS connectionConfig,
            s.owner_name AS ownerName,
            s.status,
            COALESCE(ds.datasetCount, 0) AS datasetCount,
            s.created_at AS createdAt,
            s.updated_at AS updatedAt
     FROM report_data_sources s
     LEFT JOIN (
       SELECT source_id, COUNT(*) AS datasetCount
       FROM report_datasets
       ${datasetScoped.sql ? `WHERE ${datasetScoped.sql}` : ""}
       GROUP BY source_id
     ) ds ON ds.source_id = s.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY s.updated_at DESC, s.id DESC`
    ,
    params
  );
  return rows.map(mapDataSourceRow);
}

async function getReportDataSourceById(id) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id,
            source_name AS sourceName,
            source_code AS sourceCode,
            source_type AS sourceType,
            connection_config AS connectionConfig,
            owner_name AS ownerName,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM report_data_sources
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );
  return rows[0] ? mapDataSourceRow(rows[0]) : null;
}

async function createReportDataSource(payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO report_data_sources
      (project_id, source_name, source_code, source_type, connection_config, owner_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.sourceName,
      payload.sourceCode,
      payload.sourceType,
      JSON.stringify(payload.connectionConfig || {}),
      payload.ownerName,
      payload.status,
    ]
  );
  return getReportDataSourceById(result.insertId);
}

async function updateReportDataSource(id, payload) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE report_data_sources
     SET source_name = ?, source_code = ?, source_type = ?, connection_config = ?, owner_name = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.sourceName,
      payload.sourceCode,
      payload.sourceType,
      JSON.stringify(payload.connectionConfig || {}),
      payload.ownerName,
      payload.status,
      id,
      ...scoped.params,
    ]
  );
  if (!result.affectedRows) {
    return null;
  }
  return getReportDataSourceById(id);
}

async function deleteReportDataSource(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM report_data_sources WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return result.affectedRows > 0;
}

async function countDatasetsBySourceId(id) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM report_datasets
     WHERE source_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return Number(rows[0]?.total || 0);
}

async function listReportDatasetFolders() {
  const scoped = getScopedWhere("f");
  const [rows] = await pool.query(
    `SELECT f.id,
            f.folder_name AS folderName,
            f.parent_id AS parentId,
            f.created_at AS createdAt,
            f.updated_at AS updatedAt
     FROM report_dataset_folders f
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY f.parent_id ASC, f.folder_name ASC, f.id ASC`
    ,
    scoped.params
  );
  return rows.map(mapDatasetFolderRow);
}

async function getReportDatasetFolderById(id) {
  const scoped = getScopedWhere("f");
  const [rows] = await pool.query(
    `SELECT f.id,
            f.folder_name AS folderName,
            f.parent_id AS parentId,
            f.created_at AS createdAt,
            f.updated_at AS updatedAt
     FROM report_dataset_folders f
     WHERE f.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );
  return rows[0] ? mapDatasetFolderRow(rows[0]) : null;
}

async function createReportDatasetFolder(payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO report_dataset_folders (project_id, folder_name, parent_id)
     VALUES (?, ?, ?)`,
    [
      projectId,
      payload.folderName,
      payload.parentId || null,
    ]
  );
  return getReportDatasetFolderById(result.insertId);
}

async function updateReportDatasetFolder(id, payload) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE report_dataset_folders
     SET folder_name = ?, parent_id = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.folderName,
      payload.parentId || null,
      id,
      ...scoped.params,
    ]
  );
  if (!result.affectedRows) {
    return null;
  }
  return getReportDatasetFolderById(id);
}

async function deleteReportDatasetFolder(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM report_dataset_folders WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return result.affectedRows > 0;
}

async function listReportDatasets() {
  const scoped = getScopedWhere("d");
  const [rows] = await pool.query(
    `SELECT d.id,
            d.dataset_name AS datasetName,
            d.dataset_code AS datasetCode,
            d.source_id AS sourceId,
            d.folder_id AS folderId,
            s.source_name AS sourceName,
            s.source_type AS sourceType,
            f.folder_name AS folderName,
            d.dataset_type AS datasetType,
            d.source_table AS sourceTable,
            d.source_sql AS sourceSql,
            d.fields_json AS fields,
            d.query_config_json AS queryConfig,
            d.cache_config_json AS cacheConfig,
            d.owner_name AS ownerName,
            d.status,
            d.description,
            d.created_at AS createdAt,
            d.updated_at AS updatedAt
     FROM report_datasets d
     INNER JOIN report_data_sources s ON s.id = d.source_id
     LEFT JOIN report_dataset_folders f ON f.id = d.folder_id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY d.updated_at DESC, d.id DESC`
    ,
    scoped.params
  );
  return rows.map(mapDatasetRow);
}

async function getReportDatasetById(id) {
  const scoped = getScopedWhere("d");
  const [rows] = await pool.query(
    `SELECT d.id,
            d.dataset_name AS datasetName,
            d.dataset_code AS datasetCode,
            d.source_id AS sourceId,
            d.folder_id AS folderId,
            s.source_name AS sourceName,
            s.source_type AS sourceType,
            f.folder_name AS folderName,
            d.dataset_type AS datasetType,
            d.source_table AS sourceTable,
            d.source_sql AS sourceSql,
            d.fields_json AS fields,
            d.query_config_json AS queryConfig,
            d.cache_config_json AS cacheConfig,
            d.owner_name AS ownerName,
            d.status,
            d.description,
            d.created_at AS createdAt,
            d.updated_at AS updatedAt
     FROM report_datasets d
     INNER JOIN report_data_sources s ON s.id = d.source_id
     LEFT JOIN report_dataset_folders f ON f.id = d.folder_id
     WHERE d.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );
  return rows[0] ? mapDatasetRow(rows[0]) : null;
}

async function createReportDataset(payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO report_datasets
      (project_id, dataset_name, dataset_code, source_id, folder_id, dataset_type, source_table, source_sql, fields_json, query_config_json, cache_config_json, owner_name, status, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.datasetName,
      payload.datasetCode,
      payload.sourceId,
      payload.folderId || null,
      payload.datasetType,
      payload.sourceTable,
      payload.sourceSql,
      JSON.stringify(payload.fields || []),
      JSON.stringify(payload.queryConfig || {}),
      JSON.stringify(payload.cacheConfig || {}),
      payload.ownerName,
      payload.status,
      payload.description || null,
    ]
  );
  return getReportDatasetById(result.insertId);
}

async function updateReportDataset(id, payload) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE report_datasets
     SET dataset_name = ?, dataset_code = ?, source_id = ?, folder_id = ?, dataset_type = ?, source_table = ?, source_sql = ?,
         fields_json = ?, query_config_json = ?, cache_config_json = ?, owner_name = ?, status = ?, description = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.datasetName,
      payload.datasetCode,
      payload.sourceId,
      payload.folderId || null,
      payload.datasetType,
      payload.sourceTable,
      payload.sourceSql,
      JSON.stringify(payload.fields || []),
      JSON.stringify(payload.queryConfig || {}),
      JSON.stringify(payload.cacheConfig || {}),
      payload.ownerName,
      payload.status,
      payload.description || null,
      id,
      ...scoped.params,
    ]
  );
  if (!result.affectedRows) {
    return null;
  }
  return getReportDatasetById(id);
}

async function deleteReportDataset(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM report_datasets WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return result.affectedRows > 0;
}

async function listReportChartAssets() {
  const scoped = getScopedWhere("", { includeBuiltin: true });
  const [rows] = await pool.query(
    `SELECT id,
            chart_name AS chartName,
            chart_code AS chartCode,
            chart_type AS chartType,
            category,
            JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.chartFamily')) AS chartFamily,
            JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.variantName')) AS variantName,
            render_mode AS renderMode,
            cover_image_url AS coverImageUrl,
            description,
            tags_json AS tags,
            config_json AS config,
            option_template_json AS optionTemplate,
            mapping_schema_json AS mappingSchema,
            owner_name AS ownerName,
            status,
            is_builtin AS isBuiltin,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM report_chart_assets
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY is_builtin DESC, updated_at DESC, id DESC`
    ,
    scoped.params
  );
  return rows.map(mapChartAssetRow);
}

async function listReportThemeTemplates() {
  const scoped = getScopedWhere("t", { includeBuiltin: true });
  const [rows] = await pool.query(
    `SELECT t.id,
            t.theme_name AS themeName,
            t.theme_code AS themeCode,
            t.category,
            t.description,
            t.is_builtin AS isBuiltin,
            t.status,
            t.preview_image AS previewImage,
            t.created_by AS createdBy,
            c.canvas_json AS canvas,
            c.chrome_json AS chrome,
            c.semantic_json AS semantic,
            c.chart_common_json AS chartCommon,
            c.chart_variants_json AS chartVariants,
            t.created_at AS createdAt,
            t.updated_at AS updatedAt
     FROM report_theme_templates t
     LEFT JOIN report_theme_template_configs c ON c.template_id = t.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY t.is_builtin DESC, t.updated_at DESC, t.id DESC`
    ,
    scoped.params
  );
  return rows.map(mapThemeTemplateRow);
}

async function getReportThemeTemplateById(id) {
  const scoped = getScopedWhere("t", { includeBuiltin: true });
  const [rows] = await pool.query(
    `SELECT t.id,
            t.theme_name AS themeName,
            t.theme_code AS themeCode,
            t.category,
            t.description,
            t.is_builtin AS isBuiltin,
            t.status,
            t.preview_image AS previewImage,
            t.created_by AS createdBy,
            c.canvas_json AS canvas,
            c.chrome_json AS chrome,
            c.semantic_json AS semantic,
            c.chart_common_json AS chartCommon,
            c.chart_variants_json AS chartVariants,
            t.created_at AS createdAt,
            t.updated_at AS updatedAt
     FROM report_theme_templates t
     LEFT JOIN report_theme_template_configs c ON c.template_id = t.id
     WHERE t.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );
  return rows[0] ? mapThemeTemplateRow(rows[0]) : null;
}

async function createReportThemeTemplate(payload) {
  const projectId = getCurrentProjectId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO report_theme_templates
        (project_id, theme_name, theme_code, category, description, is_builtin, status, preview_image, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        payload.themeName,
        payload.themeCode,
        payload.category,
        payload.description || null,
        payload.isBuiltin ? 1 : 0,
        payload.status,
        payload.previewImage || null,
        payload.createdBy,
      ]
    );
    await connection.query(
      `INSERT INTO report_theme_template_configs
        (template_id, canvas_json, chrome_json, semantic_json, chart_common_json, chart_variants_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        result.insertId,
        JSON.stringify(payload.canvas || {}),
        JSON.stringify(payload.chrome || {}),
        JSON.stringify(payload.semantic || {}),
        JSON.stringify(payload.chartCommon || {}),
        JSON.stringify(payload.chartVariants || {}),
      ]
    );
    await connection.commit();
    return getReportThemeTemplateById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateReportThemeTemplate(id, payload) {
  const scoped = getScopedWhere("", { includeBuiltin: true });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE report_theme_templates
       SET theme_name = ?, theme_code = ?, category = ?, description = ?, is_builtin = ?, status = ?, preview_image = ?, created_by = ?
       WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [
        payload.themeName,
        payload.themeCode,
        payload.category,
        payload.description || null,
        payload.isBuiltin ? 1 : 0,
        payload.status,
        payload.previewImage || null,
        payload.createdBy,
        id,
        ...scoped.params,
      ]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return null;
    }
    await connection.query(
      `INSERT INTO report_theme_template_configs
        (template_id, canvas_json, chrome_json, semantic_json, chart_common_json, chart_variants_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        canvas_json = VALUES(canvas_json),
        chrome_json = VALUES(chrome_json),
        semantic_json = VALUES(semantic_json),
        chart_common_json = VALUES(chart_common_json),
        chart_variants_json = VALUES(chart_variants_json)`,
      [
        id,
        JSON.stringify(payload.canvas || {}),
        JSON.stringify(payload.chrome || {}),
        JSON.stringify(payload.semantic || {}),
        JSON.stringify(payload.chartCommon || {}),
        JSON.stringify(payload.chartVariants || {}),
      ]
    );
    await connection.commit();
    return getReportThemeTemplateById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteReportThemeTemplate(id) {
  const scoped = getScopedWhere("", { includeBuiltin: true });
  const [result] = await pool.query(
    `DELETE FROM report_theme_templates WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return result.affectedRows > 0;
}

async function getReportChartAssetById(id) {
  const scoped = getScopedWhere("", { includeBuiltin: true });
  const [rows] = await pool.query(
    `SELECT id,
            chart_name AS chartName,
            chart_code AS chartCode,
            chart_type AS chartType,
            category,
            JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.chartFamily')) AS chartFamily,
            JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.variantName')) AS variantName,
            render_mode AS renderMode,
            cover_image_url AS coverImageUrl,
            description,
            tags_json AS tags,
            config_json AS config,
            option_template_json AS optionTemplate,
            mapping_schema_json AS mappingSchema,
            owner_name AS ownerName,
            status,
            is_builtin AS isBuiltin,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM report_chart_assets
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );
  return rows[0] ? mapChartAssetRow(rows[0]) : null;
}

async function createReportChartAsset(payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO report_chart_assets
      (project_id, chart_name, chart_code, chart_type, category, render_mode, cover_image_url, description, tags_json, config_json, option_template_json, mapping_schema_json, owner_name, status, is_builtin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.chartName,
      payload.chartCode,
      payload.chartType,
      payload.category,
      payload.renderMode,
      payload.coverImageUrl || null,
      payload.description || null,
      JSON.stringify(payload.tags || []),
      JSON.stringify(payload.config || {}),
      JSON.stringify(payload.optionTemplate || {}),
      JSON.stringify(payload.mappingSchema || {}),
      payload.ownerName,
      payload.status,
      payload.isBuiltin ? 1 : 0,
    ]
  );
  return getReportChartAssetById(result.insertId);
}

async function updateReportChartAsset(id, payload) {
  const scoped = getScopedWhere("", { includeBuiltin: true });
  const [result] = await pool.query(
    `UPDATE report_chart_assets
     SET chart_name = ?, chart_code = ?, chart_type = ?, category = ?, render_mode = ?, cover_image_url = ?, description = ?,
         tags_json = ?, config_json = ?, option_template_json = ?, mapping_schema_json = ?, owner_name = ?, status = ?, is_builtin = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.chartName,
      payload.chartCode,
      payload.chartType,
      payload.category,
      payload.renderMode,
      payload.coverImageUrl || null,
      payload.description || null,
      JSON.stringify(payload.tags || []),
      JSON.stringify(payload.config || {}),
      JSON.stringify(payload.optionTemplate || {}),
      JSON.stringify(payload.mappingSchema || {}),
      payload.ownerName,
      payload.status,
      payload.isBuiltin ? 1 : 0,
      id,
      ...scoped.params,
    ]
  );
  if (!result.affectedRows) {
    return null;
  }
  return getReportChartAssetById(id);
}

async function deleteReportChartAsset(id) {
  const scoped = getScopedWhere("", { includeBuiltin: true });
  const [result] = await pool.query(
    `DELETE FROM report_chart_assets WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return result.affectedRows > 0;
}

async function listReportDashboards() {
  const scoped = getScopedWhere("d");
  const [rows] = await pool.query(
    `SELECT d.id,
            d.dashboard_name AS dashboardName,
            d.dashboard_code AS dashboardCode,
            d.layout_mode AS layoutMode,
            d.theme_template_id AS themeTemplateId,
            d.theme_settings_json AS themeSettings,
            d.theme_config_json AS themeConfig,
            d.filter_config_json AS filterConfig,
            d.canvas_config_json AS canvasConfig,
            d.owner_name AS ownerName,
            d.status,
            d.description,
            COALESCE(w.widgetCount, 0) AS widgetCount,
            d.created_at AS createdAt,
            d.updated_at AS updatedAt
     FROM report_dashboards d
     LEFT JOIN (
       SELECT dashboard_id, COUNT(*) AS widgetCount
       FROM report_dashboard_widgets
       GROUP BY dashboard_id
     ) w ON w.dashboard_id = d.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY d.updated_at DESC, d.id DESC`
    ,
    scoped.params
  );
  return rows.map((row) => mapDashboardRow(row));
}

async function getReportDashboardByName(name) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id,
            dashboard_name AS dashboardName,
            dashboard_code AS dashboardCode,
            layout_mode AS layoutMode,
            theme_template_id AS themeTemplateId,
            theme_settings_json AS themeSettings,
            theme_config_json AS themeConfig,
            filter_config_json AS filterConfig,
            canvas_config_json AS canvasConfig,
            owner_name AS ownerName,
            status,
            description,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM report_dashboards
     WHERE dashboard_name = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [name, ...scoped.params]
  );
  return rows[0] ? mapDashboardRow(rows[0]) : null;
}

async function listWidgetsByDashboardId(dashboardId) {
  const [rows] = await pool.query(
    `SELECT id,
            widget_key AS widgetKey,
            widget_name AS widgetName,
            widget_type AS widgetType,
            dataset_id AS datasetId,
            chart_asset_id AS chartAssetId,
            position_json AS position,
            props_json AS props,
            query_params_json AS queryParams
     FROM report_dashboard_widgets
     WHERE dashboard_id = ?
     ORDER BY id ASC`,
    [dashboardId]
  );
  return rows.map(mapWidgetRow);
}

async function getReportDashboardById(id) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id,
            dashboard_name AS dashboardName,
            dashboard_code AS dashboardCode,
            layout_mode AS layoutMode,
            theme_template_id AS themeTemplateId,
            theme_settings_json AS themeSettings,
            theme_config_json AS themeConfig,
            filter_config_json AS filterConfig,
            canvas_config_json AS canvasConfig,
            owner_name AS ownerName,
            status,
            description,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM report_dashboards
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );
  if (!rows[0]) {
    return null;
  }
  const widgets = await listWidgetsByDashboardId(id);
  return mapDashboardRow(rows[0], widgets);
}

async function getReportDashboardSummaryById(id) {
  const scoped = getScopedWhere("d");
  const [rows] = await pool.query(
    `SELECT d.id,
            d.dashboard_name AS dashboardName,
            d.dashboard_code AS dashboardCode,
            d.layout_mode AS layoutMode,
            d.theme_template_id AS themeTemplateId,
            d.theme_settings_json AS themeSettings,
            d.theme_config_json AS themeConfig,
            d.filter_config_json AS filterConfig,
            d.canvas_config_json AS canvasConfig,
            d.owner_name AS ownerName,
            d.status,
            d.description,
            d.created_at AS createdAt,
            d.updated_at AS updatedAt
     FROM report_dashboards d
     WHERE d.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );
  return rows[0] ? mapDashboardRow(rows[0]) : null;
}

async function replaceDashboardWidgets(connection, dashboardId, widgets = []) {
  await connection.query("DELETE FROM report_dashboard_widgets WHERE dashboard_id = ?", [dashboardId]);
  for (const widget of widgets) {
    await connection.query(
      `INSERT INTO report_dashboard_widgets
        (dashboard_id, widget_key, widget_name, widget_type, dataset_id, chart_asset_id, position_json, props_json, query_params_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dashboardId,
        widget.widgetKey,
        widget.widgetName,
        widget.widgetType,
        widget.datasetId || null,
        widget.chartAssetId || null,
        JSON.stringify(widget.position || {}),
        JSON.stringify(widget.props || {}),
        JSON.stringify(widget.queryParams || {}),
      ]
    );
  }
}

async function createReportDashboard(payload) {
  const projectId = getCurrentProjectId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO report_dashboards
        (project_id, dashboard_name, dashboard_code, layout_mode, theme_template_id, theme_settings_json, theme_config_json, filter_config_json, canvas_config_json, owner_name, status, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        payload.dashboardName,
        payload.dashboardCode,
        payload.layoutMode,
        payload.themeTemplateId || null,
        JSON.stringify(payload.themeSettings || {}),
        JSON.stringify(payload.themeConfig || {}),
        JSON.stringify(payload.filterConfig || {}),
        JSON.stringify(payload.canvasConfig || {}),
        payload.ownerName,
        payload.status,
        payload.description || null,
      ]
    );
    await replaceDashboardWidgets(connection, result.insertId, payload.widgets || []);
    await connection.commit();
    return getReportDashboardById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateReportDashboard(id, payload) {
  const scoped = getScopedWhere("");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE report_dashboards
       SET dashboard_name = ?, dashboard_code = ?, layout_mode = ?, theme_template_id = ?, theme_settings_json = ?, theme_config_json = ?, filter_config_json = ?, canvas_config_json = ?,
           owner_name = ?, status = ?, description = ?
       WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [
        payload.dashboardName,
        payload.dashboardCode,
        payload.layoutMode,
        payload.themeTemplateId || null,
        JSON.stringify(payload.themeSettings || {}),
        JSON.stringify(payload.themeConfig || {}),
        JSON.stringify(payload.filterConfig || {}),
        JSON.stringify(payload.canvasConfig || {}),
        payload.ownerName,
        payload.status,
        payload.description || null,
        id,
        ...scoped.params,
      ]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return null;
    }
    await replaceDashboardWidgets(connection, id, payload.widgets || []);
    await connection.commit();
    return getReportDashboardById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteReportDashboard(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM report_dashboards WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return result.affectedRows > 0;
}

async function getReportingOverview() {
  const projectId = getCurrentProjectId();
  const scopedWhere = projectId ? "WHERE project_id = ?" : "";
  const sharedWhere = projectId ? "WHERE project_id = ? OR is_builtin = 1" : "";
  const params = projectId ? [projectId, projectId, projectId, projectId, projectId] : [];
  const [[overview]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM report_data_sources ${scopedWhere}) AS totalSources,
       (SELECT COUNT(*) FROM report_datasets ${scopedWhere}) AS totalDatasets,
       (SELECT COUNT(*) FROM report_chart_assets ${sharedWhere}) AS totalCharts,
       (SELECT COUNT(*) FROM report_dashboards ${scopedWhere}) AS totalDashboards,
       (SELECT COUNT(*) FROM report_theme_templates ${sharedWhere}) AS totalThemeTemplates`,
    params
  );
  return {
    totalSources: Number(overview.totalSources || 0),
    totalDatasets: Number(overview.totalDatasets || 0),
    totalCharts: Number(overview.totalCharts || 0),
    totalDashboards: Number(overview.totalDashboards || 0),
    totalThemeTemplates: Number(overview.totalThemeTemplates || 0),
  };
}

module.exports = {
  countDatasetsBySourceId,
  createReportingAiRun,
  createReportChartAsset,
  createReportDashboard,
  createReportDataSource,
  createReportDatasetFolder,
  createReportDataset,
  createReportThemeTemplate,
  deleteReportChartAsset,
  deleteReportDashboard,
  deleteReportDataSource,
  deleteReportDatasetFolder,
  deleteReportDataset,
  deleteReportThemeTemplate,
  getReportChartAssetById,
  getReportDashboardById,
  getReportDashboardByName,
  getReportDashboardSummaryById,
  getReportDataSourceById,
  getReportDatasetFolderById,
  getReportDatasetById,
  getReportThemeTemplateById,
  getReportingOverview,
  listReportChartAssets,
  listReportDashboards,
  listReportDataSources,
  listReportDatasetFolders,
  listReportDatasets,
  listReportThemeTemplates,
  updateReportChartAsset,
  updateReportDashboard,
  updateReportDataSource,
  updateReportDatasetFolder,
  updateReportDataset,
  updateReportThemeTemplate,
};
