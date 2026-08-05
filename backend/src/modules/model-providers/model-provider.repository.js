const { pool } = require("../../config/database");

function mapRow(row) {
  let extraConfig = row.extraConfig;

  if (typeof extraConfig === "string") {
    try {
      extraConfig = JSON.parse(extraConfig);
    } catch (error) {
      extraConfig = {};
    }
  }

  return {
    ...row,
    modelVersion: row.modelVersion || null,
    extraConfig: extraConfig || {}
  };
}

async function getModelProviderById(id) {
  const [rows] = await pool.query(
    `SELECT id, config_name AS configName, config_code AS configCode, provider_type AS providerType,
            model_category AS modelCategory, model_name AS modelName, base_url AS baseUrl,
            model_version AS modelVersion, api_key AS apiKey, organization_id AS organizationId, owner_name AS ownerName,
            status, description, extra_config AS extraConfig, created_at AS createdAt, updated_at AS updatedAt
     FROM model_providers
     WHERE id = ?`,
    [id]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

async function listModelProviders() {
  const [rows] = await pool.query(
    `SELECT id, config_name AS configName, config_code AS configCode, provider_type AS providerType,
            model_category AS modelCategory, model_name AS modelName, base_url AS baseUrl,
            model_version AS modelVersion, api_key AS apiKey, organization_id AS organizationId, owner_name AS ownerName,
            status, description, extra_config AS extraConfig, created_at AS createdAt, updated_at AS updatedAt
     FROM model_providers
     ORDER BY id DESC`
  );

  return rows.map(mapRow);
}

async function createModelProvider(payload) {
  const [result] = await pool.query(
    `INSERT INTO model_providers
      (config_name, config_code, provider_type, model_category, model_name, model_version, base_url, api_key,
       organization_id, owner_name, status, description, extra_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.configName,
      payload.configCode,
      payload.providerType,
      payload.modelCategory,
      payload.modelName,
      payload.modelVersion || null,
      payload.baseUrl || null,
      payload.apiKey,
      payload.organizationId || null,
      payload.ownerName,
      payload.status,
      payload.description || null,
      JSON.stringify(payload.extraConfig || {})
    ]
  );

  return getModelProviderById(result.insertId);
}

async function updateModelProvider(id, payload) {
  const [result] = await pool.query(
    `UPDATE model_providers
     SET config_name = ?, config_code = ?, provider_type = ?, model_category = ?, model_name = ?, model_version = ?, base_url = ?,
         api_key = ?, organization_id = ?, owner_name = ?, status = ?, description = ?, extra_config = ?
     WHERE id = ?`,
    [
      payload.configName,
      payload.configCode,
      payload.providerType,
      payload.modelCategory,
      payload.modelName,
      payload.modelVersion || null,
      payload.baseUrl || null,
      payload.apiKey,
      payload.organizationId || null,
      payload.ownerName,
      payload.status,
      payload.description || null,
      JSON.stringify(payload.extraConfig || {}),
      id
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getModelProviderById(id);
}

async function deleteModelProvider(id) {
  const [result] = await pool.query("DELETE FROM model_providers WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

module.exports = {
  getModelProviderById,
  listModelProviders,
  createModelProvider,
  updateModelProvider,
  deleteModelProvider
};
