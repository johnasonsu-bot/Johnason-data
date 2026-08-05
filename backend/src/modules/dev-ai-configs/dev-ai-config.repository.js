const { pool } = require("../../config/database");

function mapRow(row) {
  return {
    ...row,
    defaultModelProviderId: row.defaultModelProviderId ? Number(row.defaultModelProviderId) : null,
    defaultModelName: row.defaultModelName || null,
    defaultModelVersion: row.defaultModelVersion || null,
    temperature: row.temperature === null || row.temperature === undefined ? null : Number(row.temperature),
    maxTokens: row.maxTokens === null || row.maxTokens === undefined ? null : Number(row.maxTokens),
    timeoutMs: row.timeoutMs === null || row.timeoutMs === undefined ? null : Number(row.timeoutMs),
  };
}

async function listConfigs() {
  const [rows] = await pool.query(
    `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature,
            c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM dev_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     ORDER BY c.id DESC`
  );

  return rows.map(mapRow);
}

async function getConfigById(id) {
  const [rows] = await pool.query(
    `SELECT c.id, c.scene_name AS sceneName, c.scene_code AS sceneCode,
            c.default_model_provider_id AS defaultModelProviderId,
            c.default_model_name AS defaultModelName, c.default_model_version AS defaultModelVersion,
            c.temperature,
            c.max_tokens AS maxTokens, c.timeout_ms AS timeoutMs,
            c.system_prompt AS systemPrompt, c.description, c.owner_name AS ownerName,
            c.status, c.created_at AS createdAt, c.updated_at AS updatedAt,
            p.config_name AS defaultModelProviderName
     FROM dev_ai_configs c
     LEFT JOIN model_providers p ON c.default_model_provider_id = p.id
     WHERE c.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

async function getConfigByCode(sceneCode) {
  const [rows] = await pool.query(
    `SELECT id, scene_name AS sceneName, scene_code AS sceneCode,
            default_model_provider_id AS defaultModelProviderId,
            default_model_name AS defaultModelName, default_model_version AS defaultModelVersion,
            temperature,
            max_tokens AS maxTokens, timeout_ms AS timeoutMs,
            system_prompt AS systemPrompt, description, owner_name AS ownerName,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM dev_ai_configs
     WHERE scene_code = ?
     LIMIT 1`,
    [sceneCode]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

async function updateConfig(id, payload) {
  const [result] = await pool.query(
    `UPDATE dev_ai_configs
     SET scene_name = ?, scene_code = ?, default_model_provider_id = ?, default_model_name = ?, default_model_version = ?, temperature = ?, max_tokens = ?, timeout_ms = ?, system_prompt = ?,
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
      payload.description || null,
      payload.ownerName,
      payload.status,
      id,
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getConfigById(id);
}

module.exports = {
  listConfigs,
  getConfigById,
  getConfigByCode,
  updateConfig,
};
