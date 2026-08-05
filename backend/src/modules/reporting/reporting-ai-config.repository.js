const { pool } = require("../../config/database");

function parseJsonField(value, fallback) {
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

function mapRow(row) {
  return {
    ...row,
    id: Number(row.id),
    defaultModelProviderId: row.defaultModelProviderId ? Number(row.defaultModelProviderId) : null,
    defaultModelName: row.defaultModelName || null,
    defaultModelVersion: row.defaultModelVersion || null,
    temperature: row.temperature === null || row.temperature === undefined ? null : Number(row.temperature),
    maxTokens: row.maxTokens === null || row.maxTokens === undefined ? null : Number(row.maxTokens),
    timeoutMs: row.timeoutMs === null || row.timeoutMs === undefined ? null : Number(row.timeoutMs),
    inputSchema: parseJsonField(row.inputSchema, {}),
  };
}

const SELECT_SQL = `
  SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
         c.default_model_provider_id AS defaultModelProviderId,
         c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
         c.temperature, c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
         c.input_schema_json AS inputSchema, c.system_prompt AS systemPrompt,
         c.description, c.owner_name AS ownerName, c.status,
         c.created_at AS createdAt, c.updated_at AS updatedAt,
         p.config_name AS defaultModelProviderName
  FROM reporting_ai_configs c
  LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
`;

async function listConfigs() {
  const [rows] = await pool.query(`${SELECT_SQL} ORDER BY c.id DESC`);
  return rows.map(mapRow);
}

async function getConfigById(id) {
  const [rows] = await pool.query(`${SELECT_SQL} WHERE c.id = ? LIMIT 1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

async function getConfigByCode(sceneCode) {
  const [rows] = await pool.query(`${SELECT_SQL} WHERE c.scene_code = ? LIMIT 1`, [sceneCode]);
  return rows[0] ? mapRow(rows[0]) : null;
}

async function createConfig(payload) {
  const [result] = await pool.query(
    `INSERT INTO reporting_ai_configs
      (scene_name, scene_code, default_model_provider_id, default_model_name, default_model_version,
       temperature, max_tokens, timeout_ms, input_schema_json, system_prompt, description, owner_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.sceneName,
      payload.sceneCode,
      payload.defaultModelProviderId || null,
      payload.defaultModelName || null,
      payload.defaultModelVersion || null,
      payload.temperature ?? null,
      payload.maxTokens ?? null,
      payload.timeoutMs ?? null,
      JSON.stringify(payload.inputSchema || {}),
      payload.systemPrompt || null,
      payload.description || null,
      payload.ownerName || "System Administrator",
      payload.status || "active",
    ]
  );

  return getConfigById(result.insertId);
}

async function updateConfig(id, payload) {
  const [result] = await pool.query(
    `UPDATE reporting_ai_configs
     SET scene_name = ?, scene_code = ?, default_model_provider_id = ?, default_model_name = ?,
         default_model_version = ?, temperature = ?, max_tokens = ?, timeout_ms = ?,
         input_schema_json = ?, system_prompt = ?, description = ?, owner_name = ?, status = ?
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
      JSON.stringify(payload.inputSchema || {}),
      payload.systemPrompt || null,
      payload.description || null,
      payload.ownerName || "System Administrator",
      payload.status || "active",
      id,
    ]
  );

  if (!result.affectedRows) {
    return null;
  }
  return getConfigById(id);
}

module.exports = {
  createConfig,
  getConfigByCode,
  getConfigById,
  listConfigs,
  updateConfig,
};
