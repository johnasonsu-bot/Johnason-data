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

function appendScopedWhere(conditions, params, alias) {
  const scoped = getScopedWhere(alias);
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

function mapServiceRow(row) {
  return {
    id: Number(row.id),
    projectId: row.projectId === null || row.projectId === undefined ? null : Number(row.projectId),
    serviceName: row.serviceName,
    serviceCode: row.serviceCode,
    servicePath: row.servicePath,
    requestMethod: row.requestMethod,
    dataDomain: row.dataDomain,
    sourceId: row.sourceId === null || row.sourceId === undefined ? null : Number(row.sourceId),
    sourceName: row.sourceName || null,
    sourceType: row.sourceType || null,
    serviceMode: row.serviceMode || "table",
    sourceTable: row.sourceTable || null,
    sourceSql: row.sourceSql || null,
    serviceType: row.serviceType || "list",
    authType: row.authType || "token",
    status: row.status || "draft",
    description: row.description || null,
    queryConfig: parseJsonField(row.queryConfig, { filters: [], pagination: true }),
    responseConfig: parseJsonField(row.responseConfig, { fields: [] }),
    ownerName: row.ownerName || "system",
    publishedAt: row.publishedAt || null,
    lastCalledAt: row.lastCalledAt || null,
    totalCalls: Number(row.totalCalls || 0),
    successCalls: Number(row.successCalls || 0),
    failedCalls: Number(row.failedCalls || 0),
    avgLatencyMs: Number(row.avgLatencyMs || 0),
    authorizationCount: Number(row.authorizationCount || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapServiceDataSourceRow(row) {
  return {
    id: Number(row.id),
    projectId: row.projectId === null || row.projectId === undefined ? null : Number(row.projectId),
    sourceName: row.sourceName,
    sourceCode: row.sourceCode,
    sourceType: row.sourceType,
    connectionConfig: parseJsonField(row.connectionConfig, {}),
    ownerName: row.ownerName || "system",
    status: row.status || "active",
    serviceCount: Number(row.serviceCount || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAppRow(row) {
  return {
    id: Number(row.id),
    projectId: row.projectId === null || row.projectId === undefined ? null : Number(row.projectId),
    departmentName: row.departmentName || null,
    appName: row.appName,
    appCode: row.appCode,
    appToken: row.appToken,
    contactPhone: row.contactPhone || null,
    appDescription: row.appDescription || null,
    ownerName: row.ownerName || "system",
    status: row.status || "active",
    authorizationCount: Number(row.authorizationCount || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAuthorizationRow(row) {
  return {
    id: Number(row.id),
    projectId: row.projectId === null || row.projectId === undefined ? null : Number(row.projectId),
    serviceId: Number(row.serviceId),
    serviceName: row.serviceName,
    serviceCode: row.serviceCode,
    appId: Number(row.appId),
    appName: row.appName,
    appCode: row.appCode,
    status: row.status || "active",
    rateLimitPerMinute: Number(row.rateLimitPerMinute || 0),
    dailyLimit: Number(row.dailyLimit || 0),
    ipWhitelist: parseJsonField(row.ipWhitelist, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLogRow(row) {
  return {
    id: Number(row.id),
    projectId: row.projectId === null || row.projectId === undefined ? null : Number(row.projectId),
    serviceId: Number(row.serviceId),
    appId: row.appId === null || row.appId === undefined ? null : Number(row.appId),
    serviceName: row.serviceName || null,
    serviceCode: row.serviceCode,
    appName: row.appName || null,
    appCode: row.appCode || null,
    servicePath: row.servicePath,
    requestMethod: row.requestMethod,
    authType: row.authType,
    requestParams: parseJsonField(row.requestParams, {}),
    responseStatus: row.responseStatus,
    success: Boolean(row.success),
    httpStatus: Number(row.httpStatus || 0),
    latencyMs: Number(row.latencyMs || 0),
    clientIp: row.clientIp || null,
    errorMessage: row.errorMessage || null,
    calledAt: row.calledAt,
  };
}

const SERVICE_COLUMNS_SQL = `sa.id,
       sa.project_id AS projectId,
       sa.service_name AS serviceName,
       sa.service_code AS serviceCode,
       sa.service_path AS servicePath,
       sa.request_method AS requestMethod,
       sa.data_domain AS dataDomain,
       sa.service_mode AS serviceMode,
       sa.source_id AS sourceId,
       ds.source_name AS sourceName,
       ds.source_type AS sourceType,
       sa.source_table AS sourceTable,
       sa.source_sql AS sourceSql,
       sa.service_type AS serviceType,
       sa.auth_type AS authType,
       sa.status,
       sa.description,
       sa.query_config_json AS queryConfig,
       sa.response_config_json AS responseConfig,
       sa.owner_name AS ownerName,
       sa.published_at AS publishedAt,
       sa.last_called_at AS lastCalledAt,
       sa.total_calls AS totalCalls,
       sa.success_calls AS successCalls,
       sa.failed_calls AS failedCalls,
       sa.avg_latency_ms AS avgLatencyMs,
       sa.created_at AS createdAt,
       sa.updated_at AS updatedAt`;

async function getServiceById(id) {
  const scoped = getScopedWhere("sa");
  const [rows] = await pool.query(
    `SELECT ${SERVICE_COLUMNS_SQL}
     FROM service_apis sa
     LEFT JOIN service_data_sources ds ON ds.id = sa.source_id
     WHERE sa.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );

  return rows[0] ? mapServiceRow(rows[0]) : null;
}

async function listServices() {
  const scoped = getScopedWhere("sa");
  const authScoped = getScopedWhere("");
  const params = [...authScoped.params, ...scoped.params];
  const [rows] = await pool.query(
    `SELECT ${SERVICE_COLUMNS_SQL},
            COALESCE(auth.authorizationCount, 0) AS authorizationCount
     FROM service_apis sa
     LEFT JOIN service_data_sources ds ON ds.id = sa.source_id
     LEFT JOIN (
       SELECT service_id, COUNT(*) AS authorizationCount
       FROM service_api_authorizations
       ${authScoped.sql ? `WHERE ${authScoped.sql}` : ""}
       GROUP BY service_id
     ) auth ON auth.service_id = sa.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY sa.updated_at DESC, sa.id DESC`
    ,
    params
  );

  return rows.map((row) => mapServiceRow(row));
}

async function createService(payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO service_apis (
       project_id, service_name, service_code, service_path, request_method, data_domain,
       service_mode, source_id, source_table, source_sql, service_type, auth_type, status, description,
       query_config_json, response_config_json, owner_name, published_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.serviceName,
      payload.serviceCode,
      payload.servicePath,
      payload.requestMethod,
      payload.dataDomain,
      payload.serviceMode || "table",
      payload.sourceId,
      payload.sourceTable,
      payload.sourceSql || null,
      payload.serviceType,
      payload.authType,
      payload.status,
      payload.description,
      JSON.stringify(payload.queryConfig || { filters: [], pagination: true }),
      JSON.stringify(payload.responseConfig || { fields: [] }),
      payload.ownerName,
      payload.publishedAt || null,
    ]
  );

  return getServiceById(result.insertId);
}

async function updateService(id, payload) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE service_apis
     SET service_name = ?,
         service_code = ?,
         service_path = ?,
         request_method = ?,
         data_domain = ?,
         service_mode = ?,
         source_id = ?,
         source_table = ?,
         source_sql = ?,
         service_type = ?,
         auth_type = ?,
         status = ?,
         description = ?,
         query_config_json = ?,
         response_config_json = ?,
         owner_name = ?,
         published_at = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.serviceName,
      payload.serviceCode,
      payload.servicePath,
      payload.requestMethod,
      payload.dataDomain,
      payload.serviceMode || "table",
      payload.sourceId,
      payload.sourceTable,
      payload.sourceSql || null,
      payload.serviceType,
      payload.authType,
      payload.status,
      payload.description,
      JSON.stringify(payload.queryConfig || { filters: [], pagination: true }),
      JSON.stringify(payload.responseConfig || { fields: [] }),
      payload.ownerName,
      payload.publishedAt || null,
      id,
      ...scoped.params,
    ]
  );

  if (!result.affectedRows) {
    return null;
  }

  return getServiceById(id);
}

async function deleteService(id) {
  const scoped = getScopedWhere("");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM service_api_authorizations WHERE service_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [id, ...scoped.params]
    );
    await connection.query(
      `DELETE FROM service_api_call_logs WHERE service_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [id, ...scoped.params]
    );
    const [result] = await connection.query(
      `DELETE FROM service_apis WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [id, ...scoped.params]
    );
    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findPublishedServiceByPath(method, servicePath) {
  const [rows] = await pool.query(
    `SELECT ${SERVICE_COLUMNS_SQL}
     FROM service_apis sa
     LEFT JOIN service_data_sources ds ON ds.id = sa.source_id
     WHERE sa.request_method = ?
       AND sa.service_path = ?
       AND sa.status = 'published'
     LIMIT 1`,
    [method, servicePath]
  );

  return rows[0] ? mapServiceRow(rows[0]) : null;
}

async function listServiceDataSources() {
  const scoped = getScopedWhere("ds");
  const serviceScoped = getScopedWhere("");
  const params = [...serviceScoped.params, ...scoped.params];
  const [rows] = await pool.query(
    `SELECT ds.id,
            ds.project_id AS projectId,
            ds.source_name AS sourceName,
            ds.source_code AS sourceCode,
            ds.source_type AS sourceType,
            ds.connection_config AS connectionConfig,
            ds.owner_name AS ownerName,
            ds.status,
            COALESCE(serviceStats.serviceCount, 0) AS serviceCount,
            ds.created_at AS createdAt,
            ds.updated_at AS updatedAt
     FROM service_data_sources ds
     LEFT JOIN (
       SELECT source_id, COUNT(*) AS serviceCount
       FROM service_apis
       ${serviceScoped.sql ? `WHERE ${serviceScoped.sql}` : ""}
       GROUP BY source_id
     ) serviceStats ON serviceStats.source_id = ds.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY ds.updated_at DESC, ds.id DESC`
    ,
    params
  );

  return rows.map((row) => mapServiceDataSourceRow(row));
}

async function getServiceDataSourceById(id) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id,
            project_id AS projectId,
            source_name AS sourceName,
            source_code AS sourceCode,
            source_type AS sourceType,
            connection_config AS connectionConfig,
            owner_name AS ownerName,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM service_data_sources
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );

  return rows[0] ? mapServiceDataSourceRow(rows[0]) : null;
}

async function createServiceDataSource(payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO service_data_sources
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

  return getServiceDataSourceById(result.insertId);
}

async function updateServiceDataSource(id, payload) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE service_data_sources
     SET source_name = ?,
         source_code = ?,
         source_type = ?,
         connection_config = ?,
         owner_name = ?,
         status = ?
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

  return getServiceDataSourceById(id);
}

async function countServiceReferencesByDataSourceId(id) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM service_apis
     WHERE source_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return Number(rows[0]?.total || 0);
}

async function deleteServiceDataSource(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM service_data_sources WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return result.affectedRows > 0;
}

function mapServiceAiConfigRow(row) {
  return {
    id: Number(row.id),
    sceneName: row.sceneName,
    sceneCode: row.sceneCode,
    defaultModelProviderId: row.defaultModelProviderId == null ? null : Number(row.defaultModelProviderId),
    defaultModelProviderName: row.defaultModelProviderName || null,
    defaultModelName: row.defaultModelName || null,
    defaultModelVersion: row.defaultModelVersion || null,
    temperature: row.temperature == null ? null : Number(row.temperature),
    maxTokens: row.maxTokens == null ? null : Number(row.maxTokens),
    timeoutMs: row.timeoutMs == null ? null : Number(row.timeoutMs),
    systemPrompt: row.systemPrompt || "",
    description: row.description || null,
    ownerName: row.ownerName || "system",
    status: row.status || "active",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listServiceAiConfigs() {
  const [rows] = await pool.query(
    `SELECT c.id,
            c.scene_name AS sceneName,
            c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName,
            c.default_model_version AS defaultModelVersion,
            c.temperature,
            c.max_tokens AS maxTokens,
            c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt,
            c.description,
            c.owner_name AS ownerName,
            c.status,
            c.created_at AS createdAt,
            c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM service_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     ORDER BY c.id DESC`
  );
  return rows.map(mapServiceAiConfigRow);
}

async function getServiceAiConfigById(id) {
  const [rows] = await pool.query(
    `SELECT c.id,
            c.scene_name AS sceneName,
            c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName,
            c.default_model_version AS defaultModelVersion,
            c.temperature,
            c.max_tokens AS maxTokens,
            c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt,
            c.description,
            c.owner_name AS ownerName,
            c.status,
            c.created_at AS createdAt,
            c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM service_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     WHERE c.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ? mapServiceAiConfigRow(rows[0]) : null;
}

async function getServiceAiConfigByCode(sceneCode) {
  const [rows] = await pool.query(
    `SELECT id,
            scene_name AS sceneName,
            scene_code AS sceneCode,
            default_model_provider_id AS defaultModelProviderId,
            default_model_name AS defaultModelName,
            default_model_version AS defaultModelVersion,
            temperature,
            max_tokens AS maxTokens,
            timeout_ms AS timeoutMs,
            system_prompt AS systemPrompt,
            description,
            owner_name AS ownerName,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM service_ai_configs
     WHERE scene_code = ?
     LIMIT 1`,
    [sceneCode]
  );
  return rows[0] ? mapServiceAiConfigRow(rows[0]) : null;
}

async function updateServiceAiConfig(id, payload) {
  const [result] = await pool.query(
    `UPDATE service_ai_configs
     SET scene_name = ?,
         scene_code = ?,
         default_model_provider_id = ?,
         default_model_name = ?,
         default_model_version = ?,
         temperature = ?,
         max_tokens = ?,
         timeout_ms = ?,
         system_prompt = ?,
         description = ?,
         owner_name = ?,
         status = ?
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
      payload.description || null,
      payload.ownerName,
      payload.status,
      id,
    ]
  );
  if (!result.affectedRows) {
    return null;
  }
  return getServiceAiConfigById(id);
}

async function listServiceApps() {
  const scoped = getScopedWhere("app");
  const authScoped = getScopedWhere("");
  const params = [...authScoped.params, ...scoped.params];
  const [rows] = await pool.query(
    `SELECT app.id,
            app.project_id AS projectId,
            app.department_name AS departmentName,
            app.app_name AS appName,
            app.app_code AS appCode,
            app.app_token AS appToken,
            app.contact_phone AS contactPhone,
            app.app_description AS appDescription,
            app.owner_name AS ownerName,
            app.status,
            COALESCE(auth.authorizationCount, 0) AS authorizationCount,
            app.created_at AS createdAt,
            app.updated_at AS updatedAt
     FROM service_apps app
     LEFT JOIN (
       SELECT app_id, COUNT(*) AS authorizationCount
       FROM service_api_authorizations
       ${authScoped.sql ? `WHERE ${authScoped.sql}` : ""}
       GROUP BY app_id
     ) auth ON auth.app_id = app.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY app.updated_at DESC, app.id DESC`
    ,
    params
  );

  return rows.map((row) => mapAppRow(row));
}

async function getServiceAppById(id) {
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT id,
            project_id AS projectId,
            department_name AS departmentName,
            app_name AS appName,
            app_code AS appCode,
            app_token AS appToken,
            contact_phone AS contactPhone,
            app_description AS appDescription,
            owner_name AS ownerName,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM service_apps
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );

  return rows[0] ? mapAppRow(rows[0]) : null;
}

async function createServiceApp(payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO service_apps (project_id, department_name, app_name, app_code, app_token, contact_phone, app_description, owner_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.departmentName,
      payload.appName,
      payload.appCode,
      payload.appToken,
      payload.contactPhone,
      payload.appDescription,
      payload.ownerName,
      payload.status,
    ]
  );

  return getServiceAppById(result.insertId);
}

async function updateServiceApp(id, payload) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE service_apps
     SET department_name = ?,
         app_name = ?,
         app_code = ?,
         app_token = ?,
         contact_phone = ?,
         app_description = ?,
         owner_name = ?,
         status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.departmentName,
      payload.appName,
      payload.appCode,
      payload.appToken,
      payload.contactPhone,
      payload.appDescription,
      payload.ownerName,
      payload.status,
      id,
      ...scoped.params,
    ]
  );

  if (!result.affectedRows) {
    return null;
  }

  return getServiceAppById(id);
}

async function deleteServiceApp(id) {
  const scoped = getScopedWhere("");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM service_api_authorizations WHERE app_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [id, ...scoped.params]
    );
    await connection.query(
      `UPDATE service_api_call_logs SET app_id = NULL WHERE app_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [id, ...scoped.params]
    );
    const [result] = await connection.query(
      `DELETE FROM service_apps WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
      [id, ...scoped.params]
    );
    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findServiceAppByToken(appToken) {
  const [rows] = await pool.query(
    `SELECT id,
            project_id AS projectId,
            department_name AS departmentName,
            app_name AS appName,
            app_code AS appCode,
            app_token AS appToken,
            contact_phone AS contactPhone,
            app_description AS appDescription,
            owner_name AS ownerName,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM service_apps
     WHERE app_token = ?
     LIMIT 1`,
    [appToken]
  );

  return rows[0] ? mapAppRow(rows[0]) : null;
}

async function listAuthorizations() {
  const scoped = getScopedWhere("saa");
  const [rows] = await pool.query(
    `SELECT saa.id,
            saa.project_id AS projectId,
            saa.service_id AS serviceId,
            sa.service_name AS serviceName,
            sa.service_code AS serviceCode,
            saa.app_id AS appId,
            app.app_name AS appName,
            app.app_code AS appCode,
            saa.status,
            saa.rate_limit_per_minute AS rateLimitPerMinute,
            saa.daily_limit AS dailyLimit,
            saa.ip_whitelist_json AS ipWhitelist,
            saa.created_at AS createdAt,
            saa.updated_at AS updatedAt
     FROM service_api_authorizations saa
     INNER JOIN service_apis sa ON sa.id = saa.service_id
     INNER JOIN service_apps app ON app.id = saa.app_id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     ORDER BY saa.updated_at DESC, saa.id DESC`
    ,
    scoped.params
  );

  return rows.map((row) => mapAuthorizationRow(row));
}

async function getAuthorizationById(id) {
  const scoped = getScopedWhere("saa");
  const [rows] = await pool.query(
    `SELECT saa.id,
            saa.project_id AS projectId,
            saa.service_id AS serviceId,
            sa.service_name AS serviceName,
            sa.service_code AS serviceCode,
            saa.app_id AS appId,
            app.app_name AS appName,
            app.app_code AS appCode,
            saa.status,
            saa.rate_limit_per_minute AS rateLimitPerMinute,
            saa.daily_limit AS dailyLimit,
            saa.ip_whitelist_json AS ipWhitelist,
            saa.created_at AS createdAt,
            saa.updated_at AS updatedAt
     FROM service_api_authorizations saa
     INNER JOIN service_apis sa ON sa.id = saa.service_id
     INNER JOIN service_apps app ON app.id = saa.app_id
     WHERE saa.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [id, ...scoped.params]
  );

  return rows[0] ? mapAuthorizationRow(rows[0]) : null;
}

async function createAuthorization(payload) {
  const projectId = getCurrentProjectId();
  const [result] = await pool.query(
    `INSERT INTO service_api_authorizations (
       project_id, service_id, app_id, status, rate_limit_per_minute, daily_limit, ip_whitelist_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      payload.serviceId,
      payload.appId,
      payload.status,
      payload.rateLimitPerMinute,
      payload.dailyLimit,
      JSON.stringify(payload.ipWhitelist || []),
    ]
  );

  return getAuthorizationById(result.insertId);
}

async function updateAuthorization(id, payload) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `UPDATE service_api_authorizations
     SET service_id = ?,
         app_id = ?,
         status = ?,
         rate_limit_per_minute = ?,
         daily_limit = ?,
         ip_whitelist_json = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [
      payload.serviceId,
      payload.appId,
      payload.status,
      payload.rateLimitPerMinute,
      payload.dailyLimit,
      JSON.stringify(payload.ipWhitelist || []),
      id,
      ...scoped.params,
    ]
  );

  if (!result.affectedRows) {
    return null;
  }

  return getAuthorizationById(id);
}

async function deleteAuthorization(id) {
  const scoped = getScopedWhere("");
  const [result] = await pool.query(
    `DELETE FROM service_api_authorizations WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [id, ...scoped.params]
  );
  return result.affectedRows > 0;
}

async function findAuthorization(serviceId, appId) {
  const scoped = getScopedWhere("saa");
  const [rows] = await pool.query(
    `SELECT saa.id,
            saa.project_id AS projectId,
            saa.service_id AS serviceId,
            sa.service_name AS serviceName,
            sa.service_code AS serviceCode,
            saa.app_id AS appId,
            app.app_name AS appName,
            app.app_code AS appCode,
            saa.status,
            saa.rate_limit_per_minute AS rateLimitPerMinute,
            saa.daily_limit AS dailyLimit,
            saa.ip_whitelist_json AS ipWhitelist,
            saa.created_at AS createdAt,
            saa.updated_at AS updatedAt
     FROM service_api_authorizations saa
     INNER JOIN service_apis sa ON sa.id = saa.service_id
     INNER JOIN service_apps app ON app.id = saa.app_id
     WHERE saa.service_id = ? AND saa.app_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
    [serviceId, appId, ...scoped.params]
  );

  return rows[0] ? mapAuthorizationRow(rows[0]) : null;
}

async function countCallsSince(serviceId, appId, startTime, endTime = null) {
  const params = [serviceId, appId, startTime];
  let sql = `SELECT COUNT(*) AS total
             FROM service_api_call_logs
             WHERE service_id = ?
               AND app_id = ?
               AND called_at >= ?`;

  if (endTime) {
    sql += " AND called_at < ?";
    params.push(endTime);
  }

  const [rows] = await pool.query(sql, params);
  return Number(rows[0]?.total || 0);
}

async function recordServiceCall(payload) {
  const connection = await pool.getConnection();
  const projectId = payload.projectId || getCurrentProjectId() || null;

  try {
    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO service_api_call_logs (
         project_id, service_id, app_id, service_code, service_path, request_method, auth_type,
         request_params_json, response_status, success, http_status, latency_ms, client_ip, error_message
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        payload.serviceId,
        payload.appId,
        payload.serviceCode,
        payload.servicePath,
        payload.requestMethod,
        payload.authType,
        JSON.stringify(payload.requestParams || {}),
        payload.responseStatus,
        payload.success ? 1 : 0,
        payload.httpStatus,
        payload.latencyMs,
        payload.clientIp || null,
        payload.errorMessage || null,
      ]
    );

    await connection.query(
      `UPDATE service_apis
       SET total_calls = total_calls + 1,
           success_calls = success_calls + ?,
           failed_calls = failed_calls + ?,
           avg_latency_ms = ROUND(((avg_latency_ms * total_calls) + ?) / (total_calls + 1), 2),
           last_called_at = NOW()
       WHERE id = ?`,
      [
        payload.success ? 1 : 0,
        payload.success ? 0 : 1,
        payload.latencyMs,
        payload.serviceId,
      ]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listServiceLogs(options = {}) {
  const limit = Math.max(1, Math.min(1000, Number(options.limit || 50) || 50));
  const conditions = [];
  const params = [];
  appendScopedWhere(conditions, params, "log");

  if (options.serviceId) {
    conditions.push("log.service_id = ?");
    params.push(options.serviceId);
  }

  if (options.appId) {
    conditions.push("log.app_id = ?");
    params.push(options.appId);
  }

  if (options.departmentName) {
    conditions.push("app.department_name = ?");
    params.push(options.departmentName);
  }

  if (options.startAt) {
    conditions.push("log.called_at >= ?");
    params.push(options.startAt);
  }

  if (options.endAt) {
    conditions.push("log.called_at <= ?");
    params.push(options.endAt);
  }

  if (options.paramsKeyword) {
    conditions.push("log.request_params_json LIKE ?");
    params.push(`%${options.paramsKeyword}%`);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT log.id,
            log.project_id AS projectId,
            log.service_id AS serviceId,
            log.app_id AS appId,
            sa.service_name AS serviceName,
            log.service_code AS serviceCode,
            app.app_name AS appName,
            app.app_code AS appCode,
            log.service_path AS servicePath,
            log.request_method AS requestMethod,
            log.auth_type AS authType,
            log.request_params_json AS requestParams,
            log.response_status AS responseStatus,
            log.success,
            log.http_status AS httpStatus,
            log.latency_ms AS latencyMs,
            log.client_ip AS clientIp,
            log.error_message AS errorMessage,
            log.called_at AS calledAt
     FROM service_api_call_logs log
     INNER JOIN service_apis sa ON sa.id = log.service_id
     LEFT JOIN service_apps app ON app.id = log.app_id
     ${whereSql}
     ORDER BY log.called_at DESC, log.id DESC
     LIMIT ${limit}`,
    params
  );

  return rows.map((row) => mapLogRow(row));
}

async function getOverview() {
  const projectId = getCurrentProjectId();
  const scopedWhere = projectId ? "WHERE project_id = ?" : "";
  const todayWhere = projectId ? "WHERE project_id = ? AND called_at >= CURRENT_DATE()" : "WHERE called_at >= CURRENT_DATE()";
  const logTodayWhere = projectId ? "log.project_id = ? AND log.called_at >= CURRENT_DATE()" : "log.called_at >= CURRENT_DATE()";
  const errorWhere = projectId ? "log.project_id = ? AND log.success = 0" : "log.success = 0";
  const [[serviceSummary]] = await pool.query(
    `SELECT COUNT(*) AS totalServices,
            SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS publishedServices
     FROM service_apis ${scopedWhere}`,
    projectId ? [projectId] : []
  );
  const [[appSummary]] = await pool.query(
    `SELECT COUNT(*) AS totalApps FROM service_apps ${scopedWhere}`,
    projectId ? [projectId] : []
  );
  const [[callSummary]] = await pool.query(
    `SELECT COUNT(*) AS totalCallsToday,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successCallsToday,
            AVG(latency_ms) AS avgLatencyMsToday
     FROM service_api_call_logs
     ${todayWhere}`,
    projectId ? [projectId] : []
  );
  const [topServices] = await pool.query(
    `SELECT sa.id AS serviceId,
            sa.service_name AS serviceName,
            sa.service_code AS serviceCode,
            COUNT(*) AS callCount
     FROM service_api_call_logs log
     INNER JOIN service_apis sa ON sa.id = log.service_id
     WHERE ${logTodayWhere}
     GROUP BY sa.id
     ORDER BY callCount DESC, sa.id DESC
     LIMIT 5`,
    projectId ? [projectId] : []
  );
  const [topApps] = await pool.query(
    `SELECT app.id AS appId,
            app.app_name AS appName,
            app.app_code AS appCode,
            COUNT(*) AS callCount
     FROM service_api_call_logs log
     INNER JOIN service_apps app ON app.id = log.app_id
     WHERE ${logTodayWhere}
     GROUP BY app.id
     ORDER BY callCount DESC, app.id DESC
     LIMIT 5`,
    projectId ? [projectId] : []
  );
  const [recentErrors] = await pool.query(
    `SELECT log.id,
            log.service_id AS serviceId,
            sa.service_name AS serviceName,
            log.service_code AS serviceCode,
            app.app_name AS appName,
            log.error_message AS errorMessage,
            log.http_status AS httpStatus,
            log.called_at AS calledAt
     FROM service_api_call_logs log
     INNER JOIN service_apis sa ON sa.id = log.service_id
     LEFT JOIN service_apps app ON app.id = log.app_id
     WHERE ${errorWhere}
     ORDER BY log.called_at DESC, log.id DESC
     LIMIT 10`,
    projectId ? [projectId] : []
  );

  return {
    totalServices: Number(serviceSummary.totalServices || 0),
    publishedServices: Number(serviceSummary.publishedServices || 0),
    totalApps: Number(appSummary.totalApps || 0),
    totalCallsToday: Number(callSummary.totalCallsToday || 0),
    successRateToday: Number(callSummary.totalCallsToday || 0)
      ? Number((((callSummary.successCallsToday || 0) / callSummary.totalCallsToday) * 100).toFixed(2))
      : 0,
    avgLatencyMsToday: Number(callSummary.avgLatencyMsToday || 0),
    topServices: topServices.map((row) => ({
      serviceId: Number(row.serviceId),
      serviceName: row.serviceName,
      serviceCode: row.serviceCode,
      callCount: Number(row.callCount || 0),
    })),
    topApps: topApps.map((row) => ({
      appId: Number(row.appId),
      appName: row.appName,
      appCode: row.appCode,
      callCount: Number(row.callCount || 0),
    })),
    recentErrors: recentErrors.map((row) => ({
      id: Number(row.id),
      serviceId: Number(row.serviceId),
      serviceName: row.serviceName,
      serviceCode: row.serviceCode,
      appName: row.appName || null,
      errorMessage: row.errorMessage || null,
      httpStatus: Number(row.httpStatus || 0),
      calledAt: row.calledAt,
    })),
  };
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDashboardCount(value) {
  return `${Number(value || 0)}次`;
}

function formatDayOverDayChange(currentValue, previousValue) {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);
  if (current === 0 && previous === 0) return "较昨 0%";
  if (previous === 0) return current > 0 ? "较昨 +100%" : "较昨 0%";
  const deltaPercent = ((current - previous) / previous) * 100;
  const rounded = Math.round(Math.abs(deltaPercent));
  if (rounded === 0) return "较昨 0%";
  return `较昨 ${deltaPercent >= 0 ? "+" : "-"}${rounded}%`;
}

function resolveDashboardHeroStatus(successRate, avgLatencyMs, failedCalls) {
  if (successRate >= 98 && avgLatencyMs <= 120 && failedCalls <= 2) return "整体健康";
  if (successRate >= 92 && avgLatencyMs <= 500) return "运行平稳";
  return "存在波动";
}

function buildDashboardRankTone(index) {
  if (index % 3 === 0) return "blue";
  if (index % 3 === 1) return "cyan";
  return "gold";
}

function buildDashboardTrendPoints(logs, range, now) {
  const todayStart = startOfDay(now);
  const bucketCount = range === "24h" ? 24 : range === "7d" ? 7 : 30;
  const start = range === "24h" ? todayStart : addDays(todayStart, -(bucketCount - 1));
  const end = now;
  const labels = Array.from({ length: bucketCount }, (_item, index) => {
    const bucketTime = range === "24h"
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), index)
      : addDays(start, index);
    return range === "24h"
      ? bucketTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
      : bucketTime.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  });

  const buckets = labels.map((label) => ({
    label,
    calls: 0,
    activeApps: 0,
    latencyMs: 0,
  }));
  const latencySums = Array.from({ length: bucketCount }, () => 0);
  const latencyCounts = Array.from({ length: bucketCount }, () => 0);
  const appSets = Array.from({ length: bucketCount }, () => new Set());
  const startTime = start.getTime();
  const endTime = end.getTime();

  for (const log of logs) {
    const timestamp = new Date(log.calledAt).getTime();
    if (!Number.isFinite(timestamp) || timestamp < startTime || timestamp > endTime) continue;
    const bucketIndex = range === "24h"
      ? new Date(log.calledAt).getHours()
      : Math.floor((startOfDay(new Date(log.calledAt)).getTime() - startTime) / (24 * 60 * 60 * 1000));
    if (bucketIndex < 0 || bucketIndex >= bucketCount) continue;
    buckets[bucketIndex].calls += 1;
    appSets[bucketIndex].add(log.appName || "匿名应用");
    latencySums[bucketIndex] += Number(log.latencyMs || 0);
    latencyCounts[bucketIndex] += 1;
  }

  return buckets.map((bucket, index) => ({
    ...bucket,
    activeApps: appSets[index].size,
    latencyMs: latencyCounts[index] ? Math.round(latencySums[index] / latencyCounts[index]) : 0,
  }));
}

function filterDashboardLogsByRange(logs, range, now) {
  const todayStart = startOfDay(now);
  const start = range === "24h"
    ? todayStart
    : addDays(todayStart, -(range === "7d" ? 6 : 29));
  const startTime = start.getTime();
  const endTime = now.getTime();

  return logs.filter((log) => {
    const timestamp = new Date(log.calledAt).getTime();
    return Number.isFinite(timestamp) && timestamp >= startTime && timestamp <= endTime;
  });
}

function buildDashboardServiceRanks(logs) {
  const counts = new Map();
  logs.forEach((log) => {
    const label = log.serviceName || log.serviceCode;
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, value], index) => ({
      key: `service-${label}`,
      label,
      value,
      displayValue: formatDashboardCount(value),
      tone: buildDashboardRankTone(index),
    }));
}

function buildDashboardDepartmentRanks(apps, logs) {
  const appDepartmentById = new Map();
  const appDepartmentByName = new Map();

  apps.forEach((app) => {
    const departmentName = String(app.departmentName || "").trim();
    if (!departmentName) return;
    appDepartmentById.set(app.id, departmentName);
    appDepartmentByName.set(app.appName, departmentName);
  });

  const departmentCounts = new Map();
  logs.forEach((log) => {
    const departmentName = (
      (typeof log.appId === "number" ? appDepartmentById.get(log.appId) : undefined)
      || appDepartmentByName.get(log.appName || "匿名应用")
    );
    if (!departmentName) return;
    departmentCounts.set(departmentName, (departmentCounts.get(departmentName) || 0) + 1);
  });

  return [...departmentCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, value], index) => ({
      key: `department-${label}`,
      label,
      value,
      displayValue: formatDashboardCount(value),
      tone: buildDashboardRankTone(index),
    }));
}

function buildDashboardAppActivityMetric(apps, logs) {
  const appCounts = new Map();
  logs.forEach((log) => {
    const appName = log.appName || "匿名应用";
    appCounts.set(appName, (appCounts.get(appName) || 0) + 1);
  });

  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  const sourceNames = new Set([
    ...apps.map((item) => item.appName),
    ...appCounts.keys(),
  ]);

  sourceNames.forEach((name) => {
    const count = appCounts.get(name) || 0;
    if (count >= 10) highCount += 1;
    else if (count >= 4) mediumCount += 1;
    else lowCount += 1;
  });

  return {
    highCount,
    mediumCount,
    lowCount,
    total: sourceNames.size,
  };
}

async function getOpsDashboard() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const logsWindowStart = addDays(todayStart, -29);
  const projectId = getCurrentProjectId();
  const logsWindowWhere = projectId
    ? "log.project_id = ? AND log.called_at >= ?"
    : "log.called_at >= ?";
  const logsWindowParams = projectId ? [projectId, logsWindowStart] : [logsWindowStart];

  const [services, apps, authorizations, recentLogRows] = await Promise.all([
    listServices(),
    listServiceApps(),
    listAuthorizations(),
    pool.query(
      `SELECT log.id,
              log.project_id AS projectId,
              log.service_id AS serviceId,
              log.app_id AS appId,
              sa.service_name AS serviceName,
              log.service_code AS serviceCode,
              app.app_name AS appName,
              app.app_code AS appCode,
              log.service_path AS servicePath,
              log.request_method AS requestMethod,
              log.auth_type AS authType,
              log.request_params_json AS requestParams,
              log.response_status AS responseStatus,
              log.success,
              log.http_status AS httpStatus,
              log.latency_ms AS latencyMs,
              log.client_ip AS clientIp,
              log.error_message AS errorMessage,
              log.called_at AS calledAt
       FROM service_api_call_logs log
       INNER JOIN service_apis sa ON sa.id = log.service_id
       LEFT JOIN service_apps app ON app.id = log.app_id
       WHERE ${logsWindowWhere}
       ORDER BY log.called_at DESC, log.id DESC`,
      logsWindowParams
    ),
  ]);

  const logs = recentLogRows[0].map((row) => mapLogRow(row));
  const trackedLogs = logs.filter((log) => String(log.authType || "").trim().toLowerCase() === "token");
  const recent24hLogs = filterDashboardLogsByRange(trackedLogs, "24h", now);
  const yesterdayStart = addDays(todayStart, -1).getTime();
  const todayStartTs = todayStart.getTime();
  const yesterdayLogs = trackedLogs.filter((log) => {
    const timestamp = new Date(log.calledAt).getTime();
    return Number.isFinite(timestamp) && timestamp >= yesterdayStart && timestamp < todayStartTs;
  });
  const rangeLogs7d = filterDashboardLogsByRange(trackedLogs, "7d", now);
  const rangeLogs30d = filterDashboardLogsByRange(trackedLogs, "30d", now);
  const recent24hSuccessCount = recent24hLogs.filter((log) => log.success).length;
  const recent24hFailureCount = recent24hLogs.length - recent24hSuccessCount;
  const recent24hAvgLatencyMs = recent24hLogs.length
    ? Math.round(recent24hLogs.reduce((sum, log) => sum + Number(log.latencyMs || 0), 0) / recent24hLogs.length)
    : 0;
  const publishedCount = services.filter((item) => item.status === "published").length;
  const totalApps = apps.length;
  const coverageRate = services.length ? Math.round((publishedCount / Math.max(services.length, 1)) * 100) : 0;
  const successRate = recent24hLogs.length ? (recent24hSuccessCount / recent24hLogs.length) * 100 : 0;
  const runningCount = publishedCount;
  const pendingCount = services.filter((item) => item.status === "draft").length;
  const inactiveCount = services.filter((item) => item.status === "disabled").length;

  return {
    generatedAt: now.toISOString(),
    heroStatus: resolveDashboardHeroStatus(successRate, recent24hAvgLatencyMs, recent24hFailureCount),
    flipMetrics: [
      { key: "services", label: "发布服务数", value: String(publishedCount), accent: `+${Math.max(publishedCount - 1, 0)}`, accentTone: "blue" },
      { key: "apps", label: "应用数", value: String(totalApps), accent: `活跃${Math.max(totalApps, 0)}`, accentTone: "green" },
      { key: "authorizations", label: "授权数", value: String(authorizations.length), accent: `覆盖${coverageRate}%`, accentTone: "blue" },
      { key: "calls", label: "今日调用量", value: String(recent24hLogs.length), accent: formatDayOverDayChange(recent24hLogs.length, yesterdayLogs.length), accentTone: "green" },
      { key: "success", label: "平均成功率", value: `${Math.round(successRate)}%` },
    ],
    trendByRange: {
      "24h": buildDashboardTrendPoints(trackedLogs, "24h", now),
      "7d": buildDashboardTrendPoints(trackedLogs, "7d", now),
      "30d": buildDashboardTrendPoints(trackedLogs, "30d", now),
    },
    serviceRanksByRange: {
      "24h": buildDashboardServiceRanks(recent24hLogs),
      "7d": buildDashboardServiceRanks(rangeLogs7d),
      "30d": buildDashboardServiceRanks(rangeLogs30d),
    },
    departmentRanksByRange: {
      "24h": buildDashboardDepartmentRanks(apps, recent24hLogs),
      "7d": buildDashboardDepartmentRanks(apps, rangeLogs7d),
      "30d": buildDashboardDepartmentRanks(apps, rangeLogs30d),
    },
    statusMetric: {
      publishedRate: coverageRate,
      runningCount,
      pendingCount,
      inactiveCount,
    },
    authorizationMetric: {
      tableCount: services.filter((item) => item.serviceMode === "table").length,
      sqlCount: services.filter((item) => item.serviceMode === "sql").length,
    },
    appActivityMetric: buildDashboardAppActivityMetric(apps, recent24hLogs),
    reminderMetric: {
      slowCalls: recent24hLogs.filter((item) => Number(item.latencyMs || 0) > 300).length,
      failedCalls: recent24hFailureCount,
      pendingAuthorizations: authorizations.filter((item) => item.status !== "active").length,
    },
  };
}

module.exports = {
  countCallsSince,
  countServiceReferencesByDataSourceId,
  createAuthorization,
  createService,
  createServiceDataSource,
  createServiceApp,
  deleteAuthorization,
  deleteService,
  deleteServiceDataSource,
  deleteServiceApp,
  findAuthorization,
  findPublishedServiceByPath,
  findServiceAppByToken,
  getAuthorizationById,
  getOverview,
  getOpsDashboard,
  getServiceAiConfigByCode,
  getServiceAiConfigById,
  getServiceDataSourceById,
  getServiceAppById,
  getServiceById,
  listAuthorizations,
  listServiceAiConfigs,
  listServiceDataSources,
  listServiceApps,
  listServiceLogs,
  listServices,
  recordServiceCall,
  updateServiceAiConfig,
  updateAuthorization,
  updateService,
  updateServiceDataSource,
  updateServiceApp,
};
